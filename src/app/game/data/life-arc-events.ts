import { CrisisArcId, Effect, GameState } from '../models/game.models';
import { monthIndex } from '../engine/calendar';
import type { EvChoice, RandomEvent } from './random-events';
import { childAge } from '../engine/family';
import { worstEnemyName } from '../engine/war';

/* ============================================================
 *  Vie de famille, portes d'entrée des crises (cyberattaque,
 *  procès, Jeux olympiques, dissolution) et leurs rebondissements,
 *  fuite au sein de l'équipe, crise d'une communauté de culte.
 * ============================================================ */

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat, delta });
const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice =>
  ({ id, label, effects, outcome, ...extra });
const fam = (x: Omit<Extract<Effect, { kind: 'family' }>, 'kind'>): Effect => ({ kind: 'family', ...x });
const cr = (arc: CrisisArcId, gauge = 0, risk = 0, start = false, meta?: string): Effect =>
  ({ kind: 'crisis', arc, ...(start ? { start: true } : {}), ...(gauge ? { gauge } : {}), ...(risk ? { risk } : {}), ...(meta ? { meta } : {}) });

// ── Famille ─────────────────────────────────────────────────

export const FAMILY_EVENTS: RandomEvent[] = [
  {
    tag: 'fam_rencontre', weight: 1, eligible: d => !d.family?.partner && d.player.age >= 24 && d.player.age <= 60,
    build: () => ({
      title: 'Une rencontre',
      context: 'Un dîner chez des amis, une conversation qui dure jusqu’à deux heures du matin. Quelqu’un qui ne parle pas de politique — et ça vous fait du bien.',
      choices: [
        c('oui', 'Laisser une chance à cette histoire', [fam({ partner: 'meet' }), s('stress', -4)], 'Le téléphone vibre le lendemain matin. Ce n’est pas votre attachée de presse.'),
        c('non', 'Pas le temps, la carrière d’abord', [s('energy', 2)], 'Vous retournez à vos dossiers. Un peu seul·e.'),
      ],
    }),
  },
  {
    tag: 'fam_mariage', weight: 1, eligible: d => !!d.family?.partner && !d.family.partner.married && d.week - d.family.partner.since >= 12,
    build: d => ({
      title: 'Et si on se mariait ?',
      context: `${d.family!.partner!.name} vous pose la question un dimanche matin. Les magazines people s’intéresseront au mariage d’un·e élu·e.`,
      choices: [
        c('grand', 'Oui, un grand mariage', [fam({ partner: 'marry' }), s('popularity', 3), s('stress', -6), { kind: 'funds', account: 'personal', delta: -6000 }], 'La mairie, l’église du village, trois cents invités.', { needMoney: 6000 }),
        c('intime', 'Oui, dans l’intimité', [fam({ partner: 'marry' }), s('stress', -6)], 'Dix invités, une belle journée, pas un photographe.'),
        c('plus_tard', 'Pas maintenant', [s('stress', 3)], 'Un silence un peu long au petit-déjeuner.'),
      ],
    }),
  },
  {
    tag: 'fam_naissance', weight: 0.8, eligible: d => !!d.family?.partner && d.player.age < 46 && (d.family?.children.length ?? 0) < 3 && d.week - (d.family!.children.at(-1)?.born ?? -99) >= 18,
    build: () => ({
      title: 'Un enfant ?',
      context: 'Votre conjoint·e en parle de plus en plus. Votre agenda, lui, n’a pas de case libre avant 2032.',
      choices: [
        c('oui', 'Fonder une famille', [fam({ child: true }), s('stress', 4), s('popularity', 2)], 'Neuf mois plus tard, une nouvelle voix à la maison. Elle crie plus fort que l’opposition.'),
        c('non', 'Pas maintenant', [s('stress', 2)], 'La conversation est reportée. Encore.'),
      ],
    }),
  },
  {
    tag: 'fam_divorce', weight: 0.5, eligible: d => !!d.family?.partner && d.week - d.family.partner.since >= 24 && d.player.stats.stress >= 45,
    build: d => ({
      title: 'Votre couple vacille',
      context: `Les absences, les week-ends sacrifiés, les photos de vous en une : ${d.family!.partner!.name} n’en peut plus. Un magazine a eu vent de la crise.`,
      choices: [
        c('sauver', 'Tout arrêter quinze jours pour sauver votre couple', [s('stress', -6), s('energy', 8), s('influence', -2)], 'Vous coupez le téléphone. Ça tient, pour l’instant.'),
        c('separer', 'Se séparer, dignement', [fam({ partner: 'divorce' }), s('stress', 8), { kind: 'funds', account: 'personal', delta: -4000 }], 'Un communiqué sobre. La presse respecte, à peu près.'),
        c('nier', 'Démentir la crise dans la presse', [s('stress', 4)], 'Le magazine publie quand même.',
          { risk: { baseChance: 0.5, onFailure: [fam({ partner: 'divorce' }), s('popularity', -4), { kind: 'exposure', delta: 6 }, { kind: 'funds', account: 'personal', delta: -8000 }], failureNews: 'Divorce médiatisé : photos volées, avocats, unes à répétition.' } }),
      ],
    }),
  },
  {
    tag: 'fam_majorite', weight: 1, eligible: d => (d.family?.children ?? []).some(k => !k.path && childAge(d, k.born ?? d.week) >= 18),
    build: d => {
      const kid = d.family!.children.find(k => !k.path && childAge(d, k.born ?? d.week) >= 18)!;
      return {
        title: `${kid.name} a dix-huit ans`,
        context: `${kid.name} vous annonce son choix d’avenir au dîner. Vous retenez votre souffle.`,
        choices: [
          c('parti', 'L’encourager à militer avec vous', [fam({ childPath: 'politique' }), { kind: 'cohesion', delta: 2 }, s('stress', -2)], 'Une carte du parti de plus. Les mauvaises langues parlent déjà de dynastie.'),
          c('libre', 'Le laisser choisir', [fam({ childPath: 'adverse' }), s('stress', 5)], `${kid.name} prend sa carte… chez vos adversaires. La presse adore.`),
          c('ailleurs', 'L’éloigner de la politique', [fam({ childPath: 'ailleurs' }), s('stress', -1)], 'Des études de médecine. Vous êtes soulagé·e.'),
        ],
      };
    },
  },
  {
    tag: 'fam_debat_enfant', weight: 0.7, eligible: d => (d.family?.children ?? []).some(k => k.path === 'adverse'),
    build: d => {
      const kid = d.family!.children.find(k => k.path === 'adverse')!;
      return {
        title: `Débat télévisé face à ${kid.name}`,
        context: `Une chaîne d’info vous propose un débat face à votre enfant, porte-parole des jeunes du camp adverse. L’audience s’annonce record.`,
        choices: [
          c('accepter', 'Accepter le débat', [{ kind: 'minigame', gameId: 'eloquence', title: `Débattre face à ${kid.name}`, reward: [s('popularity', 5), s('influence', 2)], penalty: [s('popularity', -3), s('stress', 4)] }], 'Le plateau le plus tendu — et le plus tendre — de l’année.'),
          c('refuser', 'Refuser : « la famille, c’est sacré »', [s('credibility', 2)], 'Une réponse saluée. Votre enfant y va seul·e, et brille.'),
        ],
      };
    },
  },
  {
    tag: 'fam_parent_malade', weight: 1, eligible: d => (d.family?.parents ?? []).some(x => x.alive && (x.health ?? 60) < 45),
    build: d => {
      const parent = d.family!.parents.find(x => x.alive && (x.health ?? 60) < 45)!;
      const who = parent.name === 'Maman' ? 'votre mère' : 'votre père';
      return {
        title: `${who.charAt(0).toUpperCase()}${who.slice(1)} est hospitalisé·e`,
        context: `Une chute, puis des complications. L’hôpital vous appelle en pleine réunion.`,
        choices: [
          c('present', 'Tout annuler et rester à son chevet', [fam({ parentHealth: 12 }), s('stress', 4), s('energy', -8), s('influence', -2)], 'Des nuits sur une chaise d’hôpital. Il ou elle vous serre la main.'),
          c('clinique', 'Payer une clinique privée et revenir le week-end', [fam({ parentHealth: 8 }), { kind: 'funds', account: 'personal', delta: -3000 }, s('stress', 3)], 'Les meilleurs soins. Votre présence, un peu moins.', { needMoney: 3000 }),
          c('travail', 'Rester au travail', [fam({ parentHealth: -4 }), s('stress', 8)], 'Vous êtes au bureau. Votre tête, ailleurs.'),
        ],
      };
    },
  },
];

// ── Portes d'entrée des crises ──────────────────────────────

export const CRISIS_GATES: RandomEvent[] = [
  {
    tag: 'cyber_gate', weight: 1, minRank: 'depute', eligible: d => !d.crises?.cyber && d.week > 24 && !d.player.flags['cyberDone'],
    build: d => ({
      title: 'Cyberattaque massive',
      context: 'À 6 h 12, les écrans des hôpitaux, des préfectures et de l’Assemblée affichent le même message : une rançon de 300 millions en cryptomonnaie. Une puissance étrangère est soupçonnée.',
      choices: [
        c('front', 'Prendre la tête de la riposte', [cr('cyber', 5, 0, true, worstEnemyName(d)), { kind: 'flag', key: 'cyberDone', value: true }, s('stress', 6)], 'Cellule de crise, ANSSI, alliés : vous coordonnez.'),
        c('discret', 'Laisser les techniciens travailler', [cr('cyber', 0, 10, true, worstEnemyName(d)), { kind: 'flag', key: 'cyberDone', value: true }], 'Vous suivez la crise de loin. Elle vous rattrapera.'),
      ],
    }),
  },
  {
    tag: 'proces_gate', weight: 1, eligible: d => !d.crises?.proces && !d.presidency && (d.player.scandalExposure >= 45 || Number(d.player.flags['illegal'] ?? 0) > 0) && !d.player.flags['procesDone'],
    build: () => ({
      title: 'Une vieille affaire refait surface',
      context: 'Six heures du matin : des enquêteurs sonnent chez vous. Une affaire de financement vieille de dix ans. Garde à vue, perquisition, et votre nom à la une.',
      choices: [
        c('cooperer', 'Coopérer pleinement avec la justice', [cr('proces', 8, -5, true), { kind: 'flag', key: 'procesDone', value: true }, s('credibility', 2), s('stress', 10)], 'Vous répondez à toutes les questions. Votre avocate approuve.'),
        c('complot', 'Dénoncer un « procès politique »', [cr('proces', 0, 8, true), { kind: 'flag', key: 'procesDone', value: true }, s('popularity', 2), s('stress', 8)], 'Vos partisans se mobilisent. Les juges, beaucoup moins.'),
      ],
    }),
  },
  {
    tag: 'jo_gate', weight: 1, minRank: 'depute', eligible: d => !d.crises?.jo && !d.player.flags['joDone'] && d.week > 30,
    build: () => ({
      title: 'La France obtient les Jeux olympiques',
      context: 'Le Comité international a voté : les Jeux auront lieu en France dans dix-huit mois. Le gouvernement cherche des élus pour porter le projet.',
      choices: [
        c('porter', 'S’engager dans l’aventure olympique', [cr('jo', 5, 0, true), { kind: 'flag', key: 'joDone', value: true }, s('popularity', 3)], 'Vous voilà dans le comité d’organisation. Dix-huit mois de folie.'),
        c('critique', 'Dénoncer un gouffre financier', [cr('jo', -5, 5, true), { kind: 'flag', key: 'joDone', value: true }, s('credibility', 2)], 'Vous suivrez les Jeux en spectateur critique.'),
      ],
    }),
  },
  {
    tag: 'dissolution_gate', weight: 1, eligible: d => d.player.rankId === 'depute' && !d.presidency && !d.crises?.dissolution && !d.elections.some(e => !e.resolved),
    build: () => ({
      title: 'Le président dissout l’Assemblée',
      context: 'Allocution surprise à 20 h : « J’ai décidé de dissoudre l’Assemblée nationale. » Les législatives anticipées ont lieu dans trois semaines. Votre siège est en jeu.',
      choices: [
        c('foncer', 'Repartir au combat immédiatement', [cr('dissolution', 5, 0, true), s('stress', 10), s('energy', -6)], 'Vous imprimez les affiches dans la nuit.'),
        c('alliance', 'Chercher tout de suite des alliés locaux', [cr('dissolution', 0, -8, true), s('politicalCapital', -6), s('stress', 8)], 'Trois coups de fil, deux accords, une campagne à mener.'),
      ],
    }),
  },
  {
    tag: 'krach_gate', weight: 1, minRank: 'depute', eligible: d => !d.crises?.krach && d.week > 36 && !d.player.flags['krachDone'],
    build: () => ({
      title: 'Lundi noir à la Bourse',
      context: 'Le CAC 40 dévisse de 12 % à l’ouverture. Une grande banque européenne suspend ses retraits, les files d’attente se forment devant les agences. Les caméras vous cherchent.',
      choices: [
        c('rassurer', 'Monter au créneau pour rassurer', [cr('krach', 6, 0, true), { kind: 'flag', key: 'krachDone', value: true }, s('stress', 6), s('credibility', 2)], '« Les dépôts des Français sont garantis. » Votre voix ne tremble pas.'),
        c('critiquer', 'Accuser la finance folle', [cr('krach', 0, 6, true), { kind: 'flag', key: 'krachDone', value: true }, s('popularity', 3)], 'La salle applaudit. Les marchés, eux, plongent encore.'),
      ],
    }),
  },
  {
    tag: 'megafeux_gate', weight: 1, minRank: 'conseiller_municipal', eligible: d => !d.crises?.megafeux && !d.player.flags['megafeuxDone'] && d.week > 12 && [5, 6, 7].includes(monthIndex(d.week)),
    build: () => ({
      title: 'Le Sud s’embrase',
      context: 'Quarante-deux degrés, des rafales à 80 km/h : trois départs de feu simultanés deviennent un brasier de dix mille hectares. Les préfets appellent à l’aide.',
      choices: [
        c('terrain', 'Partir sur le terrain auprès des pompiers', [cr('megafeux', 6, 0, true), { kind: 'flag', key: 'megafeuxDone', value: true }, s('energy', -8), s('popularity', 2)], 'Odeur de fumée, visages noircis, une nuit au PC de crise.'),
        c('paris', 'Coordonner depuis Paris', [cr('megafeux', 2, 4, true), { kind: 'flag', key: 'megafeuxDone', value: true }], 'Visioconférences et cartes satellites. Loin, trop loin ?'),
      ],
    }),
  },
  {
    tag: 'agri_gate', weight: 1, minRank: 'conseiller_municipal', eligible: d => !d.crises?.agriculteurs && !d.player.flags['agriculteursDone'] && d.week > 18,
    build: () => ({
      title: 'Les tracteurs montent sur Paris',
      context: 'Normes, prix d’achat, accords de libre-échange : la colère paysanne déborde. Des convois bloquent l’A7 et l’A1, du lisier est déversé devant votre permanence.',
      choices: [
        c('ecouter', 'Aller à leur rencontre sur le barrage', [cr('agriculteurs', 8, 0, true), { kind: 'flag', key: 'agriculteursDone', value: true }, s('energy', -6)], 'Une nuit autour d’un brasero. Ils vous parlent de leurs dettes, de leurs enfants.'),
        c('ordre', 'Exiger la levée des blocages', [cr('agriculteurs', 0, 8, true), { kind: 'flag', key: 'agriculteursDone', value: true }, s('credibility', 1)], 'Les tracteurs ne bougent pas. Ils se multiplient.'),
      ],
    }),
  },
  {
    tag: 'taupe_gate', weight: 0.8, minRank: 'depute', eligible: d => !d.crises?.taupe && !d.player.flags['taupeDone'] && d.week > 30,
    build: d => ({
      title: 'Une note secrète à l’étranger',
      context: `Un service allié vous prévient discrètement : une note classifiée sur la défense française a été retrouvée entre les mains de ${worstEnemyName(d)}. Quelqu’un, dans les cercles du pouvoir, trahit.`,
      choices: [
        c('enquete', 'Saisir la DGSI en toute discrétion', [cr('taupe', 8, 0, true, worstEnemyName(d)), { kind: 'flag', key: 'taupeDone', value: true }, s('stress', 5)], 'Une enquête ultra-confidentielle commence. Vous ne faites plus confiance à personne.'),
        c('public', 'Alerter publiquement', [cr('taupe', 0, 8, true, worstEnemyName(d)), { kind: 'flag', key: 'taupeDone', value: true }, s('popularity', 2)], 'Le scandale éclate. La taupe, prévenue, se fait plus prudente.'),
      ],
    }),
  },
];

// ── Rebondissements des crises ──────────────────────────────

export const CRISIS_EVENTS: RandomEvent[] = [
  {
    tag: 'cy_fuite', weight: 1, eligible: d => !!d.crises?.cyber,
    build: () => ({
      title: 'Des dossiers médicaux en ligne',
      context: 'Les pirates publient les dossiers de dix mille patients. Ils menacent de continuer.',
      choices: [
        c('plainte', 'Saisir Europol et prévenir chaque patient', [cr('cyber', 4, -6), s('energy', -6)], 'Une lettre à chaque patient, une enquête internationale.'),
        c('payer', 'Envisager de payer discrètement', [cr('cyber', 8, 4), { kind: 'exposure', delta: 8 }], 'Les fuites s’arrêtent. Jusqu’à ce que la presse l’apprenne ?'),
      ],
    }),
  },
  {
    tag: 'cy_hacker', weight: 0.8, eligible: d => !!d.crises?.cyber,
    build: () => ({
      title: 'Un jeune hacker propose son aide',
      context: 'Un étudiant de vingt ans affirme avoir trouvé une faille dans le logiciel des pirates. Il a lui-même un casier judiciaire.',
      choices: [
        c('recruter', 'Le faire travailler avec l’ANSSI', [cr('cyber', 12)], 'En 48 heures, il neutralise un serveur clé.',
          { risk: { baseChance: 0.25, onFailure: [cr('cyber', -4, 6)], failureNews: 'Fausse piste : il était surtout en quête de célébrité.' } }),
        c('refuser', 'Refuser : trop risqué', [], 'Il publie sa découverte sur un forum.'),
      ],
    }),
  },
  {
    tag: 'pr_juge', weight: 1, eligible: d => !!d.crises?.proces,
    build: () => ({
      title: 'Le juge d’instruction vous convoque',
      context: 'Une confrontation avec votre ancien trésorier, qui vous charge.',
      choices: [
        c('serein', 'Répondre calmement, pièces à l’appui', [cr('proces', 8)], 'Vos documents contredisent sa version.'),
        c('silence', 'Garder le silence', [cr('proces', 0, 5)], 'C’est votre droit. Le juge note.'),
      ],
    }),
  },
  {
    tag: 'pr_presse', weight: 0.8, eligible: d => !!d.crises?.proces,
    build: () => ({
      title: 'Des extraits du dossier dans la presse',
      context: 'Un hebdomadaire publie vos écoutes téléphoniques. Rien d’illégal, mais rien de flatteur.',
      choices: [
        c('violation', 'Dénoncer la violation du secret de l’instruction', [cr('proces', 4), s('credibility', 1)], 'Une enquête est ouverte sur la fuite.'),
        c('excuses', 'S’excuser pour le ton employé', [s('popularity', 2), cr('proces', 0, 2)], 'Des excuses rares en politique. Elles sont remarquées.'),
      ],
    }),
  },
  {
    tag: 'jo_greve', weight: 1, eligible: d => !!d.crises?.jo,
    build: () => ({
      title: 'Grève sur les chantiers olympiques',
      context: 'Les ouvriers du village olympique cessent le travail : cadences infernales, accidents.',
      choices: [
        c('negocier', 'Négocier des primes et la sécurité', [cr('jo', 2, -8), { kind: 'funds', account: 'campaign', delta: -2000 }], 'Accord trouvé en trois jours.'),
        c('ferme', 'Refuser tout retard', [cr('jo', 6, 8)], 'Le chantier reprend… sous tension.'),
      ],
    }),
  },
  {
    tag: 'jo_budget', weight: 0.8, eligible: d => !!d.crises?.jo,
    build: () => ({
      title: 'Le budget olympique explose',
      context: 'La Cour des comptes chiffre un dépassement de deux milliards.',
      choices: [
        c('couper', 'Raboter les cérémonies', [cr('jo', -4, -8), s('credibility', 2)], 'Moins de feux d’artifice, plus de sérieux.'),
        c('assumer', 'Assumer : « la France ne fait pas les choses à moitié »', [cr('jo', 6, 6), s('popularity', 1)], 'Les contribuables grincent.'),
      ],
    }),
  },
  {
    tag: 'di_parachute', weight: 1, eligible: d => !!d.crises?.dissolution,
    build: () => ({
      title: 'Un ministre parachuté contre vous',
      context: 'Le camp adverse envoie un ministre connu dans votre circonscription.',
      choices: [
        c('local', 'Jouer la carte de l’enfant du pays', [cr('dissolution', 8), { kind: 'localProject', attachment: 3 }], '« Lui, il ne sait même pas où est la mairie. »'),
        c('debat', 'Le défier en débat public', [{ kind: 'debate', stakes: 'face_a_face' }, cr('dissolution', 4)], 'Rendez-vous dans la salle des fêtes, jeudi soir.'),
      ],
    }),
  },
  {
    tag: 'kr_banque', weight: 1, eligible: d => !!d.crises?.krach,
    build: () => ({
      title: 'Une banque au bord de la faillite',
      context: 'Le PDG d’une grande banque vous appelle à minuit : sans l’État, elle ne rouvre pas lundi. Trois millions de clients.',
      choices: [
        c('sauver', 'La sauver avec de l’argent public', [cr('krach', 12, -2), s('popularity', -3)], 'La banque rouvre. « On sauve les banquiers, pas les ménages », grince la rue.'),
        c('conditions', 'La sauver sous conditions strictes', [cr('krach', 8, 0), s('credibility', 3), s('politicalCapital', -4)], 'Bonus gelés, dividendes suspendus. La négociation dure toute la nuit.'),
        c('lacher', 'La laisser tomber', [cr('krach', -10, 10), s('popularity', 1)], 'La panique gagne les autres banques.'),
      ],
    }),
  },
  {
    tag: 'kr_usine', weight: 0.8, eligible: d => !!d.crises?.krach,
    build: () => ({
      title: 'Une usine ferme près de chez vous',
      context: 'Huit cents salariés apprennent la fermeture par mail. Ils bloquent le site et vous attendent.',
      choices: [
        c('repreneur', 'Chercher un repreneur', [cr('krach', 3, -6), s('energy', -6), { kind: 'localProject', attachment: 2 }], 'Trois semaines de coups de fil. Un industriel italien s’intéresse au site.'),
        c('promesse', 'Promettre que l’usine ne fermera pas', [s('popularity', 3)], 'Les applaudissements sont nourris.',
          { risk: { baseChance: 0.5, onFailure: [cr('krach', 0, 6), s('credibility', -4)], failureNews: 'L’usine ferme quand même. On vous ressort votre promesse.' } }),
      ],
    }),
  },
  {
    tag: 'mf_village', weight: 1, eligible: d => !!d.crises?.megafeux,
    build: () => ({
      title: 'Un village encerclé par les flammes',
      context: 'Deux cents habitants refusent de partir. Les pompiers demandent l’ordre d’évacuation forcée.',
      choices: [
        c('evacuer', 'Ordonner l’évacuation', [cr('megafeux', 6, -8), s('popularity', -1)], 'Des larmes, des cris, mais personne ne meurt.'),
        c('defendre', 'Concentrer les moyens pour défendre le village', [cr('megafeux', 10, 4)], 'Les Canadair tournent toute la journée.',
          { risk: { baseChance: 0.3, onFailure: [cr('megafeux', -6, 12), s('popularity', -4), s('stress', 8)], failureNews: 'Le vent tourne. Le village brûle en partie.' } }),
      ],
    }),
  },
  {
    tag: 'mf_pyromane', weight: 0.7, eligible: d => !!d.crises?.megafeux,
    build: () => ({
      title: 'Un pyromane interpellé',
      context: 'Un homme a été arrêté pour plusieurs départs de feu. Les réseaux sociaux s’enflamment à leur tour.',
      choices: [
        c('sobre', 'Rester sobre : « laissons la justice travailler »', [s('credibility', 3), cr('megafeux', 2)], 'Une parole calme au milieu du vacarme.'),
        c('climat', 'Rappeler que le vrai coupable est le climat', [s('credibility', 1), s('popularity', -1), cr('megafeux', 0, -3)], 'Le débat sur la prévention est relancé.'),
      ],
    }),
  },
  {
    tag: 'ag_prefecture', weight: 1, eligible: d => !!d.crises?.agriculteurs,
    build: () => ({
      title: 'Une préfecture murée',
      context: 'Des agriculteurs ont muré l’entrée d’une préfecture avec des parpaings. Le préfet demande des CRS.',
      choices: [
        c('dialogue', 'Proposer une table ronde le soir même', [cr('agriculteurs', 10, -4), s('energy', -5)], 'On démure à la main, à minuit, en se serrant la main.'),
        c('crs', 'Soutenir l’intervention des forces de l’ordre', [cr('agriculteurs', -6, 10), s('credibility', 2)], 'Images de gaz lacrymogène sur des tracteurs. Le mouvement se durcit.'),
      ],
    }),
  },
  {
    tag: 'ag_salon', weight: 0.8, eligible: d => !!d.crises?.agriculteurs,
    build: () => ({
      title: 'Le Salon de l’agriculture sous tension',
      context: 'Votre visite au Salon est attendue de pied ferme. Sifflets garantis, ou poignées de main ?',
      choices: [
        c('y_aller', 'Y aller quand même, sans service d’ordre', [{ kind: 'minigame', gameId: 'eloquence', title: 'Convaincre les éleveurs au Salon', reward: [cr('agriculteurs', 12, -6), s('popularity', 4)], penalty: [cr('agriculteurs', -4, 6), s('popularity', -3)] }], 'Une allée bondée, des éleveurs remontés. À vous de parler.'),
        c('annuler', 'Annuler la visite', [cr('agriculteurs', 0, 4), s('stress', -2)], 'Votre absence est remarquée.'),
      ],
    }),
  },
  {
    tag: 'tp_suspect', weight: 1, eligible: d => !!d.crises?.taupe,
    build: () => ({
      title: 'Un suspect dans votre entourage ?',
      context: 'La DGSI vous signale qu’un collaborateur proche a eu des contacts répétés avec un diplomate étranger.',
      choices: [
        c('surveiller', 'Le laisser en place, sous surveillance', [cr('taupe', 10, 3), s('stress', 5)], 'Vous faites comme si de rien n’était. C’est épuisant.'),
        c('ecarter', 'L’écarter immédiatement', [cr('taupe', 3, -6)], 'Les fuites ralentissent. Mais était-ce vraiment lui ?'),
      ],
    }),
  },
  {
    tag: 'tp_presse', weight: 0.8, eligible: d => !!d.crises?.taupe,
    build: () => ({
      title: 'La presse flaire l’affaire',
      context: 'Un journaliste d’investigation vous demande de confirmer l’existence d’une enquête pour espionnage.',
      choices: [
        c('demenir', 'Ne rien confirmer', [cr('taupe', 4), s('credibility', 1)], 'Le secret tient encore quelques semaines.'),
        c('off', 'Lui donner des éléments en off', [s('influence', 2), cr('taupe', -4, 4), { kind: 'exposure', delta: 4 }], 'Un article bien informé paraît. La taupe aussi le lit.'),
      ],
    }),
  },
];

// ── Fuite dans l'équipe, crise de culte ─────────────────────

export const MISC_ARC_EVENTS: RandomEvent[] = [
  {
    tag: 'interview_vedette', weight: 0.8, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'L’invitation de la matinale',
      context: 'Le journaliste le plus craint du PAF vous invite demain à 8 h 20. Il a la réputation de ne rien laisser passer.',
      choices: [
        c('y_aller', 'Y aller sans filet', [{ kind: 'minigame', gameId: 'interview_piege', title: 'L’interview piège', reward: [s('popularity', 4), s('credibility', 3)], penalty: [s('popularity', -3), s('credibility', -2)] }], 'Café serré, micro ouvert. C’est parti.'),
        c('decliner', 'Envoyer un porte-parole', [s('influence', -1)], 'Votre porte-parole s’en sort… moyennement.'),
      ],
    }),
  },
  {
    tag: 'equipe_fuite', weight: 1.2, eligible: d => d.player.team.some(r => (r.morale ?? 60) < 35),
    build: d => {
      const r = d.player.team.filter(x => (x.morale ?? 60) < 35).sort((a, b) => (a.morale ?? 60) - (b.morale ?? 60))[0];
      return {
        title: 'Une fuite dans votre équipe',
        context: `Vos conversations privées sur la messagerie de l’équipe se retrouvent dans la presse. Tout désigne ${r.name}, mal payé·e et à bout.`,
        choices: [
          c('renvoyer', `Renvoyer ${r.name}`, [{ kind: 'team', recruitId: r.id, leave: true }, { kind: 'exposure', delta: 4 }, s('stress', 4)], 'Départ immédiat. Il ou elle promet un livre.'),
          c('parler', 'Lui parler et revaloriser son salaire', [{ kind: 'team', recruitId: r.id, salaryPct: 20, morale: 25 }, { kind: 'exposure', delta: 2 }], 'Une longue conversation. Les fuites cessent.'),
          c('ignorer', 'Faire comme si de rien n’était', [{ kind: 'exposure', delta: 8 }, s('credibility', -3)], 'D’autres extraits paraissent la semaine suivante.'),
        ],
      };
    },
  },
  {
    tag: 'culte_crise', weight: 1, eligible: d => d.player.loans.some(l => l.kind === 'culte'),
    build: d => {
      const loan = d.player.loans.find(l => l.kind === 'culte')!;
      const contact = d.contacts.find(x => x.name === loan.lender);
      return {
        title: `Scandale financier : ${loan.lender}`,
        context: `Une enquête de presse révèle des comptes opaques au sein de la communauté. Votre prêt de ${loan.principal.toLocaleString('fr-FR')} € apparaît dans les documents.`,
        choices: [
          c('rembourser', 'Rembourser tout de suite et prendre vos distances', [{ kind: 'funds', account: 'personal', delta: -loan.remaining }, s('credibility', 3), ...(contact ? [{ kind: 'contact', contactId: contact.id, trust: -15 } as Effect] : [])], 'Un virement, un communiqué. L’affaire ne vous touche plus.', { needMoney: loan.remaining }),
          c('transparence', 'Publier le contrat de prêt : « tout est légal »', [{ kind: 'exposure', delta: 6 }, s('credibility', 1)], 'Le contrat est en règle. Le soupçon, lui, demeure.'),
          c('defendre', 'Défendre publiquement la communauté', [{ kind: 'exposure', delta: 12 }, s('popularity', -3), ...(contact ? [{ kind: 'contact', contactId: contact.id, trust: 15 } as Effect] : [])], 'Les fidèles vous en savent gré. Les autres, beaucoup moins.'),
        ],
      };
    },
  },
  {
    tag: 'dauphin_distance', weight: 0.6, eligible: d => !!d.heir,
    build: d => {
      const n = d.npcs.find(x => x.id === d.heir!.npcId);
      return {
        title: 'Votre dauphin·e prend ses distances',
        context: `${n?.name ?? 'Votre dauphin·e'} critique, à demi-mot, « les méthodes d’une autre époque ». Les journalistes y voient un parricide.`,
        choices: [
          c('benir', 'Bénir publiquement son émancipation', [s('credibility', 2), ...(n ? [{ kind: 'npcRelation', npcId: n.id, delta: 10 } as Effect] : [])], 'Élégant. On salue votre hauteur de vue.'),
          c('recadrer', 'Le ou la recadrer en privé', [...(n ? [{ kind: 'npcRelation', npcId: n.id, delta: -8 } as Effect] : []), s('influence', 1)], 'Le message est passé. La relation, refroidie.'),
        ],
      };
    },
  },
];

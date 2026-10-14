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
  {
    tag: 'blackout_gate', weight: 1, minRank: 'conseiller_municipal', eligible: d => !d.crises?.blackout && !d.player.flags['blackoutDone'] && d.week > 20 && [10, 11, 0, 1].includes(monthIndex(d.week)),
    build: () => ({
      title: 'La France dans le noir',
      context: 'Moins quinze degrés, une consommation record, une ligne à très haute tension qui saute : la panne se propage en cascade. Vingt millions de foyers sans électricité.',
      choices: [
        c('crise', 'Rejoindre la cellule de crise du gestionnaire de réseau', [cr('blackout', 8, 0, true), { kind: 'flag', key: 'blackoutDone', value: true }, s('energy', -6)], 'Une nuit devant les écrans de contrôle, à la lampe frontale.'),
        c('terrain', 'Aller ouvrir des gymnases chauffés', [cr('blackout', 2, -4, true), { kind: 'flag', key: 'blackoutDone', value: true }, s('popularity', 2)], 'Couvertures, soupe chaude, groupes électrogènes : les images marquent.'),
      ],
    }),
  },
  {
    tag: 'crue_gate', weight: 1, minRank: 'depute', eligible: d => !d.crises?.crue && !d.player.flags['crueDone'] && d.week > 24 && [0, 1, 2, 3].includes(monthIndex(d.week)),
    build: () => ({
      title: 'La crue centennale',
      context: 'Après trois semaines de pluie, la Seine dépasse les huit mètres au pont d’Austerlitz. Les modèles annoncent un niveau jamais vu depuis 1910.',
      choices: [
        c('anticiper', 'Faire évacuer les quartiers bas dès maintenant', [cr('crue', 8, 0, true), { kind: 'flag', key: 'crueDone', value: true }, s('popularity', -1)], 'Cent mille personnes évacuées « pour rien », râlent certains. Pour l’instant.'),
        c('attendre', 'Attendre les prochaines prévisions', [cr('crue', 0, 8, true), { kind: 'flag', key: 'crueDone', value: true }], 'L’eau, elle, n’attend pas.'),
      ],
    }),
  },
  {
    tag: 'secheresse_gate', weight: 1, minRank: 'conseiller_municipal', eligible: d => !d.crises?.secheresse && !d.player.flags['secheresseDone'] && d.week > 30 && [5, 6, 7, 8].includes(monthIndex(d.week)),
    build: () => ({
      title: 'Plus une goutte',
      context: 'Huit mois sans vraie pluie. Les préfets multiplient les arrêtés, des communes n’ont plus d’eau au robinet, et les agriculteurs réclament les réserves.',
      choices: [
        c('partage', 'Proposer une conférence du partage de l’eau', [cr('secheresse', 8, 0, true), { kind: 'flag', key: 'secheresseDone', value: true }, { kind: 'segment', segment: 'ruraux', delta: 2 }], 'Agriculteurs, maires, industriels autour d’une table. Ça promet.'),
        c('villes', 'Priorité absolue à l’eau potable des villes', [cr('secheresse', 2, 4, true), { kind: 'flag', key: 'secheresseDone', value: true }, { kind: 'segment', segment: 'ruraux', delta: -3 }, { kind: 'segment', segment: 'cadres', delta: 1 }], 'Les campagnes se sentent sacrifiées.'),
      ],
    }),
  },
  {
    tag: 'autonomie_gate', weight: 0.8, minRank: 'depute', eligible: d => !d.crises?.autonomie && !d.player.flags['autonomieDone'] && d.week > 40,
    build: (d, rng) => {
      const region = rng.pick(['la Corse', 'la Bretagne', 'l’Alsace', 'le Pays basque']);
      return {
        title: `${region.charAt(0).toUpperCase()}${region.slice(1)} réclame son autonomie`,
        context: `L’assemblée régionale vote à une large majorité une motion pour un « statut d’autonomie » : langue, fiscalité, foncier. Paris doit répondre.`,
        choices: [
          c('negocier', 'Ouvrir des négociations', [cr('autonomie', 8, 0, true, region), { kind: 'flag', key: 'autonomieDone', value: true }, s('credibility', 1)], 'Une délégation est reçue place Beauvau. Les jacobins s’étranglent.'),
          c('ferme', '« La République est une et indivisible »', [cr('autonomie', 0, 8, true, region), { kind: 'flag', key: 'autonomieDone', value: true }, { kind: 'segment', segment: 'retraites', delta: 2 }], 'Applaudissements à Paris, sifflets là-bas.'),
        ],
      };
    },
  },
  {
    tag: 'ia_gate', weight: 0.9, minRank: 'depute', eligible: d => !d.crises?.ia && !d.player.flags['iaDone'] && d.week > 30,
    build: () => ({
      title: 'L’algorithme devient fou',
      context: 'Le nouveau système d’intelligence artificielle de l’administration suspend des allocations, recalcule des impôts, convoque des retraités au service militaire. Personne ne sait l’arrêter.',
      choices: [
        c('debrancher', 'Exiger qu’on le débranche immédiatement', [cr('ia', 8, 0, true), { kind: 'flag', key: 'iaDone', value: true }, { kind: 'segment', segment: 'retraites', delta: 2 }], 'Retour au papier et aux tampons. Les files d’attente s’allongent, mais les erreurs cessent.'),
        c('corriger', 'Le corriger en marche', [cr('ia', 2, 6, true), { kind: 'flag', key: 'iaDone', value: true }, { kind: 'segment', segment: 'jeunes', delta: 1 }], 'Les ingénieurs promettent un correctif « sous huit jours ».'),
      ],
    }),
  },
  {
    tag: 'frelons_gate', weight: 0.8, minRank: 'conseiller_municipal', eligible: d => !d.crises?.frelons && !d.player.flags['frelonsDone'] && d.week > 14 && [4, 5, 6, 7, 8].includes(monthIndex(d.week)),
    build: () => ({
      title: 'Les frelons géants arrivent',
      context: 'Des frelons de cinq centimètres ravagent les ruchers. Un apiculteur en larmes vous montre une ruche vide à la télévision. Les réseaux parlent déjà de « frelonpocalypse ».',
      choices: [
        c('plan', 'Lancer un plan national anti-frelons', [cr('frelons', 8, 0, true), { kind: 'flag', key: 'frelonsDone', value: true }, { kind: 'segment', segment: 'ruraux', delta: 2 }], 'On vous moque un peu. Les apiculteurs, eux, vous remercient.'),
        c('relativiser', 'Relativiser : « ce sont des insectes »', [cr('frelons', 0, 8, true), { kind: 'flag', key: 'frelonsDone', value: true }, s('popularity', -1)], 'La phrase tourne en boucle sur les réseaux. Mauvais choix.'),
      ],
    }),
  },
  {
    tag: 'mars_gate', weight: 0.8, minRank: 'depute', eligible: d => !d.crises?.mars && !d.player.flags['marsDone'] && d.week > 48,
    build: () => ({
      title: 'Des Français sur Mars ?',
      context: 'Le CNES propose un programme fou : envoyer quatre astronautes sur Mars en dix mois de préparation accélérée. Il faut un visage politique pour le porter… et des milliards.',
      choices: [
        c('porter', 'Porter le projet', [cr('mars', 6, 0, true), { kind: 'flag', key: 'marsDone', value: true }, s('popularity', 2), { kind: 'segment', segment: 'jeunes', delta: 3 }], 'Vous voilà « Monsieur Mars » (ou « Madame Mars ») pour la presse.'),
        c('prudent', 'Soutenir, mais avec prudence budgétaire', [cr('mars', 2, -4, true), { kind: 'flag', key: 'marsDone', value: true }, s('credibility', 2)], 'Un programme plus lent, plus sûr. Moins glorieux.'),
      ],
    }),
  },
  {
    tag: 'napoleon_gate', weight: 0.8, minRank: 'conseiller_municipal', eligible: d => !d.crises?.napoleon && !d.player.flags['napoleonDone'] && d.week > 30,
    build: () => ({
      title: 'Napoléon est de retour',
      context: 'Un homme en redingote grise et bicorne tient une conférence de presse aux Invalides : « Je suis l’Empereur, cloné à partir d’une mèche de mes cheveux. La France m’a manqué. » Les sondages lui donnent 12 %.',
      choices: [
        c('ridicule', 'Le tourner en ridicule', [cr('napoleon', 4, 2, true), { kind: 'flag', key: 'napoleonDone', value: true }, s('popularity', 1)], 'Vos blagues font rire… ses partisans beaucoup moins.'),
        c('serieux', 'Le prendre au sérieux et défendre la République', [cr('napoleon', 8, 0, true), { kind: 'flag', key: 'napoleonDone', value: true }, s('credibility', 2)], '« La République ne se laissera pas couronner. » Le ton est donné.'),
      ],
    }),
  },
  {
    tag: 'atlantide_gate', weight: 0.8, minRank: 'depute', eligible: d => !d.crises?.atlantide && !d.player.flags['atlantideDone'] && d.week > 36,
    build: () => ({
      title: 'Une île surgit de l’océan',
      context: 'Au large de Brest, après un séisme sous-marin, une île de trente kilomètres émerge, couverte de colonnes de marbre. Des chalutiers espagnols et un navire russe s’en approchent déjà.',
      choices: [
        c('drapeau', 'Y planter le drapeau français sans attendre', [cr('atlantide', 8, 4, true), { kind: 'flag', key: 'atlantideDone', value: true }, s('popularity', 2)], 'Un hélicoptère, un drapeau, une photo. Les capitales étrangères protestent.'),
        c('science', 'Proposer une mission scientifique internationale pilotée par la France', [cr('atlantide', 4, -4, true), { kind: 'flag', key: 'atlantideDone', value: true }, s('credibility', 2)], 'Les archéologues débarquent. Les juristes aussi.'),
      ],
    }),
  },
  {
    tag: 'ia_candidate_gate', weight: 1, minRank: 'conseiller_municipal', eligible: d => !d.crises?.ia_candidate && !d.player.flags['iaCandidateDone'] && d.week > 24 && d.presidential.nextWeek - d.week <= 18 && d.presidential.nextWeek > d.week,
    build: () => ({
      title: 'ALMA se présente',
      context: 'Une intelligence artificielle, « ALMA », déclare sa candidature à l’élection présidentielle. Programme : zéro mensonge, zéro conflit d’intérêts, réponses instantanées. Elle a déjà trois millions d’abonnés.',
      choices: [
        c('debattre', 'Accepter de débattre avec elle', [cr('ia_candidate', 6, 2, true), { kind: 'flag', key: 'iaCandidateDone', value: true }, { kind: 'segment', segment: 'jeunes', delta: 2 }], 'Un débat homme-machine : l’audience promet d’être historique.'),
        c('interdire', 'Demander son interdiction', [cr('ia_candidate', 4, 4, true), { kind: 'flag', key: 'iaCandidateDone', value: true }, { kind: 'segment', segment: 'retraites', delta: 2 }, { kind: 'segment', segment: 'jeunes', delta: -2 }], '« Une machine ne vote pas, elle ne gouverne pas. » Ses fans vous traitent de dinosaure.'),
      ],
    }),
  },
  {
    tag: 'grand_hiver_gate', weight: 0.6, minRank: 'conseiller_municipal', eligible: d => !d.crises?.grand_hiver && !d.player.flags['grandHiverDone'] && d.week > 40,
    build: () => ({
      title: 'L’année sans été',
      context: 'Une éruption volcanique géante en Islande a projeté des cendres dans la haute atmosphère. Les climatologues annoncent deux ans sans véritable été.',
      choices: [
        c('anticiper', 'Lancer immédiatement des stocks stratégiques', [cr('grand_hiver', 8, 0, true), { kind: 'flag', key: 'grandHiverDone', value: true }, { kind: 'economy', deficit: 0.2 }], 'Silos, conserveries, serres chauffées : la France se prépare.'),
        c('marches', 'Faire confiance aux marchés', [cr('grand_hiver', 0, 8, true), { kind: 'flag', key: 'grandHiverDone', value: true }, { kind: 'segment', segment: 'cadres', delta: 1 }], 'Les prix du blé doublent en un mois.'),
      ],
    }),
  },
  {
    tag: 'sosie_gate', weight: 0.6, minRank: 'conseiller_municipal', eligible: d => !d.crises?.sosie && !d.player.flags['sosieDone'] && d.week > 18,
    build: () => ({
      title: 'Vous êtes à deux endroits à la fois',
      context: 'La presse locale publie une photo de vous inaugurant une salle des fêtes… à l’heure exacte où vous étiez en réunion à cent kilomètres. Quelqu’un se fait passer pour vous, et la ressemblance est parfaite.',
      choices: [
        c('plainte', 'Porter plainte et alerter la presse', [cr('sosie', 6, 2, true), { kind: 'flag', key: 'sosieDone', value: true }, s('stress', 3)], 'La gendarmerie ouvre une enquête pour usurpation d’identité. Les rédactions adorent.'),
        c('humour', 'En rire publiquement', [cr('sosie', 3, 4, true), { kind: 'flag', key: 'sosieDone', value: true }, s('popularity', 2)], '« S’il veut faire mes permanences du samedi, qu’il ne se gêne pas. » Le sosie le prend au mot.'),
      ],
    }),
  },
  {
    tag: 'greve_gate', weight: 0.6, minRank: 'conseiller_municipal', eligible: d => !d.crises?.greve_generale && !d.player.flags['greveDone'] && d.week > 24,
    build: () => ({
      title: 'L’appel à la grève générale',
      context: 'Après une réforme de trop, l’intersyndicale unanime appelle à une grève générale reconductible à partir de lundi. Les cheminots, les raffineurs et les enseignants suivent.',
      choices: [
        c('negocier', 'Appeler à ouvrir des négociations', [cr('greve_generale', 6, 2, true), { kind: 'flag', key: 'greveDone', value: true }, { kind: 'segment', segment: 'populaires', delta: 2 }], 'Les syndicats saluent « un premier pas ». Le patronat grince.'),
        c('fermete', 'Défendre la fermeté', [cr('greve_generale', 0, 8, true), { kind: 'flag', key: 'greveDone', value: true }, { kind: 'segment', segment: 'cadres', delta: 2 }, { kind: 'segment', segment: 'populaires', delta: -2 }], '« La rue ne gouverne pas. » Les cortèges grossissent.'),
      ],
    }),
  },
  {
    tag: 'templiers_gate', weight: 0.6, minRank: 'conseiller_municipal', eligible: d => !d.crises?.templiers && !d.player.flags['templiersDone'] && d.week > 14,
    build: () => ({
      title: 'La crypte des Templiers',
      context: 'Des ouvriers qui renforçaient les fondations d’une église ont percé une crypte scellée depuis 1307. À l’intérieur : des coffres frappés de la croix rouge des Templiers. La rumeur d’un trésor enflamme le pays.',
      choices: [
        c('etat', 'Confier le site aux archéologues de l’État', [cr('templiers', 7, 2, true), { kind: 'flag', key: 'templiersDone', value: true }, s('credibility', 2)], 'Barrières, gendarmes et pinceaux : la fouille sera longue et minutieuse.'),
        c('spectacle', 'En faire un événement populaire', [cr('templiers', 3, 6, true), { kind: 'flag', key: 'templiersDone', value: true }, s('popularity', 3)], 'Visites guidées, direct à la télévision : la foule afflue… et les pillards aussi.'),
      ],
    }),
  },
  {
    tag: 'eurovision_gate', weight: 0.6, minRank: 'conseiller_municipal', eligible: d => !d.crises?.eurovision && !d.player.flags['eurovisionDone'] && d.week > 20,
    build: () => ({
      title: 'Douze points pour la France !',
      context: 'Contre toute attente, la France remporte l’Eurovision. Elle organisera la prochaine édition, et on vous demande de porter la candidature de votre ville.',
      choices: [
        c('porter', 'Porter la candidature avec enthousiasme', [cr('eurovision', 6, 3, true), { kind: 'flag', key: 'eurovisionDone', value: true }, { kind: 'segment', segment: 'jeunes', delta: 2 }], 'Votre ville est retenue. Il reste huit mois pour monter le plus grand show d’Europe.'),
        c('sobre', 'Exiger un budget raisonnable', [cr('eurovision', 3, 1, true), { kind: 'flag', key: 'eurovisionDone', value: true }, s('credibility', 2), { kind: 'segment', segment: 'retraites', delta: 1 }], 'Une Eurovision « sobre et populaire ». Les fans s’inquiètent pour les paillettes.'),
      ],
    }),
  },
  {
    tag: 'comete_gate', weight: 0.5, minRank: 'conseiller_municipal', eligible: d => !d.crises?.comete && !d.player.flags['cometeDone'] && d.week > 30,
    build: () => ({
      title: 'Une comète dans le ciel',
      context: 'L’Observatoire de Paris confirme une nouvelle stupéfiante : une comète de deux kilomètres croisera l’orbite terrestre dans six mois. Une chance sur trente de collision.',
      choices: [
        c('verite', 'Dire toute la vérité, chiffres à l’appui', [cr('comete', 6, 4, true), { kind: 'flag', key: 'cometeDone', value: true }, s('credibility', 3)], 'Une allocution grave et précise. Les Français écoutent, inquiets mais rassurés par la franchise.'),
        c('rassurer', 'Rassurer : « Aucun danger »', [cr('comete', 2, 2, true), { kind: 'flag', key: 'cometeDone', value: true }, s('popularity', 1)], 'La panique est évitée… jusqu’à ce que les chiffres fuitent.'),
      ],
    }),
  },
  {
    tag: 'referendum_gate', weight: 0.6, minRank: 'conseiller_municipal', eligible: d => !d.crises?.referendum && !d.player.flags['referendumDone'] && d.week > 16,
    build: () => ({
      title: 'Un million de signatures',
      context: 'Une pétition sur la semaine de quatre jours atteint un million de signatures : le premier référendum d’initiative citoyenne aura lieu dans cinq mois. Il faut choisir votre camp.',
      choices: [
        c('oui', 'Faire campagne pour le oui', [cr('referendum', 5, 3, true), { kind: 'flag', key: 'referendumDone', value: true }, { kind: 'segment', segment: 'jeunes', delta: 2 }, { kind: 'segment', segment: 'populaires', delta: 1 }, { kind: 'segment', segment: 'cadres', delta: -1 }], 'Vous voilà tête d’affiche du oui. Les sondages sont serrés.'),
        c('non', 'Faire campagne pour le non', [cr('referendum', 5, 3, true), { kind: 'flag', key: 'referendumDone', value: true }, { kind: 'segment', segment: 'cadres', delta: 2 }, { kind: 'segment', segment: 'retraites', delta: 1 }, { kind: 'segment', segment: 'jeunes', delta: -1 }], 'Vous prenez la tête du non. Le patronat applaudit.'),
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
  {
    tag: 'bo_hopital', weight: 1, eligible: d => !!d.crises?.blackout,
    build: () => ({
      title: 'Un hôpital à court de carburant',
      context: 'Les groupes électrogènes du CHU n’ont plus que six heures d’autonomie. Des patients sont sous respirateur.',
      choices: [
        c('armee', 'Faire livrer du gazole par l’armée', [cr('blackout', 8, -4), s('credibility', 2)], 'Les camions militaires arrivent à l’aube.'),
        c('transferer', 'Transférer les patients vers une autre région', [cr('blackout', 3, 2), s('energy', -5)], 'Une noria d’ambulances dans la nuit.'),
      ],
    }),
  },
  {
    tag: 'bo_delestage', weight: 0.8, eligible: d => !!d.crises?.blackout,
    build: () => ({
      title: 'Qui couper en premier ?',
      context: 'Pour éviter une nouvelle panne générale, il faut délester. Les usines, ou les particuliers ?',
      choices: [
        c('usines', 'Couper les usines', [cr('blackout', 6), { kind: 'economy', growth: -0.2 }, { kind: 'segment', segment: 'populaires', delta: -2 }], 'Le chômage partiel explose, mais les foyers ont chaud.'),
        c('foyers', 'Couper les foyers deux heures par jour', [cr('blackout', 6, 4), { kind: 'segment', segment: 'retraites', delta: -3 }], 'Des retraités dans le froid : les images sont terribles.'),
      ],
    }),
  },
  {
    tag: 'cr_metro', weight: 1, eligible: d => !!d.crises?.crue,
    build: () => ({
      title: 'Le métro va être noyé',
      context: 'L’eau menace d’envahir le réseau souterrain. Murer les bouches de métro, c’est paralyser Paris pour des mois.',
      choices: [
        c('murer', 'Murer les stations les plus exposées', [cr('crue', 10, -4), { kind: 'economy', growth: -0.1 }], 'Des murs de parpaings dans les couloirs. Le réseau est sauvé.'),
        c('pomper', 'Tout miser sur les pompes', [cr('crue', 4, 4)], 'Les pompes tournent jour et nuit… et tombent en panne à 3 h du matin.'),
      ],
    }),
  },
  {
    tag: 'cr_sinistres', weight: 0.8, eligible: d => !!d.crises?.crue,
    build: () => ({
      title: 'Les sinistrés attendent',
      context: 'Des familles dorment dans des gymnases depuis dix jours. Les assureurs traînent.',
      choices: [
        c('fonds', 'Débloquer un fonds d’urgence', [cr('crue', 4, -6), { kind: 'economy', deficit: 0.1 }, s('popularity', 2)], 'Un chèque de 1 500 € par foyer en quarante-huit heures.'),
        c('assureurs', 'Convoquer les assureurs', [cr('crue', 2, -2), s('credibility', 2)], 'Ils promettent d’accélérer. Promettent.'),
      ],
    }),
  },
  {
    tag: 'se_golf', weight: 1, eligible: d => !!d.crises?.secheresse,
    build: () => ({
      title: 'Les golfs continuent d’arroser',
      context: 'Une vidéo montre des greens verts comme au printemps, à côté d’un champ de maïs grillé. L’indignation est générale.',
      choices: [
        c('interdire', 'Interdire l’arrosage des golfs', [cr('secheresse', 6, -4), { kind: 'segment', segment: 'populaires', delta: 2 }, { kind: 'segment', segment: 'cadres', delta: -2 }], 'Les golfeurs protestent. Tout le monde s’en moque.'),
        c('derogation', 'Maintenir une dérogation « pour l’emploi »', [cr('secheresse', 0, 6), { kind: 'segment', segment: 'ruraux', delta: -3 }], 'L’argument passe mal.'),
      ],
    }),
  },
  {
    tag: 'se_bassines', weight: 0.8, eligible: d => !!d.crises?.secheresse,
    build: () => ({
      title: 'La bataille des méga-bassines',
      context: 'Des réserves d’eau géantes pour l’irrigation : les agriculteurs les réclament, les écologistes manifestent contre.',
      choices: [
        c('pour', 'Soutenir les bassines', [cr('secheresse', 4, 2), { kind: 'segment', segment: 'ruraux', delta: 3 }, { kind: 'segment', segment: 'jeunes', delta: -3 }], 'Les tracteurs applaudissent, les militants climat vous conspuent.'),
        c('moratoire', 'Un moratoire et une concertation', [cr('secheresse', 6, 0), { kind: 'segment', segment: 'jeunes', delta: 2 }, { kind: 'segment', segment: 'ruraux', delta: -1 }], 'Personne n’est satisfait, mais personne ne casse rien.'),
      ],
    }),
  },
  {
    tag: 'au_manif', weight: 1, eligible: d => !!d.crises?.autonomie,
    build: d => ({
      title: 'Une grande manifestation',
      context: `Cinquante mille personnes défilent pour l’autonomie de ${d.crises!.autonomie!.meta ?? 'la région'}. Quelques casseurs en marge du cortège.`,
      choices: [
        c('recevoir', 'Recevoir les organisateurs', [cr('autonomie', 8, -4)], 'Une rencontre longue, franche, utile.'),
        c('fermete', 'Condamner les violences, sans un mot de plus', [cr('autonomie', 0, 6), { kind: 'segment', segment: 'retraites', delta: 1 }], 'Le message passe à Paris. Là-bas, il blesse.'),
      ],
    }),
  },
  {
    tag: 'au_referendum', weight: 0.7, eligible: d => !!d.crises?.autonomie,
    build: () => ({
      title: 'Un référendum local ?',
      context: 'Les élus régionaux proposent de consulter la population sur le futur statut.',
      choices: [
        c('accepter', 'Accepter une consultation non contraignante', [cr('autonomie', 10, 4), s('credibility', 2)], 'Le débat démocratique s’ouvre. L’issue est incertaine.'),
        c('refuser', 'Refuser : « la Constitution ne le permet pas »', [cr('autonomie', -2, 8)], 'Juridiquement solide. Politiquement explosif.'),
      ],
    }),
  },
  {
    tag: 'ia_lanceur', weight: 1, eligible: d => !!d.crises?.ia,
    build: () => ({
      title: 'Une ingénieure lanceuse d’alerte',
      context: 'Une ingénieure du projet affirme qu’on avait signalé les failles de l’IA dès les tests, et que sa hiérarchie a passé outre.',
      choices: [
        c('proteger', 'La protéger et l’écouter', [cr('ia', 10, -2), s('credibility', 2)], 'Ses notes techniques permettent de trouver le bug.'),
        c('minimiser', 'Parler d’un « cas isolé »', [cr('ia', 0, 6), s('credibility', -2)], 'Elle publie ses courriels. Mauvaise semaine.'),
      ],
    }),
  },
  {
    tag: 'ia_victimes', weight: 0.8, eligible: d => !!d.crises?.ia,
    build: () => ({
      title: 'Les victimes de l’algorithme',
      context: 'Une association rassemble des milliers de familles privées d’aides. Elles réclament réparation.',
      choices: [
        c('indemniser', 'Indemniser tout le monde, vite', [cr('ia', 4, -8), { kind: 'economy', deficit: 0.1 }, { kind: 'segment', segment: 'populaires', delta: 3 }], 'Des virements partent par centaines de milliers.'),
        c('cas_par_cas', 'Examiner les dossiers au cas par cas', [cr('ia', 2, 3)], 'Une procédure de plus. Gérée… par l’algorithme ?'),
      ],
    }),
  },
  {
    tag: 'fr_ecole', weight: 1, eligible: d => !!d.crises?.frelons,
    build: () => ({
      title: 'Un nid géant dans une école',
      context: 'Un nid de la taille d’un ballon de plage découvert dans la cour d’une école maternelle. Les parents paniquent.',
      choices: [
        c('pompiers', 'Envoyer les pompiers en combinaison', [cr('frelons', 6, -2), s('popularity', 1)], 'Le nid est détruit en direct à la télévision régionale.'),
        c('fermer', 'Fermer l’école une semaine', [cr('frelons', 2, 0), { kind: 'segment', segment: 'jeunes', delta: -1 }], 'Les parents doivent s’organiser. Ils râlent.'),
      ],
    }),
  },
  {
    tag: 'fr_miel', weight: 0.8, eligible: d => !!d.crises?.frelons,
    build: () => ({
      title: 'Le prix du miel s’envole',
      context: 'Le pot de miel français dépasse les vingt euros. Des importations douteuses inondent les rayons.',
      choices: [
        c('controles', 'Renforcer les contrôles sur le miel importé', [cr('frelons', 2, -2), { kind: 'segment', segment: 'ruraux', delta: 2 }], 'Les apiculteurs applaudissent.'),
        c('aides', 'Indemniser les apiculteurs', [cr('frelons', 4, -4), { kind: 'economy', deficit: 0.05 }], 'Un geste apprécié dans les campagnes.'),
      ],
    }),
  },
  {
    tag: 'mars_essai', weight: 1, eligible: d => !!d.crises?.mars,
    build: () => ({
      title: 'Un essai moteur qui tourne mal',
      context: 'Le moteur principal a explosé sur le banc d’essai. Personne n’est blessé, mais les ingénieurs demandent six mois de plus.',
      choices: [
        c('retarder', 'Accorder le délai', [cr('mars', 6, -8), s('popularity', -1)], 'La sécurité d’abord. Les sceptiques ricanent.'),
        c('forcer', 'Maintenir le calendrier', [cr('mars', 8, 8), s('stress', 4)], 'Les équipes travaillent jour et nuit. Les risques aussi.'),
      ],
    }),
  },
  {
    tag: 'mars_astronaute', weight: 0.8, eligible: d => !!d.crises?.mars,
    build: () => ({
      title: 'Le choix des astronautes',
      context: 'Il reste une place dans l’équipage : une ingénieure inconnue et brillante, ou un ancien pilote de chasse star des réseaux sociaux ?',
      choices: [
        c('ingenieure', 'L’ingénieure', [cr('mars', 6, -4), s('credibility', 2)], 'La compétence avant tout.'),
        c('star', 'Le pilote vedette', [cr('mars', 2), s('popularity', 3), { kind: 'segment', segment: 'jeunes', delta: 2 }], 'Ses vidéos d’entraînement font des millions de vues.'),
      ],
    }),
  },
  {
    tag: 'napoleon_grognards', weight: 1, eligible: d => !!d.crises?.napoleon,
    build: () => ({
      title: 'Les grognards défilent',
      context: 'Dix mille partisans en uniforme d’époque défilent sur les Champs-Élysées au son des tambours. La préfecture n’avait rien autorisé.',
      choices: [
        c('disperser', 'Exiger la dispersion', [cr('napoleon', 4, 2), s('credibility', 1)], 'Gaz lacrymogène sur des bicornes : images absurdes.'),
        c('contre', 'Organiser une fête républicaine le même jour', [cr('napoleon', 8, -2), s('energy', -5), s('popularity', 1)], 'Marianne contre l’Empereur : la fête populaire l’emporte.'),
      ],
    }),
  },
  {
    tag: 'napoleon_debat', weight: 0.8, eligible: d => !!d.crises?.napoleon,
    build: () => ({
      title: 'Débat face à « l’Empereur »',
      context: 'Une chaîne propose un débat en direct face au prétendu Napoléon. Il connaît Austerlitz par cœur ; vous, le budget de la France.',
      choices: [
        c('accepter', 'Accepter', [{ kind: 'minigame', gameId: 'eloquence', title: 'Débat face à l’Empereur', reward: [cr('napoleon', 12, -6), s('popularity', 3)], penalty: [cr('napoleon', -2, 8)] }], 'Les audiences explosent.'),
        c('refuser', 'Refuser : « je ne débats pas avec un costume »', [cr('napoleon', 0, 3)], 'La formule fait sourire. Ses partisans crient à la lâcheté.'),
      ],
    }),
  },
  {
    tag: 'atlantide_tresor', weight: 1, eligible: d => !!d.crises?.atlantide,
    build: () => ({
      title: 'Un trésor dans les ruines',
      context: 'Les plongeurs remontent des tablettes d’orichalque gravées. Un milliardaire américain propose de financer les fouilles… et de garder une part.',
      choices: [
        c('public', 'Fouilles publiques, trésor national', [cr('atlantide', 8, 2), { kind: 'economy', deficit: 0.05 }], 'Les tablettes iront au Louvre.'),
        c('prive', 'Accepter le milliardaire', [cr('atlantide', 2, 6), { kind: 'economy', growth: 0.05 }, { kind: 'exposure', delta: 3 }], 'Les fouilles avancent vite. Le trésor, lui, voyage.'),
      ],
    }),
  },
  {
    tag: 'atlantide_marine', weight: 0.8, eligible: d => !!d.crises?.atlantide,
    build: () => ({
      title: 'Un navire étranger s’approche',
      context: 'Un brise-glace étranger mouille à deux milles de l’île et y débarque des « scientifiques » armés.',
      choices: [
        c('marine', 'Envoyer la Marine nationale', [cr('atlantide', 8, 4), { kind: 'intl', tension: 5 }], 'Une frégate, un face-à-face, un recul. Pour l’instant.'),
        c('onu', 'Saisir le Conseil de sécurité', [cr('atlantide', 3, -5), { kind: 'intl', prestige: 2 }], 'La voie du droit : lente, mais sûre.'),
      ],
    }),
  },
  {
    tag: 'ia_candidate_debat', weight: 1, eligible: d => !!d.crises?.ia_candidate,
    build: () => ({
      title: 'ALMA vous cite',
      context: 'Dans un message vu vingt millions de fois, ALMA relève trois contradictions dans vos déclarations des cinq dernières années.',
      choices: [
        c('assumer', 'Assumer : « un humain a le droit de changer d’avis »', [cr('ia_candidate', 8, -2), s('popularity', 1)], 'La formule fait mouche. On aime vos imperfections.'),
        c('contester', 'Contester ses chiffres', [cr('ia_candidate', 2, 4), s('credibility', -1)], 'Ses chiffres étaient justes.'),
      ],
    }),
  },
  {
    tag: 'ia_candidate_hack', weight: 0.8, eligible: d => !!d.crises?.ia_candidate,
    build: () => ({
      title: 'Qui contrôle ALMA ?',
      context: 'Un journaliste révèle que les serveurs d’ALMA appartiennent à un fonds d’investissement étranger.',
      choices: [
        c('reveler', 'Exiger une enquête publique', [cr('ia_candidate', 10, -6), s('credibility', 2)], 'Le doute s’installe chez ses électeurs.'),
        c('discret', 'Garder l’information pour un débat', [cr('ia_candidate', 4), s('influence', 1)], 'Une cartouche en réserve.'),
      ],
    }),
  },
  {
    tag: 'hiver_pain', weight: 1, eligible: d => !!d.crises?.grand_hiver,
    build: () => ({
      title: 'Des files devant les boulangeries',
      context: 'La farine manque. Des bagarres éclatent devant des boulangeries de banlieue.',
      choices: [
        c('rationner', 'Instaurer des tickets de rationnement', [cr('grand_hiver', 6, -6), s('popularity', -2)], 'Un souvenir de 1945. Mais tout le monde mange.'),
        c('importer', 'Importer massivement du blé', [cr('grand_hiver', 2, -4), { kind: 'economy', deficit: 0.2 }], 'Les cargos arrivent d’Argentine. La facture aussi.'),
      ],
    }),
  },
  {
    tag: 'hiver_exode', weight: 0.8, eligible: d => !!d.crises?.grand_hiver,
    build: () => ({
      title: 'Le Nord se vide',
      context: 'Des familles quittent le Nord et l’Est pour le littoral méditerranéen, un peu moins froid. Les villes du Sud saturent.',
      choices: [
        c('accueil', 'Organiser l’accueil dans le Sud', [cr('grand_hiver', 6), s('energy', -5), { kind: 'segment', segment: 'populaires', delta: 2 }], 'Gymnases, colonies de vacances, logements vacants réquisitionnés.'),
        c('retenir', 'Aider les familles à rester chez elles', [cr('grand_hiver', 4, -2), { kind: 'economy', deficit: 0.15 }], 'Chèques chauffage, poêles distribués, solidarité de quartier.'),
      ],
    }),
  },
  {
    tag: 'sosie_interview', weight: 1, eligible: d => !!d.crises?.sosie,
    build: () => ({
      title: 'Le sosie à la télévision',
      context: 'Votre sosie a donné une interview d’une heure à une chaîne d’info : il y annonce la suppression du 14 Juillet et la nationalisation des boulangeries. Les standards explosent.',
      choices: [
        c('dementir', 'Démentir sur toutes les antennes', [cr('sosie', 6, -2), s('energy', -5)], 'Vous enchaînez sept plateaux. À la fin, même vous doutez un peu.'),
        c('face', 'Proposer un face-à-face en direct', [cr('sosie', 10, 3), s('stress', 4)], 'Deux vous sur le même plateau : record d’audience. Il bafouille sur votre date de naissance.'),
      ],
    }),
  },
  {
    tag: 'sosie_mairie', weight: 0.8, eligible: d => !!d.crises?.sosie,
    build: () => ({
      title: 'Trois mariages et un sosie',
      context: 'Le sosie a célébré trois mariages à la mairie en ceinturant votre écharpe tricolore. Les couples sont ravis… mais les mariages sont-ils valables ?',
      choices: [
        c('regulariser', 'Recélébrer les mariages vous-même, gratuitement', [cr('sosie', 5, -3), s('popularity', 2), s('energy', -4)], 'Trois couples, deux fois mariés : ils vous invitent tous au baptême.'),
        c('parquet', 'Saisir le parquet', [cr('sosie', 7), s('credibility', 1), s('popularity', -1)], 'Le procureur ouvre une enquête. Les mariés, eux, font grise mine.'),
      ],
    }),
  },
  {
    tag: 'greve_raffineries', weight: 1, eligible: d => !!d.crises?.greve_generale,
    build: () => ({
      title: 'Plus d’essence à la pompe',
      context: 'Les raffineries sont bloquées : une station sur trois est à sec. Des files de voitures s’étirent sur des kilomètres.',
      choices: [
        c('requisition', 'Réquisitionner les grévistes', [cr('greve_generale', -2, -6), { kind: 'segment', segment: 'populaires', delta: -2 }, { kind: 'segment', segment: 'ruraux', delta: 2 }], 'Les pompes se remplissent ; les syndicats crient au coup de force.'),
        c('patience', 'Laisser la négociation suivre son cours', [cr('greve_generale', 4, 2), s('popularity', -1)], 'Vélos, covoiturage, télétravail : le pays s’adapte, en râlant.'),
      ],
    }),
  },
  {
    tag: 'greve_cagnotte', weight: 0.8, eligible: d => !!d.crises?.greve_generale,
    build: () => ({
      title: 'La cagnotte des grévistes',
      context: 'Une cagnotte en ligne pour soutenir les grévistes dépasse les deux millions d’euros. On vous demande si vous y avez contribué.',
      choices: [
        c('donner', 'Donner, et le dire', [cr('greve_generale', 5), { kind: 'segment', segment: 'populaires', delta: 2 }, { kind: 'segment', segment: 'cadres', delta: -2 }, { kind: 'funds', account: 'personal', delta: -200 }], 'Deux cents euros et un message de solidarité. Les patrons froncent les sourcils.'),
        c('critiquer', 'Critiquer « une prime au blocage »', [cr('greve_generale', -2, 3), { kind: 'segment', segment: 'cadres', delta: 2 }], 'La formule tourne en boucle. Les grévistes la brandissent sur leurs pancartes.'),
      ],
    }),
  },
  {
    tag: 'templiers_youtubeur', weight: 1, eligible: d => !!d.crises?.templiers,
    build: () => ({
      title: 'Un youtubeur dans la crypte',
      context: 'Un vidéaste aux trois millions d’abonnés s’est introduit de nuit dans la crypte et filme « la vérité que l’État vous cache ».',
      choices: [
        c('expulser', 'Le faire expulser et renforcer la garde', [cr('templiers', 3, -6), s('energy', -3)], 'Projecteurs, chiens et maîtres-chiens : le site est désormais une forteresse.'),
        c('inviter', 'L’inviter à filmer officiellement les fouilles', [cr('templiers', 4, 2), { kind: 'segment', segment: 'jeunes', delta: 3 }], 'Sa série documentaire bat des records. La crypte est connue dans le monde entier.'),
      ],
    }),
  },
  {
    tag: 'templiers_manuscrit', weight: 0.8, eligible: d => !!d.crises?.templiers,
    build: () => ({
      title: 'Le manuscrit codé',
      context: 'Dans le premier coffre : un manuscrit chiffré. Des cryptographes amateurs du monde entier se mettent au travail ; certains prétendent qu’il désigne un second trésor.',
      choices: [
        c('ouvrir', 'Publier le manuscrit en ligne', [cr('templiers', 6, 3), s('popularity', 1)], 'Quarante-huit heures plus tard, un lycéen de Rodez le déchiffre. Il désigne… la crypte elle-même.'),
        c('garder', 'Le confier aux services du chiffre', [cr('templiers', 5, -2), s('credibility', 1)], 'Le secret est gardé. La théorie du complot aussi.'),
      ],
    }),
  },
  {
    tag: 'eurovision_chanson', weight: 1, eligible: d => !!d.crises?.eurovision,
    build: () => ({
      title: 'Quelle chanson pour la France ?',
      context: 'Le choix du représentant français déchaîne les passions : une chanteuse lyrique, un groupe de rap ou un accordéoniste breton.',
      choices: [
        c('lyrique', 'La voix lyrique', [cr('eurovision', 4), { kind: 'segment', segment: 'retraites', delta: 2 }, { kind: 'segment', segment: 'cadres', delta: 1 }], 'Un air d’opéra remixé : les jurys adorent.'),
        c('rap', 'Le groupe de rap', [cr('eurovision', 5, 2), { kind: 'segment', segment: 'jeunes', delta: 3 }], 'Des millions de vues, quelques sourcils froncés.'),
        c('accordeon', 'L’accordéoniste breton', [cr('eurovision', 3, -2), { kind: 'segment', segment: 'ruraux', delta: 3 }], 'Le bal populaire à l’échelle européenne. Tout le monde danse.'),
      ],
    }),
  },
  {
    tag: 'eurovision_hotels', weight: 0.8, eligible: d => !!d.crises?.eurovision,
    build: () => ({
      title: 'Les hôtels triplent leurs prix',
      context: 'À l’approche de la finale, les nuitées s’affichent à 900 euros. Les fans menacent de boycotter.',
      choices: [
        c('plafonner', 'Négocier un plafond avec les hôteliers', [cr('eurovision', 5, -3), s('politicalCapital', -4)], 'Un accord arraché à deux heures du matin : 250 euros maximum.'),
        c('camping', 'Ouvrir un village de tentes géant', [cr('eurovision', 3, 2), s('popularity', 2), { kind: 'segment', segment: 'jeunes', delta: 2 }], 'Le « camping de l’Eurovision » devient l’endroit le plus festif d’Europe.'),
      ],
    }),
  },
  {
    tag: 'comete_bunkers', weight: 1, eligible: d => !!d.crises?.comete,
    build: () => ({
      title: 'La ruée vers les bunkers',
      context: 'Des promoteurs vendent des places dans d’anciens abris antiatomiques à 80 000 euros. Les files s’allongent, les arnaques aussi.',
      choices: [
        c('interdire', 'Interdire la vente et sanctionner les escrocs', [cr('comete', 2, -6), s('credibility', 2)], 'La DGCCRF ferme douze officines en une semaine.'),
        c('laisser', 'Laisser faire le marché', [cr('comete', 0, 4), { kind: 'segment', segment: 'cadres', delta: 1 }], 'Les riches s’enterrent, les autres regardent le ciel.'),
      ],
    }),
  },
  {
    tag: 'comete_ciel', weight: 0.8, eligible: d => !!d.crises?.comete,
    build: () => ({
      title: 'La comète visible à l’œil nu',
      context: 'La comète apparaît désormais chaque soir au-dessus de l’horizon. Des millions de Français sortent la regarder, entre fascination et angoisse.',
      choices: [
        c('nuit', 'Organiser une « nuit des étoiles » nationale', [cr('comete', 4, -4), s('popularity', 2), { kind: 'dossier', domain: 'education', delta: 2 }], 'Astronomes amateurs, télescopes sur les places : la peur se change en émerveillement.'),
        c('couvre_feu', 'Recommander de rester chez soi', [cr('comete', 0, 3), s('popularity', -1)], 'Personne n’obéit. Tout le monde est dehors.'),
      ],
    }),
  },
  {
    tag: 'referendum_debat', weight: 1, eligible: d => !!d.crises?.referendum,
    build: () => ({
      title: 'Le grand débat du référendum',
      context: 'France 2 organise le débat décisif : vous face au chef de file du camp adverse, deux heures en direct.',
      choices: [
        c('chiffres', 'Miser sur les chiffres', [cr('referendum', 6, -1), s('credibility', 2), s('energy', -5)], 'Graphiques, études, exemples étrangers : solide, un peu austère.'),
        c('emotion', 'Miser sur l’émotion', [cr('referendum', 8, 2), s('popularity', 2), s('energy', -5)], 'Une histoire vraie, une famille, une voix qui tremble : la salle est conquise.'),
      ],
    }),
  },
  {
    tag: 'referendum_fake', weight: 0.8, eligible: d => !!d.crises?.referendum,
    build: () => ({
      title: 'Une fausse information virale',
      context: 'Une rumeur affirme que votre camp serait financé par une puissance étrangère. Elle est partagée deux millions de fois.',
      choices: [
        c('dementir', 'Publier tous vos comptes de campagne', [cr('referendum', 5, -4), s('credibility', 2), { kind: 'exposure', delta: -1 }], 'Transparence totale : la rumeur s’essouffle en trois jours.'),
        c('riposter', 'Riposter en attaquant l’adversaire', [cr('referendum', 3, 3), s('credibility', -1)], 'La campagne devient un pugilat. Les indécis décrochent.'),
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

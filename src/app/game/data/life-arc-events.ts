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
  {
    tag: 'seisme_gate', weight: 0.5, minRank: 'conseiller_municipal', eligible: d => !d.crises?.seisme && !d.player.flags['seismeDone'] && d.week > 22,
    build: () => ({
      title: 'La terre a tremblé',
      context: 'À 4 h 17, un séisme de magnitude 6,4 frappe l’arrière-pays niçois. Des villages perchés sont coupés du monde ; des milliers de personnes dorment dehors.',
      choices: [
        c('partir', 'Partir sur place dans la nuit', [cr('seisme', 6, 2, true), { kind: 'flag', key: 'seismeDone', value: true }, s('energy', -8), s('popularity', 2)], 'À l’aube, vous êtes dans les décombres avec les pompiers. Les images font le tour du pays.'),
        c('cellule', 'Piloter la cellule de crise depuis Paris', [cr('seisme', 4, 3, true), { kind: 'flag', key: 'seismeDone', value: true }, s('credibility', 2)], 'Moyens aériens, hôpitaux de campagne : l’organisation est impeccable, mais on vous reproche votre absence.'),
      ],
    }),
  },
  {
    tag: 'loto_gate', weight: 0.4, minRank: 'militant', eligible: d => !d.crises?.loto && !d.player.flags['lotoDone'] && d.week > 10,
    build: () => ({
      title: 'Les six bons numéros',
      context: 'Un vendredi soir, devant la télévision, vous vérifiez votre grille : 28 millions d’euros. Vos mains tremblent. Personne d’autre ne le sait… pour l’instant.',
      choices: [
        c('annoncer', 'L’annoncer publiquement, tout de suite', [cr('loto', 6, 3, true), { kind: 'flag', key: 'lotoDone', value: true }, s('popularity', 1), { kind: 'funds', account: 'personal', delta: 5000 }], '« Cet argent ne changera pas qui je suis. » Les caméras campent devant chez vous.'),
        c('secret', 'Garder le secret', [cr('loto', 2, 6, true), { kind: 'flag', key: 'lotoDone', value: true }, { kind: 'funds', account: 'personal', delta: 20000 }, s('stress', 4)], 'Un premier virement discret. Mais un secret de 28 millions ne tient jamais longtemps.'),
      ],
    }),
  },
  {
    tag: 'tempete_gate', weight: 0.5, minRank: 'conseiller_municipal', eligible: d => !d.crises?.tempete_solaire && !d.player.flags['tempeteDone'] && d.week > 26,
    build: () => ({
      title: 'Une éruption solaire géante',
      context: 'L’Observatoire de Meudon donne l’alerte : une tempête solaire d’une intensité inédite frappera la Terre dans 36 heures. Satellites, GPS et réseaux électriques sont menacés.',
      choices: [
        c('plan', 'Déclencher le plan d’urgence national', [cr('tempete_solaire', 7, 2, true), { kind: 'flag', key: 'tempeteDone', value: true }, s('credibility', 2)], 'Groupes électrogènes, cartes papier distribuées, hôpitaux en alerte.'),
        c('attendre', 'Attendre de voir l’ampleur', [cr('tempete_solaire', 1, 6, true), { kind: 'flag', key: 'tempeteDone', value: true }], 'Le lendemain, plus aucun GPS ne fonctionne.'),
      ],
    }),
  },
  {
    tag: 'expo_gate', weight: 0.5, minRank: 'conseiller_municipal', eligible: d => !d.crises?.expo_universelle && !d.player.flags['expoDone'] && d.week > 18,
    build: () => ({
      title: 'Paris, ville de l’Exposition universelle',
      context: 'Le Bureau international des expositions désigne Paris. Douze mois pour bâtir 180 pavillons. On vous propose de piloter le comité d’organisation.',
      choices: [
        c('piloter', 'Prendre la tête du comité', [cr('expo_universelle', 6, 3, true), { kind: 'flag', key: 'expoDone', value: true }, s('influence', 3)], 'Bureau au Champ-de-Mars, réunion chaque matin à 7 h.'),
        c('soutenir', 'Soutenir de loin', [cr('expo_universelle', 3, 2, true), { kind: 'flag', key: 'expoDone', value: true }], 'Vous suivrez le chantier depuis votre bureau.'),
      ],
    }),
  },
  {
    tag: 'penurie_gate', weight: 0.5, minRank: 'conseiller_municipal', eligible: d => !d.crises?.penurie_medicaments && !d.player.flags['penurieDone'] && d.week > 16,
    build: () => ({
      title: 'Rupture dans les pharmacies',
      context: 'Les pharmaciens tirent la sonnette d’alarme : 400 médicaments en rupture, dont des antibiotiques pour enfants. Les usines sont en Asie, les stocks à zéro.',
      choices: [
        c('relocaliser', 'Lancer un plan de relocalisation', [cr('penurie_medicaments', 6, 2, true), { kind: 'flag', key: 'penurieDone', value: true }, { kind: 'economy', deficit: 0.05 }], 'Trois usines rouvriront. Il faudra tenir d’ici là.'),
        c('importer', 'Acheter en urgence à l’étranger', [cr('penurie_medicaments', 3, 4, true), { kind: 'flag', key: 'penurieDone', value: true }, s('popularity', 1)], 'Des cargaisons arrivent… à prix d’or, et pas pour tout.'),
      ],
    }),
  },
  {
    tag: 'train_gate', weight: 0.5, minRank: 'conseiller_municipal', eligible: d => !d.crises?.train_futur && !d.player.flags['trainDone'] && d.week > 20,
    build: () => ({
      title: 'Paris–Marseille en 1 h 10',
      context: 'Un consortium franco-européen présente un train à sustentation magnétique. Il cherche un parrain politique pour porter le projet.',
      choices: [
        c('porter', 'Porter le projet', [cr('train_futur', 6, 3, true), { kind: 'flag', key: 'trainDone', value: true }, s('influence', 2), { kind: 'segment', segment: 'cadres', delta: 2 }], 'Vous voilà « ministre officieux du futur ».'),
        c('prudence', 'Exiger d’abord une étude indépendante', [cr('train_futur', 3, 1, true), { kind: 'flag', key: 'trainDone', value: true }, s('credibility', 2)], 'Le projet avance, plus lentement, plus sûrement.'),
      ],
    }),
  },
  {
    tag: 'pandas_gate', weight: 0.5, minRank: 'conseiller_municipal', eligible: d => !d.crises?.pandas && !d.player.flags['pandasDone'] && d.week > 16,
    build: () => ({
      title: 'Deux pandas pour la France',
      context: 'L’ambassadeur de Chine annonce un cadeau exceptionnel : deux pandas géants. Il souhaite que vous parrainiez leur arrivée.',
      choices: [
        c('parrainer', 'Parrainer leur arrivée en personne', [cr('pandas', 6, 3, true), { kind: 'flag', key: 'pandasDone', value: true }, s('popularity', 2), { kind: 'intl', prestige: 1 }], 'Votre photo avec les pandas fait le tour de la planète.'),
        c('prudent', 'Accepter, en parlant aussi des droits humains', [cr('pandas', 2, 5, true), { kind: 'flag', key: 'pandasDone', value: true }, s('credibility', 3)], 'Pékin fronce les sourcils. Les pandas arrivent quand même.'),
      ],
    }),
  },
  {
    tag: 'coupe_gate', weight: 0.5, minRank: 'conseiller_municipal', eligible: d => !d.crises?.coupe_monde && !d.player.flags['coupeDone'] && d.week > 24,
    build: () => ({
      title: 'La Coupe du monde en France',
      context: 'La FIFA attribue la Coupe du monde à la France. Le comité d’organisation cherche un visage politique pour porter l’événement.',
      choices: [
        c('porter', 'Prendre la tête du comité', [cr('coupe_monde', 6, 3, true), { kind: 'flag', key: 'coupeDone', value: true }, s('popularity', 3), { kind: 'segment', segment: 'jeunes', delta: 2 }], 'Écharpe bleue, sourire aux lèvres : vous voilà « ministre du ballon rond ».'),
        c('sobre', 'Exiger un Mondial sobre et sans gaspillage', [cr('coupe_monde', 3, 1, true), { kind: 'flag', key: 'coupeDone', value: true }, s('credibility', 2)], 'Pas de stade neuf, des fan-zones gratuites : on applaudit le sérieux.'),
      ],
    }),
  },
  {
    tag: 'jubile_gate', weight: 1.2, eligible: d => !!d.kingdom && !d.crises?.jubile && !d.player.flags['jubileDone'] && d.week - d.kingdom.since >= 6,
    build: () => ({
      title: 'Un jubilé pour le règne ?',
      context: 'Le grand chambellan propose de célébrer votre règne par un jubilé national : défilés, bals, feux d’artifice. Le front républicain prépare déjà sa riposte.',
      choices: [
        c('grandiose', 'Un jubilé grandiose', [cr('jubile', 6, 5, true), { kind: 'flag', key: 'jubileDone', value: true }, { kind: 'kingdom', prestige: 3 }], 'Les ateliers de Versailles tournent à plein régime.'),
        c('populaire', 'Un jubilé populaire, sans faste', [cr('jubile', 4, 1, true), { kind: 'flag', key: 'jubileDone', value: true }, { kind: 'kingdom', opposition: -2 }], 'Bals de quartier et pique-niques géants : la fête sera simple.'),
      ],
    }),
  },
  {
    tag: 'diamants_gate', weight: 0.4, minRank: 'depute', eligible: d => !d.crises?.diamants && !d.player.flags['diamantsDone'] && d.week > 24,
    build: () => ({
      title: 'Un écrin de diamants',
      context: 'Un hebdomadaire satirique s’apprête à publier une enquête : lors d’un voyage officiel, le président du Zanbar vous aurait offert un écrin de diamants. Le journaliste vous demande une réaction.',
      choices: [
        c('transparence', 'Tout expliquer et ouvrir vos archives', [cr('diamants', 6, 3, true), { kind: 'flag', key: 'diamantsDone', value: true }, s('credibility', 2)], 'Vous fournissez dates, notes, témoins. L’enquête démarre sur de bonnes bases.'),
        c('dementi', 'Démentir sèchement', [cr('diamants', 2, 6, true), { kind: 'flag', key: 'diamantsDone', value: true }, s('stress', 4)], '« Calomnies ! » Le démenti fait plus de bruit que l’article.'),
      ],
    }),
  },
  {
    tag: 'ours_gate', weight: 0.5, minRank: 'conseiller_municipal', eligible: d => !d.crises?.ours && !d.player.flags['oursDone'] && d.week > 14,
    build: () => ({
      title: 'Des ours dans les Pyrénées',
      context: 'Le ministère veut réintroduire dix ours slovènes dans les Pyrénées. Bergers et écologistes vous demandent de prendre position.',
      choices: [
        c('porter', 'Porter le plan, avec des aides aux bergers', [cr('ours', 6, 3, true), { kind: 'flag', key: 'oursDone', value: true }, { kind: 'dossier', domain: 'ecologie', delta: 3 }], 'Les ours arrivent en hélicoptère. Les bergers attendent de voir.'),
        c('bergers', 'Défendre d’abord les bergers', [cr('ours', 3, 1, true), { kind: 'flag', key: 'oursDone', value: true }, { kind: 'segment', segment: 'ruraux', delta: 3 }], 'Moins d’ours, plus de patous : le compromis passe, de justesse.'),
      ],
    }),
  },
  {
    tag: 'essence_gate', weight: 0.5, minRank: 'conseiller_municipal', eligible: d => !d.crises?.penurie_essence && !d.player.flags['essenceDone'] && d.week > 12,
    build: () => ({
      title: 'Les stations à sec',
      context: 'Les raffineries sont en grève, les dépôts bloqués. En une semaine, un tiers des stations n’ont plus une goutte. On vous demande de prendre les choses en main.',
      choices: [
        c('reagir', 'Prendre la tête de la cellule de crise', [cr('penurie_essence', 6, 3, true), { kind: 'flag', key: 'essenceDone', value: true }, s('credibility', 2)], 'Tableaux de bord, appels aux pétroliers : vous voilà « ministre de la pompe ».'),
        c('dialogue', 'Recevoir d’abord les grévistes', [cr('penurie_essence', 3, 1, true), { kind: 'flag', key: 'essenceDone', value: true }, { kind: 'segment', segment: 'populaires', delta: 2 }], 'Le dialogue s’ouvre. Les files d’attente, elles, s’allongent.'),
      ],
    }),
  },
  {
    tag: 'culture_gate', weight: 0.45, minRank: 'conseiller_municipal', eligible: d => !d.crises?.capitale_culture && !d.player.flags['cultureDone'] && d.week > 18,
    build: () => ({
      title: 'Capitale européenne de la culture',
      context: 'Votre ville est retenue parmi les finalistes pour devenir capitale européenne de la culture. Le jury attend un dernier oral.',
      choices: [
        c('oral', 'Défendre la candidature en personne', [cr('capitale_culture', 6, 3, true), { kind: 'flag', key: 'cultureDone', value: true }, s('popularity', 2)], 'Un discours vibrant, des artistes en larmes : le titre est à vous.'),
        c('equipe', 'Laisser l’équipe culturelle porter le projet', [cr('capitale_culture', 3, 1, true), { kind: 'flag', key: 'cultureDone', value: true }], 'Le jury apprécie le collectif. Vous l’emportez, discrètement.'),
      ],
    }),
  },
  {
    tag: 'canicule_gate', weight: 0.5, minRank: 'conseiller_municipal', eligible: d => !d.crises?.canicule && !d.player.flags['caniculeDone'] && d.week > 10,
    build: () => ({
      title: 'Alerte rouge canicule',
      context: 'Météo-France annonce 46 °C dans le Sud et des nuits tropicales pendant trois semaines. Les préfets attendent des consignes.',
      choices: [
        c('plan', 'Déclencher le plan canicule au maximum', [cr('canicule', 7, 3, true), { kind: 'flag', key: 'caniculeDone', value: true }, s('credibility', 2)], 'Salles fraîches, horaires aménagés, bénévoles mobilisés : la machine se met en route.'),
        c('attendre', 'Attendre de voir si les prévisions se confirment', [cr('canicule', 2, 6, true), { kind: 'flag', key: 'caniculeDone', value: true }], 'Les prévisions se confirment. Trois jours ont été perdus.'),
      ],
    }),
  },
  {
    tag: 'hacker_gate', weight: 0.4, minRank: 'depute', eligible: d => !d.crises?.hacker && !d.player.flags['hackerDone'] && d.week > 24,
    build: () => ({
      title: '« Robespierre » frappe',
      context: 'Un pirate publie les messages privés de trois ministres. Dans sa revendication, il cite votre nom parmi « les prochains ».',
      choices: [
        c('transparence', 'Publier vous-même vos agendas et vos frais', [cr('hacker', 6, 2, true), { kind: 'flag', key: 'hackerDone', value: true }, s('credibility', 3)], '« Je n’ai rien à cacher. » Le pirate perd une partie de son pouvoir sur vous.'),
        c('plainte', 'Porter plainte et ne rien dire de plus', [cr('hacker', 3, 5, true), { kind: 'flag', key: 'hackerDone', value: true }], 'Les enquêteurs prennent l’affaire. Le pirate, lui, prépare la suite.'),
      ],
    }),
  },
  {
    tag: 'barons_gate', weight: 0.4, minRank: 'depute', eligible: d => !d.crises?.barons && !d.player.flags['baronsDone'] && d.week > 30,
    build: () => ({
      title: 'Les barons menacent',
      context: 'Huit maires de grandes villes et cinq présidents de département vous écrivent : « Écoutez les territoires, ou nous partirons. »',
      choices: [
        c('recevoir', 'Les recevoir tous, longuement', [cr('barons', 6, 3, true), { kind: 'flag', key: 'baronsDone', value: true }, s('energy', -4)], 'Une journée entière de doléances. Rien n’est réglé, mais on se parle.'),
        c('ignorer', 'Rappeler que le parti n’est pas une fédération de féodaux', [cr('barons', 2, 7, true), { kind: 'flag', key: 'baronsDone', value: true }, { kind: 'dread', delta: 5 }], 'La lettre suivante est publique, et beaucoup plus dure.'),
      ],
    }),
  },
  {
    tag: 'debat_gate', weight: 0.4, minRank: 'depute', eligible: d => !d.crises?.grand_debat && !d.player.flags['debatDone'] && d.week > 20,
    build: () => ({
      title: 'Lancer un grand débat national ?',
      context: 'Après des mois de colère, on vous propose d’organiser un grand débat : des réunions dans toutes les mairies, et l’engagement d’en tirer des lois.',
      choices: [
        c('lancer', 'Lancer le grand débat', [cr('grand_debat', 6, 3, true), { kind: 'flag', key: 'debatDone', value: true }, s('popularity', 2)], 'Les premières réunions affichent complet.'),
        c('cadrer', 'Le lancer, mais avec des thèmes cadrés', [cr('grand_debat', 4, 5, true), { kind: 'flag', key: 'debatDone', value: true }], '« Débat sous contrôle », raillent les opposants.'),
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
  {
    tag: 'seisme_replique', weight: 1, eligible: d => !!d.crises?.seisme,
    build: () => ({
      title: 'Une forte réplique',
      context: 'Une réplique de magnitude 5,1 fait s’effondrer une école déjà fissurée. Personne à l’intérieur, mais la peur revient.',
      choices: [
        c('evacuer', 'Évacuer tous les bâtiments douteux', [cr('seisme', 2, -5), s('popularity', -1), s('energy', -4)], 'Des milliers de personnes de plus sous la tente, mais aucune victime.'),
        c('expertiser', 'Lancer une expertise rapide bâtiment par bâtiment', [cr('seisme', 5, 2), s('credibility', 1)], 'Deux cents ingénieurs en renfort. Les verdicts tombent, un par un.'),
      ],
    }),
  },
  {
    tag: 'seisme_assurances', weight: 0.8, eligible: d => !!d.crises?.seisme,
    build: () => ({
      title: 'Les assureurs traînent',
      context: 'Trois mois après, la moitié des sinistrés n’ont reçu aucune indemnisation. Les assureurs invoquent « des clauses ».',
      choices: [
        c('convoquer', 'Convoquer les assureurs, caméras comprises', [cr('seisme', 6, -4), { kind: 'segment', segment: 'populaires', delta: 2 }, { kind: 'segment', segment: 'cadres', delta: -1 }], 'Ils promettent de payer sous trente jours. Vous comptez les jours.'),
        c('fonds', 'Créer un fonds public d’avance', [cr('seisme', 8, -2), { kind: 'economy', deficit: 0.08 }], 'L’État avance l’argent et se retournera contre les assureurs. Les sinistrés respirent.'),
      ],
    }),
  },
  {
    tag: 'loto_famille', weight: 1, eligible: d => !!d.crises?.loto,
    build: () => ({
      title: 'Toute la famille appelle',
      context: 'Un cousin éloigné veut ouvrir un restaurant, une tante a « toujours cru en vous », un ancien camarade de lycée a un projet de start-up.',
      choices: [
        c('aider', 'Aider les proches qui en ont vraiment besoin', [cr('loto', 4, -2), s('stress', -2), { kind: 'funds', account: 'personal', delta: -2000 }], 'Une maison de retraite payée pour une grand-tante, des études pour deux neveux.'),
        c('non', 'Dire non à tout le monde', [cr('loto', 0, 3), s('stress', 3)], 'Les repas de famille deviennent glacials.'),
      ],
    }),
  },
  {
    tag: 'loto_presse', weight: 0.8, eligible: d => !!d.crises?.loto,
    build: () => ({
      title: '« L’élu·e qui valait 28 millions »',
      context: 'Un magazine people publie votre gain en couverture, avec une photo de votre maison au téléobjectif.',
      choices: [
        c('fondation', 'Annoncer la création d’une fondation', [cr('loto', 10, -4), s('popularity', 2)], 'Éducation, santé, patrimoine : la fondation portera votre nom… et vos engagements.'),
        c('plainte', 'Porter plainte pour atteinte à la vie privée', [cr('loto', 0, 2), s('credibility', 1)], 'Vous gagnerez le procès. Pas la bataille de l’image.'),
      ],
    }),
  },
  {
    tag: 'tempete_banques', weight: 1, eligible: d => !!d.crises?.tempete_solaire,
    build: () => ({
      title: 'Plus de paiement par carte',
      context: 'Les terminaux bancaires sont muets depuis trois jours. Les distributeurs sont pris d’assaut ; les commerçants refusent les clients.',
      choices: [
        c('cheques', 'Imposer l’acceptation des chèques et des espèces', [cr('tempete_solaire', 5, -4), { kind: 'segment', segment: 'retraites', delta: 2 }], 'Les carnets de chèques ressortent des tiroirs.'),
        c('banques', 'Exiger des banques un plan de secours', [cr('tempete_solaire', 3, -2), s('credibility', 1)], 'Les banques promettent des distributeurs mobiles.'),
      ],
    }),
  },
  {
    tag: 'tempete_aurores', weight: 0.8, eligible: d => !!d.crises?.tempete_solaire,
    build: () => ({
      title: 'Des aurores boréales sur Marseille',
      context: 'Effet secondaire de la tempête : des aurores boréales illuminent le ciel jusqu’en Provence. Des millions de Français sortent les admirer.',
      choices: [
        c('nuit', 'Organiser une « nuit des aurores »', [cr('tempete_solaire', 2, -5), s('popularity', 2)], 'La peur laisse place à l’émerveillement.'),
        c('prudence', 'Rappeler les consignes de sécurité', [cr('tempete_solaire', 3), s('credibility', 1)], 'Utile, un peu rabat-joie.'),
      ],
    }),
  },
  {
    tag: 'expo_pavillon', weight: 1, eligible: d => !!d.crises?.expo_universelle,
    build: () => ({
      title: 'Le pavillon de la France',
      context: 'Deux projets s’affrontent pour le pavillon français : une tour de verre spectaculaire ou un jardin bas carbone.',
      choices: [
        c('tour', 'La tour de verre', [cr('expo_universelle', 6, 4), { kind: 'intl', prestige: 2 }], 'Un futur symbole… si elle est finie à temps.'),
        c('jardin', 'Le jardin bas carbone', [cr('expo_universelle', 5, -2), { kind: 'dossier', domain: 'ecologie', delta: 3 }], 'Moins spectaculaire, plus sûr, salué par les jeunes.'),
      ],
    }),
  },
  {
    tag: 'expo_greve', weight: 0.8, eligible: d => !!d.crises?.expo_universelle,
    build: () => ({
      title: 'Grève sur les chantiers de l’Expo',
      context: 'Les ouvriers des pavillons cessent le travail : cadences infernales, sous-traitance en cascade.',
      choices: [
        c('negocier', 'Négocier des primes et des contrôles', [cr('expo_universelle', 4, -4), { kind: 'segment', segment: 'populaires', delta: 2 }, { kind: 'economy', deficit: 0.05 }], 'Le travail reprend, dans de meilleures conditions.'),
        c('tenir', 'Tenir bon sur les délais', [cr('expo_universelle', 2, 5), { kind: 'segment', segment: 'cadres', delta: 1 }], 'Le chantier prend trois semaines de retard.'),
      ],
    }),
  },
  {
    tag: 'penurie_insuline', weight: 1, eligible: d => !!d.crises?.penurie_medicaments,
    build: () => ({
      title: 'Les diabétiques inquiets',
      context: 'L’insuline manque dans trois régions. Des associations de patients manifestent devant le ministère.',
      choices: [
        c('stocks', 'Débloquer les stocks militaires', [cr('penurie_medicaments', 6, -5), { kind: 'segment', segment: 'retraites', delta: 2 }], 'Les camions de l’armée livrent les pharmacies dans la nuit.'),
        c('rationner', 'Organiser un rationnement par ordonnance', [cr('penurie_medicaments', 3, -2), s('popularity', -1)], 'Équitable, mais angoissant pour les patients.'),
      ],
    }),
  },
  {
    tag: 'penurie_generiques', weight: 0.8, eligible: d => !!d.crises?.penurie_medicaments,
    build: () => ({
      title: 'Un laboratoire veut augmenter ses prix',
      context: 'Un grand laboratoire propose de rouvrir une usine en France… si l’État accepte de payer ses médicaments 40 % plus cher.',
      choices: [
        c('accepter', 'Accepter, sous conditions', [cr('penurie_medicaments', 8), { kind: 'economy', deficit: 0.05 }], 'L’usine de Normandie redémarre en deux mois.'),
        c('public', 'Créer un pôle public de production', [cr('penurie_medicaments', 5, 2), { kind: 'segment', segment: 'populaires', delta: 2 }, { kind: 'segment', segment: 'cadres', delta: -1 }], 'Ambitieux, mais il faudra du temps.'),
      ],
    }),
  },
  {
    tag: 'train_zad', weight: 1, eligible: d => !!d.crises?.train_futur,
    build: () => ({
      title: 'Une ZAD sur le tracé',
      context: 'Des opposants occupent une forêt sur le tracé du train magnétique. Ils dénoncent « un TGV pour les riches ».',
      choices: [
        c('dialoguer', 'Ouvrir une concertation et modifier le tracé', [cr('train_futur', 2, -6), { kind: 'segment', segment: 'jeunes', delta: 2 }], 'Le tracé contourne la forêt. Trois mois de perdus, une crise évitée.'),
        c('evacuer', 'Faire évacuer le site', [cr('train_futur', 5, 4), { kind: 'segment', segment: 'jeunes', delta: -2 }], 'Les images de l’évacuation tournent en boucle.'),
      ],
    }),
  },
  {
    tag: 'train_essai', weight: 0.8, eligible: d => !!d.crises?.train_futur,
    build: () => ({
      title: 'Le premier essai à grande vitesse',
      context: 'Le prototype doit atteindre 600 km/h devant les caméras du monde entier. On vous propose de monter à bord.',
      choices: [
        c('monter', 'Monter à bord', [cr('train_futur', 6), s('popularity', 3), s('stress', 3)], '603 km/h. Votre sourire crispé fait le tour du monde.'),
        c('quai', 'Regarder depuis le quai', [cr('train_futur', 3), s('credibility', 1)], 'Prudent. Le record est battu, sans vous.'),
      ],
    }),
  },
  {
    tag: 'pandas_greve_faim', weight: 1, eligible: d => !!d.crises?.pandas,
    build: () => ({
      title: 'Les pandas ne mangent plus',
      context: 'Depuis quatre jours, les pandas boudent leur bambou. Les chaînes d’info installent des caméras devant l’enclos.',
      choices: [
        c('bambou', 'Faire venir du bambou de Chine par avion', [cr('pandas', 5, -2), { kind: 'funds', account: 'campaign', delta: -3000 }], 'Le bambou chinois arrive : les pandas mangent. Pékin apprécie l’attention.'),
        c('experts', 'Confier l’affaire aux soigneurs du zoo', [cr('pandas', 2, 2), s('credibility', 1)], 'Les soigneurs trouvent la solution… mais la presse a parlé de « crise du bambou ».'),
      ],
    }),
  },
  {
    tag: 'pandas_nom', weight: 0.9, eligible: d => !!d.crises?.pandas,
    build: () => ({
      title: 'Comment appeler les pandas ?',
      context: 'Un vote en ligne pour nommer les pandas est submergé : « Pandy McPandaface » arrive largement en tête. L’ambassade de Chine s’inquiète.',
      choices: [
        c('respecter', 'Respecter le vote populaire', [cr('pandas', 1, 5), s('popularity', 3), { kind: 'segment', segment: 'jeunes', delta: 3 }], 'Internet exulte. Pékin, beaucoup moins.'),
        c('diplomatie', 'Choisir des noms chinois traditionnels', [cr('pandas', 5, -3), s('popularity', -1)], 'Yuan et Mei. Élégant, diplomatique, un peu triste.'),
      ],
    }),
  },
  {
    tag: 'coupe_billets', weight: 1, eligible: d => !!d.crises?.coupe_monde,
    build: () => ({
      title: 'Le scandale des billets',
      context: 'Les billets du Mondial se revendent dix fois leur prix sur des sites étrangers. Les supporters populaires crient au scandale.',
      choices: [
        c('nominatif', 'Imposer des billets nominatifs', [cr('coupe_monde', 4, -4), { kind: 'segment', segment: 'populaires', delta: 2 }], 'La revente s’effondre. Les vrais supporters remplissent les tribunes.'),
        c('laisser', 'Laisser faire le marché', [cr('coupe_monde', 1, 4), { kind: 'segment', segment: 'cadres', delta: 1 }], 'Tribunes VIP pleines, virages vides : l’ambiance s’en ressent.'),
      ],
    }),
  },
  {
    tag: 'coupe_quart', weight: 0.8, eligible: d => !!d.crises?.coupe_monde,
    build: () => ({
      title: 'Les Bleus en quart de finale',
      context: 'Match décisif ce soir. Le sélectionneur vous invite dans le vestiaire avant le coup d’envoi.',
      choices: [
        c('vestiaire', 'Aller encourager les joueurs', [cr('coupe_monde', 5), s('popularity', 2), s('stress', 2)], 'Une poignée de mains, un « allez les Bleus » : on gagne 2-1. Vous êtes un porte-bonheur.'),
        c('tribune', 'Rester en tribune avec le public', [cr('coupe_monde', 3, -2), { kind: 'segment', segment: 'populaires', delta: 2 }], 'L’écharpe au cou, au milieu des supporters : la photo est parfaite.'),
      ],
    }),
  },
  {
    tag: 'jubile_carrosse', weight: 1, eligible: d => !!d.crises?.jubile,
    build: () => ({
      title: 'Le carrosse du jubilé',
      context: 'Le carrosse doré du sacre doit traverser Paris. Un collectif menace de bloquer le parcours avec des vélos.',
      choices: [
        c('velo', 'Remplacer le carrosse par un vélo', [cr('jubile', 4, -5), s('popularity', 3)], 'Le souverain à vélo : l’image désarme même les opposants.'),
        c('carrosse', 'Maintenir le carrosse et sécuriser le parcours', [cr('jubile', 6, 3), { kind: 'kingdom', prestige: 2 }], 'Un défilé splendide, sous haute protection.'),
      ],
    }),
  },
  {
    tag: 'jubile_boycott', weight: 0.9, eligible: d => !!d.crises?.jubile,
    build: () => ({
      title: 'Des maires boycottent le jubilé',
      context: 'Deux cents maires républicains refusent d’accrocher les guirlandes du jubilé sur leur mairie.',
      choices: [
        c('liberte', 'Leur laisser cette liberté', [cr('jubile', 2, -3), { kind: 'kingdom', stabilite: 2 }], '« Le royaume respecte ceux qui ne l’aiment pas. » La phrase fait mouche.'),
        c('pression', 'Faire pression par les préfets', [cr('jubile', 3, 6), { kind: 'kingdom', opposition: 3 }], 'Les guirlandes sont posées. Les rancœurs aussi.'),
      ],
    }),
  },
  {
    tag: 'diamants_photo', weight: 1, eligible: d => !!d.crises?.diamants,
    build: () => ({
      title: 'La photo de l’écrin',
      context: 'Une photo floue montre un écrin ouvert sur une table de l’ambassade. L’hebdomadaire en fait sa une : « Les diamants de l’Élu·e ».',
      choices: [
        c('musee', 'Prouver que l’écrin a été déposé au musée des Cadeaux d’État', [cr('diamants', 7, -3)], 'Le conservateur retrouve le registre : l’écrin y dort depuis deux ans.'),
        c('plainte', 'Porter plainte pour diffamation', [cr('diamants', 2, 4), s('stress', 3)], 'La plainte prendra des mois. Le soupçon, lui, est déjà là.'),
      ],
    }),
  },
  {
    tag: 'diamants_juge', weight: 0.8, eligible: d => !!d.crises?.diamants,
    build: () => ({
      title: 'Convocation chez la juge',
      context: 'La juge d’instruction vous convoque comme témoin assisté. Les caméras attendent devant le palais de justice.',
      choices: [
        c('repondre', 'Répondre à toutes les questions, sans avocat médiatique', [cr('diamants', 6, -2), s('credibility', 2)], 'Quatre heures d’audition. Vous ressortez sans un mot pour les caméras.'),
        c('silence', 'Garder le silence, sur conseil de vos avocats', [cr('diamants', 1, 5)], 'Juridiquement prudent. Politiquement désastreux.'),
      ],
    }),
  },
  {
    tag: 'ours_brebis', weight: 1, eligible: d => !!d.crises?.ours,
    build: () => ({
      title: 'Trente brebis tuées en une nuit',
      context: 'Un troupeau a été attaqué sur une estive ariégeoise. Les bergers bloquent la route nationale avec des carcasses.',
      choices: [
        c('indemniser', 'Indemniser en 48 heures et envoyer des patous', [cr('ours', 5, -5), { kind: 'funds', account: 'campaign', delta: -2000 }], 'Les chèques arrivent vite : la colère retombe.'),
        c('effarouchement', 'Autoriser l’effarouchement des ours', [cr('ours', -2, -3), { kind: 'segment', segment: 'jeunes', delta: -2 }], 'Pétards et chiens : les bergers respirent, les écologistes hurlent.'),
      ],
    }),
  },
  {
    tag: 'ours_ourson', weight: 0.8, eligible: d => !!d.crises?.ours,
    build: () => ({
      title: 'Naissance d’un ourson',
      context: 'Une ourse réintroduite a donné naissance à deux oursons, filmés par une caméra automatique. La vidéo bat des records.',
      choices: [
        c('concours', 'Lancer un concours pour les nommer dans les écoles', [cr('ours', 5), s('popularity', 2), { kind: 'segment', segment: 'jeunes', delta: 2 }], 'Pic et Pyrène : les noms gagnants sont votés par 40 000 élèves.'),
        c('discret', 'Rester discret pour ne pas froisser les bergers', [cr('ours', 2, -2)], 'Sage. Les bergers apprécient votre retenue.'),
      ],
    }),
  },
  {
    tag: 'essence_files', weight: 1, eligible: d => !!d.crises?.penurie_essence,
    build: () => ({
      title: 'Les files d’attente',
      context: 'Deux kilomètres de voitures devant une station de la périphérie. Un automobiliste filme et vous interpelle : « Vous, vous avez de l’essence ? »',
      choices: [
        c('rationner', 'Instaurer un rationnement : 30 litres par plein', [cr('penurie_essence', 5, -2), s('popularity', -1)], 'Les files raccourcissent. Les automobilistes râlent, mais tout le monde passe.'),
        c('velo', 'Venir à vélo et annoncer la gratuité des transports', [cr('penurie_essence', 2, -5), s('popularity', 3), { kind: 'economy', deficit: 0.02 }], 'L’image du vélo devant la file fait le tour des réseaux.'),
      ],
    }),
  },
  {
    tag: 'essence_requisition', weight: 0.8, eligible: d => !!d.crises?.penurie_essence,
    build: () => ({
      title: 'Réquisitionner les dépôts ?',
      context: 'Les préfets proposent de réquisitionner les dépôts bloqués. Les syndicats menacent d’étendre la grève.',
      choices: [
        c('requisition', 'Réquisitionner', [cr('penurie_essence', 8, 3), { kind: 'segment', segment: 'populaires', delta: -2 }], 'Les camions-citernes repartent sous escorte.'),
        c('accord', 'Négocier un accord salarial', [cr('penurie_essence', 4, -4), { kind: 'economy', deficit: 0.03 }], 'Un accord à 4 h du matin : la grève est levée, la facture aussi.'),
      ],
    }),
  },
  {
    tag: 'culture_artiste', weight: 1, eligible: d => !!d.crises?.capitale_culture,
    build: () => ({
      title: 'Une œuvre qui choque',
      context: 'Une sculpture géante sur la place centrale fait scandale : une pétition de 30 000 riverains exige son retrait.',
      choices: [
        c('defendre', 'Défendre la liberté de création', [cr('capitale_culture', 5, 2), s('credibility', 1)], 'La polémique fait venir les curieux par milliers.'),
        c('deplacer', 'La déplacer au musée', [cr('capitale_culture', 1, -3), { kind: 'segment', segment: 'retraites', delta: 2 }], 'Les riverains respirent ; les artistes signent une tribune contre vous.'),
      ],
    }),
  },
  {
    tag: 'culture_mecene', weight: 0.8, eligible: d => !!d.crises?.capitale_culture,
    build: () => ({
      title: 'Le mécène encombrant',
      context: 'Un milliardaire propose de financer la moitié de l’année culturelle… à condition que son nom figure partout.',
      choices: [
        c('accepter', 'Accepter l’argent', [cr('capitale_culture', 7, 2), { kind: 'exposure', delta: 2 }], 'Les festivals se multiplient. Son logo aussi.'),
        c('refuser', 'Refuser et lancer un financement participatif', [cr('capitale_culture', 3, -2), s('popularity', 2)], '200 000 donateurs : la culture appartient à tout le monde.'),
      ],
    }),
  },
  {
    tag: 'canicule_ehpad', weight: 1, eligible: d => !!d.crises?.canicule,
    build: () => ({
      title: 'Un Ehpad sans climatisation',
      context: 'Une aide-soignante filme un Ehpad à 38 °C dans les chambres. La vidéo fait le tour du pays.',
      choices: [
        c('climatiseurs', 'Faire livrer des climatiseurs mobiles dans la nuit', [cr('canicule', 6, -4), { kind: 'funds', account: 'campaign', delta: -2000 }], 'Les camions arrivent à 3 h du matin. La vidéo suivante montre des sourires.'),
        c('enquete', 'Ouvrir une enquête sur la direction', [cr('canicule', 1, 2), s('credibility', 1)], 'Juste, mais lent : la chaleur, elle, n’attend pas.'),
      ],
    }),
  },
  {
    tag: 'canicule_standard', weight: 0.8, eligible: d => !!d.crises?.canicule,
    build: () => ({
      title: 'La cellule de crise débordée',
      context: 'Le numéro vert canicule reçoit 40 000 appels par jour. Il manque des bras au standard.',
      choices: [
        c('standard', 'Prendre vous-même des appels au standard', [{ kind: 'minigame', gameId: 'standard_ministere', title: 'Au standard de la cellule canicule', reward: [cr('canicule', 7, -3), s('popularity', 2)], penalty: [cr('canicule', 0, 3)] }], 'Casque sur les oreilles, vous décrochez.'),
        c('benevoles', 'Mobiliser des étudiants volontaires', [cr('canicule', 4, -2), seg2('jeunes', 2)], 'Mille étudiants en une journée : le numéro vert répond à nouveau.'),
      ],
    }),
  },
  {
    tag: 'hacker_fuite', weight: 1, eligible: d => !!d.crises?.hacker,
    build: () => ({
      title: 'Vos SMS en ligne',
      context: '« Robespierre » publie dix de vos SMS. Dans l’un, vous traitez un collègue de « boulet ».',
      choices: [
        c('assumer', 'Assumer avec humour et s’excuser auprès du collègue', [cr('hacker', 4, -3), s('popularity', 1)], '« J’ai dit boulet ? Je voulais dire pilier. » La salle rit, le collègue moins.'),
        c('nier', 'Dénoncer des faux', [cr('hacker', 1, 5), s('credibility', -2)], 'Les métadonnées prouvent que les messages sont authentiques. Aïe.'),
      ],
    }),
  },
  {
    tag: 'hacker_contact', weight: 0.8, eligible: d => !!d.crises?.hacker,
    build: () => ({
      title: '« Robespierre » vous écrit',
      context: 'Le pirate vous contacte directement : il vous épargnera si vous dénoncez publiquement « la corruption du système ».',
      choices: [
        c('enqueteurs', 'Transmettre le message aux enquêteurs', [cr('hacker', 7, 2)], 'Grâce à votre message, les enquêteurs remontent une adresse IP.'),
        c('ignorer', 'Ne pas répondre', [cr('hacker', 2, 1)], 'Silence. Le pirate passe à quelqu’un d’autre… pour l’instant.'),
      ],
    }),
  },
  {
    tag: 'barons_ligue', weight: 1, eligible: d => !!d.crises?.barons,
    build: () => ({
      title: 'La Ligue des territoires',
      context: 'Les barons fondent une « Ligue des territoires » et invitent les fédérations à les rejoindre.',
      choices: [
        c('pacte', 'Proposer un pacte de gouvernance partagée', [cr('barons', 6, -4), s('politicalCapital', -6)], 'Trois barons acceptent de négocier.'),
        c('exclure', 'Exclure les meneurs', [cr('barons', 2, 6), { kind: 'dread', delta: 8 }], 'Les meneurs sont exclus ; leurs fédérations les suivent.'),
      ],
    }),
  },
  {
    tag: 'barons_tresor', weight: 0.8, eligible: d => !!d.crises?.barons,
    build: () => ({
      title: 'Le trésor des fédérations',
      context: 'Les barons bloquent les cotisations de leurs fédérations : la trésorerie du parti s’assèche.',
      choices: [
        c('payer', 'Combler le trou sur vos réseaux de donateurs', [cr('barons', 4, -2), { kind: 'funds', account: 'campaign', delta: -4000 }], 'Le parti tient. Les barons perdent un moyen de pression.'),
        c('justice', 'Saisir la commission des conflits', [cr('barons', 3, 3), s('credibility', 1)], 'Procédure longue, rancunes tenaces.'),
      ],
    }),
  },
  {
    tag: 'debat_reunion', weight: 1, eligible: d => !!d.crises?.grand_debat,
    build: () => ({
      title: 'Une réunion qui tourne mal',
      context: 'Dans une salle des fêtes bondée, un participant prend le micro : « Vous ne nous écoutez jamais ! » La salle applaudit.',
      choices: [
        c('rester', 'Rester jusqu’au bout et répondre à tout', [cr('grand_debat', 6, -4), s('energy', -6), s('popularity', 2)], 'Cinq heures de questions. On vous applaudit en partant.'),
        c('partir', 'Écourter la réunion', [cr('grand_debat', 1, 5)], 'La vidéo de votre départ circule toute la soirée.'),
      ],
    }),
  },
  {
    tag: 'debat_cahiers', weight: 0.8, eligible: d => !!d.crises?.grand_debat,
    build: () => ({
      title: 'Les cahiers débordent',
      context: 'Deux millions de contributions : personne ne pourra tout lire. Un cabinet de conseil propose une synthèse par intelligence artificielle.',
      choices: [
        c('citoyens', 'Faire lire les cahiers par des citoyens tirés au sort', [cr('grand_debat', 6, -3), s('politicalCapital', -5)], 'Cent citoyens lisent, trient, débattent. La démarche est saluée.'),
        c('cabinet', 'Confier la synthèse au cabinet', [cr('grand_debat', 4, 4), { kind: 'funds', account: 'campaign', delta: -2000 }], '« Une machine pour résumer la colère du peuple » : la polémique enfle.'),
      ],
    }),
  },
];

// ── Fuite dans l'équipe, crise de culte ─────────────────────

const seg2 = (segment: 'jeunes' | 'retraites' | 'populaires' | 'cadres' | 'ruraux', delta: number): Effect => ({ kind: 'segment', segment, delta });

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

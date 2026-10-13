import { Effect } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';

/* ============================================================
 *  Événements du Premier contact : fuites, sectes, puissances
 *  rivales, cadeaux des Vélari, questions de l'émissaire…
 *  Plus la porte d'entrée dans une partie ordinaire.
 * ============================================================ */

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat, delta });
const al = (x: Omit<Extract<Effect, { kind: 'alien' }>, 'kind'>): Effect => ({ kind: 'alien', ...x });
const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice =>
  ({ id, label, effects, outcome, ...extra });
const play = (gameId: string, title: string, reward: Effect[], penalty?: Effect[]): Effect =>
  ({ kind: 'minigame', gameId, title, reward, ...(penalty ? { penalty } : {}) });
const phase = (min: number, max = 9) => (d: { alien: { phase: number } | null }) => !!d.alien && d.alien.phase >= min && d.alien.phase <= max;

/** Porte d'entrée : le signal dans une partie ordinaire */
export const ALIEN_GATE: RandomEvent = {
  tag: 'signal_etoiles', weight: 1, minRank: 'depute',
  eligible: d => !d.alien && !d.player.flags['alienGate'],
  build: () => ({
    title: 'Un signal venu des étoiles',
    context: 'Note « très secret » : le radiotélescope de Nançay capte depuis dix jours un signal régulier venu de Proxima du Centaure. Matignon cherche quelqu’un pour piloter la cellule du Premier contact. Votre nom circule.',
    choices: [
      c('accepter', 'Prendre la tête de la cellule', [al({ join: true }), { kind: 'flag', key: 'alienGate', value: true }, s('stress', 6)], 'Badge, bureau sans fenêtre, ligne sécurisée : bienvenue dans l’Histoire.'),
      c('decliner', 'Laisser les scientifiques travailler', [{ kind: 'flag', key: 'alienGate', value: true }], 'Le dossier part ailleurs. Vous vous demanderez longtemps.'),
      c('canular', 'Crier au canular', [{ kind: 'flag', key: 'alienGate', value: true }, s('credibility', -2), s('popularity', 1)], '« Les petits hommes verts ? Sérieusement ? » La salle rit. Pour l’instant.'),
    ],
  }),
};

export const ALIEN_EVENTS: RandomEvent[] = [
  {
    tag: 'al_astronome', weight: 1.2, eligible: phase(0, 1),
    build: () => ({
      title: 'Un astronome amateur a tout capté',
      context: 'Depuis son observatoire du Jura, un passionné a enregistré le signal. Il menace de tout publier sur son blog demain matin.',
      choices: [
        c('recruter', 'Le recruter dans la cellule', [al({ comprehension: 4 }), s('politicalCapital', -5)], 'Il signe la clause de confidentialité les larmes aux yeux.'),
        c('silence', 'Acheter son silence', [al({ panique: -3 }), { kind: 'exposure', delta: 4 }, { kind: 'funds', account: 'personal', delta: -2000 }], 'Une « bourse de recherche » discrète.', { needMoney: 2000 }),
        c('publier', 'Le laisser publier', [al({ panique: 12 }), s('popularity', 2), s('credibility', 2)], 'Le blog explose. Le monde apprend la nouvelle par un amateur.'),
      ],
    }),
  },
  {
    tag: 'al_secte', weight: 1, eligible: phase(1),
    build: () => ({
      title: 'Une secte annonce la fin du monde',
      context: '« Les Enfants de Proxima » réunissent dix mille fidèles et appellent à vendre ses biens avant l’arrivée des « Seigneurs ».',
      choices: [
        c('dialoguer', 'Envoyer des scientifiques dialoguer', [al({ panique: -4 }), s('credibility', 2)], 'Un débat filmé démonte les prophéties.'),
        c('dissoudre', 'Faire dissoudre le mouvement', [al({ panique: -2 }), s('popularity', 1), s('stress', 3)], 'Le Conseil d’État valide. Les fidèles crient au complot.'),
        c('ignorer', 'Ne pas leur faire de publicité', [al({ panique: 6 })], 'Le mouvement grossit dans l’ombre.'),
      ],
    }),
  },
  {
    tag: 'al_puissance', weight: 1.2, eligible: phase(1),
    build: () => ({
      title: 'Une grande puissance réclame le contact',
      context: 'Un grand pays exige, au Conseil de sécurité, que « le premier contact soit confié à la nation disposant des moyens spatiaux adéquats ». Il ne parle pas de la France.',
      choices: [
        c('resister', 'Refuser et tenir bon', [al({ rivalite: 8 }), s('popularity', 3), { kind: 'intl', prestige: 2 }], 'Le ton monte à New York. Les Français applaudissent.'),
        c('cogestion', 'Proposer une cogestion', [al({ rivalite: -8, confiance: -2 }), { kind: 'intl', prestige: -1 }], 'Un comité mixte. Les Vélari, eux, se demandent qui parle.'),
        c('ceder', 'Céder la main', [al({ rivalite: -15, confiance: -6 }), s('influence', -5), { kind: 'intl', prestige: -6 }], 'Soulagement diplomatique, humiliation nationale.'),
      ],
    }),
  },
  {
    tag: 'al_second_message', weight: 1.2, eligible: phase(1),
    build: () => ({
      title: 'Un second message, bien plus long',
      context: 'Quarante minutes de symboles, cette fois. Les cryptologues pensent y voir une grammaire. Il faut s’y mettre tout de suite.',
      choices: [
        c('decoder', 'Décoder vous-même avec l’équipe', [play('glyphes', 'Le second message', [al({ comprehension: 9 }), s('credibility', 1)])], 'Café, tableaux blancs, nuit blanche.'),
        c('deleguer', 'Laisser les spécialistes travailler', [al({ comprehension: 3 })], 'Le rapport arrive dans trois semaines.'),
      ],
    }),
  },
  {
    tag: 'al_visible', weight: 1.5, eligible: phase(2, 2),
    build: () => ({
      title: 'Le vaisseau est visible à l’œil nu',
      context: 'Chaque soir, un point brillant traverse le ciel d’ouest en est. Les réseaux s’affolent, les supermarchés sont dévalisés.',
      choices: [
        c('nuit', 'Organiser une grande nuit d’observation', [al({ panique: -7 }), s('popularity', 3)], 'Des millions de Français, des télescopes, des enfants émerveillés.'),
        c('couvre_feu', 'Instaurer un couvre-feu', [al({ panique: -3 }), s('popularity', -4), s('credibility', -1)], 'Rues vides, colère sourde.'),
        c('discours', 'Prendre la parole', [play('discours_etoiles', 'Le soir où tout le monde regardait le ciel', [al({ panique: -9 }), s('popularity', 2)])], 'Caméras, pupitre, ciel étoilé derrière vous.'),
      ],
    }),
  },
  {
    tag: 'al_cadeau', weight: 1, eligible: phase(2),
    build: () => ({
      title: 'Les Vélari offrent une technologie',
      context: 'Un message limpide : la formule d’une batterie mille fois plus efficace que les nôtres. Un cadeau, disent-ils. À qui ?',
      choices: [
        c('partager', 'La partager avec toute l’humanité', [al({ rivalite: -12, confiance: 6, gift: true }), { kind: 'intl', prestige: 6 }, s('credibility', 3)], 'Les industriels français grincent. Le monde salue.'),
        c('garder', 'La garder pour la France', [al({ rivalite: 14, gift: true }), { kind: 'dossier', domain: 'economie', delta: 6 }, s('popularity', 3)], 'Les autres puissances crient au vol.'),
        c('refuser', 'Refuser poliment : trop dangereux', [al({ confiance: -8, panique: -2 }), s('credibility', 1)], 'Les Vélari ne répondent pas pendant une semaine.'),
      ],
    }),
  },
  {
    tag: 'al_virus', weight: 0.9, eligible: phase(2),
    build: () => ({
      title: 'Rumeur : un virus venu de l’espace',
      context: 'Une vidéo virale affirme que des « spores vélari » rendent malade. Aucune preuve, mais les urgences débordent d’angoissés.',
      choices: [
        c('transparence', 'Transparence totale : publier les analyses', [al({ comprehension: 2, panique: -4 }), s('credibility', 3)], 'Les laboratoires ouvrent leurs portes aux caméras.'),
        c('quarantaine', 'Imposer une quarantaine préventive', [al({ panique: -2, confiance: -5 }), s('popularity', -1)], 'Les Vélari demandent pourquoi on les craint.'),
        c('dementir', 'Démentir sèchement', [al({ panique: 4 })], 'Le démenti fait l’effet inverse.'),
      ],
    }),
  },
  {
    tag: 'al_emissaire_village', weight: 1.3, eligible: phase(3),
    build: () => ({
      title: 'L’émissaire veut voir « un vrai village »',
      context: 'L’émissaire vélari souhaite rencontrer des humains ordinaires. Le maire de Saint-Aubin-les-Champs propose sa salle des fêtes.',
      choices: [
        c('accompagner', 'L’accompagner dans la foule', [play('selfies', 'L’émissaire à Saint-Aubin', [al({ confiance: 8, panique: -6 }), s('popularity', 4)])], 'Sono, buffet, drapeaux… et un visiteur de quatre mètres.'),
        c('protocole', 'Une visite protocolaire, barrières et snipers', [al({ confiance: 2, panique: -2 }), s('popularity', -1)], 'Tout se passe bien. Sans chaleur.'),
        c('refuser', 'Trop risqué : refuser', [al({ confiance: -6 })], 'L’émissaire ne comprend pas.'),
      ],
    }),
  },
  {
    tag: 'al_question', weight: 1.1, eligible: phase(2),
    build: () => ({
      title: 'L’émissaire pose une question',
      context: '« Pourquoi vous faites-vous la guerre entre vous ? » La question arrive en direct, devant les caméras du monde entier.',
      choices: [
        c('verite', 'Répondre avec franchise', [al({ confiance: 7, comprehension: 2 }), s('credibility', 3), s('stress', 3)], '« Parce que nous avons peur. Nous apprenons. » Silence, puis un signal que les linguistes traduisent par « merci ».'),
        c('esquive', 'Botter en touche', [al({ confiance: -3 }), s('popularity', -1)], 'Les Vélari notent l’esquive.'),
        c('fierte', 'Vanter la puissance de nos armées', [al({ confiance: -8, rivalite: -3 }), s('popularity', 2)], 'Un frisson parcourt la planète. Pas dans le bon sens.'),
      ],
    }),
  },
  {
    tag: 'al_hollywood', weight: 0.6, eligible: phase(1),
    build: () => ({
      title: 'Hollywood veut le film',
      context: 'Un grand studio propose de tourner « l’histoire vraie » du Premier contact, avec une star dans votre rôle.',
      choices: [
        c('accepter', 'Accepter et conseiller le scénario', [s('popularity', 4), { kind: 'income', base: 20000 }, { kind: 'exposure', delta: 3 }], 'On vous prête une mâchoire plus carrée.'),
        c('refuser', 'Refuser : ce n’est pas un spectacle', [s('credibility', 3)], 'Le film se fera sans vous. Et contre vous ?'),
      ],
    }),
  },
  {
    tag: 'al_religions', weight: 0.8, eligible: phase(1),
    build: () => ({
      title: 'Les religions s’interrogent',
      context: 'Évêques, imams, rabbins et pasteurs demandent à être reçus : « Que dit cette rencontre de notre place dans l’univers ? »',
      choices: [
        c('dialogue', 'Organiser un grand dialogue interreligieux', [al({ panique: -6 }), s('credibility', 2), s('energy', -6)], 'Une photo historique, sur le parvis de Notre-Dame.'),
        c('laicite', 'Rappeler la laïcité, poliment', [al({ panique: 1 }), s('credibility', 1)], 'Chacun repart avec ses questions.'),
      ],
    }),
  },
  {
    tag: 'al_taupe', weight: 0.9, eligible: phase(1),
    build: () => ({
      title: 'Une taupe dans la cellule',
      context: 'La DGSI a identifié un ingénieur qui transmet vos données à une puissance étrangère.',
      choices: [
        c('arreter', 'L’arrêter discrètement', [al({ rivalite: -4 }), s('stress', 3)], 'Interpellation à l’aube. Rien ne filtre.'),
        c('intox', 'L’utiliser pour intoxiquer l’adversaire', [al({ rivalite: -8 }), { kind: 'exposure', delta: 3 }],
          'De fausses données partent vers l’étranger.', { risk: { baseChance: 0.35, onFailure: [al({ rivalite: 10 }), s('credibility', -4)], failureNews: 'L’intox est éventée : crise diplomatique.' } }),
        c('publier', 'Dénoncer publiquement l’espionnage', [al({ rivalite: 6 }), s('popularity', 3)], 'Le pays se serre derrière vous ; les chancelleries s’échauffent.'),
      ],
    }),
  },
];

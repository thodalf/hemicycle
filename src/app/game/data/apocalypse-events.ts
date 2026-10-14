import { Effect, GameState } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';
import { CULT, DEVIL } from '../engine/apocalypse';

/* ============================================================
 *  La fin du monde : la porte d'entrée, les rebondissements de
 *  chaque phase, et le Diable qui revient réclamer son dû.
 * ============================================================ */

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat, delta });
const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice =>
  ({ id, label, effects, outcome, ...extra });
const ap = (x: Omit<Extract<Effect, { kind: 'apocalypse' }>, 'kind'>): Effect => ({ kind: 'apocalypse', ...x });
const phase = (...ps: number[]) => (d: GameState) => !!d.apocalypse && ps.includes(d.apocalypse.phase);
const Cult = CULT.charAt(0).toUpperCase() + CULT.slice(1);

export const APOC_GATE: RandomEvent = {
  tag: 'apoc_presages', weight: 1, minRank: 'conseiller_municipal',
  eligible: d => !d.apocalypse && !d.player.flags['apocGate'] && !d.player.flags['closed_apocalypse'] && d.week > 36,
  build: () => ({
    title: 'Le ciel s’assombrit à midi',
    context: 'Une éclipse qu’aucun astronome n’avait prévue. Des corbeaux par milliers sur la place de la Concorde. Et, sur les murs de dix villes, le même symbole : un soleil noir.',
    choices: [
      c('enquete', 'Prendre l’affaire au sérieux et demander une enquête', [ap({ start: true }), ap({ resistance: 6 }), s('credibility', -1)], 'Les éditorialistes ricanent. Vous, vous avez vu le symbole de près.'),
      c('raison', 'Appeler à la raison : « il y a une explication scientifique »', [ap({ start: true }), s('credibility', 2)], 'Les scientifiques n’ont pas d’explication. Pas encore.'),
    ],
  }),
};

export const APOC_EVENTS: RandomEvent[] = [
  {
    tag: 'apoc_riviere', weight: 1, eligible: phase(0, 1),
    build: () => ({
      title: 'La Loire rouge sang',
      context: 'Le fleuve a pris une couleur écarlate en une nuit. Les analyses parlent d’algues ; les foules parlent de malédiction.',
      choices: [
        c('science', 'Faire publier les analyses scientifiques', [ap({ resistance: 4 }), s('credibility', 2)], 'Des algues, vraiment ? Peut-être.'),
        c('priere', 'Se joindre à une veillée de prière sur les quais', [ap({ resistance: 6, darkness: -2 }), s('popularity', 1)], 'Dix mille bougies sur les quais. La nuit paraît moins noire.'),
      ],
    }),
  },
  {
    tag: 'apoc_bague', weight: 1, eligible: phase(1, 2),
    build: () => ({
      title: 'Une bague noire au doigt d’un ministre',
      context: `Une photo circule : un ministre porte la bague noire de ${CULT}. Il dément. La photo est nette.`,
      choices: [
        c('denoncer', 'Exiger sa démission', [ap({ cult: -8 }), s('influence', -1), s('credibility', 2)], 'Il démissionne en larmes. Il dit qu’il « n’avait pas le choix ».'),
        c('discret', 'Demander une enquête discrète', [ap({ cult: -3, resistance: 2 })], 'Les services remontent une liste de noms. Elle est longue.'),
        c('ignorer', 'Ne pas s’en mêler', [ap({ cult: 5 })], 'La secte prend note de votre discrétion.'),
      ],
    }),
  },
  {
    tag: 'apoc_recrutement', weight: 0.9, eligible: phase(1, 2),
    build: () => ({
      title: 'La secte vous fait une offre',
      context: `Un homme élégant vous aborde à la sortie d’un dîner : « ${Cult} soutient les gens d’avenir. Votre prochaine campagne pourrait être… facilitée. »`,
      choices: [
        c('refuser', 'Refuser et alerter la police', [ap({ cult: -5, resistance: 3 }), s('stress', 3)], 'Il sourit : « Vous changerez d’avis. »'),
        c('infiltrer', 'Faire semblant d’accepter, pour infiltrer', [ap({ cult: -10 }), s('stress', 6)], 'Une cérémonie, une cape, des noms connus. Vous mémorisez tout.',
          { risk: { baseChance: 0.3, onFailure: [{ kind: 'exposure', delta: 10 }, s('popularity', -4)], failureNews: 'Des photos de vous en cape noire fuitent dans la presse.' } }),
        c('accepter', 'Accepter l’argent', [{ kind: 'funds', account: 'campaign', delta: 20000 }, ap({ cult: 8, darkness: 3 }), { kind: 'exposure', delta: 6 }], 'Vingt mille euros, en liquide, dans une boîte de chocolats noirs.'),
      ],
    }),
  },
  {
    tag: 'apoc_solstice', weight: 1.2, eligible: phase(2),
    build: () => ({
      title: 'Le lieu du rituel localisé',
      context: 'Une ancienne carrière dans le Jura : des centaines de bougies, un cercle gravé dans la pierre. Le rituel aura lieu dans quelques semaines.',
      choices: [
        c('raid', 'Lancer un raid avec le GIGN', [ap({ raid: true }), s('energy', -5)], 'Hélicoptères, projecteurs, gilets pare-balles. Et une odeur de soufre.'),
        c('surveiller', 'Surveiller pour remonter jusqu’aux chefs', [ap({ cult: -6, darkness: 2 })], 'Les chefs se montrent. La nuit du rituel approche.'),
      ],
    }),
  },
  {
    tag: 'apoc_insomnie', weight: 1, eligible: phase(3),
    build: () => ({
      title: 'Le pays ne dort plus',
      context: `Depuis l’arrivée de ${DEVIL}, des millions de Français ne trouvent plus le sommeil. Les urgences débordent.`,
      choices: [
        c('solidarite', 'Lancer une grande chaîne de solidarité', [ap({ resistance: 8 }), s('energy', -6), s('popularity', 2)], 'Des voisins qui veillent les uns sur les autres. La nuit recule un peu.'),
        c('science', 'Mobiliser les chercheurs', [ap({ resistance: 5, darkness: -3 }), s('credibility', 2)], 'Un somnifère expérimental donne des résultats. Inexplicables, mais réels.'),
      ],
    }),
  },
  {
    tag: 'apoc_tentation', weight: 1, eligible: phase(3),
    build: () => ({
      title: `${DEVIL} vous invite à dîner`,
      context: `Un carton d’invitation à l’encre rouge : « Dînons, vous et moi. Je pourrais vous être très utile. » Signé : ${DEVIL}.`,
      choices: [
        c('refuser', 'Déchirer l’invitation', [ap({ resistance: 6 }), s('stress', 4)], 'Les morceaux de carton brûlent tout seuls dans la corbeille.'),
        c('diner', 'Y aller, pour comprendre ce qu’il veut', [ap({ darkness: 3 }), s('influence', 2), s('stress', 6)], 'Il connaît le prénom de votre grand-mère. Il veut « juste un petit contrat ». Son numéro est dans votre téléphone.'),
      ],
    }),
  },
  {
    tag: 'apoc_cathedrale', weight: 0.9, eligible: phase(2, 3),
    build: () => ({
      title: 'Une veillée de toutes les religions',
      context: 'Évêques, imams, rabbins, pasteurs et un collectif laïque proposent une veillée commune devant Notre-Dame.',
      choices: [
        c('participer', 'Y participer', [ap({ resistance: 10 }), s('popularity', 2), { kind: 'segment', segment: 'retraites', delta: 2 }], 'Des bougies, un silence immense. Quelque chose se brise du côté des ténèbres.'),
        c('laique', 'Rester à distance, au nom de la laïcité', [s('credibility', 1), ap({ resistance: 3 })], 'Un message de soutien, sobre.'),
      ],
    }),
  },
];

/** Après un pacte : chaque année, le Diable réclame son dû */
export const DEVIL_DUE: RandomEvent = {
  tag: 'diable_du', weight: 1, eligible: d => Number(d.player.flags['devilDebt'] ?? 0) > 0 && d.week - Number(d.player.flags['devilDebt']) >= 12,
  build: d => {
    const rival = [...d.npcs].sort((a, b) => a.relationToPlayer - b.relationToPlayer)[0];
    const paid: Effect = { kind: 'flag', key: 'devilDebt', value: d.week };
    return {
      title: `${DEVIL} repasse`,
      context: `Un costume blanc dans votre bureau, sans rendez-vous. « Un an déjà ! Je viens chercher ma petite part. Rien de bien méchant… pour l’instant. »`,
      choices: [
        c('rival', `Lui livrer ${rival?.name ?? 'un rival'}`, [paid, ...(rival ? [{ kind: 'npcStat', npcId: rival.id, stat: 'popularity', delta: -15 } as Effect, { kind: 'npcStat', npcId: rival.id, stat: 'influence', delta: -10 } as Effect] : []), s('stress', 6), { kind: 'exposure', delta: 4 }], 'Dans la semaine, tout s’effondre pour votre rival. Vous dormez mal.'),
        c('promesse', 'Renoncer à vos convictions sur un grand sujet', [paid, s('credibility', -6), { kind: 'stance', delta: 15 }], 'Vous votez le contraire de ce que vous défendiez. Il applaudit en silence.'),
        c('refuser', 'Rompre le pacte, quoi qu’il en coûte', [{ kind: 'flag', key: 'devilDebt', value: 0 }, { kind: 'health', delta: -15 }, s('popularity', -8), s('influence', -8), s('stress', 10)], 'Il soupire, claque des doigts. Vous vous réveillez à l’hôpital, libre.'),
      ],
    };
  },
};

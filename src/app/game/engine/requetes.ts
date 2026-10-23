import { Decision, DecisionChoice, Effect, GameState } from '../models/game.models';
import type { Pillar, ReqCard, ReqSide } from '../data/requetes-types';
import { CARDS_A } from '../data/requetes-a';
import { CARDS_B } from '../data/requetes-b';
import { applyEffects, pushNews } from './effects';
import { mods } from './difficulty';
import { RANKS } from '../data/ranks';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Les requêtes : la mécanique de Reigns dans Hémicycle.
 *  Chaque mois, deux à trois cartes ; deux réponses par carte ;
 *  quatre piliers (Peuple, Parti, Médias, Puissants) de 0 à 100.
 *  À 0 comme à 100, un pilier fait chuter : il faut alors
 *  trancher une crise (et le pilier repart d'une valeur moins
 *  extrême). Les cartes ignorées agacent. Certaines cartes
 *  appellent une suite des mois plus tard.
 * ============================================================ */

export const PILLARS: { id: Pillar; label: string; icon: string }[] = [
  { id: 'peuple', label: 'Le Peuple', icon: '👥' },
  { id: 'parti', label: 'Le Parti', icon: '🎗️' },
  { id: 'medias', label: 'Les Médias', icon: '📺' },
  { id: 'puissants', label: 'Les Puissants', icon: '💼' },
];

export interface RequetesState {
  pillars: Record<Pillar, number>;
  /** Les cartes du mois (ids) */
  hand: string[];
  week: number;
  /** Dernière fois que chaque carte a été tirée */
  done: Record<string, number>;
  /** Les suites programmées */
  chain: { card: string; week: number }[];
  /** Les chutes subies */
  falls: number;
  /** Requêtes traitées */
  answered: number;
}

export const CARDS: ReqCard[] = [...CARDS_A, ...CARDS_B];
export const CARD_BY_ID = new Map(CARDS.map(c => [c.id, c]));

export function requetes(d: GameState): RequetesState {
  return (d.requetes ??= { pillars: { peuple: 50, parti: 50, medias: 50, puissants: 50 }, hand: [], week: d.week, done: {}, chain: [], falls: 0, answered: 0 });
}

export function textOf(d: GameState, c: ReqCard): string {
  const tu = c.tu && c.textTu ? c.textTu : c.text;
  return typeof tu === 'function' ? tu(d) : tu;
}

const order = (d: GameState) => RANKS[d.player.rankId]?.order ?? 0;
const safe = (f: () => boolean) => { try { return f(); } catch { return false; } };

/** Les cartes du mois : les suites d'abord, puis un tirage */
export function monthlyRequetes(d: GameState, rng: Rng): void {
  if (d.status !== 'en_cours') return;
  const r = requetes(d);
  // Les requêtes laissées sans réponse : on s'en souvient
  const ignored = r.hand.map(id => CARD_BY_ID.get(id)).filter((c): c is ReqCard => !!c);
  for (const c of ignored) {
    const touched = new Set([...Object.keys(c.left.pillars), ...Object.keys(c.right.pillars)]) as Set<Pillar>;
    for (const p of touched) r.pillars[p] = clamp(r.pillars[p] - 3);
  }
  if (ignored.length) pushNews(d, 'actu', 'neutral', `${ignored.length} requête${ignored.length > 1 ? 's' : ''} restée${ignored.length > 1 ? 's' : ''} sans réponse`, 'On a frappé à votre porte, personne n’a répondu : chacun s’en souviendra.');
  // Les piliers reviennent doucement vers l'équilibre
  for (const p of PILLARS) r.pillars[p.id] = clamp(r.pillars[p.id] + Math.sign(50 - r.pillars[p.id]) * 0.8);
  // La nouvelle main
  const hand: string[] = [];
  const due = r.chain.filter(x => x.week <= d.week);
  r.chain = r.chain.filter(x => x.week > d.week);
  for (const x of due) if (CARD_BY_ID.has(x.card) && hand.length < 4) hand.push(x.card);
  const size = order(d) >= 2 ? 3 : 2;
  const pool = CARDS.filter(c => !c.chainOnly && !hand.includes(c.id) && (r.done[c.id] === undefined || d.week - r.done[c.id] >= (c.repeatAfter ?? 40)) && (!c.eligible || safe(() => c.eligible!(d))));
  while (hand.length < size && pool.length) {
    const total = pool.reduce((t, c) => t + (c.weight ?? 1), 0);
    let roll = rng.next() * total;
    const k = Math.max(0, pool.findIndex(c => (roll -= c.weight ?? 1) < 0));
    hand.push(pool.splice(k, 1)[0].id);
  }
  for (const id of hand) r.done[id] = d.week;
  r.hand = hand;
  r.week = d.week;
}

export interface RequeteResult { outcome: string; summary: string[]; deltas: Partial<Record<Pillar, number>>; fall?: string }

/** Répondre à une requête (gauche ou droite) */
export function answerRequete(d: GameState, cardId: string, side: 'left' | 'right', rng: Rng): RequeteResult | null {
  const r = requetes(d);
  const c = CARD_BY_ID.get(cardId);
  if (!c || !r.hand.includes(cardId)) return null;
  const s: ReqSide = c[side];
  r.hand = r.hand.filter(x => x !== cardId);
  r.answered += 1;
  const m = mods(d);
  const deltas: Partial<Record<Pillar, number>> = {};
  for (const [p, v] of Object.entries(s.pillars) as [Pillar, number][]) {
    const dv = Math.round(v * (v < 0 ? m.loss : m.gain));
    deltas[p] = dv;
    r.pillars[p] = Math.max(0, Math.min(100, r.pillars[p] + dv));
  }
  for (const [k, v] of Object.entries(s.remember ?? {})) d.player.flags[`mem_${k}`] = Number(d.player.flags[`mem_${k}`] ?? 0) + v;
  if (s.next) r.chain.push({ card: s.next.card, week: d.week + Math.max(1, s.next.months) });
  const summary = s.effects?.length ? applyEffects(d, s.effects, { reason: `Requête de ${c.name}` }, rng) : [];
  const outcome = typeof s.outcome === 'function' ? s.outcome(d) : s.outcome ?? '';
  // La chute : un pilier à 0 ou à 100
  let fall: string | undefined;
  for (const p of PILLARS) {
    const v = r.pillars[p.id];
    if (v <= 0 || v >= 100) {
      const high = v >= 100;
      r.pillars[p.id] = high ? 72 : 28;
      r.falls += 1;
      const dec = fallDecision(d, p.id, high);
      d.pendingDecisions.push(dec);
      fall = dec.title;
      pushNews(d, 'actu', 'negative', dec.title, dec.context);
      break;
    }
  }
  return { outcome, summary, deltas, fall };
}

const st = (stat: 'popularity' | 'credibility' | 'influence' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });

const FALLS: Record<Pillar, { low: [string, string, DecisionChoice[]]; high: [string, string, DecisionChoice[]] }> = {
  peuple: {
    low: ['La rue contre vous', 'Le Peuple ne vous écoute plus : sifflets à chaque déplacement, pétitions, cortèges. Vos requêtes refusées ont fini par faire masse.', [
      { id: 'terrain', label: 'Repartir sur le terrain, sans caméras', effects: [st('energy', -20), st('popularity', 2), { kind: 'segment', segment: 'populaires', delta: 3 }], outcome: 'Des semaines de marchés et de réunions d’appartement. La colère retombe un peu.' },
      { id: 'geste', label: 'Un geste fort : un chèque pour tous', effects: [{ kind: 'economy', deficit: 0.2 }, st('credibility', -4), st('popularity', 3)], outcome: 'Le geste calme les esprits. Les économistes, eux, s’étranglent.' },
      { id: 'tenir', label: 'Tenir bon, l’orage passera', effects: [st('popularity', -8), { kind: 'segment', segment: '*', delta: -3 }], outcome: 'L’orage ne passe pas tout de suite.' },
    ]],
    high: ['Le culte de la personnalité', 'Le Peuple vous adore, au point que vos alliés s’inquiètent et que vos adversaires s’unissent. Tout ce que vous dites devient parole d’évangile — et cible.', [
      { id: 'humble', label: 'Se faire discret·e quelques mois', effects: [{ kind: 'momentum', delta: -10 }, { kind: 'flagAdd', key: 'hubris', delta: -15 }], outcome: 'Moins d’apparitions, moins de foudres.' },
      { id: 'profiter', label: 'Surfer sur la vague', effects: [st('popularity', 3), { kind: 'flagAdd', key: 'hubris', delta: 25 }, st('credibility', -3)], outcome: 'Les foules sont là. L’hubris aussi.' },
    ]],
  },
  parti: {
    low: ['Le parti vous lâche', 'Le Parti ne vous suit plus : motions de défiance, militants qui rendent leur carte, investitures qui vous échappent.', [
      { id: 'congres', label: 'Réunir les militants et s’expliquer', effects: [st('energy', -12), { kind: 'cohesion', delta: 6 }, st('politicalCapital', -8)], outcome: 'Une longue soirée de congrès. Quelques ponts reconstruits.' },
      { id: 'cavalier', label: 'Faire cavalier seul', effects: [st('influence', 2), { kind: 'cohesion', delta: -8 }, st('politicalCapital', -10)], outcome: 'Vous voilà libre — et seul·e.' },
    ]],
    high: ['L’homme ou la femme d’appareil', 'Le Parti vous doit tout et vous lui devez tout : pour le pays, vous n’êtes plus qu’un rouage de la machine.', [
      { id: 'liberte', label: 'Prendre ses distances avec la ligne', effects: [{ kind: 'cohesion', delta: -5 }, st('popularity', 2), st('credibility', 2)], outcome: 'Un discours libre, applaudi dehors, sifflé dedans.' },
      { id: 'assumer', label: 'Assumer : le collectif avant tout', effects: [st('popularity', -6), { kind: 'segment', segment: 'jeunes', delta: -4 }, st('politicalCapital', 6)], outcome: 'Le parti est solide. Les jeunes décrochent.' },
    ]],
  },
  medias: {
    low: ['Le boycott des médias', 'Les Médias vous ignorent ou vous étrillent : invitations annulées, portraits assassins, micros qui se ferment.', [
      { id: 'interview', label: 'Accorder une grande interview sans condition', effects: [st('stress', 8), st('credibility', 2), { kind: 'momentum', delta: 4 }], outcome: 'Deux heures sur le gril. Vous en ressortez vivant·e.' },
      { id: 'reseaux', label: 'Passer par les réseaux, sans intermédiaires', effects: [{ kind: 'segment', segment: 'jeunes', delta: 3 }, st('credibility', -4)], outcome: 'Vos vidéos font des vues. Les rédactions vous en veulent encore plus.' },
    ]],
    high: ['La connivence', 'Les Médias vous mangent dans la main… et le public s’en aperçoit. On parle de complaisance, de dîners en ville, de connivence.', [
      { id: 'distance', label: 'Refuser les dîners en ville', effects: [{ kind: 'momentum', delta: -6 }, st('credibility', 3)], outcome: 'Moins d’articles flatteurs, plus de respect.' },
      { id: 'ignorer', label: 'Ignorer les critiques', effects: [st('credibility', -8), { kind: 'exposure', delta: 8 }], outcome: 'Un livre-enquête sur vos amitiés de presse sort au printemps.' },
    ]],
  },
  puissants: {
    low: ['La fuite des capitaux', 'Les Puissants vous tournent le dos : investissements gelés, sièges sociaux qui menacent de partir, donateurs qui disparaissent.', [
      { id: 'rassurer', label: 'Recevoir les grands patrons', effects: [st('politicalCapital', -8), { kind: 'economy', confidence: 3 }, { kind: 'segment', segment: 'populaires', delta: -2 }], outcome: 'Un déjeuner, des promesses. Le calme revient sur les marchés.' },
      { id: 'tenir', label: 'Assumer la rupture', effects: [{ kind: 'economy', confidence: -4, growth: -0.2 }, { kind: 'funds', account: 'campaign', delta: -3000 }, { kind: 'segment', segment: 'populaires', delta: 3 }], outcome: 'Les patrons font grise mine. La base applaudit.' },
    ]],
    high: ['La marionnette des lobbies', 'Les Puissants vous adorent — un peu trop : on vous dit à la solde des lobbies, on publie vos agendas.', [
      { id: 'registre', label: 'Publier tous vos rendez-vous', effects: [st('credibility', 3), { kind: 'exposure', delta: -6 }, st('influence', -3)], outcome: 'La transparence coupe court aux soupçons.' },
      { id: 'nier', label: 'Nier toute influence', effects: [st('credibility', -8), { kind: 'exposure', delta: 12 }, { kind: 'segment', segment: 'populaires', delta: -5 }], outcome: 'L’enquête suivante est encore plus documentée.' },
    ]],
  },
};

function fallDecision(d: GameState, p: Pillar, high: boolean): Decision {
  const [title, context, choices] = FALLS[p][high ? 'high' : 'low'];
  return { id: nextId(d, 'dec'), tag: `chute_${p}`, week: d.week, deadlineWeek: d.week + 1, source: 'evenement', title, context, choices };
}

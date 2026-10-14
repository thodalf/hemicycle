import { Barometer, ElectionType, GameState, PollDuel, ScheduledElection } from '../models/game.models';
import { rankOrder } from '../data/ranks';
import { youngPartyMalus } from './founding';
import { programReport } from './programme';
import { partySupport, pushNews } from './effects';
import { addParrainages, incumbentBonus, presidentialRivals } from './presidency';
import { Rng, clamp } from './rng';
import { localBonus } from './territory';
import { circoBonus, econBonus, segmentBonus } from './country';
import { imageBonus, quoteBonus } from './legacy';

/* ============================================================
 *  Intentions de vote : le score d'un·e candidat·e, les parts
 *  de voix, et le baromètre présidentiel qui démarre dix-huit
 *  mois avant le scrutin (premier tour + hypothèses de second
 *  tour). Les sondages se trompent un peu : marge ±2,5 pts.
 * ============================================================ */

export const BAROMETER_MONTHS = 18;
const POLLSTERS = ['Institut Quorum', 'Opinéa', 'Vox Populi Études', 'Sigma Opinion', 'Baromètre Marianne', 'Institut Hémisphère'];

/** Score brut (avant normalisation) d'un·e candidat·e. `bonus` : coup de pouce d'entre-deux-tours */
export function candidateScore(d: GameState, id: string, type: ElectionType, bonus = 0): number {
  const center = type === 'primaire' ? d.party.position : 0;
  const penalty = (pos: number) => Math.abs(pos - center) * 0.1;
  if (id === 'player') {
    const s = d.player.stats;
    const base = type === 'primaire'
      ? partySupport(d) * 0.6 + s.popularity * 0.3 + s.influence * 0.2
      : s.popularity * 0.55 + s.influence * 0.2 + s.credibility * 0.2;
    // Le programme ne compte qu'une fois la campagne ouverte (sans programme : malus)
    const campaign = d.elections.some(e => !e.resolved && e.type === 'presidentielle' && d.week >= e.campaignStartWeek);
    const program = type !== 'presidentielle' ? 0
      : d.program?.validated ? programReport(d).electoralBonus : campaign ? -6 : 0;
    const incumbent = type === 'presidentielle' ? incumbentBonus(d, 'player') : 0;
    const local = type === 'municipales' || type === 'legislatives' ? localBonus(d) : 0;
    const country = econBonus(d, type) + segmentBonus(d, type) + circoBonus(d, type) + imageBonus(d, type) + quoteBonus(d, type);
    return country + base + d.player.momentum * 0.35 + 5 - penalty(d.player.stance) + program + incumbent - (type === 'primaire' ? 0 : youngPartyMalus(d)) + bonus + local;
  }
  const npc = d.npcs.find(n => n.id === id);
  if (!npc) return 1;
  const notoriety = type === 'municipales' ? 8 : type === 'legislatives' ? 14 : 22;
  const npcPos = [d.party, ...d.otherParties].find(p => p.id === npc.partyId)?.position ?? 0;
  const incumbent = type === 'presidentielle' ? incumbentBonus(d, id) : 0;
  return npc.popularity * 0.55 + npc.influence * 0.25 + notoriety + incumbent - penalty(npcPos) + bonus;
}

/** Parts de voix (somme 100, une décimale), bruitées */
export function voteShares(d: GameState, type: ElectionType, ids: string[], rng: Rng, noise: number, bonus: Record<string, number> = {}): Record<string, number> {
  const raw = ids.map(id => Math.max(1, Math.pow(Math.max(1, candidateScore(d, id, type, bonus[id] ?? 0)), 2) * rng.range(1 - noise / 20, 1 + noise / 20)));
  const total = raw.reduce((a, b) => a + b, 0);
  return Object.fromEntries(ids.map((id, i) => [id, Math.round((raw[i] / total) * 1000) / 10]));
}

export const ranking = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1]);

/** Le joueur peut-il être « testé » par les sondeurs ? */
function testable(d: GameState): boolean {
  const p = d.player;
  if (d.presidential.declared) return true;
  if (p.flags['retired'] || p.flags['monarchie'] || Number(p.flags['ineligibleUntil'] ?? 0) > d.presidential.nextWeek) return false;
  if (d.presidency) return d.presidency.mandates < 2;
  return p.stats.popularity >= 12 && (rankOrder(p.rankId) >= rankOrder('depute') || d.party.leaderNpcId === 'player');
}

/** Un sondage complet : premier tour et duels de second tour */
export function takeBarometer(d: GameState, rng: Rng, ids: string[], hypothetical: boolean, noise = 2.5): Barometer {
  const results = voteShares(d, 'presidentielle', ids, rng, noise);
  const top = ranking(results).map(([id]) => id);
  const duels: PollDuel[] = [];
  const duel = (a: string, b: string) => duels.push({ a, b, results: voteShares(d, 'presidentielle', [a, b], rng, noise) });
  if (top.length >= 2) duel(top[0], top[1]);
  // Hors du duel de tête : « et si vous étiez au second tour ? »
  if (ids.includes('player') && top.indexOf('player') >= 2) duel('player', top[0]);
  else if (top[0] === 'player' && top.length >= 3) duel('player', top[2]);
  else if (top[1] === 'player' && top.length >= 3) duel('player', top[2]);
  return { week: d.week, pollster: rng.pick(POLLSTERS), results, duels, hypothetical };
}

export function pushBarometer(d: GameState, b: Barometer): void {
  const list = (d.presidential.barometer ??= []);
  list.push(b);
  if (list.length > BAROMETER_MONTHS + 8) list.splice(0, list.length - BAROMETER_MONTHS - 8);
}

/** Chaque mois, dans les dix-huit mois qui précèdent la présidentielle (hors campagne officielle) */
export function monthlyBarometer(d: GameState, rng: Rng): void {
  const c = d.presidential;
  if (d.status !== 'en_cours' || d.player.flags['monarchie'] || d.scenario === 'royaute') return;
  const left = c.nextWeek - d.week;
  if (left < 1 || left > BAROMETER_MONTHS) return;
  if (d.elections.some(e => !e.resolved && e.type === 'presidentielle')) return;
  const withPlayer = testable(d);
  const ids = presidentialRivals(d).filter(id => d.npcs.some(n => n.id === id));
  if (withPlayer) ids.unshift('player');
  if (ids.length < 2) return;
  const prev = c.barometer?.at(-1);
  const b = takeBarometer(d, rng, ids, withPlayer && !c.declared);
  pushBarometer(d, b);
  if (!withPlayer) return;

  const f = (v: number) => v.toLocaleString('fr-FR');
  const rank = ranking(b.results).findIndex(([id]) => id === 'player') + 1;
  const me = b.results['player'];
  const before = prev && prev.week >= d.week - 2 ? prev.results['player'] : undefined;
  const delta = before === undefined ? 0 : Math.round((me - before) * 10) / 10;
  const trend = before === undefined ? '' : delta > 0 ? ` (+${f(delta)})` : delta < 0 ? ` (${f(delta)})` : ' (=)';
  const wasQualified = prev ? ranking(prev.results).findIndex(([id]) => id === 'player') < 2 : false;
  if (rank <= 2 && !wasQualified) {
    pushNews(d, 'election', 'positive', 'Sondage : vous seriez qualifié·e pour le second tour',
      `${b.pollster} vous place ${rank === 1 ? 'en tête' : 'deuxième'} avec ${f(me)} %${trend}. Les élus commencent à vous regarder autrement.`);
  } else if (rank > 2 && wasQualified) {
    pushNews(d, 'election', 'negative', 'Sondage : vous sortez du duo de tête', `${b.pollster} : ${f(me)} %${trend}, ${rank}e position.`);
  } else if (left % 3 === 0 || Math.abs(delta) >= 3) {
    pushNews(d, 'election', delta < 0 ? 'negative' : 'neutral', `Sondage ${b.pollster} : ${f(me)} %${trend}`,
      `Intentions de vote pour la présidentielle : ${rank}e position${b.hypothetical ? ' (candidature testée, non déclarée)' : ''}.`);
  }
  // Les sondages font les parrainages, et un peu l'influence
  if (c.declared && me >= 15) addParrainages(d, Math.round(me * 0.8));
  if (rank === 1) d.player.stats.influence = clamp(d.player.stats.influence + 1);
  if (rank > 3 && me < 6 && c.declared) d.player.stats.stress = clamp(d.player.stats.stress + 2);
}

/** Dernier baromètre utile pour l'affichage */
export function latestBarometer(d: GameState): Barometer | null {
  const b = d.presidential.barometer?.at(-1);
  return b && d.week - b.week <= 2 ? b : null;
}

export function isSecondRoundPending(e: ScheduledElection | undefined | null): boolean {
  return !!e && !e.resolved && !!e.secondRoundWeek;
}

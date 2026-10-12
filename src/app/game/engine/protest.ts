import {
  Effect, FactionId, GameState, ProtestCause, ProtestChoice, ProtestDelta, ProtestEvent, ProtestState,
} from '../models/game.models';
import { CAUSES, CORTEGE, DISCOURS, INCIDENTS, MOBILISATION } from '../data/protest';
import { rankOrder } from '../data/ranks';
import { availableFunds, spend } from './effects';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Manifestation : préparation puis quatre étapes à choix.
 *  Jauges : affluence, tension (débordements à 80), couverture
 *  médiatique, image dans l'opinion.
 * ============================================================ */

const SCALE_BASE = { locale: 2000, nationale: 50000 };
const OVERFLOW_AT = 80;

export function createProtest(d: GameState, rng: Rng): ProtestState {
  const shuffled = CAUSES.map(c => ({ c, k: rng.next() })).sort((a, b) => a.k - b.k).map(x => x.c);
  const options: ProtestCause[] = [];
  const agenda = shuffled.find(c => c.domain === d.agendaDomain);
  if (agenda) options.push(agenda);
  for (const lean of [-1, 1, 0] as const) {
    const c = shuffled.find(x => x.lean === lean && !options.includes(x));
    if (c) options.push(c);
  }
  for (const c of shuffled) if (options.length < 4 && !options.includes(c)) options.push(c);

  return {
    id: nextId(d, 'manif'),
    phase: 'preparation',
    scale: 'locale',
    causeOptions: options.slice(0, 4),
    cause: null,
    allies: [],
    turnout: 0, target: 0, tension: 20, media: 20, image: 0, stanceMult: 1,
    overflow: false, event: null, usedEvents: [], log: [],
    status: 'en_cours', organizers: 0, police: 0, rewardSummary: [],
  };
}

export function canGoNational(d: GameState): boolean {
  return rankOrder(d.player.rankId) >= rankOrder('depute');
}

/** Alliés possibles : syndicats et associations, plus les lobbies du domaine de la cause */
export function allyCandidates(d: GameState, p: ProtestState) {
  return d.contacts.filter(c => c.type === 'syndicat' || c.type === 'association'
    || (p.cause && c.domain === p.cause.domain && c.type !== 'journaliste'));
}

/** Affluence attendue avant les aléas (affichée pendant la préparation) */
export function expectedTurnout(p: ProtestState, d: GameState): { expected: number; target: number } {
  // Plus on monte, plus on attend du monde dans la rue : l'objectif grimpe avec le rang
  const base = SCALE_BASE[p.scale];
  const target = Math.round(base * (1 + 0.35 * rankOrder(d.player.rankId)) / 100) * 100;
  if (!p.cause) return { expected: 0, target };
  const allies = d.contacts.filter(c => p.allies.includes(c.id));
  const allyBoost = allies.reduce((s, c) => s + c.trust / 250 + (c.domain === p.cause!.domain ? 0.12 : 0), 0);
  const factor = (0.55 + d.player.stats.popularity / 60)
    * (p.cause.domain === d.agendaDomain ? 1.3 : 1)
    * (1 + allyBoost);
  return { expected: Math.round(base * factor), target };
}

export function launchProtest(p: ProtestState, d: GameState, rng: Rng): void {
  if (!p.cause || p.phase !== 'preparation') return;
  const { expected, target } = expectedTurnout(p, d);
  p.target = target;
  p.turnout = Math.round(expected * rng.range(0.85, 1.1));
  p.tension = 20 + (p.cause.lean !== 0 ? 5 : 0);
  p.media = clamp(15 + d.player.stats.influence / 5 + (p.scale === 'nationale' ? 15 : 0));
  p.image = 0;
  p.phase = 'mobilisation';
  p.event = MOBILISATION;
}

export function choiceAvailable(p: ProtestState, d: GameState, c: ProtestChoice): boolean {
  if (c.requires?.ally && p.allies.length === 0) return false;
  if (c.requires?.minMastery !== undefined && p.cause && d.player.dossiers[p.cause.domain].mastery < c.requires.minMastery) return false;
  if (c.delta.money && availableFunds(d) < c.delta.money) return false;
  return true;
}

export function failChance(p: ProtestState, d: GameState, c: ProtestChoice): number | null {
  if (!c.risk) return null;
  const value = c.risk.scaleWith === 'dossier'
    ? (p.cause ? d.player.dossiers[p.cause.domain].mastery : 0)
    : c.risk.scaleWith ? d.player.stats[c.risk.scaleWith] : 0;
  return clamp(c.risk.chance * (1 - (c.risk.weight ?? 0) * value / 100), 0.05, 0.95);
}

function applyDelta(p: ProtestState, d: GameState, delta: ProtestDelta): void {
  if (delta.turnout) p.turnout = Math.max(50, Math.round(p.turnout * (1 + delta.turnout / 100)));
  if (delta.tension) p.tension = clamp(p.tension + delta.tension);
  if (delta.media) p.media = clamp(p.media + delta.media);
  if (delta.image) p.image = clamp(p.image + delta.image, -50, 50);
  if (delta.money) spend(d, delta.money);
  if (delta.stance !== undefined) p.stanceMult = delta.stance;
}

function nextEvent(pool: ProtestEvent[], p: ProtestState, rng: Rng): ProtestEvent {
  const fresh = pool.filter(e => !p.usedEvents.includes(e.id));
  return rng.pick(fresh.length ? fresh : pool);
}

export function chooseProtest(p: ProtestState, d: GameState, rng: Rng, choiceId: string): void {
  const event = p.event;
  const choice = event?.choices.find(c => c.id === choiceId);
  if (!event || !choice || p.status !== 'en_cours' || !choiceAvailable(p, d, choice)) return;

  const chance = failChance(p, d, choice);
  const failed = chance !== null && rng.chance(chance);
  if (failed) {
    applyDelta(p, d, { ...choice.risk!.onFail, money: choice.delta.money, stance: choice.delta.stance });
  } else {
    applyDelta(p, d, choice.delta);
  }
  p.log.push({
    phase: event.phase, choice: choice.label,
    text: failed ? choice.risk!.failText : choice.text,
    tone: failed ? 'negative' : 'positive',
  });
  p.usedEvents.push(event.id);

  if (p.tension >= OVERFLOW_AT && !p.overflow) {
    p.overflow = true;
    p.image = clamp(p.image - 15, -50, 50);
    p.media = clamp(p.media + 15);
    p.log.push({ phase: event.phase, choice: 'Débordements', text: 'Heurts en marge du cortège : les images de violences font l’ouverture des journaux.', tone: 'negative' });
  }

  switch (event.phase) {
    case 'mobilisation': p.phase = 'cortege'; p.event = nextEvent(CORTEGE, p, rng); break;
    case 'cortege': p.phase = 'incident'; p.event = nextEvent(INCIDENTS, p, rng); break;
    case 'incident': p.phase = 'discours'; p.event = DISCOURS; break;
    default: finish(p, d, rng);
  }
}

export function protestScore(p: ProtestState): number {
  const ratio = p.target ? Math.min(2, p.turnout / p.target) : 0;
  return Math.round(ratio * 35 + p.media * 0.2 + p.image * 0.4 - (p.overflow ? 20 : 0));
}

function finish(p: ProtestState, d: GameState, rng: Rng): void {
  p.phase = 'bilan';
  p.event = null;
  const score = protestScore(p);
  p.status = score >= 68 ? 'succes' : score >= 45 ? 'mitige' : 'echec';
  p.organizers = Math.round(p.turnout * rng.range(1.4, 1.8) / 100) * 100;
  p.police = Math.round(p.turnout * rng.range(0.45, 0.6) / 100) * 100;
}

/** Conséquences, appliquées par le service une fois la manifestation terminée */
export function protestRewards(p: ProtestState, d: GameState): Effect[] {
  const cause = p.cause!;
  const nat = p.scale === 'nationale';
  const effects: Effect[] = [{ kind: 'stat', stat: 'energy', delta: -10 }];
  switch (p.status) {
    case 'succes':
      effects.push(
        { kind: 'stat', stat: 'popularity', delta: nat ? 8 : 5 }, { kind: 'momentum', delta: 12 },
        { kind: 'stat', stat: 'influence', delta: nat ? 5 : 3 }, { kind: 'dossier', domain: cause.domain, delta: 6 },
      );
      break;
    case 'mitige':
      effects.push({ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'momentum', delta: 4 }, { kind: 'dossier', domain: cause.domain, delta: 4 });
      break;
    default:
      effects.push({ kind: 'stat', stat: 'popularity', delta: -3 }, { kind: 'stat', stat: 'credibility', delta: -2 }, { kind: 'stat', stat: 'stress', delta: 8 });
  }
  if (p.overflow) effects.push({ kind: 'exposure', delta: 8 }, { kind: 'stat', stat: 'credibility', delta: -3 });
  if (p.image > 20) effects.push({ kind: 'stat', stat: 'credibility', delta: 2 });
  if (p.image < -15) effects.push({ kind: 'stat', stat: 'popularity', delta: -2 });

  // Positionnement : une cause marquée vous déplace, les courants réagissent
  const shift = cause.lean * 6 * p.stanceMult;
  if (shift) {
    const before = d.player.stance;
    const after = clamp(before + shift, -100, 100);
    effects.push({ kind: 'stance', delta: shift });
    for (const f of d.party.factions) {
      const delta = Math.round(Math.max(-10, Math.min(10, (Math.abs(before - f.position) - Math.abs(after - f.position)) * 0.5)));
      if (delta) effects.push({ kind: 'faction', factionId: f.id as FactionId, delta });
    }
  }
  const trust = { succes: 10, mitige: 4, echec: -5, en_cours: 0 }[p.status];
  for (const id of p.allies) effects.push({ kind: 'contact', contactId: id, trust });
  return effects;
}

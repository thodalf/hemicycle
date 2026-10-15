import { Effect, GameState, SagaState } from '../models/game.models';
import { SAGAS, SAGA_BY_ID, SagaDef } from '../data/saga-defs';
import { addMilestone } from './life';
import { applyEffects, pushNews } from './effects';
import { Rng, clamp, frSigned } from './rng';

/* ============================================================
 *  Les grandes sagas : des scénarios au long cours (plus de dix
 *  mois), dans l'esprit du premier contact ou de l'épidémie Z.
 *  Chaque saga a ses phases, trois jauges (votre camp, la menace,
 *  l'opinion), ses événements, ses actions, son contact, et
 *  plusieurs fins selon l'équilibre des jauges.
 * ============================================================ */

export { SAGAS, SAGA_BY_ID };

export function sagaDef(d: GameState): SagaDef | null {
  return d.saga ? SAGA_BY_ID.get(d.saga.id) ?? null : null;
}

/** La saga est-elle encore en cours (pas encore dénouée) ? */
export function sagaRunning(d: GameState): boolean {
  const def = sagaDef(d);
  return !!def && !!d.saga && d.saga.phase < def.phases.length;
}

export function startSaga(d: GameState, id: string): string[] {
  const def = SAGA_BY_ID.get(id);
  if (!def || d.saga) return [];
  d.saga = { id, since: d.week, phase: 0, phaseSince: d.week, ...def.start };
  d.player.flags[`saga_${id}`] = true;
  pushNews(d, 'actu', 'negative', `${def.label} : ${def.phases[0].name.charAt(0).toLowerCase()}${def.phases[0].name.slice(1)}`, def.phases[0].text);
  addMilestone(d, 'carriere', def.label, def.startMilestone);
  return [`${def.label} : nouvel onglet « ${def.tab} »`];
}

export function adjustSaga(d: GameState, e: Extract<Effect, { kind: 'saga' }>): string[] {
  if (e.start) return startSaga(d, e.start);
  const def = sagaDef(d);
  const s = d.saga;
  if (!def || !s || s.phase >= def.phases.length) return [];
  const out: string[] = [];
  for (const k of ['a', 'b', 'c'] as const) {
    const delta = e[k];
    if (!delta) continue;
    s[k] = clamp(s[k] + delta);
    out.push(`${def.gauges[k].label} ${frSigned(delta)}`);
  }
  return out;
}

/** Chaque mois : la menace avance, les phases s'enchaînent, la saga se dénoue */
export function monthlySaga(d: GameState, rng: Rng): void {
  const def = sagaDef(d);
  const s = d.saga;
  if (!def || !s || s.phase >= def.phases.length) return;
  const ph = def.phases[s.phase];
  for (const k of ['a', 'b', 'c'] as const) {
    const drift = ph.drift[k] ?? 0;
    if (drift) s[k] = clamp(s[k] + drift * rng.range(0.6, 1.3));
  }
  // La menace pèse sur le pays
  d.player.stats.stress = clamp(d.player.stats.stress + s.b / 80);
  if (d.economy) d.economy.confidence = clamp(d.economy.confidence - s.b / 120);
  // Fin anticipée possible, mais jamais avant dix mois : une saga se vit dans la durée
  const early = d.week - s.since >= 10 ? def.earlyEnd?.(s) : null;
  if (early) return finishSaga(d, s, def, early, rng);
  if (d.week - s.phaseSince >= ph.months) {
    if (s.phase + 1 >= def.phases.length) return finishSaga(d, s, def, def.resolve(s), rng);
    s.phase += 1;
    s.phaseSince = d.week;
    const next = def.phases[s.phase];
    pushNews(d, 'actu', 'negative', `${def.label} : ${next.name.charAt(0).toLowerCase()}${next.name.slice(1)}`, next.text);
  }
}

function finishSaga(d: GameState, s: SagaState, def: SagaDef, outcomeId: string, rng: Rng): void {
  const o = def.outcomes[outcomeId];
  s.outcome = outcomeId;
  s.phase = def.phases.length;
  s.phaseSince = d.week;
  const summary = applyEffects(d, o.effects, {}, rng);
  addMilestone(d, o.tone === 'positive' ? 'victoire' : o.tone === 'negative' ? 'revers' : 'carriere', o.title, o.text);
  pushNews(d, 'actu', o.tone, o.title, `${o.text} ${summary.join(' · ')}`.trim());
}

/** Ranger une saga terminée */
export function closeSaga(d: GameState): void {
  if (!d.saga) return;
  (d.sagasDone ??= []).push(d.saga.id);
  d.saga = null;
}

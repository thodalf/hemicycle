import { DOMAIN_LABELS, GameState, SceneState } from '../models/game.models';
import { SceneChoiceDef, SceneDef, SceneStepDef } from '../data/scene-types';
import { SCENES_BY_ID } from '../data/scenes';
import { availableFunds, spend } from './effects';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Moteur générique des scènes interactives.
 * ============================================================ */

export function sceneDef(state: SceneState | null): SceneDef | null {
  return state ? SCENES_BY_ID.get(state.defId) ?? null : null;
}

export function sceneStep(state: SceneState): SceneStepDef | null {
  const def = sceneDef(state);
  return def?.steps.find(s => s.id === state.stepId) ?? null;
}

/** Remplace {domaine} et les variables tirées au lancement */
export function fill(text: string, state: SceneState): string {
  return text
    .replace(/\{domaine\}/g, DOMAIN_LABELS[state.domain].toLowerCase())
    .replace(/\{(\w+)\}/g, (m, k) => state.vars[k] ?? m);
}

function pickStep(def: SceneDef, state: SceneState, rng: Rng, forced?: string): string {
  if (forced) return forced;
  const pool = def.stages[state.stage];
  const fresh = pool.filter(id => !state.usedSteps.includes(id));
  return rng.pick(fresh.length ? fresh : pool);
}

export function createScene(d: GameState, rng: Rng, defId: string): SceneState | null {
  const def = SCENES_BY_ID.get(defId);
  if (!def) return null;
  const gauges = Object.fromEntries(def.gauges.map(g => [g.id, clamp(typeof g.start === 'function' ? g.start(d) : g.start, g.min, g.max)]));
  const state: SceneState = {
    id: nextId(d, 'scene'),
    defId,
    stage: 0,
    stepId: null,
    gauges,
    vars: def.setup ? def.setup(d, items => rng.pick(items)) : {},
    domain: def.domain === 'agenda' ? d.agendaDomain : def.domain,
    usedSteps: [],
    triggered: [],
    log: [],
    status: 'en_cours',
    score: 0,
    rewardSummary: [],
  };
  state.stepId = pickStep(def, state, rng);
  return state;
}

export function choiceAvailable(state: SceneState, d: GameState, c: SceneChoiceDef): boolean {
  const r = c.requires;
  if (r?.minMastery !== undefined && d.player.dossiers[state.domain].mastery < r.minMastery) return false;
  if (r?.stat && r.minStat !== undefined && d.player.stats[r.stat] < r.minStat) return false;
  if (c.money && availableFunds(d) < c.money) return false;
  return true;
}

export function unavailableReason(state: SceneState, d: GameState, c: SceneChoiceDef): string {
  const r = c.requires;
  if (r?.minMastery !== undefined && d.player.dossiers[state.domain].mastery < r.minMastery) return `Dossier < ${r.minMastery}`;
  if (r?.stat && r.minStat !== undefined && d.player.stats[r.stat] < r.minStat) return `Stat < ${r.minStat}`;
  return 'Fonds insuffisants';
}

export function failChance(state: SceneState, d: GameState, c: SceneChoiceDef): number | null {
  if (!c.risk) return null;
  const value = c.risk.scaleWith === 'dossier'
    ? d.player.dossiers[state.domain].mastery
    : c.risk.scaleWith ? d.player.stats[c.risk.scaleWith] : 0;
  return clamp(c.risk.chance * (1 - (c.risk.weight ?? 0) * value / 100), 0.05, 0.95);
}

function apply(def: SceneDef, state: SceneState, delta: Record<string, number>): void {
  for (const [k, v] of Object.entries(delta)) {
    const g = def.gauges.find(x => x.id === k);
    if (g) state.gauges[k] = clamp(state.gauges[k] + v, g.min, g.max);
  }
}

/** Seuils critiques : renvoie true si la scène doit s'arrêter */
function checkDangers(def: SceneDef, state: SceneState, step: string): boolean {
  for (const g of def.gauges) {
    const dz = g.danger;
    if (!dz || state.triggered.includes(g.id)) continue;
    const v = state.gauges[g.id];
    const hit = (dz.below !== undefined && v <= dz.below) || (dz.above !== undefined && v >= dz.above);
    if (!hit) continue;
    state.triggered.push(g.id);
    if (dz.delta) apply(def, state, dz.delta);
    state.log.push({ step, choice: dz.label, text: fill(dz.text, state), tone: 'negative' });
    if (dz.end) {
      state.brokenBy = dz.label;
      return true;
    }
  }
  return false;
}

export function chooseScene(state: SceneState, d: GameState, rng: Rng, choiceId: string): void {
  const def = sceneDef(state);
  const step = sceneStep(state);
  const choice = step?.choices.find(c => c.id === choiceId);
  if (!def || !step || !choice || state.status !== 'en_cours' || !choiceAvailable(state, d, choice)) return;

  if (choice.money) spend(d, choice.money);
  const chance = failChance(state, d, choice);
  const failed = chance !== null && rng.chance(chance);
  apply(def, state, failed ? choice.risk!.onFail : choice.delta);
  state.log.push({
    step: fill(step.title, state), choice: choice.label,
    text: fill(failed ? choice.risk!.failText : choice.text, state),
    tone: failed ? 'negative' : 'positive',
  });
  state.usedSteps.push(step.id);

  if (checkDangers(def, state, fill(step.title, state))) return finish(def, state, true);
  state.stage += 1;
  if (state.stage >= def.stages.length) return finish(def, state, false);
  state.stepId = pickStep(def, state, rng, failed ? undefined : choice.next);
}

function finish(def: SceneDef, state: SceneState, broken: boolean): void {
  state.stepId = null;
  state.score = Math.round(def.score(state.gauges));
  state.status = broken ? 'echec'
    : state.score >= def.thresholds.succes ? 'succes'
    : state.score >= def.thresholds.mitige ? 'mitige' : 'echec';
}

/** Aperçu des effets d'un choix, avec le libellé des jauges */
export function previewDelta(def: SceneDef, delta: Record<string, number>): { label: string; value: number; good: boolean }[] {
  return Object.entries(delta).flatMap(([k, v]) => {
    const g = def.gauges.find(x => x.id === k);
    if (!g || !v) return [];
    return [{ label: g.label, value: v, good: g.good === 'high' ? v > 0 : v < 0 }];
  });
}

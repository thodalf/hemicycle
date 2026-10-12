import { ProtestEvent } from '../models/game.models';
import { SceneChoiceDef, SceneDef } from './scene-types';

/* ============================================================
 *  Équilibrage automatique des choix des scènes interactives
 *  et des manifestations.
 *
 *  Règles, étape par étape :
 *   1. Tout choix a un prix : ses pertes valent au moins la
 *      moitié de ses gains (malus ajouté sur une jauge qu'il ne
 *      sert pas, de préférence la jauge « danger »).
 *   2. Pas de choix dominant : la valeur nette de chaque choix
 *      reste proche de la moyenne de l'étape. Un choix trop
 *      rentable reçoit un malus plus lourd ; un choix trop faible
 *      voit son atout principal renforcé.
 *  Les choix se distinguent donc par leur profil (ce qu'on gagne,
 *  ce qu'on sacrifie, le risque), pas par leur rentabilité.
 * ============================================================ */

interface Axis {
  id: string;
  /** Valeur d'un point dans le score */
  w: number;
  good: 'high' | 'low';
  danger: boolean;
  /** Plafond d'un malus ajouté, en points */
  cap: number;
}

type Delta = Record<string, number>;

interface Opt {
  delta: Delta;
  money: number;
  risk?: { chance: number; weight?: number; onFail: Delta };
}

const MIN_LOSS_RATIO = 0.4;
const HIGH = 1.25;
const LOW = 0.7;

function split(delta: Delta, axes: Axis[]): { gain: number; loss: number } {
  let gain = 0, loss = 0;
  for (const a of axes) {
    const v = delta[a.id];
    if (!v) continue;
    const favorable = a.good === 'high' ? v > 0 : v < 0;
    if (favorable) gain += Math.abs(v) * a.w; else loss += Math.abs(v) * a.w;
  }
  return { gain, loss };
}

function failP(o: Opt): number {
  return o.risk ? Math.min(0.9, o.risk.chance * (1 - (o.risk.weight ?? 0) * 0.3)) : 0;
}

function evaluate(o: Opt, axes: Axis[], moneyW: number): { gain: number; loss: number; net: number } {
  const p = failP(o);
  const ok = split(o.delta, axes);
  const ko = o.risk ? split(o.risk.onFail, axes) : { gain: 0, loss: 0 };
  const gain = (1 - p) * ok.gain + p * ko.gain;
  const loss = (1 - p) * ok.loss + p * ko.loss + o.money * moneyW;
  return { gain, loss, net: gain - loss };
}

/** Jauge sur laquelle poser le malus : d'abord une jauge « danger » que le choix ne sert pas */
function malusAxis(o: Opt, axes: Axis[]): Axis {
  const untouchedOrBad = axes.filter(a => {
    const v = o.delta[a.id] ?? 0;
    return a.good === 'high' ? v <= 0 : v >= 0;
  });
  const pool = untouchedOrBad.length ? untouchedOrBad : axes;
  // La jauge « danger » d'abord, puis celle qui pèse le plus (malus plus court, plus lisible)
  return [...pool].sort((a, b) => Number(b.danger) - Number(a.danger) || b.w - a.w)[0];
}

function addMalus(o: Opt, axis: Axis, points: number): void {
  const n = Math.max(1, Math.min(axis.cap, Math.round(points)));
  const sign = axis.good === 'high' ? -1 : 1;
  o.delta = { ...o.delta, [axis.id]: (o.delta[axis.id] ?? 0) + sign * n };
}

function boostMain(o: Opt, axes: Axis[], points: number): void {
  const fav = axes
    .filter(a => { const v = o.delta[a.id] ?? 0; return a.good === 'high' ? v > 0 : v < 0; })
    .sort((a, b) => Math.abs(o.delta[b.id]) * b.w - Math.abs(o.delta[a.id]) * a.w)[0];
  if (!fav) return;
  const n = Math.max(1, Math.min(fav.cap, Math.round(points / fav.w)));
  o.delta = { ...o.delta, [fav.id]: o.delta[fav.id] + (fav.good === 'high' ? n : -n) };
}

function balanceStep(opts: Opt[], axes: Axis[], moneyW: number): void {
  // 1. Tout choix a un prix
  for (const o of opts) {
    const e = evaluate(o, axes, moneyW);
    if (e.gain <= 0 || e.loss >= e.gain * MIN_LOSS_RATIO) continue;
    const axis = malusAxis(o, axes);
    addMalus(o, axis, (e.gain * (MIN_LOSS_RATIO + 0.05) - e.loss) / ((1 - failP(o)) * axis.w));
  }
  // 2. Pas de choix dominant
  const evals = opts.map(o => evaluate(o, axes, moneyW));
  const positive = evals.filter(e => e.gain > 0);
  if (positive.length < 2) return;
  const mean = positive.reduce((s, e) => s + e.net, 0) / positive.length;
  if (mean <= 0) return;
  opts.forEach((o, i) => {
    const e = evals[i];
    if (e.gain <= 0) return;
    const q = 1 - failP(o);
    if (e.net > mean * HIGH) {
      const axis = malusAxis(o, axes);
      addMalus(o, axis, (e.net - mean * (HIGH - 0.1)) / (q * axis.w));
    } else if (e.net < mean * LOW) {
      boostMain(o, axes, (mean * (LOW + 0.1) - e.net) / q);
    }
  });
}

/** Valeur d'un point de chaque jauge : pente du score autour du milieu des jauges */
function sceneAxes(def: SceneDef): Axis[] {
  const mid = Object.fromEntries(def.gauges.map(g => [g.id, (g.min + g.max) / 2]));
  return def.gauges.map(g => {
    const up = def.score({ ...mid, [g.id]: mid[g.id] + 5 });
    const down = def.score({ ...mid, [g.id]: mid[g.id] - 5 });
    const slope = Math.abs(up - down) / 10;
    return {
      id: g.id, good: g.good, danger: !!g.danger,
      w: Math.max(slope, g.danger ? 0.35 : 0.2),
      cap: Math.round((g.max - g.min) * 0.15),
    };
  });
}

/** Seuils recalibrés après équilibrage (simulations : un joueur attentif réussit
 * environ 4 fois sur 10 et échoue rarement ; un joueur au hasard échoue souvent) */
const THRESHOLDS: Record<string, { succes: number; mitige: number }> = {
  marche: { succes: 36, mitige: 24 },
  meeting: { succes: 61, mitige: 48 },
  mediation: { succes: 65, mitige: 53 },
  commission: { succes: 58, mitige: 48 },
  crise: { succes: 52, mitige: 36 },
  alliance: { succes: 55, mitige: 42 },
  marche_public: { succes: 50, mitige: 40 },
  tournee_prince: { succes: 34, mitige: 24 },
  referendum: { succes: 51, mitige: 36 },
  coup: { succes: 15, mitige: 9 },
  tenue: { succes: 37, mitige: 30 },
  convent: { succes: 55, mitige: 50 },
  enquete: { succes: 44, mitige: 35 },
  direct: { succes: 62, mitige: 51 },
  bureau_secret: { succes: 21, mitige: 8 },
  deballage: { succes: 33, mitige: 29 },
  salon_agriculture: { succes: 27, mitige: 10 },
  porte_a_porte: { succes: 37, mitige: 24 },
  conference_presse_scene: { succes: 26, mitige: 15 },
  visite_usine: { succes: 22, mitige: 12 },
  qag_scene: { succes: 40, mitige: 26 },
  live_reseaux: { succes: 22, mitige: 11 },
  promo_livre: { succes: 29, mitige: 22 },
};

export function balanceScene(def: SceneDef): SceneDef {
  const axes = sceneAxes(def);
  // 1 000 € dépensés valent environ 3 points de score
  const moneyW = 0.003;
  return {
    ...def,
    thresholds: THRESHOLDS[def.id] ?? def.thresholds,
    steps: def.steps.map(step => {
      const opts: Opt[] = step.choices.map(c => ({ delta: { ...c.delta }, money: c.money ?? 0, risk: c.risk && { chance: c.risk.chance, weight: c.risk.weight, onFail: c.risk.onFail } }));
      balanceStep(opts, axes, moneyW);
      return { ...step, choices: step.choices.map((c, i): SceneChoiceDef => ({ ...c, delta: opts[i].delta })) };
    }),
  };
}

const PROTEST_AXES: Axis[] = [
  { id: 'turnout', w: 0.45, good: 'high', danger: false, cap: 15 },
  { id: 'media', w: 0.45, good: 'high', danger: false, cap: 12 },
  { id: 'image', w: 0.8, good: 'high', danger: false, cap: 10 },
  { id: 'tension', w: 0.55, good: 'low', danger: true, cap: 15 },
];

export function balanceProtest(ev: ProtestEvent): ProtestEvent {
  const opts: Opt[] = ev.choices.map(c => {
    const { money, stance: _s, ...gauges } = c.delta;
    return { delta: gauges as Delta, money: money ?? 0, risk: c.risk && { chance: c.risk.chance, weight: c.risk.weight, onFail: c.risk.onFail as Delta } };
  });
  balanceStep(opts, PROTEST_AXES, 0.004);
  return {
    ...ev,
    choices: ev.choices.map((c, i) => ({ ...c, delta: { ...c.delta, ...opts[i].delta } })),
  };
}

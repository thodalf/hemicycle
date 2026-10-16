import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/* ============================================================
 *  La cellule de crise : un vrai jeu de gestion de catastrophe
 *  au tour par tour. Sur une carte de 9 × 7 cases, le sinistre
 *  progresse à chaque fin de tour selon des règles visibles
 *  (automate cellulaire). Le joueur dépense ses points d’action
 *  (PA) et quelques moyens rares, puis regarde la propagation.
 *  Trois variantes : méga-feux, crue, épidémie.
 *  Toute la simulation est dans des fonctions pures (classe
 *  CelluleSim), testable hors d’Angular.
 * ============================================================ */

export type Variant = 'feux' | 'crue' | 'epidemie';
export type Terrain =
  | 'foret' | 'garrigue' | 'prairie' | 'roche' | 'route' | 'lac' | 'village' | 'coupe'
  | 'riviere' | 'terre' | 'bois' | 'champ' | 'bassin' | 'ville'
  | 'quartier' | 'centre' | 'parc' | 'gare';
export type ToolId = 'pompiers' | 'canadair' | 'coupefeu' | 'evac' | 'digue' | 'pompe' | 'bassin' | 'tests' | 'vaccin' | 'confine' | 'hopital';

export const W = 9, H = 7, N = W * H;

export interface ToolDef { id: ToolId; icon: string; name: string; cost: number; limited?: boolean; desc: string }

export const TOOLS: Record<ToolId, ToolDef> = {
  pompiers: { id: 'pompiers', icon: '🚒', name: 'Pompiers', cost: 1, desc: 'Retirent un tour de feu à la case (un feu de forêt neuf demande deux passages) et arrosent ses quatre voisines : au prochain tour, elles s’embrasent bien moins.' },
  canadair: { id: 'canadair', icon: '✈️', name: 'Canadair', cost: 1, limited: true, desc: 'Largage sur trois cases dans le sens du vent, à partir de la case visée : le feu y est éteint, le reste est protégé deux tours.' },
  coupefeu: { id: 'coupefeu', icon: '🪓', name: 'Coupe-feu', cost: 1, desc: 'Débroussaille une case intacte (forêt, garrigue, prairie) : elle ne brûlera plus.' },
  evac: { id: 'evac', icon: '🚌', name: 'Évacuer', cost: 2, desc: 'Met les habitants à l’abri : si la ville est touchée, seuls les dégâts matériels comptent (35 %).' },
  digue: { id: 'digue', icon: '🧱', name: 'Digue', cost: 2, desc: 'Sacs de sable : la case gagne 2 m, sur une case encore sèche. Si l’eau passe par-dessus, la digue cède.' },
  pompe: { id: 'pompe', icon: '⛽', name: 'Pompes', cost: 1, desc: 'La case gagne 1 m pour ce tour, et s’assèche aussitôt si cela suffit.' },
  bassin: { id: 'bassin', icon: '🌾', name: 'Bassin', cost: 1, limited: true, desc: 'Ouvre un champ qui touche l’eau comme bassin de rétention : la cote baisse de 0,5 m. Récolte perdue (−1 popularité).' },
  tests: { id: 'tests', icon: '🧪', name: 'Tests', cost: 1, desc: 'Dépistage massif : révèle la case et ses quatre voisines ; les cas isolés (niveau 1) y sont éteints.' },
  vaccin: { id: 'vaccin', icon: '💉', name: 'Vaccins', cost: 1, desc: 'Centre de vaccination : le district ne peut plus être contaminé (niveau 0 ou 1 seulement).' },
  confine: { id: 'confine', icon: '🔒', name: 'Confiner', cost: 1, desc: 'Deux tours sans contagion entrante ni sortante, ni progression. Coûte 1 point de popularité.' },
  hopital: { id: 'hopital', icon: '🏥', name: 'Hôpital', cost: 1, limited: true, desc: 'Hôpital de campagne : le district baisse de deux niveaux et ne progresse pas au tour suivant.' },
};

export const VARIANT_TOOLS: Record<Variant, ToolId[]> = {
  feux: ['pompiers', 'canadair', 'coupefeu', 'evac'],
  crue: ['digue', 'pompe', 'bassin', 'evac'],
  epidemie: ['tests', 'vaccin', 'confine', 'hopital'],
};

export const TERRAIN_LABEL: Record<Terrain, string> = {
  foret: 'Forêt', garrigue: 'Garrigue', prairie: 'Prairie', roche: 'Rochers', route: 'Route', lac: 'Lac', village: 'Village', coupe: 'Coupe-feu',
  riviere: 'Rivière', terre: 'Terres', bois: 'Bois', champ: 'Champ', bassin: 'Bassin de rétention', ville: 'Ville',
  quartier: 'Quartier', centre: 'Centre-ville', parc: 'Parc', gare: 'Gare',
};

export interface Cell {
  t: Terrain; pop: number; name: string; elev: number;
  /** Feux : > 0 en feu (tours restants), −1 brûlé ou éteint */
  fire: number; wet: number; retard: number;
  /** Crue */
  water: boolean; dike: boolean; pump: number;
  /** Épidémie : niveau 0 à 4 */
  inf: number; hidden: boolean; vax: boolean; lock: number; care: number; line: number;
  evac: boolean;
  /** Habitants perdus (sinistrés, contaminés) */
  lost: number; damaged: boolean; down: boolean;
  /** Premier tour menacé, touché, annoncé dans les prévisions */
  threat: number; hit: number; fc: number;
}

export interface ActionRec { turn: number; tool: ToolId; i: number; area: number[] }

export interface SimState {
  v: Variant; diff: number; seed: number;
  cells: Cell[];
  turn: number; maxTurns: number; ap: number; apMax: number;
  uses: Partial<Record<ToolId, number>>; usesMax: Partial<Record<ToolId, number>>;
  /** Feux : direction vers laquelle souffle le vent (0 N, 1 E, 2 S, 3 O), force 1 ou 2 */
  wind: number; force: number; nextWind: number; nextForce: number;
  /** Crue : cote, hausse prévue à chaque tour, tendance affichée (parfois fausse) */
  level: number; rain: number[]; trend: number[];
  lines: number[][];
  /** Points de popularité perdus (confinements, bassins) */
  malus: number;
  actions: ActionRec[];
  fresh: number[];
  over: boolean;
}

export interface TurnReport { events: string[]; lost: number }
export interface Outcome { score: number; frac: number; saved: number; total: number; intact: number; zones: number; spare: number; malus: number; burnt: number }

export const DIRS: readonly [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const WIND_ARROW = ['↑', '→', '↓', '←'];
/** Le vent porte le nom d’où il vient */
export const WIND_NAME = ['du sud', 'd’ouest', 'du nord', 'd’est'];

export const coord = (i: number): string => 'ABCDEFGHI'[i % W] + (Math.floor(i / W) + 1);
const cx = (i: number) => i % W, cy = (i: number) => Math.floor(i / W);
export const step = (i: number, d: number): number => {
  if (i < 0) return -1;
  const x = cx(i) + DIRS[d][0], y = cy(i) + DIRS[d][1];
  return x < 0 || y < 0 || x >= W || y >= H ? -1 : y * W + x;
};
export const nb4 = (i: number): number[] => [0, 1, 2, 3].map(d => step(i, d)).filter(j => j >= 0);
const cheb = (a: number, b: number) => Math.max(Math.abs(cx(a) - cx(b)), Math.abs(cy(a) - cy(b)));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const fmtPop = (n: number): string => Math.round(n).toLocaleString('fr-FR');
export const shortPop = (n: number): string => n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + 'k' : String(Math.round(n / 10) * 10);

export function variantOf(id: string): Variant {
  return /crue|inond|eaux/.test(id) ? 'crue' : /epid|pandem|virus|grippe/.test(id) ? 'epidemie' : 'feux';
}

/* ── Paramètres des règles ── */

/** down : la case sous le vent ; diag : les deux diagonales sous le vent ; side : les côtés */
const FLAM: Partial<Record<Terrain, { down: number; diag: number; side: number; burn: number }>> = {
  foret: { down: 1, diag: 0.4, side: 0.3, burn: 2 },
  garrigue: { down: 1, diag: 0.45, side: 0.35, burn: 1 },
  prairie: { down: 0.6, diag: 0.25, side: 0.15, burn: 1 },
  village: { down: 0.8, diag: 0.3, side: 0.25, burn: 2 },
};
const UPWIND = 0.06, EMBER = 0.4, WET = 0.55;
/** Une ville évacuée puis touchée : les habitants sont saufs, restent les dégâts matériels */
const EVAC_LOSS = 0.35;
/** Épidémie : contagion selon le niveau de la source, contaminations par tour selon le niveau */
const CONTAGION = [0, 0, 0.45, 0.7, 0.9];
const RATE = [0, 0.02, 0.05, 0.1, 0.16];
const CASE_CAP = 0.8;

const NAMES: Record<Variant, string[]> = {
  feux: ['Saint-Aubin', 'Rochebrune', 'Mirabel', 'Puymorin', 'Castelvieil', 'Sainte-Colombe', 'Beauvallon', 'Bellegarde', 'Fontvieille', 'Montauroux', 'Val-des-Pins', 'Lanvaux'],
  crue: ['Port-Neuf', 'Saint-Roch', 'Bassevelle', 'Moulineaux', 'Rivecourt', 'Varenne-sur-Rive', 'Saint-Pierre-du-Gué', 'Écluzelles', 'Sauleville', 'Villeneuve-les-Prés'],
  epidemie: [],
};

/* ============================================================
 *  Le moteur
 * ============================================================ */

export class CelluleSim {
  s: SimState;

  constructor(v: Variant, diff = 1, seed = 1, state?: SimState) {
    if (state) { this.s = state; return; }
    const usesMax: Partial<Record<ToolId, number>> = v === 'feux' ? { canadair: diff < 0.95 ? 3 : 2 } : v === 'crue' ? { bassin: 2 } : { hopital: diff < 1.2 ? 3 : 2 };
    this.s = {
      v, diff, seed: (seed * 2654435761) >>> 0, cells: [], turn: 1,
      maxTurns: v === 'epidemie' ? 10 : 9,
      apMax: v === 'crue' || (v === 'feux' && diff >= 0.95) ? 3 : 4, ap: 0,
      uses: { ...usesMax }, usesMax,
      wind: 1, force: 1, nextWind: -1, nextForce: 1,
      level: 1, rain: [], trend: [], lines: [], malus: 0, actions: [], fresh: [], over: false,
    };
    this.s.ap = this.s.apMax;
    if (v === 'feux') this.genFeux(); else if (v === 'crue') this.genCrue(); else this.genEpidemie();
    this.markThreats();
  }

  clone(): CelluleSim { return new CelluleSim(this.s.v, this.s.diff, 0, structuredClone(this.s)); }

  rand(): number {
    let t = (this.s.seed = (this.s.seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  private int(n: number): number { return Math.floor(this.rand() * n); }
  private shuffle<T>(a: T[]): T[] { for (let k = a.length - 1; k > 0; k--) { const j = this.int(k + 1); [a[k], a[j]] = [a[j], a[k]]; } return a; }

  private blank(t: Terrain): Cell {
    return { t, pop: 0, name: '', elev: 0, fire: 0, wet: 0, retard: 0, water: false, dike: false, pump: 0, inf: 0, hidden: false, vax: false, lock: 0, care: 0, line: -1,
      evac: false, lost: 0, damaged: false, down: false, threat: 0, hit: 0, fc: 0 };
  }

  get cells(): Cell[] { return this.s.cells; }
  isZone(c: Cell): boolean { return c.pop > 0; }
  isTown(c: Cell): boolean { return c.t === 'village' || c.t === 'ville'; }

  /* ── Génération : méga-feux ── */

  private genFeux(): void {
    const s = this.s;
    s.wind = this.int(4);
    s.force = 1;
    const depth = (i: number) => [H - 1 - cy(i), cx(i), cy(i), W - 1 - cx(i)][s.wind];
    const cells = Array.from({ length: N }, () => this.blank('foret'));
    const blob = (t: Terrain, r: number) => {
      const c0 = this.int(N);
      for (let i = 0; i < N; i++) if (cheb(i, c0) <= r && this.rand() < (cheb(i, c0) === 0 ? 1 : 0.7)) cells[i].t = t;
    };
    for (let k = 0; k < 2; k++) blob('garrigue', 1 + this.int(2));
    blob('prairie', 1);
    // Une route, droite, sur une partie de la carte
    const horiz = this.rand() < 0.5;
    const len = 5 + this.int(3), along = horiz ? W : H, start = this.int(along - len + 1), fixed = horiz ? 1 + this.int(H - 2) : 1 + this.int(W - 2);
    for (let k = start; k < start + len; k++) { const i = horiz ? fixed * W + k : k * W + fixed; if (depth(i) >= 2) cells[i].t = 'route'; }
    for (let k = 0; k < 3 + this.int(3); k++) { const i = this.int(N); if (cells[i].t !== 'route' && depth(i) >= 1) cells[i].t = 'roche'; }
    if (this.rand() < 0.6) { const i = this.int(N); if (depth(i) > 1 && cells[i].t !== 'route') cells[i].t = 'lac'; }
    // Les villages, loin du front de départ
    const names = this.shuffle([...NAMES.feux]);
    const spots = this.shuffle([...Array(N).keys()].filter(i => depth(i) >= 2));
    const towns: number[] = [];
    for (const i of spots) {
      if (towns.length >= 6) break;
      if (towns.some(j => cheb(i, j) < 2)) continue;
      towns.push(i);
    }
    const pops = this.shuffle([3600, 2800, 2100, 1500, 1000, 600]);
    towns.forEach((i, k) => { Object.assign(cells[i], { t: 'village', pop: pops[k] + this.int(8) * 50, name: names[k] }); });
    // Le front de feu, sur le bord au vent
    const edge = [...Array(N).keys()].filter(i => depth(i) === 0);
    const n = Math.round(edge.length * clamp(0.6 + 0.2 * s.diff, 0.6, 1));
    const light = (i: number) => { const c = cells[i]; if (!FLAM[c.t] || c.t === 'village') c.t = 'foret'; c.fire = FLAM[c.t]!.burn; };
    for (const i of this.shuffle(edge).slice(0, n)) light(i);
    for (let i = 0; i < N; i++) if (depth(i) === 1 && cells[i].t !== 'village' && this.rand() < 0.25 * s.diff) light(i);
    s.cells = cells;
  }

  /* ── Génération : crue ── */

  private genCrue(): void {
    const s = this.s;
    const cells = Array.from({ length: N }, () => this.blank('terre'));
    const river: number[] = [];
    let y = 2 + this.int(3);
    for (let x = 0; x < W; x++) {
      river.push(y * W + x);
      if (x > 0 && x < W - 1 && this.rand() < 0.45) {
        const ny = clamp(y + (this.rand() < 0.5 ? -1 : 1), 1, H - 2);
        if (ny !== y) { y = ny; river.push(y * W + x); }
      }
    }
    for (let i = 0; i < N; i++) {
      const d = Math.min(...river.map(r => Math.abs(cx(r) - cx(i)) + Math.abs(cy(r) - cy(i))));
      const c = cells[i];
      if (d === 0) { c.t = 'riviere'; c.elev = 0; c.water = true; continue; }
      c.elev = clamp(Math.round(d * 0.85 + (this.rand() - 0.45) * 1.3), 1, 5);
      if (this.rand() < 0.16) c.t = 'bois';
    }
    // Des champs bas, au bord de l’eau : futurs bassins de rétention
    const low = this.shuffle([...Array(N).keys()].filter(i => cells[i].t !== 'riviere' && cells[i].elev <= 2));
    let fields = 0;
    for (const i of low) { if (fields >= 4) break; if (nb4(i).some(j => cells[j].t === 'riviere' || cells[j].elev <= 1)) { cells[i].t = 'champ'; fields++; } }
    // Les villes : dans la plaine inondable, à des hauteurs variées
    const names = this.shuffle([...NAMES.crue]);
    const towns: number[] = [];
    const want = [1, 1, 2, 2, 3, 3];
    for (const e of want) {
      const cand = this.shuffle([...Array(N).keys()].filter(i => cells[i].t !== 'riviere' && cells[i].t !== 'champ' && cells[i].elev === e && towns.every(j => cheb(i, j) >= 2)));
      if (cand.length) towns.push(cand[0]);
    }
    const pops = this.shuffle([4200, 3200, 2400, 1700, 1100, 700]);
    towns.forEach((i, k) => Object.assign(cells[i], { t: 'ville', pop: pops[k] + this.int(8) * 50, name: names[k] }));
    // La pluie : la cote monte jusqu’à son pic, puis la décrue s’amorce
    const peak = 4 + (s.diff >= 1.2 ? 1 : s.diff >= 0.95 ? 0.5 : 0);
    let half = Math.round((peak - 1) * 2);
    const rain = Array(s.maxTurns).fill(0);
    while (half > 0) { const k = this.int(6); if (rain[k] < 1) { rain[k] += 0.5; half--; } }
    for (let k = 6; k < s.maxTurns; k++) rain[k] = this.rand() < 0.5 ? -0.5 : 0;
    s.rain = rain;
    s.trend = rain.map(r => (this.rand() < 0.3 ? clamp(r + (this.rand() < 0.5 ? -0.5 : 0.5), -0.5, 1) : r));
    s.level = 1;
    s.cells = cells;
  }

  /* ── Génération : épidémie ── */

  private genEpidemie(): void {
    const s = this.s;
    const cells = Array.from({ length: N }, () => this.blank('quartier'));
    for (let i = 0; i < N; i++) {
      const centre = cx(i) >= 3 && cx(i) <= 5 && cy(i) >= 2 && cy(i) <= 4;
      cells[i].t = centre ? 'centre' : 'quartier';
    }
    // Deux lignes de transport, trois gares chacune
    const ya = 1 + this.int(2), xb = 2 + this.int(5);
    const lineA = [[1, ya + this.int(2) - (ya > 1 ? 1 : 0)], [4, ya + 1 + this.int(2)], [7, ya + this.int(2)]].map(([x, y]) => clamp(y, 0, H - 1) * W + x);
    const lineB = [[clamp(xb + this.int(3) - 1, 0, W - 1), this.int(2)], [xb, 3 + this.int(2)], [clamp(xb + this.int(3) - 1, 0, W - 1), 5 + this.int(2)]].map(([x, y]) => clamp(y, 0, H - 1) * W + x);
    for (let k = 0; k < 3; k++) while (lineA.includes(lineB[k]) || lineB.indexOf(lineB[k]) !== k) lineB[k] = step(lineB[k], lineB[k] % W < W - 1 ? 1 : 3);
    s.lines = [lineA, lineB];
    s.lines.forEach((l, k) => l.forEach(i => { cells[i].t = 'gare'; cells[i].line = k; }));
    const free = this.shuffle([...Array(N).keys()].filter(i => cells[i].t === 'quartier'));
    for (const i of free.slice(0, 6)) cells[i].t = 'parc';
    for (const c of cells) {
      c.pop = c.t === 'centre' ? 6000 + this.int(11) * 500 : c.t === 'gare' ? 4000 + this.int(9) * 500 : c.t === 'parc' ? 200 + this.int(5) * 100 : 1500 + this.int(15) * 250;
      c.name = TERRAIN_LABEL[c.t].toLowerCase();
    }
    // La moitié des districts n’est pas surveillée
    const hid = this.shuffle([...Array(N).keys()].filter(i => cells[i].t !== 'gare'));
    for (const i of hid.slice(0, Math.round(hid.length * 0.5))) cells[i].hidden = true;
    // Les foyers de départ : un connu, les autres souvent cachés
    const seeds = 3 + (s.diff >= 0.95 ? 1 : 0) + (s.diff >= 1.2 ? 1 : 0);
    const visible = this.shuffle([...Array(N).keys()].filter(i => !cells[i].hidden && cells[i].t !== 'parc'));
    const first = visible[0];
    cells[first].inf = 2;
    const others = this.shuffle([...Array(N).keys()].filter(i => cheb(i, first) >= 3 && cells[i].t !== 'parc'));
    const placed = [first];
    for (const i of others) {
      if (placed.length >= seeds) break;
      if (placed.some(j => cheb(i, j) < 3)) continue;
      if (!cells[i].hidden && this.rand() < 0.6) continue;
      cells[i].inf = 1 + this.int(2);
      placed.push(i);
    }
    s.cells = cells;
  }

  /* ── Règles communes ── */

  effElev(c: Cell): number { return c.elev + (c.dike ? 2 : 0) + (c.pump > 0 ? 1 : 0); }
  isHazard(c: Cell): boolean { return this.s.v === 'feux' ? c.fire > 0 : this.s.v === 'crue' ? c.water : c.inf >= 2 && !c.hidden; }
  lineCells(i: number): number[] {
    const out: number[] = [];
    let j = i;
    for (let k = 0; k < 3 && j >= 0; k++) { out.push(j); j = step(j, this.s.wind); }
    return out;
  }
  area(tool: ToolId, i: number): number[] {
    if (tool === 'pompiers' || tool === 'tests') return [i, ...nb4(i)];
    if (tool === 'canadair') return this.lineCells(i);
    return [i];
  }

  /** Probabilité d’être touché au prochain tour, pour chaque case menacée.
   *  Épidémie : seulement d’après ce que la cellule de crise sait (cases visibles). */
  forecast(full = false): Map<number, number> {
    const v = this.s.v;
    return v === 'feux' ? this.fireProbs() : v === 'crue' ? new Map(this.floodNext().map(i => [i, 1])) : this.infProbs(!full);
  }

  private fireProbs(): Map<number, number> {
    const s = this.s, cells = s.cells, k = 0.6 + 0.4 * s.diff;
    const q = new Map<number, number>();
    const add = (j: number, base: number) => {
      if (j < 0) return;
      const c = cells[j], f = FLAM[c.t];
      if (!f || c.fire !== 0 || c.retard > 0) return;
      let p = Math.min(1, base * k);
      if (c.wet > 0) p *= WET;
      q.set(j, 1 - (1 - (q.get(j) ?? 0)) * (1 - p));
    };
    for (let i = 0; i < N; i++) {
      if (cells[i].fire <= 0) continue;
      for (let d = 0; d < 4; d++) {
        const j = step(i, d);
        if (j < 0) continue;
        const f = FLAM[cells[j].t];
        if (!f) continue;
        add(j, d === s.wind ? f.down : d === (s.wind + 2) % 4 ? UPWIND : f.side);
      }
      for (const side of [(s.wind + 1) % 4, (s.wind + 3) % 4]) {
        const j = step(step(i, s.wind), side);
        if (j >= 0 && FLAM[cells[j].t]) add(j, FLAM[cells[j].t]!.diag);
      }
      if (s.force > 1) {
        const j = step(step(i, s.wind), s.wind);
        if (j >= 0 && FLAM[cells[j].t]) add(j, EMBER * FLAM[cells[j].t]!.down);
      }
    }
    return q;
  }

  /** Crue : cases qui seront inondées à la fin du tour (déterministe, la hausse annoncée est exacte) */
  floodNext(): number[] {
    const s = this.s, L = s.level + (s.rain[s.turn - 1] ?? 0);
    const wet = s.cells.map(c => c.water && (c.t === 'riviere' || c.t === 'bassin' || this.effElev(c) < L));
    const out: number[] = [];
    for (let i = 0; i < N; i++) {
      const c = s.cells[i];
      if (c.water || this.effElev(c) >= L) continue;
      if (nb4(i).some(j => wet[j])) out.push(i);
    }
    return out;
  }
  private infProbs(visibleOnly: boolean): Map<number, number> {
    const s = this.s, cells = s.cells, k = 0.75 + 0.25 * s.diff;
    const q = new Map<number, number>();
    const add = (j: number, p: number) => {
      const c = cells[j];
      if (c.inf !== 0 || c.vax || c.lock > 0) return;
      if (visibleOnly && c.hidden) return;
      q.set(j, 1 - (1 - (q.get(j) ?? 0)) * (1 - Math.min(0.95, p * k * (c.t === 'parc' ? 0.4 : 1))));
    };
    for (let i = 0; i < N; i++) {
      const c = cells[i];
      if (c.inf < 2 || c.lock > 0) continue;
      if (visibleOnly && c.hidden) continue;
      for (const j of nb4(i)) add(j, CONTAGION[c.inf]);
      if (c.t === 'gare' && c.line >= 0) for (const j of s.lines[c.line]) if (j !== i) add(j, 0.6);
    }
    return q;
  }

  /* ── Actions ── */

  /** null si l’action est possible, sinon la raison */
  check(tool: ToolId, i: number): string | null {
    const s = this.s, c = s.cells[i], T = TOOLS[tool];
    if (s.over) return 'La crise est terminée.';
    if (!VARIANT_TOOLS[s.v].includes(tool)) return 'Moyen indisponible.';
    if (s.ap < T.cost) return `Il faut ${T.cost} PA.`;
    if (T.limited && !(s.uses[tool]! > 0)) return `Plus de ${T.name.toLowerCase()} disponible.`;
    switch (tool) {
      case 'pompiers':
        if (!FLAM[c.t] || c.fire < 0) return c.fire < 0 ? 'Rien à défendre : la case a déjà brûlé.' : 'Rien d’inflammable ici.';
        if (c.t === 'village' && c.down) return 'Le village est déjà perdu.';
        return null;
      case 'canadair':
        return this.lineCells(i).some(j => s.cells[j].fire > 0 || (FLAM[s.cells[j].t] && s.cells[j].fire === 0)) ? null : 'Rien à arroser sur cette ligne.';
      case 'coupefeu':
        if (c.t === 'village') return 'On ne débroussaille pas un village : évacuez-le ou arrosez-le.';
        if (!FLAM[c.t]) return 'Cette case ne brûle déjà pas.';
        return c.fire !== 0 ? 'Trop tard : la case brûle ou a brûlé.' : null;
      case 'evac':
        if (!this.isTown(c)) return 'Personne à évacuer ici.';
        if (c.evac) return 'Déjà évacué.';
        if (c.down) return 'Trop tard.';
        if (c.fire > 0) return 'Le village brûle : envoyez d’abord les pompiers.';
        return null;
      case 'digue':
        if (c.t === 'riviere' || c.t === 'bassin') return 'Impossible dans le lit de la rivière.';
        if (c.water) return 'Trop tard : la case est déjà sous l’eau. Pompez.';
        return c.dike ? 'Une digue protège déjà la case.' : null;
      case 'pompe':
        if (c.t === 'riviere' || c.t === 'bassin') return 'On ne vide pas la rivière.';
        return c.pump > 0 ? 'Les pompes tournent déjà ici.' : null;
      case 'bassin':
        if (c.t !== 'champ') return 'Seul un champ peut servir de bassin.';
        if (c.water) return 'Le champ est déjà sous l’eau.';
        return nb4(i).some(j => s.cells[j].water) ? null : 'Le champ doit toucher l’eau.';
      case 'tests':
        return [i, ...nb4(i)].some(j => s.cells[j].hidden || s.cells[j].inf === 1) ? null : 'Rien à apprendre ici : tout est déjà surveillé.';
      case 'vaccin':
        if (c.vax) return 'Déjà vacciné.';
        return !c.hidden && c.inf >= 2 ? 'Trop tard pour vacciner : soignez ou confinez.' : null;
      case 'confine':
        return c.lock > 0 ? 'Déjà confiné.' : null;
      case 'hopital':
        return !c.hidden && c.inf === 0 ? 'Aucun malade ici.' : null;
    }
  }

  /** Applique l’action (supposée valide) et renvoie le compte rendu */
  apply(tool: ToolId, i: number): string {
    const s = this.s, cells = s.cells, c = cells[i], T = TOOLS[tool];
    s.ap -= T.cost;
    if (T.limited) s.uses[tool] = (s.uses[tool] ?? 0) - 1;
    s.actions.push({ turn: s.turn, tool, i, area: this.area(tool, i) });
    const at = this.isTown(c) ? `à ${c.name}` : `en ${coord(i)}`;
    switch (tool) {
      case 'pompiers': {
        const was = c.fire;
        if (was === 1) this.extinguish(i); else if (was > 1) c.fire--;
        for (const j of [i, ...nb4(i)]) if (FLAM[cells[j].t] && cells[j].fire === 0) cells[j].wet = Math.max(cells[j].wet, 1);
        return was === 1 ? `🚒 Feu éteint ${at}, les abords sont arrosés.` : was > 1 ? `🚒 Le feu faiblit ${at} : encore un passage pour l’éteindre.` : `🚒 Les pompiers arrosent les abords ${at}.`;
      }
      case 'canadair': {
        let n = 0;
        for (const j of this.lineCells(i)) {
          if (cells[j].fire > 0) { this.extinguish(j); n++; } else if (FLAM[cells[j].t] && cells[j].fire === 0) cells[j].retard = 2;
        }
        return `✈️ Largage du Canadair : ${n ? `${n} foyer${n > 1 ? 's' : ''} éteint${n > 1 ? 's' : ''}` : 'retardant déposé'}.`;
      }
      case 'coupefeu': c.t = 'coupe'; c.wet = 0; return `🪓 Coupe-feu ouvert ${at}.`;
      case 'evac': c.evac = true; return `🚌 ${c.name} est évacué : ${fmtPop(c.pop)} habitants à l’abri.`;
      case 'digue': c.dike = true; return `🧱 Digue montée ${at} (+2 m).`;
      case 'pompe': {
        c.pump = 1;
        if (c.water && this.effElev(c) >= s.level) { c.water = false; return this.isTown(c) ? `⛽ Les pompes mettent au sec les rues de ${c.name}.` : `⛽ Les pompes assèchent la case ${coord(i)}.`; }
        return c.water ? `⛽ Pompes ${at}, mais l’eau est encore trop haute.` : `⛽ Pompes prêtes ${at} (+1 m ce tour).`;
      }
      case 'bassin':
        c.t = 'bassin'; c.water = true; s.level -= 0.5; s.malus++;
        return `🌾 Le champ ${coord(i)} est sacrifié : la cote baisse à ${fmtLevel(s.level)}.`;
      case 'tests': {
        let found = 0, cleared = 0;
        for (const j of [i, ...nb4(i)]) {
          const d = cells[j];
          if (d.hidden && d.inf > 0) found++;
          d.hidden = false;
          if (d.inf === 1) { d.inf = 0; cleared++; }
        }
        return `🧪 Dépistage autour de ${coord(i)} : ${found ? `${found} foyer${found > 1 ? 's' : ''} découvert${found > 1 ? 's' : ''}` : 'aucun foyer caché'}${cleared ? `, ${cleared} chaîne${cleared > 1 ? 's' : ''} de cas isolée${cleared > 1 ? 's' : ''}` : ''}.`;
      }
      case 'vaccin': {
        const late = c.inf >= 2;
        c.hidden = false; c.vax = true;
        return late ? `💉 Trop tard en ${coord(i)} : le foyer était déjà installé (niveau ${c.inf}).` : `💉 Centre de vaccination ouvert en ${coord(i)}.`;
      }
      case 'confine': c.hidden = false; c.lock = 2; s.malus++; return `🔒 ${coord(i)} est confiné deux tours (−1 popularité).`;
      case 'hopital': {
        c.hidden = false;
        const before = c.inf;
        c.inf = Math.max(0, c.inf - 2); c.care = 1;
        return before ? `🏥 Hôpital de campagne en ${coord(i)} : niveau ${before} → ${c.inf}.` : `🏥 Hôpital de campagne en ${coord(i)}… où il n’y avait aucun malade.`;
      }
    }
  }

  private extinguish(i: number): void {
    const c = this.s.cells[i];
    c.fire = -1; c.wet = 0;
    if (c.t === 'village' && !c.down) {
      c.damaged = true;
      c.lost = Math.max(c.lost, Math.round(c.pop * (c.evac ? EVAC_LOSS : 0.45)));
    }
  }

  /* ── Fin du tour : la catastrophe progresse ── */

  endTurn(): TurnReport {
    const s = this.s;
    const r: TurnReport = { events: [], lost: 0 };
    if (s.over) return r;
    if (s.v === 'feux') this.stepFeux(r); else if (s.v === 'crue') this.stepCrue(r); else this.stepEpidemie(r);
    s.turn++;
    s.ap = s.apMax;
    if (s.turn > s.maxTurns) { s.turn = s.maxTurns; this.settle(r); s.over = true; }
    else this.markThreats();
    return r;
  }

  private stepFeux(r: TurnReport): void {
    const s = this.s, cells = s.cells;
    const pr = this.fireProbs();
    // Un village qui brûle depuis un tour sans secours est perdu
    for (const c of cells) {
      if (c.t !== 'village' || c.fire <= 0 || c.down) continue;
      c.down = true;
      c.lost = Math.round(c.pop * (c.evac ? EVAC_LOSS : 1));
      r.events.push(c.evac ? `🏚️ ${c.name} a brûlé, mais ses habitants étaient à l’abri.` : `🏚️ ${c.name} est détruit par les flammes.`);
      if (!c.evac) r.lost++;
    }
    const newly: number[] = [];
    for (const [i, p] of pr) if (this.rand() < p) newly.push(i);
    for (const c of cells) if (c.fire > 0) { c.fire--; if (c.fire === 0) c.fire = -1; }
    for (const i of newly) {
      const c = cells[i];
      c.fire = FLAM[c.t]!.burn; c.hit = s.turn;
      if (c.t === 'village') r.events.push(c.evac ? `🔥 ${c.name} prend feu : les habitants sont à l’abri.` : `🔥 ${c.name} prend feu ! Il reste un tour pour l’éteindre (deux passages de pompiers, ou un Canadair).`);
    }
    for (const c of cells) { if (c.wet > 0) c.wet--; if (c.retard > 0) c.retard--; }
    // Reprises et nouveaux départs de feu, jamais collés à un village
    if ((s.turn === 2 || s.turn === 4 || s.turn === 6) && this.rand() < 0.25 + 0.4 * (s.diff - 0.8)) {
      const towns = [...Array(N).keys()].filter(i => cells[i].t === 'village');
      const spots = [...Array(N).keys()].filter(i => (cells[i].t === 'foret' || cells[i].t === 'garrigue') && cells[i].fire === 0 && towns.every(t => cheb(i, t) >= 2));
      if (spots.length) {
        const i = spots[this.int(spots.length)];
        cells[i].fire = FLAM[cells[i].t]!.burn; cells[i].hit = s.turn; newly.push(i);
        r.events.push(`🔥 Nouveau départ de feu en ${coord(i)}.`);
      }
    }
    s.fresh = newly;
    if (newly.length) r.events.unshift(`Le feu gagne ${newly.length} case${newly.length > 1 ? 's' : ''}.`);
    else r.events.unshift('Le feu marque le pas.');
    // Le vent : le changement annoncé arrive, un autre peut s’annoncer
    if (s.nextWind >= 0) {
      const turned = s.nextWind !== s.wind;
      s.wind = s.nextWind; s.force = s.nextForce; s.nextWind = -1;
      r.events.push(turned ? `🌬️ Le vent tourne : vent ${WIND_NAME[s.wind]}${s.force > 1 ? ', en rafales' : ''}.` : s.force > 1 ? '🌬️ Les rafales se lèvent.' : '🌬️ Le vent faiblit.');
    } else if (s.turn >= 2 && s.turn < s.maxTurns - 1 && this.rand() < 0.35 + 0.15 * (s.diff - 1)) {
      const turn = this.rand() < 0.7;
      s.nextWind = turn ? (s.wind + (this.rand() < 0.5 ? 1 : 3)) % 4 : s.wind;
      s.nextForce = !turn ? 3 - s.force : this.rand() < 0.35 + 0.3 * (s.diff - 0.8) ? 2 : 1;
    }
  }

  private stepCrue(r: TurnReport): void {
    const s = this.s, cells = s.cells;
    // Les villes sous l’eau souffrent
    for (const c of cells) {
      if (c.t !== 'ville' || !c.water) continue;
      if (c.evac) { if (!c.damaged) { c.damaged = true; c.lost = Math.max(c.lost, Math.round(c.pop * EVAC_LOSS)); } continue; }
      const depth = s.level - this.effElev(c);
      c.damaged = true;
      c.lost = Math.min(c.pop, c.lost + Math.round(c.pop * (depth >= 1.5 ? 0.5 : 0.3)));
      if (!c.down && c.lost >= c.pop * 0.6) { c.down = true; r.lost++; r.events.push(`🏚️ ${c.name} est sinistré : la majorité des habitants a tout perdu.`); }
    }
    const newly = this.floodNext();
    s.level += s.rain[s.turn - 1] ?? 0;
    for (let i = 0; i < N; i++) {
      const c = cells[i];
      if (!c.dike || this.effElev(c) >= s.level || !(c.water || nb4(i).some(j => cells[j].water))) continue;
      c.dike = false;
      r.events.push(`🧱 L’eau passe par-dessus la digue ${c.name ? `à ${c.name}` : 'en ' + coord(i)} : elle cède.`);
    }
    for (const c of cells) if (c.water && c.t !== 'riviere' && c.t !== 'bassin' && this.effElev(c) >= s.level) c.water = false;
    for (const i of newly) {
      const c = cells[i];
      if (this.effElev(c) >= s.level) continue;
      c.water = true; c.hit = c.hit || s.turn;
      if (c.t === 'ville') r.events.push(c.evac ? `🌊 L’eau entre dans ${c.name}, évacuée à temps.` : `🌊 L’eau entre dans ${c.name} ! Pompez ou évacuez.`);
    }
    for (const c of cells) if (c.pump > 0) c.pump--;
    s.fresh = newly;
    const rise = s.rain[s.turn - 1] ?? 0;
    r.events.unshift(`La cote ${rise > 0 ? 'monte' : rise < 0 ? 'baisse' : 'se stabilise'} : ${fmtLevel(s.level)}. ${newly.length ? `${newly.length} case${newly.length > 1 ? 's' : ''} inondée${newly.length > 1 ? 's' : ''}.` : ''}`.trim());
  }

  private stepEpidemie(r: TurnReport): void {
    const s = this.s, cells = s.cells;
    const pr = this.infProbs(false);
    const newly: number[] = [];
    for (const [i, p] of pr) if (this.rand() < p) newly.push(i);
    for (const c of cells) {
      if (c.inf <= 0) continue;
      if (c.lock > 0 || c.care > 0) continue;
      if (c.vax && c.inf === 1) { c.inf = 0; continue; }
      if (c.inf < 4) c.inf++;
    }
    for (const i of newly) { cells[i].inf = 1; cells[i].hit = cells[i].hit || s.turn; }
    let sat = 0;
    for (let i = 0; i < N; i++) {
      const c = cells[i];
      c.lost = Math.min(c.pop * CASE_CAP, c.lost + c.pop * RATE[c.inf] * (c.lock > 0 ? 0.5 : 1));
      if (c.inf >= 3 && c.hidden) { c.hidden = false; r.events.push(`🚨 Un foyer caché éclate en ${coord(i)} : les urgences débordent.`); }
      if (c.inf === 4 && !c.down) { c.down = true; sat++; }
      if (c.lock > 0) c.lock--;
      if (c.care > 0) c.care--;
    }
    if (sat) { r.lost++; r.events.push(`🏥 ${sat} district${sat > 1 ? 's' : ''} saturé${sat > 1 ? 's' : ''} : les hôpitaux n’y suffisent plus.`); }
    const seen = newly.filter(i => !cells[i].hidden).length;
    s.fresh = newly.filter(i => !cells[i].hidden);
    r.events.unshift(seen ? `Le virus gagne ${seen} district${seen > 1 ? 's' : ''} surveillé${seen > 1 ? 's' : ''}.` : 'Aucune nouvelle contamination détectée.');
  }

  /** Fin de partie : ce qui brûle ou reste sous l’eau compte comme perdu */
  private settle(r: TurnReport): void {
    for (const c of this.s.cells) {
      if (this.s.v === 'feux' && c.t === 'village' && c.fire > 0 && !c.down) {
        c.down = true; c.lost = Math.round(c.pop * (c.evac ? EVAC_LOSS : 1));
        r.events.push(`🏚️ ${c.name} brûle encore : le village est perdu.`);
      }
      if (this.s.v === 'crue' && c.t === 'ville' && c.water) {
        c.lost = c.evac ? Math.max(c.lost, Math.round(c.pop * EVAC_LOSS)) : Math.min(c.pop, c.lost + Math.round(c.pop * 0.3));
      }
    }
  }

  /** Mémorise quand chaque zone habitée a été menacée ou annoncée dans les prévisions */
  private markThreats(): void {
    const s = this.s, fc = this.forecast(true);
    for (let i = 0; i < N; i++) {
      const c = s.cells[i];
      if (!this.isZone(c)) continue;
      if (!c.fc && (fc.get(i) ?? 0) >= 0.3) c.fc = s.turn;
      if (!c.threat && ((fc.get(i) ?? 0) > 0 || this.isHazard(c) || nb4(i).some(j => this.isHazard(s.cells[j])))) c.threat = s.turn;
    }
  }

  /* ── Bilan ── */

  outcome(): Outcome {
    const s = this.s, zones = s.cells.filter(c => this.isZone(c));
    const total = zones.reduce((t, c) => t + c.pop, 0);
    const lost = zones.reduce((t, c) => t + c.lost, 0);
    const frac = clamp(1 - lost / total, 0, 1);
    const lim = VARIANT_TOOLS[s.v].filter(t => TOOLS[t].limited);
    const spare = lim.length ? lim.reduce((t, k) => t + (s.uses[k] ?? 0) / (s.usesMax[k] || 1), 0) / lim.length : 0;
    const intact = zones.filter(c => c.lost === 0).length;
    // Feux : la part de la végétation partie en fumée (y compris ce qui brûle encore)
    const veg = s.cells.filter(c => c.t !== 'village' && (FLAM[c.t] || c.fire !== 0 || c.t === 'coupe'));
    const burnt = s.v === 'feux' ? veg.filter(c => c.fire !== 0).length / Math.max(1, veg.length) : 0;
    // Le score : la part de population épargnée (exigeante), un petit bonus pour les moyens rares
    // économisés quand la gestion est bonne, une pénalité pour la popularité perdue ;
    // pour les feux, une part pour la surface préservée
    const g = s.v === 'feux' ? 1.6 : s.v === 'crue' ? 1.5 : 1.7;
    const base = s.v === 'feux' ? 0.85 * Math.pow(frac, g) + 0.08 * (1 - burnt) * frac : 0.93 * Math.pow(frac, g);
    const score = clamp(base + 0.07 * spare * frac * frac - 0.015 * s.malus, 0, 1);
    return { score, frac, saved: total - lost, total, intact, zones: zones.length, spare, malus: s.malus, burnt };
  }

  /** Meilleure et pire décision, pour le bilan */
  review(): { best: string; worst: string } {
    const s = this.s, cells = s.cells;
    const credit = s.actions.map(() => 0);
    const zones = [...Array(N).keys()].filter(i => this.isZone(cells[i]));
    for (const z of zones) {
      const c = cells[z];
      const kept = c.pop - c.lost;
      // Épargné : peu de pertes (une ville évacuée compte, une épidémie installée non)
      if (!c.threat || c.lost > c.pop * (s.v === 'epidemie' ? 0.12 : EVAC_LOSS)) continue;
      const helpers = s.actions.map((a, k) => ({ a, k })).filter(({ a }) =>
        a.tool === 'evac' ? a.i === z && c.hit > 0 : a.tool === 'bassin' ? c.hit === 0 : a.area.some(j => cheb(j, z) <= 1));
      for (const { a, k } of helpers) credit[k] += (a.tool === 'evac' ? c.pop * (1 - EVAC_LOSS) : a.tool === 'bassin' ? kept * 0.3 : kept) / helpers.length;
    }
    let best = '';
    const bk = credit.indexOf(Math.max(...credit));
    if (bk >= 0 && credit[bk] > 0) {
      const a = s.actions[bk], T = TOOLS[a.tool];
      best = `${T.icon} ${T.name} ${this.place(a.i)} au tour ${a.turn} : environ ${fmtPop(Math.round(credit[bk] / 100) * 100)} habitants épargnés.`;
    } else best = s.actions.length ? 'Aucune action n’a vraiment pesé sur le cours de la crise.' : 'Vous n’avez rien entrepris.';
    // La pire : la plus lourde perte
    const worstZ = zones.sort((a, b) => cells[b].lost - cells[a].lost)[0];
    const w = cells[worstZ];
    let worst: string;
    if (w && w.lost >= Math.max(200, w.pop * 0.3)) {
      const name = s.v === 'epidemie' ? `Le district ${coord(worstZ)}` : w.name;
      const what = s.v === 'epidemie' ? `${fmtPop(w.lost)} personnes contaminées` : `${fmtPop(w.lost)} sinistrés sur ${fmtPop(w.pop)}`;
      const warn = w.fc && w.hit && w.fc < w.hit ? `, alors que les prévisions annonçaient la menace dès le tour ${w.fc}` : w.hit ? ` (premier impact au tour ${w.hit})` : '';
      worst = `${name} : ${what}${warn}${w.evac ? ' ; les habitants avaient été évacués, seuls les biens sont perdus' : ''}.`;
    } else {
      const waste = s.actions.find(a => a.tool === 'evac' && !cells[a.i].hit);
      worst = waste ? `L’évacuation de ${cells[waste.i].name} au tour ${waste.turn} : deux PA pour un lieu jamais touché.` : s.malus >= 3 ? `${s.malus} points de popularité laissés en route.` : 'Aucune perte majeure : une gestion presque sans faute.';
    }
    return { best, worst };
  }

  place(i: number): string {
    const c = this.s.cells[i];
    if (this.isTown(c)) return `à ${c.name}`;
    if (this.s.v === 'epidemie') return `en ${coord(i)}`;
    const near = [...Array(N).keys()].filter(j => this.isTown(this.s.cells[j])).sort((a, b) => cheb(a, i) - cheb(b, i))[0];
    return near !== undefined && cheb(near, i) <= 2 ? `près de ${this.s.cells[near].name}` : `en ${coord(i)}`;
  }
}

export const fmtLevel = (l: number): string => `${l.toFixed(1).replace('.', ',')} m`;

/* ============================================================
 *  Le composant
 * ============================================================ */

interface CellView { i: number; cls: string; icon: string; sub: string; badge: string; corner: string; aria: string; bg: string | null }
interface Sum { title: string; o: Outcome; best: string; worst: string }

const BRIEF: Record<Variant, string> = {
  feux: 'Le feu avance à chaque fin de tour : toujours dans le sens du vent, souvent en éventail, parfois sur les côtés. Protégez les villages.',
  crue: 'L’eau gagne une case par tour vers toute case plus basse que la cote. Une ville sous l’eau perd des habitants à chaque tour.',
  epidemie: 'Un district contaminé progresse d’un niveau par tour ; à partir du niveau 2, il contamine ses voisins et sa ligne de transport.',
};

@Component({
  selector: 'app-cellule-game',
  template: `
    @let o = live();
    <div class="cc" [class]="'cc v-' + variant">
      <div class="head">
        <span>Tour <b class="mono">{{ turn() }}</b>/{{ maxTurns }}</span>
        <span class="ap" [attr.aria-label]="'Points d’action : ' + apLeft() + ' sur ' + apMax">
          PA @for (on of apDots(); track $index) { <i [class.on]="on"></i> }
        </span>
        <span class="safe" title="Population épargnée">👥 <b class="mono">{{ pct(o.frac) }}</b></span>
      </div>

      <div class="cond">
        @switch (variant) {
          @case ('feux') {
            <span class="wind"><b class="arrow" aria-hidden="true">{{ windArrow() }}</b> Vent {{ windName() }}@if (force() > 1) { <em class="gust">rafales</em> }</span>
            @if (windNext(); as n) { <span class="next">⚠️ {{ n }}</span> }
          }
          @case ('crue') {
            <span>🌊 Cote <b class="mono">{{ level() }}</b></span>
            <span class="next">{{ rainText() }}</span>
          }
          @case ('epidemie') {
            <span>🦠 Contaminés <b class="mono">{{ cases() }}</b></span>
            <span class="next">❓ {{ hiddenCount() }} districts non surveillés@if (malus()) { · popularité −{{ malus() }} }</span>
          }
        }
      </div>

      @if (!over()) { <p class="brief">{{ brief }}</p> }

      <div class="board-wrap">
        <div class="board" role="grid" [attr.aria-label]="'Carte de crise, ' + maxTurns + ' tours'">
          <span class="ax"></span>
          @for (l of letters; track l) { <span class="ax">{{ l }}</span> }
          @for (row of rows; track row) {
            <span class="ax">{{ row + 1 }}</span>
            @for (c of view().slice(row * w, row * w + w); track c.i) {
              <button type="button" [class]="c.cls" [style.background]="c.bg" [attr.aria-label]="c.aria" [disabled]="over()" (click)="tap(c.i)">
                @if (c.corner) { <span class="corner">{{ c.corner }}</span> }
                @if (c.badge) { <span class="badge">{{ c.badge }}</span> }
                @if (c.icon) { <span class="ic">{{ c.icon }}</span> }
                @if (c.sub) { <span class="sub">{{ c.sub }}</span> }
              </button>
            }
          }
          @if (variant === 'epidemie') {
            <svg class="lines" viewBox="0 0 9 7" preserveAspectRatio="none" aria-hidden="true">
              @for (l of lines(); track $index) {
                <polyline [attr.points]="l.points" [attr.stroke]="l.color" fill="none" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-dasharray="6 4" />
              }
            </svg>
          }
        </div>
      </div>

      @if (!over()) {
        <div class="tools" role="toolbar" aria-label="Moyens">
          @for (t of toolView(); track t.id) {
            <button type="button" class="tool" [class.sel]="tool() === t.id" [disabled]="!t.ok" [attr.aria-pressed]="tool() === t.id" (click)="pick(t.id)">
              <span class="ti">{{ t.icon }}</span>
              <span class="tn">{{ t.name }}</span>
              <span class="tc mono">{{ t.cost }} PA@if (t.uses !== null) { · ×{{ t.uses }} }</span>
            </button>
          }
        </div>
        <p class="info" aria-live="polite">{{ info() }}</p>
        <div class="foot">
          <label class="fc"><input type="checkbox" [checked]="showFc()" (change)="showFc.set(!showFc())" /> Prévisions</label>
          <button type="button" class="btn small" [disabled]="!canUndo()" (click)="undoLast()">↶ Annuler</button>
          <button type="button" class="btn primary small" [disabled]="busy()" (click)="endTurn()">Fin du tour →</button>
        </div>
      }

      @if (summary(); as sm) {
        <div class="sum" [class.good]="sm.o.score >= 0.7" [class.bad]="sm.o.score < 0.45">
          <b class="verdict">{{ sm.title }}</b>
          <div class="stats">
            <span><b class="mono">{{ pct(sm.o.frac) }}</b> de la population épargnée ({{ fmt(sm.o.saved) }} sur {{ fmt(sm.o.total) }})</span>
            @if (variant !== 'epidemie') { <span>{{ zoneWord }} intacts : <b class="mono">{{ sm.o.intact }}/{{ sm.o.zones }}</b></span> }
            @else { <span>Districts épargnés : <b class="mono">{{ sm.o.intact }}/{{ sm.o.zones }}</b></span> }
            @if (rareName) { <span>{{ rareName }} restants : <b class="mono">{{ rareLeft() }}</b></span> }
            @if (sm.o.malus) { <span>Popularité : <b class="mono">−{{ sm.o.malus }}</b></span> }
          </div>
          <p>✅ <b>Meilleure décision.</b> {{ sm.best }}</p>
          <p>⚠️ <b>Pire moment.</b> {{ sm.worst }}</p>
          <p class="score">Note de la cellule : <b class="mono">{{ round(sm.o.score * 100) }}/100</b></p>
        </div>
      }

      <details class="legend">
        <summary>Légende et règles</summary>
        <ul>
          @for (l of legend; track l.label) { <li><i [class]="'sw ' + l.cls" [style.background]="l.bg ?? null">{{ l.icon }}</i> {{ l.label }}</li> }
        </ul>
        <p>{{ rules }}</p>
      </details>

      @if (log().length) { <ul class="log">@for (l of log(); track $index) { <li>{{ l }}</li> }</ul> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .cc { display: grid; gap: 7px; }
    .head { display: flex; flex-wrap: wrap; gap: 6px 12px; justify-content: space-between; align-items: center; font-size: 12.5px; }
    .ap { display: inline-flex; gap: 3px; align-items: center; color: var(--ink-2); i { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid var(--accent); }
      i.on { background: var(--accent); } }
    .cond { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--ink-2); align-items: center; }
    .wind .arrow { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink); font-size: 14px; }
    .gust { font-style: normal; margin-left: 4px; padding: 1px 6px; border-radius: 999px; background: var(--bad-soft); color: var(--bad); font-size: 11px; }
    .next { color: var(--ink); }
    .brief { margin: 0; font-size: 12px; color: var(--ink-2); }
    .board-wrap { justify-self: center; width: 100%; max-width: 470px; }
    .board { position: relative; display: grid; grid-template-columns: 11px repeat(9, 1fr); gap: 1px; padding: 2px; border-radius: 10px; background: #2b2a26; user-select: none; }
    .ax { display: grid; place-items: center; font: 600 9px var(--font-body); color: #b8b2a2; min-height: 11px; }
    .cell { position: relative; aspect-ratio: 1; min-width: 0; min-height: 32px; border: 0; border-radius: 3px; padding: 0; cursor: pointer; display: grid; place-items: center; overflow: hidden;
      font-family: var(--font-body); color: #1b1b1b; transition: background-color .35s ease;
      &:disabled { cursor: default; } }
    .ic { font-size: clamp(12px, 3.6vw, 19px); line-height: 1; position: relative; z-index: 2; }
    .sub { position: absolute; bottom: 0; left: 0; right: 0; z-index: 2; font: 700 8.5px/1.25 var(--font-body); text-align: center; color: #fff; background: rgba(0,0,0,.45); }
    .badge { position: absolute; top: 0; right: 1px; z-index: 3; font-size: 9.5px; line-height: 1.1; }
    .corner { position: absolute; top: 1px; left: 2px; z-index: 2; font: 700 8.5px var(--font-body); color: rgba(0,0,0,.55); }
    /* Feux */
    .t-foret { background: #4f7a3f; background-image: radial-gradient(circle at 30% 35%, #3e6531 18%, transparent 20%), radial-gradient(circle at 70% 65%, #3e6531 18%, transparent 20%); }
    .t-garrigue { background: #9aa05a; background-image: radial-gradient(circle at 60% 40%, #858b48 14%, transparent 16%); }
    .t-prairie { background: #c3c98a; }
    .t-roche { background: #8d8a84; background-image: radial-gradient(ellipse at 40% 60%, #6f6c66 30%, transparent 32%); }
    .t-route { background: #6e6c69; background-image: linear-gradient(90deg, transparent 46%, #d9d3c0 46% 54%, transparent 54%); }
    .t-lac { background: #4a86b5; }
    .t-coupe { background: #b8946a; background-image: repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,.12) 4px 6px); }
    .t-village { background: #e3d8bf; }
    .burn { background: #d9471f !important; background-image: radial-gradient(circle at 50% 70%, #ffb13b 25%, transparent 60%) !important; }
    .ash { background: #4a4743 !important; background-image: none !important; }
    .ash.t-village { background: #6d655a !important; }
    .wet::after { content: ''; position: absolute; inset: 0; background: rgba(80, 150, 230, .35); z-index: 1; }
    .retard::after { content: ''; position: absolute; inset: 0; background: rgba(220, 70, 120, .35); z-index: 1; }
    /* Crue */
    .t-riviere, .t-bassin { background: #1d4a78 !important; background-image: repeating-linear-gradient(170deg, transparent 0 6px, rgba(255,255,255,.18) 6px 8px) !important; }
    .t-champ { background-image: repeating-linear-gradient(0deg, transparent 0 4px, rgba(120, 90, 30, .25) 4px 5px); }
    .t-ville { box-shadow: inset 0 0 0 2px #5b4a32; }
    .flood::after { content: ''; position: absolute; inset: 0; z-index: 1; background: rgba(40, 110, 190, .72); }
    .flood.deep::after { background: rgba(25, 75, 150, .85); }
    .dike { box-shadow: inset 0 0 0 3px #8a5a2b; }
    /* Épidémie */
    .lv0 { background: #d9e4d2; } .lv1 { background: #f2df8a; } .lv2 { background: #f0a956; } .lv3 { background: #e0603f; } .lv4 { background: #9c2b2b; color: #fff; }
    .t-parc.lv0 { background: #a9cf98; }
    .fog { background: #9a9890 !important; background-image: repeating-linear-gradient(-45deg, transparent 0 5px, rgba(255,255,255,.12) 5px 7px) !important; }
    .lock { box-shadow: inset 0 0 0 3px #4b4fa8; }
    .vax { box-shadow: inset 0 0 0 3px #2f9d6b; }
    .lines { position: absolute; left: calc(2px + 11px + 1px); right: 2px; top: calc(2px + 11px + 1px); bottom: 2px; width: calc(100% - 16px); height: calc(100% - 16px); pointer-events: none; z-index: 4; opacity: .7; }
    /* Prévisions et cibles */
    .fc1::before, .fc2::before { content: ''; position: absolute; inset: 0; z-index: 2; pointer-events: none; }
    .fc1::before { box-shadow: inset 0 0 0 2px #ffb100; background: repeating-linear-gradient(45deg, transparent 0 5px, rgba(255, 177, 0, .28) 5px 7px); }
    .fc2::before { box-shadow: inset 0 0 0 2px #ff3b1f; background: repeating-linear-gradient(45deg, transparent 0 4px, rgba(255, 59, 31, .4) 4px 7px); animation: blink 1.4s ease-in-out infinite; }
    .ok { outline: 2px dashed rgba(255, 255, 255, .85); outline-offset: -3px; }
    .fresh { animation: pop .9s ease; }
    .focus { outline: 3px solid #f4d35e; outline-offset: -3px; }
    @keyframes blink { 50% { opacity: .5; } }
    @keyframes pop { 0% { transform: scale(.7); filter: brightness(1.6); } 100% { transform: none; } }
    /* Outils */
    .tools { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
    .tool { display: grid; justify-items: center; gap: 1px; min-height: 52px; padding: 5px 2px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer;
      font: 12px var(--font-body);
      .ti { font-size: 18px; line-height: 1; } .tn { font-weight: 600; font-size: 11.5px; line-height: 1.15; text-align: center; } .tc { font-size: 10.5px; color: var(--ink-3); }
      &.sel { border-color: var(--accent); background: var(--accent-soft, var(--surface-2)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent); }
      &:disabled { opacity: .45; cursor: not-allowed; } }
    .info { margin: 0; min-height: 2.6em; font-size: 12px; color: var(--ink); }
    .foot { display: flex; gap: 8px; align-items: center; justify-content: flex-end; flex-wrap: wrap; .fc { margin-right: auto; font-size: 12px; color: var(--ink-2); display: inline-flex; gap: 5px; align-items: center; min-height: 32px; } }
    .sum { display: grid; gap: 5px; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--line); font-size: 12.5px;
      &.good { border-color: var(--good); background: var(--good-soft); } &.bad { border-color: var(--bad); background: var(--bad-soft); }
      p { margin: 0; } .verdict { font-size: 14px; } .score { color: var(--ink-2); } }
    .stats { display: flex; flex-wrap: wrap; gap: 3px 14px; color: var(--ink-2); }
    .legend { font-size: 12px; color: var(--ink-2); summary { cursor: pointer; min-height: 32px; display: flex; align-items: center; color: var(--ink); }
      ul { list-style: none; margin: 4px 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 4px 10px; }
      li { display: flex; gap: 6px; align-items: center; } p { margin: 4px 0 0; } }
    .sw { position: relative; display: inline-grid; place-items: center; flex: none; width: 20px; height: 20px; border-radius: 4px; font-style: normal; font-size: 11px; overflow: hidden; }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 96px; overflow: auto; font-size: 11.5px; color: var(--ink-2); }
    @media (prefers-reduced-motion: reduce) { .fc2::before, .fresh { animation: none; } .cell { transition: none; } }
  `,
})
export class CelluleGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly w = W;
  protected readonly letters = 'ABCDEFGHI'.split('');
  protected readonly rows = [...Array(H).keys()];
  protected readonly round = Math.round;
  protected variant: Variant = 'feux';
  protected maxTurns = 9;
  protected apMax = 4;
  protected brief = '';
  protected rules = '';
  protected zoneWord = 'Villages';
  protected rareName = '';
  protected legend: { cls: string; icon: string; label: string; bg?: string }[] = [];

  private sim!: CelluleSim;
  private undo: SimState[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  /** Compteur de version : la simulation est mutable, l’affichage se recalcule à chaque changement */
  private readonly ver = signal(0);
  protected readonly tool = signal<ToolId | null>(null);
  protected readonly focus = signal<number | null>(null);
  protected readonly info = signal('');
  protected readonly log = signal<string[]>([]);
  protected readonly fresh = signal<ReadonlySet<number>>(new Set());
  protected readonly over = signal(false);
  protected readonly busy = signal(false);
  protected readonly showFc = signal(true);
  protected readonly summary = signal<Sum | null>(null);

  protected readonly turn = computed(() => (this.ver(), this.sim.s.turn));
  protected readonly apLeft = computed(() => (this.ver(), this.sim.s.ap));
  protected readonly apDots = computed(() => { this.ver(); return Array.from({ length: this.apMax }, (_, k) => k < this.sim.s.ap); });
  protected readonly live = computed(() => (this.ver(), this.sim.outcome()));
  protected readonly canUndo = computed(() => (this.ver(), this.undo.length > 0 && !this.over()));
  protected readonly force = computed(() => (this.ver(), this.sim.s.force));
  protected readonly malus = computed(() => (this.ver(), this.sim.s.malus));
  protected readonly windArrow = computed(() => (this.ver(), WIND_ARROW[this.sim.s.wind]));
  protected readonly windName = computed(() => (this.ver(), WIND_NAME[this.sim.s.wind]));
  protected readonly windNext = computed(() => {
    this.ver();
    const s = this.sim.s;
    if (s.nextWind < 0) return '';
    if (s.nextWind === s.wind) return s.nextForce > 1 ? 'Rafales annoncées après ce tour' : 'Le vent faiblira après ce tour';
    return `Après ce tour, le vent tournera : vent ${WIND_NAME[s.nextWind]} ${WIND_ARROW[s.nextWind]}${s.nextForce > 1 ? ', en rafales' : ''}`;
  });
  protected readonly level = computed(() => (this.ver(), fmtLevel(this.sim.s.level)));
  protected readonly rainText = computed(() => {
    this.ver();
    const s = this.sim.s, r = s.rain[s.turn - 1] ?? 0, t = s.trend[s.turn];
    const word = (x: number) => x >= 1 ? 'forte pluie' : x > 0 ? 'pluie' : x < 0 ? 'décrue' : 'accalmie';
    const sign = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '±') + Math.abs(x).toFixed(1).replace('.', ',') + ' m';
    return `Ce tour : ${word(r)} (${sign(r)})${t !== undefined && s.turn < s.maxTurns ? ` · ensuite : ${word(t)} ?` : ''}`;
  });
  protected readonly cases = computed(() => (this.ver(), fmtPop(this.sim.cells.reduce((t, c) => t + c.lost, 0))));
  protected readonly hiddenCount = computed(() => (this.ver(), this.sim.cells.filter(c => c.hidden).length));
  protected readonly rareLeft = computed(() => {
    this.ver();
    const t = VARIANT_TOOLS[this.variant].find(k => TOOLS[k].limited);
    return t ? `${this.sim.s.uses[t] ?? 0}/${this.sim.s.usesMax[t] ?? 0}` : '';
  });
  protected readonly lines = computed(() => {
    this.ver();
    const colors = ['#3a56c9', '#b03aa8'];
    return this.sim.s.lines.map((l, k) => ({ color: colors[k % 2], points: l.map(i => `${cx(i) + 0.5},${cy(i) + 0.5}`).join(' ') }));
  });
  protected readonly toolView = computed(() => {
    this.ver();
    const s = this.sim.s;
    return VARIANT_TOOLS[this.variant].map(id => {
      const T = TOOLS[id];
      const uses = T.limited ? (s.uses[id] ?? 0) : null;
      return { id, icon: T.icon, name: T.name, cost: T.cost, uses, ok: !this.over() && s.ap >= T.cost && (uses === null || uses > 0) };
    });
  });
  protected readonly view = computed<CellView[]>(() => {
    this.ver();
    const sim = this.sim, s = sim.s, tool = this.tool(), fresh = this.fresh(), focus = this.focus();
    const fc = this.showFc() && !s.over ? sim.forecast() : new Map<number, number>();
    return s.cells.map((c, i) => {
      const cls = ['cell', `t-${c.t}`];
      let icon = '', sub = '', badge = '', corner = '', bg: string | null = null;
      const state: string[] = [TERRAIN_LABEL[c.t]];
      if (s.v === 'feux') {
        if (c.fire > 0) { cls.push('burn'); icon = '🔥'; state.push('en feu'); }
        else if (c.fire < 0) { cls.push('ash'); state.push(c.t === 'village' ? (c.down ? 'détruit' : 'sauvé, endommagé') : 'brûlé'); }
        else if (c.retard > 0) { cls.push('retard'); state.push('protégé par le retardant'); }
        else if (c.wet > 0) { cls.push('wet'); state.push('arrosé'); }
        if (c.t === 'village') { icon = c.down ? '🏚️' : c.fire > 0 ? '🔥' : '🏘️'; sub = shortPop(c.pop); state.unshift(c.name); state.push(`${fmtPop(c.pop)} habitants`); }
        else if (c.t === 'lac' && !icon) icon = '';
      } else if (s.v === 'crue') {
        const e = c.elev;
        bg = c.t === 'riviere' || c.t === 'bassin' ? null : ['#7f9f63', '#98ad6c', '#b3b878', '#c9c18c', '#ddd2a6', '#ece3c4'][e];
        corner = c.t === 'riviere' ? '' : String(sim.effElev(c));
        if (c.water && c.t !== 'riviere' && c.t !== 'bassin') { cls.push('flood'); if (s.level - sim.effElev(c) >= 1.5) cls.push('deep'); state.push(`inondé (${fmtLevel(s.level - sim.effElev(c))} d’eau)`); }
        if (c.dike) { cls.push('dike'); badge = '🧱'; state.push('digue'); }
        if (c.pump > 0) { badge += '⛽'; state.push('pompes en service'); }
        if (c.t === 'bassin') icon = '🌾';
        if (c.t === 'bois') icon = '🌳';
        if (c.t === 'ville') { icon = c.down ? '🏚️' : '🏘️'; sub = shortPop(c.pop); state.unshift(c.name); state.push(`${fmtPop(c.pop)} habitants`); }
        if (c.t !== 'riviere') state.push(`altitude ${e} m${c.dike || c.pump ? `, protégée à ${sim.effElev(c)} m` : ''}`);
      } else {
        if (c.hidden) { cls.push('fog'); icon = '❓'; state.push('non surveillé'); }
        else { cls.push(`lv${c.inf}`); state.push(c.inf ? `niveau ${c.inf} sur 4` : 'sain'); if (c.inf >= 3) icon = c.inf === 4 ? '🚨' : '🦠'; }
        if (c.t === 'gare') { icon = icon || '🚉'; state.push(`ligne ${c.line + 1}`); }
        else if (c.t === 'parc' && !icon) icon = '🌳';
        else if (c.t === 'centre' && !icon && !c.hidden) icon = '🏙️';
        sub = shortPop(c.pop);
        state.push(`${fmtPop(c.pop)} habitants`);
        if (c.vax) { cls.push('vax'); badge += '🛡️'; state.push('vacciné'); }
        if (c.lock > 0) { cls.push('lock'); badge += '🔒'; state.push('confiné'); }
        if (c.care > 0) { badge += '🏥'; state.push('hôpital de campagne'); }
      }
      if (c.evac) { badge += '🚌'; state.push('évacué'); }
      const p = fc.get(i) ?? 0;
      if (p >= 0.7) { cls.push('fc2'); state.push(s.v === 'crue' ? 'sera inondé' : `menace forte (${Math.round(p * 100)} %)`); }
      else if (p >= 0.25) { cls.push('fc1'); state.push(`menace (${Math.round(p * 100)} %)`); }
      if (tool && sim.check(tool, i) === null) cls.push('ok');
      if (fresh.has(i)) cls.push('fresh');
      if (focus === i) cls.push('focus');
      return { i, cls: cls.join(' '), icon, sub, badge, corner, bg, aria: `${coord(i)} : ${state.join(', ')}` };
    });
  });

  ngOnInit(): void {
    this.variant = variantOf(this.def().id);
    this.sim = new CelluleSim(this.variant, this.diff(), Math.floor(Math.random() * 1e9));
    this.maxTurns = this.sim.s.maxTurns;
    this.apMax = this.sim.s.apMax;
    this.brief = BRIEF[this.variant];
    this.setupLegend();
    this.info.set(this.variant === 'feux' ? 'Choisissez un moyen, puis touchez une case. Les cases hachurées brûleront probablement au prochain tour.'
      : this.variant === 'crue' ? 'Choisissez un moyen, puis touchez une case. Le chiffre de chaque case est son altitude ; les cases hachurées seront inondées.'
      : 'Choisissez un moyen, puis touchez un district. Les cases grises ne sont pas surveillées : testez-les.');
    this.say(this.variant === 'feux' ? 'Alerte : un front de feu progresse vers les villages.' : this.variant === 'crue' ? 'Alerte rouge : la rivière sort de son lit.' : 'Alerte sanitaire : un foyer épidémique est signalé.');
    this.emitProgress();
  }

  ngOnDestroy(): void { this.timers.forEach(t => clearTimeout(t)); }

  private setupLegend(): void {
    const v = this.variant;
    const T = (id: ToolId) => `${TOOLS[id].icon} ${TOOLS[id].name} (${TOOLS[id].cost} PA${TOOLS[id].limited ? ', limité' : ''}) : ${TOOLS[id].desc}`;
    const fc = [{ cls: 'fc1', icon: '', label: 'Menace probable au prochain tour' }, { cls: 'fc2', icon: '', label: v === 'crue' ? 'Sera inondée au prochain tour' : 'Menace forte au prochain tour' }];
    if (v === 'feux') {
      this.zoneWord = 'Villages'; this.rareName = 'Canadair';
      this.legend = [
        { cls: 't-foret', icon: '', label: 'Forêt : brûle deux tours' }, { cls: 't-garrigue', icon: '', label: 'Garrigue : brûle un tour' },
        { cls: 't-prairie', icon: '', label: 'Prairie : brûle peu' }, { cls: 't-roche', icon: '', label: 'Rochers : ininflammable' },
        { cls: 't-route', icon: '', label: 'Route : ininflammable' }, { cls: 't-lac', icon: '', label: 'Lac' }, { cls: 't-coupe', icon: '', label: 'Coupe-feu' },
        { cls: 't-village', icon: '🏘️', label: 'Village (habitants)' }, { cls: 'burn', icon: '🔥', label: 'En feu' }, { cls: 'ash', icon: '', label: 'Brûlé ou éteint' },
        { cls: 't-foret wet', icon: '', label: 'Arrosé (un tour)' }, { cls: 't-foret retard', icon: '', label: 'Retardant (deux tours)' }, ...fc,
      ];
      this.rules = `Règles : chaque case en feu enflamme à coup sûr la forêt ou la garrigue sous le vent, souvent les deux diagonales sous le vent, parfois les côtés, rarement la case contre le vent ; en rafales, les braises sautent deux cases. Un village en feu doit être éteint dans le tour, sinon il est détruit. Le vent tourne parfois : c’est annoncé un tour à l’avance. ${T('pompiers')} ${T('canadair')} ${T('coupefeu')} ${T('evac')}`;
    } else if (v === 'crue') {
      this.zoneWord = 'Villes'; this.rareName = 'Bassins';
      this.legend = [
        { cls: '', icon: '1', label: 'Altitude basse', bg: '#98ad6c' }, { cls: '', icon: '4', label: 'Altitude haute', bg: '#ddd2a6' },
        { cls: 't-riviere', icon: '', label: 'Rivière' }, { cls: 'flood', icon: '', label: 'Inondé', bg: '#98ad6c' },
        { cls: 't-champ', icon: '', label: 'Champ (bassin possible)', bg: '#98ad6c' }, { cls: 't-ville', icon: '🏘️', label: 'Ville (habitants)', bg: '#b3b878' },
        { cls: 'dike', icon: '🧱', label: 'Digue (+2 m)', bg: '#b3b878' }, { cls: '', icon: '⛽', label: 'Pompes (+1 m)', bg: '#b3b878' }, ...fc,
      ];
      this.rules = `Règles : une case est inondée quand son altitude (digues et pompes comprises) est sous la cote et qu’elle touche l’eau ; l’eau n’avance que d’une case par tour, et se retire quand la cote baisse. Une ville sous l’eau perd 30 % de ses habitants par tour (50 % sous plus d’1,5 m). Une digue submergée cède. La hausse du tour est connue ; la tendance suivante n’est qu’une prévision. ${T('digue')} ${T('pompe')} ${T('bassin')} ${T('evac')}`;
    } else {
      this.zoneWord = 'Districts'; this.rareName = 'Hôpitaux';
      this.legend = [
        { cls: 'lv0', icon: '', label: 'Sain' }, { cls: 'lv1', icon: '', label: 'Niveau 1 : quelques cas' }, { cls: 'lv2', icon: '', label: 'Niveau 2 : contagieux' },
        { cls: 'lv3', icon: '🦠', label: 'Niveau 3 : épidémie' }, { cls: 'lv4', icon: '🚨', label: 'Niveau 4 : saturé' }, { cls: 'fog', icon: '❓', label: 'Non surveillé' },
        { cls: 'lv0', icon: '🚉', label: 'Gare (ligne de transport)' }, { cls: 'lv0 vax', icon: '🛡️', label: 'Vacciné' }, { cls: 'lv0 lock', icon: '🔒', label: 'Confiné' }, ...fc,
      ];
      this.rules = `Règles : chaque district contaminé progresse d’un niveau par tour. À partir du niveau 2, il contamine ses voisins (de plus en plus sûrement), et une gare contamine les autres gares de sa ligne. Un foyer caché ne se révèle qu’au niveau 3. Les parcs, peu denses, résistent mieux. ${T('tests')} ${T('vaccin')} ${T('confine')} ${T('hopital')}`;
    }
  }

  protected pick(id: ToolId): void {
    if (this.over()) return;
    const on = this.tool() === id ? null : id;
    this.tool.set(on);
    this.info.set(on ? `${TOOLS[on].icon} ${TOOLS[on].name} : ${TOOLS[on].desc} Touchez une case encadrée.` : 'Touchez une case pour l’inspecter.');
  }

  protected tap(i: number): void {
    if (this.over() || this.busy()) return;
    const t = this.tool();
    this.focus.set(i);
    if (!t) { this.info.set(this.describe(i)); return; }
    const why = this.sim.check(t, i);
    if (why) { this.info.set(`${coord(i)} : ${why}`); return; }
    this.undo.push(structuredClone(this.sim.s));
    const msg = this.sim.apply(t, i);
    this.info.set(msg);
    this.say(msg);
    if (this.sim.s.ap < TOOLS[t].cost || (TOOLS[t].limited && !(this.sim.s.uses[t]! > 0))) this.tool.set(null);
    this.bump();
  }

  protected undoLast(): void {
    const prev = this.undo.pop();
    if (!prev || this.over()) return;
    this.sim.s = prev;
    this.log.update(l => l.slice(1));
    this.info.set('Action annulée.');
    this.bump();
  }

  private describe(i: number): string {
    const v = this.view()[i];
    const p = this.sim.forecast().get(i);
    return v.aria + (p !== undefined && p > 0 && p < 0.25 ? `, faible menace (${Math.round(p * 100)} %)` : '') + '.';
  }

  protected endTurn(): void {
    if (this.over() || this.busy()) return;
    this.busy.set(true);
    this.focus.set(null);
    const r = this.sim.endTurn();
    this.undo = [];
    for (const e of [...r.events].reverse()) this.say(e);
    if (r.lost) this.miss.emit();
    this.info.set(r.events.join(' '));
    this.fresh.set(new Set(this.sim.s.fresh));
    this.bump();
    this.timers.push(setTimeout(() => this.fresh.set(new Set()), 1000));
    this.timers.push(setTimeout(() => this.busy.set(false), 250));
    if (this.sim.s.over) this.finish();
    else if (this.tool() && this.sim.s.ap < TOOLS[this.tool()!].cost) this.tool.set(null);
  }

  private finish(): void {
    if (this.over()) return;
    this.over.set(true);
    this.tool.set(null);
    const o = this.sim.outcome();
    const { best, worst } = this.sim.review();
    const v = this.variant;
    const title = o.score >= 0.85 ? (v === 'feux' ? 'Le feu est fixé : les villages sont saufs. Les pompiers saluent votre sang-froid.' : v === 'crue' ? 'La décrue s’amorce : la vallée a tenu. Un modèle de gestion de crise.' : 'L’épidémie reflue : la ville a tenu bon. Les épidémiologistes saluent votre réactivité.')
      : o.score >= 0.65 ? 'Une crise maîtrisée, au prix de quelques pertes.'
      : o.score >= 0.45 ? 'Une gestion inégale : la presse parle de « retard à l’allumage ».'
      : (v === 'feux' ? 'Les flammes ont tout emporté : la cellule de crise est pointée du doigt.' : v === 'crue' ? 'La vallée est sinistrée : on parle déjà de commission d’enquête.' : 'L’épidémie a débordé : les hôpitaux réclament des comptes.');
    this.summary.set({ title, o, best, worst });
    if (o.score < 0.45) this.miss.emit();
    this.progress.emit({ live: o.score, time: 0 });
    this.timers.push(setTimeout(() => this.done.emit(Math.max(0.05, o.score)), 2200));
  }

  private bump(): void { this.ver.update(v => v + 1); this.emitProgress(); }
  private emitProgress(): void {
    const s = this.sim.s;
    this.progress.emit({ live: this.sim.outcome().score, time: s.over ? 0 : Math.max(0, 1 - (s.turn - 1) / s.maxTurns) });
  }
  private say(t: string): void { this.log.update(l => [t, ...l].slice(0, 8)); }

  protected pct(f: number): string { return `${Math.round(f * 100)} %`; }
  protected fmt(n: number): string { return fmtPop(n); }
}

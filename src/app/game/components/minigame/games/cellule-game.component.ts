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
 *  Rendu « salle de crise » : une carte opérationnelle vue du
 *  ciel, dessinée en SVG (textures, relief, eau, feu, fumées),
 *  sous une grille de boutons transparents qui portent le jeu.
 * ============================================================ */

interface CellView { i: number; cls: string; sub: string; badges: IconId[]; corner: string; mark: string; aria: string }
interface Sum { title: string; o: Outcome; best: string; worst: string }
/** Une forme de la carte : tracé, classe, remplissage, transformation, style */
interface Shape { d: string; c?: string; f?: string; t?: string; s?: string }
interface Scene { soft: Shape[]; ground: Shape[]; lines: Shape[]; build: Shape[]; over: Shape[]; fire: Shape[]; smoke: Shape[]; top: Shape[] }
interface LegendItem { label: string; fills: string[]; icon?: IconId }

type IconId = ToolId | 'people' | 'virus' | 'shield' | 'eye' | 'check' | 'warn' | 'gauge' | 'rain';
interface IconPart { d: string; c?: 'f' | 'hl' | 'ln' | 'lnhl' | 'fw' | 'fe' }

/* ── Pictogrammes (24 × 24), dessinés à la main ── */

const cap = (x: number, y: number, w: number, h = 3.6) => `M${x + h / 2} ${y}h${w - h}a${h / 2} ${h / 2} 0 0 1 0 ${h}h${-(w - h)}a${h / 2} ${h / 2} 0 0 1 0 ${-h}z`;
const virusD = (() => {
  let knobs = '', spikes = '';
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
    const kx = 12 + c * 9, ky = 12 + s * 9;
    knobs += `M${(kx - 1.4).toFixed(2)} ${ky.toFixed(2)}a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0z`;
    spikes += `M${(12 + c * 5).toFixed(2)} ${(12 + s * 5).toFixed(2)}L${(12 + c * 8).toFixed(2)} ${(12 + s * 8).toFixed(2)}`;
  }
  return { knobs, spikes };
})();

const ICONS: Record<IconId, { parts: IconPart[]; t?: string }> = {
  pompiers: { parts: [
    { d: 'M1.5 8.6h13v2.6h4.1c.5 0 .9.2 1.2.6l2.4 3.1c.2.3.3.6.3.9v2.6c0 .5-.4.9-.9.9H1.5z' },
    { d: 'M2 5.6h12v1H2zM3.6 6.6h.9v2h-.9zM7 6.6h.9v2H7zM10.4 6.6h.9v2h-.9z' },
    { d: 'M15.4 12.4h3l1.9 2.5h-4.9zM2.6 14.6h11v1.1h-11z', c: 'hl' },
    { d: 'M3.4 19.3a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0-4.6 0zM15.4 19.3a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0-4.6 0z', c: 'fw' },
  ] },
  canadair: { parts: [
    { d: 'M22.5 12.6c0-.9-.7-1.6-1.6-1.6H8L4.6 6.8H3.1l.6 4.6c-.9.3-1.5 1.1-1.5 2v.8c0 .9.7 1.6 1.6 1.6H18c2.5 0 4.5-1.4 4.5-3.2z' },
    { d: 'M1.6 6h4.4v.9H1.6zM7 9.2h12v1.1H7zM10 7.6h3v2.2h-3zM14.6 7.6h3v2.2h-3zM8.6 10.3h.5v6.4h-.5zM7 16.7h3.6v.9H7z' },
    { d: 'M19.6 11.6h1.6l.7 1h-2.3z', c: 'hl' },
    { d: 'M12.2 17.4c-.4 1.4-1.1 2.7-2.3 3.9M14.8 17.4c-.2 1.4-.6 2.7-1.4 3.9M17.3 17.4c0 1.3-.2 2.6-.7 3.8', c: 'ln' },
  ] },
  coupefeu: { parts: [
    { d: 'M4 8h6.2l1 4.2H17v4H4zM13.6 9.6h1v2.6h-1zM16.6 13.4l2.9-1.2.5 1.1-2.9 1.3zM19.4 10.2l2.4-.5c.4 2.2.4 7.4 0 11.6l-2.4.2c.5-3.6.5-7.6 0-11.3z' },
    { d: 'M4.4 16.8h12.2a2.1 2.1 0 0 1 0 4.2H4.4a2.1 2.1 0 0 1 0-4.2z' },
    { d: 'M5.2 9.2h4.1l.7 3H5.2zM3.6 18.9a.8.8 0 1 0 1.6 0a.8.8 0 0 0-1.6 0zM7.7 18.9a.8.8 0 1 0 1.6 0a.8.8 0 0 0-1.6 0zM11.8 18.9a.8.8 0 1 0 1.6 0a.8.8 0 0 0-1.6 0zM15.8 18.9a.8.8 0 1 0 1.6 0a.8.8 0 0 0-1.6 0z', c: 'hl' },
  ] },
  evac: { parts: [
    { d: 'M1.5 7.2c0-.8.6-1.4 1.4-1.4h15.7c1.3 0 2.4.9 2.7 2.1l1.2 4.9v5.4c0 .6-.4 1-1 1H2.5c-.6 0-1-.4-1-1z' },
    { d: 'M3.1 7.4h3.4v4.1H3.1zM7.6 7.4H11v4.1H7.6zM12.1 7.4h3.4v4.1h-3.4zM16.6 7.4h2c.5 0 .9.3 1 .8l.8 3.3h-3.8zM2.6 13.4h19v.9h-19z', c: 'hl' },
    { d: 'M4.2 19.2a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0-4.2 0zM15.2 19.2a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0-4.2 0z', c: 'fw' },
  ] },
  digue: { parts: [
    { d: cap(1.5, 16.6, 6.6) + cap(8.7, 16.6, 6.6) + cap(15.9, 16.6, 6.6) + cap(5.1, 12.6, 6.6) + cap(12.3, 12.6, 6.6) + cap(8.7, 8.6, 6.6), c: 'fw' },
    { d: 'M1.5 5.6c1.2-.9 2.3-.9 3.5 0s2.3.9 3.5 0M15.5 5.6c1.2-.9 2.3-.9 3.5 0s2.3.9 3.5 0', c: 'ln' },
  ] },
  pompe: { parts: [
    { d: 'M2 9.5h8.5V17H2zM11.2 13.6a3.8 3.8 0 1 0 7.6 0a3.8 3.8 0 1 0-7.6 0zM14 6.8h2.1v3.4H14zM1.3 17.6h18.5v1.6H1.3zM3 19.2h1.5v1.6H3zM16.5 19.2H18v1.6h-1.5zM10.5 12.6h1v2h-1z' },
    { d: 'M3.3 11h5.9v.8H3.3zM3.3 12.9h5.9v.8H3.3zM3.3 14.8h5.9v.8H3.3zM13.9 13.6a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0z', c: 'hl' },
    { d: 'M15 6.6c0-2.2 2-3.2 4-3.2s2.8 1.2 3.5 2.6', c: 'ln' },
  ] },
  bassin: { parts: [
    { d: 'M2.5 4.5h19v15h-19zM4.8 6.8v10.4h14.4V6.8z', c: 'fe' },
    { d: 'M10.8 2h2.4v4h-2.4z' },
    { d: 'M6.6 10.4c1-.8 2-.8 3 0s2 .8 3 0 2-.8 3 0M6.6 14c1-.8 2-.8 3 0s2 .8 3 0 2-.8 3 0', c: 'ln' },
  ] },
  tests: { t: 'rotate(28 12 12)', parts: [
    { d: 'M8.6 2.4h6.8v1.8H8.6zM9.7 11.2h4.6v5.6a2.3 2.3 0 0 1-4.6 0z' },
    { d: 'M9.7 4.2v12.6a2.3 2.3 0 0 0 4.6 0V4.2', c: 'ln' },
    { d: 'M11 13.4a.6.6 0 1 0 1.2 0a.6.6 0 0 0-1.2 0zM12.4 15.6a.45.45 0 1 0 .9 0a.45.45 0 0 0-.9 0z', c: 'hl' },
  ] },
  vaccin: { t: 'rotate(-40 12 12)', parts: [
    { d: 'M1 9.6h1.3v4.8H1zM2.3 11.4h3.5v1.2H2.3zM5.8 8.8h1v6.4h-1zM10.6 9.9h5.6v4.2h-5.6zM16.2 10.9h2.2v2.2h-2.2zM18.4 11.65h4.4v.7h-4.4z' },
    { d: 'M6.8 9.9h9.4v4.2H6.8z', c: 'ln' },
    { d: 'M12 9.9h.5v1.6H12zM14 9.9h.5v1.6H14z', c: 'hl' },
  ] },
  confine: { parts: [
    { d: 'M1.5 7.5h21v5.2h-21zM4.6 12.7H6v7.2H4.6zM18 12.7h1.4v7.2H18zM2.8 19.4h5v1.4h-5zM16.2 19.4h5v1.4h-5zM11.2 4.4h1.6v3.1h-1.6zM10.6 3.2h2.8v1.4h-2.8z' },
    { d: 'M4.4 7.5h3.1l-4.4 5.2H1.5v-1.8zM10.4 7.5h3.2l-4.4 5.2H6zM16.6 7.5h3.2l-4.4 5.2h-3.2zM22.5 8.6v4.1H19z', c: 'hl' },
  ] },
  hopital: { parts: [
    { d: 'M1.5 19.5L7 6.5h10l5.5 13zM.8 19.5h22.4v1.3H.8z' },
    { d: 'M9.8 19.5l2.2-5.4 2.2 5.4zM11.1 8.2h1.8v1.6h1.6v1.8h-1.6v1.6h-1.8v-1.6H9.5V9.8h1.6z', c: 'hl' },
  ] },
  people: { parts: [
    { d: 'M9 4.5a3 3 0 1 1 0 6a3 3 0 0 1 0-6zM3 19.5c0-3.3 2.7-6 6-6s6 2.7 6 6v.5H3zM16.5 6.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5zM15.9 13.3c2.9.2 5.1 2.6 5.1 5.5V20h-4.4v-.5c0-2.4-.3-4.4-.7-6.2z' },
  ] },
  virus: { parts: [
    { d: 'M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0z' + virusD.knobs },
    { d: virusD.spikes, c: 'ln' },
    { d: 'M9.6 10.6a1 1 0 1 0 2 0a1 1 0 0 0-2 0zM12.6 13.4a.8.8 0 1 0 1.6 0a.8.8 0 0 0-1.6 0z', c: 'hl' },
  ] },
  shield: { parts: [
    { d: 'M12 2.5l7.5 3v5.8c0 4.6-3.2 8.6-7.5 10.2-4.3-1.6-7.5-5.6-7.5-10.2V5.5z' },
    { d: 'M8.6 12.2l2.4 2.4 4.6-4.8', c: 'lnhl' },
  ] },
  eye: { parts: [
    { d: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0zM4 20L20 4', c: 'ln' },
  ] },
  check: { parts: [
    { d: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0z' },
    { d: 'M7.4 12.3l3 3 6.2-6.4', c: 'lnhl' },
  ] },
  warn: { parts: [
    { d: 'M12 2.8l10.2 17.6H1.8z' },
    { d: 'M11.1 8.6h1.8l-.3 6.2h-1.2zM11.1 16.2h1.8V18h-1.8z', c: 'hl' },
  ] },
  gauge: { parts: [
    { d: 'M9 2.5h6v19H9z', c: 'ln' },
    { d: 'M9 6h3.2v1.2H9zM9 10h3.2v1.2H9zM9 14h3.2v1.2H9zM9 18h3.2v1.2H9z' },
    { d: 'M1.5 15.5c1.2-.9 2.3-.9 3.5 0s2.3.9 3.5 0M15.5 15.5c1.2-.9 2.3-.9 3.5 0s2.3.9 3.5 0', c: 'ln' },
  ] },
  rain: { parts: [
    { d: 'M7 15.2a4.4 4.4 0 0 1-.7-8.8 6 6 0 0 1 11.4 1.7 3.6 3.6 0 0 1-.2 7.1z' },
    { d: 'M8 18l-1 2.6M12 18l-1 2.6M16 18l-1 2.6', c: 'ln' },
  ] },
};
const ICON_LIST = (Object.keys(ICONS) as IconId[]).map(id => ({ id, ...ICONS[id] }));

/* ── Géométrie de la carte : une case = 10 unités ── */

const r2 = (v: number) => Math.round(v * 100) / 100;
const rectD = (x: number, y: number, w: number, h: number) => `M${r2(x)} ${r2(y)}h${r2(w)}v${r2(h)}h${r2(-w)}Z`;
const ellD = (x: number, y: number, rx: number, ry = rx) => `M${r2(x - rx)} ${r2(y)}a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(2 * rx)} 0a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-2 * rx)} 0Z`;
const cellsD = (ids: number[], pad = 0.4) => ids.map(i => rectD(cx(i) * 10 - pad, cy(i) * 10 - pad, 10 + 2 * pad, 10 + 2 * pad)).join('');
/** Pseudo-hasard stable : une case garde son allure d’un rendu à l’autre */
const hh = (i: number, k: number): number => {
  let t = (Math.imul(i + 1, 374761393) + Math.imul(k + 7, 668265263)) >>> 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
};
/** Motifs : houppiers de forêt, buissons de garrigue, blocs rocheux */
const CROWNS = [[2.2, 2.3, 1.9], [6.3, 1.7, 1.6], [10, 2.8, 1.8], [3.7, 6.3, 1.7], [7.8, 5.9, 2.1], [11.2, 7.6, 1.4], [1.7, 9.9, 1.6], [5.6, 10.1, 1.8], [9.5, 10.6, 1.5]];
const SHRUBS = [[1.5, 1.8, 1, .7], [5.2, 1.1, .8, .6], [7.4, 3.6, 1.1, .8], [2.6, 5.1, .9, .7], [5.7, 6.6, .7, .55], [1.2, 8, .8, .6], [7.9, 7.9, .9, .7], [4, 3.2, .5, .4]];
const BOULDERS = ['M2 3l1.6-1.4 2 .3.8 1.7-1.1 1.6-2.2.1z', 'M7 6.6l1.3-1 1.8.4.4 1.4-1.2 1.2-1.8-.3z', 'M2.6 8.4l1-.8 1.3.3.3 1-.9.8-1.3-.1z', 'M8.4 1.4l.9-.6 1 .3.1.9-.8.6-1-.2z'];
const ELEV = ['#5f7a45', '#6f8a4e', '#86995a', '#9ea56a', '#b3ab7c', '#c5b992'];
const ROOF_FEUX = ['#b8653f', '#c27650', '#a85a3a', '#c9845e', '#b46e4c'];
const ROOF_VILLE = ['#9c5a43', '#8c8984', '#a8634a', '#77756f', '#b06d4f', '#9a9690'];
const LEVEL = ['#e9ecd9', '#f6dc8c', '#f2a14f', '#d9542f', '#8f1d1d'];
const LINE_COL = ['#2f4fc4', '#a8329e'];

const BRIEF: Record<Variant, string> = {
  feux: 'Le feu avance à chaque fin de tour : toujours dans le sens du vent, souvent en éventail, parfois sur les côtés. Protégez les villages.',
  crue: 'L’eau gagne une case par tour vers toute case plus basse que la cote. Une ville sous l’eau perd des habitants à chaque tour.',
  epidemie: 'Un district contaminé progresse d’un niveau par tour ; à partir du niveau 2, il contamine ses voisins et sa ligne de transport.',
};

let uidSeq = 0;

@Component({
  selector: 'app-cellule-game',
  template: `
    @let o = live();
    <div class="cc" [class]="'cc v-' + variant">
      <svg class="defs" aria-hidden="true" focusable="false" width="0" height="0">
        <defs>
          @for (ic of icons; track ic.id) {
            <symbol [attr.id]="uid + '-i-' + ic.id" viewBox="0 0 24 24">
              <g [attr.transform]="ic.t ?? null">@for (p of ic.parts; track $index) { <path [attr.d]="p.d" [attr.class]="'ic-' + (p.c ?? 'f')" /> }</g>
            </symbol>
          }
          <filter [attr.id]="uid + '-rough'" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter [attr.id]="uid + '-soft'" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="2.6" /></filter>
          <filter [attr.id]="uid + '-grain'" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="11" /><feColorMatrix type="saturate" values="0" />
          </filter>
          <radialGradient [attr.id]="uid + '-crown'" cx=".5" cy=".5" r=".5" fx=".36" fy=".34">
            <stop offset="0" stop-color="#7aa257" /><stop offset=".55" stop-color="#46692f" /><stop offset="1" stop-color="#2b4420" />
          </radialGradient>
          <radialGradient [attr.id]="uid + '-glow'">
            <stop offset="0" stop-color="#ffe7a3" stop-opacity=".95" /><stop offset=".22" stop-color="#ffaa3a" stop-opacity=".9" /><stop offset=".55" stop-color="#e2501b" stop-opacity=".55" /><stop offset="1" stop-color="#8a1a06" stop-opacity="0" />
          </radialGradient>
          <radialGradient [attr.id]="uid + '-smoke'">
            <stop offset="0" stop-color="#e9e6e1" stop-opacity=".62" /><stop offset=".5" stop-color="#cdc8c1" stop-opacity=".34" /><stop offset="1" stop-color="#b8b2aa" stop-opacity="0" />
          </radialGradient>
          <radialGradient [attr.id]="uid + '-lake'" fx=".45" fy=".42">
            <stop offset="0" stop-color="#1f4d6e" /><stop offset=".7" stop-color="#3a7092" /><stop offset="1" stop-color="#6f9db3" />
          </radialGradient>
          <linearGradient [attr.id]="uid + '-shL'" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#2a2414" stop-opacity=".62" /><stop offset="1" stop-color="#2a2414" stop-opacity="0" /></linearGradient>
          <linearGradient [attr.id]="uid + '-shT'" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2a2414" stop-opacity=".62" /><stop offset="1" stop-color="#2a2414" stop-opacity="0" /></linearGradient>
          <linearGradient [attr.id]="uid + '-liL'" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fffbe6" stop-opacity=".5" /><stop offset="1" stop-color="#fffbe6" stop-opacity="0" /></linearGradient>
          <linearGradient [attr.id]="uid + '-liT'" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fffbe6" stop-opacity=".5" /><stop offset="1" stop-color="#fffbe6" stop-opacity="0" /></linearGradient>
          <pattern [attr.id]="uid + '-foret'" patternUnits="userSpaceOnUse" width="12.4" height="12.4" patternTransform="rotate(23)">
            <rect width="12.4" height="12.4" fill="#22371b" />
            @for (k of crowns; track $index) { <circle [attr.cx]="k[0]" [attr.cy]="k[1]" [attr.r]="k[2]" [attr.fill]="u('crown')" /> }
          </pattern>
          <pattern [attr.id]="uid + '-garrigue'" patternUnits="userSpaceOnUse" width="9.3" height="9.3" patternTransform="rotate(11)">
            <rect width="9.3" height="9.3" fill="#a59d66" />
            <path d="M0 4.6h9.3M4.6 0v9.3" stroke="#b3ab75" stroke-width="1.6" opacity=".5" />
            @for (k of shrubs; track $index) { <ellipse [attr.cx]="k[0]" [attr.cy]="k[1]" [attr.rx]="k[2]" [attr.ry]="k[3]" [attr.fill]="$index % 3 ? '#5c6638' : '#76804a'" /> }
          </pattern>
          <pattern [attr.id]="uid + '-prairie'" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(-14)">
            <rect width="7" height="7" fill="#bcb67f" />
            <path d="M1 1.4l.5-1M3.6 4.4l.4-1M5.6 1.9l.5-1M1.8 5.8l.4-1" stroke="#9f9a62" stroke-width=".45" />
            <path d="M2.5 2.6l.4-.9M5 5.6l.5-.9M6.3 3.6l.3-.8" stroke="#d0cb95" stroke-width=".45" />
          </pattern>
          <pattern [attr.id]="uid + '-roche'" patternUnits="userSpaceOnUse" width="11" height="11" patternTransform="rotate(31)">
            <rect width="11" height="11" fill="#8a867c" />
            @for (b of boulders; track $index) { <path [attr.d]="b" fill="#5f5c55" transform="translate(.5 .6)" /><path [attr.d]="b" fill="#b4afa3" /> }
          </pattern>
          <pattern [attr.id]="uid + '-coupe'" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(35)">
            <rect width="5" height="5" fill="#ad8c61" />
            <path d="M0 1.2h5M0 3.7h5" stroke="#8d6f4a" stroke-width=".7" stroke-dasharray="1.6 .5" />
            <circle cx="2.4" cy="2.5" r=".35" fill="#5e4630" />
          </pattern>
          <pattern [attr.id]="uid + '-vground'" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(8)">
            <rect width="8" height="8" fill="#b4ad83" />
            <path d="M.4 .4h3.4v3.2H.4zM4.4 4.4h3.2v3.2H4.4z" fill="#c4bd92" />
            <path d="M4.2 .4h3.4v3.2H4.2z" fill="#9fa16a" />
          </pattern>
          <pattern [attr.id]="uid + '-char'" patternUnits="userSpaceOnUse" width="12.4" height="12.4" patternTransform="rotate(23)">
            <rect width="12.4" height="12.4" fill="#36312d" />
            <path d="M0 3.1h12.4M0 9.3h12.4" stroke="#413b36" stroke-width="2.2" />
            @for (k of crowns; track $index) { <circle [attr.cx]="k[0]" [attr.cy]="k[1]" [attr.r]="k[2] * .62" fill="#2b2724" /> }
            <path d="M2 4.6l.6-.4M8.8 8.1l.5-.5M5.1 11.6l.6-.3M10.9 1.6l.4-.5" stroke="#6b645d" stroke-width=".3" />
          </pattern>
          <pattern [attr.id]="uid + '-embers'" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(13)">
            <rect width="6" height="6" fill="#2e1710" />
            <path d="M.4 1.4c.8-.5 1.6.3 2.4-.2M3.2 4.2c.7-.4 1.5.2 2.3-.3M.8 4.9c.5-.3 1 .1 1.5-.2" fill="none" stroke="#c23c16" stroke-width=".7" stroke-linecap="round" />
            <path d="M.7 1.3c.6-.3 1.2.1 1.8-.1M3.5 4.1c.5-.2 1 .1 1.6-.2" fill="none" stroke="#ffad42" stroke-width=".3" stroke-linecap="round" />
            <circle cx="4.6" cy="1.3" r=".28" fill="#ffd877" /><circle cx="1.7" cy="3.1" r=".22" fill="#ff9a35" />
          </pattern>
          <pattern [attr.id]="uid + '-spray'" patternUnits="userSpaceOnUse" width="2.6" height="2.6">
            <rect width="2.6" height="2.6" fill="#4f95d6" fill-opacity=".26" /><circle cx=".7" cy=".8" r=".32" fill="#dcefff" fill-opacity=".7" /><circle cx="2" cy="2" r=".22" fill="#dcefff" fill-opacity=".55" />
          </pattern>
          <pattern [attr.id]="uid + '-retard'" patternUnits="userSpaceOnUse" width="3.6" height="3.6" patternTransform="rotate(32)">
            <rect width="3.6" height="3.6" fill="#d8475f" fill-opacity=".3" /><path d="M0 1h3.6" stroke="#c2264a" stroke-opacity=".55" stroke-width="1" />
          </pattern>
          <pattern [attr.id]="uid + '-champ'" patternUnits="userSpaceOnUse" width="4" height="1.4" patternTransform="rotate(-6)">
            <rect width="4" height="1.4" fill="#c7b25c" /><path d="M0 .7h4" stroke="#a59140" stroke-width=".5" />
          </pattern>
          <pattern [attr.id]="uid + '-furrow'" patternUnits="userSpaceOnUse" width="1.3" height="1.3" patternTransform="rotate(52)">
            <path d="M0 .65h1.3" stroke="#3d3415" stroke-opacity=".22" stroke-width=".4" />
          </pattern>
          <pattern [attr.id]="uid + '-urban'" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(-9)">
            <rect width="5" height="5" fill="#cfc8b8" /><path d="M.5 .5h4v4h-4z" fill="#bdb6a6" />
          </pattern>
          <pattern [attr.id]="uid + '-ripple'" patternUnits="userSpaceOnUse" width="6" height="2.6" patternTransform="rotate(-8)">
            <path d="M.4 .8h1.8M3.4 2h1.9" fill="none" stroke="#e6f3ff" stroke-opacity=".22" stroke-width=".22" stroke-linecap="round" />
          </pattern>
          <pattern [attr.id]="uid + '-streets'" patternUnits="userSpaceOnUse" width="4.6" height="4.6" patternTransform="rotate(-7)">
            <rect width="4.6" height="4.6" fill="#f2efe8" /><path d="M.45 .45h3.7v3.7H.45z" fill="#dcd8ce" />
          </pattern>
          <pattern [attr.id]="uid + '-dense'" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(-7)">
            <rect width="3" height="3" fill="#ece8df" /><path d="M.3 .3h2.4v2.4H.3z" fill="#c9c2b5" />
          </pattern>
          <pattern [attr.id]="uid + '-park'" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(12)">
            <rect width="6" height="6" fill="#b3cc98" /><path d="M0 4.6c2-.6 4 .6 6 0" fill="none" stroke="#e9e2c8" stroke-width=".45" />
            <circle cx="1.4" cy="1.5" r=".95" fill="#86a96a" /><circle cx="4.3" cy="2.4" r="1.1" fill="#7aa060" /><circle cx="2.8" cy="3.4" r=".6" fill="#8fb373" />
          </pattern>
          <pattern [attr.id]="uid + '-hatch'" patternUnits="userSpaceOnUse" width="2.2" height="2.2" patternTransform="rotate(45)">
            <rect width="2.2" height="2.2" fill="#7e7c76" fill-opacity=".48" /><path d="M0 1.1h2.2" stroke="#f4f2ec" stroke-opacity=".5" stroke-width=".5" />
          </pattern>
        </defs>
      </svg>

      <div class="head">
        <span class="hd">Tour <b class="mono">{{ turn() }}</b><small>/{{ maxTurns }}</small></span>
        <span class="ap" [attr.aria-label]="'Points d’action : ' + apLeft() + ' sur ' + apMax">
          <small>PA</small> @for (on of apDots(); track $index) { <i [class.on]="on"></i> }
        </span>
        <span class="safe" title="Population épargnée"><svg class="hi" aria-hidden="true"><use [attr.href]="'#' + uid + '-i-people'" /></svg> <b class="mono">{{ pct(o.frac) }}</b></span>
      </div>

      <div class="cond">
        @switch (variant) {
          @case ('feux') {
            <svg class="rose" viewBox="-22 -22 44 44" aria-hidden="true">
              <circle r="20" class="r-bg" /><circle r="16.5" class="r-ring" />
              <path class="r-tick" [attr.d]="roseTicks" />
              <text y="-17.6" class="r-n">N</text><text x="18.2" y=".2" class="r-l">E</text><text y="18.2" class="r-l">S</text><text x="-18.2" y=".2" class="r-l">O</text>
              @if (nextDeg() !== null) { <path class="r-ghost" d="M0 -14L4.6 5 0 2.2-4.6 5Z" [attr.transform]="'rotate(' + nextDeg() + ')'" /> }
              <path class="r-arrow" [class.gusty]="force() > 1" d="M0 -14.5L5 5.6 0 2.4-5 5.6Z" [attr.transform]="'rotate(' + windDeg() + ')'" />
              <circle r="1.6" class="r-hub" />
            </svg>
            <div class="ct">
              <span class="wind"><b>Vent {{ windName() }}</b>@if (force() > 1) { <em class="gust">rafales</em> }</span>
              @if (windNext(); as n) { <span class="next"><svg class="hi warn" aria-hidden="true"><use [attr.href]="'#' + uid + '-i-warn'" /></svg> {{ n }}</span> }
              @else { <span class="next dim">Pas de changement annoncé</span> }
            </div>
          }
          @case ('crue') {
            @let g = gauge();
            <svg class="gauge" viewBox="0 0 30 62" aria-hidden="true">
              <rect x="9" y="3" width="12" height="54" rx="1.5" class="g-bg" />
              <rect x="9" [attr.y]="g.y" width="12" [attr.height]="57 - g.y" class="g-water" />
              @if (g.ny !== g.y) { <path class="g-next" [attr.d]="'M5 ' + g.ny + 'H25'" /> }
              @for (t of g.ticks; track t.v) { <path class="g-tick" [attr.d]="'M9 ' + t.y + 'h' + (t.v % 2 ? 3 : 5)" /> @if (t.v % 2 === 0) { <text x="7.5" [attr.y]="t.y + 1.3" class="g-l">{{ t.v }}</text> } }
              <rect x="9" y="3" width="12" height="54" rx="1.5" class="g-frame" />
            </svg>
            <div class="ct">
              <span><b>Cote {{ level() }}</b> <small>à l’échelle de crue</small></span>
              <span class="next"><svg class="hi" aria-hidden="true"><use [attr.href]="'#' + uid + '-i-rain'" /></svg> {{ rainText() }}</span>
            </div>
          }
          @case ('epidemie') {
            <div class="ramp" aria-hidden="true">@for (c of levelColors; track $index) { <i [style.background]="c"><b>{{ $index }}</b></i> }</div>
            <div class="ct">
              <span><svg class="hi" aria-hidden="true"><use [attr.href]="'#' + uid + '-i-virus'" /></svg> <b>Contaminés {{ cases() }}</b></span>
              <span class="next"><svg class="hi" aria-hidden="true"><use [attr.href]="'#' + uid + '-i-eye'" /></svg> {{ hiddenCount() }} districts non surveillés@if (malus()) { · popularité −{{ malus() }} }</span>
            </div>
          }
        }
      </div>

      @if (!over()) { <p class="brief">{{ brief }}</p> }

      <div class="board-wrap">
        <div class="board">
          <div class="ax-top" aria-hidden="true">@for (l of letters; track l) { <span>{{ l }}</span> }</div>
          <div class="ax-left" aria-hidden="true">@for (row of rows; track row) { <span>{{ row + 1 }}</span> }</div>
          <div class="field">
            @let sc = scene();
            <svg class="map" viewBox="0 0 90 70" aria-hidden="true">
              <rect width="90" height="70" [attr.fill]="bgFill" />
              <g [attr.filter]="u('soft')">@for (p of sc.soft; track $index) { <path [attr.d]="p.d" [attr.fill]="p.f ?? null" [attr.class]="p.c ?? null" /> }</g>
              <g [attr.filter]="u('rough')">@for (p of sc.ground; track $index) { <path [attr.d]="p.d" [attr.fill]="p.f ?? null" [attr.class]="p.c ?? null" [attr.transform]="p.t ?? null" /> }</g>
              @for (p of sc.lines; track $index) { <path [attr.d]="p.d" [attr.class]="p.c ?? null" [attr.stroke]="p.f ?? null" /> }
              @for (p of sc.build; track $index) { <path [attr.d]="p.d" [attr.fill]="p.f ?? null" [attr.class]="p.c ?? null" [attr.transform]="p.t ?? null" /> }
              <g [attr.filter]="u('rough')">@for (p of sc.over; track $index) { <path [attr.d]="p.d" [attr.fill]="p.f ?? null" [attr.class]="p.c ?? null" /> }</g>
              @for (p of sc.fire; track $index) { <path [attr.d]="p.d" [attr.fill]="p.f ?? null" [attr.class]="p.c ?? null" [style]="p.s ?? null" /> }
              @if (variant !== 'epidemie') { <rect width="90" height="70" class="grain" [attr.filter]="u('grain')" /> }
              <path class="grid" [attr.d]="gridD" />
              @for (p of sc.top; track $index) { <path [attr.d]="p.d" [attr.fill]="p.f ?? null" [attr.class]="p.c ?? null" [style]="p.s ?? null" /> }
              @for (p of sc.smoke; track $index) { <path [attr.d]="p.d" [attr.fill]="u('smoke')" class="puff" [attr.transform]="p.t ?? null" [style]="p.s ?? null" /> }
            </svg>
            <div class="grid-btns" role="grid" [attr.aria-label]="'Carte de crise, ' + maxTurns + ' tours'">
              @for (c of view(); track c.i) {
                <button type="button" [class]="c.cls" [attr.aria-label]="c.aria" [disabled]="over()" (click)="tap(c.i)">
                  @if (c.corner) { <span class="corner">{{ c.corner }}</span> }
                  @if (c.badges.length) { <span class="badge">@for (b of c.badges; track b) { <svg aria-hidden="true"><use [attr.href]="'#' + uid + '-i-' + b" /></svg> }</span> }
                  @if (c.mark) { <span class="ic">{{ c.mark }}</span> }
                  @if (c.sub) { <span class="sub">{{ c.sub }}</span> }
                </button>
              }
            </div>
          </div>
        </div>
      </div>

      @if (!over()) {
        <div class="tools" role="toolbar" aria-label="Moyens">
          @for (t of toolView(); track t.id) {
            <button type="button" class="tool" [class.sel]="tool() === t.id" [disabled]="!t.ok" [attr.aria-pressed]="tool() === t.id" (click)="pick(t.id)">
              <svg class="ti" aria-hidden="true"><use [attr.href]="'#' + uid + '-i-' + t.id" /></svg>
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
          <p class="rv"><svg class="hi ok" aria-hidden="true"><use [attr.href]="'#' + uid + '-i-check'" /></svg><span><b>Meilleure décision.</b> {{ sm.best }}</span></p>
          <p class="rv"><svg class="hi warn" aria-hidden="true"><use [attr.href]="'#' + uid + '-i-warn'" /></svg><span><b>Pire moment.</b> {{ sm.worst }}</span></p>
          <p class="score">Note de la cellule : <b class="mono">{{ round(sm.o.score * 100) }}/100</b></p>
        </div>
      }

      <details class="legend">
        <summary>Légende et règles</summary>
        <ul>
          @for (l of legend; track l.label) {
            <li>
              <svg class="sw" viewBox="0 0 10 10" aria-hidden="true">
                @for (f of l.fills; track $index) { <rect width="10" height="10" [attr.fill]="f" /> }
                @if (l.icon) { <use [attr.href]="'#' + uid + '-i-' + l.icon" x="1.5" y="1.5" width="7" height="7" class="sw-ic" /> }
              </svg>
              {{ l.label }}
            </li>
          }
        </ul>
        <p>{{ rules }}</p>
      </details>

      @if (log().length) { <ul class="log">@for (l of log(); track $index) { <li>{{ l }}</li> }</ul> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .cc { display: grid; gap: 7px; }
    .defs { position: absolute; width: 0; height: 0; overflow: hidden; }
    .ic-f { fill: currentColor; } .ic-hl { fill: var(--ic-hl, #fff); } .ic-fe { fill: currentColor; fill-rule: evenodd; }
    .ic-fw { fill: currentColor; stroke: var(--ic-hl, #fff); stroke-width: .9; }
    .ic-ln { fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .ic-lnhl { fill: none; stroke: var(--ic-hl, #fff); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .hi { width: 15px; height: 15px; flex: none; vertical-align: -3px; color: var(--ink-2); --ic-hl: var(--surface); }
    .hi.warn { color: #d08a12; } .hi.ok { color: var(--good); }
    .head { display: flex; flex-wrap: wrap; gap: 6px 12px; justify-content: space-between; align-items: center; font-size: 12.5px;
      small { color: var(--ink-3); font-size: 11px; } }
    .safe { display: inline-flex; align-items: center; gap: 4px; }
    .ap { display: inline-flex; gap: 4px; align-items: center; color: var(--ink-2);
      i { width: 14px; height: 6px; border-radius: 2px; border: 1px solid color-mix(in srgb, var(--accent) 70%, transparent); }
      i.on { background: var(--accent); border-color: var(--accent); } }
    /* Bandeau de conditions : la console de la cellule */
    .cond { display: flex; align-items: center; gap: 10px; padding: 6px 10px 6px 6px; border-radius: 10px; background: #1c222b; color: #dfe4ea; font-size: 12px; min-height: 56px;
      border: 1px solid #2c3540; box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
      .hi { color: #9fb0c3; --ic-hl: #1c222b; } .hi.warn { color: #f0b23e; }
      b { color: #fff; font-weight: 600; } small { color: #8e9aa8; } }
    .ct { display: grid; gap: 3px; min-width: 0; .hi { margin-right: 4px; } b + small, b + em { margin-left: 6px; } }
    .grain { opacity: .2; mix-blend-mode: overlay; pointer-events: none; }
    .next { color: #cdd5de; } .next.dim { color: #8e9aa8; }
    .gust { font-style: normal; padding: 1px 6px; border-radius: 4px; background: #5a2318; color: #ffb4a0; font-size: 10.5px; letter-spacing: .03em; text-transform: uppercase; }
    .rose { width: 46px; height: 46px; flex: none; }
    .r-bg { fill: #141920; } .r-ring { fill: none; stroke: #3c4856; stroke-width: .8; }
    .r-tick { stroke: #6b7a8b; stroke-width: .8; }
    .r-n, .r-l { font: 700 5px var(--font-body); fill: #8e9aa8; text-anchor: middle; dominant-baseline: middle; } .r-n { fill: #e3e8ee; }
    .r-arrow { fill: #f4f6f8; stroke: #141920; stroke-width: .6; transition: transform .6s ease; } .r-arrow.gusty { fill: #ff9a6e; }
    .r-ghost { fill: none; stroke: #f0b23e; stroke-width: .9; stroke-dasharray: 1.6 1; }
    .r-hub { fill: #141920; stroke: #8e9aa8; stroke-width: .5; }
    .gauge { width: 26px; height: 54px; flex: none; }
    .g-bg { fill: #141920; } .g-water { fill: #2f6ea6; transition: y .5s ease, height .5s ease; } .g-frame { fill: none; stroke: #4a5868; stroke-width: .8; }
    .g-tick { stroke: #c9d2dc; stroke-width: .6; } .g-l { font: 600 4.2px var(--font-mono); fill: #8e9aa8; text-anchor: end; }
    .g-next { stroke: #f0b23e; stroke-width: 1; stroke-dasharray: 1.6 1; }
    .ramp { display: flex; flex: none; border-radius: 4px; overflow: hidden; border: 1px solid #3c4856;
      i { display: grid; place-items: center; width: 17px; height: 22px; } b { font: 700 9.5px var(--font-mono); color: rgba(0,0,0,.6); } i:nth-child(n+4) b { color: rgba(255,255,255,.85); } }
    .brief { margin: 0; font-size: 12px; color: var(--ink-2); }
    /* La carte */
    .board-wrap { justify-self: center; width: 100%; max-width: 480px; }
    .board { display: grid; grid-template-columns: 12px 1fr; grid-template-rows: 13px auto; padding: 3px 4px 4px 2px; border-radius: 10px; background: #1a1f26; user-select: none;
      box-shadow: 0 1px 0 rgba(255,255,255,.05) inset, 0 6px 18px -10px rgba(0,0,0,.6); }
    .ax-top { grid-column: 2; display: grid; grid-template-columns: repeat(9, 1fr); }
    .ax-left { grid-column: 1; grid-row: 2; display: grid; grid-template-rows: repeat(7, 1fr); }
    .ax-top span, .ax-left span { display: grid; place-items: center; font: 600 9px var(--font-mono); color: #8e9aa8; }
    .field { grid-column: 2; grid-row: 2; position: relative; aspect-ratio: 9 / 7; border-radius: 3px; overflow: hidden; outline: 1px solid #3a4553; }
    .map { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .grid { fill: none; stroke: rgba(255, 255, 255, .17); stroke-width: .14; }
    .grid-btns { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(9, 1fr); grid-template-rows: repeat(7, 1fr); }
    .cell { position: relative; min-width: 0; min-height: 32px; border: 0; border-radius: 0; padding: 0; cursor: pointer; display: grid; place-items: center; overflow: hidden;
      background: transparent; font-family: var(--font-body); color: #fff; -webkit-tap-highlight-color: transparent;
      &:hover:not(:disabled) { box-shadow: inset 0 0 0 1px rgba(255,255,255,.55); }
      &:focus-visible { outline: 2px solid #f4d35e; outline-offset: -2px; z-index: 3; }
      &:disabled { cursor: default; } }
    .ic { font: 700 13px var(--font-body); color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.7); position: relative; z-index: 2; }
    .sub { position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); z-index: 2; padding: 0 3px; border-radius: 3px; white-space: nowrap;
      font: 700 8px/1.35 var(--font-mono); letter-spacing: -.02em; color: #fff; background: rgba(16, 20, 26, .74); }
    .v-epidemie .sub { background: rgba(16, 20, 26, .55); font-weight: 600; }
    .badge { position: absolute; top: 1px; right: 1px; z-index: 3; display: flex; gap: 1px;
      svg { width: 12px; height: 12px; padding: 1px; border-radius: 3px; background: rgba(255,255,255,.92); color: #1c2733; --ic-hl: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.4); } }
    .corner { position: absolute; top: 1px; left: 2px; z-index: 2; font: 700 8.5px var(--font-mono); color: #fff; text-shadow: 0 0 2px rgba(0,0,0,.9), 0 0 1px #000; }
    .v-crue .corner::before { content: ''; display: inline-block; width: 0; height: 0; margin-right: 1px; border: 2.5px solid transparent; border-bottom: 4px solid #fff; border-top: 0; vertical-align: 1px; }
    /* Prévisions et cibles */
    .fc1::before, .fc2::before { content: ''; position: absolute; inset: 1px; z-index: 1; pointer-events: none; border-radius: 1px; }
    .fc1::before { border: 1.5px dashed #ffbf2e; background: repeating-linear-gradient(45deg, transparent 0 5px, rgba(255, 191, 46, .26) 5px 7px); }
    .fc2::before { border: 1.5px solid #ff4a2b; background: repeating-linear-gradient(45deg, transparent 0 4px, rgba(255, 74, 43, .38) 4px 7px); animation: blink 1.4s ease-in-out infinite; }
    .ok::after { content: ''; position: absolute; inset: 2px; z-index: 2; pointer-events: none; border: 1.5px dashed rgba(255, 255, 255, .9); border-radius: 2px; box-shadow: 0 0 0 1px rgba(0,0,0,.25); }
    .focus { box-shadow: inset 0 0 0 2.5px #f4d35e !important; z-index: 2; }
    .fresh::after { content: ''; position: absolute; inset: 0; z-index: 2; pointer-events: none; border: 2px solid #fff; animation: ping .9s ease-out forwards; }
    @keyframes blink { 50% { opacity: .5; } }
    @keyframes ping { from { opacity: .9; transform: scale(.6); } to { opacity: 0; transform: scale(1.15); } }
    /* Feu, fumée */
    .glow { mix-blend-mode: screen; transform-box: fill-box; transform-origin: center; animation: flicker 1.7s ease-in-out infinite alternate; }
    .front { fill: none; stroke: #ffd77a; stroke-width: .45; stroke-linejoin: round; stroke-linecap: round; }
    .front-g { fill: none; stroke: #ff6a1a; stroke-width: 1.8; stroke-opacity: .55; stroke-linejoin: round; stroke-linecap: round; }
    .puff { transform-box: fill-box; transform-origin: center; animation: drift 5.5s linear infinite; pointer-events: none; }
    @keyframes flicker { 0% { opacity: .78; transform: scale(.94); } 45% { opacity: 1; transform: scale(1.04); } 100% { opacity: .86; transform: scale(.98); } }
    @keyframes drift { 0% { opacity: 0; translate: 0 0; scale: .7; } 18% { opacity: 1; } 100% { opacity: 0; translate: var(--dx) var(--dy); scale: 1.35; } }
    /* Lignes de la carte */
    .road-s { fill: none; stroke: #d8cfae; stroke-width: 3.8; }
    .road { fill: none; stroke: #4a4946; stroke-width: 2.8; }
    .road-c { fill: none; stroke: #ece6cb; stroke-width: .28; stroke-dasharray: 1.6 1.3; }
    .street { fill: none; stroke: #d9d1b6; stroke-width: .9; stroke-linecap: round; }
    .contour { fill: none; stroke: #3d3119; stroke-opacity: .5; stroke-width: .32; }
    .bank { fill: none; stroke: #3f5a2c; stroke-width: 8.4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 2.2 .6 1.4 .5; opacity: .9; }
    .sand { fill: none; stroke: #8a8662; stroke-width: 6.4; stroke-linecap: round; stroke-linejoin: round; }
    .river { fill: none; stroke: #3f6f8f; stroke-width: 5.6; stroke-linecap: round; stroke-linejoin: round; }
    .deep { fill: none; stroke: #2a5672; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
    .flow { fill: none; stroke: #d8ecff; stroke-opacity: .3; stroke-width: .25; stroke-dasharray: .8 6.6; stroke-linecap: round; animation: flow 4s linear infinite; }
    @keyframes flow { to { stroke-dashoffset: -12.4; } }
    .dike { fill: none; stroke: #b39a68; stroke-width: 1.5; stroke-dasharray: 1.7 .35; }
    .dike-s { fill: none; stroke: #3b301e; stroke-opacity: .5; stroke-width: 2.3; }
    .border { fill: none; stroke: #fff; stroke-opacity: .85; stroke-width: .45; stroke-linejoin: round; }
    .cordon { fill: none; stroke: #3a3fb8; stroke-width: 1.1; stroke-dasharray: 1.6 .9; }
    .vaxline { fill: none; stroke: #1f8a5a; stroke-width: 1; }
    .sat { fill: none; stroke: #ff5a3c; stroke-width: .55; stroke-dasharray: 1.4 .8; animation: blink 1.6s ease-in-out infinite; }
    .tl-case { fill: none; stroke: #fff; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .tl { fill: none; stroke-width: 1.15; stroke-linecap: round; stroke-linejoin: round; }
    .tl-st { fill: #fff; stroke-width: .9; }
    .choro { opacity: .8; } .parcel { opacity: .72; } .vchar { opacity: .85; }
    .w-sh { opacity: .52; } .w-dp { opacity: .7; } .w-basin { opacity: .7; }
    /* Outils : des pictogrammes de moyens opérationnels */
    .tools { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
    .tool { display: grid; justify-items: center; gap: 1px; min-height: 58px; padding: 5px 2px 4px; border-radius: 9px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer;
      font: 12px var(--font-body); --ic-hl: var(--surface); transition: border-color .15s, background-color .15s;
      .ti { width: 28px; height: 28px; color: var(--ink-2); } .tn { font-weight: 600; font-size: 11.5px; line-height: 1.15; text-align: center; } .tc { font-size: 10px; color: var(--ink-3); }
      &:hover:not(:disabled) { border-color: var(--ink-3); }
      &.sel { border-color: var(--accent); background: var(--accent-soft, var(--surface-2)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent); --ic-hl: var(--accent-soft, var(--surface-2)); .ti { color: var(--accent); } }
      &:disabled { opacity: .45; cursor: not-allowed; } }
    .info { margin: 0; min-height: 2.6em; font-size: 12px; color: var(--ink); }
    .foot { display: flex; gap: 8px; align-items: center; justify-content: flex-end; flex-wrap: wrap; .fc { margin-right: auto; font-size: 12px; color: var(--ink-2); display: inline-flex; gap: 5px; align-items: center; min-height: 32px; } }
    .sum { display: grid; gap: 5px; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--line); font-size: 12.5px;
      &.good { border-color: var(--good); background: var(--good-soft); } &.bad { border-color: var(--bad); background: var(--bad-soft); }
      p { margin: 0; } .verdict { font-size: 14px; } .score { color: var(--ink-2); } }
    .rv { display: flex; gap: 6px; align-items: flex-start; .hi { margin-top: 1px; } }
    .stats { display: flex; flex-wrap: wrap; gap: 3px 14px; color: var(--ink-2); }
    .legend { font-size: 12px; color: var(--ink-2); summary { cursor: pointer; min-height: 32px; display: flex; align-items: center; color: var(--ink); }
      ul { list-style: none; margin: 4px 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 5px 10px; }
      li { display: flex; gap: 6px; align-items: center; } p { margin: 4px 0 0; } }
    .sw { flex: none; width: 20px; height: 20px; border-radius: 4px; overflow: hidden; outline: 1px solid rgba(0,0,0,.25); color: #1c2733; --ic-hl: #fff; }
    .sw-ic { color: #fff; --ic-hl: #1c2733; }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 96px; overflow: auto; font-size: 11.5px; color: var(--ink-2); }
    @media (prefers-reduced-motion: reduce) {
      .fc2::before, .fresh::after, .glow, .puff, .flow, .sat { animation: none; }
      .puff { opacity: .55; } .r-arrow, .g-water { transition: none; }
    }
  `,
})
export class CelluleGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly uid = `cc${++uidSeq}`;
  protected readonly icons = ICON_LIST;
  protected readonly crowns = CROWNS;
  protected readonly shrubs = SHRUBS;
  protected readonly boulders = BOULDERS;
  protected readonly levelColors = LEVEL;
  protected readonly w = W;
  protected readonly letters = 'ABCDEFGHI'.split('');
  protected readonly rows = [...Array(H).keys()];
  protected readonly round = Math.round;
  protected readonly gridD = [...Array(W - 1).keys()].map(k => `M${(k + 1) * 10} 0V70`).join('') + [...Array(H - 1).keys()].map(k => `M0 ${(k + 1) * 10}H90`).join('');
  protected readonly roseTicks = [...Array(16).keys()].map(k => {
    const a = (k * Math.PI) / 8, r0 = k % 4 ? 15 : 13, r1 = 16.5;
    return `M${r2(Math.sin(a) * r0)} ${r2(-Math.cos(a) * r0)}L${r2(Math.sin(a) * r1)} ${r2(-Math.cos(a) * r1)}`;
  }).join('');
  protected variant: Variant = 'feux';
  protected maxTurns = 9;
  protected apMax = 4;
  protected brief = '';
  protected rules = '';
  protected zoneWord = 'Villages';
  protected rareName = '';
  protected bgFill = '#8f8a5d';
  protected legend: LegendItem[] = [];

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
  protected readonly windDeg = computed(() => (this.ver(), this.sim.s.wind * 90));
  protected readonly nextDeg = computed(() => { this.ver(); const s = this.sim.s; return s.nextWind >= 0 && s.nextWind !== s.wind ? s.nextWind * 90 : null; });
  protected readonly windNext = computed(() => {
    this.ver();
    const s = this.sim.s;
    if (s.nextWind < 0) return '';
    if (s.nextWind === s.wind) return s.nextForce > 1 ? 'Rafales annoncées après ce tour' : 'Le vent faiblira après ce tour';
    return `Après ce tour, le vent tournera : vent ${WIND_NAME[s.nextWind]} ${WIND_ARROW[s.nextWind]}${s.nextForce > 1 ? ', en rafales' : ''}`;
  });
  protected readonly level = computed(() => (this.ver(), fmtLevel(this.sim.s.level)));
  protected readonly gauge = computed(() => {
    this.ver();
    const s = this.sim.s, y = (l: number) => r2(57 - clamp(l, 0, 6) * 9);
    return { y: y(s.level), ny: y(s.level + (s.rain[s.turn - 1] ?? 0)), ticks: [0, 1, 2, 3, 4, 5, 6].map(v => ({ v, y: y(v) })) };
  });
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
  protected readonly toolView = computed(() => {
    this.ver();
    const s = this.sim.s;
    return VARIANT_TOOLS[this.variant].map(id => {
      const T = TOOLS[id];
      const uses = T.limited ? (s.uses[id] ?? 0) : null;
      return { id, name: T.name, cost: T.cost, uses, ok: !this.over() && s.ap >= T.cost && (uses === null || uses > 0) };
    });
  });

  /** Les boutons de la grille : état, étiquettes et annonces pour les lecteurs d’écran */
  protected readonly view = computed<CellView[]>(() => {
    this.ver();
    const sim = this.sim, s = sim.s, tool = this.tool(), fresh = this.fresh(), focus = this.focus();
    const fc = this.showFc() && !s.over ? sim.forecast() : new Map<number, number>();
    return s.cells.map((c, i) => {
      const cls = ['cell', `t-${c.t}`];
      let sub = '', corner = '', mark = '';
      const badges: IconId[] = [];
      const state: string[] = [TERRAIN_LABEL[c.t]];
      if (s.v === 'feux') {
        if (c.fire > 0) { cls.push('burn'); state.push('en feu'); }
        else if (c.fire < 0) { cls.push('ash'); state.push(c.t === 'village' ? (c.down ? 'détruit' : 'sauvé, endommagé') : 'brûlé'); }
        else if (c.retard > 0) { cls.push('retard'); state.push('protégé par le retardant'); }
        else if (c.wet > 0) { cls.push('wet'); state.push('arrosé'); }
        if (c.t === 'village') { sub = shortPop(c.pop); state.unshift(c.name); state.push(`${fmtPop(c.pop)} habitants`); }
      } else if (s.v === 'crue') {
        corner = c.t === 'riviere' ? '' : String(sim.effElev(c));
        if (c.water && c.t !== 'riviere' && c.t !== 'bassin') { cls.push('flood'); if (s.level - sim.effElev(c) >= 1.5) cls.push('deep'); state.push(`inondé (${fmtLevel(s.level - sim.effElev(c))} d’eau)`); }
        if (c.dike) { cls.push('dike'); badges.push('digue'); state.push('digue'); }
        if (c.pump > 0) { badges.push('pompe'); state.push('pompes en service'); }
        if (c.t === 'ville') { sub = shortPop(c.pop); state.unshift(c.name); state.push(`${fmtPop(c.pop)} habitants`); }
        if (c.t !== 'riviere') state.push(`altitude ${c.elev} m${c.dike || c.pump ? `, protégée à ${sim.effElev(c)} m` : ''}`);
      } else {
        if (c.hidden) { cls.push('fog'); mark = '?'; state.push('non surveillé'); }
        else { cls.push(`lv${c.inf}`); state.push(c.inf ? `niveau ${c.inf} sur 4` : 'sain'); if (c.inf) corner = String(c.inf); }
        if (c.t === 'gare') state.push(`ligne ${c.line + 1}`);
        sub = shortPop(c.pop);
        state.push(`${fmtPop(c.pop)} habitants`);
        if (c.vax) { cls.push('vax'); badges.push('shield'); state.push('vacciné'); }
        if (c.lock > 0) { cls.push('lock'); badges.push('confine'); state.push('confiné'); }
        if (c.care > 0) { badges.push('hopital'); state.push('hôpital de campagne'); }
      }
      if (c.evac) { badges.push('evac'); state.push('évacué'); }
      const p = fc.get(i) ?? 0;
      if (p >= 0.7) { cls.push('fc2'); state.push(s.v === 'crue' ? 'sera inondé' : `menace forte (${Math.round(p * 100)} %)`); }
      else if (p >= 0.25) { cls.push('fc1'); state.push(`menace (${Math.round(p * 100)} %)`); }
      if (tool && sim.check(tool, i) === null) cls.push('ok');
      if (fresh.has(i)) cls.push('fresh');
      if (focus === i) cls.push('focus');
      return { i, cls: cls.join(' '), sub, badges, corner, mark, aria: `${coord(i)} : ${state.join(', ')}` };
    });
  });

  /** La carte dessinée : recalculée à chaque changement d’état de la simulation */
  protected readonly scene = computed<Scene>(() => {
    this.ver();
    const sc: Scene = { soft: [], ground: [], lines: [], build: [], over: [], fire: [], smoke: [], top: [] };
    if (this.variant === 'feux') this.drawFeux(sc);
    else if (this.variant === 'crue') this.drawCrue(sc);
    else this.drawEpidemie(sc);
    return sc;
  });

  ngOnInit(): void {
    this.variant = variantOf(this.def().id);
    this.sim = new CelluleSim(this.variant, this.diff(), Math.floor(Math.random() * 1e9));
    this.maxTurns = this.sim.s.maxTurns;
    this.apMax = this.sim.s.apMax;
    this.brief = BRIEF[this.variant];
    this.bgFill = this.variant === 'feux' ? '#8f8a5d' : this.variant === 'crue' ? '#7d9156' : '#e6e2da';
    this.setupLegend();
    this.info.set(this.variant === 'feux' ? 'Choisissez un moyen, puis touchez une case. Les cases hachurées brûleront probablement au prochain tour.'
      : this.variant === 'crue' ? 'Choisissez un moyen, puis touchez une case. Le chiffre de chaque case est son altitude ; les cases hachurées seront inondées.'
      : 'Choisissez un moyen, puis touchez un district. Les districts hachurés ne sont pas surveillés : testez-les.');
    this.say(this.variant === 'feux' ? 'Alerte : un front de feu progresse vers les villages.' : this.variant === 'crue' ? 'Alerte rouge : la rivière sort de son lit.' : 'Alerte sanitaire : un foyer épidémique est signalé.');
    this.emitProgress();
  }

  ngOnDestroy(): void { this.timers.forEach(t => clearTimeout(t)); }

  protected u(name: string): string { return `url(#${this.uid}-${name})`; }

  /* ── Dessin : méga-feux ── */

  private drawFeux(sc: Scene): void {
    const s = this.sim.s, cells = s.cells;
    const by = (f: (c: Cell) => boolean) => cells.map((c, i) => (f(c) ? i : -1)).filter(i => i >= 0);
    const ground = (t: Terrain) => by(c => c.t === t);
    sc.ground.push({ d: cellsD(by(c => c.t === 'prairie' || c.t === 'route' || c.t === 'lac')), f: this.u('prairie') });
    sc.ground.push({ d: cellsD(ground('garrigue')), f: this.u('garrigue') });
    sc.ground.push({ d: cellsD(ground('foret')), f: this.u('foret') });
    sc.ground.push({ d: cellsD(ground('roche')), f: this.u('roche') });
    sc.ground.push({ d: cellsD(ground('coupe')), f: this.u('coupe') });
    sc.ground.push({ d: cellsD(ground('village')), f: this.u('vground') });
    for (const i of ground('lac')) {
      const x = cx(i) * 10, y = cy(i) * 10;
      sc.ground.push({ d: `M${x + 1.6} ${y + 2.2}c2-1.6 5.4-1.8 6.8-.2s1.2 4.6-.2 6.2-5 1.4-6.4.2-1.8-4.8-.2-6.2z`, f: '#cfc59c' });
      sc.ground.push({ d: `M${x + 2.2} ${y + 2.8}c1.8-1.2 4.8-1.4 6-.2s1 4-.2 5.4-4.4 1.2-5.6.2-1.6-4.2-.2-5.4z`, f: this.u('lake') });
    }
    // La route : un ruban d’asphalte continu, axe peint
    const roads = ground('route');
    if (roads.length) {
      const horiz = roads.every(i => cy(i) === cy(roads[0])) && roads.length > 1 || !roads.every(i => cx(i) === cx(roads[0]));
      const d = roads.map(i => horiz ? `M${cx(i) * 10 - .2} ${cy(i) * 10 + 5}h10.4` : `M${cx(i) * 10 + 5} ${cy(i) * 10 - .2}v10.4`).join('');
      sc.lines.push({ d, c: 'road-s' }, { d, c: 'road' }, { d, c: 'road-c' });
    }
    // Les villages vus du ciel
    for (const i of ground('village')) {
      const c = cells[i];
      const n = 5 + (c.pop >= 2500 ? 2 : c.pop >= 1400 ? 1 : 0);
      this.houses(sc, i, n, ROOF_FEUX, c.down ? 1 : c.fire < 0 ? 0.5 : 0);
    }
    // Brûlé : sol calciné ; arrosé ; retardant
    const burnt = by(c => c.fire < 0 && c.t !== 'village');
    if (burnt.length) sc.over.push({ d: cellsD(burnt, 0.2), f: this.u('char') });
    const vburnt = by(c => c.fire < 0 && c.t === 'village');
    if (vburnt.length) sc.ground.push({ d: cellsD(vburnt, -0.4), f: this.u('char'), c: 'vchar' });
    const wet = by(c => c.fire === 0 && c.wet > 0 && c.retard <= 0);
    if (wet.length) sc.over.push({ d: cellsD(wet, -0.2), f: this.u('spray') });
    const ret = by(c => c.fire === 0 && c.retard > 0);
    if (ret.length) sc.over.push({ d: cellsD(ret, -0.2), f: this.u('retard') });
    // Le feu : braises, lueur, front de flammes, panaches de fumée poussés par le vent
    const burning = by(c => c.fire > 0);
    const forest = burning.filter(i => cells[i].t !== 'village');
    if (forest.length) sc.over.push({ d: cellsD(forest, 0.1), f: this.u('embers') });
    const [dx, dy] = DIRS[s.wind], push = s.force > 1 ? 15 : 10;
    for (const i of burning) {
      const x = cx(i) * 10 + 5, y = cy(i) * 10 + 5;
      const r = cells[i].t === 'village' ? 4.6 : 4.4 + hh(i, 3) * 1.6;
      const gx = x + dx * 1.6 + (hh(i, 12) - .5) * 2, gy = y + dy * 1.6 + (hh(i, 13) - .5) * 2;
      sc.fire.push({ d: ellD(gx, gy, r), f: this.u('glow'), c: 'glow', s: `animation-delay:-${r2(hh(i, 4) * 1.7)}s` });
      // La ligne de feu, côté sous le vent : un liseré irrégulier
      const px = -dy, py = dx;
      const fp = [-4.6, -2.3, 0, 2.3, 4.6].map((t, k) => {
        const o = 3.6 + (hh(i, 14 + k) - .5) * 1.8;
        return `${r2(x + dx * o + px * t)} ${r2(y + dy * o + py * t)}`;
      });
      const fd = `M${fp.join('L')}`;
      sc.fire.push({ d: fd, c: 'front-g' }, { d: fd, c: 'front' });
      for (let k = 0; k < 2; k++) {
        const o = 4 + k * 5 + hh(i, 5 + k) * 2, w = (hh(i, 8 + k) - .5) * 3;
        const ex = x + dx * o + px * w, ey = y + dy * o + py * w;
        sc.smoke.push({
          d: ellD(ex, ey, 4.4 + k * 2, 3 + k * 1.4),
          ...(dx ? {} : { t: `rotate(90 ${r2(ex)} ${r2(ey)})` }),
          s: `--dx:${dx * push}px;--dy:${dy * push}px;animation-delay:-${r2(hh(i, 11 + k) * 5.5)}s`,
        });
      }
    }
  }

  /** Toits vus du ciel, avec leur ombre portée. charred : 0 intact, 0.5 en partie brûlé, 1 détruit */
  private houses(sc: Scene, i: number, n: number, roofs: string[], charred: number, dense = false): void {
    const x0 = cx(i) * 10, y0 = cy(i) * 10;
    const ang = (hh(i, 1) < 0.5 ? 0 : 90) + (hh(i, 2) - 0.5) * 24;
    const rad = (ang * Math.PI) / 180, ux = Math.cos(rad), uy = Math.sin(rad);
    sc.build.push({ d: `M${r2(x0 + 5 - ux * 6)} ${r2(y0 + 5 - uy * 6)}L${r2(x0 + 5 + ux * 6)} ${r2(y0 + 5 + uy * 6)}`, c: 'street' });
    if (dense) sc.build.push({ d: `M${r2(x0 + 5 + uy * 6)} ${r2(y0 + 5 - ux * 6)}L${r2(x0 + 5 - uy * 6)} ${r2(y0 + 5 + ux * 6)}`, c: 'street' });
    const slots = [...Array(9).keys()].sort((a, b) => hh(i, 20 + a) - hh(i, 20 + b)).slice(0, n);
    for (const k of slots) {
      const gx = k % 3, gy = Math.floor(k / 3);
      const px = x0 + 1.9 + gx * 3.1 + (hh(i, 30 + k) - 0.5) * 0.8, py = y0 + 1.9 + gy * 3.1 + (hh(i, 40 + k) - 0.5) * 0.8;
      const w = 2.1 + hh(i, 50 + k) * 0.9, h = 1.4 + hh(i, 60 + k) * 0.6;
      const a = r2(ang + (k % 2 ? 90 : 0) + (hh(i, 70 + k) - 0.5) * 10);
      const burnt = charred >= 1 || (charred > 0 && hh(i, 80 + k) < charred);
      const t = `rotate(${a} ${r2(px)} ${r2(py)})`;
      const roof = burnt ? '#2f2b28' : roofs[Math.floor(hh(i, 90 + k) * roofs.length)];
      sc.build.push({ d: rectD(px - w / 2 + 0.45, py - h / 2 + 0.55, w, h), f: 'rgba(20,16,10,.38)', t });
      sc.build.push({ d: rectD(px - w / 2, py - h / 2, burnt ? w * 0.82 : w, h), f: roof, t });
      if (!burnt) sc.build.push({ d: rectD(px - w / 2, py, w, h / 2), f: 'rgba(0,0,0,.2)', t });
    }
    for (let k = 0; k < 2; k++) {
      const tx = x0 + 1.2 + hh(i, 100 + k) * 7.6, ty = y0 + 1.2 + hh(i, 110 + k) * 7.6;
      sc.build.push({ d: ellD(tx + 0.3, ty + 0.4, 0.9), f: 'rgba(20,16,10,.3)' }, { d: ellD(tx, ty, 0.9), f: charred >= 1 ? '#2a2725' : '#4f6e36' });
    }
  }

  /* ── Dessin : crue ── */

  private drawCrue(sc: Scene): void {
    const sim = this.sim, s = sim.s, cells = s.cells;
    // Relief : teintes hypsométriques fondues, ombrage du nord-ouest
    cells.forEach((c, i) => {
      if (c.t === 'riviere') return;
      sc.soft.push({ d: cellsD([i], 0.6), f: ELEV[clamp(c.elev, 0, 5)] });
    });
    const contour: string[] = [];
    cells.forEach((c, i) => {
      const x = cx(i) * 10, y = cy(i) * 10;
      for (const d of [1, 2]) {
        const j = step(i, d);
        if (j < 0) continue;
        const e1 = c.t === 'riviere' ? 0 : c.elev, e2 = cells[j].t === 'riviere' ? 0 : cells[j].elev;
        if (e1 === e2) continue;
        contour.push(d === 1 ? `M${x + 10} ${y}v10` : `M${x} ${y + 10}h10`);
        // Pente qui descend vers l’est ou le sud : à l’ombre ; qui monte : au soleil
        const shade = e2 < e1;
        sc.soft.push(d === 1
          ? { d: rectD(x + 10, y, 6, 10), f: this.u(shade ? 'shL' : 'liL') }
          : { d: rectD(x, y + 10, 10, 6), f: this.u(shade ? 'shT' : 'liT') });
      }
    });
    // Occupation du sol
    cells.forEach((c, i) => {
      const x = cx(i) * 10, y = cy(i) * 10;
      if (c.t === 'champ' || c.t === 'bassin') sc.ground.push({ d: cellsD([i], -0.3), f: this.u('champ') });
      else if (c.t === 'bois') sc.ground.push({ d: cellsD([i], 0.2), f: this.u('foret') });
      else if (c.t === 'ville') sc.ground.push({ d: cellsD([i], -0.5), f: this.u('urban') });
      else if (c.t === 'terre') {
        const v = hh(i, 1) < 0.5, cut = 3 + hh(i, 2) * 4;
        const parts = v ? [[x + 0.4, y + 0.4, cut - 0.6, 9.2], [x + cut + 0.2, y + 0.4, 9.4 - cut, 9.2]] : [[x + 0.4, y + 0.4, 9.2, cut - 0.6], [x + 0.4, y + cut + 0.2, 9.2, 9.4 - cut]];
        parts.forEach((p, k) => {
          const tint = ['#7f9a55', '#93a55d', '#a7a96a', '#6f8f4f', '#b2a873'][Math.floor(hh(i, 3 + k) * 5)];
          sc.ground.push({ d: rectD(p[0], p[1], p[2], p[3]), f: tint, c: 'parcel' });
          if (hh(i, 6 + k) < 0.45) sc.ground.push({ d: rectD(p[0], p[1], p[2], p[3]), f: this.u('furrow') });
        });
      }
    });
    sc.ground.push({ d: contour.join(''), c: 'contour' });
    // La rivière : un tracé continu, berges boisées, chenal profond, courant
    const river = this.riverPath();
    if (river) { sc.ground.push({ d: river, c: 'bank' }, { d: river, c: 'sand' }, { d: river, c: 'river' }, { d: river, c: 'deep' }); sc.lines.push({ d: river, c: 'flow' }); }
    // Les villes
    cells.forEach((c, i) => { if (c.t === 'ville') this.houses(sc, i, 7 + (c.pop >= 2500 ? 2 : c.pop >= 1500 ? 1 : 0), ROOF_VILLE, c.down ? 0.6 : 0, true); });
    // L’eau sortie du lit : translucide, plus sombre là où c’est profond
    const sh: number[] = [], dp: number[] = [], basin: number[] = [];
    cells.forEach((c, i) => {
      if (!c.water || c.t === 'riviere') return;
      if (c.t === 'bassin') basin.push(i);
      else (s.level - sim.effElev(c) >= 1.5 ? dp : sh).push(i);
    });
    if (basin.length) sc.over.push({ d: cellsD(basin, 0.3), f: '#3f78a6', c: 'w-basin' });
    if (sh.length) sc.over.push({ d: cellsD(sh, 0.5), f: '#3a77ad', c: 'w-sh' });
    if (dp.length) sc.over.push({ d: cellsD(dp, 0.5), f: '#1f4f88', c: 'w-dp' });
    const all = [...sh, ...dp, ...basin];
    if (all.length) sc.over.push({ d: cellsD(all, 0.3), f: this.u('ripple') });
    // Digues : talus de sacs de sable
    cells.forEach((c, i) => {
      if (!c.dike) return;
      const d = rectD(cx(i) * 10 + 1.2, cy(i) * 10 + 1.2, 7.6, 7.6);
      sc.top.push({ d, c: 'dike-s' }, { d, c: 'dike' });
    });
  }

  /** La rivière, de la gauche à la droite de la carte, en courbe lissée */
  private riverPath(): string {
    const cells = this.sim.s.cells;
    const ids = cells.map((c, i) => (c.t === 'riviere' ? i : -1)).filter(i => i >= 0);
    if (!ids.length) return '';
    const start = ids.filter(i => cx(i) === 0).sort((a, b) => a - b)[0] ?? ids[0];
    const seen = new Set([start]), order = [start];
    for (;;) {
      const last = order[order.length - 1];
      const next = [1, 0, 2, 3].map(d => step(last, d)).find(j => j >= 0 && cells[j].t === 'riviere' && !seen.has(j));
      if (next === undefined) break;
      seen.add(next); order.push(next);
    }
    const pts = order.map(i => [cx(i) * 10 + 5, cy(i) * 10 + 5]);
    pts.unshift([pts[0][0] - 10, pts[0][1]]);
    pts.push([pts[pts.length - 1][0] + 10, pts[pts.length - 1][1]]);
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let k = 1; k < pts.length - 1; k++) {
      const [x, y] = pts[k], [nx, ny] = pts[k + 1];
      d += `Q${x} ${y} ${r2((x + nx) / 2)} ${r2((y + ny) / 2)}`;
    }
    const [lx, ly] = pts[pts.length - 1];
    return d + `L${lx} ${ly}`;
  }

  /* ── Dessin : épidémie ── */

  private drawEpidemie(sc: Scene): void {
    const s = this.sim.s, cells = s.cells;
    // Des limites de districts irrégulières : une grille de sommets légèrement décalés
    const V = (x: number, y: number): [number, number] => [
      x * 10 + (x === 0 || x === W ? 0 : (hh(x * 31 + y, 7) - 0.5) * 2.4),
      y * 10 + (y === 0 || y === H ? 0 : (hh(x * 17 + y * 5, 9) - 0.5) * 2.4),
    ];
    const poly = (i: number) => {
      const x = cx(i), y = cy(i), p = [V(x, y), V(x + 1, y), V(x + 1, y + 1), V(x, y + 1)];
      return `M${p.map(q => `${r2(q[0])} ${r2(q[1])}`).join('L')}Z`;
    };
    const centre = (i: number): [number, number] => {
      const x = cx(i), y = cy(i), p = [V(x, y), V(x + 1, y), V(x + 1, y + 1), V(x, y + 1)];
      return [r2(p.reduce((t, q) => t + q[0], 0) / 4), r2(p.reduce((t, q) => t + q[1], 0) / 4)];
    };
    const base: Record<string, string> = { quartier: 'streets', centre: 'dense', parc: 'park', gare: 'dense' };
    cells.forEach((c, i) => sc.ground.push({ d: poly(i), f: this.u(base[c.t] ?? 'streets') }));
    // Choroplèthe : la carte épidémiologique
    cells.forEach((c, i) => {
      if (c.hidden) sc.build.push({ d: poly(i), f: this.u('hatch') });
      else if (c.inf > 0) sc.build.push({ d: poly(i), f: LEVEL[c.inf], c: 'choro' });
    });
    sc.build.push({ d: cells.map((_, i) => poly(i)).join(''), c: 'border' });
    // Les lignes de transport, gares en pastilles
    s.lines.forEach((l, k) => {
      const pts = l.map(centre);
      const d = `M${pts.map(p => p.join(' ')).join('L')}`;
      sc.top.push({ d, c: 'tl-case' }, { d, c: 'tl', s: `stroke:${LINE_COL[k % 2]}` });
    });
    s.lines.forEach((l, k) => l.forEach(i => { const [x, y] = centre(i); sc.top.push({ d: ellD(x, y, 1.5), c: 'tl-st', s: `stroke:${LINE_COL[k % 2]}` }); }));
    // Confinement (cordon), vaccination, saturation
    cells.forEach((c, i) => {
      if (c.lock > 0) sc.top.push({ d: poly(i), c: 'cordon' });
      else if (c.vax) sc.top.push({ d: poly(i), c: 'vaxline' });
      if (c.inf === 4 && !c.hidden) sc.top.push({ d: poly(i), c: 'sat' });
    });
  }

  private setupLegend(): void {
    const v = this.variant, u = (n: string) => this.u(n);
    const T = (id: ToolId) => `${TOOLS[id].name} (${TOOLS[id].cost} PA${TOOLS[id].limited ? ', limité' : ''}) : ${TOOLS[id].desc}`;
    const fc: LegendItem[] = [
      { label: 'Menace probable au prochain tour', fills: ['#6b6a52', 'rgba(255,191,46,.45)'] },
      { label: v === 'crue' ? 'Sera inondée au prochain tour' : 'Menace forte au prochain tour', fills: ['#6b6a52', 'rgba(255,74,43,.6)'] },
    ];
    if (v === 'feux') {
      this.zoneWord = 'Villages'; this.rareName = 'Canadair';
      this.legend = [
        { label: 'Forêt : brûle deux tours', fills: [u('foret')] }, { label: 'Garrigue : brûle un tour', fills: [u('garrigue')] },
        { label: 'Prairie : brûle peu', fills: [u('prairie')] }, { label: 'Rochers : ininflammable', fills: [u('roche')] },
        { label: 'Route : ininflammable', fills: ['#4a4946'] }, { label: 'Lac', fills: [u('lake')] }, { label: 'Coupe-feu', fills: [u('coupe')] },
        { label: 'Village (habitants)', fills: [u('vground')], icon: 'people' }, { label: 'En feu', fills: [u('embers'), u('glow')] }, { label: 'Brûlé ou éteint', fills: [u('char')] },
        { label: 'Arrosé (un tour)', fills: [u('foret'), u('spray')] }, { label: 'Retardant (deux tours)', fills: [u('foret'), u('retard')] }, ...fc,
      ];
      this.rules = `Règles : chaque case en feu enflamme à coup sûr la forêt ou la garrigue sous le vent, souvent les deux diagonales sous le vent, parfois les côtés, rarement la case contre le vent ; en rafales, les braises sautent deux cases. Un village en feu doit être éteint dans le tour, sinon il est détruit. Le vent tourne parfois : c’est annoncé un tour à l’avance (flèche en pointillé sur la rose des vents). ${T('pompiers')} ${T('canadair')} ${T('coupefeu')} ${T('evac')}`;
    } else if (v === 'crue') {
      this.zoneWord = 'Villes'; this.rareName = 'Bassins';
      this.legend = [
        { label: 'Altitude basse', fills: [ELEV[1]] }, { label: 'Altitude haute', fills: [ELEV[4]] },
        { label: 'Rivière', fills: ['#3b6f97'] }, { label: 'Inondé', fills: [ELEV[1], 'rgba(58,119,173,.7)', u('ripple')] },
        { label: 'Champ (bassin possible)', fills: [u('champ')] }, { label: 'Ville (habitants)', fills: [u('urban')], icon: 'people' },
        { label: 'Digue (+2 m)', fills: [ELEV[2]], icon: 'digue' }, { label: 'Pompes (+1 m)', fills: [ELEV[2]], icon: 'pompe' }, ...fc,
      ];
      this.rules = `Règles : une case est inondée quand son altitude (digues et pompes comprises) est sous la cote et qu’elle touche l’eau ; l’eau n’avance que d’une case par tour, et se retire quand la cote baisse. Une ville sous l’eau perd 30 % de ses habitants par tour (50 % sous plus d’1,5 m). Une digue submergée cède. La hausse du tour est connue ; la tendance suivante n’est qu’une prévision. ${T('digue')} ${T('pompe')} ${T('bassin')} ${T('evac')}`;
    } else {
      this.zoneWord = 'Districts'; this.rareName = 'Hôpitaux';
      this.legend = [
        { label: 'Sain', fills: [u('streets')] }, { label: 'Niveau 1 : quelques cas', fills: [LEVEL[1]] }, { label: 'Niveau 2 : contagieux', fills: [LEVEL[2]] },
        { label: 'Niveau 3 : épidémie', fills: [LEVEL[3]] }, { label: 'Niveau 4 : saturé', fills: [LEVEL[4]] }, { label: 'Non surveillé', fills: [u('streets'), u('hatch')] },
        { label: 'Parc (moins dense)', fills: [u('park')] }, { label: 'Vacciné', fills: [u('streets')], icon: 'shield' }, { label: 'Confiné', fills: [u('streets')], icon: 'confine' }, ...fc,
      ];
      this.rules = `Règles : chaque district contaminé progresse d’un niveau par tour (le chiffre dans le coin). À partir du niveau 2, il contamine ses voisins (de plus en plus sûrement), et une gare (pastille sur une ligne) contamine les autres gares de sa ligne. Un foyer caché ne se révèle qu’au niveau 3. Les parcs, peu denses, résistent mieux. ${T('tests')} ${T('vaccin')} ${T('confine')} ${T('hopital')}`;
    }
  }

  protected pick(id: ToolId): void {
    if (this.over()) return;
    const on = this.tool() === id ? null : id;
    this.tool.set(on);
    this.info.set(on ? `${TOOLS[on].name} : ${TOOLS[on].desc} Touchez une case encadrée.` : 'Touchez une case pour l’inspecter.');
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

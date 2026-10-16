import { Component, ElementRef, OnDestroy, OnInit, computed, input, output, signal, viewChild } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/* ============================================================
 *  Le réseau : un vrai jeu d’optimisation de transports, au tour
 *  par tour (une semaine par tour), dans l’esprit de Mini Metro.
 *  Des stations de plusieurs types apparaissent sur un plan ; des
 *  voyageurs s’y accumulent, chacun voulant rejoindre un type de
 *  lieu (ou, pour le TGV, une ville précise). Le joueur trace ses
 *  lignes station par station, répartit rames et wagons, puis
 *  lance la semaine : les voyageurs empruntent le plus court
 *  chemin (correspondances comprises) dans la limite de la
 *  capacité de chaque ligne. Une station saturée trop longtemps
 *  fait fermer le réseau.
 *  Trois variantes : métro du Grand Paris, tramway de province,
 *  lignes à grande vitesse.
 *  Toute la simulation est dans la classe ReseauSim (pure,
 *  testable hors d’Angular).
 * ============================================================ */

export type Variant = 'metro' | 'tram' | 'tgv';
export type Kind = 'rond' | 'tri' | 'carre' | 'croix' | 'losange' | 'ville';
export type OfferId = 'ligne' | 'rame' | 'wagon' | 'tunnel' | 'pole' | 'budget';
export interface Pt { x: number; y: number }

export interface VConf {
  weeks: number; w: number; h: number;
  lines0: number; linesMax: number; trains0: number; wagons0: number; tunnels0: number; poles0: number;
  /** Budget de départ, dotation hebdomadaire, recette par voyageur arrivé, part remboursée d’un tronçon ancien démoli */
  budget0: number; income: number; fare: number; refundOld: number;
  /** Voyageurs tolérés par station (+ pôle d’échanges), semaines de saturation avant fermeture */
  cap: number; hubCap: number; limit: number;
  /** Places par rame et par wagon (par semaine, pour une ligne de longueur « ref ») */
  trainCap: number; wagonCap: number; wagonsPerTrain: number; ref: number;
  /** Pénalité de correspondance (en unités de distance), réduite dans un pôle */
  transfer: number; hubTransfer: number;
  maxLen: number; minDist: number; start: number; maxStations: number;
  /** Semaines où une rame neuve est livrée d’office */
  gifts: number[];
  /** Voyageurs générés (multiplicateur) */
  demand: number;
}

export const CONF: Record<Variant, VConf> = {
  metro: {
    weeks: 14, w: 100, h: 100, lines0: 2, linesMax: 6, trains0: 3, wagons0: 0, tunnels0: 2, poles0: 0,
    budget0: 8, income: 2, fare: 0, refundOld: 1, cap: 6, hubCap: 6, limit: 3,
    trainCap: 6, wagonCap: 3, wagonsPerTrain: 2, ref: 50, transfer: 5, hubTransfer: 1.5,
    maxLen: 42, minDist: 11, start: 5, maxStations: 24, gifts: [4, 7, 10, 13], demand: 1,
  },
  tram: {
    weeks: 12, w: 100, h: 100, lines0: 1, linesMax: 3, trains0: 2, wagons0: 0, tunnels0: 1, poles0: 0,
    budget0: 110, income: 25, fare: 0.6, refundOld: 0.5, cap: 7, hubCap: 6, limit: 3,
    trainCap: 8, wagonCap: 4, wagonsPerTrain: 2, ref: 60, transfer: 5, hubTransfer: 2,
    maxLen: 42, minDist: 14, start: 4, maxStations: 15, gifts: [5, 9], demand: 1.08,
  },
  tgv: {
    weeks: 12, w: 100, h: 97, lines0: 2, linesMax: 5, trains0: 3, wagons0: 0, tunnels0: 1, poles0: 0,
    budget0: 10, income: 2, fare: 0.05, refundOld: 0.5, cap: 5, hubCap: 6, limit: 3,
    trainCap: 6, wagonCap: 4, wagonsPerTrain: 2, ref: 70, transfer: 8, hubTransfer: 3,
    maxLen: 55, minDist: 0, start: 5, maxStations: 20, gifts: [], demand: 1.2,
  },
};

export const LINE_COLORS = ['#e0362c', '#2a6fd6', '#efa400', '#1f9d55', '#9a4dca', '#00a0b0'];

export const KIND_LABEL: Record<Variant, Partial<Record<Kind, string>>> = {
  metro: { rond: 'Logements', tri: 'Bureaux', carre: 'Université', croix: 'Hôpital', losange: 'Grande gare' },
  tram: { rond: 'Quartier résidentiel', tri: 'Centre-ville', carre: 'Campus', croix: 'CHU', losange: 'Gare SNCF' },
  tgv: { ville: 'Ville' },
};
export const KIND_GLYPH: Record<Kind, string> = { rond: '●', tri: '▲', carre: '■', croix: '✚', losange: '◆', ville: '●' };

/** Voyageurs générés par semaine selon le type de station */
const SPAWN: Record<'metro' | 'tram', Partial<Record<Kind, number>>> = {
  metro: { rond: 1.0, tri: 0.55, carre: 0.55, croix: 0.45, losange: 0.8 },
  tram: { rond: 1.35, tri: 0.8, carre: 0.8, croix: 0.6, losange: 1.0 },
};
/** Attrait des destinations */
const DEST: Partial<Record<Kind, number>> = { rond: 1, tri: 1.1, carre: 0.8, croix: 0.7, losange: 0.8 };
/** Stations particulières : semaine d’apparition → type */
const SPECIAL: Record<'metro' | 'tram', Record<number, Kind>> = {
  metro: { 4: 'croix', 7: 'losange', 10: 'croix', 12: 'losange' },
  tram: { 3: 'croix', 6: 'losange', 9: 'carre' },
};
/** Satisfaction selon les semaines d’attente */
const SAT = [1, 0.75, 0.5, 0.3, 0.15];

const NAMES: Record<'metro' | 'tram', Partial<Record<Kind, string[]>>> = {
  metro: {
    rond: ['Saint-Ouen', 'Pantin', 'Bagnolet', 'Montreuil', 'Ivry', 'Vitry', 'Gentilly', 'Montrouge', 'Malakoff', 'Vanves', 'Issy', 'Clichy', 'Levallois',
      'Aubervilliers', 'Bobigny', 'Rosny', 'Fontenay', 'Champigny', 'Villejuif', 'Créteil', 'Bondy', 'Drancy', 'Colombes', 'Asnières', 'Charenton', 'Belleville', 'Ménilmontant', 'Batignolles'],
    tri: ['La Défense', 'Bercy', 'Plaine Saint-Denis', 'Opéra', 'Montparnasse', 'Front de Seine', 'Val de Fontenay', 'Issy Val de Seine', 'Bourse'],
    carre: ['Jussieu', 'Tolbiac', 'Villetaneuse', 'Nanterre-Université', 'Cité U', 'Censier', 'Créteil-Université', 'Condorcet'],
    croix: ['Pitié-Salpêtrière', 'Bichat', 'Henri-Mondor', 'Necker', 'Avicenne'],
    losange: ['Gare du Nord', 'Gare de Lyon', 'Saint-Lazare', 'Austerlitz', 'Saint-Denis Pleyel'],
  },
  tram: {
    rond: ['Les Tilleuls', 'Bellevue', 'Les Coteaux', 'Saint-Jacques', 'La Roseraie', 'Le Moulin', 'Les Glycines', 'Champ-Fleuri', 'Le Bourg', 'La Fontaine',
      'Les Peupliers', 'Beaulieu', 'Le Clos', 'Les Mûriers', 'Saint-Martin'],
    tri: ['Hôtel de Ville', 'Place de la République', 'Les Halles', 'Zone d’activités', 'Centre commercial'],
    carre: ['Campus', 'IUT', 'Lycée Jean-Moulin', 'Faculté de droit'],
    croix: ['CHU', 'Clinique du Parc'],
    losange: ['Gare SNCF', 'Gare routière'],
  },
};

/** Villes : nom, longitude, latitude, population de l’aire urbaine (millions) */
const CITIES: [string, number, number, number][] = [
  ['Paris', 2.35, 48.86, 13], ['Lyon', 4.84, 45.76, 2.3], ['Marseille', 5.37, 43.3, 1.9], ['Lille', 3.06, 50.63, 1.5], ['Bordeaux', -0.58, 44.84, 1.4],
  ['Toulouse', 1.44, 43.6, 1.4], ['Nantes', -1.55, 47.22, 1.0], ['Strasbourg', 7.75, 48.58, 0.8], ['Nice', 7.26, 43.7, 1.0], ['Montpellier', 3.88, 43.61, 0.8],
  ['Rennes', -1.68, 48.11, 0.75], ['Grenoble', 5.72, 45.19, 0.7], ['Rouen', 1.1, 49.44, 0.65], ['Tours', 0.69, 47.39, 0.5], ['Clermont-Ferrand', 3.09, 45.78, 0.5],
  ['Nancy', 6.18, 48.69, 0.5], ['Dijon', 5.04, 47.32, 0.4], ['Caen', -0.37, 49.18, 0.47], ['Orléans', 1.91, 47.9, 0.45], ['Reims', 4.03, 49.26, 0.35],
  ['Brest', -4.49, 48.39, 0.32], ['Limoges', 1.26, 45.83, 0.3], ['Perpignan', 2.9, 42.7, 0.33], ['Amiens', 2.3, 49.89, 0.3], ['Poitiers', 0.34, 46.58, 0.26],
];
export const proj = (lon: number, lat: number): Pt => ({ x: Math.round((lon + 5) * 7.29 * 10) / 10, y: Math.round((51.3 - lat) * 10.6 * 10) / 10 });
const FRANCE_LL: [number, number][] = [
  [2.55, 51.09], [3.2, 50.75], [4.15, 49.95], [4.85, 50.15], [5.8, 49.55], [6.4, 49.45], [7.6, 49.05], [8.2, 48.97], [7.6, 47.6], [6.9, 47.4], [6.1, 46.4],
  [6.8, 46.0], [7.0, 45.2], [6.65, 44.6], [7.0, 44.2], [7.5, 43.78], [6.6, 43.15], [5.9, 43.08], [5.0, 43.35], [4.3, 43.45], [3.5, 43.25], [3.05, 42.95],
  [3.17, 42.45], [1.7, 42.5], [0.7, 42.7], [-0.6, 42.8], [-1.78, 43.37], [-1.45, 43.6], [-1.2, 44.6], [-1.25, 45.6], [-1.15, 46.2], [-2.15, 46.85],
  [-2.5, 47.3], [-3.4, 47.7], [-4.4, 47.85], [-4.75, 48.35], [-4.4, 48.65], [-3.0, 48.8], [-2.0, 48.6], [-1.6, 48.65], [-1.9, 49.7], [-1.25, 49.65],
  [-1.1, 49.35], [0.1, 49.45], [0.2, 49.7], [1.4, 50.05], [1.6, 50.4], [1.6, 50.9],
];
export const FRANCE: Pt[] = FRANCE_LL.map(([a, b]) => proj(a, b));
export const MOUNTAINS: { name: string; poly: Pt[] }[] = [
  { name: 'Alpes', poly: [[5.6, 46.3], [6.9, 46.4], [7.1, 45.2], [7.6, 44.1], [6.6, 43.8], [5.8, 44.2], [5.6, 45.0]] },
  { name: 'Pyrénées', poly: [[-1.6, 43.3], [0.5, 43.1], [2.3, 42.9], [3.0, 42.6], [2.0, 42.35], [0.6, 42.6], [-1.0, 42.75]] },
  { name: 'Massif central', poly: [[2.2, 46.0], [3.9, 46.1], [4.6, 45.3], [4.0, 44.2], [3.0, 43.9], [2.0, 44.4], [1.8, 45.3]] },
  { name: 'Jura', poly: [[5.7, 46.3], [6.2, 46.4], [7.0, 47.45], [6.6, 47.5], [5.8, 46.9]] },
  { name: 'Vosges', poly: [[6.6, 48.6], [7.3, 48.6], [7.3, 47.8], [6.8, 47.8]] },
].map(m => ({ name: m.name, poly: m.poly.map(([a, b]) => proj(a, b)) }));
export const RIVERS: Record<'metro' | 'tram', { name: string; pts: Pt[] }> = {
  metro: { name: 'Seine', pts: [[103, 74], [88, 68], [74, 60], [60, 53], [48, 51], [37, 47], [28, 41], [23, 33], [16, 27], [9, 33], [5, 45], [-3, 50]].map(([x, y]) => ({ x, y })) },
  tram: { name: 'Loire', pts: [[-3, 60], [14, 63], [28, 59], [42, 64], [56, 61], [70, 66], [86, 62], [103, 65]].map(([x, y]) => ({ x, y })) },
};

/* ── Géométrie ── */

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function segCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const o = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return o(p3, p4, p1) * o(p3, p4, p2) < 0 && o(p1, p2, p3) * o(p1, p2, p4) < 0;
}
export function crossings(a: Pt, b: Pt, poly: Pt[]): number {
  let n = 0;
  for (let i = 0; i + 1 < poly.length; i++) if (segCross(a, b, poly[i], poly[i + 1])) n++;
  return n;
}
function distSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
const distPoly = (p: Pt, poly: Pt[]) => Math.min(...poly.slice(1).map((b, i) => distSeg(p, poly[i], b)));
function inPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
/** Part d’un tronçon qui traverse un massif montagneux */
export function mountainFrac(a: Pt, b: Pt): number {
  let n = 0;
  for (let k = 0; k <= 20; k++) {
    const p = { x: a.x + ((b.x - a.x) * k) / 20, y: a.y + ((b.y - a.y) * k) / 20 };
    if (MOUNTAINS.some(m => inPoly(p, m.poly))) n++;
  }
  return n / 21;
}

/** Tracé SVG d’une forme de station */
export function shapePath(k: Kind, x: number, y: number, r: number): string {
  const f = (v: number) => Math.round(v * 100) / 100;
  switch (k) {
    case 'tri': return `M${f(x)} ${f(y - r * 1.15)}L${f(x + r * 1.1)} ${f(y + r * 0.8)}L${f(x - r * 1.1)} ${f(y + r * 0.8)}Z`;
    case 'carre': return `M${f(x - r * 0.88)} ${f(y - r * 0.88)}h${f(r * 1.76)}v${f(r * 1.76)}h${f(-r * 1.76)}Z`;
    case 'losange': return `M${f(x)} ${f(y - r * 1.2)}L${f(x + r * 1.05)} ${f(y)}L${f(x)} ${f(y + r * 1.2)}L${f(x - r * 1.05)} ${f(y)}Z`;
    case 'croix': {
      const a = r * 0.38, b = r * 1.05;
      return `M${f(x - a)} ${f(y - b)}h${f(2 * a)}v${f(b - a)}h${f(b - a)}v${f(2 * a)}h${f(a - b)}v${f(b - a)}h${f(-2 * a)}v${f(a - b)}h${f(a - b)}v${f(-2 * a)}h${f(b - a)}Z`;
    }
    default: return `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
  }
}

/* ── État ── */

export interface Station { id: number; x: number; y: number; kind: Kind; name: string; pop: number; born: number; hub: boolean; over: number; peak: number; served: number }
export interface Pax { id: number; at: number; kind: Kind | null; dest: number; born: number; legs: number }
export interface Seg { a: number; b: number; cost: number; tokens: number; week: number; len: number }
export interface Line {
  id: number; stops: number[]; segs: Seg[]; trains: number; wagons: number;
  /** Bout prolongé : 1 = dernier arrêt, 0 = premier */
  end: 0 | 1;
  carried: number; used: number; cap: number; wanted: number;
}
export interface Pending { x: number; y: number; kind: Kind; name: string; pop: number }
export interface NetEvent { type: 'greve' | 'travaux' | 'affluence' | 'subvention'; from: number; to: number; line: number; a: number; b: number; st: number; text: string }
export interface Offer { id: OfferId; n: number }
export interface WeekStat { week: number; spawned: number; delivered: number; waiting: number }

export interface SimState {
  v: Variant; diff: number; seed: number;
  week: number; maxWeeks: number; over: boolean; lost: boolean; lostAt: number;
  stations: Station[]; pending: Pending[]; pax: Pax[]; lines: Line[]; unlocked: number;
  budget: number; trains: number; wagons: number; tunnels: number; poles: number;
  offers: Offer[] | null; events: NetEvent[];
  spawned: number; delivered: number; satSum: number; waitSum: number;
  history: WeekStat[]; paxId: number;
  names: Partial<Record<Kind, string[]>>; cityQueue: number[];
}

export interface Report { events: string[]; delivered: number; spawned: number; warn: number[]; fresh: number[] }
export interface Outcome { score: number; frac: number; sat: number; delivered: number; total: number; waiting: number; weeks: number; surv: number; served: number; stations: number }

interface Leg { line: number; to: number }
interface Route { dist: Float64Array; prev: Int32Array }

export function variantOf(id: string): Variant {
  return /tgv|lgv|grande_vitesse|rail/.test(id) ? 'tgv' : /tram/.test(id) ? 'tram' : 'metro';
}

/* ============================================================
 *  Le moteur
 * ============================================================ */

export class ReseauSim {
  s: SimState;
  readonly c: VConf;
  /** Nœuds du graphe de routage : station × (quai de chaque ligne + hall) */
  private readonly K: number;

  constructor(v: Variant, diff = 1, seed = 1, state?: SimState) {
    this.c = CONF[v];
    this.K = this.c.linesMax + 1;
    if (state) { this.s = state; return; }
    const c = this.c;
    this.s = {
      v, diff, seed: (seed * 2654435761) >>> 0, week: 1, maxWeeks: c.weeks, over: false, lost: false, lostAt: -1,
      stations: [], pending: [], pax: [], lines: [], unlocked: c.lines0,
      budget: c.budget0, trains: c.trains0, wagons: c.wagons0, tunnels: c.tunnels0, poles: c.poles0,
      offers: null, events: [], spawned: 0, delivered: 0, satSum: 0, waitSum: 0, history: [], paxId: 0,
      names: {}, cityQueue: [],
    };
    for (let k = 0; k < c.linesMax; k++) this.s.lines.push({ id: k, stops: [], segs: [], trains: 0, wagons: 0, end: 1, carried: 0, used: 0, cap: 0, wanted: 0 });
    if (v === 'tgv') {
      this.s.cityQueue = CITIES.map((_, i) => i).slice(c.start);
      for (let i = 0; i < c.start; i++) this.addCity(i, 1);
    } else {
      const pools = NAMES[v];
      for (const k of Object.keys(pools) as Kind[]) this.s.names[k] = this.shuffle([...(pools[k] ?? [])]);
      const kinds: Kind[] = v === 'metro' ? ['rond', 'tri', 'rond', 'carre', 'rond'] : ['rond', 'tri', 'rond', 'carre'];
      for (const k of kinds) {
        const p = this.place(k, 1, v === 'metro' ? 24 : 30);
        if (p) this.addStation(p, 1);
      }
    }
    this.forecastNext();
  }

  clone(): ReseauSim { return new ReseauSim(this.s.v, this.s.diff, 0, structuredClone(this.s)); }

  rand(): number {
    let t = (this.s.seed = (this.s.seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  private int(n: number): number { return Math.floor(this.rand() * n); }
  private shuffle<T>(a: T[]): T[] { for (let k = a.length - 1; k > 0; k--) { const j = this.int(k + 1); [a[k], a[j]] = [a[j], a[k]]; } return a; }
  private sample(rate: number): number { return Math.floor(rate) + (this.rand() < rate - Math.floor(rate) ? 1 : 0); }
  private pickW<T>(items: T[], w: (t: T) => number): T {
    const tot = items.reduce((t, x) => t + w(x), 0);
    let r = this.rand() * tot;
    for (const x of items) { r -= w(x); if (r <= 0) return x; }
    return items[items.length - 1];
  }

  /* ── Stations ── */

  private addStation(p: Pending, born: number): Station {
    const st: Station = { id: this.s.stations.length, x: p.x, y: p.y, kind: p.kind, name: p.name, pop: p.pop, born, hub: false, over: 0, peak: 0, served: 0 };
    this.s.stations.push(st);
    return st;
  }
  private addCity(i: number, born: number): void {
    const [name, lon, lat, pop] = CITIES[i];
    this.addStation({ ...proj(lon, lat), kind: 'ville', name, pop }, born);
  }
  private takeName(k: Kind): string {
    const pool = this.s.names[k];
    return pool?.length ? pool.shift()! : `${KIND_LABEL[this.s.v][k] ?? 'Station'} ${this.s.stations.length + 1}`;
  }
  /** Un emplacement libre, de plus en plus loin du centre au fil des semaines */
  private place(kind: Kind, week: number, radius?: number): Pending | null {
    const s = this.s, c = this.c, river = RIVERS[s.v as 'metro' | 'tram'].pts;
    const cx = 50, cy = s.v === 'tram' ? 46 : 50;
    const R = radius ?? (s.v === 'metro' ? 24 + 4 * week : 30 + 3.5 * week);
    const taken: Pt[] = [...s.stations, ...s.pending];
    for (let tries = 0; tries < 400; tries++) {
      const md = c.minDist * (tries < 200 ? 1 : 0.88);
      const a = this.rand() * Math.PI * 2, r = Math.sqrt(this.rand()) * R;
      const p = { x: Math.round(cx + Math.cos(a) * r), y: Math.round(cy + Math.sin(a) * r) };
      if (p.x < 7 || p.y < 7 || p.x > c.w - 7 || p.y > c.h - 7) continue;
      if (distPoly(p, river) < 5.5) continue;
      if (taken.some(q => dist(p, q) < md)) continue;
      return { ...p, kind, name: this.takeName(kind), pop: 0 };
    }
    return null;
  }

  /** Prévoit les stations qui ouvriront à la fin de la semaine en cours */
  private forecastNext(): void {
    const s = this.s, w = s.week + 1;
    s.pending = [];
    if (w > s.maxWeeks) return;
    const extra = this.rand() < (s.v === 'tram' ? 0.12 : 0.18) + 0.4 * (s.diff - 0.8) ? 1 : 0;
    if (s.v === 'tgv') {
      const n = 1 + extra;
      for (let k = 0; k < n && s.cityQueue.length && s.stations.length + s.pending.length < this.c.maxStations; k++) {
        const j = this.int(Math.min(3, s.cityQueue.length));
        const i = s.cityQueue.splice(j, 1)[0];
        const [name, lon, lat, pop] = CITIES[i];
        s.pending.push({ ...proj(lon, lat), kind: 'ville', name, pop });
      }
      return;
    }
    const kinds: Kind[] = [];
    const sp = SPECIAL[s.v][w];
    if (sp) kinds.push(sp);
    const base = s.v === 'metro' ? 1 : this.rand() < 0.5 + 0.3 * (s.diff - 0.8) ? 1 : 0;
    for (let k = 0; k < base + extra - (sp && s.v === 'tram' ? 1 : 0); k++) {
      const r = this.rand();
      kinds.push(r < 0.56 ? 'rond' : r < 0.8 ? 'tri' : 'carre');
    }
    for (const k of kinds) {
      if (s.stations.length + s.pending.length >= this.c.maxStations) break;
      const p = this.place(k, w);
      if (p) s.pending.push(p);
    }
  }

  capOf(st: Station): number {
    return this.c.cap + (st.hub ? this.c.hubCap : 0) + (st.kind === 'ville' ? Math.round(3 * Math.log(1 + st.pop)) : 0);
  }
  waitingAt(id: number): number { return this.s.pax.reduce((t, p) => t + (p.at === id ? 1 : 0), 0); }

  /* ── Tronçons ── */

  /** Coût d’un tronçon et jetons (tunnel / pont) nécessaires ou utilisés */
  segCost(a: number, b: number): { cost: number; tokens: number; need: number; len: number; mnt: number } {
    const s = this.s, A = s.stations[a], B = s.stations[b], len = dist(A, B);
    if (s.v === 'metro') return { cost: 1, tokens: crossings(A, B, RIVERS.metro.pts), need: crossings(A, B, RIVERS.metro.pts), len, mnt: 0 };
    if (s.v === 'tram') { const n = crossings(A, B, RIVERS.tram.pts); return { cost: Math.round(6 + 1.5 * len), tokens: n, need: n, len, mnt: 0 }; }
    const mnt = mountainFrac(A, B);
    const useTunnel = mnt >= 0.15 && s.tunnels > 0 ? 1 : 0;
    const cost = Math.round(0.1 * len * (1 + (useTunnel ? 0 : 1.5 * mnt)) * 10) / 10;
    return { cost, tokens: useTunnel, need: 0, len, mnt };
  }

  lineEnd(l: Line): number { return l.end ? l.stops[l.stops.length - 1] : l.stops[0]; }
  isOn(l: Line, st: number): boolean { return l.stops.includes(st); }
  usable(l: Line): boolean { return l.id < this.s.unlocked; }

  /** null si la station peut prolonger la ligne, sinon la raison */
  checkExtend(li: number, st: number): string | null {
    const s = this.s, l = s.lines[li];
    if (s.over) return 'La partie est terminée.';
    if (!this.usable(l)) return 'Ligne pas encore ouverte.';
    if (!l.stops.length) return null;
    if (this.isOn(l, st)) return 'La station est déjà sur cette ligne.';
    const from = this.lineEnd(l);
    const sc = this.segCost(from, st);
    if (sc.len > this.c.maxLen) return `Tronçon trop long (${this.fmtKm(sc.len)}, maximum ${this.fmtKm(this.c.maxLen)}) : passez par une autre station.`;
    if (sc.need > s.tunnels) return s.v === 'metro' ? `Il faut ${sc.need > 1 ? sc.need + ' tunnels' : 'un tunnel'} pour passer sous la Seine.` : `Il faut ${sc.need > 1 ? sc.need + ' ponts' : 'un pont'} pour franchir la Loire.`;
    if (sc.cost > s.budget + 1e-9) return `Budget insuffisant : ce tronçon coûte ${this.money(sc.cost)}, il reste ${this.money(s.budget)}.`;
    return null;
  }

  startLine(li: number, st: number): void {
    const l = this.s.lines[li];
    l.stops = [st]; l.segs = []; l.end = 1;
  }

  /** Prolonge la ligne (supposé valide) ; renvoie le compte rendu */
  extend(li: number, st: number): string {
    const s = this.s, l = s.lines[li];
    const from = this.lineEnd(l);
    const sc = this.segCost(from, st);
    const seg: Seg = { a: from, b: st, cost: sc.cost, tokens: sc.tokens, week: s.week, len: sc.len };
    s.budget = Math.round((s.budget - sc.cost) * 100) / 100;
    s.tunnels -= sc.tokens;
    if (l.end) { l.stops.push(st); l.segs.push(seg); } else { l.stops.unshift(st); l.segs.unshift(seg); }
    let extra = '';
    if (l.stops.length === 2 && l.trains === 0) {
      if (s.trains > 0) { s.trains--; l.trains = 1; extra = ' Une rame est affectée à la ligne.'; }
      else extra = ' Aucune rame disponible : la ligne ne roulera pas.';
    }
    const tok = sc.tokens ? (s.v === 'metro' ? ` (tunnel sous la Seine)` : s.v === 'tram' ? ` (pont sur la Loire)` : ` (tunnel percé : pas de surcoût de montagne)`) : sc.mnt >= 0.15 ? ' (surcoût de montagne)' : '';
    return `${this.lineName(li)} : ${s.stations[from].name} → ${s.stations[st].name}, ${this.money(sc.cost)}${tok}.${extra}`;
  }

  /** Retire le tronçon du bout actif */
  removeLast(li: number): string {
    const s = this.s, l = s.lines[li];
    if (l.stops.length < 2) { l.stops = []; l.segs = []; return `${this.lineName(li)} : tracé effacé.`; }
    const seg = l.end ? l.segs.pop()! : l.segs.shift()!;
    const gone = l.end ? l.stops.pop()! : l.stops.shift()!;
    const back = seg.week === s.week ? seg.cost : Math.round(seg.cost * this.c.refundOld * 100) / 100;
    s.budget = Math.round((s.budget + back) * 100) / 100;
    s.tunnels += seg.tokens;
    if (l.stops.length < 2) this.freeRolling(l);
    return `${this.lineName(li)} : tronçon vers ${s.stations[gone].name} retiré (${this.money(back)} récupérés${back < seg.cost ? ', démolition comprise' : ''}).`;
  }

  deleteLine(li: number): string {
    const l = this.s.lines[li];
    let back = 0;
    while (l.stops.length >= 2) { const before = this.s.budget; this.removeLast(li); back += this.s.budget - before; }
    l.stops = []; l.segs = [];
    this.freeRolling(l);
    return `${this.lineName(li)} supprimée${back ? ` (${this.money(back)} récupérés)` : ''}.`;
  }

  private freeRolling(l: Line): void {
    this.s.trains += l.trains; this.s.wagons += l.wagons;
    l.trains = 0; l.wagons = 0;
  }

  flipEnd(li: number): void { const l = this.s.lines[li]; l.end = l.end ? 0 : 1; }
  setEnd(li: number, st: number): void { const l = this.s.lines[li]; if (l.stops[0] === st) l.end = 0; else if (l.stops[l.stops.length - 1] === st) l.end = 1; }

  addTrain(li: number, d: 1 | -1): string | null {
    const s = this.s, l = s.lines[li];
    if (d > 0) {
      if (s.trains < 1) return 'Plus aucune rame en réserve.';
      if (l.stops.length < 2) return 'Tracez d’abord un tronçon.';
      s.trains--; l.trains++;
    } else {
      if (l.trains < 1) return 'Aucune rame sur cette ligne.';
      l.trains--; s.trains++;
      const maxW = l.trains * this.c.wagonsPerTrain;
      if (l.wagons > maxW) { s.wagons += l.wagons - maxW; l.wagons = maxW; }
    }
    return null;
  }
  addWagon(li: number, d: 1 | -1): string | null {
    const s = this.s, l = s.lines[li];
    if (d > 0) {
      if (s.wagons < 1) return 'Plus aucun wagon en réserve.';
      if (l.wagons >= l.trains * this.c.wagonsPerTrain) return `Au plus ${this.c.wagonsPerTrain} wagons par rame.`;
      s.wagons--; l.wagons++;
    } else {
      if (l.wagons < 1) return 'Aucun wagon sur cette ligne.';
      l.wagons--; s.wagons++;
    }
    return null;
  }
  makeHub(st: number): string | null {
    const s = this.s, x = s.stations[st];
    if (x.hub) return 'C’est déjà un pôle d’échanges.';
    if (s.poles < 1) return 'Aucun pôle d’échanges en réserve.';
    s.poles--; x.hub = true;
    return null;
  }

  lineLen(l: Line): number { return l.segs.reduce((t, g) => t + g.len, 0); }
  /** Fréquence : une ligne courte voit passer ses rames plus souvent */
  freq(l: Line): number { return clamp(this.c.ref / Math.max(1, this.lineLen(l)), 0.5, 1.5); }
  strike(li: number): boolean { return this.s.events.some(e => e.type === 'greve' && e.line === li && e.from <= this.s.week && this.s.week <= e.to); }
  closedPair(a: number, b: number): boolean {
    return this.s.events.some(e => e.type === 'travaux' && e.from <= this.s.week && this.s.week <= e.to && ((e.a === a && e.b === b) || (e.a === b && e.b === a)));
  }
  capacity(l: Line): number {
    if (l.stops.length < 2 || l.trains < 1 || this.strike(l.id)) return 0;
    return Math.round((l.trains * this.c.trainCap + l.wagons * this.c.wagonCap) * this.freq(l));
  }

  /* ── Routage ── */

  private buildGraph(): [number, number][][] {
    const s = this.s, K = this.K, n = s.stations.length * K;
    const adj: [number, number][][] = Array.from({ length: n }, () => []);
    for (const l of s.lines) {
      if (this.capacity(l) <= 0) continue;
      const L = l.id + 1;
      for (const st of l.stops) {
        const t = s.stations[st].hub ? this.c.hubTransfer : this.c.transfer;
        adj[st * K].push([st * K + L, t]);
        adj[st * K + L].push([st * K, 0]);
      }
      for (const g of l.segs) {
        if (this.closedPair(g.a, g.b)) continue;
        adj[g.a * K + L].push([g.b * K + L, g.len]);
        adj[g.b * K + L].push([g.a * K + L, g.len]);
      }
    }
    return adj;
  }

  private dijkstra(adj: [number, number][][], src: number): Route {
    const n = adj.length, distA = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
    const heap: [number, number][] = [];
    const push = (d: number, v: number) => {
      heap.push([d, v]);
      let i = heap.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    };
    const pop = (): [number, number] => {
      const top = heap[0], last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
        }
      }
      return top;
    };
    const s0 = src * this.K;
    distA[s0] = 0; push(0, s0);
    while (heap.length) {
      const [d, v] = pop();
      if (d > distA[v]) continue;
      for (const [w, c] of adj[v]) {
        const nd = d + c;
        if (nd < distA[w] - 1e-9) { distA[w] = nd; prev[w] = v; push(nd, w); }
      }
    }
    return { dist: distA, prev };
  }

  /** Destination effective d’un voyageur depuis une station : la plus proche du bon type, ou la ville voulue */
  private target(r: Route, p: Pax, from: number): number {
    if (p.dest >= 0) return Number.isFinite(r.dist[p.dest * this.K]) ? p.dest : -1;
    let best = -1, bd = Infinity;
    for (const st of this.s.stations) {
      if (st.kind !== p.kind || st.id === from) continue;
      const d = r.dist[st.id * this.K];
      if (d < bd) { bd = d; best = st.id; }
    }
    return best;
  }

  private firstLeg(r: Route, t: number): Leg | null {
    const K = this.K;
    const path: number[] = [];
    for (let v = t * K; v >= 0; v = r.prev[v]) path.push(v);
    path.reverse();
    if (path.length < 3) return null;
    const line = (path[1] % K) - 1;
    if (line < 0) return null;
    let to = Math.floor(path[1] / K);
    for (let k = 2; k < path.length; k++) {
      if ((path[k] % K) - 1 !== line) break;
      to = Math.floor(path[k] / K);
    }
    return { line, to };
  }

  /** Les stations atteignables depuis une station (pour l’affichage) */
  reachable(from: number): Set<number> {
    const r = this.dijkstra(this.buildGraph(), from);
    return new Set(this.s.stations.filter(st => Number.isFinite(r.dist[st.id * this.K])).map(st => st.id));
  }

  /* ── Dotation hebdomadaire ── */

  private drawOffers(): void {
    const s = this.s, c = this.c;
    const pool: [OfferId, number][] = [['rame', 1.3], ['wagon', 1], ['pole', 0.55], ['budget', 1]];
    if (s.unlocked < c.linesMax) pool.push(['ligne', s.v === 'tram' ? 0.9 : 1.2]);
    pool.push(['tunnel', s.v === 'tgv' ? 0.45 : 0.75]);
    const a = this.pickW(pool, x => x[1]);
    const b = this.pickW(pool.filter(x => x[0] !== a[0]), x => x[1]);
    s.offers = [a, b].map(([id]) => ({ id, n: this.offerAmount(id) }));
  }
  offerAmount(id: OfferId): number {
    const v = this.s.v;
    return id === 'wagon' ? 2 : id === 'tunnel' ? (v === 'tgv' ? 1 : 2) : id === 'budget' ? (v === 'metro' ? 5 : v === 'tram' ? 80 : 5) : 1;
  }
  choose(k: number): string {
    const s = this.s, o = s.offers?.[k];
    if (!o) return '';
    s.offers = null;
    switch (o.id) {
      case 'ligne': s.unlocked = Math.min(this.c.linesMax, s.unlocked + 1); return `Nouvelle ligne disponible : ${this.lineName(s.unlocked - 1)}.`;
      case 'rame': s.trains += o.n; return 'Une rame de plus en réserve.';
      case 'wagon': s.wagons += o.n; return `${o.n} wagons de plus en réserve.`;
      case 'tunnel': s.tunnels += o.n; return `${o.n} ${this.tokenName(o.n)} de plus.`;
      case 'pole': s.poles += o.n; return 'Un pôle d’échanges à aménager : touchez une station, puis « Pôle d’échanges ».';
      case 'budget': s.budget += o.n; return `Crédits supplémentaires : +${this.money(o.n)}.`;
    }
  }

  /* ── La semaine ── */

  endWeek(): Report {
    const s = this.s, c = this.c;
    const r: Report = { events: [], delivered: 0, spawned: 0, warn: [], fresh: [] };
    if (s.over) return r;
    if (s.offers) this.choose(0);
    for (const l of s.lines) if (l.stops.length === 1) l.stops = [];
    r.spawned = this.spawn();
    r.delivered = this.transport();
    // La saturation
    for (const st of s.stations) {
      const w = this.waitingAt(st.id);
      st.peak = Math.max(st.peak, w);
      if (w > this.capOf(st)) {
        st.over++;
        if (st.over >= c.limit) { s.over = true; s.lost = true; s.lostAt = st.id; }
        else r.warn.push(st.id);
      } else st.over = Math.max(0, st.over - 1);
    }
    // Les recettes et la dotation
    const gain = c.income + c.fare * r.delivered;
    s.budget = Math.round((s.budget + gain) * 100) / 100;
    s.history.push({ week: s.week, spawned: r.spawned, delivered: r.delivered, waiting: s.pax.length });
    r.events.push(`Semaine ${s.week} : ${r.delivered} voyageur${r.delivered > 1 ? 's' : ''} à destination, ${r.spawned} nouveau${r.spawned > 1 ? 'x' : ''}, ${s.pax.length} en attente.`);
    if (s.lost) {
      const st = s.stations[s.lostAt];
      r.events.push(s.v === 'tgv' ? `⛔ ${st.name} est saturée depuis trop longtemps : la grogne des usagers fait suspendre votre plan.` : `⛔ ${st.name} déborde depuis ${c.limit} semaines : la préfecture ferme la station, le réseau est à l’arrêt.`);
      return r;
    }
    for (const id of r.warn) {
      const st = s.stations[id];
      r.events.push(st.over >= c.limit - 1 ? `🚨 ${st.name} est saturée (${this.waitingAt(id)} voyageurs) : dernière semaine avant la fermeture !` : `⚠️ ${st.name} est saturée (${this.waitingAt(id)} voyageurs pour ${this.capOf(st)} places).`);
    }
    if (s.week >= s.maxWeeks) { s.over = true; return r; }
    // Semaine suivante : les stations annoncées ouvrent, les suivantes s’annoncent
    s.week++;
    for (const p of s.pending) { const st = this.addStation(p, s.week); r.fresh.push(st.id); r.events.push(`🆕 Nouvelle ${s.v === 'tgv' ? 'ville à desservir' : 'station'} : ${st.name}${s.v === 'tgv' ? '' : ` (${(KIND_LABEL[s.v][st.kind] ?? '').toLowerCase()})`}.`); }
    this.forecastNext();
    this.drawEvent(r);
    this.drawOffers();
    if (c.gifts.includes(s.week)) { s.trains++; r.events.push('🚆 Livraison d’une rame neuve : elle attend en réserve.'); }
    for (const l of s.lines) if (l.trains === 0 && l.stops.length >= 2 && s.trains > 0) { s.trains--; l.trains = 1; }
    return r;
  }

  private spawnK(): number { return (0.55 + 0.45 * this.s.diff) * this.c.demand; }

  private spawn(): number {
    const s = this.s;
    const live = s.stations.filter(st => st.born <= s.week);
    const g = (1 + 0.065 * (s.week - 1)) * this.spawnK();
    const aff = (id: number) => s.events.some(e => e.type === 'affluence' && e.st === id && e.from <= s.week && s.week <= e.to) ? 3 : 1;
    let n = 0;
    const add = (at: number, kind: Kind | null, dest: number) => { s.pax.push({ id: ++s.paxId, at, kind, dest, born: s.week, legs: 0 }); n++; };
    if (s.v === 'tgv') {
      const wt = (st: Station) => Math.pow(st.pop, 0.6);
      for (const st of live) {
        const k = this.sample(0.5 * wt(st) * g * aff(st.id));
        const others = live.filter(o => o.id !== st.id);
        if (!others.length) continue;
        for (let j = 0; j < k; j++) add(st.id, null, this.pickW(others, o => wt(o) / Math.sqrt(dist(st, o))).id);
      }
    } else {
      const kinds = [...new Set(live.map(st => st.kind))];
      for (const st of live) {
        const dests = kinds.filter(k => k !== st.kind);
        if (!dests.length) continue;
        const k = this.sample((SPAWN[s.v][st.kind] ?? 0.6) * g * aff(st.id));
        for (let j = 0; j < k; j++) add(st.id, this.pickW(dests, d => DEST[d] ?? 1), -1);
      }
    }
    s.spawned += n;
    return n;
  }

  private transport(): number {
    const s = this.s;
    const cap = s.lines.map(l => this.capacity(l));
    const used = s.lines.map(() => 0), wanted = s.lines.map(() => 0);
    const adj = this.buildGraph();
    const cache = new Map<number, Route>();
    const route = (st: number) => { let r = cache.get(st); if (!r) { r = this.dijkstra(adj, st); cache.set(st, r); } return r; };
    const order = [...s.pax].sort((a, b) => a.born - b.born || a.id - b.id);
    const done = new Set<number>();
    for (const p of order) {
      for (let hop = 0; hop < 8; hop++) {
        const r = route(p.at);
        const t = this.target(r, p, p.at);
        if (t < 0) break;
        const leg = this.firstLeg(r, t);
        if (!leg) break;
        if (cap[leg.line] - used[leg.line] < 1) { wanted[leg.line]++; break; }
        used[leg.line]++;
        s.lines[leg.line].carried++;
        p.at = leg.to; p.legs++;
        const arrived = p.dest >= 0 ? p.at === p.dest : s.stations[p.at].kind === p.kind;
        if (arrived) {
          const wait = s.week - p.born;
          const sat = SAT[Math.min(SAT.length - 1, wait)] * Math.max(0.5, 1 - 0.08 * (p.legs - 1));
          s.delivered++; s.satSum += sat; s.waitSum += wait;
          s.stations[p.at].served++;
          done.add(p.id);
          break;
        }
      }
    }
    s.lines.forEach((l, k) => { l.used = used[k]; l.cap = cap[k]; l.wanted = wanted[k]; });
    s.pax = s.pax.filter(p => !done.has(p.id));
    return done.size;
  }

  /** Aléas de la semaine qui commence : grève, travaux, affluence, subvention */
  private drawEvent(r: Report): void {
    const s = this.s, w = s.week;
    if (w < 3 || w > s.maxWeeks) return;
    if (this.rand() >= 0.32 + 0.25 * (s.diff - 1)) return;
    const running = s.lines.filter(l => l.stops.length >= 2 && l.trains > 0);
    const segs = s.lines.flatMap(l => l.segs);
    const opts: [NetEvent['type'], number][] = [['affluence', 0.8], ['subvention', 0.55]];
    if (running.length) opts.push(['greve', 0.9]);
    if (segs.length) opts.push(['travaux', 1]);
    const [type] = this.pickW(opts, x => x[1]);
    const ev: NetEvent = { type, from: w, to: w, line: -1, a: -1, b: -1, st: -1, text: '' };
    if (type === 'greve') {
      const l = running.sort((a, b) => b.carried - a.carried)[this.int(Math.min(2, running.length))];
      ev.line = l.id;
      ev.text = s.v === 'tgv' ? `✊ Grève des cheminots : ${this.lineRef(l.id)} ne roule pas cette semaine.` : `✊ Grève des conducteurs : ${this.lineRef(l.id)} ne roule pas cette semaine.`;
    } else if (type === 'travaux') {
      const g = segs[this.int(segs.length)];
      ev.a = g.a; ev.b = g.b; ev.to = w + 1;
      ev.text = `🚧 Travaux entre ${s.stations[g.a].name} et ${s.stations[g.b].name} : tronçon fermé cette semaine et la suivante.`;
    } else if (type === 'affluence') {
      const live = s.stations.filter(st => st.born < w);
      const st = live[this.int(live.length)];
      ev.st = st.id;
      const what = s.v === 'tgv' ? ['Grand salon', 'Festival', 'Départs en vacances'] : ['Concert', 'Match', 'Grand marché', 'Salon'];
      ev.text = `🎉 ${what[this.int(what.length)]} à ${st.name} : trois fois plus de voyageurs y partent cette semaine.`;
    } else {
      const n = s.v === 'metro' ? 3 : s.v === 'tram' ? 50 : 3;
      s.budget += n;
      ev.text = `💶 ${s.v === 'tram' ? 'Le Département' : s.v === 'tgv' ? 'L’Union européenne' : 'L’État'} verse une subvention exceptionnelle : +${this.money(n)}.`;
    }
    s.events.push(ev);
    r.events.push(ev.text);
  }

  activeEvents(): NetEvent[] { return this.s.events.filter(e => e.from <= this.s.week && this.s.week <= e.to); }

  /* ── Bilan ── */

  outcome(): Outcome {
    const s = this.s;
    const total = s.spawned, D = s.delivered;
    const frac = total ? D / total : 0;
    const sat = D ? s.satSum / D : 0;
    const weeks = s.over ? (s.lost ? s.week - 1 : s.maxWeeks) : s.week - 1;
    const surv = weeks / s.maxWeeks;
    const q = Math.pow(frac, 1.4) * (0.5 + 0.5 * sat);
    const score = clamp(0.1 * surv + 0.9 * q * Math.pow(surv, 1.5), 0, 1);
    const served = s.stations.filter(st => s.lines.some(l => l.stops.length >= 2 && l.stops.includes(st.id))).length;
    return { score, frac, sat, delivered: D, total, waiting: s.pax.length, weeks, surv, served, stations: s.stations.length };
  }

  review(): { best: string; worst: string } {
    const s = this.s;
    const lines = s.lines.filter(l => l.carried > 0).sort((a, b) => b.carried - a.carried);
    const best = lines.length ? `${this.lineName(lines[0].id)} : ${lines[0].carried} trajets assurés${lines[0].stops.length >= 2 ? `, de ${s.stations[lines[0].stops[0]].name} à ${s.stations[lines[0].stops[lines[0].stops.length - 1]].name}` : ''}.` : 'Aucune ligne n’a transporté de voyageur.';
    let worst: string;
    if (s.lost) worst = `${s.stations[s.lostAt].name}, saturée trop longtemps : c’est elle qui a fait fermer le réseau.`;
    else {
      const st = [...s.stations].sort((a, b) => b.peak - a.peak)[0];
      worst = st && st.peak > this.capOf(st) ? `${st.name} : jusqu’à ${st.peak} voyageurs sur le quai pour ${this.capOf(st)} places.` : st && st.peak > 0 ? `Le quai le plus chargé, ${st.name}, n’a jamais débordé (${st.peak} voyageurs au plus).` : 'Aucun quai saturé.';
    }
    return { best, worst };
  }

  /* ── Libellés ── */

  lineName(li: number): string { return this.s.v === 'tgv' ? `LGV ${li + 1}` : this.s.v === 'tram' ? `Ligne T${li + 1}` : `Ligne ${li + 1}`; }
  /** « la ligne 2 », « la ligne T2 », « la LGV 2 » */
  lineRef(li: number): string { const n = this.lineName(li); return 'la ' + (n.startsWith('Ligne') ? 'l' + n.slice(1) : n); }
  tokenName(n = 1): string { return this.s.v === 'tram' ? (n > 1 ? 'ponts' : 'pont') : (n > 1 ? 'tunnels' : 'tunnel'); }
  money(n: number): string {
    const v = this.s.v;
    if (v === 'metro') { const k = Math.round(n); return `${k} tronçon${Math.abs(k) > 1 ? 's' : ''}`; }
    if (v === 'tram') return `${Math.round(n)} M€`;
    return `${(Math.round(n * 10) / 10).toString().replace('.', ',')} Md€`;
  }
  fmtKm(len: number): string {
    const km = this.s.v === 'tgv' ? len * 10.6 : this.s.v === 'tram' ? len * 0.1 : len * 0.25;
    return this.s.v === 'tgv' ? `${Math.round(km / 10) * 10} km` : `${(Math.round(km * 10) / 10).toString().replace('.', ',')} km`;
  }
}

/* ============================================================
 *  Le composant
 * ============================================================ */

interface StView {
  id: number; x: number; y: number; d: string; r: number; cls: string; aria: string;
  load: string | null; loadColor: string; timer: string | null; hub: boolean;
  pax: string[]; more: number; mx: number; my: number; label: string; lx: number; ly: number; anchor: string; ring: number;
}
interface SegView { key: string; x1: number; y1: number; x2: number; y2: number; color: string; cls: string }
interface Sum { title: string; o: Outcome; best: string; worst: string }
interface Alert { text: string; tone: string }

const BRIEF: Record<Variant, string> = {
  metro: 'Reliez les stations : chaque voyageur veut rejoindre la forme dessinée à côté de lui. Une station qui déborde trois semaines ferme le réseau.',
  tram: 'Peu de lignes, de longues distances, un budget serré : chaque tronçon se paie au kilomètre. Ne laissez aucun quartier déborder.',
  tgv: 'Reliez les grandes villes : la demande va surtout de Paris vers les métropoles. Les tronçons en montagne coûtent bien plus cher.',
};
const TITLE: Record<Variant, string> = { metro: 'Plan du métro du Grand Paris', tram: 'Plan du tramway', tgv: 'Carte des lignes à grande vitesse' };

const OFFER_INFO: Record<OfferId, { icon: string; name: string }> = {
  ligne: { icon: '🎨', name: 'Nouvelle ligne' }, rame: { icon: '🚆', name: 'Une rame' }, wagon: { icon: '🚃', name: 'Deux wagons' },
  tunnel: { icon: '🚇', name: 'Tunnels' }, pole: { icon: '⭐', name: 'Pôle d’échanges' }, budget: { icon: '💶', name: 'Crédits' },
};

@Component({
  selector: 'app-reseau-game',
  template: `
    @let o = live();
    <div class="rz" [class]="'rz v-' + variant">
      <div class="head">
        <span>Semaine <b class="mono">{{ week() }}</b>/{{ maxWeeks }}</span>
        <span [attr.aria-label]="'Voyageurs arrivés : ' + o.delivered + ' sur ' + o.total">🧍 <b class="mono">{{ o.delivered }}</b><small class="mono">/{{ o.total }}</small></span>
        <span [attr.aria-label]="'Satisfaction : ' + pct(o.sat)">😊 <b class="mono">{{ o.delivered ? pct(o.sat) : '—' }}</b></span>
        <span class="bud" [attr.aria-label]="'Budget : ' + budgetLong()">{{ variant === 'metro' ? '🛤️' : '💶' }} <b class="mono">{{ budget() }}</b></span>
      </div>
      @if (!over() && week() <= 2) { <p class="brief">{{ brief }}</p> }
      @if (alerts().length) {
        <ul class="alerts" aria-live="polite">@for (a of alerts(); track $index) { <li [class]="a.tone">{{ a.text }}</li> }</ul>
      }

      <div class="map-wrap">
        <svg #map class="map" [attr.viewBox]="'0 0 ' + mw + ' ' + mh" (click)="mapTap($event)" role="group" [attr.aria-label]="mapTitle">
          @if (variant === 'tgv') {
            <rect class="sea" x="0" y="0" [attr.width]="mw" [attr.height]="mh" />
            <polygon class="land" [attr.points]="francePts" />
            @for (m of mountains; track m.name) {
              <polygon class="mnt" [attr.points]="m.pts" />
              <text class="mnt-l" [attr.x]="m.x" [attr.y]="m.y">{{ m.name }}</text>
            }
          } @else {
            <rect class="ground" x="0" y="0" [attr.width]="mw" [attr.height]="mh" />
            <polyline class="river" [attr.points]="riverPts" [attr.stroke-width]="variant === 'tram' ? 4.5 : 3.4" />
            <text class="river-l" [attr.x]="riverLabel.x" [attr.y]="riverLabel.y">{{ riverName }}</text>
          }
          @for (g of segView(); track g.key) {
            <line [attr.class]="g.cls" [attr.x1]="g.x1" [attr.y1]="g.y1" [attr.x2]="g.x2" [attr.y2]="g.y2" [attr.stroke]="g.color" />
          }
          @for (w of works(); track w.key) { <text class="work" [attr.x]="w.x" [attr.y]="w.y">🚧</text> }
          @for (t of trainView(); track t.key) {
            <rect class="train" [attr.x]="t.x - 1.5" [attr.y]="t.y - 1" width="3" height="2" rx=".6" [attr.fill]="t.color" [attr.transform]="'rotate(' + t.a + ' ' + t.x + ' ' + t.y + ')'" />
          }
          @for (g of ghostView(); track $index) {
            <path class="ghost" [attr.d]="g.d" />
            @if (g.label) { <text class="ghost-l" [attr.x]="g.x" [attr.y]="g.y">{{ g.label }}</text> }
          }
          @for (st of stView(); track st.id) {
            <g [attr.class]="st.cls" role="button" tabindex="0" [attr.aria-label]="st.aria" (keydown.enter)="tap(st.id)" (keydown.space)="$event.preventDefault(); tap(st.id)">
              <circle class="hit" [attr.cx]="st.x" [attr.cy]="st.y" r="5.5" />
              @if (st.ring) { <circle class="endring" [attr.cx]="st.x" [attr.cy]="st.y" [attr.r]="st.r + 2.6" [attr.stroke]="lineColor(selLine() ?? 0)" /> }
              @if (st.load) { <circle class="load" [attr.cx]="st.x" [attr.cy]="st.y" [attr.r]="st.r + 1.7" [attr.stroke]="st.loadColor" [attr.stroke-dasharray]="st.load" [attr.transform]="'rotate(-90 ' + st.x + ' ' + st.y + ')'" /> }
              @if (st.timer) { <circle class="timer" [attr.cx]="st.x" [attr.cy]="st.y" [attr.r]="st.r + 3.4" [attr.stroke-dasharray]="st.timer" [attr.transform]="'rotate(-90 ' + st.x + ' ' + st.y + ')'" /> }
              @if (st.hub) { <circle class="hubring" [attr.cx]="st.x" [attr.cy]="st.y" [attr.r]="st.r + 0.9" /> }
              <path class="shape" [attr.d]="st.d" />
              @for (p of st.pax; track $index) { <path class="pax" [attr.d]="p" /> }
              @if (st.more) { <text class="more" [attr.x]="st.mx" [attr.y]="st.my">+{{ st.more }}</text> }
              @if (st.label) { <text class="lbl" [attr.x]="st.lx" [attr.y]="st.ly" [attr.text-anchor]="st.anchor">{{ st.label }}</text> }
            </g>
          }
        </svg>
      </div>

      @if (!over()) {
        @if (offers(); as of) {
          <div class="offers" role="group" aria-label="Dotation de la semaine">
            <span class="ot">🎁 Dotation de la semaine : choisissez</span>
            @for (f of of; track $index) {
              <button type="button" class="offer" [disabled]="busy()" (click)="choose($index)"><span class="oi">{{ f.icon }}</span><b>{{ f.name }}</b><small>{{ f.desc }}</small></button>
            }
          </div>
        }
        <div class="lines" role="toolbar" aria-label="Lignes">
          @for (l of lineChips(); track l.id) {
            <button type="button" class="chip" [class.sel]="selLine() === l.id" [class.empty]="l.empty" [class.strike]="l.strike"
                    [style.border-color]="l.color" [style.background]="selLine() === l.id ? l.color : null" [style.color]="selLine() === l.id ? '#fff' : null"
                    [attr.aria-pressed]="selLine() === l.id" [attr.aria-label]="l.aria" [disabled]="busy()" (click)="pickLine(l.id)">
              <i [style.background]="l.color"></i>{{ l.label }}
            </button>
          }
          @if (locked()) { <span class="locked" [attr.aria-label]="locked() + ' lignes encore fermées'">🔒 ×{{ locked() }}</span> }
        </div>
        <div class="stock" aria-label="Réserve">
          <span title="Rames en réserve">🚆 <b class="mono">{{ stock().trains }}</b></span>
          <span title="Wagons en réserve">🚃 <b class="mono">{{ stock().wagons }}</b></span>
          <span [title]="tokenTitle">{{ tokenIcon }} <b class="mono">{{ stock().tunnels }}</b></span>
          <span title="Pôles d’échanges à aménager">⭐ <b class="mono">{{ stock().poles }}</b></span>
        </div>

        @if (lineInfo(); as li) {
          <div class="panel" [style.border-color]="li.color">
            <div class="pt"><b [style.color]="li.color">{{ li.name }}</b> <span>{{ li.desc }}</span></div>
            @if (li.cap) { <div class="pstat">{{ li.cap }}</div> }
            <div class="pbtns">
              <span class="grp"><button type="button" class="btn small" [disabled]="busy() || !li.trains" (click)="train(-1)" aria-label="Retirer une rame">−</button>
                <span class="mono">🚆 {{ li.trains }}</span>
                <button type="button" class="btn small" [disabled]="busy() || !stock().trains || li.stops < 2" (click)="train(1)" aria-label="Ajouter une rame">+</button></span>
              <span class="grp"><button type="button" class="btn small" [disabled]="busy() || !li.wagons" (click)="wagon(-1)" aria-label="Retirer un wagon">−</button>
                <span class="mono">🚃 {{ li.wagons }}</span>
                <button type="button" class="btn small" [disabled]="busy() || !stock().wagons || li.wagons >= li.trains * wagonsPerTrain" (click)="wagon(1)" aria-label="Ajouter un wagon">+</button></span>
              @if (li.stops >= 2) {
                <button type="button" class="btn small" [disabled]="busy()" (click)="flip()">⇄ Autre bout</button>
                <button type="button" class="btn small" [disabled]="busy()" (click)="removeLast()">✂ Dernier tronçon</button>
                <button type="button" class="btn small" [disabled]="busy()" (click)="deleteLine()">🗑 Supprimer</button>
              }
            </div>
          </div>
        } @else if (stationInfo(); as si) {
          <div class="panel">
            <div class="pt"><b>{{ si.glyph }} {{ si.name }}</b> <span>{{ si.kind }}</span></div>
            <div class="pstat">{{ si.wait }}</div>
            @if (si.dests) { <div class="pstat">{{ si.dests }}</div> }
            <div class="pstat">{{ si.lines }}</div>
            @if (si.canHub) { <div class="pbtns"><button type="button" class="btn small" [disabled]="busy()" (click)="hub(si.id)">⭐ Aménager un pôle d’échanges</button></div> }
          </div>
        }
        <p class="info" aria-live="polite">{{ info() }}</p>
        <div class="foot">
          <button type="button" class="btn small" [disabled]="!canUndo() || busy()" (click)="undoLast()">↶ Annuler</button>
          <button type="button" class="btn primary small" [disabled]="busy() || !!offers()" (click)="endWeek()">{{ offers() ? 'Choisissez la dotation ↑' : week() >= maxWeeks ? 'Dernière semaine ▶' : 'Lancer la semaine ▶' }}</button>
        </div>
      }

      @if (summary(); as sm) {
        <div class="sum" [class.good]="sm.o.score >= 0.65" [class.bad]="sm.o.score < 0.45">
          <b class="verdict">{{ sm.title }}</b>
          <div class="stats">
            <span>Voyageurs arrivés : <b class="mono">{{ sm.o.delivered }}/{{ sm.o.total }}</b> ({{ pct(sm.o.frac) }})</span>
            <span>Satisfaction : <b class="mono">{{ pct(sm.o.sat) }}</b></span>
            <span>Semaines tenues : <b class="mono">{{ sm.o.weeks }}/{{ maxWeeks }}</b></span>
            <span>{{ variant === 'tgv' ? 'Villes desservies' : 'Stations desservies' }} : <b class="mono">{{ sm.o.served }}/{{ sm.o.stations }}</b></span>
          </div>
          <p>✅ <b>Ligne phare.</b> {{ sm.best }}</p>
          <p>⚠️ <b>Point noir.</b> {{ sm.worst }}</p>
          <p class="score">Note du réseau : <b class="mono">{{ round(sm.o.score * 100) }}/100</b></p>
        </div>
      }

      <details class="legend">
        <summary>Légende et règles</summary>
        <ul>
          @for (l of legend; track l.label) { <li><span class="sw">{{ l.icon }}</span> {{ l.label }}</li> }
        </ul>
        <p>{{ rules }}</p>
      </details>

      @if (log().length) { <ul class="log">@for (l of log(); track $index) { <li>{{ l }}</li> }</ul> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .rz { display: grid; gap: 7px; }
    .head { display: flex; flex-wrap: wrap; gap: 4px 12px; justify-content: space-between; align-items: center; font-size: 12.5px; small { color: var(--ink-3); } }
    .brief { margin: 0; font-size: 12px; color: var(--ink-2); }
    .alerts { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: 12px;
      li { padding: 4px 8px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--line); }
      li.bad { background: var(--bad-soft); border-color: var(--bad); color: var(--ink); }
      li.warn { border-color: #e0a100; } }
    .map-wrap { justify-self: center; width: 100%; max-width: 480px; }
    .map { display: block; width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--line); user-select: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
    .ground { fill: var(--surface-2); }
    .sea { fill: color-mix(in srgb, #4a90c8 16%, var(--surface)); }
    .land { fill: var(--surface-2); stroke: var(--line); stroke-width: .5; }
    .mnt { fill: color-mix(in srgb, #a07a4a 22%, transparent); stroke: color-mix(in srgb, #a07a4a 45%, transparent); stroke-width: .3; stroke-dasharray: 1 .8; }
    .mnt-l { font: italic 2.3px var(--font-body); fill: #9a7646; text-anchor: middle; pointer-events: none; }
    .river { fill: none; stroke: #79acd8; stroke-linejoin: round; stroke-linecap: round; opacity: .75; }
    .river-l { font: italic 2.6px var(--font-body); fill: #4d86b8; pointer-events: none; }
    .seg { stroke-width: 2.1; stroke-linecap: round; transition: opacity .2s; }
    .seg.dim { opacity: .3; }
    .seg.hl { stroke-width: 2.6; }
    .seg.closed { stroke-dasharray: 1.2 1.6; opacity: .55; }
    .seg.idle { stroke-dasharray: 3 1.5; }
    .work { font-size: 3.4px; text-anchor: middle; dominant-baseline: middle; pointer-events: none; }
    .train { stroke: #fff; stroke-width: .35; pointer-events: none; }
    .ghost { fill: none; stroke: var(--ink-3); stroke-width: .5; stroke-dasharray: 1 .8; opacity: .8; pointer-events: none; }
    .ghost-l { font: 600 2.2px var(--font-body); fill: var(--ink-3); text-anchor: middle; pointer-events: none; }
    .st { cursor: pointer; outline: none; }
    .st:focus-visible .hit { stroke: var(--accent); stroke-width: .6; fill: color-mix(in srgb, var(--accent) 12%, transparent); }
    .hit { fill: transparent; }
    .shape { fill: var(--surface); stroke: var(--ink); stroke-width: .75; }
    .st.sel .shape { fill: #f4d35e; }
    .st.fresh .shape { animation: pop .9s ease; transform-box: fill-box; transform-origin: center; }
    .st.reach .shape { stroke-width: 1.1; }
    .st.cut .shape { opacity: .55; }
    .hubring { fill: none; stroke: var(--ink); stroke-width: .45; }
    .endring { fill: none; stroke-width: .7; stroke-dasharray: 1.2 .9; animation: spin 4s linear infinite; transform-box: fill-box; transform-origin: center; }
    .load { fill: none; stroke-width: .9; stroke-linecap: round; }
    .timer { fill: none; stroke: var(--bad); stroke-width: 1.3; animation: blink 1.1s ease-in-out infinite; }
    .pax { fill: var(--ink-2); pointer-events: none; }
    .more, .lbl { font: 700 2.2px var(--font-body); fill: var(--ink-2); pointer-events: none; }
    .lbl { font-weight: 600; font-size: 2.5px; fill: var(--ink); paint-order: stroke; stroke: var(--surface-2); stroke-width: .7px; }
    .v-tgv .lbl { stroke: var(--surface-2); }
    @keyframes pop { 0% { transform: scale(.3); } 70% { transform: scale(1.25); } 100% { transform: none; } }
    @keyframes blink { 50% { opacity: .35; } }
    @keyframes spin { to { transform: rotate(360deg); } }
    .offers { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; .ot { grid-column: 1 / -1; font-size: 12px; font-weight: 600; } }
    .offer { display: grid; justify-items: center; gap: 1px; min-height: 64px; padding: 6px 4px; border-radius: 10px; border: 1.5px solid var(--accent); background: var(--surface); color: var(--ink); cursor: pointer;
      font: 12px var(--font-body); text-align: center;
      .oi { font-size: 19px; line-height: 1; } b { font-size: 12.5px; } small { font-size: 11px; color: var(--ink-2); line-height: 1.25; }
      &:disabled { opacity: .5; } }
    .lines { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
    .chip { display: inline-flex; align-items: center; gap: 5px; min-height: 34px; min-width: 44px; padding: 3px 10px; border-radius: 999px; border: 2px solid; background: var(--surface); color: var(--ink);
      font: 600 12.5px var(--font-body); cursor: pointer;
      i { width: 10px; height: 10px; border-radius: 50%; }
      &.sel i { background: #fff !important; }
      &.empty { border-style: dashed; }
      &.strike { text-decoration: line-through; }
      &:disabled { opacity: .55; } }
    .locked { font-size: 12px; color: var(--ink-3); }
    .stock { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; color: var(--ink-2); }
    .panel { display: grid; gap: 4px; padding: 7px 9px; border-radius: 10px; border: 1.5px solid var(--line); background: var(--surface-2); font-size: 12.5px;
      .pt { display: flex; flex-wrap: wrap; gap: 2px 8px; align-items: baseline; span { color: var(--ink-2); font-size: 12px; } }
      .pstat { font-size: 12px; color: var(--ink-2); } }
    .pbtns { display: flex; flex-wrap: wrap; gap: 5px; align-items: center;
      .grp { display: inline-flex; align-items: center; gap: 4px; .btn { min-width: 34px; } } }
    .info { margin: 0; min-height: 2.6em; font-size: 12px; color: var(--ink); }
    .foot { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
    .sum { display: grid; gap: 5px; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--line); font-size: 12.5px;
      &.good { border-color: var(--good); background: var(--good-soft); } &.bad { border-color: var(--bad); background: var(--bad-soft); }
      p { margin: 0; } .verdict { font-size: 14px; } .score { color: var(--ink-2); } }
    .stats { display: flex; flex-wrap: wrap; gap: 3px 14px; color: var(--ink-2); }
    .legend { font-size: 12px; color: var(--ink-2);
      summary { cursor: pointer; min-height: 32px; display: flex; align-items: center; color: var(--ink); }
      ul { list-style: none; margin: 4px 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 4px 10px; }
      li { display: flex; gap: 6px; align-items: center; } p { margin: 4px 0 0; } }
    .sw { display: inline-grid; place-items: center; flex: none; min-width: 20px; height: 20px; font-size: 13px; color: var(--ink); }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 110px; overflow: auto; font-size: 11.5px; color: var(--ink-2); }
    @media (prefers-reduced-motion: reduce) { .timer, .endring, .st.fresh .shape { animation: none; } .seg { transition: none; } }
  `,
})
export class ReseauGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  private readonly mapEl = viewChild<ElementRef<SVGSVGElement>>('map');

  protected readonly round = Math.round;
  protected variant: Variant = 'metro';
  protected maxWeeks = 14;
  protected mw = 100;
  protected mh = 100;
  protected brief = '';
  protected rules = '';
  protected mapTitle = '';
  protected wagonsPerTrain = 2;
  protected tokenIcon = '🚇';
  protected tokenTitle = '';
  protected riverPts = '';
  protected riverName = '';
  protected riverLabel: Pt = { x: 0, y: 0 };
  protected francePts = FRANCE.map(p => `${p.x},${p.y}`).join(' ');
  protected mountains = MOUNTAINS.map(m => ({
    name: m.name, pts: m.poly.map(p => `${p.x},${p.y}`).join(' '),
    x: Math.round(m.poly.reduce((t, p) => t + p.x, 0) / m.poly.length), y: Math.round(m.poly.reduce((t, p) => t + p.y, 0) / m.poly.length),
  }));
  protected legend: { icon: string; label: string }[] = [];

  private sim!: ReseauSim;
  private undo: SimState[] = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private raf = 0;
  private warned = new Set<number>();
  private readonly ver = signal(0);
  protected readonly selLine = signal<number | null>(null);
  protected readonly selStation = signal<number | null>(null);
  protected readonly info = signal('');
  protected readonly log = signal<string[]>([]);
  protected readonly fresh = signal<ReadonlySet<number>>(new Set());
  protected readonly over = signal(false);
  protected readonly busy = signal(false);
  protected readonly anim = signal(-1);
  protected readonly summary = signal<Sum | null>(null);

  protected readonly week = computed(() => (this.ver(), this.sim.s.week));
  protected readonly live = computed(() => (this.ver(), this.sim.outcome()));
  protected readonly budgetLong = computed(() => (this.ver(), this.sim.money(this.sim.s.budget)));
  protected readonly budget = computed(() => (this.ver(), this.variant === 'metro' ? String(Math.round(this.sim.s.budget)) : this.sim.money(this.sim.s.budget)));
  protected readonly canUndo = computed(() => (this.ver(), this.undo.length > 0 && !this.over()));
  protected readonly locked = computed(() => (this.ver(), this.sim.c.linesMax - this.sim.s.unlocked));
  protected readonly stock = computed(() => { this.ver(); const s = this.sim.s; return { trains: s.trains, wagons: s.wagons, tunnels: s.tunnels, poles: s.poles }; });

  protected readonly offers = computed(() => {
    this.ver();
    const of = this.sim.s.offers;
    return of ? of.map(o => ({ icon: o.id === 'budget' && this.variant === 'metro' ? '🛤️' : OFFER_INFO[o.id].icon, name: this.offerName(o.id, o.n), desc: this.offerDesc(o.id, o.n) })) : null;
  });

  protected readonly alerts = computed<Alert[]>(() => {
    this.ver();
    const sim = this.sim, s = sim.s;
    if (s.over) return [];
    const out: Alert[] = sim.activeEvents().map(e => ({ text: e.text, tone: e.type === 'subvention' ? '' : 'warn' }));
    for (const st of s.stations) {
      if (st.over > 0) out.push({ text: `${st.over >= sim.c.limit - 1 ? '🚨' : '⚠️'} ${st.name} saturée depuis ${st.over} semaine${st.over > 1 ? 's' : ''} (${sim.waitingAt(st.id)}/${sim.capOf(st)}) : fermeture à ${sim.c.limit}.`, tone: 'bad' });
    }
    if (s.pending.length) out.push({ text: `🔮 La semaine prochaine : ${s.pending.map(p => p.name).join(', ')} (en pointillé sur le plan).`, tone: '' });
    return out;
  });

  protected readonly lineChips = computed(() => {
    this.ver();
    const sim = this.sim, s = sim.s;
    return s.lines.filter(l => sim.usable(l)).map(l => {
      const name = sim.lineName(l.id);
      const strike = sim.strike(l.id);
      return {
        id: l.id, color: LINE_COLORS[l.id], empty: l.stops.length < 2, strike,
        label: s.v === 'tgv' ? `${l.id + 1}` : s.v === 'tram' ? `T${l.id + 1}` : `${l.id + 1}`,
        aria: `${name}${l.stops.length < 2 ? ', à tracer' : `, ${l.stops.length} stations, ${l.trains} rame${l.trains > 1 ? 's' : ''}`}${strike ? ', en grève' : ''}`,
      };
    });
  });

  protected readonly lineInfo = computed(() => {
    this.ver();
    const li = this.selLine();
    if (li === null) return null;
    const sim = this.sim, l = sim.s.lines[li];
    const n = l.stops.length;
    const capNow = sim.capacity(l);
    let desc = n === 0 ? 'Touchez une première station.' : n === 1 ? `Départ : ${sim.s.stations[l.stops[0]].name}. Touchez la station suivante.` : `${n} stations · ${sim.fmtKm(sim.lineLen(l))} · prolongée depuis ${sim.s.stations[sim.lineEnd(l)].name}`;
    if (sim.strike(li)) desc += ' · en grève cette semaine';
    let cap = '';
    if (n >= 2) {
      cap = l.trains ? `Capacité ≈ ${capNow} trajets par semaine (fréquence ×${sim.freq(l).toFixed(1).replace('.', ',')})` : 'Aucune rame : la ligne ne roule pas.';
      if (l.cap > 0 || l.wanted > 0) cap += ` · semaine passée : ${l.used}/${l.cap} places utilisées${l.wanted ? `, ${l.wanted} voyageurs restés à quai` : ''}`;
    }
    return { id: li, name: sim.lineName(li), color: LINE_COLORS[li], desc, cap, trains: l.trains, wagons: l.wagons, stops: n };
  });

  protected readonly stationInfo = computed(() => {
    this.ver();
    const id = this.selStation();
    if (id === null) return null;
    const sim = this.sim, s = sim.s, st = s.stations[id];
    const here = s.pax.filter(p => p.at === id);
    const cap = sim.capOf(st);
    let dests = '';
    if (here.length) {
      const m = new Map<string, number>();
      for (const p of here) { const k = p.dest >= 0 ? s.stations[p.dest].name : `${KIND_GLYPH[p.kind!]} ${KIND_LABEL[s.v][p.kind!] ?? ''}`; m.set(k, (m.get(k) ?? 0) + 1); }
      dests = 'Destinations : ' + [...m].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, n]) => `${k} ×${n}`).join(', ');
    }
    const lines = s.lines.filter(l => l.stops.length >= 2 && l.stops.includes(id)).map(l => sim.lineName(l.id));
    return {
      id, name: st.name, glyph: KIND_GLYPH[st.kind], kind: s.v === 'tgv' ? `${st.pop.toString().replace('.', ',')} M d’habitants` : KIND_LABEL[s.v][st.kind] ?? '',
      wait: `${here.length} voyageur${here.length > 1 ? 's' : ''} en attente pour ${cap} places${st.hub ? ' (pôle d’échanges)' : ''}${st.over ? ` · saturée depuis ${st.over} semaine${st.over > 1 ? 's' : ''}` : ''}.`,
      dests, lines: lines.length ? `Desservie par : ${lines.join(', ')}.` : 'Aucune ligne ne la dessert.',
      canHub: !st.hub && s.poles > 0,
    };
  });

  /** Les tronçons, décalés quand plusieurs lignes partagent le même */
  protected readonly segView = computed<SegView[]>(() => {
    this.ver();
    const sim = this.sim, s = sim.s, sel = this.selLine();
    const shared = new Map<string, number[]>();
    for (const l of s.lines) for (const g of l.segs) {
      const k = g.a < g.b ? `${g.a}-${g.b}` : `${g.b}-${g.a}`;
      shared.set(k, [...(shared.get(k) ?? []), l.id]);
    }
    const out: SegView[] = [];
    for (const l of s.lines) {
      const idle = l.trains === 0 || sim.strike(l.id);
      for (const g of l.segs) {
        const k = g.a < g.b ? `${g.a}-${g.b}` : `${g.b}-${g.a}`;
        const ids = shared.get(k)!;
        const A = s.stations[Math.min(g.a, g.b)], B = s.stations[Math.max(g.a, g.b)];
        const len = Math.max(0.01, dist(A, B)), nx = -(B.y - A.y) / len, ny = (B.x - A.x) / len;
        const off = (ids.indexOf(l.id) - (ids.length - 1) / 2) * 2.1;
        const cls = ['seg'];
        if (sel !== null && sel !== l.id) cls.push('dim');
        if (sel === l.id) cls.push('hl');
        if (sim.closedPair(g.a, g.b)) cls.push('closed'); else if (idle) cls.push('idle');
        out.push({ key: `${l.id}:${k}`, x1: r1(A.x + nx * off), y1: r1(A.y + ny * off), x2: r1(B.x + nx * off), y2: r1(B.y + ny * off), color: LINE_COLORS[l.id], cls: cls.join(' ') });
      }
    }
    return out;
  });

  protected readonly works = computed(() => {
    this.ver();
    const s = this.sim.s;
    return this.sim.activeEvents().filter(e => e.type === 'travaux').map(e => ({ key: `${e.a}-${e.b}`, x: r1((s.stations[e.a].x + s.stations[e.b].x) / 2), y: r1((s.stations[e.a].y + s.stations[e.b].y) / 2) }));
  });

  protected readonly trainView = computed(() => {
    this.ver();
    const t = this.anim(), sim = this.sim, s = sim.s;
    const out: { key: string; x: number; y: number; a: number; color: string }[] = [];
    for (const l of s.lines) {
      if (l.stops.length < 2 || !l.trains || sim.strike(l.id)) continue;
      const pts = l.stops.map(i => s.stations[i]);
      const lens = pts.slice(1).map((p, i) => dist(pts[i], p));
      const tot = lens.reduce((a, b) => a + b, 0);
      for (let k = 0; k < l.trains; k++) {
        let u = (k + 0.5) / l.trains + (t > 0 ? t * 2 * sim.freq(l) : 0);
        u = u % 2; if (u > 1) u = 2 - u;
        let d = u * tot, i = 0;
        while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
        const A = pts[i], B = pts[i + 1], f = lens[i] ? Math.min(1, d / lens[i]) : 0;
        out.push({ key: `${l.id}-${k}`, x: r1(A.x + (B.x - A.x) * f), y: r1(A.y + (B.y - A.y) * f), a: Math.round(Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI), color: LINE_COLORS[l.id] });
      }
    }
    return out;
  });

  protected readonly ghostView = computed(() => {
    this.ver();
    const v = this.variant;
    return this.sim.s.pending.map(p => ({ d: shapePath(p.kind, p.x, p.y, v === 'tgv' ? this.cityR(p.pop) : 2.4), x: p.x, y: p.y + (v === 'tgv' ? this.cityR(p.pop) + 3 : 5.3), label: v === 'tgv' ? p.name : 'bientôt' }));
  });

  protected readonly stView = computed<StView[]>(() => {
    this.ver();
    const sim = this.sim, s = sim.s, sel = this.selLine(), focus = this.selStation(), fresh = this.fresh();
    const line = sel !== null ? s.lines[sel] : null;
    const endSt = line && line.stops.length ? sim.lineEnd(line) : -1;
    const by = new Map<number, Pax[]>();
    for (const p of s.pax) by.set(p.at, [...(by.get(p.at) ?? []), p]);
    return s.stations.map(st => {
      const r = s.v === 'tgv' ? this.cityR(st.pop) : 2.4;
      const here = by.get(st.id) ?? [];
      const cap = sim.capOf(st);
      const lf = here.length / cap;
      const C = 2 * Math.PI * (r + 1.7), T = 2 * Math.PI * (r + 3.4);
      const shown = here.slice(0, 8);
      const px0 = st.x + r + 1.9, py0 = st.y - 1.2;
      const left = st.x > (s.v === 'tgv' ? 80 : 84);
      const pax = shown.map((p, k) => {
        const col = k % 4, row = Math.floor(k / 4);
        const x = left ? st.x - r - 1.9 - col * 2.4 : px0 + col * 2.4, y = py0 + row * 2.5;
        return p.kind ? shapePath(p.kind, x, y, 0.95) : shapePath('rond', x, y, 0.85);
      });
      const cls = ['st'];
      if (focus === st.id) cls.push('sel');
      if (fresh.has(st.id)) cls.push('fresh');
      if (line && line.stops.includes(st.id)) cls.push('reach');
      const served = s.lines.some(l => l.stops.length >= 2 && l.stops.includes(st.id));
      const kindLabel = s.v === 'tgv' ? `${st.pop.toString().replace('.', ',')} M d’habitants` : KIND_LABEL[s.v][st.kind];
      const lbl = s.v === 'tgv';
      return {
        id: st.id, x: st.x, y: st.y, d: shapePath(st.kind === 'ville' ? 'rond' : st.kind, st.x, st.y, r), r, cls: cls.join(' '),
        aria: `${st.name}, ${kindLabel}, ${here.length} voyageur${here.length > 1 ? 's' : ''} en attente sur ${cap}${st.over ? `, saturée depuis ${st.over} semaine${st.over > 1 ? 's' : ''}` : ''}${served ? '' : ', non desservie'}${st.id === endSt ? ', bout de ligne actif' : ''}`,
        load: lf >= 0.34 ? `${r2(Math.min(1, lf) * C)} ${r2(C)}` : null,
        loadColor: lf > 1 ? 'var(--bad)' : lf >= 0.75 ? '#e07b00' : '#e0b000',
        timer: st.over ? `${r2((st.over / sim.c.limit) * T)} ${r2(T)}` : null,
        hub: st.hub, pax, more: Math.max(0, here.length - shown.length),
        mx: left ? st.x - r - 11 : px0 + 9.2, my: py0 + 4.6,
        label: lbl ? st.name : '', lx: left ? st.x - r - 1.2 : st.x + r + 1.2, ly: st.y + r + 2.4, anchor: left ? 'end' : 'start',
        ring: st.id === endSt && (line?.stops.length ?? 0) >= 1 ? 1 : 0,
      };
    });
  });

  ngOnInit(): void {
    this.variant = variantOf(this.def().id);
    const seed = Math.floor(Math.random() * 1e9);
    this.sim = new ReseauSim(this.variant, this.diff(), seed);
    const c = this.sim.c;
    this.maxWeeks = c.weeks; this.mw = c.w; this.mh = c.h; this.wagonsPerTrain = c.wagonsPerTrain;
    this.brief = BRIEF[this.variant];
    this.mapTitle = TITLE[this.variant];
    this.tokenIcon = this.variant === 'tram' ? '🌉' : '🚇';
    this.tokenTitle = this.variant === 'tram' ? 'Ponts sur la Loire' : this.variant === 'metro' ? 'Tunnels sous la Seine' : 'Tunnels de montagne';
    if (this.variant !== 'tgv') {
      const r = RIVERS[this.variant];
      this.riverPts = r.pts.map(p => `${p.x},${p.y}`).join(' ');
      this.riverName = r.name;
      this.riverLabel = this.variant === 'metro' ? { x: 80, y: 70 } : { x: 6, y: 67 };
    }
    this.setupLegend();
    this.info.set(this.variant === 'tgv' ? 'Choisissez une ligne en bas, puis touchez deux villes pour tracer un premier tronçon.' : 'Choisissez une ligne en bas, puis touchez deux stations pour tracer un premier tronçon.');
    this.say(this.variant === 'metro' ? 'Le Grand Paris vous confie son métro : les premières stations attendent.' : this.variant === 'tram' ? 'La ville lance son tramway : à vous de tracer les lignes.' : 'Le schéma national des lignes à grande vitesse est entre vos mains.');
    this.selLine.set(0);
    this.emitProgress();
  }

  ngOnDestroy(): void {
    this.timers.forEach(t => clearTimeout(t));
    if (this.raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf);
  }

  private setupLegend(): void {
    const v = this.variant, c = this.sim.c;
    const kinds = v === 'tgv' ? [] : (['rond', 'tri', 'carre', 'croix', 'losange'] as Kind[]).map(k => ({ icon: KIND_GLYPH[k], label: KIND_LABEL[v][k] ?? '' }));
    this.legend = [
      ...kinds,
      ...(v === 'tgv' ? [{ icon: '●', label: 'Ville (taille selon la population)' }, { icon: '⛰️', label: 'Massif : tronçon 2,5 fois plus cher' }] : []),
      { icon: '◌', label: 'Anneau orange : quai qui se remplit' }, { icon: '⭕', label: 'Anneau rouge clignotant : saturation (semaines)' },
      { icon: '⋯', label: 'Pointillés : station de la semaine prochaine' }, { icon: '🚧', label: 'Tronçon fermé (travaux)' },
      { icon: '⭐', label: 'Pôle d’échanges : +' + c.hubCap + ' places, correspondance rapide' },
    ];
    const tok = v === 'metro' ? 'Franchir la Seine demande un tunnel (rendu si vous démolissez).' : v === 'tram' ? 'Franchir la Loire demande un pont. Un tronçon coûte 6 M€ plus 15 M€ par kilomètre ; démolir un tronçon d’une semaine passée ne rembourse que la moitié.' : 'Un tronçon coûte 1 Md€ pour 100 km, 2,5 fois plus en montagne ; un tunnel de montagne, s’il en reste, supprime ce surcoût. Démolir ne rembourse que la moitié.';
    this.rules = `Règles : touchez une ligne puis des stations pour la prolonger, par le bout signalé par l’anneau tournant (touchez l’autre bout pour l’en changer). Chaque semaine, les voyageurs prennent le plus court chemin, correspondances comprises ; chaque montée dans un train consomme une place de la ligne. Capacité d’une ligne : ${c.trainCap} places par rame et ${c.wagonCap} par wagon, plus si la ligne est courte (rames plus fréquentes), moins si elle est longue. Une station tolère ${c.cap} voyageurs en attente${v === 'tgv' ? ' (plus pour une grande ville)' : ''} ; saturée ${c.limit} semaines, elle fait fermer le réseau. ${tok} La satisfaction baisse à chaque semaine d’attente et à chaque correspondance. Note : voyageurs arrivés, satisfaction, et semaines tenues.`;
  }

  /* ── Interactions ── */

  protected lineColor(i: number): string { return LINE_COLORS[i]; }

  protected mapTap(e: MouseEvent): void {
    if (this.over() || this.busy()) return;
    const svg = this.mapEl()?.nativeElement;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    let best = -1, bd = 8;
    for (const st of this.sim.s.stations) { const d = dist(st, pt); if (d < bd) { bd = d; best = st.id; } }
    if (best >= 0) this.tap(best);
    else { this.selStation.set(null); }
  }

  protected tap(id: number): void {
    if (this.over() || this.busy()) return;
    const sim = this.sim, s = sim.s, li = this.selLine();
    const st = s.stations[id];
    if (li === null) { this.selStation.set(id); this.info.set(`${st.name} : touchez une ligne en bas pour la prolonger jusqu’ici.`); return; }
    const l = s.lines[li];
    if (!l.stops.length) {
      this.snap();
      sim.startLine(li, id);
      this.info.set(`${sim.lineName(li)} : départ de ${st.name}. Touchez la station suivante.`);
      return this.bump();
    }
    if (l.stops.length === 1 && l.stops[0] === id) { this.snap(); l.stops = []; this.info.set(`${sim.lineName(li)} : point de départ annulé.`); return this.bump(); }
    const ends = [l.stops[0], l.stops[l.stops.length - 1]];
    if (l.stops.length >= 2 && ends.includes(id)) {
      if (sim.lineEnd(l) !== id) { sim.setEnd(li, id); this.info.set(`${sim.lineName(li)} : prolongement depuis ${st.name}.`); return this.bump(); }
      this.info.set(`${st.name} est le bout actif de ${sim.lineRef(li)} : touchez une autre station pour prolonger.`);
      return this.bump();
    }
    if (l.stops.includes(id)) { this.info.set(`${st.name} est déjà sur ${sim.lineRef(li)}. Pour voir ses voyageurs, désélectionnez la ligne.`); return; }
    const why = sim.checkExtend(li, id);
    if (why) { this.info.set(`${st.name} : ${why}`); return; }
    this.snap();
    const msg = sim.extend(li, id);
    this.info.set(msg);
    this.bump();
  }

  protected pickLine(id: number): void {
    if (this.over() || this.busy()) return;
    const on = this.selLine() === id ? null : id;
    this.selLine.set(on);
    if (on !== null) this.selStation.set(null);
    const l = this.sim.s.lines[id];
    this.info.set(on === null ? 'Touchez une station pour voir ses voyageurs.' : l.stops.length === 0 ? `${this.sim.lineName(id)} : touchez une première station.` : `${this.sim.lineName(id)} : touchez une station pour la prolonger depuis l’anneau tournant.`);
  }

  protected choose(k: number): void {
    if (this.over() || this.busy()) return;
    this.snap();
    const msg = this.sim.choose(k);
    this.info.set(msg); this.say('🎁 ' + msg);
    this.bump();
  }

  protected train(d: 1 | -1): void { this.lineOp(l => this.sim.addTrain(l, d)); }
  protected wagon(d: 1 | -1): void { this.lineOp(l => this.sim.addWagon(l, d)); }
  protected flip(): void { this.lineOp(l => { this.sim.flipEnd(l); this.info.set(`Prolongement depuis ${this.sim.s.stations[this.sim.lineEnd(this.sim.s.lines[l])].name}.`); return null; }, false); }
  protected removeLast(): void { this.lineOp(l => { this.info.set(this.sim.removeLast(l)); return null; }); }
  protected deleteLine(): void { this.lineOp(l => { this.info.set(this.sim.deleteLine(l)); return null; }); }
  private lineOp(f: (l: number) => string | null, snap = true): void {
    const l = this.selLine();
    if (l === null || this.over() || this.busy()) return;
    const before = structuredClone(this.sim.s);
    const err = f(l);
    if (err) { this.info.set(err); return; }
    if (snap) this.undo.push(before);
    this.bump();
  }

  protected hub(id: number): void {
    if (this.over() || this.busy()) return;
    this.snap();
    const err = this.sim.makeHub(id);
    if (err) { this.undo.pop(); this.info.set(err); return; }
    this.info.set(`⭐ ${this.sim.s.stations[id].name} devient un pôle d’échanges : plus de place sur les quais, correspondances plus rapides.`);
    this.bump();
  }

  protected undoLast(): void {
    const prev = this.undo.pop();
    if (!prev || this.over() || this.busy()) return;
    this.sim.s = prev;
    this.info.set('Modification annulée.');
    this.bump();
  }

  private snap(): void { this.undo.push(structuredClone(this.sim.s)); }

  protected endWeek(): void {
    if (this.over() || this.busy() || this.sim.s.offers) return;
    this.busy.set(true);
    this.selStation.set(null);
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof requestAnimationFrame === 'undefined') return this.resolveWeek();
    const t0 = performance.now(), D = 1100;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / D);
      this.anim.set(t);
      if (t < 1) this.raf = requestAnimationFrame(step);
      else { this.raf = 0; this.anim.set(-1); this.resolveWeek(); }
    };
    this.raf = requestAnimationFrame(step);
  }

  private resolveWeek(): void {
    const r = this.sim.endWeek();
    this.undo = [];
    for (const e of r.events) this.say(e);
    this.info.set(r.events.slice(0, 2).join(' '));
    this.fresh.set(new Set(r.fresh));
    for (const id of r.warn) {
      const st = this.sim.s.stations[id];
      if (st.over >= this.sim.c.limit - 1 && !this.warned.has(id * 100 + this.sim.s.week)) { this.warned.add(id * 100 + this.sim.s.week); this.miss.emit(); }
    }
    this.bump();
    this.timers.push(setTimeout(() => this.fresh.set(new Set()), 1000));
    this.busy.set(false);
    if (this.sim.s.over) this.finish();
  }

  private finish(): void {
    if (this.over()) return;
    this.over.set(true);
    this.selLine.set(null);
    const o = this.sim.outcome();
    const { best, worst } = this.sim.review();
    const v = this.variant, s = this.sim.s;
    const title = s.lost
      ? (v === 'tgv' ? 'Le plan à grande vitesse est suspendu : trop de villes laissées à quai.' : v === 'tram' ? 'Le tramway est à l’arrêt : un quartier excédé a eu raison du projet.' : 'Le métro est fermé : une station débordait depuis trop longtemps.')
      : o.score >= 0.85 ? (v === 'tgv' ? 'Un réseau à grande vitesse exemplaire : la France entière à portée de train.' : v === 'tram' ? 'Le tramway est plébiscité : la ville entière l’adopte.' : 'Un métro modèle : le Grand Paris roule comme une horloge.')
      : o.score >= 0.65 ? 'Un réseau solide : les usagers suivent, malgré quelques quais bondés.'
      : o.score >= 0.45 ? 'Un réseau inégal : la presse parle de « lignes fantômes » et de quais bondés.'
      : 'Un réseau à la peine : les usagers reprennent la voiture.';
    this.summary.set({ title, o, best, worst });
    if (o.score < 0.45) this.miss.emit();
    this.progress.emit({ live: o.score, time: 0 });
    this.timers.push(setTimeout(() => this.done.emit(Math.max(0.05, o.score)), 2200));
  }

  private bump(): void { this.ver.update(v => v + 1); this.emitProgress(); }
  private emitProgress(): void {
    const s = this.sim.s;
    this.progress.emit({ live: this.sim.outcome().score, time: s.over ? 0 : Math.max(0, 1 - (s.week - 1) / s.maxWeeks) });
  }
  private say(t: string): void { this.log.update(l => [t, ...l].slice(0, 10)); }

  private cityR(pop: number): number { return Math.round((1.4 + 0.55 * Math.log(1 + pop * 3)) * 10) / 10; }
  protected pct(f: number): string { return `${Math.round(f * 100)} %`; }

  private offerName(id: OfferId, n: number): string {
    if (id === 'tunnel') return this.variant === 'tram' ? (n > 1 ? `${n} ponts` : 'Un pont') : n > 1 ? `${n} tunnels` : 'Un tunnel';
    if (id === 'budget') return `+${this.sim.money(n)}`;
    if (id === 'ligne') return `Ligne ${this.variant === 'tram' ? 'T' : ''}${this.sim.s.unlocked + 1}`;
    return OFFER_INFO[id].name;
  }
  private offerDesc(id: OfferId, n: number): string {
    const c = this.sim.c;
    switch (id) {
      case 'ligne': return 'Une couleur de plus pour tracer une nouvelle ligne.';
      case 'rame': return `+${c.trainCap} places par semaine sur la ligne choisie.`;
      case 'wagon': return `+${c.wagonCap} places chacun, ${c.wagonsPerTrain} par rame au plus.`;
      case 'tunnel': return this.variant === 'metro' ? 'Pour passer sous la Seine.' : this.variant === 'tram' ? 'Pour franchir la Loire.' : 'Supprime le surcoût d’un tronçon de montagne.';
      case 'pole': return `Une station gagne ${c.hubCap} places et des correspondances rapides.`;
      case 'budget': return this.variant === 'metro' ? 'Des tronçons de plus à poser.' : 'De quoi poser plus de voies.';
    }
  }
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

import { Component, ElementRef, OnDestroy, OnInit, computed, input, output, signal, viewChild } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/* ============================================================
 *  La ligne : un jeu de métro en temps réel, dans le style de
 *  Mini Metro. Des stations de formes diverses surgissent sur le
 *  plan ; des voyageurs (petites formes) s’y entassent, chacun
 *  voulant rejoindre une station de sa forme. Le joueur trace ses
 *  lignes en glissant d’une station à l’autre, les rames roulent
 *  en continu, et chaque semaine apporte une locomotive et un
 *  renfort au choix. Une station saturée trop longtemps ferme le
 *  réseau.
 *  Trois villes : Paris (la Seine), Lyon (le Rhône et la Saône),
 *  Marseille (la mer et le Vieux-Port).
 *  Toute la simulation est dans la classe LigneSim (pure, à pas
 *  fixe, testable hors d’Angular).
 * ============================================================ */

export type Shape = 'cercle' | 'triangle' | 'carre' | 'etoile' | 'losange' | 'croix';
export type City = 'paris' | 'lyon' | 'marseille';
export type RewardId = 'ligne' | 'loco' | 'wagon' | 'tunnel' | 'hub';
export type End = 'head' | 'tail';
export type ErrCode = 'slot' | 'token' | 'dup' | 'loop' | 'mid' | 'same' | 'none' | 'loco' | 'wagon' | 'hub';
export interface Pt { x: number; y: number }

export interface Water { kind: 'river' | 'sea'; pts: Pt[]; width: number }
export interface Station { id: number; x: number; y: number; shape: Shape; name: string; wait: Shape[]; hub: boolean; over: number; born: number }
export interface Line { id: number; slot: number; stops: number[]; loop: boolean }
export interface Train {
  id: number; line: number; slot: number; from: number; to: number; t: number; moving: boolean; timer: number; act: number;
  pax: Shape[]; wagons: number; retire: boolean; ghost: Pt[] | null; last: Pt[] | null;
  x: number; y: number; a: number; px: number; py: number; pa: number;
}
export interface Offer { id: RewardId; name: string; desc: string; icon: string }
export type SimEvent = { type: 'station'; id: number } | { type: 'alarm'; id: number } | { type: 'week'; week: number } | { type: 'over' };

interface CityConf {
  name: string; focus: Pt; tokens0: number;
  token: { one: string; many: string; icon: string; bridge: boolean };
  cross: string;
  waters: Water[];
  islands: { x: number; y: number; rx: number; ry: number; rot: number }[];
  /** Noms des eaux : le long d’une rivière (w, at) ou à un point fixe */
  labels: { text: string; w?: number; at?: number; x?: number; y?: number }[];
  specials: [number, Shape, string][];
  names: string[];
}

/* ── Réglages ── */

export const W = 100, H = 110;
export const WEEK = 60, WEEKS = 6, STEP = 0.05;
export const ST_R = 2.5, LINE_W = 1.5;
const SPACING = 1.65;
export const CAP = 6, HUB_CAP = 12, CAR_CAP = 6, MAX_WAGONS = 3;
const SPEED = 8.5, ACC = 2.6, MIN_DWELL = 0.4, PAX_T = 0.16;
const STOP_COST = 2.5, TRANSFER = 12, SLACK = 14;
const MAX_ST = 24, MIN_D = 12.5;
const OVER_T = 24;
/** Voyageurs livrés par un bon réseau en six semaines (à diff 1) */
export const TARGET = 400;

export const COLORS = ['#e2372e', '#2b6fd0', '#f0a500', '#1f9e57', '#8f4fc6', '#e46aa2', '#18aebf'];
export const COLOR_NAMES = ['rouge', 'bleue', 'jaune', 'verte', 'violette', 'rose', 'turquoise'];
export const SHAPE_LABEL: Record<Shape, string> = { cercle: 'cercle', triangle: 'triangle', carre: 'carré', etoile: 'étoile', losange: 'losange', croix: 'croix' };
const DAYS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];

/* ── Géométrie ── */

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const f2 = (n: number) => Math.round(n * 100) / 100;
const pk = (a: number, b: number) => (a < b ? a + '-' + b : b + '-' + a);

/** Catmull-Rom échantillonné : rivières et côtes souples */
function smooth(ctrl: Pt[], seg = 6): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[i - 1] ?? ctrl[i], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[i + 2] ?? p2;
    for (let k = 0; k < seg; k++) {
      const t = k / seg, t2 = t * t, t3 = t2 * t;
      const c = (a: number, b: number, c2: number, d: number) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
      out.push({ x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}

/** Tracé à 45° façon plan de métro : un tronçon droit puis une diagonale (ou l’inverse) */
export function octi(p: Pt, q: Pt, flip = false): Pt[] {
  const dx = q.x - p.x, dy = q.y - p.y, ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < 0.05 || ay < 0.05 || Math.abs(ax - ay) < 0.05) return [p, q];
  const m = Math.min(ax, ay);
  const dg = { x: Math.sign(dx) * m, y: Math.sign(dy) * m };
  const c = flip ? { x: p.x + dg.x, y: p.y + dg.y } : { x: q.x - dg.x, y: q.y - dg.y };
  return [p, c, q];
}

export function plen(pts: Pt[]): number { let l = 0; for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]); return l; }
export function pat(pts: Pt[], s: number): Pt {
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (s <= d || i === pts.length - 1) { const k = d > 0 ? clamp(s / d, 0, 1) : 0; return { x: lerp(pts[i - 1].x, pts[i].x, k), y: lerp(pts[i - 1].y, pts[i].y, k) }; }
    s -= d;
  }
  return pts[0];
}
function dSeg(p: Pt, a: Pt, b: Pt): number {
  const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy;
  const k = l2 ? clamp(((p.x - a.x) * vx + (p.y - a.y) * vy) / l2, 0, 1) : 0;
  return Math.hypot(p.x - a.x - vx * k, p.y - a.y - vy * k);
}
export function dPath(p: Pt, pts: Pt[]): number { let m = Infinity; for (let i = 1; i < pts.length; i++) m = Math.min(m, dSeg(p, pts[i - 1], pts[i])); return m; }
/** Paramètre t sur [a,b] du croisement avec [c,d] (u semi-ouvert pour ne pas compter deux fois un sommet) */
function segX(a: Pt, b: Pt, c: Pt, d: Pt): number | null {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den, u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u < 1 ? t : null;
}
function inPoly(p: Pt, poly: Pt[]): boolean {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) ins = !ins;
  }
  return ins;
}
/** Passages d’eau d’un tracé : intervalles [début, fin] en distance le long du tracé */
export function waterSpans(path: Pt[], waters: Water[]): [number, number][] {
  const out: [number, number][] = [];
  for (const w of waters) {
    const hits: number[] = [];
    const ring = w.kind === 'sea' ? [...w.pts, w.pts[0]] : w.pts;
    let s0 = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], L = dist(a, b);
      for (let j = 1; j < ring.length; j++) { const t = segX(a, b, ring[j - 1], ring[j]); if (t !== null) hits.push(s0 + t * L); }
      s0 += L;
    }
    hits.sort((x, y) => x - y);
    if (w.kind === 'river') for (const h of hits) out.push([h - w.width / 2 - 0.7, h + w.width / 2 + 0.7]);
    else for (let i = 0; i + 1 < hits.length; i += 2) out.push([hits[i], hits[i + 1]]);
  }
  return out;
}

/* ── Les villes ── */

const P = (a: number[][]): Pt[] => a.map(([x, y]) => ({ x, y }));
const MARSEILLE_COAST = smooth(P([[20, -8], [23, 8], [19, 20], [24, 32], [27, 41], [31, 44.5], [44, 46.2], [47.5, 49], [44, 51.8], [31, 53], [26, 56.5],
  [21, 66], [24, 78], [33, 87], [46, 92], [60, 95], [76, 98.5], [92, 101], [110, 104]]), 5);

export const CITIES: Record<City, CityConf> = {
  paris: {
    name: 'Paris', focus: { x: 52, y: 50 }, tokens0: 3, token: { one: 'pont', many: 'ponts', icon: '🌉', bridge: true }, cross: 'franchir la Seine',
    waters: [{ kind: 'river', width: 4.6, pts: smooth(P([[110, 87], [90, 77], [75, 66], [62, 57], [50, 52.5], [38, 51.5], [27, 55], [18, 63], [12, 74], [6, 86], [-10, 96]])) }],
    islands: [{ x: 54.5, y: 54.2, rx: 2.6, ry: 0.85, rot: 22 }, { x: 59.2, y: 56.3, rx: 1.5, ry: 0.7, rot: 32 }],
    labels: [{ text: 'Seine', w: 0, at: 0.6 }],
    specials: [[95, 'etoile', 'Étoile'], [215, 'croix', 'Hôtel-Dieu']],
    names: ['Belleville', 'Ménilmontant', 'Batignolles', 'Montmartre', 'Bercy', 'Javel', 'Grenelle', 'Charonne', 'Picpus', 'Plaisance', 'La Villette', 'Auteuil',
      'Passy', 'Ternes', 'Clignancourt', 'La Chapelle', 'Glacière', 'Alésia', 'Nation', 'Bastille', 'Odéon', 'Opéra', 'Pigalle', 'Jaurès', 'Vaugirard', 'Gobelins',
      'Monceau', 'Wagram', 'Duroc', 'Daumesnil', 'Oberkampf', 'Sentier'],
  },
  lyon: {
    name: 'Lyon', focus: { x: 50, y: 48 }, tokens0: 4, token: { one: 'pont', many: 'ponts', icon: '🌉', bridge: true }, cross: 'franchir le Rhône ou la Saône',
    waters: [
      { kind: 'river', width: 3.8, pts: smooth(P([[36, -10], [40, 10], [35, 24], [41, 38], [38, 52], [43, 66], [50.5, 79.5]])) },
      { kind: 'river', width: 5.2, pts: smooth(P([[110, 13], [88, 22], [74, 32], [64, 44], [58, 58], [54, 70], [50.5, 79.5], [51, 92], [54, 106], [55, 120]])) },
    ],
    islands: [],
    labels: [{ text: 'Saône', w: 0, at: 0.3 }, { text: 'Rhône', w: 1, at: 0.3 }],
    specials: [[100, 'losange', 'Part-Dieu'], [220, 'etoile', 'Fourvière']],
    names: ['Croix-Rousse', 'Bellecour', 'Perrache', 'Vaise', 'Gerland', 'Monplaisir', 'Villeurbanne', 'Brotteaux', 'Guillotière', 'Saint-Jean', 'Terreaux',
      'Confluence', 'Jean-Macé', 'Grange-Blanche', 'Charpennes', 'Cusset', 'Vénissieux', 'Oullins', 'Saint-Just', 'Gorge-de-Loup', 'Valmy', 'Debourg', 'Laënnec',
      'Mermoz', 'Bron', 'Caluire', 'Écully', 'Masséna', 'Cordeliers', 'Hôtel de Ville', 'Ampère', 'Garibaldi'],
  },
  marseille: {
    name: 'Marseille', focus: { x: 62, y: 48 }, tokens0: 2, token: { one: 'tunnel', many: 'tunnels', icon: '🚇', bridge: false }, cross: 'passer sous la mer',
    waters: [{ kind: 'sea', width: 0, pts: [...MARSEILLE_COAST, { x: 110, y: 125 }, { x: -10, y: 125 }, { x: -10, y: -8 }] }],
    islands: [{ x: 7, y: 47, rx: 3.6, ry: 1.3, rot: -20 }, { x: 9.5, y: 54, rx: 3.2, ry: 1.1, rot: 15 }, { x: 16.5, y: 50.5, rx: 0.9, ry: 0.7, rot: 0 }],
    labels: [{ text: 'Vieux-Port', x: 38.5, y: 49.6 }, { text: 'Méditerranée', x: 30, y: 101 }],
    specials: [[90, 'croix', 'La Timone'], [210, 'losange', 'Saint-Charles']],
    names: ['Joliette', 'Castellane', 'Noailles', 'La Plaine', 'Le Panier', 'Endoume', 'Le Prado', 'Vélodrome', 'Sainte-Marguerite', 'Saint-Barnabé',
      'Les Chartreux', 'Belle de Mai', 'Arenc', 'L’Estaque', 'Saint-Just', 'Bougainville', 'Baille', 'Périer', 'Mazargues', 'Bonneveine', 'Pointe-Rouge',
      'Saint-Loup', 'La Rose', 'Malpassé', 'Château-Gombert', 'Les Réformés', 'Notre-Dame-du-Mont', 'Cinq-Avenues', 'La Blancarde', 'Vieux-Port'],
  },
};

const REWARDS: Record<RewardId, Omit<Offer, 'id'>> = {
  ligne: { icon: '➕', name: 'Nouvelle ligne', desc: 'Une couleur de plus à tracer.' },
  loco: { icon: '🚆', name: 'Locomotive', desc: 'Une rame de plus à poser sur une ligne.' },
  wagon: { icon: '🚃', name: 'Wagon', desc: '+6 places sur une rame.' },
  tunnel: { icon: '', name: '', desc: '' },
  hub: { icon: '⭐', name: 'Correspondance', desc: 'Une station agrandie : 12 places, échanges deux fois plus rapides.' },
};

/* ============================================================
 *  La simulation
 * ============================================================ */

export class LigneSim {
  readonly c: CityConf;
  stations: Station[] = [];
  lines: Line[] = [];
  trains: Train[] = [];
  time = 0; week = 1; delivered = 0; spawned = 0;
  unlocked = 3; locos = 3; wagons = 0; tokens = 0; hubs = 0;
  offers: Offer[] | null = null;
  over: { reason: 'overflow' | 'win' | 'close'; station: number } | null = null;
  /** Compteurs de changement (tout / réseau) pour l’affichage */
  version = 0; net = 0;
  events: SimEvent[] = [];
  private uid = 0;
  private nextSpawn = 12;
  private special = 0;
  private names: string[];
  private pairs = new Map<string, number[]>();
  private base = new Map<string, { pts: Pt[]; len: number; cross: number }>();
  private nbr = new Map<number, Map<number, number[]>>();
  private D = new Map<Shape, Float64Array>();
  private lineIdx = new Map<number, number>();
  private linesAt: number[][] = [];
  private routesDirty = true;

  constructor(readonly city: City, readonly diff = 1, readonly rnd: () => number = Math.random) {
    this.c = CITIES[city];
    this.tokens = this.c.tokens0;
    const specialNames = new Set(this.c.specials.map(s => s[2]));
    this.names = this.c.names.filter(n => !specialNames.has(n));
    for (let i = this.names.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [this.names[i], this.names[j]] = [this.names[j], this.names[i]]; }
    for (const k of ['cercle', 'triangle', 'carre'] as Shape[]) this.addStation(k, 9, 18);
    this.rebuild();
  }

  /* ── Lecture ── */

  line(id: number): Line | undefined { return this.lines.find(l => l.id === id); }
  freeSlot(): number { for (let s = 0; s < this.unlocked; s++) if (!this.lines.some(l => l.slot === s)) return s; return -1; }
  availLocos(): number { return this.locos - this.trains.length; }
  availWagons(): number { return this.wagons - this.trains.reduce((a, t) => a + t.wagons, 0); }
  availTokens(): number { return this.tokens - this.usedTokens(this.lines); }
  capOf(t: Train): number { return CAR_CAP * (1 + t.wagons); }
  stCap(s: Station): number { return s.hub ? HUB_CAP : CAP; }
  edges(l: { stops: number[]; loop: boolean }): [number, number][] {
    const e: [number, number][] = [];
    for (let i = 1; i < l.stops.length; i++) e.push([l.stops[i - 1], l.stops[i]]);
    if (l.loop && l.stops.length > 2) e.push([l.stops[l.stops.length - 1], l.stops[0]]);
    return e;
  }
  endAt(lineId: number, s: number): End | null {
    const l = this.line(lineId);
    if (!l || l.loop || l.stops.length < 2) return null;
    return l.stops[0] === s ? 'head' : l.stops[l.stops.length - 1] === s ? 'tail' : null;
  }
  hasEdge(lineId: number, a: number, b: number): boolean { return !!this.nbr.get(lineId)?.get(a)?.includes(b); }
  served(s: number): boolean { return this.lines.some(l => l.stops.includes(s)); }

  /** Cadre visible : le plan se dézoome au fil des semaines */
  viewAt(t = this.time): { x: number; y: number; w: number; h: number } {
    const k0 = clamp(t / (3.4 * WEEK), 0, 1), k = k0 * k0 * (3 - 2 * k0);
    const s = 0.66 + 0.34 * k, w = W * s, h = H * s;
    const cx = lerp(this.c.focus.x, W / 2, k), cy = lerp(this.c.focus.y, H / 2, k);
    return { x: clamp(cx - w / 2, 0, W - w), y: clamp(cy - h / 2, 0, H - h), w, h };
  }

  /** Tracé de base d’un tronçon (orienté de la plus petite vers la plus grande station) */
  baseOf(a: number, b: number): { pts: Pt[]; len: number; cross: number } {
    const key = pk(a, b);
    let e = this.base.get(key);
    if (!e) {
      const P0 = this.stations[Math.min(a, b)], P1 = this.stations[Math.max(a, b)];
      const o1 = octi(P0, P1, false), o2 = octi(P0, P1, true);
      const c1 = waterSpans(o1, this.c.waters).length, c2 = waterSpans(o2, this.c.waters).length;
      const pts = c2 < c1 ? o2 : o1;
      e = { pts, len: plen(pts), cross: Math.min(c1, c2) };
      this.base.set(key, e);
    }
    return e;
  }
  crossings(a: number, b: number): number { return this.baseOf(a, b).cross; }
  usedTokens(lines: { stops: number[]; loop: boolean }[]): number {
    let n = 0;
    for (const l of lines) for (const [a, b] of this.edges(l)) n += this.baseOf(a, b).cross;
    return n;
  }

  /** Tracé réel d’une ligne entre deux stations voisines, décalé quand plusieurs lignes partagent le tronçon */
  edgePath(lineId: number, a: number, b: number): Pt[] | null {
    if (!this.hasEdge(lineId, a, b)) return null;
    const base = this.baseOf(a, b).pts;
    const ids = this.pairs.get(pk(a, b)) ?? [lineId];
    const o = (ids.indexOf(lineId) - (ids.length - 1) / 2) * SPACING;
    const p0 = base[0], p1 = base[base.length - 1], L = dist(p0, p1) || 1;
    const nx = -(p1.y - p0.y) / L, ny = (p1.x - p0.x) / L;
    const pts = base.map(p => ({ x: p.x + nx * o, y: p.y + ny * o }));
    return a < b ? pts : pts.reverse();
  }

  /** Les « T » au bout des lignes, pour les prolonger */
  handles(): { line: number; slot: number; end: End; s: number; tip: Pt; d: string }[] {
    const out: { line: number; slot: number; end: End; s: number; tip: Pt; d: string }[] = [];
    for (const l of this.lines) {
      if (l.loop || l.stops.length < 2) continue;
      for (const end of ['head', 'tail'] as End[]) {
        const s = end === 'head' ? l.stops[0] : l.stops[l.stops.length - 1];
        const n = end === 'head' ? l.stops[1] : l.stops[l.stops.length - 2];
        const path = this.edgePath(l.id, n, s);
        if (!path) continue;
        const e = path[path.length - 1], q = path[path.length - 2];
        const L = dist(q, e) || 1, ux = (e.x - q.x) / L, uy = (e.y - q.y) / L;
        const tip = { x: e.x + ux * 3.6, y: e.y + uy * 3.6 };
        const d = `M${f2(e.x)} ${f2(e.y)}L${f2(tip.x)} ${f2(tip.y)}M${f2(tip.x - uy * 1.5)} ${f2(tip.y + ux * 1.5)}L${f2(tip.x + uy * 1.5)} ${f2(tip.y - ux * 1.5)}`;
        out.push({ line: l.id, slot: l.slot, end, s, tip, d });
      }
    }
    return out;
  }

  /* ── Modifications du réseau ── */

  /** Toute modification passe par ici : les rames dont le tronçon disparaît finissent leur trajet sur l’ancien tracé */
  private mutate(fn: () => void): void {
    const snaps = this.trains.map(t => (t.moving && !t.ghost ? this.trainPath(t) : null));
    fn();
    this.rebuild();
    this.trains.forEach((t, i) => { if (t.moving && !t.ghost && !this.hasEdge(t.line, t.from, t.to)) t.ghost = snaps[i]; });
    for (const t of this.trains) { this.place(t); t.px = t.x; t.py = t.y; t.pa = t.a; }
  }
  private rebuild(): void {
    this.pairs.clear(); this.nbr.clear();
    for (const l of [...this.lines].sort((a, b) => a.slot - b.slot)) {
      const m = new Map<number, number[]>();
      for (const [a, b] of this.edges(l)) {
        const k = pk(a, b);
        this.pairs.set(k, [...(this.pairs.get(k) ?? []), l.id]);
        m.set(a, [...(m.get(a) ?? []), b]);
        m.set(b, [...(m.get(b) ?? []), a]);
      }
      this.nbr.set(l.id, m);
    }
    this.routesDirty = true;
    this.version++; this.net++;
  }
  private check(lineId: number, stops: number[], loop: boolean): ErrCode | null {
    if (new Set(stops).size !== stops.length) return 'dup';
    const others = this.lines.filter(l => l.id !== lineId);
    if (this.usedTokens([...others, { stops, loop }]) > this.tokens) return 'token';
    return null;
  }

  startLine(a: number, b: number): number | ErrCode {
    if (a === b) return 'same';
    const slot = this.freeSlot();
    if (slot < 0) return 'slot';
    const err = this.check(-1, [a, b], false);
    if (err) return err;
    const l: Line = { id: ++this.uid, slot, stops: [a, b], loop: false };
    this.mutate(() => { this.lines.push(l); });
    if (this.availLocos() > 0) this.mutate(() => this.spawnTrain(l));
    return l.id;
  }
  extend(lineId: number, end: End, s: number): ErrCode | null {
    const l = this.line(lineId);
    if (!l) return 'none';
    if (l.loop) return 'loop';
    const other = end === 'head' ? l.stops[l.stops.length - 1] : l.stops[0];
    if (s === other && l.stops.length >= 3) {
      const err = this.check(l.id, l.stops, true);
      if (err) return err;
      this.mutate(() => { l.loop = true; });
      return null;
    }
    if (l.stops.includes(s)) return 'dup';
    const stops = end === 'head' ? [s, ...l.stops] : [...l.stops, s];
    const err = this.check(l.id, stops, false);
    if (err) return err;
    this.mutate(() => { l.stops = stops; });
    return null;
  }
  retract(lineId: number, end: End): ErrCode | null {
    const l = this.line(lineId);
    if (!l) return 'none';
    if (l.loop) return 'loop';
    if (l.stops.length <= 2) { this.deleteLine(lineId); return null; }
    this.mutate(() => { l.stops = end === 'head' ? l.stops.slice(1) : l.stops.slice(0, -1); });
    return null;
  }
  /** Fait passer un tronçon a–b par la station s */
  insert(lineId: number, a: number, b: number, s: number): ErrCode | null {
    const l = this.line(lineId);
    if (!l || !this.hasEdge(lineId, a, b)) return 'none';
    if (l.stops.includes(s)) return 'dup';
    const ia = l.stops.indexOf(a), ib = l.stops.indexOf(b);
    let stops: number[];
    if (Math.abs(ia - ib) === 1) { const i = Math.max(ia, ib); stops = [...l.stops.slice(0, i), s, ...l.stops.slice(i)]; }
    else stops = [...l.stops, s]; // le tronçon de fermeture d’une boucle
    const err = this.check(l.id, stops, l.loop);
    if (err) return err;
    this.mutate(() => { l.stops = stops; });
    return null;
  }
  /** Retire une station d’une ligne en reliant ses voisines */
  removeStop(lineId: number, s: number): ErrCode | null {
    const l = this.line(lineId);
    if (!l || !l.stops.includes(s)) return 'none';
    const end = this.endAt(lineId, s);
    if (end) return this.retract(lineId, end);
    const stops = l.stops.filter(x => x !== s);
    const loop = l.loop && stops.length >= 3;
    if (stops.length < 2) { this.deleteLine(lineId); return null; }
    const err = this.check(l.id, stops, loop);
    if (err) return err;
    this.mutate(() => { l.stops = stops; l.loop = loop; });
    return null;
  }
  /** Coupe un tronçon : bout de ligne, ou ouverture d’une boucle */
  cutEdge(lineId: number, a: number, b: number): ErrCode | null {
    const l = this.line(lineId);
    if (!l || !this.hasEdge(lineId, a, b)) return 'none';
    if (l.loop) {
      const n = l.stops.length, ia = l.stops.indexOf(a), ib = l.stops.indexOf(b);
      const [x, y] = (ia + 1) % n === ib ? [ia, ib] : [ib, ia];
      const stops = [...l.stops.slice(y), ...l.stops.slice(0, x + 1)];
      this.mutate(() => { l.stops = stops; l.loop = false; });
      return null;
    }
    if (l.stops.length === 2) { this.deleteLine(lineId); return null; }
    const h = l.stops[0], t = l.stops[l.stops.length - 1];
    if (a === h || b === h) return this.retract(lineId, 'head');
    if (a === t || b === t) return this.retract(lineId, 'tail');
    return 'mid';
  }
  deleteLine(lineId: number): void {
    if (!this.line(lineId)) return;
    this.mutate(() => { this.lines = this.lines.filter(l => l.id !== lineId); });
  }

  private spawnTrain(l: Line): void {
    // Là où la ligne est la moins desservie
    let best = 0, bd = -1;
    const at = this.trains.filter(t => t.line === l.id).map(t => l.stops.indexOf(t.to));
    l.stops.forEach((_, i) => { const d = at.length ? Math.min(...at.map(j => Math.abs(j - i))) : 0; if (d > bd) { bd = d; best = i; } });
    const s = this.stations[l.stops[best]];
    this.trains.push({ id: ++this.uid, line: l.id, slot: l.slot, from: -1, to: s.id, t: 1, moving: false, timer: 0, act: 0, pax: [], wagons: 0, retire: false,
      ghost: null, last: null, x: s.x, y: s.y, a: 0, px: s.x, py: s.y, pa: 0 });
  }
  addTrain(lineId: number): ErrCode | null {
    const l = this.line(lineId);
    if (!l || l.stops.length < 2) return 'none';
    if (this.availLocos() <= 0) return 'loco';
    this.mutate(() => this.spawnTrain(l));
    return null;
  }
  removeTrain(lineId: number): ErrCode | null {
    const tr = this.trains.filter(t => t.line === lineId && !t.retire).sort((a, b) => a.pax.length - b.pax.length)[0];
    if (!tr) return 'none';
    tr.retire = true;
    this.routesDirty = true; this.version++;
    return null;
  }
  addWagon(lineId: number): ErrCode | null {
    if (this.availWagons() <= 0) return 'wagon';
    const tr = this.trains.filter(t => t.line === lineId && !t.retire && t.wagons < MAX_WAGONS).sort((a, b) => a.wagons - b.wagons)[0];
    if (!tr) return 'none';
    tr.wagons++; this.version++;
    return null;
  }
  removeWagon(lineId: number): ErrCode | null {
    const tr = this.trains.filter(t => t.line === lineId && t.wagons > 0).sort((a, b) => b.wagons - a.wagons)[0];
    if (!tr) return 'none';
    tr.wagons--; this.version++;
    return null;
  }
  makeHub(s: number): ErrCode | null {
    const st = this.stations[s];
    if (!st || st.hub) return 'none';
    if (this.hubs <= 0) return 'hub';
    st.hub = true; this.hubs--; this.version++;
    return null;
  }
  choose(i: number): void {
    const o = this.offers?.[i];
    if (!o) return;
    if (o.id === 'ligne') this.unlocked = Math.min(COLORS.length, this.unlocked + 1);
    else if (o.id === 'loco') this.locos++;
    else if (o.id === 'wagon') this.wagons++;
    else if (o.id === 'tunnel') this.tokens += 2;
    else this.hubs++;
    this.offers = null; this.version++;
  }
  close(): void { if (!this.over) this.finish('close', -1); }

  /* ── Stations et voyageurs ── */

  private landOk(p: Pt, margin: number): boolean {
    for (const w of this.c.waters) {
      if (w.kind === 'river' && dPath(p, w.pts) < w.width / 2 + margin) return false;
      if (w.kind === 'sea' && (inPoly(p, w.pts) || dPath(p, w.pts) < margin)) return false;
    }
    return true;
  }
  private addStation(shape: Shape, rMin?: number, rMax?: number, name?: string): void {
    if (this.stations.length >= MAX_ST) return;
    const v = this.viewAt();
    const mx = 5, my = 5;
    let spot: Pt | null = null;
    for (let pass = 0; pass < 3 && !spot; pass++) {
      const minD = MIN_D - pass * 1.5;
      for (let k = 0; k < 250; k++) {
        let p: Pt;
        if (rMax !== undefined) {
          const a = this.rnd() * Math.PI * 2, r = lerp(rMin ?? 0, rMax, this.rnd());
          p = { x: this.c.focus.x + Math.cos(a) * r, y: this.c.focus.y + Math.sin(a) * r };
        } else p = { x: v.x + mx + this.rnd() * (v.w - 2 * mx), y: v.y + my + this.rnd() * (v.h - 2 * my) };
        if (p.x < 4 || p.y < 4 || p.x > W - 4 || p.y > H - 4) continue;
        if (!this.landOk(p, ST_R + 2.5)) continue;
        if (this.stations.some(s => dist(s, p) < minD)) continue;
        // pas sous une ligne existante
        if (this.lines.some(l => this.edges(l).some(([a, b]) => dPath(p, this.baseOf(a, b).pts) < ST_R + 1.2))) continue;
        spot = p; break;
      }
    }
    if (!spot) return;
    const id = this.stations.length;
    this.stations.push({ id, x: f2(spot.x), y: f2(spot.y), shape, name: name ?? this.names.pop() ?? `Station ${id + 1}`, wait: [], hub: false, over: 0, born: this.time });
    this.routesDirty = true; this.version++;
    this.events.push({ type: 'station', id });
  }
  private pickShape(): Shape {
    const r = this.rnd();
    return r < 0.5 ? 'cercle' : r < 0.8 ? 'triangle' : 'carre';
  }
  private destShape(s: Station): Shape | null {
    const kinds = [...new Set(this.stations.map(x => x.shape))].filter(k => k !== s.shape);
    if (!kinds.length) return null;
    const w = kinds.map(k => (k === 'cercle' || k === 'triangle' || k === 'carre' ? 1 : 0.8));
    let r = this.rnd() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < kinds.length; i++) { r -= w[i]; if (r <= 0) return kinds[i]; }
    return kinds[kinds.length - 1];
  }
  rate(): number { return this.diff * (0.052 + 0.011 * this.time / WEEK); }
  private interval(): number { return Math.max(8, 19 - 2 * (this.week - 1)) / Math.pow(this.diff, 0.7) * (0.8 + 0.4 * this.rnd()); }

  /* ── Itinéraires : plus court chemin (station, ligne) avec pénalité de correspondance ── */

  private routes(): void {
    if (!this.routesDirty) return;
    this.routesDirty = false;
    const NS = this.stations.length, NL = this.lines.length;
    this.lineIdx = new Map(this.lines.map((l, i) => [l.id, i]));
    const active = this.lines.map(l => l.stops.length >= 2 && this.trains.some(t => t.line === l.id && !t.retire));
    this.linesAt = Array.from({ length: NS }, () => [] as number[]);
    this.lines.forEach((l, li) => { if (active[li]) for (const s of l.stops) this.linesAt[s].push(li); });
    this.D.clear();
    const shapes = new Set(this.stations.map(s => s.shape));
    for (const k of shapes) {
      const d = new Float64Array(NS * NL).fill(Infinity), done = new Uint8Array(NS * NL);
      this.lines.forEach((l, li) => { if (active[li]) for (const s of l.stops) if (this.stations[s].shape === k) d[li * NS + s] = 0; });
      for (;;) {
        let u = -1, du = Infinity;
        for (let i = 0; i < d.length; i++) if (!done[i] && d[i] < du) { du = d[i]; u = i; }
        if (u < 0) break;
        done[u] = 1;
        const li = Math.floor(u / NS), s = u % NS, l = this.lines[li];
        for (const n of this.nbr.get(l.id)?.get(s) ?? []) {
          const v = li * NS + n, c = du + this.baseOf(s, n).len + STOP_COST;
          if (c < d[v]) d[v] = c;
        }
        for (const lj of this.linesAt[s]) { const v = lj * NS + s; if (lj !== li && du + TRANSFER < d[v]) d[v] = du + TRANSFER; }
      }
      this.D.set(k, d);
    }
  }
  private dl(k: Shape, li: number, s: number): number { return this.D.get(k)?.[li * this.stations.length + s] ?? Infinity; }
  /** Le voyageur reste-t-il à bord (ligne li, en route de X vers N) ? Il doit se rapprocher, sans trop s’écarter du meilleur trajet */
  private stays(k: Shape, li: number, X: number, N: number): boolean {
    const dX = this.dl(k, li, X), dN = this.dl(k, li, N);
    return isFinite(dN) && dN < dX && this.baseOf(X, N).len + STOP_COST + dN <= dX + SLACK;
  }
  private boards(k: Shape, li: number, X: number, N: number): boolean {
    const dN = this.dl(k, li, N);
    if (!isFinite(dN)) return false;
    let best = Infinity;
    for (const lj of this.linesAt[X] ?? []) best = Math.min(best, this.dl(k, lj, X));
    return dN < best && this.baseOf(X, N).len + STOP_COST + dN <= best + SLACK;
  }
  /** Le voyageur peut-il atteindre sa forme depuis la station ? */
  reachable(k: Shape, s: number): boolean {
    this.routes();
    for (const lj of this.linesAt[s] ?? []) if (isFinite(this.dl(k, lj, s))) return true;
    return false;
  }

  /* ── Les rames ── */

  trainPath(t: Train): Pt[] {
    if (t.ghost) return t.ghost;
    if (t.from >= 0) { const p = this.edgePath(t.line, t.from, t.to); if (p) return p; }
    if (t.last) return t.last;
    const s = this.stations[t.to];
    return [{ x: s.x, y: s.y }, { x: s.x, y: s.y }];
  }
  private place(t: Train): void {
    const path = this.trainPath(t), L = plen(path), s = t.t * L;
    const p = pat(path, s);
    t.x = p.x; t.y = p.y;
    if (L > 0.01) {
      const a = pat(path, Math.max(0, s - 1.2)), b = pat(path, Math.min(L, s + 1.2));
      if (dist(a, b) > 0.01) t.a = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    }
  }
  /** Station suivante : null si la ligne a disparu, -1 si la station n’est plus sur la ligne */
  planNext(t: Train): number | null {
    const l = this.line(t.line);
    if (!l || l.stops.length < 2) return null;
    const nb = this.nbr.get(l.id)?.get(t.to);
    if (!nb) return -1;
    const c = nb.filter(n => n !== t.from);
    return c.length ? c[0] : nb[0];
  }
  private decide(t: Train, doIt: boolean): boolean {
    this.routes();
    const X = this.stations[t.to], N = this.planNext(t);
    const li = this.lineIdx.get(t.line) ?? -1;
    const nx = N ?? -1;
    const leaving = nx < 0 || t.retire || li < 0;
    for (let i = 0; i < t.pax.length; i++) {
      const k = t.pax[i];
      if (k === X.shape || leaving || !this.stays(k, li, X.id, nx)) {
        if (doIt) {
          t.pax.splice(i, 1);
          if (k === X.shape) this.delivered++; else X.wait.push(k);
          this.version++;
        }
        return true;
      }
    }
    if (leaving || t.pax.length >= this.capOf(t)) return false;
    for (let i = 0; i < X.wait.length; i++) {
      if (this.boards(X.wait[i], li, X.id, nx)) {
        if (doIt) { t.pax.push(X.wait[i]); X.wait.splice(i, 1); this.version++; }
        return true;
      }
    }
    return false;
  }
  private arrive(t: Train, path: Pt[]): void {
    t.last = path; t.ghost = null; t.t = 1; t.moving = false; t.timer = 0; t.act = 0;
  }
  private depart(t: Train): void {
    const N = this.planNext(t);
    if (N === null || t.retire) {
      this.trains = this.trains.filter(x => x !== t);
      this.routesDirty = true; this.version++;
      return;
    }
    if (N < 0) {
      const l = this.line(t.line)!;
      if (t.last && t.from >= 0 && l.stops.includes(t.from)) {
        t.ghost = [...t.last].reverse();
        [t.from, t.to] = [t.to, t.from];
        t.t = 0; t.moving = true;
      } else { t.from = -1; t.to = l.stops[0]; t.t = 1; t.last = null; t.timer = 0; }
      return;
    }
    t.from = t.to; t.to = N; t.t = 0; t.ghost = null; t.moving = true;
  }
  private moveTrain(t: Train, dt: number): void {
    if (t.moving) {
      const path = this.trainPath(t), L = plen(path);
      if (L < 0.01) { this.arrive(t, path); return; }
      const s = t.t * L;
      const v = SPEED * clamp(0.22 + Math.min(s, L - s) / ACC, 0.22, 1);
      if (s + v * dt >= L) this.arrive(t, path); else t.t = (s + v * dt) / L;
      return;
    }
    t.timer += dt; t.act += dt;
    const per = this.stations[t.to].hub ? PAX_T / 2 : PAX_T;
    while (t.act >= per) { if (!this.decide(t, true)) { t.act = per; break; } t.act -= per; }
    if (t.timer >= MIN_DWELL && !this.decide(t, false)) this.depart(t);
  }

  /* ── Le temps ── */

  step(dt = STEP): void {
    if (this.over || this.offers) return;
    for (const t of this.trains) { t.px = t.x; t.py = t.y; t.pa = t.a; }
    this.time += dt;
    if (this.time >= this.week * WEEK) {
      this.endWeek();
      if (this.over || this.offers) return;
    }
    // Nouvelles stations
    const sp = this.c.specials[this.special];
    if (sp && this.time >= sp[0]) { this.special++; this.addStation(sp[1], undefined, undefined, sp[2]); }
    this.nextSpawn -= dt;
    if (this.nextSpawn <= 0) { this.addStation(this.pickShape()); this.nextSpawn = this.interval(); }
    // Voyageurs
    const rate = this.rate();
    for (const s of this.stations) {
      if (this.time - s.born > 2.5 && this.rnd() < rate * dt) {
        const k = this.destShape(s);
        if (k) { s.wait.push(k); this.spawned++; this.version++; }
      }
    }
    for (const t of [...this.trains]) this.moveTrain(t, dt);
    // Saturation
    for (const s of this.stations) {
      if (s.wait.length > this.stCap(s)) {
        if (s.over === 0) this.events.push({ type: 'alarm', id: s.id });
        s.over += dt / OVER_T;
        if (s.over >= 1) { s.over = 1; this.finish('overflow', s.id); break; }
      } else if (s.over > 0) s.over = Math.max(0, s.over - dt / (OVER_T * 0.8));
    }
    for (const t of this.trains) this.place(t);
  }
  private endWeek(): void {
    if (this.week >= WEEKS) { this.finish('win', -1); return; }
    this.week++; this.locos++;
    const pool: RewardId[] = ['wagon', 'tunnel', 'hub', 'loco'];
    if (this.unlocked < COLORS.length) pool.push('ligne', 'ligne');
    const a = pool[Math.floor(this.rnd() * pool.length)];
    const rest = pool.filter(x => x !== a);
    const b = rest[Math.floor(this.rnd() * rest.length)];
    this.offers = [a, b].map(id => ({ id, ...this.reward(id) }));
    this.events.push({ type: 'week', week: this.week });
    this.version++;
  }
  reward(id: RewardId): Omit<Offer, 'id'> {
    if (id !== 'tunnel') return REWARDS[id];
    const t = this.c.token;
    return { icon: t.icon, name: `Deux ${t.many}`, desc: `Pour ${this.c.cross}.` };
  }
  private finish(reason: 'overflow' | 'win' | 'close', station: number): void {
    this.over = { reason, station };
    this.offers = null;
    this.events.push({ type: 'over' });
    this.version++;
  }

  /** Note 0..1 : semaines tenues et voyageurs transportés */
  score(): number {
    const T = clamp(this.time / (WEEKS * WEEK), 0, 1);
    const d = clamp(this.delivered / (TARGET * Math.pow(this.diff, 0.5)), 0, 1);
    return clamp(0.4 * T + 0.6 * d, 0, 1);
  }
}

/* ============================================================
 *  Dessin
 * ============================================================ */

export function shapePath(k: Shape, x: number, y: number, r: number): string {
  const poly = (pts: [number, number][]) => 'M' + pts.map(([a, b]) => `${f2(x + a)} ${f2(y + b)}`).join('L') + 'Z';
  switch (k) {
    case 'cercle': return `M${f2(x - r)} ${f2(y)}a${f2(r)} ${f2(r)} 0 1 0 ${f2(2 * r)} 0a${f2(r)} ${f2(r)} 0 1 0 ${f2(-2 * r)} 0Z`;
    case 'carre': { const h = r * 0.88; return poly([[-h, -h], [h, -h], [h, h], [-h, h]]); }
    case 'triangle': { const R = r * 1.28, o = R * 0.14; return poly([[0, -R + o], [R * 0.866, R * 0.5 + o], [-R * 0.866, R * 0.5 + o]]); }
    case 'losange': { const R = r * 1.22; return poly([[0, -R], [R, 0], [0, R], [-R, 0]]); }
    case 'etoile': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, R = i % 2 ? r * 0.58 : r * 1.32; pts.push([Math.cos(a) * R, Math.sin(a) * R]); }
      return poly(pts);
    }
    case 'croix': { const a = r * 0.4, b = r * 1.08; return poly([[-a, -b], [a, -b], [a, -a], [b, -a], [b, a], [a, a], [a, b], [-a, b], [-a, a], [-b, a], [-b, -a], [-a, -a]]); }
  }
}
function wedge(x: number, y: number, R: number, k: number): string {
  if (k >= 0.999) return `M${f2(x - R)} ${f2(y)}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z`;
  const a = -Math.PI / 2 + k * Math.PI * 2;
  return `M${f2(x)} ${f2(y)}L${f2(x)} ${f2(y - R)}A${R} ${R} 0 ${k > 0.5 ? 1 : 0} 1 ${f2(x + R * Math.cos(a))} ${f2(y + R * Math.sin(a))}Z`;
}
/** Ligne brisée avec coudes arrondis */
function roundPath(pts: Pt[], move: boolean): string {
  let d = (move ? 'M' : 'L') + f2(pts[0].x) + ' ' + f2(pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (i < pts.length - 1) {
      const a = pts[i - 1], b = pts[i + 1];
      const l1 = dist(a, p), l2 = dist(p, b), rc = Math.min(2.4, l1 / 2, l2 / 2);
      if (rc > 0.2) {
        const p1 = { x: p.x + ((a.x - p.x) / l1) * rc, y: p.y + ((a.y - p.y) / l1) * rc }, p2 = { x: p.x + ((b.x - p.x) / l2) * rc, y: p.y + ((b.y - p.y) / l2) * rc };
        d += `L${f2(p1.x)} ${f2(p1.y)}Q${f2(p.x)} ${f2(p.y)} ${f2(p2.x)} ${f2(p2.y)}`;
        continue;
      }
    }
    d += `L${f2(p.x)} ${f2(p.y)}`;
  }
  return d;
}
const CL = 3.9, CW = 2.5, GAP = 0.45;
const carsCache = new Map<number, string>();
function carsPath(n: number): string {
  let d = carsCache.get(n);
  if (!d) {
    const total = n * CL + (n - 1) * GAP;
    d = '';
    for (let i = 0; i < n; i++) { const x0 = -total / 2 + i * (CL + GAP); d += `M${f2(x0)} ${-CW / 2}h${CL}v${CW}h${-CL}Z`; }
    carsCache.set(n, d);
  }
  return d;
}
function trainPax(pax: Shape[], n: number): string {
  const total = n * CL + (n - 1) * GAP;
  let d = '';
  pax.forEach((k, i) => {
    const car = Math.min(n - 1, Math.floor(i / CAR_CAP)), j = i % CAR_CAP;
    const x = -total / 2 + car * (CL + GAP) + CL * (0.2 + 0.3 * (j % 3)), y = j < 3 ? -0.6 : 0.6;
    d += shapePath(k, x, y, 0.44);
  });
  return d;
}

interface TrainV { id: number; tf: string; color: string; cars: string; pax: string; ghost: boolean }
interface Frame { vb: string; trains: TrainV[]; timers: { id: number; d: string; hot: boolean }[]; clock: string; day: string }
interface Ptr {
  id: number; sx: number; sy: number; moved: boolean; target: Target; mode: 'new' | 'extend' | 'insert' | 'none';
  line: number; end: End; anchor: number; from: number; a: number; b: number; fail: number;
}
type Target = { kind: 'station'; s: number } | { kind: 'handle'; line: number; end: End; s: number } | { kind: 'edge'; line: number; a: number; b: number } | { kind: 'none' };
interface Verdict { title: string; good: boolean; bad: boolean; delivered: number; weeks: number; score: number }

@Component({
  selector: 'app-ligne-game',
  template: `
    @let h = hud();
    @let f = frame();
    <div class="lg" [class.rm]="reduced">
      <div class="hud">
        <span class="wk" [attr.aria-label]="'Semaine ' + h.week + ' sur ' + weeks">
          <svg class="clock" viewBox="-10 -10 20 20" aria-hidden="true"><circle r="8.6" class="cl-bg" /><path class="cl-arc" [attr.d]="f.clock" /></svg>
          <b>Semaine {{ h.week }}</b><small>{{ f.day }}</small>
        </span>
        <span class="pax">Passagers : <b class="mono">{{ h.delivered }}</b></span>
        <span class="ctl">
          <button type="button" class="btn small pz" [disabled]="!started() || !!h.over" (click)="togglePause()" [attr.aria-pressed]="paused()">
            <svg viewBox="0 0 10 10" aria-hidden="true">@if (paused()) { <path d="M2.5 1.5L8.5 5L2.5 8.5Z" /> } @else { <rect x="2" y="1.5" width="2.2" height="7" rx=".5" /><rect x="5.8" y="1.5" width="2.2" height="7" rx=".5" /> }</svg>
            {{ paused() ? 'Reprendre' : 'Pause' }}</button>
          <button type="button" class="btn small spd" [class.on]="speed() === 2" [disabled]="!!h.over" (click)="toggleSpeed()" [attr.aria-label]="'Vitesse ×' + speed() + ', changer'">×{{ speed() }}</button>
        </span>
      </div>

      <div class="map-wrap">
        <svg #map class="map" [attr.viewBox]="f.vb" role="application" [attr.aria-label]="'Plan du réseau de ' + conf.name"
             (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="cancel()" (lostpointercapture)="cancel()">
          <rect class="paper" x="-20" y="-20" width="140" height="150" />
          @for (w of waters; track $index) {
            @if (w.river) { <path class="river" [attr.d]="w.d" [attr.stroke-width]="w.width" /> } @else { <path class="sea" [attr.d]="w.d" /> }
          }
          @for (i of conf.islands; track $index) {
            <ellipse class="isle" [attr.cx]="i.x" [attr.cy]="i.y" [attr.rx]="i.rx" [attr.ry]="i.ry" [attr.transform]="'rotate(' + i.rot + ' ' + i.x + ' ' + i.y + ')'" />
          }
          @for (l of labels; track $index) {
            <text class="wl" [attr.x]="l.x" [attr.y]="l.y" [attr.transform]="'rotate(' + l.rot + ' ' + l.x + ' ' + l.y + ')'">{{ l.text }}</text>
          }
          @let n = netView();
          @for (c of n.cross; track $index) {
            @if (c.bridge) { <path class="deck" [attr.d]="c.d" /><path class="deck2" [attr.d]="c.d" /> }
          }
          @for (l of n.lines; track l.id) {
            <path class="ln" [class.sel]="l.sel" [class.dim]="l.dim" [attr.d]="l.d" [attr.stroke]="l.color" />
          }
          @for (c of n.cross; track $index) {
            @if (!c.bridge) { <path class="tunnel" [attr.d]="c.d" /> }
          }
          @for (hd of n.handles; track hd.key) { <path class="hd" [class.dim]="hd.dim" [attr.d]="hd.d" [attr.stroke]="hd.color" /> }
          @for (r of rubber(); track $index) { <path class="rub" [class.bad]="r.bad" [attr.d]="r.d" [attr.stroke]="r.color" /> }
          @for (t of f.timers; track t.id) { <path class="wedge" [class.hot]="t.hot" [attr.d]="t.d" /> }
          @for (s of stView(); track s.id) {
            <g class="st" [class.arm]="s.armed" role="button" tabindex="0" [attr.aria-label]="s.aria" (keydown.enter)="key(s.id)" (keydown.space)="$event.preventDefault(); key(s.id)">
              @if (s.armed) { <circle class="ring" [attr.cx]="s.x" [attr.cy]="s.y" [attr.r]="R + 2.6" [attr.stroke]="s.ringColor" /> }
              @if (s.doom) { <circle class="doom" [attr.cx]="s.x" [attr.cy]="s.y" [attr.r]="R + 4.6" /> }
              @if (s.hub) { <circle class="hub" [attr.cx]="s.x" [attr.cy]="s.y" [attr.r]="R + 1.45" /> }
              <path class="shape" [attr.d]="s.d" />
              @if (s.pax) { <path class="wp" [attr.d]="s.pax" /> }
              @if (s.more) { <text class="more" [attr.x]="s.mx" [attr.y]="s.my" [attr.text-anchor]="s.anchor">+{{ s.more }}</text> }
            </g>
          }
          @for (t of f.trains; track t.id) {
            <g class="train" [class.ghost]="t.ghost" [attr.transform]="t.tf">
              <path class="car" [attr.d]="t.cars" [attr.fill]="t.color" [attr.stroke]="t.color" />
              @if (t.pax) { <path class="tp" [attr.d]="t.pax" /> }
            </g>
          }
        </svg>

        @if (!started()) {
          <div class="ov">
            <div class="card intro">
              <b class="ttl">{{ def().title }}</b>
              <ul>
                <li>Glissez d’une station à l’autre pour tracer une ligne (ou touchez deux stations à la suite).</li>
                <li>Chaque voyageur veut rejoindre une station de <b>sa forme</b>.</li>
                <li>Une station qui déborde trop longtemps ferme le réseau. Tenez {{ weeks }} semaines.</li>
                <li>Pour {{ conf.cross }}, il faut un {{ conf.token.one }} {{ conf.token.icon }}.</li>
              </ul>
              <button type="button" class="btn primary" (click)="start()">Ouvrir le réseau ▶</button>
            </div>
          </div>
        } @else if (offersV(); as of) {
          <div class="ov">
            <div class="card">
              <b class="ttl">Semaine {{ h.week }}</b>
              <p class="sub">🚆 Une locomotive est livrée. Choisissez un renfort :</p>
              <div class="offers">
                @for (o of of; track $index) {
                  <button type="button" class="offer" (click)="choose($index)"><span class="oi">{{ o.icon }}</span><b>{{ o.name }}</b><small>{{ o.desc }}</small></button>
                }
              </div>
            </div>
          </div>
        } @else if (verdict(); as v) {
          <div class="ov end">
            <div class="card" [class.good]="v.good" [class.bad]="v.bad" role="status">
              <b class="ttl">{{ v.title }}</b>
              <p class="sub">Passagers transportés : <b class="mono">{{ v.delivered }}</b> · Semaines tenues : <b class="mono">{{ v.weeks }}/{{ weeks }}</b></p>
              <p class="sub">Note du réseau : <b class="mono">{{ v.score }}/100</b></p>
            </div>
          </div>
        } @else if (paused()) {
          <span class="pill">En pause : vous pouvez remanier vos lignes.</span>
        }
      </div>

      <div class="bar">
        <div class="slots" role="toolbar" aria-label="Lignes">
          @for (s of slots(); track s.slot) {
            <button type="button" class="slot" [class.used]="s.line !== null" [class.sel]="s.sel" [style.--c]="s.color" [attr.aria-label]="s.aria" [attr.aria-pressed]="s.sel" (click)="pickSlot(s.slot)"></button>
          }
          @if (h.locked) { <span class="locked" [attr.aria-label]="h.locked + ' lignes encore fermées'">+{{ h.locked }} 🔒</span> }
        </div>
        <div class="inv">
          <span title="Locomotives en réserve" [attr.aria-label]="h.locos + ' locomotives en réserve'">🚆 <b class="mono">{{ h.locos }}</b></span>
          <span title="Wagons en réserve" [attr.aria-label]="h.wagons + ' wagons en réserve'">🚃 <b class="mono">{{ h.wagons }}</b></span>
          <span [title]="conf.token.many + ' en réserve'" [attr.aria-label]="h.tokens + ' ' + conf.token.many + ' en réserve'">{{ conf.token.icon }} <b class="mono">{{ h.tokens }}</b></span>
          <button type="button" class="btn small hubb" [class.on]="hubMode()" [disabled]="!h.hubs || !!h.over" (click)="toggleHub()" [attr.aria-label]="h.hubs + ' correspondances à placer'">⭐ <b class="mono">{{ h.hubs }}</b></button>
        </div>
      </div>

      @if (panel(); as p) {
        <div class="panel" [style.--c]="p.color">
          <div class="pt"><b>Ligne {{ p.name }}</b><span>{{ p.stops }} stations{{ p.loop ? ' · boucle' : '' }} · {{ p.pax }} à bord</span>
            <button type="button" class="x" (click)="deselect()" aria-label="Fermer">✕</button></div>
          <div class="pbtns">
            <span class="grp"><button type="button" class="btn small" [disabled]="!p.trains" (click)="trainAct(-1)" aria-label="Retirer une locomotive">−</button>
              <span class="mono">🚆 {{ p.trains }}</span>
              <button type="button" class="btn small" [disabled]="!h.locos" (click)="trainAct(1)" aria-label="Ajouter une locomotive">+</button></span>
            <span class="grp"><button type="button" class="btn small" [disabled]="!p.wagons" (click)="wagonAct(-1)" aria-label="Retirer un wagon">−</button>
              <span class="mono">🚃 {{ p.wagons }}</span>
              <button type="button" class="btn small" [disabled]="!h.wagons || !p.canWagon" (click)="wagonAct(1)" aria-label="Ajouter un wagon">+</button></span>
          </div>
          <div class="pbtns">
            @if (p.edge) { <button type="button" class="btn small" (click)="cut()">✂ Couper ce tronçon</button> }
            @if (p.st) { <button type="button" class="btn small" (click)="dropStop()">✂ Retirer {{ p.st }}</button> }
            <button type="button" class="btn small danger" (click)="deleteSel()">🗑 Supprimer la ligne</button>
          </div>
        </div>
      }
      <p class="info" aria-live="polite">{{ info() }}</p>
      <div class="foot">
        <details class="legend">
          <summary>Commandes</summary>
          <ul>
            <li><b>Tracer</b> : glissez d’une station à une autre ; continuez sur d’autres stations pour prolonger.</li>
            <li><b>Prolonger</b> : attrapez le petit T au bout d’une ligne. Revenez en arrière pour raccourcir.</li>
            <li><b>Dévier</b> : glissez le milieu d’un tronçon sur une station pour l’y faire passer.</li>
            <li><b>Au toucher</b> : touchez une station puis une autre pour les relier.</li>
            <li><b>Modifier</b> : touchez une ligne (ou sa pastille) pour gérer rames, wagons et tronçons.</li>
            <li>Le jeu peut être mis en pause à tout moment : on peut encore tracer.</li>
          </ul>
        </details>
        @if (!h.over && started()) {
          <button type="button" class="btn small" [class.danger]="confirmClose()" (click)="closeNet()">{{ confirmClose() ? 'Confirmer la fermeture ?' : 'Fermer le réseau' }}</button>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; --paper: var(--surface-2); --water: color-mix(in srgb, #5b9fd6 36%, var(--surface-2)); }
    .lg { display: grid; gap: 6px; }
    .hud { display: flex; flex-wrap: wrap; gap: 4px 10px; justify-content: space-between; align-items: center; font-size: 13px; }
    .wk { display: inline-flex; align-items: center; gap: 6px; small { color: var(--ink-3); } }
    .clock { width: 22px; height: 22px; flex: none; }
    .cl-bg { fill: none; stroke: var(--line); stroke-width: 2.4; }
    .cl-arc { fill: var(--ink); }
    .ctl { display: inline-flex; gap: 5px; }
    .pz { display: inline-flex; align-items: center; gap: 5px; svg { width: 11px; height: 11px; fill: currentColor; } }
    .spd { min-width: 44px; font-weight: 700; &.on { background: var(--ink); color: var(--surface); border-color: var(--ink); } }
    .map-wrap { position: relative; justify-self: center; width: 100%; max-width: clamp(300px, calc((100dvh - 230px) / 1.1), 520px); }
    .map { display: block; width: 100%; height: auto; aspect-ratio: 100 / 110; border-radius: 14px; border: 1px solid var(--line); background: var(--paper);
      touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; cursor: crosshair; }
    .paper { fill: var(--paper); }
    .river { fill: none; stroke: var(--water); stroke-linecap: round; stroke-linejoin: round; }
    .sea { fill: var(--water); }
    .isle { fill: var(--paper); }
    .wl { font: italic 600 2.3px var(--font-body); fill: color-mix(in srgb, #3f7fbf 70%, var(--ink)); text-anchor: middle; dominant-baseline: central; pointer-events: none; letter-spacing: .25px; opacity: .75; }
    .ln { fill: none; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; transition: opacity .2s; }
    .ln.sel { stroke-width: 1.9; }
    .ln.dim, .hd.dim { opacity: .35; }
    .hd { fill: none; stroke-width: 1.5; stroke-linecap: round; }
    .tunnel { fill: none; stroke: var(--paper); stroke-width: .62; stroke-linecap: butt; pointer-events: none; }
    .deck { fill: none; stroke: var(--ink); stroke-width: 2.9; stroke-linecap: butt; pointer-events: none; opacity: .8; }
    .deck2 { fill: none; stroke: var(--paper); stroke-width: 2.3; stroke-linecap: butt; pointer-events: none; }
    .rub { fill: none; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; opacity: .7; pointer-events: none; }
    .rub.bad { stroke: var(--bad); stroke-dasharray: 1.2 1.1; opacity: .9; }
    .wedge { fill: color-mix(in srgb, var(--ink) 30%, transparent); pointer-events: none; }
    .wedge.hot { fill: color-mix(in srgb, var(--bad) 42%, transparent); }
    .st { cursor: pointer; outline: none; }
    .st:focus-visible .shape { stroke: var(--accent); stroke-width: 1; }
    .shape { fill: var(--surface); stroke: var(--ink); stroke-width: .62; stroke-linejoin: round; transform-box: fill-box; transform-origin: center; animation: pop .5s ease-out both; }
    .hub { fill: var(--surface); stroke: var(--ink); stroke-width: .62; }
    .ring { fill: none; stroke-width: .55; stroke-dasharray: 1.1 .8; }
    .doom { fill: none; stroke: var(--bad); stroke-width: .8; transform-box: fill-box; transform-origin: center; animation: doom 1s ease-in-out infinite; }
    .wp { fill: var(--ink); pointer-events: none; }
    .more { font: 700 2.1px var(--font-body); fill: var(--ink); dominant-baseline: middle; pointer-events: none; }
    .train { pointer-events: none; }
    .train.ghost { opacity: .55; }
    .car { stroke-width: .55; stroke-linejoin: round; }
    .tp { fill: #fff; }
    @keyframes pop { 0% { transform: scale(0); } 70% { transform: scale(1.25); } 100% { transform: none; } }
    @keyframes doom { 50% { transform: scale(1.18); opacity: .4; } }
    .ov { position: absolute; inset: 0; display: grid; place-items: center; padding: 10px; border-radius: 14px;
      background: color-mix(in srgb, var(--paper) 60%, transparent); backdrop-filter: blur(1.5px); }
    .ov.end { background: color-mix(in srgb, var(--paper) 30%, transparent); backdrop-filter: none; align-items: end; }
    .card { display: grid; gap: 8px; max-width: 360px; width: 100%; padding: 14px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow);
      font-size: 13px; color: var(--ink);
      .ttl { font-size: 15px; } .sub { margin: 0; color: var(--ink-2); font-size: 12.5px; }
      ul { margin: 0; padding-left: 18px; display: grid; gap: 4px; color: var(--ink-2); font-size: 12.5px; }
      &.good { border-color: var(--good); } &.bad { border-color: var(--bad); } }
    .offers { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .offer { display: grid; justify-items: center; align-content: start; gap: 2px; min-height: 92px; padding: 8px 6px; border-radius: 10px; border: 1.5px solid var(--line);
      background: var(--surface-2); color: var(--ink); cursor: pointer; font: 12px var(--font-body); text-align: center;
      .oi { font-size: 22px; line-height: 1.2; } b { font-size: 13px; } small { font-size: 11.5px; color: var(--ink-2); line-height: 1.25; }
      &:hover, &:focus-visible { border-color: var(--accent); } }
    .pill { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); padding: 4px 10px; border-radius: 999px; background: var(--ink); color: var(--surface);
      font-size: 11.5px; white-space: nowrap; pointer-events: none; opacity: .85; }
    .bar { display: flex; flex-wrap: wrap; gap: 6px 12px; justify-content: space-between; align-items: center; }
    .slots { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .slot { width: 34px; height: 34px; border-radius: 50%; border: 3px solid var(--c); background: var(--surface); cursor: pointer; padding: 0;
      &.used { background: var(--c); } &.sel { box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--c); } }
    .locked { font-size: 12px; color: var(--ink-3); }
    .inv { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; font-size: 13px; color: var(--ink-2); }
    .hubb { min-width: 52px; &.on { background: #f4d35e; color: #1b2130; border-color: #c9a227; } }
    .panel { display: grid; gap: 6px; padding: 8px 10px; border-radius: 10px; border-left: 5px solid var(--c); background: var(--surface-2); font-size: 12.5px;
      .pt { display: flex; flex-wrap: wrap; gap: 2px 8px; align-items: center; span { color: var(--ink-2); } b { color: var(--ink); } }
      .x { margin-left: auto; border: 0; background: none; color: var(--ink-2); font-size: 15px; min-width: 34px; min-height: 34px; cursor: pointer; } }
    .pbtns { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; .grp { display: inline-flex; gap: 5px; align-items: center; .btn { min-width: 36px; } } }
    .danger { border-color: var(--bad); color: var(--bad); }
    .info { margin: 0; min-height: 2.6em; font-size: 12.5px; color: var(--ink); }
    .foot { display: flex; flex-wrap: wrap; gap: 6px 10px; justify-content: space-between; align-items: start; }
    .legend { font-size: 12px; color: var(--ink-2); flex: 1 1 200px;
      summary { cursor: pointer; min-height: 32px; display: flex; align-items: center; color: var(--ink); }
      ul { margin: 2px 0 0; padding-left: 18px; display: grid; gap: 3px; } }
    .rm .shape, .rm .doom { animation: none; }
    @media (prefers-reduced-motion: reduce) { .shape, .doom { animation: none; } .ln { transition: none; } }
  `,
})
export class LigneGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  private readonly mapEl = viewChild<ElementRef<SVGSVGElement>>('map');

  protected readonly R = ST_R;
  protected readonly weeks = WEEKS;
  protected sim!: LigneSim;
  protected conf = CITIES.paris;
  protected waters: { river: boolean; d: string; width: number }[] = [];
  protected labels: { text: string; x: number; y: number; rot: number }[] = [];
  protected reduced = false;

  protected readonly started = signal(false);
  protected readonly paused = signal(false);
  protected readonly speed = signal<1 | 2>(1);
  protected readonly ver = signal(0);
  protected readonly netVer = signal(0);
  protected readonly frame = signal<Frame>({ vb: `0 0 ${W} ${H}`, trains: [], timers: [], clock: '', day: DAYS[0] });
  protected readonly rubber = signal<{ d: string; color: string; bad: boolean }[]>([]);
  protected readonly selLine = signal<number | null>(null);
  protected readonly armed = signal<{ s: number; line: number | null } | null>(null);
  protected readonly focusEdge = signal<[number, number] | null>(null);
  protected readonly focusSt = signal<number | null>(null);
  protected readonly hubMode = signal(false);
  protected readonly info = signal('');
  protected readonly verdict = signal<Verdict | null>(null);
  protected readonly confirmClose = signal(false);

  private raf = 0;
  private last = 0;
  private acc = 0;
  private lastProg = -1;
  private lastMiss = -99;
  private ptr: Ptr | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private confirmTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onVis = () => { if (document.hidden && this.started() && !this.sim.over) this.paused.set(true); };

  /* ── Vues ── */

  protected readonly hud = computed(() => {
    this.ver();
    const s = this.sim;
    return { week: s.week, delivered: s.delivered, locos: s.availLocos(), wagons: s.availWagons(), tokens: s.availTokens(), hubs: s.hubs,
      locked: COLORS.length - s.unlocked, over: s.over };
  });
  protected readonly offersV = computed(() => { this.ver(); return this.sim.offers; });

  protected readonly netView = computed(() => {
    this.netVer();
    const s = this.sim, sel = this.selLine();
    const lines = s.lines.map(l => {
      let d = '';
      s.edges(l).forEach(([a, b], i) => { const p = s.edgePath(l.id, a, b); if (p) d += roundPath(p, i === 0); });
      return { id: l.id, d, color: COLORS[l.slot], sel: sel === l.id, dim: sel !== null && sel !== l.id };
    });
    const cross: { d: string; bridge: boolean }[] = [];
    const bridge = s.c.token.bridge;
    for (const l of s.lines) for (const [a, b] of s.edges(l)) {
      if (!s.crossings(a, b)) continue;
      const p = s.edgePath(l.id, a, b);
      if (!p) continue;
      const L = plen(p);
      for (const [u, v] of waterSpans(p, s.c.waters)) {
        const p1 = pat(p, clamp(u, 0, L)), p2 = pat(p, clamp(v, 0, L));
        cross.push({ bridge, d: `M${f2(p1.x)} ${f2(p1.y)}L${f2(p2.x)} ${f2(p2.y)}` });
      }
    }
    const handles = s.handles().map(hd => ({ key: hd.line + hd.end, d: hd.d, color: COLORS[hd.slot], dim: sel !== null && sel !== hd.line }));
    return { lines, cross, handles };
  });

  protected readonly stView = computed(() => {
    this.ver();
    const s = this.sim, arm = this.armed(), over = s.over;
    return s.stations.map(st => {
      const n = st.wait.length, shown = Math.min(n, 18), rows = Math.max(1, Math.ceil(shown / 6));
      const left = st.x > W - 16;
      let pax = '';
      for (let i = 0; i < shown; i++) {
        const col = i % 6, row = Math.floor(i / 6);
        const x = left ? st.x - ST_R - 1.7 - col * 1.95 : st.x + ST_R + 1.7 + col * 1.95;
        const y = st.y + (row - (rows - 1) / 2) * 2;
        pax += shapePath(st.wait[i], x, y, 0.78);
      }
      const armLine = arm && arm.s === st.id && arm.line !== null ? s.line(arm.line) : undefined;
      return {
        id: st.id, x: st.x, y: st.y, d: shapePath(st.shape, st.x, st.y, ST_R), hub: st.hub, pax,
        more: n > shown ? n - shown : 0, mx: left ? st.x - ST_R - 1.2 - 6 * 1.95 : st.x + ST_R + 1.2 + 6 * 1.95, my: st.y, anchor: left ? 'end' : 'start',
        armed: arm?.s === st.id, ringColor: armLine ? COLORS[armLine.slot] : 'var(--ink-2)',
        doom: !!over && over.reason === 'overflow' && over.station === st.id,
        aria: `${st.name}, station ${SHAPE_LABEL[st.shape]}${st.hub ? ' (correspondance)' : ''}, ${n} voyageur${n > 1 ? 's' : ''} en attente${s.served(st.id) ? '' : ', non desservie'}`,
      };
    });
  });

  protected readonly slots = computed(() => {
    this.ver();
    const s = this.sim, sel = this.selLine();
    return Array.from({ length: s.unlocked }, (_, i) => {
      const l = s.lines.find(x => x.slot === i);
      const tr = l ? s.trains.filter(t => t.line === l.id && !t.retire).length : 0;
      return { slot: i, color: COLORS[i], line: l?.id ?? null, sel: !!l && sel === l.id,
        aria: l ? `Ligne ${COLOR_NAMES[i]} : ${l.stops.length} stations, ${tr} locomotive${tr > 1 ? 's' : ''}` : `Ligne ${COLOR_NAMES[i]} libre` };
    });
  });

  protected readonly panel = computed(() => {
    this.ver();
    const id = this.selLine();
    if (id === null) return null;
    const s = this.sim, l = s.line(id);
    if (!l) return null;
    const tr = s.trains.filter(t => t.line === id && !t.retire);
    const fe = this.focusEdge(), fs = this.focusSt();
    return {
      color: COLORS[l.slot], name: COLOR_NAMES[l.slot], stops: l.stops.length, loop: l.loop, trains: tr.length,
      wagons: tr.reduce((a, t) => a + t.wagons, 0), canWagon: tr.some(t => t.wagons < MAX_WAGONS), pax: tr.reduce((a, t) => a + t.pax.length, 0),
      edge: !!fe && s.hasEdge(id, fe[0], fe[1]), st: fs !== null && l.stops.includes(fs) ? s.stations[fs].name : null,
    };
  });

  /* ── Cycle de vie ── */

  ngOnInit(): void {
    const id = this.def().id;
    const city: City = id.includes('lyon') ? 'lyon' : id.includes('marseille') ? 'marseille' : 'paris';
    this.sim = new LigneSim(city, this.diff());
    this.conf = this.sim.c;
    this.waters = this.conf.waters.map(w => ({ river: w.kind === 'river', width: w.width, d: roundPath(w.pts, true) + (w.kind === 'sea' ? 'Z' : '') }));
    this.labels = this.conf.labels.map(l => {
      const w = l.w !== undefined ? this.conf.waters[l.w] : undefined;
      if (!w) return { text: l.text, x: l.x ?? 0, y: l.y ?? 0, rot: 0 };
      const L = plen(w.pts), p = pat(w.pts, L * (l.at ?? 0.5)), a = pat(w.pts, L * (l.at ?? 0.5) - 2), b = pat(w.pts, L * (l.at ?? 0.5) + 2);
      let rot = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      if (rot > 90) rot -= 180; else if (rot < -90) rot += 180;
      return { text: l.text, x: f2(p.x), y: f2(p.y), rot: f2(rot) };
    });
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.info.set(`${this.conf.name} : trois stations attendent leur première ligne.`);
    this.sync(true);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVis);
    if (typeof requestAnimationFrame === 'function') this.raf = requestAnimationFrame(this.loop);
  }

  ngOnDestroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.timers.forEach(t => clearTimeout(t));
    if (this.confirmTimer) clearTimeout(this.confirmTimer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVis);
  }

  private readonly loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    const s = this.sim;
    const run = this.started() && !this.paused() && !s.over && !s.offers;
    if (run) {
      this.acc += dt * this.speed();
      let n = 0;
      while (this.acc >= STEP && n < 10) { s.step(STEP); this.acc -= STEP; n++; if (s.over || s.offers) { this.acc = 0; break; } }
      if (s.time - this.lastProg >= 1) { this.lastProg = s.time; this.progress.emit({ live: s.score(), time: 1 - s.time / (WEEKS * WEEK) }); }
    }
    this.drain();
    this.sync(run);
  };

  private sync(frame = true): void {
    const s = this.sim;
    if (s.net !== this.netVer()) this.netVer.set(s.net);
    if (s.version !== this.ver()) { this.ver.set(s.version); frame = true; }
    if (frame) this.frame.set(this.buildFrame(this.started() && !this.paused() && !s.over && !s.offers ? this.acc / STEP : 1));
  }

  private buildFrame(alpha: number): Frame {
    const s = this.sim, v = s.viewAt();
    const trains = s.trains.map(t => {
      const x = lerp(t.px, t.x, alpha), y = lerp(t.py, t.y, alpha);
      const da = ((((t.a - t.pa) % 180) + 270) % 180) - 90;
      return { id: t.id, tf: `translate(${f2(x)} ${f2(y)}) rotate(${f2(t.pa + da * alpha)})`, color: COLORS[t.slot], cars: carsPath(1 + t.wagons),
        pax: trainPax(t.pax, 1 + t.wagons), ghost: !!t.ghost || t.retire || !s.line(t.line) };
    });
    const timers = s.stations.filter(st => st.over > 0).map(st => ({ id: st.id, d: wedge(st.x, st.y, ST_R + 3.6, st.over), hot: st.over > 0.6 }));
    const wk = clamp((s.time - (s.week - 1) * WEEK) / WEEK, 0, 1);
    return { vb: `${f2(v.x)} ${f2(v.y)} ${f2(v.w)} ${f2(v.h)}`, trains, timers, clock: wedge(0, 0, 6.6, wk), day: DAYS[Math.min(6, Math.floor(wk * 7))] };
  }

  private drain(): void {
    const s = this.sim;
    if (!s.events.length) return;
    const ev = s.events.splice(0);
    for (const e of ev) {
      if (e.type === 'alarm') {
        this.say(`⚠️ ${s.stations[e.id].name} déborde : desservez-la vite !`);
        if (s.time - this.lastMiss > 6) { this.lastMiss = s.time; this.miss.emit(); }
      } else if (e.type === 'week') {
        this.hubMode.set(false);
        this.cancel();
      } else if (e.type === 'over') this.finish();
    }
  }

  private finish(): void {
    const s = this.sim, o = s.over;
    if (!o || this.verdict()) return;
    this.cancel();
    this.armed.set(null); this.hubMode.set(false);
    const sc = s.score();
    const weeksDone = o.reason === 'win' ? WEEKS : s.week - 1;
    const title = o.reason === 'overflow' ? `${s.stations[o.station].name} est saturée : le réseau ferme.`
      : o.reason === 'win' ? `${WEEKS} semaines sans saturation : le réseau tient bon !`
      : `Vous fermez le réseau en semaine ${s.week}.`;
    this.verdict.set({ title, good: sc >= 0.65, bad: sc < 0.4, delivered: s.delivered, weeks: weeksDone, score: Math.round(sc * 100) });
    this.info.set('');
    if (o.reason === 'overflow') this.miss.emit();
    this.progress.emit({ live: sc, time: 0 });
    this.timers.push(setTimeout(() => this.done.emit(sc), 2000));
    this.sync(true);
  }

  /* ── Commandes ── */

  protected start(): void {
    this.started.set(true);
    this.paused.set(false);
    this.say('Glissez d’une station à l’autre pour tracer votre première ligne.');
  }
  protected togglePause(): void { if (!this.sim.over) this.paused.update(p => !p); this.sync(true); }
  protected toggleSpeed(): void { this.speed.update(v => (v === 1 ? 2 : 1)); }
  protected choose(i: number): void { this.sim.choose(i); this.say('Renfort reçu. La semaine reprend.'); this.sync(true); }
  protected toggleHub(): void {
    this.hubMode.update(v => !v);
    this.armed.set(null);
    this.say(this.hubMode() ? 'Touchez la station à transformer en correspondance.' : '');
  }
  protected closeNet(): void {
    if (this.sim.over) return;
    if (!this.confirmClose()) {
      this.confirmClose.set(true);
      if (this.confirmTimer) clearTimeout(this.confirmTimer);
      this.confirmTimer = setTimeout(() => this.confirmClose.set(false), 3500);
      return;
    }
    this.confirmClose.set(false);
    this.sim.close();
    this.drain();
    this.sync(true);
  }
  protected pickSlot(slot: number): void {
    const l = this.sim.lines.find(x => x.slot === slot);
    if (!l) { this.deselect(); this.say(`Ligne ${COLOR_NAMES[slot]} libre : glissez d’une station à l’autre pour la tracer.`); return; }
    if (this.selLine() === l.id) { this.deselect(); return; }
    this.select(l.id);
  }
  private select(id: number, edge: [number, number] | null = null): void {
    this.selLine.set(id); this.focusEdge.set(edge); this.focusSt.set(null);
    this.sim.net++;
    this.sync(true);
  }
  protected deselect(): void {
    this.selLine.set(null); this.focusEdge.set(null); this.focusSt.set(null);
    this.sim.net++;
    this.sync(true);
  }
  protected trainAct(d: number): void {
    const id = this.selLine();
    if (id === null) return;
    const r = d > 0 ? this.sim.addTrain(id) : this.sim.removeTrain(id);
    this.say(r ? this.err(r) : d > 0 ? 'Une locomotive de plus sur la ligne.' : 'La locomotive rentre au dépôt après son prochain arrêt.');
    this.sync(true);
  }
  protected wagonAct(d: number): void {
    const id = this.selLine();
    if (id === null) return;
    const r = d > 0 ? this.sim.addWagon(id) : this.sim.removeWagon(id);
    this.say(r ? this.err(r) : d > 0 ? 'Wagon attelé : six places de plus.' : 'Wagon dételé.');
    this.sync(true);
  }
  protected cut(): void {
    const id = this.selLine(), e = this.focusEdge();
    if (id === null || !e) return;
    const r = this.sim.cutEdge(id, e[0], e[1]);
    this.say(r ? this.err(r) : 'Tronçon coupé.');
    this.focusEdge.set(null);
    if (!this.sim.line(id)) this.deselect();
    this.sync(true);
  }
  protected dropStop(): void {
    const id = this.selLine(), st = this.focusSt();
    if (id === null || st === null) return;
    const r = this.sim.removeStop(id, st);
    this.say(r ? this.err(r) : `${this.sim.stations[st].name} n’est plus desservie par cette ligne.`);
    this.focusSt.set(null);
    if (!this.sim.line(id)) this.deselect();
    this.sync(true);
  }
  protected deleteSel(): void {
    const id = this.selLine();
    if (id === null) return;
    this.sim.deleteLine(id);
    this.say('Ligne supprimée : ses rames finissent leur trajet puis rentrent au dépôt.');
    this.deselect();
  }

  private err(e: ErrCode): string {
    switch (e) {
      case 'slot': return 'Toutes vos lignes sont tracées : prolongez-en une par son extrémité (le petit T) ou supprimez-en une.';
      case 'token': return `Il vous faut un ${this.conf.token.one} de plus pour ${this.conf.cross}.`;
      case 'dup': return 'Cette station est déjà sur la ligne.';
      case 'loop': return 'Cette ligne forme une boucle : coupez un tronçon pour la rouvrir.';
      case 'mid': return 'Seul un tronçon d’extrémité se coupe. Pour le milieu, retirez une station de la ligne.';
      case 'loco': return 'Plus de locomotive en réserve : retirez-en une d’une autre ligne.';
      case 'wagon': return 'Plus de wagon en réserve.';
      case 'hub': return 'Plus de correspondance à placer.';
      default: return 'Impossible ici.';
    }
  }
  private say(t: string): void { this.info.set(t); }

  /* ── Tracé à la souris ou au doigt ── */

  private canEdit(): boolean { return this.started() && !this.sim.over && !this.sim.offers; }
  private world(ev: PointerEvent): { p: Pt; ppu: number } | null {
    const svg = this.mapEl()?.nativeElement;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    const w = svg.getBoundingClientRect().width || 1;
    return { p: { x: p.x, y: p.y }, ppu: w / this.sim.viewAt().w };
  }
  private hit(p: Pt, ppu: number): Target {
    const s = this.sim;
    let best: Target = { kind: 'none' }, bd = Infinity;
    const rs = Math.max(ST_R + 2, 20 / ppu);
    for (const st of s.stations) { const d = dist(p, st); if (d < rs && d < bd) { bd = d; best = { kind: 'station', s: st.id }; } }
    const rh = Math.max(2.8, 17 / ppu);
    for (const h of s.handles()) { const d = dist(p, h.tip) * 0.8; if (d < rh && d < bd) { bd = d; best = { kind: 'handle', line: h.line, end: h.end, s: h.s }; } }
    if (best.kind !== 'none') return best;
    const re = Math.max(1.8, 12 / ppu);
    for (const l of s.lines) for (const [a, b] of s.edges(l)) {
      const path = s.edgePath(l.id, a, b);
      if (!path) continue;
      const d = dPath(p, path);
      if (d < re && d < bd) { bd = d; best = { kind: 'edge', line: l.id, a, b }; }
    }
    return best;
  }
  private snap(p: Pt, ppu: number): number {
    let best = -1, bd = Math.max(ST_R + 1.6, 15 / ppu);
    for (const st of this.sim.stations) { const d = dist(p, st); if (d < bd) { bd = d; best = st.id; } }
    return best;
  }

  protected down(ev: PointerEvent): void {
    if (!this.canEdit() || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    const w = this.world(ev);
    if (!w) return;
    const target = this.hit(w.p, w.ppu);
    this.ptr = { id: ev.pointerId, sx: ev.clientX, sy: ev.clientY, moved: false, target, mode: 'none', line: -1, end: 'tail', anchor: -1, from: -1, a: -1, b: -1, fail: -1 };
    try { (ev.currentTarget as Element).setPointerCapture(ev.pointerId); } catch { /* capture facultative */ }
    if (target.kind !== 'none') ev.preventDefault();
  }

  protected move(ev: PointerEvent): void {
    const w = this.world(ev);
    if (!w) return;
    const ptr = this.ptr;
    if (!ptr || ptr.id !== ev.pointerId) {
      // Survol à la souris : l’élastique suit le pointeur depuis la station armée
      const arm = this.armed();
      if (arm && this.canEdit()) this.rubber.set([this.rub(arm.s, w.p, this.rubColor(arm.line), false)]);
      return;
    }
    if (!ptr.moved) {
      if (Math.hypot(ev.clientX - ptr.sx, ev.clientY - ptr.sy) < 7) return;
      ptr.moved = true;
      this.beginDrag(ptr);
    }
    if (!this.canEdit()) return;
    const sn = this.snap(w.p, w.ppu);
    if (sn !== ptr.fail) ptr.fail = -1;
    const s = this.sim;
    if (ptr.mode === 'new' && sn >= 0 && sn !== ptr.from && ptr.fail < 0) {
      const r = s.startLine(ptr.from, sn);
      if (typeof r === 'number') {
        ptr.mode = 'extend'; ptr.line = r; ptr.end = 'tail'; ptr.anchor = sn;
        if (!s.trains.some(t => t.line === r)) this.say(this.err('loco'));
        else this.say('Ligne ouverte. Continuez vers d’autres stations pour la prolonger.');
      } else if (r !== 'same') { ptr.fail = sn; this.say(this.err(r)); }
    } else if (ptr.mode === 'extend' && sn >= 0 && sn !== ptr.anchor && ptr.fail < 0) {
      const l = s.line(ptr.line);
      if (!l) ptr.mode = 'none';
      else {
        const prev = ptr.end === 'tail' ? l.stops[l.stops.length - 2] : l.stops[1];
        if (sn === prev && !l.loop) {
          if (l.stops.length <= 2) { s.deleteLine(l.id); ptr.mode = 'new'; ptr.from = sn; if (this.selLine() === l.id) this.selLine.set(null); }
          else { s.retract(l.id, ptr.end); ptr.anchor = sn; }
        } else {
          const r = s.extend(l.id, ptr.end, sn);
          if (r === null) { ptr.anchor = sn; if (s.line(l.id)?.loop) { ptr.mode = 'none'; this.say('La ligne est bouclée.'); } }
          else { ptr.fail = sn; this.say(this.err(r)); }
        }
      }
    } else if (ptr.mode === 'insert' && sn >= 0 && sn !== ptr.a && sn !== ptr.b && ptr.fail < 0) {
      const r = s.insert(ptr.line, ptr.a, ptr.b, sn);
      if (r === null) { ptr.mode = 'none'; this.say(`La ligne passe désormais par ${s.stations[sn].name}.`); }
      else { ptr.fail = sn; this.say(this.err(r)); }
    }
    // L’élastique
    const bad = ptr.fail >= 0;
    if (ptr.mode === 'new') this.rubber.set([this.rub(ptr.from, w.p, COLORS[Math.max(0, s.freeSlot())], bad)]);
    else if (ptr.mode === 'extend') this.rubber.set([this.rub(ptr.anchor, w.p, this.rubColor(ptr.line), bad)]);
    else if (ptr.mode === 'insert') this.rubber.set([this.rub(ptr.a, w.p, this.rubColor(ptr.line), bad), this.rub(ptr.b, w.p, this.rubColor(ptr.line), bad)]);
    else this.rubber.set([]);
    this.sync(true);
  }

  private beginDrag(ptr: Ptr): void {
    const s = this.sim, t = ptr.target;
    this.armed.set(null);
    if (t.kind === 'station') {
      const sel = this.selLine();
      const selEnd = sel !== null ? s.endAt(sel, t.s) : null;
      if (sel !== null && selEnd) { ptr.mode = 'extend'; ptr.line = sel; ptr.end = selEnd; ptr.anchor = t.s; }
      else if (s.freeSlot() >= 0) { ptr.mode = 'new'; ptr.from = t.s; }
      else {
        const l = s.lines.find(x => s.endAt(x.id, t.s));
        if (l) { ptr.mode = 'extend'; ptr.line = l.id; ptr.end = s.endAt(l.id, t.s)!; ptr.anchor = t.s; }
        else this.say(this.err('slot'));
      }
    } else if (t.kind === 'handle') { ptr.mode = 'extend'; ptr.line = t.line; ptr.end = t.end; ptr.anchor = t.s; }
    else if (t.kind === 'edge') { ptr.mode = 'insert'; ptr.line = t.line; ptr.a = t.a; ptr.b = t.b; }
  }

  protected up(ev: PointerEvent): void {
    const ptr = this.ptr;
    if (!ptr || ptr.id !== ev.pointerId) return;
    this.ptr = null;
    this.rubber.set([]);
    if (!ptr.moved && this.canEdit()) this.tap(ptr.target);
    this.sync(true);
  }
  protected cancel(): void {
    if (!this.ptr) return;
    this.ptr = null;
    this.rubber.set([]);
  }

  private rub(from: number, p: Pt, color: string, bad: boolean): { d: string; color: string; bad: boolean } {
    const st = this.sim.stations[from];
    return { d: roundPath(octi(st, p), true), color, bad };
  }
  private rubColor(line: number | null): string {
    const l = line !== null ? this.sim.line(line) : undefined;
    return l ? COLORS[l.slot] : COLORS[Math.max(0, this.sim.freeSlot())];
  }

  /* ── Au toucher : station après station ── */

  private tap(t: Target): void {
    if (t.kind === 'station') { this.tapStation(t.s); return; }
    if (t.kind === 'handle') {
      this.select(t.line);
      this.armed.set({ s: t.s, line: t.line });
      this.say('Touchez une station pour y prolonger la ligne.');
      return;
    }
    if (t.kind === 'edge') {
      this.armed.set(null);
      this.select(t.line, [t.a, t.b]);
      this.say(`Tronçon ${this.sim.stations[t.a].name} – ${this.sim.stations[t.b].name}.`);
      return;
    }
    this.armed.set(null); this.hubMode.set(false);
    this.rubber.set([]);
    if (this.selLine() !== null) this.deselect();
  }

  protected key(s: number): void { if (this.canEdit()) { this.tapStation(s); this.sync(true); } }

  private tapStation(s: number): void {
    const sim = this.sim, st = sim.stations[s];
    if (this.hubMode()) {
      const r = sim.makeHub(s);
      this.hubMode.set(false);
      this.say(r ? this.err(r) : `${st.name} devient une correspondance : 12 places, échanges plus rapides.`);
      return;
    }
    const arm = this.armed();
    if (arm && arm.s === s) { this.armed.set(null); this.rubber.set([]); this.say(''); return; }
    if (arm) {
      const r = this.connect(arm.s, s, arm.line);
      if (typeof r === 'number') {
        const l = sim.line(r);
        this.armed.set(l && !l.loop ? { s, line: r } : null);
        this.rubber.set([]);
        this.say(l?.loop ? 'La ligne est bouclée.' : `${st.name} reliée. Touchez une autre station pour continuer, ou la même pour arrêter.`);
      } else this.say(this.err(r));
      return;
    }
    const sel = this.selLine();
    const line = sel !== null && sim.endAt(sel, s) ? sel : null;
    this.armed.set({ s, line });
    if (sel !== null && sim.line(sel)?.stops.includes(s)) this.focusSt.set(s);
    const n = st.wait.length;
    this.say(`${st.name} (${SHAPE_LABEL[st.shape]}) : ${n} voyageur${n > 1 ? 's' : ''}. Touchez une autre station pour les relier.`);
  }

  /** Relie a à b : prolonge la ligne choisie si a en est un bout, sinon ouvre une ligne */
  private connect(a: number, b: number, hint: number | null): number | ErrCode {
    const s = this.sim;
    const pick = [hint, this.selLine()].find(id => id !== null && s.endAt(id, a)) ?? null;
    if (pick !== null) { const r = s.extend(pick, s.endAt(pick, a)!, b); return r ?? pick; }
    if (s.freeSlot() >= 0) return s.startLine(a, b);
    const l = s.lines.find(x => s.endAt(x.id, a));
    if (l) { const r = s.extend(l.id, s.endAt(l.id, a)!, b); return r ?? l.id; }
    return 'slot';
  }
}

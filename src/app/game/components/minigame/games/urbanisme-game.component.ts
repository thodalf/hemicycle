import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/* ============================================================
 *  Le plan d'urbanisme : un vrai jeu de construction au tour par
 *  tour sur une grille 8 × 8. Chaque année du mandat, on tire trois
 *  projets et on en bâtit deux ; les voisinages comptent (parcs,
 *  écoles, usines, odeurs, bruit), l'emploi, la pollution et le
 *  budget aussi. Des événements forcent des choix. Trois variantes :
 *  la commune à moderniser, la ville nouvelle sur la Loire, la
 *  reconstruction après la crue.
 *
 *  Toute la simulation est en fonctions pures exportées (testables
 *  hors d'Angular) ; le composant n'est qu'une interface tactile.
 * ============================================================ */

export const W = 8;
const N = W * W;

export type Variant = 'commune' | 'nouvelle' | 'reconstruction';
export type Terrain = 'plaine' | 'foret' | 'colline' | 'riviere' | 'ruine';
export type BKind = 'logements' | 'residence' | 'ancien' | 'ecole' | 'commerce' | 'usine' | 'parc' | 'tram' | 'hopital' | 'fetes' | 'solaire' | 'epuration';
export type Rnd = () => number;

export interface Cell { t: Terrain; b: BKind | null; flood: boolean; fresh?: boolean }

export interface City {
  v: Variant;
  cells: Cell[];
  budget: number;
  year: number;
  years: number;
  /** Humeur passagère (événements), s'estompe chaque année */
  mood: number;
  /** Charges ajoutées (grève…) */
  extra: number;
  /** Dotation annuelle (État, roi, fonds d'urgence) */
  grant: number;
  popTarget: number;
  satTarget: number;
  /** Ville nouvelle : quartiers à relier par le tram */
  dTarget: number;
  /** Reconstruction : ruines initiales en zone inondable */
  flood0: number;
  /** Emplois du bassin alentour */
  extJobs: number;
  /** Population au début du mandat */
  pop0: number;
  /** Chantiers par an et projets par main */
  works: number;
  handSize: number;
  /** Projet offert dans la prochaine main */
  free: BKind | null;
  freeClears: number;
  bankrupt: boolean;
  used: string[];
}

export interface BDef { name: string; icon: string; cost: number; pop: number; jobs: number; rev: number; upkeep: number; poll: number; housing: boolean; tag: string; rule: string; cat: 'hab' | 'srv' | 'eco' | 'vert' | 'tram' }

export const BUILD: Record<BKind, BDef> = {
  logements: { name: 'Logements', icon: '🏘️', cost: 4, pop: 100, jobs: 0, rev: 0, upkeep: 0, poll: 0, housing: true, cat: 'hab', tag: '+100 hab.',
    rule: 'Loge 100 habitants. Aiment les parcs, la forêt ou l’eau, une école et des commerces à 2 cases ; détestent usines, stations d’épuration et ruines au contact.' },
  residence: { name: 'Résidence', icon: '🏢', cost: 7, pop: 180, jobs: 0, rev: 0, upkeep: 0, poll: 0, housing: true, cat: 'hab', tag: '+180 hab.',
    rule: 'Loge 180 habitants, mais c’est dense : −1 de cadre de vie. Mêmes goûts que les logements.' },
  ancien: { name: 'Maisons anciennes', icon: '🏠', cost: 0, pop: 80, jobs: 0, rev: 0, upkeep: 0, poll: 0, housing: true, cat: 'hab', tag: '80 hab.',
    rule: 'Le vieux centre : 80 habitants, mêmes goûts que les logements.' },
  ecole: { name: 'École', icon: '🏫', cost: 6, pop: 0, jobs: 20, rev: 0, upkeep: 1, poll: 0, housing: false, cat: 'srv', tag: '+2 à 2 cases',
    rule: '+2 aux logements à 2 cases ou moins (un logement sans école proche : −1). 20 emplois, entretien 1 M€/an.' },
  commerce: { name: 'Commerces', icon: '🏪', cost: 4, pop: 0, jobs: 40, rev: 1, upkeep: 0, poll: 0, housing: false, cat: 'eco', tag: '40 emplois',
    rule: '40 emplois. Rapporte 0,5 M€/an, +0,5 avec deux logements voisins, +1 au contact du tram, −0,5 par commerce voisin. +1 aux logements à 2 cases.' },
  usine: { name: 'Usine', icon: '🏭', cost: 7, pop: 0, jobs: 120, rev: 2.5, upkeep: 0, poll: 3, housing: false, cat: 'eco', tag: '120 emplois',
    rule: '120 emplois et 2,5 M€/an, mais pollution +3 (+1 au bord de l’eau). Logements voisins −3, à 2 cases −1.' },
  parc: { name: 'Parc', icon: '🌳', cost: 3, pop: 0, jobs: 0, rev: 0, upkeep: 0.2, poll: -1, housing: false, cat: 'vert', tag: '+2 au contact',
    rule: '+2 aux logements voisins (+1 pour un second parc), pollution −1. Entretien 0,2 M€/an.' },
  tram: { name: 'Ligne de tram', icon: '🚋', cost: 1, pop: 0, jobs: 0, rev: 0, upkeep: 0.1, poll: 0, housing: false, cat: 'tram', tag: '3 tronçons',
    rule: 'Trois tronçons à 1 M€ qui prolongent la ligne (pont sur la rivière : +2 M€). +1 aux logements voisins, dope les commerces, chaque 3 tronçons retire 1 de pollution due au trafic.' },
  hopital: { name: 'Hôpital', icon: '🏥', cost: 9, pop: 0, jobs: 60, rev: 0, upkeep: 2, poll: 0, housing: false, cat: 'srv', tag: '+3 satisf.',
    rule: '+1 aux logements à 3 cases, +3 de satisfaction générale dès 300 habitants. 60 emplois, entretien 2 M€/an.' },
  fetes: { name: 'Salle des fêtes', icon: '🎭', cost: 4, pop: 0, jobs: 10, rev: 0, upkeep: 0.5, poll: 0, housing: false, cat: 'srv', tag: '+2 satisf.',
    rule: 'Vie de quartier : +1 aux logements à 2 cases, mais bruit −1 au contact. +2 de satisfaction générale (deux salles au plus). Entretien 0,5.' },
  solaire: { name: 'Centrale solaire', icon: '☀️', cost: 4, pop: 0, jobs: 10, rev: 1, upkeep: 0, poll: -1, housing: false, cat: 'vert', tag: '+1 M€/an',
    rule: 'Rapporte 1 M€/an (+0,5 sur une colline), pollution −1, 10 emplois.' },
  epuration: { name: 'Station d’épuration', icon: '💧', cost: 5, pop: 0, jobs: 10, rev: 0, upkeep: 0.5, poll: -3, housing: false, cat: 'srv', tag: 'pollution −3',
    rule: 'Pollution −3 (−4 au bord de l’eau). Odeurs : logements voisins −2. Entretien 0,5 M€/an.' },
};

export const TERRAIN_LABEL: Record<Terrain, string> = {
  plaine: 'Terrain libre', foret: 'Forêt (défrichement +1 M€)', colline: 'Colline (+1 M€, belle vue)', riviere: 'Rivière (seul le tram la franchit)', ruine: 'Ruines à déblayer',
};

/* ── Géométrie ── */

const xy = (i: number): [number, number] => [i % W, Math.floor(i / W)];
function ring(i: number, r: number, exact = false): number[] {
  const [x, y] = xy(i);
  const out: number[] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (!dx && !dy) continue;
    if (exact && Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < W && ny < W) out.push(ny * W + nx);
  }
  return out;
}
const N8: number[][] = Array.from({ length: N }, (_, i) => ring(i, 1));
const R2: number[][] = Array.from({ length: N }, (_, i) => ring(i, 2));
const D2: number[][] = Array.from({ length: N }, (_, i) => ring(i, 2, true));
const R3: number[][] = Array.from({ length: N }, (_, i) => ring(i, 3));
const N4: number[][] = Array.from({ length: N }, (_, i) => {
  const [x, y] = xy(i);
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < W && b < W).map(([a, b]) => b * W + a);
});

export function mulberry(seed: number): Rnd {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const isHousing = (b: BKind | null): boolean => !!b && BUILD[b].housing;

/* ── Cadre de vie d'un logement ── */

export interface QPart { label: string; v: number }

export function qParts(c: City, i: number): QPart[] {
  const cells = c.cells;
  const me = cells[i];
  const out: QPart[] = [];
  const add = (label: string, v: number) => { if (v) out.push({ label, v }); };
  if (me.t === 'colline') add('⛰️ Vue des collines', 1);
  if (me.flood) add('🌊 Zone inondable', -1);
  if (me.b === 'residence') add('🏢 Densité', -1);
  let parc = 0, nature = 0, usine = 0, epur = 0, ruine = 0, bruit = 0, tram = 0, voisins = 0;
  for (const j of N8[i]) {
    const n = cells[j];
    if (n.b === 'parc') parc++;
    else if (n.b === 'usine') usine++;
    else if (n.b === 'epuration') epur++;
    else if (n.b === 'fetes') bruit++;
    else if (n.b === 'tram') tram++;
    else if (isHousing(n.b)) voisins++;
    if (!n.b && n.t === 'foret') nature++;
    if (n.t === 'riviere') nature++;
    if (n.t === 'ruine') ruine++;
  }
  add('🌳 Parc voisin', parc >= 2 ? 3 : parc * 2);
  add('🌲 Nature', Math.min(1, nature));
  add('🚋 Tram au pied', tram ? 1 : 0);
  add('🏭 Usine au contact', -3 * usine);
  add('🏭 Usine proche', -D2[i].filter(j => cells[j].b === 'usine').length);
  add('💧 Odeurs', -2 * epur);
  add('🧱 Ruines', -ruine);
  add('🎭 Bruit', -bruit);
  add(R2[i].some(j => cells[j].b === 'ecole') ? '🏫 École proche' : '🏫 Pas d’école', R2[i].some(j => cells[j].b === 'ecole') ? 2 : -1);
  add('🏪 Commerces', R2[i].some(j => cells[j].b === 'commerce') ? 1 : 0);
  add('🎭 Vie de quartier', R2[i].some(j => cells[j].b === 'fetes') ? 1 : 0);
  add('🏥 Hôpital', R3[i].some(j => cells[j].b === 'hopital') ? 1 : 0);
  add('🏘️ Entassement', voisins >= 5 ? -1 : 0);
  return out;
}
export const qOf = (c: City, i: number): number => qParts(c, i).reduce((t, p) => t + p.v, 0);

function commerceRev(c: City, i: number): number {
  const ns = N8[i].map(j => c.cells[j]);
  return Math.max(0, 0.5 + (ns.filter(n => isHousing(n.b)).length >= 2 ? 0.5 : 0) + (ns.some(n => n.b === 'tram') ? 1 : 0) - 0.5 * ns.filter(n => n.b === 'commerce').length);
}

/* ── Indicateurs ── */

export interface Stats {
  pop: number; jobs: number; actifs: number; unemp: number; poll: number; income: number; sat: number; avgQ: number;
  q: Map<number, number>; satParts: QPart[]; demand: number; tram: number; districts: number; served: number; floodLeft: number; floodBuilt: number;
}

/** Quartiers : groupes d'au moins deux cases d'habitat qui se touchent ; desservis si le réseau de tram les longe */
function districtsOf(c: City): { districts: number; served: number; ids: Map<number, number> } {
  const ids = new Map<number, number>();
  let districts = 0, served = 0, n = 0;
  // Le plus grand réseau de tram (connexité orthogonale)
  const tramSeen = new Set<number>();
  let best: number[] = [];
  for (let i = 0; i < N; i++) {
    if (c.cells[i].b !== 'tram' || tramSeen.has(i)) continue;
    const comp: number[] = [];
    const st = [i];
    tramSeen.add(i);
    while (st.length) { const k = st.pop()!; comp.push(k); for (const j of N4[k]) if (c.cells[j].b === 'tram' && !tramSeen.has(j)) { tramSeen.add(j); st.push(j); } }
    if (comp.length > best.length) best = comp;
  }
  const line = new Set(best);
  for (let i = 0; i < N; i++) {
    if (!isHousing(c.cells[i].b) || ids.has(i)) continue;
    const comp: number[] = [];
    const st = [i];
    const id = ++n;
    ids.set(i, id);
    while (st.length) { const k = st.pop()!; comp.push(k); for (const j of N8[k]) if (isHousing(c.cells[j].b) && !ids.has(j)) { ids.set(j, id); st.push(j); } }
    if (comp.length < 2) { ids.set(i, 0); continue; }
    districts++;
    if (comp.some(k => N8[k].some(j => line.has(j)))) served++;
  }
  return { districts, served, ids };
}

/** Logements attendus : la commune doit croître au fil du mandat ; les sinistrés attendent tous */
export function demandOf(c: City): number {
  if (c.v === 'reconstruction') return c.popTarget;
  if (c.v === 'commune') return Math.round(c.pop0 + (c.popTarget - c.pop0) * clamp((c.year - 1) / c.years));
  return 0;
}

export function stats(c: City): Stats {
  let pop = 0, jobs = 0, poll = 0, rev = 0, upkeep = 0, tram = 0, hop = 0, fetes = 0, qSum = 0, floodLeft = 0, floodBuilt = 0;
  const q = new Map<number, number>();
  c.cells.forEach((cell, i) => {
    if (cell.flood && (cell.b || cell.t === 'ruine')) { floodLeft++; if (cell.b) floodBuilt++; }
    const b = cell.b;
    if (!b) return;
    const d = BUILD[b];
    pop += d.pop; jobs += d.jobs; poll += d.poll; upkeep += d.upkeep;
    const wet = N4[i].some(j => c.cells[j].t === 'riviere');
    if (b === 'usine' && wet) poll += 1;
    if (b === 'epuration' && wet) poll -= 1;
    if (b === 'commerce') rev += commerceRev(c, i);
    else if (b === 'solaire') rev += d.rev + (cell.t === 'colline' ? 0.5 : 0);
    else rev += d.rev;
    if (b === 'tram') tram++;
    if (b === 'hopital') hop++;
    if (b === 'fetes') fetes++;
    if (d.housing) { const v = qOf(c, i); q.set(i, v); qSum += v * d.pop; }
  });
  poll += Math.max(0, Math.floor(pop / 600) - Math.floor(tram / 3));
  poll = Math.max(0, poll);
  const avgQ = pop ? qSum / pop : 0;
  const actifs = Math.round(pop * 0.45);
  jobs += c.extJobs;
  const unemp = pop ? Math.max(0, actifs - jobs) / actifs : 0;
  const services = pop ? (hop && pop >= 300 ? 3 : 0) + Math.min(2, fetes) * 2 : 0;
  // Demande de logements : la commune doit grandir, les sinistrés attendent un toit
  const demand = demandOf(c);
  const short = demand ? Math.max(0, demand - pop) / demand : 0;
  const satParts: QPart[] = [
    { label: '🏛️ Base', v: 44 },
    { label: '🏘️ Cadre de vie moyen', v: r1(4.5 * avgQ) },
    { label: '💼 Chômage', v: r1(-25 * unemp) },
    { label: '🌫️ Pollution', v: r1(-1.5 * poll) },
    { label: '🏥 Services', v: services },
    { label: c.v === 'reconstruction' ? '⛺ Sinistrés sans toit' : '🔑 Demandeurs de logement', v: r1(-(c.v === 'reconstruction' ? 15 : 20) * short) },
    { label: '📰 Événements', v: r1(c.mood) },
    { label: '💸 Comptes dans le rouge', v: c.budget < 0 ? -5 : 0 },
  ].filter(x => x.v);
  const sat = Math.round(clamp(satParts.reduce((t, x) => t + x.v, 0), 0, 100));
  const income = r1(pop * 0.005 + rev - upkeep - c.extra + c.grant);
  const dist = districtsOf(c);
  return { pop, jobs, actifs, unemp, poll, income, sat, avgQ, q, satParts, demand, tram, districts: dist.districts, served: dist.served, floodLeft, floodBuilt };
}

/* ── Construction ── */

export function placeCost(c: City, k: BKind, i: number, free = false): number {
  const t = c.cells[i].t;
  if (free) return 0;
  return BUILD[k].cost + (t === 'foret' ? 1 : 0) + (t === 'colline' && k !== 'parc' && k !== 'solaire' && k !== 'tram' ? 1 : 0) + (k === 'tram' && t === 'riviere' ? 2 : 0);
}

export function canPlace(c: City, k: BKind, i: number, free = false): string | null {
  const cell = c.cells[i];
  if (cell.b) return 'Case déjà bâtie';
  if (cell.t === 'ruine') return 'Des ruines : déblayez d’abord';
  if (cell.t === 'riviere' && k !== 'tram') return 'Seul le tram franchit la rivière';
  if (cell.flood && c.v === 'reconstruction') return 'Zone inondable : reconstruction interdite';
  if (k === 'tram' && c.cells.some(x => x.b === 'tram') && !N4[i].some(j => c.cells[j].b === 'tram')) return 'Le tram doit prolonger la ligne';
  if (placeCost(c, k, i, free) > c.budget) return 'Budget insuffisant';
  return null;
}

export function place(c: City, k: BKind, i: number, free = false): void {
  c.budget = r1(c.budget - placeCost(c, k, i, free));
  const cell = c.cells[i];
  if (cell.t === 'foret') cell.t = 'plaine';
  cell.b = k;
  cell.fresh = true;
}

/** Déblayer une ruine (2 M€) ou démolir un bâtiment (1 M€) */
export function clearCost(c: City, i: number): number | null {
  const cell = c.cells[i];
  if (cell.t === 'ruine') return c.freeClears > 0 ? 0 : 2;
  if (cell.b) return 1;
  return null;
}
export function canClear(c: City, i: number): string | null {
  const k = clearCost(c, i);
  if (k === null) return 'Rien à déblayer ici';
  if (k > c.budget) return 'Budget insuffisant';
  return null;
}
export function clearCell(c: City, i: number): void {
  const cell = c.cells[i];
  const k = clearCost(c, i) ?? 0;
  if (cell.t === 'ruine' && c.freeClears > 0) c.freeClears--;
  c.budget = r1(c.budget - k);
  if (cell.t === 'ruine') cell.t = 'plaine';
  cell.b = null;
}

export const cloneCity = (c: City): City => ({ ...c, cells: c.cells.map(x => ({ ...x })), used: [...c.used] });

/* ── Carte ── */

function genMap(v: Variant, r: Rnd): Cell[] {
  const cells: Cell[] = Array.from({ length: N }, () => ({ t: 'plaine' as Terrain, b: null, flood: false }));
  const set = (x: number, y: number, f: (c: Cell) => void) => { const [a, b] = v === 'nouvelle' ? [y, x] : [x, y]; f(cells[b * W + a]); };
  // La rivière serpente du haut vers le bas (d'ouest en est pour la Loire)
  let x = v === 'commune' ? 5 + Math.floor(r() * 2) : 2 + Math.floor(r() * 4);
  const river: [number, number][] = [];
  for (let y = 0; y < W; y++) {
    river.push([x, y]);
    if (y < W - 1 && r() < 0.4) {
      const nx = Math.max(1, Math.min(W - 2, x + (r() < 0.5 ? -1 : 1)));
      if (nx !== x) { river.push([nx, y]); x = nx; }
    }
  }
  for (const [a, b] of river) set(a, b, c => { c.t = 'riviere'; });
  // Zone inondable : les berges basses
  for (const [a, b] of river) for (const dx of [-1, 1]) {
    const nx = a + dx;
    if (nx < 0 || nx >= W) continue;
    if (r() < 0.62) set(nx, b, c => { if (c.t !== 'riviere') c.flood = true; });
  }
  const at = (i: number) => cells[i];
  const free = (i: number) => at(i).t === 'plaine' && !at(i).flood;
  const blob = (t: Terrain, size: number, tries = 30) => {
    for (let k = 0; k < tries; k++) {
      let i = Math.floor(r() * N);
      if (!free(i)) continue;
      const got = [i];
      while (got.length < size) {
        const ns = N4[i].filter(free).filter(j => !got.includes(j));
        if (!ns.length) break;
        i = ns[Math.floor(r() * ns.length)];
        got.push(i);
      }
      if (got.length >= size - 1) { for (const j of got) at(j).t = t; return; }
    }
  };
  blob('colline', 4);
  blob('foret', 3);
  blob('foret', 3);
  if (v !== 'reconstruction') blob('colline', 2);
  return cells;
}

/** Un bloc rectangulaire de terrain constructible, de préférence près de la rivière */
function findBlock(cells: Cell[], w: number, h: number, r: Rnd, wantFlood: number): number[] {
  let best: number[] = [], bestS = -1e9;
  for (let y = 0; y + h <= W; y++) for (let x = 0; x + w <= W; x++) {
    const ids: number[] = [];
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) ids.push((y + dy) * W + x + dx);
    if (ids.some(i => cells[i].t === 'riviere')) continue;
    const flood = ids.filter(i => cells[i].flood).length;
    const near = ids.some(i => N8[i].some(j => cells[j].t === 'riviere')) ? 2 : 0;
    const s = near - Math.abs(flood - wantFlood) * 1.5 - ids.filter(i => cells[i].t !== 'plaine').length * 0.5 + r();
    if (s > bestS) { bestS = s; best = ids; }
  }
  return best;
}

export function newCity(v: Variant, diff: number, r: Rnd): City {
  const cells = genMap(v, r);
  const d = clamp(diff, 0.6, 1.6);
  const c: City = {
    v, cells, budget: 0, year: 1, years: 10, mood: 0, extra: 0, grant: 0, popTarget: 0, satTarget: 0, dTarget: 0, flood0: 0, extJobs: 0, pop0: 0, works: 2, handSize: 3,
    free: null, freeClears: 0, bankrupt: false, used: [],
  };
  if (v === 'commune') {
    // Le vieux centre, son marché, son école… et la vieille usine au bord de l'eau
    const blk = findBlock(cells, 3, 3, r, 0);
    const corners = [blk[0], blk[2], blk[6], blk[8]];
    const school = corners[Math.floor(r() * 4)];
    blk.forEach(i => { cells[i].t = cells[i].t === 'riviere' ? 'riviere' : 'plaine'; cells[i].b = 'ancien'; });
    cells[blk[4]].b = 'commerce';
    cells[school].b = 'ecole';
    const empty = corners.filter(i => i !== school)[Math.floor(r() * 3)];
    cells[empty].b = null;
    const ring1 = [...new Set(blk.flatMap(i => N8[i]))].filter(i => !blk.includes(i) && cells[i].t !== 'riviere' && !cells[i].b);
    const wet = ring1.filter(i => N4[i].some(j => cells[j].t === 'riviere'));
    const pool = wet.length ? wet : ring1;
    const fac = pool[Math.floor(r() * pool.length)];
    if (fac !== undefined) { cells[fac].t = 'plaine'; cells[fac].b = 'usine'; }
    c.years = 10;
    c.budget = Math.round(11 * (1.3 - 0.3 * d));
    c.grant = 1;
    c.extJobs = 100;
    c.satTarget = Math.round(57 + 8 * d);
    c.popTarget = Math.round((1150 + 250 * d) / 50) * 50;
  } else if (v === 'nouvelle') {
    c.years = 10;
    c.works = 3;
    c.handSize = 4;
    c.budget = Math.round(16 * (1.3 - 0.3 * d));
    c.grant = 3;
    c.extJobs = 80;
    c.popTarget = Math.round((700 + 500 * d) / 50) * 50;
    c.dTarget = d >= 1.25 ? 4 : 3;
  } else {
    // Le quartier dévasté : ruines, quelques maisons debout, l'école a tenu
    const blk = findBlock(cells, 4, 3, r, 3);
    let sinistres = 0;
    const dry = blk.filter(i => !cells[i].flood);
    const keep = new Set<number>();
    while (keep.size < Math.min(4, dry.length)) keep.add(dry[Math.floor(r() * dry.length)]);
    const ks = [...keep];
    blk.forEach(i => { cells[i].t = 'ruine'; cells[i].b = null; sinistres += 100; });
    ks.forEach((i, k) => { cells[i].t = 'plaine'; cells[i].b = k === 0 ? 'ecole' : k === 1 ? 'commerce' : 'ancien'; sinistres -= 100; });
    // Les berges ravagées hors du quartier
    const banks = cells.map((x, i) => (x.flood && x.t !== 'ruine' && !blk.includes(i) ? i : -1)).filter(i => i >= 0);
    for (let k = 0; k < 3 && banks.length; k++) {
      const i = banks.splice(Math.floor(r() * banks.length), 1)[0];
      cells[i].t = 'ruine';
      sinistres += 100;
    }
    c.years = 9;
    c.budget = Math.round(12 * (1.3 - 0.3 * d));
    c.grant = 2;
    c.extJobs = 300;
    c.flood0 = cells.filter(x => x.flood && x.t === 'ruine').length;
    const housed = cells.reduce((t, x) => t + (x.b ? BUILD[x.b].pop : 0), 0);
    c.popTarget = housed + Math.round(sinistres * (0.75 + 0.25 * d) / 50) * 50;
  }
  c.pop0 = cells.reduce((t, x) => t + (x.b ? BUILD[x.b].pop : 0), 0);
  return c;
}

/* ── Les cartes de projets ── */

export interface Card { k: BKind; free?: boolean; segs?: number; id: number }
let cardId = 0;

const WEIGHTS: Record<Variant, Partial<Record<BKind, number>>> = {
  commune: { logements: 5, residence: 2, ecole: 2, commerce: 3, usine: 1.5, parc: 3, tram: 1.5, hopital: 1.2, fetes: 1.5, solaire: 1.5, epuration: 1.8 },
  nouvelle: { logements: 6, residence: 3, ecole: 2.2, commerce: 3, usine: 2, parc: 2.5, tram: 3.5, hopital: 1, fetes: 1, solaire: 1.5, epuration: 1.5 },
  reconstruction: { logements: 6, residence: 3, ecole: 1, commerce: 2, usine: 1, parc: 2.5, tram: 1, hopital: 1, fetes: 1, solaire: 1.5, epuration: 1.2 },
};

export function drawHand(c: City, r: Rnd): Card[] {
  const w = { ...WEIGHTS[c.v] };
  const out: Card[] = [];
  while (out.length < c.handSize) {
    const entries = Object.entries(w) as [BKind, number][];
    const total = entries.reduce((t, [, x]) => t + x, 0);
    let roll = r() * total;
    let pick = entries[0][0];
    for (const [k, x] of entries) { roll -= x; if (roll <= 0) { pick = k; break; } }
    delete w[pick];
    out.push({ k: pick, id: ++cardId, ...(pick === 'tram' ? { segs: 3 } : {}) });
  }
  if (c.v !== 'commune' && !out.some(x => BUILD[x.k].housing)) out[out.length - 1] = { k: 'logements', id: ++cardId };
  if (c.free) { out[0] = { k: c.free, free: true, id: ++cardId }; c.free = null; }
  return out;
}

/* ── Événements ── */

export interface EvOpt { label: string; hint: string; run: (c: City) => { msg: string; bad?: boolean } }
export interface CityEvent { id: string; icon: string; title: string; text: string; opts: EvOpt[] }

const nameOf = (k: BKind) => BUILD[k].name.toLowerCase();

const EVENTS: { id: string; vs: Variant[]; ok: (c: City) => boolean; make: (c: City) => CityEvent }[] = [
  {
    id: 'crue', vs: ['commune', 'nouvelle'], ok: () => true,
    make: c => {
      const hit = c.cells.map((x, i) => (x.flood && x.b ? i : -1)).filter(i => i >= 0);
      if (!hit.length) return { id: 'crue', icon: '🌊', title: 'La rivière en crue', text: 'L’eau sort de son lit… mais la zone inondable est restée vierge : aucun dégât. Les riverains saluent votre prudence.',
        opts: [{ label: 'Remercier les services', hint: '+3 de satisfaction', run: k => { k.mood += 3; return { msg: '🌊 Crue sans dégâts : la prudence paie.' }; } }] };
      const cost = 2 + hit.length;
      return { id: 'crue', icon: '🌊', title: 'La rivière en crue', text: `L’eau monte : ${hit.length} bâtiment${hit.length > 1 ? 's' : ''} en zone inondable ${hit.length > 1 ? 'sont' : 'est'} menacé${hit.length > 1 ? 's' : ''}.`,
        opts: [
          { label: `Digues d’urgence (−${cost} M€)`, hint: 'Tout est sauvé, à prix fort', run: k => { k.budget = r1(k.budget - cost); return { msg: `🌊 Les digues tiennent (−${cost} M€).` }; } },
          { label: 'Laisser passer l’eau', hint: `${hit.length} bâtiment${hit.length > 1 ? 's' : ''} en ruines, −4 satisfaction`, run: k => {
            hit.forEach(i => { k.cells[i].b = null; k.cells[i].t = 'ruine'; });
            k.mood -= 4;
            return { msg: `🌊 La crue emporte ${hit.length} bâtiment${hit.length > 1 ? 's' : ''}.`, bad: true };
          } },
        ] };
    },
  },
  {
    id: 'embacles', vs: ['reconstruction'], ok: () => true,
    make: c => {
      const left = c.cells.map((x, i) => (x.flood && x.t === 'ruine' ? i : -1)).filter(i => i >= 0);
      if (!left.length) return { id: 'embacles', icon: '🌧️', title: 'Nouvelle alerte orages', text: 'Les berges déblayées laissent filer l’eau : la décrue est rapide et sans casse.',
        opts: [{ label: 'Bien joué', hint: '+3 de satisfaction', run: k => { k.mood += 3; return { msg: '🌧️ L’alerte passe sans dégâts.' }; } }] };
      return { id: 'embacles', icon: '🌧️', title: 'Nouvelle alerte orages', text: `${left.length} tas de décombres encombrent encore la zone inondable : ils risquent de former des embâcles.`,
        opts: [
          { label: 'Tractopelles en urgence (−3 M€)', hint: 'Déblaie jusqu’à 3 ruines de la berge', run: k => {
            k.budget = r1(k.budget - 3);
            left.slice(0, 3).forEach(i => { k.cells[i].t = 'plaine'; });
            return { msg: '🚜 Les berges sont dégagées en urgence.' };
          } },
          { label: 'Attendre la décrue', hint: `Dégâts : −${left.length} M€, −3 satisfaction`, run: k => { k.budget = r1(k.budget - left.length); k.mood -= 3; return { msg: '🌧️ Les embâcles inondent les caves.', bad: true }; } },
        ] };
    },
  },
  {
    id: 'usine', vs: ['commune', 'nouvelle', 'reconstruction'], ok: c => c.cells.some(x => x.b === 'usine'),
    make: () => ({ id: 'usine', icon: '🏭', title: 'Fermeture d’usine', text: 'Le groupe propriétaire de l’usine annonce sa fermeture : 120 emplois sont menacés.',
      opts: [
        { label: 'Aider un repreneur (−4 M€)', hint: 'Les emplois restent, +2 satisfaction', run: k => { k.budget = r1(k.budget - 4); k.mood += 2; return { msg: '🏭 Un repreneur sauve l’usine.' }; } },
        { label: 'Laisser fermer', hint: 'L’usine devient une friche, −3 satisfaction', run: k => {
          const i = k.cells.findIndex(x => x.b === 'usine');
          if (i >= 0) { k.cells[i].b = null; k.cells[i].t = 'ruine'; }
          k.mood -= 3;
          return { msg: '🏭 L’usine ferme : une friche de plus.', bad: true };
        } },
      ] }),
  },
  {
    id: 'subvention', vs: ['commune', 'nouvelle', 'reconstruction'], ok: () => true,
    make: c => {
      const gift: BKind = c.v === 'commune' ? 'ecole' : c.v === 'nouvelle' ? 'hopital' : 'residence';
      const who = c.v === 'nouvelle' ? 'Le Trésor royal' : 'L’État';
      return { id: 'subvention', icon: c.v === 'nouvelle' ? '👑' : '🇫🇷', title: c.v === 'nouvelle' ? 'Dotation royale' : 'Subvention de l’État', text: `${who} propose de vous aider : de l’argent frais, ou un équipement clé en main.`,
        opts: [
          { label: 'Fonds d’équipement (+5 M€)', hint: 'Libre d’emploi', run: k => { k.budget = r1(k.budget + 5); return { msg: '💶 +5 M€ de subvention.' }; } },
          { label: `${BUILD[gift].icon} ${BUILD[gift].name} offert${gift === 'hopital' ? '' : 'e'}`, hint: 'Dans votre prochaine main, gratuit', run: k => { k.free = gift; return { msg: `${BUILD[gift].icon} Un projet de ${nameOf(gift)} est offert.` }; } },
        ] };
    },
  },
  {
    id: 'greve', vs: ['commune', 'nouvelle', 'reconstruction'], ok: () => true,
    make: () => ({ id: 'greve', icon: '✊', title: 'Grève des agents municipaux', text: 'Les agents de la voirie et des écoles cessent le travail : ils réclament une revalorisation.',
      opts: [
        { label: 'Revaloriser les salaires', hint: '−0,8 M€ par an jusqu’à la fin', run: k => { k.extra = r1(k.extra + 0.8); return { msg: '✊ Accord salarial : la grève cesse.' }; } },
        { label: 'Tenir bon', hint: '−7 de satisfaction', run: k => { k.mood -= 7; return { msg: '✊ La grève s’enlise, les poubelles débordent.', bad: true }; } },
      ] }),
  },
  {
    id: 'petition', vs: ['commune', 'nouvelle', 'reconstruction'],
    ok: c => c.cells.some((x, i) => (x.b === 'usine' || x.b === 'epuration' || x.b === 'fetes') && N8[i].some(j => isHousing(c.cells[j].b))),
    make: c => {
      let best = -1, n = 0;
      c.cells.forEach((x, i) => {
        if (x.b !== 'usine' && x.b !== 'epuration' && x.b !== 'fetes') return;
        const h = N8[i].filter(j => isHousing(c.cells[j].b)).length;
        if (h > n) { n = h; best = i; }
      });
      const k0 = c.cells[best].b as BKind;
      return { id: 'petition', icon: '📝', title: 'Pétition des riverains', text: `Les voisins de ${k0 === 'usine' ? 'l’usine' : k0 === 'fetes' ? 'la salle des fêtes' : 'la station d’épuration'} ont réuni 1 200 signatures : ils exigent sa fermeture.`,
        opts: [
          { label: 'Céder : démolir', hint: 'Le bâtiment disparaît, +2 satisfaction', run: k => { k.cells[best].b = null; k.mood += 2; return { msg: `📝 Vous cédez : ${nameOf(k0)} démolie.` }; } },
          { label: 'Passer outre', hint: '−5 de satisfaction', run: k => { k.mood -= 5; return { msg: '📝 Les riverains manifestent devant la mairie.', bad: true }; } },
        ] };
    },
  },
  {
    id: 'promoteur', vs: ['commune', 'nouvelle', 'reconstruction'], ok: () => true,
    make: () => ({ id: 'promoteur', icon: '🏗️', title: 'Un promoteur frappe à la porte', text: 'Un grand groupe propose de bâtir une résidence à ses frais, en échange d’un permis rapide.',
      opts: [
        { label: '🏢 Accepter la résidence', hint: 'Offerte dans la prochaine main, −2 satisfaction', run: k => { k.free = 'residence'; k.mood -= 2; return { msg: '🏗️ Le promoteur signe : une résidence offerte.' }; } },
        { label: 'Refuser le bétonnage', hint: '+2 de satisfaction', run: k => { k.mood += 2; return { msg: '🏗️ Vous éconduisez le promoteur.' }; } },
      ] }),
  },
  {
    id: 'roi', vs: ['nouvelle'], ok: () => true,
    make: () => ({ id: 'roi', icon: '👑', title: 'Le roi s’impatiente', text: 'Sa Majesté veut voir son grand projet avancer et envoie son intendant.',
      opts: [
        { label: 'Accélérer (+6 M€)', hint: 'Mais l’objectif de population monte de 200', run: k => { k.budget = r1(k.budget + 6); k.popTarget += 200; return { msg: '👑 Crédits royaux : +6 M€, objectif relevé.' }; } },
        { label: 'Présenter la maquette du tram', hint: '+5 si 3 tronçons posés, sinon −5', run: k => {
          const ok = k.cells.filter(x => x.b === 'tram').length >= 3;
          k.mood += ok ? 5 : -5;
          return ok ? { msg: '👑 Le roi admire la ligne de tram.' } : { msg: '👑 Le roi cherche le tram sur la maquette…', bad: true };
        } },
      ] }),
  },
  {
    id: 'dons', vs: ['reconstruction'], ok: () => true,
    make: () => ({ id: 'dons', icon: '❤️', title: 'Élan de solidarité', text: 'Tout le pays se mobilise pour la commune sinistrée.',
      opts: [
        { label: 'Collecte nationale (+4 M€)', hint: 'De l’argent frais', run: k => { k.budget = r1(k.budget + 4); return { msg: '❤️ La collecte rapporte 4 M€.' }; } },
        { label: 'Bénévoles du déblaiement', hint: '3 déblaiements gratuits', run: k => { k.freeClears += 3; return { msg: '❤️ Des bénévoles arrivent avec pelles et brouettes.' }; } },
      ] }),
  },
  {
    id: 'assureurs', vs: ['reconstruction'], ok: () => true,
    make: () => ({ id: 'assureurs', icon: '📄', title: 'Les assureurs traînent', text: 'Les experts tardent : les familles attendent leurs indemnités pour racheter meubles et voitures.',
      opts: [
        { label: 'Avancer les indemnités (−4 M€)', hint: '+5 de satisfaction', run: k => { k.budget = r1(k.budget - 4); k.mood += 5; return { msg: '📄 La commune avance les indemnités.' }; } },
        { label: 'Attendre les experts', hint: '−4 de satisfaction', run: k => { k.mood -= 4; return { msg: '📄 La colère monte contre les assureurs.', bad: true }; } },
      ] }),
  },
  {
    id: 'gel', vs: ['reconstruction'], ok: c => c.year >= 5,
    make: c => {
      const pop = stats(c).pop;
      if (pop >= c.popTarget * 0.85) return { id: 'gel', icon: '❄️', title: 'Premières gelées', text: 'Le froid arrive, mais presque tous les sinistrés ont retrouvé un toit.',
        opts: [{ label: 'Visiter les nouveaux quartiers', hint: '+4 de satisfaction', run: k => { k.mood += 4; return { msg: '❄️ L’hiver approche, les familles sont au chaud.' }; } }] };
      return { id: 'gel', icon: '❄️', title: 'Premières gelées', text: 'Des familles dorment encore au gymnase alors que le froid tombe.',
        opts: [
          { label: 'Hébergement d’urgence (−3 M€)', hint: 'Hôtels et mobil-homes', run: k => { k.budget = r1(k.budget - 3); return { msg: '❄️ Les sinistrés passent l’hiver à l’hôtel.' }; } },
          { label: 'Faire avec les gymnases', hint: '−6 de satisfaction', run: k => { k.mood -= 6; return { msg: '❄️ Images de lits de camp au JT de 20 h.', bad: true }; } },
        ] };
    },
  },
];

export const EVENT_YEARS: Record<Variant, number[]> = { commune: [2, 5, 8], nouvelle: [2, 4, 6, 8], reconstruction: [2, 4, 6, 8] };

export function drawEvent(c: City, r: Rnd): CityEvent | null {
  if (!EVENT_YEARS[c.v].includes(c.year)) return null;
  // La reconstruction finit toujours par le froid
  if (c.v === 'reconstruction' && c.year === 8 && !c.used.includes('gel')) { c.used.push('gel'); return EVENTS.find(e => e.id === 'gel')!.make(c); }
  const pool = EVENTS.filter(e => e.vs.includes(c.v) && !c.used.includes(e.id) && e.ok(c) && !(e.id === 'gel'));
  if (!pool.length) return null;
  const e = pool[Math.floor(r() * pool.length)];
  c.used.push(e.id);
  return e.make(c);
}

/* ── Fin d'année et score ── */

export function endYear(c: City): { income: number } {
  const s = stats(c);
  c.budget = r1(c.budget + s.income);
  c.mood = r1(c.mood * 0.6);
  if (c.budget < -8) c.bankrupt = true;
  c.cells.forEach(x => { x.fresh = false; });
  c.year++;
  return { income: s.income };
}

export interface Score { score: number; popC: number; satC: number; budC: number; objC: number; objOk: boolean; s: Stats }

export function scoreCity(c: City): Score {
  const s = stats(c);
  const popC = clamp(s.pop / c.popTarget);
  const satC = clamp((s.sat - 35) / 45);
  const budC = clamp(0.5 + c.budget / 30 + (s.income > 0 ? 0.1 : -0.1));
  let prog = 0, objOk = false;
  if (c.v === 'commune') {
    const satOk = s.sat >= c.satTarget, budOk = c.budget >= 0;
    objOk = satOk && budOk;
    prog = clamp((s.sat - 45) / (c.satTarget - 45)) * (budOk ? 1 : 0.5);
  } else if (c.v === 'nouvelle') {
    objOk = s.pop >= c.popTarget && s.served >= c.dTarget;
    prog = 0.5 * popC + 0.5 * clamp(s.served / c.dTarget);
  } else {
    objOk = s.pop >= c.popTarget && s.floodLeft === 0;
    prog = 0.65 * popC + 0.35 * (c.flood0 ? 1 - s.floodLeft / c.flood0 : 1);
  }
  const objC = objOk ? 1 : 0.7 * prog * prog;
  let score = 0.15 * popC + 0.2 * satC + 0.1 * budC + 0.55 * objC;
  if (c.bankrupt) score = Math.min(score, 0.15);
  return { score: clamp(score), popC, satC, budC, objC, objOk, s };
}


/* ============================================================
 *  Le composant
 *  Rendu « plan d’urbanisme » : un plan masse vu du dessus,
 *  îlots cadastraux, rues, rivière, relief, zone inondable
 *  hachurée, bâtiments en toitures avec leurs ombres portées.
 * ============================================================ */

interface Fx { i: number; text: string; tone: 'good' | 'bad' | 'info'; id: number }
interface Preview { i: number; err: string | null; cost: number; dPop: number; dJobs: number; dSat: number; dInc: number; dPoll: number; deltas: Map<number, number>; own: number | null; notes: string[] }

/** Un élément de dessin : tracé, remplissage, trait */
interface Part { d: string; f?: string; s?: string; w?: number }
type GlyphId = 'people' | 'jobs' | 'euro' | 'smog' | 'target' | 'crane' | 'dozer' | 'refresh' | 'face1' | 'face2' | 'face3' | 'face4'
  | 'waves' | 'rain' | 'factory' | 'megaphone' | 'doc' | 'crown' | 'heart' | 'snow' | 'stop';

const rd = (v: number) => Math.round(v * 100) / 100;
const box = (x: number, y: number, w: number, h: number) => `M${rd(x)} ${rd(y)}h${rd(w)}v${rd(h)}h${rd(-w)}z`;
const disc = (x: number, y: number, r: number, ry = r) => `M${rd(x - r)} ${rd(y)}a${rd(r)} ${rd(ry)} 0 1 0 ${rd(2 * r)} 0a${rd(r)} ${rd(ry)} 0 1 0 ${rd(-2 * r)} 0z`;
const trees = (pts: number[][], dark = '#5c8a44', light = '#7fab5f') => [
  { d: pts.map(([x, y, r]) => disc(x, y, r)).join(''), f: dark },
  { d: pts.map(([x, y, r]) => disc(x - r * .28, y - r * .28, r * .5)).join(''), f: light },
];
const LOT = 'M.9 .9h8.2v8.2H.9z';

/** Courbes de niveau (carrés marchants) d’un relief fait de bosses gaussiennes */
function isolines(peaks: number[][], levels: number[], size = 80, sigma = 5.6): string {
  const n = size + 1, f = new Float32Array(n * n), k = 1 / (2 * sigma * sigma);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let v = 0;
    for (const [px, py] of peaks) { const dx = i - px, dy = j - py; v += Math.exp(-(dx * dx + dy * dy) * k); }
    f[j * n + i] = v;
  }
  const o = (v: number) => Math.round(v * 10) / 10;
  let d = '';
  for (const L of levels) for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = f[j * n + i], b = f[j * n + i + 1], c = f[(j + 1) * n + i + 1], e = f[(j + 1) * n + i];
    const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (e > L ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const T = `${o(i + (L - a) / (b - a))} ${j}`, R = `${i + 1} ${o(j + (L - b) / (c - b))}`, B = `${o(i + (L - e) / (c - e))} ${j + 1}`, Lf = `${i} ${o(j + (L - a) / (e - a))}`;
    const seg = (p: string, q: string) => `M${p}L${q}`;
    switch (idx) {
      case 1: case 14: d += seg(Lf, B); break;
      case 2: case 13: d += seg(B, R); break;
      case 3: case 12: d += seg(Lf, R); break;
      case 4: case 11: d += seg(T, R); break;
      case 6: case 9: d += seg(T, B); break;
      case 7: case 8: d += seg(Lf, T); break;
      case 5: d += seg(T, R) + seg(Lf, B); break;
      case 10: d += seg(Lf, T) + seg(B, R); break;
    }
  }
  return d;
}

/* ── Les bâtiments, vus du ciel (10 × 10 unités = une parcelle) ── */

const BLD: Record<BKind, Part[]> = {
  logements: [
    { d: LOT, f: '#c9d6a9' }, { d: box(4.6, .9, .8, 8.2), f: '#e6dfcd' },
    { d: box(1.5, 1.6, 2.6, 3.1), f: '#b4633f' }, { d: box(2.8, 1.6, 1.3, 3.1), f: 'rgba(0,0,0,.2)' },
    { d: box(5.9, 1.6, 2.6, 3.1), f: '#a85d3d' }, { d: box(7.2, 1.6, 1.3, 3.1), f: 'rgba(0,0,0,.2)' },
    { d: box(1.5, 5.6, 2.6, 2.9), f: '#86837e' }, { d: box(2.8, 5.6, 1.3, 2.9), f: 'rgba(0,0,0,.2)' },
    { d: box(5.9, 5.6, 2.6, 2.9), f: '#b86a46' }, { d: box(7.2, 5.6, 1.3, 2.9), f: 'rgba(0,0,0,.2)' },
    ...trees([[4.2, 5.1, .45], [8.6, 8.6, .45]]),
  ],
  residence: [
    { d: LOT, f: '#cdd1c3' }, { d: box(5, 5, 4.1, 4.1), f: '#b6cd99' },
    { d: 'M1.2 1.2h7.6v3.3H4.6v4.4H1.2z', f: '#c4c9cd' }, { d: 'M1.65 1.65h6.7v2.4H4.15v4.4h-2.5z', f: '#b3babf' },
    { d: box(2.1, 2.1, 1.2, .9) + box(6.4, 2.2, 1.3, 1) + box(2.1, 6.4, 1, 1), f: '#8c9399' },
    ...trees([[6.4, 6.4, .95], [8, 8, .8], [8.1, 5.9, .6]]),
  ],
  ancien: [
    { d: LOT, f: '#dbd1c0' },
    { d: box(1.1, 1.1, 3.1, 2.4), f: '#a9654c' }, { d: box(4.4, 1.1, 2.1, 2.9), f: '#8e8781' }, { d: box(6.7, 1.1, 2.2, 2.1), f: '#b8785a' },
    { d: box(1.1, 3.8, 2.3, 2.6), f: '#9c5a43' }, { d: box(6.2, 3.4, 2.7, 2.5), f: '#c08868' }, { d: box(1.1, 6.7, 3.4, 2.2), f: '#7f7a74' },
    { d: box(4.9, 6.3, 2.2, 2.6), f: '#b06a4c' }, { d: box(7.3, 6.2, 1.6, 2.7), f: '#9a6650' },
    { d: 'M1.1 2.3h3.1M5.45 1.1v2.9M6.7 2.15h2.2M2.25 3.8v2.6M6.2 4.65h2.7M1.1 7.8h3.4M6 6.3v2.6M8.1 6.2v2.7', s: 'rgba(40,20,10,.35)', w: .16 },
    ...trees([[4.7, 5.1, .6]]),
  ],
  ecole: [
    { d: LOT, f: '#e6dab9' },
    { d: 'M1.2 1.2h7.6v7.6H6.3V3.6H3.7v5.2H1.2z', f: '#8c9fb3' }, { d: 'M1.2 2.25h7.6v.3H1.2zM2.3 3.6h.3v5.2h-.3zM7.4 3.6h.3v5.2h-.3z', f: 'rgba(0,0,0,.14)' },
    { d: box(4.05, 4.2, 1.9, 3.7), f: '#c98f62' }, { d: box(4.05, 4.2, 1.9, 3.7) + 'M4.05 6.05h1.9', s: '#f6f2e8', w: .16 },
    ...trees([[5, 8.55, .45]]),
  ],
  commerce: [
    { d: LOT, f: '#b3b1ab' },
    { d: box(1.2, 1.2, 7.6, 3.6), f: '#ddd6c8' }, { d: box(2, 2, 1, 1.8) + box(3.8, 2, 1, 1.8) + box(5.6, 2, 1, 1.8) + box(7.3, 2, .9, 1.8), f: '#a3b4c2' },
    { d: box(1.2, 4.8, 7.6, .55), f: '#b5443a' },
    { d: 'M1.7 6.1v2.6M3.1 6.1v2.6M4.5 6.1v2.6M5.9 6.1v2.6M7.3 6.1v2.6M8.7 6.1v2.6', s: '#f2f2ee', w: .16 },
    { d: box(2.05, 6.5, .7, 1.4) + box(6.25, 6.7, .7, 1.4), f: '#5d7590' }, { d: box(4.85, 6.4, .7, 1.4), f: '#b8473b' },
  ],
  usine: [
    { d: LOT, f: '#c2beb4' },
    { d: box(1.2, 1.2, 6, 6.4), f: '#a3a7aa' },
    { d: box(1.2, 2.2, 6, .55) + box(1.2, 3.6, 6, .55) + box(1.2, 5, 6, .55) + box(1.2, 6.4, 6, .55), f: '#7b8085' },
    { d: box(1.2, 1.75, 6, .3) + box(1.2, 3.15, 6, .3) + box(1.2, 4.55, 6, .3) + box(1.2, 5.95, 6, .3), f: '#c9d5de' },
    { d: box(7.6, 1.2, 1.3, 3), f: '#c9c3b7' }, { d: box(1.8, 8, 1.7, .65) + box(4, 8, 1.7, .65), f: '#e6e4de' },
    { d: disc(8.1, 7.6, .8), f: '#6b6560' }, { d: disc(8.1, 7.6, .42), f: '#2b2826' },
  ],
  parc: [
    { d: LOT, f: '#a8ca8d' },
    { d: 'M.9 6.6C3 5.6 4 3.1 6 2.4s2.6-.5 3.1-.8M4.4 9.1c.2-1.4 1-2.6 2.2-3.2', s: '#ece3c8', w: .55 },
    { d: disc(6.7, 7, 1.35, .95), f: '#8bb6cf' },
    ...trees([[2.2, 2.4, 1.1], [3.4, 7.7, 1], [1.7, 8.2, .75], [8, 4.7, .95], [7.9, 8.6, .55], [4.4, 4.7, .7], [6.8, 1.4, .5]]),
  ],
  tram: [],
  hopital: [
    { d: LOT, f: '#d2d5cb' },
    { d: box(1.3, 1.3, 2.5, 7.4) + box(6.2, 1.3, 2.5, 7.4) + box(3.8, 3.8, 2.4, 2.4), f: '#eef0ed' },
    { d: box(1.3, 1.3, 2.5, .3) + box(6.2, 1.3, 2.5, .3), f: 'rgba(0,0,0,.08)' },
    { d: disc(5, 2.45, .95), f: '#76838a' }, { d: 'M4.62 2v.9h.16v-.37h.44v.37h.16V2h-.16v.37h-.44V2z', f: '#fff' },
    { d: 'M2.25 4.55h.6v.6h.6v.6h-.6v.6h-.6v-.6h-.6v-.6h.6z', f: '#d23a32' },
    { d: box(4.3, 7.3, 1.4, .7), f: '#fff' }, { d: box(4.3, 7.55, 1.4, .2), f: '#d23a32' },
  ],
  fetes: [
    { d: LOT, f: '#ddd4c3' },
    { d: box(1.4, 1.5, 7.2, 4.5), f: '#b9a789' },
    { d: box(1.4, 2, 7.2, .5) + box(1.4, 3, 7.2, .6), f: 'rgba(255,255,255,.3)' },
    { d: box(1.4, 4.4, 7.2, .6) + box(1.4, 5.4, 7.2, .6), f: 'rgba(0,0,0,.15)' },
    { d: 'M2 7h6M2 8.4h6', s: '#c9bea8', w: .14 },
    ...trees([[2.2, 7.8, .7], [5, 7.9, .7], [7.8, 7.8, .7]]),
  ],
  solaire: [
    { d: LOT, f: '#c4d0a4' },
    { d: box(1.3, 1.4, 7.4, 1.3) + box(1.3, 3.4, 7.4, 1.3) + box(1.3, 5.4, 7.4, 1.3) + box(1.3, 7.4, 7.4, 1.3), f: '#2c4566' },
    { d: 'M3.15 1.4v1.3M5 1.4v1.3M6.85 1.4v1.3M3.15 3.4v1.3M5 3.4v1.3M6.85 3.4v1.3M3.15 5.4v1.3M5 5.4v1.3M6.85 5.4v1.3M3.15 7.4v1.3M5 7.4v1.3M6.85 7.4v1.3', s: '#58779e', w: .12 },
    { d: 'M1.3 1.5h7.4M1.3 3.5h7.4M1.3 5.5h7.4M1.3 7.5h7.4', s: '#8eaad0', w: .12 },
  ],
  epuration: [
    { d: LOT, f: '#cdcac0' },
    { d: disc(3.2, 3.2, 2.1) + disc(6.9, 6.9, 1.8), f: '#e0dcd2' }, { d: disc(3.2, 3.2, 1.72) + disc(6.9, 6.9, 1.45), f: '#6f9db2' },
    { d: 'M3.2 3.2h1.72M6.9 6.9h1.45', s: '#e0dcd2', w: .26 }, { d: disc(3.2, 3.2, .3) + disc(6.9, 6.9, .28), f: '#e0dcd2' },
    { d: box(5.6, 1.3, 3.1, 1.5) + box(5.6, 3.2, 3.1, 1.5), f: '#7aa3b6' }, { d: box(1.3, 6.2, 3, 2.5), f: '#bdb6a8' },
  ],
};
/** Ruines : murs effondrés, gravats */
const RUIN: Part[] = [
  { d: LOT, f: '#b9ae9d' },
  { d: 'M1.6 1.6h3.4v.5H2.1v2.4h-.5zM6 1.5h2.5v3h-.5V2h-2zM1.7 6.2h.5v2h2.6v.5H1.7zM6.2 6.4l2.3-.3.1.5-1.8.3.2 1.9-.5.1z', f: '#6c655c' },
  { d: disc(3.6, 3.7, .35) + disc(4.4, 4.8, .25) + disc(5.6, 4.2, .4) + disc(3.3, 5.5, .3) + disc(6.4, 5.4, .22) + disc(7.4, 7.6, .3) + disc(4.8, 7.4, .35), f: '#8c8273' },
  { d: disc(4.9, 3.4, .22) + disc(2.9, 4.6, .18) + disc(6.9, 3.6, .2) + disc(5.5, 6.6, .25), f: '#544d45' },
];
/** Silhouettes pour l’interface (24 × 24, au trait) */
const GLYPHS: Record<GlyphId, Part[]> = {
  people: [{ d: 'M9 4.5a3 3 0 1 1 0 6a3 3 0 0 1 0-6zM3 19.5c0-3.3 2.7-6 6-6s6 2.7 6 6v.5H3zM16.5 6.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5zM15.9 13.3c2.9.2 5.1 2.6 5.1 5.5V20h-4.4v-.5c0-2.4-.3-4.4-.7-6.2z', f: 'currentColor' }],
  jobs: [{ d: 'M3.5 8h17v11.5h-17zM9 8V5.5h6V8M3.5 13h17M11 12v2.2h2V12', s: 'currentColor', w: 1.6 }],
  euro: [{ d: 'M17.5 6.6A6.6 6.6 0 1 0 17.5 17.4M4.5 10.4h8.5M4.5 13.6h8.5', s: 'currentColor', w: 1.7 }],
  smog: [{ d: 'M3 8c2-1.3 4 1.3 6 0s4-1.3 6 0 4 1.3 6 0M3 12.5c2-1.3 4 1.3 6 0s4-1.3 6 0 4 1.3 6 0M3 17c2-1.3 4 1.3 6 0s4-1.3 6 0 4 1.3 6 0', s: 'currentColor', w: 1.6 }],
  target: [{ d: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9z', s: 'currentColor', w: 1.6 }, { d: disc(12, 12, 1.6), f: 'currentColor' }],
  crane: [{ d: 'M6 21V4M6 4h14M6 4l3.5 4.5M6 8.5h3.5M17 4v6M3.5 21h6', s: 'currentColor', w: 1.6 }, { d: box(15.2, 10, 3.6, 3), f: 'currentColor' }],
  dozer: [{ d: 'M4 8h6.2l1 4.2H17v4H4zM13.6 9.6h1v2.6h-1zM16.6 13.4l2.9-1.2.5 1.1-2.9 1.3zM19.4 10.2l2.4-.5c.4 2.2.4 7.4 0 11.6l-2.4.2c.5-3.6.5-7.6 0-11.3zM4.4 16.8h12.2a2.1 2.1 0 0 1 0 4.2H4.4a2.1 2.1 0 0 1 0-4.2z', f: 'currentColor' }],
  refresh: [{ d: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4', s: 'currentColor', w: 1.8 }],
  face1: [{ d: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM8 16.5c2.2-2.3 5.8-2.3 8 0', s: 'currentColor', w: 1.6 }, { d: disc(9, 10, 1.1) + disc(15, 10, 1.1), f: 'currentColor' }],
  face2: [{ d: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM8.2 15.5h7.6', s: 'currentColor', w: 1.6 }, { d: disc(9, 10, 1.1) + disc(15, 10, 1.1), f: 'currentColor' }],
  face3: [{ d: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM8.2 14.4c2.1 1.9 5.5 1.9 7.6 0', s: 'currentColor', w: 1.6 }, { d: disc(9, 10, 1.1) + disc(15, 10, 1.1), f: 'currentColor' }],
  face4: [{ d: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z', s: 'currentColor', w: 1.6 }, { d: 'M7.6 13.2h8.8a4.4 4.4 0 0 1-8.8 0z' + disc(9, 9.6, 1.1) + disc(15, 9.6, 1.1), f: 'currentColor' }],
  waves: [{ d: 'M3 8c2-1.4 4 1.4 6 0s4-1.4 6 0 4 1.4 6 0M3 13c2-1.4 4 1.4 6 0s4-1.4 6 0 4 1.4 6 0M3 18c2-1.4 4 1.4 6 0s4-1.4 6 0 4 1.4 6 0', s: 'currentColor', w: 1.7 }],
  rain: [{ d: 'M7 15.2a4.4 4.4 0 0 1-.7-8.8 6 6 0 0 1 11.4 1.7 3.6 3.6 0 0 1-.2 7.1z', f: 'currentColor' }, { d: 'M8 18l-1 2.6M12 18l-1 2.6M16 18l-1 2.6', s: 'currentColor', w: 1.6 }],
  factory: [{ d: 'M3 20.5V10l5 3v-3l5 3V7.5h3.5V3.5h2.5v17z', f: 'currentColor' }],
  megaphone: [{ d: 'M4 9.5v5h3l8 4.5V5L7 9.5zM18.2 9a4 4 0 0 1 0 6M7.5 14.5l1.2 5', s: 'currentColor', w: 1.7 }],
  doc: [{ d: 'M6 3h9l4 4v14H6zM15 3v4h4M9 11h7M9 14h7M9 17h5', s: 'currentColor', w: 1.6 }],
  crown: [{ d: 'M4 18.5h16M4.5 16.5L3 7.5l5 4 4-7 4 7 5-4-1.5 9z', s: 'currentColor', w: 1.6 }],
  heart: [{ d: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z', f: 'currentColor' }],
  snow: [{ d: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.8 4.8L12 6.5l2.2-1.7M9.8 19.2l2.2-1.7 2.2 1.7', s: 'currentColor', w: 1.6 }],
  stop: [{ d: disc(12, 12, 8), f: 'currentColor' }, { d: 'M8 12h8', s: '#fff', w: 2.4 }],
};
const GLYPH_LIST = (Object.keys(GLYPHS) as GlyphId[]).map(id => ({ id, parts: GLYPHS[id] }));
const BLD_LIST = (Object.keys(BLD) as BKind[]).filter(k => BLD[k].length).map(id => ({ id, parts: BLD[id] })).concat([{ id: 'ruine' as BKind, parts: RUIN }]);
const EV_GLYPH: Record<string, GlyphId> = { crue: 'waves', embacles: 'rain', usine: 'factory', subvention: 'euro', greve: 'megaphone', petition: 'doc', promoteur: 'crane', roi: 'crown', dons: 'heart', assureurs: 'doc', gel: 'snow' };

const BRIEF: Record<Variant, { title: string; brief: (c: City) => string; tip: string }> = {
  commune: { title: 'Moderniser la commune', tip: 'Le vieux centre étouffe près de l’usine : parcs, école et emplois feront remonter la satisfaction.',
    brief: c => `Fin de mandat dans ${c.years} ans : satisfaction ≥ ${c.satTarget} et budget positif. Visez aussi ${c.popTarget.toLocaleString('fr-FR')} habitants.` },
  nouvelle: { title: 'La ville nouvelle sur la Loire', tip: 'Gardez des quartiers séparés : une seule ligne de tram doit les longer tous.',
    brief: c => `Le grand chantier du roi : ${c.popTarget.toLocaleString('fr-FR')} habitants et une ligne de tram qui dessert ${c.dTarget} quartiers en ${c.years} ans.` },
  reconstruction: { title: 'Reconstruire après la crue', tip: 'Déblayez les ruines (bulldozer) avant de rebâtir ; on ne reconstruit plus en zone inondable.',
    brief: c => `Relogez tout le monde avant l’hiver (${c.popTarget.toLocaleString('fr-FR')} habitants) et videz la zone inondable de ses décombres, en ${c.years} mois.` },
};

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const sgn = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));
let fxId = 0;
let uidSeq = 0;

interface Plan {
  lots: string; lines: string; forest: string; hills: string; contours: string; index: string; peak: { x: number; y: number; label: string } | null;
  water: string; quays: string; river: string; flood: string; floodEdge: string;
  ballast: string; bridge: string; rails: string; sleepers: string; tramCar: string | null; blds: { i: number; k: string; x: number; y: number; fresh: boolean }[];
}

@Component({
  selector: 'app-urbanisme-game',
  template: `
    @let c = city();
    @let s = st();
    <div class="urb" [class]="'urb v-' + c.v">
      <svg class="defs" aria-hidden="true" focusable="false" width="0" height="0">
        <defs>
          @for (g of glyphs; track g.id) {
            <symbol [attr.id]="uid + '-g-' + g.id" viewBox="0 0 24 24">
              @for (p of g.parts; track $index) { <path [attr.d]="p.d" [attr.fill]="p.f ?? 'none'" [attr.stroke]="p.s ?? null" [attr.stroke-width]="p.w ?? null" stroke-linecap="round" stroke-linejoin="round" /> }
            </symbol>
          }
          @for (b of blds; track b.id) {
            <symbol [attr.id]="uid + '-b-' + b.id" viewBox="0 0 10 10">
              @for (p of b.parts; track $index) { <path [attr.d]="p.d" [attr.fill]="p.f ?? 'none'" [attr.stroke]="p.s ?? null" [attr.stroke-width]="p.w ?? null" stroke-linecap="round" /> }
            </symbol>
          }
          <filter [attr.id]="uid + '-shadow'" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx=".38" dy=".55" stdDeviation=".32" flood-color="#141a10" flood-opacity=".42" />
          </filter>
          <radialGradient [attr.id]="uid + '-crown'" cx=".5" cy=".5" r=".5" fx=".36" fy=".34">
            <stop offset="0" stop-color="#86ad62" /><stop offset=".6" stop-color="#557d3c" /><stop offset="1" stop-color="#3b5a2a" />
          </radialGradient>
          <pattern [attr.id]="uid + '-canopy'" patternUnits="userSpaceOnUse" width="6.6" height="6.6" patternTransform="rotate(19)">
            <rect width="6.6" height="6.6" fill="#3f5f2e" />
            @for (k of crowns; track $index) { <circle [attr.cx]="k[0]" [attr.cy]="k[1]" [attr.r]="k[2]" [attr.fill]="u('crown')" /> }
          </pattern>
          <pattern [attr.id]="uid + '-hatch'" patternUnits="userSpaceOnUse" width="1.9" height="1.9" patternTransform="rotate(-45)">
            <path d="M0 .95h1.9" stroke="#2f6fbf" stroke-opacity=".55" stroke-width=".32" />
          </pattern>
          <pattern [attr.id]="uid + '-ripple'" patternUnits="userSpaceOnUse" width="5" height="2.4" patternTransform="rotate(-12)">
            <path d="M.4 .7h1.6M2.8 1.8h1.5" stroke="#f3fbff" stroke-opacity=".45" stroke-width=".2" stroke-linecap="round" />
          </pattern>
        </defs>
      </svg>

      <div class="head">
        <span class="yr">{{ c.v === 'reconstruction' ? 'Mois' : 'Année' }} <b class="mono">{{ Math.min(c.year, c.years) }}</b>/{{ c.years }}</span>
        <span class="ttl">{{ title }}</span>
        <span class="works" [class.none]="!worksLeft()" aria-label="Chantiers restants cette année"><svg class="gi" aria-hidden="true"><use [attr.href]="g('crane')" /></svg>{{ worksLeft() }}/{{ c.works }}</span>
      </div>

      <div class="stats" role="list" aria-label="Indicateurs de la ville">
        <span class="st" role="listitem" [class.ok]="s.pop >= c.popTarget" [attr.aria-label]="'Habitants ' + s.pop + ' sur ' + c.popTarget">
          <svg class="gi" aria-hidden="true"><use [attr.href]="g('people')" /></svg><b class="mono">{{ fmt(s.pop) }}</b><small>/{{ fmt(c.popTarget) }}</small>
          @for (f of statFx('pop'); track f.id) { <em class="sfx" [class]="'sfx ' + f.tone">{{ f.text }}</em> }
        </span>
        <span class="st" role="listitem" [class.warn]="s.unemp > 0.12" [attr.aria-label]="'Emplois ' + s.jobs + ' pour ' + s.actifs + ' actifs'">
          <svg class="gi" aria-hidden="true"><use [attr.href]="g('jobs')" /></svg><b class="mono">{{ fmt(s.jobs) }}</b><small>{{ s.unemp > 0.005 ? 'chôm. ' + Math.round(s.unemp * 100) + ' %' : 'plein emploi' }}</small>
        </span>
        <span class="st" role="listitem" [class.bad]="c.budget < 0" [attr.aria-label]="'Budget ' + c.budget + ' millions, ' + s.income + ' par an'">
          <svg class="gi" aria-hidden="true"><use [attr.href]="g('euro')" /></svg><b class="mono">{{ fmt(c.budget) }}</b><small>{{ sgn(s.income) }}/{{ per }}</small>
          @for (f of statFx('budget'); track f.id) { <em class="sfx" [class]="'sfx ' + f.tone">{{ f.text }}</em> }
        </span>
        <button type="button" class="st tap" role="listitem" [class.ok]="c.v === 'commune' && s.sat >= c.satTarget" [class.bad]="s.sat < 40" [class.open]="satOpen()" (click)="toggleSat()"
                [attr.aria-pressed]="satOpen()" [attr.aria-label]="'Satisfaction ' + s.sat + ', touchez pour le détail'">
          <svg class="gi" aria-hidden="true"><use [attr.href]="g(face(s.sat))" /></svg><b class="mono">{{ s.sat }}</b><small>{{ c.v === 'commune' ? '/' + c.satTarget : 'satisf. ⓘ' }}</small>
          @for (f of statFx('sat'); track f.id) { <em class="sfx" [class]="'sfx ' + f.tone">{{ f.text }}</em> }
        </button>
        <span class="st" role="listitem" [class.bad]="s.poll >= 5" [attr.aria-label]="'Pollution ' + s.poll">
          <svg class="gi" aria-hidden="true"><use [attr.href]="g('smog')" /></svg><b class="mono">{{ s.poll }}</b><small>pollution</small>
        </span>
      </div>

      <p class="obj"><svg class="gi" aria-hidden="true"><use [attr.href]="g('target')" /></svg>{{ objText() }}</p>

      <div class="sheet-plan">
        <div class="board" role="grid" aria-label="Plan de la ville, 8 cases sur 8">
          @let pl = plan();
          <svg class="plan" viewBox="0 0 80 80" aria-hidden="true">
            <rect width="80" height="80" class="p-street" />
            <path class="p-lot" [attr.d]="pl.lots" />
            <path class="p-hill" [attr.d]="pl.hills" />
            <path class="p-contour" [attr.d]="pl.contours" /><path class="p-index" [attr.d]="pl.index" />
            @if (pl.peak; as pk) { <path class="p-peak" [attr.d]="'M' + pk.x + ' ' + (pk.y - .9) + 'l.8 1.3h-1.6z'" /><text class="p-peak-l" [attr.x]="pk.x + 1.2" [attr.y]="pk.y + .4">{{ pk.label }}</text> }
            <path [attr.d]="pl.forest" [attr.fill]="u('canopy')" class="p-forest" />
            <path class="p-cad" [attr.d]="pl.lines" />
            @if (pl.water) {
              <path class="p-water" [attr.d]="pl.water" />
              @if (pl.river) { <path class="p-deep" [attr.d]="pl.river" /> }
              <path [attr.d]="pl.water" [attr.fill]="u('ripple')" />
              <path class="p-quay" [attr.d]="pl.quays" />
            }
            @if (pl.flood) { <path [attr.d]="pl.flood" [attr.fill]="u('hatch')" /><path class="p-flood" [attr.d]="pl.floodEdge" /> }
            @if (pl.ballast) {
              <path class="p-bridge" [attr.d]="pl.bridge" /><path class="p-ballast" [attr.d]="pl.ballast" />
              <path class="p-sleeper" [attr.d]="pl.sleepers" /><path class="p-rail" [attr.d]="pl.rails" />
              @if (pl.tramCar) { <path class="p-tram" [attr.d]="pl.tramCar" /> }
            }
            <g [attr.filter]="u('shadow')">
              @for (b of pl.blds; track b.i + b.k) { <use [attr.href]="'#' + uid + '-b-' + b.k" [attr.x]="b.x" [attr.y]="b.y" width="10" height="10" [class.new]="b.fresh" /> }
            </g>
          </svg>
          <div class="cells">
            @for (cell of c.cells; track $index; let i = $index) {
              @let d = deltaAt(i);
              <button type="button" class="cell" [class]="'cell t-' + cell.t" [class.flood]="cell.flood" [class.ok]="validSet().has(i)" [class.no]="mode() && !validSet().has(i)"
                      [class.aim]="aim() === i" [class.look]="look() === i" [class.served]="servedSet().has(i)"
                      [disabled]="over() || !!event() || busy()" (click)="tap(i)" [attr.aria-label]="cellLabel(i)">
                @if (aim() === i) { @if (ghost(); as gk) { <svg class="ghost" viewBox="0 0 10 10" aria-hidden="true"><use [attr.href]="'#' + uid + '-b-' + gk" width="10" height="10" /></svg> } }
                @if (d !== null) { <i class="dq" [class.pos]="d > 0" [class.neg]="d < 0" [class.own]="aim() === i">{{ sgn(d) }}</i> }
                @for (f of fxAt(i); track f.id) { <span class="fx" [class]="'fx ' + f.tone">{{ f.text }}</span> }
              </button>
            }
          </div>
        </div>
        <div class="plan-foot" aria-hidden="true">
          <span class="north">N</span>
          <span class="scale"><i></i><i></i><small>100 m</small></span>
          <span class="key"><i class="k-flood"></i>Zone inondable</span>
          @if (c.v === 'nouvelle') { <span class="key"><i class="k-stop"></i>Quartier desservi</span> }
        </div>
      </div>

      <div class="panel" aria-live="polite">
        @if (over()) {
          @let sc = final();
          @if (sc) {
            <div class="sum">
              <p class="verdict"><b>{{ message() }}</b></p>
              <div class="bars">
                <span><svg class="gi" aria-hidden="true"><use [attr.href]="g('people')" /></svg>Population</span><span class="bar"><span [style.width.%]="sc.popC * 100"></span></span><b class="mono">{{ Math.round(sc.popC * 100) }}</b>
                <span><svg class="gi" aria-hidden="true"><use [attr.href]="g('face3')" /></svg>Satisfaction</span><span class="bar"><span [style.width.%]="sc.satC * 100"></span></span><b class="mono">{{ Math.round(sc.satC * 100) }}</b>
                <span><svg class="gi" aria-hidden="true"><use [attr.href]="g('euro')" /></svg>Finances</span><span class="bar"><span [style.width.%]="sc.budC * 100"></span></span><b class="mono">{{ Math.round(sc.budC * 100) }}</b>
                <span><svg class="gi" aria-hidden="true"><use [attr.href]="g('target')" /></svg>Objectif</span><span class="bar"><span [style.width.%]="sc.objC * 100"></span></span><b class="mono">{{ Math.round(sc.objC * 100) }}</b>
              </div>
              <p class="small muted">{{ built() }} chantiers menés · {{ fmt(sc.s.pop) }} habitants · {{ sc.s.sat }} de satisfaction · {{ fmt(c.budget) }} M€ en caisse@if (c.v === 'nouvelle') { · {{ sc.s.served }} quartier{{ sc.s.served > 1 ? 's' : '' }} desservi{{ sc.s.served > 1 ? 's' : '' }} }</p>
            </div>
          }
        } @else if (event(); as e) {
          <div class="event" role="dialog" [attr.aria-label]="e.title">
            <p class="ev-t"><svg class="ev-i" aria-hidden="true"><use [attr.href]="g(evGlyph(e.id))" /></svg><span><small>Arrêté du maire · affaire à trancher</small><b>{{ e.title }}</b></span></p>
            <p class="small">{{ e.text }}</p>
            <div class="ev-o">
              @for (o of e.opts; track $index) {
                <button type="button" class="btn opt" (click)="choose(o)"><b>{{ o.label }}</b><small>{{ o.hint }}</small></button>
              }
            </div>
          </div>
        } @else {
          @if (preview(); as p) {
            <div class="prev" [class.err]="p.err">
              @if (p.err) { <span class="pv"><svg class="gi" aria-hidden="true"><use [attr.href]="g('stop')" /></svg>{{ p.err }}</span> }
              @else {
                <span class="pv">
                  @if (mode() === 'clear') { <b><svg class="gi" aria-hidden="true"><use [attr.href]="g('dozer')" /></svg>{{ c.cells[p.i].t === 'ruine' ? 'Déblayer' : 'Démolir' }}</b> }
                  @else { <b><svg class="thumb" viewBox="0 0 10 10" aria-hidden="true"><use [attr.href]="'#' + uid + '-b-' + selCard()!.k" width="10" height="10" /></svg>{{ name(selCard()!.k) }}</b> }
                  <span class="mono">{{ p.cost ? '−' + fmt(p.cost) + ' M€' : 'gratuit' }}</span>
                  @if (p.dPop) { <span [class]="p.dPop > 0 ? 'g' : 'r'"><svg class="gi" aria-hidden="true"><use [attr.href]="g('people')" /></svg>{{ sgn(p.dPop) }}</span> }
                  @if (p.dJobs) { <span [class]="p.dJobs > 0 ? 'g' : 'r'"><svg class="gi" aria-hidden="true"><use [attr.href]="g('jobs')" /></svg>{{ sgn(p.dJobs) }}</span> }
                  <span [class]="p.dSat > 0 ? 'g' : p.dSat < 0 ? 'r' : ''"><svg class="gi" aria-hidden="true"><use [attr.href]="g('face3')" /></svg>{{ sgn(p.dSat) }}</span>
                  @if (p.dInc) { <span [class]="p.dInc > 0 ? 'g' : 'r'"><svg class="gi" aria-hidden="true"><use [attr.href]="g('euro')" /></svg>{{ sgn(p.dInc) }}/an</span> }
                  @if (p.dPoll) { <span [class]="p.dPoll < 0 ? 'g' : 'r'"><svg class="gi" aria-hidden="true"><use [attr.href]="g('smog')" /></svg>{{ sgn(p.dPoll) }}</span> }
                </span>
                @for (n of p.notes; track $index) { <small class="note">{{ n }}</small> }
                <span class="go"><small>Touchez à nouveau la case, ou</small> <button type="button" class="btn primary small" (click)="confirm()">Construire</button></span>
              }
            </div>
          } @else if (selCard(); as k) {
            <p class="rule"><b><svg class="thumb" viewBox="0 0 10 10" aria-hidden="true"><use [attr.href]="'#' + uid + '-b-' + k.k" width="10" height="10" /></svg>{{ name(k.k) }}@if (k.free) { · offert }@if (k.segs) { · {{ k.segs }} tronçon{{ k.segs > 1 ? 's' : '' }} restant{{ k.segs > 1 ? 's' : '' }} }</b> — {{ rule(k.k) }}</p>
          } @else if (mode() === 'clear') {
            <p class="rule"><b><svg class="gi" aria-hidden="true"><use [attr.href]="g('dozer')" /></svg>Déblayer / démolir</b> — ruines : {{ c.freeClears ? 'gratuit (' + c.freeClears + ' bénévoles)' : '2 M€' }} ; bâtiment : 1 M€. Trois par an, sans compter les chantiers.</p>
          } @else if (satOpen()) {
            <div class="insp">
              <b><svg class="gi" aria-hidden="true"><use [attr.href]="g(face(s.sat))" /></svg>Satisfaction {{ s.sat }} : d’où vient-elle ?</b>
              <span class="parts">@for (pt of s.satParts; track $index) { <span [class]="$index === 0 ? '' : pt.v > 0 ? 'g' : 'r'">{{ pt.label }} {{ $index === 0 ? pt.v : sgn(pt.v) }}</span> }</span>
              <small class="muted">Actifs : {{ fmt(s.actifs) }} pour {{ fmt(s.jobs) }} emplois (dont {{ c.extJobs }} dans le bassin)@if (s.demand) {<span> · logements attendus : {{ fmt(s.demand) }}</span>}</small>
            </div>
          } @else if (look() !== null) {
            @let li = look()!;
            <div class="insp">
              <b>@if (c.cells[li].b) { <svg class="thumb" viewBox="0 0 10 10" aria-hidden="true"><use [attr.href]="'#' + uid + '-b-' + c.cells[li].b" width="10" height="10" /></svg>{{ name(c.cells[li].b!) }} } @else { {{ terrainLabel(li) }} }@if (c.cells[li].flood) { · zone inondable }</b>
              @if (inspect(); as parts) {
                <span class="parts">
                  @for (pt of parts; track $index) { <span [class]="pt.v > 0 ? 'g' : 'r'">{{ pt.label }} {{ sgn(pt.v) }}</span> } @empty { <span class="muted">Cadre de vie neutre</span> }
                </span>
              } @else if (c.cells[li].b) { <small class="muted">{{ cellInfo(li) }}{{ rule(c.cells[li].b!) }}</small> }
            </div>
          } @else {
            <p class="rule muted">{{ tip }} Touchez un projet, puis une case pour voir l’effet ; touchez-la encore pour bâtir. Touchez un bâtiment pour l’inspecter.</p>
          }
          <div class="hand" [style.--n]="c.handSize" role="toolbar" aria-label="Projets de l’année">
            @for (k of hand(); track k.id; let h = $index) {
              <button type="button" class="card" [class]="'card c-' + cat(k.k)" [class.on]="mode() === 'card' && sel() === h" [class.free]="k.free" [disabled]="cardOff(k) || busy()"
                      (click)="pick(h)" [attr.aria-pressed]="mode() === 'card' && sel() === h" [attr.aria-label]="name(k.k) + ', ' + (k.free ? 'offert' : cost(k.k) + ' millions')">
                <span class="pc"><span>{{ k.free ? 'Offert' : 'Permis' }}</span><span class="mono">n° {{ permit(k.id) }}</span></span>
                <svg class="ci" viewBox="0 0 10 10" aria-hidden="true">
                  <rect width="10" height="10" class="ci-bg" />
                  @if (k.k === 'tram') { <path class="ci-ballast" d="M0 5h10" /><path class="ci-sleeper" d="M0 5h10" /><path class="ci-rail" d="M0 4.3h10M0 5.7h10" /><path class="p-tram" d="M2.6 4.1h4.8a.9.9 0 0 1 0 1.8H2.6a.9.9 0 0 1 0-1.8z" /> }
                  @else { <use [attr.href]="'#' + uid + '-b-' + k.k" width="10" height="10" /> }
                </svg>
                <span class="cn">{{ name(k.k) }}</span>
                <span class="cc mono">{{ k.free ? 'offert' : cost(k.k) + ' M€' + (k.segs ? ' ×' + k.segs : '') }}</span>
                <span class="ct">{{ tag(k.k) }}</span>
              </button>
            } @empty { <p class="small muted">Plus de projets cette année.</p> }
          </div>
          <div class="tools">
            <button type="button" class="btn small" [class.on]="mode() === 'clear'" [disabled]="clears() >= 3 || busy()" (click)="tool()" [attr.aria-pressed]="mode() === 'clear'"><svg class="gi" aria-hidden="true"><use [attr.href]="g('dozer')" /></svg>Déblayer ({{ 3 - clears() }})</button>
            <button type="button" class="btn small" [disabled]="redrawn() || c.budget < 1 || busy() || placed() > 0" (click)="redraw()"><svg class="gi" aria-hidden="true"><use [attr.href]="g('refresh')" /></svg>Autres projets (1 M€)</button>
            <button type="button" class="btn primary small end" [disabled]="busy()" (click)="endTurn()">{{ c.year >= c.years ? 'Bilan du mandat' : (c.v === 'reconstruction' ? 'Mois suivant' : 'Année suivante') }} →</button>
          </div>
        }
      </div>

      <ul class="log">@for (l of log(); track $index) { <li>{{ l }}</li> }</ul>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%;
      /* Le plan : des teintes de papier, assombries d’elles-mêmes en thème sombre */
      --p-street: color-mix(in srgb, #ebe7dd 84%, var(--surface));
      --p-lot: color-mix(in srgb, #dde2c9 86%, var(--surface));
      --p-cad: color-mix(in srgb, #a9ab95 80%, var(--surface));
      --p-frame: color-mix(in srgb, #6f6a5c 70%, var(--surface)); }
    .urb { display: grid; gap: 7px; font-size: 13px; }
    .defs { position: absolute; width: 0; height: 0; overflow: hidden; }
    .gi { width: 15px; height: 15px; flex: none; vertical-align: -3px; }
    .head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: space-between; font-size: 12.5px; }
    .ttl { font-weight: 600; color: var(--ink-2); flex: 1; text-align: center; min-width: 0; }
    .works { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; padding: 2px 8px; border-radius: 999px; background: var(--good-soft); color: var(--good); &.none { background: var(--surface-2); color: var(--ink-3); } .gi { width: 14px; height: 14px; } }
    .stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; }
    .st.tap { font: inherit; color: inherit; cursor: pointer; &.open { box-shadow: 0 0 0 2px var(--accent); } }
    .st { position: relative; display: grid; justify-items: center; gap: 1px; padding: 5px 2px 4px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--line); line-height: 1.15; min-width: 0;
      .gi { width: 16px; height: 16px; color: var(--ink-2); } b { font-size: 13.5px; }
      small { font-size: 9.5px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
      &.ok { border-color: var(--good); background: var(--good-soft); .gi { color: var(--good); } } &.bad { border-color: var(--bad); background: var(--bad-soft); .gi { color: var(--bad); } } &.warn small { color: var(--bad); } }
    .sfx { position: absolute; top: 45%; left: 50%; transform: translateX(-50%); font: 800 12px var(--font-body); font-style: normal; white-space: nowrap; pointer-events: none; animation: rise 1.3s ease forwards; z-index: 4;
      &.good { color: var(--good); } &.bad { color: var(--bad); } &.info { color: var(--ink-2); } }
    .obj { margin: 0; font-size: 12px; color: var(--ink-2); display: flex; gap: 5px; align-items: flex-start; .gi { margin-top: 1px; color: var(--accent); } }
    /* La planche du plan */
    .sheet-plan { justify-self: center; width: 100%; max-width: 460px; display: grid; gap: 3px; padding: 5px; border-radius: 6px; background: var(--p-street); border: 1px solid var(--p-frame);
      box-shadow: 0 1px 0 rgba(255,255,255,.4) inset, 0 6px 16px -10px rgba(0,0,0,.45); }
    .board { position: relative; width: 100%; aspect-ratio: 1; user-select: none; touch-action: manipulation; outline: 1px solid var(--p-frame); }
    .plan { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .p-street { fill: var(--p-street); }
    .p-lot { fill: var(--p-lot); stroke: var(--p-cad); stroke-width: .16; }
    .p-cad { fill: none; stroke: var(--p-cad); stroke-width: .12; stroke-dasharray: .6 .35; }
    .p-hill { fill: color-mix(in srgb, #e3d7a8 80%, var(--surface)); stroke: var(--p-cad); stroke-width: .16; }
    .p-contour { fill: none; stroke: #9a7a45; stroke-opacity: .6; stroke-width: .14; }
    .p-index { fill: none; stroke: #8a6a38; stroke-opacity: .75; stroke-width: .26; }
    .p-peak { fill: #6d5530; } .p-peak-l { font: 600 2.1px var(--font-mono); fill: #6d5530; paint-order: stroke; stroke: var(--p-lot); stroke-width: .5px; }
    .p-forest { stroke: #3b5a2a; stroke-width: .15; }
    .p-water { fill: color-mix(in srgb, #8db7d3 88%, var(--surface)); }
    .p-deep { fill: none; stroke: color-mix(in srgb, #6f9fc2 88%, var(--surface)); stroke-width: 4.2; stroke-linecap: round; stroke-linejoin: round; opacity: .8; }
    .p-quay { fill: none; stroke: #8f887a; stroke-width: .9; stroke-linecap: square; }
    .p-flood { fill: none; stroke: #2f6fbf; stroke-width: .3; stroke-dasharray: 1 .6; }
    .p-bridge { fill: none; stroke: #8b8579; stroke-width: 4.6; } .p-bridge { stroke-linecap: butt; }
    .p-ballast { fill: none; stroke: #b4ada0; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .p-sleeper { fill: none; stroke: #7d756a; stroke-width: 2.1; stroke-dasharray: .25 .55; }
    .p-rail { fill: none; stroke: #4a4640; stroke-width: .22; stroke-linejoin: round; }
    .p-tram { fill: #f4f2ee; stroke: #c23a32; stroke-width: .35; }
    .plan use.new { animation: drop .45s cubic-bezier(.2, 1.4, .4, 1) both; transform-box: fill-box; transform-origin: center; }
    @keyframes drop { from { transform: translateY(-3px) scale(.6); opacity: 0; } }
    .plan-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; font: 600 9.5px var(--font-body); color: var(--ink-2); padding: 0 2px;
      .north { display: inline-grid; place-items: center; width: 15px; height: 15px; border-radius: 50%; border: 1px solid var(--ink-3); font-size: 8.5px; position: relative; }
      .north::before { content: ''; position: absolute; top: -4px; border: 3px solid transparent; border-bottom: 4px solid var(--ink-2); border-top: 0; }
      .scale { display: inline-flex; align-items: center; gap: 0; i { width: 18px; height: 4px; border: 1px solid var(--ink-2); } i:first-child { background: var(--ink-2); } small { margin-left: 4px; font-size: 9.5px; } }
      .key { display: inline-flex; align-items: center; gap: 4px; font-weight: 500; }
      .k-flood { width: 12px; height: 9px; border: 1px dashed #2f6fbf; background: repeating-linear-gradient(-45deg, transparent 0 2px, rgba(47,111,191,.55) 2px 3px); }
      .k-stop { width: 8px; height: 8px; border-radius: 50%; background: #fff; border: 2px solid #c23a32; } }
    .cells { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr); }
    .cell { position: relative; min-width: 0; min-height: 32px; border: 0; border-radius: 2px; padding: 0; cursor: pointer; background: transparent; display: grid; place-items: center; overflow: visible;
      -webkit-tap-highlight-color: transparent;
      &:hover:not(:disabled) { box-shadow: inset 0 0 0 1px rgba(30, 40, 30, .45); }
      &:disabled { cursor: default; } &:focus-visible { outline: 3px solid #f4b400; outline-offset: -3px; z-index: 2; } }
    .cell.no { background: rgba(28, 32, 26, .32); }
    .cell.ok { box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, .95), inset 0 0 0 2.5px rgba(31, 59, 115, .45); }
    .cell.aim { box-shadow: inset 0 0 0 3px #f4b400; z-index: 2; }
    .cell.look { box-shadow: inset 0 0 0 2.5px #fff, inset 0 0 0 3.5px rgba(0,0,0,.3); z-index: 2; }
    .cell.served::after { content: ''; position: absolute; left: 3px; bottom: 3px; width: 7px; height: 7px; border-radius: 50%; background: #fff; border: 2px solid #c23a32; box-sizing: border-box; }
    .ghost { position: absolute; inset: 0; width: 100%; height: 100%; opacity: .78; outline: 2px dashed #f4b400; outline-offset: -3px; border-radius: 2px; pointer-events: none; }
    .dq { position: absolute; z-index: 3; top: -5px; right: -4px; min-width: 18px; padding: 1px 3px; border-radius: 8px; font: 800 10.5px/1.2 var(--font-body); font-style: normal; color: #fff; text-align: center; pointer-events: none;
      box-shadow: 0 1px 2px rgba(0,0,0,.35);
      &.pos { background: #2f8f57; } &.neg { background: #c8432f; } &.own { top: auto; bottom: -5px; right: auto; left: -4px; outline: 2px solid #f4b400; } }
    .fx { position: absolute; z-index: 5; top: -6px; font: 800 12px var(--font-body); white-space: nowrap; pointer-events: none; animation: rise 1.1s ease forwards; text-shadow: 0 1px 2px #000;
      &.good { color: #b7f5c6; } &.bad { color: #ffb3a6; } &.info { color: #fff; } }
    @keyframes rise { to { transform: translate(-50%, -22px); opacity: 0; } }
    .fx { left: 50%; transform: translateX(-50%); }
    .panel { display: grid; gap: 6px; min-height: 120px; }
    .rule { margin: 0; font-size: 12px; color: var(--ink-2); b { color: var(--ink); } }
    .thumb { width: 18px; height: 18px; vertical-align: -4px; margin-right: 4px; border-radius: 2px; outline: 1px solid var(--line); }
    .rule .gi, .insp .gi, .prev .gi { margin-right: 3px; }
    .prev { display: grid; gap: 4px; padding: 7px 9px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--line); font-size: 12px;
      &.err { background: var(--bad-soft); color: var(--bad); border-color: transparent; } }
    .pv { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; > span { display: inline-flex; align-items: center; gap: 2px; } .gi { width: 14px; height: 14px; } }
    .g { color: var(--good); font-weight: 600; } .r { color: var(--bad); font-weight: 600; }
    .note { color: var(--ink-2); font-size: 11.5px; }
    .go { display: flex; align-items: center; justify-content: flex-end; gap: 8px; small { color: var(--ink-3); } }
    .insp { display: grid; gap: 4px; padding: 7px 9px; border-radius: 10px; background: var(--surface-2); font-size: 12px; }
    .parts { display: flex; flex-wrap: wrap; gap: 3px 10px; font-size: 11.5px; }
    /* Les projets : des permis de construire */
    .hand { display: grid; grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr)); gap: 5px; }
    .card { --cat: #8a7f6c; position: relative; display: grid; justify-items: center; align-content: start; gap: 2px; padding: 0 4px 6px; min-height: 76px; border-radius: 6px; border: 1px solid var(--line); border-top: 3px solid var(--cat);
      background: var(--surface); cursor: pointer; color: var(--ink); font: inherit; overflow: hidden; transition: transform .15s ease, box-shadow .15s ease;
      box-shadow: 0 1px 0 rgba(0,0,0,.04);
      &.c-hab { --cat: #b4633f; } &.c-srv { --cat: #4f7cad; } &.c-eco { --cat: #7b7f86; } &.c-vert { --cat: #4f8a3f; } &.c-tram { --cat: #c23a32; }
      &.on { border-color: var(--accent); border-top-color: var(--cat); box-shadow: 0 0 0 2px var(--accent); transform: translateY(-2px); }
      &.free { background: var(--good-soft); }
      &:disabled { opacity: .45; cursor: not-allowed; }
      .pc { display: flex; justify-content: space-between; width: calc(100% + 8px); margin: 0 -4px 2px; padding: 2px 5px; font: 600 8.5px var(--font-body); letter-spacing: .06em; text-transform: uppercase;
        color: var(--ink-3); border-bottom: 1px dashed var(--line); .mono { letter-spacing: 0; text-transform: none; } }
      .ci { width: 34px; height: 34px; border-radius: 3px; outline: 1px solid color-mix(in srgb, var(--cat) 45%, transparent); }
      .cn { font-size: 11.5px; font-weight: 600; text-align: center; line-height: 1.15; }
      .cc { font-size: 11px; color: var(--accent); } .ct { font-size: 10px; color: var(--ink-3); text-align: center; } }
    .ci-bg { fill: var(--p-lot); }
    .ci-ballast { stroke: #b4ada0; stroke-width: 3; } .ci-sleeper { stroke: #7d756a; stroke-width: 2.1; stroke-dasharray: .25 .55; } .ci-rail { stroke: #4a4640; stroke-width: .22; }
    .tools { display: flex; flex-wrap: wrap; gap: 6px; .end { margin-left: auto; } .btn { min-height: 34px; display: inline-flex; align-items: center; gap: 5px; } .on { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); } }
    .event { display: grid; gap: 6px; padding: 10px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--line); border-left: 4px solid var(--accent); animation: pop .3s ease both; }
    .ev-t { margin: 0; font-size: 14px; display: flex; gap: 9px; align-items: center; span { display: grid; } small { font: 600 9.5px var(--font-body); letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); } }
    .ev-i { width: 30px; height: 30px; flex: none; padding: 5px; border-radius: 50%; color: var(--accent); background: var(--accent-soft, var(--surface)); border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); }
    .ev-o { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 6px; }
    .opt { display: grid; gap: 2px; text-align: left; min-height: 48px; small { color: var(--ink-3); font-size: 11px; } }
    @keyframes pop { from { transform: scale(.95); opacity: 0; } }
    .sum { display: grid; gap: 8px; }
    .verdict { margin: 0; font-size: 14px; }
    .bars { display: grid; grid-template-columns: auto 1fr 28px; gap: 5px 8px; align-items: center; font-size: 12px; b { text-align: right; } > span:nth-child(3n + 1) { display: inline-flex; align-items: center; gap: 4px; } }
    .small { font-size: 12px; margin: 0; }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 76px; overflow: auto; font-size: 11.5px; color: var(--ink-2); }
    @media (max-width: 400px) { .stats small { font-size: 8.5px; } .card .ct { display: none; } .card .pc { font-size: 7.5px; } }
    @media (prefers-reduced-motion: reduce) { .plan use.new, .fx, .sfx, .event, .card { animation: none; transition: none; } .card.on { transform: none; } }
  `,
})
export class UrbanismeGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly Math = Math;
  protected readonly fmt = fmt;
  protected readonly sgn = sgn;
  protected readonly uid = `ub${++uidSeq}`;
  protected readonly glyphs = GLYPH_LIST;
  protected readonly blds = BLD_LIST;
  protected readonly crowns = [[1.3, 1.4, 1.2], [4.2, 1.1, 1], [5.6, 3.4, 1.1], [2.4, 4, 1.15], [1, 6, .8], [4.4, 5.8, .9]];
  protected title = '';
  protected tip = '';
  protected per = 'an';
  protected readonly satOpen = signal(false);

  protected readonly city = signal<City>(newCity('commune', 1, Math.random));
  protected readonly hand = signal<Card[]>([]);
  protected readonly sel = signal<number | null>(null);
  protected readonly mode = signal<'card' | 'clear' | null>(null);
  protected readonly aim = signal<number | null>(null);
  protected readonly look = signal<number | null>(null);
  protected readonly placed = signal(0);
  protected readonly clears = signal(0);
  protected readonly redrawn = signal(false);
  protected readonly built = signal(0);
  protected readonly event = signal<CityEvent | null>(null);
  protected readonly over = signal(false);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly final = signal<Score | null>(null);
  protected readonly log = signal<string[]>([]);
  protected readonly fx = signal<Fx[]>([]);
  protected readonly sfx = signal<(Fx & { k: string })[]>([]);
  private readonly rnd: Rnd = Math.random;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private lowSatWarned = 0;

  protected readonly st = computed(() => stats(this.city()));
  protected readonly selCard = computed(() => (this.mode() === 'card' && this.sel() !== null ? this.hand()[this.sel()!] ?? null : null));
  protected readonly worksLeft = computed(() => Math.max(0, this.city().works - this.placed()));
  protected readonly ghost = computed(() => (this.preview() && !this.preview()!.err ? this.selCard()?.k ?? null : null));

  /** Le plan masse, recalculé à chaque changement de la ville */
  protected readonly plan = computed<Plan>(() => {
    const c = this.city(), cells = c.cells;
    const X = (i: number) => (i % W) * 10, Y = (i: number) => Math.floor(i / W) * 10;
    const isRiver = (i: number) => cells[i].t === 'riviere';
    const lot = (i: number, p = 0.7) => box(X(i) + p, Y(i) + p, 10 - 2 * p, 10 - 2 * p);
    const pl: Plan = { lots: '', lines: '', forest: '', hills: '', contours: '', index: '', peak: null, water: '', quays: '', river: '', flood: '', floodEdge: '', ballast: '', bridge: '', rails: '', sleepers: '', tramCar: null, blds: [] };
    const peaks: number[][] = [];
    const h = (i: number, k: number) => { const t = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return t - Math.floor(t); };
    cells.forEach((cell, i) => {
      if (isRiver(i)) return;
      pl.lots += lot(i);
      if (cell.t === 'foret') pl.forest += lot(i, 0.45);
      if (cell.t === 'colline') { pl.hills += lot(i); peaks.push([X(i) + 5 + (h(i, 1) - .5) * 2, Y(i) + 5 + (h(i, 2) - .5) * 2]); }
      // Le cadastre : des parcelles libres découpées en lots
      if (!cell.b && cell.t === 'plaine') {
        const v = h(i, 3) < 0.5, at = 3.4 + h(i, 4) * 3.2;
        pl.lines += v ? `M${rd(X(i) + at)} ${Y(i) + .7}v8.6` : `M${X(i) + .7} ${rd(Y(i) + at)}h8.6`;
      }
      if (cell.b && cell.b !== 'tram') pl.blds.push({ i, k: cell.b, x: X(i), y: Y(i), fresh: !!cell.fresh });
      else if (cell.t === 'ruine') pl.blds.push({ i, k: 'ruine', x: X(i), y: Y(i), fresh: false });
    });
    // Le relief : courbes de niveau tous les 10 m, courbe maîtresse, point coté
    if (peaks.length) {
      pl.contours = isolines(peaks, [0.25, 0.5, 0.75, 1.25, 1.5, 1.75]);
      pl.index = isolines(peaks, [1]);
      let best = 0, bx = 0, by = 0;
      for (const [px, py] of peaks) {
        const v = peaks.reduce((t, [qx, qy]) => t + Math.exp(-((px - qx) ** 2 + (py - qy) ** 2) / (2 * 5.6 * 5.6)), 0);
        if (v > best) { best = v; bx = px; by = py; }
      }
      pl.peak = { x: rd(bx), y: rd(by), label: `${Math.round(140 + best * 26)} m` };
    }
    // La rivière : le lit en eau, ses quais, et le chenal le plus long en courbe douce
    const riv = cells.map((x, i) => (isRiver(i) ? i : -1)).filter(i => i >= 0);
    if (riv.length) {
      const horiz = c.v === 'nouvelle';
      riv.forEach(i => {
        pl.water += box(X(i), Y(i), 10, 10);
        const x = i % W, y = Math.floor(i / W);
        if (y > 0 && !isRiver(i - W)) pl.quays += `M${X(i)} ${Y(i)}h10`;
        if (y < W - 1 && !isRiver(i + W)) pl.quays += `M${X(i)} ${Y(i) + 10}h10`;
        if (x > 0 && !isRiver(i - 1)) pl.quays += `M${X(i)} ${Y(i)}v10`;
        if (x < W - 1 && !isRiver(i + 1)) pl.quays += `M${X(i) + 10} ${Y(i)}v10`;
      });
      const entry = (i: number) => (horiz ? i % W === 0 : i < W), exit = (i: number) => (horiz ? i % W === W - 1 : i >= W * (W - 1));
      let order: number[] = [];
      const walk = (path: number[]) => {
        const last = path[path.length - 1];
        if (exit(last) && path.length > order.length) order = [...path];
        for (const j of N4[last]) if (isRiver(j) && !path.includes(j)) { path.push(j); walk(path); path.pop(); }
      };
      for (const s0 of riv.filter(entry)) walk([s0]);
      if (!order.length) order = riv;
      const pts = order.map(i => [X(i) + 5, Y(i) + 5]);
      pts.unshift(horiz ? [pts[0][0] - 10, pts[0][1]] : [pts[0][0], pts[0][1] - 10]);
      const e = pts[pts.length - 1];
      pts.push(horiz ? [e[0] + 10, e[1]] : [e[0], e[1] + 10]);
      let d = `M${pts[0][0]} ${pts[0][1]}`;
      for (let k = 1; k < pts.length - 1; k++) d += `Q${pts[k][0]} ${pts[k][1]} ${(pts[k][0] + pts[k + 1][0]) / 2} ${(pts[k][1] + pts[k + 1][1]) / 2}`;
      pl.river = d + `L${e[0] + (horiz ? 10 : 0)} ${e[1] + (horiz ? 0 : 10)}`;
    }
    // Zone inondable : hachures bleues et limite en tirets, comme sur un PPRI
    const fl = (i: number) => cells[i].flood && !isRiver(i);
    cells.forEach((cell, i) => {
      if (!fl(i)) return;
      pl.flood += box(X(i), Y(i), 10, 10);
      const x = i % W, y = Math.floor(i / W);
      if (y === 0 || (!fl(i - W) && !isRiver(i - W))) pl.floodEdge += `M${X(i)} ${Y(i) + .3}h10`;
      if (y === W - 1 || (!fl(i + W) && !isRiver(i + W))) pl.floodEdge += `M${X(i)} ${Y(i) + 9.7}h10`;
      if (x === 0 || (!fl(i - 1) && !isRiver(i - 1))) pl.floodEdge += `M${X(i) + .3} ${Y(i)}v10`;
      if (x === W - 1 || (!fl(i + 1) && !isRiver(i + 1))) pl.floodEdge += `M${X(i) + 9.7} ${Y(i)}v10`;
    });
    // Le tram : ballast, traverses, rails ; un pont pour franchir l’eau ; une rame en ligne
    const tram = (i: number) => cells[i].b === 'tram';
    const seg: string[] = [];
    cells.forEach((cell, i) => {
      if (!tram(i)) return;
      const cx = X(i) + 5, cy = Y(i) + 5;
      const ns = N4[i].filter(tram);
      if (!ns.length) seg.push(`M${cx - 5} ${cy}h10`);
      for (const j of ns) if (j > i) seg.push(j === i + 1 ? `M${cx} ${cy}h10` : `M${cx} ${cy}v10`);
      if (ns.length === 1) {
        const j = ns[0], dx = (j % W) - (i % W), dy = Math.floor(j / W) - Math.floor(i / W);
        seg.push(`M${cx} ${cy}l${-dx * 3.2} ${-dy * 3.2}`);
      }
      if (isRiver(i)) pl.bridge += ns.some(j => j === i - 1 || j === i + 1) || !ns.length ? `M${X(i)} ${cy}h10` : `M${cx} ${Y(i)}v10`;
    });
    if (seg.length) {
      pl.ballast = seg.join('');
      pl.sleepers = pl.ballast;
      const off = 0.68;
      pl.rails = seg.map(sg => {
        const m = /^M([\d.]+) ([\d.]+)([hvl])(-?[\d.]+)(?: (-?[\d.]+))?/.exec(sg);
        if (!m) return '';
        const x = +m[1], y = +m[2];
        if (m[3] === 'h') return `M${x} ${rd(y - off)}h${m[4]}M${x} ${rd(y + off)}h${m[4]}`;
        if (m[3] === 'v') return `M${rd(x - off)} ${y}v${m[4]}M${rd(x + off)} ${y}v${m[4]}`;
        const dx = +m[4], dy = +(m[5] ?? 0);
        return dy === 0 ? `M${x} ${rd(y - off)}h${dx}M${x} ${rd(y + off)}h${dx}` : `M${rd(x - off)} ${y}v${dy}M${rd(x + off)} ${y}v${dy}`;
      }).join('');
      const first = cells.findIndex((x, i) => tram(i) && N4[i].some(tram));
      if (first >= 0) {
        const j = N4[first].find(tram)!, horiz = Math.abs(j - first) === 1;
        const mx = X(first) + 5 + (horiz ? (j > first ? 5 : -5) : 0), my = Y(first) + 5 + (horiz ? 0 : (j > first ? 5 : -5));
        pl.tramCar = horiz ? `M${mx - 3} ${my - .8}h6a.8.8 0 0 1 0 1.6h-6a.8.8 0 0 1 0-1.6z` : `M${mx - .8} ${my - 3}a.8.8 0 0 1 1.6 0v6a.8.8 0 0 1-1.6 0z`;
      }
    }
    return pl;
  });

  /** Cases où le projet choisi (ou le bulldozer) peut aller */
  protected readonly validSet = computed(() => {
    const c = this.city();
    const out = new Set<number>();
    const m = this.mode();
    if (m === 'clear') { c.cells.forEach((_, i) => { if (!canClear(c, i)) out.add(i); }); return out; }
    const k = this.selCard();
    if (m === 'card' && k) c.cells.forEach((_, i) => { if (!canPlace(c, k.k, i, k.free)) out.add(i); });
    return out;
  });

  protected readonly servedSet = computed(() => {
    const c = this.city();
    const out = new Set<number>();
    if (c.v !== 'nouvelle') return out;
    const tram = new Set(c.cells.map((x, i) => (x.b === 'tram' ? i : -1)).filter(i => i >= 0));
    c.cells.forEach((x, i) => { if (isHousing(x.b) && N8[i].some(j => tram.has(j))) out.add(i); });
    return out;
  });

  protected readonly preview = computed<Preview | null>(() => {
    const i = this.aim();
    const m = this.mode();
    if (i === null || !m) return null;
    const c = this.city();
    const k = this.selCard();
    const err = m === 'clear' ? canClear(c, i) : k ? canPlace(c, k.k, i, k.free) : 'Choisissez un projet';
    const base: Preview = { i, err, cost: 0, dPop: 0, dJobs: 0, dSat: 0, dInc: 0, dPoll: 0, deltas: new Map(), own: null, notes: [] };
    if (err) return base;
    const before = this.st();
    const next = cloneCity(c);
    if (m === 'clear') { base.cost = clearCost(c, i) ?? 0; clearCell(next, i); }
    else if (k) { base.cost = placeCost(c, k.k, i, k.free); place(next, k.k, i, k.free); }
    // L'effet sur la satisfaction ne compte pas la dépense (budget négatif) : on mesure l'urbanisme
    next.budget = c.budget;
    const after = stats(next);
    base.dPop = after.pop - before.pop;
    base.dJobs = after.jobs - before.jobs;
    base.dSat = after.sat - before.sat;
    base.dInc = r1(after.income - before.income);
    base.dPoll = after.poll - before.poll;
    for (const [j, q] of after.q) { const was = before.q.get(j); if (j === i) base.own = q; else if (was !== undefined && was !== q) base.deltas.set(j, q - was); }
    if (m === 'card' && k) {
      const cell = c.cells[i];
      if (cell.flood) base.notes.push('⚠️ Zone inondable : une crue peut tout emporter.');
      if (cell.t === 'foret') base.notes.push('🌲 Défrichement : +1 M€, la forêt disparaît.');
      if (k.k === 'ecole' && !R2[i].some(j => isHousing(c.cells[j].b))) base.notes.push('🏫 Aucun logement à 2 cases : école sans élèves pour l’instant.');
      if (k.k === 'commerce') base.notes.push(`🏪 Recettes ici : ${fmt(commerceRev(next, i))} M€/an.`);
      if (BUILD[k.k].housing && base.own !== null) base.notes.push(`Cadre de vie de ce ${k.k === 'residence' ? 'bloc' : 'quartier'} : ${sgn(base.own)} (${qParts(next, i).map(p => p.label.split(' ').slice(1).join(' ') + ' ' + sgn(p.v)).join(', ') || 'neutre'}).`);
      if (c.v === 'nouvelle' && after.served !== before.served) base.notes.push(`🚋 Quartiers desservis : ${before.served} → ${after.served}.`);
      if (c.v === 'nouvelle' && after.districts !== before.districts && after.served === before.served) base.notes.push(`🏘️ Quartiers : ${before.districts} → ${after.districts}.`);
    } else if (m === 'clear' && c.cells[i].flood && c.v === 'reconstruction') base.notes.push('🌊 Une berge de moins à dégager.');
    return base;
  });

  protected readonly inspect = computed<QPart[] | null>(() => {
    const i = this.look();
    if (i === null) return null;
    const c = this.city();
    return isHousing(c.cells[i].b) ? qParts(c, i) : null;
  });

  ngOnInit(): void {
    const id = this.def().id;
    const v: Variant = id.includes('nouvelle') ? 'nouvelle' : id.includes('reconstruction') ? 'reconstruction' : 'commune';
    const c = newCity(v, this.diff(), this.rnd);
    this.title = this.def().title || BRIEF[v].title;
    this.tip = BRIEF[v].tip;
    this.per = v === 'reconstruction' ? 'mois' : 'an';
    this.city.set(c);
    this.say(BRIEF[v].brief(c));
    this.newHand();
    this.emitProgress();
  }

  ngOnDestroy(): void { this.timers.forEach(t => clearTimeout(t)); }

  /* ── Libellés ── */

  protected u(name: string): string { return `url(#${this.uid}-${name})`; }
  protected g(id: GlyphId): string { return `#${this.uid}-g-${id}`; }
  protected face(sat: number): GlyphId { return sat >= 65 ? 'face4' : sat >= 45 ? 'face3' : sat >= 30 ? 'face2' : 'face1'; }
  protected evGlyph(id: string): GlyphId { return EV_GLYPH[id] ?? 'doc'; }
  protected permit(id: number): string { return String(id % 1000).padStart(3, '0'); }
  protected icon(k: BKind): string { return BUILD[k].icon; }
  protected name(k: BKind): string { return BUILD[k].name; }
  protected rule(k: BKind): string { return BUILD[k].rule; }
  protected tag(k: BKind): string { return BUILD[k].tag; }
  protected cat(k: BKind): string { return BUILD[k].cat; }
  protected cost(k: BKind): number { return BUILD[k].cost; }
  protected toggleSat(): void { this.satOpen.update(o => !o); if (this.satOpen()) { this.mode.set(null); this.sel.set(null); this.aim.set(null); this.look.set(null); } }

  /** Ce que rapporte ou coûte un bâtiment, pour l'inspection */
  protected cellInfo(i: number): string {
    const c = this.city();
    const b = c.cells[i].b;
    if (!b) return '';
    if (b === 'commerce') return `Recettes : ${fmt(commerceRev(c, i))} M€/${this.per}. `;
    if (b === 'solaire') return `Recettes : ${fmt(BUILD.solaire.rev + (c.cells[i].t === 'colline' ? 0.5 : 0))} M€/${this.per}. `;
    if (b === 'tram') return `Réseau : ${this.st().tram} tronçon${this.st().tram > 1 ? 's' : ''}. `;
    return '';
  }

  protected cardOff(k: Card): boolean { return !this.worksLeft() && !(k.segs !== undefined && k.segs < 3); }
  protected terrainLabel(i: number): string { return TERRAIN_LABEL[this.city().cells[i].t]; }
  protected fxAt(i: number): Fx[] { return this.fx().filter(f => f.i === i); }
  protected statFx(k: string): Fx[] { return this.sfx().filter(f => f.k === k); }

  protected deltaAt(i: number): number | null {
    const p = this.preview();
    if (!p || p.err) return null;
    if (p.i === i) return p.own;
    return p.deltas.get(i) ?? null;
  }

  protected cellLabel(i: number): string {
    const c = this.city();
    const cell = c.cells[i];
    const [x, y] = xy(i);
    let s = `Case ${String.fromCharCode(65 + x)}${y + 1} : ${cell.b ? BUILD[cell.b].name : TERRAIN_LABEL[cell.t]}${cell.flood ? ', zone inondable' : ''}`;
    const q = this.st().q.get(i);
    if (q !== undefined) s += `, cadre de vie ${sgn(q)}`;
    const d = this.deltaAt(i);
    if (d !== null && this.aim() !== i) s += `, effet ${sgn(d)}`;
    if (this.aim() === i) s += this.preview()?.err ? `, impossible : ${this.preview()!.err}` : ', touchez encore pour confirmer';
    return s;
  }

  protected objText(): string {
    const c = this.city();
    const s = this.st();
    if (c.v === 'commune') return `Satisfaction ${s.sat}/${c.satTarget} ${s.sat >= c.satTarget ? '✓' : '✗'} · budget ${c.budget >= 0 ? 'positif ✓' : 'négatif ✗'} · ${fmt(s.pop)}/${fmt(c.popTarget)} habitants`;
    if (c.v === 'nouvelle') return `${fmt(s.pop)}/${fmt(c.popTarget)} habitants ${s.pop >= c.popTarget ? '✓' : ''} · tram : ${s.served}/${c.dTarget} quartiers desservis ${s.served >= c.dTarget ? '✓' : ''} (${s.districts} quartier${s.districts > 1 ? 's' : ''})`;
    return `Relogés ${fmt(s.pop)}/${fmt(c.popTarget)} ${s.pop >= c.popTarget ? '✓' : ''} · zone inondable : ${s.floodLeft ? s.floodLeft + ' ruine' + (s.floodLeft > 1 ? 's' : '') + ' à dégager' : 'dégagée ✓'}`;
  }

  /* ── Interaction ── */

  protected pick(h: number): void {
    if (this.busy() || this.over()) return;
    const want = this.hand()[h]?.id;
    // Changer de projet abandonne les tronçons de tram restants
    const cur = this.hand()[this.sel() ?? -1];
    if (cur?.segs !== undefined && cur.segs < 3 && cur.id !== want) this.dropActiveTram();
    const idx = this.hand().findIndex(k => k.id === want);
    if (idx < 0) return;
    if (this.mode() === 'card' && this.sel() === idx) { this.mode.set(null); this.sel.set(null); this.aim.set(null); return; }
    this.mode.set('card');
    this.sel.set(idx);
    this.look.set(null);
    this.satOpen.set(false);
    this.aim.set(null);
  }

  protected tool(): void {
    if (this.busy() || this.over()) return;
    const cur = this.selCard();
    if (cur?.segs !== undefined && cur.segs < 3) this.dropActiveTram();
    const on = this.mode() === 'clear';
    this.satOpen.set(false);
    this.mode.set(on ? null : 'clear');
    this.sel.set(null);
    this.aim.set(null);
    this.look.set(null);
  }

  protected tap(i: number): void {
    if (this.over() || this.event() || this.busy()) return;
    if (!this.mode()) { this.satOpen.set(false); this.look.set(this.look() === i ? null : i); return; }
    if (this.aim() === i) { this.confirm(); return; }
    this.aim.set(i);
  }

  protected confirm(): void {
    const p = this.preview();
    if (!p || p.err) return;
    const c = cloneCity(this.city());
    const i = p.i;
    if (this.mode() === 'clear') {
      const ruin = c.cells[i].t === 'ruine';
      clearCell(c, i);
      this.clears.update(n => n + 1);
      this.city.set(c);
      this.pop(i, ruin ? 'déblayé' : 'démoli', 'info');
      this.say(`🚜 ${ruin ? 'Ruines déblayées' : 'Bâtiment démoli'}${p.cost ? ` (−${fmt(p.cost)} M€)` : ''}.`);
      this.aim.set(null);
      if (this.clears() >= 3) this.mode.set(null);
    } else {
      const k = this.selCard();
      if (!k) return;
      place(c, k.k, i, k.free);
      this.city.set(c);
      this.built.update(n => n + 1);
      if (p.dPop) this.pop(i, `+${p.dPop} hab.`, 'good');
      else if (p.dSat) this.pop(i, `${sgn(p.dSat)} satisf.`, p.dSat > 0 ? 'good' : 'bad');
      else this.pop(i, `−${fmt(p.cost)} M€`, 'info');
      for (const [j, d] of p.deltas) this.pop(j, sgn(d), d > 0 ? 'good' : 'bad');
      this.aim.set(null);
      if (k.segs !== undefined) {
        if (k.segs === 3) this.placed.update(n => n + 1);
        const left = k.segs - 1;
        if (left > 0) this.hand.update(h => h.map(x => (x.id === k.id ? { ...x, segs: left } : x)));
        else { this.removeCard(k.id); this.say('🚋 Trois tronçons de tram posés.'); }
      } else {
        this.placed.update(n => n + 1);
        this.removeCard(k.id);
        this.say(`${BUILD[k.k].icon} ${BUILD[k.k].name} : ${p.dPop ? `+${p.dPop} habitants, ` : ''}satisfaction ${sgn(p.dSat)}.`);
      }
    }
    this.emitProgress();
  }

  private dropActiveTram(): void {
    const k = this.hand().find(x => x.segs !== undefined && x.segs < 3);
    if (k) { this.removeCard(k.id); this.say('🚋 Le chantier du tram s’arrête là pour cette année.'); }
  }

  private removeCard(id: number): void {
    this.hand.update(h => h.filter(x => x.id !== id));
    this.sel.set(null);
    this.mode.set(null);
    this.aim.set(null);
  }

  protected redraw(): void {
    if (this.redrawn() || this.busy()) return;
    const c = cloneCity(this.city());
    if (c.budget < 1) return;
    c.budget = r1(c.budget - 1);
    const keepFree = this.hand().find(k => k.free);
    if (keepFree) c.free = keepFree.k;
    this.hand.set(drawHand(c, this.rnd));
    this.city.set(c);
    this.redrawn.set(true);
    this.mode.set(null); this.sel.set(null); this.aim.set(null);
    this.statPop('budget', '−1', 'bad');
  }

  private newHand(): void {
    const c = cloneCity(this.city());
    this.hand.set(drawHand(c, this.rnd));
    this.city.set(c);
    this.placed.set(0);
    this.clears.set(0);
    this.redrawn.set(false);
    this.mode.set(null); this.sel.set(null); this.aim.set(null); this.look.set(null);
  }

  /* ── Fin d'année ── */

  protected endTurn(): void {
    if (this.busy() || this.over() || this.event()) return;
    this.busy.set(true);
    this.mode.set(null); this.sel.set(null); this.aim.set(null); this.look.set(null);
    const before = this.st();
    const c = cloneCity(this.city());
    const year = c.year;
    const { income } = endYear(c);
    this.city.set(c);
    const after = this.st();
    this.statPop('budget', `${sgn(income)} M€`, income >= 0 ? 'good' : 'bad');
    if (after.sat !== before.sat) this.statPop('sat', sgn(after.sat - before.sat), after.sat > before.sat ? 'good' : 'bad');
    this.say(`${c.v === 'reconstruction' ? 'Mois' : 'Année'} ${year} : ${sgn(income)} M€ de recettes nettes, satisfaction ${after.sat}.`);
    if (c.budget < 0) { this.say('⚠️ Les comptes sont dans le rouge : la préfecture s’inquiète.'); this.miss.emit(); }
    if (after.sat < 35 && this.lowSatWarned !== year) { this.lowSatWarned = year; this.say('😠 La grogne monte dans les quartiers.'); this.miss.emit(); }
    this.emitProgress();
    this.timers.push(setTimeout(() => {
      if (c.bankrupt) { this.say('🏛️ Faillite : la ville est mise sous tutelle du préfet.'); this.miss.emit(); return this.finish(); }
      if (c.year > c.years) return this.finish();
      const ev = drawEvent(c, this.rnd);
      this.city.set(cloneCity(c));
      this.busy.set(false);
      if (ev) this.event.set(ev);
      else this.newHand();
    }, 650));
  }

  protected choose(o: EvOpt): void {
    if (!this.event()) return;
    const c = cloneCity(this.city());
    const before = this.st();
    const res = o.run(c);
    this.city.set(c);
    const after = this.st();
    this.say(res.msg);
    if (res.bad) this.miss.emit();
    if (after.sat !== before.sat) this.statPop('sat', sgn(after.sat - before.sat), after.sat > before.sat ? 'good' : 'bad');
    if (after.pop !== before.pop) this.statPop('pop', sgn(after.pop - before.pop), after.pop > before.pop ? 'good' : 'bad');
    this.event.set(null);
    if (c.budget < -8) { c.bankrupt = true; this.say('🏛️ Faillite : la ville est mise sous tutelle du préfet.'); this.miss.emit(); return this.finish(); }
    this.newHand();
    this.emitProgress();
  }

  private finish(): void {
    if (this.over()) return;
    this.over.set(true);
    this.busy.set(false);
    this.event.set(null);
    const c = this.city();
    const sc = scoreCity(c);
    this.final.set(sc);
    const r = sc.score;
    this.message.set(c.bankrupt ? 'Faillite : le préfet reprend la main sur la ville.'
      : sc.objOk && r >= 0.8 ? (c.v === 'nouvelle' ? 'Une ville modèle : le roi l’inaugurera en personne.' : c.v === 'reconstruction' ? 'Tout le monde a passé l’hiver au chaud : la commune renaît.' : 'Une commune transformée : les habitants en redemandent.')
      : sc.objOk ? 'Objectif tenu : un bilan solide.'
      : r >= 0.5 ? 'Un bilan mitigé : l’essentiel est fait, mais l’objectif échappe.'
      : 'Un mandat d’urbanisme raté : l’opposition s’en donnera à cœur joie.');
    if (r < 0.45) this.miss.emit();
    this.progress.emit({ live: r, time: 0 });
    this.timers.push(setTimeout(() => this.done.emit(Math.max(0.05, r)), 2200));
  }

  private emitProgress(): void {
    const c = this.city();
    this.progress.emit({ live: scoreCity(c).score, time: clamp(1 - (c.year - 1) / c.years) });
  }

  private say(t: string): void { this.log.update(l => [t, ...l].slice(0, 6)); }
  private pop(i: number, text: string, tone: Fx['tone']): void {
    const f: Fx = { i, text, tone, id: ++fxId };
    this.fx.update(a => [...a, f]);
    this.timers.push(setTimeout(() => this.fx.update(a => a.filter(z => z.id !== f.id)), 1100));
  }
  private statPop(k: string, text: string, tone: Fx['tone']): void {
    const f = { i: -1, k, text, tone, id: ++fxId };
    this.sfx.update(a => [...a, f]);
    this.timers.push(setTimeout(() => this.sfx.update(a => a.filter(z => z.id !== f.id)), 1300));
  }
}

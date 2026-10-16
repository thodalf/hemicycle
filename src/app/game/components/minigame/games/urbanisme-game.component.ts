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
 * ============================================================ */

interface Fx { i: number; text: string; tone: 'good' | 'bad' | 'info'; id: number }
interface Preview { i: number; err: string | null; cost: number; dPop: number; dJobs: number; dSat: number; dInc: number; dPoll: number; deltas: Map<number, number>; own: number | null; notes: string[] }

const BRIEF: Record<Variant, { title: string; brief: (c: City) => string; tip: string }> = {
  commune: { title: 'Moderniser la commune', tip: 'Le vieux centre étouffe près de l’usine : parcs, école et emplois feront remonter la satisfaction.',
    brief: c => `Fin de mandat dans ${c.years} ans : satisfaction ≥ ${c.satTarget} et budget positif. Visez aussi ${c.popTarget.toLocaleString('fr-FR')} habitants.` },
  nouvelle: { title: 'La ville nouvelle sur la Loire', tip: 'Gardez des quartiers séparés : une seule ligne de tram doit les longer tous.',
    brief: c => `Le grand chantier du roi : ${c.popTarget.toLocaleString('fr-FR')} habitants et une ligne de tram qui dessert ${c.dTarget} quartiers en ${c.years} ans.` },
  reconstruction: { title: 'Reconstruire après la crue', tip: 'Déblayez les ruines (🚜) avant de rebâtir ; on ne reconstruit plus en zone inondable.',
    brief: c => `Relogez tout le monde avant l’hiver (${c.popTarget.toLocaleString('fr-FR')} habitants) et videz la zone inondable de ses décombres, en ${c.years} mois.` },
};

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const sgn = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmt(Math.abs(n));
let fxId = 0;

@Component({
  selector: 'app-urbanisme-game',
  template: `
    @let c = city();
    @let s = st();
    <div class="urb" [class]="'urb v-' + c.v">
      <div class="head">
        <span class="yr">{{ c.v === 'reconstruction' ? 'Mois' : 'Année' }} <b class="mono">{{ Math.min(c.year, c.years) }}</b>/{{ c.years }}</span>
        <span class="ttl">{{ title }}</span>
        <span class="works" [class.none]="!worksLeft()" aria-label="Chantiers restants cette année">🏗️ {{ worksLeft() }}/{{ c.works }}</span>
      </div>

      <div class="stats" role="list" aria-label="Indicateurs de la ville">
        <span class="st" role="listitem" [class.ok]="s.pop >= c.popTarget" [attr.aria-label]="'Habitants ' + s.pop + ' sur ' + c.popTarget">
          <i>👥</i><b class="mono">{{ fmt(s.pop) }}</b><small>/{{ fmt(c.popTarget) }}</small>
          @for (f of statFx('pop'); track f.id) { <em class="sfx" [class]="'sfx ' + f.tone">{{ f.text }}</em> }
        </span>
        <span class="st" role="listitem" [class.warn]="s.unemp > 0.12" [attr.aria-label]="'Emplois ' + s.jobs + ' pour ' + s.actifs + ' actifs'">
          <i>💼</i><b class="mono">{{ fmt(s.jobs) }}</b><small>{{ s.unemp > 0.005 ? 'chôm. ' + Math.round(s.unemp * 100) + ' %' : 'plein emploi' }}</small>
        </span>
        <span class="st" role="listitem" [class.bad]="c.budget < 0" [attr.aria-label]="'Budget ' + c.budget + ' millions, ' + s.income + ' par an'">
          <i>💶</i><b class="mono">{{ fmt(c.budget) }}</b><small>{{ sgn(s.income) }}/{{ per }}</small>
          @for (f of statFx('budget'); track f.id) { <em class="sfx" [class]="'sfx ' + f.tone">{{ f.text }}</em> }
        </span>
        <button type="button" class="st tap" role="listitem" [class.ok]="c.v === 'commune' && s.sat >= c.satTarget" [class.bad]="s.sat < 40" [class.open]="satOpen()" (click)="toggleSat()"
                [attr.aria-pressed]="satOpen()" [attr.aria-label]="'Satisfaction ' + s.sat + ', touchez pour le détail'">
          <i>{{ s.sat >= 65 ? '😀' : s.sat >= 45 ? '🙂' : s.sat >= 30 ? '😐' : '😠' }}</i><b class="mono">{{ s.sat }}</b><small>{{ c.v === 'commune' ? '/' + c.satTarget : 'satisf. ⓘ' }}</small>
          @for (f of statFx('sat'); track f.id) { <em class="sfx" [class]="'sfx ' + f.tone">{{ f.text }}</em> }
        </button>
        <span class="st" role="listitem" [class.bad]="s.poll >= 5" [attr.aria-label]="'Pollution ' + s.poll">
          <i>🌫️</i><b class="mono">{{ s.poll }}</b><small>pollution</small>
        </span>
      </div>

      <p class="obj">🎯 {{ objText() }}</p>

      <div class="board" role="grid" aria-label="Plan de la ville, 8 cases sur 8">
        @for (cell of c.cells; track $index; let i = $index) {
          @let d = deltaAt(i);
          <button type="button" class="cell" [class]="'cell t-' + cell.t" [class.flood]="cell.flood" [class.ok]="validSet().has(i)" [class.no]="mode() && !validSet().has(i)"
                  [class.aim]="aim() === i" [class.look]="look() === i" [class.served]="servedSet().has(i)"
                  [disabled]="over() || !!event() || busy()" (click)="tap(i)" [attr.aria-label]="cellLabel(i)">
            @if (cell.b) {
              <span class="bld" [class]="'bld c-' + cat(cell.b)" [class.new]="cell.fresh">{{ icon(cell.b) }}</span>
            } @else if (cell.t === 'ruine') { <span class="deco">🧱</span> }
            @else if (cell.t === 'foret') { <span class="deco">🌲</span> }
            @if (aim() === i) { @if (ghost(); as g) { <span class="bld ghost" [class]="'bld ghost c-' + cat(g)">{{ icon(g) }}</span> } }
            @if (d !== null) { <i class="dq" [class.pos]="d > 0" [class.neg]="d < 0" [class.own]="aim() === i">{{ sgn(d) }}</i> }
            @for (f of fxAt(i); track f.id) { <span class="fx" [class]="'fx ' + f.tone">{{ f.text }}</span> }
          </button>
        }
      </div>

      <div class="panel" aria-live="polite">
        @if (over()) {
          @let sc = final();
          @if (sc) {
            <div class="sum">
              <p class="verdict"><b>{{ message() }}</b></p>
              <div class="bars">
                <span>👥 Population</span><span class="bar"><span [style.width.%]="sc.popC * 100"></span></span><b class="mono">{{ Math.round(sc.popC * 100) }}</b>
                <span>🙂 Satisfaction</span><span class="bar"><span [style.width.%]="sc.satC * 100"></span></span><b class="mono">{{ Math.round(sc.satC * 100) }}</b>
                <span>💶 Finances</span><span class="bar"><span [style.width.%]="sc.budC * 100"></span></span><b class="mono">{{ Math.round(sc.budC * 100) }}</b>
                <span>🎯 Objectif</span><span class="bar"><span [style.width.%]="sc.objC * 100"></span></span><b class="mono">{{ Math.round(sc.objC * 100) }}</b>
              </div>
              <p class="small muted">{{ built() }} chantiers menés · {{ fmt(sc.s.pop) }} habitants · {{ sc.s.sat }} de satisfaction · {{ fmt(c.budget) }} M€ en caisse@if (c.v === 'nouvelle') { · {{ sc.s.served }} quartier{{ sc.s.served > 1 ? 's' : '' }} desservi{{ sc.s.served > 1 ? 's' : '' }} }</p>
            </div>
          }
        } @else if (event(); as e) {
          <div class="event" role="dialog" [attr.aria-label]="e.title">
            <p class="ev-t"><span class="ev-i">{{ e.icon }}</span> <b>{{ e.title }}</b></p>
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
              @if (p.err) { <span>⛔ {{ p.err }}</span> }
              @else {
                <span class="pv">
                  <b>{{ mode() === 'clear' ? '🚜 ' + (c.cells[p.i].t === 'ruine' ? 'Déblayer' : 'Démolir') : icon(selCard()!.k) + ' ' + name(selCard()!.k) }}</b>
                  <span class="mono">{{ p.cost ? '−' + fmt(p.cost) + ' M€' : 'gratuit' }}</span>
                  @if (p.dPop) { <span [class]="p.dPop > 0 ? 'g' : 'r'">👥 {{ sgn(p.dPop) }}</span> }
                  @if (p.dJobs) { <span [class]="p.dJobs > 0 ? 'g' : 'r'">💼 {{ sgn(p.dJobs) }}</span> }
                  <span [class]="p.dSat > 0 ? 'g' : p.dSat < 0 ? 'r' : ''">🙂 {{ sgn(p.dSat) }}</span>
                  @if (p.dInc) { <span [class]="p.dInc > 0 ? 'g' : 'r'">💶 {{ sgn(p.dInc) }}/an</span> }
                  @if (p.dPoll) { <span [class]="p.dPoll < 0 ? 'g' : 'r'">🌫️ {{ sgn(p.dPoll) }}</span> }
                </span>
                @for (n of p.notes; track $index) { <small class="note">{{ n }}</small> }
                <span class="go"><small>Touchez à nouveau la case, ou</small> <button type="button" class="btn primary small" (click)="confirm()">Construire</button></span>
              }
            </div>
          } @else if (selCard(); as k) {
            <p class="rule"><b>{{ icon(k.k) }} {{ name(k.k) }}@if (k.free) { · offert }@if (k.segs) { · {{ k.segs }} tronçon{{ k.segs > 1 ? 's' : '' }} restant{{ k.segs > 1 ? 's' : '' }} }</b> — {{ rule(k.k) }}</p>
          } @else if (mode() === 'clear') {
            <p class="rule"><b>🚜 Déblayer / démolir</b> — ruines : {{ c.freeClears ? 'gratuit (' + c.freeClears + ' bénévoles)' : '2 M€' }} ; bâtiment : 1 M€. Trois par an, sans compter les chantiers.</p>
          } @else if (satOpen()) {
            <div class="insp">
              <b>{{ s.sat >= 65 ? '😀' : s.sat >= 45 ? '🙂' : '😐' }} Satisfaction {{ s.sat }} : d’où vient-elle ?</b>
              <span class="parts">@for (pt of s.satParts; track $index) { <span [class]="$index === 0 ? '' : pt.v > 0 ? 'g' : 'r'">{{ pt.label }} {{ $index === 0 ? pt.v : sgn(pt.v) }}</span> }</span>
              <small class="muted">Actifs : {{ fmt(s.actifs) }} pour {{ fmt(s.jobs) }} emplois (dont {{ c.extJobs }} dans le bassin)@if (s.demand) {<span> · logements attendus : {{ fmt(s.demand) }}</span>}</small>
            </div>
          } @else if (look() !== null) {
            @let li = look()!;
            <div class="insp">
              <b>{{ c.cells[li].b ? icon(c.cells[li].b!) + ' ' + name(c.cells[li].b!) : terrainLabel(li) }}@if (c.cells[li].flood) { · 🌊 zone inondable }</b>
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
              <button type="button" class="card" [class.on]="mode() === 'card' && sel() === h" [class.free]="k.free" [disabled]="cardOff(k) || busy()"
                      (click)="pick(h)" [attr.aria-pressed]="mode() === 'card' && sel() === h" [attr.aria-label]="name(k.k) + ', ' + (k.free ? 'offert' : cost(k.k) + ' millions')">
                <span class="ci">{{ icon(k.k) }}</span>
                <span class="cn">{{ name(k.k) }}</span>
                <span class="cc mono">{{ k.free ? 'offert' : cost(k.k) + ' M€' + (k.segs ? ' ×' + k.segs : '') }}</span>
                <span class="ct">{{ tag(k.k) }}</span>
              </button>
            } @empty { <p class="small muted">Plus de projets cette année.</p> }
          </div>
          <div class="tools">
            <button type="button" class="btn small" [class.on]="mode() === 'clear'" [disabled]="clears() >= 3 || busy()" (click)="tool()" [attr.aria-pressed]="mode() === 'clear'">🚜 Déblayer ({{ 3 - clears() }})</button>
            <button type="button" class="btn small" [disabled]="redrawn() || c.budget < 1 || busy() || placed() > 0" (click)="redraw()">🔄 Autres projets (1 M€)</button>
            <button type="button" class="btn primary small end" [disabled]="busy()" (click)="endTurn()">{{ c.year >= c.years ? 'Bilan du mandat' : (c.v === 'reconstruction' ? 'Mois suivant' : 'Année suivante') }} →</button>
          </div>
        }
      </div>

      <ul class="log">@for (l of log(); track $index) { <li>{{ l }}</li> }</ul>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .urb { display: grid; gap: 7px; font-size: 13px; }
    .head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: space-between; font-size: 12.5px; }
    .ttl { font-weight: 600; color: var(--ink-2); flex: 1; text-align: center; min-width: 0; }
    .works { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: var(--good-soft); color: var(--good); &.none { background: var(--surface-2); color: var(--ink-3); } }
    .stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; }
    .st.tap { font: inherit; color: inherit; cursor: pointer; &.open { box-shadow: 0 0 0 2px var(--accent); } }
    .st { position: relative; display: grid; justify-items: center; gap: 0; padding: 4px 2px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--line); line-height: 1.15; min-width: 0;
      i { font-style: normal; font-size: 14px; } b { font-size: 13.5px; }
      small { font-size: 9.5px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
      &.ok { border-color: var(--good); background: var(--good-soft); } &.bad { border-color: var(--bad); background: var(--bad-soft); } &.warn small { color: var(--bad); } }
    .sfx { position: absolute; top: 45%; left: 50%; transform: translateX(-50%); font: 800 12px var(--font-body); font-style: normal; white-space: nowrap; pointer-events: none; animation: rise 1.3s ease forwards; z-index: 4;
      &.good { color: var(--good); } &.bad { color: var(--bad); } &.info { color: var(--ink-2); } }
    .obj { margin: 0; font-size: 12px; color: var(--ink-2); }
    .board { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; padding: 4px; border-radius: 10px; background: #3b4a3a; width: 100%; max-width: 460px; justify-self: center; user-select: none; touch-action: manipulation; }
    .cell { position: relative; aspect-ratio: 1; min-width: 0; min-height: 32px; border: 0; border-radius: 4px; padding: 0; cursor: pointer; display: grid; place-items: center; overflow: visible; font-size: clamp(15px, 4.4vw, 24px);
      &:disabled { cursor: default; } &:focus-visible { outline: 3px solid #f4d35e; outline-offset: -3px; z-index: 2; } }
    .t-plaine { background: #b7c88a; }
    .t-foret { background: #6f9150; }
    .t-colline { background: #cdb37c; background-image: radial-gradient(ellipse at 50% 95%, #b39761 48%, transparent 50%); }
    .t-riviere { background: #5b8fba; background-image: repeating-linear-gradient(160deg, transparent 0 6px, rgba(255,255,255,.18) 6px 8px); }
    .t-ruine { background: #9b8f82; background-image: linear-gradient(135deg, transparent 45%, #6f655b 46% 50%, transparent 51%); }
    .cell.flood::before { content: ''; position: absolute; inset: 0; border-radius: 4px; pointer-events: none; background: repeating-linear-gradient(45deg, rgba(40, 110, 200, .32) 0 3px, transparent 3px 7px); }
    .cell.no { filter: saturate(.35) brightness(.8); }
    .cell.ok { box-shadow: inset 0 0 0 2px rgba(255, 255, 255, .75); }
    .cell.aim { box-shadow: inset 0 0 0 3px #f4d35e; z-index: 2; }
    .cell.look { box-shadow: inset 0 0 0 3px #fff; z-index: 2; }
    .cell.served::after { content: ''; position: absolute; left: 3px; bottom: 3px; width: 6px; height: 6px; border-radius: 50%; background: #e63946; box-shadow: 0 0 0 1px #fff; }
    .deco { opacity: .75; font-size: .8em; }
    .bld { position: relative; z-index: 1; display: grid; place-items: center; width: 88%; height: 88%; border-radius: 6px; line-height: 1;
      &.c-hab { background: #f6e7c8; box-shadow: inset 0 -3px 0 #d9b77a; } &.c-srv { background: #dfe9f7; box-shadow: inset 0 -3px 0 #8fb0de; }
      &.c-eco { background: #e6e1da; box-shadow: inset 0 -3px 0 #a39a8e; } &.c-vert { background: #d6efcf; box-shadow: inset 0 -3px 0 #86c27a; }
      &.c-tram { width: 100%; height: 100%; border-radius: 4px; font-size: .75em; background: #c9c2b4 linear-gradient(90deg, transparent 28%, #5d5850 28% 34%, transparent 34% 66%, #5d5850 66% 72%, transparent 72%); }
      &.ghost { position: absolute; inset: 6%; width: auto; height: auto; opacity: .7; outline: 2px dashed #f4d35e; }
      &.new { animation: drop .45s cubic-bezier(.2, 1.4, .4, 1) both; } }
    .t-riviere .bld.c-tram { background-color: #8a7a62; }
    @keyframes drop { from { transform: translateY(-14px) scale(.4); opacity: 0; } }
    .dq { position: absolute; z-index: 3; top: -5px; right: -4px; min-width: 18px; padding: 1px 3px; border-radius: 8px; font: 800 10.5px/1.2 var(--font-body); font-style: normal; color: #fff; text-align: center; pointer-events: none;
      &.pos { background: #2f8f57; } &.neg { background: #c8432f; } &.own { top: auto; bottom: -5px; right: auto; left: -4px; outline: 2px solid #f4d35e; } }
    .fx { position: absolute; z-index: 5; top: -6px; font: 800 12px var(--font-body); white-space: nowrap; pointer-events: none; animation: rise 1.1s ease forwards; text-shadow: 0 1px 2px #000;
      &.good { color: #b7f5c6; } &.bad { color: #ffb3a6; } &.info { color: #fff; } }
    @keyframes rise { to { transform: translate(-50%, -22px); opacity: 0; } }
    .fx { left: 50%; transform: translateX(-50%); }
    .panel { display: grid; gap: 6px; min-height: 120px; }
    .rule { margin: 0; font-size: 12px; color: var(--ink-2); }
    .prev { display: grid; gap: 4px; padding: 7px 9px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--line); font-size: 12px;
      &.err { background: var(--bad-soft); color: var(--bad); border-color: transparent; } }
    .pv { display: flex; flex-wrap: wrap; gap: 4px 9px; align-items: baseline; }
    .g { color: var(--good); font-weight: 600; } .r { color: var(--bad); font-weight: 600; }
    .note { color: var(--ink-2); font-size: 11.5px; }
    .go { display: flex; align-items: center; justify-content: flex-end; gap: 8px; small { color: var(--ink-3); } }
    .insp { display: grid; gap: 4px; padding: 7px 9px; border-radius: 10px; background: var(--surface-2); font-size: 12px; }
    .parts { display: flex; flex-wrap: wrap; gap: 3px 10px; font-size: 11.5px; }
    .hand { display: grid; grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr)); gap: 5px; }
    .card { display: grid; justify-items: center; gap: 1px; padding: 6px 4px; min-height: 76px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); cursor: pointer; color: var(--ink); font: inherit; transition: transform .15s ease, box-shadow .15s ease;
      &.on { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); transform: translateY(-2px); }
      &.free { background: var(--good-soft); }
      &:disabled { opacity: .45; cursor: not-allowed; }
      .ci { font-size: 22px; line-height: 1.1; } .cn { font-size: 11.5px; font-weight: 600; text-align: center; line-height: 1.15; }
      .cc { font-size: 11px; color: var(--accent); } .ct { font-size: 10px; color: var(--ink-3); text-align: center; } }
    .tools { display: flex; flex-wrap: wrap; gap: 6px; .end { margin-left: auto; } .btn { min-height: 34px; } .on { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); } }
    .event { display: grid; gap: 6px; padding: 10px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--accent); animation: pop .3s ease both; }
    .ev-t { margin: 0; font-size: 14px; } .ev-i { font-size: 20px; }
    .ev-o { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 6px; }
    .opt { display: grid; gap: 2px; text-align: left; min-height: 48px; small { color: var(--ink-3); font-size: 11px; } }
    @keyframes pop { from { transform: scale(.95); opacity: 0; } }
    .sum { display: grid; gap: 8px; }
    .verdict { margin: 0; font-size: 14px; }
    .bars { display: grid; grid-template-columns: auto 1fr 28px; gap: 5px 8px; align-items: center; font-size: 12px; b { text-align: right; } }
    .small { font-size: 12px; margin: 0; }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 76px; overflow: auto; font-size: 11.5px; color: var(--ink-2); }
    @media (max-width: 400px) { .stats small { font-size: 8.5px; } .card .ct { display: none; } }
    @media (prefers-reduced-motion: reduce) { .bld.new, .fx, .sfx, .event, .card { animation: none; transition: none; } .card.on { transform: none; } }
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
      this.pop(i, ruin ? '🚜' : '💥', 'info');
      this.say(`🚜 ${ruin ? 'Ruines déblayées' : 'Bâtiment démoli'}${p.cost ? ` (−${fmt(p.cost)} M€)` : ''}.`);
      this.aim.set(null);
      if (this.clears() >= 3) this.mode.set(null);
    } else {
      const k = this.selCard();
      if (!k) return;
      place(c, k.k, i, k.free);
      this.city.set(c);
      this.built.update(n => n + 1);
      if (p.dPop) this.pop(i, `+${p.dPop} 👥`, 'good');
      else if (p.dSat) this.pop(i, `${sgn(p.dSat)} 🙂`, p.dSat > 0 ? 'good' : 'bad');
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

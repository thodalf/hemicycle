import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/* ============================================================
 *  La navette parlementaire : faire passer un texte, étape par
 *  étape — commission, séance publique à l'Assemblée, Sénat,
 *  commission mixte paritaire, lecture définitive. Chaque groupe
 *  vote selon un score de soutien transparent (sa position de
 *  départ, ce que chaque article lui fait gagner ou perdre, ses
 *  lignes rouges, les accords passés, sa colère). On amende, on
 *  supprime, on négocie, on dégaine le 49.3 ou le vote bloqué ;
 *  l'opposition dépose des amendements et fait de l'obstruction.
 *
 *  Variantes : la loi de finances (cible de déficit), la grande
 *  réforme sociale (grèves) et la révision constitutionnelle
 *  (Congrès aux trois cinquièmes, pas de 49.3).
 *
 *  Toute la simulation est en fonctions pures exportées (testables
 *  hors d'Angular) ; le composant n'est qu'une interface tactile.
 * ============================================================ */

export type Gid = 'FDL' | 'ECO' | 'GS' | 'AC' | 'ADT' | 'CAP' | 'CONS' | 'PEF';
export type Variant = 'loi' | 'budget' | 'reforme' | 'constitution';
export type Chamber = 'com' | 'an' | 'sen' | 'congres';
export type Level = 0 | 1 | 2;
export type Rnd = () => number;
export type Mode = 'normal' | 'cmp' | 'conclusions' | 'definitive' | 'congres';

export interface GroupDef { id: Gid; name: string; short: string; color: string; pos: number; an: number; sen: number; coal: boolean }
export interface Demand { kind: 'drop' | 'amend' | 'protect' | 'add'; art: number }
export interface Group extends GroupDef { com: number; base: number; red: number | null; demand: Demand | null; known: boolean; deal: boolean; anger: number }
export interface Article {
  id: number; n: number; title: string; desc: string; amb: number; pos: number; att: Record<Gid, number>; level: Level;
  /** ✊ article au cœur de la contestation (réforme) */
  core: boolean;
  /** Loi de finances : effet sur le solde, en Md€ (positif = réduit le déficit) */
  fiscal: number;
  /** Penchant propre aux sénateurs (ils défendent leur maison) */
  senB: number;
  /** Article additionnel : le groupe qui l'a obtenu */
  extra: Gid | null;
}
export interface Amdt { id: number; num: number; by: Gid; art: number; to: Level; ch: Chamber; kind: 'sup' | 'rew' | 'ret' | 'add' }

export interface Game {
  v: Variant; diff: number; groups: Group[]; arts: Article[];
  stage: number; mode: Mode;
  temps: number; capital: number; capital0: number;
  used493: number; night: boolean; concert: boolean; pressure: number; acts: number; wave2: boolean;
  pending: Amdt[];
  /** Les textes adoptés : Assemblée (1re lecture) et Sénat */
  an: Record<number, Level> | null; sen: Record<number, Level> | null;
  status: 'play' | 'won' | 'lost' | 'censure'; lostAt: number;
  /** Loi de finances : cible et déficit hors mesures (en % du PIB) */
  target: number; defBase: number;
  amendNo: number; nextId: number;
  /** Le texte a-t-il été adopté par la commission ? */
  comOk: boolean | null;
  /** Le Sénat a rejeté les conclusions de la CMP : on passe en lecture définitive */
  senRejectedCmp: boolean;
}

export const STAGES = ['Commission', 'Séance publique', 'Sénat', 'CMP', 'Lecture définitive'] as const;

/* ── Les groupes parlementaires (fictifs) ── */

export const GROUP_DEFS: GroupDef[] = [
  { id: 'FDL', name: 'Front des luttes', short: 'FDL', color: '#b3263b', pos: -85, an: 72, sen: 15, coal: false },
  { id: 'ECO', name: 'Écologie solidaire', short: 'ÉCO', color: '#3f9b4f', pos: -58, an: 38, sen: 18, coal: false },
  { id: 'GS', name: 'Gauche sociale', short: 'GS', color: '#e0607e', pos: -32, an: 66, sen: 70, coal: false },
  { id: 'AC', name: 'Avenir commun', short: 'AC', color: '#e8a530', pos: -4, an: 158, sen: 22, coal: true },
  { id: 'ADT', name: 'Alliance des territoires', short: 'ADT', color: '#8a6fd1', pos: 14, an: 42, sen: 60, coal: true },
  { id: 'CAP', name: 'Cap libéral', short: 'CAP', color: '#4a90d9', pos: 30, an: 35, sen: 18, coal: true },
  { id: 'CONS', name: 'Les Conservateurs', short: 'CONS', color: '#1f4e9a', pos: 52, an: 48, sen: 135, coal: false },
  { id: 'PEF', name: 'Patrie et frontières', short: 'P&F', color: '#4b4470', pos: 86, an: 118, sen: 10, coal: false },
];
export const AN_SEATS = 577;
export const SEN_SEATS = 348;
export const COM_SEATS = 72;
export const CENSURE = 289;

/* ── Les textes ── */

interface ArtT { title: string; desc: string; amb: number; pos: number; core?: boolean; fiscal?: number; senB?: number; likes?: Gid[]; hates?: Gid[] }
interface PetT { title: string; pos: number; fiscal?: number }

export const BILLS: Record<Variant, { title: string; arts: ArtT[]; pets: Record<Gid, PetT> }> = {
  loi: {
    title: 'Projet de loi « Logement et territoires »',
    arts: [
      { title: 'Encadrement des loyers en zone tendue', desc: 'Plafonner les loyers dans les vingt plus grandes agglomérations.', amb: 18, pos: -35, hates: ['CAP'] },
      { title: '25 % de logements sociaux par commune', desc: 'Sanctions doublées pour les communes en retard.', amb: 16, pos: -30, senB: -1, hates: ['ADT', 'CONS'] },
      { title: 'Permis de construire en trois mois', desc: 'Délais d’instruction raccourcis, recours encadrés.', amb: 12, pos: 25, likes: ['ADT'], hates: ['ECO'] },
      { title: 'Taxe sur les logements vacants', desc: 'Taxe triplée après deux ans de vacance.', amb: 12, pos: -22, hates: ['CONS', 'CAP'] },
      { title: 'Expulsion accélérée des squatteurs', desc: 'Procédure ramenée à 72 heures.', amb: 10, pos: 55, hates: ['FDL', 'ECO', 'GS'] },
      { title: 'Rénovation thermique avant location', desc: 'Interdiction de louer les passoires énergétiques dès 2028.', amb: 14, pos: -40, likes: ['ECO'], hates: ['ADT'] },
      { title: 'Prêt à taux zéro pour les zones rurales', desc: 'Le PTZ rouvert dans tous les bourgs.', amb: 10, pos: 15, likes: ['ADT'] },
      { title: 'Contrôle des locations touristiques', desc: 'Quatre-vingt-dix nuits par an au plus.', amb: 10, pos: -10, likes: ['GS'] },
    ],
    pets: {
      FDL: { title: 'Gel des loyers pendant un an', pos: -82 }, ECO: { title: 'Bonus pour l’habitat léger et durable', pos: -55 },
      GS: { title: 'Rapport sur le mal-logement', pos: -30 }, AC: { title: 'Clause de revoyure à deux ans', pos: -2 },
      ADT: { title: 'Dérogations pour les communes rurales', pos: 16 }, CAP: { title: 'Bail simplifié pour les propriétaires', pos: 34 },
      CONS: { title: 'Exonération des petits bailleurs', pos: 52 }, PEF: { title: 'Priorité aux résidents de longue date', pos: 84 },
    },
  },
  reforme: {
    title: 'Projet de loi de réforme des retraites et de l’emploi',
    arts: [
      { title: 'Âge légal porté à 64 ans et demi', desc: 'Trois mois de plus par génération jusqu’en 2033.', amb: 24, pos: 42, core: true, hates: ['GS'] },
      { title: '44 annuités de cotisation', desc: 'La durée requise pour le taux plein allongée.', amb: 18, pos: 36, core: true },
      { title: 'Allocations chômage dégressives', desc: '−20 % après neuf mois d’indemnisation.', amb: 16, pos: 50, core: true, hates: ['ADT'] },
      { title: 'Fin des régimes spéciaux', desc: 'Pour les nouveaux embauchés des entreprises publiques.', amb: 12, pos: 35 },
      { title: 'Minimum de pension à 1 150 €', desc: 'Pour une carrière complète, revalorisé chaque année.', amb: 10, pos: -25, likes: ['GS'] },
      { title: 'Compte pénibilité élargi', desc: 'Port de charges lourdes et travail de nuit pris en compte.', amb: 8, pos: -40 },
      { title: 'Index seniors obligatoire', desc: 'Les entreprises publient leur taux d’emploi des plus de 55 ans.', amb: 8, pos: -12, hates: ['CAP', 'CONS'] },
      { title: 'Retraite progressive dès 60 ans', desc: 'Travailler à temps partiel en touchant une part de sa pension.', amb: 8, pos: 2 },
    ],
    pets: {
      FDL: { title: 'Départ à 60 ans pour les carrières longues', pos: -85 }, ECO: { title: 'Pension de reversion revalorisée', pos: -50 },
      GS: { title: 'Conférence sociale sur les salaires', pos: -30 }, AC: { title: 'Clause de revoyure à deux ans', pos: -2 },
      ADT: { title: 'Prise en compte des carrières agricoles', pos: 16 }, CAP: { title: 'Épargne retraite défiscalisée', pos: 36 },
      CONS: { title: 'Points bonus pour les familles nombreuses', pos: 52 }, PEF: { title: 'Pension minimum réservée aux résidents', pos: 85 },
    },
  },
  budget: {
    title: 'Projet de loi de finances pour l’an prochain',
    arts: [
      { title: 'Contribution sur les très hauts revenus', desc: 'Recette : +4,5 Md€.', amb: 8, pos: -35, fiscal: 4.5, hates: ['CAP', 'CONS'] },
      { title: 'Taxe sur les rachats d’actions', desc: 'Recette : +2,5 Md€.', amb: 6, pos: -30, fiscal: 2.5, hates: ['CAP'] },
      { title: 'Rabot des niches fiscales', desc: 'Recette : +5 Md€, dont niches agricoles.', amb: 8, pos: 8, fiscal: 5, hates: ['ADT', 'CONS'] },
      { title: 'Gel du barème des pensions', desc: 'Économie : +6 Md€.', amb: 10, pos: 45, fiscal: 6, hates: ['FDL', 'GS', 'ECO'] },
      { title: 'Plan d’urgence pour l’hôpital', desc: 'Dépense : −4 Md€.', amb: 18, pos: -25, fiscal: -4 },
      { title: 'Programmation militaire', desc: 'Dépense : −3,5 Md€.', amb: 14, pos: 40, fiscal: -3.5, hates: ['FDL', 'ECO'] },
      { title: 'Fonds vert pour les collectivités', desc: 'Dépense : −2,5 Md€.', amb: 14, pos: -40, fiscal: -2.5, likes: ['ADT'] },
      { title: 'Baisse des impôts de production', desc: 'Moindre recette : −4 Md€.', amb: 12, pos: 45, fiscal: -4, likes: ['CAP'], hates: ['FDL', 'GS'] },
    ],
    pets: {
      FDL: { title: 'Taxe sur les dividendes', pos: -82, fiscal: 2 }, ECO: { title: 'Fonds pour le rail', pos: -55, fiscal: -1.5 },
      GS: { title: 'Bourses étudiantes revalorisées', pos: -30, fiscal: -1 }, AC: { title: 'Revue des dépenses à mi-année', pos: -2, fiscal: 0.5 },
      ADT: { title: 'Dotation pour les communes rurales', pos: 16, fiscal: -1 }, CAP: { title: 'Crédit d’impôt pour les PME', pos: 34, fiscal: -1.5 },
      CONS: { title: 'Allègement des droits de succession', pos: 52, fiscal: -2.5 }, PEF: { title: 'TVA réduite sur l’énergie', pos: 84, fiscal: -4 },
    },
  },
  constitution: {
    title: 'Projet de loi constitutionnelle',
    arts: [
      { title: 'Une dose de 20 % de proportionnelle', desc: 'Pour l’élection des députés.', amb: 18, pos: -20, senB: -1, likes: ['ECO', 'PEF', 'FDL'], hates: ['CONS'] },
      { title: 'Le climat inscrit à l’article 1er', desc: 'La République « garantit la préservation du climat ».', amb: 16, pos: -45, hates: ['CONS', 'PEF'] },
      { title: 'Référendum d’initiative partagée assoupli', desc: 'Un million de signatures au lieu de quatre.', amb: 14, pos: -30, likes: ['PEF'] },
      { title: 'Trois mandats consécutifs au plus', desc: 'Pour les parlementaires et les exécutifs locaux.', amb: 12, pos: -10, senB: -2, hates: ['CONS'] },
      { title: 'Droit à la différenciation locale', desc: 'Les collectivités adaptent certaines lois.', amb: 12, pos: 15, likes: ['ADT'], hates: ['FDL'] },
      { title: 'Un quart de parlementaires en moins', desc: 'Moins de députés et de sénateurs.', amb: 14, pos: 30, senB: -2, hates: ['GS', 'ECO'] },
      { title: 'Encadrement de l’article 49.3', desc: 'Une seule utilisation par session, budget compris.', amb: 10, pos: -35, hates: ['CAP'] },
      { title: 'Conseil supérieur de la justice réformé', desc: 'Nominations des magistrats du parquet.', amb: 10, pos: 0 },
    ],
    pets: {
      FDL: { title: 'Référendum révocatoire', pos: -85 }, ECO: { title: 'Droits de la nature', pos: -58 },
      GS: { title: 'Droit de pétition renforcé', pos: -30 }, AC: { title: 'Clause de revoyure constitutionnelle', pos: -2 },
      ADT: { title: 'Garantie des ressources locales', pos: 16 }, CAP: { title: 'Règle d’or budgétaire', pos: 34 },
      CONS: { title: 'Révision du droit d’amendement', pos: 52 }, PEF: { title: 'Référendum d’initiative citoyenne', pos: 85 },
    },
  },
};

/* ── Outils ── */

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
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const r1 = (n: number) => Math.round(n * 10) / 10;
const pick = <T>(xs: T[], r: Rnd): T => xs[Math.floor(r() * xs.length)];
function shuffle<T>(xs: T[], r: Rnd): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Répartition au plus fort reste */
export function apportion(weights: number[], total: number): number[] {
  const sum = weights.reduce((t, w) => t + w, 0) || 1;
  const raw = weights.map(w => (w / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((t, x) => t + x, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i] as [number, number]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k][1]]++;
  return out;
}

function attFor(gpos: number, apos: number, amb: number): number {
  const k = amb >= 16 ? 1.3 : 1;
  return clamp(Math.round((k * (50 - Math.abs(gpos - apos))) / 35), -3, 3);
}

export const gOf = (G: Game, id: Gid): Group => G.groups.find(g => g.id === id)!;
export const aOf = (G: Game, id: number): Article | undefined => G.arts.find(a => a.id === id);
export const levels = (G: Game): Record<number, Level> => Object.fromEntries(G.arts.map(a => [a.id, a.level]));
export const cloneGame = (G: Game): Game => ({
  ...G, groups: G.groups.map(g => ({ ...g, demand: g.demand ? { ...g.demand } : null })), arts: G.arts.map(a => ({ ...a, att: { ...a.att } })),
  pending: G.pending.map(p => ({ ...p })), an: G.an ? { ...G.an } : null, sen: G.sen ? { ...G.sen } : null,
});

/* ── Création ── */

export function newGame(v: Variant, diff: number, r: Rnd): Game {
  const d = clamp(diff, 0.6, 1.6);
  const bill = BILLS[v];
  // Sept ou huit groupes : parfois les écologistes ou les libéraux ne forment pas de groupe
  let defs = GROUP_DEFS.map(g => ({ ...g }));
  const merge = r();
  if (merge < 0.2) { defs.find(g => g.id === 'GS')!.an += defs.find(g => g.id === 'ECO')!.an; defs.find(g => g.id === 'GS')!.sen += defs.find(g => g.id === 'ECO')!.sen; defs = defs.filter(g => g.id !== 'ECO'); }
  else if (merge < 0.4) { defs.find(g => g.id === 'AC')!.an += defs.find(g => g.id === 'CAP')!.an; defs.find(g => g.id === 'AC')!.sen += defs.find(g => g.id === 'CAP')!.sen; defs = defs.filter(g => g.id !== 'CAP'); }
  // L'Assemblée : une majorité relative, plus mince quand la difficulté monte
  const coalShare = clamp(0.445 - 0.11 * (d - 1) + (r() - 0.5) * 0.03, 0.36, 0.49);
  const coalSeats = Math.round(AN_SEATS * coalShare);
  const coal = defs.filter(g => g.coal), opp = defs.filter(g => !g.coal);
  const cs = apportion(coal.map(g => g.an * (0.9 + 0.2 * r())), coalSeats);
  const os = apportion(opp.map(g => g.an * (0.85 + 0.3 * r())), AN_SEATS - coalSeats);
  coal.forEach((g, i) => { g.an = cs[i]; });
  opp.forEach((g, i) => { g.an = os[i]; });
  const ss = apportion(defs.map(g => g.sen * (0.9 + 0.2 * r())), SEN_SEATS);
  defs.forEach((g, i) => { g.sen = ss[i]; });
  const com = apportion(defs.map(g => g.an), COM_SEATS);

  // Les articles du texte : cinq à sept, tirés du modèle
  const nArts = clamp(5 + (r() < 0.55 ? 1 : 0) + (d >= 1.15 ? 1 : 0), 5, 7);
  let tpl = shuffle(bill.arts, r).slice(0, nArts);
  if (v === 'reforme' && !tpl.some(a => a.core)) tpl[0] = bill.arts[0];
  if (v === 'reforme' && tpl.filter(a => a.core).length < 2) { const c = bill.arts.find(a => a.core && !tpl.includes(a))!; tpl[tpl.findIndex(a => !a.core)] = c; }
  tpl = bill.arts.filter(a => tpl.includes(a));
  const ambSum = tpl.reduce((t, a) => t + a.amb, 0);
  const arts: Article[] = tpl.map((a, i) => {
    const att = {} as Record<Gid, number>;
    for (const g of defs) {
      let x = attFor(g.pos, a.pos, a.amb);
      if (a.likes?.includes(g.id)) x = Math.max(x, 2);
      if (a.hates?.includes(g.id)) x = Math.min(x, -2);
      att[g.id] = x;
    }
    return { id: i + 1, n: i + 1, title: a.title, desc: a.desc, amb: Math.round((a.amb / ambSum) * 1000) / 10, pos: a.pos, att, level: 2 as Level, core: !!a.core, fiscal: a.fiscal ?? 0, senB: a.senB ?? 0, extra: null };
  });

  const groups: Group[] = defs.map((g, i) => {
    const far = Math.abs(g.pos - 8) >= 70;
    // Une révision constitutionnelle transcende un peu les clivages
    const base = g.coal ? 2 : -Math.round(Math.abs(g.pos - 8) / 28) - (d >= 1.15 && !far ? 1 : 0) + (v === 'constitution' && !far ? 1 : 0);
    return { ...g, com: com[i], base, red: null, demand: null, known: false, deal: false, anger: 0 };
  });
  // Lignes rouges cachées : sur l'article que le groupe déteste le plus
  const pRed = 0.35 + 0.3 * clamp((d - 0.8) / 0.6);
  const candidates = groups.filter(g => Math.abs(g.pos - 8) < 70);
  for (const g of candidates) {
    const worst = [...arts].sort((a, b) => a.att[g.id] - b.att[g.id])[0];
    if (worst.att[g.id] > -1) continue;
    if (r() < (g.coal ? pRed * 0.55 : pRed)) g.red = worst.id;
  }
  if (!groups.some(g => g.red !== null)) {
    const pool = candidates.filter(g => arts.some(a => a.att[g.id] <= -1));
    if (pool.length) { const g = pick(pool, r); g.red = [...arts].sort((a, b) => a.att[g.id] - b.att[g.id])[0].id; }
  }

  const capital = Math.round(8 - 2.5 * (d - 0.8) / 0.6);
  const G: Game = {
    v, diff: d, groups, arts, stage: 0, mode: 'normal', temps: 0, capital, capital0: capital, used493: 0, night: false, concert: false,
    pressure: v === 'reforme' ? (d >= 1.2 ? 2 : 1) : 0, acts: 0, wave2: false, pending: [], an: null, sen: null,
    status: 'play', lostAt: 0, target: 0, defBase: 0, amendNo: 100 + Math.floor(r() * 200), nextId: 100, comOk: null, senRejectedCmp: false,
  };
  if (v === 'budget') {
    G.target = d >= 1.2 ? 4.4 : 4.5;
    const margin = 0.2 - 0.12 * clamp((d - 0.8) / 0.6);
    G.defBase = r1((G.target - margin + arts.reduce((t, a) => t + a.fiscal, 0) / 30) * 100) / 100;
  }
  for (const g of groups) g.demand = makeDemand(G, g, r);
  calibrate(G);
  return G;
}

/** La marge du texte initial : un projet ne passe jamais tel quel, mais reste jouable */
export function startMargin(G: Game, believed = true): number {
  if (G.v === 'constitution') { const t = tally(G, 'congres', levels(G), believed); return (t.p - 0.6 * (t.p + t.c)) / Math.max(1, t.p + t.c); }
  const t = tally(G, 'an', levels(G), believed);
  return (t.p - t.c) / Math.max(1, t.p + t.c);
}
function calibrate(G: Game): void {
  const tgt = -0.06 - 0.08 * clamp((G.diff - 0.8) / 0.6, -0.5, 1.5);
  const coal = G.groups.filter(g => g.coal), opp = G.groups.filter(g => !g.coal);
  for (let k = 0; k < 80; k++) {
    const m = startMargin(G);
    if (Math.abs(m - tgt) <= 0.02) break;
    const coalSeats = coal.reduce((t, g) => t + g.an, 0);
    // On déplace des sièges entre le premier groupe de la majorité et l'opposition la plus hostile
    const from = m > tgt ? [...coal].sort((a, b) => b.an - a.an)[0] : [...opp].sort((a, b) => sOf(G, a) - sOf(G, b) || b.an - a.an)[0];
    const to = m > tgt ? [...opp].sort((a, b) => sOf(G, a) - sOf(G, b) || b.an - a.an)[0] : [...coal].sort((a, b) => b.an - a.an)[0];
    if (m > tgt && coalSeats <= AN_SEATS * 0.3) break;
    if (m < tgt && coalSeats >= AN_SEATS * 0.53) break;
    const n = Math.min(4, from.an - 5);
    if (n <= 0) break;
    from.an -= n; to.an += n;
  }
  const com = apportion(G.groups.map(g => g.an), COM_SEATS);
  G.groups.forEach((g, i) => { g.com = com[i]; });
}

/** Ce qu'un groupe réclame en échange de son soutien */
function makeDemand(G: Game, g: Group, r: Rnd): Demand | null {
  const gov = G.arts.filter(a => !a.extra);
  const worst = [...gov].sort((a, b) => a.att[g.id] - b.att[g.id] || b.amb - a.amb)[0];
  const best = [...gov].sort((a, b) => b.att[g.id] - a.att[g.id])[0];
  const roll = r();
  if (worst && worst.att[g.id] <= -1 && roll < 0.65) return { kind: worst.amb >= 14 || worst.att[g.id] >= -1 ? 'amend' : 'drop', art: worst.id };
  if (best && best.att[g.id] >= 2 && roll < 0.85) return { kind: 'protect', art: best.id };
  return { kind: 'add', art: 0 };
}

/* ── Le score de soutien d'un groupe ── */

export interface SPart { k: string; label: string; v: number }

export const RED = 3;
const lvF = (lv: Level) => (lv === 2 ? 1 : lv === 1 ? 0.5 : 0);

export function attAt(a: Article, g: Gid, lv: Level, ch: Chamber = 'an'): number {
  if (!lv) return 0;
  const x = (a.att[g] ?? 0) + (ch === 'sen' ? a.senB : 0);
  return lv === 2 ? x : Math.trunc(x / 2);
}

export function dealHonored(G: Game, g: Group, lv: Record<number, Level>): boolean {
  const d = g.demand;
  if (!d) return true;
  const l = lv[d.art] ?? 0;
  if (d.kind === 'drop') return l === 0;
  if (d.kind === 'amend') return l <= 1;
  if (d.kind === 'protect') return l === 2;
  const ex = G.arts.find(a => a.extra === g.id);
  return !!ex && (lv[ex.id] ?? 0) === 2;
}

export function pressureFx(G: Game, g: Group): number {
  if (G.v !== 'reforme') return 0;
  if (g.coal) return G.pressure >= 5 ? -1 : 0;
  if (Math.abs(g.pos - 8) >= 70) return 0;
  return -Math.min(2, Math.floor(G.pressure / 2));
}

/** Le détail du soutien ; « believed » : ce que le gouvernement sait (lignes rouges non consultées exclues) */
export function sParts(G: Game, g: Group, ch: Chamber = 'an', lv: Record<number, Level> = levels(G), believed = false): SPart[] {
  const out: SPart[] = [{ k: 'base', label: g.coal ? 'Majorité' : 'Opposition', v: g.base }];
  let arts = 0;
  for (const a of G.arts) arts += attAt(a, g.id, lv[a.id] ?? 0, ch);
  out.push({ k: 'arts', label: 'Contenu du texte', v: arts });
  if (g.red !== null && (lv[g.red] ?? 0) === 2 && (!believed || g.known)) out.push({ k: 'red', label: 'Ligne rouge franchie', v: -RED });
  if (g.deal) out.push(dealHonored(G, g, lv) ? { k: 'deal', label: 'Accord respecté', v: 2 } : { k: 'deal', label: 'Accord trahi', v: -2 });
  if (g.anger) out.push({ k: 'anger', label: 'Colère (passage en force)', v: -g.anger });
  const p = pressureFx(G, g);
  if (p) out.push({ k: 'rue', label: 'Pression de la rue', v: p });
  return out;
}
export const sOf = (G: Game, g: Group, ch: Chamber = 'an', lv: Record<number, Level> = levels(G), believed = false): number =>
  sParts(G, g, ch, lv, believed).reduce((t, p) => t + p.v, 0);

/** Pour, abstention, contre selon le soutien */
export function split(S: number): [number, number, number] {
  if (S >= 3) return [1, 0, 0];
  if (S === 2) return [0.9, 0.1, 0];
  if (S === 1) return [0.7, 0.3, 0];
  if (S === 0) return [0.15, 0.7, 0.15];
  if (S === -1) return [0, 0.7, 0.3];
  if (S === -2) return [0, 0.3, 0.7];
  return [0, 0, 1];
}
export function censureShare(g: Group, S: number): number {
  if (g.coal) return S <= -4 ? 0.3 : 0;
  return S <= -4 ? 1 : S === -3 ? 0.9 : S === -2 ? 0.5 : S === -1 ? 0.15 : 0;
}

export interface Row { g: Gid; seats: number; S: number; p: number; a: number; c: number }
export interface Tally { rows: Row[]; p: number; a: number; c: number; need: number; ok: boolean; kind: 'simple' | 'censure' | 'tpf'; total: number; ch: Chamber }

export function seatsIn(g: Group, ch: Chamber): number { return ch === 'com' ? g.com : ch === 'sen' ? g.sen : ch === 'an' ? g.an : g.an + g.sen; }
export const totalSeats = (ch: Chamber) => (ch === 'com' ? COM_SEATS : ch === 'sen' ? SEN_SEATS : ch === 'an' ? AN_SEATS : AN_SEATS + SEN_SEATS);

function rowOf(g: Group, seats: number, S: number, f: [number, number, number]): Row {
  const p = Math.round(seats * f[0]), c = Math.min(seats - p, Math.round(seats * f[2]));
  return { g: g.id, seats, S, p, a: seats - p - c, c };
}
function sumUp(rows: Row[], kind: Tally['kind'], ch: Chamber): Tally {
  const p = rows.reduce((t, x) => t + x.p, 0), a = rows.reduce((t, x) => t + x.a, 0), c = rows.reduce((t, x) => t + x.c, 0);
  let need: number, ok: boolean;
  if (kind === 'censure') { need = CENSURE; ok = p >= CENSURE; }
  else if (kind === 'tpf') { need = Math.ceil(0.6 * (p + c)); ok = p + c > 0 && p >= need; }
  else { need = Math.floor((p + c) / 2) + 1; ok = p > c; }
  return { rows, p, a, c, need, ok, kind, total: totalSeats(ch), ch };
}

/** Le vote sur l'ensemble du texte */
export function tally(G: Game, ch: Chamber, lv: Record<number, Level> = levels(G), believed = false): Tally {
  const kind = ch === 'congres' ? 'tpf' : 'simple';
  const rows = G.groups.map(g => {
    if (ch !== 'congres') { const S = sOf(G, g, ch, lv, believed); return rowOf(g, seatsIn(g, ch), S, split(S)); }
    const Sa = sOf(G, g, 'an', lv, believed), Ss = sOf(G, g, 'sen', lv, believed);
    const ra = rowOf(g, g.an, Sa, split(Sa)), rs = rowOf(g, g.sen, Ss, split(Ss));
    return { g: g.id, seats: g.an + g.sen, S: Sa, p: ra.p + rs.p, a: ra.a + rs.a, c: ra.c + rs.c };
  });
  return sumUp(rows, kind, ch);
}

export function censureTally(G: Game, lv: Record<number, Level> = levels(G), believed = false, extraAnger = 0): Tally {
  const rows = G.groups.map(g => {
    const S = sOf(G, g, 'an', lv, believed) - (g.coal ? 0 : extraAnger);
    const f = censureShare(g, S);
    const p = Math.round(g.an * f);
    return { g: g.id, seats: g.an, S, p, a: 0, c: g.an - p };
  });
  const t = sumUp(rows, 'censure', 'an');
  return { ...t, a: t.c, c: 0 };
}

/** Le vote sur un amendement : chacun compare le texte avant et après */
export function amdtDelta(G: Game, g: Group, am: Amdt, lv: Record<number, Level>, believed = false): number {
  const a = aOf(G, am.art);
  if (!a) return 0;
  const ch = am.ch === 'congres' ? 'an' : am.ch;
  const from = lv[am.art] ?? 0, to = am.to;
  let d = attAt(a, g.id, to, ch) - attAt(a, g.id, from, ch);
  if (g.red === a.id && (!believed || g.known)) { if (from === 2 && to < 2) d += 3; if (from < 2 && to === 2) d -= 3; }
  if (g.deal) {
    const after = { ...lv, [am.art]: to };
    const h0 = dealHonored(G, g, lv), h1 = dealHonored(G, g, after);
    if (h0 && !h1) d -= 3; else if (!h0 && h1) d += 3;
  }
  return d;
}

export function amdtTally(G: Game, am: Amdt, lv: Record<number, Level> = levels(G), believed = false): Tally {
  const ch = am.ch;
  const rows = G.groups.map(g => {
    const d = amdtDelta(G, g, am, lv, believed);
    const disciplined = g.coal || g.deal;
    let f: [number, number, number];
    if (g.id === am.by) f = [1, 0, 0];
    else if (disciplined) f = d >= 3 ? [0.5, 0.5, 0] : d === 2 ? [0.2, 0.8, 0] : d === 1 ? [0, 0.6, 0.4] : [0, 0.1, 0.9];
    else f = d >= 2 ? [1, 0, 0] : d === 1 ? [0.75, 0.25, 0] : d === 0 ? [0, 1, 0] : d === -1 ? [0, 0.25, 0.75] : [0, 0, 1];
    return rowOf(g, seatsIn(g, ch), d, f);
  });
  return sumUp(rows, 'simple', ch);
}

/* ── Ambition, déficit, score ── */

export function ambition(G: Game, lv: Record<number, Level> = levels(G)): number {
  return clamp(G.arts.filter(a => !a.extra).reduce((t, a) => t + a.amb * lvF(lv[a.id] ?? 0), 0) / 100);
}
export function coreRatio(G: Game, lv: Record<number, Level> = levels(G)): number {
  const core = G.arts.filter(a => a.core);
  const tot = core.reduce((t, a) => t + a.amb, 0);
  return tot ? core.reduce((t, a) => t + a.amb * lvF(lv[a.id] ?? 0), 0) / tot : 0;
}
export function deficit(G: Game, lv: Record<number, Level> = levels(G)): number {
  return Math.round((G.defBase - G.arts.reduce((t, a) => t + a.fiscal * lvF(lv[a.id] ?? 0), 0) / 30) * 100) / 100;
}
export function defFactor(G: Game, lv: Record<number, Level> = levels(G)): number {
  if (G.v !== 'budget') return 1;
  const over = deficit(G, lv) - G.target;
  return over <= 0.001 ? 1 : clamp(1 - over * 1.3, 0.5, 1);
}
/** Le score si le texte était adopté tel quel */
export function adoptedScore(G: Game, lv: Record<number, Level> = levels(G)): number {
  return clamp((0.5 + 0.5 * ambition(G, lv)) * defFactor(G, lv));
}
export function finalScore(G: Game): number {
  if (G.status === 'censure') return 0.1;
  if (G.status === 'lost') return clamp(0.12 + 0.05 * G.lostAt + 0.04 * ambition(G), 0, 0.38);
  return adoptedScore(G);
}

/* ── Les règles du jeu : actions ── */

export type Action =
  | { t: 'consult'; g: Gid }
  | { t: 'amend'; a: number }
  | { t: 'drop'; a: number }
  | { t: 'deal'; g: Gid }
  | { t: 'night' }
  | { t: 'concert' }
  | { t: 'senat'; a: number };

export const COST: Record<Action['t'], { temps: number; capital: number }> = {
  consult: { temps: 1, capital: 0 }, amend: { temps: 1, capital: 0 }, drop: { temps: 1, capital: 0 }, deal: { temps: 1, capital: 2 },
  night: { temps: 0, capital: 1 }, concert: { temps: 1, capital: 1 }, senat: { temps: 1, capital: 0 },
};

export const textFixed = (G: Game) => G.mode === 'conclusions' || G.mode === 'congres' || G.mode === 'cmp';
export const anStage = (G: Game) => (G.stage === 1 || (G.stage === 4 && G.mode !== 'congres'));

export function canDo(G: Game, act: Action): string | null {
  if (G.status !== 'play') return 'La partie est finie';
  const c = COST[act.t];
  if (G.temps < c.temps) return 'Plus de temps de parole';
  if (G.capital < c.capital) return 'Capital politique épuisé';
  switch (act.t) {
    case 'consult': { const g = gOf(G, act.g); return g.known ? 'Déjà consulté' : null; }
    case 'amend': case 'drop': {
      if (textFixed(G)) return G.mode === 'cmp' ? 'Le texte se négocie dans le tableau de la CMP' : 'Le texte ne peut plus être modifié';
      const a = aOf(G, act.a);
      if (!a || a.level === 0) return 'Article déjà supprimé';
      if (act.t === 'amend' && a.level < 2) return 'Article déjà amendé';
      return null;
    }
    case 'deal': {
      const g = gOf(G, act.g);
      if (!g.known) return 'Consultez d’abord ce groupe';
      if (g.deal) return 'Accord déjà conclu';
      if (!g.demand) return 'Ce groupe ne négocie pas';
      if (textFixed(G) && !(dealHonored(G, g, levels(G)) && g.demand.kind !== 'add')) return 'Le texte ne peut plus être modifié pour satisfaire cette demande';
      if (g.demand.kind === 'protect' && (aOf(G, g.demand.art)?.level ?? 0) < 2) return 'L’article n’est plus intact';
      return null;
    }
    case 'night': return !anStage(G) ? 'Seulement à l’Assemblée' : G.night ? 'Une seule séance de nuit par lecture' : null;
    case 'concert': return G.v !== 'reforme' ? 'Pas de mouvement social' : G.concert ? 'Déjà reçus à cette étape' : G.pressure <= 0 ? 'Le mouvement s’est éteint' : null;
    case 'senat': {
      if (G.mode !== 'definitive' || !G.sen) return 'Seulement en lecture définitive';
      const a = aOf(G, act.a);
      if (!a || G.sen[a.id] === undefined || G.sen[a.id] === a.level) return 'Même version qu’au Sénat';
      return null;
    }
  }
}

export interface Fx { msg: string; bad?: boolean }

export function applyAction(G: Game, act: Action, r: Rnd): Fx[] {
  const out: Fx[] = [];
  const c = COST[act.t];
  G.temps -= c.temps;
  G.capital -= c.capital;
  G.acts++;
  switch (act.t) {
    case 'consult': {
      const g = gOf(G, act.g);
      g.known = true;
      const red = g.red !== null ? aOf(G, g.red) : null;
      out.push({ msg: `🗣️ ${g.name} : ${red ? `ligne rouge sur l’article ${red.n}` : 'pas de ligne rouge'} ; ${demandLabel(G, g)}.` });
      break;
    }
    case 'amend': case 'drop': {
      const a = aOf(G, act.a)!;
      const was = a.level;
      a.level = act.t === 'amend' ? 1 : 0;
      G.pending = G.pending.filter(p => !(p.art === a.id && p.to >= a.level));
      if (G.v === 'reforme' && a.core) G.pressure = Math.max(0, G.pressure - (act.t === 'drop' ? 2 : 1));
      out.push({ msg: `✏️ Article ${a.n} ${act.t === 'amend' ? 'réécrit' : 'supprimé'} par le gouvernement${was === 2 && a.core && G.v === 'reforme' ? ' : la rue souffle' : ''}.` });
      break;
    }
    case 'deal': {
      const g = gOf(G, act.g);
      const d = g.demand!;
      if (d.kind === 'drop' || d.kind === 'amend') {
        const a = aOf(G, d.art);
        if (a && a.level > (d.kind === 'drop' ? 0 : 1)) { a.level = d.kind === 'drop' ? 0 : 1; G.pending = G.pending.filter(p => !(p.art === a.id && p.to >= a.level)); }
      } else if (d.kind === 'add') addExtra(G, g.id, 2);
      g.deal = true;
      out.push({ msg: `🤝 Accord avec ${g.name} : ${demandLabel(G, g, true)}.` });
      break;
    }
    case 'night': G.temps += 2; G.night = true; G.acts--; if (G.v === 'reforme') G.pressure = Math.min(6, G.pressure + 1); out.push({ msg: '🌙 Séance de nuit : +2 temps de parole.' }); break;
    case 'concert': G.pressure = Math.max(0, G.pressure - 1); G.concert = true; out.push({ msg: '🤲 Les syndicats sont reçus à Matignon : la mobilisation faiblit.' }); break;
    case 'senat': { const a = aOf(G, act.a)!; a.level = G.sen![a.id]; out.push({ msg: `🏛️ L’Assemblée reprend la version du Sénat pour l’article ${a.n}.` }); break; }
  }
  return out;
}

export function demandLabel(G: Game, g: Group, done = false): string {
  const d = g.demand;
  if (!d) return 'aucune demande';
  if (d.kind === 'add') return `${done ? 'ajout de' : 'réclame'} « ${BILLS[G.v].pets[g.id].title} »`;
  const a = aOf(G, d.art);
  const n = a ? `l’article ${a.n}` : 'un article';
  return d.kind === 'drop' ? `${done ? 'suppression de' : 'exige la suppression de'} ${n}` : d.kind === 'amend' ? `${done ? 'réécriture de' : 'veut la réécriture de'} ${n}` : `${done ? 'garantie sur' : 'votera si l’on garantit'} ${n}${done ? '' : ' intact'}`;
}

function addExtra(G: Game, gid: Gid, lv: Level): Article {
  const ex = G.arts.find(a => a.extra === gid);
  if (ex) { ex.level = lv; return ex; }
  const pet = BILLS[G.v].pets[gid];
  const att = {} as Record<Gid, number>;
  // Les autres groupes voient d'un œil au mieux poli la mesure fétiche d'un rival
  for (const g of G.groups) att[g.id] = clamp(attFor(g.pos, pet.pos, 10) - (Math.abs(g.pos - pet.pos) > 25 ? 1 : 0), -2, 1);
  att[gid] = 3;
  const a: Article = { id: ++G.nextId, n: G.arts.length + 1, title: pet.title, desc: 'Article additionnel.', amb: 0, pos: pet.pos, att, level: lv, core: false, fiscal: pet.fiscal ?? 0, senB: 0, extra: gid };
  G.arts.push(a);
  if (G.an) G.an[a.id] = G.an[a.id] ?? 0;
  if (G.sen) G.sen[a.id] = G.sen[a.id] ?? 0;
  return a;
}

/* ── L'intelligence de l'opposition ── */

const hostileSeats = (G: Game) => G.groups.filter(g => !g.coal && !g.deal && sOf(G, g, 'an') <= -3).reduce((t, g) => t + g.an, 0);

function bestFiler(G: Game, am: Amdt, lv: Record<number, Level>, ch: Chamber): Gid | null {
  let best: Gid | null = null, bd = 0;
  for (const g of G.groups) {
    if (g.coal || g.deal || seatsIn(g, ch) === 0) continue;
    const d = amdtDelta(G, g, { ...am, by: g.id }, lv);
    if (d > bd || (d === bd && d > 0 && best && seatsIn(g, ch) > seatsIn(gOf(G, best), ch))) { bd = d; best = g.id; }
  }
  return bd >= 1 ? best : null;
}

/** Les amendements hostiles que l'opposition juge les plus prometteurs */
export function planAmendments(G: Game, ch: Chamber, k: number): Amdt[] {
  const lv = levels(G);
  const cands: { am: Amdt; v: number }[] = [];
  for (const a of G.arts) {
    if (a.level === 0 || G.pending.some(p => p.art === a.id)) continue;
    for (const to of (a.level === 2 ? [0, 1] : [0]) as Level[]) {
      const am: Amdt = { id: 0, num: 0, by: 'FDL', art: a.id, to, ch, kind: to === 0 ? 'sup' : 'rew' };
      const by = bestFiler(G, am, lv, ch);
      if (!by) continue;
      am.by = by;
      const t = amdtTally(G, am, lv);
      const harm = a.extra ? 0 : a.amb * (lvF(a.level) - lvF(to));
      const margin = (t.p - t.c) / Math.max(1, t.p + t.c);
      cands.push({ am, v: (t.ok ? 3 : 0) + margin + harm / 12 });
    }
  }
  cands.sort((x, y) => y.v - x.v);
  const out: Amdt[] = [];
  for (const c of cands) {
    if (out.length >= k) break;
    if (out.some(o => o.art === c.am.art)) continue;
    out.push({ ...c.am, id: ++G.nextId, num: (G.amendNo += 7 + Math.floor(c.v * 13) % 40) });
  }
  return out;
}

/** Ce que la majorité sénatoriale réécrit, rétablit ou ajoute */
export function planSenate(G: Game, r: Rnd): Amdt[] {
  const lv = levels(G);
  // La majorité sénatoriale : les Conservateurs et l'Alliance des territoires
  const leaders = (['CONS', 'ADT'] as Gid[]).filter(id => G.groups.some(g => g.id === id));
  const cands: { am: Amdt; v: number }[] = [];
  const consider = (am: Amdt) => {
    const t = amdtTally(G, am, lv);
    if (!t.ok) return;
    const ds = leaders.map(id => amdtDelta(G, gOf(G, id), am, lv));
    if (ds.some(d => d < 0) || !ds.some(d => d >= 1)) return;
    cands.push({ am, v: ds.reduce((s, d) => s + d, 0) + (t.p - t.c) / Math.max(1, t.p + t.c) });
  };
  for (const a of G.arts) {
    const by = leaders[0];
    if (a.level > 0) for (const to of (a.level === 2 ? [0, 1] : [0]) as Level[]) consider({ id: 0, num: 0, by, art: a.id, to, ch: 'sen', kind: to === 0 ? 'sup' : 'rew' });
    else if (!a.extra) consider({ id: 0, num: 0, by, art: a.id, to: 1, ch: 'sen', kind: 'ret' });
  }
  cands.sort((x, y) => y.v - x.v);
  const k = 2 + (G.diff >= 1.05 ? 1 : 0) + (G.diff >= 1.3 ? 1 : 0);
  const out: Amdt[] = [];
  for (const c of cands) {
    if (out.length >= k) break;
    if (out.some(o => o.art === c.am.art)) continue;
    // Le Sénat préfère la réécriture à la suppression quand les deux passent
    out.push({ ...c.am, id: ++G.nextId, num: (G.amendNo += 3 + Math.floor(r() * 30)) });
  }
  // L'article additionnel de la majorité sénatoriale
  const lead = gOf(G, leaders[0]);
  if (!G.arts.some(a => a.extra === lead.id) && r() < 0.75) {
    const ex = addExtra(G, lead.id, 0);
    const am: Amdt = { id: ++G.nextId, num: (G.amendNo += 11), by: lead.id, art: ex.id, to: 2, ch: 'sen', kind: 'add' };
    if (amdtTally(G, am).ok) out.push(am); else G.arts = G.arts.filter(a => a.id !== ex.id);
  }
  return out;
}

/* ── Les étapes ── */

export interface Intro { title: string; lines: Fx[] }

export function startStage(G: Game, r: Rnd): Intro {
  G.night = false; G.concert = false; G.acts = 0; G.wave2 = false;
  const lines: Fx[] = [];
  const hard = G.diff >= 1.2;
  if (G.v === 'reforme' && G.stage >= 1 && G.mode !== 'cmp') {
    const cr = coreRatio(G);
    const inc = cr >= 0.6 ? 2 : cr > 0.25 ? 1 : -1;
    G.pressure = clamp(G.pressure + inc, 0, 6);
    const n = [0, 0.3, 0.6, 0.9, 1.3, 1.8, 2.5][G.pressure];
    lines.push(inc > 0 ? { msg: `✊ Nouvelle journée de mobilisation : ${n.toLocaleString('fr-FR')} million${n >= 2 ? 's' : ''} de manifestants.`, bad: true } : { msg: '✊ Le mouvement social s’essouffle.' });
  }
  if (G.stage === 0) {
    G.temps = 4;
    G.pending = planAmendments(G, 'com', 1);
    lines.push({ msg: `📑 La commission examine le texte. ${G.pending.length ? `L’opposition dépose ${G.pending.length > 1 ? 'des amendements' : 'un amendement'}.` : ''}` });
  } else if (G.stage === 1) {
    G.temps = 6 - (G.comOk === false ? 1 : 0);
    const h = hostileSeats(G);
    const cost = clamp(Math.round((h * G.diff) / 120), 0, 3);
    if (cost) {
      G.temps = Math.max(1, G.temps - cost);
      lines.push({ msg: `📚 Obstruction : ${(Math.round(h * (9 + r() * 6) / 10) * 10).toLocaleString('fr-FR')} amendements déposés (−${cost} temps).`, bad: true });
    }
    if (G.comOk === false) lines.push({ msg: '📑 Sans l’appui de la commission, le gouvernement redépose ses amendements (−1 temps).', bad: true });
    G.pending = planAmendments(G, 'an', 2 + (hard ? 1 : 0));
    lines.push({ msg: `🏛️ Séance publique : ${G.pending.length} amendement${G.pending.length > 1 ? 's' : ''} hostile${G.pending.length > 1 ? 's' : ''} en discussion.` });
  } else if (G.stage === 2) {
    G.temps = 3;
    G.pending = planSenate(G, r);
    lines.push({ msg: `🏛️ La majorité sénatoriale réécrit le texte : ${G.pending.length} amendement${G.pending.length > 1 ? 's' : ''} de sa commission.` });
  } else if (G.stage === 3) {
    G.temps = 2;
    G.pending = [];
    if (G.v === 'constitution') lines.push({ msg: '📜 Deuxième lecture : les deux chambres doivent voter le même texte, mot pour mot.' });
    else lines.push({ msg: G.sen ? '🤝 Sept députés, sept sénateurs : trouvez un texte commun.' : '🤝 Le Sénat a rejeté le texte : la CMP part de la version de l’Assemblée.', bad: !G.sen });
  } else {
    G.pending = [];
    if (G.mode === 'congres') { G.temps = 3; lines.push({ msg: '🏰 Le Congrès est convoqué à Versailles : il faut les trois cinquièmes des suffrages exprimés.' }); }
    else if (G.mode === 'conclusions') { G.temps = 2; lines.push({ msg: '📜 Le Sénat a adopté les conclusions de la CMP : dernier vote à l’Assemblée.' }); }
    else {
      G.temps = 4;
      const h = hostileSeats(G);
      const cost = clamp(Math.round((h * G.diff) / 160), 0, 2);
      if (cost) { G.temps -= cost; lines.push({ msg: `📚 Nouvelle obstruction : −${cost} temps.`, bad: true }); }
      G.pending = planAmendments(G, 'an', 1);
      lines.push({ msg: '🏛️ Nouvelle lecture puis lecture définitive : l’Assemblée a le dernier mot.' });
    }
  }
  return { title: stageTitle(G), lines };
}

export function stageTitle(G: Game): string {
  if (G.stage === 3) return G.v === 'constitution' ? 'Deuxième lecture' : 'Commission mixte paritaire';
  if (G.stage === 4) return G.mode === 'congres' ? 'Congrès du Parlement' : G.mode === 'conclusions' ? 'Conclusions de la CMP' : 'Lecture définitive';
  return ['Commission', 'Séance publique', 'Sénat'][G.stage];
}

/** La seconde vague d'obstruction, après quelques actions du gouvernement en séance */
export function aiReact(G: Game, r: Rnd): Fx[] {
  if (G.stage !== 1 || G.wave2 || G.acts < 2 || G.status !== 'play') return [];
  G.wave2 = true;
  const h = hostileSeats(G);
  if (h < 140 / G.diff) return [];
  const more = planAmendments(G, 'an', 1);
  G.pending.push(...more);
  const cost = G.temps > 1 ? 1 : 0;
  G.temps -= cost;
  return [{ msg: `📚 Seconde vague : ${(Math.round(h * (4 + r() * 4) / 10) * 10).toLocaleString('fr-FR')} sous-amendements${cost ? ' (−1 temps)' : ''}${more.length ? `, et un amendement sur l’article ${aOf(G, more[0].art)!.n}` : ''}.`, bad: true }];
}

/** Ce que donnerait l'examen des amendements puis le vote, d'après les informations du gouvernement */
export interface Forecast { res: { am: Amdt; t: Tally }[]; lv: Record<number, Level>; final: Tally }
export function forecast(G: Game, believed = true): Forecast {
  const ch = voteChamber(G);
  let lv = levels(G);
  const res: { am: Amdt; t: Tally }[] = [];
  for (const am of G.pending) {
    if (!aOf(G, am.art)) continue;
    if (am.to >= (lv[am.art] ?? 0) && am.kind !== 'ret' && am.kind !== 'add') continue;
    const t = amdtTally(G, am, lv, believed);
    res.push({ am, t });
    if (t.ok) lv = { ...lv, [am.art]: am.to };
  }
  return { res, lv, final: tally(G, ch, lv, believed) };
}

export function voteChamber(G: Game): Chamber {
  if (G.stage === 0) return 'com';
  if (G.stage === 2) return 'sen';
  if (G.stage === 4 && G.mode === 'congres') return 'congres';
  return 'an';
}

export const can493 = (G: Game): string | null =>
  G.v === 'constitution' ? 'Interdit pour une révision constitutionnelle'
    : !anStage(G) ? 'Seulement en séance à l’Assemblée'
      : G.v !== 'budget' && G.used493 >= 1 ? 'Déjà utilisé : une fois par session'
        : G.capital < 3 ? 'Capital politique insuffisant (3)' : null;
export const canBloque = (G: Game): string | null =>
  !anStage(G) && G.stage !== 2 ? 'Seulement en séance publique'
    : G.mode === 'conclusions' ? 'Le texte de la CMP se vote déjà en bloc'
      : G.capital < 2 ? 'Capital politique insuffisant (2)' : null;

export interface Resolution { kind: 'vote' | '493' | 'bloque'; res: { am: Amdt; t: Tally }[]; final: Tally | null; censure: Tally | null; passed: boolean; lines: Fx[] }

/** Clôt l'étape : examen des amendements et vote (ou 49.3, ou vote bloqué) */
export function resolveStage(G: Game, kind: Resolution['kind']): Resolution {
  const lines: Fx[] = [];
  const ch = voteChamber(G);
  let res: Resolution['res'] = [];
  let final: Tally | null = null, censure: Tally | null = null;
  if (kind === '493' || kind === 'bloque') {
    G.capital -= kind === '493' ? 3 : 2;
    for (const g of G.groups) if (!g.coal) g.anger++;
    if (G.pending.length) lines.push({ msg: `🗑️ ${G.pending.length} amendement${G.pending.length > 1 ? 's' : ''} écarté${G.pending.length > 1 ? 's' : ''} d’un coup.` });
    G.pending = [];
  } else {
    const f = forecast(G, false);
    res = f.res;
    for (const x of res) if (x.t.ok) {
      const a = aOf(G, x.am.art)!;
      a.level = x.am.to;
      lines.push({ msg: `${x.am.kind === 'add' ? '➕' : x.am.kind === 'ret' ? '↩️' : '✂️'} Amendement n° ${x.am.num} adopté : article ${a.n} ${x.am.kind === 'sup' ? 'supprimé' : x.am.kind === 'rew' ? 'réécrit' : x.am.kind === 'ret' ? 'rétabli' : 'ajouté'}.`, bad: x.am.kind === 'sup' || x.am.kind === 'rew' });
    }
    G.pending = [];
  }
  if (kind === '493') {
    G.used493++;
    censure = censureTally(G);
    const passed = !censure.ok;
    if (!passed) { G.status = 'censure'; lines.push({ msg: `🔥 Motion de censure adoptée par ${censure.p} voix : le gouvernement tombe.`, bad: true }); }
    else lines.push({ msg: `🛡️ Motion de censure rejetée : ${censure.p} voix sur ${CENSURE} requises. Le texte est considéré comme adopté.` });
    if (passed) advance(G, lines);
    return { kind, res, final, censure, passed, lines };
  }
  final = tally(G, ch);
  const passed = final.ok;
  const where = ch === 'com' ? 'la commission' : ch === 'sen' ? 'le Sénat' : ch === 'congres' ? 'le Congrès' : 'l’Assemblée';
  lines.push({ msg: `🗳️ ${passed ? 'Adopté' : 'Rejeté'} par ${where} : ${final.p} pour, ${final.c} contre${final.kind === 'tpf' ? ` (${final.need} requis)` : ''}.`, bad: !passed });
  if (G.stage === 0) { G.comOk = passed; G.stage = 1; }
  else if (G.stage === 2) {
    G.sen = passed ? levels(G) : null;
    // Le texte repart de la version de l'Assemblée pour la suite
    for (const a of G.arts) a.level = G.an![a.id] ?? 0;
    G.stage = 3; G.mode = 'cmp';
    if (G.v === 'constitution' && !passed) { /* la deuxième lecture partira du texte de l'Assemblée */ }
  } else if (passed) advance(G, lines);
  else if (G.stage === 4 && G.mode === 'conclusions') {
    // ne se produit que si l'Assemblée rejette les conclusions : lecture définitive impossible, échec
    G.status = 'lost'; G.lostAt = 4;
  } else { G.status = 'lost'; G.lostAt = G.stage; }
  return { kind, res, final, censure, passed, lines };
}

function advance(G: Game, lines: Fx[]): void {
  if (G.stage === 1) { G.an = levels(G); G.stage = 2; return; }
  if (G.stage === 4) { G.status = 'won'; lines.push({ msg: '🎉 Le texte est définitivement adopté.' }); }
}

/* ── CMP / deuxième lecture ── */

/** Les niveaux possibles d'un article entre la version de l'Assemblée et celle du Sénat */
export function cmpRange(G: Game, a: Article): Level[] {
  const an = G.an?.[a.id] ?? 0;
  const sn = G.sen ? G.sen[a.id] ?? 0 : 0;
  const lo = G.sen ? Math.min(an, sn) : 0, hi = G.sen ? Math.max(an, sn) : an;
  const out: Level[] = [];
  for (let l = hi; l >= lo; l--) out.push(l as Level);
  return out;
}
export function cmpSet(G: Game, id: number, lv: Level): void {
  const a = aOf(G, id);
  if (a && cmpRange(G, a).includes(lv)) a.level = lv;
}

export interface Member { g: Gid; ch: 'an' | 'sen'; pour: boolean; S: number }
export function cmpMembers(G: Game, lv: Record<number, Level> = levels(G), believed = true): Member[] {
  const out: Member[] = [];
  for (const ch of ['an', 'sen'] as const) {
    const seats = apportion(G.groups.map(g => seatsIn(g, ch)), 7);
    G.groups.forEach((g, i) => {
      const S = sOf(G, g, ch, lv, believed);
      for (let k = 0; k < seats[i]; k++) out.push({ g: g.id, ch, pour: S >= 1, S });
    });
  }
  return out;
}

export interface CmpCheck { members: Member[]; yes: number; an: Tally; sen: Tally; ok: boolean }
export function cmpCheck(G: Game, believed = true): CmpCheck {
  const lv = levels(G);
  const members = cmpMembers(G, lv, believed);
  const yes = members.filter(m => m.pour).length;
  const an = tally(G, 'an', lv, believed), sen = tally(G, 'sen', lv, believed);
  return { members, yes, an, sen, ok: G.v === 'constitution' ? an.ok && sen.ok : yes >= 8 };
}

/** Conclure (ou constater l'échec) */
export function cmpConclude(G: Game, agree: boolean): { lines: Fx[]; check: CmpCheck } {
  const lines: Fx[] = [];
  const check = cmpCheck(G, false);
  G.stage = 4;
  if (G.v === 'constitution') {
    if (agree && check.ok) { G.mode = 'congres'; lines.push({ msg: `📜 Texte voté en termes identiques : ${check.an.p} députés et ${check.sen.p} sénateurs pour.` }); }
    else { G.status = 'lost'; G.lostAt = 3; lines.push({ msg: agree ? `📜 ${!check.sen.ok ? 'Le Sénat' : 'L’Assemblée'} refuse le texte : la révision est enterrée.` : '📜 Faute d’accord entre les chambres, la révision est enterrée.', bad: true }); }
    return { lines, check };
  }
  if (agree && check.ok) {
    lines.push({ msg: `🤝 Accord en CMP : ${check.yes} voix sur 14.` });
    if (check.sen.ok) { G.mode = 'conclusions'; lines.push({ msg: `🏛️ Le Sénat adopte les conclusions : ${check.sen.p} pour, ${check.sen.c} contre.` }); }
    else { G.mode = 'definitive'; G.senRejectedCmp = true; for (const a of G.arts) a.level = G.an![a.id] ?? 0; lines.push({ msg: `🏛️ Le Sénat rejette les conclusions (${check.sen.p} pour, ${check.sen.c} contre) : nouvelle lecture.`, bad: true }); }
  } else {
    G.mode = 'definitive';
    for (const a of G.arts) a.level = G.an![a.id] ?? 0;
    lines.push({ msg: agree ? `🤝 La CMP échoue : ${check.yes} voix sur 14 seulement.` : '🤝 Désaccord constaté en CMP.', bad: true });
  }
  return { lines, check };
}

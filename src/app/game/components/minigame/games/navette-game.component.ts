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
  const tgt = -0.06 - 0.08 * clamp((G.diff - 0.8) / 0.6, -0.5, 1.5) - (G.v === 'budget' ? 0.015 : 0);
  const coal = G.groups.filter(g => g.coal), opp = G.groups.filter(g => !g.coal);
  for (let k = 0; k < 80; k++) {
    const m = startMargin(G);
    if (Math.abs(m - tgt) <= 0.02) break;
    const coalSeats = coal.reduce((t, g) => t + g.an, 0);
    // Des sièges passent entre le premier groupe de la majorité et l'opposition « pivot » (hostile mais persuadable),
    // pour que l'arithmétique se joue sur des groupes qu'on peut convaincre
    const pivot = (g: Group) => { const S = sOf(G, g); return S > 0 ? 99 : Math.abs(S + 2.5); };
    const big = [...coal].sort((a, b) => b.an - a.an)[0];
    const piv = [...opp].filter(g => g.an < 130).sort((a, b) => pivot(a) - pivot(b) || b.an - a.an)[0] ?? opp[0];
    const from = m > tgt ? big : [...opp].sort((a, b) => sOf(G, a) - sOf(G, b) || b.an - a.an)[0];
    const to = m > tgt ? piv : big;
    if (m > tgt && coalSeats <= AN_SEATS * 0.3) {
      // La majorité est déjà maigre : l'opposition la plus conciliante durcit sa posture
      const soft = [...opp].sort((a, b) => sOf(G, b) - sOf(G, a))[0];
      soft.base--;
      continue;
    }
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

export function applyAction(G: Game, act: Action): Fx[] {
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
    // Si le Sénat rejette, la CMP (ou la deuxième lecture) part du texte de l'Assemblée
    G.stage = 3; G.mode = 'cmp';
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

/* ============================================================
 *  Le composant
 * ============================================================ */

/** L'hémicycle : fauteuils en gradins concentriques, travées séparées par des allées, ordonnés de gauche à droite */
interface Seat { x: number; y: number; t: string }
interface Geo { seats: Seat[]; r: number; rank: number[]; table: boolean; rows: number[]; aisles: string[]; r0: number; floor: number }
const GEO = new Map<number, Geo>();
const deg = (a: number) => (a * 180) / Math.PI;
function geometry(n: number): Geo {
  const hit = GEO.get(n);
  if (hit) return hit;
  // La commission mixte paritaire siège autour d'une table : députés d'un côté, sénateurs de l'autre
  if (n <= 16) {
    const half = Math.ceil(n / 2);
    const seats: Seat[] = [];
    for (let i = 0; i < n; i++) {
      const top = i < half, k = top ? i : i - half, m = top ? half : n - half;
      const x = 50 + (m === 1 ? 50 : (k * 100) / (m - 1)), y = top ? 39 : 75;
      seats.push({ x, y, t: `translate(${x} ${y}) rotate(${top ? 180 : 0}) scale(11 9)` });
    }
    const g: Geo = { seats, r: 5, rank: seats.map((_, i) => i), table: true, rows: [], aisles: [], r0: 0, floor: 0 };
    GEO.set(n, g);
    return g;
  }
  const rows = n <= 90 ? 4 : n <= 400 ? 9 : n <= 650 ? 12 : 15;
  const r0 = n <= 90 ? 0.46 : 0.38;
  const S = n <= 90 ? 3 : n <= 400 ? 6 : n <= 650 ? 7 : 9;
  const G = n <= 90 ? 0.07 : 0.042;
  const usable = Math.PI - G * (S - 1), w = usable / S;
  const radii = Array.from({ length: rows }, (_, i) => r0 + ((1 - r0) * i) / Math.max(1, rows - 1));
  const counts = apportion(radii, n);
  const pts: { x: number; y: number; a: number; rr: number }[] = [];
  radii.forEach((R, i) => {
    const c = counts[i];
    for (let k = 0; k < c; k++) {
      const u = ((k + 0.5) / c) * usable;
      const a = Math.PI - (u + Math.min(S - 1, Math.floor(u / w)) * G);
      pts.push({ x: 100 + 91 * R * Math.cos(a), y: 97 - 91 * R * Math.sin(a), a, rr: R });
    }
  });
  pts.sort((p, q) => q.a - p.a || p.rr - q.rr);
  const gap = (91 * (1 - r0)) / Math.max(1, rows - 1);
  const arc = Math.min(...radii.map((R, i) => (counts[i] > 1 ? (usable * 91 * R) / counts[i] : 99)));
  const sw = Math.round(arc * 0.8 * 100) / 100, sd = Math.round(gap * 0.74 * 100) / 100;
  const order = shuffle(pts.map((_, i) => i), mulberry(n * 31 + 7));
  const rank = new Array<number>(n);
  order.forEach((s, k) => { rank[s] = k; });
  const seats = pts.map(p => {
    const x = Math.round(p.x * 10) / 10, y = Math.round(p.y * 10) / 10;
    return { x, y, t: `translate(${x} ${y}) rotate(${deg(Math.atan2(-Math.cos(p.a), -Math.sin(p.a))).toFixed(1)}) scale(${sw} ${sd})` };
  });
  const rin = 91 * r0 - gap * 0.55, rout = 91 + gap * 0.55;
  const aisles: string[] = [];
  for (let j = 1; j < S; j++) {
    const a = Math.PI - (j * w + (j - 1) * G + G / 2);
    const c = Math.cos(a), s = Math.sin(a);
    aisles.push(`M${(100 + rin * c).toFixed(1)} ${(97 - rin * s).toFixed(1)}L${(100 + rout * c).toFixed(1)} ${(97 - rout * s).toFixed(1)}`);
  }
  const g: Geo = { seats, r: Math.min(gap, arc) * 0.45, rank, table: false, rows: radii.map(R => Math.round((91 * R + gap / 2) * 10) / 10), aisles, r0: Math.round(rin * 10) / 10, floor: Math.round((rin - 1.2) * 10) / 10 };
  GEO.set(n, g);
  return g;
}
/** Un demi-disque centré sur le perchoir */
const half = (r: number) => `M${100 - r} 97A${r} ${r} 0 0 1 ${100 + r} 97Z`;

const LV = ['Supprimé', 'Réécrit', 'Intégral'];
const fmt = (n: number, d = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n);
const word = (S: number) => (S >= 1 ? 'Pour' : S === 0 ? 'Partagé' : S === -1 ? 'Abst.' : 'Contre');
const tone = (S: number) => (S >= 1 ? 'p' : S >= -1 ? 'a' : 'c');
/** Retire les pictogrammes (émojis) des messages : l'interface les dessine */
const plain = (s: string) => s.replace(/\p{Extended_Pictographic}️?\s?/gu, '').trim();

/** Petits pictogrammes au trait (repère 24 × 24) */
const IC: Record<string, string> = {
  temps: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 7v5.2l3.4 2.1',
  capital: 'M12 2.8l2.8 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17l-5.7 3.1 1.2-6.3-4.6-4.4 6.3-.8z',
  ambition: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 7.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 0 1 0-9zM12 11v2',
  deficit: 'M17.5 6.2A7 7 0 1 0 17.5 17.8M4 10.5h9M4 13.5h9',
  rue: 'M4 9.5h4l7-4.5v14l-7-4.5H4zM8 14.5l1.5 5h2.5l-1.4-5M18 9.5a3.5 3.5 0 0 1 0 5',
  congres: 'M3 21h18M4 18h16M5 18V10M9 18V10M15 18V10M19 18V10M3 10h18L12 4z',
};
const STAGE_IC = ['M5 3.5h10l4 4V21H5zM15 3.5V8h4M8 12h8M8 15h8M8 18h5', 'M2.5 20h19M4 20a8 8 0 0 1 16 0M7.5 20a4.5 4.5 0 0 1 9 0M12 4v3', 'M3 21h18M5 21V10h14v11M3 10l9-6 9 6M9 21v-6h6v6', 'M4 7h16v10H4zM8 7V4M16 7V4M8 17v3M16 17v3', 'M5 3.5h14V21H5zM8 7.5h8M8 10.5h8M8 13.5h8M8 17.5h4'];

interface Move { id: Gid; short: string; from: string; to: string; up: boolean }
interface Prev { err: string | null; dAmb: number; t0: Tally; t1: Tally; moves: Move[]; notes: string[] }
interface ResView { title: string; kind: 'vote' | '493' | 'bloque' | 'cmp'; res: { am: Amdt; t: Tally }[]; main: Tally | null; passed: boolean; lines: Fx[]; cmp: CmpCheck | null }
interface Flash { text: string; good: boolean; id: number }

const BRIEF: Record<Variant, string> = {
  loi: 'Faites adopter le texte en préservant le plus d’ambition possible.',
  budget: 'Faites voter le budget en préservant vos priorités, sans dépasser la cible de déficit.',
  reforme: 'Faites passer la réforme. Tant que son cœur (articles marqués) reste intact, la mobilisation grossit à chaque étape.',
  constitution: 'Révisez la Constitution : ni 49.3 ni dernier mot de l’Assemblée, et le Congrès devra réunir les trois cinquièmes des suffrages exprimés.',
};

let flashId = 0;
let navInstances = 0;

@Component({
  selector: 'app-navette-game',
  template: `
    @let G = game();
    <div class="nav" [class]="'nav v-' + G.v">
      <header class="doc">
        <small class="rf">République française</small>
        <p class="bill">{{ billTitle }}</p>
        <small class="leg">{{ legLine() }}</small>
      </header>
      <ol class="steps" aria-label="Étapes de la navette">
        @for (s of stepLabels; track $index; let i = $index) {
          <li [class.now]="i === G.stage && G.status === 'play'" [class.done]="i < G.stage || G.status === 'won'" [class.ko]="G.status !== 'play' && G.status !== 'won' && i === stopAt()"
              [attr.aria-current]="i === G.stage ? 'step' : null"><span>{{ G.status !== 'play' && G.status !== 'won' && i === stopAt() ? '✗' : i < G.stage || G.status === 'won' ? '✓' : i + 1 }}</span>{{ s }}</li>
        }
      </ol>

      <div class="res" role="list" aria-label="Ressources">
        <span class="rs" role="listitem" [attr.aria-label]="'Temps de parole : ' + G.temps">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="IC['temps']" /></svg><b class="mono">{{ G.temps }}</b><small>temps</small>
        </span>
        <span class="rs" role="listitem" [class.low]="G.capital < 2" [attr.aria-label]="'Capital politique : ' + G.capital"><svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="IC['capital']" /></svg><b class="mono">{{ G.capital }}</b><small>capital</small></span>
        <span class="rs" role="listitem" [attr.aria-label]="'Ambition préservée : ' + pct(ambNow())"><svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="IC['ambition']" /></svg><b class="mono">{{ pct(ambNow()) }}</b><small>ambition</small></span>
        @if (G.v === 'budget') {
          <span class="rs" role="listitem" [class.bad]="defNow() > G.target + 0.001" [class.ok]="defNow() <= G.target + 0.001" [attr.aria-label]="'Déficit ' + fmt(defNow(), 2) + ' pour cent, cible ' + fmt(G.target, 1)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="IC['deficit']" /></svg><b class="mono">{{ fmt(defNow(), 2) }} %</b><small>cible {{ fmt(G.target, 1) }}</small></span>
        }
        @if (G.v === 'reforme') {
          <span class="rs" role="listitem" [class.bad]="G.pressure >= 4" [attr.aria-label]="'Mobilisation ' + G.pressure + ' sur 6'"><svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="IC['rue']" /></svg><b class="mono">{{ G.pressure }}/6</b><small>la rue</small></span>
        }
        @if (G.v === 'constitution' && G.stage < 4) {
          @let cg = congresNow();
          <span class="rs" role="listitem" [class.bad]="!cg.ok" [class.ok]="cg.ok" [attr.aria-label]="'Projection du Congrès : ' + pct(cg.p / Math.max(1, cg.p + cg.c)) + ', trois cinquièmes requis'">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="IC['congres']" /></svg><b class="mono">{{ pct(cg.p / Math.max(1, cg.p + cg.c)) }}</b><small>Congrès/60</small></span>
        }
      </div>

      <div class="hemi" [class.cmp]="hemi().geo.table">
        @let h = hemi();
        <svg viewBox="0 0 200 101" role="img" [attr.aria-label]="hemiLabel()" [attr.class]="'ch ch-' + h.ch">
          <defs>
            <linearGradient [attr.id]="uid + '-wall'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="w0" /><stop offset="1" class="w1" /></linearGradient>
            <radialGradient [attr.id]="uid + '-floor'" cx="50%" cy="100%" r="100%"><stop offset="0" class="f0" /><stop offset="1" class="f1" /></radialGradient>
            <linearGradient [attr.id]="uid + '-wood'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5a35" /><stop offset="1" stop-color="#5b3820" /></linearGradient>
            <pattern [attr.id]="uid + '-panel'" width="16" height="101" patternUnits="userSpaceOnUse"><rect width="16" height="101" fill="none" /><path d="M0 0V101" class="pl" /></pattern>
            <g [attr.id]="uid + '-seat'"><path d="M-.5 -.62h1v.82h-1z" fill="currentColor" /><path d="M-.56 .14h1.12v.42h-1.12z" fill="currentColor" /><path d="M-.56 .14h1.12v.42h-1.12z" fill="#000" fill-opacity=".32" /></g>
          </defs>
          <rect width="200" height="101" [attr.fill]="'url(#' + uid + '-wall)'" />
          <rect width="200" height="101" [attr.fill]="'url(#' + uid + '-panel)'" />
          @if (h.geo.table) {
            <path d="M0 101V92H200V101Z" class="carpet" />
            <rect x="40" y="47" width="120" height="20" rx="10" [attr.fill]="'url(#' + uid + '-wood)'" class="tbl" />
            <path d="M52 57H148" class="tbl-l" />
            <text x="10" y="41" class="lbl l">7 députés</text><text x="10" y="77" class="lbl l">7 sénateurs</text>
          } @else {
            <path [attr.d]="half(97)" class="tiers" />
            @for (r of h.geo.rows; track $index) { <path [attr.d]="'M' + (100 - r) + ' 97A' + r + ' ' + r + ' 0 0 1 ' + (100 + r) + ' 97'" class="tier" /> }
            @for (a of h.geo.aisles; track $index) { <path [attr.d]="a" class="aisle" /> }
            <path [attr.d]="half(h.geo.floor + 1.2)" class="rail" />
            <path [attr.d]="half(h.geo.floor)" [attr.fill]="'url(#' + uid + '-floor)'" />
            <path [attr.d]="half(h.geo.floor * 0.62)" class="rug" />
            @for (a of ring(); track a.id) { <path [attr.d]="a.d" [attr.stroke]="a.color" class="ring" /> }
          }
          @for (s of h.geo.seats; track $index; let i = $index) {
            <use [attr.href]="'#' + uid + '-seat'" [attr.transform]="s.t" [attr.class]="'s ' + h.cls[i]" [attr.stroke]="h.strokes[i] ?? null" [attr.stroke-width]="h.strokes[i] ? 0.16 : null" />
          }
          @if (!h.geo.table) {
            <g class="tribune" aria-hidden="true">
              <rect x="82" y="95" width="36" height="6" rx=".8" class="perchoir" /><path d="M82.5 95.4H117.5" class="gold" />
              <rect x="94.5" y="91" width="11" height="4.2" rx=".6" class="orateur" /><path d="M95 91.3H105" class="gold" />
            </g>
          }
        </svg>
        <div class="hc">
          <b class="mono big">{{ h.center }}</b>
          <small>{{ h.sub }}</small>
        </div>
        @for (f of flashes(); track f.id) { <span class="flash" [class.good]="f.good">{{ f.text }}</span> }
      </div>
      @if (tallyLine(); as tl) {
        <div class="tl board" aria-live="polite">
          <span class="p"><small>Pour</small><b class="mono">{{ tl.p }}</b></span>
          <span class="c"><small>{{ tl.kind === 'censure' ? 'Requis' : 'Contre' }}</small><b class="mono">{{ tl.kind === 'censure' ? tl.need : tl.c }}</b></span>
          <span class="a"><small>Abst.</small><b class="mono">{{ tl.kind === 'censure' ? '—' : tl.a }}</b></span>
          <span class="meta mono">@if (tl.kind !== 'censure') { Votants {{ tl.p + tl.c + tl.a }} · Exprimés {{ tl.p + tl.c }} · {{ tl.kind === 'tpf' ? '3/5 : ' : 'Majorité abs. ' }}{{ tl.need }} } @else { Motion de censure · majorité des membres }</span>
          <span class="verdict" [class.ok]="tl.ok">{{ tl.label }}</span>
        </div>
      }

      @if (cmpNow(); as ck) {
        @if (phase() === 'play') {
          <p class="tl cmpl board">
            @if (G.v !== 'constitution') { <span [class]="ck.yes >= 8 ? 'okc' : 'koc'">CMP <b class="mono">{{ ck.yes }}/14</b></span> }
            <span [class]="ck.an.ok ? 'okc' : 'koc'">Assemblée <b class="mono">{{ ck.an.p }}–{{ ck.an.c }}</b> {{ ck.an.ok ? '✓' : '✗' }}</span>
            <span [class]="ck.sen.ok ? 'okc' : 'koc'">Sénat <b class="mono">{{ ck.sen.p }}–{{ ck.sen.c }}</b> {{ ck.sen.ok ? '✓' : '✗' }}</span>
          </p>
        }
      }

      <div class="panel">
        @switch (phase()) {
          @case ('intro') {
            @if (intro(); as it) {
              <div class="card intro" role="dialog" [attr.aria-label]="it.title">
                <p class="eyebrow">Ordre du jour</p>
                <p class="it-t"><svg class="it-i" viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="stageIcon()" /></svg> <b>{{ it.title }}</b></p>
                @if (G.stage === 0) {
                  <p class="small">{{ brief }}@if (G.v === 'budget') { Cible : {{ fmt(G.target, 1) }} % du PIB. }</p>
                  <p class="small muted">Chaque groupe vote selon son <b>soutien</b> : +1 et plus, pour ; 0, partagé ; −1, abstention ; −2 et moins, contre. Réécrire un article divise ses effets par deux, le supprimer les annule. Consultez les groupes pour découvrir leurs lignes rouges et ce qu’ils demandent.</p>
                }
                <ul class="lines">@for (l of it.lines; track $index) { <li [class.bad]="l.bad">{{ plain(l.msg) }}</li> }</ul>
                <p class="small muted">{{ stageHelp() }}</p>
                <button type="button" class="btn primary go" (click)="play()">{{ G.stage === 0 ? 'Déposer le texte' : 'À l’ouvrage' }} →</button>
              </div>
            }
          }
          @case ('play') {
            <div class="tabs" role="tablist" aria-label="Vues">
              <button type="button" role="tab" [attr.aria-selected]="tab() === 'texte'" [class.on]="tab() === 'texte'" (click)="tab.set('texte')">Texte</button>
              <button type="button" role="tab" [attr.aria-selected]="tab() === 'groupes'" [class.on]="tab() === 'groupes'" (click)="tab.set('groupes')">Groupes@if (unknown()) { <small>{{ unknown() }}?</small> }</button>
              @if (G.mode !== 'cmp') {
                <button type="button" role="tab" [attr.aria-selected]="tab() === 'amdts'" [class.on]="tab() === 'amdts'" (click)="tab.set('amdts')">Amend.@if (G.pending.length) { <small class="warn">{{ G.pending.length }}</small> }</button>
              }
            </div>

            @if (tab() === 'texte') {
              <div class="paper">
              <p class="ph"><span>{{ G.v === 'constitution' ? 'Projet de loi constitutionnelle' : G.v === 'budget' ? 'Projet de loi de finances' : 'Projet de loi' }}</span><small>{{ textState() }}</small></p>
              @if (G.mode === 'cmp') {
                <p class="hint">{{ G.v === 'constitution' ? 'Choisissez, article par article, une rédaction que les deux chambres voteront.' : 'Choisissez, article par article, entre la version de l’Assemblée, celle du Sénat ou un compromis : il faut 8 voix sur 14.' }}</p>
              } @else if (textFixed(G)) {
                <p class="hint">Le texte ne peut plus être modifié : seuls les accords avec les groupes peuvent encore faire bouger les voix.</p>
              }
              <ul class="arts">
                @for (a of G.arts; track a.id) {
                  @if (a.level > 0 || !a.extra || G.mode === 'cmp') {
                    @let open = selArt() === a.id;
                    <li>
                      <button type="button" class="art" [class.open]="open" [class.gone]="a.level === 0" [class.half]="a.level === 1" (click)="toggleArt(a.id)" [attr.aria-expanded]="open"
                              [attr.aria-label]="'Article ' + a.n + ' : ' + a.title + ', ' + LV[a.level]">
                        <span class="an">{{ a.extra ? 'Article additionnel' : a.n === 1 ? 'Article 1er' : 'Article ' + a.n }}</span>
                        <span class="at">{{ a.title }}@if (a.core) { <i class="core" title="Au cœur de la contestation">cœur</i> }</span>
                        <span class="lv" [class]="'lv l' + a.level">{{ a.level === 2 ? 'intégral' : a.level === 1 ? 'réécrit' : 'supprimé' }}</span>
                        <span class="who">
                          @for (w of whoLikes(a); track w.id) { <i class="up" [style.--g]="w.color">▲{{ w.short }}</i> }
                          @for (w of whoHates(a); track w.id) { <i class="dn" [style.--g]="w.color">▼{{ w.short }}</i> }
                          @for (w of redOn(a); track w) { <i class="red">ligne rouge {{ w }}</i> }
                          @if (threat(a)) { <i class="thr">amendement menaçant</i> }
                        </span>
                        <span class="amb mono">{{ a.extra ? '' : fmt(a.amb * (a.level === 2 ? 1 : a.level === 1 ? 0.5 : 0)) + '/' + fmt(a.amb) }}</span>
                      </button>
                      @if (open) {
                        <div class="det">
                          <p class="small body">{{ a.desc }}@if (G.v === 'budget' && a.fiscal) { <span> Solde : {{ a.fiscal > 0 ? '+' : '−' }}{{ fmt(Math.abs(a.fiscal), 1) }} Md€ intégral.</span> }</p>
                          @if (G.mode === 'cmp') {
                            @let rg = range(a);
                            @if (rg.length > 1) {
                              <div class="seg" role="radiogroup" [attr.aria-label]="'Rédaction de l’article ' + a.n">
                                @for (l of rg; track l) {
                                  <button type="button" role="radio" [attr.aria-checked]="a.level === l" [class.on]="a.level === l" (click)="cmpPick(a.id, l)">
                                    {{ LV[l] }}<small>{{ origin(a, l) }}</small>
                                  </button>
                                }
                              </div>
                            } @else { <p class="small muted">Rédaction identique dans les deux chambres.</p> }
                          } @else if (!textFixed(G)) {
                            @for (op of artOps(a); track op.label) {
                              @let p = op.prev;
                              <div class="op" [class.err]="p.err">
                                <div class="op-h">
                                  <b>{{ op.label }}</b>
                                  @if (p.err) { <small>{{ p.err }}</small> }
                                  @else {
                                    <small>{{ op.cost }} · ambition {{ p.dAmb ? '−' + fmt(p.dAmb) + ' pts' : 'inchangée' }}</small>
                                  }
                                  <button type="button" class="btn small" [disabled]="!!p.err || busy()" (click)="act(op.act)" [attr.aria-label]="op.label + ' l’article ' + a.n">Valider</button>
                                </div>
                                @if (!p.err) {
                                  <small class="proj">Projection {{ p.t0.p }}–{{ p.t0.c }} → <b [class.okc]="p.t1.ok" [class.koc]="!p.t1.ok">{{ p.t1.p }}–{{ p.t1.c }}</b>
                                    @for (m of p.moves; track m.id) { <span [class]="m.up ? 'g' : 'r'"> · {{ m.short }} {{ m.from }}→{{ m.to }}</span> }</small>
                                  @for (n of p.notes; track $index) { <small class="note">{{ plain(n) }}</small> }
                                }
                              </div>
                            }
                          }
                        </div>
                      }
                    </li>
                  }
                }
              </ul>
              </div>
            } @else if (tab() === 'groupes') {
              <ul class="grps">
                @for (g of groupsSorted(); track g.id) {
                  @let open = selGrp() === g.id;
                  @let S = sNow(g);
                  <li>
                    <button type="button" class="grp" [class.open]="open" (click)="toggleGrp(g.id)" [attr.aria-expanded]="open"
                            [attr.aria-label]="g.name + ', ' + seatsNow(g) + ' sièges, soutien ' + S + ', ' + word(S) + (g.known ? '' : ', non consulté')">
                      <i class="sw" [style.background]="g.color"></i>
                      <span class="gn"><b>{{ g.short }}</b> {{ g.name }}@if (g.coal) { <em class="maj">majorité</em> }</span>
                      <span class="gs mono">{{ seatsNow(g) }}</span>
                      <span class="gS mono" [class]="'gS t-' + tone(S)">{{ sgn(S) }}</span>
                      <span class="gv" [class]="'gv t-' + tone(S)">{{ word(S) }}</span>
                      <span class="gi">@if (g.deal) { <i class="bd deal" title="Accord conclu">accord</i> }@if (!g.known) { <i class="bd unk" title="Non consulté">?</i> } @else if (g.red !== null) { <i class="bd red" title="Ligne rouge">ligne r.</i> }</span>
                    </button>
                    @if (open) {
                      <div class="det">
                        <p class="parts">
                          @for (pt of parts(g); track pt.k) { <span [class]="pt.v > 0 ? 'g' : pt.v < 0 ? 'r' : ''">{{ pt.label }} {{ sgn(pt.v) }}</span> }
                          @if (!g.known) { <span class="muted">Ligne rouge éventuelle : ?</span> }
                        </p>
                        @if (g.known) {
                          <p class="small"><b>Ligne rouge</b> — {{ g.red !== null ? 'article ' + (artN(g.red)) + ' intégral (−' + RED + ')' : 'aucune.' }}</p>
                          <p class="small"><b>{{ g.deal ? 'Accord' : 'Demande' }}</b> — {{ g.deal ? demandLabel(G, g, true) + (honored(g) ? ' (respecté)' : ' — TRAHI') : demandLabel(G, g) }}.</p>
                        }
                        @if (!g.known) {
                          @let pc = prev({ t: 'consult', g: g.id });
                          <div class="op" [class.err]="pc.err"><div class="op-h"><b>Consulter</b><small>{{ pc.err || '1 temps · révèle ligne rouge et demande' }}</small>
                            <button type="button" class="btn small" [disabled]="!!pc.err || busy()" (click)="act({ t: 'consult', g: g.id })" [attr.aria-label]="'Consulter ' + g.name">Valider</button></div></div>
                        } @else if (!g.deal && g.demand) {
                          @let pd = prev({ t: 'deal', g: g.id });
                          <div class="op" [class.err]="pd.err">
                            <div class="op-h"><b>Négocier</b><small>{{ pd.err || '1 temps · 2 ★ · ambition ' + (pd.dAmb ? '−' + fmt(pd.dAmb) + ' pts' : 'inchangée') }}</small>
                              <button type="button" class="btn small" [disabled]="!!pd.err || busy()" (click)="act({ t: 'deal', g: g.id })" [attr.aria-label]="'Négocier avec ' + g.name">Valider</button></div>
                            @if (!pd.err) {
                              <small class="proj">Projection {{ pd.t0.p }}–{{ pd.t0.c }} → <b [class.okc]="pd.t1.ok" [class.koc]="!pd.t1.ok">{{ pd.t1.p }}–{{ pd.t1.c }}</b>
                                @for (m of pd.moves; track m.id) { <span [class]="m.up ? 'g' : 'r'"> · {{ m.short }} {{ m.from }}→{{ m.to }}</span> }</small>
                              @for (n of pd.notes; track $index) { <small class="note">{{ plain(n) }}</small> }
                            }
                          </div>
                        }
                      </div>
                    }
                  </li>
                }
              </ul>
            } @else {
              <ul class="amdts">
                @for (x of fc().res; track x.am.id) {
                  <li [class.ok]="x.t.ok">
                    <span class="mono num">Amendement n° {{ fmt(x.am.num) }}</span>
                    <span class="am-t">présenté par <b>{{ shortOf(x.am.by) }}</b> — {{ amdtLabel(x.am) }}</span>
                    <span class="am-v mono" [class.ok]="x.t.ok">{{ x.t.p }}–{{ x.t.c }} · {{ x.t.ok ? 'adopté' : 'rejeté' }}</span>
                  </li>
                } @empty { <li class="muted small">Aucun amendement hostile en discussion.</li> }
              </ul>
              <p class="hint">Projection d’après vos informations. Pour en faire tomber un : réécrivez l’article vous-même, négociez avec un groupe, ou écartez-les tous d’un coup (vote bloqué, 49.3).</p>
            }

            @if (confirm(); as k) {
              @let cp = confirmProj();
              <div class="card sheet" role="dialog" [attr.aria-label]="k === '493' ? 'Engager la responsabilité du gouvernement' : 'Vote bloqué'">
                @if (k === '493') {
                  <p><b>Article 49, alinéa 3</b> — le texte est adopté sans vote, sauf si une motion de censure réunit {{ CENSURE }} députés. L’opposition s’en souviendra (−1 de soutien chacun, définitivement).</p>
                } @else {
                  <p><b>Vote bloqué (article 44, alinéa 3)</b> — un seul vote sur tout le texte : les amendements de l’opposition sont écartés. L’opposition s’en souviendra (−1 de soutien chacun, définitivement).</p>
                }
                @if (cp) {
                  <p class="small">{{ k === '493' ? 'Censure : ' + cp.p + ' voix sur ' + CENSURE + ' requises' : 'Vote : ' + cp.p + ' pour, ' + cp.c + ' contre' }} →
                    <b [class.okc]="k === '493' ? !cp.ok : cp.ok" [class.koc]="k === '493' ? cp.ok : !cp.ok">{{ k === '493' ? (cp.ok ? 'le gouvernement tomberait' : 'motion rejetée') : (cp.ok ? 'adopté' : 'rejeté') }}</b> <span class="muted">(projection)</span></p>
                }
                @if (unknown()) { <p class="small muted">{{ unknown() }} groupe{{ unknown() > 1 ? 's' : '' }} non consulté{{ unknown() > 1 ? 's' : '' }} : une ligne rouge cachée peut fausser la projection.</p> }
                <div class="row2">
                  <button type="button" class="btn" (click)="confirm.set(null)">Renoncer</button>
                  <button type="button" class="btn primary" (click)="resolve(k)">{{ k === '493' ? 'Engager la responsabilité' : 'Demander le vote bloqué' }}</button>
                </div>
              </div>
            } @else {
              <div class="acts">
                @if (G.mode === 'cmp') {
                  <button type="button" class="btn" [disabled]="busy()" (click)="cmpEnd(false)">{{ G.v === 'constitution' ? 'Renoncer à la révision' : 'Constater le désaccord' }}</button>
                  <button type="button" class="btn primary end" [disabled]="busy() || !cmpOk()" (click)="cmpEnd(true)">{{ G.v === 'constitution' ? 'Adopter en termes identiques' : 'Conclure l’accord' }} →</button>
                } @else {
                  @if (anStage(G) && G.mode !== 'conclusions') {
                    <button type="button" class="btn small" [disabled]="!!canDo(G, { t: 'night' }) || busy()" (click)="act({ t: 'night' })" [attr.title]="canDo(G, { t: 'night' })">Séance de nuit <small>+2 temps · 1 ★</small></button>
                  }
                  @if (G.v === 'reforme') {
                    <button type="button" class="btn small" [disabled]="!!canDo(G, { t: 'concert' }) || busy()" (click)="act({ t: 'concert' })">Syndicats <small>1 temps · 1 ★ · rue −1</small></button>
                  }
                  @if (G.v !== 'constitution' && anStage(G)) {
                    <button type="button" class="btn small" [disabled]="!!can493(G) || busy()" (click)="confirm.set('493')" [attr.title]="can493(G)">49.3 <small>3 ★</small></button>
                  }
                  @if (!canBloqueShown()) {
                    <button type="button" class="btn small" [disabled]="!!canBloque(G) || busy()" (click)="confirm.set('bloque')" [attr.title]="canBloque(G)">Vote bloqué <small>2 ★</small></button>
                  }
                  <button type="button" class="btn primary end" [disabled]="busy()" (click)="resolve('vote')">{{ voteLabel() }} →</button>
                }
              </div>
            }
          }
          @case ('result') {
            @if (result(); as R) {
              <div class="card result" aria-live="polite">
                <p class="eyebrow">{{ R.kind === 'cmp' ? 'Procès-verbal' : 'Scrutin public' }}</p>
                <p class="it-t"><b>{{ R.title }}</b></p>
                @if (R.res.length) {
                  <ul class="amdts">
                    @for (x of R.res; track x.am.id; let i = $index) {
                      @if (i < step()) {
                        <li class="in" [class.ok]="x.t.ok">
                          <span class="mono num">Amendement n° {{ fmt(x.am.num) }}</span>
                          <span class="am-t">présenté par <b>{{ shortOf(x.am.by) }}</b> — {{ amdtLabel(x.am) }}</span>
                          <span class="am-v mono" [class.ok]="x.t.ok">{{ x.t.p }}–{{ x.t.c }} · {{ x.t.ok ? 'adopté' : 'rejeté' }}</span>
                        </li>
                      }
                    }
                  </ul>
                }
                @if (R.cmp; as ck) {
                  <p class="small mono">Membres de la CMP : {{ ck.yes }} pour sur 14 — Assemblée {{ ck.an.p }}–{{ ck.an.c }} · Sénat {{ ck.sen.p }}–{{ ck.sen.c }}</p>
                }
                @if (animDone()) {
                  <ul class="lines">@for (l of R.lines; track $index) { <li class="in" [class.bad]="l.bad">{{ plain(l.msg) }}</li> }</ul>
                  <button type="button" class="btn primary go" (click)="next()">{{ G.status === 'play' ? 'Étape suivante' : 'Bilan' }} →</button>
                }
              </div>
            }
          }
          @case ('over') {
            <div class="card sum jo" aria-live="polite">
              <p class="jo-h">Journal officiel de la République française</p>
              <p class="jo-t">{{ G.status === 'won' ? loiTitle() : 'Texte non adopté' }}</p>
              <p class="verdict-big" [class.ok]="G.status === 'won'"><b>{{ endMessage() }}</b></p>
              <div class="bars">
                <span>{{ G.status === 'won' ? 'Ambition préservée' : 'Ambition du texte' }}</span><span class="bar"><span [style.width.%]="ambNow() * 100"></span></span><b class="mono">{{ pct(ambNow()) }}</b>
                @if (G.v === 'budget') { <span>Déficit {{ fmt(defNow(), 2) }} %</span><span class="bar"><span [style.width.%]="defFactor(G) * 100"></span></span><b class="mono">{{ defNow() <= G.target + 0.001 ? '✓' : '✗' }}</b> }
                <span>Score</span><span class="bar"><span [style.width.%]="score() * 100"></span></span><b class="mono">{{ pct(score()) }}</b>
              </div>
              <ul class="final">
                @for (a of finalArts(); track a.id) {
                  <li [class]="'l' + a.level"><span>{{ a.level === 2 ? '✓' : a.level === 1 ? '½' : '✗' }}</span> {{ a.extra ? 'Art. add.' : 'Art. ' + a.n }} — {{ a.title }}</li>
                }
              </ul>
            </div>
          }
        }
      </div>

      <ul class="log" aria-label="Journal">@for (l of log(); track $index) { <li>{{ l }}</li> }</ul>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%;
      --nv-paper: #fbf9f3; --nv-paper-2: #f2ede1; --nv-rule: #ddd4c1; --nv-ink: #1e2128; --nv-ink-2: #5b5e68; --nv-red: #a3201b; --nv-board: #101317; --nv-led: #f2b33d; }
    @media (prefers-color-scheme: dark) {
      :host-context(html:not([data-theme="light"])) { --nv-paper: #1f232b; --nv-paper-2: #262b34; --nv-rule: #39404c; --nv-ink: #ebe7dd; --nv-ink-2: #a9a8a2; --nv-red: #ef8a78; --nv-board: #07090c; }
    }
    :host-context(html[data-theme="dark"]) { --nv-paper: #1f232b; --nv-paper-2: #262b34; --nv-rule: #39404c; --nv-ink: #ebe7dd; --nv-ink-2: #a9a8a2; --nv-red: #ef8a78; --nv-board: #07090c; }
    .nav { display: grid; gap: 8px; font-size: 13px; min-width: 0; }
    .doc { display: grid; justify-items: center; gap: 1px; text-align: center; padding-bottom: 6px; border-bottom: 1px solid var(--line);
      .rf { font: 600 9.5px var(--font-body); letter-spacing: .16em; text-transform: uppercase; color: var(--ink-3); }
      .leg { font-size: 10.5px; color: var(--ink-3); font-style: italic; } }
    .bill { margin: 0; font: 600 14px/1.25 var(--font-display); color: var(--ink); }
    .steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 3px; position: relative;
      &::before { content: ''; position: absolute; left: 10%; right: 10%; top: 10px; height: 1.5px; background: var(--line); }
      li { position: relative; display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 10px; line-height: 1.1; color: var(--ink-3); text-align: center; min-width: 0; overflow-wrap: anywhere; }
      span { display: grid; place-items: center; width: 21px; height: 21px; border-radius: 50%; border: 1.5px solid var(--line); background: var(--surface); font: 700 10.5px var(--font-mono); }
      .now { color: var(--ink); font-weight: 600; span { background: var(--ink); border-color: var(--ink); color: var(--surface); } }
      .done span { background: var(--surface); border-color: var(--good); color: var(--good); }
      .ko span { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); } }
    .res { display: flex; flex-wrap: wrap; gap: 4px; }
    .rs { flex: 1 1 56px; display: grid; grid-template-columns: auto auto; grid-template-areas: 'i v' 'l l'; justify-content: center; align-items: center; column-gap: 4px; padding: 4px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); min-width: 0; line-height: 1.15;
      svg { grid-area: i; width: 14px; height: 14px; fill: none; stroke: var(--ink-2); stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; } b { grid-area: v; font-size: 13px; white-space: nowrap; } small { grid-area: l; text-align: center; font-size: 9.5px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: .03em; text-transform: uppercase; }
      &.ok { border-color: var(--good); background: var(--good-soft); } &.bad, &.low { border-color: var(--bad); background: var(--bad-soft); } }
    .hemi { position: relative; width: 100%; max-width: 520px; justify-self: center; border-radius: 6px; overflow: hidden; box-shadow: 0 0 0 1px rgba(0,0,0,.2), 0 8px 22px -14px rgba(0,0,0,.6);
      svg { display: block; width: 100%; height: auto; } }
    .ch { --w0: #3e2a1c; --w1: #23170f; --f0: #9a2b31; --f1: #6a161d; --tier: #5a3a24; --tierl: #2c1c11; --aisle: #8e6a48; --rail: #c9a45c; }
    .ch-sen { --w0: #3a2418; --w1: #1f130c; --f0: #8c2330; --f1: #5c1220; --tier: #63402a; --aisle: #a07a4e; }
    .ch-congres { --w0: #4a3622; --w1: #261a10; --f0: #a3262e; --f1: #6d121a; --tier: #6b4a2c; --rail: #e0bd6a; }
    .ch-com { --w0: #3b3a33; --w1: #23221d; --f0: #2f5a45; --f1: #1d3a2c; --tier: #4f4a3e; --aisle: #7d7462; }
    .ch-cmp { --w0: #3b3a33; --w1: #23221d; }
    .w0 { stop-color: var(--w0); } .w1 { stop-color: var(--w1); } .f0 { stop-color: var(--f0); } .f1 { stop-color: var(--f1); }
    .pl { stroke: rgba(0, 0, 0, .25); stroke-width: .5; }
    .tiers { fill: var(--tier); stroke: var(--tierl); stroke-width: .6; }
    .tier { fill: none; stroke: var(--tierl); stroke-width: .5; opacity: .75; }
    .aisle { stroke: var(--aisle); stroke-width: 2.1; opacity: .85; }
    .rail { fill: var(--rail); }
    .rug { fill: none; stroke: rgba(232, 196, 120, .35); stroke-width: .6; stroke-dasharray: 1.4 1.2; }
    .carpet { fill: #6a161d; }
    .tbl { stroke: #3a2414; stroke-width: .6; } .tbl-l { stroke: rgba(255, 230, 180, .25); stroke-width: .6; }
    .tribune { .perchoir { fill: #5e3a22; stroke: #2a190d; stroke-width: .4; } .orateur { fill: #8b6040; stroke: #2a190d; stroke-width: .4; } .gold { stroke: #d8b465; stroke-width: .7; } }
    .s { transition: color .25s ease; color: #6b5b4e; }
    .s.p { color: #3fa26a; } .s.a { color: #d9d1bd; } .s.c { color: #e0533d; } .s.w { color: #6b5b4e; } .s.g0 { opacity: .35; }
    .ring { fill: none; stroke-width: 2.6; }
    .lbl { font: 600 6.5px var(--font-body); fill: #e9dcc3; letter-spacing: .04em; } .lbl.l { text-anchor: start; }
    .hc:has(b:empty) { display: none; }
    .hc { position: absolute; left: 50%; bottom: 12.5%; transform: translateX(-50%); display: grid; justify-items: center; line-height: 1.05; pointer-events: none; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.7);
      padding: 2px 9px 3px; border-radius: 3px; background: rgba(28, 8, 10, .62); box-shadow: 0 0 0 1px rgba(216, 180, 101, .35);
      .big { font-size: clamp(14px, 4.3vw, 20px); } small { font-size: 9.5px; color: #f1dfc3; white-space: nowrap; letter-spacing: .04em; } }
    .hemi.cmp .hc { bottom: 36%; }
    .flash { position: absolute; left: 50%; top: 22%; transform: translateX(-50%); font: 800 14px var(--font-body); color: #ffb4a6; text-shadow: 0 1px 3px #000; pointer-events: none; animation: rise 1.2s ease forwards; white-space: nowrap; &.good { color: #9fe3b8; } }
    @keyframes rise { to { transform: translate(-50%, -22px); opacity: 0; } }
    .board { margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px 6px; padding: 7px 10px; border-radius: 4px; background: var(--nv-board); color: #d8d4c8;
      box-shadow: inset 0 0 0 1px #2a2f38, inset 0 0 18px rgba(0,0,0,.6); font-size: 11px;
      > span { display: grid; justify-items: center; small { font: 600 9px var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: #8d8a80; } b { font-size: 20px; color: var(--nv-led); text-shadow: 0 0 6px rgba(242, 179, 61, .45); line-height: 1.1; } }
      .p b { color: #7fe0a2; text-shadow: 0 0 6px rgba(127, 224, 162, .4); } .c b { color: #ff8a73; text-shadow: 0 0 6px rgba(255, 138, 115, .4); }
      .meta { grid-column: 1 / -1; font-size: 10px; color: #a29e92; text-align: center; border-top: 1px solid #2a2f38; padding-top: 3px; }
      .verdict { grid-column: 1 / -1; justify-self: center; font: 700 11px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: #ff8a73; &.ok { color: #7fe0a2; } } }
    .cmpl { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 18px; font-size: 11.5px; > span { display: block; } b { color: var(--nv-led); font-size: 15px !important; } .okc { color: #7fe0a2; } .koc { color: #ff8a73; } }
    .panel { display: grid; gap: 6px; min-width: 0; }
    .card { display: grid; gap: 6px; padding: 12px; border-radius: 3px; background: var(--nv-paper); color: var(--nv-ink); border: 1px solid var(--nv-rule); box-shadow: 0 2px 10px -6px rgba(0,0,0,.35); animation: pop .3s ease both; min-width: 0; }
    .eyebrow { margin: 0; font: 600 10px var(--font-body); letter-spacing: .14em; text-transform: uppercase; color: var(--nv-red); border-bottom: 1px solid var(--nv-rule); padding-bottom: 4px; }
    @keyframes pop { from { transform: translateY(4px); opacity: 0; } }
    .it-t { margin: 0; font: 600 15px/1.25 var(--font-display); display: flex; align-items: center; gap: 7px; }
    .it-i { width: 20px; height: 20px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
    .lines { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 12px;
      li { padding-left: 16px; position: relative; &::before { content: '—'; position: absolute; left: 0; color: var(--nv-ink-2); } }
      li.bad { color: var(--nv-red); } li.in { animation: pop .3s ease both; } }
    .go { justify-self: end; min-height: 38px; }
    .small { font-size: 12px; margin: 0; } .muted { color: var(--ink-3); } .card .muted, .paper .muted { color: var(--nv-ink-2); }
    .hint { margin: 0; font-size: 11.5px; color: var(--nv-ink-2); font-style: italic; }
    .tabs { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 3px; margin-bottom: -7px; position: relative; z-index: 1;
      button { min-height: 36px; border: 1px solid var(--nv-rule); border-bottom: 0; border-radius: 6px 6px 0 0; background: var(--nv-paper-2); color: var(--nv-ink-2); font: inherit; font-size: 12px; cursor: pointer; padding: 2px 4px;
        &.on { background: var(--nv-paper); color: var(--nv-ink); font-weight: 600; box-shadow: inset 0 2px 0 var(--nv-red); }
        small { margin-left: 4px; font-size: 10px; padding: 0 5px; border-radius: 999px; background: var(--nv-rule); color: var(--nv-ink); &.warn { background: var(--nv-red); color: #fff; } } } }
    .paper { display: grid; gap: 6px; padding: 12px 12px 8px; background: var(--nv-paper); color: var(--nv-ink); border: 1px solid var(--nv-rule); border-radius: 0 0 3px 3px; box-shadow: 0 2px 10px -6px rgba(0,0,0,.35); min-width: 0; }
    .ph { margin: 0; display: grid; justify-items: center; text-align: center; gap: 1px; padding-bottom: 6px; border-bottom: 1px solid var(--nv-ink);
      span { font: 700 13px var(--font-display); text-transform: uppercase; letter-spacing: .08em; } small { font-size: 10.5px; color: var(--nv-ink-2); font-style: italic; } }
    ul.arts, ul.grps, ul.amdts, ul.final { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    ul.arts { gap: 0; li + li { border-top: 1px solid var(--nv-rule); } }
    .art { width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'n l' 't t' 'w m'; gap: 2px 8px; align-items: center; text-align: left;
      padding: 8px 2px; min-height: 44px; border: 0; border-radius: 0; background: transparent; color: var(--nv-ink); font: inherit; cursor: pointer;
      &.open { background: var(--nv-paper-2); } &:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
      &.gone .at { text-decoration: line-through; text-decoration-color: var(--nv-red); text-decoration-thickness: 1.5px; color: var(--nv-ink-2); }
      &.half .at { text-decoration: underline wavy var(--nv-red); text-decoration-thickness: 1px; text-underline-offset: 3px; } }
    .an { grid-area: n; font: 700 11px var(--font-body); letter-spacing: .04em; color: var(--nv-ink-2); }
    .at { grid-area: t; font: 500 14px/1.3 var(--font-display); overflow-wrap: anywhere;
      .core { font: italic 600 10px var(--font-body); color: var(--nv-red); margin-left: 4px; padding: 0 4px; border: 1px solid var(--nv-red); border-radius: 2px; vertical-align: 2px; } }
    .lv { grid-area: l; font: italic 600 11px var(--font-display); white-space: nowrap;
      &.l2 { color: var(--nv-ink-2); font-weight: 400; } &.l1 { color: var(--nv-red); } &.l0 { color: var(--nv-red); text-transform: uppercase; font-style: normal; font-size: 9.5px; letter-spacing: .08em; border: 1.5px solid var(--nv-red); padding: 0 4px; transform: rotate(-4deg); } }
    .who { grid-area: w; display: flex; flex-wrap: wrap; gap: 2px 6px; font-size: 10px; min-width: 0;
      i { font-style: normal; white-space: nowrap; border-bottom: 2px solid var(--g, transparent); }
      .up { color: var(--good); } .dn { color: var(--nv-red); } .red { color: #fff; background: var(--nv-red); padding: 0 4px; border-radius: 2px; font-weight: 600; } .thr { color: #9a6a10; font-style: italic; } }
    .amb { grid-area: m; font-size: 10px; color: var(--nv-ink-2); }
    .det { display: grid; gap: 5px; padding: 6px 4px 8px 10px; border-left: 2px solid var(--nv-red); margin: 0 0 6px 4px; min-width: 0; }
    .body { font-family: var(--font-display); font-style: italic; }
    .op { display: grid; gap: 2px; padding: 6px 8px; border-radius: 3px; background: var(--nv-paper-2); border: 1px dashed var(--nv-rule); &.err { opacity: .7; } }
    .op-h { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; b { font-size: 12.5px; } small { color: var(--nv-ink-2); font-size: 11px; flex: 1 1 120px; min-width: 0; } .btn { min-height: 32px; margin-left: auto; } }
    .proj { font-size: 11px; color: var(--nv-ink-2); overflow-wrap: anywhere; }
    .note { font-size: 11px; color: var(--nv-ink-2); }
    .g { color: var(--good); font-weight: 600; } .r { color: var(--nv-red); font-weight: 600; }
    .okc { color: var(--good); } .koc { color: var(--nv-red); }
    .seg { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 4px;
      button { min-height: 40px; display: grid; gap: 0; place-items: center; border: 1px solid var(--nv-rule); border-radius: 3px; background: var(--nv-paper); color: var(--nv-ink); font: inherit; font-size: 12px; cursor: pointer;
        small { font-size: 9.5px; color: var(--nv-ink-2); } &.on { border-color: var(--nv-ink); box-shadow: 0 0 0 1.5px var(--nv-ink); font-weight: 600; } } }
    .grp { width: 100%; display: grid; grid-template-columns: 6px minmax(0, 1fr) auto auto auto auto; gap: 6px; align-items: center; text-align: left; min-height: 44px; padding: 5px 8px 5px 0;
      border-radius: 3px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: inherit; cursor: pointer; overflow: hidden; &.open { border-color: var(--ink-3); } }
    .sw { width: 6px; align-self: stretch; margin: -5px 0; }
    .gn { font-size: 11.5px; line-height: 1.2; min-width: 0; overflow-wrap: anywhere; b { font-size: 12.5px; } .maj { font-style: normal; font-size: 9px; margin-left: 3px; padding: 0 4px; border-radius: 2px; border: 1px solid var(--line); color: var(--ink-2); text-transform: uppercase; letter-spacing: .05em; } }
    .gs { font-size: 11px; color: var(--ink-2); }
    .gS { font-size: 12px; font-weight: 700; min-width: 22px; text-align: right; }
    .gv { font-size: 10px; padding: 1px 5px; border-radius: 2px; min-width: 42px; text-align: center; }
    .t-p { color: var(--good); } .gv.t-p { background: var(--good-soft); } .t-a { color: var(--ink-2); } .gv.t-a { background: var(--surface-2); } .t-c { color: var(--bad); } .gv.t-c { background: var(--bad-soft); }
    .gi { display: grid; gap: 2px; justify-items: end; min-width: 14px; }
    .bd { font: 600 9px var(--font-body); font-style: normal; text-transform: uppercase; letter-spacing: .04em; padding: 0 4px; border-radius: 2px; white-space: nowrap;
      &.deal { background: var(--good-soft); color: var(--good); } &.red { background: var(--bad-soft); color: var(--bad); } &.unk { border: 1px dashed var(--ink-3); color: var(--ink-3); } }
    .grps .det { border-left-color: var(--ink-3); }
    .parts { margin: 0; display: flex; flex-wrap: wrap; gap: 2px 9px; font-size: 11.5px; }
    .amdts li { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'n v' 't t'; gap: 2px 6px; padding: 7px 9px; border-radius: 2px; background: var(--nv-paper); color: var(--nv-ink); border: 1px solid var(--nv-rule); border-left: 3px solid var(--nv-rule); font-size: 12px;
      &.ok { border-left-color: var(--nv-red); } &.in { animation: pop .3s ease both; } }
    .num { grid-area: n; font-size: 10px; color: var(--nv-ink-2); text-transform: uppercase; letter-spacing: .04em; } .am-t { grid-area: t; overflow-wrap: anywhere; font-family: var(--font-display); }
    .am-v { grid-area: v; font-size: 10px; color: var(--nv-ink-2); text-transform: uppercase; &.ok { color: var(--nv-red); font-weight: 700; } }
    .acts { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; .btn { min-height: 36px; } .btn small { font-size: 10px; opacity: .8; } .end { margin-left: auto; } }
    .sheet { border-top: 3px solid var(--nv-red); p { margin: 0; font-size: 12px; } }
    .row2 { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; .btn { min-height: 36px; } }
    .sum { gap: 8px; }
    .jo-h { margin: 0; text-align: center; font: 700 10px var(--font-body); letter-spacing: .14em; text-transform: uppercase; border-top: 3px double var(--nv-ink); border-bottom: 1px solid var(--nv-ink); padding: 4px 0; }
    .jo-t { margin: 0; text-align: center; font: 600 15px/1.25 var(--font-display); }
    .verdict-big { margin: 0; font-size: 13px; text-align: center; color: var(--nv-red); &.ok { color: var(--good); } }
    .bars { display: grid; grid-template-columns: auto minmax(0, 1fr) 40px; gap: 5px 8px; align-items: center; font-size: 12px; b { text-align: right; }
      .bar { display: block; height: 7px; border-radius: 1px; background: var(--nv-paper-2); border: 1px solid var(--nv-rule); overflow: hidden; span { display: block; height: 100%; background: var(--nv-ink); } } }
    .final { border-top: 1px solid var(--nv-rule); padding-top: 6px !important; }
    .final li { font: 13px/1.3 var(--font-display); display: flex; gap: 6px; span { font: 700 12px var(--font-body); width: 14px; flex: none; } &.l2 span { color: var(--good); } &.l1 span { color: #9a6a10; } &.l0 { color: var(--nv-ink-2); text-decoration: line-through; span { color: var(--nv-red); } } }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 76px; overflow: auto; font: 11px/1.3 var(--font-mono); color: var(--ink-2); li:first-child { color: var(--ink); } }
    @media (prefers-reduced-motion: reduce) { .card, .lines li.in, .amdts li.in, .flash { animation: none; } .s { transition: none; } }
  `,
})
export class NavetteGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly Math = Math;
  protected readonly LV = LV;
  protected readonly RED = RED;
  protected readonly CENSURE = CENSURE;
  protected readonly fmt = fmt;
  protected readonly sgn = sgn;
  protected readonly word = word;
  protected readonly tone = tone;
  protected readonly canDo = canDo;
  protected readonly can493 = can493;
  protected readonly canBloque = canBloque;
  protected readonly anStage = anStage;
  protected readonly textFixed = textFixed;
  protected readonly demandLabel = demandLabel;
  protected readonly defFactor = defFactor;
  protected readonly IC = IC;
  protected readonly plain = plain;
  protected readonly half = half;
  protected readonly uid = 'nv' + ++navInstances;

  protected billTitle = '';
  protected brief = '';
  protected stepLabels: string[] = [...STAGES];

  protected readonly game = signal<Game>(newGame('loi', 1, mulberry(1)));
  protected readonly phase = signal<'intro' | 'play' | 'result' | 'over'>('intro');
  protected readonly intro = signal<Intro | null>(null);
  protected readonly tab = signal<'texte' | 'groupes' | 'amdts'>('texte');
  protected readonly selArt = signal<number | null>(null);
  protected readonly selGrp = signal<Gid | null>(null);
  protected readonly confirm = signal<'493' | 'bloque' | null>(null);
  protected readonly result = signal<ResView | null>(null);
  protected readonly step = signal(0);
  protected readonly shown = signal<Tally | null>(null);
  protected readonly reveal = signal(1);
  protected readonly animDone = signal(false);
  protected readonly busy = signal(false);
  protected readonly log = signal<string[]>([]);
  protected readonly flashes = signal<Flash[]>([]);
  protected readonly score = signal(0);
  private readonly rnd: Rnd = mulberry((Math.random() * 2 ** 32) >>> 0);
  private timers: ReturnType<typeof setTimeout>[] = [];
  private reduced = false;
  private lastStop = 0;

  /** Ce que donnerait le vote, d'après les informations du gouvernement */
  protected readonly fc = computed(() => forecast(this.game(), true));
  protected readonly cmpNow = computed(() => (this.game().mode === 'cmp' ? cmpCheck(this.game(), true) : null));
  protected readonly cmpOk = computed(() => !!this.cmpNow()?.ok);
  protected readonly cmpView = computed(() => this.phase() !== 'over' && (this.game().mode === 'cmp' && this.phase() !== 'intro' || !!this.result()?.cmp) && this.game().v !== 'constitution');
  /** La projection affichée : en deuxième lecture constitutionnelle, le Sénat (le verrou) */
  protected readonly projT = computed(() => { const ck = this.cmpNow(); return ck && this.game().v === 'constitution' ? ck.sen : this.fc().final; });
  protected readonly ambNow = computed(() => ambition(this.game()));
  protected readonly defNow = computed(() => deficit(this.game()));
  protected readonly congresNow = computed(() => tally(this.game(), 'congres', levels(this.game()), true));
  protected readonly unknown = computed(() => this.game().groups.filter(g => !g.known).length);
  protected readonly groupsSorted = computed(() => [...this.game().groups].sort((a, b) => a.pos - b.pos));
  protected readonly stopAt = computed(() => this.lastStop);

  /** La chambre affichée et ses sièges */
  protected readonly hemi = computed(() => {
    const G = this.game();
    const R = this.result();
    if (this.cmpView()) {
      const ck = R?.cmp ?? this.cmpNow();
      const ms = ck?.members ?? [];
      const geo = geometry(14);
      const cls = geo.seats.map((_, i) => (ms[i] ? (ms[i].pour ? 'p' : 'c') : 'w'));
      const strokes = geo.seats.map((_, i) => (ms[i] ? gOf(G, ms[i].g)?.color ?? null : null));
      return { geo, cls, strokes, ch: 'cmp', center: `${ck?.yes ?? 0}/14`, sub: 'voix pour · 8 requises' };
    }
    const t = this.shown() ?? this.projT();
    const ch = t?.ch ?? voteChamber(G);
    const n = totalSeats(ch);
    const geo = geometry(n);
    const strokes: (string | null)[] = [];
    if (!t) return { geo, cls: geo.seats.map(() => 'w'), strokes, ch: ch as string, center: '', sub: '' };
    const order = [...G.groups].sort((a, b) => a.pos - b.pos);
    const base: string[] = [];
    for (const g of order) {
      const row = t.rows.find(x => x.g === g.id);
      if (!row) continue;
      if (t.kind === 'censure') { for (let k = 0; k < row.p; k++) base.push('c'); for (let k = 0; k < row.seats - row.p; k++) base.push('a g0'); continue; }
      for (let k = 0; k < row.p; k++) base.push('p');
      for (let k = 0; k < row.a; k++) base.push('a');
      for (let k = 0; k < row.c; k++) base.push('c');
    }
    while (base.length < n) base.push('w');
    const rv = this.reveal();
    const cls = geo.seats.map((_, i) => (geo.rank[i] < rv * n ? base[i] : 'w'));
    const cut = Math.round(rv * n);
    const shownP = t.kind === 'censure' ? Math.min(t.p, cut) : Math.round(t.p * rv);
    return {
      geo, cls, strokes, ch: ch as string,
      center: t.kind === 'censure' ? `${shownP}/${CENSURE}` : `${Math.round(t.p * rv)}–${Math.round(t.c * rv)}`,
      sub: t.kind === 'censure' ? 'voix pour la censure' : ch === 'com' ? 'commission' : ch === 'sen' ? 'Sénat' : ch === 'congres' ? 'Congrès · 3/5 requis' : 'Assemblée nationale',
    };
  });

  /** L'anneau des groupes autour de l'hémicycle */
  protected readonly ring = computed(() => {
    if (this.cmpView()) return [];
    const G = this.game();
    const t = this.shown() ?? this.projT();
    const ch = t.ch;
    const order = [...G.groups].sort((a, b) => a.pos - b.pos);
    const tot = totalSeats(ch);
    let acc = 0;
    const R = 97.5;
    return order.map(g => {
      const n = seatsIn(g, ch);
      const a0 = Math.PI * (1 - acc / tot), a1 = Math.PI * (1 - (acc + n) / tot);
      acc += n;
      const p = (a: number) => `${(100 + R * Math.cos(a)).toFixed(2)} ${(97 - R * Math.sin(a)).toFixed(2)}`;
      return { id: g.id, color: g.color, d: `M ${p(a0 - 0.004)} A ${R} ${R} 0 0 1 ${p(a1 + 0.004)}` };
    });
  });

  protected readonly tallyLine = computed(() => {
    if (this.cmpView() || this.phase() === 'over') return null;
    const R = this.result();
    const t = this.shown() ?? this.projT();
    if (t.kind === 'censure') {
      const done = this.reveal() >= 1;
      return { p: Math.round(t.p * this.reveal()), c: t.total - t.p, a: 0, ok: !t.ok, need: t.need, kind: t.kind, label: !done ? 'Censure…' : t.ok ? 'Censure adoptée' : 'Censure rejetée' };
    }
    const done = this.reveal() >= 1;
    const pending = R ? !done : false;
    const lab = pending ? 'Vote en cours…' : t.kind === 'tpf' ? `${t.ok ? '✓' : '✗'} 3/5 : ${t.need} requis` : `${t.ok ? '✓ adopté' : '✗ rejeté'}${R ? '' : ' (projection)'}`;
    const p = Math.round(t.p * this.reveal()), c = Math.round(t.c * this.reveal());
    return { p, c, a: Math.round(t.a * this.reveal()), ok: t.ok, need: t.kind === 'tpf' ? Math.ceil(0.6 * (p + c)) : Math.floor((p + c) / 2) + 1, kind: t.kind, label: lab };
  });

  protected readonly confirmProj = computed(() => {
    const k = this.confirm();
    if (!k) return null;
    const c = cloneGame(this.game());
    for (const g of c.groups) if (!g.coal) g.anger++;
    c.pending = [];
    return k === '493' ? censureTally(c, levels(c), true) : tally(c, voteChamber(c), levels(c), true);
  });

  ngOnInit(): void {
    const id = this.def().id;
    const v: Variant = /budget|finances/.test(id) ? 'budget' : /reforme|retraite/.test(id) ? 'reforme' : /constitution/.test(id) ? 'constitution' : 'loi';
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const G = newGame(v, this.diff(), this.rnd);
    this.billTitle = this.def().title ? `${this.def().title} — ${BILLS[v].title}` : BILLS[v].title;
    this.brief = BRIEF[v];
    if (v === 'constitution') this.stepLabels = ['Commission', 'Séance publique', 'Sénat', '2e lecture', 'Congrès'];
    this.game.set(G);
    this.begin();
  }

  ngOnDestroy(): void { this.timers.forEach(t => clearTimeout(t)); }

  /* ── Libellés ── */

  protected pct(x: number): string { return `${Math.round(x * 100)} %`; }
  protected artN(id: number): number { return aOf(this.game(), id)?.n ?? 0; }
  protected shortOf(id: Gid): string { return gOf(this.game(), id)?.short ?? id; }
  protected range(a: Article): Level[] { return cmpRange(this.game(), a); }
  protected honored(g: Group): boolean { return dealHonored(this.game(), g, levels(this.game())); }
  protected sNow(g: Group): number { return sOf(this.game(), g, this.sCh(), levels(this.game()), true); }
  protected parts(g: Group): SPart[] { return sParts(this.game(), g, this.sCh(), levels(this.game()), true); }
  protected seatsNow(g: Group): number { const ch = voteChamber(this.game()); return seatsIn(g, this.game().mode === 'cmp' ? 'an' : ch); }
  private sCh(): Chamber { const ch = voteChamber(this.game()); return ch === 'sen' ? 'sen' : 'an'; }

  protected origin(a: Article, l: Level): string {
    const G = this.game();
    const an = G.an?.[a.id] ?? 0, sn = G.sen?.[a.id];
    const o = [l === an ? 'Assemblée' : '', sn !== undefined && l === sn ? 'Sénat' : ''].filter(Boolean).join(' · ');
    return o || 'compromis';
  }

  protected whoLikes(a: Article): { id: Gid; short: string; color: string }[] {
    const ch = this.sCh();
    return this.groupsSorted().filter(g => attAt(a, g.id, a.level || 2, ch) > 0).map(g => ({ id: g.id, short: g.short, color: g.color }));
  }
  protected whoHates(a: Article): { id: Gid; short: string; color: string }[] {
    const ch = this.sCh();
    return this.groupsSorted().filter(g => attAt(a, g.id, a.level || 2, ch) < 0).map(g => ({ id: g.id, short: g.short, color: g.color }));
  }
  protected redOn(a: Article): string[] { return this.game().groups.filter(g => g.known && g.red === a.id).map(g => g.short); }
  protected threat(a: Article): boolean { return this.fc().res.some(x => x.am.art === a.id && x.t.ok && x.am.to < a.level); }

  protected amdtLabel(am: Amdt): string {
    const a = aOf(this.game(), am.art);
    const n = a ? (a.extra ? `l’article additionnel « ${a.title} »` : `l’article ${a.n}`) : 'un article';
    return am.kind === 'sup' ? `supprimer ${n}` : am.kind === 'rew' ? `réécrire ${n}` : am.kind === 'ret' ? `rétablir ${n}` : `ajouter « ${a?.title ?? ''} »`;
  }

  protected stageIcon(): string { return STAGE_IC[this.game().stage] ?? STAGE_IC[4]; }
  protected legLine(): string {
    const G = this.game();
    if (G.mode === 'congres') return 'Congrès du Parlement · Versailles';
    if (G.mode === 'cmp') return G.v === 'constitution' ? 'Deuxième lecture · Assemblée nationale et Sénat' : 'Commission mixte paritaire';
    if (G.mode === 'conclusions') return 'Lecture des conclusions de la CMP · Assemblée nationale';
    return ['Commission saisie au fond · Assemblée nationale', 'Séance publique · Assemblée nationale, première lecture', 'Sénat · première lecture', 'Commission mixte paritaire', 'Lecture définitive · Assemblée nationale'][G.stage] ?? '';
  }
  protected textState(): string {
    const G = this.game();
    if (G.mode === 'cmp') return 'Texte élaboré par la commission mixte paritaire';
    return ['Texte déposé sur le bureau de l’Assemblée nationale', 'Texte adopté par la commission', 'Texte adopté par l’Assemblée nationale', 'Texte en discussion', 'Texte en lecture définitive'][G.stage] ?? '';
  }
  protected loiTitle(): string {
    const G = this.game();
    const d = new Date();
    const rest = BILLS[G.v].title.replace(/^Projet de loi( constitutionnelle)?/, '');
    return `Loi${G.v === 'constitution' ? ' constitutionnelle' : ''} n° ${d.getFullYear()}-${400 + (G.amendNo % 500)} du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}${rest}`;
  }
  protected stageHelp(): string {
    const G = this.game();
    if (G.stage === 0) return 'La commission est une répétition : ses votes reflètent ceux de l’hémicycle. Si elle rejette le texte, vous perdrez du temps en séance.';
    if (G.stage === 1) return 'Le vote décisif à l’Assemblée. Les amendements adoptés modifient le texte avant le vote sur l’ensemble.';
    if (G.stage === 2) return 'Une autre majorité : vos accords valent aussi au Sénat. Les amendements de la majorité sénatoriale seront votés avant le texte.';
    if (G.stage === 3) return G.v === 'constitution' ? 'En matière constitutionnelle, le Sénat a autant de pouvoir que l’Assemblée : sans accord, la révision meurt.' : 'Sans accord, l’Assemblée reprendra son propre texte en lecture définitive, face à une nouvelle obstruction.';
    if (G.mode === 'congres') return 'Seuls les accords peuvent encore faire bouger des voix.';
    if (G.mode === 'conclusions') return 'Le texte est figé : il reste le vote, les accords… ou le 49.3.';
    return 'L’Assemblée repart de son texte ; vous pouvez reprendre la version du Sénat d’un article (1 ⏱).';
  }

  protected voteLabel(): string {
    const G = this.game();
    if (G.stage === 0) return 'Vote en commission';
    if (G.stage === 2) return 'Vote du Sénat';
    if (G.mode === 'congres') return 'Vote du Congrès';
    if (G.stage === 4) return 'Vote définitif';
    return 'Vote solennel';
  }
  protected canBloqueShown(): boolean { const G = this.game(); return G.mode === 'conclusions' || G.mode === 'congres' || G.stage === 0; }

  protected hemiLabel(): string {
    const h = this.hemi();
    const t = this.tallyLine();
    return t ? `Hémicycle : ${t.p} pour, ${t.c} contre, ${t.a} abstentions. ${t.label}` : `Commission mixte paritaire : ${h.center} voix pour.`;
  }

  protected endMessage(): string {
    const G = this.game();
    const r = this.score();
    if (G.status === 'censure') return 'La motion de censure est adoptée : le gouvernement tombe, le texte avec lui.';
    if (G.status === 'lost') return G.v === 'constitution' && G.lostAt >= 3 ? 'La révision constitutionnelle est enterrée.' : 'Le texte est rejeté : retour à la case départ.';
    if (G.v === 'budget' && deficit(G) > G.target + 0.001) return 'Budget adopté, mais la cible de déficit est manquée.';
    return r >= 0.85 ? 'Adopté définitivement, et presque intact : une victoire politique.' : r >= 0.65 ? 'Adopté définitivement : l’essentiel est sauf.' : 'Adopté, mais vidé de sa substance.';
  }

  protected finalArts(): Article[] { return this.game().arts.filter(a => !a.extra || a.level > 0); }

  /* ── Aperçus ── */

  protected prev(act: Action): Prev {
    const G = this.game();
    const f0 = this.fc();
    const err = canDo(G, act);
    if (err) return { err, dAmb: 0, t0: f0.final, t1: f0.final, moves: [], notes: [] };
    const c = cloneGame(G);
    applyAction(c, act);
    const f1 = forecast(c, true);
    const ch = this.sCh();
    const moves: Move[] = [];
    for (const g of G.groups) {
      const s0 = sOf(G, g, ch, f0.lv, true);
      const g1 = gOf(c, g.id);
      const s1 = sOf(c, g1, ch, f1.lv, true);
      if (word(s0) !== word(s1)) moves.push({ id: g.id, short: g.short, from: word(s0), to: word(s1), up: s1 > s0 });
    }
    const notes: string[] = [];
    if (G.v === 'budget') { const d0 = deficit(G, f0.lv), d1 = deficit(c, f1.lv); if (Math.abs(d1 - d0) > 0.001) notes.push(`💶 Déficit ${fmt(d0, 2)} % → ${fmt(d1, 2)} %${d1 > G.target + 0.001 ? ' : au-dessus de la cible !' : ''}`); }
    if (G.v === 'reforme' && c.pressure !== G.pressure) notes.push(`✊ Mobilisation ${G.pressure} → ${c.pressure}`);
    for (const g of G.groups) {
      const g1 = gOf(c, g.id);
      if (g.deal && dealHonored(G, g, f0.lv) && !dealHonored(c, g1, f1.lv)) notes.push(`⚠️ Trahit l’accord avec ${g.name}`);
      if (g.known && g.red !== null && (f0.lv[g.red] ?? 0) === 2 && (f1.lv[g.red] ?? 0) < 2) notes.push(`🔓 Désamorce la ligne rouge de ${g.short}`);
    }
    const res1 = new Set(f1.res.filter(x => x.t.ok).map(x => x.am.id));
    for (const x of f0.res) if (x.t.ok && !res1.has(x.am.id) && c.pending.some(p => p.id === x.am.id)) notes.push(`✂️ L’amendement n° ${fmt(x.am.num)} serait rejeté`);
    return { err: null, dAmb: Math.round((ambition(G, f0.lv) - ambition(c, f1.lv)) * 100), t0: f0.final, t1: f1.final, moves, notes };
  }

  protected artOps(a: Article): { label: string; cost: string; act: Action; prev: Prev }[] {
    const G = this.game();
    const out: { label: string; cost: string; act: Action; prev: Prev }[] = [];
    if (a.level === 2) out.push({ label: 'Réécrire', cost: '1 temps', act: { t: 'amend', a: a.id }, prev: this.prev({ t: 'amend', a: a.id }) });
    if (a.level > 0) out.push({ label: 'Supprimer', cost: '1 temps', act: { t: 'drop', a: a.id }, prev: this.prev({ t: 'drop', a: a.id }) });
    if (G.mode === 'definitive' && G.sen && G.sen[a.id] !== undefined && G.sen[a.id] !== a.level) out.push({ label: `Version du Sénat (${LV[G.sen[a.id]].toLowerCase()})`, cost: '1 temps', act: { t: 'senat', a: a.id }, prev: this.prev({ t: 'senat', a: a.id }) });
    return out;
  }

  /* ── Interaction ── */

  protected toggleArt(id: number): void { this.selArt.set(this.selArt() === id ? null : id); }
  protected toggleGrp(id: Gid): void { this.selGrp.set(this.selGrp() === id ? null : id); }

  protected play(): void {
    this.phase.set('play');
    this.tab.set(this.game().stage === 0 ? 'groupes' : 'texte');
    this.selArt.set(null); this.selGrp.set(null);
  }

  protected act(a: Action): void {
    if (this.busy() || this.phase() !== 'play') return;
    const G = cloneGame(this.game());
    if (canDo(G, a)) return;
    const before = this.fc().final;
    const lines = applyAction(G, a);
    lines.push(...aiReact(G, this.rnd));
    this.game.set(G);
    for (const l of lines) this.say(l.msg);
    if (lines.some(l => l.bad)) this.miss.emit();
    const after = this.fc().final;
    const d = (after.p - after.c) - (before.p - before.c);
    if (d) this.flash(`${d > 0 ? '+' : '−'}${Math.abs(d)} d’écart`, d > 0);
    this.emitProgress();
  }

  protected cmpPick(id: number, l: Level): void {
    if (this.busy()) return;
    const G = cloneGame(this.game());
    const before = this.cmpNow()?.yes ?? 0;
    cmpSet(G, id, l);
    this.game.set(G);
    const after = this.cmpNow()?.yes ?? 0;
    if (after !== before) this.flash(`${after > before ? '+' : '−'}${Math.abs(after - before)} voix`, after > before);
    this.emitProgress();
  }

  protected resolve(kind: Resolution['kind']): void {
    if (this.busy() || this.phase() !== 'play') return;
    this.confirm.set(null);
    const G = cloneGame(this.game());
    const stage = G.stage;
    const title = kind === '493' ? 'Article 49.3 : la motion de censure' : kind === 'bloque' ? 'Vote bloqué' : `${this.voteLabel()}`;
    const r = resolveStage(G, kind);
    if (!r.passed || r.res.some(x => x.t.ok && (x.am.kind === 'sup' || x.am.kind === 'rew'))) this.miss.emit();
    if (G.status !== 'play') this.lastStop = stage;
    this.game.set(G);
    this.runResult({ title, kind, res: r.res, main: r.censure ?? r.final, passed: r.passed, lines: r.lines, cmp: null });
  }

  protected cmpEnd(agree: boolean): void {
    if (this.busy() || this.phase() !== 'play') return;
    const G = cloneGame(this.game());
    const r = cmpConclude(G, agree);
    if (G.status !== 'play') this.lastStop = 3;
    if (r.lines.some(l => l.bad)) this.miss.emit();
    this.game.set(G);
    const constit = G.v === 'constitution';
    this.runResult({ title: constit ? 'Deuxième lecture' : 'Commission mixte paritaire', kind: 'cmp', res: [], main: constit ? r.check.sen : null, passed: G.status === 'play', lines: r.lines, cmp: constit ? null : r.check });
  }

  /** Le dépouillement : les amendements un à un, puis le vote sur l'ensemble */
  private runResult(R: ResView): void {
    this.result.set(R);
    this.phase.set('result');
    this.busy.set(true);
    this.animDone.set(false);
    this.step.set(0);
    const seq: Tally[] = [...R.res.map(x => x.t), ...(R.main ? [R.main] : [])];
    const D = this.reduced ? 0 : 900;
    let k = 0;
    const nextTally = () => {
      if (k >= seq.length) { this.step.set(R.res.length); this.reveal.set(1); this.finishResult(); return; }
      const t = seq[k];
      this.shown.set(t);
      if (k < R.res.length) this.step.set(k + 1);
      if (!D) { this.reveal.set(1); k++; nextTally(); return; }
      const frames = k < R.res.length ? 10 : 22;
      const dur = k < R.res.length ? 550 : D * 1.4;
      let f = 0;
      this.reveal.set(0);
      const tick = () => {
        f++;
        this.reveal.set(Math.min(1, f / frames));
        if (f < frames) this.later(tick, dur / frames);
        else { k++; this.later(nextTally, k < seq.length ? 350 : 250); }
      };
      this.later(tick, 60);
    };
    nextTally();
  }

  private finishResult(): void {
    const R = this.result()!;
    for (const l of R.lines) this.say(l.msg);
    this.animDone.set(true);
    this.busy.set(false);
    this.emitProgress();
    if (this.game().status !== 'play') this.later(() => this.finish(), this.reduced ? 600 : 1300);
  }

  protected next(): void {
    if (this.busy()) return;
    if (this.game().status !== 'play') { this.finish(); return; }
    this.begin();
  }

  private begin(): void {
    this.shown.set(null);
    this.reveal.set(1);
    this.result.set(null);
    this.confirm.set(null);
    const G = cloneGame(this.game());
    const it = startStage(G, this.rnd);
    this.game.set(G);
    this.intro.set(it);
    for (const l of it.lines) this.say(l.msg);
    if (it.lines.some(l => l.bad)) this.miss.emit();
    this.phase.set('intro');
    this.emitProgress();
  }

  private finish(): void {
    if (this.phase() === 'over') return;
    const G = this.game();
    const sc = finalScore(G);
    this.score.set(sc);
    this.result.set(null);
    this.phase.set('over');
    this.busy.set(false);
    if (sc < 0.45) this.miss.emit();
    this.progress.emit({ live: sc, time: 0 });
    this.later(() => this.done.emit(sc), 2200);
  }

  private emitProgress(): void {
    const G = this.game();
    const f = this.fc();
    const live = G.status === 'play' ? (f.final.ok ? adoptedScore(G, f.lv) : 0.3) : finalScore(G);
    this.progress.emit({ live, time: clamp(1 - G.stage / 5) });
  }

  private say(t: string): void { this.log.update(l => [plain(t), ...l].slice(0, 8)); }
  private flash(text: string, good: boolean): void {
    const f: Flash = { text, good, id: ++flashId };
    this.flashes.update(a => [...a, f]);
    this.later(() => this.flashes.update(a => a.filter(x => x.id !== f.id)), 1200);
  }
  private later(fn: () => void, ms: number): void { this.timers.push(setTimeout(fn, ms)); }
}

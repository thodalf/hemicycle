import { todayKey } from './daily';

/* ============================================================
 *  Parties en cours de la salle de jeux : on peut quitter une
 *  grille ou le mot du jour en route et les reprendre plus tard,
 *  réponses comprises. Tout s'efface au changement de jour réel.
 *  Mémorisé dans le navigateur.
 * ============================================================ */

export interface GridSave { kind: 'grille'; day: string; rows: string[]; cols: string[]; cells: (string | null)[]; left: number; pts?: (number | null)[] }
export interface MotSave { kind: 'mot'; day: string; guesses: string[] }
export type ArcadeSave = GridSave | MotSave;

const key = (id: string) => `hemicycle.arcade.${id}`;

/**
 * Version des règles des grilles : la changer relance la grille du jour pour tout le monde
 * (nouvelle graine, parties et résultats du jour effacés). v3 : au moins trois réponses par case.
 */
const GRID_RULES = 'r3';
const isGrid = (id: string) => id !== 'sutom' && id !== 'mot_du_jour';
/** L'étiquette du jour d'une partie : la date, plus la version des règles pour les grilles */
export const dayTag = (id: string) => (isGrid(id) ? `${todayKey()}#${GRID_RULES}` : todayKey());

export function loadSave<T extends ArcadeSave>(id: string): T | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key(id));
    if (!raw) return null;
    const s = JSON.parse(raw) as T;
    if (s.day !== dayTag(id)) { localStorage.removeItem(key(id)); return null; }
    return s;
  } catch { return null; }
}

export function writeSave(id: string, s: Omit<GridSave, 'day'> | Omit<MotSave, 'day'>): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key(id), JSON.stringify({ ...s, day: dayTag(id) })); } catch { /* navigation privée */ }
}

export function clearSave(id: string): void {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key(id)); } catch { /* navigation privée */ }
}

/* ── Résultat du jour (partie terminée : plus de nouvelle partie avant demain) ── */

export interface CritView { label: string; badge?: string; color?: string }
export type Outcome = 'complete' | 'abandon' | 'perdu';
export interface GridResult {
  kind: 'grille'; id: string; day: string; title: string; icon: string;
  rows: CritView[]; cols: CritView[];
  /** Réponse donnée dans chaque case (ou null) */
  cells: (string | null)[];
  /** Toutes les réponses possibles de chaque case */
  answers: string[][];
  found: number; mistakes: number; maxMistakes: number; outcome: Outcome;
  /** Points de rareté de chaque case (la réponse la plus rare rapporte le plus) */
  pts?: (number | null)[];
  /** Total des points de rareté */
  points?: number;
}
export interface MotResult { kind: 'mot'; id: string; day: string; title: string; icon: string; word: string; guesses: { text: string; marks: ('ok' | 'mal' | 'non')[] }[]; found: boolean }
export type ArcadeResult = GridResult | MotResult;

const rkey = (id: string) => `hemicycle.arcade.result.${id}`;

export function saveResult(r: Omit<GridResult, 'day'> | Omit<MotResult, 'day'>): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(rkey(r.id), JSON.stringify({ ...r, day: dayTag(r.id) })); } catch { /* navigation privée */ }
}

export function loadResult(id: string): ArcadeResult | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(rkey(id));
    if (!raw) return null;
    const r = JSON.parse(raw) as ArcadeResult;
    if (r.day !== dayTag(id)) { localStorage.removeItem(rkey(id)); return null; }
    return r;
  } catch { return null; }
}

/** Une graine stable pour la grille du jour : la même pour tout le monde */
export function dailyRand(id: string): () => number {
  let h = 2166136261;
  for (const ch of `${id}-${dayTag(id)}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  let a = h || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** « 4/9 », « 2 essais » : où en est la partie en cours */
export function saveProgress(id: string): string | null {
  const s = loadSave(id);
  if (!s) return null;
  if (s.kind === 'grille') return `${s.cells.filter(Boolean).length}/9`;
  return s.guesses.length ? `${s.guesses.length} essai${s.guesses.length > 1 ? 's' : ''}` : null;
}

/** Le score (0-1) d'une partie terminée */
export function resultScore(r: ArcadeResult): number {
  if (r.kind === 'grille') return r.found / 9;
  return r.found ? [1, 1, 0.92, 0.8, 0.65, 0.5][r.guesses.length - 1] ?? 0.5 : 0.1;
}

import { todayKey } from './daily';

/* ============================================================
 *  Parties en cours de la salle de jeux : on peut quitter une
 *  grille ou le mot du jour en route et les reprendre plus tard,
 *  réponses comprises. Tout s'efface au changement de jour réel.
 *  Mémorisé dans le navigateur.
 * ============================================================ */

export interface GridSave { kind: 'grille'; day: string; rows: string[]; cols: string[]; cells: (string | null)[]; left: number }
export interface MotSave { kind: 'mot'; day: string; guesses: string[] }
export type ArcadeSave = GridSave | MotSave;

const key = (id: string) => `hemicycle.arcade.${id}`;

export function loadSave<T extends ArcadeSave>(id: string): T | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key(id));
    if (!raw) return null;
    const s = JSON.parse(raw) as T;
    if (s.day !== todayKey()) { localStorage.removeItem(key(id)); return null; }
    return s;
  } catch { return null; }
}

export function writeSave(id: string, s: Omit<GridSave, 'day'> | Omit<MotSave, 'day'>): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key(id), JSON.stringify({ ...s, day: todayKey() })); } catch { /* navigation privée */ }
}

export function clearSave(id: string): void {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key(id)); } catch { /* navigation privée */ }
}

/** « 4/9 », « 2 essais » : où en est la partie en cours */
export function saveProgress(id: string): string | null {
  const s = loadSave(id);
  if (!s) return null;
  if (s.kind === 'grille') return `${s.cells.filter(Boolean).length}/9`;
  return s.guesses.length ? `${s.guesses.length} essai${s.guesses.length > 1 ? 's' : ''}` : null;
}

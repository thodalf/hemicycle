/* ============================================================
 *  Le mot du jour : un seul mot par jour réel (le même pour
 *  tout le monde), jouable une fois ; ensuite, rendez-vous
 *  demain. Mémorisé dans le navigateur.
 * ============================================================ */

const KEY = 'hemicycle.motDuJour';

/** « 2026-10-14 » (date locale) */
export function todayKey(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function hash(t: string): number {
  let h = 2166136261;
  for (const ch of t) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

/** Le mot du jour, identique pour tous ce jour-là */
export function dailyWord(words: string[], now = new Date()): string {
  return words[hash(`mot-${todayKey(now)}`) % words.length];
}

export function dailyPlayed(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === todayKey(); } catch { return false; }
}

export function markDailyPlayed(): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, todayKey()); } catch { /* navigation privée */ }
}

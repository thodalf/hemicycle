/* ============================================================
 *  Calendrier : un tour de jeu = un mois.
 *  Le tour 1 est janvier 2027. Par compatibilité avec les
 *  sauvegardes, les champs nommés « week » / « …Week » comptent
 *  des tours, donc des mois.
 * ============================================================ */

export const START_YEAR = 2027;
export const MONTHS_PER_YEAR = 12;
/** Semaines dans un mois : sert à convertir les anciens rythmes hebdomadaires */
export const WEEKS_PER_MONTH = 52 / 12;

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Mois du tour (0 = janvier) */
export function monthIndex(turn: number): number {
  return (((turn - 1) % 12) + 12) % 12;
}

export function yearOf(turn: number): number {
  return START_YEAR + Math.floor((turn - 1) / 12);
}

/** Premier jour du mois correspondant au tour */
export function dateOfTurn(turn: number): Date {
  return new Date(START_YEAR, turn - 1, 1);
}

/** « mars 2029 » */
export function monthLabel(turn: number): string {
  return `${MONTHS[monthIndex(turn)]} ${yearOf(turn)}`;
}

/** « mars 29 » : pour les graphiques et les puces */
export function monthShort(turn: number): string {
  return `${MONTHS_SHORT[monthIndex(turn)]} ${String(yearOf(turn)).slice(2)}`;
}

/** « en mars 2029 », « en août 2030 » */
export function inMonth(turn: number): string {
  return `en ${monthLabel(turn)}`;
}

/** « 1 mois », « 14 mois », « 2 ans et 3 mois » */
export function durationLabel(months: number): string {
  const m = Math.max(0, Math.round(months));
  if (m < 24) return `${m} mois`;
  const y = Math.floor(m / 12), r = m % 12;
  return `${y} an${y > 1 ? 's' : ''}${r ? ` et ${r} mois` : ''}`;
}

/** Probabilité sur un mois d'un événement de probabilité hebdomadaire p */
export function monthlyChance(weekly: number): number {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, weekly)), WEEKS_PER_MONTH);
}

/** Convertit un ancien numéro de semaine en numéro de mois (migration des sauvegardes) */
export function weekToTurn(week: number): number {
  return Math.max(1, Math.round((week - 1) / WEEKS_PER_MONTH) + 1);
}

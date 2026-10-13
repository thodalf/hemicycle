import { Effect, GameState, SideIncome } from '../models/game.models';
import { monthLabel } from './calendar';
import { pushNews } from './effects';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Revenus annexes : enseignement, société de conseil,
 *  chronique télé, droits d'auteur, conseil d'administration,
 *  placements. Versés chaque mois ; les activités privées sont
 *  suspendues pendant une fonction gouvernementale.
 * ============================================================ */

const GOVERNMENT = new Set(['ministre', 'premier_ministre', 'president']);

/** Une fonction gouvernementale interdit les activités privées */
export function sidePayable(d: GameState, s: SideIncome): boolean {
  if (s.until !== null && d.week > s.until) return false;
  return !!s.compatible || !GOVERNMENT.has(d.player.rankId);
}

export function sideNote(d: GameState, s: SideIncome): string {
  if (!sidePayable(d, s)) return 'Suspendu : incompatible avec une fonction gouvernementale';
  return s.until === null ? 'Sans échéance' : `Jusqu’en ${monthLabel(s.until)}`;
}

/** Effet « side » : ouvrir, prolonger ou arrêter un revenu annexe */
export function adjustSide(d: GameState, e: Extract<Effect, { kind: 'side' }>): string[] {
  const p = d.player;
  p.sideIncomes ??= [];
  if (e.stop) {
    const had = p.sideIncomes.some(x => x.id === e.id);
    p.sideIncomes = p.sideIncomes.filter(x => x.id !== e.id);
    return had ? [`Fin : ${e.label}`] : [];
  }
  const amount = Math.round((e.amount + (e.scale ? p.stats[e.scale] * (e.mult ?? 0) : 0)) / 50) * 50;
  const until = e.months ? d.week + e.months : null;
  const existing = p.sideIncomes.find(x => x.id === e.id);
  if (existing) {
    existing.amount = Math.max(existing.amount, amount);
    existing.until = until === null || existing.until === null ? null : Math.max(existing.until, until);
  } else {
    p.sideIncomes.push({ id: e.id, label: e.label, amount, since: d.week, until, ...(e.exposure ? { exposure: e.exposure } : {}), ...(e.compatible ? { compatible: true } : {}) });
  }
  return [`${e.label} : +${amount.toLocaleString('fr-FR')} €/mois${e.months ? ` pendant ${e.months} mois` : ''}`];
}

/** Rendement mensuel estimé de l'épargne placée */
export function placementEstimate(d: GameState): number {
  const mode = Number(d.player.flags['placement'] ?? 0);
  const base = Math.max(0, d.player.finances.personal);
  return mode === 1 ? Math.round(base * 0.0025) : mode === 2 ? Math.round(base * 0.005) : 0;
}

/** Chaque mois : verser, exposer, faire expirer */
export function monthlySide(d: GameState, rng: Rng): void {
  const p = d.player;
  for (const s of [...(p.sideIncomes ?? [])]) {
    if (s.until !== null && d.week > s.until) {
      p.sideIncomes = (p.sideIncomes ?? []).filter(x => x !== s);
      pushNews(d, 'systeme', 'neutral', `Fin d’un revenu : ${s.label.toLowerCase()}`);
      continue;
    }
    if (!sidePayable(d, s)) continue;
    p.finances.personal += s.amount;
    if (s.exposure) p.scandalExposure = clamp(p.scandalExposure + s.exposure);
  }
  // L'épargne placée
  const mode = Number(p.flags['placement'] ?? 0);
  if (mode && p.finances.personal > 0) {
    const r = mode === 1 ? 0.0025 : 0.005 + (rng.next() + rng.next() + rng.next() - 1.5) * 0.06;
    const gain = Math.round(p.finances.personal * r);
    p.finances.personal += gain;
    if (mode === 2 && Math.abs(gain) > 2000) pushNews(d, 'systeme', gain > 0 ? 'positive' : 'negative', gain > 0 ? 'Vos placements s’envolent' : 'Vos placements plongent', `${gain > 0 ? '+' : ''}${gain.toLocaleString('fr-FR')} € ce mois-ci en Bourse.`);
  }
}

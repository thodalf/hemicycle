import { Effect, GameState, StaffRole } from '../models/game.models';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Bonus mensuels des postes de l'équipe qui ne passent pas
 *  par une action : énergie du chauffeur, posts du community
 *  manager, notes de la collaboratrice parlementaire…
 * ============================================================ */

const has = (d: GameState, role: StaffRole) => d.player.staff.includes(role);

/** Points d'action en plus apportés par l'équipe */
export function staffAp(d: GameState): number {
  const governing = !!d.presidency || d.player.rankId === 'ministre' || d.player.rankId === 'premier_ministre';
  return has(d, 'chef_cabinet') && governing ? 1 : 0;
}

export function staffMonthly(d: GameState, _rng: Rng): void {
  const p = d.player;
  const s = p.stats;
  if (has(d, 'community_manager')) s.popularity = clamp(s.popularity + 0.5);
  if (has(d, 'chauffeur')) s.energy = clamp(s.energy + 5);
  if (has(d, 'sondeur') && p.finances.legalCeiling !== null) p.momentum = clamp(p.momentum + 2);
  if (has(d, 'assistant_parlementaire') && ['depute', 'ministre', 'premier_ministre', 'chef_parti', 'candidat_presidence'].includes(p.rankId)) {
    const dossier = p.dossiers[d.agendaDomain];
    dossier.mastery = clamp(dossier.mastery + 2);
    dossier.lastStudiedWeek = d.week;
  }
  if (has(d, 'garde_du_corps')) {
    p.flags['menace'] = Math.max(0, Number(p.flags['menace'] ?? 0) - 3);
    if (d.presidency) d.presidency.threat = clamp(d.presidency.threat - 1);
  }
  if (has(d, 'chef_cabinet')) {
    if (d.government) d.government.majority = clamp(d.government.majority + 0.3);
    if (d.presidency) d.presidency.majority = clamp(d.presidency.majority + 0.2);
  }
  if (has(d, 'sherpa') && (d.presidency || ['ministre', 'premier_ministre'].includes(p.rankId))) {
    d.intl.prestige = clamp(d.intl.prestige + 0.4);
  }
}

/** Attaché·e de presse : +25 % sur les gains de popularité et d'influence des actions « Médias » */
export function boostMedia(d: GameState, effects: Effect[]): Effect[] {
  if (!has(d, 'attache_presse')) return effects;
  return effects.map(e => e.kind === 'stat' && (e.stat === 'popularity' || e.stat === 'influence') && e.delta > 0
    ? { ...e, delta: Math.round(e.delta * 1.25 * 10) / 10 } : e);
}

/** Avocat·e : un quart d'exposition en moins */
export function lawyerFactor(d: GameState): number {
  return has(d, 'juriste') ? 0.75 : 1;
}

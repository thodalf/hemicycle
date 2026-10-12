import { GameState } from '../models/game.models';
import { PROJECTS_BY_ID, ProjectDef, projectLeaves, projectReserve, projectVisible } from '../data/projects';
import { applyEffects, pushNews, rollRisk } from './effects';
import { Rng } from './rng';

/* ============================================================
 *  Projets au long cours : lancement, avancement hebdomadaire,
 *  aboutissement (avec son éventuel risque), abandon.
 * ============================================================ */

export function projectDef(d: GameState): ProjectDef | null {
  return d.project ? PROJECTS_BY_ID.get(d.project.id) ?? null : null;
}

/** Points d'action réservés cette semaine par le projet en cours */
export function reservedAp(d: GameState): number {
  const def = projectDef(d);
  return def ? projectReserve(def, d.player.actionPoints.max) : 0;
}

export function projectAvailability(d: GameState, def: ProjectDef): { ok: boolean; reason?: string } {
  if (!projectVisible(d, def)) return { ok: false, reason: 'Pas à votre rang' };
  if (d.project) return { ok: false, reason: 'Un projet est déjà en cours' };
  const again = Number(d.player.flags[`proj_${def.id}`] ?? 0);
  if (again > d.week) return { ok: false, reason: `De nouveau possible en semaine ${again}` };
  const why = def.eligible?.(d);
  if (why) return { ok: false, reason: why };
  if (def.money && d.player.finances.personal < def.money) return { ok: false, reason: `Il faut ${def.money.toLocaleString('fr-FR')} € de fonds personnels` };
  if (projectLeaves(def) === null && def.ap > d.player.actionPoints.max) return { ok: false, reason: 'Pas assez de points d’action par semaine' };
  return { ok: true };
}

export function startProject(d: GameState, id: string): boolean {
  const def = PROJECTS_BY_ID.get(id);
  if (!def || !projectAvailability(d, def).ok) return false;
  if (def.money) d.player.finances.personal -= def.money;
  const domain = def.domain === 'agenda' ? d.agendaDomain
    : def.domain === 'portfolio' ? d.portfolio ?? d.agendaDomain
    : def.domain;
  d.project = { id, startWeek: d.week, done: 0, weeks: def.weeks, ...(domain ? { domain } : {}) };
  pushNews(d, 'action', 'neutral', `Projet lancé : ${def.label}`,
    `${def.weeks} semaines. ${projectLeaves(def) !== null ? `Gros projet : il ne vous reste que ${projectLeaves(def)} PA par semaine.` : `${def.ap} PA réservés chaque semaine.`}`);
  return true;
}

export function abandonProject(d: GameState): void {
  const def = projectDef(d);
  if (!def || !d.project) return;
  pushNews(d, 'action', 'negative', `Projet abandonné : ${def.label}`, `Après ${d.project.done} semaine(s) sur ${d.project.weeks}. Le temps investi est perdu.`);
  d.player.stats.stress = Math.min(100, d.player.stats.stress + 3);
  d.player.flags[`proj_${def.id}`] = d.week + Math.round(def.cooldown / 2);
  d.project = null;
}

/** Une semaine de projet : un peu d'effet chaque semaine, beaucoup à l'arrivée */
export function weeklyProject(d: GameState, rng: Rng): void {
  const def = projectDef(d);
  const pr = d.project;
  if (!def || !pr || d.status !== 'en_cours') return;
  const ctx = { domain: pr.domain };
  applyEffects(d, def.weekly, ctx, rng);
  pr.done += 1;
  if (pr.done < pr.weeks) return;

  const failed = rollRisk(d, def.risk, ctx, rng);
  const summary = applyEffects(d, failed ? def.risk!.onFailure : def.final, ctx, rng);
  pushNews(d, 'action', failed ? 'negative' : 'positive', failed ? `Projet raté : ${def.label}` : `Projet abouti : ${def.label}`,
    [failed ? def.risk!.failureNews : null, summary.join(' · ')].filter(Boolean).join(' — '));
  d.player.flags[`proj_${def.id}`] = d.week + def.cooldown;
  d.player.flags['lastProjectDone'] = d.week;
  d.project = null;
}

import { GameState } from '../models/game.models';

/* ============================================================
 *  Les grands arcs « scénario » qui surviennent en cours de
 *  partie : jamais plus de deux à la fois. Un arc terminé
 *  (grade maximal, ambassade ouverte, monarchie proclamée…)
 *  ne compte plus.
 * ============================================================ */

export const MAX_ARCS = 2;

export function activeArcs(d: GameState): string[] {
  const out: string[] = [];
  if (d.crown && !d.player.flags['monarchie']) out.push('Couronne');
  if (d.lodge && d.lodge.grade < 4) out.push('Loge');
  if (d.press) out.push('Rédaction');
  if (d.mole) out.push('Infiltration');
  if (d.alien && d.alien.phase < 4) out.push('Premier contact');
  if (d.war) out.push('Guerre');
  if (d.plot) out.push('Complot');
  if (d.zombie && !d.zombie.vaccine) out.push('Épidémie Z');
  const names = { cyber: 'Cyberattaque', proces: 'Procès', jo: 'Jeux olympiques', dissolution: 'Dissolution' } as const;
  for (const [id, a] of Object.entries(d.crises ?? {})) if (a) out.push(names[id as keyof typeof names]);
  return out;
}

/** Un nouvel arc peut-il démarrer ? */
export function canStartArc(d: GameState): boolean {
  return activeArcs(d).length < MAX_ARCS;
}

import { GameState, LocalProject, TerritoryState } from '../models/game.models';
import { pushNews } from './effects';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Votre territoire : une circonscription, ses communes, et des
 *  projets locaux qui se construisent sur plusieurs mois. Ils
 *  attachent les habitants à vous : c'est un bonus aux élections
 *  municipales et législatives.
 * ============================================================ */

export const LOCAL_PROJECTS: Omit<LocalProject, 'done' | 'x' | 'y'>[] = [
  { id: 'mediatheque', label: 'Médiathèque', icon: '📚', months: 4 },
  { id: 'maison_sante', label: 'Maison de santé', icon: '🩺', months: 6 },
  { id: 'piste_cyclable', label: 'Voie verte', icon: '🚲', months: 3 },
  { id: 'lycee', label: 'Rénovation du lycée', icon: '🏫', months: 8 },
  { id: 'zone_activite', label: 'Zone d’activité', icon: '🏭', months: 9 },
  { id: 'tramway', label: 'Tramway', icon: '🚋', months: 14 },
  { id: 'piscine', label: 'Piscine intercommunale', icon: '🏊', months: 7 },
  { id: 'fibre', label: 'Fibre dans les hameaux', icon: '📶', months: 5 },
];

const NAMES = ['Saint-Ardent', 'Villebrune', 'Montclair', 'Les Aulnes', 'Bourg-Neuf', 'Port-Lavande', 'Croix-Haute'];
const POS = [{ x: 50, y: 48 }, { x: 22, y: 30 }, { x: 78, y: 28 }, { x: 30, y: 74 }, { x: 72, y: 72 }, { x: 88, y: 52 }, { x: 12, y: 56 }];

export function initTerritory(): TerritoryState {
  return {
    name: 'Circonscription de Saint-Ardent',
    communes: NAMES.map((name, i) => ({ name, ...POS[i] })),
    attachment: 20,
    projects: [],
  };
}

export function territory(d: GameState): TerritoryState {
  return (d.territory ??= initTerritory());
}

/** Bonus de score aux élections locales */
export function localBonus(d: GameState): number {
  return (d.territory?.attachment ?? 0) * 0.12;
}

export function startLocalProject(d: GameState, rng: Rng, id?: string): string[] {
  const t = territory(d);
  if (t.projects.filter(p => !p.finished).length >= 2) return ['Deux chantiers à la fois, pas plus'];
  const done = new Set(t.projects.map(p => p.id));
  const pool = LOCAL_PROJECTS.filter(p => !done.has(p.id) && (!id || p.id === id));
  if (!pool.length) return ['Tous les grands projets du territoire sont lancés'];
  const def = rng.pick(pool);
  const spot = rng.pick(t.communes);
  t.projects.push({ ...def, done: 0, x: clamp(spot.x + rng.range(-6, 6)), y: clamp(spot.y + rng.range(-6, 6)) });
  return [`Chantier lancé : ${def.label} (${spot.name})`];
}

export function boostLocal(d: GameState, months: number): string[] {
  const p = territory(d).projects.find(x => !x.finished);
  if (!p) return ['Aucun chantier en cours'];
  p.done = Math.min(p.months, p.done + months);
  return [`${p.label} : le chantier accélère`];
}

/** Chaque mois : les chantiers avancent, l'attachement s'érode lentement */
export function monthlyTerritory(d: GameState): void {
  const t = territory(d);
  t.attachment = clamp(t.attachment - 0.3);
  for (const p of t.projects.filter(x => !x.finished)) {
    p.done += 1;
    if (p.done >= p.months) {
      p.finished = true;
      const gain = 6 + Math.round(p.months / 2);
      t.attachment = clamp(t.attachment + gain);
      d.player.stats.popularity = clamp(d.player.stats.popularity + 2);
      pushNews(d, 'actu', 'positive', `Inauguration : ${p.label}`, `Ruban tricolore, fanfare et discours. Attachement des habitants +${gain}.`);
    }
  }
}

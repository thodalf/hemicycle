import { GameState } from '../models/game.models';

/* ============================================================
 *  Talents : une fois les dossiers au maximum, les points de
 *  compétence servent à des atouts personnels, permanents.
 *  Et quand tout est au maximum, on les convertit.
 * ============================================================ */

export type TalentId = 'orateur' | 'endurance' | 'reseau' | 'stratege' | 'charisme' | 'incorruptible' | 'resilience' | 'sang_froid' | 'mobilisateur' | 'gestionnaire';

export interface TalentDef {
  id: TalentId;
  icon: string;
  label: string;
  /** Effet par niveau, en clair */
  effect: string;
  max: number;
  /** Points par niveau */
  cost: number;
}

export const TALENTS: TalentDef[] = [
  { id: 'orateur', icon: '🎤', label: 'Orateur·rice', effect: 'Vos interventions dans l’hémicycle font basculer davantage de voix.', max: 3, cost: 2 },
  { id: 'endurance', icon: '🏃', label: 'Endurance', effect: '+3 d’énergie et −1 de stress chaque mois, par niveau.', max: 3, cost: 2 },
  { id: 'reseau', icon: '📱', label: 'Carnet d’adresses', effect: '+1 appel sans fatigue par mois, par niveau.', max: 2, cost: 2 },
  { id: 'stratege', icon: '♟️', label: 'Stratège', effect: '+1 point d’action chaque mois, par niveau.', max: 2, cost: 5 },
  { id: 'charisme', icon: '✨', label: 'Charisme', effect: 'Votre popularité s’érode 25 % moins vite, par niveau.', max: 3, cost: 2 },
  { id: 'incorruptible', icon: '🛡️', label: 'Incorruptible', effect: '−1 d’exposition aux scandales chaque mois, par niveau.', max: 3, cost: 2 },
  { id: 'resilience', icon: '❤️', label: 'Résilience', effect: '+0,5 de santé chaque mois, par niveau.', max: 3, cost: 2 },
  { id: 'sang_froid', icon: '🧊', label: 'Sang-froid', effect: 'Les mini-jeux sont plus faciles (−7 % de difficulté par niveau).', max: 3, cost: 2 },
  { id: 'mobilisateur', icon: '📣', label: 'Mobilisateur·rice', effect: '+1 de dynamique de campagne chaque mois, par niveau.', max: 2, cost: 2 },
  { id: 'gestionnaire', icon: '💶', label: 'Bon gestionnaire', effect: '+5 points de rémunération mis de côté chaque mois, par niveau.', max: 3, cost: 2 },
];
export const TALENTS_BY_ID = new Map(TALENTS.map(t => [t.id, t]));

export function talent(d: GameState, id: TalentId): number {
  return d.player.talents?.[id] ?? 0;
}

/** Points dépensés par conversion */
export const CONVERSION_COST = 2;

/** Quand les dossiers sont au maximum : convertir des points */
export const CONVERSIONS = [
  { id: 'capital', label: '+10 capital politique', effects: [{ kind: 'stat', stat: 'politicalCapital', delta: 10 }] },
  { id: 'credibilite', label: '+3 crédibilité', effects: [{ kind: 'stat', stat: 'credibility', delta: 3 }] },
  { id: 'influence', label: '+3 influence', effects: [{ kind: 'stat', stat: 'influence', delta: 3 }] },
  { id: 'popularite', label: '+3 popularité', effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }] },
] as const;

import { Effect, GameState } from '../models/game.models';
import { canStartArc } from '../engine/arcs';
import { SCENARIO_QUESTIONS_MORE } from './scenario-questions-more';

/* ============================================================
 *  Les propositions qui déclenchent des scénarios : glissées
 *  dans les séries de questions à choix multiple (interviews,
 *  discussions de fond). « Soutiendriez-vous la candidature de
 *  Marseille aux Jeux ? » — et si vous dites oui, l'arc démarre.
 *  Chaque question propose 3 ou 4 réponses : au moins une lance
 *  un scénario (crise au long cours, saga, adhésion…), au moins
 *  une le refuse ; toutes ont un coût.
 * ============================================================ */

export type Asker = 'presse' | 'syndicat' | 'patronat' | 'association' | 'culte' | 'journaliste' | 'equipe' | 'parti' | 'personnalite' | 'gouvernement' | 'famille';

export interface ScenarioAnswer {
  id: string;
  label: string;
  hint?: string;
  effects: Effect[];
  /** Réponse de l'interlocuteur (vouvoiement) et sa version tutoyée */
  reply: string;
  replyTu?: string;
}

export interface ScenarioQuestion {
  id: string;
  /** Qui peut la poser */
  askers: Asker[];
  /** La question (vouvoiement) et sa version tutoyée */
  question: string;
  questionTu?: string;
  eligible: (d: GameState) => boolean;
  answers: ScenarioAnswer[];
}

/** Un arc « crise au long cours » peut-il démarrer ? (libre, jamais vu, et la limite des deux arcs) */
export function arcFree(d: GameState, arc: string): boolean {
  return canStartArc(d) && !d.crises?.[arc as keyof NonNullable<GameState['crises']>] && !d.player.flags[`sq_arc_${arc}`];
}
/** Une saga peut-elle démarrer ? */
export function sagaFree(d: GameState, id: string): boolean {
  return canStartArc(d) && !d.saga && !d.player.flags[`saga_${id}`];
}
export const rankAtLeast = (d: GameState, order: number): boolean => (RANK_ORDER[d.player.rankId] ?? 0) >= order;
const RANK_ORDER: Record<string, number> = { militant: 0, conseiller_municipal: 1, depute: 2, ministre: 3, premier_ministre: 3, chef_parti: 4, candidat_presidence: 5, president: 6, roi: 6, ancien_president: 6 };

export const SCENARIO_QUESTIONS: ScenarioQuestion[] = [...SCENARIO_QUESTIONS_MORE];
export const SCENARIO_QUESTION_BY_ID = new Map(SCENARIO_QUESTIONS.map(q => [q.id, q]));

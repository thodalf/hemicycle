import { Domain, Effect, GameState, RankId, StatKey } from '../models/game.models';

/* ============================================================
 *  Définition déclarative d'une scène interactive.
 *  Une scène = des jauges + une suite d'étapes (tirées dans un
 *  petit lot à chaque étape) + un score + des conséquences.
 * ============================================================ */

export type GaugeFormat = 'num' | 'pct' | 'signed' | 'md';

export interface SceneGaugeDef {
  id: string;
  label: string;
  min: number;
  max: number;
  start: number | ((d: GameState) => number);
  /** Sens favorable, pour les couleurs et l'aperçu des choix */
  good: 'high' | 'low';
  format?: GaugeFormat;
  /** Seuil critique : déclenché une fois, peut mettre fin à la scène */
  danger?: { below?: number; above?: number; label: string; text: string; delta?: Record<string, number>; end?: boolean };
}

export interface SceneRisk {
  chance: number;
  scaleWith?: StatKey | 'dossier';
  weight?: number;
  onFail: Record<string, number>;
  failText: string;
}

export interface SceneChoiceDef {
  id: string;
  label: string;
  hint?: string;
  requires?: { minMastery?: number; stat?: StatKey; minStat?: number };
  delta: Record<string, number>;
  /** Coût en euros, prélevé sur vos fonds */
  money?: number;
  risk?: SceneRisk;
  text: string;
  /** Force l'étape suivante (embranchement) */
  next?: string;
}

export interface SceneStepDef {
  id: string;
  title: string;
  context: string;
  choices: SceneChoiceDef[];
}

export interface SceneDef {
  id: string;
  title: string;
  eyebrow: string;
  intro: string;
  /** Couleur du bandeau (toujours sombre, texte clair) */
  band: string;
  minRank: RankId;
  /** Domaine des tests de dossier : fixe, ou le sujet à la une */
  domain: Domain | 'agenda';
  gauges: SceneGaugeDef[];
  /** Chaque entrée : lot d'étapes possibles pour ce moment de la scène */
  stages: string[][];
  steps: SceneStepDef[];
  /** Variables de texte tirées au lancement ({partenaire}, {crise}…) */
  setup?: (d: GameState, pick: <T>(items: readonly T[]) => T) => Record<string, string>;
  score: (g: Record<string, number>) => number;
  thresholds: { succes: number; mitige: number };
  outcomes: { succes: string; mitige: string; echec: string };
  rewards: (status: 'succes' | 'mitige' | 'echec', g: Record<string, number>, d: GameState, vars: Record<string, string>) => Effect[];
}

import type { MinigameKind } from './minigames';
import { RULES_A } from './minigame-rules-a';
import { RULES_B } from './minigame-rules-b';

/* ============================================================
 *  Les règles détaillées de chaque mini-jeu : le but, le
 *  déroulé pas à pas, le calcul du score et quelques astuces.
 *  Affichées avant la partie (« Comment jouer ») et pendant.
 * ============================================================ */

export interface GameRules {
  /** Le but, en une ou deux phrases */
  but: string;
  /** Le déroulé, étape par étape (3 à 6 puces) */
  deroule: string[];
  /** Comment le score sur 100 est calculé, et ce qui fait gagner ou perdre */
  score: string;
  /** Les commandes : souris/doigt, clavier */
  commandes?: string;
  /** Deux ou trois astuces */
  astuces?: string[];
  /** Précisions propres à une variante (clé : id du mini-jeu dans data/minigames.ts) */
  variantes?: Record<string, string>;
}

export const GAME_RULES: Partial<Record<MinigameKind, GameRules>> = { ...RULES_A, ...RULES_B };

export function rulesFor(kind: MinigameKind, id?: string): (GameRules & { variante?: string }) | null {
  const r = GAME_RULES[kind];
  if (!r) return null;
  return { ...r, variante: id ? r.variantes?.[id] : undefined };
}

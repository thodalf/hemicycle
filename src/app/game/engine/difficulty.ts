import type { Difficulty, GameState } from '../models/game.models';
import { clamp } from './rng';

/* ============================================================
 *  La difficulté : un seul réglage, choisi à la création de la
 *  partie, qui pèse sur tout le jeu — gains et pertes, risques,
 *  usure du pouvoir, argent, élections, menaces des crises et
 *  des sagas, mini-jeux. « Normal » est plus exigeant qu'avant.
 * ============================================================ */

export type { Difficulty };

export interface DifficultyMods {
  /** Multiplie les gains (popularité, influence, crédibilité, capital, baisse du stress, électorats) */
  gain: number;
  /** Multiplie les pertes */
  loss: number;
  /** S'ajoute à chaque probabilité d'échec */
  risk: number;
  /** Usure du pouvoir : érosion mensuelle des jauges hautes */
  erosion: number;
  /** Multiplie les rentrées d'argent */
  income: number;
  /** S'ajoute au score électoral du joueur */
  vote: number;
  /** Multiplie la progression des menaces (crises, sagas, front républicain) */
  threat: number;
  /** S'ajoute à la difficulté des mini-jeux */
  minigame: number;
  /** Multiplie l'énergie, l'argent et le capital politique dépensés par les actions */
  cost: number;
  /** Déplace les dés des actions : plus de ratés, moins de coups d'éclat */
  tier: number;
}

export const DIFFICULTIES: { id: Difficulty; label: string; icon: string; blurb: string }[] = [
  { id: 'decouverte', label: 'Découverte', icon: '🌱', blurb: 'Pour apprendre : des gains généreux, des risques réduits.' },
  { id: 'normal', label: 'Normal', icon: '⚖️', blurb: 'L’usure du pouvoir, des adversaires coriaces : chaque victoire se mérite.' },
  { id: 'difficile', label: 'Difficile', icon: '🔥', blurb: 'Des gains rares, des chutes brutales, des crises qui s’emballent.' },
  { id: 'impitoyable', label: 'Impitoyable', icon: '💀', blurb: 'La politique telle qu’elle est : presque personne n’arrive à l’Élysée.' },
];

const MODS: Record<Difficulty, DifficultyMods> = {
  decouverte: { gain: 1.1, loss: 0.85, risk: -0.03, erosion: 0, income: 1.15, vote: 1.5, threat: 0.85, minigame: -0.1, cost: 1, tier: -0.02 },
  normal: { gain: 0.93, loss: 1.08, risk: 0.03, erosion: 0.2, income: 0.94, vote: -1, threat: 1.12, minigame: 0.05, cost: 1.15, tier: 0.03 },
  difficile: { gain: 0.76, loss: 1.22, risk: 0.07, erosion: 0.6, income: 0.82, vote: -3, threat: 1.25, minigame: 0.12, cost: 1.3, tier: 0.06 },
  impitoyable: { gain: 0.64, loss: 1.38, risk: 0.12, erosion: 1, income: 0.7, vote: -5, threat: 1.45, minigame: 0.22, cost: 1.45, tier: 0.09 },
};

export function difficultyOfGame(d: Pick<GameState, 'difficulty'>): Difficulty {
  return d.difficulty && MODS[d.difficulty] ? d.difficulty : 'normal';
}

export function mods(d: Pick<GameState, 'difficulty'>): DifficultyMods {
  return MODS[difficultyOfGame(d)];
}

/** Un delta de jauge, corrigé par la difficulté (dans le bon sens : le stress est inversé) */
export function scaleStat(d: GameState, stat: string, delta: number): number {
  if (stat === 'energy' || !delta) return delta;
  const m = mods(d);
  const good = stat === 'stress' ? delta < 0 : delta > 0;
  const top = good && (stat === 'popularity' || stat === 'credibility' || stat === 'influence')
    ? topFactor(d, Number((d.player.stats as unknown as Record<string, number>)[stat] ?? 0)) : 1;
  return delta * (good ? m.gain : m.loss) * top;
}

/** L'usure du pouvoir : chaque mois, les jauges hautes s'érodent un peu */
export function monthlyDifficulty(d: GameState): void {
  const m = mods(d);
  if (!m.erosion || d.status !== 'en_cours') return;
  const s = d.player.stats;
  if (s.popularity > 25) s.popularity = clamp(s.popularity - m.erosion * (s.popularity / 50));
  if (s.credibility > 30) s.credibility = clamp(s.credibility - m.erosion * 0.6 * (s.credibility / 60));
  if (s.influence > 30) s.influence = clamp(s.influence - m.erosion * 0.5 * (s.influence / 60));
  // L'usure du sommet : au-delà de 70, l'opinion se lasse vite
  const wear = 0.5 + m.erosion;
  if (s.popularity > 70) s.popularity = clamp(s.popularity - (s.popularity - 70) * 0.1 * wear);
  if (s.credibility > 78) s.credibility = clamp(s.credibility - (s.credibility - 78) * 0.06 * wear);
  if (s.influence > 78) s.influence = clamp(s.influence - (s.influence - 78) * 0.06 * wear);
}

/** Le coût réel d'une action, selon la difficulté (les points d'action ne changent pas) */
export function costOf<C extends { ap: number; energy?: number; money?: number; politicalCapital?: number }>(d: Pick<GameState, 'difficulty'>, a: { cost: C }): C {
  const m = mods(d).cost;
  if (m === 1) return a.cost;
  return {
    ...a.cost,
    ...(a.cost.energy ? { energy: Math.round(a.cost.energy * m) } : {}),
    ...(a.cost.money ? { money: Math.round(a.cost.money * m / 50) * 50 } : {}),
    ...(a.cost.politicalCapital ? { politicalCapital: Math.round(a.cost.politicalCapital * m) } : {}),
  };
}

/** L'hubris (0 … 100) : nourrie par la domination, elle appelle les retours de bâton */
export function hubrisOf(d: Pick<GameState, 'player'>): number {
  return Math.max(0, Math.min(100, Number(d.player.flags['hubris'] ?? 0)));
}

/** Rendement décroissant au sommet : les derniers points de popularité sont les plus durs à gagner */
export function topFactor(d: Pick<GameState, 'difficulty'>, value: number): number {
  const start = difficultyOfGame(d) === 'decouverte' ? 72 : 60;
  if (value <= start) return 1;
  return Math.max(0.1, 1 - (value - start) / (100 - start + 6));
}

/** Saturation : la troisième action d'une même catégorie dans le mois porte moins, puis de moins en moins */
export const SATURATION = [1, 1, 0.8, 0.65, 0.5, 0.4];
export function saturation(rank: number): number { return SATURATION[Math.min(rank, SATURATION.length - 1)]; }

/** Maîtrise du dossier : une action sur un sujet mal connu porte moins, une action d'expert davantage */
export function masteryFactor(mastery: number): number {
  return Math.round((0.6 + Math.min(100, mastery) / 100 * 0.6) * 100) / 100;
}

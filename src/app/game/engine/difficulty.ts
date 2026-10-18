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
  decouverte: { gain: 1.05, loss: 0.9, risk: -0.02, erosion: 0.05, income: 1.1, vote: 1, threat: 0.9, minigame: -0.08, cost: 1.05, tier: -0.01 },
  normal: { gain: 0.87, loss: 1.14, risk: 0.05, erosion: 0.35, income: 0.88, vote: -2, threat: 1.2, minigame: 0.09, cost: 1.22, tier: 0.05 },
  difficile: { gain: 0.72, loss: 1.3, risk: 0.09, erosion: 0.8, income: 0.76, vote: -4, threat: 1.35, minigame: 0.16, cost: 1.38, tier: 0.08 },
  impitoyable: { gain: 0.6, loss: 1.48, risk: 0.14, erosion: 1.25, income: 0.64, vote: -6, threat: 1.55, minigame: 0.26, cost: 1.55, tier: 0.12 },
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

/* ── Le temps : les points d'action ─────────────────────────
 *  Une action ne prend pas toujours un seul point d'action :
 *  un déplacement, une émission, un dossier de fond prennent
 *  deux points ; un voyage à l'étranger ou un coup d'éclat, trois.
 *  Une action très payante coûte un point de plus. L'épuisement
 *  et la répétition d'une même action dans le mois en ajoutent.
 *  Le bon collaborateur fait gagner du temps sur son terrain.
 * ============================================================ */

/** Durée de base d'une action selon sa catégorie (en points d'action) */
export const CATEGORY_TIME: Partial<Record<string, number>> = {
  terrain: 2, medias: 2, dossiers: 2, fonction: 2, elysee: 2, territoire: 2, couronne: 2, loge: 2,
  administration: 2, arriere: 2, international: 3, eclat: 3,
};
const TIME_LABELS: Partial<Record<string, string>> = {
  terrain: 'Sur le terrain', territoire: 'Sur le terrain', medias: 'Passage dans les médias', dossiers: 'Travail de fond',
  fonction: 'Tâche de votre fonction', elysee: 'Charge présidentielle', administration: 'Charge administrative', couronne: 'Cérémonial',
  loge: 'Tenue de loge', arriere: 'À l’arrière', international: 'Voyage', eclat: 'Coup d’éclat',
};
/** Catégories où le temps ne bouge jamais : se reposer, se soigner, gérer son argent */
const FLAT_TIME = new Set(['repos', 'sante', 'argent']);
/** Les collaborateurs qui font gagner un point d'action sur leur terrain */
export const STAFF_TIME: { role: string; label: string; categories: string[] }[] = [
  { role: 'chauffeur', label: 'votre chauffeur', categories: ['terrain', 'territoire'] },
  { role: 'attache_presse', label: 'votre attachée de presse', categories: ['medias'] },
  { role: 'assistant_parlementaire', label: 'votre assistant parlementaire', categories: ['dossiers'] },
  { role: 'chef_cabinet', label: 'votre directrice de cabinet', categories: ['fonction', 'administration', 'elysee'] },
  { role: 'sherpa', label: 'votre conseiller diplomatique', categories: ['international'] },
];

interface Weighable { cost: { ap: number }; category?: string; effects?: { kind: string; [k: string]: unknown }[] }
const POWER = new WeakMap<object, number>();
/** La « puissance » d'une action : ce qu'elle rapporte au mieux (jauges, dossiers, électorats) */
export function actionPower(a: Weighable): number {
  const cached = POWER.get(a);
  if (cached !== undefined) return cached;
  let x = 0;
  const walk = (effs: Weighable['effects'], k = 1) => {
    for (const e of effs ?? []) {
      const delta = Number(e['delta'] ?? 0);
      if (e.kind === 'stat' && delta > 0 && ['popularity', 'credibility', 'influence'].includes(String(e['stat']))) x += delta * k;
      else if (e.kind === 'stat' && e['stat'] === 'politicalCapital' && delta > 0) x += delta * 0.5 * k;
      else if (e.kind === 'dossier' && delta > 0) x += delta * 0.5 * k;
      else if (e.kind === 'segment' && delta > 0) x += delta * (e['segment'] === '*' ? 2 : 0.7) * k;
      else if (e.kind === 'momentum' && delta > 0) x += delta * 0.3 * k;
      else if (e.kind === 'minigame') walk(e['reward'] as Weighable['effects'], k);
    }
  };
  walk(a.effects);
  POWER.set(a, x);
  return x;
}

/** Seuil de puissance au-delà duquel une action coûte un point de plus */
const POWER_STEP: Record<Difficulty, number> = { decouverte: 9, normal: 6.5, difficile: 5.5, impitoyable: 4.5 };

export interface ApBreakdown { ap: number; notes: string[] }

/** Le temps réel d'une action ce mois-ci, et pourquoi. `repeat` : combien de fois elle est déjà prévue ce mois-ci */
export function apBreakdown(d: GameState, a: Weighable, repeat = 0): ApBreakdown {
  const base = a.cost.ap;
  const notes: string[] = [];
  if (!base) return { ap: 0, notes };
  const cat = a.category ?? '';
  if (FLAT_TIME.has(cat) || base >= 4) return { ap: base, notes };
  let ap = base;
  const time = CATEGORY_TIME[cat] ?? 0;
  if (time > ap) { ap = time; notes.push(`${TIME_LABELS[cat] ?? 'Action longue'} : ${time} PA`); }
  const step = POWER_STEP[difficultyOfGame(d)];
  const power = actionPower(a);
  if (power >= step * 1.8) { ap += 2; notes.push('Action très payante : +2 PA'); }
  else if (power >= step) { ap += 1; notes.push('Action payante : +1 PA'); }
  const helper = STAFF_TIME.find(h => h.categories.includes(cat) && (d.player?.staff ?? []).includes(h.role as never));
  if (helper && ap > base) { ap -= 1; notes.push(`Grâce à ${helper.label} : −1 PA`); }
  if ((d.player?.stats.energy ?? 100) < 30) { ap += 1; notes.push('Épuisement : +1 PA'); }
  if (repeat > 0) { ap += repeat; notes.push(`Déjà prévue ce mois-ci : +${repeat} PA`); }
  return { ap: Math.min(ap, base + 4), notes };
}

/** Le coût réel d'une action, selon la difficulté et le temps qu'elle prend (voir apBreakdown) */
export function costOf<C extends { ap: number; energy?: number; money?: number; politicalCapital?: number }>(d: GameState, a: { cost: C; category?: string; effects?: Weighable['effects'] }, repeat = 0): C {
  const m = mods(d).cost;
  const ap = apBreakdown(d, a as Weighable, repeat).ap;
  return {
    ...a.cost,
    ap,
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

/** Saturation : dès la deuxième action d’une même catégorie dans le mois, l’effet s’émousse, puis de moins en moins */
export const SATURATION = [1, 0.85, 0.7, 0.55, 0.42, 0.32];
export function saturation(rank: number): number { return SATURATION[Math.min(rank, SATURATION.length - 1)]; }

/** Maîtrise du dossier : une action sur un sujet mal connu porte moins, une action d'expert davantage */
export function masteryFactor(mastery: number): number {
  return Math.round((0.6 + Math.min(100, mastery) / 100 * 0.6) * 100) / 100;
}

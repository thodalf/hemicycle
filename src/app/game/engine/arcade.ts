import { Effect, GameState } from '../models/game.models';
import { MINIGAMES_BY_ID } from '../data/minigames';
import { dailyPlayed, markDailyPlayed } from './daily';
import { difficultyOf } from './minigame';
import { nextId } from './rng';

/* ============================================================
 *  La salle de jeux : le mot du jour, Metrodoku, Capitalodoku et
 *  Villodoku se jouent à tout moment, hors agenda, sans coûter de
 *  point d'action. Chaque partie rapporte des avantages immédiats :
 *  une fois par jour réel pour le mot du jour, une fois par mois de
 *  jeu pour les grilles. Les parties suivantes se jouent pour le
 *  plaisir. Un résultat brillant rend un point d'action.
 * ============================================================ */

export type ArcadeId = 'sutom' | 'metro' | 'capitales' | 'villes';

export interface ArcadeGame {
  id: ArcadeId;
  gameId: string;
  icon: string;
  label: string;
  blurb: string;
  /** Ce que rapporte une partie réussie */
  gains: string;
  limit: 'jour' | 'mois';
  reward: Effect[];
}

export const ARCADE: ArcadeGame[] = [
  {
    id: 'sutom', gameId: 'mot_du_jour', icon: '🔤', label: 'Le mot du jour', limit: 'jour',
    blurb: 'Six essais pour trouver le mot du jour, le même pour tout le monde. Une seule partie par jour, nouveau mot à minuit.',
    gains: 'Popularité, énergie, moins de stress',
    reward: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'energy', delta: 6 }, { kind: 'stat', stat: 'stress', delta: -4 }],
  },
  {
    id: 'metro', gameId: 'metrodoku', icon: 'Ⓜ', label: 'Metrodoku', limit: 'mois',
    blurb: 'Neuf stations du métro parisien, des lignes décrites par leur tracé : la grille que tout Paris fait entre deux correspondances.',
    gains: 'Influence, jeunes et cadres',
    reward: [{ kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'segment', segment: 'jeunes', delta: 2 }, { kind: 'segment', segment: 'cadres', delta: 2 }, { kind: 'stat', stat: 'stress', delta: -2 }],
  },
  {
    id: 'capitales', gameId: 'capitalodoku', icon: '🌍', label: 'Capitalodoku', limit: 'mois',
    blurb: 'Les capitales du monde par continent, par géographie et par taille. Les diplomates notent tout.',
    gains: 'Crédibilité, dossier diplomatie, prestige',
    reward: [{ kind: 'stat', stat: 'credibility', delta: 2 }, { kind: 'dossier', domain: 'diplomatie', delta: 4 }, { kind: 'intl', prestige: 1 }],
  },
  {
    id: 'villes', gameId: 'departodoku', icon: '🇫🇷', label: 'Villodoku', limit: 'mois',
    blurb: 'Les villes de France par région, par taille et par géographie. Un élu qui connaît son pays, ça se remarque.',
    gains: 'Dossier territoires, crédibilité, ruraux',
    reward: [{ kind: 'dossier', domain: 'territoires', delta: 5 }, { kind: 'stat', stat: 'credibility', delta: 1 }, { kind: 'segment', segment: 'ruraux', delta: 2 }],
  },
];

export const ARCADE_BY_ID = new Map(ARCADE.map(a => [a.id, a]));

/** Les gains sont-ils encore à prendre ? */
export function arcadeRewardOpen(d: GameState, a: ArcadeGame): boolean {
  if (a.limit === 'jour') return !dailyPlayed();
  return Number(d.player.flags[`arcade_${a.id}`] ?? -1) !== d.week;
}

/** Peut-on lancer une partie ? */
export function arcadeAvailability(d: GameState, a: ArcadeGame): { ok: boolean; reason?: string } {
  if (d.status === 'mort') return { ok: false, reason: 'Partie terminée' };
  if ((d.minigames ?? []).length) return { ok: false, reason: 'Un autre jeu est en cours' };
  if (a.limit === 'jour' && dailyPlayed()) return { ok: false, reason: 'Déjà joué aujourd’hui : nouveau mot demain' };
  return { ok: true };
}

/** Lance une partie : les gains s'appliquent dès la fin de la grille */
export function startArcade(d: GameState, id: ArcadeId): boolean {
  const a = ARCADE_BY_ID.get(id);
  const def = a && MINIGAMES_BY_ID.get(a.gameId);
  if (!a || !def || !arcadeAvailability(d, a).ok) return false;
  const paid = arcadeRewardOpen(d, a);
  if (paid && a.limit === 'mois') d.player.flags[`arcade_${a.id}`] = d.week;
  d.minigames ??= [];
  d.minigames.push({
    id: nextId(d, 'jeu'), gameId: a.gameId, title: def.title, origin: paid ? 'Salle de jeux' : 'Salle de jeux · pour le plaisir',
    reward: paid ? a.reward : [], penalty: [], difficulty: Math.min(1, difficultyOf(d)), status: 'pret', arcade: a.id, paid,
  });
  return true;
}

/** Abandonner une partie de la salle de jeux */
export function quitArcade(d: GameState, id: string): void {
  const g = d.minigames?.find(x => x.id === id);
  // Le mot du jour est consommé dès qu'on l'a vu
  if (g?.gameId === 'mot_du_jour' && g.status === 'pret') markDailyPlayed();
  d.minigames = (d.minigames ?? []).filter(x => x.id !== id);
}

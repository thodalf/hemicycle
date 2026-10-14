import { Effect, EffectContext, GameState, MinigameState, MinigameTier } from '../models/game.models';
import { MINIGAMES_BY_ID } from '../data/minigames';
import { applyEffects, pushNews, scaleGains } from './effects';
import { Rng, clamp, nextId } from './rng';
import { examOutcome } from './civil';

/* ============================================================
 *  Mini-jeux : une action ou un événement peut en déclencher un.
 *  Le score (0 à 1) fixe le palier — brillant, réussi, mitigé,
 *  raté — et donc l'ampleur des gains. On peut aussi laisser
 *  faire l'équipe : résultat moyen garanti.
 * ============================================================ */

export const TIER_LABELS: Record<MinigameTier, string> = {
  brillant: 'Brillant !', reussi: 'Réussi', mitige: 'Mitigé', rate: 'Raté',
};

/** Score obtenu en laissant faire l'équipe */
export const DELEGATE_SCORE = 0.45;

export function tierOf(score: number): MinigameTier {
  return score >= 0.8 ? 'brillant' : score >= 0.5 ? 'reussi' : score >= 0.25 ? 'mitige' : 'rate';
}

/** Fatigue et stress rendent l'exercice plus difficile */
export function difficultyOf(d: GameState): number {
  const s = d.player.stats;
  const calm = 1 - 0.07 * (d.player.talents?.['sang_froid'] ?? 0);
  return Math.round(clamp((1 + (s.stress - 40) / 150 - (s.energy - 50) / 250) * calm * 100, 55, 140)) / 100;
}

/** Amplifie la part « gain » d'une liste d'effets (palier brillant) */
export function boostGains(effects: Effect[], f: number): Effect[] {
  const r = (v: number) => Math.round(v * f * 10) / 10;
  return effects.map(e => {
    switch (e.kind) {
      case 'stat': return (e.stat === 'stress' ? e.delta < 0 : e.delta > 0) ? { ...e, delta: r(e.delta) } : e;
      case 'momentum': case 'dossier': case 'faction': case 'cohesion': case 'npcRelation': case 'segment':
        return e.delta > 0 ? { ...e, delta: r(e.delta) } : e;
      case 'funds': return e.delta > 0 ? { ...e, delta: Math.round(e.delta * f) } : e;
      case 'income': return { ...e, base: Math.round(e.base * f) };
      case 'contact': return (e.trust ?? 0) > 0 ? { ...e, trust: r(e.trust!) } : e;
      case 'war': return { ...e, front: e.front && e.front > 0 ? r(e.front) : e.front, support: e.support && e.support > 0 ? r(e.support) : e.support };
      case 'presidency': return { ...e, approval: e.approval && e.approval > 0 ? r(e.approval) : e.approval };
      case 'parrainages': return e.delta > 0 ? { ...e, delta: Math.round(e.delta * f) } : e;
      default: return e;
    }
  });
}

const DEFAULT_PENALTY: Effect[] = [{ kind: 'stat', stat: 'stress', delta: 4 }, { kind: 'stat', stat: 'popularity', delta: -1 }];

/** Ajoute un mini-jeu à la file (il se joue avant de clore le mois) */
export function queueMinigame(d: GameState, gameId: string, origin: string, reward: Effect[], ctx: EffectContext, penalty?: Effect[], title?: string): string[] {
  const def = MINIGAMES_BY_ID.get(gameId);
  if (!def) {
    // Mini-jeu inconnu : on applique simplement les effets
    return [];
  }
  d.minigames ??= [];
  if (d.minigames.filter(x => x.status === 'pret').length >= 8) return [];
  const g: MinigameState = {
    id: nextId(d, 'jeu'), gameId, title: title ?? def.title, origin, reward, penalty: penalty ?? DEFAULT_PENALTY,
    ...(ctx.domain ? { domain: ctx.domain } : {}), ...(ctx.targetId ? { targetId: ctx.targetId } : {}),
    difficulty: difficultyOf(d), status: 'pret',
  };
  d.minigames.push(g);
  return [`Mini-jeu : ${g.title}`];
}

/** Applique le résultat d'un mini-jeu */
export function resolveMinigame(d: GameState, id: string, rawScore: number, rng: Rng): string[] {
  const g = d.minigames?.find(x => x.id === id);
  if (!g || g.status !== 'pret') return [];
  const score = clamp(rawScore * 100, 0, 100) / 100;
  const tier = tierOf(score);
  const ctx: EffectContext = { domain: g.domain, targetId: g.targetId };
  let effects: Effect[];
  // Concours : il faut au moins « réussi » pour être reçu·e ; le classement décide du corps
  const exam = g.reward.some(e => e.kind === 'civil' && e.join);
  const passed = tier === 'brillant' || tier === 'reussi';
  let reward = exam ? examOutcome(g.reward, passed, tier === 'brillant') : g.reward;
  // Négociation de coalition : ratée, pas d'accord ; mitigée, un partenaire déjà méfiant
  if (g.reward.some(e => e.kind === 'coalition')) {
    reward = tier === 'rate' ? reward.filter(e => e.kind !== 'coalition')
      : reward.map(e => e.kind === 'coalition' ? { ...e, mood: tier === 'brillant' ? 15 : tier === 'mitige' ? -20 : 0 } : e);
  }
  if (exam && !passed) pushNews(d, 'systeme', 'negative', 'Recalé·e au concours', 'Votre nom n’apparaît pas sur la liste des admis. Vous pourrez retenter votre chance l’an prochain.');
  switch (tier) {
    case 'brillant': effects = [...boostGains(reward, 1.5), { kind: 'stat', stat: 'stress', delta: -2 }]; break;
    case 'reussi': effects = reward; break;
    case 'mitige': effects = scaleGains(reward, 0.5); break;
    default: effects = g.arcade ? [] : [...scaleGains(reward, 0.15), ...g.penalty];
  }
  const summary = applyEffects(d, effects, ctx, rng);
  // Les déplacements forgent le caractère : globe-trotteur, toujours à l'heure
  const kind = MINIGAMES_BY_ID.get(g.gameId)?.kind;
  if (kind === 'train' || kind === 'cortege' || kind === 'valise') {
    d.player.flags['deplacements'] = Number(d.player.flags['deplacements'] ?? 0) + 1;
    if (tier === 'brillant') d.player.flags['perfectTrips'] = Number(d.player.flags['perfectTrips'] ?? 0) + 1;
  }
  // Salle de jeux : une partie brillante rend un point d'action
  if (g.arcade && g.paid && tier === 'brillant') {
    d.player.actionPoints.current += 1;
    summary.push('+1 point d’action');
  }
  if (g.arcade && !g.paid) summary.push('Pour le plaisir : gains déjà pris');
  g.status = 'fini';
  g.score = Math.round(score * 100) / 100;
  g.tier = tier;
  g.summary = summary;
  if (!g.arcade || g.paid) pushNews(d, 'action', tier === 'rate' ? 'negative' : tier === 'mitige' ? 'neutral' : 'positive',
    `${g.title} : ${TIER_LABELS[tier].replace(' !', '').toLowerCase()}`, summary.join(' · '));
  d.player.flags['minigamesPlayed'] = Number(d.player.flags['minigamesPlayed'] ?? 0) + 1;
  if (tier === 'brillant') d.player.flags['minigamesBrilliant'] = Number(d.player.flags['minigamesBrilliant'] ?? 0) + 1;
  return summary;
}

/** Ferme l'écran de résultat */
export function closeMinigame(d: GameState, id: string): void {
  d.minigames = (d.minigames ?? []).filter(x => !(x.id === id && x.status === 'fini'));
}

/** En votre absence (projet au long cours) : l'équipe s'en charge */
export function autoMinigames(d: GameState, rng: Rng): void {
  for (const g of [...(d.minigames ?? [])]) {
    if (g.status === 'pret') resolveMinigame(d, g.id, DELEGATE_SCORE, rng);
    closeMinigame(d, g.id);
  }
}

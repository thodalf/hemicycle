import { Injectable, computed, inject } from '@angular/core';
import { MINIGAMES_BY_ID } from '../data/minigames';
import { DELEGATE_SCORE, closeMinigame, resolveMinigame } from '../engine/minigame';
import { ArcadeId, startArcade, quitArcade } from '../engine/arcade';
import { loadResult, resultScore } from '../engine/arcade-save';
import { GameStateService } from './game-state.service';

/** Façade des mini-jeux : le premier de la file, son résultat, sa fermeture */
@Injectable({ providedIn: 'root' })
export class MinigameService {
  private readonly game = inject(GameStateService);

  readonly current = computed(() => (this.game.s().minigames ?? [])[0] ?? null);
  readonly def = computed(() => {
    const g = this.current();
    return g ? MINIGAMES_BY_ID.get(g.gameId) ?? null : null;
  });
  readonly queued = computed(() => (this.game.s().minigames ?? []).length);

  finish(score: number): void {
    const g = this.current();
    if (!g) return;
    this.game.mutate((d, rng) => { resolveMinigame(d, g.id, score, rng); });
  }

  delegate(): void {
    this.finish(DELEGATE_SCORE);
  }

  /** Salle de jeux : lancer une partie hors agenda */
  play(id: ArcadeId): void {
    this.game.mutate(d => { startArcade(d, id); });
  }

  /** Salle de jeux : renoncer sans gain */
  quit(): void {
    const g = this.current();
    if (!g) return;
    // Partie déjà terminée : on encaisse le résultat au lieu de l'abandonner
    const r = g.arcade && g.status === 'pret' ? loadResult(g.arcade) : null;
    if (r) { this.finish(resultScore(r)); return; }
    this.game.mutate(d => quitArcade(d, g.id));
  }

  close(): void {
    const g = this.current();
    if (g) this.game.mutate(d => closeMinigame(d, g.id));
  }
}

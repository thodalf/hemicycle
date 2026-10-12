import { Injectable, computed, inject } from '@angular/core';
import { Ballot } from '../models/game.models';
import { assemblyGroups, castVote, closeVote, forecast, playMove, voteMoves } from '../engine/assembly';
import { GameStateService } from './game-state.service';

/** Façade des scrutins publics à l'Assemblée */
@Injectable({ providedIn: 'root' })
export class AssemblyService {
  private readonly game = inject(GameStateService);

  readonly vote = computed(() => this.game.s().vote);
  readonly groups = computed(() => assemblyGroups(this.game.s()));
  readonly moves = computed(() => {
    const v = this.vote();
    return v && v.status === 'debat' ? voteMoves(this.game.s(), v) : [];
  });
  readonly forecast = computed(() => {
    const v = this.vote();
    return v ? forecast(this.game.s(), v) : null;
  });

  /** Chance d'adoption si le joueur vote (ou fixe la consigne) ainsi */
  chanceWith(ballot: Ballot): number {
    const v = this.vote();
    return v ? forecast(this.game.s(), v, ballot).adoptedChance : 0;
  }

  play(moveId: string, direction: 1 | -1 = 1): string[] {
    let out: string[] = [];
    this.game.mutate((d, rng) => { out = playMove(d, moveId, rng, direction); });
    return out;
  }

  cast(ballot: Ballot): string[] {
    let out: string[] = [];
    this.game.mutate((d, rng) => { out = castVote(d, ballot, rng); });
    return out;
  }

  close(): void {
    this.game.mutate(d => closeVote(d));
  }
}

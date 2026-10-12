import { Injectable, computed, inject } from '@angular/core';
import { ProgramOption } from '../models/game.models';
import { programPending, programReport, validateProgram } from '../engine/programme';
import { GameStateService } from './game-state.service';

/** Construction du programme présidentiel */
@Injectable({ providedIn: 'root' })
export class ProgramService {
  private readonly game = inject(GameStateService);

  readonly pending = computed(() => {
    const s = this.game.state();
    return !!s && programPending(s);
  });
  readonly answers = computed(() => this.game.state()?.program?.answers ?? {});
  readonly report = computed(() => programReport(this.game.s()));

  answer(questionId: string, optionId: ProgramOption['id']): void {
    this.game.mutate(d => {
      if (d.program && !d.program.validated) d.program.answers[questionId] = optionId;
    });
  }

  validate(): void {
    this.game.mutate((d, rng) => validateProgram(d, rng));
  }
}

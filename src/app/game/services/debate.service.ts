import { Injectable, computed, inject } from '@angular/core';
import { DebateCard, GameState } from '../models/game.models';
import { breathe, currentTopic, debateRewards, effectivePower, playCard } from '../engine/debate';
import { applyEffects, pushNews } from '../engine/effects';
import { recordObjectiveEvent, refreshObjectives } from '../engine/objectives';
import { Rng } from '../engine/rng';
import { GameStateService } from './game-state.service';

/** Pilote le débat en cours : jouer une carte, souffler, quitter le plateau */
@Injectable({ providedIn: 'root' })
export class DebateService {
  private readonly game = inject(GameStateService);

  readonly debate = computed(() => this.game.state()?.debate ?? null);
  readonly topic = computed(() => {
    const d = this.debate();
    return d ? currentTopic(d) : null;
  });

  power(card: DebateCard) {
    const d = this.debate();
    return d ? effectivePower(d, card) : { power: card.power };
  }

  play(cardId: string): void {
    this.game.mutate((d, rng) => {
      if (!d.debate) return;
      playCard(d.debate, d, rng, cardId);
      this.settle(d, rng);
    });
  }

  breathe(): void {
    this.game.mutate((d, rng) => {
      if (!d.debate) return;
      breathe(d.debate, d, rng);
      this.settle(d, rng);
    });
  }

  /** Ferme l'écran de débat une fois le résultat lu */
  leave(): void {
    this.game.mutate(d => {
      if (d.debate && d.debate.status !== 'en_cours') d.debate = null;
    });
  }

  private settle(d: GameState, rng: Rng): void {
    const debate = d.debate!;
    if (debate.status === 'en_cours') return;
    debate.rewardSummary = applyEffects(d, debateRewards(debate), {}, rng);
    const verdict = { gagne: 'remporté', perdu: 'perdu', nul: 'match nul' }[debate.status];
    const tone = debate.status === 'gagne' ? 'positive' : debate.status === 'perdu' ? 'negative' : 'neutral';
    pushNews(d, 'decision', tone, `${debate.title} face à ${debate.opponentName} : ${verdict}${debate.ko ? ' par K.-O.' : ''}`,
      debate.rewardSummary.join(' · '));
    if (debate.status === 'gagne') recordObjectiveEvent(d, 'debate_win');
    if (debate.status === 'gagne' && (debate.ko || debate.stakes === 'debat_electoral')) {
      debate.rewardSummary.push(...applyEffects(d, [{ kind: 'booster', count: 1, reason: 'Une victoire éclatante attire les talents.' }], {}, rng));
    }
    refreshObjectives(d, rng);
  }
}

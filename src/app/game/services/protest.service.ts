import { Injectable, computed, inject } from '@angular/core';
import { GameState, ProtestScale } from '../models/game.models';
import { applyEffects, pushNews } from '../engine/effects';
import { recordObjectiveEvent, refreshObjectives } from '../engine/objectives';
import { chooseProtest, launchProtest, protestRewards } from '../engine/protest';
import { Rng } from '../engine/rng';
import { GameStateService } from './game-state.service';

/** Pilote la manifestation en cours */
@Injectable({ providedIn: 'root' })
export class ProtestService {
  private readonly game = inject(GameStateService);
  readonly protest = computed(() => this.game.state()?.protest ?? null);

  setCause(id: string): void {
    this.game.mutate(d => {
      const p = d.protest;
      if (p?.phase === 'preparation') p.cause = p.causeOptions.find(c => c.id === id) ?? null;
    });
  }

  setScale(scale: ProtestScale): void {
    this.game.mutate(d => { if (d.protest?.phase === 'preparation') d.protest.scale = scale; });
  }

  toggleAlly(id: string): void {
    this.game.mutate(d => {
      const p = d.protest;
      if (p?.phase !== 'preparation') return;
      if (p.allies.includes(id)) p.allies = p.allies.filter(a => a !== id);
      else if (p.allies.length < 2) p.allies.push(id);
    });
  }

  launch(): void {
    this.game.mutate((d, rng) => { if (d.protest) launchProtest(d.protest, d, rng); });
  }

  choose(choiceId: string): void {
    this.game.mutate((d, rng) => {
      if (!d.protest) return;
      chooseProtest(d.protest, d, rng, choiceId);
      this.settle(d, rng);
    });
  }

  leave(): void {
    this.game.mutate(d => { if (d.protest && d.protest.status !== 'en_cours') d.protest = null; });
  }

  /** Renonce à la manifestation pendant la préparation */
  cancel(): void {
    this.game.mutate(d => {
      if (d.protest?.phase === 'preparation') {
        d.protest = null;
        pushNews(d, 'actu', 'neutral', 'Manifestation annulée');
      }
    });
  }

  private settle(d: GameState, rng: Rng): void {
    const p = d.protest!;
    if (p.status === 'en_cours') return;
    p.rewardSummary = applyEffects(d, protestRewards(p, d), {}, rng);
    const verdict = { succes: 'succès', mitige: 'bilan mitigé', echec: 'échec' }[p.status];
    pushNews(d, 'actu', p.status === 'succes' ? 'positive' : p.status === 'echec' ? 'negative' : 'neutral',
      `Manifestation « ${p.cause!.label} » : ${verdict}`,
      `${p.organizers.toLocaleString('fr-FR')} selon les organisateurs, ${p.police.toLocaleString('fr-FR')} selon la police.${p.overflow ? ' Débordements en marge du cortège.' : ''}`);
    if (p.status === 'succes') recordObjectiveEvent(d, 'category', 'terrain');
    if (p.status === 'succes' && rng.chance(0.3)) {
      p.rewardSummary.push(...applyEffects(d, [{ kind: 'booster', count: 1, reason: 'Des militants de talent veulent travailler avec vous.' }], {}, rng));
    }
    refreshObjectives(d, rng);
  }
}

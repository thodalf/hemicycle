import { Injectable, computed, inject } from '@angular/core';
import { GameState } from '../models/game.models';
import { applyEffects, pushNews } from '../engine/effects';
import { refreshObjectives } from '../engine/objectives';
import { Rng } from '../engine/rng';
import { chooseScene, fill, sceneDef, sceneStep } from '../engine/scene';
import { GameStateService } from './game-state.service';

/** Pilote la scène interactive en cours (marché, meeting, médiation…) */
@Injectable({ providedIn: 'root' })
export class SceneService {
  private readonly game = inject(GameStateService);

  readonly scene = computed(() => this.game.state()?.scene ?? null);
  readonly def = computed(() => sceneDef(this.scene()));
  readonly step = computed(() => {
    const s = this.scene();
    return s ? sceneStep(s) : null;
  });

  text(t: string): string {
    const s = this.scene();
    return s ? fill(t, s) : t;
  }

  choose(choiceId: string): void {
    this.game.mutate((d, rng) => {
      if (!d.scene) return;
      chooseScene(d.scene, d, rng, choiceId);
      this.settle(d, rng);
    });
  }

  leave(): void {
    this.game.mutate(d => { if (d.scene && d.scene.status !== 'en_cours') d.scene = null; });
  }

  private settle(d: GameState, rng: Rng): void {
    const s = d.scene!;
    const def = sceneDef(s);
    if (!def || s.status === 'en_cours') return;
    s.rewardSummary = applyEffects(d, def.rewards(s.status, s.gauges, d, s.vars), { domain: s.domain }, rng);
    const verdict = { succes: 'réussite', mitige: 'bilan mitigé', echec: 'échec' }[s.status];
    pushNews(d, 'actu', s.status === 'succes' ? 'positive' : s.status === 'echec' ? 'negative' : 'neutral',
      `${fill(def.title, s)} : ${verdict}`, fill(def.outcomes[s.status], s));
    if (s.status === 'succes' && rng.chance(0.25)) {
      s.rewardSummary.push(...applyEffects(d, [{ kind: 'booster', count: 1, reason: 'Votre réussite fait parler d’elle : des profils frappent à votre porte.' }], {}, rng));
    }
    refreshObjectives(d, rng);
  }
}

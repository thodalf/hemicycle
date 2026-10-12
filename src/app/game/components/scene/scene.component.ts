import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { SceneChoiceDef, SceneGaugeDef } from '../../data/scene-types';
import { choiceAvailable, failChance, previewDelta, unavailableReason } from '../../engine/scene';
import { GameStateService } from '../../services/game-state.service';
import { SceneService } from '../../services/scene.service';

/**
 * Écran générique des scènes interactives : bandeau, jauges, étape en cours,
 * choix avec aperçu des effets et risque, puis bilan.
 */
@Component({
  selector: 'app-scene',
  imports: [DecimalPipe],
  templateUrl: './scene.component.html',
  styleUrl: './scene.component.scss',
})
export class SceneComponent {
  protected readonly game = inject(GameStateService);
  protected readonly svc = inject(SceneService);

  protected readonly s = computed(() => this.svc.scene()!);
  protected readonly def = computed(() => this.svc.def()!);
  protected readonly stagesCount = computed(() => this.def().stages.length);
  protected readonly pips = computed(() => Array.from({ length: this.stagesCount() }, (_, i) => i));
  protected readonly log = computed(() => [...this.s().log].reverse());
  protected readonly outcome = computed(() => {
    const st = this.s().status;
    return st === 'en_cours' ? '' : this.svc.text(this.def().outcomes[st]);
  });

  protected value(g: SceneGaugeDef) { return this.s().gauges[g.id]; }

  protected width(g: SceneGaugeDef) {
    return ((this.value(g) - g.min) / (g.max - g.min)) * 100;
  }

  protected display(g: SceneGaugeDef): string {
    const v = Math.round(this.value(g));
    switch (g.format) {
      case 'pct': return `${v} %`;
      case 'signed': return v > 0 ? `+${v}` : `${v}`;
      case 'md': return `${v} Md€`;
      default: return `${v}`;
    }
  }

  /** Rouge si la jauge est en mauvaise posture */
  protected tone(g: SceneGaugeDef): 'good' | 'bad' | '' {
    const ratio = this.width(g) / 100;
    const goodness = g.good === 'high' ? ratio : 1 - ratio;
    return goodness >= 0.6 ? 'good' : goodness <= 0.25 ? 'bad' : '';
  }

  protected dangerAt(g: SceneGaugeDef): number | null {
    const v = g.danger?.below ?? g.danger?.above;
    return v === undefined ? null : ((v - g.min) / (g.max - g.min)) * 100;
  }

  protected available(c: SceneChoiceDef) { return choiceAvailable(this.s(), this.game.s(), c); }
  protected reason(c: SceneChoiceDef) { return unavailableReason(this.s(), this.game.s(), c); }
  protected success(c: SceneChoiceDef) {
    const f = failChance(this.s(), this.game.s(), c);
    return f === null ? null : Math.round((1 - f) * 100);
  }
  protected preview(c: SceneChoiceDef) { return previewDelta(this.def(), c.delta); }
  protected signed(n: number) { return n > 0 ? `+${n}` : `${n}`; }
}

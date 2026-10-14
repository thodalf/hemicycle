import { Component, computed, inject } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { MinigameService } from '../../services/minigame.service';
import { ARCADE, ArcadeId, arcadeAvailability, arcadeRewardOpen } from '../../engine/arcade';
import { describeEffect } from '../../engine/describe';

/** La salle de jeux : mot du jour et grilles, à tout moment, hors agenda */
@Component({
  selector: 'app-arcade-panel',
  template: `
    <section class="card arcade" aria-label="Salle de jeux">
      <div class="card-title"><span>🎲 Salle de jeux</span><span class="chip">Hors agenda · gratuit</span></div>
      <p class="muted lead">À jouer quand vous voulez, sans point d’action. Gains immédiats ; une partie brillante rend un point d’action.</p>
      <ul class="games">
        @for (r of rows(); track r.a.id) {
          <li [class.spent]="!r.open">
            <span class="ico" aria-hidden="true">{{ r.a.icon }}</span>
            <div class="txt">
              <strong>{{ r.a.label }}</strong>
              <small class="muted">{{ r.a.blurb }}</small>
              <small class="gain">@if (r.open) { 🎁 {{ r.gains }} } @else { {{ r.a.limit === 'jour' ? 'Gains pris aujourd’hui' : 'Gains pris ce mois-ci : partie pour le plaisir' }} }</small>
            </div>
            <button type="button" class="btn small" [class.primary]="r.open" [disabled]="!r.ok" [title]="r.reason ?? ''" (click)="play(r.a.id)">
              {{ !r.ok && r.a.limit === 'jour' ? 'Demain' : r.open ? 'Jouer' : 'Rejouer' }}
            </button>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    .arcade { display: grid; gap: 8px; }
    .lead { margin: 0; font-size: 12.5px; }
    .games { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .games li { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 10px;
      border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
    .games li.spent { background: var(--surface-2); }
    .ico { font-size: 22px; text-align: center; }
    .txt { display: grid; gap: 2px; min-width: 0; strong { font-size: 14px; } small { font-size: 11.5px; line-height: 1.3; } }
    .gain { color: var(--good); font-weight: 600; }
    .spent .gain { color: var(--ink-3); font-weight: 500; }
    .btn { min-width: 72px; }
  `,
})
export class ArcadePanelComponent {
  protected readonly game = inject(GameStateService);
  private readonly mini = inject(MinigameService);

  protected readonly rows = computed(() => {
    const s = this.game.s();
    return ARCADE.map(a => {
      const av = arcadeAvailability(s, a);
      return { a, ok: av.ok, reason: av.reason, open: arcadeRewardOpen(s, a), gains: a.reward.flatMap(describeEffect).map(c => c.text).join(' · ') || a.gains };
    });
  });

  protected play(id: ArcadeId): void {
    this.mini.play(id);
  }
}

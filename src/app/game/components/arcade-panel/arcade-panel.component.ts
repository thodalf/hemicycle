import { Component, computed, inject, signal } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { MinigameService } from '../../services/minigame.service';
import { ARCADE, ArcadeId, arcadeAvailability, arcadeRewardOpen } from '../../engine/arcade';
import { describeEffect } from '../../engine/describe';
import { ArcadeResult, loadResult, saveProgress } from '../../engine/arcade-save';
import { ArcadeResultComponent } from './arcade-result.component';

/** La salle de jeux : mot du jour et grilles, à tout moment, hors agenda */
@Component({
  selector: 'app-arcade-panel',
  imports: [ArcadeResultComponent],
  template: `
    <section class="card arcade" aria-label="Salle de jeux">
      <div class="card-title"><span>🎲 Salle de jeux</span><span class="chip">Hors agenda · gratuit</span></div>
      <p class="muted lead">À jouer quand vous voulez, sans point d’action. Gains immédiats ; une partie brillante rend un point d’action. Une partie par jour et par jeu, la même pour tout le monde ; trois erreurs permises dans les grilles. Quittez en cours de route : vos réponses sont gardées jusqu’à minuit. Ensuite : résultats, toutes les réponses, et de quoi les partager.</p>
      <ul class="games">
        @for (r of rows(); track r.a.id) {
          <li [class.spent]="!r.open">
            <span class="ico" aria-hidden="true">{{ r.a.icon }}</span>
            <div class="txt">
              <strong>{{ r.a.label }}</strong>
              <small class="muted">{{ r.a.blurb }}</small>
              @if (r.save) { <small class="resume">⏸ Partie en cours · {{ r.save }} · gardée jusqu’à minuit</small> }
              <small class="gain">@if (r.open) { 🎁 {{ r.gains }} } @else { Partie du jour jouée · {{ r.a.id === 'sutom' ? 'nouveau mot' : 'nouvelle grille' }} demain }</small>
            </div>
            @if (r.result) {
              <button type="button" class="btn small" (click)="shown.set(r.result)">Résultats</button>
            } @else {
              <button type="button" class="btn small" [class.primary]="r.ok" [disabled]="!r.ok" [title]="r.reason ?? ''" (click)="play(r.a.id)">
                {{ !r.ok ? 'Demain' : r.save ? 'Reprendre' : 'Jouer' }}
              </button>
            }
          </li>
        }
      </ul>
    </section>
    @if (shown(); as res) {
      <div class="overlay" role="dialog" aria-modal="true" aria-label="Résultats de la partie du jour" (click)="shown.set(null)">
        <div class="card sheet" (click)="$event.stopPropagation()">
          <div class="card-title"><span>{{ res.icon }} {{ res.title }} · résultats du jour</span><button type="button" class="btn small" (click)="shown.set(null)" aria-label="Fermer">✕</button></div>
          <app-arcade-result [result]="res" />
        </div>
      </div>
    }
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
    .resume { color: var(--accent); font-weight: 600; }
    .spent .gain { color: var(--ink-3); font-weight: 500; }
    .btn { min-width: 72px; }
    .overlay { position: fixed; inset: 0; z-index: 20; background: rgba(10, 12, 18, .55); display: grid; place-items: center; padding: 12px; }
    .sheet { width: min(560px, 100%); max-height: calc(100dvh - 24px); overflow: auto; .card-title { align-items: center; } .btn { min-width: 0; } }
  `,
})
export class ArcadePanelComponent {
  protected readonly game = inject(GameStateService);
  private readonly mini = inject(MinigameService);
  protected readonly shown = signal<ArcadeResult | null>(null);

  protected readonly rows = computed(() => {
    const s = this.game.s();
    return ARCADE.map(a => {
      const av = arcadeAvailability(s, a);
      return { a, ok: av.ok, reason: av.reason, open: arcadeRewardOpen(s, a), save: av.ok ? saveProgress(a.id) : null, result: loadResult(a.id), gains: a.reward.flatMap(describeEffect).map(c => c.text).join(' · ') || a.gains };
    });
  });

  protected play(id: ArcadeId): void {
    this.mini.play(id);
  }
}

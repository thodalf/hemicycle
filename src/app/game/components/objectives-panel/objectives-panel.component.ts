import { Component, inject, input } from '@angular/core';
import { Objective } from '../../models/game.models';
import { GameStateService } from '../../services/game-state.service';

/** Trois objectifs à court terme, avec échéance et récompense */
@Component({
  selector: 'app-objectives-panel',
  template: `
    <section [class.card]="!embedded()">
      @if (!embedded()) { <div class="card-title"><span>Objectifs</span><small class="muted">récompensés dès qu’ils sont atteints</small></div> }
      <ul class="objectives">
        @for (o of game.s().objectives; track o.id) {
          @let left = o.deadlineWeek - game.week();
          <li>
            <div class="top">
              <strong>{{ o.label }}</strong>
              <span class="chip" [class.bad]="left <= 1" [class.warn]="left === 2">
                {{ left <= 0 ? 'Dernier mois' : left + ' mois' }}
              </span>
            </div>
            <div class="bar"><span [style.width.%]="ratio(o)"></span></div>
            <div class="bottom">
              <span class="mono">{{ o.progress }} / {{ o.target }}</span>
              <span class="reward">{{ o.rewardLabel }}</span>
            </div>
          </li>
        } @empty {
          <li class="muted">De nouveaux objectifs arrivent le mois prochain.</li>
        }
      </ul>
    </section>
  `,
  styles: `
    .objectives { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
    li { display: grid; gap: 6px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-2); }
    .top { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; strong { font-size: 13px; font-weight: 600; line-height: 1.3; } }
    .bottom { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 11.5px; .mono { white-space: nowrap; } }
    .reward { color: var(--good); text-align: right; }
    .card-title small { font-family: var(--font-body); font-size: 12px; }
  `,
})
export class ObjectivesPanelComponent {
  protected readonly game = inject(GameStateService);
  /** Dans l'agenda, sans carte autour */
  readonly embedded = input(false);
  protected ratio(o: Objective) {
    return Math.max(0, Math.min(100, (100 * o.progress) / o.target));
  }
}

import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { SAGA_BY_ID } from '../../data/saga-defs';

/** Une grande saga : phase en cours, trois jauges, ce qu'il faut viser */
@Component({
  selector: 'app-saga-panel',
  imports: [DecimalPipe],
  template: `
    @if (view(); as v) {
      <section class="card spanel" role="region" [attr.aria-label]="v.def.label" [style.--saga]="v.def.color">
        <div class="card-title">
          <span class="t"><span class="ic" aria-hidden="true">{{ v.def.icon }}</span>{{ v.def.label }}</span>
          <span class="chip" [class.good]="v.outcome?.tone === 'positive'" [class.bad]="!v.outcome || v.outcome.tone === 'negative'">{{ v.outcome ? 'Dénouement' : v.phase.name }}</span>
        </div>
        @if (v.outcome) {
          <p class="lede"><b>{{ v.outcome.title }}.</b> {{ v.outcome.text }}</p>
        } @else {
          <p class="lede">{{ v.phase.text }}</p>
          <ol class="steps" aria-label="Phases">
            @for (p of v.def.phases; track p.name; let i = $index) { <li [class.done]="i < v.s.phase" [class.now]="i === v.s.phase">{{ p.name }}</li> }
          </ol>
          <div class="gauges">
            @for (k of keys; track k) {
              <div class="g">
                <div class="row"><span>{{ v.def.gauges[k].label }}</span><span class="mono" [class.neg]="k === 'b'">{{ v.s[k] | number: '1.0-0' }}</span></div>
                <div class="track"><span class="fill" [class]="'fill f-' + k" [style.width.%]="v.s[k]"></span></div>
              </div>
            }
          </div>
          <p class="foot muted">{{ v.def.hint }} Encore {{ v.left }} mois dans cette phase. Onglet « {{ v.def.tab }} ».</p>
        }
      </section>
    }
  `,
  styles: `
    .spanel { --saga: #2f6f8f; border-left: 4px solid var(--saga); display: grid; gap: 10px;
      background: linear-gradient(180deg, color-mix(in srgb, var(--saga) 7%, var(--surface)), var(--surface)); .card-title { margin-bottom: 0; } }
    .t { display: inline-flex; align-items: center; gap: 8px; } .ic { font-size: 18px; }
    .lede { margin: 0; font-size: 13px; color: var(--ink-2); }
    .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px;
      li { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--surface-2); color: var(--ink-3); }
      li.done { color: var(--ink-2); text-decoration: line-through; } li.now { background: var(--saga); color: #fff; font-weight: 600; } }
    .gauges { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
    .g { display: grid; gap: 4px; }
    .row { display: flex; justify-content: space-between; font-size: 12.5px; }
    .track { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; }
    .fill { display: block; height: 100%; transition: width .5s; }
    .f-a { background: var(--good); } .f-b { background: var(--bad); } .f-c { background: var(--saga); }
    .neg { color: var(--bad); }
    .foot { margin: 0; font-size: 11.5px; line-height: 1.45; }
  `,
})
export class SagaPanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly keys = ['a', 'b', 'c'] as const;
  protected readonly view = computed(() => {
    const s = this.game.s().saga;
    const def = s ? SAGA_BY_ID.get(s.id) : undefined;
    if (!s || !def) return null;
    const phase = def.phases[Math.min(s.phase, def.phases.length - 1)];
    const outcome = s.outcome ? def.outcomes[s.outcome] : null;
    return { s, def, phase, outcome, left: Math.max(0, phase.months - (this.game.week() - s.phaseSince)) };
  });
}

import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { CRISES, activeCrises, crisisStage } from '../../engine/crises';

/** Les crises au long cours : jauge, risque, dénouement */
@Component({
  selector: 'app-crisis-panel',
  imports: [DecimalPipe],
  template: `
    @for (c of rows(); track c.id) {
      <section class="card crisis" role="region" [attr.aria-label]="c.def.label">
        <div class="card-title">
          <span class="t"><span aria-hidden="true">{{ c.def.icon }}</span> {{ c.def.label }}</span>
          <span class="chip">{{ c.left > 0 ? 'Dénouement dans ' + c.left + ' mois' : 'Dénouement ce mois-ci' }}</span>
        </div>
        <p class="lede">{{ c.stage }}</p>
        <div class="gauges">
          <div class="g"><div class="row"><span>{{ c.def.gaugeLabel }}</span><span class="mono">{{ c.a.gauge | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill good" [style.width.%]="c.a.gauge"></span></div></div>
          <div class="g"><div class="row"><span>{{ c.def.riskLabel }}</span><span class="mono">{{ c.a.risk | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill bad" [style.width.%]="c.a.risk"></span></div></div>
        </div>
        <p class="muted foot">Onglet Crise : vos leviers. Plus la jauge dépasse le risque au dénouement, mieux c’est.</p>
      </section>
    }
  `,
  styles: `
    :host { display: grid; gap: 12px; }
    .crisis { border-left: 4px solid var(--warn); display: grid; gap: 8px; .card-title { margin-bottom: 0; } }
    .t { display: inline-flex; gap: 6px; align-items: center; }
    .lede { margin: 0; font-size: 13px; color: var(--ink-2); }
    .gauges { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
    .g { display: grid; gap: 4px; } .row { display: flex; justify-content: space-between; font-size: 12.5px; }
    .track { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; }
    .fill { display: block; height: 100%; transition: width .5s; } .fill.good { background: var(--good); } .fill.bad { background: var(--bad); }
    .foot { margin: 0; font-size: 11.5px; }
  `,
})
export class CrisisPanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly rows = computed(() => {
    const s = this.game.s();
    return activeCrises(s).map(([id, a]) => ({ id, a, def: CRISES[id], stage: crisisStage(s, id, a), left: Math.max(0, a.months - (s.week - a.since)) }));
  });
}

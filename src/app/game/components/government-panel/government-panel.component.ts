import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { MINISTRIES } from '../../engine/government';

/** Matignon (Premier·e ministre) ou votre ministère */
@Component({
  selector: 'app-government-panel',
  imports: [DecimalPipe],
  template: `
    @if (game.s().government; as g) {
      <section class="card matignon">
        <div class="card-title"><span>Hôtel de Matignon</span>
          <span class="chip accent">{{ g.composition ? 'Gouvernement ' + g.composition : 'Gouvernement à former' }}</span></div>
        <div class="gauges">
          <div class="g">
            <div class="row"><span>Majorité à l’Assemblée</span><span class="mono">{{ g.majority | number: '1.0-0' }} %</span></div>
            <div class="track"><span class="fill" [class.ok]="g.majority >= 50" [class.low]="g.majority < 35" [style.width.%]="g.majority"></span><i class="mark" style="left: 50%"></i></div>
            <small class="muted">Sous 33 %, l’opposition dépose une motion de censure.</small>
          </div>
          <div class="g">
            <div class="row"><span>Solidarité des ministres</span><span class="mono">{{ g.cohesion | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill" [class.ok]="g.cohesion >= 60" [class.low]="g.cohesion < 30" [style.width.%]="g.cohesion"></span></div>
            <small class="muted">Séminaires et arbitrages la renforcent ; les frondes l’abîment.</small>
          </div>
        </div>
        <p class="muted small">À Matignon depuis {{ game.month(g.since) }} · onglet Fonction : politique générale, 49.3, remaniement, conférence sociale.</p>
      </section>
    } @else if (ministry(); as m) {
      <section class="card ministere">
        <div class="card-title"><span>Ministère {{ m }}</span><span class="chip">Gouvernement</span></div>
        <p class="muted small">Maîtrise du dossier : {{ domainMastery() | number: '1.0-0' }} / 100 — elle fait votre autorité au banc du gouvernement. Projets de loi, questions au gouvernement, arbitrages : onglet Fonction.</p>
      </section>
    }
  `,
  styles: `
    .small { font-size: 12.5px; margin: 8px 0 0; }
    .gauges { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
    .g { display: grid; gap: 4px; small { font-size: 11.5px; } }
    .row { display: flex; justify-content: space-between; font-size: 13px; }
    .track { position: relative; height: 7px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); }
    .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: var(--accent); transition: width .4s; }
    .fill.ok { background: var(--good); } .fill.low { background: var(--bad); }
    .mark { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--ink); }
    .matignon { border-left: 4px solid #4a3f8a; }
    .ministere { border-left: 4px solid var(--accent); }
  `,
})
export class GovernmentPanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly ministry = computed(() => {
    const s = this.game.s();
    return s.player.rankId === 'ministre' && s.portfolio ? MINISTRIES[s.portfolio] : null;
  });
  protected readonly domainMastery = computed(() => {
    const s = this.game.s();
    return s.portfolio ? s.player.dossiers[s.portfolio].mastery : 0;
  });
}

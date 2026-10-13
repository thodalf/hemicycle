import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { ZOMBIE_PHASES, ZOMBIE_PHASE_TEXT, biteRisk, zombiePhase } from '../../engine/zombie';

/** Épidémie Z : infection, confinement, panique, recherche du vaccin */
@Component({
  selector: 'app-zombie-panel',
  imports: [DecimalPipe],
  template: `
    @if (game.s().zombie; as z) {
      <section class="card zpanel" role="region" aria-label="Épidémie Z">
        <div class="card-title">
          <span class="t"><span class="bio" aria-hidden="true">☣</span>Épidémie Z</span>
          <span class="chip" [class.bad]="phase() >= 2" [class.good]="phase() === 4">{{ phases[phase()] }}</span>
        </div>
        <p class="lede">{{ texts[phase()] }}</p>
        <div class="gauges">
          <div class="g"><div class="row"><span>Territoire infecté</span><span class="mono neg">{{ z.infection | number: '1.0-0' }} %</span></div>
            <div class="track"><span class="fill inf" [style.width.%]="z.infection"></span></div></div>
          <div class="g"><div class="row"><span>Confinement</span><span class="mono">{{ z.containment | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill con" [style.width.%]="z.containment"></span></div></div>
          <div class="g"><div class="row"><span>Panique</span><span class="mono">{{ z.panic | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill pan" [style.width.%]="z.panic"></span></div></div>
          <div class="g"><div class="row"><span>Recherche du vaccin</span><span class="mono">{{ z.cure | number: '1.0-0' }} %</span></div>
            <div class="track"><span class="fill cure" [style.width.%]="z.cure"></span></div></div>
        </div>
        <p class="foot muted">
          @if (z.vaccine) { Le vaccin reconquiert le pays, région par région. }
          @else { À 100 % de recherche, le vaccin est prêt. À 100 % d’infection, l’État se replie. }
          @if (risk() > 0) { <span class="neg">Risque d’être mordu·e : {{ risk() | number: '1.1-1' }} % par mois{{ game.player().flags['zShelter'] ? ' (à l’abri)' : '' }}.</span> }
          Onglet Épidémie Z.
        </p>
      </section>
    }
  `,
  styles: `
    .zpanel { border-left: 4px solid #5d8a2e; display: grid; gap: 10px; .card-title { margin-bottom: 0; } }
    .t { display: inline-flex; align-items: center; gap: 8px; } .bio { color: #5d8a2e; font-size: 18px; }
    .lede { margin: 0; font-size: 13px; color: var(--ink-2); }
    .gauges { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
    .g { display: grid; gap: 4px; }
    .row { display: flex; justify-content: space-between; font-size: 12.5px; }
    .track { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; }
    .fill { display: block; height: 100%; transition: width .5s; }
    .inf { background: #5d8a2e; } .con { background: var(--accent); } .pan { background: var(--warn); } .cure { background: var(--good); }
    .neg { color: var(--bad); }
    .foot { margin: 0; font-size: 11.5px; line-height: 1.45; }
  `,
})
export class ZombiePanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly phases = ZOMBIE_PHASES;
  protected readonly texts = ZOMBIE_PHASE_TEXT;
  protected readonly phase = computed(() => { const z = this.game.s().zombie; return z ? zombiePhase(z) : 0; });
  protected readonly risk = computed(() => biteRisk(this.game.s()));
}

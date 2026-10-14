import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { APOC_PHASES, APOC_TEXT, DEVIL } from '../../engine/apocalypse';

/** Fin du monde : ténèbres, résistance, emprise de la secte */
@Component({
  selector: 'app-apocalypse-panel',
  imports: [DecimalPipe],
  template: `
    @if (game.s().apocalypse; as a) {
      <section class="card apanel" role="region" aria-label="Fin du monde">
        <div class="card-title">
          <span class="t"><span class="sun" aria-hidden="true">◉</span>Fin du monde</span>
          <span class="chip" [class.bad]="a.phase >= 2 && a.phase < 4" [class.good]="a.phase === 4 && a.outcome !== 'regne'">{{ phases[a.phase] }}</span>
        </div>
        <p class="lede">{{ lede() }}</p>
        @if (a.phase < 4) {
          <div class="gauges">
            <div class="g"><div class="row"><span>Ténèbres</span><span class="mono neg">{{ a.darkness | number: '1.0-0' }}</span></div>
              <div class="track"><span class="fill dark" [style.width.%]="a.darkness"></span></div></div>
            <div class="g"><div class="row"><span>Résistance</span><span class="mono">{{ a.resistance | number: '1.0-0' }}</span></div>
              <div class="track"><span class="fill res" [style.width.%]="a.resistance"></span></div></div>
            @if (a.phase <= 2) {
              <div class="g"><div class="row"><span>Emprise de la secte</span><span class="mono">{{ a.cult | number: '1.0-0' }}</span></div>
                <div class="track"><span class="fill cult" [style.width.%]="a.cult"></span></div></div>
            }
          </div>
          <p class="foot muted">{{ hint() }} Onglet Fin du monde.</p>
        }
      </section>
    }
  `,
  styles: `
    .apanel { border-left: 4px solid #7a1f2b; display: grid; gap: 10px; background: linear-gradient(180deg, color-mix(in srgb, #7a1f2b 6%, var(--surface)), var(--surface)); .card-title { margin-bottom: 0; } }
    .t { display: inline-flex; align-items: center; gap: 8px; } .sun { color: #1b1b1b; font-size: 18px; text-shadow: 0 0 6px #c0392b; }
    .lede { margin: 0; font-size: 13px; color: var(--ink-2); }
    .gauges { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
    .g { display: grid; gap: 4px; }
    .row { display: flex; justify-content: space-between; font-size: 12.5px; }
    .track { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; }
    .fill { display: block; height: 100%; transition: width .5s; }
    .dark { background: #3a1016; } .res { background: var(--good); } .cult { background: #8e44ad; }
    .neg { color: var(--bad); }
    .foot { margin: 0; font-size: 11.5px; line-height: 1.45; }
  `,
})
export class ApocalypsePanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly phases = APOC_PHASES;
  protected readonly lede = computed(() => {
    const a = this.game.s().apocalypse;
    if (!a) return '';
    if (a.phase < 4) return APOC_TEXT[a.phase];
    return a.outcome === 'secte_demantelee' ? 'La secte démantelée, le rituel n’a jamais eu lieu.'
      : a.outcome === 'diable_repousse' ? `${DEVIL} est reparti, vaincu par un pays uni.`
      : a.outcome === 'pacte' ? `${DEVIL} est parti, grâce à votre signature. Il repassera chaque année.`
      : 'La longue nuit est finie. Le pays panse ses plaies.';
  });
  protected readonly hint = computed(() => {
    const a = this.game.s().apocalypse!;
    const left = Math.max(0, [3, 5, 3, 6][a.phase] - (this.game.week() - a.phaseSince));
    return a.phase <= 1 ? `La secte gagne du terrain. Sous 20 d’emprise avant le rituel, il n’aura pas lieu.`
      : a.phase === 2 ? `Rituel dans ${left} mois. Faites tomber l’emprise de la secte sous 20 pour l’empêcher.`
      : `Encore ${left} mois : si la résistance dépasse les ténèbres, le Diable repartira. Il a votre numéro…`;
  });
}

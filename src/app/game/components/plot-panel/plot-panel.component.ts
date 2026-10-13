import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { attemptLethality, plotKnowledge, protectionLevel } from '../../engine/plot';

/** Le complot en cours : imminence, enquête, protection, signes avant-coureurs */
@Component({
  selector: 'app-plot-panel',
  imports: [DecimalPipe],
  template: `
    @if (game.s().plot; as p) {
      <section class="card plot" role="region" aria-label="Complot en cours">
        <div class="card-title">
          <span class="title"><span class="target" aria-hidden="true"></span>Menaces de mort</span>
          <span class="chip bad">Complot en cours</span>
        </div>
        <div class="gauges">
          <div class="g">
            <div class="row"><span>Imminence du passage à l’acte</span><span class="mono neg">{{ p.danger | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill danger" [style.width.%]="p.danger"></span><i class="mark" style="left: 70%"></i></div>
            <small class="muted">À 100, la tentative a lieu.</small>
          </div>
          <div class="g">
            <div class="row"><span>Avancée de l’enquête</span><span class="mono">{{ p.intel | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill intel" [style.width.%]="p.intel"></span><i class="mark" style="left: 30%"></i><i class="mark" style="left: 60%"></i></div>
            <small class="muted">À 100, coup de filet : le complot est déjoué.</small>
          </div>
        </div>
        <dl class="facts">
          <div><dt>Mobile</dt><dd>{{ know().motive ?? 'Inconnu (enquête à 30)' }}</dd></div>
          <div><dt>Commanditaire</dt><dd>{{ know().suspect ?? 'Inconnu (enquête à 60)' }}</dd></div>
          <div><dt>Votre protection</dt><dd><span class="mono">{{ protection() | number: '1.0-0' }}</span> / 100{{ p.vest ? ' · gilet pare-balles' : '' }}</dd></div>
          <div><dt>Si l’attaque avait lieu ce mois-ci</dt><dd [class.neg]="lethal() > 0.15">risque mortel ≈ <span class="mono">{{ lethal() * 100 | number: '1.0-0' }} %</span></dd></div>
        </dl>
        <ol class="signs">
          @for (sg of p.signs.slice(0, 4); track $index) { <li><span class="mono">{{ game.month(sg.week) }}</span> {{ sg.text }}</li> }
        </ol>
        <p class="muted small">Onglet Sécurité : protection, renseignement, enquêteur privé, changer ses habitudes, gilet pare-balles. Moins vous êtes prévisible, plus le passage à l’acte recule.</p>
      </section>
    }
  `,
  styles: `
    .plot { border-left: 4px solid var(--bad); display: grid; gap: 10px; .card-title { margin-bottom: 0; } }
    .title { display: inline-flex; align-items: center; gap: 8px; }
    .target { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--bad); position: relative;
      box-shadow: inset 0 0 0 3px var(--surface), inset 0 0 0 6px var(--bad); animation: pulse 1.6s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: .45; } }
    .gauges { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .g { display: grid; gap: 4px; small { font-size: 11px; } }
    .row { display: flex; justify-content: space-between; font-size: 12.5px; .neg { color: var(--bad); } }
    .track { position: relative; height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); }
    .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; transition: width .6s; }
    .fill.danger { background: linear-gradient(90deg, var(--warn), var(--bad)); } .fill.intel { background: var(--accent); }
    .mark { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--ink-3); }
    .facts { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px;
      div { display: grid; gap: 1px; } dt { font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: .05em; }
      dd { margin: 0; font-size: 13px; } dd.neg { color: var(--bad); font-weight: 600; } }
    .signs { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 12.5px;
      li { padding-left: 8px; border-left: 3px solid var(--bad); } .mono { color: var(--ink-3); font-size: 11px; margin-right: 4px; } }
    .small { font-size: 11.5px; margin: 0; }
    @media (prefers-reduced-motion: reduce) { .target { animation: none; } }
  `,
})
export class PlotPanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly know = computed(() => { const p = this.game.s().plot; return p ? plotKnowledge(p) : { motive: null, suspect: null }; });
  protected readonly protection = computed(() => protectionLevel(this.game.s()));
  protected readonly lethal = computed(() => attemptLethality(this.game.s()));
}

import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { PARTNERS, intlPower, intlRelevant, relationLabel } from '../../engine/intl';
import { ENEMIES, hostileLabel } from '../../engine/war';

/** Politique internationale : prestige, tensions, relations, crise en cours */
@Component({
  selector: 'app-world-panel',
  imports: [DecimalPipe],
  template: `
    @if (relevant()) {
      <section class="card world">
        <div class="card-title">
          <span class="globe-title"><span class="globe" aria-hidden="true"></span>Le monde</span>
          <span class="chip" [class.accent]="power()">{{ power() ? 'Vous pesez' : 'Vous observez' }}</span>
        </div>
        @if (w().crisis; as cr) {
          <div class="crisis">
            <strong>Crise : {{ cr.name }}</strong>
            <div class="track"><span class="fill low" [style.width.%]="cr.intensity"></span></div>
            <small class="muted">Intensité {{ cr.intensity | number: '1.0-0' }} · depuis {{ game.month(cr.since) }}{{ isPresident() ? ' · médiation ou intervention possibles (onglet International)' : '' }}</small>
          </div>
        }
        <div class="duo">
          <div class="g">
            <div class="row"><span>Prestige</span><span class="mono">{{ w().prestige | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill ok" [style.width.%]="w().prestige"></span></div>
          </div>
          <div class="g">
            <div class="row"><span>Tensions</span><span class="mono">{{ w().tension | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill" [class.low]="w().tension >= 50" [style.width.%]="w().tension"></span></div>
          </div>
        </div>
        <ul class="partners">
          @for (p of partners(); track p.id) {
            <li [title]="p.label">
              <span class="name">{{ p.name }}</span>
              <span class="bar"><span class="mid"></span>
                <span class="val" [class.neg]="p.value < 0" [style.left.%]="p.value < 0 ? 50 + p.value / 2 : 50" [style.width.%]="Math.abs(p.value) / 2"></span></span>
              <span class="mono">{{ p.value > 0 ? '+' : '' }}{{ p.value | number: '1.0-0' }}</span>
            </li>
          }
        </ul>
        <div class="hostile-head"><span class="eyebrow">États hostiles</span><span class="muted tiny">sous −80 : risque d’attaque</span></div>
        <ul class="partners hostile">
          @for (h of hostile(); track h.id) {
            <li [title]="h.label" [class.danger]="h.value <= -65">
              <span class="name">{{ h.name }}</span>
              <span class="bar"><span class="mid"></span><span class="limit" aria-hidden="true"></span>
                <span class="val" [class.neg]="h.value < 0" [style.left.%]="h.value < 0 ? 50 + h.value / 2 : 50" [style.width.%]="Math.abs(h.value) / 2"></span></span>
              <span class="mono">{{ h.value > 0 ? '+' : '' }}{{ h.value | number: '1.0-0' }}</span>
            </li>
          }
        </ul>
        <p class="muted small">{{ w().treaties }} accord(s) de paix signé(s). Le prestige nourrit votre influence{{ isPresident() ? ' et votre cote' : '' }} ; les tensions, la menace d’attentat.</p>
      </section>
    }
  `,
  styles: `
    .world { display: grid; gap: 10px; }
    .card-title { margin-bottom: 0; }
    .globe-title { display: inline-flex; align-items: center; gap: 8px; }
    .globe { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid var(--accent); position: relative; overflow: hidden;
      background: repeating-linear-gradient(90deg, transparent 0 5px, color-mix(in srgb, var(--accent) 35%, transparent) 5px 6px);
      animation: spin 6s linear infinite; background-size: 12px 100%; }
    @keyframes spin { to { background-position: 12px 0; } }
    @media (prefers-reduced-motion: reduce) { .globe { animation: none; } }
    .crisis { display: grid; gap: 4px; padding: 8px 10px; border-radius: 8px; background: var(--bad-soft); strong { font-size: 13px; color: var(--bad); } small { font-size: 11.5px; } }
    .duo { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .g { display: grid; gap: 4px; }
    .row { display: flex; justify-content: space-between; font-size: 12.5px; }
    .track { position: relative; height: 6px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; }
    .fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--accent); transition: width .4s; }
    .fill.ok { background: var(--good); } .fill.low { background: var(--bad); }
    .partners { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px; }
    .partners li { display: grid; grid-template-columns: 110px 1fr 34px; gap: 8px; align-items: center; font-size: 12.5px; .mono { text-align: right; font-size: 11.5px; } }
    .bar { position: relative; height: 6px; border-radius: 3px; background: var(--surface-2); border: 1px solid var(--line); }
    .mid { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: var(--ink-3); }
    .val { position: absolute; top: 0; bottom: 0; background: var(--good); border-radius: 3px; transition: all .4s; }
    .val.neg { background: var(--bad); }
    .small { font-size: 11.5px; margin: 0; }
    .hostile-head { display: flex; justify-content: space-between; align-items: baseline; margin-top: 2px; }
    .tiny { font-size: 11px; }
    .limit { position: absolute; left: 10%; top: -3px; bottom: -3px; width: 2px; background: var(--bad); opacity: .6; }
    .hostile li.danger .name { color: var(--bad); font-weight: 600; }
  `,
})
export class WorldPanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly Math = Math;
  protected readonly w = computed(() => this.game.s().intl);
  protected readonly relevant = computed(() => intlRelevant(this.game.s()));
  protected readonly power = computed(() => intlPower(this.game.s()));
  protected readonly isPresident = computed(() => !!this.game.s().presidency);
  protected readonly hostile = computed(() => ENEMIES.filter(e => !this.game.s().player.flags[`annexed_${e.id}`]).map(e => {
    const value = Math.round(this.w().hostile?.[e.id] ?? 0);
    return { id: e.id, name: e.name, value, label: hostileLabel(value) };
  }));
  protected readonly partners = computed(() => PARTNERS.map(p => {
    const value = Math.round(this.w().relations[p.id] ?? 0);
    return { id: p.id, name: p.name, value, label: relationLabel(value) };
  }));
}

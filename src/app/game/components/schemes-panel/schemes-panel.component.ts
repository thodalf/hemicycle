import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { SCHEMES, abandonScheme, discoveryRisk } from '../../engine/schemes';

/** Vos complots en cours : progression, discrétion, risque d'être découvert */
@Component({
  selector: 'app-schemes-panel',
  imports: [DecimalPipe],
  template: `
    @if (rows().length) {
      <section class="card schemes" aria-label="Vos complots">
        <div class="card-title">
          <span>Vos complots</span>
          <span class="chip">{{ rows().length }} / 3</span>
        </div>
        <ul>
          @for (r of rows(); track r.s.id) {
            <li>
              <div class="head">
                <span class="ico" aria-hidden="true">{{ r.def.icon }}</span>
                <span class="t"><strong>{{ r.def.label }}</strong><small class="muted">{{ r.s.targetName }} · depuis {{ game.month(r.s.since) }}</small></span>
                @if (confirm() === r.s.id) {
                  <button class="btn small" (click)="abandon(r.s.id)">Confirmer</button>
                } @else {
                  <button class="btn small ghost" (click)="confirm.set(r.s.id)">Abandonner</button>
                }
              </div>
              <div class="g"><span>Progression</span><span class="bar"><i class="p" [style.width.%]="r.s.progress"></i></span><span class="mono">{{ r.s.progress | number: '1.0-0' }}</span></div>
              <div class="g"><span>Discrétion</span><span class="bar"><i class="d" [class.low]="r.s.secrecy < 35" [style.width.%]="r.s.secrecy"></i></span><span class="mono">{{ r.s.secrecy | number: '1.0-0' }}</span></div>
              <small class="risk" [class.hot]="r.risk >= 0.12">Risque d’être découvert ce mois-ci : {{ r.risk * 100 | number: '1.0-0' }} %</small>
            </li>
          }
        </ul>
        <p class="muted note">Onglet Intrigues : faire avancer vos complots, brouiller les pistes. À 100, le complot aboutit.</p>
      </section>
    }
  `,
  styles: `
    .schemes { border-left: 4px solid #6b4fa0; display: grid; gap: 8px; .card-title { margin-bottom: 0; } }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    li { display: grid; gap: 4px; padding-top: 8px; border-top: 1px solid var(--line); }
    li:first-child { border-top: 0; padding-top: 0; }
    .head { display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: center; }
    .ico { font-size: 18px; } .t { display: grid; font-size: 13px; small { font-size: 11.5px; } }
    .g { display: grid; grid-template-columns: 86px 1fr 28px; gap: 8px; align-items: center; font-size: 12px; }
    .bar { height: 7px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden;
      i { display: block; height: 100%; transition: width .4s; } .p { background: #6b4fa0; } .d { background: var(--good); } .d.low { background: var(--bad); } }
    .mono { text-align: right; }
    .risk { font-size: 11.5px; color: var(--ink-3); } .risk.hot { color: var(--bad); font-weight: 600; }
    .note { margin: 0; font-size: 11.5px; }
  `,
})
export class SchemesPanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly confirm = signal<string | null>(null);
  protected readonly rows = computed(() => {
    const s = this.game.s();
    return (s.schemes ?? []).map(x => ({ s: x, def: SCHEMES[x.type], risk: discoveryRisk(s, x) }));
  });
  protected abandon(id: string): void {
    this.confirm.set(null);
    this.game.mutate(d => abandonScheme(d, id));
  }
}

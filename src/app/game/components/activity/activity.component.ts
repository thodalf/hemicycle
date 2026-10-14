import { Component, computed, inject } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { FxService, toneOfSummary } from '../../services/fx.service';
import { ACTIVITY_BY_ID, chooseStep, closeActivity, currentStep } from '../../engine/activities';

/** L'activité en cours : trois moments, des invités, des choix */
@Component({
  selector: 'app-activity',
  template: `
    @if (a(); as act) {
      <div class="overlay" role="dialog" aria-modal="true" [attr.aria-label]="def()?.label">
        <section class="sheet">
          <header>
            <span class="icon">{{ def()?.icon }}</span>
            <div><span class="eyebrow">Activité</span><h2>{{ def()?.label }}</h2></div>
            <span class="steps">@for (s of act.steps; track $index) { <i [class.done]="$index < act.stage" [class.now]="$index === act.stage && act.status === 'en_cours'"></i> }</span>
          </header>
          <div class="guests">
            @for (g of guests(); track g.id) { <span class="guest"><b>{{ initials(g.name) }}</b>{{ g.name }} <small class="mono" [class.pos]="g.relationToPlayer > 0" [class.neg]="g.relationToPlayer < 0">{{ g.relationToPlayer > 0 ? '+' : '' }}{{ round(g.relationToPlayer) }}</small></span> }
          </div>
          <ol class="log">@for (l of act.log; track $index) { <li [style.animation-delay.ms]="$index * 60">{{ l }}</li> }</ol>
          @if (step(); as st) {
            <div class="moment">
              <h3>{{ st.step.title(st.g, st.h) }}</h3>
              <p>{{ st.step.text(st.g, st.h) }}</p>
              <div class="choices">
                @for (c of st.step.choices(st.g, st.h); track c.id) {
                  <button class="btn choice" (click)="choose(c.id, $event)">{{ c.label }}</button>
                }
              </div>
            </div>
          } @else {
            <div class="end">
              <strong>Fin de l’activité</strong>
              <div class="chips">@for (r of act.summary; track $index) { <span class="chip" [class.good]="tone(r) === 'good'" [class.bad]="tone(r) === 'bad'" [style.animation-delay.ms]="$index * 70">{{ r }}</span> }</div>
              <button class="btn primary" (click)="close()">Rentrer</button>
            </div>
          }
        </section>
      </div>
    }
  `,
  styles: `
    .overlay { position: fixed; inset: 0; z-index: 20; background: rgba(10, 12, 18, .6); backdrop-filter: blur(3px); display: grid; place-items: start center; overflow-y: auto; padding: 24px 16px; }
    .sheet { width: 100%; max-width: 640px; background: var(--surface); border-radius: 14px; box-shadow: 0 24px 60px -20px rgba(0,0,0,.5); padding: 16px 18px; display: grid; gap: 12px; animation: rise .3s ease; }
    @keyframes rise { from { transform: translateY(14px); opacity: 0; } }
    header { display: flex; gap: 12px; align-items: center; .icon { font-size: 34px; } h2 { margin: 0; font: 700 21px var(--font-display); } div { flex: 1; } }
    .steps { display: inline-flex; gap: 5px; i { width: 10px; height: 10px; border-radius: 50%; background: var(--line); } i.done { background: var(--good); } i.now { background: var(--accent); animation: pulse 1.2s infinite; } }
    @keyframes pulse { 50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 25%, transparent); } }
    .guests { display: flex; flex-wrap: wrap; gap: 6px; }
    .guest { display: inline-flex; gap: 6px; align-items: center; padding: 3px 10px 3px 3px; border-radius: 999px; background: var(--surface-2); font-size: 12.5px;
      b { width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: var(--surface); display: grid; place-items: center; font-size: 10.5px; }
      .pos { color: var(--good); } .neg { color: var(--bad); } }
    .log { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 12.5px; color: var(--ink-2); li { animation: rise .3s both; } }
    .moment { padding: 12px; border-radius: 12px; background: var(--surface-2); border-left: 4px solid var(--accent); animation: rise .35s ease;
      h3 { margin: 0 0 4px; font: 700 16px var(--font-display); } p { margin: 0 0 10px; font-size: 13.5px; } }
    .choices { display: grid; gap: 6px; }
    .choice { text-align: left; }
    .end { display: grid; gap: 10px; justify-items: start; .chips { display: flex; flex-wrap: wrap; gap: 5px; } .chip { animation: rise .3s both; } }
  `,
})
export class ActivityComponent {
  private readonly game = inject(GameStateService);
  private readonly fx = inject(FxService);
  protected readonly a = computed(() => this.game.s().activity ?? null);
  protected readonly def = computed(() => (this.a() ? ACTIVITY_BY_ID.get(this.a()!.type) : undefined));
  protected readonly step = computed(() => currentStep(this.game.s()));
  protected readonly guests = computed(() => (this.a()?.guests ?? []).map(id => this.game.s().npcs.find(n => n.id === id)).filter(n => !!n).map(n => n!));

  protected choose(id: string, ev: Event): void {
    this.fx.burstAt(ev.currentTarget as Element, 'neutral');
    this.game.mutate((d, rng) => chooseStep(d, id, rng));
    if (this.a()?.status === 'fini') this.fx.stamp(this.def()?.label ?? 'Activité', 'good', 'Souvenirs, alliances et rancunes');
  }

  protected close(): void {
    this.game.mutate(d => closeActivity(d));
  }

  protected initials(n: string) { return n.split(/[\s-]+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
  protected round(n: number) { return Math.round(n); }
  protected tone(s: string) { return toneOfSummary(s); }
}

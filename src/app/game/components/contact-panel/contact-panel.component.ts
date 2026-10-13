import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { ALIEN_NEXT, ALIEN_PHASES, ALIEN_PHASE_TEXT, alienNeeds } from '../../engine/alien';

/** Premier contact : ciel étoilé, vaisseau qui approche, jauges et phases */
@Component({
  selector: 'app-contact-panel',
  imports: [DecimalPipe],
  template: `
    @if (game.s().alien; as a) {
      <section class="card contact">
        <div class="sky" aria-hidden="true">
          @for (st of stars; track $index) { <i [style.left.%]="st.x" [style.top.%]="st.y" [style.animation-delay.ms]="st.d" [style.width.px]="st.s" [style.height.px]="st.s"></i> }
          <div class="earth"></div>
          <div class="ship" [style.--scale]="shipScale()" [style.left.%]="shipX()" [style.top.%]="shipY()">
            <span class="dome"></span><span class="disc"></span><span class="lights"><b></b><b></b><b></b></span>
            @if (a.phase >= 3) { <span class="beam"></span> }
          </div>
          <div class="sky-title">
            <span class="eyebrow on-dark">Premier contact · {{ a.species }}</span>
            <strong>{{ phases[a.phase] }}</strong>
          </div>
        </div>
        <ol class="steps">
          @for (p of phases; track $index) { <li [class.done]="$index < a.phase" [class.now]="$index === a.phase">{{ p }}</li> }
        </ol>
        <p class="muted small">{{ phaseText[a.phase] }}</p>
        <div class="gauges">
          <div class="g"><div class="row"><span>Compréhension</span><span class="mono">{{ a.comprehension | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill ok" [style.width.%]="a.comprehension"></span>@if (next(); as n) { <i class="mark" [style.left.%]="n.comprehension"></i> }</div></div>
          <div class="g"><div class="row"><span>Confiance des Vélari</span><span class="mono">{{ a.confiance | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill" [class.low]="a.confiance < 15" [style.width.%]="a.confiance"></span>@if (next(); as n) { @if (n.confiance) { <i class="mark" [style.left.%]="n.confiance"></i> } }</div></div>
          <div class="g"><div class="row"><span>Panique</span><span class="mono" [class.neg]="a.panique >= 70">{{ a.panique | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill low" [style.width.%]="a.panique"></span><i class="mark danger" style="left: 95%"></i></div></div>
          <div class="g"><div class="row"><span>Rivalité des puissances</span><span class="mono" [class.neg]="a.rivalite >= 75">{{ a.rivalite | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill warn" [style.width.%]="a.rivalite"></span><i class="mark danger" style="left: 99%"></i></div></div>
        </div>
        <p class="muted small next">
          @if (needs(); as n) {
            @if (n.length) { Phase suivante : {{ n.join(', ') }}. } @else { La phase suivante s’ouvre à la fin du mois. }
          } @else {
            Ambassade ouverte · {{ a.gifts }} technologie(s) reçue(s).
          }
          Panique à 95, confiance au plus bas une fois le vaisseau en orbite, ou rivalité à 100 : le dossier vous échappe.
        </p>
      </section>
    }
  `,
  styles: `
    .contact { display: grid; gap: 10px; border-left: 4px solid #3b6f8f; padding-top: 0; overflow: hidden; }
    .sky { position: relative; height: 150px; margin: 0 -18px; background: radial-gradient(120% 90% at 70% 120%, #23436a, #0b1022 60%); overflow: hidden; }
    .sky i { position: absolute; border-radius: 50%; background: #fff; opacity: .8; animation: tw 2.6s ease-in-out infinite; }
    @keyframes tw { 50% { opacity: .15; } }
    .earth { position: absolute; left: -10%; right: -10%; bottom: -120px; height: 160px; border-radius: 50%;
      background: radial-gradient(60% 80% at 40% 20%, #4f9bd0, #1e4f7a 60%, #10304d); box-shadow: 0 -4px 22px rgba(120,190,255,.45); }
    .ship { position: absolute; width: 60px; height: 30px; margin: -15px 0 0 -30px; transform: scale(var(--scale)); transition: all 1.4s cubic-bezier(.3,1,.4,1);
      animation: hover 3s ease-in-out infinite; }
    @keyframes hover { 50% { translate: 0 -5px; } }
    .disc { position: absolute; left: 0; right: 0; top: 10px; height: 14px; border-radius: 50%; background: linear-gradient(#c7d6e6, #6c8299); box-shadow: 0 0 14px rgba(160,230,210,.6); }
    .dome { position: absolute; left: 18px; width: 24px; top: 0; height: 16px; border-radius: 12px 12px 4px 4px; background: linear-gradient(#d9fff1, #7cc9b0); }
    .lights { position: absolute; left: 6px; right: 6px; top: 15px; display: flex; justify-content: space-between;
      b { width: 5px; height: 5px; border-radius: 50%; background: #f4d27a; animation: lb .9s steps(2) infinite; }
      b:nth-child(2) { animation-delay: .3s; } b:nth-child(3) { animation-delay: .6s; } }
    @keyframes lb { 50% { opacity: .2; } }
    .beam { position: absolute; left: 14px; right: 14px; top: 22px; height: 70px; background: linear-gradient(rgba(150,240,200,.55), transparent);
      clip-path: polygon(25% 0, 75% 0, 100% 100%, 0 100%); animation: beam 1.6s ease-in-out infinite; }
    @keyframes beam { 50% { opacity: .4; } }
    .sky-title { position: absolute; left: 18px; top: 12px; display: grid; gap: 2px; color: #eef3ff;
      strong { font: 700 20px var(--font-display); } }
    .on-dark { color: rgba(238,243,255,.65); }
    .steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; font-size: 11px;
      li { padding: 4px 6px; border-radius: 6px; background: var(--surface-2); color: var(--ink-3); text-align: center; }
      li.done { background: var(--good-soft); color: var(--good); } li.now { background: #3b6f8f; color: #fff; font-weight: 600; } }
    .small { font-size: 12px; margin: 0; }
    .gauges { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
    .g { display: grid; gap: 4px; }
    .row { display: flex; justify-content: space-between; font-size: 12.5px; .neg { color: var(--bad); } }
    .track { position: relative; height: 7px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); }
    .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: #3b6f8f; transition: width .5s; }
    .fill.ok { background: var(--good); } .fill.low { background: var(--bad); } .fill.warn { background: var(--warn); }
    .mark { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--ink); }
    .mark.danger { background: var(--bad); }
    @media (prefers-reduced-motion: reduce) { .sky i, .ship, .lights b, .beam { animation: none; } }
    @media (max-width: 640px) { .sky { margin: 0 -14px; } .steps { font-size: 10px; } }
  `,
})
export class ContactPanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly phases = ALIEN_PHASES;
  protected readonly phaseText = ALIEN_PHASE_TEXT;
  protected readonly stars = Array.from({ length: 46 }, (_, i) => ({ x: (i * 47) % 100, y: (i * 29) % 70, d: (i * 173) % 2600, s: i % 7 === 0 ? 3 : i % 3 === 0 ? 2 : 1 }));
  private readonly a = computed(() => this.game.s().alien);
  protected readonly next = computed(() => { const a = this.a(); return a ? ALIEN_NEXT[a.phase] ?? null : null; });
  protected readonly needs = computed(() => { const a = this.a(); return a ? alienNeeds(a, this.game.s().week) : null; });
  /** Le vaisseau grossit et descend à chaque phase */
  protected readonly shipScale = computed(() => [0.15, 0.4, 0.75, 1.05, 1.2][this.a()?.phase ?? 0]);
  protected readonly shipX = computed(() => [86, 74, 62, 55, 50][this.a()?.phase ?? 0]);
  protected readonly shipY = computed(() => [22, 30, 38, 52, 46][this.a()?.phase ?? 0]);
}

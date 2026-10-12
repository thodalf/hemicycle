import { Component, computed, inject, signal, effect } from '@angular/core';
import { FxService } from '../../services/fx.service';

/**
 * Soirée électorale animée : compte à rebours de 20 h, barres qui montent,
 * second tour, puis révélation du vainqueur (confettis ou pluie).
 */
@Component({
  selector: 'app-election-night',
  template: `
    @if (fx.election(); as e) {
      <div class="night" role="dialog" aria-modal="true" [attr.aria-label]="e.title" (click)="close()">
        <section class="board" (click)="$event.stopPropagation()">
          <header>
            <span class="live"><i></i> En direct</span>
            <h2>{{ e.title }}</h2>
            <span class="clock">{{ phase() === 'countdown' ? '19:59:5' + (10 - countdown()) : '20:00' }}</span>
          </header>
          @if (phase() === 'countdown') {
            <div class="count" aria-live="polite">{{ countdown() }}</div>
          } @else {
            @for (r of e.rounds; track r.label; let ri = $index) {
              @if (ri <= roundShown()) {
                <div class="round">
                  <div class="eyebrow">{{ r.label }}</div>
                  @for (row of r.rows; track row.name; let i = $index) {
                    <div class="row" [class.me]="row.player" [class.win]="revealed() && row.name === e.winner && ri === e.rounds.length - 1">
                      <span class="name">{{ row.name }}</span>
                      <span class="track"><span class="fill" [style.background]="row.color" [style.width.%]="grown() ? row.share : 0"
                        [style.transition-delay.ms]="i * 180"></span></span>
                      <span class="pct mono">{{ row.share.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) }} %</span>
                    </div>
                  }
                </div>
              }
            }
            @if (revealed()) {
              <div class="verdict" [class.won]="e.playerWon">
                <strong>{{ e.playerWon ? 'Élu·e !' : 'Battu·e' }}</strong>
                <span>{{ e.playerWon ? 'Les militants explosent de joie.' : e.winner + ' l’emporte.' }}</span>
              </div>
              @if (!e.playerWon) { <div class="rain" aria-hidden="true">@for (d of drops; track d) { <i [style.left.%]="d * 4.1" [style.animation-delay.ms]="d * 97 % 900"></i> }</div> }
            }
          }
          <button class="btn primary" (click)="close()">{{ revealed() ? 'Continuer' : 'Passer' }}</button>
        </section>
      </div>
    }
  `,
  styles: `
    .night { position: fixed; inset: 0; z-index: 55; display: grid; place-items: center; padding: 16px;
      background: radial-gradient(ellipse at top, #1f2a44, #0b0e15 70%); animation: fade .3s ease; }
    .board { position: relative; overflow: hidden; width: min(640px, 100%); display: grid; gap: 14px; padding: 22px; border-radius: 16px;
      background: #121826; color: #ece8de; border: 1px solid #2c3242; box-shadow: 0 30px 80px -20px #000; }
    header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; h2 { font-size: 22px; flex: 1; color: #fff; } }
    .live { display: inline-flex; align-items: center; gap: 6px; font: 700 11px var(--font-body); text-transform: uppercase; letter-spacing: .1em; color: #f08a72;
      i { width: 8px; height: 8px; border-radius: 50%; background: #f08a72; animation: blink 1s steps(2) infinite; } }
    .clock { font: 700 18px var(--font-mono); color: #e6b45c; }
    .count { font: 700 120px/1 var(--font-display); text-align: center; color: #fff; animation: count .9s ease infinite; padding: 20px 0; }
    .round { display: grid; gap: 8px; animation: fade .4s ease; .eyebrow { color: #8a8f9a; } }
    .row { display: grid; grid-template-columns: minmax(0, 170px) 1fr 62px; align-items: center; gap: 10px; font-size: 14px; padding: 4px 6px; border-radius: 8px; transition: background .4s; }
    .row.me .name { font-weight: 700; color: #fff; }
    .row.win { background: rgba(230, 180, 92, .14); box-shadow: inset 0 0 0 1px #e6b45c; animation: winner 1s ease 2; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .track { height: 16px; border-radius: 4px; background: #1d2433; overflow: hidden; }
    .fill { display: block; height: 100%; width: 0; border-radius: 4px; transition: width 1.4s cubic-bezier(.2,.8,.2,1); }
    .pct { text-align: right; }
    .verdict { display: grid; justify-items: center; gap: 2px; padding: 10px; animation: verdict .6s cubic-bezier(.2,.9,.3,1.4) both;
      strong { font: 700 40px var(--font-display); color: #f08a72; } span { color: #b4b2ab; } }
    .verdict.won strong { color: #6cc790; }
    .rain i { position: absolute; top: -20px; width: 2px; height: 16px; background: linear-gradient(transparent, #8fb0f0); animation: rain 1s linear infinite; }
    .btn { justify-self: end; }
    @keyframes fade { from { opacity: 0; } }
    @keyframes blink { 50% { opacity: .2; } }
    @keyframes count { 0% { transform: scale(1.4); opacity: 0; } 30% { transform: scale(1); opacity: 1; } 100% { opacity: .2; } }
    @keyframes winner { 50% { box-shadow: inset 0 0 0 2px #e6b45c, 0 0 18px rgba(230,180,92,.5); } }
    @keyframes verdict { from { opacity: 0; transform: scale(.4) rotate(-6deg); } }
    @keyframes rain { to { transform: translateY(520px); } }
    @media (prefers-reduced-motion: reduce) { .night *, .night { animation: none !important; transition: none !important; } }
  `,
})
export class ElectionNightComponent {
  protected readonly fx = inject(FxService);
  protected readonly phase = signal<'countdown' | 'results'>('countdown');
  protected readonly countdown = signal(3);
  protected readonly grown = signal(false);
  protected readonly roundShown = signal(0);
  protected readonly revealed = signal(false);
  protected readonly drops = Array.from({ length: 24 }, (_, i) => i);
  private timers: ReturnType<typeof setTimeout>[] = [];

  private readonly run = effect(() => {
    const e = this.fx.election();
    this.timers.forEach(clearTimeout);
    this.timers = [];
    if (!e) return;
    this.phase.set('countdown'); this.countdown.set(3); this.grown.set(false); this.roundShown.set(0); this.revealed.set(false);
    const at = (ms: number, fn: () => void) => this.timers.push(setTimeout(fn, ms));
    at(900, () => this.countdown.set(2));
    at(1800, () => this.countdown.set(1));
    at(2700, () => { this.phase.set('results'); at(60, () => this.grown.set(true)); });
    let t = 2700 + 1900;
    for (let r = 1; r < e.rounds.length; r++) {
      at(t, () => { this.grown.set(false); this.roundShown.set(r); at(60, () => this.grown.set(true)); });
      t += 1900;
    }
    at(t, () => {
      this.revealed.set(true);
      if (e.playerWon) {
        const w = window.innerWidth, h = window.innerHeight;
        [0.3, 0.5, 0.7].forEach((x, i) => at(i * 160, () => this.fx.burst(w * x, h * 0.3, 'good', 24)));
      }
    });
  });

  protected readonly waiting = computed(() => !!this.fx.election());

  protected close(): void {
    this.timers.forEach(clearTimeout);
    this.fx.election.set(null);
  }
}

import { Component, OnDestroy, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

const NAMES = ['Dupont', 'Martin', 'Lefèvre', 'Garnier', 'Rousseau'];

/** Le dépouillement : compter les bulletins de votre liste pendant que l'assesseur les annonce */
@Component({
  selector: 'app-depouillement-game',
  template: `
    <div class="dp">
      @if (phase() === 'count') {
        <p class="hint">L’assesseur lit les bulletins à voix haute. Comptez ceux de <b>{{ mine }}</b> (votre liste) — de tête !</p>
        <div class="urne">
          @for (b of [current()]; track idx()) { <div class="ballot" [class.null]="b === 'Nul'">{{ b === 'Nul' ? 'Bulletin nul' : b }}</div> }
          <span class="n mono">{{ idx() + 1 }} / {{ ballots.length }}</span>
        </div>
      } @else if (phase() === 'answer') {
        <p class="hint">Le président du bureau vous demande votre décompte pour <b>{{ mine }}</b>.</p>
        <div class="opts">@for (o of opts; track o) { <button type="button" (click)="answer(o)">{{ o }} voix</button> }</div>
      } @else { <p class="said">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .dp { display: grid; gap: 12px; }
    .hint { margin: 0; font-size: 12.5px; color: var(--ink-2); }
    .urne { position: relative; display: grid; place-items: center; min-height: 120px; border-radius: 14px; background: linear-gradient(#e9eef2, #d6dde3); border: 2px solid #b9c3cc; }
    .ballot { padding: 14px 26px; background: #fff; border: 1px solid #c9d1d8; box-shadow: 0 6px 14px -8px rgba(0,0,0,.35); font: 700 20px Georgia, serif; color: #1b2130; animation: drop .45s cubic-bezier(.2,.9,.3,1.2); }
    .ballot.null { color: var(--bad); font-style: italic; }
    @keyframes drop { from { transform: translateY(-40px) rotate(-6deg); opacity: 0; } }
    .n { position: absolute; right: 10px; bottom: 6px; font-size: 11px; color: #5a6470; }
    .opts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; button { padding: 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 700 15px var(--font-mono); cursor: pointer; &:hover { border-color: var(--accent); } } }
    .said { margin: 0; text-align: center; font-weight: 600; font-size: 13px; }
    @media (prefers-reduced-motion: reduce) { .ballot { animation: none; } }
  `,
})
export class DepouillementGameComponent implements OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected mine = 'Dupont';
  protected ballots: string[] = [];
  protected opts: number[] = [];
  protected readonly idx = signal(0);
  protected readonly current = signal('');
  protected readonly phase = signal<'count' | 'answer' | 'end'>('count');
  protected readonly message = signal('');
  private truth = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const pool = [...NAMES].sort(() => Math.random() - 0.5).slice(0, this.diff() >= 1.2 ? 4 : 3);
    this.mine = pool[0];
    const n = 18 + Math.round(this.diff() * 3);
    this.ballots = Array.from({ length: n }, () => (Math.random() < 0.06 ? 'Nul' : Math.random() < 0.42 ? this.mine : pool[1 + Math.floor(Math.random() * (pool.length - 1))]));
    this.truth = this.ballots.filter(b => b === this.mine).length;
    const near = new Set<number>([this.truth]);
    for (const dlt of [-1, 1, -2, 2, 3]) { if (near.size >= 4) break; if (this.truth + dlt >= 0) near.add(this.truth + dlt); }
    this.opts = [...near].sort((a, b) => a - b);
    this.current.set(this.ballots[0]);
    const step = Math.max(550, 1100 - (this.diff() - 1) * 150);
    this.timer = setInterval(() => {
      if (this.idx() + 1 >= this.ballots.length) { if (this.timer) clearInterval(this.timer); this.phase.set('answer'); return; }
      this.idx.update(x => x + 1);
      this.current.set(this.ballots[this.idx()]);
      this.progress.emit({ live: 0, time: 1 - this.idx() / this.ballots.length });
    }, step);
  }

  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }

  protected answer(o: number): void {
    const gap = Math.abs(o - this.truth);
    const r = gap === 0 ? 1 : gap === 1 ? 0.55 : 0.2;
    if (gap) this.miss.emit();
    this.phase.set('end');
    this.message.set(gap === 0 ? `Exactement ${this.truth} voix : votre décompte fait foi, procès-verbal signé.` : `Il y en avait ${this.truth}. ${gap === 1 ? 'Une voix d’écart : on recompte, sans drame.' : 'L’écart est trop grand : le bureau recompte tout, sous les sifflets.'}`);
    this.progress.emit({ live: r, time: 0 });
    setTimeout(() => this.done.emit(r), 2200);
  }
}

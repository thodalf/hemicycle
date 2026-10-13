import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

const ROUNDS = [3, 4, 5, 6, 7];

/** Le protocole : retenir puis reproduire l'ordre des gestes (façon Simon) */
@Component({
  selector: 'app-protocole-game',
  template: `
    <div class="proto">
      <div class="status">
        <span>Séquence {{ round() + 1 }} / {{ rounds.length }} · {{ rounds[round()] }} gestes</span>
        <strong [class.go]="phase() === 'input'">{{ phase() === 'show' ? 'Observez…' : phase() === 'input' ? 'À vous : ' + (pos() + 1) + ' / ' + rounds[round()] : message() }}</strong>
      </div>
      <div class="pads">
        @for (st of steps(); track $index) {
          <button type="button" class="pad" [class.lit]="lit() === $index" [class.bad]="wrong() === $index" [disabled]="phase() !== 'input'" (click)="press($index)">
            <span class="ico" aria-hidden="true">{{ st.icon }}</span><small>{{ st.label }}</small>
          </button>
        }
      </div>
      <ol class="trail" aria-label="Gestes déjà reproduits">
        @for (i of done(); track $index) { <li>{{ steps()[i].icon }}</li> }
      </ol>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .proto { display: grid; gap: 12px; }
    .status { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 13px; align-items: baseline;
      strong { font-size: 14px; } strong.go { color: var(--good); } }
    .pads { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .pad { display: grid; justify-items: center; gap: 4px; padding: 12px 6px; border-radius: 12px; border: 2px solid var(--line); background: var(--surface);
      cursor: pointer; font: inherit; color: var(--ink); transition: transform .12s, background .12s, border-color .12s; min-height: 84px; }
    .pad .ico { font-size: 30px; line-height: 1; } .pad small { font-size: 11.5px; text-align: center; line-height: 1.2; }
    .pad.lit { background: #f4d27a; border-color: #c9a243; transform: scale(1.06); }
    .pad.bad { background: var(--bad-soft); border-color: var(--bad); }
    .pad:disabled { cursor: default; }
    .trail { list-style: none; margin: 0; padding: 0; display: flex; gap: 4px; min-height: 26px; font-size: 20px; }
    @media (prefers-reduced-motion: reduce) { .pad { transition: none; } }
  `,
})
export class ProtocoleGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done$ = output<number>({ alias: 'done' });
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly rounds = ROUNDS;
  protected readonly steps = signal<{ icon: string; label: string }[]>([]);
  protected readonly round = signal(0);
  protected readonly phase = signal<'show' | 'input' | 'pause'>('show');
  protected readonly lit = signal<number | null>(null);
  protected readonly wrong = signal<number | null>(null);
  protected readonly pos = signal(0);
  protected readonly done = signal<number[]>([]);
  protected readonly message = signal('');
  private seq: number[] = [];
  private earned = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private over = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timers.forEach(clearTimeout));
  }

  ngOnInit(): void {
    this.steps.set(this.def().steps ?? []);
    this.play();
  }

  private later(fn: () => void, ms: number): void {
    this.timers.push(setTimeout(fn, ms));
  }

  private total(): number {
    return ROUNDS.reduce((a, b) => a + b, 0);
  }

  /** Montre la séquence du tour */
  private play(): void {
    const n = ROUNDS[this.round()];
    const k = this.steps().length;
    this.seq = Array.from({ length: n }, () => Math.floor(Math.random() * k));
    this.phase.set('show');
    this.pos.set(0);
    this.done.set([]);
    const gap = Math.round(720 / this.diff());
    this.seq.forEach((v, i) => {
      this.later(() => this.lit.set(v), 500 + i * gap);
      this.later(() => this.lit.set(null), 500 + i * gap + gap * 0.65);
    });
    this.later(() => this.phase.set('input'), 500 + n * gap);
    this.progress.emit({ live: this.earned / this.total(), time: 1 - this.round() / ROUNDS.length });
  }

  protected press(i: number): void {
    if (this.phase() !== 'input' || this.over) return;
    this.lit.set(i);
    this.later(() => this.lit.set(null), 180);
    if (this.seq[this.pos()] !== i) {
      this.wrong.set(i);
      this.miss.emit();
      this.message.set('Faux pas protocolaire !');
      this.phase.set('pause');
      this.later(() => { this.wrong.set(null); this.next(); }, 900);
      return;
    }
    this.done.update(l => [...l, i]);
    this.pos.update(p => p + 1);
    if (this.pos() >= this.seq.length) {
      this.earned += this.seq.length;
      this.message.set('Impeccable !');
      this.phase.set('pause');
      this.progress.emit({ live: this.earned / this.total(), time: 1 - (this.round() + 1) / ROUNDS.length });
      this.later(() => this.next(), 700);
    }
  }

  private next(): void {
    if (this.round() + 1 >= ROUNDS.length) {
      this.over = true;
      const score = this.earned / this.total();
      this.progress.emit({ live: score, time: 0 });
      this.later(() => this.done$.emit(score), 500);
      return;
    }
    this.round.update(r => r + 1);
    this.play();
  }
}

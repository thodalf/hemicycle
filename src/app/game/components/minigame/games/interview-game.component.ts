import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';
import { INTERVIEW_MOVES, INTERVIEW_QUESTIONS, InterviewMove, InterviewQuestion } from '../../../data/interview';

const COUNT = 6;

/** Interview piège en direct : une question, trois postures, un compte à rebours */
@Component({
  selector: 'app-interview-game',
  template: `
    <div class="iv">
      <div class="onair"><i></i> En direct · question {{ index() + 1 }} / {{ count }}</div>
      @if (cur(); as q) {
        <p class="q">« {{ q.q }} »</p>
        <div class="fuse"><span [style.width.%]="left() * 100" [class.hot]="left() < 0.35"></span></div>
        <div class="moves">
          @for (m of moves; track m.id; let i = $index) {
            <button type="button" class="mv" [disabled]="picked() !== null"
              [class.right]="picked() !== null && m.id === q.best" [class.ok]="picked() === m.id && m.id === q.ok" [class.wrong]="picked() === m.id && m.id !== q.best && m.id !== q.ok"
              (click)="pick(m.id)"><span class="ico">{{ m.icon }}</span>{{ m.label }}<i class="mono">{{ i + 1 }}</i></button>
          }
        </div>
        @if (picked() !== null) { <p class="why" aria-live="polite">{{ feedback() }} {{ q.why }}</p> }
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .iv { display: grid; gap: 10px; }
    .onair { display: inline-flex; gap: 6px; align-items: center; font: 700 11px var(--font-body); text-transform: uppercase; letter-spacing: .08em; color: var(--bad);
      i { width: 8px; height: 8px; border-radius: 50%; background: var(--bad); animation: blink 1s steps(2) infinite; } }
    @keyframes blink { 50% { opacity: .2; } }
    .q { margin: 0; font: 600 18px/1.35 var(--font-display); }
    .fuse { height: 5px; border-radius: 3px; background: var(--surface-2); overflow: hidden; span { display: block; height: 100%; background: var(--accent); transition: width .1s linear; } span.hot { background: var(--bad); } }
    .moves { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .mv { display: grid; justify-items: center; gap: 4px; padding: 12px 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink);
      font: 600 13px var(--font-body); cursor: pointer; min-height: 72px; position: relative;
      .ico { font-size: 20px; } i { position: absolute; top: 4px; right: 6px; font-style: normal; font-size: 10px; color: var(--ink-3); } }
    .mv:hover:not(:disabled) { border-color: var(--accent); }
    .mv.right { background: var(--good-soft); border-color: var(--good); color: var(--good); }
    .mv.ok { background: color-mix(in srgb, var(--warn) 18%, var(--surface)); border-color: var(--warn); }
    .mv.wrong { background: #fbe4e1; border-color: var(--bad); color: var(--bad); }
    .why { margin: 0; font-size: 13px; color: var(--ink-2); }
    @media (max-width: 520px) { .moves { grid-template-columns: 1fr; } .mv { min-height: 48px; grid-auto-flow: column; justify-content: start; } }
    @media (prefers-reduced-motion: reduce) { .onair i { animation: none; } }
  `,
  host: { '(window:keydown)': 'key($event)' },
})
export class InterviewGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly moves = INTERVIEW_MOVES;
  protected readonly count = COUNT;
  private readonly questions: InterviewQuestion[] = [...INTERVIEW_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, COUNT);
  protected readonly index = signal(0);
  protected readonly cur = signal<InterviewQuestion | null>(this.questions[0]);
  protected readonly picked = signal<InterviewMove | 'temps' | null>(null);
  protected readonly left = signal(1);
  protected readonly feedback = signal('');
  private points = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private wait: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => { if (this.timer) clearInterval(this.timer); if (this.wait) clearTimeout(this.wait); });
    setTimeout(() => this.startClock(), 0);
  }

  private startClock(): void {
    const total = Math.max(3500, 7000 / this.diff());
    const t0 = Date.now();
    this.left.set(1);
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      const l = 1 - (Date.now() - t0) / total;
      this.left.set(Math.max(0, l));
      if (l <= 0) this.pick('temps');
    }, 100);
  }

  protected key(e: KeyboardEvent): void {
    const i = Number(e.key) - 1;
    if (i >= 0 && i < 3) this.pick(INTERVIEW_MOVES[i].id);
  }

  protected pick(m: InterviewMove | 'temps'): void {
    const q = this.cur();
    if (!q || this.picked() !== null) return;
    if (this.timer) clearInterval(this.timer);
    this.picked.set(m);
    if (m === q.best) { this.points += 1; this.feedback.set('Bien joué.'); }
    else if (m === q.ok) { this.points += 0.4; this.feedback.set('Ça passe, sans plus.'); }
    else { this.feedback.set(m === 'temps' ? 'Blanc à l’antenne…' : 'Mauvaise posture.'); this.miss.emit(); }
    this.progress.emit({ live: this.points / COUNT, time: (this.index() + 1) / COUNT });
    this.wait = setTimeout(() => this.next(), 1700);
  }

  private next(): void {
    const i = this.index() + 1;
    if (i >= COUNT) { this.cur.set(null); this.done.emit(this.points / COUNT); return; }
    this.index.set(i);
    this.cur.set(this.questions[i]);
    this.picked.set(null);
    this.startClock();
  }
}

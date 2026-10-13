import { Component, DestroyRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';
import { QUIZ_CATEGORIES, QUIZ_QUESTIONS, QuizCategory } from '../../../data/quiz';

const MAX_Q = 9;

/** Mélange de Fisher-Yates (un tri aléatoire laisse souvent la bonne réponse en tête) */
function shuffle<T>(list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Asked { cat: QuizCategory; q: string; options: string[]; answer: string }

/** Trivial politique : six camemberts, neuf questions au plus (façon Trivial Pursuit) */
@Component({
  selector: 'app-quiz-game',
  template: `
    <div class="quiz">
      <div class="top">
        <svg class="pie" viewBox="0 0 100 100" role="img" [attr.aria-label]="won().size + ' camembert(s) sur 6'">
          <circle cx="50" cy="50" r="48" class="rim" />
          @for (c of cats; track c.id; let i = $index) {
            <path [attr.d]="wedge(i)" [attr.fill]="won().has(c.id) ? c.color : 'var(--surface-2)'" [class.got]="won().has(c.id)" />
          }
          <circle cx="50" cy="50" r="9" class="hub" />
        </svg>
        <div class="legend">
          @for (c of cats; track c.id) {
            <span [class.got]="won().has(c.id)"><i [style.background]="c.color"></i>{{ c.label }}</span>
          }
        </div>
      </div>
      <div class="count mono">Question {{ asked() }} / {{ maxQ }}</div>

      @if (step() === 'roll') {
        <div class="die" [style.background]="rolling()?.color" aria-live="polite">
          <span>{{ rolling()?.icon }}</span><small>{{ rolling()?.label }}</small>
        </div>
      } @else if (cur(); as c) {
        <div class="qcard" [style.--cat]="c.cat.color">
          <span class="tag">{{ c.cat.icon }} {{ c.cat.label }}</span>
          <p class="q">{{ c.q }}</p>
          <div class="fuse"><span [style.width.%]="qLeft() * 100"></span></div>
          <div class="opts">
            @for (o of c.options; track o; let i = $index) {
              <button type="button" class="opt" [class.right]="picked() !== null && o === c.answer" [class.wrong]="picked() === o && o !== c.answer"
                [disabled]="picked() !== null" (click)="answer(o)"><i class="mono">{{ i + 1 }}</i>{{ o }}</button>
            }
          </div>
        </div>
      }
      @if (message()) { <p class="said" aria-live="polite">{{ message() }}</p> }
    </div>
  `,
  styles: `
    .quiz { display: grid; gap: 10px; }
    .top { display: flex; gap: 14px; align-items: center; }
    .pie { width: 96px; height: 96px; flex: none; }
    .pie .rim { fill: none; stroke: var(--ink-3); stroke-width: 2; }
    .pie path { stroke: var(--surface); stroke-width: 1.5; transition: fill .4s; }
    .pie path.got { animation: got .6s ease; transform-origin: 50px 50px; }
    @keyframes got { 40% { transform: scale(1.08); } }
    .pie .hub { fill: var(--surface); stroke: var(--ink-3); stroke-width: 1.5; }
    .legend { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 10px; font-size: 12px; color: var(--ink-3);
      span { display: flex; align-items: center; gap: 5px; } span.got { color: var(--ink); font-weight: 600; }
      i { width: 9px; height: 9px; border-radius: 2px; flex: none; } }
    .count { font-size: 12px; color: var(--ink-3); }
    .die { justify-self: center; width: 120px; height: 120px; border-radius: 18px; display: grid; place-content: center; justify-items: center; gap: 4px;
      color: #fff; box-shadow: 0 6px 18px rgba(0,0,0,.18); animation: spin .18s linear infinite; transition: background .1s;
      span { font-size: 40px; } small { font-weight: 600; font-size: 12px; text-align: center; padding: 0 6px; } }
    @keyframes spin { 50% { transform: rotate(8deg) scale(1.04); } }
    .qcard { display: grid; gap: 10px; border-left: 5px solid var(--cat); padding: 4px 0 4px 12px; animation: slide .3s ease; }
    @keyframes slide { from { opacity: 0; transform: translateY(8px); } }
    .tag { font-size: 12px; font-weight: 700; color: var(--cat); text-transform: uppercase; letter-spacing: .04em; }
    .q { margin: 0; font: 600 17px/1.35 var(--font-body); }
    .fuse { height: 4px; border-radius: 2px; background: var(--surface-2); overflow: hidden; span { display: block; height: 100%; background: var(--cat); } }
    .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .opt { display: flex; gap: 8px; align-items: center; text-align: left; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px;
      background: var(--surface); color: var(--ink); font: 14px var(--font-body); cursor: pointer; min-height: 48px;
      i { font-style: normal; font-size: 11px; color: var(--ink-3); } }
    .opt:hover:not(:disabled) { border-color: var(--cat); }
    .opt.right { background: var(--good-soft); border-color: var(--good); color: var(--good); font-weight: 600; }
    .opt.wrong { background: #fbe4e1; border-color: var(--bad); color: var(--bad); }
    .opt:disabled { cursor: default; }
    .said { margin: 0; text-align: center; font-weight: 600; font-size: 13px; }
    @media (max-width: 520px) { .opts { grid-template-columns: 1fr; } .legend { font-size: 11px; } .pie { width: 80px; height: 80px; } }
    @media (prefers-reduced-motion: reduce) { .die, .qcard, .pie path { animation: none !important; } }
  `,
})
export class QuizGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected cats: QuizCategory[] = QUIZ_CATEGORIES;
  protected readonly maxQ = MAX_Q;
  protected readonly won = signal<Set<string>>(new Set());
  protected readonly step = signal<'roll' | 'ask'>('roll');
  protected readonly rolling = signal<QuizCategory | null>(null);
  protected readonly cur = signal<Asked | null>(null);
  protected readonly picked = signal<string | null>(null);
  protected readonly asked = signal(0);
  protected readonly qLeft = signal(1);
  protected readonly message = signal('');
  private pool: Record<string, typeof QUIZ_QUESTIONS> = {};
  private timer: ReturnType<typeof setInterval> | null = null;
  private timeouts: ReturnType<typeof setTimeout>[] = [];
  private over = false;
  private spin: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => { if (this.timer) clearInterval(this.timer); if (this.spin) clearInterval(this.spin); this.timeouts.forEach(clearTimeout); });
  }

  ngOnInit(): void {
    const only = this.def().cats;
    if (only?.length) this.cats = QUIZ_CATEGORIES.filter(c => only.includes(c.id));
    for (const c of this.cats) this.pool[c.id] = shuffle(QUIZ_QUESTIONS.filter(q => q.cat === c.id));
    this.roll();
  }

  protected wedge(i: number): string {
    const n = this.cats.length;
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;
    const p = (a: number) => `${(50 + 46 * Math.cos(a)).toFixed(2)} ${(50 + 46 * Math.sin(a)).toFixed(2)}`;
    return `M50 50 L${p(a0)} A46 46 0 0 1 ${p(a1)} Z`;
  }

  private later(fn: () => void, ms: number): void {
    this.timeouts.push(setTimeout(fn, ms));
  }

  private emit(): void {
    this.progress.emit({ live: this.won().size / this.cats.length, time: 1 - this.asked() / MAX_Q });
  }

  /** Le dé tourne parmi les couleurs encore à gagner */
  private roll(): void {
    if (this.over) return;
    this.step.set('roll');
    this.picked.set(null);
    this.message.set('');
    const open = this.cats.filter(c => !this.won().has(c.id) && this.pool[c.id]?.length);
    if (!open.length) { this.finish(); return; }
    const target = open[Math.floor(Math.random() * open.length)];
    let k = 0;
    this.spin = setInterval(() => { this.rolling.set(open[k++ % open.length]); }, 110);
    this.later(() => { if (this.spin) clearInterval(this.spin); this.spin = null; this.rolling.set(target); this.later(() => this.ask(target), 450); }, 900);
  }

  private ask(cat: QuizCategory): void {
    if (this.over) return;
    const q = this.pool[cat.id].shift()!;
    this.asked.update(n => n + 1);
    this.cur.set({ cat, q: q.q.replace(/ ([?!:;])/g, '\u00a0$1'), answer: q.a[0], options: shuffle(q.a) });
    this.step.set('ask');
    this.emit();
    const limit = 16000 / this.diff();
    const t0 = performance.now();
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      const left = 1 - (performance.now() - t0) / limit;
      this.qLeft.set(Math.max(0, left));
      if (left <= 0) this.answer(null);
    }, 100);
  }

  protected answer(o: string | null): void {
    const c = this.cur();
    if (this.over || !c || this.picked() !== null || this.step() !== 'ask') return;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.picked.set(o ?? '');
    const ok = o === c.answer;
    if (ok) {
      this.won.update(s => new Set([...s, c.cat.id]));
      this.message.set(`Camembert ${c.cat.label} !`);
    } else {
      this.miss.emit();
      this.message.set(o === null ? `Trop tard ! C’était : ${c.answer}.` : `Raté : c’était ${c.answer}.`);
    }
    this.emit();
    this.later(() => {
      if (this.won().size >= this.cats.length || this.asked() >= MAX_Q) this.finish();
      else this.roll();
    }, ok ? 1100 : 1900);
  }

  private finish(): void {
    if (this.over) return;
    this.over = true;
    const score = this.won().size / this.cats.length;
    this.message.set(score === 1 ? 'Six camemberts : partie gagnée !' : `${this.won().size} camembert(s) sur ${this.cats.length}.`);
    this.progress.emit({ live: score, time: 0 });
    this.later(() => this.done.emit(score), 1200);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    const c = this.cur();
    if (this.step() !== 'ask' || !c || !/^[1-4]$/.test(e.key)) return;
    e.preventDefault();
    this.answer(c.options[Number(e.key) - 1]);
  }
}

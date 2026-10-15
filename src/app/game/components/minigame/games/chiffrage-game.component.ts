import { Component, OnDestroy, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Q { text: string; answer: number; unit: string; opts: number[] }

const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** Des questions de chiffrage, tirées au hasard : la bonne réponse et trois leurres plausibles */
function makeQuestion(): Q {
  const kind = Math.floor(Math.random() * 5);
  let text = '', answer = 0, unit = '';
  if (kind === 0) {
    const per = rnd([10, 12, 15, 20, 25, 50]), pop = rnd([2, 3, 4, 6, 8]);
    text = `Une prime de ${per} € par habitant pour ${pop} millions d’habitants : combien ça coûte ?`; answer = per * pop; unit = 'M€';
  } else if (kind === 1) {
    const budget = rnd([200, 400, 600, 800, 1200]), pct = rnd([5, 10, 15, 20, 25]);
    text = `Raboter de ${pct} % un budget de ${budget} millions d’euros : combien d’économies ?`; answer = budget * pct / 100; unit = 'M€';
  } else if (kind === 2) {
    const n = rnd([120, 240, 300, 480, 600]), cost = rnd([2, 3, 4, 5]);
    text = `${n} écoles à rénover, ${cost} millions d’euros chacune : quel total ?`; answer = n * cost; unit = 'M€';
  } else if (kind === 3) {
    const voters = rnd([40000, 60000, 80000, 120000]), pct = rnd([35, 42, 48, 55]);
    text = `${fmt(voters)} votants, vous obtenez ${pct} % : combien de voix ?`; answer = voters * pct / 100; unit = 'voix';
  } else {
    const before = rnd([8, 9, 10, 12]), after = before - rnd([1, 2, 3]);
    text = `Le chômage passe de ${before} % à ${after} % : de combien de pour cent a-t-il baissé (en relatif) ?`; answer = Math.round((before - after) / before * 1000) / 10; unit = '%';
  }
  const lures = new Set<number>();
  for (const f of [0.1, 10, 0.5, 2, 1.5, 0.75]) { if (lures.size >= 3) break; const v = Math.round(answer * f * 10) / 10; if (v !== answer && v > 0) lures.add(v); }
  return { text, answer, unit, opts: [answer, ...lures].sort(() => Math.random() - 0.5) };
}

/** Le chiffrage : vérifier de tête les chiffres d'une mesure avant de les annoncer */
@Component({
  selector: 'app-chiffrage-game',
  template: `
    <div class="cf">
      @if (!over()) {
        <div class="top"><span class="mono">{{ i() + 1 }} / {{ qs.length }}</span><span class="timer"><i [style.width.%]="left() * 100"></i></span><span class="mono">✔ {{ score() }}</span></div>
        @if (qs[i()]; as q) {
          <div class="card"><span class="ic">🧮</span><p>{{ q.text }}</p></div>
          <div class="opts">
            @for (o of q.opts; track o) {
              <button type="button" [class.ok]="shown() && o === q.answer" [class.ko]="shown()?.pick === o && o !== q.answer" [disabled]="!!shown()" (click)="pick(o)">{{ fmt(o) }} {{ q.unit }}</button>
            }
          </div>
          @if (shown(); as s) { <p class="why" [class.good]="s.pick === q.answer">{{ s.pick === q.answer ? 'Juste : le chiffre tient la route.' : 'Faux : c’était ' + fmt(q.answer) + ' ' + q.unit + '. L’opposition va s’en donner à cœur joie.' }}</p> }
        }
      } @else { <p class="said">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .cf { display: grid; gap: 10px; }
    .top { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; font-size: 12.5px; }
    .timer { height: 7px; border-radius: 4px; background: var(--line); overflow: hidden; i { display: block; height: 100%; background: var(--accent); transition: width .1s linear; } }
    .card { display: flex; gap: 12px; align-items: center; padding: 14px 16px; border-radius: 14px; background: var(--surface-2); animation: in .3s ease;
      .ic { font-size: 28px; } p { margin: 0; font: 600 15px var(--font-body); } }
    @keyframes in { from { opacity: 0; transform: translateY(6px); } }
    .opts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;
      button { padding: 12px 8px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 700 15px var(--font-mono); cursor: pointer;
        &:not(:disabled):hover { border-color: var(--accent); } &.ok { background: var(--good-soft); border-color: var(--good); } &.ko { background: var(--bad-soft); border-color: var(--bad); } } }
    .why { margin: 0; padding: 8px 10px; border-radius: 8px; font-size: 13px; background: var(--bad-soft); &.good { background: var(--good-soft); } }
    .said { margin: 0; text-align: center; font-weight: 600; font-size: 13px; }
    @media (prefers-reduced-motion: reduce) { .card { animation: none; } }
  `,
})
export class ChiffrageGameComponent implements OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly fmt = fmt;
  protected qs: Q[] = [];
  protected readonly i = signal(0);
  protected readonly score = signal(0);
  protected readonly left = signal(1);
  protected readonly shown = signal<{ pick: number } | null>(null);
  protected readonly over = signal(false);
  protected readonly message = signal('');
  private timer: ReturnType<typeof setInterval> | null = null;
  private duration = 12000;

  ngOnInit(): void {
    this.qs = Array.from({ length: 5 }, makeQuestion);
    this.duration = Math.max(6000, 13000 - (this.diff() - 1) * 2000);
    this.clock();
  }

  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }

  private clock(): void {
    if (this.timer) clearInterval(this.timer);
    const t0 = Date.now();
    this.left.set(1);
    this.timer = setInterval(() => {
      const l = 1 - (Date.now() - t0) / this.duration;
      this.left.set(Math.max(0, l));
      if (l <= 0) this.pick(NaN);
    }, 100);
  }

  protected pick(o: number): void {
    if (this.shown() || this.over()) return;
    if (this.timer) clearInterval(this.timer);
    const ok = o === this.qs[this.i()].answer;
    if (ok) this.score.update(x => x + 1); else this.miss.emit();
    this.shown.set({ pick: o });
    this.progress.emit({ live: this.score() / this.qs.length, time: 1 - (this.i() + 1) / this.qs.length });
    setTimeout(() => {
      this.shown.set(null);
      if (this.i() + 1 >= this.qs.length) return this.finish();
      this.i.update(x => x + 1);
      this.clock();
    }, ok ? 1000 : 2200);
  }

  private finish(): void {
    this.over.set(true);
    const r = this.score() / this.qs.length;
    this.message.set(r === 1 ? 'Des chiffres imparables : même les économistes de l’opposition s’inclinent.' : r >= 0.6 ? 'Un chiffrage solide, malgré une approximation.' : 'Des chiffres fantaisistes : les vérificateurs s’en donnent à cœur joie.');
    this.progress.emit({ live: r, time: 0 });
    setTimeout(() => this.done.emit(Math.max(0.1, r)), 2000);
  }
}

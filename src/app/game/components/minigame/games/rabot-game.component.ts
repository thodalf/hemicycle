import { Component, OnDestroy, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Line { label: string; icon: string; amount: number; anger: number }

const LINES: Line[] = [
  { label: 'Voitures de fonction', icon: '🚗', amount: 1, anger: 0 },
  { label: 'Réceptions officielles', icon: '🥂', amount: 1, anger: 0 },
  { label: 'Subventions aux festivals', icon: '🎭', amount: 2, anger: 2 },
  { label: 'Entretien des routes', icon: '🛣️', amount: 4, anger: 3 },
  { label: 'Aides aux associations', icon: '🤝', amount: 3, anger: 3 },
  { label: 'Postes d’enseignants', icon: '🏫', amount: 6, anger: 6 },
  { label: 'Hôpitaux de proximité', icon: '🏥', amount: 7, anger: 8 },
  { label: 'Conseil en communication', icon: '📣', amount: 2, anger: 0 },
  { label: 'Primes des hauts fonctionnaires', icon: '💼', amount: 3, anger: 1 },
  { label: 'Bourses étudiantes', icon: '🎓', amount: 4, anger: 5 },
  { label: 'Rénovation des gymnases', icon: '🏀', amount: 3, anger: 2 },
  { label: 'Sondages commandés', icon: '📊', amount: 1, anger: 0 },
  { label: 'Transports scolaires', icon: '🚌', amount: 5, anger: 5 },
  { label: 'Police municipale', icon: '👮', amount: 4, anger: 4 },
];

/** Le coup de rabot : trouver les économies demandées en fâchant le moins de monde possible */
@Component({
  selector: 'app-rabot-game',
  template: `
    <div class="rb">
      <p class="hint">@if (!over()) { Bercy exige <b>{{ target }} milliards</b> d’économies. Choisissez les lignes à raboter : chaque coupe a un coût politique. } @else { {{ message() }} }</p>
      <div class="meters">
        <div class="m"><span>Économies</span><i><em [class.ok]="saved() >= target" [style.width.%]="Math.min(100, saved() / target * 100)"></em></i><b class="mono">{{ saved() }} / {{ target }} Md</b></div>
        <div class="m anger"><span>Colère</span><i><em [style.width.%]="Math.min(100, anger() * 4)"></em></i><b class="mono">{{ anger() }}</b></div>
      </div>
      <div class="lines">
        @for (l of lines; track l.label; let k = $index) {
          <button type="button" class="line" [class.cut]="picked().has(k)" [disabled]="over()" (click)="toggle(k)">
            <span class="ic">{{ l.icon }}</span><span class="lb">{{ l.label }}</span>
            <span class="am mono">−{{ l.amount }} Md</span>
            <span class="an">@for (x of dots(l.anger); track $index) { <i></i> } @empty { <small>indolore</small> }</span>
          </button>
        }
      </div>
      @if (!over()) {
        <div class="foot"><span class="timer"><i [style.width.%]="left() * 100"></i></span>
          <button class="btn primary small" [disabled]="saved() < target" (click)="finish()">Présenter le budget</button></div>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .rb { display: grid; gap: 10px; }
    .hint { margin: 0; font-size: 12.5px; color: var(--ink-2); }
    .meters { display: grid; gap: 6px; }
    .m { display: grid; grid-template-columns: 74px 1fr 78px; gap: 8px; align-items: center; font-size: 12.5px;
      i { height: 9px; border-radius: 5px; background: var(--line); overflow: hidden; } em { display: block; height: 100%; background: var(--accent); transition: width .25s ease; &.ok { background: var(--good); } } b { text-align: right; } }
    .m.anger em { background: var(--bad); }
    .lines { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 6px; }
    .line { display: grid; grid-template-columns: 26px 1fr auto; grid-template-rows: auto auto; gap: 0 6px; align-items: center; text-align: left; padding: 8px 10px; border-radius: 10px;
      border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 13px var(--font-body); cursor: pointer; transition: transform .12s ease, background .2s ease;
      .ic { grid-row: span 2; font-size: 18px; } .am { font-weight: 700; font-size: 12px; } .an { grid-column: 2 / 4; display: flex; gap: 2px; align-items: center; min-height: 10px;
        i { width: 6px; height: 6px; border-radius: 50%; background: var(--bad); opacity: .7; } small { font-size: 10.5px; color: var(--good); } }
      &:not(:disabled):hover { border-color: var(--ink-3); } &:not(:disabled):active { transform: scale(.97); }
      &.cut { background: color-mix(in srgb, var(--bad) 10%, var(--surface)); border-color: var(--bad); .lb { text-decoration: line-through; text-decoration-color: var(--bad); } } }
    .foot { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .timer { height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; i { display: block; height: 100%; background: var(--accent); transition: width .2s linear; } }
  `,
})
export class RabotGameComponent implements OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly Math = Math;
  protected lines: Line[] = [];
  protected target = 10;
  protected readonly picked = signal<Set<number>>(new Set());
  protected readonly left = signal(1);
  protected readonly over = signal(false);
  protected readonly message = signal('');
  protected readonly saved = computed(() => [...this.picked()].reduce((t, k) => t + this.lines[k].amount, 0));
  protected readonly anger = computed(() => [...this.picked()].reduce((t, k) => t + this.lines[k].anger, 0));
  private best = 1;
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.lines = [...LINES].sort(() => Math.random() - 0.5).slice(0, 9);
    const sum = this.lines.reduce((t, l) => t + l.amount, 0);
    this.target = Math.max(6, Math.round(sum * (0.38 + this.diff() * 0.06)));
    this.best = this.bestAnger();
    const total = Math.max(20000, 45000 - (this.diff() - 1) * 8000), t0 = Date.now();
    this.timer = setInterval(() => {
      const l = 1 - (Date.now() - t0) / total;
      this.left.set(Math.max(0, l));
      this.progress.emit({ live: this.saved() >= this.target ? this.ratio() : 0, time: Math.max(0, l) });
      if (l <= 0) this.finish();
    }, 200);
  }

  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }

  protected dots(n: number): number[] { return Array.from({ length: n }); }

  /** La colère minimale pour atteindre l'objectif (recherche exhaustive : 2⁹ combinaisons) */
  private bestAnger(): number {
    let best = Infinity;
    const n = this.lines.length;
    for (let m = 1; m < 1 << n; m++) {
      let s = 0, a = 0;
      for (let k = 0; k < n; k++) if (m & (1 << k)) { s += this.lines[k].amount; a += this.lines[k].anger; }
      if (s >= this.target && a < best) best = a;
    }
    return best === Infinity ? 1 : best;
  }

  private ratio(): number { return Math.min(1, (this.best + 2) / (this.anger() + 2)); }

  protected toggle(k: number): void {
    if (this.over()) return;
    const p = new Set(this.picked());
    if (p.has(k)) p.delete(k); else p.add(k);
    this.picked.set(p);
  }

  protected finish(): void {
    if (this.over()) return;
    if (this.timer) clearInterval(this.timer);
    this.over.set(true);
    const reached = this.saved() >= this.target;
    const r = reached ? this.ratio() : 0.1;
    if (r < 1) this.miss.emit();
    this.message.set(!reached ? 'Le compte n’y est pas : Bercy renvoie votre copie.' : this.anger() <= this.best ? 'Le budget parfait : les économies sont là, et presque personne ne crie.' : r >= 0.6 ? 'Les économies sont là. Quelques manifestations, mais rien d’ingérable.' : 'Le compte y est… mais vous avez fâché tout le pays.');
    this.progress.emit({ live: r, time: 0 });
    setTimeout(() => this.done.emit(Math.max(0.1, r)), 2000);
  }
}

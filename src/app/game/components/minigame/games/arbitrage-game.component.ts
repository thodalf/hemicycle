import { Component, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Line { id: string; icon: string; label: string; min: number; wish: number; minister: string }

const POOL: Line[] = [
  { id: 'ecoles', icon: '🏫', label: 'Écoles', min: 15, wish: 30, minister: 'La ministre de l’Éducation menace de démissionner sous 15.' },
  { id: 'hopital', icon: '🏥', label: 'Hôpitaux', min: 20, wish: 35, minister: 'Les soignants descendent dans la rue sous 20.' },
  { id: 'police', icon: '🚓', label: 'Sécurité', min: 10, wish: 25, minister: 'Les syndicats de police montent au créneau sous 10.' },
  { id: 'routes', icon: '🛣️', label: 'Routes et transports', min: 10, wish: 20, minister: 'Les élus ruraux s’insurgent sous 10.' },
  { id: 'culture', icon: '🎭', label: 'Culture', min: 5, wish: 15, minister: 'Les théâtres ferment sous 5.' },
  { id: 'ecologie', icon: '🌳', label: 'Transition écologique', min: 10, wish: 25, minister: 'Les associations attaquent l’État en justice sous 10.' },
  { id: 'social', icon: '🤝', label: 'Solidarités', min: 15, wish: 30, minister: 'Les associations caritatives alertent sous 15.' },
  { id: 'recherche', icon: '🔬', label: 'Recherche', min: 5, wish: 15, minister: 'Les chercheurs s’exilent sous 5.' },
];

/** L'arbitrage budgétaire : une enveloppe à partager, des planchers à respecter, des souhaits à approcher */
@Component({
  selector: 'app-arbitrage-game',
  template: `
    <div class="arb">
      <div class="env" [class.over]="left() < 0" [class.zero]="left() === 0">
        <span>Enveloppe : <b class="mono">{{ budget }} Md€</b></span>
        <span>Reste : <b class="mono">{{ left() }} Md€</b></span>
      </div>
      <ul>
        @for (l of lines; track l.id; let i = $index) {
          @let v = alloc()[i];
          <li [class.low]="v < l.min" [class.ok]="v >= l.min && v < l.wish" [class.full]="v >= l.wish">
            <span class="lbl">{{ l.icon }} {{ l.label }} <small class="muted">plancher {{ l.min }} · souhait {{ l.wish }}</small></span>
            <span class="ctl">
              <button type="button" (click)="step(i, -5)" [disabled]="over() || v <= 0" aria-label="Moins">−</button>
              <b class="mono">{{ v }}</b>
              <button type="button" (click)="step(i, 5)" [disabled]="over() || left() < 5" aria-label="Plus">+</button>
            </span>
            <span class="bar"><i [style.width.%]="(v / l.wish) * 100"></i><em [style.left.%]="(l.min / l.wish) * 100"></em></span>
            @if (v < l.min && !over()) { <small class="warn">{{ l.minister }}</small> }
          </li>
        }
      </ul>
      @if (!over()) { <button class="btn primary small" [disabled]="left() < 0" (click)="finish()">Rendre l’arbitrage</button> }
      @else { <p class="said">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .arb { display: grid; gap: 10px; }
    .env { display: flex; justify-content: space-between; gap: 8px; padding: 8px 12px; border-radius: 10px; background: #1f3a5f; color: #fff; font-size: 13px;
      &.zero { background: var(--good); } &.over { background: var(--bad); } }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    li { display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); transition: border-color .2s ease;
      &.low { border-color: var(--bad); } &.full { border-color: var(--good); } }
    .lbl { font-size: 13px; font-weight: 600; small { font-weight: 400; font-size: 11px; } }
    .ctl { display: inline-flex; align-items: center; gap: 6px; button { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink); font-size: 15px; cursor: pointer; } b { min-width: 24px; text-align: center; } }
    .bar { grid-column: 1 / -1; position: relative; height: 6px; border-radius: 3px; background: var(--line);
      i { display: block; height: 100%; max-width: 100%; border-radius: 3px; background: var(--accent); transition: width .25s ease; }
      em { position: absolute; top: -3px; width: 2px; height: 12px; background: var(--bad); } }
    li.full .bar i { background: var(--good); }
    .warn { grid-column: 1 / -1; color: var(--bad); font-size: 11.5px; }
    .said { margin: 0; text-align: center; font-weight: 600; font-size: 13px; }
  `,
})
export class ArbitrageGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected lines: Line[] = [];
  protected budget = 100;
  protected readonly alloc = signal<number[]>([]);
  protected readonly over = signal(false);
  protected readonly message = signal('');
  protected readonly left = computed(() => this.budget - this.alloc().reduce((t, v) => t + v, 0));

  ngOnInit(): void {
    this.lines = [...POOL].sort(() => Math.random() - 0.5).slice(0, 5);
    const mins = this.lines.reduce((t, l) => t + l.min, 0), wishes = this.lines.reduce((t, l) => t + l.wish, 0);
    // Assez pour tous les planchers, jamais pour tous les souhaits ; plus serré quand c'est difficile
    const slack = Math.max(0.25, 0.6 - (this.diff() - 1) * 0.12);
    this.budget = Math.round((mins + (wishes - mins) * slack) / 5) * 5;
    this.alloc.set(this.lines.map(() => 0));
  }

  protected step(i: number, d: number): void {
    if (this.over()) return;
    const a = [...this.alloc()];
    a[i] = Math.max(0, a[i] + d);
    if (this.budget - a.reduce((t, v) => t + v, 0) < 0) return;
    this.alloc.set(a);
    this.progress.emit({ live: this.score(), time: Math.max(0, this.left() / this.budget) });
  }

  /** Chaque ligne : 0 sous le plancher, puis de 0,5 à 1 en approchant du souhait */
  private score(): number {
    const a = this.alloc();
    const per = this.lines.map((l, i) => (a[i] < l.min ? 0 : 0.5 + 0.5 * Math.min(1, (a[i] - l.min) / Math.max(1, l.wish - l.min))));
    const best = this.bestScore();
    return Math.min(1, per.reduce((t, v) => t + v, 0) / best);
  }

  /** Le meilleur arbitrage possible : tous les planchers, puis le reste là où il rapporte le plus */
  private bestScore(): number {
    let rest = this.budget - this.lines.reduce((t, l) => t + l.min, 0);
    const gains = this.lines.map(l => ({ need: l.wish - l.min, rate: 0.5 / Math.max(1, l.wish - l.min) })).sort((x, y) => y.rate - x.rate);
    let s = this.lines.length * 0.5;
    for (const g of gains) { const take = Math.min(rest, g.need); s += take * g.rate; rest -= take; }
    return s;
  }

  protected finish(): void {
    if (this.over()) return;
    this.over.set(true);
    const r = this.score();
    const broken = this.lines.filter((l, i) => this.alloc()[i] < l.min).length;
    if (broken) this.miss.emit();
    this.message.set(broken ? `${broken} ministère${broken > 1 ? 's' : ''} sous le plancher : la crise éclate dès le lendemain.` : r >= 0.95 ? 'Un arbitrage d’orfèvre : chacun repart avec l’essentiel.' : 'Personne n’est ravi, mais personne ne claque la porte.');
    this.progress.emit({ live: r, time: 0 });
    setTimeout(() => this.done.emit(Math.max(0.1, broken ? r * 0.5 : r)), 2000);
  }
}

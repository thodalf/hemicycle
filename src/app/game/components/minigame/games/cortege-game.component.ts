import { Component, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

type Cell = 'road' | 'works' | 'demo' | 'park';
interface Pos { r: number; c: number }

const N = 7;
const key = (p: Pos) => `${p.r},${p.c}`;

/** Le cortège : traverser la ville jusqu'au rendez-vous, entre travaux et manifestations qui se déplacent */
@Component({
  selector: 'app-cortege-game',
  template: `
    <div class="cortege">
      <div class="status">
        <span>⏱️ <b class="mono">{{ movesLeft() }}</b> min</span>
        <span class="muted">{{ hint() }}</span>
        <span>🏁 {{ dest }}</span>
      </div>
      <div class="grid" [style.--n]="n" role="grid" aria-label="Plan de la ville">
        @for (row of rows(); track $index; let r = $index) {
          @for (cell of row; track $index; let c = $index) {
            @let here = car().r === r && car().c === c;
            @let goal = r === 0 && c === n - 1;
            <button type="button" class="cell" [class]="cell" [class.car]="here" [class.goal]="goal" [class.reach]="reachable(r, c)" [class.trail]="trail().has(r + ',' + c)"
                    (click)="move(r, c)" [disabled]="over() || !reachable(r, c)" [attr.aria-label]="label(cell, here, goal)">
              @if (here) { <span class="car-ico">🚗</span> }
              @else if (goal) { 🏛️ }
              @else if (cell === 'works') { 🚧 }
              @else if (cell === 'demo') { <span class="demo">📣</span> }
              @else if (cell === 'park') { 🌳 }
            </button>
          }
        }
      </div>
      @if (message()) { <p class="said" aria-live="polite">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .cortege { display: grid; gap: 8px; justify-items: center; }
    .status { width: 100%; display: flex; justify-content: space-between; gap: 8px; font-size: 13px; flex-wrap: wrap; .muted { font-size: 12px; } }
    .grid { display: grid; grid-template-columns: repeat(var(--n), 1fr); gap: 3px; width: min(100%, 380px); aspect-ratio: 1; padding: 6px; border-radius: 12px; background: #d6d3cb; }
    .cell { border: 0; border-radius: 5px; background: #f2efe8; font-size: 18px; display: grid; place-items: center; padding: 0; cursor: default; transition: background .2s, transform .15s; }
    .cell.reach { background: #fff7d6; cursor: pointer; box-shadow: inset 0 0 0 2px #e6b45c; &:hover { transform: scale(1.06); } }
    .cell.trail { background: #e3e9f5; }
    .cell.works { background: #f6d6b8; } .cell.demo { background: #f8c9c0; } .cell.park { background: #cfe6c9; }
    .cell.goal { background: #e2f1e7; box-shadow: inset 0 0 0 2px var(--good); }
    .cell.car { background: var(--accent); }
    .car-ico { animation: vroom .25s ease; }
    @keyframes vroom { from { transform: scale(.6) rotate(-10deg); } }
    .demo { animation: shout 1s ease-in-out infinite; }
    @keyframes shout { 50% { transform: scale(1.18); } }
    .said { margin: 0; font-weight: 600; font-size: 13px; text-align: center; }
  `,
})
export class CortegeGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly n = N;
  protected dest = 'Rendez-vous';
  protected readonly grid = signal<Cell[][]>([]);
  protected readonly car = signal<Pos>({ r: N - 1, c: 0 });
  protected readonly trail = signal(new Set<string>());
  protected readonly movesLeft = signal(16);
  protected readonly over = signal(false);
  protected readonly message = signal('');
  private budget = 16;
  private optimal = 12;

  protected readonly rows = computed(() => this.grid());
  protected readonly hint = computed(() => (this.over() ? '' : 'Touchez une case voisine pour avancer. Les manifestations bougent à chaque carrefour.'));

  ngOnInit(): void {
    this.dest = this.def().id === 'cortege_province' ? 'la préfecture' : 'l’Élysée';
    for (let k = 0; k < 30; k++) {
      const g = this.build();
      const best = this.shortest(g);
      if (best !== null) { this.grid.set(g); this.optimal = best; break; }
    }
    if (!this.grid().length) this.grid.set(Array.from({ length: N }, () => Array<Cell>(N).fill('road')));
    this.budget = this.optimal + Math.max(2, Math.round(5 - this.diff() * 2));
    this.movesLeft.set(this.budget);
    this.trail.set(new Set([key(this.car())]));
  }

  private build(): Cell[][] {
    const g: Cell[][] = Array.from({ length: N }, () => Array<Cell>(N).fill('road'));
    const free = (r: number, c: number) => !(r === N - 1 && c === 0) && !(r === 0 && c === N - 1);
    const place = (kind: Cell, count: number) => {
      for (let i = 0; i < count; i++) {
        const r = Math.floor(Math.random() * N), c = Math.floor(Math.random() * N);
        if (free(r, c) && g[r][c] === 'road') g[r][c] = kind;
      }
    };
    place('works', 8 + Math.round(this.diff() * 2));
    place('park', 4);
    place('demo', 2 + Math.round(this.diff()));
    return g;
  }

  /** Plus court chemin (cases libres), ou null si bloqué */
  private shortest(g: Cell[][]): number | null {
    const start = { r: N - 1, c: 0 };
    const seen = new Set([key(start)]);
    let frontier = [start];
    for (let d = 0; frontier.length; d++) {
      const next: Pos[] = [];
      for (const p of frontier) {
        if (p.r === 0 && p.c === N - 1) return d;
        for (const q of this.neighbors(p)) if (g[q.r][q.c] === 'road' && !seen.has(key(q))) { seen.add(key(q)); next.push(q); }
      }
      frontier = next;
    }
    return null;
  }

  private neighbors(p: Pos): Pos[] {
    return [{ r: p.r - 1, c: p.c }, { r: p.r + 1, c: p.c }, { r: p.r, c: p.c - 1 }, { r: p.r, c: p.c + 1 }].filter(q => q.r >= 0 && q.c >= 0 && q.r < N && q.c < N);
  }

  protected reachable(r: number, c: number): boolean {
    const p = this.car();
    if (this.over() || Math.abs(p.r - r) + Math.abs(p.c - c) !== 1) return false;
    return this.grid()[r]?.[c] === 'road';
  }

  protected label(cell: Cell, here: boolean, goal: boolean): string {
    return here ? 'Votre voiture' : goal ? 'Destination' : cell === 'works' ? 'Travaux' : cell === 'demo' ? 'Manifestation' : cell === 'park' ? 'Parc' : 'Rue';
  }

  protected move(r: number, c: number): void {
    if (this.over() || !this.reachable(r, c)) return;
    this.car.set({ r, c });
    this.trail.update(t => new Set([...t, `${r},${c}`]));
    this.movesLeft.update(m => m - 1);
    if (r === 0 && c === N - 1) { this.finish(true); return; }
    this.shiftDemos();
    // Encerclé·e : il faut attendre que la manifestation passe (une minute perdue)
    if (!this.neighbors(this.car()).some(q => this.grid()[q.r][q.c] === 'road')) {
      this.movesLeft.update(m => m - 1);
      this.message.set('Bloqué·e par la foule : une minute perdue…');
      this.miss.emit();
      this.shiftDemos();
    } else this.message.set('');
    this.progress.emit({ live: this.score(false), time: Math.max(0, this.movesLeft() / this.budget) });
    if (this.movesLeft() <= 0) this.finish(false);
  }

  /** Les manifestations avancent d'une case, sans jamais écraser la voiture */
  private shiftDemos(): void {
    const g = this.grid().map(row => [...row]);
    const car = this.car();
    const demos: Pos[] = [];
    g.forEach((row, r) => row.forEach((x, c) => { if (x === 'demo') demos.push({ r, c }); }));
    for (const d of demos) {
      const opts = this.neighbors(d).filter(q => g[q.r][q.c] === 'road' && !(q.r === car.r && q.c === car.c) && !(q.r === 0 && q.c === N - 1));
      if (!opts.length || Math.random() < 0.3) continue;
      const q = opts[Math.floor(Math.random() * opts.length)];
      g[d.r][d.c] = 'road';
      g[q.r][q.c] = 'demo';
    }
    this.grid.set(g);
  }

  private score(arrived: boolean): number {
    const used = this.budget - this.movesLeft();
    if (!arrived) return 0;
    return Math.max(0.35, Math.min(1, 1 - (used - this.optimal) * 0.12));
  }

  private finish(arrived: boolean): void {
    this.over.set(true);
    const s = this.score(arrived);
    this.message.set(arrived ? (s >= 0.9 ? 'Pile à l’heure : le cortège a trouvé le chemin parfait.' : 'Arrivé·e, un peu essoufflé·e, mais arrivé·e.') : 'Trop tard : le rendez-vous a commencé sans vous.');
    if (!arrived) this.miss.emit();
    this.progress.emit({ live: s, time: 0 });
    setTimeout(() => this.done.emit(s), 1800);
  }
}

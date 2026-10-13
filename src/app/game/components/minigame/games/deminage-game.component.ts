import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Cell { mine: boolean; open: boolean; flag: boolean; n: number }

const SIZE = 6;

/** Le déminage : ouvrir toutes les cases sûres sans toucher une munition (façon démineur) */
@Component({
  selector: 'app-deminage-game',
  template: `
    <div class="mines">
      <div class="bar">
        <span>{{ def().bad }} restantes : <strong class="mono">{{ minesLeft() }}</strong></span>
        <button type="button" class="btn small" [class.on]="flagMode()" (click)="flagMode.set(!flagMode())" [attr.aria-pressed]="flagMode()">🚩 Mode balise {{ flagMode() ? 'activé' : '' }}</button>
      </div>
      <div class="grid" role="grid" [style.--n]="size">
        @for (c of cells(); track $index; let i = $index) {
          <button type="button" class="cell" [class.open]="c.open" [class.boom]="c.open && c.mine" [class.flag]="c.flag" [attr.data-n]="c.n"
            (click)="tap(i)" (contextmenu)="$event.preventDefault(); toggleFlag(i)" [attr.aria-label]="label(c)">
            @if (c.open) { {{ c.mine ? def().bad : c.n || '' }} } @else if (c.flag) { 🚩 }
          </button>
        }
      </div>
      @if (message()) { <p class="said">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .mines { display: grid; gap: 10px; }
    .bar { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 13px; }
    .btn.on { background: #fbe4b8; border-color: #c9a243; }
    .grid { display: grid; grid-template-columns: repeat(var(--n), 1fr); gap: 4px; width: min(100%, 340px); justify-self: center; }
    .cell { aspect-ratio: 1; border: 0; border-radius: 6px; background: linear-gradient(#8c9a6f, #6f7d55); color: #fff; font: 700 16px var(--font-mono, monospace);
      cursor: pointer; box-shadow: inset 0 -3px 0 rgba(0,0,0,.2); padding: 0; }
    .cell.open { background: #efe6cf; box-shadow: none; color: var(--ink); cursor: default; }
    .cell.boom { background: var(--bad); }
    .cell[data-n="1"].open { color: #2f6fb3; } .cell[data-n="2"].open { color: #2e8a50; } .cell[data-n="3"].open { color: #c0392b; } .cell[data-n="4"].open { color: #5a2f8a; }
    .said { margin: 0; text-align: center; font-weight: 600; font-size: 13px; }
  `,
})
export class DeminageGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly size = SIZE;
  protected readonly cells = signal<Cell[]>([]);
  protected readonly flagMode = signal(false);
  protected readonly message = signal('');
  private mines = 6;
  private started = false;
  private over = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timer && clearInterval(this.timer));
  }

  protected readonly minesLeft = computed(() => this.mines - this.cells().filter(c => c.flag).length);
  private readonly safeOpened = computed(() => this.cells().filter(c => c.open && !c.mine).length);

  ngOnInit(): void {
    this.mines = Math.round(5 + this.diff() * 1.5);
    this.cells.set(Array.from({ length: SIZE * SIZE }, () => ({ mine: false, open: false, flag: false, n: 0 })));
    const limit = 150000 / this.diff();
    const t0 = performance.now();
    this.timer = setInterval(() => {
      const t = performance.now() - t0;
      this.progress.emit({ live: this.ratio(), time: Math.max(0, 1 - t / limit) });
      if (t >= limit) this.finish(false, 'Temps écoulé : les démineurs reprennent la main.');
    }, 250);
  }

  private ratio(): number {
    return this.safeOpened() / (SIZE * SIZE - this.mines);
  }

  private around(i: number): number[] {
    const r = Math.floor(i / SIZE), c = i % SIZE, out: number[] = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) out.push(rr * SIZE + cc);
    }
    return out;
  }

  /** Les munitions sont placées au premier coup, jamais sous le doigt ni autour */
  private seed(first: number): void {
    const banned = new Set([first, ...this.around(first)]);
    const cells = this.cells().map(c => ({ ...c }));
    let placed = 0;
    while (placed < this.mines) {
      const k = Math.floor(Math.random() * cells.length);
      if (banned.has(k) || cells[k].mine) continue;
      cells[k].mine = true;
      placed++;
    }
    cells.forEach((c, i) => (c.n = this.around(i).filter(j => cells[j].mine).length));
    this.cells.set(cells);
  }

  protected label(c: Cell): string {
    if (!c.open) return c.flag ? 'Balise' : 'Case fermée';
    return c.mine ? 'Munition' : c.n ? `${c.n} munition(s) autour` : 'Case vide';
  }

  protected toggleFlag(i: number): void {
    if (this.over) return;
    this.cells.update(l => l.map((c, k) => (k === i && !c.open ? { ...c, flag: !c.flag } : c)));
  }

  protected tap(i: number): void {
    if (this.over) return;
    if (this.flagMode()) { this.toggleFlag(i); return; }
    if (!this.started) { this.started = true; this.seed(i); }
    const cells = this.cells().map(c => ({ ...c }));
    const c = cells[i];
    if (c.open || c.flag) return;
    if (c.mine) {
      c.open = true;
      this.cells.set(cells);
      this.miss.emit();
      this.finish(false, 'Détonation ! Les secours évacuent la zone.');
      return;
    }
    // Ouverture en cascade des zones vides
    const stack = [i];
    while (stack.length) {
      const k = stack.pop()!;
      if (cells[k].open || cells[k].flag) continue;
      cells[k].open = true;
      if (cells[k].n === 0) stack.push(...this.around(k).filter(j => !cells[j].open && !cells[j].mine));
    }
    this.cells.set(cells);
    if (this.safeOpened() === SIZE * SIZE - this.mines) this.finish(true, 'Zone sécurisée !');
  }

  private finish(win: boolean, text: string): void {
    if (this.over) return;
    this.over = true;
    if (this.timer) clearInterval(this.timer);
    this.message.set(text);
    this.cells.update(l => l.map(c => (c.mine ? { ...c, open: true } : c)));
    const score = win ? 1 : this.ratio() * 0.5;
    this.progress.emit({ live: score, time: 0 });
    setTimeout(() => this.done.emit(score), 1300);
  }
}

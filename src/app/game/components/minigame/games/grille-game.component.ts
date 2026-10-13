import { Component, DestroyRef, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';
import { DEPARTEMENTS, Departement, Grid, makeGrid, normalize } from '../../../data/departements';

/** Départodoku : une grille 3 × 3 de départements (façon Metrodoku) */
@Component({
  selector: 'app-grille-game',
  template: `
    <div class="doku">
      <div class="head">
        <span>Essais restants <strong class="mono">{{ left() }}</strong></span>
        <span><strong class="mono">{{ filled() }}</strong> / 9</span>
      </div>
      <div class="grid" role="grid" aria-label="Grille des départements">
        <span class="corner" aria-hidden="true">🇫🇷</span>
        @for (c of grid.cols; track c.id) { <span class="crit col" role="columnheader">{{ c.label }}</span> }
        @for (r of grid.rows; track r.id; let ri = $index) {
          <span class="crit row" role="rowheader">{{ r.label }}</span>
          @for (c of grid.cols; track c.id; let ci = $index) {
            @let v = cells()[ri][ci];
            <button type="button" class="cell" role="gridcell" [class.sel]="sel()?.[0] === ri && sel()?.[1] === ci" [class.done]="!!v" [class.reveal]="!!revealed()[ri][ci]"
              (click)="choose(ri, ci)" [attr.aria-label]="v ? v.name : (r.label + ' et ' + c.label)">
              @if (v) { <b class="mono">{{ v.code }}</b><small>{{ v.name }}</small> }
              @else if (revealed()[ri][ci]; as x) { <b class="mono">{{ x.code }}</b><small>{{ x.name }}</small> }
              @else { <span class="plus">+</span><small class="n">{{ grid.answers[ri][ci].length }} possibles</small> }
            </button>
          }
        }
      </div>
      @if (sel() && !over()) {
        <div class="search">
          <input #box type="text" [value]="query()" (input)="query.set($any($event.target).value)" (keydown.enter)="pickFirst()" placeholder="Nom ou numéro du département" aria-label="Département" autocomplete="off" />
          @if (suggestions().length) {
            <ul class="sugg">
              @for (s of suggestions(); track s.code) { <li><button type="button" (click)="pick(s)"><b class="mono">{{ s.code }}</b> {{ s.name }}</button></li> }
            </ul>
          }
        </div>
      } @else if (!over()) {
        <p class="said muted">Touchez une case pour proposer un département.</p>
      }
      @if (message()) { <p class="said" aria-live="polite">{{ message() }}</p> }
      @if (!over()) { <button type="button" class="btn" (click)="giveUp()">Rendre la grille</button> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .doku { display: grid; gap: 10px; }
    .head { display: flex; justify-content: space-between; font-size: 13px; }
    .grid { display: grid; grid-template-columns: minmax(64px, .8fr) repeat(3, 1fr); gap: 5px; }
    .corner { display: grid; place-items: center; font-size: 22px; }
    .crit { display: grid; place-items: center; text-align: center; padding: 4px; font-size: 11.5px; font-weight: 600; line-height: 1.2;
      background: var(--surface-2); border-radius: 6px; color: var(--ink-2); hyphens: auto; overflow-wrap: anywhere; }
    .crit.col { min-height: 44px; }
    .cell { aspect-ratio: 1.15; display: grid; place-content: center; justify-items: center; gap: 2px; padding: 4px; border: 2px dashed var(--line);
      border-radius: 8px; background: var(--surface); cursor: pointer; font: inherit; color: var(--ink); text-align: center; min-width: 0; }
    .cell .plus { font-size: 22px; color: var(--ink-3); line-height: 1; }
    .cell small { font-size: 11px; line-height: 1.15; overflow-wrap: anywhere; }
    .cell .n { color: var(--ink-3); font-size: 10px; }
    .cell b { font-size: 16px; }
    .cell.sel { border-color: #2f6fb3; border-style: solid; background: #eaf2fb; }
    .cell.done { border-style: solid; border-color: var(--good); background: var(--good-soft); cursor: default; animation: pop .35s ease; }
    .cell.reveal { border-style: solid; opacity: .6; }
    @keyframes pop { 50% { transform: scale(1.06); } }
    .search { position: relative; }
    .search input { width: 100%; box-sizing: border-box; padding: 10px 12px; font: 15px var(--font-body); border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); }
    .sugg { list-style: none; margin: 4px 0 0; padding: 0; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--surface); }
    .sugg button { width: 100%; text-align: left; padding: 8px 12px; border: 0; background: none; font: 14px var(--font-body); color: var(--ink); cursor: pointer; }
    .sugg li + li { border-top: 1px solid var(--line); }
    .sugg button:hover { background: var(--surface-2); }
    .said { margin: 0; font-size: 13px; text-align: center; font-weight: 600; }
    .btn { justify-self: center; }
    @media (prefers-reduced-motion: reduce) { .cell { animation: none !important; } }
  `,
})
export class GrilleGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly grid: Grid = makeGrid();
  protected readonly cells = signal<(Departement | null)[][]>([[null, null, null], [null, null, null], [null, null, null]]);
  protected readonly revealed = signal<(Departement | null)[][]>([[null, null, null], [null, null, null], [null, null, null]]);
  protected readonly sel = signal<[number, number] | null>(null);
  protected readonly query = signal('');
  protected readonly message = signal('');
  protected readonly over = signal(false);
  protected readonly left = signal(12);
  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timer && clearInterval(this.timer));
  }

  ngOnInit(): void {
    this.left.set(Math.round(12 / Math.max(0.8, this.diff())));
    const limit = 240000 / this.diff();
    const t0 = performance.now();
    this.timer = setInterval(() => {
      const t = performance.now() - t0;
      this.progress.emit({ live: this.filled() / 9, time: Math.max(0, 1 - t / limit) });
      if (t >= limit) this.finish('Temps écoulé !');
    }, 250);
  }

  protected readonly filled = computed(() => this.cells().flat().filter(Boolean).length);
  private readonly usedCodes = computed(() => new Set(this.cells().flat().filter(Boolean).map(x => x!.code)));

  protected readonly suggestions = computed(() => {
    const q = normalize(this.query());
    if (!q) return [];
    const used = this.usedCodes();
    return DEPARTEMENTS.filter(x => !used.has(x.code) && (x.code.toLowerCase().startsWith(q) || normalize(x.name).includes(q)))
      .sort((a, b) => Number(normalize(b.name).startsWith(q)) - Number(normalize(a.name).startsWith(q)))
      .slice(0, 6);
  });

  protected choose(r: number, c: number): void {
    if (this.over() || this.cells()[r][c]) return;
    this.sel.set([r, c]);
    this.query.set('');
    setTimeout(() => this.box()?.nativeElement.focus(), 0);
  }

  protected pickFirst(): void {
    const s = this.suggestions()[0];
    if (s) this.pick(s);
  }

  protected pick(x: Departement): void {
    const at = this.sel();
    if (!at || this.over()) return;
    const [r, c] = at;
    const row = this.grid.rows[r], col = this.grid.cols[c];
    this.query.set('');
    if (row.test(x) && col.test(x)) {
      this.cells.update(g => g.map((line, i) => line.map((v, j) => (i === r && j === c ? x : v))));
      this.message.set(`${x.name} (${x.code}) : bien vu !`);
      this.sel.set(null);
      if (this.filled() === 9) this.finish('Grille complète !');
      return;
    }
    this.left.update(n => n - 1);
    this.miss.emit();
    const why = !row.test(x) ? `pas en ${row.label}` : `pas « ${col.label.toLowerCase()} »`;
    this.message.set(`${x.name} : ${why}.`);
    if (this.left() <= 0) this.finish('Plus d’essais.');
  }

  protected giveUp(): void {
    this.finish('Grille rendue.');
  }

  private finish(text: string): void {
    if (this.over()) return;
    this.over.set(true);
    this.sel.set(null);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // Montrer une réponse possible pour chaque case vide
    const used = new Set(this.usedCodes());
    const rev = this.grid.answers.map((line, i) => line.map((opts, j) => {
      if (this.cells()[i][j]) return null;
      const x = opts.find(o => !used.has(o.code)) ?? opts[0];
      used.add(x.code);
      return x;
    }));
    this.revealed.set(rev);
    const score = this.filled() / 9;
    this.message.set(`${text} ${this.filled()} case(s) sur 9.`);
    this.progress.emit({ live: score, time: 0 });
    setTimeout(() => this.done.emit(score), 2200);
  }
}

import { Component, DestroyRef, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FxService } from '../../../services/fx.service';
import { MinigameDef } from '../../../data/minigames';
import { normalize } from '../../../data/departements';
import { Grid, GridItem, gridFromIds, makeGrid, rarity } from '../../../data/grids';
import { GridResult, GridSave, clearSave, dailyRand, loadSave, saveResult, writeSave } from '../../../engine/arcade-save';
import { ArcadeResultComponent } from '../../arcade-panel/arcade-result.component';

/** Trois erreurs permises */
const MAX_MISTAKES = 3;
import { todayKey } from '../../../engine/daily';

/** Grilles façon Metrodoku : villes de France, stations de métro, capitales du monde */
@Component({
  selector: 'app-grille-game',
  imports: [ArcadeResultComponent],
  template: `
    <div class="doku" [class.shake]="shaking()">
      <div class="head">
        <span class="lives" [attr.aria-label]="left() + ' erreur(s) encore permise(s)'">Erreurs permises
          @for (h of hearts(); track $index) { <i class="heart" [class.lost]="!h" aria-hidden="true">{{ h ? '❤️' : '🖤' }}</i> }</span>
        <span class="pts-total" [class.bump]="bump()" title="Points de rareté : plus la réponse est rare, plus elle rapporte">⭐ <strong class="mono">{{ total() }}</strong> pts</span>
        <span><strong class="mono">{{ filled() }}</strong> / 9</span>
      </div>
      <div class="grid" role="grid" [attr.aria-label]="'Grille : ' + grid.set.noun + 's'">
        <span class="corner" aria-hidden="true">{{ grid.set.corner }}</span>
        @for (c of grid.cols; track c.id) { <span class="crit col" [class.long]="c.label.length > 28" role="columnheader">@if (c.badge) { <i class="lb" [style.background]="c.color" [class.light]="light(c.color)">{{ c.badge }}</i> }{{ c.label }}</span> }
        @for (r of grid.rows; track r.id; let ri = $index) {
          <span class="crit row" [class.long]="r.label.length > 28" role="rowheader">@if (r.badge) { <i class="lb" [style.background]="r.color" [class.light]="light(r.color)">{{ r.badge }}</i> }{{ r.label }}</span>
          @for (c of grid.cols; track c.id; let ci = $index) {
            @let v = cells()[ri][ci];
            <button type="button" class="cell" role="gridcell" [attr.data-cell]="ri * 3 + ci" [class.wrong]="wrong() === ri * 3 + ci" [class.sel]="sel()?.[0] === ri && sel()?.[1] === ci" [class.done]="!!v" [class.reveal]="!!revealed()[ri][ci]"
              (click)="choose(ri, ci)" [attr.aria-label]="v ? v.name : (r.label + ' et ' + c.label)">
              @if (v) { <b>{{ v.name }}</b>@if (v.tag) { <small>{{ v.tag }}</small> }
                @if (pts()[ri * 3 + ci]; as pt) { <em class="pt" [class.rare]="pt >= 80" [class.vrare]="pt >= 95">+{{ pt }}</em> } }
              @else if (revealed()[ri][ci]; as x) { <b>{{ x.name }}</b>@if (x.tag) { <small>{{ x.tag }}</small> } }
              @else { <span class="plus">+</span><small class="n">{{ grid.answers[ri][ci].length }} possible{{ grid.answers[ri][ci].length > 1 ? 's' : '' }}</small> }
            </button>
          }
        }
      </div>
      @if (sel() && !over()) {
        <div class="search">
          <input #box type="text" [value]="query()" (input)="query.set($any($event.target).value)" (keydown.enter)="pickFirst()" [placeholder]="grid.set.placeholder" [attr.aria-label]="grid.set.noun" autocomplete="off" />
          @if (suggestions().length) {
            <ul class="sugg">
              @for (s of suggestions(); track s.key) { <li><button type="button" (click)="pick(s)">{{ s.name }} @if (s.tag) { <small class="muted">{{ s.tag }}</small> }</button></li> }
            </ul>
          }
        </div>
      } @else if (!over()) {
        <p class="said muted">Touchez une case pour proposer une réponse.</p>
      }
      @if (message()) { <p class="said" aria-live="polite">{{ message() }}</p> }
      @if (!over()) { <button type="button" class="btn" (click)="giveUp()">Rendre la grille</button> }
      @if (result(); as r) {
        <app-arcade-result [result]="r" [openAll]="true" />
        <button type="button" class="btn primary" (click)="done.emit(finalScore())">Continuer</button>
      } @else if (over() && !saveKey()) {
        <details class="all-ans"><summary>Toutes les réponses possibles</summary>
          <ul>@for (row of grid.rows; track row.id; let i = $index) { @for (c of grid.cols; track c.id; let j = $index) {
            <li><span class="muted">{{ row.label }} × {{ c.label }}</span> {{ names(grid.answers[i][j]) }}</li> } }</ul>
        </details>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .doku { display: grid; gap: 10px; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 13px; }
    .pts-total { padding: 2px 9px; border-radius: 999px; background: #fff4d6; color: #7a5300; font-weight: 600; }
    .pts-total.bump { animation: bump .5s ease; }
    @keyframes bump { 40% { transform: scale(1.18); } }
    .cell { position: relative; }
    .pt { position: absolute; top: 3px; right: 4px; font: 700 9.5px var(--font-body); font-style: normal; color: var(--ink-3); }
    .pt.rare { color: #b07a00; } .pt.vrare { color: #8a3ffc; }
    .grid { display: grid; grid-template-columns: minmax(64px, .8fr) repeat(3, 1fr); gap: 5px; }
    .corner { display: grid; place-items: center; font-size: 22px; }
    .crit { display: grid; place-items: center; text-align: center; padding: 4px; font-size: 11.5px; font-weight: 600; line-height: 1.2;
      background: var(--surface-2); border-radius: 6px; color: var(--ink-2); hyphens: auto; overflow-wrap: anywhere; }
    .crit.col { min-height: 44px; }
    .crit { align-content: center; gap: 3px; }
    .lb { display: inline-grid; place-items: center; justify-self: center; min-width: 22px; height: 22px; padding: 0 4px; border-radius: 999px; color: #fff;
      font: 700 12px var(--font-body); font-style: normal; box-sizing: border-box; }
    .lb.light { color: #1b2130; }
    .crit.long { font-size: 10.5px; font-weight: 600; }
    @media (max-width: 420px) { .crit { font-size: 10px; padding: 3px; } .crit.long { font-size: 9.5px; } }
    .cell { aspect-ratio: 1.15; display: grid; place-content: center; justify-items: center; gap: 2px; padding: 4px; border: 2px dashed var(--line);
      border-radius: 8px; background: var(--surface); cursor: pointer; font: inherit; color: var(--ink); text-align: center; min-width: 0; }
    .cell .plus { font-size: 22px; color: var(--ink-3); line-height: 1; }
    .cell small { font-size: 11px; line-height: 1.15; overflow-wrap: anywhere; }
    .cell .n { color: var(--ink-3); font-size: 10px; }
    .cell b { font-size: 12.5px; line-height: 1.15; overflow-wrap: anywhere; }
    .cell.sel { border-color: #2f6fb3; border-style: solid; background: #eaf2fb; }
    .cell.done { border-style: solid; border-color: var(--good); background: var(--good-soft); cursor: default; animation: pop .35s ease; }
    .cell.reveal { border-style: solid; opacity: .6; animation: reveal .45s ease both; }
    .cell.wrong { border-color: var(--bad); border-style: solid; background: var(--bad-soft); animation: wobble .4s ease; }
    .doku.shake .grid { animation: wobble .35s ease; }
    .lives { display: inline-flex; align-items: center; gap: 4px; }
    .heart { font-style: normal; font-size: 14px; display: inline-block; transition: transform .3s; }
    .heart.lost { animation: heartbreak .6s ease; opacity: .6; }
    @keyframes heartbreak { 0% { transform: scale(1.4); } 40% { transform: scale(.7) rotate(-15deg); } 100% { transform: none; } }
    @keyframes wobble { 20%, 60% { transform: translateX(-5px); } 40%, 80% { transform: translateX(5px); } }
    @keyframes reveal { from { transform: rotateY(90deg); opacity: 0; } }
    @keyframes pop { 50% { transform: scale(1.06); } }
    .search { position: relative; }
    .search input { width: 100%; box-sizing: border-box; padding: 10px 12px; font: 15px var(--font-body); border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--ink); }
    .sugg { list-style: none; margin: 4px 0 0; padding: 0; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--surface); }
    .sugg button { width: 100%; text-align: left; padding: 8px 12px; border: 0; background: none; font: 14px var(--font-body); color: var(--ink); cursor: pointer; }
    .sugg li + li { border-top: 1px solid var(--line); }
    .sugg button:hover { background: var(--surface-2); }
    .said { margin: 0; font-size: 13px; text-align: center; font-weight: 600; }
    .btn { justify-self: center; }
    .all-ans { font-size: 12px; summary { cursor: pointer; font-weight: 600; } ul { list-style: none; padding: 0; margin: 6px 0 0; display: grid; gap: 4px; max-height: 200px; overflow: auto; } }
    @media (prefers-reduced-motion: reduce) { .cell { animation: none !important; } }
  `,
})
export class GrilleGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();
  /** Salle de jeux : la partie se sauvegarde et se reprend (jusqu'à minuit) */
  readonly saveKey = input<string | null>(null);

  protected grid!: Grid;
  protected readonly cells = signal<(GridItem | null)[][]>([[null, null, null], [null, null, null], [null, null, null]]);
  protected readonly revealed = signal<(GridItem | null)[][]>([[null, null, null], [null, null, null], [null, null, null]]);
  protected readonly sel = signal<[number, number] | null>(null);
  protected readonly query = signal('');
  protected readonly message = signal('');
  protected readonly over = signal(false);
  protected readonly left = signal(12);
  /** Résultat de la partie du jour (salle de jeux) */
  protected readonly result = signal<GridResult | null>(null);
  protected readonly shaking = signal(false);
  /** Le score : 80 % pour les cases remplies, 20 % pour la rareté des réponses, −4 points par erreur */
  protected finalScore(): number {
    const raw = (this.filled() / 9) * 0.8 + Math.min(1, this.total() / 900) * 0.2 - (MAX_MISTAKES - this.left()) * 0.04;
    return Math.max(0, Math.min(1, raw));
  }

  /** Points de rareté case par case */
  protected readonly pts = signal<(number | null)[]>(Array(9).fill(null));
  protected readonly total = computed(() => this.pts().reduce<number>((t, p) => t + (p ?? 0), 0));
  protected readonly bump = signal(false);
  protected readonly wrong = signal<number | null>(null);
  protected readonly hearts = computed(() => Array.from({ length: MAX_MISTAKES }, (_, i) => i < this.left()));
  private readonly fx = inject(FxService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private cellEl(i: number): Element | null {
    return (this.host.nativeElement as HTMLElement).querySelector(`[data-cell="${i}"]`);
  }
  private readonly box = viewChild<ElementRef<HTMLInputElement>>('box');
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timer && clearInterval(this.timer));
  }

  ngOnInit(): void {
    const id = this.def().grid ?? 'villes';
    const key = this.saveKey();
    const saved = key ? loadSave<GridSave>(key) : null;
    const restored = saved?.kind === 'grille' ? gridFromIds(id, saved.rows, saved.cols) : null;
    // Salle de jeux : la grille du jour, la même pour tout le monde
    this.grid = restored ?? makeGrid(id, key ? dailyRand(key) : Math.random);
    this.left.set(MAX_MISTAKES);
    if (restored && saved) {
      const byKey = new Map(this.grid.set.items.map(x => [x.key, x]));
      this.cells.set([0, 1, 2].map(r => [0, 1, 2].map(c => byKey.get(saved.cells[r * 3 + c] ?? '') ?? null)));
      this.left.set(Math.min(MAX_MISTAKES, saved.left));
      this.pts.set(this.cells().flat().map((x, i) => (x ? saved.pts?.[i] ?? rarity(this.grid.answers[Math.floor(i / 3)][i % 3], x).points : null)));
      this.message.set(`Partie reprise : ${this.filled()} case(s) déjà remplie(s).`);
    }
    this.persist();
    if (key) {
      // Pas de chrono dans la salle de jeux : on prend son temps
      this.timer = setInterval(() => this.progress.emit({ live: this.filled() / 9, time: 1 }), 500);
      return;
    }
    const limit = 240000 / this.diff();
    const t0 = performance.now();
    this.timer = setInterval(() => {
      const t = performance.now() - t0;
      this.progress.emit({ live: this.filled() / 9, time: Math.max(0, 1 - t / limit) });
      if (t >= limit) this.finish('Temps écoulé !');
    }, 250);
  }

  private persist(): void {
    const key = this.saveKey();
    if (!key || this.over()) return;
    writeSave(key, { kind: 'grille', rows: this.grid.rows.map(r => r.id), cols: this.grid.cols.map(c => c.id), cells: this.cells().flat().map(x => x?.key ?? null), left: this.left(), pts: this.pts() });
  }

  protected light(color?: string): boolean {
    return !!color && ['#FFCD00', '#6ECA97', '#FA9ABA', '#E19BDF', '#B6BD00', '#6EC4E8', '#FF7E2E'].includes(color);
  }

  protected readonly filled = computed(() => this.cells().flat().filter(Boolean).length);
  private readonly usedCodes = computed(() => new Set(this.cells().flat().filter(Boolean).map(x => x!.key)));

  protected readonly suggestions = computed(() => {
    const q = normalize(this.query());
    if (!q) return [];
    const used = this.usedCodes();
    return this.grid.set.items.filter(x => !used.has(x.key) && x.search.some(k => k.includes(q)))
      .sort((a, b) => Number(b.search.some(k => k.startsWith(q))) - Number(a.search.some(k => k.startsWith(q))))
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

  protected pick(x: GridItem): void {
    const at = this.sel();
    if (!at || this.over()) return;
    const [r, c] = at;
    const row = this.grid.rows[r], col = this.grid.cols[c];
    this.query.set('');
    if (row.test(x) && col.test(x)) {
      this.cells.update(g => g.map((line, i) => line.map((v, j) => (i === r && j === c ? x : v))));
      const rar = rarity(this.grid.answers[r][c], x);
      this.pts.update(p => p.map((v, i) => (i === r * 3 + c ? rar.points : v)));
      this.bump.set(true); setTimeout(() => this.bump.set(false), 500);
      this.message.set(`${x.name}${x.tag ? ` (${x.tag})` : ''} : bien vu ! ${rar.label} : +${rar.points} pts.`);
      const el = this.cellEl(r * 3 + c);
      this.fx.burstAt(el, 'good');
      this.fx.floatAt(el, `+${rar.points}${rar.points >= 95 ? ' 💎' : rar.points >= 80 ? ' ✨' : ''}`, 'good');
      this.sel.set(null);
      this.persist();
      if (this.filled() === 9) this.finish('Grille complète !');
      return;
    }
    this.left.update(n => n - 1);
    this.persist();
    this.miss.emit();
    this.wrong.set(r * 3 + c);
    this.shaking.set(true);
    this.fx.floatAt(this.cellEl(r * 3 + c), '−1 ❤️', 'bad');
    setTimeout(() => { this.shaking.set(false); this.wrong.set(null); }, 450);
    const why = !row.test(x) ? `pas « ${row.label} »` : `pas « ${col.label.toLowerCase()} »`;
    this.message.set(`${x.name} : ${why}.`);
    if (this.left() <= 0) this.finish('Plus d’essais.');
  }

  protected giveUp(): void {
    this.finish('Grille rendue.');
  }

  protected names(xs: GridItem[]): string {
    return xs.map(x => x.name).join(', ');
  }

  private finish(text: string): void {
    if (this.over()) return;
    this.over.set(true);
    const key = this.saveKey();
    if (key) clearSave(key);
    this.sel.set(null);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // Montrer une réponse possible pour chaque case vide
    const used = new Set(this.usedCodes());
    const rev = this.grid.answers.map((line, i) => line.map((opts, j) => {
      if (this.cells()[i][j]) return null;
      const x = opts.find(o => !used.has(o.key)) ?? opts[0];
      used.add(x.key);
      return x;
    }));
    this.revealed.set(rev);
    const score = this.finalScore();
    // Le verdict, façon une de journal
    if (this.filled() === 9) {
      this.fx.stamp('Grille complète', 'good', MAX_MISTAKES - this.left() ? `${MAX_MISTAKES - this.left()} erreur(s)` : 'Sans faute !');
      const w = window.innerWidth, h = window.innerHeight;
      [0.3, 0.5, 0.7].forEach((x, i) => setTimeout(() => this.fx.burst(w * x, h * 0.35, 'good', 22), i * 160));
    } else if (this.left() <= 0) {
      this.fx.group(() => { this.fx.stamp('Plus d’essais', 'bad', `${this.filled()}/9`); this.fx.flash('bad'); });
    } else {
      this.fx.stamp('Grille rendue', 'neutral', `${this.filled()}/9`);
    }
    this.message.set(`${text} ${this.filled()} case(s) sur 9 · ${this.total()} points de rareté.`);
    this.progress.emit({ live: score, time: 0 });
    if (key) {
      const view = (c: { label: string; badge?: string; color?: string }) => ({ label: c.label, ...(c.badge ? { badge: c.badge, color: c.color } : {}) });
      const r: Omit<GridResult, 'day'> = {
        kind: 'grille', id: key, title: this.def().title, icon: this.grid.set.corner,
        rows: this.grid.rows.map(view), cols: this.grid.cols.map(view),
        cells: this.cells().flat().map(x => x?.name ?? null),
        answers: this.grid.answers.flat().map(opts => opts.map(o => o.name)),
        found: this.filled(), mistakes: MAX_MISTAKES - this.left(), maxMistakes: MAX_MISTAKES,
        outcome: this.filled() === 9 ? 'complete' : this.left() <= 0 ? 'perdu' : 'abandon',
        pts: this.pts(), points: this.total(),
      };
      saveResult(r);
      this.result.set({ ...r, day: todayKey() });
      return;
    }
    setTimeout(() => this.done.emit(score), 4000);
  }
}

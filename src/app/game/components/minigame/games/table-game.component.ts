import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Rule { a: number; b: number; want: boolean }

const SEATS = 8;

/** Le plan de table : placer les convives autour de la table en respectant affinités et inimitiés */
@Component({
  selector: 'app-table-game',
  template: `
    <div class="tbl">
      <div class="board">
        <div class="table" aria-hidden="true"><span>{{ def().title }}</span></div>
        @for (seat of seats(); track $index; let i = $index) {
          <button type="button" class="seat" [style.left.%]="pos(i).x" [style.top.%]="pos(i).y" [class.sel]="selSeat() === i" [class.full]="seat !== null"
            (click)="clickSeat(i)" [attr.aria-label]="seat !== null ? guests()[seat].name : 'Place libre ' + (i + 1)">
            @if (seat !== null) { <span class="ico">{{ guests()[seat].icon }}</span><small>{{ guests()[seat].name }}</small> } @else { <span class="free">{{ i + 1 }}</span> }
          </button>
        }
      </div>
      <div class="pool" aria-label="Convives à placer">
        @for (g of guests(); track g.name; let i = $index) {
          @if (!placed().has(i)) {
            <button type="button" class="guest" [class.sel]="selGuest() === i" (click)="pickGuest(i)"><span>{{ g.icon }}</span> {{ g.name }}</button>
          }
        }
        @if (!placed().size) { <span class="muted hint">Touchez un convive, puis une place. Touchez deux places pour les échanger.</span> }
      </div>
      <ul class="rules">
        @for (r of rules(); track $index) {
          <li [class.ok]="status()[$index] === 'ok'" [class.ko]="status()[$index] === 'ko'">
            <span>{{ guests()[r.a].icon }} {{ guests()[r.a].name }}</span>
            <b>{{ r.want ? '♥ à côté de' : '✗ pas à côté de' }}</b>
            <span>{{ guests()[r.b].icon }} {{ guests()[r.b].name }}</span>
          </li>
        }
      </ul>
      <button type="button" class="btn primary" [disabled]="placed().size < guests().length || over()" (click)="validate()">Valider le plan de table</button>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .tbl { display: grid; gap: 10px; }
    .board { position: relative; width: min(100%, 340px); aspect-ratio: 1; justify-self: center; }
    .table { position: absolute; inset: 24%; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #fff8e8, #e9dcc0); border: 3px solid #c9b48a;
      display: grid; place-items: center; text-align: center; font: 600 12px var(--font-display); color: #6b5a3a; padding: 10px; }
    .seat { position: absolute; width: 23%; aspect-ratio: 1; margin: -11.5% 0 0 -11.5%; border-radius: 50%; border: 2px dashed var(--line); background: var(--surface);
      display: grid; place-content: center; justify-items: center; gap: 1px; cursor: pointer; font: inherit; color: var(--ink); padding: 2px; transition: transform .15s; }
    .seat .ico { font-size: 20px; line-height: 1; } .seat small { font-size: 9.5px; line-height: 1.05; text-align: center; max-width: 100%; overflow: hidden; }
    .seat .free { color: var(--ink-3); font-size: 13px; }
    .seat.full { border-style: solid; border-color: var(--accent); background: var(--accent-soft); }
    .seat.sel { transform: scale(1.1); border-color: #c9a243; box-shadow: 0 0 0 3px rgba(244,210,122,.6); }
    .pool { display: flex; flex-wrap: wrap; gap: 6px; min-height: 34px; align-items: center; }
    .guest { border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 6px 10px; font: 13px var(--font-body); color: var(--ink); cursor: pointer; }
    .guest.sel { border-color: #c9a243; background: #fbf1d4; }
    .hint { font-size: 12px; }
    .rules { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 12.5px;
      li { display: flex; gap: 6px; flex-wrap: wrap; padding: 4px 8px; border-radius: 6px; background: var(--surface-2); border-left: 3px solid var(--line); }
      li.ok { border-left-color: var(--good); } li.ko { border-left-color: var(--bad); } b { font-weight: 600; color: var(--ink-2); } }
    .btn { justify-self: center; }
  `,
})
export class TableGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly guests = signal<{ name: string; icon: string }[]>([]);
  protected readonly seats = signal<(number | null)[]>(Array(SEATS).fill(null));
  protected readonly rules = signal<Rule[]>([]);
  protected readonly selGuest = signal<number | null>(null);
  protected readonly selSeat = signal<number | null>(null);
  protected readonly over = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timer && clearInterval(this.timer));
  }

  protected readonly placed = computed(() => new Set(this.seats().filter((x): x is number => x !== null)));

  /** Sièges voisins sur une table ronde */
  private readonly neighbours = computed(() => {
    const seats = this.seats();
    const at = new Map<number, number>();
    seats.forEach((g, i) => { if (g !== null) at.set(g, i); });
    return (a: number, b: number) => {
      const x = at.get(a), y = at.get(b);
      if (x === undefined || y === undefined) return null;
      const d = Math.abs(x - y);
      return d === 1 || d === SEATS - 1;
    };
  });

  protected readonly status = computed(() => this.rules().map(r => {
    const n = this.neighbours()(r.a, r.b);
    if (n === null) return 'open';
    return n === r.want ? 'ok' : 'ko';
  }));

  ngOnInit(): void {
    const all = [...(this.def().guests ?? [])].sort(() => Math.random() - 0.5).slice(0, SEATS);
    this.guests.set(all);
    // On part d'un plan solution, puis on en tire des contraintes satisfiables
    const sol = all.map((_, i) => i).sort(() => Math.random() - 0.5);
    const adj = (a: number, b: number) => { const d = Math.abs(sol.indexOf(a) - sol.indexOf(b)); return d === 1 || d === SEATS - 1; };
    const pairs: [number, number][] = [];
    for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) pairs.push([a, b]);
    pairs.sort(() => Math.random() - 0.5);
    const wants = pairs.filter(([a, b]) => adj(a, b)).slice(0, 3).map(([a, b]) => ({ a, b, want: true }));
    const hates = pairs.filter(([a, b]) => !adj(a, b)).slice(0, Math.round(3 + this.diff() * 1.5)).map(([a, b]) => ({ a, b, want: false }));
    this.rules.set([...wants, ...hates].sort(() => Math.random() - 0.5));
    const limit = 100000 / this.diff();
    const t0 = performance.now();
    this.timer = setInterval(() => {
      const t = performance.now() - t0;
      this.progress.emit({ live: this.ratio(), time: Math.max(0, 1 - t / limit) });
      if (t >= limit) this.validate();
    }, 250);
  }

  protected pos(i: number): { x: number; y: number } {
    const a = -Math.PI / 2 + (i / SEATS) * 2 * Math.PI;
    return { x: 50 + Math.cos(a) * 38, y: 50 + Math.sin(a) * 38 };
  }

  protected pickGuest(i: number): void {
    if (this.over()) return;
    this.selGuest.set(this.selGuest() === i ? null : i);
    this.selSeat.set(null);
  }

  protected clickSeat(i: number): void {
    if (this.over()) return;
    const g = this.selGuest();
    const seats = [...this.seats()];
    if (g !== null) {
      // Le convive prend la place ; l'occupant éventuel retourne dans la salle
      seats[i] = g;
      this.seats.set(seats);
      this.selGuest.set(null);
      return;
    }
    const s = this.selSeat();
    if (s === null) { if (seats[i] !== null) this.selSeat.set(i); return; }
    [seats[s], seats[i]] = [seats[i], seats[s]];
    this.seats.set(seats);
    this.selSeat.set(null);
  }

  private ratio(): number {
    const st = this.status();
    return st.filter(x => x === 'ok').length / Math.max(1, st.length);
  }

  protected validate(): void {
    if (this.over()) return;
    this.over.set(true);
    if (this.timer) clearInterval(this.timer);
    const st = this.status();
    const ok = st.filter(x => x === 'ok').length;
    if (st.some(x => x === 'ko')) this.miss.emit();
    const score = ok / Math.max(1, st.length);
    this.progress.emit({ live: score, time: 0 });
    setTimeout(() => this.done.emit(score), 900);
  }
}

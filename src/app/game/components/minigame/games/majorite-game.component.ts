import { Component, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Group { id: string; name: string; seats: number; pos: number; color: string; demand: string }

const NAMES = [
  ['Gauche radicale', -80, '#b0263a', 'Le SMIC à 1 800 €'], ['Écologistes', -55, '#2f8f4e', 'La fin des vols courts'],
  ['Socialistes', -35, '#e0567a', 'Un grand plan pour l’hôpital'], ['Divers gauche', -18, '#f08aa0', 'Les services publics ruraux'],
  ['Centristes', 0, '#f2b33d', 'La rigueur budgétaire'], ['Régionalistes', 8, '#8a6fd1', 'Plus de pouvoirs aux régions'],
  ['Libéraux', 22, '#4a90d9', 'Moins de charges'], ['Droite républicaine', 42, '#1f4e9a', 'L’autorité de l’État'],
  ['Droite nationale', 72, '#3b3b70', 'La souveraineté d’abord'],
];
const TOTAL = 577;
const MAJ = 289;

/** L'arithmétique de la majorité : réunir 289 sièges sans écarteler la coalition */
@Component({
  selector: 'app-majorite-game',
  template: `
    <div class="maj">
      <div class="count" [class.ok]="seats() >= majority">
        <strong class="mono">{{ seats() }}</strong> / {{ majority }} sièges
        <span class="gap">· écart idéologique <b class="mono">{{ spread() }}</b></span>
      </div>
      <div class="hemi" aria-hidden="true">
        @for (g of groups; track g.id) { <i [style.flex]="g.seats" [style.background]="g.color" [class.on]="picked().has(g.id)"></i> }
      </div>
      <div class="list">
        @for (g of groups; track g.id) {
          <button type="button" class="grp" [class.on]="picked().has(g.id)" (click)="toggle(g)" [disabled]="over()">
            <span class="dot" [style.background]="g.color"></span>
            <span class="nm">{{ g.name }} @if (g.id === own) { <b class="own">votre groupe</b> } <small class="muted">· {{ g.demand }}</small></span>
            <span class="mono seats">{{ g.seats }}</span>
          </button>
        }
      </div>
      @if (!over()) {
        <p class="hint muted">Plus l’écart entre le groupe le plus à gauche et le plus à droite est grand, plus la coalition est fragile. Votre groupe est déjà dedans.</p>
        <button class="btn primary" (click)="sign()" [disabled]="seats() < majority">Signer l’accord de coalition</button>
      } @else { <p class="said">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .maj { display: grid; gap: 10px; }
    .count { font-size: 14px; strong { font-size: 22px; } &.ok strong { color: var(--good); } .gap { color: var(--ink-3); font-size: 12.5px; } }
    .hemi { display: flex; height: 16px; border-radius: 8px; overflow: hidden; gap: 1px;
      i { opacity: .25; transition: opacity .25s, transform .25s; } i.on { opacity: 1; transform: scaleY(1.25); } }
    .list { display: grid; gap: 5px; }
    .grp { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; text-align: left; padding: 7px 10px; border-radius: 10px;
      border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 13px var(--font-body); cursor: pointer;
      .dot { width: 12px; height: 12px; border-radius: 50%; } small { font-size: 11.5px; }
      .own { font-size: 10.5px; padding: 1px 6px; border-radius: 999px; background: var(--accent); color: var(--surface); }
      &.on { border-color: var(--accent); background: var(--accent-soft); } &:disabled { cursor: default; } }
    .hint { margin: 0; font-size: 12px; } .said { margin: 0; font-weight: 600; text-align: center; font-size: 13px; }
  `,
})
export class MajoriteGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly majority = MAJ;
  protected groups: Group[] = [];
  protected own = '';
  protected readonly picked = signal(new Set<string>());
  protected readonly over = signal(false);
  protected readonly message = signal('');
  protected readonly seats = computed(() => this.groups.filter(g => this.picked().has(g.id)).reduce((s, g) => s + g.seats, 0));
  protected readonly spread = computed(() => {
    const ps = this.groups.filter(g => this.picked().has(g.id)).map(g => g.pos);
    return ps.length ? Math.max(...ps) - Math.min(...ps) : 0;
  });
  private best = 200;

  ngOnInit(): void {
    // Un hémicycle émietté : aucun groupe n'a la majorité seul
    const raw = NAMES.map(([name, pos, color, demand], i) => ({ id: `g${i}`, name: name as string, pos: (pos as number) + Math.round((Math.random() - 0.5) * 10), color: color as string, demand: demand as string, w: 0.4 + Math.random() }));
    const total = raw.reduce((s, g) => s + g.w, 0);
    this.groups = raw.map(g => ({ ...g, seats: Math.max(8, Math.round((g.w / total) * TOTAL)) }));
    const fix = TOTAL - this.groups.reduce((s, g) => s + g.seats, 0);
    this.groups[4].seats += fix;
    this.own = this.groups[Math.floor(Math.random() * this.groups.length)].id;
    this.picked.set(new Set([this.own]));
    this.best = this.optimal();
  }

  /** Le plus petit écart idéologique qui atteint la majorité (recherche exhaustive, 9 groupes) */
  private optimal(): number {
    let best = 999;
    const n = this.groups.length;
    const own = this.groups.findIndex(g => g.id === this.own);
    for (let mask = 0; mask < 1 << n; mask++) {
      if (!(mask & (1 << own))) continue;
      let s = 0, lo = 999, hi = -999;
      for (let i = 0; i < n; i++) if (mask & (1 << i)) { s += this.groups[i].seats; lo = Math.min(lo, this.groups[i].pos); hi = Math.max(hi, this.groups[i].pos); }
      if (s >= MAJ && hi - lo < best) best = hi - lo;
    }
    return best;
  }

  protected toggle(g: Group): void {
    if (this.over() || g.id === this.own) return;
    const set = new Set(this.picked());
    if (set.has(g.id)) set.delete(g.id); else set.add(g.id);
    this.picked.set(set);
    this.progress.emit({ live: Math.min(1, this.seats() / MAJ), time: 1 });
  }

  protected sign(): void {
    if (this.seats() < MAJ) return;
    this.over.set(true);
    const extra = this.spread() - this.best;
    const surplus = this.seats() - MAJ;
    const s = Math.max(0.2, Math.min(1, 1 - extra / 80 - Math.max(0, surplus - 40) / 400));
    this.message.set(extra <= 5 ? 'Une coalition cohérente et solide : les éditorialistes saluent l’équilibre.' : extra <= 30 ? 'Une coalition viable, mais il faudra ménager les ailes.' : 'Un attelage hétéroclite : la première motion de censure sera périlleuse.');
    if (extra > 30) this.miss.emit();
    this.progress.emit({ live: s, time: 0 });
    setTimeout(() => this.done.emit(s), 2200);
  }
}

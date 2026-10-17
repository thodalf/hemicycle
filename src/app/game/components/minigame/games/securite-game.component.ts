import { Component, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

const W = 7, H = 4;

/** Le plan de sécurité : placer ses équipes là où le risque est le plus fort */
@Component({
  selector: 'app-securite-game',
  template: `
    <div class="sec">
      <p class="hint">@if (!over()) { {{ agents() }} équipe{{ agents() > 1 ? 's' : '' }} à placer sur le parcours. Chacune couvre sa case et les cases voisines. Les zones rouges sont les plus sensibles. } @else { {{ message() }} }</p>
      <div class="grid" [style.grid-template-columns]="'repeat(' + w + ', 1fr)'">
        @for (c of cells; track $index; let k = $index) {
          <button type="button" class="cell" [class.route]="route.has(k)" [class.agent]="placed().includes(k)" [class.cov]="covered().has(k)" [disabled]="over()"
                  [style.--r]="risk[k] / 3" (click)="toggle(k)" [attr.aria-label]="'Case ' + (k + 1) + ', risque ' + risk[k]">
            @if (placed().includes(k)) { 👮 } @else if (risk[k] >= 3) { ⚠️ }
          </button>
        }
      </div>
      <div class="cover"><span>Risque couvert</span><i><em [style.width.%]="ratio() * 100"></em></i><b>{{ (ratio() * 100).toFixed(0) }} %</b></div>
      @if (!over()) { <button class="btn primary small" [disabled]="placed().length < agents()" (click)="finish()">Valider le plan ({{ placed().length }}/{{ agents() }})</button> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .sec { display: grid; gap: 10px; }
    .hint { margin: 0; font-size: 12.5px; color: var(--ink-2); }
    .grid { display: grid; gap: 4px; padding: 8px; width: 100%; max-width: 480px; justify-self: center; border-radius: 12px; background: #dfe5d8; }
    .cell { aspect-ratio: 1; border: 0; border-radius: 6px; background: color-mix(in srgb, #c0392b calc(var(--r) * 75%), #f3f1ea); font-size: 18px; cursor: pointer; position: relative; transition: transform .1s ease;
      &.route { box-shadow: inset 0 0 0 2px rgba(31, 58, 95, .35); } &.cov::after { content: ''; position: absolute; inset: 0; border-radius: 6px; background: rgba(31, 58, 95, .28); }
      &.agent { background: #1f3a5f; } &:not(:disabled):active { transform: scale(.94); } }
    .cover { display: grid; grid-template-columns: auto 1fr 44px; gap: 8px; align-items: center; font-size: 12.5px;
      i { height: 10px; border-radius: 5px; background: var(--line); overflow: hidden; } em { display: block; height: 100%; background: var(--good); transition: width .25s ease; } b { text-align: right; } }
  `,
})
export class SecuriteGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly w = W;
  protected cells = Array.from({ length: W * H });
  protected risk: number[] = [];
  protected route = new Set<number>();
  protected readonly agents = signal(4);
  protected readonly placed = signal<number[]>([]);
  protected readonly over = signal(false);
  protected readonly message = signal('');
  private total = 1;
  private best = 1;
  protected readonly covered = computed(() => this.coverOf(this.placed()));
  protected readonly ratio = computed(() => [...this.covered()].reduce((t, k) => t + this.risk[k], 0) / this.total);

  ngOnInit(): void {
    this.agents.set(this.diff() >= 1.2 ? 3 : 4);
    // Un parcours de cortège qui serpente, et des points chauds le long du trajet
    let y = Math.floor(Math.random() * H);
    for (let x = 0; x < W; x++) {
      this.route.add(y * W + x);
      if (Math.random() < 0.4) { const ny = Math.max(0, Math.min(H - 1, y + (Math.random() < 0.5 ? -1 : 1))); this.route.add(ny * W + x); y = ny; }
    }
    this.risk = this.cells.map((_, k) => (this.route.has(k) ? 1 + Math.floor(Math.random() * 3) : Math.random() < 0.15 ? 1 : 0));
    this.total = this.risk.reduce((t, v) => t + v, 0) || 1;
    this.best = this.bestCover();
  }

  private coverOf(list: number[]): Set<number> {
    const s = new Set<number>();
    for (const k of list) {
      const x = k % W, y = Math.floor(k / W);
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H) s.add(ny * W + nx);
      }
    }
    return s;
  }

  /** Le meilleur plan possible (recherche exhaustive : la grille est petite) */
  private bestCover(): number {
    const n = W * H, a = this.agents();
    let best = 0;
    const pick: number[] = [];
    const go = (start: number) => {
      if (pick.length === a) { best = Math.max(best, [...this.coverOf(pick)].reduce((t, k) => t + this.risk[k], 0)); return; }
      for (let k = start; k < n; k++) { pick.push(k); go(k + 1); pick.pop(); }
    };
    go(0);
    return best || 1;
  }

  protected toggle(k: number): void {
    if (this.over()) return;
    const p = this.placed();
    if (p.includes(k)) this.placed.set(p.filter(x => x !== k));
    else if (p.length < this.agents()) this.placed.set([...p, k]);
    this.progress.emit({ live: this.ratio(), time: 1 - this.placed().length / this.agents() });
  }

  protected finish(): void {
    if (this.over()) return;
    this.over.set(true);
    const got = [...this.covered()].reduce((t, k) => t + this.risk[k], 0);
    const r = Math.min(1, got / this.best);
    if (r < 1) this.miss.emit();
    this.message.set(r >= 1 ? 'Un plan parfait : le cortège passe sans le moindre incident.' : r >= 0.8 ? 'Un bon plan : un ou deux attroupements, vite maîtrisés.' : 'Des trous dans le dispositif : la presse parle de « fiasco sécuritaire ».');
    this.progress.emit({ live: r, time: 0 });
    setTimeout(() => this.done.emit(Math.max(0.1, r)), 2000);
  }
}

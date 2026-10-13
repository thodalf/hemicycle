import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Blip { id: number; x: number; y: number; vx: number; vy: number; friend: boolean }
interface Pop { id: number; x: number; y: number; good: boolean }

const DURATION = 22000;

/** Défense antiaérienne : intercepter les menaces avant qu'elles n'atteignent les villes, épargner les avions civils */
@Component({
  selector: 'app-interception-game',
  template: `
    <div class="sky" role="application" aria-label="Ciel à défendre">
      <div class="radar" aria-hidden="true"></div>
      @for (b of blips(); track b.id) {
        <button type="button" class="blip" [class.friend]="b.friend" [style.left.%]="b.x" [style.top.%]="b.y"
          (pointerdown)="hit(b.id)" [attr.aria-label]="b.friend ? 'Avion civil' : 'Menace'">{{ b.friend ? def().good : def().bad }}</button>
      }
      @for (p of pops(); track p.id) { <span class="pop" [class.ko]="!p.good" [style.left.%]="p.x" [style.top.%]="p.y">{{ p.good ? '💥' : '⚠️' }}</span> }
      <div class="cities" aria-hidden="true">@for (c of cities(); track $index) { <span [class.hit]="c">🏙️</span> }</div>
    </div>
    <div class="legend"><span>{{ def().bad }} à intercepter</span><span>{{ def().good }} à épargner</span><span class="mono">Impacts : {{ impacts() }}</span></div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .sky { position: relative; height: min(52vh, 360px); border-radius: 12px; overflow: hidden; touch-action: manipulation;
      background: linear-gradient(#0b1a33, #1d3b63 70%, #2b4a6e); }
    .radar { position: absolute; left: 50%; bottom: -60%; width: 160%; aspect-ratio: 1; transform: translateX(-50%); border-radius: 50%;
      background: conic-gradient(from 0deg, rgba(120,255,170,.18), transparent 25%); animation: sweep 3s linear infinite; }
    @keyframes sweep { to { transform: translateX(-50%) rotate(360deg); } }
    .blip { position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px; border: 0; background: rgba(255,80,60,.18); border-radius: 50%;
      font-size: 24px; line-height: 44px; padding: 0; cursor: crosshair; }
    .blip.friend { background: rgba(120,190,255,.2); }
    .pop { position: absolute; transform: translate(-50%, -50%); font-size: 28px; pointer-events: none; animation: pop .5s ease-out forwards; }
    @keyframes pop { to { opacity: 0; transform: translate(-50%, -50%) scale(1.6); } }
    .cities { position: absolute; left: 0; right: 0; bottom: 4px; display: flex; justify-content: space-around; font-size: 26px;
      span.hit { filter: grayscale(1) brightness(.6); } }
    .legend { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: var(--ink-2); margin-top: 6px; }
    @media (prefers-reduced-motion: reduce) { .radar, .pop { animation: none; } }
  `,
})
export class InterceptionGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly blips = signal<Blip[]>([]);
  protected readonly pops = signal<Pop[]>([]);
  protected readonly impacts = signal(0);
  protected readonly cities = signal<boolean[]>([false, false, false, false]);
  private seq = 0;
  private hits = 0;
  private friendly = 0;
  private threats = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private over = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timer && clearInterval(this.timer));
  }

  ngOnInit(): void {
    const d = this.diff();
    const t0 = performance.now();
    let last = t0, next = 300;
    this.timer = setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const t = now - t0;
      if (t >= next && t < DURATION - 1500) {
        const friend = Math.random() < 0.22;
        const x = 8 + Math.random() * 84;
        if (friend) {
          const left = Math.random() < 0.5;
          this.blips.update(l => [...l, { id: ++this.seq, x: left ? -5 : 105, y: 10 + Math.random() * 40, vx: left ? 14 : -14, vy: 0, friend: true }]);
        }
        else { this.threats++; this.blips.update(l => [...l, { id: ++this.seq, x, y: -4, vx: (Math.random() - 0.5) * 8, vy: (13 + Math.random() * 7) * d, friend: false }]); }
        next = t + (650 + Math.random() * 450) / d;
      }
      const keep: Blip[] = [];
      for (const b of this.blips()) {
        const nb = { ...b, x: b.x + b.vx * dt, y: b.y + b.vy * dt };
        if (!b.friend && nb.y >= 88) {
          this.impacts.update(n => n + 1);
          const ci = Math.min(3, Math.floor(nb.x / 25));
          this.cities.update(c => c.map((v, i) => (i === ci ? true : v)));
          this.miss.emit();
          continue;
        }
        if (b.friend && (nb.x < -8 || nb.x > 108)) continue;
        keep.push(nb);
      }
      this.blips.set(keep);
      this.progress.emit({ live: this.score(), time: Math.max(0, 1 - t / DURATION) });
      if (t >= DURATION) this.finish();
    }, 40);
  }

  private score(): number {
    return Math.max(0, (this.hits - 1.5 * this.friendly) / Math.max(5, this.threats));
  }

  protected hit(id: number): void {
    if (this.over) return;
    const b = this.blips().find(x => x.id === id);
    if (!b) return;
    if (b.friend) { this.friendly++; this.miss.emit(); } else this.hits++;
    this.pops.update(p => [...p.slice(-5), { id: ++this.seq, x: b.x, y: b.y, good: !b.friend }]);
    this.blips.update(l => l.filter(x => x.id !== id));
  }

  private finish(): void {
    if (this.over) return;
    this.over = true;
    if (this.timer) clearInterval(this.timer);
    const score = Math.min(1, this.score());
    this.progress.emit({ live: score, time: 0 });
    setTimeout(() => this.done.emit(score), 600);
  }
}

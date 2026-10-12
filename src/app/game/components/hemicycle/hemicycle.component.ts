import { Component, computed, effect, input, signal } from '@angular/core';
import { Ballot } from '../../models/game.models';

export interface HemicycleGroup {
  color: string;
  seats: number;
}

interface Seat {
  x: number;
  y: number;
  /** Ordre de dépouillement (gauche → droite) */
  order: number;
  color: string;
  ballot?: Ballot;
}

const BALLOT_COLORS: Record<Ballot, string> = { pour: '#2f8a5b', contre: '#c0392b', abstention: '#c9c3b4' };

/**
 * L'hémicycle en SVG : 577 sièges en demi-cercle, colorés par groupe,
 * puis (au dépouillement) par vote, de la gauche vers la droite.
 */
@Component({
  selector: 'app-hemicycle',
  template: `
    <svg viewBox="-104 -104 208 110" role="img" [attr.aria-label]="label()">
      @for (s of seats(); track s.order) {
        <circle [attr.cx]="s.x" [attr.cy]="s.y" r="2.6"
                [attr.fill]="revealed() && s.ballot ? ballotColor(s.ballot) : s.color"
                [class.dim]="dim() && !s.ballot"
                [style.transition-delay.ms]="revealed() ? s.order * stepMs() : 0" />
      }
      <text x="0" y="-6" text-anchor="middle" class="center">{{ center() }}</text>
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { width: 100%; height: auto; display: block; overflow: visible; }
    circle { transition: fill .25s ease, transform .25s ease; transform-box: fill-box; transform-origin: center; }
    circle.dim { opacity: .55; }
    .center { font: 700 13px var(--font-display); fill: var(--ink); }
    @media (prefers-reduced-motion: reduce) { circle { transition: none; } }
  `,
})
export class HemicycleComponent {
  /** Groupes de la gauche vers la droite */
  readonly groups = input.required<HemicycleGroup[]>();
  /** Bulletins siège par siège, dans l'ordre des groupes (absent : pointage) */
  readonly ballots = input<Ballot[] | null>(null);
  /** Durée du dépouillement animé */
  readonly duration = input(1800);
  readonly center = input('');
  readonly dim = input(false);

  protected readonly revealed = signal(false);
  protected readonly stepMs = computed(() => this.duration() / Math.max(1, this.total()));
  private readonly total = computed(() => this.groups().reduce((t, g) => t + g.seats, 0));
  protected readonly label = computed(() => `Hémicycle de ${this.total()} sièges`);

  protected ballotColor(b: Ballot): string { return BALLOT_COLORS[b]; }

  /** Positions en demi-cercle : rangées concentriques, sièges triés par angle */
  protected readonly seats = computed<Seat[]>(() => {
    const total = this.total();
    if (!total) return [];
    const rows = total > 300 ? 11 : 7;
    const r0 = 40, r1 = 100;
    const radii = Array.from({ length: rows }, (_, i) => r0 + ((r1 - r0) * i) / (rows - 1));
    const sum = radii.reduce((a, b) => a + b, 0);
    const counts = radii.map(r => Math.round((total * r) / sum));
    counts[rows - 1] += total - counts.reduce((a, b) => a + b, 0);
    const pts: { x: number; y: number; a: number; r: number }[] = [];
    radii.forEach((r, i) => {
      const n = counts[i];
      for (let k = 0; k < n; k++) {
        const a = Math.PI - (Math.PI * (k + 0.5)) / n;
        pts.push({ x: Math.cos(a) * r, y: -Math.sin(a) * r, a, r });
      }
    });
    pts.sort((p, q) => q.a - p.a || p.r - q.r);
    const colors: string[] = [];
    for (const g of this.groups()) for (let i = 0; i < g.seats; i++) colors.push(g.color);
    const ballots = this.ballots();
    return pts.map((p, i) => ({ x: p.x, y: p.y, order: i, color: colors[i] ?? '#999', ballot: ballots?.[i] }));
  });

  constructor() {
    // Dès que les bulletins arrivent, le dépouillement commence
    effect(() => {
      const b = this.ballots();
      this.revealed.set(false);
      if (b?.length) setTimeout(() => this.revealed.set(true), 60);
    });
  }
}

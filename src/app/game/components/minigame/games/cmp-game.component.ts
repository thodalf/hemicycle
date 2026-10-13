import { Component, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Amendment { label: string; mine: number; theirs: number; choice: 'tenir' | 'ceder' | 'echanger' | null }

const POOL: [string, number, number][] = [
  ['Article 2 : financement par l’État', 3, 2], ['Article 4 : calendrier d’application', 1, 3], ['Article 5 : contrôle par le Parlement', 2, 2],
  ['Article 7 : exonérations pour les PME', 2, 3], ['Article 9 : rapport annuel au Sénat', 1, 2], ['Article 11 : volet territorial', 3, 1],
  ['Article 12 : clause de revoyure', 1, 1], ['Article 14 : sanctions en cas de non-respect', 3, 3], ['Article 16 : expérimentation régionale', 2, 1],
];

/** Commission mixte paritaire : la nuit des tractations, amendement par amendement */
@Component({
  selector: 'app-cmp-game',
  template: `
    <div class="cmp">
      <p class="muted intro">Sept députés, sept sénateurs, une nuit. Tenez ce qui compte pour vous, cédez ce qui compte pour eux : il faut <strong>{{ need() }}</strong> points de concessions pour un accord.</p>
      <ul>
        @for (a of items(); track a.label; let i = $index) {
          <li>
            <div class="lbl"><strong>{{ a.label }}</strong>
              <small>Pour vous {{ dots(a.mine) }} · pour le Sénat {{ dots(a.theirs) }}</small></div>
            <div class="seg" role="group" [attr.aria-label]="a.label">
              <button type="button" [class.on]="a.choice === 'tenir'" (click)="set(i, 'tenir')">Tenir</button>
              <button type="button" [class.on]="a.choice === 'echanger'" (click)="set(i, 'echanger')">Compromis</button>
              <button type="button" [class.on]="a.choice === 'ceder'" (click)="set(i, 'ceder')">Céder</button>
            </div>
          </li>
        }
      </ul>
      <div class="gauge">
        <span>Concessions : <strong class="mono">{{ given() }}</strong> / {{ need() }} nécessaires</span>
        <span class="bar"><i [style.width.%]="Math.min(100, given() / need() * 100)" [class.ok]="given() >= need()"></i></span>
        <span>Ce que vous gardez : <strong class="mono">{{ kept() }}</strong> / {{ mineTotal() }}</span>
      </div>
      <button class="btn primary" [disabled]="!ready()" (click)="validate()">{{ given() >= need() ? 'Signer l’accord' : 'Passer au vote (sans accord)' }}</button>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .cmp { display: grid; gap: 10px; }
    .intro { margin: 0; font-size: 13px; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    li { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; }
    .lbl { display: grid; font-size: 13px; small { font-size: 11.5px; color: var(--ink-3); } }
    .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden;
      button { border: 0; background: var(--surface); padding: 7px 10px; font: 12.5px var(--font-body); cursor: pointer; color: var(--ink); }
      button + button { border-left: 1px solid var(--line); } button.on { background: var(--accent); color: var(--surface); } }
    .gauge { display: grid; gap: 4px; font-size: 12.5px; }
    .bar { height: 8px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; i { display: block; height: 100%; background: var(--warn); } i.ok { background: var(--good); } }
    .btn { justify-self: start; }
    @media (max-width: 520px) { li { grid-template-columns: 1fr; } }
  `,
})
export class CmpGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();
  protected readonly Math = Math;

  protected readonly items = signal<Amendment[]>([...POOL].sort(() => Math.random() - 0.5).slice(0, 5).map(([label, mine, theirs]) => ({ label, mine, theirs, choice: null })));
  protected readonly theirsTotal = computed(() => this.items().reduce((t, a) => t + a.theirs, 0));
  protected readonly mineTotal = computed(() => this.items().reduce((t, a) => t + a.mine, 0));
  /** Le Sénat exige d'autant plus que la difficulté est grande */
  protected readonly need = computed(() => Math.round(this.theirsTotal() * Math.min(0.75, 0.42 * this.diff())));
  protected readonly given = computed(() => this.items().reduce((t, a) => t + (a.choice === 'ceder' ? a.theirs : a.choice === 'echanger' ? a.theirs / 2 : 0), 0));
  protected readonly kept = computed(() => this.items().reduce((t, a) => t + (a.choice === 'tenir' ? a.mine : a.choice === 'echanger' ? a.mine / 2 : 0), 0));
  protected readonly ready = computed(() => this.items().every(a => a.choice));

  protected dots(n: number): string { return '●'.repeat(n) + '○'.repeat(3 - n); }

  protected set(i: number, choice: Amendment['choice']): void {
    this.items.update(list => list.map((a, j) => (j === i ? { ...a, choice } : a)));
    this.progress.emit({ live: this.given() >= this.need() ? this.kept() / this.mineTotal() : 0.15, time: this.items().filter(a => a.choice).length / this.items().length });
  }

  protected validate(): void {
    const deal = this.given() >= this.need();
    if (!deal) this.miss.emit();
    this.done.emit(deal ? Math.min(1, 0.2 + 0.8 * this.kept() / this.mineTotal()) : 0.15);
  }
}

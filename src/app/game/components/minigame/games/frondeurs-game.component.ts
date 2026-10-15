import { Component, OnDestroy, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

type Vote = 'pour' | 'contre' | 'abstention';
interface Card { name: string; mine: boolean; vote: Vote }

const FIRST = ['Anne', 'Bruno', 'Chloé', 'David', 'Élodie', 'Farid', 'Gaëlle', 'Hugo', 'Inès', 'Jules', 'Karine', 'Louis', 'Maud', 'Nicolas', 'Océane', 'Pierre', 'Rachida', 'Simon', 'Tiphaine', 'Victor'];
const LAST = ['Arnaud', 'Benoît', 'Collin', 'Duval', 'Esnault', 'Fournier', 'Gautier', 'Hamon', 'Jacob', 'Klein', 'Lebrun', 'Marchand', 'Noël', 'Olivier', 'Picard', 'Renaud', 'Sanchez', 'Tessier', 'Vidal', 'Weber'];

/** Repérer les frondeurs : pendant le scrutin public, débusquer les députés de votre groupe qui votent contre la consigne */
@Component({
  selector: 'app-frondeurs-game',
  template: `
    <div class="fr">
      <p class="hint">@if (!over()) { Votre groupe vote <b>pour</b>. Touchez « Frondeur ! » quand un député de <b>votre groupe</b> vote contre ou s’abstient. } @else { {{ message() }} }</p>
      @if (!over() && card(); as c) {
        <div class="card" [class.mine]="c.mine" [class.flash]="flash()">
          <span class="grp">{{ c.mine ? '● Votre groupe' : '○ Autre groupe' }}</span>
          <strong>{{ c.name }}</strong>
          <span class="vote" [class]="c.vote">{{ label(c.vote) }}</span>
        </div>
        <div class="row"><span class="mono">{{ idx() + 1 }} / {{ cards.length }}</span><button class="btn primary big-btn" (click)="tap()">Frondeur !</button><span class="mono">🎯 {{ hits() }}</span></div>
      }
      @if (over()) { <div class="tally"><span>Frondeurs repérés : <b>{{ hits() }}</b> / {{ rebels() }}</span><span>Fausses alertes : <b>{{ wrong() }}</b></span></div> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .fr { display: grid; gap: 12px; }
    .hint { margin: 0; font-size: 12.5px; color: var(--ink-2); }
    .card { display: grid; gap: 4px; justify-items: center; padding: 18px; border-radius: 14px; border: 2px solid var(--line); background: var(--surface); animation: slide .22s ease;
      &.mine { border-color: #1f3a5f; background: color-mix(in srgb, #1f3a5f 8%, var(--surface)); }
      .grp { font: 600 11px var(--font-body); text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); } strong { font: 700 20px var(--font-display); }
      .vote { font: 700 14px var(--font-body); padding: 3px 12px; border-radius: 999px; } .pour { background: var(--good-soft); color: var(--good); } .contre { background: var(--bad-soft); color: var(--bad); } .abstention { background: var(--surface-2); color: var(--ink-2); } }
    .card.flash { animation: slide .22s ease, hit .4s ease; }
    @keyframes slide { from { transform: translateX(30px); opacity: 0; } }
    @keyframes hit { 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 35%, transparent); } }
    .row { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; font-size: 13px; .big-btn { justify-self: center; padding: 12px 28px; font-size: 15px; } }
    .tally { display: flex; justify-content: space-around; font-size: 13px; }
  `,
})
export class FrondeursGameComponent implements OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected cards: Card[] = [];
  protected readonly idx = signal(0);
  protected readonly hits = signal(0);
  protected readonly wrong = signal(0);
  protected readonly flash = signal(false);
  protected readonly over = signal(false);
  protected readonly message = signal('');
  private tapped = new Set<number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  protected readonly card = computed(() => this.cards[this.idx()]);
  protected readonly rebels = computed(() => this.cards.filter(c => c.mine && c.vote !== 'pour').length);

  ngOnInit(): void {
    const f = [...FIRST].sort(() => Math.random() - 0.5), l = [...LAST].sort(() => Math.random() - 0.5);
    this.cards = f.slice(0, 18).map((first, k) => {
      const mine = Math.random() < 0.6;
      const vote: Vote = mine ? (Math.random() < 0.28 ? (Math.random() < 0.6 ? 'contre' : 'abstention') : 'pour') : (['pour', 'contre', 'contre', 'abstention'] as Vote[])[Math.floor(Math.random() * 4)];
      return { name: `${first} ${l[k]}`, mine, vote };
    });
    if (!this.cards.some(c => c.mine && c.vote !== 'pour')) this.cards[5] = { ...this.cards[5], mine: true, vote: 'contre' };
    const step = Math.max(900, 1700 - (this.diff() - 1) * 250);
    this.timer = setInterval(() => this.next(), step);
  }

  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }

  protected label(v: Vote) { return v === 'pour' ? 'Pour' : v === 'contre' ? 'Contre' : 'Abstention'; }

  protected tap(): void {
    const k = this.idx();
    if (this.over() || this.tapped.has(k)) return;
    this.tapped.add(k);
    const c = this.cards[k];
    if (c.mine && c.vote !== 'pour') { this.hits.update(x => x + 1); this.flash.set(true); setTimeout(() => this.flash.set(false), 400); }
    else { this.wrong.update(x => x + 1); this.miss.emit(); }
    this.progress.emit({ live: this.ratio(), time: 1 - (k + 1) / this.cards.length });
  }

  private ratio(): number { return Math.max(0, (this.hits() - this.wrong() * 0.5) / Math.max(1, this.rebels())); }

  private next(): void {
    if (this.idx() + 1 >= this.cards.length) return this.finish();
    this.idx.update(x => x + 1);
  }

  private finish(): void {
    if (this.over()) return;
    if (this.timer) clearInterval(this.timer);
    this.over.set(true);
    const r = Math.min(1, this.ratio());
    if (this.hits() < this.rebels()) this.miss.emit();
    this.message.set(r >= 1 ? 'Aucun frondeur ne vous a échappé : le groupe rentre dans le rang.' : r >= 0.5 ? 'Vous en avez repéré la plupart. Les autres se cachent bien.' : 'Les frondeurs ont voté en toute discrétion. Le groupe se fissure.');
    this.progress.emit({ live: r, time: 0 });
    setTimeout(() => this.done.emit(Math.max(0.1, r)), 2000);
  }
}

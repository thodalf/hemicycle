import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';
import { Article, ArticleOption, Axis, Leader, SUMMITS } from '../../../data/diplomacy';

interface Seat { leader: Leader; sat: number; last?: number }

/** Sommet international : un texte négocié article par article, jusqu'à l'aube */
@Component({
  selector: 'app-sommet-game',
  template: `
    <div class="summit">
      <div class="head">
        <span>{{ summit.title }} · {{ summit.place }}</span>
        <strong class="mono clock" [class.late]="minutes() >= 28 * 60">🕓 {{ clock() }}</strong>
      </div>
      <ul class="table" aria-label="Les dirigeants autour de la table">
        @for (s of seats(); track s.leader.name; let i = $index) {
          <li [class.bad]="s.sat < -1.5" [class.good]="s.sat >= 1.5">
            <span class="flag" aria-hidden="true">{{ s.leader.flag }}</span>
            <span class="who"><strong>{{ s.leader.country }}</strong><small>{{ s.leader.title }} {{ s.leader.name }}</small></span>
            <span class="mood" [attr.aria-label]="'Humeur ' + (s.sat | number: '1.0-1')">{{ mood(s.sat) }}</span>
            @if (s.last !== undefined) { <small class="delta" [class.up]="s.last > 0" [class.down]="s.last < 0">{{ s.last > 0 ? '+' : '' }}{{ s.last | number: '1.0-1' }}</small> } @else { <small class="delta"></small> }
            @if (!over() && apartes() > 0) { <button type="button" class="apart" (click)="aparte(i)" title="Une suspension de séance pour un aparté : +2,5 d’humeur, 40 minutes">Aparté</button> }
          </li>
        }
      </ul>
      @if (!over()) {
        @if (article(); as a) {
          <div class="art">
            <p class="atitle"><strong>{{ a.title }}</strong> <small class="muted">({{ index() + 1 }} / {{ articles.length }} · {{ apartes() }} aparté(s) possible(s))</small></p>
            <div class="opts">
              @for (op of a.options; track op.label) {
                <button type="button" class="opt" (click)="choose(op)">
                  <span>{{ op.label }}</span>
                  <small class="fr" [attr.aria-label]="'Intérêt pour la France : ' + op.france + ' sur 2'">🇫🇷 {{ stars(op.france) }}</small>
                  <small class="muted tags">{{ tags(op) }}</small>
                </button>
              }
            </div>
          </div>
        }
      }
      @if (message()) { <p class="said" aria-live="polite">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .summit { display: grid; gap: 10px; }
    .head { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; flex-wrap: wrap; }
    .clock { font-size: 15px; } .clock.late { color: var(--bad); }
    .table { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 6px; }
    .table li { display: grid; grid-template-columns: auto 1fr auto auto auto; gap: 6px; align-items: center; padding: 6px 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
    .table li.bad { border-color: var(--bad); background: var(--bad-soft); } .table li.good { border-color: var(--good); }
    .flag { font-size: 20px; } .who { display: grid; font-size: 12.5px; line-height: 1.2; small { font-size: 10.5px; color: var(--ink-3); } }
    .mood { font-size: 18px; } .delta { font-size: 11px; min-width: 26px; text-align: right; } .delta.up { color: var(--good); } .delta.down { color: var(--bad); }
    .apart { border: 1px solid var(--line); background: var(--surface-2); border-radius: 6px; font: 11px var(--font-body); padding: 4px 6px; cursor: pointer; color: var(--ink); }
    .art { display: grid; gap: 6px; } .atitle { margin: 0; font-size: 14px; }
    .opts { display: grid; gap: 6px; }
    .opt { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; text-align: left; padding: 9px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); font: 13.5px var(--font-body); color: var(--ink); cursor: pointer; }
    .opt:hover { border-color: var(--accent); } .fr { font-size: 12px; white-space: nowrap; } .tags { grid-column: 1 / -1; font-size: 11px; }
    .said { margin: 0; font-size: 13px; text-align: center; font-weight: 600; }
    @media (max-width: 420px) { .table { grid-template-columns: 1fr; } }
  `,
  imports: [DecimalPipe],
})
export class SommetGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected summit = SUMMITS.ue;
  protected articles: Article[] = [];
  protected readonly seats = signal<Seat[]>([]);
  protected readonly index = signal(0);
  protected readonly minutes = signal(22 * 60);
  protected readonly apartes = signal(3);
  protected readonly gained = signal(0);
  protected readonly over = signal(false);
  protected readonly message = signal('');
  protected readonly article = computed(() => this.articles[this.index()] ?? null);
  protected readonly clock = computed(() => { const m = this.minutes() % (24 * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')} h ${String(m % 60).padStart(2, '0')}`; });

  ngOnInit(): void {
    this.summit = SUMMITS[this.def().summit ?? 'ue'];
    const n = this.diff() > 1.1 ? 6 : 5;
    this.articles = [...this.summit.articles].sort(() => Math.random() - 0.5).slice(0, Math.min(n, this.summit.articles.length));
    this.seats.set(this.summit.leaders.map(leader => ({ leader, sat: 1 + Math.random() - this.diff() * 0.4 })));
    this.message.set('Il est 22 heures. Les traducteurs s’installent. Personne ne repartira avant d’avoir un texte.');
  }

  protected mood(s: number): string { return s >= 2 ? '😀' : s >= 0.5 ? '🙂' : s >= -1.5 ? '😐' : '😠'; }
  protected stars(n: number): string { return '★'.repeat(n) + '☆'.repeat(2 - n); }
  protected tags(op: ArticleOption): string {
    const names: Record<Axis, string> = { climat: 'climat', rigueur: 'rigueur budgétaire', souverainete: 'souveraineté', commerce: 'libre-échange', social: 'social', defense: 'défense' };
    return Object.entries(op.vec).map(([k, v]) => `${v! > 0 ? '+' : '−'} ${names[k as Axis]}`).join(' · ') || 'neutre';
  }

  protected choose(op: ArticleOption): void {
    if (this.over()) return;
    const dot = (l: Leader) => Object.entries(op.vec).reduce((t, [k, v]) => t + (l.profile[k as Axis] ?? 0) * (v ?? 0), 0) / 2;
    this.seats.update(list => list.map(s => { const d = dot(s.leader); return { ...s, sat: s.sat + d, last: d }; }));
    this.gained.update(g => g + op.france);
    const angry = this.seats().filter(s => (s.last ?? 0) <= -1.5).map(s => s.leader.country);
    if (angry.length) this.miss.emit();
    this.message.set(angry.length ? `${angry.join(', ')} ${angry.length > 1 ? 'protestent' : 'proteste'} vivement.` : 'L’article passe sans éclat.');
    this.minutes.update(m => m + Math.round(55 * this.diff()));
    this.index.update(i => i + 1);
    this.report();
    if (this.index() >= this.articles.length || this.minutes() >= 30 * 60) this.finish();
  }

  protected aparte(i: number): void {
    if (this.over() || this.apartes() <= 0) return;
    this.apartes.update(n => n - 1);
    this.seats.update(list => list.map((s, j) => (j === i ? { ...s, sat: s.sat + 2.5, last: 2.5 } : { ...s, last: undefined })));
    this.minutes.update(m => m + 40);
    this.message.set(`Un café en tête-à-tête avec ${this.seats()[i].leader.title.toLowerCase()} ${this.seats()[i].leader.name} : l’ambiance se détend.`);
    if (this.minutes() >= 30 * 60) this.finish();
  }

  private report(): void {
    const done = Math.max(1, this.index());
    const signers = this.seats().filter(s => s.sat >= -1.5).length / this.seats().length;
    this.progress.emit({ live: (this.gained() / (2 * done)) * signers, time: Math.max(0, 1 - (this.minutes() - 22 * 60) / (8 * 60)) });
  }

  private finish(): void {
    if (this.over()) return;
    this.over.set(true);
    const total = this.articles.length;
    const share = this.gained() / (2 * total);
    const refuse = this.seats().filter(s => s.sat < -1.5);
    const dawn = this.minutes() >= 30 * 60 && this.index() < total;
    let score: number;
    if (!refuse.length) {
      score = 0.35 + 0.65 * share * (this.index() / total);
      this.message.set(`${dawn ? 'Six heures du matin : on signe ce qui est prêt. ' : ''}Accord signé à l’unanimité ! Intérêts français préservés : ${Math.round(share * 100)} %.`);
    } else {
      score = 0.1 + 0.25 * share;
      this.message.set(`Pas d’accord : ${refuse.map(s => s.leader.country).join(', ')} ${refuse.length > 1 ? 'refusent' : 'refuse'} de signer. Le sommet se termine sur un constat d’échec.`);
    }
    this.progress.emit({ live: score, time: 0 });
    setTimeout(() => this.done.emit(Math.max(0, Math.min(1, score))), 2600);
  }
}

import { Component, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';
import { GUESTS, Guest, VISIT_STEPS, VisitOption } from '../../../data/diplomacy';

/** Visite d'État : cadeau, menu, toast et programme, sans faux pas */
@Component({
  selector: 'app-visite-game',
  template: `
    <div class="visit">
      <div class="guest">
        <span class="flag" aria-hidden="true">{{ guest.flag }}</span>
        <span><strong>{{ guest.title }} {{ guest.name }}</strong><small class="muted"> · {{ guest.country }}</small></span>
        <span class="mood" aria-label="Humeur de l’invité">{{ moodIcon() }}</span>
      </div>
      <div class="fiche">
        <strong>Fiche du protocole</strong>
        <ul>@for (h of hints; track h) { <li>{{ h }}</li> }</ul>
      </div>
      @if (!over()) {
        @if (step(); as st) {
          <p class="stitle"><strong>{{ st.title }}</strong> <small class="muted">({{ index() + 1 }} / {{ steps.length }})</small></p>
          <div class="opts">
            @for (o of st.options; track o.label) { <button type="button" class="opt" (click)="choose(o)">{{ o.label }}</button> }
          </div>
        }
      }
      @if (log().length) {
        <ol class="log">
          @for (l of log(); track $index) { <li [class]="l.kind"><span>{{ l.icon }}</span> {{ l.text }}</li> }
        </ol>
      }
      @if (message()) { <p class="said" aria-live="polite">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .visit { display: grid; gap: 10px; }
    .guest { display: flex; align-items: center; gap: 10px; font-size: 14px; .flag { font-size: 26px; } .mood { margin-left: auto; font-size: 22px; } }
    .fiche { border: 1px dashed var(--line); border-radius: 10px; padding: 8px 12px; font-size: 12.5px; background: var(--surface-2);
      ul { margin: 4px 0 0; padding-left: 18px; } }
    .stitle { margin: 0; font-size: 14px; }
    .opts { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px; }
    .opt { text-align: left; padding: 9px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); font: 13.5px var(--font-body); color: var(--ink); cursor: pointer; }
    .opt:hover { border-color: var(--accent); }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 12.5px; }
    .log li { padding: 4px 8px; border-radius: 6px; background: var(--surface-2); } .log li.good { background: var(--good-soft); } .log li.bad { background: var(--bad-soft); }
    .said { margin: 0; font-size: 13px; text-align: center; font-weight: 600; }
  `,
})
export class VisiteGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected guest: Guest = GUESTS[0];
  protected hints: string[] = [];
  protected readonly steps = VISIT_STEPS;
  protected readonly index = signal(0);
  protected readonly points = signal(0);
  protected readonly incidents = signal(0);
  protected readonly over = signal(false);
  protected readonly message = signal('');
  protected readonly log = signal<{ icon: string; text: string; kind: string }[]>([]);
  protected readonly step = computed(() => this.steps[this.index()] ?? null);
  protected readonly moodIcon = computed(() => (this.incidents() ? '😠' : this.points() >= this.index() * 0.8 && this.index() ? '😀' : '🙂'));

  ngOnInit(): void {
    this.guest = GUESTS[Math.floor(Math.random() * GUESTS.length)];
    // Plus c'est difficile, moins la fiche du protocole en dit
    this.hints = this.diff() > 1.1 ? this.guest.hints.slice(0, 1) : this.guest.hints;
  }

  protected choose(o: VisitOption): void {
    if (this.over()) return;
    const bad = o.tags.some(t => this.guest.dislikes.includes(t));
    const good = !bad && o.tags.some(t => this.guest.likes.includes(t));
    if (bad) {
      this.incidents.update(n => n + 1);
      this.miss.emit();
      this.log.update(l => [...l, { icon: '😠', text: `${o.label} : froid glacial dans la délégation.`, kind: 'bad' }]);
    } else {
      this.points.update(p => p + (good ? 1 : 0.5));
      this.log.update(l => [...l, { icon: good ? '😀' : '😐', text: good ? `${o.label} : votre invité·e est ravi·e.` : `${o.label} : poli, sans plus.`, kind: good ? 'good' : '' }]);
    }
    this.index.update(i => i + 1);
    this.progress.emit({ live: this.score(), time: 1 - this.index() / this.steps.length });
    if (this.index() >= this.steps.length) this.finish();
  }

  private score(): number {
    const base = this.points() / this.steps.length;
    return this.incidents() ? Math.min(0.45, base) / (1 + this.incidents() * 0.5) : base;
  }

  private finish(): void {
    this.over.set(true);
    const s = this.score();
    this.message.set(this.incidents() ? `Incident diplomatique : la presse ${this.guest.country === 'États-Unis' ? 'américaine' : 'étrangère'} se moque de la France.` : s >= 0.85 ? 'Une visite parfaite : on parlera longtemps de l’amitié entre vos deux pays.' : 'Une visite réussie, sans fausse note.');
    this.progress.emit({ live: s, time: 0 });
    setTimeout(() => this.done.emit(s), 2400);
  }
}

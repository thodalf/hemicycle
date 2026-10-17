import { Component, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Quote { text: string; who: string }

/** Des phrases historiques, courtes et célèbres */
const QUOTES: Quote[] = [
  { text: '« L’État, c’est moi. »', who: 'Louis XIV (attribuée)' },
  { text: '« Paris vaut bien une messe. »', who: 'Henri IV (attribuée)' },
  { text: '« De l’audace, encore de l’audace, toujours de l’audace. »', who: 'Danton' },
  { text: '« Impossible n’est pas français. »', who: 'Napoléon Ier' },
  { text: '« J’accuse… ! »', who: 'Émile Zola' },
  { text: '« Je vous ai compris ! »', who: 'Charles de Gaulle' },
  { text: '« Vous n’avez pas le monopole du cœur. »', who: 'Valéry Giscard d’Estaing' },
  { text: '« Ich bin ein Berliner. »', who: 'John F. Kennedy' },
  { text: '« I have a dream. »', who: 'Martin Luther King' },
  { text: '« L’homme est né libre, et partout il est dans les fers. »', who: 'Jean-Jacques Rousseau' },
  { text: '« Liberté, que de crimes on commet en ton nom ! »', who: 'Madame Roland' },
  { text: '« Il faut cultiver notre jardin. »', who: 'Voltaire' },
  { text: '« Je n’ai à offrir que du sang, du labeur, des larmes et de la sueur. »', who: 'Winston Churchill' },
  { text: '« Qu’ils mangent de la brioche. »', who: 'Marie-Antoinette (attribuée, sans doute à tort)' },
  { text: '« Le pouvoir arrête le pouvoir. »', who: 'Montesquieu' },
  { text: '« Science sans conscience n’est que ruine de l’âme. »', who: 'Rabelais' },
];

/** Qui a dit quoi ? Relier chaque phrase à son auteur */
@Component({
  selector: 'app-citations-game',
  template: `
    <div class="cit">
      <p class="hint">@if (!over()) { Touchez une citation, puis son auteur. {{ tries() }} essai{{ tries() > 1 ? 's' : '' }}, {{ found() }}/{{ quotes.length }} trouvée{{ found() > 1 ? 's' : '' }}. } @else { {{ message() }} }</p>
      <div class="cols">
        <div class="q">
          @for (q of quotes; track q.text; let i = $index) {
            <button type="button" class="card" [class.sel]="sel() === i" [class.done]="matched().has(i)" [disabled]="matched().has(i) || over()" (click)="sel.set(i)">{{ q.text }}</button>
          }
        </div>
        <div class="a">
          @for (w of authors; track w; let j = $index) {
            <button type="button" class="card who" [class.done]="usedAuthor(w)" [class.shake]="shake() === j" [disabled]="usedAuthor(w) || over()" (click)="pick(w, j)">{{ w }}</button>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .cit { display: grid; gap: 10px; }
    .hint { margin: 0; font-size: 12.5px; color: var(--ink-2); }
    .cols { display: grid; grid-template-columns: 1.4fr 1fr; gap: 8px; }
    .q, .a { display: grid; gap: 6px; align-content: start; }
    .card { text-align: left; padding: 9px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 13px/1.35 Georgia, serif; cursor: pointer; transition: transform .12s ease;
      &.sel { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent); transform: translateX(3px); }
      &.done { background: var(--good-soft); border-color: var(--good); opacity: .8; }
      &.who { font: 600 12.5px var(--font-body); } &.shake { animation: shake .35s ease; border-color: var(--bad); } }
    @keyframes shake { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
    @media (max-width: 520px) { .cols { grid-template-columns: 1fr; } }
  `,
})
export class CitationsGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected quotes: Quote[] = [];
  protected authors: string[] = [];
  protected readonly sel = signal<number | null>(null);
  protected readonly matched = signal(new Set<number>());
  protected readonly tries = signal(0);
  protected readonly shake = signal<number | null>(null);
  protected readonly over = signal(false);
  protected readonly message = signal('');
  protected readonly found = computed(() => this.matched().size);

  ngOnInit(): void {
    const n = this.diff() >= 1.2 ? 6 : 5;
    this.quotes = [...QUOTES].sort(() => Math.random() - 0.5).slice(0, n);
    // Un auteur de trop pour brouiller les pistes
    const extra = QUOTES.filter(q => !this.quotes.includes(q)).sort(() => Math.random() - 0.5)[0];
    this.authors = [...this.quotes.map(q => q.who), extra.who].sort(() => Math.random() - 0.5);
  }

  protected usedAuthor(w: string) { return [...this.matched()].some(i => this.quotes[i].who === w); }

  protected pick(w: string, j: number): void {
    const i = this.sel();
    if (i === null || this.over()) return;
    this.tries.update(t => t + 1);
    if (this.quotes[i].who === w) {
      this.matched.set(new Set([...this.matched(), i]));
      this.sel.set(null);
      this.progress.emit({ live: this.found() / this.quotes.length, time: 1 - this.found() / this.quotes.length });
      if (this.found() === this.quotes.length) this.finish();
    } else {
      this.miss.emit();
      this.shake.set(j);
      setTimeout(() => this.shake.set(null), 380);
      if (this.tries() - this.found() >= this.quotes.length) this.finish();
    }
  }

  private finish(): void {
    this.over.set(true);
    const errors = this.tries() - this.found();
    const r = Math.max(0.1, (this.found() / this.quotes.length) * (1 - Math.min(0.6, errors * 0.12)));
    this.message.set(errors === 0 && this.found() === this.quotes.length ? 'Sans une faute : l’animateur vous serre la main.' : this.found() === this.quotes.length ? `Toutes trouvées, avec ${errors} hésitation${errors > 1 ? 's' : ''}.` : 'Trop d’erreurs : on vous ressortira cette émission.');
    this.progress.emit({ live: r, time: 0 });
    setTimeout(() => this.done.emit(r), 2000);
  }
}

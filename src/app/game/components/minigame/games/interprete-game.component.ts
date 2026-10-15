import { Component, OnDestroy, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Phrase { lang: string; flag: string; text: string; fr: string }

const PHRASES: Phrase[] = [
  { lang: 'Anglais', flag: '🇬🇧', text: 'We must find a compromise.', fr: 'Nous devons trouver un compromis.' },
  { lang: 'Anglais', flag: '🇬🇧', text: 'The deadline is tomorrow at noon.', fr: 'L’échéance est demain à midi.' },
  { lang: 'Anglais', flag: '🇬🇧', text: 'Let’s keep this between us.', fr: 'Gardons cela entre nous.' },
  { lang: 'Anglais', flag: '🇬🇧', text: 'We will not back down.', fr: 'Nous ne reculerons pas.' },
  { lang: 'Allemand', flag: '🇩🇪', text: 'Wir stehen an Ihrer Seite.', fr: 'Nous sommes à vos côtés.' },
  { lang: 'Allemand', flag: '🇩🇪', text: 'Das ist nicht verhandelbar.', fr: 'Ce n’est pas négociable.' },
  { lang: 'Allemand', flag: '🇩🇪', text: 'Wir brauchen eine Garantie.', fr: 'Nous avons besoin d’une garantie.' },
  { lang: 'Espagnol', flag: '🇪🇸', text: 'La propuesta es inaceptable.', fr: 'La proposition est inacceptable.' },
  { lang: 'Espagnol', flag: '🇪🇸', text: 'Necesitamos más tiempo.', fr: 'Nous avons besoin de plus de temps.' },
  { lang: 'Espagnol', flag: '🇪🇸', text: 'No podemos aceptar estas condiciones.', fr: 'Nous ne pouvons pas accepter ces conditions.' },
  { lang: 'Italien', flag: '🇮🇹', text: 'Siamo pronti a firmare l’accordo.', fr: 'Nous sommes prêts à signer l’accord.' },
  { lang: 'Italien', flag: '🇮🇹', text: 'Il vostro paese ha la nostra fiducia.', fr: 'Votre pays a notre confiance.' },
  { lang: 'Italien', flag: '🇮🇹', text: 'La riunione è rinviata.', fr: 'La réunion est reportée.' },
];

/** L'interprète : au sommet, chaque phrase de l'homologue doit être comprise avant la réponse */
@Component({
  selector: 'app-interprete-game',
  template: `
    <div class="int">
      @if (!over()) {
        <div class="top"><span class="mono">{{ i() + 1 }} / {{ rounds.length }}</span><span class="timer"><i [style.width.%]="left() * 100"></i></span><span class="mono">✔ {{ score() }}</span></div>
        @if (rounds[i()]; as r) {
          <div class="bubble"><span class="who">{{ r.p.flag }} {{ r.p.lang }}</span><q>{{ r.p.text }}</q></div>
          @if (shown(); as s) { <p class="why" [class.ok]="s.ok">{{ s.ok ? 'Bien traduit.' : 'Contresens !' }} « {{ r.p.fr }} »</p> }
          @else { <div class="opts">@for (o of r.opts; track o) { <button type="button" (click)="answer(o)">{{ o }}</button> }</div> }
        }
      } @else { <p class="said">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .int { display: grid; gap: 10px; }
    .top { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; font-size: 12.5px; }
    .timer { height: 7px; border-radius: 4px; background: var(--line); overflow: hidden; i { display: block; height: 100%; background: var(--accent); transition: width .1s linear; } }
    .bubble { position: relative; padding: 14px 16px; border-radius: 14px 14px 14px 2px; background: #1f3a5f; color: #fff; display: grid; gap: 4px; animation: in .25s ease;
      .who { font: 600 11px var(--font-body); text-transform: uppercase; letter-spacing: .08em; opacity: .8; } q { font: 600 17px Georgia, serif; quotes: '« ' ' »'; } }
    @keyframes in { from { opacity: 0; transform: translateY(6px); } }
    .opts { display: grid; gap: 6px; button { text-align: left; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 13.5px var(--font-body); cursor: pointer; &:hover { border-color: var(--accent); } } }
    .why { margin: 0; padding: 8px 10px; border-radius: 8px; font-size: 13px; background: var(--bad-soft); &.ok { background: var(--good-soft); } }
    .said { margin: 0; text-align: center; font-weight: 600; font-size: 13px; }
  `,
})
export class InterpreteGameComponent implements OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected rounds: { p: Phrase; opts: string[] }[] = [];
  protected readonly i = signal(0);
  protected readonly score = signal(0);
  protected readonly left = signal(1);
  protected readonly shown = signal<{ ok: boolean } | null>(null);
  protected readonly over = signal(false);
  protected readonly message = signal('');
  private timer: ReturnType<typeof setInterval> | null = null;
  private duration = 9000;
  private started = 0;

  ngOnInit(): void {
    const pool = [...PHRASES].sort(() => Math.random() - 0.5).slice(0, 6);
    this.rounds = pool.map(p => {
      const wrong = PHRASES.filter(x => x !== p).sort(() => Math.random() - 0.5).slice(0, 2).map(x => x.fr);
      return { p, opts: [p.fr, ...wrong].sort(() => Math.random() - 0.5) };
    });
    this.duration = Math.max(5000, 9500 - (this.diff() - 1) * 1300);
    this.clock();
  }

  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }

  private clock(): void {
    if (this.timer) clearInterval(this.timer);
    this.started = Date.now();
    this.left.set(1);
    this.timer = setInterval(() => {
      const l = 1 - (Date.now() - this.started) / this.duration;
      this.left.set(Math.max(0, l));
      if (l <= 0) this.answer(null);
    }, 100);
  }

  protected answer(o: string | null): void {
    if (this.shown() || this.over()) return;
    if (this.timer) clearInterval(this.timer);
    const ok = o === this.rounds[this.i()].p.fr;
    if (ok) this.score.update(x => x + 1); else this.miss.emit();
    this.shown.set({ ok });
    this.progress.emit({ live: this.score() / this.rounds.length, time: 1 - (this.i() + 1) / this.rounds.length });
    setTimeout(() => {
      this.shown.set(null);
      if (this.i() + 1 >= this.rounds.length) return this.finish();
      this.i.update(x => x + 1);
      this.clock();
    }, ok ? 1200 : 2200);
  }

  private finish(): void {
    this.over.set(true);
    const r = this.score() / this.rounds.length;
    this.message.set(r === 1 ? 'Sans un contresens : vos homologues vous félicitent dans leur langue.' : r >= 0.5 ? 'Quelques flottements, rattrapés par un sourire.' : 'Un contresens de trop : l’incident diplomatique est évité de justesse.');
    this.progress.emit({ live: r, time: 0 });
    setTimeout(() => this.done.emit(Math.max(0.1, r)), 2000);
  }
}

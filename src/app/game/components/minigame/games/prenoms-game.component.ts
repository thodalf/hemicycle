import { Component, OnDestroy, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Person { name: string; job: string; icon: string; detail: string }

const NAMES_F = ['Martine', 'Sophie', 'Nadia', 'Claire', 'Yasmine', 'Odile', 'Léa', 'Fatou', 'Brigitte', 'Hélène', 'Inès', 'Monique'];
const NAMES_M = ['Gérard', 'Karim', 'Thierry', 'Paul', 'Mamadou', 'Jean-Luc', 'Hugo', 'Bernard', 'Rachid', 'Patrick', 'Lucas', 'Yves'];
const JOBS: { job: string; icon: string; f: boolean }[] = [
  { job: 'la boulangère', icon: '🥖', f: true }, { job: 'le maraîcher', icon: '🥕', f: false }, { job: 'l’infirmière', icon: '🩺', f: true },
  { job: 'le pompier', icon: '🚒', f: false }, { job: 'la maîtresse d’école', icon: '📚', f: true }, { job: 'le cafetier', icon: '☕', f: false },
  { job: 'la pharmacienne', icon: '💊', f: true }, { job: 'le facteur', icon: '✉️', f: false }, { job: 'la fleuriste', icon: '💐', f: true },
  { job: 'le chauffeur de bus', icon: '🚌', f: false }, { job: 'la présidente du club de foot', icon: '⚽', f: true }, { job: 'le curé', icon: '⛪', f: false },
];
const DETAILS = ['a trois petits-enfants', 'court le marathon', 'arrive de Lyon', 'fête ses 60 ans', 'vient d’ouvrir', 'chante à la chorale', 'élève des poules', 'a voté pour vous', 'joue de l’accordéon', 'part à la retraite'];

/** Le bain de foule : retenir les prénoms et les métiers des gens rencontrés */
@Component({
  selector: 'app-prenoms-game',
  template: `
    <div class="pr">
      @if (phase() === 'show') {
        <p class="hint">Retenez bien qui est qui : dans un instant, il faudra saluer chacun par son prénom. <b class="mono">{{ countdown() }} s</b></p>
        <div class="people">
          @for (p of people; track p.name) {
            <div class="pp"><span class="ic">{{ p.icon }}</span><b>{{ p.name }}</b><small>{{ p.job }}</small><small class="det">{{ p.detail }}</small></div>
          }
        </div>
      } @else if (phase() === 'ask' && q(); as cur) {
        <div class="top"><span class="mono">{{ i() + 1 }} / {{ questions.length }}</span><span class="mono">✔ {{ score() }}</span></div>
        <div class="who"><span class="ic big">{{ cur.p.icon }}</span><p>« Bonjour… »<br><small>C’est {{ cur.p.job }}, qui {{ cur.p.detail }}.</small></p></div>
        @if (shown(); as s) { <p class="why" [class.ok]="s.ok">{{ s.ok ? 'Bonjour ' + cur.p.name + ' ! Un sourire radieux : on se souvient de vous.' : 'Raté : c’était ' + cur.p.name + '. Un léger froid.' }}</p> }
        @else { <div class="opts">@for (o of cur.opts; track o) { <button type="button" (click)="answer(o)">{{ o }}</button> }</div> }
      } @else { <p class="said">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .pr { display: grid; gap: 10px; }
    .hint { margin: 0; font-size: 12.5px; color: var(--ink-2); }
    .people { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
    .pp { display: grid; justify-items: center; gap: 2px; padding: 10px 6px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); text-align: center; animation: pop .35s ease both;
      .ic { font-size: 26px; } b { font: 700 15px var(--font-display); } small { font-size: 11.5px; color: var(--ink-2); } .det { color: var(--ink-3); font-style: italic; } }
    .pp:nth-child(2) { animation-delay: .06s; } .pp:nth-child(3) { animation-delay: .12s; } .pp:nth-child(4) { animation-delay: .18s; } .pp:nth-child(5) { animation-delay: .24s; } .pp:nth-child(6) { animation-delay: .3s; }
    @keyframes pop { from { opacity: 0; transform: scale(.8); } }
    .top { display: flex; justify-content: space-between; font-size: 12.5px; }
    .who { display: flex; gap: 12px; align-items: center; padding: 12px 14px; border-radius: 14px; background: var(--surface-2); animation: pop .3s ease;
      .big { font-size: 34px; } p { margin: 0; font: 600 15px var(--font-body); } small { font-weight: 400; color: var(--ink-2); font-size: 12.5px; } }
    .opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; button { padding: 10px 6px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 600 14px var(--font-body); cursor: pointer; &:hover { border-color: var(--accent); } } }
    .why { margin: 0; padding: 8px 10px; border-radius: 8px; font-size: 13px; background: var(--bad-soft); &.ok { background: var(--good-soft); } }
    .said { margin: 0; text-align: center; font-weight: 600; font-size: 13px; }
    @media (prefers-reduced-motion: reduce) { .pp, .who { animation: none; } }
  `,
})
export class PrenomsGameComponent implements OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected people: Person[] = [];
  protected questions: { p: Person; opts: string[] }[] = [];
  protected readonly phase = signal<'show' | 'ask' | 'end'>('show');
  protected readonly countdown = signal(10);
  protected readonly i = signal(0);
  protected readonly score = signal(0);
  protected readonly shown = signal<{ ok: boolean } | null>(null);
  protected readonly message = signal('');
  private timer: ReturnType<typeof setInterval> | null = null;
  protected q() { return this.questions[this.i()]; }

  ngOnInit(): void {
    const n = this.diff() >= 1.2 ? 6 : 5;
    const jobs = [...JOBS].sort(() => Math.random() - 0.5).slice(0, n);
    const f = [...NAMES_F].sort(() => Math.random() - 0.5), m = [...NAMES_M].sort(() => Math.random() - 0.5);
    const det = [...DETAILS].sort(() => Math.random() - 0.5);
    this.people = jobs.map((j, k) => ({ name: j.f ? f[k] : m[k], job: j.job, icon: j.icon, detail: det[k] }));
    const names = this.people.map(p => p.name);
    this.questions = [...this.people].sort(() => Math.random() - 0.5).map(p => {
      const wrong = names.filter(x => x !== p.name).sort(() => Math.random() - 0.5).slice(0, 2);
      return { p, opts: [p.name, ...wrong].sort(() => Math.random() - 0.5) };
    });
    const secs = Math.round(Math.max(6, 13 - this.diff() * 2));
    this.countdown.set(secs);
    this.timer = setInterval(() => {
      this.countdown.update(x => x - 1);
      this.progress.emit({ live: 0, time: this.countdown() / secs });
      if (this.countdown() <= 0) { if (this.timer) clearInterval(this.timer); this.phase.set('ask'); }
    }, 1000);
  }

  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }

  protected answer(o: string): void {
    if (this.shown()) return;
    const ok = o === this.q().p.name;
    if (ok) this.score.update(x => x + 1); else this.miss.emit();
    this.shown.set({ ok });
    this.progress.emit({ live: this.score() / this.questions.length, time: 1 - (this.i() + 1) / this.questions.length });
    setTimeout(() => {
      this.shown.set(null);
      if (this.i() + 1 >= this.questions.length) return this.finish();
      this.i.update(x => x + 1);
    }, ok ? 1100 : 1900);
  }

  private finish(): void {
    this.phase.set('end');
    const r = this.score() / this.questions.length;
    this.message.set(r === 1 ? 'Chacun salué par son prénom : on en parlera longtemps au marché.' : r >= 0.6 ? 'Quelques hésitations, rattrapées par un grand sourire.' : 'Vous avez appelé la boulangère « Monique ». Elle s’appelle autrement.');
    this.progress.emit({ live: r, time: 0 });
    setTimeout(() => this.done.emit(Math.max(0.1, r)), 2000);
  }
}

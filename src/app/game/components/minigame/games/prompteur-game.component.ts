import { Component, OnDestroy, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/** Une phrase du discours, le mot juste et le mot saboté */
const LINES: [string, string, string][] = [
  ['Je veux une France plus juste et plus forte.', 'forte', 'faible'],
  ['Nous baisserons les impôts des classes moyennes.', 'baisserons', 'doublerons'],
  ['Mes chers compatriotes, merci de votre confiance.', 'confiance', 'méfiance'],
  ['Chaque enfant doit pouvoir réussir à l’école.', 'réussir', 'échouer'],
  ['Nous protégerons nos agriculteurs.', 'protégerons', 'abandonnerons'],
  ['La République ne cédera jamais à la violence.', 'jamais', 'toujours'],
  ['Je serai le président de tous les Français.', 'tous', 'quelques'],
  ['Nous construirons cent mille logements.', 'construirons', 'démolirons'],
  ['L’Europe est notre plus grande chance.', 'chance', 'menace'],
  ['Je tends la main à l’opposition.', 'main', 'poing'],
  ['Nos soignants méritent notre reconnaissance.', 'reconnaissance', 'indifférence'],
  ['Ensemble, nous allons relever le pays.', 'relever', 'renverser'],
  ['La planète n’attendra pas : agissons maintenant.', 'maintenant', 'demain'],
  ['Nos aînés ont bâti ce pays, nous leur devons le respect.', 'respect', 'silence'],
];

/** Le prompteur saboté : repérer le mot changé avant de le prononcer */
@Component({
  selector: 'app-prompteur-game',
  template: `
    <div class="pt">
      @if (!over()) {
        <div class="top"><span class="mono">{{ i() + 1 }} / {{ rounds.length }}</span><span class="timer"><i [style.width.%]="left() * 100"></i></span><span class="mono">✔ {{ score() }}</span></div>
        <p class="hint">Quelqu’un a trafiqué le prompteur : touchez le mot saboté avant de le lire en direct.</p>
        <div class="screen" [class.flash]="shown()?.ok === true" [class.bad]="shown()?.ok === false">
          @for (w of words(); track $index; let k = $index) {
            <button type="button" class="w" [class.hit]="shown() && k === rounds[i()].bad" [disabled]="!!shown()" (click)="tap(k)">{{ w }}</button>
          }
        </div>
        @if (shown(); as s) { <p class="why" [class.ok]="s.ok">{{ s.ok ? 'Bien vu : « ' + rounds[i()].good + ' », évidemment.' : 'Trop tard ! Vous avez dit « ' + rounds[i()].wrong + ' » en direct.' }}</p> }
      } @else { <p class="said">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .pt { display: grid; gap: 10px; }
    .top { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; font-size: 12.5px; }
    .timer { height: 7px; border-radius: 4px; background: var(--line); overflow: hidden; i { display: block; height: 100%; background: var(--accent); transition: width .1s linear; } }
    .hint { margin: 0; font-size: 12.5px; color: var(--ink-2); }
    .screen { display: flex; flex-wrap: wrap; gap: 4px 6px; justify-content: center; padding: 22px 16px; border-radius: 12px; background: #101418; box-shadow: inset 0 0 40px rgba(0,0,0,.6); min-height: 110px; align-content: center;
      animation: scroll-in .35s ease; }
    .screen.flash { box-shadow: inset 0 0 0 3px var(--good); } .screen.bad { box-shadow: inset 0 0 0 3px var(--bad); }
    @keyframes scroll-in { from { transform: translateY(16px); opacity: 0; } }
    .w { border: 0; background: none; color: #f3f1e8; font: 600 20px Georgia, serif; padding: 2px 3px; border-radius: 4px; cursor: pointer;
      &:not(:disabled):hover { background: rgba(255,255,255,.12); } &.hit { background: #e8b23a; color: #101418; } }
    .why { margin: 0; padding: 8px 10px; border-radius: 8px; font-size: 13px; background: var(--bad-soft); &.ok { background: var(--good-soft); } }
    .said { margin: 0; text-align: center; font-weight: 600; font-size: 13px; }
    @media (prefers-reduced-motion: reduce) { .screen { animation: none; } }
  `,
})
export class PrompteurGameComponent implements OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected rounds: { tokens: string[]; bad: number; good: string; wrong: string }[] = [];
  protected readonly i = signal(0);
  protected readonly score = signal(0);
  protected readonly left = signal(1);
  protected readonly shown = signal<{ ok: boolean } | null>(null);
  protected readonly over = signal(false);
  protected readonly message = signal('');
  protected readonly words = signal<string[]>([]);
  private timer: ReturnType<typeof setInterval> | null = null;
  private duration = 7000;

  ngOnInit(): void {
    this.rounds = [...LINES].sort(() => Math.random() - 0.5).slice(0, 6).map(([text, good, wrong]) => {
      const tokens = text.split(' ');
      const bad = tokens.findIndex(t => t.replace(/[.,:!?]/g, '').replace(/^[a-z]’/i, '') === good || t.startsWith(good));
      tokens[bad] = tokens[bad].replace(good, wrong);
      return { tokens, bad, good, wrong };
    });
    this.duration = Math.max(3500, 7500 - (this.diff() - 1) * 1200);
    this.load();
  }

  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }

  private load(): void {
    this.words.set(this.rounds[this.i()].tokens);
    if (this.timer) clearInterval(this.timer);
    const t0 = Date.now();
    this.left.set(1);
    this.timer = setInterval(() => {
      const l = 1 - (Date.now() - t0) / this.duration;
      this.left.set(Math.max(0, l));
      if (l <= 0) this.tap(-1);
    }, 100);
  }

  protected tap(k: number): void {
    if (this.shown() || this.over()) return;
    if (this.timer) clearInterval(this.timer);
    const ok = k === this.rounds[this.i()].bad;
    if (ok) this.score.update(x => x + 1); else this.miss.emit();
    this.shown.set({ ok });
    this.progress.emit({ live: this.score() / this.rounds.length, time: 1 - (this.i() + 1) / this.rounds.length });
    setTimeout(() => {
      this.shown.set(null);
      if (this.i() + 1 >= this.rounds.length) return this.finish();
      this.i.update(x => x + 1);
      this.load();
    }, ok ? 1000 : 2000);
  }

  private finish(): void {
    this.over.set(true);
    const r = this.score() / this.rounds.length;
    this.message.set(r === 1 ? 'Pas un mot de travers : le saboteur en est pour ses frais.' : r >= 0.5 ? 'Un ou deux lapsus, vite rattrapés : les réseaux s’amusent, sans plus.' : 'Les lapsus s’enchaînent : la vidéo fait déjà le tour des réseaux.');
    this.progress.emit({ live: r, time: 0 });
    setTimeout(() => this.done.emit(Math.max(0.1, r)), 2000);
  }
}

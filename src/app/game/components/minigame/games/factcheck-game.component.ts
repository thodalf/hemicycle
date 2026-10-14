import { Component, OnDestroy, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

type Verdict = 'vrai' | 'faux' | 'trompeur';
interface Claim { text: string; v: Verdict; why: string }

/** Des affirmations entendues sur les plateaux : vraies, fausses, ou trompeuses */
const CLAIMS: Claim[] = [
  { text: 'L’Assemblée nationale compte 577 députés.', v: 'vrai', why: '577 sièges, dont 11 pour les Français de l’étranger.' },
  { text: 'La majorité absolue à l’Assemblée est de 289 sièges.', v: 'vrai', why: 'La moitié de 577, plus un.' },
  { text: 'Le Sénat est élu au suffrage universel direct.', v: 'faux', why: 'Les sénateurs sont élus par de grands électeurs : suffrage indirect.' },
  { text: 'Le président de la République est élu pour sept ans.', v: 'faux', why: 'Le quinquennat a remplacé le septennat en 2000.' },
  { text: 'Le Premier ministre est élu par l’Assemblée nationale.', v: 'faux', why: 'Il est nommé par le président de la République.' },
  { text: 'La Ve République a été fondée en 1958.', v: 'vrai', why: 'Constitution adoptée par référendum le 28 septembre 1958.' },
  { text: 'La peine de mort a été abolie en France en 1981.', v: 'vrai', why: 'Loi Badinter du 9 octobre 1981.' },
  { text: 'Les femmes ont voté pour la première fois en France en 1945.', v: 'vrai', why: 'Aux municipales d’avril 1945, après l’ordonnance de 1944.' },
  { text: 'Les sénateurs sont élus pour six ans.', v: 'vrai', why: 'Six ans, renouvelés par moitié tous les trois ans.' },
  { text: 'Un député peut aussi être maire d’une grande ville.', v: 'faux', why: 'Le cumul avec un mandat exécutif local est interdit depuis 2017.' },
  { text: 'Le drapeau tricolore est inscrit dans la Constitution.', v: 'vrai', why: 'Article 2 : « L’emblème national est le drapeau tricolore, bleu, blanc, rouge. »' },
  { text: 'Le budget de l’État est voté chaque année par le Parlement.', v: 'vrai', why: 'C’est la loi de finances annuelle.' },
  { text: 'La France métropolitaine compte 101 départements.', v: 'faux', why: '101 départements en tout, dont 5 en outre-mer : 96 en métropole.' },
  { text: '« Ce texte a été adopté à l’unanimité ! » (40 députés présents sur 577, aucun contre)', v: 'trompeur', why: 'Unanimité des votants, oui ; mais 93 % des députés étaient absents.' },
  { text: '« Nos dépenses ont doublé en trente ans ! » (en euros courants)', v: 'trompeur', why: 'Sans tenir compte de l’inflation, la comparaison ne dit pas grand-chose.' },
  { text: '« Un sondage prouve que les Français veulent cette réforme. » (300 lecteurs d’un site militant)', v: 'trompeur', why: 'Un échantillon ni représentatif, ni aléatoire : ce n’est pas un sondage.' },
  { text: '« Le chômage baisse : il y a donc moins de pauvreté. »', v: 'trompeur', why: 'Le chômage et la pauvreté ne bougent pas forcément ensemble.' },
  { text: '« La délinquance a explosé de 100 % ! » (de 2 à 4 faits dans un village)', v: 'trompeur', why: 'Un pourcentage sur de si petits nombres est spectaculaire et vide.' },
  { text: '« Notre ville est la plus sûre de France. » (selon un classement payé par la mairie)', v: 'trompeur', why: 'Une source commanditée n’est pas une preuve.' },
  { text: 'Le 49.3 permet d’adopter un texte sans vote, sauf si une motion de censure passe.', v: 'vrai', why: 'Article 49, alinéa 3 de la Constitution.' },
  { text: 'Le Conseil constitutionnel compte neuf membres nommés.', v: 'vrai', why: 'Trois par le président, trois par le président de chaque assemblée.' },
  { text: 'La Marseillaise est l’hymne national sans interruption depuis 1795.', v: 'faux', why: 'Elle a été écartée sous l’Empire et la Restauration, puis rétablie en 1879.' },
];

const LABELS: Record<Verdict, string> = { vrai: '✅ Vrai', faux: '❌ Faux', trompeur: '🌀 Trompeur' };

/** Fact-checking en direct : chaque affirmation, un verdict avant la fin du chrono */
@Component({
  selector: 'app-factcheck-game',
  template: `
    <div class="fc">
      @if (!over()) {
        <div class="top"><span class="mono">{{ i() + 1 }} / {{ claims.length }}</span><span class="timer"><i [style.width.%]="left() * 100"></i></span><span class="mono">✔ {{ score() }}</span></div>
        @if (claims[i()]; as cl) {
          <blockquote [class.flash]="flash()">{{ cl.text }}</blockquote>
          @if (shown(); as r) {
            <p class="why" [class.ok]="r.ok" [class.ko]="!r.ok">{{ r.ok ? 'Bien vu !' : 'Raté : c’était « ' + label(cl.v) + ' ».' }} {{ cl.why }}</p>
          } @else {
            <div class="btns">@for (v of verdicts; track v) { <button type="button" class="v" [class]="v" (click)="answer(v)">{{ label(v) }}</button> }</div>
          }
        }
      } @else { <p class="said">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .fc { display: grid; gap: 10px; }
    .top { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; font-size: 12.5px; }
    .timer { height: 7px; border-radius: 4px; background: var(--line); overflow: hidden; i { display: block; height: 100%; background: var(--accent); transition: width .1s linear; } }
    blockquote { margin: 0; padding: 14px 16px; border-radius: 12px; background: #11151f; color: #f4f1e8; font: 600 15px/1.4 var(--font-body); border-left: 4px solid #e3b341; animation: in .3s ease; }
    blockquote.flash { animation: in .3s ease; }
    @keyframes in { from { opacity: 0; transform: translateY(6px); } }
    .btns { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .v { padding: 10px 6px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 600 13px var(--font-body); cursor: pointer; transition: transform .1s ease;
      &:active { transform: scale(.96); } &.vrai:hover { border-color: var(--good); } &.faux:hover { border-color: var(--bad); } &.trompeur:hover { border-color: #e3b341; } }
    .why { margin: 0; padding: 8px 10px; border-radius: 8px; font-size: 12.5px; animation: in .25s ease; &.ok { background: var(--good-soft); } &.ko { background: var(--bad-soft); } }
    .said { margin: 0; text-align: center; font-weight: 600; font-size: 13px; }
  `,
})
export class FactcheckGameComponent implements OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly verdicts: Verdict[] = ['vrai', 'faux', 'trompeur'];
  protected claims: Claim[] = [];
  protected readonly i = signal(0);
  protected readonly score = signal(0);
  protected readonly left = signal(1);
  protected readonly over = signal(false);
  protected readonly flash = signal(false);
  protected readonly shown = signal<{ ok: boolean } | null>(null);
  protected readonly message = signal('');
  protected readonly ratio = computed(() => this.score() / Math.max(1, this.claims.length));
  private timer: ReturnType<typeof setInterval> | null = null;
  private wait: ReturnType<typeof setTimeout> | null = null;
  private duration = 9000;
  private started = 0;

  ngOnInit(): void {
    const pool = [...CLAIMS].sort(() => Math.random() - 0.5);
    // Au moins deux affirmations trompeuses : c'est tout le sel du jeu
    const tricky = pool.filter(c => c.v === 'trompeur').slice(0, 2);
    const rest = pool.filter(c => !tricky.includes(c)).slice(0, 6);
    this.claims = [...tricky, ...rest].sort(() => Math.random() - 0.5);
    this.duration = Math.max(5000, 9500 - (this.diff() - 1) * 1200);
    this.startClock();
  }

  ngOnDestroy(): void { this.stop(); if (this.wait) clearTimeout(this.wait); }

  protected label(v: Verdict) { return LABELS[v]; }

  private startClock(): void {
    this.stop();
    this.started = Date.now();
    this.left.set(1);
    this.timer = setInterval(() => {
      const l = 1 - (Date.now() - this.started) / this.duration;
      this.left.set(Math.max(0, l));
      if (l <= 0) this.answer(null);
    }, 100);
  }

  private stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }

  protected answer(v: Verdict | null): void {
    if (this.shown() || this.over()) return;
    this.stop();
    const ok = v === this.claims[this.i()].v;
    if (ok) this.score.update(x => x + 1); else this.miss.emit();
    this.shown.set({ ok });
    this.progress.emit({ live: this.ratio(), time: 1 - (this.i() + 1) / this.claims.length });
    this.wait = setTimeout(() => this.next(), ok ? 1400 : 2600);
  }

  private next(): void {
    this.shown.set(null);
    if (this.i() + 1 >= this.claims.length) return this.finish();
    this.i.update(x => x + 1);
    this.flash.set(!this.flash());
    this.startClock();
  }

  private finish(): void {
    this.over.set(true);
    const r = this.ratio();
    this.message.set(r >= 0.85 ? `${this.score()}/${this.claims.length} : imbattable. Les journalistes vous citent en exemple.` : r >= 0.5 ? `${this.score()}/${this.claims.length} : honorable, mais deux ou trois approximations tournent déjà sur les réseaux.` : `${this.score()}/${this.claims.length} : vous avez relayé des intox en direct. Aïe.`);
    this.progress.emit({ live: r, time: 0 });
    setTimeout(() => this.done.emit(Math.max(0.1, r)), 2200);
  }
}

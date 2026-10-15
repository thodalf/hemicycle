import { Component, computed, inject, input, output, signal } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { LinkedTextComponent } from '../person-link/person-link.component';
import { NewsArtComponent } from './news-art.component';
import { Edition, edition, editionWeeks } from '../../engine/newspaper';

export const PAPER_NAME = 'L’Écho de la République';

/** Le journal du mois, en pleine page */
@Component({
  selector: 'app-newspaper',
  imports: [NewsArtComponent, LinkedTextComponent],
  template: `
    <div class="overlay" role="dialog" aria-modal="true" [attr.aria-label]="name" (click)="close.emit()">
      <article class="sheet paper" (click)="$event.stopPropagation()" [class.turn]="turning()">
        @if (ed(); as e) {
          <header class="mast">
            <div class="ears"><span>N° {{ e.number.toLocaleString('fr-FR') }}</span><span>Édition de {{ e.date }}</span><span>2,90 €</span></div>
            <h1>{{ name }}</h1>
            <div class="tag">Quotidien d’information politique · fondé en 1893</div>
            <nav class="issues">
              <button type="button" (click)="go(1)" [disabled]="idx() >= weeks().length - 1">‹ Précédent</button>
              <span>{{ idx() === 0 ? 'Le numéro du mois' : 'Archives' }}</span>
              <button type="button" (click)="go(-1)" [disabled]="idx() === 0">Suivant ›</button>
            </nav>
            <button type="button" class="x" (click)="close.emit()" aria-label="Fermer le journal">✕</button>
          </header>

          <div class="front">
            <section class="lead" [class.neg]="e.headline.tone === 'negative'">
              <span class="kicker">{{ e.headline.kicker }}</span>
              <h2><app-linked-text [text]="e.headline.title" /></h2>
              <figure><app-news-art [theme]="e.headline.theme" [tone]="e.headline.tone" [seed]="'h' + e.week" /><figcaption>Photo : Hémicycle Presse</figcaption></figure>
              <p class="chapo"><app-linked-text [text]="e.headline.body" /></p>
              <p class="by">Par {{ e.headline.byline }}</p>
            </section>
            <aside class="side">
              <div class="box">
                <h3>Sommaire</h3>
                <ol class="som">@for (s of e.sommaire; track $index) { <li><span>{{ s.title }}</span><b>{{ s.page }}</b></li> }</ol>
              </div>
              <div class="box baro">
                <h3>Le baromètre</h3>
                <div class="cote"><b>{{ e.barometre.cote }}</b><small>%</small>
                  <span class="trend" [class.up]="e.barometre.trend > 0" [class.down]="e.barometre.trend < 0">{{ e.barometre.trend > 0 ? '▲ +' : e.barometre.trend < 0 ? '▼ ' : '= ' }}{{ e.barometre.trend !== 0 ? e.barometre.trend : '' }}</span></div>
                <small>de bonnes opinions</small>
                @if (spark(e); as sp) { <svg viewBox="0 0 120 34" class="spark"><polyline [attr.points]="sp" /></svg> }
              </div>
              <div class="box meteo"><h3>Météo politique</h3><p>{{ e.meteo }}</p></div>
            </aside>
          </div>

          @if (e.articles.length) {
            <div class="cols">
              @for (a of e.articles; track a.id; let i = $index) {
                <section class="art" [class.neg]="a.tone === 'negative'">
                  <span class="kicker">{{ a.kicker }}</span>
                  <h4><app-linked-text [text]="a.title" /></h4>
                  @if (i < 2) { <figure class="small"><app-news-art [theme]="a.theme" [tone]="a.tone" [seed]="a.id" /></figure> }
                  <p><app-linked-text [text]="a.body" /></p>
                  <p class="by">{{ a.byline }} · page {{ a.page }}</p>
                </section>
              }
            </div>
          }

          <div class="data">
            <div class="box poll">
              <h3>La question du mois</h3>
              <p class="q">{{ e.question.text }}</p>
              <div class="yn"><span class="yes" [style.width.%]="e.question.yes">Oui {{ e.question.yes }} %</span><span class="no" [style.width.%]="100 - e.question.yes">Non {{ 100 - e.question.yes }} %</span></div>
              <small>Sondage Hémicycle Opinion, 1 002 personnes, méthode des quotas.</small>
            </div>
            <div class="box">
              <h3>Intentions de vote</h3>
              <ul class="bars">@for (p of e.parties; track p.name) { <li [class.mine]="p.mine"><span>{{ p.name }}</span><i><em [style.width.%]="p.share * 2.2" [style.background]="p.color"></em></i><b>{{ p.share }} %</b></li> }</ul>
            </div>
            <div class="box">
              <h3>Votre cote par électorat</h3>
              <ul class="bars">@for (s of e.segments; track s.label) { <li><span>{{ s.label }}</span><i><em [style.width.%]="s.value"></em></i><b>{{ s.value }}</b></li> }</ul>
            </div>
            <div class="box eco">
              <h3>Les chiffres du mois</h3>
              <dl>@for (c of e.chiffres; track c.label) { <div><dt>{{ c.label }}</dt><dd [class.good]="c.good" [class.bad]="!c.good">{{ c.value }}</dd></div> }</dl>
            </div>
          </div>

          @if (e.briefs.length) {
            <div class="briefs">
              <h3>En bref</h3>
              <ul>@for (b of e.briefs; track b.id) { <li><b><app-linked-text [text]="b.title" /></b> @if (b.body) { — <app-linked-text [text]="b.body" /> }</li> }</ul>
            </div>
          }
        }
      </article>
    </div>
  `,
  styles: `
    .overlay { position: fixed; inset: 0; z-index: 25; background: rgba(20, 18, 14, .62); backdrop-filter: blur(3px); overflow-y: auto; padding: 24px 16px; display: grid; place-items: start center; }
    .paper { --paper: #f6f1e4; --pink: #2a2620; --rule: #2a2620; width: 100%; max-width: 1040px; background: var(--paper); color: var(--pink); padding: 20px 26px 30px; border-radius: 3px;
      box-shadow: 0 30px 80px -20px rgba(0,0,0,.6), inset 0 0 120px rgba(120, 90, 40, .08); font-family: Georgia, 'Times New Roman', serif; animation: unfold .45s cubic-bezier(.2,.8,.3,1); display: grid; gap: 16px; position: relative; }
    .paper.turn { animation: turn .4s ease; }
    @keyframes unfold { from { transform: perspective(1200px) rotateX(18deg) translateY(30px); opacity: 0; } }
    @keyframes turn { 40% { transform: perspective(1200px) rotateY(-8deg); opacity: .5; } }
    .mast { text-align: center; border-bottom: 4px double var(--rule); padding-bottom: 8px; position: relative;
      h1 { margin: 2px 0; font: 700 clamp(30px, 6vw, 60px)/1 var(--font-display); letter-spacing: -.01em; }
      .ears { display: flex; justify-content: space-between; padding-right: 30px; font: 600 11px var(--font-body); text-transform: uppercase; letter-spacing: .08em; border-bottom: 1px solid var(--rule); padding-bottom: 4px; }
      .tag { font-style: italic; font-size: 12.5px; }
      .issues { display: flex; justify-content: center; align-items: center; gap: 14px; margin-top: 6px; font: 12px var(--font-body);
        button { border: 1px solid var(--rule); background: none; color: var(--pink); padding: 3px 10px; border-radius: 999px; cursor: pointer; font: inherit; } button:disabled { opacity: .3; cursor: default; } }
      .x { position: absolute; top: -10px; right: -14px; width: 30px; height: 30px; border-radius: 50%; border: 0; background: none; font-size: 18px; cursor: pointer; color: var(--pink); } }
    .front { display: grid; grid-template-columns: minmax(0, 2.2fr) minmax(0, 1fr); gap: 20px; }
    .kicker { font: 700 11px var(--font-body); text-transform: uppercase; letter-spacing: .1em; color: #8a1c1c; }
    .lead { border-right: 1px solid var(--rule); padding-right: 20px;
      h2 { margin: 4px 0 10px; font: 700 clamp(26px, 4.2vw, 46px)/1.04 var(--font-display); letter-spacing: -.01em; }
      figure { margin: 0 0 10px; aspect-ratio: 16 / 9; overflow: hidden; border: 1px solid var(--rule); app-news-art { height: 100%; } }
      figcaption { font: italic 10.5px var(--font-body); text-align: right; margin-top: 3px; opacity: .7; }
      .chapo { font-size: 16px; line-height: 1.5; font-weight: 600; margin: 0 0 6px; }
      .chapo::first-letter { float: left; font: 700 46px/.9 var(--font-display); padding: 4px 6px 0 0; } }
    .lead.neg h2 { color: #6e1414; }
    .by { font: italic 12px Georgia, serif; opacity: .75; margin: 0; }
    .side { display: grid; gap: 12px; align-content: start; }
    .box { border-top: 2px solid var(--rule); padding-top: 6px;
      h3 { margin: 0 0 6px; font: 800 13px var(--font-body); text-transform: uppercase; letter-spacing: .08em; } }
    .som { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 13px;
      li { display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px dotted rgba(0,0,0,.25); padding-bottom: 3px; } b { font-family: var(--font-body); } }
    .baro .cote { display: flex; align-items: baseline; gap: 4px; b { font: 700 46px/1 var(--font-display); } .trend { margin-left: auto; font: 700 14px var(--font-body); } .up { color: #1d6b3a; } .down { color: #8a1c1c; } }
    .spark { width: 100%; height: 36px; polyline { fill: none; stroke: #8a1c1c; stroke-width: 2; stroke-linejoin: round; } }
    .meteo p { margin: 0; font-size: 14px; }
    .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0; border-top: 1px solid var(--rule); padding-top: 10px;
      .art { padding: 0 14px; border-left: 1px solid rgba(0,0,0,.2); h4 { margin: 4px 0 6px; font: 700 18px/1.15 var(--font-display); } p { font-size: 13.5px; line-height: 1.45; margin: 0 0 6px; }
        figure.small { margin: 0 0 6px; aspect-ratio: 16 / 9; overflow: hidden; border: 1px solid rgba(0,0,0,.3); app-news-art { height: 100%; } } }
      .art:first-child { border-left: 0; padding-left: 0; } .art.neg h4 { color: #6e1414; } }
    .data { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; font-family: var(--font-body); }
    .poll .q { margin: 0 0 6px; font: 600 14px Georgia, serif; }
    .yn { display: flex; height: 26px; border-radius: 3px; overflow: hidden; font: 700 11.5px var(--font-body); color: #fff;
      span { display: flex; align-items: center; padding: 0 6px; white-space: nowrap; overflow: hidden; } .yes { background: #1f3a5f; } .no { background: #8a1c1c; justify-content: flex-end; } }
    .poll small { display: block; margin-top: 4px; font-size: 10.5px; opacity: .7; }
    .bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 12px;
      li { display: grid; grid-template-columns: 96px 1fr 38px; gap: 6px; align-items: center; } li.mine { font-weight: 700; }
      span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } i { height: 9px; background: rgba(0,0,0,.08); border-radius: 2px; overflow: hidden; }
      em { display: block; height: 100%; background: #1f3a5f; transition: width .5s ease; } b { text-align: right; } }
    .eco dl { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; div { border: 1px solid rgba(0,0,0,.15); padding: 6px; } dt { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; opacity: .7; }
      dd { margin: 0; font: 800 18px Georgia, serif; } .good { color: #1d6b3a; } .bad { color: #8a1c1c; } }
    .briefs { border-top: 4px double var(--rule); padding-top: 6px; h3 { margin: 0 0 6px; font: 800 13px var(--font-body); text-transform: uppercase; letter-spacing: .08em; }
      ul { margin: 0; padding: 0; list-style: none; columns: 2 260px; column-gap: 24px; li { break-inside: avoid; font-size: 13px; margin-bottom: 6px; } } }
    @media (max-width: 760px) {
      .overlay { padding: 0; }
      .paper { padding: 14px 14px 26px; border-radius: 0; }
      .front { grid-template-columns: 1fr; }
      .lead { border-right: 0; padding-right: 0; }
      .cols .art { padding: 10px 0; border-left: 0; border-top: 1px solid rgba(0,0,0,.2); }
      .mast .x { top: -4px; right: -2px; }
    }
  `,
})
export class NewspaperComponent {
  private readonly game = inject(GameStateService);
  readonly close = output<void>();
  readonly start = input(0);
  protected readonly name = PAPER_NAME;
  protected readonly weeks = computed(() => editionWeeks(this.game.s()));
  private readonly offset = signal<number | null>(null);
  protected readonly idx = computed(() => this.offset() ?? this.start());
  protected readonly turning = signal(false);
  protected readonly ed = computed<Edition | null>(() => {
    const w = this.weeks()[this.idx()];
    return w === undefined ? null : edition(this.game.s(), w);
  });

  protected go(step: number): void {
    const n = Math.max(0, Math.min(this.weeks().length - 1, this.idx() + step));
    this.offset.set(n);
    this.turning.set(false);
    requestAnimationFrame(() => this.turning.set(true));
    setTimeout(() => this.turning.set(false), 420);
  }

  protected spark(e: Edition): string | null {
    const h = e.barometre.history;
    if (h.length < 2) return null;
    const min = Math.min(...h) - 3, max = Math.max(...h) + 3;
    return h.map((v, i) => `${(i / (h.length - 1)) * 118 + 1},${32 - ((v - min) / Math.max(1, max - min)) * 30}`).join(' ');
  }
}

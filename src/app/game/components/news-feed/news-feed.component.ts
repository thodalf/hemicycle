import { LinkedTextComponent } from '../person-link/person-link.component';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { NewsArtComponent } from '../newspaper/news-art.component';
import { NewspaperComponent, PAPER_NAME } from '../newspaper/newspaper.component';
import { edition, editionWeeks } from '../../engine/newspaper';
import { NewsItem, NewsKind } from '../../models/game.models';
import { START_DATE } from '../../data/ranks';
import { GameStateService } from '../../services/game-state.service';

const KIND_LABELS: Record<NewsKind, string> = {
  actu: 'Actu', action: 'Agenda', decision: 'Décision', scandale: 'Scandale', sondage: 'Sondage',
  rival: 'Rivaux', parti: 'Parti', election: 'Élection', reseau: 'Réseau', systeme: 'Carrière',
};

/** Fil d'actualité groupé par mois, du plus récent au plus ancien */
@Component({
  selector: 'app-news-feed',
  imports: [LinkedTextComponent, NewsArtComponent, NewspaperComponent],
  template: `
    @if (une(); as e) {
      <section class="card une" [class.fresh]="fresh()">
        <button type="button" class="mast" (click)="openPaper()">
          <span class="ears"><span>N° {{ e.number.toLocaleString('fr-FR') }}</span><span>{{ e.date }}</span></span>
          <strong>{{ paperName }}</strong>
          @if (fresh()) { <span class="new">Nouveau numéro</span> }
        </button>
        <button type="button" class="lead" (click)="openPaper()" [class.neg]="e.headline.tone === 'negative'">
          <span class="kicker">{{ e.headline.kicker }}</span>
          <span class="hl">{{ e.headline.title }}</span>
          <span class="pic"><app-news-art [theme]="e.headline.theme" [tone]="e.headline.tone" [seed]="'m' + e.week" /></span>
          <span class="chapo">{{ e.headline.body }}</span>
        </button>
        <div class="mini">
          <ol>@for (a of e.articles.slice(0, 3); track a.id) { <li><span class="k">{{ a.kicker }}</span> {{ a.title }}</li> }</ol>
          <div class="baro"><b>{{ e.barometre.cote }} %</b><small>{{ e.barometre.label }}</small>
            <span [class.up]="e.barometre.trend > 0" [class.down]="e.barometre.trend < 0">{{ e.barometre.trend > 0 ? '▲' : e.barometre.trend < 0 ? '▼' : '=' }} {{ e.barometre.trend !== 0 ? (e.barometre.trend > 0 ? '+' : '') + e.barometre.trend : '' }}</span></div>
        </div>
        <button type="button" class="btn primary small read" (click)="openPaper()">📰 Lire le journal</button>
      </section>
    }
    @if (paperOpen()) { <app-newspaper (close)="paperOpen.set(false)" /> }
    <section class="card">
      <div class="card-title">
        <span>Toutes les dépêches</span>
        <label class="toggle"><input id="hide-own" type="checkbox" [checked]="hideOwn()" (change)="hideOwn.set(!hideOwn())"> masquer mon agenda</label>
      </div>
      <div class="feed">
        @for (g of groups(); track g.week) {
          <h3 class="week-head">
            <span>{{ g.week === current() ? 'Ce mois-ci' : g.week === current() - 1 ? 'Le mois dernier' : game.month(g.week) }}</span>
            <span class="muted">{{ g.date }}</span>
          </h3>
          <ol>
            @for (n of g.items; track n.id) {
              <li [class]="n.tone">
                <div class="meta">{{ kind(n.kind) }}</div>
                <strong><app-linked-text [text]="n.title" /></strong>
                @if (n.body) { <p><app-linked-text [text]="n.body" /></p> }
              </li>
            }
          </ol>
        }
      </div>
    </section>
  `,
  styles: `
    @media (prefers-reduced-motion: no-preference) {
      .feed li { animation: news-in .5s cubic-bezier(.2,.9,.3,1.2) both; }
      .feed li.negative { animation: news-in .5s cubic-bezier(.2,.9,.3,1.2) both, news-flash 1s .4s ease; }
    }
    @keyframes news-in { from { opacity: 0; transform: translateX(26px); } }
    @keyframes news-flash { 30% { background: var(--bad-soft); } }
    .feed { max-height: 460px; overflow-y: auto; margin: 0 -4px; padding: 0 4px; }
    .week-head {
      position: sticky; top: 0; z-index: 1; display: flex; justify-content: space-between; align-items: baseline;
      background: var(--surface); padding: 6px 0 5px; margin: 0; border-bottom: 1px solid var(--line);
      font: 600 11px/1.2 var(--font-body); letter-spacing: .07em; text-transform: uppercase; color: var(--ink);
      .muted { font-weight: 500; letter-spacing: 0; text-transform: none; }
    }
    .feed ol { list-style: none; margin: 6px 0 12px; padding: 0; display: grid; gap: 2px; }
    .feed li { padding: 6px 0 6px 10px; border-left: 3px solid var(--line); font-size: 13px; }
    .feed li.positive { border-left-color: var(--good); }
    .feed li.negative { border-left-color: var(--bad); }
    .feed .meta { font-size: 10.5px; color: var(--ink-3); text-transform: uppercase; letter-spacing: .05em; }
    .feed strong { font-weight: 600; }
    .feed p { margin: 2px 0 0; color: var(--ink-2); font-size: 12.5px; }
    .une { display: grid; gap: 10px; background: #f6f1e4; color: #2a2620; border-color: #d9cfb8; font-family: Georgia, serif; margin-bottom: 14px;
      button:not(.btn) { border: 0; background: none; color: inherit; text-align: left; padding: 0; cursor: pointer; font: inherit; }
      .mast { display: grid; justify-items: center; gap: 2px; border-bottom: 3px double #2a2620; padding-bottom: 6px; position: relative;
        .ears { display: flex; justify-content: space-between; width: 100%; font: 600 10px var(--font-body); text-transform: uppercase; letter-spacing: .08em; }
        strong { font: 700 22px var(--font-display); letter-spacing: -.01em; }
        .new { position: absolute; right: 0; bottom: -10px; font: 700 10px var(--font-body); background: #8a1c1c; color: #fff; padding: 2px 8px; border-radius: 999px; animation: pulse-new 1.6s infinite; } }
      .lead { display: grid; gap: 6px; .kicker { font: 700 10.5px var(--font-body); text-transform: uppercase; letter-spacing: .1em; color: #8a1c1c; }
        .hl { font: 700 21px/1.12 var(--font-display); } .pic { display: block; aspect-ratio: 16 / 9; overflow: hidden; border: 1px solid #2a2620; app-news-art { height: 100%; } }
        .chapo { font-size: 13.5px; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; } }
      .lead.neg .hl { color: #6e1414; }
      .lead:hover .hl { text-decoration: underline; text-decoration-thickness: 1px; }
      .mini { display: grid; grid-template-columns: 1fr auto; gap: 10px; border-top: 1px solid #2a2620; padding-top: 8px;
        ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 5px; font-size: 12.5px; li { line-height: 1.3; } .k { font: 700 9.5px var(--font-body); text-transform: uppercase; letter-spacing: .08em; color: #8a1c1c; } }
        .baro { display: grid; justify-items: center; align-content: start; border-left: 1px solid #2a2620; padding-left: 10px; font-family: var(--font-body);
          b { font: 700 24px var(--font-display); } small { font-size: 10px; text-align: center; max-width: 70px; } .up { color: #1d6b3a; } .down { color: #8a1c1c; } span { font-size: 12px; font-weight: 700; } } }
      .read { justify-self: center; } }
    .une.fresh { box-shadow: 0 0 0 2px #8a1c1c; }
    @keyframes pulse-new { 50% { transform: scale(1.06); } }
    .toggle { display: flex; gap: 4px; align-items: center; font-family: var(--font-body); font-size: 12px; color: var(--ink-3); }
  `,
})
export class NewsFeedComponent {
  protected readonly game = inject(GameStateService);
  protected readonly paperName = PAPER_NAME;
  protected readonly paperOpen = signal(false);
  /** La une du dernier numéro */
  protected readonly une = computed(() => { const w = editionWeeks(this.game.s())[0]; return w === undefined ? null : edition(this.game.s(), w); });
  /** Un numéro pas encore lu ? */
  private readonly seen = signal(((): number => { try { return Number(localStorage.getItem('polsim.paperSeen') ?? -1); } catch { return -1; } })());
  protected readonly fresh = computed(() => (this.une()?.week ?? -1) > this.seen());
  protected openPaper(): void {
    this.paperOpen.set(true);
    const w = this.une()?.week ?? -1;
    this.seen.set(w);
    try { localStorage.setItem('polsim.paperSeen', String(w)); } catch { /* navigation privée */ }
  }
  protected readonly hideOwn = signal(false);
  protected readonly current = computed(() => this.game.week());

  protected readonly groups = computed(() => {
    const items = this.game.s().news.filter(n => !this.hideOwn() || n.kind !== 'action');
    const byWeek = new Map<number, NewsItem[]>();
    for (const n of items) {
      if (!byWeek.has(n.week)) byWeek.set(n.week, []);
      byWeek.get(n.week)!.push(n);
    }
    return [...byWeek.entries()]
      .sort((a, b) => b[0] - a[0])
      .slice(0, 12)
      .map(([week, list]) => ({ week, date: dateOf(week), items: [...list].reverse() }));
  });

  protected kind(k: NewsKind) { return KIND_LABELS[k]; }
}

function dateOf(week: number): string {
  const d = new Date(START_DATE);
  d.setDate(d.getDate() + (week - 1) * 7);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

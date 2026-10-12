import { Component, computed, inject, signal } from '@angular/core';
import { NewsItem, NewsKind } from '../../models/game.models';
import { START_DATE } from '../../data/ranks';
import { GameStateService } from '../../services/game-state.service';

const KIND_LABELS: Record<NewsKind, string> = {
  actu: 'Actu', action: 'Agenda', decision: 'Décision', scandale: 'Scandale', sondage: 'Sondage',
  rival: 'Rivaux', parti: 'Parti', election: 'Élection', reseau: 'Réseau', systeme: 'Carrière',
};

/** Fil d'actualité groupé par semaine, de la plus récente à la plus ancienne */
@Component({
  selector: 'app-news-feed',
  template: `
    <section class="card">
      <div class="card-title">
        <span>Fil d’actualité</span>
        <label class="toggle"><input id="hide-own" type="checkbox" [checked]="hideOwn()" (change)="hideOwn.set(!hideOwn())"> masquer mon agenda</label>
      </div>
      <div class="feed">
        @for (g of groups(); track g.week) {
          <h3 class="week-head">
            <span>{{ g.week === current() ? 'Cette semaine' : g.week === current() - 1 ? 'Semaine dernière' : 'Semaine ' + g.week }}</span>
            <span class="muted">{{ g.date }}</span>
          </h3>
          <ol>
            @for (n of g.items; track n.id) {
              <li [class]="n.tone">
                <div class="meta">{{ kind(n.kind) }}</div>
                <strong>{{ n.title }}</strong>
                @if (n.body) { <p>{{ n.body }}</p> }
              </li>
            }
          </ol>
        }
      </div>
    </section>
  `,
  styles: `
    @media (prefers-reduced-motion: no-preference) {
      li { animation: news-in .5s cubic-bezier(.2,.9,.3,1.2) both; }
      li.negative { animation: news-in .5s cubic-bezier(.2,.9,.3,1.2) both, news-flash 1s .4s ease; }
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
    ol { list-style: none; margin: 6px 0 12px; padding: 0; display: grid; gap: 2px; }
    li { padding: 6px 0 6px 10px; border-left: 3px solid var(--line); font-size: 13px; }
    li.positive { border-left-color: var(--good); }
    li.negative { border-left-color: var(--bad); }
    .meta { font-size: 10.5px; color: var(--ink-3); text-transform: uppercase; letter-spacing: .05em; }
    strong { font-weight: 600; }
    p { margin: 2px 0 0; color: var(--ink-2); font-size: 12.5px; }
    .toggle { display: flex; gap: 4px; align-items: center; font-family: var(--font-body); font-size: 12px; color: var(--ink-3); }
  `,
})
export class NewsFeedComponent {
  private readonly game = inject(GameStateService);
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

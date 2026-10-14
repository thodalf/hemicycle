import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { annexedEnemies } from '../../engine/annex';
import { CIRCO_LABELS, MAP_REGIONS, RATINGS, accountability, econBonus, liveMap, segmentBonus, segmentRows } from '../../engine/country';

type Tab = 'eco' | 'electorat' | 'carte';

/** Le pays : économie, électorats, carte électorale */
@Component({
  selector: 'app-country-panel',
  imports: [DecimalPipe],
  template: `
    <section class="card country" aria-label="Le pays">
      <div class="card-title"><span>Le pays</span>
        @if (game.s().coalition; as c) { <span class="chip coal" [style.border-color]="c.color" [title]="'Humeur du partenaire : ' + (c.mood | number: '1.0-0') + '/100'">🤝 Coalition · {{ c.name }}</span> }
      </div>
      <nav class="tabs" role="tablist">
        <button type="button" role="tab" [class.on]="tab() === 'eco'" (click)="tab.set('eco')">Économie</button>
        <button type="button" role="tab" [class.on]="tab() === 'electorat'" (click)="tab.set('electorat')">Électorats</button>
        <button type="button" role="tab" [class.on]="tab() === 'carte'" (click)="tab.set('carte')">Carte</button>
      </nav>

      @if (tab() === 'eco') {
        @if (game.s().economy; as e) {
          <div class="kpis">
            <div class="kpi" [class.bad]="e.unemployment >= 9" [class.good]="e.unemployment < 6.5"><small>Chômage</small><strong class="mono">{{ e.unemployment | number: '1.1-1' }} %</strong></div>
            <div class="kpi" [class.bad]="e.growth < 0" [class.good]="e.growth >= 2"><small>Croissance</small><strong class="mono">{{ e.growth | number: '1.1-1' }} %</strong></div>
            <div class="kpi" [class.bad]="e.inflation >= 4"><small>Inflation</small><strong class="mono">{{ e.inflation | number: '1.1-1' }} %</strong></div>
            <div class="kpi" [class.bad]="e.deficit > 4.5" [class.good]="e.deficit <= 3"><small>Déficit</small><strong class="mono">{{ e.deficit | number: '1.1-1' }} %</strong></div>
            <div class="kpi" [class.bad]="e.debt > 125"><small>Dette</small><strong class="mono">{{ e.debt | number: '1.0-0' }} %</strong></div>
            <div class="kpi" [class.bad]="e.rating >= 4" [class.good]="e.rating <= 1"><small>Note</small><strong class="mono">{{ rating() }}</strong></div>
          </div>
          <div class="conf"><small>Confiance des ménages et des entreprises</small><span class="bar"><i [style.width.%]="e.confidence"></i></span><span class="mono">{{ e.confidence | number: '1.0-0' }}</span></div>
          @if (spark(); as sp) {
            <svg viewBox="0 0 120 34" class="spark" role="img" aria-label="Chômage et croissance sur trois ans">
              <polyline [attr.points]="sp.u" class="u" /><polyline [attr.points]="sp.g" class="g" />
            </svg>
            <p class="legend"><span class="lu">— chômage</span> <span class="lg">— croissance</span> <span class="muted">sur {{ sp.n }} mois</span></p>
          }
          <p class="note muted">{{ econNote() }}</p>
        }
      } @else if (tab() === 'electorat') {
        <ul class="segs">
          @for (r of rows(); track r.id) {
            <li>
              <span class="lbl">{{ r.label }}<small class="muted"> · {{ r.weight * 100 | number: '1.0-0' }} % des votants</small></span>
              <span class="bar"><i [style.width.%]="r.approval" [class.hi]="r.offset >= 3" [class.lo]="r.offset <= -3"></i></span>
              <span class="mono val">{{ r.approval }}</span>
              <small class="mono off" [class.pos]="r.offset > 0" [class.neg]="r.offset < 0">{{ r.offset > 0 ? '+' : '' }}{{ r.offset | number: '1.0-1' }}</small>
            </li>
          }
        </ul>
        <p class="note muted">Votre cote dans chaque électorat (écart à votre popularité générale). Chaque action plaît à certains et en agace d’autres. Effet sur une présidentielle : {{ segBonus() >= 0 ? '+' : '' }}{{ segBonus() | number: '1.0-1' }} pts.</p>
      } @else {
        <svg [attr.viewBox]="tiles().length > 14 ? '-0.15 -0.15 5.8 7' : '-0.15 -0.15 5.8 5.95'" class="fmap" role="img" aria-label="Carte électorale par région">
          @for (r of tiles(); track r.id) {
            <g [attr.transform]="'translate(' + r.x + ' ' + r.y + ')'">
              <title>{{ r.name }} : {{ r.party }} en tête ({{ r.share | number: '1.0-0' }} %)</title>
              <rect width="0.94" height="0.94" rx="0.12" [attr.fill]="r.color" [class.mine]="r.mine" class="tile" />
              <text x="0.47" y="0.5" class="code">{{ r.short }}</text>
              @if (r.party !== 'Territoire annexé') { <text x="0.47" y="0.78" class="pct">{{ r.share | number: '1.0-0' }} %</text> } @else { <text x="0.47" y="0.78" class="pct">annexé</text> }
              @if (r.home) { <text x="0.82" y="0.24" class="star">★</text> }
            </g>
          }
        </svg>
        <p class="legend">
          @for (p of legend(); track p.id) { <span><i [style.background]="p.color"></i>{{ p.name }}</span> }
        </p>
        <p class="note muted">{{ map().label }}@if (game.s().territory; as t) { · ★ {{ t.name }} ({{ circo() }})}</p>
      }
    </section>
  `,
  styles: `
    .country { display: grid; gap: 8px; .card-title { margin-bottom: 0; } }
    .coal { font-size: 11px; border: 1px solid; }
    .tabs { display: flex; gap: 4px; button { flex: 1; border: 1px solid var(--line); background: var(--surface-2); border-radius: 8px; padding: 5px 6px; font: 600 12px var(--font-body); color: var(--ink-2); cursor: pointer; } .on { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); } }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .kpi { border: 1px solid var(--line); border-radius: 8px; padding: 5px 7px; display: grid; small { font-size: 10.5px; color: var(--ink-3); } strong { font-size: 15px; } }
    .kpi.bad strong { color: var(--bad); } .kpi.good strong { color: var(--good); }
    .conf { display: grid; grid-template-columns: 1fr 80px 24px; gap: 6px; align-items: center; font-size: 11.5px; }
    .bar { height: 7px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; i { display: block; height: 100%; background: var(--accent); } }
    .spark { width: 100%; height: 46px; background: var(--surface-2); border-radius: 8px; polyline { fill: none; stroke-width: 1.2; } .u { stroke: var(--bad); } .g { stroke: var(--good); } }
    .legend { margin: 0; font-size: 11px; display: flex; flex-wrap: wrap; gap: 4px 10px; .lu { color: var(--bad); } .lg { color: var(--good); } i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; } }
    .note { margin: 0; font-size: 11.5px; }
    .segs { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; li { display: grid; grid-template-columns: 1fr 70px 24px 34px; gap: 6px; align-items: center; font-size: 12.5px; } }
    .lbl small { font-size: 10.5px; }
    .segs .bar i.hi { background: var(--good); } .segs .bar i.lo { background: var(--bad); }
    .val { text-align: right; } .off { font-size: 11px; text-align: right; color: var(--ink-3); } .off.pos { color: var(--good); } .off.neg { color: var(--bad); }
    .fmap { width: 100%; max-height: 260px; }
    .tile { stroke: var(--surface); stroke-width: 0.03; } .tile.mine { stroke: var(--ink); stroke-width: 0.06; }
    .code { font: 700 0.24px var(--font-body); fill: #fff; text-anchor: middle; paint-order: stroke; stroke: rgba(0,0,0,.35); stroke-width: 0.03; }
    .pct { font: 0.19px var(--font-mono); fill: #fff; text-anchor: middle; paint-order: stroke; stroke: rgba(0,0,0,.35); stroke-width: 0.025; }
    .star { font-size: 0.26px; fill: #ffd34d; text-anchor: middle; paint-order: stroke; stroke: rgba(0,0,0,.5); stroke-width: 0.03; }
    @media (max-width: 420px) { .kpis { grid-template-columns: repeat(2, 1fr); } .segs li { grid-template-columns: 1fr 56px 24px 32px; } }
  `,
})
export class CountryPanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly tab = signal<Tab>('eco');
  protected readonly rating = computed(() => RATINGS[this.game.s().economy?.rating ?? 2]);
  protected readonly rows = computed(() => segmentRows(this.game.s()));
  protected readonly segBonus = computed(() => segmentBonus(this.game.s(), 'presidentielle'));
  protected readonly circo = computed(() => CIRCO_LABELS[this.game.s().territory?.kind ?? 'disputee'].toLowerCase());

  protected readonly econNote = computed(() => {
    const s = this.game.s();
    const acc = accountability(s);
    const b = Math.round(econBonus(s, 'presidentielle') * 10) / 10 || 0;
    const sign = `${b >= 0 ? '+' : '−'}${Math.abs(b).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}`;
    return acc >= 0.4 ? `Vous gouvernez : la conjoncture est votre bilan (${sign} pts à une présidentielle).`
      : acc > 0 ? `Votre camp gouverne : la conjoncture pèse un peu sur vous (${sign} pts à une présidentielle).`
      : `Dans l’opposition, une économie en berne vous profite (${sign} pts à une présidentielle).`;
  });

  protected readonly spark = computed(() => {
    const h = this.game.s().economy?.history ?? [];
    if (h.length < 3) return null;
    const x = (i: number) => ((i / (h.length - 1)) * 116 + 2).toFixed(1);
    // Chaque courbe à sa propre échelle (au moins un point d'amplitude), pour voir les tendances
    const scale = (vals: number[]) => {
      const lo = Math.min(...vals), hi = Math.max(...vals), mid = (lo + hi) / 2, span = Math.max(1, hi - lo);
      return (v: number) => (17 - ((v - mid) / span) * 28).toFixed(1);
    };
    const yU = scale(h.map(p => p.unemployment));
    const yG = scale(h.map(p => p.growth));
    return { n: h.length, u: h.map((p, i) => `${x(i)},${yU(p.unemployment)}`).join(' '), g: h.map((p, i) => `${x(i)},${yG(p.growth)}`).join(' ') };
  });

  protected readonly map = computed(() => this.game.s().electoralMap ?? liveMap(this.game.s()));

  protected readonly tiles = computed(() => {
    const s = this.game.s();
    const m = this.map();
    const parties = [s.party, ...s.otherParties];
    const tiles = MAP_REGIONS.map(r => {
      const v = m.regions[r.id];
      const p = parties.find(x => x.id === v?.partyId);
      return { ...r, color: p?.color ?? '#8a8f9a', party: p?.name ?? '?', share: v?.share ?? 0, mine: v?.partyId === s.party.id, home: s.territory?.region === r.id };
    });
    // Les territoires annexés après une guerre
    const extra = annexedEnemies(s).map((e, i) => ({ id: `anx-${e.id}`, name: `${e.name} (annexé)`, short: e.name.slice(0, 4), x: i * 1.05, y: 5.75, lean: 0, rural: 0.5, towns: [],
      color: '#5b5f6b', party: 'Territoire annexé', share: 100, mine: false, home: false }));
    return [...tiles, ...extra];
  });

  protected readonly legend = computed(() => {
    const s = this.game.s();
    const ids = new Set(Object.values(this.map().regions).map(v => v.partyId));
    return [s.party, ...s.otherParties].filter(p => ids.has(p.id));
  });
}

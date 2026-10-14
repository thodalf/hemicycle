import { PersonLinkComponent } from '../person-link/person-link.component';
import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { BAROMETER_MONTHS, ranking } from '../../engine/electoral';
import { PollDuel } from '../../models/game.models';

interface Row { id: string; name: string; color: string; value: number; me: boolean }

function lighten(hex: string, t: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0');
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
const fr = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/** Baromètre présidentiel : intentions de vote, courbes, hypothèses de second tour, entre-deux-tours */
@Component({
  selector: 'app-presidential-polls',
  imports: [PersonLinkComponent, DecimalPipe],
  template: `
    @if (secondRound(); as sr) {
      <section class="card polls e2t" aria-label="Entre-deux-tours">
        <div class="card-title">
          <span>Entre-deux-tours</span>
          <span class="chip accent">Second tour {{ game.month(sr.week) }}</span>
        </div>
        <div class="eyebrow">Sondage du second tour</div>
        <div class="duel big">
          <span class="side" [class.me]="sr.duel[0].me">{{ sr.duel[0].name }} <b class="mono">{{ sr.duel[0].value | number: '1.1-1' }} %</b></span>
          <span class="split" role="img" [attr.aria-label]="sr.duel[0].name + ' ' + sr.duel[0].value + ' %, ' + sr.duel[1].name + ' ' + sr.duel[1].value + ' %'">
            <span [style.width.%]="sr.duel[0].value" [style.background]="sr.duel[0].color"></span>
            <span [style.width.%]="sr.duel[1].value" [style.background]="sr.duel[1].color"></span>
            <i class="half"></i>
          </span>
          <span class="side r" [class.me]="sr.duel[1].me"><b class="mono">{{ sr.duel[1].value | number: '1.1-1' }} %</b> {{ sr.duel[1].name }}</span>
        </div>
        <p class="note">Ralliements et débat : <strong class="mono" [class.pos]="sr.bonus > 0" [class.neg]="sr.bonus < 0">{{ sr.bonus > 0 ? '+' : '' }}{{ sr.bonus }}</strong> sur votre score du second tour.
          @if (debatePending()) { Le débat télévisé vous attend. }</p>
        <div class="eyebrow">Résultats du premier tour</div>
        <ul class="bars compact">
          @for (r of sr.first; track r.id) {
            <li [class.me]="r.me"><span class="cand"><app-person [name]="r.name" /></span>
              <span class="track"><span [style.width.%]="r.value * 1.8" [style.background]="r.color"></span></span>
              <span class="mono">{{ r.value | number: '1.1-1' }}</span></li>
          }
        </ul>
      </section>
    } @else if (latest(); as b) {
      <section class="card polls" aria-label="Sondages présidentiels">
        <div class="card-title">
          <span>Sondages · présidentielle</span>
          <span class="chip">{{ b.pollster }} · {{ game.month(b.week) }}</span>
        </div>
        @if (b.hypothetical) { <p class="note muted">Vous êtes testé·e par les sondeurs sans être candidat·e déclaré·e.</p> }
        @if (!hasPlayer()) { <p class="note muted">Les sondeurs ne vous testent pas encore : popularité 12 et un mandat de député·e au moins, ou la tête de votre parti.</p> }

        <div class="eyebrow">Intentions de vote au premier tour</div>
        <ul class="bars">
          @for (r of rows(); track r.id; let i = $index) {
            <li [class.me]="r.me" [class.cut]="i === 1">
              <span class="cand"><app-person [name]="r.name" /></span>
              <span class="track"><span [style.width.%]="r.value * 1.8" [style.background]="r.color"></span></span>
              <span class="mono">{{ r.value | number: '1.1-1' }}</span>
              <span class="mono d" [class.pos]="r.delta > 0.05" [class.neg]="r.delta < -0.05">{{ r.delta > 0.05 ? '▲' : r.delta < -0.05 ? '▼' : '' }}{{ r.delta > 0.05 || r.delta < -0.05 ? (Math.abs(r.delta) | number: '1.1-1') : '' }}</span>
            </li>
          }
        </ul>
        @if (status(); as st) { <p class="status" [class.good]="st.good">{{ st.text }}</p> }

        @if (chart(); as ch) {
          <svg class="chart" viewBox="0 0 300 110" role="img" aria-label="Évolution des intentions de vote">
            @for (g of ch.grid; track g.y) {
              <line x1="24" [attr.y1]="g.y" x2="300" [attr.y2]="g.y" class="grid" />
              <text x="20" [attr.y]="g.y + 3" class="axis">{{ g.v }}</text>
            }
            @for (l of ch.lines; track l.id) {
              <polyline [attr.points]="l.points" fill="none" [attr.stroke]="l.color" [attr.stroke-width]="l.me ? 3 : 1.6" stroke-linejoin="round" stroke-linecap="round" />
              <circle [attr.cx]="l.x" [attr.cy]="l.y" [attr.r]="l.me ? 3.5 : 2.5" [attr.fill]="l.color" />
            }
          </svg>
          <div class="legend">
            @for (l of ch.lines; track l.id) { <span [class.me]="l.me"><i [style.background]="l.color"></i>{{ l.name }}</span> }
          </div>
        }

        @if (duels().length) {
          <div class="eyebrow">Hypothèses de second tour</div>
          @for (dl of duels(); track $index) {
            <div class="duel">
              <span class="side" [class.me]="dl[0].me">{{ dl[0].name }} <b class="mono">{{ dl[0].value | number: '1.0-0' }}</b></span>
              <span class="split"><span [style.width.%]="dl[0].value" [style.background]="dl[0].color"></span><span [style.width.%]="dl[1].value" [style.background]="dl[1].color"></span><i class="half"></i></span>
              <span class="side r" [class.me]="dl[1].me"><b class="mono">{{ dl[1].value | number: '1.0-0' }}</b> {{ dl[1].name }}</span>
            </div>
          }
        }
        <p class="note muted">Marge d’erreur ± 2,5 points. Les sondages attirent les parrainages… ou les font fuir.</p>
      </section>
    }
  `,
  styles: `
    .polls { display: grid; gap: 8px; .card-title { margin-bottom: 0; } }
    .e2t { border-left: 4px solid var(--accent); }
    .eyebrow { margin-top: 2px; }
    .note { margin: 0; font-size: 12px; line-height: 1.4; }
    .bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px; }
    .bars li { display: grid; grid-template-columns: minmax(0, 130px) 1fr 34px 38px; gap: 8px; align-items: center; font-size: 12.5px; }
    .bars.compact li { grid-template-columns: minmax(0, 130px) 1fr 34px; }
    .bars li.me { font-weight: 700; }
    .bars li.cut { padding-bottom: 5px; border-bottom: 1px dashed var(--ink-3); }
    .cand { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .track { height: 9px; background: var(--surface-2); border-radius: 4px; overflow: hidden;
      span { display: block; height: 100%; border-radius: 4px; transition: width .5s; } }
    .mono { text-align: right; }
    .d { font-size: 11px; color: var(--ink-3); }
    .pos { color: var(--good); } .neg { color: var(--bad); }
    .status { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--bad); }
    .status.good { color: var(--good); }
    .chart { width: 100%; height: auto; max-height: 150px; background: var(--surface-2); border-radius: 8px; }
    .grid { stroke: var(--line); stroke-width: 1; }
    .axis { font: 9px var(--font-mono); fill: var(--ink-3); text-anchor: end; }
    .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11.5px; color: var(--ink-2);
      span { display: inline-flex; align-items: center; gap: 5px; } span.me { font-weight: 700; color: var(--ink); }
      i { width: 10px; height: 3px; border-radius: 2px; } }
    .duel { display: grid; grid-template-columns: minmax(0, 1fr) minmax(70px, 1.2fr) minmax(0, 1fr); gap: 8px; align-items: center; font-size: 12.5px; }
    .duel .side { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .duel .side.r { text-align: right; }
    .duel .side.me { font-weight: 700; }
    .split { position: relative; display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: var(--surface-2);
      span { display: block; height: 100%; transition: width .5s; } }
    .half { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 2px; background: var(--ink); }
    .duel.big { font-size: 14px; .split { height: 16px; border-radius: 8px; } }
    @media (max-width: 520px) { .bars li { grid-template-columns: minmax(0, 96px) 1fr 32px 34px; } .bars.compact li { grid-template-columns: minmax(0, 96px) 1fr 32px; } }
  `,
})
export class PresidentialPollsComponent {
  protected readonly game = inject(GameStateService);
  protected readonly Math = Math;

  private readonly cycle = computed(() => {
    const s = this.game.s();
    const from = s.presidential.nextWeek - BAROMETER_MONTHS - 1;
    return (s.presidential.barometer ?? []).filter(b => b.week >= from);
  });

  protected readonly latest = computed(() => {
    const b = this.cycle().at(-1);
    return b && this.game.week() - b.week <= 2 ? b : null;
  });

  private who(id: string): { name: string; color: string; me: boolean } {
    const s = this.game.s();
    if (id === 'player') return { name: s.player.name, color: s.party.color, me: true };
    const npc = s.npcs.find(n => n.id === id);
    const party = [s.party, ...s.otherParties].find(p => p.id === npc?.partyId);
    // Même parti que vous (dissidence) : une teinte plus claire pour vous distinguer
    const color = party?.color ?? '#8a8f9a';
    return { name: npc?.name ?? id, color: party?.id === s.party.id ? lighten(color, 0.5) : color, me: false };
  }

  protected readonly hasPlayer = computed(() => 'player' in (this.latest()?.results ?? {}));

  protected readonly rows = computed(() => {
    const b = this.latest();
    if (!b) return [];
    const list = this.cycle();
    const prev = list.length > 1 ? list[list.length - 2] : null;
    return ranking(b.results).map(([id, value]) => ({
      id, ...this.who(id), value, delta: prev && id in prev.results ? Math.round((value - prev.results[id]) * 10) / 10 : 0,
    }));
  });

  protected readonly status = computed(() => {
    const rows = this.rows();
    const i = rows.findIndex(r => r.me);
    if (i < 0) return null;
    if (i === 0) return { good: true, text: 'En tête : qualifié·e pour le second tour' };
    if (i === 1) return { good: true, text: `Qualifié·e pour le second tour, ${fr(rows[0].value - rows[1].value)} pts derrière ${rows[0].name}` };
    return { good: false, text: `${i + 1}e : à ${fr(rows[1].value - rows[i].value)} pts du second tour` };
  });

  protected readonly duels = computed(() => (this.latest()?.duels ?? []).map((dl: PollDuel) => {
    // Arrondis qui totalisent 100
    const a = Math.round(dl.results[dl.a] ?? 50);
    return [{ id: dl.a, ...this.who(dl.a), value: a }, { id: dl.b, ...this.who(dl.b), value: 100 - a }] as Row[];
  }));

  protected readonly chart = computed(() => {
    const list = this.cycle();
    if (list.length < 2) return null;
    const latest = list.at(-1)!;
    const ids = ranking(latest.results).map(([id]) => id).slice(0, 4);
    if ('player' in latest.results && !ids.includes('player')) ids[3] = 'player';
    const max = Math.max(10, ...list.flatMap(b => ids.map(id => b.results[id] ?? 0))) + 4;
    const X = (i: number) => 28 + (i / (list.length - 1)) * 266;
    const Y = (v: number) => 104 - (v / max) * 96;
    const lines = ids.map(id => {
      const pts = list.map((b, i) => (id in b.results ? `${X(i).toFixed(1)},${Y(b.results[id]).toFixed(1)}` : null)).filter(Boolean);
      return { id, ...this.who(id), points: pts.join(' '), x: X(list.length - 1), y: Y(latest.results[id] ?? 0) };
    }).sort((a, b) => Number(a.me) - Number(b.me));
    const step = max > 40 ? 20 : 10;
    const grid = [];
    for (let v = 0; v <= max; v += step) grid.push({ v, y: Y(v) });
    return { lines, grid };
  });

  protected readonly debatePending = computed(() => this.game.s().debate?.stakes === 'entre_deux_tours');

  protected readonly secondRound = computed(() => {
    const s = this.game.s();
    const e = s.elections.find(x => !x.resolved && x.type === 'presidentielle' && x.finalists && x.secondRoundWeek);
    if (!e?.finalists || !e.firstRound) return null;
    const poll = [...s.polls].reverse().find(p => p.electionId === e.id && Object.keys(p.results).length === 2);
    const duel = e.finalists.map(id => ({ id, ...this.who(id), value: poll?.results[id] ?? 50 })) as Row[];
    const first = ranking(e.firstRound).map(([id, value]) => ({ id, ...this.who(id), value }));
    return { week: e.secondRoundWeek!, duel, first, bonus: Math.round(Number(s.player.flags['e2t'] ?? 0) * 10) / 10 };
  });
}

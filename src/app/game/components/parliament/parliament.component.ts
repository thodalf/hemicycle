import { Component, computed, inject, signal } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { PhoneService } from '../../services/phone.service';
import { assemblyGroups } from '../../engine/assembly';
import { RANKS } from '../../data/ranks';
import { npcAge } from '../../engine/npc-life';
import { hasNumber } from '../../engine/phone';

/* ============================================================
 *  L'hémicycle et les partis : la répartition des 577 sièges,
 *  groupe par groupe, de la gauche vers la droite ; puis chaque
 *  parti, son ou sa chef·fe, ses figures, leur rang, leur âge,
 *  leur popularité et ce qu'ils pensent de vous.
 * ============================================================ */

interface Seat { x: number; y: number; color: string; party: string; mine: boolean }

/** Les 577 sièges en demi-cercles concentriques, triés de la gauche vers la droite */
function layout(total: number, rows = 12): { x: number; y: number; a: number }[] {
  const r0 = 34, r1 = 96;
  const radii = Array.from({ length: rows }, (_, i) => r0 + (i * (r1 - r0)) / (rows - 1));
  const sum = radii.reduce((t, r) => t + r, 0);
  const counts = radii.map(r => Math.floor((total * r) / sum));
  let left = total - counts.reduce((t, c) => t + c, 0);
  for (let i = rows - 1; left > 0; i = (i - 1 + rows) % rows, left--) counts[i]++;
  const seats: { x: number; y: number; a: number }[] = [];
  radii.forEach((r, i) => {
    const n = counts[i];
    for (let k = 0; k < n; k++) {
      const a = Math.PI - (k / Math.max(1, n - 1)) * Math.PI;
      seats.push({ x: 100 + r * Math.cos(a), y: 100 - r * Math.sin(a), a });
    }
  });
  return seats.sort((p, q) => q.a - p.a);
}
const LAYOUT = layout(577);

@Component({
  selector: 'app-parliament',
  template: `
    <section class="card parl">
      <header class="head">
        <h2 class="card-title">🏛️ L’Assemblée et les partis</h2>
        <button type="button" class="btn small" (click)="open.set(!open())">{{ open() ? 'Replier' : 'Les partis' }}</button>
      </header>
      <figure class="hemi" aria-label="Répartition des 577 sièges de l’Assemblée nationale">
        <svg viewBox="0 0 200 106" role="img">
          @for (s of seats(); track $index) { <circle [attr.cx]="s.x" [attr.cy]="s.y" r="2.05" [attr.fill]="s.color" [class.mine]="s.mine"><title>{{ s.party }}</title></circle> }
          <line x1="100" y1="2" x2="100" y2="10" class="mid" />
          <text x="100" y="100" text-anchor="middle" class="total">577 sièges</text>
          <text x="100" y="92" text-anchor="middle" class="maj">majorité absolue : 289</text>
        </svg>
      </figure>
      <ul class="legend">
        @for (g of groups(); track g.partyId) {
          <li [class.gov]="g.majority" [class.mine]="g.partyId === myParty()">
            <span class="sw" [style.background]="g.color"></span><b>{{ g.seats }}</b> {{ g.name }}
            @if (g.majority) { <em>majorité</em> } @if (g.partyId === myParty()) { <em class="me">votre parti</em> }
          </li>
        }
      </ul>
      <p class="muted small">Majorité gouvernementale : <b>{{ govSeats() }}</b> sièges{{ govSeats() >= 289 ? ' (absolue)' : ' (relative)' }}.</p>

      @if (open()) {
        <div class="parties">
          @for (p of parties(); track p.id) {
            <details class="party" [open]="p.mine">
              <summary>
                <span class="sw" [style.background]="p.color"></span>
                <strong>{{ p.name }}</strong>
                <small class="muted">{{ p.side }} · {{ p.seats }} siège{{ p.seats > 1 ? 's' : '' }}{{ p.mine ? ' · votre parti' : '' }}</small>
              </summary>
              <p class="lead">@if (p.leader) { Chef·fe : <b>{{ p.leader }}</b> } @else { Pas de chef·fe connu·e }</p>
              <ul class="members">
                @if (p.mine) {
                  <li class="me-row"><span class="nm">{{ game.s().player.name }} <small>(vous)</small></span><span class="rk">{{ game.roleLabel() }}</span></li>
                }
                @for (m of p.members; track m.id) {
                  <li>
                    <span class="nm">@if (m.phone) { <button type="button" class="link" (click)="phone.openPerson(m.name)" title="Ouvrir la conversation">{{ m.name }}</button> } @else { {{ m.name }} }@if (m.rival) { <span title="Rival·e"> ⚔️</span> }</span>
                    <span class="rk">{{ m.rank }} · {{ m.age }} ans</span>
                    <span class="stats"><span title="Popularité">⭐ {{ m.pop }}</span><span title="Influence">◆ {{ m.inf }}</span><span title="Ce qu’il ou elle pense de vous" [class.pos]="m.rel > 15" [class.neg]="m.rel < -15">{{ m.rel > 15 ? '🙂' : m.rel < -15 ? '😠' : '😐' }} {{ m.rel > 0 ? '+' : '' }}{{ m.rel }}</span></span>
                  </li>
                } @empty { <li class="muted">Aucune figure connue.</li> }
              </ul>
            </details>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .parl { display: grid; gap: 10px; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .head h2 { margin: 0; }
    .hemi { margin: 0; }
    .hemi svg { width: 100%; height: auto; display: block; }
    circle.mine { stroke: var(--ink); stroke-width: .5; }
    .mid { stroke: var(--ink-3); stroke-width: .5; stroke-dasharray: 1 1; }
    .total { font-size: 7px; font-weight: 700; fill: var(--ink); font-family: var(--font-display); }
    .maj { font-size: 4.6px; fill: var(--ink-3); }
    .legend { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 4px 10px; font-size: 12.5px; }
    .legend li { display: flex; align-items: center; gap: 6px; }
    .legend li.gov b { text-decoration: underline; }
    .legend em { font-style: normal; font-size: 10.5px; padding: 0 6px; border-radius: 999px; background: var(--surface-2); color: var(--ink-2); }
    .legend em.me { background: var(--accent-soft); color: var(--accent); }
    .sw { width: 11px; height: 11px; border-radius: 3px; flex: none; display: inline-block; }
    .small { font-size: 12px; margin: 0; }
    .parties { display: grid; gap: 8px; }
    .party { border: 1px solid var(--line); border-radius: 10px; padding: 8px 10px; background: var(--surface); }
    .party summary { display: flex; align-items: center; gap: 8px; cursor: pointer; flex-wrap: wrap; }
    .lead { margin: 6px 0; font-size: 13px; }
    .members { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    .members li { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; font-size: 12.5px; padding: 5px 0; border-top: 1px solid var(--line); }
    .members .stats { grid-column: 1 / -1; display: flex; gap: 10px; color: var(--ink-2); font-size: 11.5px; }
    .rk { color: var(--ink-2); font-size: 11.5px; text-align: right; }
    .pos { color: var(--good); } .neg { color: var(--bad); }
    .me-row { font-weight: 600; }
    .link { border: 0; background: none; padding: 0; color: var(--accent); font: inherit; cursor: pointer; text-decoration: underline dotted; }
  `],
})
export class ParliamentComponent {
  protected readonly game = inject(GameStateService);
  protected readonly phone = inject(PhoneService);
  protected readonly open = signal(false);
  protected readonly myParty = computed(() => this.game.s().party.id);
  protected readonly groups = computed(() => assemblyGroups(this.game.s()));
  protected readonly govSeats = computed(() => this.groups().filter(g => g.majority).reduce((t, g) => t + g.seats, 0));
  protected readonly seats = computed((): Seat[] => {
    const out: Seat[] = [];
    let i = 0;
    for (const g of this.groups()) {
      for (let k = 0; k < g.seats && i < LAYOUT.length; k++, i++) out.push({ ...LAYOUT[i], color: g.color, party: `${g.name} · ${g.seats} sièges`, mine: g.partyId === this.myParty() });
    }
    return out;
  });
  protected readonly parties = computed(() => {
    const s = this.game.s();
    const seats = new Map(this.groups().map(g => [g.partyId, g.seats]));
    return [s.party, ...s.otherParties].map(p => {
      const leaderId = p.id === s.party.id ? s.party.leaderNpcId : s.npcs.find(n => n.partyId === p.id && n.rankId === 'chef_parti')?.id;
      const leader = leaderId === 'player' ? `${s.player.name} (vous)` : s.npcs.find(n => n.id === leaderId)?.name ?? null;
      const members = s.npcs.filter(n => n.partyId === p.id)
        .sort((a, b) => (RANKS[b.rankId]?.order ?? 0) - (RANKS[a.rankId]?.order ?? 0) || b.influence - a.influence)
        .map(n => ({ id: n.id, name: n.name, rank: RANKS[n.rankId]?.label ?? n.rankId, age: npcAge(n), pop: Math.round(n.popularity), inf: Math.round(n.influence), rel: Math.round(n.relationToPlayer), rival: n.isRival, phone: hasNumber(s, n.id) || n.id === s.party.leaderNpcId }));
      const side = p.position <= -45 ? 'Gauche radicale' : p.position <= -15 ? 'Gauche' : p.position < 15 ? 'Centre' : p.position < 45 ? 'Droite' : 'Droite radicale';
      return { id: p.id, name: p.name, color: p.color, side, seats: seats.get(p.id) ?? 0, leader, members, mine: p.id === s.party.id };
    }).sort((a, b) => Number(b.mine) - Number(a.mine) || b.seats - a.seats);
  });
}

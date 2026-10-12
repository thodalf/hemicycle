import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FoundPartyComponent } from '../found-party/found-party.component';
import { youngPartyMalus } from '../../engine/founding';
import { ContactType } from '../../models/game.models';
import { RANKS } from '../../data/ranks';
import { stanceLabel } from '../../data/world';
import { StanceAxisComponent, StanceMarker } from '../stance-axis/stance-axis.component';
import { GameStateService } from '../../services/game-state.service';

const CONTACT_LABELS: Record<ContactType, string> = {
  lobby: 'Lobby', industriel: 'Industriel', syndicat: 'Syndicat', journaliste: 'Journaliste', association: 'Association',
};

/** Courants internes, rivaux et carnet d'adresses */
@Component({
  selector: 'app-party-panel',
  imports: [DecimalPipe, StanceAxisComponent, FoundPartyComponent],
  template: `
    <section class="card">
      <div class="card-title">
        <span>Le parti</span>
        <span class="chip" [class.good]="game.partySupport() >= 50" [class.bad]="game.partySupport() < 30">Soutien {{ game.partySupport() }} %</span>
      </div>
      <div class="muted small">Direction : {{ leader() }} · Cohésion {{ game.s().party.cohesion | number: '1.0-0' }}</div>
      <app-stance-axis [markers]="axis()" />
      <p class="small stance-line">Votre ligne : <strong>{{ stance(game.player().stance) }}</strong>
        · parti : {{ stance(game.s().party.position) }}</p>
      <ul class="factions">
        @for (f of game.s().party.factions; track f.id) {
          <li>
            <div class="row"><span>{{ f.name }} <small class="muted">· {{ stance(f.position) }} · {{ f.weight }} %</small></span><span class="mono">{{ f.supportForPlayer | number: '1.0-0' }}</span></div>
            <div class="bar"><span [style.width.%]="f.supportForPlayer"></span></div>
          </li>
        }
      </ul>
      @if (game.s().party.founder) {
        <div class="founded" [style.border-color]="game.s().party.color">
          <strong>Votre parti</strong> · fondé en {{ game.month(game.s().party.foundedWeek ?? 1) }}
          @if (malus() > 0) { <small class="muted">Jeune parti peu implanté : −{{ malus() | number: '1.0-1' }} aux scrutins (s’efface avec le temps).</small> }
        </div>
      } @else if (game.s().scenario !== 'royaute') {
        <button class="btn small found" [class.primary]="offer()" (click)="founding.set(true)">
          {{ offer() ? 'Vos soutiens vous attendent : fonder votre parti' : 'Claquer la porte : fonder mon parti' }}
        </button>
      }
    </section>
    @if (founding()) { <app-found-party (closed)="founding.set(false)" /> }

    <section class="card">
      <div class="card-title"><span>Rivaux & alliés</span></div>
      <ul class="people">
        @for (n of npcs(); track n.id) {
          <li>
            <span class="who">
              <span class="dot" [style.background]="partyColor(n.partyId)"></span>
              <span><strong>{{ n.name }}</strong><small class="muted">{{ rankLabel(n.rankId) }}</small></span>
            </span>
            <span class="rel mono" [class.pos]="n.relationToPlayer > 15" [class.neg]="n.relationToPlayer < -15">
              {{ n.relationToPlayer > 0 ? '+' : '' }}{{ n.relationToPlayer | number: '1.0-0' }}
            </span>
          </li>
        }
      </ul>
    </section>

    <section class="card">
      <div class="card-title"><span>Réseau</span><small class="muted">confiance · crédit</small></div>
      <ul class="people">
        @for (c of game.s().contacts; track c.id) {
          <li>
            <span class="who"><span><strong>{{ c.name }}</strong><small class="muted">{{ contactLabel(c.type) }}</small></span></span>
            <span class="mono small">{{ c.trust | number: '1.0-0' }} ·
              <span [class.pos]="c.balance > 0" [class.neg]="c.balance < 0">{{ c.balance > 0 ? '+' : '' }}{{ c.balance }}</span>
            </span>
          </li>
        }
      </ul>
    </section>
  `,
  styles: `
    :host { display: grid; gap: 12px; align-content: start; }
    ul { list-style: none; margin: 0; padding: 0; }
    .small { font-size: 12.5px; }
    .factions { display: grid; gap: 9px; margin-top: 10px; }
    .stance-line { margin: 0; color: var(--ink-2); }
    .row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
    .people li { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
    .people li:last-child { border-bottom: 0; }
    .who { display: flex; gap: 8px; align-items: center; min-width: 0;
      > span:last-child { display: flex; flex-direction: column; min-width: 0; }
      strong { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      small { font-size: 11.5px; } }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .rel { font-size: 12.5px; }
    .founded { margin-top: 12px; padding: 8px 10px; border-left: 4px solid; border-radius: 6px; background: var(--surface-2); font-size: 12.5px;
      display: grid; gap: 2px; small { font-size: 11.5px; } }
    .found { margin-top: 12px; width: 100%; }
    .pos { color: var(--good); } .neg { color: var(--bad); }
  `,
})
export class PartyPanelComponent {
  protected readonly game = inject(GameStateService);

  protected readonly leader = computed(() => {
    const s = this.game.s();
    return s.party.leaderNpcId === 'player' ? 'vous' : s.npcs.find(n => n.id === s.party.leaderNpcId)?.name ?? '—';
  });

  protected readonly axis = computed<StanceMarker[]>(() => {
    const s = this.game.s();
    return [
      { label: 'Vous', value: s.player.stance, color: 'var(--ink)', row: 'top' },
      { label: 'Parti', value: s.party.position, color: s.party.color, row: 'bottom' },
    ];
  });

  protected stance(v: number) { return stanceLabel(v); }
  protected readonly founding = signal(false);
  protected readonly offer = computed(() => !!this.game.player().flags['foundOffer']);
  protected readonly malus = computed(() => youngPartyMalus(this.game.s()));

  /** Membres du parti d'abord, puis l'opposition la plus influente */
  protected readonly npcs = computed(() => {
    const s = this.game.s();
    const own = s.npcs.filter(n => n.partyId === s.party.id);
    const others = s.npcs.filter(n => n.partyId !== s.party.id).sort((a, b) => b.influence - a.influence).slice(0, 3);
    return [...own, ...others];
  });

  protected partyColor(id: string) {
    const s = this.game.s();
    return [s.party, ...s.otherParties].find(p => p.id === id)?.color ?? '#999';
  }
  protected rankLabel(id: keyof typeof RANKS) { return RANKS[id].label; }
  protected contactLabel(t: ContactType) { return CONTACT_LABELS[t]; }
}

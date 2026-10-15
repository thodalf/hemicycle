import { PersonLinkComponent } from '../person-link/person-link.component';
import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ELECTIONS } from '../../data/ranks';
import { ElectionEngineService } from '../../services/election-engine.service';
import { GameStateService } from '../../services/game-state.service';

/** Sondages dynamiques, plafond de dépenses et résultats */
@Component({
  selector: 'app-election-panel',
  imports: [PersonLinkComponent, DecimalPipe],
  template: `
    <section class="card">
      @if (engine.active(); as e) {
        <div class="card-title">
          <span>{{ engine.config()!.label }}</span>
          <span class="chip accent">{{ e.secondRoundWeek ? 'Second tour ' + game.month(e.secondRoundWeek) : weeksLeft() > 0 ? 'Dans ' + weeksLeft() + ' mois' : 'Mois du vote' }}</span>
        </div>
        @if (game.week() < e.campaignStartWeek) {
          <p class="muted">La campagne s’ouvre en {{ game.month(e.campaignStartWeek) }}.</p>
        }
        @if (rows().length) {
          <div class="eyebrow">{{ e.secondRoundWeek ? 'Sondage du second tour' : 'Sondage' }} · {{ game.month(engine.latestPoll()!.week) }}</div>
          <ul class="poll">
            @for (r of rows(); track r.id) {
              <li [class.me]="r.id === 'player'">
                <span class="cand"><app-person [name]="r.name" /></span>
                <span class="track"><span [style.width.%]="r.value * 1.6" [style.background]="r.color"></span></span>
                <span class="mono">{{ r.value | number: '1.1-1' }}</span>
              </li>
            }
          </ul>
          @if (trend(); as t) {
            <svg class="spark" viewBox="0 0 200 40" preserveAspectRatio="none" role="img" aria-label="Évolution de vos intentions de vote">
              <polyline [attr.points]="t" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" />
            </svg>
          }
        }
        @if (game.player().finances.legalCeiling; as ceiling) {
          <div class="ceiling">
            <div class="row"><span>Dépenses de campagne</span><span class="mono">{{ game.player().finances.campaignSpent | number: '1.0-0' }} / {{ ceiling | number: '1.0-0' }} €</span></div>
            <div class="bar"><span [style.width.%]="100 * game.player().finances.campaignSpent / ceiling"
              [style.background]="game.player().finances.campaignSpent > ceiling ? 'var(--bad)' : 'var(--accent)'"></span></div>
            <div class="row small muted"><span>Dynamique de campagne</span><span class="mono">{{ game.player().momentum | number: '1.0-0' }}</span></div>
          </div>
        }
      } @else {
        <div class="card-title"><span>Scrutins</span></div>
        @if (engine.lastResult(); as r) {
          <p>{{ label(r.type) }} : {{ r.result!.winnerId === 'player' ? 'victoire' : 'défaite' }}
            ({{ (r.result!.secondRound ?? r.result!.firstRound)['player'] | number: '1.0-1' }} %).</p>
        }
        @if (game.s().kingdom) { <p class="muted">Aucun scrutin à l’horizon : sous la Couronne, le trône ne se remet pas en jeu. Seules les législatives rythment encore la vie du royaume.</p> }
        @else { <p class="muted">Aucun scrutin programmé. Remplissez les conditions du prochain palier pour obtenir l’investiture. La présidentielle, elle, suit son calendrier : tous les cinq ans.</p> }
      }
    </section>
  `,
  styles: `
    .poll { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 6px; }
    .poll li { display: grid; grid-template-columns: 112px 1fr 38px; gap: 8px; align-items: center; font-size: 12.5px; }
    .poll li.me { font-weight: 600; }
    .cand { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .track { height: 8px; background: var(--surface-2); border-radius: 4px; overflow: hidden;
      span { display: block; height: 100%; border-radius: 4px; transition: width .4s; } }
    .mono { text-align: right; }
    .spark { width: 100%; height: 40px; margin-top: 10px; background: var(--surface-2); border-radius: 6px; }
    .ceiling { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line); display: grid; gap: 5px; }
    .row { display: flex; justify-content: space-between; font-size: 12.5px; }
    .small { font-size: 12px; }
    p { margin: 0 0 6px; }
  `,
})
export class ElectionPanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly engine = inject(ElectionEngineService);

  protected readonly weeksLeft = computed(() => (this.engine.active()?.week ?? 0) - this.game.week());

  protected readonly rows = computed(() => {
    const poll = this.engine.latestPoll();
    if (!poll) return [];
    return Object.entries(poll.results)
      .map(([id, value]) => ({ ...this.engine.candidate(id), value }))
      .sort((a, b) => b.value - a.value);
  });

  protected readonly trend = computed(() => {
    const values = this.engine.polls().map(p => p.results['player'] ?? 0);
    if (values.length < 2) return null;
    const max = Math.max(...values) + 5, min = Math.max(0, Math.min(...values) - 5);
    return values.map((v, i) => `${(i / (values.length - 1)) * 200},${40 - ((v - min) / (max - min)) * 36 - 2}`).join(' ');
  });

  protected label(t: keyof typeof ELECTIONS) { return ELECTIONS[t].label; }
}

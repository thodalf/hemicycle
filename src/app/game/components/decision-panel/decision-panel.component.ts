import { LinkedTextComponent } from '../person-link/person-link.component';
import { Component, computed, inject } from '@angular/core';
import { DOMAIN_LABELS, Decision } from '../../models/game.models';
import { GameStateService } from '../../services/game-state.service';
import { TurnService } from '../../services/turn.service';
import { FxService, toneOfSummary } from '../../services/fx.service';
import { EmblemComponent } from '../emblem/emblem.component';

const SOURCE_LABELS: Record<Decision['source'], string> = {
  medias: 'Médias', parti: 'Parti', reseau: 'Réseau', rival: 'Rivalité', carriere: 'Carrière', evenement: 'Événement',
};

/**
 * Prototype : prise de décision.
 * Chaque décision affiche ses options, leurs conditions (maîtrise d'un dossier)
 * et la probabilité de succès calculée par le moteur.
 */
@Component({
  selector: 'app-decision-panel',
  imports: [LinkedTextComponent, EmblemComponent],
  template: `
    @if (turn.lastOutcome(); as o) {
      <div class="outcome" [class.bad]="o.tone === 'negative'" role="status">
        <svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="14" />
          @if (o.tone === 'negative') { <path d="M11 11 L21 21 M21 11 L11 21" /> } @else { <path d="M9 16.5 L14 21.5 L23 11.5" /> }
        </svg>
        <div class="o-text">
          <div class="eyebrow">{{ o.title }}</div>
          <strong>{{ o.text }}</strong>
          @if (o.summary.length) { <div class="summary">{{ o.summary.join(' · ') }}</div> }
        </div>
        <button class="btn small" (click)="turn.lastOutcome.set(null)">OK</button>
      </div>
    }

    @for (d of decisions(); track d.id) {
      <article class="card decision" [class.urgent]="d.deadlineWeek <= game.week()">
        <header>
          <app-emblem [decision]="d" />
          <span class="chip accent">{{ sourceLabel(d) }}</span>
          @if (d.domain) { <span class="chip">{{ domainLabel(d) }} · maîtrise {{ mastery(d) }}</span> }
          <span class="spacer"></span>
          @if (d.deadlineWeek <= game.week()) {
            <span class="chip bad">À trancher maintenant</span>
          } @else {
            <span class="chip">Avant {{ game.month(d.deadlineWeek) }}</span>
          }
        </header>
        <h3>{{ d.title }}</h3>
        <p class="context"><app-linked-text [text]="d.context" /></p>
        <div class="choices">
          @for (c of d.choices; track c.id) {
            @let available = turn.isChoiceAvailable(d, c);
            @let chance = turn.successChance(d, c);
            <button class="choice" [disabled]="!available" (click)="choose($event, d.id, c.id)">
              <span class="choice-label">{{ c.label }}</span>
              @if (c.hint) { <span class="choice-hint">{{ c.hint }}</span> }
              <span class="choice-meta">
                @if (isGame(c)) {
                  <span class="chip accent">🎮 À vous de jouer</span>
                } @else if (chance !== null) {
                  <span class="chip" [class.good]="chance >= 65" [class.warn]="chance >= 35 && chance < 65"
                        [class.bad]="chance < 35">Succès {{ chance }} %</span>
                } @else {
                  <span class="chip">Sans risque</span>
                }
                @if (!available) { <span class="chip bad">Condition non remplie</span> }
              </span>
            </button>
          }
        </div>
      </article>
    } @empty {
      <div class="card calm">
        <span class="eyebrow">Décisions</span>
        <p class="muted">Aucun dossier brûlant sur votre bureau. Profitez-en pour avancer.</p>
      </div>
    }
  `,
  styles: `
    :host { display: grid; gap: 12px; }
    .outcome {
      display: flex; gap: 12px; align-items: center; animation: outcome-in .45s cubic-bezier(.2,.9,.3,1.3) both;
      .o-text { flex: 1; }
      padding: 12px 14px; border-radius: var(--radius); background: var(--good-soft); color: var(--ink);
      &.bad { background: var(--bad-soft); }
      .summary { font-size: 12.5px; color: var(--ink-2); margin-top: 2px; }
    }
    .decision { border-left: 4px solid var(--accent); animation: card-in .55s cubic-bezier(.2,.9,.3,1.2) both; }
    .decision.urgent { border-left-color: var(--bad); animation: card-in .55s cubic-bezier(.2,.9,.3,1.2) both, urgent 1.6s 0.6s ease-in-out infinite; }
    .mark { width: 30px; height: 30px; flex-shrink: 0; fill: none; stroke: var(--good); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round;
      circle, path { stroke-dasharray: 90; stroke-dashoffset: 90; animation: draw .6s .1s ease forwards; }
      path { animation-delay: .35s; } }
    .outcome.bad .mark { stroke: var(--bad); }
    .outcome.bad { animation: outcome-in .45s cubic-bezier(.2,.9,.3,1.3) both, nudge .4s .2s ease; }
    @keyframes draw { to { stroke-dashoffset: 0; } }
    @keyframes outcome-in { from { opacity: 0; transform: scale(.9) translateY(-6px); } }
    @keyframes nudge { 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
    @keyframes card-in { from { opacity: 0; transform: translateX(-24px) rotate(-1deg); } }
    @keyframes urgent { 50% { box-shadow: 0 0 0 3px var(--bad-soft), var(--shadow); } }
    @media (prefers-reduced-motion: reduce) { .decision, .outcome, .mark * { animation: none !important; } .mark * { stroke-dashoffset: 0; } }
    header { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 8px; }
    .spacer { flex: 1; }
    h3 { font-size: 19px; }
    .context { margin: 6px 0 12px; color: var(--ink-2); }
    .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px; }
    .choice {
      display: flex; flex-direction: column; gap: 4px; text-align: left; cursor: pointer;
      background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px;
      transition: border-color .15s, transform .15s, box-shadow .15s;
      &:hover:not(:disabled) { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow); }
      &:active:not(:disabled) { transform: translateY(1px); }
      &:disabled { opacity: .55; cursor: not-allowed; }
    }
    .choice-label { font-weight: 600; }
    .choice-hint { font-size: 12.5px; color: var(--ink-2); }
    .choice-meta { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
    .calm p { margin: 6px 0 0; }
  `,
})
export class DecisionPanelComponent {
  /** Choix qui se joue en mini-jeu */
  protected isGame(c: { effects: { kind: string }[] }): boolean { return c.effects.some(e => e.kind === 'minigame'); }

  protected readonly game = inject(GameStateService);
  protected readonly turn = inject(TurnService);
  private readonly fx = inject(FxService);

  /** Tranche la décision, puis célèbre (ou encaisse) le résultat */
  protected choose(event: MouseEvent, decisionId: string, choiceId: string): void {
    const x = event.clientX, y = event.clientY;
    this.turn.decide(decisionId, choiceId);
    const o = this.turn.lastOutcome();
    if (!o) return;
    if (o.tone === 'negative') {
      this.fx.burst(x, y, 'bad', 12);
      this.fx.float('Raté', 'bad', x, y - 10);
      this.fx.shake();
    } else {
      this.fx.burst(x, y, 'good');
    }
    if (o.summary.some(s => s.startsWith('Rapport transmis'))) this.fx.stamp('Transmis', 'neutral', 'Top secret');
    o.summary.slice(0, 4).forEach((s, i) => this.fx.float(s, toneOfSummary(s), x, y - 44 - i * 26, 150 + i * 160));
  }

  /** Urgentes d'abord */
  protected readonly decisions = computed(() =>
    [...this.game.s().pendingDecisions].sort((a, b) => a.deadlineWeek - b.deadlineWeek));

  protected sourceLabel(d: Decision) { return SOURCE_LABELS[d.source]; }
  protected domainLabel(d: Decision) { return d.domain ? DOMAIN_LABELS[d.domain] : ''; }
  protected mastery(d: Decision) { return d.domain ? Math.round(this.game.player().dossiers[d.domain].mastery) : 0; }
}

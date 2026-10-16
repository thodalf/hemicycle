import { Injectable, computed, inject, signal } from '@angular/core';
import { DebateCard, DebateExchange, DebateStatus, GameState } from '../models/game.models';
import { breathe, cardChances, currentTopic, debateRewards, effectivePower, oppOdds, playCard, debatePollShift } from '../engine/debate';
import { applyEffects, pushNews } from '../engine/effects';
import { recordObjectiveEvent, refreshObjectives } from '../engine/objectives';
import { Rng } from '../engine/rng';
import { GameStateService } from './game-state.service';

/** Pilote le débat en cours : jouer une carte, souffler, quitter le plateau */
@Injectable({ providedIn: 'root' })
export class DebateService {
  private readonly game = inject(GameStateService);

  readonly debate = computed(() => this.game.state()?.debate ?? null);
  readonly topic = computed(() => {
    const d = this.debate();
    return d ? currentTopic(d) : null;
  });

  /** La manche qui vient d'être jouée, montrée en grand avant de passer à la suite */
  readonly reveal = signal<{ ex: DebateExchange; status: DebateStatus; feint: boolean } | null>(null);

  odds() {
    const d = this.debate();
    return d ? oppOdds(d) : null;
  }

  chances(card: DebateCard) {
    const d = this.debate();
    return d ? cardChances(d, card) : { win: 0, draw: 0, lose: 0, beats: [], losesTo: [] };
  }

  next(): void {
    this.reveal.set(null);
  }

  power(card: DebateCard) {
    const d = this.debate();
    return d ? effectivePower(d, card) : { power: card.power };
  }

  play(cardId: string): void {
    this.game.mutate((d, rng) => {
      if (!d.debate) return;
      playCard(d.debate, d, rng, cardId);
      this.settle(d, rng);
      this.showLast(d);
    });
  }

  breathe(): void {
    this.game.mutate((d, rng) => {
      if (!d.debate) return;
      breathe(d.debate, d, rng);
      this.settle(d, rng);
      this.showLast(d);
    });
  }

  private showLast(d: GameState): void {
    const ex = d.debate?.log.at(-1);
    if (ex) this.reveal.set({ ex: { ...ex }, status: d.debate!.status, feint: ex.text.startsWith('Il change de pied') });
  }

  /** Ferme l'écran de débat une fois le résultat lu */
  leave(): void {
    this.reveal.set(null);
    this.game.mutate(d => {
      if (d.debate && d.debate.status !== 'en_cours') d.debate = null;
    });
  }

  private settle(d: GameState, rng: Rng): void {
    const debate = d.debate!;
    if (debate.status === 'en_cours') return;
    debate.rewardSummary = applyEffects(d, debateRewards(debate), { reason: debate.status === 'gagne' ? `Battu·e en débat (${debate.title.toLowerCase()})` : debate.title }, rng);
    const verdict = { gagne: 'remporté', perdu: 'perdu', nul: 'match nul' }[debate.status];
    const tone = debate.status === 'gagne' ? 'positive' : debate.status === 'perdu' ? 'negative' : 'neutral';
    pushNews(d, 'decision', tone, `${debate.title} face à ${debate.opponentName} : ${verdict}${debate.ko ? ' par K.-O.' : ''}`,
      debate.rewardSummary.join(' · '));
    // Le débat d'entre-deux-tours se lit dans les sondages du second tour
    if (debate.stakes === 'entre_deux_tours') {
      const shift = debatePollShift(debate);
      d.player.flags['e2tPoll'] = shift;
      const e = d.elections.find(x => !x.resolved && x.finalists && x.secondRoundWeek);
      const last = e ? [...d.polls].reverse().find(p => p.electionId === e.id && Object.keys(p.results).length === 2) : undefined;
      if (e && last) {
        const rival = e.finalists!.find(id => id !== 'player')!;
        const me = Math.max(1, Math.min(99, Math.round(((last.results['player'] ?? 50) + shift) * 10) / 10));
        d.polls.push({ week: d.week, electionId: e.id, results: { player: me, [rival]: Math.round((100 - me) * 10) / 10 } });
        const f = (v: number) => v.toLocaleString('fr-FR');
        pushNews(d, 'election', shift > 0 ? 'positive' : shift < 0 ? 'negative' : 'neutral', `Sondage après le débat : ${f(me)} %`,
          `Au lendemain du débat face à ${debate.opponentName}, vous passez de ${f(last.results['player'] ?? 50)} % à ${f(me)} % des intentions de vote au second tour (${shift > 0 ? '+' : ''}${f(shift)} pts).`);
      }
      debate.rewardSummary.push(`Second tour ${shift > 0 ? '+' : ''}${shift.toLocaleString('fr-FR')} pts dans les sondages`);
    }
    if (debate.status === 'gagne') { recordObjectiveEvent(d, 'debate_win'); d.player.flags['debatesWon'] = Number(d.player.flags['debatesWon'] ?? 0) + 1; }
    if (debate.status === 'gagne' && (debate.ko || debate.stakes === 'debat_electoral' || debate.stakes === 'entre_deux_tours')) {
      debate.rewardSummary.push(...applyEffects(d, [{ kind: 'booster', count: 1, reason: 'Une victoire éclatante attire les talents.' }], {}, rng));
    }
    refreshObjectives(d, rng);
  }
}

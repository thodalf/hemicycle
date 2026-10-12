import { Injectable, computed, inject, signal } from '@angular/core';
import { Decision, DecisionChoice, STAT_LABELS, StatKey, Tone } from '../models/game.models';
import { applyEffects, failureChance, meetsRequirement, pushNews, rollRisk } from '../engine/effects';
import { refreshObjectives, weeklyObjectives } from '../engine/objectives';
import { programPending } from '../engine/programme';
import { weeklyScenario } from '../engine/scenarios';
import { nationalBudgetBlocking } from '../engine/budget';
import { ActionPlannerService } from './action-planner.service';
import { ElectionEngineService } from './election-engine.service';
import { GameStateService } from './game-state.service';
import { MediaService } from './media.service';
import { NetworkService } from './network.service';
import { PartyManagementService } from './party-management.service';
import { ProgressionService } from './progression.service';
import { RivalAiService } from './rival-ai.service';

export interface WeekReport {
  week: number;
  deltas: { key: StatKey; label: string; delta: number }[];
  fundsDelta: number;
  headlines: string[];
  newDecisions: number;
}

export interface DecisionOutcome {
  title: string;
  text: string;
  tone: Tone;
  summary: string[];
}

/**
 * Chef d'orchestre du tour de jeu :
 *   1. exécute le plan d'actions de la semaine
 *   2. avance le calendrier
 *   3. fait tourner les systèmes (carrière, médias, parti, réseau, IA, scrutins)
 * Le tout dans UNE transaction GameStateService.mutate().
 */
@Injectable({ providedIn: 'root' })
export class TurnService {
  private readonly game = inject(GameStateService);
  private readonly planner = inject(ActionPlannerService);
  private readonly progression = inject(ProgressionService);
  private readonly media = inject(MediaService);
  private readonly party = inject(PartyManagementService);
  private readonly network = inject(NetworkService);
  private readonly rivals = inject(RivalAiService);
  private readonly elections = inject(ElectionEngineService);

  readonly lastReport = signal<WeekReport | null>(null);
  readonly lastOutcome = signal<DecisionOutcome | null>(null);

  /** Décisions qu'il faut trancher avant de pouvoir finir la semaine */
  readonly blocking = computed(() => {
    const s = this.game.s();
    return s.pendingDecisions.filter(d => d.deadlineWeek <= s.week);
  });
  readonly canEndWeek = computed(() =>
    this.game.s().status === 'en_cours' && this.blocking().length === 0 && !this.game.s().debate && !this.game.s().protest && !this.game.s().scene
    && !programPending(this.game.s()) && !nationalBudgetBlocking(this.game.s()));

  endWeek(): void {
    if (!this.canEndWeek()) return;
    const before = this.game.s();
    const beforeStats = { ...before.player.stats };
    const beforeFunds = before.player.finances.personal + before.player.finances.campaign;
    const beforeDecisions = new Set(before.pendingDecisions.map(d => d.id));

    this.game.mutate((d, rng) => {
      this.planner.execute(d, rng);
      d.week += 1;
      this.progression.weekly(d, rng);
      this.media.weekly(d, rng);
      this.party.weekly(d, rng);
      this.network.weekly(d, rng);
      this.rivals.weekly(d, rng);
      this.elections.weekly(d, rng);
      weeklyObjectives(d, rng);
      weeklyScenario(d, rng);
    });

    const after = this.game.s();
    this.lastReport.set({
      week: before.week,
      deltas: (Object.keys(beforeStats) as StatKey[])
        .map(key => ({ key, label: STAT_LABELS[key], delta: Math.round(after.player.stats[key] - beforeStats[key]) }))
        .filter(x => x.delta !== 0),
      fundsDelta: after.player.finances.personal + after.player.finances.campaign - beforeFunds,
      headlines: after.news.filter(n => n.week === after.week && n.kind !== 'action').map(n => n.title).slice(0, 4),
      newDecisions: after.pendingDecisions.filter(d => !beforeDecisions.has(d.id)).length,
    });
  }

  isChoiceAvailable(decision: Decision, choice: DecisionChoice): boolean {
    return meetsRequirement(this.game.s(), choice.requires, decision.domain);
  }

  /** Probabilité de succès affichée au joueur (transparence des risques) */
  successChance(decision: Decision, choice: DecisionChoice): number | null {
    if (!choice.risk) return null;
    const ctx = { domain: decision.domain, targetId: decision.targetId };
    return Math.round((1 - failureChance(this.game.s(), choice.risk, ctx)) * 100);
  }

  decide(decisionId: string, choiceId: string): void {
    let outcome: DecisionOutcome | null = null;
    this.game.mutate((d, rng) => {
      const decision = d.pendingDecisions.find(x => x.id === decisionId);
      const choice = decision?.choices.find(c => c.id === choiceId);
      if (!decision || !choice || !meetsRequirement(d, choice.requires, decision.domain)) return;

      const ctx = { domain: decision.domain, targetId: decision.targetId };
      d.pendingDecisions = d.pendingDecisions.filter(x => x.id !== decisionId);
      const failed = rollRisk(d, choice.risk, ctx, rng);
      const summary = applyEffects(d, failed ? choice.risk!.onFailure : choice.effects, ctx, rng);
      const text = failed ? choice.risk!.failureNews ?? 'Ça tourne mal.' : choice.outcome ?? 'C’est fait.';
      const tone: Tone = failed ? 'negative' : 'positive';
      pushNews(d, 'decision', tone, `${decision.title} — ${choice.label}`, text);
      refreshObjectives(d, rng);
      outcome = { title: decision.title, text, tone, summary };
    });
    this.lastOutcome.set(outcome);
  }
}

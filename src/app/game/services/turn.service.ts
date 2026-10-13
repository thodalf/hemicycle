import { Injectable, computed, inject, signal } from '@angular/core';
import { Decision, DecisionChoice, Effect, GameState, STAT_LABELS, StatKey, Tone } from '../models/game.models';
import { applyEffects, failureChance, meetsRequirement, pushNews, rollRisk } from '../engine/effects';
import { retire, settleEndings, weeklyLife } from '../engine/life';
import { weeklyGovernment } from '../engine/government';
import { weeklyIntl } from '../engine/intl';
import { monthlyHostile, monthlyWar } from '../engine/war';
import { monthlyPhone } from '../engine/phone';
import { monthlyPlot } from '../engine/plot';
import { monthlySchemes } from '../engine/schemes';
import { autoVote, monthlyAssembly } from '../engine/assembly';
import { autoMinigames } from '../engine/minigame';
import { abandonProject, startProject, weeklyProject } from '../engine/projects';
import { PROJECTS_BY_ID } from '../data/projects';
import { canDeclare, declareCandidacy, endPresidency, weeklyPresidency, weeklyPresidential } from '../engine/presidency';
import { effectValue } from '../data/actions';
import { Rng } from '../engine/rng';
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
  /** Avancement du projet au long cours pendant la période */
  project?: { label: string; done: number; months: number; finished: boolean };
}

export interface SkipReport {
  months: number;
  reason: string;
}

/** Décisions qui interrompent un projet auquel on se consacre : le joueur doit les trancher lui-même */
const STOP_TAGS = new Set(['guerre_bilan', 'former_gouvernement', 'pm_censure', 'ev_matignon', 'alerte_sante', 'pres_censure', 'pres_destitution', 'pres_tentative', 'banqueroute', 'remaniement', 'congres', 'faillite_parti']);
/** Quand on se consacre à un projet, on ne s’engage dans rien d’autre : pas de scène, pas d’adhésion, pas d’achat */
const ACTIVE_KINDS = new Set<Effect['kind']>(['scene', 'debate', 'protest', 'joinCrown', 'joinLodge', 'joinPress', 'leaveCrown', 'leaveLodge', 'leavePress', 'gainAsset', 'sellAsset', 'die', 'declare', 'resign', 'bankrupt', 'loan', 'end', 'minigame', 'war', 'vote']);

export interface DecisionOutcome {
  title: string;
  text: string;
  tone: Tone;
  summary: string[];
}

/**
 * Chef d'orchestre du tour de jeu :
 *   1. exécute le plan d'actions du mois
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
  readonly lastSkip = signal<SkipReport | null>(null);
  readonly lastOutcome = signal<DecisionOutcome | null>(null);

  /** Décisions qu'il faut trancher avant de pouvoir finir le mois */
  readonly blocking = computed(() => {
    const s = this.game.s();
    return s.pendingDecisions.filter(d => d.deadlineWeek <= s.week);
  });
  readonly canEndWeek = computed(() =>
    this.game.s().status === 'en_cours' && this.blocking().length === 0 && !this.game.s().debate && !this.game.s().protest && !this.game.s().scene
    && !this.game.s().vote && !(this.game.s().minigames ?? []).length
    && !programPending(this.game.s()) && !nationalBudgetBlocking(this.game.s()));

  endWeek(): void {
    if (!this.canEndWeek()) return;
    const before = this.game.s();
    const beforeStats = { ...before.player.stats };
    const beforeFunds = before.player.finances.personal + before.player.finances.campaign;
    const beforeDecisions = new Set(before.pendingDecisions.map(d => d.id));

    this.game.mutate((d, rng) => {
      this.planner.execute(d, rng);
      this.advance(d, rng);
    });
    this.lastSkip.set(null);
    this.report(before, beforeStats, beforeFunds, beforeDecisions);
  }

  /** Un mois de la vie politique (et de la vie tout court) */
  private advance(d: GameState, rng: Rng): void {
    d.week += 1;
    this.progression.weekly(d, rng);
    this.media.weekly(d, rng);
    this.party.weekly(d, rng);
    this.network.weekly(d, rng);
    this.rivals.weekly(d, rng);
    this.elections.weekly(d, rng);
    weeklyPresidential(d, rng);
    weeklyPresidency(d, rng);
    weeklyGovernment(d, rng);
    weeklyIntl(d, rng);
    monthlyHostile(d, rng);
    monthlyPhone(d, rng);
    monthlyPlot(d, rng);
    monthlySchemes(d, rng);
    monthlyWar(d, rng);
    monthlyAssembly(d, rng);
    weeklyObjectives(d, rng);
    weeklyScenario(d, rng);
    settleEndings(d);
    weeklyProject(d, rng);
    settleEndings(d);
    weeklyLife(d, rng);
  }

  /** Se consacrer à son projet : possible hors campagne électorale, avec un projet en cours */
  readonly canDevote = computed(() => this.devoteBlock() === null);

  /** Pourquoi on ne peut pas (encore) se consacrer à son projet */
  readonly devoteBlock = computed((): string | null => {
    const s = this.game.s();
    if (!s.project) return 'Aucun projet en cours';
    if (!this.canEndWeek()) return 'Terminez d’abord ce qui est en cours';
    if (s.player.finances.legalCeiling !== null || s.elections.some(e => !e.resolved)) return 'Pendant une campagne électorale, le projet avance chaque mois mais on ne peut pas s’y consacrer entièrement';
    const urgent = s.pendingDecisions.find(x => STOP_TAGS.has(x.tag));
    if (urgent) return `Tranchez d’abord : ${urgent.title}`;
    return null;
  });

  lancer(projectId: string): boolean {
    let ok = false;
    this.game.mutate(d => { ok = startProject(d, projectId); });
    return ok;
  }

  abandon(): void {
    this.game.mutate(d => abandonProject(d));
  }

  /**
   * Se consacrer à son projet : les mois s'enchaînent jusqu'à son terme ; les petites
   * décisions se règlent d'elles-mêmes (le choix le plus prudent), et l'on est rappelé·e dès
   * qu'il se passe quelque chose d'important (campagne, promotion, crise grave, alerte médicale…).
   */
  devote(): void {
    if (!this.canDevote()) return;
    const before = this.game.s();
    const project = before.project!;
    const beforeStats = { ...before.player.stats };
    const beforeFunds = before.player.finances.personal + before.player.finances.campaign;
    const beforeDecisions = new Set(before.pendingDecisions.map(d => d.id));
    const report: SkipReport = { months: 0, reason: '' };
    this.game.mutate((d, rng) => {
      const rank = d.player.rankId;
      const milestones = d.milestones.length;
      const elections = new Set(d.elections.map(e => e.id));
      this.planner.execute(d, rng);
      // Garde-fou : jamais plus de mois que la durée restante du projet (+ marge)
      const limit = project.months - project.done + 2;
      while (d.project && d.project.id === project.id && report.months < limit) {
        const stop = this.autoResolve(d, rng);
        if (stop) { report.reason = `Décision à prendre : ${stop}`; break; }
        this.advance(d, rng);
        report.months += 1;
        // Un projet qui aboutit peut ouvrir une scène (promotion du livre…) : on la laisse au joueur
        if (d.project) { d.debate = null; d.protest = null; d.scene = null; autoMinigames(d, rng); }
        // Les scrutins ordinaires : vous suivez la consigne du groupe ; les autres vous rappellent
        if (d.vote && !autoVote(d, rng)) { report.reason = `Scrutin à l’Assemblée : ${d.vote.title}`; break; }
        if (d.status === 'mort') { report.reason = 'Décès'; break; }
        if (!d.project) break;
        if (d.milestones.length > milestones) { report.reason = d.milestones.at(-1)!.title; break; }
        if (d.player.rankId !== rank) { report.reason = 'Changement de rang'; break; }
        if (d.elections.some(e => !elections.has(e.id) && !e.resolved)) { report.reason = 'Une campagne électorale s’ouvre'; break; }
        if (d.elections.some(e => !elections.has(e.id) && e.resolved)) { report.reason = 'Résultats d’élection'; break; }
        if (programPending(d) || nationalBudgetBlocking(d)) { report.reason = 'Un dossier exige votre attention'; break; }
        const urgent = d.pendingDecisions.find(x => STOP_TAGS.has(x.tag));
        if (urgent) { report.reason = `Décision à prendre : ${urgent.title}`; break; }
      }
      if (report.months && d.project) {
        pushNews(d, 'systeme', 'neutral', `Projet interrompu après ${report.months} mois`,
          `${report.reason}. Le projet continue : ${d.project.done}/${d.project.months} mois.`);
      }
    });
    this.lastSkip.set(report);
    this.report(before, beforeStats, beforeFunds, beforeDecisions);
  }

  /** Règle les décisions en suspens par le choix le plus prudent ; renvoie le titre d'une décision qui doit attendre le joueur */
  private autoResolve(d: GameState, rng: Rng): string | null {
    for (const decision of [...d.pendingDecisions]) {
      if (STOP_TAGS.has(decision.tag)) return decision.title;
      const usable = decision.choices.filter(c => meetsRequirement(d, c.requires, decision.domain));
      const calm = usable.filter(c => !c.effects.some(e => ACTIVE_KINDS.has(e.kind)));
      const pool = calm.length ? calm : usable;
      const weight = (c: DecisionChoice) => (c.risk ? 100 : 0) + c.effects.reduce((t, e) => t + Math.abs(effectValue(e)), 0);
      const choice = [...pool].sort((a, b) => weight(a) - weight(b))[0];
      d.pendingDecisions = d.pendingDecisions.filter(x => x.id !== decision.id);
      if (!choice) continue;
      const ctx = { domain: decision.domain, targetId: decision.targetId };
      const failed = rollRisk(d, choice.risk, ctx, rng);
      applyEffects(d, failed ? choice.risk!.onFailure : choice.effects, ctx, rng);
      pushNews(d, 'decision', failed ? 'negative' : 'neutral', `${decision.title} — ${choice.label}`, 'Réglé en votre absence.');
    }
    return null;
  }

  /** Se déclarer candidat·e à l'élection présidentielle */
  readonly declaration = computed(() => canDeclare(this.game.s()));
  declare(): void {
    this.game.mutate(d => { declareCandidacy(d); });
  }

  /** Quitter l'Élysée avant le terme */
  resign(): void {
    this.game.mutate(d => endPresidency(d, 'demission'));
  }

  /** Se retirer de la vie publique : la fin de vie défile jusqu'à la nécrologie */
  retire(): void {
    this.game.mutate((d, rng) => retire(d, rng));
  }

  private report(before: GameState, beforeStats: GameState['player']['stats'], beforeFunds: number, beforeDecisions: Set<string>): void {
    const after = this.game.s();
    this.lastReport.set({
      week: before.week,
      deltas: (Object.keys(beforeStats) as StatKey[])
        .map(key => ({ key, label: STAT_LABELS[key], delta: Math.round(after.player.stats[key] - beforeStats[key]) }))
        .filter(x => x.delta !== 0),
      fundsDelta: after.player.finances.personal + after.player.finances.campaign - beforeFunds,
      headlines: after.news.filter(n => n.week === after.week && n.kind !== 'action').map(n => n.title).slice(0, 4),
      newDecisions: after.pendingDecisions.filter(d => !beforeDecisions.has(d.id)).length,
      project: this.projectReport(before, after),
    });
  }

  private projectReport(before: GameState, after: GameState): WeekReport['project'] {
    const was = before.project;
    if (!was) return undefined;
    const label = PROJECTS_BY_ID.get(was.id)?.label ?? was.id;
    if (after.project?.id === was.id) return { label, done: after.project.done, months: after.project.months, finished: false };
    return { label, done: was.months, months: was.months, finished: !!after.news.find(n => n.title.endsWith(label) && n.week >= before.week) };
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

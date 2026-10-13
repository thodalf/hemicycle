import { inMonth } from '../engine/calendar';
import { campaignRefund } from '../engine/loans';
import { campaignOpensAt, canDeclare, declareCandidacy, incumbentBonus, presidentialResult } from '../engine/presidency';
import { Injectable, computed, inject } from '@angular/core';
import { ElectionType, GameState, ScheduledElection } from '../models/game.models';
import { ELECTIONS, RANKS } from '../data/ranks';
import { createDebate } from '../engine/debate';
import { monthlyBarometer, pushBarometer, ranking, takeBarometer, voteShares } from '../engine/electoral';
import { entreDeuxToursDecision } from '../engine/entre-deux-tours';
import { applyEffects, pushNews } from '../engine/effects';
import { circoResult, recordMap } from '../engine/country';
import { yearOf } from '../engine/calendar';
import { Rng, clamp, nextId } from '../engine/rng';
import { GameStateService } from './game-state.service';

export interface Candidate {
  id: string;
  name: string;
  color: string;
}

/**
 * Scrutins : programmation, ouverture de campagne (plafond légal),
 * sondages mensuels, débat d'entre-deux-tours et dépouillement.
 */
@Injectable({ providedIn: 'root' })
export class ElectionEngineService {
  private readonly game = inject(GameStateService);

  readonly active = computed(() => this.game.s().elections.find(e => !e.resolved) ?? null);
  readonly config = computed(() => {
    const e = this.active();
    return e ? ELECTIONS[e.type] : null;
  });
  readonly polls = computed(() => {
    const e = this.active();
    return e ? this.game.s().polls.filter(p => p.electionId === e.id) : [];
  });
  readonly latestPoll = computed(() => this.polls().at(-1) ?? null);
  readonly lastResult = computed(() => [...this.game.s().elections].reverse().find(e => e.resolved) ?? null);

  candidate(id: string): Candidate {
    const s = this.game.s();
    if (id === 'player') return { id, name: s.player.name, color: s.party.color };
    const npc = s.npcs.find(n => n.id === id);
    const party = [s.party, ...s.otherParties].find(p => p.id === npc?.partyId);
    return { id, name: npc?.name ?? id, color: party?.color ?? '#888' };
  }

  weekly(d: GameState, rng: Rng): void {
    this.schedule(d);
    monthlyBarometer(d, rng);
    const election = d.elections.find(e => !e.resolved);
    if (!election) return;
    const cfg = ELECTIONS[election.type];

    if (election.type === 'presidentielle' && d.week >= election.campaignStartWeek && !d.program) {
      d.program = { answers: {}, validated: false };
      pushNews(d, 'election', 'neutral', 'Votre programme présidentiel est attendu',
        'Vingt questions, quatre options chacune : votre programme fixera votre ligne, vos soutiens et vos débats.');
    }

    if (d.week === election.campaignStartWeek) {
      d.player.finances.legalCeiling = cfg.legalCeiling;
      d.player.finances.campaignSpent = 0;
      d.player.momentum = 0;
      pushNews(d, 'election', 'neutral', `La campagne des ${cfg.label.toLowerCase()} est ouverte`,
        `Plafond légal des dépenses : ${cfg.legalCeiling.toLocaleString('fr-FR')} €. Vote ${inMonth(election.week)}.`);
    }

    if (d.week >= election.campaignStartWeek && d.week < election.week) {
      d.player.momentum = clamp(d.player.momentum * (d.player.staff.includes('directeur_campagne') ? 0.95 : 0.9));
      if (election.type === 'presidentielle') {
        // Le baromètre continue pendant la campagne, avec les candidats officiels
        const b = takeBarometer(d, rng, election.candidateIds, false);
        pushBarometer(d, b);
        d.polls.push({ week: d.week, electionId: election.id, results: b.results });
      } else {
        d.polls.push({ week: d.week, electionId: election.id, results: this.shares(d, election, rng, 2.5) });
      }
      if (d.week === election.week - 1) {
        const latest = d.polls.at(-1)!.results;
        const rival = election.candidateIds.filter(id => id !== 'player').sort((a, b) => latest[b] - latest[a])[0];
        // Le débat décisif remplace tout autre débat programmé ce mois-ci
        const debate = createDebate(d, rng, 'debat_electoral', rival,
          election.type === 'primaire' ? d.party.position : undefined);
        if (debate) {
          d.debate = debate;
          pushNews(d, 'election', 'neutral', `Débat décisif face à ${debate.opponentName}`,
            'Le vote a lieu le mois prochain. Ce débat peut tout faire basculer.');
        }
      }
    }

    if (election.secondRoundWeek) {
      if (d.week >= election.secondRoundWeek) this.resolveSecondRound(d, election, rng);
    } else if (d.week >= election.week) this.resolve(d, election, rng);
  }

  /** Programme le prochain scrutin quand le joueur remplit les conditions d'investiture */
  private schedule(d: GameState): void {
    if (d.scenario === 'royaute') return;
    if (d.elections.some(e => !e.resolved)) return;
    const rule = RANKS[d.player.rankId].promotion;
    if (rule?.via !== 'election') return;
    // La présidentielle suit le calendrier (tous les cinq ans), pas l'investiture
    if (rule.election === 'presidentielle') return;
    if (d.player.flags['retired'] || Number(d.player.flags['ineligibleUntil'] ?? 0) > d.week) return;
    if (d.week < Number(d.player.flags['nextElectionWeek'] ?? 0)) return;
    const campaign = ELECTIONS[rule.election].campaignMonths;
    // La primaire se tient dans l'année qui précède la présidentielle
    if (rule.election === 'primaire') {
      const left = d.presidential.nextWeek - d.week;
      if (d.player.flags['monarchie'] || left > 16 || left < campaign + ELECTIONS.presidentielle.campaignMonths + 1) return;
    } else if (d.presidential.declared && d.week + campaign + 1 >= campaignOpensAt(d)) {
      // Pas de scrutin local en travers de la campagne présidentielle
      return;
    }
    const ok = Object.entries(rule.requires).every(([k, v]) => d.player.stats[k as keyof typeof d.player.stats] >= v);
    if (!ok) return;

    const cfg = ELECTIONS[rule.election];
    const start = d.week + 1;
    const election: ScheduledElection = {
      id: nextId(d, 'elec'), type: rule.election, campaignStartWeek: start, week: start + cfg.campaignMonths,
      candidateIds: ['player', ...this.opponents(d, rule.election)], resolved: false,
    };
    d.elections.push(election);
    pushNews(d, 'election', 'positive', `Investiture obtenue : ${cfg.label}`,
      `Votre parti vous investit. La campagne commence le mois prochain.`);
  }

  private opponents(d: GameState, type: ElectionType): string[] {
    const cfg = ELECTIONS[type];
    const pool = d.npcs.filter(n => (cfg.internal ? n.partyId === d.party.id && n.id !== d.party.leaderNpcId : n.partyId !== d.party.id));
    const wantLeaders = type === 'presidentielle' || cfg.internal;
    return pool
      .sort((a, b) => (wantLeaders ? b.influence - a.influence : a.influence - b.influence))
      .slice(0, cfg.opponents)
      .map(n => n.id);
  }

  private shares(d: GameState, e: ScheduledElection, rng: Rng, noise: number, ids = e.candidateIds): Record<string, number> {
    return voteShares(d, e.type, ids, rng, noise);
  }

  private resolve(d: GameState, e: ScheduledElection, rng: Rng): void {
    const firstRound = this.shares(d, e, rng, 4);
    const ranked = ranking(firstRound);
    // Présidentielle : si vous êtes qualifié·e, deux semaines d'entre-deux-tours (le mois suivant)
    if (e.type === 'presidentielle' && ranked[0][1] < 50 && ranked.length > 1 && (ranked[0][0] === 'player' || ranked[1][0] === 'player')) {
      this.openSecondRound(d, e, firstRound, rng);
      return;
    }
    let winnerId = ranked[0][0];
    let secondRound: Record<string, number> | undefined;
    if (ranked[0][1] < 50 && ranked.length > 1) {
      secondRound = this.shares(d, e, rng, 4, [ranked[0][0], ranked[1][0]]);
      winnerId = Object.entries(secondRound).sort((a, b) => b[1] - a[1])[0][0];
    }
    this.finish(d, e, firstRound, secondRound, winnerId, rng);
  }

  /** Premier tour joué, vous êtes au second : ralliements, débat, sondage */
  private openSecondRound(d: GameState, e: ScheduledElection, firstRound: Record<string, number>, rng: Rng): void {
    const ranked = ranking(firstRound);
    const finalists: [string, string] = [ranked[0][0], ranked[1][0]];
    const rival = finalists.find(id => id !== 'player')!;
    e.firstRound = firstRound;
    e.finalists = finalists;
    e.secondRoundWeek = d.week + 1;
    d.player.flags['e2t'] = 0;
    const poll = voteShares(d, 'presidentielle', finalists, rng, 2.5);
    d.polls.push({ week: d.week, electionId: e.id, results: poll });
    const name = this.candidate(rival).name;
    const me = firstRound['player'];
    const first = ranked[0][0] === 'player';
    d.player.stats.stress = clamp(d.player.stats.stress + 8);
    d.player.momentum = clamp(d.player.momentum + (first ? 8 : 4));
    const f = (v: number) => v.toLocaleString('fr-FR');
    pushNews(d, 'election', 'positive', `Qualifié·e pour le second tour (${f(me)} %)`,
      `${first ? 'En tête du premier tour' : 'Deuxième du premier tour'} : duel face à ${name} (${f(firstRound[rival])} %). Sondage du second tour : ${f(poll['player'])} % – ${f(poll[rival])} %. Vote le mois prochain.`);
    const decision = entreDeuxToursDecision(d, e, firstRound, rng);
    if (decision) d.pendingDecisions.push(decision);
    const debate = createDebate(d, rng, 'entre_deux_tours', rival, 0);
    if (debate) {
      d.debate = debate;
      pushNews(d, 'election', 'neutral', `Le débat d’entre-deux-tours face à ${debate.opponentName}`,
        'Vingt millions de téléspectateurs. Le débat qui peut faire basculer le second tour.');
    }
  }

  /** Le second tour, un mois après le premier */
  private resolveSecondRound(d: GameState, e: ScheduledElection, rng: Rng): void {
    const finalists = e.finalists!;
    const bonus = { player: Number(d.player.flags['e2t'] ?? 0) };
    const secondRound = voteShares(d, 'presidentielle', finalists, rng, 3, bonus);
    const winnerId = ranking(secondRound)[0][0];
    d.player.flags['e2t'] = 0;
    this.finish(d, e, e.firstRound!, secondRound, winnerId, rng);
  }

  private finish(d: GameState, e: ScheduledElection, firstRound: Record<string, number>, secondRound: Record<string, number> | undefined, winnerId: string, rng: Rng): void {
    const cfg = ELECTIONS[e.type];
    const ranked = ranking(firstRound);

    // Dépassement du plafond : recours devant le juge électoral
    const invalidated = winnerId === 'player' && !!d.player.flags['depassement'] && rng.chance(0.4);
    if (invalidated) winnerId = (secondRound ? ranking(secondRound) : ranked).find(([id]) => id !== 'player')![0];

    e.resolved = true;
    e.result = { firstRound, secondRound, winnerId };
    // Remboursement forfaitaire de l'État (5 % des voix au premier tour)
    campaignRefund(d, cfg.legalCeiling, firstRound['player'] ?? 0, invalidated);
    d.player.finances.legalCeiling = null;
    d.player.finances.campaignSpent = 0;
    d.player.momentum = 0;
    d.player.flags['depassement'] = false;

    const score = (secondRound ?? firstRound)['player'] ?? firstRound['player'];
    if (e.type === 'legislatives' || e.type === 'presidentielle') recordMap(d, `${cfg.label} ${yearOf(d.week)}`, rng);
    if (e.candidateIds.includes('player')) circoResult(d, e.type, winnerId === 'player');
    if (e.type === 'presidentielle') {
      presidentialResult(d, e, winnerId, score, rng);
      return;
    }
    const rule = RANKS[d.player.rankId].promotion;
    if (winnerId === 'player' && rule) {
      applyEffects(d, [
        { kind: 'rank', rankId: rule.to }, { kind: 'stat', stat: 'influence', delta: 10 },
        { kind: 'stat', stat: 'popularity', delta: 5 }, { kind: 'stat', stat: 'politicalCapital', delta: 20 },
      ], {}, rng);
      pushNews(d, 'election', 'positive', `Victoire aux ${cfg.label.toLowerCase()} (${score} %)`,
        `Vous devenez ${RANKS[rule.to].label}.`);
      // Investi·e par la primaire : candidature présidentielle déclarée d'office
      if (e.type === 'primaire' && canDeclare(d).ok) declareCandidacy(d);
    } else {
      applyEffects(d, [
        { kind: 'stat', stat: 'popularity', delta: -8 }, { kind: 'stat', stat: 'influence', delta: -5 },
        { kind: 'stat', stat: 'stress', delta: 15 },
      ], {}, rng);
      d.player.flags['nextElectionWeek'] = d.week + cfg.interval;
      pushNews(d, 'election', 'negative',
        invalidated ? 'Élection annulée par le juge électoral' : `Défaite aux ${cfg.label.toLowerCase()} (${firstRound['player']} %)`,
        invalidated ? 'Vos comptes de campagne ont été rejetés. Victoire attribuée à votre adversaire.' : `Prochaine tentative possible ${inMonth(d.week + cfg.interval)}.`);
    }
  }
}

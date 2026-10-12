import { youngPartyMalus } from '../engine/founding';
import { Injectable, computed, inject } from '@angular/core';
import { ElectionType, GameState, ScheduledElection } from '../models/game.models';
import { ELECTIONS, RANKS } from '../data/ranks';
import { createDebate } from '../engine/debate';
import { programReport } from '../engine/programme';
import { applyEffects, partySupport, pushNews } from '../engine/effects';
import { Rng, clamp, nextId } from '../engine/rng';
import { GameStateService } from './game-state.service';

export interface Candidate {
  id: string;
  name: string;
  color: string;
}

/**
 * Scrutins : programmation, ouverture de campagne (plafond légal),
 * sondages hebdomadaires, débat d'entre-deux-tours et dépouillement.
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
        `Plafond légal des dépenses : ${cfg.legalCeiling.toLocaleString('fr-FR')} €. Vote en semaine ${election.week}.`);
    }

    if (d.week >= election.campaignStartWeek && d.week < election.week) {
      d.player.momentum = clamp(d.player.momentum * (d.player.staff.includes('directeur_campagne') ? 0.95 : 0.9));
      d.polls.push({ week: d.week, electionId: election.id, results: this.shares(d, election, rng, 2.5) });
      if (d.week === election.week - 1) {
        const latest = d.polls.at(-1)!.results;
        const rival = election.candidateIds.filter(id => id !== 'player').sort((a, b) => latest[b] - latest[a])[0];
        // Le débat décisif remplace tout autre débat programmé cette semaine
        const debate = createDebate(d, rng, 'debat_electoral', rival,
          election.type === 'primaire' ? d.party.position : undefined);
        if (debate) {
          d.debate = debate;
          pushNews(d, 'election', 'neutral', `Débat décisif face à ${debate.opponentName}`,
            'Le vote a lieu la semaine prochaine. Ce débat peut tout faire basculer.');
        }
      }
    }

    if (d.week >= election.week) this.resolve(d, election, rng);
  }

  /** Programme le prochain scrutin quand le joueur remplit les conditions d'investiture */
  private schedule(d: GameState): void {
    if (d.scenario === 'royaute') return;
    if (d.elections.some(e => !e.resolved)) return;
    const rule = RANKS[d.player.rankId].promotion;
    if (rule?.via !== 'election') return;
    if (d.week < Number(d.player.flags['nextElectionWeek'] ?? 0)) return;
    const ok = Object.entries(rule.requires).every(([k, v]) => d.player.stats[k as keyof typeof d.player.stats] >= v);
    if (!ok) return;

    const cfg = ELECTIONS[rule.election];
    const start = d.week + 1;
    const election: ScheduledElection = {
      id: nextId(d, 'elec'), type: rule.election, campaignStartWeek: start, week: start + cfg.campaignWeeks,
      candidateIds: ['player', ...this.opponents(d, rule.election)], resolved: false,
    };
    d.elections.push(election);
    pushNews(d, 'election', 'positive', `Investiture obtenue : ${cfg.label}`,
      `Votre parti vous investit. La campagne commence la semaine prochaine.`);
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

  private score(d: GameState, id: string, type: ElectionType): number {
    // Primaire : il faut coller à la ligne du parti. Ailleurs : l'électorat est au centre.
    const center = type === 'primaire' ? d.party.position : 0;
    const penalty = (pos: number) => Math.abs(pos - center) * 0.1;
    if (id === 'player') {
      const s = d.player.stats;
      const base = type === 'primaire'
        ? partySupport(d) * 0.6 + s.popularity * 0.3 + s.influence * 0.2
        : s.popularity * 0.55 + s.influence * 0.2 + s.credibility * 0.2;
      const program = type !== 'presidentielle' ? 0
        : d.program?.validated ? programReport(d).electoralBonus : -6;
      return base + d.player.momentum * 0.35 + 5 - penalty(d.player.stance) + program - (type === 'primaire' ? 0 : youngPartyMalus(d));
    }
    const npc = d.npcs.find(n => n.id === id)!;
    const notoriety = type === 'municipales' ? 8 : type === 'legislatives' ? 14 : 22;
    const npcPos = [d.party, ...d.otherParties].find(p => p.id === npc.partyId)?.position ?? 0;
    return npc.popularity * 0.55 + npc.influence * 0.25 + notoriety - penalty(npcPos);
  }

  private shares(d: GameState, e: ScheduledElection, rng: Rng, noise: number, ids = e.candidateIds): Record<string, number> {
    const raw = ids.map(id => Math.max(1, Math.pow(this.score(d, id, e.type), 2) * rng.range(1 - noise / 20, 1 + noise / 20)));
    const total = raw.reduce((a, b) => a + b, 0);
    return Object.fromEntries(ids.map((id, i) => [id, Math.round((raw[i] / total) * 1000) / 10]));
  }

  private resolve(d: GameState, e: ScheduledElection, rng: Rng): void {
    const cfg = ELECTIONS[e.type];
    const firstRound = this.shares(d, e, rng, 4);
    const ranked = Object.entries(firstRound).sort((a, b) => b[1] - a[1]);
    let winnerId = ranked[0][0];
    let secondRound: Record<string, number> | undefined;
    if (ranked[0][1] < 50 && ranked.length > 1) {
      secondRound = this.shares(d, e, rng, 4, [ranked[0][0], ranked[1][0]]);
      winnerId = Object.entries(secondRound).sort((a, b) => b[1] - a[1])[0][0];
    }

    // Dépassement du plafond : recours devant le juge électoral
    const invalidated = winnerId === 'player' && !!d.player.flags['depassement'] && rng.chance(0.4);
    if (invalidated) winnerId = ranked.find(([id]) => id !== 'player')![0];

    e.resolved = true;
    e.result = { firstRound, secondRound, winnerId };
    d.player.finances.legalCeiling = null;
    d.player.finances.campaignSpent = 0;
    d.player.momentum = 0;
    d.player.flags['depassement'] = false;

    const score = (secondRound ?? firstRound)['player'] ?? firstRound['player'];
    const rule = RANKS[d.player.rankId].promotion;
    if (winnerId === 'player' && rule) {
      applyEffects(d, [
        { kind: 'rank', rankId: rule.to }, { kind: 'stat', stat: 'influence', delta: 10 },
        { kind: 'stat', stat: 'popularity', delta: 5 }, { kind: 'stat', stat: 'politicalCapital', delta: 20 },
      ], {}, rng);
      pushNews(d, 'election', 'positive', `Victoire aux ${cfg.label.toLowerCase()} (${score} %)`,
        `Vous devenez ${RANKS[rule.to].label}.`);
      if (rule.to === 'president') {
        d.status = 'victoire';
        d.endReason = `Élu·e au second tour avec ${score} % des voix. L’Élysée vous attend.`;
      }
    } else {
      applyEffects(d, [
        { kind: 'stat', stat: 'popularity', delta: -8 }, { kind: 'stat', stat: 'influence', delta: -5 },
        { kind: 'stat', stat: 'stress', delta: 15 },
      ], {}, rng);
      d.player.flags['nextElectionWeek'] = d.week + cfg.interval;
      pushNews(d, 'election', 'negative',
        invalidated ? 'Élection annulée par le juge électoral' : `Défaite aux ${cfg.label.toLowerCase()} (${firstRound['player']} %)`,
        invalidated ? 'Vos comptes de campagne ont été rejetés. Victoire attribuée à votre adversaire.' : `Prochaine tentative possible en semaine ${d.week + cfg.interval}.`);
      if (e.type === 'presidentielle') {
        d.status = 'defaite';
        d.endReason = `Battu·e à l’élection présidentielle avec ${score} % des voix.`;
      }
    }
  }
}

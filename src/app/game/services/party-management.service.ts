import { Injectable } from '@angular/core';
import { GameState } from '../models/game.models';
import { rankOrder } from '../data/ranks';
import { createDecision } from '../data/decisions';
import { partySupport, pushNews } from '../engine/effects';
import { Rng, clamp } from '../engine/rng';
import { ofParty } from '../data/world';
import { ensurePartyFinance, settlePartyMonth } from '../engine/budget';

// ── Parti : courants, cohésion, direction ───────────────────

@Injectable({ providedIn: 'root' })
export class PartyManagementService {
  weekly(d: GameState, rng: Rng): void {
    const party = d.party;
    for (const f of party.factions) {
      f.supportForPlayer = clamp(f.supportForPlayer + (f.supportForPlayer > 40 ? -0.7 : 0.3));
      // Les courants proches de votre ligne vous soutiennent, les autres s'éloignent
      const distance = Math.abs(d.player.stance - f.position);
      f.supportForPlayer = clamp(f.supportForPlayer + Math.max(-1, Math.min(1, (25 - distance) / 25)) * 0.6);
      f.satisfaction = clamp(f.satisfaction + rng.range(-3, 3));
    }
    const avgSatisfaction = party.factions.reduce((s, f) => s + f.satisfaction, 0) / party.factions.length;
    party.cohesion = clamp(party.cohesion + (avgSatisfaction - party.cohesion) * 0.1);

    if (d.week % 5 === 0) {
      const decision = createDecision('ligne_parti', d, rng, {});
      if (decision) d.pendingDecisions.push(decision);
    }

    // Changements de direction
    const playerLeads = rankOrder(d.player.rankId) >= rankOrder('chef_parti') || !!party.founder;
    if (playerLeads && party.leaderNpcId !== 'player') {
      const former = d.npcs.find(n => n.id === party.leaderNpcId);
      if (former) {
        former.rankId = 'ministre';
        former.isRival = true;
        former.relationToPlayer = clamp(former.relationToPlayer - 30, -100, 100);
      }
      party.leaderNpcId = 'player';
      pushNews(d, 'parti', 'positive', `${d.player.name} prend la tête ${ofParty(party.name)}`);
    } else if (!playerLeads && party.leaderNpcId === 'player') {
      const successor = d.npcs
        .filter(n => n.partyId === party.id)
        .sort((a, b) => b.influence - a.influence)[0];
      party.leaderNpcId = successor.id;
      successor.rankId = 'chef_parti';
      pushNews(d, 'parti', 'negative', `${successor.name} vous succède à la tête du parti`);
    }

    // Finances du parti : prises en main et clôture mensuelle
    ensurePartyFinance(d);
    settlePartyMonth(d, rng);

    // Fronde contre le joueur s'il dirige un parti qui ne le soutient plus
    if (playerLeads && partySupport(d) < 30 && rng.chance(0.25)) {
      const decision = createDecision('defiance', d, rng, {});
      if (decision) d.pendingDecisions.push(decision);
    }
  }
}

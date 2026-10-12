import { Injectable } from '@angular/core';
import { GameState } from '../models/game.models';
import { rankOrder } from '../data/ranks';
import { createDecision } from '../data/decisions';
import { applyEffects, pushNews } from '../engine/effects';
import { Rng, clamp } from '../engine/rng';

// ── IA des rivaux ───────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class RivalAiService {
  weekly(d: GameState, rng: Rng): void {
    const playerOrder = rankOrder(d.player.rankId);
    for (const npc of d.npcs) {
      npc.popularity = clamp(npc.popularity + rng.range(-1, 1.2));
      const opposition = npc.partyId !== d.party.id;
      const active = npc.isRival || (opposition && playerOrder >= rankOrder('depute'));
      if (!active) continue;

      // Les ambitieux se méfient de qui monte trop vite à leur niveau
      if (npc.ambition > 60 && Math.abs(rankOrder(npc.rankId) - playerOrder) <= 1) {
        npc.relationToPlayer = clamp(npc.relationToPlayer - 1, -100, 100);
      }
      if (!rng.chance((npc.aggressiveness / 100) * 0.35)) continue;

      const first = npc.name.split(' ')[0];
      const roll = rng.next();
      if (npc.relationToPlayer > 40) {
        applyEffects(d, [{ kind: 'stat', stat: 'influence', delta: 2 }], {}, rng);
        pushNews(d, 'rival', 'positive', `${npc.name} vous soutient publiquement`);
      } else if (npc.relationToPlayer < -20 && npc.traits.includes('sulfureux') && roll < 0.35) {
        d.player.scandalExposure = clamp(d.player.scandalExposure + 7);
        pushNews(d, 'rival', 'negative', 'Rumeurs savamment distillées',
          `L’entourage de ${npc.name} fait circuler des bruits sur vos finances.`);
      } else if (npc.relationToPlayer < 0 && roll < 0.6) {
        if (rng.chance(0.5)) {
          const decision = createDecision('attaque_rival', d, rng, { targetId: npc.id });
          if (decision) d.pendingDecisions.push(decision);
        } else {
          d.player.stats.popularity = clamp(d.player.stats.popularity - 2);
          pushNews(d, 'rival', 'negative', `${first} vous égratigne`, `${npc.name} ironise sur vos ambitions. Popularité −2.`);
        }
      } else {
        npc.influence = clamp(npc.influence + 2);
        npc.popularity = clamp(npc.popularity + 2);
        pushNews(d, 'rival', 'neutral', `${npc.name} occupe le terrain`, 'Tournée médiatique remarquée.');
      }
    }
  }
}

import { Injectable } from '@angular/core';
import { GameState } from '../models/game.models';
import { createDecision } from '../data/decisions';
import { Rng } from '../engine/rng';

// ── Réseau : confiance et renvois d'ascenseur ───────────────

@Injectable({ providedIn: 'root' })
export class NetworkService {
  weekly(d: GameState, rng: Rng): void {
    for (const c of d.contacts) {
      if (c.trust > 20) c.trust -= 1;
      if (c.balance < 0 && rng.chance(0.25)) {
        const decision = createDecision('renvoi_ascenseur', d, rng, { targetId: c.id });
        if (decision) d.pendingDecisions.push(decision);
      }
    }
  }
}

import { Injectable } from '@angular/core';
import { DOMAINS, DOMAIN_LABELS, GameState } from '../models/game.models';
import { rankOrder } from '../data/ranks';
import { createDecision } from '../data/decisions';
import { applyEffects, pushNews } from '../engine/effects';
import { rollRandomEvents } from '../data/random-events';
import { Rng, clamp } from '../engine/rng';

// ── Médias : agenda, invitations, scandales ─────────────────

@Injectable({ providedIn: 'root' })
export class MediaService {
  weekly(d: GameState, rng: Rng): void {
    // Crises nationales : verrouillent l'agenda deux mois
    if (d.week >= 3 && d.week > d.agendaLockedUntil && rng.chance(0.08)) {
      const crisis = createDecision('crise', d, rng, {});
      if (crisis) {
        d.pendingDecisions.push(crisis);
        d.agendaDomain = crisis.domain!;
        d.agendaLockedUntil = d.week + 2;
        pushNews(d, 'actu', 'negative', crisis.title, crisis.context);
      }
    }

    if (d.week > d.agendaLockedUntil && rng.chance(0.4)) {
      d.agendaDomain = rng.pick(DOMAINS);
      pushNews(d, 'actu', 'neutral', `L’actualité se focalise sur : ${DOMAIN_LABELS[d.agendaDomain]}`,
        'Les plateaux et les débats tourneront autour de ce thème.');
    }

    // Invitations spontanées, plus fréquentes avec la notoriété
    const order = rankOrder(d.player.rankId);
    if (order >= 1 && !d.pendingDecisions.some(x => x.tag === 'interview') && rng.chance(0.06 + order * 0.04)) {
      const decision = createDecision('interview', d, rng, {});
      if (decision) {
        decision.title = 'Invitation surprise en matinale';
        d.pendingDecisions.push(decision);
      }
    }

    // Affaires illégales : le parquet financier finit par s'y intéresser
    const illegal = Number(d.player.flags['illegal'] ?? 0);
    if (illegal > 0 && d.player.scandalExposure > 30 && rng.chance(0.06 + illegal * 0.04 + d.player.scandalExposure / 500)) {
      const decision = createDecision('enquete', d, rng, {});
      if (decision) d.pendingDecisions.push(decision);
    }

    // Bouleversements : un dossier maîtrisé peut devenir obsolète du jour au lendemain
    const top = Math.max(...Object.values(d.player.dossiers).map(x => x.mastery));
    if (d.week > 2 && top >= 50 && rng.chance(0.05 + (top - 50) / 400)) {
      const decision = createDecision('bouleversement', d, rng, {});
      if (decision) d.pendingDecisions.push(decision);
    }

    // Événements aléatoires : vie privée, médias, coulisses
    const random = rollRandomEvents(d, rng);
    if (random.decision) d.pendingDecisions.push(random.decision);
    if (random.news) {
      applyEffects(d, random.news.effects, {}, rng);
      pushNews(d, 'actu', random.news.tone, random.news.title, random.news.body);
    }

    // Fuites : plus l'exposition est forte, plus le risque de scandale grimpe
    const exposure = d.player.scandalExposure;
    if (exposure > 10 && rng.chance(exposure / 220)) {
      const decision = createDecision('scandale', d, rng, {});
      if (decision) d.pendingDecisions.push(decision);
    }
    d.player.scandalExposure = clamp(exposure - (d.player.staff.includes('spin_doctor') ? 3 : 1.5));
  }
}

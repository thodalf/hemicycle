import { Injectable, computed, inject } from '@angular/core';
import { DOMAINS, DOMAIN_LABELS, Domain, GameState, StatKey } from '../models/game.models';
import { RANKS } from '../data/ranks';
import { createDecision } from '../data/decisions';
import { countTrait, fireRecruit, payroll, weeklyTraits } from '../engine/recruits';
import { availableFunds, spend, partySupport, pushNews } from '../engine/effects';
import { Rng, clamp } from '../engine/rng';
import { weeklyNationalBudget } from '../engine/budget';
import { weeklyBankruptcy } from '../engine/bankruptcy';
import { assetAp, dossierDecayFactor, weeklyAssets } from '../engine/patrimoine';
import { monthlyLoans } from '../engine/loans';
import { monthlyLeaderPay, monthlySavings, partyLeaderPay, trackMinisterialExit } from '../engine/remuneration';
import { monthlySide } from '../engine/side-income';
import { monthlyTeam } from '../engine/team-pay';
import { civilActive, monthlyCivil } from '../engine/civil';
import { staffMonthly, staffAp } from '../engine/staff-perks';
import { GameStateService } from './game-state.service';

// ── Carrière, énergie, revenus, compétences ─────────────────

export interface RequirementProgress {
  label: string;
  current: number;
  target: number;
  met: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProgressionService {
  private readonly game = inject(GameStateService);

  /** Prochain palier et état d'avancement des conditions */
  readonly nextStep = computed(() => {
    const s = this.game.s();
    const rule = RANKS[s.player.rankId].promotion;
    if (!rule || s.scenario === 'royaute') return null;
    const reqs: RequirementProgress[] = (Object.entries(rule.requires) as [StatKey, number][]).map(([k, v]) => ({
      label: ({ popularity: 'Popularité', influence: 'Influence', credibility: 'Crédibilité' } as Record<string, string>)[k] ?? k,
      current: Math.round(s.player.stats[k]), target: v, met: s.player.stats[k] >= v,
    }));
    if (rule.via === 'nomination') {
      const sup = Math.round(partySupport(s));
      reqs.push({ label: 'Soutien du parti', current: sup, target: rule.minPartySupport, met: sup >= rule.minPartySupport });
    }
    return {
      to: RANKS[rule.to],
      via: rule.via === 'election' ? `Élection : ${rule.election}` : rule.occasion,
      requirements: reqs,
      ready: reqs.every(r => r.met),
    };
  });

  upgradeSkill(domain: Domain): void {
    this.game.mutate(d => {
      if (d.player.skillPoints < 1 || d.player.skills[domain] >= 5) return;
      d.player.skillPoints -= 1;
      d.player.skills[domain] += 1;
      d.player.stats.credibility = clamp(d.player.stats.credibility + 1);
      pushNews(d, 'systeme', 'positive', `Compétence ${DOMAIN_LABELS[domain]} niveau ${d.player.skills[domain]}`);
    });
  }

  weekly(d: GameState, rng: Rng): void {
    const p = d.player;
    const rank = RANKS[p.rankId];

    // Revenus du mois (part épargnée), salaires de l'équipe, mensualités des prêts
    trackMinisterialExit(d);
    p.finances.personal += monthlySavings(d);
    // Le parti paie son chef ou sa cheffe
    const leadPay = partyLeaderPay(d);
    if (leadPay && d.partyFinance) d.partyFinance.treasury -= leadPay / 1000;
    monthlyCivil(d);
    monthlySide(d, rng);
    monthlyTeam(d, rng);
    monthlyLeaderPay(d);
    const salaries = payroll(d);
    if (salaries) {
      spend(d, salaries);
      if (availableFunds(d) < 0 && p.team.length) {
        const leaving = [...p.team].sort((a, b) => b.salary - a.salary)[0];
        fireRecruit(d, leaving.id);
        pushNews(d, 'systeme', 'negative', `${leaving.name} démissionne`, 'Faute de salaire versé, votre collaborateur·rice s’en va.');
      }
    }
    monthlyLoans(d, rng);
    weeklyTraits(d, rng);
    staffMonthly(d, rng);
    weeklyAssets(d, rng);
    weeklyBankruptcy(d, rng);

    // Énergie, stress, burn-out
    const s = p.stats;
    const pressure = p.rankId === 'ancien_president' ? 1 : rank.order;
    s.stress = clamp(s.stress - 5 + pressure * 1.5 + (s.energy < 25 ? 6 : 0) + d.pendingDecisions.length * 2);
    s.energy = clamp(s.energy + 14 - s.stress / 10);
    const burnout = s.stress >= 95;
    if (burnout) {
      s.stress = 60;
      s.popularity = clamp(s.popularity - 3);
      pushNews(d, 'systeme', 'negative', 'Burn-out', 'Vous annulez tous vos rendez-vous. Ce mois-ci, vos points d’action sont divisés par deux.');
    }
    const bonus = Number(p.flags['bonusAp'] ?? 0) + (p.staff.includes('directeur_campagne') && p.finances.legalCeiling !== null ? 1 : 0)
      + countTrait(d, 'bourreau') + assetAp(d) + staffAp(d) - (civilActive(d) ? 1 : 0);
    p.flags['bonusAp'] = 0;
    p.actionPoints.max = rank.monthlyActionPoints + bonus;
    p.actionPoints.current = burnout ? Math.ceil(p.actionPoints.max / 2) : p.actionPoints.max;

    // Usure : la notoriété s'érode si on ne l'entretient pas
    s.popularity = clamp(s.popularity - Math.max(0, (s.popularity - 25) * 0.04));
    s.influence = clamp(s.influence - Math.max(0, (s.influence - 25) * 0.03));
    s.credibility = clamp(s.credibility - Math.max(0, (s.credibility - 40) * 0.02));

    // Capital politique
    s.politicalCapital = clamp(s.politicalCapital + 2 + rank.order);

    // Érosion des dossiers non travaillés (atténuée par les compétences)
    const decay = dossierDecayFactor(d);
    for (const domain of DOMAINS) {
      const dossier = p.dossiers[domain];
      // Au-delà de 50, l'expertise s'émousse vite si on ne l'entretient pas
      const idle = dossier.lastStudiedWeek === null ? 99 : d.week - dossier.lastStudiedWeek;
      if (idle > 2) {
        const base = Math.max(0, 1.5 - 0.3 * p.skills[domain]) + Math.max(0, dossier.mastery - 50) * 0.05;
        dossier.mastery = clamp(dossier.mastery - base * (p.staff.includes('conseiller') ? 0.5 : 1) * decay);
      }
    }
    if (d.week % 4 === 0) p.skillPoints += 1;

    // Nominations (remaniement, congrès)
    const rule = rank.promotion;
    const lastOffer = Number(p.flags['lastOffer'] ?? -99);
    if (rule?.via === 'nomination' && d.week - lastOffer >= 4) {
      const met = (Object.entries(rule.requires) as [StatKey, number][]).every(([k, v]) => s[k] >= v)
        && partySupport(d) >= rule.minPartySupport;
      if (met && rng.chance(0.35)) {
        const decision = createDecision(rule.to === 'ministre' ? 'remaniement' : 'congres', d, rng, {});
        if (decision) {
          d.pendingDecisions.push(decision);
          p.flags['lastOffer'] = d.week;
        }
      }
    }

    // Loi de finances quand on est au gouvernement
    weeklyNationalBudget(d);

    // Conditions de défaite
    // Revers (devient un chapitre : la partie continue, en repartant de plus bas)
    if (d.week > 6 && s.popularity <= 2 && s.credibility <= 5 && d.week >= Number(p.flags['desert'] ?? 0)) {
      d.status = 'defaite';
      d.endTitle = 'Traversée du désert';
      d.endReason = 'Plus personne ne vous écoute. Vous disparaissez des écrans… pour un temps.';
    }
  }
}

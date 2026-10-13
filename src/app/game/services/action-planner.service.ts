import { Injectable, computed, inject, signal } from '@angular/core';
import { inMonth } from '../engine/calendar';
import { boostMedia } from '../engine/staff-perks';
import { queueMinigame } from '../engine/minigame';
import { leadsWar, warPowerBlock } from '../engine/war';
import { STAFF_BY_ROLE } from '../data/staff';
import {
  ActionCategory, ActionDefinition, Domain, GameState, Payer, PlannedAction,
} from '../models/game.models';
import { ACTIONS, ACTIONS_BY_ID } from '../data/actions';
import { rankOrder } from '../data/ranks';
import {
  applyEffects, availableFunds, partyCapitalCost, partyEnvelope, pushNews, rollRisk, scaleGains, spend, spendParty, wearFactor,
} from '../engine/effects';
import { owns } from '../engine/patrimoine';
import { intlPower, intlRelevant } from '../engine/intl';
import { reservedAp } from '../engine/projects';
import { ASSETS_BY_ID } from '../data/assets';
import { Rng } from '../engine/rng';
import { recordObjectiveEvent } from '../engine/objectives';
import { GameStateService } from './game-state.service';

export interface Availability {
  ok: boolean;
  reason?: string;
}

/** Catégories dont le parti ne paiera jamais les dépenses */
const PERSONAL_CATEGORIES: ActionCategory[] = ['argent', 'redaction', 'infiltration', 'couronne', 'loge', 'repos'];

export function partyFundable(a: ActionDefinition): boolean {
  return !!a.cost.money && !a.personalOnly && !PERSONAL_CATEGORIES.includes(a.category);
}

/**
 * Planification du mois : le joueur empile des actions (budget de PA,
 * énergie, argent, capital politique), puis TurnService les exécute toutes
 * en fin de mois.
 */
@Injectable({ providedIn: 'root' })
export class ActionPlannerService {
  private readonly game = inject(GameStateService);
  private readonly _plan = signal<PlannedAction[]>([]);
  private seq = 0;

  readonly plan = this._plan.asReadonly();

  readonly spent = computed(() => {
    const s = this.game.s();
    const totals = { ap: 0, energy: 0, money: 0, partyMoney: 0, politicalCapital: 0 };
    for (const p of this._plan()) {
      const a = ACTIONS_BY_ID.get(p.actionId)!;
      totals.ap += a.cost.ap;
      totals.energy += a.cost.energy ?? 0;
      totals.politicalCapital += a.cost.politicalCapital ?? 0;
      if (p.payer === 'parti') {
        totals.partyMoney += a.cost.money ?? 0;
        totals.politicalCapital += partyCapitalCost(s, a.cost.money ?? 0);
      } else {
        totals.money += a.cost.money ?? 0;
      }
    }
    return totals;
  });

  /** Enveloppe que le parti accepte de régler ce mois-ci */
  readonly envelope = computed(() => partyEnvelope(this.game.s()));
  readonly envelopeLeft = computed(() => this.envelope() - this.spent().partyMoney);
  /** Vous dirigez le parti : c'est la trésorerie qui paie, sans capital politique */
  readonly leaderPays = computed(() => partyCapitalCost(this.game.s(), 1000) === 0);

  /** Points d'action réservés par le projet au long cours */
  readonly reserved = computed(() => reservedAp(this.game.s()));
  readonly apLeft = computed(() => Math.max(0, this.game.player().actionPoints.current - this.reserved()) - this.spent().ap);

  /** Actions débloquées au rang courant */
  /**
   * Couronne et Loge n'apparaissent qu'une fois débloquées : par le scénario, ou dans une partie normale
   * par un événement aléatoire (émissaire du prétendant, parrainage en loge…).
   */
  private readonly inScenario = computed(() => {
    const s = this.game.s();
    return ACTIONS.filter(a => {
      if (a.category === 'couronne') return !!s.crown;
      if (a.category === 'loge') return !!s.lodge;
      if (a.category === 'redaction') return !!s.press;
      if (a.category === 'infiltration') return !!s.mole;
      if (a.category === 'elysee') return !!s.presidency;
      if (a.category === 'international' && !intlRelevant(s)) return false;
      if (a.category === 'international' && rankOrder(a.minRank) >= rankOrder('ministre') && rankOrder(s.player.rankId) >= rankOrder('ministre') && !intlPower(s)) return false;
      if (a.onlyRanks && !a.onlyRanks.includes(s.player.rankId)) return false;
      return true;
    });
  });

  readonly unlocked = computed(() => {
    const order = rankOrder(this.game.player().rankId);
    return this.inScenario().filter(a => rankOrder(a.minRank) <= order);
  });

  /** Prochaines actions verrouillées : motive la progression */
  readonly locked = computed(() => {
    const order = rankOrder(this.game.player().rankId);
    return this.inScenario().filter(a => rankOrder(a.minRank) > order);
  });

  availability(action: ActionDefinition, targetId?: string, payer: Payer = 'perso'): Availability {
    const s = this.game.s();
    const spent = this.spent();
    const { cost } = action;
    if (rankOrder(action.minRank) > rankOrder(s.player.rankId)) return { ok: false, reason: 'Rang insuffisant' };
    if ((s.cooldowns[action.id] ?? 0) > s.week) return { ok: false, reason: `De nouveau possible ${inMonth(s.cooldowns[action.id])}` };
    const req = action.requires;
    if (req) {
      const c = s.crown;
      if (req.soutien !== undefined && (c?.soutien ?? 0) < req.soutien) return { ok: false, reason: `Soutien < ${req.soutien} %` };
      if (req.legitimite !== undefined && (c?.legitimite ?? 0) < req.legitimite) return { ok: false, reason: `Légitimité < ${req.legitimite}` };
      if (req.armee !== undefined && (c?.armee ?? 0) < req.armee) return { ok: false, reason: `Armée < ${req.armee}` };
      if (req.grade !== undefined && (s.lodge?.grade ?? -1) < req.grade) return { ok: false, reason: 'Grade insuffisant' };
      if (req.moleDelivered !== undefined && (s.mole?.delivered ?? 0) < req.moleDelivered) return { ok: false, reason: `Transmettez d’abord ${req.moleDelivered} renseignements` };
      if (req.pressGrade !== undefined && (s.press?.grade ?? -1) < req.pressGrade) return { ok: false, reason: 'Poste insuffisant à la rédaction' };
      if (req.crisis && !s.intl.crisis) return { ok: false, reason: 'Aucune crise internationale en cours' };
      if (req.declared && !s.presidential.declared) return { ok: false, reason: 'Déclarez d’abord votre candidature' };
      if (req.maxHealth !== undefined && s.player.health > req.maxHealth) return { ok: false, reason: 'Inutile : votre santé est bonne' };
      if (req.minAge !== undefined && s.player.age < req.minAge) return { ok: false, reason: `À partir de ${req.minAge} ans` };
      if (req.war && !s.war) return { ok: false, reason: 'Le pays n’est pas en guerre' };
      if (req.war && !leadsWar(s)) return { ok: false, reason: 'Le président, le Premier ministre et les ministres régaliens conduisent la guerre' };
      if (req.peace && s.war) return { ok: false, reason: 'Le pays est déjà en guerre' };
      if (req.warPower) { const why = warPowerBlock(s); if (why) return { ok: false, reason: why }; }
      if (req.staff && !s.player.staff.includes(req.staff)) return { ok: false, reason: `Il faut un·e ${STAFF_BY_ROLE.get(req.staff)?.title.toLowerCase()} dans l’équipe` };
      if (req.asset && !owns(s, req.asset)) {
        return { ok: false, reason: `Nécessite : ${req.asset.map(id => ASSETS_BY_ID.get(id)?.label).join(' ou ')}` };
      }
    }
    const count = this._plan().filter(p => p.actionId === action.id).length;
    if (action.maxPerMonth && count >= action.maxPerMonth) return { ok: false, reason: 'Limite mensuelle' };
    if (action.cooldown && count >= 1) return { ok: false, reason: 'Une fois par mois' };
    if (this.apLeft() < cost.ap) return { ok: false, reason: 'Points d’action insuffisants' };
    if ((cost.energy ?? 0) + spent.energy > s.player.stats.energy) return { ok: false, reason: 'Trop épuisé·e' };
    const party = payer === 'parti';
    if (party) {
      if (!partyFundable(action)) return { ok: false, reason: 'Le parti ne paie pas ça' };
      if ((cost.money ?? 0) > this.envelopeLeft()) return { ok: false, reason: 'Enveloppe du parti épuisée' };
    } else if ((cost.money ?? 0) + spent.money > availableFunds(s)) return { ok: false, reason: 'Fonds insuffisants' };
    const f = s.player.finances;
    if (cost.money && f.legalCeiling !== null && s.player.staff.includes('tresorier')
        && f.campaignSpent + spent.money + spent.partyMoney + cost.money > f.legalCeiling) {
      return { ok: false, reason: 'Plafond légal (trésorier)' };
    }
    const extraCapital = party ? partyCapitalCost(s, cost.money ?? 0) : 0;
    if ((cost.politicalCapital ?? 0) + extraCapital + spent.politicalCapital > s.player.stats.politicalCapital) {
      return { ok: false, reason: 'Capital politique insuffisant' };
    }
    if (action.target === 'contact' && targetId && action.targetCondition?.minTrust !== undefined) {
      const c = s.contacts.find(x => x.id === targetId);
      if (c && c.trust < action.targetCondition.minTrust) return { ok: false, reason: `Confiance < ${action.targetCondition.minTrust}` };
    }
    return { ok: true };
  }

  add(actionId: string, target?: { domain?: Domain; targetId?: string }, payer: Payer = 'perso'): boolean {
    const action = ACTIONS_BY_ID.get(actionId);
    if (!action || !this.availability(action, target?.targetId, payer).ok) return false;
    if (action.target && !target?.domain && !target?.targetId) return false;
    this._plan.update(p => [...p, { uid: `plan-${++this.seq}`, actionId, ...target, ...(payer === 'parti' ? { payer } : {}) }]);
    return true;
  }

  remove(uid: string): void {
    this._plan.update(p => p.filter(x => x.uid !== uid));
  }

  clear(): void {
    this._plan.set([]);
  }

  /** Appelé par TurnService à l'intérieur de la transaction de fin de mois */
  execute(d: GameState, rng: Rng): void {
    for (const planned of this._plan()) {
      const action = ACTIONS_BY_ID.get(planned.actionId)!;
      const ctx = { domain: planned.domain, targetId: planned.targetId };
      const { cost } = action;

      d.player.actionPoints.current -= cost.ap;
      d.player.stats.energy = Math.max(0, d.player.stats.energy - (cost.energy ?? 0));
      d.player.stats.stress = Math.min(100, d.player.stats.stress + (cost.energy ?? 0) / 3);
      d.player.stats.politicalCapital = Math.max(0, d.player.stats.politicalCapital - (cost.politicalCapital ?? 0));
      if (planned.payer === 'parti') spendParty(d, cost.money ?? 0);
      else spend(d, cost.money ?? 0);
      if (action.cooldown) d.cooldowns[action.id] = d.week + action.cooldown;

      recordObjectiveEvent(d, 'category', action.category);
      const lastUse = Number(d.player.flags[`last_${action.id}`] ?? -99);
      const prevStreak = d.week - lastUse <= 1 ? Number(d.player.flags[`streak_${action.id}`] ?? 0) : -1;
      const record = () => { d.player.flags[`streak_${action.id}`] = prevStreak + 1; d.player.flags[`last_${action.id}`] = d.week; };
      // L'as des réseaux sociaux (ou le community manager) divise par deux le risque de bad buzz
      const social = ['post_reseaux', 'live_reseaux', 'clash_reseaux'].includes(action.id)
        && (d.player.team.some(r => r.traits.includes('reseaux_sociaux')) || d.player.staff.includes('community_manager'));
      const risk = social && action.risk ? { ...action.risk, baseChance: action.risk.baseChance / 2 } : action.risk;
      if (rollRisk(d, risk, ctx, rng)) {
        const summary = applyEffects(d, action.risk!.onFailure, ctx, rng);
        pushNews(d, 'action', 'negative', `${action.label} : raté`, [action.risk!.failureNews, summary.join(' · ')].filter(Boolean).join(' — '));
      } else {
        // Lassitude : les gains s'émoussent si l'on répète la même action
        const wear = wearFactor(d, action.id);
        const effects = action.category === 'medias' ? boostMedia(d, action.effects) : action.effects;
        // Mini-jeu : les gains attendent le résultat (joué avant la fin du mois suivant)
        if (action.minigame && queueMinigame(d, action.minigame, action.label, scaleGains(effects, wear), ctx).length) {
          pushNews(d, 'action', 'neutral', action.label, 'À vous de jouer : mini-jeu en attente.');
          record();
          continue;
        }
        const summary = applyEffects(d, scaleGains(effects, wear), ctx, rng);
        if (wear < 1) summary.push(`lassitude −${Math.round((1 - wear) * 100)} %`);
        if (summary.length) pushNews(d, 'action', 'positive', action.label, summary.join(' · '));
      }
      record();
    }
    this.clear();
  }
}

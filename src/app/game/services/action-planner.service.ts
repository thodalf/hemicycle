import { COMBOS, combosOf, drawHand, inHand, liteFromPlan, occasionOf, redrawCost } from '../engine/agenda';
import { costOf, masteryFactor, saturation } from '../engine/difficulty';
import { sagaRunning } from '../engine/saga';
import { natCrisis } from '../data/national-crises';
import { onAction } from '../engine/character';
import { RENOWN_TIERS, renownTier } from '../data/lifestyles';
import { rankAllowed } from '../data/ranks';
import { actionSegments } from '../engine/country';
import { actionImage } from '../engine/legacy';
import { canAppoint } from '../engine/cabinet';
import { dailyPlayed } from '../engine/daily';
import { MINIGAMES_BY_ID } from '../data/minigames';
import { Injectable, computed, inject, signal } from '@angular/core';
import { inMonth } from '../engine/calendar';
import { ALIEN_PHASES } from '../engine/alien';
import { boostMedia } from '../engine/staff-perks';
import { queueMinigame } from '../engine/minigame';
import { leadsWar, warPowerBlock } from '../engine/war';
import { civilActive } from '../engine/civil';
import { inSecondRound } from '../engine/entre-deux-tours';
import { canAnoint } from '../engine/family';
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
import { checkCharte } from '../engine/grand';
import { hiddenForOffice } from '../engine/office';
import { rollTier, tierEffects, tierStory } from '../engine/outcomes';
import { GREAT_INFO_BY_ID, decisionActive } from '../data/great-decisions';
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
/** Catégories sans saturation : se reposer, se soigner, gérer son argent */
/** Les actions présentes dans la partie (scénarios, fonctions, crises…), avant le filtre de rang */
export function actionsInScenario(s: GameState) {
  return ACTIONS.filter(a => {
      if (a.category === 'couronne') return s.kingdom ? !!a.requires?.kingdom : (!!s.crown && !a.requires?.kingdom);
      if (a.category === 'loge') return !!s.lodge;
      if (a.category === 'lutte') return !!s.struggle && (!a.requires?.struggle || a.requires.struggle === s.struggle.id);
      if (a.category === 'eclat') return renownTier(s.player.renown ?? 0) >= (a.requires?.renownTier ?? 1);
      if (hiddenForOffice(s, a)) return false;
      if (a.requires?.decision && !decisionActive(s, a.requires.decision)) return false;
      if (a.category === 'redaction') return !!s.press;
      if (a.category === 'infiltration') return !!s.mole;
      if (a.category === 'contact') return !!s.alien;
      if (a.category === 'elysee') return !!s.presidency;
      if (a.category === 'arriere') return !!s.war;
      if (a.category === 'securite') return !!s.plot;
      if (a.category === 'zombie') return !!s.zombie;
      if (a.category === 'apocalypse') return !!s.apocalypse && s.apocalypse.phase < 4;
      if (a.category === 'saga') return sagaRunning(s) && s.saga!.id === a.requires?.saga;
      if (a.requires?.arc && !s.crises?.[a.requires.arc]) return false;
      if (a.partyOnly && s.party.leaderNpcId !== 'player') return false;
      if (a.category === 'crise') return a.requires?.natCrisis ? natCrisis(s) === a.requires.natCrisis : Object.values(s.crises ?? {}).some(Boolean);
      if (a.category === 'administration') return civilActive(s);
      if (a.category === 'international' && !intlRelevant(s)) return false;
      if (a.category === 'international' && rankOrder(a.minRank) >= rankOrder('ministre') && rankOrder(s.player.rankId) >= rankOrder('ministre') && !intlPower(s)) return false;
      if (a.onlyRanks && !rankAllowed(a.onlyRanks, s.player.rankId)) return false;
      if (a.requires?.portfolio && (s.player.rankId !== 'ministre' || s.portfolio !== a.requires.portfolio)) return false;
      return true;
  });
}

/** Les actions débloquées pour l'état donné (rang compris) */
export function unlockedFor(s: GameState) {
  const order = rankOrder(s.player.rankId);
  return actionsInScenario(s).filter(a => rankOrder(a.minRank) <= order);
}

const FLAT_CATEGORIES = new Set(['repos', 'sante', 'argent']);

@Injectable({ providedIn: 'root' })
export class ActionPlannerService {
  private readonly game = inject(GameStateService);
  private readonly _plan = signal<PlannedAction[]>([]);
  private seq = 0;

  readonly plan = this._plan.asReadonly();

  readonly spent = computed(() => {
    const s = this.game.s();
    const totals = { ap: 0, energy: 0, money: 0, partyMoney: 0, politicalCapital: 0 };
    const seen: Record<string, number> = {};
    for (const p of this._plan()) {
      const a = ACTIONS_BY_ID.get(p.actionId)!;
      const c = costOf(s, a, seen[a.id] ?? 0);
      seen[a.id] = (seen[a.id] ?? 0) + 1;
      totals.ap += c.ap;
      totals.energy += c.energy ?? 0;
      totals.politicalCapital += c.politicalCapital ?? 0;
      if (p.payer === 'parti' || a.partyOnly) {
        totals.partyMoney += c.money ?? 0;
        totals.politicalCapital += partyCapitalCost(s, c.money ?? 0);
      } else {
        totals.money += c.money ?? 0;
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
  private readonly inScenario = computed(() => actionsInScenario(this.game.s()));

  readonly unlocked = computed(() => {
    const order = rankOrder(this.game.player().rankId);
    return this.inScenario().filter(a => rankOrder(a.minRank) <= order);
  });

  /** Ce qu'on peut jouer ce mois-ci : la main du mois, les occasions, et les catégories toujours ouvertes */
  readonly offered = computed(() => { const s = this.game.s(); return this.unlocked().filter(a => inHand(s, a)); });
  /** Les occasions du mois (actions débloquées seulement) */
  readonly occasions = computed(() => { const s = this.game.s(); const h = s.agendaHand; return h && h.week === s.week ? h.occasions.filter(o => this.unlocked().some(a => a.id === o.actionId)) : []; });
  /** Les combos : avancement selon le plan du mois */
  readonly combos = computed(() => {
    const lite = liteFromPlan(this.game.s(), this._plan());
    return COMBOS.map(c => ({ c, ...c.check(lite) }));
  });

  /** Redistribuer la main du mois (une fois) */
  redraw(): boolean {
    let ok = false;
    this.game.mutate((d, rng) => {
      const h = d.agendaHand;
      const cost = redrawCost(d);
      if (!h || h.week !== d.week || h.redraws >= 1 || d.player.stats.politicalCapital < cost) return;
      d.player.stats.politicalCapital -= cost;
      d.agendaHand = drawHand(d, unlockedFor(d), rng, true);
      ok = true;
    });
    if (ok) this._plan.update(p => p.filter(x => { const a = ACTIONS_BY_ID.get(x.actionId); return !a || inHand(this.game.s(), a); }));
    return ok;
  }

  /** Prochaines actions verrouillées : motive la progression */
  readonly locked = computed(() => {
    const order = rankOrder(this.game.player().rankId);
    return this.inScenario().filter(a => rankOrder(a.minRank) > order);
  });

  /** Combien de fois cette action est déjà prévue ce mois-ci */
  repeats(actionId: string): number {
    return this._plan().filter(p => p.actionId === actionId).length;
  }

  /** Le temps d'une action prévue (sa place dans le plan compte : la répéter coûte plus cher) */
  plannedAp(uid: string): number {
    const s = this.game.s();
    const plan = this._plan();
    const i = plan.findIndex(p => p.uid === uid);
    if (i < 0) return 0;
    const a = ACTIONS_BY_ID.get(plan[i].actionId);
    if (!a) return 0;
    return costOf(s, a, plan.slice(0, i).filter(p => p.actionId === a.id).length).ap;
  }

  availability(action: ActionDefinition, targetId?: string, payer: Payer = 'perso'): Availability {
    const s = this.game.s();
    const spent = this.spent();
    const cost = costOf(s, action, this.repeats(action.id));
    if (rankOrder(action.minRank) > rankOrder(s.player.rankId)) return { ok: false, reason: 'Rang insuffisant' };
    if (!inHand(s, action)) return { ok: false, reason: 'Pas dans la main du mois' };
    if ((s.cooldowns[action.id] ?? 0) > s.week) return { ok: false, reason: `De nouveau possible ${inMonth(s.cooldowns[action.id])}` };
    if (action.minigame && MINIGAMES_BY_ID.get(action.minigame)?.daily && dailyPlayed()) return { ok: false, reason: 'Déjà joué aujourd’hui : nouveau mot demain' };
    // Monarchie d'apparat : le gouvernement décide sans le souverain
    if (action.category === 'elysee' && s.kingdom && (s.kingdom.regime ?? 0) <= -60) return { ok: false, reason: 'Monarchie d’apparat : le gouvernement décide sans vous' };
    // Un grand chantier ne se bâtit qu'une fois par règne
    if (s.kingdom && action.effects.some(e => e.kind === 'kingdom' && e.chantier && e.chantier !== 'stop' && (s.kingdom!.legacy ?? []).includes(e.chantier))) return { ok: false, reason: 'Déjà bâti sous votre règne' };
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
      if (req.alienPhase !== undefined && (s.alien?.phase ?? -1) < req.alienPhase) return { ok: false, reason: `À partir de la phase « ${ALIEN_PHASES[req.alienPhase]} »` };
      if (req.war && !s.war) return { ok: false, reason: 'Le pays n’est pas en guerre' };
      if (req.war && !leadsWar(s)) return { ok: false, reason: 'Le président, le Premier ministre et les ministres régaliens conduisent la guerre' };
      if (req.peace && s.war) return { ok: false, reason: 'Le pays est déjà en guerre' };
      if (req.homeFront && !s.war) return { ok: false, reason: 'Le pays n’est pas en guerre' };
      if (req.noGovernment && ['ministre', 'premier_ministre', 'president'].includes(s.player.rankId)) return { ok: false, reason: 'Incompatible avec une fonction gouvernementale' };
      if (req.minFunds && s.player.finances.personal < req.minFunds) return { ok: false, reason: `Il faut au moins ${req.minFunds.toLocaleString('fr-FR')} € d’épargne` };
      if (req.placement !== undefined && Number(s.player.flags['placement'] ?? 0) === req.placement) return { ok: false, reason: req.placement === 0 ? 'Rien n’est placé' : 'Déjà fait' };
      if (req.schemes && !(s.schemes ?? []).length) return { ok: false, reason: 'Aucun complot en cours' };
      if (req.heir) { const why = canAnoint(s); if (why) return { ok: false, reason: why }; }
      if (req.appoint) { const why = canAppoint(s); if (why) return { ok: false, reason: why }; }
      if (req.coalition && !s.coalition) return { ok: false, reason: 'Aucune coalition en cours' };
      if (req.kingdom && !s.kingdom) return { ok: false, reason: 'Réservé au souverain' };
      if (req.regimeMin !== undefined && (s.kingdom?.regime ?? 0) < req.regimeMin) return { ok: false, reason: `Il faut un régime plus absolu (${req.regimeMin} et plus)` };
      if (req.regimeMax !== undefined && (s.kingdom?.regime ?? 0) > req.regimeMax) return { ok: false, reason: `Il faut un régime plus parlementaire (${req.regimeMax} et moins)` };
      if (req.chantier && !s.kingdom?.chantier) return { ok: false, reason: 'Aucun grand chantier en cours' };
      if (req.noChantier && s.kingdom?.chantier) return { ok: false, reason: 'Un grand chantier est déjà en cours' };
      if (req.chantierId && s.kingdom?.chantier?.id !== req.chantierId) return { ok: false, reason: 'Seulement pendant ce grand chantier' };
      if (req.campaign && !s.elections.some(e => !e.resolved && e.type === req.campaign && s.week >= e.campaignStartWeek)) return { ok: false, reason: 'Seulement pendant la campagne' };
      if (req.sagaPhase && !(s.saga && req.sagaPhase.includes(s.saga.phase))) return { ok: false, reason: 'Pas à ce stade de la saga' };
      if (req.natCrisis && natCrisis(s) !== req.natCrisis) return { ok: false, reason: 'La crise est passée' };
      if (req.partyLeader && (s.party.leaderNpcId !== 'player' || !s.partyFinance)) return { ok: false, reason: 'Réservé à la direction du parti' };
      if (req.treasury !== undefined && (s.partyFinance?.treasury ?? 0) < req.treasury) return { ok: false, reason: `Trésorerie du parti sous ${req.treasury} k€` };
      if (req.renownTier && renownTier(s.player.renown ?? 0) < req.renownTier) return { ok: false, reason: `Il faut être ${RENOWN_TIERS[req.renownTier].label.toLowerCase()}` };
      if (req.dread && (s.player.dread ?? 0) < req.dread) return { ok: false, reason: `Il faut inspirer de la crainte (${req.dread})` };
      if (req.struggle && s.struggle?.id !== req.struggle) return { ok: false, reason: 'Seulement pendant cette grande lutte' };
      if (req.lifestyle && s.player.lifestyle?.id !== req.lifestyle) return { ok: false, reason: 'Réservé à ce style de vie' };
      if (req.decision && !decisionActive(s, req.decision)) return { ok: false, reason: `Réservé : « ${GREAT_INFO_BY_ID.get(req.decision)?.label ?? req.decision} »` };
      if (req.knownSecret && !(s.secrets ?? []).some(x => x.known && !x.exposed && x.owner !== 'player')) return { ok: false, reason: 'Aucun secret en main' };
      if (req.governing && !s.presidency && !['ministre', 'premier_ministre'].includes(s.player.rankId)) return { ok: false, reason: 'Réservé aux membres du gouvernement' };
      if (req.promises && !(s.promises ?? []).some(x => x.status === 'en_cours')) return { ok: false, reason: 'Aucune promesse en cours' };
      if (req.secondRound && !inSecondRound(s)) return { ok: false, reason: 'Seulement entre les deux tours de la présidentielle' };
      if (req.team && !s.player.team.length) return { ok: false, reason: 'Il faut une équipe' };
      if (req.totalWar && !s.war?.total) return { ok: false, reason: 'Seulement en guerre totale' };
      if (req.civil === true && !civilActive(s)) return { ok: false, reason: 'Réservé aux hauts fonctionnaires en poste' };
      if (req.civil === false && s.player.civil) return { ok: false, reason: 'Vous êtes déjà haut fonctionnaire' };
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
    if ((cost.renown ?? 0) > (s.player.renown ?? 0)) return { ok: false, reason: `Il faut ${cost.renown} de renommée` };
    const party = payer === 'parti' || !!action.partyOnly;
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
    const byCategory: Record<string, number> = {};
    const occUsed = new Set<string>();
    // Les combos du mois (l'ordre du plan compte)
    const lite = liteFromPlan(d, this._plan());
    const combos = combosOf(lite);
    // Les coûts sont fixés au moment du plan (l'épuisement en cours de mois ne les change plus)
    const seen: Record<string, number> = {};
    const costs = this._plan().map(planned => {
      const a = ACTIONS_BY_ID.get(planned.actionId)!;
      const c = costOf(d, a, seen[a.id] ?? 0);
      seen[a.id] = (seen[a.id] ?? 0) + 1;
      return c;
    });
    for (const [k, planned] of this._plan().entries()) {
      const action = ACTIONS_BY_ID.get(planned.actionId)!;
      const ctx = { domain: planned.domain, targetId: planned.targetId, reason: action.label };
      const cost = costs[k];

      d.player.actionPoints.current -= cost.ap;
      d.player.stats.energy = Math.max(0, d.player.stats.energy - (cost.energy ?? 0));
      d.player.stats.stress = Math.min(100, d.player.stats.stress + (cost.energy ?? 0) / 3);
      d.player.stats.politicalCapital = Math.max(0, d.player.stats.politicalCapital - (cost.politicalCapital ?? 0));
      if (planned.payer === 'parti' || action.partyOnly) spendParty(d, cost.money ?? 0);
      else spend(d, cost.money ?? 0);
      if (action.cooldown) d.cooldowns[action.id] = d.week + action.cooldown;

      recordObjectiveEvent(d, 'category', action.category);
      // Les compteurs d'engagement : l'investiture et les offres se méritent
      d.player.flags['actionsDone'] = (typeof d.player.flags['actionsDone'] === 'number' ? d.player.flags['actionsDone'] : d.week * 3) + 1;
      d.player.flags[`cat_${action.category}`] = Number(d.player.flags[`cat_${action.category}`] ?? 0) + 1;
      onAction(d, action);
      checkCharte(d, action.id, rng);
      if (cost.renown) d.player.renown = Math.max(0, (d.player.renown ?? 0) - cost.renown);
      actionSegments(d, action, ctx);
      actionImage(d, action, ctx);
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
        // Saturation de la catégorie dans le mois, maîtrise du dossier, sujet à la une
        const rank = byCategory[action.category] = (byCategory[action.category] ?? -1) + 1;
        const sat = FLAT_CATEGORIES.has(action.category) ? 1 : saturation(rank);
        const mastery = ctx.domain ? masteryFactor(d.player.dossiers[ctx.domain].mastery) : 1;
        const agenda = ctx.domain && ctx.domain === d.agendaDomain ? 1.15 : 1;
        // Une occasion du mois porte davantage (la première fois)
        const occ = occasionOf(d, action.id) && !occUsed.has(action.id) ? 1.5 : 1;
        if (occ > 1) occUsed.add(action.id);
        const wear = wearFactor(d, action.id) * sat * mastery * agenda * occ;
        const effects = action.category === 'medias' ? boostMedia(d, action.effects) : action.effects;
        // Mini-jeu : les gains attendent le résultat (joué avant la fin du mois suivant)
        if (action.minigame && queueMinigame(d, action.minigame, action.label, scaleGains(effects, wear), ctx).length) {
          pushNews(d, 'action', 'neutral', action.label, 'À vous de jouer : mini-jeu en attente.');
          record();
          continue;
        }
        // Raté, comme prévu, ou coup d'éclat : le hasard du terrain
        const tier = rollTier(d, action, rng);
        const summary = applyEffects(d, tierEffects(scaleGains(effects, wear), tier), ctx, rng);
        if (sat < 1) summary.push(`saturation −${Math.round((1 - sat) * 100)} %`);
        if (mastery < 1) summary.push(`dossier mal maîtrisé −${Math.round((1 - mastery) * 100)} %`);
        if (wear / sat / mastery / agenda / occ < 1) summary.push(`lassitude −${Math.round((1 - wear / sat / mastery / agenda / occ) * 100)} %`);
        if (occ > 1) summary.push('occasion du mois +50 %');
        if (tier === 'eclat') {
          d.player.renown = (d.player.renown ?? 0) + 3;
          pushNews(d, 'actu', 'positive', `Coup d’éclat : ${action.label}`, [tierStory(action, tier, rng), summary.join(' · ')].filter(Boolean).join(' — '));
          d.news[0].une = true;
        } else if (tier === 'rate') {
          pushNews(d, 'action', 'negative', `Raté : ${action.label}`, [tierStory(action, tier, rng), summary.join(' · ')].filter(Boolean).join(' — '));
        } else if (summary.length) pushNews(d, 'action', 'positive', action.label, summary.join(' · '));
      }
      record();
    }
    for (const c of combos) {
      const domain = lite.find(p => p.action.category === 'dossiers' && p.domain)?.domain ?? d.agendaDomain;
      const summary = applyEffects(d, c.effects, { domain, reason: `Combo : ${c.label}` }, rng);
      pushNews(d, 'action', 'positive', `${c.icon} Combo : ${c.label}`, summary.join(' · '));
      d.player.flags[`combo_${c.id}`] = Number(d.player.flags[`combo_${c.id}`] ?? 0) + 1;
    }
    this.clear();
  }
}

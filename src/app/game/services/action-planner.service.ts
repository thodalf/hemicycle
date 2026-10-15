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
      if (p.payer === 'parti' || a.partyOnly) {
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
      if (a.category === 'couronne') return s.kingdom ? !!a.requires?.kingdom : (!!s.crown && !a.requires?.kingdom);
      if (a.category === 'loge') return !!s.lodge;
      // Lutte : seulement pendant une grande lutte, et les actions de cette lutte-là
      if (a.category === 'lutte') return !!s.struggle && (!a.requires?.struggle || a.requires.struggle === s.struggle.id);
      // Actions d'éclat : seulement quand la renommée les ouvre
      if (a.category === 'eclat') return renownTier(s.player.renown ?? 0) >= (a.requires?.renownTier ?? 1);
      // Un président ne colle pas d'affiches ; une ministre ne pose pas de question au gouvernement
      if (hiddenForOffice(s, a)) return false;
      // Actions nées d'une grande décision : seulement tant qu'elle tient
      if (a.requires?.decision && !decisionActive(s, a.requires.decision)) return false;
      if (a.category === 'redaction') return !!s.press;
      if (a.category === 'infiltration') return !!s.mole;
      if (a.category === 'contact') return !!s.alien;
      if (a.category === 'elysee') return !!s.presidency;
      if (a.category === 'arriere') return !!s.war;
      if (a.category === 'securite') return !!s.plot;
      if (a.category === 'zombie') return !!s.zombie;
      if (a.category === 'apocalypse') return !!s.apocalypse && s.apocalypse.phase < 4;
      if (a.requires?.arc && !s.crises?.[a.requires.arc]) return false;
      // La caisse du parti : réservée à sa direction (les autres ne voient pas ces actions)
      if (a.partyOnly && s.party.leaderNpcId !== 'player') return false;
      if (a.category === 'crise') return a.requires?.natCrisis ? natCrisis(s) === a.requires.natCrisis : Object.values(s.crises ?? {}).some(Boolean);
      if (a.category === 'administration') return civilActive(s);
      if (a.category === 'international' && !intlRelevant(s)) return false;
      if (a.category === 'international' && rankOrder(a.minRank) >= rankOrder('ministre') && rankOrder(s.player.rankId) >= rankOrder('ministre') && !intlPower(s)) return false;
      if (a.onlyRanks && !rankAllowed(a.onlyRanks, s.player.rankId)) return false;
      // Actions propres à un ministère : seulement pour le ou la titulaire du portefeuille
      if (a.requires?.portfolio && (s.player.rankId !== 'ministre' || s.portfolio !== a.requires.portfolio)) return false;
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
    if (action.minigame && MINIGAMES_BY_ID.get(action.minigame)?.daily && dailyPlayed()) return { ok: false, reason: 'Déjà joué aujourd’hui : nouveau mot demain' };
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
    for (const planned of this._plan()) {
      const action = ACTIONS_BY_ID.get(planned.actionId)!;
      const ctx = { domain: planned.domain, targetId: planned.targetId, reason: action.label };
      const { cost } = action;

      d.player.actionPoints.current -= cost.ap;
      d.player.stats.energy = Math.max(0, d.player.stats.energy - (cost.energy ?? 0));
      d.player.stats.stress = Math.min(100, d.player.stats.stress + (cost.energy ?? 0) / 3);
      d.player.stats.politicalCapital = Math.max(0, d.player.stats.politicalCapital - (cost.politicalCapital ?? 0));
      if (planned.payer === 'parti' || action.partyOnly) spendParty(d, cost.money ?? 0);
      else spend(d, cost.money ?? 0);
      if (action.cooldown) d.cooldowns[action.id] = d.week + action.cooldown;

      recordObjectiveEvent(d, 'category', action.category);
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
        const wear = wearFactor(d, action.id);
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
        if (wear < 1) summary.push(`lassitude −${Math.round((1 - wear) * 100)} %`);
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
    this.clear();
  }
}

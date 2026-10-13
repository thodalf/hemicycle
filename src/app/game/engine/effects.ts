import {
  ChoiceRequirement, ContactType, Domain, Effect, EffectContext, GameState, NewsKind, RiskProfile,
  STAT_LABELS, StatKey, Tone,
} from '../models/game.models';
import { RANKS } from '../data/ranks';
import { createDecision } from '../data/decisions';
import { createDebate } from './debate';
import { createProtest } from './protest';
import { createScene } from './scene';
import { Rng, clamp, nextId } from './rng';
import { grantAsset, pickAsset, sellAsset } from './patrimoine';
import { adjustPress } from './press';
import { adjustMole } from './mole';
import { declareBankruptcy, takeLoan } from './bankruptcy';
import { OUTLETS, PRESS_GRADES, PRESS_SALARIES, createPress } from '../data/press';
import { adjustHealth, die } from './life';
import { adjustIntl } from './intl';
import { adjustGovernment, assignPortfolio, enterMatignon } from './government';
import { addParrainages, adjustPresidency, declareCandidacy, endPresidency } from './presidency';
import { lawyerFactor } from './staff-perks';
import { adjustWar } from './war';
import { ownOrigin, scheduleVote } from './assembly';
import { queueMinigame } from './minigame';

/* ============================================================
 *  Moteur d'effets — fonctions pures appliquées sur un brouillon
 *  (draft) du GameState. Toute la logique de jeu passe par ici,
 *  ce qui rend les services testables sans Angular.
 * ============================================================ */

export function pushNews(d: GameState, kind: NewsKind, tone: Tone, title: string, body?: string): void {
  d.news.unshift({ id: nextId(d, 'news'), week: d.week, kind, tone, title, body });
  if (d.news.length > 150) d.news.length = 150;
}

/** Soutien pondéré des courants au joueur (0‑100) */
export function partySupport(d: GameState): number {
  const total = d.party.factions.reduce((s, f) => s + f.weight, 0);
  return d.party.factions.reduce((s, f) => s + f.supportForPlayer * f.weight, 0) / total;
}

export function campaignOpen(d: GameState): boolean {
  return d.player.finances.legalCeiling !== null;
}

export function availableFunds(d: GameState): number {
  return d.player.finances.personal + d.player.finances.campaign;
}

/** Dépense : compte de campagne en priorité pendant une campagne, sinon fonds personnels */
export function spend(d: GameState, amount: number): void {
  const f = d.player.finances;
  if (amount <= 0) return;
  if (campaignOpen(d)) {
    const fromCampaign = Math.min(f.campaign, amount);
    f.campaign -= fromCampaign;
    f.personal -= amount - fromCampaign;
    f.campaignSpent += amount;
    if (f.legalCeiling !== null && f.campaignSpent > f.legalCeiling && !d.player.flags['depassement']) {
      d.player.flags['depassement'] = true;
      d.player.scandalExposure = clamp(d.player.scandalExposure + 20);
      pushNews(d, 'scandale', 'negative', 'Plafond de dépenses dépassé',
        'Votre trésorier s’inquiète : le compte de campagne excède le plafond légal. Un recours est possible.');
    }
  } else {
    const fromPersonal = Math.min(f.personal, amount);
    f.personal -= fromPersonal;
    f.campaign -= amount - fromPersonal;
  }
}

/* ── Caisse du parti ─────────────────────────────────────────
 * Une action militante peut être réglée par le parti. Si vous le dirigez,
 * c'est la trésorerie qui paie. Sinon, la fédération vous accorde une
 * enveloppe mensuelle selon votre rang et votre soutien interne, et
 * chaque tranche de 1 000 € coûte un point de capital politique. */
const ENVELOPE_BY_RANK = [800, 2500, 6000, 9000, 12000, 15000, 20000];

export function partyEnvelope(d: GameState): number {
  if (d.partyFinance && playerLeadsPartyLike(d)) return Math.max(0, Math.round(d.partyFinance.treasury * 1000));
  const base = ENVELOPE_BY_RANK[RANKS[d.player.rankId].order] ?? 6000;
  const support = clamp(partySupport(d) / 50, 0.3, 1.5);
  return Math.round(base * support / 100) * 100;
}

/** Capital politique demandé pour une prise en charge par le parti */
export function partyCapitalCost(d: GameState, amount: number): number {
  if (amount <= 0 || (d.partyFinance && playerLeadsPartyLike(d))) return 0;
  return Math.ceil(amount / 1000);
}

function playerLeadsPartyLike(d: GameState): boolean {
  return d.party.leaderNpcId === 'player';
}

export function spendParty(d: GameState, amount: number): void {
  if (amount <= 0) return;
  if (d.partyFinance && playerLeadsPartyLike(d)) d.partyFinance.treasury -= amount / 1000;
  d.player.stats.politicalCapital = clamp(d.player.stats.politicalCapital - partyCapitalCost(d, amount));
  d.player.flags['partySpent'] = Number(d.player.flags['partySpent'] ?? 0) + amount;
  if (campaignOpen(d)) d.player.finances.campaignSpent += amount;
}

/** Probabilité d'échec d'un risque, modulée par la stat ou la maîtrise du dossier */
export function failureChance(d: GameState, risk: RiskProfile, ctx: EffectContext): number {
  let value = 0;
  if (risk.scaleWith === 'dossier') value = ctx.domain ? d.player.dossiers[ctx.domain].mastery : 0;
  else if (risk.scaleWith) value = d.player.stats[risk.scaleWith];
  // Avocate : les risques judiciaires (ceux qui exposent aux scandales) tournent plus souvent bien
  const legal = d.player.staff.includes('juriste') && risk.onFailure.some(e => e.kind === 'exposure') ? 0.8 : 1;
  const p = risk.baseChance * (1 - (risk.scaleWeight ?? 0) * (value / 100)) * legal;
  return clamp(p, 0.03, 0.95);
}

export function meetsRequirement(d: GameState, req: ChoiceRequirement | undefined, ctxDomain?: Domain): boolean {
  if (!req) return true;
  const domain = req.domain ?? ctxDomain;
  if (req.minMastery !== undefined && domain && d.player.dossiers[domain].mastery < req.minMastery) return false;
  if (req.stat && req.minStat !== undefined && d.player.stats[req.stat] < req.minStat) return false;
  return true;
}

const SOFT_CAPPED: StatKey[] = ['popularity', 'influence', 'credibility'];

const FAVOR_TABLE: Record<ContactType, Effect[]> = {
  journaliste: [{ kind: 'stat', stat: 'popularity', delta: 5 }, { kind: 'stat', stat: 'credibility', delta: 2 }],
  lobby: [{ kind: 'funds', account: 'campaign', delta: 8000 }, { kind: 'exposure', delta: 4 }],
  industriel: [{ kind: 'funds', account: 'campaign', delta: 15000 }, { kind: 'exposure', delta: 8 }],
  syndicat: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'faction', factionId: 'ligne_dure', delta: 5 }],
  association: [{ kind: 'stat', stat: 'credibility', delta: 4 }, { kind: 'stat', stat: 'popularity', delta: 2 }],
};

/** Réduit la part « gain » d'une liste d'effets (lassitude), sans toucher aux malus */
export function scaleGains(effects: Effect[], f: number): Effect[] {
  if (f >= 1) return effects;
  const r = (v: number) => Math.round(v * f * 10) / 10;
  return effects.map(e => {
    switch (e.kind) {
      case 'stat': return (e.stat === 'stress' ? e.delta < 0 : e.delta > 0) ? { ...e, delta: r(e.delta) } : e;
      case 'momentum': case 'dossier': case 'faction': case 'cohesion': case 'npcRelation':
        return e.delta > 0 ? { ...e, delta: r(e.delta) } : e;
      case 'funds': return e.delta > 0 ? { ...e, delta: Math.round(e.delta * f) } : e;
      case 'income': return { ...e, base: Math.round(e.base * f), mult: e.mult ? e.mult * f : e.mult };
      case 'press': return { ...e, audience: (e.audience ?? 0) > 0 ? r(e.audience!) : e.audience, reputation: (e.reputation ?? 0) > 0 ? r(e.reputation!) : e.reputation };
      case 'contact': return (e.trust ?? 0) > 0 ? { ...e, trust: r(e.trust!) } : e;
      default: return e;
    }
  });
}

/** Lassitude : répéter la même action d'un mois sur l'autre rapporte de moins en moins */
export function wearFactor(d: GameState, actionId: string): number {
  const last = Number(d.player.flags[`last_${actionId}`] ?? -99);
  if (d.week - last > 1) return 1;
  return Math.max(0.4, 1 - 0.2 * (Number(d.player.flags[`streak_${actionId}`] ?? 0) + 1));
}

/** Applique une liste d'effets ; renvoie un résumé lisible (« Popularité +3 ») */
export function applyEffects(d: GameState, effects: Effect[], ctx: EffectContext, rng: Rng): string[] {
  const summary: string[] = [];
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const target = (ref: string) => (ref === '$target' ? ctx.targetId ?? '' : ref);

  for (const e of effects) {
    switch (e.kind) {
      case 'stat': {
        const s = d.player.stats;
        const before = s[e.stat];
        // Rendements décroissants : plus une jauge est haute, plus elle est dure à faire monter
        const softCap = SOFT_CAPPED.includes(e.stat) && e.delta > 0 ? Math.max(0.15, 1 - before / 110) : 1;
        // … et plus dure est la chute : les pertes pèsent davantage quand on est haut
        const fall = SOFT_CAPPED.includes(e.stat) && e.delta < 0 ? 1 + before / 150 : 1;
        s[e.stat] = clamp(before + e.delta * softCap * fall);
        const real = Math.round(s[e.stat] - before);
        if (real) summary.push(`${STAT_LABELS[e.stat]} ${signed(real)}`);
        break;
      }
      case 'dossier': {
        const domain = e.domain === '$domain' ? ctx.domain : e.domain;
        if (!domain) break;
        const dossier = d.player.dossiers[domain];
        // L'arbre de compétences amplifie l'apprentissage (+20 % par niveau)
        const staffBoost = (d.player.staff.includes('conseiller') ? 1.4 : 1)
          * (1 + 0.15 * d.player.team.filter(r => r.traits.includes('technocrate')).length);
        // Rendements décroissants : plus on maîtrise, plus chaque point coûte
        const diminishing = Math.max(0.3, 1 - dossier.mastery / 130);
        const gain = e.delta > 0 ? Math.round(e.delta * (1 + 0.2 * d.player.skills[domain]) * staffBoost * diminishing) : e.delta;
        dossier.mastery = clamp(dossier.mastery + gain);
        if (e.delta > 0) dossier.lastStudiedWeek = d.week;
        summary.push(`Dossier ${signed(gain)}`);
        break;
      }
      case 'funds': {
        const boost = e.account === 'campaign' && e.delta > 0 && d.player.staff.includes('tresorier') ? 1.5 : 1;
        const amount = Math.round(e.delta * boost);
        d.player.finances[e.account] += amount;
        summary.push(`${e.account === 'campaign' ? 'Fonds de campagne' : 'Fonds perso'} ${signed(amount)} €`);
        break;
      }
      case 'faction': {
        const id = target(e.factionId);
        for (const f of d.party.factions) {
          if (id === '*' || f.id === id) f.supportForPlayer = clamp(f.supportForPlayer + e.delta);
        }
        if (id !== '*') {
          const f = d.party.factions.find(x => x.id === id);
          if (f) summary.push(`${f.name} ${signed(e.delta)}`);
        }
        break;
      }
      case 'cohesion':
        d.party.cohesion = clamp(d.party.cohesion + e.delta);
        summary.push(`Cohésion du parti ${signed(e.delta)}`);
        break;
      case 'npcRelation': {
        const npc = d.npcs.find(n => n.id === target(e.npcId));
        if (npc) {
          npc.relationToPlayer = clamp(npc.relationToPlayer + e.delta, -100, 100);
          summary.push(`Relation ${npc.name.split(' ')[0]} ${signed(e.delta)}`);
        }
        break;
      }
      case 'npcStat': {
        const npc = d.npcs.find(n => n.id === target(e.npcId));
        if (npc) npc[e.stat] = clamp(npc[e.stat] + e.delta);
        break;
      }
      case 'contact': {
        const c = d.contacts.find(x => x.id === target(e.contactId));
        if (!c) break;
        if (e.trust) c.trust = clamp(c.trust + e.trust);
        if (e.balance) c.balance += e.balance;
        summary.push(`${c.name.split(' (')[0]} : confiance ${c.trust}, crédit ${c.balance}`);
        break;
      }
      case 'favor': {
        const c = d.contacts.find(x => x.id === target(e.contactId));
        if (!c) break;
        const owed = c.balance > 0;
        c.balance -= 1;
        if (!owed) c.trust = clamp(c.trust - 8);
        const bonus: Effect[] = [...FAVOR_TABLE[c.type], { kind: 'dossier', domain: c.domain, delta: 8 }];
        summary.push(...applyEffects(d, bonus, ctx, rng));
        summary.push(owed ? 'Faveur soldée' : 'Vous lui devez désormais une faveur');
        break;
      }
      case 'exposure': {
        // Une avocate dans l'équipe amortit chaque affaire
        const delta = e.delta > 0 ? Math.round(e.delta * lawyerFactor(d) * 10) / 10 : e.delta;
        d.player.scandalExposure = clamp(d.player.scandalExposure + delta);
        if (delta > 0) summary.push(`Exposition ${signed(delta)}`);
        break;
      }
      case 'war':
        summary.push(...adjustWar(d, e, ctx.targetId, rng));
        break;
      case 'minigame':
        summary.push(...queueMinigame(d, e.gameId, e.title ?? 'événement', e.reward, ctx, e.penalty, e.title));
        break;
      case 'vote':
        summary.push(...scheduleVote(d, rng, e.billId, e.own ? ownOrigin(d) : undefined));
        break;
      case 'momentum':
        d.player.momentum = clamp(d.player.momentum + e.delta);
        if (campaignOpen(d)) summary.push(`Dynamique ${signed(e.delta)}`);
        break;
      case 'skillPoints':
        d.player.skillPoints += e.delta;
        summary.push(`Compétence ${signed(e.delta)} pt`);
        break;
      case 'decision': {
        const decision = createDecision(e.templateId, d, rng, ctx);
        if (decision) d.pendingDecisions.push(decision);
        break;
      }
      case 'debate': {
        if (d.debate) {
          pushNews(d, 'systeme', 'neutral', 'Débat reporté', 'Un autre débat est déjà programmé.');
          break;
        }
        const opp = e.opponentId ? target(e.opponentId) : undefined;
        d.debate = createDebate(d, rng, e.stakes, opp || undefined);
        if (d.debate) {
          pushNews(d, 'actu', 'neutral', `${d.debate.title} face à ${d.debate.opponentName}`, 'Préparez vos arguments : le débat commence.');
          summary.push('Débat programmé');
        }
        break;
      }
      case 'stance': {
        const before = d.player.stance;
        d.player.stance = clamp(before + e.delta, -100, 100);
        const real = Math.round(d.player.stance - before);
        if (real) summary.push(`Ligne : ${Math.abs(real)} pts vers la ${real < 0 ? 'gauche' : 'droite'}`);
        break;
      }
      case 'protest': {
        if (d.protest) break;
        d.protest = createProtest(d, rng);
        pushNews(d, 'actu', 'neutral', 'Une manifestation se prépare', 'Choisissez la cause et vos alliés.');
        summary.push('Manifestation lancée');
        break;
      }
      case 'scene': {
        if (d.scene) {
          pushNews(d, 'systeme', 'neutral', 'Rendez-vous reporté', 'Une autre opération est déjà en cours.');
          break;
        }
        d.scene = createScene(d, rng, e.sceneId);
        if (d.scene) summary.push('Opération lancée');
        break;
      }
      case 'partyTreasury':
        if (d.partyFinance) {
          d.partyFinance.treasury += e.delta;
          summary.push(`Trésorerie du parti ${e.delta > 0 ? '+' : ''}${e.delta} k€`);
        }
        break;
      case 'partyAllocation':
        if (d.partyFinance) d.partyFinance.allocations[e.line] = e.value;
        break;
      case 'agenda': {
        const domain = e.domain === '$domain' ? ctx.domain : e.domain;
        if (!domain) break;
        d.agendaDomain = domain;
        d.agendaLockedUntil = d.week + e.weeks;
        break;
      }
      case 'rank': {
        // À l'Élysée, aucune décision ne vous fait changer de rang (sauf la fin du mandat)
        if (d.presidency && e.rankId !== 'president') break;
        if (RANKS[e.rankId].order > RANKS[d.player.rankId].order) {
          d.player.boosters += 1;
          summary.push('Booster de recrutement +1');
        }
        const was = d.player.rankId;
        d.player.rankId = e.rankId;
        d.player.actionPoints.max = RANKS[e.rankId].monthlyActionPoints;
        summary.push(`Nouveau rang : ${RANKS[e.rankId].label}`);
        if (e.rankId === 'premier_ministre' && was !== 'premier_ministre') enterMatignon(d);
        if (e.rankId === 'ministre' && was !== 'ministre') assignPortfolio(d);
        break;
      }
      case 'flag':
        d.player.flags[e.key] = e.value;
        break;
      case 'income': {
        const amount = Math.round((e.base + (e.scale ? d.player.stats[e.scale] * (e.mult ?? 0) : 0)) / 50) * 50;
        d.player.finances.personal += amount;
        summary.push(`Fonds perso +${amount.toLocaleString('fr-FR')} €`);
        break;
      }
      case 'flagAdd':
        d.player.flags[e.key] = Number(d.player.flags[e.key] ?? 0) + e.delta;
        break;
      case 'dossierScale': {
        const domain = e.domain === '$domain' ? ctx.domain : e.domain;
        if (!domain) break;
        const dossier = d.player.dossiers[domain];
        const before = dossier.mastery;
        dossier.mastery = clamp(Math.round(before * e.factor));
        summary.push(`Dossier ${Math.round(dossier.mastery - before)}`);
        break;
      }
      case 'booster':
        d.player.boosters += e.count;
        pushNews(d, 'systeme', 'positive', `Booster de recrutement reçu${e.count > 1 ? ` (×${e.count})` : ''}`, e.reason);
        summary.push(`Booster +${e.count}`);
        break;
      case 'crown':
        if (d.crown) {
          const c = d.crown;
          if (e.soutien) c.soutien = clamp(c.soutien + e.soutien);
          if (e.legitimite) c.legitimite = clamp(c.legitimite + e.legitimite);
          if (e.armee) c.armee = clamp(c.armee + e.armee);
          const parts = [e.soutien && `Soutien ${signed(e.soutien)}`, e.legitimite && `Légitimité ${signed(e.legitimite)}`, e.armee && `Armée ${signed(e.armee)}`].filter(Boolean);
          if (parts.length) summary.push(parts.join(' · '));
        }
        break;
      case 'lodge':
        if (d.lodge) {
          const l = d.lodge;
          if (e.fraternite) l.fraternite = clamp(l.fraternite + e.fraternite);
          if (e.discretion) l.discretion = clamp(l.discretion + e.discretion);
          if (e.planches) l.planches += e.planches;
          const parts = [e.fraternite && `Fraternité ${signed(e.fraternite)}`, e.discretion && `Discrétion ${signed(e.discretion)}`, e.planches && `Planche ${signed(e.planches)}`].filter(Boolean);
          if (parts.length) summary.push(parts.join(' · '));
        }
        break;
      case 'end':
        d.status = e.status;
        d.endReason = e.reason;
        d.endTitle = e.title;
        break;
      case 'joinCrown':
        if (!d.crown) {
          d.crown = { pretendant: 'le prince Louis-Amaury de Valmont', soutien: 6, legitimite: 25, armee: 8 };
          pushNews(d, 'actu', 'neutral', 'Naissance d’un cercle royaliste',
            `${d.player.name} réunit des partisans de la monarchie autour du prince Louis-Amaury de Valmont. La presse s’amuse, votre parti s’inquiète.`);
          pushNews(d, 'systeme', 'positive', 'Nouvel onglet : Couronne', 'Les actions royalistes sont désormais disponibles dans votre agenda.');
          summary.push('Cercle royaliste rejoint');
        }
        break;
      case 'joinLodge':
        if (!d.lodge) {
          d.lodge = {
            loge: 'Les Compagnons de l’Aube', obedience: 'l’Obédience de l’Équerre et du Compas',
            grade: 0, fraternite: 30, discretion: 85, planches: 0,
          };
          pushNews(d, 'systeme', 'neutral', 'Initiation', 'Vous êtes reçu·e Apprenti·e à la loge Les Compagnons de l’Aube. Nouvel onglet : Loge.');
          summary.push('Initié·e en loge');
        }
        break;
      case 'mole':
        summary.push(...adjustMole(d, e));
        break;
      case 'loan':
        summary.push(...takeLoan(d, e.amount, e.total, e.lender));
        break;
      case 'bankrupt':
        summary.push(...declareBankruptcy(d));
        break;
      case 'gainAsset':
        summary.push(...grantAsset(d, e.defId));
        break;
      case 'assetValue': {
        const hit = d.player.assets.filter(a => !e.defIds || e.defIds.includes(a.defId));
        for (const a of hit) a.value = Math.max(0, Math.round(a.value * e.factor));
        if (hit.length) summary.push(`Valeur des biens ${e.factor >= 1 ? '+' : ''}${Math.round((e.factor - 1) * 100)} %`);
        break;
      }
      case 'sellAsset': {
        const a = pickAsset(d, e.which);
        if (a) summary.push(...sellAsset(d, a.uid, e.discount ?? 0));
        break;
      }
      case 'joinPress':
        if (!d.press) {
          d.press = createPress(e.outlet, d.week);
          pushNews(d, 'actu', 'neutral', `${d.player.name} rejoint ${OUTLETS[e.outlet].name}`,
            `Une chronique régulière, ${d.press.salary.toLocaleString('fr-FR')} € par mois. Nouvel onglet : Rédaction.`);
          summary.push(`Entrée à ${OUTLETS[e.outlet].name}`);
        }
        break;
      case 'leavePress':
        if (d.press) {
          pushNews(d, 'actu', 'neutral', `Départ de ${d.press.outlet}`, 'Votre collaboration avec la rédaction prend fin.');
          summary.push(`Départ de ${d.press.outlet}`);
          d.press = null;
          if (d.scenario === 'editorialiste' && d.status === 'en_cours') {
            d.status = 'defaite';
            d.endTitle = 'Remercié·e';
            d.endReason = 'Sans rédaction, votre plume n’a plus de tribune. Votre carrière de journaliste s’arrête là.';
          }
        }
        break;
      case 'press':
        summary.push(...adjustPress(d, e));
        break;
      case 'pressGrade':
        if (d.press) {
          d.press.grade = Math.max(0, Math.min(4, d.press.grade + e.delta));
          d.press.gradeWeek = d.week;
          d.press.salary = Math.max(d.press.salary, PRESS_SALARIES[d.press.grade]);
          summary.push(`Nouveau poste : ${PRESS_GRADES[d.press.grade]}`);
        }
        break;
      case 'leaveCrown':
        if (d.crown) {
          d.crown = null;
          pushNews(d, 'actu', 'neutral', 'Rupture avec les royalistes', `${d.player.name} prend ses distances avec le cercle du prétendant.`);
          summary.push('Cercle royaliste quitté');
        }
        break;
      case 'leaveLodge':
        if (d.lodge) {
          d.lodge = null;
          pushNews(d, 'systeme', 'neutral', 'Démission de la loge', 'Vous remettez votre tablier. Certaines portes se refermeront.');
          summary.push('Loge quittée');
        }
        break;
      case 'health':
        summary.push(...adjustHealth(d, e.delta));
        break;
      case 'presidency':
        summary.push(...adjustPresidency(d, e, rng));
        break;
      case 'parrainages':
        summary.push(...addParrainages(d, e.delta));
        break;
      case 'declare':
        summary.push(...declareCandidacy(d));
        break;
      case 'resign':
        if (d.presidency) {
          endPresidency(d, e.why ?? 'demission');
          summary.push(e.why === 'destitution' ? 'Destitué·e' : 'Démission');
        }
        break;
      case 'intl':
        summary.push(...adjustIntl(d, e, ctx.targetId, rng));
        break;
      case 'government':
        summary.push(...adjustGovernment(d, e));
        break;
      case 'die':
        die(d, e.cause, e.text);
        summary.push('Décès');
        break;
      case 'grade':
        if (d.lodge) {
          d.lodge.grade = Math.max(0, Math.min(4, d.lodge.grade + e.delta));
          summary.push(`Grade : ${['Apprenti·e', 'Compagnon', 'Maître', 'Vénérable Maître', 'Grand Maître'][d.lodge.grade]}`);
        }
        break;
    }
  }
  return summary;
}

/** Résout un risque : en cas d'échec, applique onFailure et renvoie true */
export function rollRisk(d: GameState, risk: RiskProfile | undefined, ctx: EffectContext, rng: Rng): boolean {
  if (!risk) return false;
  return rng.chance(failureChance(d, risk, ctx));
}

export const statLabel = (k: StatKey) => STAT_LABELS[k];

import { yearOf } from './calendar';
import { recordLaw } from './legacy';
import { DOMAIN_LABELS } from '../models/game.models';
import { applyAppointment, pmDecision } from './cabinet';
import { restoreRepublic } from './kingdom';
import { makePledges } from './pledges';
import { Decision, DecisionChoice, Effect, GameState, PresidentialCalendar, ScheduledElection } from '../models/game.models';
import { inMonth, monthLabel } from './calendar';
import { DECLARE_WINDOW, ELECTIONS, FIRST_PRESIDENTIAL_WEEK, MANDATE_MONTHS, PARRAINAGES_REQUIRED, RANKS, rankOrder } from '../data/ranks';
import { ofParty } from '../data/world';
import { applyEffects, partySupport, pushNews } from './effects';
import { addMilestone } from './life';
import { fallFromMatignon } from './government';
import { Rng, clamp, nextId, fr, frSigned } from './rng';

/* ============================================================
 *  Élection présidentielle et présidence.
 *   - Un scrutin tous les cinq ans, à date fixe.
 *   - Le joueur se déclare candidat·e (bouton), réunit 500
 *     parrainages avant l'ouverture de la campagne, puis fait
 *     campagne (programme, sondages, débat d'entre-deux-tours).
 *   - Élu·e : cote de confiance, majorité, sécurité, menace,
 *     crises, réformes, 49.3, dissolution… deux mandats au plus.
 * ============================================================ */

const PRIME_MINISTERS = [
  'Bertrand Lacombe', 'Isabelle Ferrand', 'Thomas Aubriot', 'Nadia Belkacem-Roux', 'Philippe Garnier',
  'Claire Montel', 'Jean-Baptiste Royer', 'Élodie Marchetti', 'Antoine Delacroix', 'Sylvie Brunel-Haas',
];

export function initPresidential(d: GameState): PresidentialCalendar {
  if (d.scenario === 'presidentielle') {
    return { nextWeek: 6, incumbentId: null, incumbentName: 'le président sortant', incumbentMandates: 2, incumbentPartyId: d.party.id, declared: true, declaredWeek: 1, parrainages: PARRAINAGES_REQUIRED };
  }
  // Au départ, le président sortant (fictif) achève son second mandat ; son parti est celui du gouvernement
  const governing = d.scenario === 'royaute' || d.scenario === 'infiltre' ? d.otherParties[2]?.id ?? d.party.id : d.party.id;
  return { nextWeek: FIRST_PRESIDENTIAL_WEEK, incumbentId: null, incumbentName: 'le président sortant', incumbentMandates: 2, incumbentPartyId: governing, declared: false, parrainages: 0 };
}

export function weeksToPresidential(d: GameState): number {
  return d.presidential.nextWeek - d.week;
}

/** La campagne s'ouvre cinq mois avant le scrutin */
export function campaignOpensAt(d: GameState): number {
  return d.presidential.nextWeek - ELECTIONS.presidentielle.campaignMonths;
}

export function canDeclare(d: GameState): { ok: boolean; reason?: string } {
  const c = d.presidential;
  const left = c.nextWeek - d.week;
  if (d.status !== 'en_cours') return { ok: false, reason: 'Partie terminée' };
  if (d.player.flags['monarchie']) return { ok: false, reason: 'La monarchie a aboli l’élection présidentielle' };
  if (Number(d.player.flags['ineligibleUntil'] ?? 0) > d.week) return { ok: false, reason: `Inéligible jusqu’en ${monthLabel(Number(d.player.flags['ineligibleUntil']))}` };
  if (d.player.flags['retired']) return { ok: false, reason: 'Vous vous êtes retiré·e' };
  if (c.declared) return { ok: false, reason: 'Candidature déjà déclarée' };
  if (d.elections.some(e => !e.resolved && e.type === 'presidentielle')) return { ok: false, reason: 'La campagne est déjà lancée' };
  if (d.presidency && d.presidency.mandates >= 2) return { ok: false, reason: 'Deux mandats consécutifs au plus' };
  if (left > DECLARE_WINDOW) return { ok: false, reason: `Trop tôt : candidatures ouvertes à partir de ${monthLabel(c.nextWeek - DECLARE_WINDOW)}` };
  if (left <= ELECTIONS.presidentielle.campaignMonths + 1) return { ok: false, reason: 'Dépôt des candidatures clos' };
  if (d.player.stats.popularity < 12) return { ok: false, reason: 'Popularité 12 au moins : personne ne vous connaît' };
  return { ok: true };
}

/** Le bouton « Se déclarer candidat·e à la présidence » */
export function declareCandidacy(d: GameState): string[] {
  if (!canDeclare(d).ok) return [];
  const c = d.presidential;
  const p = d.player;
  c.declared = true;
  c.declaredWeek = d.week;
  const leads = d.party.leaderNpcId === 'player';
  const official = leads || p.rankId === 'candidat_presidence' || p.rankId === 'ancien_president' || !!d.presidency;
  const out: string[] = ['Candidature déclarée'];
  if (official) {
    c.parrainages += 150;
    out.push('Parrainages +150 (appareil du parti)');
  } else {
    // Candidature dissidente : le parti a déjà son champion
    const leader = d.npcs.find(n => n.id === d.party.leaderNpcId);
    d.party.cohesion = clamp(d.party.cohesion - 8);
    for (const f of d.party.factions) f.supportForPlayer = clamp(f.supportForPlayer - 6);
    if (leader) leader.relationToPlayer = clamp(leader.relationToPlayer - 25, -100, 100);
    out.push('Candidature dissidente : le parti grince');
  }
  p.momentum = clamp(p.momentum + 10);
  p.stats.popularity = clamp(p.stats.popularity + 3);
  p.stats.stress = clamp(p.stats.stress + 6);
  p.flags['menace'] = Number(p.flags['menace'] ?? 0) + 5;
  addMilestone(d, 'carriere', d.presidency ? 'Candidat·e à sa propre succession' : 'Candidat·e à l’Élysée',
    `${p.name} annonce sa candidature à l’élection présidentielle de ${monthLabel(c.nextWeek)}.`);
  pushNews(d, 'election', 'positive', `${p.name} candidat·e à l’élection présidentielle`,
    `Il faut ${PARRAINAGES_REQUIRED} parrainages d’élus avant ${monthLabel(campaignOpensAt(d))}. ${official ? 'Le parti se met en ordre de bataille.' : 'Votre parti avait déjà son candidat : la guerre est déclarée.'}`);
  return out;
}

export function addParrainages(d: GameState, delta: number): string[] {
  const c = d.presidential;
  if (!c.declared) return [];
  const before = c.parrainages;
  c.parrainages = Math.max(0, c.parrainages + delta);
  return [`Parrainages ${c.parrainages - before >= 0 ? '+' : ''}${c.parrainages - before} (${Math.min(c.parrainages, PARRAINAGES_REQUIRED)}/${PARRAINAGES_REQUIRED})`];
}

/** Parrainages recueillis chaque mois : réseau d'élus, appareil du parti */
export function weeklyParrainages(d: GameState): number {
  const p = d.player;
  const leads = d.party.leaderNpcId === 'player' || p.rankId === 'candidat_presidence' || p.rankId === 'ancien_president' || !!d.presidency;
  return Math.round(2.5 * (4 + p.stats.influence * 0.25 + (leads ? 22 : 0) + rankOrder(p.rankId) * 3 + (partySupport(d) - 50) * 0.2));
}

// ── Calendrier ────────────────────────────────────────────

export function weeklyPresidential(d: GameState, rng: Rng): void {
  const c = d.presidential;
  if (d.player.flags['monarchie'] || d.status !== 'en_cours') return;
  const opens = campaignOpensAt(d);

  if (c.declared && d.week < opens) {
    const before = c.parrainages;
    c.parrainages += Math.max(0, weeklyParrainages(d));
    if (before < PARRAINAGES_REQUIRED && c.parrainages >= PARRAINAGES_REQUIRED) {
      pushNews(d, 'election', 'positive', `${PARRAINAGES_REQUIRED} parrainages réunis`, 'Le Conseil constitutionnel validera votre candidature à l’ouverture de la campagne.');
    }
  }

  // La veille de l'ouverture de la campagne : validation des candidatures
  if (d.week === opens - 1 && !d.elections.some(e => !e.resolved && e.type === 'presidentielle')) {
    if (c.declared && c.parrainages >= PARRAINAGES_REQUIRED) openPresidentialCampaign(d, opens);
    else if (c.declared) {
      c.declared = false;
      d.player.stats.stress = clamp(d.player.stats.stress + 10);
      d.player.stats.credibility = clamp(d.player.stats.credibility - 4);
      addMilestone(d, 'revers', 'Candidature invalidée', `Seulement ${c.parrainages} parrainages sur ${PARRAINAGES_REQUIRED}. Le Conseil constitutionnel écarte ${d.player.name} de la course.`);
      pushNews(d, 'election', 'negative', 'Candidature rejetée faute de parrainages', `${c.parrainages} / ${PARRAINAGES_REQUIRED}. Il faudra attendre cinq ans.`);
      c.parrainages = 0;
    } else if (d.presidency) {
      pushNews(d, 'election', 'neutral', 'Le président ne se représente pas', 'Vous ne briguerez pas de nouveau mandat. La succession est ouverte.');
    }
  }

  // Jour du scrutin sans le joueur : les autres se disputent l'Élysée
  if (d.week >= c.nextWeek && !d.elections.some(e => !e.resolved && e.type === 'presidentielle')) {
    npcPresidential(d, rng);
  }
}

function openPresidentialCampaign(d: GameState, opens: number): void {
  const c = d.presidential;
  // Les autres scrutins en cours sont reportés après la présidentielle
  for (const e of d.elections.filter(x => !x.resolved)) e.resolved = true;
  d.elections = d.elections.filter(e => e.result || e.type === 'presidentielle');
  d.player.flags['nextElectionWeek'] = c.nextWeek + 1;
  const election: ScheduledElection = {
    id: nextId(d, 'elec'), type: 'presidentielle', campaignStartWeek: opens, week: c.nextWeek,
    candidateIds: ['player', ...presidentialRivals(d)], resolved: false,
  };
  d.elections.push(election);
  if (!d.presidency && rankOrder(d.player.rankId) < rankOrder('candidat_presidence')) {
    c.prevRank = d.player.rankId;
    applyEffects(d, [{ kind: 'rank', rankId: 'candidat_presidence' }], {}, new Rng(d));
  } else if (!d.presidency) {
    c.prevRank ??= 'chef_parti';
  }
  // Nouveau programme à écrire pour cette campagne
  d.program = null;
  pushNews(d, 'election', 'positive', 'Candidature validée par le Conseil constitutionnel',
    `Vous figurez sur la liste officielle. Premier tour ${inMonth(c.nextWeek)}.`);
}

/** Adversaires : chefs des autres partis, président sortant, et le chef de votre parti si vous êtes dissident·e */
export function presidentialRivals(d: GameState): string[] {
  const c = d.presidential;
  const ids = d.npcs
    .filter(n => n.partyId !== d.party.id && n.rankId === 'chef_parti')
    .sort((a, b) => b.influence - a.influence)
    .slice(0, 3)
    .map(n => n.id);
  if (c.incumbentId && c.incumbentId !== 'player' && c.incumbentMandates < 2 && !ids.includes(c.incumbentId)) ids.unshift(c.incumbentId);
  const ownLeader = d.party.leaderNpcId;
  if (ownLeader !== 'player' && d.player.rankId !== 'candidat_presidence' && !d.presidency && !ids.includes(ownLeader)) ids.push(ownLeader);
  return ids.slice(0, 5);
}

/** Bonus électoral du sortant (ou malus s'il est impopulaire) */
export function incumbentBonus(d: GameState, id: string): number {
  if (id === 'player') return d.presidency ? (d.presidency.approval - 40) * 0.25 : 0;
  return id === d.presidential.incumbentId ? 4 : 0;
}

/** Scrutin sans le joueur */
function npcPresidential(d: GameState, rng: Rng): void {
  const c = d.presidential;
  const parties = [d.party, ...d.otherParties];
  const pool = d.npcs.filter(n => n.rankId === 'chef_parti' || (n.id === c.incumbentId && c.incumbentMandates < 2));
  const scored = pool.map(n => {
    const governing = n.partyId === c.incumbentPartyId ? 4 : 0;
    const center = Math.abs(parties.find(p => p.id === n.partyId)?.position ?? 0) * 0.08;
    return { n, score: Math.max(1, n.popularity * 0.55 + n.influence * 0.25 + governing + incumbentBonus(d, n.id) - center) ** 2 * rng.range(0.85, 1.15) };
  }).sort((a, b) => b.score - a.score);
  const winner = scored[0]?.n;
  const wasPlayer = !!d.presidency;
  if (wasPlayer) endPresidency(d, 'fin');
  if (!winner) { c.nextWeek += MANDATE_MONTHS; return; }
  const again = winner.id === c.incumbentId;
  const formerParty = c.incumbentPartyId;
  c.incumbentId = winner.id;
  c.incumbentName = winner.name;
  c.incumbentMandates = again ? c.incumbentMandates + 1 : 1;
  c.incumbentPartyId = winner.partyId;
  winner.influence = clamp(winner.influence + 10);
  c.nextWeek += MANDATE_MONTHS;
  c.declared = false;
  c.parrainages = 0;
  const party = parties.find(p => p.id === winner.partyId);
  pushNews(d, 'election', winner.partyId === d.party.id ? 'positive' : 'neutral',
    `${winner.name} ${again ? 'réélu·e' : 'élu·e'} président·e de la République`,
    `${party ? `Victoire ${ofParty(party.name)}. ` : ''}Prochaine élection présidentielle ${inMonth(c.nextWeek)}.`);
  alternance(d, formerParty);
}

/** Changement de majorité : un·e ministre d'un parti battu quitte le gouvernement */
function alternance(d: GameState, formerParty?: string): void {
  const c = d.presidential;
  if (c.incumbentPartyId === d.party.id || formerParty === c.incumbentPartyId) return;
  if (d.player.rankId === 'premier_ministre') {
    fallFromMatignon(d, 'Alternance : vous quittez Matignon', 'Votre camp a perdu l’Élysée. Le nouveau président nomme son Premier ministre.');
  } else if (d.player.rankId === 'ministre') {
    d.player.rankId = 'depute';
    d.player.actionPoints.max = RANKS.depute.monthlyActionPoints;
    pushNews(d, 'parti', 'negative', 'Alternance : vous quittez le gouvernement', 'Votre camp a perdu l’Élysée. Retour sur les bancs de l’Assemblée, dans l’opposition.');
  }
}

/** Résultat d'une présidentielle où le joueur était candidat·e */
export function presidentialResult(d: GameState, e: ScheduledElection, winnerId: string, score: number, rng: Rng): void {
  const c = d.presidential;
  c.nextWeek = e.week + MANDATE_MONTHS;
  c.declared = false;
  c.parrainages = 0;
  const p = d.player;
  if (winnerId === 'player') {
    const reelected = !!d.presidency;
    if (d.presidency) {
      d.presidency.mandates += 1;
      d.presidency.since = d.week;
      d.presidency.approval = clamp(50 + (score - 50) * 0.6);
      makePledges(d);
    } else {
      applyEffects(d, [{ kind: 'rank', rankId: 'president' }, { kind: 'stat', stat: 'influence', delta: 12 }, { kind: 'stat', stat: 'popularity', delta: 6 }, { kind: 'stat', stat: 'politicalCapital', delta: 25 }], {}, rng);
      startPresidency(d, score, rng);
    }
    p.flags['presMandates'] = Number(p.flags['presMandates'] ?? 0) + 1;
    c.incumbentId = 'player';
    c.incumbentName = p.name;
    c.incumbentMandates = d.presidency!.mandates;
    c.incumbentPartyId = d.party.id;
    c.prevRank = undefined;
    addMilestone(d, 'victoire', reelected ? 'Réélu·e président·e de la République' : 'Élu·e président·e de la République',
      `${fr(score)} % des voix au second tour. ${reelected ? 'Cinq ans de plus à l’Élysée.' : 'Passation de pouvoirs dans les jours qui viennent.'}`);
    pushNews(d, 'election', 'positive', reelected ? `${p.name} réélu·e avec ${fr(score)} %` : `${p.name} élu·e président·e de la République avec ${fr(score)} %`,
      `Premier ministre : ${d.presidency!.primeMinister}. ${d.presidency!.cohabitation ? 'Les législatives vous privent de majorité : cohabitation.' : `Majorité à l’Assemblée : ${Math.round(d.presidency!.majority)} %.`}`);
  } else {
    const winner = d.npcs.find(n => n.id === winnerId);
    const formerParty = c.incumbentPartyId;
    if (d.presidency) {
      addMilestone(d, 'revers', 'Battu·e en président·e sortant·e', `${fr(score)} % des voix : les Français tournent la page.`);
      endPresidency(d, 'defaite');
    } else {
      const back = c.prevRank ?? 'chef_parti';
      p.rankId = back;
      p.actionPoints.max = RANKS[back].monthlyActionPoints;
      addMilestone(d, 'revers', 'Battu·e à la présidentielle', `${fr(score)} % des voix face à ${winner?.name ?? 'votre adversaire'}. Prochaine chance dans cinq ans.`);
    }
    p.stats.popularity = clamp(p.stats.popularity - 6);
    p.stats.influence = clamp(p.stats.influence - 4);
    p.stats.stress = clamp(p.stats.stress + 15);
    pushNews(d, 'election', 'negative', `Défaite à l’élection présidentielle (${fr(score)} %)`, `${winner?.name ?? 'Votre adversaire'} s’installe à l’Élysée. Prochain scrutin ${inMonth(c.nextWeek)}.`);
    c.prevRank = undefined;
    if (winner) {
      c.incumbentMandates = c.incumbentId === winner.id ? c.incumbentMandates + 1 : 1;
      c.incumbentId = winner.id;
      c.incumbentName = winner.name;
      c.incumbentPartyId = winner.partyId;
      winner.influence = clamp(winner.influence + 10);
    }
    alternance(d, formerParty);
  }
}

// ── Présidence ────────────────────────────────────────────

export function startPresidency(d: GameState, score: number, rng: Rng): void {
  const majority = clamp(46 + (score - 50) * 0.8 + rng.range(-9, 9));
  d.presidency = {
    since: d.week, mandates: 1,
    approval: clamp(52 + (score - 50) * 0.6), majority,
    security: 60, threat: 30, primeMinister: rng.pick(PRIME_MINISTERS), reforms: 0,
    cohabitation: majority < 40, lastCrisisWeek: d.week,
  };
  d.party.leaderNpcId = d.party.founder ? 'player' : d.party.leaderNpcId;
  d.player.flags['menace'] = 0;
  // Premier acte du mandat : nommer son gouvernement
  if (!d.presidency.cohabitation) d.pendingDecisions.push(pmDecision(d));
  // Le programme de campagne devient une liste d'engagements
  makePledges(d);
}

/** Fin de présidence : terme du mandat, défaite, démission ou destitution */
export function endPresidency(d: GameState, why: 'fin' | 'defaite' | 'demission' | 'destitution'): void {
  const pr = d.presidency;
  if (!pr) return;
  // Sur le trône : démissionner, c'est abdiquer ; être destitué, c'est la révolution
  if (d.kingdom) {
    if (why === 'demission' || why === 'destitution') restoreRepublic(d, why === 'destitution');
    return;
  }
  const p = d.player;
  d.presidency = null;
  p.rankId = 'ancien_president';
  p.actionPoints.max = RANKS.ancien_president.monthlyActionPoints;
  p.actionPoints.current = Math.min(p.actionPoints.current, p.actionPoints.max);
  p.stats.stress = clamp(p.stats.stress - 20);
  p.flags['reformsTotal'] = Number(p.flags['reformsTotal'] ?? 0);
  if (why === 'fin') {
    addMilestone(d, 'carriere', 'Fin de mandat', `${pr.mandates > 1 ? 'Dix' : 'Cinq'} ans à l’Élysée, ${p.flags['reformsTotal']} réforme${Number(p.flags['reformsTotal']) > 1 ? 's' : ''}. Cote de confiance finale : ${Math.round(pr.approval)} %.`);
    pushNews(d, 'systeme', 'neutral', 'Passation de pouvoirs', 'Vous quittez l’Élysée. Une vie d’ancien·ne président·e commence : conférences, mémoires, fondation.');
  }
  if (why === 'demission' || why === 'destitution') {
    // Élection anticipée sous 35 jours ; l'intérim est assuré par le président du Sénat
    const c = d.presidential;
    c.nextWeek = d.week + 2;
    c.incumbentId = null;
    c.incumbentName = 'le président du Sénat (intérim)';
    c.incumbentMandates = 2;
    c.declared = false;
    c.parrainages = 0;
    addMilestone(d, 'revers', why === 'demission' ? 'Démission de la présidence' : 'Destitué·e par le Parlement',
      why === 'demission' ? 'Vous quittez l’Élysée avant le terme. Élection anticipée dans deux mois.' : 'La Haute Cour prononce votre destitution (article 68). Une première sous la Ve République.');
  }
}

export function adjustPresidency(d: GameState, e: Extract<Effect, { kind: 'presidency' }>, rng: Rng): string[] {
  const pr = d.presidency;
  if (!pr) return [];
  const out: string[] = [];
  const sign = (n: number) => frSigned(n);
  if (e.approval) { pr.approval = clamp(pr.approval + e.approval); out.push(`Cote de confiance ${sign(e.approval)}`); }
  if (e.majority) { pr.majority = clamp(pr.majority + e.majority); out.push(`Majorité ${sign(e.majority)}`); }
  if (e.security) { pr.security = clamp(pr.security + e.security); out.push(`Sécurité ${sign(e.security)}`); }
  if (e.threat) { pr.threat = clamp(pr.threat + e.threat); out.push(`Menace ${sign(e.threat)}`); }
  if (e.reform) {
    // Sans majorité, une réforme a de bonnes chances d'être rejetée
    const pass = e.force || pr.majority >= 50 || rng.chance(Math.max(0.1, pr.majority / 55));
    if (pass) {
      pr.reforms += 1;
      d.player.flags['reformsTotal'] = Number(d.player.flags['reformsTotal'] ?? 0) + 1;
      recordLaw(d, `La réforme ${DOMAIN_LABELS[d.agendaDomain].toLowerCase()} de ${yearOf(d.week)}`, d.agendaDomain);
      out.push(`Réforme adoptée (${pr.reforms})`);
    } else {
      pr.approval = clamp(pr.approval - 3);
      pr.majority = clamp(pr.majority - 3);
      out.push('Réforme rejetée par l’Assemblée');
    }
  }
  if (e.pmName || e.cabinet) out.push(...applyAppointment(d, e, rng));
  if (e.pm) {
    const before = pr.primeMinister;
    pr.primeMinister = rng.pick(PRIME_MINISTERS.filter(n => n !== before));
    out.push(`Nouveau Premier ministre : ${pr.primeMinister}`);
  }
  if (e.dissolve) {
    const result = clamp(pr.approval + 8 + rng.range(-16, 16));
    pr.majority = result;
    const was = pr.cohabitation;
    pr.cohabitation = result < 40;
    if (pr.cohabitation) pr.primeMinister = rng.pick(PRIME_MINISTERS.filter(n => n !== pr.primeMinister));
    out.push(`Législatives anticipées : ${Math.round(result)} % pour votre camp${pr.cohabitation ? ' — cohabitation' : was ? ' — fin de la cohabitation' : ''}`);
    pushNews(d, 'election', pr.cohabitation ? 'negative' : 'positive', 'Résultat des législatives anticipées',
      pr.cohabitation ? `Le pays vous désavoue. ${pr.primeMinister}, issu·e de l’opposition, s’installe à Matignon.` : 'Le pays vous donne une majorité pour gouverner.');
  }
  return out;
}

function decision(d: GameState, tag: string, title: string, context: string, choices: DecisionChoice[]): Decision {
  return { id: nextId(d, 'dec'), tag, week: d.week, deadlineWeek: d.week + 1, source: 'carriere', title, context, choices };
}

const pending = (d: GameState, tag: string) => d.pendingDecisions.some(x => x.tag === tag);
const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
const pr = (x: Omit<Extract<Effect, { kind: 'presidency' }>, 'kind'>): Effect => ({ kind: 'presidency', ...x });

interface Crisis {
  tag: string;
  weight: number;
  eligible?: (d: GameState) => boolean;
  build: (d: GameState, rng: Rng) => Decision;
}

/** Crises et grands rendez-vous du quinquennat */
const CRISES: Crisis[] = [
  {
    tag: 'pres_attentat', weight: 1.2,
    build: (d, rng) => decision(d, 'pres_attentat', 'Attentat terroriste', `Une explosion en plein centre de ${rng.pick(['Lyon', 'Marseille', 'Lille', 'Toulouse', 'Strasbourg'])}. Le pays a les yeux tournés vers vous.`, [
      { id: 'urgence', label: 'Décréter l’état d’urgence', effects: [pr({ approval: 7, security: 10, threat: -12 }), { kind: 'stance', delta: 6 }, { kind: 'faction', factionId: 'reformistes', delta: -5 }, st('stress', 8)], outcome: 'Perquisitions, assignations : le pays se serre derrière vous. Les défenseurs des libertés s’inquiètent.' },
      { id: 'unite', label: 'Un discours d’unité nationale', effects: [pr({ approval: 5, threat: -4 }), st('credibility', 3), st('stress', 5)], outcome: 'Votre allocution est saluée jusque dans l’opposition.' },
      { id: 'riposte', label: 'Frapper les commanditaires à l’étranger', effects: [pr({ approval: 9, threat: 8 }), { kind: 'dossier', domain: 'securite', delta: 6 }, st('stress', 10)], outcome: 'Les frappes sont annoncées au journal de 20 h.',
        risk: { baseChance: 0.3, onFailure: [pr({ approval: -8, threat: 15 }), st('credibility', -5)], failureNews: 'Une frappe touche un convoi civil. La riposte se retourne contre vous.' } },
    ]),
  },
  {
    tag: 'pres_pandemie', weight: 0.6,
    build: d => decision(d, 'pres_pandemie', 'Une épidémie se propage', 'Les hôpitaux saturent dans trois régions. Le conseil scientifique attend votre arbitrage.', [
      { id: 'confiner', label: 'Confiner le pays', effects: [pr({ approval: -4, majority: -3 }), { kind: 'dossier', domain: 'sante', delta: 8 }, st('credibility', 4), st('stress', 10)], outcome: 'Rues vides, économie à l’arrêt, courbe qui s’infléchit.' },
      { id: 'vacciner', label: 'Campagne de vaccination massive', effects: [pr({ approval: 3 }), { kind: 'dossier', domain: 'sante', delta: 5 }, st('politicalCapital', -12), st('stress', 6)], outcome: 'Des centres ouvrent partout.',
        risk: { baseChance: 0.3, onFailure: [pr({ approval: -7 }), st('credibility', -5)], failureNews: 'Pénurie de doses : la campagne patine, la colère monte.' } },
      { id: 'laisser', label: 'Éviter les mesures contraignantes', effects: [pr({ approval: 2, majority: 2 }), { kind: 'dossier', domain: 'economie', delta: 3 }], outcome: 'Les commerces restent ouverts.',
        risk: { baseChance: 0.5, onFailure: [pr({ approval: -12 }), st('credibility', -8)], failureNews: 'Les morts se comptent par milliers. On vous accuse d’avoir laissé faire.' } },
    ]),
  },
  {
    tag: 'pres_greve', weight: 1,
    eligible: d => (d.presidency?.reforms ?? 0) > 0,
    build: d => decision(d, 'pres_greve', 'Grève générale', 'Les syndicats bloquent le pays contre votre dernière réforme. Raffineries, trains, écoles : tout s’arrête.', [
      { id: 'reculer', label: 'Retirer la réforme', effects: [pr({ approval: 4, majority: -4 }), st('credibility', -6), { kind: 'faction', factionId: 'ligne_dure', delta: 4 }], outcome: 'La rue a gagné. Vos soutiens les plus durs aussi, curieusement.' },
      { id: 'tenir', label: 'Tenir bon', effects: [pr({ approval: -6, threat: 6 }), st('credibility', 4), st('stress', 10)], outcome: 'Six semaines de conflit. La réforme passe, la colère reste.' },
      { id: 'negocier', label: 'Ouvrir une grande négociation', effects: [pr({ approval: 2 }), st('politicalCapital', -15), { kind: 'contact', contactId: 'ct-ust', trust: 8 }], outcome: 'Les partenaires sociaux s’assoient à la table.' },
    ]),
  },
  {
    tag: 'pres_diplo', weight: 1,
    build: (d, rng) => decision(d, 'pres_diplo', 'Crise diplomatique', `${rng.pick(['Un pays voisin', 'Une puissance étrangère', 'Un allié historique'])} expulse nos diplomates après un incident à la frontière. Les chancelleries s’agitent.`, [
      { id: 'sanctions', label: 'Sanctions et rappel de l’ambassadeur', effects: [pr({ approval: 4 }), { kind: 'dossier', domain: 'diplomatie', delta: 4 }, st('influence', -2)], outcome: 'Fermeté saluée, commerce extérieur pénalisé.' },
      { id: 'mediation', label: 'Proposer une médiation européenne', effects: [st('influence', 6), { kind: 'dossier', domain: 'diplomatie', delta: 6 }, pr({ approval: -2 }), st('energy', -10)], outcome: 'Trois jours de navette diplomatique. Vous passez pour un·e homme ou femme d’État.' },
      { id: 'force', label: 'Déployer des troupes à la frontière', effects: [pr({ approval: 7, threat: 6 }), { kind: 'stance', delta: 4 }], outcome: 'Démonstration de force.',
        risk: { baseChance: 0.35, onFailure: [pr({ approval: -10 }), st('credibility', -6)], failureNews: 'Un accrochage fait des victimes. L’escalade vous est reprochée.' } },
    ]),
  },
  {
    tag: 'pres_catastrophe', weight: 1,
    build: (d, rng) => decision(d, 'pres_catastrophe', 'Catastrophe naturelle', `${rng.pick(['Des inondations meurtrières dans le Sud-Ouest', 'Des incendies géants en Provence', 'Un séisme dans les Alpes-Maritimes'])}. Des dizaines de victimes.`, [
      { id: 'terrain', label: 'Se rendre sur place immédiatement', effects: [pr({ approval: 5 }), st('popularity', 3), st('energy', -15), { kind: 'health', delta: -2 }], outcome: 'Bottes aux pieds, au milieu des sinistrés.' },
      { id: 'fonds', label: 'Débloquer un fonds d’urgence', effects: [pr({ approval: 3, majority: -2 }), { kind: 'dossier', domain: 'territoires', delta: 5 }], outcome: 'Deux milliards annoncés, la Cour des comptes tousse.' },
      { id: 'pm', label: 'Envoyer le Premier ministre', effects: [pr({ approval: -4 }), st('energy', 5)], outcome: '« Où est le président ? » titre la presse régionale.' },
    ]),
  },
  {
    tag: 'pres_scandale', weight: 1,
    build: d => decision(d, 'pres_scandale', 'Scandale d’État', `Un proche conseiller de l’Élysée est mis en cause pour violences lors d’une manifestation. ${d.presidency?.primeMinister ?? 'Matignon'} demande des explications.`, [
      { id: 'limoger', label: 'Le limoger sur-le-champ', effects: [pr({ approval: -2 }), st('credibility', 4), st('stress', 4)], outcome: 'Réaction rapide. L’affaire s’éteint.' },
      { id: 'couvrir', label: 'Le couvrir', effects: [st('stress', 6)], outcome: 'Vous serrez les rangs.',
        risk: { baseChance: 0.55, onFailure: [pr({ approval: -12, majority: -6 }), st('credibility', -10), { kind: 'exposure', delta: 10 }], failureNews: 'Une vidéo accablante sort. Commission d’enquête au Sénat : l’affaire devient la vôtre.' } },
      { id: 'enquete', label: 'Demander une enquête de l’IGPN', effects: [pr({ approval: -4 }), st('credibility', 2)], outcome: 'L’enquête prendra des mois.' },
    ]),
  },
  {
    tag: 'pres_menace', weight: 1,
    eligible: d => (d.presidency?.threat ?? 0) >= 35,
    build: d => decision(d, 'pres_menace', 'Menace d’attentat contre vous', 'Le GSPR a intercepté des échanges : un projet d’attaque visant le chef de l’État lors d’un déplacement.', [
      { id: 'renforcer', label: 'Renforcer la protection, annuler les bains de foule', effects: [pr({ security: 22, approval: -2 }), st('popularity', -1)], outcome: 'Vitres blindées, parcours tenus secrets. Vous voilà loin des Français.' },
      { id: 'maintenir', label: 'Maintenir l’agenda : ne pas céder à la peur', effects: [pr({ approval: 4, threat: 10 }), st('credibility', 3), st('stress', 8)], outcome: 'Vous serrez des mains, sous l’œil inquiet de vos gardes du corps.' },
      { id: 'dgsi', label: 'Faire démanteler le réseau', effects: [pr({ threat: -18 }), { kind: 'dossier', domain: 'securite', delta: 4 }, st('politicalCapital', -10)], outcome: 'Six interpellations à l’aube.',
        risk: { baseChance: 0.25, onFailure: [pr({ threat: 8 })], failureNews: 'Le coup de filet rate le principal suspect.' } },
    ]),
  },
  {
    tag: 'pres_tentative', weight: 0.8,
    eligible: d => (d.presidency?.threat ?? 0) >= 45,
    build: (d) => {
      const sec = d.presidency?.security ?? 50;
      const lethal = Math.max(0.02, 0.22 * (1 - sec / 100));
      return decision(d, 'pres_tentative', 'Un homme armé dans la foule', 'Lors d’un déplacement, un individu sort une arme à quelques mètres de vous. Votre officier de sécurité vous agrippe le bras.', [
        { id: 'obeir', label: 'Se laisser évacuer immédiatement', effects: [pr({ approval: 2, security: 6, threat: -10 }), st('stress', 15), { kind: 'health', delta: -3 }], outcome: 'Plaqué·e dans la voiture blindée. Le tireur est maîtrisé.',
          risk: { baseChance: lethal / 3, onFailure: [{ kind: 'die', cause: 'assassinat', text: 'Touché·e par une balle pendant l’évacuation, lors d’un déplacement en province. Le pays est en deuil.' }], failureNews: 'Le coup de feu part avant la voiture.' } },
        { id: 'rester', label: 'Rester face à la foule pour la rassurer', effects: [pr({ approval: 12, threat: -6 }), st('popularity', 6), st('stress', 20)], outcome: 'Images historiques : vous ne cillez pas. Le tireur est désarmé par la foule.',
          risk: { baseChance: lethal, onFailure: [{ kind: 'die', cause: 'assassinat', text: 'Abattu·e face à la foule qu’il·elle voulait rassurer. L’image fera le tour du monde.' }], failureNews: 'Le tireur fait feu.' } },
      ]);
    },
  },
  {
    tag: 'pres_censure', weight: 0,
    build: d => decision(d, 'pres_censure', 'Motion de censure', `L’opposition dépose une motion de censure contre le gouvernement de ${d.presidency?.primeMinister}. Les voix manquent.`, [
      { id: 'sacrifier', label: 'Sacrifier le Premier ministre', effects: [pr({ pm: true, majority: 8, approval: -2 }), st('politicalCapital', -10)], outcome: 'Nouveau gouvernement, nouvel élan… pour quelques mois.' },
      { id: 'negocier', label: 'Négocier avec un groupe charnière', effects: [pr({ majority: 10 }), st('politicalCapital', -20), { kind: 'stance', delta: -3 }], outcome: 'La motion échoue à douze voix près.' },
      { id: 'dissoudre', label: 'Dissoudre l’Assemblée', effects: [pr({ dissolve: true }), st('stress', 10)], outcome: 'Retour aux urnes dans trois semaines.' },
    ]),
  },
  {
    tag: 'pres_destitution', weight: 0,
    build: d => decision(d, 'pres_destitution', 'Procédure de destitution', 'Le Parlement réuni en Haute Cour examine votre destitution (article 68) pour « manquement à vos devoirs ». Le vote a lieu ce mois-ci.', [
      { id: 'convaincre', label: 'Plaider devant la Haute Cour', effects: [pr({ approval: 4, majority: 6 }), st('stress', 15)], outcome: 'La majorité des deux tiers n’est pas atteinte. Vous sauvez votre fauteuil.',
        risk: { baseChance: 0.45, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [{ kind: 'resign', why: 'destitution' }], failureNews: 'La Haute Cour vote la destitution.' } },
      { id: 'demission', label: 'Démissionner avec dignité', effects: [{ kind: 'resign' }, st('credibility', 4)], outcome: 'Vous quittez l’Élysée avant d’en être chassé·e.' },
    ]),
  },
  {
    tag: 'pres_sommet', weight: 1,
    build: (d, rng) => decision(d, 'pres_sommet', `Sommet du ${rng.pick(['G7', 'G20', 'Conseil européen'])}`, 'Les grands de ce monde se retrouvent. Votre place sur la photo de famille dira votre poids.', [
      { id: 'leader', label: 'Porter une grande initiative', effects: [st('influence', 6), { kind: 'dossier', domain: 'diplomatie', delta: 6 }, pr({ approval: 2 }), st('energy', -12), st('stress', 6)], outcome: 'Votre proposition fait la une internationale.',
        risk: { baseChance: 0.3, scaleWith: 'influence', scaleWeight: 0.6, onFailure: [st('influence', -4), pr({ approval: -3 })], failureNews: 'Vos partenaires enterrent poliment votre initiative.' } },
      { id: 'discret', label: 'Rester discret, défendre nos intérêts', effects: [{ kind: 'dossier', domain: 'economie', delta: 4 }, st('influence', 1), st('energy', -5)], outcome: 'Quelques accords commerciaux utiles.' },
      { id: 'boycott', label: 'Écourter pour rentrer gérer une crise', effects: [pr({ approval: 2 }), st('influence', -4)], outcome: 'Vos homologues le notent.' },
    ]),
  },
  {
    tag: 'pres_rumeur_sante', weight: 1,
    eligible: d => d.player.age >= 62 || d.player.health < 55,
    build: d => decision(d, 'pres_rumeur_sante', 'Rumeurs sur votre santé', `Un hebdomadaire s’interroge : « Le chef de l’État est-il en état de gouverner ? » Photos à l’appui${d.player.health < 50 ? ' — et elles ne sont pas flatteuses' : ''}.`, [
      { id: 'bulletin', label: 'Publier un bulletin de santé complet', effects: [st('credibility', 4), pr({ approval: d.player.health >= 55 ? 3 : -5 })], outcome: d.player.health >= 55 ? 'Le bulletin est rassurant.' : 'Le bulletin inquiète plus qu’il ne rassure.' },
      { id: 'sport', label: 'Se montrer en plein footing', effects: [pr({ approval: 3 }), { kind: 'health', delta: -2 }, st('energy', -8)], outcome: 'Les images font taire les rumeurs… pour un temps.' },
      { id: 'dementir', label: 'Dénoncer une campagne de dénigrement', effects: [pr({ approval: -2 }), st('stress', 4)], outcome: 'Le soupçon demeure.' },
    ]),
  },
  {
    tag: 'pres_cohabitation', weight: 1.2,
    eligible: d => !!d.presidency?.cohabitation,
    build: d => decision(d, 'pres_cohabitation', 'Le Premier ministre vous défie', `${d.presidency?.primeMinister}, issu·e de l’opposition, annonce une réforme sans vous consulter.`, [
      { id: 'veto', label: 'Refuser de signer les ordonnances', effects: [pr({ approval: 3, majority: -4 }), st('stress', 6)], outcome: 'Crise institutionnelle. Les constitutionnalistes se régalent.' },
      { id: 'laisser', label: 'Laisser faire et préparer la suite', effects: [pr({ approval: -2 }), st('politicalCapital', 8)], outcome: 'Vous laissez Matignon s’user.' },
      { id: 'dissoudre', label: 'Dissoudre pour retrouver une majorité', effects: [pr({ dissolve: true }), st('stress', 10)], outcome: 'Les Français retournent aux urnes.' },
    ]),
  },
];

const CRISIS_TAGS = new Set(CRISES.map(c => c.tag));
export const isPresidentialDecision = (tag: string) => CRISIS_TAGS.has(tag);

export function weeklyPresidency(d: GameState, rng: Rng): void {
  const pres = d.presidency;
  if (!pres || d.status !== 'en_cours') return;
  const p = d.player;
  // Usure du pouvoir ; la cote de confiance tire la popularité, et inversement
  pres.approval = clamp(pres.approval - 0.3 + (p.stats.popularity - pres.approval) * 0.03);
  p.stats.popularity = clamp(p.stats.popularity + (pres.approval - p.stats.popularity) * 0.05);
  pres.majority = clamp(pres.majority + ((pres.cohabitation ? 33 : 46) + (pres.approval - 40) * 0.35 - pres.majority) * 0.04);
  pres.threat = clamp(pres.threat + (18 + (100 - pres.approval) * 0.22 - pres.threat) * 0.05);
  // La protection retombe vers son niveau de routine
  pres.security = clamp(pres.security + (45 - pres.security) * 0.03);
  // Une cohabitation prend fin si la majorité revient
  if (pres.cohabitation && pres.majority >= 50) pres.cohabitation = false;

  if (pres.majority < 30 && !pending(d, 'pres_censure') && rng.chance(0.2)) {
    d.pendingDecisions.push(CRISES.find(c => c.tag === 'pres_censure')!.build(d, rng));
    return;
  }
  if (pres.approval < 12 && pres.majority < 30 && !pending(d, 'pres_destitution') && rng.chance(0.12)) {
    d.pendingDecisions.push(CRISES.find(c => c.tag === 'pres_destitution')!.build(d, rng));
    return;
  }
  if (d.week - pres.lastCrisisWeek >= 3 && rng.chance(0.2)) {
    const pool = CRISES.filter(c => c.weight > 0 && (!c.eligible || c.eligible(d)) && !pending(d, c.tag)
      && d.week - Number(p.flags[`ev_${c.tag}`] ?? -99) >= 20);
    const total = pool.reduce((t, c) => t + c.weight, 0);
    let roll = rng.next() * total;
    const crisis = pool.find(c => (roll -= c.weight) < 0);
    if (crisis) {
      pres.lastCrisisWeek = d.week;
      p.flags[`ev_${crisis.tag}`] = d.week;
      d.pendingDecisions.push(crisis.build(d, rng));
    }
  }
}

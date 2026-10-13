import { AssemblyGroup, AssemblyVote, Ballot, Effect, GameState, VoteTally } from '../models/game.models';
import { BASE_SEATS, BILLS, BILLS_BY_ID, BillDef, NON_INSCRITS, SEATS } from '../data/bills';
import { DOMAIN_LABELS } from '../models/game.models';
import { applyEffects, pushNews } from './effects';
import { ENEMIES_BY_ID, startWar } from './war';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  L'Assemblée nationale vote sur l'actualité : chaque mois,
 *  un texte lié au sujet à la une peut être inscrit à l'ordre
 *  du jour. Député·e, vous votez (en suivant ou non la consigne
 *  du groupe) ; au gouvernement, vous défendez le texte ou
 *  donnez l'avis du gouvernement ; à la tête du parti, vous
 *  fixez la consigne. Le scrutin se joue groupe par groupe.
 * ============================================================ */

export const BALLOT_LABELS: Record<Ballot, string> = { pour: 'Pour', contre: 'Contre', abstention: 'Abstention' };

/** Rôle du joueur dans un scrutin (null : il ne siège pas) */
export function voteRole(d: GameState): AssemblyVote['role'] | null {
  const r = d.player.rankId;
  if (d.presidency?.cohabitation) return 'chef';
  if (d.presidency || r === 'premier_ministre' || r === 'ministre') return 'gouvernement';
  if (r === 'depute') return 'depute';
  if ((r === 'chef_parti' || r === 'candidat_presidence') && d.party.leaderNpcId === 'player') return 'chef';
  return null;
}

function inGovernment(d: GameState): boolean {
  return !!d.presidency || d.player.rankId === 'ministre' || d.player.rankId === 'premier_ministre';
}

/** Parti qui gouverne (et son allié le plus proche) */
export function governingIds(d: GameState): string[] {
  const parties = [d.party, ...d.otherParties];
  // Une coalition négociée remplace l'allié naturel
  if (inGovernment(d) && d.coalition && !d.presidency?.cohabitation) return [d.party.id, d.coalition.partyId];
  let lead = inGovernment(d) ? d.party.id : d.presidential.incumbentPartyId ?? d.party.id;
  if (d.presidency?.cohabitation) {
    // L'opposition tient l'Assemblée : le grand parti le plus éloigné de vous
    lead = [...d.otherParties].sort((a, b) => Math.abs(b.position - d.party.position) - Math.abs(a.position - d.party.position))[0]?.id ?? lead;
  }
  const leader = parties.find(p => p.id === lead) ?? d.party;
  const ally = parties.filter(p => p.id !== leader.id && (BASE_SEATS[p.id] ?? 0) > 0)
    .sort((a, b) => Math.abs(a.position - leader.position) - Math.abs(b.position - leader.position))[0];
  return ally ? [leader.id, ally.id] : [leader.id];
}

/** Composition de l'Assemblée, de la gauche vers la droite */
export function assemblyGroups(d: GameState): AssemblyGroup[] {
  const parties = [d.party, ...d.otherParties];
  const gov = governingIds(d);
  const base = (id: string) => BASE_SEATS[id] ?? (id === d.party.id && d.party.founder ? 6 + d.player.stats.popularity * 0.5 : 18);
  const raw = parties.map(p => ({ p, seats: base(p.id) * (p.id === gov[0] ? 1.35 : 1) }));
  const room = SEATS - NON_INSCRITS;
  // La majorité gouvernementale suit la jauge de majorité (Matignon, Élysée) ou tourne autour de 52 %
  const target = d.government ? d.government.majority : d.presidency ? d.presidency.majority : 52;
  const govRaw = raw.filter(x => gov.includes(x.p.id)).reduce((t, x) => t + x.seats, 0);
  const othRaw = raw.filter(x => !gov.includes(x.p.id)).reduce((t, x) => t + x.seats, 0);
  const govSeats = clamp(Math.round((target / 100) * SEATS), 60, room - 60);
  const groups: AssemblyGroup[] = raw.map(x => ({
    partyId: x.p.id, name: x.p.name, color: x.p.color, position: x.p.position, majority: gov.includes(x.p.id),
    seats: Math.max(1, Math.round(gov.includes(x.p.id) ? (x.seats / govRaw) * govSeats : (x.seats / othRaw) * (room - govSeats))),
  }));
  // Ajuste les arrondis sur le plus grand groupe
  const diff = room - groups.reduce((t, g) => t + g.seats, 0);
  groups.sort((a, b) => b.seats - a.seats)[0].seats += diff;
  groups.sort((a, b) => a.position - b.position);
  groups.push({ partyId: 'ni', name: 'Non-inscrits', color: '#9aa0a8', seats: NON_INSCRITS, position: 15, majority: false });
  return groups;
}

/** Penchant d'un groupe : > 0 pour, < 0 contre. « knowMood » : l'humeur cachée de la majorité est-elle connue ? */
function groupScore(d: GameState, v: AssemblyVote, g: AssemblyGroup, knowMood = true): number {
  // +0,5 pour un texte au cœur de sa ligne, 0 à 40 points d'écart, −0,5 à 80
  const ideology = (40 - Math.abs(v.lean - g.position)) / 80;
  let camp = v.origin === 'opposition' ? (g.majority ? -0.5 : 0.25) : (g.majority ? 0.62 : -0.4);
  // Avis du gouvernement sur une proposition de loi : la majorité suit
  if (v.role === 'gouvernement' && v.origin !== 'gouvernement' && v.playerBallot && g.majority) {
    camp = v.playerBallot === 'pour' ? 0.5 : v.playerBallot === 'contre' ? -0.5 : 0;
  }
  // Consigne fixée par le ou la chef·fe du parti
  if (v.role === 'chef' && v.playerBallot && g.partyId === d.party.id) {
    camp += v.playerBallot === 'pour' ? 0.8 : v.playerBallot === 'contre' ? -0.8 : 0;
  }
  if (v.warEnemy) camp += g.majority ? 0.15 : 0;
  // Le groupe soutient le texte de l'un des siens
  if (v.own && g.partyId === d.party.id) camp += 0.5;
  const opinion = (v.opinion - 50) / 100;
  const mood = g.majority && knowMood ? v.mood ?? 0 : 0;
  return ideology * 0.9 + camp + opinion * 0.5 + mood + v.swing / 100;
}

function probs(score: number): VoteTally {
  const p = 1 / (1 + Math.exp(-3.4 * score));
  const a = 0.06 + 0.3 * Math.exp(-8 * score * score);
  return { pour: p * (1 - a), contre: (1 - p) * (1 - a), abstention: a };
}

/** Consigne la plus probable du groupe du joueur */
function lineOf(t: VoteTally): Ballot {
  return t.pour >= t.contre && t.pour >= t.abstention ? 'pour' : t.contre >= t.abstention ? 'contre' : 'abstention';
}

export interface VoteForecast {
  tally: VoteTally;
  groups: { group: AssemblyGroup; tally: VoteTally; lean: Ballot }[];
  /** Marge d'erreur du pointage, en voix */
  margin: number;
  adoptedChance: number;
}

/** Pointage : ce que donnerait le vote aujourd'hui */
export function forecast(d: GameState, v: AssemblyVote, ballot?: Ballot): VoteForecast {
  const vv = ballot ? { ...v, playerBallot: ballot } : v;
  // Sans sondeur, on ignore l'humeur réelle de la majorité
  const knows = d.player.staff.includes('sondeur');
  const groups = assemblyGroups(d).map(group => {
    const p = probs(groupScore(d, vv, group, knows));
    return { group, lean: lineOf(p), tally: { pour: p.pour * group.seats, contre: p.contre * group.seats, abstention: p.abstention * group.seats } };
  });
  const tally = groups.reduce((t, g) => ({ pour: t.pour + g.tally.pour, contre: t.contre + g.tally.contre, abstention: t.abstention + g.tally.abstention }), { pour: 0, contre: 0, abstention: 0 });
  // Incertitude : le bruit des votes individuels, et (sans sondeur) l'humeur de la majorité
  const majoritySeats = groups.filter(g => g.group.majority).reduce((t, g) => t + g.group.seats, 0);
  const sd = Math.sqrt(groups.reduce((t, g) => t + g.group.seats * 0.2, 0)) + (knows ? 0 : majoritySeats * 0.12);
  const gap = tally.pour - tally.contre;
  const adoptedChance = clamp(0.5 + gap / (sd * 2.5), 0.02, 0.98);
  const margin = knows ? 5 : Math.round(majoritySeats * 0.12);
  return { tally, groups, margin, adoptedChance };
}

function recentlyVoted(d: GameState, id: string): boolean {
  return d.week - Number(d.player.flags[`bill_${id}`] ?? -99) < 30;
}

function pickBill(d: GameState, rng: Rng, origin: AssemblyVote['origin'], own = false): BillDef | undefined {
  const parties = [d.party, ...d.otherParties];
  const gov = governingIds(d);
  const groups = assemblyGroups(d);
  const opposition = groups.filter(g => !g.majority && g.partyId !== 'ni').sort((a, b) => b.seats - a.seats)[0];
  // Un texte du joueur colle à sa ligne ; sinon, à celle du camp qui le dépose
  const camp = own ? d.player.stance : origin === 'opposition' ? opposition?.position ?? 0 : parties.find(p => p.id === gov[0])?.position ?? 0;
  const domainPool = BILLS.filter(b => b.domain === d.agendaDomain && !recentlyVoted(d, b.id));
  const pool = domainPool.length ? domainPool : BILLS.filter(b => !recentlyVoted(d, b.id));
  if (!pool.length) return undefined;
  const weights = pool.map(b => Math.max(0.02, 1 - Math.abs(b.lean - camp) / 110) ** (own ? 4 : 2));
  let roll = rng.next() * weights.reduce((t, w) => t + w, 0);
  return pool.find((_, i) => (roll -= weights[i]) < 0) ?? pool[0];
}

/** Origine d'un texte déposé par le joueur : gouvernement, ou son groupe (majorité / opposition) */
export function ownOrigin(d: GameState): AssemblyVote['origin'] {
  if (inGovernment(d)) return 'gouvernement';
  return governingIds(d).includes(d.party.id) ? 'majorite' : 'opposition';
}

/** Inscrit un texte à l'ordre du jour (sujet à la une) */
export function scheduleVote(d: GameState, rng: Rng, billId?: string, forcedOrigin?: AssemblyVote['origin']): string[] {
  if (d.vote) return [];
  const role0 = voteRole(d);
  if (!role0) return [];
  const origin: AssemblyVote['origin'] = forcedOrigin
    ?? (role0 === 'gouvernement' ? (rng.chance(0.65) ? 'gouvernement' : 'opposition') : rng.pick(['gouvernement', 'gouvernement', 'opposition', 'majorite']));
  const own = !!forcedOrigin;
  const bill = billId ? BILLS_BY_ID.get(billId) : pickBill(d, rng, origin, own);
  if (!bill) return [];
  let role = role0;
  const mine = (origin !== 'opposition') === governingIds(d).includes(d.party.id);
  if (role === 'depute' && mine && (d.player.dossiers[bill.domain].mastery >= 55 || forcedOrigin)) role = 'rapporteur';
  const ownGroup = assemblyGroups(d).find(g => g.partyId === d.party.id);
  const v: AssemblyVote = {
    id: nextId(d, 'vote'), week: d.week, billId: bill.id, title: bill.title, summary: bill.summary, domain: bill.domain,
    lean: bill.lean, opinion: clamp(bill.opinion + rng.range(-6, 6)), origin, role, partyLine: 'pour', swing: 0, moves: [], status: 'debat',
    mood: Math.round(rng.range(-0.4, 0.3) * 100) / 100, ...(own ? { own: true } : {}),
  };
  v.partyLine = own ? 'pour' : ownGroup ? lineOf(probs(groupScore(d, v, ownGroup))) : 'abstention';
  // Les voix promises au téléphone se reportent sur un texte de votre camp
  const promised = Number(d.player.flags['billSupport'] ?? 0);
  if (promised && (own || mine)) {
    v.swing += v.partyLine === 'contre' ? -promised : promised;
    d.player.flags['billSupport'] = 0;
    pushNews(d, 'action', 'positive', 'Vos coups de fil paient', `${promised} voix promises au téléphone se reportent sur le texte.`);
  }
  d.vote = v;
  d.player.flags[`bill_${bill.id}`] = d.week;
  d.player.flags['lastVote'] = d.week;
  pushNews(d, 'actu', 'neutral', `À l’Assemblée : ${bill.title}`,
    `${origin === 'gouvernement' ? 'Projet de loi du gouvernement' : origin === 'majorite' ? 'Proposition de loi de la majorité' : 'Proposition de loi de l’opposition'} · ${DOMAIN_LABELS[bill.domain]}. Scrutin public ce mois-ci.`);
  return ['Scrutin inscrit à l’ordre du jour'];
}

/** Déclaration de guerre : le Parlement doit l'autoriser (article 35) */
export function scheduleWarVote(d: GameState, enemyId: string, rng: Rng): string[] {
  const e = ENEMIES_BY_ID.get(enemyId);
  if (!e || d.war) return [];
  if (d.vote) d.vote = null;
  const groups = assemblyGroups(d);
  const own = groups.find(g => g.partyId === d.party.id);
  const v: AssemblyVote = {
    id: nextId(d, 'vote'), week: d.week, billId: 'guerre', title: `Autorisation de la déclaration de guerre ${e.against}`,
    summary: `${e.casus} Le gouvernement demande au Parlement d’autoriser l’engagement des armées (article 35 de la Constitution).`,
    domain: 'diplomatie', lean: 25, opinion: clamp(38 + d.intl.tension / 3 + rng.range(-5, 5)), origin: 'gouvernement',
    role: voteRole(d) === 'chef' ? 'chef' : 'gouvernement', partyLine: 'pour', swing: 0, moves: [], status: 'debat', warEnemy: e.id,
    mood: Math.round(rng.range(-0.4, 0.2) * 100) / 100,
  };
  v.partyLine = own ? lineOf(probs(groupScore(d, v, own))) : 'pour';
  d.vote = v;
  pushNews(d, 'actu', 'negative', `Vers la guerre ${e.against} ?`, `Le Parlement est convoqué en urgence pour autoriser l’engagement des armées.`);
  return ['Le Parlement est convoqué (article 35)'];
}

// ── Avant le vote : interventions et tractations ──────────

export interface VoteMove {
  id: string;
  label: string;
  hint: string;
  ok: boolean;
  reason?: string;
}

export function voteMoves(d: GameState, v: AssemblyVote): VoteMove[] {
  const p = d.player;
  const mastery = p.dossiers[v.domain].mastery;
  const used = (id: string) => v.moves.includes(id);
  const moves: VoteMove[] = [];
  const speak = (id: string, label: string, hint: string) => moves.push({
    id, label, hint, ok: !used('parole') && p.stats.energy >= 10, reason: used('parole') ? 'Vous avez déjà parlé' : 'Trop épuisé·e',
  });
  if (v.role === 'gouvernement' && v.origin === 'gouvernement') {
    speak('defendre', 'Défendre le texte au banc du gouvernement', `Maîtrise du dossier : ${Math.round(mastery)}. Plus elle est haute, plus vous convainquez.`);
    moves.push({ id: 'amender', label: 'Accepter des amendements', hint: 'Le texte se recentre : quelques voix de plus, un peu de crédibilité en moins.', ok: !used('amender'), reason: 'Déjà fait' });
    moves.push({ id: 'negocier', label: 'Négocier avec un groupe charnière', hint: '15 de capital politique contre une dizaine de voix.', ok: !used('negocier') && p.stats.politicalCapital >= 15, reason: used('negocier') ? 'Déjà fait' : 'Capital politique insuffisant' });
    const canForce = (p.rankId === 'premier_ministre' || !!d.presidency) && !v.warEnemy;
    moves.push({ id: '493', label: 'Engager la responsabilité du gouvernement (49.3)', hint: 'Adopté sans vote… mais l’opposition déposera une motion de censure.', ok: canForce && !used('493'), reason: canForce ? 'Déjà fait' : 'Réservé à Matignon et à l’Élysée' });
    moves.push({ id: 'retirer', label: v.warEnemy ? 'Renoncer à la guerre' : 'Retirer le texte', hint: 'Éviter la défaite, au prix de la crédibilité.', ok: true });
  } else {
    speak('soutenir', 'Prendre la parole pour le texte', `Maîtrise du dossier : ${Math.round(mastery)}.`);
    speak('attaquer', 'Prendre la parole contre le texte', `Maîtrise du dossier : ${Math.round(mastery)}.`);
    moves.push({ id: 'negocier', label: v.role === 'chef' ? 'Rallier un groupe voisin à votre consigne' : 'Faire basculer des collègues', hint: '15 de capital politique contre une dizaine de voix, dans le sens de votre choix.', ok: !used('negocier') && p.stats.politicalCapital >= 15, reason: used('negocier') ? 'Déjà fait' : 'Capital politique insuffisant' });
  }
  return moves;
}

/** Joue une intervention ; direction : +1 pour le texte, -1 contre */
export function playMove(d: GameState, moveId: string, rng: Rng, direction: 1 | -1 = 1): string[] {
  const v = d.vote;
  if (!v || v.status !== 'debat') return [];
  const move = voteMoves(d, v).find(m => m.id === moveId);
  if (!move?.ok) return [];
  const p = d.player;
  const out: string[] = [];
  const mastery = p.dossiers[v.domain].mastery;
  const talent = (p.staff.includes('plume') ? 0.15 : 0) + (p.staff.includes('assistant_parlementaire') ? 0.15 : 0) + (v.role === 'rapporteur' ? 0.15 : 0);
  if (moveId === 'defendre' || moveId === 'soutenir' || moveId === 'attaquer') {
    v.moves.push('parole');
    const dir = moveId === 'attaquer' ? -1 : 1;
    const quality = clamp(mastery / 100 + p.stats.credibility / 250 + talent + 0.08 * (p.talents?.['orateur'] ?? 0) + rng.range(-0.2, 0.2), 0, 1.4);
    const swing = Math.round((2 + quality * 8)) * dir;
    v.swing += swing;
    out.push(...applyEffects(d, [{ kind: 'stat', stat: 'energy', delta: -10 }, { kind: 'dossier', domain: v.domain, delta: 2 },
      { kind: 'stat', stat: 'popularity', delta: quality > 0.7 ? 2 : quality < 0.35 ? -1 : 0.5 },
      ...(quality > 0.8 ? [{ kind: 'stat', stat: 'influence', delta: 2 } as Effect] : [])], { domain: v.domain }, rng));
    out.unshift(quality > 0.8 ? 'Discours remarqué : l’hémicycle applaudit' : quality < 0.35 ? 'Intervention laborieuse : on vous écoute à peine' : 'Intervention solide');
  } else if (moveId === 'negocier') {
    v.moves.push('negocier');
    const dir = v.role === 'gouvernement' && v.origin === 'gouvernement' ? 1 : direction;
    v.swing += (9 + Math.round(p.stats.influence / 15)) * dir;
    out.push(...applyEffects(d, [{ kind: 'stat', stat: 'politicalCapital', delta: -15 }], {}, rng), 'Quelques voix changent de camp');
  } else if (moveId === 'amender') {
    v.moves.push('amender');
    v.lean = Math.round(v.lean * 0.55);
    v.swing += 4;
    out.push(...applyEffects(d, [{ kind: 'stat', stat: 'credibility', delta: -1 }], {}, rng), 'Texte amendé : il se recentre');
  } else if (moveId === '493') {
    v.moves.push('493');
    out.push(...resolve493(d, rng));
  } else if (moveId === 'retirer') {
    out.push(...applyEffects(d, [{ kind: 'stat', stat: 'credibility', delta: v.warEnemy ? -6 : -3 }, { kind: 'stat', stat: 'influence', delta: -2 }], {}, rng));
    pushNews(d, 'actu', 'negative', v.warEnemy ? 'Le gouvernement renonce à la guerre' : `Le gouvernement retire son texte : ${v.title}`, 'Faute de majorité, mieux vaut reculer que perdre.');
    record(d, v, 'abstention', false, false);
    d.vote = null;
    out.push('Texte retiré');
  }
  return out;
}

function record(d: GameState, v: AssemblyVote, ballot: Ballot | '49.3', adopted: boolean, rebel: boolean): void {
  d.voteHistory = [{ week: d.week, title: v.title, ballot, adopted, rebel }, ...(d.voteHistory ?? [])].slice(0, 12);
}

function resolve493(d: GameState, rng: Rng): string[] {
  const v = d.vote!;
  const effects: Effect[] = [
    { kind: 'stat', stat: 'popularity', delta: -3 }, { kind: 'stat', stat: 'credibility', delta: -1 },
    { kind: 'faction', factionId: 'reformistes', delta: -3 },
  ];
  if (d.government) effects.push({ kind: 'government', majority: -5, cohesion: -3 });
  if (d.presidency) effects.push({ kind: 'presidency', approval: -3, majority: -4 });
  const summary = applyEffects(d, effects, {}, rng);
  const censure = rng.chance(clamp(0.12 + (45 - (d.government?.majority ?? d.presidency?.majority ?? 50)) / 100, 0.05, 0.6));
  v.status = 'resultat';
  v.playerBallot = 'pour';
  v.result = { tally: { pour: 0, contre: 0, abstention: 0 }, adopted: true, seats: [], groups: [], via: '49.3', summary: [] };
  if (censure) {
    if (d.government) summary.push(...applyEffects(d, [{ kind: 'government', fall: true }], {}, rng));
    else if (d.presidency) summary.push(...applyEffects(d, [{ kind: 'presidency', pm: true, majority: -6 }], {}, rng));
    summary.push('Motion de censure adoptée');
  } else summary.push('La motion de censure échoue');
  summary.push(...adoptedEffects(d, v, rng));
  v.result.summary = summary;
  record(d, v, '49.3', true, false);
  pushNews(d, 'actu', censure ? 'negative' : 'neutral', `49.3 : ${v.title} adopté sans vote`, censure ? 'Mais la motion de censure emporte le gouvernement.' : 'La motion de censure échoue. Le texte est adopté.');
  return summary;
}

/** Conséquences d'un texte adopté porté par le gouvernement */
function adoptedEffects(d: GameState, v: AssemblyVote, rng: Rng): string[] {
  if (v.origin !== 'gouvernement' || v.role !== 'gouvernement') return [];
  if (v.warEnemy) { startWar(d, v.warEnemy, true); return ['La France entre en guerre']; }
  const effects: Effect[] = [
    { kind: 'stat', stat: 'credibility', delta: 2 }, { kind: 'stat', stat: 'influence', delta: 2 },
    { kind: 'stat', stat: 'popularity', delta: Math.round((v.opinion - 50) / 10) },
    { kind: 'dossier', domain: v.domain, delta: 3 },
  ];
  if (d.government) effects.push({ kind: 'government', majority: 1 });
  if (d.presidency) {
    d.presidency.reforms += 1;
    d.player.flags['reformsTotal'] = Number(d.player.flags['reformsTotal'] ?? 0) + 1;
    effects.push({ kind: 'presidency', approval: Math.round((v.opinion - 50) / 12) });
  }
  return applyEffects(d, effects, { domain: v.domain }, rng);
}

/** Le scrutin : chaque député·e vote, le joueur aussi */
export function castVote(d: GameState, ballot: Ballot, rng: Rng): string[] {
  const v = d.vote;
  if (!v || v.status !== 'debat') return [];
  v.playerBallot = v.role === 'gouvernement' && v.origin === 'gouvernement' ? 'pour' : ballot;
  const groups = assemblyGroups(d);
  const seats: Ballot[] = [];
  const perGroup: NonNullable<AssemblyVote['result']>['groups'] = [];
  const tally: VoteTally = { pour: 0, contre: 0, abstention: 0 };
  const sits = v.role === 'depute' || v.role === 'rapporteur';
  for (const g of groups) {
    const p = probs(groupScore(d, v, g));
    const t: VoteTally = { pour: 0, contre: 0, abstention: 0 };
    for (let i = 0; i < g.seats; i++) {
      let b: Ballot;
      if (sits && g.partyId === d.party.id && i === 0) b = ballot;
      else {
        const r = rng.next();
        b = r < p.pour ? 'pour' : r < p.pour + p.contre ? 'contre' : 'abstention';
      }
      t[b] += 1;
    }
    // Dans l'hémicycle, chaque groupe : les « pour », les abstentions, les « contre »
    seats.push(...Array(t.pour).fill('pour'), ...Array(t.abstention).fill('abstention'), ...Array(t.contre).fill('contre'));
    perGroup.push({ partyId: g.partyId, name: g.name, color: g.color, seats: g.seats, tally: t });
    tally.pour += t.pour; tally.contre += t.contre; tally.abstention += t.abstention;
  }
  const adopted = tally.pour > tally.contre;
  const summary = consequences(d, v, ballot, adopted, tally, rng);
  v.status = 'resultat';
  v.result = { tally, adopted, seats, groups: perGroup, via: 'vote', summary };
  return summary;
}

function consequences(d: GameState, v: AssemblyVote, ballot: Ballot, adopted: boolean, tally: VoteTally, rng: Rng): string[] {
  const effects: Effect[] = [];
  const out: string[] = [];
  const margin = Math.abs(tally.pour - tally.contre);
  const won = v.playerBallot === 'pour' ? adopted : v.playerBallot === 'contre' ? !adopted : false;
  let rebel = false;
  if (v.role === 'depute' || v.role === 'rapporteur') {
    rebel = ballot !== v.partyLine;
    if (rebel) {
      effects.push({ kind: 'faction', factionId: '*', delta: -3 }, { kind: 'cohesion', delta: -2 }, { kind: 'stat', stat: 'influence', delta: 1 });
      d.player.flags['rebelVotes'] = Number(d.player.flags['rebelVotes'] ?? 0) + 1;
      out.push('Vous avez voté contre la consigne du groupe');
    } else {
      effects.push({ kind: 'faction', factionId: '*', delta: 1 }, { kind: 'cohesion', delta: 0.5 });
    }
    if (v.role === 'rapporteur') effects.push({ kind: 'stat', stat: 'credibility', delta: adopted && ballot === 'pour' ? 3 : 1 });
  }
  if (v.role === 'chef') {
    effects.push({ kind: 'stat', stat: 'influence', delta: won ? 2 : -1 });
  }
  // L'opinion juge votre vote
  if (v.role !== 'gouvernement' || v.origin !== 'gouvernement') {
    if (ballot === 'abstention') effects.push({ kind: 'stat', stat: 'credibility', delta: -0.5 });
    else {
      const favorable = ballot === 'pour' ? v.opinion : 100 - v.opinion;
      effects.push({ kind: 'stat', stat: 'popularity', delta: favorable >= 55 ? 1.5 : favorable <= 45 ? -1 : 0.3 });
    }
    if (ballot !== 'abstention') effects.push({ kind: 'stance', delta: Math.round((v.lean - d.player.stance) * (ballot === 'pour' ? 0.04 : -0.02)) });
  }
  effects.push({ kind: 'dossier', domain: v.domain, delta: 2 });
  if (won && margin <= 6) effects.push({ kind: 'stat', stat: 'influence', delta: 2 });
  out.push(...applyEffects(d, effects.filter(e => !('delta' in e) || e.delta !== 0), { domain: v.domain }, rng));

  // Texte du gouvernement : succès ou camouflet
  if (v.role === 'gouvernement' && v.origin === 'gouvernement') {
    if (adopted) out.push(...adoptedEffects(d, v, rng));
    else {
      const fail: Effect[] = [
        { kind: 'stat', stat: 'credibility', delta: v.warEnemy ? -6 : -4 }, { kind: 'stat', stat: 'influence', delta: -3 }, { kind: 'stat', stat: 'popularity', delta: -1 },
      ];
      if (d.government) fail.push({ kind: 'government', majority: -4, cohesion: -3 });
      if (d.presidency) fail.push({ kind: 'presidency', majority: -3, approval: -2 });
      out.push(...applyEffects(d, fail, {}, rng));
    }
  }
  // Guerre autorisée à l'initiative du parti du joueur (chef de parti)
  if (v.warEnemy && v.role === 'chef' && adopted) startWar(d, v.warEnemy, true);

  record(d, v, ballot, adopted, rebel);
  const close = margin <= 6 ? ` à ${margin} voix près` : '';
  pushNews(d, 'actu', adopted ? 'positive' : 'negative', `${v.title} : ${adopted ? 'adopté' : 'rejeté'}${close}`,
    `${tally.pour} pour, ${tally.contre} contre, ${tally.abstention} abstentions. Vous avez voté ${BALLOT_LABELS[ballot].toLowerCase()}${rebel ? ', contre la consigne de votre groupe' : ''}.`);
  return out;
}

/** Ferme le scrutin après l'affichage du résultat */
export function closeVote(d: GameState): void {
  if (d.vote?.status === 'resultat') d.vote = null;
}

/** En votre absence (projet au long cours), vous suivez la consigne du groupe */
export function autoVote(d: GameState, rng: Rng): boolean {
  const v = d.vote;
  if (!v || v.warEnemy || v.role === 'gouvernement' || v.role === 'chef') return false;
  castVote(d, v.partyLine, rng);
  d.vote = null;
  return true;
}

/** Chaque mois, l'actualité peut se retrouver à l'ordre du jour */
export function monthlyAssembly(d: GameState, rng: Rng): void {
  if (d.vote || d.status !== 'en_cours' || d.player.flags['retired']) return;
  const role = voteRole(d);
  if (!role) return;
  if (d.week - Number(d.player.flags['lastVote'] ?? -99) < 2) return;
  if (d.elections.some(e => !e.resolved && e.type === 'presidentielle' && d.week >= e.campaignStartWeek)) return;
  if (rng.chance(role === 'depute' ? 0.4 : 0.32)) scheduleVote(d, rng);
}

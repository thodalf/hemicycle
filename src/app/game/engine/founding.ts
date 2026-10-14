import { GameState, Npc, PartyLine } from '../models/game.models';
import { PARTY_LINES } from '../data/budget';
import { factionPositions, ofParty } from '../data/world';
import { rankOrder } from '../data/ranks';
import { pushNews } from './effects';
import { clamp } from './rng';
import { nameRng, uniqueName } from '../data/names';

/* ============================================================
 *  Fonder son propre parti : au lancement de la partie ou en
 *  claquant la porte de son parti en cours de route.
 * ============================================================ */

export interface PartyDraft {
  name: string;
  color: string;
  position: number;
}

export const PARTY_COLORS = ['#b3263b', '#d1495b', '#2f8a5b', '#0f7c8c', '#8e3b6e', '#5b4bb3', '#2b5aa8', '#c27c0e', '#6b5b45', '#1f2937'];

/** Taille de départ d'un parti fondé (petit, militant, endetté de rien) */
const START_MEMBERS = 900;

export const FOUNDING_COST = { money: 3000, politicalCapital: 20 };

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 48) || 'Mouvement citoyen';
}

/** Initiales pour le badge (« Mouvement pour la Liberté » → « ML ») */
export function partyInitials(name: string): string {
  const stop = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'pour', 'l', 'd', 'en', 'à']);
  return name.split(/[\s’']+/).filter(w => w && !stop.has(w.toLowerCase())).map(w => w[0].toUpperCase()).join('').slice(0, 4);
}

function cofounders(d: GameState, partyId: string): Npc[] {
  const next = nameRng(d.seed, 'cofondateurs');
  const taken = d.npcs.map(n => n.name);
  const a = uniqueName(next, taken, 'f'), b = uniqueName(next, [...taken, a], 'm');
  return [
    {
      id: 'npc-fontaine', name: a, partyId, rankId: 'conseiller_municipal', factionId: 'moderes',
      traits: ['integre'], ambition: 45, loyalty: 80, aggressiveness: 25,
      popularity: 18, influence: 20, relationToPlayer: 45, isRival: false,
    },
    {
      id: 'npc-damremont', name: b, partyId, rankId: 'depute', factionId: 'ligne_dure',
      traits: ['carrieriste', 'mediatique'], ambition: 80, loyalty: 35, aggressiveness: 55,
      popularity: 26, influence: 30, relationToPlayer: 5, isRival: true,
    },
  ];
}

function smallFinance(d: GameState) {
  // Même échelle que partyScale() : un vingtième d'un grand parti
  const k = 0.05;
  return {
    treasury: 60,
    members: START_MEMBERS,
    fee: 30,
    allocations: Object.fromEntries(PARTY_LINES.map(l => [l.id, Math.round(l.base * k * 2) / 2])) as Record<PartyLine, number>,
    lastSettledWeek: d.week,
    history: [{ week: d.week, treasury: 60, members: START_MEMBERS, balance: 0 }],
  };
}

/** Parti créé dès le début de la partie : le joueur en est le fondateur */
export function setupFoundedPartyAtStart(d: GameState, draft: PartyDraft): void {
  const name = cleanName(draft.name);
  d.party.name = name;
  d.party.color = draft.color;
  d.party.position = draft.position;
  d.party.founder = true;
  d.party.foundedWeek = d.week;
  d.party.leaderNpcId = 'player';
  d.party.cohesion = 75;
  const pos = factionPositions(draft.position);
  d.party.factions.forEach(f => { f.position = pos[f.id]; f.supportForPlayer = 65; });
  d.player.stance = draft.position;
  // La cheffe historique n'existe pas dans un parti tout neuf : elle devient cofondatrice
  const vasseur = d.npcs.find(n => n.id === 'npc-vasseur');
  if (vasseur) { vasseur.rankId = 'depute'; vasseur.relationToPlayer = 30; }
  const lemaire = d.npcs.find(n => n.id === 'npc-lemaire');
  if (lemaire) lemaire.rankId = 'depute';
  d.partyFinance = smallFinance(d);
}

export function canFoundParty(d: GameState, free = false): { ok: boolean; reason?: string } {
  if (d.party.founder) return { ok: false, reason: 'Vous avez déjà fondé votre parti' };
  if (d.scenario === 'royaute') return { ok: false, reason: 'Vous dirigez déjà la Ligue de la Couronne' };
  if (d.player.finances.legalCeiling !== null || d.elections.some(e => !e.resolved)) {
    return { ok: false, reason: 'Impossible pendant une campagne' };
  }
  if (!free) {
    if (d.player.finances.personal < FOUNDING_COST.money) return { ok: false, reason: `Il faut ${FOUNDING_COST.money.toLocaleString('fr-FR')} € de fonds personnels` };
    if (d.player.stats.politicalCapital < FOUNDING_COST.politicalCapital) return { ok: false, reason: `Il faut ${FOUNDING_COST.politicalCapital} de capital politique` };
  }
  return { ok: true };
}

/** Claquer la porte : quitter son parti et fonder le sien en cours de partie */
export function foundPartyInGame(d: GameState, draft: PartyDraft): void {
  const free = !!d.player.flags['foundOffer'];
  if (!canFoundParty(d, free).ok) return;
  const old = d.party;
  const name = cleanName(draft.name);
  const id = `perso-${d.week}`;

  if (!free) {
    d.player.finances.personal -= FOUNDING_COST.money;
    d.player.stats.politicalCapital -= FOUNDING_COST.politicalCapital;
  }
  d.player.flags['foundOffer'] = false;

  // Un ancien proche vous suit peut-être
  const follower = d.npcs.filter(x => x.partyId === old.id && x.relationToPlayer > 25).sort((a, b) => b.relationToPlayer - a.relationToPlayer)[0];
  // L'ancien parti devient un adversaire, ses cadres vous en veulent
  d.otherParties.push({ id: old.id, name: old.name, color: old.color, position: old.position });
  for (const n of d.npcs.filter(x => x.partyId === old.id && x !== follower)) n.relationToPlayer = clamp(n.relationToPlayer - 20, -100, 100);
  if (follower && follower.rankId !== 'chef_parti') {
    follower.partyId = id;
    follower.factionId = 'moderes';
    follower.isRival = false;
  }

  const pos = factionPositions(draft.position);
  d.party = {
    id, name, color: draft.color, position: draft.position,
    factions: [
      { id: 'ligne_dure', name: 'Ligne dure', weight: 35, position: pos.ligne_dure, satisfaction: 60, supportForPlayer: 62 },
      { id: 'moderes', name: 'Modérés', weight: 40, position: pos.moderes, satisfaction: 65, supportForPlayer: 66 },
      { id: 'reformistes', name: 'Réformistes', weight: 25, position: pos.reformistes, satisfaction: 60, supportForPlayer: 64 },
    ],
    leaderNpcId: 'player', cohesion: 75, founder: true, foundedWeek: d.week,
  };
  d.npcs.push(...cofounders(d, id).filter(n => !d.npcs.some(x => x.id === n.id)));
  d.partyFinance = smallFinance(d);

  const s = d.player.stats;
  s.popularity = clamp(s.popularity + 4);
  s.influence = clamp(s.influence - (rankOrder(d.player.rankId) >= rankOrder('depute') ? 6 : 3));
  d.player.momentum = clamp(d.player.momentum + 8);
  pushNews(d, 'parti', 'neutral', `${d.player.name} claque la porte ${ofParty(old.name)}`,
    `et fonde « ${name} ». ${follower ? `${follower.name} vous suit. ` : ''}Un départ en fanfare, une implantation à construire.`);
}

/** Malus électoral d'un parti jeune et peu implanté, qui s'efface en un an */
export function youngPartyMalus(d: GameState): number {
  if (!d.party.founder) return 0;
  return Math.max(0, 8 - (d.week - (d.party.foundedWeek ?? d.week)) / 2);
}

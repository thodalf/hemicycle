import { ContactType, Effect, GameState, PhoneMessage, PhoneReply, PhoneState, StaffRole } from '../models/game.models';
import { highOffice, honorific, inPower, office, seat } from './office';
import { STAFF_BY_ROLE, STAFF_ICONS } from '../data/staff';
import { RANKS } from '../data/ranks';
import { DOMAINS } from '../models/game.models';
import { MINISTRIES } from './government';
import { dateCall, romanceOptions } from './phone-extra';
import { askCall, askOptions, isAsk, monthlyDebts } from './phone-asks';
import { npcAge } from './npc-life';
import { monthlyIncomingCall } from './phone-calls';
import { appointCall, appointOptions, cabinetSalt, isAppoint, pickedMinister } from './phone-appoint';
import { scenarioAsk, scenarioCall, scenarioEntries, scenarioOptions } from './phone-scenario';
import { applyEffects, campaignOpen, partySupport } from './effects';
import { voteRole } from './assembly';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Le téléphone : SMS et appels de l'équipe, du chef ou de la
 *  cheffe du parti, des collègues, du réseau et des proches.
 *  On y répond, et l'on passe ses propres coups de fil :
 *  prendre des nouvelles, demander du soutien pour un texte,
 *  demander de l'argent. Quatre appels par mois, ensuite la
 *  fatigue se fait sentir.
 * ============================================================ */

export const CALLS_PER_MONTH = 4;
export const EXTRA_CALL_ENERGY = 4;
const MAX_MESSAGES = 60;

export type CallerKind = 'equipe' | 'chef' | 'gouvernement' | 'collegue' | 'personnalite' | 'contact' | 'proche' | 'scenario';

export interface PhoneEntry {
  key: string;
  kind: CallerKind;
  name: string;
  role: string;
  icon: string;
  /** Confiance ou relation (−100 … 100), pour l'affichage */
  bond?: number;
}

export interface CallOption {
  id: 'soutien' | 'argent' | 'nouvelles' | 'point' | 'numero' | 'remercier' | 'mission' | 'rumeur' | 'fuite' | 'pacte' | 'tuyau' | 'conseil' | 'appui' | 'arbitrage' | 'seduire' | 'rompre' | 'complot' | 'apparition' | 'nommer_pm' | 'limoger' | `sc_${string}` | `min_${string}`;
  label: string;
  hint: string;
  ok: boolean;
  reason?: string;
  /** Options regroupées (ministères) : libellé court et groupe */
  chip?: string;
  group?: string;
}

const CONTACT_LABEL: Record<ContactType, string> = {
  lobby: 'Lobby', industriel: 'Industriel', syndicat: 'Syndicat', journaliste: 'Journaliste', association: 'Association', culte: 'Culte',
};
const CONTACT_ICON: Record<ContactType, string> = {
  lobby: '💼', industriel: '🏭', syndicat: '✊', journaliste: '📰', association: '🤝', culte: '🕊️',
};

/* ── Carnet d'adresses des personnalités politiques ────────── */

/** Un faux numéro, stable pour chaque personnalité */
export function fakeNumber(id: string): string {
  let h = 7;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 100000000;
  const digits = String(h).padStart(8, '0');
  return `06 ${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`;
}

export function hasNumber(d: GameState, npcId: string): boolean {
  return (d.player.phoneBook ?? []).includes(npcId);
}

/** Les personnalités dont vous n'avez pas encore le numéro (les plus en vue d'abord) */
export function unknownPersonalities(d: GameState) {
  const leaderId = d.party.leaderNpcId;
  return d.npcs.filter(n => !hasNumber(d, n.id) && n.id !== leaderId && !(n.partyId === d.party.id && n.relationToPlayer >= 0))
    .sort((a, b) => b.influence + b.popularity - (a.influence + a.popularity));
}

/** Ajoute un numéro au carnet ; renvoie la ligne de résumé */
export function addNumber(d: GameState, npcId: string): string | null {
  const n = d.npcs.find(x => x.id === npcId);
  if (!n || hasNumber(d, npcId)) return null;
  (d.player.phoneBook ??= []).push(npcId);
  return `Numéro de ${n.name} (${fakeNumber(n.id)})`;
}

/** Un numéro au hasard parmi les plus en vue */
export function grantNumber(d: GameState, rng: Rng): string | null {
  const pool = unknownPersonalities(d).slice(0, 8);
  return pool.length ? addNumber(d, rng.pick(pool).id) : null;
}

/* ── Les numéros du gouvernement ──────────────────────────── */

export function inGovernment(d: GameState): boolean {
  return ['ministre', 'premier_ministre', 'president'].includes(d.player.rankId);
}

const GOV_FIRST = ['Anne', 'Bertrand', 'Claire', 'Damien', 'Élise', 'François', 'Géraldine', 'Hervé', 'Isabelle', 'Jérôme', 'Karine', 'Laurent', 'Marion', 'Nicolas', 'Patricia', 'Rachid'];
const GOV_LAST = ['Aubry', 'Bertin', 'Chevalier', 'Darmon', 'Esnault', 'Fabre', 'Garnier', 'Hoarau', 'Imbert', 'Joly', 'Kervern', 'Laval', 'Mercier', 'Nguyen', 'Olivier', 'Perrot'];
function hash(t: string): number { let h = 17; for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) % 1000003; return h; }

export interface GovMember { key: string; name: string; role: string }

/** Les membres du gouvernement (noms stables tant que le président ne change pas) */
export function governmentRoster(d: GameState): GovMember[] {
  if (!inGovernment(d)) return [];
  const p = d.player;
  const salt = cabinetSalt(d);
  const name = (slot: string) => `${GOV_FIRST[hash(slot + salt) % GOV_FIRST.length]} ${GOV_LAST[hash(salt + slot + 'x') % GOV_LAST.length]}`;
  const out: GovMember[] = [];
  if (p.rankId !== 'president' && d.presidential.incumbentId !== 'player') {
    const pr = d.npcs.find(n => n.id === d.presidential.incumbentId);
    out.push({ key: 'gouv:pr', name: pr?.name ?? (d.presidential.incumbentName.startsWith('le ') ? name('pr') : d.presidential.incumbentName), role: 'Président·e de la République' });
  }
  if (p.rankId !== 'premier_ministre') out.push({ key: 'gouv:pm', name: d.presidency?.primeMinister ?? name('pm'), role: 'Premier·e ministre' });
  const npcMinisters = d.npcs.filter(n => n.rankId === 'ministre' && n.partyId === d.party.id);
  let i = 0;
  for (const dom of DOMAINS) {
    if (p.rankId === 'ministre' && d.portfolio === dom) continue;
    const npc = npcMinisters[i];
    if (npc) i++;
    out.push({ key: `gouv:${dom}`, name: pickedMinister(d, dom) ?? d.presidency?.cabinet?.[dom] ?? npc?.name ?? name(dom), role: `Ministre ${MINISTRIES[dom]}` });
  }
  return out;
}

/** Une information compromettante sur une personnalité (confidences, complots) */
export function kompromatTargets(d: GameState) {
  return d.npcs.filter(n => Number(d.player.flags[`kompromat_${n.id}`] ?? 0) > 0);
}
function rivalOf(d: GameState) {
  const others = d.npcs.filter(n => n.partyId !== d.party.id);
  return [...(others.length ? others : d.npcs)].sort((a, b) => a.relationToPlayer - b.relationToPlayer || b.influence - a.influence)[0];
}

export function initPhone(d: GameState): PhoneState {
  return { messages: [], callsUsed: 0, callsWeek: d.week, called: {} };
}

function phone(d: GameState): PhoneState {
  d.phone ??= initPhone(d);
  if (d.phone.callsWeek !== d.week) { d.phone.callsUsed = 0; d.phone.callsWeek = d.week; }
  return d.phone;
}

export function unreadCount(d: GameState): number {
  return (d.phone?.messages ?? []).filter(m => !m.outgoing && !m.read).length;
}

/** Le chef ou la cheffe du parti, quand ce n'est pas vous */
function leader(d: GameState) {
  return d.party.leaderNpcId !== 'player' ? d.npcs.find(n => n.id === d.party.leaderNpcId) : undefined;
}

/** Le répertoire : qui l'on peut appeler */
export function directory(d: GameState): PhoneEntry[] {
  const out: PhoneEntry[] = [];
  for (const r of d.player.team) {
    out.push({ key: `equipe:${r.id}`, kind: 'equipe', name: r.name, role: STAFF_BY_ROLE.get(r.role)?.title ?? r.role, icon: STAFF_ICONS[r.role] ?? '👤' });
  }
  const chief = leader(d);
  if (chief) out.push({ key: 'chef', kind: 'chef', name: chief.name, role: `Chef·fe ${d.party.name.startsWith('Union') || d.party.name.startsWith('Alliance') ? 'de l’' + d.party.name : 'du parti'}`, icon: '🎗️', bond: Math.round(chief.relationToPlayer) });
  const colleagues = d.npcs
    .filter(n => n.partyId === d.party.id && n.id !== d.party.leaderNpcId && n.relationToPlayer >= 0)
    .sort((a, b) => b.relationToPlayer - a.relationToPlayer)
    .slice(0, 4);
  for (const n of colleagues) out.push({ key: `collegue:${n.id}`, kind: 'collegue', name: n.name, role: `Collègue du parti · ${npcAge(n)} ans`, icon: '🧑‍💼', bond: Math.round(n.relationToPlayer) });
  for (const g of governmentRoster(d)) out.push({ key: g.key, kind: 'gouvernement', name: g.name, role: g.role, icon: g.key === 'gouv:pr' ? '🇫🇷' : g.key === 'gouv:pm' ? '🏛️' : '💼' });
  const shown = new Set([d.party.leaderNpcId, ...colleagues.map(n => n.id)]);
  const parties = [d.party, ...d.otherParties];
  for (const id of d.player.phoneBook ?? []) {
    const n = d.npcs.find(x => x.id === id);
    if (!n || shown.has(n.id)) continue;
    const party = parties.find(x => x.id === n.partyId);
    out.push({ key: `perso:${n.id}`, kind: 'personnalite', name: n.name, role: `${RANKS[n.rankId]?.label ?? 'Élu·e'} · ${party?.name ?? 'sans parti'} · ${npcAge(n)} ans`, icon: n.isRival ? '⚔️' : '⭐', bond: Math.round(n.relationToPlayer) });
  }
  out.push(...scenarioEntries(d));
  for (const c of d.contacts) out.push({ key: `contact:${c.id}`, kind: 'contact', name: c.name, role: CONTACT_LABEL[c.type], icon: CONTACT_ICON[c.type], bond: Math.round(c.trust) });
  const partner = d.family?.partner;
  if (partner) out.push({ key: 'conjoint', kind: 'proche', name: partner.name, role: partner.married ? 'Votre conjoint·e' : 'Votre moitié', icon: '💞' });
  if (d.family?.parents.find(x => x.name === 'Maman')?.alive !== false) out.push({ key: 'proche', kind: 'proche', name: 'Maman', role: 'Famille', icon: '❤️' });
  return out;
}

export function entryOf(d: GameState, key: string): PhoneEntry | undefined {
  return directory(d).find(e => e.key === key);
}

/** Un texte est-il en jeu (en débat, ou à venir) ? */
function supportTarget(d: GameState): 'vote' | 'promesse' | null {
  if (d.vote?.status === 'debat') return 'vote';
  return voteRole(d) ? 'promesse' : null;
}

/** Appels sans fatigue par mois (talent « Carnet d’adresses » compris) */
export function callsPerMonth(d: GameState): number {
  return CALLS_PER_MONTH + (d.player.talents?.['reseau'] ?? 0);
}

export function callStatus(d: GameState): { used: number; free: number; extraCost: number; max: number } {
  const ph = d.phone;
  const used = ph && ph.callsWeek === d.week ? ph.callsUsed : 0;
  const max = callsPerMonth(d);
  return { used, free: Math.max(0, max - used), extraCost: used >= max ? EXTRA_CALL_ENERGY : 0, max };
}

export function callOptions(d: GameState, key: string): CallOption[] {
  const e = entryOf(d, key);
  if (!e) return [];
  const already = (d.phone?.called[key] ?? -99) === d.week;
  const busy = already ? 'Déjà appelé·e ce mois-ci' : undefined;
  const st = callStatus(d);
  const tired = st.extraCost && d.player.stats.energy < st.extraCost + 5 ? 'Trop fatigué·e pour un appel de plus' : undefined;
  const block = busy ?? tired;
  const target = supportTarget(d);
  const opts: CallOption[] = [];
  const supportLabel = d.vote?.status === 'debat' ? `Demander du soutien : « ${d.vote.title} »` : 'Demander du soutien pour votre prochain texte';
  const supportReason = !target ? 'Aucun texte en jeu : il faut siéger à l’Assemblée ou au gouvernement' : undefined;
  switch (e.kind) {
    case 'equipe':
      opts.push({ id: 'point', label: 'Faire le point', hint: 'Un conseil, un coup de main, des nouvelles du terrain.', ok: !block, reason: block });
      opts.push({ id: 'remercier', label: 'Remercier pour le travail accompli', hint: 'Le moral remonte, ça ne coûte rien.', ok: !block, reason: block });
      opts.push({ id: 'mission', label: 'Confier une mission urgente', hint: 'Double effet tout de suite, mais le moral baisse.', ok: !block, reason: block });
      break;
    case 'chef': {
      const camp = campaignOpen(d);
      const lastMoney = Number(d.player.flags['phoneMoneyChef'] ?? -99);
      opts.push({ id: 'soutien', label: supportLabel, hint: 'Une consigne de vote du parti : des dizaines de voix si la relation est bonne.', ok: !block && !!target, reason: block ?? supportReason });
      if (!inPower(d)) opts.push({ id: 'argent', label: 'Demander une aide financière du parti', hint: camp ? 'Une avance sur le compte de campagne, selon votre soutien interne.' : 'Hors campagne : le parti prend en charge vos frais de déplacement et de permanence.',
        ok: !block && d.week - lastMoney >= 6, reason: block ?? (d.week - lastMoney < 6 ? 'Le trésorier vous a déjà dépanné·e récemment' : undefined) });
      opts.push({ id: 'numero', label: 'Demander le numéro d’une personnalité', hint: 'Le chef a le carnet d’adresses le plus épais du parti.', ok: !block && unknownPersonalities(d).length > 0, reason: block ?? (unknownPersonalities(d).length ? undefined : 'Vous avez déjà tous les numéros') });
      opts.push({ id: 'nouvelles', label: 'Prendre des nouvelles', hint: 'Entretenir la relation.', ok: !block, reason: block });
      break;
    }
    case 'gouvernement':
      opts.push({ id: 'soutien', label: supportLabel, hint: 'Solidarité gouvernementale : ses réseaux au Parlement.', ok: !block && !!target, reason: block ?? supportReason });
      opts.push({ id: 'arbitrage', label: 'Demander un coup de pouce', hint: key === 'gouv:pm' || key === 'gouv:pr' ? 'Un arbitrage favorable pour vos dossiers.' : 'Une collaboration entre vos deux ministères.', ok: !block, reason: block });
      opts.push({ id: 'tuyau', label: 'Prendre la température', hint: 'Remaniement, rumeurs, rapports de force au sein du gouvernement.', ok: !block, reason: block });
      opts.push({ id: 'nouvelles', label: 'Prendre des nouvelles', hint: 'Entretenir la solidarité gouvernementale.', ok: !block, reason: block });
      break;
    case 'personnalite': {
      const n = d.npcs.find(x => `perso:${x.id}` === key)!;
      const pactDone = Number(d.player.flags[`pacte_${n.id}`] ?? -99);
      opts.push({ id: 'nouvelles', label: 'Prendre des nouvelles', hint: 'Entretenir le contact, même avec un adversaire.', ok: !block, reason: block });
      opts.push({ id: 'soutien', label: supportLabel, hint: n.partyId === d.party.id ? 'Sa voix et celles de ses proches.' : 'Une voix de l’autre camp : rare, et précieuse.', ok: !block && !!target, reason: block ?? supportReason });
      opts.push({ id: 'pacte', label: 'Proposer un pacte de non-agression', hint: 'Il ou elle cesse de vous attaquer. Une fois par an.', ok: !block && n.relationToPlayer >= -10 && d.week - pactDone >= 12,
        reason: block ?? (n.relationToPlayer < -10 ? 'Relation trop mauvaise (−10 au moins)' : d.week - pactDone < 12 ? 'Pacte déjà conclu cette année' : undefined) });
      opts.push({ id: 'tuyau', label: 'Glaner des confidences', hint: 'Un ragot sur un tiers… qui peut devenir une arme.', ok: !block, reason: block });
      break;
    }
    case 'collegue':
      opts.push({ id: 'soutien', label: supportLabel, hint: 'Sa voix, et celles de quelques proches.', ok: !block && !!target, reason: block ?? supportReason });
      opts.push({ id: 'numero', label: 'Demander le numéro d’une personnalité', hint: 'Un ou une collègue bien introduit·e.', ok: !block && unknownPersonalities(d).length > 0, reason: block ?? (unknownPersonalities(d).length ? undefined : 'Vous avez déjà tous les numéros') });
      opts.push({ id: 'rumeur', label: 'Faire courir une rumeur sur un adversaire', hint: 'Sa popularité baisse… si personne ne remonte jusqu’à vous.', ok: !block, reason: block });
      opts.push({ id: 'nouvelles', label: 'Prendre des nouvelles', hint: 'Un café, des confidences.', ok: !block, reason: block });
      break;
    case 'contact': {
      const c = d.contacts.find(x => `contact:${x.id}` === key)!;
      const money = c.type === 'lobby' || c.type === 'industriel';
      opts.push({ id: 'soutien', label: supportLabel, hint: c.type === 'journaliste' ? 'Un papier favorable : l’opinion pèse sur les députés.' : money ? 'Ils ont l’oreille de nombreux députés… et des attentes.' : c.type === 'culte' ? 'Les fidèles écrivent à leurs députés.' : 'Une mobilisation qui fait pression sur les élus.', ok: !block && !!target, reason: block ?? supportReason });
      if (c.type === 'journaliste') {
        const komp = kompromatTargets(d);
        opts.push({ id: 'numero', label: 'Demander le numéro d’une personnalité', hint: 'Les journalistes ont tous les portables.', ok: !block && c.trust >= 20 && unknownPersonalities(d).length > 0, reason: block ?? (c.trust < 20 ? 'Confiance 20 au moins' : unknownPersonalities(d).length ? undefined : 'Vous avez déjà tous les numéros') });
        opts.push({ id: 'fuite', label: komp.length ? `Lui confier un dossier sur ${komp[0].name}` : 'Lui confier un dossier compromettant', hint: 'Un article qui fait mal à un adversaire. Il faudra protéger votre anonymat.', ok: !block && komp.length > 0, reason: block ?? (komp.length ? undefined : 'Il vous faut une information compromettante (confidences, complots)') });
      }
      if (c.type === 'culte') {
        const lastAppui = Number(d.player.flags[`appui_${c.id}`] ?? -99);
        opts.push({ id: 'appui', label: 'Solliciter un soutien public', hint: 'Une parole bienveillante devant les fidèles. Les défenseurs de la laïcité tiquent.', ok: !block && c.trust >= 25 && d.week - lastAppui >= 6, reason: block ?? (c.trust < 25 ? 'Confiance 25 au moins' : d.week - lastAppui < 6 ? 'Déjà sollicité il y a peu' : undefined) });
      }
      const lastAsk = Number(d.player.flags[`phoneMoney_${c.id}`] ?? -99);
      const tooSoon = d.week - lastAsk < 6 ? 'Vous les avez déjà sollicités il y a peu' : undefined;
      if (money) opts.push({ id: 'argent', label: 'Demander de l’argent', hint: 'En campagne : un dîner de donateurs. Hors campagne : des « honoraires de conseil »… exposés.', ok: !block && !tooSoon, reason: block ?? tooSoon });
      opts.push({ id: 'nouvelles', label: 'Entretenir la relation', hint: 'La confiance se cultive.', ok: !block, reason: block });
      break;
    }
    case 'scenario':
      opts.push(...scenarioOptions(d, e, block));
      break;
    case 'proche': {
      if (key === 'conjoint') {
        opts.push({ id: 'nouvelles', label: 'Lui dire que vous l’aimez', hint: 'Deux minutes qui comptent.', ok: !block, reason: block });
        opts.push({ id: 'conseil', label: 'Lui demander conseil', hint: 'La personne qui vous connaît le mieux.', ok: !block, reason: block });
        break;
      }
      const lastMoney = Number(d.player.flags['phoneMoneyFamily'] ?? -99);
      opts.push({ id: 'nouvelles', label: 'Prendre des nouvelles', hint: 'Une demi-heure loin de la politique.', ok: !block, reason: block });
      opts.push({ id: 'conseil', label: 'Demander conseil', hint: 'Un regard extérieur, sans arrière-pensée.', ok: !block, reason: block });
      if (!highOffice(d)) opts.push({ id: 'argent', label: 'Demander un coup de main financier', hint: 'Une fois par an, et ça coûte un peu d’amour-propre.', ok: !block && d.week - lastMoney >= 12, reason: block ?? (d.week - lastMoney < 12 ? 'Vous avez déjà demandé cette année' : undefined) });
      break;
    }
  }
  opts.push(...askOptions(d, e, block));
  opts.push(...appointOptions(d, e, block));
  opts.push(...romanceOptions(d, e, block));
  return opts;
}

export function addMessage(d: GameState, m: Omit<PhoneMessage, 'id' | 'week'>): PhoneMessage {
  const ph = phone(d);
  const msg: PhoneMessage = { id: nextId(d, 'tel'), week: d.week, ...m };
  ph.messages.unshift(msg);
  if (ph.messages.length > MAX_MESSAGES) ph.messages.length = MAX_MESSAGES;
  return msg;
}

/** Ajoute des voix au texte en débat, ou les met de côté pour votre prochain texte */
function rally(d: GameState, votes: number): string {
  if (d.vote?.status === 'debat') {
    const dir = d.vote.partyLine === 'contre' ? -1 : 1;
    d.vote.swing += votes * dir;
    return `${votes} voix ${dir > 0 ? 'pour' : 'contre'} le texte`;
  }
  d.player.flags['billSupport'] = Math.min(40, Number(d.player.flags['billSupport'] ?? 0) + votes);
  return `${votes} voix promises pour votre prochain texte`;
}

/** Passer un appel */
export function placeCall(d: GameState, key: string, optionId: CallOption['id'], rng: Rng): string[] {
  const opt = callOptions(d, key).find(o => o.id === optionId);
  const e = entryOf(d, key);
  if (!opt?.ok || !e) return [];
  const ph = phone(d);
  const extra = callStatus(d).extraCost;
  ph.callsUsed += 1;
  ph.called[key] = d.week;
  const p = d.player;
  const effects: Effect[] = extra ? [{ kind: 'stat', stat: 'energy', delta: -extra }] : [];
  let answer = '';
  let note: string | undefined;
  const ASK: Partial<Record<CallOption['id'], string>> = {
    argent: 'J’aurais besoin d’un coup de main financier…', point: 'On fait le point ?', numero: 'Tu aurais un numéro à me passer ?',
    remercier: 'Je voulais te remercier pour ton travail.', mission: 'J’ai besoin de toi tout de suite, c’est urgent.',
    rumeur: 'Tu as entendu ce qu’on raconte sur…', fuite: 'J’ai quelque chose pour vous. Mais ça ne vient pas de moi.',
    pacte: 'Et si on arrêtait de se taper dessus, toi et moi ?', tuyau: 'Alors, quoi de neuf dans ton camp ?', conseil: 'J’ai besoin de ton avis.',
    appui: 'Votre parole compte beaucoup pour vos fidèles…', seduire: 'Tu serais libre un soir de la semaine ?', rompre: 'Il faut qu’on parle.', arbitrage: 'J’aurais besoin d’un coup de pouce…',
    complot: 'J’ai un projet… discret. J’aurais besoin de toi.', apparition: 'Tu accepterais de t’afficher à mes côtés ?',
    nommer_pm: 'J’ai besoin de vous à Matignon. Vous acceptez ?', limoger: key === 'gouv:pm' ? 'Il est temps de tourner la page. J’attends votre démission.' : 'Je vais devoir vous demander de quitter le gouvernement.',
  };
  const ask = optionId === 'soutien' ? (d.vote?.status === 'debat' ? `Je peux compter sur ton soutien pour « ${d.vote.title} » ?` : 'Je prépare un texte : je peux compter sur ton soutien ?') : ASK[optionId] ?? (optionId.startsWith('min_') ? 'Je voudrais vous confier un ministère. Vous êtes partant·e ?' : undefined) ?? scenarioAsk(d, e, optionId) ?? 'Je prenais des nouvelles.';
  addMessage(d, { kind: 'appel', who: key, from: e.name, role: e.role, text: `📞 ${ask}`, outgoing: true, read: true });

  let notes: string[] = [];
  if (optionId === 'seduire' || optionId === 'rompre') {
    const res = dateCall(d, e, optionId, rng);
    answer = res.answer;
    effects.push(...res.effects);
    note = res.note;
  } else if (isAppoint(optionId)) {
    const res = appointCall(d, e, optionId, rng);
    answer = res.answer;
    effects.push(...res.effects);
    notes = res.notes;
  } else if (e.kind === 'scenario') {
    const res = scenarioCall(d, e, optionId, rng);
    answer = res.answer;
    effects.push(...res.effects);
    notes = res.notes ?? [];
  } else if (isAsk(d, e, optionId)) {
    const res = askCall(d, e, optionId, rng);
    answer = res.answer;
    effects.push(...res.effects);
    notes = res.notes;
  } else if (key === 'conjoint') {
    answer = optionId === 'conseil'
      ? rng.pick(['Écoute ton instinct. Il t’a rarement trompé·e.', 'Dors d’abord. On en reparle demain, à tête reposée.', 'Fais ce qui te permettra de te regarder dans la glace.'])
      : rng.pick(['Moi aussi. Rentre tôt ce soir.', 'Tu me manques. Le dîner est au chaud.', 'Je sais. Fais attention à toi.']);
    effects.push({ kind: 'stat', stat: 'stress', delta: -5 }, ...(optionId === 'conseil' ? [{ kind: 'stat', stat: 'credibility', delta: 1 } as Effect] : [{ kind: 'stat', stat: 'energy', delta: 3 } as Effect]));
  } else if (e.kind === 'equipe') {
    const r = p.team.find(x => `equipe:${x.id}` === key)!;
    const tip = TEAM_TIPS[r.role] ?? TEAM_TIPS.conseiller!;
    if (optionId === 'remercier') {
      answer = rng.pick(['Ça fait plaisir à entendre. Vraiment.', 'Merci ! On forme une sacrée équipe.', 'Je ne m’y attendais pas. Je repars gonflé·e à bloc.']);
      effects.push({ kind: 'team', recruitId: r.id, morale: 8 });
    } else if (optionId === 'mission') {
      answer = `C’est fait. ${tip.text} J’ai passé la nuit dessus, j’espère que ça valait le coup.`;
      effects.push(...tip.effects, ...tip.effects, { kind: 'team', recruitId: r.id, morale: -7 });
    } else {
      answer = tip.text;
      effects.push(...tip.effects);
    }
  } else if (e.kind === 'chef') {
    const chief = leader(d)!;
    const rel = chief.relationToPlayer;
    const sup = partySupport(d);
    if (optionId === 'soutien') {
      if (rng.chance(clamp(0.35 + rel / 120 + sup / 300, 0.1, 0.95))) {
        note = rally(d, Math.round(8 + sup / 10));
        answer = 'C’est entendu, je passe la consigne au groupe. Tu me revaudras ça.';
        effects.push({ kind: 'stat', stat: 'politicalCapital', delta: -5 }, { kind: 'npcRelation', npcId: chief.id, delta: -2 });
      } else {
        answer = 'Pas cette fois. Le groupe est divisé, je ne vais pas me griller pour toi.';
        effects.push({ kind: 'npcRelation', npcId: chief.id, delta: -1 });
      }
    } else if (optionId === 'numero') {
      if (rng.chance(clamp(0.45 + rel / 120, 0.15, 0.95))) {
        const got = grantNumber(d, rng);
        if (got) note = got;
        answer = 'Je te l’envoie par SMS. Et tu ne le tiens pas de moi.';
      } else answer = 'Mon carnet d’adresses, c’est mon capital. Gagne d’abord tes galons.';
    } else if (optionId === 'argent' && !campaignOpen(d)) {
      p.flags['phoneMoneyChef'] = d.week;
      if (rng.chance(clamp(0.35 + rel / 100 + sup / 200, 0.1, 0.95))) {
        const amount = Math.round((800 + sup * 30) / 100) * 100;
        effects.push({ kind: 'funds', account: 'personal', delta: amount }, { kind: 'stat', stat: 'politicalCapital', delta: -4 });
        if (d.partyFinance) d.partyFinance.treasury -= amount / 1000;
        answer = `Envoie tes notes de frais au trésorier : on te rembourse ${amount.toLocaleString('fr-FR')} €. Justificatifs à l’appui, hein.`;
      } else {
        answer = 'Le parti n’est pas une banque. Débrouille-toi avec ton indemnité.';
        effects.push({ kind: 'npcRelation', npcId: chief.id, delta: -1 });
      }
    } else if (optionId === 'argent') {
      p.flags['phoneMoneyChef'] = d.week;
      if (rng.chance(clamp(0.3 + rel / 100 + sup / 200, 0.1, 0.95))) {
        const amount = Math.round((3000 + sup * 150) / 500) * 500;
        effects.push({ kind: 'funds', account: 'campaign', delta: amount }, { kind: 'stat', stat: 'politicalCapital', delta: -8 });
        if (d.partyFinance) d.partyFinance.treasury -= amount / 1000;
        answer = `Le trésorier fait un virement de ${amount.toLocaleString('fr-FR')} € sur ton compte de campagne. Ne me déçois pas.`;
      } else {
        answer = 'Les caisses sont vides, et tu n’es pas le seul à demander.';
        effects.push({ kind: 'npcRelation', npcId: chief.id, delta: -2 });
      }
    } else {
      answer = rng.pick(['Content de t’entendre. On déjeune la semaine prochaine ?', 'Ça tient. Il paraît que tu fais du bon travail.', 'Tu tombes bien, j’avais un mot à te dire sur les investitures…']);
      effects.push({ kind: 'npcRelation', npcId: chief.id, delta: 4 });
    }
  } else if (e.kind === 'collegue') {
    const n = d.npcs.find(x => `collegue:${x.id}` === key)!;
    if (optionId === 'soutien') {
      if (rng.chance(clamp(0.45 + n.relationToPlayer / 100, 0.15, 0.95))) {
        note = rally(d, 3 + Math.round(n.influence / 25));
        answer = 'Tu as ma voix. Je vais en parler à deux ou trois collègues.';
        effects.push({ kind: 'npcRelation', npcId: n.id, delta: -1 });
      } else answer = 'Désolé, j’ai pris des engagements ailleurs.';
    } else if (optionId === 'numero') {
      if (rng.chance(clamp(0.35 + n.relationToPlayer / 100 + n.influence / 300, 0.1, 0.9))) {
        const got = grantNumber(d, rng);
        if (got) note = got;
        answer = 'Tiens, note bien. Il ou elle décroche après 22 h.';
      } else answer = 'Je n’ai pas ce genre de numéro, désolé.';
    } else if (optionId === 'rumeur') {
      const target = rivalOf(d);
      if (target) {
        answer = `Sur ${target.name} ? Je vais en glisser deux mots à la buvette…`;
        effects.push({ kind: 'npcStat', npcId: target.id, stat: 'popularity', delta: -4 }, { kind: 'npcRelation', npcId: n.id, delta: -1 });
        if (rng.chance(0.3)) {
          effects.push({ kind: 'exposure', delta: 4 }, { kind: 'npcRelation', npcId: target.id, delta: -12 }, { kind: 'stat', stat: 'credibility', delta: -2 });
          answer += ' (Deux jours plus tard, la rumeur remonte jusqu’à vous.)';
        }
      } else answer = 'Sur qui ? Tout le monde t’aime bien, ici.';
    } else {
      answer = rng.pick(['On se voit à la buvette de l’Assemblée ?', 'Tu as vu le dernier sondage ? Tout le monde en parle.', 'Merci d’appeler, ça fait plaisir.']);
      effects.push({ kind: 'npcRelation', npcId: n.id, delta: 4 });
    }
  } else if (e.kind === 'gouvernement') {
    const top = key === 'gouv:pm' || key === 'gouv:pr';
    if (optionId === 'soutien') {
      if (rng.chance(top ? 0.75 : 0.6)) {
        note = rally(d, top ? 10 : 4);
        answer = top ? 'Le gouvernement soutiendra ce texte. Je préviens le président du groupe.' : 'Compte sur moi, et sur les députés qui me suivent.';
        effects.push({ kind: 'stat', stat: 'politicalCapital', delta: top ? -6 : -2 });
      } else answer = 'Pas maintenant, j’ai mes propres arbitrages à défendre.';
    } else if (optionId === 'arbitrage') {
      if (rng.chance(top ? 0.45 : 0.6)) {
        answer = top ? 'Entendu : l’arbitrage sera rendu en ta faveur. N’en abuse pas.' : 'On monte une mission conjointe entre nos deux ministères.';
        effects.push({ kind: 'dossier', domain: d.portfolio ?? d.agendaDomain, delta: top ? 5 : 3 }, { kind: 'stat', stat: 'politicalCapital', delta: top ? -8 : -3 }, { kind: 'stat', stat: 'influence', delta: 1 });
      } else answer = top ? 'Les caisses sont vides et tout le monde demande. Ce sera non.' : 'Mon cabinet est débordé. Une autre fois.';
    } else if (optionId === 'tuyau') {
      answer = rng.pick([
        'Il se murmure qu’un remaniement est dans les tuyaux. Fais-toi discret·e quelques semaines.',
        'Bercy prépare un coup de rabot. Défends ton budget avant qu’il ne soit trop tard.',
        'Le président trouve que tu passes bien à la télé. C’est bon signe.',
      ]);
      effects.push({ kind: 'stat', stat: 'influence', delta: 1 }, { kind: 'stat', stat: 'stress', delta: -1 });
    } else {
      answer = rng.pick(['Content·e d’avoir de tes nouvelles. On se voit au Conseil des ministres.', 'Merci de l’appel. On tient bon, malgré les vents contraires.']);
      effects.push({ kind: 'stat', stat: 'influence', delta: 1 });
    }
  } else if (e.kind === 'personnalite') {
    const n = d.npcs.find(x => `perso:${x.id}` === key)!;
    const rel = n.relationToPlayer;
    const same = n.partyId === d.party.id;
    if (optionId === 'soutien') {
      if (rng.chance(clamp(0.2 + rel / 100 + (same ? 0.2 : 0), 0.05, 0.9))) {
        note = rally(d, 2 + Math.round(n.influence / 20));
        answer = same ? 'Tu as ma voix.' : 'Officiellement, je n’ai rien promis. Mais je ne voterai pas contre, et quelques amis non plus.';
        effects.push({ kind: 'npcRelation', npcId: n.id, delta: -2 }, { kind: 'stat', stat: 'politicalCapital', delta: -3 });
      } else answer = same ? 'Pas cette fois.' : 'Vous plaisantez ? Mon groupe me tuerait.';
    } else if (optionId === 'pacte') {
      p.flags[`pacte_${n.id}`] = d.week;
      if (rng.chance(clamp(0.4 + rel / 100, 0.1, 0.9))) {
        n.isRival = false;
        n.aggressiveness = Math.max(0, n.aggressiveness - 30);
        answer = 'Marché conclu. Je ne vous attaque plus ; vous non plus. Le premier qui trahit le paiera.';
        effects.push({ kind: 'npcRelation', npcId: n.id, delta: 12 }, { kind: 'stat', stat: 'politicalCapital', delta: -5 });
      } else {
        answer = 'Un pacte ? Avec vous ? Je préfère garder les mains libres.';
        effects.push({ kind: 'npcRelation', npcId: n.id, delta: -4 });
      }
    } else if (optionId === 'tuyau') {
      if (rng.chance(clamp(0.3 + rel / 120 + n.influence / 400, 0.1, 0.85))) {
        const victim = rng.pick(d.npcs.filter(x => x.id !== n.id));
        if (victim && rng.chance(0.5)) {
          p.flags[`kompromat_${victim.id}`] = Number(p.flags[`kompromat_${victim.id}`] ?? 0) + 1;
          answer = `Entre nous… ${victim.name} a de drôles de notes de frais. Je ne vous ai rien dit.`;
          note = `Information compromettante sur ${victim.name}`;
        } else {
          answer = 'Le gouvernement prépare un remaniement. Et votre dossier fétiche est sur la table.';
          effects.push({ kind: 'dossier', domain: d.agendaDomain, delta: 3 }, { kind: 'stat', stat: 'influence', delta: 1 });
        }
      } else answer = 'Rien de neuf. Et même s’il y avait du neuf, ce n’est pas à vous que je le dirais.';
    } else {
      answer = rel >= 20 ? rng.pick(['Toujours un plaisir. On déjeune ?', 'Merci de penser à moi, en ces temps agités.']) : rel <= -20 ? rng.pick(['Vous avez du culot d’appeler.', 'Faites court, j’ai un plateau télé.']) : rng.pick(['Courtoisie républicaine, je prends.', 'C’est gentil. On se croisera dans les couloirs.']);
      effects.push({ kind: 'npcRelation', npcId: n.id, delta: rel <= -20 ? 2 : 4 });
    }
  } else if (e.kind === 'contact') {
    const c = d.contacts.find(x => `contact:${x.id}` === key)!;
    const money = c.type === 'lobby' || c.type === 'industriel';
    if (optionId === 'soutien') {
      if (rng.chance(clamp(0.3 + c.trust / 100 + c.balance * 0.1, 0.1, 0.95))) {
        const votes = c.type === 'journaliste' ? 3 : money ? 7 : 5;
        note = rally(d, votes);
        answer = c.type === 'journaliste' ? 'Je fais un papier demain matin. Les députés lisent ma chronique.'
          : money ? 'Nos amis au Parlement seront sensibles à vos arguments. Nous nous en souviendrons, n’est-ce pas ?'
          : 'On mobilise nos adhérents : les permanences des députés vont recevoir du courrier.';
        effects.push({ kind: 'contact', contactId: c.id, balance: -1 }, ...(money ? [{ kind: 'exposure', delta: 2 } as Effect] : []));
      } else {
        answer = 'Pas sur ce texte-là. Nous avons nos propres priorités.';
      }
    } else if (optionId === 'numero') {
      if (rng.chance(clamp(0.35 + c.trust / 100, 0.1, 0.9))) {
        const got = grantNumber(d, rng);
        if (got) note = got;
        answer = 'Je vous l’envoie. En échange, vous me réservez votre prochaine exclusivité.';
        effects.push({ kind: 'contact', contactId: c.id, balance: -1 });
      } else answer = 'Mes sources, c’est sacré. Même leurs numéros.';
    } else if (optionId === 'fuite') {
      const victim = kompromatTargets(d)[0];
      if (victim) {
        p.flags[`kompromat_${victim.id}`] = Math.max(0, Number(p.flags[`kompromat_${victim.id}`] ?? 0) - 1);
        answer = `Je vérifie, je recoupe, et ça sort jeudi. ${victim.name} va passer un mauvais week-end.`;
        effects.push({ kind: 'npcStat', npcId: victim.id, stat: 'popularity', delta: -8 }, { kind: 'npcStat', npcId: victim.id, stat: 'influence', delta: -4 }, { kind: 'contact', contactId: c.id, trust: 3 });
        if (rng.chance(0.25)) {
          effects.push({ kind: 'exposure', delta: 6 }, { kind: 'npcRelation', npcId: victim.id, delta: -25 }, { kind: 'stat', stat: 'credibility', delta: -3 });
          answer += ' (Le Canard révèle d’où vient la fuite…)';
        }
      }
    } else if (optionId === 'appui') {
      p.flags[`appui_${c.id}`] = d.week;
      if (rng.chance(clamp(0.35 + c.trust / 100, 0.1, 0.9))) {
        answer = 'Nous ne donnons pas de consigne de vote. Mais nous dirons tout le bien que nous pensons de votre action.';
        effects.push({ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'momentum', delta: 4 }, { kind: 'stat', stat: 'credibility', delta: -1 }, { kind: 'contact', contactId: c.id, balance: -1 });
      } else answer = 'Notre communauté ne fait pas de politique. Vous le savez bien.';
    } else if (optionId === 'argent') {
      p.flags[`phoneMoney_${c.id}`] = d.week;
      if (campaignOpen(d)) {
        if (rng.chance(clamp(0.35 + c.trust / 100, 0.1, 0.9))) {
          const amount = Math.round((2000 + c.power * 60) / 500) * 500;
          effects.push({ kind: 'funds', account: 'campaign', delta: amount }, { kind: 'contact', contactId: c.id, balance: -1 }, { kind: 'exposure', delta: 1 });
          answer = `Une entreprise ne peut pas financer une campagne, vous le savez. Mais j’organise un dîner : nos cadres donneront à titre personnel. Comptez ${amount.toLocaleString('fr-FR')} €.`;
        } else answer = 'Vous plaisantez ? Avec la Commission des comptes de campagne sur le dos ?';
      } else {
        if (rng.chance(clamp(0.3 + c.trust / 100, 0.1, 0.9))) {
          const amount = Math.round((3000 + c.power * 50) / 500) * 500;
          effects.push({ kind: 'funds', account: 'personal', delta: amount }, { kind: 'exposure', delta: 6 }, { kind: 'contact', contactId: c.id, balance: -2 }, { kind: 'stat', stat: 'credibility', delta: -1 });
          answer = `Nous avons justement besoin d’une « mission de conseil ». ${amount.toLocaleString('fr-FR')} € d’honoraires. Rien d’écrit sur l’objet, évidemment.`;
        } else answer = 'Je n’ai rien entendu. Et vous ne m’avez jamais appelé.';
      }
    } else {
      answer = rng.pick(['Toujours un plaisir. Nous suivons votre travail avec attention.', 'Merci de votre appel, nous en avions besoin en ce moment.', 'On se voit au prochain salon ?']);
      effects.push({ kind: 'contact', contactId: c.id, trust: 4 });
    }
  } else {
    if (optionId === 'argent') {
      p.flags['phoneMoneyFamily'] = d.week;
      const amount = 1500 + Math.round(rng.range(0, 3)) * 500;
      effects.push({ kind: 'funds', account: 'personal', delta: amount }, { kind: 'stat', stat: 'stress', delta: 2 });
      answer = `Bien sûr, mon grand… Je te fais un virement de ${amount.toLocaleString('fr-FR')} €. Tu manges bien, au moins ?`;
    } else if (optionId === 'conseil') {
      answer = rng.pick(['Sois toi-même. Les gens sentent quand on joue un rôle.', 'Dors, d’abord. On ne décide rien de bon à trois heures du matin.', 'Ton grand-père disait : « Ne promets que ce que tu peux tenir. »']);
      effects.push({ kind: 'stat', stat: 'stress', delta: -3 }, { kind: 'stat', stat: 'credibility', delta: 1 });
    } else {
      answer = rng.pick(['Tu as l’air fatigué·e. Tu passes dimanche ? Il y aura un gigot.', 'Ta tante t’a vu·e à la télé. Elle trouve que tu as maigri.', 'On est fiers de toi, tu sais. Même ton père, à sa façon.']);
      effects.push({ kind: 'stat', stat: 'stress', delta: -5 }, { kind: 'stat', stat: 'energy', delta: 3 });
    }
  }
  const summary = applyEffects(d, effects, { reason: `Appel : ${ask.replace(/[«»]/g, '').slice(0, 60)}` }, rng);
  summary.unshift(...notes);
  if (note) summary.unshift(note);
  addMessage(d, { kind: 'appel', who: key, from: e.name, role: e.role, text: answer, read: true, summary });
  return summary;
}

/** Répondre à un SMS */
export function answerMessage(d: GameState, msgId: string, replyId: string, rng: Rng): string[] {
  const m = d.phone?.messages.find(x => x.id === msgId);
  const r = m?.replies?.find(x => x.id === replyId);
  if (!m || !r || m.answered) return [];
  m.answered = r.label;
  m.read = true;
  addMessage(d, { kind: 'sms', who: m.who, from: m.from, role: m.role, text: r.label, outgoing: true, read: true });
  const summary = applyEffects(d, r.effects, { reason: `Au téléphone : « ${r.label} »` }, rng);
  if (r.answer) addMessage(d, { kind: 'sms', who: m.who, from: m.from, role: m.role, text: r.answer, read: true, summary });
  else if (summary.length) m.summary = summary;
  return summary;
}

export function markRead(d: GameState, who: string): void {
  for (const m of d.phone?.messages ?? []) if (m.who === who) m.read = true;
}

/* ── Messages entrants ─────────────────────────────────────── */

interface Incoming { text: string; replies?: PhoneReply[]; kind?: 'sms' | 'appel' }

const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
const rep = (id: string, label: string, effects: Effect[], answer?: string): PhoneReply => ({ id, label, effects, ...(answer ? { answer } : {}) });

export const TEAM_TIPS: Partial<Record<StaffRole, { text: string; effects: Effect[] }>> = {
  conseiller: { text: 'J’ai relu vos fiches : deux chiffres à corriger avant votre prochaine interview.', effects: [st('credibility', 1)] },
  community_manager: { text: 'Votre dernière vidéo cartonne chez les 18-25 ans. J’en prépare une autre ?', effects: [st('popularity', 1)] },
  chauffeur: { text: 'La voiture est prête. Et j’ai trouvé un raccourci : vous gagnerez une heure demain.', effects: [st('energy', 4)] },
  coach: { text: 'Respirez par le ventre, regardez la caméra, phrases courtes. On répète ce soir ?', effects: [st('credibility', 1), st('stress', -1)] },
  plume: { text: 'J’ai une formule pour votre discours de jeudi. Elle va faire mouche.', effects: [st('influence', 1)] },
  tresorier: { text: 'Les comptes sont propres. Évitez juste les notes de restaurant ce mois-ci.', effects: [{ kind: 'exposure', delta: -1 }] },
  attache_presse: { text: 'Trois journalistes veulent un portrait. J’en garde un, le plus sérieux.', effects: [st('popularity', 1), st('influence', 1)] },
  sondeur: { text: 'Les chiffres bougent dans le bon sens chez les retraités. On creuse ?', effects: [{ kind: 'momentum', delta: 2 }] },
  assistant_parlementaire: { text: 'J’ai préparé vos amendements et une note sur le texte de la semaine.', effects: [st('credibility', 1), st('stress', -1)] },
  directeur_campagne: { text: 'Le planning des déplacements est bouclé. On attaque le porte-à-porte samedi.', effects: [{ kind: 'momentum', delta: 3 }] },
  spin_doctor: { text: 'L’affaire de la semaine ? Je l’ai étouffée. On n’en parlera plus.', effects: [{ kind: 'exposure', delta: -2 }] },
  juriste: { text: 'J’ai relu le contrat de la mairie : il y avait un piège. Corrigé.', effects: [{ kind: 'exposure', delta: -2 }] },
  garde_du_corps: { text: 'Itinéraire sécurisé pour demain. Rien à signaler, restez prudent·e.', effects: [{ kind: 'flagAdd', key: 'menace', delta: -3 }] },
  chef_cabinet: { text: 'Votre agenda est rationalisé : trois réunions inutiles supprimées.', effects: [st('energy', 5), st('stress', -2)] },
  sherpa: { text: 'Mon homologue allemand est d’accord sur l’essentiel. Le sommet sera un succès.', effects: [{ kind: 'intl', prestige: 1 }] },
};

const TEAM_SMS: Partial<Record<StaffRole, Incoming[]>> = {
  attache_presse: [
    { text: 'Un journaliste du Parisien veut votre réaction sur la grève. Je dis quoi ?', replies: [
      rep('reagir', 'Je réagis, envoie-lui ma citation', [st('popularity', 1), { kind: 'exposure', delta: 1 }], 'Parfait, c’est envoyé. Vous serez en page 4.'),
      rep('decliner', 'Pas de commentaire', [st('credibility', 1)], 'Compris. Je botte en touche.')] },
  ],
  community_manager: [
    { text: 'Un tweet de vous de 2014 ressort. Rien de grave, mais ça tourne. On fait quoi ?', replies: [
      rep('humour', 'On assume avec humour', [st('popularity', 1)], 'Ça a pris ! 3 000 likes.'),
      rep('supprimer', 'Supprime-le', [st('credibility', -1)], 'Supprimé. Les captures, elles, circulent encore.')] },
  ],
  sondeur: [
    { text: 'Nouveau sondage confidentiel : vous gagnez 2 points chez les cadres, vous en perdez 3 chez les ouvriers.', replies: [
      rep('ok', 'Merci, on ajuste le discours', [{ kind: 'momentum', delta: 1 }])] },
  ],
  directeur_campagne: [
    { text: 'Il nous manque des bras pour le tractage de samedi. Vous pouvez passer ?', replies: [
      rep('oui', 'J’y serai', [st('popularity', 1), st('energy', -4), { kind: 'momentum', delta: 2 }], 'Génial, les militants vont être ravis.'),
      rep('non', 'Pas ce week-end', [st('stress', -1)], 'D’accord, je me débrouille.')] },
  ],
  assistant_parlementaire: [
    { text: 'Le rapporteur cherche des cosignataires pour un amendement sur votre dossier. Je signe pour vous ?', replies: [
      rep('signer', 'Oui, signe', [st('influence', 1), st('credibility', 1)]),
      rep('lire', 'Envoie-moi le texte d’abord', [st('stress', 1)], 'Envoyé. Il y a un article ambigu, en effet.')] },
  ],
  chef_cabinet: [
    { text: 'Le ministre des Finances veut vous voir avant l’arbitrage. 8 h demain ?', replies: [
      rep('oui', 'Confirme 8 h', [st('influence', 2), st('energy', -3)], 'C’est noté. Le café sera prêt.'),
      rep('decaler', 'Propose-lui midi', [st('stress', -1)], 'Il a accepté, un peu froissé.')] },
  ],
};

const GENERIC_TEAM: Incoming[] = [
  { text: 'Petit point : tout roule de mon côté. Besoin de quelque chose ce mois-ci ?', replies: [rep('merci', 'Merci, continue comme ça', [st('stress', -1)])] },
  { text: 'Je pose deux jours la semaine prochaine, c’est possible ?', replies: [
    rep('oui', 'Bien sûr, repose-toi', [st('stress', -1)], 'Merci, vraiment !'),
    rep('non', 'Pas maintenant, on a besoin de toi', [st('energy', 2)], 'D’accord… je reste.')] },
];

function chiefSms(d: GameState, rng: Rng): Incoming {
  const chief = leader(d)!;
  if (inPower(d) && d.player.rankId !== 'ministre') return highChiefSms(d, chief.id, rng);
  const vote = d.vote?.status === 'debat';
  if (vote && rng.chance(0.7)) {
    return { text: `Consigne du groupe sur « ${d.vote!.title} » : ${d.vote!.partyLine}. Je compte sur toi.`, replies: [
      rep('ok', 'Compte sur moi', [{ kind: 'faction', factionId: '*', delta: 2 }, { kind: 'npcRelation', npcId: chief.id, delta: 3 }], 'Merci. On se souviendra des fidèles.'),
      rep('libre', 'Je voterai selon ma conscience', [st('credibility', 1), { kind: 'npcRelation', npcId: chief.id, delta: -4 }], 'Tu as tort de jouer perso.')] };
  }
  return rng.pick<Incoming>([
    { text: 'Bureau politique mardi. J’aimerais que tu y défendes notre ligne sur l’économie.', replies: [
      rep('oui', 'J’y serai', [{ kind: 'faction', factionId: '*', delta: 1 }, st('energy', -3)], 'Parfait.'),
      rep('non', 'Je ne pourrai pas', [{ kind: 'npcRelation', npcId: chief.id, delta: -2 }], 'Dommage.')] },
    { text: 'On m’a dit que tu déjeunais avec des gens de l’autre camp. Je me trompe ?', replies: [
      rep('nier', 'Simple courtoisie républicaine', [{ kind: 'npcRelation', npcId: chief.id, delta: -1 }], 'Méfie-toi des courtoisies.'),
      rep('assumer', 'Je parle à tout le monde', [st('influence', 1), { kind: 'npcRelation', npcId: chief.id, delta: -3 }], 'On en reparlera.')] },
    { text: 'Bravo pour ton passage télé hier. Continue comme ça.', replies: [
      rep('merci', 'Merci, ça me touche', [{ kind: 'npcRelation', npcId: chief.id, delta: 2 }])] },
    { text: 'Il me faut des volontaires pour la tournée d’été. Tu en es ?', replies: [
      rep('oui', 'Avec plaisir', [{ kind: 'cohesion', delta: 2 }, st('energy', -4), { kind: 'npcRelation', npcId: chief.id, delta: 3 }], 'Je savais que je pouvais compter sur toi.'),
      rep('non', 'Mon agenda est plein', [{ kind: 'npcRelation', npcId: chief.id, delta: -2 }])] },
  ]);
}

/** Le chef du parti écrit au Président (ou au Premier ministre) : vouvoiement, et d'autres sujets */
function highChiefSms(d: GameState, chiefId: string, rng: Rng): Incoming {
  const h = honorific(d);
  return rng.pick<Incoming>([
    { text: `${h}, les députés du groupe grognent : ils se sentent tenus à l’écart. Un déjeuner avec eux calmerait les esprits.`, replies: [
      rep('dejeuner', 'Les recevoir à déjeuner', [{ kind: 'cohesion', delta: 3 }, st('energy', -3), { kind: 'npcRelation', npcId: chiefId, delta: 2 }], 'Merci. Ils en avaient besoin.'),
      rep('non', 'Ils ont un gouvernement pour ça', [{ kind: 'cohesion', delta: -2 }, { kind: 'npcRelation', npcId: chiefId, delta: -2 }], 'Je transmettrai. Avec diplomatie.')] },
    { text: `${h}, le parti prépare son congrès. Un message de vous en ouverture serait très attendu.`, replies: [
      rep('video', 'Enregistrer un message vidéo', [{ kind: 'faction', factionId: '*', delta: 2 }, { kind: 'npcRelation', npcId: chiefId, delta: 2 }], 'Parfait. Standing ovation garantie.'),
      rep('distance', 'Rester au-dessus des partis', [st('credibility', 1), { kind: 'faction', factionId: '*', delta: -1 }], 'Je comprends. Certains ne comprendront pas.')] },
    { text: `${h}, les sondages du parti sont mauvais dans les régions. Il nous faudrait un geste pour les élus locaux.`, replies: [
      rep('geste', 'Recevoir les présidents de région', [{ kind: 'segment', segment: 'ruraux', delta: 1 }, st('energy', -3), { kind: 'npcRelation', npcId: chiefId, delta: 2 }], 'Je préviens tout le monde.'),
      rep('plus_tard', 'Après les réformes', [{ kind: 'npcRelation', npcId: chiefId, delta: -1 }], 'Les élections, elles, n’attendront pas.')] },
    { text: `${h}, bravo pour l’intervention d’hier soir. Les militants sont regonflés.`, replies: [
      rep('merci', 'Merci, transmettez-leur ma gratitude', [{ kind: 'npcRelation', npcId: chiefId, delta: 2 }, { kind: 'cohesion', delta: 1 }])] },
  ]);
}

function personalitySms(d: GameState, id: string, rel: number, rng: Rng): Incoming {
  if (rel <= -25) return rng.pick<Incoming>([
    { text: 'J’ai vu votre sortie d’hier. Vous me le paierez.', replies: [
      rep('calmer', 'Rien de personnel', [{ kind: 'npcRelation', npcId: id, delta: 4 }], 'On verra.'),
      rep('defier', 'J’attends de voir', [st('influence', 1), { kind: 'npcRelation', npcId: id, delta: -5 }])] },
  ]);
  return rng.pick<Incoming>([
    { text: 'Un café discret, loin des caméras ? J’ai une idée qui pourrait nous servir tous les deux.', replies: [
      rep('oui', 'Avec plaisir', [{ kind: 'npcRelation', npcId: id, delta: 5 }, st('influence', 1), st('energy', -2)], highOffice(d) ? 'Un dîner discret, alors. Votre secrétariat m’appellera.' : 'Mardi, 8 h, au bistrot derrière l’Assemblée.'),
      rep('non', 'Pas maintenant', [{ kind: 'npcRelation', npcId: id, delta: -1 }])] },
    office(d) === 'couronne'
      ? { text: 'Votre discours d’hier m’a touché·e, je dois l’avouer. Même un républicain peut le reconnaître.', replies: [
        rep('merci', 'Merci, cela me touche', [{ kind: 'npcRelation', npcId: id, delta: 3 }, st('stress', -1)])] }
      : { text: office(d) === 'depute' || office(d) === 'base'
          ? 'Entre nous : votre amendement est bon. Je ne le dirai pas en séance, mais je ne voterai pas contre.'
          : 'Entre nous : votre réforme tient la route. Je ne le dirai pas en public, mais je ne voterai pas contre.', replies: [
        rep('merci', 'Merci, je m’en souviendrai', [{ kind: 'npcRelation', npcId: id, delta: 3 }, { kind: 'flagAdd', key: 'billSupport', delta: 2 }])] },
    { text: 'On dit que vous visez plus haut. Prudence : certains vous attendent au tournant.', replies: [
      rep('merci', 'Merci du conseil', [{ kind: 'npcRelation', npcId: id, delta: 2 }, st('stress', 1)])] },
  ]);
}

function contactSms(d: GameState, rng: Rng): { who: string; from: string; role: string; msg: Incoming } | null {
  if (!d.contacts.length) return null;
  const c = rng.pick(d.contacts);
  const who = `contact:${c.id}`;
  const base = { who, from: c.name, role: CONTACT_LABEL[c.type] };
  switch (c.type) {
    case 'journaliste': return { ...base, msg: { text: 'Une réaction sur la polémique du jour ? Je boucle dans une heure.', replies: [
      rep('oui', 'Voici ma citation…', [st('popularity', 1), { kind: 'contact', contactId: c.id, trust: 3 }], 'Merci, vous serez en tête d’article.'),
      rep('off', 'En off seulement', [st('influence', 1), { kind: 'contact', contactId: c.id, trust: 2 }], 'Bien noté, « un proche du dossier ».'),
      rep('non', 'Pas aujourd’hui', [{ kind: 'contact', contactId: c.id, trust: -2 }])] } };
    case 'syndicat': return { ...base, msg: { text: inPower(d) ? `La base gronde sur les salaires. Vous nous recevez ${seat(d)} cette semaine ?` : 'La base gronde sur les salaires. Vous viendrez à notre assemblée générale ?', replies: [
      rep('oui', 'J’y serai', [{ kind: 'contact', contactId: c.id, trust: 5 }, st('energy', -4), { kind: 'dossier', domain: 'social', delta: 2 }], 'Merci, ça comptera.'),
      rep('non', 'Je vous enverrai un message de soutien', [{ kind: 'contact', contactId: c.id, trust: -1 }])] } };
    case 'association': return { ...base, msg: { text: 'Notre gala annuel a lieu le 12. Vous nous feriez l’honneur ?', replies: [
      rep('oui', 'Avec plaisir', [{ kind: 'contact', contactId: c.id, trust: 4 }, st('popularity', 1), st('energy', -3)], 'Formidable, nous vous gardons une place.'),
      rep('non', 'Je suis pris·e ce soir-là', [{ kind: 'contact', contactId: c.id, trust: -1 }])] } };
    case 'culte': return { ...base, msg: { text: c.balance < 0 ? 'Nous avons été heureux de vous aider. Notre communauté aimerait être entendue sur le projet de loi en cours.' : 'Notre grande fête annuelle a lieu le mois prochain. Votre présence serait un beau signe d’écoute.', replies: c.balance < 0 ? [
      rep('ecouter', 'Je recevrai vos représentants', [{ kind: 'contact', contactId: c.id, trust: 3, balance: 1 }, st('credibility', -1)], 'Merci. Nous savons que nous pouvons compter sur vous.'),
      rep('laicite', 'La loi est la même pour tous', [st('credibility', 2), { kind: 'contact', contactId: c.id, trust: -5 }], 'Nous en prenons acte.')] : [
      rep('oui', 'J’y serai', [{ kind: 'contact', contactId: c.id, trust: 4 }, st('popularity', 1), st('energy', -3)], 'Nous vous réserverons un accueil chaleureux.'),
      rep('non', 'Je vous enverrai un message', [{ kind: 'contact', contactId: c.id, trust: -1 }])] } };
    default: return { ...base, msg: { text: 'Un déjeuner la semaine prochaine ? Nous avons un projet qui pourrait vous intéresser.', replies: [
      rep('oui', 'Volontiers', [{ kind: 'contact', contactId: c.id, trust: 4 }, st('influence', 1), { kind: 'exposure', delta: 1 }], 'Parfait, chez Drouant, 13 h.'),
      rep('prudence', 'Envoyez-moi plutôt une note', [st('credibility', 1)], 'Bien sûr, vous l’aurez demain.'),
      rep('non', 'Ce ne serait pas convenable', [st('credibility', 1), { kind: 'contact', contactId: c.id, trust: -3 }])] } };
  }
}

const FAMILY: Incoming[] = [
  { text: 'Tu as oublié l’anniversaire de ta sœur. Appelle-la. Bisous. Maman', replies: [
    rep('appeler', 'Je l’appelle ce soir', [st('stress', -2), st('energy', -1)], 'Elle était ravie. Tu vois, ce n’était pas compliqué.'),
    rep('plus_tard', 'Je suis débordé·e, ce week-end', [st('stress', 2)])] },
  { text: 'On t’a vu·e à la télé ! Ton père a enregistré l’émission.', replies: [rep('merci', '❤️', [st('stress', -2)])] },
  { text: 'Repas de famille dimanche. Tu viens, cette fois ?', replies: [
    rep('oui', 'J’y serai', [st('stress', -4), st('energy', 2)], 'Je fais ton gâteau préféré.'),
    rep('non', 'Pas ce dimanche, désolé·e', [st('stress', 1)], 'Comme d’habitude…')] },
];

/** Chaque mois : quelques SMS et appels manqués */
export function monthlyPhone(d: GameState, rng: Rng): void {
  phone(d);
  // Une même personne n'écrit qu'une fois par mois
  const sent = new Set(d.phone!.messages.filter(m => m.week === d.week && !m.outgoing && m.replies?.length).map(m => m.who));
  const send = (m: Omit<PhoneMessage, 'id' | 'week'>): boolean => {
    if (sent.has(m.who)) return false;
    sent.add(m.who);
    addMessage(d, m);
    return true;
  };
  monthlyDebts(d, sent, rng);
  // Un appel entrant, peut-être : une vraie occasion, à prendre avant la fin du mois
  monthlyIncomingCall(d, rng, m => { addMessage(d, m); });
  // Les numéros spéciaux écrivent aussi
  if ((d.apocalypse?.phase === 3 || Number(d.player.flags['devilDebt'] ?? 0) > 0) && rng.chance(0.4)) {
    send({ kind: 'sms', who: 'sc:diable', from: 'Monsieur Nicolas', role: 'Le Diable, en personne', text: rng.pick(['Je pense à vous. Souvent.', 'Belle intervention hier. J’ai presque cru que vous y croyiez.', 'Un petit service contre un grand ? Mon offre tient toujours.']),
      replies: [rep('ignorer', 'Ne pas répondre', [st('stress', 1)]), rep('repondre', '« Laissez-moi tranquille. »', d.apocalypse?.phase === 3 ? [{ kind: 'apocalypse', resistance: 2 }, st('stress', 2)] : [st('stress', 2)], '😊')] });
  }
  if (d.alien && d.alien.phase >= 1 && d.alien.phase < 4 && rng.chance(0.25)) {
    send({ kind: 'sms', who: 'sc:alien', from: `L’émissaire ${d.alien.species}`, role: 'Fréquence 1 420 MHz', text: rng.pick(['·· –· ·– (VOUS. DORMEZ. TROP. PEU.)', 'QUESTION : POURQUOI. LES. HUMAINS. VOTENT. POUR. CEUX. QU’ILS. DÉTESTENT ?', 'NOUS. AIMONS. LE. FROMAGE.']),
      replies: [rep('repondre', 'Répondre patiemment', [{ kind: 'alien', comprehension: 3, confiance: 2 }], 'MERCI. PETIT. HUMAIN.'), rep('ignorer', 'Ignorer', [{ kind: 'alien', confiance: -2 }])] });
  }
  if (d.lodge && rng.chance(0.2)) {
    send({ kind: 'sms', who: 'sc:loge', from: `Le Vénérable · ${d.lodge.loge}`, role: `Votre loge · ${d.lodge.obedience}`, text: 'Tenue mardi, 19 h 30. Votre présence serait appréciée, mon frère.',
      replies: [rep('oui', 'J’y serai', [{ kind: 'lodge', fraternite: 3 }, st('energy', -2)], 'Bien. Le parvis vous attend.'), rep('non', 'Empêché·e', [{ kind: 'lodge', fraternite: -1 }])] });
  }
  const n = 1 + (rng.chance(0.6) ? 1 : 0) + (rng.chance(0.3) ? 1 : 0);
  let delivered = 0;
  for (let tries = 0; tries < n * 3 && delivered < n; tries++) {
    const roll = rng.next();
    const team = d.player.team;
    let ok = false;
    if (roll < 0.35 && team.length) {
      const r = rng.pick(team);
      // Pas d'amendement à cosigner hors de l'Assemblée, pas de tractage pour un chef d'État
      const own = (TEAM_SMS[r.role] ?? []).filter(() => !(r.role === 'assistant_parlementaire' && office(d) !== 'depute') && !(r.role === 'directeur_campagne' && highOffice(d)));
      const pool = [...own, ...GENERIC_TEAM];
      if (!sent.has(`equipe:${r.id}`)) ok = send({ kind: 'sms', who: `equipe:${r.id}`, from: r.name, role: STAFF_BY_ROLE.get(r.role)?.title ?? r.role, ...rng.pick(pool) });
    } else if (roll < 0.6 && leader(d) && office(d) !== 'couronne') {
      const chief = leader(d)!;
      if (!sent.has('chef')) ok = send({ kind: 'sms', who: 'chef', from: chief.name, role: 'Chef·fe du parti', ...chiefSms(d, rng) });
    } else if (roll < 0.7 && (d.player.phoneBook ?? []).length) {
      const p = d.npcs.find(x => x.id === rng.pick(d.player.phoneBook!));
      if (p && !sent.has(`perso:${p.id}`)) ok = send({ kind: 'sms', who: `perso:${p.id}`, from: p.name, role: 'Personnalité', ...personalitySms(d, p.id, p.relationToPlayer, rng) });
    } else if (roll < 0.88) {
      const c = contactSms(d, rng);
      if (c && !sent.has(c.who)) ok = send({ kind: rng.chance(0.25) ? 'appel' : 'sms', who: c.who, from: c.from, role: c.role, ...c.msg, text: c.msg.text });
    } else if (!sent.has('proche')) {
      ok = send({ kind: 'sms', who: 'proche', from: 'Maman', role: 'Famille', ...rng.pick(FAMILY) });
    }
    if (ok) delivered++;
  }
  // Les SMS laissés sans réponse trop longtemps refroidissent les relations
  for (const m of d.phone!.messages) {
    if (!m.outgoing && m.replies && !m.answered && d.week - m.week === 2) {
      m.answered = 'Sans réponse';
      if (m.who.startsWith('contact:')) applyEffects(d, [{ kind: 'contact', contactId: m.who.slice(8), trust: -1 }], {}, rng);
    }
  }
}

/** Premier jour : quelques messages pour faire connaissance */
export function welcomePhone(d: GameState): void {
  phone(d);
  addMessage(d, { kind: 'sms', who: 'proche', from: 'Maman', role: 'Famille', text: 'On est fiers de toi. Mange bien et dors un peu, la politique ce n’est pas une vie. Bisous.',
    replies: [rep('merci', 'Merci maman ❤️', [st('stress', -2)], 'Appelle-moi de temps en temps !')] });
  const chief = leader(d);
  if (chief) addMessage(d, { kind: 'sms', who: 'chef', from: chief.name, role: 'Chef·fe du parti', text: 'Bienvenue dans l’aventure. Ma porte est ouverte : un coup de fil suffit.',
    replies: [rep('merci', 'Merci, je compte sur vous', [{ kind: 'npcRelation', npcId: chief.id, delta: 2 }], 'Et moi sur toi.')] });
}

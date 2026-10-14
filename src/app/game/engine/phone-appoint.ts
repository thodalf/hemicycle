import { DOMAINS, DOMAIN_LABELS, Domain, Effect, GameState } from '../models/game.models';
import { MINISTRIES } from './government';
import { pushNews } from './effects';
import { pmDecision } from './cabinet';
import { Rng, clamp } from './rng';
import type { CallOption, PhoneEntry } from './phone';

/* ============================================================
 *  Nommer par téléphone : à l'Élysée, on peut proposer Matignon
 *  ou un ministère à n'importe quel contact du répertoire ; à
 *  Matignon, on compose son équipe ministre par ministre. On
 *  peut aussi limoger un ministre, ou changer de Premier ministre.
 *  La personne appelée peut refuser.
 * ============================================================ */

const EXPERTS = ['Hélène Carrez', 'Marc Vidal-Lenoir', 'Aïcha Benamar', 'Laurent Pichon', 'Sophie Delattre', 'Yves Kermarrec', 'Inès Lacoste', 'Paul-Henri Duval', 'Nadia Ferrière', 'Olivier Grandjean', 'Mathilde Roche', 'Karim Saïdi', 'Bérénice Aubry', 'Thierry Lannoy'];
const MIN_SHORT: Record<Domain, string> = {
  economie: 'Économie', social: 'Travail', ecologie: 'Écologie', securite: 'Intérieur', justice: 'Justice',
  education: 'Éducation', sante: 'Santé', numerique: 'Numérique', territoires: 'Territoires', diplomatie: 'Affaires étrangères',
};

const PM_COOLDOWN = 6;

/** Qui nomme : le président (hors cohabitation), ou le Premier ministre pour les ministres */
function appointer(d: GameState): 'president' | 'pm' | null {
  if (d.player.rankId === 'president' && d.presidency && !d.presidency.cohabitation) return 'president';
  if (d.player.rankId === 'premier_ministre') return 'pm';
  return null;
}

/** La clé qui identifie le gouvernement en place (président + Matignon) */
export function cabinetSalt(d: GameState): string {
  return d.presidential.incumbentName + (d.presidency?.primeMinister ?? '');
}

/** Le nom du ministre choisi par téléphone, s'il y en a un pour ce gouvernement */
export function pickedMinister(d: GameState, dom: Domain): string | undefined {
  const c = d.cabinetPicks;
  return c && c.salt === cabinetSalt(d) ? c.picks[dom] : undefined;
}

function setPick(d: GameState, dom: Domain, name: string): void {
  const salt = cabinetSalt(d);
  if (!d.cabinetPicks || d.cabinetPicks.salt !== salt) d.cabinetPicks = { salt, picks: {} };
  d.cabinetPicks.picks[dom] = name;
  if (d.presidency?.cabinet) d.presidency.cabinet[dom] = name;
}

function personOf(d: GameState, e: PhoneEntry) {
  const npcId = e.key.startsWith('perso:') ? e.key.slice(6) : e.key.startsWith('collegue:') ? e.key.slice(9) : e.key === 'chef' ? d.party.leaderNpcId : null;
  const npc = npcId ? d.npcs.find(n => n.id === npcId) : undefined;
  const contact = e.key.startsWith('contact:') ? d.contacts.find(c => `contact:${c.id}` === e.key) : undefined;
  return { npc, contact };
}

/** Les options « nommer » ajoutées aux appels */
export function appointOptions(d: GameState, e: PhoneEntry, block?: string): CallOption[] {
  const who = appointer(d);
  if (!who) return [];
  const out: CallOption[] = [];
  const monthBusy = Number(d.player.flags['appointWeek'] ?? -99) === d.week ? 'Déjà un remaniement ce mois-ci' : undefined;
  const pmBusy = d.week - Number(d.player.flags['pmChangeWeek'] ?? -99) < PM_COOLDOWN ? 'Matignon vient de changer : attendez quelques mois' : undefined;
  const { npc, contact } = personOf(d, e);

  // Un membre du gouvernement : le limoger
  if (e.kind === 'gouvernement') {
    if (e.key === 'gouv:pm' && who === 'president') {
      out.push({ id: 'limoger', label: '🏛️ Demander sa démission à Matignon', hint: 'Vous choisirez aussitôt un nouveau Premier ministre. Le sortant ne vous le pardonnera pas.', ok: !block && !pmBusy, reason: block ?? pmBusy });
    } else if (e.key.startsWith('gouv:') && e.key !== 'gouv:pr' && e.key !== 'gouv:pm') {
      out.push({ id: 'limoger', label: '✂️ Lui retirer son portefeuille', hint: 'Un·e expert·e prend sa place. Un ministre limogé fait rarement un allié.', ok: !block && !monthBusy, reason: block ?? monthBusy });
    }
    return out;
  }

  if (!npc && !contact) return out;
  if (npc && npc.id === d.presidency?.pmNpcId) return out;
  if (who === 'president') {
    const isPm = npc ? d.presidency?.pmNpcId === npc.id : d.presidency?.primeMinister === e.name;
    if (!isPm) out.push({ id: 'nommer_pm', label: '🏛️ Lui proposer Matignon', hint: npc && npc.partyId !== d.party.id ? 'Un Premier ministre venu d’un autre parti : majorité élargie, parti furieux.' : contact ? 'La société civile à Matignon : audace saluée, majorité fragile.' : 'Un Premier ministre de votre camp. Il ou elle peut refuser.', ok: !block && !pmBusy, reason: block ?? pmBusy });
  }
  const cur = new Set(DOMAINS.filter(dom => pickedMinister(d, dom) === e.name || d.presidency?.cabinet?.[dom] === e.name));
  for (const dom of DOMAINS) {
    out.push({
      id: `min_${dom}`, label: `💼 ${MIN_SHORT[dom]}`, chip: MIN_SHORT[dom], group: 'ministere',
      hint: `Lui confier le ministère ${MINISTRIES[dom]}.`,
      ok: !block && !monthBusy && !cur.has(dom), reason: block ?? monthBusy ?? (cur.has(dom) ? 'Déjà à ce poste' : undefined),
    });
  }
  return out;
}

export function isAppoint(id: string): boolean {
  return id === 'nommer_pm' || id === 'limoger' || id.startsWith('min_');
}

const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });

/** Le résultat d'un appel « nommer » */
export function appointCall(d: GameState, e: PhoneEntry, id: string, rng: Rng): { answer: string; effects: Effect[]; notes: string[] } {
  const { npc, contact } = personOf(d, e);
  const pres = d.presidency;
  const notes: string[] = [];
  const effects: Effect[] = [];

  if (id === 'limoger') {
    if (e.key === 'gouv:pm' && pres) {
      const old = pres.pmNpcId ? d.npcs.find(n => n.id === pres.pmNpcId) : undefined;
      if (old) effects.push({ kind: 'npcRelation', npcId: old.id, delta: -20 });
      d.player.flags['pmChangeWeek'] = d.week;
      if (!d.pendingDecisions.some(x => x.tag === 'nommer_pm')) d.pendingDecisions.push(pmDecision(d));
      effects.push({ kind: 'presidency', approval: -1 }, st('politicalCapital', -6));
      pushNews(d, 'actu', 'neutral', `${e.name} quitte Matignon`, 'Le Premier ministre remet sa démission à l’issue d’un entretien téléphonique « franc et direct ». Le nom de son successeur est attendu.');
      return { answer: rng.pick(['Je l’ai compris depuis des semaines. Ma lettre sera sur votre bureau ce soir.', 'C’est une erreur. Mais je respecte vos institutions. Et je m’en souviendrai.', 'Très bien. Je vous souhaite bonne chance avec mon successeur.']), effects, notes: ['À choisir : le nouveau Premier ministre'] };
    }
    const dom = e.key.slice(5) as Domain;
    const old = d.npcs.find(n => n.name === e.name);
    if (old) effects.push({ kind: 'npcRelation', npcId: old.id, delta: -15 });
    const repl = rng.pick(EXPERTS.filter(x => x !== e.name));
    setPick(d, dom, repl);
    d.player.flags['appointWeek'] = d.week;
    effects.push(st('credibility', 1), st('politicalCapital', -3), ...(pres ? [{ kind: 'presidency', approval: 1 } as Effect] : []));
    pushNews(d, 'actu', 'neutral', `Remaniement : ${repl} ministre ${MINISTRIES[dom]}`, `${e.name} quitte le gouvernement après un coup de téléphone. ${repl}, réputé·e pour sa rigueur, prend le portefeuille.`);
    return { answer: rng.pick(['Vous auriez pu me le dire en face.', 'Je m’y attendais. Je rends les clés demain matin.', 'Après tout ce que j’ai fait pour vous ? Très bien.']), effects, notes: [`${repl} remplace ${e.name}`] };
  }

  // Acceptera-t-il ?
  const rel = npc ? npc.relationToPlayer : contact ? contact.trust - 20 : 0;
  const same = npc?.partyId === d.party.id;
  const chance = clamp(0.5 + rel / 120 + (same ? 0.2 : 0) + (id === 'nommer_pm' ? 0.1 : 0), 0.1, 0.96);
  if (!rng.chance(chance)) {
    effects.push(st('stress', 2), ...(npc ? [{ kind: 'npcRelation', npcId: npc.id, delta: -2 } as Effect] : []));
    return {
      answer: rng.pick(npc && rel < -10 ? ['Sous vos ordres ? Jamais.', 'Vous croyez m’acheter avec un maroquin ? Non merci.'] : ['C’est un honneur… mais je dois refuser. Ma famille, vous comprenez.', 'Laissez-moi y réfléchir. Non, en fait : c’est non.', 'Je suis plus utile là où je suis.']),
      effects, notes: ['Proposition déclinée'],
    };
  }

  if (id === 'nommer_pm' && pres) {
    d.player.flags['pmChangeWeek'] = d.week;
    const prevNpc = pres.pmNpcId ? d.npcs.find(n => n.id === pres.pmNpcId) : undefined;
    if (prevNpc) effects.push({ kind: 'npcRelation', npcId: prevNpc.id, delta: -12 });
    effects.push({ kind: 'presidency', pmName: e.name, ...(npc ? { pmNpcId: npc.id } : {}), approval: 1 }, st('politicalCapital', -8));
    if (npc) {
      effects.push({ kind: 'npcRelation', npcId: npc.id, delta: 15 }, { kind: 'npcStat', npcId: npc.id, stat: 'influence', delta: 6 });
      if (same) effects.push({ kind: 'cohesion', delta: 2 });
      else effects.push({ kind: 'presidency', majority: 5 }, { kind: 'cohesion', delta: -5 });
    } else if (contact) {
      effects.push({ kind: 'presidency', majority: -3, approval: 3 }, { kind: 'contact', contactId: contact.id, trust: 10 }, st('popularity', 2));
    }
    pushNews(d, 'actu', 'neutral', `${e.name} nommé·e à Matignon`, `Un coup de téléphone, un oui, et un décret au Journal officiel : ${e.name} devient Premier ministre.`);
    return { answer: rng.pick(['C’est oui. Je serai à Matignon demain à l’aube.', 'Je ne m’y attendais pas… J’accepte. Vous ne le regretterez pas.', 'Oui. À une condition : qu’on me laisse gouverner.']), effects, notes: [`${e.name} Premier ministre`] };
  }

  const dom = id.slice(4) as Domain;
  if (!DOMAINS.includes(dom)) return { answer: 'Pardon ? La ligne a coupé.', effects, notes };
  const prevName = pickedMinister(d, dom) ?? pres?.cabinet?.[dom];
  const prev = prevName ? d.npcs.find(n => n.name === prevName) : undefined;
  if (prev && prev.id !== npc?.id) effects.push({ kind: 'npcRelation', npcId: prev.id, delta: -10 });
  setPick(d, dom, e.name);
  d.player.flags['appointWeek'] = d.week;
  effects.push(st('politicalCapital', d.player.rankId === 'premier_ministre' ? -6 : -4));
  if (npc) {
    effects.push({ kind: 'npcRelation', npcId: npc.id, delta: 12 }, { kind: 'npcStat', npcId: npc.id, stat: 'influence', delta: 4 });
    if (!same) effects.push(...(pres ? [{ kind: 'presidency', majority: 3 } as Effect] : [{ kind: 'government', majority: 3 } as Effect]), { kind: 'cohesion', delta: -3 });
    else effects.push({ kind: 'cohesion', delta: 1 });
  } else if (contact) {
    effects.push({ kind: 'contact', contactId: contact.id, trust: 8 }, { kind: 'dossier', domain: dom, delta: contact.domain === dom ? 6 : 2 }, st('popularity', 1));
  }
  pushNews(d, 'actu', 'neutral', `${e.name}, ministre ${MINISTRIES[dom]}`, `Nomination surprise par téléphone : ${e.name} hérite du portefeuille ${DOMAIN_LABELS[dom].toLowerCase()}.`);
  return { answer: rng.pick(['J’accepte. Je serai au ministère dès lundi.', 'Ministre ? Moi ? … Oui. Oui, évidemment.', 'Merci de votre confiance. Je ne vous décevrai pas.']), effects, notes: [`${e.name} ministre ${MINISTRIES[dom]}`] };
}

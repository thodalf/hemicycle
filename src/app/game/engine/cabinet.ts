import { DOMAINS, DOMAIN_LABELS, Decision, DecisionChoice, Domain, Effect, GameState, Npc } from '../models/game.models';
import { MINISTRIES } from './government';
import { pushNews } from './effects';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  L'Élysée nomme son gouvernement : d'abord un·e Premier·e
 *  ministre (un·e fidèle, un poids lourd, une figure de l'autre
 *  camp ou un·e technocrate), puis le casting des ministères.
 *  Les ministres nommés figurent ensuite dans le téléphone.
 * ============================================================ */

const TECHNOCRATS = ['Claire Montel', 'Antoine Delacroix', 'Sylvie Brunel-Haas', 'Jean-Baptiste Royer', 'Élodie Marchetti', 'Philippe Garnier'];
const EXPERTS = ['Hélène Carrez', 'Marc Vidal-Lenoir', 'Aïcha Benamar', 'Laurent Pichon', 'Sophie Delattre', 'Yves Kermarrec', 'Inès Lacoste', 'Paul-Henri Duval', 'Nadia Ferrière', 'Olivier Grandjean', 'Mathilde Roche', 'Karim Saïdi'];

const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
const pres = (x: Omit<Extract<Effect, { kind: 'presidency' }>, 'kind'>): Effect => ({ kind: 'presidency', ...x });

export function canAppoint(d: GameState): string | null {
  if (!d.presidency) return 'Réservé au président de la République';
  if (d.presidency.cohabitation) return 'En cohabitation, Matignon revient à la majorité adverse';
  return null;
}

function ownParty(d: GameState): Npc[] {
  return d.npcs.filter(n => n.partyId === d.party.id && n.id !== d.party.leaderNpcId);
}

/** Étape 1 : Matignon */
export function pmDecision(d: GameState): Decision {
  const mine = ownParty(d);
  const loyal = [...mine].sort((a, b) => b.relationToPlayer - a.relationToPlayer)[0];
  const heavy = [...mine].filter(n => n !== loyal).sort((a, b) => b.influence - a.influence)[0];
  const allyId = d.coalition?.partyId ?? [...d.otherParties].sort((a, b) => Math.abs(a.position - d.party.position) - Math.abs(b.position - d.party.position))[0]?.id;
  const other = d.npcs.filter(n => n.partyId === allyId).sort((a, b) => b.popularity - a.popularity)[0];
  const tech = TECHNOCRATS.find(n => n !== d.presidency?.primeMinister) ?? TECHNOCRATS[0];
  const next: Effect = { kind: 'decision', templateId: 'casting_gouvernement' };
  const choices: DecisionChoice[] = [];
  if (loyal) choices.push({ id: 'fidele', label: `${loyal.name}, un·e fidèle`, hint: 'Loyauté totale, autorité discutée',
    effects: [pres({ pmName: loyal.name, pmNpcId: loyal.id }), { kind: 'npcRelation', npcId: loyal.id, delta: 12 }, { kind: 'cohesion', delta: 3 }, pres({ majority: -2 }), next],
    outcome: `${loyal.name} s’installe rue de Varenne. « Je serai votre premier collaborateur. »` });
  if (heavy) choices.push({ id: 'poids_lourd', label: `${heavy.name}, le poids lourd`, hint: 'Une majorité soudée… et un rival à Matignon',
    effects: [pres({ pmName: heavy.name, pmNpcId: heavy.id, majority: 4 }), { kind: 'npcStat', npcId: heavy.id, stat: 'influence', delta: 8 }, { kind: 'faction', factionId: '*', delta: 4 }, next],
    outcome: `${heavy.name} accepte, en posant ses conditions. Matignon aura sa propre ligne.` });
  if (other) choices.push({ id: 'ouverture', label: `${other.name}, une figure de l’autre camp`, hint: 'L’ouverture : majorité élargie, parti furieux',
    effects: [pres({ pmName: other.name, pmNpcId: other.id, majority: 8, approval: 3 }), { kind: 'cohesion', delta: -6 }, { kind: 'faction', factionId: 'ligne_dure', delta: -6 }, { kind: 'npcRelation', npcId: other.id, delta: 15 }, next],
    outcome: `Coup de tonnerre : ${other.name} à Matignon. Vos camarades n’en reviennent pas.` });
  choices.push({ id: 'technocrate', label: `${tech}, un·e haut·e fonctionnaire`, hint: 'Compétence reconnue, aucun poids politique',
    effects: [pres({ pmName: tech, approval: -1 }), st('credibility', 3), next],
    outcome: `${tech}, inconnu·e du grand public, connaît chaque ligne du budget.` });
  return {
    id: nextId(d, 'dec'), tag: 'nommer_pm', week: d.week, deadlineWeek: d.week + 1, source: 'carriere',
    title: 'Nommer le Premier ministre',
    context: 'Le décret doit paraître au Journal officiel demain. Le choix de Matignon donnera le ton du quinquennat.',
    choices,
  };
}

/** Étape 2 : le casting des ministères */
export function castingDecision(d: GameState): Decision {
  const pm = d.presidency?.primeMinister ?? 'Le Premier ministre';
  const c = (id: string, label: string, hint: string, effects: Effect[], outcome: string): DecisionChoice => ({ id, label, hint, effects: [...effects, pres({ cabinet: id })], outcome });
  return {
    id: nextId(d, 'dec'), tag: 'casting_gouvernement', week: d.week, deadlineWeek: d.week + 1, source: 'carriere',
    title: 'Composer le gouvernement',
    context: `${pm} vous apporte la liste des ministres pressentis. Il reste à trancher l’équilibre d’ensemble.`,
    choices: [
      c('fideles', 'Une équipe de fidèles', 'Soudée, mais on parlera de copinage', [pres({ majority: -2 }), { kind: 'cohesion', delta: 6 }, st('credibility', -1)], 'Des visages connus, une équipe qui ne fuitera pas.'),
      c('courants', 'L’équilibre des courants', 'Chaque sensibilité a ses ministres', [pres({ majority: 3 }), { kind: 'faction', factionId: '*', delta: 4 }, st('politicalCapital', -10)], 'Tout le parti est représenté. Les arbitrages seront longs.'),
      c('ouverture', 'Un gouvernement d’ouverture', 'Des ministres venus d’autres partis', [pres({ majority: 7, approval: 2 }), { kind: 'cohesion', delta: -6 }], 'Trois ministres de l’autre camp : la presse adore.'),
      c('societe', 'La société civile', 'Médecins, chefs d’entreprise, sportifs', [pres({ approval: 4, majority: -3 }), st('popularity', 2), { kind: 'segment', segment: '*', delta: 1 }], 'Une ancienne championne olympique aux Sports, un urgentiste à la Santé.'),
      c('experts', 'Des experts', 'Technocrates sans étiquette', [st('credibility', 4), pres({ approval: -2 }), { kind: 'economy', confidence: 3 }], 'Des CV impressionnants, des visages inconnus.'),
    ],
  };
}

/** Distribue les portefeuilles selon le style choisi */
export function buildCabinet(d: GameState, style: string, rng: Rng): Record<Domain, string> {
  const mine = ownParty(d).filter(n => n.id !== d.presidency?.pmNpcId);
  const others = d.npcs.filter(n => n.partyId !== d.party.id && n.id !== d.presidency?.pmNpcId);
  const pool = style === 'experts' || style === 'societe' ? [] : style === 'ouverture' ? [...mine.slice(0, 6), ...others.slice(0, 4)] : mine;
  const sorted = style === 'fideles' ? [...pool].sort((a, b) => b.relationToPlayer - a.relationToPlayer) : [...pool].sort((a, b) => b.influence - a.influence);
  const extra = [...EXPERTS].sort(() => rng.next() - 0.5);
  const out = {} as Record<Domain, string>;
  DOMAINS.forEach((dom, i) => { out[dom] = sorted[i]?.name ?? extra.pop() ?? `Ministre ${MINISTRIES[dom]}`; });
  return out;
}

/** Appliqué par l'effet « presidency » (pmName, cabinet) */
export function applyAppointment(d: GameState, e: Extract<Effect, { kind: 'presidency' }>, rng: Rng): string[] {
  const pr = d.presidency;
  if (!pr) return [];
  const out: string[] = [];
  if (e.pmName) {
    pr.primeMinister = e.pmName;
    pr.pmNpcId = e.pmNpcId;
    out.push(`Premier ministre : ${e.pmName}`);
  }
  if (e.cabinet) {
    pr.cabinet = buildCabinet(d, e.cabinet, rng);
    pr.cabinetStyle = e.cabinet;
    pr.majority = clamp(pr.majority);
    pushNews(d, 'actu', 'neutral', `Le gouvernement ${pr.primeMinister} est nommé`, DOMAINS.slice(0, 4).map(dom => `${pr.cabinet![dom]} (${DOMAIN_LABELS[dom]})`).join(', ') + '…');
    out.push('Gouvernement nommé');
  }
  return out;
}

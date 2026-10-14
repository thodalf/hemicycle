import { Effect, GameState, Npc } from '../models/game.models';
import { rankOrder } from '../data/ranks';
import { renownTier } from '../data/lifestyles';
import { DOMAINS, DOMAIN_LABELS } from '../models/game.models';
import { applyEffects, pushNews } from './effects';
import { addMilestone } from './life';
import { engrave } from './memories';
import { frondes } from './frondes';
import { economy, electorate } from './country';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Grandes décisions (des choix uniques, débloqués sous
 *  conditions) et grandes luttes (des bras de fer nationaux
 *  sur plusieurs années, en quatre phases, que vos actions
 *  font pencher d'un côté ou de l'autre).
 * ============================================================ */

/* ── Grandes décisions ─────────────────────────────────────── */

export interface GreatDecision {
  id: string;
  icon: string;
  label: string;
  desc: string;
  /** Raison du blocage, ou null */
  block: (d: GameState) => string | null;
  /** Coûts affichés */
  cost: { politicalCapital?: number; money?: number; renown?: number };
  run: (d: GameState, rng: Rng) => string[];
}

const worstEnemy = (d: GameState): Npc | undefined => [...d.npcs].sort((a, b) => a.relationToPlayer - b.relationToPlayer)[0];
const bestDomain = (d: GameState) => [...DOMAINS].sort((a, b) => d.player.dossiers[b].mastery - d.player.dossiers[a].mastery)[0];

export const GREAT_DECISIONS: GreatDecision[] = [
  { id: 'charte', icon: '⚖️', label: 'Publier une charte éthique personnelle', desc: 'Patrimoine, agendas, cadeaux : tout devient public. On vous croit davantage, on vous craint moins.',
    cost: { politicalCapital: 10 }, block: d => (d.player.stats.credibility < 45 ? 'Il faut 45 de crédibilité' : null),
    run: (d, rng) => applyEffects(d, [{ kind: 'stat', stat: 'credibility', delta: 8 }, { kind: 'exposure', delta: -15 }, { kind: 'dread', delta: -10 }, { kind: 'renown', delta: 20 }], {}, rng) },
  { id: 'grand_oral', icon: '📺', label: 'Le grand oral télévisé', desc: 'Deux heures en direct, en prime time, face à des Français tirés au sort.',
    cost: { renown: 60 }, block: d => (renownTier(d.player.renown ?? 0) < 2 ? 'Il faut être Célèbre' : null),
    run: (d, rng) => applyEffects(d, [{ kind: 'stat', stat: 'popularity', delta: 9 }, { kind: 'stat', stat: 'credibility', delta: 3 }, { kind: 'stat', stat: 'stress', delta: 8 }], {}, rng) },
  { id: 'reconciliation', icon: '🕊️', label: 'Se réconcilier avec son pire ennemi', desc: 'Un déjeuner, sans caméras. Les vieilles rancunes s’effacent… ou pas.',
    cost: { politicalCapital: 15 }, block: d => ((worstEnemy(d)?.relationToPlayer ?? 0) > -45 ? 'Personne ne vous déteste assez pour ça' : null),
    run: (d, rng) => {
      const e = worstEnemy(d)!;
      (d.opinions ?? []).filter(o => o.npcId === e.id && o.left < 0).forEach(o => { e.relationToPlayer -= o.left; o.left = 0; });
      engrave(d, e, 'La réconciliation', 30);
      return [...applyEffects(d, [{ kind: 'npcRelation', npcId: e.id, delta: 25, reason: 'Votre réconciliation' }], {}, rng), `${e.name} : rancunes effacées`];
    } },
  { id: 'purge', icon: '🧹', label: 'Purger le parti', desc: 'Exclusions, investitures retirées, fédérations mises sous tutelle. Plus personne ne bougera.',
    cost: { politicalCapital: 20 }, block: d => (d.party.leaderNpcId !== 'player' ? 'Il faut diriger le parti' : (d.player.dread ?? 0) < 30 ? 'Il faut inspirer de la crainte (30)' : null),
    run: (d, rng) => { d.frondes = []; return [...applyEffects(d, [{ kind: 'dread', delta: 20 }, { kind: 'cohesion', delta: -10 }, { kind: 'faction', factionId: '*', delta: -5 }], {}, rng), 'Toutes les frondes sont brisées']; } },
  { id: 'pacte_courants', icon: '🤝', label: 'Signer un pacte avec tous les courants', desc: 'Un texte commun, des postes partagés : la paix dans le parti pour longtemps.',
    cost: { politicalCapital: 18 }, block: d => (d.player.stats.influence < 55 ? 'Il faut 55 d’influence' : null),
    run: (d, rng) => { d.frondes = []; return [...applyEffects(d, [{ kind: 'faction', factionId: '*', delta: 15 }, { kind: 'cohesion', delta: 10 }, { kind: 'renown', delta: 15 }], {}, rng), 'Les frondes s’éteignent']; } },
  { id: 'livre_blanc', icon: '📘', label: 'Publier un livre blanc', desc: 'Votre meilleur dossier devient un livre de référence, lu dans tous les cabinets.',
    cost: { politicalCapital: 8 }, block: d => (d.player.dossiers[bestDomain(d)].mastery < 75 ? 'Il faut maîtriser un dossier à 75' : null),
    run: (d, rng) => applyEffects(d, [{ kind: 'stat', stat: 'credibility', delta: 6 }, { kind: 'renown', delta: 30 }, { kind: 'flagAdd', key: 'livres', delta: 1 }, { kind: 'dossier', domain: bestDomain(d), delta: 5 }], {}, rng) },
  { id: 'mecene', icon: '🎻', label: 'Devenir mécène d’un grand festival', desc: '50 000 € pour un festival de musique : votre nom en lettres d’or sur l’affiche.',
    cost: { money: 50000 }, block: d => (d.player.finances.personal < 50000 ? 'Il faut 50 000 € d’épargne' : null),
    run: (d, rng) => applyEffects(d, [{ kind: 'funds', account: 'personal', delta: -50000 }, { kind: 'stat', stat: 'popularity', delta: 5 }, { kind: 'renown', delta: 40 }], {}, rng) },
  { id: 'tour_france', icon: '🗺️', label: 'Faire le tour de France des 101 départements', desc: 'Un département par semaine pendant deux ans : la France vous connaîtra par cœur.',
    cost: { politicalCapital: 12 }, block: d => (rankOrder(d.player.rankId) < 2 ? 'Il faut être au moins député·e' : null),
    run: (d, rng) => { const o = electorate(d).offsets; for (const k of Object.keys(o) as (keyof typeof o)[]) o[k] = clamp(o[k] + 2, -30, 30); return [...applyEffects(d, [{ kind: 'renown', delta: 35 }, { kind: 'stat', stat: 'energy', delta: -15 }], {}, rng), 'Tous les électorats +2']; } },
];

export function decisionsState(d: GameState) {
  return GREAT_DECISIONS.map(g => ({ g, done: !!d.player.flags[`gd_${g.id}`], block: d.player.flags[`gd_${g.id}`] ? 'Déjà fait' : g.block(d) ?? costBlock(d, g) }));
}

function costBlock(d: GameState, g: GreatDecision): string | null {
  if ((g.cost.politicalCapital ?? 0) > d.player.stats.politicalCapital) return `Il faut ${g.cost.politicalCapital} de capital politique`;
  if ((g.cost.renown ?? 0) > (d.player.renown ?? 0)) return `Il faut ${g.cost.renown} de renommée`;
  return null;
}

export function takeDecision(d: GameState, id: string, rng: Rng): string[] {
  const st = decisionsState(d).find(x => x.g.id === id);
  if (!st || st.block) return [];
  const g = st.g;
  d.player.flags[`gd_${g.id}`] = d.week;
  d.player.stats.politicalCapital -= g.cost.politicalCapital ?? 0;
  d.player.renown = (d.player.renown ?? 0) - (g.cost.renown ?? 0);
  const out = g.run(d, rng);
  addMilestone(d, 'carriere', g.label, g.desc);
  pushNews(d, 'actu', 'positive', `Grande décision : ${g.label}`, out.join(' · '));
  return out;
}

/* ── Grandes luttes ───────────────────────────────────────── */

export interface StruggleDef {
  id: string;
  icon: string;
  label: string;
  desc: string;
  /** Les deux camps : balance < 0 → gauche, > 0 → droite */
  sides: [string, string];
  phases: [string, string, string, string];
  endings: [{ title: string; text: string; effects: Effect[] }, { title: string; text: string; effects: Effect[] }];
}

export const PHASES = ['Ouverture', 'Tension', 'Conflit ouvert', 'Dénouement'];

export const STRUGGLES: StruggleDef[] = [
  { id: 'recomposition', icon: '🧩', label: 'La recomposition politique', desc: 'Les vieux partis se fissurent : une grande coalition des modérés, ou la polarisation des extrêmes ?',
    sides: ['Union des modérés', 'Polarisation'],
    phases: ['Des appels à « dépasser les clivages » se multiplient.', 'Les transfuges se comptent par dizaines.', 'Chaque parti se déchire sur la stratégie.', 'Le paysage politique se fige pour une génération.'],
    endings: [
      { title: 'La grande coalition des modérés', text: 'Les modérés de tous bords s’unissent : le centre gouverne pour longtemps.', effects: [{ kind: 'cohesion', delta: 5 }, { kind: 'stat', stat: 'credibility', delta: 4 }] },
      { title: 'Le temps des extrêmes', text: 'Les compromis sont morts : chaque élection devient un affrontement.', effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'dread', delta: 8 }] },
    ] },
  { id: 'decentralisation', icon: '🏞️', label: 'La grande décentralisation', desc: 'Paris ou les régions : qui décidera de la vie quotidienne des Français ?',
    sides: ['Les Jacobins', 'Les Girondins'],
    phases: ['Les présidents de région réclament plus de pouvoirs.', 'Des référendums locaux s’organisent.', 'Bras de fer entre l’État et les régions.', 'La France se dote d’un nouveau visage.'],
    endings: [
      { title: 'L’État reprend la main', text: 'Préfets renforcés, grandes politiques nationales : la République reste une et indivisible.', effects: [{ kind: 'stat', stat: 'influence', delta: 4 }, { kind: 'segment', segment: 'cadres', delta: 3 }] },
      { title: 'La France des régions', text: 'Écoles, routes, hôpitaux : les régions décident. Les territoires respirent.', effects: [{ kind: 'segment', segment: 'ruraux', delta: 5 }, { kind: 'stat', stat: 'popularity', delta: 3 }] },
    ] },
  { id: 'oublies', icon: '🌾', label: 'La France des oubliés', desc: 'Les petites villes et les campagnes se sentent abandonnées. Pacte ou révolte ?',
    sides: ['Le pacte rural', 'La révolte'],
    phases: ['Des cahiers de doléances fleurissent dans les mairies.', 'Ronds-points occupés, routes bloquées le samedi.', 'Le mouvement se structure et menace de tout bloquer.', 'Le pays doit répondre.'],
    endings: [
      { title: 'Le pacte des territoires', text: 'Services publics rouverts, médecins installés : la France périphérique se sent enfin entendue.', effects: [{ kind: 'segment', segment: 'ruraux', delta: 6 }, { kind: 'segment', segment: 'populaires', delta: 3 }] },
      { title: 'La France en colère', text: 'Les blocages ont duré des mois. La fracture est béante ; chaque élection s’en ressentira.', effects: [{ kind: 'segment', segment: 'ruraux', delta: -4 }, { kind: 'stat', stat: 'popularity', delta: -3 }] },
    ] },
];
export const STRUGGLE_BY_ID = new Map(STRUGGLES.map(s => [s.id, s]));

/** Chaque mois : une lutte s'ouvre parfois, progresse toujours */
export function monthlyStruggle(d: GameState, rng: Rng): void {
  if (d.status !== 'en_cours') return;
  const s = d.struggle;
  if (!s) {
    if (d.week < 12 || d.week - Number(d.player.flags['struggleEnd'] ?? -99) < 18 || !rng.chance(0.07)) return;
    const pool = STRUGGLES.filter(x => !d.player.flags[`struggle_${x.id}`]);
    if (!pool.length) return;
    const def = rng.pick(pool);
    d.struggle = { id: def.id, phase: 0, progress: 0, balance: Math.round(rng.range(-15, 15)), since: d.week };
    d.player.flags[`struggle_${def.id}`] = d.week;
    pushNews(d, 'actu', 'neutral', `Grande lutte : ${def.label}`, `${def.desc} ${def.phases[0]}`);
    return;
  }
  const def = STRUGGLE_BY_ID.get(s.id);
  if (!def) { d.struggle = null; return; }
  s.balance = clamp(s.balance + rng.range(-3, 3), -100, 100);
  s.progress = clamp(s.progress + 7 + Math.abs(s.balance) / 25);
  if (s.progress < 100) return;
  s.progress = 0;
  s.phase += 1;
  if (s.phase < 4) {
    pushNews(d, 'actu', 'neutral', `${def.label} : ${PHASES[s.phase].toLowerCase()}`, def.phases[s.phase]);
    return;
  }
  // Dénouement
  const end = s.balance <= 0 ? def.endings[0] : def.endings[1];
  const out = applyEffects(d, end.effects, {}, rng);
  addMilestone(d, 'carriere', end.title, end.text);
  pushNews(d, 'actu', 'neutral', end.title, `${end.text} ${out.join(' · ')}`);
  if (s.id === 'oublies' && s.balance > 0) economy(d).growth -= 0.2;
  d.struggle = null;
  d.player.flags['struggleEnd'] = d.week;
}

/** Effet « struggle » : peser sur la lutte en cours */
export function adjustStruggle(d: GameState, e: Extract<Effect, { kind: 'struggle' }>): string[] {
  const s = d.struggle;
  if (!s) return [];
  const def = STRUGGLE_BY_ID.get(s.id)!;
  const out: string[] = [];
  if (e.balance) { s.balance = clamp(s.balance + e.balance, -100, 100); out.push(`${e.balance < 0 ? def.sides[0] : def.sides[1]} ${e.balance > 0 ? '+' : ''}${Math.abs(e.balance)}`); }
  if (e.progress) { s.progress = clamp(s.progress + e.progress); out.push(`La lutte avance (+${e.progress})`); }
  return out;
}

export function domainLabel(d: GameState): string {
  return DOMAIN_LABELS[bestDomain(d)];
}

export { frondes };

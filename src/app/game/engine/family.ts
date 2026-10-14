import { Effect, FamilyState, GameState, HeirState } from '../models/game.models';
import { RANKS, rankOrder } from '../data/ranks';
import { addMilestone } from './life';
import { pushNews } from './effects';
import { Rng, clamp, frSigned } from './rng';

/* ============================================================
 *  Vie privée : un·e conjoint·e, des enfants qui grandissent,
 *  des parents qui vieillissent. Et, en fin de carrière, un·e
 *  dauphin·e dont l'ascension rejaillit sur vous.
 * ============================================================ */

const FIRST_F = ['Claire', 'Inès', 'Julie', 'Léa', 'Manon', 'Sarah', 'Camille', 'Nora', 'Élise', 'Chloé'];
const FIRST_M = ['Thomas', 'Hugo', 'Karim', 'Louis', 'Nathan', 'Paul', 'Yanis', 'Antoine', 'Malik', 'Jules'];
const LAST = ['Martel', 'Rousseau', 'Benali', 'Lefèvre', 'Garnier', 'Moreau', 'Dubois', 'Faure'];

export function initFamily(d: GameState): FamilyState {
  const age = d.player.age;
  return {
    partner: null,
    children: [],
    parents: [
      { name: 'Maman', alive: true, health: clamp(95 - age), gender: 'f' },
      { name: 'Papa', alive: true, health: clamp(90 - age), gender: 'm' },
    ],
    divorces: 0,
  };
}

export function family(d: GameState): FamilyState {
  return (d.family ??= initFamily(d));
}

export function childAge(d: GameState, born: number): number {
  return Math.floor((d.week - born) / 12);
}

export function adjustFamily(d: GameState, e: Extract<Effect, { kind: 'family' }>, rng: Rng): string[] {
  const f = family(d);
  const out: string[] = [];
  if (e.partner === 'meet' && !f.partner) {
    const female = rng.chance(0.5);
    f.partner = { name: `${rng.pick(female ? FIRST_F : FIRST_M)} ${rng.pick(LAST)}`, gender: female ? 'f' : 'm', alive: true, since: d.week };
    out.push(`En couple avec ${f.partner.name}`);
  }
  if (e.partner === 'marry' && f.partner && !f.partner.married) {
    f.partner.married = true;
    addMilestone(d, 'carriere', 'Mariage', `Vous épousez ${f.partner.name}. La mairie est pleine, la presse people aussi.`);
    out.push('Mariage');
  }
  if (e.partner === 'divorce' && f.partner) {
    out.push(`Séparation d’avec ${f.partner.name}`);
    f.partner = null;
    f.divorces += 1;
  }
  if (e.child) {
    const female = rng.chance(0.5);
    const kid = { name: rng.pick(female ? FIRST_F : FIRST_M), born: d.week, gender: female ? 'f' as const : 'm' as const, alive: true };
    f.children.push(kid);
    addMilestone(d, 'carriere', `Naissance de ${kid.name}`, 'Les nuits seront courtes, l’agenda aussi.');
    out.push(`Naissance de ${kid.name}`);
  }
  if (e.parentHealth) {
    const parent = f.parents.find(x => x.alive);
    if (parent) {
      parent.health = clamp((parent.health ?? 60) + e.parentHealth);
      out.push(`Santé de ${parent.name === 'Maman' ? 'votre mère' : 'votre père'} ${frSigned(e.parentHealth)}`);
    }
  }
  if (e.childPath) {
    const kid = f.children.find(k => !k.path && childAge(d, k.born ?? d.week) >= 18);
    if (kid) { kid.path = e.childPath; out.push(`${kid.name} : ${e.childPath === 'politique' ? 'entre au parti' : e.childPath === 'adverse' ? 'rejoint le camp d’en face' : 'choisit une autre voie'}`); }
  }
  return out;
}

/** Chaque mois : la famille apaise… ou fatigue */
export function monthlyFamily(d: GameState, rng: Rng): void {
  const f = family(d);
  const p = d.player;
  if (f.partner) p.stats.stress = clamp(p.stats.stress - 0.8);
  const small = f.children.filter(k => childAge(d, k.born ?? d.week) < 6).length;
  if (small) p.stats.energy = clamp(p.stats.energy - small * 1.5);
  // Les parents vieillissent
  for (const parent of f.parents.filter(x => x.alive)) {
    parent.health = clamp((parent.health ?? 60) - rng.range(0, 0.5) - Math.max(0, p.age - 45) / 120);
    if ((parent.health ?? 60) <= 0 || ((parent.health ?? 60) < 15 && rng.chance(0.06))) {
      parent.alive = false;
      p.stats.stress = clamp(p.stats.stress + 15);
      addMilestone(d, 'revers', `Décès de ${parent.name === 'Maman' ? 'votre mère' : 'votre père'}`, 'Les obsèques ont lieu dans le village de votre enfance. Des adversaires sont venus, aussi.');
      pushNews(d, 'systeme', 'negative', `${parent.name === 'Maman' ? 'Votre mère' : 'Votre père'} nous a quittés`, 'Vous annulez tout pendant une semaine.');
    }
  }
}

/* ── Le dauphin ─────────────────────────────────────────────── */

export function canAnoint(d: GameState): string | null {
  if (d.heir) return 'Vous avez déjà un·e dauphin·e';
  if (d.player.age < 55 && d.player.rankId !== 'ancien_president') return 'En fin de carrière seulement (55 ans)';
  return null;
}

export function anoint(d: GameState, npcId: string): string[] {
  const why = canAnoint(d);
  const n = d.npcs.find(x => x.id === npcId);
  if (why || !n) return [why ?? 'Personne à adouber'];
  d.heir = { npcId, since: d.week, lastRank: n.rankId };
  n.relationToPlayer = clamp(n.relationToPlayer + 30, -100, 100);
  n.influence = clamp(n.influence + 8);
  n.isRival = false;
  addMilestone(d, 'carriere', `${n.name}, votre dauphin·e`, 'Vous l’adoubez publiquement : votre héritage politique porte désormais un nom.');
  return [`${n.name} devient votre dauphin·e`];
}

/** Chaque mois : vous le portez, il vous porte */
export function monthlyHeir(d: GameState, rng: Rng): void {
  const h: HeirState | null | undefined = d.heir;
  if (!h) return;
  const n = d.npcs.find(x => x.id === h.npcId);
  if (!n) { d.heir = null; return; }
  const p = d.player;
  n.influence = clamp(n.influence + 0.4 + p.stats.influence / 200);
  n.popularity = clamp(n.popularity + rng.range(-0.6, 0.9));
  if (rankOrder(n.rankId) > rankOrder(h.lastRank)) {
    p.stats.influence = clamp(p.stats.influence + 3);
    p.stats.popularity = clamp(p.stats.popularity + 1);
    pushNews(d, 'reseau', 'positive', `Votre dauphin·e devient ${RANKS[n.rankId].label.toLowerCase()}`, `${n.name} poursuit son ascension. On salue votre flair. Influence +3.`);
    h.lastRank = n.rankId;
  } else if (rankOrder(n.rankId) < rankOrder(h.lastRank)) {
    p.stats.popularity = clamp(p.stats.popularity - 2);
    pushNews(d, 'reseau', 'negative', `Revers pour ${n.name}`, 'Votre dauphin·e trébuche ; on vous en tient un peu pour responsable.');
    h.lastRank = n.rankId;
  }
}

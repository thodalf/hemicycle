import { GameState, Rarity, Recruit, StaffRole, TraitId } from '../models/game.models';
import { STAFF, STAFF_BY_ROLE } from '../data/staff';
import { BACKGROUNDS, BAD_TRAITS, GOOD_TRAITS, RARITY_SALARY } from '../data/recruits';
import { uniqueName } from '../data/names';
import { RANKS, rankOrder } from '../data/ranks';
import { availableFunds, pushNews } from './effects';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Recrues et boosters.
 * ============================================================ */

const POOL_MAX = 9;

export function syncStaff(d: GameState): void {
  d.player.staff = [...new Set(d.player.team.map(r => r.role))];
}

export function countTrait(d: GameState, t: TraitId): number {
  return d.player.team.filter(r => r.traits.includes(t)).length;
}

export function payroll(d: GameState): number {
  return d.player.team.reduce((s, r) => s + r.salary, 0);
}

function rollRarity(d: GameState, rng: Rng): Rarity {
  const bonus = rankOrder(d.player.rankId) * 0.02;
  const r = rng.next();
  if (r < 0.06 + bonus) return 'legendaire';
  if (r < 0.34 + bonus * 2) return 'rare';
  return 'commun';
}

function pickDistinct<T>(items: readonly T[], n: number, rng: Rng): T[] {
  return items.map(x => ({ x, k: rng.next() })).sort((a, b) => a.k - b.k).slice(0, n).map(o => o.x);
}

export function generateRecruit(d: GameState, rng: Rng, forced?: { role?: StaffRole; rarity?: Rarity }): Recruit {
  const rarity = forced?.rarity ?? rollRarity(d, rng);
  // Le plus souvent, un poste que vous pouvez déjà pourvoir
  const unlocked = STAFF.filter(s => rankOrder(s.minRank) <= rankOrder(d.player.rankId)).map(s => s.role);
  const role = forced?.role ?? (unlocked.length && rng.chance(0.75) ? rng.pick(unlocked) : rng.pick(STAFF.map(s => s.role)));
  const goodCount = rarity === 'legendaire' ? 2 : rarity === 'rare' ? 1 : rng.chance(0.6) ? 1 : 0;
  const badChance = rarity === 'legendaire' ? 0.55 : rarity === 'rare' ? 0.35 : 0.5;
  const traits: TraitId[] = [...pickDistinct(GOOD_TRAITS, goodCount, rng)];
  if (rng.chance(badChance)) traits.push(rng.pick(BAD_TRAITS));
  const base = STAFF_BY_ROLE.get(role)!.monthlySalary;
  const salary = Math.round((base * RARITY_SALARY[rarity] * (traits.includes('dispendieux') ? 1.5 : 1)) / 50) * 50;
  return {
    id: nextId(d, 'recrue'),
    name: uniqueName(() => rng.next(), [...d.player.team, ...d.player.pool].map(r => r.name)),
    role, rarity, salary, traits,
    bio: rng.pick(BACKGROUNDS),
  };
}

/** Ouvre un booster : trois candidats rejoignent le vivier */
export function openBooster(d: GameState, rng: Rng): Recruit[] {
  if (d.player.boosters < 1) return [];
  d.player.boosters -= 1;
  const cards = [generateRecruit(d, rng), generateRecruit(d, rng), generateRecruit(d, rng)];
  d.player.pool = [...cards, ...d.player.pool].slice(0, POOL_MAX);
  return cards;
}

/** Chasse de têtes : un·e candidat·e pour un poste précis, contre honoraires */
export function headhuntFee(role: StaffRole): number {
  return Math.round(STAFF_BY_ROLE.get(role)!.monthlySalary * 1.5 / 100) * 100;
}

export function headhuntCheck(d: GameState, role: StaffRole): { ok: boolean; reason?: string } {
  const def = STAFF_BY_ROLE.get(role)!;
  if (rankOrder(d.player.rankId) < rankOrder(def.minRank)) return { ok: false, reason: `Dès le rang ${RANKS[def.minRank].label}` };
  const last = Number(d.player.flags[`hunt_${role}`] ?? -99);
  if (d.week - last < 3) return { ok: false, reason: 'Le cabinet de recrutement cherche encore' };
  if (d.player.pool.length >= POOL_MAX) return { ok: false, reason: 'Vivier plein' };
  if (d.player.finances.personal < headhuntFee(role)) return { ok: false, reason: 'Honoraires trop élevés pour vos fonds' };
  return { ok: true };
}

export function headhunt(d: GameState, role: StaffRole, rng: Rng): Recruit | null {
  if (!headhuntCheck(d, role).ok) return null;
  const fee = headhuntFee(role);
  d.player.finances.personal -= fee;
  d.player.flags[`hunt_${role}`] = d.week;
  // Un cabinet sérieux évite les profils trop communs
  const r = generateRecruit(d, rng, { role, rarity: rng.chance(0.2) ? 'legendaire' : rng.chance(0.55) ? 'rare' : 'commun' });
  d.player.pool = [r, ...d.player.pool].slice(0, POOL_MAX);
  pushNews(d, 'systeme', 'neutral', `Chasse de têtes : ${STAFF_BY_ROLE.get(role)!.title.toLowerCase()}`, `${r.name} rejoint votre vivier de candidats (${fee.toLocaleString('fr-FR')} € d’honoraires).`);
  return r;
}

export function hireCheck(d: GameState, r: Recruit): { ok: boolean; reason?: string } {
  const def = STAFF_BY_ROLE.get(r.role)!;
  if (rankOrder(d.player.rankId) < rankOrder(def.minRank)) return { ok: false, reason: `Dès le rang ${RANKS[def.minRank].label}` };
  if (availableFunds(d) < r.salary) return { ok: false, reason: 'Un mois de salaire d’avance nécessaire' };
  return { ok: true };
}

/** Embauche ; remplace la personne qui occupait déjà ce poste */
export function hireRecruit(d: GameState, id: string): void {
  const r = d.player.pool.find(x => x.id === id);
  if (!r || !hireCheck(d, r).ok) return;
  const replaced = d.player.team.find(x => x.role === r.role);
  d.player.team = [...d.player.team.filter(x => x.role !== r.role), r];
  d.player.pool = d.player.pool.filter(x => x.id !== id);
  syncStaff(d);
  pushNews(d, 'systeme', 'positive', `${r.name} rejoint votre équipe`,
    `${STAFF_BY_ROLE.get(r.role)!.title}${replaced ? `, à la place de ${replaced.name}` : ''}.`);
}

export function fireRecruit(d: GameState, id: string): void {
  const r = d.player.team.find(x => x.id === id);
  if (!r) return;
  d.player.team = d.player.team.filter(x => x.id !== id);
  syncStaff(d);
  pushNews(d, 'systeme', 'neutral', `${r.name} quitte votre équipe`);
}

export function dismissCandidate(d: GameState, id: string): void {
  d.player.pool = d.player.pool.filter(x => x.id !== id);
}

/** Effets mensuels des personnalités */
export function weeklyTraits(d: GameState, rng: Rng): void {
  const s = d.player.stats;
  const n = (t: TraitId) => countTrait(d, t);
  s.influence = clamp(s.influence + n('carnet') * 0.5);
  s.popularity = clamp(s.popularity + n('mediatique') * 0.5 + n('reseaux_sociaux') * 0.4);
  s.stress = clamp(s.stress - n('fidele') * 2 + n('colerique') * 3);
  s.politicalCapital = clamp(s.politicalCapital + n('stratege'));
  s.energy = clamp(s.energy - n('paresseux') * 3);
  if (d.player.finances.legalCeiling !== null) d.player.momentum = clamp(d.player.momentum + n('stratege') * 2);
  d.player.finances.campaign += n('leveur') * 4000;
  d.player.scandalExposure = clamp(d.player.scandalExposure + n('gaffeur') * 2 + n('casseroles') * 2.5);
  for (const f of d.party.factions) f.supportForPlayer = clamp(f.supportForPlayer - n('mal_vu') * 0.4);

  // Les ambitieux finissent parfois par partir… avec vos secrets
  for (const r of d.player.team.filter(x => x.traits.includes('ambitieux'))) {
    if (rng.chance(0.06)) {
      fireRecruit(d, r.id);
      d.player.scandalExposure = clamp(d.player.scandalExposure + 12);
      pushNews(d, 'rival', 'negative', `${r.name} passe chez vos rivaux`, 'Votre ancien·ne collaborateur·rice raconte vos coulisses à qui veut l’entendre.');
    }
  }
}

/** Convertit une ancienne équipe (rôles seuls) en recrues nominatives */
export function migrateTeam(d: GameState): void {
  if (d.player.team) return;
  d.player.team = (d.player.staff ?? []).map(role => {
    const def = STAFF_BY_ROLE.get(role)!;
    return { id: `recrue-${role}`, name: def.name, role, rarity: 'commun' as Rarity, salary: def.monthlySalary, traits: [], bio: def.title };
  });
  d.player.pool = [];
  d.player.boosters = 1;
  syncStaff(d);
}

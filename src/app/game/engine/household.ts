import { GameState, RankId } from '../models/game.models';
import { owns } from './patrimoine';
import { clamp } from './rng';
import { pushNews } from './effects';

/* ============================================================
 *  Le budget du foyer : ce que coûte la vie chaque mois.
 *  Impôt sur le revenu (barème progressif), loyer (sauf si l'on
 *  est propriétaire de sa résidence ou logé par la République),
 *  nourriture et autres dépenses. Le reste est mis de côté.
 *  Mal manger use la santé ; bien manger donne de l'énergie.
 * ============================================================ */

export type Level = 0 | 1 | 2;
export interface Household { food: Level; other: Level }

export const FOOD_LEVELS = [
  { label: 'Au plus juste', hint: 'Pâtes et sandwichs : la santé et l’énergie en pâtissent', perHead: 160 },
  { label: 'Normale', hint: 'Une table correcte, sans effet particulier', perHead: 300 },
  { label: 'Gastronomique', hint: 'Bons produits, bonnes tables : un vrai regain d’énergie', perHead: 720 },
] as const;

export const OTHER_LEVELS = [
  { label: 'Sobres', hint: 'Ni sorties ni vacances : un peu de fatigue', rate: 0.07 },
  { label: 'Normales', hint: 'Transports, vêtements, loisirs, imprévus', rate: 0.16 },
  { label: 'Train de vie aisé', hint: 'Repos et énergie, mais la presse remarque', rate: 0.3 },
] as const;

/** Les résidences qui dispensent de loyer */
const HOMES = ['studio', 'maison', 'villa', 'chalet'];
/** Logés par la République (Matignon, l'Élysée) ou par la Couronne */
const OFFICIAL: Partial<Record<RankId, string>> = { premier_ministre: 'Logé·e à Matignon', president: 'Logé·e à l’Élysée', roi: 'Logé·e au palais' };
const RENT: Record<RankId, number> = {
  militant: 720, conseiller_municipal: 820, depute: 1500, ministre: 1800, premier_ministre: 0,
  chef_parti: 1500, candidat_presidence: 1700, president: 0, ancien_president: 1900, roi: 0,
};

export function household(d: GameState): Household {
  return d.player.household ?? { food: 1, other: 1 };
}

export function setHousehold(d: GameState, patch: Partial<Household>): void {
  d.player.household = { ...household(d), ...patch };
}

/** Personnes à nourrir : vous, votre conjoint·e, les enfants encore à la maison */
export function mouths(d: GameState): number {
  const f = d.family;
  if (!f) return 1;
  const kids = f.children.filter(c => c.alive && (c.born === undefined || d.week - c.born < 12 * 20)).length;
  return 1 + (f.partner ? 1 : 0) + kids;
}

/** Impôt sur le revenu, barème progressif mensualisé */
export function incomeTax(monthly: number): number {
  const brackets: [number, number][] = [[950, 0], [2300, 0.11], [6850, 0.3], [14700, 0.41], [Infinity, 0.45]];
  let tax = 0, low = 0;
  for (const [top, rate] of brackets) {
    if (monthly > low) tax += (Math.min(monthly, top) - low) * rate;
    low = top;
  }
  return Math.round(tax / 10) * 10;
}

export interface HouseLine { key: 'impot' | 'loyer' | 'nourriture' | 'autres'; label: string; amount: number; note?: string }

/** Les dépenses du foyer pour un revenu donné */
export function householdLines(d: GameState, income: number): HouseLine[] {
  const h = household(d);
  const p = d.player;
  const thrift = 1 - 0.05 * (p.talents?.['gestionnaire'] ?? 0);
  const n = mouths(d);
  const lines: HouseLine[] = [];
  const tax = incomeTax(income);
  lines.push({ key: 'impot', label: 'Impôt sur le revenu', amount: tax, note: tax ? `Barème progressif, ${Math.round((100 * tax) / Math.max(1, income))} % de vos revenus` : 'Non imposable' });
  const official = OFFICIAL[p.rankId];
  const home = owns(d, HOMES);
  const kids = n - 1 - (d.family?.partner ? 1 : 0);
  const rent = official || home ? 0 : Math.round(((RENT[p.rankId] ?? 900) + 160 * kids) * thrift / 10) * 10;
  lines.push({ key: 'loyer', label: 'Loyer', amount: rent, note: official ?? (home ? 'Propriétaire de votre résidence' : kids ? `Un logement pour ${n}` : undefined) });
  const food = Math.round((FOOD_LEVELS[h.food].perHead * n * thrift) / 10) * 10;
  lines.push({ key: 'nourriture', label: 'Nourriture', amount: food, note: `${FOOD_LEVELS[h.food].label}${n > 1 ? ` · ${n} personnes` : ''}` });
  const other = Math.round((Math.max(300, income) * OTHER_LEVELS[h.other].rate * thrift) / 10) * 10;
  lines.push({ key: 'autres', label: 'Autres dépenses', amount: other, note: OTHER_LEVELS[h.other].label });
  return lines;
}

/** Les effets du mois : la table et le train de vie se ressentent */
export function monthlyHousehold(d: GameState): void {
  const h = household(d);
  const p = d.player;
  if (h.food === 0) {
    p.health = clamp(p.health - 2);
    p.stats.energy = clamp(p.stats.energy - 4);
    if (p.health < 45 && !p.flags['malbouffeNews']) {
      p.flags['malbouffeNews'] = true;
      pushNews(d, 'systeme', 'negative', 'Sandwichs et plats réchauffés', 'Votre médecin s’inquiète : vous mangez mal, et ça se voit. Votre santé décline.');
    }
  } else if (h.food === 2) p.stats.energy = clamp(p.stats.energy + 5);
  if (h.food !== 0) p.flags['malbouffeNews'] = false;
  if (h.other === 0) p.stats.energy = clamp(p.stats.energy - 2);
  else if (h.other === 2) {
    p.stats.energy = clamp(p.stats.energy + 3);
    if (p.rankId !== 'militant') p.scandalExposure = clamp(p.scandalExposure + 0.6);
  }
}

import { GameState, OwnedAsset } from '../models/game.models';
import { ASSETS_BY_ID, AssetDef } from '../data/assets';
import { RANKS, rankOrder } from '../data/ranks';
import { Rng, clamp } from './rng';
import { pushNews } from './effects';

/* ============================================================
 *  Patrimoine : achats, crédit, revente, évolution des valeurs
 *  et image publique liée à la richesse affichée.
 * ============================================================ */

export const MORTGAGE_DOWN = 0.2;
const MORTGAGE_WEEKS = 520;
const MORTGAGE_COST = 1.2;

const SELL_FEE: Record<string, number> = { immobilier: 0.07, vehicule: 0, luxe: 0.15, quotidien: 0.5, placement: 0.01 };

export function assetDef(a: OwnedAsset): AssetDef {
  return ASSETS_BY_ID.get(a.defId)!;
}

export function assetsValue(d: GameState): number {
  return d.player.assets.reduce((t, a) => t + a.value, 0);
}

export function assetsDebt(d: GameState): number {
  return d.player.assets.reduce((t, a) => t + a.debt, 0);
}

/** Patrimoine net : fonds personnels + biens − crédits restants */
export function netWorth(d: GameState): number {
  return d.player.finances.personal + assetsValue(d) - assetsDebt(d);
}

/** Charges hebdomadaires : entretien + mensualités − loyers */
export function weeklyCharges(d: GameState): { upkeep: number; loans: number; rent: number; net: number } {
  let upkeep = 0, loans = 0, rent = 0;
  for (const a of d.player.assets) {
    const def = assetDef(a);
    upkeep += def.upkeep;
    loans += a.debt > 0 ? a.payment : 0;
    rent += def.perks.rent ?? 0;
  }
  return { upkeep, loans, rent, net: rent - upkeep - loans };
}

export interface WealthImage {
  score: number;
  label: string;
  /** Effet hebdomadaire sur la popularité */
  popularity: number;
  /** Exposition aux scandales ajoutée chaque semaine */
  exposure: number;
  ostentation: number;
  explanation: string;
}

const VISIBILITY = [0.4, 0.7, 1, 1.2, 1.2, 1.4, 1.5];

/**
 * Plus vous êtes riche et plus vous l'affichez, plus l'opinion vous le reproche.
 * L'effet grandit avec la notoriété (rang) et pèse davantage à gauche.
 */
export function wealthImage(d: GameState, extraOstentation = 0): WealthImage {
  const ostentation = d.player.assets.reduce((t, a) => t + assetDef(a).ostentation, 0) + extraOstentation;
  const score = Math.max(0, netWorth(d)) / 60000 + ostentation * 1.2;
  const visibility = VISIBILITY[rankOrder(d.player.rankId)] ?? 1;
  const stance = d.player.stance;
  const camp = stance < 0 ? 1 + -stance / 150 : 1 - stance / 300;
  let popularity = 0;
  if (score < 2 && rankOrder(d.player.rankId) >= 1) popularity = 0.1;
  else if (score > 3) popularity = -Math.min(1.5, (score - 3) * 0.05 * visibility * camp);
  const label = score < 2 ? 'Modeste' : score < 6 ? 'Aisé·e' : score < 14 ? 'Fortuné·e' : 'Ostentatoire';
  const explanation = score < 2
    ? 'On vous voit proche des gens.'
    : score <= 3 ? 'Rien qui ne choque.'
    : `Votre train de vie agace${stance < -20 ? ', surtout à gauche' : ''}.`;
  return {
    score: Math.round(score * 10) / 10, label, ostentation,
    popularity: Math.round(popularity * 100) / 100,
    exposure: score > 14 ? 0.4 : 0,
    explanation,
  };
}

export function canBuy(d: GameState, def: AssetDef, mortgage = false): { ok: boolean; reason?: string } {
  if (def.minRank && rankOrder(d.player.rankId) < rankOrder(def.minRank)) {
    return { ok: false, reason: `À partir du rang ${RANKS[def.minRank].label}` };
  }
  if (!def.stackable && d.player.assets.some(a => a.defId === def.id)) return { ok: false, reason: 'Déjà possédé' };
  const cash = mortgage ? Math.round(def.price * MORTGAGE_DOWN) : def.price;
  if (d.player.finances.personal < cash) return { ok: false, reason: 'Fonds personnels insuffisants' };
  return { ok: true };
}

export function mortgagePayment(def: AssetDef): number {
  return Math.round(def.price * (1 - MORTGAGE_DOWN) * MORTGAGE_COST / MORTGAGE_WEEKS);
}

export function buyAsset(d: GameState, defId: string, mortgage: boolean): string[] {
  const def = ASSETS_BY_ID.get(defId);
  if (!def || !canBuy(d, def, mortgage && !!def.mortgage).ok) return [];
  const loan = mortgage && def.mortgage;
  const cash = loan ? Math.round(def.price * MORTGAGE_DOWN) : def.price;
  d.player.finances.personal -= cash;
  const debt = loan ? def.price - cash : 0;
  d.player.assets.push({
    uid: `as-${++d.idCounter}`, defId, value: def.price, debt,
    payment: loan ? Math.round(debt * MORTGAGE_COST / MORTGAGE_WEEKS) : 0,
    boughtWeek: d.week, boughtPrice: def.price,
  });
  pushNews(d, 'systeme', 'neutral', `Achat : ${def.label}`,
    loan ? `Apport de ${cash.toLocaleString('fr-FR')} €, crédit de ${debt.toLocaleString('fr-FR')} €.` : `${cash.toLocaleString('fr-FR')} € débités de vos fonds personnels.`);
  return [`Achat : ${def.label}`];
}

/** Bien reçu gratuitement (héritage, cadeau) */
export function grantAsset(d: GameState, defId: string): string[] {
  const def = ASSETS_BY_ID.get(defId);
  if (!def) return [];
  d.player.assets.push({ uid: `as-${++d.idCounter}`, defId, value: def.price, debt: 0, payment: 0, boughtWeek: d.week, boughtPrice: def.price });
  return [`Nouveau bien : ${def.label}`];
}

export function salePrice(a: OwnedAsset, discount = 0): number {
  const def = assetDef(a);
  return Math.round(a.value * (1 - (SELL_FEE[def.category] ?? 0.1)) * (1 - discount) - a.debt);
}

export function sellAsset(d: GameState, uid: string, discount = 0, reason = 'Vente'): string[] {
  const i = d.player.assets.findIndex(a => a.uid === uid);
  if (i < 0) return [];
  const a = d.player.assets[i];
  const def = assetDef(a);
  const amount = salePrice(a, discount);
  d.player.finances.personal += amount;
  d.player.assets.splice(i, 1);
  const gain = a.value - a.boughtPrice;
  pushNews(d, 'systeme', amount >= 0 ? 'neutral' : 'negative', `${reason} : ${def.label}`,
    `${amount >= 0 ? '+' : ''}${amount.toLocaleString('fr-FR')} € sur vos fonds personnels${def.category !== 'quotidien' && def.category !== 'vehicule' ? ` (${gain >= 0 ? 'plus' : 'moins'}-value ${Math.abs(Math.round(gain)).toLocaleString('fr-FR')} €)` : ''}.`);
  return [`${reason} : ${def.label}`];
}

/** Choisit le bien visé par un effet de vente forcée */
export function pickAsset(d: GameState, which: string): OwnedAsset | undefined {
  const list = d.player.assets;
  if (!list.length) return undefined;
  if (which === 'ostentatious') return [...list].sort((a, b) => assetDef(b).ostentation - assetDef(a).ostentation || b.value - a.value)[0];
  if (which === 'any') return [...list].sort((a, b) => b.value - a.value)[0];
  return list.find(a => a.defId === which);
}

export function owns(d: GameState, ids: string[]): boolean {
  return d.player.assets.some(a => ids.includes(a.defId));
}

export function assetAp(d: GameState): number {
  return d.player.assets.reduce((t, a) => t + (assetDef(a).perks.ap ?? 0), 0);
}

export function dossierDecayFactor(d: GameState): number {
  return d.player.assets.reduce((t, a) => t * (assetDef(a).perks.dossierDecay ?? 1), 1);
}

function gauss(rng: Rng): number {
  const u = Math.max(1e-9, rng.next()), v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Évolution hebdomadaire : valeurs, charges, crédits, bonus, image publique */
export function weeklyAssets(d: GameState, rng: Rng): void {
  const p = d.player;
  const s = p.stats;
  for (const a of p.assets) {
    const def = assetDef(a);
    a.value = Math.max(0, Math.round(a.value * (1 + def.drift / 52 + def.volatility * gauss(rng))));
    if (a.debt > 0) {
      const pay = Math.min(a.debt, a.payment);
      p.finances.personal -= pay;
      // Une partie de la mensualité rembourse le capital, le reste sont des intérêts
      a.debt = Math.max(0, Math.round(a.debt - pay / MORTGAGE_COST));
    }
    p.finances.personal += (def.perks.rent ?? 0) - def.upkeep;
    const k = def.perks;
    if (k.energy) s.energy = clamp(s.energy + k.energy);
    if (k.stress) s.stress = clamp(s.stress + k.stress);
    if (k.popularity) s.popularity = clamp(s.popularity + k.popularity);
    if (k.influence) s.influence = clamp(s.influence + k.influence);
    if (k.credibility) s.credibility = clamp(s.credibility + k.credibility);
    if (k.politicalCapital) s.politicalCapital = clamp(s.politicalCapital + k.politicalCapital);
  }

  const image = wealthImage(d);
  s.popularity = clamp(s.popularity + image.popularity);
  p.scandalExposure = clamp(p.scandalExposure + image.exposure);

  // Découvert : la banque fait vendre le bien le plus coûteux à entretenir
  if (p.finances.personal < -500 && p.assets.length) {
    const victim = [...p.assets].sort((a, b) =>
      (assetDef(b).upkeep + b.payment) - (assetDef(a).upkeep + a.payment) || b.value - a.value)[0];
    sellAsset(d, victim.uid, 0.1, 'Vente forcée par la banque');
  }
}

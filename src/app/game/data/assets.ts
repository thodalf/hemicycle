import { Effect, RankId } from '../models/game.models';

/* ============================================================
 *  Patrimoine : biens que l'on peut acheter avec ses fonds
 *  personnels. Chacun apporte un bonus, coûte un entretien,
 *  prend ou perd de la valeur… et se voit dans l'opinion.
 * ============================================================ */

export type AssetCategory = 'quotidien' | 'vehicule' | 'immobilier' | 'luxe' | 'placement';

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  quotidien: 'Quotidien',
  vehicule: 'Véhicules',
  immobilier: 'Immobilier',
  luxe: 'Luxe & art',
  placement: 'Placements',
};

/** Bonus hebdomadaires tant que le bien est possédé */
export interface AssetPerks {
  energy?: number;
  stress?: number;
  popularity?: number;
  influence?: number;
  credibility?: number;
  politicalCapital?: number;
  /** Points d'action en plus chaque semaine */
  ap?: number;
  /** Loyer ou dividende, en € par semaine */
  rent?: number;
  /** Ralentit l'oubli des dossiers (0.8 = −20 %) */
  dossierDecay?: number;
}

export interface AssetDef {
  id: string;
  label: string;
  category: AssetCategory;
  description: string;
  price: number;
  minRank?: RankId;
  /** Entretien en € par semaine */
  upkeep: number;
  /** 0 (discret) … 10 (tapageur) : pèse sur l'image */
  ostentation: number;
  /** Variation annuelle moyenne de la valeur (−0.3 = −30 %/an) */
  drift: number;
  /** Volatilité hebdomadaire (écart-type relatif) */
  volatility: number;
  perks: AssetPerks;
  /** Effets immédiats à l'achat */
  onBuy?: Effect[];
  /** Achat à crédit possible (apport de 20 %) */
  mortgage?: boolean;
  /** Plusieurs exemplaires possibles (placements) */
  stackable?: boolean;
  /** Ce que débloque le bien, affiché dans la boutique */
  unlocks?: string;
}

const st = (stat: 'popularity' | 'influence' | 'credibility', delta: number): Effect => ({ kind: 'stat', stat, delta });

export const ASSETS: AssetDef[] = [
  // ── Quotidien ──
  {
    id: 'velo', label: 'Vélo électrique', category: 'quotidien', price: 1200, upkeep: 5, ostentation: 0, drift: -0.2, volatility: 0,
    description: 'Pour aller au conseil municipal sans voiture. Excellent pour l’image.',
    perks: { energy: 2, stress: -1 }, onBuy: [st('popularity', 2)],
  },
  {
    id: 'costume', label: 'Costume (ou tailleur) sur mesure', category: 'quotidien', price: 2500, upkeep: 0, ostentation: 2, drift: -0.3, volatility: 0,
    description: 'Une coupe impeccable : on vous prend plus au sérieux sur les plateaux.',
    perks: { credibility: 0.15 }, onBuy: [st('credibility', 3)],
  },
  {
    id: 'smartphone', label: 'Smartphone dernier cri', category: 'quotidien', price: 1300, upkeep: 10, ostentation: 1, drift: -0.4, volatility: 0,
    description: 'Vidéos plus belles, réponses plus rapides.',
    perks: { influence: 0.2, popularity: 0.1, stress: 0.5 },
  },
  {
    id: 'coach', label: 'Salle de sport et coach', category: 'quotidien', price: 800, upkeep: 45, ostentation: 1, drift: -1, volatility: 0,
    description: 'Trois séances par semaine. On tient mieux les nuits de congrès.',
    perks: { energy: 4, stress: -2 },
  },
  {
    id: 'bibliotheque', label: 'Bibliothèque d’ouvrages rares', category: 'quotidien', price: 9000, upkeep: 0, ostentation: 2, drift: 0.02, volatility: 0.004,
    description: 'Des éditions originales et des rapports reliés. Vos dossiers s’oublient moins vite.',
    perks: { dossierDecay: 0.8 }, onBuy: [st('credibility', 2)],
  },
  // ── Véhicules ──
  {
    id: 'citadine', label: 'Citadine électrique', category: 'vehicule', price: 18000, upkeep: 35, ostentation: 1, drift: -0.15, volatility: 0,
    description: 'Discrète et pratique pour sillonner la circonscription.',
    perks: { energy: 3 },
  },
  {
    id: 'berline', label: 'Berline avec chauffeur', category: 'vehicule', price: 45000, upkeep: 650, ostentation: 6, drift: -0.15, volatility: 0, minRank: 'conseiller_municipal',
    description: 'Vous travaillez pendant les trajets : un point d’action de plus par semaine.',
    perks: { ap: 1, energy: 3, stress: -1 },
  },
  {
    id: 'sportive', label: 'Voiture de sport', category: 'vehicule', price: 95000, upkeep: 120, ostentation: 9, drift: -0.12, volatility: 0,
    description: 'Le plaisir de conduire… et des photos qui ne passent pas inaperçues.',
    perks: { stress: -3, energy: 1 },
  },
  // ── Immobilier ──
  {
    id: 'studio', label: 'Pied-à-terre à Paris', category: 'immobilier', price: 190000, upkeep: 60, ostentation: 2, drift: 0.03, volatility: 0.003, mortgage: true,
    description: 'Fini les hôtels les soirs de séance. Permet de recevoir à dîner.',
    perks: { energy: 4, stress: -1 }, unlocks: 'Recevoir à dîner',
  },
  {
    id: 'locatif', label: 'Appartement en location', category: 'immobilier', price: 160000, upkeep: 40, ostentation: 2, drift: 0.025, volatility: 0.003, mortgage: true,
    description: 'Un investissement locatif : un loyer chaque semaine.',
    perks: { rent: 170 },
  },
  {
    id: 'maison', label: 'Maison de campagne', category: 'immobilier', price: 230000, upkeep: 90, ostentation: 4, drift: 0.02, volatility: 0.003, mortgage: true,
    description: 'Ancrage dans le terroir, week-ends au calme, barbecues avec les maires du coin.',
    perks: { stress: -3 }, onBuy: [{ kind: 'dossier', domain: 'territoires', delta: 4 }], unlocks: 'Recevoir à dîner · Séjour à la campagne',
  },
  {
    id: 'villa', label: 'Villa sur la Côte', category: 'immobilier', price: 950000, upkeep: 600, ostentation: 9, drift: 0.04, volatility: 0.004, mortgage: true, minRank: 'depute',
    description: 'Piscine, vue sur la mer, voisins influents. Les paparazzi adorent.',
    perks: { stress: -5, influence: 0.4 }, unlocks: 'Recevoir à dîner · Séjour à la campagne · Louer la villa',
  },
  // ── Luxe & art ──
  {
    id: 'montre', label: 'Montre de luxe', category: 'luxe', price: 9500, upkeep: 0, ostentation: 6, drift: 0.03, volatility: 0.006,
    description: 'Elle impressionne dans les dîners d’affaires. Beaucoup moins sur un marché.',
    perks: { influence: 0.2 }, onBuy: [st('influence', 2)],
  },
  {
    id: 'cave', label: 'Cave à vins', category: 'luxe', price: 6000, upkeep: 15, ostentation: 3, drift: 0.04, volatility: 0.004,
    description: 'De quoi régaler vos invités… et vous détendre.',
    perks: { stress: -1, influence: 0.1 },
  },
  {
    id: 'art', label: 'Toile d’un peintre contemporain', category: 'luxe', price: 32000, upkeep: 20, ostentation: 5, drift: 0.05, volatility: 0.015,
    description: 'Une cote qui peut s’envoler… ou s’effondrer. Ouvre les portes des galeries.',
    perks: { influence: 0.3 }, unlocks: 'Vernissage privé',
  },
  {
    id: 'yacht', label: 'Voilier de croisière', category: 'luxe', price: 420000, upkeep: 1800, ostentation: 10, drift: -0.08, volatility: 0, minRank: 'depute',
    description: 'Des invités prestigieux à bord. Une image désastreuse dans l’opinion.',
    perks: { stress: -5, influence: 0.6 },
  },
  // ── Placements ──
  {
    id: 'livret', label: 'Épargne réglementée (5 000 €)', category: 'placement', price: 5000, upkeep: 0, ostentation: 0, drift: 0.03, volatility: 0, stackable: true,
    description: 'Sûr et discret, mais ça ne rapporte pas grand-chose.',
    perks: {},
  },
  {
    id: 'actions', label: 'Portefeuille d’actions (10 000 €)', category: 'placement', price: 10000, upkeep: 0, ostentation: 0, drift: 0.07, volatility: 0.025, stackable: true,
    description: 'Dividendes et plus-values… et le risque d’un krach. Gare aux conflits d’intérêts.',
    perks: { rent: 6 },
  },
  {
    id: 'crypto', label: 'Cryptomonnaies (3 000 €)', category: 'placement', price: 3000, upkeep: 0, ostentation: 0, drift: 0.15, volatility: 0.09, stackable: true,
    description: 'Très volatil. Peut doubler en un mois ou fondre en une semaine.',
    perks: {},
  },
];

export const ASSETS_BY_ID = new Map(ASSETS.map(a => [a.id, a]));

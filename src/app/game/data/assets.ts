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

/** Bonus mensuels tant que le bien est possédé */
export interface AssetPerks {
  energy?: number;
  stress?: number;
  popularity?: number;
  influence?: number;
  credibility?: number;
  politicalCapital?: number;
  /** Points d'action en plus chaque mois */
  ap?: number;
  /** Loyer ou dividende, en € par mois */
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
  /** Entretien en € par mois */
  upkeep: number;
  /** 0 (discret) … 10 (tapageur) : pèse sur l'image */
  ostentation: number;
  /** Variation annuelle moyenne de la valeur (−0.3 = −30 %/an) */
  drift: number;
  /** Volatilité hebdomadaire d'origine (écart-type relatif), convertie au mois */
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
    id: 'velo', label: 'Vélo électrique', category: 'quotidien', price: 1200, upkeep: 20, ostentation: 0, drift: -0.2, volatility: 0,
    description: 'Pour aller au conseil municipal sans voiture. Excellent pour l’image.',
    perks: { energy: 2, stress: -1 }, onBuy: [st('popularity', 2)],
  },
  {
    id: 'costume', label: 'Costume (ou tailleur) sur mesure', category: 'quotidien', price: 2500, upkeep: 0, ostentation: 2, drift: -0.3, volatility: 0,
    description: 'Une coupe impeccable : on vous prend plus au sérieux sur les plateaux.',
    perks: { credibility: 0.15 }, onBuy: [st('credibility', 3)],
  },
  {
    id: 'smartphone', label: 'Smartphone dernier cri', category: 'quotidien', price: 1300, upkeep: 45, ostentation: 1, drift: -0.4, volatility: 0,
    description: 'Vidéos plus belles, réponses plus rapides.',
    perks: { influence: 0.2, popularity: 0.1, stress: 0.5 },
  },
  {
    id: 'coach', label: 'Salle de sport et coach', category: 'quotidien', price: 800, upkeep: 200, ostentation: 1, drift: -1, volatility: 0,
    description: 'Trois séances par semaine. On tient mieux les nuits de congrès.',
    perks: { energy: 4, stress: -2 },
  },
  {
    id: 'bibliotheque', label: 'Bibliothèque d’ouvrages rares', category: 'quotidien', price: 9000, upkeep: 0, ostentation: 2, drift: 0.02, volatility: 0.004,
    description: 'Des éditions originales et des rapports reliés. Vos dossiers s’oublient moins vite.',
    perks: { dossierDecay: 0.8 }, onBuy: [st('credibility', 2)],
  },
  {
    id: 'chien', label: 'Un chien de refuge', category: 'quotidien', price: 400, upkeep: 90, ostentation: 0, drift: -1, volatility: 0,
    description: 'Un bâtard au regard tendre, adopté au refuge. Les promenades du soir vous font du bien, et les photos aussi.',
    perks: { stress: -2, popularity: 0.1 }, onBuy: [st('popularity', 2)],
  },
  {
    id: 'espresso', label: 'Machine à espresso professionnelle', category: 'quotidien', price: 1800, upkeep: 30, ostentation: 1, drift: -0.15, volatility: 0,
    description: 'Le carburant des nuits de négociation. Vos collaborateurs viennent au bureau avec le sourire.',
    perks: { energy: 2 },
  },
  {
    id: 'presse', label: 'Abonnements à toute la presse', category: 'quotidien', price: 600, upkeep: 120, ostentation: 0, drift: -1, volatility: 0,
    description: 'Quotidiens, hebdos, revues spécialisées : vous lisez tout, et vos dossiers s’oublient moins vite.',
    perks: { dossierDecay: 0.9, influence: 0.05 },
  },
  {
    id: 'piano', label: 'Piano droit', category: 'quotidien', price: 6500, upkeep: 15, ostentation: 2, drift: -0.05, volatility: 0,
    description: 'Une demi-heure de Chopin avant de dormir. Le stress fond.',
    perks: { stress: -2 },
  },
  // ── Véhicules ──
  {
    id: 'citadine', label: 'Citadine électrique', category: 'vehicule', price: 18000, upkeep: 150, ostentation: 1, drift: -0.15, volatility: 0,
    description: 'Discrète et pratique pour sillonner la circonscription.',
    perks: { energy: 3 },
  },
  {
    id: 'berline', label: 'Berline avec chauffeur', category: 'vehicule', price: 45000, upkeep: 2800, ostentation: 6, drift: -0.15, volatility: 0, minRank: 'conseiller_municipal',
    description: 'Vous travaillez pendant les trajets : un point d’action de plus par mois.',
    perks: { ap: 1, energy: 3, stress: -1 },
  },
  {
    id: 'sportive', label: 'Voiture de sport', category: 'vehicule', price: 95000, upkeep: 500, ostentation: 9, drift: -0.12, volatility: 0,
    description: 'Le plaisir de conduire… et des photos qui ne passent pas inaperçues.',
    perks: { stress: -3, energy: 1 },
  },
  {
    id: 'scooter', label: 'Scooter électrique', category: 'vehicule', price: 3500, upkeep: 35, ostentation: 0, drift: -0.2, volatility: 0,
    description: 'Se faufiler entre deux rendez-vous, casque sous le bras.',
    perks: { energy: 2, stress: -0.5 },
  },
  {
    id: 'camping_car', label: 'Camping-car de campagne', category: 'vehicule', price: 62000, upkeep: 400, ostentation: 4, drift: -0.12, volatility: 0, minRank: 'conseiller_municipal',
    description: 'Votre permanence ambulante : un tour de France des marchés, café offert.',
    perks: { popularity: 0.15, energy: -1 }, onBuy: [{ kind: 'segment', segment: 'ruraux', delta: 2 }],
  },
  {
    id: 'helico', label: 'Parts d’hélicoptère en multipropriété', category: 'vehicule', price: 180000, upkeep: 3500, ostentation: 9, drift: -0.1, volatility: 0, minRank: 'depute',
    description: 'Trois déplacements dans la journée : un point d’action de plus… et des unes assassines.',
    perks: { ap: 1, energy: 2 },
  },
  // ── Immobilier ──
  {
    id: 'studio', label: 'Pied-à-terre à Paris', category: 'immobilier', price: 190000, upkeep: 260, ostentation: 2, drift: 0.03, volatility: 0.003, mortgage: true,
    description: 'Fini les hôtels les soirs de séance. Permet de recevoir à dîner.',
    perks: { energy: 4, stress: -1 }, unlocks: 'Recevoir à dîner',
  },
  {
    id: 'locatif', label: 'Appartement en location', category: 'immobilier', price: 160000, upkeep: 170, ostentation: 2, drift: 0.025, volatility: 0.003, mortgage: true,
    description: 'Un investissement locatif : un loyer chaque mois.',
    perks: { rent: 750 },
  },
  {
    id: 'maison', label: 'Maison de campagne', category: 'immobilier', price: 230000, upkeep: 390, ostentation: 4, drift: 0.02, volatility: 0.003, mortgage: true,
    description: 'Ancrage dans le terroir, week-ends au calme, barbecues avec les maires du coin.',
    perks: { stress: -3 }, onBuy: [{ kind: 'dossier', domain: 'territoires', delta: 4 }], unlocks: 'Recevoir à dîner · Séjour à la campagne',
  },
  {
    id: 'villa', label: 'Villa sur la Côte', category: 'immobilier', price: 950000, upkeep: 2600, ostentation: 9, drift: 0.04, volatility: 0.004, mortgage: true, minRank: 'depute',
    description: 'Piscine, vue sur la mer, voisins influents. Les paparazzi adorent.',
    perks: { stress: -5, influence: 0.4 }, unlocks: 'Recevoir à dîner · Séjour à la campagne · Louer la villa',
  },
  {
    id: 'permanence', label: 'Local de permanence en centre-ville', category: 'immobilier', price: 120000, upkeep: 450, ostentation: 1, drift: 0.02, volatility: 0.003, mortgage: true, minRank: 'conseiller_municipal',
    description: 'Une vitrine, une porte ouverte le samedi : les habitants viennent à vous.',
    perks: { popularity: 0.2 }, onBuy: [{ kind: 'dossier', domain: 'territoires', delta: 3 }],
  },
  {
    id: 'parking', label: 'Place de parking à Paris', category: 'immobilier', price: 35000, upkeep: 30, ostentation: 0, drift: 0.02, volatility: 0.002,
    description: 'Le placement le plus parisien qui soit : un loyer chaque mois, sans locataire qui appelle la nuit.',
    perks: { rent: 160 },
  },
  {
    id: 'chalet', label: 'Chalet à la montagne', category: 'immobilier', price: 420000, upkeep: 900, ostentation: 6, drift: 0.03, volatility: 0.003, mortgage: true, minRank: 'conseiller_municipal',
    description: 'Ski l’hiver, randonnées l’été, et des voisins qui dirigent de grandes entreprises.',
    perks: { stress: -4, influence: 0.2 }, unlocks: 'Séjour à la campagne',
  },
  {
    id: 'vignes', label: 'Parcelle de vignes', category: 'immobilier', price: 140000, upkeep: 600, ostentation: 3, drift: 0.03, volatility: 0.006, mortgage: true,
    description: 'Deux hectares de coteaux, une cuvée à votre nom offerte aux maires du canton.',
    perks: { rent: 500, influence: 0.1 }, onBuy: [{ kind: 'segment', segment: 'ruraux', delta: 2 }],
  },
  // ── Luxe & art ──
  {
    id: 'montre', label: 'Montre de luxe', category: 'luxe', price: 9500, upkeep: 0, ostentation: 6, drift: 0.03, volatility: 0.006,
    description: 'Elle impressionne dans les dîners d’affaires. Beaucoup moins sur un marché.',
    perks: { influence: 0.2 }, onBuy: [st('influence', 2)],
  },
  {
    id: 'cave', label: 'Cave à vins', category: 'luxe', price: 6000, upkeep: 60, ostentation: 3, drift: 0.04, volatility: 0.004,
    description: 'De quoi régaler vos invités… et vous détendre.',
    perks: { stress: -1, influence: 0.1 },
  },
  {
    id: 'art', label: 'Toile d’un peintre contemporain', category: 'luxe', price: 32000, upkeep: 90, ostentation: 5, drift: 0.05, volatility: 0.015,
    description: 'Une cote qui peut s’envoler… ou s’effondrer. Ouvre les portes des galeries.',
    perks: { influence: 0.3 }, unlocks: 'Vernissage privé',
  },
  {
    id: 'yacht', label: 'Voilier de croisière', category: 'luxe', price: 420000, upkeep: 7800, ostentation: 10, drift: -0.08, volatility: 0, minRank: 'depute',
    description: 'Des invités prestigieux à bord. Une image désastreuse dans l’opinion.',
    perks: { stress: -5, influence: 0.6 },
  },
  {
    id: 'stylo', label: 'Stylo plume de collection', category: 'luxe', price: 1500, upkeep: 0, ostentation: 2, drift: 0.02, volatility: 0.003,
    description: 'Pour signer les lois, un jour. En attendant, les dédicaces.',
    perks: { credibility: 0.05 }, onBuy: [st('credibility', 1)],
  },
  {
    id: 'street_art', label: 'Œuvre de street art', category: 'luxe', price: 14000, upkeep: 20, ostentation: 3, drift: 0.08, volatility: 0.02,
    description: 'Un pochoir d’un artiste montant : les jeunes adorent, les galeristes spéculent.',
    perks: { influence: 0.1 }, onBuy: [{ kind: 'segment', segment: 'jeunes', delta: 2 }],
  },
  {
    id: 'cheval', label: 'Cheval de course', category: 'luxe', price: 75000, upkeep: 2200, ostentation: 8, drift: -0.1, volatility: 0.02, minRank: 'conseiller_municipal',
    description: 'Les tribunes de Longchamp, les propriétaires influents… et le risque de finir en photo dans un magazine.',
    perks: { influence: 0.4, stress: -1 },
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
    perks: { rent: 25 },
  },
  {
    id: 'crypto', label: 'Cryptomonnaies (3 000 €)', category: 'placement', price: 3000, upkeep: 0, ostentation: 0, drift: 0.15, volatility: 0.09, stackable: true,
    description: 'Très volatil. Peut doubler en un trimestre ou fondre en un mois.',
    perks: {},
  },
  {
    id: 'or', label: 'Lingot d’or (12 000 €)', category: 'placement', price: 12000, upkeep: 0, ostentation: 1, drift: 0.04, volatility: 0.012, stackable: true,
    description: 'La valeur refuge par excellence. Ne rapporte rien, mais tient bon dans les crises.',
    perks: {},
  },
  {
    id: 'obligations', label: 'Obligations d’État (8 000 €)', category: 'placement', price: 8000, upkeep: 0, ostentation: 0, drift: 0.025, volatility: 0.004, stackable: true,
    description: 'Prêter à la France : patriotique, sûr, et un petit coupon chaque mois.',
    perks: { rent: 15 },
  },
  {
    id: 'startup', label: 'Parts d’une start-up locale (5 000 €)', category: 'placement', price: 5000, upkeep: 0, ostentation: 1, drift: 0.12, volatility: 0.07, stackable: true,
    description: 'Une jeune pousse de votre région : elle peut décupler… ou disparaître.',
    perks: {}, onBuy: [{ kind: 'segment', segment: 'cadres', delta: 1 }],
  },
  {
    id: 'foret', label: 'Parcelle de forêt (20 000 €)', category: 'placement', price: 20000, upkeep: 40, ostentation: 0, drift: 0.02, volatility: 0.002, stackable: true,
    description: 'Des chênes qui poussent lentement : un patrimoine pour vos petits-enfants, et pour la planète.',
    perks: { stress: -0.5 }, onBuy: [{ kind: 'dossier', domain: 'ecologie', delta: 2 }],
  },
];

export const ASSETS_BY_ID = new Map(ASSETS.map(a => [a.id, a]));

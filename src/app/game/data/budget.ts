import { Domain, MissionId, PartyLine, Segment, TaxId } from '../models/game.models';

/* ============================================================
 *  Budgets.
 *  Parti : montants mensuels en milliers d'euros.
 *  État : montants annuels en milliards d'euros (chiffres de jeu,
 *  ordres de grandeur simplifiés, pas un vrai projet de loi de finances).
 * ============================================================ */

// ── Parti ───────────────────────────────────────────────────

export interface PartyLineDef {
  id: PartyLine;
  label: string;
  effect: string;
  base: number;
  min: number;
  max: number;
}

export const PARTY_LINES: PartyLineDef[] = [
  { id: 'permanents', label: 'Permanents et salariés', effect: 'Sous 180 k€, chaque euro dépensé ailleurs est moins efficace.', base: 180, min: 60, max: 320 },
  { id: 'communication', label: 'Communication et affichage', effect: 'Popularité et dynamique de campagne.', base: 120, min: 0, max: 400 },
  { id: 'formation', label: 'Formation des militants', effect: 'Adhésions et soutien des courants.', base: 40, min: 0, max: 200 },
  { id: 'federations', label: 'Fédérations locales', effect: 'Cohésion, adhésions et influence locale.', base: 80, min: 0, max: 250 },
  { id: 'evenements', label: 'Congrès et universités d’été', effect: 'Soutien des courants et influence.', base: 40, min: 0, max: 200 },
  { id: 'campagne', label: 'Réserve de campagne', effect: 'Versée chaque mois sur votre compte de campagne.', base: 50, min: 0, max: 400 },
];

/** Loyer et frais fixes du siège (k€/mois) */
export const PARTY_FIXED_COSTS = 60;

// ── État ────────────────────────────────────────────────────

export interface MissionDef {
  id: MissionId;
  label: string;
  domain: Domain;
  /** Crédits de référence (Md€) */
  base: number;
  /** Réaction des électorats pour +10 % de crédits */
  appeal: Partial<Record<Segment, number>>;
  /** Orientation d'une hausse : -1 plutôt à gauche, +1 plutôt à droite */
  lean: number;
  /** Qui proteste si les crédits baissent fortement */
  cutProtest: string;
}

export const MISSIONS: MissionDef[] = [
  { id: 'education', label: 'Éducation nationale', domain: 'education', base: 64, appeal: { jeunes: 2, populaires: 1 }, lean: -1, cutProtest: 'Grève des enseignants contre les suppressions de postes' },
  { id: 'sante', label: 'Santé et solidarités', domain: 'sante', base: 32, appeal: { retraites: 2, populaires: 1 }, lean: -1, cutProtest: 'Les soignants dans la rue contre l’austérité' },
  { id: 'defense', label: 'Défense', domain: 'diplomatie', base: 50, appeal: { retraites: 1 }, lean: 1, cutProtest: 'Les chefs d’état-major mettent en garde contre les coupes' },
  { id: 'securite', label: 'Sécurités (police, gendarmerie)', domain: 'securite', base: 25, appeal: { retraites: 2, ruraux: 1 }, lean: 1, cutProtest: 'Les syndicats de police manifestent devant Beauvau' },
  { id: 'justice', label: 'Justice', domain: 'justice', base: 11, appeal: { cadres: 1 }, lean: 0, cutProtest: 'Magistrats et avocats dénoncent une justice à l’abandon' },
  { id: 'ecologie', label: 'Écologie et énergie', domain: 'ecologie', base: 24, appeal: { jeunes: 2, ruraux: -1 }, lean: -1, cutProtest: 'Les ONG climat accusent le gouvernement de renoncer' },
  { id: 'economie', label: 'Économie et emploi', domain: 'economie', base: 22, appeal: { cadres: 1, populaires: 1 }, lean: 0, cutProtest: 'Les organisations patronales et syndicales protestent ensemble' },
  { id: 'territoires', label: 'Collectivités et territoires', domain: 'territoires', base: 16, appeal: { ruraux: 3 }, lean: 0, cutProtest: 'Les maires rendent leur écharpe en signe de protestation' },
  { id: 'recherche', label: 'Recherche et numérique', domain: 'numerique', base: 32, appeal: { jeunes: 1, cadres: 1 }, lean: 0, cutProtest: 'Les chercheurs signent une tribune contre les coupes' },
];

/** Dépenses non pilotables cette année (Md€) */
export const FIXED_SPENDING = { dette: 55, autres: 96 };
export const PIB = 2900;
export const MISSION_RANGE = 0.2;

export interface TaxDef {
  id: TaxId;
  label: string;
  unit: string;
  base: number;
  min: number;
  max: number;
  step: number;
  /** Recette de référence (Md€) */
  revenue: number;
  /** Recette supplémentaire par unité au-dessus de la base (Md€) */
  perUnit: number;
  /** Réaction des électorats par unité de hausse */
  appeal: Partial<Record<Segment, number>>;
  /** Orientation d'une hausse, par unité */
  lean: number;
  help: string;
}

export const TAXES: TaxDef[] = [
  { id: 'tva', label: 'TVA (taux normal)', unit: '%', base: 20, min: 18, max: 22, step: 0.5, revenue: 98, perUnit: 4.9, appeal: { populaires: -3, retraites: -1 }, lean: 0, help: 'La recette la plus massive, mais elle pèse sur tous les ménages.' },
  { id: 'ir', label: 'Impôt sur le revenu (barème)', unit: '%', base: 0, min: -10, max: 10, step: 1, revenue: 92, perUnit: 0.92, appeal: { cadres: -0.6, populaires: 0.1 }, lean: -0.6, help: 'Hausse ou baisse générale du barème, en pourcentage.' },
  { id: 'is', label: 'Impôt sur les sociétés', unit: '%', base: 25, min: 20, max: 33, step: 1, revenue: 58, perUnit: 2.3, appeal: { cadres: -1 }, lean: -1, help: 'Chaque point rapporte environ 2,3 Md€.' },
  { id: 'energie', label: 'Fiscalité de l’énergie', unit: '%', base: 0, min: -20, max: 20, step: 5, revenue: 20, perUnit: 0.2, appeal: { ruraux: -0.3, jeunes: 0.1, populaires: -0.1 }, lean: -0.05, help: 'Carburants et chauffage : sensible hors des grandes villes.' },
  { id: 'patrimoine', label: 'Taxation du patrimoine', unit: 'niv.', base: 0, min: 0, max: 3, step: 1, revenue: 2, perUnit: 4, appeal: { cadres: -2, populaires: 1 }, lean: -8, help: 'De 0 (impôt actuel sur l’immobilier) à 3 (impôt sur la fortune élargi).' },
];

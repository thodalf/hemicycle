import { TraitMods } from './traits';

/* ============================================================
 *  Styles de vie : un axe de carrière qui gagne de l'expérience
 *  chaque mois (et davantage quand vos actions s'y rattachent).
 *  Chaque palier débloque un avantage ; le dernier, un trait.
 * ============================================================ */

export interface Perk { id: string; label: string; desc: string; mods: TraitMods; monthly?: Partial<Record<'renown' | 'dread', number>> }
export interface Lifestyle {
  id: string;
  label: string;
  icon: string;
  /** Une phrase d'accroche */
  tagline: string;
  /** Le portrait : qui vous êtes quand vous suivez ce style */
  desc: string;
  /** Pour qui ce style est fait */
  forWho: string;
  /** Catégories d'actions qui font progresser ce style */
  categories: string[];
  perks: Perk[];
  /** Trait obtenu en terminant l'arbre */
  trait: string;
}

export const XP_PER_PERK = 190;
/** Expérience gagnée chaque mois (hors actions du style) */
export const XP_MONTHLY = 6;
/** Par action du style, au plus trois par mois */
export const XP_PER_ACTION = 6;

export const LIFESTYLES: Lifestyle[] = [
  {
    id: 'tribun', label: 'Tribun', icon: '📣', tagline: 'La parole qui soulève les salles.',
    desc: 'Vous êtes fait·e pour les estrades, les marchés bondés et les plateaux du dimanche soir. Une formule bien placée vaut tous les programmes : vous la cherchez, vous la trouvez, et la salle se lève. Vos adversaires préparent leurs fiches ; vous, vous préparez vos silences.',
    forWho: 'Pour les candidat·e·s qui veulent gagner les débats, la popularité et les élections au charisme.', categories: ['terrain', 'medias'], trait: 'orateur_legendaire',
    perks: [
      { id: 'tribun_1', label: 'Voix posée', desc: 'Sang-froid +6 en débat, Émotion +8 %.', mods: { composure: 6, debate: { emotion: 1.08 } } },
      { id: 'tribun_2', label: 'Sens de la formule', desc: 'Gains de popularité +8 %.', mods: { gain: { popularity: 1.08 } } },
      { id: 'tribun_3', label: 'Bête de scène', desc: 'Attaque et Émotion +8 % en débat, +1 renommée par mois.', mods: { debate: { attaque: 1.08, emotion: 1.08 } }, monthly: { renown: 1 } },
    ],
  },
  {
    id: 'gestionnaire', label: 'Gestionnaire', icon: '📊', tagline: 'Les annexes avant les discours.',
    desc: 'Pendant que d’autres paradent, vous lisez les annexes budgétaires. Circulaires, tableaux de bord, arbitrages de Bercy : vous savez où passe chaque euro. Les ministères qui vous sont confiés tournent, et les hauts fonctionnaires finissent par vous respecter.',
    forWho: 'Pour celles et ceux qui visent un ministère, Matignon, et veulent des dossiers solides et du capital politique.', categories: ['dossiers', 'fonction', 'elysee'], trait: 'grand_commis',
    perks: [
      { id: 'gest_1', label: 'Fiches impeccables', desc: 'Apprentissage des dossiers +10 %.', mods: { mastery: 1.1 } },
      { id: 'gest_2', label: 'Rigueur', desc: 'Gains de crédibilité +8 %, Faits +8 % en débat.', mods: { gain: { credibility: 1.08 }, debate: { faits: 1.08 } } },
      { id: 'gest_3', label: 'Machine administrative', desc: '+1 capital politique par mois, pertes d’énergie −8 %.', mods: { monthly: { politicalCapital: 1 }, loss: { energy: 0.92 } } },
    ],
  },
  {
    id: 'negociateur', label: 'Négociateur', icon: '🤝', tagline: 'Les majorités se font dans les couloirs.',
    desc: 'Votre bureau ne désemplit jamais. Un café ici, un déjeuner là, un texto à minuit : vous faites et défaites les majorités. Vous savez ce que chacun veut et ce qu’il est prêt à céder, et personne ne vous en veut très longtemps.',
    forWho: 'Pour tenir un parti, apaiser les courants, empêcher les frondes et réunir des coalitions.', categories: ['parti', 'reseau'], trait: 'faiseur_de_rois',
    perks: [
      { id: 'nego_1', label: 'Poignée de main', desc: 'Amitiés +12 %.', mods: { relationUp: 1.12 } },
      { id: 'nego_2', label: 'Mémoire courte des rancunes', desc: 'Rancunes −15 %.', mods: { relationDown: 0.85 } },
      { id: 'nego_3', label: 'Maître des couloirs', desc: 'Gains d’influence +10 %, frondes moins fortes.', mods: { gain: { influence: 1.1 } } },
    ],
  },
  {
    id: 'intrigant', label: 'Intrigant', icon: '🕯️', tagline: 'Rien ne se dit sans que vous le sachiez.',
    desc: 'Vous connaissez le prénom de chaque chauffeur et le contenu de chaque coffre. Les secrets remontent jusqu’à vous, les complots se nouent dans votre salon. On vous sourit dans les couloirs… et on baisse la voix quand vous passez.',
    forWho: 'Pour qui joue avec les secrets, les leviers, les complots et la crainte.', categories: ['intrigue'], trait: 'machiavel',
    perks: [
      { id: 'intr_1', label: 'Oreilles partout', desc: 'Les missions de recherche de secrets réussissent plus souvent.', mods: {} },
      { id: 'intr_2', label: 'Discrétion', desc: 'Exposition aux scandales −10 %.', mods: { exposure: 0.9 } },
      { id: 'intr_3', label: 'Main de fer', desc: '+1 crainte par mois, Parade +10 % en débat.', mods: { debate: { parade: 1.1 } }, monthly: { dread: 1 } },
    ],
  },
  {
    id: 'intellectuel', label: 'Intellectuel', icon: '📚', tagline: 'Les idées survivent aux mandats.',
    desc: 'Vous écrivez vos discours vous-même, citez Tocqueville sans notes et publiez un essai tous les deux ans. On vous écoute moins fort, mais plus longtemps : vos tribunes font réfléchir, et vos adversaires vous lisent en cachette.',
    forWho: 'Pour gagner en crédibilité et en renommée, maîtriser les dossiers et briller dans les débats d’idées.', categories: ['dossiers', 'medias'], trait: 'penseur',
    perks: [
      { id: 'intel_1', label: 'Lecteur vorace', desc: 'Apprentissage des dossiers +8 %, crédibilité +5 %.', mods: { mastery: 1.08, gain: { credibility: 1.05 } } },
      { id: 'intel_2', label: 'Esprit critique', desc: 'Faits +10 % en débat.', mods: { debate: { faits: 1.1 } } },
      { id: 'intel_3', label: 'Autorité morale', desc: 'Gains de crédibilité +8 %, +1 renommée par mois.', mods: { gain: { credibility: 1.08 } }, monthly: { renown: 1 } },
    ],
  },
];
export const LIFESTYLE_BY_ID = new Map(LIFESTYLES.map(l => [l.id, l]));
export const PERK_BY_ID = new Map(LIFESTYLES.flatMap(l => l.perks.map(p => [p.id, p] as const)));

/** Paliers de renommée */
export const RENOWN_TIERS: { min: number; label: string; icon: string }[] = [
  { min: 0, label: 'Inconnu·e', icon: '·' },
  { min: 100, label: 'Notable', icon: '★' },
  { min: 300, label: 'Célèbre', icon: '★★' },
  { min: 700, label: 'Illustre', icon: '★★★' },
  { min: 1500, label: 'Légendaire', icon: '👑' },
];

export function renownTier(renown: number): number {
  let t = 0;
  RENOWN_TIERS.forEach((r, i) => { if (renown >= r.min) t = i; });
  return t;
}

import { Rarity, TraitId } from '../models/game.models';

/* ============================================================
 *  Recrues : chaque personne a un rôle (bonus de poste), une
 *  rareté et des traits de personnalité, atouts ou travers.
 * ============================================================ */

export interface TraitDef {
  label: string;
  good: boolean;
  description: string;
}

export const TRAITS: Record<TraitId, TraitDef> = {
  carnet: { label: 'Carnet d’adresses', good: true, description: '+0,5 influence par mois.' },
  bourreau: { label: 'Bourreau de travail', good: true, description: '+1 point d’action par mois.' },
  mediatique: { label: 'Bon client des médias', good: true, description: '+0,5 popularité par mois.' },
  technocrate: { label: 'Technocrate', good: true, description: 'Étude des dossiers +15 %.' },
  leveur: { label: 'Leveur de fonds', good: true, description: '+4 000 € par mois sur le compte de campagne.' },
  fidele: { label: 'Fidèle', good: true, description: '−2 stress par mois, ne vous trahira jamais.' },
  stratege: { label: 'Stratège', good: true, description: '+1 capital politique par mois, +2 dynamique en campagne.' },
  reseaux_sociaux: { label: 'As des réseaux sociaux', good: true, description: '+0,4 popularité par mois, réussite des posts améliorée.' },
  gaffeur: { label: 'Gaffeur', good: false, description: '+2 exposition aux scandales par mois.' },
  ambitieux: { label: 'Ambitieux', good: false, description: 'Peut partir chez un rival en emportant vos secrets.' },
  dispendieux: { label: 'Dispendieux', good: false, description: 'Salaire majoré de 50 %.' },
  colerique: { label: 'Colérique', good: false, description: '+3 stress par mois.' },
  mal_vu: { label: 'Mal vu au parti', good: false, description: 'Les courants vous en tiennent rigueur (−0,4 par mois).' },
  casseroles: { label: 'Casseroles judiciaires', good: false, description: '+2,5 exposition aux scandales par mois.' },
  paresseux: { label: 'Paresseux', good: false, description: '−3 énergie par mois : vous faites le travail à sa place.' },
};

export const GOOD_TRAITS = (Object.keys(TRAITS) as TraitId[]).filter(t => TRAITS[t].good);
export const BAD_TRAITS = (Object.keys(TRAITS) as TraitId[]).filter(t => !TRAITS[t].good);

export const RARITY_LABELS: Record<Rarity, string> = { commun: 'Commun', rare: 'Rare', legendaire: 'Légendaire' };
export const RARITY_SALARY: Record<Rarity, number> = { commun: 0.9, rare: 1.2, legendaire: 1.6 };

export const FIRST_NAMES = [
  'Inès', 'Bastien', 'Clémence', 'Jean-Baptiste', 'Myriam', 'Thibault', 'Sarah', 'Karim', 'Hortense', 'Loïc',
  'Agathe', 'Mehdi', 'Solène', 'Grégoire', 'Yasmine', 'Antoine', 'Maëlle', 'Rodolphe', 'Leïla', 'Baptiste',
  'Ophélie', 'Samuel', 'Capucine', 'Nordine', 'Victoire', 'Arthur', 'Zoé', 'Hugo', 'Margaux', 'Félix',
];

export const LAST_NAMES = [
  'Valadier', 'Morel', 'Arnaud', 'Roux', 'Haddad', 'Kessler', 'Lefèvre', 'Benamar', 'de Saint-Aubin', 'Le Bihan',
  'Garnier', 'Ouali', 'Mercier', 'Delaunay', 'Brahimi', 'Castel', 'Perrin', 'Vidal', 'Toussaint', 'Lambert',
  'Fontaine', 'Rivière', 'Moulin', 'Chevalier', 'Leroy', 'Marchal', 'Besnard', 'Collin', 'Rey', 'Barbier',
];

export const BACKGROUNDS = [
  'Ancienne plume d’un ministre', 'Ex-journaliste politique', 'Sortie de l’ENA, en rupture de ban', 'Ancien militant syndical',
  'Débauché d’un cabinet de conseil', 'Ex-collaboratrice parlementaire', 'Venu du monde associatif', 'Ancien publicitaire',
  'Ex-trader reconverti', 'Professeure de droit public', 'Ancien chef de cabinet d’un maire', 'Influenceuse politique',
];

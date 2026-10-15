import { ActionDefinition, GameState } from '../models/game.models';

/* ============================================================
 *  La fonction occupée : un président ne colle pas d'affiches,
 *  un roi ne mendie pas au trésorier du parti, et une ministre
 *  ne pose pas de question au gouvernement.
 * ============================================================ */

export type Office = 'base' | 'depute' | 'gouv' | 'elysee' | 'couronne';

export function office(d: GameState): Office {
  const r = d.player.rankId;
  if (r === 'roi' || d.kingdom) return 'couronne';
  if (r === 'president') return 'elysee';
  if (r === 'ministre' || r === 'premier_ministre') return 'gouv';
  if (r === 'depute') return 'depute';
  return 'base';
}

/** Élysée ou couronne */
export const highOffice = (d: GameState) => { const o = office(d); return o === 'elysee' || o === 'couronne'; };
/** Au gouvernement, à l'Élysée ou sur le trône */
export const inPower = (d: GameState) => office(d) !== 'base' && office(d) !== 'depute';

/** Le militantisme de base : indigne d'un chef d'État */
const GRASSROOTS = new Set([
  'porte_a_porte', 'operation_porte_a_porte', 'seg_quartiers', 'reunion_quartier', 'manifestation', 'marche', 'marche_dimanche', 'marche_du_dimanche',
  'tractage', 'permanence_citoyenne', 'permanence_tel', 'permanence_nuit', 'permanence_mobile', 'fete_village', 'quiz_bistrot', 'quiz_militants',
  'apero_militants', 'apero_colleurs', 'pique_nique', 'adhesions', 'fete_section', 'motion', 'cafe_politique', 'cafe_citoyen', 'brocante',
  'boutique_ephemere', 'jeu_tele', 'cuisine_tele', 'emission_cuisine', 'the_dansant', 'debat_twitch', 'jeu_citations', 'lettre_info',
  'mentorat', 'mentor_jeunes', 'mentorat_jeune', 'commission_investitures', 'cours_anglais', 'cours_langues', 'note_frais', 'collecte_en_ligne',
  'petits_donateurs', 'matinale_locale', 'radios_locales', 'chercher_parrainages', 'tournee_maires', 'face_a_face', 'demonter', 'live',
  'live_questions', 'live_reseaux', 'live_reseaux_jeunes', 'podcast', 'podcast_politique', 'dedicace', 'concert_campagne', 'conference_payee',
  'chronique', 'cours', 'courant', 'dejeuner', 'duel', 'placer_proche', 'concours_insp', 'formation', 'quiz_bistrot', 'debat_lycee', 'debat_lyceens',
]);
/** Les outils du député d'opposition : sans objet quand on gouverne */
const PARLIAMENT = new Set(['hemicycle', 'commission', 'question_gouv', 'question_ecrite', 'rapport_parlementaire', 'alerte_chomage', 'contre_budget', 'amendement', 'pointage_groupe']);

/** Une action est-elle hors de propos pour la fonction occupée ? */
export function hiddenForOffice(d: GameState, a: ActionDefinition): boolean {
  const o = office(d);
  if ((o === 'gouv' || o === 'elysee' || o === 'couronne') && PARLIAMENT.has(a.id)) return true;
  if ((o === 'elysee' || o === 'couronne') && GRASSROOTS.has(a.id)) return true;
  // Un souverain constitutionnel se tient au-dessus des partis
  if (o === 'couronne' && a.category === 'parti') return true;
  return false;
}

/** « Monsieur le Président », « Votre Majesté », « Madame la Ministre »… */
export function honorific(d: GameState): string {
  const f = d.player.gender === 'femme';
  switch (office(d)) {
    case 'couronne': return 'Votre Majesté';
    case 'elysee': return f ? 'Madame la Présidente' : 'Monsieur le Président';
    case 'gouv': return d.player.rankId === 'premier_ministre' ? (f ? 'Madame la Première ministre' : 'Monsieur le Premier ministre') : (f ? 'Madame la Ministre' : 'Monsieur le Ministre');
    case 'depute': return f ? 'Madame la Députée' : 'Monsieur le Député';
    default: return f ? 'Madame' : 'Monsieur';
  }
}

/** Le lieu du pouvoir, pour les textes */
export function seat(d: GameState): string {
  switch (office(d)) {
    case 'couronne': return 'au Palais';
    case 'elysee': return 'à l’Élysée';
    case 'gouv': return d.player.rankId === 'premier_ministre' ? 'à Matignon' : 'au ministère';
    case 'depute': return 'à l’Assemblée';
    default: return 'à la permanence';
  }
}

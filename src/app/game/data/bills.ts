import { Domain } from '../models/game.models';

/* ============================================================
 *  Textes soumis au vote de l'Assemblée, rattachés au sujet
 *  qui fait l'actualité. « lean » : orientation du texte
 *  (-100 gauche … +100 droite) ; « opinion » : part des Français
 *  favorables au départ.
 * ============================================================ */

export interface BillDef {
  id: string;
  domain: Domain;
  title: string;
  summary: string;
  lean: number;
  opinion: number;
}

export const BILLS: BillDef[] = [
  // Économie
  { id: 'eco_super_profits', domain: 'economie', lean: -55, opinion: 64, title: 'Taxe exceptionnelle sur les superprofits', summary: 'Une contribution de 25 % sur les bénéfices « exceptionnels » des grandes entreprises de l’énergie et du transport maritime.' },
  { id: 'eco_impot_production', domain: 'economie', lean: 45, opinion: 41, title: 'Suppression des impôts de production', summary: 'Huit milliards de baisse d’impôts pour l’industrie, financés par des économies sur les dépenses de l’État.' },
  { id: 'eco_partage_valeur', domain: 'economie', lean: 0, opinion: 72, title: 'Loi sur le partage de la valeur', summary: 'Généraliser l’intéressement et la participation dans les entreprises de plus de onze salariés.' },
  // Social
  { id: 'soc_smic', domain: 'social', lean: -50, opinion: 67, title: 'Revalorisation exceptionnelle du SMIC', summary: 'Un coup de pouce de 5 % au salaire minimum, au-delà de l’indexation automatique.' },
  { id: 'soc_retraites', domain: 'social', lean: 55, opinion: 31, title: 'Report de l’âge légal de départ à 65 ans', summary: 'Pour équilibrer le système de retraite d’ici 2035, l’âge légal recule progressivement.' },
  { id: 'soc_aidants', domain: 'social', lean: -10, opinion: 81, title: 'Statut des proches aidants', summary: 'Un congé indemnisé de trois mois et des droits à la retraite pour ceux qui s’occupent d’un parent dépendant.' },
  // Écologie
  { id: 'eco_vols_courts', domain: 'ecologie', lean: -45, opinion: 58, title: 'Interdiction des vols intérieurs courts', summary: 'Plus d’avion quand le train fait le trajet en moins de quatre heures.' },
  { id: 'eco_nucleaire', domain: 'ecologie', lean: 35, opinion: 55, title: 'Relance du nucléaire : six nouveaux réacteurs', summary: 'Programmation de six EPR et prolongation des centrales existantes jusqu’à soixante ans.' },
  { id: 'eco_zan', domain: 'ecologie', lean: -15, opinion: 49, title: 'Zéro artificialisation nette des sols', summary: 'Diviser par deux la bétonisation des terres agricoles et naturelles d’ici 2031.' },
  // Sécurité
  { id: 'sec_videoprotection', domain: 'securite', lean: 55, opinion: 61, title: 'Vidéoprotection algorithmique', summary: 'Autoriser l’analyse automatisée des images de caméras dans l’espace public, pour trois ans.' },
  { id: 'sec_police_proximite', domain: 'securite', lean: -30, opinion: 66, title: 'Retour de la police de proximité', summary: 'Dix mille agents affectés à des quartiers, avec des missions de prévention.' },
  { id: 'sec_peines_planchers', domain: 'securite', lean: 65, opinion: 57, title: 'Rétablissement des peines planchers', summary: 'Des peines minimales pour les récidivistes et les agresseurs de policiers.' },
  // Justice
  { id: 'jus_cour_criminelle', domain: 'justice', lean: 20, opinion: 44, title: 'Généralisation des cours criminelles', summary: 'Des magistrats professionnels plutôt que des jurés populaires pour juger certains crimes.' },
  { id: 'jus_aide_mourir', domain: 'justice', lean: -25, opinion: 70, title: 'Aide active à mourir', summary: 'Ouvrir, sous conditions strictes, une aide à mourir pour les malades incurables en fin de vie.' },
  { id: 'jus_majorite_penale', domain: 'justice', lean: 60, opinion: 52, title: 'Abaissement de la majorité pénale à 16 ans', summary: 'Juger les mineurs de plus de seize ans comme des adultes pour les crimes violents.' },
  // Éducation
  { id: 'edu_uniforme', domain: 'education', lean: 45, opinion: 59, title: 'Uniforme obligatoire à l’école', summary: 'Une tenue commune de la maternelle au collège, financée par l’État.' },
  { id: 'edu_profs', domain: 'education', lean: -40, opinion: 63, title: 'Revalorisation des enseignants', summary: 'Trois cents euros net de plus par mois pour tous les professeurs, sans contrepartie.' },
  { id: 'edu_ecrans', domain: 'education', lean: 0, opinion: 76, title: 'Interdiction des écrans avant 3 ans', summary: 'Pas d’écrans dans les crèches et une grande campagne de prévention auprès des parents.' },
  // Santé
  { id: 'san_deserts', domain: 'sante', lean: -30, opinion: 62, title: 'Régulation de l’installation des médecins', summary: 'Plus d’installation libre dans les zones déjà bien dotées : priorité aux déserts médicaux.' },
  { id: 'san_franchises', domain: 'sante', lean: 40, opinion: 28, title: 'Doublement des franchises médicales', summary: 'Un euro par boîte de médicaments au lieu de cinquante centimes, pour combler le déficit de la Sécu.' },
  { id: 'san_hopital', domain: 'sante', lean: -10, opinion: 78, title: 'Loi d’urgence pour l’hôpital public', summary: 'Dix mille lits rouverts, des ratios de soignants par patient et un plan d’embauches.' },
  // Numérique
  { id: 'num_majorite', domain: 'numerique', lean: 15, opinion: 74, title: 'Majorité numérique à 15 ans', summary: 'Vérification de l’âge obligatoire pour s’inscrire sur les réseaux sociaux.' },
  { id: 'num_taxe_gafam', domain: 'numerique', lean: -40, opinion: 66, title: 'Taxe sur les géants du numérique', summary: 'Porter de 3 à 6 % la taxe sur le chiffre d’affaires des grandes plateformes réalisé en France.' },
  { id: 'num_ia', domain: 'numerique', lean: 25, opinion: 47, title: 'Plan national pour l’intelligence artificielle', summary: 'Crédits d’impôt massifs et allègement des règles pour attirer les centres de données.' },
  // Territoires
  { id: 'ter_services_publics', domain: 'territoires', lean: -35, opinion: 71, title: 'Garantie d’accès aux services publics', summary: 'Pas plus de vingt minutes de trajet pour une école, une poste ou une maternité.' },
  { id: 'ter_80kmh', domain: 'territoires', lean: 40, opinion: 63, title: 'Retour aux 90 km/h sur les routes départementales', summary: 'Rendre aux départements la liberté de relever la vitesse maximale.' },
  { id: 'ter_communes', domain: 'territoires', lean: 20, opinion: 38, title: 'Fusion des petites communes', summary: 'Regrouper les communes de moins de cinq cents habitants pour rationaliser l’action locale.' },
  // Diplomatie
  { id: 'dip_defense', domain: 'diplomatie', lean: 40, opinion: 54, title: 'Loi de programmation militaire', summary: 'Porter l’effort de défense à 3 % du PIB d’ici 2032 : drones, munitions, cyberdéfense.' },
  { id: 'dip_aide_dev', domain: 'diplomatie', lean: -35, opinion: 45, title: 'Hausse de l’aide au développement', summary: 'Atteindre 0,7 % du revenu national pour la solidarité internationale.' },
  { id: 'dip_traite_ue', domain: 'diplomatie', lean: 10, opinion: 48, title: 'Ratification d’un accord de libre-échange', summary: 'Un traité commercial entre l’Union européenne et le Marché commun du Sud. Les agriculteurs grondent.' },
];

export const BILLS_BY_ID = new Map(BILLS.map(b => [b.id, b]));

/** Sièges de départ de chaque parti (hors non-inscrits), sur 577 */
export const BASE_SEATS: Record<string, number> = { gc: 74, ase: 96, ut: 86, rr: 150, mp: 136 };
export const SEATS = 577;
export const NON_INSCRITS = 14;

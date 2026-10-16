import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/* ============================================================
 *  Le bouclage : composer la Une (puis deux pages intérieures)
 *  d'un quotidien avant l'heure de l'imprimerie. Les dépêches
 *  tombent toute la soirée (20 h → 23 h 30, par quarts d'heure) ;
 *  chaque geste coûte du temps. On place des blocs rectangulaires
 *  sur une grille, on les pivote, on les coupe, on vérifie les
 *  sources douteuses, on jette. Un scoop tardif force à rebâtir la
 *  Une. Au bouclage : audience (le haut de Une compte double),
 *  équilibre des lectorats, pages pleines, publicités casées, ligne
 *  du rédacteur en chef… et gare aux démentis.
 *
 *  Trois variantes : le quotidien national, la soirée électorale
 *  (estimations corrigées en cours de soirée), l'affaire (documents
 *  invérifiés, risque de diffamation).
 *
 *  Toute la simulation est en fonctions pures exportées (testables
 *  hors d'Angular) ; le composant n'est qu'une interface tactile.
 * ============================================================ */

export type Variant = 'quotidien' | 'electoral' | 'scandale';
export type Rub = 'politique' | 'societe' | 'economie' | 'monde' | 'culture' | 'sport' | 'faitsdivers' | 'people' | 'sciences' | 'elections' | 'affaire' | 'maison';
export type Kind = 'manchette' | 'ouverture' | 'enquete' | 'papier' | 'photo' | 'edito' | 'portrait' | 'breve' | 'pub' | 'filet' | 'meteo' | 'jeux';
export type Src = 'maison' | 'agence' | 'officiel' | 'correspondant' | 'institut' | 'anonyme' | 'document' | 'reseaux';
export type LineId = 'fd_une' | 'people' | 'sport_une' | 'monde_une' | 'eco_une' | 'elec_haut' | 'affaire_manchette';
export type Rnd = () => number;

export const KINDS: Record<Kind, { label: string; w: number; h: number; rot: boolean; pts: number }> = {
  manchette: { label: 'Manchette', w: 6, h: 2, rot: false, pts: 12.5 },
  ouverture: { label: 'Ouverture', w: 4, h: 3, rot: true, pts: 10.5 },
  enquete: { label: 'Enquête', w: 3, h: 3, rot: false, pts: 8.5 },
  papier: { label: 'Article', w: 2, h: 3, rot: true, pts: 6 },
  photo: { label: 'Photo', w: 3, h: 2, rot: true, pts: 5.6 },
  edito: { label: 'Éditorial', w: 2, h: 4, rot: false, pts: 6.5 },
  portrait: { label: 'Portrait', w: 2, h: 2, rot: false, pts: 4.2 },
  breve: { label: 'Brève', w: 2, h: 1, rot: true, pts: 2.3 },
  pub: { label: 'Publicité', w: 2, h: 2, rot: true, pts: 0 },
  filet: { label: 'Encadré maison', w: 1, h: 1, rot: false, pts: 0 },
  meteo: { label: 'Météo', w: 2, h: 1, rot: true, pts: 1.4 },
  jeux: { label: 'Mots fléchés', w: 2, h: 2, rot: false, pts: 2.2 },
};

export const READERS = [
  { icon: '🏛️', label: 'Lecteurs politiques' },
  { icon: '🗞️', label: 'Grand public' },
  { icon: '🎧', label: 'Jeunes' },
  { icon: '📈', label: 'Économie' },
];

/** Intérêt de chaque rubrique pour les quatre lectorats */
const PROFILE: Record<Rub, number[]> = {
  politique: [3, 1, 0.5, 1], societe: [1, 3, 1.5, 0.5], economie: [1, 0.5, 0.5, 3], monde: [2, 1, 1, 1.5],
  culture: [0.5, 1.5, 3, 0.3], sport: [0, 3, 2.5, 0.3], faitsdivers: [0.3, 3.5, 1.2, 0], people: [0, 3, 3, 0],
  sciences: [0.5, 1, 2.5, 1], elections: [3.5, 1.5, 1, 1], affaire: [3, 2, 1, 1.5], maison: [0.4, 2, 1, 0.2],
};

export const RUB_LABEL: Record<Rub, string> = {
  politique: 'Politique', societe: 'Société', economie: 'Économie', monde: 'Monde', culture: 'Culture', sport: 'Sport', faitsdivers: 'Faits divers',
  people: 'People', sciences: 'Sciences', elections: 'Élections', affaire: 'L’affaire', maison: 'La maison',
};

export const SRC: Record<Src, { label: string; trust: number; stars: number }> = {
  maison: { label: 'La rédaction', trust: 1, stars: 3 },
  agence: { label: 'Dépêche d’agence', trust: 1, stars: 3 },
  officiel: { label: 'Communiqué officiel', trust: 1, stars: 3 },
  correspondant: { label: 'Notre correspondant', trust: 1, stars: 3 },
  institut: { label: 'Institut de sondage', trust: 1, stars: 2 },
  anonyme: { label: 'Source anonyme', trust: 0.55, stars: 1 },
  document: { label: 'Document transmis', trust: 0.6, stars: 1 },
  reseaux: { label: 'Vu sur les réseaux', trust: 0.3, stars: 1 },
};

export const LINES: Record<LineId, { text: string; short: string }> = {
  fd_une: { text: 'Pas de faits divers à la Une', short: 'pas de faits divers en Une' },
  people: { text: 'Pas de people dans nos colonnes', short: 'pas de people' },
  sport_une: { text: 'Le sport reste en pages intérieures', short: 'pas de sport en Une' },
  monde_une: { text: 'Au moins un sujet Monde à la Une', short: 'un sujet Monde en Une' },
  eco_une: { text: 'Au moins un sujet Économie à la Une', short: 'un sujet Éco en Une' },
  elec_haut: { text: 'Le haut de Une (4 lignes) est réservé à l’élection', short: 'haut de Une = élection' },
  affaire_manchette: { text: 'L’affaire en tête de Une (grand format, ligne du haut)', short: 'l’affaire en tête de Une' },
};

/* ── Les dépêches ── */

interface Seed { t: string; rub: Rub; k: Kind[]; src?: Src; imp?: number; accuse?: boolean; fix?: string }

const GEN: Seed[] = [
  { t: 'Budget : le gouvernement promet de ne pas toucher aux retraites', rub: 'politique', k: ['manchette', 'ouverture', 'papier'], imp: 1.1 },
  { t: 'Le Sénat retoque la réforme des collectivités', rub: 'politique', k: ['ouverture', 'papier', 'breve'] },
  { t: 'Remaniement : trois noms circulent pour l’Intérieur', rub: 'politique', k: ['papier', 'breve', 'portrait'], src: 'anonyme', imp: 1.1 },
  { t: 'La députée Claire Montesson claque la porte de l’Union des Territoires', rub: 'politique', k: ['portrait', 'papier', 'breve'] },
  { t: 'Motion de censure : l’opposition compte ses voix', rub: 'politique', k: ['ouverture', 'papier'] },
  { t: 'Le président de l’Assemblée veut limiter les amendements', rub: 'politique', k: ['papier', 'breve'] },
  { t: 'Renouveau Républicain et Mouvement Populaire se rapprochent en coulisses', rub: 'politique', k: ['papier', 'enquete'], src: 'anonyme', imp: 1.2 },
  { t: 'Le ministre des Finances aurait déjà rédigé sa lettre de démission', rub: 'politique', k: ['breve', 'papier'], src: 'reseaux', imp: 1.2 },
  { t: 'Grève des contrôleurs : week-end noir dans les gares', rub: 'societe', k: ['manchette', 'ouverture', 'photo'], imp: 1.1 },
  { t: 'Logement : les loyers bondissent de 8 % dans les villes moyennes', rub: 'societe', k: ['ouverture', 'papier'] },
  { t: 'Les urgences de Vierzon fermeront la nuit dès lundi', rub: 'societe', k: ['papier', 'photo', 'breve'] },
  { t: 'Bac : la réforme du grand oral divise les lycéens', rub: 'societe', k: ['papier', 'photo', 'breve'] },
  { t: 'Canicule précoce : quarante départements en vigilance orange', rub: 'societe', k: ['manchette', 'ouverture', 'photo'] },
  { t: 'Une école sans écrans : l’expérience rennaise fait des émules', rub: 'societe', k: ['papier', 'photo'] },
  { t: 'Déserts médicaux : les banlieues à leur tour', rub: 'societe', k: ['ouverture', 'enquete', 'papier'] },
  { t: 'Une boisson énergisante provoquerait des malaises chez les ados', rub: 'societe', k: ['papier', 'breve'], src: 'reseaux', imp: 1.2 },
  { t: 'L’inflation repasse sous la barre des 2 %', rub: 'economie', k: ['ouverture', 'papier', 'breve'] },
  { t: 'Le chômage au plus bas depuis quinze ans', rub: 'economie', k: ['manchette', 'ouverture', 'papier'] },
  { t: 'Fusion géante dans l’agroalimentaire : 1 200 emplois menacés', rub: 'economie', k: ['ouverture', 'papier'] },
  { t: 'Le gazole recule pour la quatrième semaine', rub: 'economie', k: ['breve', 'papier'] },
  { t: 'Les PME étranglées par les retards de paiement', rub: 'economie', k: ['papier', 'enquete', 'breve'] },
  { t: 'La Bourse de Paris signe un record historique', rub: 'economie', k: ['breve', 'papier'] },
  { t: 'La jeune pousse nantaise Kelvo lève 300 millions', rub: 'economie', k: ['papier', 'breve', 'portrait'] },
  { t: 'Une usine de batteries s’installera près de Douai', rub: 'economie', k: ['papier', 'photo'] },
  { t: 'La SNCF supprimerait les billets à moins de 20 €', rub: 'economie', k: ['breve', 'papier'], src: 'reseaux', imp: 1.2 },
  { t: 'Sommet européen : accord arraché à l’aube sur l’énergie', rub: 'monde', k: ['manchette', 'ouverture', 'papier'] },
  { t: 'Séisme au large du Chili : l’alerte au tsunami est levée', rub: 'monde', k: ['ouverture', 'photo', 'breve'] },
  { t: 'Élections anticipées en Norvège : la coalition sortante battue', rub: 'monde', k: ['papier', 'breve'] },
  { t: 'Cessez-le-feu fragile dans le Caucase', rub: 'monde', k: ['ouverture', 'papier', 'breve'] },
  { t: 'Mer de Chine : nouvel incident entre garde-côtes', rub: 'monde', k: ['papier', 'breve'] },
  { t: 'L’ONU alerte sur la famine au Sahel', rub: 'monde', k: ['ouverture', 'photo', 'papier'] },
  { t: 'Un sous-marin russe aperçu au large de Brest', rub: 'monde', k: ['papier', 'breve'], src: 'anonyme', imp: 1.15 },
  { t: 'Le dernier film de Lina Baptiste triomphe à Venise', rub: 'culture', k: ['photo', 'papier', 'portrait'] },
  { t: 'Le Louvre ouvrira jusqu’à minuit le vendredi', rub: 'culture', k: ['breve', 'papier'] },
  { t: 'Mort du chanteur Gilles Arnoult, voix des années 80', rub: 'culture', k: ['portrait', 'papier', 'photo'] },
  { t: 'Bourges annonce un festival 100 % francophone', rub: 'culture', k: ['breve', 'papier'] },
  { t: 'Goncourt des lycéens : une primo-romancière de 23 ans', rub: 'culture', k: ['portrait', 'breve'] },
  { t: 'Rugby : le XV de France écrase l’Écosse', rub: 'sport', k: ['photo', 'ouverture', 'papier'] },
  { t: 'Ligue des champions : le club parisien sorti aux tirs au but', rub: 'sport', k: ['photo', 'papier', 'breve'] },
  { t: 'Tour de France : trois arrivées au sommet au programme', rub: 'sport', k: ['photo', 'papier', 'breve'] },
  { t: 'Une nageuse de 16 ans bat le record d’Europe du 200 m', rub: 'sport', k: ['portrait', 'breve', 'photo'] },
  { t: 'Le sélectionneur des Bleus sur le départ', rub: 'sport', k: ['breve', 'papier'], src: 'reseaux', imp: 1.2 },
  { t: 'Braquage éclair dans une bijouterie de la place Vendôme', rub: 'faitsdivers', k: ['photo', 'papier', 'breve'] },
  { t: 'Incendie d’entrepôt à Gennevilliers : 80 pompiers mobilisés', rub: 'faitsdivers', k: ['photo', 'breve'] },
  { t: 'Randonneur disparu dans les Pyrénées : les recherches reprennent', rub: 'faitsdivers', k: ['breve', 'papier'] },
  { t: 'Un loup aperçu aux portes de Lyon', rub: 'faitsdivers', k: ['breve', 'photo'], src: 'reseaux', imp: 1.2 },
  { t: 'Faux conseillers bancaires : un réseau démantelé', rub: 'faitsdivers', k: ['papier', 'breve'] },
  { t: 'Un trésor de pièces d’or sous un parking de Bordeaux', rub: 'faitsdivers', k: ['photo', 'breve'], src: 'reseaux', imp: 1.2 },
  { t: 'Maëlle Rive et Tom Sézane, c’est fini', rub: 'people', k: ['portrait', 'breve', 'photo'], src: 'reseaux', imp: 1.2 },
  { t: 'Mariage secret pour l’animateur Fabrice Lenoir', rub: 'people', k: ['portrait', 'breve'], src: 'anonyme' },
  { t: 'L’influenceuse Jade Calloway lance sa marque de cosmétiques', rub: 'people', k: ['breve', 'portrait'] },
  { t: 'Une sonde européenne se pose sur un astéroïde', rub: 'sciences', k: ['ouverture', 'photo', 'papier'] },
  { t: 'Alzheimer : un essai clinique français prometteur', rub: 'sciences', k: ['papier', 'breve'] },
  { t: 'Intelligence artificielle : des lycées testent un tuteur virtuel', rub: 'sciences', k: ['papier', 'breve'] },
  { t: 'L’été le plus chaud jamais mesuré en Europe', rub: 'sciences', k: ['ouverture', 'papier', 'photo'] },
  { t: 'Un vaccin contre la dengue autorisé en Europe', rub: 'sciences', k: ['breve', 'papier'] },
];

const ELEC: Seed[] = [
  { t: 'Estimation 20 h : l’Union des Territoires en tête avec 27 %', rub: 'elections', k: ['manchette', 'ouverture'], src: 'institut', imp: 1.2,
    fix: 'Chiffres consolidés : Union des Territoires et Renouveau Républicain à égalité' },
  { t: 'Paris : la Gauche Commune rafle la 3e circonscription', rub: 'elections', k: ['papier', 'breve'], src: 'institut',
    fix: 'Paris 3e : le recomptage donne l’Alliance Sociale et Écologique gagnante' },
  { t: 'Participation : 48 %, en recul de six points', rub: 'elections', k: ['papier', 'breve', 'photo'], src: 'institut',
    fix: 'Participation : 53 %, finalement en hausse' },
  { t: 'Lille : le maire sortant battu dès le premier tour', rub: 'elections', k: ['papier', 'breve'], src: 'institut',
    fix: 'Lille : le maire sortant sauve son siège de 112 voix' },
  { t: 'Le Mouvement Populaire franchit la barre des 20 %', rub: 'elections', k: ['ouverture', 'papier'], src: 'institut', imp: 1.1,
    fix: 'Le Mouvement Populaire plafonne à 17,8 %, selon les chiffres définitifs' },
  { t: 'Outre-mer : La Réunion bascule à gauche', rub: 'elections', k: ['papier', 'breve'], src: 'institut',
    fix: 'La Réunion : le centre conserve deux sièges sur trois' },
  { t: 'Marseille : triangulaire serrée, le Renouveau Républicain devant', rub: 'elections', k: ['papier', 'photo'], src: 'institut',
    fix: 'Marseille : l’Alliance Sociale et Écologique passe devant au décompte final' },
  { t: 'Trois ministres candidats en ballottage', rub: 'elections', k: ['papier', 'portrait', 'breve'], src: 'institut',
    fix: 'Ministres candidats : un seul finalement en ballottage' },
  { t: 'Soirée de liesse au QG de l’Union des Territoires', rub: 'elections', k: ['photo', 'papier'], src: 'correspondant' },
  { t: 'La carte des résultats, circonscription par circonscription', rub: 'elections', k: ['ouverture', 'enquete'], src: 'maison', imp: 1.1 },
  { t: 'Hélène Varenne (UT) : « Les Français ont choisi l’apaisement »', rub: 'elections', k: ['portrait', 'papier'] },
  { t: 'Marc Delorme (RR) appelle au rassemblement pour le second tour', rub: 'elections', k: ['papier', 'breve'] },
  { t: 'Samia Benali (GC) dénonce une « campagne volée »', rub: 'elections', k: ['papier', 'breve', 'portrait'] },
  { t: 'Abstention record chez les moins de 25 ans', rub: 'societe', k: ['papier', 'breve', 'photo'] },
  { t: 'Les marchés saluent une majorité stable', rub: 'economie', k: ['breve', 'papier'] },
  { t: 'Des urnes égarées à Perpignan ?', rub: 'elections', k: ['breve', 'papier'], src: 'reseaux', imp: 1.3 },
  { t: 'Procurations : soupçons de fraude à Nîmes', rub: 'elections', k: ['papier', 'breve'], src: 'anonyme', imp: 1.2 },
  { t: 'Portrait : Léa Fournel, 23 ans, plus jeune élue de l’Assemblée', rub: 'elections', k: ['portrait', 'papier'] },
  { t: 'Analyse : pourquoi les sondages s’étaient trompés', rub: 'elections', k: ['papier', 'enquete'], src: 'maison' },
  { t: 'Brest : un bureau de vote fermé deux heures par erreur', rub: 'faitsdivers', k: ['breve'] },
  { t: 'Ce que la nouvelle Assemblée changera pour vos impôts', rub: 'economie', k: ['ouverture', 'papier'] },
  { t: 'Le chef de l’Alliance Sociale et Écologique démissionnerait ce soir', rub: 'elections', k: ['breve', 'papier'], src: 'reseaux', imp: 1.3 },
];

const SCAN: Seed[] = [
  { t: 'Bertrand Vasseur : « Je n’ai rien à me reprocher »', rub: 'affaire', k: ['papier', 'portrait', 'breve'], src: 'officiel' },
  { t: 'L’opposition exige une commission d’enquête', rub: 'politique', k: ['papier', 'breve'] },
  { t: 'Perquisition au siège du groupe Ardéval à Nanterre', rub: 'affaire', k: ['ouverture', 'photo', 'papier'], imp: 1.1 },
  { t: 'Le parquet financier ouvre une enquête préliminaire', rub: 'affaire', k: ['papier', 'breve'] },
  { t: 'Un ancien cadre d’Ardéval : « On payait pour chaque marché »', rub: 'affaire', k: ['enquete', 'papier'], src: 'anonyme', accuse: true, imp: 1.2 },
  { t: 'Le compte caché du ministre aux îles Caïmans', rub: 'affaire', k: ['papier', 'breve'], src: 'reseaux', accuse: true, imp: 1.3 },
  { t: 'Le Premier ministre maintient sa confiance au ministre', rub: 'politique', k: ['papier', 'breve'] },
  { t: 'Qui est Bertrand Vasseur, l’ambitieux ministre de l’Équipement ?', rub: 'affaire', k: ['portrait', 'papier'], src: 'maison' },
  { t: 'Marchés publics : les garde-fous qui n’ont pas fonctionné', rub: 'economie', k: ['papier', 'enquete'], src: 'maison' },
  { t: 'Chez Ardéval, les salariés inquiets pour leurs emplois', rub: 'societe', k: ['papier', 'photo'], src: 'correspondant' },
  { t: 'Sondage : 64 % des Français réclament la démission du ministre', rub: 'affaire', k: ['breve', 'papier'] },
  { t: 'La compagne du ministre aurait acheté un yacht à Saint-Tropez', rub: 'people', k: ['breve', 'portrait'], src: 'reseaux', accuse: true, imp: 1.3 },
  { t: 'Le chauffeur du ministre prêt à témoigner', rub: 'affaire', k: ['breve', 'papier'], src: 'anonyme', accuse: true, imp: 1.2 },
  { t: 'Ardéval suspend son PDG, Raymond Ferrière', rub: 'economie', k: ['breve', 'portrait'] },
];

/** L'affaire : versions concurrentes (une seule est vraie) */
const SCAN_PAIRS: [Seed, Seed][] = [
  [{ t: 'Le ministre aurait touché 300 000 € du groupe Ardéval', rub: 'affaire', k: ['ouverture', 'papier'], src: 'document', accuse: true, imp: 1.3 },
    { t: 'Les 300 000 € étaient la vente d’une maison, selon les actes notariés', rub: 'affaire', k: ['papier', 'breve'], src: 'document' }],
  [{ t: 'Un SMS du ministre : « Faites passer Ardéval en priorité »', rub: 'affaire', k: ['papier', 'breve'], src: 'document', accuse: true, imp: 1.3 },
    { t: 'Le SMS attribué au ministre serait un montage, selon des experts', rub: 'affaire', k: ['papier', 'breve'], src: 'anonyme' }],
  [{ t: 'La directrice de cabinet, Inès Corbière, aurait détruit des archives', rub: 'affaire', k: ['papier', 'portrait'], src: 'anonyme', accuse: true, imp: 1.2 },
    { t: 'Inès Corbière était en congé la semaine des faits, selon son entourage', rub: 'affaire', k: ['breve', 'papier'], src: 'anonyme' }],
];

const SCOOPS: Record<Variant, Seed[]> = {
  quotidien: [
    { t: 'EXCLUSIF — La Première ministre prépare un référendum sur les institutions', rub: 'politique', k: ['manchette', 'ouverture'], src: 'maison', imp: 1.9 },
    { t: 'EXCLUSIF — Le TGV Bordeaux-Toulouse discrètement abandonné', rub: 'economie', k: ['manchette', 'ouverture'], src: 'maison', imp: 1.9 },
    { t: 'EXCLUSIF — Accord secret pour libérer les otages du Sahel', rub: 'monde', k: ['manchette', 'ouverture'], src: 'maison', imp: 1.9 },
  ],
  electoral: [
    { t: 'RÉSULTATS DÉFINITIFS — L’Union des Territoires obtient la majorité relative', rub: 'elections', k: ['manchette', 'ouverture'], src: 'officiel', imp: 1.9 },
    { t: 'COUP DE THÉÂTRE — Le Premier ministre battu dans sa circonscription', rub: 'elections', k: ['manchette', 'ouverture'], src: 'officiel', imp: 1.9 },
  ],
  scandale: [
    { t: 'EXCLUSIF — Le carnet de comptes secret d’Ardéval', rub: 'affaire', k: ['manchette', 'ouverture'], src: 'document', accuse: true, imp: 1.9 },
    { t: 'EXCLUSIF — Les enregistrements qui accablent le cabinet Vasseur', rub: 'affaire', k: ['manchette', 'ouverture'], src: 'document', accuse: true, imp: 1.9 },
  ],
};

const EDITOS: Record<Variant, string[]> = {
  quotidien: ['Éditorial — Le courage de dire non', 'Éditorial — Une France qui doute', 'Éditorial — L’État doit tenir parole'],
  electoral: ['Éditorial — Un pays à réconcilier', 'Éditorial — Le message des abstentionnistes'],
  scandale: ['Éditorial — La République exemplaire, vraiment ?', 'Éditorial — La présomption d’innocence n’est pas l’impunité'],
};

const ADVERTISERS = ['Voyages Azuréa', 'Optique Clairvue', 'Lessive Blancor', 'Banque Hermine', 'Autos Rhodanie', 'Matelas Dormitout', 'Fromagerie Vaujour', 'Assurances Pélican'];
const AD_SHAPES: [number, number][] = [[2, 2], [3, 2], [6, 1], [2, 2]];

/* ── La rédaction (l'état du jeu) ── */

export interface PageDef { name: string; short: string; w: number; h: number }

export interface Story {
  id: number; kind: Kind; title: string; rub: Rub; src: Src;
  w: number; h: number; rot: boolean;
  /** Intérêt pour les quatre lectorats (après coupes) */
  int: number[];
  truth: boolean; checked: boolean;
  born: number; exp: number; cuts: number;
  scoop?: boolean; ad?: string; filler?: boolean; unlimited?: boolean; edito?: boolean;
  accuse?: boolean; pair?: number;
  /** Estimation : sera corrigée (inconnu tant qu'on n'a pas vérifié) */
  fragile?: boolean;
  /** Rectificatif : remplace l'estimation n° fixOf déjà imprimée */
  fixOf?: number;
  stale?: boolean;
}

export interface Placed { s: Story; page: number; x: number; y: number; base: number[] }

interface Fix { orig: number; at: number; text: string; done: boolean }
export interface Ev { text: string; tone: 'good' | 'bad' | 'info'; sid?: number }

export interface Desk {
  v: Variant; diff: number; t: number; deadline: number; mult: number;
  pages: PageDef[]; placed: Placed[]; fil: Story[]; queue: Story[]; fixes: Fix[];
  line: LineId; adsReq: number; target: number; seq: number;
  spiked: number; expired: number; checks: number; caught: number;
  over: boolean; events: Ev[];
}

export const COST = { place: 5, remove: 5, cut: 5, verify: 15 };
export const LIFE = 75;
export const QUARTER = 15;
const UNE_W = [2, 2, 1.6, 1.6, 1.35, 1.35, 1.15, 1.15];
const IN_W = [1, 1, 0.9, 0.9, 0.8, 0.8, 0.75, 0.75];
const TARGET_K = 1.12;
/** Équilibre : part minimale du lectorat le plus délaissé (l'élection penche forcément vers la politique) */
const BAL_FLOOR: Record<Variant, number> = { quotidien: 0.4, electoral: 0.22, scandale: 0.3 };

export function mulberry(seed: number): Rnd {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const sum = (a: number[]) => a.reduce((t, x) => t + x, 0);
const pickOne = <T,>(a: T[], r: Rnd): T => a[Math.floor(r() * a.length)];

export const rowW = (page: number, y: number): number => (page === 0 ? UNE_W[y] : IN_W[y]) ?? 0.75;
export function weightOf(page: number, y: number, h: number): number {
  let t = 0;
  for (let k = 0; k < h; k++) t += rowW(page, y + k);
  return t / h;
}
export const fresh = (s: Story, t: number): number => (s.ad || s.filler || s.edito || s.fixOf !== undefined ? 1 : Math.max(0.6, 1 - 0.005 * Math.max(0, t - s.born)));
export const isDubious = (s: Story): boolean => SRC[s.src].trust < 1 || s.pair !== undefined;
export const costOf = (d: Desk, base: number): number => Math.max(1, Math.round(base * d.mult));
export const totalCells = (d: Desk): number => sum(d.pages.map(p => p.w * p.h));

export function cloneDesk(d: Desk): Desk {
  const cs = (s: Story): Story => ({ ...s, int: [...s.int] });
  return {
    ...d, pages: d.pages, placed: d.placed.map(p => ({ ...p, s: cs(p.s), base: [...p.base] })), fil: d.fil.map(cs), queue: d.queue.map(cs),
    fixes: d.fixes.map(f => ({ ...f })), events: [],
  };
}

/* ── Génération de la soirée ── */

function mkStory(d: Desk, seed: Seed, born: number, r: Rnd, pDown: number, kind?: Kind): Story {
  const k = kind ?? pickOne(seed.k, r);
  const K = KINDS[k];
  let src: Src = seed.src ?? 'agence';
  if (src === 'agence' && r() < pDown) src = r() < 0.5 ? 'anonyme' : 'reseaux';
  const dub = SRC[src].trust < 1;
  const imp = (seed.imp ?? 1) * (0.85 + r() * 0.35) * (dub && !seed.imp ? 1.2 : 1);
  const prof = PROFILE[seed.rub];
  const tot = sum(prof);
  const flip = K.rot && r() < 0.35;
  return {
    id: ++d.seq, kind: k, title: seed.t, rub: seed.rub, src, w: flip ? K.h : K.w, h: flip ? K.w : K.h, rot: K.rot,
    int: prof.map(p => r1((K.pts * imp * p) / tot)), truth: r() < SRC[src].trust, checked: src === 'maison', born, exp: born + LIFE, cuts: 0,
    ...(seed.accuse ? { accuse: true } : {}),
  };
}

export function newDesk(v: Variant, diff: number, r: Rnd): Desk {
  const dd = clamp(diff, 0.6, 1.6);
  const pages: PageDef[] = v === 'electoral'
    ? [{ name: 'La Une', short: 'Une', w: 6, h: 8 }, { name: 'Page 2 · Résultats', short: 'P. 2', w: 6, h: 6 }, { name: 'Page 3 · Réactions', short: 'P. 3', w: 6, h: 6 }]
    : v === 'scandale'
      ? [{ name: 'La Une', short: 'Une', w: 6, h: 8 }, { name: 'Page 2 · L’affaire', short: 'P. 2', w: 6, h: 6 }, { name: 'Page 3 · Actualités', short: 'P. 3', w: 6, h: 6 }]
      : [{ name: 'La Une', short: 'Une', w: 6, h: 8 }, { name: 'Page 2 · France', short: 'P. 2', w: 6, h: 6 }, { name: 'Page 3 · Monde & Éco', short: 'P. 3', w: 6, h: 6 }];
  const lines: LineId[] = v === 'electoral' ? ['elec_haut'] : v === 'scandale' ? ['affaire_manchette'] : ['fd_une', 'people', 'sport_une', 'monde_une', 'eco_une'];
  const d: Desk = {
    v, diff: dd, t: 0, deadline: 210, mult: 1 + 0.8 * (dd - 1), pages, placed: [], fil: [], queue: [], fixes: [],
    line: pickOne(lines, r), adsReq: dd >= 1.15 ? 4 : 3, target: 0, seq: 0, spiked: 0, expired: 0, checks: 0, caught: 0, over: false, events: [],
  };
  const pDown = clamp(0.05 + 0.3 * (dd - 1), 0, 0.25);
  const all: Story[] = [];

  // La maison : l'éditorial, les publicités, les bouche-trous
  all.push({ ...mkStory(d, { t: pickOne(EDITOS[v], r), rub: 'politique', k: ['edito'], src: 'maison' }, 0, r, 0), edito: true, exp: 1e9 });
  const ads = [...ADVERTISERS].sort(() => r() - 0.5);
  for (let i = 0; i < d.adsReq; i++) {
    const [w, h] = AD_SHAPES[i % AD_SHAPES.length];
    all.push({ id: ++d.seq, kind: 'pub', title: ads[i], rub: 'maison', src: 'maison', w, h, rot: w !== h && w < 6, int: [0, 0, 0, 0], truth: true, checked: true, born: 0, exp: 1e9, cuts: 0, ad: ads[i] });
  }
  const filler = (kind: Kind, title: string, unlimited = false): Story => {
    const K = KINDS[kind];
    const prof = PROFILE.maison;
    return { id: ++d.seq, kind, title, rub: 'maison', src: 'maison', w: K.w, h: K.h, rot: K.rot, int: prof.map(p => r1((K.pts * p) / sum(prof))), truth: true, checked: true, born: 0, exp: 1e9, cuts: 0, filler: true, ...(unlimited ? { unlimited: true } : {}) };
  };
  all.push(filler('meteo', 'La météo de demain'), filler('jeux', 'Mots fléchés'), filler('filet', 'Encadré maison', true));

  // Le planning des dépêches : un lot à 20 h, puis 1 à 3 par quart d'heure
  const bank = v === 'quotidien' ? [...GEN] : v === 'electoral' ? [...ELEC] : [...SCAN];
  const gen = [...GEN];
  const draw = (): Seed => {
    const own = v !== 'quotidien' && bank.length && (r() < (v === 'electoral' ? 0.68 : 0.55) || !gen.length);
    const pool = own ? bank : gen;
    return pool.splice(Math.floor(r() * pool.length), 1)[0];
  };
  const slots: number[] = [0, 0, 0, 0, 0, 0];
  for (let q = 1; q <= 13; q++) {
    const n = q >= 12 ? 1 : 1 + (r() < 0.75 ? 1 : 0) + (r() < 0.25 ? 1 : 0);
    for (let k = 0; k < n; k++) slots.push(q * QUARTER);
  }
  // L'affaire : les versions concurrentes arrivent à quelques quarts d'heure d'écart
  const pairSlots = new Set<number>();
  if (v === 'scandale') {
    SCAN_PAIRS.forEach(([a, b], k) => {
      const ta = (1 + k * 3 + Math.floor(r() * 2)) * QUARTER;
      const tb = ta + (1 + Math.floor(r() * 3)) * QUARTER;
      const truthA = r() < 0.55;
      const sa = mkStory(d, a, ta, r, 0), sb = mkStory(d, b, tb, r, 0);
      sa.pair = sb.pair = k + 1;
      sa.truth = truthA; sb.truth = !truthA;
      all.push(sa, sb);
      pairSlots.add(ta); pairSlots.add(tb);
    });
  }
  let dropped = 0;
  for (const t of slots) {
    // Les paires prennent la place d'une dépêche ordinaire
    if (pairSlots.has(t) && dropped < 6 && t > 0) { pairSlots.delete(t); dropped++; continue; }
    const seed = draw();
    if (!seed) continue;
    const s = mkStory(d, seed, t, r, pDown);
    if (seed.fix) {
      s.fragile = r() < clamp(0.42 + 0.2 * (dd - 1), 0.25, 0.6);
      if (s.fragile) d.fixes.push({ orig: s.id, at: t + (3 + Math.floor(r() * 3)) * QUARTER, text: seed.fix, done: false });
    }
    all.push(s);
  }
  // Le scoop tardif
  const scoopAt = v === 'scandale' ? 135 : 150;
  const sc = mkStory(d, pickOne(SCOOPS[v], r), scoopAt, r, 0, 'manchette');
  sc.scoop = true;
  sc.exp = 1e9;
  if (v === 'scandale') sc.truth = r() < 0.72;
  all.push(sc);

  all.sort((a, b) => a.born - b.born);
  d.queue = all;
  d.target = TARGET_K * sum(d.pages.map((p, i) => sum(Array.from({ length: p.h }, (_, y) => rowW(i, y) * p.w))));
  advance(d, 0);
  d.events = [];
  return d;
}

/* ── Le temps qui passe ── */

export function advance(d: Desk, min: number): void {
  const t1 = Math.min(d.deadline, d.t + min);
  d.t = t1;
  // Arrivées
  let n = 0;
  while (d.queue.length && d.queue[0].born <= t1) {
    const s = d.queue.shift()!;
    d.fil.push(s);
    n++;
    if (s.scoop) d.events.push({ text: `⭐ SCOOP : « ${s.title.replace(/^[A-ZÉÈÊÀ \-—]+ — /, '')} » — il lui faut le haut de la Une.`, tone: 'info', sid: s.id });
  }
  if (n && t1 > 0) d.events.push({ text: `📠 ${n} dépêche${n > 1 ? 's' : ''} sur le fil.`, tone: 'info' });
  // Rectificatifs des estimations
  for (const f of d.fixes) {
    if (f.done || f.at > t1) continue;
    f.done = true;
    const pl = d.placed.find(p => p.s.id === f.orig);
    const inFil = d.fil.find(s => s.id === f.orig);
    const orig = pl?.s ?? inFil;
    const K = orig ? { w: orig.w, h: orig.h, int: orig.int, kind: orig.kind } : { w: 2, h: 1, int: [1.2, 0.5, 0.3, 0.3], kind: 'breve' as Kind };
    const fix: Story = {
      id: ++d.seq, kind: K.kind, title: f.text, rub: 'elections', src: 'officiel', w: K.w, h: K.h, rot: KINDS[K.kind].rot, int: K.int.map(x => r1(x * 1.1)),
      truth: true, checked: true, born: f.at, exp: f.at + LIFE, cuts: 0,
    };
    if (pl) {
      pl.s.stale = true;
      fix.fixOf = pl.s.id;
      fix.exp = 1e9;
      d.events.push({ text: `🔁 Rectificatif : « ${pl.s.title} » est dépassé — remplacez-le avant le bouclage !`, tone: 'bad', sid: pl.s.id });
    } else if (inFil) {
      d.fil = d.fil.filter(s => s.id !== inFil.id);
      d.events.push({ text: '🔁 Une estimation du fil est corrigée : le rectificatif la remplace.', tone: 'info' });
    }
    d.fil.push(fix);
  }
  // Les dépêches trop vieilles quittent le fil
  const old = d.fil.filter(s => s.exp < 1e8 && t1 > s.exp);
  if (old.length) {
    d.fil = d.fil.filter(s => !old.includes(s));
    d.expired += old.length;
    d.events.push({ text: `🗑️ ${old.length} dépêche${old.length > 1 ? 's' : ''} périmée${old.length > 1 ? 's' : ''} : déjà partout ailleurs.`, tone: 'info' });
  }
  if (d.t >= d.deadline) d.over = true;
}

function spend(d: Desk, base: number): void { advance(d, costOf(d, base)); }

export function nextQuarter(d: Desk): number { return Math.min(d.deadline, (Math.floor(d.t / QUARTER) + 1) * QUARTER); }

export function waitTick(d: Desk): void {
  if (d.over) return;
  advance(d, nextQuarter(d) - d.t);
}

/* ── La mise en page ── */

export function occ(d: Desk, page: number, ignore?: number): (number | null)[] {
  const P = d.pages[page];
  const g: (number | null)[] = Array(P.w * P.h).fill(null);
  for (const p of d.placed) {
    if (p.page !== page || p.s.id === ignore) continue;
    for (let y = p.y; y < p.y + p.s.h; y++) for (let x = p.x; x < p.x + p.s.w; x++) g[y * P.w + x] = p.s.id;
  }
  return g;
}

export const findStory = (d: Desk, id: number): Story | undefined => d.fil.find(s => s.id === id) ?? d.placed.find(p => p.s.id === id)?.s;
export const timeLeft = (d: Desk): number => d.deadline - d.t;
export const canAfford = (d: Desk, base: number): boolean => !d.over && costOf(d, base) <= timeLeft(d);

export function canPlace(d: Desk, s: Story, page: number, x: number, y: number, g?: (number | null)[]): string | null {
  const P = d.pages[page];
  if (x < 0 || y < 0 || x + s.w > P.w || y + s.h > P.h) return 'Dépasse de la page';
  if (s.checked && !s.truth) return 'Info bidonnée : au panier !';
  if (s.ad && page === 0 && y < P.h - 2) return 'Pas de publicité au-dessus des deux dernières lignes de la Une';
  if (s.fixOf !== undefined) return 'Ce rectificatif remplace l’estimation déjà en page';
  const o = g ?? occ(d, page);
  for (let yy = y; yy < y + s.h; yy++) for (let xx = x; xx < x + s.w; xx++) if (o[yy * P.w + xx] !== null) return 'Emplacement occupé';
  if (!canAfford(d, COST.place)) return 'Plus le temps';
  return null;
}

/** Ce que rapporterait la dépêche à cet endroit (lecteurs par lectorat) */
export function valueAt(d: Desk, s: Story, page: number, y: number): number[] {
  const w = weightOf(page, y, s.h);
  const f = fresh(s, d.t);
  return s.int.map(v => v * f * w);
}

export function placeStory(d: Desk, sid: number, page: number, x: number, y: number): string | null {
  const s = d.fil.find(z => z.id === sid);
  if (!s) return 'Dépêche introuvable';
  const err = canPlace(d, s, page, x, y);
  if (err) return err;
  const base = s.int.map(v => v * fresh(s, d.t));
  let story = s;
  if (s.unlimited) story = { ...s, int: [...s.int], id: ++d.seq, unlimited: false };
  else d.fil = d.fil.filter(z => z.id !== sid);
  d.placed.push({ s: story, page, x, y, base });
  spend(d, COST.place);
  return null;
}

export function removePlaced(d: Desk, sid: number): string | null {
  const p = d.placed.find(z => z.s.id === sid);
  if (!p) return 'Rien à retirer';
  if (!canAfford(d, COST.remove)) return 'Plus le temps';
  d.placed = d.placed.filter(z => z !== p);
  if (!p.s.filler || !d.fil.some(z => z.unlimited && z.kind === p.s.kind)) {
    p.s.exp = Math.max(p.s.exp, d.t + 30);
    if (!(p.s.filler && p.s.kind === 'filet')) d.fil.push(p.s);
  }
  spend(d, COST.remove);
  return null;
}

export function rotateStory(d: Desk, sid: number): string | null {
  const s = d.fil.find(z => z.id === sid);
  if (!s || !s.rot || s.w === s.h) return 'Ce format ne pivote pas';
  [s.w, s.h] = [s.h, s.w];
  return null;
}

export function cutStory(d: Desk, sid: number): string | null {
  const s = d.fil.find(z => z.id === sid);
  if (!s) return 'Dépêche introuvable';
  if (s.ad || s.filler || s.fixOf !== undefined) return 'On ne coupe pas ce bloc';
  if (s.w * s.h <= 1) return 'Impossible de couper davantage';
  if (!canAfford(d, COST.cut)) return 'Plus le temps';
  const a0 = s.w * s.h;
  if (s.h > 1) s.h--; else s.w--;
  const k = Math.pow((s.w * s.h) / a0, 0.8);
  s.int = s.int.map(v => r1(v * k));
  s.cuts++;
  spend(d, COST.cut);
  return null;
}

export function verifyStory(d: Desk, sid: number): string | null {
  const s = findStory(d, sid);
  if (!s) return 'Dépêche introuvable';
  if (s.checked) return 'Déjà vérifiée';
  if (!canAfford(d, COST.verify)) return 'Plus le temps';
  s.checked = true;
  d.checks++;
  if (s.pair !== undefined) {
    for (const o of [...d.fil, ...d.queue, ...d.placed.map(p => p.s)]) if (o.pair === s.pair) o.checked = true;
  }
  spend(d, COST.verify);
  if (s.src === 'institut') {
    d.events.push(s.fragile
      ? { text: `⚠️ « ${s.title} » : fourchette trop serrée, ces chiffres seront corrigés dans la soirée.`, tone: 'bad', sid }
      : { text: `✓ « ${s.title} » : chiffres solides, l’institut confirme.`, tone: 'good', sid });
  } else if (!s.truth) {
    d.caught++;
    d.events.push({ text: `✗ Bidonnée : « ${s.title} » ne tient pas.${s.pair !== undefined ? ' L’autre version, elle, est confirmée.' : ''}`, tone: 'good', sid });
  } else {
    d.events.push({ text: `✓ Vérifiée : « ${s.title} » tient.${s.pair !== undefined ? ' La version adverse est donc fausse.' : ''}`, tone: 'good', sid });
  }
  return null;
}

export function spikeStory(d: Desk, sid: number): string | null {
  const s = d.fil.find(z => z.id === sid);
  if (!s) return 'Dépêche introuvable';
  if (s.ad) return 'L’annonceur a payé : la pub doit passer';
  if (s.unlimited || s.edito) return 'On garde ce bloc';
  d.fil = d.fil.filter(z => z.id !== sid);
  d.spiked++;
  return null;
}

/** Remplacer une estimation dépassée par son rectificatif, au même endroit */
export function swapFix(d: Desk, fixId: number): string | null {
  const f = d.fil.find(z => z.id === fixId);
  if (!f || f.fixOf === undefined) return 'Pas un rectificatif';
  const p = d.placed.find(z => z.s.id === f.fixOf);
  if (!p) return 'L’estimation n’est plus en page';
  if (!canAfford(d, COST.place)) return 'Plus le temps';
  d.fil = d.fil.filter(z => z.id !== fixId);
  const s: Story = { ...f, w: p.s.w, h: p.s.h, fixOf: undefined, exp: 1e9 };
  p.s = s;
  p.base = s.int.map(v => v);
  spend(d, COST.place);
  return null;
}

/* ── La ligne du rédacteur en chef ── */

export function lineConflict(line: LineId, s: Story, page: number, y: number): boolean {
  if (s.ad || s.filler) return false;
  switch (line) {
    case 'fd_une': return page === 0 && s.rub === 'faitsdivers';
    case 'people': return s.rub === 'people';
    case 'sport_une': return page === 0 && s.rub === 'sport';
    case 'elec_haut': return page === 0 && y < 4 && s.rub !== 'elections' && !s.edito;
    default: return false;
  }
}

export function lineUnmet(d: Desk): string | null {
  const une = d.placed.filter(p => p.page === 0);
  if (d.line === 'monde_une' && !une.some(p => p.s.rub === 'monde')) return 'Aucun sujet Monde en Une';
  if (d.line === 'eco_une' && !une.some(p => p.s.rub === 'economie')) return 'Aucun sujet Économie en Une';
  if (d.line === 'affaire_manchette' && !une.some(p => p.y === 0 && p.s.rub === 'affaire' && p.s.w * p.s.h >= 6)) return 'L’affaire n’est pas en tête de Une';
  return null;
}

/* ── Le bilan ── */

export interface Score {
  score: number; aud: number; audC: number; reach: number[]; balC: number; filled: number; total: number; empty: number; fillC: number;
  ads: number; adsC: number; conflicts: number; unmet: string | null; edito: boolean; lineC: number;
  dementis: Placed[]; proces: Placed[]; pagesFull: number; headline: Placed | null; pen: number;
}

export function scoreDesk(d: Desk): Score {
  const reach = [0, 0, 0, 0];
  let filled = 0, ads = 0, conflicts = 0;
  const dementis: Placed[] = [], proces: Placed[] = [];
  for (const p of d.placed) {
    filled += p.s.w * p.s.h;
    if (p.s.ad) { ads++; continue; }
    if (lineConflict(d.line, p.s, p.page, p.y)) conflicts++;
    // Une fausse info ne rapporte rien : le démenti efface tout
    if (!p.s.truth || p.s.stale) { dementis.push(p); continue; }
    const w = weightOf(p.page, p.y, p.s.h);
    p.base.forEach((v, i) => { reach[i] += v * w; });
    if (p.s.accuse && !p.s.checked) proces.push(p);
  }
  const aud = sum(reach);
  const audC = clamp(aud / d.target);
  const mean = aud / 4;
  const floor = BAL_FLOOR[d.v];
  const balC = mean ? clamp((Math.min(...reach) / mean - floor) / (0.85 - floor)) : 0;
  const total = totalCells(d);
  const empty = total - filled;
  const fillC = clamp(1 - 2.5 * (empty / total));
  const adsC = clamp(ads / d.adsReq);
  const unmet = lineUnmet(d);
  const edito = d.placed.some(p => p.s.edito);
  const lineC = clamp(1 - 0.3 * conflicts - (unmet ? 0.35 : 0) - (edito ? 0 : 0.3));
  const pen = 0.15 * dementis.length + 0.07 * proces.length;
  const score = clamp(0.44 * audC + 0.1 * balC + 0.18 * fillC + 0.12 * adsC + 0.16 * lineC - pen);
  const pagesFull = d.pages.filter((_, i) => occ(d, i).every(c => c !== null)).length;
  const top = d.placed.filter(p => p.page === 0 && p.y === 0 && !p.s.ad && !p.s.filler)
    .sort((a, b) => b.s.w * b.s.h - a.s.w * a.s.h || sum(b.base) - sum(a.base));
  return { score, aud, audC, reach, balC, filled, total, empty, fillC, ads, adsC, conflicts, unmet, edito, lineC, dementis, proces, pagesFull, headline: top[0] ?? null, pen };
}

/* ============================================================
 *  Le composant
 * ============================================================ */

interface Fx { sid: number; text: string; tone: 'good' | 'bad' | 'info'; id: number }
interface Ghost { page: number; x: number; y: number; w: number; h: number; err: string | null; val: number; weight: number; warn: string[] }
type Sel = { id: number; where: 'fil' | 'page' } | null;

const BRIEF: Record<Variant, { title: string; brief: string }> = {
  quotidien: { title: 'Le bouclage', brief: 'Remplissez la Une et deux pages avant 23 h 30. Le haut de Une compte double ; une fausse info imprimée, c’est un démenti demain.' },
  electoral: { title: 'Soirée électorale', brief: 'Les estimations tombent… et certaines seront corrigées. Une estimation dépassée encore en page à 23 h 30, c’est un démenti.' },
  scandale: { title: 'L’affaire Vasseur', brief: 'Documents, rumeurs, démentis : toute accusation imprimée sans vérification expose le journal à un procès en diffamation.' },
};

const hhmm = (t: number): string => { const m = 20 * 60 + Math.round(t); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const dur = (m: number): string => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`);
const fmt = (n: number): string => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
/** Retire les pictogrammes (émojis) : l'interface dessine les siens */
const plain = (s: string) => s.replace(/\p{Extended_Pictographic}️?\s?/gu, '').trim();
/** Les lectorats, en pictogrammes au trait (repère 24 × 24) */
const READER_IC = [
  'M3 20.5h18M4.5 18h15M6 18v-7.5M10 18v-7.5M14 18v-7.5M18 18v-7.5M3.5 10h17L12 4.5z',
  'M8.5 4.5a3 3 0 1 1 0 6a3 3 0 0 1 0-6zM3 20c0-3.5 2.5-6.5 5.5-6.5s5.5 3 5.5 6.5M16 6a2.6 2.6 0 1 1 0 5.2M15.5 13.6c3 .3 5.5 3 5.5 6.4',
  'M4 15v-3a8 8 0 0 1 16 0v3M4 14.5h3.2v6H4zM16.8 14.5H20v6h-3.2z',
  'M3.5 20.5h17M4.5 16.5l5-5.5 4 3.5 6.5-7.5M15.5 7h5v5',
];
const SRC_SHORT: Record<Src, string> = { maison: 'RÉDACTION', agence: 'AGENCE', officiel: 'COMMUNIQUÉ', correspondant: 'CORRESP.', institut: 'INSTITUT', anonyme: 'SOURCE ANON.', document: 'DOCUMENT', reseaux: 'RÉSEAUX' };
/** Une photo de presse en niveaux de gris, selon la rubrique */
const SCENE: Record<Rub, string> = {
  politique: 'crowd', elections: 'crowd', affaire: 'crowd', societe: 'crowd', culture: 'stage', sport: 'stadium', economie: 'city', monde: 'city',
  sciences: 'land', faitsdivers: 'land', maison: 'land', people: 'face',
};
let fxId = 0;
let uneInstances = 0;

@Component({
  selector: 'app-une-game',
  template: `
    @let d = desk();
    <svg class="defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <pattern [attr.id]="uid + '-ht'" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0h3.2v3.2H0zM1.6.25a1.35 1.35 0 1 0 .01 0z" fill-rule="evenodd" class="screen" />
        </pattern>
        <linearGradient [attr.id]="uid + '-sky'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9d9d9" /><stop offset="1" stop-color="#9a9a9a" /></linearGradient>
        <radialGradient [attr.id]="uid + '-spot'" cx="50%" cy="20%" r="70%"><stop offset="0" stop-color="#e6e6e6" /><stop offset="1" stop-color="#3a3a3a" /></radialGradient>
        <symbol [attr.id]="uid + '-crowd'" viewBox="0 0 120 80" preserveAspectRatio="xMidYMin slice">
          <rect width="120" height="80" fill="#8c8c8c" /><rect width="120" height="46" [attr.fill]="'url(#' + uid + '-sky)'" />
          <rect x="22" y="6" width="9" height="34" fill="#5c5c5c" /><rect x="31" y="6" width="9" height="34" fill="#d0d0d0" /><rect x="40" y="6" width="9" height="34" fill="#7a7a7a" />
          <rect x="74" y="8" width="26" height="16" fill="#b5b5b5" /><path d="M77 11h20M77 15h14M77 19h17" stroke="#7d7d7d" stroke-width="1.6" />
          <ellipse cx="62" cy="22" rx="6.2" ry="7.4" fill="#c4c4c4" /><path d="M55 20c0-7 14-7 14 0" fill="#3a3a3a" />
          <path d="M47 44c2-10 8-13 15-13s13 3 15 13z" fill="#2f2f2f" /><path d="M59 31l3 6 3-6z" fill="#e8e8e8" />
          <path d="M50 38h24l-3 26H53z" fill="#4a4a4a" /><rect x="58" y="34" width="8" height="3" fill="#1c1c1c" />
          <g fill="#1f1f1f"><circle cx="8" cy="66" r="7" /><circle cx="24" cy="63" r="8" /><circle cx="41" cy="67" r="7.5" /><circle cx="58" cy="70" r="8" /><circle cx="76" cy="66" r="7" /><circle cx="93" cy="64" r="8" /><circle cx="111" cy="67" r="7.5" />
            <rect x="-2" y="70" width="124" height="12" /></g>
          <g fill="#3b3b3b"><circle cx="16" cy="58" r="5" /><circle cx="33" cy="57" r="5.5" /><circle cx="86" cy="57" r="5" /><circle cx="103" cy="58" r="5.5" /></g>
        </symbol>
        <symbol [attr.id]="uid + '-stage'" viewBox="0 0 120 80" preserveAspectRatio="xMidYMin slice">
          <rect width="120" height="80" [attr.fill]="'url(#' + uid + '-spot)'" /><path d="M42 0h36l18 62H24z" fill="#ffffff" opacity=".18" />
          <ellipse cx="60" cy="24" rx="6" ry="7" fill="#bdbdbd" /><path d="M53 22c0-8 14-8 14 0l-1 4c-2-5-10-5-12 0z" fill="#2a2a2a" />
          <path d="M48 62c0-18 5-28 12-28s12 10 12 28z" fill="#2e2e2e" /><path d="M66 40l12-8" stroke="#2e2e2e" stroke-width="4" stroke-linecap="round" /><circle cx="79" cy="31" r="2.4" fill="#111" />
          <rect y="62" width="120" height="18" fill="#4b4b4b" /><g fill="#141414"><circle cx="12" cy="78" r="8" /><circle cx="34" cy="80" r="9" /><circle cx="86" cy="80" r="9" /><circle cx="108" cy="78" r="8" /></g>
        </symbol>
        <symbol [attr.id]="uid + '-stadium'" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice">
          <rect width="120" height="34" fill="#3d3d3d" /><g fill="#8a8a8a">@for (q of dots; track $index) { <circle [attr.cx]="q[0]" [attr.cy]="q[1]" r=".9" /> }</g>
          <rect y="30" width="120" height="6" fill="#262626" /><rect y="36" width="120" height="44" fill="#a8a8a8" /><path d="M0 50h120M60 36v44" stroke="#d6d6d6" stroke-width="1" />
          <ellipse cx="66" cy="74" rx="16" ry="3" fill="#7c7c7c" />
          <circle cx="62" cy="34" r="5" fill="#cfcfcf" /><path d="M55 40c4-2 10-2 14 1l3 14-6 1-1 15h-5l-1-14-6 12-5-2 6-15z" fill="#1d1d1d" /><path d="M69 42l9-6M55 44l-8 5" stroke="#1d1d1d" stroke-width="3.4" stroke-linecap="round" />
          <ellipse cx="82" cy="66" rx="5" ry="4.6" fill="#f2f2f2" stroke="#2a2a2a" stroke-width="1" />
        </symbol>
        <symbol [attr.id]="uid + '-city'" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice">
          <rect width="120" height="80" [attr.fill]="'url(#' + uid + '-sky)'" />
          <path d="M84 30c0-6 5-10 10-10s7-5 12-4 6 7 4 10" fill="#bcbcbc" />
          <g fill="#4a4a4a"><rect x="4" y="34" width="14" height="46" /><rect x="20" y="20" width="16" height="60" /><rect x="38" y="40" width="12" height="40" /><rect x="52" y="12" width="15" height="68" /><rect x="70" y="30" width="12" height="50" /><rect x="84" y="44" width="30" height="36" /></g>
          <rect x="96" y="22" width="5" height="24" fill="#3a3a3a" />
          <g fill="#c8c8c8">@for (q of windows; track $index) { <rect [attr.x]="q[0]" [attr.y]="q[1]" width="2.2" height="2.6" /> }</g>
          <rect y="72" width="120" height="8" fill="#262626" />
        </symbol>
        <symbol [attr.id]="uid + '-land'" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice">
          <rect width="120" height="80" [attr.fill]="'url(#' + uid + '-sky)'" /><circle cx="92" cy="16" r="7" fill="#efefef" />
          <path d="M0 50l22-24 14 14 20-26 26 30 14-12 24 18v30H0z" fill="#6e6e6e" /><path d="M48 22l8-8 8 9-5 2-3-3-4 3z" fill="#e2e2e2" />
          <path d="M0 58c30-8 60-6 120 4v18H0z" fill="#3c3c3c" /><path d="M54 80l6-22 6 22z" fill="#9a9a9a" />
          <g fill="#1f1f1f"><path d="M10 64l5-14 5 14z" /><path d="M18 66l6-18 6 18z" /><path d="M96 66l5-15 5 15z" /></g>
        </symbol>
        <symbol [attr.id]="uid + '-face'" viewBox="0 0 120 80" preserveAspectRatio="xMidYMin slice">
          <rect width="120" height="80" fill="#9d9d9d" /><circle cx="60" cy="28" r="40" fill="#b4b4b4" />
          <path d="M28 80c2-20 14-28 32-28s30 8 32 28z" fill="#2c2c2c" /><path d="M52 52l8 12 8-12z" fill="#ececec" /><path d="M58 58h4l-1 14h-2z" fill="#5a5a5a" />
          <ellipse cx="60" cy="33" rx="13" ry="16" fill="#cdcdcd" /><path d="M46 31c-1-14 8-19 14-19s16 4 14 19c-3-8-8-10-14-10s-11 2-14 10z" fill="#333" />
          <path d="M54 34h4M62 34h4M57 42c2 1.5 4 1.5 6 0" stroke="#5e5e5e" stroke-width="1.4" stroke-linecap="round" fill="none" />
        </symbol>
      </defs>
    </svg>
    <div class="une" [class]="'une v-' + d.v" lang="fr">
      @if (!over()) {
        <div class="head">
          <div class="clock" role="timer" [attr.aria-label]="'Il est ' + hhmm(d.t) + ', bouclage à ' + hhmm(d.deadline)">
            <svg class="face" viewBox="-50 -50 100 100" aria-hidden="true">
              <circle r="47" class="rim" /><circle r="42" class="dial" />
              @for (k of ticks; track k) { <path [attr.d]="k % 3 === 0 ? 'M0 -38V-31' : 'M0 -38V-34.5'" [attr.transform]="'rotate(' + k * 30 + ')'" [class.major]="k % 3 === 0" class="tk" /> }
              <path d="M0 6V-22" [attr.transform]="'rotate(' + hourDeg(d.t) + ')'" class="hh" />
              <path d="M0 8V-34" [attr.transform]="'rotate(' + minDeg(d.t) + ')'" class="mh" />
              <path d="M0 -34V-41" [attr.transform]="'rotate(' + minDeg(d.deadline) + ')'" class="dl" />
              <circle r="2.6" class="pin" />
            </svg>
            <b class="mono">{{ hhmm(d.t) }}</b>
            <span class="tbar" aria-hidden="true"><span [style.width.%]="d.t / d.deadline * 100"></span></span>
            <small [class.late]="d.deadline - d.t <= 30">Bouclage {{ hhmm(d.deadline) }} · reste {{ dur(d.deadline - d.t) }}</small>
          </div>
          <button type="button" class="btn small wait" (click)="wait()" [attr.aria-label]="'Attendre les dépêches jusqu’à ' + hhmm(nextQ())">Attendre<small>→ {{ hhmm(nextQ()) }}</small></button>
        </div>

        <div class="meters" role="list" aria-label="Lectorats touchés">
          @for (r of readers; track $index) {
            <span class="mtr" role="listitem" [attr.aria-label]="r.label + ' : ' + fmt(live().reach[$index])" [attr.title]="r.label" [class.low]="live().aud > 8 && live().reach[$index] < live().aud / 4 * 0.55">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="readerIc[$index]" /></svg><span class="mb"><span [style.width.%]="reachPct($index)"></span></span>
            </span>
          }
          <span class="aud mono" aria-label="Audience totale">{{ fmt(Math.round(live().aud)) }}<small> lect.</small></span>
        </div>
        <p class="line"><b>Consigne du rédacteur en chef :</b> {{ lineText() }} · Édito {{ live().edito ? '✓' : 'à placer' }} · Pubs {{ live().ads }}/{{ d.adsReq }}</p>

        <div class="tabs" role="tablist" aria-label="Pages du journal">
          @for (pg of d.pages; track $index; let pi = $index) {
            <button type="button" role="tab" class="tab" [class.on]="tab() === pi" [attr.aria-selected]="tab() === pi" (click)="setTab(pi)"
                    [attr.aria-label]="pg.name + ', ' + fillOf(pi) + ' cases remplies sur ' + pg.w * pg.h">
              <b>{{ pg.short }}</b><small class="mono">{{ fillOf(pi) }}/{{ pg.w * pg.h }}</small>
              @if (fillOf(pi) === pg.w * pg.h) { <i class="full">✓</i> }
            </button>
          }
        </div>

        @let pg = d.pages[tab()];
        <div class="sheet" [class.isune]="tab() === 0">
          @if (tab() === 0) {
            <div class="mast" aria-hidden="true">
              <i class="ear">{{ earLeft() }}</i><span>Le Courrier national</span><i class="ear r">2,80 €</i>
              <small>{{ dateLine() }} · {{ editionLine() }}</small>
            </div>
          }
          @else { <div class="folio" aria-hidden="true"><span>{{ pg.name }}</span><span>Le Courrier national</span></div> }
          <div class="grid" role="group" [attr.aria-label]="pg.name + ', ' + pg.w + ' colonnes sur ' + pg.h + ' lignes'"
               [style.grid-template-columns]="'repeat(' + pg.w + ', minmax(0, 1fr))'" [style.grid-template-rows]="'repeat(' + pg.h + ', var(--row))'">
            @for (c of cellsOf(tab()); track c) {
              @let cx = c % pg.w;
              @let cy = (c - cx) / pg.w;
              <button type="button" class="cell" [class.fold]="tab() === 0 && cy === 2" [class.ok]="okCells().has(c)" [style.grid-column]="cx + 1" [style.grid-row]="cy + 1"
                      (click)="tapCell(cx, cy)" [attr.aria-label]="cellLabel(cx, cy)"></button>
            }
            @for (p of placedOn(tab()); track p.s.id) {
              <button type="button" class="blk" [class]="'blk k-' + p.s.kind + ' z' + zoneOf(p)"
                      [class.sel]="sel()?.id === p.s.id" [class.stale]="p.s.stale" [class.fake]="p.s.checked && !p.s.truth" [class.target]="fixTarget() === p.s.id"
                      [class.conf]="conflictOf(p)" [class.new]="fresh0() === p.s.id" [style.--w]="p.s.w"
                      [style.grid-column]="p.x + 1 + ' / span ' + p.s.w" [style.grid-row]="p.y + 1 + ' / span ' + p.s.h"
                      (click)="tapBlock(p)" [attr.aria-label]="blockLabel(p)" [attr.aria-pressed]="sel()?.id === p.s.id">
                @if (p.s.ad) { <span class="adl">Publicité</span><span class="adn">{{ p.s.ad }}</span> }
                @else if (p.s.filler) {
                  @if (p.s.kind === 'meteo') { <svg class="wx" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6.5a4 4 0 1 1 0 .01zM9 1v2M9 10v2M3.5 6.5h2M12.5 6.5h2M17 19.5H7.5a3.5 3.5 0 1 1 1-6.9A4.6 4.6 0 0 1 17.5 14a2.8 2.8 0 0 1-.5 5.5z" /></svg> }
                  @if (p.s.kind === 'jeux') { <span class="xw" aria-hidden="true"></span> }
                  <span class="fil-t">{{ p.s.kind === 'filet' ? '❖' : p.s.title }}</span>
                }
                @else {
                  @if (p.s.kind === 'photo' || p.s.kind === 'portrait') {
                    <svg class="pic" aria-hidden="true"><use [attr.href]="'#' + uid + '-' + sceneOf(p.s)" width="100%" height="100%" /><rect width="100%" height="100%" [attr.fill]="'url(#' + uid + '-ht)'" opacity=".82" /></svg>
                  }
                  <span class="kick">{{ p.s.edito ? 'Éditorial' : rubLabel(p.s.rub) }}</span>
                  <span class="bt">{{ p.s.edito ? p.s.title.replace('Éditorial — ', '') : p.s.title }}</span>
                  @if (p.s.h > 1 && p.s.kind !== 'photo' && p.s.kind !== 'portrait') { <span class="txt" aria-hidden="true"></span> }
                  @if (p.s.stale) { <span class="flag bad">dépassé</span> }
                  @else if (p.s.checked && !p.s.truth) { <span class="flag bad">bidon</span> }
                  @else if (isDubious(p.s) && !p.s.checked) { <span class="flag q" aria-hidden="true">?</span> }
                }
                @for (f of fxOf(p.s.id); track f.id) { <span class="fx" [class]="'fx ' + f.tone">{{ f.text }}</span> }
              </button>
            }
            @if (ghost(); as g) {
              @if (g.page === tab()) {
                <div class="ghost" [class.bad]="g.err" [style.grid-column]="g.x + 1 + ' / span ' + g.w" [style.grid-row]="g.y + 1 + ' / span ' + g.h" aria-hidden="true">
                  <span>{{ g.err ? 'impossible' : '+' + fmt(Math.round(g.val)) }}</span>
                </div>
              }
            }
          </div>
        </div>

        <div class="panel" aria-live="polite">
          @if (selStory(); as s) {
            <div class="det" [class.isfix]="s.fixOf !== undefined">
              <p class="kicker"><span class="rb-l">{{ s.edito ? 'Éditorial' : rubLabel(s.rub) }}</span> · {{ kindLabel(s) }} {{ s.w }}×{{ s.h }}
                · <span [class]="'src st' + srcStars(s)">{{ srcLabel(s) }} {{ starTxt(s) }}</span></p>
              <p class="ttl">{{ s.ad ? 'Publicité — ' + s.ad : s.title }}</p>
              @if (!s.ad && s.kind !== 'filet') {
                <div class="ints">
                  @for (r of readers; track $index) {
                    <span class="ri" [attr.aria-label]="r.label + ' ' + fmt(s.int[$index])"><svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="readerIc[$index]" /></svg><span class="rbar"><span [style.width.%]="Math.min(100, s.int[$index] / 6 * 100)"></span></span><b class="mono">{{ fmt(s.int[$index]) }}</b></span>
                  }
                </div>
              }
              <div class="tags">
                @for (w of tagsOf(s); track $index) { <span class="tag" [class]="'tag ' + w.tone">{{ plain(w.text) }}</span> }
              </div>
              @if (ghost(); as g) {
                <div class="pv" [class.err]="g.err">
                  @if (g.err) { <span>Impossible : {{ g.err }}</span> }
                  @else {
                    <span><b>{{ d.pages[g.page].short }}</b>, {{ zoneLabel(g.page, g.y) }} : <b class="g">+{{ fmt(Math.round(g.val)) }} lecteurs</b> <small>(×{{ fmt(Math.round(g.weight * 100) / 100) }})</small></span>
                    @for (w of g.warn; track $index) { <small class="warn">{{ plain(w) }}</small> }
                  }
                </div>
              }
              <div class="acts">
                @if (sel()?.where === 'fil') {
                  @if (s.fixOf !== undefined) {
                    <button type="button" class="btn primary small" [disabled]="!afford('place')" (click)="doSwap(s.id)">Remplacer en page <small>−{{ cost('place') }}′</small></button>
                  } @else {
                    @if (ghost(); as g) { @if (!g.err) { <button type="button" class="btn primary small" (click)="confirm()">Placer <small>−{{ cost('place') }}′</small></button> } }
                    @if (s.rot && s.w !== s.h) { <button type="button" class="btn small" (click)="doRotate(s.id)" aria-label="Pivoter le bloc">↻ Pivoter</button> }
                    @if (!s.ad && !s.filler && s.w * s.h > 1) { <button type="button" class="btn small" [disabled]="!afford('cut')" (click)="doCut(s.id)">Couper <small>−{{ cost('cut') }}′</small></button> }
                  }
                  @if (canVerify(s)) { <button type="button" class="btn small" [disabled]="!afford('verify')" (click)="doVerify(s.id)">Vérifier <small>−{{ cost('verify') }}′</small></button> }
                  @if (!s.ad && !s.unlimited && !s.edito) { <button type="button" class="btn small spike" (click)="doSpike(s.id)">Au panier</button> }
                } @else {
                  @if (canVerify(s)) { <button type="button" class="btn small" [disabled]="!afford('verify')" (click)="doVerify(s.id)">Vérifier <small>−{{ cost('verify') }}′</small></button> }
                  <button type="button" class="btn small" [disabled]="!afford('remove')" (click)="doRemove(s.id)">Retirer de la page <small>−{{ cost('remove') }}′</small></button>
                }
              </div>
            </div>
          } @else {
            <p class="hint">{{ plain(hint()) }}</p>
          }
        </div>

        <div class="filhead"><b>Le fil des dépêches</b><small>{{ news().length }} dépêche{{ news().length > 1 ? 's' : '' }} · périment au bout de {{ life }} min</small></div>
        <div class="fil" role="listbox" aria-label="Dépêches à placer">
          @for (s of news(); track s.id) {
            <button type="button" class="gcard" role="option" [class.on]="sel()?.id === s.id" [class.scoop]="s.scoop" [class.fix]="s.fixOf !== undefined" [class.fake]="s.checked && !s.truth"
                    [attr.aria-selected]="sel()?.id === s.id" (click)="pick(s.id)" [attr.aria-label]="cardLabel(s)">
              <span class="c-top">
                <span class="c-k">{{ s.fixOf !== undefined ? 'RECTIFICATIF' : s.scoop ? 'URGENT' : srcShort(s) }} · {{ hhmm(s.born) }}</span>
                <span [class]="'c-src st' + srcStars(s)" aria-hidden="true">{{ starTxt(s) }}</span>
              </span>
              <span class="c-r">{{ rubLabel(s.rub) }} · {{ kindLabel(s) }}</span>
              <span class="c-t">{{ s.title }}</span>
              <span class="c-b">
                <span class="shape" [style.--w]="s.w" [style.--h]="s.h" aria-hidden="true">@for (q of range(s.w * s.h); track q) { <i></i> }</span>
                <span class="c-int mono">{{ fmt(Math.round(sumInt(s))) }}<small> pts</small></span>
                @for (b of badges(s); track $index) { <span class="bd">{{ b }}</span> }
                @if (s.exp < 1e8) { <span class="age" [class.old]="s.exp - d.t <= 20" [attr.aria-hidden]="true"><span [style.width.%]="(s.exp - d.t) / life * 100"></span></span> }
              </span>
            </button>
          } @empty { <p class="small muted">Le fil est calme… attendez la prochaine dépêche.</p> }
        </div>
        <div class="maison" role="toolbar" aria-label="Rubriques maison et publicités">
          @for (s of house(); track s.id) {
            <button type="button" class="gchip" [class.on]="sel()?.id === s.id" [class.ad]="s.ad" [class.ed]="s.edito" (click)="pick(s.id)" [attr.aria-label]="cardLabel(s)" [attr.aria-pressed]="sel()?.id === s.id">
              <span class="shape" [style.--w]="s.w" [style.--h]="s.h" aria-hidden="true">@for (q of range(s.w * s.h); track q) { <i></i> }</span>
              {{ s.ad ? 'Pub · ' + s.ad : s.edito ? 'Éditorial' : s.kind === 'filet' ? 'Encadré ❖ ∞' : s.title }}
            </button>
          }
        </div>

        <ul class="log" aria-live="polite">@for (l of log(); track $index) { <li [class]="l.tone">{{ l.text }}</li> }</ul>
        <div class="end">
          <button type="button" class="btn primary" (click)="print()">{{ armed() ? 'Confirmer : ' + live().empty + ' case' + (live().empty > 1 ? 's' : '') + ' blanche' + (live().empty > 1 ? 's' : '') : 'Envoyer à l’imprimerie' }}</button>
        </div>
      } @else {
        @if (final(); as sc) {
          <div class="print" aria-label="La Une imprimée">
            <div class="mast big"><i class="ear">{{ earLeft() }}</i><span>Le Courrier national</span><i class="ear r">2,80 €</i><small>{{ dateLine() }} · {{ editionLine() }}</small></div>
            <div class="grid pgrid" [style.grid-template-columns]="'repeat(6, minmax(0, 1fr))'" [style.grid-template-rows]="'repeat(8, var(--prow))'">
              @for (c of cellsOf(0); track c) {
                <span class="blank" [style.grid-column]="(c % 6) + 1" [style.grid-row]="(c - (c % 6)) / 6 + 1"></span>
              }
              @for (p of placedOn(0); track p.s.id) {
                <span class="pb" [class]="'pb k-' + p.s.kind" [class.hl]="sc.headline === p" [style.--w]="p.s.w" [style.grid-column]="p.x + 1 + ' / span ' + p.s.w" [style.grid-row]="p.y + 1 + ' / span ' + p.s.h">
                  @if (p.s.ad) { <em>Publicité</em><strong>{{ p.s.ad }}</strong> } @else if (p.s.filler) { <em>{{ p.s.kind === 'filet' ? '❖' : p.s.title }}</em> }
                  @else {
                    @if (p.s.kind === 'photo' || p.s.kind === 'portrait') {
                      <svg class="pic" aria-hidden="true"><use [attr.href]="'#' + uid + '-' + sceneOf(p.s)" width="100%" height="100%" /><rect width="100%" height="100%" [attr.fill]="'url(#' + uid + '-ht)'" opacity=".82" /></svg>
                    }
                    <b>{{ p.s.edito ? p.s.title.replace('Éditorial — ', '') : p.s.title }}</b>
                    @if (p.s.h > 1 && p.s.kind !== 'photo' && p.s.kind !== 'portrait') { <span class="txt" aria-hidden="true"></span> }
                  }
                  @if (!p.s.truth || p.s.stale) { <i class="stamp">Démenti</i> }
                  @else if (p.s.accuse && !p.s.checked) { <i class="stamp law">Plainte</i> }
                </span>
              }
            </div>
          </div>
          <div class="sum" aria-live="polite">
            <p class="verdict"><b>{{ message() }}</b></p>
            <div class="bars">
              <span>Audience</span><span class="gbar"><span [style.width.%]="sc.audC * 100"></span></span><b class="mono">{{ Math.round(sc.audC * 100) }}</b>
              <span>Équilibre</span><span class="gbar"><span [style.width.%]="sc.balC * 100"></span></span><b class="mono">{{ Math.round(sc.balC * 100) }}</b>
              <span>Remplissage</span><span class="gbar"><span [style.width.%]="sc.fillC * 100"></span></span><b class="mono">{{ Math.round(sc.fillC * 100) }}</b>
              <span>Publicité</span><span class="gbar"><span [style.width.%]="sc.adsC * 100"></span></span><b class="mono">{{ Math.round(sc.adsC * 100) }}</b>
              <span>Ligne</span><span class="gbar"><span [style.width.%]="sc.lineC * 100"></span></span><b class="mono">{{ Math.round(sc.lineC * 100) }}</b>
            </div>
            <p class="chips">
              <span class="chip2">{{ sc.pagesFull }}/{{ d.pages.length }} pages complètes</span>
              <span class="chip2" [class.bad]="sc.empty">{{ sc.empty }} case{{ sc.empty > 1 ? 's' : '' }} blanche{{ sc.empty > 1 ? 's' : '' }}</span>
              <span class="chip2" [class.bad]="sc.dementis.length">{{ sc.dementis.length }} démenti{{ sc.dementis.length > 1 ? 's' : '' }}</span>
              @if (d.v === 'scandale' || sc.proces.length) { <span class="chip2" [class.bad]="sc.proces.length">{{ sc.proces.length }} plainte{{ sc.proces.length > 1 ? 's' : '' }} en diffamation</span> }
              <span class="chip2">{{ d.caught }} intox déjouée{{ d.caught > 1 ? 's' : '' }}</span>
              @if (sc.unmet) { <span class="chip2 bad">Ligne : {{ sc.unmet }}</span> }
              @if (sc.conflicts) { <span class="chip2 bad">{{ sc.conflicts }} entorse{{ sc.conflicts > 1 ? 's' : '' }} à la ligne</span> }
            </p>
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; --row: 42px; --prow: 34px;
      --paper: #f1ecdf; --paper-2: #f6f2e8; --news-ink: #1b1a17; --news-ink-2: #57534a; --news-red: #b3261e; --guide: #8fc0d6; --txtl: rgba(40, 36, 30, .3); --screen: #f1ecdf;
      --slip: #fbf9f2; --slip-ink: #24231f; --slip-ink-2: #6a675e; --slip-line: #ddd6c4;
      --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .3 0 0 0 0 .26 0 0 0 0 .2 0 0 0 .11 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
    @media (prefers-color-scheme: dark) {
      :host-context(html:not([data-theme="light"])) { --paper: #d6cfbd; --paper-2: #ddd7c7; --screen: #d6cfbd; --guide: #6f9fb4; --slip: #20242b; --slip-ink: #e7e3d9; --slip-ink-2: #a7a59f; --slip-line: #363c46; }
    }
    :host-context(html[data-theme="dark"]) { --paper: #d6cfbd; --paper-2: #ddd7c7; --screen: #d6cfbd; --guide: #6f9fb4; --slip: #20242b; --slip-ink: #e7e3d9; --slip-ink-2: #a7a59f; --slip-line: #363c46; }
    .defs { position: absolute; width: 0; height: 0; overflow: hidden; }
    .screen { fill: var(--screen); }
    .une { display: grid; gap: 8px; font-size: 13px; min-width: 0; }
    .head { display: flex; align-items: center; gap: 8px; }
    .clock { flex: 1; min-width: 0; display: grid; grid-template-columns: auto auto minmax(0, 1fr); grid-template-rows: auto auto; align-items: center; gap: 2px 8px;
      .face { grid-row: span 2; width: 48px; height: 48px; }
      b { font-size: 19px; letter-spacing: .02em; } .tbar { grid-column: 3; } small { grid-column: 2 / span 2; font-size: 11px; color: var(--ink-2); &.late { color: var(--bad); font-weight: 600; } } }
    .face { .rim { fill: #2b2d31; } .dial { fill: #fbfaf6; } .tk { stroke: #1d1e21; stroke-width: 1.6; &.major { stroke-width: 3; } }
      .late { fill: rgba(179, 38, 30, .14); } .hh { stroke: #111; stroke-width: 4.2; stroke-linecap: round; } .mh { stroke: #111; stroke-width: 2.6; stroke-linecap: round; }
      .dl { stroke: #c62f22; stroke-width: 3; stroke-linecap: round; } .pin { fill: #c62f22; } }
    .tbar { height: 5px; border-radius: 1px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden;
      span { display: block; height: 100%; background: linear-gradient(90deg, var(--ink-3), var(--bad)); } }
    .wait { display: grid; justify-items: center; line-height: 1.1; min-height: 42px; small { font-size: 10px; color: var(--ink-3); } }
    .meters { display: flex; align-items: center; gap: 8px; }
    .mtr { flex: 1; display: flex; align-items: center; gap: 4px; min-width: 0; svg { width: 15px; height: 15px; flex: none; fill: none; stroke: var(--ink-2); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
      &.low .mb span { background: var(--bad); } &.low svg { stroke: var(--bad); } }
    .mb { flex: 1; height: 5px; border-radius: 1px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; span { display: block; height: 100%; background: var(--ink-2); transition: width .3s ease; } }
    .aud { font-size: 13px; font-weight: 700; white-space: nowrap; small { font-weight: 400; font-size: 10px; color: var(--ink-3); } }
    .line { margin: 0; font-size: 11.5px; color: var(--ink-2); padding: 5px 8px; border-left: 3px solid var(--news-red); background: var(--surface-2); b { color: var(--ink); font-weight: 600; } }
    .tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; margin-bottom: -8px; position: relative; z-index: 1; }
    .tab { position: relative; display: flex; align-items: baseline; justify-content: center; gap: 6px; min-height: 36px; border-radius: 5px 5px 0 0; border: 1px solid var(--line); border-bottom: 0;
      background: var(--surface-2); color: var(--ink-2); cursor: pointer; font: inherit; padding: 4px;
      b { font-family: var(--font-display); } small { font-size: 11px; } &.on { background: var(--paper); color: var(--news-ink); box-shadow: inset 0 3px 0 var(--news-red); small { color: var(--news-ink-2); } }
      .full { position: absolute; top: 2px; right: 5px; font-style: normal; color: var(--good); font-size: 11px; } }
    .tab.on .full { color: #2f7d4f; }
    .sheet { background: var(--grain), var(--paper); border-radius: 0 0 2px 2px; padding: 8px 6px 6px; box-shadow: 0 1px 0 rgba(0,0,0,.05), 0 10px 22px -12px rgba(0,0,0,.55); color: var(--news-ink); }
    .mast { display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; column-gap: 6px; border-bottom: 1px solid var(--news-ink); margin-bottom: 5px; padding-bottom: 3px;
      > span { font: 700 21px/1.05 var(--font-display); letter-spacing: -.01em; text-align: center; white-space: nowrap; }
      .ear { font: 600 8px/1.2 var(--font-body); font-style: normal; text-transform: uppercase; letter-spacing: .06em; color: var(--news-ink-2); border: 1px solid var(--news-ink-2); padding: 2px 3px; justify-self: start; max-width: 64px; &.r { justify-self: end; } }
      small { grid-column: 1 / -1; margin-top: 3px; padding: 2px 0; border-top: 3px double var(--news-ink); font-size: 9px; color: var(--news-ink-2); text-transform: uppercase; letter-spacing: .08em; text-align: center; }
      &.big > span { font-size: 27px; } }
    .folio { display: flex; justify-content: space-between; font: 600 10px var(--font-body); text-transform: uppercase; letter-spacing: .06em; color: var(--news-ink-2); border-bottom: 2px solid var(--news-ink); margin-bottom: 5px; padding-bottom: 2px; span:last-child { font-family: var(--font-display); text-transform: none; letter-spacing: 0; font-size: 11px; } }
    .grid { display: grid; gap: 3px; user-select: none; touch-action: manipulation; }
    .cell { min-width: 0; min-height: 32px; border: 1px dashed var(--guide); border-radius: 0; background: transparent; padding: 0; cursor: pointer; opacity: .8;
      &.fold { border-top: 1.5px solid #a99d84; } &.ok { background: rgba(47, 125, 79, .13); border-color: rgba(47, 125, 79, .6); opacity: 1; }
      &:focus-visible { outline: 3px solid var(--accent); outline-offset: -2px; } }
    .blk { --w: 1; position: relative; z-index: 1; min-width: 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; align-items: stretch; gap: 1px; padding: 3px 3px 2px; text-align: left;
      border: 0; border-top: 1.5px solid var(--news-ink); border-radius: 0; background: var(--paper); color: var(--news-ink); cursor: pointer; font: inherit;
      &.sel { box-shadow: 0 0 0 2.5px var(--accent); z-index: 2; background: var(--paper-2); } &:focus-visible { outline: 3px solid var(--accent); outline-offset: -2px; }
      &.conf { box-shadow: inset 0 0 0 2px #d98a1c; } &.target { animation: blink 1s ease-in-out infinite; box-shadow: 0 0 0 3px var(--bad); }
      &.stale { background: repeating-linear-gradient(135deg, rgba(179, 38, 30, .08) 0 6px, rgba(179, 38, 30, .16) 6px 12px); }
      &.fake { background: rgba(179, 38, 30, .14); }
      &.new { animation: drop .4s cubic-bezier(.2, 1.3, .4, 1) both; } }
    .kick { font: 700 8px/1.1 var(--font-body); text-transform: uppercase; letter-spacing: .08em; color: var(--news-red); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: none; }
    .bt { font: 700 11px/1.12 var(--font-display); overflow-wrap: break-word; hyphens: auto; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; flex: none; letter-spacing: -.005em; }
    .txt { flex: 1 1 0; min-height: 0; margin-top: 2px;
      background: linear-gradient(90deg, transparent calc(100% - 4px), var(--news-ink-2) calc(100% - 4px) calc(100% - 3.5px), transparent calc(100% - 3.5px)) 0 0 / calc(100% / var(--w) + .5px) 100% repeat-x,
                  repeating-linear-gradient(180deg, var(--txtl) 0 1.3px, transparent 1.3px 3.6px);
      -webkit-mask: linear-gradient(90deg, #000 calc(100% - 4px), transparent 0) 0 0 / calc(100% / var(--w)) 100% repeat-x; mask: linear-gradient(90deg, #000 calc(100% - 4px), transparent 0) 0 0 / calc(100% / var(--w)) 100% repeat-x; }
    .z0 .bt { font-size: 14px; } .z1 .bt { font-size: 12px; }
    .k-manchette .bt { font-size: 18px; font-weight: 800; line-height: 1.02; -webkit-line-clamp: 3; letter-spacing: -.015em; }
    .k-manchette { border-top-width: 3px; }
    .k-breve .bt, .k-portrait .bt { font-size: 10px; -webkit-line-clamp: 2; } .k-breve .kick { display: none; }
    .k-breve { border-top-width: 1px; } .k-breve.z0 .bt { font-size: 10.5px; }
    .k-edito { border-top: 0; border-left: 2px solid var(--news-ink); padding-left: 5px; .bt { font-style: italic; font-weight: 600; } .kick { color: var(--news-ink); } }
    .k-photo, .k-portrait { border-top: 0; padding: 0 0 2px; .kick { padding: 1px 2px 0; } .bt { padding: 0 2px; font-size: 9.5px; font-weight: 600; font-style: italic; -webkit-line-clamp: 2; } }
    .pic { display: block; flex: 1 1 0; min-height: 0; width: 100%; background: #888; }
    .k-pub { border: 1.5px solid var(--news-ink); align-items: center; justify-content: center; text-align: center; background: var(--paper-2); outline: 1px solid var(--news-ink); outline-offset: -4px; }
    .adl { font: 700 7.5px var(--font-body); text-transform: uppercase; letter-spacing: .12em; color: var(--news-ink-2); } .adn { font: 800 12px/1.05 var(--font-display); text-transform: uppercase; letter-spacing: .02em; }
    .k-filet, .k-meteo, .k-jeux { border-top: 1px solid var(--news-ink-2); align-items: center; justify-content: center; gap: 2px; background: rgba(120, 104, 70, .1); }
    .wx { width: 18px; height: 18px; fill: none; stroke: var(--news-ink); stroke-width: 1.4; stroke-linecap: round; flex: none; }
    .xw { width: 26px; height: 18px; flex: none; border: 1px solid var(--news-ink); background: linear-gradient(90deg, var(--news-ink) 1px, transparent 1px) 0 0 / 5px 5px, linear-gradient(var(--news-ink) 1px, transparent 1px) 0 0 / 5px 5px, linear-gradient(45deg, transparent 60%, var(--news-ink) 60% 70%, transparent 70%) 0 0 / 10px 10px; }
    .fil-t { font: 600 9.5px/1.1 var(--font-body); color: var(--news-ink-2); text-align: center; }
    .flag { position: absolute; right: 2px; bottom: 2px; font: 700 8.5px var(--font-body); text-transform: uppercase; letter-spacing: .04em; padding: 1px 3px; border-radius: 1px; &.bad { background: var(--news-red); color: #fff; } &.q { background: #d98a1c; color: #fff; min-width: 12px; text-align: center; } }
    .ghost { position: relative; z-index: 3; pointer-events: none; border: 2px dashed #2f7d4f; background: rgba(47, 125, 79, .16); display: grid; place-items: center;
      span { font: 800 12px var(--font-body); color: #1f5e39; background: rgba(255,255,255,.85); padding: 0 4px; border-radius: 2px; }
      &.bad { border-color: var(--news-red); background: rgba(179, 38, 30, .14); span { color: var(--news-red); } } }
    .fx { position: absolute; z-index: 5; top: 30%; left: 50%; transform: translateX(-50%); font: 800 13px var(--font-body); white-space: nowrap; pointer-events: none; animation: rise 1.1s ease forwards; text-shadow: 0 1px 2px #fff;
      &.good { color: #1f6b3e; } &.bad { color: var(--news-red); } &.info { color: var(--news-ink); } }
    @keyframes rise { to { transform: translate(-50%, -20px); opacity: 0; } }
    @keyframes drop { from { transform: scale(.9); opacity: 0; } }
    @keyframes blink { 50% { box-shadow: 0 0 0 3px transparent; } }
    .panel { min-height: 64px; }
    .hint { margin: 0; font-size: 12px; color: var(--ink-2); }
    .det { display: grid; gap: 5px; padding: 8px 10px; border-radius: 3px; background: var(--slip); color: var(--slip-ink); border: 1px solid var(--slip-line); &.isfix { border-color: var(--bad); } }
    .kicker { margin: 0; font-size: 11px; color: var(--slip-ink-2); .rb-l { color: var(--news-red); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; font-size: 10px; } }
    :host-context(html[data-theme="dark"]) .kicker .rb-l { color: #f08a72; }
    @media (prefers-color-scheme: dark) { :host-context(html:not([data-theme="light"])) .kicker .rb-l { color: #f08a72; } }
    .src.st1 { color: var(--bad); font-weight: 600; } .src.st2 { color: var(--warn); font-weight: 600; } .src.st3 { color: var(--good); }
    .ttl { margin: 0; font: 700 15px/1.2 var(--font-display); }
    .ints { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
    .ri { display: flex; align-items: center; gap: 3px; min-width: 0; svg { width: 13px; height: 13px; flex: none; fill: none; stroke: var(--slip-ink-2); stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; } b { font-size: 11px; } }
    .rbar { flex: 1; height: 4px; background: var(--slip-line); overflow: hidden; min-width: 8px; span { display: block; height: 100%; background: var(--slip-ink); } }
    .tags { display: flex; flex-wrap: wrap; gap: 4px; &:empty { display: none; } }
    .tag { font-size: 11px; padding: 1px 6px; border-radius: 2px; background: transparent; border: 1px solid var(--slip-line); color: var(--slip-ink-2);
      &.bad { background: var(--bad-soft); color: var(--bad); border-color: transparent; } &.good { background: var(--good-soft); color: var(--good); border-color: transparent; } }
    .pv { display: grid; gap: 2px; font-size: 12px; padding: 5px 7px; border-radius: 2px; background: var(--surface-2); color: var(--ink); &.err { color: var(--bad); background: var(--bad-soft); }
      small { color: var(--ink-3); } .warn { color: var(--bad); } .g { color: var(--good); } }
    .acts { display: flex; flex-wrap: wrap; gap: 5px; .btn { min-height: 34px; } small { opacity: .75; font-size: 10.5px; } .spike { margin-left: auto; } }
    .filhead { display: flex; align-items: baseline; justify-content: space-between; gap: 6px; border-bottom: 1px solid var(--line); padding-bottom: 3px;
      b { font: 600 13px var(--font-display); } small { font-size: 10.5px; color: var(--ink-3); text-align: right; } }
    .fil { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: max-content; align-content: start; gap: 6px; max-height: 260px; overflow-y: auto; overscroll-behavior: contain; padding: 2px; }
    .gcard { position: relative; display: grid; gap: 3px; align-content: start; padding: 6px 7px 6px 15px; min-height: 76px; border-radius: 1px; border: 1px solid var(--slip-line); color: var(--slip-ink); font: inherit; text-align: left; cursor: pointer;
      background: radial-gradient(circle at 6px 50%, var(--surface) 2.2px, transparent 2.6px) 0 0 / 12px 10px repeat-y, linear-gradient(90deg, transparent 11px, var(--slip-line) 11px 12px, transparent 12px), var(--slip);
      box-shadow: 0 1px 2px rgba(0,0,0,.08);
      &.on { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }
      &.scoop { border-color: var(--news-red); .c-k { color: var(--news-red); font-weight: 700; } }
      &.fix { border-color: var(--bad); background: radial-gradient(circle at 6px 50%, var(--surface) 2.2px, transparent 2.6px) 0 0 / 12px 10px repeat-y, var(--bad-soft); .c-k { color: var(--bad); font-weight: 700; } }
      &.fake { opacity: .6; .c-t { text-decoration: line-through; } } }
    .c-top { display: flex; align-items: center; gap: 5px; font: 500 9.5px var(--font-mono); color: var(--slip-ink-2); .c-k { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: .02em; } }
    .c-r { font: 9px var(--font-mono); color: var(--slip-ink-2); text-transform: uppercase; letter-spacing: .03em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-bottom: 1px dashed var(--slip-line); padding-bottom: 2px; }
    .c-src { font-size: 9px; letter-spacing: -1px; &.st1 { color: var(--bad); } &.st2 { color: var(--warn); } &.st3 { color: var(--good); } }
    .c-t { font: 500 11.5px/1.25 var(--font-mono); overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
    .c-b { display: flex; align-items: center; gap: 5px; font-size: 10.5px; .bd { font: 600 9px var(--font-body); text-transform: uppercase; padding: 0 3px; border: 1px solid var(--slip-line); border-radius: 1px; } }
    .c-int { font-weight: 700; small { font-weight: 400; color: var(--slip-ink-2); } }
    .age { margin-left: auto; width: 26px; height: 4px; background: var(--slip-line); overflow: hidden; span { display: block; height: 100%; background: var(--good); } &.old span { background: var(--bad); } }
    .shape { display: inline-grid; grid-template-columns: repeat(var(--w), 4px); grid-auto-rows: 4px; gap: 1px; flex: none; i { background: currentColor; opacity: .55; } }
    .maison { display: flex; flex-wrap: wrap; gap: 4px; }
    .gchip { display: inline-flex; align-items: center; gap: 5px; min-height: 34px; padding: 3px 9px; border-radius: 2px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink); font: inherit; font-size: 11.5px; cursor: pointer;
      &.on { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); } &.ad { border-style: double; border-width: 3px; padding: 1px 7px; } &.ed { font-style: italic; font-family: var(--font-display); } }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 64px; overflow: auto; font: 11px/1.3 var(--font-mono); color: var(--ink-2);
      .bad { color: var(--bad); } .good { color: var(--good); } }
    .end { display: flex; justify-content: flex-end; .btn { min-height: 40px; } }
    .print { background: var(--grain), var(--paper); color: var(--news-ink); padding: 10px 8px 12px; border-radius: 1px; position: relative; box-shadow: 0 14px 28px -14px rgba(0,0,0,.6), 0 1px 0 rgba(0,0,0,.08); animation: press .6s ease both;
      &::after { content: ''; position: absolute; left: 0; right: 0; top: 52%; height: 22px; pointer-events: none; background: linear-gradient(180deg, transparent, rgba(0,0,0,.07) 48%, rgba(255,255,255,.35) 52%, transparent); } }
    @keyframes press { from { transform: translateY(12px) scale(.97); opacity: 0; } }
    .pgrid { gap: 4px 5px; }
    .blank { border: 1px dotted rgba(120, 104, 70, .35); }
    .pb { --w: 1; position: relative; overflow: hidden; background: var(--paper); display: flex; flex-direction: column; gap: 1px; padding: 2px 2px 1px; border-top: 1.5px solid var(--news-ink); font: 700 9px/1.12 var(--font-display);
      b { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; flex: none; overflow-wrap: break-word; hyphens: auto; } em { font: 600 8px var(--font-body); color: var(--news-ink-2); text-transform: uppercase; letter-spacing: .08em; }
      strong { font: 800 11px/1.05 var(--font-display); text-transform: uppercase; }
      .pic { flex: 1 1 0; } &.k-photo, &.k-portrait { border-top: 0; padding: 0; b { font-style: italic; font-weight: 600; font-size: 8px; -webkit-line-clamp: 1; } }
      &.k-pub { border: 1.5px solid var(--news-ink); display: grid; place-content: center; text-align: center; outline: 1px solid var(--news-ink); outline-offset: -4px; }
      &.k-filet, &.k-meteo, &.k-jeux { border-top-width: 1px; display: grid; place-items: center; background: rgba(120, 104, 70, .1); }
      &.k-breve { border-top-width: 1px; font-size: 8.5px; }
      &.k-edito { border-top: 0; border-left: 2px solid var(--news-ink); padding-left: 4px; font-style: italic; }
      &.hl { border-top-width: 3px; b { font-size: 17px; line-height: 1.02; font-weight: 800; letter-spacing: -.015em; } } }
    .stamp { position: absolute; right: 3px; top: 38%; transform: rotate(-12deg); font: 800 9px var(--font-body); font-style: normal; text-transform: uppercase; letter-spacing: .06em; color: var(--news-red); border: 1.5px solid var(--news-red); padding: 0 3px; border-radius: 1px; background: rgba(255,255,255,.55);
      &.law { color: #8a5a00; border-color: #8a5a00; } }
    .sum { display: grid; gap: 8px; margin-top: 10px; }
    .verdict { margin: 0; font: 600 15px/1.3 var(--font-display); }
    .bars { display: grid; grid-template-columns: auto 1fr 28px; gap: 5px 8px; align-items: center; font-size: 12px; b { text-align: right; } }
    .gbar { height: 6px; border-radius: 1px; background: var(--surface-2); overflow: hidden; border: 1px solid var(--line); span { display: block; height: 100%; background: var(--ink-2); } }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 0; }
    .chip2 { font-size: 11.5px; padding: 2px 7px; border-radius: 2px; background: var(--surface-2); border: 1px solid var(--line); &.bad { background: var(--bad-soft); color: var(--bad); border-color: transparent; } }
    .small { font-size: 12px; margin: 0; } .muted { color: var(--ink-3); }
    @media (max-width: 380px) { :host { --row: 38px; --prow: 30px; } .k-manchette .bt { font-size: 15px; } .z0 .bt { font-size: 12.5px; } .bt { font-size: 10px; } .mast > span { font-size: 18px; } .mast .ear { display: none; } .mast.big > span { font-size: 22px; } }
    @media (min-width: 720px) { :host { --row: 54px; --prow: 46px; } .k-manchette .bt { font-size: 26px; } .z0 .bt { font-size: 17px; } .z1 .bt { font-size: 14px; } .bt { font-size: 12.5px; } .mast > span { font-size: 34px; } .mast.big > span { font-size: 40px; }
      .pb { font-size: 11px; &.hl b { font-size: 26px; } } .fil { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (prefers-reduced-motion: reduce) { .blk.new, .fx, .print, .blk.target { animation: none; } .mb span { transition: none; } }
  `,
})
export class UneGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly Math = Math;
  protected readonly fmt = fmt;
  protected readonly hhmm = hhmm;
  protected readonly dur = dur;
  protected readonly readers = READERS;
  protected readonly life = LIFE;
  protected readonly isDubious = isDubious;
  protected readonly plain = plain;
  protected readonly readerIc = READER_IC;
  protected readonly uid = 'une' + ++uneInstances;
  protected readonly ticks = Array.from({ length: 12 }, (_, i) => i);
  /** Les gradins du stade (points de la foule) et les fenêtres de la ville, pour les photos */
  protected readonly dots: number[][] = Array.from({ length: 360 }, (_, i) => [2 + (i % 40) * 3 + ((Math.floor(i / 40) % 2) * 1.5), 2.5 + Math.floor(i / 40) * 3]);
  protected readonly windows: number[][] = [[4, 34, 14, 46], [20, 20, 16, 60], [38, 40, 12, 40], [52, 12, 15, 68], [70, 30, 12, 50], [84, 44, 30, 36]]
    .flatMap(([x, y, w, h]) => { const o: number[][] = []; for (let yy = y + 3; yy < y + h - 8; yy += 5) for (let xx = x + 2; xx < x + w - 2; xx += 4) if ((xx * 7 + yy * 3) % 5) o.push([xx, yy]); return o; });

  protected readonly desk = signal<Desk>(newDesk('quotidien', 1, Math.random));
  protected readonly tab = signal(0);
  protected readonly sel = signal<Sel>(null);
  protected readonly aim = signal<{ page: number; x: number; y: number } | null>(null);
  protected readonly over = signal(false);
  protected readonly final = signal<Score | null>(null);
  protected readonly message = signal('');
  protected readonly log = signal<Ev[]>([]);
  protected readonly fx = signal<Fx[]>([]);
  protected readonly fresh0 = signal<number | null>(null);
  protected readonly armed = signal(false);
  private readonly rnd: Rnd = Math.random;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private brief = BRIEF.quotidien;
  private readonly cellCache = new Map<number, number[]>();

  protected readonly live = computed(() => scoreDesk(this.desk()));
  protected readonly nextQ = computed(() => nextQuarter(this.desk()));
  protected readonly news = computed(() => {
    const d = this.desk();
    return d.fil.filter(s => !s.ad && !s.filler && !s.edito)
      .sort((a, b) => Number(b.fixOf !== undefined) - Number(a.fixOf !== undefined) || Number(!!b.scoop) - Number(!!a.scoop) || b.born - a.born || a.id - b.id);
  });
  protected readonly house = computed(() => this.desk().fil.filter(s => s.ad || s.filler || s.edito).sort((a, b) => Number(!!b.edito) - Number(!!a.edito) || Number(!!b.ad) - Number(!!a.ad)));

  protected readonly selStory = computed<Story | null>(() => {
    const s = this.sel();
    if (!s) return null;
    const d = this.desk();
    return (s.where === 'fil' ? d.fil.find(z => z.id === s.id) : d.placed.find(p => p.s.id === s.id)?.s) ?? null;
  });
  protected readonly fixTarget = computed(() => {
    const s = this.selStory();
    return s && this.sel()?.where === 'fil' && s.fixOf !== undefined ? s.fixOf : null;
  });

  /** Ancre : la case touchée, ramenée pour que le bloc tienne dans la page */
  protected readonly ghost = computed<Ghost | null>(() => {
    const a = this.aim();
    const s = this.selStory();
    if (!a || !s || this.sel()?.where !== 'fil' || s.fixOf !== undefined) return null;
    const d = this.desk();
    const P = d.pages[a.page];
    const x = Math.max(0, Math.min(a.x, P.w - s.w)), y = Math.max(0, Math.min(a.y, P.h - s.h));
    const err = canPlace(d, s, a.page, x, y);
    const weight = weightOf(a.page, y, s.h);
    const val = sum(valueAt(d, s, a.page, y));
    const warn: string[] = [];
    if (!err) {
      if (lineConflict(d.line, s, a.page, y)) warn.push(`📏 Contraire à la ligne : « ${LINES[d.line].text} ».`);
      if (isDubious(s) && !s.checked) warn.push(s.accuse ? '⚖️ Accusation invérifiée : risque de plainte en diffamation, et de démenti.' : '❓ Source douteuse non vérifiée : risque de démenti.');
      if (s.src === 'institut' && !s.checked) warn.push('📊 Estimation non vérifiée : elle pourrait être corrigée.');
      else if (s.fragile && s.checked) warn.push('📊 Estimation fragile : un rectificatif va tomber.');
    }
    return { page: a.page, x, y, w: s.w, h: s.h, err, val, weight, warn };
  });

  /** Cases où la dépêche choisie peut être ancrée */
  protected readonly okCells = computed(() => {
    const out = new Set<number>();
    const s = this.selStory();
    if (!s || this.sel()?.where !== 'fil' || s.fixOf !== undefined) return out;
    const d = this.desk();
    const page = this.tab();
    const P = d.pages[page];
    const g = occ(d, page);
    for (let y = 0; y + s.h <= P.h; y++) for (let x = 0; x + s.w <= P.w; x++) {
      if (canPlace(d, s, page, x, y, g)) continue;
      for (let dy = 0; dy < s.h; dy++) for (let dx = 0; dx < s.w; dx++) out.add((y + dy) * P.w + x + dx);
    }
    return out;
  });

  ngOnInit(): void {
    const id = this.def().id;
    const v: Variant = id.includes('electoral') || id.includes('election') ? 'electoral' : id.includes('scandale') || id.includes('affaire') ? 'scandale' : 'quotidien';
    this.brief = BRIEF[v];
    const d = newDesk(v, this.diff(), this.rnd);
    this.desk.set(d);
    this.say({ text: `📏 Ligne du rédacteur en chef : « ${LINES[d.line].text} ». Le publicitaire attend ${d.adsReq} pubs.`, tone: 'info' });
    this.say({ text: `🕗 20:00 — ${this.brief.brief}`, tone: 'info' });
    this.emitProgress();
  }

  ngOnDestroy(): void { this.timers.forEach(t => clearTimeout(t)); }

  /* ── Libellés ── */

  protected hourDeg(t: number): number { const m = 20 * 60 + t; return ((m / 60) % 12) * 30; }
  protected minDeg(t: number): number { return ((20 * 60 + t) % 60) * 6; }
  protected sceneOf(s: Story): string { return s.kind === 'portrait' ? 'face' : SCENE[s.rub] ?? 'land'; }
  protected srcShort(s: Story): string { return s.pair !== undefined && s.src !== 'document' ? 'SOURCE ANON.' : SRC_SHORT[s.src]; }
  protected earLeft(): string { return this.desk().v === 'electoral' ? 'Spécial élections' : this.desk().v === 'scandale' ? 'Édition spéciale' : 'Dernière édition'; }
  protected dateLine(): string { const d = new Date(); return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · N° ' + (24000 + (d.getDate() * 37 + d.getMonth() * 11) % 999).toLocaleString('fr-FR'); }
  protected range(n: number): number[] { return Array.from({ length: n }, (_, i) => i); }
  protected cellsOf(page: number): number[] {
    let c = this.cellCache.get(page);
    if (!c) { const P = this.desk().pages[page]; c = this.range(P.w * P.h); this.cellCache.set(page, c); }
    return c;
  }
  protected placedOn(page: number): Placed[] { return this.desk().placed.filter(p => p.page === page); }
  protected fillOf(page: number): number { return occ(this.desk(), page).filter(c => c !== null).length; }
  protected rubLabel(r: Rub): string { return RUB_LABEL[r]; }
  protected rubIcon(r: Rub): string { return ({ sport: '🏉', culture: '🎬', monde: '🌍', faitsdivers: '🚨', people: '📸', sciences: '🔭', elections: '🗳️', affaire: '🗂️', economie: '🏭', societe: '👥', politique: '🏛️', maison: '📰' } as Record<Rub, string>)[r]; }
  protected kindLabel(s: Story): string { return s.cuts ? `${KINDS[s.kind].label} coupé${s.kind === 'photo' || s.kind === 'breve' || s.kind === 'ouverture' || s.kind === 'enquete' || s.kind === 'manchette' ? 'e' : ''}` : KINDS[s.kind].label; }
  protected srcLabel(s: Story): string { return s.pair !== undefined && s.src !== 'document' ? 'Source anonyme' : SRC[s.src].label; }
  protected srcStars(s: Story): number { return s.checked ? (s.truth && !(s.src === 'institut' && s.fragile) ? 3 : 1) : s.pair !== undefined ? 1 : SRC[s.src].stars; }
  protected starTxt(s: Story): string { return s.checked && s.src !== 'maison' ? (s.truth ? (s.src === 'institut' && s.fragile ? '⚠ fragile' : '✓') : '✗') : '●●●○○○'.slice(3 - this.srcStars(s), 6 - this.srcStars(s)); }
  protected sumInt(s: Story): number { return sum(s.int) * fresh(s, this.desk().t); }
  protected lineText(): string { return LINES[this.desk().line].text; }
  protected editionLine(): string { return this.desk().v === 'electoral' ? 'Spécial élections · Édition de la nuit' : this.desk().v === 'scandale' ? 'Édition spéciale · L’affaire Vasseur' : 'Quotidien national · Édition de 23 h 30'; }
  protected reachPct(i: number): number { const r = this.live().reach; const m = Math.max(12, ...r); return (r[i] / m) * 100; }
  protected canVerify(s: Story): boolean { return !s.checked && (isDubious(s) || s.src === 'institut'); }
  protected cost(k: keyof typeof COST): number { return costOf(this.desk(), COST[k]); }
  protected afford(k: keyof typeof COST): boolean { return canAfford(this.desk(), COST[k]); }
  protected zoneOf(p: Placed): number { return p.page === 0 ? (p.y < 2 ? 0 : 1) : 2; }
  protected zoneLabel(page: number, y: number): string { return page === 0 ? (y < 2 ? 'haut de Une' : y < 4 ? 'Une, au-dessus du pli' : 'bas de Une') : y < 2 ? 'haut de page' : 'bas de page'; }
  protected conflictOf(p: Placed): boolean { return lineConflict(this.desk().line, p.s, p.page, p.y); }
  protected fxOf(id: number): Fx[] { return this.fx().filter(f => f.sid === id); }

  protected badges(s: Story): string[] {
    const d = this.desk();
    const b: string[] = [];
    if (s.checked && !s.truth) b.push('✗');
    else if (s.checked && s.src !== 'maison' && s.src !== 'officiel') b.push('✓');
    if (s.accuse) b.push('diffam.');
    if (s.src === 'institut') b.push('estim.');
    if (lineConflict(d.line, s, 0, 0) || (d.line === 'people' && s.rub === 'people')) b.push('ligne');
    return b;
  }

  protected tagsOf(s: Story): { text: string; tone: string }[] {
    const d = this.desk();
    const t: { text: string; tone: string }[] = [];
    if (s.scoop) t.push({ text: '⭐ Scoop : il veut le haut de la Une', tone: 'good' });
    if (s.fixOf !== undefined) t.push({ text: '🔁 Remplace l’estimation dépassée (cadre rouge)', tone: 'bad' });
    if (s.stale) t.push({ text: '⚠ Chiffres dépassés : remplacez-les par le rectificatif', tone: 'bad' });
    if (s.checked && !s.truth) t.push({ text: '✗ Bidonnée : à jeter', tone: 'bad' });
    else if (s.checked && s.src === 'institut') t.push(s.fragile ? { text: '⚠ Estimation fragile', tone: 'bad' } : { text: '✓ Chiffres solides', tone: 'good' });
    else if (s.checked && isDubious(s)) t.push({ text: '✓ Vérifiée', tone: 'good' });
    else if (isDubious(s)) t.push({ text: s.accuse ? '⚖️ Accusation à vérifier' : '❓ À vérifier', tone: 'bad' });
    if (s.pair !== undefined) t.push({ text: '↔ Version contestée par une autre dépêche', tone: '' });
    if (s.ad) t.push({ text: 'Une : seulement sur les deux dernières lignes', tone: '' });
    if (s.edito) t.push({ text: 'Le rédacteur en chef tient à le voir imprimé', tone: '' });
    if (s.unlimited) t.push({ text: 'Bouche-trou à volonté, sans lecteurs', tone: '' });
    const P = this.sel()?.where === 'page' ? d.placed.find(p => p.s.id === s.id) : undefined;
    if (P && lineConflict(d.line, s, P.page, P.y)) t.push({ text: `📏 Contraire à la ligne : ${LINES[d.line].short}`, tone: 'bad' });
    else if (!P && (s.rub === 'people' ? d.line === 'people' : (d.line === 'fd_une' && s.rub === 'faitsdivers') || (d.line === 'sport_une' && s.rub === 'sport') || (d.line === 'elec_haut' && s.rub !== 'elections' && !s.ad && !s.filler && !s.edito)))
      t.push({ text: `📏 Ligne : ${LINES[d.line].short}`, tone: '' });
    if (!s.ad && !s.filler && !s.edito && s.exp < 1e8 && !P) t.push({ text: `⏳ fraîcheur ${Math.round(fresh(s, d.t) * 100)} % · quitte le fil à ${hhmm(s.exp)}`, tone: s.exp - d.t <= 20 ? 'bad' : '' });
    if (P) t.push({ text: `${d.pages[P.page].short}, ${this.zoneLabel(P.page, P.y)} · ${fmt(Math.round(sum(P.base) * weightOf(P.page, P.y, s.h)))} lecteurs`, tone: '' });
    return t;
  }

  protected cellLabel(x: number, y: number): string {
    const g = this.ghost();
    let s = `Colonne ${x + 1}, ligne ${y + 1}, vide`;
    if (this.okCells().has(y * this.desk().pages[this.tab()].w + x)) s += ', la dépêche choisie tient ici';
    if (g && g.page === this.tab() && x >= g.x && x < g.x + g.w && y >= g.y && y < g.y + g.h) s += g.err ? `, impossible : ${g.err}` : ', touchez encore pour placer';
    return s;
  }
  protected blockLabel(p: Placed): string {
    const s = p.s;
    const what = s.ad ? `Publicité ${s.ad}` : s.filler ? s.title : `${KINDS[s.kind].label} : ${s.title}`;
    return `${what}, ${s.w} sur ${s.h}${s.stale ? ', chiffres dépassés' : ''}${s.checked && !s.truth ? ', bidonnée' : ''}${this.fixTarget() === s.id ? ', touchez pour la remplacer par le rectificatif' : ''}`;
  }
  protected cardLabel(s: Story): string {
    return `${s.fixOf !== undefined ? 'Rectificatif' : s.scoop ? 'Scoop' : KINDS[s.kind].label} ${s.w} sur ${s.h} : ${s.ad ? 'publicité ' + s.ad : s.title}, ${Math.round(this.sumInt(s))} points, ${this.srcLabel(s)}`;
  }

  protected hint(): string {
    const d = this.desk();
    if (d.fil.some(s => s.fixOf !== undefined)) return '🔁 Un rectificatif attend dans le fil : touchez-le, puis l’estimation encadrée de rouge.';
    if (!d.placed.length) return `${this.brief.brief} Touchez une dépêche du fil, puis une case de la page : un aperçu s’affiche, touchez à nouveau pour la placer.`;
    if (d.deadline - d.t <= 30 && this.live().empty) return '⏰ Le bouclage approche : comblez les blancs (brèves, encadrés ❖, météo, mots fléchés).';
    return 'Touchez une dépêche puis une case ; touchez un article déjà en page pour le vérifier ou le retirer. ⏩ Attendre fait tomber les dépêches suivantes.';
  }

  /* ── Interaction ── */

  protected setTab(i: number): void { this.tab.set(i); if (this.aim()?.page !== i) this.aim.set(null); this.armed.set(false); }

  protected pick(id: number): void {
    if (this.over()) return;
    this.armed.set(false);
    if (this.sel()?.id === id) { this.sel.set(null); this.aim.set(null); return; }
    this.sel.set({ id, where: 'fil' });
    const s = this.desk().fil.find(z => z.id === id);
    // Un rectificatif : on montre la page où se trouve l'estimation dépassée
    if (s?.fixOf !== undefined) { const p = this.desk().placed.find(z => z.s.id === s.fixOf); if (p) this.tab.set(p.page); }
    const a = this.aim();
    if (a && a.page !== this.tab()) this.aim.set(null);
  }

  protected tapCell(x: number, y: number): void {
    if (this.over()) return;
    this.armed.set(false);
    const s = this.selStory();
    if (!s || this.sel()?.where !== 'fil') { this.sel.set(null); this.aim.set(null); return; }
    if (s.fixOf !== undefined) return;
    const g = this.ghost();
    if (g && !g.err && g.page === this.tab() && x >= g.x && x < g.x + g.w && y >= g.y && y < g.y + g.h) { this.confirm(); return; }
    this.aim.set({ page: this.tab(), x, y });
  }

  protected tapBlock(p: Placed): void {
    if (this.over()) return;
    this.armed.set(false);
    if (this.fixTarget() === p.s.id) { this.doSwap(this.sel()!.id); return; }
    if (this.sel()?.id === p.s.id) { this.sel.set(null); return; }
    this.sel.set({ id: p.s.id, where: 'page' });
    this.aim.set(null);
  }

  protected confirm(): void {
    const g = this.ghost();
    const s = this.selStory();
    if (!g || g.err || !s) return;
    const id = s.id;
    const val = Math.round(g.val);
    this.act(d => placeStory(d, id, g.page, g.x, g.y), d => {
      const placed = d.placed[d.placed.length - 1];
      if (!placed) return;
      this.fresh0.set(placed.s.id);
      if (!s.ad && !s.filler) this.pop(placed.s.id, `+${val}`, 'good');
      this.sel.set(s.unlimited ? { id, where: 'fil' } : null);
      this.aim.set(null);
    });
  }

  protected doRotate(id: number): void { this.act(d => rotateStory(d, id)); }
  protected doCut(id: number): void { this.act(d => cutStory(d, id), () => this.aim.set(this.aim() ? { ...this.aim()! } : null)); }
  protected doVerify(id: number): void { this.act(d => verifyStory(d, id), () => this.pop(id, '🔍', 'info')); }
  protected doSpike(id: number): void { this.act(d => spikeStory(d, id), () => { this.sel.set(null); this.aim.set(null); }); }
  protected doRemove(id: number): void { this.act(d => removePlaced(d, id), () => { this.sel.set(this.desk().fil.some(s => s.id === id) ? { id, where: 'fil' } : null); this.aim.set(null); }); }
  protected doSwap(id: number): void {
    const target = this.fixTarget();
    this.act(d => swapFix(d, id), () => { if (target !== null) { this.fresh0.set(id); this.pop(id, '🔁', 'good'); } this.sel.set(null); });
  }

  protected wait(): void {
    if (this.over()) return;
    this.armed.set(false);
    this.act(d => { waitTick(d); return null; });
  }

  protected print(): void {
    if (this.over()) return;
    if (this.live().empty && !this.armed()) { this.armed.set(true); return; }
    this.finish();
  }

  /** Applique une action sur une copie de la rédaction, puis met l'écran à jour */
  private act(op: (d: Desk) => string | null, after?: (d: Desk) => void): void {
    if (this.over()) return;
    const d = cloneDesk(this.desk());
    const err = op(d);
    if (err) { this.say({ text: `⛔ ${err}`, tone: 'bad' }); return; }
    const evs = d.events;
    d.events = [];
    this.desk.set(d);
    after?.(d);
    for (const e of evs) {
      this.say(e);
      if (e.tone === 'bad' && e.text.startsWith('🔁')) this.miss.emit();
    }
    // La sélection a pu disparaître (périmée, remplacée)
    if (this.sel() && !this.selStory()) { this.sel.set(null); this.aim.set(null); }
    this.emitProgress();
    if (d.over) this.finish();
  }

  /* ── Le bouclage ── */

  private finish(): void {
    if (this.over()) return;
    this.over.set(true);
    this.sel.set(null);
    this.aim.set(null);
    const d = this.desk();
    const sc = scoreDesk(d);
    this.final.set(sc);
    const r = sc.score;
    const hl = sc.headline?.s.title.replace(/^[A-ZÉÈÊÀ \-—]+ — /, '');
    this.message.set(
      sc.dementis.length >= 2 ? 'Les démentis pleuvent : la rédaction en chef convoque tout le monde à 9 h.'
        : sc.proces.length >= 2 ? 'Les avocats du ministre préparent déjà leurs plaintes.'
          : r >= 0.85 ? `Un numéro d’anthologie : « ${hl ?? 'la Une'} » s’arrache dès l’aube.`
            : r >= 0.65 ? `Bon numéro : « ${hl ?? 'la Une'} » fait le tour des kiosques.`
              : r >= 0.45 ? 'Un journal honnête, mais on a vu des Unes plus fortes.'
                : 'Un numéro raté : blancs, faux pas et lecteurs déçus.');
    if (sc.dementis.length) this.say({ text: `⚠️ ${sc.dementis.length} démenti${sc.dementis.length > 1 ? 's' : ''} à publier demain.`, tone: 'bad' });
    if (r < 0.45) this.miss.emit();
    this.progress.emit({ live: r, time: 0 });
    this.timers.push(setTimeout(() => this.done.emit(Math.max(0.05, r)), 2600));
  }

  private emitProgress(): void {
    const d = this.desk();
    this.progress.emit({ live: this.live().score, time: clamp(1 - d.t / d.deadline) });
  }

  private say(e: Ev): void { this.log.update(l => [{ ...e, text: plain(e.text) }, ...l].slice(0, 6)); }
  private pop(sid: number, text: string, tone: Fx['tone']): void {
    const f: Fx = { sid, text, tone, id: ++fxId };
    this.fx.update(a => [...a, f]);
    this.timers.push(setTimeout(() => this.fx.update(a => a.filter(z => z.id !== f.id)), 1100));
  }
}

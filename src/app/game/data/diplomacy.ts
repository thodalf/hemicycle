/* ============================================================
 *  Diplomatie en mini-jeux : les sommets (Conseil européen,
 *  G20, conférence sur le climat), où l'on négocie un texte
 *  article par article jusqu'à l'aube avec des dirigeants
 *  fictifs ; et les visites d'État (cadeau, menu, toast,
 *  programme), où un faux pas fait un incident diplomatique.
 *  Les dirigeants sont fictifs.
 * ============================================================ */

export type Axis = 'climat' | 'rigueur' | 'souverainete' | 'commerce' | 'social' | 'defense';

export interface Leader {
  name: string;
  title: string;
  country: string;
  flag: string;
  /** Sensibilité à chaque enjeu (−3 … +3) */
  profile: Partial<Record<Axis, number>>;
}

export interface ArticleOption {
  label: string;
  /** Intérêt pour la France (0 à 2) */
  france: number;
  /** Ce que l'option fait sur chaque enjeu */
  vec: Partial<Record<Axis, number>>;
}

export interface Article { title: string; options: ArticleOption[] }

export interface Summit {
  id: 'ue' | 'g20' | 'climat';
  title: string;
  place: string;
  leaders: Leader[];
  articles: Article[];
}

const L = (name: string, title: string, country: string, flag: string, profile: Leader['profile']): Leader => ({ name, title, country, flag, profile });
const o = (label: string, france: number, vec: ArticleOption['vec']): ArticleOption => ({ label, france, vec });

export const SUMMITS: Record<Summit['id'], Summit> = {
  ue: {
    id: 'ue', title: 'Conseil européen', place: 'Bruxelles, bâtiment Europa',
    leaders: [
      L('Ingrid Vogt', 'Chancelière', 'Allemagne', '🇩🇪', { rigueur: 2, climat: 1, commerce: 1 }),
      L('Marco Bellandi', 'Président du Conseil', 'Italie', '🇮🇹', { rigueur: -2, social: 1, souverainete: 1 }),
      L('Tomasz Wierzba', 'Premier ministre', 'Pologne', '🇵🇱', { defense: 2, climat: -2, souverainete: 1 }),
      L('Joost van Dalen', 'Premier ministre', 'Pays-Bas', '🇳🇱', { rigueur: 2, commerce: 2, social: -1 }),
      L('Gábor Kertész', 'Premier ministre', 'Hongrie', '🇭🇺', { souverainete: 3, climat: -1 }),
      L('Álvaro Ruiz', 'Président du gouvernement', 'Espagne', '🇪🇸', { social: 2, climat: 1, rigueur: -1 }),
    ],
    articles: [
      { title: 'Article 1 · Le grand emprunt européen', options: [o('Un emprunt commun de 800 milliards', 2, { rigueur: -2, social: 1, defense: 1 }), o('Un emprunt limité, sous conditions', 1, { rigueur: -1 }), o('Pas d’emprunt commun', 0, { rigueur: 2 })] },
      { title: 'Article 2 · La politique agricole commune', options: [o('Maintenir le budget de la PAC', 2, { rigueur: -1, souverainete: 1 }), o('Le réduire de 5 %', 1, { rigueur: 1 }), o('Le réduire de 15 % au profit de l’innovation', 0, { rigueur: 2, commerce: 1 })] },
      { title: 'Article 3 · La défense européenne', options: [o('Une force européenne permanente', 2, { defense: 2, souverainete: -2 }), o('Un fonds commun d’armement', 1, { defense: 1, rigueur: -1 }), o('La coopération au cas par cas', 0, { souverainete: 1 })] },
      { title: 'Article 4 · Le climat', options: [o('Neutralité carbone dès 2040', 1, { climat: 2, commerce: -1 }), o('L’objectif 2050 renforcé', 2, { climat: 1 }), o('Une pause réglementaire', 0, { climat: -2, commerce: 1 })] },
      { title: 'Article 5 · Les migrations', options: [o('Une répartition obligatoire des demandeurs d’asile', 1, { social: 1, souverainete: -2 }), o('Une solidarité flexible', 2, { souverainete: -1 }), o('Des contrôles nationaux renforcés', 0, { souverainete: 2, social: -1 })] },
      { title: 'Article 6 · Le commerce avec le Mercosur', options: [o('Ratifier l’accord tel quel', 0, { commerce: 2, climat: -1, souverainete: -1 }), o('Ratifier avec des clauses miroirs', 2, { commerce: 1, climat: 1 }), o('Geler l’accord', 1, { commerce: -2, souverainete: 1 })] },
      { title: 'Article 7 · L’intelligence artificielle', options: [o('Un champion européen financé en commun', 2, { rigueur: -1, souverainete: 1 }), o('Des règles communes, sans financement', 1, {}), o('Laisser faire les États', 0, { souverainete: 2 })] },
    ],
  },
  g20: {
    id: 'g20', title: 'Sommet du G20', place: 'Rio de Janeiro',
    leaders: [
      L('Ellen Whitaker', 'Présidente', 'États-Unis', '🇺🇸', { defense: 2, commerce: 1, climat: -1 }),
      L('Zhao Wenming', 'Président', 'Chine', '🇨🇳', { souverainete: 2, commerce: 2 }),
      L('Arjun Mehra', 'Premier ministre', 'Inde', '🇮🇳', { social: 1, climat: -1, souverainete: 1, commerce: 1 }),
      L('Rafael Moura', 'Président', 'Brésil', '🇧🇷', { climat: 1, social: 2, souverainete: 1 }),
      L('Haruto Kimura', 'Premier ministre', 'Japon', '🇯🇵', { commerce: 2, rigueur: 1, defense: 1 }),
      L('Nasser ben Fahd', 'Prince héritier', 'Arabie saoudite', '🇸🇦', { climat: -3, commerce: 1, souverainete: 1 }),
    ],
    articles: [
      { title: 'Article 1 · La taxe mondiale sur les milliardaires', options: [o('Un impôt minimum de 2 % sur les grandes fortunes', 2, { social: 2, commerce: -1 }), o('Une étude d’ici deux ans', 1, {}), o('Rien sur le sujet', 0, { commerce: 1, social: -1 })] },
      { title: 'Article 2 · Les énergies fossiles', options: [o('Sortie progressive d’ici 2050', 2, { climat: 2 }), o('« Transition » sans date', 1, { climat: 1 }), o('Pas de mention', 0, { climat: -2 })] },
      { title: 'Article 3 · Les droits de douane', options: [o('Un gel des nouvelles barrières', 1, { commerce: 2 }), o('Un dialogue commercial annuel', 2, { commerce: 1 }), o('Chacun protège ses industries', 0, { souverainete: 2, commerce: -2 })] },
      { title: 'Article 4 · La dette des pays pauvres', options: [o('Une annulation partielle', 2, { social: 2, rigueur: -2 }), o('Un rééchelonnement', 1, { rigueur: -1 }), o('Le statu quo', 0, { rigueur: 1 })] },
      { title: 'Article 5 · La sécurité maritime', options: [o('Une coalition navale commune', 2, { defense: 2, souverainete: -1 }), o('Un partage du renseignement', 1, { defense: 1 }), o('Rien de contraignant', 0, { souverainete: 1 })] },
      { title: 'Article 6 · La santé mondiale', options: [o('Un fonds mondial contre les pandémies', 2, { social: 1, rigueur: -1 }), o('Un réseau d’alerte précoce', 1, {}), o('Renvoyer à l’OMS', 0, { souverainete: 1 })] },
    ],
  },
  climat: {
    id: 'climat', title: 'Conférence mondiale sur le climat', place: 'Nairobi',
    leaders: [
      L('Ellen Whitaker', 'Présidente', 'États-Unis', '🇺🇸', { climat: -1, commerce: 1 }),
      L('Zhao Wenming', 'Président', 'Chine', '🇨🇳', { souverainete: 2, climat: 0, commerce: 1 }),
      L('Rafael Moura', 'Président', 'Brésil', '🇧🇷', { climat: 2, souverainete: 1, social: 1 }),
      L('Amina Odhiambo', 'Présidente', 'Kenya', '🇰🇪', { climat: 2, social: 2, rigueur: -1 }),
      L('Nasser ben Fahd', 'Prince héritier', 'Arabie saoudite', '🇸🇦', { climat: -3, commerce: 1 }),
      L('Sione Taufa', 'Premier ministre', 'Tonga', '🇹🇴', { climat: 3, social: 1 }),
    ],
    articles: [
      { title: 'Article 1 · L’objectif de réchauffement', options: [o('Rester sous 1,5 °C', 2, { climat: 2, commerce: -1 }), o('« Bien en dessous de 2 °C »', 1, { climat: 1 }), o('Pas d’objectif chiffré', 0, { climat: -2 })] },
      { title: 'Article 2 · Le fonds pour les pertes et dommages', options: [o('100 milliards par an', 1, { social: 2, rigueur: -2 }), o('Un fonds abondé volontairement', 2, { social: 1 }), o('Pas de fonds', 0, { rigueur: 1, social: -1 })] },
      { title: 'Article 3 · Le charbon', options: [o('Fermeture des centrales d’ici 2035', 2, { climat: 2, souverainete: -1 }), o('Pas de nouvelle centrale', 1, { climat: 1 }), o('Rien', 0, { climat: -1, souverainete: 1 })] },
      { title: 'Article 4 · Les forêts tropicales', options: [o('Déforestation zéro en 2030, avec compensation', 2, { climat: 2, souverainete: -1 }), o('Des objectifs nationaux volontaires', 1, { souverainete: 1 }), o('Pas de mention', 0, { climat: -1 })] },
      { title: 'Article 5 · Le nucléaire', options: [o('Reconnu comme énergie bas-carbone', 2, { climat: 1, souverainete: 1 }), o('Laissé au choix de chaque pays', 1, { souverainete: 1 }), o('Exclu des financements verts', 0, { climat: 1, souverainete: -1 })] },
      { title: 'Article 6 · La transparence', options: [o('Des inspections internationales', 1, { climat: 1, souverainete: -2 }), o('Des rapports nationaux annuels', 2, {}), o('Pas de contrôle', 0, { souverainete: 2, climat: -1 })] },
    ],
  },
};

/* ── Visites d'État ────────────────────────────────────────── */

export type VisitTag = 'horloge' | 'alcool' | 'art' | 'sport' | 'culture' | 'luxe' | 'cheval' | 'boeuf' | 'porc' | 'fruitsdemer' | 'vegetarien' | 'agneau' | 'fromage'
  | 'droits' | 'commerce' | 'histoire' | 'climat' | 'faste' | 'industrie' | 'foule' | 'patrimoine' | 'jeunesse' | 'sobriete';

export interface VisitOption { label: string; tags: VisitTag[] }
export interface VisitStep { title: string; options: VisitOption[] }
export interface Guest { name: string; title: string; country: string; flag: string; likes: VisitTag[]; dislikes: VisitTag[]; hints: string[] }

const vo = (label: string, ...tags: VisitTag[]): VisitOption => ({ label, tags });

export const VISIT_STEPS: VisitStep[] = [
  { title: 'Le cadeau officiel', options: [
    vo('Une pendule Louis XVI', 'horloge', 'art'), vo('Un grand cru de Bordeaux', 'alcool', 'luxe'), vo('Un vase de la manufacture de Sèvres', 'art'),
    vo('Un maillot dédicacé de l’équipe de France', 'sport'), vo('Une édition originale de Victor Hugo', 'culture', 'histoire'), vo('Une selle de la Garde républicaine', 'cheval', 'luxe'),
  ] },
  { title: 'Le menu du dîner d’État', options: [
    vo('Filet de bœuf de Charolles', 'boeuf'), vo('Homard bleu de Bretagne', 'fruitsdemer', 'luxe'), vo('Menu végétarien de saison', 'vegetarien', 'sobriete'),
    vo('Gigot d’agneau de Sisteron', 'agneau'), vo('Jambon persillé et plateau de fromages, vins de Bourgogne', 'porc', 'fromage', 'alcool'),
  ] },
  { title: 'Le thème de votre toast', options: [
    vo('Les droits de l’homme et la liberté de la presse', 'droits'), vo('Les grands contrats entre nos deux pays', 'commerce'), vo('Notre histoire commune', 'histoire'),
    vo('L’urgence climatique', 'climat'), vo('Le sport, qui rassemble les peuples', 'sport'),
  ] },
  { title: 'Le programme du lendemain', options: [
    vo('Une soirée au château de Versailles', 'faste', 'patrimoine'), vo('La visite d’une usine aéronautique à Toulouse', 'industrie', 'commerce'), vo('Un bain de foule sur le Vieux-Port de Marseille', 'foule'),
    vo('Le Mont-Saint-Michel au lever du jour', 'patrimoine'), vo('La rencontre d’élèves d’un lycée de banlieue', 'jeunesse'),
  ] },
];

export const GUESTS: Guest[] = [
  { name: 'Arjun Mehra', title: 'Premier ministre', country: 'Inde', flag: '🇮🇳', likes: ['vegetarien', 'industrie', 'culture', 'commerce'], dislikes: ['boeuf', 'alcool'],
    hints: ['Il est strictement végétarien et ne boit pas d’alcool.', 'Il vient chercher des contrats industriels.'] },
  { name: 'Zhao Wenming', title: 'Président', country: 'Chine', flag: '🇨🇳', likes: ['commerce', 'faste', 'art', 'luxe'], dislikes: ['horloge', 'droits'],
    hints: ['En Chine, offrir une pendule évoque la mort.', 'Le sujet des libertés publiques fâchera la délégation.'] },
  { name: 'Nasser ben Fahd', title: 'Prince héritier', country: 'Arabie saoudite', flag: '🇸🇦', likes: ['cheval', 'faste', 'luxe', 'commerce'], dislikes: ['alcool', 'porc', 'droits'],
    hints: ['Ni alcool ni porc à table.', 'Grand amateur de chevaux et de prestige.'] },
  { name: 'Haruto Kimura', title: 'Premier ministre', country: 'Japon', flag: '🇯🇵', likes: ['art', 'patrimoine', 'culture', 'histoire'], dislikes: ['foule'],
    hints: ['Il apprécie l’artisanat d’exception et la discrétion.', 'Les bains de foule le mettent mal à l’aise.'] },
  { name: 'Ellen Whitaker', title: 'Présidente', country: 'États-Unis', flag: '🇺🇸', likes: ['histoire', 'industrie', 'commerce'], dislikes: ['fruitsdemer', 'climat'],
    hints: ['Elle cite La Fayette dans chaque discours.', 'Elle est allergique aux fruits de mer.'] },
  { name: 'Rafael Moura', title: 'Président', country: 'Brésil', flag: '🇧🇷', likes: ['sport', 'climat', 'foule', 'jeunesse'], dislikes: ['faste'],
    hints: ['Fou de football.', 'Il trouve le faste des palais « un peu ridicule ».'] },
  { name: 'Ingrid Vogt', title: 'Chancelière', country: 'Allemagne', flag: '🇩🇪', likes: ['industrie', 'climat', 'sobriete'], dislikes: ['faste', 'luxe'],
    hints: ['Elle déteste les dépenses ostentatoires.', 'Elle veut parler industrie et transition énergétique.'] },
  { name: 'Leïla Benjelloun', title: 'Cheffe du gouvernement', country: 'Maroc', flag: '🇲🇦', likes: ['histoire', 'patrimoine', 'commerce', 'jeunesse'], dislikes: ['alcool', 'porc'],
    hints: ['Pas d’alcool ni de porc à sa table.', 'Elle est attachée à l’histoire partagée et à la jeunesse.'] },
];

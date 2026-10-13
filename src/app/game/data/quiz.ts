/* ============================================================
 *  « Trivial politique » : six catégories, un camembert par
 *  catégorie. La première réponse de chaque liste est la bonne
 *  (l'ordre est mélangé à l'affichage).
 * ============================================================ */

export interface QuizCategory { id: string; label: string; color: string; icon: string }
export interface QuizQuestion { cat: string; q: string; a: [string, string, string, string]; note?: string }

export const QUIZ_CATEGORIES: QuizCategory[] = [
  { id: 'institutions', label: 'Institutions', color: '#2f6fb3', icon: '🏛️' },
  { id: 'histoire', label: 'Histoire', color: '#e0b324', icon: '📜' },
  { id: 'geo', label: 'Géographie', color: '#2e9a5b', icon: '🗺️' },
  { id: 'eco', label: 'Économie & société', color: '#d9672b', icon: '💶' },
  { id: 'monde', label: 'Europe & monde', color: '#8a4fb5', icon: '🌍' },
  { id: 'culture', label: 'Culture politique', color: '#d94f8a', icon: '🎙️' },
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  // Institutions
  { cat: 'institutions', q: 'Combien de députés siègent à l’Assemblée nationale ?', a: ['577', '348', '600', '925'] },
  { cat: 'institutions', q: 'Combien de sénateurs compte le Sénat ?', a: ['348', '577', '300', '450'] },
  { cat: 'institutions', q: 'Quelle est la durée du mandat présidentiel depuis 2002 ?', a: ['5 ans', '7 ans', '6 ans', '4 ans'] },
  { cat: 'institutions', q: 'Pour combien d’années un sénateur est-il élu ?', a: ['6 ans', '5 ans', '9 ans', '4 ans'] },
  { cat: 'institutions', q: 'Quel article permet d’adopter un texte sans vote, sauf motion de censure ?', a: ['Le 49.3', 'L’article 16', 'L’article 89', 'L’article 11'] },
  { cat: 'institutions', q: 'Quel article donne des pouvoirs exceptionnels au président en cas de crise grave ?', a: ['L’article 16', 'Le 49.3', 'L’article 5', 'L’article 34'] },
  { cat: 'institutions', q: 'Où se réunit le Parlement convoqué en Congrès ?', a: ['À Versailles', 'Au Palais Bourbon', 'Au Palais du Luxembourg', 'À l’Élysée'] },
  { cat: 'institutions', q: 'Combien de membres nommés siègent au Conseil constitutionnel ?', a: ['9', '12', '7', '15'] },
  { cat: 'institutions', q: 'Où siège le Sénat ?', a: ['Au Palais du Luxembourg', 'Au Palais Bourbon', 'À l’hôtel de Matignon', 'Au Palais-Royal'] },
  { cat: 'institutions', q: 'Combien de parrainages d’élus faut-il pour être candidat à l’élection présidentielle ?', a: ['500', '100', '1 000', '250'] },
  // Histoire
  { cat: 'histoire', q: 'En quelle année la Ve République a-t-elle été fondée ?', a: ['1958', '1946', '1962', '1968'] },
  { cat: 'histoire', q: 'Qui fut le premier président de la Ve République ?', a: ['Charles de Gaulle', 'René Coty', 'Georges Pompidou', 'Vincent Auriol'] },
  { cat: 'histoire', q: 'En quelle année les Françaises obtiennent-elles le droit de vote ?', a: ['1944', '1918', '1936', '1958'] },
  { cat: 'histoire', q: 'En quelle année est votée la loi de séparation des Églises et de l’État ?', a: ['1905', '1789', '1881', '1946'] },
  { cat: 'histoire', q: 'En quelle année la peine de mort est-elle abolie en France ?', a: ['1981', '1968', '1974', '1995'] },
  { cat: 'histoire', q: 'Qui a porté la loi de 1975 sur l’interruption volontaire de grossesse ?', a: ['Simone Veil', 'Gisèle Halimi', 'Robert Badinter', 'Édith Cresson'] },
  { cat: 'histoire', q: 'Quelle République est proclamée en septembre 1870 ?', a: ['La IIIe', 'La IIe', 'La IVe', 'La Ire'] },
  { cat: 'histoire', q: 'En quelle année le Front populaire arrive-t-il au pouvoir ?', a: ['1936', '1924', '1945', '1914'] },
  { cat: 'histoire', q: 'Qui fut la première femme Première ministre en France ?', a: ['Édith Cresson', 'Simone Veil', 'Ségolène Royal', 'Martine Aubry'] },
  { cat: 'histoire', q: 'Quel président est élu en mai 1981 ?', a: ['François Mitterrand', 'Valéry Giscard d’Estaing', 'Jacques Chirac', 'Georges Pompidou'] },
  // Géographie
  { cat: 'geo', q: 'Combien de régions compte la France métropolitaine depuis 2016 ?', a: ['13', '22', '18', '12'] },
  { cat: 'geo', q: 'Quelle est la préfecture de la Gironde ?', a: ['Bordeaux', 'Arcachon', 'Libourne', 'Pau'] },
  { cat: 'geo', q: 'Quel est le plus long fleuve entièrement français ?', a: ['La Loire', 'La Seine', 'Le Rhône', 'La Garonne'] },
  { cat: 'geo', q: 'Quel est le point culminant de la France ?', a: ['Le mont Blanc', 'Le Vignemale', 'Le mont Ventoux', 'La Barre des Écrins'] },
  { cat: 'geo', q: 'Quel est le numéro du département de Paris ?', a: ['75', '92', '77', '01'] },
  { cat: 'geo', q: 'Quel est le chef-lieu de la région Grand Est ?', a: ['Strasbourg', 'Metz', 'Reims', 'Nancy'] },
  { cat: 'geo', q: 'Combien de départements et régions d’outre-mer compte la France ?', a: ['5', '3', '7', '9'] },
  { cat: 'geo', q: 'Quelle est la préfecture du Nord ?', a: ['Lille', 'Dunkerque', 'Valenciennes', 'Roubaix'] },
  { cat: 'geo', q: 'Quel département porte le numéro 2A ?', a: ['La Corse-du-Sud', 'La Haute-Corse', 'L’Aisne', 'Les Alpes-Maritimes'] },
  { cat: 'geo', q: 'Quel est le chef-lieu de la région Bretagne ?', a: ['Rennes', 'Brest', 'Nantes', 'Quimper'] },
  // Économie & société
  { cat: 'eco', q: 'Que signifie SMIC ?', a: ['Salaire minimum interprofessionnel de croissance', 'Salaire moyen indexé sur la consommation', 'Seuil minimal d’imposition commun', 'Salaire mensuel indexé de carrière'] },
  { cat: 'eco', q: 'Quelle était la monnaie de la France avant l’euro ?', a: ['Le franc', 'La livre', 'L’écu', 'Le louis'] },
  { cat: 'eco', q: 'En quelle année les pièces et billets en euros entrent-ils en circulation ?', a: ['2002', '1999', '1992', '2005'] },
  { cat: 'eco', q: 'Que signifie TVA ?', a: ['Taxe sur la valeur ajoutée', 'Taxe sur les ventes annuelles', 'Tarif de vente agréé', 'Taxe variable d’activité'] },
  { cat: 'eco', q: 'Quelle est la durée légale du travail hebdomadaire depuis les lois Aubry ?', a: ['35 heures', '39 heures', '32 heures', '40 heures'] },
  { cat: 'eco', q: 'Quel organisme publie les chiffres officiels de l’inflation et du chômage ?', a: ['L’Insee', 'La Cour des comptes', 'Le Conseil d’État', 'L’Urssaf'] },
  { cat: 'eco', q: 'Qui vote le budget de l’État ?', a: ['Le Parlement', 'Le Conseil constitutionnel', 'La Cour des comptes', 'Le Conseil d’État'] },
  { cat: 'eco', q: 'Que mesure le PIB ?', a: ['La richesse produite dans un pays en un an', 'La dette publique', 'Le pouvoir d’achat moyen', 'Les exportations'] },
  // Europe & monde
  { cat: 'monde', q: 'Combien de membres permanents compte le Conseil de sécurité de l’ONU ?', a: ['5', '7', '10', '15'] },
  { cat: 'monde', q: 'Où le Parlement européen tient-il ses sessions plénières ?', a: ['À Strasbourg', 'À Bruxelles', 'À Luxembourg', 'À Francfort'] },
  { cat: 'monde', q: 'Combien d’États membres compte l’Union européenne depuis 2020 ?', a: ['27', '28', '25', '30'] },
  { cat: 'monde', q: 'Quel traité fonde la Communauté économique européenne en 1957 ?', a: ['Le traité de Rome', 'Le traité de Maastricht', 'Le traité de Lisbonne', 'Le traité de Paris'] },
  { cat: 'monde', q: 'Où siège la Banque centrale européenne ?', a: ['À Francfort', 'À Bruxelles', 'À Paris', 'À Luxembourg'] },
  { cat: 'monde', q: 'Où siège l’OTAN ?', a: ['À Bruxelles', 'À Genève', 'À Washington', 'À Vienne'] },
  { cat: 'monde', q: 'Où se trouve le siège de l’ONU ?', a: ['À New York', 'À Genève', 'À Washington', 'À La Haye'] },
  { cat: 'monde', q: 'Quel pays a quitté l’Union européenne en 2020 ?', a: ['Le Royaume-Uni', 'La Norvège', 'La Suisse', 'Le Danemark'] },
  { cat: 'monde', q: 'Combien d’étoiles figurent sur le drapeau européen ?', a: ['12', '27', '15', '10'] },
  // Culture politique
  { cat: 'culture', q: 'Où réside le Premier ministre ?', a: ['À l’hôtel de Matignon', 'Au palais de l’Élysée', 'Au Quai d’Orsay', 'À Bercy'] },
  { cat: 'culture', q: 'Que désigne « le perchoir » ?', a: ['Le fauteuil du président de l’Assemblée', 'La tribune des journalistes', 'Le banc des ministres', 'Le balcon de l’Élysée'] },
  { cat: 'culture', q: 'Que sont les « QAG » ?', a: ['Les questions au gouvernement', 'Les quotas d’accès au gouvernement', 'Les questions d’actualité générale', 'Les quorums de l’Assemblée'] },
  { cat: 'culture', q: 'Quelle est la devise de la République ?', a: ['Liberté, Égalité, Fraternité', 'Travail, Famille, Patrie', 'Unité, Justice, Progrès', 'Paix, Ordre, Liberté'] },
  { cat: 'culture', q: 'Qui a composé La Marseillaise ?', a: ['Rouget de Lisle', 'Hector Berlioz', 'Jean-Baptiste Lully', 'Victor Hugo'] },
  { cat: 'culture', q: 'Quel événement le 14 Juillet commémore-t-il d’abord ?', a: ['La prise de la Bastille', 'La fin de la Grande Guerre', 'La Libération de Paris', 'Le sacre de Napoléon'] },
  { cat: 'culture', q: 'Qu’est-ce qu’un candidat « parachuté » ?', a: ['Un candidat sans attaches dans la circonscription', 'Un candidat qui se retire au dernier moment', 'Un candidat sans parti', 'Un ancien militaire candidat'] },
  { cat: 'culture', q: 'Quel animal est un symbole de la France ?', a: ['Le coq', 'L’aigle', 'Le lion', 'L’ours'] },
  { cat: 'culture', q: 'Quelle figure symbolise la République française ?', a: ['Marianne', 'Jeanne d’Arc', 'Athéna', 'Clio'] },
];

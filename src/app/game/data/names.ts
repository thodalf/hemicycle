/* ============================================================
 *  Générateur de noms : chaque partie a son propre casting.
 *  Des centaines de prénoms et de noms de famille, des prénoms
 *  composés, des noms à rallonge, quelques particules ; tirés
 *  à partir de la graine de la partie, sans doublon.
 * ============================================================ */

export type NameGender = 'f' | 'm';

const FIRST_F = [
  'Adèle', 'Agathe', 'Agnès', 'Aïcha', 'Albane', 'Alice', 'Aline', 'Amandine', 'Amélie', 'Anaïs', 'Andréa', 'Angèle', 'Annabelle', 'Anne', 'Apolline',
  'Ariane', 'Armelle', 'Aude', 'Aurélie', 'Axelle', 'Bérénice', 'Bernadette', 'Blanche', 'Brigitte', 'Camille', 'Capucine', 'Carole', 'Cécile', 'Céline',
  'Chantal', 'Charlotte', 'Chloé', 'Christine', 'Claire', 'Clara', 'Clémence', 'Clotilde', 'Colette', 'Coralie', 'Corinne', 'Delphine', 'Diane', 'Dominique',
  'Éléonore', 'Élisabeth', 'Élise', 'Elsa', 'Émilie', 'Emma', 'Estelle', 'Eugénie', 'Eva', 'Fanny', 'Farida', 'Fatou', 'Flavie', 'Florence', 'Françoise',
  'Gaëlle', 'Garance', 'Geneviève', 'Hélène', 'Hortense', 'Hélia', 'Inès', 'Iris', 'Isabelle', 'Jeanne', 'Joséphine', 'Judith', 'Julie', 'Juliette',
  'Karima', 'Laetitia', 'Laure', 'Laurence', 'Léa', 'Leïla', 'Léonie', 'Lina', 'Lise', 'Louise', 'Lucie', 'Lydia', 'Madeleine', 'Maëlle', 'Malika',
  'Manon', 'Marguerite', 'Marianne', 'Marine', 'Marion', 'Marthe', 'Mathilde', 'Maud', 'Mélanie', 'Mireille', 'Monique', 'Myriam', 'Nadia', 'Naïma',
  'Nathalie', 'Noémie', 'Nora', 'Océane', 'Odile', 'Ophélie', 'Pascale', 'Pauline', 'Perrine', 'Rachida', 'Rose', 'Roxane', 'Sabine', 'Salomé', 'Samia',
  'Sandrine', 'Sarah', 'Ségolène', 'Séverine', 'Solène', 'Sonia', 'Sophie', 'Suzanne', 'Sylvie', 'Valentine', 'Valérie', 'Victoire', 'Violette',
  'Virginie', 'Yasmina', 'Yasmine', 'Yvonne', 'Zoé', 'Zohra', 'Awa', 'Mariam', 'Ninon', 'Constance', 'Bertille', 'Hermine', 'Sixtine',
];

const FIRST_M = [
  'Adrien', 'Alain', 'Alban', 'Alexandre', 'Amaury', 'Ambroise', 'Antoine', 'Armand', 'Arnaud', 'Arthur', 'Aurélien', 'Augustin', 'Axel', 'Baptiste',
  'Basile', 'Bastien', 'Benoît', 'Bertrand', 'Bruno', 'Cédric', 'Charles', 'Christophe', 'Clément', 'Corentin', 'Cyril', 'Damien', 'Daniel', 'David',
  'Denis', 'Didier', 'Dimitri', 'Édouard', 'Émile', 'Emmanuel', 'Éric', 'Étienne', 'Eudes', 'Fabien', 'Fabrice', 'Félix', 'Florent', 'François',
  'Frédéric', 'Gabriel', 'Gaël', 'Gaspard', 'Gauthier', 'Geoffroy', 'Gérald', 'Gilles', 'Grégoire', 'Guillaume', 'Gustave', 'Hadrien', 'Henri', 'Hervé',
  'Hugo', 'Ibrahim', 'Jacques', 'Jérôme', 'Joachim', 'Jonathan', 'Joseph', 'Jules', 'Julien', 'Karim', 'Kevin', 'Lazare', 'Léon', 'Léonard', 'Loïc',
  'Louis', 'Luc', 'Lucas', 'Ludovic', 'Malik', 'Marc', 'Marcel', 'Martin', 'Mathias', 'Mathieu', 'Maxime', 'Mehdi', 'Michel', 'Mohamed', 'Mounir',
  'Nathan', 'Nicolas', 'Noël', 'Octave', 'Olivier', 'Omar', 'Pascal', 'Patrice', 'Paul', 'Philippe', 'Pierre', 'Quentin', 'Raphaël', 'Rémi', 'Renaud',
  'Robin', 'Rodolphe', 'Romain', 'Samir', 'Samuel', 'Sébastien', 'Simon', 'Stanislas', 'Stéphane', 'Sylvain', 'Thibault', 'Thierry', 'Thomas',
  'Timothée', 'Tristan', 'Valentin', 'Victor', 'Vincent', 'Xavier', 'Yanis', 'Yann', 'Yves', 'Youssef', 'Zacharie', 'Mamadou', 'Ousmane', 'Côme', 'Hippolyte',
];

const COMPOSED_F = ['Anne', 'Marie', 'Louise', 'Claire', 'Sophie', 'Laure', 'Hélène'];
const COMPOSED_M = ['Jean', 'Pierre', 'Paul', 'Louis', 'Charles', 'François', 'Marc', 'Henri'];

const LAST = [
  'Abadie', 'Achard', 'Allard', 'Amrani', 'Andrieu', 'Arnaud', 'Aubert', 'Aubry', 'Audibert', 'Auger', 'Baron', 'Barre', 'Barthélémy', 'Bastide', 'Baudin',
  'Bazin', 'Belkacem', 'Bellanger', 'Benamar', 'Benard', 'Benhamou', 'Bernier', 'Berthelot', 'Besson', 'Blanchard', 'Blondel', 'Boissier', 'Bonnet',
  'Bouchard', 'Boulanger', 'Bourdon', 'Bourgeois', 'Boyer', 'Brahimi', 'Brunet', 'Buisson', 'Caillaud', 'Camus', 'Carpentier', 'Carré', 'Castel', 'Cazenave',
  'Chabert', 'Chapuis', 'Charpentier', 'Chauvin', 'Chevalier', 'Clément', 'Colas', 'Collet', 'Cordier', 'Cornu', 'Cosson', 'Coulibaly', 'Courtois',
  'Cousin', 'Couturier', 'Daniel', 'Daumas', 'Delage', 'Delattre', 'Delmas', 'Deschamps', 'Devaux', 'Diallo', 'Didier', 'Dufour', 'Dumas', 'Dupré',
  'Duval', 'Etienne', 'Fabre', 'Fauvel', 'Ferrand', 'Ferreira', 'Fleury', 'Fontaine', 'Fournier', 'Gaillard', 'Garcia', 'Gauthier', 'Germain', 'Gilbert',
  'Giraud', 'Godard', 'Gomez', 'Grenier', 'Guérin', 'Guillot', 'Haddad', 'Hamel', 'Hardy', 'Hébert', 'Hoarau', 'Hubert', 'Humbert', 'Imbert', 'Jacob',
  'Jacquet', 'Joly', 'Jourdan', 'Julien', 'Kahn', 'Keita', 'Kessler', 'Klein', 'Labbé', 'Lacombe', 'Lacroix', 'Laffitte', 'Lagarde', 'Lambert', 'Langlois',
  'Laporte', 'Larcher', 'Laurent', 'Lebon', 'Leblanc', 'Lebrun', 'Leclerc', 'Lecomte', 'Lefort', 'Le Gall', 'Legrand', 'Lejeune', 'Lemoine', 'Leroux',
  'Lesage', 'Lévêque', 'Lopez', 'Loubet', 'Maillard', 'Mallet', 'Marchal', 'Marchand', 'Marechal', 'Martel', 'Martineau', 'Masson', 'Mathieu', 'Maury',
  'Meunier', 'Michaud', 'Millet', 'Moreau', 'Morin', 'Mouret', 'Navarro', 'Nicolas', 'Noël', 'Ollivier', 'Olivier', 'Ouali', 'Pages', 'Paris', 'Pasquier',
  'Payet', 'Pelletier', 'Perrot', 'Petitjean', 'Picard', 'Pichon', 'Poirier', 'Poulain', 'Prévost', 'Raynaud', 'Renard', 'Rey', 'Richard', 'Rigaud',
  'Rivière', 'Robin', 'Roche', 'Rolland', 'Roussel', 'Royer', 'Sabatier', 'Saidi', 'Salmon', 'Sanchez', 'Sauvage', 'Schmitt', 'Schneider', 'Simonet',
  'Tessier', 'Texier', 'Thibault', 'Tissot', 'Toussaint', 'Traoré', 'Valette', 'Vallet', 'Vasseur', 'Verdier', 'Vidal', 'Vigneron', 'Villeneuve',
  'Vincent', 'Weber', 'Le Bihan', 'Le Goff', 'Kerjean', 'Quéré', 'Ferrandi', 'Santoni', 'Casanova', 'Etcheverry', 'Larrieu', 'Mazet', 'Bourdieu',
  'Ménard', 'Rouvier', 'Sarrazin', 'Delcourt', 'Montagnac', 'Lemaire', 'Pradel', 'Achour', 'Marchetti', 'Ferhat', 'Benali', 'Hamon', 'Castaing',
];
const PARTICLE = ['Saint-Aubin', 'Valmy', 'La Rochère', 'Montfort', 'Villiers', 'Courcelles', 'Boisrenard', 'Marsac', 'Kerguelen', 'Lestang'];

/** Petit générateur pseudo-aléatoire indépendant (mulberry32), pour tirer des noms sans toucher au hasard de la partie */
export function nameRng(seed: number, salt: string): () => number {
  let h = seed >>> 0;
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 2654435761) >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Next = () => number;
const pick = <T>(next: Next, list: readonly T[]): T => list[Math.floor(next() * list.length)];

/** Un nom complet : prénom (parfois composé), nom (parfois double ou à particule) */
export function personName(next: Next, gender?: NameGender): string {
  const g = gender ?? (next() < 0.5 ? 'f' : 'm');
  const pool = g === 'f' ? FIRST_F : FIRST_M;
  let first = pick(next, pool);
  if (next() < 0.1) first = `${pick(next, g === 'f' ? COMPOSED_F : COMPOSED_M)}-${first}`;
  let last = pick(next, LAST);
  const r = next();
  if (r < 0.07) last = `${last}-${pick(next, LAST)}`;
  else if (r < 0.1) last = `de ${pick(next, PARTICLE)}`;
  return `${first} ${last}`;
}

/** Un nom qui n'est pas déjà pris dans la partie */
export function uniqueName(next: Next, taken: Iterable<string>, gender?: NameGender): string {
  const set = new Set(taken);
  for (let k = 0; k < 40; k++) {
    const n = personName(next, gender);
    if (!set.has(n)) return n;
  }
  return `${personName(next, gender)} ${Math.floor(next() * 90) + 10}`;
}

/** Le genre probable d'un prénom (pour accorder les textes) */
export function genderOf(name: string): NameGender | null {
  const first = name.split(' ')[0].split('-').at(-1) ?? '';
  if (FIRST_F.includes(first)) return 'f';
  if (FIRST_M.includes(first)) return 'm';
  return null;
}

/** Prénom seul, pour la famille */
export function firstName(next: Next, gender: NameGender): string {
  return pick(next, gender === 'f' ? FIRST_F : FIRST_M);
}

export function lastName(next: Next): string {
  return pick(next, LAST);
}

/** Un vivier de noms propre à la partie (Premiers ministres possibles, hauts fonctionnaires…) */
export function namePool(seed: number, salt: string, count: number): string[] {
  const next = nameRng(seed, salt);
  const out: string[] = [];
  while (out.length < count) out.push(uniqueName(next, out));
  return out;
}

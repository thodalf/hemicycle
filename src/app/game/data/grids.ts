import { REGION_NAMES, RegionCode, normalize } from './departements';
import { VILLES, Ville } from './grid-villes';
import { STATIONS, Station } from './grid-metro';
import { CAPITALES, Capitale } from './grid-capitales';

/* ============================================================
 *  Grilles façon Metrodoku : trois bases de données (villes de
 *  France, stations du métro parisien, capitales du monde) et un
 *  générateur de grilles 3 × 3 jouables (chaque case a au moins
 *  une réponse, et la grille se remplit sans doublon).
 * ============================================================ */

export type GridSetId = 'villes' | 'metro' | 'capitales';

/** Un élément proposé au joueur */
export interface GridItem {
  key: string;
  /** Réponse affichée dans la case */
  name: string;
  /** Petit texte sous le nom (code, lignes, pays) */
  tag: string;
  /** Clés de recherche normalisées */
  search: string[];
  /** Données d'origine, pour les critères */
  data: Ville | Station | Capitale;
}

export interface GridCrit {
  id: string;
  label: string;
  /** Pastille de lisibilité (numéro de ligne) et sa couleur */
  badge?: string;
  color?: string;
  /** Deux critères du même groupe ne se croisent pas */
  group: string;
  test: (x: GridItem) => boolean;
}

export interface GridSet {
  id: GridSetId;
  corner: string;
  placeholder: string;
  /** Ce qu'on cherche, pour les messages (« pas en … ») */
  noun: string;
  items: GridItem[];
  rows: GridCrit[];
  cols: GridCrit[];
  /** Réponses minimales par case */
  minPerCell: number;
}

export interface Grid { set: GridSet; rows: GridCrit[]; cols: GridCrit[]; answers: GridItem[][][] }

const initial = (s: string) => normalize(s.replace(/^(le |la |les |l’|l')/i, ''))[0] ?? 'a';
const multiWord = (s: string) => /[-\s’']/.test(s.trim());

/* ── Villes de France ──────────────────────────────────────── */

const v = (x: GridItem) => x.data as Ville;
const villes: GridSet = {
  id: 'villes', corner: '🇫🇷', placeholder: 'Nom de la ville', noun: 'ville',
  items: VILLES.map(x => ({ key: `${x.name}-${x.dep}`, name: x.name, tag: x.dep, search: [normalize(x.name)], data: x })),
  rows: (Object.keys(REGION_NAMES) as RegionCode[]).map(r => ({ id: `r-${r}`, label: REGION_NAMES[r], group: 'region', test: (x: GridItem) => v(x).region === r })),
  cols: [
    { id: 'coast', label: 'Au bord de la mer', group: 'coast', test: x => v(x).coast },
    { id: 'inland', label: 'Loin de la mer', group: 'coast', test: x => !v(x).coast },
    { id: 'border', label: 'Département frontalier', group: 'border', test: x => v(x).border },
    { id: 'pref', label: 'Préfecture', group: 'pref', test: x => v(x).prefecture },
    { id: 'notpref', label: 'Pas une préfecture', group: 'pref', test: x => !v(x).prefecture },
    { id: 'big', label: 'Plus de 100 000 habitants', group: 'pop', test: x => v(x).pop >= 100000 },
    { id: 'mid', label: 'De 20 000 à 100 000 habitants', group: 'pop', test: x => v(x).pop >= 20000 && v(x).pop < 100000 },
    { id: 'small', label: 'Moins de 20 000 habitants', group: 'pop', test: x => v(x).pop < 20000 },
    { id: 'river', label: 'Sur un fleuve (Seine, Loire, Rhône, Garonne, Rhin)', group: 'river', test: x => ['Seine', 'Loire', 'Rhône', 'Garonne', 'Rhin'].includes(v(x).river ?? '') },
    { id: 'saint', label: 'Nom avec « Saint » ou « Sainte »', group: 'words', test: x => /\bSainte?\b/.test(v(x).name) },
    { id: 'multi', label: 'Nom en plusieurs mots', group: 'words', test: x => multiWord(v(x).name) },
    { id: 'single', label: 'Nom en un seul mot', group: 'words', test: x => !multiWord(v(x).name) },
    { id: 'atol', label: 'Initiale de A à L', group: 'initial', test: x => initial(v(x).name) <= 'l' },
    { id: 'mtoz', label: 'Initiale de M à Z', group: 'initial', test: x => initial(v(x).name) >= 'm' },
  ],
  minPerCell: 2,
};

/* ── Métro parisien ────────────────────────────────────────── */

const st = (x: GridItem) => x.data as Station;
type L = Station['lines'][number];
/** Les lignes décrites par leur tracé, sans jamais donner leur numéro */
const LINE_LABELS: [L, string][] = [
  ['1', 'Sur l’axe historique La Défense ↔ Château de Vincennes'],
  ['2', 'Sur la ligne des boulevards du Nord, de Dauphine à Nation'],
  ['3', 'Sur la ligne Pont de Levallois ↔ Gallieni'],
  ['4', 'Sur l’axe nord-sud Clignancourt ↔ Bagneux'],
  ['5', 'Sur la ligne Bobigny ↔ Place d’Italie'],
  ['6', 'Sur la ligne aérienne de l’Étoile à Nation par le sud'],
  ['7', 'Sur la ligne La Courneuve ↔ Villejuif / Ivry'],
  ['8', 'Sur la ligne Balard ↔ Créteil'],
  ['9', 'Sur la ligne Pont de Sèvres ↔ Montreuil'],
  ['10', 'Sur la ligne rive gauche Boulogne ↔ Austerlitz'],
  ['11', 'Sur la ligne Châtelet ↔ Rosny, par les Lilas'],
  ['12', 'Sur la ligne Issy ↔ Aubervilliers, par Montmartre'],
  ['13', 'Sur la ligne Châtillon ↔ Saint-Denis / Asnières'],
  ['14', 'Sur la ligne sans conducteur Pleyel ↔ Orly'],
];
const TERMINI = new Set(['La Défense', 'Château de Vincennes', 'Porte Dauphine', 'Nation', 'Pont de Levallois – Bécon', 'Gallieni',
  'Porte de Clignancourt', 'Bagneux – Lucie Aubrac', 'Bobigny – Pablo Picasso', 'Place d\'Italie', 'Charles de Gaulle – Étoile',
  'La Courneuve – 8 Mai 1945', 'Villejuif – Louis Aragon', 'Mairie d\'Ivry', 'Balard', 'Pointe du Lac', 'Pont de Sèvres',
  'Mairie de Montreuil', 'Boulogne – Pont de Saint-Cloud', 'Gare d\'Austerlitz', 'Châtelet', 'Rosny-Bois-Perrier', 'Mairie d\'Issy',
  'Mairie d\'Aubervilliers', 'Châtillon – Montrouge', 'Saint-Denis – Université', 'Les Courtilles', 'Saint-Denis – Pleyel',
  'Aéroport d\'Orly', 'Gambetta', 'Porte des Lilas', 'Louis Blanc', 'Pré-Saint-Gervais']);
const BANLIEUE = new Set(['Aéroport d\'Orly', 'Anatole France', 'Aubervilliers – Pantin – Quatre Chemins', 'Bagneux – Lucie Aubrac', 'Barbara',
  'Basilique de Saint-Denis', 'Bérault', 'Billancourt', 'Bobigny – Pablo Picasso', 'Bobigny – Pantin – Raymond Queneau', 'Boulogne – Jean Jaurès',
  'Boulogne – Pont de Saint-Cloud', 'Carrefour Pleyel', 'Charenton – Écoles', 'Châtillon – Montrouge', 'Chevilly-Larue', 'Corentin Celton',
  'Coteaux Beauclair', 'Créteil – L\'Échat', 'Créteil – Préfecture', 'Créteil – Université', 'Croix de Chavaux', 'École Vétérinaire de Maisons-Alfort',
  'Église de Pantin', 'Esplanade de la Défense', 'Fort d\'Aubervilliers', 'Front Populaire', 'Gabriel Péri', 'Gallieni', 'Garibaldi', 'Hôpital Bicêtre',
  'Hoche', 'La Courneuve – 8 Mai 1945', 'La Défense', 'La Dhuys', 'Le Kremlin-Bicêtre', 'Les Agnettes', 'Les Courtilles', 'Les Sablons',
  'Liberté', 'Louise Michel', 'Mairie d\'Aubervilliers', 'Mairie d\'Issy', 'Mairie d\'Ivry', 'Mairie de Clichy', 'Mairie de Montreuil',
  'Mairie de Montrouge', 'Mairie de Saint-Ouen', 'Mairie des Lilas', 'Maisons-Alfort – Les Juilliottes', 'Maisons-Alfort – Stade',
  'Malakoff – Étienne Dolet', 'Malakoff – Plateau de Vanves', 'Marcel Sembat', 'Montreuil – Hôpital', 'Pierre et Marie Curie', 'Pointe du Lac',
  'Pont de Levallois – Bécon', 'Pont de Neuilly', 'Pont de Sèvres', 'Robespierre', 'Romainville – Carnot', 'Rosny-Bois-Perrier', 'Saint-Denis – Pleyel',
  'Saint-Denis – Porte de Paris', 'Saint-Denis – Université', 'Saint-Mandé', 'Saint-Ouen', 'Serge Gainsbourg', 'Thiais – Orly',
  'Villejuif – Gustave Roussy', 'Villejuif – Léo Lagrange', 'Villejuif – Louis Aragon', 'Villejuif – Paul Vaillant-Couturier', 'Château de Vincennes',
  'L\'Haÿ-les-Roses', 'Aimé Césaire', 'Bobigny – Pablo Picasso']);
const GRANDES_GARES = new Set(['Gare du Nord', 'Gare de l\'Est', 'Gare de Lyon', 'Gare d\'Austerlitz', 'Saint-Lazare', 'Montparnasse – Bienvenüe',
  'Havre – Caumartin', 'Magenta', 'La Chapelle', 'Bercy', 'Haussmann']);
const PERSONNES = /Césaire|Dumas|Anatole|Barbara|Bolivar|Michels|de Gaulle|Fabien|Corentin|Dupleix|Duroc|Quinet|Étienne Marcel|Exelmans|Faidherbe|Falguière|Félix Faure|Roosevelt|Péri|Gallieni|Gambetta|Garibaldi|George V|Goncourt|Môquet|Hoche|Bonsergent|Jasmin|Jaurès|Joffrin|Jussieu|Kléber|Lamarck|Ledru|Louis Blanc|Louise Michel|Mabillon|Malesherbes|Sembat|Dormoy|Bizot|Mirabeau|Miromesnil|Mouton|Oberkampf|Parmentier|Pasteur|Pereire|Pernety|Philippe Auguste|Curie|Raspail|Richard-Lenoir|Richelieu|Robespierre|Rambuteau|Gainsbourg|Victor Hugo|Voltaire|Boucicaut|Cambronne|Daumesnil|Dugommier|Bréguet|Lucie Aubrac|Picasso|Queneau|Aragon|Vaillant|Roussy|Lagrange|Citroën|Mitterrand|Daubenton|Clemenceau|Diderot|Caulaincourt|Bienvenüe|Dolet|Carnot|Chardon-Lagache|Lemoine|Michel-Ange|Molitor|Brochant|Lourmel|Estienne|Sully|Froissart|Pierre/;
const BATAILLES = /Alma|Austerlitz|Bir-Hakeim|Campo-Formio|Crimée|Iéna|Wagram|Solférino|Pyramides|Rivoli|Stalingrad|Sébastopol|Malakoff|Buzenval|Trocadéro|Marengo|Magenta/;
const AUTO: L[] = ['1', '4', '14'];
/** Couleurs des lignes, pour la pastille */
const LINE_COLORS: Record<string, string> = { '1': '#FFCD00', '2': '#003CA6', '3': '#837902', '4': '#CF009E', '5': '#FF7E2E', '6': '#6ECA97', '7': '#FA9ABA',
  '8': '#E19BDF', '9': '#B6BD00', '10': '#C9910D', '11': '#704B1C', '12': '#007852', '13': '#6EC4E8', '14': '#62259D' };
const even = (l: L) => parseInt(l, 10) % 2 === 0;
const metro: GridSet = {
  id: 'metro', corner: 'Ⓜ', placeholder: 'Nom de la station', noun: 'station',
  items: STATIONS.map(x => ({ key: x.name, name: x.name, tag: '', search: [normalize(x.name)], data: x })),
  rows: LINE_LABELS.map(([l, label]) => ({ id: `l-${l}`, label, badge: l, color: LINE_COLORS[l], group: `line-${l}`, test: (x: GridItem) => st(x).lines.includes(l) })),
  cols: [
    ...LINE_LABELS.map(([l, label]) => ({ id: `c-${l}`, label: label.replace(/^Sur /, 'Aussi sur '), badge: l, color: LINE_COLORS[l], group: `line-${l}`, test: (x: GridItem) => st(x).lines.includes(l) && st(x).lines.length >= 2 })),
    { id: 'rer', label: 'Correspondance avec le RER', group: 'rer', test: x => st(x).rer.length > 0 },
    { id: 'norer', label: 'Aucune correspondance RER', group: 'rer', test: x => st(x).rer.length === 0 },
    { id: 'hub', label: 'Nœud d’au moins 3 lignes de métro', group: 'count', test: x => st(x).lines.length >= 3 },
    { id: 'two', label: 'Exactement 2 lignes de métro', group: 'count', test: x => st(x).lines.length === 2 },
    { id: 'one', label: 'Desservie par une seule ligne', group: 'count', test: x => st(x).lines.length === 1 },
    { id: 'terminus', label: 'Terminus d’au moins une ligne', group: 'terminus', test: x => TERMINI.has(st(x).name) },
    { id: 'banlieue', label: 'Hors de Paris intra-muros', group: 'where', test: x => BANLIEUE.has(st(x).name) },
    { id: 'gare', label: 'Dessert une grande gare parisienne', group: 'gare', test: x => GRANDES_GARES.has(st(x).name) || /^Gare\b/.test(st(x).name) },
    { id: 'auto', label: 'Sur une ligne automatique, sans conducteur', group: 'auto', test: x => st(x).lines.some(l => AUTO.includes(l)) },
    { id: 'pairs', label: 'Toutes ses lignes ont un numéro pair', group: 'parity', test: x => st(x).lines.every(even) },
    { id: 'impairs', label: 'Toutes ses lignes ont un numéro impair', group: 'parity', test: x => st(x).lines.every(l => !even(l)) },
    { id: 'perso', label: 'Porte le nom d’une personnalité (hors saints)', group: 'words', test: x => PERSONNES.test(st(x).name) },
    { id: 'bataille', label: 'Évoque une bataille, une victoire ou un traité', group: 'words', test: x => BATAILLES.test(st(x).name) },
    { id: 'porte', label: 'Une « Porte » de Paris', group: 'words', test: x => /^Porte\b/.test(st(x).name) },
    { id: 'saint', label: 'Nom avec « Saint » ou « Sainte »', group: 'words', test: x => /\bSainte?\b/.test(st(x).name) },
    { id: 'lieu', label: 'Commence par Place, Pont, Quai, Rue ou Avenue', group: 'words', test: x => /^(Place|Pont|Quai|Rue|Avenue)\b/.test(st(x).name) },
    { id: 'double', label: 'Double nom (avec un « – »)', group: 'dash', test: x => /–/.test(st(x).name) },
    { id: 'oneword', label: 'Nom en un seul mot', group: 'dash', test: x => !multiWord(st(x).name) },
  ],
  minPerCell: 1,
};

/* ── Capitales du monde ────────────────────────────────────── */

const k = (x: GridItem) => x.data as Capitale;
const CONTINENTS: Capitale['continent'][] = ['Europe', 'Afrique', 'Asie', 'Amérique du Nord', 'Amérique du Sud', 'Océanie'];
const capitales: GridSet = {
  id: 'capitales', corner: '🌍', placeholder: 'Capitale (ou pays)', noun: 'capitale',
  items: CAPITALES.map(x => ({ key: x.country, name: x.capital, tag: x.country, search: [normalize(x.capital), normalize(x.country)], data: x })),
  rows: CONTINENTS.map(c => ({ id: `k-${c}`, label: c, group: 'continent', test: (x: GridItem) => k(x).continent === c })),
  cols: [
    { id: 'landlocked', label: 'Pays sans accès à la mer', group: 'sea', test: x => k(x).landlocked },
    { id: 'island', label: 'Pays insulaire', group: 'sea', test: x => k(x).island },
    { id: 'coastal', label: 'Capitale au bord de la mer', group: 'coast', test: x => k(x).coastalCapital },
    { id: 'south', label: 'Capitale dans l’hémisphère Sud', group: 'south', test: x => k(x).south },
    { id: 'french', label: 'Le français y est langue officielle', group: 'french', test: x => k(x).french },
    { id: 'million', label: 'Capitale de plus d’un million d’habitants', group: 'pop', test: x => k(x).pop >= 1000000 },
    { id: 'smallcap', label: 'Capitale de moins de 300 000 habitants', group: 'pop', test: x => k(x).pop < 300000 },
    { id: 'atol', label: 'Capitale de A à L', group: 'initial', test: x => initial(k(x).capital) <= 'l' },
    { id: 'mtoz', label: 'Capitale de M à Z', group: 'initial', test: x => initial(k(x).capital) >= 'm' },
    { id: 'multi', label: 'Capitale en plusieurs mots', group: 'words', test: x => multiWord(k(x).capital) },
    { id: 'samename', label: 'Même initiale que le pays', group: 'letter', test: x => initial(k(x).capital) === initial(k(x).country) },
  ],
  minPerCell: 2,
};

export const GRID_SETS: Record<GridSetId, GridSet> = { villes, metro, capitales };

/** Une affectation sans doublon existe-t-elle pour les 9 cases ? */
function solvable(answers: GridItem[][][]): boolean {
  const cells = answers.flat();
  const used = new Set<string>();
  const order = cells.map((_, i) => i).sort((a, b) => cells[a].length - cells[b].length);
  const go = (n: number): boolean => {
    if (n === order.length) return true;
    for (const x of cells[order[n]]) {
      if (used.has(x.key)) continue;
      used.add(x.key);
      if (go(n + 1)) return true;
      used.delete(x.key);
    }
    return false;
  };
  return go(0);
}

/** Une grille 3 × 3 jouable */
export function makeGrid(id: GridSetId, rand: () => number = Math.random): Grid {
  const set = GRID_SETS[id];
  const shuffle = <T,>(a: T[]) => [...a].sort(() => rand() - 0.5);
  let best: Grid | null = null;
  for (let tries = 0; tries < 800; tries++) {
    const rows = shuffle(set.rows).slice(0, 3);
    const groups = new Set(rows.map(r => r.group));
    const cols = shuffle(set.cols).filter(c => (groups.has(c.group) ? false : (groups.add(c.group), true))).slice(0, 3);
    if (cols.length < 3) continue;
    const answers = rows.map(r => cols.map(c => set.items.filter(x => r.test(x) && c.test(x))));
    if (answers.some(row => row.some(cell => cell.length < set.minPerCell))) continue;
    if (!solvable(answers)) continue;
    const grid = { set, rows, cols, answers };
    // Préférer des grilles variées : au moins une case plus difficile
    if (answers.flat().some(cell => cell.length <= 4) || tries > 400) return grid;
    best ??= grid;
  }
  if (best) return best;
  // Repli : les trois premières lignes et des critères simples
  const rows = set.rows.slice(0, 3);
  const cols = set.cols.filter((c, i, a) => a.findIndex(o => o.group === c.group) === i && !rows.some(r => r.group === c.group)).slice(0, 3);
  return { set, rows, cols, answers: rows.map(r => cols.map(c => set.items.filter(x => r.test(x) && c.test(x)))) };
}

/** Reconstruit une grille sauvegardée à partir des identifiants de critères */
export function gridFromIds(id: GridSetId, rowIds: string[], colIds: string[]): Grid | null {
  const set = GRID_SETS[id];
  const rows = rowIds.map(r => set.rows.find(x => x.id === r));
  const cols = colIds.map(c => set.cols.find(x => x.id === c));
  if (rows.some(r => !r) || cols.some(c => !c) || rows.length !== 3 || cols.length !== 3) return null;
  const R = rows as GridCrit[], C = cols as GridCrit[];
  return { set, rows: R, cols: C, answers: R.map(r => C.map(c => set.items.filter(x => r.test(x) && c.test(x)))) };
}

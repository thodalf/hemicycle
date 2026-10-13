/* ============================================================
 *  Les départements de France métropolitaine, pour la grille
 *  « Départodoku » : région, préfecture, littoral, frontière.
 * ============================================================ */

export type RegionCode = 'ARA' | 'BFC' | 'BRE' | 'CVL' | 'COR' | 'GES' | 'HDF' | 'IDF' | 'NOR' | 'NAQ' | 'OCC' | 'PDL' | 'PAC';

export const REGION_NAMES: Record<RegionCode, string> = {
  ARA: 'Auvergne-Rhône-Alpes', BFC: 'Bourgogne-Franche-Comté', BRE: 'Bretagne', CVL: 'Centre-Val de Loire', COR: 'Corse',
  GES: 'Grand Est', HDF: 'Hauts-de-France', IDF: 'Île-de-France', NOR: 'Normandie', NAQ: 'Nouvelle-Aquitaine',
  OCC: 'Occitanie', PDL: 'Pays de la Loire', PAC: 'Provence-Alpes-Côte d’Azur',
};

export interface Departement {
  code: string;
  name: string;
  region: RegionCode;
  prefecture: string;
  /** Bordé par la mer */
  coast: boolean;
  /** Frontière terrestre avec un autre pays */
  border: boolean;
  /** Sa préfecture est aussi chef-lieu de région */
  regionCapital?: boolean;
}

const d = (code: string, name: string, region: RegionCode, prefecture: string, coast = false, border = false, regionCapital = false): Departement =>
  ({ code, name, region, prefecture, coast, border, ...(regionCapital ? { regionCapital } : {}) });

export const DEPARTEMENTS: Departement[] = [
  d('01', 'Ain', 'ARA', 'Bourg-en-Bresse', false, true),
  d('02', 'Aisne', 'HDF', 'Laon', false, true),
  d('03', 'Allier', 'ARA', 'Moulins'),
  d('04', 'Alpes-de-Haute-Provence', 'PAC', 'Digne-les-Bains', false, true),
  d('05', 'Hautes-Alpes', 'PAC', 'Gap', false, true),
  d('06', 'Alpes-Maritimes', 'PAC', 'Nice', true, true),
  d('07', 'Ardèche', 'ARA', 'Privas'),
  d('08', 'Ardennes', 'GES', 'Charleville-Mézières', false, true),
  d('09', 'Ariège', 'OCC', 'Foix', false, true),
  d('10', 'Aube', 'GES', 'Troyes'),
  d('11', 'Aude', 'OCC', 'Carcassonne', true),
  d('12', 'Aveyron', 'OCC', 'Rodez'),
  d('13', 'Bouches-du-Rhône', 'PAC', 'Marseille', true, false, true),
  d('14', 'Calvados', 'NOR', 'Caen', true),
  d('15', 'Cantal', 'ARA', 'Aurillac'),
  d('16', 'Charente', 'NAQ', 'Angoulême'),
  d('17', 'Charente-Maritime', 'NAQ', 'La Rochelle', true),
  d('18', 'Cher', 'CVL', 'Bourges'),
  d('19', 'Corrèze', 'NAQ', 'Tulle'),
  d('2A', 'Corse-du-Sud', 'COR', 'Ajaccio', true, false, true),
  d('2B', 'Haute-Corse', 'COR', 'Bastia', true),
  d('21', 'Côte-d’Or', 'BFC', 'Dijon', false, false, true),
  d('22', 'Côtes-d’Armor', 'BRE', 'Saint-Brieuc', true),
  d('23', 'Creuse', 'NAQ', 'Guéret'),
  d('24', 'Dordogne', 'NAQ', 'Périgueux'),
  d('25', 'Doubs', 'BFC', 'Besançon', false, true),
  d('26', 'Drôme', 'ARA', 'Valence'),
  d('27', 'Eure', 'NOR', 'Évreux', true),
  d('28', 'Eure-et-Loir', 'CVL', 'Chartres'),
  d('29', 'Finistère', 'BRE', 'Quimper', true),
  d('30', 'Gard', 'OCC', 'Nîmes', true),
  d('31', 'Haute-Garonne', 'OCC', 'Toulouse', false, true, true),
  d('32', 'Gers', 'OCC', 'Auch'),
  d('33', 'Gironde', 'NAQ', 'Bordeaux', true, false, true),
  d('34', 'Hérault', 'OCC', 'Montpellier', true),
  d('35', 'Ille-et-Vilaine', 'BRE', 'Rennes', true, false, true),
  d('36', 'Indre', 'CVL', 'Châteauroux'),
  d('37', 'Indre-et-Loire', 'CVL', 'Tours'),
  d('38', 'Isère', 'ARA', 'Grenoble'),
  d('39', 'Jura', 'BFC', 'Lons-le-Saunier', false, true),
  d('40', 'Landes', 'NAQ', 'Mont-de-Marsan', true),
  d('41', 'Loir-et-Cher', 'CVL', 'Blois'),
  d('42', 'Loire', 'ARA', 'Saint-Étienne'),
  d('43', 'Haute-Loire', 'ARA', 'Le Puy-en-Velay'),
  d('44', 'Loire-Atlantique', 'PDL', 'Nantes', true, false, true),
  d('45', 'Loiret', 'CVL', 'Orléans', false, false, true),
  d('46', 'Lot', 'OCC', 'Cahors'),
  d('47', 'Lot-et-Garonne', 'NAQ', 'Agen'),
  d('48', 'Lozère', 'OCC', 'Mende'),
  d('49', 'Maine-et-Loire', 'PDL', 'Angers'),
  d('50', 'Manche', 'NOR', 'Saint-Lô', true),
  d('51', 'Marne', 'GES', 'Châlons-en-Champagne'),
  d('52', 'Haute-Marne', 'GES', 'Chaumont'),
  d('53', 'Mayenne', 'PDL', 'Laval'),
  d('54', 'Meurthe-et-Moselle', 'GES', 'Nancy', false, true),
  d('55', 'Meuse', 'GES', 'Bar-le-Duc', false, true),
  d('56', 'Morbihan', 'BRE', 'Vannes', true),
  d('57', 'Moselle', 'GES', 'Metz', false, true),
  d('58', 'Nièvre', 'BFC', 'Nevers'),
  d('59', 'Nord', 'HDF', 'Lille', true, true, true),
  d('60', 'Oise', 'HDF', 'Beauvais'),
  d('61', 'Orne', 'NOR', 'Alençon'),
  d('62', 'Pas-de-Calais', 'HDF', 'Arras', true),
  d('63', 'Puy-de-Dôme', 'ARA', 'Clermont-Ferrand'),
  d('64', 'Pyrénées-Atlantiques', 'NAQ', 'Pau', true, true),
  d('65', 'Hautes-Pyrénées', 'OCC', 'Tarbes', false, true),
  d('66', 'Pyrénées-Orientales', 'OCC', 'Perpignan', true, true),
  d('67', 'Bas-Rhin', 'GES', 'Strasbourg', false, true, true),
  d('68', 'Haut-Rhin', 'GES', 'Colmar', false, true),
  d('69', 'Rhône', 'ARA', 'Lyon', false, false, true),
  d('70', 'Haute-Saône', 'BFC', 'Vesoul'),
  d('71', 'Saône-et-Loire', 'BFC', 'Mâcon'),
  d('72', 'Sarthe', 'PDL', 'Le Mans'),
  d('73', 'Savoie', 'ARA', 'Chambéry', false, true),
  d('74', 'Haute-Savoie', 'ARA', 'Annecy', false, true),
  d('75', 'Paris', 'IDF', 'Paris', false, false, true),
  d('76', 'Seine-Maritime', 'NOR', 'Rouen', true, false, true),
  d('77', 'Seine-et-Marne', 'IDF', 'Melun'),
  d('78', 'Yvelines', 'IDF', 'Versailles'),
  d('79', 'Deux-Sèvres', 'NAQ', 'Niort'),
  d('80', 'Somme', 'HDF', 'Amiens', true),
  d('81', 'Tarn', 'OCC', 'Albi'),
  d('82', 'Tarn-et-Garonne', 'OCC', 'Montauban'),
  d('83', 'Var', 'PAC', 'Toulon', true),
  d('84', 'Vaucluse', 'PAC', 'Avignon'),
  d('85', 'Vendée', 'PDL', 'La Roche-sur-Yon', true),
  d('86', 'Vienne', 'NAQ', 'Poitiers'),
  d('87', 'Haute-Vienne', 'NAQ', 'Limoges'),
  d('88', 'Vosges', 'GES', 'Épinal'),
  d('89', 'Yonne', 'BFC', 'Auxerre'),
  d('90', 'Territoire de Belfort', 'BFC', 'Belfort', false, true),
  d('91', 'Essonne', 'IDF', 'Évry-Courcouronnes'),
  d('92', 'Hauts-de-Seine', 'IDF', 'Nanterre'),
  d('93', 'Seine-Saint-Denis', 'IDF', 'Bobigny'),
  d('94', 'Val-de-Marne', 'IDF', 'Créteil'),
  d('95', 'Val-d’Oise', 'IDF', 'Cergy'),
];

/** Pour comparer une saisie : sans accents, sans tirets ni apostrophes, en minuscules */
export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export interface GridCriterion {
  id: string;
  label: string;
  /** Deux critères du même groupe ne se croisent pas */
  group: string;
  test: (x: Departement) => boolean;
}

const num = (x: Departement) => (/^\d+$/.test(x.code) ? Number(x.code) : NaN);
const multiWord = (x: Departement) => /[-\s’']/.test(x.name);
const initial = (x: Departement) => normalize(x.name)[0];

/** Lignes : des régions */
export const ROW_CRITERIA: GridCriterion[] = (['ARA', 'BFC', 'BRE', 'CVL', 'GES', 'HDF', 'IDF', 'NOR', 'NAQ', 'OCC', 'PDL', 'PAC'] as RegionCode[])
  .map(r => ({ id: `r-${r}`, label: REGION_NAMES[r], group: 'region', test: (x: Departement) => x.region === r }));

/** Colonnes : des propriétés */
export const COL_CRITERIA: GridCriterion[] = [
  { id: 'coast', label: 'Bordé par la mer', group: 'coast', test: x => x.coast },
  { id: 'inland', label: 'Sans accès à la mer', group: 'coast', test: x => !x.coast },
  { id: 'border', label: 'Frontalier d’un autre pays', group: 'border', test: x => x.border },
  { id: 'even', label: 'Numéro pair', group: 'parity', test: x => num(x) % 2 === 0 },
  { id: 'odd', label: 'Numéro impair', group: 'parity', test: x => num(x) % 2 === 1 },
  { id: 'low', label: 'Numéro de 01 à 40', group: 'range', test: x => num(x) <= 40 },
  { id: 'high', label: 'Numéro de 41 à 95', group: 'range', test: x => num(x) >= 41 },
  { id: 'multi', label: 'Nom en plusieurs mots', group: 'words', test: multiWord },
  { id: 'single', label: 'Nom en un seul mot', group: 'words', test: x => !multiWord(x) },
  { id: 'atol', label: 'Initiale de A à L', group: 'initial', test: x => initial(x) <= 'l' },
  { id: 'mtoz', label: 'Initiale de M à Z', group: 'initial', test: x => initial(x) >= 'm' },
  { id: 'capital', label: 'Préfecture = chef-lieu de région', group: 'capital', test: x => !!x.regionCapital },
];

export interface Grid { rows: GridCriterion[]; cols: GridCriterion[]; answers: Departement[][][] }

/** Une grille 3 × 3 jouable : au moins deux réponses par case, et une solution sans doublon */
export function makeGrid(rand: () => number = Math.random): Grid {
  const shuffle = <T,>(a: T[]) => [...a].sort(() => rand() - 0.5);
  for (let tries = 0; tries < 500; tries++) {
    const rows = shuffle(ROW_CRITERIA).slice(0, 3);
    const groups = new Set<string>();
    const cols = shuffle(COL_CRITERIA).filter(c => (groups.has(c.group) ? false : (groups.add(c.group), true))).slice(0, 3);
    const answers = rows.map(r => cols.map(c => DEPARTEMENTS.filter(x => r.test(x) && c.test(x))));
    if (answers.some(row => row.some(cell => cell.length < 2))) continue;
    // Chaque ligne doit pouvoir se remplir sans réutiliser un département
    const solvable = answers.every(row => row[0].some(a => row[1].some(b => b !== a && row[2].some(c => c !== a && c !== b))));
    if (solvable) return { rows, cols, answers };
  }
  // Repli sûr
  const rows = ROW_CRITERIA.filter(r => ['r-OCC', 'r-NAQ', 'r-GES'].includes(r.id));
  const cols = COL_CRITERIA.filter(c => ['even', 'border', 'single'].includes(c.id));
  return { rows, cols, answers: rows.map(r => cols.map(c => DEPARTEMENTS.filter(x => r.test(x) && c.test(x)))) };
}

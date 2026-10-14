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
const LINES: Station['lines'][number][] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'];
const metro: GridSet = {
  id: 'metro', corner: 'Ⓜ', placeholder: 'Nom de la station', noun: 'station',
  items: STATIONS.map(x => ({ key: x.name, name: x.name, tag: `M ${x.lines.join(' · ')}${x.rer.length ? ` · RER ${x.rer.join('')}` : ''}`, search: [normalize(x.name)], data: x })),
  rows: LINES.map(l => ({ id: `l-${l}`, label: `Ligne ${l}`, group: `line-${l}`, test: (x: GridItem) => st(x).lines.includes(l) })),
  cols: [
    ...LINES.map(l => ({ id: `c-${l}`, label: `Ligne ${l}`, group: `line-${l}`, test: (x: GridItem) => st(x).lines.includes(l) })),
    { id: 'rer', label: 'Correspondance RER', group: 'rer', test: x => st(x).rer.length > 0 },
    { id: 'hub', label: 'Au moins 3 lignes de métro', group: 'hub', test: x => st(x).lines.length >= 3 },
    { id: 'porte', label: 'Une « Porte » de Paris', group: 'words', test: x => /^Porte\b/.test(st(x).name) },
    { id: 'saint', label: 'Nom avec « Saint » ou « Sainte »', group: 'words', test: x => /\bSainte?\b/.test(st(x).name) },
    { id: 'mairie', label: 'Nom avec « Mairie »', group: 'words', test: x => /\bMairie\b/.test(st(x).name) },
    { id: 'atol', label: 'Initiale de A à L', group: 'initial', test: x => initial(st(x).name) <= 'l' },
    { id: 'mtoz', label: 'Initiale de M à Z', group: 'initial', test: x => initial(st(x).name) >= 'm' },
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

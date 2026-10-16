import { Component, HostListener, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/* ============================================================
 *  « La règle est la règle » : un casse-tête à la Baba Is You.
 *  Les règles du niveau sont des mots posés sur le plateau ;
 *  on les pousse pour former ou briser des phrases
 *  (NOM EST PROPRIÉTÉ, NOM EST NOM), lues de gauche à droite et
 *  de haut en bas. Trois décors : l’Hémicycle, le Ministère et
 *  la Campagne, chacun avec ses niveaux.
 * ============================================================ */

/* ── Moteur de règles (fonctions pures, testées hors Angular) ── */

export type Prop = 'toi' | 'gagne' | 'stop' | 'pousse' | 'ouvre' | 'ferme' | 'coule' | 'defait' | 'chaud' | 'fond';
export type Noun = 'depute' | 'ministre' | 'candidat' | 'mur' | 'siege' | 'loi' | 'amendement' | 'porte' | 'cle' | 'marais' | 'presse'
  | 'tampon' | 'guichet' | 'dossier' | 'broyeur' | 'cafe' | 'urne' | 'votant' | 'affiche' | 'boue' | 'drapeau' | 'tract';
export type Op = 'est' | 'et';
export type Word = Noun | Prop | Op;
/** Un objet du plateau : un sprite (k = nom) ou un mot (k = 'w:' + mot) */
export interface Obj { id: number; k: string; x: number; y: number }
export interface State { w: number; h: number; objs: Obj[]; next: number }
export interface Rule { s: Noun; o: Noun | Prop }
/** 0 haut, 1 droite, 2 bas, 3 gauche */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

export const PROPS: Prop[] = ['toi', 'gagne', 'stop', 'pousse', 'ouvre', 'ferme', 'coule', 'defait', 'chaud', 'fond'];
export const NOUNS: Noun[] = ['depute', 'ministre', 'candidat', 'mur', 'siege', 'loi', 'amendement', 'porte', 'cle', 'marais', 'presse',
  'tampon', 'guichet', 'dossier', 'broyeur', 'cafe', 'urne', 'votant', 'affiche', 'boue', 'drapeau', 'tract'];
const PROP_SET = new Set<string>(PROPS);
const NOUN_SET = new Set<string>(NOUNS);
export const isWord = (k: string) => k.charCodeAt(0) === 119 && k.charCodeAt(1) === 58; // 'w:'
export const wordOf = (k: string) => k.slice(2) as Word;
export const isNoun = (w: string): w is Noun => NOUN_SET.has(w);
export const isProp = (w: string): w is Prop => PROP_SET.has(w);

/**
 * Lit toutes les phrases du plateau, horizontalement (gauche → droite) et verticalement (haut → bas) :
 * NOM (ET NOM)* EST (NOM|PROPRIÉTÉ) (ET (NOM|PROPRIÉTÉ))*.
 * `used` reçoit les cases dont les mots participent à une phrase valide.
 */
export function parseRules(st: State, used?: Set<number>): Rule[] {
  const { w, h } = st;
  const grid: (string[] | undefined)[] = new Array(w * h);
  let any = false;
  for (const o of st.objs) if (isWord(o.k)) { const c = o.y * w + o.x; (grid[c] ??= []).push(wordOf(o.k)); any = true; }
  const out: Rule[] = [];
  if (!any) return out;
  const seen = new Set<string>();
  // Une ligne de n cases : la case i est grid[c0 + i * d]
  const scan = (c0: number, d: number, n: number) => {
    const cell = (i: number) => (i < n ? grid[c0 + i * d] : undefined);
    const emit = (i0: number, j: number, subs: string[], o: string) => {
      for (const s of subs) { const key = s + '>' + o; if (!seen.has(key)) { seen.add(key); out.push({ s: s as Noun, o: o as Noun | Prop }); } }
      if (used) for (let k = i0; k <= j; k++) used.add(c0 + k * d);
    };
    const targets = (i0: number, j: number, subs: string[]) => {
      for (const t of cell(j) ?? []) {
        if (!NOUN_SET.has(t) && !PROP_SET.has(t)) continue;
        emit(i0, j, subs, t);
        if (cell(j + 1)?.includes('et')) targets(i0, j + 2, subs);
      }
    };
    const subjects = (i0: number, i: number, subs: string[]) => {
      for (const t of cell(i + 1) ?? []) {
        if (t === 'et') { for (const s of cell(i + 2) ?? []) if (NOUN_SET.has(s)) subjects(i0, i + 2, [...subs, s]); }
        else if (t === 'est') targets(i0, i + 2, subs);
      }
    };
    for (let i = 0; i < n - 2; i++) for (const t of cell(i) ?? []) if (NOUN_SET.has(t)) subjects(i, i, [t]);
  };
  for (let y = 0; y < h; y++) scan(y * w, 1, w);
  for (let x = 0; x < w; x++) scan(x, w, h);
  return out;
}

export type PropMap = Map<string, Set<Prop>>;
export function propMap(rules: Rule[]): PropMap {
  const m: PropMap = new Map();
  for (const r of rules) if (PROP_SET.has(r.o)) { let s = m.get(r.s); if (!s) m.set(r.s, s = new Set()); s.add(r.o as Prop); }
  return m;
}
/** Les mots sont toujours POUSSE ; le reste dépend des règles */
export function has(pm: PropMap, k: string, p: Prop): boolean {
  if (isWord(k)) return p === 'pousse';
  return pm.get(k)?.has(p) ?? false;
}

export interface StepResult {
  st: State; won: boolean; moved: boolean;
  /** Objets détruits (coulés, défaits, ouverts…) et objets transformés */
  destroyed: Obj[]; transformed: Obj[];
  /** Reste-t-il quelque chose qui soit TOI ? */
  you: boolean; rules: Rule[];
}

/** Un tour : tout ce qui est TOI avance d’une case (en poussant), puis transformations, puis interactions */
export function step(st0: State, dir: Dir, rules0?: Rule[]): StepResult {
  const { w, h } = st0;
  let rules = rules0 ?? parseRules(st0);
  let pm = propMap(rules);
  const objs = st0.objs.map(o => ({ ...o }));
  let next = st0.next;
  const at = (x: number, y: number) => objs.filter(o => o.x === x && o.y === y);
  const dx = DX[dir], dy = DY[dir];
  // Le plus avancé dans la direction bouge d’abord
  const you = objs.filter(o => has(pm, o.k, 'toi')).sort((a, b) => (b.x - a.x) * dx + (b.y - a.y) * dy || a.id - b.id);
  let moved = false, wordsMoved = false;
  const done = new Set<number>();
  for (const y of you) {
    if (done.has(y.id)) continue;
    const chain: Obj[] = [];
    const can = (o: Obj): boolean => {
      const tx = o.x + dx, ty = o.y + dy;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false;
      for (const p of at(tx, ty)) {
        if (chain.includes(p)) continue;
        if (has(pm, p.k, 'pousse')) { if (!can(p)) return false; }
        // FERMÉ bloque tout ce qui n’est pas OUVRE
        else if (has(pm, p.k, 'stop') || (has(pm, p.k, 'ferme') && !has(pm, o.k, 'ouvre'))) return false;
      }
      if (!chain.includes(o)) chain.push(o);
      return true;
    };
    if (can(y)) {
      for (const o of chain) { o.x += dx; o.y += dy; done.add(o.id); if (isWord(o.k)) wordsMoved = true; }
      moved = true;
    }
  }
  if (!moved) return { st: st0, won: false, moved: false, destroyed: [], transformed: [], you: true, rules };
  // Transformations : NOM EST NOM (sauf si NOM EST NOM lui-même)
  if (wordsMoved) rules = parseRules({ w, h, objs, next });
  const transformed: Obj[] = [];
  const into = new Map<string, string[]>();
  for (const r of rules) if (NOUN_SET.has(r.o)) { const l = into.get(r.s) ?? []; l.push(r.o); into.set(r.s, l); }
  if (into.size) {
    const extra: Obj[] = [];
    for (const o of objs) {
      if (isWord(o.k)) continue;
      const t = into.get(o.k);
      if (!t || t.includes(o.k)) continue;
      o.k = t[0];
      transformed.push(o);
      for (const k of t.slice(1)) extra.push({ id: next++, k, x: o.x, y: o.y });
    }
    objs.push(...extra);
  }
  pm = propMap(rules);
  // Interactions case par case
  const dead = new Set<Obj>();
  const both = (o: Obj) => has(pm, o.k, 'ouvre') && has(pm, o.k, 'ferme');
  const cells = new Map<number, Obj[]>();
  for (const o of objs) { const c = o.y * w + o.x; const l = cells.get(c); if (l) l.push(o); else cells.set(c, [o]); }
  for (const list of cells.values()) {
    for (const o of list) if (both(o)) dead.add(o);
    if (list.length < 2) continue;
    if (list.some(o => has(pm, o.k, 'coule'))) { list.forEach(o => dead.add(o)); continue; }
    if (list.some(o => has(pm, o.k, 'defait'))) list.filter(o => has(pm, o.k, 'toi')).forEach(o => dead.add(o));
    if (list.some(o => has(pm, o.k, 'chaud'))) list.filter(o => has(pm, o.k, 'fond')).forEach(o => dead.add(o));
    const op = list.filter(o => has(pm, o.k, 'ouvre') && !both(o));
    const sh = list.filter(o => has(pm, o.k, 'ferme') && !both(o));
    for (let i = 0; i < Math.min(op.length, sh.length); i++) { dead.add(op[i]); dead.add(sh[i]); }
  }
  const alive = dead.size ? objs.filter(o => !dead.has(o)) : objs;
  const st: State = { w, h, objs: alive, next };
  if (dead.size) { rules = parseRules(st); pm = propMap(rules); }
  return { st, won: hasWon(st, pm), moved, destroyed: [...dead], transformed, you: st.objs.some(o => has(pm, o.k, 'toi')), rules };
}

/** Gagné : un objet TOI partage sa case avec un objet GAGNE (lui-même compris) */
export function hasWon(st: State, pm: PropMap): boolean {
  for (const o of st.objs) {
    if (!has(pm, o.k, 'toi')) continue;
    if (st.objs.some(p => p.x === o.x && p.y === o.y && has(pm, p.k, 'gagne'))) return true;
  }
  return false;
}

/* ── Niveaux ── */

export type Variant = 'hemicycle' | 'ministere' | 'campagne';
export interface LevelDef {
  id: string; title: string; flavour: string;
  /** 1 (initiation) … 4 (difficile) */
  tier: number;
  /** Nombre de coups de la solution optimale (prouvé par le solveur des tests) */
  opt: number;
  map: string[];
}

/** Mots communs ; les noms du décor sont dans KEYS (sprite : la lettre, mot : le chiffre de son rang) */
const BASE_KEY: Record<string, string> = {
  '=': 'w:est', '&': 'w:et', Y: 'w:toi', G: 'w:gagne', S: 'w:stop', P: 'w:pousse', O: 'w:ouvre', F: 'w:ferme', C: 'w:coule', X: 'w:defait', H: 'w:chaud', M: 'w:fond',
};
export const KEYS: Record<Variant, [string, Noun][]> = {
  // d député(1) #mur(2) s siège(3) l loi(4) a amendement(5) p porte(6) k clé(7) r marais(8) j presse(9) f drapeau(0)
  hemicycle: [['d', 'depute'], ['#', 'mur'], ['s', 'siege'], ['l', 'loi'], ['a', 'amendement'], ['p', 'porte'], ['k', 'cle'], ['r', 'marais'], ['j', 'presse'], ['f', 'drapeau']],
  // m ministre(1) #mur(2) t tampon(3) g guichet(4) f dossier(5) b broyeur(6) c café(7) p porte(8) k clé(9) j presse(0)
  ministere: [['m', 'ministre'], ['#', 'mur'], ['t', 'tampon'], ['g', 'guichet'], ['f', 'dossier'], ['b', 'broyeur'], ['c', 'cafe'], ['p', 'porte'], ['k', 'cle'], ['j', 'presse']],
  // c candidat(1) #mur(2) u urne(3) v votant(4) a affiche(5) b boue(6) j presse(7) p porte(8) k clé(9) t tract(0)
  campagne: [['c', 'candidat'], ['#', 'mur'], ['u', 'urne'], ['v', 'votant'], ['a', 'affiche'], ['b', 'boue'], ['j', 'presse'], ['p', 'porte'], ['k', 'cle'], ['t', 'tract']],
};

export const LEVELS: Record<Variant, LevelDef[]> = {
  hemicycle: [
    {
      id: 'h1', title: 'Le règlement intérieur', tier: 1, opt: 11, flavour: 'Ce qui est écrit fait loi. Et ce qui est écrit se pousse.',
      map: [
        '1=Y...#...',
        '......#.s.',
        '......#...',
        '.d....#...',
        '..2=S.#...',
        '......#3=G',
      ],
    },
    {
      id: 'h2', title: 'Siège réservé', tier: 1, opt: 12, flavour: 'Le siège est hors d’atteinte ? Alors la victoire sera ailleurs.',
      map: [
        '1=Y....2=S',
        '###....###',
        '.......#s#',
        '.d.....###',
        '..3=G.....',
        '...l..4...',
        '..........',
      ],
    },
    {
      id: 'h3', title: 'Huis clos', tier: 2, opt: 13, flavour: 'La séance se tient à huis clos. Encore faut-il trouver la clé.',
      map: [
        '1=Y..#.2=S',
        '###..#.###',
        '.7=P.#....',
        '.d...p..s.',
        '..k..#....',
        '7=O..#....',
        '6=F..#.3=G',
      ],
    },
    {
      id: 'h4', title: 'Le 49.3', tier: 3, opt: 30, flavour: 'Pas de siège à conquérir ici : engagez votre responsabilité, déclarez-vous gagnant.',
      map: [
        '..........',
        '...1=Y....',
        '..........',
        '.d....#...',
        '......#.G.',
        '..1...#...',
        '.......2=S',
      ],
    },
    {
      id: 'h5', title: 'La navette', tier: 4, opt: 41, flavour: 'Un seul « est » pour deux lectures : il faudra le faire voyager.',
      map: [
        '2=S...#.s',
        '....d.#..',
        '.#3=G##p#',
        '..#.#..k.',
        '.#7.P#...',
        '.........',
        '7=O6=F1=Y',
      ],
    },
  ],
  ministere: [
    {
      id: 'm1', title: 'Le guichet', tier: 1, opt: 12, flavour: 'Le tampon ne vaut rien tant que la règle n’est pas complète.',
      map: [
        '..........',
        '.m.G.gggg.',
        '.....g..g.',
        '.3=..f.tg.',
        '.....g..g.',
        '1=Y..gggg.',
        '5=P4=S....',
      ],
    },
    {
      id: 'm2', title: 'Classement vertical', tier: 2, opt: 20, flavour: 'Ce qui entre dans le broyeur n’en ressort pas. Le broyeur non plus.',
      map: [
        '....b.b....',
        '.f..b.b....',
        '....b.b....',
        '.m..b.b..t.',
        '..f.b.b....',
        '1=Y.b.b.6=C',
        '5=P.b.b.3=G',
      ],
    },
    {
      id: 'm3', title: 'Remaniement', tier: 2, opt: 11, flavour: 'Coincé dans votre bureau ? Changez de titulaire.',
      map: [
        '......#...',
        '..7...#.t.',
        '..1=Y.#...',
        '.m....#...',
        '#######...',
        '2=S.......',
        '3=G....c..',
      ],
    },
    {
      id: 'm4', title: 'Le parapheur', tier: 3, opt: 23, flavour: 'Un dossier qui pousse et qui ouvre : c’est rare, mais ça s’écrit.',
      map: [
        '......#...',
        '.m..O.p.t.',
        '...&..#...',
        '5=P...#...',
        '###..f#...',
        '3=G...#...',
        '1=Y2=S8=F#',
      ],
    },
  ],
  campagne: [
    {
      id: 'c1', title: 'Le porte-à-porte', tier: 1, opt: 11, flavour: 'Les électeurs font barrage. Une règle se lit aussi de haut en bas.',
      map: [
        '.....v....',
        '.4...v..u.',
        '.=...v....',
        '.S...v....',
        '..c..v....',
        '.....v....',
        '1=Y..v.3=G',
      ],
    },
    {
      id: 'c2', title: 'Pas de vagues', tier: 2, opt: 22, flavour: 'La presse vous attend au tournant. Et si elle changeait de nature ?',
      map: [
        '7=X...j...',
        '......j.u.',
        '.c.=..j...',
        '......j...',
        '..3...j...',
        '......j...',
        '3=G...j1=Y',
      ],
    },
    {
      id: 'c3', title: 'Le cumul des mandats', tier: 3, opt: 23, flavour: 'Deux candidats valent mieux qu’un, surtout si l’un se sacrifie.',
      map: [
        '........#.u',
        '..c.....#..',
        '........p..',
        '..c.....###',
        '...&..O....',
        '2=S.....3=G',
        '1=Y.....8=F',
      ],
    },
    {
      id: 'c4', title: 'Le report de voix', tier: 4, opt: 21, flavour: 'Vos électeurs iront jusqu’à se jeter dans la boue pour vous.',
      map: [
        '.....#.....',
        '.4...#.v.v.',
        '.....#.....',
        '.1=Y....#..',
        '.....#..v..',
        '.c...#..bbb',
        '.....#..bbb',
        '2=S6=C3=Gbu',
      ],
    },
  ],
};

export function buildLevel(v: Variant, lv: LevelDef): State {
  const key: Record<string, string> = { ...BASE_KEY };
  KEYS[v].forEach(([c, n], i) => { key[c] = n; key[String((i + 1) % 10)] = 'w:' + n; });
  const objs: Obj[] = [];
  let id = 1;
  const h = lv.map.length, w = lv.map[0].length;
  lv.map.forEach((row, y) => {
    if (row.length !== w) throw new Error(`${lv.id} : la ligne ${y} fait ${row.length} cases au lieu de ${w}`);
    [...row].forEach((c, x) => {
      if (c === '.') return;
      const k = key[c];
      if (!k) throw new Error(`${lv.id} : caractère inconnu « ${c} »`);
      objs.push({ id: id++, k, x, y });
    });
  });
  return { w, h, objs, next: id };
}

/** Les niveaux d’une partie : trois, plus durs quand la difficulté monte */
export function sessionLevels(v: Variant, diff: number): LevelDef[] {
  const all = LEVELS[v];
  const n = Math.min(3, all.length);
  const t = Math.max(0, Math.min(1, (diff - 0.8) / 0.5));
  const start = Math.round((all.length - n) * t);
  return all.slice(start, start + n);
}

/** Score d’un niveau : résolu = 0,7, plus jusqu’à 0,3 selon l’efficacité (coups / optimum) */
export function levelScore(lv: LevelDef, moves: number | null): number {
  if (moves === null) return 0;
  return 0.7 + 0.3 * Math.min(1, lv.opt / Math.max(1, moves));
}
export const levelWeight = (lv: LevelDef) => 1 + 0.25 * (lv.tier - 1);

/* ── Solveur (largeur d’abord sur l’état complet ; sert aux tests) ── */

export function stateKey(st: State, kinds: Map<string, number>): string {
  const a: number[] = [];
  for (const o of st.objs) {
    let k = kinds.get(o.k);
    if (k === undefined) { k = kinds.size; kinds.set(o.k, k); }
    a.push((o.y * st.w + o.x) * 64 + k);
  }
  a.sort((p, q) => p - q);
  return String.fromCharCode(...a);
}

export function solve(start: State, limit = 1_500_000): { path: Dir[]; explored: number } | null {
  const kinds = new Map<string, number>();
  const seen = new Map<string, number>();
  const parent: number[] = [-1], dirs: number[] = [0];
  seen.set(stateKey(start, kinds), 0);
  let frontier: [number, State, Rule[]][] = [[0, start, parseRules(start)]];
  while (frontier.length && seen.size < limit) {
    const nf: [number, State, Rule[]][] = [];
    for (const [i, st, rules] of frontier) {
      for (const d of [0, 1, 2, 3] as Dir[]) {
        const r = step(st, d, rules);
        if (!r.moved) continue;
        const nk = stateKey(r.st, kinds);
        if (seen.has(nk)) continue;
        const ni = parent.length;
        seen.set(nk, ni); parent.push(i); dirs.push(d);
        if (r.won) {
          const path: Dir[] = [];
          for (let c = ni; c > 0; c = parent[c]) path.push(dirs[c] as Dir);
          return { path: path.reverse(), explored: seen.size };
        }
        if (r.you) nf.push([ni, r.st, r.rules]);
      }
    }
    frontier = nf;
  }
  return null;
}

/* ── Présentation ── */

/** Libellés des mots (une ou deux lignes) */
export const LABEL: Record<Word, string[]> = {
  depute: ['DÉPUTÉ'], ministre: ['MINIS', 'TRE'], candidat: ['CANDI', 'DAT'], mur: ['MUR'], siege: ['SIÈGE'], loi: ['LOI'],
  amendement: ['AMEN', 'DEMENT'], porte: ['PORTE'], cle: ['CLÉ'], marais: ['MARAIS'], presse: ['PRESSE'], tampon: ['TAMPON'],
  guichet: ['GUI', 'CHET'], dossier: ['DOS', 'SIER'], broyeur: ['BROY', 'EUR'], cafe: ['CAFÉ'], urne: ['URNE'], votant: ['VOTANT'],
  affiche: ['AFFI', 'CHE'], boue: ['BOUE'], drapeau: ['DRA', 'PEAU'], tract: ['TRACT'],
  est: ['EST'], et: ['ET'],
  toi: ['TOI'], gagne: ['GAGNE'], stop: ['STOP'], pousse: ['POUSSE'], ouvre: ['OUVRE'], ferme: ['FERME'], coule: ['COULE'],
  defait: ['DÉFAIT'], chaud: ['CHAUD'], fond: ['FOND'],
};
const COLOR: Record<Word, string> = {
  depute: '#6f9cf2', ministre: '#c9c1b3', candidat: '#62a0ff', mur: '#b2a693', siege: '#ff5d70', loi: '#efdfae', amendement: '#a9cbff',
  porte: '#d08a4c', cle: '#f2c640', marais: '#5cc08c', presse: '#cdd3df', tampon: '#ff7058', guichet: '#9db6d6', dossier: '#f2b84b',
  broyeur: '#aab0bd', cafe: '#d3a477', urne: '#8fd6f5', votant: '#4fc7b4', affiche: '#ff7b93', boue: '#bf8a5a', drapeau: '#7fa8ff', tract: '#f3e3a0',
  est: '#f4f0e6', et: '#f4f0e6',
  toi: '#ee5fa7', gagne: '#f5cd4f', stop: '#48b06a', pousse: '#b98446', ouvre: '#e3c23f', ferme: '#e0503f', coule: '#3f97e0',
  defait: '#b03a3a', chaud: '#f39144', fond: '#86d6ee',
};
const PROP_HINT: Record<Prop, string> = {
  toi: 'vous le dirigez', gagne: 'à toucher', stop: 'infranchissable', pousse: 'se pousse',
  ouvre: 'détruit le FERMÉ', ferme: 'bloque, sauf OUVRE', coule: 'engloutit tout',
  defait: 'élimine le TOI', chaud: 'fait fondre', fond: 'fond au CHAUD',
};
const PROP_ORDER: Prop[] = ['toi', 'gagne', 'stop', 'pousse', 'ouvre', 'ferme', 'coule', 'defait', 'chaud', 'fond'];
const THEMES: Record<Variant, { tag: string }> = {
  hemicycle: { tag: 'Hémicycle' },
  ministere: { tag: 'Ministère' },
  campagne: { tag: 'Campagne' },
};

interface View { key: string; id: number; k: string; x: number; y: number; word: Word | null; cls: string; lines: string[]; color: string; tl: number[]; stack: number }
interface Puff { id: number; x: number; y: number; tone: 'sink' | 'pop' | 'morph' }
interface Snapshot { st: State; moves: number }

let uid = 0;

/** Les sprites des objets, dessinés en SVG (24 × 24) */
@Component({
  selector: 'app-regle-sprite',
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      @switch (kind()) {
        @case ('depute') {
          <path d="M5.5 21.5v-4.2c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6v4.2z" fill="#27324d" />
          <path d="M10.6 11.9 12 14.6l1.4-2.7z" fill="#f4f1ea" />
          <path d="M7.4 12.6 15.8 21.3" stroke="#2f5fd0" stroke-width="1.5" />
          <path d="M8.5 12.1 16.9 20.8" stroke="#f4f1ea" stroke-width="1.5" />
          <path d="M9.6 11.7 18 20.3" stroke="#e1333f" stroke-width="1.5" />
          <circle cx="12" cy="7" r="3.7" fill="#f1c7a1" />
          <path d="M8.3 6.4c.3-2.4 2-3.6 3.7-3.6s3.4 1.2 3.7 3.6c-1.4-.9-2.4-1.2-3.7-1.2s-2.3.3-3.7 1.2z" fill="#5b4031" />
        }
        @case ('ministre') {
          <path d="M5 21.5v-4.4c0-3.3 3-5.4 7-5.4s7 2.1 7 5.4v4.4z" fill="#3b3f48" />
          <path d="M10 11.9h4L12 17z" fill="#f4f1ea" />
          <path d="M11.3 12.6h1.4l.4 3.6-1.1 1.1-1.1-1.1z" fill="#c43a3a" />
          <circle cx="16.4" cy="14.6" r="1" fill="#e9c35a" />
          <circle cx="12" cy="7" r="3.7" fill="#e9bc95" />
          <path d="M8.2 7c-.2-2.6 1.6-4.4 3.8-4.4s4 1.8 3.8 4.4c-.6-1.2-1.6-1.9-3.8-1.9S8.8 5.8 8.2 7z" fill="#9a9a9a" />
          <rect x="15.6" y="17.4" width="6" height="4.4" rx=".8" fill="#7a4a24" />
          <path d="M17.6 17.4v-.8h2v.8" stroke="#7a4a24" stroke-width=".8" fill="none" />
        }
        @case ('candidat') {
          <path d="M5.5 21.5v-4.2c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6v4.2z" fill="#2f5fb3" />
          <path d="M16.6 13.2 19.6 6.2" stroke="#2f5fb3" stroke-width="2.4" stroke-linecap="round" />
          <circle cx="19.8" cy="5.4" r="1.4" fill="#f1c7a1" />
          <circle cx="9.3" cy="15.4" r="1.7" fill="#f4f1ea" />
          <circle cx="9.3" cy="15.4" r=".8" fill="#e1333f" />
          <circle cx="12" cy="7" r="3.7" fill="#f1c7a1" />
          <path d="M8.3 6.6c.2-2.5 1.9-3.8 3.7-3.8 2 0 3.6 1.3 3.7 3.8-1-.8-2-1.6-3.6-1.6-1.4 0-2.6.7-3.8 1.6z" fill="#2b2420" />
        }
        @case ('votant') {
          <path d="M6 21.5v-4c0-3.2 2.7-5.4 6-5.4s6 2.2 6 5.4v4z" fill="#2f8f83" />
          <rect x="13.5" y="14.5" width="5" height="3.6" rx=".4" fill="#f2e2b6" transform="rotate(-12 16 16.3)" />
          <circle cx="12" cy="7.2" r="3.6" fill="#d9a77f" />
          <path d="M8.4 6.8c0-2.4 1.6-3.8 3.6-3.8s3.6 1.4 3.6 3.8c-.9-1-2-1.5-3.6-1.5s-2.7.5-3.6 1.5z" fill="#c8732e" />
        }
        @case ('mur') {
          <rect x=".8" y=".8" width="22.4" height="22.4" rx="1.6" fill="#7d7468" />
          <path d="M.8 8.3h22.4M.8 15.7h22.4M8 .8v7.5M17 .8v7.5M4 8.3v7.4M13 8.3v7.4M21 8.3v7.4M8 15.7v7.5M17 15.7v7.5" stroke="#5a5248" stroke-width="1.1" />
          <path d="M2 2h5M9.5 2h6M18.5 2h3.5M5.5 9.5h6M14.5 9.5h5.5M2 17h5M9.5 17h6" stroke="#968c7e" stroke-width=".7" />
        }
        @case ('siege') {
          <path d="M5 13V6.2C5 4.4 6.3 3 8 3h8c1.7 0 3 1.4 3 3.2V13z" fill="#a8253a" />
          <path d="M7 5.5h10M7 8h10M7 10.5h10" stroke="#8c1d2f" stroke-width=".8" />
          <rect x="3.5" y="12" width="17" height="5" rx="2.2" fill="#d23b4f" />
          <path d="M6 17v4.5M18 17v4.5M4.5 21.5h3M16.5 21.5h3" stroke="#d6aa4e" stroke-width="1.6" stroke-linecap="round" />
        }
        @case ('loi') {
          <rect x="5" y="2.5" width="14" height="19" rx="1.4" fill="#efe3c2" />
          <path d="M7.8 6.3h8.4M7.8 9h8.4M7.8 11.7h8.4M7.8 14.4h5" stroke="#8b7b58" stroke-width="1" />
          <path d="M6.7 2.5h10.6" stroke="#cdbf96" stroke-width="1.6" />
          <circle cx="15.5" cy="17.4" r="2.6" fill="#c0392b" />
          <path d="M14.4 19.6l-.8 2.6M16.6 19.6l.8 2.6" stroke="#c0392b" stroke-width="1.1" />
        }
        @case ('amendement') {
          <path d="M5.5 2.5h9l4 4v15h-13z" fill="#fbf8ef" />
          <path d="M14.5 2.5v4h4" fill="#d9d3c2" />
          <path d="M8 10h8M8 12.6h8M8 15.2h5" stroke="#9aa3b5" stroke-width=".9" />
          <path d="M15.8 15v6M12.8 18h6" stroke="#2f8f4f" stroke-width="2.2" stroke-linecap="round" />
        }
        @case ('porte') {
          <rect x="4.5" y="2" width="15" height="20" rx="1.2" fill="#8b5a2b" />
          <path d="M12 2v20" stroke="#6b421c" stroke-width="1.1" />
          <rect x="6.3" y="4" width="4" height="7" rx=".5" fill="#9c6936" stroke="#6b421c" stroke-width=".6" />
          <rect x="13.7" y="4" width="4" height="7" rx=".5" fill="#9c6936" stroke="#6b421c" stroke-width=".6" />
          <rect x="6.3" y="13" width="4" height="7" rx=".5" fill="#9c6936" stroke="#6b421c" stroke-width=".6" />
          <rect x="13.7" y="13" width="4" height="7" rx=".5" fill="#9c6936" stroke="#6b421c" stroke-width=".6" />
          <circle cx="10.7" cy="12" r=".9" fill="#e9c35a" /><circle cx="13.3" cy="12" r=".9" fill="#e9c35a" />
        }
        @case ('cle') {
          <circle cx="7.5" cy="12" r="4" fill="none" stroke="#e5b53b" stroke-width="2.6" />
          <path d="M11.4 12h9.2M17.4 12v3.6M20.3 12v2.6" stroke="#e5b53b" stroke-width="2.4" stroke-linecap="round" />
          <circle cx="7.5" cy="12" r="1.2" fill="#fff3c4" />
        }
        @case ('marais') {
          <path d="M1.5 14.5c2.6-1.6 4.6 1.6 7.2 0s4.6 1.6 7.2 0 4.6 1.6 6.6 0v8h-21z" fill="#2f6b4c" />
          <path d="M1.5 18.5c2.6-1.6 4.6 1.6 7.2 0s4.6 1.6 7.2 0 4.6 1.6 6.6 0" stroke="#5cc08c" stroke-width="1" fill="none" />
          <path d="M6 14V6.5M9 14.5V9M17 14V5.5" stroke="#6b8f3a" stroke-width="1.2" />
          <ellipse cx="6" cy="6" rx="1" ry="2.2" fill="#7a4f2a" /><ellipse cx="17" cy="5" rx="1" ry="2.2" fill="#7a4f2a" />
        }
        @case ('presse') {
          <rect x="2.5" y="7" width="19" height="12.5" rx="2" fill="#30323a" />
          <rect x="6.5" y="4.5" width="6" height="3" rx="1" fill="#30323a" />
          <circle cx="12" cy="13.2" r="4.4" fill="#9fb4d6" stroke="#15161a" stroke-width="1.6" />
          <circle cx="13.2" cy="12" r="1.2" fill="#e6eefb" />
          <rect x="16.5" y="8.6" width="3" height="1.8" rx=".4" fill="#ffd25a" />
          <path d="M14 3.5l2-1.5M16.5 5l2.2-.6" stroke="#ffd25a" stroke-width="1" stroke-linecap="round" />
        }
        @case ('tampon') {
          <circle cx="12" cy="4.6" r="2.9" fill="#9b5a33" />
          <rect x="10.6" y="6.5" width="2.8" height="5.5" fill="#9b5a33" />
          <rect x="5" y="11.5" width="14" height="4.2" rx="1" fill="#2e3442" />
          <rect x="5.6" y="15.7" width="12.8" height="2.6" fill="#c0392b" />
          <path d="M5.5 21.2h13" stroke="#c0392b" stroke-width="1.4" stroke-dasharray="2 1.2" />
        }
        @case ('guichet') {
          <rect x="2.5" y="2.5" width="19" height="19" rx="1.4" fill="#5e7189" />
          <rect x="5.5" y="5" width="13" height="9" fill="#c8dcec" />
          <path d="M8.2 5v9M10.9 5v9M13.6 5v9M16.3 5v9" stroke="#5e7189" stroke-width=".8" />
          <rect x="4" y="15" width="16" height="2.2" fill="#3c4a5c" />
          <path d="M9.5 14a2.5 2.5 0 0 1 5 0z" fill="#3c4a5c" />
        }
        @case ('dossier') {
          <path d="M3 6.5h7l1.8 2H21v12H3z" fill="#c78f2f" />
          <path d="M3 9.8h18v10.7H3z" fill="#eab152" />
          <rect x="7" y="12.4" width="10" height="3.6" rx=".4" fill="#fbf6e8" />
          <path d="M8.5 14.2h7" stroke="#9aa3b5" stroke-width=".8" />
        }
        @case ('broyeur') {
          <rect x="3.5" y="3" width="17" height="10" rx="1.6" fill="#4a4f5a" />
          <rect x="5.8" y="6.5" width="12.4" height="1.6" rx=".6" fill="#15161a" />
          <circle cx="17.6" cy="10.6" r=".9" fill="#ff5a4a" />
          <path d="M7 13v7.5M9.5 13v8.5M12 13v6.5M14.5 13v8.5M17 13v7" stroke="#ece7da" stroke-width="1.5" />
        }
        @case ('cafe') {
          <ellipse cx="11" cy="20.4" rx="8" ry="1.6" fill="#e3ddd0" />
          <path d="M4.5 9.5h12v5.5a5.5 5.5 0 0 1-5.5 5.5h-1a5.5 5.5 0 0 1-5.5-5.5z" fill="#f6f2ea" />
          <path d="M16.5 11.2h1.3a2.6 2.6 0 0 1 0 5.2h-1.6" stroke="#f6f2ea" stroke-width="1.8" fill="none" />
          <ellipse cx="10.5" cy="9.6" rx="6" ry="1.4" fill="#6b3f22" />
          <path d="M8.5 2.8c-1 1.4 1 2.4 0 4M12 2.4c-1 1.4 1 2.4 0 4" stroke="#d8d0c0" stroke-width="1.1" fill="none" stroke-linecap="round" />
        }
        @case ('urne') {
          <rect x="4" y="8.5" width="16" height="13" rx="1.4" fill="#bfe3f4" fill-opacity=".82" stroke="#eef8fd" stroke-width=".9" />
          <rect x="7" y="14" width="7" height="4.6" rx=".4" fill="#f2e2b6" transform="rotate(-10 10.5 16.3)" />
          <rect x="3" y="6.6" width="18" height="3" rx="1" fill="#2f5fb3" />
          <rect x="8.8" y="7.6" width="6.4" height="1" fill="#15161a" />
          <rect x="9.5" y="1.6" width="5" height="5.6" rx=".3" fill="#fbfaf5" />
          <path d="M9.5 1.6l2.5 2.6 2.5-2.6" stroke="#c9c0a6" stroke-width=".7" fill="none" />
        }
        @case ('affiche') {
          <rect x="4.5" y="2.5" width="15" height="19" rx=".5" fill="#f4efe2" />
          <rect x="4.5" y="2.5" width="15" height="6.5" fill="#e0475f" />
          <circle cx="12" cy="13" r="3" fill="#2f5fb3" />
          <path d="M7.5 18h9M8.5 20h7" stroke="#2b2b33" stroke-width="1" />
          <path d="M7 5.8h10" stroke="#fff" stroke-width="1.4" />
        }
        @case ('boue') {
          <path d="M2.5 15c0-3.2 3.2-4.6 5.4-3.4 1-3.4 6.8-3.6 8 0 3.2-1.2 6.1 1 6.1 4.2 0 3.4-3.4 5.4-9.8 5.4S2.5 18.8 2.5 15z" fill="#6b4a2b" />
          <circle cx="8" cy="15.5" r="1.3" fill="#8a6440" /><circle cx="15.5" cy="14" r="1" fill="#8a6440" /><circle cx="12" cy="18" r=".8" fill="#8a6440" />
        }
        @case ('drapeau') {
          <path d="M5 2.5v19.5" stroke="#c9c0a6" stroke-width="1.6" stroke-linecap="round" />
          <rect x="5.8" y="3.5" width="5" height="10" fill="#2f5fd0" />
          <rect x="10.8" y="3.5" width="5" height="10" fill="#f4f1ea" />
          <rect x="15.8" y="3.5" width="5" height="10" fill="#e1333f" />
        }
        @case ('tract') {
          <path d="M5 5.2 17.5 3l2.4 15.4-12.5 2.2z" fill="#fff4cf" />
          <path d="M7.8 8.2l8-1.4M8.3 11l8-1.4M8.8 13.8l5-.9" stroke="#8a7f62" stroke-width=".9" />
          <circle cx="14.6" cy="15.6" r="1.6" fill="#e0475f" />
        }
      }
    </svg>
  `,
  styles: `:host { display: block; width: 100%; height: 100%; } svg { display: block; width: 100%; height: 100%; overflow: visible; }`,
})
export class RegleSpriteComponent {
  readonly kind = input.required<string>();
}

@Component({
  selector: 'app-regle-game',
  imports: [RegleSpriteComponent],
  template: `
    <div class="rg" [class]="'rg v-' + variant">
      <ol class="steps" aria-label="Niveaux de la partie">
        @for (lv of queue; track lv.id; let i = $index) {
          <li>
            <button type="button" class="step" [class.cur]="i === cur()" [class.ok]="results()[i] !== null && results()[i]! >= 0" [class.skip]="results()[i] === -1"
                    [disabled]="over() || results()[i] !== null || i === cur()" (click)="pick(i)"
                    [attr.aria-label]="'Niveau ' + (i + 1) + ' : ' + lv.title + (results()[i] === null ? '' : results()[i] === -1 ? ' (passé)' : ' (résolu)')">
              <span class="n mono">{{ results()[i] === null ? i + 1 : results()[i] === -1 ? '–' : '✓' }}</span>
              <span class="t">{{ lv.title }}</span>
            </button>
          </li>
        }
        <li class="clock mono" [class.low]="timeLeft() <= 45" aria-label="Temps restant">{{ clock() }}</li>
      </ol>

      <header class="lvl">
        <div>
          <span class="tag">{{ theme.tag }} · {{ tierLabel(level().tier) }}</span>
          <h3>{{ level().title }}</h3>
          <p class="flav">{{ level().flavour }}</p>
        </div>
        <div class="count" aria-live="polite"><b class="mono">{{ moves() }}</b><small>coups<br />optimum {{ level().opt }}</small></div>
      </header>

      <div class="stage">
        <div class="board" [style.aspect-ratio]="st().w + ' / ' + st().h" [style.max-width.px]="st().w * 54"
             [class.won]="phase() === 'won'" [class.stuck]="phase() === 'stuck'"
             role="application" aria-roledescription="plateau de jeu" [attr.aria-label]="boardLabel()"
             (pointerdown)="swipeStart($event)" (pointerup)="swipeEnd($event)" (pointercancel)="swipe = null">
          <div class="grid" [style.background-size]="(100 / st().w) + '% ' + (100 / st().h) + '%'"></div>
          @for (o of views(); track o.key) {
            <div class="ob" [class]="'ob ' + o.cls" [style.left.%]="o.x * 100 / st().w" [style.top.%]="o.y * 100 / st().h"
                 [style.width.%]="100 / st().w" [style.height.%]="100 / st().h" [style.--c]="o.color" [style.animation-delay.ms]="-(o.id % 3) * 260">
              @if (o.word) {
                <svg class="word" viewBox="0 0 100 100" aria-hidden="true">
                  <rect class="plate" x="5" y="5" width="90" height="90" rx="9" />
                  @if (o.lines.length === 1) {
                    <text x="50" y="63" text-anchor="middle" [attr.textLength]="o.tl[0]" lengthAdjust="spacingAndGlyphs">{{ o.lines[0] }}</text>
                  } @else {
                    <text x="50" y="46" text-anchor="middle" class="two" [attr.textLength]="o.tl[0]" lengthAdjust="spacingAndGlyphs">{{ o.lines[0] }}</text>
                    <text x="50" y="80" text-anchor="middle" class="two" [attr.textLength]="o.tl[1]" lengthAdjust="spacingAndGlyphs">{{ o.lines[1] }}</text>
                  }
                </svg>
              } @else {
                <app-regle-sprite class="spr" [kind]="o.k" />
                @if (o.stack) { <span class="pile mono">×{{ o.stack }}</span> }
              }
            </div>
          }
          @for (p of puffs(); track p.id) {
            <span class="puff" [class]="'puff ' + p.tone" [style.left.%]="(p.x + 0.5) * 100 / st().w" [style.top.%]="(p.y + 0.5) * 100 / st().h"></span>
          }
          @if (phase() === 'won') { <div class="stamp" aria-hidden="true"><span>Adopté</span></div> }
          @if (phase() === 'over') { <div class="stamp end" aria-hidden="true"><span>Séance levée</span></div> }
        </div>
      </div>

      <p class="status" [class.bad]="phase() === 'stuck'" aria-live="polite">{{ status() }}</p>

      <div class="controls">
        <div class="pad" role="group" aria-label="Déplacements">
          <button type="button" class="up" (click)="move(0)" [disabled]="!canPlay()" aria-label="Haut">▲</button>
          <button type="button" class="left" (click)="move(3)" [disabled]="!canPlay()" aria-label="Gauche">◀</button>
          <button type="button" class="right" (click)="move(1)" [disabled]="!canPlay()" aria-label="Droite">▶</button>
          <button type="button" class="down" (click)="move(2)" [disabled]="!canPlay()" aria-label="Bas">▼</button>
        </div>
        <div class="acts">
          <button type="button" class="btn act" (click)="undo()" [disabled]="!canUndo()"><span aria-hidden="true">↶</span> Annuler</button>
          <button type="button" class="btn act" (click)="restart()" [disabled]="over() || phase() === 'won' || (moves() === 0 && !histLen())"><span aria-hidden="true">⟲</span> Recommencer</button>
          <button type="button" class="btn act skip" (click)="skip()" [disabled]="over() || phase() === 'won'">Passer <small>(0 pt)</small></button>
        </div>
      </div>
      <p class="keys muted">Flèches ou ZQSD / WASD · Retour arrière ou U : annuler · R : recommencer · ou glissez sur le plateau.</p>

      <section class="rules" aria-label="Règles en vigueur" [class.flash]="rulesFlash()">
        <h4>Règles en vigueur</h4>
        <ul>
          @for (r of ruleList(); track r.key) {
            <li [title]="r.hint">
              <span class="chip" [style.--c]="r.sc">{{ r.s }}</span>
              <span class="op">est</span>
              <span class="chip" [class.prop]="r.prop" [style.--c]="r.oc">{{ r.o }}</span>
              @if (r.hint) { <small>{{ r.hint }}</small> }
            </li>
          } @empty { <li class="none">Aucune règle : plus rien ne tient.</li> }
        </ul>
      </section>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .rg { display: grid; gap: 8px; --board: #141a2b; --board-2: #1b2338; --glow: #f5cd4f; }
    .rg.v-ministere { --board: #16201e; --board-2: #1d2a27; }
    .rg.v-campagne { --board: #1f1626; --board-2: #2a1e33; }

    .steps { list-style: none; margin: 0; padding: 0; display: flex; gap: 4px; align-items: stretch; min-width: 0; }
    .steps li { flex: 1 1 0; min-width: 0; display: flex; }
    .step { flex: 1; min-width: 0; display: flex; align-items: center; gap: 5px; padding: 4px 6px; border: 1px solid var(--line); border-radius: 8px;
      background: var(--surface); color: var(--ink-2); font: 500 11.5px var(--font-body); cursor: pointer; text-align: left;
      .n { flex: none; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; background: var(--surface-2); font-size: 11px; }
      .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      &.cur { border-color: var(--accent); color: var(--ink); box-shadow: inset 0 -2px 0 var(--accent); cursor: default; }
      &.ok .n { background: var(--good); color: var(--surface); }
      &.skip { opacity: .6; }
      &:disabled:not(.cur) { cursor: default; }
      &:not(:disabled):hover { border-color: var(--ink-3); } }
    .steps .clock { flex: none; align-items: center; padding: 0 6px; font-size: 12.5px; color: var(--ink-2); &.low { color: var(--bad); font-weight: 600; } }

    .lvl { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;
      h3 { font: 600 18px/1.15 var(--font-display); margin: 1px 0 2px; color: var(--ink); }
      .tag { font: 600 10.5px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
      .flav { margin: 0; font-size: 12.5px; color: var(--ink-2); font-style: italic; } }
    .count { flex: none; display: flex; align-items: center; gap: 5px; text-align: left;
      b { font-size: 22px; color: var(--ink); line-height: 1; } small { font-size: 10.5px; color: var(--ink-3); line-height: 1.2; } }

    .stage { display: flex; justify-content: center; }
    .board { position: relative; width: 100%; border-radius: 10px; background: radial-gradient(120% 90% at 50% 0%, var(--board-2), var(--board));
      box-shadow: 0 0 0 1px rgba(255,255,255,.07) inset, 0 0 0 1px var(--line), 0 10px 26px -14px rgba(0,0,0,.7); overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none;
      transition: box-shadow .3s ease; }
    .board.won { box-shadow: 0 0 0 2px var(--glow) inset, 0 10px 26px -14px rgba(0,0,0,.7); }
    .board.stuck { box-shadow: 0 0 0 2px #e0503f inset; }
    .grid { position: absolute; inset: 0; pointer-events: none; opacity: .5;
      background-image: linear-gradient(to right, rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.05) 1px, transparent 1px); }
    .ob { position: absolute; display: grid; place-items: center; transition: left .11s ease-out, top .11s ease-out; pointer-events: none; }
    .ob > * { width: 100%; height: 100%; }
    .spr { padding: 3%; box-sizing: border-box; }
    .pile { position: absolute; right: 2%; bottom: 2%; width: auto !important; height: auto !important; padding: 0 3px; border-radius: 4px;
      background: #f5cd4f; color: #171a22; font-size: clamp(8px, 2.4vw, 11px); font-weight: 700; line-height: 1.3; z-index: 4; }
    .ob.wall { z-index: 0; } .ob.wall .spr { padding: 0; }
    .ob.thing { z-index: 1; } .ob.word { z-index: 2; } .ob.you { z-index: 3; }
    .ob.you .spr { filter: drop-shadow(0 0 2.5px rgba(238, 95, 167, .95)); }
    .ob.win .spr { filter: drop-shadow(0 0 3px rgba(245, 205, 79, .9)); }
    .ob.sink .spr { opacity: .92; }

    .word { display: block; overflow: visible; }
    .word .plate { fill: rgba(10, 12, 20, .55); stroke: var(--c); stroke-width: 4.5; }
    .word text { font: 800 37px 'Arial Narrow', 'Roboto Condensed', 'Helvetica Neue', var(--font-body), sans-serif; fill: var(--c); letter-spacing: -.5px; }
    .word text.two { font-size: 31px; }
    .ob.prop .word .plate { fill: var(--c); stroke: rgba(0,0,0,.25); }
    .ob.prop .word text { fill: #171a22; }
    .ob.op .word .plate { fill: rgba(10, 12, 20, .35); stroke: rgba(244, 240, 230, .5); stroke-width: 3; stroke-dasharray: 7 5; }
    .ob.idle .word { opacity: .5; }
    .ob.idle.prop .word .plate { fill: color-mix(in srgb, var(--c) 55%, #333); }

    .puff { position: absolute; z-index: 5; width: 9%; aspect-ratio: 1; border-radius: 50%; translate: -50% -50%; pointer-events: none;
      background: radial-gradient(circle, rgba(255,255,255,.9), rgba(255,255,255,0) 70%); animation: puff .45s ease-out forwards;
      &.sink { background: radial-gradient(circle, rgba(120,180,255,.9), rgba(120,180,255,0) 70%); }
      &.morph { background: radial-gradient(circle, rgba(245,205,79,.95), rgba(245,205,79,0) 70%); } }
    @keyframes puff { from { scale: .4; opacity: 1; } to { scale: 2.2; opacity: 0; } }

    .stamp { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; z-index: 8;
      span { font: 800 clamp(22px, 8vw, 42px) var(--font-display); letter-spacing: .06em; text-transform: uppercase; color: #e0503f;
        border: 4px double #e0503f; border-radius: 8px; padding: 2px 14px; rotate: -12deg; background: rgba(250, 245, 235, .82);
        animation: stamp .38s cubic-bezier(.2,1.6,.4,1) both; mix-blend-mode: normal; } }
    .stamp.end span { color: #2f5fb3; border-color: #2f5fb3; font-size: clamp(18px, 6vw, 32px); }
    @keyframes stamp { from { scale: 2.4; opacity: 0; } }

    .status { margin: 0; min-height: 1.4em; font-size: 12.5px; color: var(--ink-2); text-align: center; &.bad { color: var(--bad); font-weight: 600; } }

    .controls { display: flex; justify-content: center; align-items: center; gap: 14px; flex-wrap: wrap; }
    .pad { display: grid; grid-template-columns: repeat(3, 46px); grid-template-rows: repeat(2, 44px); gap: 4px;
      grid-template-areas: '. up .' 'left down right';
      button { border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); font-size: 15px; cursor: pointer; touch-action: manipulation;
        &:active:not(:disabled) { background: var(--surface-2); transform: translateY(1px); } &:disabled { opacity: .4; cursor: default; } }
      .up { grid-area: up; } .left { grid-area: left; } .right { grid-area: right; } .down { grid-area: down; } }
    .acts { display: grid; gap: 4px; }
    .act { min-height: 44px; min-width: 132px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; touch-action: manipulation;
      span { font-size: 16px; line-height: 1; } small { color: var(--ink-3); font-size: 10.5px; } }
    .keys { margin: 0; font-size: 11px; text-align: center; }

    .rules { border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px; background: var(--surface-2); transition: background .4s ease;
      h4 { margin: 0 0 5px; font: 600 10.5px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
      ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
      li { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; font-size: 12px; }
      small { color: var(--ink-3); font-size: 11px; }
      .none { color: var(--bad); }
      .op { font: 700 10.5px var(--font-body); text-transform: uppercase; color: var(--ink-3); }
      .chip { font: 800 11px 'Arial Narrow', 'Roboto Condensed', var(--font-body), sans-serif; letter-spacing: .02em; padding: 2px 6px; border-radius: 4px;
        color: var(--c); background: #1a1f2c; border: 1.5px solid var(--c);
        &.prop { background: var(--c); color: #171a22; border-color: rgba(0,0,0,.2); } } }
    .rules.flash { background: color-mix(in srgb, var(--accent) 12%, var(--surface-2)); }

    @media (prefers-reduced-motion: no-preference) {
      .ob .spr, .ob .word { animation: wob .78s steps(1, end) infinite; animation-delay: inherit; }
      .ob.win .spr { animation: wob .78s steps(1, end) infinite, shine 1.6s ease-in-out infinite; }
    }
    @keyframes wob { 0% { transform: translate(0, 0) rotate(0); } 33% { transform: translate(.35px, -.45px) rotate(-1.4deg); } 66% { transform: translate(-.4px, .3px) rotate(1.1deg); } }
    @keyframes shine { 50% { filter: drop-shadow(0 0 6px rgba(245, 205, 79, 1)); } }
    @media (prefers-reduced-motion: reduce) {
      .ob { transition: none; } .puff, .stamp span { animation: none; }
    }
    @media (max-width: 420px) {
      .step .t { display: none; } .step { justify-content: center; }
      .lvl h3 { font-size: 16.5px; }
      .controls { gap: 10px; } .act { min-width: 118px; }
      .keys { display: none; }
    }
  `,
})
export class RegleGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected variant: Variant = 'hemicycle';
  protected theme = THEMES.hemicycle;
  protected queue: LevelDef[] = [];
  protected readonly cur = signal(0);
  /** Par niveau : null = à jouer, -1 = passé, sinon le nombre de coups de la solution */
  protected readonly results = signal<(number | null)[]>([]);
  protected readonly st = signal<State>({ w: 1, h: 1, objs: [], next: 1 });
  protected readonly moves = signal(0);
  protected readonly phase = signal<'play' | 'won' | 'stuck' | 'over'>('play');
  protected readonly puffs = signal<Puff[]>([]);
  protected readonly timeLeft = signal(420);
  protected readonly verdict = signal('');
  protected readonly rulesFlash = signal(false);
  /** Change à chaque niveau chargé : les objets d’un autre niveau ne glissent pas vers les nouveaux */
  private readonly gen = signal(0);
  private history: Snapshot[] = [];
  protected readonly histLen = signal(0);
  private budget = 420;
  private lastMove = 0;
  protected swipe: { x: number; y: number; id: number } | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private tick: ReturnType<typeof setInterval> | null = null;

  protected readonly level = computed(() => this.queue[this.cur()] ?? LEVELS.hemicycle[0]);
  protected readonly over = computed(() => this.phase() === 'over');
  protected readonly canPlay = computed(() => this.phase() === 'play');
  protected readonly canUndo = computed(() => (this.phase() === 'play' || this.phase() === 'stuck') && this.histLen() > 0);

  /** Règles en vigueur et cases des mots qui les forment */
  private readonly parsed = computed(() => {
    const used = new Set<number>();
    const rules = parseRules(this.st(), used);
    return { rules, used, pm: propMap(rules) };
  });

  protected readonly views = computed<View[]>(() => {
    const { used, pm } = this.parsed();
    const st = this.st();
    const g = this.gen();
    // Objets identiques empilés sur une même case : un badge « ×n » sur le dernier
    const piles = new Map<string, number>();
    for (const o of st.objs) if (!isWord(o.k)) { const key = `${o.x},${o.y},${o.k}`; piles.set(key, (piles.get(key) ?? 0) + 1); }
    const shown = new Set<string>();
    return st.objs.map(o => {
      if (isWord(o.k)) {
        const w = wordOf(o.k);
        const lines = LABEL[w];
        const kind = isNoun(w) ? 'noun' : isProp(w) ? 'prop' : 'op';
        const active = used.has(o.y * st.w + o.x);
        const tl = lines.map(l => Math.min(86, l.length * (lines.length > 1 ? 19 : 21)));
        return { key: g + ':' + o.id, id: o.id, k: o.k, x: o.x, y: o.y, word: w, cls: `word ${kind}${active ? '' : ' idle'}`, lines, color: COLOR[w], tl, stack: 0 };
      }
      const cls = ['thing'];
      if (o.k === 'mur') cls.push('wall');
      if (has(pm, o.k, 'toi')) cls.push('you');
      if (has(pm, o.k, 'gagne')) cls.push('win');
      if (has(pm, o.k, 'coule')) cls.push('sink');
      const key = `${o.x},${o.y},${o.k}`;
      const n = piles.get(key) ?? 1;
      const stack = n > 1 && !shown.has(key) ? n : 0;
      if (stack) shown.add(key);
      return { key: g + ':' + o.id, id: o.id, k: o.k, x: o.x, y: o.y, word: null, cls: cls.join(' '), lines: [], color: COLOR[o.k as Noun] ?? '#fff', tl: [], stack };
    });
  });

  protected readonly ruleList = computed(() => {
    const rank = (r: Rule) => (isProp(r.o) ? PROP_ORDER.indexOf(r.o) : 20);
    return [...this.parsed().rules].sort((a, b) => rank(a) - rank(b) || a.s.localeCompare(b.s)).map(r => ({
      key: r.s + '>' + r.o,
      s: LABEL[r.s].join(''), sc: COLOR[r.s],
      o: LABEL[r.o].join(''), oc: COLOR[r.o], prop: isProp(r.o),
      hint: isProp(r.o) ? PROP_HINT[r.o] : `chaque ${LABEL[r.s].join('').toLowerCase()} devient ${LABEL[r.o].join('').toLowerCase()}`,
    }));
  });

  protected readonly status = computed(() => {
    switch (this.phase()) {
      case 'won': return this.cur() === this.lastIndex() ? 'Règle respectée ! Dernier niveau de la séance.' : 'Règle respectée ! Niveau suivant…';
      case 'stuck': return 'Plus rien n’est TOI : annulez (↶) ou recommencez.';
      case 'over': return this.verdict();
      default:
        if (this.moves() === 0) return `Touchez ce qui est GAGNE avec ce qui est TOI. Les mots se poussent.`;
        return '';
    }
  });

  protected readonly clock = computed(() => {
    const t = Math.max(0, this.timeLeft());
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  });

  ngOnInit(): void {
    const id = this.def().id;
    this.variant = id.includes('ministere') ? 'ministere' : id.includes('campagne') ? 'campagne' : 'hemicycle';
    this.theme = THEMES[this.variant];
    this.queue = sessionLevels(this.variant, this.diff());
    this.results.set(this.queue.map(() => null));
    // 5 à 8 minutes selon la difficulté des niveaux tirés
    this.budget = Math.max(300, Math.min(480, this.queue.reduce((t, lv) => t + 60 + 40 * lv.tier, 0)));
    this.timeLeft.set(this.budget);
    this.load(0);
    this.tick = setInterval(() => {
      if (this.over()) return;
      this.timeLeft.update(t => t - 1);
      if (this.timeLeft() <= 0) this.finish(true);
      else this.emitProgress();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.timers.forEach(t => clearTimeout(t));
    if (this.tick) clearInterval(this.tick);
  }

  /* ── Déroulé de la séance ── */

  private lastIndex(): number { return this.queue.length - 1; }

  private load(i: number): void {
    this.cur.set(i);
    this.gen.update(g => g + 1);
    this.st.set(buildLevel(this.variant, this.queue[i]));
    this.moves.set(0);
    this.history = [];
    this.histLen.set(0);
    this.puffs.set([]);
    this.phase.set('play');
    this.emitProgress();
  }

  protected pick(i: number): void {
    if (this.over() || this.phase() === 'won' || this.results()[i] !== null || i === this.cur()) return;
    this.load(i);
  }

  private nextOpen(): number {
    const r = this.results();
    for (let k = 1; k <= r.length; k++) { const j = (this.cur() + k) % r.length; if (r[j] === null) return j; }
    return -1;
  }

  private advance(): void {
    const j = this.nextOpen();
    if (j < 0) this.finish(false);
    else this.load(j);
  }

  protected skip(): void {
    if (this.over() || this.phase() === 'won') return;
    this.results.update(r => r.map((v, k) => (k === this.cur() ? -1 : v)));
    this.miss.emit();
    this.advance();
  }

  private score(): number {
    const r = this.results();
    let num = 0, den = 0;
    this.queue.forEach((lv, i) => { const w = levelWeight(lv); den += w; num += w * levelScore(lv, r[i] !== null && r[i]! >= 0 ? r[i] : null); });
    return den ? num / den : 0;
  }

  private emitProgress(): void {
    this.progress.emit({ live: this.score(), time: Math.max(0, this.timeLeft() / this.budget) });
  }

  private finish(timeout: boolean): void {
    if (this.over()) return;
    this.phase.set('over');
    if (this.tick) { clearInterval(this.tick); this.tick = null; }
    const solved = this.results().filter(v => v !== null && v >= 0).length;
    const s = this.score();
    this.verdict.set(
      (timeout ? 'Temps écoulé. ' : '') +
      (solved === this.queue.length ? (s >= 0.95 ? 'Tous les niveaux, au plus court : du travail de juriste.' : 'Tous les niveaux sont adoptés.')
        : solved ? `${solved} niveau${solved > 1 ? 'x' : ''} adopté${solved > 1 ? 's' : ''} sur ${this.queue.length}.` : 'Aucun texte adopté.') +
      (solved ? ' Coups / optimum : ' + this.queue.map((lv, i) => { const m = this.results()[i]; return m !== null && m >= 0 ? `${m}/${lv.opt}` : '—'; }).join(' · ') : ''));
    if (s < 0.5) this.miss.emit();
    this.progress.emit({ live: s, time: 0 });
    this.timers.push(setTimeout(() => this.done.emit(Math.max(0.05, Math.min(1, s))), 2000));
  }

  /* ── Coups ── */

  protected move(d: Dir): void {
    if (this.phase() !== 'play') return;
    const before = this.st();
    const r = step(before, d);
    if (!r.moved) return;
    this.history.push({ st: before, moves: this.moves() });
    this.histLen.set(this.history.length);
    this.st.set(r.st);
    this.moves.update(m => m + 1);
    if (r.destroyed.length || r.transformed.length) {
      const fx: Puff[] = [
        ...r.destroyed.map(o => ({ id: ++uid, x: o.x, y: o.y, tone: (o.k === 'boue' || o.k === 'marais' || o.k === 'broyeur' ? 'sink' : 'pop') as Puff['tone'] })),
        ...r.transformed.map(o => ({ id: ++uid, x: o.x, y: o.y, tone: 'morph' as const })),
      ];
      this.puffs.update(p => [...p, ...fx]);
      this.timers.push(setTimeout(() => this.puffs.update(p => p.filter(x => !fx.includes(x))), 480));
    }
    if (this.ruleKey(before) !== this.ruleKey(r.st)) this.flashRules();
    if (r.won) return this.win();
    if (!r.you) { this.phase.set('stuck'); this.miss.emit(); }
  }

  private ruleKey(st: State): string { return parseRules(st).map(r => r.s + r.o).sort().join(); }

  private flashRules(): void {
    this.rulesFlash.set(true);
    this.timers.push(setTimeout(() => this.rulesFlash.set(false), 420));
  }

  private win(): void {
    this.phase.set('won');
    const i = this.cur();
    this.results.update(r => r.map((v, k) => (k === i ? this.moves() : v)));
    this.emitProgress();
    this.timers.push(setTimeout(() => { if (this.phase() === 'won') this.advance(); }, 1500));
  }

  protected undo(): void {
    if (!this.canUndo()) return;
    const s = this.history.pop()!;
    this.histLen.set(this.history.length);
    this.st.set(s.st);
    this.moves.set(s.moves);
    this.phase.set('play');
  }

  protected restart(): void {
    if (this.over() || this.phase() === 'won') return;
    if (this.moves() === 0 && this.phase() === 'play') return;
    // Recommencer s’annule aussi
    this.history.push({ st: this.st(), moves: this.moves() });
    this.histLen.set(this.history.length);
    this.st.set(buildLevel(this.variant, this.level()));
    this.moves.set(0);
    this.phase.set('play');
  }

  /* ── Clavier et gestes ── */

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.altKey || this.over()) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); this.undo(); return; }
    if (mod) return;
    // Déplacements : flèches, et la position physique ZQSD (AZERTY) = WASD (QWERTY)
    const dirs: Record<string, Dir> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, KeyW: 0, KeyD: 1, KeyS: 2, KeyA: 3 };
    const d = dirs[e.key] ?? dirs[e.code];
    if (d !== undefined) {
      e.preventDefault();
      const now = performance.now();
      if (e.repeat && now - this.lastMove < 110) return;
      this.lastMove = now;
      this.move(d);
      return;
    }
    if (e.key === 'Backspace' || e.key === 'u' || e.key === 'U' || e.code === 'KeyZ') { e.preventDefault(); this.undo(); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); this.restart(); }
  }

  protected swipeStart(e: PointerEvent): void {
    this.swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }

  protected swipeEnd(e: PointerEvent): void {
    const s = this.swipe;
    this.swipe = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    this.move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
  }

  /* ── Libellés ── */

  protected tierLabel(t: number): string {
    return ['', 'initiation', 'facile', 'retors', 'redoutable'][t] ?? '';
  }

  protected boardLabel(): string {
    const rules = this.ruleList().map(r => `${r.s} est ${r.o}`).join(', ');
    return `Plateau ${this.st().w} × ${this.st().h}. Règles : ${rules || 'aucune'}.`;
  }
}

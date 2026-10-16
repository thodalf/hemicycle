import { Component, HostListener, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/* ============================================================
 *  L'infiltration : un vrai puzzle d'infiltration au tour par
 *  tour (façon « Hitman GO »). Le joueur avance d'une case par
 *  tour ; les agents suivent des rondes fixes et visibles, leur
 *  regard porte droit devant (arrêté par les murs et les portes).
 *  Entrer dans un regard = être repéré·e : on vous raccompagne à
 *  l'entrée de l'étage. Trois alertes et la mission échoue.
 *  Trois variantes : ministère la nuit, réception d'ambassade,
 *  galeries sous Paris. Aucune violence : on se cache, on attend,
 *  on fait diversion.
 *
 *  Le moteur (fonctions pures exportées) est partagé par le
 *  composant et par le solveur BFS qui garantit que chaque étage
 *  se termine sans alerte et calcule le nombre de tours de
 *  référence.
 * ============================================================ */

/* ── Types ── */

export type Dir = 'N' | 'E' | 'S' | 'W';
export type GuardKind = 'agent' | 'menage' | 'camera' | 'garde' | 'serveur' | 'police' | 'cataphile';
export type Theme = 'ministere' | 'ambassade' | 'catacombes';

export interface Tools { bruit: number; cacher: number; badge: number }

/** Une ronde : points de passage « x,y x,y … » parcourus en ligne droite (aller-retour, ou boucle) ; un seul point = poste fixe qui pivote selon `look`. */
export interface GuardDef { k: GuardKind; at: string; loop?: boolean; look?: string; min?: number; max?: number }

/**
 * Plan d'un étage (9 × 9) :
 *  # mur · . sol · + porte (cache la vue) · = porte verrouillée (badge) · T mobilier · ~ eau · X attroupement
 *  C placard / P plante (cachettes) · S entrée · E sortie · O objectif · B bonus · K badge à ramasser
 */
export interface RoomDef {
  name: string; brief: string; map: string[]; guards: GuardDef[];
  obj?: { icon: string; label: string };
  bonus?: { icon: string; label: string }[];
  exit?: { icon: string; label: string };
}

export interface MissionDef {
  id: string; theme: Theme; title: string; goal: string; tools: Tools; rooms: RoomDef[];
  me: string; win: string; caught: string; late: string;
}

export interface GuardPlan { id: number; k: GuardKind; steps: { i: number; d: Dir }[]; cone: number }
export interface Room {
  def: RoomDef; w: number; h: number; tiles: string[]; start: number; exit: number; guards: GuardPlan[];
  items: number[]; required: number[]; bonus: number[]; keys: number[]; doors: number[]; label: Map<number, string>; icon: Map<number, string>;
}
export interface GuardState { id: number; i: number; d: Dir; ph: number; lure: number[] | null }
export interface Play { pos: number; guards: GuardState[]; hidden: boolean; got: number[]; open: number[]; tools: Tools }
/** `hide` : se glisser dans la cachette voisine (ou celle où l'on se tient) : invisible aussitôt */
export type Action = { t: 'move'; to: number } | { t: 'wait' } | { t: 'hide'; to?: number } | { t: 'noise'; at: number };
export interface Outcome { ok: boolean; st: Play; spotted: number | null; exit: boolean; picked: number | null; lured: number | null; unlocked: boolean }

/* ── Constantes ── */

export const NOISE_RANGE = 4;
export const HEAR_RANGE = 6;
export const MAX_ALERTS = 3;
const VEC: Record<Dir, readonly [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const ARROW: Record<Dir, string> = { N: '↑', E: '→', S: '↓', W: '←' };

export const GUARD_KINDS: Record<GuardKind, { name: string; plural: string; icon: string; cone: number; lure: boolean; wall?: boolean }> = {
  agent: { name: 'Agent de sécurité', plural: 'agents de sécurité', icon: '👮', cone: 3, lure: true },
  menage: { name: 'Agente d’entretien', plural: 'agentes d’entretien', icon: '🧹', cone: 2, lure: false },
  camera: { name: 'Caméra', plural: 'caméras', icon: '📹', cone: 3, lure: false, wall: true },
  garde: { name: 'Garde', plural: 'gardes', icon: '💂', cone: 3, lure: true },
  serveur: { name: 'Serveur', plural: 'serveurs', icon: '🤵', cone: 2, lure: false },
  police: { name: 'Policier de l’IGC', plural: 'policiers', icon: '👮', cone: 3, lure: true },
  cataphile: { name: 'Cataphile', plural: 'cataphiles', icon: '🧔', cone: 2, lure: true },
};

const BLOCK_MOVE = new Set(['#', 'T', '~', 'X']);
const isHide = (c: string) => c === 'C' || c === 'P';

/* ── Les trois missions ── */

export const MISSIONS: MissionDef[] = [
  {
    id: 'infiltration_ministere', theme: 'ministere', title: 'Le ministère, la nuit', me: '🕵️',
    goal: 'Récupérez le dossier compromettant au deuxième étage, puis ressortez sans vous faire voir.',
    tools: { bruit: 2, cacher: 2, badge: 0 },
    win: 'Le dossier dort dans votre sacoche : personne ne vous a vu·e entrer.',
    caught: 'La sécurité vous raccompagne poliment jusqu’au trottoir… La presse en fera ses choux gras.',
    late: 'Le jour se lève et la relève arrive : il faut partir les mains vides.',
    rooms: [
      {
        name: 'Le hall d’accueil', brief: 'Un agent fait le tour du comptoir d’accueil ; la caméra balaie le passage vers l’escalier.',
        map: [
          'E..+....B',
          '...#.....',
          '####.####',
          '.........',
          '.#######.',
          '.#######.',
          '.#######.',
          '.........',
          'P..TST..P',
        ],
        guards: [
          { k: 'agent', at: '0,3 8,3 8,7 0,7', loop: true },
          { k: 'menage', at: '8,3 0,3 0,7 8,7', loop: true },
          { k: 'camera', at: '5,2', look: 'WWNN' },
          { k: 'agent', at: '4,1 8,1', min: 1.15 },
        ],
        bonus: [{ icon: '📒', label: 'Registre des visiteurs' }],
        exit: { icon: '🪜', label: 'Escalier' },
      },
      {
        name: 'Le couloir des cabinets', brief: 'Un agent arpente le grand couloir. Un badge traîne peut-être dans un bureau…',
        map: [
          'S.#...#.E',
          '..+.B.=..',
          '..#...#..',
          '#+#####+#',
          '.........',
          '#+##+##+#',
          '...#.#...',
          '.K.#C#.P.',
          '...#.#...',
        ],
        guards: [
          { k: 'agent', at: '0,4 8,4' },
          { k: 'menage', at: '3,0 5,0 5,2 3,2', loop: true },
          { k: 'agent', at: '6,6 8,6 8,8 6,8', loop: true, min: 1.15 },
        ],
        bonus: [{ icon: '🧾', label: 'Notes de frais' }],
        exit: { icon: '🪜', label: 'Escalier' },
      },
      {
        name: 'Le bureau du ministre', brief: 'Le dossier est sur le bureau du ministre, qu’un agent surveille en faisant les cent pas.',
        map: [
          'B...O..T.',
          '.........',
          'P.TT.TT.P',
          '####+####',
          'S+......C',
          '####+##=#',
          '....C....',
          '.P..#.TT.',
          '....+...E',
        ],
        guards: [
          { k: 'agent', at: '0,1 8,1' },
          { k: 'menage', at: '2,4 7,4' },
          { k: 'agent', at: '5,6 8,6 8,8 5,8', loop: true },
          { k: 'camera', at: '4,7', look: 'NNWWW', min: 1.15 },
        ],
        obj: { icon: '📁', label: 'Le dossier compromettant' },
        bonus: [{ icon: '💾', label: 'Clé USB du cabinet' }],
        exit: { icon: '🚪', label: 'Sortie de service' },
      },
    ],
  },
  {
    id: 'infiltration_ambassade', theme: 'ambassade', title: 'La réception à l’ambassade', me: '🕵️',
    goal: 'Pendant la réception, glissez un message sur le bureau de l’ambassadeur sans éveiller les soupçons.',
    tools: { bruit: 2, cacher: 2, badge: 1 },
    win: 'Le message est posé sous le sous-main de l’ambassadeur. Vous reprenez une coupe, l’air de rien.',
    caught: 'Le chef du protocole vous raccompagne au vestiaire avec un sourire glacial. Quelle gêne !',
    late: 'Les invités prennent congé : rester plus longtemps serait suspect.',
    rooms: [
      {
        name: 'Le grand salon', brief: 'Traversez le salon en diagonale : les serveurs filent d’un bout à l’autre, un garde pivote au centre.',
        map: [
          'P..X....E',
          '.........',
          '.TT.X.TT.',
          '.........',
          'X.T..PT.X',
          '.........',
          '.TT.X.TT.',
          '.........',
          'S...C..BP',
        ],
        guards: [
          { k: 'serveur', at: '8,7 0,7' },
          { k: 'serveur', at: '0,5 8,5' },
          { k: 'serveur', at: '8,3 0,3' },
          { k: 'garde', at: '4,4', look: 'NESW' },
          { k: 'serveur', at: '0,1 8,1', min: 1.15 },
        ],
        bonus: [{ icon: '📇', label: 'Carte d’un attaché' }],
        exit: { icon: '🚪', label: 'Galerie' },
      },
      {
        name: 'L’office et la galerie', brief: 'Traversez l’office des serveurs, puis la galerie où un garde fait sa ronde.',
        map: [
          '....S....',
          '.T.T.T.T.',
          '.........',
          '#+#####+#',
          '.........',
          '.P.X.X.C.',
          '.........',
          '###+###=#',
          'E..+...B.',
        ],
        guards: [
          { k: 'serveur', at: '0,2 8,2' },
          { k: 'garde', at: '0,4 8,4' },
          { k: 'garde', at: '8,6 0,6' },
          { k: 'serveur', at: '4,8 8,8' },
          { k: 'garde', at: '4,5', look: 'NNSS', min: 1.15 },
        ],
        bonus: [{ icon: '📜', label: 'Plan de table' }],
        exit: { icon: '🪜', label: 'Escalier privé' },
      },
      {
        name: 'Le bureau de l’ambassadeur', brief: 'Le bureau est au fond de l’aile privée : une caméra veille, un garde fait le tour du vestibule.',
        map: [
          '..O.#....',
          '.T..+..B.',
          '....#....',
          '##+####=#',
          '.........',
          '.P.T.T.P.',
          '.........',
          '#+#####+#',
          'S.#.....E',
        ],
        guards: [
          { k: 'garde', at: '0,4 8,4 8,6 0,6', loop: true },
          { k: 'camera', at: '4,0', look: 'WWSS' },
          { k: 'serveur', at: '3,8 7,8' },
          { k: 'garde', at: '5,0 8,0 8,2 5,2', loop: true, min: 1.15 },
        ],
        obj: { icon: '✉️', label: 'Le bureau de l’ambassadeur' },
        bonus: [{ icon: '🗂️', label: 'Agenda diplomatique' }],
        exit: { icon: '🚪', label: 'Retour à la réception' },
      },
    ],
  },
  {
    id: 'infiltration_catacombes', theme: 'catacombes', title: 'Les galeries sous Paris', me: '🧑',
    goal: 'Dans les anciennes carrières, retrouvez la salle oubliée et revenez à la surface sans être contrôlé·e.',
    tools: { bruit: 3, cacher: 2, badge: 0 },
    win: 'La salle oubliée est retrouvée : une plaque de 1793 et des archives intactes. Vous remontez sans bruit.',
    caught: 'Les policiers vous raccompagnent à la surface par la première plaque venue, avec un rappel à la loi.',
    late: 'Votre lampe faiblit : il faut remonter avant de vous perdre.',
    rooms: [
      {
        name: 'La galerie d’accès', brief: 'Des cataphiles discutent dans les boyaux ; une partie de la galerie est inondée.',
        map: [
          'S..#.....',
          '.#.#.~~~.',
          '.#...~B~.',
          '.###.~.~.',
          '...#.....',
          '.#.###.#.',
          '.#.....#.',
          '.#P###.#.',
          '...#E....',
        ],
        guards: [
          { k: 'cataphile', at: '4,0 8,0 8,4 4,4', loop: true },
          { k: 'police', at: '2,6 6,6' },
          { k: 'cataphile', at: '0,4 0,8', min: 1.15 },
        ],
        bonus: [{ icon: '🖋️', label: 'Graffiti de 1871' }],
        exit: { icon: '⬇️', label: 'Puits vers l’étage inférieur' },
      },
      {
        name: 'L’ossuaire désaffecté', brief: 'Une patrouille de l’IGC fait le tour de la crypte inondée où dort le plan ancien.',
        map: [
          '....#...S',
          '.TT.+.T..',
          '.T......#',
          '.T.~~~.T.',
          '...~O~...',
          '.T.~.~.T.',
          '#P.......',
          '...T.TT..',
          'E...#...B',
        ],
        guards: [
          { k: 'police', at: '2,2 6,2 6,6 2,6', loop: true },
          { k: 'police', at: '1,8 3,8' },
          { k: 'cataphile', at: '8,3 8,7' },
          { k: 'cataphile', at: '0,0 0,5', min: 1.15 },
        ],
        obj: { icon: '🗺️', label: 'Le plan de 1793' },
        bonus: [{ icon: '🕯️', label: 'Lanterne de carrier' }],
        exit: { icon: '⬇️', label: 'Chatière' },
      },
      {
        name: 'La salle oubliée', brief: 'La salle oubliée est derrière une grille cadenassée : la clé doit traîner quelque part.',
        map: [
          'E..#.....',
          '.#.#.#=#.',
          '.#...#O#.',
          '.####.#..',
          '...~~....',
          '.#....#.#',
          '.#.#~.#..',
          '.P.#.....',
          'B..#S..K.',
        ],
        guards: [
          { k: 'police', at: '5,4 8,4' },
          { k: 'cataphile', at: '0,0 0,7' },
          { k: 'police', at: '7,3 7,7', min: 1.15 },
        ],
        obj: { icon: '🏛️', label: 'La salle oubliée' },
        bonus: [{ icon: '📜', label: 'Archives de 1793' }],
        exit: { icon: '⬆️', label: 'Remontée vers la surface' },
      },
    ],
  },
];

/* ── Construction des étages ── */

export function missionFor(id: string): MissionDef {
  return MISSIONS.find(m => m.id === id)
    ?? (id.includes('ambassad') ? MISSIONS[1] : id.includes('catacomb') || id.includes('carri') ? MISSIONS[2] : MISSIONS[0]);
}

/** Portée du regard selon la difficulté : plus courte quand on est en forme, plus longue sous la fatigue */
export function coneFor(k: GuardKind, diff: number): number {
  const base = GUARD_KINDS[k].cone;
  if (diff <= 0.85) return Math.max(2, base - 1);
  if (diff >= 1.25) return base + 1;
  return base;
}

function dirTo(w: number, a: number, b: number): Dir {
  const dx = (b % w) - (a % w), dy = Math.floor(b / w) - Math.floor(a / w);
  return dx > 0 ? 'E' : dx < 0 ? 'W' : dy > 0 ? 'S' : 'N';
}

/** Déplie une ronde en pas { case, regard } : aller-retour (demi-tour sur place aux extrémités) ou boucle */
export function expandRoute(g: GuardDef, w: number): { i: number; d: Dir }[] {
  const pts = g.at.trim().split(/\s+/).map(s => s.split(',').map(Number));
  if (pts.length === 1) return [...(g.look ?? 'S')].map(c => ({ i: pts[0][1] * w + pts[0][0], d: c as Dir }));
  const path: number[] = [pts[0][1] * w + pts[0][0]];
  const seq = g.loop ? [...pts.slice(1), pts[0]] : pts.slice(1);
  for (const [tx, ty] of seq) {
    let x = path[path.length - 1] % w, y = Math.floor(path[path.length - 1] / w);
    while (x !== tx || y !== ty) {
      if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y);
      path.push(y * w + x);
    }
  }
  if (g.loop) {
    path.pop();
    return path.map((i, k) => ({ i, d: dirTo(w, i, path[(k + 1) % path.length]) }));
  }
  const m = path.length - 1, out: { i: number; d: Dir }[] = [];
  for (let k = 0; k < m; k++) out.push({ i: path[k], d: dirTo(w, path[k], path[k + 1]) });
  out.push({ i: path[m], d: dirTo(w, path[m - 1], path[m]) });
  for (let k = m; k > 0; k--) out.push({ i: path[k], d: dirTo(w, path[k], path[k - 1]) });
  out.push({ i: path[0], d: dirTo(w, path[1], path[0]) });
  return out;
}

export function buildRoom(def: RoomDef, diff: number): Room {
  const h = def.map.length, w = def.map[0].length;
  const tiles = def.map.join('').split('');
  const find = (c: string) => tiles.map((t, i) => (t === c ? i : -1)).filter(i => i >= 0);
  const required = find('O'), bonus = find('B'), keys = find('K');
  const label = new Map<number, string>(), icon = new Map<number, string>();
  required.forEach(i => { label.set(i, def.obj?.label ?? 'Objectif'); icon.set(i, def.obj?.icon ?? '🎯'); });
  bonus.forEach((i, k) => { label.set(i, def.bonus?.[k]?.label ?? 'Bonus'); icon.set(i, def.bonus?.[k]?.icon ?? '✨'); });
  keys.forEach(i => { label.set(i, 'Badge d’accès'); icon.set(i, '🪪'); });
  const guards = def.guards
    .filter(g => diff >= (g.min ?? 0) && diff < (g.max ?? 99))
    .map((g, id): GuardPlan => ({ id, k: g.k, steps: expandRoute(g, w), cone: coneFor(g.k, diff) }));
  return {
    def, w, h, tiles, start: find('S')[0], exit: find('E')[0], guards,
    items: [...required, ...bonus, ...keys], required, bonus, keys, doors: find('='), label, icon,
  };
}

export function buildMission(id: string, diff: number): { m: MissionDef; rooms: Room[] } {
  const m = missionFor(id);
  return { m, rooms: m.rooms.map(r => buildRoom(r, diff)) };
}

/* ── Règles ── */

export function neighbors(room: Room, i: number): number[] {
  const x = i % room.w, y = Math.floor(i / room.w), out: number[] = [];
  if (y > 0) out.push(i - room.w);
  if (x < room.w - 1) out.push(i + 1);
  if (y < room.h - 1) out.push(i + room.w);
  if (x > 0) out.push(i - 1);
  return out;
}

export function walkable(room: Room, i: number, open: number[]): boolean {
  const c = room.tiles[i];
  if (BLOCK_MOVE.has(c)) return false;
  return c !== '=' || open.includes(i);
}

/** Les agents ne passent ni par les cachettes ni par les portes verrouillées */
export function guardWalkable(room: Room, i: number, open: number[]): boolean {
  return walkable(room, i, open) && !isHide(room.tiles[i]);
}

export function guardsInit(room: Room): GuardState[] {
  return room.guards.map(g => ({ id: g.id, i: g.steps[0].i, d: g.steps[0].d, ph: 0, lure: null }));
}

export function guardsNext(room: Room, gs: GuardState[]): GuardState[] {
  return gs.map(g => {
    if (g.lure) {
      if (!g.lure.length) return g;
      const n = g.lure[0];
      return { ...g, i: n, d: dirTo(room.w, g.i, n), lure: g.lure.slice(1) };
    }
    const steps = room.guards[g.id].steps, ph = (g.ph + 1) % steps.length;
    return { ...g, i: steps[ph].i, d: steps[ph].d, ph };
  });
}

/** Cases vues par un agent : droit devant, sur `cone` cases ; murs et attroupements arrêtent le regard, une porte est vue mais cache la suite */
export function sight(room: Room, g: GuardState): number[] {
  const out: number[] = [], [dx, dy] = VEC[g.d], cone = room.guards[g.id].cone;
  let x = g.i % room.w, y = Math.floor(g.i / room.w);
  for (let k = 1; k <= cone; k++) {
    x += dx; y += dy;
    if (x < 0 || y < 0 || x >= room.w || y >= room.h) break;
    const i = y * room.w + x, c = room.tiles[i];
    if (c === '#' || c === 'X') break;
    out.push(i);
    if (c === '+' || c === '=') break;
  }
  return out;
}

/** Case → agent qui la regarde */
export function watchMap(room: Room, gs: GuardState[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const g of gs) for (const t of sight(room, g)) if (!m.has(t)) m.set(t, g.id);
  return m;
}

const onFloor = (room: Room, g: GuardState) => !GUARD_KINDS[room.guards[g.id].k].wall;

export function startPlay(room: Room, tools: Tools, got: number[] = [], open: number[] = []): Play {
  return { pos: room.start, guards: guardsInit(room), hidden: false, got, open, tools: { ...tools } };
}

/** Chemin le plus court d'un agent vers une case (sans la case de départ), dans la limite de `max` pas */
function guardPath(room: Room, from: number, to: number, open: number[], max: number): number[] | null {
  if (from === to) return null;
  const prev = new Map<number, number>([[from, -1]]);
  let frontier = [from];
  for (let d = 0; d < max && frontier.length; d++) {
    const next: number[] = [];
    for (const c of frontier) for (const n of neighbors(room, c)) {
      if (prev.has(n) || !guardWalkable(room, n, open)) continue;
      prev.set(n, c);
      if (n === to) {
        const path = [n];
        let p = c;
        while (p !== from) { path.unshift(p); p = prev.get(p)!; }
        return path;
      }
      next.push(n);
    }
    frontier = next;
  }
  return null;
}

/** Qui viendrait vérifier un bruit sur cette case ? (l'agent « curieux » le plus proche, à six pas au plus) */
export function lureTarget(room: Room, st: Play, at: number): { id: number; path: number[] } | null {
  if (st.tools.bruit <= 0 || at === st.pos) return null;
  const md = Math.abs((at % room.w) - (st.pos % room.w)) + Math.abs(Math.floor(at / room.w) - Math.floor(st.pos / room.w));
  if (md > NOISE_RANGE || !guardWalkable(room, at, st.open)) return null;
  let best: { id: number; path: number[] } | null = null;
  for (const g of st.guards) {
    if (!GUARD_KINDS[room.guards[g.id].k].lure) continue;
    const path = guardPath(room, g.i, at, st.open, HEAR_RANGE);
    if (path && (!best || path.length < best.path.length)) best = { id: g.id, path };
  }
  return best;
}

/** Cachettes où l'on peut se glisser ce tour-ci (la sienne, ou une voisine libre) */
export function hideTargets(room: Room, st: Play): number[] {
  if (st.tools.cacher <= 0) return [];
  const out = neighbors(room, st.pos).filter(n => isHide(room.tiles[n]) && canMove(room, st, n));
  if (isHide(room.tiles[st.pos]) && !st.hidden) out.unshift(st.pos);
  return out;
}

export function canMove(room: Room, st: Play, to: number): boolean {
  if (!neighbors(room, st.pos).includes(to)) return false;
  if (room.tiles[to] === '=' && !st.open.includes(to)) { if (st.tools.badge <= 0) return false; }
  else if (!walkable(room, to, st.open)) return false;
  return !st.guards.some(g => onFloor(room, g) && g.i === to);
}

/**
 * Résout un tour : l'action du joueur, puis le pas des agents.
 * Repéré si l'on entre dans un regard, si un agent se tourne vers vous ou vous percute.
 * Un objet ramassé au moment où l'on est repéré est reposé.
 */
export function act(room: Room, st: Play, a: Action): Outcome {
  const out: Outcome = { ok: false, st, spotted: null, exit: false, picked: null, lured: null, unlocked: false };
  let { pos, hidden, open, guards } = st;
  const tools = { ...st.tools };
  let got = st.got, picked: number | null = null;
  if (a.t === 'move') {
    if (!canMove(room, st, a.to)) return out;
    if (room.tiles[a.to] === '=' && !open.includes(a.to)) { tools.badge--; open = [...open, a.to]; out.unlocked = true; }
    pos = a.to; hidden = false;
    if (room.items.includes(pos) && !got.includes(pos)) picked = pos;
  } else if (a.t === 'hide') {
    if (!hideTargets(room, st).includes(a.to ?? pos)) return out;
    tools.cacher--; hidden = true; pos = a.to ?? pos;
  } else if (a.t === 'noise') {
    const t = lureTarget(room, st, a.at);
    if (!t) return out;
    tools.bruit--;
    guards = guards.map(g => (g.id === t.id ? { ...g, lure: t.path } : g));
    out.lured = t.id;
  }
  out.ok = true;
  const spot = (by: number, gs: GuardState[]): Outcome => ({ ...out, spotted: by, st: { pos, guards: gs, hidden: false, got, open, tools } });
  // 1. On entre dans un regard
  if (!hidden) { const w = watchMap(room, guards).get(pos); if (w !== undefined) return spot(w, guards); }
  if (picked !== null) {
    got = [...got, picked]; out.picked = picked;
    if (room.keys.includes(picked)) tools.badge++;
  }
  // 2. La sortie : l'étage est franchi avant que les agents ne bougent
  if (pos === room.exit && room.required.every(r => got.includes(r))) {
    return { ...out, exit: true, st: { pos, guards, hidden, got, open, tools } };
  }
  // 3. Les agents avancent d'un pas
  const next = guardsNext(room, guards);
  if (!hidden) {
    const bump = next.find(g => onFloor(room, g) && g.i === pos);
    if (bump) { got = st.got; return spot(bump.id, next); }
    const w = watchMap(room, next).get(pos);
    if (w !== undefined) { got = st.got; if (picked !== null && room.keys.includes(picked)) tools.badge--; return spot(w, next); }
  }
  return { ...out, st: { pos, guards: next, hidden, got, open, tools } };
}

/* ── Solveur : BFS sur (case × phase des rondes × objets × cachette × outils) ── */

export interface SolveOpts { bonus?: boolean; hides?: number; badges?: number }
export interface Solution { turns: number; actions: Action[]; hides: number; badges: number }

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** Plus court chemin sans aucune alerte (sans bruit : les diversions ne font que raccourcir). Outils illimités si non précisés. */
export function solveRoom(room: Room, o: SolveOpts = {}): Solution | null {
  const P = room.w * room.h;
  const L = room.guards.reduce((l, g) => (l * g.steps.length) / gcd(l, g.steps.length), 1);
  const seen: Uint8Array[] = [], occ: Uint8Array[] = [];
  for (let p = 0; p < L; p++) {
    const se = new Uint8Array(P), oc = new Uint8Array(P);
    for (const g of room.guards) {
      const s = g.steps[p % g.steps.length], st: GuardState = { id: g.id, i: s.i, d: s.d, ph: p % g.steps.length, lure: null };
      for (const t of sight(room, st)) se[t] = 1;
      if (!GUARD_KINDS[g.k].wall) oc[s.i] = 1;
    }
    seen.push(se); occ.push(oc);
  }
  const bit = new Map<number, number>(room.items.map((t, k) => [t, 1 << k]));
  let need = 0;
  for (const t of room.required) need |= bit.get(t)!;
  if (o.bonus) for (const t of room.bonus) need |= bit.get(t)!;
  const M = 1 << room.items.length;
  const trackH = o.hides !== undefined, trackB = o.badges !== undefined;
  const H0 = o.hides ?? 0, B0 = o.badges ?? 0, maxB = B0 + room.keys.length;
  const Hs = trackH ? H0 + 1 : 1, Bs = trackB ? maxB + 1 : 1, D = trackB ? 1 << room.doors.length : 1;
  const N = P * L * M * 2 * Hs * Bs * D;
  if (N > 2e7) return null;
  const enc = (pos: number, p: number, m: number, hid: number, h: number, b: number, dm: number) =>
    ((((((pos * L + p) * M + m) * 2 + hid) * Hs + h) * Bs + b) * D + dm);
  const parent = new Int32Array(N).fill(-1), how = new Int16Array(N);
  const queue = new Int32Array(N);
  const s0 = enc(room.start, 0, 0, 0, trackH ? H0 : 0, trackB ? B0 : 0, 0);
  parent[s0] = s0;
  let qh = 0, qt = 0;
  queue[qt++] = s0;
  const rebuild = (k: number, last: number) => {
    const acts: Action[] = [{ t: 'move', to: last }];
    while (parent[k] !== k) {
      const a = how[k];
      acts.unshift(a >= 0 ? { t: 'move', to: a } : a === -1 ? { t: 'wait' } : a === -2 ? { t: 'hide' } : { t: 'hide', to: -3 - a });
      k = parent[k];
    }
    return acts;
  };
  while (qh < qt) {
    const k = queue[qh++];
    let r = k;
    const dm = r % D; r = (r - dm) / D;
    const b = r % Bs; r = (r - b) / Bs;
    const h = r % Hs; r = (r - h) / Hs;
    const hid = r % 2; r = (r - hid) / 2;
    const m = r % M; r = (r - m) / M;
    const p = r % L; const pos = (r - p) / L;
    const p1 = (p + 1) % L;
    const push = (n: number, a: number) => { if (parent[n] < 0) { parent[n] = k; how[n] = a; queue[qt++] = n; } };
    for (const n of neighbors(room, pos)) {
      const c = room.tiles[n];
      if (BLOCK_MOVE.has(c) || occ[p][n] || seen[p][n]) continue;
      let nb = b, ndm = dm;
      if (c === '=' && trackB) {
        const di = 1 << room.doors.indexOf(n);
        if (!(dm & di)) { if (!b) continue; nb = b - 1; ndm = dm | di; }
      }
      const ib = bit.get(n) ?? 0, nm = m | ib;
      if (trackB && ib && !(m & ib) && room.keys.includes(n)) nb = Math.min(maxB, nb + 1);
      if (n === room.exit && (nm & need) === need) {
        const acts = rebuild(k, n);
        const doors = new Set(acts.flatMap(a => (a.t === 'move' && room.tiles[a.to] === '=' ? [a.to] : [])));
        return { turns: acts.length, actions: acts, hides: acts.filter(a => a.t === 'hide').length, badges: doors.size };
      }
      if (seen[p1][n] || occ[p1][n]) continue;
      push(enc(n, p1, nm, 0, h, nb, ndm), n);
    }
    if (hid || (!seen[p1][pos] && !occ[p1][pos])) push(enc(pos, p1, m, hid, h, b, dm), -1);
    if (!trackH || h > 0) {
      const nh = trackH ? h - 1 : 0;
      if (!hid && isHide(room.tiles[pos])) push(enc(pos, p1, m, 1, nh, b, dm), -2);
      for (const n of neighbors(room, pos)) if (isHide(room.tiles[n]) && !occ[p][n]) push(enc(n, p1, m, 1, nh, b, dm), -3 - n);
    }
  }
  return null;
}

/* ── Score ── */

export interface RunStats { ok: boolean; rooms: number; cleared: number; alerts: number; bonus: number; bonusMax: number; turns: number; budget: number; par: number }

/** Réussite : 0,40 + discrétion 0,25 + bonus 0,17 + rapidité 0,18. Échec : 0,08 à 0,40 selon les étages franchis. */
export function scoreRun(s: RunStats): number {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  if (!s.ok) return Math.max(0.05, Math.min(0.4, 0.08 + 0.26 * (s.cleared / s.rooms) + 0.03 * s.bonus));
  const stealth = clamp(1 - s.alerts / (MAX_ALERTS - 1));
  const bonus = s.bonusMax ? s.bonus / s.bonusMax : 1;
  const eff = clamp((s.budget - s.turns) / Math.max(1, s.budget - s.par));
  return clamp(0.4 + 0.25 * stealth + 0.17 * bonus + 0.18 * eff);
}

/** Budget de tours : la référence du solveur (avec tous les bonus) plus une marge qui fond avec la difficulté */
export function turnBudget(par: number, diff: number, rooms: number): number {
  const slack = Math.max(0.3, Math.min(0.8, 1.25 - 0.65 * diff));
  return Math.round(par * (1 + slack)) + 2 * rooms;
}

/** Tours de référence : chaque étage au plus court, avec tous les bonus, en tenant compte des outils restants (cachettes, badges) */
export function missionPar(rooms: Room[], tools: Tools): number {
  let t = 0, hides = tools.cacher, badges = tools.badge;
  for (const r of rooms) {
    const s = solveRoom(r, { bonus: true, hides, badges }) ?? solveRoom(r, { hides, badges }) ?? solveRoom(r, { bonus: true }) ?? solveRoom(r);
    if (!s) { t += 30; continue; }
    t += s.turns;
    hides = Math.max(0, hides - s.hides);
    badges = Math.max(0, badges + s.actions.filter(a => a.t === 'move' && r.keys.includes(a.to)).length - s.badges);
  }
  return t;
}

/* ── Le composant ── */

interface Fx { i: number; text: string; tone: 'bang' | 'huh' | 'got'; id: number }
interface Summary { ok: boolean; title: string; text: string; rows: [string, string][]; score: number }

const TILE: Record<Theme, Record<string, { icon: string; label: string }>> = {
  ministere: {
    '#': { icon: '', label: 'Mur' }, '.': { icon: '', label: 'Parquet' }, '+': { icon: '', label: 'Porte' }, '=': { icon: '🔒', label: 'Porte verrouillée' },
    T: { icon: '🖥️', label: 'Bureau' }, X: { icon: '📦', label: 'Cartons' }, '~': { icon: '💧', label: 'Flaque' }, C: { icon: '🗄️', label: 'Placard (cachette)' },
    P: { icon: '🪴', label: 'Plante (cachette)' }, S: { icon: '', label: 'Entrée' },
  },
  ambassade: {
    '#': { icon: '', label: 'Mur' }, '.': { icon: '', label: 'Marbre' }, '+': { icon: '', label: 'Porte' }, '=': { icon: '🔒', label: 'Porte verrouillée' },
    T: { icon: '🥂', label: 'Buffet' }, X: { icon: '👥', label: 'Invités en grande conversation' }, '~': { icon: '💧', label: 'Fontaine' },
    C: { icon: '🧥', label: 'Vestiaire (cachette)' }, P: { icon: '🪴', label: 'Palmier en pot (cachette)' }, S: { icon: '', label: 'Entrée' },
  },
  catacombes: {
    '#': { icon: '', label: 'Roche' }, '.': { icon: '', label: 'Galerie' }, '+': { icon: '', label: 'Passage' }, '=': { icon: '🔒', label: 'Grille cadenassée' },
    T: { icon: '🪨', label: 'Éboulis' }, X: { icon: '🧺', label: 'Pique-nique de cataphiles' }, '~': { icon: '', label: 'Galerie inondée' },
    C: { icon: '🕳️', label: 'Niche (cachette)' }, P: { icon: '🕳️', label: 'Niche (cachette)' }, S: { icon: '', label: 'Entrée' },
  },
};

let uid = 0;
let planSeq = 0;

/* ── Le plan dessiné (vue de dessus, une case = 10 unités) ── */

interface Prop { k: string; x: number; y: number; w: number; r: number; v: number }
interface Lamp { x: number; y: number; r: number; c: string }
interface Plan { walls: { x: number; y: number }[]; stubs: { x: number; y: number; w: number; h: number }[]; props: Prop[]; lamps: Lamp[] }

const ANGLE: Record<Dir, number> = { N: 0, E: 90, S: 180, W: 270 };
/** Assombrissement de la nuit et teinte, par thème */
const NIGHT: Record<Theme, { a: number; c: string; me: number }> = {
  ministere: { a: 0.5, c: '#060a18', me: 9 },
  ambassade: { a: 0.22, c: '#140c04', me: 0 },
  catacombes: { a: 0.6, c: '#040302', me: 21 },
};
/** Lumière portée par chaque genre d'agent (lampe torche, frontale, simple regard) */
const BEAM: Record<GuardKind, { c: string; a: number }> = {
  agent: { c: '#ffe2a6', a: 0.62 }, police: { c: '#ffe7b2', a: 0.62 }, garde: { c: '#ffe0a0', a: 0.5 }, cataphile: { c: '#fff0bf', a: 0.58 },
  menage: { c: '#f3ead8', a: 0.38 }, serveur: { c: '#fff2dc', a: 0.34 }, camera: { c: '#cfe4ff', a: 0.5 },
};
/** Objets dessinés selon leur emoji de définition */
const ITEM_KIND: Record<string, string> = {
  '📁': 'folder', '✉️': 'envelope', '🗺️': 'map', '🏛️': 'plaque', '📒': 'ledger', '🧾': 'receipt', '💾': 'usb', '📇': 'card',
  '📜': 'scroll', '🗂️': 'agenda', '🖋️': 'graffiti', '🕯️': 'lantern', '🪪': 'badge',
};
const RUBBLE = [
  'M1.2 6.4 L2.4 4.2 L4.6 4.6 L5 7 L3 8.2 Z', 'M5.2 3.2 L7.4 2 L8.8 3.8 L7.6 5.6 L5.6 5.2 Z', 'M5.4 6.4 L7.6 6 L8.8 8.2 L6.6 9 L5 8.2 Z',
  'M2 1.6 L3.8 1.2 L4.4 2.8 L2.6 3.4 Z', 'M3.6 8.6 L4.8 8 L5.4 9.2 L4.2 9.6 Z',
];
const PARQUET = [0, 1, 2, 3].flatMap(r => [-1, 0, 1].map(k => ({ x: [0, 10, 5, 15][r] + k * 20, y: r * 2.5, c: ['#b0804f', '#a87747', '#b98a58', '#a2723f', '#ac7b4a'][(r * 3 + k + 7) % 5] })));

function buildPlan(room: Room, theme: Theme): Plan {
  const { w, h, tiles } = room;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? '#' : tiles[y * w + x]);
  const walls: Plan['walls'] = [], stubs: Plan['stubs'] = [], props: Prop[] = [], lamps: Lamp[] = [];
  const blocked = (c: string) => c === '#' || c === 'T' || c === 'X';
  /** Le dos d'un meuble contre le mur le plus proche */
  const backTo = (x: number, y: number) => (at(x, y - 1) === '#' ? 0 : at(x + 1, y) === '#' ? 90 : at(x, y + 1) === '#' ? 180 : at(x - 1, y) === '#' ? 270 : 0);
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = at(x, y), v = (x * 7 + y * 13) % 4;
      if (c === '#') { walls.push({ x, y }); continue; }
      if (c === 'T') {
        if (theme === 'catacombes') { props.push({ k: 'rubble', x, y, w: 1, r: ((x + y) % 4) * 90, v }); continue; }
        if (at(x - 1, y) === 'T') continue;
        let run = 1;
        while (at(x + run, y) === 'T') run++;
        const up = !blocked(at(x, y - 1)) && blocked(at(x, y + 1));
        props.push({ k: theme === 'ambassade' ? 'buffet' : 'desk', x, y, w: run, r: up ? 180 : 0, v: n++ });
        if (theme === 'ministere') lamps.push({ x: x * 10 + 2, y: y * 10 + (up ? 7.5 : 2.5), r: 9, c: '#ffd98a' });
        continue;
      }
      if (c === 'X') {
        props.push({ k: theme === 'ministere' ? 'boxes' : theme === 'ambassade' ? 'guests' : 'picnic', x, y, w: 1, r: v * 90, v: n++ });
        if (theme === 'catacombes') lamps.push({ x: x * 10 + 5, y: y * 10 + 5, r: 16, c: '#ffc46a' });
        continue;
      }
      if (c === '~') { props.push({ k: 'water', x, y, w: 1, r: 0, v }); continue; }
      if (c === 'C' || c === 'P') {
        const k = theme === 'catacombes' ? 'niche' : c === 'C' ? (theme === 'ambassade' ? 'coats' : 'cabinet') : theme === 'ambassade' ? 'palm' : 'plant';
        props.push({ k, x, y, w: 1, r: backTo(x, y), v });
        continue;
      }
      if (c === 'S') { props.push({ k: theme === 'catacombes' ? 'ladder' : 'mat', x, y, w: 1, r: backTo(x, y), v }); continue; }
      if (c === 'E') {
        const lb = room.def.exit?.label ?? '', ic = room.def.exit?.icon ?? '';
        const k = /scalier/i.test(lb) || ic === '🪜' ? 'stairs' : ic === '⬆️' ? 'up' : /chati/i.test(lb) ? 'hole' : ic === '⬇️' ? 'shaft' : 'exit';
        props.push({ k, x, y, w: 1, r: k === 'exit' ? backTo(x, y) : 0, v });
        continue;
      }
      if (c === '+') {
        const horiz = at(x - 1, y) === '#' || at(x + 1, y) === '#';
        if (theme === 'catacombes') {
          if (horiz) stubs.push({ x: x * 10, y: y * 10, w: 1.8, h: 10 }, { x: x * 10 + 8.2, y: y * 10, w: 1.8, h: 10 });
          else stubs.push({ x: x * 10, y: y * 10, w: 10, h: 1.8 }, { x: x * 10, y: y * 10 + 8.2, w: 10, h: 1.8 });
        } else props.push({ k: 'door', x, y, w: 1, r: horiz ? 0 : 90, v });
      }
    }
  }
  if (theme === 'ambassade') {
    for (const [x, y] of [[2.5, 2.5], [6.5, 2.5], [2.5, 6.5], [6.5, 6.5]]) if (at(Math.floor(x), Math.floor(y)) !== '#') lamps.push({ x: x * 10, y: y * 10, r: 22, c: '#ffdca0' });
  }
  return { walls, stubs, props, lamps };
}

@Component({
  selector: 'app-infiltration-game',
  template: `
    <div class="inf" [class]="'inf th-' + mission.theme">
      <div class="head">
        <span class="where"><b>{{ room().def.name }}</b><small class="muted">étage {{ ri() + 1 }}/{{ rooms.length }}</small></span>
        <span class="tours" [class.low]="budget - turns() <= 5">Tours <b class="mono">{{ turns() }}</b>/{{ budget }}</span>
        <span class="alerts" role="img" [attr.aria-label]="'Alertes : ' + alerts() + ' sur ' + maxAlerts">
          @for (a of alertSlots; track a) { <i [class.on]="a < alerts()"></i> }
        </span>
      </div>
      <div class="goals">
        @for (t of room().required; track t) {
          <span class="gchip" [class.good]="st().got.includes(t)"><svg class="gi" viewBox="0 0 10 10" aria-hidden="true"><use [attr.href]="'#' + sid('i-' + itemKind(t))" width="10" height="10" /></svg>{{ room().label.get(t) }} {{ st().got.includes(t) ? '✓' : '' }}</span>
        }
        @for (t of room().bonus; track t) {
          <span class="gchip" [class.accent]="st().got.includes(t)"><svg class="gi" viewBox="0 0 10 10" aria-hidden="true"><use [attr.href]="'#' + sid('i-' + itemKind(t))" width="10" height="10" /></svg>Bonus : {{ room().label.get(t) }} {{ st().got.includes(t) ? '✓' : '' }}</span>
        }
        <span class="gchip" [class.good]="exitReady()"><svg class="gi" viewBox="0 0 10 10" aria-hidden="true"><use [attr.href]="'#' + sid('i-exit')" width="10" height="10" /></svg>{{ room().def.exit?.label ?? 'Sortie' }}</span>
      </div>
      <p class="brief">
        @if (over()) { <b>{{ summary()?.title }}</b> }
        @else if (banner()) { <b>{{ banner() }}</b> }
        @else if (mode() === 'hide') { Touchez une cachette cerclée : vous vous y glissez, invisible aussitôt. }
        @else if (mode() === 'noise') { Touchez une case cerclée : le curieux le plus proche viendra vérifier… et y restera. Touchez ailleurs pour annuler. }
        @else { {{ room().def.brief }} }
      </p>

      <div class="board" [class.shake]="shake()">
        <div class="grid" [style.grid-template-columns]="'repeat(' + room().w + ', 1fr)'" role="group" [attr.aria-label]="'Plan : ' + room().def.name">
          @let W = room().w * 10;
          @let H = room().h * 10;
          @let pl = plan();
          <!-- Le plan : sols, murs et ombres portées, mobilier -->
          <svg class="plan" [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter [attr.id]="sid('wsh')" x="-5%" y="-5%" width="115%" height="115%"><feDropShadow dx="1.1" dy="1.4" stdDeviation="1" flood-color="#000" flood-opacity=".6" /></filter>
              <filter [attr.id]="sid('psh')" x="-20%" y="-20%" width="150%" height="150%"><feDropShadow dx=".5" dy=".7" stdDeviation=".45" flood-color="#000" flood-opacity=".5" /></filter>
              <filter [attr.id]="sid('rock')" x="-5%" y="-5%" width="115%" height="115%">
                <feTurbulence type="fractalNoise" baseFrequency=".22" numOctaves="2" seed="3" result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="d" />
                <feDropShadow in="d" dx="1" dy="1.3" stdDeviation="1.1" flood-color="#000" flood-opacity=".75" />
              </filter>
              <filter [attr.id]="sid('ripple')" x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency=".3" numOctaves="1" seed="8" result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
              </filter>
              <filter [attr.id]="sid('grain')" x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" [attr.baseFrequency]="mission.theme === 'ministere' ? '.05 .9' : '.7'" numOctaves="3" seed="4" />
                <feColorMatrix type="matrix" values="0 0 0 0 .1  0 0 0 0 .07  0 0 0 0 .04  0 0 0 -1.1 .62" />
              </filter>
              <filter [attr.id]="sid('veins')" x="0" y="0" width="100%" height="100%">
                <feTurbulence type="turbulence" baseFrequency=".045" numOctaves="4" seed="12" />
                <feColorMatrix type="matrix" values="0 0 0 0 .35  0 0 0 0 .32  0 0 0 0 .28  -2.4 0 0 0 .52" />
              </filter>
              <pattern [attr.id]="sid('parquet')" width="40" height="10" patternUnits="userSpaceOnUse">
                @for (p of parquet; track $index) { <rect [attr.x]="p.x" [attr.y]="p.y" width="20" height="2.5" [attr.fill]="p.c" stroke="#5e3b1e" stroke-width=".14" /> }
              </pattern>
              <pattern [attr.id]="sid('marble')" width="14.14" height="14.14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="14.14" height="14.14" fill="#ece4d3" /><rect width="7.07" height="7.07" fill="#c8bba5" /><rect x="7.07" y="7.07" width="7.07" height="7.07" fill="#c8bba5" />
                <path d="M0 0 H14.14 V14.14 M7.07 0 V14.14 M0 7.07 H14.14" stroke="#9c8f78" stroke-width=".16" fill="none" />
              </pattern>
              <pattern [attr.id]="sid('stone')" width="30" height="30" patternUnits="userSpaceOnUse">
                <rect width="30" height="30" fill="#8a7e69" />
                <path d="M0 0 L12 1 L13 9 L1 10 Z" fill="#938770" /><path d="M14 0 L30 1 L29 11 L15 9 Z" fill="#85796330" />
                <path d="M2 12 L11 11 L13 22 L0 21 Z" fill="#7f735e" /><path d="M15 12 L28 13 L30 24 L14 23 Z" fill="#988c74" />
                <path d="M1 23 L13 24 L12 30 L0 30 Z" fill="#83775f" /><path d="M15 25 L29 26 L30 30 L14 30 Z" fill="#8f836b" />
                <path d="M0 0 L12 1 L13 9 L1 10 Z M15 12 L28 13 L30 24 L14 23 Z M2 12 L11 11 L13 22 L0 21 Z" fill="none" stroke="#5a5040" stroke-width=".35" />
              </pattern>
              <pattern [attr.id]="sid('hatch')" width="2.2" height="2.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <path d="M0 0 V2.2" stroke="#fff" stroke-width=".3" opacity=".13" />
              </pattern>
              <pattern [attr.id]="sid('gingham')" width="2" height="2" patternUnits="userSpaceOnUse">
                <rect width="2" height="2" fill="#efe6da" /><rect width="1" height="2" fill="#b33a36" opacity=".55" /><rect width="2" height="1" fill="#b33a36" opacity=".55" />
              </pattern>
              <linearGradient [attr.id]="sid('wood')" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6b4527" /><stop offset="1" stop-color="#3f2716" /></linearGradient>
              <linearGradient [attr.id]="sid('water')" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f5562" /><stop offset="1" stop-color="#16303a" /></linearGradient>
              <radialGradient [attr.id]="sid('hole')" cx=".5" cy=".5" r=".5"><stop offset=".2" stop-color="#000" /><stop offset=".85" stop-color="#2a241c" /><stop offset="1" stop-color="#4a4034" /></radialGradient>
              <radialGradient [attr.id]="sid('sky')" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff7d8" /><stop offset=".6" stop-color="#e8d9a8" /><stop offset="1" stop-color="#6b604c" /></radialGradient>
              <radialGradient [attr.id]="sid('leaf')" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#5f8f4e" /><stop offset="1" stop-color="#23401f" /></radialGradient>
              <radialGradient [attr.id]="sid('sheen')" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".28" /><stop offset="1" stop-color="#fff" stop-opacity="0" /></radialGradient>
              <radialGradient [attr.id]="sid('foot')" cx=".5" cy=".5" r=".5"><stop offset=".3" stop-color="#000" stop-opacity=".45" /><stop offset="1" stop-color="#000" stop-opacity="0" /></radialGradient>

              <!-- Les personnages, vus de dessus, regardant vers le haut -->
              <symbol [attr.id]="sid('g-agent')" viewBox="-5 -5 10 10">
                <circle cx=".5" cy=".9" r="4" [attr.fill]="url('foot')" />
                <ellipse cx="-2.5" cy="-.5" rx=".95" ry="1.6" fill="#1c2638" /><ellipse cx="2.4" cy="-1.3" rx=".95" ry="1.8" fill="#1c2638" />
                <rect x="1.95" y="-4.1" width=".95" height="2.2" rx=".3" fill="#1a1a1a" /><circle cx="2.42" cy="-4.15" r=".5" fill="#fff4c4" />
                <ellipse cy=".5" rx="3.3" ry="1.95" fill="#243149" /><ellipse cy=".5" rx="3.3" ry="1.95" [attr.fill]="url('sheen')" />
                <circle cy=".25" r="1.55" fill="#121a29" /><path d="M-1.35 -.6 Q0 -2.5 1.35 -.6 Z" fill="#070b12" /><circle cx="-1.9" cy=".4" r=".35" fill="#c9a43a" />
              </symbol>
              <symbol [attr.id]="sid('g-police')" viewBox="-5 -5 10 10">
                <circle cx=".5" cy=".9" r="4" [attr.fill]="url('foot')" />
                <ellipse cx="-2.5" cy="-.5" rx=".95" ry="1.6" fill="#1a2a4e" /><ellipse cx="2.4" cy="-1.3" rx=".95" ry="1.8" fill="#1a2a4e" />
                <rect x="1.95" y="-4.1" width=".95" height="2.2" rx=".3" fill="#1a1a1a" /><circle cx="2.42" cy="-4.15" r=".5" fill="#fff4c4" />
                <ellipse cy=".5" rx="3.3" ry="1.95" fill="#1e3060" /><ellipse cy=".5" rx="3.3" ry="1.95" [attr.fill]="url('sheen')" />
                <path d="M-3 .9 Q0 2.2 3 .9" stroke="#d8e04a" stroke-width=".35" fill="none" opacity=".8" />
                <circle cy=".25" r="1.55" fill="#0d1733" /><circle cy=".25" r="1.2" fill="none" stroke="#e6e6e6" stroke-width=".25" stroke-dasharray=".35 .35" /><path d="M-1.35 -.6 Q0 -2.5 1.35 -.6 Z" fill="#05080f" />
              </symbol>
              <symbol [attr.id]="sid('g-garde')" viewBox="-5 -5 10 10">
                <circle cx=".5" cy=".9" r="4" [attr.fill]="url('foot')" />
                <ellipse cx="-2.6" cy="-.2" rx=".95" ry="1.6" fill="#1b2140" /><ellipse cx="2.6" cy="-.2" rx=".95" ry="1.6" fill="#1b2140" />
                <ellipse cy=".5" rx="3.3" ry="1.95" fill="#1f2648" /><ellipse cy=".5" rx="3.3" ry="1.95" [attr.fill]="url('sheen')" />
                <ellipse cx="-2.5" cy=".4" rx=".9" ry=".7" fill="#c9a43a" /><ellipse cx="2.5" cy=".4" rx=".9" ry=".7" fill="#c9a43a" />
                <circle cy=".25" r="1.6" fill="#0d0d12" /><circle cy=".25" r="1.15" fill="#9a1e26" /><path d="M-1.3 -.7 Q0 -2.3 1.3 -.7 Z" fill="#050505" />
              </symbol>
              <symbol [attr.id]="sid('g-serveur')" viewBox="-5 -5 10 10">
                <circle cx=".5" cy=".9" r="4" [attr.fill]="url('foot')" />
                <ellipse cx="2.6" cy="-.2" rx=".9" ry="1.5" fill="#e9e5dc" /><ellipse cx="-2.4" cy="-1.1" rx=".9" ry="1.6" fill="#e9e5dc" />
                <circle cx="-2.6" cy="-2.6" r="1.7" fill="#c8ccd2" stroke="#8e959e" stroke-width=".25" />
                <circle cx="-3.1" cy="-2.9" r=".42" fill="#f7f1d8" opacity=".9" /><circle cx="-2.1" cy="-2.2" r=".42" fill="#f7f1d8" opacity=".9" /><circle cx="-2.2" cy="-3.2" r=".42" fill="#e0b0b8" opacity=".9" />
                <ellipse cy=".5" rx="3.2" ry="1.9" fill="#f1eee7" /><ellipse cy=".5" rx="3.2" ry="1.9" [attr.fill]="url('sheen')" />
                <path d="M-.9 -.9 L0 -.4 L.9 -.9" stroke="#111" stroke-width=".45" fill="none" />
                <circle cy=".3" r="1.45" fill="#2a1d14" /><path d="M-1 -.2 Q0 -.9 1 -.2" stroke="#6b4a32" stroke-width=".25" fill="none" />
              </symbol>
              <symbol [attr.id]="sid('g-menage')" viewBox="-5 -5 10 10">
                <circle cx=".5" cy=".9" r="4" [attr.fill]="url('foot')" />
                <path d="M2.5 -1 L2.6 -4.1" stroke="#8a6a3a" stroke-width=".45" /><rect x="1.2" y="-4.9" width="2.8" height=".9" rx=".35" fill="#d9d2c0" />
                <ellipse cx="-2.5" cy="-.4" rx=".9" ry="1.5" fill="#3a7c87" /><ellipse cx="2.4" cy="-.9" rx=".9" ry="1.5" fill="#3a7c87" />
                <ellipse cy=".5" rx="3.1" ry="1.85" fill="#438c97" /><ellipse cy=".5" rx="3.1" ry="1.85" [attr.fill]="url('sheen')" />
                <circle cy=".3" r="1.45" fill="#4b2e1f" /><circle cy="1.65" r=".75" fill="#3a2216" />
              </symbol>
              <symbol [attr.id]="sid('g-cataphile')" viewBox="-5 -5 10 10">
                <circle cx=".5" cy=".9" r="4" [attr.fill]="url('foot')" />
                <rect x="-1.7" y="1.3" width="3.4" height="1.9" rx=".6" fill="#3c4836" />
                <ellipse cx="-2.5" cy="-.3" rx=".95" ry="1.55" fill="#5e4a2e" /><ellipse cx="2.5" cy="-.3" rx=".95" ry="1.55" fill="#5e4a2e" />
                <ellipse cy=".5" rx="3.2" ry="1.9" fill="#6c5636" /><ellipse cy=".5" rx="3.2" ry="1.9" [attr.fill]="url('sheen')" />
                <circle cy=".2" r="1.6" fill="#cfa22c" /><circle cx="-.4" cy="-.2" r=".6" fill="#fff" opacity=".25" /><circle cy="-1.45" r=".5" fill="#fff7d0" />
              </symbol>
              <symbol [attr.id]="sid('g-camera')" viewBox="-5 -5 10 10">
                <rect x="-.7" y="1.2" width="1.4" height="2.6" fill="#4a4d55" /><rect x="-1.6" y="3.2" width="3.2" height="1" rx=".3" fill="#393b42" />
                <rect x="-1.25" y="-2.6" width="2.5" height="4.2" rx=".5" fill="#d9dce1" /><rect x="-1.25" y="-2.6" width="1" height="4.2" rx=".4" fill="#fff" opacity=".35" />
                <rect x="-.85" y="-3.5" width="1.7" height="1" rx=".25" fill="#141418" /><circle cx=".55" cy=".9" r=".32" fill="#ff3b30" />
              </symbol>
              <symbol [attr.id]="sid('g-me')" viewBox="-5 -5 10 10">
                <circle cx=".4" cy=".8" r="3.8" [attr.fill]="url('foot')" />
                <ellipse cx="-2.3" cy="-.5" rx=".85" ry="1.45" fill="#15171c" /><ellipse cx="2.3" cy="-.5" rx=".85" ry="1.45" fill="#15171c" />
                <ellipse cy=".5" rx="2.95" ry="1.75" fill="#1b1e24" /><ellipse cy=".5" rx="2.95" ry="1.75" [attr.fill]="url('sheen')" />
                <path d="M-2.4 -.2 L2.2 1.6" stroke="#6b4a2a" stroke-width=".45" /><rect x="1.6" y="1.2" width="1.6" height="1.2" rx=".3" fill="#5a3c22" />
                <circle cy=".35" r="1.45" fill="#262a32" /><path d="M-1 -.5 Q0 -1.5 1 -.5" stroke="#3a3f4a" stroke-width=".35" fill="none" />
              </symbol>
              <symbol [attr.id]="sid('g-me-cata')" viewBox="-5 -5 10 10">
                <circle cx=".4" cy=".8" r="3.8" [attr.fill]="url('foot')" />
                <rect x="-1.5" y="1.3" width="3" height="1.7" rx=".5" fill="#2e3a33" />
                <ellipse cx="-2.3" cy="-.5" rx=".85" ry="1.45" fill="#2a2f3a" /><ellipse cx="2.3" cy="-.5" rx=".85" ry="1.45" fill="#2a2f3a" />
                <ellipse cy=".5" rx="2.95" ry="1.75" fill="#323a48" /><ellipse cy=".5" rx="2.95" ry="1.75" [attr.fill]="url('sheen')" />
                <circle cy=".25" r="1.5" fill="#d8dadf" /><circle cy="-1.3" r=".5" fill="#fff8d8" />
              </symbol>

              <!-- Les objets -->
              <symbol [attr.id]="sid('i-folder')" viewBox="0 0 10 10">
                <path d="M1 2.6 H4 L4.8 1.8 H8.6 V8.4 H1 Z" fill="#b8924e" /><rect x="1.6" y="2.6" width="6.6" height="5.4" fill="#f4f1ea" transform="rotate(-4 5 5)" />
                <path d="M.8 3.4 H9.2 L8.8 8.8 H1.2 Z" fill="#dcb46a" /><path d="M.8 3.4 H9.2" stroke="#fff" stroke-opacity=".5" stroke-width=".25" />
                <rect x="2.2" y="5.4" width="5.6" height="1.3" fill="none" stroke="#b3261e" stroke-width=".35" transform="rotate(-6 5 6)" /><path d="M2.8 6.05 H7.2" stroke="#b3261e" stroke-width=".3" transform="rotate(-6 5 6)" />
              </symbol>
              <symbol [attr.id]="sid('i-envelope')" viewBox="0 0 10 10">
                <rect x="1" y="2.4" width="8" height="5.4" rx=".3" fill="#f3ecdc" stroke="#b8ab90" stroke-width=".2" />
                <path d="M1.1 2.6 L5 5.6 L8.9 2.6" fill="#e6dcc6" stroke="#b8ab90" stroke-width=".2" /><circle cx="5" cy="5.5" r="1.05" fill="#a3242c" /><circle cx="4.7" cy="5.2" r=".35" fill="#d65a5a" />
              </symbol>
              <symbol [attr.id]="sid('i-map')" viewBox="0 0 10 10">
                <path d="M1 2 Q3 1.4 5 2 Q7 2.6 9 2 V8 Q7 8.6 5 8 Q3 7.4 1 8 Z" fill="#e7d6a8" stroke="#9c8558" stroke-width=".25" />
                <path d="M2 4 Q4 3 5 5 T8 5.4 M3 6.6 Q5 6 7 7" stroke="#7a5c30" stroke-width=".3" fill="none" /><path d="M6.4 3.4 L7.4 4.4 M7.4 3.4 L6.4 4.4" stroke="#b3261e" stroke-width=".4" />
              </symbol>
              <symbol [attr.id]="sid('i-plaque')" viewBox="0 0 10 10">
                <rect x="1.4" y="1.6" width="7.2" height="6.8" rx=".4" fill="#b9b1a2" stroke="#6e665a" stroke-width=".3" />
                <path d="M2.6 3.4 H7.4 M2.6 4.8 H7.4 M3.2 6.2 H6.8" stroke="#5f584d" stroke-width=".35" /><rect x="1.4" y="1.6" width="7.2" height="2" fill="#fff" opacity=".18" />
              </symbol>
              <symbol [attr.id]="sid('i-ledger')" viewBox="0 0 10 10">
                <rect x="1.8" y="1.4" width="6.6" height="7.4" rx=".3" fill="#25483a" /><rect x="1.8" y="1.4" width="1" height="7.4" fill="#183026" />
                <rect x="4" y="3" width="3.2" height="1.6" fill="#e9dfc4" /><path d="M8.4 1.8 V8.4" stroke="#e9dfc4" stroke-width=".35" />
              </symbol>
              <symbol [attr.id]="sid('i-receipt')" viewBox="0 0 10 10">
                <path d="M2.8 1 H7.2 V8.4 L6.5 9 L5.8 8.4 L5 9 L4.2 8.4 L3.5 9 L2.8 8.4 Z" fill="#f7f5ef" stroke="#b9b4a8" stroke-width=".2" transform="rotate(8 5 5)" />
                <path d="M3.6 2.6 H6.4 M3.6 3.8 H6 M3.6 5 H6.4 M3.6 6.2 H5.4" stroke="#6b6b6b" stroke-width=".28" transform="rotate(8 5 5)" />
              </symbol>
              <symbol [attr.id]="sid('i-usb')" viewBox="0 0 10 10">
                <g transform="rotate(-30 5 5)"><rect x="3.6" y="1.4" width="2.8" height="1.8" fill="#c9cdd3" stroke="#8a9098" stroke-width=".2" /><rect x="3.2" y="3.1" width="3.6" height="5.4" rx=".6" fill="#22262d" /><rect x="3.6" y="7.6" width="2.8" height=".5" fill="#3d7bd0" /></g>
              </symbol>
              <symbol [attr.id]="sid('i-card')" viewBox="0 0 10 10">
                <rect x="1.4" y="2.8" width="7.2" height="4.4" rx=".3" fill="#fbfaf6" stroke="#b4ad9c" stroke-width=".2" transform="rotate(-8 5 5)" />
                <path d="M2.6 4.4 H6.6 M2.6 5.6 H5.2" stroke="#33415c" stroke-width=".35" transform="rotate(-8 5 5)" />
              </symbol>
              <symbol [attr.id]="sid('i-scroll')" viewBox="0 0 10 10">
                <rect x="2" y="2" width="6" height="6" fill="#ead9ad" /><rect x="1.4" y="1.2" width="7.2" height="1.4" rx=".7" fill="#cdb47e" /><rect x="1.4" y="7.4" width="7.2" height="1.4" rx=".7" fill="#cdb47e" />
                <path d="M3 3.6 H7 M3 4.8 H7 M3 6 H6" stroke="#6e5530" stroke-width=".28" />
              </symbol>
              <symbol [attr.id]="sid('i-agenda')" viewBox="0 0 10 10">
                <rect x="1.8" y="1.4" width="6.6" height="7.4" rx=".4" fill="#5b1e22" /><rect x="7.6" y="1.4" width=".5" height="7.4" fill="#f0e8d6" /><path d="M5.6 1.2 V4.4 L6.2 3.9 L6.8 4.4 V1.2" fill="#c9a43a" />
              </symbol>
              <symbol [attr.id]="sid('i-graffiti')" viewBox="0 0 10 10">
                <path d="M1.6 6.6 Q2.4 2.4 3.4 6.2 Q4.2 2.8 5 6 M5.8 3.2 V6.6 M5.8 3.2 Q7.6 3.2 6.6 4.6 Q8.2 5.4 5.8 6.6 M1.4 7.8 H8.6" stroke="#9c2b1e" stroke-width=".5" fill="none" stroke-linecap="round" />
              </symbol>
              <symbol [attr.id]="sid('i-lantern')" viewBox="0 0 10 10">
                <circle cx="5" cy="5" r="4.4" fill="#ffcf6a" opacity=".35" /><rect x="3.3" y="3.2" width="3.4" height="4" rx=".4" fill="#ffe7a0" stroke="#5a4320" stroke-width=".5" />
                <path d="M3.6 3.2 Q5 1.4 6.4 3.2" stroke="#5a4320" stroke-width=".5" fill="none" /><circle cx="5" cy="5.2" r=".7" fill="#fff6d4" />
              </symbol>
              <symbol [attr.id]="sid('i-badge')" viewBox="0 0 10 10">
                <path d="M3.4 1 Q5 3 6.6 1" stroke="#2c5aa8" stroke-width=".5" fill="none" />
                <rect x="2.2" y="2.6" width="5.6" height="6.4" rx=".5" fill="#fbfbf8" stroke="#a9b0ba" stroke-width=".2" />
                <rect x="2.2" y="2.6" width="5.6" height="1.4" rx=".4" fill="#2c5aa8" /><rect x="3" y="4.7" width="1.8" height="2.2" fill="#c8ced6" /><path d="M5.4 5.2 H7.2 M5.4 6.2 H6.8" stroke="#4a5263" stroke-width=".3" />
              </symbol>
              <symbol [attr.id]="sid('i-paper')" viewBox="0 0 10 10"><rect x="2.2" y="1.6" width="5.6" height="6.8" fill="#f7f4ec" stroke="#b9b4a8" stroke-width=".2" /><path d="M3 3 H7 M3 4.2 H7 M3 5.4 H6" stroke="#666" stroke-width=".28" /></symbol>
              <symbol [attr.id]="sid('i-exit')" viewBox="0 0 10 10">
                <rect x="2" y="1.2" width="5.2" height="7.6" fill="none" stroke="currentColor" stroke-width=".7" /><path d="M2 1.2 L5.4 2.2 V9.6 L2 8.8 Z" fill="currentColor" opacity=".55" />
                <path d="M6 5 H9.4 M8.2 3.8 L9.4 5 L8.2 6.2" stroke="currentColor" stroke-width=".7" fill="none" stroke-linecap="round" />
              </symbol>
            </defs>

            @switch (mission.theme) {
              @case ('ministere') { <rect [attr.width]="W" [attr.height]="H" [attr.fill]="url('parquet')" /> }
              @case ('ambassade') { <rect [attr.width]="W" [attr.height]="H" [attr.fill]="url('marble')" /><rect [attr.width]="W" [attr.height]="H" [attr.filter]="url('veins')" opacity=".55" /> }
              @default { <rect [attr.width]="W" [attr.height]="H" [attr.fill]="url('stone')" /> }
            }
            <rect [attr.width]="W" [attr.height]="H" [attr.filter]="url('grain')" opacity=".55" />

            <!-- Mobilier -->
            <g [attr.filter]="url('psh')">
              @for (p of pl.props; track $index) {
                <g [attr.transform]="'translate(' + p.x * 10 + ' ' + p.y * 10 + ')'">
                  @switch (p.k) {
                    @case ('desk') {
                      <g [attr.transform]="p.r ? 'rotate(180 ' + p.w * 5 + ' 5)' : null">
                        @for (c of cellsOf(p.w); track c) {
                          <circle [attr.cx]="c * 10 + 5" cy="8.7" r="1.5" fill="#26272b" /><path [attr.d]="'M' + (c * 10 + 3.4) + ' 9.6 Q' + (c * 10 + 5) + ' 10.6 ' + (c * 10 + 6.6) + ' 9.6'" stroke="#141416" stroke-width=".7" fill="none" />
                        }
                        <rect x=".7" y=".9" [attr.width]="p.w * 10 - 1.4" height="6.4" rx=".35" [attr.fill]="url('wood')" />
                        <rect x="1.1" y="1.3" [attr.width]="p.w * 10 - 2.2" height="5.6" rx=".2" fill="none" stroke="#fff" stroke-opacity=".1" stroke-width=".3" />
                        @for (c of cellsOf(p.w); track c) {
                          <rect [attr.x]="c * 10 + 3" y="1.6" width="4" height=".9" rx=".2" fill="#141519" /><rect [attr.x]="c * 10 + 3.3" y="2.5" width="3.4" height=".25" fill="#7fb2dc" opacity=".7" />
                          <rect [attr.x]="c * 10 + 3.3" y="4.2" width="3.4" height="1.1" rx=".15" fill="#2a2b30" />
                          <rect [attr.x]="c * 10 + (c % 2 ? 1.2 : 7)" y="3.2" width="2" height="2.6" fill="#f2efe6" [attr.transform]="'rotate(' + (c % 2 ? -9 : 12) + ' ' + (c * 10 + 5) + ' 4.5)'" />
                        }
                        <circle cx="2" cy="2.4" r=".95" fill="#2f6b45" /><circle cx="2" cy="2.4" r=".45" fill="#ffe8a8" />
                      </g>
                    }
                    @case ('buffet') {
                      <rect x=".5" y="1.5" [attr.width]="p.w * 10 - 1" height="7" rx=".7" fill="#f6f3ec" stroke="#cfc8b8" stroke-width=".3" />
                      <rect x=".9" y="1.9" [attr.width]="p.w * 10 - 1.8" height="6.2" rx=".4" fill="none" stroke="#e2dbcc" stroke-width=".25" />
                      @for (c of cellsOf(p.w); track c) {
                        <circle [attr.cx]="c * 10 + 3" cy="3.6" r="1.25" fill="#fff" stroke="#c9c2b2" stroke-width=".25" />
                        <circle [attr.cx]="c * 10 + 7" cy="6.4" r="1.25" fill="#fff" stroke="#c9c2b2" stroke-width=".25" />
                        <ellipse [attr.cx]="c * 10 + 6.4" cy="3.4" rx="1.7" ry="1" fill="#c8ccd2" stroke="#8e959e" stroke-width=".2" />
                        @for (gl of [[2.4, 6.2], [4.6, 5.6], [8, 3.2], [3.6, 7.2]]; track $index) { <circle [attr.cx]="c * 10 + gl[0]" [attr.cy]="gl[1]" r=".5" fill="#e6eef1" stroke="#9fb0b6" stroke-width=".15" /> }
                      }
                      <circle [attr.cx]="p.w * 5" cy="5" r="1.1" fill="#b8323a" /><circle [attr.cx]="p.w * 5 - .9" cy="4.6" r=".6" fill="#e7c55a" /><circle [attr.cx]="p.w * 5 + .8" cy="5.5" r=".6" fill="#f2ede0" />
                    }
                    @case ('boxes') {
                      <g [attr.transform]="'rotate(' + (p.v * 7 - 8) + ' 5 5)'">
                        <rect x="1" y="1.2" width="5" height="4.6" fill="#b48a52" stroke="#7d5c33" stroke-width=".2" /><path d="M3.5 1.2 V5.8" stroke="#d9c18c" stroke-width=".7" />
                        <rect x="4.2" y="4.4" width="4.8" height="4.4" fill="#a98048" stroke="#7d5c33" stroke-width=".2" /><path d="M4.2 6.6 H9" stroke="#d9c18c" stroke-width=".7" />
                        <rect x="1.4" y="6.4" width="2.6" height="2.4" fill="#c09660" stroke="#7d5c33" stroke-width=".2" />
                      </g>
                    }
                    @case ('guests') {
                      @for (gu of guests(p.v); track $index) {
                        <g [attr.transform]="'translate(' + gu.x + ' ' + gu.y + ') rotate(' + gu.a + ')'">
                          <ellipse cy=".2" rx="2.1" ry="1.25" [attr.fill]="gu.c" /><ellipse cy=".2" rx="2.1" ry="1.25" [attr.fill]="url('sheen')" />
                          <circle r="1" [attr.fill]="gu.h" /><circle cx="1.6" cy="-1" r=".4" fill="#f1e4c4" opacity=".9" />
                        </g>
                      }
                    }
                    @case ('picnic') {
                      <rect x="1" y="1.6" width="8" height="6.8" [attr.fill]="url('gingham')" transform="rotate(-9 5 5)" />
                      <ellipse cx="6.4" cy="3.6" rx=".7" ry="2" fill="#1f4a2a" transform="rotate(30 6.4 3.6)" /><ellipse cx="3.6" cy="6.4" rx="1.8" ry=".8" fill="#c9954a" />
                      @for (cd of [[3, 3], [7.2, 7]]; track $index) { <circle [attr.cx]="cd[0]" [attr.cy]="cd[1]" r=".7" fill="#f3e6c0" /><circle [attr.cx]="cd[0]" [attr.cy]="cd[1]" r=".35" fill="#ffb43a" /> }
                    }
                    @case ('rubble') {
                      <g [attr.transform]="'rotate(' + p.r + ' 5 5)'">
                        @for (d of rubble; track $index) { <path [attr.d]="d" [attr.fill]="['#7a7164', '#6a6256', '#8a8172', '#5f574c', '#766d60'][($index + p.v) % 5]" stroke="#3f392f" stroke-width=".2" /> }
                        <path d="M2.4 4.4 L3.8 4.6 M6.4 2.6 L7.6 3.4" stroke="#b5ab98" stroke-width=".3" />
                      </g>
                    }
                    @case ('cabinet') {
                      <g [attr.transform]="'rotate(' + p.r + ' 5 5)'">
                        <rect x="1" y=".4" width="8" height="4.6" rx=".2" fill="#5a3b22" stroke="#2e1d10" stroke-width=".25" />
                        <path d="M5 .6 V4.8" stroke="#2e1d10" stroke-width=".25" /><circle cx="4.5" cy="3.4" r=".3" fill="#c9a43a" /><circle cx="5.5" cy="3.4" r=".3" fill="#c9a43a" />
                        <rect x="1" y=".4" width="8" height="1" fill="#fff" opacity=".08" />
                      </g>
                    }
                    @case ('coats') {
                      <g [attr.transform]="'rotate(' + p.r + ' 5 5)'">
                        <rect x=".8" y="2.2" width="8.4" height=".6" rx=".3" fill="#7d7f86" />
                        @for (ct of [[2, '#262a35'], [4, '#5a3626'], [6, '#2f3f33'], [8, '#1d1d22']]; track $index) { <ellipse [attr.cx]="ct[0]" cy="3.2" rx="1.1" ry="2.3" [attr.fill]="ct[1]" /><ellipse [attr.cx]="ct[0]" cy="3.2" rx="1.1" ry="2.3" [attr.fill]="url('sheen')" /> }
                      </g>
                    }
                    @case ('plant') {
                      <circle cx="5" cy="5" r="2.5" fill="#8a5232" stroke="#5a321c" stroke-width=".3" /><circle cx="5" cy="5" r="1.9" fill="#3a2a1c" />
                      @for (a of [0, 50, 100, 150, 200, 250, 300]; track a) { <ellipse cx="5" cy="2.4" rx="1" ry="2.6" [attr.fill]="url('leaf')" [attr.transform]="'rotate(' + (a + p.v * 13) + ' 5 5)'" /> }
                      <circle cx="5" cy="5" r=".8" fill="#4d7a3e" />
                    }
                    @case ('palm') {
                      <circle cx="5" cy="5" r="2.4" fill="#d8d2c4" stroke="#9c9484" stroke-width=".3" />
                      @for (a of [0, 45, 90, 135, 180, 225, 270, 315]; track a) {
                        <g [attr.transform]="'rotate(' + (a + p.v * 11) + ' 5 5)'"><path d="M5 5 Q5.6 2.4 5 .2 Q4.4 2.4 5 5 Z" fill="#2f5a2a" /><path d="M5 5 Q5.4 2.6 5 .6" stroke="#6f9a5a" stroke-width=".15" fill="none" /><path d="M5 1.6 L6.2 1.2 M5 2.6 L6.4 2.4 M5 1.6 L3.8 1.2 M5 2.6 L3.6 2.4" stroke="#3e7034" stroke-width=".3" /></g>
                      }
                    }
                    @case ('niche') {
                      <ellipse cx="5" cy="5" rx="3.9" ry="3.5" [attr.fill]="url('hole')" />
                      <ellipse cx="5" cy="5" rx="3.9" ry="3.5" fill="none" stroke="#6b6152" stroke-width=".7" stroke-dasharray="1.6 .5" />
                    }
                    @case ('water') {
                      <g [attr.filter]="url('ripple')">
                        <rect x="-.2" y="-.2" width="10.4" height="10.4" [attr.fill]="url('water')" />
                        <path [attr.d]="p.v % 2 ? 'M2 3 Q4 2.4 6 3 M4 6.6 Q6 6 8 6.6' : 'M3 4.4 Q5 3.8 7 4.4 M1.6 7.4 Q3.6 6.8 5.6 7.4'" stroke="#9cc4cf" stroke-width=".3" opacity=".55" fill="none" />
                      </g>
                    }
                    @case ('mat') {
                      <rect x="1.4" y="2.4" width="7.2" height="5.2" rx=".5" fill="#4a3a2c" /><rect x="2" y="3" width="6" height="4" rx=".3" fill="none" stroke="#7a6248" stroke-width=".35" stroke-dasharray=".5 .3" />
                    }
                    @case ('ladder') {
                      <circle cx="5" cy="5" r="3.8" [attr.fill]="url('hole')" /><path d="M3.6 2 V8 M6.4 2 V8 M3.6 3.4 H6.4 M3.6 5 H6.4 M3.6 6.6 H6.4" stroke="#8c7a5c" stroke-width=".45" />
                    }
                    @case ('stairs') {
                      <rect x=".3" y=".3" width="9.4" height="9.4" fill="#8f8a80" stroke="#55514a" stroke-width=".3" />
                      @for (s of [1.6, 2.9, 4.2, 5.5, 6.8, 8.1]; track s) { <path [attr.d]="'M.3 ' + s + ' H9.7'" stroke="#55514a" stroke-width=".25" /><path [attr.d]="'M.3 ' + (s + .2) + ' H9.7'" stroke="#fff" stroke-opacity=".18" stroke-width=".2" /> }
                      <path d="M5 9 V1.6 M3.9 2.8 L5 1.4 L6.1 2.8" stroke="#2a2724" stroke-width=".4" fill="none" />
                    }
                    @case ('exit') {
                      <g [attr.transform]="'rotate(' + p.r + ' 5 5)'">
                        <rect x="1" y=".2" width="8" height="1.2" fill="#3b2a1c" /><path d="M1.2 1.4 A7.6 7.6 0 0 0 8.8 9" stroke="#2a1d14" stroke-width=".25" stroke-dasharray=".7 .5" fill="none" />
                        <rect x="3" y="1.8" width="4" height="1.4" rx=".2" fill="#1d8c4e" /><path d="M4 2.5 H6 M5.4 2.1 L6 2.5 L5.4 2.9" stroke="#eafff2" stroke-width=".25" fill="none" />
                      </g>
                    }
                    @case ('shaft') {
                      <circle cx="5" cy="5" r="4" [attr.fill]="url('hole')" /><circle cx="5" cy="5" r="4" fill="none" stroke="#6b6152" stroke-width=".8" stroke-dasharray="1.3 .4" />
                      <path d="M3.8 2.4 V7.6 M6.2 2.4 V7.6 M3.8 3.6 H6.2 M3.8 5 H6.2 M3.8 6.4 H6.2" stroke="#7d6c52" stroke-width=".4" />
                    }
                    @case ('hole') { <ellipse cx="5" cy="5.4" rx="3.2" ry="2.2" [attr.fill]="url('hole')" /><path d="M2 5 Q5 2.4 8 5" stroke="#6b6152" stroke-width=".7" fill="none" /> }
                    @case ('up') {
                      <circle cx="5" cy="5" r="4" [attr.fill]="url('sky')" /><circle cx="5" cy="5" r="4" fill="none" stroke="#6b6152" stroke-width=".8" stroke-dasharray="1.3 .4" />
                      <path d="M3.8 2.4 V7.6 M6.2 2.4 V7.6 M3.8 3.6 H6.2 M3.8 5 H6.2 M3.8 6.4 H6.2" stroke="#5a4a36" stroke-width=".4" />
                    }
                    @case ('door') {
                      <g [attr.transform]="p.r ? 'rotate(90 5 5)' : null">
                        <path d="M.8 .6 H9.2" stroke="#2a1d14" stroke-width=".35" opacity=".6" />
                        <path d="M1.2 9 A8.4 8.4 0 0 0 9.2 .6" stroke="#2a1d14" stroke-width=".28" stroke-dasharray=".8 .5" fill="none" opacity=".75" />
                        <rect x=".7" y=".6" width=".8" height="8.4" rx=".15" [attr.fill]="mission.theme === 'ambassade' ? '#f1ead8' : '#7a4f2c'" stroke="#2a1d14" stroke-width=".15" />
                      </g>
                    }
                  }
                </g>
              }
            </g>

            <!-- Murs, roche : masses pochées, ombre portée -->
            <g [attr.filter]="mission.theme === 'catacombes' ? url('rock') : url('wsh')">
              @for (w of pl.walls; track $index) { <rect [attr.x]="w.x * 10 - .15" [attr.y]="w.y * 10 - .15" width="10.3" height="10.3" class="wall" /> }
              @for (s of pl.stubs; track $index) { <rect [attr.x]="s.x" [attr.y]="s.y" [attr.width]="s.w" [attr.height]="s.h" class="wall" /> }
            </g>
            <g>@for (w of pl.walls; track $index) { <rect [attr.x]="w.x * 10" [attr.y]="w.y * 10" width="10" height="10" [attr.fill]="url('hatch')" /> }</g>
          </svg>

          <!-- La nuit : obscurité, faisceaux des lampes, objets -->
          <svg class="night" [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter [attr.id]="sid('blur')" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6" /></filter>
              <radialGradient [attr.id]="sid('pool')" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".95" /><stop offset=".55" stop-color="#000" stop-opacity=".55" /><stop offset="1" stop-color="#000" stop-opacity="0" /></radialGradient>
              <radialGradient [attr.id]="sid('halo')" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe7a3" stop-opacity=".85" /><stop offset=".5" stop-color="#ffd36b" stop-opacity=".3" /><stop offset="1" stop-color="#ffd36b" stop-opacity="0" /></radialGradient>
              <radialGradient [attr.id]="sid('halo2')" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff" stop-opacity=".7" /><stop offset=".55" stop-color="#e8f0ff" stop-opacity=".2" /><stop offset="1" stop-color="#e8f0ff" stop-opacity="0" /></radialGradient>
              <radialGradient [attr.id]="sid('green')" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#5dff9c" stop-opacity=".7" /><stop offset="1" stop-color="#5dff9c" stop-opacity="0" /></radialGradient>
              @for (b of beams(); track b.id) {
                <linearGradient [attr.id]="sid('beam' + b.id)" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0" [attr.stop-color]="b.c" [attr.stop-opacity]="b.a" /><stop offset=".55" [attr.stop-color]="b.c" [attr.stop-opacity]="b.a * .45" /><stop offset="1" [attr.stop-color]="b.c" stop-opacity="0" />
                </linearGradient>
              }
              <mask [attr.id]="sid('dark')" maskUnits="userSpaceOnUse" x="0" y="0" [attr.width]="W" [attr.height]="H">
                <rect [attr.width]="W" [attr.height]="H" fill="#fff" />
                <g [attr.filter]="url('blur')">
                  @for (b of beams(); track b.id) { <path [attr.d]="b.d" [attr.transform]="b.tf" fill="#000" /> }
                </g>
                @for (l of pl.lamps; track $index) { <circle [attr.cx]="l.x" [attr.cy]="l.y" [attr.r]="l.r" [attr.fill]="url('pool')" opacity=".75" /> }
                @if (night.me) { <circle [attr.cx]="cx(st().pos)" [attr.cy]="cy(st().pos)" [attr.r]="night.me" [attr.fill]="url('pool')" /> }
              </mask>
            </defs>
            @for (d of room().doors; track d) {
              @let open = st().open.includes(d);
              <g [attr.transform]="'translate(' + (d % room().w) * 10 + ' ' + floor(d / room().w) * 10 + ')' + (doorH(d) ? '' : ' rotate(90 5 5)')">
                @if (mission.theme === 'catacombes') {
                  @if (open) { <g transform="rotate(-80 1 5)"><path d="M1 5 H9" stroke="#2b2b2e" stroke-width=".6" />@for (b of [2, 3.6, 5.2, 6.8, 8.4]; track b) { <circle [attr.cx]="b" cy="5" r=".45" fill="#3a3a3e" /> }</g> }
                  @else {
                    <path d="M.6 5 H9.4" stroke="#232326" stroke-width=".7" />@for (b of [1.8, 3.4, 5, 6.6, 8.2]; track b) { <circle [attr.cx]="b" cy="5" r=".55" fill="#3a3a3e" stroke="#111" stroke-width=".15" /> }
                    <rect x="4.2" y="5.6" width="1.6" height="1.5" rx=".3" fill="#b8902e" /><path d="M4.5 5.7 Q5 4.8 5.5 5.7" stroke="#8a8a8a" stroke-width=".3" fill="none" />
                  }
                } @else {
                  @if (open) {
                    <path d="M1.2 9 A8.4 8.4 0 0 0 9.2 .6" stroke="#2a1d14" stroke-width=".28" stroke-dasharray=".8 .5" fill="none" opacity=".75" />
                    <rect x=".7" y=".6" width=".8" height="8.4" rx=".15" fill="#6a3a20" stroke="#2a1d14" stroke-width=".15" />
                  } @else {
                    <rect x=".6" y="4.1" width="8.8" height="1.8" rx=".2" fill="#5e321c" stroke="#24140a" stroke-width=".25" />
                    <path d="M1 4.5 H9" stroke="#fff" stroke-opacity=".15" stroke-width=".25" />
                  }
                  <rect x="8.4" y="6.6" width="1.1" height="1.6" rx=".2" fill="#1b1c20" /><circle cx="8.95" cy="7.1" r=".32" [attr.fill]="open ? '#3be27a' : '#ff3b30'" />
                }
              </g>
            }
            <rect [attr.width]="W" [attr.height]="H" [attr.fill]="night.c" [attr.opacity]="night.a" [attr.mask]="url('dark')" />
            @for (l of pl.lamps; track $index) { <circle [attr.cx]="l.x" [attr.cy]="l.y" [attr.r]="l.r * .7" [attr.fill]="l.c" [attr.opacity]="mission.theme === 'ambassade' ? .07 : .12" [attr.filter]="url('blur')" /> }
            <g class="beams">
              @for (b of beams(); track b.id) { <path [attr.d]="b.d" [attr.transform]="b.tf" [attr.fill]="url('beam' + b.id)" [attr.filter]="url('blur')" /> }
            </g>
            @if (exitReady()) { <circle class="glow" [attr.cx]="cx(room().exit)" [attr.cy]="cy(room().exit)" r="9" [attr.fill]="url('green')" /> }
            @for (t of room().items; track t) {
              @if (!st().got.includes(t)) {
                <circle class="halo" [class.req]="room().required.includes(t)" [attr.cx]="cx(t)" [attr.cy]="cy(t)" r="6.5" [attr.fill]="room().required.includes(t) ? url('halo') : url('halo2')" />
                <use [attr.href]="'#' + sid('i-' + itemKind(t))" [attr.x]="cx(t) - 3.7" [attr.y]="cy(t) - 3.7" width="7.4" height="7.4" />
              }
            }
          </svg>

          @for (c of room().tiles; track $index; let i = $index) {
            @let lit = seenNow().has(i);
            @let warn = seenNext().has(i);
            <button type="button" class="cell" [class]="'cell t' + tileClass(c, i)" [class.move]="moves().has(i)"
                    [class.ready]="i === room().exit && exitReady()" [disabled]="over() || busy()" (click)="tap(i)" [attr.aria-label]="cellLabel(i)" [attr.tabindex]="c === '#' ? -1 : null">
              @if (lit) { <i class="lit"></i> }
              @if (warn) { <i class="warn"></i> }
              @if (moves().has(i)) { <i class="dot"></i> }
              @if (noiseTargets().has(i)) { <i class="ear"></i> }
              @if (hideRing().has(i)) { <i class="ear hid"></i> }
            </button>
          }
          <div class="layer" aria-hidden="true">
            @for (g of st().guards; track g.id) {
              @let k = kindOf(g);
              <span class="tok guard" [class.cam]="k.wall" [class.lured]="g.lure" [style.width.%]="100 / room().w" [style.height.%]="100 / room().h"
                    [style.transform]="pos(g.i)">
                <svg class="fig" viewBox="-5 -5 10 10"><g class="rot" [style.transform]="'rotate(' + angle('g' + ri() + '-' + g.id, g.d) + 'deg)'"><use [attr.href]="'#' + sid('g-' + room().guards[g.id].k)" x="-5" y="-5" width="10" height="10" /></g></svg>
                <i class="face" [class]="'face d-' + g.d"></i>
                <i class="nx">{{ nextMark(g) }}</i>
                @if (spotter() === g.id) { <b class="bubble bang">!</b> } @else if (g.lure?.length) { <b class="bubble huh">?</b> }
              </span>
            }
            <span class="tok me" [class.hidden]="st().hidden" [style.width.%]="100 / room().w" [style.height.%]="100 / room().h" [style.transform]="pos(st().pos)">
              <svg class="fig" viewBox="-5 -5 10 10"><g class="rot" [style.transform]="'rotate(' + angle('me', meDir()) + 'deg)'"><use [attr.href]="'#' + sid(mission.theme === 'catacombes' ? 'g-me-cata' : 'g-me')" x="-5" y="-5" width="10" height="10" /></g></svg>
            </span>
            @for (f of fx(); track f.id) {
              <span class="tok fxw" [style.width.%]="100 / room().w" [style.height.%]="100 / room().h" [style.transform]="pos(f.i)"><b class="fx" [class]="'fx ' + f.tone">{{ f.text }}</b></span>
            }
          </div>
        </div>
      </div>

      @if (!over()) {
        <div class="tools" role="toolbar" aria-label="Outils">
          <button type="button" class="btn small tool" [disabled]="busy()" (click)="wait()" aria-label="Attendre un tour">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2 H12 M4 14 H12 M5 2 Q5 6 8 8 Q11 10 11 14 M11 2 Q11 6 8 8 Q5 10 5 14" /></svg> Attendre</button>
          <button type="button" class="btn small tool" [class.on]="mode() === 'hide'" [disabled]="busy() || !hideSpots().length" (click)="hide()"
                  [attr.aria-label]="'Se cacher, ' + st().tools.cacher + ' restant(s)'">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8 Q8 2 14.5 8 Q8 14 1.5 8 Z M2.5 13.5 L13.5 2.5" /><circle cx="8" cy="8" r="2" /></svg> Se cacher <b class="n">{{ st().tools.cacher }}</b></button>
          <button type="button" class="btn small tool" [class.on]="mode() === 'noise'" [disabled]="busy() || st().tools.bruit <= 0" (click)="toggleNoise()"
                  [attr.aria-pressed]="mode() === 'noise'" [attr.aria-label]="'Faire du bruit, ' + st().tools.bruit + ' restant(s)'">
            <svg viewBox="0 0 16 16" aria-hidden="true"><ellipse cx="6" cy="8" rx="4.2" ry="4.2" /><path d="M6 5.6 V10.4 M11.6 4.6 Q13.6 8 11.6 11.4 M13.6 3 Q16.4 8 13.6 13" /></svg> Bruit <b class="n">{{ st().tools.bruit }}</b></button>
          <button type="button" class="btn small tool" [disabled]="busy() || badgeDoor() === null" (click)="useBadge()"
                  [attr.aria-label]="'Badge, ' + st().tools.badge + ' restant(s)'">
            <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="4" width="12" height="9" rx="1.2" /><path d="M6 1.5 V4.5 M10 1.5 V4.5" /><rect x="4" y="7" width="3" height="3.4" /><path d="M9 8 H12 M9 10 H11" /></svg> Badge <b class="n">{{ st().tools.badge }}</b></button>
          <button type="button" class="btn small tool ghost" [disabled]="busy()" (click)="retreat()" aria-label="Rebrousser chemin : recommencer l’étage, deux tours de pénalité">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3 L2.5 6.5 L6 10 M2.5 6.5 H10 Q13.5 6.5 13.5 10 Q13.5 13.5 10 13.5 H7" /></svg> Rebrousser</button>
        </div>
        <ul class="log" aria-live="polite">@for (l of log(); track $index) { <li>{{ l }}</li> }</ul>
        <details class="legend">
          <summary>Légende et règles</summary>
          <ul>
            <li><i class="sw sw-lit"></i> Faisceau d’une lampe ou d’une caméra : y entrer, c’est être repéré·e.</li>
            <li><i class="sw sw-warn"></i> Ce qu’il éclairera au prochain tour : n’y restez pas.</li>
            <li><i class="sw sw-ear"></i> Case où un bruit serait entendu (mode Bruit).</li>
            <li><b>↑→↓←</b> prochain pas de l’agent · <b>↻</b> il se retourne · <b>·</b> il reste.</li>
            <li>Touchez une case voisine (point blanc) ou utilisez les flèches du clavier. Les agents ne regardent que droit devant : passez derrière eux.</li>
            <li>Se cacher : glissez-vous dans une cachette voisine ({{ hideNames }}) ; invisible aussitôt, et tant que vous y restez. Y entrer sans se cacher ne protège pas.</li>
            <li>Bruit : une pièce jetée attire le curieux le plus proche (six pas au plus), qui y reste planté ; {{ deafNames }} n’y prêtent pas attention.</li>
            <li>Badge : il ouvre une {{ mission.theme === 'catacombes' ? 'grille cadenassée' : 'porte verrouillée (voyant rouge)' }} ; on en trouve parfois sur place.</li>
            <li>Trois alertes et l’on vous raccompagne dehors. Bonus et rapidité améliorent le score.</li>
          </ul>
        </details>
      } @else if (summary(); as s) {
        <div class="end" [class.ok]="s.ok">
          <span class="stamp" aria-hidden="true">{{ s.ok ? 'Mission accomplie' : 'Mission avortée' }}</span>
          <p>{{ s.text }}</p>
          <dl>@for (r of s.rows; track r[0]) { <dt>{{ r[0] }}</dt><dd>{{ r[1] }}</dd> }</dl>
          <p class="score">Score : <b class="mono">{{ round(s.score * 100) }} %</b></p>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .inf { display: grid; gap: 8px; --wall: #24262c; --frame: #1a1b20; --ear: #3cc8d6; }
    .th-ambassade { --wall: #3a2a28; --frame: #2a1d1b; }
    .th-catacombes { --wall: #3a332b; --frame: #1e1a15; }
    .head { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; justify-content: space-between; font-size: 12.5px; }
    .where { display: inline-flex; align-items: baseline; gap: 6px; b { font-family: var(--font-display); font-size: 14px; } } .tours.low b { color: var(--bad); }
    .alerts { display: inline-flex; gap: 5px;
      i { width: 11px; height: 11px; border-radius: 50%; box-sizing: border-box; border: 1.5px solid color-mix(in srgb, var(--bad) 70%, transparent); background: color-mix(in srgb, var(--bad) 10%, transparent); }
      i.on { border-color: #8a1610; background: radial-gradient(circle at 35% 35%, #ffb3a6, #e0352a 45%, #8a1610); box-shadow: 0 0 6px rgba(240, 60, 40, .7); } }
    .goals { display: flex; flex-wrap: wrap; gap: 4px; .gchip { font-size: 11px; display: inline-flex; align-items: center; gap: 4px; } }
    .gi { width: 15px; height: 15px; flex: none; color: var(--ink-2); }
    .brief { margin: 0; font-size: 12.5px; color: var(--ink-2); min-height: 2.6em; }
    .board { padding: 3px; border-radius: 6px; background: var(--frame); width: 100%; max-width: 470px; justify-self: center; user-select: none; box-sizing: border-box;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, .35), 0 10px 26px -12px rgba(0, 0, 0, .7); }
    @media (max-width: 420px) { .board { width: calc(100% + 24px); max-width: none; margin-inline: -12px; } }
    .grid { position: relative; display: grid; overflow: hidden; border-radius: 3px; background: var(--wall); }
    .plan, .night { position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none; }
    .plan .wall { fill: var(--wall); }
    .night .halo { animation: glint 2.4s ease-in-out infinite; }
    .night .glow { animation: glint 1.8s ease-in-out infinite; }
    @keyframes glint { 50% { opacity: .55; } }
    .cell { position: relative; aspect-ratio: 1; min-width: 0; border: 0; border-radius: 0; padding: 0; margin: 0; cursor: pointer; display: grid; place-items: center;
      background: transparent; box-shadow: inset 0 0 0 .5px rgba(255, 255, 255, .045); font: inherit; color: inherit;
      &:disabled { cursor: default; } &:focus-visible { outline: 2px solid #9fd0ff; outline-offset: -2px; z-index: 2; } }
    .cell.t-wall { box-shadow: none; cursor: default; }
    .cell.ready { box-shadow: inset 0 0 0 2px rgba(80, 230, 140, .8), inset 0 0 10px rgba(80, 230, 140, .45); }
    .lit { position: absolute; inset: 0; background: radial-gradient(closest-side, rgba(255, 222, 150, .4), rgba(255, 205, 120, .2)); box-shadow: inset 0 0 0 1px rgba(255, 220, 150, .5); }
    .warn { position: absolute; inset: 2px; border: 1.5px dashed rgba(255, 168, 64, .95); border-radius: 2px;
      background: repeating-linear-gradient(45deg, transparent 0 4px, rgba(255, 150, 50, .2) 4px 6px); }
    .dot { position: absolute; z-index: 1; width: 26%; height: 26%; border-radius: 50%; background: rgba(170, 215, 255, .35); box-shadow: 0 0 0 1.5px rgba(255, 255, 255, .9), 0 0 6px rgba(150, 205, 255, .8); }
    .ear { position: absolute; inset: 3px; z-index: 2; border: 2px solid var(--ear); border-radius: 50%; pointer-events: none; box-shadow: 0 0 6px rgba(60, 200, 214, .6);
      &.hid { border-color: #6fd08a; border-style: double; border-width: 4px; box-shadow: 0 0 6px rgba(110, 210, 140, .6); } }
    .layer { position: absolute; inset: 0; pointer-events: none; }
    .tok { position: absolute; left: 0; top: 0; display: grid; place-items: center; transition: transform .22s ease; z-index: 3; will-change: transform; }
    .fig { width: 92%; height: 92%; overflow: visible; display: block; }
    .rot { transition: transform .22s ease; }
    .guard.cam .fig { width: 80%; height: 80%; }
    .guard.lured .fig { filter: drop-shadow(0 0 2px rgba(255, 210, 90, .9)); }
    .face { display: none; }
    .nx { position: absolute; right: 0; bottom: 0; min-width: 12px; height: 12px; padding: 0 1px; border-radius: 6px; background: rgba(14, 15, 19, .82); color: #f2f2f2;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, .22); font: 700 9px/12px var(--font-body); font-style: normal; text-align: center; }
    .me::before { content: ''; position: absolute; inset: 6%; border-radius: 50%; box-shadow: 0 0 0 1.5px rgba(160, 210, 255, .75), 0 0 8px rgba(140, 200, 255, .55); }
    .me.hidden .fig { opacity: .38; } .me.hidden::before { box-shadow: 0 0 0 1.5px rgba(120, 220, 150, .85); border: 1px dashed rgba(120, 220, 150, .9); }
    .bubble { position: absolute; top: -38%; left: 50%; transform: translateX(-50%); z-index: 4; min-width: 16px; padding: 0 4px; border-radius: 3px;
      font: 800 12px/16px var(--font-body); text-align: center; box-shadow: 0 2px 4px rgba(0, 0, 0, .4); }
    .bang { background: #d7352a; color: #fff; animation: pop .5s ease; }
    .huh { background: #f0c75a; color: #3a2d00; }
    .fxw { z-index: 5; }
    .fx { font: 700 11.5px var(--font-body); white-space: nowrap; pointer-events: none; animation: rise 1s ease forwards; text-shadow: 0 1px 2px #000, 0 0 6px #000; color: #fff;
      &.got { color: #c9f5d4; } &.bang { color: #ffb4a8; } &.huh { color: #ffe08a; } }
    .board.shake { animation: shake .4s ease; }
    @keyframes rise { to { transform: translateY(-20px); opacity: 0; } }
    @keyframes pop { 0% { transform: translateX(-50%) scale(.3); } 70% { transform: translateX(-50%) scale(1.25); } }
    @keyframes shake { 25% { transform: translateX(-4px); } 50% { transform: translateX(4px); } 75% { transform: translateX(-2px); } }
    .tools { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
    .tool { min-height: 36px; min-width: 44px; display: inline-flex; align-items: center; gap: 5px; .n { font-family: var(--font-mono); }
      svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; flex: none; }
      &.on { background: #f0c75a; border-color: #c9a22c; color: #3a2d00; } &.ghost { color: var(--ink-2); } }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 70px; overflow: auto; font-size: 11.5px; color: var(--ink-2);
      li:first-child { color: var(--ink); } }
    .legend { font-size: 11.5px; color: var(--ink-2); summary { cursor: pointer; min-height: 32px; display: flex; align-items: center; }
      ul { margin: 4px 0 0; padding-left: 16px; display: grid; gap: 3px; } }
    .sw { display: inline-block; width: 14px; height: 14px; vertical-align: -2px; border-radius: 2px; background: #3a3a40; box-sizing: border-box; }
    .sw-lit { background: radial-gradient(closest-side, rgba(255, 222, 150, .9), rgba(255, 205, 120, .55)), #3a3a40; }
    .sw-warn { border: 1.5px dashed rgba(255, 168, 64, .95); }
    .sw-ear { border: 2px solid var(--ear); border-radius: 50%; }
    .end { position: relative; padding: 12px; border-radius: 8px; background: var(--bad-soft); font-size: 13px; display: grid; gap: 6px; border: 1px solid var(--line);
      &.ok { background: var(--good-soft); } p { margin: 0; }
      dl { display: grid; grid-template-columns: auto auto; gap: 2px 12px; margin: 0; font-size: 12px; } dt { color: var(--ink-2); } dd { margin: 0; text-align: right; font-family: var(--font-mono); }
      .score { font-size: 14px; } }
    .stamp { justify-self: start; padding: 2px 10px; border: 2px solid var(--bad); color: var(--bad); border-radius: 3px; font: 800 12px var(--font-body); letter-spacing: .14em; text-transform: uppercase; transform: rotate(-2deg); }
    .end.ok .stamp { border-color: var(--good); color: var(--good); }
    @media (prefers-reduced-motion: reduce) { .tok, .rot { transition: none; } .bang, .fx, .board.shake, .night .halo, .night .glow { animation: none; } }
  `,
})
export class InfiltrationGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected mission: MissionDef = MISSIONS[0];
  protected rooms: Room[] = [];
  protected budget = 40;
  private par = 30;
  protected readonly maxAlerts = MAX_ALERTS;
  protected readonly alertSlots = Array.from({ length: MAX_ALERTS }, (_, k) => k);
  protected readonly round = Math.round;
  protected readonly floor = Math.floor;
  protected readonly parquet = PARQUET;
  protected readonly rubble = RUBBLE;
  protected deafNames = '';
  protected hideNames = '';
  protected night = NIGHT.ministere;
  private readonly pid = `inf${++planSeq}`;
  private readonly angles = new Map<string, number>();

  protected readonly ri = signal(0);
  protected readonly st = signal<Play>({ pos: 0, guards: [], hidden: false, got: [], open: [], tools: { bruit: 0, cacher: 0, badge: 0 } });
  protected readonly turns = signal(0);
  protected readonly alerts = signal(0);
  protected readonly mode = signal<'move' | 'noise' | 'hide'>('move');
  protected readonly busy = signal(false);
  protected readonly over = signal(false);
  protected readonly banner = signal('');
  protected readonly spotter = signal<number | null>(null);
  protected readonly shake = signal(false);
  protected readonly log = signal<string[]>([]);
  protected readonly fx = signal<Fx[]>([]);
  protected readonly summary = signal<Summary | null>(null);
  protected readonly meDir = signal<Dir>('N');
  private cleared = 0;
  private bonusGot = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];

  protected readonly room = computed(() => this.rooms[this.ri()] ?? this.rooms[0]);
  protected readonly plan = computed(() => buildPlan(this.room(), this.mission.theme));
  protected readonly seenNow = computed(() => (this.rooms.length ? watchMap(this.room(), this.st().guards) : new Map<number, number>()));
  protected readonly seenNext = computed(() => (this.rooms.length ? watchMap(this.room(), guardsNext(this.room(), this.st().guards)) : new Map<number, number>()));
  /** Les faisceaux : du regard de chaque agent jusqu'au bout de ce qu'il voit */
  protected readonly beams = computed(() => {
    const r = this.room();
    if (!r) return [];
    return this.st().guards.map(g => {
      const n = sight(r, g).length, k = r.guards[g.id].k, b = BEAM[k];
      const far = -5 - 10 * n + 0.6, near = GUARD_KINDS[k].wall ? -3 : -3.6;
      const d = n ? `M-1.4 ${near} L1.4 ${near} L4.7 ${far} L-4.7 ${far} Z` : `M-1.2 ${near} L1.2 ${near} L2.4 -5.6 L-2.4 -5.6 Z`;
      return { id: g.id, d, tf: `translate(${this.cx(g.i)} ${this.cy(g.i)}) rotate(${ANGLE[g.d]})`, c: b.c, a: n ? b.a : b.a * 0.6 };
    });
  });
  protected readonly moves = computed(() => {
    const s = this.st(), r = this.room();
    if (!r || this.over() || this.busy() || this.mode() !== 'move') return new Set<number>();
    return new Set(neighbors(r, s.pos).filter(n => canMove(r, s, n)));
  });
  protected readonly noiseTargets = computed(() => {
    const out = new Set<number>();
    if (this.mode() !== 'noise' || this.over()) return out;
    const r = this.room(), s = this.st();
    for (let i = 0; i < r.tiles.length; i++) if (lureTarget(r, s, i)) out.add(i);
    return out;
  });
  protected readonly exitReady = computed(() => this.room().required.every(t => this.st().got.includes(t)));
  protected readonly hideSpots = computed(() => (this.rooms.length && !this.over() ? hideTargets(this.room(), this.st()) : []));
  protected readonly hideRing = computed(() => new Set(this.mode() === 'hide' ? this.hideSpots() : []));
  protected readonly badgeDoor = computed(() => {
    const r = this.room(), s = this.st();
    if (s.tools.badge <= 0) return null;
    return neighbors(r, s.pos).find(n => r.tiles[n] === '=' && !s.open.includes(n) && canMove(r, s, n)) ?? null;
  });

  ngOnInit(): void {
    const diff = this.diff();
    const { m, rooms } = buildMission(this.def().id, diff);
    this.mission = m;
    this.rooms = rooms;
    this.night = NIGHT[m.theme];
    this.par = missionPar(rooms, m.tools);
    this.budget = turnBudget(this.par, diff, rooms.length);
    const deaf = [...new Set(rooms.flatMap(r => r.guards.map(g => g.k)).filter(k => !GUARD_KINDS[k].lure))].map(k => 'les ' + GUARD_KINDS[k].plural);
    this.deafNames = deaf.length ? deaf.join(' et ') : 'les caméras';
    this.hideNames = [...new Set([this.tile('C').label, this.tile('P').label].map(l => l.replace(/ \(cachette\)/, '').toLowerCase()))].join(', ');
    this.st.set(startPlay(rooms[0], m.tools));
    this.say(m.goal);
    this.emitProgress();
  }

  ngOnDestroy(): void { this.timers.forEach(t => clearTimeout(t)); }

  /* ── Affichage ── */

  protected sid(n: string): string { return `${this.pid}-${n}`; }
  protected url(n: string): string { return `url(#${this.pid}-${n})`; }
  protected cx(i: number): number { return (i % this.room().w) * 10 + 5; }
  protected cy(i: number): number { return Math.floor(i / this.room().w) * 10 + 5; }
  protected cellsOf(n: number): number[] { return Array.from({ length: n }, (_, k) => k); }
  protected itemKind(i: number): string { return ITEM_KIND[this.room().icon.get(i) ?? ''] ?? 'paper'; }
  protected doorH(i: number): boolean { return this.doorAxis(i) === '-door h'; }
  /** Trois invités en cercle, tournés les uns vers les autres */
  protected guests(v: number): { x: number; y: number; a: number; c: string; h: string }[] {
    const cs = ['#1d2433', '#6b1f2e', '#2d4a3e', '#3a2f4f', '#5b4a2e'], hs = ['#2a1d14', '#8a6a3a', '#c9a35a', '#9a9a9a', '#4a2a1a'];
    return [[3, 3.4], [7, 3.6], [5, 7.2]].map(([x, y], k) => ({ x, y, a: Math.atan2(5 - y, 5 - x) * 180 / Math.PI + 90, c: cs[(v + k) % 5], h: hs[(v * 2 + k) % 5] }));
  }
  /** Angle continu (pas de tour complet quand on passe de l'ouest au nord) */
  protected angle(key: string, d: Dir): number {
    const target = ANGLE[d], prev = this.angles.get(key);
    if (prev === undefined) { this.angles.set(key, target); return target; }
    const diff = ((target - prev) % 360 + 540) % 360 - 180;
    if (diff) this.angles.set(key, prev + diff);
    return prev + diff;
  }

  protected tile(c: string) { return TILE[this.mission.theme][c] ?? { icon: '', label: 'Sol' }; }
  protected kindOf(g: GuardState) { return GUARD_KINDS[this.room().guards[g.id].k]; }
  protected pos(i: number): string { const r = this.room(); return `translate(${(i % r.w) * 100}%, ${Math.floor(i / r.w) * 100}%)`; }

  protected tileClass(c: string, i: number): string {
    if (c === '#') return '-wall';
    if (c === '+' || (c === '=' && this.st().open.includes(i))) return this.doorAxis(i);
    if (c === '=') return '-lock';
    if (c === 'T') return '-furn';
    if (c === '~') return '-water';
    if (c === 'X') return '-crowd';
    if (isHide(c)) return '-hide';
    if (c === 'S') return '-start';
    if (c === 'E') return '-exit';
    return '-floor';
  }

  /** Une porte dans un mur horizontal se dessine à plat, dans un mur vertical debout */
  private doorAxis(i: number): string {
    const r = this.room(), x = i % r.w;
    const wall = (j: number) => r.tiles[j] === '#';
    return (x > 0 && wall(i - 1)) || (x < r.w - 1 && wall(i + 1)) ? '-door h' : '-door';
  }

  protected cellLabel(i: number): string {
    const r = this.room(), s = this.st(), c = r.tiles[i];
    const x = i % r.w, y = Math.floor(i / r.w);
    let t = c === 'E' ? r.def.exit?.label ?? 'Sortie' : r.items.includes(i) && !s.got.includes(i) ? r.label.get(i) ?? 'Objet' : this.tile(c).label;
    if (c === '=' && s.open.includes(i)) t = 'Porte ouverte';
    const parts = [`Colonne ${x + 1}, rangée ${y + 1} : ${t}`];
    const g = s.guards.find(z => z.i === i);
    if (g) parts.push(`${this.kindOf(g).name} regardant ${({ N: 'vers le haut', S: 'vers le bas', E: 'à droite', W: 'à gauche' } as const)[g.d]}`);
    if (i === s.pos) parts.push(s.hidden ? 'vous, caché·e' : 'vous');
    if (this.seenNow().has(i)) parts.push('surveillée');
    else if (this.seenNext().has(i)) parts.push('surveillée au prochain tour');
    if (this.moves().has(i)) parts.push('accessible');
    if (this.noiseTargets().has(i)) parts.push('bruit possible');
    if (this.hideRing().has(i)) parts.push('cachette accessible');
    return parts.join(', ');
  }

  protected nextMark(g: GuardState): string {
    const [n] = guardsNext(this.room(), [g]);
    if (n.i !== g.i) return ARROW[dirTo(this.room().w, g.i, n.i)];
    return n.d !== g.d ? '↻' : '·';
  }

  /* ── Commandes ── */

  @HostListener('window:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (this.over() || this.busy()) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'Escape' && this.mode() !== 'move') { this.mode.set('move'); return; }
    const r = this.room(), p = this.st().pos;
    const k: Record<string, number> = { ArrowUp: -r.w, ArrowDown: r.w, ArrowLeft: -1, ArrowRight: 1 };
    const d = k[e.key];
    if (d === undefined) return;
    const to = p + d;
    if ((d === 1 || d === -1) && Math.floor(to / r.w) !== Math.floor(p / r.w)) return;
    e.preventDefault();
    this.mode.set('move');
    if (to >= 0 && to < r.tiles.length) this.play({ t: 'move', to });
  }

  protected tap(i: number): void {
    if (this.over() || this.busy()) return;
    if (this.mode() === 'hide') {
      this.mode.set('move');
      if (this.hideSpots().includes(i)) this.play({ t: 'hide', to: i });
      return;
    }
    if (this.mode() === 'noise') {
      this.mode.set('move');
      if (this.noiseTargets().has(i) || lureTarget(this.room(), this.st(), i)) this.play({ t: 'noise', at: i });
      return;
    }
    if (this.moves().has(i)) this.play({ t: 'move', to: i });
  }

  protected wait(): void { this.mode.set('move'); this.play({ t: 'wait' }); }
  protected hide(): void {
    const spots = this.hideSpots();
    if (this.mode() === 'hide') { this.mode.set('move'); return; }
    if (spots.length === 1) { this.mode.set('move'); this.play({ t: 'hide', to: spots[0] }); return; }
    this.mode.set('hide');
  }
  protected toggleNoise(): void { this.mode.update(m => (m === 'noise' ? 'move' : 'noise')); }
  protected useBadge(): void { const d = this.badgeDoor(); this.mode.set('move'); if (d !== null) this.play({ t: 'move', to: d }); }

  protected retreat(): void {
    if (this.over() || this.busy()) return;
    this.mode.set('move');
    const s = this.st();
    this.st.set(startPlay(this.room(), s.tools, s.got, s.open));
    this.turns.update(t => t + 2);
    this.say('Vous rebroussez chemin jusqu’à l’entrée de l’étage (+2 tours).');
    this.afterTurn();
  }

  private play(a: Action): void {
    const r = this.room(), before = this.st();
    const res = act(r, before, a);
    if (!res.ok) return;
    if ((a.t === 'move' || (a.t === 'hide' && a.to !== undefined)) && res.st.pos !== before.pos) this.meDir.set(dirTo(r.w, before.pos, res.st.pos));
    this.turns.update(t => t + 1);
    if (res.unlocked) this.say('Badge passé : le voyant passe au vert, la porte s’ouvre.');
    if (res.lured !== null) { this.say(`Un bruit… ${GUARD_KINDS[r.guards[res.lured].k].name.toLowerCase()} part vérifier.`); this.pop(a.t === 'noise' ? a.at : res.st.pos, 'Bruit', 'huh'); }
    if (a.t === 'hide') this.say('Vous vous dissimulez.');
    if (res.spotted !== null) return this.caught(res);
    if (res.picked !== null) {
      const lbl = r.label.get(res.picked) ?? 'Objet';
      this.say(r.keys.includes(res.picked) ? 'Un badge d’accès traînait là : +1 badge.' : r.required.includes(res.picked) ? `${lbl} : c’est fait !` : `Bonus : ${lbl}.`);
      this.pop(res.picked, r.keys.includes(res.picked) ? '+1 badge' : r.required.includes(res.picked) ? 'Objectif ✓' : 'Bonus ✓', 'got');
    }
    this.st.set(res.st);
    if (res.exit) return this.roomCleared();
    this.afterTurn();
  }

  private caught(res: Outcome): void {
    const r = this.room();
    this.st.set(res.st);
    this.spotter.set(res.spotted);
    this.alerts.update(a => a + 1);
    this.miss.emit();
    this.busy.set(true);
    this.shake.set(true);
    const who = GUARD_KINDS[r.guards[res.spotted ?? 0].k].name;
    const last = this.alerts() >= MAX_ALERTS;
    this.say(last ? `${who} vous a repéré·e : troisième alerte !` : `${who} vous a repéré·e. On vous raccompagne à l’entrée de l’étage.`);
    this.emitProgress();
    this.later(() => {
      this.shake.set(false);
      this.spotter.set(null);
      if (last) return this.finish(false, 'caught');
      const s = this.st();
      this.st.set(startPlay(r, s.tools, s.got, s.open));
      this.meDir.set('N');
      this.busy.set(false);
      this.afterTurn();
    }, 1100);
  }

  private roomCleared(): void {
    const r = this.room(), s = this.st();
    this.cleared++;
    const b = r.bonus.filter(t => s.got.includes(t)).length;
    this.bonusGot += b;
    this.emitProgress();
    if (this.ri() >= this.rooms.length - 1) return this.finish(true);
    this.busy.set(true);
    this.banner.set(`${r.def.name} : étage franchi${b ? ` avec ${b} bonus` : ''}.`);
    this.later(() => {
      this.ri.update(i => i + 1);
      const n = this.room();
      this.st.set(startPlay(n, s.tools));
      this.meDir.set('N');
      this.banner.set('');
      this.busy.set(false);
      this.say(`${n.def.name} : ${n.def.brief}`);
      this.afterTurn();
    }, 1000);
  }

  private afterTurn(): void {
    this.emitProgress();
    if (!this.over() && this.turns() >= this.budget) this.finish(false, 'late');
  }

  /* ── Bilan ── */

  private stats(ok: boolean): RunStats {
    return {
      ok, rooms: this.rooms.length, cleared: this.cleared, alerts: this.alerts(), bonus: this.bonusGot,
      bonusMax: this.rooms.reduce((t, r) => t + r.bonus.length, 0), turns: this.turns(), budget: this.budget, par: this.par,
    };
  }

  private emitProgress(): void {
    const live = scoreRun({ ...this.stats(true) }) * (0.35 + 0.65 * this.cleared / this.rooms.length);
    this.progress.emit({ live: this.alerts() >= MAX_ALERTS ? 0.1 : Math.max(0, Math.min(1, live)), time: Math.max(0, 1 - this.turns() / this.budget) });
  }

  private finish(ok: boolean, why: 'caught' | 'late' | 'win' = 'win'): void {
    if (this.over()) return;
    this.over.set(true);
    this.busy.set(false);
    this.mode.set('move');
    const s = this.stats(ok), score = scoreRun(s);
    const perfect = ok && s.alerts === 0 && s.bonus === s.bonusMax && s.turns <= s.par;
    const title = !ok ? (why === 'late' ? 'Mission avortée : plus le temps.' : 'Mission échouée : vous êtes raccompagné·e dehors.')
      : perfect ? 'Infiltration parfaite : une ombre.' : s.alerts === 0 ? 'Mission réussie, sans une seule alerte.' : 'Mission réussie… de justesse.';
    const text = !ok ? (why === 'late' ? this.mission.late : this.mission.caught) : this.mission.win;
    this.summary.set({
      ok, title, text, score,
      rows: [
        ['Étages franchis', `${s.cleared}/${s.rooms}`],
        ['Alertes', `${s.alerts}/${MAX_ALERTS}`],
        ['Bonus', `${s.bonus}/${s.bonusMax}`],
        ['Tours', `${s.turns} / ${s.budget}`],
        ['Référence du solveur', `${s.par} tours`],
      ],
    });
    this.say(title);
    if (score < 0.5) this.miss.emit();
    this.progress.emit({ live: score, time: 0 });
    this.later(() => this.done.emit(score), 2000);
  }

  private say(t: string): void { this.log.update(l => [t, ...l].slice(0, 4)); }
  private pop(i: number, text: string, tone: Fx['tone']): void {
    const f: Fx = { i, text, tone, id: ++uid };
    this.fx.update(a => [...a, f]);
    this.later(() => this.fx.update(a => a.filter(z => z.id !== f.id)), 1000);
  }
  private later(fn: () => void, ms: number): void { this.timers.push(setTimeout(fn, ms)); }
}

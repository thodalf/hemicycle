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
          <span class="chip" [class.good]="st().got.includes(t)">{{ room().icon.get(t) }} {{ room().label.get(t) }} {{ st().got.includes(t) ? '✓' : '' }}</span>
        }
        @for (t of room().bonus; track t) {
          <span class="chip" [class.accent]="st().got.includes(t)">{{ room().icon.get(t) }} Bonus : {{ room().label.get(t) }} {{ st().got.includes(t) ? '✓' : '' }}</span>
        }
        <span class="chip" [class.good]="exitReady()">{{ room().def.exit?.icon ?? '🚪' }} {{ room().def.exit?.label ?? 'Sortie' }}</span>
      </div>
      <p class="brief">
        @if (over()) { <b>{{ summary()?.title }}</b> }
        @else if (banner()) { <b>{{ banner() }}</b> }
        @else if (mode() === 'hide') { 🙈 Touchez une cachette cerclée : vous vous y glissez, invisible aussitôt. }
        @else if (mode() === 'noise') { 🪙 Touchez une case cerclée : le curieux le plus proche viendra vérifier… et y restera. Touchez ailleurs pour annuler. }
        @else { {{ room().def.brief }} }
      </p>

      <div class="board" [class.shake]="shake()">
        <div class="grid" [style.grid-template-columns]="'repeat(' + room().w + ', 1fr)'" role="group" [attr.aria-label]="'Plan : ' + room().def.name">
          @for (c of room().tiles; track $index; let i = $index) {
            @let lit = seenNow().has(i);
            @let warn = seenNext().has(i);
            <button type="button" class="cell" [class]="'cell t' + tileClass(c, i)" [class.move]="moves().has(i)"
                    [class.ready]="i === room().exit && exitReady()" [disabled]="over() || busy()" (click)="tap(i)" [attr.aria-label]="cellLabel(i)" [attr.tabindex]="c === '#' ? -1 : null">
              @if (lit) { <i class="lit"></i> }
              @if (warn) { <i class="warn"></i> }
              @if (cellIcon(i); as ic) { <span class="ti">{{ ic }}</span> }
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
                <span class="ic">{{ k.icon }}</span>
                <i class="face" [class]="'face d-' + g.d"></i>
                <i class="nx">{{ nextMark(g) }}</i>
                @if (spotter() === g.id) { <b class="bubble bang">!</b> } @else if (g.lure?.length) { <b class="bubble huh">?</b> }
              </span>
            }
            <span class="tok me" [class.hidden]="st().hidden" [style.width.%]="100 / room().w" [style.height.%]="100 / room().h" [style.transform]="pos(st().pos)">
              <span class="ic">{{ mission.me }}</span>
            </span>
            @for (f of fx(); track f.id) {
              <span class="tok fxw" [style.width.%]="100 / room().w" [style.height.%]="100 / room().h" [style.transform]="pos(f.i)"><b class="fx" [class]="'fx ' + f.tone">{{ f.text }}</b></span>
            }
          </div>
        </div>
      </div>

      @if (!over()) {
        <div class="tools" role="toolbar" aria-label="Outils">
          <button type="button" class="btn small tool" [disabled]="busy()" (click)="wait()" aria-label="Attendre un tour">⏳ Attendre</button>
          <button type="button" class="btn small tool" [class.on]="mode() === 'hide'" [disabled]="busy() || !hideSpots().length" (click)="hide()"
                  [attr.aria-label]="'Se cacher, ' + st().tools.cacher + ' restant(s)'">🙈 Se cacher <b class="n">{{ st().tools.cacher }}</b></button>
          <button type="button" class="btn small tool" [class.on]="mode() === 'noise'" [disabled]="busy() || st().tools.bruit <= 0" (click)="toggleNoise()"
                  [attr.aria-pressed]="mode() === 'noise'" [attr.aria-label]="'Faire du bruit, ' + st().tools.bruit + ' restant(s)'">🪙 Bruit <b class="n">{{ st().tools.bruit }}</b></button>
          <button type="button" class="btn small tool" [disabled]="busy() || badgeDoor() === null" (click)="useBadge()"
                  [attr.aria-label]="'Badge, ' + st().tools.badge + ' restant(s)'">🪪 Badge <b class="n">{{ st().tools.badge }}</b></button>
          <button type="button" class="btn small tool ghost" [disabled]="busy()" (click)="retreat()" aria-label="Rebrousser chemin : recommencer l’étage, deux tours de pénalité">↩︎ Rebrousser</button>
        </div>
        <ul class="log" aria-live="polite">@for (l of log(); track $index) { <li>{{ l }}</li> }</ul>
        <details class="legend">
          <summary>Légende et règles</summary>
          <ul>
            <li><i class="sw sw-lit"></i> Regard actuel : y entrer, c’est être repéré·e.</li>
            <li><i class="sw sw-warn"></i> Regard au prochain tour : n’y restez pas.</li>
            <li><i class="sw sw-ear"></i> Case où un bruit serait entendu (mode 🪙).</li>
            <li><b>↑→↓←</b> prochain pas de l’agent · <b>↻</b> il se retourne · <b>·</b> il reste.</li>
            <li>Touchez une case voisine (point bleu) ou utilisez les flèches du clavier. Les agents ne regardent que droit devant : passez derrière eux.</li>
            <li>🙈 Se cacher : glissez-vous dans une cachette voisine ({{ tile('C').icon }} {{ tile('P').icon }}) ; invisible aussitôt, et tant que vous y restez. Y entrer sans se cacher ne protège pas.</li>
            <li>🪙 Un bruit attire le curieux le plus proche (six pas au plus), qui y reste planté ; {{ deafNames }} n’y prêtent pas attention.</li>
            <li>🪪 Le badge ouvre une porte verrouillée 🔒 ; on en trouve parfois sur place.</li>
            <li>Trois alertes et l’on vous raccompagne dehors. Bonus et rapidité améliorent le score.</li>
          </ul>
        </details>
      } @else if (summary(); as s) {
        <div class="end" [class.ok]="s.ok">
          <p>{{ s.text }}</p>
          <dl>@for (r of s.rows; track r[0]) { <dt>{{ r[0] }}</dt><dd>{{ r[1] }}</dd> }</dl>
          <p class="score">Score : <b class="mono">{{ round(s.score * 100) }} %</b></p>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .inf { display: grid; gap: 8px; --floor: #d8cfbd; --floor-2: #cfc4ae; --wall: #34343c; --door: #9a7046; --lamp: rgba(255, 196, 40, .62); --lamp-next: rgba(240, 130, 20, .95); --ear: #2bb3c0; }
    .th-ambassade { --floor: #ece2cc; --floor-2: #e2d5b8; --wall: #5d2a36; --door: #b08a3c; }
    .th-catacombes { --floor: #9a8d79; --floor-2: #8f816c; --wall: #2f2a24; --door: #6d5b45; --lamp: rgba(255, 226, 120, .6); }
    .head { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; justify-content: space-between; font-size: 12.5px; }
    .where { display: inline-flex; align-items: baseline; gap: 6px; } .tours.low b { color: var(--bad); }
    .alerts { display: inline-flex; gap: 4px; i { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--bad); } i.on { background: var(--bad); } }
    .goals { display: flex; flex-wrap: wrap; gap: 4px; .chip { font-size: 11px; } }
    .brief { margin: 0; font-size: 12.5px; color: var(--ink-2); min-height: 2.6em; }
    .board { padding: 4px; border-radius: 10px; background: var(--wall); width: 100%; max-width: 460px; justify-self: center; user-select: none; box-sizing: border-box; }
    .grid { position: relative; display: grid; }
    .cell { position: relative; aspect-ratio: 1; min-width: 0; border: 0; border-radius: 0; padding: 0; margin: 0; cursor: pointer; display: grid; place-items: center;
      background: var(--floor); box-shadow: inset 0 0 0 .5px rgba(0, 0, 0, .12); font: inherit;
      &:disabled { cursor: default; } &:focus-visible { outline: 3px solid var(--accent); outline-offset: -3px; z-index: 2; } }
    .cell:nth-child(2n) { background: var(--floor-2); }
    .cell.t-wall { background: var(--wall); box-shadow: none; cursor: default; }
    .cell.t-door { background: linear-gradient(90deg, var(--floor) 0 20%, var(--door) 20% 80%, var(--floor) 80%); }
    .cell.t-door.h { background: linear-gradient(0deg, var(--wall) 0 30%, var(--door) 30% 70%, var(--wall) 70%); }
    .cell.t-lock { background: #7c2b2b; }
    .cell.t-furn { background: color-mix(in srgb, var(--door) 55%, var(--floor)); }
    .cell.t-water { background: #3f7290; background-image: repeating-linear-gradient(160deg, transparent 0 6px, rgba(255, 255, 255, .18) 6px 8px); }
    .cell.t-crowd { background: color-mix(in srgb, var(--wall) 25%, var(--floor)); }
    .cell.t-hide { background: color-mix(in srgb, #3f8a4f 30%, var(--floor)); }
    .cell.t-start { background: color-mix(in srgb, #2f6fb3 22%, var(--floor)); }
    .cell.t-exit { background: color-mix(in srgb, #2f6fb3 35%, var(--floor)); }
    .cell.ready { box-shadow: inset 0 0 0 3px #3fb36b; }
    .ti { position: relative; z-index: 1; font-size: clamp(13px, 4vw, 21px); line-height: 1; }
    .lit { position: absolute; inset: 0; background: var(--lamp); }
    .warn { position: absolute; inset: 3px; border: 2px dashed var(--lamp-next); border-radius: 3px;
      background: repeating-linear-gradient(45deg, transparent 0 4px, rgba(240, 130, 20, .22) 4px 7px); }
    .dot { position: absolute; z-index: 1; width: 30%; height: 30%; border-radius: 50%; background: rgba(47, 111, 179, .7); box-shadow: 0 0 0 2px rgba(255, 255, 255, .7); }
    .ear { position: absolute; inset: 2px; z-index: 2; border: 3px solid var(--ear); border-radius: 50%; pointer-events: none; &.hid { border-color: #3f8a4f; border-style: double; border-width: 4px; } }
    .layer { position: absolute; inset: 0; pointer-events: none; }
    .tok { position: absolute; left: 0; top: 0; display: grid; place-items: center; transition: transform .22s ease; z-index: 3; }
    .tok .ic { font-size: clamp(15px, 4.6vw, 24px); line-height: 1; filter: drop-shadow(0 1px 1px rgba(0, 0, 0, .45)); }
    .guard::before { content: ''; position: absolute; inset: 12%; border-radius: 50%; background: rgba(255, 245, 225, .82); box-shadow: 0 0 0 2px var(--bad); }
    .guard.cam::before { border-radius: 4px; box-shadow: 0 0 0 2px #888; }
    .guard.lured::before { box-shadow: 0 0 0 2px #f4d35e; }
    .guard .ic { position: relative; }
    .face { position: absolute; width: 0; height: 0; border: 5px solid transparent; }
    .face.d-N { top: 0; left: calc(50% - 5px); border-bottom-color: var(--bad); border-top-width: 0; }
    .face.d-S { bottom: 0; left: calc(50% - 5px); border-top-color: var(--bad); border-bottom-width: 0; }
    .face.d-E { right: 0; top: calc(50% - 5px); border-left-color: var(--bad); border-right-width: 0; }
    .face.d-W { left: 0; top: calc(50% - 5px); border-right-color: var(--bad); border-left-width: 0; }
    .nx { position: absolute; right: 2%; bottom: 2%; min-width: 13px; height: 13px; padding: 0 1px; border-radius: 7px; background: #1d1d22; color: #fff;
      font: 700 9.5px/13px var(--font-body); font-style: normal; text-align: center; }
    .me::before { content: ''; position: absolute; inset: 10%; border-radius: 50%; background: #e9f1fb; box-shadow: 0 0 0 2px #2f6fb3; }
    .me .ic { position: relative; }
    .me.hidden { opacity: .45; } .me.hidden::before { box-shadow: 0 0 0 2px #3f8a4f; background: transparent; }
    .bubble { position: absolute; top: -40%; left: 50%; transform: translateX(-50%); z-index: 4; min-width: 18px; padding: 0 4px; border-radius: 9px;
      font: 900 13px/18px var(--font-body); text-align: center; }
    .bang { background: var(--bad); color: #fff; animation: pop .5s ease; }
    .huh { background: #f4d35e; color: #3a2d00; }
    .fxw { z-index: 5; }
    .fx { font: 800 12px var(--font-body); white-space: nowrap; pointer-events: none; animation: rise 1s ease forwards; text-shadow: 0 1px 2px #000; color: #fff;
      &.got { color: #b8f5c8; } &.bang { color: #ffb4a8; } &.huh { color: #ffe08a; } }
    .board.shake { animation: shake .4s ease; }
    @keyframes rise { to { transform: translateY(-20px); opacity: 0; } }
    @keyframes pop { 0% { transform: translateX(-50%) scale(.3); } 70% { transform: translateX(-50%) scale(1.25); } }
    @keyframes shake { 25% { transform: translateX(-4px); } 50% { transform: translateX(4px); } 75% { transform: translateX(-2px); } }
    .tools { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
    .tool { min-height: 36px; min-width: 44px; display: inline-flex; align-items: center; gap: 4px; .n { font-family: var(--font-mono); }
      &.on { background: #f4d35e; border-color: #c9a92c; color: #3a2d00; } &.ghost { color: var(--ink-2); } }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 70px; overflow: auto; font-size: 11.5px; color: var(--ink-2);
      li:first-child { color: var(--ink); } }
    .legend { font-size: 11.5px; color: var(--ink-2); summary { cursor: pointer; min-height: 32px; display: flex; align-items: center; }
      ul { margin: 4px 0 0; padding-left: 16px; display: grid; gap: 3px; } }
    .sw { display: inline-block; width: 14px; height: 14px; vertical-align: -2px; border-radius: 3px; background: var(--floor); box-sizing: border-box; }
    .sw-lit { background: linear-gradient(var(--lamp), var(--lamp)), var(--floor); }
    .sw-warn { border: 2px dashed var(--lamp-next); }
    .sw-ear { border: 3px solid var(--ear); }
    .end { padding: 10px 12px; border-radius: 10px; background: var(--bad-soft); font-size: 13px; display: grid; gap: 6px;
      &.ok { background: var(--good-soft); } p { margin: 0; }
      dl { display: grid; grid-template-columns: auto auto; gap: 2px 12px; margin: 0; font-size: 12px; } dt { color: var(--ink-2); } dd { margin: 0; text-align: right; font-family: var(--font-mono); }
      .score { font-size: 14px; } }
    @media (prefers-reduced-motion: reduce) { .tok { transition: none; } .bang, .fx, .board.shake { animation: none; } }
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
  protected deafNames = '';

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
  private cleared = 0;
  private bonusGot = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];

  protected readonly room = computed(() => this.rooms[this.ri()] ?? this.rooms[0]);
  protected readonly seenNow = computed(() => (this.rooms.length ? watchMap(this.room(), this.st().guards) : new Map<number, number>()));
  protected readonly seenNext = computed(() => (this.rooms.length ? watchMap(this.room(), guardsNext(this.room(), this.st().guards)) : new Map<number, number>()));
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
    this.par = missionPar(rooms, m.tools);
    this.budget = turnBudget(this.par, diff, rooms.length);
    const deaf = [...new Set(rooms.flatMap(r => r.guards.map(g => g.k)).filter(k => !GUARD_KINDS[k].lure))].map(k => 'les ' + GUARD_KINDS[k].plural);
    this.deafNames = deaf.length ? deaf.join(' et ') : 'les caméras';
    this.st.set(startPlay(rooms[0], m.tools));
    this.say(m.goal);
    this.emitProgress();
  }

  ngOnDestroy(): void { this.timers.forEach(t => clearTimeout(t)); }

  /* ── Affichage ── */

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

  protected cellIcon(i: number): string {
    const r = this.room(), c = r.tiles[i], s = this.st();
    if (c === 'E') return r.def.exit?.icon ?? '🚪';
    if (r.items.includes(i)) return s.got.includes(i) ? '' : r.icon.get(i) ?? '';
    if (c === '=' && s.open.includes(i)) return '';
    if (i === s.pos && isHide(c)) return '';
    return this.tile(c).icon;
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
    this.turns.update(t => t + 1);
    if (res.unlocked) this.say('🪪 Badge passé : la porte s’ouvre.');
    if (res.lured !== null) { this.say(`🪙 Un bruit… ${GUARD_KINDS[r.guards[res.lured].k].name.toLowerCase()} part vérifier.`); this.pop(a.t === 'noise' ? a.at : res.st.pos, '🪙', 'huh'); }
    if (a.t === 'hide') this.say('🙈 Vous vous dissimulez.');
    if (res.spotted !== null) return this.caught(res);
    if (res.picked !== null) {
      const lbl = r.label.get(res.picked) ?? 'Objet';
      this.say(r.keys.includes(res.picked) ? '🪪 Un badge d’accès traînait là : +1 badge.' : r.required.includes(res.picked) ? `🎯 ${lbl} : c’est fait !` : `✨ Bonus : ${lbl}.`);
      this.pop(res.picked, r.icon.get(res.picked) ?? '✓', 'got');
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
    this.say(last ? `❗ ${who} vous a repéré·e : troisième alerte !` : `❗ ${who} vous a repéré·e. On vous raccompagne à l’entrée de l’étage.`);
    this.emitProgress();
    this.later(() => {
      this.shake.set(false);
      this.spotter.set(null);
      if (last) return this.finish(false, 'caught');
      const s = this.st();
      this.st.set(startPlay(r, s.tools, s.got, s.open));
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
    this.banner.set(`${r.def.exit?.icon ?? '🚪'} ${r.def.name} : étage franchi${b ? ` avec ${b} bonus` : ''}.`);
    this.later(() => {
      this.ri.update(i => i + 1);
      const n = this.room();
      this.st.set(startPlay(n, s.tools));
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

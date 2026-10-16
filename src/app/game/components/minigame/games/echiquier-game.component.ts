import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/* ============================================================
 *  Le grand échiquier : une partie d'influence au tour par tour
 *  (dans l'esprit de Twilight Struggle, en plus court). Huit tours ;
 *  à chaque tour, trois cartes à jouer : pour leurs opérations
 *  (placer de l'influence de proche en proche, ou tenter un coup
 *  diplomatique dans un pays instable, dés à l'appui), ou pour leur
 *  événement. Jouer pour ses opérations une carte dont l'événement
 *  profite à l'adversaire le déclenche pour lui. Les zones sont
 *  comptées à des tours annoncés (présence, domination, contrôle).
 *  Une jauge de tension monte avec les coups : au maximum, c'est la
 *  crise. L'adversaire répond coup pour coup, à découvert.
 *  Trois variantes : le monde (contre la Karstanie), l'Afrique
 *  (contre le Kantor), l'Union européenne (contre une coalition de
 *  capitales).
 *
 *  La simulation (carte, cartes, IA) est faite de fonctions pures
 *  exportées, testables hors d'Angular.
 * ============================================================ */

export type Variant = 'monde' | 'afrique' | 'europe';
export type Side = 'p' | 'r';
export type CardId = 'aide' | 'garantie' | 'commerce' | 'visite' | 'culture' | 'sommet' | 'mediation' | 'sanctions' | 'elections' | 'bilan'
  | 'propagande' | 'prets' | 'incident' | 'espionnage' | 'desinfo' | 'reseau';

export const TURNS = 8;
export const ROUNDS = 3;
export const HAND = 4;
/** La tension va de 0 à MAXT ; l'atteindre déclenche la crise */
export const MAXT = 5;

/* ── Données : zones, pays, cartes ─────────────────────────── */

export interface ZoneDef { id: string; name: string; icon: string; vals: [number, number, number]; close?: number; tint: string }
interface NodeDef { id: string; name: string; short?: string; at?: string; zone: string; c: number; r: number; stab: number; pivot?: boolean; anchor?: Side }
export interface MapNode extends NodeDef { i: number; zi: number; nb: number[]; short: string; at: string }
export interface Words {
  inf: string; country: string; countries: string; stab: string; coup: string; coupShort: string; tension: string; crisis: string;
}
export interface RivalText { name: string; the: string; The: string; of: string; emblem: string }
interface VariantData {
  cols: number; rows: number; zones: ZoneDef[]; nodes: NodeDef[];
  extra: [string, string][]; cut: [string, string][];
  start: { p: Record<string, number>; r: Record<string, number> };
  rival: RivalText; words: Words; brief: string;
  cards: Partial<Record<CardId, [string, string]>>;
}
export interface VariantDef extends Omit<VariantData, 'nodes'> { id: Variant; nodes: MapNode[]; links: [number, number][] }

const WORLD_WORDS: Words = {
  inf: 'influence', country: 'pays', countries: 'pays', stab: 'stabilité', coup: 'coup diplomatique', coupShort: 'Coup', tension: 'tension', crisis: 'crise internationale',
};

const DATA: Record<Variant, VariantData> = {
  monde: {
    cols: 5, rows: 5,
    zones: [
      { id: 'EU', name: 'Europe', icon: '🏰', vals: [3, 6, 9], close: 2, tint: '#6d8fd0' },
      { id: 'MO', name: 'Moyen-Orient', icon: '🏜️', vals: [3, 5, 7], close: 3, tint: '#d4a248' },
      { id: 'AS', name: 'Asie', icon: '🏯', vals: [3, 6, 8], close: 3, tint: '#c76a8a' },
      { id: 'AF', name: 'Afrique', icon: '🌍', vals: [2, 4, 6], tint: '#5fa36b' },
      { id: 'AM', name: 'Amériques', icon: '🌎', vals: [1, 3, 5], tint: '#8a76c4' },
    ],
    nodes: [
      { id: 'SCA', name: 'Scandinavie', short: 'Scandin.', zone: 'EU', c: 1, r: 0, stab: 4 },
      { id: 'VAL', name: 'Valdovie', zone: 'EU', c: 2, r: 0, stab: 3, pivot: true, anchor: 'r' },
      { id: 'MER', name: 'Méridia', zone: 'EU', c: 1, r: 1, stab: 2, pivot: true, anchor: 'p' },
      { id: 'BAL', name: 'Balkans', at: 'dans les Balkans', zone: 'EU', c: 2, r: 1, stab: 2 },
      { id: 'ACE', name: 'Asie centrale', short: 'Asie C.', zone: 'AS', c: 3, r: 1, stab: 2, anchor: 'r' },
      { id: 'SUB', name: 'Sous-continent', short: 'Sous-cont.', at: 'dans le sous-continent', zone: 'AS', c: 4, r: 1, stab: 3, pivot: true },
      { id: 'ASE', name: 'Asie du Sud-Est', short: 'Asie S-E', zone: 'AS', c: 4, r: 2, stab: 2, pivot: true },
      { id: 'PAC', name: 'Pacifique', at: 'dans le Pacifique', zone: 'AS', c: 4, r: 3, stab: 3, anchor: 'p' },
      { id: 'LEV', name: 'Levant', at: 'au Levant', zone: 'MO', c: 2, r: 2, stab: 2, pivot: true },
      { id: 'ZAM', name: 'Zamérie', zone: 'MO', c: 3, r: 2, stab: 1, anchor: 'r' },
      { id: 'GOL', name: 'Golfe', at: 'dans le Golfe', zone: 'MO', c: 3, r: 3, stab: 3, pivot: true },
      { id: 'MAG', name: 'Maghreb', at: 'au Maghreb', zone: 'AF', c: 1, r: 2, stab: 2, pivot: true, anchor: 'p' },
      { id: 'SAH', name: 'Sahel', at: 'au Sahel', zone: 'AF', c: 1, r: 3, stab: 1 },
      { id: 'COR', name: 'Corne de l’Afrique', short: 'Corne', at: 'dans la Corne de l’Afrique', zone: 'AF', c: 2, r: 3, stab: 1 },
      { id: 'AOU', name: 'Afrique de l’Ouest', short: 'Afr. Ouest', zone: 'AF', c: 1, r: 4, stab: 2, pivot: true },
      { id: 'CAR', name: 'Caraïbes', at: 'aux Caraïbes', zone: 'AM', c: 0, r: 1, stab: 1, anchor: 'p' },
      { id: 'AND', name: 'Andes', at: 'dans les Andes', zone: 'AM', c: 0, r: 2, stab: 2, pivot: true },
      { id: 'CSU', name: 'Cône Sud', at: 'dans le Cône Sud', zone: 'AM', c: 0, r: 3, stab: 3, pivot: true },
    ],
    extra: [['VAL', 'ACE'], ['AOU', 'CSU']],
    cut: [['CAR', 'MER'], ['AND', 'MAG'], ['CSU', 'SAH'], ['GOL', 'PAC']],
    start: { p: { MER: 1, MAG: 2, CAR: 1, PAC: 1, AOU: 1 }, r: { VAL: 1, ACE: 2, ZAM: 1, LEV: 1, SUB: 1 } },
    rival: { name: 'Karstanie', the: 'la Karstanie', The: 'La Karstanie', of: 'de la Karstanie', emblem: '🦅' },
    words: WORLD_WORDS,
    brief: 'La France et la Karstanie se disputent l’influence sur cinq continents. Dix-huit pays, cinq zones, huit tours.',
    cards: { propagande: ['📢', 'Propagande karste'], prets: ['💰', 'Prêts karstes'] },
  },
  afrique: {
    cols: 5, rows: 5,
    zones: [
      { id: 'NO', name: 'Afrique du Nord', icon: '🕌', vals: [3, 5, 7], close: 2, tint: '#d4a248' },
      { id: 'SA', name: 'Sahel', icon: '🐪', vals: [2, 4, 6], tint: '#c98a5a' },
      { id: 'GG', name: 'Golfe de Guinée', icon: '🌴', vals: [3, 6, 8], close: 3, tint: '#5fa36b' },
      { id: 'CE', name: 'Afrique centrale', icon: '🌳', vals: [2, 4, 6], tint: '#3f8f88' },
      { id: 'ES', name: 'Afrique de l’Est', icon: '⛰️', vals: [2, 5, 7], close: 3, tint: '#8a76c4' },
    ],
    nodes: [
      { id: 'TAM', name: 'Tamazie', zone: 'NO', c: 0, r: 0, stab: 2, anchor: 'p' },
      { id: 'KSO', name: 'Ksourane', zone: 'NO', c: 1, r: 0, stab: 2, pivot: true },
      { id: 'MAZ', name: 'Maziria', zone: 'NO', c: 2, r: 0, stab: 3, pivot: true },
      { id: 'OUR', name: 'Ourgane', zone: 'NO', c: 3, r: 0, stab: 1 },
      { id: 'TAD', name: 'Tadmékie', zone: 'SA', c: 0, r: 1, stab: 1 },
      { id: 'NIO', name: 'Nioulé', zone: 'SA', c: 1, r: 1, stab: 1, pivot: true },
      { id: 'BOU', name: 'Boukarie', zone: 'SA', c: 2, r: 1, stab: 2 },
      { id: 'DOU', name: 'Dounzé', zone: 'SA', c: 3, r: 1, stab: 2, pivot: true, anchor: 'r' },
      { id: 'LAG', name: 'Lagunie', zone: 'GG', c: 0, r: 2, stab: 2, anchor: 'p' },
      { id: 'PAL', name: 'Palmerie', zone: 'GG', c: 1, r: 2, stab: 2, pivot: true },
      { id: 'AKO', name: 'Akossa', zone: 'GG', c: 0, r: 3, stab: 3, pivot: true },
      { id: 'VOL', name: 'Volténie', zone: 'GG', c: 1, r: 3, stab: 1 },
      { id: 'NGO', name: 'Ngoréa', zone: 'CE', c: 2, r: 2, stab: 2, pivot: true, anchor: 'r' },
      { id: 'BAS', name: 'Bassoula', zone: 'CE', c: 2, r: 3, stab: 1, pivot: true },
      { id: 'KAN', name: 'Kandoua', zone: 'CE', c: 3, r: 3, stab: 2, anchor: 'r' },
      { id: 'LOM', name: 'Lomarie', zone: 'CE', c: 2, r: 4, stab: 1 },
      { id: 'SAB', name: 'Sabéane', zone: 'ES', c: 4, r: 1, stab: 2, pivot: true },
      { id: 'DAL', name: 'Dalouane', zone: 'ES', c: 4, r: 2, stab: 3, pivot: true },
      { id: 'IMB', name: 'Imbarie', zone: 'ES', c: 4, r: 3, stab: 2, anchor: 'p' },
      { id: 'TOU', name: 'Toumbéa', zone: 'ES', c: 4, r: 4, stab: 1 },
    ],
    extra: [['OUR', 'SAB'], ['DOU', 'DAL'], ['KAN', 'DAL'], ['LOM', 'TOU'], ['DOU', 'KAN']],
    cut: [],
    start: { p: { TAM: 2, LAG: 1, IMB: 1, PAL: 1, KSO: 1 }, r: { NGO: 2, KAN: 1, DOU: 1, BOU: 1, SAB: 1 } },
    rival: { name: 'Kantor', the: 'le Kantor', The: 'Le Kantor', of: 'du Kantor', emblem: '🐆' },
    words: WORLD_WORDS,
    brief: 'Vingt pays, cinq régions : la France et le Kantor rivalisent d’influence sur le continent, à coups d’aide, d’accords et de visites.',
    cards: {
      culture: ['📚', 'Francophonie'], sommet: ['🕊️', 'Sommet régional'], bilan: ['📈', 'Forum des investisseurs'],
      propagande: ['📢', 'Médias d’État kantoriens'], prets: ['💰', 'Prêts kantoriens'], espionnage: ['😠', 'Sentiment anti-français'],
    },
  },
  europe: {
    cols: 5, rows: 4,
    zones: [
      { id: 'IN', name: 'Institutions', icon: '🏛️', vals: [4, 7, 10], close: 2, tint: '#d4a248' },
      { id: 'NO', name: 'Nord', icon: '❄️', vals: [2, 4, 6], close: 3, tint: '#6d8fd0' },
      { id: 'CE', name: 'Centre', icon: '🏞️', vals: [3, 5, 7], close: 3, tint: '#5fa36b' },
      { id: 'ES', name: 'Est', icon: '🌲', vals: [2, 4, 6], tint: '#8a76c4' },
      { id: 'SU', name: 'Sud', icon: '☀️', vals: [3, 5, 7], tint: '#c76a5a' },
    ],
    nodes: [
      { id: 'NRL', name: 'Norlande', zone: 'NO', c: 1, r: 0, stab: 3 },
      { id: 'FRI', name: 'Frisonie', zone: 'NO', c: 2, r: 0, stab: 2, pivot: true, anchor: 'r' },
      { id: 'SKA', name: 'Skarnie', zone: 'NO', c: 3, r: 0, stab: 3, anchor: 'r' },
      { id: 'BLT', name: 'Baltavie', zone: 'NO', c: 4, r: 0, stab: 2, pivot: true },
      { id: 'LOR', name: 'Lorvanie', zone: 'CE', c: 0, r: 1, stab: 2, anchor: 'p' },
      { id: 'BEL', name: 'Belsanie', zone: 'CE', c: 1, r: 1, stab: 2, pivot: true },
      { id: 'ARV', name: 'Arvénie', zone: 'CE', c: 0, r: 2, stab: 1, anchor: 'p' },
      { id: 'COM', name: 'Commission', short: 'Commiss.', at: 'à la Commission', zone: 'IN', c: 2, r: 1, stab: 3, pivot: true },
      { id: 'PAR', name: 'Parlement', at: 'au Parlement', zone: 'IN', c: 1, r: 2, stab: 2 },
      { id: 'CON', name: 'Conseil', at: 'au Conseil', zone: 'IN', c: 2, r: 2, stab: 3, pivot: true },
      { id: 'KAL', name: 'Kaledie', zone: 'ES', c: 3, r: 1, stab: 2, pivot: true },
      { id: 'MOR', name: 'Morvanie', zone: 'ES', c: 4, r: 1, stab: 1, anchor: 'r' },
      { id: 'RUV', name: 'Ruvenie', zone: 'ES', c: 3, r: 2, stab: 1 },
      { id: 'TES', name: 'Tessarie', zone: 'ES', c: 4, r: 2, stab: 2, pivot: true },
      { id: 'IBE', name: 'Ibérane', zone: 'SU', c: 0, r: 3, stab: 2, anchor: 'p' },
      { id: 'LUS', name: 'Lusavie', zone: 'SU', c: 1, r: 3, stab: 2, pivot: true },
      { id: 'DLM', name: 'Dalmie', zone: 'SU', c: 2, r: 3, stab: 1 },
      { id: 'EGE', name: 'Égéane', zone: 'SU', c: 3, r: 3, stab: 2, pivot: true },
    ],
    extra: [],
    cut: [],
    start: { p: { LOR: 2, ARV: 1, IBE: 1, BEL: 1, PAR: 1 }, r: { FRI: 2, SKA: 1, MOR: 1, KAL: 1, CON: 1 } },
    rival: { name: 'Coalition', the: 'la coalition des capitales', The: 'La coalition des capitales', of: 'de la coalition', emblem: '🏛️' },
    words: {
      inf: 'influence', country: 'siège', countries: 'sièges', stab: 'fermeté', coup: 'retournement', coupShort: 'Retourner', tension: 'blocage', crisis: 'crise institutionnelle',
    },
    brief: 'Au sein de l’Union, la France rallie États et institutions face à une coalition de capitales : votes, alliances, budgets.',
    cards: {
      aide: ['💶', 'Fonds de cohésion'], garantie: ['🤝', 'Alliance de circonstance'], commerce: ['📜', 'Paquet législatif'], visite: ['✈️', 'Visite bilatérale'],
      culture: ['🎓', 'Réseau d’eurodéputés'], sommet: ['🌙', 'Sommet de compromis'], mediation: ['⚖️', 'Médiation de la présidence'],
      sanctions: ['⛔', 'Procédure d’infraction'], elections: ['🗳️', 'Élections nationales'], bilan: ['✅', 'Vote à la majorité qualifiée'],
      propagande: ['📢', 'Front des frugaux'], prets: ['💰', 'Rabais budgétaire'], incident: ['✋', 'Menace de veto'], espionnage: ['📰', 'Fuite dans la presse'],
      desinfo: ['📱', 'Campagne d’opinion'], reseau: ['🏛️', 'Vote au Conseil'],
    },
  },
};

export interface CardMech { ops: number; side: Side | 'n'; target: 'none' | 'country' | 'zone'; event: boolean }
export const MECH: Record<CardId, CardMech> = {
  aide: { ops: 2, side: 'p', target: 'country', event: true },
  garantie: { ops: 3, side: 'p', target: 'country', event: true },
  visite: { ops: 3, side: 'p', target: 'country', event: true },
  culture: { ops: 2, side: 'p', target: 'none', event: true },
  propagande: { ops: 2, side: 'r', target: 'none', event: true },
  prets: { ops: 3, side: 'r', target: 'none', event: true },
  incident: { ops: 2, side: 'r', target: 'none', event: true },
  espionnage: { ops: 2, side: 'r', target: 'none', event: true },
  desinfo: { ops: 3, side: 'r', target: 'none', event: true },
  commerce: { ops: 2, side: 'n', target: 'zone', event: true },
  sommet: { ops: 2, side: 'n', target: 'none', event: true },
  mediation: { ops: 2, side: 'n', target: 'country', event: true },
  sanctions: { ops: 3, side: 'n', target: 'country', event: true },
  elections: { ops: 1, side: 'n', target: 'country', event: true },
  bilan: { ops: 3, side: 'n', target: 'zone', event: true },
  reseau: { ops: 4, side: 'n', target: 'none', event: false },
};
const DECK: [CardId, number][] = [
  ['aide', 2], ['garantie', 2], ['visite', 2], ['culture', 2],
  ['propagande', 2], ['prets', 1], ['incident', 2], ['espionnage', 2], ['desinfo', 1],
  ['commerce', 3], ['sommet', 2], ['mediation', 2], ['sanctions', 2], ['elections', 1], ['bilan', 2], ['reseau', 2],
];
const BASE_CARD_TEXT: Record<CardId, [string, string]> = {
  aide: ['🌾', 'Aide au développement'], garantie: ['🛡️', 'Coopération militaire'], commerce: ['🚢', 'Accord commercial'], visite: ['✈️', 'Visite d’État'],
  culture: ['🎭', 'Soft power culturel'], sommet: ['🕊️', 'Sommet'], mediation: ['🤝', 'Médiation'], sanctions: ['⛔', 'Sanctions'],
  elections: ['🗳️', 'Élections anticipées'], bilan: ['📈', 'Forum économique'], propagande: ['📢', 'Propagande'], prets: ['💰', 'Prêts sans conditions'],
  incident: ['⚠️', 'Incident frontalier'], espionnage: ['🕵️', 'Affaire d’espionnage'], desinfo: ['📱', 'Désinformation'], reseau: ['🌐', 'Réseau diplomatique'],
};

function build(id: Variant): VariantDef {
  const d = DATA[id];
  const nodes: MapNode[] = d.nodes.map((n, i) => ({
    ...n, i, zi: d.zones.findIndex(z => z.id === n.zone), nb: [], short: n.short ?? n.name, at: n.at ?? `en ${n.name}`,
  }));
  const idx = new Map(nodes.map(n => [n.id, n.i]));
  const key = (a: string, b: string) => [a, b].sort().join('|');
  const cut = new Set(d.cut.map(([a, b]) => key(a, b)));
  const links: [number, number][] = [];
  const add = (a: number, b: number) => {
    if (cut.has(key(nodes[a].id, nodes[b].id)) || nodes[a].nb.includes(b)) return;
    nodes[a].nb.push(b); nodes[b].nb.push(a); links.push([a, b]);
  };
  for (const a of nodes) for (const b of nodes) if (a.i < b.i && Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1) add(a.i, b.i);
  for (const [a, b] of d.extra) add(idx.get(a)!, idx.get(b)!);
  return { ...d, id, nodes, links };
}
export const VARIANTS: Record<Variant, VariantDef> = { monde: build('monde'), afrique: build('afrique'), europe: build('europe') };

export function variantOf(id: string): Variant {
  return id.includes('afrique') ? 'afrique' : id.includes('europe') ? 'europe' : 'monde';
}

export function cardText(id: CardId, v: Variant): { icon: string; name: string } {
  const t = DATA[v].cards[id] ?? BASE_CARD_TEXT[id];
  return { icon: t[0], name: t[1] };
}

/** Texte de l'événement, du point de vue du joueur */
export function cardDesc(id: CardId, v: Variant): string {
  const V = VARIANTS[v], w = V.words, R = V.rival;
  const T = w.tension.charAt(0).toUpperCase() + w.tension.slice(1);
  switch (id) {
    case 'aide': return `+2 ${w.inf} dans un ${w.country} de ${w.stab} 1 ou 2, où qu’il soit.`;
    case 'garantie': return `+1 ${w.inf} là où vous êtes présent ; ce ${w.country} est protégé : plus de ${w.coup} adverse possible.`;
    case 'visite': return `+3 ${w.inf} dans un ${w.country} non contrôlé par l’adversaire, où qu’il soit.`;
    case 'culture': return `+1 ${w.inf} dans 4 ${w.countries} où vous êtes présent sans les contrôler.`;
    case 'commerce': return `+1 ${w.inf} dans 3 ${w.countries} d’une même zone (touchez la zone).`;
    case 'sommet': return `${T} −2 et +1 PV.`;
    case 'mediation': return `${T} −1 ; retire 2 ${w.inf} adverse dans un ${w.country} de ${w.stab} 1 ou 2.`;
    case 'sanctions': return `Retire 3 ${w.inf} adverse dans un ${w.country}. ${T} +1.`;
    case 'elections': return `Dans un ${w.country}, chaque camp perd la moitié de son ${w.inf}.`;
    case 'bilan': return `+1 PV par ${w.country} contrôlé dans une zone (3 au plus).`;
    case 'propagande': return `Pour ${R.the} : +1 ${w.inf} dans 3 ${w.countries} où elle est présente.`;
    case 'prets': return `Pour ${R.the} : +3 ${w.inf} dans un ${w.country} de ${w.stab} 1 ou 2.`;
    case 'incident': return `Pour ${R.the} : ${w.tension} +1 et +2 ${w.inf} à ses portes.`;
    case 'espionnage': return `Contre vous : −2 ${w.inf} française dans un ${w.country} pivot.`;
    case 'desinfo': return `Contre vous : −1 ${w.inf} française dans 3 ${w.countries}.`;
    case 'reseau': return 'Pas d’événement : quatre opérations.';
  }
}

/* ── État de la partie ─────────────────────────────────────── */

export interface Card { uid: number; id: CardId }
export interface ZoneScore { zone: string; zi: number; lv: [number, number]; pts: [number, number]; n: [number, number]; piv: [number, number] }
export interface Sched { turn: number; zones: number[]; res?: ZoneScore[] }
export interface Game {
  v: Variant; diff: number; seed: number;
  turn: number;
  /** Actions déjà jouées par le joueur ce tour-ci */
  acted: number;
  tension: number;
  vpP: number; vpR: number;
  p: number[]; r: number[];
  /** Protégé par ce camp : coups adverses interdits */
  shield: (Side | '')[];
  deck: Card[]; discard: Card[]; hand: Card[]; aiHand: Card[]; uid: number;
  sched: Sched[];
  classed: { p: boolean; r: boolean };
  crisis: Side | null;
  /** Poids de chaque zone dans l'évaluation (bilans à venir) */
  urg: number[];
  /** Bonus d'opérations de l'adversaire (difficulté) */
  aiBonus: number;
  /** Imprécision de l'adversaire (difficulté) */
  aiNoise: number;
}

export function rnd(g: { seed: number }): number {
  g.seed = (g.seed + 0x6d2b79f5) | 0;
  let t = g.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gauss(g: { seed: number }): number {
  const u = Math.max(1e-9, rnd(g)), v = rnd(g);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const other = (s: Side): Side => (s === 'p' ? 'r' : 'p');
export const infOf = (g: Game, s: Side): number[] => (s === 'p' ? g.p : g.r);
const V_ = (g: Game) => VARIANTS[g.v];

function shuffle<T>(g: Game, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(g) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function newGame(v: Variant, diff: number, seed: number): Game {
  const V = VARIANTS[v];
  const n = V.nodes.length;
  const g: Game = {
    v, diff, seed: seed | 0, turn: 1, acted: 0, tension: 0, vpP: 0, vpR: 0,
    p: new Array(n).fill(0), r: new Array(n).fill(0), shield: new Array(n).fill(''),
    deck: [], discard: [], hand: [], aiHand: [], uid: 0, sched: [], classed: { p: false, r: false }, crisis: null, urg: [],
    aiBonus: Number(process?.env?.['BONUS'] ?? 0), aiNoise: Number(process?.env?.['NOISE'] ?? NaN) || clamp(1.4 - 1.6 * (diff - 0.8), 0.3, 1.4),
  };
  for (const [k, c] of Object.entries(V.start.p)) g.p[V.nodes.findIndex(x => x.id === k)] = c;
  for (const [k, c] of Object.entries(V.start.r)) g.r[V.nodes.findIndex(x => x.id === k)] = c;
  for (const [id, k] of DECK) for (let i = 0; i < k; i++) g.deck.push({ uid: ++g.uid, id });
  shuffle(g, g.deck);
  // Bilans : une zone par tour du 2e au 6e (ordre tiré au sort, la zone la plus riche jamais au tour 2), puis bilan général au tour 8
  const order = shuffle(g, V.zones.map((_, i) => i));
  const top = V.zones.reduce((b, z, i) => (z.vals[2] > V.zones[b].vals[2] ? i : b), 0);
  if (order[0] === top) [order[0], order[2]] = [order[2], order[0]];
  g.sched = order.map((zi, k) => ({ turn: 2 + k, zones: [zi] }));
  g.sched.push({ turn: TURNS, zones: V.zones.map((_, i) => i) });
  // Difficulté : l'adversaire part avec un peu plus d'influence
  const extra = diff >= 1.35 ? 2 : diff >= 1.15 ? 1 : 0;
  for (let k = 0; k < extra; k++) {
    computeUrg(g);
    const at = greedyPlace(g, 'r', 1, 0);
    if (!at.length) break;
  }
  startTurn(g, true);
  return g;
}

function draw(g: Game): Card | undefined {
  if (!g.deck.length) { g.deck = shuffle(g, g.discard); g.discard = []; }
  return g.deck.pop();
}

/** Début de tour : détente, nouvelles cartes */
export function startTurn(g: Game, first = false): void {
  if (!first) g.tension = Math.max(0, g.tension - 1);
  g.acted = 0;
  g.classed = { p: false, r: false };
  while (g.hand.length < HAND) { const c = draw(g); if (!c) break; g.hand.push(c); }
  while (g.aiHand.length < HAND) { const c = draw(g); if (!c) break; g.aiHand.push(c); }
  computeUrg(g);
}

function computeUrg(g: Game): void {
  const V = V_(g);
  g.urg = V.zones.map((_, zi) => {
    let w = 0;
    for (const s of g.sched) if (s.turn >= g.turn && s.zones.includes(zi)) w += 0.8 ** (s.turn - g.turn);
    return w;
  });
}

/* ── Règles ────────────────────────────────────────────────── */

/** Contrôle : influence ≥ stabilité, et avance ≥ stabilité */
export function controller(g: Game, i: number): Side | null {
  const st = V_(g).nodes[i].stab;
  if (g.p[i] >= st + g.r[i]) return 'p';
  if (g.r[i] >= st + g.p[i]) return 'r';
  return null;
}

/** Pays où un camp peut placer de l'influence : là où il est présent, leurs voisins, ses accès directs */
export function reach(g: Game, s: Side): Set<number> {
  const V = V_(g), inf = infOf(g, s);
  const out = new Set<number>();
  for (const n of V.nodes) {
    if (n.anchor === s) out.add(n.i);
    if (inf[n.i] > 0) { out.add(n.i); for (const b of n.nb) out.add(b); }
  }
  return out;
}

export function placeCost(g: Game, s: Side, i: number): number { return controller(g, i) === other(s) ? 2 : 1; }

export function zoneClosed(g: Game, zi: number): boolean { const c = V_(g).zones[zi].close; return c !== undefined && g.tension >= c; }

export function opsOf(g: Game, s: Side, c: Card): number { return MECH[c.id].ops + (s === 'r' && MECH[c.id].ops <= 2 ? g.aiBonus : 0); }

/** Chances de réussite d'un coup (0…1) */
export function coupChance(g: Game, ops: number, i: number): number {
  return clamp(6 - (2 * V_(g).nodes[i].stab - ops), 0, 6) / 6;
}
export function coupAllowed(g: Game, s: Side, i: number): boolean {
  const n = V_(g).nodes[i];
  return infOf(g, other(s))[i] > 0 && g.shield[i] !== other(s) && !zoneClosed(g, n.zi);
}
export function coupTargets(g: Game, s: Side, ops: number): number[] {
  return V_(g).nodes.filter(n => coupAllowed(g, s, n.i) && coupChance(g, ops, n.i) > 0).map(n => n.i);
}
/** Un coup de plus déclencherait-il la crise ? */
export const crisisNext = (g: Game): boolean => g.tension + 1 >= MAXT;

/** Peut-on jouer l'événement de cette carte ? */
export function canEvent(g: Game, s: Side, c: Card): boolean {
  const m = MECH[c.id];
  if (!m.event || m.side === other(s)) return false;
  if (m.target === 'none') return true;
  return eventTargets(g, s, c.id).length > 0;
}

/** Cibles possibles d'un événement (indices de pays, ou de zones pour les cartes « zone ») */
export function eventTargets(g: Game, s: Side, id: CardId): number[] {
  const V = V_(g), o = other(s), mine = infOf(g, s), theirs = infOf(g, o);
  const ns = V.nodes;
  switch (id) {
    case 'aide': case 'prets': return ns.filter(n => n.stab <= 2).map(n => n.i);
    case 'garantie': return ns.filter(n => mine[n.i] > 0 && g.shield[n.i] !== s).map(n => n.i);
    case 'visite': return ns.filter(n => controller(g, n.i) !== o).map(n => n.i);
    case 'mediation': return ns.filter(n => n.stab <= 2 && theirs[n.i] > 0).map(n => n.i);
    case 'sanctions': case 'elections': return ns.filter(n => theirs[n.i] > 0).map(n => n.i);
    case 'espionnage': return ns.filter(n => n.pivot && theirs[n.i] > 0).map(n => n.i);
    case 'incident': return ns.filter(n => n.anchor === s).map(n => n.i);
    case 'commerce': return V.zones.map((_, zi) => zi).filter(zi => ns.some(n => n.zi === zi && controller(g, n.i) !== o));
    case 'bilan': return V.zones.map((_, zi) => zi);
    default: return [];
  }
}

/* ── Décompte des zones ────────────────────────────────────── */

export function zoneScore(g: Game, zi: number): ZoneScore {
  const V = V_(g), z = V.zones[zi];
  const n: [number, number] = [0, 0], piv: [number, number] = [0, 0];
  let K = 0;
  for (const nd of V.nodes) {
    if (nd.zi !== zi) continue;
    if (nd.pivot) K++;
    const c = controller(g, nd.i);
    if (!c) continue;
    const k = c === 'p' ? 0 : 1;
    n[k]++;
    if (nd.pivot) piv[k]++;
  }
  const lv: [number, number] = [0, 0], pts: [number, number] = [0, 0];
  for (const k of [0, 1] as const) {
    const o = 1 - k;
    if (!n[k]) continue;
    lv[k] = 1;
    if (n[k] > n[o] && piv[k] > piv[o]) lv[k] = 2;
    if (n[k] > n[o] && piv[k] === K) lv[k] = 3;
    pts[k] = z.vals[lv[k] - 1] + piv[k];
  }
  return { zone: z.id, zi, lv, pts, n, piv };
}

/** Fin de tour : décompte des zones prévues */
export function endTurn(g: Game): ZoneScore[] {
  const out: ZoneScore[] = [];
  for (const s of g.sched) {
    if (s.turn !== g.turn) continue;
    s.res = s.zones.map(zi => zoneScore(g, zi));
    for (const r of s.res) { g.vpP += r.pts[0]; g.vpR += r.pts[1]; out.push(r); }
  }
  return out;
}

/** Passage au tour suivant ; renvoie false si la partie est finie */
export function nextTurn(g: Game): boolean {
  if (g.turn >= TURNS || g.crisis) return false;
  g.turn++;
  startTurn(g);
  return true;
}

/** Score final 0…1 selon l'écart de PV (0,5 = égalité) ; la crise plafonne à 0,35 */
const K_SCORE = Number(process?.env?.['KS'] ?? 22);
export function scoreFromDiff(d: number): number { return clamp(0.5 + 0.5 * Math.tanh(d / K_SCORE), 0.02, 0.98); }
export function finalScore(g: Game): number {
  const s = scoreFromDiff(g.vpP - g.vpR);
  if (g.crisis === 'p') return Math.max(0.02, Math.min(0.35, s - 0.1));
  if (g.crisis === 'r') return Math.max(0.7, s);
  return s;
}
/** Projection en cours de partie : PV + bilan général si la partie s'arrêtait maintenant */
export function projectedDiff(g: Game): number {
  let d = g.vpP - g.vpR;
  if (!g.sched.find(s => s.turn === TURNS)?.res) for (let zi = 0; zi < V_(g).zones.length; zi++) { const z = zoneScore(g, zi); d += z.pts[0] - z.pts[1]; }
  return d;
}

/* ── Évaluation (pour l'IA) ────────────────────────────────── */

const LAMBDA = 2;
const EXPOSE = 0.35;
function prog(g: Game, i: number, s: Side, st: number): number {
  const mine = infOf(g, s)[i], theirs = infOf(g, other(s))[i];
  const need = theirs + st - mine;
  if (need <= 0) return 1 + 0.1 * Math.min(2, -need);
  return mine > 0 ? 0.6 * 0.6 ** (need - 1) : 0.45 * 0.6 ** (need - 1);
}

/** Valeur d'une position pour un camp (PV, bilans à venir pondérés, progression vers le contrôle) */
export function evaluate(g: Game, s: Side): number {
  const V = V_(g), o = other(s);
  const sk = s === 'p' ? 0 : 1;
  let e = s === 'p' ? g.vpP - g.vpR : g.vpR - g.vpP;
  for (let zi = 0; zi < V.zones.length; zi++) {
    if (!g.urg[zi]) continue;
    const z = zoneScore(g, zi);
    e += g.urg[zi] * (z.pts[sk] - z.pts[1 - sk]);
  }
  const canCoup = g.tension + 1 < MAXT;
  for (const n of V.nodes) {
    const zw = (V.zones[n.zi].vals[1] / 5) * (0.5 + 0.5 * Math.min(1.6, g.urg[n.zi])) * (n.pivot ? 1.5 : 1);
    e += LAMBDA * zw * (prog(g, n.i, s, n.stab) - prog(g, n.i, o, n.stab));
    // Exposition aux coups : un pays tenu de justesse et instable est une cible
    if (canCoup && !zoneClosed(g, n.zi)) {
      const c = controller(g, n.i);
      if (c) {
        const slack = Math.abs(g.p[n.i] - g.r[n.i]) - n.stab;
        const risk = clamp(6 - (2 * n.stab - 2.5), 0, 6) / 6 * (1 - Math.min(1, slack / 3));
        if (g.shield[n.i] !== c) e += (c === s ? -1 : 1) * EXPOSE * zw * risk * LAMBDA;
      }
    }
  }
  return e;
}

interface Snap { p: number[]; r: number[]; shield: (Side | '')[]; tension: number; vpP: number; vpR: number; seed: number; crisis: Side | null }
const save = (g: Game): Snap => ({ p: [...g.p], r: [...g.r], shield: [...g.shield], tension: g.tension, vpP: g.vpP, vpR: g.vpR, seed: g.seed, crisis: g.crisis });
const restore = (g: Game, s: Snap) => { g.p = s.p; g.r = s.r; g.shield = s.shield; g.tension = s.tension; g.vpP = s.vpP; g.vpR = s.vpR; g.seed = s.seed; g.crisis = s.crisis; };

/** Placement glouton d'influence (point par point, depuis les accès du début de la carte) */
export function greedyPlace(g: Game, s: Side, ops: number, noise: number, from?: Set<number>): number[] {
  const R = from ?? reach(g, s);
  const inf = infOf(g, s);
  const out: number[] = [];
  let left = ops;
  while (left > 0) {
    let best = -1, bv = -Infinity;
    const base = evaluate(g, s);
    for (const i of R) {
      const cost = placeCost(g, s, i);
      if (cost > left) continue;
      inf[i]++;
      const v = (evaluate(g, s) - base) / cost + (noise ? gauss(g) * noise * 0.3 : 0);
      inf[i]--;
      if (v > bv) { bv = v; best = i; }
    }
    if (best < 0) break;
    left -= placeCost(g, s, best);
    inf[best]++;
    out.push(best);
  }
  return out;
}

/* ── Événements ────────────────────────────────────────────── */

export interface Fx { changed: number[]; text: string }

function pickGreedy(g: Game, s: Side, cands: number[], k: number, delta: (i: number) => void): number[] {
  const out: number[] = [];
  const pool = [...cands];
  for (let n = 0; n < k && pool.length; n++) {
    let best = -1, bv = -Infinity;
    for (const i of pool) {
      const sn = save(g);
      delta(i);
      const v = evaluate(g, s);
      restore(g, sn);
      if (v > bv) { bv = v; best = i; }
    }
    delta(best);
    out.push(best);
    pool.splice(pool.indexOf(best), 1);
  }
  return out;
}

/** Applique l'événement au profit de s (cible choisie, ou automatique) */
export function applyEvent(g: Game, s: Side, id: CardId, target?: number): Fx {
  const V = V_(g), o = other(s), mine = infOf(g, s), theirs = infOf(g, o);
  const w = V.words, who = s === 'p' ? 'la France' : V.rival.the;
  const nm = (i: number) => V.nodes[i].at;
  const tgt = target ?? autoTarget(g, s, id);
  switch (id) {
    case 'aide': case 'prets': case 'visite': {
      if (tgt === undefined) return { changed: [], text: 'sans effet' };
      const k = id === 'aide' ? 2 : 3;
      mine[tgt] += k;
      return { changed: [tgt], text: `+${k} pour ${who} ${nm(tgt)}` };
    }
    case 'garantie': {
      if (tgt === undefined) return { changed: [], text: 'sans effet' };
      mine[tgt] += 1; g.shield[tgt] = s;
      return { changed: [tgt], text: `+1 ${nm(tgt)}, désormais protégé` };
    }
    case 'culture': case 'propagande': {
      const cands = V.nodes.filter(n => mine[n.i] > 0 && controller(g, n.i) !== s).map(n => n.i);
      const got = pickGreedy(g, s, cands, id === 'culture' ? 4 : 3, i => { mine[i]++; });
      return { changed: got, text: got.length ? `+1 pour ${who} ${got.map(nm).join(', ')}` : 'sans effet' };
    }
    case 'commerce': {
      if (tgt === undefined) return { changed: [], text: 'sans effet' };
      const cands = V.nodes.filter(n => n.zi === tgt && controller(g, n.i) !== o).map(n => n.i);
      const got = pickGreedy(g, s, cands, 3, i => { mine[i]++; });
      return { changed: got, text: `+1 ${got.map(nm).join(', ')}` };
    }
    case 'sommet':
      g.tension = Math.max(0, g.tension - 2);
      if (s === 'p') g.vpP++; else g.vpR++;
      return { changed: [], text: `${w.tension} −2, +1 PV pour ${who}` };
    case 'mediation': {
      g.tension = Math.max(0, g.tension - 1);
      if (tgt === undefined) return { changed: [], text: `${w.tension} −1` };
      const k = Math.min(2, theirs[tgt]); theirs[tgt] -= k;
      return { changed: [tgt], text: `${w.tension} −1, −${k} adverse ${nm(tgt)}` };
    }
    case 'sanctions': {
      if (tgt === undefined) return { changed: [], text: 'sans effet' };
      const k = Math.min(3, theirs[tgt]); theirs[tgt] -= k;
      g.tension = Math.min(MAXT - 1, g.tension + 1);
      return { changed: [tgt], text: `−${k} adverse ${nm(tgt)}, ${w.tension} +1` };
    }
    case 'elections': {
      if (tgt === undefined) return { changed: [], text: 'sans effet' };
      g.p[tgt] = Math.floor(g.p[tgt] / 2); g.r[tgt] = Math.floor(g.r[tgt] / 2);
      return { changed: [tgt], text: `${V.nodes[tgt].name} : chaque camp perd la moitié de son ${w.inf}` };
    }
    case 'bilan': {
      if (tgt === undefined) return { changed: [], text: 'sans effet' };
      const k = Math.min(3, V.nodes.filter(n => n.zi === tgt && controller(g, n.i) === s).length);
      if (s === 'p') g.vpP += k; else g.vpR += k;
      return { changed: V.nodes.filter(n => n.zi === tgt && controller(g, n.i) === s).map(n => n.i), text: `+${k} PV pour ${who} (${V.zones[tgt].name})` };
    }
    case 'incident': {
      g.tension = Math.min(MAXT - 1, g.tension + 1);
      if (tgt === undefined) return { changed: [], text: `${w.tension} +1` };
      mine[tgt] += 2;
      return { changed: [tgt], text: `${w.tension} +1, +2 pour ${who} ${nm(tgt)}` };
    }
    case 'espionnage': {
      if (tgt === undefined) return { changed: [], text: 'sans effet' };
      const k = Math.min(2, theirs[tgt]); theirs[tgt] -= k;
      return { changed: [tgt], text: `−${k} pour ${s === 'p' ? V.rival.the : 'la France'} ${nm(tgt)}` };
    }
    case 'desinfo': {
      const cands = V.nodes.filter(n => theirs[n.i] > 0).map(n => n.i);
      const got = pickGreedy(g, s, cands, 3, i => { theirs[i]--; });
      return { changed: got, text: got.length ? `−1 pour ${s === 'p' ? V.rival.the : 'la France'} ${got.map(nm).join(', ')}` : 'sans effet' };
    }
    case 'reseau': return { changed: [], text: '' };
  }
}

/** Meilleure cible d'un événement pour s */
export function autoTarget(g: Game, s: Side, id: CardId): number | undefined {
  if (MECH[id].target === 'none' && id !== 'prets' && id !== 'incident' && id !== 'espionnage') return undefined;
  const ts = eventTargets(g, s, id);
  if (!ts.length) return undefined;
  if (ts.length === 1) return ts[0];
  let best = ts[0], bv = -Infinity;
  for (const t of ts) {
    const sn = save(g);
    applyEvent(g, s, id, t);
    const v = evaluate(g, s);
    restore(g, sn);
    if (v > bv) { bv = v; best = t; }
  }
  return best;
}

/* ── Actions ───────────────────────────────────────────────── */

export type Action =
  | { k: 'inf'; uid: number; at: number[] }
  | { k: 'coup'; uid: number; at: number; roll?: number }
  | { k: 'event'; uid: number; at?: number }
  | { k: 'class'; uid: number };

export interface CoupRes { at: number; roll: number; ops: number; need: number; ok: boolean; removed: number; added: number }
export interface ActReport {
  side: Side; card: CardId; k: Action['k']; ops: number;
  changed: number[]; text: string;
  coup?: CoupRes;
  /** Événement adverse déclenché par une carte jouée pour ses opérations */
  trig?: { side: Side; fx: Fx };
  crisis?: boolean;
}

function doCoup(g: Game, s: Side, ops: number, i: number, roll: number): CoupRes {
  const st = V_(g).nodes[i].stab;
  const theirs = infOf(g, other(s)), mine = infOf(g, s);
  const ex = roll + ops - 2 * st;
  let removed = 0, added = 0;
  if (ex > 0) { removed = Math.min(ex, theirs[i]); theirs[i] -= removed; added = ex - removed; mine[i] += added; }
  g.tension++;
  if (g.tension >= MAXT) g.crisis = s;
  return { at: i, roll, ops, need: 2 * st - ops + 1, ok: ex > 0, removed, added };
}

/** Joue une action (la carte quitte la main) */
export function applyAction(g: Game, s: Side, a: Action): ActReport {
  const V = V_(g);
  const hand = s === 'p' ? g.hand : g.aiHand;
  const card = hand.find(c => c.uid === a.uid)!;
  hand.splice(hand.indexOf(card), 1);
  g.discard.push(card);
  const ops = opsOf(g, s, card);
  const m = MECH[card.id];
  const rep: ActReport = { side: s, card: card.id, k: a.k, ops, changed: [], text: '' };
  const nm = (i: number) => V.nodes[i].at;
  if (a.k === 'inf') {
    const inf = infOf(g, s);
    const counts = new Map<number, number>();
    for (const i of a.at) { inf[i]++; counts.set(i, (counts.get(i) ?? 0) + 1); }
    rep.changed = [...counts.keys()];
    rep.text = [...counts].map(([i, k]) => `+${k} ${nm(i)}`).join(', ') || 'aucun placement';
  } else if (a.k === 'coup') {
    const roll = a.roll ?? (process?.env?.['DICE'] ? 3 + (g.tension % 2) : 1 + Math.floor(rnd(g) * 6));
    const c = doCoup(g, s, ops, a.at, roll);
    rep.coup = c;
    rep.changed = [a.at];
    rep.crisis = g.crisis === s;
    rep.text = `${V.words.coup} ${nm(a.at)} : 🎲 ${roll} + ${ops} contre ${2 * V.nodes[a.at].stab} → `
      + (c.ok ? `réussi (−${c.removed} adverse${c.added ? `, +${c.added}` : ''})` : 'échec');
  } else if (a.k === 'event') {
    const fx = applyEvent(g, m.side === 'n' ? s : (m.side as Side), card.id, a.at);
    rep.changed = fx.changed;
    rep.text = fx.text;
  } else {
    g.classed[s] = true;
    rep.text = 'classée sans suite';
  }
  if ((a.k === 'inf' || a.k === 'coup') && m.side === other(s) && m.event && !g.crisis) {
    rep.trig = { side: other(s), fx: applyEvent(g, other(s), card.id) };
  }
  if (s === 'p') g.acted++;
  return rep;
}

/* ── L'adversaire (et les robots de test) ──────────────────── */

export interface Choice { a: Action; v: number; why?: string }

/** Toutes les options sensées d'un camp, évaluées (1 coup d'avance) */
export function options(g: Game, s: Side, noise = 0): Choice[] {
  const hand = s === 'p' ? g.hand : g.aiHand;
  const o = other(s);
  const out: Choice[] = [];
  const base = evaluate(g, s);
  const R = reach(g, s);
  for (const c of hand) {
    const m = MECH[c.id], ops = opsOf(g, s, c);
    const theirEvent = m.side === o && m.event;
    const trig = () => { if (theirEvent) applyEvent(g, o, c.id); };
    // Influence
    {
      const sn = save(g);
      const at = greedyPlace(g, s, ops, noise, R);
      trig();
      out.push({ a: { k: 'inf', uid: c.uid, at }, v: evaluate(g, s) });
      restore(g, sn);
    }
    // Coups (jamais au point de déclencher la crise)
    if (!crisisNext(g)) {
      for (const i of coupTargets(g, s, ops)) {
        let ev = 0;
        for (let d = 1; d <= 6; d++) {
          const sn = save(g);
          doCoup(g, s, ops, i, d);
          trig();
          ev += evaluate(g, s);
          restore(g, sn);
        }
        out.push({ a: { k: 'coup', uid: c.uid, at: i }, v: ev / 6 - 0.35 });
      }
    }
    // Événement
    if (canEvent(g, s, c)) {
      const ts = m.target === 'none' ? [undefined] : eventTargets(g, s, c.id);
      for (const t of ts) {
        const sn = save(g);
        applyEvent(g, m.side === 'n' ? s : s, c.id, t);
        out.push({ a: { k: 'event', uid: c.uid, at: t }, v: evaluate(g, s) });
        restore(g, sn);
      }
    }
    // Classer une carte adverse
    if (!g.classed[s]) out.push({ a: { k: 'class', uid: c.uid }, v: base - 0.5 - 0.15 * ops });
  }
  return out;
}

/** Choix d'action : la meilleure option, brouillée selon l'imprécision */
const TOPK = Number(process?.env?.['TOPK'] ?? 6);
export function choose(g: Game, s: Side, noise: number): Action {
  const hand = s === 'p' ? g.hand : g.aiHand;
  const side = (uid: number) => MECH[hand.find(c => c.uid === uid)!.id].side;
  // Les options crédibles seulement : on ne classe que les cartes adverses, et l'on hésite entre les meilleures
  let opts = options(g, s, 0).filter(c => c.a.k !== 'class' || side(c.a.uid) === other(s)).sort((a, b) => b.v - a.v);
  if (!opts.length) opts = options(g, s, 0);
  opts = opts.slice(0, TOPK);
  let best = opts[0], bv = -Infinity;
  for (const c of opts) {
    const v = c.v + (noise ? gauss(g) * noise : 0);
    if (v > bv) { bv = v; best = c; }
  }
  return best.a;
}

export function aiAction(g: Game): Action { return choose(g, 'r', g.aiNoise); }

import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
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
  inf: string; country: string; countries: string; stab: string; coup: string; coups: string; coupShort: string; tension: string; crisis: string;
}
export interface RivalText { name: string; the: string; The: string; of: string; emblem: string; pron: 'elle' | 'il' }
interface VariantData {
  cols: number; rows: number; zones: ZoneDef[]; nodes: NodeDef[];
  extra: [string, string][]; cut: [string, string][];
  start: { p: Record<string, number>; r: Record<string, number> };
  rival: RivalText; words: Words; brief: string;
  cards: Partial<Record<CardId, [string, string]>>;
}
export interface VariantDef extends Omit<VariantData, 'nodes'> { id: Variant; nodes: MapNode[]; links: [number, number][] }

const WORLD_WORDS: Words = {
  inf: 'influence', country: 'pays', countries: 'pays', stab: 'stabilité', coup: 'coup diplomatique', coups: 'coups diplomatiques', coupShort: 'Coup', tension: 'tension', crisis: 'crise internationale',
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
    start: { p: { MER: 2, MAG: 2, CAR: 1, PAC: 1, AOU: 1 }, r: { VAL: 1, ACE: 2, ZAM: 1, LEV: 1, SUB: 1 } },
    rival: { name: 'Karstanie', the: 'la Karstanie', The: 'La Karstanie', of: 'de la Karstanie', emblem: '🦅', pron: 'elle' },
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
    rival: { name: 'Kantor', the: 'le Kantor', The: 'Le Kantor', of: 'du Kantor', emblem: '🐆', pron: 'il' },
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
    rival: { name: 'Coalition', the: 'la coalition des capitales', The: 'La coalition des capitales', of: 'de la coalition', emblem: '🏛️', pron: 'elle' },
    words: {
      inf: 'influence', country: 'siège', countries: 'sièges', stab: 'fermeté', coup: 'retournement', coups: 'retournements', coupShort: 'Retourner', tension: 'blocage', crisis: 'crise institutionnelle',
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
    case 'propagande': return `Pour ${R.the} : +1 ${w.inf} dans 3 ${w.countries} où ${R.pron} est ${R.pron === 'il' ? 'présent' : 'présente'}.`;
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
    aiNoise: clamp(3.5 * 3 ** ((1 - diff) / 0.2), 0.3, 8),
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

export function opsOf(g: Game, s: Side, c: Card): number { return MECH[c.id].ops; }

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
const K_SCORE = 22;
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
/** Restauration en place (les tableaux gardent leur identité : les fonctions appelantes en tiennent des références) */
const restore = (g: Game, s: Snap) => {
  for (let i = 0; i < s.p.length; i++) { g.p[i] = s.p[i]; g.r[i] = s.r[i]; g.shield[i] = s.shield[i]; }
  g.tension = s.tension; g.vpP = s.vpP; g.vpR = s.vpR; g.seed = s.seed; g.crisis = s.crisis;
};

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
    const roll = a.roll ?? 1 + Math.floor(rnd(g) * 6);
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
        applyEvent(g, s, c.id, t);
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
export function choose(g: Game, s: Side, noise: number): Action {
  const hand = s === 'p' ? g.hand : g.aiHand;
  const side = (uid: number) => MECH[hand.find(c => c.uid === uid)!.id].side;
  // Les options crédibles seulement : on ne classe que les cartes adverses, et l'on hésite entre les meilleures
  let opts = options(g, s, 0).filter(c => c.a.k !== 'class' || side(c.a.uid) === other(s)).sort((a, b) => b.v - a.v);
  if (!opts.length) opts = options(g, s, 0);
  opts = opts.slice(0, g.diff < 0.95 && s === 'r' ? 8 : 6);
  let best = opts[0], bv = -Infinity;
  for (const c of opts) {
    const v = c.v + (noise ? gauss(g) * noise : 0);
    if (v > bv) { bv = v; best = c; }
  }
  return best.a;
}

/** L'adversaire ; en difficulté élevée, il anticipe votre meilleure réponse */
export function aiAction(g: Game): Action {
  if (g.diff < 1.25) return choose(g, 'r', g.aiNoise);
  return lookahead(g, 'r', 5, g.aiNoise * 0.5);
}

const cloneGame = (g: Game): Game => ({
  ...g, p: [...g.p], r: [...g.r], shield: [...g.shield], deck: [...g.deck], discard: [...g.discard], hand: [...g.hand], aiHand: [...g.aiHand],
  sched: g.sched.map(x => ({ ...x })), classed: { ...g.classed }, urg: [...g.urg],
});

/** Deux coups d'avance : chaque option est jugée après la meilleure réponse adverse */
export function lookahead(g: Game, s: Side, width: number, noise = 0): Action {
  const hand = s === 'p' ? g.hand : g.aiHand;
  const side = (uid: number) => MECH[hand.find(c => c.uid === uid)!.id].side;
  const opts = options(g, s, 0).filter(c => c.a.k !== 'class' || side(c.a.uid) === other(s)).sort((a, b) => b.v - a.v).slice(0, width);
  if (!opts.length) return choose(g, s, 0);
  const o = other(s);
  let best = opts[0].a, bv = -Infinity;
  for (const c of opts) {
    const K = c.a.k === 'coup' ? 3 : 1;
    let tot = 0;
    for (let k = 0; k < K; k++) {
      const h = cloneGame(g);
      h.seed = (g.seed + 7919 * (k + 1)) | 0;
      applyAction(h, s, c.a.k === 'coup' ? { ...c.a, roll: [2, 4, 6][k] } : c.a);
      if (h.crisis === s) { tot -= 100; continue; }
      const replies = o === 'p' ? h.acted < ROUNDS && h.hand.length : h.aiHand.length;
      if (replies) applyAction(h, o, choose(h, o, 0));
      tot += evaluate(h, s);
    }
    const v = tot / K + (noise ? gauss(g) * noise : 0);
    if (v > bv) { bv = v; best = c.a; }
  }
  return best;
}

/** Une ligne d'analyse du coup adverse (son intention apparente) */
export function intentOf(g: Game, rep: ActReport): string {
  const V = V_(g);
  const P = V.rival.pron === 'il' ? 'Il' : 'Elle';
  if (rep.k === 'class') return `${P} enterre une carte qui vous aurait profité.`;
  const main = rep.coup?.at ?? rep.changed[0];
  if (main === undefined) return rep.card === 'sommet' ? `${P} cherche l’apaisement.` : '';
  const n = V.nodes[main];
  const z = V.zones[n.zi];
  const next = g.sched.find(s => !s.res && s.turn >= g.turn && s.zones.length === 1 && s.zones[0] === n.zi);
  const before = next ? ` avant le bilan ${z.name} (tour ${next.turn})` : '';
  if (rep.k === 'coup') return rep.coup?.ok ? `${P} frappe là où vous étiez fragile${before}.` : `Coup manqué : ${V.rival.pron} a pris un risque.`;
  if (controller(g, main) === 'r' && n.pivot) return `${P} tient un pivot de la zone ${z.name}${before}.`;
  if (next) return `${P} prépare le bilan ${z.name} (tour ${next.turn}).`;
  return `${P} avance ses pions en zone ${z.name}.`;
}

/* ── Composant ─────────────────────────────────────────────── */

type Phase = 'brief' | 'play' | 'ai' | 'turn' | 'final' | 'over';
type Mode = 'inf' | 'coup' | 'event' | null;
interface NodeView {
  i: number; left: number; top: number; w: number; h: number; name: string; stab: number; pivot: boolean;
  p: number; r: number; ctrl: Side | null; anchor: string; pend: number; can: boolean; cost2: boolean; odds: string; evt: boolean; dim: boolean;
  flash: string; shield: string; label: string; focus: boolean; pick: boolean;
}
interface CardView { uid: number; id: CardId; icon: string; name: string; ops: number; side: Side | 'n'; owner: string; on: boolean; long: boolean }

const LEVELS = ['rien', 'présence', 'domination', 'contrôle'];
const SIDE_CLASS: Record<Side, string> = { p: 'c-p', r: 'c-r' };

@Component({
  selector: 'app-echiquier-game',
  template: `
    @if (game(); as g) {
    <div class="eq">
      <div class="head">
        <span>Tour <b class="mono">{{ g.turn }}</b>/{{ turns }}@if (phase() === 'play' || phase() === 'ai') { <span class="muted"> · action {{ Math.min(g.acted + 1, rounds) }}/{{ rounds }}</span> }</span>
        <span class="vp" [attr.aria-label]="'Points de victoire : France ' + g.vpP + ', ' + V.rival.name + ' ' + g.vpR">
          <span class="fr">🇫🇷 <b class="mono">{{ g.vpP }}</b></span> PV <span class="rv"><b class="mono">{{ g.vpR }}</b> {{ V.rival.emblem }}</span>
        </span>
      </div>

      <div class="tension" role="img" [attr.aria-label]="cap(V.words.tension) + ' : ' + g.tension + ' sur ' + maxT + (g.tension + 1 >= maxT ? ', le prochain ' + V.words.coup + ' déclenche la crise' : '')">
        <span class="tl">{{ cap(V.words.tension) }}</span>
        @for (k of tcells; track k) {
          <i class="tc" [class.on]="k <= g.tension && k > 0" [class.hot]="k >= 3" [class.boom]="k === maxT">{{ k === maxT ? '💥' : k }}</i>
        }
        <span class="tnote">{{ tensionNote() }}</span>
      </div>

      <ol class="sched" aria-label="Calendrier des bilans">
        @for (s of schedView(); track s.turn) {
          <li [class.now]="s.now" [class.done]="s.done" [class.won]="s.res === 'p'" [class.lost]="s.res === 'r'" [attr.aria-label]="s.aria">
            <b>T{{ s.turn }}</b> {{ s.icon }}<span class="sn">{{ s.label }}</span>@if (s.score) { <span class="mono sc">{{ s.score }}</span> }
          </li>
        }
      </ol>

      <div class="map" [style.aspect-ratio]="V.cols + ' / ' + (V.rows * 0.82)" role="group" [attr.aria-label]="'Carte : ' + V.nodes.length + ' ' + V.words.countries">
        <svg class="under" [attr.viewBox]="'0 0 ' + V.cols + ' ' + V.rows" preserveAspectRatio="none" aria-hidden="true">
          @for (n of V.nodes; track n.i) { <rect [attr.x]="n.c" [attr.y]="n.r" width="1" height="1" [attr.fill]="V.zones[n.zi].tint" class="zb" /> }
          @for (l of V.links; track $index) {
            <line [attr.x1]="V.nodes[l[0]].c + 0.5" [attr.y1]="V.nodes[l[0]].r + 0.5" [attr.x2]="V.nodes[l[1]].c + 0.5" [attr.y2]="V.nodes[l[1]].r + 0.5" class="ln" vector-effect="non-scaling-stroke" />
          }
        </svg>
        @for (n of nodes(); track n.i) {
          <button type="button" class="node" [class]="'node ' + (n.ctrl ? sideClass[n.ctrl] : '') + ' ' + n.flash" [class.can]="n.can" [class.tgt]="!!n.odds" [class.evt]="n.evt" [class.dim]="n.dim" [class.focus]="n.focus" [class.pick]="n.pick"
                  [style.left.%]="n.left" [style.top.%]="n.top" [style.width.%]="n.w" [style.height.%]="n.h" [disabled]="phase() === 'over'"
                  (click)="tapNode(n.i)" [attr.aria-label]="n.label">
            <span class="nm">{{ n.name }}</span>
            <span class="infs"><span class="ip" [class.zero]="!n.p">{{ n.p }}</span><span class="st" aria-hidden="true">{{ n.stab }}</span><span class="ir" [class.zero]="!n.r">{{ n.r }}</span></span>
            @if (n.pivot) { <span class="pv" aria-hidden="true">★</span> }
            @if (n.anchor) { <span class="anc" aria-hidden="true">{{ n.anchor }}</span> }
            @if (n.shield) { <span class="shd" aria-hidden="true">{{ n.shield }}</span> }
            @if (n.pend) { <span class="badge add mono">+{{ n.pend }}</span> }
            @else if (n.odds) { <span class="badge odd mono">{{ n.odds }}</span> }
            @else if (n.cost2) { <span class="badge two">×2</span> }
          </button>
        }
      </div>
      <div class="zones" role="toolbar" aria-label="Zones">
        @for (z of V.zones; track z.id; let zi = $index) {
          <button type="button" class="zchip" [class.on]="zoneFocus() === zi" (click)="tapZone(zi)" [style.border-color]="z.tint"
                  [attr.aria-label]="'Zone ' + z.name + ' : ' + zoneLine(zi)">{{ z.icon }} {{ z.name }}</button>
        }
      </div>

      @switch (phase()) {
        @case ('brief') {
          <div class="panel brief">
            <p><b>{{ def().title }}.</b> {{ V.brief }} <b>Objectif :</b> plus de points de victoire (PV) que {{ V.rival.the }} au bout de huit tours.</p>
            <ul>
              <li>Chaque tour, {{ hand }} cartes en main : vous en jouez {{ rounds }}, {{ V.rival.the }} répond après chacune.</li>
              <li><b>Opérations</b> : placez autant de points d’{{ V.words.inf }} dans les {{ V.words.countries }} où vous êtes présent, leurs voisins ou vos accès directs (🇫🇷) ; entrer chez un {{ V.words.country }} contrôlé par l’adversaire coûte 2.</li>
              <li><b>{{ cap(V.words.coup) }}</b> : dé + opérations contre 2 × {{ V.words.stab }} ; l’excédent retire l’{{ V.words.inf }} adverse. {{ cap(V.words.tension) }} +1.</li>
              <li><b>Événement</b> 🇫🇷 ou ⚪ : son effet, à la place des opérations. Une carte {{ V.rival.emblem }} jouée pour ses opérations déclenche l’événement adverse ; une fois par tour, vous pouvez la classer sans suite.</li>
              <li><b>Contrôle</b> : {{ V.words.inf }} ≥ {{ V.words.stab }} et avance ≥ {{ V.words.stab }} (couleur pleine).</li>
              <li><b>Bilans</b> aux tours annoncés : présence, domination (plus de {{ V.words.countries }} et de pivots ★), contrôle (plus de {{ V.words.countries }} et tous les pivots), +1 PV par pivot.</li>
              <li><b>{{ cap(V.words.tension) }}</b> : −1 à chaque tour. {{ closures() }} À {{ maxT }}, c’est la {{ V.words.crisis }} : partie perdue.</li>
            </ul>
            <button type="button" class="btn primary small" (click)="begin()">À la table ▸</button>
          </div>
        }
        @case ('turn') { <ng-container *ngTemplateOutlet="turnPanel" /> }
        @case ('final') { <ng-container *ngTemplateOutlet="turnPanel" /> }
        @case ('over') {
          <div class="panel over" aria-live="polite">
            <p class="verdict" [class.good]="won()" [class.bad]="!won()"><b>{{ verdict() }}</b></p>
            <p class="small">France <b class="mono">{{ g.vpP }}</b> PV — {{ V.rival.name }} <b class="mono">{{ g.vpR }}</b> PV</p>
          </div>
        }
        @default {
          @if (theirs(); as t) {
            <div class="panel foe" aria-live="polite">
              <p><b>{{ V.rival.emblem }} {{ V.rival.The }}</b> joue {{ cardIcon(t.card) }} « {{ cardName(t.card) }} »{{ howLabel(t) }} : {{ t.text }}.</p>
              @if (t.trig) { <p class="small good">⚡ Votre événement se déclenche : {{ t.trig.fx.text }}.</p> }
              @if (aiNote()) { <p class="small muted">{{ aiNote() }}</p> }
            </div>
          } @else if (phase() === 'ai') {
            <div class="panel foe"><p class="muted">{{ V.rival.emblem }} {{ V.rival.The }} réfléchit…</p></div>
          }
          @if (mine(); as m) {
            <p class="mine small" [class.bad]="m.coup && !m.coup.ok" aria-live="polite">Vous : {{ cardIcon(m.card) }} {{ m.text }}.@if (m.trig) { <span class="bad"> ⚡ {{ V.rival.The }} : {{ m.trig.fx.text }}.</span> }</p>
          }

          <div class="hand" role="toolbar" aria-label="Vos cartes">
            @for (c of cards(); track c.uid) {
              <button type="button" class="card" [class.on]="c.on" [class.foe]="c.side === 'r'" [class.neu]="c.side === 'n'" [disabled]="phase() !== 'play'"
                      (click)="pickCard(c.uid)" [attr.aria-pressed]="c.on" [attr.aria-label]="c.name + ', ' + c.ops + ' opérations, ' + c.owner">
                <span class="ops mono">{{ c.ops }}</span>
                <span class="ic">{{ c.icon }}</span>
                <span class="cn" [class.long]="c.long">{{ c.name }}</span>
                <span class="ow">{{ c.side === 'p' ? '🇫🇷' : c.side === 'r' ? V.rival.emblem : '⚪' }}</span>
              </button>
            }
          </div>

          <div class="panel act" aria-live="polite">
            @if (phase() === 'ai') {
              <p class="muted small">Au tour {{ V.rival.of }}…</p>
            } @else if (selCard(); as c) {
              @let m = mech(c.id);
              @switch (mode()) {
                @case ('inf') {
                  <p><b>Influence</b> : reste <b class="mono">{{ left() }}</b> point{{ left() > 1 ? 's' : '' }}. Touchez les {{ V.words.countries }} en pointillés (×2 : contrôlé par l’adversaire).</p>
                  <div class="row">
                    <button type="button" class="btn small" (click)="cancelMode()">✕</button>
                    <button type="button" class="btn small" [disabled]="!pend().at.length" (click)="undoPoint()">↶ Retirer</button>
                    <button type="button" class="btn primary small" [disabled]="!pend().at.length" (click)="validateInf()">Valider ▸</button>
                  </div>
                }
                @case ('coup') {
                  @if (coupAt() !== null) {
                    @let i = coupAt()!;
                    <p><b>{{ cap(V.words.coup) }} {{ V.nodes[i].at }}</b> : il faut {{ 2 * V.nodes[i].stab + 1 }} ou plus avec 🎲 + {{ opsSel() }} → <b class="mono">{{ pct(i) }}</b> de réussite.
                      {{ cap(V.words.tension) }} {{ g.tension }} → {{ g.tension + 1 }}.</p>
                    @if (g.tension + 1 >= maxT) { <p class="bad"><b>⚠️ Ce {{ V.words.coup }} déclenchera la {{ V.words.crisis }} : partie perdue.</b></p> }
                    <div class="row">
                      <button type="button" class="btn small" (click)="coupAt.set(null)">✕</button>
                      <button type="button" class="btn primary small" [class.danger]="g.tension + 1 >= maxT" (click)="confirmCoup()">Lancer le dé 🎲</button>
                    </div>
                  } @else {
                    <p>Touchez un {{ V.words.country }} cible (chances affichées en rouge). Il faut y trouver de l’{{ V.words.inf }} adverse.</p>
                    <div class="row"><button type="button" class="btn small" (click)="cancelMode()">✕ Retour</button></div>
                  }
                }
                @case ('event') {
                  <p>{{ cardDescOf(c.id) }} <b>Touchez {{ m.target === 'zone' ? 'un ' + V.words.country + ' de la zone visée' : 'le ' + V.words.country + ' visé' }}</b> (surligné).</p>
                  <div class="row"><button type="button" class="btn small" (click)="cancelMode()">✕ Retour</button></div>
                }
                @default {
                  <p><b>{{ cardIcon(c.id) }} {{ cardName(c.id) }}</b> · {{ opsSel() }} opération{{ opsSel() > 1 ? 's' : '' }}</p>
                  <p class="small">@if (m.event) { <b>{{ m.side === 'p' ? '🇫🇷' : m.side === 'r' ? V.rival.emblem : '⚪' }} Événement</b> : }{{ cardDescOf(c.id) }}</p>
                  @if (m.side === 'r') { <p class="small bad">Jouée pour ses opérations, elle déclenche cet événement pour {{ V.rival.the }}.</p> }
                  <div class="modes">
                    <button type="button" class="btn small" (click)="setMode('inf')">➕ Influence · {{ opsSel() }}</button>
                    <button type="button" class="btn small" [disabled]="!coupCount()" (click)="setMode('coup')"
                            [attr.aria-label]="cap(V.words.coup) + (coupCount() ? '' : ' : aucune cible')">🎲 {{ V.words.coupShort }}@if (!coupCount()) { <span class="muted"> (aucune cible)</span> }</button>
                    @if (m.event && m.side !== 'r') {
                      <button type="button" class="btn small" [disabled]="!eventOk()" (click)="setMode('event')">⚡ Événement</button>
                    }
                    @if (m.side === 'r') {
                      <button type="button" class="btn small" [disabled]="g.classed.p" (click)="classCard()">🗄️ Classer sans suite@if (g.classed.p) { <span class="muted"> (déjà fait)</span> }</button>
                    }
                  </div>
                }
              }
            } @else if (focusInfo(); as f) {
              <p><b>{{ f.title }}</b></p>
              <p class="small">{{ f.line }}</p>
              @if (f.more) { <p class="small muted">{{ f.more }}</p> }
            } @else {
              <p class="muted small">{{ hint() }}</p>
            }
          </div>
        }
      }

      <ul class="log" aria-label="Journal">@for (l of log(); track $index) { <li>{{ l }}</li> }</ul>

      <ng-template #turnPanel>
        <div class="panel turn" aria-live="polite">
          <p><b>{{ phase() === 'final' ? 'Bilan final' : 'Fin du tour ' + g.turn }}</b>@if (theirs(); as t) { <span class="small muted"> · dernier coup : {{ V.rival.emblem }} {{ cardName(t.card) }}, {{ t.text }}</span> }</p>
          @if (turnRep()?.length) {
            <table class="scores">
              <thead><tr><th scope="col">Zone</th><th scope="col">🇫🇷 France</th><th scope="col">{{ V.rival.emblem }} {{ V.rival.name }}</th></tr></thead>
              <tbody>
                @for (z of turnRep()!; track z.zone) {
                  <tr>
                    <th scope="row">{{ V.zones[z.zi].icon }} {{ V.zones[z.zi].name }}</th>
                    <td [class.good]="z.pts[0] > z.pts[1]">{{ lvl(z.lv[0]) }}@if (z.piv[0]) { +{{ z.piv[0] }}★ } <b class="mono">{{ z.pts[0] }}</b></td>
                    <td [class.bad]="z.pts[1] > z.pts[0]">{{ lvl(z.lv[1]) }}@if (z.piv[1]) { +{{ z.piv[1] }}★ } <b class="mono">{{ z.pts[1] }}</b></td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p class="small muted">Pas de bilan ce tour-ci. {{ nextLine() }}</p>
          }
          <p class="small">Total : France <b class="mono">{{ g.vpP }}</b> — {{ V.rival.name }} <b class="mono">{{ g.vpR }}</b> PV</p>
          <button type="button" class="btn primary small" (click)="phase() === 'final' ? showVerdict() : goNextTurn()">{{ phase() === 'final' ? 'Verdict ▸' : 'Tour ' + (g.turn + 1) + ' ▸' }}</button>
        </div>
      </ng-template>
    </div>
    }
  `,
  imports: [NgTemplateOutlet],
  styles: `
    :host { display: block; width: 100%; --fr: #2f6fb3; --fr-d: #1d4f86; --rv: #c0392b; --rv-d: #8e2a20; }
    .eq { display: grid; gap: 7px; min-width: 0; }
    .head { display: flex; flex-wrap: wrap; gap: 4px 10px; justify-content: space-between; align-items: center; font-size: 12.5px; }
    .vp { display: inline-flex; gap: 5px; align-items: center; .fr b { color: var(--fr); } .rv b { color: var(--rv); } }
    .muted { color: var(--ink-3); } .small { font-size: 12px; } .good { color: var(--good); } .bad { color: var(--bad); }
    .tension { display: flex; flex-wrap: wrap; align-items: center; gap: 3px; font-size: 11.5px;
      .tl { font-weight: 700; margin-right: 2px; }
      .tc { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 5px; background: var(--surface-2); border: 1px solid var(--line); font-style: normal; font-size: 10.5px; color: var(--ink-3);
        &.on { background: #e9b949; color: #3b2a00; border-color: #c99a2e; } &.on.hot { background: #e2763c; color: #fff; border-color: #b85a28; } &.boom { font-size: 11px; } }
      .tnote { flex: 1 1 140px; color: var(--ink-2); font-size: 11px; margin-left: 4px; } }
    .sched { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px;
      li { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 3px; padding: 2px 6px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--line); font-size: 11px; white-space: nowrap;
        &.now { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); } &.done { opacity: .65; }
        &.won .sc { color: var(--good); } &.lost .sc { color: var(--bad); } .sc { font-weight: 700; } } }
    .map { position: relative; width: 100%; max-width: 460px; justify-self: center; margin-top: 4px; user-select: none; }
    .under { position: absolute; inset: 0; width: 100%; height: 100%; .zb { opacity: .2; } .ln { stroke: var(--ink-3); stroke-width: 2; stroke-dasharray: 3 2; opacity: .8; } }
    .node { position: absolute; display: grid; align-content: space-between; gap: 1px; padding: 3px 3px 2px; border-radius: 9px; border: 1.5px solid var(--line); background: var(--surface); color: var(--ink);
      font: inherit; text-align: center; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,.15); transition: background .4s ease, opacity .2s ease, transform .15s ease; min-width: 0;
      &.c-p { background: var(--fr); border-color: var(--fr-d); color: #fff; } &.c-r { background: var(--rv); border-color: var(--rv-d); color: #fff; }
      &.can { outline: 2px dashed var(--fr); outline-offset: 1px; } &.tgt { outline: 2px solid var(--rv); outline-offset: 1px; } &.evt { outline: 2px solid #e0a800; outline-offset: 1px; }
      &.dim::after { content: ''; position: absolute; inset: -2px; border-radius: inherit; background: var(--surface); opacity: .6; pointer-events: none; } &.focus, &.pick { box-shadow: 0 0 0 3px #f4d35e; } &.pick { outline-width: 3px; }
      &.fl-p { animation: flP 1.4s ease 1; } &.fl-r { animation: flR 1.4s ease 1; }
      &:disabled { cursor: default; } }
    .nm { font-size: clamp(8.5px, 2.5vw, 11px); font-weight: 700; line-height: 1.1; letter-spacing: -.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 1px; }
    .infs { display: flex; justify-content: space-between; align-items: center; gap: 2px; }
    .ip, .ir { min-width: 15px; padding: 0 2px; border-radius: 6px; font-weight: 800; font-size: clamp(11px, 3.2vw, 13px); line-height: 1.35; }
    .ip { background: #dce8f6; color: var(--fr-d); } .ir { background: #f8dedb; color: var(--rv-d); } .zero { opacity: .35; }
    .st { width: 15px; height: 15px; flex: 0 0 auto; border-radius: 50%; border: 1.5px solid currentColor; font-size: 9px; font-weight: 800; display: grid; place-items: center; opacity: .8; }
    .pv { position: absolute; top: -8px; left: -5px; color: #e0a800; font-size: 14px; line-height: 1; text-shadow: 0 0 2px rgba(0,0,0,.7); }
    .anc { position: absolute; bottom: -7px; left: 50%; transform: translateX(-50%); font-size: 10px; line-height: 1; }
    .shd { position: absolute; bottom: -7px; right: -3px; font-size: 10px; line-height: 1; }
    .badge { position: absolute; z-index: 2; top: -9px; right: -5px; padding: 0 4px; border-radius: 7px; font-size: 10px; font-weight: 700; line-height: 1.5; color: #fff;
      &.add { background: #1f8a4c; } &.odd { background: var(--rv); } &.two { background: var(--ink-2); } }
    @keyframes flP { 40% { transform: scale(1.08); box-shadow: 0 0 0 4px #7fb2ea; } }
    @keyframes flR { 40% { transform: scale(1.08); box-shadow: 0 0 0 4px #f08f80; } }
    .zones { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
    .zchip { min-height: 32px; padding: 3px 8px; border-radius: 16px; border: 2px solid; background: var(--surface); color: var(--ink); font: inherit; font-size: 11.5px; cursor: pointer;
      &.on { background: var(--surface-2); font-weight: 700; } }
    .panel { display: grid; gap: 5px; padding: 8px 10px; border-radius: 10px; background: var(--surface-2); font-size: 13px; min-width: 0; p { margin: 0; } ul { margin: 0; padding-left: 18px; } }
    .brief li { font-size: 12.3px; color: var(--ink-2); margin: 3px 0; }
    .foe { border-left: 4px solid var(--rv); font-size: 12.5px; }
    .mine { margin: 0; padding: 0 4px; color: var(--ink-2); }
    .hand { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; }
    .card { position: relative; display: grid; justify-items: center; align-content: start; gap: 1px; min-height: 74px; padding: 6px 3px 4px; border-radius: 9px; border: 1.5px solid var(--fr); background: var(--surface);
      color: var(--ink); font: inherit; cursor: pointer; min-width: 0;
      &.foe { border-color: var(--rv); } &.neu { border-color: var(--line); }
      &.on { outline: 3px solid var(--accent); outline-offset: 1px; background: var(--surface-2); }
      &:disabled { opacity: .55; cursor: default; }
      .ops { position: absolute; top: 3px; left: 4px; font-size: 13px; font-weight: 800; color: var(--ink-2); }
      .ic { font-size: 19px; line-height: 1.1; } .cn { font-size: 10.3px; font-weight: 600; line-height: 1.12; text-align: center; overflow-wrap: anywhere; &.long { font-size: 9px; letter-spacing: -.02em; } }
      .ow { position: absolute; top: 2px; right: 4px; font-size: 10px; } }
    .act { min-height: 52px; }
    .row, .modes { display: flex; flex-wrap: wrap; gap: 6px; .btn { min-height: 36px; } }
    .row { justify-content: flex-end; }
    .btn.danger { background: var(--bad); border-color: var(--bad); }
    .scores { width: 100%; border-collapse: collapse; font-size: 12px;
      th, td { padding: 3px 4px; text-align: left; border-bottom: 1px solid var(--line); } thead th { font-size: 11px; color: var(--ink-2); font-weight: 600; } td b { margin-left: 3px; } }
    .verdict { font-size: 14px; }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 76px; overflow: auto; font-size: 11px; color: var(--ink-2); }
    @media (prefers-reduced-motion: reduce) { .node { transition: none; &.fl-p, &.fl-r { animation: none; } } }
  `,
})
export class EchiquierGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly Math = Math;
  protected readonly turns = TURNS;
  protected readonly rounds = ROUNDS;
  protected readonly hand = HAND;
  protected readonly maxT = MAXT;
  protected readonly tcells = Array.from({ length: MAXT + 1 }, (_, k) => k);
  protected readonly sideClass = SIDE_CLASS;
  protected V: VariantDef = VARIANTS.monde;

  protected readonly game = signal<Game | null>(null, { equal: () => false });
  protected readonly phase = signal<Phase>('brief');
  protected readonly sel = signal<number | null>(null);
  protected readonly mode = signal<Mode>(null);
  protected readonly pend = signal<{ at: number[]; cost: number[] }>({ at: [], cost: [] });
  private reachSet = new Set<number>();
  protected readonly coupAt = signal<number | null>(null);
  protected readonly focus = signal<number | null>(null);
  protected readonly zoneFocus = signal<number | null>(null);
  protected readonly mine = signal<ActReport | null>(null);
  protected readonly theirs = signal<ActReport | null>(null);
  protected readonly aiNote = signal('');
  protected readonly turnRep = signal<ZoneScore[] | null>(null);
  protected readonly flash = signal<Map<number, Side>>(new Map());
  protected readonly log = signal<string[]>([]);
  protected readonly verdict = signal('');
  protected readonly won = signal(false);
  private timers: ReturnType<typeof setTimeout>[] = [];
  private reduced = false;
  private finished = false;

  protected readonly selCard = computed(() => {
    const g = this.game(), u = this.sel();
    return g && u !== null ? g.hand.find(c => c.uid === u) ?? null : null;
  });
  protected readonly opsSel = computed(() => { const c = this.selCard(), g = this.game(); return c && g ? opsOf(g, 'p', c) : 0; });
  protected readonly left = computed(() => this.opsSel() - this.pend().cost.reduce((a, b) => a + b, 0));
  protected readonly coupCount = computed(() => { const g = this.game(), c = this.selCard(); return g && c ? coupTargets(g, 'p', opsOf(g, 'p', c)).length : 0; });
  protected readonly eventOk = computed(() => { const g = this.game(), c = this.selCard(); return !!g && !!c && canEvent(g, 'p', c); });
  private readonly evTargets = computed(() => {
    const g = this.game(), c = this.selCard();
    if (!g || !c || this.mode() !== 'event') return new Set<number>();
    const ts = eventTargets(g, 'p', c.id);
    return MECH[c.id].target === 'zone' ? new Set(this.V.nodes.filter(n => ts.includes(n.zi)).map(n => n.i)) : new Set(ts);
  });

  protected readonly nodes = computed<NodeView[]>(() => {
    const g = this.game();
    if (!g) return [];
    const V = this.V, mode = this.phase() === 'play' ? this.mode() : null, pend = this.pend(), fl = this.flash(), c = this.selCard();
    const counts = new Map<number, number>();
    for (const i of pend.at) counts.set(i, (counts.get(i) ?? 0) + 1);
    const ops = c ? opsOf(g, 'p', c) : 0;
    const coup = mode === 'coup' ? new Set(coupTargets(g, 'p', ops)) : null;
    const ev = this.evTargets();
    const left = this.left();
    const cw = 100 / V.cols, ch = 100 / V.rows;
    return V.nodes.map(n => {
      const p = g.p[n.i] + (counts.get(n.i) ?? 0), r = g.r[n.i];
      const ctrl = p >= n.stab + r ? 'p' : r >= n.stab + p ? 'r' : null;
      const inReach = mode === 'inf' && this.reachSet.has(n.i);
      const cost = inReach ? (ctrl === 'r' ? 2 : 1) : 0;
      const can = inReach && cost <= left;
      const odds = coup?.has(n.i) ? Math.round(coupChance(g, ops, n.i) * 100) + ' %' : '';
      const evt = mode === 'event' && ev.has(n.i);
      const dim = (mode === 'inf' && !can && !counts.get(n.i)) || (mode === 'coup' && !odds) || (mode === 'event' && !evt);
      const zone = V.zones[n.zi].name;
      let label = `${n.name}, ${zone}${n.pivot ? ', pivot' : ''}, ${V.words.stab} ${n.stab}, France ${p}, ${V.rival.name} ${r}`
        + (ctrl === 'p' ? ', contrôlé par la France' : ctrl === 'r' ? `, contrôlé par ${V.rival.the}` : '')
        + (n.anchor === 'p' ? ', accès direct français' : n.anchor === 'r' ? `, accès direct ${V.rival.of}` : '')
        + (g.shield[n.i] ? `, protégé (${g.shield[n.i] === 'p' ? 'France' : V.rival.name})` : '');
      if (can) label += `, placer ici coûte ${cost}`;
      if (counts.get(n.i)) label += `, ${counts.get(n.i)} prévu${counts.get(n.i)! > 1 ? 's' : ''}`;
      if (odds) label += `, ${V.words.coup} : ${odds} de réussite`;
      if (evt) label += ', cible possible';
      return {
        i: n.i, left: (n.c + 0.05) * cw, top: (n.r + 0.08) * ch, w: 0.9 * cw, h: 0.84 * ch, name: n.short, stab: n.stab, pivot: !!n.pivot, p, r, ctrl,
        anchor: n.anchor === 'p' ? '🇫🇷' : n.anchor === 'r' ? V.rival.emblem : '', pend: counts.get(n.i) ?? 0, can, cost2: can && cost === 2, odds, evt, dim,
        flash: fl.has(n.i) && !this.reduced ? 'fl-' + fl.get(n.i) : '', shield: g.shield[n.i] ? '🛡️' : '', label, focus: this.focus() === n.i, pick: this.coupAt() === n.i,
      };
    });
  });

  protected readonly cards = computed<CardView[]>(() => {
    const g = this.game();
    if (!g) return [];
    return g.hand.map(c => {
      const t = cardText(c.id, this.V.id), m = MECH[c.id];
      return {
        uid: c.uid, id: c.id, icon: t.icon, name: t.name, ops: opsOf(g, 'p', c), side: m.side, on: this.sel() === c.uid, long: t.name.split(/[\s’']/).some(w => w.length > 11),
        owner: !m.event ? 'sans événement' : m.side === 'p' ? 'événement français' : m.side === 'r' ? `événement ${this.V.rival.of}` : 'événement neutre',
      };
    });
  });

  protected readonly schedView = computed(() => {
    const g = this.game();
    if (!g) return [];
    return g.sched.map(s => {
      const all = s.zones.length > 1;
      const z = this.V.zones[s.zones[0]];
      let score = '', res: Side | '' = '';
      if (s.res) {
        const a = s.res.reduce((t, x) => t + x.pts[0], 0), b = s.res.reduce((t, x) => t + x.pts[1], 0);
        score = `${a}–${b}`; res = a > b ? 'p' : b > a ? 'r' : '';
      }
      return {
        turn: s.turn, icon: all ? '🌐' : z.icon, label: all ? 'Bilan final' : z.name, now: s.turn === g.turn && !s.res, done: !!s.res, res, score,
        aria: `Tour ${s.turn} : ${all ? 'bilan de toutes les zones' : 'bilan ' + z.name}${score ? ', résultat ' + score : ''}`,
      };
    });
  });

  protected readonly focusInfo = computed(() => {
    const g = this.game(), V = this.V;
    if (!g) return null;
    const zf = this.zoneFocus();
    if (zf !== null) {
      const z = V.zones[zf];
      return { title: `${z.icon} ${z.name}`, line: this.zoneLine(zf), more: `Présence ${z.vals[0]}, domination ${z.vals[1]}, contrôle ${z.vals[2]} PV, +1 par pivot ★.` + (z.close !== undefined ? ` ${cap(V.words.coups)} interdits dès ${V.words.tension} ${z.close}.` : '') };
    }
    const f = this.focus();
    if (f === null) return null;
    const n = V.nodes[f], c = controller(g, f);
    return {
      title: `${n.pivot ? '★ ' : ''}${n.name} · ${V.zones[n.zi].name}`,
      line: `${cap(V.words.stab)} ${n.stab} · France ${g.p[f]} / ${V.rival.name} ${g.r[f]} · ${c === 'p' ? 'contrôlé par la France' : c === 'r' ? `contrôlé par ${V.rival.the}` : 'disputé'}`
        + (g.shield[f] ? ` · protégé (${g.shield[f] === 'p' ? 'France' : V.rival.name})` : ''),
      more: `Voisins : ${n.nb.map(b => V.nodes[b].name).join(', ') || 'aucun'}.` + (n.anchor ? ` Accès direct ${n.anchor === 'p' ? 'français' : V.rival.of}.` : ''),
    };
  });

  ngOnInit(): void {
    this.V = VARIANTS[variantOf(this.def().id)];
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.game.set(newGame(this.V.id, this.diff(), Math.floor(Math.random() * 2 ** 31)));
  }

  ngOnDestroy(): void { this.timers.forEach(t => clearTimeout(t)); }

  /* ── Libellés ── */

  protected cap(t: string): string { return t.charAt(0).toUpperCase() + t.slice(1); }
  protected mech(id: CardId): CardMech { return MECH[id]; }
  protected cardIcon(id: CardId): string { return cardText(id, this.V.id).icon; }
  protected cardName(id: CardId): string { return cardText(id, this.V.id).name; }
  protected cardDescOf(id: CardId): string { return cardDesc(id, this.V.id); }
  protected lvl(k: number): string { return LEVELS[k]; }
  protected pct(i: number): string { const g = this.game()!; return Math.round(coupChance(g, this.opsSel(), i) * 100) + ' %'; }
  protected howLabel(t: ActReport): string {
    return t.k === 'inf' ? ` (${t.ops} opérations)` : t.k === 'coup' ? '' : t.k === 'event' ? ' pour son événement' : '';
  }
  protected zoneLine(zi: number): string {
    const g = this.game()!;
    const s = zoneScore(g, zi);
    const next = g.sched.find(x => !x.res && x.zones.includes(zi));
    return `en l’état : France ${LEVELS[s.lv[0]]} (${s.pts[0]} PV), ${this.V.rival.name} ${LEVELS[s.lv[1]]} (${s.pts[1]} PV)` + (next ? ` · bilan au tour ${next.turn}` : '');
  }
  protected closures(): string {
    const V = this.V;
    const by = new Map<number, string[]>();
    for (const z of V.zones) if (z.close !== undefined) by.set(z.close, [...(by.get(z.close) ?? []), z.name]);
    return [...by].sort((a, b) => a[0] - b[0]).map(([k, zs]) => `Dès ${k}, plus de ${V.words.coups} en ${zs.join(', ')}.`).join(' ');
  }
  protected tensionNote(): string {
    const g = this.game()!, V = this.V;
    if (g.tension + 1 >= MAXT) return `⚠️ Un ${V.words.coup} de plus : ${V.words.crisis}.`;
    const shut = V.zones.filter((_, zi) => zoneClosed(g, zi)).map(z => z.name);
    return shut.length ? `${cap(V.words.coups)} interdits : ${shut.join(', ')}.` : `${cap(V.words.coups)} possibles partout.`;
  }
  protected nextLine(): string {
    const g = this.game()!;
    const n = g.sched.find(s => !s.res && s.turn > g.turn);
    if (!n) return '';
    return n.zones.length > 1 ? `Prochain : bilan final au tour ${n.turn}.` : `Prochain : bilan ${this.V.zones[n.zones[0]].name} au tour ${n.turn}.`;
  }
  protected hint(): string {
    const g = this.game()!;
    const n = g.sched.find(s => !s.res && s.turn >= g.turn);
    const nx = n ? (n.zones.length > 1 ? `Bilan final au tour ${n.turn}.` : `Prochain bilan : ${this.V.zones[n.zones[0]].name}, fin du tour ${n.turn} — ${this.zoneLine(n.zones[0]).replace(/ · bilan.*$/, '')}.`) : '';
    return `Choisissez une carte. ${nx}`;
  }

  /* ── Jeu ── */

  protected begin(): void {
    this.phase.set('play');
    this.say(`Tour 1 : ${this.nextLine() || ''}`.trim());
    this.emitProgress();
  }

  protected pickCard(uid: number): void {
    if (this.phase() !== 'play') return;
    this.resetSel();
    this.sel.set(this.sel() === uid ? null : uid);
    this.focus.set(null); this.zoneFocus.set(null);
  }
  private resetSel(keepCard = false): void {
    if (!keepCard) this.sel.set(null);
    this.mode.set(null);
    this.pend.set({ at: [], cost: [] });
    this.coupAt.set(null);
  }
  protected cancelMode(): void { this.resetSel(true); }

  protected setMode(m: Mode): void {
    const g = this.game()!, c = this.selCard();
    if (!c || this.phase() !== 'play') return;
    this.mode.set(m);
    this.pend.set({ at: [], cost: [] });
    this.coupAt.set(null);
    if (m === 'inf') this.reachSet = reach(g, 'p');
    if (m === 'event' && MECH[c.id].target === 'none') this.act({ k: 'event', uid: c.uid });
  }

  protected tapZone(zi: number): void {
    this.focus.set(null);
    this.zoneFocus.set(this.zoneFocus() === zi ? null : zi);
  }

  protected tapNode(i: number): void {
    const g = this.game()!, c = this.selCard(), mode = this.mode();
    if (this.phase() === 'play' && c && mode) {
      if (mode === 'inf') {
        if (!this.reachSet.has(i)) return;
        // Coût au moment du placement (l'adversaire peut perdre le contrôle en route)
        const pend = this.pend();
        const p = g.p[i] + pend.at.filter(x => x === i).length;
        const cost = g.r[i] >= this.V.nodes[i].stab + p ? 2 : 1;
        if (cost > this.left()) return;
        this.pend.set({ at: [...pend.at, i], cost: [...pend.cost, cost] });
        return;
      }
      if (mode === 'coup') { if (coupTargets(g, 'p', opsOf(g, 'p', c)).includes(i)) this.coupAt.set(i); return; }
      if (mode === 'event') {
        if (!this.evTargets().has(i)) return;
        this.act({ k: 'event', uid: c.uid, at: MECH[c.id].target === 'zone' ? this.V.nodes[i].zi : i });
        return;
      }
    }
    this.zoneFocus.set(null);
    this.focus.set(this.focus() === i ? null : i);
  }

  protected undoPoint(): void {
    const p = this.pend();
    this.pend.set({ at: p.at.slice(0, -1), cost: p.cost.slice(0, -1) });
  }
  protected validateInf(): void {
    const c = this.selCard();
    if (!c || !this.pend().at.length) return;
    this.act({ k: 'inf', uid: c.uid, at: this.pend().at });
  }
  protected confirmCoup(): void {
    const c = this.selCard(), i = this.coupAt();
    if (!c || i === null) return;
    this.act({ k: 'coup', uid: c.uid, at: i });
  }
  protected classCard(): void {
    const c = this.selCard(), g = this.game()!;
    if (!c || g.classed.p) return;
    this.act({ k: 'class', uid: c.uid });
  }

  private act(a: Action): void {
    const g = this.game()!;
    if (this.phase() !== 'play') return;
    const rep = applyAction(g, 'p', a);
    this.resetSel();
    this.mine.set(rep);
    this.game.set(g);
    this.pulse(rep.changed, 'p');
    if (rep.trig) this.pulse(rep.trig.fx.changed, 'r');
    this.say(`Vous : ${this.cardName(rep.card)} — ${rep.text}.`);
    if (rep.trig) this.say(`⚡ ${this.V.rival.The} : ${this.cardName(rep.card)}, ${rep.trig.fx.text}.`);
    if (rep.coup && !rep.coup.ok) this.miss.emit();
    this.emitProgress();
    if (g.crisis) return this.crisisEnd();
    this.phase.set('ai');
    this.theirs.set(null);
    this.later(() => this.aiStep(), this.reduced ? 250 : 900);
  }

  private aiStep(): void {
    const g = this.game()!;
    if (g.aiHand.length) {
      const rep = applyAction(g, 'r', aiAction(g));
      this.theirs.set(rep);
      this.aiNote.set(intentOf(g, rep));
      this.pulse(rep.changed, 'r');
      if (rep.trig) this.pulse(rep.trig.fx.changed, 'p');
      this.say(`${this.V.rival.emblem} ${this.cardName(rep.card)} — ${rep.text}.`);
      if (rep.coup?.ok && rep.coup.removed) this.miss.emit();
    }
    this.game.set(g);
    this.emitProgress();
    if (g.acted >= ROUNDS) return this.endOfTurn();
    this.phase.set('play');
  }

  private endOfTurn(): void {
    const g = this.game()!;
    const res = endTurn(g);
    this.turnRep.set(res);
    for (const z of res) {
      this.say(`Bilan ${this.V.zones[z.zi].name} : France ${z.pts[0]}, ${this.V.rival.name} ${z.pts[1]}.`);
      if (z.pts[1] > z.pts[0] && res.length === 1) this.miss.emit();
    }
    this.game.set(g);
    this.phase.set(g.turn >= TURNS ? 'final' : 'turn');
    this.emitProgress();
  }

  protected goNextTurn(): void {
    const g = this.game()!;
    if (!nextTurn(g)) { this.phase.set('final'); return; }
    this.mine.set(null);
    this.turnRep.set(null);
    this.game.set(g);
    this.phase.set('play');
    this.say(`Tour ${g.turn} · ${this.V.words.tension} ${g.tension}.`);
  }

  protected showVerdict(): void {
    const g = this.game()!;
    const d = g.vpP - g.vpR;
    this.won.set(d > 0);
    this.verdict.set(d > 0
      ? `${d >= 15 ? 'Victoire éclatante' : d >= 6 ? 'Victoire nette' : 'Victoire sur le fil'} : la France l’emporte de ${d} PV sur ${this.V.rival.the}.`
      : d === 0 ? `Égalité parfaite : ni la France ni ${this.V.rival.the} ne prend l’ascendant.`
      : `${this.V.rival.The} l’emporte de ${-d} PV : ${-d >= 15 ? 'un net recul de l’influence française.' : 'la partie était serrée.'}`);
    this.finish();
  }

  private crisisEnd(): void {
    this.won.set(false);
    this.verdict.set(`💥 ${cap(this.V.words.crisis)} ! Votre ${this.V.words.coup} a mis le feu aux poudres : tout est gelé, votre crédit s’effondre.`);
    this.finish();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    const g = this.game()!;
    const r = finalScore(g);
    this.phase.set('over');
    this.say(this.verdict());
    if (r < 0.5) this.miss.emit();
    this.progress.emit({ live: r, time: 0 });
    this.later(() => this.done.emit(r), 2200);
  }

  private emitProgress(): void {
    const g = this.game()!;
    const t = ((g.turn - 1) * ROUNDS + g.acted) / (TURNS * ROUNDS);
    this.progress.emit({ live: scoreFromDiff(projectedDiff(g)), time: clamp(1 - t, 0, 1) });
  }

  private pulse(ids: number[], s: Side): void {
    if (!ids.length) return;
    const m = new Map(this.flash());
    for (const i of ids) m.set(i, s);
    this.flash.set(m);
    this.later(() => { const n = new Map(this.flash()); for (const i of ids) if (n.get(i) === s) n.delete(i); this.flash.set(n); }, 1500);
  }
  private later(f: () => void, ms: number): void { this.timers.push(setTimeout(f, ms)); }
  private say(t: string): void { this.log.update(l => [t, ...l].slice(0, 10)); }
}

function cap(t: string): string { return t.charAt(0).toUpperCase() + t.slice(1); }

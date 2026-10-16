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
 *
 *  Rendu : une salle de situation — vraie carte (Natural Earth,
 *  déformée pour la lisibilité), territoires colorés selon le
 *  contrôle, piles de jetons d'influence, jauge de tension à
 *  aiguille, cartes en forme de dossiers diplomatiques.
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

/* ── Fonds de carte ────────────────────────────────────────── */

/** Fonds de carte : Natural Earth (domaine public), projection équirectangulaire déformée (spline de plaque mince)
 *  pour que chaque pays du jeu ait la place de son repère. Généré hors ligne ; unités du viewBox. */
const ART: Record<Variant, MapArt> = {
  monde: {
    w: 1000, h: 820,
    pos: { SCA: [466, 58], VAL: [521, 166], MER: [345, 200], BAL: [521, 274], ACE: [697, 195], SUB: [837, 354], ASE: [806, 490], PAC: [908, 681], LEV: [485, 382], ZAM: [661, 382], GOL: [601, 490], MAG: [309, 308], SAH: [425, 490], COR: [566, 598], AOU: [390, 598], CAR: [119, 368], AND: [149, 556], CSU: [172, 730] },
    labels: [['Océan|Atlantique', 215, 95], ['Océan Indien', 700, 712]],
    homeLabels: [['France', 379, 166], ['Karstanie', 814, 57]],
    homeP: 'M202 503l1-6 8 14-2 15-5-5zM340 179l5-4 10-14-4-14-7-6 2-5 8 1 8 5 2-9 4 5 16-2 3-5 6 0 7 13 3 1 10 11 8 5-7 10-5-1-7 5-2 3 4 0 1 5-1 6-4 2-1 7 3 3-3 3-9 1-12-9-11-2-3 4-8-2-5-6-3 0-8-7zM399 227l1-7 10-3-3 8-6 5z',
    homeR: 'M487 133l1-5 6-1 7 5 0 5zM520 110l0-12 7-11-5-5 14-19-7-6 2-5-4-7 2-6-5-9 4-5-7-5 1-5 13-6 7 5 11 2 18 12 1 5-10 6-21-6 7 6 1 12 8 5-2-8 2-2 10 5 4-2-4-6 9-8 8 3 2-5-4-4 1-5-3-4 11 2 3 4-5 1 0 4 4 2 6-2 0-4 21-11 3 0-3 4 5 1 15-7 5 4 4-5-5-3 2-3 12 1 21 8 2-3-5-5-5 0-3-10 11-13 10 1 2 3-3 6 5 6 1 8 5 3-7 14 5 1 8-11-3-3 1-4-4-1-2-3 2-6-6-5 6-4-2-4 5 3-1 5 5 1-3-4 6-3 8 0 8 3-6-11 23-2-4-3 4-4 6-1 93 0-15 6 14 2 3 3 7-2 28 5 0-4 13 1 7 4 2 3-2 3 12 7 2-6 6 3 22 1-4-6 5-3 32 6 13 9 22 2 3 3-1 5 8 1 2 56-5 4-4-8-8 1-7 10 3 4-12 1 0-5-5-2-4 3-20-2-19 24 5 2 6 6 1-3 4 1 5 8-1 31-11 32-3 3-4-4-4 6-1 10-5 10 3 7-7 4-1-14-3-3-7 6 1-11-1-4-5 12-3 0 4 13 2 3 2-5 4 7-3 2-4 13 6 26-2 23-13 38-10 16-4 5 0-4-9 11-5 11 4-11-4-5 2-15-8 10-4 11 7-58-2-7-3 1-1-9-2 4-2-2-3 13-2 2-5-2-2 9-1-6-1 2-8 1-16-7-4 0-1 2-14-4-5-8 4-1-2-4-5-11-9-7-10 1-11-11-4-9-5 1-5-8-1-5 3-7 3-3 6-1 0-7 6-3 6-12-3-7 3-3-10-13 10-8-2-14 10 1-1-11 3-2 1-5-3-4-5 2-13-8-5 3-8-3-1 4-22-20 1-3-13 11-1-4-6-1-4 2-3-7-8 1-16 12-16 8-2 4 4 4-7 12 8 3-1 4-7 3-1 3-6-2-7 3-5 6-15-5-7 3-9 14-1 8-4-5-4 13-2 11 4 7 3-2 2 12 2 1-14 26 4 9-2 8 5 12-6 10-3 0-2-6-5-1-1-5-4-1-4 3-6-6-10 0-6-12-2-7 8-13-1-4 6-6 0-3-3 3 0-5 6-6 3-20-8-2-2-5-3 2-5-4-2-7-3-1-2-12-8 2-2-11 5-2-8-17 0-7-6-2-5-6zM540 249l6-11 4 10 4-2-1 5-11 10 0-9zM609 -5l4-2-1-3 7-6-4-1 9-6-2-2 11-5 21 0-9 3-11 6-10 13 1 5 8 5-15 1-1-3-7-1zM867 375l6-13 4-3-6 14-3 5zM926 -28l1-2 25 0 4 1-3 5-7-1-12 1zM938 -16l8-3 6 5zM960 -26l0-2 16 3-4 2zM961 112l2-6 9 37-4-3-1 9 3 13-2-5-2 5zM1001 106l4-16 5-1 11-14 1 31 0 7-5 3-1 7-4 1-1 7-4 5z',
    grat: 'M37 840l3-441-9-176-2-71 6-177M112 840l1-435-3-45-14-118-4-74 4-80 12-115M187 842l1-216-3-104-9-92-23-162-5-71 2-46 5-45 26-134M262 846l3-172-4-79-12-81-41-193-8-52-2-43 2-48 8-46 47-162M337 851l6-147-5-68-21-101-59-203-8-42-3-39 3-39 9-40 50-129 21-74M411 855l9-146-3-47-8-53-12-59-11-43-16-42-48-113-9-31-2-23 4-30 12-39 12-27 30-53 15-40 14-60 10-78M486 856l8-143-1-45-6-53-16-75-13-38-32-77-7-24-2-20 2-23 9-23 15-23 36-45 10-25 2-40-5-228M560 856l2-67 8-121-3-101-7-46-31-103-5-35 4-21 33-88 10-54 2-41 0-58-10-145M634 853l0-93 7-70 16-73 38-127 6-33 2-28-5-61-20-87-9-52-15-141-15-113M708 850l-4-133 3-43 8-43 11-39 15-42 75-158 9-26 1-17-2-23-7-27-45-119-20-62-21-75-16-71M782 847l-11-175 2-50 5-47 9-42 12-35 47-102 16-42 9-34 4-35-3-37-8-39-53-161-21-77M856 843l-15-223 1-80 12-62 38-108 12-42 9-45 2-41-1-38-7-47-43-185M931 841l-12-239 0-67 8-69 30-159 6-82-5-88-21-163M-11 776l96-2 72 3 51 7 172 30 59 6 59 2 62-2 68-6 259-33 55-3 67 0M-11 635l91-4 36 2 32 6 59 20 116 55 52 21 57 15 55 5 56-4 61-13 58-17 143-49 71-20 58-9 73-4M-10 496l51-2 41 1 35 5 32 9 29 12 31 18 114 78 44 27 44 16 48 6 59-4 56-13 63-23 117-58 50-19 100-28 103-16M-10 358l98 0 39 4 33 6 37 12 95 39 98 28 95 46 33 9 34 3 27-2 29-5 30-10 30-13 58-33 99-69 24-12 12-2 154 2M-14 217l221-27 35-2 32 3 32 8 34 14 153 89 17 7 19 2 39-5 45-14 39-17 109-56 44-17 36-9 31-4 30 2 119 25M-14 78l205-23 82-4 44 1 46 5 144 27 42 5 49-3 126-22 77-7 88 4 128 16',
    land: 'M-18 140l1-114 15-3 3 4 4-4-3-2 2-3 7-1 6 4 11 2 10-1 0-4 3-2 6 2-1 6 3-5 3 0 2-7-8-6 1-7 4-5 9 4 4 7-4 3 7 1-1 6 6-5 3 4-1 5 3 4 7-11 1-7 15 4-4 6 2 7-8 4-8 0-6 12-5 5-5 0-3 8-9 6-6 21 5 1 3 11 4-2 19 11 9-1-1 13 7 13 4-10-3-14 12-13-2-10-3-4 4-7 0-16 2-1 9 1 3-2 7 7 6 0-1 13 5 4 12-14 6 20-2 4 6 6 5 1 2 7 2 1 0 9-15 15-19 3-15 26 7-11 11-8 3 3-3 5 1 13 3 3 5-2 3-9 1 8-16 20-2 0 0-7 5-7-7 3-9 12-2 10 3 5-11 7 5-1-6 2-2 14-2-4 2 9-2 9-2-15 1 8-2-1 5 21-13 33 9 49-3 0-2-5-7-25-5-8-2 4-5-6-9 1 1 8-3 1-6-4-7 0-10 15 0 39 7 23 8 8 8-3 4-5 1-12 11-4-4 41 14 1 6 6-1 29 6 14 3 4 8-4 8 8 3-5 3-11 5 0 5-7 2 3-3 4 2 17 2-5-2-8 4-2 0-5 7 13 6 2 5 6 1-4 8 3-3 1 2 4 5 7 15 31 11 8 10 17 7 21 0 12 7 5 0 7 3-3 11 14 2 8 18 13 20 29 3 12-1 8-13 13-2 24-7 18-4 4-10-3-12 4-3 4-2 16-19 28-5 3-5-2-8-8 6 21-4 8-5 2-12-1 1 13-3 2-7-2-2 2 1 7 2 2 3-2 1 4-7 6-1 10-4 0-3 4-1 5 7 7-8 18-28 0 1-16 4-6-6-2 4-6 1-12 4 3 2-15-3-2-1 9-2-1 4-29-1-15 8-32 0-25 5-49-1-21-21-30-13-53-6-7 0-10 6-12-1-3-1 3-2-3 0-8 3-11 5-3 6-14-1-19-6-17-5 4 0 6-4-6-7-3-4-11-1 2-2-3-1-8-6-16-4 1-10-6-13-17-7 4-12-8-14-11-8-11 0-11-3-9-13-20 0-6-12-17-4-15-3-3zM-17 17l0-8 6-1-6-1 1-15 5-1 5 3 5-4 6 8 1-2-2-7 3-1 8 3 3 11 12 6-1 2-5 1 2 3-2 2-12-2-26 6zM-16 -23l0-6 18 2-2-3 4 0 10 0-2 6-27 5 0-2 7-3zM-15 292l18 43-2 3-9-13 0-9-7-6zM25 -8l0-2 8 0-4-4 5-3 11 2-3 3 5 2-1 6-6 3zM26 -28l0-2 18 0-2 5-6 1-4-1 0-4zM34 11l6-5 9 6-3 3zM47 -25l7-4 5 4-3 2zM49 -12l2-6 4-2 14 1-3 3-11 9-4 0zM62 -30l44 0 3 4-8 3-29 0-9-1zM70 -8l7-9 9-2-3 4 3 4 4-5 9-3 5 6-1 4 11-4 13 5 0 3 7-2 3 4 8 1 5 8-7 3 13 4 4 5 5 0-9 12-8-8-5 1-1 4 9 7-1 10-12-5 7 10-15-5-4-2 2-2-10-5-10 3-2-1 3-5 13-2 1-5 5-7-1-4-12-4 2-2-9-6-8 3-26-2-3-2 4-3-5 0zM75 46l4-4 2-11 14 7 0 3 5 1-3 3-7-4-9 7-1-3zM92 344l5-8 8-1 5 6 3 0 12 15 3 4-2 2-8 0 1-5-6-9-11-6 0-3-3-1-4 6zM104 -16l2-3 8 0 6 3-2 2-10 1zM113 18l5-5 2 2-1 3-6 3zM129 375l0-3 6 1-4-10 7 1 7 9 1 6-6-3-1 6-4-5-4 0zM153 137l8-20 5-7-4 13 2-3 1 4 6 1-1 18-3 0 0-7-4 7 1-4-2-1-9 1zM186 -29l143-1 3 3-9 1 4 2-2 2-11 0 4 6-10 0 10 4 0 5-7 0-7-5 1 4-6 3 16 0-24 9-16 2-11 8-25 9-6 10-7 4 0 5-7 10-5 1-3-4-7 0-8-15-3-19 5-7 6-3 4-6-10 4-4-2 3-7 10 1-8-5-7 0 6-5-7-12zM274 322l5-25-1-29 16-29 2 1 2 5 10 6 19-5 13 3 12 8 8 0 12 10 9 0 4 4-3 5 8 0-7 4-6 16-5 2-1 6 3 2 1 8 20 23 0 11 17 23 6-4 0-8 3-3 8-1 15 24 17 16 6-2 4 1 5 7 1-2 9 5 2-2 7-24 16-29-4 1-3-3-6 5-7 0 0-7-4-2-7 4-1-7-4-2 5-18 8-7 1-6 11-7 6 2 6-8 6 3 13-9 6 0 8 12 10-3 8-7 3-14-12-27 8-13-1-4 6-9-17 14 0 11 4-2-1 5-11 10 0-9-2-3 4-6 0-3-5-3 0-5-3 1-6 18-3 1-5 14-7 12-4 11 1 4-17 8 4-7-4-4-7 0-1 7-3 1-3-2 2-6-3 2-5 11-3 1-1 10-4 5-2-5-3 6-3-1-5 9-3-2-1-7 8-14 6-19-1-5 11-15-2-9-12-19-4-10 1-9-4-4-3 3-1-4 3-3-5-5-7 1-2 13 4 8 0 10 4 12 6 3 0 3-3 0 9 21-5 4 0-6-4-5-7 4 2 6-5 5-3-2-9 6-3-1 2-3 8-5 2-12-1-8-4-10-5-3-6-17-2-8 2-10-8-8-22 1-12-9-11-2-6 9-9 3-8-2-8 6-5 6-1 6-18 14-10-4-6 6-2-12-3-2-2 2-4-2 3-13-1-5 9-17 6-18 9-4 29 12 5-4 10-14-4-14-7-6 2-5 8 1 8 5 2-9 4 5 16-2 3-5 14-1 8-10 14-1 5 3 4-3-2-14 4-12 10-3-2 7 3 4-7 7 1 8 5 4 0 3 8-2 8 10 18-5 9 7 1-5 6-1-1-16 2-5 4-3 4 8 3 1 1-13-4-3 0-5 10-2 9 2 5-4-5-5-21 2-7-9-2-15 2-5 16-13-1-3-5-4-7 1-4 5 0 5-14 10-4 11 8 12-4 9-5 1-5 22-5-2-3 6-6-1-11-38-10 7-7 0-6-5 0-26 26-14 19-20 18-12 15-1 6-5 14 0 13 6-5 1 4 5 4-3 33 15 4 9-4 4-6 2-21-6 7 6 1 12 8 5-2-8 2-2 10 5 4-2-4-6 9-8 8 3 2-5-4-4 1-5-3-4 11 2 3 4-5 1 0 4 4 2 6-2 0-4 21-11 3 0-3 4 5 1 15-7 5 4 4-5-5-3 2-3 12 1 21 8 2-3-5-5-5 0-3-10 11-13 10 1 2 3-3 6 5 6 1 8 5 3-7 14 5 1 8-11-3-3 1-4-4-1-2-3 2-6-6-5 6-4-2-4 5 3-1 5 5 1-3-4 6-3 8 0 8 3-6-11 23-2-4-3 4-4 99-1-15 6 14 2 3 3 7-2 28 5 0-4 13 1 7 4 2 3-2 3 12 7 2-6 6 3 22 1-4-6 5-3 32 6 13 9 22 2 3 3-1 5 8 1 2 31 0 25-5 4-4-8-8 1-7 10 3 4-12 1 0-5-5-2-4 3-20-2-19 24 5 2 6 6 1-3 4 1 5 14-1 25-4 13-7 19-3 3-4-4-4 6-1 10-5 7 6 23-1 13-6 4 1-19-6-10 1-11-3-3-7 6 1-11-1-4-5 12-3 0 4 13 2 3 2-5 4 7-3 2-4 13 6 26-3 29-12 32-10 16-4 5 0-4-9 11-4 10 1-13-6 9-7 17-11 40-17 38-23 33 16-50-20 38-10 30-6 45-2 1-2-10 9-43 45-99-9 14 1-3 15-40 5-29-4 10-2-2-5 7-4 14-27 46-10 11-32 63-19 29 21-61 14-61-14 13-7-4 3-5-2-2-12-1-2-4-6-3-34 25-32 12-4-9-4 1-14 12-5 0-23-2-15-18-5 3-6-2-3 4-5 1 10 20 13 6 1 6 7 9 0-11 3-2 2 2 0 10 4 4 18-8 17-28 1 13 4 4 15-2 8 3-11 23-5 4-2 11-18 19-1 3-20 15-2 7-24 20-28 18-4 1-6-18 0-9-5-8-28-28-11-21-9-5-27-36-3-1-2-13-2 16-14-22 20 36 17 21 2 7 12 11 13 28 7 5 9 16 25 21 1 5-3 3 8 7 42-25-7 23-14 32-40 63-7 20 3 4-1 8 4 10-2 21-22 21 2 14-12 8-2 10-15 15-9 4-26 2-3-7 2-3-10-15-2-16-8-14 0-5 8-17-2-15-5-16-13-22 1-29-6-14-10 4-8-18-10 1-13 11-12-7-13 2-27-41-17-39-11-20-13-34-2-17-7-26-19-52zM596 245l4 23 7 19 5 2-5 3-6 18 1 14 8 1 5 4 11-2 12-7-2-25-6-2 2-9-5 2 2-11 6 0 5-6-7-11-5 5 0 9-2-19-6-1-2-10-3-1 0-4 5-1 0-9 9-4 0-17-9 1-10 12zM300 20l4-4 6-1 5 4 7-3 5 2 14-2-2 4 4 4-12 5-12 3-16-3 5-2-8-3 8-3zM330 108l7-6 0-7 13-7 6 4 2 2-12 15-10 2zM345 124l16-5-7-4-1-3 6-1-1-4 3-4 7 2 2-4-2-5-5-2 1-7-4 2 1-10 9-11 9 1-3 3-4 4 11 1-9 10 5 2 2 10 3 2 2 13 6 3-6 6 1 5-6 2-20-5-4 2zM384 247l7-17 4 3 5-1 0 9-8 11-3-3-4 1zM399 227l1-7 10-3-3 8-6 5zM402 277l4-4 19 11-7 6-5 7zM445 107l7 0 0 8-2 3zM449 340l4-4 0 5 8 6-2 3-6-3zM484 366l1-4 13-3-6 6-6 3zM576 753l4-9 2-16 13-10 6-14 3 12-15 45-7 4-4-1zM609 -5l4-2-1-3 7-6-4-1 9-6-2-2 11-5 21 0-9 3-11 6-10 13 1 5 8 5-15 1-1-3-7-1zM753 527l18-39-3 11-9 21zM780 556l5-42 3 1-1 25 2-1 1 11-1 9 6 14-3 19-3 1-5-9zM790 599l3-7 4-1 4 4 6-2 1-3 6 1 1 4 10 2-4 3-11 1zM806 551l4-18 2 1 3-2 1-6 6-5 20-35 1 7 4 3-10 19 0 11 3 5-4 2-7 18-2 17-1-2-4 4-1-3-4-1-4 3-1-3-4 2zM821 693l1-16 1 4 8-13 15-10 7-21 2 4 2-1-1-6 2 1 5-14 5-4 5 5 5 0 3-15 8-5-3-4 2-1 12 4 5-3 2 2-5 17 19 13 4-8 1-25 3-11 7 23 2-3 4 5 5 24 10 9 4 12 2-2 12 21 3 25-2 18-6 19-4 22-6 3-7 9-6-5 0-3-5 6-12-5-4-13-6-3 0-9-2 5-3 2 3-17-7 14-7-15-12-6-20 8-7 6-1 6-15 3-6 9-5 0-7-4 2-13-12-34 2 2-2-5 4 3zM828 600l4-7 4 0 1 2zM837 557l10-31 11 0 5-7-4 10-15 6-2 5 3 6 10-9-1 4-7 7 5 17-2 7 0-8-3 4-2-14-3 3 0 17-4 0 1-13zM840 593l11-6-1 4-5 3-5 1zM847 473l17-30-2 8zM853 600l6-12 7-4-9 14zM860 481l4-10 13-11 2-6 1 3-3 18-3 7 0-8-2 5-3 10-3-4 2-13zM867 375l6-13 4-3-6 14-3 5zM868 456l5-10 2-1-2 6 2-5-7 16zM869 450l4-13 1 2 2 0-1 4zM871 552l1-4 9-1 1 5-3-2zM871 522l3-9 2 6-1 7-2 0-1 9zM876 419l16-44 2 2 1-2-3 13-11 26 2 0 2 4-3 12 0-9-2 3 0-5-3 2zM877 451l6-22 2 0-2 13-2-2zM882 532l8-5 6 1 1 13 4 3 3-7 9-6 25 9 5 10 7 3 1 3-4 2 1 4 7 10 2 0 0 3 6 4-3 3-9-3-7-12-6-2-6 5 1 5-4 2-6 0-4-4-4-1-6 3 4-7-3-12-17-9-3 5-3-8 7-6-6 2zM902 342l2-15 7-15zM926 -28l1-2 25 0 4 1-3 5-7-1-12 1zM937 248l8-15 5-1 2 2 3-13 2 4 5-9 1-21 3-1 2 10-2 13-2 22-4 3-4 0-4 8-2-9-10 3 3 6-5 17zM938 -16l8-3 6 5zM943 252l2-8 1 1 2-3 1 5-4 7zM947 783l6 3 8-2-1 16-2-2-2 5-3 0zM953 551l0-3 6 0 2-4 0 4 2-1 4-9 2 0-1 9-7 6zM960 -26l0-2 16 3-4 2zM961 112l2-6 9 37-4-3-1 9 3 13-2-5-2 5zM962 185l1-5 3 0 0-15 6 11 2 2 2-3 1 8-4 1-2 7-5-6-1 7-3 0zM963 529l1-2 6 4 3 8-1 2-2-6zM1001 106l4-16 5-1 11-14 1 31 0 7-5 3-1 7-4 1-1 7-4 5z',
    regions: {
      SCA: 'M300 20l4-4 6-1 5 4 7-3 5 2 14-2-2 4 4 4-12 5-12 3-16-3 5-2-8-3 8-3zM420 69l1-17 26-14 19-20 18-12 15-1 6-5 14 0 13 6-5 1 4 5-9 3-1 5 7 5-4 5 5 9-2 6 4 7-2 5 7 6-14 19-4 0-17 2-7-9-2-15 2-5 16-13-1-3-5-4-7 1-4 5 0 5-14 10-4 11 8 12-4 9-5 1-5 22-5-2-3 6-6-1-11-38-10 7-7 0-6-5zM430 105l4-12 10-3-1 9 2 2-7 7 1 5-7-2zM445 107l7 0 0 8-2 3z',
      VAL: 'M448 160l12-3 4 1-4-20 0-7 4-2 14-3 5 5 18 6 0-5-7-5-1-16 2-5 4-3 4 8 3 1 1-13-4-3 0-5 10-2 9 2-2 19 4 13 5 6 6 2 0 7 8 17-5 2 2 11 8-2 2 9 5 11 5 4 3-2 2 5 8 2-3 20-3 2-3 9-14 11-1 7-3-6-2 3-5-4 0-5-3 1-6 15-4-3 1-16-6-19-7 4-7-7-5 3-6 14-15-1-12-18 1-9 4 2 1-9-10-9-6 2-10-14z',
      MER: 'M285 224l3-13-1-5 9-17 6-18 9-4 29 12 0 4 14 10 2 3 8 2-3 5-9 3-8-2-13 12-1 6-18 14-10-4-6 6-2-12-3-2-2 2zM384 247l7-17 4 3 5-1 0 9-8 11-3-3-4 1zM399 198l6-15 2 3 8 0 4 4 3-3 8 3 1-3 4 3 8 0 1 4 9 7-1 10-5-5-7 1-3 7 9 36 6 3 0 3-3 0 7 13 2 8-5 4 0-6-4-5-7 4 2 6-5 5-3-2-9 6-3-1 10-8 2-12-1-8-4-10-5-3-6-17-2-8 2-10-8-8-13 0 3-3zM402 277l4-4 19 11-7 6-5 7z',
      BAL: 'M449 214l3-3 1-10 5 4 12 1 11 17 15 1 6-14 5-3 7 7 6-4 2 2 5 17-1 16 1 2 2-1 1 5-3 1-14 32-2-2-6 2 0 3-6 7-4-4-7 0-1 7-6-1 2-6-3 2-5 11-3 1-1 10-4 5-2-5-3 6-3-1-5 9-3-2-1-7 8-14 6-19-1-5 11-13-1-7-13-23-4-10 1-9-4-4-3 3zM449 340l4-4 0 5 8 6-2 3-6-3zM484 366l1-4 13-3-6 6-6 3z',
      ACE: 'M599 201l6-24 4 5 1-8 9-14 7-3 15 5 5-6 7-3 6 2 1-3 7-3 1-4-8-3 7-12-4-4 2-4 16-8 16-12 8-1 3 7 4-2 6 1 1 4 13-11-1 3 22 20 1-4 8 3 5-3 13 8 5-2 3 4-1 5-3 2 1 11-10-1 2 14-10 8 10 13-3 3 3 7-6 12-6 3 0 7-6 1-4 6-1 9 5 8 5-1 6 11-15 16-2 6 5 8 0 13-6 4 5 4-4 12 2 6-12 15-3 8 2 7-8 10-16 12-13 3 5-13-2-5-6 1-6-13 2-7-4 0-1-24-3-10-5 3-10-7-19 1-7 5-5 9-6 5-2-21-6-2 2-9-5 2 2-11 6 0 5-6-7-11-5 5 0 9-2-19-6-1-2-10-3-1 0-4 5-1 0-9 9-4 0-17-9 1-10 12-2-1-2-12-3 2z',
      SUB: 'M705 371l13-3 16-12 8-10-2-7 3-8 12-15-2-6 4-12-5-4 6-4 0-4 0-9-5-8 2-6 15-16 5 2 4 7 10-1 9 7 7 15-4 1 5 8 6 3 8 1 1-2 4 0 16 7 8-1 1-2 1 6 2-9 5 2 2-2 3-13 2 2 2-4 1 9 2 0 0 10-2-1-2 7-9 41-5 14 4-20-4 10-2-2-5 7-4 14-27 46-10 11-32 63-19 29 21-61 14-61-14 13-7-4 3-5-2-2-12-1-2-4-6-3-34 25 2-11 10-11-1-4-4 1-1-7-7 0zM753 527l18-39-3 11-9 21z',
      ASE: 'M780 556l5-42 3 1-1 25 2-1 1 11-1 9 6 14-3 19-3 1-5-9zM790 534l11-49 43-93-9 14 1-3 15-40 11-40 4-24 2-7 2 1 0-10 2 13-4 25 2-1-4 27 4-11 8-10-1 18-12 25-19 59-9 19-23 33 16-50-20 38-9 25-7 50-2 1zM790 599l3-7 4-1 4 4 6-2 1-3 6 1 1 4 10 2-4 3-11 1zM806 551l4-18 2 1 3-2 1-6 6-5 20-35 1 7 4 3-10 19 0 11 3 5-4 2-7 18-2 17-1-2-4 4-1-3-4-1-4 3-1-3-4 2zM828 600l4-7 4 0 1 2zM836 600l4-2 3 5zM837 557l10-31 11 0 5-7-4 10-15 6-2 5 3 6 10-9-1 4-7 7 5 17-2 7 0-8-3 4-2-14-3 3 0 17-4 0 1-13zM840 593l11-6-1 4-5 3-5 1zM847 473l17-30-2 8zM853 600l6-12 7-4-9 14zM860 481l4-10 13-11 2-6 1 3-3 18-3 7 0-8-2 5-3 10-3-4 2-13zM868 456l5-10 2-1-2 6 2-5-7 16zM869 450l4-13 1 2 2 0-1 4zM871 552l1-4 9-1 1 5-3-2zM871 522l3-9 2 6-1 7-2 0-1 9zM872 434l2-11 2 0 0 3zM876 419l16-44 2 2 1-2-3 13-11 26 2 0 2 4-3 12 0-9-2 3 0-5-3 2zM877 451l6-22 2 0-2 13-2-2zM882 532l8-5 6 1 1 13 4 3 8-13 14 4 0 42-6-5-8 3 4-7-3-12-17-9-3 5-3-8 7-6-6 2z',
      PAC: 'M821 693l1-16 1 4 8-13 15-10 7-21 2 4 2-1-1-6 2 1 5-14 5-4 5 5 5 0 3-15 8-5-3-4 2-1 12 4 5-3 2 2-5 17 19 13 4-8 1-25 3-11 7 23 2-3 4 5 5 24 10 9 4 12 2-2 12 21 3 25-2 18-6 19-4 22-6 3-7 9-6-5 0-3-5 6-12-5-4-13-6-3 0-9-2 5-3 2 3-17-7 14-7-15-12-6-20 8-7 6-1 6-15 3-6 9-5 0-7-4 2-13-12-34 2 2-2-5 4 3zM923 567l0-32 15 5 5 10 7 3 1 3-4 2 1 4 7 10 5 3-1 2 4 4-12-2-7-12-6-2-6 5 1 5-4 2-6 0zM947 783l6 3 8-2-1 16-2-2-2 5-3 0zM953 551l0-3 6 0 2-4 0 4 2-1 4-9 2 0-1 9-7 6zM963 529l1-2 6 4 3 8-1 2-2-6zM979 543l6 9-2 2-1-2z',
      LEV: 'M475 338l5-18 8-7 1-6 11-7 6 2 6-8 6 3 13-9 6 0 8 12 10-3 14-9 3 4-2 10 5 5-5 5-4 17 5 22 5 2 0 7-4 5-2 9 6 9 12 4 6 7-1 8 3-1 1 5 6 4-12 1-5 11-16 1-29-17-23-9-14 5 9 11-2 4-5 1-3 5-8-2-7-19 7-24 16-29-4 1-3-3-6 5-7 0 0-7-4-2-7 4-1-7zM495 301l10-14 0-3 6-2 2 2-3 12-5-1z',
      ZAM: 'M562 268l10 0 6 6 4-3 4 1 1 5 5 1 2 6 3 0 6-10 4 13 5 2-5 3-7 24 2 8 8 1 5 4 11-2 12-7 11-18 7-5 19-1 10 7 5-3 3 10 1 24 4 0-2 7 6 13 6-1 2 5-5 13 8 6 7 0 1 7 4-1 1 4-10 11-2 11-32 12-4-9-4 1-14 12-10 1-10-4-8 1-15-18-5 3-6-2-3 4-6-4-1-5-3 1 1-8-6-7-12-4-6-9 2-9 4-5 0-7-5-2-5-22 4-17 5-5-5-5 2-10-3-4-6 2 3-14z',
      GOL: 'M495 421l8 2 3-5 5-1 2-4-9-11 14-5 23 9 29 17 16-1 5-11 7 0 10 20 13 6 1 6 7 9 0-11 3-2 2 2 0 10 4 4 18-8 17-28 1 13 4 4 15-2 8 3-11 23-5 4-2 11-22 26-17 11-2 7-24 20-19 11-4 5-9 3-6-18-2-12-15-19-16-14-11-21-9-5-27-36-3-1z',
      MAG: 'M274 322l5-25-1-29 16-29 2 1 2 5 10 6 6-3 16-2 20 8 2 3 8 0 8 8 13 2 4 4-3 5 8 0-7 4-6 16-5 2-1 6 3 2 1 8 20 23 0 11 17 23 6-4 0-8 3-3 8-1 15 24 17 16 6-2 4 1 5 7 1-2 9 5 2-2 7 17-2 16-13-23 4 11 15 26 17 21 2 7 12 11-36-8-32-12 8 20-5-3 2 4-55-60-4 6-15-17-5 13-2 19-3 4-5 0-3-9-54-66-33-50 6 19-11-3 11 33-3 1 2 6 7 20-13-4 0 4-8-35z',
      SAH: 'M283 345l11 3-6-19 33 50 54 66 3 9 5 0 3-4 2-19 5-13 15 17 4-6 55 60 15 39-4-2 1 13 4 18 7 15-3 5-1 10-3 4-4 0-2 10-9 4-3-13-6-9 0-5 5 1-7-25-7-11-4-8-1 6-6-5-6 5-7-7-3 2-8-11-5 2 0 3 4 25-7-8-3 16-17-1 5 17-4-3-3 2-6-10-2 2-2-6-2 4-5-3-12-29-3 5-6-6-13-35-11-22-7-9-3 1-3-2 0 4-16-53-7-14 0-4 13 4-7-20-2-6 3-1z',
      COR: 'M462 468l32 12 36 8 13 28 7 5 9 16 25 21 1 5-3 3 8 7 42-25-7 23-14 32-38 62-6 14-6-4 0-4-15-8-17 5 1-15 3-8-2-9-5-8-7 3-23-38-1-11-12-25-5-31 4 2-17-43 5 3z',
      AOU: 'M310 468l3 2 3-1 7 9 11 22 13 35 6 6 3-5 12 29 5 3 2-4 2 6 2-2 6 10 3-2 4 3-5-17 17 1 3-16 7 8-4-28 5-2 8 11 3-2 7 7 6-5 6 5 1-6 4 8 6 12 0 37-1 18-2 3-4-4-3 21-10 4-8-18-10 1-13 11-12-7-13 2-24-35-20-45-11-20-13-34z',
      CAR: 'M69 391l2-5 5 0-4-9 1-4 8 0 2-4-2 18 14 1 7 8-2 27 6 16 4 1 5-4 5 4 3 9-2 5-1-8-5-5-3 5 2 4-3 2-1-5-9-5-5-12 0 3-2-3-1-8-6-16-4 1-10-6-3-5zM92 344l5-8 8-1 5 6 3 0 12 15 3 4-2 2-8 0 1-5-6-9-11-6 0-3-3-1-4 6zM117 374l2-2 4 3 1 2-3 1zM129 375l0-3 6 1-4-10 7 1 7 9 1 6-6-3-1 6-4-5-4 0zM150 379l5 2-1 2-4-1zM173 451l0-5 3 0 0 6z',
      AND: 'M108 528l6-12-1-3-1 3-2-3 3-19 5-3 6-14-2-32 6-5 3-11 5 0 5-7 2 3-3 4 2 17 2-5-2-8 4-2 0-5 7 13 6 2 5 6 1-4 8 3-3 1 2 4 9 16-3 15 2 11-7 2-6-5 2 11 4 4-3 3-8 2-4-11-1 2-7-3 2 8-3 0 3 11-2 19-3-2-8 4-4 13 3 14 7 6 3-3 1 11 7 2 6-5 5 1 0 12 19 22 1 17 8 3 2 13-2 12-4-7-10-2-3 16-5-4-2 5-2-5-5-3-6 5-3-18 1-6-5-13-3 4-21-30-13-53-6-7z',
      CSU: 'M128 823l4-6 1-12 4 3 2-15-3-2-1 9-2-1 4-29-1-15 8-32 0-25 5-49-1-21 3-4 5 13-1 6 3 18 6-5 5 3 2 5 2-5 5 4 3-16 10 2 4 5 1 14 8 5 1 10 5 2 0 3-2 7 4 3 0 5-16 15 3 0 12 16 1 11-6 6-11-6-2-4 6 18-4 11-5 2-12-1 1 13-7 3-3-3-2 2 1 7 2 2 3-2 1 4-7 6-1 10-4 0-3 4-1 5 7 7-8 18-28 0 1-16 4-6z',
    },
  },
  afrique: {
    w: 1000, h: 900,
    pos: { TAM: [152, 85], KSO: [328, 97], MAZ: [504, 134], OUR: [680, 146], TAD: [92, 231], NIO: [268, 214], BOU: [444, 255], DOU: [620, 285], LAG: [92, 341], PAL: [268, 322], AKO: [268, 430], VOL: [444, 365], NGO: [620, 393], BAS: [444, 474], KAN: [620, 501], LOM: [532, 620], SAB: [796, 334], DAL: [805, 442], IMB: [796, 550], TOU: [727, 669] },
    labels: [['Océan Atlantique', 120, 640], ['Océan|Indien', 950, 560], ['Méditerranée', 520, 30]],
    homeLabels: [],
    grat: 'M13 937l7-393-6-63-24-119-5-51 8-118 3-129 12-100M143 938l1-107 6-88 10-69 26-118 4-47-4-33-9-30-13-26-40-66-7-19-3-16 0-30 11-56 1-22-5-34-18-67-3-28 8-42 26-75M272 938l-3-153 6-97 15-70 40-114 5-41-3-23-7-25-28-64-9-29 1-28 17-66 2-31-5-25-25-58-11-41-3-46 6-62M401 937l-19-313 0-48 3-31 6-25 11-26 20-27 43-47 16-19 13-27 4-19-5-30-38-81-22-74-20-107-10-99M531 936l-8-105-1-73 15-204 7-24 12-24 19-27 54-62 12-20 4-20-3-19-8-18-42-66-17-35-25-70-8-36-5-41-5-128M660 936l-10-130 0-49 4-36 7-28 11-28 40-69 10-22 5-16 2-24-15-156-28-150-18-185-5-79M790 936l-11-130 1-79 10-53 33-87 5-37-4-32-22-68-4-25 7-98 1-53-3-130-10-180M921 936l-7-160 5-196-9-157 13-220-1-240M-39 829l124 6 103 2 374-12 476 2M-38 708l143 16 97 4 64-2 147-17 90-5 373-1 162 2M-38 587l173 30 51 6 46 1 53-5 102-26 62-6 76 0 124 7 80 2 48-2 61-10 42-3 158 2M-40 465l230 44 48 7 33 2 20-2 21-5 66-29 34-12 49-9 88 1 86 12 51 2 75-4 21-5 25-11 25-3 72 1 133 7M-46 341l131 0 135 12 23-1 35-9 34-3 295-7 105 5 154-6 171 7M-45 220l68 3 54-2 32-6 105-26 55-6 38 3 105 28 48 6 132-5 259-1 188 4M-44 99l84 3 182-8 197 5 455-3 165 1',
    land: 'M8 283l12-11 11-25 0-12-3-4 2-2 2-8-7-10-2 2 2-12 7-8 6-16 11-11 5-19 9-6 6-15 16-6 14-14 6-9-3-6 0-9 8-13 10-9 24-8 21-22 8-2 3 5 7 3 29-2 2 3 16 1 55-17 39-5 14 0 8 3 15-5 19 2 23-6 2 3 4-1 3 6 7-5 2 3-7 8 9 12-11 13 3 6 5 0 1 2 2-1 4 4 13 5 12-1 23 6 7 11 26 6 15 7 8-1 6-5 1-3-3-9 2-5 21-9 18 4 4 5 22 3 5 5 21 1 32 8 26-9 11 0 3 3-3-2-1 2 4 3 2-3 5 3 7 0 13-3 5-7 10-29 4-4-4-21 5-6-10 3-9-3-13 8-11 1-21-9-8-1-2 8-10 1-7-2-3-5-21 0 11-4-13 1 3-2-6-6 2-4-13-4 2-4 3 3 6-1-5-3 3-2-4-5 2-3-10 0 1-6 7-5 305-1 1 2-10 1-3 10-2 4-3 0 0 14 3 3 13 3 10 7 11 2 29-3-2-25-3-3-7-1 1-4 5 1-1-4-7-1 1 2-4-8 72 0 0 180-13-2-4-13-3-4-8 0-19 7-12-3-16-10-11-4-19-28-7 2-7-5-2 5-10 1 2 5-5 2 4 0 9 20 17 13-2 0 3 4-2 4 9 14 0-8 3-6 3-2 3 3 1 10-4 5 2 1-2 3 6 1 2 3 31-3 26-24 0 16 3 6 8 7 14 4 0 39-3-2-3 4-1 15-13 2-6 9-12 2-6 9-13 0-21 7-4 8-8 4-28 7-9 7-9 0-14 6-14 2-7 6-17 1-4-26-3-4 2-9-1-8-17-23-5-12-12-8-6-7-4-10 1-9-8-13-11-6-12-21-19-23-7 0 2-18-7 21-13-9-10-17-3 4 9 13 8 8 7 15 20 29 4 2-3 2 3 10 14 11 5 10 0 12 4 15 13 9 14 33 1-3 4 5 10 5 13 16 7 5 2 8-9 7 6-1 11 13 7 1 10-5 9 1 10-5 34-3 9-5 6 2-4 16 4 1-6 1-2 10-42 58-25 24-19 13-15 23-6 35 4 47 4 11-5 36 4 7-11 27-3 21-19 19-39 16-14 12-22 12-3-1-1 9 5 14 0 9 2-4 1 2-3 23-6 6-28 12-2 4 3 3 1-2-1 9-4 17-14 15-16 24-35 27-16 3-2 3-8 0-2 2-29-2-10 5-16 1-6 4-16-5-1-3-4 3-1-8-8-10 6-4-2-10-12-15-9-18-19-19-6-13-2-15-5-10-1-21-38-50-2-26 3-4 5-25 15-17 2-13-13-23 5-5 0-4-13-27 11-4-9 3-2-3-3-15-11-20 0-3 2 1-2-1 0-6 3-7-1 4 2-1 1-4-2 1 3-8 16-15 1 3 4-3-3 0 0-2 39-36 3-7-2 1 1-2 4-4-5 2-5-1 3-6-6 1 2-3-4-2-2 5-16 3-2-2-4 5-1-4-1 5-12 3-6-6-1-7 4-3-6 1 5-2-6 0-4-5-7-4-18 2 5-4-38 16-3 7-8 4-17 27-11-1 2-1-2-3-1 4-7 0-8 5-49 9-42-18-39-24-66-32-3-6-9-3-11-10 3 0 1-3-4 1-2-5 2 0-14-11-2-6-10-4-3-7-4-3-1 2-1-4-2 1-2-2-1-4 4-1-5-2 5-3-9 3-4-3 0-2-4-1 3-4-4 0 1-9 3 1 11-3-11 2-3-6 2-2zM128 15l4-5 4-13 3 0-7 0 0-3 8-5-6 4-4-1 17-22 130 0-14 13 1 6 6 4-12 5-6 7 1 2-15 3-10 8-36 0-22 9-5-2-4-7 4-2-3 1-5-6-14 4zM302 -17l11-5 0 2 5 1-6 5zM382 -30l19 0-2 17-7 0 0 3-5 0-3-3 1-8zM437 4l3-5 14 3 22-5-5 9 2 7-2 4-4 0zM467 -30l27 0-6 9 7 5 1 5-7 2-1 5-6 6-5-1 7-12-7-12-10-4zM495 -30l13 0 5 5-2 3-3-1-3-4zM524 -29l43-1-1 6 10 10-5-1 2 3-7 2 19 7 1 6-7-3-6 2 6 5-4 2-6-3 6 14-6-5-4 4-5-7-2 4-2-1-1-7-7-6 9-5 13 4 5-2-11-4-17 1-4-6 4-2-10-4-6-8zM570 -30l13 0 6 4-7-2 2 3 0 1-7-3 4 4-4-1zM570 -10l6-2 11 4 2 6 4 1-1 2-6-5zM581 32l2-3 6 1 2 3 20 0 0 3 7-3-1 4-19 1zM698 36l8-1 0-3 9 1 12-4-8 4 1 3-12 6-8-2zM824 730l4-11 4-2 10-15-2-28 9-16 21-7 3 2 0-4 7-4 2 2 4-8 1 3 7-4-2-4 1-8 5 0 7-6 1-10 5-4 8 12 5 28-3 7-4-6-3 1 2 12-6 9-2 13-32 79-6 4-17 5-16-4-9-11 1-11zM961 305l3-2 13 3-11 2zM986 717l5-2 4 3-1 2-3 0z',
    regions: {
      TAM: 'M23 213l2-12 7-8 6-16 11-11 5-19 9-6 6-15 17-7 18-20-2-17 8-13 10-9 24-8 21-22 10-2-1 4 9 4 29-2 2 3 11 0 7 5 1 16 4 5 8 4-3 5-31 0-3 3-16 2 1 5 3 2-24 6-7 6-17 2-1 2-8 0-7 4-12 8 11 29-47 6 5 30-15 10 3 18-53 3z',
      KSO: 'M120 112l19-12 26-4 7-6 24-6-3-2-1-5 16-2 3-3 32 0 0-3 3-1-8-4-5-6-1-16-7-5 9 0 23-8 6 0 17-7 44-6 14 0 8 3 15-5 19 2 23-6 2 3 4-1 3 6 8-5 1 3-7 8 9 12-11 14 3 5 5 0 1 2 2-1 8 5 1 9-13 9-2 3 3 8-9 8 7 11 4 16 0 6 3 8-4 5 14 19 15 4 8 10-24 15-44 23-35-5-4-3 1-7-21-11-10-10-43-20-41-10-111-22z',
      MAZ: 'M411 98l9-8-3-8 2-3 13-9-1-9 9 4 12-1 23 6 7 11 26 6 18 7 7-2 5-6-3-10 2-5 12-7 15-2 12 4 4 5 24 4 2 3-4 4 2 6-3 8 5 11 15 108-12 0 2 6-107-44-16 11-11-7-19-4-8-10-14-2-15-21 4-5-3-8 0-6-4-16z',
      OUR: 'M601 95l3-7-2-6 4-4 29 3 25 7 17-8 20-1 3 3-3-2-1 2 4 3 1-3 6 3 20-3 11 22-7 20-13-9-8-11-2-6-3 4 5 9 12 12 7 15 17 25 7 6-3 2 3 10 14 11-66 1-1-3-2 3-81-1-11-85z',
      TAD: 'M8 283l12-11 11-25 0-12-3-4 2-2 2-8-7-10-2 3 1-6 53-3-3-18 15-10-5-30 47-6-5-14 76 15-32 4 32 43 8 20 4 21 5 3-5 13-83 13-7 4-19 3-4 3-10-4-10 10-6 2 2 6-2 7 3 4 3-1 4 5-1 7-16 2-21-3-17 2-16 6 3-4-4 0 1-9 3 1 11-3-11 2-3-6 2-2z',
      NIO: 'M74 281l1-4 6-2 10-10 10 4 4-3 25-5 3-3 3 2 78-14 5-13-5-3-8-32-12-21-24-31 32-4 56 12 38 12 25 13 10 10 20 10 3 11 14 2 1 31-5 10-6 4-37-7-7 4-12-1-13-5-20 9-4 5-5-1-8 12-4 0-5 10-6-4-5 5 0 8-3 3-1 11-10 8 3 9-1 8 4 13-5 1-2 4-4-1-5-10-3 1 1 2-5-2 2 7-6 0 0 4-14-7-10 4-10-7-5-10-9 0 5-7-11-6-1-4-8-9-7 0 1 3-9 4-12-3-9 4-5-4-8 3-4-3 4-10-4-5-3 1-3-4 2-7z',
      BOU: 'M300 259l4-7 10 2 7-4 37 7 6-3 6-16-2-26 22 3 44-23 24-15 19 4 11 7 7-5 9 18 15 13 0 6 16 35-7 30 8 8-13 6-34-1-12 6-7-1-28-7-15 2-15-9-16-5-15-1-10 3-2 7-7 5 1 13-19-12-9 2 1 6-7-8 3-1-2-5-11 0-11-8 1-5 4 0-9-7z',
      DOU: 'M495 183l9-6 107 44-2-6 12 0-4-23 81 1 2-3 1 3 66-1 5 10 0 12 4 15 14 10-14 11-4 0-5 23 2 11-3 18-5 2-5 10-1 12-6 3-1 15-2 0 0-9-9-7-2-18-12 3 6 11-10 17-3 0-10-6-9 12-7 0-3-4-10 1-11-12-5 1 2 18-2 2-4-2-7-18-12-11-2 5 3 15-8 4 3 3-1 8-8 0-8 5-4-4-8 5-7 0 0-4-9-8-23-13 3-3 21-2-11-7-17-20-9-6-6 0-19-15 7-30-16-35 0-6-15-13z',
      LAG: 'M14 312l16-6 22-2 14 3 18-2-3 3 4 3 8-3 5 4 9-4 12 3 9-4-1-3 9 1 7 12 11 6-5 7 9 0 5 10 9 5-1 6 5 10 7 2 2 5 5 2-3 2 2 4 12 9-15-4 1 5 10 4 0 9-14-4-3 7-17-5 0-6-12-13-10-5-13-1 1 5-4 2 2 5-9 8-2 5-26-12-3-6-8-2-12-11 3 0 1-3-4 1-2-5 2 0-14-11-2-6-10-4-3-7-4-3-1 2-1-4-2 1-2-2-1-4 4-1-5-2 5-3-9 3-4-3 0-2z',
      AKO: 'M116 397l2-5 9-8-2-5 4-2-1-5 3 0 10 1 10 5 12 13 0 6 12 5 6 0 2-7 14 5 0-10-10-4-2-4 16 3-12-9-2-4 3-2-5-2-2-5-7-2-5-11 8-7 18 7 0-4 6 0-2-7 5 2-1-2 3-1 2 3 6 8 5-5 10 2 14 12 4 1 3-7 5-1 9 7 15 26 9 31 13 20 1 9-3-3 0 4-7 0-8 5-49 9-42-18z',
      PAL: 'M218 314l10-8 1-11 3-3-1-6 4-6 8 3 5-10 4 0 7-11 6 0 4-5 20-9 7 1 6 4-2 6 4 14 9 7-4 0-1 5 11 8 11 0 2 5-3 1 7 8-8 7-12-1-10 8 0 12 13 6 4 10 6 7 11 36 7 11-8 7-1 5-8 4-17 26-10 0 1-7-14-23-9-31-15-26-9-7-5 1-3 7-4-1-12-10-9-4-4-13 1-8z',
      VOL: 'M305 327l1-6 9-7 13 0 5-3 3-6-1-4 11-1 17 11-1-13 7-5 2-7 8-3 17 1 16 5 15 9 15-2 28 7 7 1 12-6 34 2 13-7 18 14 7 3 4 7-8 5-3 18-4 2-2 7-6 3-14 17 1 1-16 10-1-4-6-3-5 3-4-2-24 15-18 18-4-1-2 4-16 3-2-2-4 5-1-4-1 5-12 3-6-6-1-7 4-3-6 1 5-2-6 0-4-5-7-4-17 2 4-4-34 13 2-2-7-11-11-36-6-5-4-12-13-6z',
      NGO: 'M448 438l12-12 3-7-2 1 1-2 5-4-8 2-3-1 3-6-6 0 18-19 26-16 4 2 5-3 6 3 1 4 7-2 9-7-1-2 14-17 6-3 2-7 4-2 3-18 8-5-4-7-7-3-7-7 6 0 9 6 17 20 11 7-21 2-3 3 23 13 9 8 0 4 7 0 8-5 4 4 8-5 8 0 1-8-3-3 2-1 5-1-2-18 2-4 3 1 12 15 4 14 11 9 14 22 1 7 6 6 2 8-16-4-4 5-6-1-7 3-3-2-6 8-9-8-1-10-12 9-10 12 1-3-5 2-5-4-16 2-40 24-3-3-19-3-42 1z',
      BAS: 'M396 499l3-11 0 3 3-2 0-3-2 1 3-8 16-15 1 3 4-3-3 0 0-2 27-25 40-5 42-1 19 3 2 4 34-21 7-4 16-2 5 4 5-2-3 5-69 51-25 8-24 13-13 16-32 18-7 0 1-7-10 2-7 6-8-5-12 8-9-18-3-9 2 0zM440 427l9-7 2 0-6 6z',
      KAN: 'M410 538l4-1 1-8 6-5 5-2 3 3 7-6 10-2-1 7 7 0 32-18 13-16 24-13 25-8 69-51 22-23 3 1 1 10 8 7 6-8 3 2 7-3 6 1 4-5 16 4-2-8-6-6-1-7-14-22-5-4-2-24 5-1 11 12 10-1 3 4 7 0 9-12 9 7 4-1 10-17-6-11 12-3 2 18 9 7 4 19-1 3-7 1-2 7 7 2 9 10 8 17-9 22-2 3-5-1-7 6-4-3-8 3 0 16 6 6-14 18-2 30-5 3-2 8-5 3 7 8 0 10 3 7-1 6 4 10-3 3 1 3 11 9 6 13-36 2-2 4-10 4 2 5-4 9-10 10 1 4 6 5 7 1 6-2-8 13-3-2-8 1-5-9-12-3-4-8-11 4-18-3-2-6-17 1 1-3-5-3-31 1-2-3 3-7-7-9 2-23-21-2 1-5-13 0-7 2-4 9-31 0-10-10-2-13-4-4-56 1-8 3z',
      LOM: 'M407 660l3-4 5-25 14-15 3-6 0-11-13-21 5-5 0-4-13-27 11-4 55-1 4 4 2 13 10 10 31 0 4-9 20-2-1 5 21 2-2 23 7 9-3 7 2 3 31-1 5 3-1 3 17-1 2 6 18 3 11-4 4 8 12 3 6 10 7-2 3 2 8-13-6 2-7-1-6-5-1-4 9-8 4-9-1-7 10-4 2-4 36-2 3 4 24 8 2 5-1 7-8 4-10 13 1 2-9 3-12 10 1 5 2 0-45 11-2 7-21 3-5 6-12 4-20 12-33-7-53 5-26-2-8-5-64 4-12-4-19 5zM409 528l12-8 4 2-8 5-3 10-4 1z',
      SAB: 'M740 365l2-7 8-3-1-26 6-3 1-12 5-10 5-2 3-18-2-11 5-23 4 0 14-11 14 33 0-4 4 5 10 5 13 16 7 5 2 8-9 7 7 0-7 11 6 13 5 5 33 13 12 0-41 36-15 1-18 11-6 1-3-3-9 11-9 0-8-7-7 0-3-10-4-1-6-16-9-10z',
      DAL: 'M718 488l3-24 14-18-6-6 0-16 8-3 4 3 7-6 5 1 11-25 4 1 3 11 7 0 8 7 9 0 9-11 3 3 6-1 18-11 15-1 41-36-12 0-33-13-5-5-6-13 7-11 10 12 7 1 10-5 9 1 10-5 34-3 9-5 6 2-4 16 5 1-7 1-2 10-42 58-25 24-19 13-11 14-5 12-2 19-3 3 3 39-11-12-1-7-34-19-38 4-7 1-6 6-5-1z',
      IMB: 'M707 508l5-3-1-5 4-4 7-3 3 1 5-5 45-5 34 19 1 7 11 12 1 22 4 7-5 36 4 4-12 10-9 4-3-1-9 6-10 1-2-3-11 3 1-5 7-12-1-4-9 1-31-11-5-14-13-11-1-3 3-3-4-10 1-6-3-7 0-10z',
      TOU: 'M668 732l16-13 2-8 7-7 0-13 5-6 8-18-16-7-10-1 3-10 45-11-2 0-1-5 12-10 9-3-1-2 10-13 8-4 1-7-2-5 11 2 2-2 2 2-8 20 11-3 2 3 10-1 6-3 15-6 12-10-11 30-3 21-19 19-39 16-14 12-22 12-3-1-1 9 5 14 0 9 2-4 1 2-2 22-7 7-28 12-2 4 3 3 1-2-1 9-9 0-3-13 1-15z',
    },
  },
  europe: {
    w: 1000, h: 860,
    pos: { NRL: [449, 137], FRI: [474, 273], SKA: [625, 109], BLT: [798, 259], LOR: [92, 341], ARV: [248, 396], BEL: [409, 396], KAL: [744, 376], MOR: [908, 450], RUV: [744, 484], TES: [853, 592], IBE: [191, 710], LUS: [501, 633], DLM: [677, 621], EGE: [755, 729], COM: [571, 405], PAR: [392, 504], CON: [568, 513] },
    labels: [['Atlantique', 92, 592], ['Mer du Nord', 262, 250], ['Baltique', 700, 222], ['Méditerranée', 345, 760]],
    homeLabels: [['France', 250, 538]],
    homeP: 'M87 480l19-7 13 9 2-3 9 2 0-3 11 1-6-4-17-26 10 1 7 8 20 3 9-4-7-2-1-6 20-12 2-5-6-14 0-5 17-7 4 6 7 5 6-2 7 8 8 1 5 6 7-1 7 3 6 9 10 1 4-7 9 13 26 10 32 3 16 10 4-2 7 3 12-2 24 5 3 3-3 10 5 20 3 12 3 2-6 5-12-1-1 2 3 2 0 2-13 8 0 6-6 3-2 5 2 4-3 2 1 2 6-2 0-3 5-3 10 1 1 6 7 6-6 5 10 8-2 4-11 3 3 5 6 2 1 3-4 5 1 4 18 5-5 8-19 15-10 3-15-3-8-5-8 1-19-5-12 9-3 7 7 12-7-1-5 3-13-1-8-6-6 0-15-7-4 3-23-4-18-9-1 2-2-5-9-4 4-5-7-26 1-3-2-2-1 2-8-23 18 15-11-13-12-7 3 0-11-16-15-7-10-8-3-6-5-4 2-3 6 2-16-4-1-4-6-2-2-3-28-6-9-7 4-3-5-4 5 0-8-2zM424 655l3-9 12-5 1-8 2 1 1 16-7 25-7-5 1-3-3-1z',
    grat: 'M64 942l1-151-4-82-12-81-39-190-7-55-1-41 3-55 7-55 54-314M170 942l5-165-2-41-5-40-21-66-58-135-21-56-11-41-5-42 3-41 10-42 75-218 19-69 15-68M277 942l-2-163-5-53-8-39-12-38-21-52-81-157-15-44-4-28 3-28 7-28 63-135 37-95 24-82 17-82M384 942l-15-162-19-153-9-49-9-27-12-28-61-100-8-17-3-16 0-14 9-28 58-90 13-26 9-27 15-68 34-219M492 942l-10-68-24-137-6-53-1-39 13-75 1-41-6-31-6-16-36-69-5-16 1-15 13-27 62-71 12-25 2-39-13-97-3-55 1-68 4-82M598 942l-7-55-25-135-7-66 1-27 5-26 47-130 13-50 4-32-3-82 1-85-4-38-16-93-7-55-4-68 1-82M704 942l-14-160-1-52 3-37 13-64 34-89 14-46 5-30 2-30-6-57-32-134-13-80-7-108 1-137M809 942l0-108 6-80 12-66 26-96 5-42 2-42-4-57-6-42-10-41-29-95-7-41-2-109 7-205M915 942l6-136 23-190 4-69-6-97-26-163-7-68 0-96 7-205M-64 846l1128 0M-63 710l233 0 173 5 151-5 196 8 373-8M-63 573l170 3 199 13 63 1 48-2 79-9 36-2 189 9 193-11 149-2M-63 437l175 3 219 0 158-17 88-5 52 3 171 15 263 1M-63 300l506-4 171-6 205 10 245 0M-63 164l1127 0M-64 27l1128 0',
    land: 'M-30 10l11 3-4 5 2 3-2 1 4 3-6 3 0 3-5 4zM-1 379l2-3 4 0-1-4 2-4 8-3-2-2-2 3-7 1 6-14 3-3-5-1-6-5 0-3 4-2-2-3 3-2 0-2-3 0-1-11 15 1-1-3 5-8-6-1 7-13 6-3-1 8 5-9 1-2 3 3-2 6 2-4 9-1 3 11-3 5 4-1 0 3 0 3-2-3 0 8-9 8 3 29-4 16 2 3-6 2-1-2-9 11-4-2 1 5-4 4-9 3 2-6-6 2 5-7-8 2 4-9zM50 265l4-9 4 4-1 4zM50 291l9-25 9-14-8 7-5-5 6-4-1-1 6-6 1-4-2-5 5-3-2-3 3-5 8-1-2-5 3-5 5-1 4-8 9 1 26-3-6 8-19 10-2 3 3 1-7 7 14-4 25 0 4 6-27 25-15 6 7-1 4 2-1 2-15 6-6-2 11 4 8-2 7 3 6 9 0 24 9 5 10 10-4 2 5 11-8-3-8 1 7 1 11 9 1 5-7 7 4 3 7-5 11-1 13 5 1 8-3 11-8 4 0 5-9 3 3 1 1 3-9 4 21 2 1 5-7 5 0 3-14 6-19 0-12-4 2 2-2 3-9 0 1 4-15-3-6 2 0 11-8-4-6 2-3 7-7 0 9-32 14 0 7-15-10 10-9-6-5 1 2-3-4-2-6 3-5-7 11-12 2-6-3-11-6 3 4-9 7-5 5-1 3 2 1-4 4 3-4-6 6-18-5 1-4-9 4-8 8-5-8 0-7 5-4-2-4 2-3-2-2 4-1-2-1-6 10-14 0-10 5-2-3-3 2-3-8 7 5-9-7 6-6 17zM51 224l4-3-3-3 1-4 5-1 1-3 9-5 0 4-8 7 1 2-9 7zM52 234l8-6 0 10 6 1-7 6 1-5-4 0zM57 345l3-1 3 3-2 3-3 1zM64 627l0-3 5-5 9-1 1-5 9-5 14 6 22-1 28 7 16-2 30 7 10-3 2-3-7-26 1-3-2-2-1 2-8-23 18 15-11-13-12-7 3 0-11-16-15-7-10-8-3-6-5-4 2-3 6 2-16-4-1-4-6-2-2-3-28-6-9-7 4-3-5-4 5 0-8-2-2-5 19-7 13 9 2-3 9 2 0-3 11 1-6-4-17-26 10 1 7 8 20 3 9-4-7-2-1-6 20-12 2-5-6-14 0-5 36-17 19-1-16-1-3-3 7-2 13 3-7-3 4-1-6-6 30-32 49-13 28-2 10 4-3-2 3-3 12-5 27-1 2 4-3 2 4 0 7-4 4 2-3 3 16-12 22 0 8 5 6 1-4-1-6-5-11-2-1-1 6-6-9-1 18-6-5-6 4-7 4-1 4-6-16-5 9-9-1-4 7-12 18 3 10-6 6-2 4 3 3-8-4-1-13 8-12 2-7-3 2-2 13-7 28-2 16-11 16-5 2 0-4 5 3 3-1 5-7 7-1 10 15 2 0 4-9 4-6-1-10 10-9 1 2 2-17 7-2 5-13 5 8 1-2 4 6 3-10 5 28 2 11-2 0 2-13 7 19 0 28-6 19-7 14 1 11 6 9-1 6 8 20 5-1-5-19-1-3-6 17 5 50-8 8-6 33-5 14 5-6-2 10 11 11 0 6-6 0-7 8 0 3-4 4-13 0 7-4 9 10 2-14-46 6-24 13-4 15 18 6 3 12-7-3-15 4-15-4-1-4 3-6-2-5-9 2-3-3 0-1-4 1-7 10-3 0-2 6-2 21-2 1-3 50 7 4-4-1-6 6 2 4-4 10 0 4-4 23 2-10-8-15 0-9-5-3-4 3 1 0-3-3-2-22 6-6-2-14 3 1-6-4 6-9-1 2 3-6 2-2-2-24 9-19 0-8 5 3-6-5-5-3 4-5 1 2-9-14-4-1-2-3 1-4-1-2-11 2-15 2-1-7-11 1-7-3-5-1-9 6-8 4 0-2-4 15-3-2-4 6-5 22-11 20-21 16-2 2-16-14-6-1-5-32 3-7-3-5 2-3-2-3 7-7 2-1 3-6 0 1 4-4-1 3 5-9 9 8 9-10 8-5 9-17 6-4 5-7-1-7 7-8 1-6 5 4 0 0 3-6 3-6-2 1 5 3 2-8 4-5-2 1 5 5 3-4 10 2 5-5-1-1 4 6 23 8 5 6-2 17 14 5 8-17 11 11-1 1 2-4 1-1 5-22 11-15 1 14 4-5 1 4 6-3 10 3 8-2 6 2 5-9 21-3 3-26 0 1 2-4 0-9 5 3 7-5 4-35 0 5-8-11-12 9 0-3-4 5-1 1-4-11-6-9-14-2 1-2-7-4 0-1-7-7-4-1-6-5 0-5-17 1-3 5 2-1-2-14-2-6-6-3-10 0 5-5 2 2 6-5 8-10 1-9-4 5 3-11 4 3 2-2 1-36 17-41 3-4-4-10 2 3-5-20-3-11-4-5-6 4-8 16 4 9-3-9 1-6-4 3-5 15-8-35 11-7-2 8-11 6-2 9 2 14-5-15-1 11-6 3-4 11-5 0 7 6-7 8-3-25 5-9 7-24 12 4-12 15-1-12-3-3-6 16-7-12 3-4-1-2-6 1-5 3-1 47-2 7 5 0-4 16-3-7-3 2-3-4 7-3 0-14-1-2-2-6 4-30 1-6-3-1-6 9-2-9-4 0-7 14 0 15 3 19-2-39-2-4-3 2-3 5 0 6-4 10-3 4 2 13-2-11 0 6-6 33 2-3-3 13-3-33 1 6-5 16-5 13 0 13 7-11-9 3-3 9-2-7-4 6-3 13 1-1 2 2 1 13-4 8 6 17-2-1-4 15-5-4-3 6-3-6 0-6 3 3 2-3 2-20 7-4 0-3-5-5 0 1-3 22-17 22-9 1-2-6 2 4-6 15-6 8 3 8-7-10 4-7-5 12-14 8-2-6-4 27-5-20 2-1-6 5-7 14-3-6-3 9-5 385 0 14 10 7 2 0 4 10 2-7 3 23 6 8 7-4 9-4 4 11 17-2 5 13 6 0 494-3 2-1 3 4 11 0 24-10 2-9 9-8-4 2-15-17-8 19-15 0-3-7-4-12 3-10-5 2-5-7-3 13 2 3-4-8 0-5-16 2 15-5 0 0-3-2 4-10 2-9 19-10 5 1 10-3 14-9 2 1-6-2 1-11 40-2 4-7 0-4 6-3 12-10 8 8 11 1 13 16 8-3 6-16-1-14 3-7 8-12 6-15 11 2-6 14-9-16 1-4-6-17-3-9 4-7-2-12 6-8 0 1 8 8 2 3 5-10-5-5 1 5 5-1 4-6-6-6-1 0 5 5 3-7-1-2-6-10-4 2-5-8 3-3 11 16 22-5 2 1-4-6-1-2 4 2 3 3 0-13 5 16 5 10 8 7 2 1 3-1 12-12-9-12 4 4 7 5 1 2 4-8 3-5-5-6-1 10 29-10-9-3 0-3 9-1-1-1-5-7-9-4 1-1 7-8-9 3-8-14-14 7-7 6 0 5-4 27 9-1-2 6-1 1-3-18-6-3 2-9-1-12 2-4-4-1 3-4 0-9-13 9 0 0-4-9 1-12-8-11-18-10-5-4-5 4 0-3-6 3-7 1-12 5-9-10-4-13-13-41-18 17 6-18-16-12-6-11 0 0-4-15-16 0-2 9 0-9-10 2-14-6-6-6-2-14 14-3 0-3-7 1-11 8-4-2-4-5 2-7-2-26 10-3 6 5 7-9 6-1 13 22 17 6 24 11 13 15 9 26 4-8 9 53 26 10 8 4 6-4 8-7-4-5-9-10-1-8-5-7 1-6 7-3 10 15 11 3 10-14 4 0 10-6 4-4 8-8 0-2-3-1-3 5-8-1-4 7-3 0-5-15-28-19-8 0-6-5-6-10 1 2-3-10-3-8-12-14-1-11-6-21-22-6-3-3 1 1-4-8-9-4-1-2-23-17-7-10-1-18 14-16 6-14 13-10 3-15-3-8-5-8 1-16-5-15 9-2 9 8 14-2 1 3 8-20 15-19 5-5 6 4 3-5 3-12 27 4 12 9 9-13 11-4 14 2 4-12 2-6 4-10 18-6-3-6 3-33 0-7 5-10 3-5 8-5 2-9-4-7-12 4-8-4 2-11-10 0-2-13 3-8 5-17-4-9 3 4-11-2-28 5 1-3-3-9 2-2-5 5-3 2-7 3-2-4 2-3 7-5 2-3-3 1-15 5-5 5-16 0-25-5-18-3-1 1-5-3-5 3-4-2 0-2-10-5 1 1-5zM84 101l10 2-2 4-3-1 0 4zM102 890l29-16 13-22 10-28 12-4 2 1-1 4 4 8 10 7 7 1 13-3 6 2 9-5 3 7 16 2 33-21 7 1 7-9 18-9 26-2 7-5 10 0 5-3 19 0 9 6 16-6 7-6 9 5 6-2-1-3 14 6 13-2 20-12 3 1 0 5 1-3 6 1 4 12 3 1 11-9 3 5-10 19 4 8 10 7 4 11-5 15-11 15 7 11 9 1 1 5 4-3 5 6zM123 191l3-4 4 2-2 2 6 1-3 2zM172 156l8-1-1-4-2-1 7-3-1 4 5 0-4 7-8 9 3-9zM294 742l2-4 5 0-3 6zM313 724l14-9 0 5 6 1 0 3-5 9zM418 692l1-4 6 2 12-12 7 6 5 13-2 7 2 29-10-1-2 8-6-1-4-8 1-15-3-2 0-10zM424 655l3-9 12-5 1-8 2 1 1 16-7 25-7-5 1-3-3-1zM481 290l3-6 25-4 1 4-2 5-8 4zM498 877l4-1 3 3-1 2-5 0zM508 299l4-4 6-1 13 3 0 3-11 1zM513 769l4-9 5 4 4-5 4 1 11 6 39-8 2 1-8 16 0 8 6 10-3 3 0 5-2 0-11-2-11-10-5 0-18-10-12-3zM520 279l21-9 0 5 3 1 5-5-1-2 13-4 7 2-4 9-11 5 4 2 0 2-10 3-6 8-6 2-1-10-11 1-2-3 2-7zM564 581l4-8 1 6-3 10zM570 575l5-3 3 7-3 1zM572 305l8-7 9 3-3 2 3 2-1 2-6-1-4 2zM619 288l2-5 10 5-3 2zM657 254l9-21 2 0-1 2-7 24-1 1zM680 725l7-2 0 5 5 5-4 0zM686 227l6-7 6-2 4 2-4 4 2 8-10 12 1-4-4-5zM698 763l6-7 5 10zM703 157l3 0-1-4 4 1 4 2-3 5-5 0zM705 773l2-2 8 5-5 1zM746 204l19-2 7 4-8 4-8 2-6 7 3-5-6-4 2-3zM749 192l7 0 3-3 4 2 1 5-6 3-3-4zM763 745l12-4 5 6 14 3 3 12 7 2-3 4-6-3-4-8-9-1-9-9zM776 836l4-6 3 3 7-1-1 2 5 4 9-2 23 2 1 6 12-5-2 7-33 3-2-4-5-2-19-2zM822 718l1-4 10-1-3 4-1 2-2-2zM835 760l3-2-3-6 4-1 3 3-2 7-2 2zM838 735l12-5 5 7-1 2-2-1 1 2-3 1-6-3 4-3-5 3zM845 759l3-2 2-7 3 2 1 6 1-3 10-1-5 0-3-6 7-5-5-2 2-4-3-5 6-7-19 1 5-12 15-12 12-2 4 4 5 0 3-2-2-3 3-1 2 1-1 3 22-1-4-4 4-2 18-4-13-5 2-7 39 2 21-18 18-7 8 0 17 1 7-2 0 148-12-6-21 17-18 4-9-4-7-9-13-7-15-2-5 16-4-1-12 5-10-5-4-10-15-3-6 5 1-3-14 1 13-3 6-6-22 2 1-4 5-1-6-6-3-7 4-2 1-7zM871 821l2-8 10-5-4 10zM967 844l12-2 2-6 14 1 19-9-13 11 1 6 1 2-7 0-15 11-11-4zM974 -30l56 0 0 19-13-6-7 2-1-3-7-1-21-4z',
    regions: {
      NRL: 'M-30 10l11 3-4 5 2 3-2 1 4 3-6 3 0 3-5 4zM346 185l8-11 6-2 9 2 14-5-15-1 11-6 3-4 11-5 0 7 6-7 8-3-25 5-9 7-24 12 4-12 15-1-8-1-6-4 0-5 15-6-12 3-4-1-1-11 50-3 7 5 0-4 16-3-7-3 2-3-4 7-3 0-14-1-2-2-6 4-30 1-6-3-1-6 9-2-9-4 0-7 14 0 15 3 19-2-39-2-4-3 2-3 5 0 6-4 10-3 4 2 13-2-11 0 6-6 33 2-3-3 13-3-33 1 6-5 16-5 13 0 13 7-11-9 3-3 9-2-7-4 8-3 11 1-1 3 15-4 7 6 18-2-1-4 15-5-4-3 6-3-9 1-3 2 3 2-3 2-20 7-4 0-3-5-5-1 10-10 13-9 22-9 1-2-6 2 4-6 15-6 8 3 8-7-10 4-7-5 12-14 8-2-6-4 27-5-20 2-1-6 3-5 9-5 7 0-6-3 9-5 50 0-21 17 1 5-20 5 2 9-2 13-18 20 10 3 2 8-3 4-26 1-14 11 1 3-4 5 6 8-3 2 1 9 6 9-2 15 19 10-3 8-9 2 9 15 0 9-13 7-4 7 4 8-2 10-4 1-4-5-14-2-6-6-3-10 0 5-5 2 2 6-5 8-10 1-9-4 5 3-11 4 3 2-2 1-36 17-41 3-4-4-10 2 3-5-20-3-11-4-5-6 4-8 16 4 9-3-9 1-6-4 3-5 15-8-35 11zM346 157l2-5 2 1 0 6zM445 63l12-2 0 2zM503 31l6-3 5 3zM538 -1l5-5 2 1-1 3z',
      FRI: 'M422 282l9-9-1-4 7-12 18 3 10-6 6-2 4 3 3-8-4-1-13 8-12 2-7-3 15-9 28-2 16-11 18-5-4 4 2 9-7 7-1 10 15 2 2 1-3 4-8 3-6-1-10 10-9 1 2 2-17 7-2 5-13 5 8 1-2 4-38-1 2-5 4-1 4-6zM470 298l2-4 6 3zM481 290l3-6 25-4 1 4-2 5-8 4zM496 298l16-8-14 10zM508 299l4-4 6-1 13 3 0 3-11 1zM520 279l21-9 0 5 3 1 5-5-1-2 13-4 7 2-4 9-11 5 4 2 0 2-10 3-6 8-6 2-1-10-11 1-2-3 2-7zM545 294l6-4 4 1 2 2zM619 288l2-5 10 5-3 2z',
      SKA: 'M530 192l3-3 7 5 4-3 1-8-4-8 4-7 13-7 0-9-9-15 9-2 3-6-3-5-16-7 2-15-6-9-1-9 3-2-6-8 4-5-1-3 18-13 22 1 3-4-2-8-10-3 18-20 2-13-2-9 20-5-1-5 21-17 272 0-5 6 18 22 3 10-8 3 2 1-5 9 5 3-5 4 4 5 6 1-1 9 10 8-2 5-10 6 26 15 7 7-8 13-43 32-35 22-10-1-14 3 1-6-4 6-9-1 2 3-6 2-2-2-24 9-19 0-9 5 4-6-6-5-1 4-6 1 2-9-14-4-1-2-3 1-4-1-2-11 2-15 2-1-7-11 1-8-5-10 7-11 4 0-2-4 15-3 0-5 26-15 20-21 16-2-1-2 3-2-3-3 3-9-14-6-1-5-32 3-7-3-5 2-3-2-3 7-7 2-1 3-6 0 1 4-4-1 3 5-9 9 8 9-10 8-5 9-17 6-4 5-7-1-7 7-8 1-6 5 4 0 0 3-6 3-6-2 1 5 3 2-8 4-5-2 1 5 5 3-4 10 2 5-5-1-1 4 6 23 8 5 6-2 12 9 0 3 5 2 5 7-7 7-10 5 11-1 1 2-4 1-1 5-22 11-15 1 14 4-5 1 4 6-3 10 3 8-2 6 2 5-10 23-28 1 1 2-4 0-9 5 3 7-5 4-35 0 5-8-11-12 9 0-3-4 5-1 1-4-11-6-9-14-2 1-2-7-4 0-1-7-7-4-1-6-5 0zM657 254l9-21 2 0-1 2-7 24-1 1zM686 227l6-7 6-2 4 2-4 4 2 8-10 12 1-4-4-5zM746 156l5-2 0 4 1 1-2 0z',
      BLT: 'M740 248l7-19 13-4 15 18 6 3 11-5 1-4-2-16 3-11-3-2-5 3-6-2-5-9 2-3-3 0-1-4 1-7 10-3 0-2 6-2 21-2 1-3 30 6 20 1 2-2 3 2-15 17 2 15 7 10-5 2-4 7 11 6-2 13 4-1 7 9 2 11-5 1-5 8-11-1-9 4 0 9 6 2-2 4-6 0-1 3-6 3-1 15 5 5-4 0-2-4-9 4-1 5-7 2-14-2-5-7-11-5-3-14-6-5-8-1-16-6-10-27zM746 204l19-2 7 4-8 4-8 2-6 7 3-5-6-4 2-3zM749 192l7 0 3-3 4 2 1 5-6 3-3-4z',
      LOR: 'M-1 379l2-3 4 0-1-4 2-4 8-3-2-2-2 3-7 1 6-14 3-3-5-1-6-5 0-3 4-2-2-3 3-2 0-2-3 0-1-11 15 1-1-3 5-8-6-1 7-13 6-3-1 8 5-9 1-2 3 3-2 6 2-4 9-1 3 11-3 5 4-1 0 3 0 3-2-3 0 8-9 8 3 29-4 16 2 3-6 2-1-2-9 11-4-2 1 5-4 4-9 3 2-6-6 2 5-7-8 2 4-9zM44 282l5-7 0 6-3 3 0-5zM50 265l4-9 4 4-1 4zM50 291l9-25 9-14-8 7-5-5 6-4-1-1 6-6 1-4-2-5 5-3-2-3 3-5 8-1-2-5 3-5 5-1 4-8 9 1 26-3-6 8-19 10-2 3 3 1-7 7 14-4 25 0 4 6-27 25-15 6 7-1 4 2-1 2-15 6-6-2 11 4 8-2 7 3 6 9 0 24 9 5 10 10-4 2 5 11-8-3-8 1 7 1 11 9 1 5-7 7 4 3 7-5 11-1 13 5 1 8-3 11-8 4 0 5-9 3 3 1 1 3-9 4 21 2 1 5-7 5 0 3-14 6-19 0-12-4 2 2-2 3-9 0 1 4-15-3-6 2 0 11-8-4-6 2-3 7-7 0 9-32 14 0 7-15-10 10-9-6-5 1 2-3-4-2-6 3-5-7 11-12 2-6-3-11-6 3 4-9 7-5 5-1 3 2 1-4 4 3-4-6 6-18-5 1-4-9 4-8 8-5-8 0-7 5-4-2-4 2-3-2-2 4-1-2-1-6 10-14 0-10 5-2-3-3 2-3-8 7 5-9-7 6-6 17zM51 224l4-3-3-3 1-4 5-1 1-3 9-5 0 4-8 7 1 2-9 7zM52 234l8-6 0 10 6 1-7 6 1-5-4 0zM56 326l6-9-1 6zM56 288l1-6 3 0-1 6zM57 345l3-1 3 3-2 3-3 1zM112 421l3-3 4 3-2 2zM123 191l3-4 4 2-2 2 6 1-3 2zM172 156l8-1-1-4-2-1 7-3-1 4 5 0-4 7-8 9 3-9zM187 147l3-3 2 0-1 2-3 4z',
      ARV: 'M189 406l19-10 19-1-16-1-3-3 7-2 13 3-7-3 4-1-6-6 30-32 49-13 28-2 10 4-16 17-12 2 0 3 9 2-4 5-9 4 2 3-2 2-27 4 8 9-2 10 2 1-7 5 7 3 0 6 10 5 0 2 6 3 3 4-4 3 1 5 9 8 10 3 3 12-28-2-26-10-9-13-4 7-11-1-5-9-7-3-7 1-5-6-8-1-7-8-6 2-7-5z',
      BEL: 'M277 382l8-4 6 2 14-4-1-4 9-4 4-5-9-2 0-3 12-2 16-17-3-2 11-7 31-2 2 4-3 2 4 0 7-4 4 2-3 3 16-12 22 0 8 5 6 1-4-1-6-5-13-2 7-7-8-2 17-5-5-6 2-2 42 2 2 2-2 2-8 3 28 2 11-2-4 4-9 3 2 2 17 0 28-6 19-7 14 1 11 6 9-1 3 7 13 3 4 13-10 8 16 9-2 4 7 7-4 6 5 9 7 3 3 5-2 4-6 7-5-1-2-4-10-2 4 4-30 5-25 9-18 1-12 8-7-4-2 1 6 5 15 6-5 6 11 9 11 4 31 18-4 8-8-1-4 8-22 9 6 7-3 6 5 2-2 6-10-6-6 1-9-2-1 4-14 2-20 9-5-3-12 0-1 7-5 3 0-3-10-4-8 3-27-3-3 3 4 1-2 2-19 3-6-2-8-32 3-10-3-3-24-5-12 2-7-3-4 2-20-11-3-12-10-3-9-8-1-5 4-3-3-4-15-10-1-6-7-4 7-4-2-2 3-6zM410 302l7-3 10 0zM572 305l8-7 9 3-3 2 3 2-1 2-6-1-4 2zM591 312l12 3 0 2-6 0-3 0z',
      KAL: 'M598 341l10-8-4-13 10 3-1-5-10-1 0-2 55-7 8-6 16-3 22-1 9 4-6-2 4 6 9 5 11-1 58 6 10 6 17 31 3 9-7 5-2 6 10 7 1 12 14 22-2 1 3 5-1 6-5 1-17 23 2 11 3 3-3 1-14-6-2-4-11-3-6 1-2 2-13-2-7 5-6-1 0-5-7-7-7 5-4 0-9-16-13-6-5 1-6-6 3 0 0-4-7 1-14-7 2 6-9 3-12-11 6-4-4-3-8 1-31-15 0 4-5 0 6-10-4-6-6-2-5-9 4-6-7-7 2-4z',
      MOR: 'M803 483l8-19 6 1-2-4-1-13 16-21 5-1 1-4-3-7 2-2-10-13-3-8 6 1 5-8 27-1 22 5 4 4 7 1 0 2 3-3 5 0 11 4 5-5 6 7 14-3 8 6-1-11 6-10 21 0 5-7 7 1 18-2 13 15-5 3 2 11 16 2 3 4 0 131-3 2-1 3 2 9-4-6-4 0-11-7-6 5-3-4-12 3-10-5 2-5-7-3 13 2 3-4-8 0-5-16 2 15-5 0 0-3-2 4-10 2-9 19-10 5 1 12-5-4-10 3-1 2-7-2-4-7 3-24-3-15-22-33-11 0-2 6-13 3-10 6-8-6-6 1-21-5-6 4-2-4z',
      RUV: 'M515 411l9 4 12-8 18-1 25-9 30-5-4-4 10 2 6 5 8-1 0-4 9 3 4 5 18 7 11 1 0 3-5 2 12 11 9-3-2-6 14 7 7-1 0 4-3 0 6 6 5-1 13 6 9 16 4 0 7-5 7 7 0 5 6 1 7-5 13 2 2-2 6-1 11 3 2 4 10 5-8 19 12 9 2 4-6 6-4 0-11 8-17 24-16 14-22 4-19-1-9 4-18 3-10 4-15-2-11-7-7-11-8-6-2-11-5-1 12-4 4-12 8-4-6-5 6-2 5 2 8 0 0-5 5-5-4-12 4-7-1-4-9-3-14 0-6-4-25-6-3 8-5 0-4 5-21 0-15-12-4 0-19-12-11-4-11-9 5-6-15-6z',
      TES: 'M741 552l26-6 12-12 17-24 27-18 21 5 7-1 7 6 10-6 13-3 2-6 11 0 22 33 3 10-3 29 4 7 7 2 1-2 10-3 5 4-3 12-9 2 1-6-2 1-11 40-2 4-7 0-4 6-3 12-10 8 8 11 0 2-5 0-5 2-5-5-15 4-8 7-5 0-1 9-6 3-16 2-11-2-6-5-43 8 5-11-3-6-12-8 6-4 2-10 7-2 10-9-10-6-3-9 4-6 10-7-4-7 7-4-5-2-13 5-18-6 6-3-5-3 6-4-17-9 3-8z',
      IBE: 'M64 627l0-3 5-5 9-1 1-5 9-5 14 6 22-1 28 7 16-2 13 4 2-2 12 4 10-1 10 5 2 5 1-2 30 13 13 0 0-3 23 7 8 6 25-1 2 4-2 1 3 8-2 2-18 13-19 5-5 6 4 3-5 3-12 27 4 12 8 7 0 3-9 7-5 7-2 10 2 4-12 2-6 4-9 17-7-2-6 3-33 0-7 5-10 3-9 10-10-4-8-15 5-5-4 2-11-10 0-2-13 3-8 5-17-4-9 3 4-11-2-28 5 1-3-3-9 2-2-5 5-3 2-7 3-2-4 2-3 7-5 2-3-3 1-15 5-5 5-16 0-25-5-18-3-1 1-5-3-5 3-4-2 0-2-10-5 1 1-5zM294 742l2-4 5 0-3 6zM313 724l14-9 0 5 6 1 0 3-5 9zM340 714l7 0 2 5z',
      LUS: 'M384 587l11-3 2-4-10-8 6-5 19-1 16-15 1 5 9 3-1 2 5 3 0-4 7-14 3 0 3 5 10-3 4 2-1-10 9 0 0-9 14 1 7-7 27-6-1 5 5 6 36 4-11 8 6 2-6 6 3 0-2 5 6 6-5 0 2-1-2-4-5 2-7-2-26 10-3 6 5 7-5 4-2-1-3 11 1 7 21 15 6 24 3 5 16 14 13 5 20 2-8 9 53 26 10 8 4 6-4 8-7-4-5-9-10-1-8-5-7 1-6 7-3 10 15 11 3 10-14 4 0 10-6 4-4 8-8 0-3-6 4-4 1-9 6-2 0-5-15-28-19-8 0-6-5-6-10 1 2-3-10-3-8-12-14-1-11-6-21-22-6-3-3 1 1-4-8-9-4-1-2-23-17-7-10-1-18 14-11 4 4-10-7 1-10-4-1-4 4-5-1-3-6-2zM418 692l1-4 6 2 12-12 7 6 5 13-2 7 2 29-10-1-2 8-6-1-4-8 1-15-3-2 0-10zM513 769l4-9 5 4 4-5 4 1 11 6 39-8 2 1-8 16 0 8 6 10-3 3 0 5-2 0-11-2-11-10-5 0-18-10-12-3z',
      DLM: 'M549 575l3-12 7 3 4-3 9 1 8-4 4 5 14 1 2-8 13-5 2-8 19-5 5-5 10 4 10 14 15 8 13 1 37-12 15 1 12 12-3 8 17 9-6 4 5 3-6 3 18 6 13-5 5 2-7 4 4 7-10 7-4 6 3 9 5 2 4 6-9 7-7 2-2 10-6 4 12 8 3 5-5 11-10 6-17 1-13 7-17 1 0 7-5 3-5 9-10 3 2 5-7 3-4-1-3-8-10-5-4-5 4 0-3-6 3-7 1-12 5-9-10-4-13-13-41-18 17 6-18-16-12-6-11 0 0-4-15-16 0-2 9 0-9-10 2-14-6-6-6-2-14 14-3 0zM564 581l4-8 1 6-3 10zM570 575l5-3 3 7-3 1zM608 637l11 4-9-1z',
      EGE: 'M680 725l7-2 0 5 5 5-4 0zM689 725l7 1 4-3-2-5 10-3 5-9 6-4-1-6 17-1 13-7 14 0 7-2 2-4 24-3 12-4 12-1 5 5 11 2 16-2 6-3 0-7 4-2 7 3 0 5-8 5-1 7-7 6-22-5-9 4-7-2-12 6-8 0 1 8 8 2 3 5-10-5-5 1 5 5-1 4-6-6-6-1 0 5 5 3-7-1-2-6-10-4 2-5-8 3-3 11 7 11 9 11-5 2 1-4-6-1-2 4 2 3 3 0-13 5 16 5 10 8 7 2 1 14-2 1-10-9-12 4 3 7 7 4-8 4-5-5-6-1 10 29-10-9-3 0-3 9-9-15-4 1-1 7-4-4-4-5 3-8-14-14 7-7 6 0 5-4 27 9-1-2 6-1 1-3-18-6-3 2-9-1-12 2-4-4-4 4-10-14 9 0 0-4-10 0-11-7zM698 763l6-7 5 10zM703 754l4-7 1 5zM705 773l2-2 8 5-5 1zM763 745l12-4 5 6 14 3 3 12 7 2-3 4-6-3-4-8-9-1-9-9zM776 836l4-6 3 3 7-1-1 2 5 4 9-2 23 2 1 6 12-5-2 7-33 3-2-4-5-2-19-2zM806 769l6 1 1 4-1 2zM813 698l3-4 4 1-1 3zM820 792l4-3 1 4-3 3zM822 718l1-4 10-1-3 4-1 2-2-2zM835 760l3-2-3-6 4-1 3 3-2 7-2 2zM838 735l12-5 5 7-1 2-2-1 1 2-3 1-6-3 4-3-5 3zM850 774l5-2 5 2-5 2zM856 831l3-6 0 7-2 4zM871 821l2-8 10-5-4 10zM967 844l12-2 2-6 14 1 19-9-13 11 1 6 1 2-7 0-15 11-11-4z',
    },
  },
};

/* ── Composant ─────────────────────────────────────────────── */

type Phase = 'brief' | 'play' | 'ai' | 'turn' | 'final' | 'over';
type Mode = 'inf' | 'coup' | 'event' | null;
interface NodeView {
  i: number; left: number; top: number; name: string; stab: number; pivot: boolean;
  p: number; r: number; ctrl: Side | null; anchor: Side | ''; pend: number; can: boolean; cost2: boolean; odds: string; evt: boolean; dim: boolean;
  flash: string; shield: Side | ''; label: string; focus: boolean; pick: boolean; inst: boolean;
}
interface RegionView { i: number; d: string; cls: string; fill: string }
interface CardView { uid: number; id: CardId; icon: string; name: string; ops: number; side: Side | 'n'; owner: string; stamp: string; on: boolean; long: boolean }
interface MapArt {
  w: number; h: number; pos: Record<string, [number, number]>; labels: [string, number, number][]; homeLabels: [string, number, number][];
  homeP?: string; homeR?: string; grat: string; land: string; regions: Record<string, string>;
}

const LEVELS = ['rien', 'présence', 'domination', 'contrôle'];
const SIDE_CLASS: Record<Side, string> = { p: 'c-p', r: 'c-r' };
let INST = 0;

/** Pile de jetons : un seul élément, les jetons du dessus en ombres portées */
function stackShadow(n: number): string {
  const out = ['0 1px 0 var(--cd)'];
  for (let k = 1; k < Math.min(n, 4); k++) out.push(`0 ${-2.6 * k}px 0 var(--c)`, `0 ${-2.6 * k + 1}px 0 var(--cd)`);
  return out.reverse().join(', ');
}
const STACK = [0, 1, 2, 3, 4].map(stackShadow);

/* Cadran de la jauge de tension (demi-cercle, centre 60/60, rayon 44) */
const GA = (v: number, r: number): [number, number] => { const t = Math.PI * (1 - v / MAXT); return [60 + r * Math.cos(t), 60 - r * Math.sin(t)]; };
const GAUGE_SEGS = Array.from({ length: MAXT }, (_, k) => {
  const [x0, y0] = GA(k + 0.04, 44), [x1, y1] = GA(k + 0.96, 44);
  return { d: `M${x0.toFixed(1)} ${y0.toFixed(1)}A44 44 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`, c: 's' + k };
});
const GAUGE_TICKS = Array.from({ length: MAXT + 1 }, (_, k) => {
  const [x0, y0] = GA(k, 35), [x1, y1] = GA(k, 39), [tx, ty] = GA(k, 27);
  return { k, x0, y0, x1, y1, tx, ty: ty + 3 };
});
const GAUGE_MINOR = Array.from({ length: MAXT * 4 }, (_, k) => k / 4).filter(v => v % 1).map(v => { const [x0, y0] = GA(v, 36.5), [x1, y1] = GA(v, 39); return `M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}`; }).join('');

@Component({
  selector: 'app-echiquier-game',
  template: `
    @if (game(); as g) {
    <div class="eq">
      <div class="head">
        <div class="h-turn">
          <span class="lab">Tour</span>
          <span class="big mono">{{ g.turn }}<small>/{{ turns }}</small></span>
          @if (phase() === 'play' || phase() === 'ai') { <span class="sub">action {{ Math.min(g.acted + 1, rounds) }}/{{ rounds }}</span> }
        </div>
        <div class="vp" [attr.aria-label]="'Points de victoire : France ' + g.vpP + ', ' + V.rival.name + ' ' + g.vpR">
          <span class="lab">Points de victoire</span>
          <span class="score">
            <span class="fr"><i class="flag fr" aria-hidden="true"></i><b class="mono">{{ g.vpP }}</b></span>
            <span class="sep">–</span>
            <span class="rv"><b class="mono">{{ g.vpR }}</b><i class="flag rv" aria-hidden="true"></i></span>
          </span>
          <span class="names"><span>France</span><span>{{ V.rival.name }}</span></span>
        </div>
        <div class="tension" role="img" [attr.aria-label]="cap(V.words.tension) + ' : ' + g.tension + ' sur ' + maxT + (g.tension + 1 >= maxT ? ', le prochain ' + V.words.coup + ' déclenche la crise' : '')">
          <svg class="gauge" viewBox="0 0 120 70" aria-hidden="true">
            <path class="bezel" d="M6 62A54 54 0 0 1 114 62Z" />
            <path class="face" d="M10 61A50 50 0 0 1 110 61Z" />
            @for (s of gaugeSegs; track s.c; let k = $index) { <path [attr.d]="s.d" [attr.class]="'seg ' + s.c + (k < g.tension ? ' lit' : '')" /> }
            <path class="minor" [attr.d]="gaugeMinor" />
            @for (t of gaugeTicks; track t.k) {
              <line [attr.x1]="t.x0" [attr.y1]="t.y0" [attr.x2]="t.x1" [attr.y2]="t.y1" class="tick" />
              <text [attr.x]="t.tx" [attr.y]="t.ty" class="tk" [class.hot]="t.k === maxT">{{ t.k }}</text>
            }
            <text x="60" y="47" class="gl">{{ V.words.tension }}</text>
            <g class="needle" [style.transform]="'rotate(' + (g.tension / maxT * 180) + 'deg)'"><path d="M60 58.2 16 60 60 61.8Z" /></g>
            <circle cx="60" cy="60" r="4.2" class="hub" />
            <path class="glass" d="M14 56A46 46 0 0 1 106 56 50 34 0 0 0 14 56Z" />
          </svg>
        </div>
      </div>
      <p class="tnote" [class.hot]="g.tension + 1 >= maxT">{{ tensionNote() }}</p>

      <ol class="sched" aria-label="Calendrier des bilans">
        @for (s of schedView(); track s.turn) {
          <li [class.now]="s.now" [class.done]="s.done" [class.won]="s.res === 'p'" [class.lost]="s.res === 'r'" [attr.aria-label]="s.aria">
            <b class="mono">T{{ s.turn }}</b><i class="zs" [class.all]="s.all" [style.background]="s.tint" aria-hidden="true"></i><span class="sn">{{ s.label }}</span>@if (s.score) { <span class="mono sc">{{ s.score }}</span> }
          </li>
        }
      </ol>

      <figure class="sheet">
        <figcaption class="mapbar">
          <span class="ttl">Carte de situation · {{ mapTitle }}</span>
          <span class="key" aria-hidden="true"><i class="k kp"></i>France <i class="k kr"></i>{{ V.rival.name }} <i class="k kh"></i>avance</span>
        </figcaption>
        <div class="map" [style.aspect-ratio]="A.w + ' / ' + A.h" role="group" [attr.aria-label]="'Carte : ' + V.nodes.length + ' ' + V.words.countries">
          <svg class="base" [attr.viewBox]="'0 0 ' + A.w + ' ' + A.h" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <radialGradient [attr.id]="uid + '-sea'" cx=".5" cy=".45" r=".75"><stop offset="0" class="sea1" /><stop offset="1" class="sea2" /></radialGradient>
              <clipPath [attr.id]="uid + '-land'"><path [attr.d]="A.land" /></clipPath>
              <filter [attr.id]="uid + '-relief'" x="0" y="0" [attr.width]="A.w" [attr.height]="A.h" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency=".011" numOctaves="5" seed="11" result="n" />
                <feDiffuseLighting in="n" surfaceScale="5" diffuseConstant="1" lighting-color="#fff"><feDistantLight azimuth="225" elevation="38" /></feDiffuseLighting>
                <feComponentTransfer><feFuncR type="linear" slope="1.5" intercept=".04" /><feFuncG type="linear" slope="1.5" intercept=".04" /><feFuncB type="linear" slope="1.5" intercept=".04" /></feComponentTransfer>
              </filter>
            </defs>
            <rect [attr.width]="A.w" [attr.height]="A.h" [attr.fill]="'url(#' + uid + '-sea)'" />
            <path class="grat" [attr.d]="A.grat" />
            <path class="shelf" [attr.d]="A.land" />
            <path class="shelf2" [attr.d]="A.land" />
            <path class="land" [attr.d]="A.land" />
            <g [attr.clip-path]="'url(#' + uid + '-land)'"><rect class="relief" [attr.width]="A.w" [attr.height]="A.h" [attr.filter]="'url(#' + uid + '-relief)'" /></g>
          </svg>
          <svg class="over" [attr.viewBox]="'0 0 ' + A.w + ' ' + A.h" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <pattern [attr.id]="uid + '-hp'" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" class="hb" /><rect width="3.2" height="9" class="hp" /></pattern>
              <pattern [attr.id]="uid + '-hr'" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="9" height="9" class="hb" /><rect width="3.2" height="9" class="hr" /></pattern>
              <pattern [attr.id]="uid + '-homep'" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="7" class="hp" /></pattern>
              <pattern [attr.id]="uid + '-homer'" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="7" class="hr" /></pattern>
            </defs>
            @if (A.homeP) { <path class="home hm-p" [attr.d]="A.homeP" [style.fill]="'url(#' + uid + '-homep)'" /> }
            @if (A.homeR) { <path class="home hm-r" [attr.d]="A.homeR" [style.fill]="'url(#' + uid + '-homer)'" /> }
            @for (r of regions(); track r.i) { <path [attr.d]="r.d" [attr.class]="r.cls" [style.fill]="r.fill" (click)="tapNode(r.i)" /> }
            @for (l of linkPaths; track $index) { <path class="ln" [attr.d]="l" /> }
            @for (t of A.labels; track $index) {
              <text class="sea-l" [attr.x]="t[1]" [attr.y]="t[2]">@for (ln of t[0].split('|'); track $index; let k = $index) { <tspan [attr.x]="t[1]" [attr.dy]="k ? 24 : 0">{{ ln }}</tspan> }</text>
            }
            @for (t of A.homeLabels; track $index) { <text class="home-l" [attr.x]="t[1]" [attr.y]="t[2]">{{ t[0] }}</text> }
            <g class="rose" [attr.transform]="'translate(' + (A.w - 46) + ' 52)'">
              <circle r="25" class="rose-c" /><path d="M0-31 5.5 0 0 5 -5.5 0Z" class="rose-n" /><path d="M0 31 5.5 0 0-5 -5.5 0Z" class="rose-s" /><path d="M-25 0H25" class="rose-l" />
              <text y="-35" class="rose-t">N</text>
            </g>
          </svg>
          @for (n of nodes(); track n.i) {
            <button type="button" class="node" [class]="'node ' + (n.ctrl ? sideClass[n.ctrl] : '') + ' ' + n.flash" [class.can]="n.can" [class.tgt]="!!n.odds" [class.evt]="n.evt" [class.dim]="n.dim" [class.focus]="n.focus" [class.pick]="n.pick" [class.inst]="n.inst"
                    [style.left.%]="n.left" [style.top.%]="n.top" [disabled]="phase() === 'over'"
                    (click)="tapNode(n.i)" [attr.aria-label]="n.label">
              <span class="nm">{{ n.name }}</span>
              <span class="infs">
                <span class="ip" [class.zero]="!n.p"><i class="stk" [style.box-shadow]="stack[Math.min(n.p, 4)]"></i><b class="mono">{{ n.p }}</b></span>
                <span class="st" aria-hidden="true">{{ n.stab }}</span>
                <span class="ir" [class.zero]="!n.r"><b class="mono">{{ n.r }}</b><i class="stk" [style.box-shadow]="stack[Math.min(n.r, 4)]"></i></span>
              </span>
              @if (n.pivot) { <span class="pv" aria-hidden="true">★</span> }
              @if (n.anchor) { <span class="anc" [class]="'anc ' + n.anchor" aria-hidden="true"></span> }
              @if (n.shield) {
                <svg class="shd" [class]="'shd ' + n.shield" viewBox="0 0 10 12" aria-hidden="true"><path d="M5 .6 9.4 2.3v3.6c0 2.8-1.9 4.6-4.4 5.6C2.5 10.5.6 8.7.6 5.9V2.3Z" /></svg>
              }
              @if (n.pend) { <span class="badge add mono">+{{ n.pend }}</span> }
              @else if (n.odds) { <span class="badge odd mono">{{ n.odds }}</span> }
              @else if (n.cost2) { <span class="badge two mono">×2</span> }
            </button>
          }
        </div>
      </figure>
      <div class="zones" role="toolbar" aria-label="Zones">
        @for (z of V.zones; track z.id; let zi = $index) {
          <button type="button" class="zchip" [class.on]="zoneFocus() === zi" (click)="tapZone(zi)" [style.border-color]="z.tint"
                  [attr.aria-label]="'Zone ' + z.name + ' : ' + zoneLine(zi)"><i class="zs" [style.background]="z.tint" aria-hidden="true"></i>{{ z.name }}</button>
        }
      </div>

      @switch (phase()) {
        @case ('brief') {
          <div class="panel brief">
            <p class="memo-h"><span>Note de situation</span><span class="stamp">Diffusion restreinte</span></p>
            <p><b>{{ def().title }}.</b> {{ V.brief }} <b>Objectif :</b> plus de points de victoire (PV) que {{ V.rival.the }} au bout de huit tours.</p>
            <ul>
              <li>Chaque tour, {{ hand }} cartes en main : vous en jouez {{ rounds }}, {{ V.rival.the }} répond après chacune.</li>
              <li><b>Opérations</b> : placez autant de points d’{{ V.words.inf }} dans les {{ V.words.countries }} où vous êtes présent, leurs voisins ou vos accès directs (<i class="anc p inline" aria-label="drapeau français"></i>) ; entrer chez un {{ V.words.country }} contrôlé par l’adversaire coûte 2.</li>
              <li><b>{{ cap(V.words.coup) }}</b> : dé + opérations contre 2 × {{ V.words.stab }} ; l’excédent retire l’{{ V.words.inf }} adverse. {{ cap(V.words.tension) }} +1.</li>
              <li><b>Événement</b> français ou neutre : son effet, à la place des opérations. Une carte {{ V.rival.of }} jouée pour ses opérations déclenche l’événement adverse ; une fois par tour, vous pouvez la classer sans suite.</li>
              <li><b>Contrôle</b> : {{ V.words.inf }} ≥ {{ V.words.stab }} et avance ≥ {{ V.words.stab }} (territoire en couleur pleine ; hachures : simple avance).</li>
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
            <p class="memo-h"><span>Rapport final</span><span class="stamp" [class.ok]="won()">{{ won() ? 'Succès' : 'Échec' }}</span></p>
            <p class="verdict" [class.good]="won()" [class.bad]="!won()"><b>{{ verdict() }}</b></p>
            <p class="small">France <b class="mono">{{ g.vpP }}</b> PV — {{ V.rival.name }} <b class="mono">{{ g.vpR }}</b> PV</p>
          </div>
        }
        @default {
          @if (theirs(); as t) {
            <div class="panel foe" aria-live="polite">
              <p class="dep mono">Dépêche · {{ V.rival.name }}</p>
              <p><b>{{ V.rival.The }}</b> joue « {{ cardName(t.card) }} »{{ howLabel(t) }} : {{ clean(t.text) }}.</p>
              @if (t.trig) { <p class="small good">Votre événement se déclenche : {{ t.trig.fx.text }}.</p> }
              @if (aiNote()) { <p class="small muted">{{ aiNote() }}</p> }
            </div>
          } @else if (phase() === 'ai') {
            <div class="panel foe"><p class="dep mono">Dépêche · {{ V.rival.name }}</p><p class="muted">{{ V.rival.The }} réfléchit…</p></div>
          }
          @if (mine(); as m) {
            <p class="mine small" [class.bad]="m.coup && !m.coup.ok" aria-live="polite">Vous : {{ cardName(m.card) }} — {{ clean(m.text) }}.@if (m.trig) { <span class="bad"> En retour, {{ V.rival.the }} : {{ m.trig.fx.text }}.</span> }</p>
          }

          <div class="hand" role="toolbar" aria-label="Vos cartes">
            @for (c of cards(); track c.uid) {
              <button type="button" class="card" [class.on]="c.on" [class.foe]="c.side === 'r'" [class.neu]="c.side === 'n'" [disabled]="phase() !== 'play'"
                      (click)="pickCard(c.uid)" [attr.aria-pressed]="c.on" [attr.aria-label]="c.name + ', ' + c.ops + ' opérations, ' + c.owner">
                <span class="tab mono">OPS <b class="ops">{{ c.ops }}</b></span>
                <span class="ic" aria-hidden="true">{{ c.icon }}</span>
                <span class="cn mono" [class.long]="c.long">{{ c.name }}</span>
                <span class="ow" aria-hidden="true">{{ c.stamp }}</span>
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
                  <p><b>Influence</b> : reste <b class="mono">{{ left() }}</b> point{{ left() > 1 ? 's' : '' }}. Touchez les {{ V.words.countries }} entourés de tirets bleus (×2 : contrôlé par l’adversaire).</p>
                  <div class="row">
                    <button type="button" class="btn small" (click)="cancelMode()" aria-label="Annuler">✕</button>
                    <button type="button" class="btn small" [disabled]="!pend().at.length" (click)="undoPoint()">↶ Retirer</button>
                    <button type="button" class="btn primary small" [disabled]="!pend().at.length" (click)="validateInf()">Valider ▸</button>
                  </div>
                }
                @case ('coup') {
                  @if (coupAt() !== null) {
                    @let i = coupAt()!;
                    <p><b>{{ cap(V.words.coup) }} {{ V.nodes[i].at }}</b> : il faut {{ 2 * V.nodes[i].stab + 1 }} ou plus avec le dé + {{ opsSel() }} → <b class="mono">{{ pct(i) }}</b> de réussite.
                      {{ cap(V.words.tension) }} {{ g.tension }} → {{ g.tension + 1 }}.</p>
                    @if (g.tension + 1 >= maxT) { <p class="bad"><b>Attention : ce {{ V.words.coup }} déclenchera la {{ V.words.crisis }}, partie perdue.</b></p> }
                    <div class="row">
                      <button type="button" class="btn small" (click)="coupAt.set(null)" aria-label="Annuler">✕</button>
                      <button type="button" class="btn primary small" [class.danger]="g.tension + 1 >= maxT" (click)="confirmCoup()">Lancer le dé</button>
                    </div>
                  } @else {
                    <p>Touchez un {{ V.words.country }} cible (chances affichées en rouge). Il faut y trouver de l’{{ V.words.inf }} adverse.</p>
                    <div class="row"><button type="button" class="btn small" (click)="cancelMode()">✕ Retour</button></div>
                  }
                }
                @case ('event') {
                  <p>{{ cardDescOf(c.id) }} <b>Touchez {{ m.target === 'zone' ? 'un ' + V.words.country + ' de la zone visée' : 'le ' + V.words.country + ' visé' }}</b> (encadré d’or).</p>
                  <div class="row"><button type="button" class="btn small" (click)="cancelMode()">✕ Retour</button></div>
                }
                @default {
                  <p><b>{{ cardName(c.id) }}</b> · {{ opsSel() }} opération{{ opsSel() > 1 ? 's' : '' }}</p>
                  <p class="small">@if (m.event) { <b>Événement {{ m.side === 'p' ? 'français' : m.side === 'r' ? V.rival.of : 'neutre' }}</b> : }{{ cardDescOf(c.id) }}</p>
                  @if (m.side === 'r') { <p class="small bad">Jouée pour ses opérations, elle déclenche cet événement pour {{ V.rival.the }}.</p> }
                  <div class="modes">
                    <button type="button" class="btn small" (click)="setMode('inf')">Influence · {{ opsSel() }}</button>
                    <button type="button" class="btn small" [disabled]="!coupCount()" (click)="setMode('coup')"
                            [attr.aria-label]="cap(V.words.coup) + (coupCount() ? '' : ' : aucune cible')">{{ V.words.coupShort }}@if (!coupCount()) { <span class="muted"> (aucune cible)</span> }</button>
                    @if (m.event && m.side !== 'r') {
                      <button type="button" class="btn small" [disabled]="!eventOk()" (click)="setMode('event')">Événement</button>
                    }
                    @if (m.side === 'r') {
                      <button type="button" class="btn small" [disabled]="g.classed.p" (click)="classCard()">Classer sans suite@if (g.classed.p) { <span class="muted"> (déjà fait)</span> }</button>
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
          <p class="memo-h"><span>{{ phase() === 'final' ? 'Bilan final' : 'Fin du tour ' + g.turn }}</span></p>
          @if (theirs(); as t) { <p class="small muted">Dernier coup {{ V.rival.of }} : {{ cardName(t.card) }}, {{ clean(t.text) }}.</p> }
          @if (turnRep()?.length) {
            <table class="scores">
              <thead><tr><th scope="col">Zone</th><th scope="col"><i class="flag fr" aria-hidden="true"></i> France</th><th scope="col"><i class="flag rv" aria-hidden="true"></i> {{ V.rival.name }}</th></tr></thead>
              <tbody>
                @for (z of turnRep()!; track z.zone) {
                  <tr>
                    <th scope="row"><i class="zs" [style.background]="V.zones[z.zi].tint" aria-hidden="true"></i>{{ V.zones[z.zi].name }}</th>
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
    :host { display: block; width: 100%;
      --fr: #2f6fb3; --fr-d: #1d4f86; --fr-l: #dce8f6; --rv: #c0392b; --rv-d: #8e2a20; --rv-l: #f8dedb; --gold: #d7a21e;
      --sea-1: #c3d5de; --sea-2: #9cb7c6; --grat: rgba(255,255,255,.55); --land: #ece4cf; --coast: #6d8696; --shelf: #d5e5ec; --border: rgba(255,253,245,.95);
      --lbl: #4c6c80; --home-ink: #1d2c44; --reg-o: .24; --ctl-o: .52;
      --pl: rgba(255,253,246,.94); --pl-b: #a99f87; --pl-ink: #20252d;
      --paper: #f7f2e5; --paper-2: #ede4cf; --paper-ink: #2a2924; --paper-rule: rgba(60,80,130,.09); --stamp: #b3261e;
      --hud: #1a2029; --hud-2: #232b37; --hud-ink: #e9e5da; --hud-dim: #8b93a3; }
    .eq { display: grid; gap: 7px; min-width: 0; }
    .muted { color: var(--ink-3); } .small { font-size: 12px; } .good { color: var(--good); } .bad { color: var(--bad); }

    /* ── Bandeau de la salle de situation ── */
    .head { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 4px 10px; padding: 7px 8px 6px 12px; border-radius: 8px;
      background: linear-gradient(180deg, var(--hud-2), var(--hud)); color: var(--hud-ink); border: 1px solid #0a0d12; box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 1px 3px rgba(0,0,0,.2); }
    .lab { display: block; font: 600 9.5px var(--font-body); letter-spacing: .12em; text-transform: uppercase; color: var(--hud-dim); }
    .h-turn { display: grid; justify-items: start; line-height: 1.1; .big { font-size: 22px; font-weight: 700; color: #fff; small { font-size: 12px; color: var(--hud-dim); font-weight: 500; } } .sub { font-size: 10.5px; color: var(--hud-dim); } }
    .vp { display: grid; justify-items: center; line-height: 1.15; min-width: 0;
      .score { display: inline-flex; align-items: center; gap: 6px; b { font-size: 22px; font-weight: 700; } } .sep { color: var(--hud-dim); }
      .fr, .rv { display: inline-flex; align-items: center; gap: 5px; } .fr b { color: #9cc4f0; } .rv b { color: #f2a092; }
      .names { display: flex; gap: 18px; font-size: 10px; color: var(--hud-dim); max-width: 100%; span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } } }
    .flag { display: inline-block; width: 15px; height: 10px; flex: 0 0 auto; border-radius: 1px; box-shadow: 0 0 0 1px rgba(0,0,0,.35); vertical-align: -1px;
      &.fr { background: linear-gradient(90deg, #2c4f9e 0 33.3%, #f4f1ea 33.3% 66.6%, #d8343a 66.6%); }
      &.rv { background: linear-gradient(180deg, transparent 40%, rgba(255,255,255,.85) 40% 60%, transparent 60%), var(--rv); } }
    .tension { width: 104px; }
    .gauge { display: block; width: 100%; height: auto; overflow: visible;
      .bezel { fill: #0d1015; stroke: #59606b; stroke-width: 1.2; } .face { fill: #f3eedf; }
      .seg { fill: none; stroke-width: 7; opacity: .35; } .seg.lit { opacity: 1; }
      .s0 { stroke: #5aa469; } .s1 { stroke: #a9b84a; } .s2 { stroke: #e2b43c; } .s3 { stroke: #e27a36; } .s4 { stroke: #c9302a; }
      .tick { stroke: #2a2d33; stroke-width: 1.4; } .minor { stroke: #2a2d33; stroke-width: .7; fill: none; }
      .tk { font: 700 8px var(--font-mono, monospace); fill: #2a2d33; text-anchor: middle; } .tk.hot { fill: #c9302a; }
      .gl { font: 700 6.5px var(--font-body); letter-spacing: .14em; text-transform: uppercase; fill: #6b6555; text-anchor: middle; }
      .needle { transform-box: view-box; transform-origin: 60px 60px; transition: transform .8s cubic-bezier(.3,1.4,.5,1); path { fill: #b3241c; stroke: #5e120d; stroke-width: .5; } }
      .hub { fill: #2b2f36; stroke: #9aa1ab; stroke-width: 1; } .glass { fill: #fff; opacity: .16; } }
    .tnote { margin: -2px 2px 0; font-size: 11px; color: var(--ink-2); &.hot { color: var(--bad); font-weight: 600; } }

    /* ── Calendrier ── */
    .sched { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px;
      li { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px 2px 5px; border-radius: 3px; background: var(--surface-2); border: 1px solid var(--line); border-top: 2px solid var(--line); font-size: 11px; white-space: nowrap;
        &.now { border-top-color: var(--accent); box-shadow: 0 1px 0 var(--accent); } &.done { opacity: .62; }
        &.won .sc { color: var(--good); } &.lost .sc { color: var(--bad); } .sc { font-weight: 700; } b { font-size: 10.5px; } } }
    .zs { display: inline-block; width: 9px; height: 9px; border-radius: 2px; flex: 0 0 auto; box-shadow: inset 0 0 0 1px rgba(0,0,0,.25);
      &.all { background: conic-gradient(#6d8fd0 0 20%, #d4a248 0 40%, #c76a8a 0 60%, #5fa36b 0 80%, #8a76c4 0) !important; } }

    /* ── Carte ── */
    .sheet { margin: 2px 0 0; padding: 0; width: 100%; justify-self: center; border: 1px solid #6f6a5c; border-radius: 3px; background: #6f6a5c; box-shadow: 0 2px 8px rgba(30,25,10,.2); overflow: hidden; }
    .mapbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 2px 10px; padding: 3px 8px; background: #2b2e33; color: #e7e2d5; font-size: 10px; letter-spacing: .04em;
      .ttl { font-weight: 700; text-transform: uppercase; letter-spacing: .1em; }
      .key { display: inline-flex; align-items: center; gap: 4px; color: #b9b5aa; white-space: nowrap; }
      .k { display: inline-block; width: 10px; height: 8px; margin-left: 4px; border-radius: 1px; } .kp { background: var(--fr); } .kr { background: var(--rv); }
      .kh { background: repeating-linear-gradient(45deg, var(--fr) 0 2px, #e9e3d2 2px 4px); } }
    .map { position: relative; width: 100%; user-select: none; overflow: hidden; }
    .base, .over { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .over { pointer-events: none; }
    .sea1 { stop-color: var(--sea-1); } .sea2 { stop-color: var(--sea-2); }
    .grat { fill: none; stroke: var(--grat); stroke-width: .8; vector-effect: non-scaling-stroke; }
    .shelf { fill: none; stroke: var(--shelf); stroke-width: 14; stroke-linejoin: round; opacity: .55; } .shelf2 { fill: none; stroke: var(--shelf); stroke-width: 6; stroke-linejoin: round; opacity: .7; }
    .land { fill: var(--land); stroke: var(--coast); stroke-width: .9; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .relief { mix-blend-mode: multiply; opacity: .5; }
    .reg { fill-opacity: var(--reg-o); stroke: var(--border); stroke-width: 1; vector-effect: non-scaling-stroke; stroke-linejoin: round; pointer-events: auto; cursor: pointer; transition: fill-opacity .4s ease;
      &.c-p, &.c-r { fill-opacity: var(--ctl-o); } &.l-p, &.l-r { fill-opacity: .8; }
      &.can { stroke: var(--fr); stroke-width: 2; stroke-dasharray: 4 3; } &.tgt { stroke: var(--rv); stroke-width: 2.2; } &.evt { stroke: var(--gold); stroke-width: 2.4; }
      &.focus, &.pick { stroke: var(--gold); stroke-width: 3; } &.dim { fill-opacity: calc(var(--reg-o) * .5); }
      &.fl-p { animation: rflP 1.4s ease 1; } &.fl-r { animation: rflR 1.4s ease 1; } }
    @keyframes rflP { 35% { fill-opacity: .9; stroke: #7fb2ea; stroke-width: 3; } }
    @keyframes rflR { 35% { fill-opacity: .9; stroke: #f08f80; stroke-width: 3; } }
    .hb { fill: transparent; } .hp { fill: var(--fr); } .hr { fill: var(--rv); }
    .home { stroke-width: 1.2; vector-effect: non-scaling-stroke; opacity: .7; } .hm-p { stroke: var(--fr); } .hm-r { stroke: var(--rv); }
    .ln { fill: none; stroke: var(--lbl); stroke-width: 1.3; stroke-dasharray: 1 4; stroke-linecap: round; vector-effect: non-scaling-stroke; opacity: .9; }
    .sea-l { font: italic 500 21px var(--font-display, Georgia, serif); fill: var(--lbl); text-anchor: middle; letter-spacing: .06em; opacity: .9; }
    .home-l { font: 700 19px var(--font-body); fill: var(--home-ink); text-anchor: middle; letter-spacing: .3em; text-transform: uppercase; opacity: .75; paint-order: stroke; stroke: var(--land); stroke-width: 4px; }
    .rose { opacity: .8; .rose-c { fill: none; stroke: var(--lbl); stroke-width: 1.2; } .rose-n { fill: var(--home-ink); } .rose-s { fill: none; stroke: var(--home-ink); stroke-width: 1.2; }
      .rose-l { stroke: var(--lbl); stroke-width: 1; } .rose-t { font: 700 15px var(--font-body); fill: var(--home-ink); text-anchor: middle; } }

    /* ── Repères (pays) ── */
    .node { position: absolute; z-index: 1; transform: translate(-50%, -50%); width: clamp(54px, 16.4%, 76px); display: grid; gap: 1px; padding: 2px 3px 2px; border-radius: 3px;
      border: 1px solid var(--pl-b); border-top: 3px solid #8d887a; background: var(--pl); color: var(--pl-ink); font: inherit; text-align: center; cursor: pointer;
      box-shadow: 0 1px 2px rgba(0,0,0,.3), 0 0 0 .5px rgba(0,0,0,.05); transition: opacity .2s ease, box-shadow .2s ease, background .4s ease; min-width: 0;
      &.c-p { border-top-color: var(--fr); background: linear-gradient(var(--fr-l), var(--fr-l)) padding-box; } &.c-r { border-top-color: var(--rv); background: var(--rv-l); }
      &.inst { border-radius: 10px; border-top-width: 1px; box-shadow: 0 0 0 2px var(--pl), 0 0 0 3px var(--gold), 0 2px 4px rgba(0,0,0,.3); }
      &.inst.c-p { box-shadow: 0 0 0 2px var(--fr-l), 0 0 0 3.5px var(--fr), 0 2px 4px rgba(0,0,0,.3); } &.inst.c-r { box-shadow: 0 0 0 2px var(--rv-l), 0 0 0 3.5px var(--rv), 0 2px 4px rgba(0,0,0,.3); }
      &.can { outline: 2px dashed var(--fr); outline-offset: 2px; } &.tgt { outline: 2px solid var(--rv); outline-offset: 2px; } &.evt { outline: 2px solid var(--gold); outline-offset: 2px; }
      &.dim { opacity: .5; } &.focus, &.pick { box-shadow: 0 0 0 3px var(--gold), 0 2px 5px rgba(0,0,0,.35); z-index: 2; } &.pick { outline-width: 3px; }
      &.fl-p { animation: flP 1.4s ease 1; } &.fl-r { animation: flR 1.4s ease 1; }
      &:disabled { cursor: default; } &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; z-index: 3; } }
    .nm { font-size: clamp(8px, 2.3vw, 10px); font-weight: 700; line-height: 1.15; letter-spacing: .04em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 1px; }
    .infs { display: flex; justify-content: space-between; align-items: center; gap: 1px; min-height: 14px; }
    .ip, .ir { display: inline-flex; align-items: center; gap: 2px; b { font-weight: 800; font-size: clamp(10.5px, 3vw, 12.5px); line-height: 1; } }
    .ip { --c: #3a78bd; --cd: #1d4f86; b { color: var(--fr-d); } } .ir { --c: #cf4a3a; --cd: #7e241b; b { color: var(--rv-d); } }
    .stk { display: inline-block; width: 10px; height: 5px; border-radius: 50%; background: var(--c); margin-top: 6px; }
    .zero { opacity: .35; .stk { background: transparent; box-shadow: inset 0 0 0 1px var(--cd) !important; } }
    .st { width: 15px; height: 15px; flex: 0 0 auto; display: grid; place-items: center; font: 800 9px var(--font-mono, monospace); color: var(--pl-ink);
      background: radial-gradient(circle, transparent 54%, currentColor 56% 66%, transparent 68%); opacity: .75; }
    .pv { position: absolute; top: -9px; left: -6px; color: var(--gold); font-size: 13px; line-height: 1; text-shadow: 0 0 1px #000, 0 0 2px rgba(0,0,0,.6); }
    .anc { position: absolute; bottom: -6px; left: 50%; width: 13px; height: 9px; transform: translateX(-50%); border-radius: 1px; box-shadow: 0 0 0 1px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.4);
      &.p { background: linear-gradient(90deg, #2c4f9e 0 33.3%, #f4f1ea 33.3% 66.6%, #d8343a 66.6%); } &.r { background: linear-gradient(180deg, transparent 40%, rgba(255,255,255,.85) 40% 60%, transparent 60%), var(--rv); }
      &.inline { position: static; display: inline-block; transform: none; vertical-align: -1px; } }
    .shd { position: absolute; bottom: -6px; right: -4px; width: 11px; height: 13px; filter: drop-shadow(0 1px 1px rgba(0,0,0,.45)); &.p path { fill: var(--fr); stroke: #fff; stroke-width: .9; } &.r path { fill: var(--rv); stroke: #fff; stroke-width: .9; } }
    .badge { position: absolute; z-index: 2; top: -10px; right: -6px; padding: 0 4px; border-radius: 3px; font-size: 10px; font-weight: 700; line-height: 1.5; color: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.35);
      &.add { background: #1f8a4c; } &.odd { background: var(--rv); } &.two { background: #4a5263; } }
    @keyframes flP { 40% { box-shadow: 0 0 0 4px #7fb2ea, 0 2px 5px rgba(0,0,0,.3); } }
    @keyframes flR { 40% { box-shadow: 0 0 0 4px #f08f80, 0 2px 5px rgba(0,0,0,.3); } }
    .zones { display: flex; flex-wrap: wrap; gap: 4px; }
    .zchip { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; padding: 3px 9px 3px 7px; border-radius: 3px; border: 1px solid; border-left-width: 4px; background: var(--surface); color: var(--ink); font: inherit; font-size: 11.5px; cursor: pointer;
      &.on { background: var(--surface-2); font-weight: 700; box-shadow: inset 0 0 0 1px var(--line); } }

    /* ── Panneaux : notes, dépêches ── */
    .panel { display: grid; gap: 5px; padding: 8px 10px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); font-size: 13px; min-width: 0; p { margin: 0; } ul { margin: 0; padding-left: 18px; } }
    .memo-h { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-bottom: 4px; border-bottom: 1px solid var(--line);
      font: 700 10.5px var(--font-body); letter-spacing: .14em; text-transform: uppercase; color: var(--ink-2); }
    .stamp { padding: 1px 6px; border: 1.5px solid var(--stamp); border-radius: 3px; color: var(--stamp); font-size: 9.5px; letter-spacing: .12em; transform: rotate(-3deg); opacity: .85;
      &.ok { border-color: var(--good); color: var(--good); } }
    .brief li { font-size: 12.3px; color: var(--ink-2); margin: 3px 0; }
    .foe { border-left: 3px solid var(--rv); font-size: 12.5px; }
    .dep { font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--rv); font-weight: 700; }
    .mine { margin: 0; padding: 0 4px; color: var(--ink-2); }

    /* ── Cartes : dossiers diplomatiques ── */
    .hand { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; padding-top: 3px; }
    .card { position: relative; display: grid; justify-items: center; align-content: start; gap: 3px; min-height: 96px; padding: 17px 4px 14px; border-radius: 2px 2px 3px 3px;
      border: 1px solid #c3b89c; border-top: 0; color: var(--paper-ink); font: inherit; cursor: pointer; min-width: 0;
      background: repeating-linear-gradient(180deg, transparent 0 11px, var(--paper-rule) 11px 12px) 0 22px / 100% calc(100% - 22px) no-repeat, linear-gradient(170deg, var(--paper), var(--paper-2));
      box-shadow: 0 1px 2px rgba(40,30,10,.25), 0 3px 0 -1px var(--paper-2), 0 3px 1px -1px rgba(40,30,10,.25); transition: transform .15s ease, box-shadow .15s ease;
      &::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 4px; background: linear-gradient(90deg, #2c4f9e 0 33.3%, #f4f1ea 33.3% 66.6%, #d8343a 66.6%); }
      &.foe::before { background: var(--rv); } &.neu::before { background: #8d887a; }
      &.on { transform: translateY(-4px); box-shadow: 0 0 0 2px var(--accent), 0 6px 10px rgba(30,25,10,.3); }
      &:disabled { opacity: .55; cursor: default; }
      .tab { position: absolute; top: 5px; left: 5px; font-size: 8.5px; letter-spacing: .06em; color: var(--ink-3); .ops { font-size: 13px; color: var(--paper-ink); } }
      .ic { display: grid; place-items: center; width: 28px; height: 28px; margin-top: 2px; border-radius: 50%; border: 1.5px dashed rgba(90,80,60,.55); font-size: 16px; line-height: 1; filter: grayscale(1) contrast(1.15); opacity: .72; }
      .cn { font-size: 9.6px; font-weight: 600; line-height: 1.18; letter-spacing: .01em; text-align: center; text-transform: uppercase; overflow-wrap: anywhere; &.long { font-size: 8.4px; letter-spacing: -.02em; } }
      .ow { position: absolute; bottom: 3px; right: 4px; max-width: calc(100% - 8px); padding: 0 3px; border: 1px solid currentColor; border-radius: 2px; font: 700 7.5px var(--font-body); letter-spacing: .08em;
        text-transform: uppercase; color: #2c4f9e; transform: rotate(-4deg); opacity: .8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } }
    .card.foe .ow { color: var(--stamp); } .card.neu .ow { color: #6c6758; }
    .act { min-height: 52px; }
    .row, .modes { display: flex; flex-wrap: wrap; gap: 6px; .btn { min-height: 36px; } }
    .row { justify-content: flex-end; }
    .btn.danger { background: var(--bad); border-color: var(--bad); }
    .scores { width: 100%; border-collapse: collapse; font-size: 12px;
      th, td { padding: 3px 4px; text-align: left; border-bottom: 1px solid var(--line); } thead th { font-size: 11px; color: var(--ink-2); font-weight: 600; } td b { margin-left: 3px; }
      th .zs { margin-right: 5px; } .flag { width: 12px; height: 8px; } }
    .verdict { font-size: 14px; }
    .log { list-style: none; margin: 0; padding: 4px 8px; display: grid; gap: 2px; max-height: 76px; overflow: auto; font: 11px/1.4 var(--font-mono, ui-monospace, monospace); color: var(--ink-2); border-left: 2px solid var(--line); li:first-child { color: var(--ink); } }

    /* ── Thème sombre : carte de nuit, papier bistre ── */
    @media (prefers-color-scheme: dark) {
      :host-context(html:not([data-theme=light])) {
        --fr: #4f8fd6; --fr-d: #a9cbf2; --fr-l: #1f3350; --rv: #d9574a; --rv-d: #f3a597; --rv-l: #4a2622;
        --sea-1: #223747; --sea-2: #172633; --grat: rgba(150,185,210,.16); --land: #45463f; --coast: #8ea6b6; --shelf: #2b4557; --border: rgba(18,20,24,.85);
        --lbl: #87a4b8; --home-ink: #d9dde6; --reg-o: .3; --ctl-o: .58;
        --pl: rgba(29,33,43,.94); --pl-b: #4b5263; --pl-ink: #ece8de;
        --paper: #36332b; --paper-2: #2c2a24; --paper-ink: #ebe5d5; --paper-rule: rgba(255,255,255,.05); --stamp: #ef7c6e;
      }
      :host-context(html:not([data-theme=light])) .relief { mix-blend-mode: soft-light; opacity: .7; }
      :host-context(html:not([data-theme=light])) .card { border-color: #4a463b; }
      :host-context(html:not([data-theme=light])) .card .ic { border-color: rgba(230,220,200,.4); filter: grayscale(1) invert(.85); }
      :host-context(html:not([data-theme=light])) .card .ow { color: #9cc0ee; }
    }
    :host-context(html[data-theme=dark]) {
      --fr: #4f8fd6; --fr-d: #a9cbf2; --fr-l: #1f3350; --rv: #d9574a; --rv-d: #f3a597; --rv-l: #4a2622;
      --sea-1: #223747; --sea-2: #172633; --grat: rgba(150,185,210,.16); --land: #45463f; --coast: #8ea6b6; --shelf: #2b4557; --border: rgba(18,20,24,.85);
      --lbl: #87a4b8; --home-ink: #d9dde6; --reg-o: .3; --ctl-o: .58;
      --pl: rgba(29,33,43,.94); --pl-b: #4b5263; --pl-ink: #ece8de;
      --paper: #36332b; --paper-2: #2c2a24; --paper-ink: #ebe5d5; --paper-rule: rgba(255,255,255,.05); --stamp: #ef7c6e;
    }
    :host-context(html[data-theme=dark]) .relief { mix-blend-mode: soft-light; opacity: .7; }
    :host-context(html[data-theme=dark]) .card { border-color: #4a463b; }
    :host-context(html[data-theme=dark]) .card .ic { border-color: rgba(230,220,200,.4); filter: grayscale(1) invert(.85); }
    :host-context(html[data-theme=dark]) .card .ow { color: #9cc0ee; }

    @media (max-width: 400px) { .head { padding-left: 9px; gap: 4px 6px; } .tension { width: 92px; } .vp .score b, .h-turn .big { font-size: 19px; } }
    @media (prefers-reduced-motion: reduce) {
      .node, .reg, .card { transition: none; } .node.fl-p, .node.fl-r, .reg.fl-p, .reg.fl-r { animation: none; } .gauge .needle { transition: none; }
    }
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
  protected readonly stack = STACK;
  protected readonly gaugeSegs = GAUGE_SEGS;
  protected readonly gaugeTicks = GAUGE_TICKS;
  protected readonly gaugeMinor = GAUGE_MINOR;
  protected readonly uid = 'eq' + ++INST;
  protected V: VariantDef = VARIANTS.monde;
  protected A: MapArt = ART.monde;
  protected mapTitle = '';
  protected linkPaths: string[] = [];

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
    const V = this.V, A = this.A, mode = this.phase() === 'play' ? this.mode() : null, pend = this.pend(), fl = this.flash(), c = this.selCard();
    const counts = new Map<number, number>();
    for (const i of pend.at) counts.set(i, (counts.get(i) ?? 0) + 1);
    const ops = c ? opsOf(g, 'p', c) : 0;
    const coup = mode === 'coup' ? new Set(coupTargets(g, 'p', ops)) : null;
    const ev = this.evTargets();
    const left = this.left();
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
      const [x, y] = A.pos[n.id] ?? [((n.c + 0.5) / V.cols) * A.w, ((n.r + 0.5) / V.rows) * A.h];
      return {
        i: n.i, left: (x / A.w) * 100, top: (y / A.h) * 100, name: n.short, stab: n.stab, pivot: !!n.pivot, p, r, ctrl,
        anchor: n.anchor ?? '', pend: counts.get(n.i) ?? 0, can, cost2: can && cost === 2, odds, evt, dim,
        flash: fl.has(n.i) && !this.reduced ? 'fl-' + fl.get(n.i) : '', shield: g.shield[n.i], label, focus: this.focus() === n.i, pick: this.coupAt() === n.i,
        inst: !A.regions[n.id],
      };
    });
  });

  /** Territoires de la carte : couleur de zone, contrôle (plein) ou simple avance (hachures) */
  protected readonly regions = computed<RegionView[]>(() => {
    const V = this.V, A = this.A, u = this.uid;
    return this.nodes().filter(n => !n.inst).map(n => {
      const lead: Side | '' = n.ctrl ? '' : n.p > n.r ? 'p' : n.r > n.p ? 'r' : '';
      const fill = n.ctrl === 'p' ? 'var(--fr)' : n.ctrl === 'r' ? 'var(--rv)' : lead ? `url(#${u}-h${lead})` : V.zones[V.nodes[n.i].zi].tint;
      const cls = 'reg' + (n.ctrl ? ' c-' + n.ctrl : '') + (lead ? ' l-' + lead : '') + (n.can ? ' can' : '') + (n.odds ? ' tgt' : '') + (n.evt ? ' evt' : '')
        + (n.dim ? ' dim' : '') + (n.focus ? ' focus' : '') + (n.pick ? ' pick' : '') + (n.flash ? ' ' + n.flash : '');
      return { i: n.i, d: A.regions[V.nodes[n.i].id], cls, fill };
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
        stamp: !m.event ? 'Sans év.' : m.side === 'p' ? 'France' : m.side === 'r' ? this.V.rival.name : 'Neutre',
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
        turn: s.turn, all, tint: all ? '' : z.tint, label: all ? 'Bilan final' : z.name, now: s.turn === g.turn && !s.res, done: !!s.res, res, score,
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
      return { title: `Zone ${z.name}`, line: this.zoneLine(zf), more: `Présence ${z.vals[0]}, domination ${z.vals[1]}, contrôle ${z.vals[2]} PV, +1 par pivot ★.` + (z.close !== undefined ? ` ${cap(V.words.coups)} interdits dès ${V.words.tension} ${z.close}.` : '') };
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
    this.A = ART[this.V.id];
    this.mapTitle = this.V.id === 'monde' ? 'Monde' : this.V.id === 'afrique' ? 'Afrique' : 'Union européenne';
    // Liaisons : arcs légers entre repères voisins
    const P = (i: number): [number, number] => this.A.pos[this.V.nodes[i].id] ?? [0, 0];
    this.linkPaths = this.V.links.map(([a, b]) => {
      const [x0, y0] = P(a), [x1, y1] = P(b);
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, k = 0.12;
      return `M${x0} ${y0}Q${Math.round(mx - dy * k)} ${Math.round(my + dx * k)} ${x1} ${y1}`;
    });
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
  /** Les comptes rendus de la simulation, sans pictogrammes */
  protected clean(t: string): string { return t.replace(/🎲\s?/g, 'dé '); }
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
    if (g.tension + 1 >= MAXT) return `Alerte : un ${V.words.coup} de plus déclenche la ${V.words.crisis}.`;
    const shut = V.zones.filter((_, zi) => zoneClosed(g, zi)).map(z => z.name);
    return `${cap(V.words.tension)} ${g.tension}/${MAXT} · ` + (shut.length ? `${V.words.coups} interdits : ${shut.join(', ')}.` : `${V.words.coups} possibles partout.`);
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
    if (this.phase() === 'over') return;
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
    this.say(`Vous : ${this.cardName(rep.card)} — ${this.clean(rep.text)}.`);
    if (rep.trig) this.say(`${this.V.rival.The} : ${this.cardName(rep.card)}, ${rep.trig.fx.text}.`);
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
      this.say(`${this.V.rival.name} : ${this.cardName(rep.card)} — ${this.clean(rep.text)}.`);
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
    this.verdict.set(`${cap(this.V.words.crisis)} ! Votre ${this.V.words.coup} a mis le feu aux poudres : tout est gelé, votre crédit s’effondre.`);
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

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
    pos: { SCA: [466, 65], VAL: [521, 187], MER: [333, 193], BAL: [521, 309], ACE: [709, 195], SUB: [861, 341], ASE: [806, 553], PAC: [902, 681], LEV: [485, 431], ZAM: [673, 431], GOL: [607, 553], MAG: [297, 315], SAH: [419, 553], COR: [572, 675], AOU: [384, 675], CAR: [109, 368], AND: [149, 556], CSU: [172, 730] },
    labels: [['Océan|Atlantique', 215, 95], ['Océan Indien', 700, 712]],
    homeLabels: [['France', 370, 174], ['Karstanie', 824, 57]],
    homeP: 'M194 516l1-5 9 15-1 15-6-6zM334 186l5-3 8-15-3-16-7-5 2-6 8 1 7 6 2-9 4 5 15-1 4-5 5 0 7 15 3 0 8 12 8 6-8 10-4-2-7 5-2 4 4 0 0 5 0 7-4 1-1 7 3 4-2 3-8 1-12-10-10-2-3 4-7-3-4-7-3 1-8-9zM389 240l1-7 8-3-2 8-5 6z',
    homeR: 'M483 147l1-4 7-2 7 6 0 6zM521 124l2-2-1-10 2-7 5-5-4-5 14-21-6-6 1-6-4-7 3-7-6-9 4-6-7-6 0-5 14-6 8 5 11 2 20 13 1 5-11 7-22-6 7 7 1 12 10 5-3-8 2-3 11 5 3-2-3-6 9-8 8 2 2-5-4-5 1-5-4-4 12 1 3 5-5 1 1 4 3 3 6-2 1-6 20-12 3 0-3 5 5 0 16-7 5 3 4-5-5-3 1-3 12 1 22 7 2-4-5-4-5 0-3-10 9-15 10 1 2 4-2 5 5 6 2 9 5 4-6 14 5 1 8-12-4-3 1-5-4 0-2-3 1-7-6-4 5-5-2-5 5 3 0 7 5 0-3-4 5-3 8-1 8 3-7-11 24-3-4-2 3-4 96-1-12 5 14 1 2 4 7-2 29 5-1-4 13 1 7 4 2 3-1 3 11 7 2-6 7 3 21 1-4-6 4-2 26 5 6 1 13 9 21 2 3 3 0 5 7 1 4 55-6 5-3-9-8 1-7 10 3 5-11 0-1-4-4-2-4 2-19-2-16 25 4 1 5 7 2-3 3 1 5 8 0 31-9 33-3 4-4-4-4 6-5 22 2 7-7 5 0-15-3-4-7 7 0-16-5 13-3 0 4 14 2 3 2-6 4 9-3 2-4 14 6 29-4 32-12 37-10 19-5 7 1-4-10 14-5 13 3-13-4-4 1-17-9 13-4 13 2-7-3 3 0-6 3-22-2 2 7-39-1-8-4 1-1-10-2 5-2-2-5 16-2 2-5-3-4 12 0-7-2 3-8 2-17-8-4 0-1 3-8-2-6-2-3-10 4-1-6-17-7-9-10 1-3-7-6-5-3-10-5 2-4-9 0-6 3-8 3-3 6-2 0-7 6-4 7-13-2-8 3-3-9-14 10-9-1-16 9 0-1-12 3-1 1-6-3-4-5 2-12-8-6 4-7-3-1 4-15-16-7-4 1-3-14 12 0-4-6-1-5 3-3-7-8 1-16 14-17 10-1 3 4 5-7 13 8 3-1 4-6 3-2 4-6-2-8 3-5 7-16-4-8 3-10 16 0 8-5-5-4 14-2 12 4 7 4-2 2 7 0 6 2 1-14 28 4 10-2 9 6 13-6 11-2 0-4-7-5-2-1-4-5-1-4 3-7-7-12 1-9-14-3-8 4-2 5-11-2-5 8-6 0-3-5 3 1-6 8-5 3-21-9-3-3-5-4 2-5-4-2-7-3-1 1-6-3-6-9 2-2-12 6-2-8-18 0-8-7-2-5-6zM536 270l8-11 4 4 3 7 5-1-2 4-14 10-2-3 3-6zM614 -1l3-2-1-4 7-6-4-1 8-6-1-3 14-7 21 0-10 3-13 8-9 14 1 6 9 5-15 1-2-3-7-1zM875 407l6-16 4-4-6 17-4 6zM928 -28l26-2 3 1-2 4-7 0-12 1zM940 -16l8-3 6 4zM961 -27l0-2 16 4-3 2zM967 112l2-7 9 38-4-3-1 9 4 13-2-4-2 5zM1005 105l3-16 5 0 10-14 1 30 1 8-5 2-1 8-4 0-1 7-3 6z',
    grat: 'M37 839l0-349-12-305 2-90 8-120M112 839l-1-302-9-147-14-130-2-66 4-92 17-130M187 842l1-179-3-77-7-67-30-208-7-99 2-52 6-50 31-140M262 848l2-132-3-66-11-64-46-225-8-63-4-58 3-57 8-52 12-44 38-118M337 856l4-100-4-50-13-63-65-262-10-62-4-56 3-49 9-46 14-39 40-100 18-60M411 861l7-82-6-54-33-144-55-187-8-38-3-34 2-37 10-44 9-29 32-67 16-45 16-63 10-65M486 864l8-79-4-63-19-99-40-147-5-31-3-30 2-29 7-27 36-84 8-40 12-143-1-115M560 864l2-36 11-83 1-78-6-69-21-125-5-45 3-31 26-118 7-69 0-109-12-122M634 861l0-44 3-34 51-219 8-54 3-56-2-60-26-259-10-70-18-89M707 857l-3-83 3-31 6-33 22-76 69-195 12-44 3-32-5-48-15-68-33-120-47-155M781 851l-9-119 2-40 6-43 10-45 12-42 47-125 19-57 10-46 3-41-4-55-13-62-20-62-50-144M855 845l-12-147 0-45 4-47 15-77 37-123 14-54 9-51 3-51-2-50-9-56-13-54-34-119M930 841l-10-158 1-94 9-79 33-180 6-48 2-49-1-50-5-53-26-156M-11 776l97-2 71 4 54 10 120 29 60 13 63 9 63 2 66-2 70-9 240-47 50-4 65-1M-11 634l51-3 39 0 36 4 34 9 28 10 32 16 122 76 56 29 31 12 30 9 30 5 32 2 55-4 59-15 74-30 134-68 48-21 53-15 72-8M-11 496l50-2 40 2 34 7 32 12 28 16 30 22 122 111 51 38 27 14 26 10 30 6 32 3 33-2 31-4 32-9 32-12 54-27 104-64 102-57 63-27 66-21M-13 357l49-2 40 2 35 5 32 9 48 23 113 70 146 76 52 19 27 5 24 2 29-2 27-6 26-10 31-15 54-36 103-82 28-18 19-6 72-14 77-11M-17 216l109-15 79-8 56-1 43 6 35 11 34 16 109 77 36 23 27 10 28 4 40-5 45-16 39-20 113-67 41-20 36-12 29-5 29 1 113 21M-16 77l182-22 86-5 44 2 47 6 159 38 49 6 55-4 131-31 76-10 41 0 43 2 123 18',
    land: 'M-20 173l2-148 15-3 3 4 4-4-3-2 2-2 7-2 6 5 10 1 11-2 0-4 3-1 5 2 0 6 7-12-7-6 1-7 4-5 8 4 5 6-4 4 7 0-1 7 5-5 4 3-2 5 3 4 7-10 1-7 15 3-3 7 1 6-8 5-8-1-6 12-5 5-5 0-3 8-9 7-6 20 4 1 2 10 5-2 18 11 9 0-1 12 6 13 4-10-2-13 12-14-1-10-4-4 5-7 0-15 2-2 9 2 3-2 7 7 6 0-2 12 5 4 12-14 6 20-2 4 12 9 0 5 3 3-1 8-16 14-18 3-16 26 8-11 11-8 2 3-3 5 0 13 4 3 4-2 4-8 1 7-17 20-2 0 1-6 5-7-8 2-9 12-2 11 2 5-10 6 5 0-6 2-3 14-1-4 1 8-2 10-2-15 1 8-2-1 4 21-14 33 8 50-3 0-2-6-10-33-3 4-4-6-9 1 1 8-3 1-5-4-7 0-10 15 1 39 6 23 7 9 8-4 4-4 1-13 10-3-3 42 13 1 6 6 1 30 6 16 4 2 5-4 9 10 4-5 1-11 5 1 4-7 3 3-2 4 2 18 2-5-2-9 3-1 0-6 7 15 6 2 5 7 2-4 7 4-2 1 1 4 22 42 11 10 11 19 8 22 0 11 7 7 1 6 2-2 12 16 2 9 18 16 20 32 4 11-1 8-11 9-1 21-6 15-4 2-11-4-11 2-3 4-2 14-19 25-5 1-4-2-9-8 6 21-3 7-6 2-12-2 1 13-2 2-8-3-1 2 0 7 3 2 2-2 1 4-7 5-1 11-4-1-3 4-1 5 7 7-8 17-28 0 1-16 4-5-6-2 4-6 1-12 4 3 2-15-2-2-2 9-2-1 4-28-1-15 8-32 6-82-1-9-4-8-17-24-12-45-9-16-1-9 5-12-1-3-1 3-2-3 0-8 2-11 4-3 5-14-3-19-6-18-4 4 0 7-11-11-5-11-1 2-2-3-1-8-7-17-3 1-10-7-10-15-3-2-6 4-25-19-6-7-4-25-12-19-1-6-10-17-4-16-3-2zM-18 291l17 43-2 3-8-13-1-9-6-7zM-17 17l0-8 6-2-6 0 1-15 5-1 5 2 4-3 6 8 2-3-2-6 3-1 7 3 3 10 12 6-1 3-5 0 2 3-2 2-12-2-26 7zM-16 -23l1-6 17 3-3-4 6 0 9 0-2 6-27 5 0-2 7-3zM25 -9l0-2 7 1-4-4 5-4 11 2-3 3 5 3-1 5-6 3zM26 -28l0-2 17 0-2 5-6 1-3-1 0-4zM33 10l6-5 8 6-2 3zM46 -25l8-5 4 4-2 3zM48 -13l2-6 4-1 14 1-3 2-11 10-4 0zM61 -30l46 0 1 3-3 1-13 2-30-1zM68 -9l8-9 9-2-3 4 3 4 3-5 10-3 5 6-1 4 11-5 12 5 0 3 7-2 3 4 8 2 5 7-7 3 13 4 3 5 6 0-10 11-8-7-4 1-1 3 8 7-1 10-12-5 7 10-15-4-4-3 2-1-9-6-10 4-3-2 3-4 14-2 1-6 5-6-1-4-12-4 2-2-8-5-9 3-25-3-3-2 4-3-5 1zM73 44l6-15 14 7-1 3 5 1-3 2-7-3-9 7 0-3zM81 343l5-8 8 0 5 6 3-1 12 17 2 4-2 2-8-1 1-4-6-11-10-6 0-3-3-1-4 6zM103 -18l2-2 8 0 6 3-2 2-10 1zM105 374l2-2 5 4 0 2-3 1zM110 16l6-5 2 2-1 3-6 3zM117 374l6 1-4-11 7 2 9 13-1 3-6-3-1 6-4-6-4 0zM147 135l9-21 5-7-4 13 2-3 0 4 7 2-2 18-3 0 1-7-4 7 0-4-2-2-9 2zM186 -30l142 0 2 3-8 0 4 2-2 2-11 0 3 7-9-1 9 5 0 4-7 1-7-6 1 4-6 3 16 1-24 8-16 2-12 8-25 8-6 10-8 4 0 5-6 10-5 1-4-5-7 1-7-15-2-20 5-6 6-3 4-6-10 4-4-2 3-7 10 1-8-5-6 0 5-5zM271 364l1-24 3 0 4-22-1-34 2-7 7-8 6-17 3 1 2 6 10 7 5-3 6 1 9-3 19 9 3 4 6 0 13 11 8 1 4 4-2 5 6 0-5 6-4 18-5 2 0 7 3 3 3 10 20 27 2 13 19 27 6-4-1-10 3-4 5-2 4 1 7 7 1 7 9 9 1 5 8 4 13 15 7-3 5 1 4 3 2 6 1-3 9 6 3-2 16-52 0-6 3-4-3 0-4-3-6 6-9-1-2-7-5-3-3 5-4-1-3-8-6-3 0-20 7-8-1-7 10-8 8 3 5-9 8 4 15-9 9 0 12 13 12-2 8-8 2-15-18-30 4-2 5-11-2-5 8-9-21 15-1 8 2 3 5-1-2 4-14 10-2-3 3-6-5-4 7-6-1-3-7-4 0-4-4 1-25 46-2 12 3 5-2 3-6-2-10 7 2-8-5-4-8-1 1 8-3 0-3-1-1-7-4 8 1 7-3 1 2 11-3 7-4-6-1 6-4-1-1 11-4-2-3-8 4-18 0-27 7-16-15-31-3-11 1-10-4-4-3 3-1-5 3-3-5-5-6 1-3 13 5 9 4 24 5 3 1 4-3 0 8 14 3 11-3 3-2-7-4-5-6 4 3 7-3 5-3-1-8 6-3-1 8-9 1-14-18-42-3-9 2-10-7-10-19 1-12-10-10-2-5 9-8 3-7-2-7 6-5 7 0 7-7 9-4 0-5 7-10-5-6 6-2-13-4-4-2 3-4-2 4-15-2-5 8-19 5-20 8-4 28 14 5-3 8-15-3-16-7-5 2-6 8 1 7 6 2-9 4 5 15-1 4-5 14 0 8-10 14 0 5 4 5-3 0-23 4-4 4 1 7-3-3 7 3 5-8 6 0 8 5 4-1 4 10-1 7 10 20-4 10 8 1-4 7-2 0-16 3-6 5-2 3 8 4 1 2-13-2 1-3-5 0-5 12-2 9 3 5-5-4-5-24 2-7-10-1-17 2-5 17-13 0-4-6-4-8 1-4 5 1 5-16 11-4 11 7 13-5 9-5 1-7 24-6-3-4 6-6-2-8-40-12 7-7-1-6-6 2-26 28-13 20-22 19-12 16-1 6-5 15 0 13 6-5 1 4 6 4-3 35 16 5 9-5 5-6 2-22-6 7 7 1 12 10 5-3-8 2-3 11 5 3-2-3-6 9-8 8 2 2-5-4-5 1-5-4-4 12 1 3 5-5 1 1 4 3 3 6-2 1-6 20-12 3 0-3 5 5 0 16-7 5 3 4-5-5-3 1-3 12 1 22 7 2-4-5-4-5 0-3-10 9-15 10 1 2 4-2 5 5 6 2 9 5 4-6 14 5 1 8-12-4-3 1-5-4 0-2-3 1-7-6-4 5-5-2-5 5 3 0 7 5 0-3-4 5-3 8-1 8 3-7-11 24-3-4-2 3-4 5-1 91 0-12 5 14 1 2 4 7-2 29 5-1-4 13 1 7 4 2 3-1 3 11 7 2-6 7 3 21 1-4-6 4-2 32 6 13 9 21 2 3 3 0 5 7 1 1 12 3 43-6 5-3-9-8 1-7 10 3 5-11 0-1-4-4-2-4 2-19-2-16 25 4 1 5 7 2-3 3 1 6 14-1 25-3 14-6 19-3 4-4-4-4 6-1 10-4 8 5 25 0 14-6 5 0-21-5-11 1-11-3-4-7 7 0-16-5 13-3 0 4 14 2 3 2-6 4 9-3 2-4 14 6 29-4 32-12 37-10 19-5 7 1-4-10 14-4 12 2-12-1-3-12 24-12 53-15 44-24 40 5-15 0-7 5-18 1-5-2 1 4-10-2 1-19 43-7 27 0 15-6 33-2 1-3-8 8-43 40-111-9 18-1-3 15-49 5-35-2 1-3 11-3-1-7 11-7 18-30 59-10 14-27 69-18 32 26-137-13 15-6-7 4-6-1-3-7-3-4 1-1-6-5-4-32 27-29 12-3-11-3 0-13 14-9 1-8-4-8 0-12-22-4 4-5-3-3 6-5 0 9 24 11 7 0 8 6 10 1-13 2-2 2 2-1 13 3 5 16-9 17-32 0 15 3 5 13-1 5 6 2-1-10 27-5 5-2 13-17 21 0 4-18 17-2 8-22 22-25 21-4 1-2-5-5-17 1-10-5-9-25-35-3-13-6-11-8-7-23-42-3-1-1-15-3 18-13-25 17 42 15 25 1 9 11 12 10 34 7 6 8 19 24 25 2 6-3 2 7 9 3-1 36-26-5 24-13 34-11 20-29 40-7 18 2 3-1 7 4 7-1 12-6 6-18 11 1 8-11 4-2 5-9 6-17 5-27-1 0-4-10-10-2-10-8-9 0-5 7-9 0-3-8-21-15-21 0-25-8-14-10 2-10-18-9-1-14 6-12-9-10-1-27-40-32-70-13-38-1-16-6-29-18-58zM606 267l4 10-2 9 11 27 3-1 2 3-6 3-5 21 1 15 7 1 5 5 10-2 11-9-1-27-5-2 2-10-5 1 2-12 6 0 5-7-6-12-5 6-1 10-1-21-7-1-2-10-3-2 0-4 5-1 1-10 9-4 0-19-5 3-5-1-11 13zM297 19l4-3 6-1 5 4 7-2 5 1 14-1-2 4 4 4-12 5-12 2-16-3 5-3-8-3 8-2zM324 111l7-6 0-7 13-6 6 3 2 3-12 14-10 2zM338 129l16-5-7-4 0-3 6-1-2-5 3-4 7 3 3-4-2-5-6-3 2-7-4 2 1-10 10-11 9 2-3 3-4 3 10 2-9 10 5 2 1 11 3 2 1 13 6 4-6 6 1 5-6 2-19-7-5 2zM377 262l5-19 3 3 5 0 1 9-6 13-3-3-4 1zM389 240l1-7 8-3-2 8-5 6zM396 297l3-5 19 13-6 6-4 9zM439 118l8-1-1 9-2 3zM452 370l3-4 2 5 10 8-1 3-8-4zM498 396l14-3-5 4 0 3-7 3zM578 801l5-6 2-10 12-8 7-11 2 8-16 31-11 2zM614 -1l3-2-1-4 7-6-4-1 8-6-1-3 14-7 21 0-10 3-13 8-9 14 1 6 9 5-15 1-2-3-7-1zM750 593l15-40-2 11-7 21zM786 611l3-39 5 0 0 22 2-1 2 9-1 8 5 11-4 17-3 2-5-6zM796 644l3-6 4-2 4 2 7-6 6-1 1 3 9-1-5 4zM814 599l6-19 4-1 2-7 6-6 21-39 1 6 3 2-10 22-1 9 3 4-4 4-11 34-5 3 0-3-4 0-4 4-1-2-5 2zM819 713l3-13 0 3 9-13 15-12 8-19 1 4 2-2 0-5 7-12 5-4 5 3 5-2 4-13 8-6 0-2-3-1 2-1 11 1 5-4 2 2-6 16 14 7 4 1 3-2 7-38 5 19 3-2 3 3 4 22 10 6 4 11 1-1 12 18 3 24-2 18-9 28 0 13-7 3-7 9-6-4 0-4-5 7-12-5-5-13-6-3 0-8-5 7 3-17-7 15-3-3-4-11-12-5-19 9-7 7-2 6-14 5-6 8-5 1-7-3 2-12-11-27 2 1-1-4 3 2zM844 595l12-31 11-4 5-7-4 10-16 10-1 5 2 4 10-10-1 4-7 8 4 14-3 7 1-7-4 4-1-12-2 3-2 15-4 1 2-11zM857 628l6-11 8-6zM858 512l17-33-2 8zM871 517l3-10 13-14 2-8 2 4-4 18-3 8 1-8-3 5-2 10-3-2 1-14zM875 407l6-16 4-4-6 17-4 6zM877 582l1-4 9-3 1 4zM879 491l5-13 2-1-2 7 2-5-7 17zM879 562l2-15 2-3 2 6-4 14-1 1zM883 468l1-13 3 0 0 3zM887 451l15-51 2 3 2-3-4 14-11 31 3-1 2 4-3 12-1-9-2 5 0-6-3 3zM888 483l5-23 3-1-2 14-2-2zM889 561l8-7 5 0 0 12 4 2 4-8 8-7 24 4 4 8 7 2-3 9 6 8 2-1 0 3 6 3-3 3-9-1-6-10-6-1-6 6 1 4-4 3-6 1-3-4-4 1-6 4 4-8-2-10-15-5-3 5-3-6 7-7-6 2zM912 363l2-17 7-18zM928 -28l26-2 3 1-2 4-7 0-12 1zM940 -16l8-3 6 4zM944 784l7 2 7-2 0 17-2-2-2 5-3-1zM946 255l8-17 4-1 3 2 2-14 2 4 5-10 1-22 3-1 1 11-2 13-2 24-3 3-4 0-4 9-1-10-9 5 2 6-4 18zM952 259l2-9 1 1 1-3 2 5-4 8zM956 564l7-7 0 3 3-1 6-10-2 9-7 7zM961 -27l0-2 16 4-3 2zM967 112l2-7 9 38-4-3-1 9 4 13-2-4-2 5zM969 186l1-5 3 0 0-15 6 11 2 2 1-3 1 8-3 1-2 7-4-6-1 8-3 0zM1005 105l3-16 5 0 10-14 1 30 1 8-5 2-1 8-4 0-1 7-3 6z',
    regions: {
      SCA: 'M297 19l4-3 6-1 5 4 7-2 5 1 14-1-2 4 4 4-12 5-12 2-16-3 5-3-8-3 8-2zM416 77l2-18 28-13 20-22 19-12 16-1 6-5 15 0 13 6-5 1 4 6-10 3 0 5 7 6-4 6 6 9-3 7 4 7-1 6 6 6-14 21-4 0-20 2-7-10-1-17 2-5 17-13 0-4-6-4-8 1-4 5 1 5-16 11-4 11 7 13-5 9-5 1-7 24-6-3-4 6-6-2-8-40-12 7-7-1-6-6zM424 115l5-13 4 1 7-3-3 9 3 3-8 6 1 5-8-3zM439 118l8-1-1 9-2 3z',
      VAL: 'M437 172l14-3 3 2-2-21 1-7 4-2 16-2 5 6 20 8 0-6-7-6 0-16 3-6 5-2 3 8 4 1 2-13-2 1-3-5 0-5 12-2 9 3-3 19 4 15 5 6 7 2 0 8 8 18-6 2 2 12 9-2 2 9 0 3 3 1 2 7 5 4 4-2 3 5 9 3-3 21-5 1-4 10-16 12-1 7-5-7-2 4-7-6 0-4-4 1-8 15-6-4 2-17-6-19-9 3-8-7-6 2-8 14-9-3-7 1-5-5-7-15 3-9 3 2 2-9-9-10-7 2-9-15z',
      MER: 'M283 235l4-15-2-5 8-19 5-20 8-4 28 14 0 4 13 12 2 3 7 3-2 5-8 3-7-2-12 13 0 7-7 9-4 0-5 7-10-5-6 6-2-13-4-4-2 3zM377 262l5-19 3 3 5 0 1 9-6 13-3-3-4 1zM388 208l5-15 2 3 8 1 4 3 2-2 8 4 1-4 4 4 8 0 0 4 9 8-2 10-5-5-6 1-3 7 9 39 5 3 1 4-3 0 8 14 3 9-3 5-2-7-4-5-6 4 3 7-3 5-3-1-8 6-3-1 8-9-2-23-4-11-5-4-6-18-3-9 2-10-7-10-11 0 2-3zM396 297l3-5 19 13-6 6-4 9z',
      BAL: 'M434 227l3-3 2-10 5 4 11 2 11 19 7-1 9 3 8-14 6-2 8 7 7-3 4 2 4 17-2 17 2 3 2-2 2 6-4 1-5 14-8 13-1 7-3-3-6 2 1 4-6 7-5-4-8-1 1 8-6-1-1-7-2 1-1 14-3 1 2 11-3 7-4-6-1 6-4-1-1 11-4-2-3-8 4-18 0-27 8-14-2-8-14-25-3-11 1-10-4-4-3 3zM452 370l3-4 2 5 10 8-1 3-8-4zM498 396l14-3-5 4 0 3-7 3z',
      ACE: 'M608 220l6-26 5 5 0-8 10-16 8-3 16 4 5-7 8-3 6 2 2-4 6-3 1-4-8-3 7-13-4-5 1-3 17-10 16-14 8-1 3 7 5-3 6 1 0 4 14-12-1 3 7 4 15 16 1-4 7 3 6-4 12 8 5-2 3 4-1 6-3 1 1 12-9 0 1 16-10 9 9 14-3 3 2 8-7 13-6 4 0 7-6 2-5 7-1 10 4 9 5-2 4 13-16 18-2 7 4 9-2 16-5 4 3 6-4 14 1 6-13 18-3 9 0 9-7 11-17 14-11 3 5-15-1-7-5 2-5-15 2-9-3 0 2-28-2-10-5 2-9-7-18 1-7 6-4 11-6 5-2-23-5-2 2-10-5 1 2-12 6 0 5-7-6-12-5 6-1 10-1-21-7-1-2-10-3-2 0-4 5-1 1-10 9-4 0-19-5 3-5-1-11 13-2-1 0-6-2-7-4 2z',
      SUB: 'M704 409l11-3 17-14 7-11 0-9 3-9 13-18-1-6 4-14-3-6 5-4 1-5 1-11-4-9 2-7 16-18 5 2 3 7 10-1 7 9 6 17-4 1 3 10 6 2 8 2 1-3 4 0 17 8 8-2 2-3 0 7 4-12 5 3 2-2 5-16 2 2 2-5 1 10 2 1-1 11-1-1-4 8-3 21-10 31-5 18 4-25-2 1-3 11-3-1-7 11-7 18-30 59-10 14-27 69-18 32 26-137-13 15-6-7 4-6-1-3-7-3-4 1-1-6-5-4-32 27 3-14 9-12 0-4-4 0 0-9-7 0zM750 593l15-40-2 11-7 21z',
      ASE: 'M786 611l3-39 5 0 0 22 2-1 2 9-1 8 5 11-4 17-3 2-5-6zM796 644l3-6 4-2 4 2 7-6 6-1 1 3 9-1-5 4zM797 588l9-48 23-58 16-48-9 18-1-3 10-29 24-100 4-8 1 1 1-11 3 6-7 39 2-2-3 22 0 6 3-3-2 7 4-13 9-13 0 20-13 31-16 67-8 21-24 40 5-15 0-7 5-18 1-5-2 1 4-10-2 1-22 52-10 66-2 1zM814 599l6-19 4-1 2-7 6-6 21-39 1 6 3 2-10 22-1 9 3 4-4 4-11 34-5 3 0-3-4 0-4 4-1-2-5 2zM833 634l5-7 3-1 1 2zM844 595l12-31 11-4 5-7-4 10-16 10-1 5 2 4 10-10-1 4-7 8 4 14-3 7 1-7-4 4-1-12-2 3-2 15-4 1 2-11zM844 627l12-9-1 3zM857 628l6-11 8-6zM858 512l17-33-2 8zM871 517l3-10 13-14 2-8 2 4-4 18-3 8 1-8-3 5-2 10-3-2 1-14zM877 582l1-4 9-3 1 4zM879 491l5-13 2-1-2 7 2-5-7 17zM879 562l2-15 2-3 2 6-4 14-1 1zM883 468l1-13 3 0 0 3zM887 451l15-51 2 3 2-3-4 14-11 31 3-1 2 4-3 12-1-9-2 5 0-6-3 3zM888 483l5-23 3-1-2 14-2-2zM889 561l8-7 5 0 0 12 4 2 9-14 13 0-3 40-5-4-8 5 4-8-2-10-15-5-3 5-3-6 7-7-6 2z',
      PAC: 'M819 713l3-13 0 3 9-13 15-12 8-19 1 4 2-2 0-5 7-12 5-4 5 3 5-2 4-13 8-6 0-2-3-1 2-1 11 1 5-4 2 2-6 16 14 7 4 1 3-2 7-38 5 19 3-2 3 3 4 22 10 6 4 11 1-1 12 18 3 24-2 18-9 28 0 13-7 3-7 9-6-4 0-4-5 7-12-5-5-13-6-3 0-8-5 7 3-17-7 15-3-3-4-11-12-5-19 9-7 7-2 6-14 5-6 8-5 1-7-3 2-12-11-27 2 1-1-4 3 2zM925 594l3-40 14 3 4 8 7 2-3 9 6 8 2-1 0 3 6 3-3 3-9-1-6-10-6-1-6 6 1 4-4 3zM944 784l7 2 7-2 0 17-2-2-2 5-3-1zM956 564l7-7 0 3 3-1 6-10-2 9-7 7zM966 542l1-2 5 3 3 7-1 2-1-5zM981 553l5 7-1 3-2-2z',
      LEV: 'M479 367l0-20 7-8-1-7 10-8 8 3 5-9 8 4 15-9 9 0 12 13 12-2 8-8 6-2 4 5-1 11 6 5-5 5-2 20 5 24 5 3 0 8-4 5-2 10 6 11 10 5 5 8-1 9 3-1 0 6 5 5-10 1-5 12-15 2-24-20-21-11-15 7 8 12-3 5-4 1-4 6-7-3-7-21 16-52 0-6 3-4-3 0-4-3-6 6-9-1-2-7-5-3-3 5-4-1-3-8zM489 325l2-8 6-7-1-4 6-2 3 3-1 5 3 5-2 3-6-2z',
      ZAM: 'M568 293l12-1 7 7 4-3 5 1 1 4 5 2 4 7 2 0 6-11 5 14 3-1 2 3-6 3-5 21 1 15 7 1 5 5 10-2 11-9 11-20 7-6 18-1 9 7 5-2 2 10-2 28 3 0-2 9 5 15 5-2 1 7-5 15 6 8 7 0 0 9 4 0 0 4-9 12-3 14-29 12-3-11-3 0-13 14-9 1-8-4-8 0-12-22-4 4-5-3-3 6-5-5 0-6-3 1 1-9-5-8-10-5-6-11 2-10 4-5 0-8-5-3-5-24 2-20 5-5-6-5 1-11-4-5-6 2 2-15z',
      GOL: 'M511 470l1-5 7 3 4-6 4-1 3-5-8-12 15-7 21 11 24 20 15-2 5-12 5-1 9 24 11 7 0 8 6 10 1-13 2-2 2 2-1 13 3 5 16-9 17-32 0 15 3 5 13-1 5 6 2-1-10 27-3 2-4 16-20 29-15 13-2 8-22 22-17 13-4 6-8 3-7-22-1-14-13-23-15-17-3-13-6-11-8-7-23-42-3-1z',
      MAG: 'M271 364l1-24 3 0 4-22-1-34 2-7 7-8 6-17 3 1 2 6 10 7 5-3 6 1 9-3 19 9 3 4 6 0 8 8 13 4 4 4-2 5 6 0-5 6-4 18-5 2 0 7 3 3 3 10 20 27 2 13 19 27 6-4-1-10 3-4 5-2 4 1 7 7 1 7 9 9 1 5 8 4 13 15 7-3 5 1 4 3 2 6 1-3 9 6 3-2 6 20-2 17-1 1-3-4-10-22 3 13 14 30 15 25 1 9 11 12-37-6-34-12 6 23-6-2 1 4-55-70-6 7-15-20-9 17-4 21-5 4-4-1-4-10-54-92-26-53 4 23-11-6 9 39-3 0 1 7 7 23-14-8 0 5z',
      SAH: 'M280 433l14 8-7-23-1-7 3 0-9-39 11 6-4-23 26 53 54 92 4 10 4 1 5-4 4-21 9-17 15 20 6-7 55 70 13 46-5-2 1 15 3 18 7 16-4 5-1 11-3 4-5-1-2 11-10 3-4-14-6-9 0-5 2 2 3 0-8-26-3-9-1 5-6-15-3 5-7-6-4 0-1 5-2-1-7-8-1 3-3-1-8-13-5 1 0 2 4 26-7-9-3 14-16-5 5 17-4-4-3 2-11-16-1 3-6-4-11-31-3 3-6-7-24-62-6-11-6-2 0 4z',
      COR: 'M468 527l34 12 37 6 10 34 7 6 8 19 24 25 2 6-3 2 7 9 14-7 25-20-5 24-13 34-11 20-28 40-6 12-6-3 0-3-15-8-18 5 1-14 4-7-2-9-6-7-7 2-26-38-1-11-13-27-4-33 5 2-14-50 6 2z',
      AOU: 'M301 512l0-4 6 2 6 11 24 62 6 7 3-3 11 31 6 4 1-3 11 16 3-2 4 4-5-17 16 5 3-14 7 9-4-28 5-1 8 13 3 1 1-3 7 8 2 1 1-5 4 0 7 6 3-5 10 26-1 47-2 3-5-5-3 5 0 14-10 2-10-18-9-1-14 6-12-9-10-1-27-40-28-60-17-48z',
      CAR: 'M61 390l1-5 5 0-4-9 1-4 7 0 2-4-1 19 13 1 6 6 2 35 8 13 6-4 5 4 3 10-1 4-2-8-5-5-3 5 2 4-3 2 0-5-9-6-6-13 0 4-2-3-1-8-7-17-3 1-10-7zM81 343l5-8 8 0 5 6 3-1 12 17 2 4-2 2-8-1 1-4-6-11-10-6 0-3-3-1-4 6zM99 324l1-5 3 11zM105 374l2-2 5 4 0 2-3 1zM117 374l6 1-4-11 7 2 9 13-1 3-6-3-1 6-4-6-4 0zM164 459l0-5 2 1 1 6z',
      AND: 'M106 531l5-12-1-3-1 3-2-3 2-19 4-3 5-14-4-32 6-5 1-11 5 1 4-7 3 3-2 4 2 18 2-5-2-9 3-1 0-6 7 15 6 2 5 7 2-4 7 4-2 1 1 4 11 18-3 15 3 11-7 1-6-6 7 16-3 3-6 0-6-11 0 2-7-3 2 8-2-1 3 11 0 19-4-2-7 3-3 13 3 13 8 7 2-3 2 12 7 2 6-4 4 1 1 12 18 24 2 16 7 5 3 13-2 10-4-7-10-3-3 15-5-4-1 5-8-9-3 5-2-1-4-17 1-6-4-13-3 4-21-32-12-45-9-16z',
      CSU: 'M128 823l4-6 1-12 4 3 2-15-2-2-2 9-2-1 4-28-1-15 8-32 0-23 6-48-1-20 3-4 4 13-1 6 4 17 2 1 3-5 8 9 1-5 5 4 3-15 10 3 4 5 1 14 8 5 1 10 5 3 0 3-2 6 4 4 0 4-15 13 14 16 1 10-6 5-10-6-3-4 6 18-3 10-6 2-12-2 1 13-6 2-4-3-1 2 0 7 3 2 2-2 1 4-7 5-1 11-4-1-3 4-1 5 7 7-8 17-28 0 1-16 4-5z',
    },
  },
  afrique: {
    w: 1000, h: 900,
    pos: { TAM: [134, 83], KSO: [322, 83], MAZ: [510, 124], OUR: [698, 145], TAD: [98, 225], NIO: [286, 205], BOU: [474, 246], DOU: [662, 267], LAG: [98, 347], PAL: [286, 327], AKO: [286, 449], VOL: [474, 368], NGO: [662, 389], BAS: [474, 490], KAN: [662, 511], LOM: [532, 633], SAB: [850, 316], DAL: [850, 438], IMB: [850, 560], TOU: [727, 682] },
    labels: [['Océan Atlantique', 120, 640], ['Océan|Indien', 950, 560], ['Méditerranée', 520, 30]],
    homeLabels: [],
    grat: 'M13 938l1-127 8-201 0-66-7-63-25-123-4-46 7-109-1-139 5-43 10-57M142 939l1-102 7-77 12-65 34-118 5-47-3-35-10-32-13-28-37-62-13-31-4-37 12-72-1-30-8-28-32-62-6-21 1-22 6-24 38-81M271 939l-5-127 2-45 6-45 9-35 12-35 52-118 7-27 2-23-2-25-7-28-30-72-9-33 1-32 17-82-1-26-11-27-47-66-12-34-1-37 13-59M400 938l-14-112-5-77 3-83 9-69 13-43 17-34 21-29 54-61 21-31 10-23 3-29-3-20-9-26-65-126-33-76-9-34-7-34-4-68M529 937l-16-99-4-65 6-64 14-64 18-54 23-47 29-41 74-87 13-24 5-23-3-22-12-28-85-117-23-38-16-33-10-33-6-35-3-46-1-54M658 937l-14-77-6-47 0-46 6-34 11-28 18-27 74-74 18-23 13-31 4-35-5-101-8-62-14-49-44-117-22-69-16-73-9-80M788 937l-12-77-5-48-1-41 4-35 8-29 11-23 51-76 14-25 8-26 2-21-3-29-17-75 0-29 9-81-2-36-8-45-36-164-17-113M920 937l-7-97 0-72 4-55 16-136 0-158 10-160-2-80-17-216M-39 829l137 11 119 4 302-12 519-5M-38 709l165 28 51 5 48 2 61-4 131-18 74-7 188 1 244-9 114-2M-37 589l185 45 59 10 45 3 47-5 97-28 69-10 69-3 158 8 86 0 44-4 45-14 36-6 57-3 80 1M-39 467l230 60 52 11 44 4 21-1 22-5 103-47 36-10 33-5 84-4 102 10 77-1 61-8 17-6 11-12 24-3 55 2 107 9M-46 342l136 5 110 14 45 2 21-3 38-11 40-4 187-11 137-14 99 3 90-7 41 3 143 19M-45 220l63 0 63-5 33-7 109-29 59-8 39 4 106 26 43 6 34 1 98-6 129 4 139-2 62 3 109 10M-45 98l87 2 178-14 83-3 375 16 209-6 154 3',
    land: 'M10 282l13-12 11-26-1-13-3-4 3-2 1-8-8-10-2 3 2-13 6-8 4-15 11-12 2-18 8-7 4-14 14-6 10-9 6-12-4-6 1-8 7-13 9-9 24-9 23-22 9-2 2 5 7 3 30-4 1 3 15 0 62-19 40-5 15 0 8 3 17-5 19 2 23-5 2 2 5-1 3 6 7-4 2 2-7 7 9 12-11 11 4 6 8 1 4 4 13 5 12 0 24 6 8 11 28 7 16 8 8-1 5-4 2-3-5-9 2-4 20-8 21 5 4 5 23 4 6 5 23 2 34 9 26-9 11 0 4 3-3-2-2 2 5 3 2-3 13 3 13-3 5-8 7-28 3-4-6-22 4-6-2-1-8 4-9-2-12 7-12 2-22-9-8-1-2 8-10 1-7-2-4-5-20 0 10-4-13 0 3-2-7-6 2-4-13-4 2-4 3 4 6-2-5-3 3-2-5-5 3-3-11 0 1-6 7-5 307-1 1 2-11 2-1 9-6 6 2 11 3 4 12 2 11 7 10 2 29-2-3-25-3-4-7 0 1-4 5 0-2-4-6-1 0 3-4-8 71 0 0 179-9-3-7-16-7-1-17 7-11-3-14-11-11-4-20-27-6 2-7-6-1 5-10 1 2 5-4 1 4 1 10 19 17 13 0 8 9 14-1-8 2-6 3-2 3 3 1 10-2 8 5 1 1 4 28-2 23-23-1 16 4 6 6 7 10 3-2 57-12 2-4 8-11 1-4 9-11-1-16 4-4 4 0 6-6 2-23 6-7 6-6-1-12 5-10 0-5 6-9 1-5-1-2-7-4-19-2-3-2-17-25-33-13-6-9-10-4-14-6-7-7-6-10-4-7-10-32-29-8 0 1-17-5 21-15-9-13-16-2 4 10 12 11 8 9 13 22 23 9 5-2 0 4 10 16 9 8 10 8 21 16 10 19 32 0-4 5 5 9 5 18 21 3 9-7 6 5 0 8 14 5 1 8-4 6 2 8-4 27-1 7-4 5 2-4 17 4 1-5 0-2 11-35 58-21 25-17 14-8 15-4 13-1 25 4 40-1 35-15 38 1 6-19 29-10 20-24 21-45 17-18 12-24 12-4-1-2 9 4 13-1 8 2-3 1 2-4 22-6 5-29 12-2 4 3 3 1-2-4 25-14 13-15 23-33 26-15 3-2 3-8 0-2 2-29-2-9 5-16 1-6 4-16-5-2-3-4 3 0-7-9-10 5-4-3-9-13-15-9-16-20-20-12-34-1-20-34-47 1-24 12-29 17-17 4-12-8-22 7-9-8-26 12-5-9 3-2-2 1-9-7-19-1-16 3-8 0 4 2-2 1-3-3 1 4-9 9-6 9-11-1 3 3 0 4-3-4 0 0-3 42-41 4-8-2 1 1-3 5-4-6 3-6-1 4-7-4-1-3 2 2-3-4-2-2 6-18 4-2-2 0 3-5 3 0-5-1 5-4 2 0-2-9 5-7-7-1-7 4-4-6 1 5-2-6 0-4-5-8-4-19 3 5-4-7 5-19 6-14 8-4 8-9 4-18 32-11-1 1-1-2-3 0 5-8 0-8 5-39 8-14 0-44-20-42-27-70-37-4-7-7-2-14-13 4 1 1-4-4 1-3-5 2 0-14-13-2-6-11-5-3-8-4-3-1 2-1-5-2 2-2-3-1-4 4-1-5-3 5-3-10 4 0-3-4-1 1-2-5-2 0-2 3-1-3 0 0-11 4 2 11-3-11 2-3-7 2-2-2 1-3-8zM117 15l11-18 2 0-6 0 1-3 8-5-6 4-4 0 20-23 129 0-15 11 1 5 5 4-13 5-6 7 0 2-15 3-12 8-37 2-23 9-6-2-2-6 4-3-3 2-4-6-14 4zM298 -20l12-5-1 2 5 1-6 5zM381 -26l0-4 17 0-1 14-7-1 0 2-5 2-3-4 1-7zM434 0l4-5 14 3 22-3-5 8 2 6-2 4-4 0zM466 -29l25-1-4 8 7 4 1 5-7 2-1 4-6 5-6 0 3-7 4-2-5-13zM496 -30l13 0 3 4-3 3-5-5zM523 -30l43 0 0 5 10 11-5-2 2 3-7 2 19 8 2 6-7-3-7 1 6 5-4 2-6-3 7 13-7-4-3 4-5-7-3 4-2-2-2-3 1-3-8-6 9-5 14 4 5-2-11-4-17 1-5-6 5-2-11-4-6-8zM570 -30l15 1 4 3-7-3 3 4-8-3 4 4-4 0zM570 -11l6-2 11 5 3 5 4 2-2 1-6-5zM582 31l2-3 9 4 20 1 1 3 7-3-1 4-20 0zM704 37l7-1 0-3 9 1 12-4-7 4 1 3-12 6-8-1zM820 739l6-12 4-2 12-16 2-27 12-17 22-7 2 2 1-4 7-5 2 2 5-8 1 3 6-5-1-4 3-8 11-6 1-10 6-5 6 12 3 28-5 8-3-6-3 1-1 15-4 6-3 13-39 79-24 10-17-4-8-10 1-11zM977 299l2-2 11 4-9 1z',
    regions: {
      TAM: 'M24 210l2-13 6-8 4-15 11-12 2-18 8-7 4-14 14-6 10-9 6-12-4-6 1-8 7-13 8-8 25-10 23-22 9-2 2 5 7 3 30-4 1 3 12 0 7 3 1 16 5 5 7 2-3 5-33 2-3 3-17 3 1 4 4 3-64 21-10 8 17 26-46 8 10 29-14 10 5 17-54 5z',
      KSO: 'M107 109l16-11 26-6 7-5 25-7-4-3-1-4 17-3 3-3 34-2-1-3 4-1-8-3-5-5-1-16-7-3 41-10 19-8 45-6 15 0 8 3 17-5 19 2 23-5 2 2 5-1 3 6 8-4 1 2-7 8 9 11-12 12 5 5 8 1 7 5 2 8-13 9-1 2 3 8-3 4-6 3 9 10 7 16 0 5 5 9-3 5 18 19 16 4 11 10-61 39-38-4-3-3 1-2-2-5-24-12-12-11-43-17-54-11-122-15z',
      MAZ: 'M410 86l6-3 3-4-3-8 1-2 13-8-2-9 46 10 8 11 28 7 18 8 8-2 4-5-4-10 2-4 13-6 15-1 13 4 4 5 26 5 2 3-4 3 3 7-2 7 7 11 15 49 21 49-13 0 3 5-122-43-14 10-13-6-19-5-11-10-14-3-20-20 3-5-5-9 0-5-7-16z',
      OUR: 'M607 80l4-3 11 1 47 11 26-9 11 0 4 3-3-2-2 2 5 3 1-3 6 3 21-4 14 22-4 20-15-9-13-16-2 4 4 4 48 52 9 5-3 2 5 8 17 10-68 2-1-2-9 2-79-3-14-38-12-40-7-12 2-6z',
      TAD: 'M10 282l13-12 11-26-1-13-3-4 3-2 1-8-8-10-2 3 1-6 54-5-5-17 14-10-10-29 46-8-9-12 84 10-33 5 29 25 17 19 11 18 5 24 6 3-5 14-83 15-5-1-1 3-7 2-20 2-5 5-10-5-11 11-6 1-1 5 3 3-2 8 3 4 4-1 3 6-1 8-17 2-22-4-18 2-17 5 0-2 3-1-3 0 0-11 4 2 11-3-11 2-3-7 2-2-2 1-3-8z',
      NIO: 'M80 279l1-5 6-1 11-11 10 5 5-5 27-4 3-4 0 3 3-1 83-15 5-14-6-3-3-18-8-17-17-21-34-30 33-5 62 9 44 12 29 12 12 11 23 11 4 10 15 3 5 34-4 11-7 5-40-6-7 3-12 0-14-5-21 11-4 6-5-2-10 14-4 0-4 11-7-4-5 6 0 9-4 3 1 8-2 4-10 9 3 11-2 8 5 16-6 1-1 4-5-1-5-12-3 2 1 2-6-2 2 7-6 0 0 5-15-8-4 0-7 5-2-4-8-4-6-11-9-2 5-6-12-7-1-5-9-10-7-1 1 4-10 4-12-4-10 5-6-5-8 3-4-3 4-11-3-6-4 1-3-4 2-8z',
      BOU: 'M320 255l3-8 12 1 7-3 40 6 7-5 4-11-5-34 24 2 61-39 19 5 13 6 6-5 13 18 19 13 1 5 23 35-3 33 8 8-13 8-6 1-13-2-17 1-6 2-6 5-8 0-29-7-17 4-16-10-17-5-19 0-8 3-2 9-8 6 0 14-19-12-10 2 1 6-7-8 3-2-3-5-11 1-11-8 0-7 5 1-10-8z',
      DOU: 'M511 170l8-5 122 43-3-5 13 0-10-20 79 3 9-2 1 2 68-2 7 9 10 24 14 8-10 10-4 1-1 21 4 10 0 17-4 2-4 10 1 13-4 0-2 3 1 16-2 0-2-10-9-6-5-19-11 3 7 12-8 18-5 0-10-7-4 7-5 3 0 4-8 0-3-4-12 1-12-14-6 1 2 20-1 3-6-3-8-19-13-12-3 5 3 18-1 2-9 3 3 4-1 8-9 1-9 7-4-4-8 5-8 1 0-4-9-9-24-13 3-4 22-3-12-7-10-15-9-7-10-6-6 0-20-14 3-33-23-35-1-5-19-13z',
      LAG: 'M16 312l17-5 27-2 11 3 19-1-3 3 4 3 8-3 6 5 10-5 12 4 10-4-1-4 9 1 8 15 12 7-5 6 9 2 6 11 9 5-1 7 5 11 8 2 2 6 5 3-3 1 2 5 9 4 4 6-17-4 2 5 10 5 0 10-15-5-3 8-18-7-1-6-13-15-10-5-14-2 2 6-5 2 2 6-9 7-2 6-28-14-4-7-7-2-14-13 4 1 1-4-4 1-3-5 2 0-14-13-2-6-11-5-3-8-4-3-1 2-1-5-2 2-2-3-1-4 4-1-5-3 5-3-10 4 0-3-4-1 1-2zM85 390l9 2 1 3z',
      AKO: 'M124 409l2-6 9-7-2-6 5-2-2-6 4 0 3 3 8-1 9 5 13 15 1 6 13 6 6 1 2-8 15 6 0-11-10-5-2-5 17 4-4-6-9-4-2-5 3-1-5-3-2-6-8-2-5-12 9-8 19 8 0-5 6 0-2-7 6 2-1-2 3-2 2 5 6 8 6-6 10 3 14 14 5 1 3-8 6-1 9 8 16 29 10 34 13 22 1 10-3-3 0 5-8 0-8 5-39 8-14 0-44-20z',
      PAL: 'M234 318l10-9 2-4-1-8 4-3-2-8 5-6 9 3 4-11 4 0 9-13 6 1 4-6 21-11 8 1 6 4-3 7 5 16 10 8-5-1 0 6 11 9 11-1 3 5-3 2 7 8-9 9-12 0-11 9-1 13 14 7 4 11 7 8 12 40 7 13-9 7-1 6-9 4-17 31-11 0 2-2-1-6-14-25-10-34-16-29-9-8-6 1-3 8-5-1-7-5-5-7-9-4-5-16 2-8z',
      VOL: 'M325 331l2-6 10-9 13 0 6-4 4-7-2-4 12-2 18 12-1-14 8-6 2-9 5-2 22-1 17 5 16 10 17-4 29 7 8 0 6-5 6-2 36 1 4-5 9-4 12 6 8 8 8 2 4 9-8 5-4 21-4 3-2 8-7 4-8 15-6 5 1 1-18 12-1-4-6-3-5 3-5-1-26 18-19 21-4-1-2 5-18 4-2-2 0 3-5 3 0-5-1 5-4 2 0-2-9 5-7-7-1-7 4-4-6 1 5-2-6 0-4-5-8-4-18 3 4-4-7 5-29 11 2-2-7-13-12-40-6-6-5-13-13-7z',
      NGO: 'M479 450l12-14 4-8-2 1 1-3 5-4-8 3-4-1 4-7-7 0 19-22 28-19 5 1 5-3 6 3 1 4 8-3 10-8-1-2 6-5 8-15 7-4 2-8 4-3 4-21 8-5-4-9-8-2-8-8 6 0 10 6 9 7 10 15 12 7-22 3-3 4 24 13 9 9 0 4 8-1 8-5 4 4 9-7 9-1 1-8-3-4 3-1 6-2 1-15-3-5 3-5 3 1 14 16 5 15 12 11 6 11 11 13 2 9 6 5 3 10-3-1-3 2-13-5-5 6-6-2-9 5-4-2-6 9-12-8-3-12-13 11-10 14 1-2-6 2-6-4-17 3-43 30-3-3-16 0-3-3-45 4z',
      BAS: 'M421 521l2-1-2 0 1-6 3-8 0 4 2-2 1-3-3 1 4-9 9-6 9-11-1 3 3 0 4-3-4 0 0-3 30-28 43-8 45-4 3 3 16 0 2 4 14-10 32-21 15-3 6 4 6-2-10 11-70 56-27 10-27 14-16 19-37 20-7 0 3-7-12 3-7 5-7-4-14 9zM470 438l10-8 2 0-7 7z',
      KAN: 'M429 558l4-2 2-8 12-7 4 2 7-5 12-3-3 7 5 0 29-14 10-6 16-19 27-14 27-10 77-62 12-17 12-10 3 0 2 12 11 7 6-9 4 2 9-5 6 2 5-6 13 5 3-2 3 1-3-10-6-5-2-9-11-13-6-11-6-4-2-28 6-1 12 14 12-1 3 4 8 0 0-4 5-3 4-7 10 8 4-1 9-18-7-12 11-3 5 19 9 6 6 20-1 4-6 1-2 8 10 4 6 8 8 20-8 25-1 4-5-1-7 7-4-4-9 4-1 19 6 3 1 3-15 21-6 35-6 4-3 9-5 4 6 8-2 11 3 8-3 6 3 11-4 4 0 3 10 9 2 13-41 4-17 8 0 5-7 9-14 10-1 3 5 6 15-2-15 14-1-2-10 1-2-9-13-4-2-7-14 4-19-4-2-2 2-3-19 1 1-3-4-3-36 1-1-3 5-7-5-9 5-8 5-15-23-2 2-4-14 0-7 2-8 9-33 1-7-10 1-13-4-3-57 3-9 3z',
      LOM: 'M403 693l1-16 12-29 19-21 2-10-8-20 7-9-8-26 12-5 57-3 4 3-1 13 7 10 33-1 8-9 7-2 14 0-2 4 23 2-5 15-5 8 5 9-5 7 1 3 36-1 4 3-1 3 19-1-2 3 2 2 19 4 14-4 2 7 13 4-1 3 4 6 11 0 14-13-13 3-7-7 1-3 14-10 7-9 0-5 17-8 41-4 2 5 7 0 1 3 10 2 5 3-2 2 3 0-6 10-10 4-17 13 0 2-28 14-2 4 3 0-51 11-4 7-23 3-7 6-14 4-24 12-34-8-55 5-27-2-7-4-63 6-12-4zM429 556l1-8 3-3 11-6 2 2-11 7-2 9z',
      SAB: 'M799 351l2-8 7-3-3-27 2-4 4 0-1-13 4-10 4-2 0-17-4-10 1-21 4-1 10-10 19 31 0-4 5 5 9 5 18 21 3 9-7 6 5 1-5 10 9 20 24 16 9 1-33 37-12 0-14 12-5 1-1-4-7 13-5 0-6-9-6 0-2-12-4 0-8-21-6-8z',
      DAL: 'M774 493l6-29 15-21-1-3-6-3 0-16 3-5 4 1 3-3 4 4 7-7 5 1 9-29 4 1 3 13 5-1 6 9 5 0 7-13 1 4 5-1 14-12 12 0 33-37-9-1-24-16-9-20 5-10 8 13 5 1 8-4 6 2 8-4 27-1 7-4 5 2-4 17 4 0-5 1-2 11-35 58-21 25-17 14-6 11-7 25 4 61-7-23-24-18-46 7-8 7-7-1z',
      IMB: 'M760 516l5-4 1-5 4-5 9-4 3 2 6-6 47-8 15 10 10 9 6 22-2 32-14 37 1 4-13 10-11 5-10 6-21 2 16-16 1-5-9 1-29-11-1-14-11-11 0-3 4-4-3-11 3-6-3-8 2-11z',
      TOU: 'M657 744l17-14 3-7 9-7 2-13 19-23-14-7-10 0 7-11 51-11-3 0 2-4 28-14 0-2 17-13 10-4 5-8 1-2-3 0 2-2 9 2 4-3 0 3-17 19 25-4 17-9 13-10 0 2-19 29-10 20-8 9-30 19-31 10-18 12-24 12-4-1-2 9 4 13-1 8 2-3 1 2-4 16 1 4-7 7-29 12-2 4 3 3 1-2 0 9-10 0-3-13 2-15z',
    },
  },
  europe: {
    w: 1000, h: 860,
    pos: { NRL: [443, 65], FRI: [474, 187], SKA: [631, 65], BLT: [798, 245], LOR: [150, 341], ARV: [338, 401], BEL: [526, 430], KAL: [714, 367], MOR: [902, 450], RUV: [714, 489], TES: [865, 611], IBE: [191, 710], LUS: [489, 674], DLM: [677, 673], EGE: [755, 795], COM: [526, 308], PAR: [338, 548], CON: [526, 552] },
    labels: [['Atlantique', 75, 592], ['Mer du Nord', 312, 262], ['Baltique', 662, 178], ['Méditerranée', 330, 770]],
    homeLabels: [['France', 215, 564]],
    homeP: 'M102 496l3-5 18-3 9 10 4-3 7 3 1-3 9 2-3-5-1-12-5-15 11 1 2 9 18 4 12-4-5-2 2-7 25-9 10-9 3-18 4-5 26-10 0 9 3 4 2 2 9-3 2 9 10 2 1 7 9-1 6 3-4 12 12 0 13-8-4 8 0 7 12 5 5 7 12-1 6 3 8-2 10 2 3 12 8-2 4 1-1 3 19-2 4 4 19 2-26 16-27 19-17 19 1 2-13 6-12-1-3 2 2 2-20 11-2 6-8 4-5 11 6 0 1-4 5-2 9 1 0 6 7 7-6 4 10 9-1 4-11 2 3 4 9 6-3 4 3 4 22 6-4 5 1 2-7 3-11 10-15 1-19-9-6 1-17-7-7 7 0 5 9 12-6-2-2 2-10-3-24-15-1 3-16-7-15-9-9-10 3-2-16-47 13 15-16-21 2 0-5-15-11-8-6-9-4-10 2-2 5 2-12-5 1-4-6-2 0-3-23-10-7-7 5-2-5-4 5 0zM382 684l4-5 13-3-1-5 1-2 11 20-2 5 2 5-3 8-8-3-3-2 1-3-9-5 0-4z',
    grat: 'M63 942l6-152-1-68-7-53-31-171-5-55-2-56 1-57 5-72 36-338M170 941l7-151-2-68-10-38-42-98-16-51-10-55-5-74 2-45 8-63 56-281 14-96M277 941l-6-118-11-64-16-49-52-107-11-39-4-43 4-65 15-104 74-376 9-54M385 939l-11-73-17-61-23-59-57-112-7-24-2-27 6-30 7-17 29-58 18-42 13-43 10-43 6-43 3-59 1-172 24-152M492 938l-17-79-62-201-6-34 5-25 14-30 26-35 55-63 16-23 9-23 1-23-5-23-29-90-10-64-9-150 8-87 2-64M598 937l-30-153-11-102-4-55 1-31 4-34 19-78 6-42-1-41-21-99 1-38 9-52 36-151 0-30-12-108M704 936l-12-84-1-46 29-224 8-82 3-69-4-64-20-80-7-46 0-58 11-91 1-35-11-135M809 936l-1-72 5-48 12-49 33-119 7-37 0-17-2-51-14-95-40-202-2-56 4-146-3-123M915 938l5-100 28-177 5-78-2-45-19-129-15-154-3-69 1-266M-64 846l289 1 250 12 187 15 67 2 90-5 245-25M-63 710l184-2 70 2 111 22 187 14 153 30 38 6 39 2 40-3 26-5 179-47 99-19M-63 573l98 4 73 7 43 8 94 25 50 7 53 2 118-3 167 6 83-6 180-34 167-16M-63 437l60 4 136 13 136 3 182-4 280-22 64 0 141 6 127 0M-63 300l125 0 77-6 70-13 227-49 45-7 21 2 40 14 49 11 215 35 114 10 144 3M-63 164l103-6 82-9 83-15 180-41 47-7 36-1 36 2 48 7 175 40 81 14 106 10 150 6M-64 27l201-9 236-19 91-3 105 4 252 19 243 8',
    land: 'M-30 9l13 2-4 5 3 3-2 1 4 2-1 2-5 2-2 5-6 2zM18 383l2-4 6 1-2-4 4-4 11-3-2-3-3 4-10 1 6-6 3-9 5-3-8-1-5-3 1-2-4 0 0-4 5-2-2-3 5-2 0-3-5 1 1-7-3-2 1-3 21 1-1-3 8-9-9-1 6-6 2-8 10-3-1 8 3-2 0-6 3-2 1-2 5 4-5 4 2 2 3-5 13-2 4 12-3 6 5-1 1 3 0 4-3-3 0 8-13 9 2 33-7 17 2 3-8 2-1-2-15 11-5-2 1 4-6 4-12 2 2-5-8 1 7-7-10 1 6-8zM68 629l1-3 4-4 9-1 1-5 8-4 13 6 19 0 24 9 12 0 22 9 6-1-15-49 13 15-16-21 2 0-5-15-11-8-6-9-4-10 2-2 5 2-12-5 1-4-6-2 0-3-23-10-7-7 5-2-5-4 5 0-7-3-1-5 21-5 9 10 4-3 7 3 1-3 9 2-3-5-1-12-5-15 11 1 2 9 18 4 12-4-5-2 2-7 29-12 6-6 5-21 5-4 20-6 34-15 27-2-21-1-4-4 11-3 12 5 5-1-8-4 6-2-6-7 25-23 15-28 11-2 12-8 7-8 19-8 27-6 5 5 8 0-5-3 4-13 13-4 10-1 7 11 3-8 4 3 2 6-2-22 13 0 13 13-11-13-9-4-2-13-6-1-1-4 6-4 0-3-7-10-4-25-12-5-3-34 12 2 4-8 3-2 3 2 0-9-3-1-6 10-6 3-6-2 7-12 17-3 10-10 13-3-3 4 1 9-3 6 0 11 11 8-3 6-6-2-3 13-4 0 2 3-6 10 2 9-3 9 4 1 2 8 4 6-1 8 4-1 8 8 2-2 2 16 4 3 9-17 5 4 5 13 4 0 4 15 14 9-1-8-14-4-1-10 11 10 50-6 11-7 46-2 20 8-10-3 8 11 6 3 16 1 11-6 1-8 11 1 6-4 6-8 2-6-1 8-9 9 15 4-2-15-5-12-3-24 0-5 6-5 2-8 6-6 18 0 15 21 8 5 6-1 9-5-2-15 5-16-4-1-5 3-7-4-5-10 3-2-3-1-2-4 2-7 12-1 0-2 7-2 22 2 1-3 51 11 4-3-1-7 6 3 4-4 10 1 4-4 22 4-10-9-14 0-9-6-3-5 3 2 1-4-3-2-23 4-5-2-14 2 0-6-4 5-9-2 2 4-6 1-2-2-25 5-20-2-10 3 4-5-5-6-4 4-6-1 3-9-22-10-1-9 4-14 2-1-6-11 2-6-4-5 0-8 7-6 3 1-2-5 15 0-1-4 6-4 21-8 19-17 15-1 1-15-14-5-1-5-32 1-14-3-3 6-13 3 1 4-4-2 3 5-8 7 8 8-10 6-4 7-21 6-7-1-6 5-8 0-6 3 4 1-1 1-6 2-6-3 4 7-5 1-8-2 0 4 4 3-6 7 2 5-6-2-1 3-2 20 8 6 7 0 15 17 2 9-23 4 13 3 1 2-5 0-4 4-31 4-18-4 13 5 3 3-7 0 1 6-3 8-4 2 0 9-5 6 0 6-7 10-11 12-5 2-25-7-1 4-8 0-5 3 0 11-4 4-7-3-9 0-7-5 3-11-5-21 6 3-2-7 4 1 1-5-7-11-7-25-3-2 0-6-4-5 0-6-4-1-2-15 5-2-11-3-5-5-1-8 0 3-4 2 0 5-5 5-8 1-6-3 2 3-8 2 2 2-1 1-25 16-28 8-6-2-1 2-5 0 2-4-15 0-9-2-6-4 3-8 12 1 6-4-6 2-6-2 2-6 11-8-26 15-6 0 5-11 22-9-12 1 10-10 9-5 0 5 5-6 6-3-20 7-23 20-2-1 2-8 5-2 7-2-10 0-3-5 12-7-12 3-2-8 41-9 6 3 0-3 13-3-5-2 2-2-7 5-13 0-5 3-30 4-2-4 8-3-9-3 2-4 40-5-36 3 0-4 18-7 16-1-10 1 5-5 28-1 3-1-3-1 13-2-32 3 6-5 15-3 12-1 12 4-10-5 11-3-6-3 6-2 13 0-2 2 2 0 14-2 7 4 18-1 0-2 16-3-5-1 7-2-4-1-9 2 3 1-3 1-22 4-11-4 25-11 26-6-9 1 5-3 16-3 8 2 9-4-11 2-7-2 3-5 9-5 8-1-6-3 28-2-20 0-2-4 3-3 406 0 10 9 7 1 1 4 9 2-6 3 22 6 8 7-3 10-5 3 12 18-2 5 11 6 0 497-3 5 3 9 0 26-8 3-9 11-7-4 1-16-16-8 18-16-1-3-7-3-11 3-10-5 2-5-7-3 13 2 3-4-4 1-5-2-6-16 4 16-6 0 0-3-2 4-9 3-7 20-9 5 2 12-2 15-8 4 0-7-2 1-9 48-2 4-6 1-5 7-3 15-10 11 7 12 1 14 14 6-3 8-15 1-15 8-7 10-29 25 3-7 15-13-16 5-1-4-3-2-17 1-9 6-8 0-12 9-8 2-1 9 9 0 2 5-10-4-5 3 5 4-2 5-6-6-6 0 0 6 5 2-8 0 0-6-10-3 2-6-8 4-5 14 15 19-5 2 1-3-6 0-2 3 2 3 2-1-13 6 34 7 0 9-2 3-10-6-12 4 3 5 7 2-8 4-11-3 10 18-10-5-6 6-9-9-3 0-2 5-3-2-4-4 2-5-13-9 7-6 6 1 4-3 25 5 8-4-18-4-23 3-4-3-1 2-4 0-8-10 9-1 0-2-8 0-12-8-9-18-9-5-4-5 3 1-2-7 10-30-11-5-14-15-47-22 20 8-24-20-15-6-12-2-2-4-23-18-2-2 10 0-15-11-2-3-2-11-9-7-7-1-10 14-3-1-7-7-3-10 7-4-4-5-5 2-7-2-5 4-21 5-2 5 8 7-7 6 5 12 36 18 16 25 16 15 18 12 27 7 0 4-7 2 0 2 56 33 13 13-4 9-6-4-6-9-10-3-8-6-6 0-7 6-3 9 16 11 2 9-14 2 0 8-6 2-5 5-8-1-2-6 4-2 1-7 6-1-5-14-10-17-20-10-4-11-12-2 2-3-11-4-9-13-17-4-45-31-14-3-1-4-3-2-18-7-1-6-14-16-44-10-6 2-12 11-18 4-10 7-2 3-9 3-49-16-7 7 0 5 15 23-10 11-12 2-2 5 4 2-3 2-3 23 5 12 9 9-9 9-2 13 2 4-9 1-5 4-8 16-5-3-6 3-30-2-6 6-11 2-4 8-5 3-9-5-7-12 4-8-4 2-10-10 1-2-14 3-8 4-16-3-9 3 4-11-2-28 5 0-3-2-9 2-1-6 5-2 1-7 3-2-3 1-4 8-5 1-3-3 2-14 4-6 5-15 0-24-5-17-3-2 1-5-3-4 3-4-3 0-2-10-4 2 1-6zM81 278l2-5 5-3 0 7-4 4 0-6zM81 216l5-4-3-2 0-5 6-1 1-4 10-6 0 3-8 9 2 2-11 9zM84 446l10-11 11-19 17 0 14-17-16 12-5-1-5-6-6 1 3-3-5-3-8 4-5-8 16-12 5-8-1-12-10 4 7-11 16-7 5 2 2-5 2 3 3 0-5-6 7-23-6 3-5-14 4-7 9-7-10 2-9 6-5-2-5 4-4-3-3 5-3-9 12-17-3-5 1-6 6-3-4-3 1-3-9 9 6-11-8 8-6 19-4 1 7-14-2 0 4-13 9-17-10 8-7-4 8-5-2-2 6-6 1-4-3-6 4-4-2-2 3-6 9-3-3-5 1-3 7-4 3-9 10 0 29-9-5 10-19 14-1 3 3 1-7 8 16-7 28-5 4 2 1 4-24 32-17 9 9-2 5 1-1 2-16 10-8-1 14 2 10-4 9 3 8 9 4 27 12 5 13 10-4 4 6 14-10-3-10 2 9-1 13 11 1 6-10 10 6 3 9-7 19-2 10 5 2 6-10 20-10 5 0 5-2 1-12 4 3 1-1 5-12 4 11 3 14-1-2 7-10 5-3 5-20 6-9-1-12 2-13-5 1 3-3 2-10 1 0 4-8 0-8-4-8 2-5 12-8-6-8 3-5 7-7-1zM85 226l9-8 2 11 7 0-7 7 0-4-5 0zM87 259l4-6-3-3 4-1 5 4-1 4zM101 90l10 1-1 3-3 0 2 4-2 0zM102 352l2-5 6 5-5 4zM103 890l30-16 13-22 11-29 11-3 2 0-1 5 4 8 10 7 6 1 13-2 6 2 8-5 2 7 16 2 30-19 7 1 5-8 11-6 28-1 6-4 14-2 19 2 12 6 20-9 11 5 6-1-2-3 5 1 12 6 18-2 6-4 11-3 3 1 1 4 1-2 7 1 8 12 12-7 3 5-10 12 0 3 5 7 10 6 5 9-6 12-11 11 8 10 9 2zM151 434l5-4 5 3-2 1-3 2zM159 170l3-5 5 1-2 3 6 0-2 2zM203 127l7-3-3-3 6-5 0 4 5 0-3 6-6 10 1-8zM287 738l9-7 8 9-2 7zM382 684l4-5 13-3-1-5 1-2 11 20-2 5 2 5-3 8-8-3-3-2 1-3-9-5 0-4zM388 718l12 0 9-8 12 6 0 2 10 10-3 6 4 6 3 16-1 5-11-3-1 7-7-1-6-6-3-15-4-2-2-9-10-9zM485 205l6-3 4 3 2-2 2 13-2 8-9-5zM501 200l5 1 2-6 2 0 2 10 2-9 7-3 4 4-3 13-4 2 1 10-5 2-1 14-2 1-2-16-4-2zM502 232l3-2 5 9 0 4-3 0zM513 800l1-5 4-2 4 4 6-3 4 1 12 6 41 1 1 1-8 11-1 6 6 8-3 2 0 4-8-2-16-10-37-16zM525 261l4-12 4 7-2 3 2 7-4-3-2 3zM532 622l2-1 3 6 1 9-5-8zM536 623l4-3 8 7zM558 241l3-6 8 9-3 2zM607 211l2-8 18-18 3 0-1 1-18 27-3 0zM654 203l4-4-4-6 2-8 11-6 9 1 3 2-6 3-2 6 3 3zM684 788l6-1 0 5 4 6-3-2zM699 823l6-6 5 7zM700 122l4 1 0-4 4 2 4 3-5 3-6-1zM741 184l3-2-3-4 9 2 6-2 8 2 8 6-13 3-7-1-7 7-1-2 4-4zM746 167l9 1 4-3 5 4 2 5-2 0-8 2-3-6zM763 808l12-6 4 4 14 0 3 9 8 1-4 3-6-1-3-5-10 1-9-6zM775 868l4-4 3 2 7-2-1 2 5 2 32-3 1 4 12-5-2 5-33 5-7-3-19 0zM825 770l1-4 10-3-3 4-1 3-2-2zM836 805l3-2-3-5 5-1 2 2-2 6-3 2zM840 783l13-8 4 5-2 2 1 2-4 1-6-1 4-4-5 4zM846 803l5-10 3 1 1 5 11-5-5 0-2-5 7-6-4 0 1-5-3-3 7-8-19 6 6-14 16-16 12-5 4 3 5-2 5-6 2 0-2 3 22-6-3-3 4-4 17-8-8 0-4-2 2-9 38-6 20-22 18-12 23-2 5-4 0 149-11-4-21 20-19 6-8-2-7-8-13-4-15 1-5 15-17 5-9-2-5-8-14 0-7 5 2-3-14 4 12-5 6-5-22 5 1-3 6-2-7-4-2-5 4-2 1-6zM870 847l3-7 10-5-4 8zM967 854l13-3 1-6 14 0 20-11-13 11 1 6 1 2-8 1-15 12-11-3zM976 -29l54-1 0 18-12-6-7 2-1-3-21-3z',
    regions: {
      NRL: 'M-30 9l13 2-4 5 3 3-2 1 4 2-1 2-5 2-2 5-6 2zM359 89l3 0 1 4-4 0zM361 59l2-2 40-5-37 2 1-3 14-6 21-3-11 2 5-5 28-1 3-1-3-1 13-2-31 3 6-5 21-4 17 4-10-5 11-3-6-3 6-2 13 0-2 2 2 0 14-2 7 4 18-1 0-2 16-3-5-1 7-2-4-1-9 2 3 1-3 1-22 4-11-4 25-11 26-6-9 1 5-3 16-3 8 2 9-4-11 2-7-2 3-5 9-5 8-1-6-3 28-2-20 0-2-4 3-3 57 0-8 4 2 4-2 1-18 1 3 7-3 9-17 12 10 3 2 4-2 2-26-1-20 6 1 2-5 3 5 6-3 1 0 6 4 8-4 8 17 10-5 5-10-1 5 13-3 6-14 3-7 5 2 7-4 8-4 0-2-5-11-3-5-5-1-8 0 3-4 2 0 5-5 5-8 1-6-3 2 3-8 2 2 2-1 1-25 16-28 8-4-3-7 3 1-4-15 0-9-2-6-4 3-8 12 1 6-4-6 2-6-2 2-6 11-8-26 15-6 0 5-11 22-9-12 1 10-10 9-5 0 5 5-6 6-3-20 7-24 21 1-11 12-3-10 0-3-5 12-7-12 3-2-8 41-9 6 3 0-3 13-3-5-2 2-2-4 5-16 0-5 3-25 5-7-2 0-2 8-4-7-2zM504 -1l7-2 5 2z',
      FRI: 'M447 171l12 2 4-8 3-2 3 2 0-9-3-1-6 10-6 3-6-2 7-12 17-3 10-10 13-3-3 4 1 9-3 6 0 11 9 5 1 5-4 5-4-3-3 13-4 0 2 3-6 10 2 9-3 9 4 1 1 7-8 1-12-2-3-21-12-5zM485 205l6-3 4 3 2-2 2 13-2 8-9-5zM497 232l4-7-2 12zM501 200l5 1 2-6 2 0 2 10 2-9 7-3 4 4-3 13-4 2 1 10-5 2-1 14-2 1-2-16-4-2zM502 232l3-2 5 9 0 4-3 0zM514 235l2-5 2 2 1 3zM558 241l3-6 8 9-3 2z',
      SKA: 'M506 109l4-2 3 5 4 0 4-8-2-7 7-5 14-3 3-6-5-13 10 1 5-5-17-10 5-10-5-6 0-6 3-1-5-6 5-3-1-2 16-6 30 1 2-2-2-4-10-3 17-12 3-9-3-7 18-1 2-1-2-4 8-4 280 0-1 4 17 20 5 10-8 2 2 2-5 8 5 3-5 5 4 4 6 1-1 9 10 7 0 4-11 8 25 15 8 9-8 11-32 23-43 26-10-2-14 2 0-6-4 5-9-2 2 4-6 1-2-2-25 5-20-2-10 3 4-5-5-6-4 4-6-1 3-9-23-11 1-11 3-11 2-1-6-11 2-7-5-9 8-9 3 1-2-5 15 0-1-4 6-4 21-8 19-17 15-1 1-15-14-5-1-5-32 1-14-3-3 6-13 3 1 4-4-2 3 5-8 7 8 8-10 6-4 7-21 6-7-1-6 5-8 0-6 3 4 1-1 1-6 2-6-3 4 7-5 1-8-2 0 4 4 3-6 7 2 5-6-2-1 3-2 20 8 6 7 0 15 17 2 9-23 4 13 3 1 2-5 0-4 4-31 4-18-4 13 5 3 3-7 0 1 6-3 8-4 2 0 9-5 6 0 6-7 10-11 12-5 2-25-7-1 4-8 0-5 3 0 11-4 4-7-3-9 0-7-5 3-11-5-21 6 3-2-7 4 1 1-5-7-11-7-25-3-2 0-6-4-5 0-6-4-1zM607 211l2-8 18-18 3 0-1 1-18 27-3 0zM654 203l4-4-4-6 2-8 11-6 9 1 3 2-6 3-2 6 3 3zM749 131l6-1-1 3 1 2-3 0z',
      BLT: 'M724 227l0-5 6-5 2-8 6-6 18 0 15 21 8 5 13-4 2-4-1-17 4-10-3-3-6 3-7-4-5-10 3-2-3-1-2-4 2-7 12-1 0-2 7-2 22 2 1-3 31 8 20 3 2-2 3 3-15 16 2 15 6 11-5 1-4 8 11 7-3 9-1 3 5 0 6 9 2 12-5 1-6 7-12-2-9 4-1 9 7 3-3 3-8 0 0 3-8 4-1 14 5 5-5-1-2-3-11 2-1 5-8 1-18-3-4-8-14-6-3-6 1-9-7-6-11-2-21-9-6-18zM741 184l3-2-3-4 9 2 6-2 8 2 8 6-13 3-7-1-7 7-1-2 4-4zM746 167l9 1 4-3 5 4 2 5-2 0-8 2-3-6z',
      LOR: 'M18 383l2-4 6 1-2-4 4-4 11-3-2-3-3 4-10 1 6-6 3-9 5-3-8-1-5-3 1-2-4 0 0-4 5-2-2-3 5-2 0-3-5 1 1-7-3-2 1-3 21 1-1-3 8-9-9-1 6-6 2-8 10-3-1 8 3-2 0-6 3-2 1-2 5 4-5 4 2 2 3-5 13-2 4 12-3 6 5-1 1 3 0 4-3-3 0 8-13 9 2 33-7 17 2 3-8 2-1-2-15 11-5-2 1 4-6 4-12 2 2-5-8 1 7-7-10 1 6-8zM73 223l4-3 3 1-2 3zM81 278l2-5 5-3 0 7-4 4 0-6zM81 216l5-4-3-2 0-5 6-1 1-4 10-6 0 3-8 9 2 2-11 9zM84 446l10-11 11-19 17 0 14-17-16 12-5-1-5-6-6 1 3-3-5-3-8 4-5-8 16-12 5-8-1-12-10 4 7-11 16-7 5 2 2-5 2 3 3 0-5-6 7-23-6 3-5-14 4-7 9-7-10 2-9 6-5-2-5 4-4-3-3 5-3-9 12-17-3-5 1-6 6-3-4-3 1-3-9 9 6-11-8 8-6 19-4 1 7-14-2 0 4-13 9-17-10 8-7-4 8-5-2-2 6-6 1-4-3-6 4-4-2-2 3-6 9-3-3-5 1-3 7-4 3-9 10 0 29-9-5 10-19 14-1 3 3 1-7 8 16-7 28-5 4 2 1 4-24 32-17 9 9-2 5 1-1 2-16 10-8-1 14 2 10-4 9 3 8 9 4 27 12 5 13 10-4 4 6 14-10-3-10 2 9-1 13 11 1 6-10 10 6 3 9-7 19-2 10 5 2 6-10 20-10 5 0 5-2 1-12 4 3 1-1 5-12 4 11 3 14-1-2 7-10 5-3 5-20 6-9-1-12 2-13-5 1 3-3 2-10 1 0 4-8 0-8-4-8 2-5 12-8-6-8 3-5 7-7-1zM85 226l9-8 2 11 7 0-7 7 0-4-5 0zM87 259l4-6-3-3 4-1 5 4-1 4zM99 279l3-3 2 4-3 4zM101 327l9-11-2 7zM102 352l2-5 6 5-5 4zM151 434l5-4 5 3-2 1-3 2zM159 170l3-5 5 1-2 3 6 0-2 2zM203 127l7-3-3-3 6-5 0 4 5 0-3 6-6 10 1-8z',
      ARV: 'M252 422l0-7 24-11 34-4-21-1-4-4 11-3 12 5 5-1-8-4 6-2-6-7 25-23 15-28 11-2 12-8 7-8 19-8 27-6 5 5 8 0 1 13-6 17-11 3 1 6 9 0 3 2-3 8-10 7 3 4-2 2-18 7-8-2-9 4 7 15-8 11 2 3-14 6 7 5-5 7 9 6-4 4 6 3-2 6-10 4-6 6-1 5 2 5 8 3-15 15-6-2-8 2-6-3-12 1-5-7-12-5 0-7 4-8-13 8-13 0 5-12-6-3-9 1-1-7-10-2-2-9-9 3zM296 388l9-2 3 2-5 2zM344 328l7-7-1 5-4 4z',
      BEL: 'M350 554l17-21 27-19 26-16-19-2-4-4-19 2 1-3-4-1-8 2-1-10-6-2 15-15-8-3-2-5 1-5 6-6 10-4 2-6-6-2 0-2 4-3-9-6 5-7-7-4 14-7-2-3 8-9 0-3-7-14 9-4 8 2 17-5 3-4-3-4 12-9-1-7-10-1-2-3 2-5 10-1 6-15-1-15-5-3 4-13 23-5 6 6-1 4 4 0 1-7 4 3 2 6-2-22 13 0 13 13-11-13-9-4-2-13-6-1-1-4 6-4 0-3-8-14 12 2 6-2 5 3 3 8-2 5 4-1 8 8 2-2 0 13 6 6 9-17 5 4 5 13 4 0 4 15 6 4 5 21-4 12 15 16 1 6 7 12 0 10 14 24-3 18-3-2-2-5-5-2 2 6-11 8-6 13-3 1-3 10 0-6-1 18-4 21 3 18 4 6-3 9-3 3-3-2-6 10-16 11-1 8-4 7 2 2-4 6-3-2 0-4-5 1-4-3-2 4-32 9-1-4-11-1-14 10 2-3-6-5-12 1-8-4-11 1-9-3-6 2-3 2 5 1-6 2zM456 232l2-7 0 7 3-1 3 1-6 2-1 3zM525 261l4-12 4 7-2 3 2 7-4-3-2 3zM534 274l7 7 0 3-3 0-3-1z',
      KAL: 'M541 282l54-5 11-7 46-2 20 8-10-3 6 8 12 7 17-1 78 13 13 7 22 43-1 3-8 3-3 7 11 8 1 12 15 23-2 2 3 8-12 10-14 19 5 17-20-6-3-5-7-2-14 0-4 3-6-1-10-1-9 7-7 0-1-6-4 0-6-6-9 7-6 1 0-4-4 0 0-3-7-5-1-4-17-4-5 3-7-5-2-1 5-3-1-3-9 3-17-5 4 6-11 6-13-11 5-4-1-4-10 1-16-7-4-6-7-2 1 5-4 1 2-16-14-24 0-10-7-12-1-6-15-16 4-12-5-21 8 5-1-8z',
      MOR: 'M789 483l0-6 9-17 7 1-3-4-1-14 18-23 6 0 1-4-3-8 2-2-11-14-2-9 6 1 6-7 27 1 26 6 3 5 7 1 1 3 2-3 6 0 11 5 6-5 6 7 15-2 8 6-1-11 6-10 22 0 6-7 7 2 18-2 13 15-5 3 3 12 16 1 3 4 0 133-3 5 2 9-4-6-4 0-10-6-6 5-4-3-11 3-10-5 2-5-7-3 13 2 3-4-4 1-5-2-6-16 4 16-6 0 0-3-2 4-9 3-7 20-9 5 2 14-5-4-10 4 0 3-7-3-4-8 0-27-5-16-27-36-11 0-1 6-13 3-11 7-7-7-27-1-5-3-8 5-3-6-4 0-9-10zM975 540l8 6-7-2z',
      RUV: 'M541 471l4-21 1-18 0 6 3-10 3-1 6-13 11-8-2-6 5 2 5 7 5-3-1-5 7 2 4 6 16 7 10-1 1 4-5 4 13 11 11-6-4-6 3 0 14 5 10-2-1 3-4 2 8 5 6-2 17 4 1 4 7 5 0 3 4 0 0 4 6-1 9-7 6 6 4 0 1 6 7 0 3-4 8-3 14 2 4-3 7-1 14 3 3 5 13 4-9 17 0 6 3-1 2 5 11 5 3 6-6 7-9 1-7 9-16 32-5 4-8 14-11 3-5 6-33 2-14 10-4-1-15 6-8 6-16 2-21-8-14-11-11-5-6-13-6 1 13-7 1-15 9-7-1-3-6-1 6-4 6 2 9-3 0-5 5-7-8-13 5-9-2-4-10-2-15 4-6-3-22-2-4 9-7 8-12 3-3-1-5-14-2 0z',
      TES: 'M729 576l12-2 5-6 11-3 8-14 5-4 16-32 7-9 9-1 13-12 6 3 27 1 7 7 11-7 13-3 1-6 11 0 27 36 4 11 1 32 4 8 7 3 0-3 10-4 5 4-2 13-8 4 0-7-3 2-8 47-2 4-6 1-5 7-3 15-10 11 7 12 0 2-4 2-6 2-4-4-15 8-8 10-5 1-3 11-5 4-17 7-5-3-6 2-5-5-25 12-20 6 6-14-2-8-7-2-5-6 7-6 1-13 8-3 10-13-10-7-4-11 3-9 11-11-5-4 0-4 7-6-6-2-14 9-5-4-17-3 6-4-5-3 5-6-14-4-8-6 1-10-2 0z',
      IBE: 'M68 629l1-3 4-4 9-1 1-5 8-4 13 6 19 0 24 9 12 0 20 8 6 0 10 10 22 14 9 2 0-3 24 16 18 2 6 12-10 10-12 2-2 5 4 2-3 2-3 23 5 12 8 7 0 3-6 5-3 7-1 11 2 2-9 1-5 4-7 15-6-2-6 3-30-2-6 6-11 2-8 11-10-5-7-15 4-5-4 2-10-10 1-2-14 3-8 4-16-3-9 3 4-11-2-28 5 0-3-2-9 2-1-6 5-2 1-7 3-2-3 1-4 8-5 1-3-3 2-14 4-6 5-15 0-24-5-17-3-2 1-5-3-4 3-4-3 0-2-10-4 2 1-6zM276 750l4-3 1 3-2 3zM287 738l9-7 8 9-2 7zM307 731l7 1 3 5z',
      LUS: 'M310 622l11-2 1-4-10-9 6-4 23 0 11-6 0-3 12-6 0 6 10 4-2 2 7 4 1-4 14-14 4 0 2 5 13-2 2 3 3 0 0-7 3-4 10 1 6-9 14 2 10-7 25-4-3 5 3 7 32 5-10 8 6 3-4 5 3 0-1 5 8 6-5 1 2-1-4-5-5 2-7-2-5 4-21 5-2 5 8 7-4 4-3-1 2 10 6 7 33 16 21 30 20 17 15 7 21 5 0 4-7 2 0 2 56 33 9 9 4 7-4 6-3-1-9-12-10-3-8-6-6 0-7 6-3 9 16 11 2 9-14 2 0 8-6 2-5 5-8-1-2-6 4-2 1-7 6-1 0-4-15-27-20-10 0-6-6-6-10-1 2-3-11-4-9-13-17-4-45-31-14-3-1-4-3-2-18-7-1-6-14-16-44-10-6 2-12 11-13 2 2-7-21-6-3-4 3-4-1-3-7-2zM388 718l12 0 9-8 12 6 0 2 10 10-3 6 4 6 3 16-1 5-11-3-1 7-7-1-6-6-3-15-4-2-2-9-10-9zM513 800l1-5 4-2 4 4 6-3 4 1 12 6 41 1 1 1-8 11-1 6 6 8-3 2 0 4-8-2-16-10-37-16z',
      DLM: 'M510 612l24 0 6-5 7 5 17 1-2-4 3-2-3-3 13-5-1-10 21-9 4-6 14 3 17 14 21 8 16-2 8-6 15-6 4 1 14-10 18-1 16 14 2 0-1 10 8 6 14 4-5 6 5 3-6 4 17 3 5 4 14-9 6 2-7 6 0 4 5 4-11 11-3 9 4 11 6 2 4 6-10 12-8 3-1 13-7 6 5 6 7 2 2 8-6 14-5 1-2 5-21 5-13 9-17 2-1 8-6 3-5 8-10 4 2 4-7 3-3-1-3-9-9-5-4-5 3 1-2-7 10-30-11-5-14-15-47-22 20 8-24-20-15-6-12-2-2-4-23-18-2-2 10 0-15-11-2-3-2-11-9-7-7-1-12 14-8-8zM532 622l2-1 3 6 1 9-5-8zM536 623l4-3 8 7zM605 692l12 4-10-1z',
      EGE: 'M684 788l6-1 0 5 4 6-3-2zM693 790l6 1 4-3-2-4 10-4 5-8 7-5 0-6 17-2 13-9 17-3 7-7 24-7 25-12 5 5 6-2 5 3 22-11 1-9 4-3 7 2 0 6-8 8-2 7-8 10-22-1-9 6-8 0-12 9-8 2-1 9 9 0 2 5-10-4-5 3 5 4-2 5-6-6-6 0 0 6 5 2-8 0 0-6-10-3 2-6-8 4-5 14 6 10 9 9-5 2 1-3-6 0-2 3 2 3 2-1-13 6 34 7 0 11-12-5-12 4 3 5 7 2-8 4-11-3 10 18-10-5-6 6-9-9-3 0-2 5-3-2-4-4 2-5-13-9 7-6 6 1 4-3 25 5 8-4-18-4-23 3-4-3-3 3-10-11 9-1 0-2-10-1-10-7zM699 823l6-6 5 7zM706 829l1-1 8 4-5 1zM763 808l12-6 4 4 14 0 3 9 8 1-4 3-6-1-3-5-10 1-9-6zM775 868l4-4 3 2 7-2-1 2 5 2 32-3 1 4 12-5-2 5-33 5-7-3-19 0zM806 819l6-1 0 3-1 2zM818 751l4-6 3 1-1 4zM819 834l4-4 1 3-3 3zM825 770l1-4 10-3-3 4-1 3-2-2zM836 805l3-2-3-5 5-1 2 2-2 6-3 2zM840 783l13-8 4 5-2 2 1 2-4 1-6-1 4-4-5 4zM855 856l4-5-1 6-2 3zM870 847l3-7 10-5-4 8zM967 854l13-3 1-6 14 0 20-11-13 11 1 6 1 2-8 1-15 12-11-3z',
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
          <span class="lab">{{ V.words.tension }}</span>
          <svg class="gauge" viewBox="0 0 120 66" aria-hidden="true">
            <path class="bezel" d="M6 62A54 54 0 0 1 114 62Z" />
            <path class="face" d="M10 61A50 50 0 0 1 110 61Z" />
            @for (s of gaugeSegs; track s.c; let k = $index) { <path [attr.d]="s.d" [attr.class]="'seg ' + s.c + (k < g.tension ? ' lit' : '')" /> }
            <path class="minor" [attr.d]="gaugeMinor" />
            @for (t of gaugeTicks; track t.k) {
              <line [attr.x1]="t.x0" [attr.y1]="t.y0" [attr.x2]="t.x1" [attr.y2]="t.y1" class="tick" />
              <text [attr.x]="t.tx" [attr.y]="t.ty" class="tk" [class.hot]="t.k === maxT">{{ t.k }}</text>
            }
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
            <rect class="relief" [attr.width]="A.w" [attr.height]="A.h" [attr.filter]="'url(#' + uid + '-relief)'" [attr.clip-path]="'url(#' + uid + '-land)'" />
          </svg>
          <svg class="ovl" [attr.viewBox]="'0 0 ' + A.w + ' ' + A.h" preserveAspectRatio="none" aria-hidden="true">
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
    .tension { width: 112px; display: grid; justify-items: center; gap: 1px; }
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
    .sheet { margin: 2px 0 0; padding: 0; width: 100%; max-width: 560px; justify-self: center; border: 1px solid #6f6a5c; border-radius: 3px; background: #6f6a5c; box-shadow: 0 2px 8px rgba(30,25,10,.2); overflow: hidden; }
    .mapbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 2px 10px; padding: 3px 8px; background: #2b2e33; color: #e7e2d5; font-size: 10px; letter-spacing: .04em;
      .ttl { font-weight: 700; text-transform: uppercase; letter-spacing: .1em; }
      .key { display: inline-flex; align-items: center; gap: 4px; color: #b9b5aa; white-space: nowrap; }
      .k { display: inline-block; width: 10px; height: 8px; margin-left: 4px; border-radius: 1px; } .kp { background: var(--fr); } .kr { background: var(--rv); }
      .kh { background: repeating-linear-gradient(45deg, var(--fr) 0 2px, #e9e3d2 2px 4px); } }
    .map { position: relative; width: 100%; user-select: none; overflow: hidden; }
    .base, .ovl { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .ovl { pointer-events: none; }
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
    .node { position: absolute; z-index: 1; transform: translate(-50%, -50%); width: clamp(58px, 16.4%, 78px); display: grid; gap: 1px; padding: 2px 3px 2px; border-radius: 3px;
      border: 1px solid var(--pl-b); border-top: 3px solid #8d887a; background: var(--pl); color: var(--pl-ink); font: inherit; text-align: center; cursor: pointer;
      box-shadow: 0 1px 2px rgba(0,0,0,.3), 0 0 0 .5px rgba(0,0,0,.05); transition: opacity .2s ease, box-shadow .2s ease, background .4s ease; min-width: 0;
      &.c-p { border-top-color: var(--fr); background: linear-gradient(var(--fr-l), var(--fr-l)) padding-box; } &.c-r { border-top-color: var(--rv); background: var(--rv-l); }
      &.inst { border-radius: 10px; border-top-width: 1px; box-shadow: 0 0 0 2px var(--pl), 0 0 0 3px var(--gold), 0 2px 4px rgba(0,0,0,.3); }
      &.inst.c-p { box-shadow: 0 0 0 2px var(--fr-l), 0 0 0 3.5px var(--fr), 0 2px 4px rgba(0,0,0,.3); } &.inst.c-r { box-shadow: 0 0 0 2px var(--rv-l), 0 0 0 3.5px var(--rv), 0 2px 4px rgba(0,0,0,.3); }
      &.can { outline: 2px dashed var(--fr); outline-offset: 2px; } &.tgt { outline: 2px solid var(--rv); outline-offset: 2px; } &.evt { outline: 2px solid var(--gold); outline-offset: 2px; }
      &.dim { opacity: .5; } &.focus, &.pick { box-shadow: 0 0 0 3px var(--gold), 0 2px 5px rgba(0,0,0,.35); z-index: 2; } &.pick { outline-width: 3px; }
      &.fl-p { animation: flP 1.4s ease 1; } &.fl-r { animation: flR 1.4s ease 1; }
      &:disabled { cursor: default; } &:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; z-index: 3; } }
    .nm { font-size: clamp(7.5px, 2.2vw, 10px); font-weight: 700; line-height: 1.15; letter-spacing: .01em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 1px; }
    .infs { display: flex; justify-content: space-between; align-items: center; gap: 1px; min-height: 14px; }
    .ip, .ir { display: inline-flex; align-items: center; gap: 2px; b { font-weight: 800; font-size: clamp(10.5px, 3vw, 12.5px); line-height: 1; } }
    .ip { --c: #3a78bd; --cd: #1d4f86; b { color: var(--fr-d); } } .ir { --c: #cf4a3a; --cd: #7e241b; b { color: var(--rv-d); } }
    .stk { display: inline-block; width: 10px; height: 5px; border-radius: 50%; background: var(--c); margin-top: 6px; }
    .zero { opacity: .35; .stk { visibility: hidden; } }
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
        --sea-1: #223747; --sea-2: #172633; --grat: rgba(150,185,210,.16); --land: #54554c; --coast: #8ea6b6; --shelf: #2b4557; --border: rgba(18,20,24,.85);
        --lbl: #87a4b8; --home-ink: #d9dde6; --reg-o: .3; --ctl-o: .58;
        --pl: rgba(29,33,43,.94); --pl-b: #4b5263; --pl-ink: #ece8de;
        --paper: #36332b; --paper-2: #2c2a24; --paper-ink: #ebe5d5; --paper-rule: rgba(255,255,255,.05); --stamp: #ef7c6e;
      }
      :host-context(html:not([data-theme=light])) .relief { opacity: .62; }
      :host-context(html:not([data-theme=light])) .card { border-color: #4a463b; }
      :host-context(html:not([data-theme=light])) .card .ic { border-color: rgba(230,220,200,.4); filter: grayscale(1) invert(.85); }
      :host-context(html:not([data-theme=light])) .card .ow { color: #9cc0ee; }
    }
    :host-context(html[data-theme=dark]) {
      --fr: #4f8fd6; --fr-d: #a9cbf2; --fr-l: #1f3350; --rv: #d9574a; --rv-d: #f3a597; --rv-l: #4a2622;
      --sea-1: #223747; --sea-2: #172633; --grat: rgba(150,185,210,.16); --land: #54554c; --coast: #8ea6b6; --shelf: #2b4557; --border: rgba(18,20,24,.85);
      --lbl: #87a4b8; --home-ink: #d9dde6; --reg-o: .3; --ctl-o: .58;
      --pl: rgba(29,33,43,.94); --pl-b: #4b5263; --pl-ink: #ece8de;
      --paper: #36332b; --paper-2: #2c2a24; --paper-ink: #ebe5d5; --paper-rule: rgba(255,255,255,.05); --stamp: #ef7c6e;
    }
    :host-context(html[data-theme=dark]) .relief { opacity: .62; }
    :host-context(html[data-theme=dark]) .card { border-color: #4a463b; }
    :host-context(html[data-theme=dark]) .card .ic { border-color: rgba(230,220,200,.4); filter: grayscale(1) invert(.85); }
    :host-context(html[data-theme=dark]) .card .ow { color: #9cc0ee; }

    @media (max-width: 400px) { .head { padding-left: 9px; gap: 4px 6px; } .tension { width: 104px; } .vp .score b, .h-turn .big { font-size: 19px; } }
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

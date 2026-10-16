import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/* ============================================================
 *  La carte de campagne : un duel au tour par tour contre le
 *  camp adverse, semaine après semaine, zone par zone. Chaque
 *  semaine, du temps et de l'argent à placer en meetings, porte-
 *  à-porte, affiches, visites… L'adversaire joue en même temps ;
 *  ses coups sont révélés en fin de semaine. Les effets s'usent
 *  (les meetings vite, le porte-à-porte lentement) et saturent :
 *  le bon coup au bon endroit au bon moment. Trois variantes :
 *  présidentielle (régions), législatives (cantons), référendum
 *  (oui / non, la participation compte).
 *
 *  La simulation (zones, cartes, IA) est faite de fonctions pures
 *  exportées, testables hors d'Angular.
 * ============================================================ */

export type Variant = 'presidentielle' | 'legislatives' | 'referendum';
export type Profile = 'urbain' | 'rural' | 'jeune' | 'âgé' | 'ouvrier' | 'cadre';
export type Side = 'p' | 'a';
export type CardId = 'meeting' | 'porte' | 'affiches' | 'usine' | 'marche' | 'ralliement' | 'spot' | 'debat' | 'mobilisation'
  | 'star' | 'gaffe' | 'dons' | 'sondage' | 'tribune' | 'scandale';

export interface ZoneDef { id: string; name: string; short: string; x: number; y: number; w: number; profiles: Profile[] }
export interface Zone extends ZoneDef {
  nb: string[];
  /** Part de base (vous) parmi les décidés */
  base: number;
  /** Part d'indécis */
  und: number;
  /** Participation de base (référendum) */
  tb: number;
  /** Influences : vous (p) / adversaire (a) ; f = éphémère, d = durable, m = mobilisation */
  pf: number; pd: number; pm: number;
  af: number; ad: number; am: number;
}
export interface CardDef {
  id: CardId; icon: string; name: string; t: number; e: number;
  scope: 'zone' | 'national' | 'instant' | 'fixed';
  desc: string; event?: boolean; max?: number; from?: number;
}
export interface HandCard { uid: number; card: CardId; zone?: string; exp: number }
export interface Move { card: CardId; zone?: string; uid?: number }
export interface Camp {
  variant: Variant; diff: number; seed: number;
  /** Semaine en cours (1…WEEKS) */
  week: number;
  zones: Zone[];
  time: number; money: number;
  aiMoney: number; aiMul: number;
  used: Partial<Record<CardId, number>>;
  aiUsed: Partial<Record<CardId, number>>;
  hand: HandCard[]; uid: number;
  /** Coups adverses décidés en début de semaine, joués à la fin */
  aiPlan: Move[];
  /** Le sondage qualitatif a révélé le plan adverse */
  spied: boolean;
  polls: number[];
  /** Zones travaillées par le joueur la semaine passée (l'IA y répond) */
  lastP: string[];
  scandals: number;
}
export interface WeekReport {
  ai: Move[];
  lost: string[]; won: string[];
  scandal?: string;
  debate?: 'win' | 'loss';
  aiDebate?: 'win' | 'loss';
  poll: number;
  delta: Record<string, number>;
}
export interface ZoneResult { id: string; share: number; turnout: number; me: number; them: number }
export interface FinalResult { zones: ZoneResult[]; share: number; margin: number; turnout: number; won: number }

export const WEEKS = 8;
export const TIME = 4;
const INCOME = 3;
const CASH_CAP = 12;
const DECAY = { f: 0.75, d: 0.95, m: 0.9 };
const DIM = [1, 0.7, 0.5, 0.35, 0.25, 0.18];

/* ── Données ───────────────────────────────────────────────── */

/** Les 13 régions + outre-mer, en tuiles placées à peu près comme sur la carte (poids ≈ millions d'électeurs) */
const REGIONS: ZoneDef[] = [
  { id: 'HDF', name: 'Hauts-de-France', short: 'HdF', x: 2, y: 0, w: 4.3, profiles: ['ouvrier', 'jeune'] },
  { id: 'NOR', name: 'Normandie', short: 'Nor', x: 1, y: 0.9, w: 2.4, profiles: ['rural', 'âgé'] },
  { id: 'IDF', name: 'Île-de-France', short: 'IdF', x: 2, y: 1, w: 7.6, profiles: ['urbain', 'cadre', 'jeune'] },
  { id: 'GES', name: 'Grand Est', short: 'GE', x: 3, y: 0.9, w: 3.9, profiles: ['ouvrier', 'rural'] },
  { id: 'BRE', name: 'Bretagne', short: 'Bre', x: 0, y: 1.9, w: 2.5, profiles: ['âgé', 'rural'] },
  { id: 'PDL', name: 'Pays de la Loire', short: 'PdL', x: 1, y: 2, w: 2.8, profiles: ['rural', 'cadre'] },
  { id: 'CVL', name: 'Centre-Val de Loire', short: 'CVL', x: 2, y: 2.05, w: 1.9, profiles: ['rural', 'âgé'] },
  { id: 'BFC', name: 'Bourgogne-Franche-Comté', short: 'BFC', x: 3, y: 2, w: 2.0, profiles: ['ouvrier', 'rural'] },
  { id: 'NAQ', name: 'Nouvelle-Aquitaine', short: 'NA', x: 1, y: 3.1, w: 4.5, profiles: ['âgé', 'rural'] },
  { id: 'OCC', name: 'Occitanie', short: 'Occ', x: 2, y: 3.4, w: 4.4, profiles: ['jeune', 'urbain'] },
  { id: 'ARA', name: 'Auvergne-Rhône-Alpes', short: 'ARA', x: 3, y: 3.1, w: 5.7, profiles: ['urbain', 'ouvrier'] },
  { id: 'PAC', name: 'Provence-Alpes-Côte d’Azur', short: 'PACA', x: 3.4, y: 4.2, w: 3.6, profiles: ['âgé', 'urbain'] },
  { id: 'COR', name: 'Corse', short: 'Cor', x: 4.5, y: 4.6, w: 0.3, profiles: ['rural', 'âgé'] },
  { id: 'OM', name: 'Outre-mer', short: 'OM', x: 0, y: 4.4, w: 1.4, profiles: ['jeune', 'ouvrier'] },
];

/** Une circonscription imaginaire : huit cantons (poids en milliers d'électeurs) */
const CANTONS: ZoneDef[] = [
  { id: 'VAR', name: 'Les Varennes-sur-Aube', short: 'Varennes', x: 0, y: 0, w: 9, profiles: ['rural', 'âgé'] },
  { id: 'BRY', name: 'Brécy-la-Forêt', short: 'Brécy', x: 1.05, y: 0.15, w: 7, profiles: ['rural'] },
  { id: 'TAN', name: 'Les Tanneries', short: 'Tanneries', x: 2.1, y: 0, w: 12, profiles: ['ouvrier', 'jeune'] },
  { id: 'CTR', name: 'Villeneuve-Centre', short: 'Centre', x: 1.1, y: 1.15, w: 16, profiles: ['urbain', 'cadre'] },
  { id: 'GAR', name: 'Campus de la Garenne', short: 'Garenne', x: 2.15, y: 1.1, w: 8, profiles: ['jeune', 'urbain'] },
  { id: 'MTF', name: 'Montfleury', short: 'Montfleury', x: 0, y: 1.2, w: 10, profiles: ['cadre', 'âgé'] },
  { id: 'PJB', name: 'Port-Joubert', short: 'Port-J.', x: 2.2, y: 2.2, w: 11, profiles: ['ouvrier'] },
  { id: 'ARS', name: 'Saint-Aubin-d’Arsac', short: 'St-Aubin', x: 0.6, y: 2.3, w: 8, profiles: ['rural', 'jeune'] },
];

export const PROFILE_LABEL: Record<Profile, string> = { urbain: '🏙️ urbain', rural: '🌾 rural', jeune: '🎓 jeune', 'âgé': '🧓 âgé', ouvrier: '🔧 ouvrier', cadre: '💼 cadres' };

const CARDS: Record<CardId, CardDef> = {
  meeting: { id: 'meeting', icon: '🎤', name: 'Meeting', t: 2, e: 1, scope: 'zone', desc: 'Gros coup local (+3) qui s’estompe vite. Porte en ville et chez les jeunes.' },
  porte: { id: 'porte', icon: '🚪', name: 'Porte-à-porte', t: 1, e: 0, scope: 'zone', desc: 'Petit gain (+1) mais durable : il tient jusqu’au scrutin.' },
  affiches: { id: 'affiches', icon: '🪧', name: 'Affiches', t: 0, e: 2, scope: 'zone', desc: '+1,4 ici et +0,7 dans chaque zone voisine. S’estompe.' },
  usine: { id: 'usine', icon: '🏭', name: 'Visite d’usine', t: 1, e: 0, scope: 'zone', desc: 'Très efficace en terre ouvrière (+2), faible ailleurs.' },
  marche: { id: 'marche', icon: '🧺', name: 'Marché', t: 1, e: 0, scope: 'zone', desc: 'Très efficace en zone rurale et chez les aînés, faible ailleurs.' },
  ralliement: { id: 'ralliement', icon: '🤝', name: 'Ralliement d’un élu', t: 1, e: 2, scope: 'zone', max: 2, desc: 'Un notable local vous rejoint : +2,5 durable. Deux fois par campagne.' },
  spot: { id: 'spot', icon: '📺', name: 'Spot télévisé', t: 0, e: 4, scope: 'national', desc: '+0,5 partout, pour une semaine ou deux.' },
  debat: { id: 'debat', icon: '🎙️', name: 'Débat télévisé', t: 2, e: 0, scope: 'national', max: 1, from: 3, desc: 'Quitte ou double : gagné, +1,4 partout ; perdu, l’adversaire prend +1,1 partout. Une fois, à partir de la semaine 3.' },
  mobilisation: { id: 'mobilisation', icon: '🚌', name: 'Mobilisation', t: 1, e: 1, scope: 'zone', desc: 'Fait voter vos partisans : participation en hausse ici, un peu autour.' },
  star: { id: 'star', icon: '⭐', name: 'Soutien d’une star', t: 0, e: 0, scope: 'zone', event: true, desc: 'Une vedette s’affiche avec vous : +2,5 ici (plus chez les jeunes), +0,8 autour.' },
  gaffe: { id: 'gaffe', icon: '😬', name: 'Gaffe adverse', t: 1, e: 0, scope: 'national', event: true, desc: 'L’adversaire a dérapé : exploitez-le, +0,8 partout.' },
  dons: { id: 'dons', icon: '💶', name: 'Dîner de donateurs', t: 1, e: 0, scope: 'instant', event: true, desc: '+4 € tout de suite.' },
  sondage: { id: 'sondage', icon: '📊', name: 'Sondage qualitatif', t: 0, e: 0, scope: 'instant', event: true, desc: 'Révèle où l’adversaire frappera cette semaine (🎯).' },
  tribune: { id: 'tribune', icon: '📰', name: 'Tribune', t: 1, e: 0, scope: 'national', event: true, desc: 'Une tribune remarquée : +0,5 partout, davantage chez les cadres.' },
  scandale: { id: 'scandale', icon: '⚠️', name: 'Scandale à contrer', t: 2, e: 0, scope: 'fixed', event: true, desc: 'Une rumeur enfle : allez la démentir sur place cette semaine, sinon −3 durable ici et −0,6 partout.' },
};
const BASE_CARDS: CardId[] = ['meeting', 'porte', 'usine', 'marche', 'affiches', 'ralliement', 'spot', 'debat'];
const EVENT_DECK: CardId[] = ['star', 'star', 'gaffe', 'gaffe', 'dons', 'dons', 'sondage', 'sondage', 'tribune', 'tribune'];

export function baseCards(v: Variant): CardId[] { return v === 'referendum' ? [...BASE_CARDS.slice(0, 5), 'mobilisation', ...BASE_CARDS.slice(5)] : BASE_CARDS; }

export function cardDef(id: CardId, v: Variant): CardDef {
  const c = CARDS[id];
  if (v === 'legislatives') {
    if (id === 'spot') return { ...c, icon: '📻', name: 'Radio locale', desc: 'Une semaine d’antenne sur la radio locale : +0,5 partout.' };
    if (id === 'debat') return { ...c, name: 'Débat local', desc: 'Face-à-face sur la chaîne locale. Gagné, +1,4 partout ; perdu, l’adversaire prend +1,1 partout. Une fois, dès la semaine 3.' };
    if (id === 'ralliement') return { ...c, name: 'Ralliement d’un maire', desc: 'Un maire vous soutient : +2,5 durable. Deux fois par campagne.' };
  }
  return c;
}

export function variantOf(id: string): Variant {
  return id.includes('legisl') || id.includes('primaire') ? 'legislatives' : id.includes('referendum') ? 'referendum' : 'presidentielle';
}

/* ── Hasard reproductible ──────────────────────────────────── */

export function rnd(c: { seed: number }): number {
  c.seed = (c.seed + 0x6d2b79f5) | 0;
  let t = c.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gauss(c: { seed: number }): number {
  const u = Math.max(1e-9, rnd(c)), v = rnd(c);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* ── Modèle de vote ────────────────────────────────────────── */

/** Votre part des voix exprimées dans une zone (0…1) */
export function zoneShare(z: Zone): number {
  const D = z.pf + z.pd - z.af - z.ad;
  const lean = (z.base - 0.5) * 100;
  const decided = clamp(z.base + 0.06 * Math.tanh(D / 8), 0.05, 0.95);
  const und = 0.5 + 0.5 * Math.tanh((D + 0.4 * lean) / 6);
  return (1 - z.und) * decided + z.und * und;
}
/** Participation de chaque camp (référendum) */
export function turnouts(z: Zone): [number, number] {
  return [clamp(z.tb - 0.07 + 0.18 * Math.tanh(z.pm / 5), 0.25, 0.95), clamp(z.tb - 0.07 + 0.18 * Math.tanh(z.am / 5), 0.25, 0.95)];
}
export function zoneVotes(z: Zone, v: Variant): { me: number; them: number } {
  const s = zoneShare(z);
  if (v !== 'referendum') return { me: z.w * s, them: z.w * (1 - s) };
  const [tm, ta] = turnouts(z);
  return { me: z.w * s * tm, them: z.w * (1 - s) * ta };
}
/** Votre part nationale (ou de la circonscription), pondérée */
export function nationalShare(zones: Zone[], v: Variant): number {
  let me = 0, them = 0;
  for (const z of zones) { const r = zoneVotes(z, v); me += r.me; them += r.them; }
  return me / (me + them);
}
/** Part effective d'une zone (référendum : part des votants) */
export function zoneResult(z: Zone, v: Variant): number { const r = zoneVotes(z, v); return r.me / (r.me + r.them); }

/** Score final selon la marge (en points) : 0,5 à la victoire courte, < 0,45 en cas de défaite */
export function scoreFromMargin(m: number): number {
  return m >= 0 ? 0.5 + 0.45 * (1 - Math.exp(-m / 7)) : Math.max(0.03, 0.45 * Math.exp(m / 6));
}

/* ── Effets des cartes ─────────────────────────────────────── */

interface Eff { z: Zone; f: number; d: number; m: number }
const mult = (z: Zone | undefined, t: Partial<Record<Profile, number>>, dflt = 1): number => {
  if (!z) return dflt;
  let best = -1;
  for (const p of z.profiles) { const v = t[p]; if (v !== undefined && v > best) best = v; }
  return best < 0 ? dflt : best;
};

export function effects(c: Camp, card: CardId, zid?: string, zones: Zone[] = c.zones): Eff[] {
  const ref = c.variant === 'referendum';
  const z = zid ? zones.find(q => q.id === zid) : undefined;
  const nbs = z ? zones.filter(q => z.nb.includes(q.id)) : [];
  const one = (f: number, d: number, m = 0): Eff[] => (z ? [{ z, f, d, m }] : []);
  switch (card) {
    case 'meeting': return [...one(3.2 * mult(z, { urbain: 1.3, jeune: 1.2, cadre: 1.1, rural: 0.8 }), 0.3, ref ? 0.8 : 0), ...nbs.map(q => ({ z: q, f: 0.4, d: 0, m: 0 }))];
    case 'porte': return one(0, 1.1 * mult(z, { 'âgé': 1.15, ouvrier: 1.15, rural: 1.1, urbain: 0.9 }), ref ? 1.2 : 0);
    case 'affiches': return [...one(1.4 * mult(z, { urbain: 1.2 }), 0), ...nbs.map(q => ({ z: q, f: 0.7, d: 0, m: 0 }))];
    case 'usine': { const k = mult(z, { ouvrier: 1 }, 0.45); return one(1.3 * k, 0.4 * k); }
    case 'marche': { const k = mult(z, { rural: 1, 'âgé': 0.9 }, 0.45); return one(1.3 * k, 0.4 * k); }
    case 'ralliement': return one(0, 2.5 * mult(z, { rural: 1.2 }), ref ? 0.5 : 0);
    case 'mobilisation': return [...one(0, 0, 2.5), ...nbs.map(q => ({ z: q, f: 0, d: 0, m: 0.8 }))];
    case 'star': return [...one(2.5 * mult(z, { jeune: 1.5, urbain: 1.2 }), 0), ...nbs.map(q => ({ z: q, f: 0.8, d: 0, m: 0 }))];
    case 'spot': return zones.map(q => ({ z: q, f: 0.7, d: 0, m: 0 }));
    case 'gaffe': return zones.map(q => ({ z: q, f: 0.8, d: 0, m: 0 }));
    case 'tribune': return zones.map(q => ({ z: q, f: 0.5 * mult(q, { cadre: 1.5 }), d: 0, m: 0 }));
    default: return [];
  }
}

function addEff(effs: Eff[], side: Side, k: number, mul = 1, df = 1, dd = 1, dm = 1): void {
  for (const e of effs) {
    if (side === 'p') { e.z.pf += e.f * k * mul * df; e.z.pd += e.d * k * mul * dd; e.z.pm += e.m * k * mul * dm; }
    else { e.z.af += e.f * k * mul * df; e.z.ad += e.d * k * mul * dd; e.z.am += e.m * k * mul * dm; }
  }
}

/* ── Mise en place ─────────────────────────────────────────── */

function neighbours(defs: ZoneDef[], legis: boolean): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const a of defs) {
    out[a.id] = defs.filter(b => b.id !== a.id && Math.hypot(a.x - b.x, a.y - b.y) <= (legis ? 1.45 : 1.5) && a.id !== 'OM' && b.id !== 'OM').map(b => b.id);
  }
  return out;
}

export function newCampaign(variant: Variant, diff: number, seed: number): Camp {
  const legis = variant === 'legislatives';
  const defs = legis ? CANTONS : REGIONS;
  const nb = neighbours(defs, legis);
  const c: Camp = {
    variant, diff, seed: seed | 0, week: 1, zones: [], time: TIME, money: 2, aiMoney: 2,
    aiMul: 1 + 0.15 * (diff - 1), used: {}, aiUsed: {}, hand: [], uid: 0, aiPlan: [], spied: false, polls: [], lastP: [], scandals: 0,
  };
  c.zones = defs.map(d => {
    const has = (p: Profile) => d.profiles.includes(p);
    return {
      ...d, nb: nb[d.id],
      base: clamp(0.5 + gauss(c) * 0.05, 0.38, 0.62),
      und: clamp(0.17 + rnd(c) * 0.13 + (has('jeune') ? 0.04 : 0) - (has('âgé') ? 0.03 : 0), 0.1, 0.36),
      tb: clamp(0.62 + (has('âgé') ? 0.08 : 0) - (has('jeune') ? 0.08 : 0) + (has('cadre') ? 0.04 : 0) - (has('ouvrier') ? 0.04 : 0) + (rnd(c) - 0.5) * 0.06, 0.4, 0.8),
      pf: 0, pd: 0, pm: 0, af: 0, ad: 0, am: variant === 'referendum' ? 0.8 + 0.8 * (diff - 1) : 0,
    };
  });
  // L'adversaire part légèrement devant
  const target = 0.5 - (0.012 + 0.022 * (diff - 1));
  for (let i = 0; i < 80; i++) {
    const s = nationalShare(c.zones, variant);
    if (Math.abs(s - target) < 0.0002) break;
    for (const z of c.zones) z.base = clamp(z.base + (target - s) * 0.6, 0.3, 0.7);
  }
  c.polls.push(poll(c));
  startWeek(c, true);
  return c;
}

function poll(c: Camp): number { return Math.round((nationalShare(c.zones, c.variant) + gauss(c) * 0.006) * 1000) / 10; }

/** Début de semaine : budget, cartes d'événement, plan adverse. Renvoie les annonces. */
export function startWeek(c: Camp, first = false): string[] {
  const news: string[] = [];
  c.time = TIME;
  if (!first) { c.money = Math.min(CASH_CAP, c.money + INCOME); c.aiMoney = Math.min(CASH_CAP, c.aiMoney + INCOME); }
  c.spied = false;
  c.hand = c.hand.filter(h => h.exp >= c.week);
  if (c.week <= WEEKS - 1 && rnd(c) < 0.72) {
    const card = EVENT_DECK[Math.floor(rnd(c) * EVENT_DECK.length)];
    c.hand.push({ uid: ++c.uid, card, exp: c.week + 1 });
    news.push(`Nouvelle carte : ${CARDS[card].icon} ${CARDS[card].name}.`);
  }
  if (c.week >= 2 && c.week <= WEEKS - 1 && c.scandals < 2 && rnd(c) < 0.16 + 0.12 * (c.diff - 1) + 0.05 * c.week / WEEKS) {
    // La rumeur vise de préférence une zone où vous êtes bien placé
    const pool = c.zones.filter(z => z.w >= 1);
    let tot = 0;
    const ws = pool.map(z => { const w = z.w * (0.5 + zoneShare(z)); tot += w; return w; });
    let r = rnd(c) * tot, pick = pool[0];
    for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) { pick = pool[i]; break; } }
    c.hand.push({ uid: ++c.uid, card: 'scandale', zone: pick.id, exp: c.week });
    c.scandals++;
    news.push(`⚠️ Un scandale éclate en ${pick.name} : contrez-le cette semaine !`);
  }
  while (c.hand.length > 4) c.hand.splice(c.hand.findIndex(h => h.card !== 'scandale'), 1);
  c.aiPlan = planAi(c);
  return news;
}

/* ── Évaluation et IA ──────────────────────────────────────── */

const cloneZones = (zs: Zone[]): Zone[] => zs.map(z => ({ ...z }));

/** Projection à la fin de campagne (usure des effets), avec un degré de prévoyance 0…1 */
function projected(c: Camp, foresight: number): Zone[] {
  const left = (WEEKS - c.week + 1) * foresight;
  const kf = DECAY.f ** left, kd = DECAY.d ** left, km = DECAY.m ** left;
  return c.zones.map(z => ({ ...z, pf: z.pf * kf, af: z.af * kf, pd: z.pd * kd, ad: z.ad * kd, pm: z.pm * km, am: z.am * km }));
}

export interface PlanOpts {
  side: Side; time: number; money: number; foresight: number; noise: number;
  cards: CardId[]; used: Partial<Record<CardId, number>>;
  /** Cartes en main jouables (événements) */
  hand?: HandCard[];
  /** Bonus de valeur par zone (défense des bastions…) */
  bias?: Record<string, number>;
  /** Garde de l'argent pour plus tard (0…1 du budget) */
  thrift?: number;
  mul?: number;
}

/** Planification gloutonne : à chaque pas, le coup qui rapporte le plus par unité de budget */
export function greedyPlan(c: Camp, o: PlanOpts): Move[] {
  const view = projected(c, o.foresight);
  const left = (WEEKS - c.week) * o.foresight;
  const kf = DECAY.f ** left, kd = DECAY.d ** left, km = DECAY.m ** left;
  const sign = o.side === 'p' ? 1 : -1;
  const counts: Record<string, number> = {};
  const used = { ...o.used };
  const hand = [...(o.hand ?? [])];
  const noise: Record<string, number> = {};
  const nz = (key: string) => (noise[key] ??= o.noise ? Math.exp(gauss(c) * o.noise) : 1);
  let t = o.time, e = o.money;
  const reserve = Math.round((o.thrift ?? 0) * e);
  const out: Move[] = [];
  for (let guard = 0; guard < 24; guard++) {
    const before = nationalShare(view, c.variant);
    let best: { mv: Move; v: number; cost: [number, number] } | null = null;
    const options: { card: CardId; uid?: number }[] = [...o.cards.map(card => ({ card })), ...hand.map(h => ({ card: h.card, uid: h.uid }))];
    for (const opt of options) {
      const d = CARDS[opt.card];
      if (opt.card === 'debat' || d.scope === 'instant' || d.scope === 'fixed') continue;
      if (d.t > t || d.e > e - (d.e && !d.event ? reserve : 0)) continue;
      if (d.max !== undefined && (used[opt.card] ?? 0) >= d.max) continue;
      const targets = d.scope === 'zone' ? view.map(z => z.id) : [undefined];
      for (const zid of targets) {
        const k = zid ? DIM[Math.min(DIM.length - 1, counts[zid] ?? 0)] : 1;
        const effs = effects(c, opt.card, zid, view);
        const saved = effs.map(x => ({ ...x.z }));
        addEff(effs, o.side, k, o.mul ?? 1, kf, kd, km);
        const gain = sign * (nationalShare(view, c.variant) - before);
        effs.forEach((x, i) => Object.assign(x.z, saved[i]));
        const v = gain * nz(opt.card + (zid ?? '')) * (zid ? o.bias?.[zid] ?? 1 : 1) / (d.t + 0.75 * d.e + 0.25);
        if (v > 0 && (!best || v > best.v)) best = { mv: { card: opt.card, zone: zid, uid: opt.uid }, v, cost: [d.t, d.e] };
      }
    }
    if (!best) break;
    const { mv } = best;
    addEff(effects(c, mv.card, mv.zone, view), o.side, mv.zone ? DIM[Math.min(DIM.length - 1, counts[mv.zone] ?? 0)] : 1, o.mul ?? 1, kf, kd, km);
    if (mv.zone) counts[mv.zone] = (counts[mv.zone] ?? 0) + 1;
    used[mv.card] = (used[mv.card] ?? 0) + 1;
    if (mv.uid !== undefined) hand.splice(hand.findIndex(h => h.uid === mv.uid), 1);
    t -= best.cost[0]; e -= best.cost[1];
    out.push(mv);
  }
  return out;
}

/** Le camp adverse : défend ses bastions attaqués, attaque les zones indécises, un peu d'imprécision */
export function planAi(c: Camp): Move[] {
  const bias: Record<string, number> = {};
  for (const z of c.zones) {
    const s = zoneShare(z);
    // Bastion attaqué la semaine passée : riposte
    if (c.lastP.includes(z.id) && s < 0.52) bias[z.id] = 1.5;
    // Zones où il est déjà largement battu : il lâche prise
    if (s > 0.58) bias[z.id] = 0.6;
  }
  const late = c.week >= WEEKS - 2;
  const moves = greedyPlan(c, {
    side: 'a', time: TIME, money: c.aiMoney, foresight: clamp(0.35 + 0.5 * (c.diff - 1), 0.15, 0.7), noise: clamp(0.5 - 0.3 * (c.diff - 1), 0.3, 0.6),
    cards: baseCards(c.variant).filter(k => k !== 'debat' && k !== 'spot' || (k === 'spot' && late)), used: c.aiUsed, bias, mul: c.aiMul,
    thrift: c.week <= 3 ? 0.3 : 0,
  });
  // Coup de pouce occasionnel : une personnalité soutient l'adversaire
  if (rnd(c) < 0.15 + 0.1 * (c.diff - 1)) {
    const best = [...c.zones].sort((a, b) => Math.abs(zoneShare(a) - 0.5) / a.w - Math.abs(zoneShare(b) - 0.5) / b.w)[0];
    moves.push({ card: 'star', zone: best.id });
  }
  return moves;
}

/** Pose un coup du joueur (payé tout de suite ; les cartes immédiates s'appliquent aussitôt) */
export function pose(c: Camp, pending: Move[], m: Move): boolean {
  if (!playable(c, m.card, pending, m.uid)) return false;
  const d = CARDS[m.card];
  c.time -= d.t; c.money -= d.e;
  if (d.scope === 'instant') {
    if (m.card === 'dons') c.money = Math.min(CASH_CAP + 4, c.money + 4);
    if (m.card === 'sondage') c.spied = true;
    c.hand = c.hand.filter(h => h.uid !== m.uid);
    return true;
  }
  pending.push(m);
  return true;
}
/** Retire le dernier coup posé (remboursé) */
export function unpose(c: Camp, pending: Move[]): Move | undefined {
  const m = pending.pop();
  if (m) { const d = CARDS[m.card]; c.time += d.t; c.money += d.e; }
  return m;
}

/** Le joueur peut-il jouer cette carte maintenant ? (budget déjà réduit des coups en attente) */
export function playable(c: Camp, card: CardId, pending: Move[], uid?: number): boolean {
  const d = CARDS[card];
  if (d.t > c.time || d.e > c.money) return false;
  if (d.from && c.week < d.from) return false;
  if (d.max !== undefined && (c.used[card] ?? 0) + pending.filter(m => m.card === card).length >= d.max) return false;
  if (uid !== undefined && pending.some(m => m.uid === uid)) return false;
  return true;
}

/** Fin de semaine : usure, coups des deux camps, scandales, sondage */
export function resolveWeek(c: Camp, moves: Move[]): WeekReport {
  const before: Record<string, number> = {};
  for (const z of c.zones) before[z.id] = zoneResult(z, c.variant);
  for (const z of c.zones) {
    z.pf *= DECAY.f; z.af *= DECAY.f; z.pd *= DECAY.d; z.ad *= DECAY.d; z.pm *= DECAY.m; z.am *= DECAY.m;
  }
  const rep: WeekReport = { ai: c.aiPlan, lost: [], won: [], poll: 0, delta: {} };
  const apply = (list: Move[], side: Side) => {
    const counts: Record<string, number> = {};
    for (const m of list) {
      if (m.card === 'debat') {
        const behind = nationalShare(c.zones, c.variant) < 0.5;
        const p = 0.56 - 0.1 * (c.diff - 1) + (behind ? 0.04 : 0);
        const win = rnd(c) < p;
        if (side === 'p') rep.debate = win ? 'win' : 'loss'; else rep.aiDebate = win ? 'win' : 'loss';
        const all = c.zones.map(z => ({ z, f: win ? 1.4 : 1.1, d: 0, m: 0 }));
        addEff(all, win === (side === 'p') ? 'p' : 'a', 1);
        continue;
      }
      const k = m.zone ? DIM[Math.min(DIM.length - 1, counts[m.zone] ?? 0)] : 1;
      if (m.zone) counts[m.zone] = (counts[m.zone] ?? 0) + 1;
      addEff(effects(c, m.card, m.zone), side, k, side === 'a' ? c.aiMul : 1);
    }
  };
  apply(moves.filter(m => m.card !== 'scandale' && CARDS[m.card].scope !== 'instant'), 'p');
  apply(c.aiPlan, 'a');
  for (const m of moves) {
    const d = CARDS[m.card];
    if (d.max !== undefined) c.used[m.card] = (c.used[m.card] ?? 0) + 1;
  }
  for (const m of c.aiPlan) { const d = CARDS[m.card]; if (d.max !== undefined) c.aiUsed[m.card] = (c.aiUsed[m.card] ?? 0) + 1; }
  // Coût de l'adversaire (le joueur paie au moment où il pose)
  for (const m of c.aiPlan) if (m.card !== 'star') c.aiMoney -= CARDS[m.card].e;
  c.aiMoney = Math.max(0, c.aiMoney);
  // Scandales non contrés
  for (const h of c.hand.filter(x => x.card === 'scandale' && x.exp <= c.week)) {
    if (moves.some(m => m.uid === h.uid)) continue;
    const z = c.zones.find(q => q.id === h.zone);
    if (z) { z.ad += 3; for (const q of c.zones) q.af += 0.6; rep.scandal = z.name; }
  }
  const used = new Set(moves.map(m => m.uid).filter(u => u !== undefined));
  c.hand = c.hand.filter(h => !used.has(h.uid) && !(h.card === 'scandale' && h.exp <= c.week));
  for (const z of c.zones) {
    const s = zoneResult(z, c.variant);
    rep.delta[z.id] = s - before[z.id];
    if (before[z.id] >= 0.5 && s < 0.5) rep.lost.push(z.id);
    if (before[z.id] < 0.5 && s >= 0.5) rep.won.push(z.id);
  }
  c.lastP = [...new Set(moves.map(m => m.zone).filter((z): z is string => !!z))];
  rep.poll = poll(c);
  c.polls.push(rep.poll);
  c.week++;
  return rep;
}

/** Le soir du scrutin : un peu d'aléa local et national */
export function finalResults(c: Camp): FinalResult {
  const swing = gauss(c) * 0.004;
  let me = 0, them = 0, reg = 0, won = 0;
  const zones = c.zones.map(z => {
    const s0 = clamp(zoneShare(z) + swing + gauss(c) * 0.007, 0.02, 0.98);
    const [tm, ta] = c.variant === 'referendum' ? turnouts(z) : [0.74 + z.tb * 0.1, 0.74 + z.tb * 0.1];
    const m = z.w * s0 * tm, t = z.w * (1 - s0) * ta;
    me += m; them += t; reg += z.w;
    if (m >= t) won++;
    return { id: z.id, share: m / (m + t), turnout: (m + t) / z.w, me: m, them: t };
  });
  const share = me / (me + them);
  return { zones, share, margin: (share - 0.5) * 100, turnout: (me + them) / reg, won };
}

/* ── Composant ─────────────────────────────────────────────── */

interface VariantText { me: string; them: string; rival: string; Rival: string; unit: string; zone: string; zones: string; brief: string; goal: string; win: string; loss: string }
const TEXTS: Record<Variant, VariantText> = {
  presidentielle: {
    me: 'Vous', them: 'Adversaire', rival: 'le candidat adverse', Rival: 'Le candidat adverse', unit: 'M', zone: 'région', zones: 'régions',
    brief: 'Huit semaines pour conquérir le pays, région par région. Chaque région pèse selon son nombre d’électeurs.',
    goal: 'Dépasser 50 % des voix au niveau national.', win: 'Vous êtes élu·e à la présidence de la République !', loss: 'Le candidat adverse l’emporte.',
  },
  legislatives: {
    me: 'Vous', them: 'Sortant', rival: 'le député sortant', Rival: 'Le député sortant', unit: 'k', zone: 'canton', zones: 'cantons',
    brief: 'Huit semaines pour ravir la circonscription au député sortant, canton par canton. Les gros cantons pèsent plus lourd.',
    goal: 'Plus de voix que le sortant sur l’ensemble de la circonscription.', win: 'La circonscription est à vous !', loss: 'Le député sortant conserve son siège.',
  },
  referendum: {
    me: 'Oui', them: 'Non', rival: 'le camp du Non', Rival: 'Le camp du Non', unit: 'M', zone: 'région', zones: 'régions',
    brief: 'Vous menez le camp du Oui. Convaincre ne suffit pas : il faut aussi faire voter vos partisans (porte-à-porte, meetings, mobilisation).',
    goal: 'Plus de 50 % de Oui parmi les votants.', win: 'Le Oui l’emporte !', loss: 'Le Non l’emporte.',
  },
};

type Phase = 'brief' | 'play' | 'reveal' | 'night' | 'over';
interface TileView {
  id: string; short: string; left: number; top: number; w: number; h: number; color: string; dark: boolean;
  pct: string; weight: string; gain: string; mine: string; theirs: string; alert: boolean; target: boolean; label: string; flash: string; hidden: boolean;
}
interface CardView { key: string; card: CardId; uid?: number; zone?: string; icon: string; name: string; cost: string; ok: boolean; event: boolean; urgent: boolean; expiring: boolean; left?: number }
interface Night { res: FinalResult; order: number[]; shown: number }

const fmt = (x: number, d = 1) => x.toFixed(d).replace('.', ',').replace('-', '−');
const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const ME_RGB = [47, 111, 179], THEM_RGB = [192, 57, 43], MID_RGB = [226, 221, 208];
function leanColor(s: number): { color: string; dark: boolean } {
  const t = clamp((s - 0.5) / 0.09, -1, 1);
  const rgb = t >= 0 ? lerp(MID_RGB, ME_RGB, t) : lerp(MID_RGB, THEM_RGB, -t);
  return { color: `rgb(${rgb.join(',')})`, dark: Math.abs(t) > 0.62 };
}

@Component({
  selector: 'app-campagne-game',
  template: `
    @if (camp(); as c) {
    <div class="cg">
      <div class="head">
        <span>Semaine <b class="mono">{{ Math.min(weekNo(), weeks) }}</b>/{{ weeks }}</span>
        <span class="res" [attr.aria-label]="'Temps : ' + c.time + ' sur ' + pips.length">⏱ @for (i of pips; track i) { <i class="pip" [class.on]="i < c.time"></i> }</span>
        <span class="res" aria-label="Argent">💶 <b class="mono">{{ c.money }}</b></span>
        <span class="poll" [class.up]="lastPoll() >= 50" [class.down]="lastPoll() < 50">📊 {{ txt.me }} <b class="mono">{{ fmt(lastPoll()) }} %</b></span>
      </div>

      <div class="map" [style.aspect-ratio]="mapW + ' / ' + mapH" role="group" [attr.aria-label]="'Carte des ' + txt.zones">
        @for (t of tiles(); track t.id) {
          <button type="button" class="tile" [class.dark]="t.dark" [class.focus]="focus() === t.id" [class.aim]="aiming()" [class.hid]="t.hidden"
                  [class]="'tile ' + t.flash" [style.left.%]="t.left" [style.top.%]="t.top" [style.width.%]="t.w" [style.height.%]="t.h" [style.background]="t.color"
                  [disabled]="phase() === 'night'" (click)="tapZone(t.id)" [attr.aria-label]="t.label">
            <span class="code">{{ t.short }}</span>
            <span class="pct mono">{{ t.pct }}</span>
            @if (t.weight) { <span class="wt">{{ t.weight }}</span> }
            @if (t.gain) { <span class="gain mono">{{ t.gain }}</span> }
            @if (t.alert) { <span class="badge">⚠️</span> } @else if (t.target) { <span class="badge">🎯</span> }
            @if (t.mine) { <span class="dots me" aria-hidden="true">{{ t.mine }}</span> }
            @if (t.theirs) { <span class="dots them" aria-hidden="true">{{ t.theirs }}</span> }
          </button>
        }
      </div>
      <p class="legend"><i class="sw me"></i>{{ txt.me }} <i class="sw mid"></i>serré <i class="sw them"></i>{{ txt.them }}
        <span class="muted">· <b class="m">•</b> vos coups · <b class="t">•</b> coups adverses</span></p>

      @switch (phase()) {
        @case ('brief') {
          <div class="panel brief">
            <p><b>{{ def().title }}.</b> {{ txt.brief }} <b>Objectif :</b> {{ txt.goal }}</p>
            <ul>
              <li>Chaque semaine : {{ pips.length }} ⏱ de temps (non reportable) et +3 💶 (l’argent s’épargne).</li>
              <li>Choisissez une carte puis touchez une {{ txt.zone }} : le gain immédiat s’affiche sur la carte.</li>
              <li>Le porte-à-porte dure ; meetings, affiches et visites s’estompent vite. Semez tôt, frappez tard.</li>
              <li>Insister au même endroit la même semaine rapporte de moins en moins.</li>
              <li>{{ txt.Rival }} joue en même temps que vous ; ses coups sont révélés en fin de semaine.</li>
            </ul>
            <button type="button" class="btn primary small" (click)="begin()">Entrer en campagne ▸</button>
          </div>
        }
        @case ('play') {
          <div class="hand" role="toolbar" aria-label="Vos cartes">
            @for (k of cards(); track k.key) {
              <button type="button" class="card" [class.ev]="k.event" [class.urgent]="k.urgent" [class.on]="sel() === k.key" [disabled]="!k.ok"
                      (click)="pick(k.key)" [attr.aria-pressed]="sel() === k.key" [attr.aria-label]="k.name + ', ' + (k.cost || 'gratuit') + (k.expiring ? ', expire cette semaine' : '')">
                <span class="ic">{{ k.icon }}</span><span class="nm">{{ k.name }}</span>
                <span class="cost mono">{{ k.cost || 'gratuit' }}@if (k.left !== undefined) { · ×{{ k.left }} }@if (k.expiring) { ⌛ }</span>
              </button>
            }
          </div>
          <div class="panel info" aria-live="polite">
            @if (selCard(); as k) {
              @let d = defOf(k.card);
              <p><b>{{ d.icon }} {{ d.name }}</b> — {{ d.desc }}</p>
              @if (d.scope === 'zone') { <p class="muted small">Touchez une {{ txt.zone }} : le chiffre vert est le gain immédiat, en points, dans la {{ txt.zone }}.</p> }
              @else {
                <button type="button" class="btn primary small" (click)="launch()">
                  {{ d.scope === 'fixed' ? 'Contrer en ' + zoneName(k.zone) : d.scope === 'instant' ? 'Utiliser' : 'Lancer' }} ▸@if (d.scope === 'national' && natGain()) { <span class="mono"> ({{ natGain() }})</span> }
                </button>
              }
            } @else if (focusZone(); as z) {
              <p><b>{{ z.name }}</b> · {{ fmt(z.w, z.w < 1 ? 2 : 1) }} {{ txt.unit }} d’électeurs · @for (p of z.profiles; track p) { <span class="tag">{{ profileLabel(p) }}</span> }</p>
              <p class="small">{{ txt.me }} <b class="mono">{{ fmt(zoneShare100(z)) }} %</b> · indécis {{ fmt(z.und * 100, 0) }} %
                · élan <span class="mono m">{{ fmt(z.pf + z.pd) }}</span> contre <span class="mono t">{{ fmt(z.af + z.ad) }}</span>
                @if (variant === 'referendum') { · participation <span class="mono m">{{ fmt(turn(z)[0] * 100, 0) }}</span>/<span class="mono t">{{ fmt(turn(z)[1] * 100, 0) }}</span> % }</p>
            } @else {
              <p class="muted small">{{ hint() }}</p>
            }
          </div>
          @if (pendingList().length) {
            <p class="queue"><span class="muted">Cette semaine :</span> @for (p of pendingList(); track $index) { <span class="qchip">{{ p }}</span> }</p>
          }
          <div class="actions">
            <button type="button" class="btn small" [disabled]="!pending().length" (click)="undo()" aria-label="Annuler le dernier coup">↶ Annuler</button>
            <button type="button" class="btn primary small" (click)="endWeek()">Fin de la semaine ▸</button>
          </div>
        }
        @case ('reveal') {
          @if (report(); as r) {
            <div class="panel reveal" aria-live="polite">
              <p><b>Fin de la semaine {{ weekNo() - 1 }}</b> · sondage : <b class="mono">{{ fmt(r.poll) }} %</b> pour {{ txt.me === 'Vous' ? 'vous' : 'le ' + txt.me }}</p>
              @if (r.debate) { <p [class.good]="r.debate === 'win'" [class.bad]="r.debate === 'loss'">🎙️ {{ r.debate === 'win' ? 'Débat remporté : vous avez dominé l’échange.' : 'Débat perdu : ' + txt.rival + ' a pris l’ascendant.' }}</p> }
              @if (r.scandal) { <p class="bad">⚠️ Le scandale n’a pas été contré en {{ r.scandal }} : il fait des dégâts.</p> }
              @if (r.lost.length) { <p class="bad">Basculent chez l’adversaire : {{ names(r.lost) }}.</p> }
              @if (r.won.length) { <p class="good">Basculent de votre côté : {{ names(r.won) }}.</p> }
              <p class="small"><b>{{ txt.Rival }} a joué :</b></p>
              <ul class="ai">@for (l of aiLines(); track $index) { <li>{{ l }}</li> } @empty { <li class="muted">Rien cette semaine.</li> }</ul>
              <button type="button" class="btn primary small" (click)="nextWeek()">{{ weekNo() > weeks ? 'Soir du scrutin ▸' : 'Semaine ' + weekNo() + ' ▸' }}</button>
            </div>
          }
        }
        @default {
          @if (night(); as n) {
            @let tl = tally();
            <div class="panel nightp" aria-live="polite">
              <p><b>{{ phase() === 'over' ? message() : 'Soir du scrutin : dépouillement en cours…' }}</b></p>
              <div class="tallybar" role="img" [attr.aria-label]="txt.me + ' ' + fmt(tl.share) + ' %'">
                <span class="me" [style.width.%]="tl.share"></span><i class="half"></i>
              </div>
              <p class="small mono">{{ txt.me }} {{ fmt(tl.share) }} % — {{ txt.them }} {{ fmt(100 - tl.share) }} % · {{ n.shown }}/{{ n.order.length }} {{ txt.zones }} dépouillées
                @if (variant === 'referendum') { · participation {{ fmt(tl.turnout, 0) }} % }</p>
              @if (phase() === 'over') { <p class="small">{{ n.res.won }} {{ txt.zones }} sur {{ n.order.length }} gagnées · écart {{ fmt(Math.abs(n.res.margin) * 2) }} points.</p> }
            </div>
          }
        }
      }

      <div class="foot">
        <svg class="curve" viewBox="0 0 160 46" role="img" [attr.aria-label]="'Sondages : ' + curveLabel()">
          @let cv = curve();
          <line x1="6" x2="154" [attr.y1]="cv.mid" [attr.y2]="cv.mid" class="fifty" />
          <text x="155" [attr.y]="cv.mid + 2" class="lbl">50</text>
          <polyline [attr.points]="cv.points" class="line" />
          @for (p of cv.dots; track $index) { <circle [attr.cx]="p.x" [attr.cy]="p.y" r="1.8" [class.up]="p.v >= 50" /> }
          @for (w of cv.ticks; track $index) { <text [attr.x]="w.x" y="45" class="tk">{{ w.l }}</text> }
          @if (cv.dots.length > 1) { @let lp = cv.dots[cv.dots.length - 1]; <text [attr.x]="lp.x" [attr.y]="lp.y - 3.5" class="tk last">{{ fmt(lp.v) }}</text> }
        </svg>
        <ul class="log">@for (l of log(); track $index) { <li>{{ l }}</li> }</ul>
      </div>
    </div>
    }
  `,
  styles: `
    :host { display: block; width: 100%; }
    .cg { display: grid; gap: 8px; }
    .head { display: flex; flex-wrap: wrap; gap: 6px 12px; justify-content: space-between; align-items: center; font-size: 12.5px; }
    .res { display: inline-flex; align-items: center; gap: 3px; }
    .pip { display: inline-block; width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid var(--ink-3); &.on { background: var(--accent); border-color: var(--accent); } }
    .poll.up b { color: #2f6fb3; } .poll.down b { color: var(--bad); }
    .map { position: relative; width: calc(100% - 8px); max-width: 430px; margin-top: 6px; justify-self: center; user-select: none; }
    .tile { position: absolute; border: 0; border-radius: 9px; padding: 0; cursor: pointer; color: #1f1d1a; display: grid; place-content: center; text-align: center; gap: 1px;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); transition: background .5s ease, transform .15s ease; font: inherit; line-height: 1.05;
      &.dark { color: #fff; } &:disabled { cursor: default; }
      &.focus { box-shadow: inset 0 0 0 3px #f4d35e; }
      &.aim:not(:disabled):hover { transform: scale(1.04); }
      &.up { animation: glowUp 1.2s ease 2; } &.down { animation: glowDown 1.2s ease 2; }
      &.hid { background: #9a968c !important; color: #fff; } }
    .code { font-weight: 800; font-size: clamp(9.5px, 2.8vw, 12px); letter-spacing: -.01em; }
    .pct { font-size: clamp(10px, 3vw, 13px); }
    .wt { font-size: 9.5px; opacity: .8; }
    .gain { position: absolute; top: -7px; right: -5px; z-index: 2; padding: 1px 4px; border-radius: 8px; background: #1f8a4c; color: #fff; font-size: 10.5px; font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,.3); }
    .badge { position: absolute; top: -6px; left: -4px; z-index: 2; font-size: 13px; }
    .dots { position: absolute; bottom: 1px; font-size: 13px; line-height: 1; letter-spacing: -2px; text-shadow: 0 0 2px #fff;
      &.me { left: 4px; color: #1d4f86; } &.them { right: 5px; color: #9b2316; } }
    @keyframes glowUp { 50% { box-shadow: inset 0 0 0 4px #7fb2ea; } }
    @keyframes glowDown { 50% { box-shadow: inset 0 0 0 4px #f08f80; } }
    .legend { margin: 0; font-size: 11.5px; color: var(--ink-2); display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
      .sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; &.me { background: rgb(47,111,179); } &.mid { background: rgb(226,221,208); } &.them { background: rgb(192,57,43); } }
      .m { color: #2f6fb3; } .t { color: var(--bad); } }
    .panel { display: grid; gap: 6px; padding: 9px 11px; border-radius: 10px; background: var(--surface-2); font-size: 13px; p { margin: 0; } ul { margin: 0; padding-left: 18px; } }
    .brief li { font-size: 12.5px; color: var(--ink-2); margin: 2px 0; }
    .hand { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 5px; }
    .card { display: grid; justify-items: center; gap: 1px; min-height: 52px; padding: 4px 3px; border-radius: 9px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; font: inherit;
      .ic { font-size: 17px; line-height: 1; } .nm { font-size: 10.5px; font-weight: 600; line-height: 1.1; text-align: center; } .cost { font-size: 10px; color: var(--ink-2); }
      &.ev { border-style: dashed; border-color: var(--accent); }
      &.urgent { border: 2px solid var(--bad); background: var(--bad-soft); }
      &.on { outline: 3px solid var(--accent); outline-offset: -1px; background: var(--surface-2); }
      &:disabled { opacity: .4; cursor: default; } }
    .info { min-height: 46px; }
    .tag { display: inline-block; margin-right: 4px; font-size: 11.5px; }
    .m { color: #2f6fb3; } .t { color: var(--bad); }
    .queue { margin: 0; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: 11.5px; }
    .qchip { padding: 2px 6px; border-radius: 10px; background: var(--good-soft); }
    .actions { display: flex; gap: 8px; justify-content: flex-end; .btn { min-height: 36px; } }
    .reveal .ai { font-size: 12px; color: var(--ink-2); max-height: 110px; overflow: auto; }
    .good { color: var(--good); } .bad { color: var(--bad); }
    .tallybar { position: relative; height: 14px; border-radius: 7px; background: rgb(192,57,43); overflow: hidden;
      .me { display: block; height: 100%; background: rgb(47,111,179); transition: width .35s ease; }
      .half { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 2px; background: #fff; } }
    .foot { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; align-items: start; }
    .curve { width: 100%; height: auto; background: var(--surface-2); border-radius: 8px;
      .fifty { stroke: var(--ink-3); stroke-width: .6; stroke-dasharray: 2 2; } .line { fill: none; stroke: #2f6fb3; stroke-width: 1.4; }
      circle { fill: var(--bad); &.up { fill: #2f6fb3; } } .lbl, .tk { font-size: 5px; fill: var(--ink-3); } .tk.last { fill: var(--ink); font-weight: 700; } .lbl { text-anchor: start; } .tk { text-anchor: middle; } }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 84px; overflow: auto; font-size: 11px; color: var(--ink-2); }
    .small { font-size: 12px; } .muted { color: var(--ink-3); }
    @media (max-width: 420px) { .foot { grid-template-columns: 1fr; } }
    @media (prefers-reduced-motion: reduce) { .tile, .tallybar .me { transition: none; } .tile.up, .tile.down { animation: none; } .tile.aim:hover { transform: none; } }
  `,
})
export class CampagneGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly weeks = WEEKS;
  protected readonly pips = Array.from({ length: TIME }, (_, i) => i);
  protected readonly fmt = fmt;
  protected readonly Math = Math;
  protected variant: Variant = 'presidentielle';
  protected txt: VariantText = TEXTS.presidentielle;
  protected mapW = 1;
  protected mapH = 1;
  private geo: Record<string, { left: number; top: number; w: number; h: number }> = {};

  protected readonly camp = signal<Camp | null>(null, { equal: () => false });
  protected readonly phase = signal<Phase>('brief');
  protected readonly pending = signal<Move[]>([]);
  protected readonly sel = signal<string | null>(null);
  protected readonly focus = signal<string | null>(null);
  protected readonly report = signal<WeekReport | null>(null);
  protected readonly log = signal<string[]>([]);
  protected readonly night = signal<Night | null>(null);
  protected readonly message = signal('');
  private timers: ReturnType<typeof setTimeout>[] = [];
  private reduced = false;

  protected readonly weekNo = computed(() => this.camp()?.week ?? 1);
  protected readonly lastPoll = computed(() => { const p = this.camp()?.polls ?? [50]; return p[p.length - 1]; });

  protected readonly selCard = computed(() => {
    const c = this.camp(), k = this.sel();
    if (!c || !k) return null;
    if (k.startsWith('h:')) { const h = c.hand.find(x => x.uid === +k.slice(2)); return h ? { card: h.card, uid: h.uid, zone: h.zone } : null; }
    return { card: k.slice(2) as CardId, uid: undefined as number | undefined, zone: undefined as string | undefined };
  });
  protected readonly aiming = computed(() => { const s = this.selCard(); return !!s && this.phase() === 'play' && CARDS[s.card].scope === 'zone'; });
  protected readonly focusZone = computed(() => { const c = this.camp(), f = this.focus(); return c && f ? c.zones.find(z => z.id === f) ?? null : null; });

  protected readonly tiles = computed<TileView[]>(() => {
    const c = this.camp();
    if (!c) return [];
    const ph = this.phase(), n = this.night(), rep = this.report(), pend = this.pending(), s = this.selCard();
    const counts: Record<string, number> = {};
    for (const m of pend) if (m.zone && CARDS[m.card].scope === 'zone') counts[m.zone] = (counts[m.zone] ?? 0) + 1;
    const theirs: Record<string, number> = {};
    if (rep && (ph === 'reveal' || ph === 'play')) for (const m of rep.ai) if (m.zone) theirs[m.zone] = (theirs[m.zone] ?? 0) + 1;
    const scandal = new Set(c.hand.filter(h => h.card === 'scandale').map(h => h.zone));
    const spied = c.spied && ph === 'play' ? new Set(c.aiPlan.map(m => m.zone)) : new Set<string | undefined>();
    const aim = s && ph === 'play' && CARDS[s.card].scope === 'zone' && playable(c, s.card, pend, s.uid) ? s.card : null;
    return c.zones.map((z, i) => {
      const g = this.geo[z.id];
      let share = zoneResult(z, c.variant), hidden = false;
      if (n) {
        const rank = n.order.indexOf(i);
        hidden = rank >= n.shown;
        share = n.res.zones[i].share;
      }
      const { color, dark } = leanColor(share);
      let gain = '';
      if (aim) {
        const zs = cloneZones(c.zones);
        const before = zoneResult(zs[i], c.variant);
        addEff(effects(c, aim, z.id, zs), 'p', DIM[Math.min(DIM.length - 1, counts[z.id] ?? 0)]);
        const d = (zoneResult(zs[i], c.variant) - before) * 100;
        gain = d >= 0.05 ? '+' + fmt(d) : '+0';
      }
      const pct = hidden ? '…' : fmt(share * 100, n ? 1 : 0) + ' %';
      const label = `${z.name}, ${fmt(z.w, z.w < 1 ? 2 : 1)} ${this.txt.unit} d’électeurs, ${this.txt.me} ${hidden ? 'non dépouillé' : pct}`
        + (gain ? `, gain immédiat ${gain} points` : '') + (scandal.has(z.id) ? ', scandale à contrer' : '') + (counts[z.id] ? `, ${counts[z.id]} coups prévus` : '');
      return {
        id: z.id, short: z.short, ...g, color, dark: dark && !hidden, pct, gain, label, hidden, weight: c.variant === 'legislatives' ? `${fmt(z.w, 0)} k électeurs` : '',
        mine: '•'.repeat(Math.min(4, counts[z.id] ?? 0)), theirs: ph === 'night' || ph === 'over' ? '' : '•'.repeat(Math.min(4, theirs[z.id] ?? 0)),
        alert: scandal.has(z.id) && ph === 'play', target: spied.has(z.id),
        flash: ph === 'reveal' && rep && !this.reduced ? ((rep.delta[z.id] ?? 0) > 0.006 ? 'up' : (rep.delta[z.id] ?? 0) < -0.006 ? 'down' : '') : '',
      };
    });
  });

  protected readonly cards = computed<CardView[]>(() => {
    const c = this.camp();
    if (!c) return [];
    const pend = this.pending();
    const out: CardView[] = [];
    for (const id of baseCards(this.variant)) {
      const d = cardDef(id, this.variant);
      const left = d.max !== undefined ? d.max - (c.used[id] ?? 0) - pend.filter(m => m.card === id).length : undefined;
      out.push({ key: 'b:' + id, card: id, icon: d.icon, name: d.name, cost: this.costLabel(d), ok: playable(c, id, pend), event: false, urgent: false, expiring: false, left });
    }
    for (const h of c.hand) {
      const d = cardDef(h.card, this.variant);
      out.push({
        key: 'h:' + h.uid, card: h.card, uid: h.uid, zone: h.zone, icon: d.icon, name: h.card === 'scandale' ? 'Scandale : ' + this.zoneShort(h.zone) : d.name,
        cost: this.costLabel(d), ok: playable(c, h.card, pend, h.uid), event: true, urgent: h.card === 'scandale' && !pend.some(m => m.uid === h.uid), expiring: h.exp <= c.week,
      });
    }
    return out;
  });

  protected readonly pendingList = computed(() => this.pending().map(m => `${CARDS[m.card].icon} ${m.zone ? this.zoneShort(m.zone) : 'national'}`));

  protected readonly natGain = computed(() => {
    const c = this.camp(), s = this.selCard();
    if (!c || !s || CARDS[s.card].scope !== 'national' || s.card === 'debat') return '';
    const zs = cloneZones(c.zones);
    const before = nationalShare(zs, c.variant);
    addEff(effects(c, s.card, undefined, zs), 'p', 1);
    return '+' + fmt((nationalShare(zs, c.variant) - before) * 100, 2) + ' pt';
  });

  protected readonly aiLines = computed(() => {
    const r = this.report();
    if (!r) return [];
    const grouped = new Map<string, number>();
    for (const m of r.ai) {
      const d = cardDef(m.card, this.variant);
      const line = m.card === 'star' ? `⭐ Une personnalité s’affiche à ses côtés en ${this.zoneName(m.zone)}` : `${d.icon} ${d.name}${m.zone ? ' · ' + this.zoneName(m.zone) : ' (partout)'}`;
      grouped.set(line, (grouped.get(line) ?? 0) + 1);
    }
    return [...grouped].map(([l, k]) => (k > 1 ? `${l} ×${k}` : l));
  });

  protected readonly tally = computed(() => {
    const n = this.night();
    if (!n) return { share: 50, turnout: 0 };
    let me = 0, them = 0, w = 0;
    for (let k = 0; k < n.shown; k++) { const z = n.res.zones[n.order[k]]; me += z.me; them += z.them; w += this.camp()!.zones[n.order[k]].w; }
    return me + them ? { share: (me / (me + them)) * 100, turnout: ((me + them) / w) * 100 } : { share: 50, turnout: 0 };
  });

  protected readonly curve = computed(() => {
    const polls = this.camp()?.polls ?? [];
    const lo = Math.min(50, ...polls) - 1.5, hi = Math.max(50, ...polls) + 1.5;
    const y = (v: number) => 4 + (1 - (v - lo) / (hi - lo)) * 34;
    const x = (i: number) => 8 + i * (144 / WEEKS);
    const dots = polls.map((v, i) => ({ x: x(i), y: y(v), v }));
    return {
      mid: y(50), dots, points: dots.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      ticks: Array.from({ length: WEEKS + 1 }, (_, i) => ({ x: x(i), l: i === 0 ? 'départ' : 'S' + i })).filter((_, i) => i % 2 === 0 || i === WEEKS),
    };
  });

  ngOnInit(): void {
    this.variant = variantOf(this.def().id);
    this.txt = TEXTS[this.variant];
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const c = newCampaign(this.variant, this.diff(), Math.floor(Math.random() * 2 ** 31));
    const maxX = Math.max(...c.zones.map(z => z.x)) + 1, maxY = Math.max(...c.zones.map(z => z.y)) + 1;
    this.mapW = maxX; this.mapH = maxY;
    for (const z of c.zones) this.geo[z.id] = { left: (z.x / maxX) * 100, top: (z.y / maxY) * 100, w: (0.94 / maxX) * 100, h: (0.94 / maxY) * 100 };
    this.camp.set(c);
    this.say(`Premier sondage : ${this.txt.me} ${fmt(c.polls[0])} %. ${this.txt.Rival} part devant.`);
  }

  ngOnDestroy(): void { this.timers.forEach(t => clearTimeout(t)); }

  /* ── Libellés ── */

  protected defOf(id: CardId): CardDef { return cardDef(id, this.variant); }
  protected profileLabel(p: Profile): string { return PROFILE_LABEL[p]; }
  protected zoneShare100(z: Zone): number { return zoneResult(z, this.variant) * 100; }
  protected turn(z: Zone): [number, number] { return turnouts(z); }
  protected zoneName(id?: string): string { return this.camp()?.zones.find(z => z.id === id)?.name ?? ''; }
  private zoneShort(id?: string): string { return this.camp()?.zones.find(z => z.id === id)?.short ?? ''; }
  protected names(ids: string[]): string { return ids.map(id => this.zoneName(id)).join(', '); }
  private costLabel(d: CardDef): string { return [d.t ? `⏱${d.t}` : '', d.e ? `💶${d.e}` : ''].filter(Boolean).join(' '); }
  protected curveLabel(): string { return (this.camp()?.polls ?? []).map(p => fmt(p)).join(', '); }
  protected hint(): string {
    const c = this.camp();
    if (!c) return '';
    if (c.hand.some(h => h.card === 'scandale')) return 'Un scandale menace : contrez-le avant la fin de la semaine (carte rouge).';
    if (c.week <= 3) return 'Début de campagne : le porte-à-porte et les ralliements tiendront jusqu’au scrutin. Gardez de l’argent pour la fin.';
    if (c.week >= WEEKS - 1) return 'Dernière ligne droite : meetings, affiches et visites frappent fort maintenant.';
    return 'Touchez une carte puis une ' + this.txt.zone + '. Touchez une ' + this.txt.zone + ' seule pour voir son détail.';
  }

  /* ── Jeu ── */

  protected begin(): void {
    this.phase.set('play');
    for (const h of this.camp()!.hand) this.say(`Carte en main : ${CARDS[h.card].icon} ${CARDS[h.card].name}.`);
    this.emitProgress();
  }

  protected pick(key: string): void {
    if (this.phase() !== 'play') return;
    this.sel.set(this.sel() === key ? null : key);
  }

  protected tapZone(id: string): void {
    const s = this.selCard();
    if (this.phase() === 'play' && s) {
      const scope = CARDS[s.card].scope;
      if (scope === 'zone') return this.place({ card: s.card, zone: id, uid: s.uid });
      if (scope === 'fixed' && s.zone === id) return this.place({ card: s.card, zone: id, uid: s.uid });
    }
    this.focus.set(this.focus() === id ? null : id);
  }

  protected launch(): void {
    const s = this.selCard();
    if (!s) return;
    const c = this.camp()!;
    this.place({ card: s.card, zone: s.zone, uid: s.uid });
    if (s.card === 'dons') this.say('💶 Dîner de donateurs : +4 €.');
    if (s.card === 'sondage') this.say(`📊 Le sondage révèle les cibles de ${this.txt.rival} (🎯) : ${[...new Set(c.aiPlan.map(m => this.zoneShort(m.zone)).filter(Boolean))].join(', ') || 'aucune'}.`);
  }

  private place(m: Move): void {
    const c = this.camp()!;
    const p = [...this.pending()];
    if (!pose(c, p, m)) { this.say('Budget insuffisant pour ce coup.'); return; }
    this.pending.set(p);
    this.camp.set(c);
    if (CARDS[m.card].event || !playable(c, m.card, p)) this.sel.set(null);
  }

  protected undo(): void {
    const c = this.camp()!;
    const p = [...this.pending()];
    unpose(c, p);
    this.pending.set(p);
    this.camp.set(c);
  }

  protected endWeek(): void {
    if (this.phase() !== 'play') return;
    const c = this.camp()!;
    const total = c.zones.reduce((t, z) => t + z.w, 0);
    const rep = resolveWeek(c, this.pending());
    this.pending.set([]);
    this.sel.set(null);
    this.report.set(rep);
    this.camp.set(c);
    this.phase.set('reveal');
    this.say(`Semaine ${c.week - 1} : sondage ${fmt(rep.poll)} %.`);
    if (rep.debate) this.say(rep.debate === 'win' ? '🎙️ Débat gagné.' : '🎙️ Débat perdu.');
    if (rep.scandal) this.say(`⚠️ Scandale non contré en ${rep.scandal}.`);
    if (rep.lost.length) this.say(`Perdu : ${this.names(rep.lost)}.`);
    if (rep.won.length) this.say(`Gagné : ${this.names(rep.won)}.`);
    if (rep.scandal || rep.debate === 'loss' || rep.lost.some(id => (c.zones.find(z => z.id === id)?.w ?? 0) >= total * 0.05)) this.miss.emit();
    this.emitProgress();
  }

  protected nextWeek(): void {
    const c = this.camp()!;
    if (c.week > WEEKS) return this.startNight();
    for (const n of startWeek(c)) this.say(n);
    this.camp.set(c);
    this.phase.set('play');
    this.emitProgress();
  }

  private startNight(): void {
    const c = this.camp()!;
    const res = finalResults(c);
    const order = c.zones.map((_, i) => i).sort((a, b) => c.zones[a].w - c.zones[b].w);
    this.night.set({ res, order, shown: this.reduced ? order.length : 0 });
    this.focus.set(null);
    this.phase.set('night');
    if (this.reduced) { this.timers.push(setTimeout(() => this.finish(), 600)); return; }
    const step = () => {
      const n = this.night()!;
      if (n.shown >= n.order.length) return this.finish();
      this.night.set({ ...n, shown: n.shown + 1 });
      this.timers.push(setTimeout(step, 380));
    };
    this.timers.push(setTimeout(step, 500));
  }

  private finish(): void {
    const n = this.night()!;
    const r = scoreFromMargin(n.res.margin);
    const won = n.res.margin >= 0;
    const pts = fmt(n.res.share * 100);
    this.message.set(won
      ? `${this.txt.win} ${pts} % ${n.res.margin > 5 ? '— un raz-de-marée.' : n.res.margin > 1.5 ? '— une victoire nette.' : '— sur le fil.'}`
      : `${this.txt.loss} ${pts} % pour ${this.txt.me === 'Vous' ? 'vous' : 'le ' + this.txt.me}${n.res.margin > -1.5 ? ', à un cheveu.' : '.'}`);
    this.say(this.message());
    this.phase.set('over');
    if (!won) this.miss.emit();
    this.progress.emit({ live: r, time: 0 });
    this.timers.push(setTimeout(() => this.done.emit(r), 2200));
  }

  private emitProgress(): void {
    const c = this.camp()!;
    this.progress.emit({ live: scoreFromMargin((nationalShare(c.zones, c.variant) - 0.5) * 100), time: clamp(1 - (c.week - 1) / WEEKS, 0, 1) });
  }

  private say(t: string): void { this.log.update(l => [t, ...l].slice(0, 8)); }
}

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

/* La carte : contours simplifiés (topologie conservée) des treize régions,
 * projetés en Lambert-93 ; une circonscription imaginaire pour les
 * législatives (cantons irréguliers). Les positions x / y des ZoneDef
 * restent celles du modèle (voisinages) ; seul le dessin vient d'ici. */
/** Les régions (Lambert-93 simplifié, repère 1000 × 745) */
const FR_D: Record<string, string> = {
  IDF: 'M646 181L630 169L620 164L601 164L595 160L576 154L566 157L557 152L547 174L550 192L569 222L589 222L598 235L618 233L624 218L642 216L647 197L643 188L646 181Z',
  CVL: 'M623 337L626 325L621 302L615 295L620 278L614 264L623 261L628 248L618 233L598 235L589 222L569 222L550 192L547 174L537 187L530 186L512 194L519 205L518 214L510 218L510 229L512 249L508 256L487 276L479 281L470 306L482 317L483 324L502 321L513 340L512 348L525 358L528 366L538 369L560 364L584 365L588 358L599 351L608 341L623 337Z',
  BFC: 'M623 337L633 345L652 342L660 354L673 361L675 384L694 379L695 374L712 378L716 376L722 357L737 360L754 374L774 372L781 362L783 350L799 336L802 319L809 317L825 298L822 289L825 279L833 278L826 260L818 257L804 246L798 250L786 247L780 241L770 245L759 257L759 267L734 271L723 268L718 250L710 244L701 247L667 250L659 233L642 216L624 218L618 233L628 248L623 261L614 264L620 278L615 295L621 302L626 325L623 337Z',
  NOR: 'M543 89L525 100L503 104L484 114L477 127L479 138L462 146L453 141L418 138L410 124L414 119L405 111L394 115L383 114L384 135L389 139L395 163L393 192L396 202L407 200L417 202L433 208L449 203L462 202L468 214L479 208L489 209L490 218L497 225L510 229L510 218L518 214L519 205L512 194L530 186L537 187L547 174L557 152L558 102L543 89Z',
  HDF: 'M646 181L652 173L653 146L667 139L672 123L681 115L682 97L678 79L672 68L654 69L651 57L640 57L629 35L617 42L604 33L600 12L561 23L553 29L553 53L551 72L543 89L558 102L557 152L566 157L576 154L595 160L601 164L620 164L630 169L646 181Z',
  GES: 'M682 97L681 115L672 123L667 139L653 146L652 173L646 181L643 188L647 197L642 216L659 233L667 250L701 247L710 244L718 250L723 268L734 271L759 267L759 257L770 245L780 241L786 247L798 250L804 246L818 257L826 260L833 278L846 282L856 271L851 262L856 241L853 230L860 213L864 190L876 176L880 165L869 160L852 159L842 150L828 156L816 148L807 153L797 135L782 128L768 133L758 125L743 131L733 116L717 108L703 94L692 99L682 97Z',
  PDL: 'M342 278L338 290L349 294L365 311L355 321L355 326L369 343L371 352L393 364L406 368L412 365L425 369L433 365L434 346L422 318L435 317L438 312L462 310L470 306L479 281L487 276L508 256L512 249L510 229L497 225L490 218L489 209L479 208L468 214L462 202L449 203L433 208L417 202L415 221L418 241L411 243L405 257L398 252L384 261L368 261L361 272L342 278Z',
  BRE: 'M393 192L382 193L373 186L361 193L356 186L339 195L321 176L318 168L302 172L296 170L292 181L285 178L254 177L233 186L230 195L245 210L249 220L244 229L248 239L267 241L273 246L290 250L305 258L308 265L323 263L342 278L361 272L368 261L384 261L398 252L405 257L411 243L418 241L415 221L417 202L407 200L396 202L393 192Z',
  NAQ: 'M584 365L560 364L538 369L528 366L525 358L512 348L513 340L502 321L483 324L482 317L470 306L462 310L438 312L435 317L422 318L434 346L433 365L425 369L412 365L406 368L402 375L408 390L403 406L397 413L409 421L401 431L400 444L393 488L396 492L387 531L377 569L366 585L367 597L379 597L375 613L383 612L402 621L413 621L424 634L437 631L441 617L458 594L452 587L451 576L443 575L447 553L451 549L474 546L491 540L495 544L508 531L510 519L517 518L513 505L531 491L538 481L536 471L549 470L556 477L571 474L578 456L594 443L596 419L591 409L601 394L594 375L584 365Z',
  OCC: 'M437 631L454 644L464 640L478 644L492 645L494 632L514 638L519 644L528 643L534 652L540 649L551 652L550 661L570 671L580 665L598 672L613 664L624 663L624 626L636 606L650 603L671 584L682 581L689 588L709 570L714 555L722 548L714 539L711 526L703 521L690 527L678 523L668 496L662 485L649 485L641 474L624 487L606 478L598 493L591 499L577 499L577 486L571 474L556 477L549 470L536 471L538 481L531 491L513 505L517 518L510 519L508 531L495 544L491 540L474 546L451 549L447 553L443 575L451 576L452 587L458 594L441 617L437 631Z',
  ARA: 'M781 362L774 372L754 374L737 360L722 357L716 376L712 378L695 374L694 379L675 384L673 361L660 354L652 342L633 345L623 337L608 341L599 351L588 358L584 365L594 375L601 394L591 409L596 419L594 443L578 456L571 474L577 486L577 499L591 499L598 493L606 478L624 487L641 474L649 485L662 485L668 496L678 523L690 527L703 521L711 526L720 529L733 523L751 531L755 537L767 531L762 510L764 499L775 488L789 479L802 479L793 468L815 459L827 458L842 447L844 436L834 429L833 419L823 413L823 404L834 397L822 382L824 370L816 361L793 367L791 378L785 383L777 377L787 366L781 362Z',
  PAC: 'M689 588L705 588L709 595L720 596L728 589L734 597L748 594L752 603L775 611L788 612L815 608L824 603L827 588L837 584L849 568L863 562L867 551L875 542L875 529L862 532L839 524L832 514L830 503L836 490L837 479L823 475L815 459L793 468L802 479L789 479L775 488L764 499L762 510L767 531L755 537L751 531L733 523L720 529L711 526L714 539L722 548L714 555L709 570L689 588Z',
  COR: 'M983 695L983 688L990 676L986 641L975 629L962 630L938 649L935 676L945 684L948 693L946 708L952 721L976 733L984 710L983 695Z',
};
/** Les cinq territoires d'outre-mer, dans le cartouche */
const OM_D: { name: string; d: string; x: number; y: number }[] = [
  { name: 'Guadeloupe', x: 64, y: 549, d: 'M77 532L76 532L77 537L81 538L86 535L86 532L84 529L79 528L77 532ZM42 508L44 511L44 515L45 523L46 527L49 530L49 532L56 530L60 526L60 521L58 514L58 511L61 511L60 507L57 508L56 505L49 503L47 501L44 502L43 504L42 508ZM62 512L67 513L74 511L81 509L83 508L82 505L78 503L73 503L71 500L72 496L71 493L66 490L62 494L62 499L64 500L65 502L62 503L61 507L62 512Z' },
  { name: 'Martinique', x: 156, y: 549, d: 'M147 515L149 518L156 518L157 524L153 523L149 524L150 527L152 532L156 530L160 530L162 531L167 532L168 536L172 538L175 534L176 530L175 525L170 518L166 509L163 505L163 503L156 497L155 495L152 494L147 491L144 490L138 492L136 496L137 500L141 504L140 507L143 513L147 515Z' },
  { name: 'Guyane', x: 64, y: 623, d: 'M59 566L54 564L52 564L51 567L46 573L46 575L46 579L47 586L49 590L52 592L51 596L49 599L49 602L47 607L45 608L45 610L47 611L50 612L51 611L55 609L58 610L60 609L65 611L70 609L71 606L72 603L74 599L74 597L76 596L79 591L83 586L83 585L82 582L81 579L78 578L74 575L66 568L61 567L59 566Z' },
  { name: 'La Réunion', x: 156, y: 623, d: 'M132 586L135 591L136 597L140 602L145 603L150 608L163 612L176 610L181 607L180 600L183 593L182 589L178 587L172 578L171 573L168 569L162 566L149 564L145 565L138 569L135 569L134 576L129 579L129 583L132 586Z' },
  { name: 'Mayotte', x: 64, y: 697, d: 'M58 657L59 660L58 665L65 672L66 675L63 677L59 675L58 671L55 672L56 675L59 676L57 681L59 684L62 684L66 686L70 681L68 679L72 671L75 669L75 667L73 666L72 663L73 658L78 654L78 651L76 648L73 646L70 647L67 645L66 647L63 647L62 642L59 639L57 638L51 643L50 649L55 652L58 652L58 657Z' },
];
const OM_BOX = [18, 481, 184, 222];
const FR_LAB: Record<string, [number, number]> = { IDF: [600, 193], CVL: [556, 293], BFC: [702, 311], NOR: [479, 174], HDF: [611, 101], GES: [750, 191], PDL: [439, 275], BRE: [308, 218], NAQ: [470, 453], OCC: [571, 572], ARA: [714, 444], PAC: [802, 554], COR: [964, 667] };
/** La circonscription : huit cantons (repère 800 × 775) */
const CT_D: Record<string, string> = {
  VAR: 'M118 255L116 250L107 228L109 232L115 238L127 232L134 228L146 231L163 222L171 205L181 200L187 191L182 170L182 152L183 143L181 128L188 114L197 109L204 99L218 85L225 85L225 86L230 77L227 75L225 82L233 77L239 71L252 73L267 83L281 81L304 70L315 70L324 73L324 72L324 79L318 93L313 91L314 101L310 114L314 132L306 130L306 144L299 154L302 160L302 154L302 164L299 173L285 174L274 182L254 201L248 222L240 229L244 253L243 273L244 291L244 293L242 313L242 328L235 329L221 324L206 322L196 313L192 303L181 301L165 297L167 292L166 294L149 291L148 285L153 284L140 278L130 267L129 263Z',
  BRY: 'M242 313L244 293L244 291L243 273L244 253L240 229L248 222L254 201L274 182L285 174L299 173L302 164L302 154L302 160L299 154L306 144L306 130L314 132L310 114L314 101L313 91L318 93L324 79L324 72L324 73L327 76L329 68L328 51L338 47L346 48L366 32L389 14L403 12L419 9L424 -7L437 -4L449 -5L457 2L458 14L460 20L470 31L475 34L462 35L464 40L466 45L469 60L467 75L457 81L463 102L466 128L468 144L464 156L460 158L473 166L478 185L481 193L483 203L488 223L506 244L509 269L511 281L512 281L517 293L509 304L501 308L490 304L479 301L452 309L434 301L425 293L416 281L413 284L396 278L383 265L377 260L361 260L345 268L316 259L293 264L286 273L274 287L267 291L253 295Z',
  TAN: 'M523 290L517 293L512 281L511 281L509 269L506 244L488 223L483 203L481 193L478 185L473 166L460 158L464 156L468 144L466 128L463 102L457 81L467 75L469 60L466 45L464 40L462 35L475 34L474 37L467 33L474 35L490 26L491 28L494 30L507 37L520 51L534 59L538 74L545 88L559 95L564 103L565 105L579 101L597 104L605 116L611 130L613 144L618 160L618 161L606 174L607 186L606 190L610 192L610 187L603 195L604 203L619 212L622 229L620 236L637 244L653 252L660 251L665 257L683 262L701 262L709 266L710 268L693 273L680 269L654 268L637 258L628 263L626 266L618 273L606 265L602 265L599 262L594 272L573 269L561 269L549 261L549 270L533 275L527 285L520 281L529 287Z',
  CTR: 'M284 456L272 449L272 444L267 434L270 439L261 427L254 409L247 389L248 377L253 368L252 345L250 335L240 327L242 328L242 313L253 295L267 291L274 287L286 273L293 264L316 259L345 268L361 260L377 260L383 265L396 278L413 284L416 281L425 293L434 301L452 309L479 301L490 304L501 308L509 304L517 293L523 290L525 310L513 311L502 320L491 334L481 356L478 359L466 373L462 385L450 395L453 386L455 395L465 399L472 401L471 399L470 419L461 431L465 443L463 454L471 481L443 473L431 469L420 458L415 455L395 460L386 462L384 472L372 471L356 474L340 481L340 484L322 496L309 495L299 489L301 481L295 466L283 466L287 460L286 459Z',
  GAR: 'M764 388L759 397L750 401L749 408L750 418L745 425L747 422L739 431L732 446L729 447L726 442L708 453L693 464L674 477L665 480L670 482L665 498L663 502L652 506L648 498L647 503L632 507L618 500L597 493L589 485L588 492L581 484L577 477L563 472L560 476L555 481L539 472L520 475L492 479L481 491L471 481L463 454L465 443L461 431L470 419L471 399L472 401L465 399L455 395L453 386L450 395L462 385L466 373L478 359L481 356L491 334L502 320L513 311L525 310L523 290L529 287L520 281L527 285L533 275L549 270L549 261L561 269L573 269L594 272L599 262L602 265L606 265L618 273L626 266L628 263L637 258L654 268L680 269L693 273L710 268L723 279L746 294L757 306L763 319L774 336L783 341L781 346L776 348L779 343L786 348L784 356L772 366Z',
  MTF: 'M97 621L97 602L97 590L107 580L109 581L115 566L105 560L98 551L89 555L84 541L83 524L81 508L82 496L76 484L77 456L71 441L79 429L82 420L88 402L91 391L87 395L86 380L76 369L75 358L79 355L84 339L91 322L90 305L91 292L106 297L115 293L119 291L121 281L116 276L123 276L124 262L118 255L129 263L130 267L140 278L153 284L148 285L149 291L166 294L167 292L165 297L181 301L192 303L196 313L206 322L221 324L235 329L242 328L240 327L250 335L252 345L253 368L248 377L247 389L254 409L261 427L270 439L267 434L272 444L272 449L284 456L274 449L260 455L248 459L232 452L214 458L206 467L205 464L201 473L197 489L195 493L186 504L169 525L156 534L148 545L138 567L132 576L133 583L132 601L121 608L109 608Z',
  PJB: 'M729 447L725 447L708 457L696 475L689 480L679 488L677 508L681 519L677 524L678 548L676 564L685 581L685 585L691 602L683 617L683 625L677 624L681 623L670 630L671 632L668 626L664 630L663 636L650 630L633 625L619 634L594 643L581 642L571 639L568 651L567 666L557 665L550 666L530 680L518 694L503 695L487 698L480 712L467 721L464 695L455 670L461 662L473 650L477 637L482 626L481 615L496 614L501 597L504 568L498 552L495 536L501 521L496 507L493 491L479 493L481 491L492 479L520 475L539 472L555 481L560 476L563 472L577 477L581 484L588 492L589 485L597 493L618 500L632 507L647 503L648 498L652 506L663 502L665 498L670 482L665 480L674 477L693 464L708 453L726 442Z',
  ARS: 'M467 721L466 722L456 717L451 716L436 713L438 710L433 704L419 698L407 685L397 683L397 678L377 688L363 685L350 677L346 681L352 684L348 689L346 687L333 679L335 670L337 667L320 658L303 653L301 656L289 653L263 661L248 660L232 667L228 669L213 685L196 689L186 697L179 690L179 689L160 679L145 680L136 675L126 673L115 668L92 658L83 657L81 649L67 655L59 654L59 646L76 640L85 635L94 625L97 621L109 608L121 608L132 601L133 583L132 576L138 567L148 545L156 534L169 525L186 504L195 493L197 489L201 473L205 464L206 467L214 458L232 452L248 459L260 455L274 449L284 456L286 459L287 460L283 466L295 466L301 481L299 489L309 495L322 496L340 484L340 481L356 474L372 471L384 472L386 462L395 460L415 455L420 458L431 469L443 473L471 481L481 491L479 493L493 491L496 507L501 521L495 536L498 552L504 568L501 597L496 614L481 615L482 626L477 637L473 650L461 662L455 670L464 695Z',
};
const CT_LAB: Record<string, [number, number]> = { VAR: [220, 191], BRY: [381, 168], TAN: [550, 183], CTR: [376, 376], GAR: [615, 384], MTF: [160, 406], PJB: [587, 566], ARS: [308, 581] };
const CT_TOWN: Record<string, [number, number]> = { VAR: [190, 150], BRY: [353, 180], TAN: [600, 150], CTR: [375, 360], GAR: [598, 394], MTF: [115, 357], PJB: [620, 582], ARS: [330, 606] };
/** La rivière qui traverse la circonscription */
const CT_RIVER = 'M352 8C360 80 330 130 352 200S420 300 405 350S470 450 520 480S600 520 640 600S700 700 760 762';

/** Pictogrammes des cartes de campagne (traits, repère 24 × 24) */
const ICON: Record<string, string> = {
  meeting: 'M12 3a2.6 2.6 0 0 1 2.6 2.6v4.2a2.6 2.6 0 0 1-5.2 0V5.6A2.6 2.6 0 0 1 12 3zM6.8 10a5.2 5.2 0 0 0 10.4 0M12 15.2V20M8.5 20.5h7',
  porte: 'M6 21V3.8h12V21M3.5 21h17M9 7h6v4.5H9zM9 14h6M14.6 16.6v.6',
  affiches: 'M5 3.5h14v13.5H5zM8 7.5h8M8 10.5h8M8 13.5h4.5M9.5 17l-1.5 4M14.5 17l1.5 4',
  usine: 'M3 21v-9.5l5 3v-3l5 3V7.5l3-1.5V21M18.5 21V4.5h2.3V21M2 21h20M6.5 17.5h2M11 17.5h2',
  marche: 'M4.2 9.2 6 4h12l1.8 5.2M4 9.5c0 1.5 1 2.2 2 2.2s2-.7 2-2.2c0 1.5 1 2.2 2 2.2s2-.7 2-2.2c0 1.5 1 2.2 2 2.2s2-.7 2-2.2c0 1.5 1 2.2 2 2.2s2-.7 2-2.2M5.5 11.7V21M18.5 11.7V21M3 21h18M9.5 21v-5h5v5',
  ralliement: 'M12 2.8a4.6 4.6 0 1 1 0 9.2a4.6 4.6 0 0 1 0-9.2zM12 5.6a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 0 1 0-3.6zM9.3 11.2 7.2 21l3-1.6 1.8 2M14.7 11.2 16.8 21l-3-1.6-1.8 2',
  spot: 'M2.8 6.5h18.4v12.3H2.8zM8 2.8l4 3.7 4-3.7M7 21.5h10M5.5 9.2h10.5v7H5.5zM18.6 10v.4M18.6 13v.4',
  radio: 'M3.5 9h17v11.5h-17zM6.5 9l11-5.5M10.6 14.8a2.6 2.6 0 1 1-5.2 0a2.6 2.6 0 0 1 5.2 0zM13.5 12.5h4.5M13.5 15h4.5M13.5 17.5h4.5',
  debat: 'M3 21v-8.5h6.2V21M14.8 21v-8.5H21V21M1.8 21h20.4M6.1 12.5V9.3M17.9 12.5V9.3M4.4 8.8h3.4M16.2 8.8h3.4M9.5 4.5h5M12 4.5v3',
  mobilisation: 'M5.2 3.5h13.6a1.3 1.3 0 0 1 1.3 1.3V17H3.9V4.8a1.3 1.3 0 0 1 1.3-1.3zM3.9 11h16.2M3.9 7h16.2M5 17v2.6h3V17M16 17v2.6h3V17M7 14h1M16 14h1',
  star: 'M12 2.8l2.8 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17l-5.7 3.1 1.2-6.3-4.6-4.4 6.3-.8z',
  gaffe: 'M3.5 4.5h17v11.5H10.5l-4.5 4v-4H3.5zM12 7.3v4.4M12 13.6v.6',
  dons: 'M2 6.5h20v11H2zM12 9.2a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 0 1 0-5.6zM5.2 9.6v4.8M18.8 9.6v4.8',
  sondage: 'M3.5 20.5h17M6 20.5V14M10 20.5V8M14 20.5v-9M18 20.5V4.5',
  tribune: 'M3.5 4.5H17v14.2a2.3 2.3 0 0 1-2.3 2.3H5.8a2.3 2.3 0 0 1-2.3-2.3zM17 8.5h3.5v10.2a2.3 2.3 0 0 1-2.3 2.3M6.5 8.5h7.5M6.5 11.5h7.5M6.5 14.5h7.5M6.5 17.5h4.5',
  scandale: 'M12 3 22 20.5H2zM12 9.5v5.2M12 17v.6',
};
const CLOCK = 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 7v5.2l3.4 2.1';

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
interface Pin { x: number; me: boolean }
interface TileView {
  id: string; short: string; lx: number; ly: number; anchor: string; hit: number[] | null; color: string; dark: boolean;
  pct: string; weight: string; gain: string; pins: Pin[]; alert: boolean; target: boolean; label: string; flash: string; hidden: boolean;
}
interface CardView { key: string; card: CardId; uid?: number; zone?: string; icon: string; name: string; cost: string; t: number; e: number; ok: boolean; event: boolean; urgent: boolean; expiring: boolean; left?: number }
interface Night { res: FinalResult; order: number[]; shown: number }
interface Shape { id: string; d: string }

const fmt = (x: number, d = 1) => x.toFixed(d).replace('.', ',').replace('-', '−');
/** Retire les pictogrammes (émojis) d'un texte : la carte et les fiches les dessinent */
const plain = (s: string) => s.replace(/\s?\(\p{Extended_Pictographic}️?\)/gu, '').replace(/\p{Extended_Pictographic}️?\s?/gu, '').trim();

/** Échelle divergente en classes, selon l'écart en points (bleu : vous, rouge : l'adversaire) */
const SCALE_ME = ['#dfe7f0', '#b2c8e1', '#6a98c8', '#2a62a1'];
const SCALE_THEM = ['#f3ddd3', '#eab19c', '#d6775e', '#ad3826'];
const LEAN_STEPS = [1, 3, 6];
function leanColor(s: number): { color: string; dark: boolean } {
  const d = (s - 0.5) * 100, a = Math.abs(d);
  const k = a < LEAN_STEPS[0] ? 0 : a < LEAN_STEPS[1] ? 1 : a < LEAN_STEPS[2] ? 2 : 3;
  return { color: (d >= 0 ? SCALE_ME : SCALE_THEM)[k], dark: k >= 2 };
}

let instances = 0;

@Component({
  selector: 'app-campagne-game',
  template: `
    @if (camp(); as c) {
    <div class="cg" [class.legis]="variant === 'legislatives'">
      <div class="head">
        <span class="wk"><small>Semaine</small><b class="mono">{{ Math.min(weekNo(), weeks) }}<i>/{{ weeks }}</i></b></span>
        <span class="res" [attr.aria-label]="'Temps : ' + c.time + ' sur ' + pips.length"><small>Temps</small>
          <span class="pips">@for (i of pips; track i) { <i class="pip" [class.on]="i < c.time"></i> }</span></span>
        <span class="res" [attr.aria-label]="'Fonds : ' + c.money + ' €'"><small>Fonds</small><b class="mono">{{ c.money }} €</b></span>
        <span class="poll" [class.up]="lastPoll() >= 50" [class.down]="lastPoll() < 50" [attr.aria-label]="'Sondage : ' + txt.me + ' ' + fmt(lastPoll()) + ' %'"><small>Sondage{{ txt.me !== 'Vous' ? ' · ' + txt.me : '' }}</small><b class="mono">{{ fmt(lastPoll()) }} %</b></span>
      </div>

      <div class="mapw">
        <div class="map" role="group" [attr.aria-label]="'Carte des ' + txt.zones">
          <svg [attr.viewBox]="vb" class="msvg" [class.aiming]="aiming()" [class.final]="!!night()">
            <defs>
              <pattern [attr.id]="uid + '-sea'" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 7H14" class="seal" /></pattern>
              <pattern [attr.id]="uid + '-hid'" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" class="hidb" /><path d="M0 0V12" class="hidl" /></pattern>
              @for (s of shapes; track s.id) { <path [attr.id]="uid + '-z' + s.id" [attr.d]="s.d" /> }
            </defs>
            <rect x="-20" y="-20" width="1100" height="900" class="sea" />
            <rect x="-20" y="-20" width="1100" height="900" [attr.fill]="'url(#' + uid + '-sea)'" />

            @if (!legis) {
              <rect class="ombox" [attr.x]="OM_BOX[0]" [attr.y]="OM_BOX[1]" [attr.width]="OM_BOX[2]" [attr.height]="OM_BOX[3]" />
              <text class="omt" [attr.x]="OM_BOX[0] + 10" [attr.y]="OM_BOX[1] - 10">Outre-mer</text>
            }
            <g class="shadow" aria-hidden="true">@for (s of shapes; track s.id) { <use [attr.href]="'#' + uid + '-z' + s.id" /> }</g>

            @for (t of tiles(); track t.id) {
              <g [class]="'tile ' + t.flash" [class.dark]="t.dark" [class.focus]="focus() === t.id" [class.aim]="aiming()" [class.hid]="t.hidden"
                 role="button" [attr.tabindex]="phase() === 'night' ? -1 : 0" [attr.aria-disabled]="phase() === 'night' ? 'true' : null" [attr.aria-label]="t.label"
                 (click)="tap(t.id)" (keydown.enter)="tap(t.id)" (keydown.space)="$event.preventDefault(); tap(t.id)">
                <use [attr.href]="'#' + uid + '-z' + t.id" class="shape" [style.fill]="t.hidden ? 'url(#' + uid + '-hid)' : t.color" />
                @if (t.hit; as h) {
                  @if (h.length === 3) { <circle class="hit" [attr.cx]="h[0]" [attr.cy]="h[1]" [attr.r]="h[2]" /> }
                  @else { <rect class="hit" [attr.x]="h[0]" [attr.y]="h[1]" [attr.width]="h[2]" [attr.height]="h[3]" /> }
                }
              </g>
            }

            @if (legis) {
              <g class="geo" aria-hidden="true">
                <path class="river" [attr.d]="RIVER" />
                @for (r of roads; track $index) { <path class="road" [attr.d]="r" /> }
                <circle class="urb" [attr.cx]="CT_TOWN['CTR'][0]" [attr.cy]="CT_TOWN['CTR'][1]" r="30" />
                @for (s of shapes; track s.id) { <rect class="town" [attr.x]="CT_TOWN[s.id][0] - 6" [attr.y]="CT_TOWN[s.id][1] - 6" width="12" height="12" /> }
              </g>
            } @else {
            }
            @if (focus(); as f) { <use [attr.href]="'#' + uid + '-z' + f" class="focusline" aria-hidden="true" /> }

            <g class="labels" aria-hidden="true">
              @for (t of tiles(); track t.id) {
                <g class="lab" [class.dk]="t.dark && !t.hidden" [attr.transform]="'translate(' + t.lx + ' ' + t.ly + ')'" [attr.text-anchor]="t.anchor">
                  <text class="code" y="-4">{{ t.short }}</text>
                  @if (t.gain) {
                    <g class="gain" transform="translate(0 16)"><rect x="-40" y="-19" width="80" height="32" rx="16" /><text y="5">{{ t.gain }}</text></g>
                  } @else { <text class="pct" y="27">{{ t.pct }}</text> }
                  @if (t.weight) { <text class="wt" y="47">{{ t.weight }}</text> }
                  @for (p of t.pins; track $index) {
                    <g class="pin" [class.me]="p.me" [attr.transform]="'translate(' + p.x + ' -32)'"><path d="M0 0V-12" /><circle cy="-18" r="10.5" class="ring" /><circle cy="-18" r="7.5" /><circle cx="-2.4" cy="-20.5" r="2.2" class="glint" /></g>
                  }
                  @if (t.alert || t.target) {
                    <g class="badge" [class.alert]="t.alert" [attr.transform]="'translate(' + (t.pins.length ? -18 - t.pins.length * 9 : 0) + ' ' + (t.pins.length ? -48 : -50) + ')'">
                      @if (t.alert) { <path d="M0 -17 17 13H-17z" /><path d="M0 -5V3M0 7.5V8.5" class="mark" /> }
                      @else { <circle r="13" /><circle r="5" /><path d="M0 -19V-8M0 8V19M-19 0H-8M8 0H19" class="mark" /> }
                    </g>
                  }
                </g>
              }
            </g>

            @if (legis) {
              <g class="cart" transform="translate(20 34)" aria-hidden="true"><text class="ct1">Circonscription</text><text class="ct2" y="24">8 cantons · {{ fmt(totalW, 0) }} k électeurs</text></g>
              <g class="scalebar" transform="translate(640 748)" aria-hidden="true"><path d="M0 0H100" /><path d="M0 -6V0M50 -4V0M100 -6V0" /><text x="50" y="-10">5 km</text></g>
            } @else {
              <g class="cart" transform="translate(22 40)" aria-hidden="true"><text class="ct1">France</text><text class="ct2" y="26">Intentions de vote</text><text class="ct2" y="50">par région</text></g>
              <g class="north" transform="translate(70 170)" aria-hidden="true"><path d="M0 -36 11 10 0 3-11 10z" /><text y="34">N</text></g>
              <g class="scalebar" transform="translate(22 730)" aria-hidden="true"><path d="M0 0H68" /><path d="M0 -6V0M34 -4V0M68 -6V0" /><text x="78" y="5" text-anchor="start">100 km</text></g>
            }
          </svg>
        </div>
        <div class="legend">
          <span class="scale" role="img" [attr.aria-label]="'Échelle : du rouge, ' + txt.them + ' en tête, au bleu, ' + txt.me + ' en tête'">
            <span class="end t">{{ txt.them }}</span>
            <span class="ramp">@for (c of ramp; track $index) { <i [style.background]="c"></i> }</span>
            <span class="end m">{{ txt.me }}</span>
          </span>
          <span class="ticks mono" aria-hidden="true"><i>+6</i><i>3</i><i>1</i><i>50</i><i>1</i><i>3</i><i>+6</i></span>
          <span class="keys"><span><svg viewBox="-12 -31 24 33" aria-hidden="true"><g class="pin me"><path d="M0 0V-12" /><circle cy="-18" r="10.5" class="ring" /><circle cy="-18" r="7.5" /></g></svg>vos coups</span>
            <span><svg viewBox="-12 -31 24 33" aria-hidden="true"><g class="pin"><path d="M0 0V-12" /><circle cy="-18" r="10.5" class="ring" /><circle cy="-18" r="7.5" /></g></svg>coups adverses</span>
            <span class="muted">écart en points</span></span>
        </div>
      </div>

      <div class="deck">
      @switch (phase()) {
        @case ('brief') {
          <div class="panel brief memo">
            <p class="memo-h"><span>Note de cadrage</span><span class="stamp">Confidentiel</span></p>
            <p><b>{{ def().title }}.</b> {{ txt.brief }} <b>Objectif :</b> {{ txt.goal }}</p>
            <ul>
              <li>Chaque semaine : {{ pips.length }} créneaux de temps (non reportables) et 3 € de fonds en plus (l’argent s’épargne).</li>
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
              <button type="button" class="gcard" [class.ev]="k.event" [class.urgent]="k.urgent" [class.on]="sel() === k.key" [disabled]="!k.ok"
                      (click)="pick(k.key)" [attr.aria-pressed]="sel() === k.key" [attr.aria-label]="k.name + ', ' + (k.cost || 'gratuit') + (k.expiring ? ', expire cette semaine' : '')">
                <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="k.icon" /></svg>
                <span class="nm">{{ k.name }}</span>
                <span class="cost mono">
                  @if (k.t) { <span class="ct"><svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="CLOCK" /></svg>{{ k.t }}</span> }
                  @if (k.e) { <span class="ce">{{ k.e }} €</span> }
                  @if (!k.t && !k.e) { <span>gratuit</span> }
                  @if (k.left !== undefined) { <span class="lf">×{{ k.left }}</span> }
                  @if (k.expiring) { <span class="xp">expire</span> }
                </span>
              </button>
            }
          </div>
          <div class="panel info" aria-live="polite">
            @if (selCard(); as k) {
              @let d = defOf(k.card);
              <p class="ih"><svg class="iic" viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="iconFor(k.card)" /></svg><b>{{ d.name }}</b></p>
              <p>{{ plain(d.desc) }}</p>
              @if (d.scope === 'zone') { <p class="muted small">Touchez une {{ txt.zone }} : le chiffre vert est le gain immédiat, en points, dans la {{ txt.zone }}.</p> }
              @else {
                <button type="button" class="btn primary small" (click)="launch()">
                  {{ d.scope === 'fixed' ? 'Contrer en ' + zoneName(k.zone) : d.scope === 'instant' ? 'Utiliser' : 'Lancer' }} ▸@if (d.scope === 'national' && natGain()) { <span class="mono"> ({{ natGain() }})</span> }
                </button>
              }
            } @else if (focusZone(); as z) {
              <p><b>{{ z.name }}</b> · {{ fmt(z.w, z.w < 1 ? 2 : 1) }} {{ txt.unit }} d’électeurs · @for (p of z.profiles; track $index) { <span class="tag">{{ profileLabel(p) }}</span> }</p>
              <p class="small">{{ txt.me }} <b class="mono">{{ fmt(zoneShare100(z)) }} %</b> · indécis {{ fmt(z.und * 100, 0) }} %
                · élan <span class="mono m">{{ fmt(z.pf + z.pd) }}</span> contre <span class="mono t">{{ fmt(z.af + z.ad) }}</span>
                @if (variant === 'referendum') { · participation <span class="mono m">{{ fmt(turn(z)[0] * 100, 0) }}</span>/<span class="mono t">{{ fmt(turn(z)[1] * 100, 0) }}</span> % }</p>
            } @else {
              <p class="muted small">{{ hint() }}</p>
            }
          </div>
          @if (pendingList().length) {
            <p class="queue"><span class="muted">Cette semaine :</span> @for (p of pendingList(); track $index) {
              <span class="qchip"><svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="p.icon" /></svg>{{ p.label }}</span> }</p>
          }
          <div class="actions">
            <button type="button" class="btn small" [disabled]="!pending().length" (click)="undo()" aria-label="Annuler le dernier coup">↶ Annuler</button>
            <button type="button" class="btn primary small" (click)="endWeek()">Fin de la semaine ▸</button>
          </div>
        }
        @case ('reveal') {
          @if (report(); as r) {
            <div class="panel reveal memo" aria-live="polite">
              <p class="memo-h"><span>Compte rendu · semaine {{ weekNo() - 1 }}</span><span class="mono">{{ fmt(r.poll) }} %</span></p>
              <p>Sondage : <b class="mono">{{ fmt(r.poll) }} %</b> pour {{ txt.me === 'Vous' ? 'vous' : 'le ' + txt.me }}</p>
              @if (r.debate) { <p [class.good]="r.debate === 'win'" [class.bad]="r.debate === 'loss'">{{ r.debate === 'win' ? 'Débat remporté : vous avez dominé l’échange.' : 'Débat perdu : ' + txt.rival + ' a pris l’ascendant.' }}</p> }
              @if (r.scandal) { <p class="bad">Le scandale n’a pas été contré en {{ r.scandal }} : il fait des dégâts.</p> }
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
              <p class="nh"><span class="live">{{ phase() === 'over' ? 'Résultats définitifs' : 'En direct · dépouillement' }}</span></p>
              <p class="nm2"><b>{{ phase() === 'over' ? message() : 'Soir du scrutin : dépouillement en cours…' }}</b></p>
              <div class="duel mono">
                <span class="me"><small>{{ txt.me }}</small><b>{{ fmt(tl.share) }} %</b></span>
                <span class="them"><small>{{ txt.them }}</small><b>{{ fmt(100 - tl.share) }} %</b></span>
              </div>
              <div class="tallybar" role="img" [attr.aria-label]="txt.me + ' ' + fmt(tl.share) + ' %'">
                <span class="me" [style.width.%]="tl.share"></span><i class="half"></i>
              </div>
              <p class="small mono">{{ n.shown }}/{{ n.order.length }} {{ txt.zones }} dépouillées
                @if (variant === 'referendum') { · participation {{ fmt(tl.turnout, 0) }} % }</p>
              @if (phase() === 'over') { <p class="small">{{ n.res.won }} {{ txt.zones }} sur {{ n.order.length }} gagnées · écart {{ fmt(Math.abs(n.res.margin) * 2) }} points.</p> }
            </div>
          }
        }
      }
      </div>

      <div class="foot">
        @let cv = curve();
        <figure class="chart">
          <figcaption><b>Sondages</b> · {{ txt.me === 'Vous' ? 'vos intentions de vote' : 'le ' + txt.me }}, en %</figcaption>
          <svg class="curve" viewBox="0 0 300 128" role="img" [attr.aria-label]="'Sondages : ' + curveLabel()">
            <defs>
              <clipPath [attr.id]="uid + '-up'"><rect x="0" y="0" width="300" [attr.height]="cv.mid" /></clipPath>
              <clipPath [attr.id]="uid + '-dn'"><rect x="0" [attr.y]="cv.mid" width="300" height="128" /></clipPath>
            </defs>
            @for (g of cv.grid; track g.l) { <line [attr.x1]="cv.x0" [attr.x2]="cv.x1" [attr.y1]="g.y" [attr.y2]="g.y" class="grid" /><text x="24" [attr.y]="g.y + 3.5" class="yl">{{ g.l }}</text> }
            @if (cv.band) { <path [attr.d]="cv.band" class="band" /> }
            @if (cv.area) {
              <path [attr.d]="cv.area" class="ar up" [attr.clip-path]="'url(#' + uid + '-up)'" />
              <path [attr.d]="cv.area" class="ar dn" [attr.clip-path]="'url(#' + uid + '-dn)'" />
            }
            <line [attr.x1]="cv.x0" [attr.x2]="cv.x1" [attr.y1]="cv.mid" [attr.y2]="cv.mid" class="fifty" />
            <text [attr.x]="cv.x1 + 3" [attr.y]="cv.mid + 3.5" class="lbl">50</text>
            <polyline [attr.points]="cv.points" class="line" />
            @for (p of cv.dots; track $index) { <circle [attr.cx]="p.x" [attr.cy]="p.y" r="2.6" [class.up]="p.v >= 50" /> }
            @for (w of cv.ticks; track $index) { <text [attr.x]="w.x" y="122" class="tk">{{ w.l }}</text> }
            @if (cv.dots.length > 1) { @let lp = cv.dots[cv.dots.length - 1]; <text [attr.x]="lp.x" [attr.y]="lp.y - 7" class="tk last">{{ fmt(lp.v) }}</text> }
          </svg>
          <p class="src">Sondages hebdomadaires · marge d’erreur ± 1,5 pt</p>
        </figure>
        <div class="logw">
          <p class="logh">Fil de campagne</p>
          <ul class="log">@for (l of log(); track $index) { <li>{{ l }}</li> }</ul>
        </div>
      </div>
    </div>
    }
  `,
  styles: `
    :host { display: block; width: 100%; container-type: inline-size;
      --cg-sea: #dde6ea; --cg-sea-line: #ccd8dd; --cg-border: #fdfcf8; --cg-coast: #55656e; --cg-shadow: rgba(36, 52, 64, .22);
      --cg-paper: #fbf8f1; --cg-paper-2: #f3eee2; --cg-paper-line: #e1d8c5; --cg-paper-ink: #22262e; --cg-paper-ink-2: #5d6170;
      --cg-board: #1d2631; --cg-board-2: #2a3542; --cg-board-ink: #edf1f5; --cg-board-ink-2: #a9b5c2;
      --cg-me: #2a62a1; --cg-them: #ad3826; --cg-me-ink: #2a62a1; --cg-them-ink: #ad3826; --cg-geo: #8a98a0; --cg-river: #8fb2c6; --cg-road: #fff; }
    @media (prefers-color-scheme: dark) {
      :host-context(html:not([data-theme="light"])) {
        --cg-sea: #142029; --cg-sea-line: #1a2933; --cg-border: #1b2027; --cg-coast: #8e9ba6; --cg-shadow: rgba(0, 0, 0, .55);
        --cg-paper: #20252e; --cg-paper-2: #262c36; --cg-paper-line: #353c48; --cg-paper-ink: #e9e6de; --cg-paper-ink-2: #aaa9a3;
        --cg-board: #0c1015; --cg-board-2: #1a212b; --cg-me-ink: #86b0e2; --cg-them-ink: #ef8e78; --cg-geo: #5c6870; --cg-river: #3d6178; --cg-road: #c9cdd2;
      }
    }
    :host-context(html[data-theme="dark"]) {
      --cg-sea: #142029; --cg-sea-line: #1a2933; --cg-border: #1b2027; --cg-coast: #8e9ba6; --cg-shadow: rgba(0, 0, 0, .55);
      --cg-paper: #20252e; --cg-paper-2: #262c36; --cg-paper-line: #353c48; --cg-paper-ink: #e9e6de; --cg-paper-ink-2: #aaa9a3;
      --cg-board: #0c1015; --cg-board-2: #1a212b; --cg-me-ink: #86b0e2; --cg-them-ink: #ef8e78; --cg-geo: #5c6870; --cg-river: #3d6178; --cg-road: #c9cdd2;
    }
    .cg { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr); grid-template-areas: 'head' 'map' 'deck' 'foot'; }
    .head { grid-area: head; display: flex; flex-wrap: wrap; gap: 4px 0; align-items: stretch; background: var(--cg-board); color: var(--cg-board-ink); border-radius: 6px; padding: 6px 4px;
      box-shadow: inset 0 -2px 0 rgba(0,0,0,.25);
      > span { flex: 1 1 0; min-width: 64px; display: grid; align-content: center; justify-items: center; gap: 1px; padding: 0 6px; border-left: 1px solid var(--cg-board-2); &:first-child { border-left: 0; } }
      small { font: 600 9.5px/1.1 var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--cg-board-ink-2); white-space: nowrap; }
      b { font-size: 15px; line-height: 1.15; white-space: nowrap; i { font-style: normal; font-size: 11px; color: var(--cg-board-ink-2); } } }
    .pips { display: inline-flex; gap: 4px; height: 19px; align-items: center; }
    .pip { display: inline-block; width: 9px; height: 13px; border-radius: 2px; border: 1.5px solid var(--cg-board-ink-2); &.on { background: #e8c25a; border-color: #e8c25a; } }
    .poll.up b { color: #8fbaf0; } .poll.down b { color: #f29a86; }
    .mapw { grid-area: map; display: grid; gap: 6px; min-width: 0; }
    .map { position: relative; width: 100%; max-width: 560px; justify-self: center; user-select: none; border-radius: 6px; overflow: hidden;
      box-shadow: 0 0 0 1px var(--line), 0 6px 20px -14px rgba(0,0,0,.45); }
    .msvg { display: block; width: 100%; height: auto; font-family: var(--font-body); }
    .sea { fill: var(--cg-sea); } .seal { stroke: var(--cg-sea-line); stroke-width: 1.3; }
    .shadow use { fill: var(--cg-shadow); transform: translate(4px, 6px); }
    .ombox { fill: none; stroke: var(--cg-coast); stroke-width: 1.5; }
    .omt { font: 600 21px var(--font-body); fill: var(--cg-coast); letter-spacing: .06em; text-transform: uppercase; paint-order: stroke; stroke: var(--cg-sea); stroke-width: 8px; }
    .omn text { font-size: 11px; fill: var(--cg-coast); text-anchor: middle; }
    .tile { cursor: pointer; outline: none;
      .shape { stroke: var(--cg-border); stroke-width: 2.4; stroke-linejoin: round; transition: fill .5s ease, filter .15s ease; }
      .hit { fill: transparent; stroke: none; }
      &.aim:hover .shape, &:focus-visible .shape { filter: brightness(1.08) saturate(1.1); stroke: #111a; stroke-width: 4; }
      &.up .shape { animation: glowUp 1.2s ease 2; } &.down .shape { animation: glowDown 1.2s ease 2; }
      &[aria-disabled='true'] { cursor: default; } }
    .aiming .tile { cursor: crosshair; }
    .hidb { fill: #b9b4a8; } .hidl { stroke: #a29d90; stroke-width: 5; }
    @keyframes glowUp { 50% { stroke: #5f9de6; stroke-width: 9; } }
    @keyframes glowDown { 50% { stroke: #ef7b66; stroke-width: 9; } }
    .focusline { fill: none; stroke: #121820; stroke-width: 6; pointer-events: none; filter: drop-shadow(0 0 2px #fff); }
    .geo { pointer-events: none;
      .river { fill: none; stroke: var(--cg-river); stroke-width: 7; stroke-linecap: round; opacity: .95; }
      .road { fill: none; stroke: var(--cg-road); stroke-width: 3; stroke-dasharray: 14 6; opacity: .85; }
      .urb { fill: rgba(60, 60, 60, .14); stroke: rgba(60,60,60,.35); stroke-width: 1.5; stroke-dasharray: 3 3; }
      .town { fill: #1f2328; stroke: #fff; stroke-width: 2; } }
    .labels { pointer-events: none; }
    .lab { --halo: rgba(255, 255, 255, .88); --lab: #1b2130;
      text { fill: var(--lab); paint-order: stroke; stroke: var(--halo); stroke-width: 6px; stroke-linejoin: round; }
      .code { font: 700 31px var(--font-body); letter-spacing: .01em; }
      .pct { font: 600 31px var(--font-mono); }
      .wt { font: 500 21px var(--font-body); }
      &.dk { --halo: rgba(14, 22, 34, .72); --lab: #fff; } }
    .final .lab .pct { font-size: 26px; letter-spacing: -.02em; }
    .legis .lab .code { font-size: 30px; } .legis .lab .pct { font-size: 30px; }
    .pin { path { stroke: #2b2f35; stroke-width: 2.6; } circle { fill: var(--cg-them); stroke: #1b2130; stroke-width: 1.4; } .ring { fill: #fff; stroke: rgba(0,0,0,.35); stroke-width: 1; }
      &.me circle { fill: var(--cg-me); } .glint { fill: rgba(255,255,255,.75); stroke: none; } }
    .badge { circle, path { fill: #fff; stroke: #b3261e; stroke-width: 3; } &.alert path { fill: #c62f22; stroke: #fff; } .mark { stroke-width: 3.6; stroke-linecap: round; fill: none; }
      &.alert .mark { stroke: #fff; } &:not(.alert) circle:last-of-type { fill: #b3261e; } &:not(.alert) .mark { stroke: #b3261e; } }
    .gain { rect { fill: #1f7a46; stroke: #fff; stroke-width: 2; } text { font: 700 24px var(--font-mono); fill: #fff; stroke: none; text-anchor: middle; } }
    .cart { pointer-events: none; .ct1 { font: 600 30px var(--font-display); fill: var(--cg-coast); letter-spacing: .02em; } .ct2 { font: 500 18px var(--font-body); fill: var(--cg-coast); letter-spacing: .08em; text-transform: uppercase; } }
    .north { path { fill: var(--cg-coast); } text { font: 700 18px var(--font-body); fill: var(--cg-coast); text-anchor: middle; } }
    .scalebar { path { stroke: var(--cg-coast); stroke-width: 3; fill: none; } text { font: 500 17px var(--font-body); fill: var(--cg-coast); text-anchor: middle; } }
    .legend { display: grid; gap: 3px; justify-items: center; font-size: 11px; color: var(--ink-2); }
    .scale { display: flex; align-items: center; gap: 6px; .end { font-weight: 600; font-size: 11.5px; &.t { color: var(--cg-them-ink); } &.m { color: var(--cg-me-ink); } } }
    .ramp { display: grid; grid-template-columns: repeat(8, 22px); height: 10px; border-radius: 2px; overflow: hidden; box-shadow: 0 0 0 1px var(--line); i { display: block; } }
    .ticks { display: grid; grid-template-columns: repeat(7, 22px); margin-left: 0; font-size: 9px; color: var(--ink-3); i { font-style: normal; text-align: center; } i:nth-child(4) { font-weight: 600; color: var(--ink-2); } }
    .keys { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 12px; span { display: inline-flex; align-items: center; gap: 3px; } svg { width: 11px; height: 17px; } }
    .deck { grid-area: deck; display: grid; gap: 8px; align-content: start; min-width: 0; }
    .panel { display: grid; gap: 6px; padding: 10px 12px; border-radius: 4px; background: var(--cg-paper); color: var(--cg-paper-ink); font-size: 13px;
      border: 1px solid var(--cg-paper-line); box-shadow: 0 1px 0 rgba(0,0,0,.04), 0 3px 10px -6px rgba(0,0,0,.25);
      p { margin: 0; } ul { margin: 0; padding-left: 18px; } }
    .memo { border-left: 3px solid var(--cg-paper-ink); }
    .memo-h { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-bottom: 4px; border-bottom: 2px solid var(--cg-paper-ink);
      font: 600 11px var(--font-mono); text-transform: uppercase; letter-spacing: .08em; }
    .stamp { color: #b3261e; border: 1.5px solid #b3261e; padding: 1px 6px; border-radius: 2px; transform: rotate(-3deg); font-weight: 700; }
    .brief li { font-size: 12.5px; color: var(--cg-paper-ink-2); margin: 2px 0; }
    .brief .btn, .reveal .btn { justify-self: end; min-height: 36px; }
    .hand { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
    .gcard { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-areas: 'i n' 'c c'; align-items: center; gap: 3px 6px; min-height: 56px; padding: 7px 7px 5px;
      border-radius: 3px; border: 1px solid var(--cg-paper-line); border-top: 3px solid #50606e; background: var(--cg-paper); color: var(--cg-paper-ink); cursor: pointer; font: inherit; text-align: left;
      box-shadow: 0 1px 2px rgba(0,0,0,.08);
      .ic { grid-area: i; width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; color: #3c4a58; }
      .nm { grid-area: n; font-size: 11.5px; font-weight: 600; line-height: 1.15; }
      .cost { grid-area: c; display: flex; flex-wrap: wrap; gap: 2px 7px; font-size: 10.5px; color: var(--cg-paper-ink-2); border-top: 1px dashed var(--cg-paper-line); padding-top: 3px; }
      .ct { display: inline-flex; align-items: center; gap: 2px; svg { width: 11px; height: 11px; fill: none; stroke: currentColor; stroke-width: 2.2; } }
      .xp { color: #b3261e; font-weight: 600; }
      &.ev { border-top-color: #c79a2b; background: linear-gradient(var(--cg-paper), var(--cg-paper)) padding-box; .ic { color: #8a6514; } }
      &.urgent { border-color: #b3261e; border-top-color: #b3261e; background: color-mix(in srgb, #b3261e 9%, var(--cg-paper)); .ic { color: #b3261e; } }
      &.on { outline: 2.5px solid var(--accent); outline-offset: 1px; transform: translateY(-2px); box-shadow: 0 6px 12px -6px rgba(0,0,0,.4); }
      &:disabled { opacity: .42; cursor: default; } }
    :host-context(html[data-theme="dark"]) .gcard .ic { color: #b9c4cf; }
    @media (prefers-color-scheme: dark) { :host-context(html:not([data-theme="light"])) .gcard .ic { color: #b9c4cf; } }
    .info { min-height: 50px; }
    .ih { display: flex; align-items: center; gap: 6px; font-size: 13.5px; }
    .iic { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
    .info .btn { justify-self: start; min-height: 34px; }
    .tag { display: inline-block; margin-right: 4px; font-size: 11px; padding: 0 6px; border-radius: 2px; border: 1px solid var(--cg-paper-line); text-transform: capitalize; }
    .m { color: var(--cg-me-ink); } .t { color: var(--cg-them-ink); }
    .queue { margin: 0; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: 11.5px; }
    .qchip { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px 2px 4px; border-radius: 2px; background: var(--cg-paper); border: 1px solid var(--cg-paper-line); color: var(--cg-paper-ink);
      svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; } }
    .actions { display: flex; gap: 8px; justify-content: flex-end; .btn { min-height: 38px; } }
    .reveal .ai { font-size: 12px; color: var(--cg-paper-ink-2); max-height: 120px; overflow: auto; }
    .good { color: var(--good); } .bad { color: var(--bad); }
    .nightp { background: var(--cg-board); color: var(--cg-board-ink); border-color: var(--cg-board-2); }
    .nh { display: flex; } .live { font: 700 10px var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: #fff; background: #c62f22; padding: 2px 7px; border-radius: 2px; }
    .nm2 { font-size: 14px; }
    .duel { display: flex; justify-content: space-between; span { display: grid; } small { font: 600 10px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--cg-board-ink-2); }
      b { font-size: 26px; line-height: 1.05; } .me b { color: #8fbaf0; } .them { text-align: right; b { color: #f29a86; } } }
    .tallybar { position: relative; height: 14px; border-radius: 2px; background: var(--cg-them); overflow: hidden;
      .me { display: block; height: 100%; background: var(--cg-me); transition: width .35s ease; }
      .half { position: absolute; left: 50%; top: 0; bottom: 0; width: 2px; background: #fff; } }
    .nightp .small { color: var(--cg-board-ink-2); }
    .foot { grid-area: foot; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 10px; align-items: start; }
    .chart { margin: 0; padding: 8px 8px 6px; background: var(--cg-paper); border: 1px solid var(--cg-paper-line); border-radius: 3px; color: var(--cg-paper-ink);
      figcaption { font-size: 11.5px; color: var(--cg-paper-ink-2); border-bottom: 1px solid var(--cg-paper-ink); padding-bottom: 3px; b { font-family: var(--font-display); font-size: 13px; color: var(--cg-paper-ink); } }
      .src { margin: 2px 0 0; font-size: 9.5px; color: var(--cg-paper-ink-2); font-style: italic; } }
    .curve { display: block; width: 100%; height: auto;
      .grid { stroke: var(--cg-paper-line); stroke-width: .8; } .yl { font: 9px var(--font-mono); fill: var(--cg-paper-ink-2); text-anchor: end; }
      .fifty { stroke: var(--cg-paper-ink); stroke-width: 1; stroke-dasharray: 3 2; } .line { fill: none; stroke: var(--cg-paper-ink); stroke-width: 1.8; stroke-linejoin: round; }
      .band { fill: var(--cg-paper-ink); opacity: .07; }
      .ar.up { fill: var(--cg-me); opacity: .28; } .ar.dn { fill: var(--cg-them); opacity: .28; }
      circle { fill: var(--cg-them); stroke: var(--cg-paper); stroke-width: 1.2; &.up { fill: var(--cg-me); } }
      .lbl, .tk { font: 9px var(--font-mono); fill: var(--cg-paper-ink-2); } .tk.last { fill: var(--cg-paper-ink); font-weight: 700; font-size: 10.5px; } .lbl { text-anchor: start; } .tk { text-anchor: middle; } }
    .logw { min-width: 0; }
    .logh { margin: 0 0 3px; font: 600 10px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; max-height: 150px; overflow: auto; font: 11px/1.3 var(--font-mono); color: var(--ink-2);
      li { padding-left: 8px; border-left: 2px solid var(--line); } li:first-child { color: var(--ink); border-left-color: var(--accent); } }
    .small { font-size: 12px; } .muted { color: var(--ink-3); }
    @container (max-width: 460px) { .foot { grid-template-columns: 1fr; } .ramp { grid-template-columns: repeat(8, 18px); } .ticks { grid-template-columns: repeat(7, 18px); } }
    @container (min-width: 720px) {
      .cg { grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); grid-template-areas: 'head head' 'map deck' 'foot foot'; align-items: start; column-gap: 14px; }
      .hand { grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); }
      .foot { grid-template-columns: minmax(0, 440px) minmax(0, 1fr); }
    }
    @media (prefers-reduced-motion: reduce) { .tile .shape, .tallybar .me { transition: none; } .tile.up .shape, .tile.down .shape { animation: none; } .gcard.on { transform: none; } }
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
  protected readonly plain = plain;
  protected readonly Math = Math;
  protected readonly CLOCK = CLOCK;
  protected readonly OM_D = OM_D;
  protected readonly OM_BOX = OM_BOX;
  protected readonly CT_TOWN = CT_TOWN;
  protected readonly RIVER = CT_RIVER;
  protected readonly ramp = [...[...SCALE_THEM].reverse(), ...SCALE_ME];
  protected readonly uid = 'cg' + ++instances;
  protected variant: Variant = 'presidentielle';
  protected txt: VariantText = TEXTS.presidentielle;
  protected legis = false;
  protected vb = '0 0 1000 745';
  protected shapes: Shape[] = [];
  protected roads: string[] = [];
  protected totalW = 0;
  private labs: Record<string, [number, number]> = {};

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
      const nm = Math.min(4, counts[z.id] ?? 0), nt = ph === 'night' || ph === 'over' ? 0 : Math.min(4, theirs[z.id] ?? 0);
      const pins: Pin[] = [];
      for (let k = 0; k < nm + nt; k++) pins.push({ x: (k - (nm + nt - 1) / 2) * 17, me: k < nm });
      const [lx, ly] = this.labs[z.id] ?? [z.x * 100, z.y * 100];
      return {
        id: z.id, short: z.short, lx, ly, anchor: z.id === 'COR' ? 'end' : 'middle', hit: z.id === 'COR' ? [968, 690, 48] : z.id === 'OM' ? [...OM_BOX] : null,
        color, dark: dark && !hidden, pct, gain, label, hidden, weight: c.variant === 'legislatives' ? `${fmt(z.w, 0)} k électeurs` : '', pins,
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
      out.push({ key: 'b:' + id, card: id, icon: this.iconFor(id), name: d.name, cost: this.costLabel(d), t: d.t, e: d.e, ok: playable(c, id, pend), event: false, urgent: false, expiring: false, left });
    }
    for (const h of c.hand) {
      const d = cardDef(h.card, this.variant);
      out.push({
        key: 'h:' + h.uid, card: h.card, uid: h.uid, zone: h.zone, icon: this.iconFor(h.card), name: h.card === 'scandale' ? 'Scandale : ' + this.zoneShort(h.zone) : d.name,
        cost: this.costLabel(d), t: d.t, e: d.e, ok: playable(c, h.card, pend, h.uid), event: true, urgent: h.card === 'scandale' && !pend.some(m => m.uid === h.uid), expiring: h.exp <= c.week,
      });
    }
    return out;
  });

  protected readonly pendingList = computed(() => this.pending().map(m => ({ icon: this.iconFor(m.card), label: m.zone ? this.zoneShort(m.zone) : 'national' })));

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
      const line = m.card === 'star' ? `Une personnalité s’affiche à ses côtés en ${this.zoneName(m.zone)}` : `${d.name}${m.zone ? ' · ' + this.zoneName(m.zone) : ' (partout)'}`;
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

  /** Le graphique des sondages, façon infographie de presse */
  protected readonly curve = computed(() => {
    const polls = this.camp()?.polls ?? [];
    const lo = Math.floor(Math.min(50, ...polls) - 1.5), hi = Math.ceil(Math.max(50, ...polls) + 1.5);
    const x0 = 30, x1 = 268, y0 = 8, y1 = 108;
    const y = (v: number) => y0 + (1 - (v - lo) / (hi - lo)) * (y1 - y0);
    const x = (i: number) => x0 + i * ((x1 - x0) / WEEKS);
    const dots = polls.map((v, i) => ({ x: x(i), y: y(v), v }));
    const mid = y(50);
    const step = hi - lo > 12 ? 4 : 2;
    const grid: { y: number; l: string }[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) if (v !== 50) grid.push({ y: y(v), l: String(v) });
    const pts = dots.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    const last = dots[dots.length - 1];
    const area = dots.length > 1 ? `M${dots[0].x.toFixed(1)},${mid.toFixed(1)}L${pts.join('L')}L${last.x.toFixed(1)},${mid.toFixed(1)}Z` : '';
    const moe = (y(0) - y(1.5));
    const band = dots.length > 1 ? `M${dots.map(p => `${p.x.toFixed(1)},${(p.y - moe).toFixed(1)}`).join('L')}L${[...dots].reverse().map(p => `${p.x.toFixed(1)},${(p.y + moe).toFixed(1)}`).join('L')}Z` : '';
    return {
      mid, dots, points: pts.join(' '), area, band, grid, x0, x1,
      ticks: Array.from({ length: WEEKS + 1 }, (_, i) => ({ x: x(i), l: i === 0 ? 'départ' : 'S' + i })).filter((_, i) => i % 2 === 0 || i === WEEKS),
    };
  });

  ngOnInit(): void {
    this.variant = variantOf(this.def().id);
    this.txt = TEXTS[this.variant];
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const c = newCampaign(this.variant, this.diff(), Math.floor(Math.random() * 2 ** 31));
    this.legis = this.variant === 'legislatives';
    if (this.legis) {
      this.vb = '0 0 800 775';
      this.shapes = c.zones.map(z => ({ id: z.id, d: CT_D[z.id] }));
      this.labs = CT_LAB;
      const [cx, cy] = CT_TOWN['CTR'];
      this.roads = c.zones.filter(z => z.id !== 'CTR').map(z => {
        const [x, y] = CT_TOWN[z.id];
        const mx = (cx + x) / 2 + (y - cy) * 0.12, my = (cy + y) / 2 - (x - cx) * 0.12;
        return `M${cx} ${cy}Q${mx.toFixed(0)} ${my.toFixed(0)} ${x} ${y}`;
      });
    } else {
      this.vb = '0 0 1000 745';
      this.shapes = c.zones.map(z => ({ id: z.id, d: z.id === 'OM' ? OM_D.map(o => o.d).join('') : FR_D[z.id] }));
      this.labs = { ...FR_LAB, NOR: [452, 178], HDF: [616, 92], IDF: [601, 202], GES: [772, 205], CVL: [552, 300], COR: [906, 676], OM: [OM_BOX[0] + OM_BOX[2] * 0.75, OM_BOX[1] + OM_BOX[3] - 44] };
    }
    this.totalW = c.zones.reduce((t, z) => t + z.w, 0);
    this.camp.set(c);
    this.say(`Premier sondage : ${this.txt.me} ${fmt(c.polls[0])} %. ${this.txt.Rival} part devant.`);
  }

  ngOnDestroy(): void { this.timers.forEach(t => clearTimeout(t)); }

  /* ── Libellés ── */

  protected defOf(id: CardId): CardDef { return cardDef(id, this.variant); }
  protected iconFor(id: CardId): string { return ICON[id === 'spot' && this.variant === 'legislatives' ? 'radio' : id] ?? ICON['star']; }
  protected profileLabel(p: Profile): string { return plain(PROFILE_LABEL[p]); }
  protected zoneShare100(z: Zone): number { return zoneResult(z, this.variant) * 100; }
  protected turn(z: Zone): [number, number] { return turnouts(z); }
  protected zoneName(id?: string): string { return this.camp()?.zones.find(z => z.id === id)?.name ?? ''; }
  private zoneShort(id?: string): string { return this.camp()?.zones.find(z => z.id === id)?.short ?? ''; }
  protected names(ids: string[]): string { return ids.map(id => this.zoneName(id)).join(', '); }
  private costLabel(d: CardDef): string { return [d.t ? `${d.t} temps` : '', d.e ? `${d.e} €` : ''].filter(Boolean).join(', '); }
  protected curveLabel(): string { return (this.camp()?.polls ?? []).map(p => fmt(p)).join(', '); }
  protected hint(): string {
    const c = this.camp();
    if (!c) return '';
    if (c.hand.some(h => h.card === 'scandale')) return 'Un scandale menace : contrez-le avant la fin de la semaine (fiche rouge).';
    if (c.week <= 3) return 'Début de campagne : le porte-à-porte et les ralliements tiendront jusqu’au scrutin. Gardez de l’argent pour la fin.';
    if (c.week >= WEEKS - 1) return 'Dernière ligne droite : meetings, affiches et visites frappent fort maintenant.';
    return 'Touchez une carte puis une ' + this.txt.zone + '. Touchez une ' + this.txt.zone + ' seule pour voir son détail.';
  }

  /* ── Jeu ── */

  protected begin(): void {
    this.phase.set('play');
    for (const h of this.camp()!.hand) this.say(`Carte en main : ${CARDS[h.card].name}.`);
    this.emitProgress();
  }

  protected pick(key: string): void {
    if (this.phase() !== 'play') return;
    this.sel.set(this.sel() === key ? null : key);
  }

  /** Une zone touchée sur la carte (souris, doigt ou clavier) */
  protected tap(id: string): void {
    if (this.phase() === 'night') return;
    this.tapZone(id);
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
    if (s.card === 'dons') this.say('Dîner de donateurs : +4 €.');
    if (s.card === 'sondage') this.say(`Le sondage révèle les cibles de ${this.txt.rival} (viseurs rouges) : ${[...new Set(c.aiPlan.map(m => this.zoneShort(m.zone)).filter(Boolean))].join(', ') || 'aucune'}.`);
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
    if (rep.debate) this.say(rep.debate === 'win' ? 'Débat gagné.' : 'Débat perdu.');
    if (rep.scandal) this.say(`Scandale non contré en ${rep.scandal}.`);
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

  private say(t: string): void { this.log.update(l => [plain(t), ...l].slice(0, 8)); }
}

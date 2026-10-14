import { ActionDefinition, CircoKind, Domain, EconomyState, Effect, EffectContext, ElectionType, ElectoralMap, ElectorateState, GameState, Segment } from '../models/game.models';
import { SEGMENTS } from '../data/programme';
import { BASE_SEATS } from '../data/bills';
import { governingIds } from './assembly';
import { pushNews } from './effects';
import { addMilestone } from './life';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Le pays : une économie qui vit (chômage, croissance, déficit,
 *  dette, inflation, confiance, note des agences), un électorat
 *  découpé en catégories (jeunes, retraités, classes populaires,
 *  cadres, ruraux) et une carte électorale par région, avec
 *  votre circonscription : bastion, disputée ou terre de mission.
 * ============================================================ */

const r1 = (n: number) => Math.round(n * 10) / 10;
const fr = (n: number, digits = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/* ── Économie ──────────────────────────────────────────────── */

export const RATINGS = ['AAA', 'AA+', 'AA', 'AA−', 'A+', 'A', 'A−', 'BBB+', 'BBB'];
const AGENCIES = ['Atlas Notation', 'Quantis Ratings', 'Morvan & Partners'];

export function initEconomy(d: GameState): EconomyState {
  return { unemployment: 7.4, growth: 1.1, deficit: 5.2, debt: 112, inflation: 2.1, confidence: 50, rating: 2, nextReview: d.week + 6, history: [] };
}

export function economy(d: GameState): EconomyState {
  return (d.economy ??= initEconomy(d));
}

/**
 * Êtes-vous comptable de l'économie ? 1 à l'Élysée ou à Matignon,
 * moins pour un·e ministre ou un·e député·e de la majorité ;
 * −1 dans l'opposition (une économie en berne vous profite).
 */
export function accountability(d: GameState): number {
  const r = d.player.rankId;
  if (d.presidency || r === 'premier_ministre') return d.presidency?.cohabitation ? 0.5 : 1;
  if (r === 'ministre') return d.portfolio === 'economie' ? 0.7 : 0.4;
  if (governingIds(d).includes(d.party.id)) return 0.15;
  return -1;
}

/** Freins à la croissance : les crises en cours */
function crisisDrag(d: GameState): number {
  const c = d.crises ?? {};
  const drag: Partial<Record<string, number>> = { krach: 2, blackout: 0.8, crue: 0.5, secheresse: 0.5, megafeux: 0.2, agriculteurs: 0.2, cyber: 0.3, frelons: 0.1, ia: 0.3, autonomie: 0.2, grand_hiver: 1.2, mars: -0.1, greve_generale: 1 };
  let total = Object.keys(c).filter(k => c[k as keyof typeof c]).reduce((t, k) => t + (drag[k] ?? 0), 0);
  if (d.zombie) total += 3;
  if (d.war) total += d.war.total ? 2 : 1;
  return total;
}

/** Santé économique (≈ 0 en temps normal, positive quand tout va bien) */
export function economicHealth(e: EconomyState): number {
  return (8 - e.unemployment) * 1.2 + (e.growth - 1) * 1.5 + (2.5 - e.inflation) * 0.5 + (e.confidence - 50) / 10;
}

/** Effet de l'économie sur vos scores électoraux */
export function econBonus(d: GameState, type: ElectionType): number {
  if (type === 'municipales' || type === 'primaire' || !d.economy) return 0;
  const health = economicHealth(d.economy);
  const acc = accountability(d);
  return acc > 0 ? clamp(health * acc, -8, 8) : clamp(-health * 0.4, -4, 4);
}

export function monthlyEconomy(d: GameState, rng: Rng): void {
  const e = economy(d);
  const prevU = e.unemployment;
  const target = 1.2 + (e.confidence - 50) / 25 - crisisDrag(d) - (d.intl.tension > 70 ? 0.3 : 0);
  e.growth = clamp(e.growth + (target - e.growth) * 0.15 + rng.range(-0.12, 0.12), -6, 5);
  // Loi d'Okun, avec un retour lent vers le chômage « naturel » (7,5 %)
  e.unemployment = clamp(e.unemployment + (1.3 - e.growth) * 0.035 + (7.5 - e.unemployment) * 0.015 + rng.range(-0.03, 0.03), 4, 16);
  // Sans budget voté par vous, les gouvernements successifs réduisent peu à peu le déficit quand la dette enfle
  const voted = d.nationalBudget?.history.at(-1)?.deficitPct ?? clamp(4.6 - (e.debt - 105) / 25, 2, 6);
  const targetDef = voted + (1.2 - e.growth) * 0.4 + (d.war ? 1 : 0) + (d.zombie ? 1.5 : 0);
  e.deficit = clamp(e.deficit + (targetDef - e.deficit) * 0.1 + rng.range(-0.03, 0.03), -1, 15);
  e.debt = clamp(e.debt + (e.deficit - ((e.growth + e.inflation) / 100) * e.debt) / 12, 40, 250);
  const shock = (d.crises?.secheresse ? 0.05 : 0) + (d.crises?.blackout ? 0.04 : 0) + (d.war ? 0.05 : 0) - (d.crises?.krach ? 0.05 : 0);
  e.inflation = clamp(e.inflation + (2 - e.inflation) * 0.06 + shock + rng.range(-0.08, 0.08), -1, 12);
  e.confidence = clamp(e.confidence + (50 - e.confidence) * 0.08 + (e.growth - 1) * 0.6 - (e.unemployment - prevU) * 8 + rng.range(-1.5, 1.5));
  e.history.push({ week: d.week, unemployment: r1(e.unemployment), growth: r1(e.growth), deficit: r1(e.deficit), debt: Math.round(e.debt), inflation: r1(e.inflation) });
  if (e.history.length > 36) e.history.splice(0, e.history.length - 36);

  // Seuils symboliques du chômage
  if (prevU >= 6 && e.unemployment < 6) pushNews(d, 'actu', 'positive', 'Le chômage passe sous les 6 %', 'Une première depuis des décennies. Le gouvernement s’en félicite.');
  if (prevU < 10 && e.unemployment >= 10) pushNews(d, 'actu', 'negative', 'Le chômage franchit la barre des 10 %', 'Les plans sociaux se multiplient. L’exécutif est sur la sellette.');

  // Une économie dont vous êtes comptable pèse sur votre cote… et sur chaque électorat
  const acc = accountability(d);
  if (acc > 0) {
    const du = e.unemployment - prevU;
    const mood = (e.growth - 1) * 0.25 - du * 3 - Math.max(0, e.inflation - 3) * 0.15;
    d.player.stats.popularity = clamp(d.player.stats.popularity + mood * acc);
    const off = electorate(d).offsets;
    off.populaires = clamp(off.populaires - du * 6 * acc, -30, 30);
    off.jeunes = clamp(off.jeunes - du * 4 * acc, -30, 30);
    off.retraites = clamp(off.retraites - Math.max(0, e.inflation - 3) * 0.2 * acc, -30, 30);
    off.cadres = clamp(off.cadres + (e.growth - 1) * 0.15 * acc, -30, 30);
  }

  if (d.week >= e.nextReview) {
    e.nextReview = d.week + 6;
    review(d, e, rng);
  }
}

/** Les agences de notation passent tous les six mois */
function review(d: GameState, e: EconomyState, rng: Rng): void {
  const agency = rng.pick(AGENCIES);
  const debtUp = e.history.length > 6 && e.debt > e.history[e.history.length - 7].debt;
  let delta = 0;
  if (e.deficit > 6 || (e.debt > 125 && e.deficit > 4.5) || e.growth < -1) delta = 1;
  else if (e.rating > 0 && ((e.deficit < 3 && e.growth > 1 && !debtUp) || (e.deficit < 4 && e.debt < 100 && e.growth > 0.5))) delta = -1;
  if (!delta) {
    if (rng.chance(0.4)) pushNews(d, 'actu', 'neutral', `${agency} maintient la note de la France (${RATINGS[e.rating]})`, 'Perspective stable. Bercy respire.');
    return;
  }
  e.rating = clamp(e.rating + delta, 0, RATINGS.length - 1);
  const acc = Math.max(0, accountability(d));
  const s = d.player.stats;
  if (delta > 0) {
    e.confidence = clamp(e.confidence - 6);
    s.credibility = clamp(s.credibility - 3 * acc);
    s.popularity = clamp(s.popularity - 2 * acc);
    if (d.presidency) d.presidency.approval = clamp(d.presidency.approval - 3);
    if (d.nationalBudget) d.nationalBudget.debtPenalty += 1;
    pushNews(d, 'actu', 'negative', `${agency} dégrade la note de la France à ${RATINGS[e.rating]}`,
      `Déficit de ${fr(e.deficit)} %, dette de ${Math.round(e.debt)} % du PIB : l’agence s’inquiète. Emprunter coûtera plus cher.`);
    if (acc >= 1) addMilestone(d, 'revers', `La France dégradée à ${RATINGS[e.rating]}`, `${agency} sanctionne la dérive des comptes publics sous votre autorité.`);
  } else {
    e.confidence = clamp(e.confidence + 5);
    s.credibility = clamp(s.credibility + 3 * acc);
    pushNews(d, 'actu', 'positive', `${agency} relève la note de la France à ${RATINGS[e.rating]}`, 'Les comptes se redressent : un satisfecit rare.');
  }
}

export function adjustEconomy(d: GameState, x: Extract<Effect, { kind: 'economy' }>): string[] {
  const e = economy(d);
  const out: string[] = [];
  const pt = (label: string, v: number) => out.push(`${label} ${v > 0 ? '+' : '−'}${fr(Math.abs(v))} pt`);
  if (x.growth) { e.growth = clamp(e.growth + x.growth, -6, 5); pt('Croissance', x.growth); }
  if (x.unemployment) { e.unemployment = clamp(e.unemployment + x.unemployment, 4, 16); pt('Chômage', x.unemployment); }
  if (x.deficit) { e.deficit = clamp(e.deficit + x.deficit, -1, 15); pt('Déficit', x.deficit); }
  if (x.inflation) { e.inflation = clamp(e.inflation + x.inflation, -1, 12); pt('Inflation', x.inflation); }
  if (x.confidence) { e.confidence = clamp(e.confidence + x.confidence); out.push(`Confiance ${x.confidence > 0 ? '+' : ''}${x.confidence}`); }
  return out;
}

/* ── Électorat par catégories ──────────────────────────────── */

export function initElectorate(d: GameState): ElectorateState {
  const lean = clamp(d.party.position / 100, -1, 1);
  return { offsets: { jeunes: Math.round(-4 * lean), retraites: Math.round(4 * lean), populaires: Math.round(-4 * lean), cadres: Math.round(3 * lean), ruraux: Math.round(2 * lean) } };
}

export function electorate(d: GameState): ElectorateState {
  return (d.electorate ??= initElectorate(d));
}

export interface SegmentRow { id: Segment; label: string; weight: number; approval: number; offset: number }

/** Votre cote dans chaque électorat */
export function segmentRows(d: GameState): SegmentRow[] {
  const off = electorate(d).offsets;
  return SEGMENTS.map(s => ({ ...s, offset: r1(off[s.id]), approval: Math.round(clamp(d.player.stats.popularity + off[s.id])) }));
}

export function adjustSegment(d: GameState, x: Extract<Effect, { kind: 'segment' }>): string[] {
  const off = electorate(d).offsets;
  const ids = x.segment === '*' ? SEGMENTS.map(s => s.id) : [x.segment];
  for (const id of ids) off[id] = clamp(off[id] + x.delta, -30, 30);
  const label = x.segment === '*' ? 'Tous les électorats' : SEGMENTS.find(s => s.id === x.segment)!.label;
  return [`${label} ${x.delta > 0 ? '+' : ''}${x.delta}`];
}

/** Chaque mois : les écarts s'estompent doucement */
export function monthlyElectorate(d: GameState): void {
  const off = electorate(d).offsets;
  for (const k of Object.keys(off) as Segment[]) off[k] = r1(off[k] * 0.92);
}

/** Poids des électorats selon le scrutin (les ruraux pèsent plus dans une circonscription rurale) */
function weights(d: GameState, type: ElectionType): Record<Segment, number> {
  const w = Object.fromEntries(SEGMENTS.map(s => [s.id, s.weight])) as Record<Segment, number>;
  if (type === 'legislatives' || type === 'municipales') {
    const region = MAP_REGIONS.find(r => r.id === d.territory?.region);
    if (region) w.ruraux *= 0.5 + region.rural * 2;
  }
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(w) as Segment[]) w[k] /= total;
  return w;
}

/** Bonus électoral tiré des électorats (−7 … +7) */
export function segmentBonus(d: GameState, type: ElectionType): number {
  if (type === 'primaire' || !d.electorate) return 0;
  const w = weights(d, type);
  const off = d.electorate.offsets;
  return clamp((Object.keys(w) as Segment[]).reduce((t, k) => t + w[k] * off[k], 0) * 0.3, -7, 7);
}

const CATEGORY_SEGMENTS: Partial<Record<string, Partial<Record<Segment, number>>>> = {
  terrain: { ruraux: 0.6, populaires: 0.4, retraites: 0.2 },
  territoire: { ruraux: 0.6, retraites: 0.2 },
  medias: { jeunes: 0.3, cadres: 0.3 },
  reseau: { cadres: 0.5 },
  dossiers: { cadres: 0.3 },
  international: { cadres: 0.3, populaires: -0.2 },
  argent: { cadres: 0.2, populaires: -0.2 },
};
export const DOMAIN_SEGMENTS: Record<Domain, Partial<Record<Segment, number>>> = {
  economie: { cadres: 0.8, populaires: -0.2 },
  social: { populaires: 0.8, cadres: -0.3 },
  ecologie: { jeunes: 0.8, ruraux: -0.4 },
  securite: { retraites: 0.7, jeunes: -0.3 },
  justice: { retraites: 0.3 },
  education: { jeunes: 0.7 },
  sante: { retraites: 0.7 },
  numerique: { jeunes: 0.6, cadres: 0.3 },
  territoires: { ruraux: 0.8 },
  diplomatie: { cadres: 0.3 },
};

/** Chaque action plaît à certains électorats (et en agace d'autres), discrètement */
export function actionSegments(d: GameState, action: ActionDefinition, ctx: EffectContext): void {
  const off = electorate(d).offsets;
  const add = (m?: Partial<Record<Segment, number>>, k = 1) => {
    for (const [s, v] of Object.entries(m ?? {}) as [Segment, number][]) off[s] = clamp(off[s] + v * k, -30, 30);
  };
  add(CATEGORY_SEGMENTS[action.category], 0.6);
  const domains = new Set<Domain>();
  if (ctx.domain) domains.add(ctx.domain);
  for (const e of action.effects) if (e.kind === 'dossier' && e.domain !== '$domain') domains.add(e.domain);
  for (const dom of domains) add(DOMAIN_SEGMENTS[dom], 0.5);
}

/* ── Carte électorale ──────────────────────────────────────── */

export interface MapRegion { id: string; name: string; short: string; x: number; y: number; lean: number; rural: number; towns: string[] }

/** Régions en tuiles, placées à peu près comme sur la carte */
export const MAP_REGIONS: MapRegion[] = [
  { id: 'HDF', name: 'Hauts-de-France', short: 'HdF', x: 2, y: 0, lean: 8, rural: 0.35, towns: ['Saint-Omer', 'Cambrai'] },
  { id: 'NOR', name: 'Normandie', short: 'Nor', x: 1, y: 0.9, lean: 5, rural: 0.5, towns: ['Évreux', 'Lisieux'] },
  { id: 'IDF', name: 'Île-de-France', short: 'IdF', x: 2, y: 1, lean: -10, rural: 0.05, towns: ['Montreuil', 'Versailles'] },
  { id: 'GES', name: 'Grand Est', short: 'GE', x: 3, y: 0.9, lean: 15, rural: 0.4, towns: ['Épinal', 'Colmar'] },
  { id: 'BRE', name: 'Bretagne', short: 'Bre', x: 0, y: 1.9, lean: -15, rural: 0.5, towns: ['Quimper', 'Lannion'] },
  { id: 'PDL', name: 'Pays de la Loire', short: 'PdL', x: 1, y: 2, lean: -2, rural: 0.45, towns: ['Laval', 'Cholet'] },
  { id: 'CVL', name: 'Centre-Val de Loire', short: 'CVL', x: 2, y: 2.05, lean: 8, rural: 0.55, towns: ['Vierzon', 'Chartres'] },
  { id: 'BFC', name: 'Bourgogne-Franche-Comté', short: 'BFC', x: 3, y: 2, lean: 6, rural: 0.6, towns: ['Dole', 'Mâcon'] },
  { id: 'NAQ', name: 'Nouvelle-Aquitaine', short: 'NA', x: 1, y: 3.1, lean: -6, rural: 0.5, towns: ['Périgueux', 'Niort'] },
  { id: 'OCC', name: 'Occitanie', short: 'Occ', x: 2, y: 3.4, lean: -8, rural: 0.45, towns: ['Albi', 'Narbonne'] },
  { id: 'ARA', name: 'Auvergne-Rhône-Alpes', short: 'ARA', x: 3, y: 3.1, lean: 5, rural: 0.4, towns: ['Annecy', 'Aurillac'] },
  { id: 'PAC', name: 'Provence-Alpes-Côte d’Azur', short: 'PACA', x: 3.4, y: 4.2, lean: 25, rural: 0.25, towns: ['Fréjus', 'Gap'] },
  { id: 'COR', name: 'Corse', short: 'Cor', x: 4.5, y: 4.6, lean: 10, rural: 0.5, towns: ['Bastia', 'Corte'] },
  { id: 'OM', name: 'Outre-mer', short: 'OM', x: 0, y: 4.4, lean: -10, rural: 0.4, towns: ['Pointe-à-Pitre', 'Saint-Pierre'] },
];

function hash(t: string): number { let h = 7; for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h; }

function partyStrength(d: GameState, id: string): number {
  const base = BASE_SEATS[id] ?? (id === d.party.id && d.party.founder ? 6 + d.player.stats.popularity * 0.5 : 18);
  return id === d.party.id ? base * (0.75 + d.player.stats.popularity / 200) : base;
}

/** Parts régionales estimées (somme 100) ; `noise` pour un vrai scrutin */
export function regionShares(d: GameState, rng?: Rng): Record<string, Record<string, number>> {
  const parties = [d.party, ...d.otherParties];
  const out: Record<string, Record<string, number>> = {};
  for (const r of MAP_REGIONS) {
    const raw = parties.map(p => {
      const tilt = clamp(Math.sign(p.position) * Math.min(1, Math.abs(p.position) / 50) * r.lean / 40, -0.5, 0.5);
      const local = (hash(r.id + p.id) % 21 - 10) / 100;
      const home = p.id === d.party.id && d.territory?.region === r.id ? 1 + (d.territory.attachment ?? 0) / 250 : 1;
      const noise = rng ? rng.range(0.9, 1.1) : 1;
      return Math.max(0.5, partyStrength(d, p.id) * (1 + tilt + local) * home * noise);
    });
    const total = raw.reduce((a, b) => a + b, 0);
    out[r.id] = Object.fromEntries(parties.map((p, i) => [p.id, r1((raw[i] / total) * 100)]));
  }
  return out;
}

function toMap(d: GameState, label: string, shares: Record<string, Record<string, number>>): ElectoralMap {
  const regions: ElectoralMap['regions'] = {};
  for (const [id, s] of Object.entries(shares)) {
    const [partyId, share] = Object.entries(s).sort((a, b) => b[1] - a[1])[0];
    regions[id] = { partyId, share };
  }
  return { label, week: d.week, regions };
}

/** La carte des intentions de vote du moment */
export function liveMap(d: GameState): ElectoralMap {
  return toMap(d, 'Intentions de vote (estimation)', regionShares(d));
}

/** Soir d'élection : la carte se colore */
export function recordMap(d: GameState, label: string, rng: Rng): void {
  d.electoralMap = toMap(d, label, regionShares(d, rng));
}

/* ── Votre circonscription ─────────────────────────────────── */

export const CIRCO_LABELS: Record<CircoKind, string> = { bastion: 'Bastion', disputee: 'Circonscription disputée', mission: 'Terre de mission' };
export const CIRCO_HINTS: Record<CircoKind, string> = {
  bastion: 'Votre parti y gagne presque toujours : +6 aux législatives, mais la victoire ne vous grandit pas.',
  disputee: 'Tout se joue à quelques centaines de voix.',
  mission: 'Votre parti n’y gagne jamais : −6 aux législatives, mais une victoire serait un exploit.',
};

/** Le classement des régions pour votre parti, du plus favorable au moins favorable */
function regionsForParty(d: GameState): string[] {
  const shares = regionShares(d);
  return MAP_REGIONS.filter(r => r.id !== 'OM').map(r => r.id).sort((a, b) => shares[b][d.party.id] - shares[a][d.party.id]);
}

/** Donne une région à une circonscription d'ancienne sauvegarde */
export function ensureCirco(d: GameState): void {
  const t = d.territory;
  if (!t || t.region) return;
  const list = regionsForParty(d).filter(id => id !== 'COR');
  t.region = list[Math.floor(list.length / 2)];
  t.kind ??= 'disputee';
}

export function circoBonus(d: GameState, type: ElectionType): number {
  const k = d.territory?.kind;
  if (!k || k === 'disputee') return 0;
  const v = k === 'bastion' ? 6 : -6;
  return type === 'legislatives' ? v : type === 'municipales' ? v / 2 : 0;
}

/** Changer de circonscription : un parachutage */
export function moveCirco(d: GameState, kind: CircoKind, rng: Rng): string[] {
  const t = d.territory;
  if (!t) return [];
  const list = regionsForParty(d).filter(id => id !== t.region);
  const region = kind === 'bastion' ? list[0] : kind === 'mission' ? list[list.length - 1] : list[Math.floor(list.length / 2)];
  const def = MAP_REGIONS.find(r => r.id === region)!;
  const town = rng.pick(def.towns);
  t.region = region;
  t.kind = kind;
  t.name = `Circonscription ${/^[AEIOUÉÈÊaeiouéèê]/.test(town) ? 'd’' : 'de '}${town}`;
  t.attachment = 12;
  t.projects = t.projects.filter(p => p.finished);
  pushNews(d, 'actu', 'neutral', `Parachuté·e à ${town}`, `${CIRCO_LABELS[kind]} en ${def.name}. Les militants locaux vous attendent… pas tous avec des fleurs.`);
  return [`Nouvelle circonscription : ${town} (${def.name})`, CIRCO_LABELS[kind]];
}

/** Soir d'élection dans la circonscription */
export function circoResult(d: GameState, type: ElectionType, won: boolean): void {
  const t = d.territory;
  if (type !== 'legislatives' || !t?.kind) return;
  if (won && t.kind === 'mission') {
    d.player.stats.influence = clamp(d.player.stats.influence + 6);
    d.player.stats.popularity = clamp(d.player.stats.popularity + 3);
    addMilestone(d, 'victoire', `L’exploit de ${t.name.replace(/^Circonscription (de |d’)/, '')}`, 'Votre parti n’y avait jamais gagné. Vous, si. Les instituts de sondage n’en reviennent pas.');
    t.kind = 'disputee';
  } else if (!won && t.kind === 'bastion') {
    d.player.stats.credibility = clamp(d.player.stats.credibility - 4);
    pushNews(d, 'election', 'negative', 'Battu·e dans un bastion', 'Perdre une circonscription imperdable : vos camarades ne vous le pardonneront pas de sitôt.');
  }
}

import { DOMAIN_LABELS, Domain, Effect, GameState, Segment } from '../models/game.models';
import { applyEffects, pushNews } from './effects';
import { Rng, clamp } from './rng';
import { activeCrises, CRISES } from './crises';
import { electorate } from './country';

/* ============================================================
 *  Les réseaux sociaux, version 2 : une audience qui grandit
 *  (abonnés), des tendances chaque mois (#hashtags) sur lesquelles
 *  surfer, des publications qui peuvent devenir virales, un live
 *  mensuel, et des paliers d'abonnés qui rapportent gros. Chaque
 *  mois, l'audience rapporte de la popularité et touche les jeunes.
 * ============================================================ */

export interface Trend { tag: string; domain?: Domain; segment?: Segment; hot: number }
export interface MyPost { id: string; week: number; text: string; likes: number; shares: number; viral: boolean; tag?: string }

export interface SocialStats {
  followers: number;
  /** Tendances du mois */
  trendsWeek: number;
  trends: Trend[];
  /** Vos dernières publications */
  posts: MyPost[];
  /** Live fait ce mois-ci */
  liveWeek?: number;
  /** Paliers atteints */
  milestones: number[];
}

export const MILESTONES = [1000, 10000, 50000, 100000, 500000, 1000000];

const DOMAIN_TAGS: Record<Domain, string[]> = {
  economie: ['#PouvoirDAchat', '#Inflation', '#Emploi'], social: ['#Retraites', '#Logement', '#SMIC'], ecologie: ['#Climat', '#Canicule', '#ZéroArtificialisation'],
  securite: ['#Sécurité', '#Police', '#Narcotrafic'], justice: ['#Justice', '#Prisons', '#Délais'], education: ['#École', '#Bac', '#Profs'],
  sante: ['#Hôpital', '#DésertsMédicaux', '#Urgences'], numerique: ['#IA', '#RéseauxSociaux', '#Cyber'], territoires: ['#Ruralité', '#PetitesLignes', '#Maires'],
  diplomatie: ['#Europe', '#Diplomatie', '#Défense'],
};
const FUN_TAGS: Trend[] = [
  { tag: '#MetrodokuDuJour', segment: 'jeunes', hot: 1 }, { tag: '#BaguetteChallenge', segment: 'ruraux', hot: 1 }, { tag: '#ChatDeLaMairie', segment: 'jeunes', hot: 1.2 },
  { tag: '#Apéro', segment: 'populaires', hot: 0.9 }, { tag: '#MonPremierVote', segment: 'jeunes', hot: 1.1 }, { tag: '#Pétanque', segment: 'retraites', hot: 0.9 },
  { tag: '#TourDeFrance', segment: 'ruraux', hot: 1 }, { tag: '#TeamTélétravail', segment: 'cadres', hot: 0.9 },
];

function startFollowers(d: GameState): number {
  const o = ['militant', 'conseiller_municipal', 'maire', 'depute', 'ministre', 'premier_ministre', 'president'].indexOf(d.player.rankId);
  return Math.round(300 * Math.pow(4, Math.max(0, o)) + d.player.stats.popularity * 40);
}

export function socialStats(d: GameState): SocialStats {
  d.phone ??= { messages: [], callsUsed: 0, callsWeek: d.week, called: {} };
  const ph = d.phone;
  ph.audience ??= { followers: startFollowers(d), trendsWeek: -1, trends: [], posts: [], milestones: [] };
  const a = ph.audience;
  if (a.trendsWeek !== d.week) {
    a.trendsWeek = d.week;
    const seed = d.week * 7 + d.seed;
    const pick = <T,>(arr: T[], k: number) => arr[Math.abs(seed + k) % arr.length];
    const trends: Trend[] = [{ tag: pick(DOMAIN_TAGS[d.agendaDomain], 1), domain: d.agendaDomain, hot: 1.5 }];
    const crisis = activeCrises(d)[0];
    if (crisis) trends.push({ tag: `#${CRISES[crisis[0]].label.replace(/^(La |Le |L’|Les |Une |Un )/i, '').replace(/[^\p{L}\p{N}]+/gu, '')}`, hot: 1.8 });
    const other = (['economie', 'social', 'ecologie', 'securite', 'sante', 'education'] as Domain[]).filter(x => x !== d.agendaDomain);
    const dom = pick(other, 3);
    trends.push({ tag: pick(DOMAIN_TAGS[dom], 5), domain: dom, hot: 1.1 });
    trends.push(pick(FUN_TAGS, 11));
    a.trends = trends.slice(0, 4);
  }
  return a;
}

/** « 12,4 k », « 1,2 M » */
export function fmtFollowers(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  if (n >= 1e4) return `${Math.round(n / 1e3).toLocaleString('fr-FR')} k`;
  if (n >= 1e3) return `${(n / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`;
  return String(Math.round(n));
}

const POST_TEXT: Record<string, string[]> = {
  terrain: ['Ce matin au marché : des échanges francs, des idées concrètes. Merci à tous !', 'Visite d’une entreprise qui embauche. Ces femmes et ces hommes sont la France qui avance.', 'Permanence du samedi : 23 personnes reçues, 23 histoires.'],
  coulisses: ['Longue nuit de négociations. On ne lâche rien.', 'Dans les couloirs, on me demande si je suis candidat·e. Réponse : je travaille.', 'Réunion de groupe tendue, mais on avance.'],
  vie: ['Dimanche en famille, téléphone éteint (presque).', 'Mon chien a mangé mes fiches. Improvisation demain matin.', 'Premier footing depuis des mois. Les jambes s’en souviendront.'],
};

export interface PostResult { lines: string[]; viral: boolean; milestone?: number; gained: number }

/** Une publication : audience, likes, et parfois le buzz */
export function postWithReach(d: GameState, kind: 'terrain' | 'coulisses' | 'vie' | 'tendance', rng: Rng, tagIndex = 0): PostResult {
  const a = socialStats(d);
  const trend = kind === 'tendance' ? a.trends[tagIndex] ?? a.trends[0] : undefined;
  const cm = d.player.staff.includes('community_manager') || d.player.team.some(r => r.traits.includes('reseaux_sociaux'));
  const quality = 0.6 + d.player.stats.popularity / 200 + (cm ? 0.25 : 0) + rng.range(-0.2, 0.3);
  const hot = trend?.hot ?? 1;
  const viralChance = clamp(0.06 + (trend ? 0.08 : 0) + (kind === 'vie' ? 0.04 : 0) + (cm ? 0.05 : 0), 0, 0.4) as number;
  const viral = rng.chance(viralChance);
  const likes = Math.round(a.followers * (0.02 + rng.next() * 0.05) * quality * hot * (viral ? 12 : 1));
  const gained = Math.round(a.followers * (0.01 + rng.next() * 0.02) * quality * hot * (viral ? 6 : 1) + 15 + (viral ? 500 : 0));
  a.followers += gained;
  const text = trend ? `${trend.tag} ${rng.pick(['Mon avis, sans langue de bois :', 'On en parle ?', 'Ce que je propose :', 'Il est temps d’agir.'])} ${trend.domain ? DOMAIN_LABELS[trend.domain].toLowerCase() : 'Bonne humeur garantie'} 👇` : rng.pick(POST_TEXT[kind] ?? POST_TEXT['terrain']);
  a.posts.unshift({ id: `post-${d.week}-${a.posts.length}-${Math.floor(rng.next() * 1e6)}`, week: d.week, text, likes, shares: Math.round(likes / 9), viral, ...(trend ? { tag: trend.tag } : {}) });
  if (a.posts.length > 12) a.posts.length = 12;

  const effects: Effect[] = kind === 'terrain' ? [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'credibility', delta: 1 }]
    : kind === 'coulisses' ? [{ kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'exposure', delta: 1 }]
    : kind === 'vie' ? [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'stress', delta: -2 }]
    : [{ kind: 'stat', stat: 'popularity', delta: 1 }, ...(trend?.domain ? [{ kind: 'dossier', domain: trend.domain, delta: 3 } as Effect] : []),
      ...(trend?.segment ? [{ kind: 'segment', segment: trend.segment, delta: 3 } as Effect] : [{ kind: 'segment', segment: 'jeunes', delta: 1 } as Effect])];
  if (viral) effects.push({ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'segment', segment: 'jeunes', delta: 2 }, { kind: 'momentum', delta: 3 });
  const lines = [`+${fmtFollowers(gained)} abonnés`, `♥ ${fmtFollowers(likes)}`, ...applyEffects(d, effects, {}, rng)];
  if (viral) {
    lines.unshift('🔥 Viral !');
    pushNews(d, 'actu', 'positive', 'Votre publication fait le buzz', `${fmtFollowers(likes)} « j’aime » en quelques heures${trend ? ` sur ${trend.tag}` : ''}. Les médias reprennent.`);
  }
  const milestone = checkMilestones(d, rng);
  return { lines, viral, gained, ...(milestone ? { milestone } : {}) };
}

/** Un live par mois : une heure de questions-réponses */
export function goLive(d: GameState, rng: Rng): PostResult | null {
  const a = socialStats(d);
  if (a.liveWeek === d.week || d.player.stats.energy < 8) return null;
  a.liveWeek = d.week;
  const viewers = Math.round(a.followers * (0.03 + rng.next() * 0.04));
  const slip = rng.chance(d.player.stats.stress > 60 ? 0.25 : 0.1);
  const gained = Math.round(viewers * (slip ? 0.3 : 0.9) + 50);
  a.followers += gained;
  a.posts.unshift({ id: `live-${d.week}`, week: d.week, text: slip ? '🔴 Live : une réponse maladroite fait le tour des réseaux.' : '🔴 Live : une heure de questions, sans filtre.', likes: viewers, shares: Math.round(viewers / 12), viral: false });
  const effects: Effect[] = slip
    ? [{ kind: 'stat', stat: 'energy', delta: -8 }, { kind: 'stat', stat: 'popularity', delta: -2 }, { kind: 'exposure', delta: 2 }]
    : [{ kind: 'stat', stat: 'energy', delta: -8 }, { kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'segment', segment: 'jeunes', delta: 3 }, { kind: 'stat', stat: 'credibility', delta: 1 }];
  const lines = [`${fmtFollowers(viewers)} spectateurs`, `+${fmtFollowers(gained)} abonnés`, ...(slip ? ['Un dérapage repris partout'] : []), ...applyEffects(d, effects, {}, rng)];
  const milestone = checkMilestones(d, rng);
  return { lines, viral: false, gained, ...(milestone ? { milestone } : {}) };
}

function checkMilestones(d: GameState, rng: Rng): number | undefined {
  const a = socialStats(d);
  const hit = MILESTONES.filter(m => a.followers >= m && !a.milestones.includes(m));
  if (!hit.length) return undefined;
  for (const m of hit) a.milestones.push(m);
  const top = Math.max(...hit);
  const rank = MILESTONES.indexOf(top) + 1;
  applyEffects(d, [{ kind: 'stat', stat: 'influence', delta: 2 + rank }, { kind: 'stat', stat: 'popularity', delta: 1 + Math.floor(rank / 2) }, { kind: 'segment', segment: 'jeunes', delta: 2 }], {}, rng);
  pushNews(d, 'actu', 'positive', `${fmtFollowers(top)} abonnés !`, 'Votre audience franchit un cap : les plateaux télé vous réclament, les annonceurs aussi.');
  return top;
}

/** Chaque mois : l'audience rapporte (et s'érode si l'on se tait) */
export function monthlySocial(d: GameState, rng: Rng): void {
  const a = socialStats(d);
  const active = a.posts.some(p => d.week - p.week <= 1);
  a.followers = Math.max(100, Math.round(a.followers * (active ? 1.01 : 0.985)));
  const reach = Math.log10(Math.max(10, a.followers));
  // 1 000 abonnés ≈ +0,15 popularité/mois ; 1 M ≈ +0,6
  const pop = Math.round(Math.max(0, (reach - 2.5) * 0.15) * 100) / 100;
  if (pop > 0) {
    d.player.stats.popularity = clamp(d.player.stats.popularity + pop);
    const seg = electorate(d).offsets;
    seg.jeunes = clamp(seg.jeunes + pop / 2, -30, 30);
  }
  void rng;
}

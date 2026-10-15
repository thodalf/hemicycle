import { GameState, NewsItem, NewsKind } from '../models/game.models';
import { monthLabel } from './calendar';
import { economy, regionShares, segmentRows } from './country';
import { nameRng, personName } from '../data/names';
import { clamp, fr } from './rng';
import { office, seat } from './office';

/* ============================================================
 *  La une : chaque mois, un vrai journal. Le gros titre est
 *  choisi parmi les dépêches du mois (coups d'éclat, scandales,
 *  votes, élections…), entouré d'articles, d'un sommaire, de
 *  sondages et des chiffres du pays.
 * ============================================================ */

export type ArtTheme = 'hemicycle' | 'urne' | 'foule' | 'courbe' | 'loupe' | 'drapeau' | 'croix' | 'couronne' | 'monument' | 'micro' | 'globe' | 'nature';

export interface Article {
  id: string;
  kicker: string;
  title: string;
  body: string;
  tone: NewsItem['tone'];
  theme: ArtTheme;
  byline: string;
  page: number;
}

export interface Edition {
  week: number;
  number: number;
  date: string;
  headline: Article;
  articles: Article[];
  briefs: Article[];
  sommaire: { title: string; page: number }[];
  barometre: { cote: number; trend: number; history: number[] };
  segments: { label: string; value: number }[];
  parties: { name: string; color: string; share: number; mine: boolean }[];
  question: { text: string; yes: number };
  chiffres: { label: string; value: string; good: boolean }[];
  meteo: string;
}

const KICKER: Record<NewsKind, string> = {
  actu: 'Politique', action: 'Terrain', decision: 'Décryptage', scandale: 'Révélations', sondage: 'Opinion',
  rival: 'Coulisses', parti: 'Vie des partis', election: 'Élections', reseau: 'Réseaux', systeme: 'Portrait',
};

const THEMES: [RegExp, ArtTheme][] = [
  [/scandale|affaire|enquête|révél|secret|chantage|fuite|procès|parjure|mis en examen/i, 'loupe'],
  [/\broi\b|\breine\b|couronne|palais|royal|souverain|prince/i, 'couronne'],
  [/censure|\bvote|\bloi\b|\blois\b|assembl|scrutin|amendement|49\.3|texte|obstruction|hémicycle|réforme/i, 'hemicycle'],
  [/élection|présidentielle|législatives|municipales|candidat|urne|second tour/i, 'urne'],
  [/grève|manif|colère|cortège|révolte|blocage|émeute|rond-point|tracteur|syndicat/i, 'foule'],
  [/économ|chômage|croissance|budget|déficit|dette|bourse|krach|inflation|milliard|entreprise|usine/i, 'courbe'],
  [/guerre|armée|militaire|frégate|défense|soldat|navire/i, 'drapeau'],
  [/santé|hôpital|épidémie|virus|soignant|urgences|punaise/i, 'croix'],
  [/tour eiffel|cathédrale|château|patrimoine|monument|musée/i, 'monument'],
  [/sommet|ambassad|diplomat|international|étranger|visite d’état|chef d’état/i, 'globe'],
  [/climat|canicule|baleine|forêt|feux|eau|ours|écolog/i, 'nature'],
];

export function themeOf(text: string, kind?: NewsKind): ArtTheme {
  if (kind === 'scandale') return 'loupe';
  if (kind === 'election') return 'urne';
  for (const [re, t] of THEMES) if (re.test(text)) return t;
  return 'micro';
}

/** L'importance d'une dépêche pour la une */
function weight(n: NewsItem): number {
  let w = n.une ? 120 : 0;
  w += ({ scandale: 80, election: 70, actu: 40, decision: 25, sondage: 18, rival: 20, parti: 22, systeme: 28, reseau: 8, action: 4 } as Record<NewsKind, number>)[n.kind] ?? 0;
  if (n.tone === 'negative') w += 10;
  if (/^(Raté|Coup d’éclat)/.test(n.title)) w += n.title.startsWith('Coup') ? 30 : 6;
  w += Math.min(15, (n.body?.length ?? 0) / 20);
  return w;
}

/** Les dépêches de « routine » (une action et ses gains) ne font pas un article */
const routine = (n: NewsItem) => n.kind === 'action' && !/^(Raté|Coup d’éclat)/.test(n.title);

function byline(d: GameState, id: string): string {
  return personName(nameRng(d.seed, `byline:${id}`), id.charCodeAt(id.length - 1) % 2 ? 'f' : 'm');
}

/** Un texte de dépêche devient un article : on retire les chiffres de jeu (« Popularité +2 · … ») du corps */
function prose(body = ''): string {
  return body.split(' — ').filter(part => !/^([A-ZÉ][\wÀ-ÿ’' -]+ [+−-]\d[\d,]*( %)?( · |$))+/.test(part.trim())).join(' — ').trim();
}

function toArticle(d: GameState, n: NewsItem, page: number): Article {
  const text = `${n.title} ${n.body ?? ''}`;
  const title = n.title.replace(/^Coup d’éclat : /, '').replace(/^Raté : /, 'Raté : ');
  const body = prose(n.body) || (n.tone === 'negative' ? 'Un mois difficile, commentent les observateurs.' : 'Les observateurs saluent l’initiative.');
  return { id: n.id, kicker: n.title.startsWith('Coup d’éclat') ? 'Le coup d’éclat' : n.title.startsWith('Raté') ? 'Fait divers' : KICKER[n.kind], title, body, tone: n.tone, theme: themeOf(text, n.kind), byline: byline(d, n.id), page };
}

/** Les cotes de popularité successives (pour la courbe du baromètre) */
export function recordBarometre(d: GameState): void {
  const b = (d.barometre ??= []);
  b.push(Math.round(d.player.stats.popularity));
  if (b.length > 24) b.splice(0, b.length - 24);
}

export function edition(d: GameState, week: number): Edition {
  const items = d.news.filter(n => n.week === week);
  const ranked = [...items].filter(n => !routine(n)).sort((a, b) => weight(b) - weight(a));
  const fallback: NewsItem = { id: `calme-${week}`, week, kind: 'actu', tone: 'neutral', title: office(d) === 'base' ? 'Un mois sans fracas' : `Calme plat ${seat(d)}`,
    body: 'Pas de crise, pas de scandale : le pays respire, et la classe politique prépare la suite. Les éditorialistes s’ennuient ferme.' };
  const head = ranked[0] ?? fallback;
  const headline = toArticle(d, head, 1);
  const rest = ranked.slice(1);
  const articles = rest.slice(0, 4).map((n, i) => toArticle(d, n, 2 + i));
  const briefs = [...rest.slice(4), ...items.filter(routine)].slice(0, 8).map((n, i) => toArticle(d, n, 6 + Math.floor(i / 2)));
  const hist = d.barometre ?? [];
  const cote = Math.round(d.player.stats.popularity);
  const prev = hist.length >= 2 ? hist[hist.length - 2] : cote;
  // Intentions de vote nationales : la moyenne des régions
  const shares = regionShares(d);
  const regions = Object.values(shares);
  const all = [d.party, ...d.otherParties];
  const parties = all.map(p => ({ name: p.name, color: p.color, mine: p.id === d.party.id, share: Math.round(regions.reduce((t, r) => t + (r[p.id] ?? 0), 0) / Math.max(1, regions.length)) }))
    .sort((a, b) => b.share - a.share).slice(0, 5);
  const e = economy(d);
  const v = d.vote;
  const question = v
    ? { text: `Êtes-vous favorable au texte « ${v.title} » ?`, yes: Math.round(v.opinion) }
    : d.presidency ? { text: 'Approuvez-vous l’action du chef de l’État ?', yes: Math.round(d.presidency.approval) }
    : { text: `Faites-vous confiance à ${d.player.name} pour l’avenir ?`, yes: Math.round(clamp(d.player.stats.popularity * 0.7 + d.player.stats.credibility * 0.3)) };
  const mood = cote >= 60 ? '☀️ Grand beau temps : votre cote rayonne.' : cote >= 45 ? '⛅ Éclaircies : l’opinion hésite, mais vous écoute.' : cote >= 30 ? '🌧️ Averses : le ciel se couvre au-dessus de vous.' : '⛈️ Orages : la tempête gronde dans l’opinion.';
  return {
    week, number: 18_400 + week, date: monthLabel(week),
    headline, articles, briefs,
    sommaire: [headline, ...articles, ...briefs.slice(0, 3)].map(a => ({ title: a.title, page: a.page })),
    barometre: { cote, trend: cote - prev, history: hist.slice(-12) },
    segments: segmentRows(d).map(r => ({ label: r.label, value: r.approval })),
    parties, question,
    chiffres: [
      { label: 'Chômage', value: `${fr(e.unemployment, 1)} %`, good: e.unemployment < 7.5 },
      { label: 'Croissance', value: `${e.growth >= 0 ? '+' : ''}${fr(e.growth, 1)} %`, good: e.growth >= 1 },
      { label: 'Inflation', value: `${fr(e.inflation, 1)} %`, good: e.inflation <= 2.5 },
      { label: 'Déficit', value: `${fr(e.deficit, 1)} %`, good: e.deficit <= 3 },
    ],
    meteo: mood,
  };
}

/** Les mois qui ont une édition (les douze derniers) */
export function editionWeeks(d: GameState): number[] {
  const weeks = [...new Set(d.news.map(n => n.week))].sort((a, b) => b - a);
  return weeks.slice(0, 12);
}

import { GameState, NewsItem, NewsKind } from '../models/game.models';
import { monthLabel } from './calendar';
import { economy, regionShares, segmentRows } from './country';
import { genderOf, nameRng, personName } from '../data/names';
import { cleanBody, degender, guessFem, pressHeadline, toThird } from './headline';
import { clamp, fr } from './rng';
import { inPower, office, seat } from './office';
import { renownTier } from '../data/lifestyles';

/* ============================================================
 *  La une : chaque mois, un vrai journal. Le gros titre est
 *  choisi parmi les dépêches du mois (coups d'éclat, scandales,
 *  votes, élections…), entouré d'articles, d'un sommaire, de
 *  sondages et des chiffres du pays.
 * ============================================================ */

export type ArtTheme = 'hemicycle' | 'urne' | 'foule' | 'courbe' | 'loupe' | 'drapeau' | 'croix' | 'couronne' | 'monument' | 'micro' | 'globe' | 'nature'
  | 'tribunal' | 'ecole' | 'usine' | 'ferme' | 'ville' | 'aeroport' | 'port' | 'stade' | 'labo' | 'plateau' | 'gare' | 'police'
  | 'mer' | 'montagne' | 'pont' | 'musee' | 'marche' | 'route' | 'concert' | 'espace' | 'chantier' | 'bureau';

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
  /** Le joueur est-il une grande figure publique ? Sinon le journal ne parle pas de lui */
  famous: boolean;
  barometre: { cote: number; trend: number; history: number[]; label: string; title: string };
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
  [/procès|tribunal|\bjuges?\b|magistrat|justice|condamn|avocat|relaxe|cour d’appel|cassation/i, 'tribunal'],
  [/scandale|affaire|enquête|révél|secret|chantage|fuite|parjure|mis en examen/i, 'loupe'],
  [/\broi\b|\breine\b|couronne|palais|royal|souverain|prince/i, 'couronne'],
  [/police|policier|attentat|émeute|violences|commissariat|gendarm|sécurité publique|cambriol|braquage|\bcasse\b/i, 'police'],
  [/fusée|spatial|satellite|comète|astéro|météorite|éclipse|planète mars|sur mars|cosmonaute|astronaute|\blune\b|lunaire|kourou/i, 'espace'],
  [/\bponts?\b|viaduc|ouvrage d’art/i, 'pont'],
  [/\bgares?\b|\btrains?\b(?! de)|sncf|\btgv\b|cheminot|ferroviaire/i, 'gare'],
  [/aéroport|\bavions?\b|aérien|compagnie aérienne|décoll|contrôleurs aériens/i, 'aeroport'],
  [/\bports?\b|dockers|portuaire|cargo|\bbateaux?\b|\bpêche|pêcheurs|maritime/i, 'port'],
  [/plage|littoral|\bmer\b|\bbaie\b|algues|marée|océan|bord de mer|vacanciers|baleine|pirate|la manche|submersion|digue|nautilia|cité flottante/i, 'mer'],
  [/montagne|\bski\b|station de ski|\bneige|avalanche|glacier|\balpes\b|pyrénées|vague de froid|froid record|grand hiver|volcan|puy de|éruption|cendres|auvergne|pépite|filon|orpaill|chercheurs d’or|cévennes|homme des glaces|mer de glace|chamonix|\bfailles?\b|beauce|gouffre/i, 'montagne'],
  [/\bstades?\b|\bmatch|coupe du monde|olympiques|\bjo\b|\bsport|les bleus|finale|e-sport|esport|tour de france/i, 'stade'],
  [/concert|chanteu|festival|musique|eurovision|spectacle|théâtre|artiste|chanson|dansante|danseurs|\bbal\b|opéra/i, 'concert'],
  [/musée|tableau|exposition|œuvre|archéolog|trésor|fouilles|patrimoine culturel|apparitions?|fantômes?|revenants?|testament|codicille|ministère du bonheur|archives secrètes|documents classifiés|télégramme/i, 'musee'],
  [/école|lycée|collège|élèves|enseign|professeur|\bbac\b|\bclasses?\b|étudiant|universit|campus|rentrée/i, 'ecole'],
  [/recherche|laboratoire|scientifique|vaccin|fusion nucléaire|nobel|chercheu|intelligence artificielle|nucléaire|MÉTIS|serveurs|clonage|cloné|voyageur du temps|somnolence|dormeurs|jouvence|\bmiroir\b|l’autre france|moteur à eau|catalyseur|\brêves?\b|rêveurs?|laboratoire du sommeil/i, 'labo'],
  [/\btélé\b|télévis|plateau|matinale|émission|interview|débat télévisé|journal de 20/i, 'plateau'],
  [/censure|\bvote|\bloi\b|\blois\b|assembl|scrutin|amendement|49\.3|obstruction|hémicycle|réforme/i, 'hemicycle'],
  [/élection|présidentielle|législatives|municipales|candidat|urne|second tour/i, 'urne'],
  [/conseil des ministres|remaniement|premier ministre|matignon|élysée|décret|nomination|ministre|gouvernement/i, 'bureau'],
  [/agricult|\bfermes?\b|paysan|tracteur|récolte|vigne|vendange|éleveur|ruraux|\bblé\b|exode|néo-ruraux|abeilles?|\bruches?\b|apicult|pollinis|pesticide|pluie artificielle|grêle/i, 'ferme'],
  [/chantier|travaux|\bgrues?\b|\bbtp\b|construction|logements? neufs?|reconstru|rouille blanche|béton|tour hélios|deux mille mètres|\bsables?\b|\bdunes?\b|granulat/i, 'chantier'],
  [/\busines?\b|industri|ouvrier|fermeture d|relocalis|sidérurg|licenciement|plan social|robots?|grève des robots/i, 'usine'],
  [/marché|boulanger|commerçant|commerces|pouvoir d’achat|moutarde|pénurie|supermarch|\bprix\b|courses|\bcafés?\b|caféier|bistrot|chicorée|torréfact/i, 'marche'],
  [/(?<!feuille de )\broutes?\b|autoroute|embouteillage|bouchon|carburant|essence|péage|radar|périphérique|\btaxis?\b|automobil/i, 'route'],
  [/grève|manif|colère|cortège|révolte|blocage|rond-point|syndicat|sécession|république du midi|gouvernement parallèle|vote du soir|commune directe|démocratie directe/i, 'foule'],
  [/économ|chômage|croissance|budget|déficit|dette|bourse|krach|inflation|milliard|entreprise|franc numérique|euro numérique|banque de france/i, 'courbe'],
  [/guerre|armée|militaire|frégate|défense|soldat|navire de guerre/i, 'drapeau'],
  [/santé|hôpital|épidémie|virus|soignant|urgences|punaise/i, 'croix'],
  [/tour eiffel|cathédrale|château|patrimoine|monument/i, 'monument'],
  [/sommet|ambassad|diplomat|international|étranger|visite d’état|chef d’état|grand silence|internet coupé|câbles|sommet sans fin|délégations|communiqué final|boycott|embargo|droits de douane/i, 'globe'],
  [/climat|canicule|forêt|feux|\beau\b|ours|écolog|inondation|tempête|dinosaure|tricératops|vélociraptor|brocéliande|voyante/i, 'nature'],
  [/\bvilles?\b|quartier|banlieue|municip|\bcommunes?\b|métro|logement|immobilier|loyer|maire|catacombes|souterrain/i, 'ville'],
];

/** Les décors de repli, quand la dépêche ne donne aucun indice (ou que tous ses décors sont pris) */
const FALLBACK: ArtTheme[] = ['micro', 'plateau', 'ville', 'bureau', 'foule', 'hemicycle', 'globe', 'courbe', 'marche', 'route'];

/** Tous les décors possibles d'une dépêche, du plus pertinent au moins pertinent */
export function themesOf(text: string, kind?: NewsKind, title?: string): ArtTheme[] {
  const out: ArtTheme[] = [];
  const add = (t: ArtTheme) => { if (!out.includes(t)) out.push(t); };
  if (kind === 'scandale') add('loupe');
  if (kind === 'election') add('urne');
  // Le titre d'abord, le corps ensuite
  for (const src of [title, text]) if (src) for (const [re, t] of THEMES) if (re.test(src)) add(t);
  // Sans indice : on varie le décor d'une dépêche à l'autre
  let h = 0;
  for (const ch of (title ?? '') + text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  for (let i = 0; i < FALLBACK.length; i++) add(FALLBACK[(h + i) % FALLBACK.length]);
  return out;
}

export function themeOf(text: string, kind?: NewsKind, title?: string): ArtTheme {
  return themesOf(text, kind, title)[0];
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

/** La vie privée ne regarde pas les journaux : famille, santé, argent personnel, téléphone, loge, secrets, objectifs… */
const PRIVATE = /appel manqué|message ignoré|votre caractère|mariage|marier|un enfant \?|fonder une famille|une rencontre|vous font la cour|amour|couple|divorce|conjoint|votre famille|en famille|maman|anniversaire|naissance de|décès de votre|votre santé|stress|vous craquez|exutoire|initiation|initié|\bloge\b|un frère|vénérable|émissaire du prétendant|rumeur sur|creuser discrètement|chantage|\bsecrets?\b|levier|vos dettes|votre dette|emprunt|épargne|fonds perso|salaire|rémunération|héritage|objectif|style de vie|nouvel avantage|nouveau trait|renommée :|crainte|vélo volé|flashé|vacances|nouvel onglet|mini-jeu|lassitude|complot|détective|maîtresse|amant/i;
/** Une dépêche peut-elle paraître dans le journal ? */
export function isPublic(d: GameState, n: NewsItem): boolean {
  if (n.kind === 'systeme' || n.kind === 'reseau') return false;
  // On juge le texte rédigé, pas les chiffres de jeu qui l'accompagnent (« Stress +3 »)
  if (PRIVATE.test(`${n.title} ${prose(n.body)}`)) return false;
  // Les petits boulots et la carte du parti du joueur : sa vie à lui
  const me = d.player.name;
  if (me && new RegExp(`^${me.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (rejoint|prend sa carte|quitte)`).test(n.title)) return false;
  if (/se sépare de vous|vous quitte/.test(n.title)) return false;
  return true;
}

/** Une grande personnalité publique : au gouvernement, à l'Élysée, sur le trône, ou célèbre */
export const famous = (d: GameState) => inPower(d) || renownTier(d.player.renown ?? 0) >= 2;

/** Les coups d'éclat et les ratés font toujours parler, même d'un inconnu */
const exploit = (n: NewsItem) => /^(Raté|Coup d’éclat)/.test(n.title);

/** La dépêche parle-t-elle du joueur ? */
function aboutPlayer(d: GameState, n: NewsItem): boolean {
  if (n.kind === 'action' || n.kind === 'decision' || n.kind === 'sondage') return true;
  const t = `${n.title} ${prose(n.body)}`;
  if (/\bvous\b|\bvotre\b|\bvos\b|\bvôtre\b/i.test(t)) return true;
  const me = d.player.name;
  if (me && t.includes(me)) return true;
  if (n.kind === 'election' && /investiture|victoire aux|défaite aux|débat décisif|campagne .* est ouverte|élu·e au premier|qualifié/i.test(n.title)) return true;
  return false;
}

/** Ce qui paraît vraiment dans le journal du mois */
function inPaper(d: GameState, n: NewsItem, star: boolean): boolean {
  if (!isPublic(d, n)) return false;
  return star || exploit(n) || !aboutPlayer(d, n);
}

/** Un indice de confiance dans l'exécutif, tiré de l'économie (quand le joueur n'est pas le sujet) */
function nationalMood(d: GameState): number {
  if (d.presidency) return Math.round(d.presidency.approval);
  const e = economy(d);
  return Math.round(clamp(42 - (e.unemployment - 7) * 3 + e.growth * 4 - Math.max(0, e.inflation - 2) * 2.5 - Math.max(0, e.deficit - 3) * 1.5, 12, 70));
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

/** Comment la presse désigne le joueur : son nom, ou sa fonction (« La présidente »), en alternance */
function pressName(d: GameState, key: string): string {
  const fem = d.player.gender === 'femme';
  const o = office(d);
  const role = o === 'couronne' ? (fem ? 'La reine' : 'Le roi')
    : o === 'elysee' ? (fem ? 'La présidente' : 'Le président')
    : d.player.rankId === 'premier_ministre' ? (fem ? 'La Première ministre' : 'Le Premier ministre')
    : d.player.rankId === 'ministre' ? (fem ? 'La ministre' : 'Le ministre')
    : null;
  const h = [...key].reduce((t, c) => (t * 31 + c.charCodeAt(0)) >>> 0, 3);
  return role && h % 2 ? role : d.player.name;
}

/** Le genre de la personnalité nommée dans un titre (prénom reconnu, sinon PNJ connu, sinon terminaison) */
function personGender(d: GameState, title: string): boolean | undefined {
  for (const w of title.split(/[\s’']+/)) {
    if (!/^[A-ZÉÈ]/.test(w)) continue;
    const g = genderOf(w.replace(/[^\wÀ-ÿ-]/g, ''));
    if (g) return g === 'f';
  }
  const npc = d.npcs.find(x => title.includes(x.name));
  return npc ? guessFem(npc.name) : undefined;
}

/** Un corps encore écrit pour le joueur (« vous ») : récrit à la troisième personne, ou en confidence d'un proche */
function thirdPersonBody(body: string, who: string, fem: boolean, key: string): string {
  if (!/\b(vous|votre|vos)\b/i.test(body)) return body;
  const t = toThird(body, who, fem);
  if (t) return t;
  const h = [...key].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 11);
  const by = ['confie un proche', 'glisse un conseiller', 'résume un collaborateur', 'souffle un fidèle'][h % 4];
  return `« ${body.replace(/[.!]\s*$/, '')} », ${by}.`;
}

function toArticle(d: GameState, n: NewsItem, page: number, used?: Set<ArtTheme>): Article {
  const text = `${n.title} ${n.body ?? ''}`;
  const about = aboutPlayer(d, n);
  const who = pressName(d, n.id);
  // La personnalité citée (nécrologie, élection…) : pour accorder « élu·e », « éteint·e »
  const personFem = personGender(d, n.title);
  const h = pressHeadline(n.title, n.body, { who, fem: d.player.gender === 'femme', aboutPlayer: about, personFem: about ? undefined : personFem }, n.id, n.kind);
  let raw = cleanBody(prose(n.body));
  if (!about && personFem !== undefined) raw = degender(raw, personFem);
  const body = (about ? thirdPersonBody(raw, who, d.player.gender === 'femme', n.id) : raw) || (n.tone === 'negative' ? 'Un mois difficile, commentent les observateurs.' : 'Les observateurs saluent l’initiative.');
  return { id: n.id, kicker: h.kicker ?? KICKER[n.kind], title: h.title, body, tone: n.tone, theme: pickTheme(themesOf(text, n.kind, n.title), used), byline: byline(d, n.id), page };
}

/** Deux articles d'un même numéro n'ont jamais la même photo */
function pickTheme(options: ArtTheme[], used?: Set<ArtTheme>): ArtTheme {
  const t = options.find(o => !used?.has(o)) ?? options[0];
  used?.add(t);
  return t;
}

/** Les cotes de popularité successives (pour la courbe du baromètre) */
export function recordBarometre(d: GameState): void {
  const b = (d.barometre ??= []);
  b.push(Math.round(d.player.stats.popularity));
  if (b.length > 24) b.splice(0, b.length - 24);
  const n = (d.barometreNat ??= []);
  n.push(nationalMood(d));
  if (n.length > 24) n.splice(0, n.length - 24);
}

export function edition(d: GameState, week: number): Edition {
  const star = famous(d);
  const items = d.news.filter(n => n.week === week && inPaper(d, n, star));
  const ranked = [...items].filter(n => !routine(n)).sort((a, b) => weight(b) - weight(a));
  const fallback: NewsItem = { id: `calme-${week}`, week, kind: 'actu', tone: 'neutral', title: office(d) === 'base' ? 'Un mois sans fracas' : `Calme plat ${seat(d)}`,
    body: 'Pas de crise, pas de scandale : le pays respire, et la classe politique prépare la suite. Les éditorialistes s’ennuient ferme.' };
  const head = ranked[0] ?? fallback;
  const used = new Set<ArtTheme>();
  const headline = toArticle(d, head, 1, used);
  const rest = ranked.slice(1);
  const articles = rest.slice(0, 4).map((n, i) => toArticle(d, n, 2 + i, used));
  const briefs = [...rest.slice(4), ...items.filter(routine)].slice(0, 8).map((n, i) => toArticle(d, n, 6 + Math.floor(i / 2), used));
  const hist = (star ? d.barometre : d.barometreNat) ?? [];
  const cote = star ? Math.round(d.player.stats.popularity) : nationalMood(d);
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
    : star ? { text: `Faites-vous confiance à ${d.player.name} pour l’avenir ?`, yes: Math.round(clamp(d.player.stats.popularity * 0.7 + d.player.stats.credibility * 0.3)) }
    : { text: 'Faites-vous confiance au gouvernement pour améliorer votre quotidien ?', yes: cote };
  const mood = !star
    ? (cote >= 55 ? '☀️ Embellie : le moral des Français remonte.' : cote >= 40 ? '⛅ Temps variable : le pays attend de voir.' : cote >= 28 ? '🌧️ Ciel bas : la défiance s’installe.' : '⛈️ Orages : le pays gronde contre ses dirigeants.')
    : cote >= 60 ? '☀️ Grand beau temps : votre cote rayonne.' : cote >= 45 ? '⛅ Éclaircies : l’opinion hésite, mais vous écoute.' : cote >= 30 ? '🌧️ Averses : le ciel se couvre au-dessus de vous.' : '⛈️ Orages : la tempête gronde dans l’opinion.';
  return {
    week, number: 18_400 + week, date: monthLabel(week),
    headline, articles, briefs,
    sommaire: [headline, ...articles, ...briefs.slice(0, 3)].map(a => ({ title: a.title, page: a.page })),
    famous: star,
    barometre: { cote, trend: cote - prev, history: hist.slice(-12), label: star ? 'de bonnes opinions' : 'font confiance au gouvernement', title: star ? 'Le baromètre' : 'Le moral des Français' },
    segments: !star ? [] : segmentRows(d).map(r => ({ label: r.label, value: r.approval })),
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
  const star = famous(d);
  const weeks = [...new Set(d.news.filter(n => inPaper(d, n, star)).map(n => n.week))].sort((a, b) => b - a);
  return weeks.slice(0, 12);
}

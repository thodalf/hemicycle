import { ActionDefinition, Domain, Effect, GameState } from '../models/game.models';
import { ACTIONS_BY_ID } from '../data/actions';
import { monthIndex } from './calendar';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Un agenda qui change chaque mois.
 *
 *  1. LA MAIN DU MOIS : parmi les actions ordinaires (terrain,
 *     médias, dossiers, parti, réseau, fonction…), seule une main
 *     tirée au début du mois est jouable (6 à 11 actions, selon vos
 *     points d'action). Le tirage tient compte
 *     du sujet à la une et préfère ce qu'on n'a pas fait depuis
 *     longtemps. On peut redistribuer une fois par mois (gratuit
 *     avec une directrice de cabinet, sinon du capital politique).
 *     Repos, santé, argent, crises, sagas et scénarios restent
 *     toujours disponibles.
 *  2. LES OCCASIONS : deux actions « du mois », liées à la saison
 *     et à l'actualité. Plus fortes (+50 %), un point d'action de
 *     moins, et elles disparaissent à la fin du mois.
 *  3. LES COMBOS : certaines suites d'actions dans le même mois
 *     (l'ordre compte) rapportent un bonus.
 * ============================================================ */

export const HAND_CATEGORIES = new Set(['terrain', 'medias', 'dossiers', 'parti', 'reseau', 'fonction', 'territoire', 'elysee', 'international', 'intrigue', 'couronne', 'loge', 'administration']);
const CORE = ['terrain', 'medias', 'dossiers', 'parti'];

export interface Occasion { actionId: string; title: string; blurb: string }
export interface AgendaHand { week: number; ids: string[]; occasions: Occasion[]; redraws: number }

/** Le prix d'une redistribution (capital politique) ; 0 avec une directrice de cabinet */
export function redrawCost(d: GameState): number {
  return d.player.staff.includes('chef_cabinet') ? 0 : 6;
}

function mentionsDomain(a: ActionDefinition, dom: Domain): boolean {
  return a.target === 'domain' || a.effects.some(e => e.kind === 'dossier' && (e.domain === dom || e.domain === '$domain'));
}

/** Tirer la main du mois parmi les actions ordinaires débloquées */
export function drawHand(d: GameState, unlocked: ActionDefinition[], rng: Rng, keepOccasions = false): AgendaHand {
  const pool = unlocked.filter(a => HAND_CATEGORIES.has(a.category));
  // La main se cale sur le temps disponible : de quoi choisir, jamais de quoi tout faire
  const ap = d.player.actionPoints.max;
  const size = Math.min(pool.length, clamp(Math.round(ap * 0.6) + 2, 6, 11));
  const perCore = size >= 10 ? 2 : 1;
  const weight = (a: ActionDefinition) => {
    const last = Number(d.player.flags[`last_${a.id}`] ?? -99);
    let w = 1;
    if (mentionsDomain(a, d.agendaDomain)) w *= 1.6;
    if (d.week - last <= 1) w *= 0.45;
    else if (d.week - last >= 12) w *= 1.4;
    return w;
  };
  const picked: ActionDefinition[] = [];
  const take = (list: ActionDefinition[]) => {
    const total = list.reduce((t, a) => t + weight(a), 0);
    let roll = rng.next() * total;
    const k = Math.max(0, list.findIndex(a => (roll -= weight(a)) < 0));
    const a = list[k];
    picked.push(a);
    pool.splice(pool.indexOf(a), 1);
  };
  // Au moins deux actions de chaque grande famille, quand il y en a
  for (const cat of CORE) for (let i = 0; i < perCore; i++) { const l = pool.filter(a => a.category === cat); if (l.length && picked.length < size) take(l); }
  while (picked.length < size && pool.length) take(pool);
  const prev = d.agendaHand;
  const occasions = keepOccasions && prev?.week === d.week ? prev.occasions : drawOccasions(d, unlocked, picked, rng);
  return { week: d.week, ids: picked.map(a => a.id), occasions, redraws: keepOccasions && prev?.week === d.week ? prev.redraws + 1 : 0 };
}

/* ── Les occasions du mois ────────────────────────────────── */

const SEASON: Record<number, { title: string; blurb: string; cats: string[] }[]> = {
  0: [{ title: 'La saison des vœux', blurb: 'Galettes, cérémonies de vœux, cartes de visite : tout le monde veut vous voir.', cats: ['terrain', 'parti', 'reseau'] }],
  1: [{ title: 'Le Salon de l’agriculture', blurb: 'Porte de Versailles, les éleveurs vous attendent. Une caresse à une vache, et la France vous regarde.', cats: ['terrain', 'medias', 'territoire'] }],
  2: [{ title: 'Le printemps des débats', blurb: 'Les matinales cherchent des invités pour parler du projet de loi du moment.', cats: ['medias', 'dossiers'] }],
  3: [{ title: 'Les rendez-vous de Pâques', blurb: 'Marchés, brocantes et fêtes de village : la France sort de chez elle.', cats: ['terrain', 'territoire'] }],
  4: [{ title: 'Le mois des cortèges', blurb: 'Défilés du 1er Mai, commémorations du 8 : il faut en être, ou se faire remarquer en n’y étant pas.', cats: ['terrain', 'parti', 'medias'] }],
  5: [{ title: 'Les fêtes de juin', blurb: 'Kermesses, Fête de la musique, remises de prix : la proximité à portée de main.', cats: ['terrain', 'reseau'] }],
  6: [{ title: 'Le 14 Juillet', blurb: 'Défilé, garden-party, bals des pompiers : l’été républicain commence.', cats: ['reseau', 'fonction', 'elysee', 'terrain'] }],
  7: [{ title: 'Les universités d’été', blurb: 'Le parti se retrouve au bord de la mer. Les discours d’août font les rentrées de septembre.', cats: ['parti', 'medias'] }],
  8: [{ title: 'La rentrée politique', blurb: 'Tout le monde revient, les plateaux se remplissent, les dossiers s’empilent.', cats: ['dossiers', 'medias', 'fonction'] }],
  9: [{ title: 'La saison budgétaire', blurb: 'Le projet de loi de finances arrive : c’est le moment de montrer qu’on maîtrise les chiffres.', cats: ['dossiers', 'fonction', 'administration'] }],
  10: [{ title: 'Les congrès d’automne', blurb: 'Congrès des maires, congrès du parti : tout le monde se compte.', cats: ['parti', 'reseau', 'territoire'] }],
  11: [{ title: 'Les marchés de Noël', blurb: 'Vin chaud, chalets en bois et poignées de main gantées.', cats: ['terrain', 'reseau'] }],
};
const CAT_HOOKS: Record<string, { title: string; blurb: string }[]> = {
  terrain: [{ title: 'Une salle vous attend', blurb: 'Une association a réservé une salle et cherche un invité : le public est déjà là.' }, { title: 'Un marché sans concurrent', blurb: 'Vos rivaux sont tous à Paris ce week-end. Le terrain est à vous.' }],
  medias: [{ title: 'Un plateau s’est libéré', blurb: 'Un invité s’est désisté jeudi soir. La production vous appelle en premier.' }, { title: 'Une polémique à commenter', blurb: 'Tout le monde en parle ; il manque une voix comme la vôtre.' }],
  dossiers: [{ title: 'Un rapport tombe à pic', blurb: 'Un rapport parlementaire sort cette semaine : de quoi nourrir votre travail.' }, { title: 'Un expert disponible', blurb: 'Un universitaire reconnu accepte de vous briefer gratuitement.' }],
  parti: [{ title: 'Le bureau national se réunit', blurb: 'Une prise de parole bien placée pèserait lourd.' }, { title: 'Les militants s’impatientent', blurb: 'Ils attendent un signe : c’est le moment de le leur donner.' }],
  reseau: [{ title: 'Une place à un dîner', blurb: 'Un dîner en ville a un couvert libre, et vous savez qui sera là.' }, { title: 'Un cocktail d’ambassade', blurb: 'Tout le Paris qui compte sera dans les salons.' }],
  fonction: [{ title: 'Une fenêtre d’agenda', blurb: 'Une réunion annulée vous libère une demi-journée utile.' }],
  territoire: [{ title: 'Une inauguration à prendre', blurb: 'Le maire voisin est malade : on vous propose de couper le ruban.' }],
  elysee: [{ title: 'Un sommet improvisé', blurb: 'Les partenaires sont disponibles cette semaine : tout peut s’accélérer.' }],
  international: [{ title: 'Un voyage s’organise', blurb: 'Une délégation part la semaine prochaine ; il reste un siège.' }],
  intrigue: [{ title: 'Une faille chez l’adversaire', blurb: 'Le camp d’en face se déchire : le moment est idéal pour avancer vos pions.' }],
  couronne: [{ title: 'Un salon royaliste', blurb: 'Les vieilles familles se réunissent : on parlera de vous.' }],
  loge: [{ title: 'Une tenue exceptionnelle', blurb: 'Les frères les plus influents seront tous là.' }],
  administration: [{ title: 'Un dossier débloqué', blurb: 'Un haut fonctionnaire vous doit un service.' }],
};

function drawOccasions(d: GameState, unlocked: ActionDefinition[], hand: ActionDefinition[], rng: Rng): Occasion[] {
  const pool = unlocked.filter(a => HAND_CATEGORIES.has(a.category) && !a.minigame);
  if (!pool.length) return [];
  const out: Occasion[] = [];
  const season = SEASON[monthIndex(d.week)]?.[0];
  // L'occasion de saison, puis une occasion d'actualité (de préférence hors de la main)
  if (season) {
    const l = pool.filter(a => season.cats.includes(a.category));
    if (l.length) { const a = rng.pick(l); out.push({ actionId: a.id, title: season.title, blurb: season.blurb }); }
  }
  const handIds = new Set(hand.map(a => a.id));
  const rest = pool.filter(a => !out.some(o => o.actionId === a.id));
  const l2 = rest.filter(a => !handIds.has(a.id));
  const a2 = rng.pick(l2.length ? l2 : rest);
  if (a2) {
    const hooks = CAT_HOOKS[a2.category] ?? [{ title: 'Une occasion à saisir', blurb: 'Les planètes sont alignées ce mois-ci.' }];
    const h = rng.pick(hooks);
    out.push({ actionId: a2.id, title: h.title, blurb: h.blurb });
  }
  return out.slice(0, 2);
}

/** Cette action est-elle une occasion du mois ? */
export function occasionOf(d: GameState, actionId: string): Occasion | null {
  const h = d.agendaHand;
  return h && h.week === d.week ? h.occasions.find(o => o.actionId === actionId) ?? null : null;
}

/** L'action est-elle jouable ce mois-ci (main, occasion, ou catégorie toujours ouverte) ? */
export function inHand(d: GameState, a: ActionDefinition): boolean {
  if (!HAND_CATEGORIES.has(a.category)) return true;
  const h = d.agendaHand;
  if (!h || h.week !== d.week) return true;
  return h.ids.includes(a.id) || h.occasions.some(o => o.actionId === a.id);
}

/* ── Les combos ───────────────────────────────────────────── */

export interface PlannedLite { action: ActionDefinition; domain?: Domain; occasion: boolean }
export interface Combo {
  id: string;
  icon: string;
  label: string;
  /** Comment l'obtenir (affiché dans l'agenda) */
  how: string;
  effects: Effect[];
  /** Avancement : nombre d'éléments réunis / nécessaires */
  check: (plan: PlannedLite[]) => { done: number; need: number };
}

const st = (stat: 'popularity' | 'credibility' | 'influence' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
/** Une action de la catégorie A suivie (plus tard dans le mois) d'une action de la catégorie B */
function then(plan: PlannedLite[], a: (p: PlannedLite) => boolean, b: (p: PlannedLite, first: PlannedLite) => boolean): { done: number; need: number } {
  const i = plan.findIndex(a);
  if (i < 0) return { done: 0, need: 2 };
  return { done: plan.slice(i + 1).some(p => b(p, plan[i])) ? 2 : 1, need: 2 };
}
const cat = (c: string) => (p: PlannedLite) => p.action.category === c;

export const COMBOS: Combo[] = [
  { id: 'expert', icon: '🎓', label: 'L’expert à l’antenne', how: 'Un dossier, puis un passage dans les médias', effects: [st('credibility', 3), { kind: 'momentum', delta: 2 }],
    check: plan => then(plan, cat('dossiers'), p => p.action.category === 'medias') },
  { id: 'photo', icon: '📸', label: 'La photo qui tourne', how: 'Du terrain, puis les médias', effects: [st('popularity', 2), { kind: 'segment', segment: 'jeunes', delta: 1 }],
    check: plan => then(plan, cat('terrain'), p => p.action.category === 'medias') },
  { id: 'maillage', icon: '🕸️', label: 'Le maillage', how: 'Le parti, puis le réseau', effects: [st('politicalCapital', 5), st('influence', 1)],
    check: plan => then(plan, cat('parti'), p => p.action.category === 'reseau') },
  { id: 'tournee', icon: '🚐', label: 'La tournée', how: 'Trois actions de terrain différentes', effects: [st('popularity', 2), { kind: 'segment', segment: 'ruraux', delta: 2 }, { kind: 'segment', segment: 'populaires', delta: 1 }],
    check: plan => ({ done: Math.min(3, new Set(plan.filter(p => p.action.category === 'terrain' || p.action.category === 'territoire').map(p => p.action.id)).size), need: 3 }) },
  { id: 'fond', icon: '📚', label: 'Le travail de fond', how: 'Deux dossiers sur le même sujet', effects: [st('credibility', 2), { kind: 'dossier', domain: '$domain', delta: 3 }],
    check: plan => { const doms = plan.filter(p => p.action.category === 'dossiers' && p.domain).map(p => p.domain); return { done: doms.some((x, i) => doms.indexOf(x) !== i) ? 2 : Math.min(1, doms.length), need: 2 }; } },
  { id: 'stature', icon: '🌍', label: 'La stature', how: 'L’international, puis les médias', effects: [st('influence', 3), st('credibility', 1)],
    check: plan => then(plan, cat('international'), p => p.action.category === 'medias') },
  { id: 'ombre', icon: '🕶️', label: 'Dans l’ombre', how: 'Une intrigue, puis le réseau', effects: [st('influence', 2), { kind: 'exposure', delta: -3 }],
    check: plan => then(plan, cat('intrigue'), p => p.action.category === 'reseau') },
  { id: 'actu', icon: '⏳', label: 'Surfer sur l’actu', how: 'Une occasion du mois, puis les médias', effects: [{ kind: 'momentum', delta: 4 }, st('popularity', 1)],
    check: plan => then(plan, p => p.occasion, p => p.action.category === 'medias' && !p.occasion) },
  { id: 'equilibre', icon: '⚖️', label: 'L’agenda équilibré', how: 'Quatre familles d’actions différentes', effects: [st('credibility', 1), st('stress', -4)],
    check: plan => ({ done: Math.min(4, new Set(plan.map(p => p.action.category).filter(c => HAND_CATEGORIES.has(c))).size), need: 4 }) },
  { id: 'souffle', icon: '🌿', label: 'Reprendre son souffle', how: 'Du repos, puis du terrain', effects: [st('energy', 4)],
    check: plan => then(plan, p => p.action.category === 'repos' || p.action.category === 'sante', p => p.action.category === 'terrain') },
];

/** Les combos réunis par un plan (dans l'ordre du plan) */
export function combosOf(plan: PlannedLite[]): Combo[] {
  return COMBOS.filter(c => { const r = c.check(plan); return r.done >= r.need; });
}

export function liteFromPlan(d: GameState, plan: { actionId: string; domain?: Domain }[]): PlannedLite[] {
  const seen = new Set<string>();
  return plan.map(p => {
    const action = ACTIONS_BY_ID.get(p.actionId)!;
    const occ = !!occasionOf(d, p.actionId) && !seen.has(p.actionId);
    seen.add(p.actionId);
    return { action, domain: p.domain, occasion: occ };
  }).filter(p => !!p.action);
}

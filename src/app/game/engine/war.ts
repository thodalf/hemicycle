import { Decision, Effect, GameState, Tone, WarState } from '../models/game.models';
import { RANKS } from '../data/ranks';
import { PARTNERS_BY_ID } from './intl';
import { addMilestone } from './life';
import { applyEffects, pushNews } from './effects';
import { scheduleWarVote } from './assembly';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  La guerre : déclarée par le président, le Premier ministre
 *  ou un ministre régalien, autorisée par le Parlement
 *  (article 35), elle se joue mois après mois sur une ligne de
 *  front. L'opinion s'use avec les pertes ; la victoire, la
 *  défaite ou un cessez-le-feu y mettent fin.
 *  Les adversaires sont des États fictifs.
 * ============================================================ */

export interface EnemyDef {
  id: string;
  name: string;
  /** « contre la Karstanie » */
  against: string;
  /** « la Karstanie », « le Kantor » */
  the: string;
  /** « de la Karstanie », « du Kantor » */
  of: string;
  /** Force militaire relative (0-1) */
  strength: number;
  casus: string;
}

export const ENEMIES: EnemyDef[] = [
  { id: 'karstanie', name: 'Karstanie', the: 'la Karstanie', of: 'de la Karstanie', against: 'contre la Karstanie', strength: 0.55, casus: 'Les blindés karstes ont franchi la frontière de la Valdovie, pays ami lié à la France par un traité de défense.' },
  { id: 'meridia', name: 'Méridia', the: 'la Méridia', of: 'de la Méridia', against: 'contre la Méridia', strength: 0.5, casus: 'La marine méridienne bloque le détroit et arraisonne des cargos battant pavillon français.' },
  { id: 'kantor', name: 'Kantor', the: 'le Kantor', of: 'du Kantor', against: 'contre la junte du Kantor', strength: 0.38, casus: 'La junte du Kantor retient en otage quarante ressortissants français.' },
  { id: 'zamerie', name: 'Zamérie', the: 'la Zamérie', of: 'de la Zamérie', against: 'contre le régime zamérien', strength: 0.33, casus: 'Le régime zamérien bombarde ses propres villes et menace la base française de Port-Aurore.' },
  { id: 'valdovie', name: 'Valdovie', the: 'la Valdovie', of: 'de la Valdovie', against: 'contre la Valdovie', strength: 0.45, casus: 'Les services valdoves ont orchestré une cyberattaque qui a paralysé quinze hôpitaux français.' },
];
export const ENEMIES_BY_ID = new Map(ENEMIES.map(e => [e.id, e]));

/* ── Les États hostiles : relations, menaces, invasion ─────── */

/** Relations de départ avec les États fictifs */
export const HOSTILE_START: Record<string, number> = { karstanie: -35, meridia: -20, kantor: -40, zamerie: -30, valdovie: -10 };
/** Sous ce seuil, l'État peut attaquer la France */
export const INVASION_THRESHOLD = -80;
export const THREAT_THRESHOLD = -65;

export function initHostile(): Record<string, number> {
  return { ...HOSTILE_START };
}

/** Quand c'est la France qu'on attaque */
/** « la Karstanie » / « le Kantor » */
export const theEnemy = (id: string) => ENEMIES_BY_ID.get(id)?.the ?? id;
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const INVASION: Record<string, string> = {
  karstanie: 'À l’aube, des missiles karstes ont frappé nos bases aériennes de l’Est. Des colonnes blindées franchissent la frontière.',
  meridia: 'La flotte méridienne bombarde nos ports de Méditerranée et débarque des troupes sur les côtes corses.',
  kantor: 'Des commandos du Kantor s’emparent de Port-Aurore et frappent nos territoires d’outre-mer.',
  zamerie: 'Des essaims de drones zamériens s’abattent sur nos gares et nos centrales. Le régime déclare la guerre à la France.',
  valdovie: 'Après des mois de cyberattaques, la Valdovie déclare la guerre à la France et frappe nos réseaux électriques.',
};

export function hostileLabel(v: number): string {
  if (v <= INVASION_THRESHOLD) return 'Au bord de la guerre';
  if (v <= THREAT_THRESHOLD) return 'Menaçant';
  if (v <= -30) return 'Hostile';
  if (v <= 0) return 'Méfiant';
  return 'Apaisé';
}

/** Effet « hostile » : réchauffer ou dégrader les relations avec un État fictif */
export function adjustHostile(d: GameState, e: Extract<Effect, { kind: 'hostile' }>, targetId: string | undefined): string[] {
  d.intl.hostile ??= initHostile();
  const h = d.intl.hostile;
  const ids = e.enemy === 'all' ? Object.keys(h) : [e.enemy === '$target' ? targetId ?? '' : e.enemy === '$war' ? d.war?.enemyId ?? '' : e.enemy];
  const out: string[] = [];
  for (const id of ids) {
    if (h[id] === undefined) continue;
    h[id] = clamp(h[id] + e.delta, -100, 100);
    if (e.enemy !== 'all') out.push(`Relations avec ${theEnemy(id)} ${e.delta > 0 ? '+' : ''}${e.delta}`);
  }
  if (e.enemy === 'all') out.push(`Relations avec les États hostiles ${e.delta > 0 ? '+' : ''}${e.delta}`);
  return out;
}

/** Un mois de relations avec les États hostiles : menaces, puis invasion */
export function monthlyHostile(d: GameState, rng: Rng): void {
  d.intl.hostile ??= initHostile();
  const h = d.intl.hostile;
  const tension = d.intl.tension;
  for (const id of Object.keys(h)) {
    if (d.war?.enemyId === id) continue;
    h[id] = clamp(h[id] + (HOSTILE_START[id] - h[id]) * 0.03 + rng.range(-2.5, 1.9) - clamp((tension - 50) * 0.02, 0, 0.6) - (d.intl.crisis ? 0.3 : 0), -100, 100);
  }
  // De temps à autre, un incident fait plonger une relation
  if (rng.chance(0.03)) {
    const ids = Object.keys(h).filter(id => d.war?.enemyId !== id);
    const id = rng.pick(ids);
    const drop = Math.round(rng.range(10, 22));
    h[id] = clamp(h[id] - drop, -100, 100);
    pushNews(d, 'actu', 'negative', `Incident diplomatique avec ${theEnemy(id)}`, rng.pick([
      'Un avion de surveillance abattu au-dessus des eaux internationales.',
      'Notre attaché militaire expulsé sous un prétexte grotesque.',
      'Un drapeau français brûlé devant notre ambassade, sous l’œil de la police.',
      'Des manœuvres navales à quelques milles de nos côtes.',
    ]) + ` Relations −${drop}.`);
  }
  if (d.war || d.status !== 'en_cours') return;
  const [worst, rel] = Object.entries(h).sort((a, b) => a[1] - b[1])[0];
  const enemy = ENEMIES_BY_ID.get(worst);
  if (!enemy) return;
  const p = d.player;
  // Les bruits de bottes : un avertissement, une fenêtre pour la diplomatie
  if (rel <= THREAT_THRESHOLD && d.week - Number(p.flags[`menace_${worst}`] ?? -99) >= 12) {
    p.flags[`menace_${worst}`] = d.week;
    pushNews(d, 'actu', 'negative', `Bruits de bottes : ${enemy.the}`, `Manœuvres militaires, discours martiaux, ambassade rappelée : ${enemy.the} menace la France. Sous ${INVASION_THRESHOLD}, elle pourrait passer à l’acte.`);
    if (leadsWar(d) && !d.pendingDecisions.some(x => x.tag === 'menace_etat')) d.pendingDecisions.push(threatDecision(d, worst));
  }
  const last = Number(p.flags['lastWar'] ?? -99);
  if (rel <= INVASION_THRESHOLD && d.week - last >= 18 && rng.chance(0.22)) startInvasion(d, worst);
}

function threatDecision(d: GameState, id: string): Decision {
  const e = ENEMIES_BY_ID.get(id)!;
  return {
    id: nextId(d, 'dec'), tag: 'menace_etat', week: d.week, deadlineWeek: d.week + 1, source: 'carriere',
    title: `${cap(e.the)} menace la France`,
    context: `Divisions massées aux frontières, ultimatum à demi-mot. L’état-major estime l’attaque possible dans les mois qui viennent.`,
    choices: [
      { id: 'dialogue', label: 'Ouvrir un canal de dialogue', effects: [{ kind: 'hostile', enemy: id, delta: 18 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
        risk: { baseChance: 0.25, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [{ kind: 'hostile', enemy: id, delta: -6 }, { kind: 'intl', prestige: -3 }], failureNews: 'Les émissaires sont éconduits : le régime prend la main tendue pour de la faiblesse.' },
        outcome: 'Des émissaires discrets partent ce soir.' },
      { id: 'dissuasion', label: 'Montrer la force : manœuvres et dissuasion', effects: [{ kind: 'hostile', enemy: id, delta: 8 }, { kind: 'intl', tension: 6, prestige: 2 }, { kind: 'flagAdd', key: 'warBoost', delta: 6 }],
        outcome: 'Porte-avions au large, Rafale en alerte : le message est reçu.' },
      { id: 'allies', label: 'Rallier les alliés derrière la France', effects: [{ kind: 'hostile', enemy: id, delta: 6 }, { kind: 'intl', allRelations: 3, prestige: 3 }, { kind: 'stat', stat: 'influence', delta: 2 }],
        outcome: 'Déclaration commune à Bruxelles : toute agression contre la France sera une agression contre tous.' },
      { id: 'sanctions', label: 'Durcir le ton : sanctions', effects: [{ kind: 'hostile', enemy: id, delta: -10 }, { kind: 'intl', prestige: 3 }, { kind: 'stat', stat: 'popularity', delta: 2 }],
        outcome: 'Avoirs gelés, ambassadeur expulsé. Le régime promet des représailles.' },
    ],
  };
}

/** La France est attaquée : guerre défensive, sans vote préalable */
export function startInvasion(d: GameState, enemyId: string): void {
  if (d.war) return;
  startWar(d, enemyId, true, { defensive: true });
}

/** Guerre totale : mobilisation générale, économie de guerre, toute la Nation engagée */
export function declareTotal(d: GameState, byEnemy = false): string[] {
  const w = d.war;
  if (!w || w.total) return [];
  w.total = true;
  w.effort = clamp((w.effort ?? 40) + 25);
  w.morale = clamp((w.morale ?? 60) - 8);
  d.intl.tension = clamp(d.intl.tension + 20);
  log(d, byEnemy ? `${cap(theEnemy(w.enemyId))} décrète la mobilisation générale : c’est la guerre totale.` : 'Mobilisation générale : la France entre en guerre totale.', 'negative');
  addMilestone(d, 'carriere', 'La guerre totale', `${byEnemy ? `${cap(theEnemy(w.enemyId))} a choisi l’escalade.` : 'Vous avez choisi l’escalade.'} Mobilisation générale, économie de guerre, couvre-feu : toute la Nation est engagée.`);
  pushNews(d, 'actu', 'negative', 'Mobilisation générale', 'Les usines tournent pour l’armée, les réservistes sont rappelés, le couvre-feu tombe sur les grandes villes. Nouveaux gestes dans les onglets Guerre et Effort de guerre.');
  return ['Guerre totale'];
}

/** Qui peut mener la guerre : président·e, Premier·e ministre, ministres régaliens */
export function leadsWar(d: GameState): boolean {
  const r = d.player.rankId;
  return !!d.presidency || r === 'premier_ministre' || (r === 'ministre' && (d.portfolio === 'diplomatie' || d.portfolio === 'securite'));
}

/** Raison pour laquelle on ne peut pas déclarer la guerre (null : possible) */
export function warPowerBlock(d: GameState): string | null {
  if (d.war) return 'Le pays est déjà en guerre';
  if (d.vote?.warEnemy) return 'Le Parlement délibère déjà';
  if (!leadsWar(d)) {
    return d.player.rankId === 'ministre'
      ? 'Seuls les ministres régaliens (Affaires étrangères, Intérieur) portent une déclaration de guerre'
      : 'Réservé au président, au Premier ministre et aux ministres régaliens';
  }
  if (d.presidency?.cohabitation) return 'En cohabitation, la majorité ne vous suivra pas';
  const last = Number(d.player.flags['lastWar'] ?? -99);
  if (d.week - last < 24) return 'Le pays se remet à peine de la dernière guerre';
  if (d.intl.tension < 35 && !d.intl.crisis) return 'Aucun casus belli : tensions internationales sous 35';
  return null;
}

/** Puissance de nos armées et de nos alliés, comparée à celle de l'ennemi */
export function warBalance(d: GameState): number {
  const w = d.war;
  if (!w) return 0;
  // Effort de guerre, moral de l'arrière, et l'avantage de se battre chez soi
  return baseBalance(d) + (w.effort !== undefined ? (w.effort - 40) / 400 : 0) + (w.morale !== undefined ? (w.morale - 50) / 500 : 0)
    + (w.defensive ? 0.05 : 0);
}

function baseBalance(d: GameState): number {
  const w = d.war;
  if (!w) return 0;
  const enemy = ENEMIES_BY_ID.get(w.enemyId)?.strength ?? 0.45;
  const nb = d.nationalBudget;
  const defense = nb ? (nb.draft.missions.defense ?? 0) : 0;
  const budget = nb && defense ? clamp((defense / 50 - 1) * 0.3, -0.1, 0.12) : 0;
  const ours = 0.5 + (d.intl.prestige - 40) / 250 + w.allies.length * 0.06 + (d.player.staff.includes('sherpa') ? 0.04 : 0)
    + budget + Number(d.player.flags['warBoost'] ?? 0) / 100;
  return ours - enemy;
}

export function startWar(d: GameState, enemyId: string, authorized: boolean, opts: { defensive?: boolean; total?: boolean } = {}): void {
  const e = ENEMIES_BY_ID.get(enemyId) ?? ENEMIES[0];
  const defensive = !!opts.defensive;
  const w: WarState = {
    enemyId: e.id, enemy: e.name, against: e.against, casus: defensive ? INVASION[e.id] ?? e.casus : e.casus, since: d.week,
    front: defensive ? 46 : 50, support: defensive ? 80 : clamp(52 + d.intl.tension / 5), losses: 0, cost: 0, allies: [], authorized, log: [],
    effort: 40, morale: defensive ? 72 : 60, ...(defensive ? { defensive: true } : {}),
  };
  d.war = w;
  log(d, defensive ? `${cap(e.the)} attaque la France.` : `Entrée en guerre ${e.against}.`, defensive ? 'negative' : 'neutral');
  d.intl.tension = clamp(d.intl.tension + 15);
  d.agendaDomain = 'diplomatie';
  d.agendaLockedUntil = d.week + 3;
  const p = d.player;
  p.stats.stress = clamp(p.stats.stress + 10);
  p.flags['menace'] = Number(p.flags['menace'] ?? 0) + 10;
  // L'union sacrée, au début
  if (d.presidency) d.presidency.approval = clamp(d.presidency.approval + 6);
  p.stats.popularity = clamp(p.stats.popularity + 3);
  if (defensive) {
    // L'union sacrée, sans vote : le Parlement est informé (article 35)
    if (d.presidency) d.presidency.approval = clamp(d.presidency.approval + 6);
    addMilestone(d, 'carriere', `${cap(e.the)} attaque la France`, w.casus);
    pushNews(d, 'actu', 'negative', `Guerre : ${e.the} attaque la France`, `${w.casus} ${leadsWar(d) ? 'Conseil de défense dans une heure. Onglet Guerre ouvert.' : 'Le pays se dresse : onglet Effort de guerre ouvert.'}`);
  } else {
    addMilestone(d, 'carriere', `Entrée en guerre ${e.against}`, e.casus);
    pushNews(d, 'actu', 'negative', `La France entre en guerre ${e.against}`, `${e.casus} Les armées sont engagées.`);
  }
  if (opts.total) declareTotal(d);
}

function log(d: GameState, text: string, tone: Tone): void {
  if (!d.war) return;
  d.war.log.unshift({ week: d.week, text, front: Math.round(d.war.front), tone });
  if (d.war.log.length > 18) d.war.log.length = 18;
}

const ADVANCE = [
  'Nos troupes enfoncent les lignes ennemies et libèrent plusieurs villes.',
  'Une percée de nos blindés surprend l’état-major adverse.',
  'L’aviation détruit les dépôts de munitions de l’ennemi.',
  'Des milliers de soldats ennemis se rendent.',
];
const HOLD = [
  'Le front se fige. Les deux armées s’enterrent.',
  'Duels d’artillerie sans résultat décisif.',
  'Une offensive de part et d’autre, pour quelques kilomètres.',
];
const RETREAT = [
  'Contre-offensive ennemie : nos unités reculent.',
  'Une embuscade décime un bataillon. Le pays est sous le choc.',
  'L’ennemi reprend une ville stratégique.',
  'Nos lignes de ravitaillement sont coupées.',
];

function gauss(rng: Rng): number {
  const u = Math.max(1e-9, rng.next()), v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Un mois de guerre */
export function monthlyWar(d: GameState, rng: Rng): void {
  const w = d.war;
  if (!w || d.status !== 'en_cours') return;
  const before = w.front;
  // Plus on avance, plus l'ennemi se défend âprement (et inversement)
  const resistance = (w.front - 50) * 0.06;
  const counter = rng.chance(0.18 + Math.max(0, -warBalance(d))) ? -rng.range(4, 9) : 0;
  const months0 = d.week - w.since;
  // L'agresseur a l'initiative les premiers mois
  const initiative = w.defensive && months0 < 3 ? -2 : 0;
  const scale = w.total ? 1.4 : 1;
  const drift = warBalance(d) * 10 * scale + gauss(rng) * 6 * scale - resistance + counter + initiative;
  w.front = clamp(w.front + drift);
  const move = w.front - before;
  const dead = Math.round((25 + Math.abs(move) * 4) * rng.range(0.6, 1.4) * (move < 0 ? 1.6 : 1) * (w.total ? 2.5 : 1));
  w.losses += dead;
  w.cost = Math.round((w.cost + rng.range(1, 1.8) * (w.total ? 2.2 : 1)) * 10) / 10;
  const unity = w.defensive ? 1 : 0;
  w.support = clamp(w.support + move * 0.35 - 1.5 + unity - dead / (w.total ? 150 : 60) + (d.player.staff.includes('attache_presse') ? 0.5 : 0)
    + (w.morale !== undefined ? (w.morale - 50) * 0.02 : 0));
  // L'arrière : moral et effort de guerre
  if (w.morale !== undefined) {
    w.morale = clamp(w.morale - (w.total ? 2.2 : 0.8) + (move > 3 ? 2 : move < -3 ? -3 : 0) - dead / 500 + (w.defensive && w.front < 50 ? 0.6 : 0));
    w.effort = clamp((w.effort ?? 40) + ((w.total ? 60 : 40) - (w.effort ?? 40)) * 0.04);
    if (w.total) d.player.stats.stress = clamp(d.player.stats.stress + 1);
  }
  // Les renforts ponctuels s'épuisent
  d.player.flags['warBoost'] = Math.max(0, Number(d.player.flags['warBoost'] ?? 0) - 4);
  log(d, `${move > 3 ? rng.pick(ADVANCE) : move < -3 ? rng.pick(RETREAT) : rng.pick(HOLD)} ${dead} soldats tombés ce mois-ci.`, move > 3 ? 'positive' : move < -3 ? 'negative' : 'neutral');

  // L'opinion juge celui ou celle qui mène la guerre
  const p = d.player;
  const leads = leadsWar(d);
  if (d.presidency) {
    d.presidency.approval = clamp(d.presidency.approval + (w.support - 50) * 0.04);
    d.presidency.threat = clamp(d.presidency.threat + 0.8);
  } else if (leads) {
    p.stats.popularity = clamp(p.stats.popularity + (w.support - 50) * 0.03);
  }
  if (leads) p.stats.stress = clamp(p.stats.stress + 3);
  if (d.nationalBudget) d.nationalBudget.debtPenalty = Math.round((d.nationalBudget.debtPenalty + 0.15) * 100) / 100;

  if (w.front >= 100) { endWar(d, 'victoire', rng); return; }
  if (w.front <= 0) { endWar(d, 'defaite', rng); return; }
  if (w.total && (w.morale ?? 50) <= 0) {
    pushNews(d, 'actu', 'negative', 'L’arrière s’effondre', 'Grèves générales, mutineries, émeutes de la faim : le pays ne peut plus se battre.');
    endWar(d, 'defaite', rng);
    return;
  }
  // L'ennemi peut choisir l'escalade
  const rel = d.intl.hostile?.[w.enemyId] ?? -50;
  if (!w.total && months0 >= 3 && rel <= -90 && rng.chance(0.08)) {
    if (leads && !d.pendingDecisions.some(x => x.tag === 'escalade')) d.pendingDecisions.push(escalationDecision(d));
    else if (!leads) declareTotal(d, true);
  }
  // Sans vous aux commandes, le gouvernement cherche une sortie (pas quand le pays est envahi)
  if (!leads && d.week - w.since >= 6 && !(w.defensive && w.front < 50) && rng.chance(w.total ? 0.06 : 0.12)) { endWar(d, 'armistice', rng); return; }
  if (w.support < 15 && rng.chance(0.3)) {
    pushNews(d, 'actu', 'negative', 'Manifestations contre la guerre', 'Des centaines de milliers de personnes défilent : « Ramenez nos soldats ! »');
    if (d.presidency) d.presidency.majority = clamp(d.presidency.majority - 3);
    if (d.government) d.government.majority = clamp(d.government.majority - 3);
  }
  // Tous les six mois, l'état-major et le Parlement attendent un bilan
  const months = d.week - w.since;
  if (leads && months > 0 && months % 6 === 0 && !d.pendingDecisions.some(x => x.tag === 'guerre_bilan')) {
    d.pendingDecisions.push(warReview(d));
  }
}

function escalationDecision(d: GameState): Decision {
  const w = d.war!;
  return {
    id: nextId(d, 'dec'), tag: 'escalade', week: d.week, deadlineWeek: d.week, source: 'carriere',
    title: `${cap(theEnemy(w.enemyId))} décrète la mobilisation générale`,
    context: 'Le régime jette toutes ses forces dans la bataille : conscription, économie de guerre, frappes sur nos villes. L’état-major demande une réponse à la hauteur.',
    choices: [
      { id: 'totale', label: 'Répondre par la guerre totale', effects: [{ kind: 'war', total: true }, { kind: 'stat', stat: 'stress', delta: 8 }],
        outcome: 'Mobilisation générale. La France entière se met en guerre.' },
      { id: 'tenir', label: 'Refuser l’escalade, tenir les lignes', effects: [{ kind: 'war', support: -4, front: -3 }, { kind: 'stat', stat: 'credibility', delta: 2 }],
        outcome: 'Vous gardez une guerre limitée. L’ennemi, lui, ne se limite pas.' },
      { id: 'negocier', label: 'Proposer une trêve', effects: [{ kind: 'war', peace: true }],
        risk: { baseChance: 0.6, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [{ kind: 'war', support: -6, front: -4 }], failureNews: 'L’ennemi rejette la trêve et redouble ses frappes.' },
        outcome: 'Vos émissaires partent pour Genève.' },
    ],
  };
}

function warReview(d: GameState): Decision {
  const w = d.war!;
  const months = d.week - w.since;
  const ok = w.front >= 50;
  return {
    id: nextId(d, 'dec'), tag: 'guerre_bilan', week: d.week, deadlineWeek: d.week, source: 'carriere',
    title: `${months} mois de guerre ${w.against}`,
    context: `Front : ${Math.round(w.front)}/100 · ${w.losses.toLocaleString('fr-FR')} soldats tombés · ${w.cost.toLocaleString('fr-FR')} Md€ engagés · soutien de l’opinion ${Math.round(w.support)} %. ${ok ? 'L’état-major croit la victoire possible.' : 'L’état-major parle d’enlisement.'}`,
    choices: [
      { id: 'intensifier', label: 'Intensifier l’effort de guerre', effects: [{ kind: 'war', front: 5, losses: 300, support: -6 }, { kind: 'flagAdd', key: 'warBoost', delta: 10 }, { kind: 'stat', stat: 'stress', delta: 6 }],
        outcome: 'Mobilisation industrielle, nouveaux bataillons : la machine de guerre accélère.' },
      { id: 'tenir', label: 'Tenir la ligne, sans escalade', effects: [{ kind: 'war', support: 2 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
        outcome: 'Ni escalade ni recul. L’opinion apprécie la mesure.' },
      ...(w.total ? [] : [{ id: 'totale', label: 'Décréter la guerre totale', hint: 'Mobilisation générale : plus de forces, plus de pertes, le moral de l’arrière en jeu',
        effects: [{ kind: 'war', total: true } as Effect, { kind: 'stat', stat: 'stress', delta: 6 } as Effect], outcome: 'Mobilisation générale. Le pays bascule dans l’économie de guerre.' }]),
      { id: 'negocier', label: 'Ouvrir des négociations de paix', effects: [{ kind: 'war', peace: true }],
        risk: { baseChance: ok ? 0.25 : 0.5, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [{ kind: 'war', support: -5, front: -3 }], failureNews: 'L’ennemi se croit en position de force et rejette toute discussion.' },
        outcome: 'Les diplomates prennent le relais des généraux.' },
    ],
  };
}

export type WarEnd = 'victoire' | 'defaite' | 'armistice';

export function endWar(d: GameState, how: WarEnd, rng: Rng): string[] {
  const w = d.war;
  if (!w) return [];
  const p = d.player;
  const months = Math.max(1, d.week - w.since);
  const st = (stat: 'popularity' | 'influence' | 'credibility' | 'stress', delta: number): Effect => ({ kind: 'stat', stat, delta });
  const pres = (approval: number): Effect[] => (d.presidency ? [{ kind: 'presidency', approval }] : []);
  let effects: Effect[];
  let title: string;
  let text: string;
  let kind: 'victoire' | 'revers' | 'carriere' = 'carriere';
  const bilan = `${months} mois de guerre, ${w.losses.toLocaleString('fr-FR')} soldats tombés.`;
  const big = w.total ? 1.5 : 1;
  if (how === 'victoire') {
    effects = [st('popularity', 8 * big), st('influence', 8 * big), st('credibility', 6), st('stress', -10), { kind: 'intl', prestige: 20 * big, tension: -20 }, ...pres(12 * big)];
    title = w.defensive ? 'Libérateur·rice de la Nation' : w.total ? `La victoire totale ${w.against}` : `Vainqueur·e de la guerre ${w.against}`;
    text = w.defensive
      ? `Le dernier soldat ennemi repasse la frontière. ${bilan} Les cloches sonnent dans toute la France.`
      : `${cap(theEnemy(w.enemyId))} capitule${w.total ? ' sans conditions' : ''}. ${bilan} Défilé de la victoire sur les Champs-Élysées.`;
    kind = 'victoire';
  } else if (how === 'defaite') {
    effects = [st('popularity', -12 * big), st('influence', -8), st('credibility', -10), st('stress', 15), { kind: 'intl', prestige: -20 * big, tension: -5 }, ...pres(-20 * big)];
    title = w.defensive ? 'La capitulation' : w.total ? 'L’effondrement' : `Défaite militaire ${w.against}`;
    text = w.defensive
      ? `L’armistice est signé dans un wagon, sous les caméras ennemies. ${bilan} La France perd des territoires et son honneur.`
      : `Nos troupes se replient en désordre. ${bilan} Le pays exige des comptes.`;
    kind = 'revers';
  } else if (w.front >= 60) {
    effects = [st('popularity', 4), st('influence', 5), st('credibility', 4), st('stress', -8), { kind: 'intl', prestige: 8, tension: -15 }, ...pres(5)];
    title = `Une paix victorieuse ${w.against.replace('contre', 'avec')}`;
    text = `L’ennemi cède l’essentiel à la table des négociations. ${bilan}`;
  } else if (w.front >= 40) {
    effects = [st('popularity', 1), st('credibility', 2), st('stress', -8), { kind: 'intl', prestige: 2, tension: -12 }, ...pres(1)];
    title = `Une paix de compromis ${w.against.replace('contre', 'avec')}`;
    text = `Chacun garde ses positions. ${bilan} Était-ce bien la peine ?`;
  } else {
    effects = [st('popularity', -5), st('credibility', -5), st('stress', -4), { kind: 'intl', prestige: -8, tension: -10 }, ...pres(-6)];
    title = `Une paix humiliante ${w.against.replace('contre', 'avec')}`;
    text = `Vous signez sous la pression de l’ennemi. ${bilan}`;
    kind = 'revers';
  }
  // Vous n'êtes plus aux commandes : la guerre se termine sans vous
  if (!leadsWar(d)) {
    d.war = null;
    p.flags['lastWar'] = d.week;
    calmAfterWar(d, w.enemyId, how);
    const intl = effects.filter(e => e.kind === 'intl');
    applyEffects(d, intl, {}, rng);
    pushNews(d, 'actu', how === 'defaite' ? 'negative' : 'neutral', title.replace('Vainqueur·e de la guerre', 'Victoire dans la guerre'), text);
    return [title];
  }
  d.war = null;
  p.flags['lastWar'] = d.week;
  p.flags['warBoost'] = 0;
  calmAfterWar(d, w.enemyId, how);
  // Scénarios de guerre : la victoire ou la défaite fait le grand chapitre
  if ((d.scenario === 'invasion' || d.scenario === 'guerre_totale') && (how === 'victoire' || how === 'defaite') && !p.flags['warScenarioDone']) {
    p.flags['warScenarioDone'] = true;
    applyEffects(d, effects, {}, rng);
    d.status = how === 'victoire' ? 'victoire' : 'defaite';
    d.endTitle = title;
    d.endReason = text;
    return [title];
  }
  p.flags['warLosses'] = Number(p.flags['warLosses'] ?? 0) + w.losses;
  if (d.nationalBudget) d.nationalBudget.debtPenalty = Math.round((d.nationalBudget.debtPenalty + w.cost * 0.2) * 10) / 10;
  const summary = applyEffects(d, effects, {}, rng);
  addMilestone(d, kind, title, text);
  pushNews(d, 'actu', how === 'defaite' ? 'negative' : 'positive', title, text);
  // Une défaite emporte le gouvernement
  if (how === 'defaite') {
    if (p.rankId === 'premier_ministre') applyEffects(d, [{ kind: 'government', fall: true }], {}, rng);
    else if (p.rankId === 'ministre') {
      p.rankId = 'depute';
      p.actionPoints.max = RANKS.depute.monthlyActionPoints;
      pushNews(d, 'parti', 'negative', 'Vous quittez le gouvernement', 'La défaite vous est imputée : retour sur les bancs de l’Assemblée.');
    }
  }
  return [title, ...summary];
}

/** Après la guerre, les relations repartent de loin */
function calmAfterWar(d: GameState, enemyId: string, how: WarEnd): void {
  d.intl.hostile ??= initHostile();
  d.intl.hostile[enemyId] = how === 'victoire' ? -15 : how === 'defaite' ? -45 : -35;
}

/** Effet « war » : déclarer, peser sur le front, rallier un allié, faire la paix */
export function adjustWar(d: GameState, e: Extract<Effect, { kind: 'war' }>, targetId: string | undefined, rng: Rng): string[] {
  const out: string[] = [];
  if (e.declare) {
    const enemy = e.declare === '$target' ? targetId : e.declare;
    if (enemy && !d.war) out.push(...scheduleWarVote(d, enemy, rng));
    return out;
  }
  if (e.invade) {
    const enemy = e.invade === 'worst' ? Object.entries(d.intl.hostile ?? initHostile()).sort((a, b) => a[1] - b[1])[0][0] : e.invade;
    if (!d.war) { startInvasion(d, enemy); out.push(`Guerre : ${theEnemy(enemy)} attaque`); }
    return out;
  }
  const w = d.war;
  if (!w) return out;
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  if (e.total) out.push(...declareTotal(d));
  if (e.effort && w.effort !== undefined) { w.effort = clamp(w.effort + e.effort); out.push(`Effort de guerre ${sign(e.effort)}`); }
  if (e.morale && w.morale !== undefined) { w.morale = clamp(w.morale + e.morale); out.push(`Moral de l’arrière ${sign(e.morale)}`); }
  if (e.front) {
    const before = w.front;
    w.front = clamp(w.front + e.front);
    out.push(`Front ${sign(Math.round(w.front - before))}`);
  }
  if (e.losses) { w.losses += e.losses; out.push(`${e.losses} soldats tombés`); }
  if (e.support) { w.support = clamp(w.support + e.support); out.push(`Soutien à la guerre ${sign(e.support)}`); }
  if (e.ally) {
    const id = e.ally === '$target' ? targetId : e.ally;
    const partner = id ? PARTNERS_BY_ID.get(id) : undefined;
    const rel = id ? d.intl.relations[id] ?? 0 : 0;
    if (partner && !w.allies.includes(partner.id)) {
      const chance = clamp(0.15 + rel / 100 + (d.player.staff.includes('sherpa') ? 0.15 : 0), 0.05, 0.95);
      if (rng.chance(chance)) {
        w.allies.push(partner.id);
        d.intl.relations[partner.id] = clamp(rel + 5, -100, 100);
        out.push(`${partner.name} entre en guerre à vos côtés`);
        log(d, `${partner.name} se range à nos côtés.`, 'positive');
      } else {
        d.intl.relations[partner.id] = clamp(rel - 6, -100, 100);
        out.push(`${partner.name} refuse de s’engager`);
      }
    }
  }
  if (e.peace) out.push(...endWar(d, 'armistice', rng));
  else if (w.front >= 100) out.push(...endWar(d, 'victoire', rng));
  else if (w.front <= 0) out.push(...endWar(d, 'defaite', rng));
  return out;
}

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
  /** Force militaire relative (0-1) */
  strength: number;
  casus: string;
}

export const ENEMIES: EnemyDef[] = [
  { id: 'karstanie', name: 'Karstanie', against: 'contre la Karstanie', strength: 0.55, casus: 'Les blindés karstes ont franchi la frontière de la Valdovie, pays ami lié à la France par un traité de défense.' },
  { id: 'meridia', name: 'Méridia', against: 'contre la Méridia', strength: 0.5, casus: 'La marine méridienne bloque le détroit et arraisonne des cargos battant pavillon français.' },
  { id: 'kantor', name: 'Kantor', against: 'contre la junte du Kantor', strength: 0.38, casus: 'La junte du Kantor retient en otage quarante ressortissants français.' },
  { id: 'zamerie', name: 'Zamérie', against: 'contre le régime zamérien', strength: 0.33, casus: 'Le régime zamérien bombarde ses propres villes et menace la base française de Port-Aurore.' },
  { id: 'valdovie', name: 'Valdovie', against: 'contre la Valdovie', strength: 0.45, casus: 'Les services valdoves ont orchestré une cyberattaque qui a paralysé quinze hôpitaux français.' },
];
export const ENEMIES_BY_ID = new Map(ENEMIES.map(e => [e.id, e]));

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
  const enemy = ENEMIES_BY_ID.get(w.enemyId)?.strength ?? 0.45;
  const nb = d.nationalBudget;
  const defense = nb ? (nb.draft.missions.defense ?? 0) : 0;
  const budget = nb && defense ? clamp((defense / 50 - 1) * 0.3, -0.1, 0.12) : 0;
  const ours = 0.5 + (d.intl.prestige - 40) / 250 + w.allies.length * 0.06 + (d.player.staff.includes('sherpa') ? 0.04 : 0)
    + budget + Number(d.player.flags['warBoost'] ?? 0) / 100;
  return ours - enemy;
}

export function startWar(d: GameState, enemyId: string, authorized: boolean): void {
  const e = ENEMIES_BY_ID.get(enemyId) ?? ENEMIES[0];
  const w: WarState = {
    enemyId: e.id, enemy: e.name, against: e.against, casus: e.casus, since: d.week,
    front: 50, support: clamp(52 + d.intl.tension / 5), losses: 0, cost: 0, allies: [], authorized, log: [],
  };
  d.war = w;
  log(d, `Entrée en guerre ${e.against}.`, 'neutral');
  d.intl.tension = clamp(d.intl.tension + 15);
  d.agendaDomain = 'diplomatie';
  d.agendaLockedUntil = d.week + 3;
  const p = d.player;
  p.stats.stress = clamp(p.stats.stress + 10);
  p.flags['menace'] = Number(p.flags['menace'] ?? 0) + 10;
  // L'union sacrée, au début
  if (d.presidency) d.presidency.approval = clamp(d.presidency.approval + 6);
  p.stats.popularity = clamp(p.stats.popularity + 3);
  addMilestone(d, 'carriere', `Entrée en guerre ${e.against}`, e.casus);
  pushNews(d, 'actu', 'negative', `La France entre en guerre ${e.against}`, `${e.casus} Les armées sont engagées.`);
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
  const drift = warBalance(d) * 10 + gauss(rng) * 6 - resistance + counter;
  w.front = clamp(w.front + drift);
  const move = w.front - before;
  const dead = Math.round((25 + Math.abs(move) * 4) * rng.range(0.6, 1.4) * (move < 0 ? 1.6 : 1));
  w.losses += dead;
  w.cost = Math.round((w.cost + rng.range(1, 1.8)) * 10) / 10;
  w.support = clamp(w.support + move * 0.35 - 1.5 - dead / 60 + (d.player.staff.includes('attache_presse') ? 0.5 : 0));
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
  // Sans vous aux commandes, le gouvernement cherche une sortie
  if (!leads && d.week - w.since >= 6 && rng.chance(0.12)) { endWar(d, 'armistice', rng); return; }
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
  if (how === 'victoire') {
    effects = [st('popularity', 8), st('influence', 8), st('credibility', 6), st('stress', -10), { kind: 'intl', prestige: 20, tension: -20 }, ...pres(12)];
    title = `Vainqueur·e de la guerre ${w.against}`;
    text = `La ${w.enemy} capitule. ${bilan} Défilé de la victoire sur les Champs-Élysées.`;
    kind = 'victoire';
  } else if (how === 'defaite') {
    effects = [st('popularity', -12), st('influence', -8), st('credibility', -10), st('stress', 15), { kind: 'intl', prestige: -20, tension: -5 }, ...pres(-20)];
    title = `Défaite militaire ${w.against}`;
    text = `Nos troupes se replient en désordre. ${bilan} Le pays exige des comptes.`;
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
    const intl = effects.filter(e => e.kind === 'intl');
    applyEffects(d, intl, {}, rng);
    pushNews(d, 'actu', how === 'defaite' ? 'negative' : 'neutral', title.replace('Vainqueur·e de la guerre', 'Victoire dans la guerre'), text);
    return [title];
  }
  d.war = null;
  p.flags['lastWar'] = d.week;
  p.flags['warBoost'] = 0;
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

/** Effet « war » : déclarer, peser sur le front, rallier un allié, faire la paix */
export function adjustWar(d: GameState, e: Extract<Effect, { kind: 'war' }>, targetId: string | undefined, rng: Rng): string[] {
  const out: string[] = [];
  if (e.declare) {
    const enemy = e.declare === '$target' ? targetId : e.declare;
    if (enemy && !d.war) out.push(...scheduleWarVote(d, enemy, rng));
    return out;
  }
  const w = d.war;
  if (!w) return out;
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
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

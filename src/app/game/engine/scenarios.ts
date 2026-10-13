import { Effect, GameState } from '../models/game.models';
import { monthlyZombie } from './zombie';
import { createDecision } from '../data/decisions';
import { rankOrder } from '../data/ranks';
import { applyEffects, pushNews } from './effects';
import { Rng, clamp } from './rng';
import { weeklyPress } from './press';
import { weeklyMole } from './mole';
import { monthlyAlien } from './alien';

/* ============================================================
 *  Mécaniques propres aux scénarios « Retour à la royauté »
 *  et « Franc-maçon ».
 * ============================================================ */

export const GRADES = ['Apprenti·e', 'Compagnon', 'Maître', 'Vénérable Maître', 'Grand Maître'];

/** Conditions pour accéder au grade suivant (le dernier s'obtient au convent) */
export const GRADE_REQUIREMENTS: { planches: number; fraternite: number; influence?: number }[] = [
  { planches: 1, fraternite: 40 },
  { planches: 3, fraternite: 55 },
  { planches: 5, fraternite: 68, influence: 35 },
];

export function nextGradeReady(d: GameState): boolean {
  const l = d.lodge;
  if (!l || l.grade >= 3) return false;
  const r = GRADE_REQUIREMENTS[l.grade];
  return l.planches >= r.planches && l.fraternite >= r.fraternite && d.player.stats.influence >= (r.influence ?? 0);
}

const ROYAL_EVENTS: { title: string; body: string; soutien?: number; legitimite?: number; armee?: number }[] = [
  { title: 'Un sondage surprise', body: 'Un tiers des moins de 30 ans se dit « curieux » d’une monarchie constitutionnelle.', soutien: 3 },
  { title: 'Le prince sauve un enfant de la noyade', body: 'La vidéo fait le tour du monde.', soutien: 5, legitimite: 4 },
  { title: 'Un historien démonte la généalogie du prince', body: 'La légitimité dynastique est contestée.', legitimite: -7 },
  { title: 'Démission d’un général', body: 'Un général républicain claque la porte en dénonçant « l’infiltration royaliste ».', armee: -5, soutien: 1 },
  { title: 'Crise politique à l’Assemblée', body: 'Le blocage institutionnel profite aux partisans d’un arbitre au-dessus des partis.', soutien: 4 },
  { title: 'Une famille royale étrangère reçoit le prince', body: 'Une reconnaissance symbolique qui pèse.', legitimite: 5 },
];

export function weeklyScenario(d: GameState, rng: Rng): void {
  if (d.crown) weeklyCrown(d, rng);
  if (d.lodge) weeklyLodge(d, rng);
  if (d.press) weeklyPress(d, rng);
  if (d.mole) weeklyMole(d, rng);
  if (d.alien) monthlyAlien(d, rng);
  if (d.zombie) monthlyZombie(d, rng);
}

function weeklyCrown(d: GameState, rng: Rng): void {
  const c = d.crown!;
  c.soutien = clamp(c.soutien + (d.player.stats.popularity - 35) / 50);
  c.legitimite = clamp(c.legitimite - 0.4);
  c.armee = clamp(c.armee - 0.3);
  if (rng.chance(0.12)) {
    const ev = rng.pick(ROYAL_EVENTS);
    applyEffects(d, [{ kind: 'crown', soutien: ev.soutien, legitimite: ev.legitimite, armee: ev.armee }], {}, rng);
    pushNews(d, 'actu', (ev.soutien ?? 0) + (ev.legitimite ?? 0) + (ev.armee ?? 0) >= 0 ? 'positive' : 'negative', ev.title, ev.body);
  }
  // La République se défend quand le mouvement devient menaçant
  if (c.soutien > 30 && rng.chance(0.1)) {
    applyEffects(d, [{ kind: 'crown', soutien: -3, armee: -2 }, { kind: 'exposure', delta: 5 }], {}, rng);
    pushNews(d, 'actu', 'negative', 'La République contre-attaque', 'Le gouvernement dénonce une « menace contre nos institutions » et fait surveiller le mouvement.');
  }
}

function weeklyLodge(d: GameState, rng: Rng): void {
  const l = d.lodge!;
  l.fraternite = clamp(l.fraternite - 0.6);
  l.discretion = clamp(l.discretion + 0.5);
  // La loge ouvre des portes dès l'initiation : influence et capital politique chaque mois
  d.player.stats.influence = clamp(d.player.stats.influence + 0.2 + 0.15 * l.grade);
  d.player.stats.politicalCapital = clamp(d.player.stats.politicalCapital + 1 + l.grade * 0.5);
  // Un frère rend service : plus la fraternité est forte, plus c'est fréquent
  if (l.fraternite >= 35 && rng.chance(0.08 + l.fraternite / 600)) {
    const favor = rng.pick<{ title: string; text: string; effects: Effect[] }>([
      { title: 'Un frère vous rend service', text: 'Un frère banquier débloque un don pour votre compte de campagne.', effects: [{ kind: 'funds', account: 'campaign', delta: 2000 + l.grade * 1000 }] },
      { title: 'Un frère vous rend service', text: 'Un frère député vous promet sa voix et celles de deux amis sur votre prochain texte.', effects: [{ kind: 'flagAdd', key: 'billSupport', delta: 4 }, { kind: 'stat', stat: 'influence', delta: 1 }] },
      { title: 'Un frère vous rend service', text: 'Un frère journaliste vous consacre un portrait flatteur.', effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }] },
      { title: 'Un frère vous rend service', text: 'Un frère vous glisse le portable d’une personnalité qui compte.', effects: [{ kind: 'phoneBook', npcId: '$any' }] },
      { title: 'Un frère vous rend service', text: 'Un frère haut fonctionnaire vous ouvre un dossier sensible.', effects: [{ kind: 'dossier', domain: d.agendaDomain, delta: 4 }, { kind: 'stat', stat: 'credibility', delta: 1 }] },
    ]);
    const summary = applyEffects(d, favor.effects, {}, rng);
    pushNews(d, 'reseau', 'positive', favor.title, `${favor.text} ${summary.join(' · ')}`);
  }

  if (nextGradeReady(d)) {
    const decision = createDecision('elevation', d, rng, {});
    if (decision) d.pendingDecisions.push(decision);
  }
  const last = Number(d.player.flags['lastRevelation'] ?? -99);
  if (l.discretion <= 20 && d.week - last >= 4 && rng.chance(0.35)) {
    const decision = createDecision('revelation', d, rng, {});
    if (decision) {
      d.pendingDecisions.push(decision);
      d.player.flags['lastRevelation'] = d.week;
    }
  }
  if (l.grade >= 4 && rankOrder(d.player.rankId) >= rankOrder('ministre') && d.status === 'en_cours' && !d.milestones.some(m => m.title === 'Grand Maître et homme d’État')) {
    d.status = 'victoire';
    d.endTitle = 'Grand Maître et homme d’État';
    d.endReason = `Grand Maître de ${l.obedience} et ${d.player.rankId === 'president' ? 'chef de l’État' : 'membre du gouvernement'} : jamais personne n’avait réuni autant d’influence, visible et invisible.`;
  }
}

import { DOMAINS, Decision, DecisionChoice, Domain, Effect, GameState } from '../models/game.models';
import { RANKS } from '../data/ranks';
import { pushNews } from './effects';
import { addMilestone, dateOfWeek } from './life';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Le gouvernement : portefeuille ministériel, Matignon
 *  (former le gouvernement, majorité, motion de censure),
 *  et les rendez-vous annuels (Salon de l'agriculture).
 * ============================================================ */

export const MINISTRIES: Record<Domain, string> = {
  economie: 'de l’Économie et des Finances',
  social: 'du Travail et des Solidarités',
  ecologie: 'de la Transition écologique',
  securite: 'de l’Intérieur',
  justice: 'de la Justice',
  education: 'de l’Éducation nationale',
  sante: 'de la Santé',
  numerique: 'du Numérique',
  territoires: 'de l’Agriculture et des Territoires',
  diplomatie: 'des Affaires étrangères',
};

/** Intitulé complet de la fonction : « Ministre de la Santé », « Premier·e ministre »… */
export function roleLabel(d: GameState): string {
  if (d.player.rankId === 'ministre' && d.portfolio) return `Ministre ${MINISTRIES[d.portfolio]}`;
  if (d.alien && d.player.flags['hautCommissaire'] && ['depute', 'conseiller_municipal', 'militant'].includes(d.player.rankId)) return 'Haut-commissaire au Premier contact';
  return RANKS[d.player.rankId].label;
}

/** Le ministère confié : votre dossier le mieux maîtrisé */
export function assignPortfolio(d: GameState): void {
  d.portfolio = [...DOMAINS].sort((a, b) => d.player.dossiers[b].mastery - d.player.dossiers[a].mastery)[0];
  pushNews(d, 'actu', 'positive', `${d.player.name}, ministre ${MINISTRIES[d.portfolio]}`, 'Passation de pouvoirs demain matin. Votre cabinet vous attend.');
}

function decision(d: GameState, tag: string, title: string, context: string, choices: DecisionChoice[], deadline = 1): Decision {
  return { id: nextId(d, 'dec'), tag, week: d.week, deadlineWeek: d.week + deadline, source: 'carriere', title, context, choices };
}

const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
const gov = (x: Omit<Extract<Effect, { kind: 'government' }>, 'kind'>): Effect => ({ kind: 'government', ...x });

/** Matignon : nommer son gouvernement */
export function formationDecision(d: GameState, reshuffle = false): Decision {
  return decision(d, 'former_gouvernement', reshuffle ? 'Remanier le gouvernement' : 'Former le gouvernement',
    reshuffle ? 'Des ministres s’usent, d’autres intriguent. Un nouveau casting peut relancer votre action.'
      : 'La liste doit être sur le bureau du président ce soir. Chaque nom est un message envoyé au pays, à l’Assemblée et à votre parti.', [
      { id: 'ouverture', label: 'Un gouvernement d’ouverture', hint: 'Des ministres venus d’autres partis', effects: [gov({ form: 'd’ouverture', majority: 12, cohesion: -8 }), { kind: 'cohesion', delta: -6 }, { kind: 'faction', factionId: 'ligne_dure', delta: -8 }, st('influence', 3)],
        outcome: 'La presse salue l’audace ; votre parti hurle à la trahison.' },
      { id: 'fideles', label: 'Une équipe resserrée de fidèles', effects: [gov({ form: 'de fidèles', majority: -4, cohesion: 15 }), { kind: 'cohesion', delta: 4 }, st('credibility', -2)],
        outcome: 'Une équipe soudée… que l’on dit « de copains ».' },
      { id: 'courants', label: 'L’équilibre des courants du parti', effects: [gov({ form: 'd’équilibre', majority: 4, cohesion: -2 }), { kind: 'faction', factionId: '*', delta: 4 }, st('politicalCapital', -12)],
        outcome: 'Chaque courant a ses ministres. Les arbitrages seront longs.' },
      { id: 'experts', label: 'Un gouvernement d’experts', hint: 'Des technocrates sans étiquette', effects: [gov({ form: 'd’experts', majority: 2, cohesion: 6 }), st('credibility', 5), st('popularity', -3), { kind: 'faction', factionId: '*', delta: -3 }],
        outcome: 'Des CV impressionnants, des visages inconnus.' },
    ], 0);
}

/** Effet « government » */
export function adjustGovernment(d: GameState, e: Extract<Effect, { kind: 'government' }>): string[] {
  const g = d.government;
  if (!g) return [];
  const out: string[] = [];
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  if (e.form) { g.composition = e.form; out.push(`Gouvernement ${e.form}`); }
  if (e.majority) { g.majority = clamp(g.majority + e.majority); out.push(`Majorité ${sign(e.majority)}`); }
  if (e.cohesion) { g.cohesion = clamp(g.cohesion + e.cohesion); out.push(`Solidarité gouvernementale ${sign(e.cohesion)}`); }
  if (e.fall) {
    fallFromMatignon(d, 'Renversé·e par une motion de censure', 'L’Assemblée renverse votre gouvernement. Vous retrouvez votre siège de député·e.');
    out.push('Gouvernement renversé');
  }
  return out;
}

/** Quitter Matignon (censure, alternance, limogeage) */
export function fallFromMatignon(d: GameState, title: string, text: string): void {
  if (d.player.rankId !== 'premier_ministre') return;
  d.government = null;
  d.player.rankId = 'depute';
  d.player.actionPoints.max = RANKS.depute.monthlyActionPoints;
  d.player.actionPoints.current = Math.min(d.player.actionPoints.current, d.player.actionPoints.max);
  addMilestone(d, 'revers', title, text);
  pushNews(d, 'actu', 'negative', title, text);
}

/** Devenir Premier·e ministre */
export function enterMatignon(d: GameState): void {
  d.government = { since: d.week, majority: 50, cohesion: 60, composition: '' };
  d.portfolio = null;
  addMilestone(d, 'carriere', 'Premier·e ministre', `${d.player.name} entre à Matignon. Premier chantier : former le gouvernement.`);
  if (!d.pendingDecisions.some(x => x.tag === 'former_gouvernement')) d.pendingDecisions.push(formationDecision(d));
}

/** Mois : majorité, censure, rendez-vous annuels */
export function weeklyGovernment(d: GameState, rng: Rng): void {
  const p = d.player;
  // Cohérence du rang et de l'état
  if (p.rankId !== 'premier_ministre') d.government = null;
  if (p.rankId !== 'ministre') d.portfolio = null;
  else if (!d.portfolio) assignPortfolio(d);

  const g = d.government;
  if (g) {
    g.majority = clamp(g.majority + (44 + (p.stats.popularity - 40) * 0.3 + (g.cohesion - 50) * 0.1 - g.majority) * 0.04);
    g.cohesion = clamp(g.cohesion + (55 - g.cohesion) * 0.02 - (p.stats.stress > 70 ? 0.5 : 0));
    if (g.majority < 33 && !d.pendingDecisions.some(x => x.tag === 'pm_censure') && rng.chance(0.25)) {
      d.pendingDecisions.push(decision(d, 'pm_censure', 'Motion de censure contre votre gouvernement',
        `L’opposition a réuni les signatures. Il manque une poignée de voix pour vous renverser. Majorité estimée : ${Math.round(g.majority)} %.`, [
          { id: 'convaincre', label: 'Convaincre les indécis un par un', effects: [gov({ majority: 10 }), st('politicalCapital', -15), st('stress', 10)], outcome: 'La motion échoue à sept voix près.',
            risk: { baseChance: 0.55, scaleWith: 'influence', scaleWeight: 0.6, onFailure: [gov({ fall: true })], failureNews: 'La motion est adoptée. Votre gouvernement tombe.' } },
          { id: 'concession', label: 'Lâcher une réforme pour sauver le gouvernement', effects: [gov({ majority: 14, cohesion: -6 }), st('credibility', -6), { kind: 'faction', factionId: '*', delta: -3 }], outcome: 'Vous survivez, au prix d’un recul.' },
          { id: 'demission', label: 'Remettre votre démission au président', effects: [gov({ fall: true }), st('credibility', 3)], outcome: 'Vous partez avant d’être renversé·e.' },
        ]));
    }
  }

  // Salon de l'agriculture : fin février
  const date = dateOfWeek(d.week);
  const year = date.getFullYear();
  if (date.getMonth() === 1 && Number(p.flags['salonYear'] ?? 0) !== year && d.status === 'en_cours' && !p.flags['retired']) {
    p.flags['salonYear'] = year;
    d.pendingDecisions.push(salonDecision(d));
  }
}

function salonDecision(d: GameState): Decision {
  const big = !!d.presidency || ['ministre', 'premier_ministre', 'chef_parti', 'candidat_presidence'].includes(d.player.rankId);
  return decision(d, 'salon_agriculture', 'Le Salon de l’agriculture ouvre ses portes',
    big ? 'Porte de Versailles, 7 heures. Les éleveurs sont à cran, les caméras aussi. On vous attend : ne pas venir serait un affront.'
      : 'Le grand rendez-vous des campagnes à Paris. Une journée entière entre les vaches, les fromages et les colères paysannes.', [
      { id: 'journee', label: 'Y passer la journée entière', effects: [{ kind: 'scene', sceneId: 'salon_agriculture' }], outcome: 'Bottes aux pieds, vous voilà dans les allées.' },
      { id: 'eclair', label: 'Une visite éclair pour la photo', effects: [st('popularity', 1), st('credibility', -2), { kind: 'contact', contactId: 'ct-maires', trust: -2 }, st('energy', -5)], outcome: '« Venu·e pour la photo », grince un éleveur.' },
      { id: 'absent', label: 'Ne pas y aller cette année', effects: [st('popularity', big ? -4 : -1), { kind: 'contact', contactId: 'ct-maires', trust: big ? -6 : -2 }, st('energy', 5)], outcome: big ? 'Votre absence est commentée pendant des jours.' : 'Personne ne remarque votre absence.' },
    ], 1);
}

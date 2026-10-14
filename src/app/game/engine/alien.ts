import { AlienState, Effect, GameState } from '../models/game.models';
import { addMilestone } from './life';
import { pushNews } from './effects';
import { Rng, clamp, frSigned } from './rng';

/* ============================================================
 *  Scénario « Premier contact » : un signal venu de Proxima,
 *  puis un vaisseau, puis une rencontre. Il faut comprendre
 *  (compréhension), se faire comprendre (confiance), tenir le
 *  pays (panique) et empêcher les grandes puissances de
 *  confisquer le contact (rivalité). Civilisation fictive :
 *  les Vélari.
 * ============================================================ */

export const ALIEN_PHASES = ['Le signal', 'L’approche', 'En orbite', 'La rencontre', 'L’ambassade'];
export const ALIEN_PHASE_TEXT = [
  'Un signal régulier, venu de Proxima du Centaure, capté par le radiotélescope de Nançay.',
  'Un objet de huit cents mètres ralentit en franchissant l’orbite de Jupiter. Il vient vers nous.',
  'Le vaisseau s’est placé en orbite basse. On le voit à l’œil nu, chaque soir, au-dessus de l’Europe.',
  'Une navette s’est posée sur le plateau de Valcroze. Les Vélari attendent qu’on vienne à eux.',
  'Une ambassade vélari est ouverte. La Terre a une voix, et c’est la vôtre.',
];

/** Mois minimum passés dans une phase avant la suivante */
export const ALIEN_MIN_MONTHS = 4;
/** Les progrès sont plus durs à mesure que le contact se rapproche */
const PHASE_EASE = [1, 0.85, 0.7, 0.6, 1];

/** Seuils pour passer à la phase suivante */
export const ALIEN_NEXT: { comprehension: number; confiance: number; panique?: number }[] = [
  { comprehension: 30, confiance: 0 },
  { comprehension: 52, confiance: 40 },
  { comprehension: 72, confiance: 60 },
  { comprehension: 88, confiance: 80, panique: 55 },
];

export const AMBASSADOR_TITLE = 'Premier·e ambassadeur·rice de la Terre';

export function initAlien(d: GameState): AlienState {
  return { species: 'les Vélari', phase: 0, comprehension: 8, confiance: 30, panique: 18, rivalite: 15, gifts: 0, since: d.week };
}

/** Rejoindre (ou ouvrir) le dossier du premier contact */
export function joinAlien(d: GameState, lead: boolean): string[] {
  if (d.alien) return [];
  d.alien = initAlien(d);
  if (lead) d.player.flags['hautCommissaire'] = true;
  d.intl.tension = clamp(d.intl.tension + 6);
  pushNews(d, 'actu', 'neutral', 'Un signal venu des étoiles',
    `${ALIEN_PHASE_TEXT[0]} ${lead ? 'Matignon vous confie la cellule interministérielle du Premier contact. ' : ''}Nouvel onglet : Premier contact.`);
  addMilestone(d, 'carriere', 'Le signal de Proxima', lead ? 'Vous prenez la tête de la cellule du Premier contact.' : 'Vous êtes associé·e au dossier du Premier contact.');
  return ['Dossier du Premier contact ouvert'];
}

export function adjustAlien(d: GameState, e: Extract<Effect, { kind: 'alien' }>): string[] {
  if (e.join) return joinAlien(d, true);
  const a = d.alien;
  if (!a) return [];
  const out: string[] = [];
  const sign = (n: number) => frSigned(n);
  const ease = (n: number) => (n > 0 ? Math.max(1, Math.round(n * (PHASE_EASE[a.phase] ?? 1))) : n);
  if (e.comprehension) { const v = ease(e.comprehension); a.comprehension = clamp(a.comprehension + v); out.push(`Compréhension ${sign(v)}`); }
  if (e.confiance) { const v = ease(e.confiance); a.confiance = clamp(a.confiance + v); out.push(`Confiance des Vélari ${sign(v)}`); }
  if (e.panique) { a.panique = clamp(a.panique + e.panique); out.push(`Panique ${sign(e.panique)}`); }
  if (e.rivalite) { a.rivalite = clamp(a.rivalite + e.rivalite); out.push(`Rivalité des puissances ${sign(e.rivalite)}`); }
  if (e.gift) { a.gifts += 1; d.intl.prestige = clamp(d.intl.prestige + 4); out.push('Technologie vélari reçue'); }
  return out;
}

/** Ce qui manque pour la phase suivante (null : dernière phase) */
export function alienNeeds(a: AlienState, week?: number): string[] | null {
  const n = ALIEN_NEXT[a.phase];
  if (!n) return null;
  const out: string[] = [];
  if (a.comprehension < n.comprehension) out.push(`compréhension ${n.comprehension}`);
  if (a.confiance < n.confiance) out.push(`confiance ${n.confiance}`);
  if (n.panique !== undefined && a.panique >= n.panique) out.push(`panique sous ${n.panique}`);
  if (week !== undefined && week - a.since < ALIEN_MIN_MONTHS) out.push(`encore ${ALIEN_MIN_MONTHS - (week - a.since)} mois de travail`);
  return out;
}

/** Un mois de premier contact */
export function monthlyAlien(d: GameState, rng: Rng): void {
  const a = d.alien;
  if (!a || d.status !== 'en_cours') return;
  const drift = [0.6, 2, 2.4, 1.6, -1.5][a.phase] ?? 0;
  a.panique = clamp(a.panique + drift + (a.rivalite > 70 ? 1 : 0) + rng.range(-1.5, 1.5));
  a.rivalite = clamp(a.rivalite + 1.2 + a.phase * 0.8 + rng.range(-1, 1) - (a.phase >= 4 ? 4 : 0));
  a.confiance = clamp(a.confiance + (40 - a.confiance) * (a.confiance > 40 ? 0.05 : 0.02) + (a.phase >= 4 ? 0.5 : 0));
  // Les scientifiques du monde entier avancent aussi, lentement
  if (a.phase < 4) a.comprehension = clamp(a.comprehension + 0.5);
  if (a.phase >= 1) d.intl.tension = clamp(d.intl.tension + 0.4);
  if (a.phase >= 4) d.intl.prestige = clamp(d.intl.prestige + 0.5);
  // La peur pèse sur celui ou celle qui porte le dossier
  const s = d.player.stats;
  if (a.panique > 60) { s.popularity = clamp(s.popularity - (a.panique - 60) * 0.05); s.stress = clamp(s.stress + 2); }

  // Passage à la phase suivante
  const needs = alienNeeds(a, d.week);
  if (needs && !needs.length) {
    a.phase += 1;
    a.since = d.week;
    a.panique = clamp(a.panique + (a.phase === 1 ? 12 : a.phase === 2 ? 8 : 4));
    d.player.flags['alienPhaseUp'] = d.week;
    if (a.phase >= 4) {
      if (!d.milestones.some(m => m.title === AMBASSADOR_TITLE)) {
        d.status = 'victoire';
        d.endTitle = AMBASSADOR_TITLE;
        d.endReason = `${ALIEN_PHASE_TEXT[4]} Les Vélari ont choisi la France pour parler au monde.`;
      }
      s.influence = clamp(s.influence + 10);
      s.popularity = clamp(s.popularity + 8);
    } else {
      addMilestone(d, 'carriere', ALIEN_PHASES[a.phase], ALIEN_PHASE_TEXT[a.phase]);
    }
    pushNews(d, 'actu', a.phase >= 3 ? 'positive' : 'neutral', `Premier contact : ${ALIEN_PHASES[a.phase].toLowerCase()}`, ALIEN_PHASE_TEXT[a.phase]);
    return;
  }

  // Les fins malheureuses : la peur, le silence, la confiscation
  const fail = a.panique >= 95 ? { title: 'La grande peur', text: 'Pillages, exode vers les campagnes, couvre-feu : le pays a cédé à la panique et vous en tient pour responsable.' }
    : a.phase >= 2 && a.confiance <= 3 ? { title: 'Le silence des étoiles', text: 'Le vaisseau vélari quitte l’orbite sans un mot. L’humanité a laissé passer sa chance.' }
    : a.rivalite >= 100 ? { title: 'Le contact confisqué', text: 'Les grandes puissances s’emparent du dossier au Conseil de sécurité. La France est priée de se taire.' }
    : null;
  if (fail && d.status === 'en_cours') {
    d.status = 'defaite';
    d.endTitle = fail.title;
    d.endReason = fail.text;
  }
}

/** Une fin malheureuse referme le dossier */
export const ALIEN_FAILURES = new Set(['La grande peur', 'Le silence des étoiles', 'Le contact confisqué']);

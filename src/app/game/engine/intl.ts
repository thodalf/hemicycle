import { Effect, GameState, IntlState } from '../models/game.models';
import { rankOrder } from '../data/ranks';
import { pushNews } from './effects';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Politique internationale : relations avec les grands
 *  partenaires, prestige de la France (et le vôtre), tensions,
 *  crises lointaines qui finissent toujours par rattraper la
 *  politique intérieure.
 * ============================================================ */

export interface Partner {
  id: string;
  name: string;
  /** Article : « avec l’… », « avec les… » */
  with: string;
  start: number;
}

export const PARTNERS: Partner[] = [
  { id: 'ue', name: 'Union européenne', with: 'avec l’Union européenne', start: 35 },
  { id: 'allemagne', name: 'Allemagne', with: 'avec l’Allemagne', start: 40 },
  { id: 'etats_unis', name: 'États-Unis', with: 'avec les États-Unis', start: 20 },
  { id: 'royaume_uni', name: 'Royaume-Uni', with: 'avec le Royaume-Uni', start: 15 },
  { id: 'chine', name: 'Chine', with: 'avec la Chine', start: -10 },
  { id: 'afrique', name: 'Union africaine', with: 'avec l’Union africaine', start: 5 },
];
export const PARTNERS_BY_ID = new Map(PARTNERS.map(p => [p.id, p]));

/** Conflits lointains, entre États fictifs */
const CRISES = [
  'la guerre entre la Valdovie et la Karstanie',
  'la guerre civile au Kantor',
  'le blocus du détroit de Méridia',
  'la crise des réfugiés de Zamérie',
];

export function initIntl(): IntlState {
  return {
    prestige: 40, tension: 30, crisis: null, treaties: 0,
    relations: Object.fromEntries(PARTNERS.map(p => [p.id, p.start])),
  };
}

/** Les affaires du monde ne passent par vous qu'à partir d'un certain rang */
export function intlRelevant(d: GameState): boolean {
  return !!d.presidency || rankOrder(d.player.rankId) >= rankOrder('depute');
}

/** Peser sur les décisions internationales : ministre, Premier·e ministre ou président·e */
export function intlPower(d: GameState): boolean {
  return !!d.presidency || ['ministre', 'premier_ministre'].includes(d.player.rankId);
}

export function relationLabel(v: number): string {
  if (v >= 60) return 'Alliance étroite';
  if (v >= 25) return 'Bonnes relations';
  if (v >= -10) return 'Relations correctes';
  if (v >= -45) return 'Relations froides';
  return 'Crise diplomatique';
}

export function adjustIntl(d: GameState, e: Extract<Effect, { kind: 'intl' }>, partnerRef: string | undefined, rng: Rng): string[] {
  const w = d.intl;
  const out: string[] = [];
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const partner = e.partner === '$target' ? partnerRef : e.partner;
  if (e.relation && partner && w.relations[partner] !== undefined) {
    w.relations[partner] = clamp(w.relations[partner] + e.relation, -100, 100);
    out.push(`Relations ${PARTNERS_BY_ID.get(partner)?.with ?? partner} ${sign(e.relation)}`);
  }
  if (e.allRelations) {
    for (const k of Object.keys(w.relations)) w.relations[k] = clamp(w.relations[k] + e.allRelations, -100, 100);
    out.push(`Relations internationales ${sign(e.allRelations)}`);
  }
  if (e.prestige) { w.prestige = clamp(w.prestige + e.prestige); out.push(`Prestige ${sign(e.prestige)}`); }
  if (e.tension) { w.tension = clamp(w.tension + e.tension); out.push(`Tensions ${sign(e.tension)}`); }
  if (e.startCrisis && !w.crisis) {
    w.crisis = { name: e.startCrisis === 'random' ? rng.pick(CRISES) : e.startCrisis, intensity: 55, since: d.week };
    w.tension = clamp(w.tension + 12);
    pushNews(d, 'actu', 'negative', 'Crise internationale', `Le monde retient son souffle : ${w.crisis.name}.`);
    out.push('Crise internationale');
  }
  if (e.crisis && w.crisis) {
    w.crisis.intensity = clamp(w.crisis.intensity + e.crisis);
    out.push(`Crise ${e.crisis < 0 ? 'apaisée' : 'aggravée'} (${sign(e.crisis)})`);
    if (w.crisis.intensity <= 0) {
      pushNews(d, 'actu', 'positive', 'Fin de la crise internationale', `Un accord met fin à ${w.crisis.name}.`);
      w.crisis = null;
      w.treaties += 1;
      w.tension = clamp(w.tension - 10);
      out.push('Crise résolue');
    }
  }
  return out;
}

export function weeklyIntl(d: GameState, rng: Rng): void {
  const w = d.intl;
  // Les relations retombent doucement vers leur niveau historique ; les tensions vers 30
  for (const p of PARTNERS) w.relations[p.id] = clamp(w.relations[p.id] + (p.start - w.relations[p.id]) * 0.01, -100, 100);
  w.tension = clamp(w.tension + (30 - w.tension) * 0.03 + rng.range(-1.5, 1.5) + (w.crisis ? w.crisis.intensity / 50 : 0));
  w.prestige = clamp(w.prestige + (40 - w.prestige) * 0.01);
  if (w.crisis) {
    w.crisis.intensity = clamp(w.crisis.intensity + rng.range(-3, 3.5));
    if (w.crisis.intensity <= 0 || d.week - w.crisis.since > 80) {
      pushNews(d, 'actu', 'neutral', 'La crise internationale s’éteint', `${w.crisis.name.charAt(0).toUpperCase()}${w.crisis.name.slice(1)} s’enlise puis s’apaise, sans la France.`);
      w.crisis = null;
    }
  } else if (w.tension > 50 && rng.chance(0.03)) {
    adjustIntl(d, { kind: 'intl', startCrisis: 'random' }, undefined, rng);
  }

  // Le monde rejaillit sur votre carrière
  const p = d.player;
  if (d.presidency) {
    const pr = d.presidency;
    pr.approval = clamp(pr.approval + (w.prestige - 45) * 0.01 - (w.crisis ? 0.1 : 0));
    pr.threat = clamp(pr.threat + (w.tension - 40) * 0.02);
    p.stats.influence = clamp(p.stats.influence + (w.prestige - 50) * 0.01);
  } else if (intlPower(d)) {
    p.stats.influence = clamp(p.stats.influence + (w.prestige - 50) * 0.005);
  }
  // Une crise internationale met la diplomatie à la une
  if (w.crisis && d.week >= d.agendaLockedUntil && rng.chance(0.25)) d.agendaDomain = 'diplomatie';
}

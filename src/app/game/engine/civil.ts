import { CivilState, CorpsId, Domain, Effect, GameState } from '../models/game.models';
import { addMilestone } from './life';
import { pushNews } from './effects';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Haute fonction publique : on y entre par le concours de
 *  l'INSP (le classement décide du corps) ou au « tour
 *  extérieur ». Un traitement mensuel, des grades, mais du
 *  temps en moins (un point d'action) ; pendant un mandat
 *  national, on est placé·e en disponibilité, sans traitement.
 * ============================================================ */

export interface CorpsDef {
  id: CorpsId;
  name: string;
  /** Intitulé du poste, par grade (0 → 3) */
  grades: string[];
  /** Traitement mensuel brut (primes comprises), par grade */
  pay: number[];
  domain: Domain;
}

export const CORPS: CorpsDef[] = [
  { id: 'prefet', name: 'Corps préfectoral', domain: 'securite',
    grades: ['Sous-préfet·e', 'Secrétaire général·e de préfecture', 'Préfet·e', 'Préfet·e de région'], pay: [4600, 5600, 7400, 9400] },
  { id: 'conseil_etat', name: 'Conseil d’État', domain: 'justice',
    grades: ['Auditeur·rice au Conseil d’État', 'Maître·sse des requêtes', 'Conseiller·e d’État', 'Président·e de section'], pay: [4300, 5800, 7600, 9800] },
  { id: 'finances', name: 'Inspection générale des finances', domain: 'economie',
    grades: ['Inspecteur·rice adjoint·e des finances', 'Inspecteur·rice des finances', 'Inspecteur·rice général·e', 'Chef·fe de l’Inspection'], pay: [4500, 6000, 8000, 10000] },
  { id: 'diplomatie', name: 'Corps diplomatique', domain: 'diplomatie',
    grades: ['Secrétaire des affaires étrangères', 'Conseiller·e d’ambassade', 'Ministre plénipotentiaire', 'Ambassadeur·rice'], pay: [4200, 5600, 7800, 10200] },
  { id: 'comptes', name: 'Cour des comptes', domain: 'economie',
    grades: ['Auditeur·rice à la Cour des comptes', 'Conseiller·e référendaire', 'Conseiller·e maître', 'Président·e de chambre'], pay: [4300, 5700, 7500, 9500] },
];
export const CORPS_BY_ID = new Map(CORPS.map(c => [c.id, c]));

/** Mandats compatibles avec l'exercice d'une fonction publique */
const COMPATIBLE = new Set(['militant', 'conseiller_municipal']);

/** En poste (et non en disponibilité) */
export function civilActive(d: GameState): boolean {
  return !!d.player.civil && COMPATIBLE.has(d.player.rankId) && !d.presidency;
}

export function civilTitle(c: CivilState): string {
  const def = CORPS_BY_ID.get(c.corps)!;
  return def.grades[Math.min(c.grade, def.grades.length - 1)];
}

export function civilPay(c: CivilState): number {
  const def = CORPS_BY_ID.get(c.corps)!;
  return def.pay[Math.min(c.grade, def.pay.length - 1)];
}

/** Crédibilité attendue pour le grade suivant */
export function promoThreshold(c: CivilState): number {
  return 35 + c.grade * 15;
}

export function joinCivil(d: GameState, corps: CorpsId, grade = 0): string[] {
  const def = CORPS_BY_ID.get(corps);
  if (!def || d.player.civil) return [];
  d.player.civil = { corps, grade, since: d.week, lastPromo: d.week };
  const title = civilTitle(d.player.civil);
  addMilestone(d, 'carriere', `Entrée dans la haute fonction publique`, `${def.name} : ${title}.`);
  pushNews(d, 'systeme', 'positive', `Vous voilà ${title.toLowerCase()}`, `${def.name}. Un traitement de ${civilPay(d.player.civil).toLocaleString('fr-FR')} € par mois, et un point d’action en moins chaque mois : l’administration prend du temps. Nouvel onglet : Administration.`);
  return [`${def.name} : ${title}`];
}

export function adjustCivil(d: GameState, e: Extract<Effect, { kind: 'civil' }>, rng: Rng): string[] {
  const p = d.player;
  const out: string[] = [];
  if (e.join) {
    if (p.civil) return out;
    let corps: CorpsId;
    if (e.join === 'classement') corps = rng.pick<CorpsId>(['conseil_etat', 'finances', 'comptes']);
    else if (e.join === 'sortie') corps = rng.pick<CorpsId>(['prefet', 'diplomatie']);
    else if (e.join === 'tour') corps = rng.pick<CorpsId>(['prefet', 'diplomatie', 'conseil_etat']);
    else corps = e.join;
    return joinCivil(d, corps, e.join === 'tour' ? 1 : 0);
  }
  const c = p.civil;
  if (!c) return out;
  if (e.leave) {
    const def = CORPS_BY_ID.get(c.corps)!;
    p.civil = null;
    pushNews(d, 'systeme', 'neutral', 'Vous quittez la fonction publique', `${def.name} : démission acceptée.`);
    return ['Démission de la fonction publique'];
  }
  if (e.grade) {
    const max = CORPS_BY_ID.get(c.corps)!.grades.length - 1;
    const before = c.grade;
    c.grade = Math.max(0, Math.min(max, c.grade + e.grade));
    if (c.grade !== before) {
      c.lastPromo = d.week;
      out.push(`Nommé·e ${civilTitle(c).toLowerCase()}`);
      if (c.grade > before) pushNews(d, 'systeme', 'positive', `Promotion : ${civilTitle(c)}`, `Traitement porté à ${civilPay(c).toLocaleString('fr-FR')} € par mois.`);
    }
  }
  if (e.study) {
    const dom = CORPS_BY_ID.get(c.corps)!.domain;
    const dossier = p.dossiers[dom];
    dossier.mastery = clamp(dossier.mastery + e.study);
    dossier.lastStudiedWeek = d.week;
    out.push(`Dossier ${dom} +${e.study}`);
  }
  return out;
}

/** Un mois de service : l'expérience vient, l'avancement aussi */
export function monthlyCivil(d: GameState): void {
  const c = d.player.civil;
  if (!c || !civilActive(d)) return;
  const s = d.player.stats;
  s.credibility = clamp(s.credibility + 0.3);
  const dom = CORPS_BY_ID.get(c.corps)!.domain;
  d.player.dossiers[dom].mastery = clamp(d.player.dossiers[dom].mastery + 0.6);
  // Avancement à l'ancienneté, si l'on a fait ses preuves
  const max = CORPS_BY_ID.get(c.corps)!.grades.length - 1;
  if (c.grade < max && d.week - c.lastPromo >= 30 && s.credibility >= promoThreshold(c)) {
    c.grade += 1;
    c.lastPromo = d.week;
    pushNews(d, 'systeme', 'positive', `Avancement : ${civilTitle(c)}`, `Traitement porté à ${civilPay(c).toLocaleString('fr-FR')} € par mois.`);
  }
}

/** Le résultat du concours : le classement de sortie décide du corps */
export function examOutcome(effects: Effect[], passed: boolean, brilliant: boolean): Effect[] {
  return effects.flatMap(e => {
    if (e.kind !== 'civil' || !e.join) return [e];
    if (!passed) return [];
    return [{ ...e, join: e.join === 'classement' ? (brilliant ? 'classement' : 'sortie') : e.join }];
  });
}

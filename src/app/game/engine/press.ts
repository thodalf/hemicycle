import { Decision, GameState } from '../models/game.models';
import { OUTLETS, PRESS_GRADES, PRESS_REQUIREMENTS, PRESS_SALARIES } from '../data/press';
import { rankOrder } from '../data/ranks';
import { pushNews } from './effects';
import { Rng, clamp, frSigned, nextId } from './rng';

/* ============================================================
 *  Carrière dans les médias : audience, réputation, pression
 *  du propriétaire, promotions et licenciement.
 * ============================================================ */

/** On ne grimpe pas plus vite qu'un grade tous les quatre mois */
export const MIN_WEEKS_PER_GRADE = 4;

export function pressReady(d: GameState): boolean {
  const p = d.press;
  if (!p || p.grade >= PRESS_REQUIREMENTS.length) return false;
  const r = PRESS_REQUIREMENTS[p.grade];
  return p.audience >= r.audience && p.reputation >= r.reputation && p.scoops >= r.scoops
    && d.player.stats.influence >= (r.influence ?? 0) && d.week - (p.gradeWeek ?? p.since) >= MIN_WEEKS_PER_GRADE;
}

/** Applique une variation des jauges presse (avec les multiplicateurs du média) */
export function adjustPress(d: GameState, e: { audience?: number; reputation?: number; independance?: number; scoops?: number; ligne?: number; salaryPct?: number }): string[] {
  const p = d.press;
  if (!p) return [];
  const o = OUTLETS[p.kind];
  const out: string[] = [];
  // Rendements décroissants : plus l'audience est haute, plus chaque point coûte cher
  if (e.audience) {
    const v = e.audience > 0 ? e.audience * o.audienceMult * Math.max(0.15, 1 - p.audience / 100) : e.audience;
    p.audience = clamp(p.audience + v);
    out.push(`Audience ${frSigned(v)}`);
  }
  if (e.reputation) {
    const v = e.reputation > 0 ? e.reputation * o.reputationMult * Math.max(0.2, 1 - p.reputation / 110) : e.reputation;
    p.reputation = clamp(p.reputation + v);
    out.push(`Réputation ${frSigned(v)}`);
  }
  if (e.independance) {
    p.independance = clamp(p.independance + e.independance);
    out.push(`Indépendance ${frSigned(e.independance)}`);
  }
  if (e.scoops) {
    p.scoops += e.scoops;
    out.push(e.scoops > 0 ? 'Scoop !' : 'Scoop retiré');
  }
  if (e.ligne) p.ligne = Math.max(-100, Math.min(100, p.ligne + e.ligne));
  if (e.salaryPct) {
    p.salary = Math.round(p.salary * (1 + e.salaryPct / 100) / 10) * 10;
    out.push(`Salaire ${p.salary.toLocaleString('fr-FR')} €/sem.`);
  }
  return out;
}

function decision(d: GameState, tag: string, title: string, context: string, choices: Decision['choices'], deadline = 2): Decision {
  return { id: nextId(d, 'dec'), tag, week: d.week, deadlineWeek: d.week + deadline, source: 'medias', title, context, choices };
}

const pending = (d: GameState, tag: string) => d.pendingDecisions.some(x => x.tag === tag);

export function weeklyPress(d: GameState, rng: Rng): void {
  const p = d.press;
  if (!p) return;
  const s = d.player.stats;
  d.player.finances.personal += p.salary;

  // Lassitude du public, réputation à entretenir, notoriété qui nourrit l'audience
  p.audience = clamp(p.audience - 1 - p.audience * 0.025 + (s.popularity > p.audience * 0.6 ? 0.3 : 0));
  p.reputation = clamp(p.reputation - 0.3 - p.reputation * 0.012);
  p.independance = clamp(p.independance + (p.independance < 50 ? 0.4 : 0));

  // Une tribune régulière rapporte de l'influence et de la notoriété
  s.influence = clamp(s.influence + 0.1 * (p.grade + 1));
  s.popularity = clamp(s.popularity + p.audience / 400);
  // Mélange des genres : un élu national qui commente l'actualité y perd en crédibilité
  if (d.scenario !== 'editorialiste' && rankOrder(d.player.rankId) >= rankOrder('depute')) s.credibility = clamp(s.credibility - 0.15);

  // Le propriétaire n'aime pas qu'on s'écarte de la ligne
  const gap = Math.abs(d.player.stance - p.ligne);
  if (gap > 35) {
    p.independance = clamp(p.independance - 0.8);
    if (!pending(d, 'pression_proprietaire') && rng.chance(0.12)) {
      d.pendingDecisions.push(decision(d, 'pression_proprietaire', `${capitalize(p.owner)} vous convoque`,
        `« Vos prises de position ne correspondent pas à l’esprit de ${p.outlet}. » Le message est clair.`, [
          { id: 'plier', label: 'Rentrer dans le rang', effects: [{ kind: 'stance', delta: Math.sign(p.ligne - d.player.stance) * 10 }, { kind: 'press', independance: -10 }], outcome: 'Vos prochains éditos seront plus « dans la ligne ».' },
          { id: 'tenir', label: 'Défendre votre liberté éditoriale', effects: [{ kind: 'press', independance: 8, reputation: 4, audience: -3 }], outcome: 'Vous gardez votre plume. Le propriétaire, lui, garde rancune.',
            risk: { baseChance: 0.3, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [{ kind: 'press', audience: -8, salaryPct: -20 }], failureNews: 'Votre émission est déplacée à 23 h et votre salaire raboté.' } },
          { id: 'public', label: 'Rendre l’affaire publique', effects: [{ kind: 'press', reputation: 8, independance: 12 }, { kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'exposure', delta: 4 }], outcome: 'Les syndicats de journalistes vous soutiennent.',
            risk: { baseChance: 0.35, onFailure: [{ kind: 'leavePress' }], failureNews: 'Vous êtes remercié·e pour « faute grave ».' } },
        ]));
    }
  }

  // Promotion
  if (pressReady(d) && !pending(d, 'promotion_redaction')) {
    const next = PRESS_GRADES[p.grade + 1];
    d.pendingDecisions.push(decision(d, 'promotion_redaction', `Promotion : ${next}`,
      `La direction de ${p.outlet} vous propose de devenir ${next.toLowerCase()}. Salaire : ${PRESS_SALARIES[p.grade + 1].toLocaleString('fr-FR')} € par mois.`, [
        { id: 'accepter', label: 'Accepter', effects: [{ kind: 'pressGrade', delta: 1 }, { kind: 'stat', stat: 'influence', delta: 3 },
          ...(p.grade >= 1 ? [{ kind: 'booster' as const, count: 1, reason: 'De nouveaux talents veulent rejoindre votre équipe.' }] : [])], outcome: 'Votre nom monte d’un cran dans l’ours du journal.' },
        { id: 'concurrent', label: 'Faire monter les enchères auprès d’un concurrent', effects: [{ kind: 'pressGrade', delta: 1 }, { kind: 'press', salaryPct: 25, independance: 5 }], outcome: 'Vous obtenez le poste et une belle augmentation.',
          risk: { baseChance: 0.3, onFailure: [{ kind: 'press', independance: -10, audience: -4 }], failureNews: 'La direction n’apprécie pas le chantage : la promotion est reportée.' } },
      ]));
  }

  // Licenciement quand plus personne ne vous lit ni ne vous écoute
  if (p.audience < 8 && p.reputation < 25 && d.week - p.since > 5) {
    if (d.scenario === 'editorialiste') {
      d.status = 'defaite';
      d.endTitle = 'Remercié·e';
      d.endReason = `${p.outlet} met fin à votre collaboration. Plus personne ne vous lit ni ne vous écoute.`;
    } else {
      pushNews(d, 'actu', 'negative', `${p.outlet} se sépare de vous`, 'Faute d’audience, votre chronique est supprimée.');
      d.press = null;
    }
    return;
  }

  // Victoire du scénario : diriger la rédaction et faire l'opinion
  if (d.scenario === 'editorialiste' && p.grade >= 4 && p.audience >= 65 && s.influence >= 60 && d.status === 'en_cours' && !d.milestones.some(m => m.title === 'Le quatrième pouvoir')) {
    d.status = 'victoire';
    d.endTitle = 'Le quatrième pouvoir';
    d.endReason = `Directeur·rice de la rédaction de ${p.outlet}, vous faites et défaites les carrières. Les politiques vous appellent avant de parler.`;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

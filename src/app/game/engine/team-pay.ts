import { Effect, GameState, Recruit } from '../models/game.models';
import { monthIndex } from './calendar';
import { LEAVE_MALUS } from '../data/leave';
import { STAFF_BY_ROLE } from '../data/staff';
import { applyEffects, availableFunds, pushNews } from './effects';
import { fireRecruit, hireRecruit, onLeave, syncStaff } from './recruits';
import { TEAM_TIPS, addMessage } from './phone';
import { Rng, clamp, frSigned } from './rng';

/* ============================================================
 *  Salaires de l'équipe : on négocie à l'embauche, on augmente
 *  ou l'on rabote en cours de contrat. Le moral suit : mal
 *  payé·e, on finit par partir ; bien payé·e, on se surpasse.
 * ============================================================ */

const round50 = (v: number) => Math.round(v / 50) * 50;

export function askOf(r: Recruit): number {
  return r.ask ?? r.salary;
}

export function moraleOf(r: Recruit): number {
  return r.morale ?? 60;
}

/** Le moral vers lequel tend un salaire (100 % des prétentions : 55) */
export function moraleTarget(r: Recruit): number {
  return clamp(55 + (r.salary / askOf(r) - 1) * 150, 5, 100);
}

/** Bornes d'une offre ou d'un salaire */
export function payBounds(r: Recruit): { min: number; max: number } {
  const ask = askOf(r);
  return { min: round50(ask * 0.6), max: round50(ask * 2) };
}

/** Chance qu'une offre soit acceptée */
export function offerChance(r: Recruit, offer: number): number {
  const ask = askOf(r);
  if (offer >= ask) return 1;
  return clamp((offer / ask - 0.75) / 0.25, 0, 1);
}

export function moraleLabel(m: number): string {
  return m >= 80 ? 'Motivé·e' : m >= 55 ? 'Satisfait·e' : m >= 35 ? 'Mitigé·e' : m >= 20 ? 'Mécontent·e' : 'Sur le départ';
}

/** Proposer un salaire à un·e candidat·e */
export function hireWithOffer(d: GameState, id: string, offer: number, rng: Rng): { ok: boolean; text: string } {
  const r = d.player.pool.find(x => x.id === id);
  if (!r) return { ok: false, text: '' };
  const ask = askOf(r);
  const { min, max } = payBounds(r);
  const value = clamp(round50(offer), min, max);
  if (availableFunds(d) < value) return { ok: false, text: 'Il faut pouvoir avancer un mois de salaire.' };
  if (!rng.chance(offerChance(r, value))) {
    r.ask = round50(ask * 1.05);
    const text = `${r.name} décline : « En dessous de ${ask.toLocaleString('fr-FR')} €, ce n’est pas sérieux. » Ses prétentions montent à ${r.ask.toLocaleString('fr-FR')} €.`;
    pushNews(d, 'systeme', 'negative', `${r.name} refuse votre offre`, text);
    return { ok: false, text };
  }
  r.ask = ask;
  r.salary = value;
  r.morale = moraleTarget(r);
  r.hiredWeek = d.week;
  hireRecruit(d, id);
  return { ok: true, text: `${r.name} accepte ${value.toLocaleString('fr-FR')} € par mois.` };
}

/** Augmenter ou raboter un salaire en cours de contrat */
export function setSalary(d: GameState, id: string, salary: number, rng: Rng): string[] {
  const r = d.player.team.find(x => x.id === id);
  if (!r) return [];
  r.ask ??= r.salary;
  const { min, max } = payBounds(r);
  const value = clamp(round50(salary), min, max);
  if (value === r.salary) return [];
  const pct = (value - r.salary) / r.salary;
  r.salary = value;
  r.morale = clamp(moraleOf(r) + (pct > 0 ? pct * 120 : pct * 180));
  const out = [`${r.name} : ${value.toLocaleString('fr-FR')} €/mois · moral ${Math.round(r.morale)}`];
  if (pct < 0 && value < askOf(r) * 0.8 && rng.chance(0.35)) {
    fireRecruit(d, id);
    pushNews(d, 'systeme', 'negative', `${r.name} claque la porte`, '« Avec ce salaire, je vais voir ailleurs. » Votre équipe perd un pilier.');
    out.push(`${r.name} démissionne`);
  }
  return out;
}

/** Effet « team » : moral et salaires de l'équipe (événements, primes) */
export function adjustTeam(d: GameState, e: Extract<Effect, { kind: 'team' }>): string[] {
  const list = e.all ? d.player.team : d.player.team.filter(r => r.id === e.recruitId);
  const out: string[] = [];
  if (e.leave) {
    for (const r of [...list]) { fireRecruit(d, r.id); out.push(`${r.name} quitte l’équipe`); }
    return out;
  }
  if (e.vacation) {
    for (const r of list) {
      r.leaveFrom = d.week + 1;
      r.leaveUntil = d.week + 1 + e.vacation;
      out.push(`${r.name} en congé le mois prochain : ${LEAVE_MALUS[r.role].label}`);
    }
  }
  for (const r of list) {
    r.ask ??= r.salary;
    if (e.salaryPct) r.salary = round50(r.salary * (1 + e.salaryPct / 100));
    if (e.morale) r.morale = clamp(moraleOf(r) + e.morale);
  }
  if (!list.length) return out;
  const who = e.all ? 'Équipe' : list[0].name;
  if (e.salaryPct) out.push(`${who} : salaire ${frSigned(e.salaryPct)} %`);
  if (e.morale) out.push(`${who} : moral ${frSigned(e.morale)}`);
  return out;
}

/** Les congés : départs d'été, retours, et ce que coûte chaque absence */
function monthlyLeave(d: GameState, rng: Rng): void {
  const summer = monthIndex(d.week) === 7;
  for (const r of d.player.team) {
    if (r.leaveUntil !== undefined && d.week >= r.leaveUntil) {
      pushNews(d, 'systeme', 'neutral', `${r.name} est de retour`, 'Bronzé·e, reposé·e, et déjà plongé·e dans les dossiers en retard.');
      delete r.leaveFrom; delete r.leaveUntil;
    }
    // En août, la moitié de l'équipe part (sauf si elle a déjà pris ses congés dans l'année)
    if (summer && !onLeave(d, r) && (r.leaveFrom === undefined || d.week - r.leaveFrom > 8) && rng.chance(0.5)) {
      r.leaveFrom = d.week; r.leaveUntil = d.week + 1;
      r.morale = clamp(moraleOf(r) + 6);
    }
    if (onLeave(d, r)) {
      const m = LEAVE_MALUS[r.role];
      const summary = applyEffects(d, m.effects, {}, rng);
      pushNews(d, 'systeme', 'negative', `${r.name} en congé`, `${STAFF_BY_ROLE.get(r.role)?.title ?? 'Votre collaborateur·rice'} absent·e ce mois-ci : ${m.label}. ${summary.join(' · ')}`);
    }
  }
  syncStaff(d);
}

/** Chaque mois : le moral suit la paie, les prétentions suivent le marché */
export function monthlyTeam(d: GameState, rng: Rng): void {
  monthlyLeave(d, rng);
  for (const r of [...d.player.team]) {
    r.ask ??= r.salary;
    r.hiredWeek ??= d.week;
    // Une fois par an, le marché augmente
    if (d.week > r.hiredWeek && (d.week - r.hiredWeek) % 12 === 0) r.ask = round50(r.ask * 1.03);
    r.morale = clamp(moraleOf(r) + (moraleTarget(r) - moraleOf(r)) * 0.15);
    // Avant de partir, on prévient : un message au téléphone, et une dernière chance de le ou la retenir
    const warned = r.warnedWeek !== undefined && d.week - r.warnedWeek <= 3;
    if (r.morale < 35 && !warned && (r.warnedWeek === undefined || d.week - r.warnedWeek > 6)) {
      warnLeaving(d, r);
      continue;
    }
    if (r.morale < 25 && warned && d.week > r.warnedWeek! && rng.chance(0.35)) {
      fireRecruit(d, r.id);
      pushNews(d, 'systeme', 'negative', `${r.name} démissionne`, `${STAFF_BY_ROLE.get(r.role)?.title ?? 'Votre collaborateur·rice'} vous avait prévenu·e : il ou elle trouve mieux ailleurs.`);
      continue;
    }
    if (r.morale >= 80 && !onLeave(d, r) && rng.chance(0.2)) {
      const tip = TEAM_TIPS[r.role];
      if (tip) {
        const summary = applyEffects(d, tip.effects, {}, rng);
        pushNews(d, 'systeme', 'positive', `${r.name} se surpasse`, `${tip.text} ${summary.join(' · ')}`);
      }
    }
  }
}

const LEAVING_LINES = [
  'Je dois vous parler franchement : je réfléchis à partir. Un cabinet de conseil me fait une offre.',
  'Je suis épuisé·e et sous-payé·e. Si rien ne change, je pars à la fin du mois.',
  'Un autre élu m’a approché·e. Je n’ai pas encore dit oui… mais je n’ai pas dit non.',
  'J’ai besoin de sentir que mon travail compte. Sinon, je m’en vais.',
];

/** Le message d'alerte : il ou elle songe à partir */
function warnLeaving(d: GameState, r: Recruit): void {
  r.warnedWeek = d.week;
  const title = STAFF_BY_ROLE.get(r.role)?.title ?? 'Collaborateur·rice';
  const bonus = Math.max(1000, round50(r.salary * 0.8));
  addMessage(d, {
    kind: 'sms', who: `equipe:${r.id}`, from: r.name, role: title, urgent: true,
    text: `⚠️ ${LEAVING_LINES[d.week % LEAVING_LINES.length]}`,
    replies: [
      { id: 'augmenter', label: 'Augmenter son salaire de 15 %', effects: [{ kind: 'team', recruitId: r.id, salaryPct: 15, morale: 25 }], answer: 'Merci. Je reste, et je ne vous décevrai pas.' },
      { id: 'prime', label: `Lui verser une prime (${bonus.toLocaleString('fr-FR')} €)`, effects: [{ kind: 'funds', account: 'personal', delta: -bonus }, { kind: 'team', recruitId: r.id, morale: 18 }], answer: 'C’est un geste qui compte. On continue.' },
      { id: 'responsabilites', label: 'Lui confier plus de responsabilités', effects: [{ kind: 'team', recruitId: r.id, morale: 12 }, { kind: 'stat', stat: 'energy', delta: 3 }], answer: 'D’accord, je vous laisse une chance. Ne la gâchez pas.' },
      { id: 'partir', label: 'Le ou la laisser partir', effects: [{ kind: 'team', recruitId: r.id, leave: true }], answer: 'Merci pour tout. Je vous souhaite bonne chance.' },
    ],
    missed: [{ kind: 'team', recruitId: r.id, morale: -8 }],
  });
  pushNews(d, 'systeme', 'negative', `${r.name} songe à partir`, 'Un message vous attend sur votre téléphone. Sans réponse, il ou elle partira.');
}

/** Les recrues d'avant cette mise à jour */
export function migrateTeamPay(d: GameState): void {
  for (const r of [...d.player.team, ...d.player.pool]) { r.ask ??= r.salary; r.morale ??= 60; }
}

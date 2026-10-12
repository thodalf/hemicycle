import { Decision, DecisionChoice, GameState } from '../models/game.models';
import { pushNews } from './effects';
import { salePrice } from './patrimoine';
import { fireRecruit } from './recruits';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Banqueroute : découvert, agios, procédure de la banque,
 *  faillite personnelle et fin de carrière.
 * ============================================================ */

/** Seuils (fonds personnels) */
export const OVERDRAFT_ALERT = -8000;
export const RUIN = -25000;
/** Semaines de découvert avant que la banque ne lance la procédure */
const WEEKS_BEFORE_PROCEDURE = 3;

export type MoneyHealth = 'sain' | 'tendu' | 'decouvert' | 'danger';

export function moneyHealth(d: GameState): MoneyHealth {
  const p = d.player.finances.personal;
  if (p < OVERDRAFT_ALERT || Number(d.player.flags['overdraftWeeks'] ?? 0) >= WEEKS_BEFORE_PROCEDURE) return 'danger';
  if (p < 0) return 'decouvert';
  if (p < 1500) return 'tendu';
  return 'sain';
}

export function loanDebt(d: GameState): number {
  return Number(d.player.flags['loanDebt'] ?? 0);
}

/** Remboursement hebdomadaire des prêts en cours */
export function loanPayment(d: GameState): number {
  const debt = loanDebt(d);
  return debt > 0 ? Math.min(debt, Math.max(300, Math.round(debt * 0.04))) : 0;
}

/** Faillite personnelle : tout est vendu, les dettes effacées, la réputation en lambeaux */
export function declareBankruptcy(d: GameState): string[] {
  const p = d.player;
  let recovered = 0;
  for (const a of [...p.assets]) recovered += Math.max(0, salePrice(a, 0.5));
  p.assets = [];
  for (const r of [...p.team]) fireRecruit(d, r.id);
  p.finances.personal = 0;
  p.flags['loanDebt'] = 0;
  p.flags['overdraftWeeks'] = 0;
  const count = Number(p.flags['bankruptcies'] ?? 0) + 1;
  p.flags['bankruptcies'] = count;
  const s = p.stats;
  s.credibility = clamp(s.credibility - 10);
  s.popularity = clamp(s.popularity - 6);
  s.influence = clamp(s.influence - 6);
  s.stress = clamp(s.stress + 15);
  p.scandalExposure = clamp(p.scandalExposure + 8);
  pushNews(d, 'scandale', 'negative', 'Faillite personnelle',
    `Le tribunal prononce le rétablissement personnel. Vos biens sont vendus aux enchères${recovered ? ` (${recovered.toLocaleString('fr-FR')} € pour les créanciers)` : ''}, votre équipe s’en va.`);
  if (count >= 2 && d.status === 'en_cours') {
    d.status = 'defaite';
    d.endTitle = 'Banqueroute';
    d.endReason = 'Deuxième faillite personnelle : interdit·e bancaire, lâché·e par vos soutiens, votre carrière ne s’en relèvera pas.';
  }
  return ['Faillite personnelle'];
}

export function takeLoan(d: GameState, amount: number, total: number): string[] {
  d.player.finances.personal += amount;
  d.player.flags['loanDebt'] = loanDebt(d) + total;
  return [`Prêt de ${amount.toLocaleString('fr-FR')} € (à rembourser : ${total.toLocaleString('fr-FR')} €)`];
}

function procedure(d: GameState): Decision {
  const p = d.player;
  const owed = -p.finances.personal;
  const choices: DecisionChoice[] = [];
  if (p.assets.length) {
    choices.push({
      id: 'vendre', label: 'Vendre vos biens les plus chers',
      effects: [{ kind: 'sellAsset', which: 'any', discount: 0.1 }, { kind: 'sellAsset', which: 'any', discount: 0.1 }, { kind: 'stat', stat: 'stress', delta: 4 }],
      outcome: 'Les biens partent vite, et en dessous de leur prix.',
    });
  }
  choices.push(
    {
      id: 'proche', label: 'Emprunter 10 000 € à un proche',
      effects: [{ kind: 'loan', amount: 10000, total: 11000 }, { kind: 'stat', stat: 'stress', delta: 6 }],
      outcome: 'Votre famille vous dépanne. Il faudra rembourser.',
    },
    {
      id: 'banque', label: 'Négocier un prêt de 20 000 € avec la banque',
      effects: [{ kind: 'loan', amount: 20000, total: 25000 }],
      outcome: 'Le banquier accepte, à un taux qui pique.',
      risk: { baseChance: 0.55, scaleWith: 'credibility', scaleWeight: 0.6, onFailure: [{ kind: 'stat', stat: 'stress', delta: 8 }, { kind: 'exposure', delta: 4 }], failureNews: 'La banque refuse. Le découvert continue de courir.' },
    },
  );
  if (!d.party.founder || (d.partyFinance?.treasury ?? 0) > 20) {
    choices.push({
      id: 'parti', label: 'Demander une avance au parti',
      effects: [{ kind: 'loan', amount: 8000, total: 8000 }, { kind: 'faction', factionId: '*', delta: -5 }, { kind: 'stat', stat: 'politicalCapital', delta: -10 },
        ...(d.party.founder ? [{ kind: 'partyTreasury' as const, delta: -8 }] : [])],
      outcome: 'Le trésorier signe, les courants murmurent.',
    });
  }
  choices.push({
    id: 'faillite', label: 'Déclarer la faillite personnelle',
    hint: Number(p.flags['bankruptcies'] ?? 0) >= 1 ? 'Une deuxième faillite met fin à votre carrière.' : 'Tout est vendu, les dettes effacées. La réputation, elle, ne s’efface pas.',
    effects: [{ kind: 'bankrupt' }],
    outcome: 'Une page se tourne, douloureusement.',
  });
  return {
    id: nextId(d, 'dec'), tag: 'banqueroute', week: d.week, deadlineWeek: d.week, source: 'carriere',
    title: 'Banqueroute : la banque saisit le tribunal',
    context: `Votre découvert atteint ${owed.toLocaleString('fr-FR')} €. Sans solution cette semaine, la procédure de surendettement s’ouvre et la presse s’en mêlera.`,
    choices,
  };
}

export function weeklyBankruptcy(d: GameState, _rng: Rng): void {
  const p = d.player;
  const f = p.finances;
  const pay = loanPayment(d);
  if (pay) {
    f.personal -= pay;
    p.flags['loanDebt'] = loanDebt(d) - pay;
  }
  if (f.personal >= 0) {
    p.flags['overdraftWeeks'] = 0;
    return;
  }
  // Agios
  const agios = Math.max(20, Math.round(-f.personal * 0.015));
  f.personal -= agios;
  const weeks = Number(p.flags['overdraftWeeks'] ?? 0) + 1;
  p.flags['overdraftWeeks'] = weeks;
  p.stats.stress = clamp(p.stats.stress + 3);
  if (weeks === 1) {
    pushNews(d, 'systeme', 'negative', 'Compte à découvert',
      `Agios : ${agios.toLocaleString('fr-FR')} €. Au-delà de ${WEEKS_BEFORE_PROCEDURE} semaines ou de ${(-OVERDRAFT_ALERT).toLocaleString('fr-FR')} € de découvert, la banque saisit le tribunal.`);
  }
  if (f.personal < RUIN && d.status === 'en_cours') {
    d.status = 'defaite';
    d.endTitle = 'Banqueroute';
    d.endReason = `Plus de ${(-RUIN).toLocaleString('fr-FR')} € de dettes : la banque vous lâche, la presse fait ses gros titres et votre parti vous retire tout mandat.`;
    return;
  }
  if ((weeks >= WEEKS_BEFORE_PROCEDURE || f.personal < OVERDRAFT_ALERT) && !d.pendingDecisions.some(x => x.tag === 'banqueroute')) {
    d.pendingDecisions.push(procedure(d));
  }
}

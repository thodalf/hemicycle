import { GameState, RankId } from '../models/game.models';
import { RANKS } from '../data/ranks';
import { partySupport } from './effects';
import { CORPS_BY_ID, civilActive, civilPay, civilTitle } from './civil';
import { payroll } from './recruits';
import { loanPayments } from './loans';
import { weeklyCharges } from './patrimoine';

/* ============================================================
 *  Rémunération : ce que rapportent chaque mois le mandat ou
 *  le métier, la direction du parti, la haute fonction
 *  publique, la presse et le patrimoine. Les deux tiers
 *  partent dans le train de vie : un tiers est mis de côté.
 * ============================================================ */

/** Part de la rémunération épargnée chaque mois */
export const SAVING_RATE = 0.35;

/** Part « métier » des revenus d'un·e militant·e ou d'un·e conseiller·e : remplacée par le traitement de fonctionnaire */
const JOB_PART: Partial<Record<RankId, number>> = { militant: 2400, conseiller_municipal: 2400 };

const BASE_LABEL: Record<RankId, string> = {
  militant: 'Salaire de votre métier',
  conseiller_municipal: 'Salaire et indemnité municipale',
  depute: 'Indemnité parlementaire',
  ministre: 'Traitement de ministre',
  premier_ministre: 'Traitement de Premier·e ministre',
  chef_parti: 'Indemnité d’élu·e',
  candidat_presidence: 'Indemnité d’élu·e',
  president: 'Traitement présidentiel',
  ancien_president: 'Dotation d’ancien·ne président·e',
};

export interface PayLine {
  label: string;
  amount: number;
  note?: string;
  /** Versé directement sur les fonds (pas d'épargne partielle) */
  direct?: boolean;
}

export interface Remuneration {
  lines: PayLine[];
  /** Rémunération totale brute du mois */
  total: number;
  /** Ce qui est mis de côté (part épargnée + versements directs) */
  saved: number;
  charges: PayLine[];
  /** Solde estimé du mois sur les fonds personnels */
  net: number;
}

/** Salaire versé par le parti à son chef ou sa cheffe, selon son poids */
export function partyLeaderPay(d: GameState): number {
  if (d.party.leaderNpcId !== 'player' || d.presidency) return 0;
  return Math.round((2500 + partySupport(d) * 40) / 50) * 50;
}

export function remuneration(d: GameState): Remuneration {
  const p = d.player;
  const rank = RANKS[p.rankId];
  const lines: PayLine[] = [];
  const active = civilActive(d);
  const job = active ? JOB_PART[p.rankId] ?? 0 : 0;
  const base = rank.monthlyIncome - job;
  if (base > 0) lines.push({ label: active && p.rankId === 'conseiller_municipal' ? 'Indemnité municipale' : BASE_LABEL[p.rankId], amount: base });
  if (p.civil) {
    const def = CORPS_BY_ID.get(p.civil.corps)!;
    lines.push(active
      ? { label: `Traitement : ${civilTitle(p.civil)}`, amount: civilPay(p.civil), note: def.name }
      : { label: `${def.name} : en disponibilité`, amount: 0, note: 'Pas de traitement pendant un mandat national' });
  }
  const lead = partyLeaderPay(d);
  if (lead) lines.push({ label: 'Salaire de chef·fe de parti', amount: lead, note: 'Versé par le parti, selon votre soutien interne' });
  if (d.press) lines.push({ label: 'Salaire de journaliste', amount: d.press.salary, direct: true });
  const ch = weeklyCharges(d);
  if (ch.rent) lines.push({ label: 'Loyers perçus', amount: ch.rent, direct: true });

  const total = lines.reduce((t, l) => t + l.amount, 0);
  const savable = lines.filter(l => !l.direct).reduce((t, l) => t + l.amount, 0);
  const direct = total - savable;
  const saved = Math.round(savable * SAVING_RATE) + direct;

  const charges: PayLine[] = [];
  const team = payroll(d);
  if (team) charges.push({ label: 'Salaires de l’équipe', amount: team });
  const loans = loanPayments(d, 'personal');
  if (loans) charges.push({ label: 'Mensualités des prêts', amount: loans });
  if (ch.loans) charges.push({ label: 'Crédits immobiliers', amount: ch.loans });
  if (ch.upkeep) charges.push({ label: 'Entretien des biens', amount: ch.upkeep });
  const net = saved - charges.reduce((t, c) => t + c.amount, 0);
  return { lines, total, saved, charges, net };
}

/** Ce que la rémunération verse sur les fonds chaque mois (hors presse et loyers, versés à part) */
export function monthlySavings(d: GameState): number {
  const r = remuneration(d);
  return Math.round(r.lines.filter(l => !l.direct).reduce((t, l) => t + l.amount, 0) * SAVING_RATE);
}

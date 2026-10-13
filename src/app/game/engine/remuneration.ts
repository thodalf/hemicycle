import { GameState, RankId } from '../models/game.models';
import { RANKS } from '../data/ranks';
import { partySupport, pushNews, teamFunding } from './effects';
import { CORPS_BY_ID, civilActive, civilPay, civilTitle } from './civil';
import { loanPayments } from './loans';
import { weeklyCharges } from './patrimoine';
import { placementEstimate, sideNote, sidePayable } from './side-income';

/* ============================================================
 *  Rémunération : ce que rapportent chaque mois le mandat ou
 *  le métier, la direction du parti, la haute fonction
 *  publique, la presse et le patrimoine. Les deux tiers
 *  partent dans le train de vie : un tiers est mis de côté.
 * ============================================================ */

/** Rangs rémunérés comme membres du gouvernement */
export const MINISTERIAL = new Set<RankId>(['ministre', 'premier_ministre']);

/** En quittant le gouvernement : trois mois de traitement (indemnité de fin de fonctions) */
export function trackMinisterialExit(d: GameState): void {
  const p = d.player;
  const ids = Object.keys(RANKS) as RankId[];
  const idx = p.flags['prevRankIdx'];
  const prev = typeof idx === 'number' ? ids[idx] : undefined;
  if (prev && MINISTERIAL.has(prev) && !MINISTERIAL.has(p.rankId) && p.rankId !== 'president') {
    p.flags['finFonctionsUntil'] = d.week + 3;
    p.flags['finFonctionsAmount'] = RANKS[prev].monthlyIncome;
  }
  p.flags['prevRankIdx'] = ids.indexOf(p.rankId);
}

/** Part de la rémunération épargnée chaque mois */
export const SAVING_RATE = 0.35;

/** Part épargnée, talent « Bon gestionnaire » compris */
export function savingRate(d: GameState): number {
  return SAVING_RATE + 0.05 * (d.player.talents?.['gestionnaire'] ?? 0);
}

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
  /** Salaire que vous pouvez fixer vous-même */
  edit?: 'party' | 'president';
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
  const pct = Number(d.player.flags['partyPayPct'] ?? 0);
  return Math.round(((2500 + partySupport(d) * 40) * (1 + pct / 100)) / 50) * 50;
}

/* ── Fixer son propre salaire ─────────────────────────────── */

export const LEADER_PAY_LIMITS = { party: { min: -50, max: 100 }, president: { min: -30, max: 100 } };
const PAY_COOLDOWN = 6;

export function leaderPayCheck(d: GameState, which: 'party' | 'president'): { ok: boolean; reason?: string } {
  if (which === 'party' && d.party.leaderNpcId !== 'player') return { ok: false, reason: 'Réservé au chef ou à la cheffe du parti' };
  if (which === 'president' && !d.presidency) return { ok: false, reason: 'Réservé au chef de l’État' };
  const last = Number(d.player.flags[which === 'party' ? 'partyPayWeek' : 'presPayWeek'] ?? -99);
  if (d.week - last < PAY_COOLDOWN) return { ok: false, reason: `Déjà modifié : attendre ${PAY_COOLDOWN - (d.week - last)} mois` };
  return { ok: true };
}

/** Conséquences attendues d'un changement de salaire, en clair */
export function leaderPayPreview(d: GameState, which: 'party' | 'president', pct: number): string {
  const old = Number(d.player.flags[which === 'party' ? 'partyPayPct' : 'presPayPct'] ?? 0);
  const delta = pct - old;
  if (!delta) return 'Aucun changement.';
  if (which === 'party') return delta > 0 ? `Les courants grincent (soutien −${Math.round(delta / 10)}), la presse s’en mêle (exposition +${Math.round(delta / 20)}).` : `Geste apprécié des militants (soutien +${Math.round(-delta / 15)}).`;
  return delta > 0 ? `Polémique nationale : cote −${Math.round(delta / 8)}, popularité −${Math.round(delta / 20)}.` : `Geste d’exemplarité : cote +${Math.round(-delta / 12)}.`;
}

export function setLeaderPay(d: GameState, which: 'party' | 'president', pct: number, force = false): string[] {
  if (!force && !leaderPayCheck(d, which).ok) return [];
  const lim = LEADER_PAY_LIMITS[which];
  const value = Math.max(lim.min, Math.min(lim.max, Math.round(pct / 10) * 10));
  const key = which === 'party' ? 'partyPayPct' : 'presPayPct';
  const old = Number(d.player.flags[key] ?? 0);
  const delta = value - old;
  if (!delta) return [];
  d.player.flags[key] = value;
  d.player.flags[which === 'party' ? 'partyPayWeek' : 'presPayWeek'] = d.week;
  const p = d.player;
  const out: string[] = [];
  const c = (v: number) => Math.max(0, Math.min(100, v));
  if (which === 'party') {
    for (const f of d.party.factions) f.supportForPlayer = c(f.supportForPlayer + (delta > 0 ? -delta / 10 : -delta / 15));
    if (delta > 0) { d.party.cohesion = c(d.party.cohesion - delta / 20); p.scandalExposure = c(p.scandalExposure + delta / 20); }
    out.push(`Salaire de chef·fe de parti ${value > 0 ? '+' : ''}${value} %`);
    pushNews(d, 'parti', delta > 0 ? 'negative' : 'positive', delta > 0 ? 'Le chef du parti s’augmente' : 'Le chef du parti baisse son salaire',
      delta > 0 ? 'Les militants qui collent les affiches bénévolement apprécient moyennement.' : 'Un geste salué jusque dans les fédérations les plus frondeuses.');
  } else {
    const pr = d.presidency!;
    pr.approval = c(pr.approval + (delta > 0 ? -delta / 8 : -delta / 12));
    p.stats.popularity = c(p.stats.popularity + (delta > 0 ? -delta / 20 : -delta / 30));
    if (delta > 0) p.scandalExposure = c(p.scandalExposure + delta / 15);
    out.push(`Traitement présidentiel ${value > 0 ? '+' : ''}${value} %`);
    pushNews(d, 'actu', delta > 0 ? 'negative' : 'positive', delta > 0 ? `Le président augmente son traitement de ${delta} %` : `Le président baisse son traitement de ${-delta} %`,
      delta > 0 ? '« En pleine crise du pouvoir d’achat ! » L’opposition s’étrangle, les éditorialistes aussi.' : 'Un geste d’exemplarité, salué même par l’opposition.');
  }
  return out;
}

/** Un salaire trop généreux use le crédit, mois après mois */
export function monthlyLeaderPay(d: GameState): void {
  const party = Number(d.player.flags['partyPayPct'] ?? 0);
  if (party > 30 && d.party.leaderNpcId === 'player') for (const f of d.party.factions) f.supportForPlayer = Math.max(0, f.supportForPlayer - 0.3);
  const pres = Number(d.player.flags['presPayPct'] ?? 0);
  if (pres > 30 && d.presidency) d.presidency.approval = Math.max(0, d.presidency.approval - 0.15);
}

export function remuneration(d: GameState): Remuneration {
  const p = d.player;
  const rank = RANKS[p.rankId];
  const lines: PayLine[] = [];
  const active = civilActive(d);
  const job = active ? JOB_PART[p.rankId] ?? 0 : 0;
  const presPct = d.presidency && p.rankId === 'president' ? Number(p.flags['presPayPct'] ?? 0) : 0;
  const base = Math.round((rank.monthlyIncome * (1 + presPct / 100)) / 50) * 50 - job;
  if (base > 0) lines.push({ label: active && p.rankId === 'conseiller_municipal' ? 'Indemnité municipale' : BASE_LABEL[p.rankId], amount: base,
    ...(MINISTERIAL.has(p.rankId) ? { note: 'Traitement brut et indemnité de fonction, versés par l’État' } : presPct ? { note: `${presPct > 0 ? '+' : ''}${presPct} % fixé par vous`, edit: 'president' as const } : d.presidency ? { edit: 'president' as const } : {}) });
  if (MINISTERIAL.has(p.rankId)) lines.push({ label: 'Indemnité de député·e', amount: 0, note: 'Suspendue : votre suppléant·e siège à l’Assemblée' });
  const end = Number(p.flags['finFonctionsUntil'] ?? 0);
  if (end > d.week && !MINISTERIAL.has(p.rankId)) {
    lines.push({ label: 'Indemnité de fin de fonctions ministérielles', amount: Number(p.flags['finFonctionsAmount'] ?? 0), note: `Encore ${end - d.week} mois` });
  }
  if (p.civil) {
    const def = CORPS_BY_ID.get(p.civil.corps)!;
    lines.push(active
      ? { label: `Traitement : ${civilTitle(p.civil)}`, amount: civilPay(p.civil), note: def.name }
      : { label: `${def.name} : en disponibilité`, amount: 0, note: 'Pas de traitement pendant un mandat national' });
  }
  const lead = partyLeaderPay(d);
  if (lead) {
    const pct = Number(p.flags['partyPayPct'] ?? 0);
    lines.push({ label: 'Salaire de chef·fe de parti', amount: lead, note: `Versé par le parti, selon votre soutien interne${pct ? ` · ${pct > 0 ? '+' : ''}${pct} % fixé par vous` : ''}`, edit: 'party' });
  }
  if (d.press) lines.push({ label: 'Salaire de journaliste', amount: d.press.salary, direct: true });
  for (const s of p.sideIncomes ?? []) {
    const ok = sidePayable(d, s);
    lines.push({ label: s.label, amount: ok ? s.amount : 0, note: sideNote(d, s), direct: true });
  }
  const interest = placementEstimate(d);
  if (interest) lines.push({ label: Number(p.flags['placement']) === 1 ? 'Intérêts de l’épargne (livret)' : 'Rendement des placements (Bourse, estimé)', amount: interest, direct: true, note: Number(p.flags['placement']) === 2 ? 'Variable : la Bourse monte et descend' : undefined });
  const ch = weeklyCharges(d);
  if (ch.rent) lines.push({ label: 'Loyers perçus', amount: ch.rent, direct: true });

  const total = lines.reduce((t, l) => t + l.amount, 0);
  const savable = lines.filter(l => !l.direct).reduce((t, l) => t + l.amount, 0);
  const direct = total - savable;
  const saved = Math.round(savable * savingRate(d)) + direct;

  const charges: PayLine[] = [];
  const tf = teamFunding(d);
  if (tf.personal) charges.push({ label: 'Salaires de l’équipe (votre part)', amount: tf.personal, note: tf.party ? `Le parti paie ${tf.party.toLocaleString('fr-FR')} € de plus` : undefined });
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
  return Math.round(r.lines.filter(l => !l.direct).reduce((t, l) => t + l.amount, 0) * savingRate(d));
}

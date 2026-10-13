import { GameState, Loan, LoanAccount, LoanKind } from '../models/game.models';
import { RANKS } from '../data/ranks';
import { pushNews } from './effects';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Emprunts : prêt personnel, crédit renouvelable, prêt d'un
 *  proche, prêt de campagne (remboursé par l'État au-delà de
 *  5 % des voix) et avance du parti. Les mensualités tombent
 *  chaque mois ; un endettement au-delà de 35 % des revenus
 *  ferme la porte des banques.
 * ============================================================ */

export interface LoanOffer {
  kind: LoanKind;
  lender: string;
  title: string;
  description: string;
  account: LoanAccount;
  min: number;
  max: number;
  /** Taux annuel */
  rate: number;
  durations: number[];
  ok: boolean;
  reason?: string;
  /** Contrepartie hors argent (capital politique, stress…) */
  strings?: string;
  /** Prêteur précis quand plusieurs offres partagent un type (cultes) */
  lenderId?: string;
}

/** Clé unique d'une offre */
export const offerKey = (o: { kind: LoanKind; lenderId?: string }) => o.lenderId ? `${o.kind}:${o.lenderId}` : o.kind;

/** Taux d'endettement maximal accepté par les banques */
export const MAX_DEBT_RATIO = 0.35;

export function loanDebt(d: GameState): number {
  return (d.player.loans ?? []).reduce((t, l) => t + l.remaining, 0);
}

/** Mensualités dues ce mois-ci */
export function loanPayments(d: GameState, account?: LoanAccount): number {
  return (d.player.loans ?? []).filter(l => !account || l.account === account).reduce((t, l) => t + l.monthly, 0);
}

/** Mensualité d'un prêt amortissable */
export function monthlyPayment(principal: number, rate: number, months: number): number {
  const i = rate / 12;
  if (i === 0) return Math.ceil(principal / months);
  return Math.ceil(((principal * i) / (1 - Math.pow(1 + i, -months))) / 10) * 10;
}

/** Coût total du crédit (intérêts) */
export function loanCost(principal: number, rate: number, months: number): number {
  return rate === 0 ? 0 : Math.max(0, monthlyPayment(principal, rate, months) * months - principal);
}

/** Solidité financière vue par une banque (0-100) */
export function creditScore(d: GameState): number {
  const p = d.player;
  const income = RANKS[p.rankId].monthlyIncome;
  const ratio = loanPayments(d) / income;
  return Math.round(clamp(
    35 + p.stats.credibility * 0.45 + Math.min(20, p.finances.personal / 2000)
    - Number(p.flags['bankruptcies'] ?? 0) * 25 - (p.finances.personal < 0 ? 15 : 0) - ratio * 60
    - Math.max(0, p.scandalExposure - 50) * 0.3,
  ));
}

/** Taux proposé par la banque selon votre solidité */
export function bankRate(d: GameState): number {
  return Math.round(clamp(0.039 + (60 - creditScore(d)) * 0.0011, 0.032, 0.12) * 1000) / 1000;
}

/** Marge de mensualité avant d'atteindre le taux d'endettement maximal */
export function paymentRoom(d: GameState): number {
  return Math.max(0, RANKS[d.player.rankId].monthlyIncome * MAX_DEBT_RATIO - loanPayments(d));
}

function campaignLoans(d: GameState): number {
  return d.player.loans.filter(l => l.account === 'campaign').reduce((t, l) => t + l.remaining, 0);
}

/** Offres de prêt du moment */
export function loanOffers(d: GameState): LoanOffer[] {
  const p = d.player;
  const offers: LoanOffer[] = [];
  const score = creditScore(d);
  const income = RANKS[p.rankId].monthlyIncome;
  const room = paymentRoom(d);
  const blocked = Number(p.flags['bankruptcies'] ?? 0) > 0 && d.week < Number(p.flags['bankBan'] ?? 0);

  // Prêt personnel : jusqu'à sept ans, dans la limite de 35 % d'endettement
  const rate = bankRate(d);
  const byRoom = Math.floor((room * (1 - Math.pow(1 + rate / 12, -84)) / (rate / 12)) / 500) * 500;
  const bankMax = Math.max(0, Math.min(byRoom, Math.round(income * 18 * (score / 70) / 500) * 500));
  offers.push({
    kind: 'banque', lender: 'Votre banque', title: 'Prêt personnel', account: 'personal',
    description: `Taux selon votre solidité financière (${score}/100). Mensualités au plus égales à 35 % de vos revenus.`,
    min: 2000, max: bankMax, rate, durations: [12, 24, 48, 84],
    ok: !blocked && score >= 30 && bankMax >= 2000,
    reason: blocked ? 'Fiché·e à la Banque de France après votre faillite' : score < 30 ? 'Dossier refusé : solidité financière insuffisante' : bankMax < 2000 ? 'Taux d’endettement maximal atteint' : undefined,
  });

  // Crédit renouvelable : facile, rapide, cher
  const revolvingOpen = p.loans.filter(l => l.kind === 'revolving').reduce((t, l) => t + l.remaining, 0);
  offers.push({
    kind: 'revolving', lender: 'Crédit Express', title: 'Crédit renouvelable', account: 'personal',
    description: 'Accordé en dix minutes, sans justificatif. Le taux, lui, ne pardonne pas.',
    min: 500, max: Math.max(0, 6000 - revolvingOpen), rate: 0.19, durations: [6, 12, 24],
    ok: revolvingOpen < 5500 && !blocked,
    reason: blocked ? 'Fiché·e à la Banque de France' : 'Plafond de 6 000 € atteint',
    strings: 'Exposition +2 si la presse l’apprend',
  });

  // Un proche : sans intérêts, mais une seule fois tous les deux ans
  const lastFamily = Number(p.flags['familyLoan'] ?? -99);
  offers.push({
    kind: 'proche', lender: 'Un proche', title: 'Prêt d’un proche', account: 'personal',
    description: 'Sans intérêts ni paperasse. Les repas de famille seront un peu plus tendus.',
    min: 1000, max: 10000, rate: 0, durations: [12, 24],
    ok: d.week - lastFamily >= 24 && !p.loans.some(l => l.kind === 'proche'),
    reason: p.loans.some(l => l.kind === 'proche') ? 'Remboursez d’abord ce que vous devez' : 'Vous avez déjà sollicité votre famille récemment',
    strings: 'Stress +4',
  });

  // Les cultes prêtent à qui a leur confiance : peu d'intérêts, beaucoup d'attentes
  for (const c of d.contacts.filter(x => x.type === 'culte')) {
    const open = p.loans.some(l => l.kind === 'culte' && l.lender === c.name);
    const max = Math.round((3000 + c.power * 150) / 500) * 500;
    offers.push({
      kind: 'culte', lenderId: c.id, lender: c.name, title: `Prêt : ${c.name}`, account: 'personal',
      description: 'Un prêt quasi gratuit, accordé par une communauté qui vous fait confiance. Elle s’en souviendra.',
      min: 2000, max, rate: 0.01, durations: [24, 48],
      ok: c.trust >= 30 && !open && !blocked,
      reason: open ? 'Un prêt est déjà en cours avec elle' : blocked ? 'Fiché·e : même eux hésitent' : `Confiance ${Math.round(c.trust)}/30 : il faut d’abord gagner sa confiance`,
      strings: 'Vous lui devrez des faveurs · exposition +3',
    });
  }

  // Campagne : prêt bancaire au compte de campagne, avance du parti
  const ceiling = p.finances.legalCeiling;
  if (ceiling !== null) {
    const already = campaignLoans(d);
    const max = Math.max(0, Math.round((ceiling * 0.5 - already) / 1000) * 1000);
    offers.push({
      kind: 'campagne', lender: 'Banque du candidat', title: 'Prêt de campagne', account: 'campaign',
      description: 'Versé sur le compte de campagne. Au-delà de 5 % des voix, l’État rembourse une partie des dépenses : le prêt est alors soldé en priorité.',
      min: 5000, max, rate: Math.max(0.03, rate - 0.005), durations: [12, 24],
      ok: !blocked && max >= 5000 && p.stats.credibility >= 20,
      reason: blocked ? 'Fiché·e à la Banque de France' : max < 5000 ? 'Plafond atteint : la moitié des dépenses autorisées' : 'Les banques ne croient pas à votre candidature (crédibilité 20)',
    });
    const fromParty = p.loans.filter(l => l.kind === 'parti').reduce((t, l) => t + l.remaining, 0);
    const partyMax = Math.max(0, Math.round((ceiling * 0.25 - fromParty) / 1000) * 1000);
    const leads = d.party.leaderNpcId === 'player';
    offers.push({
      kind: 'parti', lender: d.party.name, title: 'Avance du parti', account: 'campaign',
      description: leads ? 'Le parti avance l’argent à sa tête de liste, sur sa trésorerie.' : 'Le trésorier du parti vous fait une avance. Les courants s’en souviendront.',
      min: 2000, max: partyMax, rate: 0, durations: [24],
      ok: partyMax >= 2000 && (!d.partyFinance || !leads || d.partyFinance.treasury * 1000 >= partyMax),
      reason: partyMax < 2000 ? 'Le parti a déjà beaucoup avancé' : 'Trésorerie du parti insuffisante',
      strings: leads ? 'Trésorerie du parti débitée' : 'Capital politique −8, courants −2',
    });
  }
  return offers;
}

function addLoan(d: GameState, kind: LoanKind, lender: string, account: LoanAccount, amount: number, rate: number, months: number): Loan {
  const loan: Loan = {
    id: nextId(d, 'pret'), kind, lender, account, principal: amount, remaining: amount, rate,
    monthly: monthlyPayment(amount, rate, months), months, startWeek: d.week,
  };
  d.player.loans.push(loan);
  return loan;
}

/** Souscrire un prêt proposé */
export function borrow(d: GameState, kind: LoanKind, amount: number, months: number, lenderId?: string): string[] {
  const offer = loanOffers(d).find(o => o.kind === kind && (!lenderId || o.lenderId === lenderId));
  if (!offer || !offer.ok || !offer.durations.includes(months)) return [];
  const value = Math.round(Math.min(offer.max, Math.max(offer.min, amount)) / 100) * 100;
  if (value < offer.min || value > offer.max) return [];
  const p = d.player;
  const loan = addLoan(d, kind, offer.lender, offer.account, value, offer.rate, months);
  p.finances[offer.account] += value;
  const out = [`${offer.account === 'campaign' ? 'Compte de campagne' : 'Fonds perso'} +${value.toLocaleString('fr-FR')} €`];
  if (kind === 'proche') { p.flags['familyLoan'] = d.week; p.stats.stress = clamp(p.stats.stress + 4); out.push('Stress +4'); }
  if (kind === 'revolving') p.flags['revolvingUsed'] = Number(p.flags['revolvingUsed'] ?? 0) + 1;
  if (kind === 'culte') {
    const c = d.contacts.find(x => x.id === offer.lenderId);
    if (c) c.balance -= 2;
    p.scandalExposure = clamp(p.scandalExposure + 3);
    out.push('Vous lui devez des faveurs', 'Exposition +3');
  }
  if (kind === 'parti') {
    if (d.party.leaderNpcId === 'player' && d.partyFinance) d.partyFinance.treasury -= value / 1000;
    else {
      p.stats.politicalCapital = clamp(p.stats.politicalCapital - 8);
      for (const f of d.party.factions) f.supportForPlayer = clamp(f.supportForPlayer - 2);
      out.push('Capital politique −8');
    }
  }
  pushNews(d, 'systeme', 'neutral', `${offer.title} : ${value.toLocaleString('fr-FR')} €`,
    `${offer.lender} · ${months} mois à ${(offer.rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % · ${loan.monthly.toLocaleString('fr-FR')} € par mois.`);
  return out;
}

/** Remboursement anticipé (indemnité de 1 %, sauf prêt sans intérêts) */
export function repayCost(l: Loan): number {
  return Math.round(l.remaining * (l.rate > 0 ? 1.01 : 1));
}

export function repayLoan(d: GameState, id: string): string[] {
  const p = d.player;
  const l = p.loans.find(x => x.id === id);
  if (!l) return [];
  const cost = repayCost(l);
  const fromCampaign = l.account === 'campaign' ? Math.min(p.finances.campaign, cost) : 0;
  if (p.finances.personal + fromCampaign < cost) return [];
  p.finances.campaign -= fromCampaign;
  p.finances.personal -= cost - fromCampaign;
  p.loans = p.loans.filter(x => x.id !== id);
  pushNews(d, 'systeme', 'positive', `Prêt soldé par anticipation`, `${l.lender} : ${cost.toLocaleString('fr-FR')} € réglés.`);
  return [`Prêt soldé (−${cost.toLocaleString('fr-FR')} €)`];
}

/** Mensualités du mois : intérêts puis capital, prélevés sur le compte du prêt */
export function monthlyLoans(d: GameState, rng: Rng): number {
  const p = d.player;
  let paid = 0;
  for (const l of [...p.loans]) {
    const interest = Math.round(l.remaining * l.rate / 12);
    const due = Math.min(l.monthly, l.remaining + interest);
    const fromCampaign = l.account === 'campaign' ? Math.min(Math.max(0, p.finances.campaign), due) : 0;
    p.finances.campaign -= fromCampaign;
    p.finances.personal -= due - fromCampaign;
    l.remaining = Math.max(0, l.remaining - (due - interest));
    paid += due;
    if (l.remaining <= 0) {
      p.loans = p.loans.filter(x => x.id !== l.id);
      pushNews(d, 'systeme', 'positive', 'Dernière mensualité', `${l.lender} : prêt de ${l.principal.toLocaleString('fr-FR')} € entièrement remboursé.`);
    }
  }
  // Le crédit renouvelable finit toujours par se savoir
  if (p.loans.some(l => l.kind === 'revolving') && !p.flags['revolvingLeak'] && p.stats.popularity > 30 && rng.chance(0.04)) {
    p.flags['revolvingLeak'] = true;
    p.scandalExposure = clamp(p.scandalExposure + 2);
    pushNews(d, 'actu', 'negative', 'Un élu au crédit revolving ?', 'Un hebdomadaire s’amuse de vos finances personnelles.');
  }
  return paid;
}

/** Ancien effet « loan » (proches, banque, parti en cas de découvert) : devient un vrai prêt */
export function takeLoan(d: GameState, amount: number, total: number, lender = 'Créancier'): string[] {
  d.player.finances.personal += amount;
  const months = 12;
  // Taux implicite (approché) pour retrouver le coût total demandé
  const extra = Math.max(0, total - amount);
  const rate = extra ? Math.min(0.3, (extra / amount) * 2 * 12 / (months + 1)) : 0;
  const loan = addLoan(d, extra ? 'banque' : 'proche', lender, 'personal', amount, rate, months);
  loan.monthly = Math.ceil(total / months / 10) * 10;
  return [`Prêt de ${amount.toLocaleString('fr-FR')} € (à rembourser : ${total.toLocaleString('fr-FR')} €)`];
}

/** Remboursement forfaitaire des dépenses de campagne par l'État */
export function campaignRefund(d: GameState, ceiling: number, score: number, invalidated: boolean): void {
  const p = d.player;
  const spent = p.finances.campaignSpent;
  if (spent <= 0) return;
  if (invalidated || score < 5) {
    if (p.loans.some(l => l.account === 'campaign')) {
      pushNews(d, 'systeme', 'negative', 'Pas de remboursement de l’État',
        invalidated ? 'Comptes rejetés : aucun remboursement. Vos prêts de campagne restent à votre charge.' : `Moins de 5 % des voix : vos prêts de campagne restent entièrement à votre charge.`);
    }
    return;
  }
  let refund = Math.round(Math.min(spent, ceiling * 0.475));
  const total = refund;
  // Le remboursement solde d'abord les prêts de campagne
  for (const l of p.loans.filter(x => x.account === 'campaign')) {
    const part = Math.min(refund, l.remaining);
    l.remaining -= part;
    refund -= part;
    if (l.remaining <= 0) p.loans = p.loans.filter(x => x.id !== l.id);
    else l.monthly = Math.min(l.monthly, monthlyPayment(l.remaining, l.rate, 12));
  }
  p.finances.personal += refund;
  pushNews(d, 'systeme', 'positive', `L’État rembourse ${total.toLocaleString('fr-FR')} € de frais de campagne`,
    `Au-delà de 5 % des voix, l’État prend en charge une partie des dépenses.${refund < total ? ' Vos prêts de campagne sont soldés en priorité.' : ''}${refund > 0 ? ` ${refund.toLocaleString('fr-FR')} € reviennent sur vos fonds personnels.` : ''}`);
}

/** Sauvegardes antérieures : l'ancienne dette globale devient un prêt */
export function migrateLoans(d: GameState): void {
  d.player.loans ??= [];
  const debt = Number(d.player.flags['loanDebt'] ?? 0);
  if (debt > 0 && !d.player.loans.length) {
    const l = addLoan(d, 'ancien', 'Créanciers', 'personal', debt, 0, Math.max(3, Math.ceil(debt / 1300)));
    l.monthly = Math.max(300, Math.round(debt * 0.04 * 4.33 / 10) * 10);
  }
  delete d.player.flags['loanDebt'];
}

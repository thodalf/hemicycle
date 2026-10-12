import {
  BudgetDraft, Effect, FactionId, GameState, MissionId, NationalBudget, PartyLine, Segment, TaxId,
} from '../models/game.models';
import {
  FIXED_SPENDING, MISSIONS, MISSION_RANGE, PARTY_FIXED_COSTS, PARTY_LINES, PIB, TAXES,
} from '../data/budget';
import { SEGMENTS } from '../data/programme';
import { createDecision } from '../data/decisions';
import { applyEffects, partySupport, pushNews } from './effects';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Budget du parti (mensuel) et loi de finances (semestrielle).
 * ============================================================ */

const round1 = (n: number) => Math.round(n * 10) / 10;

// ── Parti ───────────────────────────────────────────────────

export function playerLeadsParty(d: GameState): boolean {
  return d.party.leaderNpcId === 'player';
}

export function ensurePartyFinance(d: GameState): void {
  if (d.partyFinance || !playerLeadsParty(d)) return;
  d.partyFinance = {
    treasury: 1500,
    members: 60000,
    fee: 40,
    allocations: Object.fromEntries(PARTY_LINES.map(l => [l.id, l.base])) as Record<PartyLine, number>,
    lastSettledWeek: d.week,
    history: [{ week: d.week, treasury: 1500, members: 60000, balance: 0 }],
  };
  pushNews(d, 'parti', 'neutral', 'Vous héritez des finances du parti',
    'Trésorerie : 1,5 M€. À vous de répartir les dépenses mensuelles.');
}

/**
 * Taille relative du parti : 1 pour les grands partis historiques. Un parti fondé par le joueur
 * démarre minuscule et grandit avec ses adhérents : recettes, frais et postes de dépense suivent.
 */
export function partyScale(d: GameState): number {
  const f = d.partyFinance;
  if (!f || !d.party.founder) return 1;
  return clamp(f.members / 60000, 0.05, 1);
}

export interface PartyReport {
  efficiency: number;
  income: { cotisations: number; publicFunding: number; dons: number; total: number };
  expenses: { lines: number; fixed: number; total: number };
  balance: number;
  membersRate: number;
  weeksToSettle: number;
}

export function partyReport(d: GameState): PartyReport | null {
  const f = d.partyFinance;
  if (!f) return null;
  const a = f.allocations;
  const k = partyScale(d);
  const efficiency = clamp(a.permanents / (180 * k), 0.5, 1.15);
  const cotisations = (f.members * f.fee) / 12 / 1000;
  const publicFunding = (200 + d.player.stats.popularity * 2) * k;
  const dons = (30 + d.player.stats.influence * 0.8) * Math.max(k, 0.35) + a.communication * 0.05;
  const income = cotisations + publicFunding + dons;
  const lines = PARTY_LINES.reduce((s, l) => s + a[l.id], 0);
  const fixed = round1(PARTY_FIXED_COSTS * k);
  const total = lines + fixed;
  const membersRate = (d.player.stats.popularity - 40) / 1500
    + (a.formation / k * efficiency) / 100 * 0.006
    + (a.federations / k * efficiency) / 100 * 0.004
    - Math.max(0, f.fee - 40) / 1000
    + (d.party.founder && k < 1 ? 0.025 : 0);
  return {
    efficiency,
    income: { cotisations: round1(cotisations), publicFunding: round1(publicFunding), dons: round1(dons), total: round1(income) },
    expenses: { lines, fixed, total },
    balance: round1(income - total),
    membersRate,
    weeksToSettle: Math.max(0, f.lastSettledWeek + 4 - d.week),
  };
}

/** Clôture mensuelle : recettes, dépenses, effets des postes, adhérents */
export function settlePartyMonth(d: GameState, rng: Rng): void {
  const f = d.partyFinance;
  if (!f || !playerLeadsParty(d) || d.week - f.lastSettledWeek < 4) return;
  const r = partyReport(d)!;
  const k = partyScale(d);
  // Les effets des postes se mesurent à la taille du parti
  const a = Object.fromEntries(Object.entries(f.allocations).map(([key, v]) => [key, v / k])) as typeof f.allocations;
  const e = r.efficiency;

  const effects: Effect[] = [
    { kind: 'stat', stat: 'popularity', delta: round1((a.communication / 100) * 0.8 * e) },
    { kind: 'faction', factionId: '*', delta: round1(((a.formation / 100) * 0.7 + (a.evenements / 100) * 0.9) * e) },
    { kind: 'cohesion', delta: round1((((a.federations - 80) / 100) * 2 + a.evenements / 100) * e) },
    { kind: 'stat', stat: 'influence', delta: round1(((a.evenements / 100) * 0.7 + a.federations / 200) * e) },
  ];
  if (d.player.finances.legalCeiling !== null) effects.push({ kind: 'momentum', delta: round1((a.communication / 50) * e) });
  if (f.allocations.campagne) effects.push({ kind: 'funds', account: 'campaign', delta: f.allocations.campagne * 1000 });
  applyEffects(d, effects.filter(x => !('delta' in x) || x.delta !== 0), {}, rng);

  const before = f.members;
  f.members = Math.max(d.party.founder ? 200 : 5000, Math.round(f.members * (1 + r.membersRate + rng.range(-0.003, 0.003))));
  f.treasury = round1(f.treasury + r.balance);
  if (f.treasury < 0) f.treasury = round1(f.treasury * 1.01);
  f.lastSettledWeek = d.week;
  f.history.push({ week: d.week, treasury: f.treasury, members: f.members, balance: r.balance });
  if (f.history.length > 13) f.history.shift();

  const diff = f.members - before;
  pushNews(d, 'parti', r.balance >= 0 ? 'positive' : 'negative', 'Clôture mensuelle des comptes du parti',
    `Solde ${r.balance >= 0 ? '+' : ''}${r.balance} k€ · trésorerie ${f.treasury} k€ · ${f.members.toLocaleString('fr-FR')} adhérents (${diff >= 0 ? '+' : ''}${diff.toLocaleString('fr-FR')}).`);

  if (f.treasury < -1500 * k) {
    const decision = createDecision('faillite_parti', d, rng, {});
    if (decision) d.pendingDecisions.push(decision);
  } else if (f.treasury < 400 * k && rng.chance(0.3)) {
    const decision = createDecision('don_suspect', d, rng, {});
    if (decision) d.pendingDecisions.push(decision);
  }
}

// ── État ────────────────────────────────────────────────────

export const OTHER_REVENUE = 30;

export function baseDraft(): BudgetDraft {
  return {
    missions: Object.fromEntries(MISSIONS.map(m => [m.id, m.base])) as Record<MissionId, number>,
    taxes: Object.fromEntries(TAXES.map(t => [t.id, t.base])) as Record<TaxId, number>,
  };
}

export function budgetYear(week: number): number {
  return 2028 + Math.floor((week - 1) / 52);
}

export function canHandleNationalBudget(d: GameState): boolean {
  return d.player.rankId === 'ministre' || d.player.rankId === 'premier_ministre' || d.player.rankId === 'president';
}

export function nationalBudgetBlocking(d: GameState): boolean {
  const nb = d.nationalBudget;
  return !!nb && nb.pending && canHandleNationalBudget(d) && d.week >= nb.deadlineWeek;
}

export function openBudgetCycle(d: GameState, deadlineIn = 3): void {
  const previous = d.nationalBudget;
  const nb: NationalBudget = {
    year: budgetYear(d.week),
    pending: true,
    deadlineWeek: d.week + deadlineIn,
    nextDueWeek: d.week + 26,
    draft: previous ? structuredClone(previous.draft) : baseDraft(),
    rejected: false,
    debtPenalty: previous?.debtPenalty ?? 0,
    history: previous?.history ?? [],
  };
  d.nationalBudget = nb;
  pushNews(d, 'actu', 'neutral', `Projet de loi de finances ${nb.year}`,
    `À arbitrer et soumettre à l’Assemblée avant la semaine ${nb.deadlineWeek}.`);
}

export function weeklyNationalBudget(d: GameState): void {
  if (!canHandleNationalBudget(d)) return;
  const nb = d.nationalBudget;
  if (!nb) openBudgetCycle(d);
  else if (!nb.pending && d.week >= nb.nextDueWeek) openBudgetCycle(d);
}

export interface NationalReport {
  missions: { id: MissionId; label: string; value: number; base: number; pct: number }[];
  spending: number;
  revenue: number;
  deficit: number;
  deficitPct: number;
  segments: { id: Segment; label: string; weight: number; score: number }[];
  position: number;
  factions: { id: FactionId; name: string; delta: number }[];
  popularityDelta: number;
  credibilityDelta: number;
  voteChance: number;
  cuts: { label: string; protest: string }[];
  warnings: string[];
}

export function nationalReport(d: GameState, draft: BudgetDraft = d.nationalBudget?.draft ?? baseDraft()): NationalReport {
  const nb = d.nationalBudget;
  const missions = MISSIONS.map(m => ({
    id: m.id, label: m.label, value: draft.missions[m.id], base: m.base,
    pct: round1(((draft.missions[m.id] - m.base) / m.base) * 100),
  }));
  const spending = missions.reduce((s, m) => s + m.value, 0) + FIXED_SPENDING.dette + (nb?.debtPenalty ?? 0) + FIXED_SPENDING.autres;
  const revenue = TAXES.reduce((s, t) => s + t.revenue + (draft.taxes[t.id] - t.base) * t.perUnit, 0) + OTHER_REVENUE;
  const deficit = spending - revenue;
  const deficitPct = (deficit / PIB) * 100;

  const segScore: Record<Segment, number> = { jeunes: 0, retraites: 0, populaires: 0, cadres: 0, ruraux: 0 };
  let lean = 0;
  for (const m of MISSIONS) {
    const pct = ((draft.missions[m.id] - m.base) / m.base) * 100;
    for (const [s, v] of Object.entries(m.appeal) as [Segment, number][]) segScore[s] += (pct / 10) * v;
    lean += (pct / 10) * m.lean * 8;
  }
  for (const t of TAXES) {
    const delta = draft.taxes[t.id] - t.base;
    for (const [s, v] of Object.entries(t.appeal) as [Segment, number][]) segScore[s] += delta * v;
    lean += delta * t.lean;
  }
  const position = clamp(lean * 1.2, -100, 100);
  const segments = SEGMENTS.map(s => ({ ...s, score: round1(segScore[s.id]) }));

  const cuts = MISSIONS.filter(m => (draft.missions[m.id] - m.base) / m.base <= -0.1).map(m => ({ label: m.label, protest: m.cutProtest }));
  const boosts = MISSIONS.filter(m => (draft.missions[m.id] - m.base) / m.base >= 0.1).length;
  const popularityDelta = round1(
    segments.reduce((s, x) => s + x.weight * clamp(x.score, -12, 12), 0) * 0.4 - cuts.length * 1.5 + boosts * 0.5,
  );
  const credibilityDelta = deficitPct <= 3 ? 4 : deficitPct <= 4.5 ? 1 : deficitPct <= 6 ? -3 : -8;

  const factions = d.party.factions.map(f => ({
    id: f.id as FactionId, name: f.name,
    delta: Math.round(clamp(((25 - Math.abs(position - f.position)) / 25) * 5, -6, 6)),
  }));

  const voteChance = clamp(
    0.55 + (partySupport(d) - 50) / 150 + (d.player.dossiers.economie.mastery - 40) / 200
      - Math.abs(position - d.party.position) / 300 - (deficitPct > 6 ? 0.15 : 0) - cuts.length * 0.03,
    0.08, 0.95,
  );

  const warnings: string[] = [];
  if (deficitPct > 3) warnings.push('Bruxelles : au-delà de 3 %, une procédure pour déficit excessif est possible.');
  if (deficitPct > 6) warnings.push('Les marchés s’inquiètent : la charge de la dette augmentera de 3 Md€ l’an prochain.');
  if (draft.taxes.tva > 21) warnings.push('Une hausse de TVA au-delà de 21 % sera très impopulaire.');
  if (draft.taxes.energie >= 15) warnings.push('Une forte hausse sur les carburants peut embraser les zones rurales.');

  return {
    missions, spending: round1(spending), revenue: round1(revenue), deficit: round1(deficit),
    deficitPct: Math.round(deficitPct * 100) / 100, segments, position, factions,
    popularityDelta, credibilityDelta, voteChance, cuts, warnings,
  };
}

export function setMission(d: GameState, id: MissionId, value: number): void {
  const nb = d.nationalBudget;
  const m = MISSIONS.find(x => x.id === id);
  if (!nb || !nb.pending || !m) return;
  nb.draft.missions[id] = round1(clamp(value, m.base * (1 - MISSION_RANGE), m.base * (1 + MISSION_RANGE)));
}

export function setTax(d: GameState, id: TaxId, value: number): void {
  const nb = d.nationalBudget;
  const t = TAXES.find(x => x.id === id);
  if (!nb || !nb.pending || !t) return;
  nb.draft.taxes[id] = clamp(value, t.min, t.max);
}

export function resetDraft(d: GameState): void {
  if (d.nationalBudget?.pending) d.nationalBudget.draft = baseDraft();
}

function adopt(d: GameState, rng: Rng, via: 'vote' | '49.3'): string[] {
  const nb = d.nationalBudget!;
  const r = nationalReport(d);
  const effects: Effect[] = [
    { kind: 'stat', stat: 'popularity', delta: r.popularityDelta },
    { kind: 'stat', stat: 'credibility', delta: r.credibilityDelta },
    { kind: 'stance', delta: Math.round(0.3 * (r.position - d.player.stance)) },
    { kind: 'dossier', domain: 'economie', delta: 8 },
  ];
  for (const f of r.factions) if (f.delta) effects.push({ kind: 'faction', factionId: f.id, delta: f.delta });
  if (via === '49.3') {
    effects.push({ kind: 'stat', stat: 'popularity', delta: -4 }, { kind: 'cohesion', delta: -8 }, { kind: 'stat', stat: 'credibility', delta: -2 });
  }
  const summary = applyEffects(d, effects, {}, rng);
  for (const c of r.cuts) pushNews(d, 'actu', 'negative', c.protest, `Conséquence de la baisse des crédits : ${c.label}.`);
  if (r.deficitPct > 6) nb.debtPenalty += 3;
  nb.history.push({ year: nb.year, deficitPct: r.deficitPct, via });
  nb.pending = false;
  nb.rejected = false;
  nb.nextDueWeek = d.week + 26;
  pushNews(d, 'actu', r.deficitPct <= 4.5 ? 'positive' : 'negative',
    `Loi de finances ${nb.year} adoptée${via === '49.3' ? ' par le 49.3' : ''} : déficit ${r.deficitPct.toFixed(1).replace('.', ',')} % du PIB`,
    summary.join(' · '));
  return summary;
}

/** Vote à l'Assemblée. Renvoie true si le budget est adopté. */
export function submitBudget(d: GameState, rng: Rng): boolean {
  const nb = d.nationalBudget;
  if (!nb?.pending || nb.rejected) return false;
  const r = nationalReport(d);
  if (rng.chance(r.voteChance)) {
    adopt(d, rng, 'vote');
    return true;
  }
  nb.rejected = true;
  pushNews(d, 'actu', 'negative', `L’Assemblée rejette le budget ${nb.year}`, 'Engager le 49.3 ou revoir la copie ?');
  return false;
}

export function force493(d: GameState, rng: Rng): void {
  const nb = d.nationalBudget;
  if (!nb?.pending || !nb.rejected) return;
  adopt(d, rng, '49.3');
  const censure = clamp(0.2 + (50 - partySupport(d)) / 200, 0.05, 0.6);
  const fell = rng.chance(censure);
  if (fell && d.presidency) {
    // À l'Élysée, c'est le gouvernement qui tombe, pas le président
    applyEffects(d, [{ kind: 'presidency', pm: true, majority: -8, approval: -4 }, { kind: 'stat', stat: 'influence', delta: -4 }], {}, rng);
    pushNews(d, 'actu', 'negative', 'Motion de censure adoptée : le gouvernement tombe', `Vous nommez ${d.presidency.primeMinister} à Matignon.`);
  } else if (fell) {
    applyEffects(d, [{ kind: 'rank', rankId: 'depute' }, { kind: 'stat', stat: 'influence', delta: -10 }], {}, rng);
    pushNews(d, 'actu', 'negative', 'Motion de censure adoptée : le gouvernement tombe',
      'Vous retrouvez votre siège de député·e.');
  } else {
    pushNews(d, 'actu', 'neutral', 'La motion de censure échoue de peu', 'Le gouvernement survit.');
  }
}

export function reviseBudget(d: GameState, rng: Rng): void {
  const nb = d.nationalBudget;
  if (!nb?.pending || !nb.rejected) return;
  nb.rejected = false;
  nb.deadlineWeek = Math.max(nb.deadlineWeek, d.week + 1);
  applyEffects(d, [{ kind: 'stat', stat: 'credibility', delta: -1 }], {}, rng);
}


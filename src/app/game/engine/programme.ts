import {
  DOMAINS, DebateCard, Effect, FactionId, GameState, ProgramOption, Segment,
} from '../models/game.models';
import { PROGRAM, PROGRAM_BY_ID, SEGMENTS } from '../data/programme';
import { stanceLabel } from '../data/world';
import { applyEffects, pushNews } from './effects';
import { Rng } from './rng';

/* ============================================================
 *  Programme présidentiel : bilan (position, coût, cohérence,
 *  électorats, courants) et conséquences de sa présentation.
 * ============================================================ */

export type Coherence = 'coherent' | 'equilibre' | 'attrape_tout';
export type Funding = 'austerite' | 'credible' | 'tendu' | 'non_finance';

export interface ProgramReport {
  answered: number;
  total: number;
  position: number;
  spread: number;
  coherence: Coherence;
  cost: number;
  funding: Funding;
  segments: { id: Segment; label: string; weight: number; score: number }[];
  factions: { id: FactionId; name: string; delta: number }[];
  /** Points de score électoral à la présidentielle */
  electoralBonus: number;
}

export const COHERENCE_LABELS: Record<Coherence, string> = {
  coherent: 'Cohérent', equilibre: 'Équilibré', attrape_tout: 'Attrape-tout',
};
export const FUNDING_LABELS: Record<Funding, string> = {
  austerite: 'Austérité', credible: 'Financé', tendu: 'Tendu', non_finance: 'Non financé',
};

export function chosenOptions(d: GameState): { option: ProgramOption; questionId: string }[] {
  const answers = d.program?.answers ?? {};
  return Object.entries(answers).flatMap(([qid, oid]) => {
    const option = PROGRAM_BY_ID.get(qid)?.options.find(o => o.id === oid);
    return option ? [{ option, questionId: qid }] : [];
  });
}

export function programReport(d: GameState): ProgramReport {
  const chosen = chosenOptions(d).map(c => c.option);
  const n = chosen.length;
  const position = n ? chosen.reduce((s, o) => s + o.position, 0) / n : d.player.stance;
  const spread = n ? Math.sqrt(chosen.reduce((s, o) => s + (o.position - position) ** 2, 0) / n) : 0;
  const cost = chosen.reduce((s, o) => s + o.cost, 0);

  const coherence: Coherence = spread < 32 ? 'coherent' : spread < 45 ? 'equilibre' : 'attrape_tout';
  const funding: Funding = cost < -10 ? 'austerite' : cost <= 45 ? 'credible' : cost <= 80 ? 'tendu' : 'non_finance';

  const segments = SEGMENTS.map(s => ({
    ...s,
    score: chosen.reduce((sum, o) => sum + (o.appeal[s.id] ?? 0), 0),
  }));

  const factions = d.party.factions.map(f => ({
    id: f.id, name: f.name,
    delta: n ? Math.round(Math.max(-8, Math.min(8, ((25 - Math.abs(position - f.position)) / 25) * 6))) : 0,
  }));

  const segmentBonus = segments.reduce((s, x) => s + x.weight * Math.max(-12, Math.min(12, x.score)), 0) * 0.5;
  const coherenceBonus = { coherent: 2, equilibre: 0, attrape_tout: -3 }[coherence];
  const fundingBonus = { austerite: -2, credible: 1, tendu: -1, non_finance: -4 }[funding];
  const electoralBonus = Math.round((segmentBonus + coherenceBonus + fundingBonus) * 10) / 10;

  return { answered: n, total: PROGRAM.length, position, spread, coherence, cost, funding, segments, factions, electoralBonus };
}

/** Le programme est à construire : campagne présidentielle ouverte et programme non présenté */
export function programPending(d: GameState): boolean {
  if (!d.program || d.program.validated) return false;
  return d.elections.some(e => !e.resolved && e.type === 'presidentielle' && d.week >= e.campaignStartWeek);
}

/** Présenter le programme : ligne politique, courants, dossiers, crédibilité */
export function validateProgram(d: GameState, rng: Rng): string[] {
  if (!d.program || d.program.validated) return [];
  const report = programReport(d);
  if (report.answered < report.total) return [];

  const effects: Effect[] = [
    { kind: 'stance', delta: Math.round(0.6 * (report.position - d.player.stance)) },
    { kind: 'momentum', delta: 10 },
  ];
  for (const f of report.factions) if (f.delta) effects.push({ kind: 'faction', factionId: f.id, delta: f.delta });
  for (const domain of DOMAINS) effects.push({ kind: 'dossier', domain, delta: 16 });
  const cred = { coherent: 4, equilibre: 1, attrape_tout: -5 }[report.coherence]
    + { austerite: 0, credible: 3, tendu: -2, non_finance: -8 }[report.funding];
  if (cred) effects.push({ kind: 'stat', stat: 'credibility', delta: cred });
  if (report.funding === 'austerite') effects.push({ kind: 'stat', stat: 'popularity', delta: -3 });

  const raw = applyEffects(d, effects, {}, rng);
  const dossierLine = raw.find(l => l.startsWith('Dossier'));
  const summary = raw.filter(l => !l.startsWith('Dossier'));
  if (dossierLine) summary.push(`Tous les dossiers ${dossierLine.replace('Dossier ', '')}`);
  d.program.validated = true;
  d.program.validatedWeek = d.week;
  const sign = report.cost > 0 ? '+' : '';
  pushNews(d, 'election', report.coherence === 'attrape_tout' || report.funding === 'non_finance' ? 'negative' : 'positive',
    `Programme présenté : ${stanceLabel(report.position)}, ${COHERENCE_LABELS[report.coherence].toLowerCase()}`,
    `Coût net ${sign}${report.cost} Md€/an (${FUNDING_LABELS[report.funding].toLowerCase()}). ${summary.join(' · ')}`);
  return summary;
}

/** Cartes de débat tirées du programme : deux mesures par domaine */
export function programCards(d: GameState, rng: Rng): Omit<DebateCard, 'id'>[] {
  const report = programReport(d);
  const chosen = chosenOptions(d);
  const malus = report.funding === 'non_finance' ? 0.85 : 1;
  const cards: Omit<DebateCard, 'id'>[] = [];
  for (const domain of DOMAINS) {
    const inDomain = chosen.filter(c => PROGRAM_BY_ID.get(c.questionId)!.domain === domain);
    const picks = inDomain.map(c => ({ c, k: rng.next() })).sort((a, b) => a.k - b.k).slice(0, 2).map(x => x.c);
    for (const { option } of picks) {
      const bold = Math.abs(option.position) >= 50;
      const power = bold
        ? 28 + d.player.stats.popularity * 0.35
        : 24 + d.player.dossiers[domain].mastery * 0.55 + d.player.skills[domain] * 4;
      cards.push({
        move: bold ? 'emotion' : 'faits', domain, special: 'programme',
        lean: option.position <= -20 ? -1 : option.position >= 20 ? 1 : undefined,
        label: option.label, power: power * malus,
      });
    }
  }
  return cards;
}

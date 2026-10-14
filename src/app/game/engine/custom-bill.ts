import { AssemblyVote, CustomBill, DOMAIN_LABELS, Domain, Effect, GameState } from '../models/game.models';
import { assemblyGroups, forecast, governingIds, ownOrigin, scheduleVote, voteRole } from './assembly';
import { applyEffects, pushNews } from './effects';
import { economy } from './country';
import { Rng, clamp, fr, nextId } from './rng';

/* ============================================================
 *  Le projet de loi sur mesure : le joueur choisit le nom, le
 *  domaine, l'orientation (gauche ↔ droite) et l'ampleur ; le jeu
 *  calcule le coût budgétaire, le prix politique, l'accueil de
 *  l'opinion et les chances d'adoption. Le texte part aussitôt
 *  à l'Assemblée, où se joue le scrutin.
 * ============================================================ */

export interface BillDraft {
  title: string;
  domain: Domain;
  lean: number;
  scale: 1 | 2 | 3;
}

export const SCALE_LABELS: Record<1 | 2 | 3, string> = { 1: 'Modeste', 2: 'Ambitieuse', 3: 'Historique' };

/** Coût budgétaire de base (Md€ par an) d'une réforme ambitieuse, par domaine */
const DOMAIN_BUDGET: Record<Domain, number> = {
  sante: 4, education: 3.5, social: 5, ecologie: 3, securite: 2, justice: 1.5, numerique: 1.2, territoires: 2.5, economie: 3, diplomatie: 1,
};
/** Popularité naturelle des réformes du domaine */
const DOMAIN_OPINION: Partial<Record<Domain, number>> = { sante: 7, education: 5, securite: 4, ecologie: 2, economie: -3, diplomatie: -2, justice: -1 };

export const SUGGESTED_TITLES: Record<Domain, string[]> = {
  sante: ['Loi pour l’hôpital de proximité', 'Plan zéro désert médical', 'Loi grand âge et autonomie'],
  education: ['Loi pour l’école de la confiance', 'Plan lecture à 6 ans', 'Loi sur le métier d’enseignant'],
  social: ['Loi pour le pouvoir d’achat', 'Réforme du travail', 'Loi logement pour tous'],
  ecologie: ['Loi climat et territoires', 'Plan rénovation thermique', 'Loi zéro artificialisation'],
  securite: ['Loi sécurité du quotidien', 'Plan police de proximité', 'Loi sur la sécurité des transports'],
  justice: ['Loi pour une justice plus rapide', 'Réforme pénitentiaire', 'Loi sur la protection des victimes'],
  numerique: ['Loi pour la souveraineté numérique', 'Loi contre le harcèlement en ligne', 'Plan fibre partout'],
  territoires: ['Loi pour la ruralité', 'Pacte des villes moyennes', 'Loi mobilités du quotidien'],
  economie: ['Loi pour l’industrie française', 'Réforme de la fiscalité', 'Loi PME et artisans'],
  diplomatie: ['Loi de programmation de l’aide au développement', 'Loi souveraineté et alliances', 'Pacte pour l’Europe de la défense'],
};

export function leanLabel(lean: number): string {
  return lean <= -60 ? 'très à gauche' : lean <= -20 ? 'à gauche' : lean < 20 ? 'au centre' : lean < 60 ? 'à droite' : 'très à droite';
}

export interface BillQuote {
  ap: number;
  energy: number;
  politicalCapital: number;
  /** Md€ par an : > 0 dépense, < 0 économies */
  budget: number;
  /** Effet sur le déficit (points de PIB) */
  deficit: number;
  opinion: number;
  adoptedChance: number;
  role: AssemblyVote['role'] | null;
  /** Écart avec la ligne du parti */
  partyGap: number;
  notes: string[];
}

/** Le jeu chiffre le texte : coût budgétaire, prix politique, opinion, chances */
export function quoteBill(d: GameState, b: BillDraft): BillQuote {
  const scaleMult = b.scale === 1 ? 0.45 : b.scale === 2 ? 1 : 2.3;
  const base = DOMAIN_BUDGET[b.domain] * scaleMult;
  let budget: number;
  if (b.domain === 'economie') budget = base * (0.6 + Math.abs(b.lean) / 120); // relance à gauche, baisses d'impôts à droite : les deux coûtent
  else if (b.lean <= 0) budget = base * (1 + -b.lean / 110);
  else budget = base * (0.7 - b.lean / 70); // à droite : plus d'économies que de dépenses
  budget = Math.round(budget * 10) / 10;
  const mastery = d.player.dossiers[b.domain]?.mastery ?? 30;
  const partyGap = Math.abs(b.lean - d.party.position);
  const notes: string[] = [];
  let pc = 6 + 7 * b.scale + partyGap * 0.12;
  if (mastery < 40) { pc += 6; notes.push('Dossier mal maîtrisé : il faudra plus de capital pour convaincre.'); }
  if (mastery >= 70) { pc -= 4; notes.push('Vous maîtrisez le dossier : le texte se défend tout seul.'); }
  if (partyGap > 45) notes.push('Loin de la ligne du parti : vos camarades renâclent.');
  const opinion = clamp(Math.round(60 - Math.abs(b.lean) * 0.28 + (DOMAIN_OPINION[b.domain] ?? 0) - (b.scale - 1) * 4 - Math.max(0, budget) * 0.6), 18, 82);
  const role = voteRole(d);
  let adoptedChance = 0;
  if (role) {
    const temp = draftVote(d, b, opinion, role);
    adoptedChance = Math.round(forecast(d, temp).adoptedChance * 100);
  }
  if (budget > 6) notes.push('Gros chèque : Bercy et les agences de notation tiqueront.');
  if (budget < 0) notes.push(`Des économies : ${fr(-budget)} Md€ par an, au prix de quelques mécontents.`);
  return {
    ap: b.scale, energy: 4 + 4 * b.scale, politicalCapital: Math.round(Math.max(6, pc)),
    budget, deficit: Math.round((budget / 28) * 100) / 100, opinion, adoptedChance, role, partyGap: Math.round(partyGap), notes,
  };
}

function draftVote(d: GameState, b: BillDraft, opinion: number, role0: AssemblyVote['role']): AssemblyVote {
  const origin = ownOrigin(d);
  const mine = (origin !== 'opposition') === governingIds(d).includes(d.party.id);
  const role = role0 === 'depute' && mine ? 'rapporteur' : role0;
  return {
    id: 'draft', week: d.week, billId: 'draft', title: b.title, summary: '', domain: b.domain, lean: b.lean, opinion, origin, role,
    partyLine: 'pour', swing: 0, moves: [], status: 'debat', mood: 0, own: true,
  };
}

/** Peut-on déposer un texte ce mois-ci ? */
export function canDraft(d: GameState): string | null {
  if (!voteRole(d)) return 'Il faut siéger à l’Assemblée, gouverner ou diriger le parti pour déposer un texte.';
  if (d.vote) return 'Un scrutin est déjà en cours à l’Assemblée.';
  const last = Number(d.player.flags['customBillWeek'] ?? -99);
  if (d.week - last < 2) return 'Un texte par période de deux mois : le précédent est à peine voté.';
  return null;
}

export function canAfford(d: GameState, q: BillQuote): string | null {
  const p = d.player;
  if (p.actionPoints.current < q.ap) return `Il faut ${q.ap} PA`;
  if (p.stats.energy < q.energy) return `Il faut ${q.energy} d’énergie`;
  if (p.stats.politicalCapital < q.politicalCapital) return `Il faut ${q.politicalCapital} de capital politique`;
  return null;
}

/** Déposer le texte : on paie, et il part à l'Assemblée */
export function proposeBill(d: GameState, draft: BillDraft, rng: Rng): string[] {
  const block = canDraft(d);
  const q = quoteBill(d, draft);
  if (block || canAfford(d, q)) return [];
  const p = d.player;
  p.actionPoints.current -= q.ap;
  p.stats.energy = clamp(p.stats.energy - q.energy);
  p.stats.politicalCapital = clamp(p.stats.politicalCapital - q.politicalCapital);
  p.flags['customBillWeek'] = d.week;
  const title = draft.title.trim().slice(0, 80) || SUGGESTED_TITLES[draft.domain][0];
  const bill: CustomBill = {
    id: nextId(d, 'custom'), title, domain: draft.domain, lean: Math.round(draft.lean), scale: draft.scale, budget: q.budget, opinion: q.opinion, week: d.week,
    summary: `Texte ${leanLabel(draft.lean)}, ${draft.scale === 3 ? 'd’une ampleur historique' : draft.scale === 2 ? 'ambitieux' : 'modeste'}, sur ${DOMAIN_LABELS[draft.domain].toLowerCase()}. ${q.budget >= 0 ? `Coût : ${fr(q.budget)} Md€ par an.` : `Économies : ${fr(-q.budget)} Md€ par an.`}`,
  };
  d.customBills = [...(d.customBills ?? []).slice(-19), bill];
  const out = scheduleVote(d, rng, bill.id, ownOrigin(d));
  pushNews(d, 'action', 'neutral', `Vous déposez : ${title}`, bill.summary);
  return [`Projet de loi déposé`, `PA −${q.ap}`, `Capital politique −${q.politicalCapital}`, ...out];
}

export function customBill(d: GameState, id: string): CustomBill | undefined {
  return (d.customBills ?? []).find(b => b.id === id);
}

/** Le texte adopté s'applique : budget, électorats, ligne politique */
export function applyCustomBill(d: GameState, b: CustomBill, rng: Rng): string[] {
  const e = economy(d);
  e.deficit = Math.round((e.deficit + b.budget / 28) * 100) / 100;
  const m = b.scale * Math.min(1, Math.abs(b.lean) / 50 + 0.3);
  const effects: Effect[] = [
    { kind: 'dossier', domain: b.domain, delta: 3 + b.scale * 2 },
    { kind: 'stat', stat: 'credibility', delta: 1 + b.scale },
    { kind: 'stance', delta: Math.round((b.lean - d.player.stance) * 0.06) },
  ];
  if (b.lean < -15) effects.push({ kind: 'segment', segment: 'populaires', delta: Math.round(2 * m) }, { kind: 'segment', segment: 'jeunes', delta: Math.round(1.5 * m) }, { kind: 'segment', segment: 'cadres', delta: -Math.round(1.5 * m) });
  else if (b.lean > 15) effects.push({ kind: 'segment', segment: 'cadres', delta: Math.round(2 * m) }, { kind: 'segment', segment: 'retraites', delta: Math.round(1.5 * m) }, { kind: 'segment', segment: 'populaires', delta: -Math.round(1.5 * m) });
  else effects.push({ kind: 'segment', segment: '*', delta: 1 });
  if (b.scale === 3) effects.push({ kind: 'stat', stat: 'influence', delta: 4 });
  const out = applyEffects(d, effects.filter(x => !('delta' in x) || x.delta !== 0), { domain: b.domain }, rng);
  out.push(b.budget >= 0 ? `Déficit +${fr(b.budget / 28, 2)} pt` : `Déficit −${fr(-b.budget / 28, 2)} pt`);
  return out;
}

/** Combien de groupes soutiendraient le texte (aperçu) */
export function supportPreview(d: GameState, b: BillDraft): { name: string; color: string; seats: number; pos: number }[] {
  return assemblyGroups(d).filter(g => g.partyId !== 'ni').map(g => ({ name: g.name, color: g.color, seats: g.seats, pos: g.position }))
    .filter(g => Math.abs(g.pos - b.lean) <= 40);
}

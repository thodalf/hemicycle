import { AssemblyVote, CustomBill, DOMAIN_LABELS, Decision, Domain, Effect, GameState, Segment } from '../models/game.models';
import { assemblyGroups, censureRisk, forecast, governingIds, ownOrigin, scheduleVote, voteRole } from './assembly';
import { applyEffects, pushNews } from './effects';
import { economy } from './country';
import { decisionActive } from '../data/great-decisions';
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

/* ── Le clivage : une réforme divise ─────────────────────── */

/** Sujets qui enflamment plus ou moins le pays */
const DOMAIN_HEAT: Record<Domain, number> = { social: 18, securite: 15, justice: 12, economie: 12, education: 10, ecologie: 10, sante: 6, diplomatie: 5, territoires: 4, numerique: 3 };
const SEG_LABEL: Record<Segment, string> = { jeunes: 'jeunes', retraites: 'retraités', populaires: 'classes populaires', cadres: 'cadres', ruraux: 'ruraux' };

/** Indice de clivage (0-100) : orientation marquée, ampleur, sujet brûlant, économies */
export function cleavage(lean: number, scale: number, domain: Domain, budget = 0): number {
  return Math.round(clamp(Math.abs(lean) * 0.55 + (scale - 1) * 15 + DOMAIN_HEAT[domain] + (budget < 0 ? 10 : 0), 5, 100));
}

export function cleavageLabel(c: number): string {
  return c >= 75 ? 'explosif' : c >= 55 ? 'fort' : c >= 35 ? 'marqué' : 'faible';
}

/** Qui gagne, qui perd : la gauche parle aux classes populaires et aux jeunes, la droite aux cadres et aux retraités */
export function winnersLosers(lean: number, domain: Domain): { winners: Segment[]; losers: Segment[] } {
  const left: Segment[] = ['populaires', 'jeunes'];
  const right: Segment[] = ['cadres', 'retraites'];
  if (domain === 'territoires' || domain === 'ecologie') (lean < 0 ? left : right).push('ruraux');
  if (Math.abs(lean) < 15) return { winners: [], losers: [] };
  return lean < 0 ? { winners: left, losers: right } : { winners: right, losers: left };
}

/** Une réforme adoptée divise : gagnants et perdants, adversaires furieux, la rue parfois */
export function polarize(d: GameState, title: string, lean: number, scale: number, domain: Domain, budget: number, rng: Rng): string[] {
  const c = cleavage(lean, scale, domain, budget);
  const { winners, losers } = winnersLosers(lean, domain);
  const m = c / 35;
  const effects: Effect[] = [
    ...winners.map(segment => ({ kind: 'segment', segment, delta: Math.round(2 * m) } as Effect)),
    ...losers.map(segment => ({ kind: 'segment', segment, delta: -Math.round(2.2 * m) } as Effect)),
    { kind: 'stat', stat: 'stress', delta: Math.round(c / 20) },
  ];
  // Les courants du parti éloignés du texte grincent
  for (const f of d.party.factions) {
    const gap = Math.abs(f.position - lean);
    if (gap > 40) effects.push({ kind: 'faction', factionId: f.id, delta: -Math.round(gap / 25 * (c / 50)) });
  }
  const out = applyEffects(d, effects.filter(x => !('delta' in x) || x.delta !== 0), { domain }, rng);
  // Le camp d'en face se braque
  let angry = 0;
  for (const n of d.npcs) {
    const party = [d.party, ...d.otherParties].find(p => p.id === n.partyId);
    if (party && n.partyId !== d.party.id && Math.abs(party.position - lean) > 60) { n.relationToPlayer = clamp(n.relationToPlayer - Math.round(c / 12), -100, 100); angry++; }
  }
  if (angry) out.push(`${angry} adversaires se braquent`);
  if (d.presidency && c >= 55) d.presidency.approval = clamp(d.presidency.approval - Math.round((c - 50) / 10));
  d.player.flags['clivage'] = Math.max(Number(d.player.flags['clivage'] ?? 0) * 0.5, c);
  // Au-delà d'un certain seuil, la rue s'en mêle
  if (c >= 55 && rng.chance(c / 130) && !d.pendingDecisions.some(x => x.tag === 'reform_backlash')) {
    d.pendingDecisions.push(backlash(d, title, c, losers));
    out.push('La rue se mobilise');
  }
  pushNews(d, 'actu', c >= 55 ? 'negative' : 'neutral', `${title} : un texte ${c >= 75 ? 'qui déchire' : c >= 55 ? 'qui divise' : 'qui fait débat'}`,
    `Clivage ${c}/100.${winners.length ? ` Satisfaits : ${winners.map(s => SEG_LABEL[s]).join(', ')}.` : ''}${losers.length ? ` En colère : ${losers.map(s => SEG_LABEL[s]).join(', ')}.` : ''}`);
  return out;
}

function backlash(d: GameState, title: string, c: number, losers: Segment[]): Decision {
  const who = losers.length ? losers.map(s => SEG_LABEL[s]).join(' et ') : 'opposants';
  const crowd = Math.round(c * 9000 / 1000) * 1000;
  return {
    id: nextId(d, 'dec'), tag: 'reform_backlash', week: d.week, deadlineWeek: d.week + 1, source: 'evenement',
    title: 'La rue contre votre réforme',
    context: `« ${title} » met ${crowd.toLocaleString('fr-FR')} manifestants dans la rue. Les ${who} réclament le retrait du texte ; les syndicats menacent d’une grève reconductible.`,
    choices: [
      { id: 'tenir', label: 'Tenir bon : « La loi a été votée »', effects: [{ kind: 'stat', stat: 'credibility', delta: 3 }, { kind: 'stat', stat: 'popularity', delta: -Math.round(c / 15) }, { kind: 'stat', stat: 'stress', delta: 6 }],
        outcome: 'Les cortèges s’essoufflent après trois semaines. On salue votre fermeté, on n’oublie pas votre dureté.' },
      { id: 'amender', label: 'Ouvrir une concertation et amender le texte', effects: [{ kind: 'stat', stat: 'credibility', delta: -1 }, { kind: 'stat', stat: 'popularity', delta: 2 }, ...losers.map(segment => ({ kind: 'segment', segment, delta: 2 } as Effect))],
        outcome: 'Quelques mesures adoucies, un calendrier étalé : la colère retombe, vos partisans grognent.' },
      { id: 'retirer', label: 'Suspendre la réforme', effects: [{ kind: 'stat', stat: 'credibility', delta: -Math.round(c / 12) }, { kind: 'stat', stat: 'influence', delta: -3 }, ...losers.map(segment => ({ kind: 'segment', segment, delta: 3 } as Effect))],
        outcome: 'La rue a gagné. Vos adversaires parlent de reculade, vos alliés de trahison.' },
    ],
  };
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
  /** Indice de clivage, gagnants et perdants */
  cleavage: number;
  winners: string[];
  losers: string[];
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
  const cl = cleavage(b.lean, b.scale, b.domain, budget);
  const wl = winnersLosers(b.lean, b.domain);
  if (cl >= 55) notes.push(`Texte ${cleavageLabel(cl)} : risque de mobilisation dans la rue après l’adoption.`);
  if (budget < 0) notes.push(`Des économies : ${fr(-budget)} Md€ par an, au prix de quelques mécontents.`);
  const cc = Math.round(censureRisk(d, b.lean, b.scale) * 100);
  if (cc >= 8) notes.push(`Risque de censure par le Conseil constitutionnel : ${cc} %.`);
  return {
    ap: b.scale, energy: 4 + 4 * b.scale, politicalCapital: Math.round(Math.max(6, pc)) + (decisionActive(d, 'pacte_courants') ? 5 : 0),
    budget, deficit: Math.round((budget / 28) * 100) / 100, opinion, adoptedChance, role, partyGap: Math.round(partyGap), notes,
    cleavage: cl, winners: wl.winners.map(s => SEG_LABEL[s]), losers: wl.losers.map(s => SEG_LABEL[s]),
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
  const effects: Effect[] = [
    { kind: 'dossier', domain: b.domain, delta: 3 + b.scale * 2 },
    { kind: 'stat', stat: 'credibility', delta: 1 + b.scale },
    { kind: 'stance', delta: Math.round((b.lean - d.player.stance) * 0.06) },
  ];
  if (Math.abs(b.lean) < 15) effects.push({ kind: 'segment', segment: '*', delta: 1 });
  if (b.scale === 3) effects.push({ kind: 'stat', stat: 'influence', delta: 4 });
  const out = applyEffects(d, effects.filter(x => !('delta' in x) || x.delta !== 0), { domain: b.domain }, rng);
  out.push(b.budget >= 0 ? `Déficit +${fr(b.budget / 28, 2)} pt` : `Déficit −${fr(-b.budget / 28, 2)} pt`);
  out.push(...polarize(d, b.title, b.lean, b.scale, b.domain, b.budget, rng));
  return out;
}

/** Combien de groupes soutiendraient le texte (aperçu) */
export function supportPreview(d: GameState, b: BillDraft): { name: string; color: string; seats: number; pos: number }[] {
  return assemblyGroups(d).filter(g => g.partyId !== 'ni').map(g => ({ name: g.name, color: g.color, seats: g.seats, pos: g.position }))
    .filter(g => Math.abs(g.pos - b.lean) <= 40);
}

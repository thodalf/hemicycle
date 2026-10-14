import { Decision, Effect, GameState, PlotState } from '../models/game.models';
import { addMilestone, assassinationRisk, die } from './life';
import { pushNews } from './effects';
import { Rng, clamp, nextId, frSigned } from './rng';
import { canStartArc } from './arcs';

/* ============================================================
 *  Le complot : plus d'assassinat « tombé du ciel ». Quand la
 *  menace se concrétise, un complot se noue et se voit venir :
 *  lettres, filatures, informateurs. On enquête, on se protège,
 *  on change ses habitudes. Quand l'imminence atteint 100, la
 *  tentative a lieu ; si l'enquête aboutit avant, arrestations.
 * ============================================================ */

const SUSPECTS = [
  { suspect: 'Un militant radicalisé, seul, très actif sur des forums', motive: 'Il vous tient pour responsable de la fermeture de son usine.' },
  { suspect: 'Un réseau mafieux lié aux marchés publics de la région', motive: 'Votre enquête sur les marchés publics menace leurs affaires.' },
  { suspect: 'Une cellule terroriste suivie par les services', motive: 'Vos prises de position en font une cible symbolique.' },
  { suspect: 'Un ancien proche, humilié et ruiné', motive: 'Il vous accuse d’avoir brisé sa carrière.' },
  { suspect: 'Des agents d’un État étranger hostile', motive: 'Votre ligne diplomatique dérange une puissance étrangère.' },
];

const SIGNS = [
  'Une lettre anonyme glissée sous la porte de la permanence : « Vos jours sont comptés. »',
  'La même voiture grise stationne trois soirs de suite devant chez vous.',
  'Votre agenda public a été consulté des centaines de fois depuis une même adresse.',
  'Un inconnu pose des questions sur vos horaires au café d’en face.',
  'Les pneus de votre voiture ont été crevés pendant un meeting.',
  'Un colis suspect est intercepté au tri postal, adressé à votre nom.',
  'Des photos de votre domicile circulent sur une messagerie cryptée.',
  'Un informateur signale qu’« un contrat » circulerait sur votre tête.',
];

export function plotActive(d: GameState): boolean {
  return !!d.plot && d.status === 'en_cours';
}

/** Ce que l'enquête a révélé */
export function plotKnowledge(p: PlotState): { motive: string | null; suspect: string | null } {
  return { motive: p.intel >= 30 ? p.motive : null, suspect: p.intel >= 60 ? p.suspect : null };
}

export function startPlot(d: GameState, rng: Rng, quiet = false): void {
  if (d.plot || d.status !== 'en_cours') return;
  const s = rng.pick(SUSPECTS);
  d.plot = { since: d.week, danger: 18, intel: 3, suspect: s.suspect, motive: s.motive, signs: [{ week: d.week, text: rng.pick(SIGNS) }] };
  d.player.flags['menace'] = Math.max(Number(d.player.flags['menace'] ?? 0), 30);
  if (!quiet) {
    pushNews(d, 'actu', 'negative', 'Menaces de mort', `${d.plot.signs[0].text} Quelqu’un prépare quelque chose. Onglet Sécurité ouvert.`);
    d.pendingDecisions.push(firstDecision(d));
  }
}

function firstDecision(d: GameState): Decision {
  return {
    id: nextId(d, 'dec'), tag: 'complot_debut', week: d.week, deadlineWeek: d.week + 1, source: 'carriere',
    title: 'Des menaces de mort',
    context: 'Votre équipe a reçu des menaces sérieuses. La police prend l’affaire au sérieux. Il faudra se protéger, et découvrir qui est derrière.',
    choices: [
      { id: 'plainte', label: 'Porter plainte et demander une protection', effects: [{ kind: 'plot', intel: 8 }, { kind: 'flagAdd', key: 'protection', delta: 30 }, { kind: 'stat', stat: 'stress', delta: 4 }],
        outcome: 'Deux policiers vous accompagnent désormais. Une enquête est ouverte.' },
      { id: 'public', label: 'Rendre les menaces publiques', effects: [{ kind: 'plot', intel: 5, danger: 5 }, { kind: 'stat', stat: 'popularity', delta: 3 }],
        outcome: 'Messages de soutien par milliers… et des témoins qui se manifestent.' },
      { id: 'minimiser', label: 'Ne pas en faire une affaire', effects: [{ kind: 'stat', stat: 'stress', delta: -2 }],
        outcome: 'Vous continuez comme si de rien n’était. Le danger, lui, ne s’arrête pas.' },
    ],
  };
}

/** Protection effective : police, GSPR, officier de sécurité, gilet */
export function protectionLevel(d: GameState): number {
  const p = d.player;
  const base = d.presidency ? d.presidency.security : Number(p.flags['protection'] ?? 0);
  return clamp(base + (p.staff.includes('garde_du_corps') ? 25 : 0) + (d.plot?.vest ? 10 : 0));
}

/** Chance de mourir si la tentative a lieu maintenant */
export function attemptLethality(d: GameState): number {
  const p = d.plot;
  if (!p) return 0;
  const prot = protectionLevel(d);
  const known = p.intel >= 60 ? 0.5 : p.intel >= 30 ? 0.75 : 1;
  return clamp(0.4 * (1 - prot / 120) * known * 100, 3, 40) / 100;
}

export function adjustPlot(d: GameState, e: Extract<Effect, { kind: 'plot' }>, rng: Rng): string[] {
  if (e.start) { startPlot(d, rng); return ['Un complot se trame']; }
  const p = d.plot;
  if (!p) return [];
  const out: string[] = [];
  if (e.danger) { p.danger = clamp(p.danger + e.danger); out.push(`Imminence ${frSigned(e.danger)}`); }
  if (e.intel) { p.intel = clamp(p.intel + e.intel); out.push(`Enquête ${frSigned(e.intel)}`); }
  if (e.vest) { p.vest = true; out.push('Gilet pare-balles en public'); }
  if (p.intel >= 100) out.push(...foil(d));
  return out;
}

/** L'enquête aboutit : coup de filet */
function foil(d: GameState): string[] {
  const p = d.plot;
  if (!p) return [];
  d.plot = null;
  const s = d.player.stats;
  s.popularity = clamp(s.popularity + 6);
  s.stress = clamp(s.stress - 10);
  d.player.flags['menace'] = 0;
  d.player.flags['plotsFoiled'] = Number(d.player.flags['plotsFoiled'] ?? 0) + 1;
  const text = `${p.suspect} : interpellations à l’aube. ${p.motive}`;
  pushNews(d, 'actu', 'positive', 'Un projet d’attentat contre vous déjoué', text);
  if (d.scenario !== 'complot' || d.player.flags['complotDone']) addMilestone(d, 'victoire', 'Complot déjoué', text);
  else {
    d.player.flags['complotDone'] = true;
    d.status = 'victoire';
    d.endTitle = 'Le complot déjoué';
    d.endReason = text;
  }
  return ['Complot déjoué'];
}

/** La tentative */
function attempt(d: GameState, rng: Rng): void {
  const p = d.plot!;
  const lethal = attemptLethality(d);
  const prot = protectionLevel(d);
  d.plot = null;
  d.player.flags['menace'] = 0;
  if (rng.chance(lethal)) {
    die(d, 'assassinat', `${p.suspect.charAt(0).toUpperCase()}${p.suspect.slice(1).toLowerCase()} est passé à l’acte. ${p.motive}`);
    return;
  }
  const s = d.player.stats;
  const wounded = rng.chance(0.55 - prot / 250);
  if (wounded) {
    d.player.health = clamp(d.player.health - 30);
    s.stress = clamp(s.stress + 15);
    s.energy = clamp(s.energy - 30);
    s.popularity = clamp(s.popularity + 10);
    addMilestone(d, 'revers', 'Survivant·e d’un attentat', `Blessé·e lors d’une tentative d’assassinat. ${p.motive} Le pays entier vous souhaite un prompt rétablissement.`);
    pushNews(d, 'actu', 'negative', 'Attentat : vous êtes blessé·e', 'Évacuation d’urgence, bloc opératoire, pronostic vital engagé quelques heures. Vous vous en sortez.');
  } else {
    s.popularity = clamp(s.popularity + 6);
    s.stress = clamp(s.stress + 8);
    addMilestone(d, 'victoire', 'Attentat manqué', `Votre protection a fait échouer la tentative. ${p.motive}`);
    pushNews(d, 'actu', 'positive', 'Attentat manqué', 'Vos officiers de sécurité ont maîtrisé l’agresseur. Vous êtes indemne.');
  }
  if (d.scenario === 'complot' && !d.player.flags['complotDone']) {
    d.player.flags['complotDone'] = true;
    d.status = 'victoire';
    d.endTitle = 'Toujours debout';
    d.endReason = 'Le complot a échoué : vous avez survécu.';
  }
}

/** Chaque mois : un complot peut naître ; celui en cours progresse */
export function monthlyPlot(d: GameState, rng: Rng): void {
  if (d.status !== 'en_cours') return;
  if (!d.plot) {
    // Les complots naissent là où le risque d'attentat est réel ; ils se voient venir
    if (canStartArc(d) && rng.chance(assassinationRisk(d) * 8)) startPlot(d, rng);
    return;
  }
  const p = d.plot;
  const prot = protectionLevel(d);
  p.danger = clamp(p.danger + rng.range(6, 12) * (1 - prot / 250));
  p.intel = clamp(p.intel + 1.5 + (d.player.staff.includes('garde_du_corps') ? 2 : 0) + prot / 40);
  if (rng.chance(0.55)) {
    const text = rng.pick(SIGNS);
    p.signs.unshift({ week: d.week, text });
    if (p.signs.length > 6) p.signs.length = 6;
    pushNews(d, 'actu', 'negative', 'Un signe inquiétant', text);
  }
  if (p.danger >= 70 && !d.player.flags[`plotWarn_${p.since}`]) {
    d.player.flags[`plotWarn_${p.since}`] = true;
    pushNews(d, 'actu', 'negative', 'Passage à l’acte imminent', 'Les enquêteurs sont formels : l’attaque pourrait avoir lieu dans les semaines qui viennent. Protégez-vous.');
  }
  if (p.intel >= 100) { foil(d); return; }
  if (p.danger >= 100) attempt(d, rng);
}

/** Une partie où l'assassinat est tombé sans prévenir (avant les complots) : on se réveille à l'hôpital */
export function reviveFromAssassination(d: GameState): void {
  const p = d.player;
  const what = d.death?.text ?? 'Un attentat.';
  d.status = 'en_cours';
  d.death = null;
  d.endTitle = undefined;
  d.endReason = undefined;
  p.health = Math.max(35, Math.min(p.health, 60));
  p.stats.stress = clamp(Math.max(p.stats.stress, 60));
  p.stats.energy = clamp(Math.min(p.stats.energy, 40));
  p.stats.popularity = clamp(p.stats.popularity + 8);
  p.flags['protection'] = Math.max(Number(p.flags['protection'] ?? 0), 60);
  p.flags['menace'] = 0;
  if (d.presidency) d.presidency.security = clamp(Math.max(d.presidency.security, 70));
  addMilestone(d, 'revers', 'Survivant·e d’un attentat', `${what} Laissé·e pour mort·e, vous vous réveillez à l’hôpital, trois jours plus tard.`);
  pushNews(d, 'actu', 'positive', 'Miraculé·e', 'Les chirurgiens ont fait un miracle : vous survivez à l’attentat. Votre protection est renforcée. Désormais, les menaces se verront venir : un complot se prépare, il se découvre.');
}

import { namePool } from '../data/names';
import { Effect, GameState } from '../models/game.models';
import { RANKS } from '../data/ranks';
import { pmDecision } from './cabinet';
import { addMilestone } from './life';
import { pushNews } from './effects';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Le royaume : quand la monarchie est proclamée, c'est vous
 *  qui montez sur le trône d'une monarchie constitutionnelle.
 *  Plus d'élections pour vous ; votre parti vous soutient, tous
 *  les autres font front contre la Couronne. Il faut tenir le
 *  prestige du trône, la stabilité des institutions, et contenir
 *  le front républicain. On peut, à tout moment, rétablir la
 *  République ; une opposition trop forte peut aussi vous y forcer.
 * ============================================================ */

export interface KingdomState {
  since: number;
  /** Prestige du trône (0-100) */
  prestige: number;
  /** Stabilité des institutions (0-100) */
  stabilite: number;
  /** Front républicain : l'opposition de tous les autres partis (0-100) */
  opposition: number;
  title: string;
  /** La cour : table, cérémonial, mécénat, garde (niveaux 0-3) */
  court?: Record<string, number>;
}

export const COURT_AMENITIES: { id: string; label: string; icon: string; levels: string[] }[] = [
  { id: 'table', label: 'La table', icon: '🍷', levels: ['Repas simples', 'Bonne cuisine', 'Chef étoilé', 'Banquets fastueux'] },
  { id: 'ceremonial', label: 'Le cérémonial', icon: '🎺', levels: ['Aucun', 'Discret', 'Solennel', 'Grandiose'] },
  { id: 'mecenat', label: 'Le mécénat', icon: '🎨', levels: ['Aucun', 'Quelques artistes', 'Opéra et musées', 'Siècle des Lumières'] },
  { id: 'garde', label: 'La garde', icon: '💂', levels: ['Gendarmes', 'Garde républicaine', 'Garde d’honneur', 'Régiment d’apparat'] },
];

/** Grandeur de la cour (0-100) : ce que la noblesse attend, ce que le front républicain dénonce */
export function courtGrandeur(k: KingdomState): number {
  const c = k.court ?? {};
  return Math.round(Object.values(c).reduce((s, v) => s + v, 0) * 100 / 12);
}

/** Ce que coûte la cour chaque mois (fonds personnels) */
export function courtCost(k: KingdomState): number {
  return Object.values(k.court ?? {}).reduce((s, v) => s + v * v * 900, 0);
}

export function setCourt(d: GameState, id: string, level: number): void {
  const k = d.kingdom;
  if (!k || !COURT_AMENITIES.some(a => a.id === id)) return;
  k.court = { table: 1, ceremonial: 1, mecenat: 0, garde: 1, ...(k.court ?? {}), [id]: Math.max(0, Math.min(3, level)) };
}

export function sovereignTitle(d: GameState): string {
  return d.player.gender === 'femme' ? 'Reine des Français' : 'Roi des Français';
}

/** La monarchie proclamée : le joueur monte sur le trône */
export function crownPlayer(d: GameState): void {
  if (d.kingdom) return;
  const p = d.player;
  d.kingdom = { since: d.week, prestige: 55, stabilite: 50, opposition: 45, title: sovereignTitle(d) };
  // Le souverain garde les leviers de l'exécutif : Matignon, gouvernement, armée, diplomatie
  if (d.presidency) {
    d.presidency.cohabitation = false;
    d.presidency.approval = Math.max(d.presidency.approval, 50);
  } else {
    d.presidency = { since: d.week, mandates: 1, approval: 55, majority: 50, security: 60, threat: 25, primeMinister: namePool(d.seed, 'premiers-ministres', 1)[0], reforms: 0, cohabitation: false, lastCrisisWeek: d.week };
    d.pendingDecisions.push(pmDecision(d));
  }
  p.rankId = 'roi';
  p.actionPoints.max = RANKS.roi.monthlyActionPoints;
  p.flags['monarchie'] = true;
  // Le prince garde son nom : il a seulement renoncé à ses droits en votre faveur
  if (d.crown) d.crown.renounced = true;
  // Tous les autres partis se dressent contre la Couronne
  for (const n of d.npcs) if (n.partyId !== d.party.id) n.relationToPlayer = Math.min(n.relationToPlayer, -25);
  pushNews(d, 'actu', 'neutral', `Vive ${d.player.gender === 'femme' ? 'la Reine' : 'le Roi'} !`, `Le prétendant renonce en votre faveur : ${p.name} est sacré·e à Reims, ${d.kingdom.title}. Tous les partis, sauf le vôtre, forment un « front républicain ».`);
}

/** Anciennes parties : le souverain sans exécutif en reçoit un */
export function ensureRoyalExecutive(d: GameState): void {
  if (!d.kingdom || d.presidency) return;
  d.presidency = { since: d.week, mandates: 1, approval: 55, majority: 50, security: 60, threat: 25, primeMinister: namePool(d.seed, 'premiers-ministres', 1)[0], reforms: 0, cohabitation: false, lastCrisisWeek: d.week };
}

/** Rétablir la République (abdication volontaire, ou forcée) */
export function restoreRepublic(d: GameState, forced: boolean, how: 'abdication' | 'decheance' | 'revolution' = forced ? 'revolution' : 'abdication'): void {
  const k = d.kingdom;
  if (!k) return;
  const p = d.player;
  const months = d.week - k.since;
  d.kingdom = null;
  d.crown = null;
  d.presidency = null;
  p.flags['monarchie'] = false;
  p.flags['closed_crown'] = true;
  if (!(p.traits ?? []).includes('ancien_souverain')) p.traits = [...(p.traits ?? []), 'ancien_souverain'];
  p.rankId = 'ancien_president';
  p.actionPoints.max = RANKS.ancien_president.monthlyActionPoints;
  p.actionPoints.current = Math.min(p.actionPoints.current, p.actionPoints.max);
  // La prochaine présidentielle a lieu dans un an
  d.presidential.nextWeek = d.week + 12;
  d.presidential.incumbentId = null;
  d.presidential.incumbentName = 'le gouvernement provisoire';
  for (const n of d.npcs) if (n.partyId !== d.party.id) n.relationToPlayer = clamp(n.relationToPlayer + (forced ? 5 : 25), -100, 100);
  if (forced && how === 'decheance') {
    p.stats.popularity = clamp(p.stats.popularity - 6);
    p.stats.influence = clamp(p.stats.influence - 10);
    p.stats.credibility = clamp(p.stats.credibility - 6);
    addMilestone(d, 'revers', 'La déchéance', `Après ${months} mois de règne, l’Assemblée vote votre déchéance. Vous quittez le Palais par la grande porte, mais vous le quittez.`);
    pushNews(d, 'actu', 'negative', 'Le souverain déchu', 'Par 389 voix, l’Assemblée nationale prononce la déchéance de la Couronne. La République est rétablie ; une présidentielle aura lieu dans un an.');
  } else if (forced) {
    p.stats.popularity = clamp(p.stats.popularity - 10);
    p.stats.influence = clamp(p.stats.influence - 8);
    addMilestone(d, 'revers', 'La révolution de velours', `Après ${months} mois de règne, le front républicain l’emporte : vous abdiquez sous la pression de la rue. La République est rétablie.`);
    pushNews(d, 'actu', 'negative', 'Abdication forcée', 'Sous la pression d’un million de manifestants, vous signez l’acte d’abdication. La République est rétablie.');
  } else {
    p.stats.credibility = clamp(p.stats.credibility + 10);
    p.stats.popularity = clamp(p.stats.popularity + 6);
    addMilestone(d, 'victoire', 'Le souverain qui rendit le trône', `Après ${months} mois de règne, vous rétablissez vous-même la République. L’histoire retiendra ce geste rare.`);
    pushNews(d, 'actu', 'positive', 'La République rétablie', 'Dans une allocution historique, vous rendez le pouvoir au peuple. Une présidentielle aura lieu dans un an ; vous pourrez vous y présenter.');
  }
}

/** Les effets « kingdom » */
export function adjustKingdom(d: GameState, e: Extract<Effect, { kind: 'kingdom' }>): string[] {
  const k = d.kingdom;
  if (e.restore) { restoreRepublic(d, !!e.fall, e.fall ?? 'abdication'); return [e.fall === 'decheance' ? 'Déchéance prononcée' : e.fall === 'revolution' ? 'Renversé·e par la rue' : 'République rétablie']; }
  if (!k) return [];
  const out: string[] = [];
  const sg = (v: number) => (v > 0 ? `+${v}` : `${v}`);
  if (e.prestige) { k.prestige = clamp(k.prestige + e.prestige); out.push(`Prestige du trône ${sg(e.prestige)}`); }
  if (e.stabilite) { k.stabilite = clamp(k.stabilite + e.stabilite); out.push(`Stabilité ${sg(e.stabilite)}`); }
  if (e.opposition) { k.opposition = clamp(k.opposition + e.opposition); out.push(`Front républicain ${sg(e.opposition)}`); }
  return out;
}

/** Chaque mois : le trône s'use, le front républicain s'organise */
export function monthlyKingdom(d: GameState, rng: Rng): void {
  const k = d.kingdom;
  if (!k || d.status !== 'en_cours') return;
  // Un trône est un paratonnerre : le front républicain grossit vite, la rue gronde souvent
  k.prestige = clamp(k.prestige + (50 - k.prestige) * 0.03 - 0.8 + d.player.stats.popularity / 200);
  k.opposition = clamp(k.opposition + 2.4 - k.prestige / 100 - k.stabilite / 150);
  k.stabilite = clamp(k.stabilite - (k.opposition - 45) / 30 + (k.prestige - 50) / 60);
  // La cour : la grandeur nourrit le prestige, mais le luxe arme le front républicain
  k.court ??= { table: 1, ceremonial: 1, mecenat: 0, garde: 1 };
  const g = courtGrandeur(k);
  d.player.finances.personal -= courtCost(k);
  k.prestige = clamp(k.prestige + (g - 40) / 25);
  k.opposition = clamp(k.opposition + Math.max(0, g - 50) / 30);
  if ((k.court['mecenat'] ?? 0) >= 2) d.player.renown = (d.player.renown ?? 0) + 1;
  // Des flambées révolutionnaires presque chaque mois
  if (rng.chance(0.3 + k.opposition / 250)) {
    const [title, text] = rng.pick(UNREST);
    k.stabilite = clamp(k.stabilite - 2);
    k.opposition = clamp(k.opposition + 1);
    pushNews(d, 'actu', 'negative', title, text);
  }
  // Les autres partis restent hostiles
  for (const n of d.npcs) if (n.partyId !== d.party.id && n.relationToPlayer > -15) n.relationToPlayer -= 2;
  if (k.opposition >= 70 && rng.chance(0.25)) {
    pushNews(d, 'actu', 'negative', 'Le front républicain dans la rue', `${Math.round(k.opposition * 8000).toLocaleString('fr-FR')} manifestants de la Bastille à la Nation : « Rendez-nous la République ! »`);
    k.stabilite = clamp(k.stabilite - 4);
  }
  // Révolution : opposition écrasante et trône fragilisé, la rue peut l'emporter à tout moment
  if (k.opposition >= 92 && k.prestige < 35 && k.stabilite < 30) restoreRepublic(d, true);
  else if (k.opposition >= 82 && (k.prestige < 45 || k.stabilite < 35) && rng.chance(0.18)) restoreRepublic(d, true);
}

const UNREST: [string, string][] = [
  ['Des barricades rue Saint-Antoine', 'Pavés, palettes et drapeaux tricolores : le faubourg rejoue 1830 toute la nuit.'],
  ['« À bas la Couronne » sur l’Arc de triomphe', 'Un tag géant, nettoyé à l’aube. Les photos, elles, ont fait le tour du monde.'],
  ['Les cahiers de doléances reviennent', 'Dans 3 000 mairies, des cahiers réclament « le retour de la République ».'],
  ['Un club des Jacobins renaît', 'Rue Saint-Honoré, trois cents personnes refondent le club. Les réseaux s’enflamment.'],
  ['Grève des gardes du Palais', 'Les gardes républicains refusent de défiler en livrée royale.'],
  ['Le bonnet phrygien en rupture de stock', 'Les magasins de déguisements sont dévalisés : le bonnet rouge s’affiche partout.'],
  ['Une pétition pour la République dépasse les deux millions', 'Record absolu pour une pétition citoyenne. L’opposition exige un débat.'],
  ['La Marseillaise sifflée… puis chantée', 'Au stade, l’hymne royal est couvert par une Marseillaise de 80 000 voix.'],
  ['Des préfets démissionnent', 'Quatre préfets refusent de prêter serment à la Couronne et rendent leur casquette.'],
  ['Occupation de la place de la Concorde', 'Tentes, assemblées générales, fanfares : la place est devenue un forum permanent.'],
];

export function kingdomGauges(k: KingdomState) {
  return [
    { label: 'Prestige du trône', value: k.prestige, good: k.prestige >= 50, hint: 'Discours du trône, tournées royales, galas.' },
    { label: 'Stabilité des institutions', value: k.stabilite, good: k.stabilite >= 50, hint: 'L’arbitrage royal et une Constitution respectée.' },
    { label: 'Front républicain', value: k.opposition, good: k.opposition < 50, hint: 'Tous les autres partis contre la Couronne. Au-delà de 90, la rue peut vous chasser.' },
  ];
}

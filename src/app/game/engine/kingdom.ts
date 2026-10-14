import { Effect, GameState } from '../models/game.models';
import { RANKS } from '../data/ranks';
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
}

export function sovereignTitle(d: GameState): string {
  return d.player.gender === 'femme' ? 'Reine des Français' : 'Roi des Français';
}

/** La monarchie proclamée : le joueur monte sur le trône */
export function crownPlayer(d: GameState): void {
  if (d.kingdom) return;
  const p = d.player;
  d.kingdom = { since: d.week, prestige: 55, stabilite: 50, opposition: 45, title: sovereignTitle(d) };
  d.presidency = null;
  p.rankId = 'roi';
  p.actionPoints.max = RANKS.roi.monthlyActionPoints;
  p.flags['monarchie'] = true;
  if (d.crown) d.crown.pretendant = `${p.name} (le prince a renoncé en votre faveur)`;
  // Tous les autres partis se dressent contre la Couronne
  for (const n of d.npcs) if (n.partyId !== d.party.id) n.relationToPlayer = Math.min(n.relationToPlayer, -25);
  pushNews(d, 'actu', 'neutral', `Vive ${d.player.gender === 'femme' ? 'la Reine' : 'le Roi'} !`, `Le prétendant renonce en votre faveur : ${p.name} est sacré·e à Reims, ${d.kingdom.title}. Tous les partis, sauf le vôtre, forment un « front républicain ».`);
}

/** Rétablir la République (abdication volontaire, ou forcée) */
export function restoreRepublic(d: GameState, forced: boolean): void {
  const k = d.kingdom;
  if (!k) return;
  const p = d.player;
  const months = d.week - k.since;
  d.kingdom = null;
  d.crown = null;
  p.flags['monarchie'] = false;
  p.flags['closed_crown'] = true;
  p.rankId = 'ancien_president';
  p.actionPoints.max = RANKS.ancien_president.monthlyActionPoints;
  p.actionPoints.current = Math.min(p.actionPoints.current, p.actionPoints.max);
  // La prochaine présidentielle a lieu dans un an
  d.presidential.nextWeek = d.week + 12;
  d.presidential.incumbentId = null;
  d.presidential.incumbentName = 'le gouvernement provisoire';
  for (const n of d.npcs) if (n.partyId !== d.party.id) n.relationToPlayer = clamp(n.relationToPlayer + (forced ? 5 : 25), -100, 100);
  if (forced) {
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
  if (e.restore) { restoreRepublic(d, false); return ['République rétablie']; }
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
  k.prestige = clamp(k.prestige + (50 - k.prestige) * 0.03 - 0.6 + d.player.stats.popularity / 200);
  k.opposition = clamp(k.opposition + 1.2 - k.prestige / 100 - k.stabilite / 150);
  k.stabilite = clamp(k.stabilite - (k.opposition - 50) / 40 + (k.prestige - 50) / 60);
  // Les autres partis restent hostiles
  for (const n of d.npcs) if (n.partyId !== d.party.id && n.relationToPlayer > -15) n.relationToPlayer -= 2;
  if (k.opposition >= 70 && rng.chance(0.25)) {
    pushNews(d, 'actu', 'negative', 'Le front républicain dans la rue', `${Math.round(k.opposition * 8000).toLocaleString('fr-FR')} manifestants de la Bastille à la Nation : « Rendez-nous la République ! »`);
    k.stabilite = clamp(k.stabilite - 4);
  }
  // Révolution de velours : opposition écrasante, trône discrédité
  if (k.opposition >= 92 && k.prestige < 35 && k.stabilite < 30) restoreRepublic(d, true);
}

export function kingdomGauges(k: KingdomState) {
  return [
    { label: 'Prestige du trône', value: k.prestige, good: k.prestige >= 50, hint: 'Discours du trône, tournées royales, galas.' },
    { label: 'Stabilité des institutions', value: k.stabilite, good: k.stabilite >= 50, hint: 'L’arbitrage royal et une Constitution respectée.' },
    { label: 'Front républicain', value: k.opposition, good: k.opposition < 50, hint: 'Tous les autres partis contre la Couronne. Au-delà de 90, la rue peut vous chasser.' },
  ];
}

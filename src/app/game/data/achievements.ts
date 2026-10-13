import { GameState } from '../models/game.models';
import { rankOrder } from './ranks';

/* ============================================================
 *  Succès : à débloquer d'une partie à l'autre (mémorisés dans
 *  le navigateur).
 * ============================================================ */

export interface Achievement { id: string; icon: string; title: string; text: string; check: (d: GameState) => boolean }

const has = (d: GameState, title: string) => d.milestones.some(m => m.title === title);

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'mandat', icon: '🎗️', title: 'Premier mandat', text: 'Être élu·e au conseil municipal.', check: d => rankOrder(d.player.rankId) >= rankOrder('conseiller_municipal') },
  { id: 'depute', icon: '🏛️', title: 'Au Palais-Bourbon', text: 'Devenir député·e.', check: d => rankOrder(d.player.rankId) >= rankOrder('depute') },
  { id: 'ministre', icon: '💼', title: 'Un maroquin', text: 'Entrer au gouvernement.', check: d => d.player.rankId === 'ministre' || d.player.rankId === 'premier_ministre' || has(d, 'Premier·e ministre') },
  { id: 'matignon', icon: '🏢', title: 'Rue de Varenne', text: 'Devenir Premier·e ministre.', check: d => d.player.rankId === 'premier_ministre' },
  { id: 'elysee', icon: '🇫🇷', title: 'Élu·e président·e', text: 'Remporter l’élection présidentielle.', check: d => !!d.presidency || Number(d.player.flags['presMandates'] ?? 0) >= 1 },
  { id: 'jeune', icon: '⚡', title: 'Jeune premier', text: 'Président·e de la République avant 40 ans.', check: d => !!d.presidency && d.player.age < 40 },
  { id: 'deux', icon: '✌️', title: 'Deux quinquennats', text: 'Être réélu·e président·e.', check: d => Number(d.player.flags['presMandates'] ?? 0) >= 2 },
  { id: 'zombie', icon: '☣', title: 'Survivant·e de l’épidémie Z', text: 'Voir la fin de l’épidémie.', check: d => !!d.player.flags['zombieDone'] },
  { id: 'contact', icon: '🛸', title: 'Voix de la Terre', text: 'Ouvrir l’ambassade du Premier contact.', check: d => (d.alien?.phase ?? 0) >= 4 },
  { id: 'loge', icon: '📐', title: 'Grand Maître', text: 'Atteindre le plus haut grade de la loge.', check: d => (d.lodge?.grade ?? 0) >= 4 },
  { id: 'roi', icon: '👑', title: 'Vive le Roi !', text: 'Rétablir la monarchie.', check: d => !!d.player.flags['monarchie'] },
  { id: 'relaxe', icon: '⚖️', title: 'Relaxé·e', text: 'Sortir blanchi·e de votre procès.', check: d => has(d, 'Relaxé·e') },
  { id: 'jo', icon: '🏅', title: 'Des Jeux inoubliables', text: 'Réussir les Jeux olympiques.', check: d => has(d, 'Des Jeux inoubliables') },
  { id: 'cyber', icon: '💻', title: 'Pare-feu', text: 'Repousser la cyberattaque.', check: d => has(d, 'La cyberattaque repoussée') },
  { id: 'complot', icon: '🕵️', title: 'Toujours debout', text: 'Déjouer un complot contre vous.', check: d => Number(d.player.flags['plotsFoiled'] ?? 0) >= 1 },
  { id: 'propre', icon: '🧼', title: 'Mains propres', text: 'Dix ans de carrière sans le moindre scandale.', check: d => d.week >= 120 && !Number(d.player.flags['scandals'] ?? 0) },
  { id: 'million', icon: '💰', title: 'Millionnaire', text: 'Un million d’euros d’épargne.', check: d => d.player.finances.personal >= 1_000_000 },
  { id: 'famille', icon: '👨‍👩‍👧‍👦', title: 'Famille nombreuse', text: 'Trois enfants.', check: d => (d.family?.children.length ?? 0) >= 3 },
  { id: 'parole', icon: '🤝', title: 'Homme ou femme de parole', text: 'Tenir cinq promesses.', check: d => (d.promises ?? []).filter(p => p.status === 'tenue').length >= 5 },
  { id: 'enfant_pays', icon: '🏡', title: 'Enfant du pays', text: 'Attachement du territoire à 80.', check: d => (d.territory?.attachment ?? 0) >= 80 },
  { id: 'dauphin', icon: '🎖️', title: 'Faiseur de rois', text: 'Voir votre dauphin·e entrer au gouvernement.', check: d => !!d.heir && ['ministre', 'premier_ministre', 'president'].includes(d.npcs.find(n => n.id === d.heir!.npcId)?.rankId ?? '') },
  { id: 'centenaire', icon: '🎂', title: 'Centenaire', text: 'Fêter ses cent ans.', check: d => d.player.age >= 100 && d.status !== 'mort' },
];

const KEY = 'polsim.achievements.v1';

export function unlockedAchievements(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>; } catch { return {}; }
}

/** Vérifie les succès ; renvoie ceux qui viennent d'être débloqués */
export function checkAchievements(d: GameState): typeof ACHIEVEMENTS {
  let store: Record<string, string>;
  try { store = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>; } catch { return []; }
  const fresh = ACHIEVEMENTS.filter(a => !store[a.id] && a.check(d));
  if (!fresh.length) return [];
  for (const a of fresh) store[a.id] = new Date().toISOString().slice(0, 10);
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* stockage indisponible */ }
  return fresh;
}

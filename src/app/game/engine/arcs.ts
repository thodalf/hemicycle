import { GameState } from '../models/game.models';
import { pushNews } from './effects';

/* ============================================================
 *  Les grands arcs « scénario » qui surviennent en cours de
 *  partie : jamais plus de deux à la fois. Un arc terminé
 *  (grade maximal, ambassade ouverte, monarchie proclamée…)
 *  ne compte plus.
 * ============================================================ */

export const MAX_ARCS = 2;

export function activeArcs(d: GameState): string[] {
  const out: string[] = [];
  if (d.crown && !d.player.flags['monarchie']) out.push('Couronne');
  if (d.lodge && d.lodge.grade < 4) out.push('Loge');
  if (d.press) out.push('Rédaction');
  if (d.mole) out.push('Infiltration');
  if (d.alien && d.alien.phase < 4) out.push('Premier contact');
  if (d.war) out.push('Guerre');
  if (d.plot) out.push('Complot');
  if (d.zombie && !d.zombie.vaccine) out.push('Épidémie Z');
  if (d.apocalypse && d.apocalypse.phase < 4) out.push('Fin du monde');
  const names = { cyber: 'Cyberattaque', proces: 'Procès', jo: 'Jeux olympiques', dissolution: 'Dissolution', krach: 'Krach financier', megafeux: 'Méga-feux', agriculteurs: 'Révolte des campagnes', taupe: 'Taupe', blackout: 'Black-out', crue: 'Crue de la Seine', secheresse: 'Guerre de l’eau', autonomie: 'Autonomie régionale', ia: 'IA de l’État', frelons: 'Frelons géants', mars: 'Mission martienne', napoleon: 'Retour de Napoléon', atlantide: 'Atlantide', ia_candidate: 'IA candidate', grand_hiver: 'Grand hiver', sosie: 'Le sosie', greve_generale: 'Grève générale', templiers: 'Trésor des Templiers', eurovision: 'Eurovision', comete: 'La comète', referendum: 'Référendum', seisme: 'Séisme', loto: 'Le gros lot', tempete_solaire: 'Tempête solaire', expo_universelle: 'Exposition universelle', penurie_medicaments: 'Pénurie de médicaments', train_futur: 'Train du futur' } as const;
  for (const [id, a] of Object.entries(d.crises ?? {})) if (a) out.push(names[id as keyof typeof names]);
  return out;
}

/** Un nouvel arc peut-il démarrer ? */
export function canStartArc(d: GameState): boolean {
  return activeArcs(d).length < MAX_ARCS;
}

/* ── Clore un scénario terminé ─────────────────────────────── */

export interface FinishedArc { id: 'crown' | 'lodge' | 'alien' | 'press' | 'mole' | 'apocalypse'; label: string; why: string }

/** Les scénarios arrivés à leur terme, mais encore affichés */
export function finishedArcs(d: GameState): FinishedArc[] {
  const out: FinishedArc[] = [];
  // Le royaume se clôt en rétablissant la République (panneau du royaume)
  if (d.lodge && d.lodge.grade >= 4) out.push({ id: 'lodge', label: 'La loge', why: 'Grand Maître : plus rien à gravir' });
  if (d.alien && d.alien.phase >= 4) out.push({ id: 'alien', label: 'Premier contact', why: 'L’ambassade est ouverte' });
  if (d.press && d.press.grade >= 4) out.push({ id: 'press', label: 'La rédaction', why: 'Vous dirigez la rédaction' });
  if (d.mole && d.milestones.some(m => m.title === 'La taupe en chef')) out.push({ id: 'mole', label: 'L’infiltration', why: 'Vous avez pris la tête du parti adverse' });
  if (d.apocalypse && d.apocalypse.phase >= 4) out.push({ id: 'apocalypse', label: 'La fin du monde', why: 'Le Diable est reparti… ou règne' });
  return out;
}

/** Ranger un scénario terminé : son panneau, ses actions et ses événements disparaissent */
export function closeArc(d: GameState, id: FinishedArc['id']): void {
  const f = finishedArcs(d).find(x => x.id === id);
  if (!f) return;
  d.player.flags[`closed_${id}`] = true;
  if (id === 'crown') d.crown = null;
  if (id === 'lodge') d.lodge = null;
  if (id === 'alien') d.alien = null;
  if (id === 'press') d.press = null;
  if (id === 'mole') d.mole = null;
  if (id === 'apocalypse') d.apocalypse = null;
  pushNews(d, 'systeme', 'neutral', `Chapitre clos : ${f.label}`, 'Ce scénario appartient désormais à vos mémoires. Il ne reviendra pas.');
}

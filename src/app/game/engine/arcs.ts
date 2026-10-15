import { SAGA_BY_ID } from '../data/saga-defs';
import { GameState } from '../models/game.models';
import { pushNews } from './effects';

/* ============================================================
 *  Les grands arcs « scénario » qui surviennent en cours de
 *  partie : jamais plus de deux à la fois. Un arc terminé
 *  (grade maximal, ambassade ouverte, monarchie proclamée…)
 *  ne compte plus, même tant qu'il n'est pas clôturé.
 * ============================================================ */

export const MAX_ARCS = 2;

export function activeArcs(d: GameState): string[] {
  const out: string[] = [];
  // Un scénario arrivé à son terme mais pas encore clôturé est inactif : il ne bloque plus les nouveaux
  const done = new Set(finishedArcs(d).map(f => f.id));
  if (d.crown && !d.player.flags['monarchie']) out.push('Couronne');
  if (d.lodge && !done.has('lodge')) out.push('Loge');
  if (d.press && !done.has('press')) out.push('Rédaction');
  if (d.mole && !done.has('mole')) out.push('Infiltration');
  if (d.alien && !done.has('alien')) out.push('Premier contact');
  if (d.war) out.push('Guerre');
  if (d.plot) out.push('Complot');
  if (d.zombie && !d.zombie.vaccine) out.push('Épidémie Z');
  if (d.apocalypse && !done.has('apocalypse')) out.push('Fin du monde');
  if (d.saga && !d.saga.outcome) out.push(SAGA_BY_ID.get(d.saga.id)?.label ?? 'Saga');
  const names = { cyber: 'Cyberattaque', proces: 'Procès', jo: 'Jeux olympiques', dissolution: 'Dissolution', krach: 'Krach financier', megafeux: 'Méga-feux', agriculteurs: 'Révolte des campagnes', taupe: 'Taupe', blackout: 'Black-out', crue: 'Crue de la Seine', secheresse: 'Guerre de l’eau', autonomie: 'Autonomie régionale', ia: 'IA de l’État', frelons: 'Frelons géants', mars: 'Mission martienne', napoleon: 'Retour de Napoléon', atlantide: 'Atlantide', ia_candidate: 'IA candidate', grand_hiver: 'Grand hiver', sosie: 'Le sosie', greve_generale: 'Grève générale', templiers: 'Trésor des Templiers', eurovision: 'Eurovision', comete: 'La comète', referendum: 'Référendum', seisme: 'Séisme', loto: 'Le gros lot', tempete_solaire: 'Tempête solaire', expo_universelle: 'Exposition universelle', penurie_medicaments: 'Pénurie de médicaments', train_futur: 'Train du futur', pandas: 'Les pandas', coupe_monde: 'Coupe du monde', jubile: 'Jubilé royal', diamants: 'Les diamants', ours: 'Le retour des ours', penurie_essence: 'Pénurie d’essence', capitale_culture: 'Capitale de la culture', canicule: 'Canicule', hacker: 'Le hacker', barons: 'La fronde des barons', grand_debat: 'Le grand débat', tour_eiffel: 'La tour Eiffel', baleine: 'La baleine', mariage_princier: 'Le mariage princier', cathedrale: 'La cathédrale', punaises: 'Les punaises de lit', esport: 'L’e-sport', satellite: 'Le satellite', casse: 'Le casse du siècle', vin: 'La guerre du vin', nuage: 'Le nuage toxique', taxis: 'Les taxis sans chauffeur', fusion: 'La fusion nucléaire', viaduc: 'Le viaduc fissuré', tresor: 'Le trésor du chantier', algues: 'Les algues vertes', barrage: 'Le barrage qui fuit', aviaire: 'La grippe aviaire', skipper: 'Le skipper disparu', drones: 'Les drones mystérieux', cyclone: 'Le cyclone', lithium: 'Le lithium d’Alsace', sous_marin: 'Le sous-marin en détresse', joconde: 'Le vol de la Joconde', quatre_jours: 'La semaine de quatre jours' } as const;
  for (const [id, a] of Object.entries(d.crises ?? {})) if (a) out.push(names[id as keyof typeof names]);
  return out;
}

/** Un nouvel arc peut-il démarrer ? */
export function canStartArc(d: GameState): boolean {
  return activeArcs(d).length < MAX_ARCS;
}

/* ── Clore un scénario terminé ─────────────────────────────── */

export interface FinishedArc { id: 'crown' | 'lodge' | 'alien' | 'press' | 'mole' | 'apocalypse' | 'saga'; label: string; why: string }

/** Les scénarios arrivés à leur terme, mais encore affichés */
export function finishedArcs(d: GameState): FinishedArc[] {
  const out: FinishedArc[] = [];
  // Le royaume se clôt en rétablissant la République (panneau du royaume)
  if (d.lodge && d.lodge.grade >= 4) out.push({ id: 'lodge', label: 'La loge', why: 'Grand Maître : plus rien à gravir' });
  if (d.alien && d.alien.phase >= 4) out.push({ id: 'alien', label: 'Premier contact', why: 'L’ambassade est ouverte' });
  if (d.press && d.press.grade >= 4) out.push({ id: 'press', label: 'La rédaction', why: 'Vous dirigez la rédaction' });
  if (d.mole && d.milestones.some(m => m.title === 'La taupe en chef')) out.push({ id: 'mole', label: 'L’infiltration', why: 'Vous avez pris la tête du parti adverse' });
  if (d.apocalypse && d.apocalypse.phase >= 4) out.push({ id: 'apocalypse', label: 'La fin du monde', why: 'Le Diable est reparti… ou règne' });
  if (d.saga?.outcome) { const def = SAGA_BY_ID.get(d.saga.id); out.push({ id: 'saga', label: def?.label ?? 'La saga', why: def?.outcomes[d.saga.outcome]?.title ?? 'Dénouée' }); }
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
  if (id === 'saga' && d.saga) { (d.sagasDone ??= []).push(d.saga.id); d.saga = null; }
  pushNews(d, 'systeme', 'neutral', `Chapitre clos : ${f.label}`, 'Ce scénario appartient désormais à vos mémoires. Il ne reviendra pas.');
}

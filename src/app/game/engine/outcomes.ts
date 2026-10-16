import { mods } from './difficulty';
import { ActionDefinition, Effect, GameState } from '../models/game.models';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Le sel de l'agenda : une même action peut tomber à plat,
 *  se passer comme prévu… ou faire un coup d'éclat. En moyenne,
 *  les gains restent les mêmes ; ce sont les mois qui changent.
 * ============================================================ */

export type Tier = 'rate' | 'correct' | 'eclat';

/** Catégories où le hasard n'a pas grand sens (le repos, la santé, l'argent) */
const FLAT = new Set(['repos', 'sante', 'argent']);

export const TIER_MULT: Record<Tier, number> = { rate: 0.45, correct: 1, eclat: 1.75 };

/** Probabilités : 12 % de chaque côté, déplacées par la forme, la réputation et l'équipe */
export function tierOdds(d: GameState, a: ActionDefinition): { rate: number; eclat: number } {
  const p = d.player;
  const s = p.stats;
  // La forme du moment : épuisé·e ou stressé·e, on rate davantage
  const shape = (s.energy - 50) / 500 - Math.max(0, s.stress - 60) / 300;
  // La réputation porte : crédibilité et popularité
  const rep = (s.credibility + s.popularity - 100) / 900;
  // Une équipe qui couvre le terrain (attaché·e de presse pour les médias, etc.)
  const staff = (a.category === 'medias' && p.staff.includes('attache_presse')) || (a.category === 'terrain' && p.staff.includes('directeur_campagne'))
    || (a.category === 'dossiers' && p.staff.includes('assistant_parlementaire')) ? 0.03 : 0;
  const luck = (p.traits ?? []).includes('chanceux' as never) ? 0.03 : 0;
  const edge = clamp(shape + rep + staff + luck, -0.08, 0.1);
  const hard = mods(d).tier;
  return { rate: clamp(0.12 - edge + hard, 0.03, 0.3), eclat: clamp(0.12 + edge - hard / 2, 0.04, 0.24) };
}

export function rollTier(d: GameState, a: ActionDefinition, rng: Rng): Tier {
  if (FLAT.has(a.category) || a.minigame) return 'correct';
  const o = tierOdds(d, a);
  const r = rng.next();
  return r < o.rate ? 'rate' : r < o.rate + o.eclat ? 'eclat' : 'correct';
}

/** Multiplie les gains (jamais les coûts) ; arrondi à l'unité pour rester lisible */
export function tierEffects(effects: Effect[], tier: Tier): Effect[] {
  if (tier === 'correct') return effects;
  const f = TIER_MULT[tier];
  const r = (v: number) => (Math.abs(v * f) < 1 ? Math.round(v * f * 10) / 10 : Math.round(v * f));
  return effects.map(e => {
    switch (e.kind) {
      case 'stat': return (e.stat === 'stress' ? e.delta < 0 : e.delta > 0) ? { ...e, delta: r(e.delta) } : e;
      case 'momentum': case 'dossier': case 'faction': case 'cohesion': case 'npcRelation': case 'segment': case 'renown':
        return e.delta > 0 ? { ...e, delta: r(e.delta) } : e;
      case 'intl': return (e.prestige ?? 0) > 0 ? { ...e, prestige: r(e.prestige!) } : e;
      case 'funds': return e.delta > 0 ? { ...e, delta: Math.round(e.delta * f) } : e;
      case 'contact': return (e.trust ?? 0) > 0 ? { ...e, trust: r(e.trust!) } : e;
      default: return e;
    }
  });
}

/** Le récit : un coup d'éclat fait la une, un raté finit en brève */
const ECLAT: Record<string, string[]> = {
  terrain: ['La foule vous porte en triomphe : la vidéo fait le tour du pays.', 'Une habitante vous serre dans ses bras devant les caméras : l’image fait la une.', 'Un moment de vérité, capté par un passant : des millions de vues.'],
  medias: ['Votre formule est reprise par tous les journaux du lendemain.', 'L’audience explose : vous êtes l’invité·e dont tout le monde parle.', 'Une réplique cinglante, devenue culte en une soirée.'],
  dossiers: ['Votre note est citée en référence par les plus grands experts.', 'Vous trouvez la faille que personne n’avait vue.', 'Le rapport fait autorité : on vous appelle de partout.'],
  parti: ['Standing ovation des militants : le parti se range derrière vous.', 'Les courants se rallient d’une seule voix.'],
  reseau: ['Le bon contact, au bon moment : les portes s’ouvrent.', 'Un dîner qui restera dans les mémoires… et dans les carnets d’adresses.'],
  default: ['Un sans-faute remarqué par toute la presse.', 'Tout réussit : le moment restera.', 'Un coup de maître, salué jusque dans le camp adverse.'],
};
const RATE: Record<string, string[]> = {
  terrain: ['Une salle à moitié vide et un micro qui grésille.', 'La pluie, trois passants pressés, et un tract piétiné.', 'Une habitante vous interpelle sèchement : la séquence tourne en boucle.'],
  medias: ['Un lapsus malheureux, repris en boucle sur les réseaux.', 'L’émission est déprogrammée au dernier moment. Personne ne vous a vu·e.', 'Vous perdez le fil en direct. Le journaliste sourit.'],
  dossiers: ['Des chiffres datés : un expert vous reprend publiquement.', 'Une erreur de virgule dans votre note, relevée par toute la presse.'],
  parti: ['Des sifflets au fond de la salle, et une ambiance glaciale.', 'La réunion tourne au règlement de comptes.'],
  reseau: ['Votre interlocuteur arrive en retard, repart en avance, et n’a rien écouté.', 'Le dîner s’éternise sur la météo : rien de concret.'],
  default: ['Rien ne se passe comme prévu.', 'Un rendez-vous manqué, un message mal compris.', 'Une journée pour rien, ou presque.'],
};

export function tierStory(a: ActionDefinition, tier: Tier, rng: Rng): string {
  const bank = tier === 'eclat' ? ECLAT : RATE;
  return rng.pick(bank[a.category] ?? bank['default']);
}

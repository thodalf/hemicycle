import { Effect, GameState, ZombieState } from '../models/game.models';
import { addMilestone, die } from './life';
import { pushNews } from './effects';
import { Rng, clamp, frSigned } from './rng';

/* ============================================================
 *  Épidémie Z : un virus inconnu transforme les malades en
 *  morts-vivants. Contenir (cordons sanitaires), rassurer
 *  (panique), chercher un vaccin (recherche). Si la recherche
 *  aboutit, le vaccin reconquiert le pays ; si l'infection
 *  gagne tout le territoire, l'État se replie et tout recommence.
 * ============================================================ */

export const ZOMBIE_PHASES = ['Le foyer', 'L’épidémie', 'Le chaos', 'L’effondrement', 'La reconquête'];
export const ZOMBIE_PHASE_TEXT = [
  'Quelques cas isolés autour du premier foyer. Tout peut encore être contenu.',
  'Le virus a franchi les cordons sanitaires. Plusieurs régions sont touchées.',
  'Des villes entières sont abandonnées. L’armée tient des lignes de défense.',
  'Le pays vacille. L’État se replie sur quelques bastions.',
  'Le vaccin est là. Région par région, le pays se reprend.',
];

export function zombiePhase(z: ZombieState): number {
  if (z.vaccine) return 4;
  return z.infection < 15 ? 0 : z.infection < 40 ? 1 : z.infection < 70 ? 2 : 3;
}

/** Risque mensuel d'être mordu·e (en %) */
export function biteRisk(d: GameState): number {
  const z = d.zombie;
  if (!z || z.infection < 45) return 0;
  const shelter = d.player.flags['zShelter'] ? 0.3 : 1;
  const guard = d.player.staff.includes('garde_du_corps') || d.presidency ? 0.5 : 1;
  return Math.round(((z.infection - 45) / 55) * 2.5 * shelter * guard * 10) / 10;
}

export function startZombie(d: GameState, mode: 'alerte' | 'minimiser' | 'confiner'): string[] {
  if (d.zombie) return [];
  const base = { alerte: { containment: 35, panic: 30 }, minimiser: { containment: 15, panic: 10 }, confiner: { containment: 50, panic: 35 } }[mode];
  d.zombie = { since: d.week, infection: 4, cure: 3, ...base };
  d.player.flags['zombieGate'] = true;
  pushNews(d, 'actu', 'negative', 'Épidémie Z : le premier foyer',
    `${ZOMBIE_PHASE_TEXT[0]} Nouvel onglet : Épidémie Z.`);
  addMilestone(d, 'carriere', 'Le premier foyer', 'Un virus inconnu, à Saint-Nazaire. Les malades ne meurent pas tout à fait.');
  return ['Épidémie Z déclarée'];
}

export function adjustZombie(d: GameState, e: Extract<Effect, { kind: 'zombie' }>): string[] {
  if (e.start) return startZombie(d, e.start);
  const z = d.zombie;
  if (!z) return [];
  const out: string[] = [];
  const sign = (n: number) => frSigned(n);
  if (e.infection) { z.infection = clamp(z.infection + e.infection); out.push(`Infection ${sign(e.infection)}`); }
  if (e.containment) { z.containment = clamp(z.containment + e.containment); out.push(`Confinement ${sign(e.containment)}`); }
  if (e.panic) { z.panic = clamp(z.panic + e.panic); out.push(`Panique ${sign(e.panic)}`); }
  if (e.cure) { z.cure = clamp(z.cure + e.cure); out.push(`Recherche ${sign(e.cure)}`); }
  if (e.shelter) { d.player.flags['zShelter'] = true; out.push('À l’abri dans un bastion'); }
  return out;
}

/** Chaque mois */
export function monthlyZombie(d: GameState, rng: Rng): void {
  const z = d.zombie;
  if (!z || d.status !== 'en_cours') return;
  const p = d.player;
  const before = zombiePhase(z);

  if (!z.vaccine) {
    const spread = (2.8 + z.infection * 0.04) * (1 - z.containment / 130) * (z.fell ? 0.6 : 1) * rng.range(0.7, 1.3) - 1.2;
    // Après l'effondrement, les bastions tiennent : l'infection ne reprend plus tout le pays
    z.infection = Math.min(z.fell ? 95 : 100, clamp(z.infection + spread));
    z.cure = clamp(z.cure + 2 + (p.rankId === 'ministre' && d.portfolio === 'sante' ? 1.5 : 0));
  } else {
    z.infection = clamp(z.infection - rng.range(9, 14));
  }
  z.containment = clamp(z.containment - 2);
  z.panic = clamp(z.panic + (z.infection - z.panic) * 0.2 + rng.range(-2, 2));
  p.stats.stress = clamp(p.stats.stress + z.panic / 40);
  // L'opinion juge la gestion de crise de ceux qui gouvernent
  if (['ministre', 'premier_ministre', 'president'].includes(p.rankId)) {
    p.stats.popularity = clamp(p.stats.popularity + (z.containment - z.infection) / 40);
    if (d.presidency) d.presidency.approval = clamp(d.presidency.approval + (z.containment - z.infection) / 30);
  }

  // Le vaccin
  if (z.cure >= 100 && !z.vaccine) {
    z.vaccine = true;
    pushNews(d, 'actu', 'positive', 'Le vaccin est prêt', 'Les premières doses partent vers les bastions. La reconquête commence.');
  }
  if (z.vaccine && z.infection <= 0) {
    d.zombie = null;
    p.flags['zombieDone'] = true;
    p.flags['zShelter'] = false;
    p.stats.popularity = clamp(p.stats.popularity + 8);
    p.stats.influence = clamp(p.stats.influence + 5);
    addMilestone(d, 'victoire', 'La France sauvée de l’épidémie Z', 'Le dernier foyer est éteint. Les cloches sonnent dans tout le pays.');
    pushNews(d, 'actu', 'positive', 'Fin de l’épidémie Z', 'Le dernier foyer est éteint. On reconstruit.');
    return;
  }

  // L'effondrement : l'État se replie, et la lutte reprend
  if (z.infection >= 100 && !z.fell) {
    z.fell = true;
    z.infection = 82;
    z.containment = clamp(z.containment + 35);
    z.panic = 90;
    z.cure = clamp(z.cure + 10);
    p.stats.popularity = clamp(p.stats.popularity - 10);
    addMilestone(d, 'revers', 'La France tombe', 'Paris est évacuée. Le gouvernement se replie à Brest ; la lutte continue depuis les bastions.');
    pushNews(d, 'actu', 'negative', 'Paris évacuée', 'L’État se replie sur la façade atlantique. Les bastions tiennent.');
  }

  const after = zombiePhase(z);
  if (after !== before) {
    pushNews(d, 'actu', after > before && after !== 4 ? 'negative' : 'positive', `Épidémie Z : ${ZOMBIE_PHASES[after].toLowerCase()}`, ZOMBIE_PHASE_TEXT[after]);
  }

  // Le danger, pour vous aussi
  const risk = biteRisk(d);
  if (risk && rng.chance(risk / 100)) {
    if (rng.chance(0.35)) {
      die(d, 'maladie', 'Contaminé·e par le virus Z lors d’un déplacement dans une zone que l’on croyait sûre.');
    } else {
      p.health = clamp(p.health - 25);
      pushNews(d, 'actu', 'negative', 'Vous avez été mordu·e', 'Un traitement expérimental vous sauve de justesse. Vous restez affaibli·e.');
    }
  }
}

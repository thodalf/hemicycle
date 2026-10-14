import { ApocalypseState, Effect, GameState } from '../models/game.models';
import { addMilestone } from './life';
import { pushNews } from './effects';
import { Rng, clamp, frSigned } from './rng';

/* ============================================================
 *  La fin du monde : des présages, une secte (l'Ordre de l'Aube
 *  Noire) qui gagne les élites, un rituel… puis le Diable en
 *  personne, costume blanc et sourire poli, qui se fait appeler
 *  « Monsieur Nicolas ». On peut démanteler la secte avant le
 *  rituel, repousser le Diable, ou signer un pacte. Ce dernier
 *  rapporte gros, et le Diable revient réclamer son dû.
 * ============================================================ */

export const CULT = 'l’Ordre de l’Aube Noire';
export const DEVIL = 'Monsieur Nicolas';
export const APOC_PHASES = ['Les présages', 'La secte', 'Le rituel', 'Le Diable', 'Après la fin'];
export const APOC_TEXT = [
  'Une éclipse que personne n’avait prévue, des oiseaux qui tombent du ciel, la Loire rouge sang. Les fidèles d’une secte inconnue sourient.',
  `${CULT[0].toUpperCase()}${CULT.slice(1)} recrute partout : des patrons, des préfets, des stars. Ses membres portent une bague noire.`,
  'La secte prépare un rituel pour le prochain solstice. Si rien ne l’arrête, quelque chose viendra.',
  `${DEVIL} est arrivé. Costume blanc, voix douce, il sourit aux caméras. Partout où il passe, les gens perdent le sommeil… et la raison.`,
  'Le monde a tenu bon. Ou presque.',
];

const MONTHS = [3, 5, 3, 6];

export function startApocalypse(d: GameState): string[] {
  if (d.apocalypse) return [];
  d.apocalypse = { since: d.week, phase: 0, phaseSince: d.week, darkness: 15, resistance: 30, cult: 15 };
  d.player.flags['apocGate'] = true;
  pushNews(d, 'actu', 'negative', 'Des présages inquiétants', `${APOC_TEXT[0]} Nouvel onglet : Fin du monde.`);
  addMilestone(d, 'carriere', 'Les présages', 'Le ciel s’est assombri en plein midi. Vous êtes parmi les premiers à prendre l’affaire au sérieux.');
  return ['Fin du monde : les présages'];
}

export function adjustApocalypse(d: GameState, e: Extract<Effect, { kind: 'apocalypse' }>, rng: Rng): string[] {
  if (e.start) return startApocalypse(d);
  const a = d.apocalypse;
  if (!a || a.phase >= 4) return [];
  const out: string[] = [];
  const sign = (n: number) => frSigned(n);
  if (e.darkness) { a.darkness = clamp(a.darkness + e.darkness); out.push(`Ténèbres ${sign(e.darkness)}`); }
  if (e.resistance) { a.resistance = clamp(a.resistance + e.resistance); out.push(`Résistance ${sign(e.resistance)}`); }
  if (e.cult) { a.cult = clamp(a.cult + e.cult); out.push(`Emprise de la secte ${sign(e.cult)}`); }
  if (e.raid && a.phase <= 2) {
    if (rng.chance(clamp(0.35 + (a.resistance - a.cult) / 100, 0.1, 0.85))) {
      a.cult = clamp(a.cult - 25);
      out.push('Le repaire de la secte est démantelé : emprise −25');
    } else {
      a.cult = clamp(a.cult + 6);
      d.player.stats.popularity = clamp(d.player.stats.popularity - 2);
      out.push('Le raid échoue : la secte était prévenue');
    }
  }
  if (e.pact && !a.pact && a.phase === 3) {
    a.pact = true;
    a.outcome = 'pacte';
    finish(d, a, rng);
    out.push('Pacte signé');
  }
  return out;
}

export function monthlyApocalypse(d: GameState, rng: Rng): void {
  const a = d.apocalypse;
  if (!a) return;
  if (a.phase >= 4) return;
  const drift = [1.5, 2.5, 3.5, 5][a.phase];
  a.darkness = clamp(a.darkness + drift * rng.range(0.6, 1.3) + a.cult / 60 - a.resistance / 50);
  a.resistance = clamp(a.resistance + rng.range(-1.5, 1));
  if (a.phase === 1 || a.phase === 2) a.cult = clamp(a.cult + rng.range(1.5, 4.5));
  // Les ténèbres pèsent sur le moral du pays
  d.player.stats.stress = clamp(d.player.stats.stress + a.darkness / 60);
  if (d.economy) d.economy.confidence = clamp(d.economy.confidence - a.darkness / 80);
  const months = d.week - a.phaseSince;
  // Démantelée avant le rituel : le Diable ne viendra pas
  if (a.phase === 2 && a.cult < 20) {
    a.outcome = 'secte_demantelee';
    finish(d, a, rng);
    return;
  }
  if (months >= MONTHS[a.phase] || (a.phase === 1 && a.cult >= 70)) {
    if (a.phase === 3) {
      a.outcome = a.resistance >= a.darkness ? 'diable_repousse' : 'regne';
      finish(d, a, rng);
      return;
    }
    a.phase += 1;
    a.phaseSince = d.week;
    pushNews(d, 'actu', 'negative', APOC_PHASES[a.phase], APOC_TEXT[a.phase]);
    if (a.phase === 3) addMilestone(d, 'revers', 'L’arrivée du Diable', `${DEVIL} descend d’une limousine blanche devant l’Assemblée nationale. Il a votre numéro.`);
  }
}

function finish(d: GameState, a: ApocalypseState, rng: Rng): void {
  a.phase = 4;
  a.phaseSince = d.week;
  const s = d.player.stats;
  switch (a.outcome) {
    case 'secte_demantelee':
      s.credibility = clamp(s.credibility + 6); s.popularity = clamp(s.popularity + 4);
      addMilestone(d, 'victoire', 'La secte démantelée', `Les chefs ${CULT.replace('l’', 'de l’')} sont arrêtés la veille du solstice. Le rituel n’aura pas lieu.`);
      pushNews(d, 'actu', 'positive', 'Le rituel déjoué', 'Les présages cessent du jour au lendemain. On ne saura jamais ce qui serait venu.');
      break;
    case 'diable_repousse':
      s.popularity = clamp(s.popularity + 8); s.influence = clamp(s.influence + 6);
      if (d.presidency) d.presidency.approval = clamp(d.presidency.approval + 10);
      addMilestone(d, 'victoire', 'Le Diable repoussé', `Devant un pays uni, ${DEVIL} ajuste son costume, salue poliment, et disparaît dans une odeur de soufre. « À une autre fois. »`);
      pushNews(d, 'actu', 'positive', 'Le Diable est parti', 'Le soleil se lève sur une France épuisée et soulagée.');
      break;
    case 'regne':
      s.popularity = clamp(s.popularity - 10); s.credibility = clamp(s.credibility - 6); s.stress = clamp(s.stress + 15);
      if (d.economy) { d.economy.growth -= 1.5; d.economy.confidence = clamp(d.economy.confidence - 15); }
      if (d.presidency) d.presidency.approval = clamp(d.presidency.approval - 15);
      addMilestone(d, 'revers', 'Le règne des ténèbres', `Six mois de nuit. ${DEVIL} s’ennuie et finit par partir, laissant un pays brisé. On vous demande où vous étiez.`);
      pushNews(d, 'actu', 'negative', 'La longue nuit', 'Le Diable est reparti de lui-même. Le pays mettra des années à s’en remettre.');
      break;
    case 'pacte':
      s.popularity = clamp(s.popularity + 15); s.influence = clamp(s.influence + 15); s.politicalCapital = clamp(s.politicalCapital + 30);
      d.player.flags['devilDebt'] = d.week;
      addMilestone(d, 'carriere', 'Le pacte', `Une signature à l’encre rouge, dans un salon de l’hôtel Lutetia. ${DEVIL} repart en promettant de « repasser de temps en temps ». Tout vous réussit, désormais.`);
      pushNews(d, 'actu', 'positive', 'Le Diable s’en va… sans explication', 'Le pays respire. Seul·e, vous savez pourquoi.');
      break;
  }
  void rng;
}

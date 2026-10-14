import { GameState } from '../models/game.models';
import { TraitMods } from './traits';

/* ============================================================
 *  Grandes décisions : des engagements pour la vie.
 *  Une seule tous les huit ans. Chacune apporte un avantage
 *  durable (modificateurs façon trait), un prix durable, des
 *  suites (un rendez-vous chaque année) et ferme d'autres voies.
 *  Une décision peut être reniée, à grand prix.
 * ============================================================ */

/** Huit ans de jeu entre deux grandes décisions (un tour = un mois) */
export const DECISION_INTERVAL = 96;

export interface GreatDecisionInfo {
  id: string;
  icon: string;
  label: string;
  desc: string;
  /** Ce que l'engagement apporte, pour toujours */
  pros: string[];
  /** Ce qu'il coûte, pour toujours */
  cons: string[];
  /** Décisions qu'il rend impossibles (et réciproquement) */
  excludes?: string[];
  /** Modificateurs permanents, appliqués comme un trait tant que l'engagement tient */
  mods?: TraitMods;
  /** Ce que coûte le reniement */
  breakText: string;
}

export const GREAT_INFO: GreatDecisionInfo[] = [
  { id: 'charte', icon: '⚖️', label: 'Publier une charte éthique personnelle',
    desc: 'Patrimoine, agendas, cadeaux : tout devient public. Vous jurez de ne jamais user de chantage ni de coups tordus.',
    pros: ['Exposition aux scandales −40 %', 'Gains de crédibilité +15 %', 'Pertes de popularité −10 %'],
    cons: ['Chantage, détective, intimidation, traces effacées, fouille d’un rival : le moindre coup tordu rompt la charte (crédibilité −20, renommée −60, trait « entaché »)', 'Chaque année, la presse vérifie : un secret caché peut tout faire tomber'],
    mods: { exposure: 0.6, gain: { credibility: 1.15 }, loss: { popularity: 0.9 } },
    breakText: 'Crédibilité −8, renommée −30' },
  { id: 'grand_oral', icon: '📺', label: 'Instituer un rendez-vous annuel avec les Français',
    desc: 'Deux heures en direct, en prime time, face à des Français tirés au sort. Et chaque année, vous reviendrez.',
    pros: ['Pertes de popularité −15 %', 'Gains de popularité +8 %', '+1 renommée par mois'],
    cons: ['Chaque année, l’émission revient : y aller épuise et peut mal tourner, l’annuler coûte cher (popularité −8, renommée −30)'],
    mods: { loss: { popularity: 0.85 }, gain: { popularity: 1.08 } },
    breakText: 'Crédibilité −8, renommée −30, popularité −4' },
  { id: 'reconciliation', icon: '🕊️', label: 'Faire la paix avec votre pire ennemi',
    desc: 'Un déjeuner sans caméras, puis une poignée de main en public : vos rancunes sont effacées, et vous liez vos destins.',
    pros: ['Son opinion de vous ne descend plus sous +20', 'Il ou elle vous soutient : sang-froid +5 en débat', 'Amitiés +10 %'],
    cons: ['Chaque année, il ou elle exige un service. Refuser rompt la paix, et l’ancien ennemi se venge (opinion −50, ce qu’il sait devient public)'],
    excludes: ['purge'],
    mods: { composure: 5, relationUp: 1.1 },
    breakText: 'Crédibilité −8, renommée −30, son opinion −50' },
  { id: 'purge', icon: '🧹', label: 'Purger le parti',
    desc: 'Exclusions, investitures retirées, fédérations mises sous tutelle. Plus personne ne bougera… pendant un temps.',
    pros: ['Aucune fronde ne peut naître pendant 3 ans', 'Votre crainte s’estompe deux fois moins vite', 'Sang-froid +4 en débat'],
    cons: ['La cohésion du parti ne dépasse plus 70', 'Les exclus s’organisent autour d’un chef : chaque année, ils frappent', 'Amitiés −10 %'],
    excludes: ['pacte_courants', 'reconciliation'],
    mods: { composure: 4, relationUp: 0.9 },
    breakText: 'Crédibilité −8, renommée −30, crainte −15' },
  { id: 'pacte_courants', icon: '🤝', label: 'Signer un pacte avec tous les courants',
    desc: 'Un texte commun, des postes partagés : la paix dans le parti, à condition de consulter tout le monde.',
    pros: ['Les frondes grandissent deux fois moins vite', 'Les courants se rapprochent de vous chaque mois', 'Rancunes −10 %'],
    cons: ['Chaque projet de loi coûte 5 de capital politique de plus : il faut consulter', 'Chaque année, un courant peut menacer de rompre le pacte'],
    excludes: ['purge', 'mouvement'],
    mods: { relationDown: 0.9 },
    breakText: 'Crédibilité −8, renommée −30, courants −15, cohésion −6' },
  { id: 'livre_blanc', icon: '📘', label: 'Publier un livre blanc',
    desc: 'Votre meilleur dossier devient un livre de référence, lu dans tous les cabinets. Désormais, ce sujet, c’est vous.',
    pros: ['Apprentissage des dossiers +15 %', 'Arguments « faits » +10 % en débat', 'Une autorité : +1 renommée par mois'],
    cons: ['Vous êtes attendu·e au tournant : chaque année, une contre-expertise attaque votre livre', 'Si votre maîtrise du sujet tombe sous 60, le livre se retourne contre vous (crédibilité −1 par mois)'],
    mods: { mastery: 1.15, debate: { faits: 1.1 } },
    breakText: 'Crédibilité −8, renommée −30' },
  { id: 'mecene', icon: '🎻', label: 'Devenir mécène d’un grand festival',
    desc: '400 000 € pour sauver un grand festival de musique, puis une rente à vie : votre nom en lettres d’or sur l’affiche.',
    pros: ['+2 renommée par mois', 'Gains de popularité +5 %', 'Chaque été, le festival vous offre une tribune'],
    cons: ['1 500 € par mois, à vie, sur votre épargne. Si vous ne pouvez plus payer, le scandale éclate'],
    mods: { gain: { popularity: 1.05 } },
    breakText: 'Crédibilité −8, renommée −30, popularité −3' },
  { id: 'tour_france', icon: '🗺️', label: 'Faire le tour de France des 101 départements',
    desc: 'Six mois sur les routes, un département tous les deux jours. Après, la France vous connaîtra par cœur.',
    pros: ['Pendant le tour : tous les électorats +1 par mois', 'Ensuite, pour toujours : pertes de popularité −10 %, amitiés +5 %'],
    cons: ['Pendant 6 mois : énergie −8, stress +4 et influence −1 chaque mois, loin des couloirs de Paris'],
    mods: { loss: { popularity: 0.9 }, relationUp: 1.05 },
    breakText: 'Crédibilité −8, renommée −30' },
  { id: 'think_tank', icon: '🏛️', label: 'Fonder votre think tank',
    desc: '400 000 € pour installer des chercheurs, des notes, des colloques : un laboratoire d’idées à votre nom.',
    pros: ['Trois actions nouvelles (Réseau) : commander une note, organiser un colloque, publier un rapport choc', 'Apprentissage des dossiers +10 %'],
    cons: ['1 200 € par mois pour payer les chercheurs : sans argent, le think tank ferme', 'Ses rapports vous engagent : chaque année, l’un d’eux fait polémique'],
    mods: { mastery: 1.1 },
    breakText: 'Crédibilité −8, renommée −30' },
  { id: 'memoires', icon: '✒️', label: 'Écrire vos mémoires',
    desc: 'Tout raconter, ou presque. Les droits d’auteur tombent, les vieux comptes se règlent.',
    pros: ['Sang-froid +6 en débat : vous avez déjà tout dit', 'Gains de crédibilité +8 %', 'Droits d’auteur : 250 € par mois'],
    cons: ['Les règlements de comptes : les trois personnalités que vous aimez le moins vous en voudront longtemps (opinion −20)', 'Chaque année, un droit de réponse… ou un procès en diffamation'],
    mods: { composure: 6, gain: { credibility: 1.08 } },
    breakText: 'Crédibilité −8, renommée −30' },
  { id: 'mouvement', icon: '📣', label: 'Lancer votre mouvement citoyen',
    desc: 'Un nom, un site, des comités partout : un mouvement à vous, à côté du parti… ou contre lui.',
    pros: ['Deux actions nouvelles (Terrain) : meeting du mouvement, pétition nationale', 'Pertes de popularité −10 %', 'Gains de popularité +5 %'],
    cons: ['Le parti se méfie : les courants s’éloignent chaque mois', 'Le chef du parti vous en veut (opinion −25)', 'Chaque année, le parti vous somme de choisir'],
    excludes: ['pacte_courants'],
    mods: { loss: { popularity: 0.9 }, gain: { popularity: 1.05 } },
    breakText: 'Crédibilité −8, renommée −30, popularité −4' },
];

export const GREAT_INFO_BY_ID = new Map(GREAT_INFO.map(g => [g.id, g]));

const flag = (d: GameState, k: string) => d.player.flags[k];

export const decisionTaken = (d: GameState, id: string) => flag(d, `gd_${id}`) !== undefined;
export const decisionBroken = (d: GameState, id: string) => flag(d, `gd_${id}_broken`) !== undefined;
export const decisionActive = (d: GameState, id: string) => decisionTaken(d, id) && !decisionBroken(d, id);

/** Le tour de France ne donne ses avantages durables qu'une fois terminé */
export function tourRunning(d: GameState): boolean {
  return decisionActive(d, 'tour_france') && d.week < Number(flag(d, 'gd_tour_until') ?? 0);
}

/** Engagements en vigueur, avec leurs modificateurs */
export function activeDecisions(d: GameState): GreatDecisionInfo[] {
  return GREAT_INFO.filter(g => decisionActive(d, g.id) && !(g.id === 'tour_france' && tourRunning(d)));
}

/** Dernière grande décision prise (anciennes sauvegardes comprises) */
export function lastDecisionWeek(d: GameState): number | null {
  const weeks = GREAT_INFO.map(g => flag(d, `gd_${g.id}`)).filter(v => v !== undefined).map(Number).filter(n => !Number.isNaN(n));
  return weeks.length ? Math.max(...weeks) : null;
}

export function nextDecisionWeek(d: GameState): number {
  const last = lastDecisionWeek(d);
  return last === null ? 0 : last + DECISION_INTERVAL;
}

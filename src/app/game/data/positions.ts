import { Effect, Segment } from '../models/game.models';
import { POSITIONS_MORE } from './positions-more';

/* ============================================================
 *  Les prises de position : un journaliste, un citoyen, un
 *  sondeur vous pose une question à choix multiple sur un sujet
 *  de société. Votre réponse est retenue. Si on vous repose la
 *  question plus tard (autre média, autre année) et que vous
 *  changez d'avis, c'est un revirement : la crédibilité plonge,
 *  et de plus en plus à chaque volte-face. La constance paie.
 *
 *  `lean` : de −2 (très à gauche) à +2 (très à droite), 0 au centre
 *  ou hors clivage. Les effets visent surtout les électorats.
 * ============================================================ */

export interface PositionAnswer {
  id: string;
  label: string;
  lean: number;
  effects: Effect[];
}

export interface PositionTopic {
  id: string;
  /** Le sujet, en deux ou trois mots (pour la liste des positions) */
  label: string;
  /** La question posée */
  question: string;
  /** Quatre réponses, de la plus tranchée à la plus prudente */
  answers: PositionAnswer[];
  /** Rang minimal (ordre) pour qu'on vous la pose */
  minOrder?: number;
}

const seg = (segment: Segment | '*', delta: number): Effect => ({ kind: 'segment', segment, delta });
const st = (stat: 'popularity' | 'credibility' | 'influence' | 'politicalCapital' | 'stress', delta: number): Effect => ({ kind: 'stat', stat, delta });

const BASE: PositionTopic[] = [
  {
    id: 'nucleaire', label: 'Le nucléaire', question: 'Faut-il construire de nouveaux réacteurs nucléaires en France ?',
    answers: [
      { id: 'oui_massif', label: 'Oui, une dizaine, et vite', lean: 1, effects: [seg('cadres', 2), seg('jeunes', -2), { kind: 'dossier', domain: 'ecologie', delta: 1 }] },
      { id: 'oui_mix', label: 'Oui, mais avec autant d’éolien et de solaire', lean: 0, effects: [seg('cadres', 1), seg('jeunes', 1)] },
      { id: 'non_sortie', label: 'Non, il faut sortir du nucléaire', lean: -1, effects: [seg('jeunes', 2), seg('ruraux', -1), seg('cadres', -1)] },
      { id: 'debat', label: 'C’est aux Français de trancher par référendum', lean: 0, effects: [st('credibility', -1), seg('populaires', 1)] },
    ],
  },
  {
    id: 'semaine_4j', label: 'La semaine de quatre jours', question: 'La semaine de quatre jours, vous êtes pour ?',
    answers: [
      { id: 'generaliser', label: 'Pour, et il faut la généraliser par la loi', lean: -2, effects: [seg('jeunes', 2), seg('populaires', 1), seg('cadres', -2)] },
      { id: 'experimenter', label: 'Pour l’expérimenter, entreprise par entreprise', lean: 0, effects: [seg('cadres', 1), seg('jeunes', 1)] },
      { id: 'contre', label: 'Contre : il faut travailler plus, pas moins', lean: 2, effects: [seg('cadres', 2), seg('retraites', 1), seg('jeunes', -2)] },
      { id: 'partenaires', label: 'C’est aux partenaires sociaux d’en décider', lean: 1, effects: [st('credibility', 1)] },
    ],
  },
  {
    id: 'heure_ete', label: 'Le changement d’heure', question: 'Faut-il en finir avec le changement d’heure ?',
    answers: [
      { id: 'ete', label: 'Oui, et garder l’heure d’été toute l’année', lean: 0, effects: [seg('jeunes', 1), seg('ruraux', -1)] },
      { id: 'hiver', label: 'Oui, et garder l’heure d’hiver', lean: 0, effects: [seg('ruraux', 1), seg('retraites', 1)] },
      { id: 'garder', label: 'Non, ça marche très bien comme ça', lean: 0, effects: [seg('retraites', 1)] },
      { id: 'europe', label: 'Ça doit se décider au niveau européen', lean: 0, effects: [st('credibility', 1), seg('cadres', 1)] },
    ],
  },
];

export const POSITIONS: PositionTopic[] = [...BASE, ...POSITIONS_MORE];
export const POSITION_BY_ID = new Map(POSITIONS.map(p => [p.id, p]));

/** Qui pose la question (au hasard) */
export const POSITION_ASKERS: { from: string; role: string }[] = [
  { from: 'Le Parisien', role: 'Service politique' },
  { from: 'France Info', role: 'La question du jour' },
  { from: 'Ouest-France', role: 'Rédaction' },
  { from: 'Le Monde', role: 'Service politique' },
  { from: 'Le Figaro', role: 'Service politique' },
  { from: 'BFM', role: 'L’invité politique' },
  { from: 'Brut', role: 'Questions de lecteurs' },
  { from: 'La Dépêche', role: 'Rédaction' },
  { from: 'Libération', role: 'Service politique' },
  { from: 'L’Opinion', role: 'Service politique' },
];

/** Qui vous pose une colle de culture politique */
export const COLLE_ASKERS: { from: string; role: string; tv: boolean }[] = [
  { from: 'Quotidien', role: 'Micro-trottoir de l’Assemblée', tv: true },
  { from: 'Inès, lycéenne en stage', role: 'Stagiaire de troisième', tv: false },
  { from: 'France Inter', role: 'Le quiz de la matinale', tv: true },
  { from: 'Un militant de votre section', role: 'Section du parti', tv: false },
  { from: 'C à vous', role: 'Le petit quiz de fin d’émission', tv: true },
  { from: 'Brut', role: 'Le test des élus', tv: true },
];

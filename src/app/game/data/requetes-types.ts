import { Effect, GameState } from '../models/game.models';

/* ============================================================
 *  « Les requêtes » — une mécanique empruntée à Reigns.
 *
 *  Chaque mois, quelques cartes arrivent : un personnage (nom
 *  complet, fonction, une icône) vous adresse une requête. Deux
 *  réponses seulement : glisser à gauche ou à droite. Chaque
 *  réponse fait bouger quatre piliers — le Peuple, le Parti, les
 *  Médias, les Puissants (patronat, finance, lobbies) — de 0 à 100.
 *  Avant de choisir, on voit QUELS piliers bougeront (des points,
 *  plus gros pour un gros effet), jamais dans quel sens.
 *  Un pilier à 0 ou à 100, c'est la chute : révolte, exclusion,
 *  lynchage médiatique… mais aussi culte de la personnalité,
 *  homme ou femme d'appareil, connivence, marionnette des lobbies.
 *  Certaines cartes en appellent d'autres plus tard (`next`) :
 *  des histoires qui se poursuivent de carte en carte.
 * ============================================================ */

export type Pillar = 'peuple' | 'parti' | 'medias' | 'puissants';
export type Text = string | ((d: GameState) => string);

export interface ReqSide {
  /** Libellé court (< 40 caractères) : « Accepter », « Le mettre dehors »… */
  label: string;
  /** Effets sur les piliers (−25 … +25 ; d'ordinaire 5 à 15) */
  pillars: Partial<Record<Pillar, number>>;
  /** Effets de jeu habituels (légers : 1 à 4 points) */
  effects?: Effect[];
  /** Phrase de conclusion affichée après le choix */
  outcome?: Text;
  /** Une carte de suite, des mois plus tard */
  next?: { card: string; months: number };
  /** Traces en mémoire (flag mem_<clé>) */
  remember?: Record<string, number>;
}

export interface ReqCard {
  id: string;
  /** Prénom Nom */
  name: string;
  /** Fonction : « Préfète du Rhône », « Votre chauffeur »… */
  role: string;
  /** Un emoji-portrait */
  icon: string;
  /** La requête (vouvoiement) et, si l'interlocuteur vous tutoie, sa version tutoyée */
  text: Text;
  textTu?: Text;
  /** Il ou elle vous tutoie (proche, allié de longue date) */
  tu?: boolean;
  /** Gauche, puis droite */
  left: ReqSide;
  right: ReqSide;
  eligible?: (d: GameState) => boolean;
  weight?: number;
  /** Carte de suite seulement (jamais tirée au hasard) */
  chainOnly?: boolean;
  /** Peut revenir après tant de mois (sinon une fois par partie) */
  repeatAfter?: number;
}

export const mem = (d: GameState, key: string): number => Number(d.player.flags[`mem_${key}`] ?? 0);
const RANK_ORDER: Record<string, number> = { militant: 0, conseiller_municipal: 1, depute: 2, ministre: 3, premier_ministre: 3, chef_parti: 4, candidat_presidence: 5, president: 6, roi: 6, ancien_president: 6 };
export const rankAtLeast = (d: GameState, order: number): boolean => (RANK_ORDER[d.player.rankId] ?? 0) >= order;
export const st = (stat: 'popularity' | 'credibility' | 'influence' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });

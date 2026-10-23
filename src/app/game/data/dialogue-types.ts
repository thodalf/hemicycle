import { ContactType, Effect, GameState, StaffRole, StatKey } from '../models/game.models';
import { Rng } from '../engine/rng';
import { STAFF_BY_ROLE } from './staff';

/* ============================================================
 *  Conversations à embranchements au téléphone : le format.
 *
 *  Une conversation est un petit graphe de nœuds. Chaque nœud
 *  est un message reçu, avec deux à quatre réponses possibles.
 *  Une réponse peut :
 *   - avoir des effets immédiats (jauges, relations, dossiers…) ;
 *   - mener au nœud suivant (l'interlocuteur répond) ;
 *   - clore la conversation sur une dernière phrase (`end`) ;
 *   - laisser une trace en mémoire (`remember` → flag mem_<clé>)
 *     que d'autres conversations relisent (`if`, textes, éligibilité) ;
 *   - programmer une suite plusieurs mois plus tard (`later`) :
 *     l'interlocuteur revient avec les conséquences ;
 *   - être risquée (`risk`) : en cas d'échec, on bascule sur `fail`.
 *  Un nœud peut porter des effets à l'arrivée (`effects`) et des
 *  effets si l'on ne répond pas dans les deux mois (`ignore`).
 * ============================================================ */

export type Text = string | ((d: GameState) => string);

export interface DlgChoice {
  id: string;
  label: string;
  /** Précision sous le choix (coût, risque…) */
  hint?: string;
  effects?: Effect[];
  /** Le nœud suivant (l'interlocuteur répond) */
  next?: string;
  /** Dernière phrase de l'interlocuteur quand la conversation s'arrête là */
  end?: Text;
  /** Traces en mémoire : mem_<clé> += valeur */
  remember?: Record<string, number>;
  /** Une suite, des mois plus tard : l'interlocuteur revient au nœud indiqué */
  later?: { months: number; node: string };
  /** Le choix n'est proposé que si… */
  if?: (d: GameState) => boolean;
  /** Choix risqué : chance d'échec (réduite par la stat indiquée) ; en cas d'échec, on va au nœud `fail` */
  risk?: { chance: number; scaleWith?: StatKey; fail: string };
}

export interface DlgNode {
  text: Text;
  choices?: DlgChoice[];
  /** Effets dès l'arrivée du message (une conséquence qui tombe) */
  effects?: Effect[];
  /** Effets si le message reste sans réponse deux mois */
  ignore?: Effect[];
  /** Appel plutôt que SMS */
  call?: boolean;
}

export interface Speaker { who: string; from: string; role: string }

export interface DialogueDef {
  id: string;
  /** Qui écrit (null : personne de disponible, la conversation attend) */
  who: (d: GameState, rng: Rng) => Speaker | null;
  eligible: (d: GameState) => boolean;
  /** Poids au tirage (1 par défaut) */
  weight?: number;
  /** Peut revenir au bout de tant de mois (sinon : une fois par partie) */
  repeatAfter?: number;
  start: string;
  nodes: Record<string, DlgNode>;
}

/* ── Petits outils pour écrire les conversations ─────────── */

export const st = (stat: StatKey, delta: number): Effect => ({ kind: 'stat', stat, delta });
export const mem = (d: GameState, key: string): number => Number(d.player.flags[`mem_${key}`] ?? 0);
export const rankAtLeast = (d: GameState, order: number): boolean => RANK_ORDER[d.player.rankId] >= order;
const RANK_ORDER: Record<string, number> = { militant: 0, conseiller_municipal: 1, depute: 2, ministre: 3, premier_ministre: 3, chef_parti: 4, candidat_presidence: 5, president: 6, roi: 6, ancien_president: 6 };

/** Un membre de l'équipe (d'un rôle donné, ou n'importe lequel) */
export function teamSpeaker(role?: StaffRole) {
  return (d: GameState, rng: Rng): Speaker | null => {
    const pool = d.player.team.filter(r => !role || r.role === role);
    if (!pool.length) return null;
    const r = rng.pick(pool);
    return { who: `equipe:${r.id}`, from: r.name, role: STAFF_BY_ROLE.get(r.role)?.title ?? r.role };
  };
}

/** Le ou la chef·fe du parti (quand ce n'est pas vous) */
export function chiefSpeaker(d: GameState): Speaker | null {
  const id = d.party.leaderNpcId;
  if (!id || id === 'player') return null;
  const n = d.npcs.find(x => x.id === id);
  return n ? { who: 'chef', from: n.name, role: 'Chef·fe du parti' } : null;
}

const CONTACT_ROLES: Record<ContactType, string> = { lobby: 'Représentant·e d’intérêts', industriel: 'Industriel·le', syndicat: 'Syndicaliste', journaliste: 'Journaliste', association: 'Responsable associatif·ve', culte: 'Responsable religieux·se' };

/** Un contact du réseau, d'un type donné */
export function contactSpeaker(type?: ContactType) {
  return (d: GameState, rng: Rng): Speaker | null => {
    const pool = d.contacts.filter(c => !type || c.type === type);
    if (!pool.length) return null;
    const c = rng.pick(pool);
    return { who: `contact:${c.id}`, from: c.name.split(' (')[0], role: CONTACT_ROLES[c.type] };
  };
}

/** Une personnalité de votre répertoire (ou à défaut, la plus influente) */
export function personalitySpeaker(filter?: (rel: number) => boolean) {
  return (d: GameState, rng: Rng): Speaker | null => {
    const book = new Set(d.player.phoneBook ?? []);
    const pool = d.npcs.filter(n => book.has(n.id) && (!filter || filter(n.relationToPlayer)));
    if (!pool.length) return null;
    const n = rng.pick(pool);
    return { who: `perso:${n.id}`, from: n.name, role: 'Personnalité' };
  };
}

/** La famille */
export const familySpeaker = (from = 'Maman'): ((d: GameState) => Speaker) => () => ({ who: 'proche', from, role: 'Famille' });

/** Un interlocuteur de passage, qui garde son propre fil de discussion */
export const guestSpeaker = (key: string, from: string, role: string): ((d: GameState) => Speaker) => () => ({ who: `dlg:${key}`, from, role });

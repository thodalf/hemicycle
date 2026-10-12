import { Domain, Effect, GameState, RankId, RiskProfile } from '../models/game.models';
import { rankOrder } from './ranks';

/* ============================================================
 *  Projets au long cours : des actions qui s'étalent sur
 *  plusieurs semaines. Ils réservent des points d'action chaque
 *  semaine, produisent un peu d'effet en chemin et beaucoup à
 *  l'arrivée. On peut s'y consacrer entièrement : les semaines
 *  défilent alors jusqu'au terme du projet (ou jusqu'à ce qu'un
 *  événement important vous rappelle).
 * ============================================================ */

export interface ProjectDef {
  id: string;
  label: string;
  description: string;
  weeks: number;
  /** Points d'action réservés chaque semaine (petits projets ; les gros projets ne laissent que 2 ou 3 PA) */
  ap: number;
  /** Dépense au lancement, en euros */
  money?: number;
  minRank?: RankId;
  onlyRanks?: RankId[];
  /** Condition supplémentaire (scénario, âge…) et sa raison si elle n'est pas remplie */
  eligible?: (d: GameState) => string | null;
  /** Le domaine travaillé : sujet à la une ou ministère, figé au lancement */
  domain?: 'agenda' | 'portfolio' | Domain;
  weekly: Effect[];
  final: Effect[];
  risk?: RiskProfile;
  /** Délai (semaines) avant de pouvoir relancer le même projet */
  cooldown: number;
}

const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat, delta });

export const PROJECTS: ProjectDef[] = [
  {
    id: 'livre', label: 'Écrire un livre-programme', weeks: 8, ap: 2, cooldown: 52,
    description: 'Deux cents pages pour dire qui vous êtes et ce que vous voulez. Les soirées y passent.',
    domain: 'agenda',
    weekly: [st('energy', -3), st('stress', 1)],
    final: [st('credibility', 6), st('popularity', 4), { kind: 'dossier', domain: '$domain', delta: 8 }, { kind: 'income', base: 8000 }, { kind: 'exposure', delta: 2 }, { kind: 'scene', sceneId: 'promo_livre' }],
    risk: { baseChance: 0.3, scaleWith: 'credibility', scaleWeight: 0.6, onFailure: [st('credibility', 2), st('popularity', -2)], failureNews: 'Le livre fait un flop : 1 200 exemplaires vendus.' },
  },
  {
    id: 'tour_france', label: 'Tour de France des territoires', weeks: 6, ap: 3, money: 4000, cooldown: 26,
    description: 'Une région par semaine : marchés, usines, fermes, salles des fêtes.',
    weekly: [st('popularity', 1.5), st('energy', -6), st('stress', 2)],
    final: [{ kind: 'momentum', delta: 10 }, { kind: 'contact', contactId: 'ct-maires', trust: 10 }, { kind: 'dossier', domain: 'territoires', delta: 8 }, st('influence', 2)],
  },
  {
    id: 'implantation', label: 'Campagne d’implantation locale', weeks: 12, ap: 2, cooldown: 26,
    description: 'Porte-à-porte méthodique, permanences, associations : trois mois pour devenir incontournable chez vous.',
    weekly: [st('popularity', 0.8), st('energy', -3)],
    final: [st('popularity', 5), st('influence', 4), { kind: 'contact', contactId: 'ct-maires', trust: 6 }, { kind: 'faction', factionId: '*', delta: 3 }],
  },
  {
    id: 'reseau', label: 'Tisser son réseau', weeks: 10, ap: 2, cooldown: 26,
    description: 'Déjeuners, dîners, clubs, cercles : dix semaines à remplir votre carnet d’adresses.',
    weekly: [st('influence', 0.6), st('energy', -2), { kind: 'exposure', delta: 0.3 }],
    final: [st('influence', 5), st('politicalCapital', 15), { kind: 'contact', contactId: 'ct-hamon', trust: 6 }, { kind: 'contact', contactId: 'ct-castaing', trust: 6 }],
  },
  {
    id: 'formation', label: 'Reprendre des études', weeks: 26, ap: 2, money: 9000, cooldown: 260,
    description: 'Un cursus exécutif en affaires publiques : six mois de cours du soir et de week-ends studieux.',
    weekly: [st('energy', -3), st('stress', 1)],
    final: [{ kind: 'skillPoints', delta: 3 }, st('credibility', 6), { kind: 'dossier', domain: 'economie', delta: 10 }, { kind: 'dossier', domain: 'justice', delta: 8 }],
  },
  {
    id: 'think_tank', label: 'Fonder un think tank', weeks: 16, ap: 2, money: 15000, cooldown: 104, minRank: 'conseiller_municipal',
    description: 'Des experts, des notes, un colloque inaugural : votre propre laboratoire d’idées.',
    domain: 'agenda',
    weekly: [{ kind: 'dossier', domain: '$domain', delta: 1 }, st('energy', -2)],
    final: [st('credibility', 8), st('influence', 6), { kind: 'dossier', domain: '$domain', delta: 8 }],
  },
  {
    id: 'mission_info', label: 'Mission d’information parlementaire', weeks: 10, ap: 2, cooldown: 26, onlyRanks: ['depute'],
    description: 'Auditions, déplacements, rapport final : devenir la référence sur un sujet.',
    domain: 'agenda',
    weekly: [{ kind: 'dossier', domain: '$domain', delta: 1.5 }, st('energy', -3)],
    final: [{ kind: 'dossier', domain: '$domain', delta: 12 }, st('credibility', 6), st('influence', 3)],
  },
  {
    id: 'proposition_loi', label: 'Porter une proposition de loi', weeks: 12, ap: 2, cooldown: 26, onlyRanks: ['depute'],
    description: 'Rédiger, cosigner, convaincre le groupe, obtenir une place à l’ordre du jour.',
    domain: 'agenda',
    weekly: [st('energy', -3), st('stress', 1)],
    final: [st('popularity', 5), st('credibility', 5), st('influence', 4), { kind: 'dossier', domain: '$domain', delta: 6 }],
    risk: { baseChance: 0.5, scaleWith: 'influence', scaleWeight: 0.6, onFailure: [st('credibility', 2), st('stress', 4)], failureNews: 'Votre proposition de loi est renvoyée en commission… pour toujours.' },
  },
  {
    id: 'grande_reforme', label: 'Préparer une grande réforme', weeks: 16, ap: 3, cooldown: 52, onlyRanks: ['ministre'],
    description: 'Concertations, arbitrages, avis du Conseil d’État : un texte qui portera votre nom.',
    domain: 'portfolio',
    weekly: [{ kind: 'dossier', domain: '$domain', delta: 1 }, st('energy', -4), st('stress', 2)],
    final: [{ kind: 'dossier', domain: '$domain', delta: 10 }, st('credibility', 6), st('influence', 5), st('popularity', -3), { kind: 'debate', stakes: 'hemicycle' }],
  },
  {
    id: 'plan_relance', label: 'Plan de relance', weeks: 20, ap: 3, cooldown: 104, onlyRanks: ['premier_ministre'],
    description: 'Cent milliards pour l’industrie, le logement et la transition. Cinq mois de négociations.',
    weekly: [st('energy', -4), st('stress', 2), { kind: 'government', cohesion: 0.3 }],
    final: [{ kind: 'government', majority: 8 }, st('popularity', 5), { kind: 'dossier', domain: 'economie', delta: 10 }, st('credibility', 4)],
    risk: { baseChance: 0.35, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [{ kind: 'government', majority: -4 }, st('popularity', -2)], failureNews: 'Le plan de relance est raboté par Bercy : un pétard mouillé.' },
  },
  {
    id: 'refondation', label: 'Refonder le parti', weeks: 16, ap: 3, cooldown: 104, onlyRanks: ['chef_parti'],
    description: 'Nouveau nom de code, nouveaux statuts, consultation des adhérents, grand congrès final.',
    weekly: [{ kind: 'cohesion', delta: 0.5 }, st('energy', -4)],
    final: [{ kind: 'faction', factionId: '*', delta: 6 }, { kind: 'partyTreasury', delta: 50 }, { kind: 'momentum', delta: 8 }, st('influence', 4)],
  },
  {
    id: 'grand_chantier', label: 'Grand chantier présidentiel', weeks: 26, ap: 3, cooldown: 104, onlyRanks: ['president'],
    description: 'La grande réforme du quinquennat, de la concertation au vote.',
    weekly: [st('energy', -3), st('stress', 2), { kind: 'presidency', approval: -0.2 }],
    final: [{ kind: 'presidency', reform: true, force: true, approval: 6 }, st('credibility', 5), st('influence', 4)],
  },
  {
    id: 'tournee_mondiale', label: 'Tournée diplomatique mondiale', weeks: 6, ap: 4, cooldown: 52, onlyRanks: ['president'],
    description: 'Six semaines, quatre continents, vingt chefs d’État.',
    weekly: [{ kind: 'intl', prestige: 1 }, st('energy', -6), { kind: 'presidency', approval: -0.3 }],
    final: [{ kind: 'intl', allRelations: 5, prestige: 4 }, st('influence', 5)],
  },
  {
    id: 'grande_enquete', label: 'Mener une grande enquête', weeks: 12, ap: 2, cooldown: 26,
    eligible: d => (d.press ? null : 'Réservé aux journalistes'),
    description: 'Trois mois sur une affaire : sources, documents, recoupements.',
    weekly: [{ kind: 'press', reputation: 0.5 }, st('energy', -3), st('stress', 1)],
    final: [{ kind: 'press', scoops: 1, reputation: 8, audience: 6 }, st('influence', 3)],
    risk: { baseChance: 0.3, onFailure: [{ kind: 'press', reputation: -4 }, st('stress', 6)], failureNews: 'Une source se rétracte : l’enquête ne paraîtra pas.' },
  },
  {
    id: 'memoires_long', label: 'Écrire ses mémoires', weeks: 20, ap: 2, cooldown: 260, onlyRanks: ['ancien_president'],
    description: 'Le récit de votre quinquennat, de l’intérieur.',
    weekly: [st('energy', -2)],
    final: [{ kind: 'income', base: 150000 }, st('popularity', 4), st('credibility', 2), { kind: 'exposure', delta: 4 }],
  },
  {
    id: 'cure_longue', label: 'Six mois au vert', weeks: 26, ap: 0, cooldown: 52,
    description: 'Se retirer pour se refaire une santé. Votre agenda est presque vide, vos adversaires occupent le terrain.',
    weekly: [st('stress', -3), st('energy', 4), { kind: 'health', delta: 0.3 }, st('popularity', -0.3), st('influence', -0.5)],
    final: [{ kind: 'health', delta: 6 }, { kind: 'flagAdd', key: 'hygiene', delta: 4 }],
  },
  {
    id: 'sabbatique', label: 'Année sabbatique', weeks: 52, ap: 0, cooldown: 260,
    description: 'Un an loin de la politique : voyages, famille, lectures. On revient changé·e… et un peu oublié·e.',
    eligible: d => (d.presidency ? 'Impossible à l’Élysée' : null),
    weekly: [st('stress', -3), st('energy', 5), { kind: 'health', delta: 0.25 }, st('popularity', -0.35), st('influence', -0.45)],
    final: [{ kind: 'health', delta: 8 }, { kind: 'flagAdd', key: 'hygiene', delta: 6 }, st('credibility', 2), { kind: 'skillPoints', delta: 1 }],
  },
];

/** Un gros projet (12 semaines et plus) accapare l'agenda : il ne laisse que 3 PA par semaine, 2 au-delà de six mois */
export function projectLeaves(def: ProjectDef): number | null {
  if (def.weeks >= 26) return 2;
  if (def.weeks >= 12) return 3;
  return null;
}

/** Points d'action réservés chaque semaine pour un maximum donné */
export function projectReserve(def: ProjectDef, max: number): number {
  const leaves = projectLeaves(def);
  return leaves !== null ? Math.max(0, max - leaves) : Math.min(def.ap, max);
}

/** Libellé de la charge : « 2 PA par semaine », « ne laisse que 3 PA » */
export function projectLoadLabel(def: ProjectDef): string {
  const leaves = projectLeaves(def);
  return leaves !== null ? `gros projet : ne laisse que ${leaves} PA/sem.` : `${def.ap} PA/sem.`;
}

export const PROJECTS_BY_ID = new Map(PROJECTS.map(p => [p.id, p]));

/** Le projet est-il proposé à ce rang ? */
export function projectVisible(d: GameState, p: ProjectDef): boolean {
  if (p.onlyRanks && !p.onlyRanks.includes(d.player.rankId)) return false;
  if (p.minRank && rankOrder(d.player.rankId) < rankOrder(p.minRank)) return false;
  if (p.id === 'grande_enquete' && !d.press) return false;
  return true;
}

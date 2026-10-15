import { ActionDefinition, DecisionChoice, Domain, Effect, GameState } from '../models/game.models';

/* ============================================================
 *  Les crises nationales (inondations, grève, krach…) :
 *  chacune a sa réponse propre dans la décision d'ouverture,
 *  un rebondissement le mois suivant, et deux actions dédiées
 *  tant qu'elle dure.
 * ============================================================ */

export type NatCrisisId = 'inondations' | 'greve_transports' | 'krach' | 'sommet_ue' | 'hopitaux' | 'cyber_hopitaux' | 'rentree' | 'usine' | 'evasion' | 'violences';

const st = (stat: 'popularity' | 'credibility' | 'influence' | 'energy' | 'stress' | 'politicalCapital', delta: number): Effect => ({ kind: 'stat', stat, delta });
const dos = (domain: Domain, delta: number): Effect => ({ kind: 'dossier', domain, delta });

/** La crise nationale en cours (s'il y en a une) */
export function natCrisis(d: GameState): NatCrisisId | null {
  const c = d.nationalCrisis;
  return c && d.week <= c.until ? (c.id as NatCrisisId) : null;
}

/** La réponse propre à chaque crise, ajoutée à la décision d'ouverture */
export const NAT_CHOICES: Record<NatCrisisId, DecisionChoice> = {
  inondations: { id: 'catnat', label: 'Exiger l’état de catastrophe naturelle sous 48 heures', hint: 'Les indemnisations débloquées tout de suite.',
    effects: [st('popularity', 4), dos('ecologie', 3), { kind: 'segment', segment: 'ruraux', delta: 2 }, st('politicalCapital', -4)], outcome: 'L’arrêté paraît au Journal officiel en un temps record.' },
  greve_transports: { id: 'mediation', label: 'Proposer une médiation entre la direction et les syndicats', hint: 'Une négociation à mener vous-même.', play: 'negociation_syndicale',
    effects: [st('credibility', 4), dos('social', 3), { kind: 'segment', segment: 'populaires', delta: 2 }], outcome: 'Les deux camps acceptent de se rasseoir à la table.' },
  krach: { id: 'garantie', label: 'Plaider pour une garantie publique des dépôts', hint: 'Rassurer les épargnants avant qu’ils ne se ruent aux guichets.',
    effects: [st('credibility', 5), dos('economie', 4), { kind: 'segment', segment: 'retraites', delta: 2 }, { kind: 'economy', deficit: 0.02 }], outcome: 'Les files devant les banques se dispersent.' },
  sommet_ue: { id: 'axe', label: 'Proposer un axe franco-allemand avant le sommet', hint: 'Arriver à Bruxelles avec un allié.', play: 'interprete',
    effects: [{ kind: 'intl', prestige: 3 }, st('influence', 3), dos('diplomatie', 3)], outcome: 'Berlin signe une déclaration commune la veille du sommet.' },
  hopitaux: { id: 'reservistes', label: 'Rappeler les soignants retraités et réservistes', hint: 'Des renforts dès la semaine prochaine.',
    effects: [dos('sante', 4), st('popularity', 3), { kind: 'segment', segment: 'retraites', delta: 1 }], outcome: 'Trois mille soignants répondent à l’appel.' },
  cyber_hopitaux: { id: 'anssi', label: 'Mobiliser les meilleurs experts en cybersécurité', hint: 'Reconstruire vite, et traquer les pirates.',
    effects: [dos('numerique', 4), st('credibility', 3), st('politicalCapital', -3)], outcome: 'Les systèmes redémarrent hôpital après hôpital.' },
  rentree: { id: 'contractuels', label: 'Recruter des contractuels en urgence', hint: 'Un adulte devant chaque classe, vite.',
    effects: [dos('education', 3), st('popularity', 2), { kind: 'segment', segment: 'jeunes', delta: 1 }, st('credibility', -1)], outcome: 'Les classes ont un professeur… pas toujours formé.' },
  usine: { id: 'repreneur', label: 'Chercher un repreneur, téléphone en main', hint: 'Appeler un à un les industriels du secteur.',
    effects: [dos('territoires', 4), st('popularity', 3), { kind: 'segment', segment: 'populaires', delta: 2 }, st('energy', -6)], outcome: 'Deux industriels acceptent de visiter le site.' },
  evasion: { id: 'traque', label: 'Exiger une traque totale et un audit des transferts', hint: 'La sécurité d’abord, les responsabilités ensuite.',
    effects: [dos('justice', 3), dos('securite', 2), st('credibility', 3)], outcome: 'Mille gendarmes ratissent la région.' },
  violences: { id: 'quartiers', label: 'Réunir maires, associations et policiers des quartiers', hint: 'Apaiser sans céder.', play: 'eloquence',
    effects: [dos('securite', 3), st('credibility', 3), st('popularity', 1)], outcome: 'Une nuit plus calme, et un dialogue renoué.' },
};

/** Le rebondissement, un mois après le début de la crise */
export const NAT_FOLLOWUPS: Record<NatCrisisId, { title: string; context: string; choices: DecisionChoice[] }> = {
  inondations: { title: 'Les sinistrés attendent leurs assurances', context: 'Un mois après les crues, des milliers de familles attendent encore l’expert de l’assurance. Certaines dorment chez des proches.',
    choices: [
      { id: 'assureurs', label: 'Convoquer les assureurs et fixer un délai', effects: [st('popularity', 3), st('credibility', 2)], outcome: 'Les assureurs promettent un passage sous quinze jours.' },
      { id: 'relogement', label: 'Ouvrir des logements d’urgence', effects: [st('popularity', 2), dos('ecologie', 1), st('politicalCapital', -3)], outcome: 'Mille familles relogées avant l’hiver.' }] },
  greve_transports: { title: 'La grève entre dans sa quatrième semaine', context: 'Les usagers sont à bout, les grévistes aussi. Un accord semble possible… à condition de céder sur les primes.',
    choices: [
      { id: 'ceder', label: 'Pousser à l’accord, primes comprises', effects: [st('popularity', 2), { kind: 'segment', segment: 'populaires', delta: 2 }, { kind: 'economy', deficit: 0.01 }], outcome: 'Les trains repartent lundi.' },
      { id: 'service', label: 'Réclamer un service minimum garanti', effects: [st('credibility', 2), { kind: 'segment', segment: 'cadres', delta: 2 }, { kind: 'segment', segment: 'populaires', delta: -2 }], outcome: 'La proposition durcit le conflit, mais rassure les usagers.' }] },
  krach: { title: 'Une grande banque appelle à l’aide', context: 'La troisième banque du pays ne peut plus se financer. Sa faillite emporterait l’épargne de millions de Français.',
    choices: [
      { id: 'nationaliser', label: 'Défendre une nationalisation temporaire', effects: [st('credibility', 3), dos('economie', 3), { kind: 'economy', deficit: 0.05 }, { kind: 'segment', segment: 'retraites', delta: 2 }], outcome: 'L’État entre au capital. Les épargnants respirent.' },
      { id: 'adosser', label: 'La faire racheter par une banque concurrente', effects: [st('influence', 2), { kind: 'economy', confidence: 2 }], outcome: 'Un rachat bouclé en un week-end.' }] },
  sommet_ue: { title: 'Le sommet joue les prolongations', context: 'Trente heures de négociation, et un pays bloque toujours l’accord final. Les traits sont tirés.',
    choices: [
      { id: 'nuit', label: 'Négocier toute la nuit, en tête-à-tête', play: 'sommet_ue', effects: [{ kind: 'intl', prestige: 3 }, st('influence', 2), st('energy', -6)], outcome: 'À l’aube, l’accord est signé.' },
      { id: 'quitter', label: 'Quitter la table pour mettre la pression', effects: [st('popularity', 1), { kind: 'intl', prestige: -1 }], outcome: 'Le coup de poker fait les gros titres. L’accord attendra.' }] },
  hopitaux: { title: 'Un service d’urgences ferme ses portes', context: 'Faute de personnel, les urgences d’un grand hôpital ferment la nuit. Les ambulances font quarante kilomètres de plus.',
    choices: [
      { id: 'prime', label: 'Une prime exceptionnelle pour les gardes de nuit', effects: [dos('sante', 3), st('popularity', 2), { kind: 'economy', deficit: 0.01 }], outcome: 'Les gardes de nuit sont pourvues dès la semaine suivante.' },
      { id: 'regulation', label: 'Organiser la régulation par le 15', effects: [st('credibility', 1), dos('sante', 1)], outcome: 'Moins d’engorgement, mais des patients mécontents.' }] },
  cyber_hopitaux: { title: 'Les pirates publient des dossiers médicaux', context: 'Faute de rançon, les pirates publient des milliers de dossiers de patients sur Internet.',
    choices: [
      { id: 'patients', label: 'Prévenir chaque patient et ouvrir une cellule d’aide', effects: [st('credibility', 3), dos('numerique', 2), st('politicalCapital', -2)], outcome: 'Une lettre personnelle à chaque patient touché.' },
      { id: 'retrait', label: 'Exiger le retrait des fichiers par les hébergeurs', effects: [dos('numerique', 1), st('influence', 1)], outcome: 'Les fichiers disparaissent… et réapparaissent ailleurs.' }] },
  rentree: { title: 'Les parents bloquent un collège', context: 'Sans professeur de mathématiques depuis la rentrée, des parents d’élèves occupent un collège.',
    choices: [
      { id: 'rencontrer', label: 'Les rencontrer et trouver un professeur', effects: [dos('education', 2), st('popularity', 2), st('energy', -4)], outcome: 'Un professeur retraité accepte de reprendre du service.' },
      { id: 'rectorat', label: 'Renvoyer vers le rectorat', effects: [st('popularity', -1)], outcome: 'L’occupation dure une semaine de plus.' }] },
  usine: { title: 'Les salariés séquestrent la direction', context: 'Exaspérés, des salariés retiennent deux cadres dirigeants dans les bureaux de l’usine.',
    choices: [
      { id: 'dialogue', label: 'Venir sur place et apaiser', play: 'negociation_syndicale', effects: [st('popularity', 2), dos('territoires', 2)], outcome: 'Les cadres sortent sous les applaudissements, une négociation s’ouvre.' },
      { id: 'condamner', label: 'Condamner fermement la séquestration', effects: [st('credibility', 2), { kind: 'segment', segment: 'populaires', delta: -2 }], outcome: 'Les gendarmes interviennent dans la nuit.' }] },
  evasion: { title: 'Le fugitif est localisé', context: 'Le détenu évadé serait caché dans une ferme isolée. Le GIGN est prêt à intervenir, mais une famille vit à côté.',
    choices: [
      { id: 'attendre', label: 'Attendre et négocier sa reddition', effects: [st('credibility', 2), dos('justice', 2)], outcome: 'Il se rend à l’aube, sans un coup de feu.' },
      { id: 'assaut', label: 'Laisser le GIGN intervenir', effects: [dos('securite', 3), st('popularity', 1)], risk: { baseChance: 0.75, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [st('popularity', -3), st('credibility', -2)], failureNews: 'L’assaut tourne mal : un gendarme blessé, le fugitif toujours en fuite.' }, outcome: 'Arrestation éclair, saluée par tous.' }] },
  violences: { title: 'Le quartier veut des réponses', context: 'Après les nuits de violences, les habitants d’un quartier réclament autre chose que des promesses : une école rénovée, un centre social, des emplois.',
    choices: [
      { id: 'plan', label: 'Un plan pour le quartier, chiffré et daté', play: 'chiffrage', effects: [st('credibility', 3), dos('territoires', 2), st('politicalCapital', -3)], outcome: 'Un plan précis, que les habitants pourront suivre mois après mois.' },
      { id: 'ordre', label: 'L’ordre d’abord, le reste ensuite', effects: [dos('securite', 2), { kind: 'segment', segment: 'retraites', delta: 2 }, { kind: 'segment', segment: 'jeunes', delta: -2 }], outcome: 'Les patrouilles se multiplient. La colère couve.' }] },
};

const act = (crisis: NatCrisisId, a: Omit<ActionDefinition, 'category' | 'minRank' | 'requires'>): ActionDefinition =>
  ({ ...a, category: 'crise', minRank: 'militant', requires: { natCrisis: crisis } });

/** Deux actions dédiées par crise, tant qu'elle dure */
export const NAT_ACTIONS: ActionDefinition[] = [
  act('inondations', { id: 'nc_inond_deblayer', label: 'Aider à déblayer les maisons sinistrées', description: 'Bottes, raclettes, et des familles qui ont tout perdu.', cost: { ap: 1, energy: 8 }, maxPerMonth: 1, effects: [st('popularity', 3), { kind: 'segment', segment: 'ruraux', delta: 2 }] }),
  act('inondations', { id: 'nc_inond_digues', label: 'Lancer un audit des digues', description: 'Où l’eau passera-t-elle la prochaine fois ?', cost: { ap: 1, energy: 4 }, maxPerMonth: 1, effects: [dos('ecologie', 3), st('credibility', 2)] }),
  act('greve_transports', { id: 'nc_greve_depot', label: 'Passer la nuit au dépôt avec les grévistes', description: 'Café, braseros, et des revendications à écouter.', cost: { ap: 1, energy: 7 }, maxPerMonth: 1, effects: [{ kind: 'segment', segment: 'populaires', delta: 3 }, st('popularity', 1)] }),
  act('greve_transports', { id: 'nc_greve_covoit', label: 'Organiser un covoiturage solidaire', description: 'Une plateforme pour que les soignants arrivent au travail.', cost: { ap: 1, energy: 4 }, maxPerMonth: 1, effects: [dos('social', 2), { kind: 'segment', segment: 'cadres', delta: 2 }] }),
  act('krach', { id: 'nc_krach_pme', label: 'Réunir les PME inquiètes', description: 'Trésorerie, prêts, carnets de commandes : écouter et rassurer.', cost: { ap: 1, energy: 4 }, maxPerMonth: 1, effects: [dos('economie', 3), st('credibility', 2)] }),
  act('krach', { id: 'nc_krach_tele', label: 'Expliquer la crise au journal de 20 heures', description: 'Des mots simples pour une crise compliquée.', minigame: 'allocution', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [st('credibility', 3), { kind: 'economy', confidence: 1 }] }),
  act('sommet_ue', { id: 'nc_ue_capitales', label: 'Faire la tournée des capitales', description: 'Rome, Madrid, Varsovie en trois jours.', cost: { ap: 1, energy: 7 }, maxPerMonth: 1, effects: [{ kind: 'intl', prestige: 2 }, dos('diplomatie', 3)] }),
  act('sommet_ue', { id: 'nc_ue_tribune', label: 'Signer une tribune dans la presse européenne', description: 'Le même texte, le même jour, dans vingt-sept journaux.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [st('influence', 2), dos('diplomatie', 2)] }),
  act('hopitaux', { id: 'nc_hop_nuit', label: 'Passer une nuit en réanimation', description: 'Les machines, les soignants épuisés, et les familles dans le couloir.', cost: { ap: 1, energy: 8 }, maxPerMonth: 1, effects: [dos('sante', 3), st('popularity', 2)] }),
  act('hopitaux', { id: 'nc_hop_lits', label: 'Négocier des lits avec les cliniques privées', description: 'Que chaque lit disponible serve, quel que soit son statut.', cost: { ap: 1, politicalCapital: 4 }, maxPerMonth: 1, effects: [dos('sante', 4), st('credibility', 1)] }),
  act('cyber_hopitaux', { id: 'nc_cyber_equipes', label: 'Soutenir les équipes informatiques des hôpitaux', description: 'Des nuits blanches à reconstruire les systèmes.', cost: { ap: 1, energy: 4 }, maxPerMonth: 1, effects: [dos('numerique', 3), st('credibility', 1)] }),
  act('cyber_hopitaux', { id: 'nc_cyber_loi', label: 'Proposer une loi de cybersécurité hospitalière', description: 'Des normes, des moyens, des contrôles.', cost: { ap: 1, politicalCapital: 5 }, maxPerMonth: 1, effects: [dos('numerique', 4), st('influence', 2)] }),
  act('rentree', { id: 'nc_rentree_college', label: 'Faire cours dans un collège sans professeur', description: 'Une heure d’éducation civique, debout devant trente élèves.', cost: { ap: 1, energy: 5 }, maxPerMonth: 1, effects: [dos('education', 2), st('popularity', 2), { kind: 'segment', segment: 'jeunes', delta: 2 }] }),
  act('rentree', { id: 'nc_rentree_concours', label: 'Plaider pour un concours exceptionnel', description: 'Recruter massivement, et former vraiment.', cost: { ap: 1, politicalCapital: 4 }, maxPerMonth: 1, effects: [dos('education', 4), st('credibility', 1)] }),
  act('usine', { id: 'nc_usine_grilles', label: 'Passer la journée devant les grilles', description: 'Avec les salariés, les familles, et le délégué syndical.', cost: { ap: 1, energy: 6 }, maxPerMonth: 1, effects: [{ kind: 'segment', segment: 'populaires', delta: 3 }, st('popularity', 2)] }),
  act('usine', { id: 'nc_usine_scop', label: 'Accompagner un projet de reprise en coopérative', description: 'Les salariés veulent racheter leur usine.', cost: { ap: 1, energy: 4 }, maxPerMonth: 1, effects: [dos('territoires', 3), dos('economie', 2)] }),
  act('evasion', { id: 'nc_evasion_prison', label: 'Visiter la prison d’où il s’est évadé', description: 'Surpopulation, failles, surveillants à bout.', cost: { ap: 1, energy: 5 }, maxPerMonth: 1, effects: [dos('justice', 3), st('credibility', 1)] }),
  act('evasion', { id: 'nc_evasion_victimes', label: 'Recevoir les victimes du fugitif', description: 'Elles ont peur. Elles veulent qu’on les écoute.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [st('popularity', 2), dos('justice', 1)] }),
  act('violences', { id: 'nc_violences_commerces', label: 'Rencontrer les commerçants dévastés', description: 'Vitrines brisées, stocks pillés, et des années de travail perdues.', cost: { ap: 1, energy: 5 }, maxPerMonth: 1, effects: [{ kind: 'segment', segment: 'retraites', delta: 1 }, dos('securite', 2), st('popularity', 1)] }),
  act('violences', { id: 'nc_violences_jeunes', label: 'Débattre avec les jeunes du quartier', description: 'Sans caméras, dans la salle du club de boxe.', cost: { ap: 1, energy: 5 }, maxPerMonth: 1, effects: [{ kind: 'segment', segment: 'jeunes', delta: 3 }, dos('territoires', 2)] }),
];

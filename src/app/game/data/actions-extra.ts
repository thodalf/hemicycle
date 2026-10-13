import { ActionDefinition, Domain, Effect } from '../models/game.models';

/* ============================================================
 *  Intrigues, carnet d'adresses et actions propres à chaque
 *  ministère (réservées au titulaire du portefeuille).
 * ============================================================ */

const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
const dos = (domain: Domain, delta: number): Effect => ({ kind: 'dossier', domain, delta });
const ct = (contactId: string, trust: number): Effect => ({ kind: 'contact', contactId, trust });

const INTRIGUES: ActionDefinition[] = [
  {
    id: 'complot_espionnage', label: 'Détourner des informations', category: 'intrigue', minRank: 'conseiller_municipal', target: 'npc',
    description: 'Mails internes, notes, agenda : récupérer de quoi tenir une personnalité. Le complot avance chaque mois et peut être découvert.',
    cost: { ap: 1, energy: 6, money: 3000 }, personalOnly: true,
    effects: [{ kind: 'scheme', type: 'espionnage', targetId: '$target' }],
  },
  {
    id: 'complot_calomnie', label: 'Lancer une campagne de dénigrement', category: 'intrigue', minRank: 'conseiller_municipal', target: 'npc',
    description: 'Comptes anonymes et rumeurs savamment distillées. Sa popularité finira par plonger.',
    cost: { ap: 1, energy: 5, money: 1500 }, personalOnly: true,
    effects: [{ kind: 'scheme', type: 'calomnie', targetId: '$target' }],
  },
  {
    id: 'complot_sabotage', label: 'Saboter l’action d’un rival', category: 'intrigue', minRank: 'depute', target: 'npc',
    description: 'Fuites, réunions annulées, alliés retournés : son influence s’effrite.',
    cost: { ap: 1, energy: 8, money: 4000, politicalCapital: 5 }, personalOnly: true,
    effects: [{ kind: 'scheme', type: 'sabotage', targetId: '$target' }],
  },
  {
    id: 'complot_debauchage', label: 'Débaucher les soutiens d’un rival', category: 'intrigue', minRank: 'depute', target: 'npc',
    description: 'Ses lieutenants, un par un, changent de camp. Lent, mais discret.',
    cost: { ap: 1, energy: 6, politicalCapital: 10 },
    effects: [{ kind: 'scheme', type: 'debauchage', targetId: '$target' }],
  },
  {
    id: 'complot_chantage', label: 'Faire chanter une personnalité', category: 'intrigue', minRank: 'conseiller_municipal', target: 'npc',
    description: 'Il faut un dossier compromettant (📁) : confidences au téléphone ou vol de documents. Ensuite, il ou elle vous obéit.',
    cost: { ap: 1, energy: 6 },
    effects: [{ kind: 'scheme', type: 'chantage', targetId: '$target' }],
  },
  {
    id: 'complot_avancer', label: 'Faire avancer vos complots', category: 'intrigue', minRank: 'conseiller_municipal', requires: { schemes: true },
    description: 'Rendez-vous discrets, messages chiffrés : tout s’accélère… et l’on prend plus de risques.',
    cost: { ap: 1, energy: 8 }, maxPerMonth: 1,
    effects: [{ kind: 'scheme', progress: 18, secrecy: -6 }],
  },
  {
    id: 'complot_brouiller', label: 'Brouiller les pistes', category: 'intrigue', minRank: 'conseiller_municipal', requires: { schemes: true },
    description: 'Intermédiaires, téléphones jetables, fausses pistes : la discrétion remonte.',
    cost: { ap: 1, money: 2500 }, maxPerMonth: 1, personalOnly: true,
    effects: [{ kind: 'scheme', secrecy: 15 }],
  },
  {
    id: 'numero_personnalite', label: 'Obtenir le numéro d’une personnalité', category: 'reseau', minRank: 'militant', target: 'npc',
    description: 'Un cocktail, un conseiller complaisant, un ancien camarade de promo : son portable finit dans votre téléphone.',
    cost: { ap: 1, energy: 4 },
    effects: [{ kind: 'phoneBook', npcId: '$target' }, st('influence', 1)],
    risk: { baseChance: 0.35, scaleWith: 'influence', scaleWeight: 0.6, onFailure: [st('stress', 2)], failureNews: 'Personne ne veut vous donner ce numéro. Il faudra plus d’entregent.' },
  },
];

/** Deux actions par ministère */
function min(domain: Domain, id: string, label: string, description: string, cost: ActionDefinition['cost'], effects: Effect[], extra: Partial<ActionDefinition> = {}): ActionDefinition {
  return { id, label, description, category: 'fonction', minRank: 'ministre', onlyRanks: ['ministre'], requires: { portfolio: domain }, cost, effects, cooldown: 3, ...extra };
}

const MINISTRIES: ActionDefinition[] = [
  // Économie
  min('economie', 'min_eco_patrons', 'Réunir les grands patrons à Bercy', 'Un petit-déjeuner, quarante chefs d’entreprise, des promesses d’investissement en France.',
    { ap: 2, energy: 10 }, [dos('economie', 5), st('influence', 3), ct('ct-btp', 4), st('popularity', -1)]),
  min('economie', 'min_eco_fraude', 'Lancer un plan contre la fraude fiscale', 'Des agents en plus, des croisements de fichiers, un objectif chiffré.',
    { ap: 2, energy: 12 }, [dos('economie', 4), st('credibility', 4), st('popularity', 2)], { cooldown: 6 }),
  // Écologie
  min('ecologie', 'min_eco_parc', 'Créer un parc naturel national', 'Une vallée protégée, des sentiers, et des agriculteurs à convaincre.',
    { ap: 2, energy: 12 }, [dos('ecologie', 5), ct('ct-climat', 5), st('popularity', 2), ct('ct-maires', -2)], { cooldown: 6 }),
  min('ecologie', 'min_eco_renovation', 'Lancer un grand plan de rénovation thermique', 'Des aides pour isoler les logements des ménages modestes.',
    { ap: 2, energy: 10 }, [dos('ecologie', 4), dos('social', 2), ct('ct-btp', 4), st('popularity', 2)]),
  // Sécurité
  min('securite', 'min_sec_terrain', 'Une nuit avec une brigade anticriminalité', 'Gilet pare-balles, sirènes, et des policiers qui vous parlent sans filtre.',
    { ap: 1, energy: 14 }, [dos('securite', 4), ct('ct-police', 5), st('popularity', 2)]),
  min('securite', 'min_sec_effectifs', 'Annoncer des recrutements de policiers', 'Deux mille postes de plus, et des commissariats rouverts.',
    { ap: 2, energy: 8, politicalCapital: 10 }, [dos('securite', 5), ct('ct-police', 4), st('popularity', 3)], { cooldown: 6 }),
  // Diplomatie
  min('diplomatie', 'min_dip_tournee', 'Tournée des capitales européennes', 'Cinq capitales en trois jours pour porter la voix de la France.',
    { ap: 2, energy: 16 }, [dos('diplomatie', 5), st('influence', 3), { kind: 'intl', prestige: 3 }]),
  min('diplomatie', 'min_dip_ambassadeurs', 'Réunir les ambassadeurs', 'La conférence annuelle : fixer le cap de la diplomatie française.',
    { ap: 1, energy: 8 }, [dos('diplomatie', 4), st('credibility', 3), { kind: 'intl', allRelations: 2 }], { cooldown: 6 }),
  // Social
  min('social', 'min_soc_smic', 'Proposer un coup de pouce au SMIC', 'Au-delà de la revalorisation automatique : un geste pour les bas salaires.',
    { ap: 2, energy: 8, politicalCapital: 12 }, [dos('social', 4), ct('ct-ust', 6), st('popularity', 4), ct('ct-btp', -3)], { cooldown: 12 }),
  min('social', 'min_soc_ehpad', 'Inspection surprise d’un EHPAD', 'Sans prévenir, avec deux inspecteurs : ce que l’on vous montre d’habitude n’est pas la réalité.',
    { ap: 1, energy: 10 }, [dos('social', 4), st('credibility', 3), st('popularity', 2)]),
  // Éducation
  min('education', 'min_edu_rentree', 'Conférence de presse de rentrée', 'Effectifs, programmes, revalorisation : le grand oral du ministère.',
    { ap: 1, energy: 8 }, [dos('education', 4), st('popularity', 2), ct('ct-enseignants', 3)], { cooldown: 12 }),
  min('education', 'min_edu_classes', 'Dédoubler les classes de CP', 'Douze élèves par classe dans les quartiers prioritaires.',
    { ap: 2, energy: 10, politicalCapital: 10 }, [dos('education', 5), ct('ct-enseignants', 5), st('popularity', 3)], { cooldown: 6 }),
  // Santé
  min('sante', 'min_san_urgences', 'Plan d’urgence pour les hôpitaux', 'Des lits rouverts, des primes pour les soignants de nuit.',
    { ap: 2, energy: 10, politicalCapital: 10 }, [dos('sante', 5), ct('ct-soignants', 6), st('popularity', 3)], { cooldown: 6 }),
  min('sante', 'min_san_prevention', 'Grande campagne de prévention', 'Vaccination, dépistage, tabac : spots télé et médecins mobilisés.',
    { ap: 1, energy: 6 }, [dos('sante', 3), st('credibility', 2), st('popularity', 1)]),
  // Numérique
  min('numerique', 'min_num_fibre', 'Accélérer le plan fibre', 'Les opérateurs sommés de raccorder les zones blanches avant l’hiver.',
    { ap: 2, energy: 10 }, [dos('numerique', 5), dos('territoires', 2), ct('ct-maires', 3), st('popularity', 2)]),
  min('numerique', 'min_num_startups', 'Salon des start-up françaises', 'Pitchs, investisseurs, licornes : la vitrine de la French Tech.',
    { ap: 1, energy: 8 }, [dos('numerique', 4), ct('ct-tech', 5), st('influence', 2)]),
  min('numerique', 'min_num_plateformes', 'Convoquer les grandes plateformes', 'Haine en ligne, protection des mineurs, fiscalité : vous exigez des engagements.',
    { ap: 2, energy: 10 }, [dos('numerique', 4), st('credibility', 3), st('popularity', 2)],
    { risk: { baseChance: 0.3, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [st('credibility', -3)], failureNews: 'Les plateformes envoient des stagiaires. Humiliation publique.' } }),
  // Territoires
  min('territoires', 'min_ter_maires', 'Recevoir l’Association des maires', 'Dotations, normes, déserts médicaux : les élus locaux ont la liste.',
    { ap: 1, energy: 8 }, [dos('territoires', 4), ct('ct-maires', 6), st('influence', 1)]),
  min('territoires', 'min_ter_ruralite', 'Lancer un agenda rural', 'Commerces, services publics, transports : cent mesures pour les villages.',
    { ap: 2, energy: 12, politicalCapital: 8 }, [dos('territoires', 5), st('popularity', 3), ct('ct-maires', 4)], { cooldown: 6 }),
  // Justice
  min('justice', 'min_jus_prisons', 'Visiter une prison surpeuplée', 'Trois détenus par cellule de neuf mètres carrés. Les surveillants vous attendent.',
    { ap: 1, energy: 10 }, [dos('justice', 4), st('credibility', 3), ct('ct-avocats', 2)]),
  min('justice', 'min_jus_delais', 'Plan contre la lenteur de la justice', 'Des greffiers, des magistrats, des audiences le samedi.',
    { ap: 2, energy: 10, politicalCapital: 10 }, [dos('justice', 5), ct('ct-avocats', 4), st('popularity', 2)], { cooldown: 6 }),
];

export const EXTRA_ACTIONS: ActionDefinition[] = [...INTRIGUES, ...MINISTRIES];

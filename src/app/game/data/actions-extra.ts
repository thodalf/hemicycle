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
    id: 'numero_personnalite', label: 'Obtenir le numéro d’une personnalité', category: 'intrigue', minRank: 'militant', target: 'npc',
    description: 'Un cocktail, un conseiller complaisant, un ancien camarade de promo : son portable finit dans votre téléphone.',
    cost: { ap: 1, energy: 4 },
    effects: [{ kind: 'phoneBook', npcId: '$target' }, st('influence', 1)],
    risk: { baseChance: 0.35, scaleWith: 'influence', scaleWeight: 0.6, onFailure: [st('stress', 2)], failureNews: 'Personne ne veut vous donner ce numéro. Il faudra plus d’entregent.' },
  },
  {
    id: 'intrigue_carnet', label: 'Racheter le carnet d’adresses d’un ancien conseiller', category: 'intrigue', minRank: 'conseiller_municipal',
    description: 'Un ex-conseiller ministériel, à court d’argent, vend son vieux téléphone. Trois numéros qui comptent, peut-être plus.',
    cost: { ap: 1, money: 4000 }, cooldown: 4, personalOnly: true,
    effects: [{ kind: 'phoneBook', npcId: '$any' }, { kind: 'phoneBook', npcId: '$any' }, { kind: 'phoneBook', npcId: '$any' }, { kind: 'exposure', delta: 2 }],
    risk: { baseChance: 0.2, onFailure: [{ kind: 'exposure', delta: 6 }, st('credibility', -2)], failureNews: 'L’histoire du téléphone revendu fuite dans la presse.' },
  },
  {
    id: 'intrigue_secretariat', label: 'Se faire un allié au secrétariat d’un rival', category: 'intrigue', minRank: 'depute', target: 'npc',
    description: 'Une assistante mal payée, un café, des fleurs : son agenda et son numéro personnel.',
    cost: { ap: 1, energy: 6, money: 1000 }, personalOnly: true,
    effects: [{ kind: 'phoneBook', npcId: '$target' }, { kind: 'scheme', progress: 6 }],
    risk: { baseChance: 0.25, onFailure: [{ kind: 'exposure', delta: 5 }, { kind: 'npcRelation', npcId: '$target', delta: -10 }], failureNews: 'L’assistante vous dénonce à son patron.' },
  },
];

/* ── Épidémie Z ───────────────────────────────────────────── */
const z = (x: Omit<Extract<Effect, { kind: 'zombie' }>, 'kind'>): Effect => ({ kind: 'zombie', ...x });

const ZOMBIE: ActionDefinition[] = [
  { id: 'z_barricades', label: 'Défendre votre quartier', category: 'zombie', minRank: 'militant',
    description: 'Barricades, rondes de nuit, voisins solidaires : votre rue tient.',
    cost: { ap: 1, energy: 12 }, maxPerMonth: 1, effects: [z({ infection: -2, panic: -2 }), st('popularity', 2)] },
  { id: 'z_benevoles', label: 'Monter un réseau de bénévoles', category: 'zombie', minRank: 'militant',
    description: 'Courses pour les personnes isolées, numéros d’urgence, entraide.',
    cost: { ap: 1, energy: 8 }, maxPerMonth: 1, effects: [z({ panic: -4 }), st('popularity', 1), st('credibility', 1)] },
  { id: 'z_bastion', label: 'Vous mettre à l’abri dans un bastion', category: 'zombie', minRank: 'militant',
    description: 'Un fort réaménagé, des murs épais : le risque d’être mordu·e chute. On vous reproche de vous cacher.',
    cost: { ap: 1, energy: 4 }, cooldown: 120, effects: [z({ shelter: true }), st('popularity', -3), st('influence', -1)] },
  { id: 'z_quarantaine', label: 'Imposer une quarantaine locale', category: 'zombie', minRank: 'conseiller_municipal',
    description: 'Fermer la commune, contrôler les entrées, tester tout le monde.',
    cost: { ap: 1, politicalCapital: 5 }, maxPerMonth: 1, effects: [z({ containment: 8 }), st('popularity', -1)] },
  { id: 'z_refuges', label: 'Ouvrir des refuges', category: 'zombie', minRank: 'conseiller_municipal',
    description: 'Gymnases, écoles, églises : des lieux sûrs pour les familles.',
    cost: { ap: 1, money: 2000, energy: 6 }, maxPerMonth: 1, effects: [z({ panic: -6 }), st('popularity', 3)] },
  { id: 'z_labo', label: 'Financer un laboratoire de recherche', category: 'zombie', minRank: 'depute',
    description: 'Des séquenceurs, des chercheurs, des animaleries : la course au vaccin.',
    cost: { ap: 1, money: 6000 }, maxPerMonth: 1, effects: [z({ cure: 8 }), st('credibility', 1)] },
  { id: 'z_rassurer', label: 'S’adresser au pays pour le rassurer', category: 'zombie', minRank: 'depute',
    description: 'Un discours calme, des consignes claires, pas de fausse promesse.',
    cost: { ap: 1, energy: 6 }, cooldown: 2, effects: [z({ panic: -8 }), st('credibility', 1)],
    risk: { baseChance: 0.25, scaleWith: 'credibility', scaleWeight: 0.6, onFailure: [z({ panic: 5 }), st('popularity', -2)], failureNews: 'Votre « tout est sous contrôle » devient un mème.' } },
  { id: 'z_armee', label: 'Déployer l’armée sur les lignes de défense', category: 'zombie', minRank: 'ministre',
    description: 'Blindés, génie, hélicoptères : on reprend du terrain.',
    cost: { ap: 2, politicalCapital: 15 }, cooldown: 2, effects: [z({ containment: 15, infection: -5, panic: -3 })] },
  { id: 'z_vaccin', label: 'Accélérer les essais du vaccin', category: 'zombie', minRank: 'ministre',
    description: 'Sauter des étapes, recruter des volontaires, produire avant d’avoir fini.',
    cost: { ap: 2, politicalCapital: 10 }, cooldown: 2, effects: [z({ cure: 12 })],
    risk: { baseChance: 0.25, onFailure: [z({ cure: -4 }), st('popularity', -3)], failureNews: 'Effets secondaires graves : l’essai est suspendu.' } },
  { id: 'z_frontieres', label: 'Fermer les frontières entre régions', category: 'zombie', minRank: 'ministre',
    description: 'Plus de trains, plus d’autoroutes : chaque région devient une île.',
    cost: { ap: 1, energy: 6 }, cooldown: 3, effects: [z({ containment: 6 }), st('popularity', -1), { kind: 'dossier', domain: 'economie', delta: -2 }] },
];

/* ── Vie politique ordinaire ──────────────────────────────── */
const ORDINARY: ActionDefinition[] = [
  { id: 'parrainer_asso', label: 'Parrainer une association de quartier', category: 'terrain', minRank: 'militant',
    description: 'Aide aux devoirs, épicerie solidaire, club de boxe : vous donnez de votre temps.',
    cost: { ap: 1, energy: 8 }, cooldown: 3, effects: [st('popularity', 2), st('credibility', 1), { kind: 'dossier', domain: 'social', delta: 2 }] },
  { id: 'tribune_quotidien', label: 'Signer une tribune dans un grand quotidien', category: 'medias', minRank: 'depute', target: 'domain',
    description: 'Huit mille signes pour poser une idée dans le débat national.',
    cost: { ap: 1, energy: 6 }, cooldown: 2, effects: [st('credibility', 3), st('influence', 1), { kind: 'dossier', domain: '$domain', delta: 2 }] },
  { id: 'usine_menacee', label: 'Visiter une usine menacée de fermeture', category: 'terrain', minRank: 'conseiller_municipal',
    description: 'Les salariés en grève devant les grilles, un repreneur introuvable.',
    cost: { ap: 1, energy: 10 }, cooldown: 2, effects: [st('popularity', 2), { kind: 'dossier', domain: 'economie', delta: 2 }, ct('ct-ust', 2)] },
  { id: 'apero_militants', label: 'Apéro avec les militants de la section', category: 'parti', minRank: 'militant',
    description: 'Cacahuètes, rosé, et les vrais problèmes de la section.',
    cost: { ap: 1, energy: 4, money: 150 }, cooldown: 2, effects: [{ kind: 'cohesion', delta: 2 }, { kind: 'faction', factionId: '*', delta: 2 }, st('stress', -2)] },
  { id: 'cours_anglais', label: 'Prendre des cours d’anglais intensifs', category: 'dossiers', minRank: 'militant',
    description: 'Deux heures par jour avec une prof exigeante. Les sommets internationaux vous remercieront.',
    cost: { ap: 1, energy: 8, money: 600 }, cooldown: 3, effects: [{ kind: 'dossier', domain: 'diplomatie', delta: 4 }, st('credibility', 1)] },
  { id: 'conference_universite', label: 'Donner une conférence à Sciences Po', category: 'dossiers', minRank: 'depute', target: 'domain',
    description: 'Un amphi plein, des étudiants qui ont tout lu, des questions qui piquent.',
    cost: { ap: 1, energy: 8 }, cooldown: 3, effects: [{ kind: 'dossier', domain: '$domain', delta: 3 }, st('credibility', 2), st('influence', 1)] },
  { id: 'footing_presse', label: 'Footing matinal avec des journalistes', category: 'medias', minRank: 'conseiller_municipal',
    description: 'Huit kilomètres, des confidences essoufflées et une photo en baskets.',
    cost: { ap: 1, energy: 10 }, cooldown: 2, effects: [st('popularity', 1), st('influence', 1), { kind: 'health', delta: 1 }] },
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

export const EXTRA_ACTIONS: ActionDefinition[] = [...INTRIGUES, ...ZOMBIE, ...ORDINARY, ...MINISTRIES];

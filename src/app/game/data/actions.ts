import { ActionCategory, ActionDefinition, Effect } from '../models/game.models';

/**
 * Catalogue des actions hebdomadaires.
 * risk.baseChance = probabilité d'échec avant modulation par la stat (ou la maîtrise du dossier).
 */
const RAW_ACTIONS: ActionDefinition[] = [
  // ── Terrain ───────────────────────────────────────────────
  {
    id: 'porte_a_porte', label: 'Porte-à-porte', category: 'terrain', minRank: 'militant',
    description: 'Arpenter les cages d’escalier. Lent, mais ça construit une base.',
    cost: { ap: 1, energy: 8 }, maxPerWeek: 2,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'momentum', delta: 3 }],
  },
  {
    id: 'reunion_quartier', label: 'Réunion de quartier', category: 'terrain', minRank: 'militant',
    description: 'Écouter les doléances, prendre des notes, promettre peu.',
    cost: { ap: 1, energy: 6 },
    effects: [
      { kind: 'stat', stat: 'popularity', delta: 1 }, { kind: 'stat', stat: 'credibility', delta: 2 },
      { kind: 'faction', factionId: 'moderes', delta: 1 },
    ],
  },
  {
    id: 'meeting', label: 'Organiser un meeting', category: 'terrain', minRank: 'conseiller_municipal',
    description: 'Salle, sono, militants en renfort. Un bon meeting fait les gros titres locaux.',
    cost: { ap: 2, energy: 15, money: 3000 }, maxPerWeek: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 4 }, { kind: 'momentum', delta: 9 }, { kind: 'stat', stat: 'stress', delta: 4 }],
    risk: {
      baseChance: 0.3, scaleWith: 'popularity', scaleWeight: 0.8,
      onFailure: [{ kind: 'stat', stat: 'popularity', delta: -2 }, { kind: 'stat', stat: 'stress', delta: 6 }],
      failureNews: 'Salle à moitié vide : les images tournent en boucle.',
    },
  },
  {
    id: 'manifestation', label: 'Mener une manifestation', category: 'terrain', minRank: 'militant',
    description: 'Choisir une cause, rallier des alliés, tenir le cortège jusqu’au discours. Se joue en fin de semaine.',
    cost: { ap: 2, energy: 12 }, maxPerWeek: 1, cooldownWeeks: 4,
    effects: [{ kind: 'protest' }],
  },
  {
    id: 'marche', label: 'Tournée du marché du dimanche', category: 'terrain', minRank: 'militant',
    description: 'Quatre rencontres entre les étals : écouter, promettre, convaincre. Se joue en fin de semaine.',
    cost: { ap: 1, energy: 6 }, maxPerWeek: 1, cooldownWeeks: 2,
    effects: [{ kind: 'scene', sceneId: 'marche' }],
  },
  {
    id: 'grand_meeting', label: 'Organiser un grand meeting', category: 'terrain', minRank: 'conseiller_municipal',
    description: 'La salle, la première partie, le discours, l’imprévu, le final. Se joue en fin de semaine.',
    cost: { ap: 2, energy: 12 }, maxPerWeek: 1, cooldownWeeks: 3,
    effects: [{ kind: 'scene', sceneId: 'meeting' }],
  },
  {
    id: 'inauguration', label: 'Inaugurations & commémorations', category: 'terrain', minRank: 'conseiller_municipal',
    description: 'Couper des rubans, serrer des mains, être sur la photo.',
    cost: { ap: 1, energy: 5 },
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'influence', delta: 1 }, { kind: 'stat', stat: 'credibility', delta: -1 }],
  },

  // ── Médias ───────────────────────────────────────────────
  {
    id: 'post_reseaux', label: 'Campagne réseaux sociaux', category: 'medias', minRank: 'militant',
    description: 'Vidéo verticale, punchline, hashtag. Attention au bad buzz.',
    cost: { ap: 1, energy: 3 }, maxPerWeek: 2,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'momentum', delta: 2 }],
    risk: {
      baseChance: 0.3, scaleWith: 'credibility', scaleWeight: 0.7,
      onFailure: [
        { kind: 'stat', stat: 'popularity', delta: -4 }, { kind: 'stat', stat: 'stress', delta: 6 },
        { kind: 'exposure', delta: 3 },
      ],
      failureNews: 'Bad buzz : une vidéo sortie de son contexte devient virale.',
    },
  },
  {
    id: 'tribune', label: 'Signer une tribune', category: 'medias', minRank: 'militant', target: 'domain',
    description: 'Une prise de position écrite. Mieux vaut maîtriser le sujet.',
    cost: { ap: 1, energy: 6 },
    effects: [{ kind: 'stat', stat: 'credibility', delta: 4 }, { kind: 'stat', stat: 'influence', delta: 2 }],
    risk: {
      baseChance: 0.6, scaleWith: 'dossier', scaleWeight: 0.95,
      onFailure: [{ kind: 'stat', stat: 'credibility', delta: -6 }],
      failureNews: 'Tribune démontée par les experts : approximations relevées.',
    },
  },
  {
    id: 'plateau_tv', label: 'Accepter un plateau TV', category: 'medias', minRank: 'conseiller_municipal',
    description: 'Une interview en direct sur le sujet du moment. Préparez vos éléments de langage.',
    cost: { ap: 2, energy: 12 }, maxPerWeek: 1,
    effects: [{ kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'decision', templateId: 'interview' }],
  },
  {
    id: 'face_a_face', label: 'Face-à-face contradictoire', category: 'medias', minRank: 'militant',
    description: 'Un débat en direct contre un adversaire : réunion publique d’abord, plateaux télé ensuite. Se joue en fin de semaine.',
    cost: { ap: 2, energy: 12 }, maxPerWeek: 1, cooldownWeeks: 2,
    effects: [{ kind: 'debate', stakes: 'face_a_face' }],
  },
  {
    id: 'hemicycle', label: 'Joute dans l’hémicycle', category: 'medias', minRank: 'depute',
    description: 'Questions au gouvernement : trois manches sous l’œil des caméras de l’Assemblée.',
    cost: { ap: 2, energy: 10 }, cooldownWeeks: 2,
    effects: [{ kind: 'debate', stakes: 'hemicycle' }],
  },
  {
    id: 'commission', label: 'Mener une commission d’enquête', category: 'dossiers', minRank: 'depute',
    description: 'Auditionner sous serment le PDG d’une grande entreprise. Se joue en fin de semaine.',
    cost: { ap: 2, energy: 10 }, cooldownWeeks: 4,
    effects: [{ kind: 'scene', sceneId: 'commission' }],
  },
  {
    id: 'campagne_pub', label: 'Campagne de communication', category: 'medias', minRank: 'depute',
    description: 'Affiches, tractage massif, sponsorisation. Ça coûte cher.',
    cost: { ap: 1, money: 6000 },
    effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'momentum', delta: 6 }, { kind: 'stat', stat: 'credibility', delta: -1 }],
  },

  // ── Dossiers ─────────────────────────────────────────────
  {
    id: 'etudier', label: 'Étudier un dossier', category: 'dossiers', minRank: 'militant', target: 'domain',
    description: 'Notes, rapports, chiffres clés. Indispensable avant de débattre.',
    cost: { ap: 1, energy: 5 },
    effects: [{ kind: 'dossier', domain: '$domain', delta: 12 }],
  },
  {
    id: 'experts', label: 'Auditionner des experts', category: 'dossiers', minRank: 'conseiller_municipal', target: 'domain',
    description: 'Un think tank vous briefe pendant une journée entière.',
    cost: { ap: 1, energy: 4, money: 1500 }, maxPerWeek: 1,
    effects: [{ kind: 'dossier', domain: '$domain', delta: 20 }, { kind: 'stat', stat: 'credibility', delta: 1 }, { kind: 'stat', stat: 'stress', delta: 4 }],
  },
  {
    id: 'formation', label: 'Formation intensive', category: 'dossiers', minRank: 'militant',
    description: 'Un séminaire de deux jours. Gagne un point de compétence.',
    cost: { ap: 2, energy: 10 }, cooldownWeeks: 4,
    effects: [{ kind: 'skillPoints', delta: 1 }],
  },

  // ── Parti ────────────────────────────────────────────────
  {
    id: 'courant', label: 'Travailler un courant', category: 'parti', minRank: 'militant', target: 'faction',
    description: 'Réunions, motions, textos tardifs. Les autres courants le remarquent.',
    cost: { ap: 1, energy: 6 },
    effects: [{ kind: 'faction', factionId: '$target', delta: 7 }, { kind: 'faction', factionId: '*', delta: -2 }],
  },
  {
    id: 'dejeuner', label: 'Déjeuner avec un cadre', category: 'parti', minRank: 'militant', target: 'npc',
    description: 'Un bon restaurant, une conversation franche.',
    cost: { ap: 1, money: 150 },
    effects: [{ kind: 'npcRelation', npcId: '$target', delta: 12 }, { kind: 'stat', stat: 'influence', delta: 1 }],
  },
  {
    id: 'duel', label: 'Défier un cadre en bureau national', category: 'parti', minRank: 'conseiller_municipal', target: 'npc',
    description: 'Un duel d’arguments devant les instances du parti. Le vainqueur rallie les courants.',
    cost: { ap: 2, politicalCapital: 8, energy: 8 }, cooldownWeeks: 3,
    effects: [{ kind: 'debate', stakes: 'duel_interne', opponentId: '$target' }],
  },
  {
    id: 'alliance', label: 'Négocier une alliance électorale', category: 'parti', minRank: 'chef_parti',
    description: 'Programme commun, circonscriptions, tête de liste : bâtir une coalition sans perdre ses militants.',
    cost: { ap: 2, politicalCapital: 10 }, cooldownWeeks: 8,
    effects: [{ kind: 'scene', sceneId: 'alliance' }],
  },
  {
    id: 'placer_proche', label: 'Placer un proche', category: 'parti', minRank: 'depute',
    description: 'Une nomination à un poste clé : votre réseau se consolide, la presse veille.',
    cost: { ap: 1, politicalCapital: 10 }, cooldownWeeks: 3,
    effects: [
      { kind: 'stat', stat: 'influence', delta: 6 }, { kind: 'faction', factionId: '*', delta: -2 },
      { kind: 'exposure', delta: 7 },
    ],
  },
  {
    id: 'intrigue', label: 'Fragiliser un rival', category: 'parti', minRank: 'conseiller_municipal', target: 'npc',
    description: 'Une confidence off à un journaliste, un dossier qui ressort…',
    cost: { ap: 2, politicalCapital: 12, energy: 8 }, cooldownWeeks: 2,
    effects: [
      { kind: 'npcStat', npcId: '$target', stat: 'influence', delta: -8 },
      { kind: 'npcStat', npcId: '$target', stat: 'popularity', delta: -5 },
      { kind: 'npcRelation', npcId: '$target', delta: -25 }, { kind: 'exposure', delta: 4 },
    ],
    risk: {
      baseChance: 0.55, scaleWith: 'influence', scaleWeight: 0.7,
      onFailure: [
        { kind: 'stat', stat: 'credibility', delta: -7 }, { kind: 'cohesion', delta: -6 },
        { kind: 'npcRelation', npcId: '$target', delta: -30 },
      ],
      failureNews: 'La manœuvre est éventée : « des méthodes d’un autre âge », tance le parti.',
    },
  },

  // ── Réseau ───────────────────────────────────────────────
  {
    id: 'cultiver', label: 'Cultiver un contact', category: 'reseau', minRank: 'militant', target: 'contact',
    description: 'Un café, des nouvelles, un intérêt sincère (ou presque).',
    cost: { ap: 1, energy: 4 },
    effects: [{ kind: 'contact', contactId: '$target', trust: 10 }],
  },
  {
    id: 'rendre_service', label: 'Rendre un service', category: 'reseau', minRank: 'militant', target: 'contact',
    description: 'Il vous en devra une. Ça coûte un peu de capital politique.',
    cost: { ap: 1, politicalCapital: 5 },
    effects: [{ kind: 'contact', contactId: '$target', trust: 4, balance: 1 }],
  },
  {
    id: 'faveur', label: 'Demander une faveur', category: 'reseau', minRank: 'militant', target: 'contact',
    targetCondition: { minTrust: 30 },
    description: 'Faire jouer le renvoi d’ascenseur. Sans crédit, c’est vous qui deviendrez débiteur.',
    cost: { ap: 1 },
    effects: [{ kind: 'favor', contactId: '$target' }],
  },
  {
    id: 'mediation', label: 'Proposer une médiation sociale', category: 'reseau', minRank: 'depute',
    description: 'Une grève s’enlise dans une grande entreprise : mettez direction et syndicats autour de la table.',
    cost: { ap: 2, energy: 10 }, cooldownWeeks: 4,
    effects: [{ kind: 'scene', sceneId: 'mediation' }],
  },
  {
    id: 'donateurs', label: 'Dîner de donateurs', category: 'reseau', minRank: 'militant',
    description: 'Lever des fonds pour la campagne. Gare aux mélanges des genres.',
    cost: { ap: 1, energy: 7 }, maxPerWeek: 1,
    effects: [{ kind: 'funds', account: 'campaign', delta: 5000 }, { kind: 'exposure', delta: 3 }, { kind: 'stat', stat: 'stress', delta: 2 }],
  },

  // ── Argent ───────────────────────────────────────────────
  {
    id: 'chronique', label: 'Tenir une chronique dans un magazine', category: 'argent', minRank: 'militant',
    description: 'Légal. Un billet par semaine, payé selon votre influence.',
    cost: { ap: 1, energy: 4 }, maxPerWeek: 1,
    effects: [{ kind: 'income', base: 600, scale: 'influence', mult: 25 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
  },
  {
    id: 'conference_payee', label: 'Donner une conférence rémunérée', category: 'argent', minRank: 'conseiller_municipal',
    description: 'Légal. Un cercle d’affaires vous invite à parler de votre vision. Plus vous êtes connu·e, mieux c’est payé.',
    cost: { ap: 1, energy: 6 }, cooldownWeeks: 2,
    effects: [{ kind: 'income', base: 1500, scale: 'popularity', mult: 80 }, { kind: 'stat', stat: 'influence', delta: 1 }],
  },
  {
    id: 'livre', label: 'Écrire un livre', category: 'argent', minRank: 'militant', target: 'domain',
    description: 'Légal. Un essai sur un dossier : droits d’auteur, crédibilité, et un dossier mieux maîtrisé.',
    cost: { ap: 2, energy: 12 }, cooldownWeeks: 8,
    effects: [{ kind: 'income', base: 2000, scale: 'popularity', mult: 150 }, { kind: 'stat', stat: 'credibility', delta: 3 }, { kind: 'dossier', domain: '$domain', delta: 8 }, { kind: 'stat', stat: 'stress', delta: 5 }],
    risk: {
      baseChance: 0.3, scaleWith: 'dossier', scaleWeight: 0.8,
      onFailure: [{ kind: 'income', base: 500 }, { kind: 'stat', stat: 'credibility', delta: -2 }],
      failureNews: 'Le livre est un flop : 800 exemplaires vendus, et une critique assassine.',
    },
  },
  {
    id: 'conseil', label: 'Mission de conseil pour une entreprise', category: 'argent', minRank: 'depute',
    description: 'Légal mais douteux : une société vous rémunère pour vos « conseils ». Conflit d’intérêts en vue.',
    cost: { ap: 1 }, cooldownWeeks: 3,
    effects: [{ kind: 'income', base: 4000, scale: 'influence', mult: 120 }, { kind: 'exposure', delta: 7 }],
  },
  {
    id: 'enveloppe', label: 'Accepter une enveloppe', category: 'argent', minRank: 'conseiller_municipal',
    description: 'Illégal. Un promoteur « remercie » votre bienveillance sur un permis de construire.',
    cost: { ap: 1 }, cooldownWeeks: 3,
    effects: [
      { kind: 'income', base: 6000, scale: 'influence', mult: 150 }, { kind: 'exposure', delta: 16 },
      { kind: 'flagAdd', key: 'illegal', delta: 1 },
    ],
    risk: {
      baseChance: 0.25, scaleWith: 'influence', scaleWeight: 0.4,
      onFailure: [{ kind: 'exposure', delta: 25 }, { kind: 'flagAdd', key: 'illegal', delta: 1 }, { kind: 'decision', templateId: 'enquete' }],
      failureNews: 'Le promoteur parlait au téléphone… sur écoute.',
    },
  },
  {
    id: 'emploi_fictif', label: 'Embaucher un proche en emploi fictif', category: 'argent', minRank: 'depute',
    description: 'Illégal. Un salaire d’assistant parlementaire versé à un proche qui ne travaille pas. Rapporte chaque mois… jusqu’au jour où.',
    cost: { ap: 1 }, cooldownWeeks: 6,
    effects: [
      { kind: 'income', base: 9000 }, { kind: 'exposure', delta: 14 }, { kind: 'flagAdd', key: 'illegal', delta: 1 },
    ],
  },
  {
    id: 'marche_public', label: 'Arranger un marché public', category: 'argent', minRank: 'conseiller_municipal',
    description: 'Illégal. Faire gagner une entreprise amie, contre rétrocommission. Se joue en fin de semaine.',
    cost: { ap: 2, energy: 6 }, cooldownWeeks: 6,
    effects: [{ kind: 'scene', sceneId: 'marche_public' }],
  },

  // ── Rédaction : débloquée par le scénario « Éditorialiste » ou un événement ──
  {
    id: 'edito', label: 'Écrire un éditorial', category: 'redaction', minRank: 'militant', target: 'domain',
    description: 'Une prise de position argumentée sur le sujet choisi. Mieux vaut le maîtriser.',
    cost: { ap: 1, energy: 6 },
    effects: [{ kind: 'press', reputation: 4, audience: 2 }, { kind: 'dossier', domain: '$domain', delta: 2 }],
    risk: {
      baseChance: 0.5, scaleWith: 'dossier', scaleWeight: 0.9,
      onFailure: [{ kind: 'press', reputation: -5 }],
      failureNews: 'Un expert démonte votre éditorial ligne par ligne.',
    },
  },
  {
    id: 'chronique_antenne', label: 'Assurer votre chronique', category: 'redaction', minRank: 'militant',
    description: 'Trois minutes à l’antenne ou une colonne dans le journal : le rendez-vous de vos fidèles.',
    cost: { ap: 1, energy: 8 }, maxPerWeek: 1,
    effects: [{ kind: 'press', audience: 5 }, { kind: 'stat', stat: 'popularity', delta: 1 }, { kind: 'stat', stat: 'stress', delta: 2 }],
  },
  {
    id: 'polemique', label: 'Lancer une polémique calculée', category: 'redaction', minRank: 'militant',
    description: 'Une formule outrancière, des millions de vues. Votre réputation en prend un coup.',
    cost: { ap: 1, energy: 4 }, cooldownWeeks: 2,
    effects: [{ kind: 'press', audience: 9, reputation: -5 }, { kind: 'exposure', delta: 3 }, { kind: 'stat', stat: 'popularity', delta: 1 }],
  },
  {
    id: 'enquete', label: 'Mener une enquête', category: 'redaction', minRank: 'militant',
    description: 'Des semaines de travail pour un scoop. Se joue en fin de semaine.',
    cost: { ap: 2, energy: 12 }, cooldownWeeks: 2,
    effects: [{ kind: 'scene', sceneId: 'enquete' }],
  },
  {
    id: 'off', label: 'Recueillir des confidences en off', category: 'redaction', minRank: 'militant', target: 'npc',
    description: 'Un café discret avec un responsable politique. Parfois, il lâche une information.',
    cost: { ap: 1, energy: 3 },
    effects: [{ kind: 'press', scoops: 1, audience: 3 }, { kind: 'npcRelation', npcId: '$target', delta: 4 }],
    risk: {
      baseChance: 0.6, scaleWith: 'influence', scaleWeight: 0.6,
      onFailure: [{ kind: 'npcRelation', npcId: '$target', delta: 3 }],
      failureNews: 'Rien d’exploitable cette fois, mais le lien est créé.',
    },
  },
  {
    id: 'conference_redac', label: 'Peser en conférence de rédaction', category: 'redaction', minRank: 'militant',
    description: 'Imposer vos sujets et défendre votre liberté face à la direction.',
    cost: { ap: 1, energy: 4 },
    effects: [{ kind: 'press', independance: 5, reputation: 1 }, { kind: 'stat', stat: 'influence', delta: 1 }],
  },
  {
    id: 'emission_direct', label: 'Animer une émission en direct', category: 'redaction', minRank: 'militant',
    requires: { pressGrade: 1 },
    description: 'Trois invités, un public, une heure de direct. Se joue en fin de semaine.',
    cost: { ap: 2, energy: 12 }, cooldownWeeks: 2,
    effects: [{ kind: 'scene', sceneId: 'direct' }],
  },
  {
    id: 'interview_exclu', label: 'Décrocher une interview exclusive', category: 'redaction', minRank: 'militant',
    requires: { pressGrade: 1 },
    description: 'Le ministre qui ne parle à personne… sauf à vous ?',
    cost: { ap: 2, energy: 6 }, cooldownWeeks: 3,
    effects: [{ kind: 'press', audience: 6, reputation: 3 }, { kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'stat', stat: 'stress', delta: 3 }],
    risk: {
      baseChance: 0.4, scaleWith: 'influence', scaleWeight: 0.6,
      onFailure: [{ kind: 'press', audience: -2 }],
      failureNews: 'Le ministre annule à la dernière minute.',
    },
  },
  {
    id: 'grand_oral', label: 'Interview contradictoire d’un poids lourd', category: 'redaction', minRank: 'militant', target: 'npc',
    requires: { pressGrade: 2 },
    description: 'Vous face à un responsable politique, question après question. Un vrai duel.',
    cost: { ap: 2, energy: 10 }, cooldownWeeks: 3,
    effects: [{ kind: 'press', audience: 4 }, { kind: 'debate', stakes: 'face_a_face', opponentId: '$target' }],
  },
  {
    id: 'clash_reseaux', label: 'Clasher un politique sur les réseaux', category: 'redaction', minRank: 'militant', target: 'npc',
    description: 'Un fil cinglant qui fait le tour d’internet.',
    cost: { ap: 1, energy: 3 }, cooldownWeeks: 2,
    effects: [
      { kind: 'press', audience: 5, reputation: -2 }, { kind: 'npcRelation', npcId: '$target', delta: -15 },
      { kind: 'npcStat', npcId: '$target', stat: 'popularity', delta: -3 },
    ],
  },
  {
    id: 'contrat', label: 'Renégocier votre contrat', category: 'redaction', minRank: 'militant',
    description: 'Votre audience vaut de l’or. À vous de le faire savoir.',
    cost: { ap: 1 }, cooldownWeeks: 12,
    effects: [{ kind: 'press', salaryPct: 15, independance: -3 }],
    risk: {
      baseChance: 0.45, scaleWith: 'influence', scaleWeight: 0.5,
      onFailure: [{ kind: 'press', independance: -6 }],
      failureNews: 'La direction refuse sèchement : « Personne n’est irremplaçable. »',
    },
  },
  {
    id: 'livre_enquete', label: 'Publier un livre-enquête', category: 'redaction', minRank: 'militant',
    requires: { pressGrade: 2 },
    description: 'Vos révélations réunies en volume : succès de librairie assuré si le sujet est brûlant.',
    cost: { ap: 2, energy: 15 }, cooldownWeeks: 20,
    effects: [{ kind: 'income', base: 6000, scale: 'popularity', mult: 150 }, { kind: 'press', reputation: 6, audience: 5, scoops: 1 }, { kind: 'stat', stat: 'stress', delta: 6 }, { kind: 'exposure', delta: 3 }],
  },

  // ── Encore d'autres actions ──────────────────────────────
  {
    id: 'benevolat', label: 'Journée de bénévolat', category: 'terrain', minRank: 'militant',
    description: 'Une journée à la banque alimentaire, sans caméra… ou presque.',
    cost: { ap: 1, energy: 8 }, maxPerWeek: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'stress', delta: -2 }, { kind: 'dossier', domain: 'social', delta: 1 }],
  },
  {
    id: 'concert_soutien', label: 'Organiser un concert de soutien', category: 'terrain', minRank: 'depute',
    description: 'Des artistes engagés, une grande salle, une billetterie au profit de la campagne.',
    cost: { ap: 2, energy: 10, money: 4000 }, cooldownWeeks: 8,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'momentum', delta: 4 }, { kind: 'funds', account: 'campaign', delta: 3000 }, { kind: 'stat', stat: 'stress', delta: 3 }, { kind: 'exposure', delta: 2 }],
  },
  {
    id: 'presse_regionale', label: 'Interview à la presse régionale', category: 'medias', minRank: 'militant',
    description: 'Moins prestigieux qu’un JT, mais lu par tous vos électeurs.',
    cost: { ap: 1, energy: 3 }, maxPerWeek: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 1 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
  },
  {
    id: 'demonter', label: 'Démonter les chiffres d’un rival', category: 'medias', minRank: 'conseiller_municipal', target: 'npc',
    description: 'Un fil documenté qui pointe ses erreurs. Il faut être sûr de soi.',
    cost: { ap: 1, energy: 5 }, cooldownWeeks: 2,
    effects: [{ kind: 'npcStat', npcId: '$target', stat: 'popularity', delta: -4 }, { kind: 'stat', stat: 'credibility', delta: 2 }, { kind: 'npcRelation', npcId: '$target', delta: -10 }],
    risk: {
      baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.6,
      onFailure: [{ kind: 'stat', stat: 'credibility', delta: -4 }],
      failureNews: 'Votre rival vous répond, chiffres à l’appui. C’est vous qui aviez tort.',
    },
  },
  {
    id: 'rapport_parlementaire', label: 'Rédiger un rapport parlementaire', category: 'dossiers', minRank: 'depute', target: 'domain',
    description: 'Six mois d’auditions résumés en 200 pages. Fait autorité.',
    cost: { ap: 2, energy: 10 }, cooldownWeeks: 6,
    effects: [{ kind: 'dossier', domain: '$domain', delta: 10 }, { kind: 'stat', stat: 'credibility', delta: 3 }, { kind: 'stat', stat: 'influence', delta: 1 }, { kind: 'stat', stat: 'stress', delta: 5 }],
  },
  {
    id: 'colloque', label: 'Organiser un colloque', category: 'dossiers', minRank: 'conseiller_municipal', target: 'domain',
    description: 'Une journée d’experts, de tables rondes et de petits fours.',
    cost: { ap: 1, energy: 6, money: 3000 }, cooldownWeeks: 4,
    effects: [{ kind: 'dossier', domain: '$domain', delta: 5 }, { kind: 'stat', stat: 'influence', delta: 2 }],
  },
  {
    id: 'adhesions', label: 'Campagne d’adhésion', category: 'parti', minRank: 'militant',
    description: 'Affiches, stands, parrainages : faire grossir les rangs.',
    cost: { ap: 1, energy: 5, money: 2000 }, cooldownWeeks: 3,
    effects: [{ kind: 'cohesion', delta: 2 }, { kind: 'momentum', delta: 2 }, { kind: 'faction', factionId: '*', delta: 2 }, { kind: 'partyTreasury', delta: 3 }],
  },
  {
    id: 'former_jeunes', label: 'Former de jeunes militants', category: 'parti', minRank: 'conseiller_municipal',
    description: 'Une école de cadres le samedi matin. Ils s’en souviendront.',
    cost: { ap: 1, energy: 6 },
    effects: [{ kind: 'cohesion', delta: 2 }, { kind: 'faction', factionId: 'reformistes', delta: 3 }, { kind: 'momentum', delta: 1 }],
  },
  {
    id: 'patrons', label: 'Petit-déjeuner avec des patrons', category: 'reseau', minRank: 'conseiller_municipal', target: 'contact',
    description: 'Croissants et confidences avec des chefs d’entreprise.',
    cost: { ap: 1, money: 200 },
    effects: [{ kind: 'contact', contactId: '$target', trust: 8 }, { kind: 'stat', stat: 'influence', delta: 1 }, { kind: 'stance', delta: 1 }],
  },
  {
    id: 'syndicats', label: 'Rencontrer les syndicats', category: 'reseau', minRank: 'militant',
    description: 'Une réunion franche avec l’intersyndicale.',
    cost: { ap: 1, energy: 5 },
    effects: [{ kind: 'contact', contactId: 'ct-ust', trust: 8 }, { kind: 'dossier', domain: 'social', delta: 2 }, { kind: 'stance', delta: -1 }],
  },

  // ── Infiltration : scénario « Infiltré·e » ───────────────
  {
    id: 'ecouter', label: 'Écouter aux portes', category: 'infiltration', minRank: 'militant',
    description: 'Traîner près du bureau du secrétaire fédéral à l’heure des coups de fil.',
    cost: { ap: 1, energy: 4 },
    effects: [{ kind: 'mole', intel: 3, cover: -3 }],
  },
  {
    id: 'fouiller', label: 'Fouiller les bureaux de la fédération', category: 'infiltration', minRank: 'militant',
    description: 'Le soir, quand le local se vide. Les tiroirs ne sont jamais fermés à clé.',
    cost: { ap: 1, energy: 6 }, maxPerWeek: 1,
    effects: [{ kind: 'mole', intel: 6, cover: -7 }, { kind: 'stat', stat: 'stress', delta: 4 }],
    risk: {
      baseChance: 0.3, scaleWith: 'influence', scaleWeight: 0.4,
      onFailure: [{ kind: 'mole', cover: -16 }, { kind: 'stat', stat: 'stress', delta: 8 }],
      failureNews: 'Un permanent vous surprend la main dans un classeur. Vous bafouillez une excuse.',
    },
  },
  {
    id: 'copier_fichier', label: 'Copier le fichier des adhérents', category: 'infiltration', minRank: 'conseiller_municipal',
    description: 'Une clé USB, cinq minutes seul·e devant l’ordinateur du trésorier.',
    cost: { ap: 2, energy: 8 }, cooldownWeeks: 4,
    effects: [{ kind: 'mole', intel: 14, cover: -12 }, { kind: 'stat', stat: 'stress', delta: 6 }, { kind: 'flagAdd', key: 'illegal', delta: 1 }],
    risk: {
      baseChance: 0.35, scaleWith: 'influence', scaleWeight: 0.4,
      onFailure: [{ kind: 'mole', cover: -24 }, { kind: 'exposure', delta: 8 }],
      failureNews: 'L’ordinateur enregistre la copie. Une enquête interne est ouverte.',
    },
  },
  {
    id: 'zele', label: 'Faire du zèle militant', category: 'infiltration', minRank: 'militant',
    description: 'Collages à 6 h, tractages sous la pluie : le meilleur camouflage, c’est l’exemplarité.',
    cost: { ap: 1, energy: 10 },
    effects: [{ kind: 'mole', cover: 9 }, { kind: 'faction', factionId: '*', delta: 2 }, { kind: 'stat', stat: 'stress', delta: 4 }, { kind: 'mole', handler: -2 }],
  },
  {
    id: 'rapport', label: 'Transmettre un rapport à votre officier', category: 'infiltration', minRank: 'militant',
    description: 'Un rendez-vous dans un square, une enveloppe sous un journal. Prime de 40 € par renseignement.',
    cost: { ap: 1, energy: 3 }, maxPerWeek: 1,
    effects: [{ kind: 'mole', deliver: true, cover: -4 }],
  },
  {
    id: 'zizanie', label: 'Semer la zizanie entre les courants', category: 'infiltration', minRank: 'militant',
    description: 'Une rumeur ici, un courriel transféré là. Les courants s’entre-déchirent.',
    cost: { ap: 1, energy: 5 }, cooldownWeeks: 2,
    effects: [{ kind: 'mole', sabotage: 8, cover: -6 }, { kind: 'faction', factionId: '*', delta: -2 }],
  },
  {
    id: 'fuite_presse', label: 'Organiser une fuite dans la presse', category: 'infiltration', minRank: 'militant',
    description: 'Un document interne explosif atterrit chez un journaliste. Le chef du parti vacille.',
    cost: { ap: 1, energy: 4 }, cooldownWeeks: 3,
    effects: [{ kind: 'mole', sabotage: 10, leaderPop: -6, cover: -9 }, { kind: 'exposure', delta: 3 }],
  },
  {
    id: 'desinformation', label: 'Jouer les agents doubles', category: 'infiltration', minRank: 'militant',
    description: 'Livrer à vos « camarades » de fausses informations sur votre vrai camp. Ils vous adorent ; votre officier beaucoup moins.',
    cost: { ap: 1, energy: 5 }, cooldownWeeks: 2,
    effects: [{ kind: 'mole', cover: 15, handler: -10 }, { kind: 'stat', stat: 'stress', delta: 4 }],
  },
  {
    id: 'retourner', label: 'Retourner un cadre du parti', category: 'infiltration', minRank: 'conseiller_municipal', target: 'npc',
    description: 'Un cadre aigri par la direction pourrait devenir votre source. Ou vous dénoncer.',
    cost: { ap: 2, energy: 6, politicalCapital: 10 }, cooldownWeeks: 4,
    effects: [{ kind: 'mole', intel: 10 }, { kind: 'npcRelation', npcId: '$target', delta: 10 }, { kind: 'stat', stat: 'stress', delta: 5 }],
    risk: {
      baseChance: 0.45, scaleWith: 'influence', scaleWeight: 0.6,
      onFailure: [{ kind: 'mole', cover: -22 }, { kind: 'npcRelation', npcId: '$target', delta: -30 }],
      failureNews: 'Le cadre fait semblant d’accepter… puis prévient la direction.',
    },
  },
  {
    id: 'reunion_secrete', label: 'Assister à une réunion secrète du bureau', category: 'infiltration', minRank: 'conseiller_municipal',
    description: 'Stratégie, listes, finances : tout se décide là. Se joue en fin de semaine.',
    cost: { ap: 2, energy: 10 }, cooldownWeeks: 3,
    effects: [{ kind: 'scene', sceneId: 'bureau_secret' }],
  },
  {
    id: 'deballage', label: 'Le grand déballage', category: 'infiltration', minRank: 'militant',
    requires: { moleDelivered: 150 },
    description: 'Conférence de presse : vous révélez tout. Victoire ou désastre, il n’y aura pas de retour. Se joue en fin de semaine.',
    cost: { ap: 3, energy: 15 },
    effects: [{ kind: 'scene', sceneId: 'deballage' }],
  },

  // ── Couronne : débloquée par le scénario ou un événement ───────────
  {
    id: 'tournee_prince', label: 'Organiser une tournée du prétendant', category: 'couronne', minRank: 'militant',
    description: 'Le prince parcourt une région : bains de foule, messe, rencontre des maires. Se joue en fin de semaine.',
    cost: { ap: 2, energy: 10, money: 2000 }, cooldownWeeks: 2,
    effects: [{ kind: 'scene', sceneId: 'tournee_prince' }],
  },
  {
    id: 'banquet', label: 'Banquet légitimiste', category: 'couronne', minRank: 'militant',
    description: 'Réunir notables, vieilles familles et intellectuels autour du prétendant.',
    cost: { ap: 1, money: 1500 },
    effects: [{ kind: 'crown', legitimite: 4 }, { kind: 'stat', stat: 'influence', delta: 1 }],
  },
  {
    id: 'affiches', label: 'Campagne « La France a besoin d’un roi »', category: 'couronne', minRank: 'militant',
    description: 'Affiches, vidéos, tribunes : rendre l’idée monarchique familière.',
    cost: { ap: 1, money: 2500 }, maxPerWeek: 1,
    effects: [{ kind: 'crown', soutien: 3 }, { kind: 'stat', stat: 'popularity', delta: 1 }],
    risk: {
      baseChance: 0.25, scaleWith: 'credibility', scaleWeight: 0.5,
      onFailure: [{ kind: 'crown', soutien: -2 }, { kind: 'stat', stat: 'popularity', delta: -2 }],
      failureNews: 'La campagne devient un mème moqueur : « Et pourquoi pas les carrosses ? »',
    },
  },
  {
    id: 'officiers', label: 'Dîner discret avec des officiers', category: 'couronne', minRank: 'militant',
    description: 'Sonder la loyauté de hauts gradés et de préfets envers la République.',
    cost: { ap: 1, politicalCapital: 5 }, cooldownWeeks: 2,
    effects: [{ kind: 'crown', armee: 6 }, { kind: 'exposure', delta: 5 }],
    risk: {
      baseChance: 0.35, scaleWith: 'influence', scaleWeight: 0.6,
      onFailure: [{ kind: 'crown', armee: -4 }, { kind: 'exposure', delta: 15 }],
      failureNews: 'Un colonel rapporte la conversation à sa hiérarchie. La DGSI s’intéresse à vous.',
    },
  },
  {
    id: 'constitution', label: 'Rédiger la Constitution du Royaume', category: 'couronne', minRank: 'militant',
    description: 'Une monarchie constitutionnelle moderne : il faut convaincre les juristes.',
    cost: { ap: 2, energy: 10 }, cooldownWeeks: 6,
    effects: [{ kind: 'crown', legitimite: 7, soutien: 2 }, { kind: 'stat', stat: 'credibility', delta: 3 }, { kind: 'dossier', domain: 'justice', delta: 8 }, { kind: 'stat', stat: 'popularity', delta: -2 }, { kind: 'stance', delta: 3 }],
  },
  {
    id: 'mariage', label: 'Célébrer le mariage princier', category: 'couronne', minRank: 'militant',
    description: 'Un mariage retransmis en direct : le moment de faire rêver le pays.',
    cost: { ap: 2, money: 15000 }, cooldownWeeks: 30,
    effects: [{ kind: 'crown', soutien: 8, legitimite: 6 }, { kind: 'stat', stat: 'popularity', delta: 4 }, { kind: 'booster', count: 1, reason: 'Le mariage attire de nouveaux talents au mouvement.' }],
  },
  {
    id: 'referendum', label: 'Convoquer un référendum sur la monarchie', category: 'couronne', minRank: 'militant',
    requires: { soutien: 45, legitimite: 55 },
    description: 'La voie légale : une campagne référendaire, puis le vote. Une défaite serait fatale.',
    cost: { ap: 3, energy: 15 },
    effects: [{ kind: 'scene', sceneId: 'referendum' }],
  },
  {
    id: 'coup', label: 'Tenter un coup de force institutionnel', category: 'couronne', minRank: 'militant',
    requires: { armee: 70 },
    description: 'La voie illégale : s’emparer des institutions en une nuit. En cas d’échec, c’est la prison.',
    cost: { ap: 3, energy: 20 },
    effects: [{ kind: 'scene', sceneId: 'coup' }],
  },

  // ── Loge : débloquée par le scénario ou un événement ───────────────
  {
    id: 'tenue', label: 'Présenter une planche en tenue', category: 'loge', minRank: 'militant',
    description: 'Un exposé devant vos frères et sœurs, suivi d’un débat. Indispensable pour monter en grade. Se joue en fin de semaine.',
    cost: { ap: 2, energy: 8 }, cooldownWeeks: 2,
    effects: [{ kind: 'scene', sceneId: 'tenue' }],
  },
  {
    id: 'agapes', label: 'Agapes fraternelles', category: 'loge', minRank: 'militant',
    description: 'Le repas qui suit la tenue : on y noue les vraies amitiés.',
    cost: { ap: 1, money: 300 },
    effects: [{ kind: 'lodge', fraternite: 5 }, { kind: 'stat', stat: 'stress', delta: -4 }],
  },
  {
    id: 'solliciter', label: 'Solliciter un frère', category: 'loge', minRank: 'militant', target: 'domain',
    requires: { grade: 1 },
    description: 'Un frère haut placé peut vous ouvrir une porte… mais la fraternité n’est pas un réseau d’affaires.',
    cost: { ap: 1 }, cooldownWeeks: 2,
    effects: [{ kind: 'stat', stat: 'influence', delta: 4 }, { kind: 'dossier', domain: '$domain', delta: 10 }, { kind: 'income', base: 1500 }, { kind: 'lodge', discretion: -10, fraternite: -4 }, { kind: 'exposure', delta: 3 }],
    risk: {
      baseChance: 0.3, scaleWith: 'influence', scaleWeight: 0.4,
      onFailure: [{ kind: 'lodge', fraternite: -10, discretion: -5 }],
      failureNews: 'Le frère refuse sèchement : « Ce n’est pas ce que nous sommes. » Cela se sait en loge.',
    },
  },
  {
    id: 'parrainer', label: 'Parrainer un profane', category: 'loge', minRank: 'militant',
    requires: { grade: 2 },
    description: 'Présenter un·e candidat·e à l’initiation. Un allié de plus, si tout se passe bien.',
    cost: { ap: 1 }, cooldownWeeks: 4,
    effects: [{ kind: 'lodge', fraternite: 6, discretion: -3 }, { kind: 'stat', stat: 'influence', delta: 2 }],
  },
  {
    id: 'fraternelle', label: 'Animer une fraternelle parlementaire', category: 'loge', minRank: 'depute',
    requires: { grade: 2 },
    description: 'Réunir discrètement les élus maçons de tous les partis autour de grands textes.',
    cost: { ap: 1, politicalCapital: 5 }, cooldownWeeks: 3,
    effects: [{ kind: 'stat', stat: 'influence', delta: 5 }, { kind: 'faction', factionId: '*', delta: 2 }, { kind: 'lodge', discretion: -9, fraternite: 3 }, { kind: 'exposure', delta: 2 }],
  },
  {
    id: 'convent', label: 'Se présenter à la Grande Maîtrise', category: 'loge', minRank: 'militant',
    requires: { grade: 3 },
    description: 'Le convent élit le Grand Maître de l’obédience. Une campagne feutrée, mais redoutable.',
    cost: { ap: 3, energy: 12 }, cooldownWeeks: 10,
    effects: [{ kind: 'scene', sceneId: 'convent' }],
  },

  // ── Nouvelles actions : terrain, médias, dossiers ────────
  {
    id: 'tractage', label: 'Distribuer des tracts', category: 'terrain', minRank: 'militant',
    description: 'Imprimer et distribuer 5 000 tracts à la sortie du métro. Le parti peut payer l’impression.',
    cost: { ap: 1, energy: 5, money: 600 }, maxPerWeek: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'momentum', delta: 3 }],
  },
  {
    id: 'permanence_citoyenne', label: 'Tenir une permanence citoyenne', category: 'terrain', minRank: 'militant',
    description: 'Trois heures à écouter les doléances : logement, voisinage, impôts. Épuisant, mais apprécié.',
    cost: { ap: 1, energy: 6 }, maxPerWeek: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 1 }, { kind: 'stat', stat: 'credibility', delta: 1 }, { kind: 'stat', stat: 'stress', delta: 2 }],
  },
  {
    id: 'bus_tour', label: 'Tournée nationale en bus', category: 'terrain', minRank: 'depute',
    description: 'Douze villes en six jours, un bus floqué à votre nom. Cher et épuisant, mais tout le pays vous voit.',
    cost: { ap: 3, energy: 25, money: 12000 }, cooldownWeeks: 6,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 6 }, { kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'momentum', delta: 10 }, { kind: 'stat', stat: 'stress', delta: 8 }, { kind: 'faction', factionId: 'ligne_dure', delta: -2 }],
  },
  {
    id: 'live', label: 'Répondre en direct sur les réseaux', category: 'medias', minRank: 'militant',
    description: 'Une heure de questions-réponses en direct. Spontané… donc risqué.',
    cost: { ap: 1, energy: 4 }, maxPerWeek: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'influence', delta: 1 }],
    risk: {
      baseChance: 0.22, scaleWith: 'credibility', scaleWeight: 0.5,
      onFailure: [{ kind: 'stat', stat: 'popularity', delta: -2 }, { kind: 'exposure', delta: 4 }],
      failureNews: 'Une réponse maladroite en direct tourne en boucle.',
    },
  },
  {
    id: 'podcast', label: 'Enregistrer un podcast', category: 'medias', minRank: 'militant', target: 'domain',
    description: 'Quarante minutes de fond avec un expert. Peu d’audience, beaucoup de sérieux.',
    cost: { ap: 1, energy: 6, money: 400 },
    effects: [{ kind: 'dossier', domain: '$domain', delta: 3 }, { kind: 'stat', stat: 'credibility', delta: 1 }, { kind: 'stat', stat: 'influence', delta: 1 }],
  },
  {
    id: 'sondage', label: 'Commander un sondage', category: 'medias', minRank: 'conseiller_municipal',
    description: 'Un institut teste votre nom. Publié au bon moment, il crée une dynamique.',
    cost: { ap: 1, money: 5000 }, cooldownWeeks: 4,
    effects: [{ kind: 'momentum', delta: 6 }, { kind: 'stat', stat: 'influence', delta: 1 }],
    risk: {
      baseChance: 0.2,
      onFailure: [{ kind: 'stat', stat: 'credibility', delta: -3 }],
      failureNews: 'Les méthodes de l’institut sont contestées : on parle de sondage de complaisance.',
    },
  },
  {
    id: 'clip', label: 'Tourner un clip de campagne', category: 'medias', minRank: 'depute',
    description: 'Drone, musique originale, plans au lever du soleil. Peut devenir culte… ou ridicule.',
    cost: { ap: 2, energy: 8, money: 8000 }, cooldownWeeks: 5,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 4 }, { kind: 'momentum', delta: 5 }, { kind: 'stat', stat: 'credibility', delta: -1 }],
    risk: {
      baseChance: 0.2,
      onFailure: [{ kind: 'stat', stat: 'popularity', delta: -3 }],
      failureNews: 'Le clip est moqué : vos plans au ralenti deviennent un mème.',
    },
  },
  {
    id: 'visite', label: 'Visite de terrain thématique', category: 'dossiers', minRank: 'militant', target: 'domain',
    description: 'Une usine, un hôpital, une école ou un commissariat selon le dossier : du concret.',
    cost: { ap: 1, energy: 8 },
    effects: [{ kind: 'dossier', domain: '$domain', delta: 4 }, { kind: 'stat', stat: 'popularity', delta: 1 }],
  },
  {
    id: 'think_tank', label: 'Commander une note à un think tank', category: 'dossiers', minRank: 'conseiller_municipal', target: 'domain',
    description: 'Trente pages de propositions chiffrées. Le parti peut la financer.',
    cost: { ap: 1, money: 3500 },
    effects: [{ kind: 'dossier', domain: '$domain', delta: 8 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
  },
  {
    id: 'question_gouv', label: 'Poser une question au gouvernement', category: 'dossiers', minRank: 'depute', target: 'domain',
    description: 'Deux minutes en direct à l’Assemblée pour interpeller un ministre.',
    cost: { ap: 1, energy: 4 }, maxPerWeek: 1,
    effects: [{ kind: 'dossier', domain: '$domain', delta: 2 }, { kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
    risk: {
      baseChance: 0.45, scaleWith: 'dossier', scaleWeight: 0.9,
      onFailure: [{ kind: 'stat', stat: 'credibility', delta: -3 }],
      failureNews: 'Le ministre vous corrige sur un chiffre. Rires sur les bancs d’en face.',
    },
  },
  // ── Parti et réseau ──
  {
    id: 'fete_section', label: 'Fête de la section', category: 'parti', minRank: 'conseiller_municipal',
    description: 'Merguez, fanfare et discours. Les militants adorent… et le parti peut payer.',
    cost: { ap: 2, energy: 8, money: 2500 }, cooldownWeeks: 4,
    effects: [{ kind: 'faction', factionId: '*', delta: 4 }, { kind: 'cohesion', delta: 3 }, { kind: 'stat', stat: 'popularity', delta: 1 }],
  },
  {
    id: 'motion', label: 'Déposer une motion de congrès', category: 'parti', minRank: 'conseiller_municipal', target: 'faction',
    description: 'Un texte d’orientation signé avec un courant. Les autres grincent.',
    cost: { ap: 2, politicalCapital: 15 }, cooldownWeeks: 6,
    effects: [{ kind: 'faction', factionId: '$target', delta: 8 }, { kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'cohesion', delta: -2 }],
  },
  {
    id: 'universite_ete', label: 'Organiser une université d’été', category: 'parti', minRank: 'depute',
    description: 'Trois jours d’ateliers et de discours au bord de la mer. Très cher, très fédérateur.',
    cost: { ap: 3, energy: 15, money: 15000 }, cooldownWeeks: 26,
    effects: [{ kind: 'faction', factionId: '*', delta: 8 }, { kind: 'cohesion', delta: 6 }, { kind: 'stat', stat: 'influence', delta: 3 }, { kind: 'momentum', delta: 5 }, { kind: 'stat', stat: 'stress', delta: 6 }],
  },
  {
    id: 'gala', label: 'Gala de levée de fonds', category: 'reseau', minRank: 'depute',
    description: 'Une salle prestigieuse, des donateurs fortunés. L’investissement rapporte au compte de campagne.',
    cost: { ap: 2, energy: 10, money: 5000 }, cooldownWeeks: 4,
    effects: [{ kind: 'funds', account: 'campaign', delta: 15000 }, { kind: 'stat', stat: 'influence', delta: 1 }, { kind: 'exposure', delta: 5 }, { kind: 'stat', stat: 'popularity', delta: -1 }],
  },
  {
    id: 'diner_maison', label: 'Recevoir à dîner chez vous', category: 'reseau', minRank: 'militant', target: 'npc',
    requires: { asset: ['studio', 'maison', 'villa'] }, personalOnly: true,
    description: 'Une table soignée, loin des regards. Rien ne vaut l’intimité d’un dîner privé.',
    cost: { ap: 1, money: 300 },
    effects: [{ kind: 'npcRelation', npcId: '$target', delta: 14 }, { kind: 'stat', stat: 'influence', delta: 1 }, { kind: 'stat', stat: 'stress', delta: -2 }],
  },
  {
    id: 'vernissage', label: 'Vernissage privé', category: 'reseau', minRank: 'militant', target: 'contact',
    requires: { asset: ['art'] }, personalOnly: true,
    description: 'Votre galeriste organise une soirée : l’occasion de briller auprès d’un contact.',
    cost: { ap: 1, money: 800 },
    effects: [{ kind: 'contact', contactId: '$target', trust: 10 }, { kind: 'stat', stat: 'influence', delta: 2 }],
  },
  // ── Argent ──
  {
    id: 'cours', label: 'Donner des cours en école', category: 'argent', minRank: 'conseiller_municipal',
    description: 'Légal. Un séminaire dans une grande école : un peu d’argent et du prestige.',
    cost: { ap: 1, energy: 6 }, cooldownWeeks: 2,
    effects: [{ kind: 'income', base: 1000, scale: 'credibility', mult: 15 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
  },
  {
    id: 'louer_villa', label: 'Louer votre villa pour l’été', category: 'argent', minRank: 'militant',
    requires: { asset: ['villa'] },
    description: 'Légal. Des touristes fortunés paient très cher… et les voisins parlent.',
    cost: { ap: 1 }, cooldownWeeks: 12,
    effects: [{ kind: 'income', base: 18000 }, { kind: 'exposure', delta: 8 }, { kind: 'stat', stat: 'popularity', delta: -2 }],
  },
  {
    id: 'note_frais', label: 'Passer des frais perso en note de frais du parti', category: 'argent', minRank: 'conseiller_municipal',
    description: 'Illégal. Restaurants, taxis, vacances : le parti rembourse sans trop regarder… pour l’instant.',
    cost: { ap: 1 }, cooldownWeeks: 3,
    effects: [{ kind: 'income', base: 2500 }, { kind: 'exposure', delta: 8 }, { kind: 'flagAdd', key: 'illegal', delta: 1 }],
    risk: {
      baseChance: 0.2,
      onFailure: [{ kind: 'exposure', delta: 18 }, { kind: 'faction', factionId: '*', delta: -6 }, { kind: 'cohesion', delta: -4 }],
      failureNews: 'Le trésorier du parti tombe sur vos notes de frais. Le bureau national est saisi.',
    },
  },

  // ── Repos ────────────────────────────────────────────────
  {
    id: 'repos', label: 'Souffler', category: 'repos', minRank: 'militant',
    description: 'Une soirée sans téléphone.',
    cost: { ap: 1 },
    effects: [{ kind: 'stat', stat: 'energy', delta: 18 }, { kind: 'stat', stat: 'stress', delta: -10 }, { kind: 'momentum', delta: -1 }],
  },
  {
    id: 'week_end', label: 'Week-end en famille', category: 'repos', minRank: 'militant',
    description: 'Disparaître 48 h. On vous le reprochera un peu.',
    cost: { ap: 2 }, maxPerWeek: 1,
    effects: [{ kind: 'stat', stat: 'energy', delta: 35 }, { kind: 'stat', stat: 'stress', delta: -25 }, { kind: 'stat', stat: 'popularity', delta: -1 }, { kind: 'stat', stat: 'influence', delta: -1 }, { kind: 'momentum', delta: -3 }],
  },
  {
    id: 'footing', label: 'Footing matinal', category: 'repos', minRank: 'militant',
    description: 'Quarante minutes au bord du canal avant la première réunion.',
    cost: { ap: 1 }, maxPerWeek: 1,
    effects: [{ kind: 'stat', stat: 'energy', delta: 10 }, { kind: 'stat', stat: 'stress', delta: -7 }],
  },
  {
    id: 'sejour_campagne', label: 'Séjour dans votre maison', category: 'repos', minRank: 'militant',
    requires: { asset: ['maison', 'villa'] },
    description: 'Volets ouverts, téléphone éteint. Votre résidence secondaire vous ressource vraiment.',
    cost: { ap: 2 }, maxPerWeek: 1,
    effects: [{ kind: 'stat', stat: 'energy', delta: 40 }, { kind: 'stat', stat: 'stress', delta: -25 }, { kind: 'stat', stat: 'influence', delta: -1 }, { kind: 'momentum', delta: -3 }],
  },
  {
    id: 'vacances', label: 'Partir une semaine en vacances', category: 'repos', minRank: 'militant',
    description: 'Une vraie coupure, loin de tout. Vos adversaires, eux, ne partent pas.',
    cost: { ap: 3, money: 1500 }, maxPerWeek: 1,
    effects: [{ kind: 'stat', stat: 'energy', delta: 60 }, { kind: 'stat', stat: 'stress', delta: -45 }, { kind: 'stat', stat: 'popularity', delta: -2 }, { kind: 'stat', stat: 'influence', delta: -3 }, { kind: 'momentum', delta: -6 }, { kind: 'faction', factionId: '*', delta: -1 }],
  },
];

/* ── Contrepoids automatiques ────────────────────────────────
 * Toute action qui rapporte gros coûte aussi quelque chose, selon sa nature :
 * le terrain et les dossiers épuisent (stress), les médias et le réseau exposent,
 * le parti s'agace (cohésion), le repos fait perdre du terrain (dynamique).
 * Le malus visible atteint au moins `RATIO` de la valeur des gains, en tenant
 * compte du risque d'échec déjà présent. */
const W: Record<string, number> = { popularity: 1, influence: 1, credibility: 1, politicalCapital: 0.3, energy: 0.15, stress: -0.6 };

export function effectValue(e: Effect): number {
  switch (e.kind) {
    case 'stat': return (W[e.stat] ?? 0) * e.delta;
    case 'momentum': return 0.35 * e.delta;
    case 'faction': return (e.factionId === '*' ? 0.7 : 0.4) * e.delta;
    case 'cohesion': return 0.4 * e.delta;
    case 'dossier': return 0.4 * e.delta;
    case 'exposure': return -0.5 * e.delta;
    case 'funds': return e.delta / 1000;
    case 'income': return e.base / 1000;
    case 'press': return 0.6 * ((e.audience ?? 0) + (e.reputation ?? 0)) + 0.3 * (e.independance ?? 0) + 3 * (e.scoops ?? 0);
    case 'npcRelation': return e.delta * 0.08;
    case 'contact': return (e.trust ?? 0) * 0.15;
    case 'flagAdd': return e.key === 'illegal' ? -3 * e.delta : 0;
    case 'partyTreasury': return e.delta * 0.1;
    case 'crown': return 0.5 * ((e.soutien ?? 0) + (e.legitimite ?? 0) + (e.armee ?? 0));
    case 'lodge': return 0.3 * ((e.fraternite ?? 0) + (e.discretion ?? 0) + (e.planches ?? 0) * 5);
    case 'mole': return 0.4 * ((e.intel ?? 0) + (e.cover ?? 0) + (e.sabotage ?? 0));
    default: return 0;
  }
}

/** Part minimale de la valeur des gains rendue en malus visibles */
const RATIO: Partial<Record<ActionCategory, number>> = {
  terrain: 0.7, medias: 0.75, dossiers: 0.7, parti: 0.75, reseau: 0.75, argent: 0.75, redaction: 0.7,
  couronne: 0.6, loge: 0.6, repos: 0.5,
};

/** Malus de contrepartie selon la catégorie : [effet, valeur d'un point, plafond] */
const COUNTER: Partial<Record<ActionCategory, [(n: number) => Effect, number, number]>> = {
  terrain: [n => ({ kind: 'stat', stat: 'stress', delta: n }), 0.6, 8],
  dossiers: [n => ({ kind: 'stat', stat: 'stress', delta: n }), 0.6, 8],
  redaction: [n => ({ kind: 'stat', stat: 'stress', delta: n }), 0.6, 8],
  medias: [n => ({ kind: 'exposure', delta: n }), 0.5, 8],
  reseau: [n => ({ kind: 'exposure', delta: n }), 0.5, 8],
  argent: [n => ({ kind: 'exposure', delta: n }), 0.5, 10],
  couronne: [n => ({ kind: 'exposure', delta: n }), 0.5, 8],
  loge: [n => ({ kind: 'lodge', discretion: -n }), 0.3, 12],
  parti: [n => ({ kind: 'faction', factionId: 'ligne_dure', delta: -n }), 0.4, 8],
  repos: [n => ({ kind: 'momentum', delta: -n }), 0.35, 8],
};

function sameSlot(a: Effect, b: Effect): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'stat' && b.kind === 'stat') return a.stat === b.stat;
  if (a.kind === 'faction' && b.kind === 'faction') return a.factionId === b.factionId;
  return a.kind === 'exposure' || a.kind === 'cohesion' || a.kind === 'momentum';
}

/** Ajoute un malus visible pour que les pertes atteignent `ratio` × la valeur des gains */
export function withCounterweight(
  effects: Effect[], ratio: number, rule: [(n: number) => Effect, number, number], risk?: ActionDefinition['risk'],
): Effect[] {
  const values = effects.map(effectValue);
  const gain = values.filter(v => v > 0).reduce((s, v) => s + v, 0);
  if (gain < 2) return effects;
  let loss = -values.filter(v => v < 0).reduce((s, v) => s + v, 0);
  if (risk) {
    const fail = -risk.onFailure.map(effectValue).filter(v => v < 0).reduce((s, v) => s + v, 0);
    loss += risk.baseChance * (fail + gain);
  }
  const deficit = gain * ratio - loss;
  if (deficit <= 0.2) return effects;
  const [make, unit, cap] = rule;
  const n = Math.min(cap, Math.max(1, Math.round(deficit / unit)));
  const extra = make(n);
  const out = [...effects];
  const i = out.findIndex(e => sameSlot(e, extra));
  if (i >= 0 && 'delta' in out[i] && 'delta' in extra) {
    out[i] = { ...out[i], delta: (out[i] as { delta: number }).delta + (extra as { delta: number }).delta } as Effect;
  } else if (i >= 0 && out[i].kind === 'lodge' && extra.kind === 'lodge') {
    const l = out[i] as Extract<Effect, { kind: 'lodge' }>;
    out[i] = { ...l, discretion: (l.discretion ?? 0) + (extra.discretion ?? 0) };
  } else {
    out.push(extra);
  }
  return out;
}

function counterweight(a: ActionDefinition): ActionDefinition {
  const ratio = RATIO[a.category];
  const rule = COUNTER[a.category];
  if (!ratio || !rule || a.effects.some(e => e.kind === 'scene' || e.kind === 'debate' || e.kind === 'protest')) return a;
  return { ...a, effects: withCounterweight(a.effects, ratio, rule, a.risk) };
}

export const ACTIONS: ActionDefinition[] = RAW_ACTIONS.map(counterweight);

export const ACTIONS_BY_ID = new Map(ACTIONS.map(a => [a.id, a]));

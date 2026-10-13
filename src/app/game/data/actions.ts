import { ActionCategory, ActionDefinition, Effect } from '../models/game.models';

/**
 * Catalogue des actions mensuelles.
 * risk.baseChance = probabilité d'échec avant modulation par la stat (ou la maîtrise du dossier).
 */
const RAW_ACTIONS: ActionDefinition[] = [
  // ── Terrain ───────────────────────────────────────────────
  {
    id: 'porte_a_porte', label: 'Porte-à-porte', category: 'terrain', minRank: 'militant',
    description: 'Arpenter les cages d’escalier. Lent, mais ça construit une base.',
    cost: { ap: 1, energy: 8 }, maxPerMonth: 2,
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
    id: 'meeting', minigame: 'discours', label: 'Organiser un meeting', category: 'terrain', minRank: 'conseiller_municipal',
    description: 'Salle, sono, militants en renfort. Un bon meeting fait les gros titres locaux.',
    cost: { ap: 2, energy: 15, money: 3000 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 4 }, { kind: 'momentum', delta: 9 }, { kind: 'stat', stat: 'stress', delta: 4 }],
    risk: {
      baseChance: 0.3, scaleWith: 'popularity', scaleWeight: 0.8,
      onFailure: [{ kind: 'stat', stat: 'popularity', delta: -2 }, { kind: 'stat', stat: 'stress', delta: 6 }],
      failureNews: 'Salle à moitié vide : les images tournent en boucle.',
    },
  },
  {
    id: 'manifestation', label: 'Mener une manifestation', category: 'terrain', minRank: 'militant',
    description: 'Choisir une cause, rallier des alliés, tenir le cortège jusqu’au discours. Se joue en fin de mois.',
    cost: { ap: 2, energy: 12 }, maxPerMonth: 1, cooldown: 4,
    effects: [{ kind: 'protest' }],
  },
  {
    id: 'marche', label: 'Tournée du marché du dimanche', category: 'terrain', minRank: 'militant',
    description: 'Quatre rencontres entre les étals : écouter, promettre, convaincre. Se joue en fin de mois.',
    cost: { ap: 1, energy: 6 }, maxPerMonth: 1, cooldown: 2,
    effects: [{ kind: 'scene', sceneId: 'marche' }],
  },
  {
    id: 'grand_meeting', label: 'Organiser un grand meeting', category: 'terrain', minRank: 'conseiller_municipal',
    description: 'La salle, la première partie, le discours, l’imprévu, le final. Se joue en fin de mois.',
    cost: { ap: 2, energy: 12 }, maxPerMonth: 1, cooldown: 3,
    effects: [{ kind: 'scene', sceneId: 'meeting' }],
  },
  {
    id: 'inauguration', minigame: 'selfies', label: 'Inaugurations & commémorations', category: 'terrain', minRank: 'conseiller_municipal',
    description: 'Couper des rubans, serrer des mains, être sur la photo.',
    cost: { ap: 1, energy: 5 },
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'influence', delta: 1 }, { kind: 'stat', stat: 'credibility', delta: -1 }],
  },

  // ── Médias ───────────────────────────────────────────────
  {
    id: 'post_reseaux', label: 'Campagne réseaux sociaux', category: 'medias', minRank: 'militant',
    description: 'Vidéo verticale, punchline, hashtag. Attention au bad buzz.',
    cost: { ap: 1, energy: 3 }, maxPerMonth: 2,
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
    id: 'plateau_tv', minigame: 'matinale', label: 'Accepter un plateau TV', category: 'medias', minRank: 'conseiller_municipal',
    description: 'Une interview en direct sur le sujet du moment. Préparez vos éléments de langage.',
    cost: { ap: 2, energy: 12 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'decision', templateId: 'interview' }],
  },
  {
    id: 'face_a_face', label: 'Face-à-face contradictoire', category: 'medias', minRank: 'militant',
    description: 'Un débat en direct contre un adversaire : réunion publique d’abord, plateaux télé ensuite. Se joue en fin de mois.',
    cost: { ap: 2, energy: 12 }, maxPerMonth: 1, cooldown: 2,
    effects: [{ kind: 'debate', stakes: 'face_a_face' }],
  },
  {
    id: 'hemicycle', label: 'Joute dans l’hémicycle', category: 'medias', minRank: 'depute',
    description: 'Questions au gouvernement : trois manches sous l’œil des caméras de l’Assemblée.',
    cost: { ap: 2, energy: 10 }, cooldown: 2,
    effects: [{ kind: 'debate', stakes: 'hemicycle' }],
  },
  {
    id: 'commission', label: 'Mener une commission d’enquête', category: 'dossiers', minRank: 'depute',
    description: 'Auditionner sous serment le PDG d’une grande entreprise. Se joue en fin de mois.',
    cost: { ap: 2, energy: 10 }, cooldown: 4,
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
    id: 'etudier', minigame: 'fiches', label: 'Étudier un dossier', category: 'dossiers', minRank: 'militant', target: 'domain',
    description: 'Notes, rapports, chiffres clés. Indispensable avant de débattre.',
    cost: { ap: 1, energy: 5 },
    effects: [{ kind: 'dossier', domain: '$domain', delta: 12 }],
  },
  {
    id: 'experts', label: 'Auditionner des experts', category: 'dossiers', minRank: 'conseiller_municipal', target: 'domain',
    description: 'Un think tank vous briefe pendant une journée entière.',
    cost: { ap: 1, energy: 4, money: 1500 }, maxPerMonth: 1,
    effects: [{ kind: 'dossier', domain: '$domain', delta: 20 }, { kind: 'stat', stat: 'credibility', delta: 1 }, { kind: 'stat', stat: 'stress', delta: 4 }],
  },
  {
    id: 'formation', minigame: 'fiches', label: 'Formation intensive', category: 'dossiers', minRank: 'militant',
    description: 'Un séminaire de deux jours. Gagne un point de compétence.',
    cost: { ap: 2, energy: 10 }, cooldown: 4,
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
    cost: { ap: 2, politicalCapital: 8, energy: 8 }, cooldown: 3,
    effects: [{ kind: 'debate', stakes: 'duel_interne', opponentId: '$target' }],
  },
  {
    id: 'alliance', label: 'Négocier une alliance électorale', category: 'parti', minRank: 'chef_parti',
    description: 'Programme commun, circonscriptions, tête de liste : bâtir une coalition sans perdre ses militants.',
    cost: { ap: 2, politicalCapital: 10 }, cooldown: 4,
    effects: [{ kind: 'scene', sceneId: 'alliance' }],
  },
  {
    id: 'placer_proche', label: 'Placer un proche', category: 'parti', minRank: 'depute',
    description: 'Une nomination à un poste clé : votre réseau se consolide, la presse veille.',
    cost: { ap: 1, politicalCapital: 10 }, cooldown: 3,
    effects: [
      { kind: 'stat', stat: 'influence', delta: 6 }, { kind: 'faction', factionId: '*', delta: -2 },
      { kind: 'exposure', delta: 7 },
    ],
  },
  {
    id: 'intrigue', label: 'Fragiliser un rival', category: 'parti', minRank: 'conseiller_municipal', target: 'npc',
    description: 'Une confidence off à un journaliste, un dossier qui ressort…',
    cost: { ap: 2, politicalCapital: 12, energy: 8 }, cooldown: 2,
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
    cost: { ap: 2, energy: 10 }, cooldown: 4,
    effects: [{ kind: 'scene', sceneId: 'mediation' }],
  },
  {
    id: 'donateurs', minigame: 'negociation_donateur', label: 'Dîner de donateurs', category: 'reseau', minRank: 'militant',
    description: 'Lever des fonds pour la campagne. Gare aux mélanges des genres.',
    cost: { ap: 1, energy: 7 }, maxPerMonth: 1,
    effects: [{ kind: 'funds', account: 'campaign', delta: 5000 }, { kind: 'exposure', delta: 3 }, { kind: 'stat', stat: 'stress', delta: 2 }],
  },

  // ── Argent ───────────────────────────────────────────────
  {
    id: 'chronique', label: 'Tenir une chronique dans un magazine', category: 'argent', minRank: 'militant',
    description: 'Légal. Un billet par mois, payé selon votre influence.',
    cost: { ap: 1, energy: 4 }, maxPerMonth: 1,
    effects: [{ kind: 'income', base: 600, scale: 'influence', mult: 25 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
  },
  {
    id: 'conference_payee', label: 'Donner une conférence rémunérée', category: 'argent', minRank: 'conseiller_municipal',
    description: 'Légal. Un cercle d’affaires vous invite à parler de votre vision. Plus vous êtes connu·e, mieux c’est payé.',
    cost: { ap: 1, energy: 6 }, cooldown: 2,
    effects: [{ kind: 'income', base: 1500, scale: 'popularity', mult: 80 }, { kind: 'stat', stat: 'influence', delta: 1 }],
  },
  {
    id: 'livre', label: 'Écrire un livre', category: 'argent', minRank: 'militant', target: 'domain',
    description: 'Légal. Un essai sur un dossier : droits d’auteur, crédibilité, et un dossier mieux maîtrisé.',
    cost: { ap: 2, energy: 12 }, cooldown: 4,
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
    cost: { ap: 1 }, cooldown: 3,
    effects: [{ kind: 'income', base: 4000, scale: 'influence', mult: 120 }, { kind: 'exposure', delta: 7 }],
  },
  {
    id: 'enveloppe', label: 'Accepter une enveloppe', category: 'argent', minRank: 'conseiller_municipal',
    description: 'Illégal. Un promoteur « remercie » votre bienveillance sur un permis de construire.',
    cost: { ap: 1 }, cooldown: 3,
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
    cost: { ap: 1 }, cooldown: 4,
    effects: [
      { kind: 'income', base: 9000 }, { kind: 'exposure', delta: 14 }, { kind: 'flagAdd', key: 'illegal', delta: 1 },
    ],
  },
  {
    id: 'marche_public', label: 'Arranger un marché public', category: 'argent', minRank: 'conseiller_municipal',
    description: 'Illégal. Faire gagner une entreprise amie, contre rétrocommission. Se joue en fin de mois.',
    cost: { ap: 2, energy: 6 }, cooldown: 4,
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
    cost: { ap: 1, energy: 8 }, maxPerMonth: 1,
    effects: [{ kind: 'press', audience: 5 }, { kind: 'stat', stat: 'popularity', delta: 1 }, { kind: 'stat', stat: 'stress', delta: 2 }],
  },
  {
    id: 'polemique', label: 'Lancer une polémique calculée', category: 'redaction', minRank: 'militant',
    description: 'Une formule outrancière, des millions de vues. Votre réputation en prend un coup.',
    cost: { ap: 1, energy: 4 }, cooldown: 2,
    effects: [{ kind: 'press', audience: 9, reputation: -5 }, { kind: 'exposure', delta: 3 }, { kind: 'stat', stat: 'popularity', delta: 1 }],
  },
  {
    id: 'enquete', label: 'Mener une enquête', category: 'redaction', minRank: 'militant',
    description: 'Des semaines de travail pour un scoop. Se joue en fin de mois.',
    cost: { ap: 2, energy: 12 }, cooldown: 2,
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
    description: 'Trois invités, un public, une heure de direct. Se joue en fin de mois.',
    cost: { ap: 2, energy: 12 }, cooldown: 2,
    effects: [{ kind: 'scene', sceneId: 'direct' }],
  },
  {
    id: 'interview_exclu', label: 'Décrocher une interview exclusive', category: 'redaction', minRank: 'militant',
    requires: { pressGrade: 1 },
    description: 'Le ministre qui ne parle à personne… sauf à vous ?',
    cost: { ap: 2, energy: 6 }, cooldown: 3,
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
    cost: { ap: 2, energy: 10 }, cooldown: 3,
    effects: [{ kind: 'press', audience: 4 }, { kind: 'debate', stakes: 'face_a_face', opponentId: '$target' }],
  },
  {
    id: 'clash_reseaux', label: 'Clasher un politique sur les réseaux', category: 'redaction', minRank: 'militant', target: 'npc',
    description: 'Un fil cinglant qui fait le tour d’internet.',
    cost: { ap: 1, energy: 3 }, cooldown: 2,
    effects: [
      { kind: 'press', audience: 5, reputation: -2 }, { kind: 'npcRelation', npcId: '$target', delta: -15 },
      { kind: 'npcStat', npcId: '$target', stat: 'popularity', delta: -3 },
    ],
  },
  {
    id: 'contrat', label: 'Renégocier votre contrat', category: 'redaction', minRank: 'militant',
    description: 'Votre audience vaut de l’or. À vous de le faire savoir.',
    cost: { ap: 1 }, cooldown: 4,
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
    cost: { ap: 2, energy: 15 }, cooldown: 5,
    effects: [{ kind: 'income', base: 6000, scale: 'popularity', mult: 150 }, { kind: 'press', reputation: 6, audience: 5, scoops: 1 }, { kind: 'stat', stat: 'stress', delta: 6 }, { kind: 'exposure', delta: 3 }],
  },

  // ── Encore d'autres actions ──────────────────────────────
  {
    id: 'benevolat', label: 'Journée de bénévolat', category: 'terrain', minRank: 'militant',
    description: 'Une journée à la banque alimentaire, sans caméra… ou presque.',
    cost: { ap: 1, energy: 8 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'stress', delta: -2 }, { kind: 'dossier', domain: 'social', delta: 1 }],
  },
  {
    id: 'concert_soutien', label: 'Organiser un concert de soutien', category: 'terrain', minRank: 'depute',
    description: 'Des artistes engagés, une grande salle, une billetterie au profit de la campagne.',
    cost: { ap: 2, energy: 10, money: 4000 }, cooldown: 4,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'momentum', delta: 4 }, { kind: 'funds', account: 'campaign', delta: 3000 }, { kind: 'stat', stat: 'stress', delta: 3 }, { kind: 'exposure', delta: 2 }],
  },
  {
    id: 'presse_regionale', minigame: 'matinale', label: 'Interview à la presse régionale', category: 'medias', minRank: 'militant',
    description: 'Moins prestigieux qu’un JT, mais lu par tous vos électeurs.',
    cost: { ap: 1, energy: 3 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 1 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
  },
  {
    id: 'demonter', label: 'Démonter les chiffres d’un rival', category: 'medias', minRank: 'conseiller_municipal', target: 'npc',
    description: 'Un fil documenté qui pointe ses erreurs. Il faut être sûr de soi.',
    cost: { ap: 1, energy: 5 }, cooldown: 2,
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
    cost: { ap: 2, energy: 10 }, cooldown: 4,
    effects: [{ kind: 'dossier', domain: '$domain', delta: 10 }, { kind: 'stat', stat: 'credibility', delta: 3 }, { kind: 'stat', stat: 'influence', delta: 1 }, { kind: 'stat', stat: 'stress', delta: 5 }],
  },
  {
    id: 'colloque', label: 'Organiser un colloque', category: 'dossiers', minRank: 'conseiller_municipal', target: 'domain',
    description: 'Une journée d’experts, de tables rondes et de petits fours.',
    cost: { ap: 1, energy: 6, money: 3000 }, cooldown: 4,
    effects: [{ kind: 'dossier', domain: '$domain', delta: 5 }, { kind: 'stat', stat: 'influence', delta: 2 }],
  },
  {
    id: 'adhesions', label: 'Campagne d’adhésion', category: 'parti', minRank: 'militant',
    description: 'Affiches, stands, parrainages : faire grossir les rangs.',
    cost: { ap: 1, energy: 5, money: 2000 }, cooldown: 3,
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
    cost: { ap: 1, energy: 6 }, maxPerMonth: 1,
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
    cost: { ap: 2, energy: 8 }, cooldown: 4,
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
    cost: { ap: 1, energy: 3 }, maxPerMonth: 1,
    effects: [{ kind: 'mole', deliver: true, cover: -4 }],
  },
  {
    id: 'zizanie', label: 'Semer la zizanie entre les courants', category: 'infiltration', minRank: 'militant',
    description: 'Une rumeur ici, un courriel transféré là. Les courants s’entre-déchirent.',
    cost: { ap: 1, energy: 5 }, cooldown: 2,
    effects: [{ kind: 'mole', sabotage: 8, cover: -6 }, { kind: 'faction', factionId: '*', delta: -2 }],
  },
  {
    id: 'fuite_presse', label: 'Organiser une fuite dans la presse', category: 'infiltration', minRank: 'militant',
    description: 'Un document interne explosif atterrit chez un journaliste. Le chef du parti vacille.',
    cost: { ap: 1, energy: 4 }, cooldown: 3,
    effects: [{ kind: 'mole', sabotage: 10, leaderPop: -6, cover: -9 }, { kind: 'exposure', delta: 3 }],
  },
  {
    id: 'desinformation', label: 'Jouer les agents doubles', category: 'infiltration', minRank: 'militant',
    description: 'Livrer à vos « camarades » de fausses informations sur votre vrai camp. Ils vous adorent ; votre officier beaucoup moins.',
    cost: { ap: 1, energy: 5 }, cooldown: 2,
    effects: [{ kind: 'mole', cover: 15, handler: -10 }, { kind: 'stat', stat: 'stress', delta: 4 }],
  },
  {
    id: 'retourner', label: 'Retourner un cadre du parti', category: 'infiltration', minRank: 'conseiller_municipal', target: 'npc',
    description: 'Un cadre aigri par la direction pourrait devenir votre source. Ou vous dénoncer.',
    cost: { ap: 2, energy: 6, politicalCapital: 10 }, cooldown: 4,
    effects: [{ kind: 'mole', intel: 10 }, { kind: 'npcRelation', npcId: '$target', delta: 10 }, { kind: 'stat', stat: 'stress', delta: 5 }],
    risk: {
      baseChance: 0.45, scaleWith: 'influence', scaleWeight: 0.6,
      onFailure: [{ kind: 'mole', cover: -22 }, { kind: 'npcRelation', npcId: '$target', delta: -30 }],
      failureNews: 'Le cadre fait semblant d’accepter… puis prévient la direction.',
    },
  },
  {
    id: 'reunion_secrete', label: 'Assister à une réunion secrète du bureau', category: 'infiltration', minRank: 'conseiller_municipal',
    description: 'Stratégie, listes, finances : tout se décide là. Se joue en fin de mois.',
    cost: { ap: 2, energy: 10 }, cooldown: 3,
    effects: [{ kind: 'scene', sceneId: 'bureau_secret' }],
  },
  {
    id: 'deballage', label: 'Le grand déballage', category: 'infiltration', minRank: 'militant',
    requires: { moleDelivered: 150 },
    description: 'Conférence de presse : vous révélez tout. Victoire ou désastre, il n’y aura pas de retour. Se joue en fin de mois.',
    cost: { ap: 3, energy: 15 },
    effects: [{ kind: 'scene', sceneId: 'deballage' }],
  },

  // ── Couronne : débloquée par le scénario ou un événement ───────────
  {
    id: 'tournee_prince', label: 'Organiser une tournée du prétendant', category: 'couronne', minRank: 'militant',
    description: 'Le prince parcourt une région : bains de foule, messe, rencontre des maires. Se joue en fin de mois.',
    cost: { ap: 2, energy: 10, money: 2000 }, cooldown: 2,
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
    cost: { ap: 1, money: 2500 }, maxPerMonth: 1,
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
    cost: { ap: 1, politicalCapital: 5 }, cooldown: 2,
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
    cost: { ap: 2, energy: 10 }, cooldown: 4,
    effects: [{ kind: 'crown', legitimite: 7, soutien: 2 }, { kind: 'stat', stat: 'credibility', delta: 3 }, { kind: 'dossier', domain: 'justice', delta: 8 }, { kind: 'stat', stat: 'popularity', delta: -2 }, { kind: 'stance', delta: 3 }],
  },
  {
    id: 'mariage', label: 'Célébrer le mariage princier', category: 'couronne', minRank: 'militant',
    description: 'Un mariage retransmis en direct : le moment de faire rêver le pays.',
    cost: { ap: 2, money: 15000 }, cooldown: 7,
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
    description: 'Un exposé devant vos frères et sœurs, suivi d’un débat. Indispensable pour monter en grade. Se joue en fin de mois.',
    cost: { ap: 2, energy: 8 }, cooldown: 2,
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
    cost: { ap: 1 }, cooldown: 2,
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
    cost: { ap: 1 }, cooldown: 4,
    effects: [{ kind: 'lodge', fraternite: 6, discretion: -3 }, { kind: 'stat', stat: 'influence', delta: 2 }],
  },
  {
    id: 'fraternelle', label: 'Animer une fraternelle parlementaire', category: 'loge', minRank: 'depute',
    requires: { grade: 2 },
    description: 'Réunir discrètement les élus maçons de tous les partis autour de grands textes.',
    cost: { ap: 1, politicalCapital: 5 }, cooldown: 3,
    effects: [{ kind: 'stat', stat: 'influence', delta: 5 }, { kind: 'faction', factionId: '*', delta: 2 }, { kind: 'lodge', discretion: -9, fraternite: 3 }, { kind: 'exposure', delta: 2 }],
  },
  {
    id: 'convent', label: 'Se présenter à la Grande Maîtrise', category: 'loge', minRank: 'militant',
    requires: { grade: 3 },
    description: 'Le convent élit le Grand Maître de l’obédience. Une campagne feutrée, mais redoutable.',
    cost: { ap: 3, energy: 12 }, cooldown: 4,
    effects: [{ kind: 'scene', sceneId: 'convent' }],
  },

  // ── Nouvelles actions : terrain, médias, dossiers ────────
  {
    id: 'tractage', minigame: 'tractage', label: 'Distribuer des tracts', category: 'terrain', minRank: 'militant',
    description: 'Imprimer et distribuer 5 000 tracts à la sortie du métro. Le parti peut payer l’impression.',
    cost: { ap: 1, energy: 5, money: 600 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'momentum', delta: 3 }],
  },
  {
    id: 'permanence_citoyenne', minigame: 'courrier', label: 'Tenir une permanence citoyenne', category: 'terrain', minRank: 'militant',
    description: 'Trois heures à écouter les doléances : logement, voisinage, impôts. Épuisant, mais apprécié.',
    cost: { ap: 1, energy: 6 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 1 }, { kind: 'stat', stat: 'credibility', delta: 1 }, { kind: 'stat', stat: 'stress', delta: 2 }],
  },
  {
    id: 'bus_tour', label: 'Tournée nationale en bus', category: 'terrain', minRank: 'depute',
    description: 'Douze villes en six jours, un bus floqué à votre nom. Cher et épuisant, mais tout le pays vous voit.',
    cost: { ap: 3, energy: 25, money: 12000 }, cooldown: 4,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 6 }, { kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'momentum', delta: 10 }, { kind: 'stat', stat: 'stress', delta: 8 }, { kind: 'faction', factionId: 'ligne_dure', delta: -2 }],
  },
  {
    id: 'live', minigame: 'moderation', label: 'Répondre en direct sur les réseaux', category: 'medias', minRank: 'militant',
    description: 'Une heure de questions-réponses en direct. Spontané… donc risqué.',
    cost: { ap: 1, energy: 4 }, maxPerMonth: 1,
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
    cost: { ap: 1, money: 5000 }, cooldown: 4,
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
    cost: { ap: 2, energy: 8, money: 8000 }, cooldown: 4,
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
    cost: { ap: 1, energy: 4 }, maxPerMonth: 1,
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
    cost: { ap: 2, energy: 8, money: 2500 }, cooldown: 4,
    effects: [{ kind: 'faction', factionId: '*', delta: 4 }, { kind: 'cohesion', delta: 3 }, { kind: 'stat', stat: 'popularity', delta: 1 }],
  },
  {
    id: 'motion', label: 'Déposer une motion de congrès', category: 'parti', minRank: 'conseiller_municipal', target: 'faction',
    description: 'Un texte d’orientation signé avec un courant. Les autres grincent.',
    cost: { ap: 2, politicalCapital: 15 }, cooldown: 4,
    effects: [{ kind: 'faction', factionId: '$target', delta: 8 }, { kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'cohesion', delta: -2 }],
  },
  {
    id: 'universite_ete', label: 'Organiser une université d’été', category: 'parti', minRank: 'depute',
    description: 'Trois jours d’ateliers et de discours au bord de la mer. Très cher, très fédérateur.',
    cost: { ap: 3, energy: 15, money: 15000 }, cooldown: 6,
    effects: [{ kind: 'faction', factionId: '*', delta: 8 }, { kind: 'cohesion', delta: 6 }, { kind: 'stat', stat: 'influence', delta: 3 }, { kind: 'momentum', delta: 5 }, { kind: 'stat', stat: 'stress', delta: 6 }],
  },
  {
    id: 'gala', minigame: 'negociation_donateur', label: 'Gala de levée de fonds', category: 'reseau', minRank: 'depute',
    description: 'Une salle prestigieuse, des donateurs fortunés. L’investissement rapporte au compte de campagne.',
    cost: { ap: 2, energy: 10, money: 5000 }, cooldown: 4,
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
    cost: { ap: 1, energy: 6 }, cooldown: 2,
    effects: [{ kind: 'income', base: 1000, scale: 'credibility', mult: 15 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
  },
  {
    id: 'louer_villa', label: 'Louer votre villa pour l’été', category: 'argent', minRank: 'militant',
    requires: { asset: ['villa'] },
    description: 'Légal. Des touristes fortunés paient très cher… et les voisins parlent.',
    cost: { ap: 1 }, cooldown: 4,
    effects: [{ kind: 'income', base: 18000 }, { kind: 'exposure', delta: 8 }, { kind: 'stat', stat: 'popularity', delta: -2 }],
  },
  {
    id: 'note_frais', label: 'Passer des frais perso en note de frais du parti', category: 'argent', minRank: 'conseiller_municipal',
    description: 'Illégal. Restaurants, taxis, vacances : le parti rembourse sans trop regarder… pour l’instant.',
    cost: { ap: 1 }, cooldown: 3,
    effects: [{ kind: 'income', base: 2500 }, { kind: 'exposure', delta: 8 }, { kind: 'flagAdd', key: 'illegal', delta: 1 }],
    risk: {
      baseChance: 0.2,
      onFailure: [{ kind: 'exposure', delta: 18 }, { kind: 'faction', factionId: '*', delta: -6 }, { kind: 'cohesion', delta: -4 }],
      failureNews: 'Le trésorier du parti tombe sur vos notes de frais. Le bureau national est saisi.',
    },
  },

  // ── Élysée (présidence de la République) ─────────────────
  {
    id: 'allocution', minigame: 'allocution', label: 'Allocution télévisée', category: 'elysee', minRank: 'president',
    description: 'Vingt heures, toutes les chaînes. Le pays vous écoute… ou zappe.',
    cost: { ap: 1, energy: 8 }, cooldown: 2,
    effects: [{ kind: 'presidency', approval: 4 }, { kind: 'stat', stat: 'popularity', delta: 2 }],
  },
  {
    id: 'conseil_ministres', label: 'Présider le Conseil des ministres', category: 'elysee', minRank: 'president', target: 'domain',
    description: 'Fixer le cap, recadrer les ministres, arbitrer sur un dossier.',
    cost: { ap: 1, energy: 5 }, maxPerMonth: 1,
    effects: [{ kind: 'presidency', majority: 3 }, { kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'dossier', domain: '$domain', delta: 3 }],
  },
  {
    id: 'reforme', label: 'Faire voter une réforme', category: 'elysee', minRank: 'president', target: 'domain',
    description: 'Un texte ambitieux soumis au Parlement. Sans majorité, il risque d’être rejeté.',
    cost: { ap: 2, energy: 12, politicalCapital: 20 }, cooldown: 4,
    effects: [{ kind: 'presidency', reform: true, approval: -3, majority: -3 }, { kind: 'dossier', domain: '$domain', delta: 6 }, { kind: 'stat', stat: 'credibility', delta: 3 }],
  },
  {
    id: 'article_49_3', label: 'Passer en force (49.3)', category: 'elysee', minRank: 'president',
    description: 'La réforme est adoptée sans vote. L’opposition hurle, la rue gronde.',
    cost: { ap: 1, politicalCapital: 30 }, cooldown: 4,
    effects: [{ kind: 'presidency', reform: true, force: true, approval: -7, majority: -8, threat: 5 }, { kind: 'stat', stat: 'credibility', delta: -2 }],
  },
  {
    id: 'dissolution', label: 'Dissoudre l’Assemblée nationale', category: 'elysee', minRank: 'president',
    description: 'Législatives anticipées : les Français choisiront votre majorité… ou une cohabitation.',
    cost: { ap: 2, politicalCapital: 25 }, cooldown: 12,
    effects: [{ kind: 'presidency', dissolve: true }, { kind: 'stat', stat: 'stress', delta: 10 }],
  },
  {
    id: 'referendum_national', label: 'Soumettre une question au référendum', category: 'elysee', minRank: 'president',
    description: 'Le peuple tranche. Un oui vous grandit, un non vous affaiblit durablement.',
    cost: { ap: 2, energy: 15, politicalCapital: 20 }, cooldown: 6,
    effects: [{ kind: 'presidency', approval: 8, reform: true, force: true }, { kind: 'stat', stat: 'influence', delta: 4 }],
    risk: { baseChance: 0.5, scaleWith: 'popularity', scaleWeight: 0.6, onFailure: [{ kind: 'presidency', approval: -12, majority: -6 }, { kind: 'stat', stat: 'credibility', delta: -6 }], failureNews: 'Le non l’emporte. On reparle de 1969.' },
  },
  {
    id: 'voyage_etat', label: 'Voyage d’État', category: 'elysee', minRank: 'president',
    description: 'Tapis rouge, contrats, conférence de presse commune.',
    cost: { ap: 2, energy: 15 }, maxPerMonth: 1,
    effects: [{ kind: 'dossier', domain: 'diplomatie', delta: 6 }, { kind: 'stat', stat: 'influence', delta: 5 }, { kind: 'presidency', approval: 2 }],
  },
  {
    id: 'conseil_defense', label: 'Réunir le Conseil de défense', category: 'elysee', minRank: 'president',
    description: 'Renseignement, armées, sécurité intérieure : point sur les menaces.',
    cost: { ap: 1, energy: 6 }, maxPerMonth: 1,
    effects: [{ kind: 'presidency', security: 8, threat: -6 }, { kind: 'dossier', domain: 'securite', delta: 4 }],
  },
  {
    id: 'protection_gspr', label: 'Renforcer votre protection rapprochée', category: 'elysee', minRank: 'president',
    description: 'Plus d’officiers du GSPR, des parcours secrets. Et une image de président·e barricadé·e.',
    cost: { ap: 1, politicalCapital: 5 }, cooldown: 4,
    effects: [{ kind: 'presidency', security: 18, approval: -1 }, { kind: 'stat', stat: 'popularity', delta: -1 }],
  },
  {
    id: 'bain_foule', minigame: 'bain_de_foule', label: 'Bain de foule', category: 'elysee', minRank: 'president',
    description: 'Serrer des mains, embrasser des enfants. Votre sécurité déteste ça.',
    cost: { ap: 1, energy: 10 }, maxPerMonth: 1,
    effects: [{ kind: 'presidency', approval: 5, threat: 4 }, { kind: 'stat', stat: 'popularity', delta: 3 }],
    risk: { baseChance: 0.12, onFailure: [{ kind: 'health', delta: -8 }, { kind: 'stat', stat: 'stress', delta: 12 }, { kind: 'presidency', approval: 2, security: 5 }], failureNews: 'Un homme vous gifle devant les caméras. Vous tombez mal.' },
  },
  {
    id: 'conference_presse', label: 'Grande conférence de presse', category: 'elysee', minRank: 'president',
    description: 'Deux heures face à trois cents journalistes. Aucune question n’est interdite.',
    cost: { ap: 1, energy: 8 }, cooldown: 4,
    effects: [{ kind: 'presidency', approval: 3 }, { kind: 'stat', stat: 'credibility', delta: 3 }],
    risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.6, onFailure: [{ kind: 'presidency', approval: -5 }, { kind: 'stat', stat: 'credibility', delta: -3 }], failureNews: 'Une réponse agacée tourne en boucle sur les chaînes d’info.' },
  },
  {
    id: 'remaniement_pm', label: 'Changer de Premier ministre', category: 'elysee', minRank: 'president',
    description: 'Un fusible saute, un nouveau gouvernement redonne de l’élan.',
    cost: { ap: 1, politicalCapital: 20 }, cooldown: 6,
    effects: [{ kind: 'presidency', pm: true, majority: 6, approval: 3 }],
  },
  {
    id: 'congres_versailles', minigame: 'discours', label: 'Discours devant le Congrès à Versailles', category: 'elysee', minRank: 'president',
    description: 'Députés et sénateurs réunis. Une adresse solennelle à la Nation.',
    cost: { ap: 2, energy: 10, politicalCapital: 15 }, cooldown: 12,
    effects: [{ kind: 'presidency', approval: 6, majority: 5 }, { kind: 'stat', stat: 'credibility', delta: 3 }],
  },
  {
    id: 'sommet_bilateral', label: 'Recevoir un chef d’État étranger', category: 'elysee', minRank: 'president',
    description: 'Dîner d’État, accords commerciaux, poignée de main sur le perron.',
    cost: { ap: 1, energy: 8 }, maxPerMonth: 1,
    effects: [{ kind: 'dossier', domain: 'economie', delta: 3 }, { kind: 'stat', stat: 'influence', delta: 3 }, { kind: 'presidency', approval: 1 }],
  },

  // ── Course à l'Élysée ───────────────────────────────────
  {
    id: 'chercher_parrainages', minigame: 'tournee_maires', label: 'Chercher des parrainages', category: 'parti', minRank: 'militant', requires: { declared: true },
    description: 'Appeler un à un les maires et conseillers. Il en faut cinq cents.',
    cost: { ap: 1, energy: 10 },
    effects: [{ kind: 'parrainages', delta: 45 }, { kind: 'stat', stat: 'stress', delta: 3 }],
  },
  {
    id: 'tournee_maires', minigame: 'tournee_maires', label: 'Tournée des maires ruraux', category: 'terrain', minRank: 'militant', requires: { declared: true },
    description: 'Trois départements, quarante mairies, une centaine de signatures.',
    cost: { ap: 2, energy: 18, money: 1500 }, maxPerMonth: 1,
    effects: [{ kind: 'parrainages', delta: 95 }, { kind: 'contact', contactId: 'ct-maires', trust: 4 }, { kind: 'stat', stat: 'stress', delta: 5 }],
  },

  // ── Ancien·ne président·e ───────────────────────────────
  {
    id: 'conferences_inter', label: 'Cycle de conférences à l’étranger', category: 'argent', minRank: 'militant', onlyRanks: ['ancien_president'],
    description: 'Une heure de souvenirs devant des banquiers, à prix d’or.',
    cost: { ap: 1, energy: 8 }, cooldown: 3,
    effects: [{ kind: 'income', base: 25000 }, { kind: 'stat', stat: 'credibility', delta: -2 }, { kind: 'exposure', delta: 3 }],
  },
  {
    id: 'memoires', label: 'Écrire ses mémoires', category: 'medias', minRank: 'militant', onlyRanks: ['ancien_president'],
    description: 'Six cents pages, quelques règlements de comptes, un gros à-valoir.',
    cost: { ap: 2, energy: 12 }, cooldown: 6,
    effects: [{ kind: 'income', base: 40000 }, { kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'exposure', delta: 4 }],
  },
  {
    id: 'fondation', label: 'Animer votre fondation', category: 'reseau', minRank: 'militant', onlyRanks: ['ancien_president'],
    description: 'Colloques, bourses, rapports : rester utile, et visible.',
    cost: { ap: 1, money: 3000 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'credibility', delta: 3 }, { kind: 'stat', stat: 'influence', delta: 2 }],
  },
  {
    id: 'adouber', label: 'Adouber un·e héritier·e', category: 'parti', minRank: 'militant', onlyRanks: ['ancien_president'],
    description: 'Votre soutien vaut de l’or dans une primaire. Le parti vous écoute encore.',
    cost: { ap: 1, energy: 5 }, cooldown: 4,
    effects: [{ kind: 'cohesion', delta: 4 }, { kind: 'faction', factionId: '*', delta: 3 }, { kind: 'stat', stat: 'influence', delta: 2 }],
  },

  // ── Santé ────────────────────────────────────────────────
  {
    id: 'bilan_sante', label: 'Bilan de santé complet', category: 'sante', minRank: 'militant',
    description: 'Prise de sang, électrocardiogramme, conseils avisés.',
    cost: { ap: 1, money: 250 }, cooldown: 4,
    effects: [{ kind: 'health', delta: 4 }, { kind: 'flagAdd', key: 'hygiene', delta: 2 }, { kind: 'stat', stat: 'stress', delta: -3 }],
  },
  {
    id: 'suivi_nutrition', label: 'Suivi nutritionnel', category: 'sante', minRank: 'militant',
    description: 'Fini les plateaux-repas et les buffets de vœux.',
    cost: { ap: 1, money: 400 }, cooldown: 4,
    effects: [{ kind: 'flagAdd', key: 'hygiene', delta: 3 }, { kind: 'health', delta: 2 }, { kind: 'stat', stat: 'energy', delta: -4 }],
  },
  {
    id: 'arret_tabac', label: 'Arrêter la cigarette', category: 'sante', minRank: 'militant',
    description: 'Trois semaines d’irritabilité pour des années de vie.',
    cost: { ap: 1 }, cooldown: 12,
    effects: [{ kind: 'flagAdd', key: 'hygiene', delta: 6 }, { kind: 'stat', stat: 'stress', delta: 10 }, { kind: 'stat', stat: 'energy', delta: -6 }],
  },
  {
    id: 'cure', label: 'Cure de repos', category: 'sante', minRank: 'militant',
    description: 'Dix jours loin de tout, sous surveillance médicale. On parlera de votre absence.',
    cost: { ap: 3, money: 2500 }, cooldown: 4,
    effects: [{ kind: 'health', delta: 8 }, { kind: 'flagAdd', key: 'hygiene', delta: 4 }, { kind: 'stat', stat: 'energy', delta: 40 }, { kind: 'stat', stat: 'stress', delta: -30 }, { kind: 'stat', stat: 'popularity', delta: -2 }, { kind: 'stat', stat: 'influence', delta: -3 }, { kind: 'momentum', delta: -4 }],
  },
  {
    id: 'specialiste', label: 'Consulter un grand spécialiste', category: 'sante', minRank: 'militant', requires: { maxHealth: 55 },
    description: 'Un professeur de médecine réputé, des examens poussés, un traitement de pointe.',
    cost: { ap: 2, money: 4000 }, cooldown: 4,
    effects: [{ kind: 'health', delta: 10 }, { kind: 'stat', stat: 'stress', delta: -4 }],
    risk: { baseChance: 0.15, onFailure: [{ kind: 'health', delta: 3 }, { kind: 'exposure', delta: 6 }, { kind: 'stat', stat: 'popularity', delta: -2 }], failureNews: 'Un paparazzi vous photographie à la sortie de l’hôpital.' },
  },
  {
    id: 'protection_policiere', label: 'Demander une protection policière', category: 'sante', minRank: 'depute',
    description: 'Des officiers du SDLP vous accompagnent. Moins de spontanéité, plus de sécurité.',
    cost: { ap: 1, politicalCapital: 6 }, cooldown: 4,
    effects: [{ kind: 'flagAdd', key: 'protection', delta: 45 }, { kind: 'stat', stat: 'popularity', delta: -1 }],
  },

  // ── Fonction : les tâches propres à chaque rang ─────────
  // Militant·e
  {
    id: 'stand_section', minigame: 'bain_de_foule', label: 'Tenir le stand de la section', category: 'fonction', minRank: 'militant', onlyRanks: ['militant'],
    description: 'Café tiède, tracts, et les habitués du samedi matin.',
    cost: { ap: 1, energy: 8 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'faction', factionId: 'moderes', delta: 2 }, { kind: 'cohesion', delta: 1 }],
  },
  {
    id: 'reunion_section', label: 'Animer la réunion de section', category: 'fonction', minRank: 'militant', onlyRanks: ['militant'],
    description: 'Ordre du jour, motions, et le débat qui déborde à 23 h.',
    cost: { ap: 1, energy: 6 }, maxPerMonth: 1,
    effects: [{ kind: 'faction', factionId: '*', delta: 2 }, { kind: 'stat', stat: 'influence', delta: 1 }],
  },
  {
    id: 'petition', label: 'Porter une pétition locale', category: 'fonction', minRank: 'militant', onlyRanks: ['militant'],
    description: 'Contre la fermeture du bureau de poste : 2 000 signatures à recueillir.',
    cost: { ap: 1, energy: 10 }, cooldown: 3,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'contact', contactId: 'ct-maires', trust: 2 }],
    risk: { baseChance: 0.25, onFailure: [{ kind: 'stat', stat: 'popularity', delta: -1 }, { kind: 'stat', stat: 'stress', delta: 3 }], failureNews: 'La pétition plafonne à 300 signatures.' },
  },
  // Conseiller·e municipal·e
  {
    id: 'conseil_municipal', label: 'Siéger au conseil municipal', category: 'fonction', minRank: 'conseiller_municipal', onlyRanks: ['conseiller_municipal'], target: 'domain',
    description: 'Délibérations, budget de la ville, joutes avec le maire.',
    cost: { ap: 1, energy: 6 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'credibility', delta: 2 }, { kind: 'dossier', domain: '$domain', delta: 4 }, { kind: 'dossier', domain: 'territoires', delta: 2 }],
  },
  {
    id: 'permanence_mairie', minigame: 'courrier', label: 'Tenir une permanence en mairie', category: 'fonction', minRank: 'conseiller_municipal', onlyRanks: ['conseiller_municipal'],
    description: 'Logement, voirie, voisins bruyants : le quotidien des habitants.',
    cost: { ap: 1, energy: 8 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }],
  },
  {
    id: 'projet_quartier', label: 'Porter un projet de quartier', category: 'fonction', minRank: 'conseiller_municipal', onlyRanks: ['conseiller_municipal'],
    description: 'Un jardin partagé, une aire de jeux : un chantier qui portera votre nom.',
    cost: { ap: 2, energy: 12, money: 500 }, cooldown: 4,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 4 }, { kind: 'stat', stat: 'credibility', delta: 2 }],
    risk: { baseChance: 0.3, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [{ kind: 'stat', stat: 'popularity', delta: -2 }, { kind: 'stat', stat: 'stress', delta: 5 }], failureNews: 'Le maire enterre votre projet en commission.' },
  },
  {
    id: 'celebrer_mariage', label: 'Célébrer un mariage', category: 'fonction', minRank: 'conseiller_municipal', onlyRanks: ['conseiller_municipal'],
    description: 'L’écharpe tricolore, le discours, les photos avec les mariés.',
    cost: { ap: 1, energy: 4 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'stress', delta: -3 }],
  },
  // Député·e
  {
    id: 'siege_commission', label: 'Siéger en commission', category: 'fonction', minRank: 'depute', onlyRanks: ['depute'], target: 'domain',
    description: 'Auditions, amendements, rapports : le vrai travail parlementaire.',
    cost: { ap: 1, energy: 8 }, maxPerMonth: 1,
    effects: [{ kind: 'dossier', domain: '$domain', delta: 6 }, { kind: 'stat', stat: 'credibility', delta: 2 }],
  },
  {
    id: 'amendement', minigame: 'pointage', label: 'Défendre un amendement en séance', category: 'fonction', minRank: 'depute', onlyRanks: ['depute'], target: 'domain',
    description: 'Deux minutes de temps de parole pour arracher un vote.',
    cost: { ap: 1, energy: 8 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'influence', delta: 3 }, { kind: 'stat', stat: 'credibility', delta: 3 }],
    risk: { baseChance: 0.55, scaleWith: 'dossier', scaleWeight: 0.8, onFailure: [{ kind: 'stat', stat: 'credibility', delta: -1 }, { kind: 'stat', stat: 'stress', delta: 4 }], failureNews: 'Amendement rejeté, rapporteur ironique.' },
  },
  {
    id: 'permanence_circo', minigame: 'courrier', label: 'Permanence en circonscription', category: 'fonction', minRank: 'depute', onlyRanks: ['depute'],
    description: 'Le vendredi, retour au pays : rendez-vous, marchés, fêtes de village.',
    cost: { ap: 1, energy: 8 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'contact', contactId: 'ct-maires', trust: 2 }],
  },
  {
    id: 'fronde', label: 'Voter contre votre groupe', category: 'fonction', minRank: 'depute', onlyRanks: ['depute'],
    description: 'Un vote de conscience. Le président de groupe ne l’oubliera pas.',
    cost: { ap: 1 }, cooldown: 4,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'stat', stat: 'credibility', delta: 2 }, { kind: 'faction', factionId: '*', delta: -5 }, { kind: 'cohesion', delta: -4 }],
  },
  // Ministre (et Premier·e ministre)
  {
    id: 'projet_loi', label: 'Défendre votre projet de loi à l’Assemblée', category: 'fonction', minRank: 'ministre', onlyRanks: ['ministre', 'premier_ministre'], target: 'domain',
    description: 'Le texte arrive en séance : débat face à l’opposition, sous les caméras de LCP.',
    cost: { ap: 2, energy: 12, politicalCapital: 15 }, cooldown: 4,
    effects: [{ kind: 'debate', stakes: 'hemicycle' }, { kind: 'dossier', domain: '$domain', delta: 6 }, { kind: 'stat', stat: 'credibility', delta: 2 }],
  },
  {
    id: 'qag', minigame: 'qag', label: 'Répondre aux questions au gouvernement', category: 'fonction', minRank: 'ministre', onlyRanks: ['ministre', 'premier_ministre'], target: 'domain',
    description: 'Mardi, 15 heures. Un député de l’opposition vous attend au tournant.',
    cost: { ap: 1, energy: 6 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'credibility', delta: 3 }, { kind: 'stat', stat: 'popularity', delta: 1 }],
    risk: { baseChance: 0.5, scaleWith: 'dossier', scaleWeight: 0.8, onFailure: [{ kind: 'stat', stat: 'credibility', delta: -3 }, { kind: 'stat', stat: 'popularity', delta: -1 }], failureNews: 'Vous bafouillez : l’hémicycle vous siffle.' },
  },
  {
    id: 'deplacement_ministeriel', label: 'Déplacement ministériel en région', category: 'fonction', minRank: 'ministre', onlyRanks: ['ministre', 'premier_ministre'],
    description: 'Préfet, élus locaux, visite d’usine et conférence de presse.',
    cost: { ap: 2, energy: 14 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'dossier', domain: 'territoires', delta: 2 }],
  },
  {
    id: 'arbitrage_budget', label: 'Arracher un arbitrage budgétaire', category: 'fonction', minRank: 'ministre', onlyRanks: ['ministre'],
    description: 'Bercy veut couper vos crédits. Vous montez à Matignon.',
    cost: { ap: 1, politicalCapital: 15 }, cooldown: 4,
    effects: [{ kind: 'stat', stat: 'influence', delta: 4 }, { kind: 'stat', stat: 'credibility', delta: 2 }],
    risk: { baseChance: 0.45, scaleWith: 'influence', scaleWeight: 0.6, onFailure: [{ kind: 'stat', stat: 'influence', delta: -3 }], failureNews: 'Matignon donne raison à Bercy.' },
  },
  {
    id: 'syndicats_secteur', minigame: 'negociation_syndicale', label: 'Recevoir les syndicats de votre secteur', category: 'fonction', minRank: 'ministre', onlyRanks: ['ministre', 'premier_ministre'],
    description: 'Trois heures de réunion, un relevé de conclusions.',
    cost: { ap: 1, energy: 6 }, maxPerMonth: 1,
    effects: [{ kind: 'contact', contactId: 'ct-ust', trust: 5 }, { kind: 'stat', stat: 'credibility', delta: 1 }, { kind: 'stat', stat: 'popularity', delta: 1 }],
  },
  // Premier·e ministre
  {
    id: 'politique_generale', label: 'Déclaration de politique générale', category: 'fonction', minRank: 'ministre', onlyRanks: ['premier_ministre'],
    description: 'Votre feuille de route devant les députés, suivie d’un vote de confiance.',
    cost: { ap: 2, energy: 15 }, cooldown: 12,
    effects: [{ kind: 'debate', stakes: 'hemicycle' }, { kind: 'government', majority: 8 }, { kind: 'stat', stat: 'credibility', delta: 3 }],
  },
  {
    id: 'remanier', label: 'Remanier le gouvernement', category: 'fonction', minRank: 'ministre', onlyRanks: ['premier_ministre'],
    description: 'Changer de casting pour relancer l’action… ou calmer une fronde.',
    cost: { ap: 1, politicalCapital: 15 }, cooldown: 6,
    effects: [{ kind: 'decision', templateId: 'former_gouvernement' }],
  },
  {
    id: 'seminaire_gouv', label: 'Séminaire gouvernemental', category: 'fonction', minRank: 'ministre', onlyRanks: ['premier_ministre'],
    description: 'Un week-end au vert avec tous les ministres. Sans téléphone.',
    cost: { ap: 1, energy: 8 }, cooldown: 4,
    effects: [{ kind: 'government', cohesion: 10 }, { kind: 'stat', stat: 'influence', delta: 1 }],
  },
  {
    id: 'pm_49_3', label: 'Engager la responsabilité du gouvernement (49.3)', category: 'fonction', minRank: 'ministre', onlyRanks: ['premier_ministre'], target: 'domain',
    description: 'Le texte passe sans vote. L’opposition dépose une motion de censure.',
    cost: { ap: 1, politicalCapital: 25 }, cooldown: 4,
    effects: [{ kind: 'dossier', domain: '$domain', delta: 8 }, { kind: 'stat', stat: 'influence', delta: 3 }, { kind: 'government', majority: -8, cohesion: 3 }, { kind: 'stat', stat: 'popularity', delta: -3 }],
  },
  {
    id: 'partenaires_sociaux', minigame: 'negociation_syndicale', label: 'Grande conférence sociale', category: 'fonction', minRank: 'ministre', onlyRanks: ['premier_ministre'],
    description: 'Syndicats et patronat autour de la table de Matignon.',
    cost: { ap: 2, energy: 12 }, cooldown: 4,
    effects: [{ kind: 'contact', contactId: 'ct-ust', trust: 6 }, { kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'government', majority: 3 }],
  },
  {
    id: 'arbitrer_ministres', label: 'Arbitrer entre deux ministres', category: 'fonction', minRank: 'ministre', onlyRanks: ['premier_ministre'],
    description: 'Ils se déchirent par voie de presse. Vous tranchez.',
    cost: { ap: 1, energy: 5 }, maxPerMonth: 1,
    effects: [{ kind: 'government', cohesion: 6 }, { kind: 'stat', stat: 'influence', delta: 1 }],
  },
  // Chef·fe de parti
  {
    id: 'investitures', minigame: 'negociation_alliance', label: 'Arbitrer les investitures', category: 'fonction', minRank: 'chef_parti', onlyRanks: ['chef_parti'],
    description: 'Qui sera candidat où ? Chaque choix fait un heureux et dix rancuniers.',
    cost: { ap: 2, energy: 10 }, cooldown: 4,
    effects: [{ kind: 'cohesion', delta: 5 }, { kind: 'faction', factionId: '*', delta: 2 }, { kind: 'stat', stat: 'influence', delta: 3 }],
    risk: { baseChance: 0.3, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [{ kind: 'cohesion', delta: -6 }, { kind: 'stat', stat: 'stress', delta: 6 }], failureNews: 'Trois sortants non réinvestis claquent la porte.' },
  },
  {
    id: 'bureau_national', label: 'Réunir le bureau national', category: 'fonction', minRank: 'chef_parti', onlyRanks: ['chef_parti'],
    description: 'Fixer la ligne, distribuer les rôles, éteindre les incendies.',
    cost: { ap: 1, energy: 6 }, maxPerMonth: 1,
    effects: [{ kind: 'cohesion', delta: 4 }, { kind: 'stat', stat: 'politicalCapital', delta: 5 }],
  },
  {
    id: 'conseil_national', label: 'Convoquer le conseil national du parti', category: 'fonction', minRank: 'chef_parti', onlyRanks: ['chef_parti'],
    description: 'Mille délégués, un grand discours, une motion d’orientation.',
    cost: { ap: 2, energy: 12, money: 2000 }, cooldown: 4,
    effects: [{ kind: 'faction', factionId: '*', delta: 3 }, { kind: 'momentum', delta: 4 }, { kind: 'stat', stat: 'popularity', delta: 1 }],
  },
  // Candidat·e à la présidence
  {
    id: 'zenith', minigame: 'discours', label: 'Grand meeting au Zénith', category: 'fonction', minRank: 'candidat_presidence', onlyRanks: ['candidat_presidence'],
    description: 'Huit mille personnes, des drapeaux, la musique de campagne.',
    cost: { ap: 3, energy: 25, money: 20000 }, cooldown: 3,
    effects: [{ kind: 'momentum', delta: 15 }, { kind: 'stat', stat: 'popularity', delta: 5 }],
  },
  {
    id: 'emission_prime', label: 'Émission politique en prime time', category: 'fonction', minRank: 'candidat_presidence', onlyRanks: ['candidat_presidence'],
    description: 'Deux heures en direct, face à des Français et un contradicteur.',
    cost: { ap: 2, energy: 15 }, cooldown: 4,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 5 }, { kind: 'momentum', delta: 8 }],
    risk: { baseChance: 0.4, scaleWith: 'credibility', scaleWeight: 0.6, onFailure: [{ kind: 'stat', stat: 'popularity', delta: -3 }, { kind: 'momentum', delta: -4 }], failureNews: 'Une hésitation sur le prix du pain : le moment tourne en boucle.' },
  },
  {
    id: 'equipe_campagne', label: 'Présenter votre équipe de campagne', category: 'fonction', minRank: 'candidat_presidence', onlyRanks: ['candidat_presidence'],
    description: 'Porte-parole, directeur de campagne, conseillers : le casting de votre quinquennat.',
    cost: { ap: 1, energy: 5 }, cooldown: 6,
    effects: [{ kind: 'stat', stat: 'credibility', delta: 3 }, { kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'cohesion', delta: 2 }],
  },
  {
    id: 'deplacement_campagne', label: 'Déplacement de campagne en région', category: 'fonction', minRank: 'candidat_presidence', onlyRanks: ['candidat_presidence'],
    description: 'Usine le matin, marché à midi, réunion publique le soir.',
    cost: { ap: 2, energy: 15, money: 3000 }, maxPerMonth: 1,
    effects: [{ kind: 'momentum', delta: 7 }, { kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'contact', contactId: 'ct-maires', trust: 2 }],
  },

  // ── Nouvelles actions (plusieurs se jouent en mini-jeu) ─
  {
    id: 'fete_village', minigame: 'fete_village', label: 'Faire la fête du village', category: 'terrain', minRank: 'militant',
    description: 'Buvette, lâcher de ballons, concours de belote : on vous voit, on trinque, on se souvient de vous.',
    cost: { ap: 1, energy: 10 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'contact', contactId: 'ct-maires', trust: 2 }, { kind: 'stat', stat: 'stress', delta: -2 }],
  },
  {
    id: 'debat_lycee', minigame: 'eloquence', label: 'Débattre devant des lycéens', category: 'terrain', minRank: 'militant',
    description: 'Trois cents élèves, un professeur d’histoire-géo et des questions sans filtre.',
    cost: { ap: 1, energy: 8 }, cooldown: 2,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'credibility', delta: 2 }, { kind: 'dossier', domain: 'education', delta: 3 }],
  },
  {
    id: 'nuit_blanche', minigame: 'fiches', label: 'Nuit blanche sur un dossier', category: 'dossiers', minRank: 'militant', target: 'domain',
    description: 'Café, fiches bristol et rapports de la Cour des comptes jusqu’à l’aube.',
    cost: { ap: 1, energy: 18 }, cooldown: 2,
    effects: [{ kind: 'dossier', domain: '$domain', delta: 9 }, { kind: 'stat', stat: 'stress', delta: 4 }],
  },
  {
    id: 'matinale_radio', minigame: 'matinale', label: 'Invité·e de la matinale', category: 'medias', minRank: 'conseiller_municipal',
    description: '7 h 50, studio 104 : huit minutes face à l’intervieweur le plus redouté de France.',
    cost: { ap: 1, energy: 10 }, cooldown: 2,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
  },
  {
    id: 'dedicace', minigame: 'dedicace', label: 'Séance de dédicace en librairie', category: 'medias', minRank: 'conseiller_municipal',
    description: 'Une file d’attente, un stylo, des mots gentils… et un paparazzi en embuscade.',
    cost: { ap: 1, energy: 8 }, cooldown: 3,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'income', base: 800 }],
  },
  {
    id: 'pointage_groupe', minigame: 'pointage', label: 'Faire le pointage pour le groupe', category: 'fonction', minRank: 'depute', onlyRanks: ['depute'],
    description: 'Couloirs, buvette, salle des Quatre-Colonnes : vous comptez les voix une à une pour le président de groupe.',
    cost: { ap: 1, energy: 8 }, cooldown: 2,
    effects: [{ kind: 'faction', factionId: '*', delta: 2 }, { kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'stat', stat: 'politicalCapital', delta: 5 }],
  },
  {
    id: 'sortie_greve', minigame: 'negociation_syndicale', label: 'Négocier la sortie d’une grève', category: 'fonction', minRank: 'ministre', onlyRanks: ['ministre', 'premier_ministre'],
    description: 'Une nuit au ministère avec les syndicats : trouver le chiffre qui met fin au conflit sans ruiner le budget.',
    cost: { ap: 2, energy: 15, politicalCapital: 10 }, cooldown: 3,
    effects: [{ kind: 'stat', stat: 'credibility', delta: 4 }, { kind: 'contact', contactId: 'ct-ust', trust: 6 }, { kind: 'stat', stat: 'popularity', delta: 2 }],
  },
  {
    id: 'visite_hopital', label: 'Passer une nuit aux urgences', category: 'terrain', minRank: 'conseiller_municipal',
    description: 'En blouse, sans caméras : aides-soignants, brancards dans les couloirs, et ce qu’on ne dit pas dans les rapports.',
    cost: { ap: 1, energy: 14 }, cooldown: 3,
    effects: [{ kind: 'dossier', domain: 'sante', delta: 6 }, { kind: 'stat', stat: 'credibility', delta: 2 }, { kind: 'stat', stat: 'stress', delta: 3 }],
  },
  {
    id: 'collecte_en_ligne', label: 'Lancer une cagnotte en ligne', category: 'argent', minRank: 'militant',
    description: 'Une vidéo, un lien, des petits dons : 5 €, 10 €, parfois 100 €.',
    cost: { ap: 1, energy: 4 }, cooldown: 2,
    effects: [{ kind: 'funds', account: 'campaign', delta: 3000 }, { kind: 'stat', stat: 'popularity', delta: 1 }],
  },
  {
    id: 'semi_marathon', label: 'Courir un semi-marathon solidaire', category: 'sante', minRank: 'militant', requires: { maxHealth: 92 },
    description: 'Vingt et un kilomètres pour une association, un dossard, et des photos en sueur.',
    cost: { ap: 1, energy: 20 }, cooldown: 4,
    effects: [{ kind: 'health', delta: 3 }, { kind: 'flagAdd', key: 'hygiene', delta: 2 }, { kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'stress', delta: -4 }],
  },
  {
    id: 'voeux_presse', minigame: 'allocution', label: 'Présenter ses vœux à la presse', category: 'medias', minRank: 'depute',
    description: 'Galette, petits fours et un discours qui doit donner le ton de l’année.',
    cost: { ap: 1, energy: 6 }, cooldown: 12,
    effects: [{ kind: 'stat', stat: 'influence', delta: 3 }, { kind: 'stat', stat: 'popularity', delta: 2 }],
  },

  // ── Premier contact ─────────────────────────────────────
  {
    id: 'al_glyphes', minigame: 'glyphes', label: 'Décoder les glyphes du message', category: 'contact', minRank: 'militant',
    description: 'Une nuit avec les cryptologues de la DGSE et les linguistes du CNRS, devant des écrans couverts de symboles.',
    cost: { ap: 2, energy: 12 }, maxPerMonth: 1,
    effects: [{ kind: 'alien', comprehension: 8 }, { kind: 'stat', stat: 'stress', delta: 2 }],
  },
  {
    id: 'al_nancay', label: 'Une nuit au radiotélescope de Nançay', category: 'contact', minRank: 'militant',
    description: 'Les antennes géantes de Sologne tournées vers Proxima. On écoute, on enregistre, on compare.',
    cost: { ap: 1, energy: 10 }, cooldown: 2,
    effects: [{ kind: 'alien', comprehension: 4 }, { kind: 'stat', stat: 'credibility', delta: 1 }, { kind: 'dossier', domain: 'numerique', delta: 2 }],
  },
  {
    id: 'al_linguistes', label: 'Réunir linguistes et mathématiciens', category: 'contact', minRank: 'militant',
    description: 'Un séminaire fermé à Saclay : grammaire, nombres, musique. Les meilleurs esprits du pays, payés sur vos crédits.',
    cost: { ap: 2, energy: 8, money: 3000 }, cooldown: 2,
    effects: [{ kind: 'alien', comprehension: 7 }, { kind: 'dossier', domain: 'education', delta: 2 }],
  },
  {
    id: 'al_repondre', minigame: 'message_etoiles', label: 'Composer la réponse de l’humanité', category: 'contact', minRank: 'militant', requires: { alienPhase: 0 },
    description: 'Que dire à une civilisation inconnue ? Chaque mot sera disséqué, sur Terre comme là-haut.',
    cost: { ap: 2, energy: 10, politicalCapital: 5 }, cooldown: 2,
    effects: [{ kind: 'alien', confiance: 8, comprehension: 1 }, { kind: 'stat', stat: 'influence', delta: 1 }],
  },
  {
    id: 'al_cellule', label: 'Réunir la cellule de crise', category: 'contact', minRank: 'militant',
    description: 'Intérieur, Armées, Santé, Affaires étrangères autour d’une même table, sous le sceau du secret.',
    cost: { ap: 1, energy: 8 }, maxPerMonth: 1,
    effects: [{ kind: 'alien', panique: -5, rivalite: -2 }, { kind: 'stat', stat: 'stress', delta: 3 }],
  },
  {
    id: 'al_allocution', minigame: 'discours_etoiles', label: 'Rassurer la Nation', category: 'contact', minRank: 'militant', requires: { alienPhase: 1 },
    description: 'Une allocution à 20 heures pour dire ce qu’on sait, ce qu’on ignore, et pourquoi il ne faut pas avoir peur.',
    cost: { ap: 1, energy: 8 }, cooldown: 2,
    effects: [{ kind: 'alien', panique: -10 }, { kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
  },
  {
    id: 'al_onu', label: 'Plaider à l’ONU pour un contact partagé', category: 'contact', minRank: 'militant', requires: { alienPhase: 1 },
    description: 'New York, l’Assemblée générale : proposer que le premier contact appartienne à toute l’humanité — sous coordination française.',
    cost: { ap: 2, energy: 14, politicalCapital: 10 }, cooldown: 3,
    effects: [{ kind: 'alien', rivalite: -12, confiance: 2 }, { kind: 'intl', prestige: 4 }, { kind: 'stat', stat: 'influence', delta: 2 }],
    risk: { baseChance: 0.3, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [{ kind: 'alien', rivalite: 6 }, { kind: 'intl', prestige: -3 }], failureNews: 'Veto au Conseil de sécurité : chacun veut son propre canal.' },
  },
  {
    id: 'al_secret', label: 'Classer une découverte secret-défense', category: 'contact', minRank: 'militant',
    description: 'Garder pour soi ce qui pourrait affoler le pays. Tant que ça ne fuite pas.',
    cost: { ap: 1, energy: 4 }, cooldown: 2,
    effects: [{ kind: 'alien', panique: -6 }, { kind: 'exposure', delta: 3 }],
    risk: { baseChance: 0.3, onFailure: [{ kind: 'alien', panique: 14, confiance: -2 }, { kind: 'stat', stat: 'credibility', delta: -5 }], failureNews: 'Fuite dans la presse : « Ce que le gouvernement vous cache sur Proxima ».' },
  },
  {
    id: 'al_cadeau', label: 'Envoyer un présent culturel', category: 'contact', minRank: 'militant', requires: { alienPhase: 1 },
    description: 'Debussy, Rimbaud, la recette du pain, les fresques de Lascaux : ce que la France a de plus beau, codé en binaire.',
    cost: { ap: 1, energy: 6 }, cooldown: 3,
    effects: [{ kind: 'alien', confiance: 6 }, { kind: 'stat', stat: 'popularity', delta: 1 }],
  },
  {
    id: 'al_alerte', label: 'Placer les armées en alerte', category: 'contact', minRank: 'militant', requires: { alienPhase: 1 },
    description: 'Rafale en patrouille, batteries antiaériennes, sous-marins en plongée. Rassurant pour certains, inquiétant pour d’autres.',
    cost: { ap: 1, energy: 6, politicalCapital: 5 }, cooldown: 3,
    effects: [{ kind: 'alien', rivalite: -4, confiance: -7, panique: 4 }, { kind: 'stat', stat: 'influence', delta: 2 }],
  },
  {
    id: 'al_echange', label: 'Échange scientifique avec le vaisseau', category: 'contact', minRank: 'militant', requires: { alienPhase: 2 },
    description: 'Mathématiques, chimie, astronomie : on se montre ce qu’on sait, par écrans interposés.',
    cost: { ap: 2, energy: 12 }, cooldown: 2,
    effects: [{ kind: 'alien', comprehension: 6, confiance: 4 }, { kind: 'dossier', domain: 'numerique', delta: 3 }],
    risk: { baseChance: 0.2, onFailure: [{ kind: 'alien', confiance: -6, panique: 4 }], failureNews: 'Un malentendu : les Vélari coupent la liaison pendant trois jours.' },
  },
  {
    id: 'al_bord', label: 'Monter à bord du vaisseau', category: 'contact', minRank: 'militant', requires: { alienPhase: 3 },
    description: 'Une navette, un scaphandre, des caméras du monde entier. Vous serez le premier être humain à franchir le seuil.',
    cost: { ap: 3, energy: 20 }, cooldown: 4,
    effects: [{ kind: 'alien', comprehension: 10, confiance: 10, panique: -4 }, { kind: 'stat', stat: 'popularity', delta: 6 }, { kind: 'stat', stat: 'influence', delta: 5 }],
    risk: { baseChance: 0.18, onFailure: [{ kind: 'health', delta: -12 }, { kind: 'alien', panique: 10 }, { kind: 'stat', stat: 'stress', delta: 15 }], failureNews: 'Malaise à bord : l’air vélari ne vous réussit pas. Rapatriement d’urgence.' },
  },
  {
    id: 'al_traite', minigame: 'traite_velari', label: 'Négocier le traité de coexistence', category: 'contact', minRank: 'militant', requires: { alienPhase: 3 },
    description: 'Une base, des règles, des garanties : le premier traité entre deux espèces. Chaque kilomètre carré compte.',
    cost: { ap: 2, energy: 15, politicalCapital: 15 }, cooldown: 3,
    effects: [{ kind: 'alien', confiance: 9, rivalite: -5 }, { kind: 'stat', stat: 'credibility', delta: 3 }],
  },
  {
    id: 'al_ambassade', label: 'Recevoir l’ambassadeur vélari', category: 'contact', minRank: 'militant', requires: { alienPhase: 4 },
    description: 'Un dîner d’État pas comme les autres. Les Vélari ne mangent pas, mais adorent le protocole.',
    cost: { ap: 2, energy: 10 }, cooldown: 3,
    effects: [{ kind: 'alien', confiance: 4, gift: true, rivalite: -3 }, { kind: 'stat', stat: 'influence', delta: 3 }, { kind: 'intl', prestige: 3 }],
  },

  // ── Encore d'autres actions ─────────────────────────────
  {
    id: 'cafe_politique', label: 'Animer un café politique', category: 'terrain', minRank: 'militant',
    description: 'Un bistrot, un sujet, des habitués qui ont des choses à dire. Vous écoutez plus que vous ne parlez.',
    cost: { ap: 1, energy: 6, money: 100 }, cooldown: 2,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'dossier', domain: '$domain', delta: 2 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
    target: 'domain',
  },
  {
    id: 'consultation_citoyenne', minigame: 'consultation', label: 'Organiser une consultation citoyenne', category: 'fonction', minRank: 'conseiller_municipal',
    description: 'Un samedi entier avec des habitants tirés au sort. Il faudra trier les idées, sous leurs yeux.',
    cost: { ap: 2, energy: 12 }, cooldown: 3,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'stat', stat: 'credibility', delta: 2 }, { kind: 'contact', contactId: 'ct-maires', trust: 2 }],
  },
  {
    id: 'festival_ete', minigame: 'festival', label: 'Monter sur la scène d’un festival', category: 'terrain', minRank: 'conseiller_municipal',
    description: 'Le groupe vous invite à dire un mot entre deux morceaux. Quinze mille personnes, un risque de huées.',
    cost: { ap: 1, energy: 10 }, cooldown: 4,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 4 }, { kind: 'momentum', delta: 3 }],
  },
  {
    id: 'jumelage', label: 'Organiser un jumelage', category: 'fonction', minRank: 'conseiller_municipal',
    description: 'Une ville allemande, polonaise ou sénégalaise ; des écoliers, une fanfare, un panneau à l’entrée de la commune.',
    cost: { ap: 1, energy: 8, money: 1500 }, cooldown: 6,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'intl', allRelations: 1 }, { kind: 'dossier', domain: 'diplomatie', delta: 3 }],
  },
  {
    id: 'visite_prison', label: 'Visiter une prison sans prévenir', category: 'dossiers', minRank: 'depute',
    description: 'Le droit de visite des parlementaires : surpopulation, matelas au sol, surveillants épuisés.',
    cost: { ap: 1, energy: 12 }, cooldown: 3,
    effects: [{ kind: 'dossier', domain: 'justice', delta: 7 }, { kind: 'stat', stat: 'credibility', delta: 2 }, { kind: 'stat', stat: 'stress', delta: 3 }],
  },
  {
    id: 'tour_campagne_bus', minigame: 'tournee_campagne', label: 'Planifier une tournée de campagne', category: 'terrain', minRank: 'conseiller_municipal',
    description: 'Une carte, un bus, des villes à choisir : chaque étape compte, chaque détour coûte.',
    cost: { ap: 2, energy: 14, money: 2000 }, cooldown: 3,
    effects: [{ kind: 'momentum', delta: 8 }, { kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'contact', contactId: 'ct-maires', trust: 3 }],
  },
  {
    id: 'pique_nique', label: 'Pique-nique des militants', category: 'parti', minRank: 'militant',
    description: 'Nappes à carreaux, merguez, tournoi de pétanque : la section se ressoude au soleil.',
    cost: { ap: 1, energy: 6, money: 300 }, cooldown: 3,
    effects: [{ kind: 'cohesion', delta: 3 }, { kind: 'faction', factionId: '*', delta: 2 }, { kind: 'stat', stat: 'stress', delta: -3 }],
  },
  {
    id: 'audit_parti', label: 'Faire auditer les comptes du parti', category: 'fonction', minRank: 'chef_parti', onlyRanks: ['chef_parti'],
    description: 'Un cabinet indépendant épluche les comptes. Ce qui en sortira rassurera… ou fera du bruit.',
    cost: { ap: 1, energy: 6, politicalCapital: 10 }, cooldown: 12,
    effects: [{ kind: 'stat', stat: 'credibility', delta: 4 }, { kind: 'partyTreasury', delta: 20 }, { kind: 'cohesion', delta: -2 }],
    risk: { baseChance: 0.25, onFailure: [{ kind: 'exposure', delta: 8 }, { kind: 'cohesion', delta: -6 }], failureNews: 'L’audit révèle des factures douteuses de l’ancienne direction.' },
  },
  {
    id: 'cuisine_tele', label: 'Passer dans une émission culinaire', category: 'medias', minRank: 'depute',
    description: 'Tablier, blanquette, confidences sur votre enfance : la politique par l’estomac.',
    cost: { ap: 1, energy: 6 }, cooldown: 4,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 4 }, { kind: 'stat', stat: 'credibility', delta: -1 }],
  },
  {
    id: 'velo_circo', label: 'Faire le tour de la circonscription à vélo', category: 'sante', minRank: 'conseiller_municipal',
    description: 'Cent kilomètres en trois jours, de mairie en mairie, sans voiture officielle.',
    cost: { ap: 1, energy: 16 }, cooldown: 4,
    effects: [{ kind: 'health', delta: 2 }, { kind: 'flagAdd', key: 'hygiene', delta: 2 }, { kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'contact', contactId: 'ct-maires', trust: 2 }],
  },
  {
    id: 'mot_radio', minigame: 'mot_du_jour', label: 'Jouer au « mot du jour » à la radio', category: 'medias', minRank: 'conseiller_municipal',
    description: 'La radio locale vous défie en direct : six essais pour trouver le mot. Les auditeurs adorent les élus qui jouent le jeu.',
    cost: { ap: 1, energy: 5 }, cooldown: 2,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'influence', delta: 1 }, { kind: 'stat', stat: 'stress', delta: -2 }],
  },
  {
    id: 'quiz_bistrot', minigame: 'trivial', label: 'Soirée quiz au bistrot', category: 'terrain', minRank: 'militant',
    description: 'Le quiz du jeudi au café du coin : votre équipe contre les habitués. Six camemberts à décrocher.',
    cost: { ap: 1, energy: 7, money: 60 }, cooldown: 2,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'credibility', delta: 1 }, { kind: 'cohesion', delta: 1 }, { kind: 'stat', stat: 'stress', delta: -2 }],
  },
  {
    id: 'reviser_carte', minigame: 'departodoku', label: 'Réviser la carte de France', category: 'dossiers', minRank: 'militant',
    description: 'Préfectures, régions, frontières : un élu qui sèche sur un département, c’est une vidéo virale assurée.',
    cost: { ap: 1, energy: 8 }, cooldown: 2,
    effects: [{ kind: 'dossier', domain: 'territoires', delta: 6 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
  },
  {
    id: 'jeu_tele', minigame: 'quiz_tele', label: 'Jeu télévisé au profit d’une association', category: 'medias', minRank: 'depute',
    description: 'Prime time, plateau lumineux, chèque géant : chaque camembert rapporte des dons à l’association de votre choix.',
    cost: { ap: 2, energy: 12 }, cooldown: 4,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 4 }, { kind: 'stat', stat: 'influence', delta: 1 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
  },
  {
    id: 'marche_dimanche', minigame: 'tractage', label: 'Tourner au marché le dimanche matin', category: 'terrain', minRank: 'militant',
    description: 'Entre le fromager et le maraîcher, un tract, un mot, une poignée de main. Le café au comptoir est offert, la critique aussi.',
    cost: { ap: 1, energy: 8 }, cooldown: 1,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'momentum', delta: 1 }],
  },
  {
    id: 'visite_ferme', label: 'Passer une journée dans une exploitation agricole', category: 'terrain', minRank: 'militant',
    description: 'Traite à 6 heures, comptes de la coopérative à midi, colère sur les normes le soir. Vous repartez avec des bottes sales et des dossiers.',
    cost: { ap: 1, energy: 14 }, cooldown: 3,
    effects: [{ kind: 'dossier', domain: 'ecologie', delta: 3 }, { kind: 'dossier', domain: 'territoires', delta: 2 }, { kind: 'stat', stat: 'popularity', delta: 2 }],
  },
  {
    id: 'conseil_jeunes', label: 'Créer un conseil des jeunes', category: 'terrain', minRank: 'conseiller_municipal',
    description: 'Vingt collégiens et lycéens élus par leurs pairs, un budget symbolique, des idées qui décoiffent.',
    cost: { ap: 2, energy: 10, money: 500 }, cooldown: 6,
    effects: [{ kind: 'dossier', domain: 'education', delta: 4 }, { kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
  },
  {
    id: 'lettre_info', label: 'Lancer sa lettre d’information', category: 'medias', minRank: 'militant',
    description: 'Une lettre par mois, à vos abonnés : votre bilan, vos combats, une photo du marché. Les fidèles la lisent jusqu’au bout.',
    cost: { ap: 1, energy: 6, money: 200 }, cooldown: 3,
    effects: [{ kind: 'stat', stat: 'influence', delta: 1 }, { kind: 'stat', stat: 'popularity', delta: 1 }, { kind: 'momentum', delta: 2 }],
  },
  {
    id: 'video_pedago', label: 'Tourner une vidéo pédagogique', category: 'medias', minRank: 'militant', target: 'domain',
    description: 'Une minute trente, un tableau blanc, un sujet compliqué rendu limpide. Si ça prend, des centaines de milliers de vues.',
    cost: { ap: 1, energy: 8 }, cooldown: 2,
    effects: [{ kind: 'dossier', domain: '$domain', delta: 3 }, { kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
    risk: { baseChance: 0.15, onFailure: [{ kind: 'stat', stat: 'popularity', delta: -2 }, { kind: 'stat', stat: 'credibility', delta: -2 }], failureNews: 'Une erreur de chiffre dans votre vidéo : les fact-checkeurs s’en donnent à cœur joie.' },
  },
  {
    id: 'dejeuner_presse', label: 'Déjeuner avec les journalistes politiques', category: 'reseau', minRank: 'depute',
    description: 'Une brasserie près de l’Assemblée, du « off » et des confidences calculées. Ils écriront peut-être sur vous.',
    cost: { ap: 1, energy: 6, money: 180 }, cooldown: 2,
    effects: [{ kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'stat', stat: 'credibility', delta: 1 }, { kind: 'exposure', delta: 1 }],
  },
  {
    id: 'mentorat', label: 'Prendre un·e jeune militant·e sous son aile', category: 'parti', minRank: 'conseiller_municipal',
    description: 'Lui ouvrir votre agenda, relire ses discours, lui apprendre le métier. Un jour, il ou elle vous le rendra, ou vous doublera.',
    cost: { ap: 1, energy: 6 }, cooldown: 4,
    effects: [{ kind: 'cohesion', delta: 2 }, { kind: 'stat', stat: 'influence', delta: 1 }, { kind: 'stat', stat: 'stress', delta: -1 }],
  },
  {
    id: 'rapport_cour_comptes', minigame: 'fiches', label: 'Éplucher un rapport de la Cour des comptes', category: 'dossiers', minRank: 'militant', target: 'domain',
    description: 'Quatre cents pages, des tableaux, des recommandations restées lettre morte. De quoi nourrir vos interventions pour des mois.',
    cost: { ap: 1, energy: 14 }, cooldown: 2,
    effects: [{ kind: 'dossier', domain: '$domain', delta: 7 }, { kind: 'stat', stat: 'credibility', delta: 1 }, { kind: 'stat', stat: 'stress', delta: 2 }],
  },
  {
    id: 'debat_contradictoire', minigame: 'eloquence', label: 'Organiser un débat public avec un adversaire', category: 'terrain', minRank: 'conseiller_municipal',
    description: 'Une salle municipale, deux micros, un modérateur et deux camps dans le public. Le meilleur argument gagne… en théorie.',
    cost: { ap: 2, energy: 12 }, cooldown: 3,
    effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'stat', stat: 'credibility', delta: 2 }, { kind: 'momentum', delta: 2 }],
  },
  {
    id: 'maraude', label: 'Une nuit de maraude avec le Samu social', category: 'terrain', minRank: 'militant',
    description: 'Thermos, couvertures et longues conversations sur le trottoir. Pas de caméra : vous l’avez demandé.',
    cost: { ap: 1, energy: 14 }, cooldown: 3,
    effects: [{ kind: 'dossier', domain: 'social', delta: 4 }, { kind: 'stat', stat: 'credibility', delta: 2 }, { kind: 'stat', stat: 'popularity', delta: 1 }],
  },
  {
    id: 'atelier_ia', label: 'Former son équipe aux outils numériques', category: 'dossiers', minRank: 'conseiller_municipal',
    description: 'Une journée d’atelier : données ouvertes, cartographie, intelligence artificielle. Votre équipe gagne des heures chaque semaine.',
    cost: { ap: 1, energy: 8, money: 800 }, cooldown: 6,
    effects: [{ kind: 'dossier', domain: 'numerique', delta: 5 }, { kind: 'stat', stat: 'stress', delta: -2 }, { kind: 'stat', stat: 'influence', delta: 1 }],
  },
  {
    id: 'caserne_pompiers', label: 'Visiter une caserne de pompiers', category: 'terrain', minRank: 'militant',
    description: 'Exercice de désincarcération, café à la cantine, et une liste de doléances sur les volontaires qui ne viennent plus.',
    cost: { ap: 1, energy: 8 }, cooldown: 3,
    effects: [{ kind: 'dossier', domain: 'securite', delta: 3 }, { kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'contact', contactId: 'ct-maires', trust: 1 }],
  },
  {
    id: 'quiz_militants', minigame: 'trivial', label: 'Soirée quiz avec les militants', category: 'parti', minRank: 'militant',
    description: 'Pizzas, équipes mélangées et questions sur l’histoire de la République. Les anciens ont de beaux restes.',
    cost: { ap: 1, energy: 6, money: 80 }, cooldown: 3,
    effects: [{ kind: 'cohesion', delta: 3 }, { kind: 'stat', stat: 'stress', delta: -3 }],
  },
  {
    id: 'club_lecture', label: 'Animer un cercle de lecture', category: 'repos', minRank: 'militant',
    description: 'Un livre par mois, quelques fidèles, une librairie qui ferme ses rideaux pour vous. On y parle de tout, sauf de politique. Enfin, presque.',
    cost: { ap: 1, energy: 3 }, cooldown: 2,
    effects: [{ kind: 'stat', stat: 'stress', delta: -6 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
  },

  // ── Assemblée : textes sur l'actualité ─────────────────
  {
    id: 'deposer_ppl', label: 'Déposer une proposition de loi sur l’actualité', category: 'fonction', minRank: 'depute', onlyRanks: ['depute'],
    description: 'Le sujet à la une mérite une loi. Vous rédigez, vous cosignez, et vous obtenez une niche à l’ordre du jour : scrutin public le mois prochain.',
    cost: { ap: 2, energy: 10, politicalCapital: 10 }, cooldown: 3,
    effects: [{ kind: 'vote', own: true }, { kind: 'stat', stat: 'influence', delta: 1 }],
  },
  {
    id: 'projet_de_loi', label: 'Présenter un projet de loi sur l’actualité', category: 'fonction', minRank: 'ministre', onlyRanks: ['ministre', 'premier_ministre', 'president'],
    description: 'Conseil des ministres, avis du Conseil d’État, puis l’hémicycle : un texte du gouvernement sur le sujet du moment.',
    cost: { ap: 2, energy: 12, politicalCapital: 15 }, cooldown: 3,
    effects: [{ kind: 'vote', own: true }, { kind: 'stat', stat: 'credibility', delta: 1 }],
  },

  // ── Guerre ──────────────────────────────────────────────
  {
    id: 'declarer_guerre', label: 'Déclarer la guerre', category: 'international', minRank: 'ministre', target: 'enemy',
    requires: { peace: true, warPower: true },
    description: 'Un casus belli, un Conseil de défense, puis le Parlement doit autoriser l’engagement des armées (article 35). Les adversaires sont des États fictifs.',
    cost: { ap: 2, energy: 10, politicalCapital: 20 },
    effects: [{ kind: 'war', declare: '$target' }, { kind: 'stat', stat: 'stress', delta: 6 }],
  },
  {
    id: 'guerre_offensive', label: 'Lancer une grande offensive', category: 'guerre', minRank: 'ministre', requires: { war: true },
    description: 'Tout l’état-major sur une percée. Si elle réussit, le front bouge enfin ; sinon, les pertes seront lourdes.',
    cost: { ap: 3, energy: 15, politicalCapital: 10 }, cooldown: 2,
    effects: [{ kind: 'war', front: 7, losses: 180, support: -2 }, { kind: 'stat', stat: 'stress', delta: 5 }],
    risk: { baseChance: 0.35, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [{ kind: 'war', front: -5, losses: 420, support: -8 }, { kind: 'stat', stat: 'credibility', delta: -4 }], failureNews: 'L’offensive se brise sur les défenses ennemies. Des centaines de morts.' },
  },
  {
    id: 'guerre_frappes', label: 'Frappes aériennes ciblées', category: 'guerre', minRank: 'ministre', requires: { war: true },
    description: 'Dépôts de munitions, centres de commandement, ponts : l’aviation frappe loin derrière les lignes.',
    cost: { ap: 2, energy: 8 }, maxPerMonth: 1,
    effects: [{ kind: 'war', front: 3, losses: 10 }, { kind: 'intl', tension: 3 }],
    risk: { baseChance: 0.25, onFailure: [{ kind: 'war', support: -10 }, { kind: 'intl', prestige: -8 }, { kind: 'stat', stat: 'credibility', delta: -4 }], failureNews: 'Une frappe touche un hôpital. Les images font le tour du monde.' },
  },
  {
    id: 'guerre_reserves', label: 'Mobiliser les réservistes', category: 'guerre', minRank: 'ministre', requires: { war: true },
    description: 'Cinquante mille réservistes rappelés : le front se renforce, les familles s’inquiètent.',
    cost: { ap: 2, energy: 10, politicalCapital: 15 }, cooldown: 3,
    effects: [{ kind: 'war', front: 3, support: -4 }, { kind: 'flagAdd', key: 'warBoost', delta: 8 }, { kind: 'stat', stat: 'popularity', delta: -1 }],
  },
  {
    id: 'guerre_allies', label: 'Demander l’entrée en guerre d’un allié', category: 'guerre', minRank: 'ministre', target: 'partner', requires: { war: true },
    description: 'Un sommet de crise, des promesses, un peu de chantage : de bonnes relations rendent le « oui » plus probable.',
    cost: { ap: 2, energy: 12, politicalCapital: 10 }, cooldown: 2,
    effects: [{ kind: 'war', ally: '$target' }, { kind: 'dossier', domain: 'diplomatie', delta: 3 }],
  },
  {
    id: 'guerre_nation', minigame: 'allocution', label: 'S’adresser à la Nation', category: 'guerre', minRank: 'ministre', requires: { war: true },
    description: 'Une allocution solennelle à 20 heures : expliquer, rassurer, mobiliser.',
    cost: { ap: 1, energy: 6 }, cooldown: 2,
    effects: [{ kind: 'war', support: 8 }, { kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
  },
  {
    id: 'guerre_troupes', label: 'Rendre visite aux troupes', category: 'guerre', minRank: 'ministre', requires: { war: true },
    description: 'Gilet pare-balles, hélicoptère, repas à la popote : le moral des soldats remonte, le vôtre aussi.',
    cost: { ap: 2, energy: 15 }, cooldown: 3,
    effects: [{ kind: 'war', front: 1, support: 4 }, { kind: 'stat', stat: 'influence', delta: 2 }],
    risk: { baseChance: 0.12, onFailure: [{ kind: 'flagAdd', key: 'menace', delta: 15 }, { kind: 'stat', stat: 'stress', delta: 12 }, { kind: 'health', delta: -4 }], failureNews: 'Un tir de mortier tombe à deux cents mètres de votre convoi.' },
  },
  {
    id: 'guerre_hommage', label: 'Hommage national aux soldats tombés', category: 'guerre', minRank: 'ministre', requires: { war: true },
    description: 'La cour des Invalides, les cercueils sous le drapeau, la Marseillaise.',
    cost: { ap: 1, energy: 5 }, cooldown: 4,
    effects: [{ kind: 'war', support: 5 }, { kind: 'stat', stat: 'credibility', delta: 2 }, { kind: 'stat', stat: 'stress', delta: 3 }],
  },
  {
    id: 'guerre_cessez_le_feu', label: 'Négocier un cessez-le-feu', category: 'guerre', minRank: 'ministre', requires: { war: true },
    description: 'Une médiation, une table, des cartes. La paix se signe selon la ligne de front : victorieuse, de compromis ou humiliante.',
    cost: { ap: 3, energy: 12, politicalCapital: 20 }, cooldown: 2,
    effects: [{ kind: 'war', peace: true }],
    risk: { baseChance: 0.45, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [{ kind: 'war', support: -4, front: -3 }, { kind: 'stat', stat: 'credibility', delta: -2 }], failureNews: 'L’ennemi rejette vos propositions et relance l’offensive.' },
  },

  // ── International ───────────────────────────────────────
  {
    id: 'mission_etranger', label: 'Mission parlementaire à l’étranger', category: 'international', minRank: 'depute', target: 'partner',
    description: 'Une délégation de trois jours : ministres, ONG, entreprises françaises.',
    cost: { ap: 2, energy: 15 }, cooldown: 4,
    effects: [{ kind: 'intl', partner: '$target', relation: 5, prestige: 1 }, { kind: 'dossier', domain: 'diplomatie', delta: 4 }],
  },
  {
    id: 'groupe_amitie', label: 'Animer un groupe d’amitié', category: 'international', minRank: 'depute', target: 'partner',
    description: 'Dîners avec l’ambassadeur, échanges d’élus.',
    cost: { ap: 1, energy: 5 }, maxPerMonth: 1,
    effects: [{ kind: 'intl', partner: '$target', relation: 3 }, { kind: 'stat', stat: 'influence', delta: 1 }],
  },
  {
    id: 'tribune_etrangere', label: 'Signer une tribune dans la presse étrangère', category: 'international', minRank: 'depute',
    description: 'Une page dans un grand quotidien international.',
    cost: { ap: 1, energy: 6 }, cooldown: 4,
    effects: [{ kind: 'intl', prestige: 2 }, { kind: 'stat', stat: 'credibility', delta: 2 }, { kind: 'exposure', delta: 2 }],
  },
  {
    id: 'visite_bilaterale', label: 'Visite bilatérale', category: 'international', minRank: 'ministre', target: 'partner',
    description: 'Entretiens officiels, accords de coopération, dîner à l’ambassade.',
    cost: { ap: 2, energy: 15 }, maxPerMonth: 1,
    effects: [{ kind: 'intl', partner: '$target', relation: 10, prestige: 2 }, { kind: 'dossier', domain: 'diplomatie', delta: 3 }],
  },
  {
    id: 'accord_commercial', label: 'Négocier un accord commercial', category: 'international', minRank: 'ministre', target: 'partner',
    description: 'Des débouchés pour nos entreprises… et l’inquiétude de nos agriculteurs.',
    cost: { ap: 2, energy: 12, politicalCapital: 15 }, cooldown: 4,
    effects: [{ kind: 'intl', partner: '$target', relation: 8, prestige: 2 }, { kind: 'dossier', domain: 'economie', delta: 5 }, { kind: 'stat', stat: 'popularity', delta: -2 }],
    risk: { baseChance: 0.4, scaleWith: 'influence', scaleWeight: 0.6, onFailure: [{ kind: 'intl', partner: '$target', relation: -5 }, { kind: 'stat', stat: 'credibility', delta: -3 }], failureNews: 'Les négociations capotent sur les quotas de bœuf.' },
  },
  {
    id: 'conseil_europeen', label: 'Peser au Conseil européen', category: 'international', minRank: 'ministre',
    description: 'Une nuit de négociations à Bruxelles pour arracher un compromis.',
    cost: { ap: 2, energy: 14 }, cooldown: 4,
    effects: [{ kind: 'intl', partner: 'ue', relation: 8, prestige: 3 }, { kind: 'stat', stat: 'influence', delta: 2 }],
    risk: { baseChance: 0.3, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [{ kind: 'intl', partner: 'ue', relation: -3 }, { kind: 'stat', stat: 'stress', delta: 6 }], failureNews: 'Isolé·e à Bruxelles : le compromis se fait sans la France.' },
  },
  {
    id: 'aide_developpement', label: 'Annoncer une aide au développement', category: 'international', minRank: 'ministre',
    description: 'Écoles, hôpitaux, réseaux d’eau : un engagement de long terme.',
    cost: { ap: 1, politicalCapital: 10 }, cooldown: 4,
    effects: [{ kind: 'intl', partner: 'afrique', relation: 10, prestige: 2 }, { kind: 'stat', stat: 'popularity', delta: -1 }],
  },
  {
    id: 'sanctions', label: 'Décider de sanctions économiques', category: 'international', minRank: 'president', onlyRanks: ['president'], target: 'partner',
    description: 'Gel des avoirs, embargo ciblé. L’économie trinquera un peu.',
    cost: { ap: 1, politicalCapital: 10 }, cooldown: 4,
    effects: [{ kind: 'intl', partner: '$target', relation: -20, prestige: 3, tension: 6 }, { kind: 'presidency', approval: 2 }, { kind: 'assetValue', defIds: ['actions'], factor: 0.97 }],
  },
  {
    id: 'intervention', label: 'Intervention militaire', category: 'international', minRank: 'president', onlyRanks: ['president'], requires: { crisis: true },
    description: 'Engager nos forces pour mettre fin à la crise. Rien n’est jamais simple.',
    cost: { ap: 2, politicalCapital: 30 }, cooldown: 4,
    effects: [{ kind: 'intl', crisis: -30, prestige: 6, tension: 5 }, { kind: 'presidency', approval: 5, threat: 10 }],
    risk: { baseChance: 0.35, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [{ kind: 'intl', crisis: 10, prestige: -5 }, { kind: 'presidency', approval: -10, threat: 10 }], failureNews: 'Des soldats tombent dans une embuscade. L’opinion se retourne.' },
  },
  {
    id: 'mediation_paix', label: 'Médiation de paix', category: 'international', minRank: 'president', onlyRanks: ['president'], requires: { crisis: true },
    description: 'Réunir les belligérants à Paris. Un pari diplomatique.',
    cost: { ap: 2, energy: 15 }, cooldown: 4,
    effects: [{ kind: 'intl', crisis: -18, prestige: 5 }, { kind: 'presidency', approval: 2 }],
    risk: { baseChance: 0.45, scaleWith: 'influence', scaleWeight: 0.6, onFailure: [{ kind: 'intl', prestige: -3 }, { kind: 'stat', stat: 'stress', delta: 8 }], failureNews: 'Les délégations quittent Paris sans accord.' },
  },
  {
    id: 'accord_climat', label: 'Porter un accord mondial sur le climat', category: 'international', minRank: 'president', onlyRanks: ['president'],
    description: 'Une conférence à Paris, deux cents pays, une nuit blanche de plus.',
    cost: { ap: 2, energy: 12, politicalCapital: 20 }, cooldown: 12,
    effects: [{ kind: 'intl', prestige: 6, allRelations: 3 }, { kind: 'dossier', domain: 'ecologie', delta: 5 }, { kind: 'faction', factionId: 'ligne_dure', delta: -4 }],
    risk: { baseChance: 0.4, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [{ kind: 'intl', prestige: -4 }], failureNews: 'L’accord accouche d’une déclaration sans engagement.' },
  },
  {
    id: 'telephone_rouge', label: 'Appeler les grands dirigeants', category: 'international', minRank: 'president', onlyRanks: ['president'],
    description: 'Une tournée téléphonique pour faire baisser la température.',
    cost: { ap: 1, energy: 5 }, maxPerMonth: 1,
    effects: [{ kind: 'intl', tension: -6, prestige: 1 }],
  },

  // ── Scénarios d'actions (scènes interactives) ───────────
  {
    id: 'operation_porte_a_porte', label: 'Grande opération porte-à-porte', category: 'terrain', minRank: 'militant',
    description: 'Un immeuble entier, cage par cage. À jouer comme une scène.',
    cost: { ap: 2, energy: 10 }, cooldown: 2,
    effects: [{ kind: 'scene', sceneId: 'porte_a_porte' }],
  },
  {
    id: 'live_reseaux', label: 'Lancer un live sur les réseaux', category: 'medias', minRank: 'militant',
    description: 'Une heure en direct face à votre communauté… et aux trolls.',
    cost: { ap: 1, energy: 6 }, cooldown: 2,
    effects: [{ kind: 'scene', sceneId: 'live_reseaux' }],
  },
  {
    id: 'tenir_conference_presse', label: 'Tenir une conférence de presse', category: 'medias', minRank: 'conseiller_municipal',
    description: 'Trente journalistes, un pupitre, et des questions que vous n’avez pas prévues.',
    cost: { ap: 1, energy: 8, money: 300 }, cooldown: 3,
    effects: [{ kind: 'scene', sceneId: 'conference_presse_scene' }],
  },
  {
    id: 'visite_usine', label: 'Visiter une usine', category: 'terrain', minRank: 'conseiller_municipal',
    description: 'Ouvriers, syndicats, direction : une visite où chacun attend quelque chose de vous.',
    cost: { ap: 2, energy: 12 }, cooldown: 3,
    effects: [{ kind: 'scene', sceneId: 'visite_usine' }],
  },
  {
    id: 'qag_seance', label: 'Interpeller le gouvernement en séance', category: 'fonction', minRank: 'depute', onlyRanks: ['depute'],
    description: 'Deux minutes de question, en direct, face au ministre et au chahut.',
    cost: { ap: 1, energy: 8 }, cooldown: 2,
    effects: [{ kind: 'scene', sceneId: 'qag_scene' }],
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
    cost: { ap: 2 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'energy', delta: 35 }, { kind: 'stat', stat: 'stress', delta: -25 }, { kind: 'stat', stat: 'popularity', delta: -1 }, { kind: 'stat', stat: 'influence', delta: -1 }, { kind: 'momentum', delta: -3 }],
  },
  {
    id: 'footing', label: 'Footing matinal', category: 'repos', minRank: 'militant',
    description: 'Quarante minutes au bord du canal avant la première réunion.',
    cost: { ap: 1 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'energy', delta: 10 }, { kind: 'stat', stat: 'stress', delta: -7 }, { kind: 'flagAdd', key: 'hygiene', delta: 0.6 }],
  },
  {
    id: 'sejour_campagne', label: 'Séjour dans votre maison', category: 'repos', minRank: 'militant',
    requires: { asset: ['maison', 'villa'] },
    description: 'Volets ouverts, téléphone éteint. Votre résidence secondaire vous ressource vraiment.',
    cost: { ap: 2 }, maxPerMonth: 1,
    effects: [{ kind: 'stat', stat: 'energy', delta: 40 }, { kind: 'stat', stat: 'stress', delta: -25 }, { kind: 'stat', stat: 'influence', delta: -1 }, { kind: 'momentum', delta: -3 }],
  },
  {
    id: 'vacances', label: 'Partir une semaine en vacances', category: 'repos', minRank: 'militant',
    description: 'Une vraie coupure, loin de tout. Vos adversaires, eux, ne partent pas.',
    cost: { ap: 3, money: 1500 }, maxPerMonth: 1,
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
    case 'flagAdd': return e.key === 'illegal' ? -3 * e.delta : e.key === 'hygiene' ? 0.8 * e.delta : e.key === 'protection' ? 0.1 * e.delta : 0;
    case 'health': return 0.8 * e.delta;
    case 'presidency': return 0.8 * (e.approval ?? 0) + 0.4 * (e.majority ?? 0) + 0.2 * (e.security ?? 0) - 0.2 * (e.threat ?? 0) + (e.reform ? 4 : 0);
    case 'parrainages': return 0.06 * e.delta;
    case 'intl': return 0.25 * (e.relation ?? 0) + 0.6 * (e.allRelations ?? 0) + 0.8 * (e.prestige ?? 0) - 0.3 * (e.tension ?? 0) - 0.3 * (e.crisis ?? 0);
    case 'government': return 0.6 * (e.majority ?? 0) + 0.3 * (e.cohesion ?? 0);
    case 'partyTreasury': return e.delta * 0.1;
    case 'crown': return 0.5 * ((e.soutien ?? 0) + (e.legitimite ?? 0) + (e.armee ?? 0));
    case 'lodge': return 0.3 * ((e.fraternite ?? 0) + (e.discretion ?? 0) + (e.planches ?? 0) * 5);
    case 'mole': return 0.4 * ((e.intel ?? 0) + (e.cover ?? 0) + (e.sabotage ?? 0));
    case 'alien': return 0.5 * ((e.comprehension ?? 0) + (e.confiance ?? 0)) - 0.4 * ((e.panique ?? 0) + (e.rivalite ?? 0));
    case 'war': return 0.5 * (e.front ?? 0) + 0.3 * (e.support ?? 0) - 0.01 * (e.losses ?? 0);
    default: return 0;
  }
}

/** Part minimale de la valeur des gains rendue en malus visibles */
const RATIO: Partial<Record<ActionCategory, number>> = {
  terrain: 0.7, medias: 0.75, dossiers: 0.7, parti: 0.75, reseau: 0.75, argent: 0.75, redaction: 0.7,
  couronne: 0.6, loge: 0.6, repos: 0.5, elysee: 0.6, fonction: 0.6, international: 0.6,
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
  elysee: [n => ({ kind: 'stat', stat: 'stress', delta: n }), 0.6, 8],
  fonction: [n => ({ kind: 'stat', stat: 'stress', delta: n }), 0.6, 8],
  international: [n => ({ kind: 'stat', stat: 'stress', delta: n }), 0.6, 8],
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

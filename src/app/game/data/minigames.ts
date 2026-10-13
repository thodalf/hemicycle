/* ============================================================
 *  Mini-jeux : dix mécaniques, déclinées en thèmes.
 *  Le score (0 à 1) décide de l'ampleur des gains de l'action
 *  ou de l'événement qui les déclenche.
 * ============================================================ */

export type MinigameKind = 'poignees' | 'applaudimetre' | 'memoire' | 'tri' | 'marchandage' | 'pointage' | 'tournee' | 'mot' | 'grille' | 'quiz' | 'protocole' | 'table' | 'interception' | 'deminage' | 'interview' | 'cmp';

export interface TriItem {
  text: string;
  side: 'gauche' | 'droite';
}

export interface MinigameDef {
  id: string;
  kind: MinigameKind;
  title: string;
  /** Règle en une phrase */
  rule: string;
  icon: string;
  /** Poignées / pointage : cible à attraper, piège à éviter */
  good?: string;
  bad?: string;
  /** Tri : libellés des deux colonnes et éléments à trier */
  left?: string;
  right?: string;
  items?: TriItem[];
  /** Mémoire : paires (même valeur = paire) */
  pairs?: string[];
  /** Marchandage : « offrir » (ils acceptent au-dessus de leur seuil) ou « demander » (en dessous de leur limite) */
  mode?: 'offrir' | 'demander';
  who?: string;
  unit?: string;
  min?: number;
  max?: number;
  /** Applaudimètre : les phrases du discours */
  lines?: string[];
  /** Mot : la liste des mots à deviner (majuscules, sans accents) */
  words?: string[];
  /** Quiz : catégories retenues (toutes par défaut) */
  cats?: string[];
  /** Protocole : les gestes à enchaîner */
  steps?: { icon: string; label: string }[];
  /** Plan de table : les convives */
  guests?: { icon: string; name: string }[];
}

/** Vocabulaire politique pour le « mot du jour » (6 à 10 lettres) */
export const POLITICAL_WORDS = [
  'SCRUTIN', 'MANDAT', 'MOTION', 'CENSURE', 'BUDGET', 'PREFET', 'MINISTRE', 'DEPUTE', 'ELECTION', 'CAMPAGNE', 'MAIRIE',
  'REFERENDUM', 'REPUBLIQUE', 'PARLEMENT', 'HEMICYCLE', 'AMENDEMENT', 'MAJORITE', 'OPPOSITION', 'COALITION', 'SONDAGE',
  'MEETING', 'TRACTAGE', 'MILITANT', 'CONGRES', 'DECRET', 'ORDONNANCE', 'CABINET', 'CANDIDAT', 'BULLETIN', 'ISOLOIR',
  'ELECTEUR', 'SUFFRAGE', 'BALLOTTAGE', 'PRIMAIRE', 'PROGRAMME', 'DISCOURS', 'QUESTEUR', 'RAPPORTEUR', 'COMMISSION',
  'SCANDALE', 'REFORME', 'FISCALITE', 'RETRAITE', 'LAICITE', 'CITOYEN', 'NATION', 'ELYSEE', 'MATIGNON', 'TRIBUNE',
  'PERCHOIR', 'ASSEMBLEE', 'PARRAINAGE', 'ABSTENTION', 'VOTANT', 'CONSEIL', 'CANTON', 'REGION', 'COMMUNE', 'PREFECTURE',
  'SYNDICAT', 'MANIFESTE', 'ALLIANCE', 'TRAHISON', 'RALLIEMENT', 'LOBBYISTE', 'POPULISME', 'CENTRISTE', 'FRONDEUR',
  'MINISTERE', 'SECRETAIRE', 'GOUVERNER', 'DEMOCRATIE', 'MARIANNE', 'SENATEUR', 'DOLEANCES',
];

export const MINIGAMES: MinigameDef[] = [
  {
    id: 'bain_de_foule', kind: 'poignees', icon: '🤝', title: 'Bain de foule',
    rule: 'Serrez un maximum de mains en 15 secondes. Évitez les tomates !', good: '🙋', bad: '🍅',
  },
  {
    id: 'tractage', kind: 'poignees', icon: '📄', title: 'Tractage à la sortie du métro',
    rule: 'Tendez vos tracts aux passants intéressés, ignorez les grincheux.', good: '🧑‍💼', bad: '😠',
  },
  {
    id: 'selfies', kind: 'poignees', icon: '🤳', title: 'Séance de selfies',
    rule: 'Souriez pour les fans, esquivez les caméras cachées des humoristes.', good: '🤳', bad: '🎥',
  },
  {
    id: 'discours', kind: 'applaudimetre', icon: '🎤', title: 'Le grand discours',
    rule: 'Lancez chaque phrase quand le curseur est dans la zone verte : la salle applaudit.',
    lines: ['« Je suis venu·e vous parler de vous. »', '« On nous dit que c’est impossible… »', '« Ensemble, nous le ferons ! »', '« Personne ne sera laissé au bord du chemin. »', '« Vive la République, vive la France ! »'],
  },
  {
    id: 'allocution', kind: 'applaudimetre', icon: '📺', title: 'Allocution au 20 heures',
    rule: 'Le prompteur défile : marquez chaque phrase-clé au bon moment.',
    lines: ['« Mes chers compatriotes, »', '« la situation est grave, »', '« mais la France est forte. »', '« J’ai pris mes responsabilités. »', '« Vive la République. »'],
  },
  {
    id: 'fiches', kind: 'memoire', icon: '🗂️', title: 'Réviser ses fiches',
    rule: 'Retrouvez les paires de fiches avant la fin du temps imparti.',
    pairs: ['💶', '🏥', '🎓', '🌱', '🚓', '⚖️', '🖥️', '🌍'],
  },
  {
    id: 'courrier', kind: 'tri', icon: '✉️', title: 'Le courrier de la permanence',
    rule: 'Triez : à traiter, ou à la corbeille ? Vite, la file d’attente s’allonge.', left: 'Corbeille', right: 'À traiter',
    items: [
      { text: 'Une mère seule cherche une place en crèche', side: 'droite' },
      { text: 'Pétition des riverains contre le bruit de l’usine', side: 'droite' },
      { text: '« Vous êtes tous pourris » (anonyme)', side: 'gauche' },
      { text: 'Un retraité attend sa pension depuis six mois', side: 'droite' },
      { text: 'Publicité pour des stylos personnalisés', side: 'gauche' },
      { text: 'L’école du village menacée de fermeture', side: 'droite' },
      { text: 'Chaîne de lettres : « envoyez à dix élus »', side: 'gauche' },
      { text: 'Demande de logement social, dossier complet', side: 'droite' },
      { text: 'Un lobbyiste vous invite au Grand Prix de Monaco', side: 'gauche' },
      { text: 'Une association sportive cherche une salle', side: 'droite' },
      { text: 'Théorie du complot sur les antennes 5G', side: 'gauche' },
      { text: 'Un artisan victime d’impayés de la mairie', side: 'droite' },
      { text: 'Horoscope politique de la semaine', side: 'gauche' },
      { text: 'Collectif de parents : le bus scolaire ne passe plus', side: 'droite' },
    ],
  },
  {
    id: 'qag', kind: 'tri', icon: '🎙️', title: 'Questions au gouvernement',
    rule: 'Répondez aux questions de fond, esquivez les pièges de l’opposition.', left: 'Esquiver', right: 'Répondre',
    items: [
      { text: 'Quand les urgences de Vierzon rouvriront-elles ?', side: 'droite' },
      { text: '« Confirmez-vous avoir dîné avec ce milliardaire ? »', side: 'gauche' },
      { text: 'Quel calendrier pour la ligne ferroviaire Nantes–Lyon ?', side: 'droite' },
      { text: '« Le Premier ministre vous a-t-il désavoué·e ? »', side: 'gauche' },
      { text: 'Que faites-vous pour les agriculteurs touchés par la grêle ?', side: 'droite' },
      { text: '« Votre ancien collaborateur est-il mis en examen ? »', side: 'gauche' },
      { text: 'Le budget des collectivités sera-t-il maintenu ?', side: 'droite' },
      { text: '« Êtes-vous candidat·e à la présidentielle ? »', side: 'gauche' },
      { text: 'Quelle aide pour les étudiants précaires ?', side: 'droite' },
      { text: '« Combien coûte votre nouveau bureau ? »', side: 'gauche' },
      { text: 'Comment lutter contre les déserts médicaux ?', side: 'droite' },
      { text: '« Que pensez-vous de la petite phrase de votre ministre ? »', side: 'gauche' },
    ],
  },
  {
    id: 'moderation', kind: 'tri', icon: '💬', title: 'Live sur les réseaux',
    rule: 'Répondez aux vraies questions, ignorez les trolls : chaque erreur devient une capture d’écran.', left: 'Ignorer', right: 'Répondre',
    items: [
      { text: 'Vous comptez faire quoi pour le pouvoir d’achat ?', side: 'droite' },
      { text: 'mdr t ki ?', side: 'gauche' },
      { text: 'Pourquoi avoir voté contre la loi climat ?', side: 'droite' },
      { text: 'DÉMISSION !!!!!!!', side: 'gauche' },
      { text: 'Ma fille ne trouve pas de stage, des idées ?', side: 'droite' },
      { text: 'Lien vers une vidéo « choc » sur vous', side: 'gauche' },
      { text: 'Que proposez-vous pour les transports en zone rurale ?', side: 'droite' },
      { text: 'Bot : « Gagnez un iPhone en cliquant ici »', side: 'gauche' },
      { text: 'Vous serez à la fête du village samedi ?', side: 'droite' },
      { text: 'Montage photo de vous en clown', side: 'gauche' },
      { text: 'Quelle position sur le nucléaire ?', side: 'droite' },
      { text: '« Vous n’avez jamais travaillé de votre vie »', side: 'gauche' },
    ],
  },
  {
    id: 'negociation_syndicale', kind: 'marchandage', icon: '🤝', title: 'Négociation salariale',
    rule: 'Proposez une hausse : au-dessous de leur seuil, ils refusent ; au-dessus, vous payez trop. Cinq offres au plus.',
    who: 'Les syndicats', unit: '%', min: 0, max: 10,
  },
  {
    id: 'negociation_donateur', kind: 'marchandage', icon: '💶', title: 'Convaincre un grand donateur',
    rule: 'Demandez un montant : trop haut, il refuse ; trop bas, vous laissez de l’argent sur la table. Visez juste sous sa limite, en cinq demandes au plus.',
    mode: 'demander', who: 'Le mécène', unit: 'k€', min: 0, max: 100,
  },
  {
    id: 'negociation_alliance', kind: 'marchandage', icon: '🗳️', title: 'Partage des circonscriptions',
    rule: 'Combien de circonscriptions céder à vos alliés ? Au-dessous de leur exigence, ils claquent la porte ; au-dessus, vos troupes grincent.',
    who: 'Vos partenaires', unit: 'circ.', min: 0, max: 60,
  },
  {
    id: 'pointage', kind: 'pointage', icon: '🏛️', title: 'Rallier les indécis',
    rule: 'Des députés hésitent : cliquez sur eux avant qu’ils ne se décident ailleurs.', good: '🟡', bad: '🔴',
  },
  {
    id: 'fete_village', kind: 'poignees', icon: '🎪', title: 'La fête du village',
    rule: 'Trinquez avec un maximum d’habitants, chassez les guêpes de la buvette.', good: '🥂', bad: '🐝',
  },
  {
    id: 'dedicace', kind: 'poignees', icon: '✍️', title: 'Séance de dédicace',
    rule: 'Signez les livres qu’on vous tend, évitez les paparazzis.', good: '📘', bad: '📸',
  },
  {
    id: 'eloquence', kind: 'applaudimetre', icon: '🗣️', title: 'Joute d’éloquence',
    rule: 'Chaque effet de manche doit tomber pile au bon moment.',
    lines: ['« Mesdames et messieurs les jurés… »', '« Permettez-moi une confidence. »', '« Car enfin, de quoi parle-t-on ? »', '« La réponse tient en un mot. »', '« Je vous remercie. »'],
  },
  {
    id: 'matinale', kind: 'tri', icon: '📻', title: 'La matinale radio',
    rule: 'Répondez sur le fond, esquivez les questions piège. Le chronomètre tourne.', left: 'Esquiver', right: 'Répondre',
    items: [
      { text: 'Votre proposition sur les loyers est-elle finançable ?', side: 'droite' },
      { text: '« Vous détestez votre chef de parti, avouez-le. »', side: 'gauche' },
      { text: 'Que dites-vous aux salariés de l’usine qui ferme ?', side: 'droite' },
      { text: '« Quel est le prix d’une baguette ? »', side: 'gauche' },
      { text: 'Quelle est votre position sur les retraites ?', side: 'droite' },
      { text: '« Une rumeur dit que vous quittez la politique… »', side: 'gauche' },
      { text: 'Comment rendre les transports moins chers ?', side: 'droite' },
      { text: '« Allez-vous trahir vos électeurs comme les autres ? »', side: 'gauche' },
      { text: 'Faut-il plus de policiers dans les quartiers ?', side: 'droite' },
      { text: '« Votre conjoint·e vous soutient-il·elle vraiment ? »', side: 'gauche' },
      { text: 'Quel bilan pour la réforme de l’école ?', side: 'droite' },
      { text: '« Oui ou non, en une seconde : êtes-vous ambitieux·se ? »', side: 'gauche' },
    ],
  },
  {
    id: 'tournee_maires', kind: 'tournee', icon: '🚗', title: 'La tournée des mairies',
    rule: 'Tracez votre route : chaque village promet des signatures, chaque kilomètre use votre réservoir. Récoltez-en le plus possible avant la panne sèche.',
  },
  {
    id: 'tournee_campagne', kind: 'tournee', icon: '🚌', title: 'La tournée de campagne',
    rule: 'Choisissez vos étapes : chaque ville rapporte des soutiens, chaque trajet coûte du temps. Optimisez l’itinéraire.',
  },
  {
    id: 'glyphes', kind: 'memoire', icon: '👽', title: 'Décoder les glyphes',
    rule: 'Associez les glyphes identiques du message venu des étoiles avant la fin du créneau d’antenne.',
    pairs: ['◬', '⟡', '⌘', '⍟', '✶', '⧫', '⬡', '⌖'],
  },
  {
    id: 'message_etoiles', kind: 'tri', icon: '📡', title: 'Que dire aux étoiles ?',
    rule: 'Composez la réponse de l’humanité : envoyez ce qui nous honore, écartez ce qui pourrait effrayer.', left: 'Écarter', right: 'Envoyer',
    items: [
      { text: 'Les nombres premiers jusqu’à 101', side: 'droite' },
      { text: 'Les plans de nos missiles balistiques', side: 'gauche' },
      { text: 'La structure de la molécule d’ADN', side: 'droite' },
      { text: 'Un extrait de film de guerre', side: 'gauche' },
      { text: 'Le Boléro de Ravel', side: 'droite' },
      { text: 'Une publicité pour une lessive', side: 'gauche' },
      { text: 'Le rire d’un bébé', side: 'droite' },
      { text: 'Les débats de l’Assemblée en séance de nuit', side: 'gauche' },
      { text: 'Une carte du Système solaire', side: 'droite' },
      { text: 'Un discours belliqueux d’un dictateur', side: 'gauche' },
      { text: 'La Déclaration des droits de l’homme', side: 'droite' },
      { text: 'Des photos de nos centrales nucléaires', side: 'gauche' },
      { text: 'Le bruit des vagues sur une plage bretonne', side: 'droite' },
      { text: 'Un tutoriel pour fabriquer une arme', side: 'gauche' },
    ],
  },
  {
    id: 'discours_etoiles', kind: 'applaudimetre', icon: '🌌', title: 'Rassurer la Nation',
    rule: 'Chaque phrase doit tomber juste : la France vous écoute, et le monde aussi.',
    lines: ['« Mes chers compatriotes, nous ne sommes pas seuls. »', '« Rien, à cette heure, n’indique une menace. »', '« La science est à l’œuvre, jour et nuit. »', '« La France tendra la main, sans baisser la garde. »', '« Restons unis : l’Histoire nous regarde. »'],
  },
  {
    id: 'traite_velari', kind: 'marchandage', icon: '🛸', title: 'Le traité de coexistence',
    rule: 'Combien de kilomètres carrés de désert accorder à la base des Vélari ? Trop peu, ils refusent ; trop, l’opinion s’insurge.',
    who: 'Les émissaires vélari', unit: 'km²', min: 0, max: 500,
  },
  {
    id: 'festival', kind: 'applaudimetre', icon: '🎸', title: 'Sur la scène du festival',
    rule: 'Le groupe vous tend le micro : chaque réplique au bon moment, sinon les huées.',
    lines: ['« Bonsoir le festival ! »', '« Vous êtes magnifiques ! »', '« La culture, c’est ce qui nous rassemble ! »', '« Je laisse la place aux artistes… »', '« Merci et bon concert ! »'],
  },
  {
    id: 'mot_du_jour', kind: 'mot', icon: '🔤', title: 'Le mot du jour',
    rule: 'Trouvez le mot politique en six essais. Rouge : bonne lettre bien placée ; jaune : bonne lettre mal placée.',
    words: POLITICAL_WORDS,
  },
  {
    id: 'motus_tele', kind: 'mot', icon: '📺', title: 'Le jeu télévisé',
    rule: 'Le présentateur vous tend la première lettre : six essais pour trouver le mot, sous les yeux de la France entière.',
    words: POLITICAL_WORDS,
  },
  {
    id: 'departodoku', kind: 'grille', icon: '🗺️', title: 'Départodoku',
    rule: 'Remplissez la grille : chaque case attend un département qui vérifie sa ligne et sa colonne. Un département ne sert qu’une fois.',
  },
  {
    id: 'interro_carte', kind: 'grille', icon: '🎙️', title: 'L’interro surprise',
    rule: 'Le journaliste vous teste en direct sur la carte de France : un département par case, sans vous tromper trop souvent.',
  },
  {
    id: 'interview_piege', kind: 'interview', icon: '🎙️', title: 'L’interview piège',
    rule: 'Six questions en direct, quelques secondes pour chacune : répondre sur le fond, esquiver avec élégance ou contre-attaquer. Touches 1 à 3.',
  },
  {
    id: 'cmp', kind: 'cmp', icon: '🌙', title: 'La nuit de la commission mixte paritaire',
    rule: 'Amendement par amendement : tenir, faire un compromis ou céder. Il faut assez de concessions pour un accord, sans tout lâcher.',
  },
  {
    id: 'trivial', kind: 'quiz', icon: '🧀', title: 'Trivial politique',
    rule: 'Lancez le dé, répondez à la question de la couleur tirée : chaque bonne réponse vous rapporte un camembert. Six à gagner.',
  },
  {
    id: 'quiz_tele', kind: 'quiz', icon: '🎬', title: 'Questions pour un·e élu·e',
    rule: 'Le grand quiz de la rentrée politique : une bonne réponse, un camembert. Les candidats adverses guettent vos erreurs.',
  },
  {
    id: 'concours_insp', kind: 'quiz', icon: '🎓', title: 'Le concours de l’INSP',
    rule: 'Épreuve de culture générale : il faut au moins « Réussi » pour être reçu·e, « Brillant » pour les grands corps.',
  },
  {
    id: 'protocole', kind: 'protocole', icon: '🎖️', title: 'La cérémonie',
    rule: 'Le chef du protocole vous montre l’ordre des gestes : retenez-le, puis reproduisez-le sans faux pas.',
    steps: [
      { icon: '🇫🇷', label: 'Lever des couleurs' }, { icon: '💐', label: 'Dépôt de gerbe' }, { icon: '🎺', label: 'Sonnerie aux morts' },
      { icon: '🤫', label: 'Minute de silence' }, { icon: '🎖️', label: 'Remise de décoration' }, { icon: '🎵', label: 'La Marseillaise' },
    ],
  },
  {
    id: 'visite_etat', kind: 'protocole', icon: '🤝', title: 'Visite d’État',
    rule: 'Un chef d’État étranger arrive : l’ordre des honneurs est sacré. Observez, puis enchaînez.',
    steps: [
      { icon: '🚗', label: 'Accueil sur le perron' }, { icon: '🎺', label: 'Hymnes nationaux' }, { icon: '💂', label: 'Revue de la garde' },
      { icon: '🤝', label: 'Poignée de main' }, { icon: '📸', label: 'Photo officielle' }, { icon: '✍️', label: 'Livre d’or' },
    ],
  },
  {
    id: 'plan_table', kind: 'table', icon: '🍽️', title: 'Le dîner d’État',
    rule: 'Placez les huit convives : les affinités côte à côte, les inimitiés loin l’une de l’autre.',
    guests: [
      { icon: '🎩', name: 'L’ambassadeur' }, { icon: '👩‍💼', name: 'La ministre' }, { icon: '💼', name: 'Le PDG' }, { icon: '✊', name: 'La syndicaliste' },
      { icon: '⛪', name: 'L’évêque' }, { icon: '👨‍🍳', name: 'Le chef étoilé' }, { icon: '🎬', name: 'L’actrice' }, { icon: '📰', name: 'La directrice de journal' },
      { icon: '🎖️', name: 'Le général' }, { icon: '🔬', name: 'La prix Nobel' },
    ],
  },
  {
    id: 'banquet_maires', kind: 'table', icon: '🥖', title: 'Le banquet des maires',
    rule: 'Les maires du département à votre table : éloignez les brouillés, rapprochez les alliés.',
    guests: [
      { icon: '🌾', name: 'Le maire rural' }, { icon: '🏙️', name: 'La maire de la ville-centre' }, { icon: '🏔️', name: 'Le maire de montagne' },
      { icon: '🏖️', name: 'La maire du littoral' }, { icon: '🍷', name: 'Le maire vigneron' }, { icon: '🏭', name: 'La maire ouvrière' },
      { icon: '🚜', name: 'Le syndic agricole' }, { icon: '🎓', name: 'La sénatrice' }, { icon: '📻', name: 'Le correspondant local' },
    ],
  },
  {
    id: 'interception', kind: 'interception', icon: '📡', title: 'La défense antiaérienne',
    rule: 'Interceptez les missiles avant qu’ils n’atteignent les villes. Surtout, épargnez les avions civils.', bad: '🚀', good: '✈️',
  },
  {
    id: 'deminage', kind: 'deminage', icon: '💣', title: 'Le déminage',
    rule: 'Ouvrez toutes les cases sûres : chaque chiffre indique le nombre de munitions autour. Balisez-les, n’y touchez pas.', bad: '💣',
  },
  {
    id: 'consultation', kind: 'tri', icon: '🗳️', title: 'Consultation citoyenne',
    rule: 'Retenez les propositions sérieuses, écartez les farfelues, sous l’œil des participants.', left: 'Écarter', right: 'Retenir',
    items: [
      { text: 'Une navette gratuite le samedi vers le marché', side: 'droite' },
      { text: 'Remplacer le maire par un tirage au sort quotidien', side: 'gauche' },
      { text: 'Des composteurs collectifs dans chaque quartier', side: 'droite' },
      { text: 'Interdire la pluie le week-end', side: 'gauche' },
      { text: 'Rouvrir la piscine municipale l’été', side: 'droite' },
      { text: 'Un téléphérique vers la boulangerie', side: 'gauche' },
      { text: 'Un budget participatif pour les écoles', side: 'droite' },
      { text: 'Rebaptiser la commune du nom d’un influenceur', side: 'gauche' },
      { text: 'Des bancs et de l’ombre sur la place', side: 'droite' },
      { text: 'Une statue géante de votre chat', side: 'gauche' },
      { text: 'Éclairer le chemin de la gare', side: 'droite' },
      { text: 'Supprimer les lundis', side: 'gauche' },
    ],
  },
];

export const MINIGAMES_BY_ID = new Map(MINIGAMES.map(m => [m.id, m]));

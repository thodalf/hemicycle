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
      { text: 'Une infirmière libérale menacée d’expulsion', side: 'droite' },
      { text: 'Catalogue de vins primeurs « offert aux élus »', side: 'gauche' },
      { text: 'Des parents d’élèves réclament un passage piéton', side: 'droite' },
      { text: 'Lettre de onze pages en majuscules sur les extraterrestres', side: 'gauche' },
      { text: 'Une PME locale bloquée par un retard de paiement de l’État', side: 'droite' },
      { text: 'Invitation à un séminaire « gratuit » aux Bahamas', side: 'gauche' },
      { text: 'Un agriculteur sinistré par la grêle attend son indemnisation', side: 'droite' },
      { text: 'Carte postale anonyme : « On sait où vous habitez »', side: 'gauche' },
      { text: 'Un club de foot amateur sans vestiaires', side: 'droite' },
      { text: 'Prospectus pour une voyance par téléphone', side: 'gauche' },
      { text: 'Une famille réfugiée cherche une école pour ses enfants', side: 'droite' },
      { text: 'Pétition pour renommer la rue en l’honneur d’un chien célèbre', side: 'gauche' },
      { text: 'Un handicapé attend l’aménagement de son logement depuis un an', side: 'droite' },
      { text: 'Offre de « prêt immédiat sans justificatif »', side: 'gauche' },
      { text: 'La bibliothèque municipale va fermer le samedi', side: 'droite' },
      { text: 'Demande de dédicace de votre photo officielle pour la revendre', side: 'gauche' },
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
      { text: 'Pourquoi la maternité de Die est-elle fermée la nuit ?', side: 'droite' },
      { text: '« Avez-vous un compte en Suisse, oui ou non ? »', side: 'gauche' },
      { text: 'Quand la prime de rénovation énergétique sera-t-elle versée ?', side: 'droite' },
      { text: '« Votre parti est-il au bord de l’implosion ? »', side: 'gauche' },
      { text: 'Que prévoit le gouvernement contre la pénurie de médecins scolaires ?', side: 'droite' },
      { text: '« Qui vous a écrit cette réponse ? »', side: 'gauche' },
      { text: 'Les agriculteurs bio vont-ils toucher les aides promises ?', side: 'droite' },
      { text: '« Regrettez-vous votre vote de 2019 ? »', side: 'gauche' },
      { text: 'Comment financer la rénovation des ponts dégradés ?', side: 'droite' },
      { text: '« Avez-vous lu le rapport que vous citez ? »', side: 'gauche' },
      { text: 'Quelles mesures contre la hausse des loyers étudiants ?', side: 'droite' },
      { text: '« Démissionnerez-vous si la loi échoue ? »', side: 'gauche' },
      { text: 'Où en est le plan de lutte contre les violences intrafamiliales ?', side: 'droite' },
      { text: '« Combien de jours avez-vous passé dans votre circonscription ? »', side: 'gauche' },
      { text: 'Le tribunal de Guéret va-t-il fermer ?', side: 'droite' },
      { text: '« Le Président vous fait-il encore confiance ? »', side: 'gauche' },
      { text: 'Quel soutien pour les commerces de centre-ville ?', side: 'droite' },
      { text: '« Que répondez-vous aux sifflets de vos propres troupes ? »', side: 'gauche' },
      { text: 'Comment réduire l’attente aux urgences pédiatriques ?', side: 'droite' },
      { text: '« Votre ancien conseiller vous accuse : il ment ? »', side: 'gauche' },
      { text: 'Les lignes TER supprimées seront-elles rétablies ?', side: 'droite' },
      { text: '« Êtes-vous de gauche ou de droite, au fond ? »', side: 'gauche' },
      { text: 'Quelle stratégie face aux sécheresses à répétition ?', side: 'droite' },
      { text: '« Avez-vous déjà fumé du cannabis ? »', side: 'gauche' },
      { text: 'Que fait l’État pour les victimes des inondations du Pas-de-Calais ?', side: 'droite' },
      { text: '« Votre voiture de fonction est-elle électrique ? »', side: 'gauche' },
      { text: 'Comment protéger les élus locaux menacés ?', side: 'droite' },
      { text: '« On vous dit en froid avec le Premier ministre… »', side: 'gauche' },
      { text: 'Quel calendrier pour l’ouverture des nouvelles places en EHPAD ?', side: 'droite' },
      { text: '« Votre réponse tient-elle en un tweet ? »', side: 'gauche' },
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
      { text: 'Comment je fais pour contacter votre permanence ?', side: 'droite' },
      { text: '🤡🤡🤡🤡', side: 'gauche' },
      { text: 'Votre avis sur la fermeture de la maternité ?', side: 'droite' },
      { text: '« Tous les mêmes, tous pourris »', side: 'gauche' },
      { text: 'Vous soutenez les infirmières en grève ?', side: 'droite' },
      { text: 'Spam : « Crypto x100 garanti, DM moi »', side: 'gauche' },
      { text: 'Que comptez-vous faire pour les pistes cyclables ?', side: 'droite' },
      { text: '« Réponds si t’es un homme/une femme »', side: 'gauche' },
      { text: 'Ma commune n’a plus de médecin depuis 2 ans, aidez-nous', side: 'droite' },
      { text: 'GIF d’un chat qui tombe d’une table', side: 'gauche' },
      { text: 'Vous êtes pour ou contre le péage urbain ?', side: 'droite' },
      { text: '« Ton costume coûte combien ? 👀 »', side: 'gauche' },
      { text: 'Une aide existe pour l’isolation des logements anciens ?', side: 'droite' },
      { text: 'Photo truquée de vous avec un dictateur', side: 'gauche' },
      { text: 'Pourquoi le bus de nuit a-t-il été supprimé ?', side: 'droite' },
      { text: '« Ratio + flop + t’es nul·le »', side: 'gauche' },
      { text: 'Quelle est votre position sur la semaine de quatre jours ?', side: 'droite' },
      { text: 'Compte créé hier : « Fuite exclusive sur votre vie privée »', side: 'gauche' },
      { text: 'Merci pour votre intervention sur les retraites agricoles 🙏', side: 'droite' },
      { text: '« Qui paie tes pubs ? Les lobbies ? »', side: 'gauche' },
      { text: 'Le collège de mon fils manque de profs de maths', side: 'droite' },
      { text: 'Chaîne : « Partage ou sept ans de malheur »', side: 'gauche' },
      { text: 'Vous serez au forum des associations ?', side: 'droite' },
      { text: '« Je vote pour toi si tu me suis en retour »', side: 'gauche' },
      { text: 'Comment lutter contre la désertification des villages ?', side: 'droite' },
      { text: 'Mème de vous endormi·e à l’Assemblée', side: 'gauche' },
      { text: 'Une réponse sur les frais de cantine qui augmentent ?', side: 'droite' },
      { text: '« Supprime ton compte »', side: 'gauche' },
      { text: 'Quelles aides pour les aidants familiaux ?', side: 'droite' },
      { text: 'Lien raccourci suspect : « regarde ce qu’ils disent de toi »', side: 'gauche' },
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
      { text: 'Faut-il taxer davantage les très hauts revenus ?', side: 'droite' },
      { text: '« Avez-vous pleuré le soir de votre défaite ? »', side: 'gauche' },
      { text: 'Que proposez-vous contre les déserts médicaux ?', side: 'droite' },
      { text: '« Un mot pour qualifier votre chef de parti ? »', side: 'gauche' },
      { text: 'Comment ramener les jeunes vers les urnes ?', side: 'droite' },
      { text: '« Quel est le prix d’un ticket de métro ? »', side: 'gauche' },
      { text: 'Faut-il construire de nouveaux réacteurs nucléaires ?', side: 'droite' },
      { text: '« Vous sentez-vous trahi·e par vos amis ? »', side: 'gauche' },
      { text: 'Quelle réponse à la crise du logement étudiant ?', side: 'droite' },
      { text: '« Votre plus grand défaut, en une seconde ! »', side: 'gauche' },
      { text: 'L’Europe doit-elle se doter d’une défense commune ?', side: 'droite' },
      { text: '« Vous avez vu ce qu’on dit de vous sur les réseaux ? »', side: 'gauche' },
      { text: 'Comment soutenir les petits commerces face aux plateformes ?', side: 'droite' },
      { text: '« Allez-vous vous présenter contre votre mentor ? »', side: 'gauche' },
      { text: 'Que faire pour les urgences saturées l’été ?', side: 'droite' },
      { text: '« C’est vrai que vous dormez quatre heures par nuit ? »', side: 'gauche' },
      { text: 'Faut-il revaloriser le salaire des enseignants ?', side: 'droite' },
      { text: '« Votre conjoint·e vote-t-il·elle pour vous ? »', side: 'gauche' },
      { text: 'Quelle place pour l’agriculture dans la transition écologique ?', side: 'droite' },
      { text: '« Combien gagnez-vous exactement ? »', side: 'gauche' },
      { text: 'Le service national universel doit-il devenir obligatoire ?', side: 'droite' },
      { text: '« Qui sera Premier ministre dans six mois ? »', side: 'gauche' },
      { text: 'Comment rendre la justice plus rapide ?', side: 'droite' },
      { text: '« Vous êtes-vous déjà endormi·e en séance ? »', side: 'gauche' },
      { text: 'Faut-il limiter les écrans à l’école ?', side: 'droite' },
      { text: '« Que pensez-vous du dernier film de votre rival ? »', side: 'gauche' },
      { text: 'Quel avenir pour les petites lignes ferroviaires ?', side: 'droite' },
      { text: '« Vous avez une ambition présidentielle, admettez-le ! »', side: 'gauche' },
      { text: 'Comment lutter contre la fraude fiscale ?', side: 'droite' },
      { text: '« Votre cravate / votre veste, un message politique ? »', side: 'gauche' },
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

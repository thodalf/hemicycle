import { MOTS_DU_JOUR } from './mots';
/* ============================================================
 *  Mini-jeux : dix mécaniques, déclinées en thèmes.
 *  Le score (0 à 1) décide de l'ampleur des gains de l'action
 *  ou de l'événement qui les déclenche.
 * ============================================================ */

export type MinigameKind = 'poignees' | 'applaudimetre' | 'memoire' | 'tri' | 'marchandage' | 'pointage' | 'tournee' | 'mot' | 'grille' | 'quiz' | 'protocole' | 'table' | 'interception' | 'deminage' | 'interview' | 'cmp' | 'sommet' | 'visite' | 'train' | 'cortege' | 'valise' | 'majorite' | 'standard' | 'plume' | 'factcheck' | 'investitures' | 'arbitrage' | 'citations' | 'lecture' | 'securite' | 'interprete' | 'frondeurs' | 'rabot' | 'prenoms' | 'agenda' | 'prompteur' | 'chiffrage' | 'depouillement' | 'tactique' | 'portrait' | 'cellule' | 'infiltration' | 'campagne' | 'enquete' | 'urbanisme' | 'echiquier' | 'navette' | 'une' | 'reseau';

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
  /** Sommet : le format (Conseil européen, G20, climat) */
  summit?: 'ue' | 'g20' | 'climat';
  /** Grille : la base de données (villes, métro, capitales) */
  grid?: 'villes' | 'metro' | 'capitales';
  /** Mot : un seul mot par jour réel (mot du jour) */
  daily?: boolean;
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
      { text: 'Quand le pont de Mirepoix sera-t-il réparé ?', side: 'droite' },
      { text: '« Avez-vous menti à la commission d’enquête ? »', side: 'gauche' },
      { text: 'Quels moyens pour les pompiers volontaires ?', side: 'droite' },
      { text: '« Votre chef de cabinet est-il votre cousin ? »', side: 'gauche' },
      { text: 'Comment lutter contre la vie chère outre-mer ?', side: 'droite' },
      { text: '« Pourquoi riez-vous ? C’est grave ! »', side: 'gauche' },
      { text: 'Les petites retraites agricoles seront-elles revalorisées ?', side: 'droite' },
      { text: '« Vous avez lu votre propre projet de loi ? »', side: 'gauche' },
      { text: 'Que faire contre les rodéos urbains ?', side: 'droite' },
      { text: '« Votre ministre de tutelle vous a-t-il prévenu·e ? »', side: 'gauche' },
      { text: 'Quel avenir pour la centrale de Cordemais ?', side: 'droite' },
      { text: '« Combien de collaborateurs avez-vous recrutés ? »', side: 'gauche' },
      { text: 'Comment accélérer les délais de justice ?', side: 'droite' },
      { text: '« Est-ce votre dernier mandat, promis ? »', side: 'gauche' },
      { text: 'Que prévoyez-vous pour les aidants familiaux ?', side: 'droite' },
      { text: '« Allez-vous enfin répondre à la question ? »', side: 'gauche' },
      { text: 'Les crédits de la recherche seront-ils sanctuarisés ?', side: 'droite' },
      { text: '« Votre parti vous a-t-il lâché·e ? »', side: 'gauche' },
      { text: 'Quelles aides contre la fermeture des boulangeries rurales ?', side: 'droite' },
      { text: '« C’est vrai que vous visez Matignon ? »', side: 'gauche' },
      { text: 'Quand les trains de nuit reviendront-ils ?', side: 'droite' },
      { text: '« Qui écrit vos tweets ? »', side: 'gauche' },
      { text: 'Comment protéger le littoral de l’érosion ?', side: 'droite' },
      { text: '« Votre absence au vote d’hier, une stratégie ? »', side: 'gauche' },
      { text: 'Quels moyens pour la psychiatrie publique ?', side: 'droite' },
      { text: '« Vous sentez-vous visé·e par la tribune de ce matin ? »', side: 'gauche' },
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
      { text: 'Comment voter par procuration ?', side: 'droite' },
      { text: '« lol t’as vu ta tête »', side: 'gauche' },
      { text: 'Vous défendez quoi pour les apprentis ?', side: 'droite' },
      { text: '« Parle-nous plutôt de ta piscine »', side: 'gauche' },
      { text: 'Le RER est en panne tous les matins, vous comptez agir ?', side: 'droite' },
      { text: 'Compte parodique qui vous imite', side: 'gauche' },
      { text: 'Une aide pour créer mon entreprise ?', side: 'droite' },
      { text: '« Abonne-toi à ma chaîne »', side: 'gauche' },
      { text: 'Pourquoi la poste du village ferme ?', side: 'droite' },
      { text: 'Capture d’écran truquée d’un faux tweet de vous', side: 'gauche' },
      { text: 'Quelle position sur les éoliennes en mer ?', side: 'droite' },
      { text: '« Tous des lézards, réveillez-vous »', side: 'gauche' },
      { text: 'Merci d’être venu·e à notre AG hier !', side: 'droite' },
      { text: 'Pluie d’émojis caca', side: 'gauche' },
      { text: 'Que faire contre le harcèlement scolaire ?', side: 'droite' },
      { text: '« Et Epstein alors ? »', side: 'gauche' },
      { text: 'Ma pharmacie est en rupture de médicaments', side: 'droite' },
      { text: '« Bloque-moi si t’oses »', side: 'gauche' },
      { text: 'Quand reprennent les travaux du collège ?', side: 'droite' },
      { text: '« Qui te paie pour dire ça ? »', side: 'gauche' },
      { text: 'Une proposition pour les déserts numériques ?', side: 'droite' },
      { text: 'Message en majuscules de 2 000 caractères', side: 'gauche' },
      { text: 'Vous êtes pour le service civique obligatoire ?', side: 'droite' },
      { text: '« Ratio »', side: 'gauche' },
      { text: 'Comment avez-vous voté sur la loi logement ?', side: 'droite' },
      { text: 'Faux sondage « 98 % veulent votre démission »', side: 'gauche' },
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
    id: 'negociation_coalition', kind: 'marchandage', icon: '🏛️', title: 'Négociation de coalition',
    rule: 'Combien de ministères céder au partenaire ? Au-dessous de son exigence, il quitte la table ; au-dessus, votre parti crie à la trahison. Cinq offres au plus.',
    who: 'Le partenaire', unit: 'ministères', min: 0, max: 14,
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
    id: 'conference_presse', kind: 'tri', icon: '🎤', title: 'Conférence de presse',
    rule: 'Vingt journalistes, une salle comble : répondez aux questions de fond, éludez les pièges et les questions personnelles.', left: 'Éluder', right: 'Répondre',
    items: [
      { text: 'Quel est le calendrier de votre réforme ?', side: 'droite' },
      { text: '« Votre divorce a-t-il pesé sur votre décision ? »', side: 'gauche' },
      { text: 'Combien coûtera la mesure, et qui paiera ?', side: 'droite' },
      { text: '« Vous êtes-vous fâché·e avec le président ? »', side: 'gauche' },
      { text: 'Quelles concertations avec les syndicats ?', side: 'droite' },
      { text: '« Est-il vrai que vous pleurez en réunion ? »', side: 'gauche' },
      { text: 'Que dites-vous aux salariés inquiets ?', side: 'droite' },
      { text: '« Votre ancien associé parle de vous dans un livre… »', side: 'gauche' },
      { text: 'Quel impact sur les collectivités locales ?', side: 'droite' },
      { text: '« Vous avez un mot pour votre ex ? »', side: 'gauche' },
      { text: 'Les régions d’outre-mer sont-elles concernées ?', side: 'droite' },
      { text: '« Qui a payé votre costume ? »', side: 'gauche' },
      { text: 'Quelle évaluation est prévue ?', side: 'droite' },
      { text: '« Avez-vous un plan B si ça échoue ? Vous démissionnerez ? »', side: 'gauche' },
      { text: 'Quel lien avec la directive européenne ?', side: 'droite' },
      { text: '« Pourquoi votre femme / mari n’est jamais là ? »', side: 'gauche' },
      { text: 'Que répondez-vous à l’opposition ?', side: 'droite' },
      { text: '« Vous pensez à 2032 en vous rasant ? »', side: 'gauche' },
      { text: 'Combien d’emplois attendus ?', side: 'droite' },
      { text: '« Vous avez vu la caricature de ce matin ? »', side: 'gauche' },
      { text: 'Quelle place pour les associations ?', side: 'droite' },
      { text: '« Vous êtes fâché·e avec votre mère ? »', side: 'gauche' },
      { text: 'Quand les premiers effets seront-ils visibles ?', side: 'droite' },
      { text: '« Une rumeur dit que vous allez être limogé·e… »', side: 'gauche' },
      { text: 'Comment les PME seront-elles accompagnées ?', side: 'droite' },
      { text: '« Votre religion influence-t-elle votre vote ? »', side: 'gauche' },
      { text: 'Quelles garanties pour les données personnelles ?', side: 'droite' },
      { text: '« Votre chien a-t-il vraiment mordu un ministre ? »', side: 'gauche' },
    ],
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
      { text: 'Faut-il un ministère de la mer ?', side: 'droite' },
      { text: '« Vous avez déjà pris le métro, vraiment ? »', side: 'gauche' },
      { text: 'Comment financer la dépendance ?', side: 'droite' },
      { text: '« Êtes-vous de mauvaise humeur ce matin ? »', side: 'gauche' },
      { text: 'Quelle réponse à la crise des urgences vétérinaires rurales ?', side: 'droite' },
      { text: '« Qui préférez-vous : votre chef ou votre rival ? »', side: 'gauche' },
      { text: 'Le nucléaire est-il compatible avec la sécheresse ?', side: 'droite' },
      { text: '« Votre plus gros mensonge en politique ? »', side: 'gauche' },
      { text: 'Faut-il interdire les jets privés ?', side: 'droite' },
      { text: '« Vous avez pleuré au dernier bureau politique ? »', side: 'gauche' },
      { text: 'Comment rendre l’école plus juste ?', side: 'droite' },
      { text: '« Votre surnom à l’Assemblée, c’est quoi ? »', side: 'gauche' },
      { text: 'Quelle place pour la police municipale ?', side: 'droite' },
      { text: '« Vous aimeriez être président·e, oui ou non ? »', side: 'gauche' },
      { text: 'Faut-il taxer les superprofits ?', side: 'droite' },
      { text: '« Votre téléphone a-t-il été piraté ? »', side: 'gauche' },
      { text: 'Comment sauver les petits commerces ?', side: 'droite' },
      { text: '« Le salaire de votre conjoint·e ? »', side: 'gauche' },
      { text: 'Quelle politique pour les forêts après les incendies ?', side: 'droite' },
      { text: '« Vous regrettez votre tweet d’hier ? »', side: 'gauche' },
      { text: 'L’Europe doit-elle s’élargir ?', side: 'droite' },
      { text: '« Vous dormez avec votre téléphone ? »', side: 'gauche' },
      { text: 'Comment attirer des médecins dans les campagnes ?', side: 'droite' },
      { text: '« Une rumeur de remaniement vous concerne ? »', side: 'gauche' },
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
    id: 'mot_du_jour', kind: 'mot', icon: '🔤', title: 'Le mot du jour', daily: true,
    rule: 'Un mot par jour, le même pour tout le monde, pas forcément politique : six essais pour le trouver. Rouge : bonne lettre bien placée ; jaune : bonne lettre mal placée. Une seule partie par jour.',
    words: MOTS_DU_JOUR,
  },
  {
    id: 'motus_tele', kind: 'mot', icon: '📺', title: 'Le jeu télévisé',
    rule: 'Le présentateur vous tend la première lettre : six essais pour trouver le mot, sous les yeux de la France entière.',
    words: [...MOTS_DU_JOUR, ...POLITICAL_WORDS],
  },
  {
    id: 'departodoku', kind: 'grille', icon: '🗺️', title: 'Villodoku', grid: 'villes',
    rule: 'Remplissez la grille : chaque case attend une ville de France qui vérifie sa ligne et sa colonne. Une ville ne sert qu’une fois. Plus la réponse est rare, plus elle rapporte de points.',
  },
  {
    id: 'interro_carte', kind: 'grille', icon: '🎙️', title: 'L’interro surprise', grid: 'villes',
    rule: 'Le journaliste vous teste en direct sur la carte de France : une ville par case, sans vous tromper trop souvent.',
  },
  {
    id: 'sommet_ue', kind: 'sommet', icon: '🇪🇺', title: 'Conseil européen', summit: 'ue',
    rule: 'Négociez le texte article par article jusqu’à l’aube : défendez les intérêts de la France (🇫🇷), mais sans unanimité, pas d’accord. Trois apartés possibles pour amadouer un dirigeant.',
  },
  {
    id: 'sommet_g20', kind: 'sommet', icon: '🌐', title: 'Sommet du G20', summit: 'g20',
    rule: 'Un communiqué final à arracher, article par article, avant six heures du matin. Chaque dirigeant a ses lignes rouges.',
  },
  {
    id: 'sommet_climat', kind: 'sommet', icon: '🌡️', title: 'Conférence sur le climat', summit: 'climat',
    rule: 'Un accord mondial sur le climat : ambition pour la planète et pour la France, mais un seul pays fâché suffit à tout bloquer.',
  },
  {
    id: 'correspondances', kind: 'train', icon: '🚄', title: 'La journée en train',
    rule: 'Trois rendez-vous, trois trajets : choisissez vos trains entre vitesse, prix et fiabilité. Un retard peut faire sauter une correspondance.',
  },
  {
    id: 'cortege_paris', kind: 'cortege', icon: '🚗', title: 'Le cortège dans Paris',
    rule: 'Rejoignez l’Élysée à travers les rues : contournez travaux et manifestations, qui se déplacent à chaque carrefour.',
  },
  {
    id: 'cortege_province', kind: 'cortege', icon: '🚙', title: 'Course contre la montre en préfecture',
    rule: 'La réunion de crise commence sans vous : traversez la ville jusqu’à la préfecture avant la fin du compte à rebours.',
  },
  {
    id: 'valise_voyage', kind: 'valise', icon: '🧳', title: 'La valise du déplacement',
    rule: 'Lisez le programme, puis remplissez la valise : ce qui servira vraiment, dans la limite du poids.',
  },
  {
    id: 'arithmetique_majorite', kind: 'majorite', icon: '🧮', title: 'L’arithmétique de la majorité',
    rule: 'Réunissez 289 sièges avec les groupes de l’hémicycle, en gardant la coalition la plus cohérente possible.',
  },
  {
    id: 'standard_ministere', kind: 'standard', icon: '☎️', title: 'Le standard qui explose',
    rule: 'Chaque appel au bon ministère, le plus vite possible : si la file d’attente déborde, le standard saute.',
  },
  {
    id: 'plume_discours', kind: 'plume', icon: '✒️', title: 'La plume',
    rule: 'Remettez le discours dans l’ordre : accroche, constat, cause, proposition, appel final.',
  },
  {
    id: 'factcheck_direct', kind: 'factcheck', icon: '🔎', title: 'Le fact-checking en direct',
    rule: 'Huit affirmations entendues sur les plateaux : vraies, fausses, ou trompeuses ? Répondez avant la fin du chrono.',
  },
  {
    id: 'commission_investitures', kind: 'investitures', icon: '🗳️', title: 'La commission d’investiture',
    rule: 'Placez chaque candidat·e dans la circonscription qui lui ressemble : chaque étiquette commune fait gagner des voix.',
  },
  {
    id: 'arbitrage_budgetaire', kind: 'arbitrage', icon: '⚖️', title: 'L’arbitrage budgétaire',
    rule: 'Partagez l’enveloppe entre cinq services : chacun a un plancher à ne pas franchir et un souhait à approcher. Il n’y en aura pas pour tout le monde.',
  },
  {
    id: 'qui_a_dit', kind: 'citations', icon: '💬', title: 'Qui a dit ça ?',
    rule: 'Reliez chaque citation historique à son auteur. Un auteur est en trop, et chaque erreur coûte des points.',
  },
  {
    id: 'decrypter_sondage', kind: 'lecture', icon: '📊', title: 'Décrypter un sondage',
    rule: 'Un sondage tombe en direct : lisez les chiffres, la marge d’erreur et les électorats avant de les commenter.',
  },
  {
    id: 'plan_securite', kind: 'securite', icon: '👮', title: 'Le plan de sécurité',
    rule: 'Placez vos équipes sur le parcours : chacune couvre sa case et les cases voisines. Couvrez le plus de risque possible.',
  },
  {
    id: 'interprete', kind: 'interprete', icon: '🗣️', title: 'L’interprète',
    rule: 'Votre homologue parle anglais, allemand, espagnol ou italien : choisissez la bonne traduction avant la fin du chrono.',
  },
  {
    id: 'reperer_frondeurs', kind: 'frondeurs', icon: '🕵️', title: 'Repérer les frondeurs',
    rule: 'Les votes défilent : touchez « Frondeur ! » quand un député de votre groupe vote contre ou s’abstient. Les fausses alertes coûtent cher.',
  },
  {
    id: 'coup_de_rabot', kind: 'rabot', icon: '✂️', title: 'Le coup de rabot',
    rule: 'Atteignez les économies demandées en choisissant les lignes à couper. Moins vous fâchez de monde, meilleur est le budget.',
  },
  {
    id: 'marche_prenoms', kind: 'prenoms', icon: '🤝', title: 'Le bain de foule',
    rule: 'Retenez les prénoms et les métiers des gens que vous croisez, puis saluez chacun par son prénom.',
  },
  {
    id: 'agenda_impossible', kind: 'agenda', icon: '🗓️', title: 'L’agenda impossible',
    rule: 'Casez chaque rendez-vous sur un créneau en respectant sa contrainte (le matin, après tel autre rendez-vous…).',
  },
  {
    id: 'prompteur_sabote', kind: 'prompteur', icon: '📜', title: 'Le prompteur saboté',
    rule: 'Un mot a été changé dans chaque phrase du prompteur : touchez-le avant de le prononcer en direct.',
  },
  {
    id: 'chiffrage_mesure', kind: 'chiffrage', icon: '🧮', title: 'Le chiffrage',
    rule: 'Cinq calculs de tête avant l’annonce : coût d’une mesure, économies, voix… Choisissez le bon chiffre avant la fin du chrono.',
  },
  {
    id: 'chiffrage', kind: 'chiffrage', icon: '🧮', title: 'Le chiffrage du plan',
    rule: 'Chaque poste du plan doit être chiffré de tête : choisissez le bon montant avant la fin du chrono.',
  },
  {
    id: 'depouillement', kind: 'depouillement', icon: '🗳️', title: 'Le dépouillement',
    rule: 'L’assesseur lit les bulletins un à un : comptez de tête ceux de votre liste, puis donnez votre total.',
  },
  {
    id: 'bataille', kind: 'tactique', icon: '⚔️', title: 'La bataille',
    rule: 'Au tour par tour : déplacez chaque unité puis attaquez. Forêts et villes protègent, la rivière ne se passe qu’aux gués, l’artillerie tire loin. Tenez les villes ou mettez l’ennemi en déroute en huit tours.',
  },
  {
    id: 'bataille_navale', kind: 'tactique', icon: '🏴‍☠️', title: 'La bataille navale',
    rule: 'Au tour par tour : frégates, patrouilleurs, hélicoptère et sous-marin contre la flottille pirate. Reprenez les ports et coulez les vedettes en huit tours.',
  },
  {
    id: 'defense_zombies', kind: 'tactique', icon: '🧟', title: 'La nuit des refuges',
    rule: 'Au tour par tour : gendarmes, pompiers et tireurs d’élite doivent tenir les refuges jusqu’à l’aube. Les morts-vivants sont lents, mais ils ne cessent d’affluer.',
  },
  {
    id: 'sacre', kind: 'protocole', icon: '👑', title: 'Le sacre',
    rule: 'Le grand maître des cérémonies vous montre l’ordre du sacre : retenez-le, puis accomplissez chaque rite sans faux pas, sous les yeux du monde entier.',
    steps: [
      { icon: '🚪', label: 'Entrée dans la cathédrale' }, { icon: '🙏', label: 'Le serment au peuple' }, { icon: '🫙', label: 'L’onction' },
      { icon: '🗡️', label: 'La remise de l’épée' }, { icon: '⚜️', label: 'Le sceptre et la main de justice' }, { icon: '👑', label: 'Le couronnement' },
      { icon: '🪑', label: 'L’intronisation' }, { icon: '🔔', label: 'Les cloches et le Te Deum' },
    ],
  },
  {
    id: 'grand_bal', kind: 'table', icon: '💃', title: 'Le grand bal de la Cour',
    rule: 'Le plan de table du souper : la vieille noblesse, les nouveaux riches et les ambitieux. Rapprochez les alliés, séparez les familles brouillées depuis trois siècles.',
    guests: [
      { icon: '🦚', name: 'La duchesse douairière' }, { icon: '🏹', name: 'Le marquis légitimiste' }, { icon: '💎', name: 'La comtesse du CAC 40' },
      { icon: '🎻', name: 'Le prince mélomane' }, { icon: '🐎', name: 'Le baron des haras' }, { icon: '📜', name: 'La vicomtesse historienne' },
      { icon: '🍾', name: 'Le chevalier du champagne' }, { icon: '🎭', name: 'L’ambassadrice de Monaco' }, { icon: '⛪', name: 'Le cardinal' },
      { icon: '🏰', name: 'Le châtelain ruiné' },
    ],
  },
  {
    id: 'audiences_jeudi', kind: 'tri', icon: '📜', title: 'Les audiences du jeudi',
    rule: 'Chaque jeudi, les sujets présentent leurs doléances au souverain. Accordez votre attention aux causes justes, renvoyez les caprices et les intrigants.', left: 'Renvoyer', right: 'Entendre',
    items: [
      { text: 'Une infirmière réclame des renforts pour son service de nuit', side: 'droite' },
      { text: 'Un baron exige le rétablissement du droit de chasse sur les terres voisines', side: 'gauche' },
      { text: 'Un village de montagne n’a plus de médecin depuis deux ans', side: 'droite' },
      { text: 'Une marquise souhaite un titre pour son caniche', side: 'gauche' },
      { text: 'Des ouvriers d’une usine menacée de fermeture', side: 'droite' },
      { text: 'Un courtisan demande la place de son rival à la Cour', side: 'gauche' },
      { text: 'Une maire rurale plaide pour sa ligne de train', side: 'droite' },
      { text: 'Un promoteur veut construire un golf dans un parc royal', side: 'gauche' },
      { text: 'Une famille sinistrée par les inondations attend toujours ses indemnités', side: 'droite' },
      { text: 'Un influenceur réclame un selfie au balcon', side: 'gauche' },
      { text: 'Des lycéens présentent une pétition pour le climat', side: 'droite' },
      { text: 'Un duc veut faire interdire la baguette industrielle', side: 'gauche' },
    ],
  },
  {
    id: 'portrait_officiel', kind: 'portrait', icon: '🖼️', title: 'Le portrait officiel',
    rule: 'Le peintre de la Cour attend vos instructions : pose, costume, décor, regard, attribut. Lisez la commande du chambellan et composez le portrait que le pays attend.',
  },
  {
    id: 'cellule_feux', kind: 'cellule', icon: '🔥', title: 'La cellule de crise : méga-feux',
    rule: 'Au tour par tour, le feu avance avec le vent : pompiers, Canadair, coupe-feu et évacuations pour sauver un maximum de villages en neuf tours.',
  },
  {
    id: 'cellule_crue', kind: 'cellule', icon: '🌊', title: 'La cellule de crise : la crue',
    rule: 'La rivière déborde et l’eau gagne tout ce qui est plus bas que la cote : digues, pompes, bassins de rétention et évacuations pour protéger les villes.',
  },
  {
    id: 'cellule_epidemie', kind: 'cellule', icon: '🦠', title: 'La cellule de crise : l’épidémie',
    rule: 'Le virus progresse de district en district et le long des lignes de transport : testez, vaccinez, confinez et soignez pour épargner la population en dix tours.',
  },
  {
    id: 'infiltration_ministere', kind: 'infiltration', icon: '🕵️', title: 'L’infiltration du ministère',
    rule: 'Au tour par tour, traversez trois étages du ministère endormi sans croiser le regard des agents, récupérez le dossier et ressortez avant l’aube.',
  },
  {
    id: 'infiltration_ambassade', kind: 'infiltration', icon: '✉️', title: 'La réception à l’ambassade',
    rule: 'Pendant la réception, glissez-vous entre serveurs, gardes et invités pour déposer votre message sur le bureau de l’ambassadeur, sans éveiller les soupçons.',
  },
  {
    id: 'infiltration_catacombes', kind: 'infiltration', icon: '🔦', title: 'Les galeries sous Paris',
    rule: 'Dans les anciennes carrières, évitez les lampes de la patrouille et les cataphiles pour retrouver la salle oubliée, puis remontez à la surface.',
  },
  {
    id: 'campagne_presidentielle', kind: 'campagne', icon: '🗺️', title: 'La carte de campagne',
    rule: 'Huit semaines, région par région : placez meetings, porte-à-porte et affiches face au candidat adverse, et dépassez 50 % des voix au niveau national.',
  },
  {
    id: 'campagne_legislatives', kind: 'campagne', icon: '🏘️', title: 'La campagne de circonscription',
    rule: 'Huit semaines, canton par canton : ravissez la circonscription au député sortant en totalisant plus de voix que lui.',
  },
  {
    id: 'campagne_referendum', kind: 'campagne', icon: '🗳️', title: 'La campagne du référendum',
    rule: 'Menez le camp du Oui : convainquez les indécis et faites voter vos partisans, région par région, en huit semaines.',
  },
  {
    id: 'enquete_fuite', kind: 'enquete', icon: '🕵️', title: 'La fuite',
    rule: 'Une note confidentielle a fuité : interrogez le cabinet, fouillez, consultez caméras et badges, puis désignez la taupe et son mobile avant la fin de vos heures d’enquête.',
  },
  {
    id: 'enquete_joyaux', kind: 'enquete', icon: '💎', title: 'Les joyaux du musée',
    rule: 'Les joyaux ont disparu pendant la nocturne : recoupez les témoignages du personnel, traquez le menteur et confondez le voleur avant la fermeture du dossier.',
  },
  {
    id: 'enquete_sabotage', kind: 'enquete', icon: '🗳️', title: 'Le vote saboté',
    rule: 'Boîtiers débranchés, consignes falsifiées : remontez la piste jusqu’au saboteur de l’amendement, et à son complice si l’affaire est corsée.',
  },
  {
    id: 'urbanisme_commune', kind: 'urbanisme', icon: '🏘️', title: 'Le plan d’urbanisme',
    rule: 'Dix ans de mandat, deux chantiers par an : logements, écoles, parcs, usines… jouez des voisinages pour finir avec une satisfaction d’au moins 65 et des comptes positifs.',
  },
  {
    id: 'urbanisme_ville_nouvelle', kind: 'urbanisme', icon: '🚋', title: 'La ville nouvelle sur la Loire',
    rule: 'Bâtissez de zéro le grand chantier du règne : atteignez l’objectif de population et faites desservir au moins trois quartiers distincts par une même ligne de tram.',
  },
  {
    id: 'urbanisme_reconstruction', kind: 'urbanisme', icon: '🧱', title: 'La reconstruction',
    rule: 'Après la catastrophe, déblayez les ruines, relogez tous les sinistrés avant l’hiver et videz la zone inondable de ses décombres : on n’y reconstruit plus.',
  },
  {
    id: 'echiquier_monde', kind: 'echiquier', icon: '♟️', title: 'Le grand échiquier',
    rule: 'Huit tours pour étendre l’influence française face à la Karstanie : jouez vos cartes pour placer de l’influence, tenter des coups diplomatiques ou déclencher des événements, sans laisser la tension tourner à la crise.',
  },
  {
    id: 'echiquier_afrique', kind: 'echiquier', icon: '🌍', title: 'L’échiquier africain',
    rule: 'Vingt pays, cinq régions : disputez au Kantor aide, accords et visites, et dominez les régions au moment de leurs bilans.',
  },
  {
    id: 'echiquier_europe', kind: 'echiquier', icon: '🇪🇺', title: 'L’échiquier européen',
    rule: 'Au sein de l’Union, ralliez États et institutions face à une coalition de capitales : votes, alliances et budgets, sans provoquer le blocage institutionnel.',
  },
  {
    id: 'navette_loi', kind: 'navette', icon: '🏛️', title: 'La navette parlementaire',
    rule: 'Menez votre texte de la commission à la lecture définitive : consultez les groupes, amendez, négociez, et faites-le adopter sans le vider de sa substance.',
  },
  {
    id: 'navette_budget', kind: 'navette', icon: '💶', title: 'La loi de finances',
    rule: 'Faites voter le budget de la commission jusqu’à la lecture définitive : amendez, négociez, dégainez le 49.3 si la censure ne passe pas, et tenez la cible de déficit.',
  },
  {
    id: 'navette_reforme', kind: 'navette', icon: '✊', title: 'La grande réforme',
    rule: 'Faites passer la réforme à travers l’Assemblée, le Sénat et la CMP pendant que la rue gronde : chaque étape où son cœur reste intact grossit la mobilisation.',
  },
  {
    id: 'navette_constitution', kind: 'navette', icon: '📜', title: 'La révision constitutionnelle',
    rule: 'Ni 49.3 ni dernier mot de l’Assemblée : obtenez un texte identique des deux chambres, puis les trois cinquièmes du Congrès à Versailles.',
  },
  {
    id: 'une_quotidien', kind: 'une', icon: '📰', title: 'Le bouclage',
    rule: 'Composez la Une et deux pages avant 23 h 30 : placez les dépêches, vérifiez les sources douteuses, casez les pubs, sans laisser de blanc.',
  },
  {
    id: 'une_soir_electoral', kind: 'une', icon: '🗳️', title: 'Soirée électorale',
    rule: 'Les estimations tombent et certaines seront corrigées : remplacez-les par les rectificatifs avant le bouclage, sinon c’est le démenti.',
  },
  {
    id: 'une_scandale', kind: 'une', icon: '🗂️', title: 'L’affaire',
    rule: 'Documents et versions contradictoires : vérifiez avant d’accuser, toute accusation imprimée sans preuve vaut une plainte en diffamation.',
  },
  {
    id: 'reseau_metro', kind: 'reseau', icon: '🚇', title: 'Le métro du Grand Paris',
    rule: 'Tracez les lignes semaine après semaine : chaque voyageur doit rejoindre sa destination, et une station saturée trois semaines ferme le réseau.',
  },
  {
    id: 'reseau_tram', kind: 'reseau', icon: '🚋', title: 'Le tramway de la ville',
    rule: 'Avec peu de lignes et un budget au kilomètre, desservez tous les quartiers avant que l’un d’eux ne déborde.',
  },
  {
    id: 'reseau_tgv', kind: 'reseau', icon: '🚄', title: 'Les lignes à grande vitesse',
    rule: 'Reliez les grandes villes de France avec votre budget : la montagne coûte cher, et une ville laissée à quai trop longtemps fait suspendre le plan.',
  },
  {
    id: 'visite_officielle', kind: 'visite', icon: '🎩', title: 'La visite d’État',
    rule: 'Cadeau, menu, toast et programme : lisez la fiche du protocole et évitez le faux pas qui ferait un incident diplomatique.',
  },
  {
    id: 'metrodoku', kind: 'grille', icon: 'Ⓜ', title: 'Metrodoku', grid: 'metro',
    rule: 'Chaque case attend une station du métro parisien qui vérifie sa ligne et sa colonne. Les lignes ne sont désignées que par leur numéro, sans leurs terminus ; les suggestions ne donnent jamais les lignes. Une station ne sert qu’une fois. Plus la réponse est rare, plus elle rapporte de points.',
  },
  {
    id: 'capitalodoku', kind: 'grille', icon: '🌍', title: 'Capitalodoku', grid: 'capitales',
    rule: 'Chaque case attend une capitale du monde qui vérifie sa ligne et sa colonne. Tapez la capitale ou le pays. Une capitale ne sert qu’une fois. Plus la réponse est rare, plus elle rapporte de points.',
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

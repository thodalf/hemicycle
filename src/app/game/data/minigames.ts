/* ============================================================
 *  Mini-jeux : six mécaniques, déclinées en thèmes.
 *  Le score (0 à 1) décide de l'ampleur des gains de l'action
 *  ou de l'événement qui les déclenche.
 * ============================================================ */

export type MinigameKind = 'poignees' | 'applaudimetre' | 'memoire' | 'tri' | 'marchandage' | 'pointage';

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
}

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
    id: 'parrainages', kind: 'pointage', icon: '☎️', title: 'La chasse aux parrainages',
    rule: 'Des maires rappellent : décrochez avant qu’ils ne raccrochent.', good: '☎️', bad: '📵',
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
];

export const MINIGAMES_BY_ID = new Map(MINIGAMES.map(m => [m.id, m]));

import type { MinigameKind } from './minigames';
import type { GameRules } from './minigame-rules';

/* ============================================================
 *  Règles détaillées (deuxième lot) : de la commission
 *  d’investiture à « La règle est la règle ». Chaque fiche décrit
 *  la mécanique telle qu’elle est codée dans le composant du jeu.
 * ============================================================ */

export const RULES_B: Partial<Record<MinigameKind, GameRules>> = {
  investitures: {
    but: 'Investir chaque candidat·e dans la circonscription qui lui ressemble le plus.',
    deroule: [
      'Cinq circonscriptions et cinq candidat·es s’affichent, chacun avec deux étiquettes (ouvrier, cadres, rural, jeunes, seniors, enraciné, écologie, sécurité, économie, social).',
      'Touchez un·e candidat·e, puis la circonscription où vous voulez l’investir.',
      'Les étiquettes communes s’allument en vert et la note du binôme s’affiche : 0/2, 1/2 ou 2/2.',
      'Placer quelqu’un dans une circonscription déjà pourvue libère l’ancien titulaire ; toucher une circonscription sans rien sélectionner la vide.',
      'Quand les cinq circonscriptions sont pourvues, validez les investitures.',
    ],
    score: 'Votre total d’étiquettes communes est comparé au meilleur total possible pour ce tirage : la répartition optimale vaut 100, même si elle n’atteint pas 2/2 partout. Pas de chronomètre : seule la justesse compte.',
    commandes: 'Souris ou doigt : touchez un·e candidat·e, puis une circonscription.',
    astuces: [
      'Deux profils ont une étiquette « brouillée » qui renvoie à une autre circonscription : placez d’abord les binômes évidents à 2/2.',
      'Si deux candidat·es visent la même circonscription, servez d’abord celui ou celle qui n’a pas d’autre point de chute.',
    ],
  },

  arbitrage: {
    but: 'Partager l’enveloppe entre cinq ministères sans en laisser un seul sous son plancher, en approchant au mieux leurs souhaits.',
    deroule: [
      'Cinq lignes budgétaires sont tirées, chacune avec un plancher et un souhait en milliards d’euros.',
      'L’enveloppe suffit toujours pour tous les planchers, jamais pour tous les souhaits ; elle est un peu plus serrée quand vous êtes fatigué·e.',
      'Ajustez chaque ligne par pas de 5 Md€ avec les boutons + et −, sans dépasser l’enveloppe.',
      'Une ligne sous son plancher s’encadre en rouge et affiche la menace du ministre concerné.',
      'Rendez l’arbitrage quand vous le souhaitez, même s’il reste de l’argent.',
    ],
    score: 'Chaque ligne vaut 0 sous son plancher, la moitié de sa valeur au plancher, puis monte jusqu’à sa valeur pleine en atteignant son souhait (au-delà, rien de plus). Le total est comparé au meilleur arbitrage possible, qui vaut 100. Un seul ministère sous son plancher divise la note par deux. Pas de chronomètre.',
    commandes: 'Souris ou doigt : boutons + et − de chaque ligne, puis « Rendre l’arbitrage ».',
    astuces: [
      'Mettez d’abord chaque ligne à son plancher, puis répartissez le reste.',
      'Les lignes dont l’écart entre plancher et souhait est étroit (Culture, Recherche, Routes : 10 Md€) gagnent davantage par tranche de 5 Md€ que les Hôpitaux ou les Écoles (15 Md€).',
      'L’argent non dépensé ne rapporte rien : videz l’enveloppe.',
    ],
  },

  citations: {
    but: 'Relier chaque citation historique à son auteur.',
    deroule: [
      'Cinq citations s’affichent à gauche, six auteurs à droite : l’un d’eux est un leurre.',
      'Touchez une citation, puis l’auteur auquel vous l’attribuez.',
      'Une bonne réponse verrouille le couple ; une erreur fait trembler l’auteur, compte comme un essai raté, et la citation reste sélectionnée.',
      'La partie s’arrête quand les cinq citations sont trouvées, ou après cinq erreurs.',
    ],
    score: 'Le score part de la part de citations trouvées, puis perd 12 % par erreur (60 % au plus). Cinq sur cinq sans faute : 100 ; cinq sur cinq avec deux erreurs : 76. Pas de chronomètre.',
    commandes: 'Souris ou doigt : une citation, puis un auteur.',
    astuces: [
      'Placez d’abord les citations dont vous êtes sûr·e : l’auteur en trop devient plus facile à repérer.',
      'Après une erreur, la citation reste sélectionnée : réessayez directement avec un autre auteur.',
    ],
  },

  lecture: {
    but: 'Lire correctement un sondage avant de le commenter à l’antenne.',
    deroule: [
      'Le sondage s’affiche : les intentions de vote de cinq partis, une marge d’erreur de ± 3 points, et le score du parti en tête dans cinq électorats.',
      'Quatre questions s’enchaînent : qui est en tête, l’écart entre les deux premiers est-il significatif, combien de points séparent le premier du troisième, quel électorat donne au premier son meilleur score.',
      'Touchez la bonne réponse ; l’explication s’affiche aussitôt.',
      'Le sondage reste visible pendant toute la partie.',
    ],
    score: 'Chaque bonne réponse vaut 25 points. Pas de chronomètre.',
    commandes: 'Souris ou doigt : touchez une réponse.',
    astuces: [
      'Égalité statistique : si l’écart entre les deux premiers est inférieur ou égal à la marge d’erreur (3 points), on ne peut pas les départager.',
      'Pour l’écart entre le premier et le troisième, faites la soustraction : un leurre donne simplement le score du troisième.',
    ],
  },

  securite: {
    but: 'Poster vos équipes de façon à couvrir le plus de risque possible sur le parcours du cortège.',
    deroule: [
      'Le parcours serpente sur une grille de 7 × 4 cases ; plus une case est rouge, plus elle est sensible (risque de 1 à 3, ⚠️ pour le maximum).',
      'Quelques cases hors du parcours présentent aussi un petit risque.',
      'Touchez une case pour y poster une équipe, touchez-la de nouveau pour la retirer.',
      'Chaque équipe couvre sa case et ses quatre voisines (haut, bas, gauche, droite), jamais les diagonales.',
      'Validez le plan quand vos quatre équipes sont placées.',
    ],
    score: 'Le risque total couvert est comparé au meilleur placement possible pour cette grille, qui vaut 100. Une case couverte par deux équipes ne compte qu’une fois. Pas de chronomètre.',
    commandes: 'Souris ou doigt : touchez les cases.',
    astuces: [
      'Évitez les chevauchements : deux équipes voisines gaspillent des cases.',
      'Une équipe au bord de la grille couvre moins de cases : à risque égal, préférez l’intérieur.',
      'Une équipe juste à côté d’un point chaud le couvre aussi bien qu’une équipe posée dessus.',
    ],
  },

  interprete: {
    but: 'Choisir la bonne traduction de chaque phrase de votre homologue avant la fin du chrono.',
    deroule: [
      'Six phrases en anglais, allemand, espagnol ou italien s’enchaînent.',
      'Pour chacune, trois traductions françaises sont proposées : une seule est juste, les deux autres traduisent d’autres phrases.',
      'Une barre de temps d’environ neuf secondes et demie s’écoule ; elle raccourcit un peu quand vous êtes fatigué·e.',
      'Sans réponse à temps, la phrase compte comme un contresens.',
    ],
    score: 'Chaque bonne traduction vaut un sixième de la note (environ 17 points). Six sur six : 100.',
    commandes: 'Souris ou doigt : touchez une traduction.',
    astuces: [
      'Repérez les mots transparents (noms propres, chiffres, mots proches du français) : ils suffisent souvent à trouver le sujet.',
      'Éliminez d’abord la traduction qui ne parle manifestement pas de la même chose.',
    ],
  },

  frondeurs: {
    but: 'Repérer les députés de votre groupe qui votent contre la consigne ou s’abstiennent.',
    deroule: [
      'Votre groupe vote pour ; dix-huit votes défilent un par un, environ toutes les 1,7 seconde (un peu plus vite sous la fatigue).',
      'Chaque carte indique le groupe du député (● votre groupe, ○ autre groupe), son nom et son vote.',
      'Touchez « Frondeur ! » quand un député de votre groupe vote contre ou s’abstient.',
      'Un député d’un autre groupe ne compte jamais, même s’il vote contre.',
      'La carte suivante arrive toute seule ; une seule alerte compte par carte.',
    ],
    score: 'Chaque frondeur repéré rapporte une part égale de la note ; chaque fausse alerte (un fidèle ou un député d’un autre groupe) en retire une demi-part. Tous repérés sans fausse alerte : 100.',
    commandes: 'Souris ou doigt : le bouton « Frondeur ! ».',
    astuces: [
      'Regardez d’abord la pastille du groupe, puis le vote.',
      'Dans le doute, ne touchez pas : une fausse alerte coûte la moitié d’un frondeur trouvé.',
    ],
  },

  rabot: {
    but: 'Trouver les économies exigées par Bercy en fâchant le moins de monde possible.',
    deroule: [
      'Neuf lignes budgétaires s’affichent, chacune avec son montant d’économies et son coût politique (points de colère, ou « indolore »).',
      'Bercy fixe un objectif d’économies, un peu moins de la moitié du total des lignes (un peu plus sous la fatigue).',
      'Touchez une ligne pour la raboter, touchez-la de nouveau pour la rétablir.',
      'Le bouton « Présenter le budget » s’active dès que l’objectif est atteint.',
      'Une barre d’environ 45 secondes s’écoule : à zéro, le budget est présenté tel quel.',
    ],
    score: 'Objectif manqué : la note tombe à 10. Objectif atteint : la note compare la colère minimale possible à la vôtre, selon (colère minimale + 2) ÷ (votre colère + 2). Atteindre l’objectif avec la colère minimale vaut 100.',
    commandes: 'Souris ou doigt : touchez les lignes, puis « Présenter le budget ».',
    astuces: [
      'Commencez par les lignes indolores.',
      'Comparez la colère au montant : une grosse coupe un peu impopulaire vaut souvent mieux que trois petites.',
      'Dépasser l’objectif ne rapporte rien : retirez les coupes superflues avant de présenter.',
    ],
  },

  prenoms: {
    but: 'Saluer chaque personne croisée au marché par son prénom.',
    deroule: [
      'Cinq personnes s’affichent avec leur prénom, leur métier et un détail personnel.',
      'Vous avez une dizaine de secondes pour les mémoriser ; le compte à rebours raccourcit sous la fatigue.',
      'Chaque personne revient ensuite, décrite par son métier et son détail, sans son prénom.',
      'Choisissez son prénom parmi trois propositions, toutes tirées des personnes du marché.',
      'Pas de chronomètre pendant les saluts.',
    ],
    score: 'Chaque prénom juste vaut 20 points.',
    commandes: 'Souris ou doigt : touchez un prénom.',
    astuces: [
      'Associez prénom et métier par une image (« Martine la boulangère »).',
      'Le métier suffit : chacun n’apparaît qu’une fois.',
    ],
  },

  agenda: {
    but: 'Caser tous les rendez-vous de la journée en respectant la contrainte de chacun.',
    deroule: [
      'Six rendez-vous sont à placer sur huit créneaux : 8 h, 9 h, 10 h, 11 h, puis 14 h, 15 h, 16 h et 17 h.',
      'Chaque rendez-vous a une contrainte : le matin, l’après-midi, avant 10 h, pas avant 16 h, juste avant ou juste après le déjeuner, ni à 8 h ni à 17 h, ou avant (ou après) un autre rendez-vous.',
      'Touchez un rendez-vous, puis un créneau ; poser un rendez-vous sur un créneau occupé en chasse l’ancien.',
      'Touchez un créneau occupé sans rien sélectionner pour le libérer et reprendre son rendez-vous.',
      'Validez quand les six sont placés, avant la fin du temps (environ une minute et demie).',
    ],
    score: 'Chaque rendez-vous dont la contrainte est respectée vaut un sixième de la note. Si le temps s’écoule, les rendez-vous non placés comptent comme ratés. Une solution parfaite existe toujours.',
    commandes: 'Souris ou doigt : un rendez-vous, puis un créneau.',
    astuces: [
      'Placez d’abord les contraintes les plus strictes (« avant 10 h », « pas avant 16 h », « juste avant ou après le déjeuner »).',
      'Une contrainte « après X » n’est remplie que si X est placé, et plus tôt dans la journée.',
    ],
  },

  prompteur: {
    but: 'Repérer le mot saboté dans chaque phrase du prompteur avant de le prononcer en direct.',
    deroule: [
      'Six phrases de discours défilent une à une.',
      'Dans chacune, un mot a été remplacé par son contraire, ou presque (« faible » au lieu de « forte »).',
      'Touchez le mot fautif avant la fin de la barre, d’environ sept secondes et demie (moins sous la fatigue).',
      'Toucher un autre mot, ou laisser filer le temps, compte comme un lapsus.',
    ],
    score: 'Chaque mot saboté repéré vaut un sixième de la note (environ 17 points).',
    commandes: 'Souris ou doigt : touchez un mot de la phrase.',
    astuces: [
      'Lisez la phrase pour son sens : le mot saboté la rend absurde dans la bouche d’un candidat.',
      'Un seul essai par phrase : ne touchez pas au hasard.',
    ],
  },

  chiffrage: {
    but: 'Faire de tête les calculs d’une mesure avant de l’annoncer.',
    deroule: [
      'Cinq questions de calcul s’enchaînent : coût d’une prime par habitant, économies d’un rabot en pourcentage, coût total d’un programme, nombre de voix, baisse relative du chômage.',
      'Quatre montants sont proposés pour chaque question.',
      'Choisissez avant la fin de la barre, d’environ treize secondes (un peu moins sous la fatigue).',
      'Sans réponse à temps, la question compte comme fausse.',
    ],
    score: 'Chaque bonne réponse vaut 20 points.',
    commandes: 'Souris ou doigt : touchez un montant.',
    astuces: [
      'Les leurres se trompent d’un facteur 10, de moitié ou du double : vérifiez d’abord l’ordre de grandeur.',
      'Baisse relative : divisez l’écart par la valeur de départ (de 10 % à 8 %, c’est une baisse de 20 %, pas de 2).',
    ],
  },

  depouillement: {
    but: 'Compter de tête les bulletins de votre liste pendant le dépouillement.',
    deroule: [
      'Le nom de votre liste s’affiche, face à deux listes concurrentes.',
      'L’assesseur annonce une vingtaine de bulletins, environ un par seconde, dont quelques bulletins nuls.',
      'Comptez de tête ceux de votre liste : seul le bulletin du moment est visible.',
      'Donnez ensuite votre total parmi quatre propositions très proches.',
    ],
    score: 'Le compte exact vaut 100 ; une voix d’écart, 55 ; davantage, 20.',
    commandes: 'Souris ou doigt : touchez votre total.',
    astuces: [
      'Comptez à voix basse ou sur vos doigts.',
      'Les bulletins nuls ne comptent pour personne : ne les ajoutez pas.',
    ],
  },

  tactique: {
    but: 'Remporter la bataille en huit tours : tenir les objectifs à la fin, ou détruire la force adverse, en préservant vos unités.',
    deroule: [
      'La carte fait 8 × 7 cases : vos unités partent à gauche, l’adversaire à droite, et trois objectifs sont cerclés ; un objectif appartient au dernier camp qui y a terminé un déplacement.',
      'Touchez un de vos pions : les cases hachurées bleues montrent où il peut aller, les cibles rouges qui il peut attaquer (distance comptée en cases, sans diagonale).',
      'Chaque unité se déplace une fois, puis attaque une fois ; attaquer d’abord termine son tour, elle ne pourra plus bouger.',
      'Une case coûte 1 point de déplacement, 2 en forêt ou sur colline ; les unités aériennes paient toujours 1 et survolent les obstacles ; on traverse ses alliés, jamais l’ennemi.',
      'Les dégâts valent l’attaque, moins la défense du terrain du défenseur, moins 1 s’il est lourd et l’attaquant non, plus ou moins 1 au hasard, avec un minimum de 1.',
      'Une unité attaquée depuis une case voisine riposte avec la moitié de ses dégâts ; une attaque à distance ne subit aucune riposte.',
      'Touchez « Fin du tour » (automatique quand toutes vos unités ont agi) : l’adversaire marche sur vous ou sur les objectifs, ses unités à distance tirent sans bouger ; la partie s’arrête après le huitième tour, ou dès qu’un camp est anéanti.',
    ],
    score: '45 % pour la part des objectifs que vous tenez à la fin, 30 % pour les points de vie conservés par vos unités, 25 % selon le nombre d’ennemis encore debout (moins il en reste, plus c’est haut). Anéantir toute la force adverse garantit au moins 75. Perdre toutes vos unités plafonne la note à 15.',
    commandes: 'Souris ou doigt : touchez un pion, puis une case hachurée ou une cible rouge ; bouton « Fin du tour → ».',
    astuces: [
      'Forêts, collines, villes et ports donnent +1 de défense (les refuges +2) ; depuis une colline, les unités à distance gagnent +1 de portée.',
      'Tirez de loin : l’artillerie, le drone, la frégate, l’hélicoptère et les tireurs d’élite frappent sans essuyer de riposte.',
      'Gardez une unité sur chaque objectif au dernier tour : seule compte l’occupation finale.',
    ],
    variantes: {
      bataille: 'Vos forces : deux infanteries, un blindé (lourd, déplacement 3), une artillerie (portée 3) et un drone aérien (portée 2), contre trois infanteries, un blindé et une artillerie (une infanterie de plus sous la fatigue). La rivière ne se franchit qu’aux deux gués, sauf en drone, et les trois objectifs sont des villes.',
      manoeuvres: 'Exactement les mêmes règles que la bataille terrestre : seul le décor change (Bleu contre une force adverse simulée, le plastron), et les unités sont « neutralisées par l’arbitrage » au lieu d’être détruites.',
      bataille_navale: 'Vos navires : une frégate (lourde, portée 2), deux patrouilleurs, un hélicoptère (aérien, survole les récifs) et un sous-marin (attaque 5 au contact), contre quatre vedettes pirates et un navire-mère (lourd, portée 2), plus une vedette sous la fatigue. Les récifs bloquent les navires, les objectifs sont trois ports, et une vedette de renfort surgit au tour 4.',
      defense_zombies: 'Deux unités de gendarmes, des pompiers (lourds, déplacement 3) et des tireurs d’élite (portée 3) défendent trois refuges au centre (défense +2) ; les immeubles bloquent tout le monde. Les morts-vivants, lents, arrivent par les bords à chaque tour et foncent vers les refuges : un refuge atteint est perdu pour de bon, la partie dure toujours huit tours, et la part « ennemis » vaut 12,5 points quel que soit le nombre d’abattus.',
    },
  },

  portrait: {
    but: 'Composer le portrait officiel qui correspond à la commande du chambellan.',
    deroule: [
      'Le chambellan décrit en une phrase le portrait que le pays attend : simple et proche, majestueux, moderne, ou un mélange.',
      'Cinq choix se succèdent : la pose, le costume, le décor, le regard, l’attribut, chacun parmi quatre esquisses.',
      'Chaque option ajoute ou retire des points sur trois jauges : majesté, proximité, modernité.',
      'Le tableau se peint à mesure, et les trois jauges sous la toile montent ou descendent.',
      'Le peintre s’impatiente : environ douze secondes par choix (moins sous la fatigue) ; passé ce délai, il choisit au hasard.',
      'À la fin, le jeu révèle les valeurs que le pays attendait sur chaque axe.',
    ],
    score: 'La note mesure l’écart entre vos trois totaux et ceux de la commande, combinés en une seule distance : un écart nul vaut 100, chaque point d’écart coûte environ 5,5 points, et à 18 points d’écart la note est au plus bas.',
    commandes: 'Souris ou doigt : touchez une esquisse.',
    astuces: [
      'Traduisez la commande : « qui lui ressemble » appelle la proximité, « digne des plus grandes cours » la majesté, « tournée vers demain » la modernité.',
      'Il ne s’agit pas de remplir une jauge à fond : pour une commande « juste milieu », un portrait trop majestueux est pénalisé.',
      'Les options les plus marquées (couronne, pull, tablette…) font souvent perdre des points sur les autres axes.',
    ],
  },

  cellule: {
    but: 'Limiter les pertes humaines d’une catastrophe en dépensant au mieux vos points d’action, tour après tour.',
    deroule: [
      'La carte fait 9 × 7 cases, avec des zones habitées à protéger (villages, villes ou districts).',
      'À chaque tour, vous disposez de points d’action (PA) et de quelques moyens rares, comptés pour toute la crise.',
      'Choisissez un moyen dans la barre, puis touchez une case encadrée ; sans moyen choisi, toucher une case l’inspecte.',
      'Les cases hachurées sont les prévisions : ce qui sera probablement touché en fin de tour (la case « Prévisions » les masque).',
      '« Annuler » revient sur une action du tour en cours, tant que le tour n’est pas fini.',
      '« Fin du tour » : le sinistre progresse selon des règles fixes, puis vos PA se rechargent.',
      'Après le dernier tour, le bilan compte la population épargnée et désigne votre meilleure et votre pire décision.',
    ],
    score: 'La note repose sur la part de population épargnée, élevée à une puissance (1,5 à 1,7) : perdre 10 % des habitants coûte déjà 13 à 15 points. S’y ajoutent jusqu’à 7 points pour les moyens rares gardés en réserve (seulement si la population est bien protégée), et l’on retire 1,5 point par point de popularité perdu. Pour les feux, 8 % de la note dépend aussi de la végétation préservée.',
    commandes: 'Souris ou doigt : un moyen, puis une case ; boutons « ↶ Annuler » et « Fin du tour → ».',
    astuces: [
      'Agissez sur les prévisions : protéger avant l’impact coûte toujours moins que réparer après.',
      'L’évacuation (2 PA) ne sauve pas les bâtiments, mais limite les pertes à 35 % des habitants, quoi qu’il arrive ensuite.',
      'Lisez l’annonce du tour suivant (vent, pluie) avant de dépenser vos PA.',
    ],
    variantes: {
      cellule_feux: 'Neuf tours, 3 PA par tour et 2 Canadair (4 PA et 3 Canadair en pleine forme) ; le feu gagne surtout la case sous le vent et ses diagonales, plus rarement les côtés, et le vent peut tourner (annoncé un tour à l’avance). Pompiers (1 PA) : retirent un tour de feu (un feu de forêt neuf en demande deux) et arrosent la case et ses voisines ; Canadair (1 PA) : éteint trois cases dans le sens du vent et protège le reste deux tours ; coupe-feu (1 PA) : rend une case de végétation ininflammable ; un village en feu doit être éteint dans le tour, sinon il est détruit, et même sauvé il perd 45 % de ses habitants s’il n’a pas été évacué.',
      cellule_crue: 'Neuf tours, 3 PA par tour et 2 bassins ; la cote monte selon la pluie annoncée (exacte pour le tour en cours, parfois fausse pour le suivant) jusqu’à 4 à 5 m, puis redescend, et l’eau gagne chaque tour les cases voisines plus basses qu’elle (le chiffre d’une case est son altitude). Digue (2 PA, case sèche) : +2 m, mais elle cède si l’eau la dépasse ; pompes (1 PA) : +1 m pour le tour, et la case s’assèche si cela suffit ; bassin (1 PA, champ au bord de l’eau) : la cote baisse de 0,5 m, au prix d’un point de popularité ; une ville sous l’eau perd 30 % de ses habitants par tour (50 % sous 1,5 m d’eau), une ville évacuée 35 % une seule fois.',
      cellule_epidemie: 'Dix tours, 4 PA par tour et 3 hôpitaux (2 sous la fatigue) ; un district contaminé monte d’un niveau par tour (de 1 à 4) et, dès le niveau 2, contamine ses voisins et les autres gares de sa ligne, tandis que la moitié des districts n’est pas surveillée (« ? ») tant qu’on ne la teste pas. Tests (1 PA) : révèlent la case et ses voisines et éteignent les cas de niveau 1 ; vaccins (1 PA) : immunisent un district sain ou de niveau 1 ; confinement (1 PA, −1 popularité) : deux tours sans contagion ni progression, pertes réduites de moitié ; hôpital (1 PA, limité) : −2 niveaux et pas de progression au tour suivant.',
    },
  },

  infiltration: {
    but: 'Traverser les trois étages sans vous faire repérer, récupérer l’objectif et ressortir avant la fin du temps imparti.',
    deroule: [
      'Chaque étage est une grille de 9 × 9 cases : partez de l’entrée et atteignez la sortie, après avoir pris l’objectif si l’étage en contient un ; des bonus facultatifs traînent aussi.',
      'Le jeu se joue au tour par tour : à chaque action, vous avancez d’une case, puis tous les agents font un pas de leur ronde.',
      'Les agents ne regardent que droit devant, sur 2 ou 3 cases (une de moins en pleine forme, une de plus sous la fatigue) ; murs et attroupements arrêtent le regard, une porte le borne.',
      'Le faisceau montre ce qu’un agent voit maintenant, un second marquage ce qu’il verra au tour suivant, et une flèche son prochain pas (↻ s’il se retourne, · s’il reste).',
      'Entrer dans un regard, s’y retrouver après le pas des agents, ou se faire percuter, c’est une alerte : retour à l’entrée de l’étage, objets déjà ramassés conservés.',
      'Trois alertes, ou le budget de tours épuisé, et la mission échoue.',
      'Outils : attendre ; se cacher dans une cachette voisine (invisible tant qu’on y reste) ; faire du bruit à 4 cases au plus pour attirer le curieux le plus proche ; badge pour une porte verrouillée ; rebrousser chemin (retour à l’entrée, +2 tours).',
    ],
    score: 'Mission réussie : 40 points d’office, plus 25 pour la discrétion (25 sans alerte, 12,5 avec une, 0 avec deux), 17 pour les bonus ramassés et 18 pour la rapidité (le maximum revient à qui fait aussi court que la référence du solveur, rien à qui use tout le budget). Mission échouée : de 8 à 40 points selon les étages franchis et les bonus trouvés.',
    commandes: 'Touchez une case voisine marquée d’un point blanc, ou utilisez les flèches du clavier ; boutons Attendre, Se cacher, Bruit (puis touchez la case visée), Badge et Rebrousser ; Échap annule le mode en cours.',
    astuces: [
      'Passez derrière les agents : ils ne voient ni sur les côtés ni dans leur dos.',
      'Attendre est souvent le meilleur coup : regardez la flèche du prochain pas avant de bouger.',
      'L’agent attiré par un bruit reste planté sur place : choisissez bien l’endroit.',
    ],
    variantes: {
      infiltration_ministere: 'Le ministère, la nuit : 2 bruits, 2 cachettes (placards, plantes) et aucun badge au départ, mais un badge traîne au deuxième étage ; le dossier se trouve au troisième. Les agentes d’entretien et les caméras n’entendent pas le bruit.',
      infiltration_ambassade: 'La réception : 2 bruits, 2 cachettes (vestiaires, palmiers) et 1 badge ; le message se dépose sur le bureau de l’ambassadeur, au troisième étage. Les serveurs et la caméra n’entendent pas le bruit, et les groupes d’invités bloquent à la fois le passage et les regards.',
      infiltration_catacombes: 'Les galeries : 3 bruits, 2 cachettes (niches) et aucun badge, mais une clé à trouver ouvre la grille cadenassée du dernier étage ; il faut prendre le plan de 1793 au deuxième étage, puis atteindre la salle oubliée au troisième. Les galeries inondées sont infranchissables.',
    },
  },

  campagne: {
    but: 'Finir les huit semaines de campagne avec plus de voix que l’adversaire, qui part légèrement devant.',
    deroule: [
      'La carte est découpée en zones, chacune avec son poids électoral, ses profils (urbain, rural, jeune, âgé, ouvrier, cadres) et votre score du moment.',
      'Chaque semaine, vous disposez de 4 unités de temps et de votre trésorerie (2 € au départ, +3 € par semaine, 12 € au plus).',
      'Touchez une carte, puis une zone (ou « Lancer » pour une carte nationale) ; l’aperçu indique le gain immédiat zone par zone.',
      'Les cartes d’événement tirées en route (soutien d’une star, gaffe adverse, dîner de donateurs, sondage qualitatif, tribune) expirent la semaine suivante ; un scandale doit être contré dans la semaine (2 temps), sinon −3 durable dans sa zone et −0,6 partout.',
      'En fin de semaine, l’adversaire joue ses coups, révélés seulement à ce moment-là, et un sondage tombe.',
      'Les effets s’usent chaque semaine : vite pour les meetings, affiches et spots, lentement pour le porte-à-porte et les ralliements.',
      'Après la huitième semaine, le soir du scrutin, les résultats tombent zone par zone, avec un léger aléa.',
    ],
    score: 'Seule compte la marge sur l’ensemble des suffrages, pas le nombre de zones gagnées. Une victoire vaut au moins 50 : environ 56 avec un point d’avance, 72 avec cinq, 84 avec dix. Une défaite vaut moins de 45 : environ 38 avec un point de retard, 27 avec trois.',
    commandes: 'Touchez une carte, puis une zone ; « ↶ Annuler » rembourse le dernier coup ; « Fin de la semaine », puis « Semaine suivante ». Touchez une zone seule pour voir son détail (Entrée ou Espace au clavier).',
    astuces: [
      'Investissez tôt dans le durable (porte-à-porte, ralliements) et gardez l’éphémère (meetings, affiches, spots) pour les dernières semaines.',
      'Plusieurs coups dans la même zone la même semaine rendent de moins en moins (70 %, 50 %, 35 %…) : dispersez-vous.',
      'L’adversaire riposte là où vous avez frappé la semaine précédente si la zone lui échappe, et lâche celles où il est largement battu.',
    ],
    variantes: {
      campagne_presidentielle: 'Quatorze zones : les treize régions et l’outre-mer, pondérées par leur nombre d’électeurs (l’Île-de-France pèse le plus). Cartes : meeting, porte-à-porte, visite d’usine, marché, affiches, ralliement d’un élu (deux fois), spot télévisé et débat télévisé (une fois, à partir de la semaine 3).',
      campagne_legislatives: 'Huit cantons d’une circonscription, face au député sortant ; le spot devient la radio locale, le débat un débat local et le ralliement celui d’un maire. Il faut plus de voix que lui sur l’ensemble des cantons.',
      campagne_referendum: 'Vous menez le Oui : la participation de chaque camp compte autant que la part des voix, et le Non part mieux mobilisé. La carte Mobilisation (1 temps, 1 €) fait voter vos partisans dans la zone et un peu autour ; meetings, porte-à-porte et ralliements mobilisent aussi un peu.',
    },
  },

  enquete: {
    but: 'Désigner le coupable et son mobile avant la fin de vos dix heures d’enquête.',
    deroule: [
      'Cinq suspects et quatre lieux en pleine forme, six suspects et cinq lieux sinon : un seul suspect réunit les trois conditions du crime (être sur la scène à l’heure des faits, avoir le badge qui l’ouvre, et correspondre à l’indice laissé sur place).',
      'Chaque action coûte une heure : interroger un suspect (une nouvelle déclaration, trois au plus), fouiller un lieu, consulter une caméra ou le registre des badges, recouper deux déclarations.',
      'Le coupable ment dans toutes ses déclarations, les autres disent vrai ; dans une affaire corsée (sous la fatigue), son complice ment aussi et doit être désigné.',
      'Fouilles, caméras et registre ne mentent jamais : la fouille de la scène révèle l’indice, celle des autres lieux un fait matériel, une caméra dit qui était dans son lieu, le registre qui a le badge.',
      'Recouper deux déclarations de deux suspects différents indique si les deux sont vraies, ou si au moins l’une est fausse.',
      'Le carnet garde tout, et la grille permet de noter ✓, ✗ ou ? pour chaque suspect et chaque condition.',
      'Accusez quand vous voulez (onglet Accuser) : le dénouement explique ensuite la chaîne logique.',
    ],
    score: 'Bon coupable : 75 points s’il vous reste au moins une heure, jusqu’à 100 avec quatre heures ou plus en réserve, 60 si vous avez tout utilisé ; −18 si le mobile est faux, −12 si le complice est faux. Mauvais coupable : de 8 à 34 points, un peu plus si le mobile ou le complice est juste.',
    commandes: 'Onglets Enquêter, Carnet, Grille et Accuser : touchez un suspect, un lieu ou une caméra ; pour recouper, choisissez deux déclarations dans le carnet ; « Clore le dossier » après le dénouement.',
    astuces: [
      'Commencez par la scène : sa fouille (l’indice) et le registre des badges éliminent d’un coup une bonne partie des suspects.',
      'Un suspect pris en flagrant mensonge par une caméra ou un recoupement est le coupable, ou son complice.',
      'N’accusez pas trop tard : chaque heure gardée, au-delà de la première, vaut environ 8 points.',
    ],
  },

  urbanisme: {
    but: 'Aménager la ville pendant votre mandat pour atteindre l’objectif de la variante, sans faire faillite.',
    deroule: [
      'La carte fait 8 × 8 cases : terrain libre, forêt (défrichement +1 M€), colline (+1 M€, belle vue), rivière (seul le tram la franchit), zone inondable hachurée et parfois des ruines.',
      'Chaque année, vous tirez une main de projets et pouvez en bâtir un nombre limité ; une ligne de tram compte pour un seul chantier et pose trois tronçons qui doivent prolonger la ligne.',
      'Touchez un projet, puis une case : l’aperçu montre le coût et l’effet sur la population, la satisfaction et le budget ; touchez la même case une seconde fois (ou « Construire ») pour bâtir.',
      'Le bulldozer déblaie une ruine (2 M€) ou démolit un bâtiment (1 M€), trois fois par an au plus ; avant de construire, vous pouvez tirer d’autres projets une fois par an pour 1 M€.',
      'Le cadre de vie de chaque logement dépend de ses voisins : parcs, nature, école et commerces à 2 cases, hôpital à 3 cases l’améliorent ; usines, stations d’épuration, ruines, bruit et entassement le dégradent.',
      'En fin d’année, le budget reçoit 0,5 M€ par centaine d’habitants, les recettes des bâtiments et la dotation, moins l’entretien ; certaines années, un événement impose un choix.',
      'Les projets non bâtis sont perdus en fin d’année ; sous −8 M€, c’est la faillite et la partie s’arrête.',
    ],
    score: '55 % pour l’objectif de la variante (plein s’il est atteint, sinon une fraction qui chute vite avec l’écart), 20 % pour la satisfaction (de 35 à 80), 15 % pour la population rapportée à la cible et 10 % pour l’état des finances. La faillite plafonne la note à 15.',
    commandes: 'Souris ou doigt : un projet ou le bulldozer, puis une case (deux fois pour confirmer) ; une case sans outil s’inspecte ; touchez la jauge de satisfaction pour son détail ; « Année suivante → » pour passer.',
    astuces: [
      'La satisfaction part de 44 : le cadre de vie moyen et les services la font monter ; le chômage (il faut des emplois pour 45 % des habitants), la pollution, le manque de logements et des comptes dans le rouge la font baisser.',
      'Un parc au contact de logements leur donne +2, une usine au contact −3 : tenez l’industrie à distance de l’habitat.',
      'Évitez de bâtir en zone inondable : une crue peut emporter ce qui s’y trouve.',
    ],
    variantes: {
      urbanisme_commune: 'Dix ans, deux chantiers par an et trois projets par main ; vous héritez d’un vieux centre (maisons anciennes, commerces, école) et d’une vieille usine au bord de l’eau. Objectif : finir avec une satisfaction d’au moins 65 environ (le seuil exact, de 62 à 69 selon votre forme, est affiché) et un budget positif ; la commune doit aussi grandir vers 1 400 habitants environ, et les demandeurs de logement non servis pèsent sur la satisfaction.',
      urbanisme_ville_nouvelle: 'Dix ans, trois chantiers par an et quatre projets par main, sur un terrain vierge. Objectif : atteindre la population cible (environ 1 200 habitants) et qu’une même ligne de tram longe au moins trois quartiers distincts (quatre sous la fatigue) ; un quartier est un groupe d’au moins deux logements qui se touchent, et deux groupes qui se touchent n’en font qu’un.',
      urbanisme_reconstruction: 'Neuf mois, deux chantiers par mois : relogez tous les sinistrés (la population cible) et videz la zone inondable de toutes ses ruines, où il est interdit de reconstruire. Les premières gelées tombent toujours au huitième mois, et un élan de solidarité peut offrir des déblaiements gratuits.',
    },
  },

  echiquier: {
    but: 'Finir les huit tours avec plus de points de victoire (PV) que la puissance rivale, sans déclencher de crise.',
    deroule: [
      'La carte compte 18 à 20 pays répartis en cinq zones ; chaque pays a une stabilité (de 1 à 4), certains sont des pivots (★), et quelques-uns vous servent d’accès direct (drapeau français).',
      'Vous contrôlez un pays quand votre influence dépasse celle de l’adversaire d’au moins sa stabilité.',
      'Chaque tour, vous avez quatre cartes en main et en jouez trois ; l’adversaire répond, à découvert, après chacune.',
      'Pour ses opérations, une carte permet de placer autant de points d’influence dans les pays où vous êtes présent, leurs voisins ou vos accès directs (2 points pour un pays contrôlé par l’adversaire), ou de tenter un coup diplomatique.',
      'Le coup : un dé de 1 à 6 plus les opérations, contre deux fois la stabilité ; l’excédent retire l’influence adverse, puis s’ajoute à la vôtre, et la tension monte d’un cran à chaque coup.',
      'Une carte française ou neutre peut aussi se jouer pour son événement ; une carte adverse jouée pour ses opérations déclenche son événement au profit de l’adversaire, sauf si vous la classez sans suite (une fois par tour).',
      'Les zones sont comptées à des tours annoncés, une par tour du 2e au 6e, puis toutes au 8e : présence, domination (plus de pays et plus de pivots), contrôle (plus de pays et tous les pivots), +1 PV par pivot tenu.',
    ],
    score: 'La note dépend de l’écart final de PV : 50 à égalité, environ 71 avec 10 PV d’avance, 86 avec 20, et symétriquement en dessous en cas de retard. Une crise provoquée par votre coup plafonne la note à 35.',
    commandes: 'Touchez une carte, puis « Influence », « Coup », « Événement » ou « Classer sans suite » ; touchez ensuite les pays (« ↶ Retirer » annule un point, « Valider ▸ » confirme), ou « Lancer le dé » pour un coup.',
    astuces: [
      'La tension baisse d’un cran à chaque nouveau tour ; à 5, c’est la crise et la partie est perdue : ne tentez jamais le coup de trop.',
      'Au-delà de certains seuils de tension, les coups deviennent interdits dans les zones les plus sensibles : surveillez la jauge.',
      'Préparez la zone du prochain bilan : c’est elle qui rapportera des PV en fin de tour.',
    ],
    variantes: {
      echiquier_monde: 'Dix-huit pays et cinq zones (Europe, Moyen-Orient, Asie, Afrique, Amériques) face à la Karstanie ; les coups sont interdits en Europe dès une tension de 2, au Moyen-Orient et en Asie dès 3.',
      echiquier_afrique: 'Vingt pays et cinq régions (Afrique du Nord, Sahel, Golfe de Guinée, Afrique centrale, Afrique de l’Est) face au Kantor ; les coups sont interdits en Afrique du Nord dès une tension de 2, dans le Golfe de Guinée et en Afrique de l’Est dès 3.',
      echiquier_europe: 'Dix-huit sièges et cinq blocs (Institutions, Nord, Centre, Est, Sud) face à une coalition de capitales ; la tension s’appelle « blocage », le coup « retournement » et la stabilité « fermeté ». Les retournements sont interdits dans les Institutions dès un blocage de 2, au Nord et au Centre dès 3.',
    },
  },

  navette: {
    but: 'Faire adopter définitivement votre texte, étape par étape, en lui gardant le plus possible de sa substance.',
    deroule: [
      'Le texte compte cinq à sept articles, chacun avec un poids (son ambition), que chaque groupe parlementaire apprécie ou déteste plus ou moins.',
      'Chaque groupe vote selon un score de soutien visible : sa position de départ, le contenu du texte, une ligne rouge éventuelle (−3), un accord respecté (+2) ou trahi (−2), sa colère après un passage en force.',
      'À chaque étape, vous disposez de temps de parole : consulter un groupe (1 temps) révèle sa ligne rouge et sa demande ; réécrire (effets réduits de moitié) ou supprimer un article coûte 1 temps ; négocier un accord coûte 1 temps et 2 points de capital politique (★), un capital à faire durer toute la navette.',
      'L’opposition dépose des amendements, votés avant le texte ; réécrire ou supprimer vous-même l’article visé peut les faire tomber.',
      'Étapes : la commission (une répétition : un rejet vous coûte 1 temps en séance), la séance publique à l’Assemblée (un rejet est fatal), le Sénat, la commission mixte paritaire (CMP), puis le vote final.',
      'En CMP, choisissez pour chaque article une version entre celle de l’Assemblée et celle du Sénat : il faut 8 voix sur 14 ; si la CMP échoue ou si le Sénat rejette ses conclusions, l’Assemblée a le dernier mot en lecture définitive.',
      'Outils de séance : séance de nuit (1 ★, +2 temps, une fois par lecture), 49.3 (3 ★, une fois : pas de vote, mais une motion de censure qui renverse le gouvernement à 289 voix), vote bloqué (2 ★, amendements écartés) ; ces passages en force augmentent la colère de l’opposition.',
    ],
    score: 'Texte adopté : 50 points d’office, plus jusqu’à 50 selon l’ambition conservée (un article intact compte en entier, réécrit pour moitié, supprimé pour rien ; les articles ajoutés ne comptent pas). Texte rejeté : de 12 à 38 points selon l’étape atteinte. Censure : 10.',
    commandes: 'Onglets Texte, Groupes et Amendements : touchez un article ou un groupe pour voir les actions possibles et leur aperçu (les votes qui changent), puis « Valider » ; les outils de séance et le bouton de vote, en bas, closent l’étape.',
    astuces: [
      'Consultez les groupes pivots en premier : une ligne rouge cachée peut faire basculer tout un vote.',
      'Réécrire plutôt que supprimer : vous gardez la moitié de l’ambition et désamorcez souvent l’hostilité.',
      'Le capital ★ ne se recharge pas : gardez-en 3 pour un 49.3 de secours.',
    ],
    variantes: {
      navette_budget: 'Chaque article pèse sur le déficit : la cible est de 4,5 % du PIB (4,4 % sous la fatigue), et chaque dixième de point au-dessus retire environ 13 % de la note, la moitié au plus. Le 49.3 n’est pas limité à une fois, tant que le capital suit.',
      navette_reforme: 'La rue compte : la mobilisation (de 0 à 6) grimpe à chaque nouvelle étape tant que les articles ✊ restent largement intacts, et d’un cran après une séance de nuit ; elle retire jusqu’à 2 points de soutien aux groupes d’opposition modérés, et 1 à votre majorité à partir de 5. Réécrire un article ✊ la fait baisser d’un cran, le supprimer de deux, et recevoir les syndicats (1 temps, 1 ★) d’un cran.',
      navette_constitution: 'Ni 49.3 ni dernier mot de l’Assemblée : après le Sénat, une deuxième lecture exige que les deux chambres adoptent le même texte (choisissez la version de chaque article), puis le Congrès doit réunir les trois cinquièmes des suffrages exprimés. Les groupes modérés partent un peu plus ouverts.',
    },
  },

  une: {
    but: 'Composer la Une et deux pages intérieures avant 23 h 30, pour un maximum de lecteurs et sans fausse information.',
    deroule: [
      'La soirée commence à 20 h ; les dépêches tombent sur le fil par quarts d’heure, et chacune disparaît au bout de 75 minutes.',
      'Chaque geste coûte du temps : placer ou retirer un bloc 5 minutes, couper un article 5 minutes, vérifier une source 15 minutes (un peu plus sous la fatigue) ; pivoter et jeter au panier sont gratuits, « Attendre » avance au quart d’heure suivant.',
      'Touchez une dépêche, puis une case de la page : un aperçu montre l’emplacement et les lecteurs gagnés ; touchez à nouveau pour placer.',
      'La Une fait 6 × 8 cases, les pages intérieures 6 × 6 ; le haut de la Une compte double, la valeur décroît vers le bas, et une dépêche perd de sa fraîcheur en vieillissant.',
      'Les sources douteuses (anonyme, document, réseaux) peuvent être fausses : seule la vérification le dit, et une info bidonnée démasquée ne peut plus être placée.',
      'Casez les publicités exigées (jamais au-dessus des deux dernières lignes de la Une) et l’éditorial, et comblez les blancs avec brèves, météo, mots fléchés ou encadrés maison.',
      'Un scoop tombe en fin de soirée ; à 23 h 30, ou quand vous l’envoyez à l’imprimerie, le journal est bouclé.',
    ],
    score: '44 % pour l’audience (lecteurs gagnés, comparés à une cible), 18 % pour le remplissage (chaque case blanche coûte cher), 16 % pour la ligne du rédacteur en chef (−30 % par entorse, −35 % si son exigence n’est pas remplie, −30 % sans éditorial), 12 % pour les publicités casées et 10 % pour l’équilibre entre les quatre lectorats (politique, grand public, jeunes, économie). Chaque fausse information imprimée retire 15 points et ne rapporte aucun lecteur ; chaque accusation imprimée sans vérification retire 7 points.',
    commandes: 'Touchez une dépêche du fil, puis une case (deux fois pour placer) ; touchez un bloc en page pour le vérifier ou le retirer ; boutons Pivoter, Couper, Vérifier, Au panier, Attendre et « Envoyer à l’imprimerie » (une confirmation est demandée s’il reste des blancs) ; onglets pour changer de page.',
    astuces: [
      'Réservez le haut de la Une aux grands formats : la manchette (6 × 2) et le scoop y rapportent le double.',
      'Vérifiez ce qui part en Une : un démenti efface tout le bénéfice de l’article.',
      'Gardez la dernière demi-heure pour combler les blancs.',
    ],
    variantes: {
      une_quotidien: 'La ligne du rédacteur en chef est tirée parmi cinq : pas de faits divers en Une, pas de people, pas de sport en Une, au moins un sujet Monde en Une, ou au moins un sujet Économie en Une. Pages intérieures : France, puis Monde et Économie.',
      une_soir_electoral: 'Certaines estimations seront corrigées dans la soirée : la vérifier (15 minutes) dit si elle est fragile, et quand le rectificatif tombe, touchez-le puis l’estimation encadrée de rouge pour la remplacer (5 minutes) ; une estimation dépassée encore en page au bouclage vaut un démenti. Le haut de la Une (4 lignes) est réservé à l’élection.',
      une_scandale: 'Les versions de l’affaire arrivent par paires contradictoires dont une seule est vraie, et vérifier l’une (15 minutes) tranche les deux ; même le scoop peut être faux. Toute accusation imprimée sans vérification coûte 7 points, même vraie, et l’affaire doit faire la tête de Une, en grand format sur la ligne du haut.',
    },
  },

  reseau: {
    but: 'Développer le réseau semaine après semaine pour amener un maximum de voyageurs à destination, sans laisser une station saturer.',
    deroule: [
      'Des stations de plusieurs types apparaissent au fil des semaines ; les prochaines sont annoncées une semaine à l’avance.',
      'Chaque semaine, des voyageurs s’accumulent sur les quais : chacun veut rejoindre le type de station dessiné à côté de lui (la plus proche sur le réseau) ou, pour le TGV, une ville précise.',
      'Touchez une ligne en bas, puis une première station et les suivantes : chaque tronçon prolonge la ligne depuis son bout actif (touchez l’autre bout, ou « ⇄ Autre bout », pour en changer).',
      'Chaque tronçon se paie sur le budget, et un tronçon trop long est refusé ; une ligne roule dès qu’elle a deux stations et une rame.',
      'Répartissez rames et wagons (deux par rame au plus) : la capacité d’une ligne dépend de son matériel et de sa longueur, une ligne courte passant plus souvent.',
      '« Lancer la semaine » : les voyageurs prennent le plus court chemin, correspondances comprises, dans la limite des places ; au début de la semaine suivante, choisissez une dotation parmi deux (ligne, rame, wagons, tunnels ou pont, pôle d’échanges, crédits).',
      'Une station au-delà de sa capacité en fin de semaine reçoit un avertissement, qu’une semaine calme efface ; au troisième, le réseau ferme.',
    ],
    score: '10 % pour les semaines tenues, 90 % pour la qualité du service, fortement réduite si le réseau ferme avant la fin. La qualité combine la part de voyageurs arrivés et leur satisfaction, qui compte pour moitié : 100 % pour un voyageur servi dans la semaine, 15 % après quatre semaines d’attente, moins 8 % par correspondance.',
    commandes: 'Touchez une ligne, puis des stations sur le plan ; sans ligne choisie, touchez une station pour voir ses voyageurs ; boutons + et − pour les rames et les wagons, « Dernier tronçon », « Supprimer », « ↶ Annuler » et « Lancer la semaine ▶ ».',
    astuces: [
      'Reliez vite chaque type de station : un voyageur sans chemin vers sa destination reste sur le quai.',
      'Renforcez (rame, wagon, pôle d’échanges) la ligne qui dessert une station en alerte avant qu’elle ne ferme le réseau.',
      'Un tronçon posé dans la semaine est remboursé en entier si vous le retirez ; plus ancien, il ne l’est qu’en partie (sauf au métro).',
    ],
    variantes: {
      reseau_metro: 'Quatorze semaines, deux lignes au départ (six au plus), trois rames, un budget de 8 tronçons (+2 par semaine, un tronçon en coûte 1) et deux tunnels, indispensables pour passer sous la Seine. Cinq types de stations (logements, bureaux, université, hôpital, grande gare), 6 voyageurs par quai (12 avec un pôle d’échanges), et des rames neuves livrées aux semaines 4, 7, 10 et 13.',
      reseau_tram: 'Douze semaines, une seule ligne au départ (trois au plus), deux rames et 110 M€ (+25 M€ par semaine et 0,6 M€ par voyageur arrivé) ; un tronçon coûte 6 M€ plus environ 15 M€ par kilomètre, et franchir la Loire demande un pont (un au départ). Sept voyageurs par quai (13 avec un pôle), et des rames livrées aux semaines 5 et 9.',
      reseau_tgv: 'Douze semaines, deux lignes (cinq au plus), trois rames et 10 Md€ (+2 Md€ par semaine) ; chaque voyageur veut rejoindre une ville précise, surtout de Paris vers les métropoles, et les grandes villes tolèrent plus de monde en attente. Un tronçon coûte un peu moins de 1 Md€ par 100 km, beaucoup plus en montagne, sauf si un tunnel (un au départ) est disponible : il est alors percé d’office.',
    },
  },

  ligne: {
    but: 'Faire tourner votre métro six semaines sans qu’aucune station ne déborde, en transportant un maximum de voyageurs.',
    deroule: [
      'Le jeu se déroule en temps réel : une semaine dure une minute, et la partie six semaines.',
      'Des stations de formes diverses (cercle, triangle, carré, puis étoile, losange ou croix) surgissent sur le plan, qui se dézoome peu à peu.',
      'Chaque voyageur est une petite forme : il veut rejoindre n’importe quelle station de cette forme, quitte à changer de ligne.',
      'Glissez d’une station à l’autre pour tracer une ligne ; tirez le petit T au bout d’une ligne pour la prolonger (revenir en arrière la raccourcit), glissez un tronçon vers une station pour l’y faire passer ; revenir à la station de départ ferme une boucle.',
      'Vous commencez avec trois lignes, trois locomotives et quelques ponts ou tunnels pour franchir l’eau ; une locomotive emporte 6 voyageurs, plus 6 par wagon (trois au plus).',
      'Chaque semaine, une locomotive s’ajoute au dépôt, et le jeu se met en pause pour vous proposer un renfort parmi deux (ligne, locomotive, wagon, deux ponts ou tunnels, correspondance).',
      'Une station qui dépasse 6 voyageurs (12 pour une correspondance) remplit un minuteur ; s’il va au bout (environ 24 secondes de débordement), le réseau ferme.',
    ],
    score: '40 % pour le temps tenu sur les six semaines, 60 % pour les voyageurs livrés, rapportés à un objectif d’environ 400 (un peu plus sous la fatigue, un peu moins en pleine forme). « Fermer le réseau » arrête la partie avec ce qui est acquis.',
    commandes: 'Glissez pour tracer, ou touchez une station puis une autre ; touchez une pastille de couleur pour gérer une ligne (locomotives et wagons +/−, couper un tronçon, retirer une station, supprimer la ligne) ; bouton ⭐ pour placer une correspondance ; pause et vitesse ×2 ; au clavier, Entrée ou Espace sur une station.',
    astuces: [
      'Faites passer chaque ligne par plusieurs formes : une correspondance coûte cher en temps aux voyageurs.',
      'Une boucle évite aux rames de faire demi-tour en bout de ligne.',
      'Mettez en pause pour réfléchir : le temps s’arrête aussi pendant le choix des renforts.',
    ],
    variantes: {
      ligne_paris: 'La Seine traverse le plan d’est en ouest : chaque franchissement demande un pont (trois au départ). Une étoile (l’Étoile) apparaît au cours de la deuxième semaine, une croix (l’Hôtel-Dieu) au cours de la quatrième.',
      ligne_lyon: 'Le Rhône et la Saône se rejoignent au sud du plan : chaque franchissement demande un pont (quatre au départ). Un losange (la Part-Dieu) apparaît au cours de la deuxième semaine, une étoile (Fourvière) au cours de la quatrième.',
      ligne_marseille: 'La mer et le Vieux-Port bordent la ville : passer sous l’eau demande un tunnel (deux au départ seulement). Une croix (la Timone) apparaît au cours de la deuxième semaine, un losange (Saint-Charles) au cours de la quatrième.',
    },
  },

  regle: {
    but: 'Pousser les mots du règlement pour réécrire les règles, jusqu’à toucher ce qui est GAGNE avec ce qui est TOI.',
    deroule: [
      'Le plateau porte des objets (député, mur, siège…) et des mots ; les règles en vigueur sont les phrases que forment les mots, lues de gauche à droite et de haut en bas.',
      'Une phrase s’écrit NOM EST PROPRIÉTÉ (« MUR EST STOP ») ou NOM EST NOM (« DÉPUTÉ EST LOI » change chaque député en loi), et ET permet d’en enchaîner plusieurs.',
      'Vous dirigez tout ce qui est TOI : à chaque coup, tous ces objets avancent d’une case et poussent ce qui est POUSSE ; les mots se poussent toujours.',
      'STOP bloque ; FERME bloque, sauf ce qui OUVRE, et les deux se détruisent en se rencontrant ; COULE engloutit tout ce qui partage sa case ; DÉFAIT élimine ce qui est TOI ; CHAUD fait fondre ce qui FOND.',
      'Si plus rien n’est TOI, vous êtes coincé·e : annulez ou recommencez.',
      'La séance compte trois niveaux, plus retors quand vous êtes fatigué·e ; vous pouvez passer un niveau, mais il ne rapporte alors rien.',
      'Le temps est limité, de 5 à 8 minutes selon les niveaux tirés.',
    ],
    score: 'Un niveau résolu rapporte 70 % de sa valeur, plus jusqu’à 30 % selon votre nombre de coups comparé à la solution la plus courte ; un niveau passé ou non résolu ne rapporte rien. Les niveaux plus durs pèsent davantage (+25 % par palier de difficulté).',
    commandes: 'Flèches ou ZQSD pour avancer, Retour arrière (ou U, ou Ctrl+Z) pour annuler, R pour recommencer ; flèches à l’écran ou balayage du doigt sur le plateau.',
    astuces: [
      'Lisez la liste des règles en vigueur avant de bouger : un mot qui ne forme aucune phrase n’a aucun effet.',
      'Si le but est hors d’atteinte, changez la règle plutôt que le chemin : « X EST GAGNE » peut viser un objet à votre portée, ou ce que vous êtes vous-même.',
      'Annuler ne coûte rien : le compteur de coups recule avec le plateau.',
    ],
    variantes: {
      regle_hemicycle: 'Cinq niveaux dans l’Hémicycle (député, sièges, lois, amendements, portes et clés, marais, presse, drapeau), dont trois sont tirés selon votre forme, du « Règlement intérieur » à « La navette ».',
      regle_ministere: 'Quatre niveaux au Ministère (ministre, tampon, guichet, dossiers, broyeur, café, portes et clés, presse), dont trois sont tirés selon votre forme, du « Guichet » au « Parapheur ».',
      regle_campagne: 'Quatre niveaux en Campagne (candidat, urne, votants, affiches, boue, presse, portes et clés, tracts), dont trois sont tirés selon votre forme, du « Porte-à-porte » au « Report de voix ».',
    },
  },
};

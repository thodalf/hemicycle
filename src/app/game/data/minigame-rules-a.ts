import type { MinigameKind } from './minigames';
import type { GameRules } from './minigame-rules';

/* ============================================================
 *  Règles détaillées (première moitié des mécaniques).
 *  Chaque texte décrit la mécanique réellement codée dans
 *  components/minigame : durées, barèmes, pénalités.
 *  « Votre forme » : la fatigue et le stress rendent chaque
 *  exercice plus rapide ou plus exigeant ; reposé·e, il est plus doux.
 * ============================================================ */

export const RULES_A: Partial<Record<MinigameKind, GameRules>> = {
  poignees: {
    but: 'Attraper un maximum de cibles (mains tendues, livres, verres…) en 15 secondes, sans toucher les pièges (tomates, paparazzis, guêpes…).',
    deroule: [
      'Une grille de neuf cases s’affiche, vide au départ.',
      'Toutes les trois quarts de seconde environ, une cible ou un piège surgit dans une case libre.',
      'Chaque apparition ne reste qu’un peu plus d’une seconde avant de disparaître.',
      'Un peu plus d’une apparition sur quatre est un piège.',
      'La partie s’arrête net au bout de 15 secondes.',
    ],
    score: 'Chaque cible touchée vaut +1 et chaque piège touché −1,2. Ce total est rapporté aux trois quarts des cibles apparues (au moins 4) : attraper environ 75 % des cibles sans toucher de piège donne 100. Les cibles manquées ne coûtent rien de plus, mais elles ne rapportent rien.',
    commandes: 'Touchez ou cliquez la case. Au clavier, les touches 1 à 9 correspondent aux cases dans le sens de la lecture : 1, 2, 3 sur la ligne du haut, 7, 8, 9 sur celle du bas.',
    astuces: [
      'Regardez l’icône avant de frapper : un piège touché coûte 1,2 point, une cible manquée ne coûte rien.',
      'Au clavier, gardez trois doigts sur une rangée de touches pour réagir plus vite.',
      'Fatigué·e, les apparitions sont plus fréquentes mais plus brèves.',
    ],
  },

  applaudimetre: {
    but: 'Lancer chacune des cinq phrases du discours au moment où le curseur passe au centre de la zone verte.',
    deroule: [
      'La phrase à prononcer s’affiche au-dessus d’une jauge horizontale.',
      'Le curseur va et vient sans cesse d’un bout à l’autre de la jauge, plus lentement aux extrémités.',
      'Une zone verte, marquée en son centre d’un repère, est placée au hasard sur la jauge.',
      'Vous lancez la phrase : la salle réagit (ovation, applaudissements, murmures ou silence gêné).',
      'Après une courte pause, la phrase suivante arrive avec une nouvelle zone, jusqu’à la cinquième.',
    ],
    score: 'Chaque phrase reçoit une précision de 0 à 100 : 100 pile sur le repère central, puis de moins en moins à mesure qu’on s’en éloigne, et 0 au bord de la zone verte ou au-delà. Le score final est la moyenne des cinq phrases. Il n’y a pas de limite de temps : seul le bon moment compte.',
    commandes: 'Bouton « Lancer la phrase ! », ou touche Espace ou Entrée.',
    astuces: [
      'Visez le repère central, pas seulement la zone verte : une phrase lancée au bord ne rapporte rien.',
      'Laissez passer un aller-retour pour prendre le rythme avant de lancer.',
      'Quand la zone est près d’un bord, le curseur y ralentit : c’est plus facile.',
    ],
  },

  memoire: {
    but: 'Retrouver les six paires de cartes identiques, en un minimum d’essais, avant la fin du temps.',
    deroule: [
      'Douze cartes sont posées face cachée : six paires tirées au hasard.',
      'Vous retournez une première carte, puis une seconde.',
      'Si elles sont identiques, la paire reste visible ; sinon, elles se retournent après un court instant.',
      'Chaque fois que vous retournez deux cartes compte pour un essai.',
      'La partie s’arrête quand les six paires sont trouvées, ou au bout de 40 secondes environ.',
    ],
    score: 'Le score est la part des paires trouvées, multipliée par un coefficient d’efficacité. Ce coefficient vaut 100 % avec six essais (sans aucune erreur), puis perd environ 7 points par essai supplémentaire, sans descendre sous 35 %. Trouver toutes les paires en dix essais donne donc environ 71.',
    commandes: 'Touchez ou cliquez les cartes.',
    astuces: [
      'Retournez d’abord des cartes inconnues pour voir le jeu, mais retenez bien leur place.',
      'Une paire non trouvée à la fin coûte un sixième du score : mieux vaut finir que viser la perfection.',
    ],
  },

  tri: {
    but: 'Envoyer chacun des dix éléments (courrier, questions, messages…) du bon côté, avant que la mèche ne brûle.',
    deroule: [
      'Un élément s’affiche au centre, avec une mèche qui se consume.',
      'Vous l’envoyez à gauche ou à droite, selon les deux libellés des boutons (par exemple « Corbeille » et « À traiter »).',
      'Un éclair vert ou rouge indique aussitôt si le choix était juste.',
      'Si la mèche s’éteint avant votre choix, l’élément compte comme une erreur.',
      'Dix éléments sont tirés au hasard dans la liste du thème, puis la partie s’arrête.',
    ],
    score: 'Chaque bonne réponse vaut 10 points, chaque erreur ou absence de réponse ne rapporte rien, sans pénalité supplémentaire. Vous avez environ 3 secondes par élément, moins si vous êtes fatigué·e.',
    commandes: 'Boutons de gauche et de droite, ou flèches gauche et droite du clavier.',
    astuces: [
      'Lisez les deux libellés avant de commencer : ils changent d’un thème à l’autre.',
      'Le côté droit est toujours le côté positif (traiter, répondre, retenir, envoyer, entendre) : ce qui est sérieux et légitime va à droite, les pièges, les attaques et le farfelu à gauche.',
      'Une réponse au hasard vaut mieux que pas de réponse : le silence compte comme une erreur.',
    ],
  },

  marchandage: {
    but: 'Trouver le montant juste : celui que l’autre partie accepte, au plus près de son seuil secret, en cinq propositions au plus.',
    deroule: [
      'L’autre partie a un seuil caché, tiré au hasard entre le quart et les trois quarts de l’échelle.',
      'Vous réglez le montant avec le curseur, puis vous le proposez.',
      'Une offre refusée s’affiche avec un verdict (« Presque… », « On se rapproche », « Loin du compte », « Inacceptable ! ») et un thermomètre de proximité.',
      'Dès qu’une proposition est acceptée, la négociation s’arrête.',
      'Après cinq refus, l’autre partie quitte la table.',
    ],
    score: 'Une proposition acceptée pile sur le seuil vaut 100. Chaque écart au seuil coûte des points : dépasser le seuil de 35 % de l’échelle ne laisse que le minimum de 25. Chaque refus essuyé avant l’accord retire encore 6 points. Cinq refus : 10. Il n’y a pas de chrono.',
    commandes: 'Curseur à la souris ou au doigt (les flèches du clavier le règlent aussi une fois sélectionné), puis bouton « Proposer » ou « Demander ».',
    astuces: [
      'Procédez par dichotomie : commencez au milieu, puis coupez l’intervalle en deux selon la réponse.',
      'Le seuil n’est jamais dans le premier ni dans le dernier quart de l’échelle.',
      'Un accord un peu généreux au deuxième essai vaut mieux qu’un cinquième refus.',
    ],
    variantes: {
      negociation_donateur: 'Ici, vous demandez : le mécène accepte tout montant inférieur ou égal à sa limite. Visez juste en dessous, car demander trop peu laisse de l’argent sur la table.',
      negociation_coalition: 'Raté, la coalition ne se fait pas ; Mitigé, l’accord est signé avec un partenaire déjà méfiant ; Brillant, le partenaire arrive bien disposé.',
    },
  },

  pointage: {
    but: 'Rallier les députés indécis qui s’allument dans l’hémicycle, sans cliquer sur les pièges, pendant 15 secondes.',
    deroule: [
      'Un petit hémicycle de 27 sièges s’affiche, en trois rangées.',
      'Toutes les 0,7 seconde environ, un siège libre s’allume : un indécis (🟡) ou un piège (🔴).',
      'Environ un siège allumé sur cinq est un piège.',
      'Un indécis reste allumé un peu plus d’une seconde ; s’il n’est pas touché à temps, il est perdu et son siège ne se rallume plus.',
      'La partie s’arrête au bout de 15 secondes.',
    ],
    score: 'Chaque indécis rallié vaut +1, chaque piège touché −1. Le total est rapporté à 80 % des indécis apparus (au moins 4) : rallier quatre indécis sur cinq sans toucher de piège donne 100.',
    commandes: 'Touchez ou cliquez le siège allumé.',
    astuces: [
      'Gardez les yeux au centre de l’hémicycle pour voir les deux ailes.',
      'Dans le doute, abstenez-vous : un piège coûte autant qu’un indécis rapporte.',
    ],
  },

  tournee: {
    but: 'Récolter un maximum de promesses (signatures ou soutiens) en enchaînant les villages, avant la panne sèche.',
    deroule: [
      'La carte montre Paris, votre point de départ, et onze villages qui promettent chacun 1, 2 ou 3 promesses.',
      'Vous touchez un village à portée : la voiture s’y rend et le réservoir baisse selon la distance à vol d’oiseau.',
      'Les villages hors de portée de votre réservoir sont grisés et ne peuvent plus être choisis.',
      'Un village visité ne rapporte qu’une fois.',
      'La tournée s’arrête quand plus aucun village n’est à portée, ou quand vous touchez « Rentrer à Paris ».',
    ],
    score: 'Votre récolte est comparée à celle du meilleur de trois itinéraires simples calculés au départ (le meilleur rapport promesses / distance, le village le plus proche, le plus gros village d’abord). Égaler ce repère donne 100, et le dépasser ne rapporte pas plus. Le retour à Paris ne coûte pas de carburant.',
    commandes: 'Touchez ou cliquez les villages sur la carte.',
    astuces: [
      'Repérez les villages à 3 promesses et tracez une boucle qui les relie, plutôt que de courir au plus proche.',
      'Évitez les allers-retours d’un bout à l’autre de la carte : ils vident le réservoir.',
      'Ne rentrez pas trop tôt : tant qu’un village est à portée, il rapporte.',
    ],
  },

  mot: {
    but: 'Trouver le mot caché, dont la première lettre est donnée, en six essais au plus.',
    deroule: [
      'La grille indique la longueur du mot (5 à 10 lettres) et en affiche la première lettre.',
      'Vous tapez un mot complet de la bonne longueur, puis vous le validez.',
      'Chaque lettre bien placée devient un carré rouge, chaque lettre présente mais mal placée un rond jaune ; les autres restent bleues.',
      'Les lettres déjà trouvées réapparaissent en filigrane sur la ligne suivante, et le clavier se colore.',
      'La partie s’arrête quand le mot est trouvé, après six essais, ou au bout de deux minutes et demie environ.',
    ],
    score: 'Mot trouvé au premier ou au deuxième essai : 100 ; au troisième : 92 ; au quatrième : 80 ; au cinquième : 65 ; au sixième : 50. Mot non trouvé : jusqu’à 30, selon la part de lettres bien placées dans votre meilleur essai (la première lettre, donnée, ne compte pas).',
    commandes: 'Clavier physique (les accents sont ignorés), ou clavier à l’écran. Entrée pour valider, Retour arrière pour effacer ; la première lettre ne s’efface pas.',
    astuces: [
      'Le jeu ne vérifie pas que vos essais sont de vrais mots : n’hésitez pas à tester des lettres fréquentes (E, A, S, R, T, I).',
      'Une lettre peut apparaître plusieurs fois : un rond jaune ne dit pas combien.',
      'Les deux premiers essais rapportent autant : prenez le temps d’en faire un bon premier.',
    ],
    variantes: {
      mot_du_jour: 'Le même mot pour tout le monde, un seul par jour réel. Si vous l’avez déjà joué aujourd’hui, l’équipe s’en charge et obtient 50. Dans la salle de jeux, il n’y a pas de chrono et la partie se reprend jusqu’à minuit.',
      motus_tele: 'Un mot tiré au hasard à chaque partie, parmi les mots du jour et le vocabulaire politique.',
    },
  },

  grille: {
    but: 'Remplir les neuf cases d’une grille 3 × 3 : chaque case attend un nom qui vérifie à la fois le critère de sa ligne et celui de sa colonne.',
    deroule: [
      'Chaque case indique combien de réponses possibles elle admet.',
      'Vous touchez une case, tapez quelques lettres, puis choisissez parmi les suggestions.',
      'Une bonne réponse remplit la case et affiche ses points de rareté, de 10 pour la plus évidente à 100 pour la plus rare.',
      'Une mauvaise réponse coûte un cœur, et le message indique le critère qui n’est pas respecté.',
      'Une même réponse ne peut servir qu’une fois dans la grille.',
      'La partie s’arrête quand la grille est pleine, après trois erreurs, à la fin du temps (quatre minutes environ, pas de chrono dans la salle de jeux) ou si vous rendez la grille.',
    ],
    score: 'Le score est la part des cases remplies : environ 11 points par case, 100 pour une grille complète. Les erreurs ne retirent aucun point, mais la troisième met fin à la partie. Les points de rareté s’affichent pour le plaisir et la comparaison, mais n’entrent pas dans le score sur 100.',
    commandes: 'Touchez une case, tapez dans le champ, puis touchez une suggestion ; Entrée choisit la première suggestion.',
    astuces: [
      'Commencez par les cases qui n’admettent qu’une ou deux réponses, et gardez les cases faciles pour la fin.',
      'Ne jouez pas une réponse « passe-partout » dans une case facile si elle est la seule possible ailleurs.',
      'Une erreur ne coûte aucun point : même avec un seul cœur, tentez votre chance plutôt que de rendre la grille.',
    ],
    variantes: {
      metrodoku: 'Des stations du métro parisien. Les lignes ne sont désignées que par leur numéro, et les suggestions ne disent jamais par quelles lignes passe une station.',
      capitalodoku: 'Des capitales du monde : vous pouvez taper le nom de la capitale ou celui du pays.',
    },
  },

  quiz: {
    but: 'Gagner les six camemberts, un par catégorie, en neuf questions au plus.',
    deroule: [
      'Un dé tourne et s’arrête sur une catégorie dont vous n’avez pas encore le camembert.',
      'Une question à quatre réponses s’affiche, avec environ 16 secondes pour répondre.',
      'Une bonne réponse vous donne le camembert de la catégorie, qui ne sortira plus au dé.',
      'Une mauvaise réponse, ou l’absence de réponse, ne donne rien, et la bonne réponse s’affiche.',
      'La partie s’arrête aux six camemberts, ou après la neuvième question.',
    ],
    score: 'Chaque camembert vaut un sixième du score, soit environ 17 points. Vous pouvez donc vous tromper trois fois et finir à 100. Les erreurs ne coûtent rien d’autre qu’une question.',
    commandes: 'Touchez une réponse, ou appuyez sur les touches 1 à 4.',
    astuces: [
      'Ne laissez jamais filer le chrono : une réponse au hasard a une chance sur quatre.',
      'Les six catégories : institutions, histoire, géographie, économie et société, Europe et monde, culture politique.',
    ],
    variantes: {
      concours_insp: 'Il faut au moins 50 (trois camemberts) pour être reçu·e, et 80 (cinq camemberts) pour accéder aux grands corps.',
    },
  },

  protocole: {
    but: 'Retenir l’ordre des gestes montré par le chef du protocole, puis le reproduire sans faux pas, sur cinq séquences de plus en plus longues.',
    deroule: [
      'Les gestes possibles sont affichés sous forme de pastilles.',
      'Le chef du protocole allume une séquence de gestes, un par un ; un même geste peut revenir plusieurs fois.',
      'Quand « À vous » s’affiche, vous touchez les pastilles dans le même ordre.',
      'Une erreur met fin à la séquence en cours, qui ne rapporte alors rien, et la suivante commence.',
      'Les cinq séquences comptent 3, 4, 5, 6 puis 7 gestes.',
    ],
    score: 'Chaque séquence reproduite en entier rapporte autant de points que de gestes ; le total est rapporté aux 25 gestes possibles. Une erreur au dernier geste annule toute la séquence : réussir les trois premières seulement donne 48.',
    commandes: 'Touchez ou cliquez les pastilles ; elles ne répondent qu’après la démonstration.',
    astuces: [
      'Récitez la séquence à mi-voix pendant la démonstration (« gerbe, silence, gerbe… »).',
      'Rien ne presse pendant votre tour : il n’y a pas de chrono entre deux gestes.',
      'Fatigué·e, la démonstration va plus vite.',
    ],
    variantes: {
      sacre: 'Huit rites possibles au lieu de six : les séquences sont plus variées et plus difficiles à retenir.',
    },
  },

  table: {
    but: 'Placer huit convives autour d’une table ronde de façon à respecter un maximum de contraintes : les alliés côte à côte, les brouillés séparés.',
    deroule: [
      'Huit convives sont tirés au sort, et une liste de contraintes s’affiche : trois « à côté de » et environ cinq « pas à côté de ».',
      'Vous touchez un convive, puis une place libre pour l’y asseoir.',
      'Pour corriger, vous touchez deux places occupées l’une après l’autre : les deux convives échangent leurs places.',
      'Chaque contrainte se colore en vert ou en rouge dès que les deux convives concernés sont assis.',
      'Une fois tout le monde assis, vous validez le plan ; à la fin du temps (100 secondes environ), le plan est validé tel quel.',
    ],
    score: 'Le score est la part des contraintes respectées. Deux convives sont voisins s’ils occupent des places qui se suivent, la place 8 touchant la place 1. Une contrainte dont un convive n’est pas assis compte comme non respectée. Il existe toujours un plan qui les respecte toutes.',
    commandes: 'Touchez un convive puis une place ; touchez deux places pour les échanger.',
    astuces: [
      'Placez d’abord les paires « à côté de » : ce sont les plus contraignantes.',
      'Un convive qui figure dans plusieurs inimitiés trouve souvent sa place en face de ses ennemis.',
      'Fatigué·e, les inimitiés sont plus nombreuses.',
    ],
  },

  interception: {
    but: 'Détruire les missiles avant qu’ils ne touchent les villes, sans jamais abattre un avion civil, pendant 22 secondes.',
    deroule: [
      'Les missiles tombent du haut de l’écran vers les quatre villes du bas.',
      'Des avions civils traversent le ciel horizontalement, environ une apparition sur cinq.',
      'Vous touchez un missile pour l’intercepter.',
      'Un missile qui atteint le sol frappe une ville, qui s’assombrit, et le compteur d’impacts augmente.',
      'Les apparitions cessent peu avant la fin, puis la partie s’arrête au bout de 22 secondes.',
    ],
    score: 'Chaque missile intercepté vaut +1, chaque avion civil abattu −1,5. Le total est rapporté au nombre de missiles lancés (au moins 5) : tout intercepter sans bavure donne 100. Un impact ne retire pas de point en lui-même, mais c’est un missile de moins intercepté.',
    commandes: 'Touchez ou cliquez les missiles.',
    astuces: [
      'Visez d’abord les missiles les plus bas : ce sont ceux qui vont toucher.',
      'Les avions civils traversent la moitié haute du ciel : méfiez-vous en tirant dans cette bande.',
      'Fatigué·e, les missiles tombent plus vite et plus souvent.',
    ],
  },

  deminage: {
    but: 'Ouvrir toutes les cases sûres d’un terrain de 6 × 6 sans déclencher une munition.',
    deroule: [
      'Le terrain contient six ou sept munitions, selon votre forme.',
      'Le premier coup est toujours sûr : ni la case touchée ni ses voisines ne sont piégées.',
      'Chaque case ouverte affiche le nombre de munitions parmi ses huit voisines ; une case à zéro ouvre ses voisines en cascade.',
      'Vous pouvez baliser une case suspecte d’un drapeau pour ne pas l’ouvrir par mégarde.',
      'La partie s’arrête quand toutes les cases sûres sont ouvertes, à la première détonation, ou au bout de deux minutes et demie environ.',
    ],
    score: 'Zone entièrement déminée : 100. Sinon (détonation ou temps écoulé), le score vaut la moitié de la part des cases sûres ouvertes : au mieux 50. Les balises ne rapportent rien, elles servent seulement à vous protéger.',
    commandes: 'Touchez une case pour l’ouvrir. Clic droit, ou bouton « Mode balise » puis toucher, pour poser ou retirer une balise.',
    astuces: [
      'Commencez au centre : la cascade du premier coup ouvre souvent une grande zone.',
      'Un 1 collé à une seule case fermée désigne forcément une munition : balisez-la.',
      'Le compteur « restantes » suppose que vos balises sont justes : il ne le vérifie pas.',
    ],
  },

  interview: {
    but: 'Choisir la bonne posture face à six questions piège posées en direct.',
    deroule: [
      'Une question s’affiche, avec une mèche d’environ 7 secondes (moins si vous êtes fatigué·e).',
      'Vous choisissez entre trois postures : répondre sur le fond, esquiver avec élégance, ou contre-attaquer.',
      'Le verdict s’affiche aussitôt, avec une explication.',
      'Si la mèche s’éteint, c’est un blanc à l’antenne.',
      'Après la sixième question, l’interview s’arrête.',
    ],
    score: 'Pour chaque question, la meilleure posture vaut 1 point, une posture acceptable 0,4 point, une mauvaise posture ou un blanc 0. Le score est la moyenne sur les six questions.',
    commandes: 'Touchez une posture, ou appuyez sur les touches 1, 2 et 3.',
    astuces: [
      'Chiffres, prix, argent et sujets graves : répondez sur le fond. Candidature, pronostic, critique de votre propre camp, vie privée : esquivez.',
      'Contre-attaquez quand la question est une attaque personnelle ou reprend le récit de l’adversaire.',
      'Répondez toujours : même une posture moyenne vaut mieux qu’un blanc.',
    ],
  },

  cmp: {
    but: 'Conclure un accord avec le Sénat en cédant assez de points, tout en gardant le plus possible de ce qui compte pour vous.',
    deroule: [
      'Cinq articles du texte sont tirés au sort, chacun avec son importance pour vous et pour le Sénat (de un à trois points).',
      'Pour chaque article, vous choisissez de tenir, de faire un compromis, ou de céder.',
      'Céder donne au Sénat tous ses points sur l’article, le compromis la moitié, tenir rien.',
      'Une jauge indique les concessions accordées et le seuil nécessaire à l’accord, environ 40 % des points du Sénat en temps normal.',
      'Une fois les cinq choix faits, vous signez l’accord ou, faute de concessions suffisantes, passez au vote sans accord.',
    ],
    score: 'Avec un accord, le score vaut 20, plus 80 multiplié par la part de vos propres points que vous gardez (tenir garde tout, le compromis la moitié, céder rien). Sans accord, le score tombe à 15. Il n’y a pas de chrono.',
    commandes: 'Boutons « Tenir », « Compromis » et « Céder » sur chaque article.',
    astuces: [
      'Cédez en priorité les articles qui comptent beaucoup pour le Sénat et peu pour vous.',
      'Tenez les articles à trois points pour vous, sauf s’il faut absolument atteindre le seuil.',
      'Dépasser le seuil ne rapporte rien : dès qu’il est atteint, tenez tout le reste.',
    ],
  },

  sommet: {
    but: 'Faire adopter le texte du sommet article par article, en défendant les intérêts de la France, sans qu’aucun dirigeant ne refuse de signer à la fin.',
    deroule: [
      'Six dirigeants siègent autour de la table, chacun avec son humeur et ses sensibilités (climat, rigueur, souveraineté, libre-échange, social, défense).',
      'Pour chaque article, vous choisissez une option parmi trois, notée de zéro à deux étoiles d’intérêt pour la France, avec ses effets sur chaque enjeu.',
      'Chaque dirigeant gagne ou perd de l’humeur selon que l’option va dans son sens ou non.',
      'Trois apartés sont possibles : un tête-à-tête qui remonte nettement l’humeur d’un dirigeant, mais coûte 40 minutes.',
      'La séance s’ouvre à 22 heures ; chaque article prend près d’une heure, et tout s’arrête à 6 heures du matin.',
      'Cinq articles sont à négocier, six si vous êtes fatigué·e.',
    ],
    score: 'Si tous les dirigeants signent (aucun n’est furieux 😠 à la fin), le score vaut 35, plus 65 multiplié par la part des étoiles françaises obtenues, elle-même multipliée par la part des articles adoptés avant l’aube. Si un seul dirigeant refuse, le score tombe entre 10 et 35, selon les étoiles obtenues.',
    commandes: 'Touchez une option pour l’adopter ; bouton « Aparté » à côté de chaque dirigeant.',
    astuces: [
      'Surveillez les visages : un dirigeant 😐 déjà bas peut basculer en 😠 au prochain article.',
      'Gardez vos apartés pour la fin, sur le dirigeant le plus fâché.',
      'Une option à deux étoiles qui braque un pays coûte souvent plus cher qu’une option à une étoile acceptée par tous.',
    ],
  },

  visite: {
    but: 'Réussir les quatre temps d’une visite d’État sans offenser votre invité.',
    deroule: [
      'Un dirigeant étranger est tiré au sort, et la fiche du protocole donne des indices sur ses goûts et ses interdits.',
      'Vous choisissez successivement le cadeau, le menu du dîner, le thème du toast et le programme du lendemain.',
      'Chaque choix est commenté : invité ravi, poli sans plus, ou froid glacial.',
      'La visite s’arrête après le quatrième choix.',
    ],
    score: 'Un choix qui plaît vaut 1 point, un choix neutre 0,5 point, sur quatre. Un seul choix qui froisse provoque un incident : le score est alors plafonné à 45, puis divisé selon le nombre d’incidents (30 au mieux avec un incident). Une option qui plaît mais contient un interdit compte comme un incident.',
    commandes: 'Touchez une option à chaque étape.',
    astuces: [
      'Lisez la fiche avant chaque choix : les interdits (alcool, porc, pendule, droits de l’homme…) pèsent plus lourd que les goûts.',
      'Dans le doute, un choix neutre (0,5) vaut bien mieux qu’un risque d’incident.',
      'Fatigué·e, la fiche ne donne plus qu’un seul indice.',
    ],
  },

  train: {
    but: 'Arriver à l’heure à trois rendez-vous successifs en choisissant vos trains, sans épuiser votre budget.',
    deroule: [
      'La journée enchaîne trois trajets : de Paris à une première ville, puis de ville en ville.',
      'Pour chaque trajet, un tableau propose six itinéraires avec leur départ, leur arrivée prévue, leur prix et leur fiabilité.',
      'Le budget de la journée (environ 270 € en temps normal) baisse à chaque billet ; un itinéraire trop cher est grisé.',
      'Après votre choix, le voyage est joué : chaque tronçon peut prendre du retard, et un retard de plus de 8 minutes avant une correspondance la fait manquer (près d’une heure de perdue).',
      'Si aucun itinéraire n’est abordable, vous pouvez renoncer au rendez-vous.',
    ],
    score: 'Chaque rendez-vous rapporte 1 point à l’heure, 0,6 avec 15 minutes de retard au plus, 0,3 jusqu’à 40 minutes, 0 au-delà ou en cas de renoncement. La moyenne des trois compte pour 92 % du score, et l’argent qui reste à la fin pour les 8 % restants.',
    commandes: 'Touchez une ligne du tableau, puis « Trajet suivant ».',
    astuces: [
      'Un départ affiché en rouge arrive moins de 10 minutes avant le rendez-vous, voire après : le moindre retard sera fatal.',
      'Comparez l’arrivée prévue à l’heure du rendez-vous : sur les longs trajets, le car, l’Intercités et la voiture arrivent souvent trop tard.',
      'La correspondance est bon marché mais fragile (deux tronçons, une marge de 8 minutes) ; gardez de quoi payer un TGV pour le trajet le plus serré.',
    ],
  },

  cortege: {
    but: 'Conduire votre voiture jusqu’au lieu du rendez-vous, en haut à droite du plan, en un minimum de minutes.',
    deroule: [
      'Le plan est une grille de 7 × 7 rues : vous partez en bas à gauche.',
      'À chaque coup, vous avancez d’une case vers le haut, le bas, la gauche ou la droite, sur une rue libre ; chaque case coûte une minute.',
      'Les travaux 🚧 et les parcs 🌳 bloquent le passage ; les manifestations 📣 aussi, et elles se déplacent d’une case après chacun de vos mouvements.',
      'Si la foule vous encercle, vous perdez une minute de plus à attendre.',
      'Vous disposez du trajet le plus court possible plus trois minutes en temps normal (quatre si vous êtes reposé·e, deux si vous êtes épuisé·e).',
    ],
    score: 'Arriver en suivant le trajet le plus court donne 100 ; chaque minute de plus coûte 12 points, sans descendre sous 35 tant que vous arrivez. Arriver après la fin du compte à rebours donne 0.',
    commandes: 'Touchez une case voisine surlignée pour y avancer.',
    astuces: [
      'Repérez d’abord un couloir sans travaux ni parcs : ceux-là ne bougent jamais.',
      'Évitez de longer une manifestation : elle peut se glisser devant vous au coup suivant.',
      'Tout détour coûte : allez au but, même si le chemin paraît étroit.',
    ],
  },

  valise: {
    but: 'Remplir la valise avec ce qui servira vraiment pendant le déplacement, sans dépasser le poids autorisé.',
    deroule: [
      'Le programme du déplacement s’affiche (météo, cérémonies, interviews…).',
      'Douze objets sont proposés, chacun avec son poids ; les objets indispensables au programme sont toujours parmi eux.',
      'Vous ajoutez ou retirez les objets ; la jauge montre le poids, 8 kg au maximum en temps normal.',
      'Un objet qui ferait dépasser la limite est grisé.',
      'Vous fermez la valise : chaque objet est jugé indispensable, utile ou inutile, et les oublis sont signalés.',
    ],
    score: 'Chaque objet rapporte 3 points par besoin du programme qu’il couvre et 1 point par atout secondaire. Votre total est comparé à la meilleure valise possible, puis chaque besoin non couvert retire 12 points. Un objet inutile ne coûte rien d’autre que son poids. Il n’y a pas de chrono.',
    commandes: 'Touchez un objet pour l’ajouter ou le retirer, puis « Fermer la valise ».',
    astuces: [
      'Couvrez d’abord chaque ligne du programme : un oubli coûte cher.',
      'Les objets légers à double usage (écharpe tricolore, batterie, trousse de pharmacie) sont précieux.',
      'Reposé·e, la valise accepte jusqu’à un kilo de plus ; fatigué·e, jusqu’à un de moins.',
    ],
  },

  majorite: {
    but: 'Réunir au moins 289 sièges sur 577 en assemblant des groupes, avec la coalition la plus resserrée idéologiquement possible.',
    deroule: [
      'Neuf groupes, de la gauche radicale à la droite nationale, se partagent l’hémicycle ; aucun n’a la majorité seul.',
      'Votre groupe, tiré au sort, fait d’office partie de la coalition.',
      'Vous ajoutez ou retirez les autres groupes ; le total de sièges et l’écart idéologique se mettent à jour.',
      'L’écart idéologique est la distance entre le groupe le plus à gauche et le plus à droite de la coalition.',
      'Dès 289 sièges, vous pouvez signer l’accord de coalition.',
    ],
    score: 'Le jeu calcule l’écart le plus petit possible pour une majorité qui inclut votre groupe. Égaler cet écart donne 100 ; chaque point d’écart en trop coûte un peu plus d’un point de score. Dépasser la majorité de plus de 40 sièges coûte en outre un point pour quatre sièges superflus. Le score ne descend pas sous 20. Il n’y a pas de chrono.',
    commandes: 'Touchez les groupes pour les ajouter ou les retirer, puis « Signer l’accord de coalition ».',
    astuces: [
      'Partez de votre groupe et ajoutez ses voisins immédiats, d’un côté puis de l’autre.',
      'Seuls les deux groupes extrêmes comptent dans l’écart : un groupe situé entre eux ne l’augmente pas, il n’ajoute que des sièges.',
      'Retirez les groupes devenus inutiles avant de signer.',
    ],
  },

  standard: {
    but: 'Aiguiller chaque appel vers le bon ministère, le plus vite possible, pendant 30 secondes, sans laisser la file d’attente déborder.',
    deroule: [
      'Un appel s’affiche : qui appelle, et pour quoi.',
      'Vous choisissez l’un des six ministères : Santé, Éducation, Intérieur, Économie, Écologie, Justice.',
      'L’appel suivant arrive aussitôt, que votre choix ait été juste ou non ; un appel mal aiguillé est perdu.',
      'La file d’attente commence à deux appels, en gagne un toutes les trois secondes, et en perd un à chaque bon aiguillage.',
      'La partie s’arrête au bout de 30 secondes, ou dès que dix appels attendent : le standard saute.',
    ],
    score: 'Chaque bon aiguillage vaut +1, chaque erreur −0,7. Le total est rapporté à un objectif de 13 appels en temps normal (davantage si vous êtes fatigué·e) : 13 bons aiguillages sans erreur donnent 100.',
    commandes: 'Touchez ou cliquez le ministère.',
    astuces: [
      'Lisez le problème, pas la personne : un maire peut appeler pour la santé comme pour l’intérieur.',
      'Une erreur coûte presque autant qu’un bon appel rapporte : en cas de doute, prenez une demi-seconde.',
    ],
  },

  plume: {
    but: 'Remettre dans l’ordre les cinq phrases d’un discours : accroche, constat, cause, proposition, appel final.',
    deroule: [
      'Un discours est tiré au sort, et ses cinq phrases s’affichent dans le désordre.',
      'Vous touchez les phrases dans l’ordre du discours ; chacune vient remplir la ligne suivante du brouillon.',
      'Le bouton « Retirer la dernière » annule la dernière phrase placée.',
      'Dès que la cinquième phrase est placée, le discours est jugé : chaque ligne s’affiche en vert ou en rouge.',
    ],
    score: 'Cinq phrases à leur place : 100. Trois ou quatre : 60. Une ou deux : 30. Aucune : 10. Il n’y a pas de chrono.',
    commandes: 'Touchez les phrases ; « Retirer la dernière » pour corriger avant la cinquième.',
    astuces: [
      'L’accroche est une anecdote personnelle, l’appel final une exhortation (« Ensemble… », « Agissons… »).',
      'La proposition commence presque toujours par « Je propose ».',
      'Relisez avant de placer la cinquième phrase : elle valide tout.',
    ],
  },

  factcheck: {
    but: 'Classer huit affirmations entendues sur les plateaux en vraies, fausses ou trompeuses, avant la fin du chrono de chacune.',
    deroule: [
      'Une affirmation s’affiche, avec un chrono d’environ 9 secondes (moins si vous êtes fatigué·e).',
      'Vous choisissez « Vrai », « Faux » ou « Trompeur ».',
      'La bonne réponse et son explication s’affichent après chaque verdict.',
      'Si le chrono s’éteint, la réponse compte comme fausse.',
      'Au moins deux des huit affirmations sont trompeuses.',
    ],
    score: 'Chaque bon verdict vaut un huitième du score, soit 12,5 points. Une erreur ne coûte rien de plus. Le score ne descend pas sous 10.',
    commandes: 'Touchez l’un des trois boutons.',
    astuces: [
      '« Trompeur » désigne un chiffre exact mais présenté de façon abusive : petits nombres, euros courants, échantillon militant, source payée.',
      'Une affirmation entre guillemets, avec une précision entre parenthèses, est souvent trompeuse.',
      'Répondez toujours : le silence vaut une erreur.',
    ],
  },
};

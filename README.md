# Hémicycle — simulateur de carrière politique (Angular 21)

Prototype jouable : de militant·e à Président·e, **un mois par tour** — et une vie entière, jusqu’à la mort.

```bash
npm install
npm start          # http://localhost:4200
npm run build
```

Standalone components, zoneless, Signals partout.

## Comptes et sauvegardes

- **Compte Claude** (page publiée sur claude.ai) : l’identité vient de la plateforme, les sauvegardes sont privées et en
  ligne (`data/users/<id>/slot-n`, compressées en gzip), retrouvées sur tous les appareils.
- **Comptes locaux** : pseudo + mot de passe dérivé par PBKDF2-SHA-256 (150 000 itérations, sel aléatoire), propres
  au navigateur ; session mémorisée.
- **Invité·e** : sans compte, dans ce navigateur.
- Trois emplacements par compte, reprise automatique après un rechargement, enregistrement groupé (indicateur dans la
  barre du haut), export et import d’un fichier JSON pour changer d’appareil. Une ancienne sauvegarde est reprise
  dans le premier emplacement libre.
- Code : `services/auth.service.ts`, `services/save-store.ts`, `components/auth`, `components/slots`.

## Sur téléphone

- Barre du haut compacte (date, fatigue, santé, fonds) et **onglets en bas d’écran** : Agenda, Profil, Actualité
  (pastilles pour les décisions en attente et les nouvelles).
- **Barre « Terminer le mois »** toujours à portée de pouce, avec le nombre d’actions et de PA libres ; si une
  décision bloque, elle y renvoie.
- Onglets d’actions en ruban qui défile au doigt ; scènes, débats, manifestations, budgets et patrimoine en plein
  écran et défilent au doigt (la page derrière reste immobile) ; au débat, la main de cartes passe juste sous la scène.
- Champs à 16 px (pas de zoom automatique sur iOS), zones tactiles agrandies, marges de sécurité (encoche, barre
  d’accueil), nombres à la française (« 4 000 € »).

## Mécaniques

- **Un mois par tour** (`engine/calendar.ts`) : le tour 1 est janvier 2027, la date s’affiche en mois (« mars 2029 »),
  bandeau de saison sur l’agenda, page de calendrier qui tourne en fin de mois et feux d’artifice au Nouvel An.
  L’âge avance d’un douzième d’an par tour, les risques de mort sont mensuels, salaires, revenus, loyers, entretiens et
  mensualités sont mensuels, la loi de finances est annuelle et le parti clôt ses comptes chaque mois. Campagnes de 4
  (municipales), 5 (législatives, présidentielle) et 3 mois (primaire) ; présidentielle tous les 60 mois. Les anciennes
  parties hebdomadaires sont converties à l’ouverture (dates, projets, salaires, crédits).
- **Mini-jeux** (`data/minigames.ts`, `engine/minigame.ts`, `components/minigame`) : une trentaine d’actions et une
  vingtaine d’événements se jouent. Dix mécaniques, déclinées en thèmes : **poignées de main** (bain de foule, tractage,
  selfies, fête du village, dédicace — attraper les bonnes cibles, éviter les tomates), **applaudimètre** (discours,
  allocution, joute d’éloquence, festival, discours aux étoiles — lancer la phrase quand le curseur est dans la zone), **mémoire** (réviser ses fiches, décoder des glyphes extraterrestres),
  **tri** (courrier de la permanence, questions au gouvernement, matinale radio, live sur les réseaux, consultation citoyenne, message à envoyer aux étoiles), **marchandage**
  (hausse salariale, mécène, partage des circonscriptions, traité avec les Vélari — trouver le seuil caché en cinq offres),
  **pointage** (rallier les députés indécis) et **tournée** (tournée des mairies, tournée de campagne en bus : tracer sa
  route sur la carte de France, de village en village, avant la panne sèche, puis rentrer à Paris).
  Trois jeux de réflexion, inspirés des jeux du quotidien : **le mot du jour** (façon Sutom : un mot du vocabulaire
  politique en six essais, première lettre donnée, rouge pour une lettre bien placée, jaune pour une lettre mal placée,
  clavier AZERTY à l’écran), **Départodoku** (façon Metrodoku : une grille 3 × 3 croisant trois régions et trois
  propriétés — littoral, frontalier, numéro pair, initiale, nom composé, préfecture chef-lieu de région… — à remplir
  avec les 96 départements métropolitains, chacun une seule fois, en douze essais) et **Trivial politique** (façon
  Trivial Pursuit : un dé tire une couleur parmi six catégories — institutions, histoire, géographie, économie, Europe
  et monde, culture politique —, chaque bonne réponse rapporte un camembert, neuf questions au plus). Le score fixe le palier : brillant (gains ×1,5),
  réussi, mitigé (moitié), raté (presque rien, et des dégâts). La fatigue et le stress rendent le jeu plus dur. On peut
  laisser faire l’équipe (résultat moyen) ; pendant un projet au long cours, elle s’en charge. Clavier pris en charge.
- **Nouvelles actions** : fête du village, débat devant des lycéens, nuit blanche sur un dossier, matinale radio,
  dédicace, pointage pour le groupe, négocier la sortie d’une grève, nuit aux urgences, cagnotte en ligne, semi-marathon
  solidaire, vœux à la presse. **Nouveaux événements** : micro coupé, foire du canton, courrier débordant, interview
  piège, mécène, grève des cantines, vote serré, grand oral, pétanque des anciens, maires qui vous attendent, concours
  d’éloquence, challenge viral, chat de la mairie, homonyme, lettre d’enfant, drone, stagiaire sur le compte officiel ;
  et des rendez-vous du calendrier : cérémonie des vœux en janvier, vœux aux Français à l’Élysée, garden-party du 14 Juillet.
- **Encore des actions** : café politique, consultation citoyenne, festival d’été, jumelage, visite de prison, tournée de
  campagne en bus, pique-nique républicain, audit du parti (chef·fe de parti), émission de cuisine à la télé, tour de la
  circonscription à vélo. **Encore des événements** : micro tendu au festival (été), tempête de neige (hiver), Téléthon
  (décembre), bloqué·e dans le métro, militant devenu viral, mariage d’un adversaire, plume fantôme, chien adopté à la
  permanence, sondage coquille, dîner de famille houleux, permanence cambriolée, cahier de doléances qui déborde.
  Avec les jeux de réflexion : actions « Mot du jour à la radio », « Soirée quiz au bistrot », « Réviser la carte de
  France », « Jeu télévisé au profit d’une association » ; événements « Invité·e d’un jeu télévisé », « L’interro surprise
  sur la carte de France », « Le grand quiz de la rentrée politique » (septembre).
- **Votes à l’Assemblée sur l’actualité** (`engine/assembly.ts`, `data/bills.ts`, `components/assembly-vote`,
  `components/hemicycle`) : chaque mois, un texte lié au **sujet à la une** peut être inscrit à l’ordre du jour (30 textes
  sur les dix domaines, de gauche, de droite ou transpartisans). Projet de loi du gouvernement, proposition de la
  majorité ou de l’opposition. Député·e : on vote pour, contre ou on s’abstient, en suivant ou non la **consigne du
  groupe** (la suivre plaît au parti, s’en écarter fait parler de vous) ; rapporteur·e si l’on maîtrise le dossier.
  Au gouvernement : défendre le texte, accepter des amendements, négocier avec un groupe charnière, **49.3** (Matignon,
  Élysée) avec motion de censure, ou retirer le texte ; sur les propositions de loi, donner l’**avis du gouvernement**.
  Chef·fe de parti : fixer la consigne. Avant le vote, prendre la parole (selon la maîtrise du dossier, la plume, la
  collaboratrice parlementaire) ou faire basculer des collègues. **Pointage** groupe par groupe (précis avec un sondeur,
  sinon incertain : l’humeur de la majorité reste cachée), puis **dépouillement animé** dans un hémicycle de 577 sièges,
  compteurs qui défilent, tampon « Adopté » ou « Rejeté », détail par groupe. Actions « Déposer une proposition de loi »
  (député·e) et « Présenter un projet de loi » (gouvernement). Pendant un projet au long cours, on suit la consigne.
- **Guerre** (`engine/war.ts`, `components/war-panel`, onglet **Guerre**) : le président, le Premier ministre et les
  ministres régaliens (Affaires étrangères, Intérieur) peuvent **déclarer la guerre** à un État fictif (Karstanie,
  Méridia, Kantor, Zamérie, Valdovie) s’il y a des tensions ; le Parlement doit l’autoriser (article 35, vote animé).
  Ligne de front mois après mois (rapport de force : prestige, alliés, budget de la défense, conseiller diplomatique),
  soutien de l’opinion qui s’use avec les pertes, coût en milliards, menace d’attentat accrue, bilan tous les six mois.
  Offensive, frappes aériennes, réservistes, demander l’entrée en guerre d’un allié, s’adresser à la Nation, visiter les
  troupes, hommage national, cessez-le-feu. Fins : victoire, défaite (le gouvernement tombe), paix victorieuse, de
  compromis ou humiliante selon le front.
- **Emprunts** (`engine/loans.ts`, écran **Banque & emprunts**) : prêt personnel (taux selon votre solidité financière,
  35 % d’endettement au plus), crédit renouvelable (cher, et la presse finit par le savoir), prêt d’un proche (sans
  intérêts). En campagne : **prêt de campagne** versé sur le compte de campagne et avance du parti ; au-delà de 5 % des
  voix, l’État rembourse une partie des dépenses et solde d’abord ces prêts. Mensualités chaque mois, remboursement
  anticipé, fichage bancaire après une faillite.
- **Équipe** : quinze postes (`data/staff.ts`) — conseillère technique, community manager, chauffeur, coach média,
  plume, trésorier, attachée de presse, sondeur, collaboratrice parlementaire, directrice de campagne, spin doctor,
  avocate, officier de sécurité, directrice de cabinet, conseiller diplomatique — chacun avec un vrai effet. Organigramme
  dans le panneau Équipe, et **chasseur de têtes** pour pourvoir un poste vacant.

- **Une vie, pas une partie** (`engine/life.ts`) : les victoires et défaites de scénario (Grand Maître, « Vive le Roi ! »,
  taupe démasquée, banqueroute, rédaction qui vous remercie, défaite à la présidentielle…) ne terminent plus rien.
  Elles deviennent des **chapitres** (affichés en grand, listés dans le panneau « Une vie ») ; les revers ont des
  conséquences — faillite : retour à zéro et perte des mandats ; taupe démasquée : retour dans votre vrai parti ;
  coup d’État raté : cinq ans d’inéligibilité ; « plus personne ne vous écoute » : traversée du désert. **Seule la mort
  termine la partie** : vieillesse, maladie, accident ou assassinat, suivie d’une **nécrologie** (dates, cause, plus
  haute fonction, mandats, réformes, patrimoine, épitaphe, tous les chapitres).
- **Le stress tue** : au-delà de 55, il abîme la santé ; il multiplie la mortalité naturelle (×2 à 100) et expose à
  l’infarctus ou à l’AVC de surmenage (risque affiché dans « Une vie », alerte médicale à partir de 88).
- **Une fonction, des tâches** (`data/rank-events.ts`, onglet **Fonction**) : chaque rang a ses actions et ses
  événements. Militant·e : stand, réunion de section, pétition, collage, liste municipale. Conseiller·e : conseil
  municipal, permanence, projet de quartier, mariages, budget de la ville, permis contesté, délégation. Député·e :
  commission, amendements, permanence, fronde, loi controversée, mission d’information, niche parlementaire, usine qui
  ferme. Ministre (un portefeuille : « Ministre de la Santé »…) : défendre son projet de loi à l’Assemblée (débat),
  questions au gouvernement, déplacements, arbitrages, syndicats, grève au ministère, Bercy qui rabote, note qui fuite,
  recadrage — et Matignon qui vous tend les bras. **Premier·e ministre** (nouveau rang, `engine/government.ts`) :
  former le gouvernement (ouverture, fidèles, courants, experts), majorité et solidarité gouvernementale, déclaration
  de politique générale, 49.3, remaniement, séminaire, conférence sociale ; frondes, désaccords avec l’Élysée, motion
  de censure qui peut vous renverser. Chef·fe de parti : investitures, bureau et conseil national, contestation,
  alliance, trésorerie. Candidat·e : Zénith, prime time, équipe de campagne, gaffes, ralliements, fuites.
- **Scénarios d’actions** (`data/scenes-actions.ts`) : des actions jouées comme des scènes interactives —
  grande opération porte-à-porte (interphone, chien, retraitée, gardienne, militant adverse), live sur les réseaux
  (trolls, influenceur), conférence de presse (question piège, rumeur, micro resté ouvert), visite d’usine (chaîne,
  délégués, PDG, apprenti), questions au gouvernement en séance (député·e) et promotion de votre livre, qui s’ouvre à
  la fin du projet « livre-programme ». Seuils calibrés par simulation.
- **Salon de l’agriculture** (`data/scene-salon.ts`) : chaque fin février, une journée porte de Versailles en scène
  interactive — vache égérie, fromages AOP, jeune agricultrice, éleveurs en colère, PAC, stand des vins (attention
  aux verres), concours porcin, selfies, caméras. Ne pas y aller se paie quand on est un premier rôle.
- **Politique internationale** (`engine/intl.ts`, `data/intl-events.ts`, onglet **International**, panneau « Le
  monde ») : prestige, tensions, relations avec l’UE, l’Allemagne, les États-Unis, le Royaume-Uni, la Chine et l’Union
  africaine, crises entre États fictifs. Député·e : missions, groupes d’amitié, tribunes. Gouvernement : visites
  bilatérales, accords commerciaux, Conseil européen, aide au développement. Élysée : sanctions, intervention
  militaire, médiation de paix, accord climat, téléphone rouge. Événements : guerre commerciale, navire humanitaire,
  coup d’État, otages, COP, JO, espion, emprunt européen, gazoduc saboté, dissident, invasion, veto à l’ONU. Le
  prestige nourrit l’influence et la cote ; les tensions, la menace d’attentat.
- **Âge et santé** : âge de départ selon le scénario (26 ans en carrière, 52 en présidentielle…), une année tous les
  52 tours. La santé suit la courbe naturelle de l’âge, abîmée par le stress, l’épuisement et l’exposition, entretenue
  par l’hygiène de vie (onglet **Santé** : bilan, suivi nutritionnel, arrêter la cigarette, cure, grand spécialiste,
  protection policière ; footing). Sous 38 : alertes médicales. Risques annuels affichés : mortalité de Gompertz
  aggravée par une mauvaise santé, accidents (voiture de sport, voilier, fatigue au volant ; chauffeur protecteur),
  attentats (selon le rang, la menace et la protection). Espérance de vie simulée : 77 ans en moyenne.
- **Projets au long cours** (`data/projects.ts`, `engine/projects.ts`, onglet **Projets**) : des actions qui
  s’étalent sur plusieurs mois et réservent des points d’action chaque mois — écrire un livre-programme, tour de
  France des territoires, campagne d’implantation, tisser son réseau, reprendre des études, fonder un think tank,
  mission d’information et proposition de loi (député·e), grande réforme (ministre), plan de relance (Matignon),
  refondation du parti, grand chantier et tournée diplomatique (Élysée), grande enquête (journaliste), mémoires
  (ancien·ne président·e), six mois au vert et année sabbatique (de 2 à 12 mois). Les petits projets réservent 2 à 4 PA
  par mois ; les **gros projets** accaparent l’agenda : il ne reste que **3 PA** par mois (quatre mois et plus), **2 PA**
  à partir de six mois. Un peu d’effet chaque mois, beaucoup
  à l’arrivée (parfois avec un risque). **S’y consacrer jusqu’au bout** fait défiler les mois : les petites
  décisions se règlent seules (le choix le plus prudent) et l’on est rappelé·e dès qu’il se passe quelque chose
  d’important (campagne, résultats, promotion, chapitre, alerte médicale, crise grave, budget). Le projet continue
  ensuite chaque mois (bilan « Projet 3/6 mois » à chaque fin de mois) ; on peut l’abandonner. Si une décision
  importante attend, il faut la trancher avant de s’y consacrer. C’est ainsi que le temps passe vite, sans ellipse abstraite.
  **Se retirer de la vie publique** (dès 50 ans ou après l’Élysée) fait défiler les années jusqu’à la nécrologie.
- **Élection présidentielle à date fixe** (`engine/presidency.ts`) : avril 2027, puis tous les cinq ans.
  Bouton **« Se déclarer candidat·e à la présidence »** (jusqu’à 18 mois avant, popularité 12 minimum) ; il faut
  **500 parrainages** d’élus avant l’ouverture de la campagne (actions « Chercher des parrainages », « Tournée des maires
  ruraux », appareil du parti, événements). Sans l’appui du parti, c’est une candidature dissidente (le chef du parti se
  présente aussi). La primaire se tient dans l’année qui précède et vaut déclaration. Campagne de cinq mois,
  programme, sondages, débat décisif, soirée électorale. Sans vous, les PNJ se disputent l’Élysée ; l’alternance
  fait tomber les ministres du camp battu.
- **Présidence** : panneau « Palais de l’Élysée » — cote de confiance (usure du pouvoir), majorité à l’Assemblée
  (cohabitation possible), sécurité, menace, Premier ministre, réformes. Onglet **Élysée** : allocution, Conseil des
  ministres, réforme (adoptée si majorité), 49.3, dissolution (législatives anticipées), référendum, voyage d’État,
  Conseil de défense, protection du GSPR, bain de foule, conférence de presse, changer de Premier ministre, Congrès à
  Versailles, chef d’État reçu. Crises du quinquennat : attentat, épidémie, grève générale, crise diplomatique,
  catastrophe naturelle, scandale d’État, menace d’attentat, homme armé dans la foule (mortel), motion de censure,
  destitution (article 68), sommets, rumeurs sur votre santé, cohabitation. Deux mandats consécutifs au plus,
  démission possible (élection anticipée), puis **ancien·ne président·e** : conférences, mémoires, fondation, adouber
  un héritier — et une affaire du quinquennat qui ressurgit.
- **Événements de la vie** (`data/life-events.ts`) : malaise en meeting, rumeurs sur la santé, médecin qui alerte,
  « trop vieux pour gouverner ? », petit-enfant, ami disparu, héritage, marathon, menaces de mort, agression, colis
  piégé, chauffeur qui s’endort, sondage d’outsider, élus qui marchandent leurs parrainages, pressions sur les parrains,
  l’Élysée vous consulte, médiation internationale.
- **Mois** : planifier des actions (points d’action, énergie, argent, capital politique), puis clore le mois.
- **Débats au tour par tour** : 3 à 5 manches, chacune sur un sujet. Main de 5 arguments construite à partir de vos stats et dossiers.
  Triangle Faits > Émotion > Attaque > Faits, la Parade renvoie l’Attaque, les Faits ne valent que sur le sujet de la manche.
  Jauges de sang-froid (K.-O. possible), audience de −100 à +100, séries, intention adverse parfois devinée (et parfois feinte),
  adversaire qui s’adapte si vous répétez le même coup. Déclencheurs : face-à-face (action), joute dans l’hémicycle,
  duel au bureau national, attaque d’un rival, crise nationale, débat décisif avant chaque scrutin.
- **Clivage gauche-droite** : cinq partis placés sur l’axe, chaque courant a sa position. Dans les débats, des propositions
  marquées à gauche ou à droite séduisent le public du même bord, déplacent votre ligne (volte-face pénalisées) et font
  monter ou baisser le soutien des courants selon qu’elles vous en rapprochent. Aux élections : la primaire récompense la
  fidélité à la ligne du parti, les scrutins nationaux le centre.
- **Programme présidentiel** : 20 questions (4 par domaine), 4 options chacune, avec position, coût en Md€/an et effet
  sur cinq électorats. Bilan en direct : positionnement, financement, cohérence, électorats, réaction des courants,
  effet estimé au premier tour. Une fois présenté, il fixe la ligne, renforce les dossiers et fournit les cartes
  « mesure du programme » des débats. Scénario « Campagne présidentielle » pour y jouer directement.
- **Dix dossiers** : économie, social, écologie, sécurité, justice, éducation, santé, numérique, territoires, diplomatie.
- **Manifestations** : préparation (cause de gauche, de droite ou transpartisane, échelle, deux alliés au plus), puis
  mobilisation, cortège, imprévu et discours. Jauges d’affluence, de tension (débordements à 80), de médias et d’image ;
  bilan « selon les organisateurs / selon la police ».
- **Scènes interactives** (moteur générique `engine/scene.ts`, contenus dans `data/scenes.ts`) : marché du dimanche,
  grand meeting, médiation sociale, commission d’enquête, cellule de crise (ministre, lors d’une crise), alliance
  électorale (direction du parti). Chaque scène : 3 jauges, 4 à 5 étapes tirées au sort, risques, seuils de rupture,
  score et conséquences. Ajouter une scène = écrire un objet `SceneDef`.
- **Argent** (onglet dédié) : chronique, conférences, livre, mission de conseil ; enveloppes, emplois fictifs, marché
  public arrangé (scène). Chaque affaire illégale alimente un compteur : le parquet financier finit par enquêter.
- **Dossiers plus exigeants** : rendements décroissants à l’étude, érosion rapide au-delà de 50, « bouleversements »
  (réforme surprise, rapport choc…) qui font chuter un dossier bien maîtrisé.
- **Recrues et boosters** : chaque recrue a un poste, une rareté (commun, rare, légendaire), des atouts et des travers.
  Les boosters (début de partie, promotions, victoires éclatantes, objectifs, succès) dévoilent trois candidats.
- **Scénario « Retour à la royauté »** : diriger la Ligue de la Couronne (fictive), faire monter soutien, légitimité du
  prétendant et ralliement de l’armée ; référendum (voie légale) ou coup de force institutionnel.
- **Scénario « Franc-maçon »** : loge et obédience fictives, grades d’Apprenti à Grand Maître, planches en tenue,
  fraternité et discrétion, faveurs des frères, révélations ; grand chapitre : Grand Maître et membre du gouvernement.
- **Fonder son propre parti** : dès la création de la partie (nom, couleur, position sur l’axe, avec aperçu face aux
  partis existants) ou en cours de route (« Claquer la porte » dans le panneau du parti : 3 000 € et 20 de capital,
  gratuit si des dissidents vous le proposent). Vous en restez le chef quel que soit votre rang, un proche peut vous
  suivre, deux cofondateurs arrivent. Le parti démarre minuscule (900 adhérents, budget à l’échelle de sa taille) et
  subit un malus électoral d’implantation qui s’efface en un an.
- **Scénario « Éditorialiste »** (`data/press.ts`, `engine/press.ts`) : journaliste dans un média fictif (Le Courrier
  national, Info24 ou Radio Hexagone : la presse fait la réputation, la télé l’audience). Grades de Pigiste à
  Directeur·rice de la rédaction, salaire, audience, réputation, indépendance face au propriétaire et à sa ligne,
  scoops. Onglet Rédaction (12 actions : éditorial, chronique, polémique, enquête, confidences en off, émission en
  direct, interview exclusive, interview contradictoire = débat, livre-enquête…) et deux scènes (enquête, direct).
  Grand chapitre : diriger la rédaction avec 65 d’audience et 60 d’influence. Dans une partie normale, la Rédaction s’ouvre
  par un événement (offre de chronique), avec un risque de « double casquette » pour les élus.
- **Scénario « Premier contact »** (`engine/alien.ts`, `data/alien-events.ts`, `components/contact-panel`) : un signal
  venu de Proxima du Centaure. Député·e de 41 ans à la tête de la cellule interministérielle du Premier contact face à une
  civilisation fictive, les Vélari. Cinq phases (le signal, l’approche, en orbite, la rencontre, l’ambassade), quatre
  jauges : compréhension et confiance des Vélari à faire monter, panique du pays et rivalité des grandes puissances à
  contenir. Chaque phase dure au moins quatre mois et se mérite de plus en plus. Onglet Premier contact (décoder les
  glyphes, nuit à Nançay, linguistes, réponse de l’humanité, cellule de crise, allocution, ONU, secret-défense, présent
  culturel, armées en alerte, échange scientifique, monter à bord, traité de coexistence, ambassade), douze événements
  (secte, astronome, puissances qui s’impatientent, second message, vaisseau visible à l’œil nu, virus, Hollywood,
  religions, taupe…) et un panneau animé où la soucoupe grossit et descend vers la Terre. Grand chapitre : « Premier·e
  ambassadeur·rice de la Terre ». Fins malheureuses : la grande peur (panique à 95), le silence des étoiles (confiance au
  plus bas une fois le vaisseau en orbite), le contact confisqué (rivalité à 100). Dans une partie normale, le dossier peut
  s’ouvrir par un événement rare (« Un signal venu des étoiles »), à partir de député·e.
- **Scénario « Infiltré·e »** (`engine/mole.ts`) : choisissez votre vrai camp et le parti à infiltrer. Vous y prenez
  votre carte sous couverture. Onglet Infiltration (écouter aux portes, fouiller la fédération, copier le fichier des
  adhérents, retourner un cadre, semer la zizanie, organiser des fuites, jouer les agents doubles, faire du zèle,
  transmettre vos rapports à l’officier traitant) et deux scènes (réunion secrète du bureau, grand déballage).
  Couverture qui s’use (surtout si votre ligne s’écarte de celle du parti), renseignements qui se périment, officier
  qui s’impatiente, soupçons du service d’ordre. Grand chapitre : transmettre 150 renseignements puis réussir le grand
  déballage, ou prendre la tête du parti infiltré. Revers : démasqué·e (retour dans votre vrai camp).
- **Équilibre bonus / malus** : contrepoids automatiques sur toutes les actions (au moins 70 à 75 % de la valeur des
  gains rendue en malus visibles selon la nature de l’action : stress, exposition, courants, dynamique…), lassitude
  (répéter une action d’un mois sur l’autre : gains −20 %, −40 %…, jusqu’à −60 %), pertes amplifiées quand une
  jauge est haute, et contreparties sur les choix d’événements trop avantageux.
- **Scènes et manifestations équilibrées** (`data/balance.ts`) : chaque choix a un prix (pertes au moins égales à
  40 % des gains, posées de préférence sur la jauge « danger »), et aucun choix ne domine : la valeur nette de chaque
  option reste proche de la moyenne de l’étape. Seuils de réussite recalibrés par simulation.
- **Couronne et Loge dans une partie normale** : les onglets n’existent pas au départ. Ils ne s’ouvrent que par un
  événement aléatoire (4 % par mois chacun, à partir du quatrième mois) : émissaire du prétendant ou bal légitimiste
  pour la Couronne, parrainage ou tenue blanche pour la Loge. Une fois membre, d’autres événements (« vos amitiés
  royalistes font la une », « un frère vous demande un service ») permettent aussi d’en sortir.
- **Événements aléatoires** (`data/random-events.ts`) : 6 portes d’entrée (Couronne, Loge, Rédaction) et 86 événements
  à choix — vie privée, médias, coulisses, patrimoine (déclaration, paparazzi, krach, cambriolage…), caisse du parti,
  rédaction (diffamation, rachat du média, source menacée…), parti fondé (caisses vides, ralliements), imprévus
  (canicule, tempête, deepfake, agriculteurs, duel télévisé, marché de Noël…). Certains lancent un débat, une scène ou
  une manifestation. Plus 38 actualités sans choix (dont Bourse, immobilier, médias). Délai avant répétition,
  conditions de rang et d’argent par choix ; dans le scénario Éditorialiste, les événements de rédaction sont trois fois
  plus fréquents.
- **Banqueroute** (`engine/bankruptcy.ts`) : sous zéro, découvert et agios (4 %/mois) ; après 2 mois ou
  12 000 € de découvert, la banque saisit le tribunal : vendre vos biens, emprunter à un proche ou à la banque, demander
  une avance au parti, ou déclarer la faillite personnelle (biens vendus, équipe partie, réputation en lambeaux).
  Deuxième faillite ou 40 000 € de dettes : fin de carrière.
- **Indicateurs vitaux** en haut de l’écran : fatigue (énergie et stress combinés, projection après l’agenda prévu,
  alerte au-delà de 80), santé et âge, fonds personnels (découvert, banqueroute).
- **Gains et pertes affichés** sur chaque action (pastilles vertes et rouges, conséquences d’un échec au survol du
  « risque »). Les actions aux gros bonus portent désormais des contreparties nettes : stress, exposition, perte de
  dynamique ou d’influence, image écornée (`engine/describe.ts`).
- **Animations 2D** (`services/fx.service.ts`, `components/fx-layer`, `components/emblem`) : jeton qui vole vers
  l’agenda, page de calendrier en fin de mois (avec la saison), feux d’artifice et vœux au Nouvel An, hémicycle qui se
  colore siège par siège au dépouillement, éclair et tampon « Mobilisation générale », ligne de front qui avance ou
  recule (chevrons), fumée sur le panneau de guerre, billets qui volent vers vos fonds à l’emprunt, une de journal qui
  tourne sur elle-même au scandale, avion qui traverse l’écran en voyage, soucoupe volante et rayon tracteur à chaque
  phase du premier contact, cœur et électrocardiogramme à l’alerte
  médicale, projecteurs à la promotion, bulletin qui glisse dans l’urne, ondes de micro, pluie de tomates (huées,
  mini-jeu raté), pluie sur les revers et neige en décembre, chiffres flottants au-dessus des jauges et des fonds, confettis ou
  éclats et secousse à la résolution des décisions, illustrations animées des décisions (télé, journal, gyrophare,
  drapeau, épées, poignée de main, trophée, éclair, pièces, soucoupe volante), tampons « Promotion ! », « Nouveau chapitre », « Revers », « In memoriam ».
  Soirée électorale animée (compte à rebours de 20 h, barres qui montent, second tour, verdict avec confettis ou
  pluie), bandeau « Flash info » sur les coups durs, pièces qui volent vers vos fonds ou s’en échappent, gerbes sur
  les objectifs atteints, tampon « Transmis — Top secret », radar de la mission d’infiltration, jauges qui rebondissent.
  Tout est désactivé si le système demande de réduire les animations.
- **Qui paie ?** Les actions militantes payantes (tracts, meeting, sondage, note de think tank, fête de section…) peuvent
  être réglées sur vos fonds perso ou par la caisse du parti. Si vous dirigez le parti, c’est sa trésorerie qui paie ;
  sinon la fédération accorde une enveloppe hebdomadaire (selon le rang et le soutien interne) et chaque tranche de
  1 000 € coûte 1 point de capital politique. Trop tirer sur la caisse fait réagir le trésorier. Argent, Couronne, Loge
  et Repos restent à votre charge.
- **Patrimoine** (`data/assets.ts`, `engine/patrimoine.ts`) : 19 biens en cinq rayons (vélo, costume sur mesure, coach,
  berline avec chauffeur = +1 PA, pied-à-terre, appartement locatif, maison de campagne, villa, montre, toile, voilier,
  épargne, actions, cryptos…). Bonus hebdomadaires, entretien, crédit immobilier (20 % d’apport), valeur qui évolue,
  revente, vente forcée en cas de découvert. Certains biens débloquent des actions (dîner chez vous, vernissage,
  séjour à la campagne, location de la villa). Patrimoine net et ostentation forment une **image publique**
  (modeste → ostentatoire) qui fait perdre de la popularité chaque mois, d’autant plus que vous êtes connu·e et à gauche.
- **Budget du parti** (quand vous le dirigez) : cotisations, financement public, dons ; six postes de dépenses ;
  adhérents ; clôture mensuelle ; faillite et dons suspects.
- **Budget de l’État** (au gouvernement) : neuf missions à ±20 %, cinq leviers fiscaux, déficit en % du PIB, effet sur
  les électorats et les courants, vote à l’Assemblée, 49.3 et motion de censure. Scénario « Ministre à Bercy ».
- **Équipe** : six recrues (conseillère technique, coach média, plume, trésorier, directrice de campagne, spin doctor),
  chacune avec un avantage et un salaire hebdomadaire.
- **Objectifs** : trois défis actifs avec échéance et récompense (point de compétence, PA bonus, capital…) ; plus d’objectifs « rallier un courant ».
- **Crises nationales** : inondations, grève, krach, sommet européen, violences urbaines ; verrouillent l’actualité deux mois.

## Arborescence

```
src/app/game/
├── models/game.models.ts      Tous les types (Player, Faction, Npc, Decision, Effect…)
├── data/                      Contenu de jeu, sans logique
│   ├── ranks.ts               Rangs, conditions de promotion, scrutins, plafonds
│   ├── actions.ts             Catalogue des actions hebdomadaires
│   ├── decisions.ts           Gabarits de décisions (interview, scandale, crise, congrès…)
│   ├── programme.ts           Les 20 questions du programme présidentiel et les électorats
│   ├── protest.ts             Causes et événements des manifestations
│   ├── budget.ts              Postes du parti, missions et impôts de l’État
│   ├── scene-types.ts         Format déclaratif d’une scène
│   ├── scenes.ts              Les scènes interactives (dont royauté, loge, marché arrangé)
│   ├── recruits.ts            Traits, raretés, noms des recrues
│   ├── random-events.ts       Événements aléatoires
│   ├── life-events.ts         Événements de la vie : santé, âge, menaces, course à l’Élysée
│   ├── rank-events.ts         Événements propres à chaque fonction
│   ├── projects.ts            Projets au long cours
│   ├── intl-events.ts         Événements internationaux
│   ├── scene-salon.ts         Scène du Salon de l’agriculture
│   ├── scenes-actions.ts      Scénarios d’actions : porte-à-porte, live, conférence de presse, usine, QAG, livre
│   ├── assets.ts              Biens achetables (patrimoine)
│   ├── press.ts               Médias, grades et salaires du scénario Éditorialiste
│   ├── alien-events.ts        Événements du Premier contact (et le signal en partie normale)
│   ├── departements.ts        Les 96 départements et les critères de la grille Départodoku
│   ├── quiz.ts                Questions du Trivial politique, par catégorie
│   ├── staff.ts               Membres d’équipe recrutables
│   └── world.ts               Partis, PNJ, contacts, état initial
├── engine/                    Fonctions pures, testables sans Angular
│   ├── rng.ts                 PRNG déterministe (seed sauvegardée)
│   ├── debate.ts              Moteur de débat : deck, manches, triangle, feintes, récompenses
│   ├── objectives.ts          Génération, progression et récompense des objectifs
│   ├── programme.ts           Bilan du programme, présentation, cartes de débat
│   ├── protest.ts             Moteur des manifestations
│   ├── budget.ts              Clôture mensuelle du parti, loi de finances, vote, 49.3
│   ├── scene.ts               Moteur générique des scènes
│   ├── recruits.ts            Boosters, embauche, effets hebdomadaires des personnalités
│   ├── scenarios.ts           Mécaniques des scénarios royauté, franc-maçon, éditorialiste
│   ├── patrimoine.ts          Achat, crédit, revente, image publique de la richesse
│   ├── bankruptcy.ts          Découvert, agios, procédure, faillite personnelle
│   ├── calendar.ts            Un tour = un mois : dates, durées, conversions
│   ├── loans.ts               Emprunts : offres, mensualités, prêt de campagne, remboursement de l’État
│   ├── assembly.ts            Votes à l’Assemblée : groupes, pointage, interventions, dépouillement
│   ├── war.ts                 Guerre : déclaration, front, alliés, paix
│   ├── staff-perks.ts         Effets mensuels des postes de l’équipe
│   ├── minigame.ts            Mini-jeux : file, paliers, résolution
│   ├── describe.ts            Effets en langage clair (gains / pertes)
│   ├── mole.ts                Scénario Infiltré·e : couverture, rapports, soupçons
│   ├── alien.ts               Scénario Premier contact : phases, jauges, fins
│   ├── life.ts                Âge, santé, mort, chapitres de vie, retraite, nécrologie
│   ├── presidency.ts          Calendrier présidentiel, candidature, parrainages, présidence, crises
│   ├── government.ts          Portefeuilles, Matignon, censure, Salon de l’agriculture
│   ├── projects.ts            Lancement, avancement et aboutissement des projets
│   ├── intl.ts                Relations, prestige, tensions, crises internationales
│   ├── press.ts               Audience, réputation, propriétaire, promotions
│   ├── founding.ts            Fonder son parti (au départ ou en cours de partie)
│   └── effects.ts             applyEffects(), risques, dépenses, plafond légal
├── services/
│   ├── game-state.service.ts        Signal unique GameState + mutate() transactionnel
│   ├── action-planner.service.ts    Plan du mois (PA, énergie, €, capital)
│   ├── turn.service.ts              Orchestration fin de mois + décisions
│   ├── progression.service.ts       Rangs, énergie/stress/burn-out, revenus, compétences, nominations
│   ├── media.service.ts             Agenda médiatique, invitations, fuites/scandales
│   ├── party-management.service.ts  Courants, cohésion, direction, motion de défiance
│   ├── network.service.ts           Confiance, renvois d'ascenseur
│   ├── rival-ai.service.ts          PNJ : attaques, rumeurs, soutiens
│   ├── election-engine.service.ts   Investiture, campagne, sondages, débat décisif, 2 tours, recours
│   ├── debate.service.ts            Pilotage du débat en cours
│   ├── program.service.ts           Programme présidentiel
│   ├── protest.service.ts           Manifestation en cours
│   ├── budget.service.ts            Budgets du parti et de l’État
│   ├── scene.service.ts             Scène interactive en cours
│   ├── patrimoine.service.ts        Achats et ventes de biens
│   ├── fx.service.ts                Effets visuels 2D éphémères
│   └── team.service.ts              Recrutement / renvoi
└── components/
    ├── dashboard/        Grille 3 colonnes + écran de fin
    ├── debate-arena/     ★ Plateau de débat (overlay)
    ├── objectives-panel/ Objectifs en cours
    ├── program-builder/  Construction du programme présidentiel (overlay)
    ├── protest/          Manifestation (overlay)
    ├── budget/           Budgets du parti et de l’État (overlay)
    ├── scene/            Écran générique des scènes interactives (overlay)
    ├── booster/          Ouverture d’un booster (overlay)
    ├── patrimoine/       Biens, boutique, image publique (overlay)
    ├── party-form/       Formulaire de création de parti
    ├── vitals/           Fatigue, santé et fonds dans la barre du haut
    ├── life-panel/       Âge, santé, risques, chapitres, retraite
    ├── presidency-panel/ Présidentielle (déclaration, parrainages) et Palais de l’Élysée
    ├── government-panel/ Matignon ou votre ministère
    ├── world-panel/      Le monde : prestige, tensions, relations, crise
    ├── war-panel/        Guerre : ligne de front, opinion, pertes, alliés
    ├── assembly-vote/    Scrutin public : texte, pointage, interventions, vote, résultat
    ├── hemicycle/        Hémicycle SVG de 577 sièges, dépouillement animé
    ├── bank/             Banque & emprunts
    ├── minigame/         Les dix mini-jeux (games/ : mot du jour, Départodoku, Trivial politique)
    ├── contact-panel/    Panneau du Premier contact (ciel, vaisseau, jauges)
    ├── fx-layer/         Calque d’animations 2D
    ├── emblem/           Illustrations animées des décisions
    ├── election-night/   Soirée électorale animée
    ├── found-party/      Fonder son parti en cours de partie (overlay)
    ├── recruit-card/     Carte d’une recrue
    ├── scenario-panel/   Tableau de bord Couronne / Loge
    ├── stance-axis/      Axe gauche-droite réutilisable
    ├── team-panel/       Équipe
    ├── week-planner/     ★ Gestion du mois
    ├── decision-panel/   ★ Prototype : prise de décision
    ├── profile-panel/    Jauges, finances, prochain palier, dossiers & compétences
    ├── party-panel/      Courants, rivaux, réseau
    ├── election-panel/   Sondages, tendance, plafond de dépenses
    ├── news-feed/        Fil d'actualité
    └── new-game/         Création du personnage
```

## Principes

1. **Un seul signal d'état.** `GameStateService.mutate(fn)` clone l'état, applique `fn(draft, rng)`, publie et sauvegarde. Les composants ne lisent que des `computed`.
2. **Les systèmes sont des fonctions `weekly(draft, rng)`.** `TurnService.endWeek()` les enchaîne dans une seule transaction : actions → mois+1 → carrière → médias → parti → réseau → rivaux → scrutins.
3. **Un langage d'effets commun.** Actions, choix de décisions, faveurs et résultats d'élection produisent tous des `Effect[]`. Pour ajouter du contenu, on modifie surtout `data/`.
4. **Les risques sont affichés.** Chaque `RiskProfile` est modulé par une stat ou par la maîtrise du dossier, et le pourcentage de succès est affiché sur chaque choix. Débattre sans avoir étudié le sujet reste possible, mais c'est risqué.

## Ajouter une action

```ts
// data/actions.ts
{
  id: 'tractage', label: 'Tractage au marché', category: 'terrain', minRank: 'militant',
  description: '…', cost: { ap: 1, energy: 5 },
  effects: [{ kind: 'stat', stat: 'popularity', delta: 1 }, { kind: 'momentum', delta: 4 }],
}
```

## Pistes suivantes

- Carte électorale par territoire (sondages par région, ciblage du porte-à-porte)
- Héritiers et dynasties : rejouer un enfant ou un dauphin après la mort
- Tests unitaires sur `engine/` (fonctions pures + RNG à seed fixe)

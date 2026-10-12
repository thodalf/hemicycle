# Hémicycle — simulateur de carrière politique (Angular 21)

Prototype jouable : de militant·e à Président·e, une semaine par tour — et une vie entière, jusqu’à la mort.

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

## Mécaniques

- **Une vie, pas une partie** (`engine/life.ts`) : les victoires et défaites de scénario (Grand Maître, « Vive le Roi ! »,
  taupe démasquée, banqueroute, rédaction qui vous remercie, défaite à la présidentielle…) ne terminent plus rien.
  Elles deviennent des **chapitres** (affichés en grand, listés dans le panneau « Une vie ») ; les revers ont des
  conséquences — faillite : retour à zéro et perte des mandats ; taupe démasquée : retour dans votre vrai parti ;
  coup d’État raté : cinq ans d’inéligibilité ; « plus personne ne vous écoute » : traversée du désert. **Seule la mort
  termine la partie** : vieillesse, maladie, accident ou assassinat, suivie d’une **nécrologie** (dates, cause, plus
  haute fonction, mandats, réformes, patrimoine, épitaphe, tous les chapitres).
- **Âge et santé** : âge de départ selon le scénario (26 ans en carrière, 52 en présidentielle…), une année tous les
  52 tours. La santé suit la courbe naturelle de l’âge, abîmée par le stress, l’épuisement et l’exposition, entretenue
  par l’hygiène de vie (onglet **Santé** : bilan, suivi nutritionnel, arrêter la cigarette, cure, grand spécialiste,
  protection policière ; footing). Sous 38 : alertes médicales. Risques annuels affichés : mortalité de Gompertz
  aggravée par une mauvaise santé, accidents (voiture de sport, voilier, fatigue au volant ; chauffeur protecteur),
  attentats (selon le rang, la menace et la protection). Espérance de vie simulée : 77 ans en moyenne.
- **Laisser passer le temps** : ellipses d’un mois, six mois, un an ou cinq ans. Les petites décisions se règlent
  seules (le choix le plus prudent, sans engagement), et l’ellipse s’arrête dès qu’un événement important survient
  (campagne qui s’ouvre, résultats, promotion, chapitre, alerte médicale, crise grave, budget, décès).
  **Se retirer de la vie publique** (dès 50 ans ou après l’Élysée) fait défiler les années jusqu’à la nécrologie.
- **Élection présidentielle à date fixe** (`engine/presidency.ts`) : avril 2027 (semaine 16), puis tous les cinq ans.
  Bouton **« Se déclarer candidat·e à la présidence »** (jusqu’à 78 semaines avant, popularité 12 minimum) ; il faut
  **500 parrainages** d’élus avant l’ouverture de la campagne (actions « Chercher des parrainages », « Tournée des maires
  ruraux », appareil du parti, événements). Sans l’appui du parti, c’est une candidature dissidente (le chef du parti se
  présente aussi). La primaire se tient dans l’année qui précède et vaut déclaration. Campagne de huit semaines,
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
- **Semaine** : planifier des actions (points d’action, énergie, argent, capital politique), puis clore la semaine.
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
- **Scénario « Infiltré·e »** (`engine/mole.ts`) : choisissez votre vrai camp et le parti à infiltrer. Vous y prenez
  votre carte sous couverture. Onglet Infiltration (écouter aux portes, fouiller la fédération, copier le fichier des
  adhérents, retourner un cadre, semer la zizanie, organiser des fuites, jouer les agents doubles, faire du zèle,
  transmettre vos rapports à l’officier traitant) et deux scènes (réunion secrète du bureau, grand déballage).
  Couverture qui s’use (surtout si votre ligne s’écarte de celle du parti), renseignements qui se périment, officier
  qui s’impatiente, soupçons du service d’ordre. Grand chapitre : transmettre 150 renseignements puis réussir le grand
  déballage, ou prendre la tête du parti infiltré. Revers : démasqué·e (retour dans votre vrai camp).
- **Équilibre bonus / malus** : contrepoids automatiques sur toutes les actions (au moins 70 à 75 % de la valeur des
  gains rendue en malus visibles selon la nature de l’action : stress, exposition, courants, dynamique…), lassitude
  (répéter une action d’une semaine sur l’autre : gains −20 %, −40 %…, jusqu’à −60 %), pertes amplifiées quand une
  jauge est haute, et contreparties sur les choix d’événements trop avantageux.
- **Scènes et manifestations équilibrées** (`data/balance.ts`) : chaque choix a un prix (pertes au moins égales à
  40 % des gains, posées de préférence sur la jauge « danger »), et aucun choix ne domine : la valeur nette de chaque
  option reste proche de la moyenne de l’étape. Seuils de réussite recalibrés par simulation.
- **Couronne et Loge dans une partie normale** : les onglets n’existent pas au départ. Ils ne s’ouvrent que par un
  événement aléatoire (4 % par semaine chacun, à partir de la semaine 4) : émissaire du prétendant ou bal légitimiste
  pour la Couronne, parrainage ou tenue blanche pour la Loge. Une fois membre, d’autres événements (« vos amitiés
  royalistes font la une », « un frère vous demande un service ») permettent aussi d’en sortir.
- **Événements aléatoires** (`data/random-events.ts`) : 6 portes d’entrée (Couronne, Loge, Rédaction) et 86 événements
  à choix — vie privée, médias, coulisses, patrimoine (déclaration, paparazzi, krach, cambriolage…), caisse du parti,
  rédaction (diffamation, rachat du média, source menacée…), parti fondé (caisses vides, ralliements), imprévus
  (canicule, tempête, deepfake, agriculteurs, duel télévisé, marché de Noël…). Certains lancent un débat, une scène ou
  une manifestation. Plus 38 actualités sans choix (dont Bourse, immobilier, médias). Délai avant répétition,
  conditions de rang et d’argent par choix ; dans le scénario Éditorialiste, les événements de rédaction sont trois fois
  plus fréquents.
- **Banqueroute** (`engine/bankruptcy.ts`) : sous zéro, découvert et agios (1,5 %/semaine) ; après 3 semaines ou
  8 000 € de découvert, la banque saisit le tribunal : vendre vos biens, emprunter à un proche ou à la banque, demander
  une avance au parti, ou déclarer la faillite personnelle (biens vendus, équipe partie, réputation en lambeaux).
  Deuxième faillite ou 25 000 € de dettes : fin de carrière.
- **Indicateurs vitaux** en haut de l’écran : fatigue (énergie et stress combinés, projection après l’agenda prévu,
  alerte au-delà de 80), santé et âge, fonds personnels (découvert, banqueroute).
- **Gains et pertes affichés** sur chaque action (pastilles vertes et rouges, conséquences d’un échec au survol du
  « risque »). Les actions aux gros bonus portent désormais des contreparties nettes : stress, exposition, perte de
  dynamique ou d’influence, image écornée (`engine/describe.ts`).
- **Animations 2D** (`services/fx.service.ts`, `components/fx-layer`, `components/emblem`) : jeton qui vole vers
  l’agenda, page de calendrier en fin de semaine, chiffres flottants au-dessus des jauges et des fonds, confettis ou
  éclats et secousse à la résolution des décisions, illustrations animées des décisions (télé, journal, gyrophare,
  drapeau, épées, poignée de main, trophée, éclair, pièces), tampons « Promotion ! », « Nouveau chapitre », « Revers », « In memoriam ».
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
  (modeste → ostentatoire) qui fait perdre de la popularité chaque semaine, d’autant plus que vous êtes connu·e et à gauche.
- **Budget du parti** (quand vous le dirigez) : cotisations, financement public, dons ; six postes de dépenses ;
  adhérents ; clôture mensuelle ; faillite et dons suspects.
- **Budget de l’État** (au gouvernement) : neuf missions à ±20 %, cinq leviers fiscaux, déficit en % du PIB, effet sur
  les électorats et les courants, vote à l’Assemblée, 49.3 et motion de censure. Scénario « Ministre à Bercy ».
- **Équipe** : six recrues (conseillère technique, coach média, plume, trésorier, directrice de campagne, spin doctor),
  chacune avec un avantage et un salaire hebdomadaire.
- **Objectifs** : trois défis actifs avec échéance et récompense (point de compétence, PA bonus, capital…).
- **Crises nationales** : inondations, grève, krach, sommet européen, violences urbaines ; verrouillent l’actualité trois semaines.

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
│   ├── assets.ts              Biens achetables (patrimoine)
│   ├── press.ts               Médias, grades et salaires du scénario Éditorialiste
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
│   ├── describe.ts            Effets en langage clair (gains / pertes)
│   ├── mole.ts                Scénario Infiltré·e : couverture, rapports, soupçons
│   ├── life.ts                Âge, santé, mort, chapitres de vie, retraite, nécrologie
│   ├── presidency.ts          Calendrier présidentiel, candidature, parrainages, présidence, crises
│   ├── press.ts               Audience, réputation, propriétaire, promotions
│   ├── founding.ts            Fonder son parti (au départ ou en cours de partie)
│   └── effects.ts             applyEffects(), risques, dépenses, plafond légal
├── services/
│   ├── game-state.service.ts        Signal unique GameState + mutate() transactionnel
│   ├── action-planner.service.ts    Plan de la semaine (PA, énergie, €, capital)
│   ├── turn.service.ts              Orchestration fin de semaine + décisions
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
    ├── fx-layer/         Calque d’animations 2D
    ├── emblem/           Illustrations animées des décisions
    ├── election-night/   Soirée électorale animée
    ├── found-party/      Fonder son parti en cours de partie (overlay)
    ├── recruit-card/     Carte d’une recrue
    ├── scenario-panel/   Tableau de bord Couronne / Loge
    ├── stance-axis/      Axe gauche-droite réutilisable
    ├── team-panel/       Équipe
    ├── week-planner/     ★ Prototype : gestion de la semaine
    ├── decision-panel/   ★ Prototype : prise de décision
    ├── profile-panel/    Jauges, finances, prochain palier, dossiers & compétences
    ├── party-panel/      Courants, rivaux, réseau
    ├── election-panel/   Sondages, tendance, plafond de dépenses
    ├── news-feed/        Fil d'actualité
    └── new-game/         Création du personnage
```

## Principes

1. **Un seul signal d'état.** `GameStateService.mutate(fn)` clone l'état, applique `fn(draft, rng)`, publie et sauvegarde. Les composants ne lisent que des `computed`.
2. **Les systèmes sont des fonctions `weekly(draft, rng)`.** `TurnService.endWeek()` les enchaîne dans une seule transaction : actions → semaine+1 → carrière → médias → parti → réseau → rivaux → scrutins.
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

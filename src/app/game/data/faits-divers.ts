/* ============================================================
 *  Les faits divers : de quoi remplir le journal les mois calmes.
 *  Tous fictifs, sans nom propre de personne, ni drame : la France
 *  des petites histoires, des animaux échappés et des records
 *  improbables.
 * ============================================================ */

export interface FaitDivers { title: string; body: string }

export const FAITS_DIVERS: FaitDivers[] = [
  { title: 'Un sanglier visite le centre commercial', body: 'Entré par les portes automatiques un mardi matin, l’animal a traversé le rayon jardinage avant d’être raccompagné en forêt par les pompiers. Aucun blessé, quelques géraniums en moins.' },
  { title: 'Une boulangerie rouvre après quarante ans de fermeture', body: 'Dans un village de la Creuse, deux jeunes artisans ont rallumé le vieux four à bois. Le premier matin, la file d’attente faisait le tour de la place.' },
  { title: 'Record de France de la plus longue omelette', body: 'Huit mètres de long, six mille œufs et une poêle fabriquée pour l’occasion : le comité des fêtes du village a pulvérisé l’ancien record, sous les applaudissements.' },
  { title: 'Un perroquet donne l’alerte et sauve un immeuble', body: 'En répétant « Au feu ! » à tue-tête, l’oiseau a réveillé les voisins d’une cuisine enfumée. Les pompiers ont maîtrisé le début d’incendie en quelques minutes.' },
  { title: 'Une lettre arrive avec soixante-deux ans de retard', body: 'Postée en 1964, une carte postale a fini par être distribuée à la bonne adresse. Le destinataire, aujourd’hui octogénaire, a reconnu l’écriture de son ancien correspondant.' },
  { title: 'Un troupeau de vaches bloque l’autoroute', body: 'Échappées d’un pré mal clôturé, une quarantaine de vaches ont paralysé la circulation pendant deux heures. Les automobilistes ont pris l’incident avec philosophie.' },
  { title: 'Un trésor de pièces d’or découvert sous un plancher', body: 'En rénovant une longère, un couple a mis au jour un pot de terre rempli de louis d’or. Les archéologues de la région ont été prévenus.' },
  { title: 'La fête du village tourne au concours de chant improvisé', body: 'Une panne de sono a transformé le bal en karaoké a cappella. Les habitants parlent déjà de recommencer l’an prochain, panne comprise.' },
  { title: 'Un chat parcourt trois cents kilomètres pour rentrer chez lui', body: 'Disparu lors d’un déménagement, le matou a retrouvé son ancienne maison après six mois d’errance. Les nouveaux propriétaires l’ont accueilli avec des croquettes.' },
  { title: 'Un mariage célébré en haut d’une grande roue', body: 'Le maire a dû grimper à bord de la nacelle pour unir les deux fiancés. Le tour a duré vingt minutes, le temps de prononcer les vœux.' },
  { title: 'Des cambrioleurs s’endorment sur le canapé', body: 'Entrés par effraction dans une maison de vacances, deux hommes ont été retrouvés assoupis devant la télévision par le gardien. Ils ont été remis aux gendarmes.' },
  { title: 'Une tortue retrouvée après trente ans de fugue', body: 'Disparue du jardin familial en 1996, la tortue a été retrouvée à deux rues de là, en parfaite santé. Ses propriétaires n’en reviennent pas.' },
  { title: 'Un orchestre de lycéens joue pour les résidents d’un Ehpad', body: 'Chaque vendredi, la fanfare du lycée vient jouer des airs d’accordéon dans le salon de la maison de retraite. Les danseurs ont de quatre-vingt à quatre-vingt-quinze ans.' },
  { title: 'La plus grande citrouille de France pèse une demi-tonne', body: 'Un maraîcher de Touraine a remporté le concours national avec un spécimen de 512 kilos. Il a fallu un chariot élévateur pour la peser.' },
  { title: 'Un nid de cigognes paralyse un chantier', body: 'Installé au sommet d’une grue, le couple de cigognes a obtenu un sursis : le chantier attendra la fin de la nidification. Les ouvriers baptisent les oisillons.' },
  { title: 'Un vélo volé revient avec un mot d’excuse', body: 'Trois semaines après sa disparition, le vélo a été déposé devant la mairie, réparé, avec un petit mot : « Désolé, j’avais un train à prendre. »' },
  { title: 'Une piscine municipale envahie par des canards', body: 'Une famille de colverts a élu domicile dans le bassin olympique. Les maîtres-nageurs ont dû fermer la piscine une matinée, le temps de les reloger dans l’étang voisin.' },
  { title: 'Un château fort vendu un euro symbolique', body: 'La commune n’avait plus les moyens de l’entretenir : une association de passionnés s’engage à le restaurer pierre par pierre pendant vingt ans.' },
  { title: 'Une dictée géante réunit tout un département', body: 'Trois mille participants, de huit à quatre-vingt-dix-sept ans, ont planché sur un texte truffé de pièges. Le vainqueur n’a fait qu’une seule faute, sur « chausse-trape ».' },
  { title: 'Un phoque remonte la Loire jusqu’à Nantes', body: 'L’animal a été aperçu plusieurs jours de suite sur les quais. Les naturalistes demandent aux promeneurs de garder leurs distances.' },
  { title: 'Une famille gagne trois fois au loto local', body: 'Au loto de la salle des fêtes, la même famille a remporté le jambon, le panier garni et la télévision. Les voisins réclament une vérification des cartons.' },
  { title: 'La cloche de l’église sonne treize coups à minuit', body: 'Un mécanisme déréglé a fait sonner la cloche du village toute la nuit. L’horloger est venu de la ville voisine pour réparer l’horloge du XVIIIᵉ siècle.' },
  { title: 'Un âne élu mascotte de la commune', body: 'Soumis au vote des enfants de l’école, le nom de la nouvelle mascotte a été choisi à l’unanimité : l’âne du centre équestre s’appellera désormais « Monsieur le Maire ».' },
  { title: 'Une montgolfière atterrit dans une cour d’école', body: 'Déportée par le vent, la montgolfière s’est posée en douceur pendant la récréation. Les élèves ont eu droit à une leçon de physique improvisée.' },
  { title: 'Un pêcheur sort un silure de deux mètres', body: 'Après une heure de lutte, le pêcheur a ramené le poisson géant sur la berge, l’a photographié, puis l’a remis à l’eau.' },
  { title: 'Un village entier tricote pour habiller ses arbres', body: 'Écharpes, bonnets et manchons multicolores : les tricoteuses du club ont décoré les platanes de la place pour l’hiver. Les touristes affluent.' },
  { title: 'Le plus vieux facteur de France prend sa retraite', body: 'Après quarante-deux ans de tournée à vélo, il a été fêté par toute la commune. Il connaissait le prénom de chaque chien du canton.' },
  { title: 'Une autruche s’échappe d’un élevage et file sur la départementale', body: 'Flashée à 52 km/h par un radar pédagogique, l’autruche a été rattrapée par son éleveur deux kilomètres plus loin.' },
  { title: 'Un concert de violoncelle dans une grotte', body: 'L’acoustique de la grotte a sublimé le concert donné à la lueur des bougies. Les places étaient réservées depuis six mois.' },
  { title: 'Une boîte à livres devient la plus fréquentée de la région', body: 'Installée dans une ancienne cabine téléphonique, elle voit passer deux cents livres par semaine. Les habitants y laissent aussi des recettes de cuisine.' },
  { title: 'Un camion de fromages se renverse, la route sent bon', body: 'Le chargement de tommes s’est répandu sur la chaussée. Les secours ont dégagé la route en deux heures ; aucun blessé, mais une forte odeur de cave.' },
  { title: 'Un écolier rapporte une météorite à l’école', body: 'Trouvée dans un champ, la pierre noire intriguait l’instituteur. Les géologues de l’université confirment : c’est bien une météorite.' },
  { title: 'Une course de garçons de café dans les rues de la ville', body: 'Plateau, verre et carafe en équilibre : quatre-vingts serveurs ont couru cinq kilomètres sans renverser une goutte. Ou presque.' },
  { title: 'Un hérisson bloqué dans une grille sauvé par les pompiers', body: 'L’opération a duré une demi-heure et mobilisé quatre sapeurs. Le hérisson a été relâché dans un jardin, sous les vivats des enfants du quartier.' },
  { title: 'Le maire d’un petit village fait la classe pendant une grève', body: 'Faute de remplaçant, l’édile a assuré la journée de cours. Les élèves ont surtout retenu la leçon d’instruction civique.' },
  { title: 'Une voiture de collection retrouvée dans une grange', body: 'Recouverte de foin depuis cinquante ans, une berline des années trente a été découverte lors d’une succession. Elle démarre encore, au troisième essai.' },
  { title: 'Une coccinelle géante gonflable s’envole lors d’une fête', body: 'Arrachée par une rafale, la structure de douze mètres a fini sa course dans un champ de maïs. Les organisateurs l’ont récupérée à la tombée de la nuit.' },
  { title: 'Une centenaire passe son permis bateau', body: 'Elle voulait « naviguer seule sur le lac avant ses cent dix ans ». Elle a obtenu le code avec une seule erreur.' },
  { title: 'Des abeilles s’installent dans une boîte aux lettres', body: 'Le facteur a dû glisser le courrier sous la porte pendant trois semaines, le temps qu’un apiculteur vienne récupérer l’essaim.' },
  { title: 'Un festival de la soupe réunit dix mille gourmands', body: 'Potirons, orties, châtaignes : soixante marmites ont été vidées en une soirée. Le jury a primé une soupe à l’oignon « comme chez grand-mère ».' },
  { title: 'Un pont suspendu fête ses cent ans', body: 'Les habitants ont traversé le pont en costume d’époque, au son d’une fanfare. L’ouvrage, rénové l’an dernier, devrait tenir encore un siècle.' },
  { title: 'Une chèvre s’invite au conseil municipal', body: 'Entrée par la porte restée ouverte, la chèvre de la ferme voisine a assisté à toute la séance. Elle n’a pas pris la parole.' },
  { title: 'Un étudiant traverse la France à pied pour ses grands-parents', body: 'Mille deux cents kilomètres de Lille à Perpignan pour fêter leurs noces de diamant. Il est arrivé avec une heure d’avance.' },
  { title: 'La neige tombe en plein mois de mai dans le Jura', body: 'Une couche de dix centimètres a surpris les habitants et les cerisiers en fleurs. Les enfants ont ressorti les luges.' },
  { title: 'Un cinéma de quartier sauvé par ses spectateurs', body: 'Une souscription a réuni trois cent mille euros en un mois. Le vieux cinéma de quarante places rouvrira avec un nouveau projecteur.' },
  { title: 'Un homard bleu pêché au large de la Bretagne', body: 'Une chance sur deux millions : le pêcheur a confié le crustacé à l’aquarium régional, où il est devenu la star des visites scolaires.' },
  { title: 'Une fanfare joue sous les fenêtres d’une maternité', body: 'Les musiciens ont célébré la naissance du premier bébé de l’année dans la petite ville. La famille a été invitée au défilé du printemps.' },
  { title: 'Un jardin ouvrier produit la plus grosse tomate de la saison', body: 'Deux kilos et cent grammes : la tomate « cœur de bœuf » a été pesée devant huissier par le club des jardiniers.' },
  { title: 'Un randonneur égaré retrouvé grâce à un troupeau de moutons', body: 'Le berger a remarqué que ses bêtes refusaient d’avancer : le marcheur, foulé à la cheville, attendait derrière un rocher.' },
  { title: 'Une bibliothèque rend un livre emprunté en 1952', body: 'L’ouvrage, un traité d’apiculture, a été rapporté par les petits-enfants de l’emprunteur. Le montant de l’amende a été symboliquement annulé.' },
  { title: 'Un concours de lancer de bottes réunit trois villages', body: 'Le record est tombé à vingt-huit mètres. Les trois communes se disputent déjà l’organisation de la prochaine édition.' },
  { title: 'Une renarde élève ses petits sous un terrain de football', body: 'Le club amateur a décalé ses entraînements pour ne pas déranger la portée. Les joueurs observent les renardeaux à la jumelle.' },
  { title: 'Un phare désaffecté transformé en gîte', body: 'Cent vingt marches, une chambre et la mer à perte de vue : le gîte affiche complet jusqu’à l’automne.' },
  { title: 'Un orage de grêle peint les rues en blanc en plein été', body: 'En dix minutes, les grêlons ont recouvert les trottoirs. Les terrasses des cafés ont été évacuées dans un éclat de rire général.' },
  { title: 'Un écrivain public retrouve du travail grâce aux lettres d’amour', body: 'Dans un marché couvert, il rédige à la main des lettres pour ceux qui n’osent pas écrire. La Saint-Valentin est sa haute saison.' },
  { title: 'Un âne livre le pain dans un village de montagne', body: 'Faute de boulanger sur place, l’âne fait chaque matin la navette avec ses sacoches de baguettes. Il connaît la tournée par cœur.' },
  { title: 'Une partie d’échecs par correspondance dure depuis vingt ans', body: 'Deux amis d’enfance, l’un en Bretagne, l’autre en Alsace, en sont au soixante-dixième coup. Aucun ne veut proposer la nulle.' },
  { title: 'Un toboggan géant installé dans la rue principale', body: 'Trois cents mètres de bâche savonnée : pour la fête de l’été, la mairie a transformé la rue en pente glissante. Le succès est total.' },
  { title: 'Une colonie de chauves-souris protégée dans un clocher', body: 'Les travaux de toiture ont été adaptés pour préserver la colonie de deux cents individus. Le curé assure qu’elles ne gênent pas la messe.' },
  { title: 'Un marché de Noël en plein mois de juillet', body: 'Pour attirer les touristes, une station de montagne a recréé ses chalets de Noël en été. Le vin chaud a été remplacé par de la citronnade.' },
  { title: 'Un drone retrouve une alliance perdue sur la plage', body: 'Équipé d’un détecteur, un passionné a localisé la bague enfouie dans le sable. Le couple l’avait perdue pendant son voyage de noces, dix ans plus tôt.' },
  { title: 'Une course de baignoires sur la rivière', body: 'Une trentaine d’équipages ont descendu la rivière dans des baignoires bricolées. Les deux tiers ont coulé avant la ligne d’arrivée, dans la bonne humeur.' },
  { title: 'Un ancien cheminot reconstruit une gare miniature', body: 'Dix ans de travail, quatre cents mètres de rails et soixante locomotives : la maquette ouvre au public tous les dimanches.' },
  { title: 'Un pigeon voyageur livre un message après une semaine de retard', body: 'Lâché lors d’un concours, l’oiseau s’est égaré avant de retrouver son pigeonnier. Le message disait simplement : « Bien arrivé ».' },
  { title: 'Un village sans voiture le temps d’un dimanche', body: 'Rues piétonnes, pique-niques sur la chaussée et vélos partout : l’expérience a tant plu qu’elle sera renouvelée chaque mois.' },
  { title: 'Une cave à vin centenaire découverte sous une mairie', body: 'Lors de travaux, les ouvriers ont ouvert une porte murée : trois cents bouteilles poussiéreuses dormaient là. Un œnologue doit les expertiser.' },
  { title: 'Un sapin de Noël de vingt mètres tombe en panne de guirlandes', body: 'Plongé dans le noir le soir de l’inauguration, le sapin a été rallumé grâce à un électricien du quartier, venu en pantoufles.' },
  { title: 'Un festival de cerfs-volants colore la plage', body: 'Dragons, baleines et pieuvres géantes ont flotté tout le week-end au-dessus de la baie. Le vent était au rendez-vous.' },
  { title: 'Un loup aperçu près d’un village du Vercors', body: 'Les éleveurs ont été prévenus et les troupeaux rentrés pour la nuit. Les agents de l’Office de la biodiversité suivent ses traces.' },
  { title: 'Une épicerie solidaire tenue par des lycéens', body: 'Dans un bourg sans commerce, les élèves de terminale ont ouvert une épicerie le samedi matin. Les bénéfices financeront leur voyage de fin d’année.' },
];

/** Des brèves plus courtes encore, pour les colonnes du bas */
export const BREVES: FaitDivers[] = [
  { title: 'Le carnaval reporté pour cause de vent', body: 'Les chars attendront le week-end prochain.' },
  { title: 'Un nouveau record d’affluence à la foire aux vins', body: 'Quarante mille visiteurs en trois jours.' },
  { title: 'La médiathèque prolonge ses horaires', body: 'Ouverte désormais jusqu’à 21 h le jeudi.' },
  { title: 'Fermeture provisoire du pont pour travaux', body: 'Une déviation est mise en place pendant trois semaines.' },
  { title: 'Le marché de producteurs s’agrandit', body: 'Douze nouveaux étals dès samedi prochain.' },
  { title: 'Le club de rugby monte en division supérieure', body: 'Une première en soixante ans d’existence.' },
  { title: 'Une nouvelle piste cyclable inaugurée', body: 'Huit kilomètres le long du canal.' },
  { title: 'Le festival de jazz dévoile son affiche', body: 'Trente concerts gratuits en plein air.' },
  { title: 'Une coupure d’eau prévue mardi matin', body: 'Le quartier nord sera privé d’eau de 8 h à midi.' },
  { title: 'La fête de la pomme attire les foules', body: 'Quarante variétés à goûter sur la place du marché.' },
  { title: 'La patinoire rouvre ses portes', body: 'Après deux ans de travaux, la glace est de retour.' },
  { title: 'Un nouveau médecin s’installe au village', body: 'Le cabinet était vacant depuis trois ans.' },
  { title: 'Le vide-grenier bat des records', body: 'Huit cents exposants le long de la rivière.' },
  { title: 'Les cigognes sont de retour', body: 'Les premiers couples ont regagné leurs nids.' },
  { title: 'La chorale cherche des ténors', body: 'Répétitions le mercredi soir à la salle des fêtes.' },
  { title: 'Un nouveau sentier de randonnée balisé', body: 'Douze kilomètres entre vignes et forêts.' },
];

/** Un choix stable pour une édition donnée (même mois, même journal) */
export function pickFaitsDivers<T>(list: T[], seed: number, week: number, n: number): T[] {
  // Un parcours de toute la liste (pas premier avec sa longueur) : pas de redite avant longtemps
  if (!list.length) return [];
  const step = [11, 13, 17, 19, 23].find(p => list.length % p !== 0) ?? 1;
  const start = (Math.imul(seed, 2654435761) >>> 0) % list.length;
  const out: T[] = [];
  for (let j = 0; j < Math.min(n, list.length); j++) out.push(list[(start + (week * n + j) * step) % list.length]);
  return out;
}

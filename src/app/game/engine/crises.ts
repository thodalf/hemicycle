import { economy, electorate } from './country';
import { CrisisArc, CrisisArcId, Effect, GameState, RankId } from '../models/game.models';
import { RANKS } from '../data/ranks';
import { pushNews } from './effects';
import { addMilestone } from './life';
import { localBonus } from './territory';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Quatre crises au long cours, chacune avec une jauge à faire
 *  monter et un risque à contenir, et un dénouement à date fixe :
 *  cyberattaque, procès, Jeux olympiques, dissolution surprise.
 * ============================================================ */

export interface CrisisDef {
  id: CrisisArcId;
  icon: string;
  label: string;
  gaugeLabel: string;
  riskLabel: string;
  months: number;
  /** Dérive mensuelle */
  drift: { gauge: number; risk: number };
  stages: string[];
}

export const CRISES: Record<CrisisArcId, CrisisDef> = {
  cyber: { id: 'cyber', icon: '💻', label: 'Cyberattaque', gaugeLabel: 'Systèmes restaurés', riskLabel: 'Fuites de données', months: 6, drift: { gauge: 5, risk: 5 },
    stages: ['Hôpitaux, mairies et Assemblée paralysés. Une rançon est exigée.', 'Les équipes de l’ANSSI reprennent la main, serveur par serveur.', 'Les derniers systèmes redémarrent. Reste à savoir qui a frappé.'] },
  proces: { id: 'proces', icon: '⚖️', label: 'Votre procès', gaugeLabel: 'Solidité de la défense', riskLabel: 'Poids des charges', months: 8, drift: { gauge: 2, risk: 3 },
    stages: ['Garde à vue, perquisition : une vieille affaire refait surface.', 'Mise en examen. Le juge d’instruction épluche vos comptes.', 'Audiences publiques. Le verdict approche.'] },
  jo: { id: 'jo', icon: '🏅', label: 'Les Jeux olympiques', gaugeLabel: 'Préparation', riskLabel: 'Dérapages (coûts, grèves)', months: 18, drift: { gauge: 4, risk: 3.5 },
    stages: ['La France obtient les Jeux. Les chantiers commencent.', 'Village olympique, transports, sécurité : tout doit être prêt.', 'Dernière ligne droite : la flamme arrive.'] },
  dissolution: { id: 'dissolution', icon: '🗳️', label: 'Dissolution surprise', gaugeLabel: 'Campagne éclair', riskLabel: 'Vague adverse', months: 1, drift: { gauge: 6, risk: 4 },
    stages: ['Le président dissout l’Assemblée. Trois semaines pour sauver votre siège.'] },
  krach: { id: 'krach', icon: '📉', label: 'Krach financier', gaugeLabel: 'Confiance des marchés', riskLabel: 'Chômage', months: 8, drift: { gauge: 3, risk: 4 },
    stages: ['La Bourse perd 20 % en trois jours. Une grande banque vacille.', 'Faillites en cascade, plans sociaux, crédit gelé.', 'Les marchés guettent le moindre signe de reprise.'] },
  megafeux: { id: 'megafeux', icon: '🔥', label: 'Méga-feux', gaugeLabel: 'Moyens engagés', riskLabel: 'Hectares brûlés', months: 4, drift: { gauge: 5, risk: 7 },
    stages: ['Sécheresse historique : des feux géants dans le Sud et les Landes.', 'Les fronts de flammes avancent ; des villages sont évacués.', 'Les pluies se font attendre. Les pompiers sont à bout.'] },
  agriculteurs: { id: 'agriculteurs', icon: '🚜', label: 'La révolte des campagnes', gaugeLabel: 'Dialogue', riskLabel: 'Blocages', months: 5, drift: { gauge: 3, risk: 5 },
    stages: ['Des milliers de tracteurs bloquent les autoroutes.', 'Fumier devant les préfectures, ronds-points occupés.', 'Le mouvement hésite entre l’accord et l’escalade.'] },
  taupe: { id: 'taupe', icon: '🕵️', label: 'Une taupe au cœur de l’État', gaugeLabel: 'Contre-espionnage', riskLabel: 'Secrets livrés', months: 6, drift: { gauge: 4, risk: 5 },
    stages: ['Des notes confidentielles finissent chez une puissance étrangère.', 'Le cercle des suspects se resserre. Tout le monde se méfie de tout le monde.', 'La DGSI pense tenir une piste.'] },
  blackout: { id: 'blackout', icon: '⚡', label: 'Le grand black-out', gaugeLabel: 'Réseau rétabli', riskLabel: 'Pannes et pillages', months: 3, drift: { gauge: 6, risk: 6 },
    stages: ['Un froid polaire, une panne en cascade : la moitié du pays dans le noir.', 'Délestages tournants, hôpitaux sur groupes électrogènes, commerces pillés.', 'Le réseau se reconstruit poste par poste.'] },
  crue: { id: 'crue', icon: '🌊', label: 'Paris sous les eaux', gaugeLabel: 'Protection des quartiers', riskLabel: 'Niveau de la Seine', months: 3, drift: { gauge: 5, risk: 7 },
    stages: ['La Seine monte de vingt centimètres par heure : la crue centennale est là.', 'Métro fermé, caves inondées, le Louvre évacue ses réserves.', 'La décrue se fait attendre. Les sinistrés comptent leurs pertes.'] },
  secheresse: { id: 'secheresse', icon: '💧', label: 'La guerre de l’eau', gaugeLabel: 'Partage de l’eau', riskLabel: 'Pénurie', months: 6, drift: { gauge: 3, risk: 5 },
    stages: ['Nappes phréatiques au plus bas : arrêtés de restriction dans soixante départements.', 'Agriculteurs contre villes, golfs contre maraîchers : chacun réclame son eau.', 'Des villages ravitaillés par camions-citernes.'] },
  autonomie: { id: 'autonomie', icon: '🏝️', label: 'Une région réclame son autonomie', gaugeLabel: 'Dialogue', riskLabel: 'Tensions', months: 8, drift: { gauge: 3, risk: 4 },
    stages: ['L’assemblée régionale vote une motion pour un statut d’autonomie.', 'Manifestations, drapeaux, négociations à huis clos avec l’État.', 'Le compromis est à portée de main… ou la rupture.'] },
  ia: { id: 'ia', icon: '🤖', label: 'L’IA de l’État déraille', gaugeLabel: 'Contrôle', riskLabel: 'Décisions absurdes', months: 5, drift: { gauge: 4, risk: 5 },
    stages: ['L’algorithme qui gère les aides sociales suspend 200 000 allocations sans raison.', 'Impôts recalculés au hasard, convocations absurdes : la confiance s’effondre.', 'Les ingénieurs tentent de comprendre ce que la machine a appris.'] },
  frelons: { id: 'frelons', icon: '🐝', label: 'L’invasion des frelons géants', gaugeLabel: 'Pièges posés', riskLabel: 'Ruches détruites', months: 4, drift: { gauge: 5, risk: 6 },
    stages: ['Des nuées de frelons géants s’abattent sur les ruchers du Sud-Ouest.', 'Pique-niques annulés, apiculteurs désespérés, pots de miel hors de prix.', 'Pièges, nids détruits, appel aux volontaires : la riposte s’organise.'] },
  mars: { id: 'mars', icon: '🚀', label: 'La France sur Mars', gaugeLabel: 'Préparation de la mission', riskLabel: 'Risques techniques', months: 10, drift: { gauge: 4, risk: 4 },
    stages: ['Le programme « Lutèce » est lancé : quatre astronautes français vers Mars.', 'La fusée prend forme à Kourou ; les budgets aussi.', 'Compte à rebours. Le monde entier regarde.'] },
  napoleon: { id: 'napoleon', icon: '🎩', label: 'Le retour de Napoléon', gaugeLabel: 'Riposte républicaine', riskLabel: 'Fièvre bonapartiste', months: 8, drift: { gauge: 3, risk: 5 },
    stages: ['Un homme en bicorne affirme être Napoléon, cloné à partir d’une mèche de cheveux.', 'Ses meetings font salle comble ; ses grognards défilent sur les Champs.', 'Il annonce son « retour de l’île d’Elbe » : une marche sur Paris.'] },
  atlantide: { id: 'atlantide', icon: '🏛️', label: 'L’Atlantide refait surface', gaugeLabel: 'Souveraineté française', riskLabel: 'Convoitises étrangères', months: 8, drift: { gauge: 3, risk: 4 },
    stages: ['Une île inconnue émerge au large de la Bretagne, couverte de ruines de marbre.', 'Archéologues, pêcheurs et marines étrangères se disputent les lieux.', 'L’ONU doit trancher : à qui appartient l’Atlantide ?'] },
  ia_candidate: { id: 'ia_candidate', icon: '🖥️', label: 'Une IA candidate à la présidentielle', gaugeLabel: 'Débat démocratique', riskLabel: 'Sondages de l’IA', months: 6, drift: { gauge: 3, risk: 6 },
    stages: ['« ALMA », une intelligence artificielle, annonce sa candidature. Elle promet zéro mensonge.', 'Elle répond à des millions d’électeurs en même temps. Les sondages s’affolent.', 'Le Conseil constitutionnel doit se prononcer. Le débat fait rage.'] },
  grand_hiver: { id: 'grand_hiver', icon: '🌋', label: 'Le grand hiver', gaugeLabel: 'Résilience du pays', riskLabel: 'Pénuries', months: 18, drift: { gauge: 3, risk: 4 },
    stages: ['Un volcan islandais a obscurci le ciel : l’été n’est pas venu.', 'Récoltes perdues, rationnement, files d’attente devant les boulangeries.', 'Les premiers rayons percent. Il faut tenir encore un peu.'] },
  sosie: { id: 'sosie', icon: '🎭', label: 'Votre sosie', gaugeLabel: 'Vérité rétablie', riskLabel: 'Dégâts du sosie', months: 6, drift: { gauge: 3, risk: 5 },
    stages: ['Un homme qui vous ressemble trait pour trait inaugure des ronds-points à votre place.', 'Le sosie donne des interviews, signe des pétitions et contredit vos discours.', 'Il annonce votre ralliement… au parti adverse. Il faut le démasquer.'] },
  penurie_medicaments: { id: 'penurie_medicaments', icon: '💊', label: 'La pénurie de médicaments', gaugeLabel: 'Approvisionnement', riskLabel: 'Ruptures de stock', months: 5, drift: { gauge: 3, risk: 5 },
    stages: ['Amoxicilline, insuline, antidouleurs : les pharmacies affichent « rupture » sur des centaines de produits.', 'Les patients chroniques s’inquiètent ; les médecins rationnent les ordonnances.', 'Les premières lignes de production relocalisées démarrent.'] },
  train_futur: { id: 'train_futur', icon: '🚄', label: 'Le train du futur', gaugeLabel: 'Avancement du projet', riskLabel: 'Oppositions locales', months: 10, drift: { gauge: 3, risk: 3 },
    stages: ['Un consortium propose un train à sustentation magnétique : Paris–Marseille en 1 h 10.', 'Tracé contesté, enquêtes publiques, zadistes sur le parcours.', 'Premier essai à 600 km/h sur la voie test de la Beauce.'] },
  pandas: { id: 'pandas', icon: '🐼', label: 'Les pandas de l’amitié', gaugeLabel: 'Lune de miel diplomatique', riskLabel: 'Incident diplomatique', months: 6, drift: { gauge: 3, risk: 4 },
    stages: ['Pékin offre deux pandas géants à la France, « gage d’une amitié éternelle ». Il faut leur trouver un zoo… et un nom.', 'Les pandas refusent de manger, les caméras du monde entier filment l’enclos, et Pékin surveille chaque détail.', 'Rumeur : la femelle serait enceinte. Toute la planète retient son souffle.'] },
  coupe_monde: { id: 'coupe_monde', icon: '⚽', label: 'La Coupe du monde à domicile', gaugeLabel: 'Fête populaire', riskLabel: 'Fiasco d’organisation', months: 6, drift: { gauge: 3, risk: 4 },
    stages: ['La France accueille la Coupe du monde : douze stades, deux millions de supporters attendus.', 'Billetterie saturée, grèves des transports annoncées, fan-zones à sécuriser : le compte à rebours est lancé.', 'Les Bleus passent les poules. Le pays entier se met à y croire.'] },
  jubile: { id: 'jubile', icon: '🎆', label: 'Le jubilé royal', gaugeLabel: 'Ferveur populaire', riskLabel: 'Contre-jubilé républicain', months: 4, drift: { gauge: 3, risk: 4 },
    stages: ['Le Palais annonce un grand jubilé pour célébrer votre règne : défilés, feux d’artifice, bals populaires.', 'Le front républicain organise un « contre-jubilé » et appelle au boycott des festivités.', 'Le grand jour approche : carrosse, Champs-Élysées et feu d’artifice sur la tour Eiffel.'] },
  diamants: { id: 'diamants', icon: '💎', label: 'L’affaire des diamants', gaugeLabel: 'Vérité établie', riskLabel: 'Soupçons', months: 5, drift: { gauge: 3, risk: 5 },
    stages: ['Un hebdomadaire affirme que le président du Zanbar vous a offert un écrin de diamants lors d’une visite officielle.', 'Les photos de l’écrin circulent ; la justice ouvre une enquête préliminaire.', 'L’enquête touche à sa fin : innocence prouvée ou carrière brisée.'] },
  ours: { id: 'ours', icon: '🐻', label: 'Le retour des ours', gaugeLabel: 'Cohabitation', riskLabel: 'Colère des bergers', months: 7, drift: { gauge: 3, risk: 4 },
    stages: ['Une dizaine d’ours sont réintroduits dans les Pyrénées. Les écologistes jubilent, les bergers fulminent.', 'Brebis tuées, estives désertées, manifestations à Foix : la montagne se divise.', 'Avant l’hiver, il faut trouver un modèle de cohabitation qui tienne.'] },
  penurie_essence: { id: 'penurie_essence', icon: '⛽', label: 'La pénurie d’essence', gaugeLabel: 'Approvisionnement', riskLabel: 'Colère des automobilistes', months: 4, drift: { gauge: 3, risk: 6 },
    stages: ['Raffineries en grève et dépôts bloqués : une station sur trois est à sec.', 'Files de deux kilomètres, jerricans, rationnement : le pays roule au ralenti.', 'Les camions-citernes reviennent. Il faut tenir jusqu’au bout.'] },
  capitale_culture: { id: 'capitale_culture', icon: '🎭', label: 'Capitale européenne de la culture', gaugeLabel: 'Rayonnement', riskLabel: 'Fiasco artistique', months: 9, drift: { gauge: 3, risk: 3 },
    stages: ['Votre ville candidate au titre de capitale européenne de la culture… et l’emporte.', 'Programmation, chantiers, mécènes : l’année se prépare dans la fièvre.', 'Le rideau se lève : douze mois de festivals sous les yeux de l’Europe.'] },
  canicule: { id: 'canicule', icon: '🌡️', label: 'La canicule de 46 °C', gaugeLabel: 'Protection des plus fragiles', riskLabel: 'Saturation des hôpitaux', months: 3, drift: { gauge: 4, risk: 7 },
    stages: ['Un dôme de chaleur s’installe : 46 °C à Montpellier, 41 °C à Paris, des nuits à 30 °C.', 'Ehpad, hôpitaux, crèches : tout le pays cherche de la fraîcheur.', 'La chaleur reflue lentement. Le bilan approche.'] },
  hacker: { id: 'hacker', icon: '💻', label: 'Le hacker justicier', gaugeLabel: 'Contre-enquête', riskLabel: 'Fuites', months: 6, drift: { gauge: 3, risk: 5 },
    stages: ['Un pirate anonyme, « Robespierre », publie les messages privés de trois ministres et promet « tout le reste ».', 'Chaque semaine, une nouvelle fuite : notes de frais, SMS, rendez-vous discrets.', 'Les enquêteurs se rapprochent. « Robespierre » annonce sa dernière salve.'] },
  barons: { id: 'barons', icon: '🏰', label: 'La fronde des barons', gaugeLabel: 'Unité du parti', riskLabel: 'Sécession', months: 6, drift: { gauge: 3, risk: 5 },
    stages: ['Les grands élus locaux du parti – maires de grandes villes, présidents de département – menacent de faire sécession.', 'Ils créent une « Ligue des territoires » et débauchent militants et financements.', 'Le congrès de la rupture approche : ils restent, ou ils partent avec la moitié du parti.'] },
  grand_debat: { id: 'grand_debat', icon: '🗣️', label: 'Le grand débat national', gaugeLabel: 'Participation', riskLabel: 'Défiance', months: 6, drift: { gauge: 3, risk: 4 },
    stages: ['Face à la colère, un grand débat national est lancé : réunions publiques, cahiers, plateforme en ligne.', 'Des milliers de réunions dans les mairies. Les Français parlent, beaucoup.', 'L’heure des conclusions : seront-elles à la hauteur de la parole donnée ?'] },
  tour_eiffel: { id: 'tour_eiffel', icon: '🗼', label: 'La tour Eiffel en péril', gaugeLabel: 'Restauration', riskLabel: 'Effondrement', months: 7, drift: { gauge: 3, risk: 4 },
    stages: ['Des ingénieurs découvrent une corrosion grave dans les piliers : la tour Eiffel est fermée au public.', 'Le chantier du siècle : échafaudages géants, mécènes du monde entier, et des rivets qui tombent.', 'Le verdict des experts approche : rouvrir la Dame de fer, ou la démonter étage par étage.'] },
  baleine: { id: 'baleine', icon: '🐋', label: 'Une baleine dans la Seine', gaugeLabel: 'Sauvetage', riskLabel: 'Fiasco', months: 3, drift: { gauge: 4, risk: 4 },
    stages: ['Une baleine à bosse remonte la Seine jusqu’à Rouen. Le pays entier la suit en direct.', 'Elle s’affaiblit. Vétérinaires, pompiers, militants : chacun a sa solution, et tout le monde vous regarde.', 'Dernière chance : un convoi de barges pour la ramener vers la mer.'] },
  mariage_princier: { id: 'mariage_princier', icon: '💍', label: 'Un mariage princier à Paris', gaugeLabel: 'Éclat de la fête', riskLabel: 'Fiasco protocolaire', months: 5, drift: { gauge: 3, risk: 4 },
    stages: ['Le prince héritier de Valmorie épouse une Française : la cérémonie aura lieu à Paris, et tout le gotha débarque.', 'Plan de table explosif, républicains dans la rue, journalistes du monde entier : le protocole sue à grosses gouttes.', 'Le grand jour approche : cortège, bal à l’Hôtel de Ville et feu d’artifice sur la Seine.'] },
  cathedrale: { id: 'cathedrale', icon: '⛪', label: 'L’incendie de la cathédrale', gaugeLabel: 'Reconstruction', riskLabel: 'Polémique', months: 6, drift: { gauge: 3, risk: 4 },
    stages: ['Dans la nuit, la flèche de la cathédrale Saint-Ambroise s’effondre dans les flammes. Le pays entier pleure devant les images.', 'Les dons affluent ; on se déchire entre reconstruction à l’identique et geste contemporain ; l’enquête cherche les causes.', 'Le chantier est lancé : il faut tenir les délais promis… et les budgets.'] },
  punaises: { id: 'punaises', icon: '🪲', label: 'L’invasion des punaises de lit', gaugeLabel: 'Désinfestation', riskLabel: 'Panique', months: 4, drift: { gauge: 3, risk: 5 },
    stages: ['Des punaises de lit dans les trains, les cinémas, les hôpitaux : la psychose gagne le pays.', 'Les vidéos se multiplient, les désinsectiseurs sont débordés, les touristes annulent.', 'Le pic semble passé… ou pas. Une dernière offensive s’impose.'] },
  esport: { id: 'esport', icon: '🎮', label: 'La finale mondiale d’e-sport', gaugeLabel: 'Engouement', riskLabel: 'Fiasco technique', months: 5, drift: { gauge: 3, risk: 4 },
    stages: ['La France décroche la finale mondiale d’un jeu vidéo culte : 40 000 spectateurs à Bercy, 200 millions en ligne.', 'Serveurs à tester, billetterie prise d’assaut, et un débat qui enflamme les plateaux : « le jeu vidéo, est-ce du sport ? »', 'La grande finale approche, et l’équipe de France est qualifiée.'] },
  satellite: { id: 'satellite', icon: '🛰️', label: 'Le satellite qui tombe', gaugeLabel: 'Préparation', riskLabel: 'Panique', months: 3, drift: { gauge: 4, risk: 5 },
    stages: ['Un vieux satellite de dix tonnes perd le contrôle : il retombera quelque part sur l’Europe dans les semaines qui viennent.', 'Les trajectoires se précisent : une zone de rentrée traverse la France. Les ventes de casques explosent.', 'J-7 : la zone se resserre, et les regards se tournent vers vous.'] },
  casse: { id: 'casse', icon: '💰', label: 'Le casse du siècle', gaugeLabel: 'Enquête', riskLabel: 'Ridicule', months: 4, drift: { gauge: 3, risk: 5 },
    stages: ['Six tonnes d’or ont disparu des coffres de la Banque de France. Aucune effraction, aucune alarme.', 'Les enquêteurs remontent une piste internationale ; la presse du monde entier se moque de la France.', 'Le cerveau du casse serait sur le point d’être identifié… ou de s’envoler.'] },
  vin: { id: 'vin', icon: '🍷', label: 'La guerre du vin', gaugeLabel: 'Débouchés', riskLabel: 'Colère des vignerons', months: 5, drift: { gauge: 3, risk: 5 },
    stages: ['Une grande puissance taxe à 100 % les vins français. Les exportations s’effondrent du jour au lendemain.', 'Les cuves débordent, les vignerons bloquent les routes, Bordeaux et la Bourgogne grondent.', 'Une négociation de la dernière chance s’ouvre : un accord, ou des arrachages massifs.'] },
  nuage: { id: 'nuage', icon: '☁️', label: 'Le nuage toxique', gaugeLabel: 'Transparence', riskLabel: 'Défiance sanitaire', months: 4, drift: { gauge: 3, risk: 5 },
    stages: ['Une usine chimique de Saint-Aubin-sur-Seine brûle toute la nuit : un nuage noir de vingt kilomètres s’étire sur la région.', 'Des suies sur les potagers, une odeur persistante, des analyses contradictoires : la défiance monte.', 'Les résultats des grandes analyses tombent. Il faudra dire la vérité, toute la vérité.'] },
  taxis: { id: 'taxis', icon: '🚕', label: 'Les taxis sans chauffeur', gaugeLabel: 'Acceptation', riskLabel: 'Colère des chauffeurs', months: 5, drift: { gauge: 3, risk: 4 },
    stages: ['Une entreprise lance mille taxis sans chauffeur dans Paris, sans attendre d’autorisation définitive.', 'Les chauffeurs bloquent les aéroports ; une voiture autonome frôle un piéton à Montparnasse.', 'Le Conseil d’État doit trancher : encadrer, interdire ou laisser rouler.'] },
  fusion: { id: 'fusion', icon: '⚛️', label: 'La percée de la fusion', gaugeLabel: 'Percée scientifique', riskLabel: 'Fuite des cerveaux', months: 6, drift: { gauge: 3, risk: 4 },
    stages: ['Un laboratoire de Provence obtient, pour la première fois, plus d’énergie qu’il n’en consomme par fusion nucléaire.', 'Les géants américains et asiatiques veulent racheter l’équipe et ses brevets.', 'L’heure du choix : un grand programme national… ou laisser filer la découverte.'] },
  viaduc: { id: 'viaduc', icon: '🌉', label: 'Le viaduc fissuré', gaugeLabel: 'Sécurité des ouvrages', riskLabel: 'Isolement de la vallée', months: 5, drift: { gauge: 3, risk: 5 },
    stages: ['Une fissure de quarante mètres sur le grand viaduc de la vallée : il est fermé dans la nuit, et cent mille habitants se retrouvent coupés en deux.', 'Détours de deux heures, commerces vides, ambulances retardées : la vallée s’impatiente, et l’on découvre que d’autres ponts vieillissent mal.', 'Réparer, reconstruire ou inspecter tout le pays : l’heure du choix.'] },
  tresor: { id: 'tresor', icon: '🏺', label: 'Le trésor du chantier', gaugeLabel: 'Patrimoine préservé', riskLabel: 'Pillage', months: 4, drift: { gauge: 3, risk: 4 },
    stages: ['Sous un chantier de tramway, une pelleteuse met au jour des milliers de pièces d’or romaines. Le chantier s’arrête net.', 'Des détectoristes rôdent la nuit, des pièces apparaissent sur des sites de vente, la mairie veut relancer les travaux.', 'Les fouilles s’achèvent : musée, vente ou dispersion ?'] },
  algues: { id: 'algues', icon: '🌿', label: 'Les algues vertes', gaugeLabel: 'Plan de reconquête', riskLabel: 'Colère du littoral', months: 6, drift: { gauge: 3, risk: 5 },
    stages: ['Les algues vertes envahissent les plages de la baie ; un joggeur fait un malaise, les plages ferment en plein été.', 'Les agriculteurs se sentent accusés, les hôteliers comptent les annulations, les riverains réclament des comptes.', 'Les premières mesures de l’eau tombent : le plan a-t-il changé quelque chose ?'] },
  barrage: { id: 'barrage', icon: '🌊', label: 'Le barrage qui fuit', gaugeLabel: 'Sécurisation', riskLabel: 'Panique dans la vallée', months: 4, drift: { gauge: 3, risk: 5 },
    stages: ['Des fuites inquiétantes au pied d’un grand barrage hydroélectrique : en aval, quarante mille habitants dorment sous des millions de mètres cubes d’eau.', 'Le lac est vidé lentement, les rumeurs de rupture enflent, des familles quittent la vallée d’elles-mêmes.', 'Les experts rendent leur verdict : réparer, reconstruire ou vider pour de bon.'] },
  aviaire: { id: 'aviaire', icon: '🐔', label: 'La grippe aviaire', gaugeLabel: 'Contrôle sanitaire', riskLabel: 'Colère des éleveurs', months: 5, drift: { gauge: 3, risk: 5 },
    stages: ['Un foyer de grippe aviaire hautement pathogène dans un élevage du Sud-Ouest : les services vétérinaires bouclent la zone.', 'Les foyers se multiplient, les abattages préventifs aussi ; les éleveurs de canards voient vingt ans de travail disparaître.', 'La vaccination des volailles, enfin possible, change la donne… si elle est financée.'] },
  skipper: { id: 'skipper', icon: '⛵', label: 'Le skipper disparu', gaugeLabel: 'Recherches', riskLabel: 'Désespoir', months: 3, drift: { gauge: 3, risk: 6 },
    stages: ['La balise d’une navigatrice française, en tête de la course autour du monde, s’est tue dans les mers du Sud, à trois mille kilomètres de toute côte.', 'Les avions de reconnaissance survolent une mer démontée ; tout le pays guette la moindre nouvelle.', 'Les chances s’amenuisent. Il faut décider : continuer, coûte que coûte, ou arrêter les recherches.'] },
  drones: { id: 'drones', icon: '🛸', label: 'Les drones mystérieux', gaugeLabel: 'Enquête', riskLabel: 'Psychose', months: 4, drift: { gauge: 3, risk: 5 },
    stages: ['Des drones non identifiés survolent trois centrales nucléaires en une nuit. Personne ne sait qui les pilote.', 'Les survols se multiplient : bases militaires, ports, prisons. Les réseaux parlent d’espions, d’extraterrestres, de complot.', 'Les enquêteurs approchent du but. Faut-il tout révéler ?'] },
  cyclone: { id: 'cyclone', icon: '🌀', label: 'Le cyclone', gaugeLabel: 'Reconstruction', riskLabel: 'Sentiment d’abandon', months: 5, drift: { gauge: 3, risk: 5 },
    stages: ['Un cyclone de catégorie 5 a frappé la Guadeloupe : toits arrachés, routes coupées, l’électricité ne reviendra pas avant des semaines.', 'Les secours arrivent, mais lentement ; l’eau potable manque, la colère gronde contre « Paris qui oublie l’outre-mer ».', 'Reconstruire à l’identique, ou reconstruire mieux et plus solide ?'] },
  lithium: { id: 'lithium', icon: '🔋', label: 'Le lithium d’Alsace', gaugeLabel: 'Projet minier', riskLabel: 'Opposition locale', months: 6, drift: { gauge: 3, risk: 4 },
    stages: ['Des géologues confirment un gisement de lithium géant sous l’Alsace : de quoi équiper des millions de voitures électriques.', 'Les industriels se pressent, les riverains s’inquiètent pour leurs nappes phréatiques, les écologistes se divisent.', 'Le permis d’exploitation doit être tranché : extraire, encadrer ou renoncer.'] },
  sous_marin: { id: 'sous_marin', icon: '⚓', label: 'Le sous-marin en détresse', gaugeLabel: 'Sauvetage', riskLabel: 'Tension diplomatique', months: 3, drift: { gauge: 3, risk: 6 },
    stages: ['Un sous-marin nucléaire d’attaque ne répond plus, quelque part en Atlantique Nord. Cent dix marins à bord.', 'Il est localisé par trois cents mètres de fond, près des eaux d’une puissance rivale qui envoie ses propres navires.', 'Les réserves d’oxygène s’épuisent : il faut tenter le sauvetage maintenant.'] },
  joconde: { id: 'joconde', icon: '🖼️', label: 'Le vol de la Joconde', gaugeLabel: 'Enquête', riskLabel: 'Ridicule international', months: 4, drift: { gauge: 3, risk: 5 },
    stages: ['La Joconde a disparu du Louvre pendant la nuit. Le cadre vide fait la une du monde entier.', 'Fausses pistes, rançon réclamée, copies qui surgissent partout : la France devient la risée des réseaux.', 'Les enquêteurs pensent savoir où elle est. Faut-il négocier ou intervenir ?'] },
  quatre_jours: { id: 'quatre_jours', icon: '📆', label: 'La semaine de quatre jours', gaugeLabel: 'Adhésion', riskLabel: 'Désorganisation', months: 6, drift: { gauge: 3, risk: 4 },
    stages: ['Une grande expérimentation de la semaine de quatre jours démarre dans mille entreprises et administrations volontaires.', 'Premiers bilans contrastés : des salariés ravis, des services publics fermés le vendredi, des patrons divisés.', 'L’heure du bilan : généraliser, encadrer ou abandonner.'] },
  tempete_solaire: { id: 'tempete_solaire', icon: '🌞', label: 'La tempête solaire', gaugeLabel: 'Résilience des réseaux', riskLabel: 'Paralysie', months: 4, drift: { gauge: 3, risk: 6 },
    stages: ['Une éruption solaire géante frappe la Terre : satellites aveugles, GPS en panne, réseaux électriques fragilisés.', 'Trains à l’arrêt, cartes bancaires refusées, avions cloués au sol : le pays redécouvre le papier.', 'Les satellites redémarrent un à un. Il faut tenir jusqu’au bout.'] },
  expo_universelle: { id: 'expo_universelle', icon: '🎡', label: 'L’Exposition universelle', gaugeLabel: 'Préparation', riskLabel: 'Retards et surcoûts', months: 12, drift: { gauge: 3, risk: 3 },
    stages: ['Paris est désignée pour accueillir l’Exposition universelle : 180 pays, 40 millions de visiteurs attendus.', 'Pavillons en chantier, grues sur la Seine, budgets qui dérapent.', 'Ouverture dans quelques semaines : le monde entier arrive.'] },
  seisme: { id: 'seisme', icon: '🏚️', label: 'Le séisme du Sud-Est', gaugeLabel: 'Reconstruction', riskLabel: 'Colère des sinistrés', months: 8, drift: { gauge: 3, risk: 5 },
    stages: ['Un séisme de magnitude 6,4 frappe l’arrière-pays niçois : villages coupés du monde, milliers de sinistrés.', 'Mobil-homes, gymnases, experts d’assurance : la reconstruction s’organise lentement.', 'Les premiers villages renaissent. Les sinistrés jugeront sur pièces.'] },
  loto: { id: 'loto', icon: '🍀', label: 'Le gros lot', gaugeLabel: 'Usage exemplaire', riskLabel: 'Soupçons et tentations', months: 6, drift: { gauge: 2, risk: 4 },
    stages: ['Vous avez gagné 28 millions d’euros au Loto. Pour l’instant, seul·e votre conjoint·e le sait.', 'La rumeur enfle : « l’élu millionnaire ». Chacun vient tendre la main.', 'Il faut trancher : que faire de cette fortune tombée du ciel ?'] },
  comete: { id: 'comete', icon: '☄️', label: 'La comète', gaugeLabel: 'Mission de déviation', riskLabel: 'Panique', months: 6, drift: { gauge: 4, risk: 5 },
    stages: ['Les astronomes confirment : une comète de deux kilomètres croisera l’orbite terrestre dans six mois.', 'La mission européenne de déviation se prépare à Kourou ; les bunkers se vendent à prix d’or.', 'Le vaisseau a décollé. Le monde retient son souffle.'] },
  referendum: { id: 'referendum', icon: '🗳️', label: 'Le référendum d’initiative citoyenne', gaugeLabel: 'Campagne de votre camp', riskLabel: 'Campagne adverse', months: 5, drift: { gauge: 3, risk: 4 },
    stages: ['Un million de signatures : le premier référendum d’initiative citoyenne est convoqué.', 'Meetings, débats télévisés, tracts : le pays se passionne pour la question posée.', 'Dernière ligne droite : les sondages sont au coude à coude.'] },
  templiers: { id: 'templiers', icon: '🗝️', label: 'Le trésor des Templiers', gaugeLabel: 'Fouilles officielles', riskLabel: 'Pillards et fièvre', months: 7, drift: { gauge: 3, risk: 5 },
    stages: ['Une crypte scellée est découverte sous une église de votre département : des coffres frappés de la croix templière.', 'Chasseurs de trésor, youtubeurs et illuminés campent autour du chantier.', 'Les archéologues s’apprêtent à ouvrir le dernier coffre.'] },
  eurovision: { id: 'eurovision', icon: '🎤', label: 'L’Eurovision en France', gaugeLabel: 'Préparation du show', riskLabel: 'Risque de fiasco', months: 8, drift: { gauge: 4, risk: 4 },
    stages: ['La France a gagné l’Eurovision : elle accueille la prochaine édition, et votre ville est candidate.', 'Salle, hôtels, sécurité, polémiques sur la chanson française : le chantier est immense.', 'Grande finale en direct devant 160 millions de téléspectateurs.'] },
  greve_generale: { id: 'greve_generale', icon: '✊', label: 'La grève générale', gaugeLabel: 'Dialogue social', riskLabel: 'Paralysie du pays', months: 5, drift: { gauge: 3, risk: 5 },
    stages: ['L’intersyndicale appelle à une grève générale reconductible.', 'Trains à l’arrêt, raffineries bloquées, écoles fermées : le pays tourne au ralenti.', 'Les négociations de la dernière chance s’ouvrent rue de Grenelle.'] },
};

export function crises(d: GameState): Partial<Record<CrisisArcId, CrisisArc>> {
  return (d.crises ??= {});
}

export function activeCrises(d: GameState): [CrisisArcId, CrisisArc][] {
  return Object.entries(d.crises ?? {}).filter(([, a]) => !!a) as [CrisisArcId, CrisisArc][];
}

export function crisisStage(d: GameState, id: CrisisArcId, a: CrisisArc): string {
  const def = CRISES[id];
  const t = (d.week - a.since) / def.months;
  return def.stages[Math.min(def.stages.length - 1, Math.floor(t * def.stages.length))];
}

export function adjustCrisis(d: GameState, e: Extract<Effect, { kind: 'crisis' }>): string[] {
  const all = crises(d);
  const def = CRISES[e.arc];
  if (e.start) {
    if (all[e.arc]) return [];
    all[e.arc] = { since: d.week, months: def.months, gauge: clamp(30 + (e.gauge ?? 0)), risk: clamp(30 + (e.risk ?? 0)), meta: e.meta };
    pushNews(d, 'actu', 'negative', def.label, `${def.stages[0]} Nouvel onglet : Crise.`);
    return [`${def.label} : la crise commence`];
  }
  const a = all[e.arc];
  if (!a) return [];
  const out: string[] = [];
  const sg = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  if (e.gauge) { a.gauge = clamp(a.gauge + e.gauge); out.push(`${def.gaugeLabel} ${sg(e.gauge)}`); }
  if (e.risk) { a.risk = clamp(a.risk + e.risk); out.push(`${def.riskLabel} ${sg(e.risk)}`); }
  return out;
}

/** Chaque mois : les crises évoluent, et se dénouent à leur terme */
export function monthlyCrises(d: GameState, rng: Rng): void {
  for (const [id, a] of activeCrises(d)) {
    const def = CRISES[id];
    a.gauge = clamp(a.gauge + def.drift.gauge * rng.range(0.5, 1.3));
    a.risk = clamp(a.risk + def.drift.risk * rng.range(0.5, 1.4) + (id === 'proces' ? d.player.scandalExposure / 40 : 0));
    if (d.week - a.since >= a.months) resolve(d, id, a, rng);
  }
}

function setRank(d: GameState, rank: RankId): void {
  d.player.rankId = rank;
  d.player.actionPoints.max = RANKS[rank].monthlyActionPoints;
  d.player.actionPoints.current = Math.min(d.player.actionPoints.current, d.player.actionPoints.max);
}

function resolve(d: GameState, id: CrisisArcId, a: CrisisArc, rng: Rng): void {
  delete crises(d)[id];
  const p = d.player;
  const s = p.stats;
  const win = (title: string, text: string) => { addMilestone(d, 'victoire', title, text); pushNews(d, 'actu', 'positive', title, text); };
  const lose = (title: string, text: string) => { addMilestone(d, 'revers', title, text); pushNews(d, 'actu', 'negative', title, text); };
  switch (id) {
    case 'cyber':
      if (a.gauge >= 60 && a.risk < 60) {
        s.credibility = clamp(s.credibility + 6); s.influence = clamp(s.influence + 3);
        win('La cyberattaque repoussée', `Tous les systèmes sont rétablis${a.meta ? ` ; l’attaque est attribuée à ${a.meta}` : ''}. Votre sang-froid est salué.`);
      } else {
        s.popularity = clamp(s.popularity - 6); s.credibility = clamp(s.credibility - 5);
        lose('La paralysie numérique', 'Des données de millions de Français circulent en ligne. On vous reproche la lenteur de la riposte.');
      }
      break;
    case 'proces': {
      const lawyer = p.staff.includes('juriste') ? 0.12 : 0;
      const acquit = rng.chance(clamp(a.gauge / (a.gauge + a.risk) + lawyer, 0.05, 0.95));
      if (acquit) {
        s.credibility = clamp(s.credibility + 6); s.popularity = clamp(s.popularity + 3);
        p.scandalExposure = clamp(p.scandalExposure - 20);
        win('Relaxé·e', 'Le tribunal vous relaxe. Vous sortez du palais de justice sous les flashs, la tête haute.');
      } else {
        s.credibility = clamp(s.credibility - 12); s.popularity = clamp(s.popularity - 10);
        p.flags['ineligibleUntil'] = d.week + 24;
        if (p.rankId === 'ministre' || p.rankId === 'premier_ministre') { d.portfolio = null; d.government = null; setRank(d, 'depute'); }
        lose('Condamné·e', 'Prison avec sursis et deux ans d’inéligibilité. Vous faites appel… sans grand espoir.');
      }
      break;
    }
    case 'jo':
      p.flags['joDone'] = true;
      if (a.gauge >= 65 && a.risk < 55) {
        s.popularity = clamp(s.popularity + 10); s.influence = clamp(s.influence + 5);
        if (d.presidency) d.presidency.approval = clamp(d.presidency.approval + 8);
        win('Des Jeux inoubliables', 'Cérémonie d’ouverture grandiose, moisson de médailles, pays en liesse. On vous associe à la réussite.');
      } else if (a.gauge >= 45) {
        s.popularity = clamp(s.popularity + 3);
        pushNews(d, 'actu', 'neutral', 'Des Jeux réussis, malgré tout', 'Quelques couacs, beaucoup d’émotions : un bilan honorable.');
      } else {
        s.popularity = clamp(s.popularity - 8); s.credibility = clamp(s.credibility - 4);
        lose('Le fiasco olympique', 'Transports saturés, budget explosé, piscine pas finie : le monde entier se moque.');
      }
      break;
    case 'krach':
      if (a.gauge >= 55 && a.risk < 60) {
        s.credibility = clamp(s.credibility + 6); s.influence = clamp(s.influence + 3);
        win('La crise financière surmontée', 'Les marchés repartent, l’emploi tient. On salue votre sang-froid.');
      } else {
        s.popularity = clamp(s.popularity - 6); s.credibility = clamp(s.credibility - 4);
        if (d.presidency) d.presidency.approval = clamp(d.presidency.approval - 8);
        lose('La récession', 'Un million de chômeurs de plus. On vous reproche d’avoir tardé.');
      }
      break;
    case 'megafeux':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 5);
        win('Les feux maîtrisés', 'Les derniers foyers sont éteints. Les pompiers défilent sous les applaudissements.');
      } else {
        s.popularity = clamp(s.popularity - 5);
        lose('Un été de cendres', 'Des dizaines de milliers d’hectares partis en fumée. La colère gronde.');
      }
      break;
    case 'agriculteurs':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); p.dossiers.territoires.mastery = clamp(p.dossiers.territoires.mastery + 5);
        win('L’accord avec les campagnes', 'Un accord historique : les tracteurs rentrent à la ferme.');
      } else {
        s.popularity = clamp(s.popularity - 4); s.stress = clamp(s.stress + 8);
        lose('Les campagnes en colère', 'Le mouvement s’essouffle sans accord. La rancœur, elle, reste.');
      }
      break;
    case 'taupe':
      if (a.gauge >= 60) {
        s.credibility = clamp(s.credibility + 5); s.influence = clamp(s.influence + 3);
        win('La taupe démasquée', 'Arrêtée à l’aube : un haut fonctionnaire au service d’une puissance étrangère.');
      } else {
        s.credibility = clamp(s.credibility - 5);
        lose('La taupe a filé', 'Elle a quitté le pays avec des secrets d’État. Le Parlement réclame des comptes.');
      }
      break;
    case 'blackout':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 5);
        win('La lumière revenue', 'Le réseau électrique est rétabli partout. On salue la mobilisation des techniciens… et la vôtre.');
      } else {
        s.popularity = clamp(s.popularity - 6);
        economy(d).growth -= 0.4;
        lose('La nuit noire', 'Trois semaines de coupures, des entreprises à l’arrêt : le pays vous en veut.');
      }
      break;
    case 'crue':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 5);
        win('Paris sauvé des eaux', 'Les digues ont tenu, les quartiers ont été protégés. Les images des sacs de sable font le tour du monde.');
      } else {
        s.popularity = clamp(s.popularity - 5);
        economy(d).confidence = clamp(economy(d).confidence - 5);
        lose('La Seine a tout emporté', 'Des milliards de dégâts, des milliers de sinistrés. L’État a été lent.');
      }
      break;
    case 'secheresse':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 4);
        electorate(d).offsets.ruraux = clamp(electorate(d).offsets.ruraux + 4, -30, 30);
        win('Le pacte de l’eau', 'Un accord de partage entre agriculteurs, villes et industriels. Les pluies d’automne font le reste.');
      } else {
        s.popularity = clamp(s.popularity - 5);
        electorate(d).offsets.ruraux = clamp(electorate(d).offsets.ruraux - 5, -30, 30);
        lose('Les robinets à sec', 'Des villages privés d’eau tout l’été. Le monde rural ne pardonne pas.');
      }
      break;
    case 'autonomie':
      if (a.gauge >= 55 && a.risk < 60) {
        s.influence = clamp(s.influence + 4); s.credibility = clamp(s.credibility + 3);
        win('Un statut d’autonomie négocié', `${a.meta ?? 'La région'} obtient de nouvelles compétences, dans la République. Un compromis salué des deux côtés.`);
      } else if (a.risk >= 70) {
        s.popularity = clamp(s.popularity - 4); s.stress = clamp(s.stress + 8);
        lose('La rupture', `Les négociations avec ${a.meta ?? 'la région'} échouent dans la colère. Les tensions dureront des années.`);
      } else {
        pushNews(d, 'actu', 'neutral', 'Statu quo', `Ni accord ni rupture avec ${a.meta ?? 'la région'} : le dossier est renvoyé à plus tard.`);
      }
      break;
    case 'ia':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 5);
        electorate(d).offsets.jeunes = clamp(electorate(d).offsets.jeunes + 3, -30, 30);
        win('L’IA remise au pas', 'Algorithme audité, décisions corrigées, contrôle humain rétabli : un modèle cité en Europe.');
      } else {
        s.credibility = clamp(s.credibility - 6);
        lose('Le scandale de l’algorithme', 'Des familles privées d’aides pendant des mois. La commission d’enquête sera sévère.');
      }
      break;
    case 'frelons':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 3);
        electorate(d).offsets.ruraux = clamp(electorate(d).offsets.ruraux + 3, -30, 30);
        win('Les frelons vaincus', 'Les ruchers repartent, le miel revient sur les marchés. On vous surnomme « l’apiculteur de la République ».');
      } else {
        s.popularity = clamp(s.popularity - 2);
        electorate(d).offsets.ruraux = clamp(electorate(d).offsets.ruraux - 4, -30, 30);
        lose('Le miel a disparu', 'Un tiers des ruches détruites. Les apiculteurs manifestent en combinaison devant la préfecture.');
      }
      break;
    case 'mars':
      if (a.gauge >= 60 && a.risk < 55) {
        s.popularity = clamp(s.popularity + 10); s.influence = clamp(s.influence + 5);
        d.intl.prestige = clamp(d.intl.prestige + 15);
        win('Des Français sur Mars', 'Le premier pas français sur Mars, en direct devant deux milliards de téléspectateurs. La Marseillaise résonne sur la planète rouge.');
      } else if (a.gauge >= 45) {
        pushNews(d, 'actu', 'neutral', 'Le lancement reporté', 'Trop de doutes techniques : la mission partira plus tard, sans vous comme visage du programme.');
      } else {
        s.popularity = clamp(s.popularity - 8); s.credibility = clamp(s.credibility - 5);
        lose('La catastrophe en direct', 'La fusée explose quarante secondes après le décollage. L’équipage s’en sort par miracle ; votre réputation, moins.');
      }
      break;
    case 'napoleon':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); s.credibility = clamp(s.credibility + 4);
        win('L’Empereur démasqué', 'Le « clone » était un comédien de Montélimar. Il repart en exil volontaire… à Sainte-Hélène, où il ouvre un restaurant.');
      } else {
        s.popularity = clamp(s.popularity - 6);
        if (d.presidency) d.presidency.approval = clamp(d.presidency.approval - 8);
        lose('Le sacre', 'Il se fait couronner sur le parvis de Notre-Dame devant une foule en délire. Son mouvement pèsera désormais dans chaque élection.');
      }
      break;
    case 'atlantide':
      if (a.gauge >= a.risk) {
        d.intl.prestige = clamp(d.intl.prestige + 8);
        economy(d).growth += 0.2;
        win('L’Atlantide française', 'L’ONU reconnaît la souveraineté française. Le premier musée de l’Atlantide ouvre à Brest.');
      } else {
        d.intl.prestige = clamp(d.intl.prestige - 5); s.popularity = clamp(s.popularity - 3);
        lose('L’Atlantide internationalisée', 'L’île est placée sous tutelle internationale. La Bretagne regarde passer les touristes du monde entier.');
      }
      break;
    case 'ia_candidate':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 5);
        electorate(d).offsets.jeunes = clamp(electorate(d).offsets.jeunes + 2, -30, 30);
        win('L’IA renvoyée à ses serveurs', 'Le Conseil constitutionnel rappelle qu’un candidat doit être une personne. Le débat a réveillé la démocratie.');
      } else {
        s.popularity = clamp(s.popularity - 4); s.influence = clamp(s.influence - 3);
        lose('L’IA en tête des sondages', 'Écartée du scrutin in extremis, ALMA reste la personnalité préférée des Français. Les humains ont pris un coup de vieux.');
      }
      break;
    case 'grand_hiver':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 6); s.credibility = clamp(s.credibility + 4);
        win('Le printemps revenu', 'Le soleil reparaît enfin. Le pays a tenu, solidaire, et s’en souviendra.');
      } else {
        s.popularity = clamp(s.popularity - 8);
        economy(d).growth -= 1;
        lose('L’exode', 'Des millions de Français partis vers le Sud, des villages vidés. Le pays mettra des années à se relever.');
      }
      break;
    case 'penurie_medicaments':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 5); s.popularity = clamp(s.popularity + 3);
        electorate(d).offsets.retraites = clamp(electorate(d).offsets.retraites + 3, -30, 30);
        win('Les pharmacies réapprovisionnées', 'Stocks stratégiques, usines relocalisées, achats européens groupés : la France ne manquera plus d’amoxicilline.');
      } else {
        s.popularity = clamp(s.popularity - 5);
        electorate(d).offsets.retraites = clamp(electorate(d).offsets.retraites - 3, -30, 30);
        lose('Les ruptures s’installent', 'Des patients sans traitement, des pharmaciens à bout : la pénurie devient chronique.');
      }
      break;
    case 'train_futur':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); s.influence = clamp(s.influence + 3);
        economy(d).growth += 0.15; d.intl.prestige = clamp(d.intl.prestige + 4);
        win('Paris–Marseille en 1 h 10', 'Le premier train magnétique commercial du monde est français. Les commandes affluent de trois continents.');
      } else {
        s.credibility = clamp(s.credibility - 4);
        economy(d).deficit += 0.1;
        lose('Le train qui ne partit jamais', 'Recours, tracé abandonné, consortium en faillite : il reste quinze kilomètres de voie test dans la Beauce.');
      }
      break;
    case 'pandas':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); d.intl.prestige = clamp(d.intl.prestige + 4);
        economy(d).confidence += 2;
        win('Un bébé panda français', 'La femelle donne naissance à un petit, baptisé par un vote national. Pékin est ravi ; le zoo bat tous ses records.');
      } else {
        s.credibility = clamp(s.credibility - 4); d.intl.prestige = clamp(d.intl.prestige - 4);
        lose('Les pandas rappelés à Pékin', 'Un incident protocolaire de trop : la Chine rapatrie ses pandas. Les enfants de France pleurent devant l’enclos vide.');
      }
      break;
    case 'coupe_monde':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 6); s.influence = clamp(s.influence + 2);
        economy(d).growth += 0.2; economy(d).confidence += 4; d.intl.prestige = clamp(d.intl.prestige + 3);
        win('Champions du monde à la maison !', 'Un million de personnes sur les Champs-Élysées, des inconnus qui s’embrassent : la Coupe du monde est une fête inoubliable.');
      } else {
        s.popularity = clamp(s.popularity - 5);
        economy(d).deficit += 0.1;
        lose('Le fiasco du Mondial', 'Stades à moitié vides, supporters bloqués sur les quais, fan-zone évacuée : le monde se moque de l’organisation française.');
      }
      break;
    case 'jubile':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4);
        if (d.kingdom) { d.kingdom.prestige = clamp(d.kingdom.prestige + 12); d.kingdom.opposition = clamp(d.kingdom.opposition - 8); d.kingdom.stabilite = clamp(d.kingdom.stabilite + 5); }
        win('Le jubilé triomphal', 'Un million de personnes acclament le carrosse sur les Champs-Élysées. Même certains républicains avouent avoir été émus.');
      } else {
        s.popularity = clamp(s.popularity - 3);
        if (d.kingdom) { d.kingdom.prestige = clamp(d.kingdom.prestige - 8); d.kingdom.opposition = clamp(d.kingdom.opposition + 10); }
        lose('Le contre-jubilé l’emporte', 'Tribunes clairsemées, sifflets sur le parcours : le contre-jubilé républicain a éclipsé les festivités royales.');
      }
      break;
    case 'diamants':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 6); s.popularity = clamp(s.popularity + 2);
        p.scandalExposure = clamp(p.scandalExposure - 12);
        win('Blanchi·e dans l’affaire des diamants', 'L’enquête établit que l’écrin a été remis au musée des Cadeaux d’État le jour même. L’hebdomadaire publie un rectificatif.');
      } else {
        s.credibility = clamp(s.credibility - 8); s.popularity = clamp(s.popularity - 5);
        p.scandalExposure = clamp(p.scandalExposure + 15);
        lose('Les diamants vous collent à la peau', 'Faute de preuves, l’enquête est classée… mais le doute s’installe pour toujours. Les caricaturistes vous dessinent couvert·e de bijoux.');
      }
      break;
    case 'ours':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 3); s.credibility = clamp(s.credibility + 3);
        electorate(d).offsets.ruraux = clamp(electorate(d).offsets.ruraux + 2, -30, 30);
        win('La paix des estives', 'Patous, bergers aidés, indemnisations rapides : ours et brebis cohabitent. Le modèle pyrénéen fait école en Europe.');
      } else {
        s.popularity = clamp(s.popularity - 4);
        electorate(d).offsets.ruraux = clamp(electorate(d).offsets.ruraux - 3, -30, 30);
        lose('La guerre des estives', 'Bergers en colère, ours braconnés, procès en cascade : la montagne vous en veut.');
      }
      break;
    case 'penurie_essence':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 5); s.popularity = clamp(s.popularity + 2);
        win('Les pompes coulent à nouveau', 'Réquisitions, stocks stratégiques, accord salarial : la pénurie est vaincue en quelques semaines.');
      } else {
        s.popularity = clamp(s.popularity - 5);
        economy(d).growth -= 0.2;
        lose('La France à l’arrêt', 'Un mois de stations à sec : entreprises fermées, ambulances rationnées. On vous reproche d’avoir laissé pourrir.');
      }
      break;
    case 'capitale_culture':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); s.influence = clamp(s.influence + 2);
        d.intl.prestige = clamp(d.intl.prestige + 3); economy(d).growth += 0.05;
        win('Une année inoubliable', 'Douze millions de visiteurs, des quartiers transformés : la capitale de la culture laisse un héritage durable.');
      } else {
        s.credibility = clamp(s.credibility - 4);
        lose('Le rideau tombe trop tôt', 'Programmation annulée, budgets dépassés, salles vides : l’Europe retiendra surtout les polémiques.');
      }
      break;
    case 'canicule':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 5); s.popularity = clamp(s.popularity + 3);
        electorate(d).offsets.retraites = clamp(electorate(d).offsets.retraites + 2, -30, 30);
        win('L’été tenu', 'Salles rafraîchies, appels aux personnes isolées, renforts dans les hôpitaux : le plan canicule a tenu. Le pays respire.');
      } else {
        s.popularity = clamp(s.popularity - 5);
        electorate(d).offsets.retraites = clamp(electorate(d).offsets.retraites - 3, -30, 30);
        lose('L’été noir', 'Urgences débordées, Ehpad sans climatisation : on vous reproche d’avoir réagi trop tard.');
      }
      break;
    case 'hacker':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 5); p.scandalExposure = clamp(p.scandalExposure - 10);
        win('« Robespierre » arrêté', 'Un étudiant de 22 ans, interpellé dans une chambre de bonne. Vos messages, eux, ne contenaient rien de honteux.');
      } else {
        s.credibility = clamp(s.credibility - 5); p.scandalExposure = clamp(p.scandalExposure + 12);
        lose('Les fuites continuent', '« Robespierre » court toujours, et vos SMS les plus maladroits font la une.');
      }
      break;
    case 'barons':
      if (a.gauge >= a.risk) {
        s.influence = clamp(s.influence + 6); d.party.cohesion = clamp(d.party.cohesion + 10);
        p.renown = (p.renown ?? 0) + 30;
        win('Les barons rentrent au bercail', 'Un accord de gouvernance partagée : les grands élus restent, le parti sort renforcé de l’épreuve.');
      } else {
        s.influence = clamp(s.influence - 6); d.party.cohesion = clamp(d.party.cohesion - 15);
        for (const f of d.party.factions) f.supportForPlayer = clamp(f.supportForPlayer - 6);
        lose('La sécession des barons', 'Les grands élus claquent la porte avec leurs fédérations et leurs financements. Le parti est amputé.');
      }
      break;
    case 'grand_debat':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 5); s.credibility = clamp(s.credibility + 3);
        p.renown = (p.renown ?? 0) + 25;
        win('La parole tenue', 'Deux millions de contributions, trente mesures retenues, une loi votée : le grand débat a changé quelque chose.');
      } else {
        s.credibility = clamp(s.credibility - 6);
        lose('Un débat pour rien', 'Les conclusions finissent dans un tiroir. « Ils nous ont fait parler pour mieux ne rien faire. »');
      }
      break;
    case 'tour_eiffel':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 5); d.intl.prestige = clamp(d.intl.prestige + 3);
        economy(d).confidence += 2; p.renown = (p.renown ?? 0) + 30;
        win('La Dame de fer sauvée', 'Repeinte, renforcée, illuminée : la tour Eiffel rouvre sous un feu d’artifice, et la file d’attente fait trois fois le tour du Champ-de-Mars.');
      } else {
        s.credibility = clamp(s.credibility - 5); d.intl.prestige = clamp(d.intl.prestige - 3);
        lose('La tour mutilée', 'Faute de solution, le troisième étage est démonté et stocké à Vincennes. La tour amputée devient le symbole d’un pays qui ne sait plus entretenir ses trésors.');
      }
      break;
    case 'baleine':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 5); p.renown = (p.renown ?? 0) + 20;
        win('Elle a regagné la mer', 'Escortée par des barges et dix mille personnes sur les berges, la baleine retrouve la Manche. Le pays entier pleure de joie.');
      } else {
        s.popularity = clamp(s.popularity - 3); s.credibility = clamp(s.credibility - 3);
        lose('La baleine n’a pas survécu', 'Après des jours d’agonie filmée en direct, la baleine s’échoue près de Vernon. On vous reproche d’avoir hésité.');
      }
      break;
    case 'mariage_princier':
      if (a.gauge >= a.risk) {
        d.intl.prestige = clamp(d.intl.prestige + 4); s.popularity = clamp(s.popularity + 3);
        economy(d).confidence += 2; p.renown = (p.renown ?? 0) + 25;
        win('Le mariage de l’année', 'Deux milliards de téléspectateurs, une mariée radieuse et un bal populaire jusqu’à l’aube : Paris a ébloui le monde.');
      } else {
        d.intl.prestige = clamp(d.intl.prestige - 3); s.credibility = clamp(s.credibility - 3);
        lose('Le fiasco du mariage', 'Un plan de table désastreux, des huées sur le cortège et une mariée en larmes : la Valmorie rappelle son ambassadeur.');
      }
      break;
    case 'cathedrale':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); s.credibility = clamp(s.credibility + 3); p.renown = (p.renown ?? 0) + 25;
        win('La flèche renaît', 'Cinq ans jour pour jour après l’incendie, les cloches sonnent à nouveau. Les compagnons qui ont rebâti la charpente sont applaudis sur le parvis.');
      } else {
        s.credibility = clamp(s.credibility - 5);
        lose('Un chantier enlisé', 'Querelles d’architectes, budgets explosés, délais repoussés : la cathédrale reste sous bâche, et on vous en tient pour responsable.');
      }
      break;
    case 'punaises':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 3); s.credibility = clamp(s.credibility + 2);
        win('Le pays dort tranquille', 'Chiens renifleurs, chèques de désinsectisation, information : l’invasion est contenue, la psychose retombe.');
      } else {
        s.popularity = clamp(s.popularity - 3); s.credibility = clamp(s.credibility - 3); economy(d).confidence -= 2;
        lose('La psychose', 'Les touristes boudent Paris, les cinémas se vident, et l’opposition brandit une boîte de punaises à la tribune.');
      }
      break;
    case 'esport':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); d.intl.prestige = clamp(d.intl.prestige + 2); p.renown = (p.renown ?? 0) + 20;
        win('Bercy en délire', 'La France remporte la finale au bout d’une nuit folle. Les jeunes vous découvrent ; les parents, un peu perplexes, applaudissent quand même.');
      } else {
        s.popularity = clamp(s.popularity - 3); s.credibility = clamp(s.credibility - 2);
        lose('Le grand bug', 'Les serveurs tombent en pleine finale. Deux cents millions de spectateurs fixent un écran noir, et le mot-dièse #FranceBug fait le tour du monde.');
      }
      break;
    case 'satellite':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 4); s.popularity = clamp(s.popularity + 2); p.renown = (p.renown ?? 0) + 15;
        win('Le satellite tombe dans l’océan', 'Rentrée atmosphérique au-dessus de l’Atlantique, à 900 kilomètres des côtes : aucune victime, et une France qui s’était préparée sans s’affoler.');
      } else {
        s.credibility = clamp(s.credibility - 4); s.popularity = clamp(s.popularity - 2);
        lose('La panique pour rien', 'Le satellite tombe en mer… après des évacuations chaotiques, des pillages de supermarchés et des écoles fermées pour rien.');
      }
      break;
    case 'casse':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 4); d.intl.prestige = clamp(d.intl.prestige + 2); p.renown = (p.renown ?? 0) + 20;
        win('L’or retrouvé', 'Arrêté dans un port du Nord, le cerveau du casse avouait tout. Les lingots retrouvent leurs coffres sous les caméras du monde entier.');
      } else {
        s.credibility = clamp(s.credibility - 5); d.intl.prestige = clamp(d.intl.prestige - 3); economy(d).confidence -= 2;
        lose('L’or envolé', 'Le dossier est classé, l’or jamais retrouvé. Les humoristes étrangers tiennent leur sketch de l’année.');
      }
      break;
    case 'vin':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); economy(d).growth += 0.1; economy(d).confidence += 2;
        win('La paix des vignes', 'Un accord commercial lève les taxes ; de nouveaux marchés s’ouvrent en Asie. Les vignerons trinquent à votre santé.');
      } else {
        s.popularity = clamp(s.popularity - 4); economy(d).growth -= 0.1; economy(d).unemployment += 0.1;
        lose('Les vignes arrachées', 'Faute d’accord, des milliers d’hectares sont arrachés. Les régions viticoles ne vous le pardonneront pas.');
      }
      break;
    case 'nuage':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 4); s.popularity = clamp(s.popularity + 2);
        win('La vérité, enfin', 'Analyses publiées, indemnisations versées, usine reconstruite aux normes : les riverains saluent une transparence rare.');
      } else {
        s.credibility = clamp(s.credibility - 6); s.popularity = clamp(s.popularity - 2);
        lose('Le nuage du soupçon', 'Des chiffres sortis au compte-gouttes, des potagers interdits trop tard : la région ne vous croit plus.');
      }
      break;
    case 'taxis':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 3); economy(d).growth += 0.05; s.influence = clamp(s.influence + 2);
        win('Une route partagée', 'Un cadre clair : taxis autonomes autorisés sur certaines lignes, chauffeurs reconvertis et indemnisés. Paris devient une vitrine.');
      } else {
        s.popularity = clamp(s.popularity - 3); s.credibility = clamp(s.credibility - 2);
        lose('La guerre des taxis', 'Accident, blocages, recours : l’expérience tourne au fiasco et l’entreprise part s’installer ailleurs.');
      }
      break;
    case 'fusion':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 4); d.intl.prestige = clamp(d.intl.prestige + 4); economy(d).confidence += 3; p.renown = (p.renown ?? 0) + 30;
        win('L’étoile française', 'Un grand programme national, des chercheurs qui reviennent de l’étranger, un premier réacteur prototype annoncé : la France tient la tête de la course.');
      } else {
        d.intl.prestige = clamp(d.intl.prestige - 3); s.credibility = clamp(s.credibility - 3);
        lose('La découverte envolée', 'L’équipe part en Californie avec ses brevets. La France regardera la suite de loin.');
      }
      break;
    case 'viaduc':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 4); s.popularity = clamp(s.popularity + 2);
        win('Le pont rouvert', 'Réparé en un temps record, et un grand plan d’inspection des ouvrages lancé dans tout le pays : la vallée respire.');
      } else {
        s.popularity = clamp(s.popularity - 4); s.credibility = clamp(s.credibility - 2);
        lose('La vallée oubliée', 'Des mois de détours, des commerces fermés, des études qui s’empilent : le viaduc reste fermé et la vallée vous en veut.');
      }
      break;
    case 'tresor':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 3); p.renown = (p.renown ?? 0) + 15; s.credibility = clamp(s.credibility + 2);
        win('Le trésor au musée', 'Les pièces rejoignent un nouveau musée sur place : les files d’attente s’étirent dès l’ouverture.');
      } else {
        s.credibility = clamp(s.credibility - 4);
        lose('Le trésor dispersé', 'Une partie des pièces a disparu, le reste dort dans des caisses. Les archéologues ne vous le pardonneront pas.');
      }
      break;
    case 'algues':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 3); s.popularity = clamp(s.popularity + 2);
        win('La baie reconquise', 'Moins de nitrates, des agriculteurs accompagnés, des plages rouvertes : la baie reprend des couleurs.');
      } else {
        s.popularity = clamp(s.popularity - 3); s.credibility = clamp(s.credibility - 3);
        lose('La marée verte', 'Les algues reviennent chaque été, plus nombreuses. Le littoral ne croit plus aux plans.');
      }
      break;
    case 'barrage':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 4); s.popularity = clamp(s.popularity + 2);
        win('La vallée rassurée', 'Le barrage est conforté, le lac remonte doucement sous surveillance permanente : les habitants rentrent chez eux.');
      } else {
        s.popularity = clamp(s.popularity - 3); s.credibility = clamp(s.credibility - 3);
        lose('La vallée vidée', 'Faute de confiance, des milliers d’habitants sont partis pour de bon. Le barrage tient, mais la vallée se meurt.');
      }
      break;
    case 'aviaire':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 3); s.popularity = clamp(s.popularity + 1);
        win('L’épizootie enrayée', 'Vaccination massive, éleveurs indemnisés, plus un seul foyer : la filière repart, et l’Europe copie le modèle.');
      } else {
        s.popularity = clamp(s.popularity - 3); s.credibility = clamp(s.credibility - 2);
        lose('Les élevages ruinés', 'Des millions de volailles abattues, des éleveurs qui jettent l’éponge : la filière met des années à s’en remettre.');
      }
      break;
    case 'skipper':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 5); p.renown = (p.renown ?? 0) + 20;
        win('Retrouvée vivante', 'Un cargo la repère, accrochée à son radeau de survie après onze jours en mer. Le pays tout entier pleure de joie.');
      } else {
        s.popularity = clamp(s.popularity - 1);
        lose('La mer a gardé son secret', 'Les recherches sont arrêtées. Un hommage national lui est rendu, et son nom sera donné à une promotion de l’École navale.');
      }
      break;
    case 'drones':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 4); d.intl.prestige = clamp(d.intl.prestige + 1);
        win('Les pilotes démasqués', 'Un réseau d’espionnage étranger est démantelé, ses drones saisis : la France se dote d’une défense anti-drones exemplaire.');
      } else {
        s.credibility = clamp(s.credibility - 4); s.popularity = clamp(s.popularity - 1);
        lose('Le mystère reste entier', 'Les survols cessent sans explication. Les théories du complot, elles, prospèrent.');
      }
      break;
    case 'cyclone':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 3); s.credibility = clamp(s.credibility + 3);
        win('L’île debout', 'Écoles, hôpital et réseau électrique reconstruits aux normes anticycloniques : la Guadeloupe salue un État enfin présent.');
      } else {
        s.popularity = clamp(s.popularity - 4); s.credibility = clamp(s.credibility - 2);
        lose('L’outre-mer oublié', 'Des mois après, des familles vivent encore sous des bâches. La rancœur durera longtemps.');
      }
      break;
    case 'lithium':
      if (a.gauge >= a.risk) {
        economy(d).growth += 0.1; s.credibility = clamp(s.credibility + 3); d.intl.prestige = clamp(d.intl.prestige + 2);
        win('La vallée du lithium', 'Une mine exemplaire, des nappes protégées, une usine de batteries et quatre mille emplois : l’Alsace devient le cœur électrique de l’Europe.');
      } else {
        s.popularity = clamp(s.popularity - 2); s.credibility = clamp(s.credibility - 2);
        lose('Le gisement endormi', 'Recours, manifestations, investisseurs partis : le lithium reste sous terre, et les batteries viendront d’ailleurs.');
      }
      break;
    case 'sous_marin':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 5); s.credibility = clamp(s.credibility + 3); d.intl.prestige = clamp(d.intl.prestige + 2);
        win('Les cent dix marins sauvés', 'Le sous-marin est remonté à la surface, son équipage sain et sauf. Le pays entier accueille les marins à Brest.');
      } else {
        s.popularity = clamp(s.popularity - 3); d.intl.prestige = clamp(d.intl.prestige - 2); d.intl.tension = clamp(d.intl.tension + 6);
        lose('Un sauvetage au goût amer', 'L’équipage est sauvé de justesse, mais l’incident avec la puissance rivale laissera des traces.');
      }
      break;
    case 'joconde':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); p.renown = (p.renown ?? 0) + 20; d.intl.prestige = clamp(d.intl.prestige + 2);
        win('Mona Lisa est rentrée', 'Retrouvée intacte dans un entrepôt de la banlieue de Naples, la Joconde retrouve sa vitrine sous les vivats d’une foule immense.');
      } else {
        s.credibility = clamp(s.credibility - 4); d.intl.prestige = clamp(d.intl.prestige - 3);
        lose('Le sourire envolé', 'L’enquête s’enlise. Dans la salle des États, une copie fait office d’original. Le monde entier s’en amuse.');
      }
      break;
    case 'quatre_jours':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 3); s.credibility = clamp(s.credibility + 2); economy(d).growth += 0.03;
        win('Le vendredi libéré', 'Productivité maintenue, arrêts maladie en baisse, salariés ravis : l’expérience est étendue à tout volontaire.');
      } else {
        s.credibility = clamp(s.credibility - 3); s.popularity = clamp(s.popularity - 1);
        lose('L’expérience avortée', 'Services fermés, heures sup en cascade, patrons furieux : l’expérimentation est abandonnée dans la confusion.');
      }
      break;
    case 'tempete_solaire':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 5); s.popularity = clamp(s.popularity + 3);
        win('Le pays a tenu', 'Groupes électrogènes, cartes papier, solidarité : la France traverse la tempête sans drame. Les plans d’urgence deviennent un modèle.');
      } else {
        s.popularity = clamp(s.popularity - 4);
        economy(d).growth -= 0.3;
        lose('Le grand black-out numérique', 'Trois semaines de chaos : commerces fermés, hôpitaux sous groupes électrogènes. On cherche des responsables.');
      }
      break;
    case 'expo_universelle':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 5); s.influence = clamp(s.influence + 3);
        d.intl.prestige = clamp(d.intl.prestige + 6); economy(d).growth += 0.2;
        win('Une Exposition triomphale', '45 millions de visiteurs, une tour de verre devenue symbole, et des contrats signés avec le monde entier.');
      } else {
        s.credibility = clamp(s.credibility - 5);
        economy(d).deficit += 0.15;
        lose('L’Exposition des retards', 'Pavillons inachevés, budget triplé, files d’attente géantes : l’« Expo des grues » fait rire l’Europe.');
      }
      break;
    case 'seisme':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 5); s.credibility = clamp(s.credibility + 4);
        win('Les villages reconstruits', 'Écoles rouvertes, maisons parasismiques, une fête dans chaque village : les sinistrés vous remercient en personne.');
      } else {
        s.popularity = clamp(s.popularity - 5);
        economy(d).deficit += 0.1;
        lose('Les oubliés du séisme', 'Un an après, des familles vivent toujours en mobil-home. « Abandonnés » titre la presse régionale.');
      }
      break;
    case 'loto':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 5); s.credibility = clamp(s.credibility + 3);
        p.finances.personal += 30000;
        win('Le gros lot partagé', 'Une fondation, des bourses, un hôpital rénové : le pays salue l’élu·e qui n’a rien gardé pour sa pomme. Vous n’avez gardé que 30 000 € pour refaire la toiture.');
      } else {
        s.credibility = clamp(s.credibility - 5); s.popularity = clamp(s.popularity - 3);
        p.finances.personal += 150000;
        lose('L’élu·e millionnaire', 'Villa, voiture de sport, soupçons : la presse vous surnomme « Picsou ». Après les avocats et le fisc, il vous reste 150 000 €, et une image abîmée.');
      }
      break;
    case 'comete':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 6); s.credibility = clamp(s.credibility + 4);
        d.intl.prestige = clamp(d.intl.prestige + 5);
        win('La comète déviée', 'À 3 h 12, le choc du vaisseau dévie la comète de quelques degrés. Elle passe au large, superbe, dans le ciel de toute l’Europe.');
      } else {
        s.popularity = clamp(s.popularity - 4);
        economy(d).growth -= 0.5; economy(d).confidence = clamp(economy(d).confidence - 10);
        lose('La grande panique', 'La comète passe finalement au large, mais la panique a vidé les rayons, fermé les écoles et fait chuter la Bourse.');
      }
      break;
    case 'referendum':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); s.influence = clamp(s.influence + 3);
        win('Le référendum gagné', 'Votre camp l’emporte avec 54 % des voix. La participation, record, donne une légitimité éclatante au résultat.');
      } else {
        s.popularity = clamp(s.popularity - 4); s.influence = clamp(s.influence - 2);
        lose('Le référendum perdu', 'Le camp adverse l’emporte. Vous reconnaissez la défaite d’une voix blanche, sous les huées.');
      }
      break;
    case 'templiers':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); s.credibility = clamp(s.credibility + 3);
        economy(d).growth += 0.1;
        win('Le trésor au musée', 'Manuscrits, reliquaires et pièces d’or rejoignent un musée flambant neuf. Le tourisme explose dans le département.');
      } else {
        s.credibility = clamp(s.credibility - 4); s.popularity = clamp(s.popularity - 2);
        lose('Le trésor pillé', 'Une nuit de brouillard, la crypte est vidée. Les coffres réapparaissent, un par un, dans des ventes aux enchères à l’étranger.');
      }
      break;
    case 'eurovision':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 5); s.influence = clamp(s.influence + 2);
        electorate(d).offsets.jeunes = clamp(electorate(d).offsets.jeunes + 3, -30, 30);
        d.intl.prestige = clamp(d.intl.prestige + 4);
        win('Une finale de légende', 'Paillettes, feux d’artifice et zéro incident : l’Europe entière parle de la meilleure Eurovision de l’histoire.');
      } else {
        s.popularity = clamp(s.popularity - 4);
        economy(d).deficit += 0.1;
        lose('Douze points de pénalité', 'Panne de son en plein direct, budget explosé, chanteur hué : la France devient la risée du continent.');
      }
      break;
    case 'sosie':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 5); s.popularity = clamp(s.popularity + 3);
        win('Le sosie démasqué', 'Confondu par une empreinte digitale et un accent belge, le sosie avoue : une caméra cachée qui a très mal tourné. La France rit… avec vous.');
      } else {
        s.credibility = clamp(s.credibility - 6); s.influence = clamp(s.influence - 3);
        lose('Le doute persiste', 'Le sosie s’évapore, mais un tiers des Français croit encore que c’est vous qui avez dansé la macarena au conseil municipal.');
      }
      break;
    case 'greve_generale':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); s.credibility = clamp(s.credibility + 3);
        electorate(d).offsets.populaires = clamp(electorate(d).offsets.populaires + 3, -30, 30);
        win('Les accords de Grenelle II', 'Hausse du SMIC, semaine de quatre jours expérimentée, fin de la grève : syndicats et patronat signent à l’aube.');
      } else {
        s.popularity = clamp(s.popularity - 5);
        economy(d).growth -= 0.4;
        lose('Le pays à l’arrêt', 'Six semaines de paralysie, un trimestre de récession, et une rancune tenace des deux côtés.');
      }
      break;
    case 'dissolution': {
      const chance = clamp(0.35 + (a.gauge - a.risk) / 100 + localBonus(d) / 100 + s.popularity / 250, 0.08, 0.95);
      if (rng.chance(chance)) {
        s.popularity = clamp(s.popularity + 3); s.influence = clamp(s.influence + 3);
        win('Réélu·e après la dissolution', 'Au soir du second tour, votre siège est sauvé. Beaucoup de collègues n’ont pas eu cette chance.');
      } else {
        if (p.rankId === 'depute') setRank(d, 'conseiller_municipal');
        p.flags['nextElectionWeek'] = d.week + 8;
        s.influence = clamp(s.influence - 6);
        lose('Battu·e aux législatives anticipées', 'La vague adverse emporte votre siège. Retour au conseil municipal.');
      }
      break;
    }
  }
}

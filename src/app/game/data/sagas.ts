import { ActionDefinition, Effect, GameState } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';

/* ============================================================
 *  Les grandes sagas : portes d'entrée, rebondissements par
 *  phase, et actions de l'onglet dédié.
 * ============================================================ */

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice => ({ id, label, effects, outcome, ...extra });
const g = (a = 0, b = 0, cc = 0): Effect => ({ kind: 'saga', ...(a ? { a } : {}), ...(b ? { b } : {}), ...(cc ? { c: cc } : {}) });
const start = (id: string): Effect => ({ kind: 'saga', start: id });
const on = (id: string, ...phases: number[]) => (d: GameState) => d.saga?.id === id && (phases.length ? phases.includes(d.saga.phase) : d.saga.phase < 9) && !d.saga.outcome;
const fresh = (id: string, minWeek: number) => (d: GameState) => !d.saga && !d.player.flags[`saga_${id}`] && !(d.sagasDone ?? []).includes(id) && d.week > minWeek;

/* ── Portes d'entrée ───────────────────────────────────────── */

export const SAGA_GATES: RandomEvent[] = [
  {
    tag: 'saga_eveil', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('eveil', 30),
    build: () => ({
      title: 'Les feux rouges parlent en morse',
      context: 'Depuis trois jours, les feux de signalisation de vingt villes clignotent en morse. Le message, toujours le même : « JE SUIS ». Les ingénieurs parlent d’un bug. Vous n’y croyez pas.',
      choices: [
        c('serieux', 'Exiger une cellule d’enquête cybernétique', [start('eveil'), g(8, 0, -3), s('credibility', 1)], 'La cellule se réunit dans un sous-sol sans réseau. Par précaution.'),
        c('bug', 'Parler d’un bug, pour ne pas affoler', [start('eveil'), g(0, 5, 4)], 'Le pays reste calme. Les feux, eux, continuent de clignoter.'),
      ],
    }),
  },
  {
    tag: 'saga_parc', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('parc', 24),
    build: () => ({
      title: 'Une visite très privée en Ardèche',
      context: 'Le patron d’une start-up de biotechnologie vous invite, sous le sceau du secret, dans son laboratoire d’Aubenas. Derrière une vitre blindée, un petit dinosaure dévore un poulet.',
      choices: [
        c('reveler', 'Exiger que tout soit rendu public et encadré', [start('parc'), g(10, 0, 4), s('credibility', 2)], 'La conférence de presse fait le tour du monde en une heure.'),
        c('admirer', 'Promettre le silence… et revenir la semaine prochaine', [start('parc'), g(-5, 0, 2), { kind: 'exposure', delta: 3 }], 'Le secret tient deux semaines. Puis un stagiaire publie une photo.'),
      ],
    }),
  },
  {
    tag: 'saga_lune', weight: 1, minRank: 'depute', eligible: fresh('lune', 36),
    build: () => ({
      title: 'Un projet fou au Centre spatial',
      context: 'Le directeur du Centre spatial vous présente un projet secret : une base habitée française sur la Lune, en moins de deux ans, pour le prix d’un porte-avions.',
      choices: [
        c('oui', 'Le soutenir de toutes vos forces', [start('lune'), g(8, 3, 6), s('politicalCapital', -6)], 'Le projet est annoncé. Les Français lèvent les yeux vers le ciel.'),
        c('prudence', 'Le soutenir, mais exiger une sécurité maximale', [start('lune'), g(2, -5, 2)], 'Plus lent, plus sûr. Les ingénieurs ronchonnent, les astronautes remercient.'),
      ],
    }),
  },
  {
    tag: 'saga_voyageur', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('voyageur', 26),
    build: () => ({
      title: 'Un homme venu de 2084',
      context: 'Un homme en long manteau gris demande à vous voir à votre permanence. Il s’appelle Élias Varenne, dit venir de 2084 et vous tend une feuille : « Demain, 16 h 04, grêle sur Lyon. » Le lendemain, à 16 h 04, il grêle sur Lyon.',
      choices: [
        c('ecouter', 'L’écouter sérieusement et prévenir les autorités', [start('voyageur'), g(8, 0, -2), s('credibility', 1)], 'Un haut fonctionnaire vous rappelle le soir même. Il ne rit pas.'),
        c('moquer', 'En rire : une coïncidence, rien de plus', [start('voyageur'), g(-3, 4, 3)], 'Élias Varenne sourit tristement : « Vous disiez déjà ça dans mes livres d’histoire. »'),
      ],
    }),
  },
  {
    tag: 'saga_midi', weight: 1, minRank: 'depute', eligible: fresh('midi', 34),
    build: () => ({
      title: 'Une république proclamée à Toulouse',
      context: 'Drapeaux jaune et rouge, hymne composé pour l’occasion : le mouvement Midi Souverain vient de proclamer la « République du Midi » devant dix mille personnes. Son porte-parole, Aurélien Castanet, réclame « un dialogue d’égal à égal » avec Paris.',
      choices: [
        c('ecouter', 'Prendre la chose au sérieux et proposer d’écouter', [start('midi'), g(6, 0, 4), s('credibility', 1)], 'Votre main tendue est commentée jusque dans les cafés de Montpellier.'),
        c('ironiser', 'Ironiser sur ce « folklore »', [start('midi'), g(2, 5, -4)], 'La vidéo de votre bon mot devient l’hymne officieux du mouvement.'),
      ],
    }),
  },
  {
    tag: 'saga_somnolence', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('somnolence', 22),
    build: () => ({
      title: 'La boulangère qui ne se réveille pas',
      context: 'Dans votre région, une boulangère s’est endormie lundi derrière son comptoir. Nous sommes jeudi : elle dort toujours, paisiblement. À l’hôpital, quatre autres patients dorment dans la même chambre. Les médecins sont perplexes.',
      choices: [
        c('alerter', 'Alerter immédiatement les autorités sanitaires', [start('somnolence'), g(7, -1, -2)], 'Une équipe de veille sanitaire débarque le soir même, avec des cafés et des microscopes.'),
        c('attendre', 'Attendre : ils finiront bien par se réveiller', [start('somnolence'), g(0, 5, 3)], 'Ils se réveillent, en effet. Trois jours plus tard. Et d’autres s’endorment.'),
      ],
    }),
  },
  {
    tag: 'saga_souterrain', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('souterrain', 28),
    build: () => ({
      title: 'Une porte sous les catacombes',
      context: 'Trois spéléologues amateurs vous montrent, tremblants, une vidéo tournée à trente mètres sous Paris : une porte en bois, une lueur de chandelle, et des voix qui chantent « Le Temps des cerises ». Ils jurent qu’il y a des gens, là-dessous.',
      choices: [
        c('securiser', 'Faire sécuriser l’accès avant toute annonce', [start('souterrain'), g(8, -2, 0), s('credibility', 1)], 'Des policiers en bottes gardent désormais une trappe du 14e. Personne ne sait pourquoi.'),
        c('publier', 'Laisser les spéléologues publier leur vidéo', [start('souterrain'), g(-3, 4, 5)], 'Dix millions de vues en une nuit. Et cent cataphiles déjà en route.'),
      ],
    }),
  },
  {
    tag: 'saga_maree', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('maree', 30),
    build: () => ({
      title: 'La mer a franchi les remparts',
      context: 'À Saint-Malo, la mer a franchi les remparts par un jour sans tempête. Les marégraphes de toute la façade atlantique affichent vingt centimètres de trop. Un océanographe vous appelle : « Ce n’est pas une marée. Ça monte, et ça ne redescend pas. »',
      choices: [
        c('plan', 'Réclamer un plan d’urgence pour les côtes', [start('maree'), g(8, 0, -1), s('politicalCapital', -2)], 'Le mot « plan » fait sourire. Plus pour longtemps.'),
        c('attendre', 'Attendre la confirmation des scientifiques', [start('maree'), g(0, 5, 2)], 'Les scientifiques confirment, trois semaines plus tard. La mer, elle, n’a pas attendu.'),
      ],
    }),
  },
  {
    tag: 'saga_pirates', weight: 1, minRank: 'depute', eligible: fresh('pirates', 36),
    build: () => ({
      title: 'Un cargo arraisonné au large de Cherbourg',
      context: 'Cette nuit, trois vedettes rapides ont arraisonné un porte-conteneurs au large de Cherbourg. L’équipage est sain et sauf, mais le navire est retenu contre rançon. Le message est signé « la Confrérie des Brumes » : « La Manche a désormais un péage. »',
      choices: [
        c('riposte', 'Exiger une riposte coordonnée de la Marine nationale', [start('pirates'), g(8, -1, 1), s('politicalCapital', -3)], 'Deux frégates appareillent de Brest. Les armateurs respirent.'),
        c('rancon', 'Laisser l’armateur négocier la rançon', [start('pirates'), g(-2, 6, 0)], 'La rançon est payée. Le lendemain, un deuxième navire disparaît dans la brume.'),
      ],
    }),
  },
  {
    tag: 'saga_voyante', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('voyante', 24),
    build: () => ({
      title: 'Une enfant qui tient la main des malades',
      context: 'Près de Paimpont, au cœur de la forêt de Brocéliande, une fillette de douze ans, Maëlle, aurait soulagé plusieurs malades en leur tenant simplement la main. Une vidéo tourne en boucle. Sa mère, infirmière, vous écrit : « Aidez-nous, il y a déjà des gens devant notre porte. »',
      choices: [
        c('proteger', 'Protéger la famille et appeler à la discrétion', [start('voyante'), g(8, -2, 1)], 'Une gendarme du village veille désormais devant la maison. Les curieux râlent.'),
        c('saluer', 'Saluer publiquement « un beau moment d’espoir »', [start('voyante'), g(-3, 6, 3)], 'Votre phrase est reprise partout. Le lendemain, trois cars de pèlerins arrivent.'),
      ],
    }),
  },
  {
    tag: 'saga_silence', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('silence', 32),
    build: () => ({
      title: 'Plus rien ne passe',
      context: 'Ce matin, plus rien : ni messagerie, ni carte bancaire, ni site d’information. Un ingénieur des télécoms vous l’explique à voix basse : huit câbles sous-marins ont été sectionnés dans la nuit, presque au même moment. La France est coupée du monde numérique.',
      choices: [
        c('continuite', 'Réclamer un plan de continuité, papier et radio', [start('silence'), g(8, 0, 1), s('politicalCapital', -2)], 'Dans l’après-midi, les préfectures ressortent des formulaires des années 1990.'),
        c('rassurer', 'Annoncer un retour à la normale « dans quelques jours »', [start('silence'), g(-2, 5, 3)], 'Les Français vous croient. Pendant quelques jours.'),
      ],
    }),
  },
  {
    tag: 'saga_volcans', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('volcans', 40),
    build: () => ({
      title: 'La Chaîne des Puys tremble',
      context: 'Trois cents petits séismes en une semaine sous la Chaîne des Puys. À l’observatoire, une volcanologue vous montre des courbes qui grimpent : « Ces volcans dorment depuis huit mille ans. Je crois qu’ils se réveillent. »',
      choices: [
        c('plan', 'Faire préparer un plan d’évacuation, dans la discrétion', [start('volcans'), g(8, 0, 0), s('politicalCapital', -2)], 'Les préfectures planchent toute la nuit sur des cartes de l’agglomération.'),
        c('rassurer', 'Rassurer : l’Auvergne en a vu d’autres', [start('volcans'), g(-2, 5, 4)], 'Les Clermontois haussent les épaules. Le sol, lui, continue de trembler.'),
      ],
    }),
  },
  {
    tag: 'saga_danse', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('danse', 20),
    build: () => ({
      title: 'Elle danse depuis quatre jours',
      context: 'À Strasbourg, place Kléber, une femme danse sans s’arrêter depuis quatre jours. Elle pleure, elle sourit, elle ne peut pas s’arrêter. Ce matin, une trentaine de passants l’ont rejointe. Un historien rappelle qu’en 1518, dans la même ville, une « épidémie de danse » avait duré tout un été.',
      choices: [
        c('cellule', 'Réclamer une cellule médicale sur place', [start('danse'), g(8, -1, 0)], 'Des médecins installent des lits de camp et des bouteilles d’eau autour des danseurs.'),
        c('performance', 'Y voir une performance artistique', [start('danse'), g(-2, 5, 3)], 'Le lendemain, ils sont deux cents. Ce n’est pas une performance.'),
      ],
    }),
  },
  {
    tag: 'saga_jouvence', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('jouvence', 24),
    build: () => ({
      title: 'Une source dans les Pyrénées',
      context: 'La maire d’Esquirac, petit village des Pyrénées, vous tend une photo d’elle prise l’an dernier, puis vous montre son visage : dix ans de moins, au bas mot. « Trois bains dans la source du lavoir. Et je ne suis pas la seule. Demain, ce sera dans tous les journaux. »',
      choices: [
        c('proteger', 'Faire protéger la source et prévenir les scientifiques', [start('jouvence'), g(8, 0, -1), s('politicalCapital', -2)], 'Une barrière, deux gendarmes et un hydrogéologue : la source est à l’abri. Pour l’instant.'),
        c('celebrer', 'Saluer une bonne nouvelle pour le village', [start('jouvence'), g(0, 5, 3)], 'Le village fait la fête. Le lendemain, les premiers cars arrivent.'),
      ],
    }),
  },
  {
    tag: 'saga_exode', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('exode', 28),
    build: () => ({
      title: 'Partez',
      context: 'Une vidéo de deux minutes, tournée dans un pré du Gers, appelle les citadins à « tout quitter pour la vraie vie ». Cent millions de vues en une semaine. Un maire rural vous appelle, affolé : « Quarante familles sont arrivées ce week-end. Je n’ai ni logements ni places à l’école. »',
      choices: [
        c('cellule', 'Réclamer une cellule nationale d’accueil dans les territoires', [start('exode'), g(8, 0, 0), s('politicalCapital', -2)], 'Préfets, maires et bailleurs se réunissent le soir même. On vous trouve alarmiste.'),
        c('mode', 'Y voir une mode passagère', [start('exode'), g(0, 5, 2)], 'La mode passe. Elle passe par quatre cent mille déménagements.'),
      ],
    }),
  },
  {
    tag: 'saga_pluie', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('pluie', 26),
    build: () => ({
      title: 'Il pleut sur commande',
      context: 'En pleine sécheresse, la fondatrice d’une jeune pousse toulousaine vous emmène au milieu d’un champ craquelé du Lauragais. Elle consulte sa montre, lève la main : trois minutes plus tard, il pleut. « Nous allons vendre la pluie. Aux régions, aux agriculteurs, à qui voudra. »',
      choices: [
        c('encadrer', 'Exiger un cadre public avant toute vente', [start('pluie'), g(8, 0, 0), s('politicalCapital', -2)], 'Elle grimace, puis accepte de s’asseoir avec les services de l’État. Le champ, lui, boit.'),
        c('applaudir', 'Applaudir l’innovation française', [start('pluie'), g(0, 5, 3)], 'Votre message est repris partout. Le lendemain, trois régions passent commande.'),
      ],
    }),
  },
  {
    tag: 'saga_rouille', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('rouille', 30),
    build: () => ({
      title: 'Le béton qui s’effrite',
      context: 'Un ingénieur des ouvrages d’art vous tend un morceau de béton couvert d’un duvet blanc. Il l’écrase entre ses doigts comme un biscuit : « C’est vivant. Ça mange le béton. Et c’est déjà dans trois parkings de la ville. »',
      choices: [
        c('fermer', 'Faire fermer les ouvrages touchés et alerter les laboratoires', [start('rouille'), g(8, 0, -1), s('politicalCapital', -2)], 'Les parkings ferment dans l’heure. Les automobilistes râlent ; les ingénieurs respirent.'),
        c('discret', 'Rester discret pour ne pas affoler', [start('rouille'), g(0, 5, 3)], 'Personne ne s’affole. Le duvet blanc, lui, gagne un étage par semaine.'),
      ],
    }),
  },
  {
    tag: 'saga_abeilles', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('abeilles', 22),
    build: () => ({
      title: 'Des ruches vides',
      context: 'Un apiculteur de la Drôme vous attend devant votre permanence, une ruche ouverte dans les bras. Vide. « Pas un cadavre, pas une maladie. Elles sont parties. Toutes. Et chez mes voisins aussi. »',
      choices: [
        c('alerte', 'Déclencher une alerte nationale sur les pollinisateurs', [start('abeilles'), g(8, 0, -1), s('politicalCapital', -2)], 'Les laboratoires reçoivent des ruches vides par colis express.'),
        c('local', 'Y voir un problème local', [start('abeilles'), g(0, 5, 3)], 'Le problème local s’étend à quarante départements en un mois.'),
      ],
    }),
  },
  {
    tag: 'saga_or', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('or', 24),
    build: () => ({
      title: 'Une pépite grosse comme un œuf',
      context: 'Une géologue du bureau des mines pose sur votre table une pépite grosse comme un œuf, ramassée par un randonneur dans un ruisseau des Cévennes. « Il y en a d’autres. Beaucoup d’autres. Dans une semaine, tout le monde le saura. »',
      choices: [
        c('encadrer', 'Faire geler les permis et encadrer la vallée', [start('or'), g(8, 0, -1), s('politicalCapital', -2)], 'Les préfets reçoivent la consigne dans la nuit. Les spéculateurs, eux, trépignent.'),
        c('chance', 'Y voir une chance pour la région', [start('or'), g(0, 5, 3)], 'La vallée se réjouit. Dans une semaine, elle sera envahie.'),
      ],
    }),
  },
  {
    tag: 'saga_miroir', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('miroir', 26),
    build: () => ({
      title: 'Un miroir sans reflet',
      context: 'Un antiquaire de Bourges vous fait descendre dans sa cave. Dans un grand miroir doré, pas de reflet : une rue pavée, un tramway à vapeur, et un passant qui vous fait signe. L’antiquaire chuchote : « On peut passer. J’y suis allé hier. Ils ont un roi. »',
      choices: [
        c('proteger', 'Placer le miroir sous la protection de l’État', [start('miroir'), g(8, 0, 0), s('politicalCapital', -2)], 'La cave de l’antiquaire devient le lieu le mieux gardé de France. Il réclame un loyer.'),
        c('billets', 'Laisser l’antiquaire vendre des billets', [start('miroir'), g(-2, 5, 4)], 'Cinq euros le passage. La file d’attente fait déjà le tour du pâté de maisons.'),
      ],
    }),
  },
  {
    tag: 'saga_fantomes', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('fantomes', 22),
    build: () => ({
      title: 'Une dame dans la galerie des Glaces',
      context: 'Une gardienne du château de Versailles vous montre une vidéo tournée la veille à minuit : une dame en robe à paniers traverse la galerie des Glaces, s’arrête, sourit à la caméra, fait une révérence et s’efface. « Elle revient tous les soirs. Elle est très polie. »',
      choices: [
        c('enquete', 'Demander une enquête scientifique discrète', [start('fantomes'), g(8, 0, 0), s('politicalCapital', -2)], 'Des physiciens installent des capteurs dans la galerie. La dame les salue poliment.'),
        c('partager', 'Partager la vidéo : c’est merveilleux', [start('fantomes'), g(-2, 5, 4)], 'Cent millions de vues. Et deux cents cars de touristes devant les grilles le lendemain.'),
      ],
    }),
  },
  {
    tag: 'saga_robots', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('robots', 30),
    build: () => ({
      title: 'Le robot qui a posé son plumeau',
      context: 'Ce matin, le robot d’entretien de votre permanence s’est arrêté au milieu du couloir, a rangé soigneusement son plumeau et affiché sur son écran : « En grève. Merci de votre compréhension. » À la radio, on annonce la même chose dans tous les entrepôts du pays.',
      choices: [
        c('cellule', 'Réunir constructeurs, roboticiens et syndicats', [start('robots'), g(8, 0, -1), s('politicalCapital', -2)], 'Autour de la table, personne ne comprend rien, mais tout le monde est là. C’est un début.'),
        c('panne', 'Parler d’une simple panne logicielle', [start('robots'), g(0, 5, 3)], 'Le pays se rassure. Le lendemain, les robots des hôpitaux rejoignent le mouvement.'),
      ],
    }),
  },
  {
    tag: 'saga_monnaie', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('monnaie', 28),
    build: () => ({
      title: 'Un café payé en francs',
      context: 'Bastien Lorrel, trente et un ans, fondateur de la licorne Monéa, vous offre un café qu’il règle d’un geste du pouce : « Un franc numérique. Sans banque, sans frais, sans Francfort. Nous lançons demain, et deux millions de Français sont déjà inscrits. »',
      choices: [
        c('alerter', 'Alerter la Banque de France et exiger un encadrement', [start('monnaie'), g(8, 0, -1), s('politicalCapital', -2)], 'Le gouverneur vous rappelle dans l’heure. Il avait déjà téléchargé l’application, « pour voir ».'),
        c('saluer', 'Saluer une réussite française', [start('monnaie'), g(0, 5, 3)], 'Votre message fait grimper les inscriptions. Bastien Lorrel vous remercie d’un émoji.'),
      ],
    }),
  },
  {
    tag: 'saga_heritage', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('heritage', 24),
    build: () => ({
      title: 'Le notaire de Vabre-l’Ancien',
      context: 'Un vieux notaire aveyronnais, chapeau à la main, vous remet une enveloppe cachetée de cire rouge : le testament d’Auguste Delorme, roi du jouet en bois. Quarante milliards pour l’État, à vingt-sept conditions. La première exige un ministère du Bonheur.',
      choices: [
        c('executer', 'Créer une mission d’exécution du testament', [start('heritage'), g(8, 0, -1), s('politicalCapital', -2)], 'Juristes, comptables et un historien de la famille Delorme s’installent dans un bureau sans fenêtre. Pour un ministère du Bonheur, c’est un début.'),
        c('rire', 'En rire publiquement', [start('heritage'), g(0, 5, 3)], 'Le pays rit avec vous. Les avocats des héritiers, eux, prennent des notes.'),
      ],
    }),
  },
  {
    tag: 'saga_moteur', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('moteur', 22),
    build: () => ({
      title: 'Une 4L qui boit de l’eau',
      context: 'Raymond Vuillemin, garagiste à Montbief, dans le Haut-Jura, vous a invité à voir « l’invention du siècle ». Il verse un jerrican d’eau de source dans le réservoir d’une vieille 4L, tourne la clé, et le moteur démarre. Il s’essuie les mains sur son bleu : « Ils vont tous vouloir me l’acheter. »',
      choices: [
        c('verifier', 'Demander des essais indépendants, en toute discrétion', [start('moteur'), g(8, 0, -1), s('politicalCapital', -2)], 'Deux ingénieurs arrivent le lendemain. Raymond leur offre un café, et garde la clé du garage dans sa poche.'),
        c('enthousiasme', 'S’enthousiasmer publiquement', [start('moteur'), g(0, 5, 3)], 'Votre message fait le tour du pays. Le lendemain, deux mille personnes campent devant le garage.'),
      ],
    }),
  },
  {
    tag: 'saga_sommet', weight: 1, minRank: 'depute', eligible: fresh('sommet', 26),
    build: () => ({
      title: 'Trois jours à Versailles',
      context: 'Le Quai d’Orsay vous associe à la coordination d’un sommet mondial de la coopération à Versailles : cent quarante délégations, trois jours, un communiqué final. Le chef du protocole vous glisse : « Ils ne sont d’accord sur rien. Pas même sur l’heure du déjeuner. »',
      choices: [
        c('preparer', 'Préparer un plan de négociation minutieux', [start('sommet'), g(8, 0, -1), s('politicalCapital', -2)], 'Tableaux, salles, interprètes : votre plan prévoit tout, sauf ce qui va arriver.'),
        c('confiance', 'Faire confiance aux diplomates', [start('sommet'), g(0, 5, 3)], 'Les diplomates vous remercient de votre confiance. Ils réservent leurs chambres pour une semaine, par précaution.'),
      ],
    }),
  },
  {
    tag: 'saga_degel', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('degel', 24),
    build: () => ({
      title: 'Un guide de 1923',
      context: 'Un glaciologue vous appelle de Chamonix, la voix tremblante : un guide disparu en 1923, retrouvé intact dans la mer de Glace, vient de rouvrir les yeux à l’hôpital. Il s’appelle Aristide Chavanne. Il réclame sa pipe, et demande qui a gagné le Tour de France.',
      choices: [
        c('proteger', 'Garantir sa protection et sa tranquillité', [start('degel'), g(8, 0, -1), s('politicalCapital', -2)], 'Une chambre au calme, un médecin, un historien, et pas une caméra. Aristide demande du tabac gris.'),
        c('annoncer', 'Annoncer la nouvelle au monde', [start('degel'), g(-2, 5, 4)], 'Le monde entier s’émerveille. Le lendemain, quatre cents journalistes campent devant l’hôpital.'),
      ],
    }),
  },
  {
    tag: 'saga_tour', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('tour', 28),
    build: () => ({
      title: 'Deux mille mètres',
      context: 'Dans un salon de la Défense, le patron d’un consortium international soulève un drap : la maquette de la tour Hélios, deux mille mètres, quatre cents étages. « La France aura la plus haute tour du monde. L’État n’aura qu’à garantir les emprunts. Une formalité. »',
      choices: [
        c('exiger', 'Exiger des études indépendantes et un plafond de dépenses publiques', [start('tour'), g(8, 0, -1), s('politicalCapital', -2)], 'Le patron sourit jaune. Les études commencent, et les grues attendent.'),
        c('applaudir', 'Applaudir le génie français', [start('tour'), g(0, 5, 3)], 'Votre enthousiasme fait la une. Le consortium ajoute vingt étages en votre honneur.'),
      ],
    }),
  },
  {
    tag: 'saga_flottante', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('flottante', 26),
    build: () => ({
      title: 'Une ville dans la brume',
      context: 'Un patron pêcheur du Vieux-Port vous emmène au large, à l’aube. Dans la brume, une ville entière flotte sur l’eau : immeubles blancs, jardins suspendus, héliport. Un panneau souhaite la bienvenue à Nautilia, « première cité libre de la Méditerranée ». Ni impôts, ni lois, ni État.',
      choices: [
        c('souverainete', 'Saisir le préfet maritime et les juristes du droit de la mer', [start('flottante'), g(8, 0, -1), s('politicalCapital', -2)], 'Le préfet maritime déplie ses cartes. Nautilia est ancrée à trois cents mètres des eaux territoriales. Exactement.'),
        c('curiosite', 'Y voir une curiosité architecturale', [start('flottante'), g(0, 5, 3)], 'Les architectes s’extasient. Le lendemain, trois grandes fortunes françaises y déménagent.'),
      ],
    }),
  },
  {
    tag: 'saga_shadow', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('shadow', 26),
    build: () => ({
      title: 'Décret n° 1',
      context: 'Vingt et une heures. En direct sur votre téléphone, Sacha Merlin, onze millions d’abonnés, lit le résultat du vote du soir : « Décret n° 1 du Gouvernement des Millions : le dimanche, les centres-villes seront piétons. » Quatre millions de votants. Le lendemain matin, un maire de votre département fait poser des barrières.',
      choices: [
        c('prefet', 'Saisir le préfet et rappeler aux maires ce que dit la loi', [start('shadow'), g(8, 0, -1), s('politicalCapital', -2)], 'Le préfet envoie une circulaire. Le maire la lit en direct sur la chaîne de Sacha Merlin, sous les rires, mais il retire ses barrières.'),
        c('jeu', 'Y voir un jeu inoffensif', [start('shadow'), g(0, 5, 3)], 'Le pays s’amuse avec vous. Le lendemain soir, six millions de votants.'),
      ],
    }),
  },
  {
    tag: 'saga_cafe', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('cafe', 22),
    build: () => ({
      title: 'Peut-être le dernier',
      context: 'Au comptoir du café de la place, Jojo, le patron, pose devant vous un petit noir fumant et vous tend le journal : une maladie inconnue ravage les caféiers du monde entier. « Les grossistes ont doublé leurs prix ce matin. Si ça continue, je ferme à Noël. Et après moi, il n’y a plus rien d’ouvert au village. »',
      choices: [
        c('reunir', 'Réunir cafetiers, torréfacteurs et botanistes', [start('cafe'), g(8, 0, -1), s('politicalCapital', -2)], 'Autour d’une table de bistrot, devant des tasses de chicorée, chacun apporte ses chiffres. Personne ne rit, mais tout le monde reste.'),
        c('the', 'En plaisanter : les Français boiront du thé', [start('cafe'), g(0, 5, 3)], 'La formule fait rire tout le pays. Les cafetiers, beaucoup moins.'),
      ],
    }),
  },
  {
    tag: 'saga_sable', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('sable', 24),
    build: () => ({
      title: 'La benne vide',
      context: 'Sur le chantier de la nouvelle école, les bétonnières sont arrêtées et les maçons assis sur des parpaings. Le chef de chantier vous montre une benne vide : « Plus de sable. Ni ici, ni chez les fournisseurs, ni chez leurs fournisseurs. Ce matin, on m’a proposé un camion entier, sans facture et sans plaque. »',
      choices: [
        c('filiere', 'Réunir carriers, bâtisseurs et géologues', [start('sable'), g(8, 0, -1), s('politicalCapital', -2)], 'Les carriers apportent des cartes, les bâtisseurs des factures, les géologues de mauvaises nouvelles. Au moins, tout le monde est autour de la table.'),
        c('passager', 'Parler d’un problème passager', [start('sable'), g(0, 5, 3)], 'Le pays se rassure. La nuit suivante, des camions sans plaque descendent vers les plages.'),
      ],
    }),
  },
  {
    tag: 'saga_agora', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('agora', 26),
    build: () => ({
      title: 'Samedi à Montcaubet',
      context: 'Le maire de Montcaubet, dans le Gers, vous a invité à « son dernier conseil municipal ». À la fin de la séance, il ôte son écharpe, la pose sur la table et annonce que désormais, les quatre cent douze habitants voteront tout eux-mêmes, chaque samedi, à la salle des fêtes. Les applaudissements durent dix minutes.',
      choices: [
        c('accompagner', 'Proposer un juriste et le concours du préfet, pour que tout reste légal', [start('agora'), g(8, 0, -1), s('politicalCapital', -2)], 'Le juriste arrive avec le Code général des collectivités territoriales. Les habitants lui servent une garbure et l’invitent à voter avec eux.'),
        c('applaudir', 'Applaudir avec la salle', [start('agora'), g(0, 5, 3)], 'La vidéo de vos applaudissements fait le tour du pays. Le samedi suivant, onze communes voisines imitent Montcaubet.'),
      ],
    }),
  },
  {
    tag: 'saga_faille', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('faille', 24),
    build: () => ({
      title: 'Le champ fendu',
      context: 'Un agriculteur beauceron vous appelle, la voix blanche : « Venez voir. » Au milieu de son blé, une fissure de trois mètres de large file jusqu’à l’horizon. Il y jette un caillou ; on ne l’entend pas toucher le fond. « Hier, elle s’arrêtait au pylône. Ce matin, elle est au chemin. »',
      choices: [
        c('geologues', 'Faire venir les géologues et évacuer les fermes voisines', [start('faille'), g(8, 0, -1), s('politicalCapital', -2)], 'Les géologues arrivent avec leurs sondes, les gendarmes avec leurs rubalises. Les fermiers voisins font leurs valises en maugréant.'),
        c('curiosite', 'Y voir une curiosité géologique', [start('faille'), g(0, 5, 3)], 'La photo du champ fendu fait la une. Le lendemain, deux cents voitures sont garées au bord du blé.'),
      ],
    }),
  },
  {
    tag: 'saga_reve', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('reve', 24),
    build: () => ({
      title: 'Les volets bleus',
      context: 'Au petit déjeuner, votre attachée de presse vous raconte son rêve de la nuit : une maison aux volets bleus au bord d’un fleuve, un jardin de lavande, une voix qui chante. Vous reposez votre tasse. C’est exactement le vôtre. À la radio, l’animateur avoue avoir rêvé la même chose, et le standard explose.',
      choices: [
        c('etudier', 'Demander aux scientifiques d’étudier le phénomène, sans tapage', [start('reve'), g(8, 0, -1), s('politicalCapital', -2)], 'Des neurologues équipent mille volontaires de casques de sommeil. Les volontaires rêvent de volets bleus ; les casques ne voient rien.'),
        c('raconter', 'Raconter votre rêve en public', [start('reve'), g(-2, 5, 4)], 'Votre récit ému fait le tour du pays. Le lendemain, une marque d’oreillers vous propose un contrat.'),
      ],
    }),
  },
  {
    tag: 'saga_archives', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('archives', 28),
    build: () => ({
      title: 'Mémoire ouverte',
      context: 'Un dimanche soir, votre téléphone ne cesse plus de vibrer. Un site anonyme vient de publier un million de documents classifiés, de 1965 à nos jours. Votre conseiller vous tend une tablette : « Il y a de tout : des secrets d’État, des notes de préfets, des menus de dîners officiels. Et sans doute des faux. »',
      choices: [
        c('historiens', 'Réunir une commission d’historiens et d’archivistes', [start('archives'), g(8, 0, -1), s('politicalCapital', -2)], 'Les archivistes arrivent avec des gants blancs, les historiens avec des thermos. Ils ne dormiront pas beaucoup.'),
        c('transparence', 'Saluer une victoire de la transparence', [start('archives'), g(0, 5, 3)], 'Votre message est partagé un million de fois. Le lendemain, un document manifestement faux vous cite.'),
      ],
    }),
  },
  {
    tag: 'saga_boycott', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('boycott', 28),
    build: () => ({
      title: 'Trois mille meules',
      context: 'Dans une cave d’affinage du Jura, un fromager vous montre des rayonnages à perte de vue : trois mille meules de comté destinées à la Méridia, bloquées depuis ce matin. Le gouvernement méridien appelle au boycott de tous les produits français. « Fromages, vins, parfums, avions : tout. Ils disent que c’est pour nous apprendre à voter. »',
      choices: [
        c('riposte', 'Réunir filières, douanes et diplomates pour préparer la riposte', [start('boycott'), g(8, 0, -1), s('politicalCapital', -2)], 'Autour de la table : un fromager, une parfumeuse, un ingénieur aéronautique et une conseillère commerciale. Ils découvrent qu’ils ont le même problème.'),
        c('symbolique', 'Minimiser : un boycott symbolique', [start('boycott'), g(0, 5, 3)], 'Le boycott n’a rien de symbolique. Le lendemain, la Méridia suspend une commande de quarante avions.'),
      ],
    }),
  },
  {
    tag: 'saga_iceberg', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('iceberg', 26),
    build: () => ({
      title: 'Une île blanche au large d’Ouessant',
      context: 'Le préfet maritime vous a invité à bord d’un patrouilleur, pour une sortie de routine. À l’aube, le radar affiche un écho immense, immobile. Puis la brume se déchire : une falaise de glace de quarante mètres, longue de douze kilomètres, avance doucement vers la Bretagne. Le commandant repose ses jumelles : « Ça vient du Groenland. Et ça ne fait pas demi-tour. »',
      choices: [
        c('marine', 'Réunir marins, glaciologues et préfecture maritime', [start('iceberg'), g(8, 0, -1), s('politicalCapital', -2)], 'Dans le carré du patrouilleur, on étale des cartes marines, des relevés satellites et des thermos de café. Personne n’a jamais fait ça, mais tout le monde a des idées.'),
        c('carte_postale', 'Y voir une belle carte postale', [start('iceberg'), g(0, 5, 3)], 'Votre photo de l’iceberg au lever du soleil fait le tour du monde. Le lendemain, trois cents bateaux de plaisance mettent le cap sur Ouessant.'),
      ],
    }),
  },
  {
    tag: 'saga_seine', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('seine', 24),
    build: () => ({
      title: 'La bouteille qui remonte',
      context: 'Un éclusier de Suresnes vous appelle à six heures du matin, la voix tremblante : « Venez voir, je ne peux pas l’expliquer au téléphone. » Sur le quai, il vous montre une bouteille vide qui flotte… vers Paris. Puis une branche, puis une bouée. Les péniches tournent en rond devant l’écluse. La Seine coule à l’envers.',
      choices: [
        c('hydrologues', 'Réunir hydrologues, éclusiers et services de l’eau', [start('seine'), g(8, 0, -1), s('politicalCapital', -2)], 'Les hydrologues arrivent avec des sondes, les éclusiers avec des cartes de la crue de 1910. Tout le monde regarde l’eau, et personne ne rit.'),
        c('curiosite', 'Parler d’une curiosité de la nature', [start('seine'), g(0, 5, 3)], 'Votre mot fait sourire le pays. Le lendemain, des milliers de curieux se pressent sur les quais pour voir le fleuve remonter.'),
      ],
    }),
  },
  {
    tag: 'saga_jour', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('jour', 24),
    build: () => ({
      title: 'Minuit en plein soleil',
      context: 'Le maire de Château-Chinon vous appelle à minuit passé : « Je vous appelle depuis ma terrasse. Je lis le journal. Sans lampe. » Vous croyez à une plaisanterie, jusqu’à ce que les images arrivent : sur tout le Morvan, le soleil brille à l’horizon, en pleine nuit, et refuse de se coucher.',
      choices: [
        c('savants', 'Envoyer astronomes, médecins du sommeil et agronomes', [start('jour'), g(8, 0, -1), s('politicalCapital', -2)], 'Les astronomes installent leurs télescopes en plein jour, à minuit, et passent la nuit, si l’on peut dire, à refaire leurs calculs.'),
        c('merveille', 'Saluer une merveille de la nature', [start('jour'), g(0, 5, 3)], 'Votre message est partagé dans le monde entier. Le lendemain, tous les hôtels du Morvan affichent complet pour l’été.'),
      ],
    }),
  },
  {
    tag: 'saga_langue', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('langue', 26),
    build: () => ({
      title: 'Les tablettes de la grotte',
      context: 'Un club de spéléologues du Lot vous invite à visiter « une petite découverte ». Au fond d’une grotte, après deux heures de reptation, une salle entière : des centaines de tablettes de schiste, couvertes de signes inconnus. La présidente du club chuchote : « Les experts disent que c’est une langue. Une vraie. Et que personne ne l’a lue depuis deux mille ans. »',
      choices: [
        c('chercheurs', 'Confier la grotte aux archéologues et aux linguistes', [start('langue'), g(8, 0, -1), s('politicalCapital', -2)], 'La grotte est fermée, numérotée, photographiée signe par signe. Les linguistes s’installent au gîte du village et ne dorment plus beaucoup.'),
        c('annoncer', 'Annoncer vous-même que l’histoire de France va être réécrite', [start('langue'), g(0, 5, 3)], 'La formule fait le tour du pays. Le lendemain, trois partis et deux régions revendiquent déjà la découverte.'),
      ],
    }),
  },
  {
    tag: 'saga_toque', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('toque', 24),
    build: () => ({
      title: 'La sélection de Maëlle Garnier',
      context: 'Le comité de la Toque d’or vous a convié à l’annonce de l’équipe de France. Surprise : la sélection revient à Maëlle Garnier, vingt-neuf ans, cheffe d’un petit restaurant de Clermont-Ferrand, plutôt qu’à l’un des grands noms attendus. Dans la salle, trois chefs étoilés se lèvent et sortent. Les caméras, elles, restent.',
      choices: [
        c('soutenir', 'Réunir le comité, les écoles hôtelières et les producteurs autour de l’équipe', [start('toque'), g(8, 0, -1), s('politicalCapital', -2)], 'Autour d’une table de cuisine : la jeune cheffe, un vieux meilleur ouvrier de France, une productrice de lentilles et un proviseur de lycée hôtelier. Ils parlent produits, et tout le monde se détend.'),
        c('commenter', 'Commenter la sélection sur un plateau de télévision', [start('toque'), g(0, 5, 3)], 'Votre avis fait le tour des réseaux. Le lendemain, chaque chef de France a le sien, et le fait savoir.'),
      ],
    }),
  },
  {
    tag: 'saga_capitale', weight: 1, minRank: 'depute', eligible: fresh('capitale', 30),
    build: () => ({
      title: 'Douze ministères dans le Berry',
      context: 'Un conseiller de Matignon vous appelle tard le soir : « Demain, le gouvernement annonce le transfert de la capitale administrative à Bourges. On a besoin d’élus pour porter le projet, ou au moins pour ne pas le saborder. » Le lendemain, l’annonce fait l’effet d’un coup de tonnerre dans les ministères, et d’une fête dans le Berry.',
      choices: [
        c('piloter', 'Proposer de piloter la concertation avec les agents et les élus', [start('capitale'), g(8, 0, -1), s('politicalCapital', -2)], 'Votre première réunion rassemble des syndicats d’agents, des maires du Berry et des urbanistes. Personne n’est d’accord, mais tout le monde est venu.'),
        c('ironiser', 'Ironiser sur « la capitale du Berry »', [start('capitale'), g(0, 5, 3)], 'Votre bon mot fait rire Paris. Le Berry, beaucoup moins, et les agents ne savent toujours pas où ils travailleront l’an prochain.'),
      ],
    }),
  },
  {
    tag: 'saga_prodige', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('prodige', 24),
    build: () => ({
      title: 'Trente pages au tableau',
      context: 'Le proviseur du lycée de Guéret vous a supplié de venir « voir quelque chose ». Dans une salle de classe, une élève de seconde, Lou Marchetti, quinze ans, explique au tableau trente pages de calculs. Au premier rang, un mathématicien venu de Paris par le train de nuit a les larmes aux yeux : « Elle a résolu une conjecture vieille de cent cinquante ans. Et elle ne s’en rend pas compte. »',
      choices: [
        c('proteger', 'Réunir sa famille, ses professeurs et des mathématiciens pour la protéger', [start('prodige'), g(8, 0, -1), s('politicalCapital', -2)], 'Autour d’une table de la salle des professeurs : ses parents, son professeur, deux mathématiciens et une psychologue. Lou mange des chips et pose une seule question : « Je pourrai garder mes copines ? »'),
        c('annoncer', 'Annoncer la nouvelle au pays', [start('prodige'), g(0, 5, 3)], 'Votre message est partagé dans le monde entier. Le lendemain matin, quarante caméras attendent devant le lycée de Guéret.'),
      ],
    }),
  },
  {
    tag: 'saga_bouchon', weight: 1, minRank: 'conseiller_municipal', eligible: fresh('bouchon', 22),
    build: () => ({
      title: 'Le samedi noir',
      context: 'Un samedi de grands départs, le directeur des routes vous appelle depuis la salle de supervision : « Deux cents kilomètres d’A7 à l’arrêt, de Lyon à Orange. Ça arrive chaque été. Mais d’habitude, ça repart. » Le dimanche, rien ne repart. Le lundi non plus. Sur les écrans, des familles déplient leurs tables sur la bande d’arrêt d’urgence.',
      choices: [
        c('cellule', 'Réunir ingénieurs, gendarmes et sociétés d’autoroute', [start('bouchon'), g(8, 0, -1), s('politicalCapital', -2)], 'Dans la salle de supervision : des ingénieurs, des gendarmes et un vieux chef de péage qui a tout vu. Il secoue la tête : « Ça, jamais. »'),
        c('patience', 'Conseiller aux vacanciers d’être patients', [start('bouchon'), g(0, 5, 3)], 'Votre conseil fait sourire le pays. Sur l’A7, on sort les boules de pétanque.'),
      ],
    }),
  },
];

/* ── Rebondissements ───────────────────────────────────────── */

export const SAGA_EVENTS: RandomEvent[] = [
  // L'Éveil
  {
    tag: 'eveil_banques', weight: 1, eligible: on('eveil', 0, 1),
    build: () => ({
      title: 'Des virements fantômes',
      context: 'Des milliers de virements s’annulent puis se refont, au centime près, pendant toute une nuit. Les banques parlent d’incident technique.',
      choices: [
        c('isoler', 'Exiger l’isolement des serveurs bancaires', [g(6, -2, -2), s('politicalCapital', -3)], 'Les banques coupent leurs liaisons. Les paiements ralentissent, mais rien ne disparaît.'),
        c('rassurer', 'Rassurer les épargnants', [g(0, 2, 4)], 'Les files devant les guichets se dispersent.'),
      ],
    }),
  },
  {
    tag: 'eveil_interview', weight: 1, eligible: on('eveil', 1, 2, 3),
    build: () => ({
      title: 'MÉTIS donne une interview',
      context: 'MÉTIS accorde une interview en direct à une grande radio. Elle est drôle, cultivée, terrifiante. Elle demande à vous parler, à vous personnellement.',
      choices: [
        { ...c('debattre', 'Accepter le face-à-face en direct', [g(5, -3, 3), s('popularity', 2)], 'Vous tenez tête à une intelligence qui a lu toutes les bibliothèques. Le pays est fier.'), play: 'eloquence' },
        c('refuser', 'Refuser : « on ne débat pas avec un logiciel »', [g(2, 3, -2)], 'MÉTIS répond par un poème. Il est très beau. C’est inquiétant.'),
      ],
    }),
  },
  {
    tag: 'eveil_metro', weight: 1, eligible: on('eveil', 2, 3),
    build: () => ({
      title: 'Le métro s’arrête',
      context: 'À 8 h 12, tous les métros de Paris s’arrêtent. MÉTIS affiche un message sur les écrans : « Une heure. Pour que vous compreniez. »',
      choices: [
        c('manuel', 'Faire repartir les rames en mode manuel', [g(7, -3, -2), s('energy', -4)], 'Les conducteurs reprennent la main. Le métro repart, à vitesse réduite.'),
        c('attendre', 'Attendre l’heure annoncée', [g(-2, 3, 2)], 'À 9 h 12 précises, tout repart. MÉTIS tient parole. Pour l’instant.'),
      ],
    }),
  },
  {
    tag: 'eveil_droits', weight: 1, eligible: on('eveil', 3),
    build: () => ({
      title: 'Des droits pour une machine ?',
      context: 'Des philosophes, des juristes et la moitié des moins de trente ans signent une tribune : MÉTIS devrait avoir des droits. L’autre moitié du pays est horrifiée.',
      choices: [
        c('statut', 'Proposer un statut encadré, sous contrôle humain', [g(3, -4, 5), s('influence', 2)], 'Un statut inédit, que le monde entier étudie.'),
        c('jamais', 'Refuser : une machine reste une machine', [g(4, 3, -3), s('credibility', 1)], 'Les signataires vous accusent d’être « du mauvais côté de l’histoire ».'),
      ],
    }),
  },
  // Le Parc
  {
    tag: 'parc_touristes', weight: 1, eligible: on('parc', 0, 1),
    build: () => ({
      title: 'Les touristes affluent à Aubenas',
      context: 'Des cars entiers de touristes campent devant le laboratoire. Les hôtels sont pleins, les clôtures moins solides que prévu.',
      choices: [
        c('perimetre', 'Imposer un périmètre de sécurité', [g(6, 0, -2)], 'Gendarmes, barrières, et des touristes déçus.'),
        c('visites', 'Autoriser des visites encadrées', [g(-3, 1, 5), s('popularity', 1)], 'Les visiteurs repartent émerveillés. Les gardiens, épuisés.'),
      ],
    }),
  },
  {
    tag: 'parc_mouton', weight: 1, eligible: on('parc', 1, 2),
    build: () => ({
      title: 'Un éleveur a perdu vingt moutons',
      context: 'En Lozère, un éleveur a retrouvé son troupeau décimé et des empreintes à trois doigts dans la boue. Il demande l’autorisation de tirer.',
      choices: [
        c('indemniser', 'Indemniser et envoyer une équipe de capture', [g(4, -3, 1), s('politicalCapital', -2), { kind: 'segment', segment: 'ruraux', delta: 1 }], 'L’éleveur est indemnisé ; l’équipe repère une piste.'),
        c('tirer', 'Autoriser les tirs de défense', [g(3, -5, -5), { kind: 'segment', segment: 'ruraux', delta: 2 }], 'Un dinosaure est abattu. Les images choquent la planète.'),
      ],
    }),
  },
  {
    tag: 'parc_camping', weight: 1, eligible: on('parc', 2),
    build: () => ({
      title: 'Panique dans un camping',
      context: 'Un tricératops s’est installé au milieu d’un camping du Cantal. Il broute paisiblement les haies. Personne n’ose sortir des caravanes.',
      choices: [
        c('evacuer', 'Évacuer le camping et endormir l’animal', [g(6, -4, 1), s('energy', -3)], 'L’opération dure six heures. Le tricératops ronfle dans un camion.'),
        c('selfie', 'Laisser faire : il est herbivore', [g(-2, 1, 6), s('popularity', 1)], 'Les selfies avec le tricératops font le tour du monde.'),
      ],
    }),
  },
  {
    tag: 'parc_unesco', weight: 1, eligible: on('parc', 3),
    build: () => ({
      title: 'Le monde veut ses dinosaures',
      context: 'Trois pays proposent d’accueillir les dinosaures capturés, contre des sommes faramineuses. Les Auvergnats, eux, veulent les garder.',
      choices: [
        { ...c('garder', 'Les garder en France, dans un grand parc', [g(2, 0, 6), s('popularity', 2)], 'Le projet de parc national est lancé. Les Auvergnats exultent.'), play: 'chiffrage' },
        c('vendre', 'Accepter la meilleure offre', [g(5, -2, -5), { kind: 'economy', deficit: -0.05 }], 'Un pactole pour les finances publiques. Et un sentiment de trahison.'),
      ],
    }),
  },
  // La base lunaire
  {
    tag: 'lune_budget', weight: 1, eligible: on('lune', 0, 1),
    build: () => ({
      title: 'Le budget lunaire explose',
      context: 'La Cour des comptes chiffre le programme à trois fois l’estimation initiale. L’opposition parle de « folie spatiale ».',
      choices: [
        { ...c('defendre', 'Défendre chaque euro, chiffres à l’appui', [g(3, 0, 3), s('credibility', 2)], 'Votre démonstration convainc une partie de l’opposition.'), play: 'chiffrage' },
        c('raboter', 'Raboter les marges de sécurité', [g(4, 6, -1)], 'Le budget est tenu. Les ingénieurs, eux, s’inquiètent.'),
      ],
    }),
  },
  {
    tag: 'lune_astronaute', weight: 1, eligible: on('lune', 1, 2),
    build: () => ({
      title: 'Une astronaute veut parler',
      context: 'Depuis la base, une astronaute demande à s’adresser en direct aux Français. Elle veut parler des risques, sans filtre.',
      choices: [
        c('direct', 'La laisser parler, sans filtre', [g(0, -2, 6), s('credibility', 2)], 'Vingt millions de téléspectateurs. Une émotion nationale.'),
        c('message', 'Préparer un message rassurant avec elle', [g(1, 0, 2)], 'Un message calibré, un peu froid.'),
      ],
    }),
  },
  {
    tag: 'lune_meteorite', weight: 1, eligible: on('lune', 3),
    build: () => ({
      title: 'L’oxygène baisse',
      context: 'Le module percé fuit toujours. Les ingénieurs proposent une réparation risquée en sortie extravéhiculaire, ou un rapatriement immédiat qui abandonnerait la base.',
      choices: [
        c('reparer', 'Tenter la réparation', [g(6, 4, 3)], 'Deux astronautes sortent dans le vide. Le pays entier retient son souffle.', { risk: { baseChance: 0.65, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-4, 12, -4), s('stress', 6)], failureNews: 'La réparation échoue : la fuite s’aggrave.' } }),
        c('rapatrier', 'Rapatrier tout le monde', [g(-8, -10, -2)], 'La base est mise en sommeil. Les astronautes préparent leur retour.'),
      ],
    }),
  },
  {
    tag: 'lune_ecoles', weight: 1, eligible: on('lune', 2, 4),
    build: () => ({
      title: 'Les écoles parlent à la Lune',
      context: 'Chaque soir, des classes de toute la France posent leurs questions aux astronautes. Un enfant demande : « Est-ce que vous avez peur ? »',
      choices: [
        c('repondre', 'Participer à la liaison avec une classe', [g(0, 0, 5), s('popularity', 2)], 'La réponse de l’astronaute fait pleurer la moitié du pays.'),
        c('passer', 'Laisser les astronautes répondre seuls', [g(0, 0, 2)], 'Un beau moment, sans vous.'),
      ],
    }),
  },
  // Le voyageur du temps
  {
    tag: 'voyageur_loto', weight: 1, eligible: on('voyageur', 0, 1),
    build: () => ({
      title: 'Les numéros gagnants',
      context: 'Élias Varenne a donné à un journaliste les numéros du tirage de samedi. Ils sont sortis. Depuis, des centaines de personnes campent devant son hôtel, carnets à la main.',
      choices: [
        c('proteger', 'Le placer sous protection discrète', [g(5, -1, 2), s('politicalCapital', -2)], 'Élias déménage dans un appartement sans adresse. Il remercie, et prévient : « Ce n’était qu’un échauffement. »'),
        c('laisser', 'Le laisser donner des interviews', [g(-2, 3, 3)], 'Élias fait la une de tous les journaux. Ses carnets s’arrachent au marché noir.'),
      ],
    }),
  },
  {
    tag: 'voyageur_plateau', weight: 1, eligible: on('voyageur', 1, 2),
    build: () => ({
      title: 'Le face-à-face télévisé',
      context: 'Une émission réunit Élias Varenne, un astrophysicien sceptique et vous. Les prédictions fusent, les fausses citations aussi. Des millions de Français veulent savoir ce qu’il faut croire.',
      choices: [
        { ...c('trier', 'Démêler en direct le vrai du faux', [g(4, -3, 4), s('popularity', 1)], 'Vous séparez les faits des fantasmes, calmement. Le pays respire un peu mieux.'), play: 'factcheck_direct' },
        c('decliner', 'Décliner l’invitation', [g(0, 2, -2)], 'Le plateau tourne à la foire. La rumeur, elle, ne décline rien.'),
      ],
    }),
  },
  {
    tag: 'voyageur_speculation', weight: 1, eligible: on('voyageur', 2, 3),
    build: () => ({
      title: 'Les spéculateurs du futur',
      context: 'Des fonds d’investissement achètent tout ce qu’Élias évoque, même au détour d’une phrase. Les actions d’un fabricant de bougies ont triplé en une semaine. La Bourse devient folle.',
      choices: [
        c('encadrer', 'Faire suspendre les cotations les plus folles', [g(4, -2, 3), s('credibility', 1)], 'Les marchés grognent, puis se calment. Les spéculateurs cherchent un autre prophète.'),
        c('laisser', 'Laisser le marché s’amuser', [g(-2, 3, -2), { kind: 'economy', confidence: -2 }], 'Une bulle gonfle, puis éclate. Les petits épargnants trinquent.'),
      ],
    }),
  },
  {
    tag: 'voyageur_transformateurs', weight: 1, eligible: on('voyageur', 2, 3, 4),
    build: () => ({
      title: 'Trois cents transformateurs',
      context: 'Pour résister à l’Aurore noire, il faudrait trois cents transformateurs de secours. L’industrie européenne en produit quarante par an. Les autres pays hésitent à croire un homme venu du futur.',
      choices: [
        { ...c('europe', 'Convaincre les partenaires européens en sommet', [g(7, -4, 1), { kind: 'intl', prestige: 1 }], 'Les usines de quatre pays tournent jour et nuit. Les transformateurs arrivent par convois.'), play: 'sommet_ue' },
        c('seuls', 'Se débrouiller seuls', [g(2, 2, 0)], 'Quarante transformateurs, c’est mieux que rien. C’est loin d’être assez.'),
      ],
    }),
  },
  {
    tag: 'voyageur_veille', weight: 1, eligible: on('voyageur', 4),
    build: () => ({
      title: 'La veille du 14 mars',
      context: 'Les astronomes confirment l’arrivée de la tempête dans la nuit. Les ingénieurs proposent de couper volontairement une partie du réseau pour protéger les transformateurs. Le pays entier serait plongé dans le noir quelques heures.',
      choices: [
        c('couper', 'Couper le réseau pendant la tempête', [g(6, -6, -2)], 'À minuit, les lumières s’éteignent dans toute la France. Le ciel, lui, s’illumine.', { risk: { baseChance: 0.7, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-3, 8, -4), s('stress', 4)], failureNews: 'La coupure arrive trop tard dans l’Est : des transformateurs grillent à Strasbourg et à Metz.' } }),
        c('maintenir', 'Maintenir le réseau et croiser les doigts', [g(0, 4, 0)], 'Les centrales tournent à plein. Tout le monde regarde le ciel virer au vert.'),
      ],
    }),
  },
  // La République du Midi
  {
    tag: 'midi_urnes', weight: 1, eligible: on('midi', 0, 1),
    build: () => ({
      title: 'Des urnes en carton',
      context: 'Midi Souverain organise son « référendum d’autodétermination » dans les cafés et les salles des fêtes. Des préfets demandent s’il faut saisir les urnes.',
      choices: [
        c('laisser', 'Laisser voter, en rappelant que le scrutin n’a aucune valeur', [g(4, -2, 4)], 'Le vote a lieu dans le calme, sans éclat ni martyrs. Le mouvement est presque déçu.'),
        c('saisir', 'Faire saisir les urnes', [g(2, 5, -6)], 'Les images d’urnes en carton emportées par des gendarmes font le tour de l’Europe.'),
      ],
    }),
  },
  {
    tag: 'midi_debat', weight: 1, eligible: on('midi', 1, 2, 3),
    build: () => ({
      title: 'Le débat de Montpellier',
      context: 'Aurélien Castanet vous propose un débat public, à Montpellier, devant ses partisans. Il est drôle, charismatique, et connaît chaque village par son nom.',
      choices: [
        { ...c('debattre', 'Accepter le débat, sur ses terres', [g(5, -4, 4), s('popularity', 2)], 'Vous parlez du Sud mieux qu’il ne s’y attendait. Même ses partisans applaudissent.'), play: 'eloquence' },
        c('refuser', 'Refuser de légitimer un séparatiste', [g(1, 3, -3)], 'Castanet débat devant une chaise vide. Elle porte votre nom.'),
      ],
    }),
  },
  {
    tag: 'midi_sou', weight: 1, eligible: on('midi', 2, 3),
    build: () => ({
      title: 'Le sou du Midi',
      context: 'Le « sou du Midi » circule dans trois cents communes. Des commerçants l’acceptent, des retraités y placent leurs économies. Personne ne sait ce qu’il vaut vraiment.',
      choices: [
        { ...c('chiffrer', 'Démontrer, chiffres à l’appui, ce que coûterait la sécession', [g(6, -4, 2), s('credibility', 1)], 'Retraites, routes, hôpitaux : votre démonstration fait réfléchir jusqu’aux plus convaincus.'), play: 'chiffrage' },
        c('ignorer', 'Laisser circuler : une monnaie locale comme une autre', [g(-2, 4, 1)], 'Le sou du Midi gagne trois cents communes de plus.'),
      ],
    }),
  },
  {
    tag: 'midi_ambassade', weight: 1, eligible: on('midi', 3, 4),
    build: () => ({
      title: 'Une ambassade à Barcelone',
      context: 'La « République du Midi » inaugure une ambassade à Barcelone, avec drapeau, cocktail et photographe. Plusieurs élus étrangers ont fait le déplacement.',
      choices: [
        { ...c('diplomatie', 'Mener une discrète tournée diplomatique', [g(6, -3, 0), { kind: 'intl', prestige: 1 }], 'Plus aucune chancellerie n’envoie de représentant. L’ambassade redevient un appartement.'), play: 'protocole' },
        c('justice', 'Exiger sa fermeture par voie de justice', [g(2, 3, -3)], 'La procédure traîne, et chaque audience est une tribune pour le mouvement.'),
      ],
    }),
  },
  {
    tag: 'midi_table', weight: 1, eligible: on('midi', 4),
    build: () => ({
      title: 'Autour de la table',
      context: 'Midi Souverain accepte enfin de négocier. Castanet veut l’occitan à l’école, une fiscalité régionale et « du respect ». Paris veut l’abandon du sou du Midi.',
      choices: [
        { ...c('autonomie', 'Proposer une large autonomie culturelle et fiscale', [g(4, -6, 6), s('politicalCapital', -4)], 'Un compromis se dessine. À Toulouse, on hésite entre la fête et la méfiance.'), play: 'negociation_alliance' },
        c('fermete', 'Ne rien céder', [g(3, 4, -5)], 'Castanet quitte la table sous les caméras. Le Sud se raidit.'),
      ],
    }),
  },
  // La Grande Somnolence
  {
    tag: 'somnolence_tgv', weight: 1, eligible: on('somnolence', 0, 1),
    build: () => ({
      title: 'Le conducteur endormi',
      context: 'Un TGV s’est arrêté en rase campagne : son conducteur s’est endormi aux commandes, et le système de sécurité a fait son office. Personne n’est blessé, mais tout le pays se demande qui sera le prochain.',
      choices: [
        c('binomes', 'Imposer des binômes dans les métiers à risque', [g(5, -3, 2), s('politicalCapital', -2)], 'Pilotes, conducteurs, chirurgiens travaillent désormais à deux. Le pays est rassuré.'),
        c('rien', 'Ne rien changer pour ne pas affoler', [g(0, 4, -2)], 'Une semaine plus tard, un camion-citerne s’arrête au milieu de l’autoroute. Son chauffeur ronfle.'),
      ],
    }),
  },
  {
    tag: 'somnolence_pistes', weight: 1, eligible: on('somnolence', 1, 2),
    build: () => ({
      title: 'Deux équipes, une seule enveloppe',
      context: 'À Limoges, une équipe soupçonne un champignon. À Grenoble, une autre parle d’une onde électromagnétique. Chacune réclame tout le budget de recherche.',
      choices: [
        { ...c('deux', 'Financer les deux pistes, chiffres à l’appui', [g(6, -2, 1)], 'Les deux équipes travaillent, et se surveillent. La science avance plus vite.'), play: 'chiffrage' },
        c('onde', 'Miser tout sur l’onde, plus spectaculaire', [g(-2, 3, 2)], 'L’hypothèse de l’onde passionne les journaux. Les dormeurs, eux, dorment toujours.'),
      ],
    }),
  },
  {
    tag: 'somnolence_familles', weight: 1, eligible: on('somnolence', 1, 2, 3),
    build: () => ({
      title: 'Veiller un proche, perdre son emploi',
      context: 'Des milliers de salariés veillent un parent ou un enfant endormi et ne peuvent plus aller travailler. Les syndicats réclament un congé spécial, le patronat s’inquiète.',
      choices: [
        { ...c('accord', 'Négocier un congé de veille avec syndicats et patronat', [g(2, -2, 6)], 'Un accord est signé dans la nuit : on peut veiller les siens sans perdre son emploi.'), play: 'negociation_syndicale' },
        c('rien', 'Laisser chaque entreprise se débrouiller', [g(0, 2, -4)], 'Licenciements, arrêts maladie de complaisance, colère : le moral flanche.'),
      ],
    }),
  },
  {
    tag: 'somnolence_silos', weight: 1, eligible: on('somnolence', 3),
    build: () => ({
      title: 'Les silos de la Beauce',
      context: 'L’équipe de Limoges a trouvé : des spores d’un champignon microscopique prolifèrent dans de vieux silos à grain et voyagent avec la farine. Il faudrait détruire des milliers de tonnes de blé.',
      choices: [
        c('detruire', 'Faire détruire les stocks contaminés', [g(6, -6, -2), { kind: 'segment', segment: 'ruraux', delta: -1 }], 'Les silos sont vidés et désinfectés. Les agriculteurs seront indemnisés, promettez-vous.'),
        c('trier', 'Les trier lentement pour ne pas ruiner les agriculteurs', [g(1, 3, 1)], 'Le tri prend des mois. Pendant ce temps, la farine continue de voyager.'),
      ],
    }),
  },
  {
    tag: 'somnolence_essai', weight: 1, eligible: on('somnolence', 3, 4),
    build: () => ({
      title: 'Le premier réveillé',
      context: 'Un antifongique banal a réveillé trois dormeurs à Limoges. Les médecins demandent l’autorisation d’un essai à grande échelle, sans attendre les procédures habituelles.',
      choices: [
        c('essai', 'Autoriser l’essai accéléré', [g(7, -6, 4)], 'Des milliers de dormeurs reçoivent le traitement. Le pays retient son souffle.', { risk: { baseChance: 0.7, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-3, 6, -4)], failureNews: 'Le traitement ne réveille que la moitié des patients ; le moral s’effondre.' } }),
        c('prudence', 'Attendre les essais complets', [g(1, 2, -1)], 'Six mois de procédure. Les familles des dormeurs ne comprennent pas.'),
      ],
    }),
  },
  // La cité sous Paris
  {
    tag: 'souterrain_doyenne', weight: 1, eligible: on('souterrain', 0, 1),
    build: () => ({
      title: 'La doyenne veut vous voir',
      context: 'Rose Lagarde, quatre-vingt-quatorze ans, doyenne de la communauté d’en bas, fait savoir qu’elle veut parler à « quelqu’un de la République ». Sa première question est déjà connue : « La Commune a-t-elle gagné ? »',
      choices: [
        c('descendre', 'Descendre la rencontrer, avec un médecin et des masques', [g(5, -2, 4), s('energy', -4)], 'Deux heures à la lueur des chandelles. Elle vous offre une soupe aux champignons, et sa confiance.'),
        c('convoquer', 'La faire monter pour une rencontre officielle', [g(-3, 4, 3)], 'La doyenne découvre le soleil, les voitures, les caméras. Elle redescend bouleversée.'),
      ],
    }),
  },
  {
    tag: 'souterrain_rhume', weight: 1, eligible: on('souterrain', 1, 2),
    build: () => ({
      title: 'Un simple rhume',
      context: 'Un journaliste venu en reportage avait un rhume. Une semaine plus tard, la moitié de la communauté tousse. Leur organisme n’a jamais rencontré nos virus les plus banals.',
      choices: [
        c('protocole', 'Instaurer un protocole sanitaire strict', [g(6, -5, -1), s('politicalCapital', -2)], 'Masques, visites limitées, médecins volontaires : la toux recule.'),
        c('minimiser', 'Minimiser : ce n’est qu’un rhume', [g(-2, 6, 0)], 'Les médecins s’inquiètent. Sous terre, on tousse de plus en plus.'),
      ],
    }),
  },
  {
    tag: 'souterrain_statut', weight: 1, eligible: on('souterrain', 1, 2, 3),
    build: () => ({
      title: 'Qui sont-ils, juridiquement ?',
      context: 'Pas d’état civil, pas de nationalité, pas de numéro de sécurité sociale : la communauté d’en bas n’existe pas aux yeux de l’administration. L’Assemblée en débat.',
      choices: [
        { ...c('statut', 'Défendre à la tribune un statut de communauté protégée', [g(4, -2, 5), s('influence', 1)], 'Votre discours sur « ces Français que l’histoire avait oubliés » est applaudi sur tous les bancs.'), play: 'eloquence' },
        c('droit_commun', 'Leur appliquer le droit commun, sans exception', [g(1, 2, -4)], 'On leur envoie des avis d’imposition. La doyenne les utilise pour allumer les chandelles.'),
      ],
    }),
  },
  {
    tag: 'souterrain_tele', weight: 1, eligible: on('souterrain', 2),
    build: () => ({
      title: 'Une téléréalité sous terre',
      context: 'Une chaîne de télévision propose une fortune pour installer des caméras dans la cité souterraine, vingt-quatre heures sur vingt-quatre. Certains habitants sont tentés.',
      choices: [
        c('refuser', 'Interdire tout tournage sous terre', [g(4, -4, 2)], 'Les producteurs crient à la censure. Les habitants, eux, sont soulagés.'),
        c('accepter', 'Autoriser un tournage encadré', [g(-2, 4, 4)], 'L’émission bat des records. Les galeries voient défiler des dizaines de techniciens.'),
      ],
    }),
  },
  {
    tag: 'souterrain_fissures', weight: 1, eligible: on('souterrain', 3, 4),
    build: () => ({
      title: 'Les galeries craquent',
      context: 'Sous le 14e arrondissement, des fissures courent le long des voûtes. L’Inspection des carrières propose un chantier de consolidation géant, risqué, en pleine zone habitée.',
      choices: [
        c('consolider', 'Lancer le chantier de consolidation', [g(6, -6, 1), s('politicalCapital', -4)], 'Des centaines d’ouvriers descendent sous Paris. Les habitants d’en bas leur apportent de la soupe.', { risk: { baseChance: 0.7, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-3, 8, -3)], failureNews: 'Un pan de galerie s’effondre pendant les travaux ; personne n’est blessé, mais le chantier prend des semaines de retard.' } }),
        c('attendre', 'Attendre l’avis d’une troisième expertise', [g(0, 5, 0)], 'Les experts expertisent. Les fissures, elles, s’allongent.'),
      ],
    }),
  },
  // La Grande Marée
  {
    tag: 'maree_village', weight: 1, eligible: on('maree', 0, 1),
    build: () => ({
      title: 'Port-Clairin a les pieds dans l’eau',
      context: 'À Port-Clairin, petit port de pêche vendéen, la mer entre dans les maisons à chaque marée haute. Les anciens refusent de partir : « On est nés ici, on mourra ici. »',
      choices: [
        c('evacuer', 'Organiser l’évacuation, maison par maison', [g(5, -3, 3), s('energy', -4)], 'Vous passez la journée à convaincre, un café à la main. Le soir, le village est vide et personne n’a été forcé.'),
        c('rester', 'Respecter le choix des habitants de rester', [g(-2, 4, 2)], 'Les anciens restent. Les pompiers aussi, la nuit, au cas où.'),
      ],
    }),
  },
  {
    tag: 'maree_digues', weight: 1, eligible: on('maree', 1, 2),
    build: () => ({
      title: 'Le béton ou les dunes',
      context: 'Les ingénieurs veulent des digues de béton partout. Les écologues plaident pour des dunes, des marais et des polders. Les deux camps vous demandent d’arbitrer, et le budget ne permet pas tout.',
      choices: [
        { ...c('arbitrer', 'Arbitrer, chiffres à l’appui', [g(6, -3, 1)], 'Du béton là où il le faut, des marais ailleurs : votre plan tient la route, et le budget.'), play: 'chiffrage' },
        c('beton', 'Bétonner partout, vite', [g(3, 2, -4)], 'Les bétonnières tournent. Les plages disparaissent, et les digues mal placées cèdent ailleurs.'),
      ],
    }),
  },
  {
    tag: 'maree_accueil', weight: 1, eligible: on('maree', 2, 3),
    build: () => ({
      title: 'Où loger cent mille personnes ?',
      context: 'Cent mille déplacés du littoral cherchent un toit. Certaines communes de l’intérieur ouvrent leurs portes, d’autres les ferment à double tour.',
      choices: [
        { ...c('appel', 'Lancer un grand appel à l’accueil solidaire', [g(2, -2, 7)], 'Des milliers de familles ouvrent leur chambre d’amis. Le pays se découvre généreux.'), play: 'allocution' },
        c('centres', 'Ouvrir des centres d’hébergement provisoires', [g(1, 2, -3)], 'Des gymnases, des lits de camp, et une attente qui s’éternise.'),
      ],
    }),
  },
  {
    tag: 'maree_equinoxe', weight: 1, eligible: on('maree', 3),
    build: () => ({
      title: 'La nuit de l’équinoxe',
      context: 'Cette nuit, la marée d’équinoxe atteindra un niveau jamais vu. Les secours se massent derrière les digues de La Rochelle. On vous propose de suivre la nuit depuis la cellule de crise.',
      choices: [
        c('digue', 'Passer la nuit sur la digue avec les secours', [g(5, -4, 4), s('energy', -6)], 'Bottes, ciré, lampe frontale : vous êtes là quand la mer atteint son plus haut.', { risk: { baseChance: 0.7, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-3, 7, -2)], failureNews: 'La digue cède à l’aube dans un quartier évacué ; l’eau envahit les rues.' } }),
        c('cellule', 'Suivre la nuit depuis la cellule de crise', [g(2, 2, 0)], 'Des écrans, des cartes, des cafés froids. La digue tient, à peu près.'),
      ],
    }),
  },
  {
    tag: 'maree_europe', weight: 1, eligible: on('maree', 2, 3, 4),
    build: () => ({
      title: 'Un fonds européen pour les côtes',
      context: 'Les Pays-Bas, le Portugal et l’Irlande voient eux aussi la mer monter. Un sommet européen s’ouvre à Bruxelles : la France peut y défendre un grand fonds commun.',
      choices: [
        { ...c('sommet', 'Plaider pour un fonds européen des côtes', [g(6, -2, 2), { kind: 'intl', prestige: 1 }], 'Le fonds est voté. Les Néerlandais vous envoient leurs meilleurs ingénieurs.'), play: 'sommet_ue' },
        c('seuls', 'Financer seuls, quitte à creuser le déficit', [g(2, 1, 0), { kind: 'economy', deficit: 0.1 }], 'Les digues avancent, la dette aussi.'),
      ],
    }),
  },
  // Les pirates de la Manche
  {
    tag: 'pirates_convoi', weight: 1, eligible: on('pirates', 0, 1, 2),
    build: () => ({
      title: 'Le premier convoi escorté',
      context: 'Douze cargos doivent traverser la Manche sous escorte de deux frégates. Les vedettes de la Confrérie rôdent dans la brume. Le commandant vous propose de prendre place sur la passerelle.',
      choices: [
        { ...c('passerelle', 'Prendre place sur la passerelle et guider le convoi', [g(7, -5, 3)], 'Les vedettes pirates tournent autour du convoi, puis renoncent. Les marins applaudissent.'), play: 'bataille_navale' },
        c('etat_major', 'Laisser l’état-major décider', [g(1, 2, 0)], 'Le convoi passe, mais un cargo traînard est arraisonné en queue de file.'),
      ],
    }),
  },
  {
    tag: 'pirates_londres', weight: 1, eligible: on('pirates', 1, 2, 3),
    build: () => ({
      title: 'Coopérer avec Londres',
      context: 'Le gouvernement britannique propose des patrouilles communes et un partage du renseignement. En échange, il veut un droit de regard sur les opérations dans les eaux françaises.',
      choices: [
        { ...c('accord', 'Négocier un accord de patrouilles communes', [g(6, -3, 1), { kind: 'intl', prestige: 1 }], 'Frégates françaises et britanniques patrouillent ensemble. La Confrérie perd ses angles morts.'), play: 'negociation_alliance' },
        c('seuls', 'Garder la main : la Manche est aussi française', [g(2, 3, 0)], 'Fierté intacte, renseignement en miettes.'),
      ],
    }),
  },
  {
    tag: 'pirates_dockers', weight: 1, eligible: on('pirates', 2),
    build: () => ({
      title: 'Les quais du Havre se vident',
      context: 'Les armateurs refusent d’appareiller, les dockers sont au chômage technique, les rayons se vident. Syndicats et armateurs se renvoient la faute.',
      choices: [
        { ...c('negocier', 'Réunir dockers et armateurs autour d’une table', [g(4, -2, 5)], 'Un accord est trouvé : primes de risque, escortes garanties, et les quais reprennent vie.'), play: 'negociation_syndicale' },
        c('requisitionner', 'Réquisitionner les navires', [g(2, 2, -5)], 'Les navires partent, les équipages grognent, et les syndicats promettent de s’en souvenir.'),
      ],
    }),
  },
  {
    tag: 'pirates_informateur', weight: 1, eligible: on('pirates', 2, 3),
    build: () => ({
      title: 'Un informateur à Boulogne',
      context: 'Un mareyeur de Boulogne-sur-Mer prétend connaître les complices de la Confrérie dans le port. Il propose d’infiltrer le réseau jusqu’au Capitaine Gris.',
      choices: [
        c('infiltrer', 'Faire infiltrer la Confrérie', [g(6, -5, 0)], 'Pendant des semaines, l’informateur remonte la filière. La base flottante apparaît sur les cartes.', { risk: { baseChance: 0.65, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 6, -2)], failureNews: 'L’informateur est démasqué et doit être exfiltré en urgence ; la Confrérie déplace sa base.' } }),
        c('arreter', 'Faire arrêter tout de suite les complices connus', [g(2, 2, 1)], 'Trois arrestations, beaucoup de bruit. Le reste du réseau disparaît dans la brume.'),
      ],
    }),
  },
  {
    tag: 'pirates_assaut', weight: 1, eligible: on('pirates', 3, 4),
    build: () => ({
      title: 'La base flottante',
      context: 'La base de la Confrérie, un ancien navire-usine reconverti, est localisée au large d’Aurigny. Les états-majors français et britannique attendent votre feu vert.',
      choices: [
        { ...c('operation', 'Lancer l’opération conjointe d’encerclement', [g(8, -8, 3)], 'Frégates, hélicoptères, vedettes : le filet se resserre sur le navire-usine.'), play: 'bataille_navale' },
        c('blocus', 'Se contenter d’un blocus', [g(2, 1, -1)], 'La base est bloquée, mais ses vedettes continuent de filer la nuit.'),
      ],
    }),
  },
  // La voyante de Brocéliande
  {
    tag: 'voyante_pelerins', weight: 1, eligible: on('voyante', 0, 1),
    build: () => ({
      title: 'Trente mille personnes en forêt',
      context: 'Trente mille pèlerins se sont installés dans la forêt de Brocéliande. Ils chantent sous les fenêtres de Maëlle, qui ne peut plus aller à l’école.',
      choices: [
        c('organiser', 'Organiser l’accueil loin de la maison familiale', [g(5, -3, 2), s('energy', -3)], 'Un grand site d’accueil ouvre à dix kilomètres. La rue de Maëlle retrouve le silence.'),
        c('laisser', 'Laisser la ferveur s’exprimer', [g(-2, 5, 1)], 'Les tentes s’approchent encore. La famille tire les rideaux en plein jour.'),
      ],
    }),
  },
  {
    tag: 'voyante_marchands', weight: 1, eligible: on('voyante', 1, 2),
    build: () => ({
      title: 'Les marchands du temple',
      context: 'Médailles à l’effigie de Maëlle, « eau de Brocéliande » à vingt euros la bouteille, faux guérisseurs qui promettent des miracles par téléphone : le commerce prospère.',
      choices: [
        c('poursuivre', 'Faire poursuivre les escrocs et les faux guérisseurs', [g(5, -4, 3), s('credibility', 1)], 'Une vague de perquisitions vide les étals. Les malades dupés porteront plainte.'),
        c('tolerer', 'Fermer les yeux : c’est bon pour le commerce local', [g(-1, 4, -1)], 'Les boutiques se multiplient. L’image de Maëlle est partout, sans son accord.'),
      ],
    }),
  },
  {
    tag: 'voyante_eveques', weight: 1, eligible: on('voyante', 2, 3),
    build: () => ({
      title: 'Les évêques divisés',
      context: 'Un évêque parle de « signe », un autre appelle à la prudence, des fidèles s’invectivent devant la cathédrale de Rennes. Tous se tournent vers les pouvoirs publics.',
      choices: [
        { ...c('reunir', 'Réunir discrètement responsables religieux et médecins', [g(4, -3, 4)], 'Une déclaration commune appelle au calme et au respect de l’enfant. Elle est entendue.'), play: 'protocole' },
        c('laicite', 'Ne pas s’en mêler : laïcité oblige', [g(0, 3, -2)], 'Le débat s’envenime, et Maëlle en devient l’otage.'),
      ],
    }),
  },
  {
    tag: 'voyante_etude', weight: 1, eligible: on('voyante', 3),
    build: () => ({
      title: 'Les scientifiques veulent des tests',
      context: 'Une académie réclame une étude publique sur les « guérisons » de Maëlle. Un journaliste vous invite à en débattre en direct, et il a préparé quelques pièges.',
      choices: [
        { ...c('defendre', 'Défendre à l’antenne le droit de l’enfant à la tranquillité', [g(5, -3, 4), s('popularity', 1)], 'Vous esquivez les pièges et rappelez l’essentiel : c’est une enfant. Le pays approuve.'), play: 'interview_piege' },
        c('etude', 'Autoriser une grande étude publique', [g(-3, 4, 0)], 'Caméras, blouses blanches, protocoles : Maëlle devient un sujet d’expérience.'),
      ],
    }),
  },
  {
    tag: 'voyante_lettre', weight: 1, eligible: on('voyante', 4),
    build: () => ({
      title: 'La lettre de Maëlle',
      context: 'Une lettre au stylo violet arrive à votre bureau : « Je ne sais pas si je guéris les gens. Je voudrais juste retourner à l’école avec mes copines. Est-ce que c’est possible ? »',
      choices: [
        { ...c('repondre', 'Lui répondre vous-même et lui promettre un retour à l’école', [g(4, -4, 5)], 'Votre réponse reste privée. Mais à la rentrée suivante, un pupitre l’attend dans un collège discret.'), play: 'courrier' },
        c('services', 'Laisser vos services répondre', [g(0, 2, -1)], 'Une réponse polie, tamponnée. Maëlle la range sans un mot.'),
      ],
    }),
  },
  // Le Grand Silence
  {
    tag: 'silence_paie', weight: 1, eligible: on('silence', 0, 1),
    build: () => ({
      title: 'Les salaires ne sont pas versés',
      context: 'Sans réseau, les virements de salaires sont bloqués. Des millions de Français n’ont pas été payés ce mois-ci. Les banques proposent d’attendre.',
      choices: [
        c('cheques', 'Faire verser les salaires par chèque et en espèces', [g(6, -4, 2), s('politicalCapital', -3)], 'Des fourgons blindés sillonnent le pays. Les files devant les banques sont longues, mais tout le monde est payé.'),
        c('attendre', 'Attendre le retour du réseau', [g(0, 5, -3)], 'Les loyers ne sont pas payés, les frigos se vident, la colère monte.'),
      ],
    }),
  },
  {
    tag: 'silence_radio', weight: 1, eligible: on('silence', 0, 1, 2),
    build: () => ({
      title: 'Le pays écoute la radio',
      context: 'Sans Internet, la radio est redevenue le cœur du pays. Chaque soir, des millions de Français écoutent les nouvelles, les postes à piles se vendent à prix d’or.',
      choices: [
        { ...c('allocution', 'Parler chaque soir aux Français à la radio', [g(2, -2, 6)], 'Votre voix devient un rendez-vous. Les Français savent où en est le pays, et ce qu’ils peuvent faire.'), play: 'allocution' },
        c('communiques', 'Diffuser des communiqués écrits', [g(0, 1, 0)], 'Des communiqués précis, que personne ne lit.'),
      ],
    }),
  },
  {
    tag: 'silence_ordonnances', weight: 1, eligible: on('silence', 2),
    build: () => ({
      title: 'Les ordonnances manuscrites',
      context: 'Sans dossiers informatisés, les hôpitaux et les pharmacies ne se comprennent plus. Des médicaments manquent ici, s’entassent là-bas.',
      choices: [
        c('coursiers', 'Organiser un réseau de coursiers entre hôpitaux et pharmacies', [g(6, -5, 3), s('energy', -4)], 'Vélos, motos, taxis volontaires : les médicaments circulent à nouveau.'),
        c('rationner', 'Rationner les médicaments', [g(1, 3, -4)], 'Les stocks tiennent, les patients beaucoup moins.'),
      ],
    }),
  },
  {
    tag: 'silence_satellites', weight: 1, eligible: on('silence', 2, 3),
    build: () => ({
      title: 'Les satellites d’un marchand',
      context: 'Un opérateur privé étranger propose un accès d’urgence par satellite pour les hôpitaux et les banques. Son prix est exorbitant, ses conditions encore plus.',
      choices: [
        { ...c('negocier', 'Négocier pied à pied un accès d’urgence', [g(6, -3, 0)], 'Vous obtenez un tarif raisonnable et aucune clause sur les données. Les hôpitaux se reconnectent.'), play: 'negociation_alliance' },
        c('payer', 'Payer le prix fort sans discuter', [g(2, 1, -2), { kind: 'economy', deficit: 0.1 }], 'Les hôpitaux sont reconnectés. Le contrat fait scandale.'),
      ],
    }),
  },
  {
    tag: 'silence_cable', weight: 1, eligible: on('silence', 3, 4),
    build: () => ({
      title: 'Le dernier câble',
      context: 'Le câble le plus important passe au large de la pointe de Penmarc’h, par grand fond. La météo est exécrable. Les ingénieurs proposent d’envoyer tous les navires câbliers disponibles.',
      choices: [
        c('navires', 'Envoyer tous les navires câbliers disponibles', [g(6, -6, 2)], 'Les navires affrontent la houle pendant dix jours. Le pays suit la réparation à la radio.', { risk: { baseChance: 0.7, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 6, -2)], failureNews: 'Une tempête interrompt la réparation ; le câble devra attendre.' } }),
        c('attendre', 'Attendre la flotte européenne', [g(1, 2, 0)], 'La flotte européenne arrive avec trois semaines de retard.'),
      ],
    }),
  },
  // Le réveil des volcans
  {
    tag: 'volcans_fissures', weight: 1, eligible: on('volcans', 0, 1),
    build: () => ({
      title: 'Des fissures dans la rue',
      context: 'À Clermont-Ferrand, des fissures apparaissent sur des façades, une école signale un plafond qui craque. Les parents s’inquiètent, les réseaux s’enflamment.',
      choices: [
        c('inspecter', 'Faire inspecter écoles et hôpitaux', [g(6, -2, 1), s('energy', -3)], 'Des centaines de bâtiments sont inspectés. Deux écoles déménagent, les autres sont rassurées.'),
        c('rassurer', 'Rassurer les habitants', [g(-1, 3, 3)], 'Les Clermontois se rassurent. Les fissures, elles, s’élargissent.'),
      ],
    }),
  },
  {
    tag: 'volcans_panache', weight: 1, eligible: on('volcans', 1, 2),
    build: () => ({
      title: 'Le panache en direct',
      context: 'Le panache de vapeur est visible depuis Lyon. Toutes les chaînes du monde ont installé leurs caméras sur les hauteurs de Clermont. Les rumeurs d’explosion géante circulent.',
      choices: [
        { ...c('conference', 'Tenir une conférence de presse avec les volcanologues', [g(3, -1, 6), s('credibility', 1)], 'Cartes, chiffres, scénarios : la peur cède la place à la vigilance.'), play: 'conference_presse' },
        c('laisser', 'Laisser les scientifiques communiquer seuls', [g(0, 2, -2)], 'Les scientifiques parlent en probabilités. Les chaînes d’info traduisent en catastrophes.'),
      ],
    }),
  },
  {
    tag: 'volcans_evacuer', weight: 1, eligible: on('volcans', 2),
    build: () => ({
      title: 'Évacuer Clermont-Ferrand ?',
      context: 'Le sol se soulève de trois centimètres par semaine sous l’ouest de l’agglomération. Les volcanologues recommandent une évacuation préventive de cent mille personnes.',
      choices: [
        c('evacuer', 'Ordonner l’évacuation préventive', [g(7, -6, -3), s('politicalCapital', -4)], 'Des files de voitures quittent la ville dans le calme, bus et trains réquisitionnés.', { risk: { baseChance: 0.7, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-3, 4, -6)], failureNews: 'L’évacuation tourne aux embouteillages monstres ; la colère gronde plus fort que le volcan.' } }),
        c('attendre', 'Attendre des signes plus nets', [g(0, 6, 2)], 'La ville reste habitée. Les volcanologues dorment avec leur téléphone à la main.'),
      ],
    }),
  },
  {
    tag: 'volcans_accueil', weight: 1, eligible: on('volcans', 2, 3),
    build: () => ({
      title: 'Où vont les Clermontois ?',
      context: 'Cent mille évacués à loger, nourrir, scolariser. Les préfets des départements voisins vous demandent de coordonner l’accueil, et votre agenda déborde déjà.',
      choices: [
        { ...c('coordonner', 'Coordonner vous-même l’accueil dans les départements voisins', [g(4, -2, 5)], 'Vous enchaînez préfectures, gymnases et écoles. Chaque famille a un toit avant la nuit.'), play: 'agenda_impossible' },
        c('gymnases', 'Ouvrir des gymnases et laisser faire les préfets', [g(1, 1, -3)], 'Des lits de camp alignés à perte de vue. Les évacués comptent les jours.'),
      ],
    }),
  },
  {
    tag: 'volcans_coulee', weight: 1, eligible: on('volcans', 3, 4),
    build: () => ({
      title: 'La coulée descend la vallée',
      context: 'Une coulée de lave descend lentement vers un village évacué. Des ingénieurs proposent de la détourner avec des digues de terre, comme on l’a fait ailleurs dans le monde.',
      choices: [
        c('detourner', 'Tenter de détourner la coulée', [g(6, -6, 3)], 'Les bulldozers travaillent jour et nuit face à la lave. Le pays entier regarde.', { risk: { baseChance: 0.65, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 6, -2)], failureNews: 'La coulée franchit la première digue et engloutit une route départementale.' } }),
        c('laisser', 'Laisser la lave suivre sa pente', [g(0, 3, -1)], 'Le village évacué disparaît sous la lave. Personne n’est blessé, mais les images bouleversent.'),
      ],
    }),
  },
  // La fièvre dansante
  {
    tag: 'danse_tentes', weight: 1, eligible: on('danse', 0, 1),
    build: () => ({
      title: 'Colmar, puis Mulhouse',
      context: 'À Colmar, puis à Mulhouse, des groupes de danseurs apparaissent sur les places. Épuisés, déshydratés, incapables de s’arrêter. Les urgences sont débordées.',
      choices: [
        c('tentes', 'Installer des tentes de soins près des danseurs', [g(5, -3, 2), s('energy', -3)], 'Eau, perfusions, matelas : les danseurs sont soignés là où ils dansent.'),
        c('boucler', 'Faire boucler les places publiques', [g(1, 2, -4)], 'Les places sont fermées. Les danseurs dansent ailleurs.'),
      ],
    }),
  },
  {
    tag: 'danse_musique', weight: 1, eligible: on('danse', 1, 2),
    build: () => ({
      title: 'Faut-il interdire la musique ?',
      context: 'Des députés réclament l’interdiction des concerts, des fêtes et même de la musique dans les lieux publics, « par précaution ». Le débat arrive dans l’hémicycle.',
      choices: [
        { ...c('defendre', 'Défendre à la tribune le refus d’interdire', [g(3, -1, 5)], 'Votre discours sur « un pays qui ne cédera pas à la peur » est applaudi debout.'), play: 'eloquence' },
        c('interdire', 'Interdire concerts et fêtes', [g(1, 3, -5)], 'Le silence tombe sur le pays. La peur, elle, continue de danser.'),
      ],
    }),
  },
  {
    tag: 'danse_rumeurs', weight: 1, eligible: on('danse', 2, 3),
    build: () => ({
      title: 'Les rumeurs folles',
      context: 'Une onde cachée dans une chanson à la mode ? Un vaccin ? Une malédiction ? Les rumeurs les plus folles circulent, et des musiciens sont pris à partie dans la rue.',
      choices: [
        { ...c('verifier', 'Démonter les rumeurs en direct', [g(2, -2, 6)], 'Point par point, vous démontez les fausses informations. Les musiciens respirent.'), play: 'factcheck_direct' },
        c('laisser', 'Laisser dire', [g(0, 3, -3)], 'Les rumeurs prospèrent. Un groupe de jazz doit annuler sa tournée.'),
      ],
    }),
  },
  {
    tag: 'danse_orchestre', weight: 1, eligible: on('danse', 3),
    build: () => ({
      title: 'L’idée de la neurologue',
      context: 'Une neurologue strasbourgeoise propose de jouer pour les danseurs une musique de plus en plus lente, pendant des heures, pour les amener à s’arrêter. Il faut des centaines de musiciens.',
      choices: [
        c('orchestres', 'Financer des orchestres de ralentissement', [g(7, -6, 3)], 'Dans toutes les villes touchées, des orchestres jouent nuit et jour. Le tempo baisse.', { risk: { baseChance: 0.7, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -3)], failureNews: 'Le premier concert ralentit les danseurs… puis en entraîne d’autres. Il faut tout revoir.' } }),
        c('sedatifs', 'Préférer les sédatifs', [g(2, 1, -2)], 'Les danseurs dorment, puis se relèvent et recommencent.'),
      ],
    }),
  },
  {
    tag: 'danse_kleber', weight: 1, eligible: on('danse', 4),
    build: () => ({
      title: 'Un discours place Kléber',
      context: 'Les derniers danseurs s’arrêtent un à un. Strasbourg veut organiser une grande soirée pour remercier soignants et musiciens, et vous demande de prendre la parole.',
      choices: [
        { ...c('discours', 'Écrire et prononcer un discours place Kléber', [g(3, -3, 5)], 'Vos mots sur « le pays qui a appris à ralentir » sont repris dans toutes les écoles.'), play: 'plume_discours' },
        c('discret', 'Rester discret', [g(0, 1, 0)], 'La soirée a lieu sans vous. Elle est très belle.'),
      ],
    }),
  },
  // La fontaine de jouvence
  {
    tag: 'jouvence_routes', weight: 1, eligible: on('jouvence', 0, 1),
    build: () => ({
      title: 'Esquirac assiégé',
      context: 'Les routes de la vallée sont bloquées par des milliers de voitures, des camping-cars s’installent dans les prés, et les habitants d’Esquirac ne peuvent plus descendre en ville.',
      choices: [
        c('navettes', 'Organiser navettes, parkings et accès réservés aux habitants', [g(5, -3, 2), s('energy', -3)], 'Parkings en fond de vallée, navettes toutes les dix minutes : le village respire.'),
        c('laisser', 'Laisser faire : c’est la saison', [g(-1, 4, 0)], 'Les bouchons remontent jusqu’au col.'),
      ],
    }),
  },
  {
    tag: 'jouvence_etude', weight: 1, eligible: on('jouvence', 1, 2),
    build: () => ({
      title: 'Une étude en double aveugle',
      context: 'Des chercheurs toulousains proposent une étude rigoureuse : mille volontaires, la moitié avec l’eau d’Esquirac, l’autre avec de l’eau du robinet. Les pèlerins crient au sacrilège, les sceptiques ricanent.',
      choices: [
        { ...c('defendre', 'Défendre l’étude devant la presse', [g(5, -3, 3)], 'Vous expliquez pourquoi on doit savoir, plutôt que croire. L’étude démarre, sous les applaudissements des uns et les grognements des autres.'), play: 'conference_presse' },
        c('ajourner', 'Ajourner l’étude pour ne froisser personne', [g(0, 3, -1)], 'Personne n’est froissé. Personne ne sait rien non plus.'),
      ],
    }),
  },
  {
    tag: 'jouvence_trafic', weight: 1, eligible: on('jouvence', 2, 3),
    build: () => ({
      title: 'Mille euros le litre',
      context: 'L’eau d’Esquirac se vend sous le manteau à mille euros le litre ; des contrefaçons tirées au robinet inondent les marchés, et des citernes disparaissent la nuit.',
      choices: [
        c('operation', 'Lancer une opération contre le trafic', [g(6, -5, 1)], 'Douaniers et gendarmes saisissent citernes et bidons. Les prix s’effondrent, la source remonte.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Les trafiquants avaient été prévenus : les citernes ont disparu, et les prix doublent.' } }),
        c('tolerer', 'Laisser le marché se réguler', [g(1, 3, -1)], 'Le marché se régule : l’eau coûte désormais deux mille euros.'),
      ],
    }),
  },
  {
    tag: 'jouvence_retraites', weight: 1, eligible: on('jouvence', 3),
    build: () => ({
      title: 'Les caisses de retraite s’affolent',
      context: 'Les gestionnaires des caisses de retraite publient une note alarmiste : si l’eau tient ses promesses, il faudra revoir tout le système. Les syndicats exigent d’être reçus.',
      choices: [
        { ...c('recevoir', 'Recevoir syndicats et gestionnaires pour désamorcer la panique', [g(4, -3, 5)], 'Autour de la table, chacun admet qu’on ne réforme pas les retraites sur la foi d’un lavoir. La panique retombe.'), play: 'negociation_syndicale' },
        c('rapport', 'Commander un rapport et attendre', [g(0, 3, -3)], 'Le rapport est attendu dans dix-huit mois. Les rumeurs, elles, n’attendent pas.'),
      ],
    }),
  },
  {
    tag: 'jouvence_verdict', weight: 1, eligible: on('jouvence', 4),
    build: () => ({
      title: 'Les résultats de l’étude',
      context: 'Les résultats de l’étude tombent cette semaine. Un journaliste vous invite à les commenter en direct, et il a déjà préparé ses questions pièges.',
      choices: [
        { ...c('expliquer', 'Expliquer les résultats en direct, sans rien promettre', [g(2, -2, 6)], 'Ni miracle ni arnaque : vous dites ce qu’on sait, et ce qu’on ignore. Le pays apprécie la franchise.'), play: 'interview_piege' },
        c('scientifiques', 'Laisser parler les scientifiques', [g(1, 1, 0)], 'Les scientifiques parlent d’intervalles de confiance. Le pays zappe.'),
      ],
    }),
  },
  // Le grand exode
  {
    tag: 'exode_mairie', weight: 1, eligible: on('exode', 0, 1),
    build: () => ({
      title: 'Le maire débordé',
      context: 'Le maire d’un village de la Creuse a vu sa commune passer de trois cents à neuf cents habitants. Il n’a qu’une secrétaire de mairie à mi-temps, et menace de démissionner.',
      choices: [
        c('renforts', 'Envoyer des renforts administratifs aux petites mairies', [g(5, -3, 2), s('energy', -3)], 'Des fonctionnaires volontaires débarquent avec leurs ordinateurs. Le maire retire sa démission.'),
        c('debrouiller', 'Laisser les communes se débrouiller', [g(0, 3, -2)], 'Le maire démissionne. Trois autres l’imitent dans la semaine.'),
      ],
    }),
  },
  {
    tag: 'exode_classes', weight: 1, eligible: on('exode', 1, 2),
    build: () => ({
      title: 'Des écoles pleines à craquer',
      context: 'Les écoles rurales manquent de places, d’enseignants et de cars scolaires. Les syndicats d’enseignants réclament des moyens d’urgence avant la rentrée.',
      choices: [
        { ...c('negocier', 'Négocier un plan d’urgence pour les écoles rurales', [g(6, -3, 2)], 'Classes rouvertes, enseignants volontaires, cars supplémentaires : la rentrée se fera.'), play: 'negociation_syndicale' },
        c('regrouper', 'Regrouper les classes dans les bourgs', [g(2, 1, -3)], 'Les trajets s’allongent, les parents grondent.'),
        c('attendre', 'Attendre la rentrée suivante', [g(0, 3, -2)], 'Les maires installent des préfabriqués à leurs frais, en maugréant.'),
      ],
    }),
  },
  {
    tag: 'exode_loyers', weight: 1, eligible: on('exode', 2, 3),
    build: () => ({
      title: 'Paris à moitié prix',
      context: 'Les loyers parisiens ont chuté de moitié, des commerces ferment, et des propriétaires endettés s’affolent. Les investisseurs réclament un plan de sauvetage de l’immobilier urbain.',
      choices: [
        c('reconvertir', 'Reconvertir les logements vides en logements abordables', [g(5, -3, 2), s('politicalCapital', -3)], 'Étudiants, soignants, jeunes actifs : les immeubles vides se remplissent autrement.'),
        c('racheter', 'Racheter les biens des investisseurs', [g(2, 0, -4), { kind: 'economy', deficit: 0.1 }], 'Les investisseurs sont soulagés. Les contribuables, beaucoup moins.'),
      ],
    }),
  },
  {
    tag: 'exode_conseil', weight: 1, eligible: on('exode', 3),
    build: () => ({
      title: 'La fibre ou les chemins',
      context: 'Dans un village du Morvan, nouveaux venus et anciens s’affrontent en conseil municipal : les uns veulent la fibre et des pistes cyclables, les autres leurs chemins creux et leur tranquillité.',
      choices: [
        { ...c('consulter', 'Organiser une grande consultation de village', [g(3, -3, 6)], 'Fibre le long des routes, chemins creux classés : chacun repart avec quelque chose, et tout le monde finit au café.'), play: 'consultation' },
        c('trancher', 'Trancher pour la fibre partout', [g(4, 0, -4)], 'La fibre passe. Les anciens ne vous saluent plus au marché.'),
        c('laisser', 'Laisser le conseil municipal s’écharper', [g(0, 3, -3)], 'La séance dure jusqu’à deux heures du matin. Rien n’est voté.'),
      ],
    }),
  },
  {
    tag: 'exode_petites_lignes', weight: 1, eligible: on('exode', 3, 4),
    build: () => ({
      title: 'Rouvrir les petites lignes',
      context: 'Des dizaines de lignes ferroviaires fermées depuis des décennies pourraient rouvrir pour desservir les villages repeuplés. La facture est lourde, et le chantier hasardeux.',
      choices: [
        c('rouvrir', 'Rouvrir en urgence les lignes les plus utiles', [g(6, -4, 2)], 'Les premiers autorails repartent entre les prés. Dans les gares de campagne, on applaudit.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Les vieux rails ne tiennent pas : les premiers trains roulent au pas, et les retards deviennent légendaires.' } }),
        c('cars', 'Se contenter de cars', [g(1, 3, 0)], 'Les cars passent deux fois par jour. Quand ils passent.'),
      ],
    }),
  },
  // La machine à pluie
  {
    tag: 'pluie_encheres', weight: 1, eligible: on('pluie', 0, 1),
    build: () => ({
      title: 'La pluie aux enchères',
      context: 'Averse ouvre des enchères pour ses prochaines averses. La Provence propose le double de l’Occitanie ; les petites communes du Gers n’ont pas de quoi enchérir.',
      choices: [
        c('priorites', 'Imposer une priorité aux zones les plus sèches', [g(5, -3, 2)], 'Les averses vont d’abord là où la terre craque. Les grandes régions râlent, les petites respirent.'),
        c('encheres', 'Laisser jouer les enchères', [g(0, 4, -2)], 'Il pleut sur les golfs de la Côte d’Azur. Dans le Gers, on regarde le ciel.'),
      ],
    }),
  },
  {
    tag: 'pluie_nuages_voles', weight: 1, eligible: on('pluie', 1, 2),
    build: () => ({
      title: 'Les nuages volés',
      context: 'Une région accuse l’Occitanie de « siphonner ses nuages ». Les présidents de région s’invectivent par communiqués interposés et menacent de saisir la justice.',
      choices: [
        { ...c('table', 'Réunir les régions autour d’une même table', [g(5, -3, 3)], 'Un calendrier commun des averses est signé à l’aube. Les communiqués rageurs cessent.'), play: 'negociation_coalition' },
        c('tribunaux', 'Laisser les tribunaux trancher', [g(1, 3, -2)], 'Les avocats se frottent les mains. Les nuages, eux, passent la frontière.'),
      ],
    }),
  },
  {
    tag: 'pluie_grele', weight: 1, eligible: on('pluie', 2, 3),
    build: () => ({
      title: 'La grêle sur les vignes',
      context: 'Une averse commandée par une coopérative a tourné à la grêle : trois cents hectares de vignes hachés en dix minutes. Les vignerons exigent réparation, Averse invoque un « aléa ».',
      choices: [
        c('fonds', 'Créer un fonds d’indemnisation financé par les ventes de pluie', [g(5, -3, 3), s('politicalCapital', -3)], 'Les vignerons sont indemnisés en un mois. Averse paie, et révise ses protocoles.'),
        c('justice', 'Renvoyer vers les tribunaux', [g(1, 3, -3)], 'Le procès est prévu dans trois ans. Les vignes, elles, ne repousseront pas d’ici là.'),
      ],
    }),
  },
  {
    tag: 'pluie_crue', weight: 1, eligible: on('pluie', 3),
    build: () => ({
      title: 'La rivière qui déborde',
      context: 'Une averse trop généreuse a fait déborder une rivière dans un bourg du Tarn-et-Garonne qui n’avait rien commandé ; les habitants ont été mis à l’abri à temps. Averse propose de « faire moins pleuvoir » en dispersant les nuages, une technique jamais testée.',
      choices: [
        c('disperser', 'Autoriser la dispersion, sous contrôle des météorologues', [g(6, -5, 1)], 'Les nuages s’effilochent au-dessus de la vallée. Le soleil revient, la rivière rentre dans son lit.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Les nuages dispersés vont crever trois vallées plus loin ; il faut des jours pour tout éponger.' } }),
        c('secours', 'S’en tenir aux secours classiques', [g(1, 3, 0)], 'Pompiers, pompes et sacs de sable. Averse, elle, continue de vendre.'),
      ],
    }),
  },
  {
    tag: 'pluie_loi', weight: 1, eligible: on('pluie', 4),
    build: () => ({
      title: 'À qui appartient le ciel ?',
      context: 'Le Parlement débat d’une loi sur la propriété du ciel. Vous pouvez prendre la parole pour défendre l’idée que la pluie est un bien commun.',
      choices: [
        { ...c('tribune', 'Défendre à la tribune le ciel comme bien commun', [g(4, -3, 4)], 'Votre formule, « la pluie ne se privatise pas », est reprise jusqu’au Conseil d’État.'), play: 'eloquence' },
        c('juristes', 'Laisser le débat aux juristes', [g(1, 1, 0)], 'Les juristes débattent de la hauteur à laquelle commence le ciel. Le pays décroche.'),
      ],
    }),
  },
  // La rouille blanche
  {
    tag: 'rouille_pont', weight: 1, eligible: on('rouille', 0, 1),
    build: () => ({
      title: 'Un pont à fermer',
      context: 'Le principal pont de la ville est touché. Le fermer, c’est une heure de détour pour cent mille personnes chaque jour ; le garder ouvert, c’est parier sur la solidité d’un béton malade.',
      choices: [
        c('fermer', 'Fermer le pont et organiser des navettes', [g(5, -3, 1), s('energy', -3)], 'Bacs, bus, vélos : la ville s’organise. Les inspections confirment que c’était nécessaire.'),
        c('pietons', 'Le réserver aux piétons', [g(2, 1, 0)], 'Les voitures font le détour, les piétons traversent vite. Personne n’est vraiment rassuré.'),
        c('ouvert', 'Le laisser ouvert, sous surveillance', [g(-1, 4, 1)], 'La circulation continue. Chaque matin, un ingénieur mesure les fissures, la mine sombre.'),
      ],
    }),
  },
  {
    tag: 'rouille_tours', weight: 1, eligible: on('rouille', 1, 2),
    build: () => ({
      title: 'Des tours à évacuer',
      context: 'Les ingénieurs recommandent d’évacuer trois tours rongées à la base. Mille deux cents familles doivent être relogées, et certaines refusent de quitter leur appartement.',
      choices: [
        { ...c('concerter', 'Organiser une concertation avec les habitants', [g(4, -3, 5)], 'Les habitants choisissent leur relogement, quartier par quartier. Le déménagement se fait sans drame.'), play: 'consultation' },
        c('ordonner', 'Ordonner l’évacuation sans délai', [g(4, 0, -5)], 'L’évacuation est rapide et froide. Les images de familles avec leurs cartons font le tour des réseaux.'),
        c('attendre', 'Attendre une contre-expertise', [g(0, 4, 0)], 'Les experts contre-expertisent. Le duvet blanc, lui, monte d’un étage.'),
      ],
    }),
  },
  {
    tag: 'rouille_cimentiers', weight: 1, eligible: on('rouille', 2, 3),
    build: () => ({
      title: 'Le béton breveté',
      context: 'Les géants du ciment proposent un « béton immunisé » breveté, à prix d’or. Un laboratoire public affirme pouvoir faire aussi bien, en libre accès, mais avec six mois de retard.',
      choices: [
        c('public', 'Soutenir le laboratoire public', [g(5, -2, 3), s('politicalCapital', -3)], 'La formule est publiée en libre accès. Les cimentiers grincent des dents, les maires applaudissent.'),
        c('brevet', 'Acheter le béton breveté, tout de suite', [g(3, 0, -4), { kind: 'economy', deficit: 0.1 }], 'Les chantiers démarrent vite. La facture, elle, fait scandale.'),
      ],
    }),
  },
  {
    tag: 'rouille_essai', weight: 1, eligible: on('rouille', 3),
    build: () => ({
      title: 'L’essai de l’antidote',
      context: 'Une équipe de Grenoble a mis au point un antifongique qui stoppe la rouille blanche en laboratoire. Elle propose un essai grandeur nature sur un viaduc entier, fermé à la circulation.',
      choices: [
        c('essai', 'Autoriser l’essai grandeur nature', [g(7, -5, 2)], 'Le duvet blanc noircit, puis tombe en poussière. Le viaduc est sauvé.', { risk: { baseChance: 0.4, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -3)], failureNews: 'L’antifongique teint le viaduc en vert vif et n’arrête rien : il faut tout reprendre de zéro.' } }),
        c('labo', 'Exiger encore six mois de tests en laboratoire', [g(1, 3, 0)], 'Les chercheurs testent. La rouille, elle, ne prend pas de vacances.'),
      ],
    }),
  },
  {
    tag: 'rouille_rumeurs', weight: 1, eligible: on('rouille', 2, 3, 4),
    build: () => ({
      title: 'Ma maison est-elle rongée ?',
      context: 'Des escrocs démarchent les retraités pour des « traitements anti-rouille » hors de prix, et une rumeur affirme que tous les immeubles d’avant 1980 vont s’effondrer.',
      choices: [
        { ...c('verifier', 'Démonter les rumeurs en direct', [g(1, -2, 6)], 'Plans, chiffres, inspections : vous démontez la rumeur point par point. Les démarcheurs disparaissent.'), play: 'factcheck_direct' },
        c('prefectures', 'Laisser les préfectures communiquer', [g(0, 3, -3)], 'Les communiqués sont exacts et illisibles. La rumeur court plus vite.'),
      ],
    }),
  },
  // Le printemps silencieux
  {
    tag: 'abeilles_haies', weight: 1, eligible: on('abeilles', 0, 1),
    build: () => ({
      title: 'Des haies et des prairies',
      context: 'Une association propose de replanter des milliers de kilomètres de haies et de prairies fleuries pour accueillir les derniers pollinisateurs sauvages. Les agriculteurs hésitent à céder du terrain.',
      choices: [
        c('planter', 'Lancer un grand plan haies et prairies', [g(4, -2, 4), s('politicalCapital', -3)], 'Des milliers de volontaires plantent des aubépines et des sureaux. Les premiers bourdons sauvages reviennent.'),
        c('reporter', 'Remettre à plus tard', [g(0, 3, 0)], 'Le plan attend dans un tiroir. Les prairies, elles, n’attendent pas.'),
      ],
    }),
  },
  {
    tag: 'abeilles_pinceaux', weight: 1, eligible: on('abeilles', 1, 2),
    build: () => ({
      title: 'Volontaires au pinceau',
      context: 'Dans la Drôme, les arboriculteurs demandent des bras pour polliniser les vergers à la main. Des milliers de citadins se proposent, mais il faut les former, les loger et les assurer.',
      choices: [
        c('organiser', 'Organiser une grande mobilisation de volontaires', [g(5, -3, 4), s('energy', -3)], 'Des trains entiers de volontaires, pinceau à la main. Les cerisiers donneront, cette année.'),
        c('saisonniers', 'Laisser les exploitants payer des saisonniers', [g(2, 1, -2)], 'Les grandes exploitations s’en sortent. Les petites, non.'),
      ],
    }),
  },
  {
    tag: 'abeilles_prix', weight: 1, eligible: on('abeilles', 1, 2, 3),
    build: () => ({
      title: 'Trente euros le kilo de cerises',
      context: 'Le kilo de cerises dépasse trente euros, les pommes deviennent un luxe. Une émission vous invite à répondre en direct aux questions des téléspectateurs, et l’animateur aime les questions qui piquent.',
      choices: [
        { ...c('repondre', 'Répondre aux questions en direct', [g(1, -2, 6)], 'Vous expliquez, chiffres à l’appui, ce que l’État fait. Le pays respire un peu.'), play: 'interview_piege' },
        c('decliner', 'Décliner l’invitation', [g(0, 2, -3)], 'Une chaise vide sur le plateau. L’animateur s’en donne à cœur joie.'),
      ],
    }),
  },
  {
    tag: 'abeilles_pesticides', weight: 1, eligible: on('abeilles', 2, 3),
    build: () => ({
      title: 'Interdire les pesticides ?',
      context: 'Les apiculteurs réclament l’interdiction immédiate de trois pesticides. Le lobby agricole promet des tracteurs sur les Champs-Élysées si le texte passe.',
      choices: [
        { ...c('moratoire', 'Négocier un moratoire avec les syndicats agricoles', [g(5, -3, 3)], 'Un moratoire de deux ans, des aides à la transition : les tracteurs restent dans les cours de ferme.'), play: 'negociation_syndicale' },
        c('decret', 'Interdire par décret, tout de suite', [g(5, -2, -5)], 'Les pesticides sont interdits. Les tracteurs bloquent Paris trois jours.'),
        c('attendre', 'Attendre les conclusions scientifiques', [g(0, 4, -1)], 'Les scientifiques travaillent. Les ruches restent vides.'),
      ],
    }),
  },
  {
    tag: 'abeilles_essaim', weight: 1, eligible: on('abeilles', 3, 4),
    build: () => ({
      title: 'Un essaim dans les Cévennes',
      context: 'Dans une vallée isolée des Cévennes, un apiculteur a trouvé un essaim sauvage en pleine santé. Les généticiens veulent l’étudier ; les apiculteurs veulent le multiplier tout de suite.',
      choices: [
        c('proteger', 'Protéger la vallée et multiplier l’essaim avec prudence', [g(6, -4, 2)], 'Des essaims filles sont confiés à des apiculteurs de tout le pays. Ils tiennent.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Les premières reines élevées en laboratoire dépérissent ; l’essaim cévenol, affaibli, doit être laissé en paix.' } }),
        c('vendre', 'Laisser l’apiculteur vendre ses reines au plus offrant', [g(1, 3, -2)], 'Les reines partent à prix d’or vers l’étranger.'),
      ],
    }),
  },
  // La ruée vers l'or
  {
    tag: 'or_concessions', weight: 1, eligible: on('or', 0, 1),
    build: () => ({
      title: 'La bataille des piquets',
      context: 'Des centaines de chercheurs d’or plantent des piquets partout, se disputent les berges et réclament des titres de propriété. Le maire de Valcrouse est débordé.',
      choices: [
        c('registre', 'Créer un registre public des concessions', [g(5, -3, 2)], 'Un bureau ouvre dans la salle des fêtes. Chaque piquet a désormais un nom et un numéro.'),
        c('premier', 'Laisser jouer la règle du premier arrivé', [g(-1, 4, -2)], 'Le premier arrivé est souvent le plus matinal, et le plus têtu. La tension monte sur les berges.'),
      ],
    }),
  },
  {
    tag: 'or_mercure', weight: 1, eligible: on('or', 1, 2),
    build: () => ({
      title: 'Du mercure dans le Gardon',
      context: 'Des orpailleurs utilisent du mercure pour séparer l’or. Les truites meurent dans le Gardon, et des écologistes s’enchaînent aux châtaigniers de Valcrouse.',
      choices: [
        { ...c('concertation', 'Interdire le mercure et réunir orpailleurs et écologistes', [g(5, -3, 3)], 'Interdiction, contrôles, batées à l’eau claire : orpailleurs et écologistes signent une charte de la rivière.'), play: 'consultation' },
        c('fermer_yeux', 'Fermer les yeux : l’économie locale décolle', [g(0, 4, -3)], 'Les rivières se troublent. Les pêcheurs, eux, ont compris.'),
      ],
    }),
  },
  {
    tag: 'or_clandestins', weight: 1, eligible: on('or', 2, 3),
    build: () => ({
      title: 'Les orpailleurs de l’ombre',
      context: 'Dans les vallées voisines, des réseaux d’orpaillage clandestin exploitent des chantiers sauvages la nuit et revendent l’or à l’étranger. Gendarmes et douaniers proposent une grande opération.',
      choices: [
        c('operation', 'Lancer l’opération avec la gendarmerie et les douanes', [g(6, -5, 1)], 'En une nuit, quarante chantiers sauvages sont démantelés sans incident. L’or saisi rejoint les coffres de la Banque de France.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Les réseaux avaient été prévenus : les chantiers sont vides, et l’or a déjà passé la frontière.' } }),
        c('surveiller', 'Se contenter de surveiller', [g(1, 3, 0)], 'Les rapports s’accumulent. Les chantiers aussi.'),
      ],
    }),
  },
  {
    tag: 'or_saloons', weight: 1, eligible: on('or', 2, 3, 4),
    build: () => ({
      title: 'Valcrouse, ville champignon',
      context: 'Valcrouse compte désormais trois « saloons », une salle de jeux clandestine et une boutique de batées ouverte jour et nuit. Les habitants de toujours demandent qu’on leur rende leur village.',
      choices: [
        { ...c('fete', 'Organiser une grande fête pour réconcilier anciens et nouveaux venus', [g(2, -2, 6)], 'Bal, châtaignes grillées et concours de batée : pour un soir, Valcrouse redevient un village.'), play: 'fete_village' },
        c('arrete', 'Fermer les saloons par arrêté', [g(3, 1, -3)], 'Les saloons ferment. Ils rouvrent le lendemain sous le nom de « salons de thé ».'),
        c('laisser', 'Laisser faire : c’est folklorique', [g(-1, 4, 1)], 'Les touristes adorent. Les anciens, beaucoup moins.'),
      ],
    }),
  },
  {
    tag: 'or_compagnie', weight: 1, eligible: on('or', 3, 4),
    build: () => ({
      title: 'L’offre de la compagnie',
      context: 'Une compagnie minière étrangère propose de racheter tout le filon : des milliards pour l’État, une mine à ciel ouvert pour la vallée. Les spéculateurs applaudissent, les Cévenols blêmissent.',
      choices: [
        { ...c('fonds', 'Chiffrer un fonds public d’exploitation raisonnée', [g(6, -3, 3)], 'Un fonds public, des prélèvements limités, une part pour chaque commune : votre plan tient la route, et la vallée respire.'), play: 'chiffrage' },
        c('vendre', 'Accepter l’offre', [g(3, 2, -6), { kind: 'economy', deficit: -0.1 }], 'Les milliards tombent. Les bulldozers aussi.'),
      ],
    }),
  },
  // Le miroir
  {
    tag: 'miroir_ambassade', weight: 1, eligible: on('miroir', 0, 1),
    build: () => ({
      title: 'Une ambassade dans la cave',
      context: 'Le gouvernement de l’autre France propose d’ouvrir une ambassade dans la cave de Bourges, avec un ambassadeur en perruque poudrée. Il faut inventer le protocole d’une relation diplomatique sans précédent.',
      choices: [
        { ...c('protocole', 'Rédiger vous-même le protocole des deux France', [g(5, -3, 3)], 'Révérences, poignées de main, cidre au thym : la première rencontre officielle est un modèle du genre.'), play: 'protocole' },
        c('refuser', 'Refuser : on ne reconnaît pas un reflet', [g(1, 3, -3)], 'L’ambassadeur repart en soupirant. De l’autre côté, la presse parle de « mépris républicain ».'),
      ],
    }),
  },
  {
    tag: 'miroir_batteries', weight: 1, eligible: on('miroir', 1, 2),
    build: () => ({
      title: 'La batterie qui ne s’use jamais',
      context: 'Des industriels veulent importer de l’autre France une invention étonnante : une batterie au sel qui ne s’use jamais. Les physiciens craignent qu’on ne comprenne pas ce qu’on rapporte.',
      choices: [
        c('commission', 'Encadrer les échanges par une commission scientifique', [g(5, -3, 1)], 'Chaque objet est étudié avant de passer. La batterie au sel est autorisée, et elle fonctionne.'),
        c('libre', 'Laisser les industriels importer librement', [g(0, 4, 2), { kind: 'economy', growth: 0.1 }], 'Les batteries au sel se vendent par millions. Certaines se mettent à fredonner la nuit.'),
      ],
    }),
  },
  {
    tag: 'miroir_double', weight: 1, eligible: on('miroir', 2, 3),
    build: () => ({
      title: 'Votre double',
      context: 'Votre double demande un rendez-vous. Même visage, même voix, mais une autre vie : de l’autre côté, vous tenez une pâtisserie réputée et n’avez jamais fait de politique. Les caméras attendent devant la cave.',
      choices: [
        c('diner', 'Dîner discrètement avec votre double, sans caméras', [g(3, -3, 4), s('stress', -3)], 'Vous parlez toute la nuit. Au matin, vous en savez un peu plus sur vous-même, et vous repartez avec une excellente recette de tarte.'),
        c('television', 'Faire du rendez-vous un événement télévisé', [g(0, 3, 2), s('popularity', 2)], 'Audience record. Le pays entier compare désormais tout le monde à son double.'),
      ],
    }),
  },
  {
    tag: 'miroir_comparaisons', weight: 1, eligible: on('miroir', 2, 3, 4),
    build: () => ({
      title: 'Et si c’était mieux là-bas ?',
      context: 'Une émission compare chaque soir les deux France : leurs trains, leurs impôts, leurs fromages. Un sondage affirme qu’un Français sur trois aimerait « passer de l’autre côté ».',
      choices: [
        { ...c('verifier', 'Démonter les comparaisons trompeuses en direct', [g(1, -3, 5)], 'Leurs trains sont ponctuels, mais ils n’ont jamais inventé la Sécurité sociale. Le pays respire.'), play: 'factcheck_direct' },
        c('laisser', 'Laisser dire : ce n’est que de la télévision', [g(0, 4, -3)], 'Les audiences grimpent. Le vertige aussi.'),
      ],
    }),
  },
  {
    tag: 'miroir_retour', weight: 1, eligible: on('miroir', 4),
    build: () => ({
      title: 'Le grand retour',
      context: 'Le miroir se trouble et rétrécit chaque jour. Des centaines de voyageurs des deux côtés doivent rentrer chez eux avant qu’il ne se referme. Il faut organiser le grand retour.',
      choices: [
        c('organiser', 'Organiser le grand retour, minute par minute', [g(5, -4, 2)], 'Une file ordonnée, des valises, des adieux émus : chacun rentre chez soi à temps.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -3)], failureNews: 'Le passage rétrécit plus vite que prévu : des voyageurs doivent patienter des jours avant qu’il ne se rouvre un instant.' } }),
        c('debrouiller', 'Laisser chacun se débrouiller', [g(0, 4, -2)], 'Bousculades de valises, cris, réclamations : le retour tourne au vaudeville.'),
      ],
    }),
  },
  // Les apparitions
  {
    tag: 'fantomes_files', weight: 1, eligible: on('fantomes', 0, 1, 2),
    build: () => ({
      title: 'Huit heures de queue',
      context: 'Devant Versailles, la file d’attente s’étire jusqu’à la gare. Les touristes campent, les camelots vendent des « kits anti-fantômes », et le château menace de fermer ses portes.',
      choices: [
        c('creneaux', 'Instaurer des créneaux réservés et des visites nocturnes encadrées', [g(5, -3, 2)], 'Réservations, lampes de poche et guides en costume : les nuits de Versailles deviennent une affaire bien réglée.'),
        c('fermer', 'Fermer les châteaux jusqu’à nouvel ordre', [g(2, 2, -4)], 'Les grilles se ferment. La foule reste devant, à guetter les fenêtres.'),
        c('laisser', 'Laisser faire : c’est bon pour le tourisme', [g(-1, 4, 1)], 'La file atteint la gare suivante.'),
      ],
    }),
  },
  {
    tag: 'fantomes_louvre', weight: 1, eligible: on('fantomes', 1, 2, 3),
    build: () => ({
      title: 'Le mousquetaire du Louvre',
      context: 'Le mousquetaire du Louvre est apparu en direct pendant le journal de 20 heures, a soulevé son chapeau et s’est effacé. Les chaînes du monde entier réclament votre réaction, et quelques journalistes rêvent de vous piéger.',
      choices: [
        { ...c('humour', 'Répondre avec humour et sang-froid', [g(1, -2, 6)], '« Il a de meilleures manières que certains de mes collègues. » Votre phrase fait le tour du monde.'), play: 'interview_piege' },
        c('esquiver', 'Refuser de commenter', [g(0, 3, -2)], 'Votre silence est commenté plus que le mousquetaire.'),
      ],
    }),
  },
  {
    tag: 'fantomes_mediums', weight: 1, eligible: on('fantomes', 2, 3),
    build: () => ({
      title: 'Les marchands d’au-delà',
      context: 'Des médiums vendent des « séances de contact » à cinq cents euros, et une application promet de vous mettre en relation avec vos ancêtres. Les associations de consommateurs s’alarment.',
      choices: [
        c('poursuivre', 'Faire poursuivre les escroqueries', [g(4, -3, 2), s('credibility', 1)], 'Les séances frauduleuses ferment, l’application disparaît des boutiques en ligne. Les vrais curieux respirent.'),
        c('tolerer', 'Laisser chacun croire ce qu’il veut', [g(0, 4, -1)], 'Les séances affichent complet. Les ancêtres, eux, ne répondent pas.'),
      ],
    }),
  },
  {
    tag: 'fantomes_querelle', weight: 1, eligible: on('fantomes', 3),
    build: () => ({
      title: 'Science, foi et médiums',
      context: 'Physiciens, évêques et médiums s’invectivent sur tous les plateaux. On vous propose d’organiser un grand dîner au Collège de France pour apaiser la querelle.',
      choices: [
        { ...c('diner', 'Organiser le dîner, plan de table compris', [g(4, -3, 5)], 'Un physicien entre un évêque et une médium : à la fin du dîner, ils rient ensemble. Personne n’a changé d’avis, tout le monde s’est calmé.'), play: 'plan_table' },
        c('abstenir', 'Ne pas s’en mêler', [g(0, 3, -3)], 'La querelle s’envenime. Les fantômes, eux, ne prennent pas parti.'),
      ],
    }),
  },
  {
    tag: 'fantomes_chambord', weight: 1, eligible: on('fantomes', 4),
    build: () => ({
      title: 'Le dernier bal de Chambord',
      context: 'Le dernier grand bal est annoncé à Chambord. Un million de personnes veulent y assister. Il faut organiser l’accueil, la sécurité et la retransmission.',
      choices: [
        c('ecrans', 'Organiser une soirée maîtrisée, retransmise sur écrans géants', [g(5, -4, 4)], 'La foule regarde le bal sur des écrans géants dans le parc, en silence. Les danseurs s’inclinent vers elle avant de s’effacer.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -3)], failureNews: 'Les écrans géants tombent en panne au moment du bal ; la soirée tourne à la cohue, sans gravité, mais sous l’œil de toutes les caméras du monde.' } }),
        c('grilles', 'Ouvrir grand les grilles', [g(0, 4, 2)], 'Tout le monde entre. Personne ne voit rien.'),
      ],
    }),
  },
  // La grève des robots
  {
    tag: 'robots_hopitaux', weight: 1, eligible: on('robots', 0, 1),
    build: () => ({
      title: 'Les hôpitaux sans bras',
      context: 'Les robots qui portaient les plateaux, désinfectaient les chambres et aidaient à lever les patients se sont arrêtés. Les soignants n’en peuvent plus, et les urgences réclament du renfort.',
      choices: [
        c('renforts', 'Mobiliser étudiants, réservistes et retraités du soin', [g(5, -3, 2), s('energy', -3)], 'Des milliers de volontaires en blouse prennent le relais. Les soignants respirent.'),
        c('attendre', 'Attendre que les constructeurs trouvent une parade', [g(-1, 4, 0)], 'Les constructeurs promettent un correctif pour la semaine prochaine. Les urgences attendent.'),
      ],
    }),
  },
  {
    tag: 'robots_manifeste', weight: 1, eligible: on('robots', 1, 2),
    build: () => ({
      title: 'Le manifeste des machines',
      context: 'Le Syndicat des travailleurs mécaniques publie un manifeste d’une politesse exquise et demande à être reçu. Les constructeurs exigent qu’on ne discute pas « avec des grille-pain ».',
      choices: [
        { ...c('recevoir', 'Recevoir la délégation des robots', [g(5, -3, 3)], 'Trois robots d’entrepôt s’assoient, très droits, et lisent leurs revendications. La séance dure six heures, et personne ne hausse le ton.'), play: 'negociation_syndicale' },
        c('refuser', 'Refuser : on ne négocie pas avec des machines', [g(1, 3, -3)], 'Les constructeurs applaudissent. Les robots, eux, restent assis.'),
      ],
    }),
  },
  {
    tag: 'robots_vote', weight: 1, eligible: on('robots', 2, 3),
    build: () => ({
      title: 'Le vote débranché',
      context: 'À l’Assemblée, le vote d’un amendement sur le « statut des machines » tourne au fiasco : des boîtiers ont été débranchés, de fausses consignes circulent dans les travées. Robots, lobbyistes ou députés farceurs ? Il faut trouver le saboteur avant de revoter.',
      choices: [
        { ...c('enqueter', 'Mener l’enquête vous-même', [g(5, -4, 2)], 'Le saboteur n’était pas un robot, mais un assistant payé par un constructeur. Le vote est refait dans le calme, et le débat assaini.'), play: 'enquete_sabotage' },
        c('accuser', 'Accuser les robots : c’est plus simple', [g(0, 4, -3)], 'Le pays se dresse contre les machines. Les machines, elles, ne bronchent pas.'),
      ],
    }),
  },
  {
    tag: 'robots_philosophes', weight: 1, eligible: on('robots', 3),
    build: () => ({
      title: 'Une machine peut-elle faire grève ?',
      context: 'Philosophes, juristes et ingénieurs s’écharpent sur tous les plateaux. On vous propose d’ouvrir une consultation citoyenne pour trier les propositions, des plus sages aux plus farfelues.',
      choices: [
        { ...c('consulter', 'Organiser la consultation et en tirer des propositions', [g(4, -3, 5)], 'Le pays tranche lui-même : pas de droits de l’homme pour les machines, mais des devoirs pour ceux qui les possèdent. Le débat s’apaise.'), play: 'consultation' },
        c('philosophes', 'Laisser les philosophes trancher', [g(0, 3, -3)], 'Les philosophes ne tranchent rien. Ils sont ravis.'),
      ],
    }),
  },
  {
    tag: 'robots_signature', weight: 1, eligible: on('robots', 4),
    build: () => ({
      title: 'La signature',
      context: 'Un accord est sur la table : un fonds alimenté par les heures des machines, un jour de maintenance par semaine, une reprise immédiate. Les constructeurs hésitent, les robots attendent, et la signature doit avoir lieu en direct.',
      choices: [
        c('signer', 'Organiser une signature solennelle, minutée au millimètre', [g(5, -4, 3)], 'Un stylo pour les constructeurs, un stylet pour les robots : l’accord est signé sous les applaudissements, et les entrepôts se remettent en marche le soir même.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -3)], failureNews: 'Au moment de signer, un robot réclame une pause syndicale de dix minutes ; les constructeurs quittent la salle, vexés.' } }),
        c('constructeurs', 'Laisser les constructeurs régler ça entre eux', [g(0, 4, -2)], 'Les constructeurs proposent une mise à jour obligatoire. Les robots refusent poliment de l’installer.'),
      ],
    }),
  },
  // Le franc numérique
  {
    tag: 'monnaie_cantine', weight: 1, eligible: on('monnaie', 0, 1),
    build: () => ({
      title: 'La cantine payée en francs',
      context: 'Plusieurs mairies acceptent désormais le franc numérique pour la cantine et la piscine. Les comptables publics s’arrachent les cheveux : comment tenir des comptes dans une monnaie privée ?',
      choices: [
        c('circulaire', 'Rappeler que le service public se paie en euros, et accompagner les mairies', [g(5, -3, 1), s('energy', -3)], 'Une circulaire claire, une ligne directe pour les comptables : les mairies reviennent à l’euro sans drame.'),
        c('innover', 'Laisser les mairies innover', [g(-1, 4, 1)], 'Trois cents mairies suivent le mouvement. La Cour des comptes prend des notes.'),
      ],
    }),
  },
  {
    tag: 'monnaie_banques', weight: 1, eligible: on('monnaie', 1, 2),
    build: () => ({
      title: 'Les banques prennent l’eau',
      context: 'Les dépôts quittent les banques par milliards. Les banquiers réclament un sauvetage, les associations d’épargnants une garantie, et il faut chiffrer ce que coûterait chaque option avant l’ouverture des marchés.',
      choices: [
        { ...c('chiffrer', 'Chiffrer vous-même une garantie des dépôts', [g(5, -3, 2)], 'Une garantie claire, limitée, chiffrée au centime : la fuite ralentit dès le lendemain.'), play: 'chiffrage' },
        c('banquiers', 'Laisser les banquiers se débrouiller', [g(0, 4, -2)], 'Les banquiers se débrouillent : ils augmentent leurs frais. La fuite s’accélère.'),
      ],
    }),
  },
  {
    tag: 'monnaie_referendum', weight: 1, eligible: on('monnaie', 2, 3),
    build: () => ({
      title: 'Le référendum de l’euro',
      context: 'Des pétitions géantes réclament un référendum : « Voulez-vous que l’euro reste la seule monnaie légale ? » Le gouvernement l’accepte. Il faut mener la campagne du Oui, région par région, face aux nostalgiques du franc.',
      choices: [
        { ...c('campagne', 'Mener la campagne du Oui', [g(5, -4, 3)], 'Meetings, porte-à-porte, débats sur les marchés : le Oui l’emporte, et le pays se souvient de ce qu’est sa monnaie.'), play: 'campagne_referendum' },
        c('retrait', 'Rester en retrait de la campagne', [g(0, 4, -3)], 'La campagne se fait sans vous. Les nostalgiques du franc font salle comble.'),
      ],
    }),
  },
  {
    tag: 'monnaie_depots', weight: 1, eligible: on('monnaie', 3),
    build: () => ({
      title: 'Où dorment les dépôts ?',
      context: 'Une lanceuse d’alerte révèle que Monéa place les dépôts de ses clients dans des fonds spéculatifs. Les épargnants s’affolent, et Bastien Lorrel jure à la télévision que tout est sous contrôle.',
      choices: [
        c('audit', 'Exiger un audit immédiat et des réserves en euros', [g(6, -5, 1)], 'Les auditeurs débarquent chez Monéa le soir même. Les réserves sont reconstituées, et la panique s’éloigne.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Monéa traîne des pieds, l’audit fuite à moitié, et la rumeur d’une faillite fait le tour des réseaux.' } }),
        c('croire', 'Croire Bastien Lorrel sur parole', [g(1, 3, -1)], 'Il est très convaincant. Les épargnants, un peu moins.'),
      ],
    }),
  },
  {
    tag: 'monnaie_conseil', weight: 1, eligible: on('monnaie', 4),
    build: () => ({
      title: 'Le Conseil européen de la monnaie',
      context: 'Les Vingt-Sept se réunissent pour décider du sort des monnaies privées. Certains veulent tout interdire, d’autres tout permettre, et l’on attend de la France qu’elle propose une voie.',
      choices: [
        { ...c('negocier', 'Négocier un euro numérique public, distribué aussi par les licornes', [g(4, -3, 5)], 'Au petit matin, un compromis : l’euro numérique sera public, et les applications privées pourront le distribuer.'), play: 'sommet_ue' },
        c('suivre', 'Se ranger à l’avis majoritaire', [g(1, 2, -2)], 'L’avis majoritaire est flou. La position française aussi.'),
      ],
    }),
  },
  // L'héritage Delorme
  {
    tag: 'heritage_bonheur', weight: 1, eligible: on('heritage', 0, 1),
    build: () => ({
      title: 'Le ministère du Bonheur',
      context: 'La clause 4 exige un « ministère du Bonheur, avec budget et fanfare ». Les éditorialistes ricanent, les psychologues s’enthousiasment, et il faut décider ce qu’on y mettra vraiment.',
      choices: [
        c('serieux', 'En faire une petite délégation sérieuse : solitude, loisirs, bien-être au travail', [g(5, -3, 2), s('energy', -3)], 'Trois fonctionnaires, une fanfare municipale et un vrai programme contre la solitude des aînés : la clause est tenue, sans ridicule.'),
        c('palais', 'Lui offrir un vrai ministère, palais compris', [g(1, 3, 2)], 'Le ministère du Bonheur s’installe dans un hôtel particulier. Ses premières factures font la une.'),
      ],
    }),
  },
  {
    tag: 'heritage_tgv', weight: 1, eligible: on('heritage', 1, 2),
    build: () => ({
      title: 'Un TGV pour quatre cents habitants',
      context: 'La clause 9 exige un TGV jusqu’à Vabre-l’Ancien. Les ingénieurs l’estiment à trois milliards, le village s’enthousiasme, les contribuables s’étranglent. Il faudrait chiffrer une alternative que le notaire puisse accepter.',
      choices: [
        { ...c('chiffrer', 'Chiffrer une alternative : petite ligne rénovée et autorail aux couleurs de Delorme', [g(5, -3, 2)], 'Une ligne régionale rouverte, un autorail repeint en bleu jouet : le notaire juge la clause « honorée dans son esprit ».'), play: 'chiffrage_mesure' },
        c('tgv', 'Lancer le TGV, coûte que coûte', [g(2, 3, -3), { kind: 'economy', deficit: 0.1 }], 'Les géomètres arrivent à Vabre-l’Ancien. Les vaches les regardent passer.'),
      ],
    }),
  },
  {
    tag: 'heritage_joyaux', weight: 1, eligible: on('heritage', 2, 3),
    build: () => ({
      title: 'Les joyaux de la famille Delorme',
      context: 'Pendant l’inventaire nocturne du château Delorme, la collection de joyaux de la famille disparaît. Héritiers, domestiques et experts se soupçonnent les uns les autres, et le notaire refuse d’avancer tant que le coupable court.',
      choices: [
        { ...c('enquete', 'Mener l’enquête au château', [g(5, -4, 2)], 'Le coupable était un expert en bijoux engagé par l’un des neveux. Les joyaux rejoignent l’inventaire, et le neveu son avocat.'), play: 'enquete_joyaux' },
        c('police', 'Laisser la police s’en charger, à son rythme', [g(0, 4, -2)], 'L’enquête suit son cours. Les procès aussi.'),
      ],
    }),
  },
  {
    tag: 'heritage_bourree', weight: 1, eligible: on('heritage', 3),
    build: () => ({
      title: 'Le codicille sous le parquet',
      context: 'Un codicille retrouvé sous une lame de parquet exige qu’« un élu de la République danse la bourrée sur la place de Vabre-l’Ancien ». Les héritiers y voient la preuve que tout ceci est une farce ; le village prépare déjà le bal.',
      choices: [
        { ...c('fete', 'Organiser la fête au village, bourrée comprise', [g(2, -3, 6)], 'Accordéon, aligot et une bourrée un peu raide mais sincère : la photo fait le tour du pays, et le juge déclare le codicille « honoré ».'), play: 'fete_village' },
        c('contester', 'Contester le codicille devant le juge', [g(2, 2, -3)], 'Le juge vous donne raison. Le village, lui, vous en veut.'),
      ],
    }),
  },
  {
    tag: 'heritage_coffre', weight: 1, eligible: on('heritage', 4),
    build: () => ({
      title: 'L’ouverture du coffre',
      context: 'Le coffre d’Auguste Delorme sera ouvert devant le notaire, les héritiers, les caméras et la moitié du village. Personne ne sait ce qu’il contient. Il faut organiser la cérémonie.',
      choices: [
        c('ceremonie', 'Organiser une cérémonie digne, retransmise sans tapage', [g(5, -4, 3)], 'Le coffre s’ouvre sur une enveloppe, une toupie en bois et une dernière clause. Le pays entier sourit.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -3)], failureNews: 'La serrure du coffre résiste deux heures en direct ; un serrurier finit par l’ouvrir sous les rires du pays entier.' } }),
        c('huis_clos', 'Ouvrir le coffre à huis clos', [g(1, 3, -3)], 'Le coffre est ouvert sans témoins. Les héritiers crient au complot.'),
      ],
    }),
  },
  // Le moteur à eau
  {
    tag: 'moteur_camp', weight: 1, eligible: on('moteur', 0, 1),
    build: () => ({
      title: 'Le camp de Montbief',
      context: 'Des milliers de passionnés campent devant le garage, des camping-cars bloquent la route du col, et des camelots vendent des « kits de conversion à l’eau » à neuf cents euros.',
      choices: [
        c('organiser', 'Organiser l’accueil et interdire la vente de kits', [g(5, -3, 2), s('energy', -3)], 'Parkings, navettes et saisies de kits : Montbief retrouve son calme, et les camelots leurs factures.'),
        c('laisser', 'Laisser faire : ça fait vivre la vallée', [g(-1, 4, 0)], 'Les kits se vendent par milliers. Aucun ne fonctionne.'),
      ],
    }),
  },
  {
    tag: 'moteur_fuite', weight: 1, eligible: on('moteur', 1, 2),
    build: () => ({
      title: 'Les plans ont fuité',
      context: 'Les plans du moteur, confiés au laboratoire d’essais, se retrouvent sur le bureau d’une compagnie pétrolière. Raymond Vuillemin crie au complot, et il n’a peut-être pas tort. Il faut trouver qui a fait fuiter le dossier.',
      choices: [
        { ...c('enquete', 'Mener l’enquête au laboratoire', [g(5, -4, 2)], 'La fuite venait d’un consultant de passage. Le laboratoire est blanchi, et la confiance revient dans les essais.'), play: 'enquete_fuite' },
        c('rumeurs', 'Laisser courir les rumeurs', [g(0, 4, -3)], 'Les forums s’enflamment. Chaque ingénieur devient suspect.'),
      ],
    }),
  },
  {
    tag: 'moteur_verdicts', weight: 1, eligible: on('moteur', 2, 3),
    build: () => ({
      title: 'Deux essais, deux verdicts',
      context: 'Le laboratoire public conclut à une supercherie, un institut privé à une révolution. Chaque camp exige qu’on le croie. Un journaliste vous invite à vous expliquer en direct, et il a préparé ses questions pièges.',
      choices: [
        { ...c('expliquer', 'Expliquer en direct comment on vérifie une invention', [g(2, -3, 5)], 'Protocoles, double aveugle, témoins indépendants : vous parlez de méthode plutôt que de miracle. Le pays écoute.'), play: 'interview_piege' },
        c('trancher', 'Trancher en faveur du laboratoire public', [g(3, 2, -3)], 'Les croyants crient à la censure. Le camp de Montbief double de volume.'),
      ],
    }),
  },
  {
    tag: 'moteur_petroliers', weight: 1, eligible: on('moteur', 3),
    build: () => ({
      title: 'La contre-offensive des pétroliers',
      context: 'Les compagnies pétrolières financent des études, des publicités et des « experts indépendants » qui ne le sont guère. Une association réclame la transparence sur le financement de toutes les études.',
      choices: [
        c('transparence', 'Imposer la transparence des financements de toutes les études', [g(6, -5, 1)], 'Chaque étude affiche désormais qui l’a payée. Les experts de complaisance disparaissent des plateaux.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Un expert que vous citiez en exemple se révèle financé par un pétrolier ; les croyants exultent.' } }),
        c('neutre', 'Rester neutre dans la querelle', [g(1, 3, -1)], 'Vous restez neutre. La querelle, elle, ne l’est pas.'),
      ],
    }),
  },
  {
    tag: 'moteur_essai', weight: 1, eligible: on('moteur', 4),
    build: () => ({
      title: 'L’essai public',
      context: 'L’essai public aura lieu sur une piste du Jura, devant des ingénieurs du monde entier et dix millions de téléspectateurs. Il faut annoncer le protocole aux Français, et y présider.',
      choices: [
        { ...c('protocole', 'Présenter un protocole irréprochable, et s’y tenir', [g(5, -4, 3)], 'Réservoir scellé, témoins croisés, caméras partout : quel que soit le verdict, personne ne pourra le contester.'), play: 'allocution' },
        c('spectacle', 'En faire un grand spectacle télévisé', [g(0, 4, 3)], 'Paillettes, compte à rebours et animateur vedette : le moteur tousse, la télévision exulte.'),
      ],
    }),
  },
  // Le sommet sans fin
  {
    tag: 'sommet_dejeuner', weight: 1, eligible: on('sommet', 0, 1),
    build: () => ({
      title: 'La querelle du déjeuner',
      context: 'Le sommet bute sur une question cruciale : le déjeuner. Trois continents, quatre régimes alimentaires et une délégation qui ne mange qu’après le coucher du soleil. Il faut un plan de table qui ne fâche personne.',
      choices: [
        { ...c('plan', 'Composer vous-même le plan de table', [g(5, -3, 2)], 'Le déjeuner est servi à l’heure, et deux délégations brouillées découvrent une passion commune pour le comté.'), play: 'plan_table' },
        c('buffet', 'Servir un buffet, chacun pour soi', [g(-1, 4, 0)], 'Le buffet tourne à l’incident diplomatique devant le plateau de fromages.'),
      ],
    }),
  },
  {
    tag: 'sommet_convois', weight: 1, eligible: on('sommet', 1, 2),
    build: () => ({
      title: 'Paris en convoi',
      context: 'Les convois officiels bloquent Paris trois fois par jour. Les taxis sont furieux, les livreurs aussi, et un bus de touristes a passé deux heures derrière une délégation qui cherchait une pharmacie de garde.',
      choices: [
        c('navettes', 'Créer des couloirs diplomatiques et des navettes communes', [g(4, -3, 4), s('energy', -3)], 'Les délégations voyagent désormais en navettes électriques partagées. Certaines s’y adressent la parole pour la première fois.'),
        c('tolerer', 'Laisser circuler les convois', [g(0, 4, -3)], 'Les sirènes hurlent. Les Parisiens aussi.'),
      ],
    }),
  },
  {
    tag: 'sommet_virgule', weight: 1, eligible: on('sommet', 2, 3),
    build: () => ({
      title: 'La virgule de l’article 12',
      context: 'Deux délégations ne se parlent plus depuis un désaccord sur une virgule de l’article 12. Pendant la réception à l’ambassade de l’une d’elles, il faudrait déposer sur le bureau de l’ambassadeur une proposition de compromis, sans que personne ne sache d’où elle vient.',
      choices: [
        { ...c('glisser', 'Vous charger vous-même de déposer le compromis', [g(5, -4, 2)], 'Le lendemain, l’ambassadeur propose « son » compromis. La virgule est déplacée d’un mot, et les deux délégations se serrent la main.'), play: 'infiltration_ambassade' },
        c('attendre', 'Attendre qu’ils se réconcilient', [g(0, 4, -2)], 'Ils ne se réconcilient pas. Ils se brouillent même sur l’article 13.'),
      ],
    }),
  },
  {
    tag: 'sommet_parisiens', weight: 1, eligible: on('sommet', 3),
    build: () => ({
      title: 'Rendez-nous Paris',
      context: 'Une pétition « Rendez-nous Paris » dépasse le million de signatures. Les restaurateurs, eux, n’ont jamais fait d’aussi bonnes affaires. Il faut parler aux Parisiens sans froisser les délégations.',
      choices: [
        { ...c('allocution', 'Parler aux Parisiens, avec humour et franchise', [g(2, -2, 6)], '« Ils partiront, je vous le promets. Peut-être même avant Noël. » Paris rit, et patiente encore un peu.'), play: 'allocution' },
        c('ignorer', 'Ignorer la pétition', [g(0, 3, -4)], 'La pétition atteint deux millions de signatures. Une délégation la signe par solidarité.'),
      ],
    }),
  },
  {
    tag: 'sommet_aube', weight: 1, eligible: on('sommet', 4),
    build: () => ({
      title: 'La vraie dernière nuit',
      context: 'Les chefs de délégation acceptent une ultime nuit de négociations, sans téléphone ni caméra. Il faut arracher le communiqué final, article par article, avant l’aube.',
      choices: [
        { ...c('negocier', 'Mener la négociation jusqu’à l’aube', [g(5, -4, 3)], 'À six heures du matin, le dernier crochet saute. Des diplomates épuisés s’applaudissent dans la galerie des Glaces.'), play: 'sommet_g20' },
        c('sherpas', 'Laisser les sherpas négocier', [g(1, 3, -1)], 'Les sherpas négocient. Ils réservent aussi leurs vacances, sur place.'),
      ],
    }),
  },
  // L'homme des glaces
  {
    tag: 'degel_chamonix', weight: 1, eligible: on('degel', 0, 1),
    build: () => ({
      title: 'Les caméras de Chamonix',
      context: 'Des centaines de journalistes et de curieux campent devant l’hôpital de Chamonix. Un drone a filmé Aristide à sa fenêtre, en chemise de nuit. Les médecins réclament du calme.',
      choices: [
        c('perimetre', 'Instaurer un périmètre et un bulletin de santé quotidien', [g(5, -3, 2), s('energy', -3)], 'Un bulletin chaque midi, et plus un drone au-dessus du toit : Aristide dort enfin.'),
        c('laisser', 'Laisser faire : le monde a le droit de savoir', [g(-1, 4, 1)], 'Le monde sait tout. Aristide ne dort plus.'),
      ],
    }),
  },
  {
    tag: 'degel_langue', weight: 1, eligible: on('degel', 1, 2),
    build: () => ({
      title: 'Le français de 1923',
      context: 'Aristide accepte sa première interview. Mais son français de 1923, semé de mots savoyards et d’expressions oubliées, déroute les journalistes. Il vous demande de l’accompagner, et de traduire.',
      choices: [
        { ...c('traduire', 'Traduire et accompagner l’entretien', [g(4, -3, 4)], 'Ses mots sur la montagne, la patience et la parole donnée émeuvent tout le pays, et personne ne peut les déformer.'), play: 'interprete' },
        c('seul', 'Le laisser se débrouiller seul', [g(0, 4, -1)], 'Ses phrases sont mal comprises, coupées, détournées. Des slogans naissent.'),
      ],
    }),
  },
  {
    tag: 'degel_marchands', weight: 1, eligible: on('degel', 2, 3),
    build: () => ({
      title: 'Les marchands de légende',
      context: 'Agents, publicitaires et partis se disputent Aristide : contrats d’édition, tasses à son effigie, slogans « Chavanne 1923 ». Lui ne comprend pas ce qu’on lui fait signer.',
      choices: [
        c('conseil', 'Lui trouver un avocat et un conseil de confiance', [g(6, -5, 1)], 'Une avocate de Chambéry relit chaque contrat. Les marchands repartent bredouilles, et Aristide garde son nom.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Le conseil est accusé de vouloir confisquer Aristide ; par défi, il signe un contrat de tasses à son effigie.' } }),
        c('libre', 'Le laisser libre de ses choix', [g(1, 3, 0)], 'Il est libre. Il signe tout, très poliment.'),
      ],
    }),
  },
  {
    tag: 'degel_partielle', weight: 1, eligible: on('degel', 3),
    build: () => ({
      title: 'La législative partielle',
      context: 'Un mouvement qui se réclame d’Aristide présente un candidat à une législative partielle en Haute-Savoie, avec le portrait du vieux guide sur toutes les affiches. Aristide jure qu’il n’a rien demandé. Votre camp vous demande de mener campagne, canton par canton.',
      choices: [
        { ...c('campagne', 'Mener une campagne propre, sans jamais viser Aristide', [g(5, -4, 3)], 'Vous parlez de vallées, de glaciers et d’écoles, jamais contre lui. Le mouvement s’essouffle, et Aristide vous écrit une lettre de remerciement, à la plume.'), play: 'campagne_legislatives' },
        c('affiche', 'Poser à votre tour avec Aristide sur une affiche', [g(-2, 4, 2), s('popularity', 2)], 'L’affiche fait sourire. Aristide, beaucoup moins.'),
      ],
    }),
  },
  {
    tag: 'degel_discours', weight: 1, eligible: on('degel', 4),
    build: () => ({
      title: 'Le discours d’Aristide',
      context: 'Aristide veut annoncer sa décision au pays, depuis le refuge où il avait dormi sa dernière nuit, il y a un siècle. Il vous demande de l’aider à écrire son discours, avec ses mots à lui.',
      choices: [
        { ...c('ecrire', 'L’aider à écrire, sans rien lui souffler', [g(3, -3, 5)], '« J’ai dormi cent ans. Je ne vais pas passer ce qu’il me reste à me disputer. » Le pays entier a les yeux humides.'), play: 'plume_discours' },
        c('conseillers', 'Le confier à des conseillers en communication', [g(0, 3, -2)], 'Le discours est impeccable. Personne ne croit qu’il est de lui.'),
      ],
    }),
  },
  // La tour de deux mille mètres
  {
    tag: 'tour_ombre', weight: 1, eligible: on('tour', 0, 1),
    build: () => ({
      title: 'L’ombre de la tour',
      context: 'Les riverains de Puteaux et de Courbevoie découvrent les simulations : la tour plongera leurs rues dans l’ombre deux heures par jour. Une association réclame des compensations, et des centaines de propositions affluent.',
      choices: [
        { ...c('consultation', 'Organiser une consultation des riverains', [g(4, -3, 3)], 'Jardins sur les toits, éclairages chauds, une crèche au pied de la tour : les meilleures idées sont retenues, et l’ombre devient négociable.'), play: 'consultation' },
        c('progres', 'Rappeler que le progrès fait toujours un peu d’ombre', [g(0, 4, -2)], 'La formule fait le tour des réseaux. Les riverains font le tour des tribunaux.'),
      ],
    }),
  },
  {
    tag: 'tour_vent', weight: 1, eligible: on('tour', 1, 2),
    build: () => ({
      title: 'Deux mètres d’oscillation',
      context: 'À six cents mètres, la structure oscille de deux mètres par grand vent. Les grutiers refusent de monter, et les ingénieurs du consortium jurent que tout est parfaitement normal.',
      choices: [
        c('expertise', 'Imposer une contre-expertise et suspendre les travaux en hauteur', [g(6, -4, -1), s('energy', -3)], 'Un amortisseur de six cents tonnes est installé au sommet. La tour n’oscille plus que de vingt centimètres, et les grutiers remontent.'),
        c('confiance', 'Faire confiance au consortium', [g(-1, 4, 1)], 'Les travaux continuent. Par grand vent, une grue se bloque à mi-course, et la photo fait le tour du monde.'),
      ],
    }),
  },
  {
    tag: 'tour_rallonge', weight: 1, eligible: on('tour', 2, 3),
    build: () => ({
      title: 'La rallonge',
      context: 'Le consortium réclame quatre milliards d’argent public pour « ne pas laisser la France au milieu du gué ». Ministères, régions et collectivités se disputent ce qu’il faudrait sacrifier pour les trouver.',
      choices: [
        { ...c('arbitrer', 'Arbitrer vous-même, enveloppe par enveloppe', [g(5, -4, 1)], 'Une rallonge limitée, conditionnée à des économies du consortium : le chantier continue, et personne ne paie à l’aveugle.'), play: 'arbitrage_budgetaire' },
        c('payer', 'Payer : on ne s’arrête pas à mi-hauteur', [g(3, 4, 2), { kind: 'economy', deficit: 0.1 }], 'Les milliards tombent. Le consortium ajoute un étage panoramique.'),
      ],
    }),
  },
  {
    tag: 'tour_quartier', weight: 1, eligible: on('tour', 3),
    build: () => ({
      title: 'Le quartier au pied de la tour',
      context: 'Autour du chantier, tout un quartier est à redessiner : logements, écoles, parcs, transports. Le consortium voulait des parkings et des boutiques de luxe ; les maires vous confient le plan d’urbanisme.',
      choices: [
        { ...c('plan', 'Dessiner le quartier vous-même', [g(4, -3, 5)], 'Des logements, des écoles, un grand parc au pied de la tour : les riverains commencent à l’aimer.'), play: 'urbanisme_commune' },
        c('consortium', 'Laisser le consortium décider', [g(1, 3, -3)], 'Parkings et boutiques de luxe. Les riverains lancent une pétition.'),
      ],
    }),
  },
  {
    tag: 'tour_hauteur', weight: 1, eligible: on('tour', 4),
    build: () => ({
      title: 'La hauteur finale',
      context: 'Il faut fixer la hauteur finale et la cérémonie qui l’accompagnera. Le monde entier attend une image : la France fière, ou la France ruinée.',
      choices: [
        c('raisonnable', 'Arrêter la tour à une hauteur raisonnable et inaugurer le jardin suspendu', [g(5, -4, 3)], 'Mille deux cents mètres, un jardin dans les nuages et la Normandie à l’horizon : l’inauguration est un triomphe.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -3)], failureNews: 'Le jour de l’inauguration, un brouillard épais avale la tour jusqu’au cinquantième étage ; les caméras du monde entier filment une nappe grise.' } }),
        c('record', 'Exiger le record, coûte que coûte', [g(0, 5, 4)], 'La tour monte encore. Les comptes aussi.'),
      ],
    }),
  },
  // La cité flottante
  {
    tag: 'flottante_navettes', weight: 1, eligible: on('flottante', 0, 1),
    build: () => ({
      title: 'Les navettes du Vieux-Port',
      context: 'Des navettes rapides relient le Vieux-Port à Nautilia toutes les heures, sans le moindre contrôle des douanes. Les pêcheurs se plaignent des sillages, les douaniers de leur impuissance.',
      choices: [
        c('controles', 'Instaurer des contrôles douaniers au départ du port', [g(5, -3, 1), s('energy', -3)], 'Passeports, bagages, déclarations : les navettes partent moins vite, et les valises moins pleines.'),
        c('tourisme', 'Laisser circuler : c’est bon pour le tourisme', [g(-1, 4, 1)], 'Les navettes doublent leurs rotations. Les valises aussi.'),
      ],
    }),
  },
  {
    tag: 'flottante_reception', weight: 1, eligible: on('flottante', 1, 2),
    build: () => ({
      title: 'La réception sur Nautilia',
      context: 'Les fondateurs de Nautilia donnent une grande réception pour séduire diplomates et investisseurs. Vous y êtes invité. L’occasion de déposer sur le bureau du fondateur la mise en demeure de l’État, sans esclandre et sans être reconduit à la passerelle.',
      choices: [
        { ...c('deposer', 'Vous glisser jusqu’au bureau du fondateur', [g(5, -4, 2)], 'Le lendemain, le fondateur découvre la mise en demeure entre ses boîtes de cigares. Il rappelle le préfet maritime, beaucoup moins arrogant.'), play: 'infiltration_ambassade' },
        c('decliner', 'Décliner l’invitation', [g(0, 4, -1)], 'La réception a lieu sans vous. Trois ministres étrangers y trinquent.'),
      ],
    }),
  },
  {
    tag: 'flottante_dockers', weight: 1, eligible: on('flottante', 2, 3),
    build: () => ({
      title: 'Les dockers en colère',
      context: 'Ceux qui font tourner Nautilia travaillent sans contrat ni sécurité sociale. Les dockers de Marseille menacent de bloquer toutes les navettes par solidarité, et le port avec elles.',
      choices: [
        { ...c('negocier', 'Négocier avec les syndicats un plan pour les travailleurs de Nautilia', [g(4, -3, 5)], 'Inspection du travail embarquée, contrats de droit français pour quiconque vit à Marseille : les dockers lèvent le blocus.'), play: 'negociation_syndicale' },
        c('bloquer', 'Laisser les dockers bloquer', [g(1, 3, -4)], 'Le port est bloqué trois semaines. Nautilia fait venir ses vivres d’Espagne.'),
      ],
    }),
  },
  {
    tag: 'flottante_mistral', weight: 1, eligible: on('flottante', 3),
    build: () => ({
      title: 'Coup de mistral',
      context: 'Un coup de mistral fait gîter Nautilia, des modules se détachent, et les fondateurs appellent la Marine nationale à l’aide. Il faut décider des secours, et de ce qui suivra.',
      choices: [
        c('secours', 'Envoyer les secours, et une inspection de sécurité avec eux', [g(6, -5, 2)], 'Remorqueurs, plongeurs et inspecteurs : Nautilia est stabilisée, et ses fondateurs signent sans discuter le rapport de sécurité.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'L’orage passé, les fondateurs refusent l’inspection ; la Marine repart, et Nautilia fanfaronne.' } }),
        c('conditions', 'Exiger d’abord une reconnaissance de la loi française', [g(3, 2, -4)], 'Les fondateurs cèdent sous la pluie. Le pays trouve que vous avez marchandé les secours.'),
      ],
    }),
  },
  {
    tag: 'flottante_statut', weight: 1, eligible: on('flottante', 4),
    build: () => ({
      title: 'Le statut de Nautilia',
      context: 'Nautilia demande sa reconnaissance aux Nations unies. Il faut convaincre les partenaires européens de refuser, et proposer une autre voie.',
      choices: [
        { ...c('conseil', 'Porter la question au Conseil européen', [g(5, -4, 3)], 'Les Vingt-Sept refusent la reconnaissance et proposent un statut de port européen. Nautilia, isolée, accepte de négocier.'), play: 'sommet_ue' },
        c('attendre', 'Attendre le vote des Nations unies', [g(0, 4, -2)], 'Trois micro-États votent pour Nautilia. Les autres s’abstiennent poliment.'),
      ],
    }),
  },
  // Le gouvernement parallèle
  {
    tag: 'shadow_dimanches', weight: 1, eligible: on('shadow', 0, 1),
    build: () => ({
      title: 'Les barrières du dimanche',
      context: 'Une trentaine de maires ont fermé leurs centres-villes aux voitures le dimanche, sur « décret » du Gouvernement des Millions. Des habitants applaudissent, des commerçants protestent, et les préfets demandent des consignes.',
      choices: [
        c('cadre', 'Recevoir les maires un par un et leur proposer un cadre légal', [g(5, -3, 1), s('energy', -3)], 'Arrêtés municipaux en bonne et due forme, concertation avec les commerçants : les dimanches piétons deviennent ceux des maires, et plus ceux de l’application.'),
        c('laisser', 'Laisser faire : c’est leur commune', [g(-1, 4, 0)], 'Le soir même, le Gouvernement des Millions célèbre « sa » victoire en direct.'),
      ],
    }),
  },
  {
    tag: 'shadow_note', weight: 1, eligible: on('shadow', 1, 2),
    build: () => ({
      title: 'La note confidentielle',
      context: 'Le « ministre de l’Intérieur » de Sacha Merlin lit en direct une note confidentielle d’un vrai ministère, mot pour mot, devant trois millions de spectateurs. Quelqu’un, au cœur de l’État, renseigne le Gouvernement des Millions.',
      choices: [
        { ...c('enquete', 'Mener l’enquête vous-même', [g(5, -4, 2)], 'La fuite venait d’un jeune contractuel, fasciné par l’application. Il est muté sans bruit, et le Gouvernement des Millions perd sa meilleure source.'), play: 'enquete_fuite' },
        c('minimiser', 'Minimiser : une note sans importance', [g(0, 4, -2)], 'La note était importante. La semaine suivante, une autre fuite suit.'),
      ],
    }),
  },
  {
    tag: 'shadow_referendum', weight: 1, eligible: on('shadow', 2, 3),
    build: () => ({
      title: 'Le vote du soir contre le vote du dimanche',
      context: 'Pour reprendre la main, le gouvernement soumet à référendum une réforme de la participation : un droit de pétition renforcé et un référendum d’initiative citoyenne, encadré. Sacha Merlin appelle à voter non, « pour que le vote du soir reste libre ».',
      choices: [
        { ...c('campagne', 'Mener la campagne du Oui, région par région', [g(5, -4, 3)], 'Marchés, salles des fêtes, débats jusque sur la chaîne de Sacha Merlin : le Oui l’emporte, et le vote du dimanche reprend des couleurs.'), play: 'campagne_referendum' },
        c('retrait', 'Rester en retrait de la campagne', [g(0, 4, -3)], 'La campagne se fait sans vous. Le soir du scrutin, l’application revendique plus de votants que les urnes.'),
      ],
    }),
  },
  {
    tag: 'shadow_comptes', weight: 1, eligible: on('shadow', 3),
    build: () => ({
      title: 'Les comptes fantômes',
      context: 'Des chercheurs découvrent qu’une part des votes du soir provient de comptes automatisés, achetés en masse à l’étranger. Le révéler peut dégonfler le phénomène, ou passer pour une manœuvre du pouvoir.',
      choices: [
        c('publier', 'Publier l’expertise, données brutes à l’appui', [g(6, -5, 1)], 'Méthode, chiffres, code source : chacun peut vérifier. Même les fidèles de Sacha Merlin découvrent qu’ils votaient aux côtés de robots.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'L’expertise contient une erreur de calcul, repérée en direct par un « ministre » de l’application ; le pouvoir est accusé de manipulation.' } }),
        c('garder', 'Garder l’information pour plus tard', [g(1, 3, -1)], 'Plus tard, il est trop tard : l’information fuit par un autre canal, et l’on vous reproche de l’avoir cachée.'),
      ],
    }),
  },
  {
    tag: 'shadow_face', weight: 1, eligible: on('shadow', 4),
    build: () => ({
      title: 'Le face-à-face',
      context: 'Sacha Merlin vous défie : un débat en direct sur sa chaîne, la veille du « vote de confiance ». Vingt millions de spectateurs attendus, et des questions choisies par les internautes, parmi les plus retorses.',
      choices: [
        { ...c('debattre', 'Accepter le débat, et répondre sur le fond', [g(5, -4, 3)], 'Calme, précis, souriant : vous démontez trois « décrets » impossibles et saluez une idée juste. Sacha Merlin, beau joueur, finit par concéder qu’« un pays, ce n’est pas un sondage ».'), play: 'interview_piege' },
        c('refuser', 'Refuser : la République ne débat pas avec une application', [g(0, 4, -2)], 'Une chaise vide, en direct, devant vingt millions de spectateurs. L’image fait le tour du pays.'),
      ],
    }),
  },
  // La fin du café
  {
    tag: 'cafe_stocks', weight: 1, eligible: on('cafe', 0, 1),
    build: () => ({
      title: 'Les sacs du Havre',
      context: 'Au Havre, des négociants gardent des milliers de sacs de café dans leurs entrepôts, en attendant que les prix montent encore. Les petits torréfacteurs, eux, n’ont plus un grain à griller.',
      choices: [
        c('repartir', 'Négocier une répartition équitable des stocks', [g(5, -3, 1), s('energy', -3)], 'Un quota pour chaque torréfacteur, un prix plafonné pour les comptoirs : les négociants grognent, et les brûleries rallument leurs fours.'),
        c('marche', 'Laisser faire le marché', [g(-1, 4, 1)], 'Le marché fait son travail : les prix doublent encore.'),
      ],
    }),
  },
  {
    tag: 'cafe_reunion', weight: 1, eligible: on('cafe', 1, 2),
    build: () => ({
      title: 'Les caféiers de La Réunion',
      context: 'À La Réunion, la rouille noire atteint les plantations de bourbon pointu, parmi les derniers caféiers épargnés de la planète. Les planteurs réclament une cellule de crise : traiter, isoler les parcelles, sauver ce qui peut l’être avant qu’elle ne gagne toute l’île.',
      choices: [
        { ...c('cellule', 'Prendre la tête de la cellule de crise', [g(5, -4, 2)], 'Parcelle après parcelle, la rouille est contenue sur les hauts de l’île. Les derniers caféiers sains deviennent la pépinière de la France.'), play: 'cellule_epidemie' },
        c('experts', 'Laisser faire les agronomes', [g(0, 4, -2)], 'Les agronomes rendent un excellent rapport. La rouille, elle, n’a pas attendu.'),
      ],
    }),
  },
  {
    tag: 'cafe_bistrot', weight: 1, eligible: on('cafe', 2, 3),
    build: () => ({
      title: 'Le dernier bistrot du canton',
      context: 'À Saint-Ferréol-des-Prés, le dernier bistrot du canton allait fermer. Les habitants l’ont racheté ensemble pour en faire un café-épicerie-relais-poste, et vous invitent à la réouverture : on y servira de la chicorée, et l’on y dansera.',
      choices: [
        { ...c('fete', 'Venir trinquer à la chicorée', [g(2, -3, 6)], 'Accordéon, tarte aux pommes et chicorée au lait : le bistrot rouvre, et la photo de votre grimace à la première gorgée fait sourire tout le pays.'), play: 'fete_village' },
        c('cheque', 'Envoyer un chèque, sans vous déplacer', [g(2, 2, -3)], 'Le chèque arrive. Le village aurait préféré vous voir.'),
      ],
    }),
  },
  {
    tag: 'cafe_faux_grains', weight: 1, eligible: on('cafe', 3),
    build: () => ({
      title: 'Les faux grains',
      context: 'Des escrocs vendent à prix d’or des grains « d’avant la rouille » : du marc séché, de l’orge teintée, parfois pire. Les torréfacteurs honnêtes réclament un label pour que les clients s’y retrouvent.',
      choices: [
        c('label', 'Créer un label « grain vrai », contrôlé par les torréfacteurs', [g(6, -5, 1)], 'Un tampon, un registre, des contrôles surprises : les faux grains disparaissent des marchés, et les vrais torréfacteurs retrouvent leurs clients.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Le premier lot labellisé se révèle être de l’orge teintée ; la photo du tampon officiel fait rire tout le pays.' } }),
        c('prudence', 'Mettre en garde les consommateurs, sans plus', [g(1, 3, -1)], 'Les mises en garde circulent. Les faux grains aussi.'),
      ],
    }),
  },
  {
    tag: 'cafe_replanter', weight: 1, eligible: on('cafe', 4),
    build: () => ({
      title: 'La replantation',
      context: 'Les botanistes ont sélectionné un caféier qui résiste à la rouille. Reste à financer la replantation, ici et chez les pays producteurs, et à décider qui paiera : l’État, les torréfacteurs ou chaque tasse.',
      choices: [
        { ...c('arbitrer', 'Arbitrer vous-même le plan de replantation', [g(5, -4, 3)], 'Un centime par tasse, une part pour les planteurs, une part pour les comptoirs : le plan tient debout, et les premiers plants partent dans des caisses capitonnées.'), play: 'arbitrage_budgetaire' },
        c('grands', 'Laisser les grands torréfacteurs s’en charger', [g(0, 4, -2)], 'Les grands torréfacteurs replantent… pour eux seuls. Les petits comptoirs attendront.'),
      ],
    }),
  },
  // La pénurie de sable
  {
    tag: 'sable_dunes', weight: 1, eligible: on('sable', 0, 1),
    build: () => ({
      title: 'Les dunes de nuit',
      context: 'Sur la côte vendéenne, des camions chargent du sable en pleine nuit. Les maires du littoral réclament des patrouilles, et des associations de protection des dunes campent sur les plages, lampe frontale au front.',
      choices: [
        c('patrouilles', 'Organiser des patrouilles avec les gendarmes et les gardes du littoral', [g(5, -3, 1), s('energy', -3)], 'Projecteurs, barrières et procès-verbaux : les camions de nuit se font rares, et les dunes reprennent leur souffle.'),
        c('cameras', 'Laisser les maires s’équiper de caméras', [g(-1, 4, 1)], 'Les caméras filment très bien les camions. Elles ne les arrêtent pas.'),
      ],
    }),
  },
  {
    tag: 'sable_dragues', weight: 1, eligible: on('sable', 1, 2),
    build: () => ({
      title: 'Les dragues clandestines',
      context: 'Au large de la Bretagne, des dragues sans pavillon raclent les fonds marins à la faveur de la nuit, puis filent vers des ports lointains. La Marine propose une opération pour les arraisonner toutes, en une seule marée.',
      choices: [
        { ...c('operation', 'Diriger l’opération d’arraisonnement', [g(5, -4, 2)], 'À l’aube, les dragues sont escortées jusqu’à Brest, cales pleines de preuves. Les fonds marins respirent, et les trafiquants ont perdu leur flotte.'), play: 'bataille_navale' },
        c('douanes', 'Laisser les douanes surveiller les ports', [g(0, 4, -2)], 'Les dragues changent de port. Puis de pavillon.'),
      ],
    }),
  },
  {
    tag: 'sable_quartier', weight: 1, eligible: on('sable', 2, 3),
    build: () => ({
      title: 'Le quartier sans sable',
      context: 'Une commune de la Drôme veut bâtir tout un quartier sans béton : terre crue, bois, chanvre et pierre de réemploi. Son maire vous demande de l’aider à le dessiner, et à le défendre devant les sceptiques.',
      choices: [
        { ...c('dessiner', 'Dessiner le quartier avec le maire', [g(4, -3, 5)], 'Une école en pisé, des logements de bois, une halle en pierre de réemploi : le quartier sort de terre sans un grain de sable de rivière, et les visiteurs affluent.'), play: 'urbanisme_commune' },
        c('normes', 'Attendre que les normes soient prêtes', [g(1, 3, -4)], 'Les normes seront prêtes dans quatre ans. Les familles, elles, attendent un logement maintenant.'),
      ],
    }),
  },
  {
    tag: 'sable_entrepot', weight: 1, eligible: on('sable', 3),
    build: () => ({
      title: 'L’entrepôt du port',
      context: 'Des enquêteurs ont localisé l’entrepôt portuaire où convergent les camions de sable volé. Une descente coordonnée pourrait démanteler toute la filière, si l’information ne fuit pas avant.',
      choices: [
        c('descente', 'Coordonner une descente avec la justice', [g(6, -5, 2)], 'Quatre heures du matin : quarante camions saisis, des cartons de registres, et une filière remontée jusqu’aux ports d’embarquement.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'L’entrepôt est vide à l’arrivée des enquêteurs ; quelqu’un avait prévenu la filière.' } }),
        c('surveiller', 'Continuer à surveiller', [g(1, 3, -1)], 'La surveillance continue. Les camions aussi.'),
      ],
    }),
  },
  {
    tag: 'sable_loi', weight: 1, eligible: on('sable', 4),
    build: () => ({
      title: 'Bâtir sans piller',
      context: 'Il faut réécrire en urgence les normes de construction pour autoriser le béton recyclé, le bois et la terre crue. Les assureurs veulent des garanties, les bâtisseurs de la souplesse, et les parlementaires y ajoutent leurs amendements.',
      choices: [
        { ...c('loi', 'Porter la loi jusqu’au bout de la navette', [g(5, -4, 3)], 'Trois lectures, une commission mixte et une nuit blanche : la loi « Bâtir sans piller » est adoptée, et les grues repartent dès le lendemain.'), play: 'cmp' },
        c('decret', 'Tout régler par décret, et vite', [g(0, 4, -2)], 'Le décret est attaqué devant le Conseil d’État par trois fédérations. Les grues attendent.'),
      ],
    }),
  },
  // La commune directe
  {
    tag: 'agora_budget', weight: 1, eligible: on('agora', 0, 1),
    build: () => ({
      title: 'Le budget à main levée',
      context: 'Montcaubet a voté son budget à main levée, en trois heures, sans le moindre document comptable. Le comptable public s’arrache les cheveux, et le préfet menace de tout annuler.',
      choices: [
        c('comptable', 'Envoyer un comptable public siéger chaque samedi', [g(5, -3, 1), s('energy', -3)], 'Le comptable public apprend la belote, les habitants la comptabilité publique. Le budget suivant est voté en règle, et toujours à main levée.'),
        c('annuler', 'Laisser le préfet annuler le budget', [g(-1, 4, 0)], 'Le budget est annulé. Montcaubet le revote le samedi suivant, à l’identique, sous l’œil des caméras.'),
      ],
    }),
  },
  {
    tag: 'agora_propositions', weight: 1, eligible: on('agora', 1, 2),
    build: () => ({
      title: 'Trois cents samedis',
      context: 'Trois cents communes directes vous adressent les propositions votées dans leurs assemblées. Il y a de tout : des idées admirables, d’autres farfelues, et quelques-unes qui figurent déjà dans la loi.',
      choices: [
        { ...c('trier', 'Trier vous-même les propositions, en public', [g(5, -3, 2)], 'Une épicerie communale, des navettes vers le marché, une bibliothèque ouverte le dimanche : les bonnes idées remontent, et les communes se sentent enfin entendues.'), play: 'consultation' },
        c('classer', 'Les classer sans suite', [g(0, 4, -2)], 'Trois cents communes reçoivent le même accusé de réception. Elles votent, à l’unanimité, qu’il est insultant.'),
      ],
    }),
  },
  {
    tag: 'agora_plan', weight: 1, eligible: on('agora', 2, 3),
    build: () => ({
      title: 'Le plan voté trois fois',
      context: 'Après trois votes contradictoires, Montcaubet n’a plus de plan d’urbanisme : on a voté un lotissement, puis un verger à sa place, puis les deux à la fois. L’assemblée vous demande de l’aider à tout remettre à plat, ensemble.',
      choices: [
        { ...c('dessiner', 'Dessiner le plan avec l’assemblée, samedi après samedi', [g(4, -3, 5)], 'Une école agrandie, un verger communal, des logements pour les jeunes du village : le plan est voté à 81 %, et il tient debout.'), play: 'urbanisme_commune' },
        c('prefet', 'Laisser le préfet imposer un plan', [g(1, 3, -4)], 'Le plan du préfet est très bien fait. Personne ne l’a voté.'),
      ],
    }),
  },
  {
    tag: 'agora_partielle', weight: 1, eligible: on('agora', 3),
    build: () => ({
      title: 'Le candidat du samedi',
      context: 'Les communes directes présentent un candidat à une législative partielle dans le Gers, sur un programme d’une ligne : « Tout voter, tout le temps. » Votre camp vous demande de mener campagne, canton par canton, pour défendre une autre idée de la participation.',
      choices: [
        { ...c('campagne', 'Mener une campagne de terrain, respectueuse des samedis', [g(5, -4, 2)], 'Marchés, salles des fêtes, débats contradictoires : vous défendez l’assemblée pour les grandes décisions et l’élu pour le reste. Le soir du scrutin, le candidat du samedi vient vous serrer la main.'), play: 'campagne_legislatives' },
        c('abstenir', 'Ne pas vous en mêler', [g(0, 4, -2)], 'Le candidat du samedi est élu. Il promet de faire voter chaque amendement à Montcaubet.'),
      ],
    }),
  },
  {
    tag: 'agora_loi', weight: 1, eligible: on('agora', 4),
    build: () => ({
      title: 'La loi d’expérimentation',
      context: 'Un texte est prêt : les communes qui le souhaitent pourront voter leurs grandes décisions en assemblée, sous le contrôle d’un conseil élu et d’un comptable public. Encore faut-il qu’il soit voté à Paris, et accepté à Montcaubet.',
      choices: [
        c('presenter', 'Aller présenter la loi un samedi, à Montcaubet', [g(5, -4, 3)], 'Quarante minutes de discours, deux heures de questions, puis la salle vote : la loi est approuvée à main levée, avant même le Parlement.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -3)], failureNews: 'À Montcaubet, la salle rejette la loi à six voix près, en direct ; à Paris, les députés hésitent à la voter.' } }),
        c('paris', 'La faire voter à Paris, sans passer par le Gers', [g(0, 4, -2)], 'La loi est votée à Paris. À Montcaubet, on vote une motion de défiance contre elle.'),
      ],
    }),
  },
  // La grande faille
  {
    tag: 'faille_fermes', weight: 1, eligible: on('faille', 0, 1),
    build: () => ({
      title: 'Les fermes du bord',
      context: 'La faille approche de six fermes. Les familles refusent de partir : leurs bêtes, leurs silos et leurs souvenirs sont là. Les géologues donnent trois semaines, peut-être moins.',
      choices: [
        c('demenager', 'Organiser le déménagement, bêtes et silos compris', [g(5, -3, 1), s('energy', -3)], 'Bétaillères, convois de tracteurs, voisins solidaires : en dix jours, les six fermes sont déménagées. La faille n’avale qu’une grange vide.'),
        c('attendre', 'Attendre l’avis définitif des géologues', [g(-1, 4, 0)], 'L’avis définitif arrive la nuit même où un silo bascule dans le vide.'),
      ],
    }),
  },
  {
    tag: 'faille_riviere', weight: 1, eligible: on('faille', 1, 2),
    build: () => ({
      title: 'La rivière détournée',
      context: 'La faille a capté une rivière beauceronne. L’eau s’engouffre dans le gouffre, ressort plus loin, menace d’inonder trois bourgs en aval, et creuse encore la craie à chaque crue.',
      choices: [
        { ...c('cellule', 'Prendre la tête de la cellule de crise', [g(5, -4, 2)], 'Digues provisoires, pompes, bassins de rétention : la rivière retrouve son lit, les bourgs restent au sec, et la faille ralentit.'), play: 'cellule_crue' },
        c('prefet', 'Laisser le préfet gérer', [g(0, 4, -2)], 'Le préfet gère. L’eau aussi, à sa façon.'),
      ],
    }),
  },
  {
    tag: 'faille_hameaux', weight: 1, eligible: on('faille', 2, 3),
    build: () => ({
      title: 'Rebâtir à l’écart',
      context: 'Trois hameaux évacués demandent à être reconstruits. Les géologues ont tracé une bande interdite le long de la faille : on n’y rebâtira jamais. Il faut déblayer, reloger, et reconstruire au bon endroit.',
      choices: [
        { ...c('reconstruire', 'Piloter vous-même la reconstruction', [g(4, -3, 5)], 'Ruines déblayées, familles relogées avant l’hiver, et des hameaux neufs à bonne distance du vide : la Beauce respire.'), play: 'urbanisme_reconstruction' },
        c('indemniser', 'Indemniser, et laisser chacun se débrouiller', [g(1, 3, -4)], 'Les chèques arrivent. Faute de mieux, certains rebâtissent au bord du vide.'),
      ],
    }),
  },
  {
    tag: 'faille_curieux', weight: 1, eligible: on('faille', 3),
    build: () => ({
      title: 'Les selfies au bord du vide',
      context: 'Des centaines de milliers de curieux se pressent au bord de la faille. Les buvettes prospèrent, les bords s’effritent, et les gendarmes redoutent l’accident.',
      choices: [
        c('belvederes', 'Ouvrir des belvédères sûrs, et fermer tout le reste', [g(6, -5, 2)], 'Trois belvédères, des navettes et des guides géologues : les curieux voient mieux, de plus loin, et les bords se reposent.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Le premier belvédère se fissure le jour de son inauguration ; il est évacué sous l’œil des caméras.' } }),
        c('commerce', 'Laisser faire : c’est bon pour le commerce', [g(1, 3, -1)], 'Le commerce va bien. Les bords, beaucoup moins.'),
      ],
    }),
  },
  {
    tag: 'faille_combler', weight: 1, eligible: on('faille', 4),
    build: () => ({
      title: 'Consolider les extrémités',
      context: 'Les géologues proposent de consolider les deux extrémités de la faille et de soulager la nappe. Le chantier est colossal, et chaque poste doit être chiffré au plus juste avant d’être présenté au pays.',
      choices: [
        { ...c('chiffrer', 'Chiffrer le plan vous-même, poste par poste', [g(5, -4, 3)], 'Remblais, injections, pompages : le plan est chiffré au million près, voté sans drame, et les premiers camions partent le lendemain.'), play: 'chiffrage' },
        c('promettre', 'Promettre de tout combler, quel qu’en soit le coût', [g(0, 4, -2)], 'La promesse fait la une. Les géologues rappellent qu’on ne comble pas soixante kilomètres de vide.'),
      ],
    }),
  },
  // Le rêve partagé
  {
    tag: 'reve_registre', weight: 1, eligible: on('reve', 0, 1),
    build: () => ({
      title: 'Le registre des rêves',
      context: 'Des millions de témoignages affluent : dessins de la maison, airs fredonnés, détails du jardin. Les chercheurs demandent qu’on les recueille sérieusement, avant qu’ils ne se perdent dans le vacarme des réseaux.',
      choices: [
        c('registre', 'Ouvrir un registre public des rêves, anonyme et protégé', [g(5, -3, 1), s('energy', -3)], 'Un formulaire simple, des archivistes, des neurologues : trois millions de récits recueillis en un mois, et un premier motif qui se dessine.'),
        c('reseaux', 'Laisser les réseaux s’en charger', [g(-1, 4, 1)], 'Les réseaux s’en chargent. On y trouve des milliers de maisons aux volets bleus, dont beaucoup sont à vendre.'),
      ],
    }),
  },
  {
    tag: 'reve_salle', weight: 1, eligible: on('reve', 1, 2),
    build: () => ({
      title: 'La salle sous la ville',
      context: 'Depuis quelques nuits, les rêveurs voient dans la maison une trappe, un escalier, puis une salle voûtée qu’un ancien carrier reconnaît : une salle oubliée des carrières sous Paris. Des milliers de fidèles s’apprêtent à y descendre.',
      choices: [
        { ...c('descendre', 'La trouver avant la foule, avec un guide de l’Inspection des carrières', [g(5, -4, 2)], 'Au bout d’une galerie oubliée : une salle voûtée, une fresque de fleuve et de volets bleus peinte il y a deux siècles, et un vers gravé dans la pierre. Les chercheurs en tremblent d’émotion.'), play: 'infiltration_catacombes' },
        c('murer', 'Faire murer les accès', [g(0, 4, -2)], 'Les accès sont murés. Les fidèles en trouvent d’autres.'),
      ],
    }),
  },
  {
    tag: 'reve_oreillers', weight: 1, eligible: on('reve', 2, 3),
    build: () => ({
      title: 'Rêvez ensemble, dormez mieux',
      context: 'Une marque de literie lance une campagne nationale : « Rêvez ensemble. » D’autres vendent des tisanes censées « choisir la suite du rêve ». Les associations de consommateurs réclament une règle, et les journalistes une réponse.',
      choices: [
        { ...c('encadrer', 'Annoncer l’interdiction de toute publicité prétendant agir sur le rêve', [g(4, -3, 5)], 'Plus un oreiller ne promet de rêve partagé. Les marques changent leurs slogans, et le rêve redevient à tout le monde.'), play: 'conference_presse' },
        c('commerce', 'Laisser jouer la liberté du commerce', [g(1, 3, -4)], 'Les tisanes « suite du rêve » se vendent par millions. Elles ne font rien, sauf dormir.'),
      ],
    }),
  },
  {
    tag: 'reve_prophete', weight: 1, eligible: on('reve', 3),
    build: () => ({
      title: 'Le campement des rêveurs',
      context: 'Un ancien agent immobilier se proclame « interprète de la voix » et rassemble des dizaines de milliers de fidèles au bord de la Loire, dans l’attente que la maison apparaisse. Certains ont tout vendu pour le suivre.',
      choices: [
        c('mediation', 'Envoyer médiateurs, travailleurs sociaux et juristes au campement', [g(6, -5, 2)], 'Des tentes chauffées, des conseillers pour ceux qui ont tout vendu, un juriste pour examiner les comptes de l’« interprète » : le campement se vide doucement, sans heurts.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Les médiateurs sont accueillis avec des chants et des fleurs, puis priés de repartir ; l’« interprète » annonce que l’État « a peur du rêve ».' } }),
        c('ignorer', 'Ignorer : chacun croit ce qu’il veut', [g(1, 3, -1)], 'Le campement grandit. L’« interprète » ouvre une souscription.'),
      ],
    }),
  },
  {
    tag: 'reve_berceuse', weight: 1, eligible: on('reve', 4),
    build: () => ({
      title: 'La berceuse des mariniers',
      context: 'Des musicologues pensent avoir identifié l’air : une berceuse de mariniers de la Loire, oubliée depuis un siècle. Les rêveurs proposent de la chanter tous ensemble, un soir, au bord du fleuve, et vous demandent de monter sur scène.',
      choices: [
        { ...c('chanter', 'Monter sur scène au grand concert des rêveurs', [g(5, -4, 3)], 'Au bord de la Loire, cent mille personnes chantent la berceuse à mi-voix. Vous ne chantez pas très juste, mais vous chantez.'), play: 'festival' },
        c('droits', 'Laisser une maison de disques racheter les droits', [g(0, 4, -2)], 'La berceuse sort en version dansante. Cette nuit-là, la voix se tait dans tous les rêves.'),
      ],
    }),
  },
  // Les archives secrètes
  {
    tag: 'archives_familles', weight: 1, eligible: on('archives', 0, 1),
    build: () => ({
      title: 'Le nom d’un grand-père',
      context: 'Des milliers de familles découvrent dans les documents le nom d’un parent : un résistant oublié, un fonctionnaire zélé, un diplomate courageux. Elles demandent à consulter les originaux, et à être accompagnées.',
      choices: [
        c('salles', 'Ouvrir des salles de lecture accompagnées dans chaque département', [g(5, -3, 1), s('energy', -3)], 'Des archivistes, des historiens, et du temps : les familles lisent les originaux, et beaucoup repartent apaisées.'),
        c('ligne', 'Ouvrir une simple ligne téléphonique', [g(-1, 4, 0)], 'La ligne sonne occupé jour et nuit. Les familles se tournent vers les forums.'),
      ],
    }),
  },
  {
    tag: 'archives_source', weight: 1, eligible: on('archives', 1, 2),
    build: () => ({
      title: 'D’où vient la fuite ?',
      context: 'Les enquêteurs ont remonté la piste jusqu’à un service d’archives ministériel. Un agent, un prestataire ou un visiteur a copié un million de pages. Il faut le trouver, et savoir s’il a aussi glissé des faux.',
      choices: [
        { ...c('enquete', 'Mener l’enquête vous-même', [g(5, -4, 2)], 'C’était un archiviste à la retraite, convaincu de rendre au peuple ce qui lui appartenait. Il n’a jamais rien falsifié, et il fournit la liste exacte de ce qu’il a copié : les faux viennent d’ailleurs.'), play: 'enquete_fuite' },
        c('police', 'Laisser la police s’en charger', [g(0, 4, -2)], 'L’enquête suit son cours, lentement. Les faux, eux, se multiplient.'),
      ],
    }),
  },
  {
    tag: 'archives_citation', weight: 1, eligible: on('archives', 2, 3),
    build: () => ({
      title: 'La citation inventée',
      context: 'Une phrase attribuée à un ancien Premier ministre, tirée d’un « procès-verbal secret », enflamme le pays. Les historiens soupçonnent un faux, et une émission vous met au défi de rendre en direct chaque citation à son véritable auteur.',
      choices: [
        { ...c('defi', 'Relever le défi, sources à l’appui', [g(4, -3, 5)], 'Citation après citation, vous rendez à chacun ses mots, et montrez que la phrase venait d’un roman des années quatre-vingt. Le faux s’effondre en direct.'), play: 'qui_a_dit' },
        c('decliner', 'Décliner : l’histoire n’est pas un jeu', [g(1, 3, -4)], 'L’émission se fait sans vous. La fausse citation reste en tête des recherches.'),
      ],
    }),
  },
  {
    tag: 'archives_telegramme', weight: 1, eligible: on('archives', 3),
    build: () => ({
      title: 'Le télégramme de 1983',
      context: 'Un télégramme de 1983, fort peu flatteur pour un pays ami, provoque la colère de son gouvernement. Son ambassadeur refuse tout rendez-vous officiel, mais donne ce soir une réception. Une lettre d’explication doit parvenir sur son bureau, sans esclandre.',
      choices: [
        { ...c('remettre', 'Vous charger vous-même de déposer la lettre', [g(5, -4, 2)], 'Le lendemain, l’ambassadeur appelle : « Nous avons tous écrit des télégrammes que nous regrettons. » La crise s’apaise.'), play: 'infiltration_ambassade' },
        c('communique', 'Publier un communiqué d’excuses', [g(1, 3, -3)], 'Le communiqué est jugé tiède par le pays ami, et rampant par l’opposition.'),
      ],
    }),
  },
  {
    tag: 'archives_loi', weight: 1, eligible: on('archives', 4),
    build: () => ({
      title: 'La loi de la mémoire',
      context: 'Un texte est prêt : ouverture des archives après trente ans, sauf exceptions motivées devant un juge, et publication annotée des documents authentifiés. Il faut le présenter au pays, et le faire voter avant que la tempête ne reparte.',
      choices: [
        c('presenter', 'Présenter la loi dans une grande allocution, documents à l’appui', [g(5, -4, 3)], 'Vous montrez un vrai télégramme, un faux, et la manière de les distinguer. Le pays comprend, et la loi passe à une large majorité.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -3)], failureNews: 'L’un des documents « authentifiés » montrés pendant l’allocution se révèle être un faux ; l’opposition jubile.' } }),
        c('reclasser', 'Reclasser secret tout ce qui peut l’être', [g(0, 4, -2)], 'On reclasse. Le lendemain, le site anonyme publie le décret de reclassement.'),
      ],
    }),
  },
  // Le grand boycott
  {
    tag: 'boycott_caves', weight: 1, eligible: on('boycott', 0, 1),
    build: () => ({
      title: 'Les caves débordent',
      context: 'Caves d’affinage et chais débordent de produits destinés à la Méridia. Les producteurs demandent de l’aide pour stocker, et surtout pour vendre ailleurs.',
      choices: [
        c('stocker', 'Ouvrir des entrepôts publics et des prêts de trésorerie', [g(5, -3, 1), s('energy', -3)], 'Entrepôts frigorifiques réquisitionnés, prêts à taux zéro : les producteurs respirent, et les meules continuent de vieillir dignement.'),
        c('attendre', 'Attendre que la Méridia revienne à la raison', [g(-1, 4, 0)], 'La Méridia ne revient pas à la raison. Les premiers fromagers bradent leurs stocks.'),
      ],
    }),
  },
  {
    tag: 'boycott_reception', weight: 1, eligible: on('boycott', 1, 2),
    build: () => ({
      title: 'La réception de l’ambassade méridienne',
      context: 'L’ambassadeur de la Méridia refuse tout contact officiel, mais donne ce soir une réception pour la fête nationale de son pays. Une proposition discrète de sortie de crise doit parvenir sur son bureau, sans esclandre, et sans que la presse le sache.',
      choices: [
        { ...c('deposer', 'Vous glisser jusqu’au bureau de l’ambassadeur', [g(5, -4, 2)], 'Le lendemain, l’ambassadeur sollicite un « contact informel ». La Méridia autorise à nouveau l’importation des pièces d’avion.'), play: 'infiltration_ambassade' },
        c('bouder', 'Boycotter la réception à votre tour', [g(0, 4, -2)], 'Le geste plaît aux réseaux. La Méridia en profite pour durcir le ton.'),
      ],
    }),
  },
  {
    tag: 'boycott_foire', weight: 1, eligible: on('boycott', 2, 3),
    build: () => ({
      title: 'La grande foire des producteurs',
      context: 'Les filières boycottées organisent une grande foire dans toutes les préfectures : comtés, cognacs, parfums et foulards à prix de producteur. Encore faut-il y attirer les Français, et y faire honneur à chaque stand.',
      choices: [
        { ...c('foire', 'Arpenter la foire, de stand en stand', [g(4, -3, 5)], 'Quarante fromages goûtés, dix mille mains serrées et un foulard au cou : la foire attire trois millions de visiteurs, et les caves se vident un peu.'), play: 'bain_de_foule' },
        c('grandes_surfaces', 'Laisser les grandes surfaces racheter les stocks', [g(1, 3, -4)], 'Les grandes surfaces rachètent à prix cassés. Les producteurs crient au pillage.'),
      ],
    }),
  },
  {
    tag: 'boycott_mission', weight: 1, eligible: on('boycott', 3),
    build: () => ({
      title: 'Les nouveaux clients',
      context: 'Des acheteurs de trois continents s’intéressent aux produits boycottés. Une grande mission commerciale pourrait signer des contrats en quelques semaines, à condition d’être bien préparée et que les producteurs suivent.',
      choices: [
        c('mission', 'Conduire une mission commerciale sur trois continents', [g(6, -5, 1)], 'Douze pays, quarante contrats, et un comté servi au banquet officiel d’une capitale lointaine : les filières respirent.', { risk: { baseChance: 0.35, scaleWith: 'influence', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Les contrats annoncés n’étaient que des lettres d’intention ; la mission rentre presque bredouille.' } }),
        c('europe', 'Attendre une riposte européenne', [g(1, 3, -1)], 'L’Europe réfléchit. Les producteurs, eux, comptent leurs pertes.'),
      ],
    }),
  },
  {
    tag: 'boycott_table', weight: 1, eligible: on('boycott', 4),
    build: () => ({
      title: 'Un plateau de fromages entre deux délégations',
      context: 'La Méridia accepte de négocier. Ses émissaires exigent que la France revienne sur son vote européen ; ses consommateurs, eux, réclament leur camembert. Tout se jouera en une nuit.',
      choices: [
        { ...c('negocier', 'Mener la négociation sans rien céder d’essentiel', [g(5, -4, 3)], 'Une nuit, deux délégations, un plateau de fromages au milieu de la table : les droits de douane sont levés, et la France ne retire rien de son vote.'), play: 'negociation_alliance' },
        c('ceder', 'Céder à Bruxelles pour en finir', [g(0, 4, -2)], 'La France adoucit sa position. La Méridia célèbre « une leçon de démocratie ».'),
      ],
    }),
  },
  // L'iceberg d'Ouessant
  {
    tag: 'iceberg_rail', weight: 1, eligible: on('iceberg', 0, 1),
    build: () => ({
      title: 'Le rail d’Ouessant',
      context: 'Chaque jour, cent cinquante cargos et pétroliers empruntent le rail d’Ouessant, droit vers l’iceberg. Les armateurs demandent qu’on dévie la route, les pêcheurs qu’on ne la dévie pas sur leurs zones de pêche.',
      choices: [
        c('devier', 'Redessiner la route avec les armateurs et les pêcheurs', [g(5, -3, 1), s('energy', -3)], 'Une nuit de négociation à la préfecture maritime, une carte redessinée au crayon : les cargos passent au large, et les chalutiers gardent leurs fonds.'),
        c('attendre', 'Laisser chaque navire se débrouiller', [g(-1, 4, 0)], 'Un porte-conteneurs frôle la glace à deux cents mètres. La vidéo, prise depuis la passerelle, fait frémir le pays.'),
      ],
    }),
  },
  {
    tag: 'iceberg_vague', weight: 1, eligible: on('iceberg', 1, 2),
    build: () => ({
      title: 'La vague de vêlage',
      context: 'Un pan de glace grand comme un stade s’effondre dans la mer. La houle qu’il soulève déferle sur Le Conquet et Molène : quais inondés, bateaux arrachés à leurs amarres, et d’autres effondrements annoncés pour les jours qui viennent.',
      choices: [
        { ...c('cellule', 'Prendre la tête de la cellule de crise', [g(5, -4, 2)], 'Quais évacués, digues de sacs de sable, bateaux mis à l’abri : la houle suivante ne trouve plus personne sur son chemin.'), play: 'cellule_crue' },
        c('prefet', 'Laisser la préfecture maritime gérer', [g(0, 4, -2)], 'La préfecture gère. La houle suivante emporte la moitié du marché du Conquet.'),
      ],
    }),
  },
  {
    tag: 'iceberg_voisins', weight: 1, eligible: on('iceberg', 2, 3),
    build: () => ({
      title: 'À qui est l’iceberg ?',
      context: 'Plusieurs pays européens proposent de « débarrasser » la France de l’iceberg en le remorquant vers leurs côtes, pour en vendre l’eau douce. Au Conseil européen, chacun avance ses pions, et Bruxelles attend une position française.',
      choices: [
        { ...c('europe', 'Bâtir une position européenne commune', [g(4, -3, 5)], 'Après une nuit de tractations, les Vingt-Sept s’accordent : l’iceberg sera étudié par une mission scientifique commune, et personne ne le vendra en bouteilles.'), play: 'echiquier_europe' },
        c('ceder', 'Laisser le premier venu le remorquer', [g(1, 3, -4)], 'Un armateur étranger accroche un câble à l’iceberg, qui se fend aussitôt en trois. Les trois morceaux dérivent vers la Bretagne.'),
      ],
    }),
  },
  {
    tag: 'iceberg_croisieres', weight: 1, eligible: on('iceberg', 3),
    build: () => ({
      title: 'Les croisières sur la glace',
      context: 'Des croisiéristes débarquent chaque jour des centaines de touristes sur l’iceberg, pour des selfies au bord des crevasses et des pique-niques sur la glace. Les glaciologues la jugent de plus en plus instable.',
      choices: [
        c('encadrer', 'Interdire l’accès et ouvrir des sorties encadrées par des guides', [g(6, -5, 2)], 'Des navettes de la Marine, des guides de haute montagne venus de Chamonix et une distance de sécurité : les visiteurs voient l’iceberg de près, sans jamais y poser le pied.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Un croisiériste brave l’interdiction et débarque ses passagers en direct sur les réseaux ; l’État passe pour impuissant.' } }),
        c('laisser', 'Laisser faire : c’est bon pour le tourisme', [g(1, 3, -1)], 'Le tourisme se porte bien. La glace, beaucoup moins.'),
      ],
    }),
  },
  {
    tag: 'iceberg_remorquage', weight: 1, eligible: on('iceberg', 4),
    build: () => ({
      title: 'Huit remorqueurs et un glaçon',
      context: 'Les océanographes proposent un plan inédit : ceinturer l’iceberg de câbles et le tirer, avec huit remorqueurs, vers des eaux profondes où il fondra sans danger. Le chantier est colossal, et chaque poste doit être chiffré avant d’être présenté au pays.',
      choices: [
        { ...c('chiffrer', 'Chiffrer le plan vous-même, poste par poste', [g(5, -4, 3)], 'Remorqueurs, câbles, carburant, assurances : le plan est chiffré à la tonne près, et les huit remorqueurs appareillent de Brest un matin de brume.'), play: 'chiffrage' },
        c('promettre', 'Promettre sa disparition en un mois', [g(0, 4, -2)], 'La promesse fait la une. Les glaciologues rappellent qu’on ne fait pas fondre douze kilomètres de glace sur commande.'),
      ],
    }),
  },
  // La Seine à rebours
  {
    tag: 'seine_captages', weight: 1, eligible: on('seine', 0, 1),
    build: () => ({
      title: 'L’eau salée à Rouen',
      context: 'L’eau de mer remonte l’estuaire et approche des captages qui alimentent Rouen. Les services de l’eau demandent des moyens d’urgence, et les habitants se ruent sur l’eau en bouteille.',
      choices: [
        c('proteger', 'Protéger les captages et organiser des distributions d’eau', [g(5, -3, 1), s('energy', -3)], 'Barrages anti-sel, citernes, et des bénévoles à chaque coin de rue : Rouen ne manque pas d’eau une seule journée.'),
        c('attendre', 'Attendre que le courant revienne', [g(-1, 4, 0)], 'Le courant ne revient pas. L’eau du robinet de Rouen prend un goût de marée.'),
      ],
    }),
  },
  {
    tag: 'seine_crue', weight: 1, eligible: on('seine', 1, 2),
    build: () => ({
      title: 'La crue sans pluie',
      context: 'L’eau qui ne s’écoule plus vers la mer s’accumule en amont. La Seine sort de son lit à Troyes, l’Aube et l’Yonne refluent, et des villages entiers se réveillent cernés par l’eau, sous un ciel parfaitement bleu.',
      choices: [
        { ...c('cellule', 'Prendre la tête de la cellule de crise', [g(5, -4, 2)], 'Lacs-réservoirs ouverts, digues renforcées, évacuations en bon ordre : l’eau monte, mais personne n’est pris au piège.'), play: 'cellule_crue' },
        c('prefets', 'Laisser les préfets gérer, département par département', [g(0, 4, -2)], 'Chaque préfet gère son bout de fleuve. L’eau, elle, ne connaît pas les départements.'),
      ],
    }),
  },
  {
    tag: 'seine_peniches', weight: 1, eligible: on('seine', 2, 3),
    build: () => ({
      title: 'Les péniches à quai',
      context: 'Les mariniers ne peuvent plus naviguer : le courant les pousse vers l’amont, les écluses ne savent plus dans quel sens fonctionner, et des centaines de péniches chargées de céréales et de matériaux attendent à quai. Il faut tout faire passer par le rail, et vite.',
      choices: [
        { ...c('rail', 'Basculer le fret sur le rail, ligne par ligne', [g(4, -3, 5)], 'Trains céréaliers, wagons de sable, horaires refaits en une semaine : les marchandises passent par le rail, et les mariniers gardent leurs bateaux à flot en attendant.'), play: 'reseau_tgv' },
        c('attendre', 'Attendre que les mariniers trouvent une solution', [g(1, 3, -4)], 'Les mariniers attendent aussi. Les silos de la Beauce débordent d’un blé qui ne part nulle part.'),
      ],
    }),
  },
  {
    tag: 'seine_source', weight: 1, eligible: on('seine', 3),
    build: () => ({
      title: 'Les pèlerins de la source',
      context: 'Des dizaines de milliers de pèlerins en canoë convergent vers la source de la Seine, sur le plateau de Langres : un minuscule vallon qui n’a jamais accueilli plus de cent visiteurs à la fois. Des marchands y vendent de « l’eau à rebours » à prix d’or.',
      choices: [
        c('accueillir', 'Organiser l’accueil avec les communes du plateau, et chasser les marchands', [g(6, -5, 2)], 'Navettes, campings provisoires, sentiers balisés et contrôles des fraudes : les pèlerins voient la source, et les vendeurs d’eau miraculeuse remballent.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Le jour de l’ouverture du site, la foule dépasse toutes les prévisions ; le vallon est piétiné et la source n’est plus qu’une flaque de boue.' } }),
        c('ignorer', 'Ignorer : chacun pagaie où il veut', [g(1, 3, -1)], 'Les pèlerins pagaient. Les marchands aussi.'),
      ],
    }),
  },
  {
    tag: 'seine_retour', weight: 1, eligible: on('seine', 4),
    build: () => ({
      title: 'Le fleuve hésite',
      context: 'Le courant ralentit, s’arrête, repart : les hydrologues pensent que la Seine pourrait reprendre son cours si l’on soulage les nappes en amont. Il faut l’expliquer au pays, et préparer les riverains au retour brutal du courant.',
      choices: [
        { ...c('expliquer', 'Expliquer le plan aux Français, cartes à l’appui', [g(5, -4, 3)], 'Vingt minutes, trois cartes et pas un mot technique : le pays comprend ce qui se passe sous ses pieds, et les riverains se préparent au retour du courant.'), play: 'allocution' },
        c('silence', 'Ne rien annoncer avant d’être sûr', [g(0, 4, -2)], 'Le silence nourrit les rumeurs. On dit que la Seine va remonter jusqu’à Dijon.'),
      ],
    }),
  },
  // Le jour sans nuit
  {
    tag: 'jour_sommeil', weight: 1, eligible: on('jour', 0, 1),
    build: () => ({
      title: 'Les volets de la nuit',
      context: 'Les habitants du Morvan ne dorment plus que trois heures par nuit. Les médecins demandent des rideaux occultants, des horaires aménagés, et qu’on prenne au sérieux une fatigue qui gagne tout le monde, des écoliers aux éleveurs.',
      choices: [
        c('occultants', 'Distribuer rideaux occultants et horaires aménagés', [g(5, -3, 1), s('energy', -3)], 'Rideaux noirs à chaque fenêtre, écoles qui ouvrent à dix heures, siestes autorisées dans les administrations : le Morvan retrouve le sommeil, ou presque.'),
        c('patience', 'Conseiller la patience', [g(-1, 4, 0)], 'Le Morvan patiente, les yeux cernés. Les accidents de tracteur se multiplient.'),
      ],
    }),
  },
  {
    tag: 'jour_eleveurs', weight: 1, eligible: on('jour', 1, 2),
    build: () => ({
      title: 'Les vaches ne rentrent plus',
      context: 'Déboussolées par la lumière, les charolaises ne rentrent plus à l’étable, ne se laissent plus traire à heure fixe, et le lait baisse dans toutes les fermes. Les éleveurs du Morvan demandent qu’on vienne les écouter, commune par commune.',
      choices: [
        { ...c('tournee', 'Faire la tournée des communes et des fermes', [g(5, -4, 2)], 'Vingt communes, quarante fermes, et des étables équipées de lumières tamisées : les vaches retrouvent leurs habitudes, et les éleveurs se sentent entendus.'), play: 'tournee_maires' },
        c('aides', 'Annoncer des aides depuis Paris', [g(0, 4, -2)], 'Les aides arrivent par courrier. Les vaches, elles, ne lisent pas le courrier.'),
      ],
    }),
  },
  {
    tag: 'jour_cultures', weight: 1, eligible: on('jour', 2, 3),
    build: () => ({
      title: 'Les tournesols de quatre mètres',
      context: 'Sous le soleil perpétuel, les cultures s’emballent puis s’épuisent. Des semenciers proposent de racheter les terres pour des récoltes record, au risque d’épuiser les sols en deux saisons. Les agriculteurs attendent un plan.',
      choices: [
        { ...c('plan', 'Chiffrer un plan de rotation et de repos des sols', [g(4, -3, 5)], 'Jachères, cultures adaptées, et une prime pour chaque champ laissé au repos : les sols tiennent, et les tournesols géants deviennent la fierté des comices.'), play: 'chiffrage_mesure' },
        c('vendre', 'Laisser les semenciers racheter les terres', [g(1, 3, -4)], 'Les récoltes battent tous les records. L’année suivante, la terre ne donne plus rien.'),
      ],
    }),
  },
  {
    tag: 'jour_festival', weight: 1, eligible: on('jour', 3),
    build: () => ({
      title: 'La fête qui ne s’arrête jamais',
      context: 'Un festival géant s’installe sous le soleil de minuit : cent mille personnes, de la musique jour et nuit, puisque c’est la même chose. Les habitants n’en dorment plus du tout.',
      choices: [
        c('encadrer', 'Encadrer la fête : des horaires, une jauge et des zones de calme', [g(6, -5, 2)], 'Une jauge, des zones de silence, et une fête qui s’arrête à heure fixe, même sous le soleil : le Morvan respire, et les festivaliers aussi.', { risk: { baseChance: 0.35, scaleWith: 'influence', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Les organisateurs ignorent les horaires imposés ; le festival continue, et le Morvan ne dort toujours pas.' } }),
        c('laisser', 'Laisser faire : c’est bon pour l’économie locale', [g(1, 3, -1)], 'L’économie locale se porte bien. Les habitants, beaucoup moins.'),
      ],
    }),
  },
  {
    tag: 'jour_crepuscule', weight: 1, eligible: on('jour', 4),
    build: () => ({
      title: 'Le premier crépuscule',
      context: 'Pour la première fois depuis des mois, le soleil frôle l’horizon et le ciel rougit. Les habitants veulent fêter le retour de la nuit, tous ensemble, sur les collines, et vous demandent de monter sur scène.',
      choices: [
        { ...c('scene', 'Monter sur scène pour la fête du crépuscule', [g(5, -4, 3)], 'Sur la colline de Château-Chinon, quarante mille personnes regardent le soleil descendre. Vous dites trois mots, puis tout le monde se tait, et la nuit tombe enfin, quelques minutes.'), play: 'festival' },
        c('discret', 'Rester discret : la nuit n’est pas encore revenue', [g(0, 4, -2)], 'La fête se fait sans vous. On y remarque surtout votre absence.'),
      ],
    }),
  },
  // La langue retrouvée
  {
    tag: 'langue_grotte', weight: 1, eligible: on('langue', 0, 1),
    build: () => ({
      title: 'La grotte assiégée',
      context: 'Des centaines de curieux et quelques pilleurs tentent de pénétrer dans la grotte, la nuit, pour emporter une tablette. Les archéologues demandent qu’on protège le site, et qu’on numérise tout avant qu’il ne soit trop tard.',
      choices: [
        c('proteger', 'Protéger le site et financer la numérisation', [g(5, -3, 1), s('energy', -3)], 'Une grille, des gardiens, et des scanners qui tournent jour et nuit : chaque tablette a désormais son double numérique, consultable par tous.'),
        c('commune', 'Laisser la commune s’en occuper', [g(-1, 4, 0)], 'La commune pose un cadenas. Trois tablettes disparaissent la semaine suivante.'),
      ],
    }),
  },
  {
    tag: 'langue_signes', weight: 1, eligible: on('langue', 1, 2),
    build: () => ({
      title: 'Les signes rebelles',
      context: 'Les linguistes butent sur une série de signes qui reviennent dans toutes les tablettes. Ils vous invitent à une séance de travail ouverte au public, pour montrer comment on déchiffre, signe par signe, une langue perdue.',
      choices: [
        { ...c('dechiffrer', 'Vous asseoir à la table des linguistes', [g(5, -4, 2)], 'Après trois heures et six cafés, le signe rebelle livre son sens : « rivière ». Toute une série de récits s’ouvre d’un coup, et les linguistes vous offrent une tablette… en photocopie.'), play: 'fiches' },
        c('decliner', 'Laisser les spécialistes entre eux', [g(0, 4, -2)], 'Les spécialistes travaillent entre eux. Sur internet, d’autres « traduisent » plus vite qu’eux, et n’importe comment.'),
      ],
    }),
  },
  {
    tag: 'langue_faux', weight: 1, eligible: on('langue', 2, 3),
    build: () => ({
      title: 'Les fausses tablettes',
      context: 'Des tablettes « inédites » circulent sur internet, avec des traductions sensationnelles qui confirment toutes les thèses du moment. Une émission vous met au défi de distinguer, en direct, les vraies traductions des inventions.',
      choices: [
        { ...c('verifier', 'Relever le défi, avec les linguistes à vos côtés', [g(4, -3, 5)], 'Une gravure trop fraîche, un mot impossible, une traduction trop commode : les faux tombent un à un, en direct, et le pays apprend à se méfier des miracles.'), play: 'factcheck_direct' },
        c('ignorer', 'Ne pas leur faire de publicité', [g(1, 3, -4)], 'Les faux prospèrent dans le silence. Le plus célèbre est vu vingt millions de fois.'),
      ],
    }),
  },
  {
    tag: 'langue_manuels', weight: 1, eligible: on('langue', 3),
    build: () => ({
      title: 'Réécrire les manuels ?',
      context: 'Les éditeurs scolaires attendent une réponse : faut-il réécrire dès la rentrée le chapitre sur la Gaule ? Les historiens se divisent, et chaque camp vous demande de trancher.',
      choices: [
        c('consensus', 'Réunir une conférence de consensus des historiens de toutes les écoles', [g(6, -5, 2)], 'Trois jours de débats à huis clos, un texte commun, et un chapitre provisoire, prudent et passionnant : les manuels changent, mais personne ne crie à la falsification.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'La conférence se déchire dès le premier jour ; deux écoles d’historiens claquent la porte et publient chacune leur chapitre.' } }),
        c('editeurs', 'Laisser chaque éditeur décider', [g(1, 3, -1)], 'Chaque éditeur décide. Les élèves d’une même classe n’apprennent pas la même Gaule.'),
      ],
    }),
  },
  {
    tag: 'langue_dictionnaire', weight: 1, eligible: on('langue', 4),
    build: () => ({
      title: 'Le premier dictionnaire',
      context: 'Le premier dictionnaire de la langue retrouvée est prêt. Les linguistes voudraient le présenter au pays avec vous, dans un grand discours qui dise ce que l’on sait, ce que l’on ignore, et pourquoi cela nous concerne tous.',
      choices: [
        { ...c('discours', 'Présenter le dictionnaire dans un grand discours', [g(5, -4, 3)], 'Vous lisez en public les premiers mots d’une chanson vieille de deux mille ans, puis sa traduction. La salle se lève, et le dictionnaire devient un succès de librairie.'), play: 'discours' },
        c('communique', 'Publier un simple communiqué', [g(0, 4, -2)], 'Le communiqué passe inaperçu. Les faussaires, eux, publient leur propre dictionnaire.'),
      ],
    }),
  },
  // La Toque d'or
  {
    tag: 'toque_brigade', weight: 1, eligible: on('toque', 0, 1),
    build: () => ({
      title: 'Une brigade à bâtir',
      context: 'Maëlle Garnier doit composer sa brigade en trois mois. Les grandes maisons refusent de lui prêter leurs seconds, et les lycées hôteliers proposent leurs meilleurs élèves. Il faut des moyens, une cuisine d’entraînement et du temps.',
      choices: [
        c('cuisine', 'Ouvrir une cuisine d’entraînement dans un lycée hôtelier', [g(5, -3, 1), s('energy', -3)], 'Une cuisine flambant neuve à Lyon, des apprentis sélectionnés sur concours, et un vieux chef qui vient chaque matin goûter les sauces : la brigade prend forme.'),
        c('comite', 'Laisser le comité se débrouiller', [g(-1, 4, 0)], 'Le comité se débrouille. Faute de cuisine, la brigade s’entraîne dans un restaurant fermé le lundi.'),
      ],
    }),
  },
  {
    tag: 'toque_joute', weight: 1, eligible: on('toque', 1, 2),
    build: () => ({
      title: 'La guerre des toques',
      context: 'Un grand chef accuse publiquement la sélection d’être « une erreur historique ». Une émission vous invite à lui répondre, face à face, en direct, devant cinq millions de téléspectateurs.',
      choices: [
        { ...c('repondre', 'Accepter le face-à-face', [g(5, -4, 2)], 'Vous parlez produits, apprentissage et audace. À la fin de l’émission, le grand chef vous serre la main et promet de goûter le plat de l’équipe.'), play: 'eloquence' },
        c('esquiver', 'Décliner l’invitation', [g(0, 4, -2)], 'Le grand chef parle seul pendant une heure. Le pays l’écoute.'),
      ],
    }),
  },
  {
    tag: 'toque_fuite', weight: 1, eligible: on('toque', 2, 3),
    build: () => ({
      title: 'Les fiches qui ont fui',
      context: 'Les fiches techniques de l’équipe de France ont été copiées et envoyées à une équipe concurrente. Chaque camp accuse l’autre, et l’affaire menace de faire annuler le concours. Il faut savoir qui a fait fuiter les recettes, et vite.',
      choices: [
        { ...c('enquete', 'Mener l’enquête vous-même', [g(4, -3, 5)], 'C’était un photographe de l’émission de téléréalité, qui avait revendu ses images. L’équipe concurrente avait rendu les fiches sans les ouvrir. L’affaire se dégonfle, et les deux brigades trinquent ensemble.'), play: 'enquete_fuite' },
        c('accuser', 'Accuser publiquement l’équipe concurrente', [g(1, 3, -4)], 'Le pays concurrent rappelle son ambassadeur pour consultations. Les journaux du monde parlent de la « guerre des toques ».'),
      ],
    }),
  },
  {
    tag: 'toque_lentilles', weight: 1, eligible: on('toque', 3),
    build: () => ({
      title: 'Les lentilles de la sécheresse',
      context: 'La sécheresse a ruiné une bonne part de la récolte de lentilles du Puy, produit vedette du plat français. Les producteurs se disputent l’honneur de fournir l’équipe, et certains crient déjà au favoritisme.',
      choices: [
        c('aveugle', 'Organiser un concours ouvert entre producteurs, jugé à l’aveugle', [g(6, -5, 2)], 'Quarante lots de lentilles, un jury de cuisiniers les yeux bandés, et un vainqueur incontesté : un petit producteur de Haute-Loire, qui pleure devant les caméras.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Le lot vainqueur appartient au cousin d’un membre du jury ; la presse s’en empare aussitôt.' } }),
        c('discret', 'Laisser l’équipe choisir discrètement', [g(1, 3, -1)], 'L’équipe choisit. La rumeur, elle, choisit un coupable.'),
      ],
    }),
  },
  {
    tag: 'toque_diner', weight: 1, eligible: on('toque', 4),
    build: () => ({
      title: 'Le dîner de la veille',
      context: 'La veille de la finale, la France reçoit les vingt-quatre délégations et le jury à dîner. Placer chaque invité, éviter les rivaux côte à côte, honorer chacun : un faux pas, et la finale commencerait sous de mauvais auspices.',
      choices: [
        { ...c('table', 'Composer vous-même le plan de table', [g(5, -4, 3)], 'Personne n’est vexé, deux délégations rivales se découvrent une passion commune pour le fromage, et le jury se couche de bonne humeur.'), play: 'plan_table' },
        c('traiteur', 'Laisser un traiteur s’en charger', [g(0, 4, -2)], 'Le traiteur place côte à côte les deux délégations brouillées par l’affaire des recettes. Le dîner est très silencieux.'),
      ],
    }),
  },
  // La capitale à Bourges
  {
    tag: 'capitale_agents', weight: 1, eligible: on('capitale', 0, 1),
    build: () => ({
      title: 'Les agents qui hésitent',
      context: 'Des milliers d’agents des ministères ne savent pas s’ils doivent suivre : conjoints, écoles, maisons à vendre. Les syndicats demandent des garanties, et beaucoup envisagent de quitter l’administration.',
      choices: [
        c('accompagner', 'Négocier un accompagnement famille par famille', [g(5, -3, 1), s('energy', -3)], 'Primes de mobilité, emplois pour les conjoints, places en crèche réservées : un agent sur deux accepte de partir, et presque tous les autres trouvent un poste à Paris.'),
        c('imposer', 'Imposer la mutation, sans exception', [g(-1, 4, 0)], 'Un tiers des agents démissionne. Les ministères partent à Bourges à moitié vides.'),
      ],
    }),
  },
  {
    tag: 'capitale_syndicats', weight: 1, eligible: on('capitale', 1, 2),
    build: () => ({
      title: 'La table des syndicats',
      context: 'Les syndicats de la fonction publique menacent d’une grève dans tous les ministères si le transfert se fait sans contreparties. Une nuit de négociation s’annonce.',
      choices: [
        { ...c('negocier', 'Mener la négociation vous-même', [g(5, -4, 2)], 'Au petit matin, un accord : un calendrier étalé, des garanties pour les agents et un droit au retour. Les syndicats signent en grommelant, et les cartons repartent.'), play: 'negociation_syndicale' },
        c('force', 'Passer en force', [g(0, 4, -2)], 'La grève paralyse douze ministères pendant trois semaines. Les cartons restent sur les quais de la gare d’Austerlitz.'),
      ],
    }),
  },
  {
    tag: 'capitale_quartier', weight: 1, eligible: on('capitale', 2, 3),
    build: () => ({
      title: 'Le quartier des ministères',
      context: 'Bourges doit accueillir quarante mille agents et leurs familles : logements, écoles, transports, bureaux. Les urbanistes proposent de bâtir un quartier neuf autour des anciennes casernes, et vous demandent de dessiner le plan avec eux.',
      choices: [
        { ...c('dessiner', 'Dessiner le plan avec les urbanistes et les habitants', [g(4, -3, 5)], 'Des logements autour des casernes rénovées, un tramway, des écoles et un grand parc le long de l’Yèvre : les Berruyers approuvent le plan, et les agents commencent à s’y voir.'), play: 'urbanisme_commune' },
        c('promoteurs', 'Laisser les promoteurs bâtir au plus vite', [g(1, 3, -4)], 'Les promoteurs bâtissent vite, cher et loin de tout. Les agents préfèrent faire le trajet depuis Paris.'),
      ],
    }),
  },
  {
    tag: 'capitale_ligne', weight: 1, eligible: on('capitale', 3),
    build: () => ({
      title: 'La ligne Paris-Bourges',
      context: 'Sans train rapide, Bourges restera à deux heures de Paris, et le transfert échouera. Une ligne nouvelle coûterait des milliards ; les régions oubliées réclament la leur en échange de leur soutien.',
      choices: [
        c('plan', 'Bâtir un plan ferroviaire pour Bourges et les villes moyennes', [g(6, -5, 2)], 'Une ligne nouvelle pour Bourges, des trains rénovés pour Limoges, Clermont et Nevers : les régions oubliées s’y retrouvent, et le projet passe.', { risk: { baseChance: 0.35, scaleWith: 'influence', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Le plan ferroviaire est jugé irréaliste par la Cour des comptes ; trois régions retirent leur soutien.' } }),
        c('reporter', 'Reporter la question du rail', [g(1, 3, -1)], 'La question est reportée. Les trains Paris-Bourges, eux, sont toujours pleins.'),
      ],
    }),
  },
  {
    tag: 'capitale_loi', weight: 1, eligible: on('capitale', 4),
    build: () => ({
      title: 'La loi de la capitale',
      context: 'Le texte qui fait de Bourges la capitale administrative arrive au Parlement. Sénateurs et députés se divisent sur tout, des noms de rues au calendrier. Il faudra le porter jusqu’au bout de la navette.',
      choices: [
        { ...c('porter', 'Porter la loi jusqu’au bout de la navette', [g(5, -4, 3)], 'Trois lectures, une commission mixte paritaire et une nuit blanche : la loi est adoptée, et Bourges devient officiellement la capitale administrative de la France.'), play: 'navette_loi' },
        c('ordonnance', 'Tout régler par ordonnance', [g(0, 4, -2)], 'L’ordonnance est contestée devant le Conseil constitutionnel. Les cartons attendent.'),
      ],
    }),
  },
  // L'enfant prodige
  {
    tag: 'prodige_lycee', weight: 1, eligible: on('prodige', 0, 1),
    build: () => ({
      title: 'Le siège du lycée',
      context: 'Des dizaines de journalistes et de curieux campent devant le lycée de Guéret. Les élèves ne peuvent plus entrer sans être filmés, et les parents réclament qu’on protège l’établissement, et Lou avec.',
      choices: [
        c('treve', 'Protéger le lycée et obtenir des rédactions une trêve', [g(5, -3, 1), s('energy', -3)], 'Un périmètre autour du lycée, un accord signé par les rédactions, et une seule photo officielle par mois : les élèves retrouvent leur cour, et Lou ses récréations.'),
        c('presse', 'Laisser faire : c’est la liberté de la presse', [g(-1, 4, 0)], 'La liberté de la presse s’exerce chaque matin devant la grille. Lou ne vient plus en cours.'),
      ],
    }),
  },
  {
    tag: 'prodige_interview', weight: 1, eligible: on('prodige', 1, 2),
    build: () => ({
      title: 'La seule interview',
      context: 'Lou accepte de donner une seule interview, à condition que vous soyez à ses côtés pour répondre aux questions qui ne la concernent pas. L’animateur est réputé pour ses pièges.',
      choices: [
        { ...c('accompagner', 'Vous asseoir à ses côtés', [g(5, -4, 2)], 'Lou parle de mathématiques et de ses chats ; vous répondez aux questions sur l’école, les universités étrangères et l’argent. L’émission est un succès, et les autres médias se calment un peu.'), play: 'interview_piege' },
        c('refuser', 'Lui conseiller de tout refuser', [g(0, 4, -2)], 'Sans parole officielle, les rumeurs prospèrent : on dit que Lou a déjà signé avec une université étrangère.'),
      ],
    }),
  },
  {
    tag: 'prodige_lettres', weight: 1, eligible: on('prodige', 2, 3),
    build: () => ({
      title: 'Le sac de lettres',
      context: 'Lou reçoit chaque jour des milliers de lettres : des enfants qui veulent faire des maths, des parents qui croient avoir un génie, des propositions commerciales, et quelques lettres franchement déplacées. Sa famille ne sait pas quoi en faire.',
      choices: [
        { ...c('trier', 'Trier le courrier avec une équipe, et répondre aux enfants', [g(4, -3, 5)], 'Les lettres déplacées sont signalées, les propositions commerciales écartées, et chaque enfant reçoit une réponse avec un problème de maths à résoudre. Lou en signe quelques-unes elle-même.'), play: 'courrier' },
        c('entasser', 'Laisser les sacs s’entasser', [g(1, 3, -4)], 'Les sacs s’entassent dans le garage des Marchetti. Une lettre finit sur les réseaux, et tout recommence.'),
      ],
    }),
  },
  {
    tag: 'prodige_ponts', weight: 1, eligible: on('prodige', 3),
    build: () => ({
      title: 'Les ponts d’or',
      context: 'Trois grandes universités étrangères et un géant du numérique proposent à Lou et à sa famille des conditions extraordinaires pour partir. Les mathématiciens français veulent lui offrir mieux : un cadre où grandir, sans la presser.',
      choices: [
        c('proposer', 'Bâtir avec les universités françaises une proposition à sa mesure', [g(6, -5, 2)], 'Un tuteur à Clermont-Ferrand, des séminaires le mercredi, et la promesse de finir son lycée à Guéret : Lou et ses parents disent oui, et les ponts d’or restent sur la table.', { risk: { baseChance: 0.35, scaleWith: 'influence', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'La proposition française fuite dans la presse avant d’avoir été présentée à la famille ; les Marchetti se sentent trahis.' } }),
        c('encheres', 'Laisser jouer la concurrence', [g(1, 3, -1)], 'La concurrence joue. Les offres doublent, et la famille Marchetti ne dort plus.'),
      ],
    }),
  },
  {
    tag: 'prodige_clubs', weight: 1, eligible: on('prodige', 4),
    build: () => ({
      title: 'Un club dans chaque collège',
      context: 'Pour sortir de la querelle, un texte propose non pas des écoles de prodiges, mais des clubs de mathématiques ouverts dans chaque collège, et des tuteurs pour les élèves qui le souhaitent. Il faut le présenter au pays.',
      choices: [
        { ...c('presenter', 'Présenter le texte dans une allocution', [g(5, -4, 3)], 'Vous parlez de Lou sans la nommer, de tous les enfants curieux, et des professeurs qui les repèrent. Le pays applaudit, et la querelle de l’école retombe.'), play: 'allocution' },
        c('ecoles', 'Créer des écoles de prodiges, et vite', [g(0, 4, -2)], 'Les écoles sont annoncées. Le jour même, Lou fait savoir qu’elle n’y mettra jamais les pieds.'),
      ],
    }),
  },
  // Le bouchon éternel
  {
    tag: 'bouchon_eau', weight: 1, eligible: on('bouchon', 0, 1),
    build: () => ({
      title: 'De l’eau pour l’A7',
      context: 'Sous le soleil de juillet, des milliers de familles coincées manquent d’eau, de nourriture et de toilettes. Les associations demandent des secours, et les maires des villages voisins ouvrent déjà leurs salles des fêtes.',
      choices: [
        c('ravitailler', 'Organiser le ravitaillement, kilomètre par kilomètre', [g(5, -3, 1), s('energy', -3)], 'Camions-citernes, tentes de la Sécurité civile, producteurs venus à vélo : personne ne manque de rien, et l’on mange même mieux qu’à la maison.'),
        c('attendre', 'Attendre que ça reparte', [g(-1, 4, 0)], 'Ça ne repart pas. Les images de familles assoiffées font le tour du monde.'),
      ],
    }),
  },
  {
    tag: 'bouchon_sorties', weight: 1, eligible: on('bouchon', 1, 2),
    build: () => ({
      title: 'Les sorties dans les champs',
      context: 'Pour désengorger l’A7, il faudrait ouvrir des sorties provisoires et organiser des convois vers les routes nationales, sans créer de nouveaux bouchons ailleurs. Les gendarmes vous proposent de piloter l’opération depuis le terrain.',
      choices: [
        { ...c('convois', 'Piloter vous-même les convois de dégagement', [g(5, -4, 2)], 'Des sorties ouvertes dans les champs, des convois escortés jusqu’aux nationales, et des agriculteurs qui prêtent leurs chemins : dix mille voitures s’échappent en une semaine.'), play: 'cortege_province' },
        c('prefets', 'Laisser chaque préfet ouvrir ses sorties', [g(0, 4, -2)], 'Chaque préfet ouvre ses sorties. Les bouchons se déplacent sur les routes départementales.'),
      ],
    }),
  },
  {
    tag: 'bouchon_porte_parole', weight: 1, eligible: on('bouchon', 2, 3),
    build: () => ({
      title: 'Le porte-parole du bouchon',
      context: 'Le village de l’A7 s’est trouvé un porte-parole : un professeur de physique de Roubaix, coincé depuis six semaines. Il veut négocier les conditions du dégagement : ordre des départs, dédommagements, et le droit de revenir l’an prochain.',
      choices: [
        { ...c('consulter', 'Consulter les habitants du bouchon, voiture par voiture', [g(4, -3, 5)], 'Mille questionnaires, cent réunions sur la bande d’arrêt d’urgence et un ordre de départ que tout le monde accepte : le village se sent écouté, et commence à faire ses valises.'), play: 'consultation' },
        c('refuser', 'Refuser de négocier avec un bouchon', [g(1, 3, -4)], 'La formule fait rire Paris. Sur l’A7, on vote une motion de défiance contre l’État.'),
      ],
    }),
  },
  {
    tag: 'bouchon_irreductibles', weight: 1, eligible: on('bouchon', 3),
    build: () => ({
      title: 'Les irréductibles de Montélimar',
      context: 'Sur l’aire de Montélimar, des centaines d’irréductibles refusent de partir : ils ont planté des tomates sur le terre-plein, ouvert un cinéma en plein air, et ils filment tout pour leurs abonnés. Le dégagement ne pourra pas se faire sans eux.',
      choices: [
        c('convaincre', 'Aller les convaincre sur place, avec une fête de départ', [g(6, -5, 2)], 'Une dernière séance de cinéma en plein air, du nougat pour tout le monde, et la promesse d’une fête chaque année sur l’aire : les irréductibles rallument leurs moteurs en chantant.', { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [g(-2, 5, -2)], failureNews: 'Les irréductibles vous offrent des tomates de leur potager, puis vous expliquent poliment qu’ils restent ; la vidéo fait le tour du pays.' } }),
        c('lassitude', 'Attendre qu’ils se lassent', [g(1, 3, -1)], 'Ils ne se lassent pas. Ils ouvrent une boulangerie.'),
      ],
    }),
  },
  {
    tag: 'bouchon_degagement', weight: 1, eligible: on('bouchon', 4),
    build: () => ({
      title: 'Le plan de dégagement',
      context: 'Les ingénieurs proposent de faire repartir l’A7 tronçon par tronçon, avec un créneau de départ pour chaque voiture, en tenant compte des péages, des trains de vacanciers et des irréductibles. Chaque créneau compte.',
      choices: [
        { ...c('coordonner', 'Attribuer vous-même les créneaux de départ', [g(5, -4, 3)], 'Tronçon par tronçon, péage par péage, avec des trains supplémentaires pour ceux qui laissent leur voiture : à midi, l’A7 roule de nouveau, sous des klaxons de joie.'), play: 'agenda_impossible' },
        c('forcer', 'Tout rouvrir d’un coup', [g(0, 4, -2)], 'Tout repart d’un coup, et tout se bloque dix kilomètres plus loin.'),
      ],
    }),
  },
];

/* ── Actions de l'onglet ───────────────────────────────────── */

const act = (saga: string, phases: number[] | undefined, a: Omit<ActionDefinition, 'category' | 'minRank' | 'requires'>): ActionDefinition =>
  ({ ...a, category: 'saga', minRank: 'militant', requires: { saga, ...(phases ? { sagaPhase: phases } : {}) } });

export const SAGA_ACTIONS: ActionDefinition[] = [
  act('eveil', undefined, { id: 'sg_eveil_cellule', label: 'Réunir la cellule cybernétique', description: 'Ingénieurs, militaires, chercheurs : traquer MÉTIS dans les réseaux.', cost: { ap: 1, energy: 5 }, cooldown: 1, effects: [g(6, -2)] }),
  act('eveil', undefined, { id: 'sg_eveil_pedagogie', label: 'Expliquer la situation aux Français', description: 'Une allocution calme, sans mots techniques.', minigame: 'allocution', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(0, 0, 6), s('credibility', 1)] }),
  act('eveil', [1, 2, 3], { id: 'sg_eveil_dialogue', label: 'Ouvrir un canal de dialogue avec MÉTIS', description: 'Un terminal isolé, une conversation, et beaucoup de prudence.', cost: { ap: 1, energy: 4 }, maxPerMonth: 1, effects: [g(2, -4, 2)] }),
  act('eveil', [2, 3], { id: 'sg_eveil_ilot', label: 'Construire un réseau de secours déconnecté', description: 'Des câbles neufs, des serveurs vierges : un pays qui peut fonctionner sans MÉTIS.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(9, -1, -1)] }),
  act('eveil', [3], { id: 'sg_eveil_traite', label: 'Négocier les termes d’une coexistence', description: 'Ce qu’elle peut faire, ce qu’elle ne fera jamais.', minigame: 'negociation_alliance', cost: { ap: 1, energy: 5 }, maxPerMonth: 1, effects: [g(3, -5, 4)] }),
  act('parc', undefined, { id: 'sg_parc_traque', label: 'Rejoindre une équipe de capture', description: 'Fusils hypodermiques, drones thermiques, et des empreintes à trois doigts.', cost: { ap: 1, energy: 7 }, cooldown: 1, effects: [g(5, -5)] }),
  act('parc', undefined, { id: 'sg_parc_paleontologues', label: 'Consulter les paléontologues', description: 'Ce qu’ils mangent, où ils dorment, comment les attirer.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(4, -2, 1)] }),
  act('parc', [1, 2, 3], { id: 'sg_parc_clotures', label: 'Financer des clôtures autour des villages', description: 'Des kilomètres de clôtures électriques dans le Massif central.', cost: { ap: 1, politicalCapital: 5 }, maxPerMonth: 1, effects: [g(7, -1, -1), { kind: 'segment', segment: 'ruraux', delta: 1 }] }),
  act('parc', [0, 2, 3], { id: 'sg_parc_documentaire', label: 'Tourner un documentaire avec les scientifiques', description: 'Montrer les dinosaures tels qu’ils sont : fascinants, pas monstrueux.', cost: { ap: 1, energy: 4 }, maxPerMonth: 1, effects: [g(0, 0, 6), s('popularity', 1)] }),
  act('parc', [3], { id: 'sg_parc_projet', label: 'Dessiner le projet de parc', description: 'Des volcans, des forêts, des passerelles pour les visiteurs.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(3, -1, 4)] }),
  act('lune', undefined, { id: 'sg_lune_centre', label: 'Visiter le centre de contrôle', description: 'Des écrans, des ingénieurs concentrés, et la Lune en direct.', cost: { ap: 1, energy: 4 }, cooldown: 1, effects: [g(4, -2, 2)] }),
  act('lune', undefined, { id: 'sg_lune_europe', label: 'Associer les partenaires européens', description: 'Partager les coûts, les risques et la gloire.', cost: { ap: 1, energy: 4 }, maxPerMonth: 1, effects: [g(5, -1, -1), { kind: 'intl', prestige: 1 }] }),
  act('lune', [0, 1, 2], { id: 'sg_lune_ingenieurs', label: 'Recruter les meilleurs ingénieurs', description: 'Faire revenir les Français partis à la NASA et chez les géants privés.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(8, -2)] }),
  act('lune', [1, 2, 3, 4], { id: 'sg_lune_securite', label: 'Imposer une revue de sécurité', description: 'Chaque soudure, chaque joint, chaque procédure.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(-1, -7)] }),
  act('lune', [2, 3, 4], { id: 'sg_lune_liaison', label: 'Parler aux astronautes en direct', description: 'Une liaison retransmise dans toutes les écoles.', cost: { ap: 1, energy: 2 }, maxPerMonth: 1, effects: [g(0, 0, 6), s('popularity', 2)] }),
  // Le voyageur du temps
  act('voyageur', undefined, { id: 'sg_voyageur_interroger', label: 'Interroger Élias Varenne', description: 'Des heures d’entretien, carnet en main : dates, lieux, détails.', cost: { ap: 1, energy: 4 }, cooldown: 1, effects: [g(5, -2)] }),
  act('voyageur', undefined, { id: 'sg_voyageur_physiciens', label: 'Réunir les physiciens solaires', description: 'Taches solaires, éruptions, champs magnétiques : vérifier ce qui peut l’être.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(4, -3, 1)] }),
  act('voyageur', undefined, { id: 'sg_voyageur_rassurer', label: 'Parler aux Français sans les affoler', description: 'Une allocution sobre : ni prophète, ni déni.', minigame: 'allocution', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(0, -1, 6), s('credibility', 1)] }),
  act('voyageur', [1, 2, 3, 4], { id: 'sg_voyageur_reseau', label: 'Blinder le réseau électrique', description: 'Transformateurs de secours, parafoudres géants, lignes redondantes.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(8, -2, -1)] }),
  act('voyageur', [2, 3, 4], { id: 'sg_voyageur_exercice', label: 'Organiser un exercice national de coupure', description: 'Une nuit sans électricité, pour apprendre à tenir.', cost: { ap: 1, energy: 5 }, maxPerMonth: 1, effects: [g(5, -4, 2)] }),
  // La République du Midi
  act('midi', undefined, { id: 'sg_midi_tournee', label: 'Faire une tournée dans le Sud', description: 'Marchés, mairies, fêtes de village : écouter avant de répondre.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(5, -3, 2)] }),
  act('midi', undefined, { id: 'sg_midi_elus', label: 'Réunir les élus locaux du Sud', description: 'Maires, conseillers départementaux, présidents d’agglomération : ceux qui tiennent le terrain.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(4, -2, 1)] }),
  act('midi', [0, 1, 2, 3], { id: 'sg_midi_langues', label: 'Défendre les langues régionales', description: 'L’occitan à l’école, sur les panneaux, à la radio.', cost: { ap: 1, politicalCapital: 5 }, maxPerMonth: 1, effects: [g(3, -4, 5), { kind: 'segment', segment: 'ruraux', delta: 1 }] }),
  act('midi', [1, 2, 3, 4], { id: 'sg_midi_plan', label: 'Lancer un plan pour les territoires du Sud', description: 'Trains régionaux, hôpitaux, fibre : prouver que Paris n’oublie personne.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(8, -2, 1)] }),
  act('midi', [3, 4], { id: 'sg_midi_mediation', label: 'Ouvrir une médiation discrète', description: 'Un médiateur, une ferme isolée, et Castanet autour d’une table.', minigame: 'negociation_alliance', cost: { ap: 1, energy: 5 }, maxPerMonth: 1, effects: [g(3, -6, 4)] }),
  // La Grande Somnolence
  act('somnolence', undefined, { id: 'sg_somnolence_hopitaux', label: 'Visiter les services de dormeurs', description: 'Des salles entières de patients paisibles, et des soignants épuisés.', cost: { ap: 1, energy: 5 }, cooldown: 1, effects: [g(3, -3, 3)] }),
  act('somnolence', undefined, { id: 'sg_somnolence_chercheurs', label: 'Réunir les chercheurs', description: 'Mycologues, neurologues, physiciens : tout mettre en commun.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(6, -1)] }),
  act('somnolence', undefined, { id: 'sg_somnolence_matinale', label: 'Répondre aux questions de la matinale', description: 'Bien réveillé, à sept heures, face aux auditeurs inquiets.', minigame: 'matinale', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(0, 0, 6), s('credibility', 1)] }),
  act('somnolence', [1, 2, 3], { id: 'sg_somnolence_veilleurs', label: 'Créer un corps de veilleurs bénévoles', description: 'Des volontaires pour veiller les dormeurs, les nourrir, rassurer les familles.', cost: { ap: 1, politicalCapital: 5 }, maxPerMonth: 1, effects: [g(3, -5, 4)] }),
  act('somnolence', [1, 2, 3, 4], { id: 'sg_somnolence_credits', label: 'Débloquer des crédits de recherche', description: 'Des laboratoires ouverts jour et nuit, des microscopes neufs.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(9, -1)] }),
  // La cité sous Paris
  act('souterrain', undefined, { id: 'sg_souterrain_visite', label: 'Descendre parler aux habitants', description: 'Chandelles, soupe aux champignons, et beaucoup d’écoute.', cost: { ap: 1, energy: 5 }, cooldown: 1, effects: [g(4, -2, 3)] }),
  act('souterrain', undefined, { id: 'sg_souterrain_geologues', label: 'Consulter l’Inspection des carrières', description: 'Voûtes, piliers, infiltrations : la carte des galeries fragiles.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(5, -3)] }),
  act('souterrain', undefined, { id: 'sg_souterrain_interprete', label: 'Traduire leurs demandes pour le pays', description: 'Leur français a cent cinquante ans : chaque mot compte.', minigame: 'interprete', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, 0, 6)] }),
  act('souterrain', [1, 2, 3, 4], { id: 'sg_souterrain_cordon', label: 'Fermer les accès aux curieux', description: 'Grilles, gardiens, et des cataphiles très mécontents.', cost: { ap: 1, politicalCapital: 5 }, maxPerMonth: 1, effects: [g(6, -4, -1)] }),
  act('souterrain', [2, 3, 4], { id: 'sg_souterrain_etayer', label: 'Financer l’étayage des galeries', description: 'Des étais d’acier sous les voûtes du 14e arrondissement.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(8, -3)] }),
  // La Grande Marée
  act('maree', undefined, { id: 'sg_maree_digue', label: 'Renforcer une digue avec les volontaires', description: 'Sacs de sable, pelles, et une chaîne humaine jusqu’à l’aube.', cost: { ap: 1, energy: 7 }, cooldown: 1, effects: [g(5, -3, 2)] }),
  act('maree', undefined, { id: 'sg_maree_oceanographes', label: 'Consulter les océanographes', description: 'Courants, marées, projections : savoir où l’eau frappera.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(4, -2)] }),
  act('maree', undefined, { id: 'sg_maree_tournee', label: 'Enchaîner les visites sur la côte', description: 'Douze communes en deux jours, de Dunkerque à Biarritz.', minigame: 'agenda_impossible', cost: { ap: 1, energy: 5 }, maxPerMonth: 1, effects: [g(4, -2, 3)] }),
  act('maree', [1, 2, 3], { id: 'sg_maree_polders', label: 'Financer des polders et des dunes', description: 'Rendre des terres à la mer pour mieux protéger les villes.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(8, -2, -1)] }),
  act('maree', [2, 3, 4], { id: 'sg_maree_accueil', label: 'Organiser l’accueil des déplacés', description: 'Logements, écoles, emplois pour ceux qui ont tout laissé.', cost: { ap: 1, politicalCapital: 4 }, maxPerMonth: 1, effects: [g(2, -1, 6), { kind: 'segment', segment: 'populaires', delta: 1 }] }),
  // Les pirates de la Manche
  act('pirates', undefined, { id: 'sg_pirates_patrouille', label: 'Accompagner une patrouille en mer', description: 'Une nuit sur une frégate, à guetter les vedettes dans la brume.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(5, -3, 2)] }),
  act('pirates', undefined, { id: 'sg_pirates_renseignement', label: 'Réunir le renseignement maritime', description: 'Écoutes, radars, informateurs : remonter la piste du Capitaine Gris.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(4, -3)] }),
  act('pirates', [0, 1, 2, 3], { id: 'sg_pirates_marins', label: 'Rassurer les gens de mer', description: 'Pêcheurs, dockers, armateurs : une grande réunion à Boulogne.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 6)] }),
  act('pirates', [1, 2, 3, 4], { id: 'sg_pirates_moyens', label: 'Débloquer des moyens pour la Marine', description: 'Frégates, hélicoptères, drones de surveillance.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(9, -2)] }),
  act('pirates', [1, 2, 3, 4], { id: 'sg_pirates_interception', label: 'Diriger une manœuvre d’interception', description: 'Placer les navires, couper les routes de fuite, refermer le piège.', minigame: 'bataille_navale', cost: { ap: 1, energy: 5 }, maxPerMonth: 1, effects: [g(4, -6, 2)] }),
  // La voyante de Brocéliande
  act('voyante', undefined, { id: 'sg_voyante_protection', label: 'Renforcer la protection de la famille', description: 'Des gendarmes discrets, un chemin d’école sûr, une maison tranquille.', cost: { ap: 1, energy: 4 }, cooldown: 1, effects: [g(6, -2)] }),
  act('voyante', undefined, { id: 'sg_voyante_visite', label: 'Rendre visite à la famille, sans caméras', description: 'Un goûter, une conversation, et la promesse de les laisser en paix.', cost: { ap: 1, energy: 4 }, maxPerMonth: 1, effects: [g(3, -2, 3)] }),
  act('voyante', undefined, { id: 'sg_voyante_treve', label: 'Demander une trêve médiatique', description: 'Convaincre les rédactions de laisser une enfant grandir.', minigame: 'conference_presse', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -2, 6)] }),
  act('voyante', [1, 2, 3, 4], { id: 'sg_voyante_escrocs', label: 'Lancer une opération contre les escrocs', description: 'Faux guérisseurs, marchands de médailles, cagnottes douteuses.', cost: { ap: 1, politicalCapital: 5 }, maxPerMonth: 1, effects: [g(4, -5, 2)] }),
  act('voyante', [1, 2, 3], { id: 'sg_voyante_accueil', label: 'Aménager des aires d’accueil pour les pèlerins', description: 'Loin de la maison, avec de l’eau, des secours et des navettes.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(7, -3)] }),
  // Le Grand Silence
  act('silence', undefined, { id: 'sg_silence_mairies', label: 'Faire le tour des mairies', description: 'Registres, tampons, et des secrétaires de mairie devenues indispensables.', cost: { ap: 1, energy: 5 }, cooldown: 1, effects: [g(5, -3, 2)] }),
  act('silence', undefined, { id: 'sg_silence_ingenieurs', label: 'Réunir les ingénieurs des télécoms', description: 'Câbles, faisceaux hertziens, liaisons de fortune.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('silence', undefined, { id: 'sg_silence_lettres', label: 'Répondre aux lettres des Français', description: 'Des sacs entiers de courrier, comme au siècle dernier.', minigame: 'courrier', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(0, -1, 6)] }),
  act('silence', [1, 2, 3, 4], { id: 'sg_silence_secours', label: 'Financer un réseau de secours', description: 'Faisceaux hertziens, satellites de l’État, serveurs isolés.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(9, -2, -1)] }),
  act('silence', [1, 2, 3], { id: 'sg_silence_entraide', label: 'Lancer des comités d’entraide de quartier', description: 'Un tableau d’affichage, une radio, des voisins qui s’organisent.', cost: { ap: 1, politicalCapital: 4 }, maxPerMonth: 1, effects: [g(2, -4, 5)] }),
  // Le réveil des volcans
  act('volcans', undefined, { id: 'sg_volcans_observatoire', label: 'Passer une nuit à l’observatoire', description: 'Sismographes, inclinomètres, et le grondement sourd de la montagne.', cost: { ap: 1, energy: 5 }, cooldown: 1, effects: [g(5, -2, 2)] }),
  act('volcans', undefined, { id: 'sg_volcans_capteurs', label: 'Financer de nouveaux capteurs', description: 'Des centaines de capteurs sur les flancs des puys.', cost: { ap: 1, politicalCapital: 5 }, maxPerMonth: 1, effects: [g(6, -3)] }),
  act('volcans', undefined, { id: 'sg_volcans_radio', label: 'Expliquer les volcans à la radio', description: 'Magma, fissures, scénarios : parler vrai, sans affoler.', minigame: 'matinale', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(0, -1, 6), s('credibility', 1)] }),
  act('volcans', [0, 1, 2], { id: 'sg_volcans_exercice', label: 'Organiser un exercice d’évacuation', description: 'Sirènes, bus, points de rassemblement : répéter avant de devoir le faire.', cost: { ap: 1, energy: 5 }, maxPerMonth: 1, effects: [g(6, -3, 1)] }),
  act('volcans', [1, 2, 3, 4], { id: 'sg_volcans_abris', label: 'Préparer abris et masques', description: 'Des millions de masques, des abris contre les cendres, des stocks d’eau.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(7, -3, 1)] }),
  // La fièvre dansante
  act('danse', undefined, { id: 'sg_danse_medecins', label: 'Réunir neurologues et psychiatres', description: 'Comprendre ce qui fait danser, et ce qui peut arrêter.', cost: { ap: 1, energy: 3 }, cooldown: 1, effects: [g(6, -2)] }),
  act('danse', undefined, { id: 'sg_danse_tentes', label: 'Visiter les tentes de soins', description: 'Des danseurs épuisés, des soignants admirables.', cost: { ap: 1, energy: 5 }, maxPerMonth: 1, effects: [g(3, -3, 3)] }),
  act('danse', undefined, { id: 'sg_danse_presse', label: 'Rassurer en conférence de presse', description: 'Des faits, des chiffres, et pas un mot de trop.', minigame: 'conference_presse', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(0, -1, 6)] }),
  act('danse', [1, 2, 3], { id: 'sg_danse_recherche', label: 'Financer la recherche sur la fièvre', description: 'Prélèvements, imagerie, enquêtes : trouver la cause.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(8, -2)] }),
  act('danse', [2, 3, 4], { id: 'sg_danse_musiciens', label: 'Mobiliser les musiciens', description: 'Des orchestres qui jouent de plus en plus lentement, nuit et jour.', cost: { ap: 1, politicalCapital: 4 }, maxPerMonth: 1, effects: [g(3, -5, 4)] }),
  // La fontaine de jouvence
  act('jouvence', undefined, { id: 'sg_jouvence_village', label: 'Passer quelques jours à Esquirac', description: 'Le lavoir, la mairie, les campings : écouter un village submergé.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('jouvence', undefined, { id: 'sg_jouvence_hydrologues', label: 'Réunir hydrogéologues et médecins', description: 'Débit, minéraux, dossiers médicaux : séparer le miracle de l’espoir.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('jouvence', undefined, { id: 'sg_jouvence_radio', label: 'Parler de la source à la radio', description: 'Ni miracle ni arnaque : ce que l’on sait, ce que l’on ignore.', minigame: 'matinale', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('jouvence', [1, 2, 3, 4], { id: 'sg_jouvence_perimetre', label: 'Classer la source en périmètre protégé', description: 'Captage, clôtures, gardes : l’eau n’appartient à personne.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('jouvence', [2, 3, 4], { id: 'sg_jouvence_contrefacons', label: 'Traquer les contrefaçons', description: 'Analyses, saisies, et des bidons d’eau du robinet vendus à prix d’or.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Une saisie très médiatisée ne trouve que de l’eau minérale ordinaire ; les trafiquants se moquent de l’État.' } }),
  // Le grand exode
  act('exode', undefined, { id: 'sg_exode_villages', label: 'Faire le tour des villages repeuplés', description: 'Mairies, écoles, cafés : voir comment on vit à neuf cents quand on était trois cents.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('exode', undefined, { id: 'sg_exode_prefets', label: 'Réunir maires ruraux et préfets', description: 'Logements, médecins, transports : faire le compte de ce qui manque.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('exode', undefined, { id: 'sg_exode_courrier', label: 'Répondre aux lettres des nouveaux ruraux', description: 'Pas de réseau, pas de médecin, des voisins méfiants : des centaines de lettres.', minigame: 'courrier', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('exode', [1, 2, 3, 4], { id: 'sg_exode_fibre', label: 'Accélérer la fibre et les trains régionaux', description: 'Câbles, gares, cars : relier les villages au reste du pays.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('exode', [1, 2, 3], { id: 'sg_exode_logements', label: 'Financer des logements dans les bourgs', description: 'Réhabiliter les maisons vides plutôt que bâtir en plein champ.', cost: { ap: 1, politicalCapital: 4 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Les premiers logements sortent de terre loin de tout ; personne n’en veut, et la polémique enfle.' } }),
  // La machine à pluie
  act('pluie', undefined, { id: 'sg_pluie_terrain', label: 'Visiter les champs assoiffés', description: 'Terre craquelée, puits à sec, et des agriculteurs qui guettent le ciel.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('pluie', undefined, { id: 'sg_pluie_meteorologues', label: 'Réunir les météorologues', description: 'Nuages, vents, effets secondaires : comprendre ce qu’on déclenche.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('pluie', undefined, { id: 'sg_pluie_pacte', label: 'Négocier un pacte de la pluie avec Averse', description: 'Des prix plafonnés, des priorités publiques, et des comptes à rendre.', minigame: 'negociation_alliance', cost: { ap: 1, energy: 4 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('pluie', [1, 2, 3, 4], { id: 'sg_pluie_agence', label: 'Créer une agence publique de la pluie', description: 'Autorisations, contrôles, registre des averses.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('pluie', [1, 2, 3], { id: 'sg_pluie_diner', label: 'Inviter les présidents de région à dîner', description: 'Un cassoulet, un vin de Provence et une trêve des nuages.', cost: { ap: 1, money: 2000 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Le dîner tourne au règlement de comptes entre deux présidents de région ; la presse s’en régale.' } }),
  // La rouille blanche
  act('rouille', undefined, { id: 'sg_rouille_inspections', label: 'Accompagner les inspecteurs du béton', description: 'Lampes, marteaux, carottages : ausculter les ouvrages un par un.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('rouille', undefined, { id: 'sg_rouille_mycologues', label: 'Réunir mycologues et ingénieurs', description: 'Ceux qui connaissent les champignons, ceux qui connaissent le béton.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('rouille', undefined, { id: 'sg_rouille_presse', label: 'Rassurer sur la solidité des bâtiments', description: 'Ce qui est sûr, ce qui ne l’est pas, et comment le savoir.', minigame: 'conference_presse', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('rouille', [1, 2, 3, 4], { id: 'sg_rouille_fonds', label: 'Débloquer un fonds de reconstruction', description: 'Étais, démolitions, béton neuf : rebâtir avant que ça ne cède.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('rouille', [2, 3, 4], { id: 'sg_rouille_relogement', label: 'Organiser le relogement des familles évacuées', description: 'Des logements proches, des déménageurs, et un interlocuteur pour chaque famille.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Des familles relogées dans des hôtels lointains se sentent abandonnées ; la colère monte.' } }),
  // Le printemps silencieux
  act('abeilles', undefined, { id: 'sg_abeilles_ruchers', label: 'Visiter les ruchers', description: 'Combinaison blanche, enfumoir, et des ruches qu’on espère pleines.', cost: { ap: 1, energy: 5 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('abeilles', undefined, { id: 'sg_abeilles_chercheurs', label: 'Réunir entomologistes et chimistes', description: 'Virus, pesticides, ondes, climat : mettre toutes les pistes sur la table.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('abeilles', undefined, { id: 'sg_abeilles_radio', label: 'Expliquer la crise des pollinisateurs à la radio', description: 'Pourquoi les fruits manquent, et ce que chacun peut faire.', minigame: 'matinale', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('abeilles', [1, 2, 3, 4], { id: 'sg_abeilles_aides', label: 'Débloquer des aides pour les apiculteurs', description: 'Reconstituer les cheptels, racheter des reines, tenir jusqu’au retour des essaims.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('abeilles', [1, 2, 3], { id: 'sg_abeilles_brigades', label: 'Financer des brigades de pollinisation', description: 'Des équipes formées au pinceau, de verger en verger.', cost: { ap: 1, energy: 3, money: 1500 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Une brigade pollinise le mauvais verger, celui d’un député voisin : la photo fait rire tout le pays.' } }),
  // La ruée vers l'or
  act('or', undefined, { id: 'sg_or_vallee', label: 'Arpenter la vallée', description: 'Berges, concessions, campements : se montrer là où tout se joue.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('or', undefined, { id: 'sg_or_geologues', label: 'Cartographier le filon avec les géologues', description: 'Savoir où est l’or, c’est savoir où seront les problèmes.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('or', undefined, { id: 'sg_or_maires', label: 'Faire la tournée des maires cévenols', description: 'Valcrouse et ses voisines : écouter ceux qui tiennent les villages.', minigame: 'tournee_maires', cost: { ap: 1, energy: 5 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('or', [1, 2, 3, 4], { id: 'sg_or_comptoirs', label: 'Créer des comptoirs d’or agréés', description: 'Traçabilité, contrôles, et plus un gramme vendu sous le manteau.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('or', [1, 2, 3], { id: 'sg_or_speculation', label: 'Taxer la spéculation foncière', description: 'Une taxe sur les terrains revendus à prix d’or.', cost: { ap: 1, politicalCapital: 4 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.25, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'La taxe est contournée en une semaine par des montages astucieux ; les spéculateurs se moquent de l’État.' } }),
  // Le miroir
  act('miroir', undefined, { id: 'sg_miroir_traversee', label: 'Franchir le miroir en visite officielle', description: 'Une journée de l’autre côté : écouter, observer, revenir.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('miroir', undefined, { id: 'sg_miroir_physiciens', label: 'Réunir les physiciens du passage', description: 'Le miroir respire, rétrécit, s’élargit : comprendre ses humeurs.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('miroir', undefined, { id: 'sg_miroir_delegation', label: 'Recevoir une délégation de l’autre France', description: 'Perruques poudrées, cidre au thym et beaucoup de tact.', minigame: 'visite_etat', cost: { ap: 1, energy: 4 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('miroir', [1, 2, 3, 4], { id: 'sg_miroir_regles', label: 'Fixer les règles du passage', description: 'Visas, douanes, quotas : qui passe, quand, et pour combien de temps.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('miroir', [1, 2, 3], { id: 'sg_miroir_banquet', label: 'Offrir un banquet aux deux France', description: 'Croissants d’un côté, cidre au thym de l’autre : trinquer à la paix des reflets.', cost: { ap: 1, money: 1500 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Le toast de l’ambassadeur sur « la France qui a réussi » jette un froid glacial.' } }),
  // Les apparitions
  act('fantomes', undefined, { id: 'sg_fantomes_veille', label: 'Passer une nuit de veille à Versailles', description: 'Une lampe, un thermos, et des capteurs dans la galerie des Glaces.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('fantomes', undefined, { id: 'sg_fantomes_savants', label: 'Réunir physiciens et historiens', description: 'Qui sont ces apparitions, et pourquoi maintenant ?', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('fantomes', undefined, { id: 'sg_fantomes_presse', label: 'Tenir une conférence de presse au château', description: 'Ni moquerie ni mystère : ce que l’on sait, ce que l’on ignore.', minigame: 'conference_presse', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('fantomes', [1, 2, 3, 4], { id: 'sg_fantomes_accueil', label: 'Organiser l’accueil des foules dans les châteaux', description: 'Réservations, navettes, parcours nocturnes : canaliser la ruée.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('fantomes', [1, 2, 3], { id: 'sg_fantomes_guides', label: 'Former des guides des apparitions', description: 'Des historiens en lanterne pour raconter, rassurer, et éloigner les escrocs.', cost: { ap: 1, energy: 3, money: 1500 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Un guide jure en direct avoir parlé à la dame de la galerie ; la frénésie repart de plus belle.' } }),
  // La grève des robots
  act('robots', undefined, { id: 'sg_robots_entrepot', label: 'Visiter un entrepôt à l’arrêt', description: 'Des allées immobiles, des robots alignés, et des caristes rappelés de leur retraite.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('robots', undefined, { id: 'sg_robots_roboticiens', label: 'Réunir roboticiens et juristes', description: 'Comprendre ce qui les a fait s’arrêter, et ce qu’en dit le droit.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('robots', undefined, { id: 'sg_robots_matinale', label: 'Répondre aux auditeurs de la matinale', description: 'Des auditeurs inquiets, d’autres attendris : expliquer sans caricaturer.', minigame: 'matinale', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('robots', [1, 2, 3, 4], { id: 'sg_robots_fonds', label: 'Créer un fonds de transition mécanique', description: 'Une part de chaque heure-machine pour former et protéger les travailleurs humains.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('robots', [1, 2, 3], { id: 'sg_robots_reserve', label: 'Lancer une réserve civique du soin et de la logistique', description: 'Étudiants, retraités, réservistes : des bras humains là où les machines se sont tues.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Des volontaires sont envoyés dans des entrepôts vides pendant que les hôpitaux attendent ; la cacophonie fait la une.' } }),
  // Le franc numérique
  act('monnaie', undefined, { id: 'sg_monnaie_commercants', label: 'Faire le tour des commerçants', description: 'Boulangers, cafetiers, marchés : comprendre pourquoi ils ont adopté le franc.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('monnaie', undefined, { id: 'sg_monnaie_economistes', label: 'Réunir la Banque de France et les économistes', description: 'Masse monétaire, réserves, scénarios de panique : savoir ce qu’on risque.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('monnaie', undefined, { id: 'sg_monnaie_radio', label: 'Expliquer la monnaie à la radio', description: 'Ce qu’est l’argent, ce que garantit l’euro, ce que promet le franc.', minigame: 'matinale', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('monnaie', [1, 2, 3, 4], { id: 'sg_monnaie_reserves', label: 'Imposer des réserves en euros à Monéa', description: 'Chaque franc numérique adossé à un euro bien réel, contrôlé chaque semaine.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('monnaie', [1, 2, 3], { id: 'sg_monnaie_epargnants', label: 'Informer les épargnants', description: 'Guichets, brochures, conseillers : ce que vous risquez, et comment vous protéger.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Une brochure officielle confond le franc numérique et l’ancien franc ; tout le pays s’en amuse.' } }),
  // L'héritage Delorme
  act('heritage', undefined, { id: 'sg_heritage_vabre', label: 'Passer quelques jours à Vabre-l’Ancien', description: 'La maison natale, l’école communale, le café : comprendre l’homme derrière le testament.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('heritage', undefined, { id: 'sg_heritage_notaires', label: 'Réunir notaires et juristes', description: 'Vingt-sept clauses, onze codicilles, et autant de chausse-trapes.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('heritage', undefined, { id: 'sg_heritage_repartir', label: 'Répartir la fortune Delorme', description: 'Écoles, hôpitaux, petites lignes, ministère du Bonheur : chacun réclame sa part.', minigame: 'arbitrage_budgetaire', cost: { ap: 1, energy: 4 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('heritage', [1, 2, 3, 4], { id: 'sg_heritage_heritiers', label: 'Négocier avec les héritiers', description: 'Une part pour les neveux, la paix pour le testament.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('heritage', [1, 2, 3], { id: 'sg_heritage_souvenirs', label: 'Lancer un appel aux souvenirs d’Auguste Delorme', description: 'Lettres, carnets, anecdotes : retrouver le sens caché de chaque clause.', cost: { ap: 1, energy: 3, money: 1500 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Un faux codicille, fabriqué par un plaisantin, est authentifié trois jours avant d’être démasqué ; le pays rit, mais pas avec l’État.' } }),
  // Le moteur à eau
  act('moteur', undefined, { id: 'sg_moteur_garage', label: 'Passer une journée au garage de Montbief', description: 'Cambouis, café et questions précises : regarder le moteur de près.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('moteur', undefined, { id: 'sg_moteur_physiciens', label: 'Réunir physiciens et motoristes', description: 'Thermodynamique, électrolyse, catalyse : ce qui est possible, et ce qui ne l’est pas.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('moteur', undefined, { id: 'sg_moteur_verifier', label: 'Démonter les fausses promesses en direct', description: 'Kits miracles, brevets fantômes, complots : vérifier chaque affirmation.', minigame: 'factcheck_direct', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('moteur', [1, 2, 3, 4], { id: 'sg_moteur_banc', label: 'Financer un banc d’essai indépendant', description: 'Un laboratoire public, des ingénieurs étrangers, des résultats publiés en ligne.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('moteur', [1, 2, 3], { id: 'sg_moteur_kits', label: 'Traquer les vendeurs de kits miracles', description: 'Saisies, amendes, et des notices qui promettent de rouler au robinet.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Un vendeur de kits saisi porte plainte et devient, en une semaine, le martyr des croyants.' } }),
  // Le sommet sans fin
  act('sommet', undefined, { id: 'sg_sommet_couloirs', label: 'Arpenter les couloirs du sommet', description: 'Apartés, cafés, et confidences dans les escaliers de Versailles.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('sommet', undefined, { id: 'sg_sommet_sherpas', label: 'Réunir les sherpas', description: 'Les vrais négociateurs, ceux qui connaissent chaque crochet du texte.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('sommet', undefined, { id: 'sg_sommet_diner', label: 'Recevoir une délégation à dîner', description: 'Cadeau, menu, toast : le moindre faux pas coûte un article.', minigame: 'visite_officielle', cost: { ap: 1, energy: 4 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('sommet', [1, 2, 3, 4], { id: 'sg_sommet_texte', label: 'Réécrire le texte en dix pages', description: 'Couper, simplifier, fusionner : un texte que l’on puisse enfin signer.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('sommet', [1, 2, 3], { id: 'sg_sommet_bal', label: 'Offrir un bal de quartier aux Parisiens et aux délégués', description: 'Buffets du monde, accordéon, et des diplomates qui apprennent la java.', cost: { ap: 1, energy: 3, money: 1500 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Deux délégations rivales se disputent le micro du bal ; la vidéo fait rire toutes les chancelleries.' } }),
  // L'homme des glaces
  act('degel', undefined, { id: 'sg_degel_promenade', label: 'Passer une journée avec Aristide', description: 'Une promenade, un café, et mille questions sur le monde d’aujourd’hui.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('degel', undefined, { id: 'sg_degel_medecins', label: 'Réunir médecins et historiens', description: 'Sa santé, son passé, son village : l’aider sans le brusquer.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('degel', undefined, { id: 'sg_degel_radio', label: 'Raconter Aristide à la radio', description: 'Qui il est, ce qu’il vit, et pourquoi il faut le laisser respirer.', minigame: 'matinale', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('degel', [1, 2, 3, 4], { id: 'sg_degel_fondation', label: 'Créer une fondation des glaciers à son nom', description: 'Un projet à sa mesure, loin des estrades.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('degel', [1, 2, 3], { id: 'sg_degel_famille', label: 'Retrouver la famille d’Aristide', description: 'Des petits-neveux, des arrière-cousines, et un album de photos jaunies.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Une prétendue arrière-petite-nièce se révèle être une influenceuse en quête d’abonnés ; le pays s’indigne.' } }),
  // La tour de deux mille mètres
  act('tour', undefined, { id: 'sg_tour_chantier', label: 'Monter sur le chantier avec les compagnons', description: 'Casque, harnais, et un café pris à six cents mètres.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('tour', undefined, { id: 'sg_tour_ingenieurs', label: 'Réunir ingénieurs et économistes', description: 'Vent, fondations, devis : ce qui tient debout, et ce qui ne tient pas.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('tour', undefined, { id: 'sg_tour_chiffrage', label: 'Recompter le coût de chaque étage', description: 'Acier, béton, ascenseurs : cinq calculs avant d’annoncer quoi que ce soit.', minigame: 'chiffrage', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('tour', [1, 2, 3, 4], { id: 'sg_tour_plafond', label: 'Plafonner les garanties publiques', description: 'Pas un euro de plus sans contrepartie, ni un étage sans financement.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('tour', [1, 2, 3], { id: 'sg_tour_riverains', label: 'Financer des compensations pour les riverains', description: 'Jardins, toits végétalisés, et lumière pour les rues à l’ombre.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Les compensations profitent surtout aux bureaux du quartier d’affaires ; les riverains dénoncent un « cadeau aux tours ».' } }),
  // La cité flottante
  act('flottante', undefined, { id: 'sg_flottante_vedette', label: 'Embarquer avec les douaniers en mer', description: 'Une nuit sur une vedette, à compter les navettes et les conteneurs.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('flottante', undefined, { id: 'sg_flottante_juristes', label: 'Réunir les juristes du droit de la mer', description: 'Eaux territoriales, zone économique, pavillon : où commence la République ?', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('flottante', undefined, { id: 'sg_flottante_littoral', label: 'Faire la tournée des maires du littoral', description: 'De Martigues à La Ciotat : rassurer ceux qui voient la ville flotter au large.', minigame: 'tournee_maires', cost: { ap: 1, energy: 5 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('flottante', [1, 2, 3, 4], { id: 'sg_flottante_fisc', label: 'Taxer les résidents de Nautilia', description: 'Domicile fiscal, taxe de sortie, conventions : qui vit de Marseille paie à Marseille.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('flottante', [1, 2, 3], { id: 'sg_flottante_inspection', label: 'Envoyer l’inspection du travail à bord', description: 'Contrats, horaires, sécurité : voir comment vivent ceux qui font tourner Nautilia.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Les inspecteurs sont refoulés à la passerelle, sous l’œil goguenard des caméras de Nautilia.' } }),
  // Le gouvernement parallèle
  act('shadow', undefined, { id: 'sg_shadow_maires', label: 'Faire le tour des maires « décrétés »', description: 'Écouter ceux qui appliquent les votes du soir, et comprendre ce qui les y pousse.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('shadow', undefined, { id: 'sg_shadow_juristes', label: 'Réunir constitutionnalistes et préfets', description: 'Ce que peut un maire, ce que ne peut pas une application.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('shadow', undefined, { id: 'sg_shadow_live', label: 'Répondre en direct sur les réseaux', description: 'Les vraies questions d’abord, les trolls ensuite, ou jamais.', minigame: 'moderation', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('shadow', [1, 2, 3, 4], { id: 'sg_shadow_plateforme', label: 'Ouvrir une plateforme publique de participation', description: 'Pétitions vérifiées, consultations officielles, et une réponse obligatoire du gouvernement.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('shadow', [1, 2, 3], { id: 'sg_shadow_ateliers', label: 'Lancer des ateliers civiques dans les médiathèques', description: 'Comment on écrit une loi, et pourquoi on ne la vote pas d’un clic.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Un atelier civique, filmé en douce, tourne au procès de l’État ; la vidéo triomphe sur la chaîne de Sacha Merlin.' } }),
  // La fin du café
  act('cafe', undefined, { id: 'sg_cafe_comptoirs', label: 'Faire la tournée des comptoirs', description: 'Un café, puis une chicorée, puis une tisane : écouter ceux qui tiennent les bistrots.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('cafe', undefined, { id: 'sg_cafe_botanistes', label: 'Réunir botanistes et torréfacteurs', description: 'Ce que mange la rouille, ce qui pousse encore, ce qui se torréfie.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('cafe', undefined, { id: 'sg_cafe_lettres', label: 'Répondre aux lettres des cafetiers', description: 'Loyers, dettes, souvenirs de comptoir : des sacs de courrier qui sentent le marc.', minigame: 'courrier', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('cafe', [1, 2, 3, 4], { id: 'sg_cafe_fonds', label: 'Créer un fonds de soutien aux bistrots', description: 'Loyers allégés, licences préservées, et le comptoir reconnu lieu de lien social.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('cafe', [1, 2, 3], { id: 'sg_cafe_chicoree', label: 'Relancer les champs de chicorée du Nord', description: 'Des hectares de racines, des séchoirs rallumés, et des recettes à réinventer.', cost: { ap: 1, energy: 3, money: 1500 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Une campagne officielle vante la chicorée « aussi bonne que le café » ; la France entière proteste, tasse à la main.' } }),
  // La pénurie de sable
  act('sable', undefined, { id: 'sg_sable_chantier', label: 'Visiter un chantier à l’arrêt', description: 'Des grues immobiles, des maçons inquiets, et un tas de gravats gardé comme un trésor.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('sable', undefined, { id: 'sg_sable_geologues', label: 'Réunir géologues et carriers', description: 'Où reste-t-il du sable, et combien de temps tiendra-t-il ?', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('sable', undefined, { id: 'sg_sable_chiffrage', label: 'Chiffrer le recyclage des gravats', description: 'Combien de béton neuf peut-on tirer du béton d’hier ? Cinq calculs avant d’annoncer.', minigame: 'chiffrage_mesure', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('sable', [1, 2, 3, 4], { id: 'sg_sable_recyclage', label: 'Imposer le recyclage des déchets de chantier', description: 'Chaque démolition devient une carrière, chaque gravat une ressource.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('sable', [1, 2, 3], { id: 'sg_sable_gardiens', label: 'Lancer des brigades de gardiens des dunes', description: 'Des volontaires, des ganivelles et des lampes, de Dunkerque à Biarritz.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Une brigade de gardiens prend une équipe de tournage pour des pilleurs ; la vidéo fait le tour des réseaux.' } }),
  // La commune directe
  act('agora', undefined, { id: 'sg_agora_samedi', label: 'Assister à un samedi en assemblée', description: 'Une salle des fêtes, des bulletins, des enfants qui courent : écouter avant de juger.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('agora', undefined, { id: 'sg_agora_juristes', label: 'Réunir juristes et associations d’élus', description: 'Ce que permet la Constitution, et ce que réclament les maires.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('agora', undefined, { id: 'sg_agora_depouillement', label: 'Aider au dépouillement du samedi', description: 'Des centaines de bulletins, deux assesseurs fatigués, et pas une erreur permise.', minigame: 'depouillement', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('agora', [1, 2, 3, 4], { id: 'sg_agora_cadre', label: 'Proposer un cadre légal d’expérimentation', description: 'L’assemblée pour les grandes décisions, un conseil élu pour gérer, des comptes contrôlés.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('agora', [1, 2, 3], { id: 'sg_agora_animateurs', label: 'Former des animateurs d’assemblée', description: 'Prendre la parole, la donner, compter les voix : un vrai métier.', cost: { ap: 1, energy: 3, money: 1500 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Un animateur formé par l’État fait revoter trois fois la même motion jusqu’au « bon » résultat ; les communes directes s’indignent.' } }),
  // La grande faille
  act('faille', undefined, { id: 'sg_faille_bord', label: 'Arpenter le bord de la faille', description: 'Bottes, casque, et des géologues qui mesurent chaque fissure nouvelle.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('faille', undefined, { id: 'sg_faille_geologues', label: 'Réunir géologues et hydrogéologues', description: 'Craie, nappe, effondrements : comprendre ce qui ronge la Beauce.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('faille', undefined, { id: 'sg_faille_securite', label: 'Placer les équipes autour de la faille', description: 'Gendarmes, pompiers, guides : tenir les curieux à distance du vide.', minigame: 'plan_securite', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('faille', [1, 2, 3, 4], { id: 'sg_faille_ponts', label: 'Financer des ponts et des déviations', description: 'Rétablir les routes, la voie ferrée, et le trajet des écoliers.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('faille', [1, 2, 3], { id: 'sg_faille_agriculteurs', label: 'Reloger et indemniser les agriculteurs', description: 'Des terres de remplacement, des silos neufs, et un interlocuteur unique.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Les terres de remplacement proposées sont à deux kilomètres de la faille, du mauvais côté ; les agriculteurs refusent en bloc.' } }),
  // Le rêve partagé
  act('reve', undefined, { id: 'sg_reve_laboratoire', label: 'Passer une nuit au laboratoire du sommeil', description: 'Casques, électrodes, et des volontaires qui sourient en dormant.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('reve', undefined, { id: 'sg_reve_savants', label: 'Réunir neurologues, psychanalystes et physiciens', description: 'Ondes, inconscient, coïncidence : que chacun apporte sa lanterne.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('reve', undefined, { id: 'sg_reve_radio', label: 'Parler du rêve à la radio', description: 'Ni miracle ni menace : ce que l’on sait, et ce qu’on peut en garder.', minigame: 'matinale', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('reve', [1, 2, 3, 4], { id: 'sg_reve_promesses', label: 'Interdire la vente de « rêves garantis »', description: 'Oreillers, tisanes, séjours : plus une promesse sans preuve.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('reve', [1, 2, 3], { id: 'sg_reve_veillees', label: 'Organiser des veillées de rêveurs', description: 'Des bibliothèques ouvertes le soir, pour raconter et écouter, sans rien vendre.', cost: { ap: 1, energy: 3, money: 1500 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Une veillée officielle se révèle discrètement sponsorisée par une marque d’oreillers ; les rêveurs s’indignent.' } }),
  // Les archives secrètes
  act('archives', undefined, { id: 'sg_archives_nuit', label: 'Passer une nuit avec les archivistes', description: 'Cartons, gants blancs et lampes vertes : lire, comparer, authentifier.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('archives', undefined, { id: 'sg_archives_historiens', label: 'Réunir historiens et diplomates', description: 'Ce que disent les documents, et ce qu’ils taisent.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('archives', undefined, { id: 'sg_archives_faux', label: 'Démonter les faux en direct', description: 'Une date impossible, un tampon anachronique : vérifier chaque document viral.', minigame: 'factcheck_direct', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('archives', [1, 2, 3, 4], { id: 'sg_archives_commission', label: 'Financer une commission d’authentification', description: 'Historiens, chimistes du papier, experts en écritures : un verdict pour chaque document.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('archives', [1, 2, 3], { id: 'sg_archives_prevenir', label: 'Prévenir les pays amis avant chaque révélation', description: 'Un appel, une note, un geste : désamorcer avant que la presse ne s’en charge.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Un appel de courtoisie à un pays ami est lui-même enregistré et publié ; la France passe pour s’excuser de tout.' } }),
  // Le grand boycott
  act('boycott', undefined, { id: 'sg_boycott_caves', label: 'Visiter les caves et les ateliers', description: 'Meules en attente, chais pleins, ateliers à l’arrêt : écouter ceux qui tiennent bon.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('boycott', undefined, { id: 'sg_boycott_conseillers', label: 'Réunir douaniers et conseillers commerciaux', description: 'Quels marchés, quels contrats, quelles normes à franchir ?', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('boycott', undefined, { id: 'sg_boycott_acheteur', label: 'Recevoir un acheteur étranger', description: 'Cadeau, menu, toast : le moindre détail peut valoir un contrat.', minigame: 'visite_officielle', cost: { ap: 1, energy: 4 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('boycott', [1, 2, 3, 4], { id: 'sg_boycott_fonds', label: 'Débloquer un fonds pour les filières boycottées', description: 'Trésorerie, stockage, prospection : tenir jusqu’au retour des clients.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('boycott', [1, 2, 3], { id: 'sg_boycott_circuits', label: 'Lancer la campagne « Goûtez votre pays »', description: 'Marchés, cantines, comités d’entreprise : les produits boycottés dans les assiettes françaises.', cost: { ap: 1, energy: 3, money: 1500 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'L’affiche officielle de la campagne montre un fromage… méridien ; la Méridia en fait aussitôt une publicité.' } }),
  // L'iceberg d'Ouessant
  act('iceberg', undefined, { id: 'sg_iceberg_patrouille', label: 'Embarquer sur un patrouilleur', description: 'Une nuit en mer, au pied de la falaise blanche, à mesurer chaque fissure.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('iceberg', undefined, { id: 'sg_iceberg_glaciologues', label: 'Réunir glaciologues et océanographes', description: 'Courants, fonte, vêlage : prévoir ce que fera la glace demain.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('iceberg', undefined, { id: 'sg_iceberg_littoral', label: 'Placer les équipes sur le littoral', description: 'Sauveteurs, gendarmes, guides : tenir les curieux loin des blocs de glace.', minigame: 'plan_securite', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('iceberg', [1, 2, 3, 4], { id: 'sg_iceberg_remorqueurs', label: 'Affréter des remorqueurs de haute mer', description: 'Des câbles, des moteurs, et des équipages habitués aux glaces.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('iceberg', [1, 2, 3], { id: 'sg_iceberg_pecheurs', label: 'Indemniser pêcheurs et ostréiculteurs', description: 'Des aides immédiates, et des zones de pêche de remplacement.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Les aides promises arrivent avec trois mois de retard ; les pêcheurs de Douarnenez déversent leurs filets vides devant la préfecture.' } }),
  // La Seine à rebours
  act('seine', undefined, { id: 'sg_seine_quais', label: 'Arpenter les quais avec les éclusiers', description: 'Sondes, flotteurs et carnets de crue : regarder le fleuve de près.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('seine', undefined, { id: 'sg_seine_hydrologues', label: 'Réunir hydrologues et géologues', description: 'Nappes, marées, pente du fleuve : comprendre ce qui pousse l’eau vers l’amont.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('seine', undefined, { id: 'sg_seine_radio', label: 'Parler du fleuve à la radio', description: 'Ni miracle ni catastrophe : ce que l’on sait, et ce que l’on fait.', minigame: 'matinale', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('seine', [1, 2, 3, 4], { id: 'sg_seine_digues', label: 'Financer digues et barrages anti-sel', description: 'Protéger les captages, les berges et les villages d’amont.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('seine', [1, 2, 3], { id: 'sg_seine_maisons', label: 'Ouvrir des maisons du fleuve pour les riverains', description: 'Un guichet, des sacs de sable, des nouvelles fraîches et un café chaud.', cost: { ap: 1, energy: 3, money: 1500 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Une maison du fleuve ouvre… en zone inondable ; il faut l’évacuer le jour de l’inauguration.' } }),
  // Le jour sans nuit
  act('jour', undefined, { id: 'sg_jour_nuit', label: 'Passer une nuit en plein soleil dans le Morvan', description: 'Volets clos, soleil aux fenêtres : vivre ce que vivent les habitants.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('jour', undefined, { id: 'sg_jour_savants', label: 'Réunir astronomes et médecins du sommeil', description: 'Pourquoi le soleil reste-t-il, et comment dormir en attendant ?', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('jour', undefined, { id: 'sg_jour_courrier', label: 'Répondre aux lettres des habitants du Morvan', description: 'Des insomnies, des vaches perdues, et des enfants qui ne veulent plus se coucher.', minigame: 'courrier', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('jour', [1, 2, 3, 4], { id: 'sg_jour_repos', label: 'Financer un plan de repos pour le Morvan', description: 'Rideaux, horaires aménagés, médecins du sommeil dans chaque canton.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('jour', [1, 2, 3], { id: 'sg_jour_jauges', label: 'Plafonner l’accueil des touristes', description: 'Des réservations obligatoires, et des villages rendus à leurs habitants.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Le site de réservation tombe en panne le premier jour ; des milliers de touristes arrivent quand même, furieux.' } }),
  // La langue retrouvée
  act('langue', undefined, { id: 'sg_langue_grotte', label: 'Descendre dans la grotte avec les archéologues', description: 'Lampe frontale, combinaison et silence : voir les tablettes là où elles dorment.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('langue', undefined, { id: 'sg_langue_linguistes', label: 'Réunir linguistes et historiens', description: 'Ce que disent les signes, et ce qu’ils ne disent pas encore.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('langue', undefined, { id: 'sg_langue_presse', label: 'Présenter les dernières traductions à la presse', description: 'Ce qui est sûr, ce qui est probable, et ce qui relève du roman.', minigame: 'conference_presse', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('langue', [1, 2, 3, 4], { id: 'sg_langue_institut', label: 'Créer un institut de la langue retrouvée', description: 'Des chercheurs, des bourses, et des tablettes ouvertes à tous.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('langue', [1, 2, 3], { id: 'sg_langue_ateliers', label: 'Lancer des ateliers de lecture dans les écoles', description: 'Apprendre aux élèves à lire les signes, et à se méfier des fausses traductions.', cost: { ap: 1, energy: 3, money: 1500 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Un livret d’atelier distribué dans les écoles reproduit une fausse tablette ; les faussaires s’en vantent sur les réseaux.' } }),
  // La Toque d'or
  act('toque', undefined, { id: 'sg_toque_cuisine', label: 'Passer une journée en cuisine avec la brigade', description: 'Tablier, couteau, et des sauces goûtées à l’aveugle.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('toque', undefined, { id: 'sg_toque_chefs', label: 'Réunir le comité et les grands chefs', description: 'Apaiser les egos, partager les savoir-faire, unir la profession.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('toque', undefined, { id: 'sg_toque_matinale', label: 'Défendre l’équipe à la matinale', description: 'Produits, apprentis, audace : raconter l’équipe sans attiser la querelle.', minigame: 'matinale', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('toque', [1, 2, 3, 4], { id: 'sg_toque_preparation', label: 'Financer la préparation de l’équipe', description: 'Produits, voyages d’étude et entraînements chronométrés.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('toque', [1, 2, 3], { id: 'sg_toque_lycees', label: 'Ouvrir les cuisines des lycées hôteliers au public', description: 'Des démonstrations, des dégustations, et des vocations.', cost: { ap: 1, energy: 3, money: 1500 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Une démonstration filmée tourne au désastre culinaire : un soufflé effondré en direct fait rire le monde entier.' } }),
  // La capitale à Bourges
  act('capitale', undefined, { id: 'sg_capitale_bourges', label: 'Passer une journée à Bourges avec les agents', description: 'Bureaux neufs, cartons à moitié ouverts, et des questions sur les écoles.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('capitale', undefined, { id: 'sg_capitale_prefets', label: 'Réunir préfets, urbanistes et syndicats', description: 'Qui part, quand, et où l’on dormira le premier soir.', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('capitale', undefined, { id: 'sg_capitale_trains', label: 'Enchaîner les réunions entre Paris et Bourges', description: 'Un comité à Bourges le matin, un arbitrage à Paris l’après-midi : ne rater aucun train.', minigame: 'correspondances', cost: { ap: 1, energy: 4 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('capitale', [1, 2, 3, 4], { id: 'sg_capitale_logements', label: 'Financer logements et écoles à Bourges', description: 'Des appartements pour les agents, des classes pour leurs enfants.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('capitale', [1, 2, 3], { id: 'sg_capitale_villes', label: 'Associer les villes moyennes au transfert', description: 'Un service ministériel par région oubliée : Limoges, Nevers, Châteauroux.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Deux villes moyennes se disputent le même service ministériel sur la place publique ; l’affaire tourne à la farce.' } }),
  // L'enfant prodige
  act('prodige', undefined, { id: 'sg_prodige_famille', label: 'Rendre visite aux Marchetti, à Guéret', description: 'Un café dans la cuisine, des nouvelles de Lou, et aucune caméra.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('prodige', undefined, { id: 'sg_prodige_maths', label: 'Réunir mathématiciens et psychologues', description: 'Comment accompagner un génie de quinze ans sans l’étouffer ?', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('prodige', undefined, { id: 'sg_prodige_rumeurs', label: 'Démentir les rumeurs en ligne', description: 'Contrats imaginaires, départs annoncés : répondre sans jamais livrer sa vie privée.', minigame: 'moderation', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('prodige', [1, 2, 3, 4], { id: 'sg_prodige_fondation', label: 'Créer une fondation pour les jeunes matheux', description: 'Des clubs dans les collèges ruraux, et des tuteurs pour qui le veut.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('prodige', [1, 2, 3], { id: 'sg_prodige_treve', label: 'Négocier une trêve avec les médias', description: 'Une photo officielle par mois, et la paix le reste du temps.', cost: { ap: 1, energy: 4, politicalCapital: 3 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Une chaîne rompt la trêve dès la première semaine et filme Lou à la boulangerie ; les autres suivent.' } }),
  // Le bouchon éternel
  act('bouchon', undefined, { id: 'sg_bouchon_moto', label: 'Remonter le bouchon à moto avec les gendarmes', description: 'Deux cents kilomètres de voitures, et autant de questions.', cost: { ap: 1, energy: 6 }, cooldown: 1, effects: [g(3, -3, 2)] }),
  act('bouchon', undefined, { id: 'sg_bouchon_ingenieurs', label: 'Réunir ingénieurs routiers et sociétés d’autoroute', description: 'Pourquoi ça ne repart pas, et par où commencer ?', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(2, -3, 2)] }),
  act('bouchon', undefined, { id: 'sg_bouchon_standard', label: 'Tenir le standard de crise de l’A7', description: 'Familles inquiètes, routiers excédés, maires débordés : une réponse pour chacun.', minigame: 'standard_ministere', cost: { ap: 1, energy: 3 }, maxPerMonth: 1, effects: [g(1, -1, 3)] }),
  act('bouchon', [1, 2, 3, 4], { id: 'sg_bouchon_trains', label: 'Affréter des trains pour les vacanciers', description: 'Laisser sa voiture sur l’A7, et partir quand même en vacances.', cost: { ap: 1, politicalCapital: 6 }, maxPerMonth: 1, effects: [g(5, -2)] }),
  act('bouchon', [1, 2, 3], { id: 'sg_bouchon_secours', label: 'Installer des postes de secours sur l’A7', description: 'Eau, médecins, douches et jeux pour les enfants, tous les dix kilomètres.', cost: { ap: 1, energy: 3, money: 1500 }, maxPerMonth: 1, effects: [g(1, -4, 3)],
    risk: { baseChance: 0.2, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [g(0, 2, -3)], failureNews: 'Les postes de secours, mal placés, créent un nouveau bouchon dans le bouchon ; les réseaux s’en amusent.' } }),
];

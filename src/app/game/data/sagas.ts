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
];

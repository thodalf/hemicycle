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
];

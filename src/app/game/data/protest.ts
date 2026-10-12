import { ProtestCause, ProtestEvent } from '../models/game.models';
import { balanceProtest } from './balance';

/* ============================================================
 *  Manifestations : causes possibles et événements par étape.
 *  turnout en %, tension / médias / image en points.
 * ============================================================ */

export const CAUSES: ProtestCause[] = [
  { id: 'salaires', label: 'Pour les salaires et le pouvoir d’achat', domain: 'social', lean: -1 },
  { id: 'climat', label: 'Marche pour le climat', domain: 'ecologie', lean: -1 },
  { id: 'ecole', label: 'Pour l’école publique et ses enseignants', domain: 'education', lean: -1 },
  { id: 'hopital', label: 'Contre la fermeture de la maternité', domain: 'sante', lean: 0 },
  { id: 'gare', label: 'Pour sauver la petite ligne de train', domain: 'territoires', lean: 0 },
  { id: 'securite', label: 'Contre l’insécurité dans le quartier', domain: 'securite', lean: 1 },
  { id: 'carburants', label: 'Contre la hausse des taxes sur les carburants', domain: 'territoires', lean: 1 },
  { id: 'agriculteurs', label: 'Aux côtés des agriculteurs étranglés par les normes', domain: 'economie', lean: 1 },
  { id: 'peines', label: 'Pour que les peines soient vraiment exécutées', domain: 'justice', lean: 1 },
  { id: 'numerique', label: 'Contre la surveillance de masse en ligne', domain: 'numerique', lean: -1 },
];

const RAW_MOBILISATION: ProtestEvent = {
  id: 'mobilisation', phase: 'mobilisation', title: 'Préparer la mobilisation',
  context: 'J-7. Il faut remplir les rues. Comment faites-vous venir du monde ?',
  choices: [
    {
      id: 'tracts', label: 'Tractage massif sur les marchés et aux sorties de métro',
      hint: '1 500 € de tracts. Fiable, sans risque.',
      delta: { turnout: 18, money: 1500, image: 2 }, text: 'Vos équipes distribuent 40 000 tracts en une semaine.',
    },
    {
      id: 'reseaux', label: 'Campagne virale sur les réseaux sociaux',
      hint: 'Mobilise vite, échauffe les esprits.',
      delta: { turnout: 26, media: 10, tension: 10 },
      risk: { chance: 0.3, scaleWith: 'credibility', weight: 0.6, onFail: { turnout: 10, image: -10, tension: 15 }, failText: 'Un visuel maladroit déclenche une polémique.' },
      text: 'Le hashtag de l’appel entre dans les tendances.',
    },
    {
      id: 'appel_commun', label: 'Négocier un appel commun avec vos alliés',
      hint: 'Nécessite au moins un allié. Gros renfort de troupes.',
      requires: { ally: true },
      delta: { turnout: 35, image: 5, tension: 5 }, text: 'Vos alliés appellent officiellement à rejoindre le cortège.',
    },
    {
      id: 'prefecture', label: 'Déclarer un parcours court et sûr en préfecture',
      hint: 'Moins spectaculaire, beaucoup plus calme.',
      delta: { turnout: -5, tension: -15, image: 3 }, text: 'Le parcours est validé sans difficulté.',
    },
  ],
};

const RAW_CORTEGE: ProtestEvent[] = [
  {
    id: 'pluie', phase: 'cortege', title: 'Pluie battante au départ',
    context: 'Une averse s’abat sur la place de départ. Les rangs hésitent.',
    choices: [
      { id: 'galvaniser', label: 'Maintenir et galvaniser la foule au mégaphone', delta: { turnout: -8, image: 6, media: 6 }, text: '« Ce n’est pas la pluie qui nous fera reculer ! » Le cortège s’ébranle.' },
      { id: 'raccourcir', label: 'Raccourcir le parcours', delta: { turnout: -18, tension: -10 }, text: 'Le défilé est écourté, une partie du public rentre chez elle.' },
      { id: 'ponchos', label: 'Distribuer des ponchos aux couleurs du mouvement', hint: '800 €.', delta: { turnout: -3, media: 10, money: 800 }, text: 'Une marée de ponchos colorés : les photographes adorent.' },
    ],
  },
  {
    id: 'tete', phase: 'cortege', title: 'Qui prend la tête du cortège ?',
    context: 'Les photographes attendent l’image du premier rang.',
    choices: [
      {
        id: 'vous', label: 'Vous, au premier rang, bras dessus bras dessous',
        delta: { media: 15, image: 4, tension: 5 },
        risk: { chance: 0.3, scaleWith: 'popularity', weight: 0.7, onFail: { image: -10, media: 10 }, failText: 'Une partie du cortège vous siffle : « Récupération ! »' },
        text: 'Votre visage fait la une des sites d’information.',
      },
      { id: 'allies', label: 'Les représentants de vos alliés', requires: { ally: true }, delta: { image: 9, media: -3 }, text: 'Le front uni impressionne : ce n’est pas « votre » manifestation.' },
      { id: 'citoyens', label: 'Des citoyens directement concernés par la cause', delta: { image: 11, media: 4 }, text: 'Leurs témoignages bouleversent les reporters.' },
    ],
  },
  {
    id: 'contre', phase: 'cortege', title: 'Des contre-manifestants sur le parcours',
    context: 'Un groupe hostile s’est posté au carrefour, banderoles déployées.',
    choices: [
      { id: 'ignorer', label: 'Les ignorer et avancer', delta: { tension: 12 }, text: 'Les invectives fusent des deux côtés.' },
      { id: 'devier', label: 'Dévier le cortège par une rue parallèle', delta: { tension: -10, turnout: -8 }, text: 'Le détour évite l’affrontement, mais disperse le cortège.' },
      {
        id: 'dialoguer', label: 'Aller leur parler, caméras tournantes',
        delta: { media: 16, image: 6 },
        risk: { chance: 0.4, scaleWith: 'credibility', weight: 0.6, onFail: { tension: 25, image: -8, media: 12 }, failText: 'L’échange dégénère en bousculade.' },
        text: 'Une poignée de main inattendue : l’image tourne en boucle.',
      },
      { id: 'police', label: 'Demander aux forces de l’ordre de les éloigner', delta: { tension: -6, image: -4 }, text: 'Les policiers s’interposent. Certains vous le reprochent.' },
    ],
  },
];

const RAW_INCIDENTS: ProtestEvent[] = [
  {
    id: 'casseurs', phase: 'incident', title: 'Des casseurs cagoulés se mêlent au cortège',
    context: 'Des vitrines tremblent. Les CRS se rapprochent.',
    choices: [
      {
        id: 'service_ordre', label: 'Votre service d’ordre les isole',
        delta: { tension: -15, image: 4 },
        risk: { chance: 0.35, scaleWith: 'influence', weight: 0.6, onFail: { tension: 22, image: -6 }, failText: 'Bousculades entre votre service d’ordre et les casseurs.' },
        text: 'Le cortège se resserre, les casseurs sont écartés.',
      },
      { id: 'stop', label: 'Arrêter le cortège et appeler au calme', delta: { turnout: -12, tension: -20, image: 6 }, text: 'Le cortège s’immobilise. Le calme revient lentement.' },
      { id: 'continuer', label: 'Continuer comme si de rien n’était', delta: { tension: 25, media: 8 }, text: 'Des vitrines volent en éclats derrière vous.' },
      { id: 'condamner', label: 'Condamner fermement les violences au micro', delta: { image: 9, tension: -6, media: 5 }, text: '« Ces gens-là ne sont pas des nôtres. » Votre fermeté est saluée.' },
    ],
  },
  {
    id: 'journaliste', phase: 'incident', title: 'Une chaîne d’info vous tend le micro en direct',
    context: '« Concrètement, que proposez-vous ? »',
    choices: [
      {
        id: 'chiffres', label: 'Répondre avec des chiffres précis',
        hint: 'Dépend de votre maîtrise du dossier de la cause.',
        delta: { media: 18, image: 10 },
        risk: { chance: 0.85, scaleWith: 'dossier', weight: 1, onFail: { image: -12, media: 10 }, failText: 'Vous vous trompez de chiffres en direct. Le fact-checking tombe dans l’heure.' },
        text: 'Une démonstration claire : votre séquence est reprise partout.',
      },
      {
        id: 'formule', label: 'Une formule choc pour les journaux télévisés',
        delta: { media: 24, tension: 8, image: 3 },
        risk: { chance: 0.4, scaleWith: 'credibility', weight: 0.6, onFail: { image: -12 }, failText: 'La formule passe mal : on vous accuse de démagogie.' },
        text: 'Votre phrase est la citation du jour.',
      },
      { id: 'temoin', label: 'Laisser parler une manifestante', delta: { image: 12, media: 5 }, text: 'Son témoignage sincère émeut les téléspectateurs.' },
      { id: 'decliner', label: 'Décliner poliment', delta: { media: -5 }, text: 'L’équipe de tournage va chercher un autre interlocuteur.' },
    ],
  },
  {
    id: 'barrage', phase: 'incident', title: 'La police bloque l’accès à la place prévue',
    context: 'Un cordon de gendarmes ferme l’avenue. La tête du cortège s’arrête.',
    choices: [
      {
        id: 'negocier', label: 'Négocier directement avec la préfecture',
        delta: { tension: -12 },
        risk: { chance: 0.35, scaleWith: 'influence', weight: 0.7, onFail: { tension: 15 }, failText: 'La préfecture refuse de céder. La foule s’impatiente.' },
        text: 'Après vingt minutes au téléphone, le cordon s’ouvre.',
      },
      { id: 'forcer', label: 'Forcer le passage', delta: { tension: 30, media: 15, image: -6 }, text: 'Gaz lacrymogène, courses dans les rues : la journée bascule.' },
      { id: 'sur_place', label: 'Improviser le rassemblement sur place', delta: { turnout: -8, tension: -6, media: 4 }, text: 'La sono est installée au milieu de l’avenue.' },
      { id: 'sit_in', label: 'Un sit-in pacifique face au cordon', delta: { media: 15, image: 10, tension: 5 }, text: 'Des milliers de personnes assises en silence : l’image est forte.' },
    ],
  },
];

const RAW_DISCOURS: ProtestEvent = {
  id: 'discours', phase: 'discours', title: 'Votre discours à l’arrivée',
  context: 'La foule est devant l’estrade. Les caméras sont braquées sur vous.',
  choices: [
    { id: 'rassembleur', label: 'Un discours rassembleur, au-delà des camps', delta: { image: 12, stance: 0 }, text: 'Vous parlez à tout le pays, pas seulement aux convaincus.' },
    { id: 'combat', label: 'Un discours de combat, fidèle à la cause', delta: { media: 12, image: -3, tension: 6, stance: 2 }, text: 'La foule scande votre nom. Les plus modérés grimacent.' },
    {
      id: 'loi', label: 'Annoncer une proposition de loi précise',
      hint: 'Exige de maîtriser le dossier (40).',
      requires: { minMastery: 40 },
      delta: { media: 10, image: 9, stance: 1 }, text: 'Vous détaillez trois mesures concrètes. Les journalistes notent.',
    },
    { id: 'nouvelle_date', label: 'Appeler à une nouvelle journée de mobilisation', delta: { media: 6, tension: 10, turnout: 5, stance: 1 }, text: '« Rendez-vous dans quinze jours, encore plus nombreux ! »' },
  ],
};

/* Chaque choix a un prix et aucun ne domine les autres (voir data/balance.ts) */
export const MOBILISATION = balanceProtest(RAW_MOBILISATION);
export const CORTEGE = RAW_CORTEGE.map(balanceProtest);
export const INCIDENTS = RAW_INCIDENTS.map(balanceProtest);
export const DISCOURS = balanceProtest(RAW_DISCOURS);

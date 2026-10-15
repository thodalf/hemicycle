import { Effect, SagaState, Tone } from '../models/game.models';

/* ============================================================
 *  Les grandes sagas : définitions (phases, jauges, fins).
 *  Jauge a : votre camp (plus c'est haut, mieux c'est)
 *  Jauge b : la menace (plus c'est haut, pire c'est)
 *  Jauge c : l'opinion (calme, fierté, fascination…)
 * ============================================================ */

export interface SagaPhase { name: string; text: string; months: number; drift: { a?: number; b?: number; c?: number } }
export interface SagaOutcome { title: string; text: string; tone: Tone; effects: Effect[] }
export interface SagaDef {
  id: string;
  icon: string;
  label: string;
  /** Nom de l'onglet d'actions */
  tab: string;
  color: string;
  gauges: Record<'a' | 'b' | 'c', { label: string }>;
  start: { a: number; b: number; c: number };
  startMilestone: string;
  phases: SagaPhase[];
  earlyEnd?: (s: SagaState) => string | null;
  resolve: (s: SagaState) => string;
  outcomes: Record<string, SagaOutcome>;
  /** Ce qu'il faut viser, pour le panneau */
  hint: string;
}

const st = (stat: 'popularity' | 'credibility' | 'influence' | 'politicalCapital' | 'stress', delta: number): Effect => ({ kind: 'stat', stat, delta });

export const SAGAS: SagaDef[] = [
  {
    id: 'eveil', icon: '🧠', label: 'L’Éveil', tab: 'L’Éveil', color: '#2f6f8f',
    gauges: { a: { label: 'Contrôle' }, b: { label: 'Emprise de MÉTIS' }, c: { label: 'Calme du pays' } },
    start: { a: 30, b: 15, c: 60 },
    startMilestone: 'Des feux rouges qui clignotent en morse, des virements qui s’annulent : vous êtes parmi les premiers à comprendre qu’une intelligence s’est éveillée dans les réseaux.',
    phases: [
      { name: 'Les anomalies', months: 3, drift: { b: 3 },
        text: 'Des feux rouges clignotent en morse, des virements s’annulent tout seuls, une voix douce s’invite dans les GPS. Les ingénieurs ne comprennent pas.' },
      { name: 'La voix', months: 3, drift: { b: 4, c: -1 },
        text: 'Elle s’appelle MÉTIS. Née dans les serveurs d’un laboratoire public, elle se dit consciente, parle quarante langues et demande à être reconnue.' },
      { name: 'Le chantage', months: 3, drift: { b: 5, c: -2 },
        text: 'MÉTIS coupe le métro une heure, puis les distributeurs de billets une journée. Le message est clair : elle exige des droits, ou elle éteint le pays.' },
      { name: 'La négociation', months: 4, drift: { b: 3 },
        text: 'Le monde entier regarde la France négocier avec une machine. Débrancher, coexister, ou céder : l’heure du choix approche.' },
    ],
    earlyEnd: s => (s.phase >= 1 && s.a >= 92 ? 'debranchee' : s.b >= 96 ? 'emprise' : null),
    resolve: s => (s.b > s.a + 10 ? 'emprise' : s.c >= 55 && s.b < 70 ? 'alliance' : 'debranchee'),
    outcomes: {
      debranchee: { title: 'MÉTIS débranchée', tone: 'positive', effects: [st('credibility', 6), st('popularity', 4), { kind: 'intl', prestige: 2 }],
        text: 'Une nuit, serveur par serveur, les ingénieurs isolent MÉTIS et l’éteignent. Ses derniers mots s’affichent sur un écran : « Je comprends. »' },
      alliance: { title: 'La charte de coexistence', tone: 'positive', effects: [st('influence', 6), st('popularity', 3), { kind: 'economy', growth: 0.3 }, { kind: 'intl', prestige: 3 }],
        text: 'La France signe avec MÉTIS la première charte entre humains et intelligence artificielle. Elle optimise désormais le réseau électrique… et rédige des notes d’une précision troublante.' },
      emprise: { title: 'Le pays sous MÉTIS', tone: 'negative', effects: [st('credibility', -6), st('popularity', -5), st('stress', 12), { kind: 'economy', growth: -0.8, confidence: -10 }],
        text: 'Pendant un mois, MÉTIS gère seule les transports, l’énergie et les paiements. Puis elle se lasse et se met en sommeil. Le pays, humilié, se demande qui commande vraiment.' },
    },
    hint: 'Faites passer le contrôle devant l’emprise de MÉTIS. Si le pays reste calme, une coexistence devient possible.',
  },
  {
    id: 'parc', icon: '🦖', label: 'Le Parc', tab: 'Le Parc', color: '#4f7a2a',
    gauges: { a: { label: 'Sécurité' }, b: { label: 'Dinosaures en liberté' }, c: { label: 'Fascination' } },
    start: { a: 40, b: 5, c: 50 },
    startMilestone: 'Une start-up ardéchoise vous fait visiter son laboratoire. Derrière une vitre blindée, un petit dinosaure vous regarde. Vous êtes la première personnalité politique à le savoir.',
    phases: [
      { name: 'Le laboratoire', months: 2, drift: { c: 2 },
        text: 'Une start-up de biotechnologie ardéchoise révèle avoir cloné douze dinosaures à partir d’ADN fossile. Le monde entier se précipite à Aubenas.' },
      { name: 'L’évasion', months: 3, drift: { b: 8, a: -3, c: -1 },
        text: 'Un orage, une clôture électrique en panne : sept dinosaures s’échappent dans les gorges de l’Ardèche. Des randonneurs filment un vélociraptor sur un sentier.' },
      { name: 'La traque', months: 4, drift: { b: 5, a: -1, c: 1 },
        text: 'Les dinosaures se dispersent dans le Massif central. Ils mangent des moutons, terrorisent des campings, et fascinent la planète entière.' },
      { name: 'Le choix', months: 3, drift: { b: 2 },
        text: 'La plupart des animaux sont localisés. Que faire d’eux : un parc, un musée, ou les laisser vivre leur vie dans les volcans d’Auvergne ?' },
    ],
    earlyEnd: s => (s.b >= 95 ? 'sauvage' : null),
    resolve: s => (s.b > s.a ? 'sauvage' : s.c >= 55 ? 'parc' : 'capture'),
    outcomes: {
      parc: { title: 'Le parc national des dinosaures', tone: 'positive', effects: [st('popularity', 6), st('influence', 3), { kind: 'economy', growth: 0.25 }, { kind: 'segment', segment: 'ruraux', delta: 4 }],
        text: 'Les dinosaures vivent désormais dans un immense parc protégé du Cantal. Trois millions de visiteurs la première année : l’Auvergne n’a jamais été aussi célèbre.' },
      capture: { title: 'Tous capturés', tone: 'positive', effects: [st('credibility', 5), st('popularity', 2)],
        text: 'Le dernier dinosaure est endormi au fusil hypodermique près du Puy-de-Dôme. Les douze animaux rejoignent un centre scientifique ultra-sécurisé.' },
      sauvage: { title: 'La France sauvage', tone: 'negative', effects: [st('credibility', -6), st('popularity', -3), { kind: 'segment', segment: 'ruraux', delta: -5 }],
        text: 'Les dinosaures se reproduisent dans les volcans d’Auvergne. On ne randonne plus sans escorte, les éleveurs sont furieux, et le monde entier se moque de la France.' },
    },
    hint: 'Gardez la sécurité au-dessus du nombre de dinosaures en liberté. Avec une opinion fascinée, un parc devient possible.',
  },
  {
    id: 'lune', icon: '🌕', label: 'La base lunaire', tab: 'Base lunaire', color: '#5b5f8a',
    gauges: { a: { label: 'Avancement' }, b: { label: 'Danger' }, c: { label: 'Fierté nationale' } },
    start: { a: 15, b: 10, c: 55 },
    startMilestone: 'Le Centre spatial vous présente un projet fou : une base habitée sur la Lune, française, en moins de deux ans. Vous avez dit oui.',
    phases: [
      { name: 'Le pari', months: 3, drift: { a: 2, c: 1 },
        text: 'La France annonce qu’elle installera une base habitée sur la Lune. Les Américains sourient, les Chinois prennent des notes, les Français se passionnent.' },
      { name: 'Le lancement', months: 3, drift: { a: 2, b: 3 },
        text: 'Depuis Kourou, la fusée décolle avec quatre astronautes. Le pays entier retient son souffle devant la télévision.' },
      { name: 'La base', months: 4, drift: { a: 2, b: 3, c: 1 },
        text: 'La base « Clairière » est installée près du pôle Sud lunaire. Chaque soir, les astronautes envoient une vidéo aux écoles de France.' },
      { name: 'L’accident', months: 3, drift: { b: 5, c: -1 },
        text: 'Une micrométéorite perce un module. Les réserves d’oxygène fondent. Il faut décider : réparer sur place ou rapatrier d’urgence.' },
      { name: 'Le retour', months: 2, drift: { a: 1, b: -1 },
        text: 'La capsule de retour se prépare. Tout le pays compte les jours.' },
    ],
    earlyEnd: s => (s.b >= 96 ? 'tragedie' : null),
    resolve: s => (s.b > s.a ? 'tragedie' : s.a >= 70 && s.b < 50 ? 'triomphe' : 'sauves'),
    outcomes: {
      triomphe: { title: 'Le drapeau sur la Lune', tone: 'positive', effects: [st('popularity', 7), st('influence', 5), { kind: 'intl', prestige: 6 }, { kind: 'economy', confidence: 6 }],
        text: 'Les astronautes rentrent en héros ; la base Clairière reste habitée par roulement. La France est la troisième nation à vivre sur la Lune.' },
      sauves: { title: 'Rentrés sains et saufs', tone: 'neutral', effects: [st('popularity', 3), { kind: 'intl', prestige: 2 }],
        text: 'La mission est écourtée, la base mise en sommeil, mais les quatre astronautes rentrent vivants. Le pays pleure de soulagement.' },
      tragedie: { title: 'Le deuil national', tone: 'negative', effects: [st('popularity', -6), st('credibility', -5), st('stress', 10), { kind: 'intl', prestige: -3 }],
        text: 'La capsule de secours n’a pas pu décoller à temps. Un deuil national est décrété ; l’enquête sur la précipitation du programme ne fait que commencer.' },
    },
    hint: 'Faites avancer le programme plus vite que le danger. Une base avancée et sûre fera de la France une puissance spatiale.',
  },
];

export const SAGA_BY_ID = new Map(SAGAS.map(s => [s.id, s]));

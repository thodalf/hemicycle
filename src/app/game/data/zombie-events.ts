import { Effect, GameState } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';

/* ============================================================
 *  Épidémie Z : la porte d'entrée, puis les rebondissements.
 * ============================================================ */

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat, delta });
const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice =>
  ({ id, label, effects, outcome, ...extra });
const z = (x: Omit<Extract<Effect, { kind: 'zombie' }>, 'kind'>): Effect => ({ kind: 'zombie', ...x });
const active = (d: GameState) => !!d.zombie;
const atLeast = (min: number) => (d: GameState) => (d.zombie?.infection ?? 0) >= min;

export const ZOMBIE_GATE: RandomEvent = {
  tag: 'zombie_foyer', weight: 1, minRank: 'conseiller_municipal',
  eligible: d => !d.zombie && !d.player.flags['zombieGate'] && !d.player.flags['zombieDone'] && d.week > 18,
  build: () => ({
    title: 'Des malades qui ne meurent pas',
    context: 'Note de l’Agence de santé : à Saint-Nazaire, une dizaine de patients déclarés morts se sont relevés à la morgue. Ils sont agressifs, et la fièvre se transmet par morsure. Il faut réagir, vite.',
    choices: [
      c('alerte', 'Donner l’alerte et isoler le quartier', [z({ start: 'alerte' }), s('credibility', 3), s('stress', 6)], 'Cordons, combinaisons, conférence de presse : la France apprend le mot « Z ».'),
      c('confiner', 'Exiger le confinement de toute la région', [z({ start: 'confiner' }), s('popularity', -3), s('stress', 8)], 'On vous traite d’alarmiste. Pour l’instant.'),
      c('minimiser', 'Éviter la panique : « une grippe sévère »', [z({ start: 'minimiser' }), s('popularity', 1)], 'Les marchés restent calmes. Le virus, lui, voyage.'),
    ],
  }),
};

export const ZOMBIE_EVENTS: RandomEvent[] = [
  {
    tag: 'z_horde', weight: 1.2, eligible: atLeast(15),
    build: (_d, rng) => {
      const city = rng.pick(['Tours', 'Angers', 'Limoges', 'Rennes', 'Dijon', 'Orléans']);
      return {
        title: `Une horde aux portes de ${city}`,
        context: `Des milliers d’infectés convergent vers ${city}. Le préfet attend des ordres.`,
        choices: [
          c('evacuer', 'Évacuer la ville', [z({ infection: 2, panic: 6 }), s('popularity', 2), s('energy', -8)], 'Des colonnes de bus sur l’autoroute. Personne n’est laissé derrière.'),
          c('tenir', 'Tenir la ville : barricades et volontaires', [z({ containment: 8, infection: -3 }), s('stress', 8)], 'Trois nuits de siège. La ville tient.',
            { risk: { baseChance: 0.35, onFailure: [z({ infection: 6, panic: 10 }), s('popularity', -4)], failureNews: 'Une barricade cède à l’aube. La ville tombe.' } }),
          c('abandonner', 'Sacrifier la ville pour protéger le reste', [z({ infection: 4, containment: 4 }), s('credibility', -3), s('popularity', -3)], 'Une décision froide. Elle vous poursuivra.'),
        ],
      };
    },
  },
  {
    tag: 'z_charlatan', weight: 1, eligible: active,
    build: () => ({
      title: 'Un « remède miracle » vendu en ligne',
      context: 'Une boutique en ligne vend un sirop « anti-Z » à 300 € le flacon. Des milliers de commandes.',
      choices: [
        c('interdire', 'Faire fermer le site et porter plainte', [s('credibility', 3), z({ panic: 2 })], 'Le site ferme. Les complotistes crient à la censure.'),
        c('laisser', 'Ne pas s’en mêler', [z({ panic: -3, infection: 2 })], 'Rassurés à tort, des malades ne se signalent plus.'),
      ],
    }),
  },
  {
    tag: 'z_ministre_mordu', weight: 0.7, eligible: atLeast(25), minRank: 'depute',
    build: () => ({
      title: 'Un ministre cache une morsure',
      context: 'Un membre du gouvernement porte un bandage suspect au poignet. Il nie tout. Il transpire beaucoup.',
      choices: [
        c('reveler', 'Exiger qu’il se fasse tester', [s('credibility', 4), z({ panic: 4 }), s('influence', -1)], 'Positif. Il est placé à l’isolement. Le Conseil des ministres se tient désormais en visio.'),
        c('couvrir', 'Ne rien dire', [z({ infection: 4 })], 'Trois jours plus tard, l’hôtel de Roquelaure est en quarantaine.',
          { risk: { baseChance: 0.5, onFailure: [s('credibility', -6), { kind: 'exposure', delta: 8 }], failureNews: 'La presse apprend que vous saviez.' } }),
      ],
    }),
  },
  {
    tag: 'z_pillages', weight: 1, eligible: atLeast(20),
    build: () => ({
      title: 'Pillages dans les supermarchés',
      context: 'Pâtes, eau, piles : les rayons sont vidés en quelques heures. Des bagarres éclatent.',
      choices: [
        c('rationner', 'Instaurer le rationnement', [z({ panic: -6 }), s('popularity', -2), { kind: 'dossier', domain: 'economie', delta: 2 }], 'Tickets de rationnement : un souvenir de grand-père qui revient.'),
        c('couvre_feu', 'Décréter un couvre-feu', [z({ panic: -3, containment: 4 }), s('popularity', -1)], 'Les rues se vident à 19 h.'),
        c('laisser', 'Laisser le marché s’ajuster', [z({ panic: 6 }), s('credibility', -2)], 'Les prix triplent. La colère aussi.'),
      ],
    }),
  },
  {
    tag: 'z_chercheuse', weight: 1, eligible: d => !!d.zombie && !d.zombie.vaccine,
    build: () => ({
      title: 'Une chercheuse lyonnaise a une piste',
      context: 'Une virologue affirme avoir isolé un anticorps chez un patient qui a résisté au virus. Elle demande des moyens.',
      choices: [
        c('financer', 'Débloquer des fonds d’urgence', [z({ cure: 14 }), { kind: 'funds', account: 'personal', delta: -3000 }, s('credibility', 2)], 'Un laboratoire tourne nuit et jour.', { needMoney: 3000 }),
        c('appuyer', 'Plaider son dossier auprès du ministère', [z({ cure: 7 }), s('politicalCapital', -8)], 'Le ministère accepte de l’écouter.'),
        c('ignorer', 'Une piste parmi d’autres', [], 'Elle part travailler pour un laboratoire étranger.'),
      ],
    }),
  },
  {
    tag: 'z_voisins', weight: 0.8, eligible: atLeast(25),
    build: () => ({
      title: 'Les pays voisins ferment leurs frontières',
      context: 'Allemagne, Espagne, Italie : plus personne n’entre ni ne sort. Les camions de médicaments sont bloqués.',
      choices: [
        c('negocier', 'Négocier un corridor sanitaire', [{ kind: 'dossier', domain: 'diplomatie', delta: 4 }, z({ cure: 4 }), s('energy', -8)], 'Un corridor pour les médicaments et les chercheurs.'),
        c('accepter', 'L’accepter : chacun chez soi', [z({ containment: 3 }), { kind: 'intl', prestige: -2 }], 'La France est seule face au virus.'),
      ],
    }),
  },
  {
    tag: 'z_assemblee', weight: 0.6, eligible: atLeast(10), minRank: 'depute',
    build: () => ({
      title: 'Un huissier mordu dans l’hémicycle',
      context: 'En pleine séance, un huissier s’effondre, puis se relève. Panique sur les bancs ; la séance est suspendue.',
      choices: [
        c('visio', 'Proposer des séances en visioconférence', [s('credibility', 2), z({ containment: 2 })], 'L’Assemblée siège désormais en ligne. Les micros coupés font rire la France.'),
        c('maintenir', 'Maintenir les séances : « la démocratie ne s’arrête pas »', [s('popularity', 2), s('stress', 4)], 'Les députés siègent avec des masques. Courageux, ou inconscients ?'),
      ],
    }),
  },
  {
    tag: 'z_convoi', weight: 1, eligible: atLeast(20),
    build: () => ({
      title: 'Un convoi de survivants demande asile',
      context: 'Trois cents personnes venues d’une zone tombée attendent devant votre bastion. Certaines pourraient être contaminées.',
      choices: [
        c('accueillir', 'Les accueillir après un contrôle', [s('popularity', 3), z({ panic: -2 }), s('energy', -6)], 'Un centre de tri, des médecins, des couvertures.',
          { risk: { baseChance: 0.25, onFailure: [z({ infection: 4 })], failureNews: 'Un porteur sain passe le contrôle.' } }),
        c('refuser', 'Fermer les portes', [s('popularity', -3), z({ containment: 2 })], 'Les images font le tour du monde.'),
      ],
    }),
  },
  {
    tag: 'z_rave', weight: 0.6, eligible: active,
    build: () => ({
      title: 'Une fête « Fin du monde »',
      context: 'Dix mille jeunes se retrouvent dans un champ pour une fête géante. Le préfet hésite à intervenir.',
      choices: [
        c('disperser', 'Faire disperser la fête', [z({ containment: 3 }), s('popularity', -2)], 'Les gendarmes arrivent à l’aube.'),
        c('tolerer', 'Tolérer, avec des tests à l’entrée', [z({ panic: -3 }), s('popularity', 2)], 'Une fête sous contrôle sanitaire. Une première.',
          { risk: { baseChance: 0.3, onFailure: [z({ infection: 5 })], failureNews: 'Un cluster géant se déclare la semaine suivante.' } }),
      ],
    }),
  },
];

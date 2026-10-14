import { Effect, GameState } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';

/* ============================================================
 *  Le règne agité : un souverain du XXIᵉ siècle attire les
 *  révolutionnaires comme la lumière les papillons. Barricades,
 *  mutineries, Jacobins, fuite à Varennes… presque chaque mois,
 *  la rue ou l'Assemblée met la Couronne à l'épreuve.
 * ============================================================ */

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
const kg = (x: Omit<Extract<Effect, { kind: 'kingdom' }>, 'kind'>): Effect => ({ kind: 'kingdom', ...x });
const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice => ({ id, label, effects, outcome, ...extra });
const opp = (d: GameState) => Math.round(d.kingdom?.opposition ?? 0);

export const REVOLUTION_EVENTS: RandomEvent[] = [
  {
    tag: 'rev_barricades', weight: 2, eligible: d => !!d.kingdom,
    build: d => ({
      title: 'Les barricades du faubourg',
      context: `Une nuit de barricades dans l’Est parisien. Au petit matin, les insurgés tiennent trois rues et réclament la République. Front républicain : ${opp(d)}/100.`,
      choices: [
        c('dialogue', 'Envoyer un médiateur et rouvrir les rues sans heurts', [kg({ opposition: -5, stabilite: 3 }), s('energy', -4)], 'Après dix heures de palabres, les pavés retournent à leur place.'),
        c('force', 'Faire dégager les barricades par les CRS', [kg({ stabilite: 4, opposition: 8, prestige: -3 }), s('popularity', -2)], 'Les rues sont rouvertes. Les images, elles, tournent en boucle.',
          { risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [kg({ opposition: 10, stabilite: -8 })], failureNews: 'L’évacuation tourne mal : l’émeute gagne d’autres quartiers.' } }),
        c('balcon', 'Paraître au balcon et parler à la foule', [kg({ prestige: 4, opposition: -2 }), s('stress', 4)], 'Un discours improvisé, quelques applaudissements, beaucoup de sifflets. Mais vous étiez là.',
          { risk: { baseChance: 0.4, scaleWith: 'popularity', scaleWeight: 0.5, onFailure: [kg({ prestige: -6, opposition: 4 })], failureNews: 'Des projectiles volent vers le balcon : la photo fait la une.' } }),
      ],
    }),
  },
  {
    tag: 'rev_varennes', weight: 0.8, eligible: d => !!d.kingdom && d.kingdom.opposition >= 60,
    build: () => ({
      title: 'La tentation de Varennes',
      context: 'Votre chef de la sécurité propose de vous mettre à l’abri, discrètement, dans une résidence en province « le temps que ça se calme ». Une berline vous attend.',
      choices: [
        c('rester', 'Rester au Palais, quoi qu’il arrive', [kg({ prestige: 5, stabilite: 3 }), s('stress', 8)], '« Le souverain ne fuit pas. » La phrase rassure jusqu’aux républicains modérés.'),
        c('partir', 'Monter dans la berline', [kg({ stabilite: -6, opposition: 6, prestige: -8 }), s('stress', -6)], 'Un boulanger de la Marne vous reconnaît à un péage. La France entière en rit.',
          { risk: { baseChance: 0.5, onFailure: [kg({ restore: true, fall: 'revolution' })], failureNews: 'Arrêté·e à Varennes, comme Louis XVI : l’histoire se répète, la République est proclamée.' } }),
      ],
    }),
  },
  {
    tag: 'rev_jacobins', weight: 1.5, eligible: d => !!d.kingdom,
    build: () => ({
      title: 'Le retour du club des Jacobins',
      context: 'Un club républicain refondé rue Saint-Honoré réunit chaque soir des milliers de personnes et diffuse ses débats en direct. Il prépare un « programme de la Révolution ».',
      choices: [
        c('inviter', 'Accepter de venir débattre avec eux', [kg({ opposition: -6, prestige: 2 }), s('stress', 6), s('credibility', 2)], 'Trois heures de débat musclé. On vous huait au début, on vous applaudit à la fin.'),
        c('ignorer', 'Ignorer ce club', [kg({ opposition: 5 })], 'Le club prend de l’ampleur : des antennes s’ouvrent dans quarante villes.'),
        c('fermer', 'Faire fermer la salle pour raisons de sécurité', [kg({ opposition: 9, stabilite: 2 }), s('credibility', -3)], 'La salle est fermée. Le club se réunit désormais en plein air, place de la République.'),
      ],
    }),
  },
  {
    tag: 'rev_mutinerie', weight: 1, eligible: d => !!d.kingdom && d.kingdom.stabilite < 55,
    build: () => ({
      title: 'Des officiers refusent le serment',
      context: 'Un régiment refuse de prêter serment à la Couronne : « Nous servons la Nation, pas un monarque. » D’autres casernes hésitent.',
      choices: [
        c('respect', 'Saluer leur attachement à la Nation, sans sanction', [kg({ opposition: -4, stabilite: -3 }), s('credibility', 2)], 'Votre réaction désamorce la crise. L’état-major, lui, s’inquiète.'),
        c('sanction', 'Les muter et exiger le serment', [kg({ stabilite: 5, opposition: 6 })], 'Le serment est prêté, du bout des lèvres.',
          { risk: { baseChance: 0.3, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [kg({ stabilite: -12, opposition: 8 })], failureNews: 'Trois autres régiments se solidarisent : la crise militaire s’étend.' } }),
      ],
    }),
  },
  {
    tag: 'rev_jeu_de_paume', weight: 1.2, eligible: d => !!d.kingdom && d.kingdom.opposition >= 50,
    build: () => ({
      title: 'Le serment du Jeu de paume',
      context: 'Deux cents députés se réunissent dans la salle du Jeu de paume à Versailles et jurent de « ne pas se séparer avant d’avoir rendu la République au peuple ».',
      choices: [
        c('recevoir', 'Les recevoir et ouvrir une négociation constitutionnelle', [kg({ opposition: -8, prestige: -3, stabilite: 4 }), s('politicalCapital', -8)], 'Une commission mixte est créée. La tension retombe, provisoirement.'),
        c('fermer', 'Faire fermer la salle', [kg({ opposition: 10, prestige: -2 })], 'Ils se réunissent sur le parvis. L’histoire se répète, en pire.'),
      ],
    }),
  },
  {
    tag: 'rev_greve_insurrectionnelle', weight: 1.1, eligible: d => !!d.kingdom,
    build: () => ({
      title: 'Grève générale pour la République',
      context: 'Les syndicats appellent à une grève générale illimitée « jusqu’au retour de la République ». Raffineries, trains, écoles : le pays s’arrête.',
      choices: [
        c('negocier', 'Négocier sur les salaires pour séparer le social du politique', [kg({ opposition: -5 }), { kind: 'economy', deficit: 0.05 }, { kind: 'segment', segment: 'populaires', delta: 3 }], 'La grève s’effrite : l’augmentation du SMIC a eu raison des plus déterminés.'),
        c('tenir', 'Tenir bon et réquisitionner', [kg({ stabilite: 3, opposition: 7 }), { kind: 'economy', growth: -0.15 }], 'Le pays tourne au ralenti trois semaines. Personne n’oublie qui a tenu.'),
      ],
    }),
  },
  {
    tag: 'rev_pamphlet', weight: 1.3, eligible: d => !!d.kingdom,
    build: () => ({
      title: 'Le pamphlet anonyme',
      context: '« Le Roi nu », un pamphlet anonyme sur votre train de vie, se vend à 800 000 exemplaires en une semaine.',
      choices: [
        c('repondre', 'Publier vos comptes, au centime près', [kg({ opposition: -4, prestige: 2 }), s('credibility', 3)], 'La transparence désarme une partie des critiques.'),
        c('rire', 'En rire publiquement', [kg({ prestige: 2 }), s('popularity', 2)], '« Nu ? Pas en janvier. » La réplique fait sourire, le pamphlet continue de se vendre.'),
        c('poursuivre', 'Poursuivre l’éditeur', [kg({ opposition: 6 }), s('credibility', -2)], 'Le procès fait une publicité inespérée au pamphlet.'),
      ],
    }),
  },
  {
    tag: 'rev_commune', weight: 0.9, eligible: d => !!d.kingdom && d.kingdom.opposition >= 55,
    build: () => ({
      title: 'Lyon proclame sa Commune',
      context: 'Le conseil municipal de Lyon proclame la « Commune républicaine de Lyon » et refuse d’appliquer les ordonnances royales.',
      choices: [
        c('dialoguer', 'Se rendre à Lyon pour négocier', [kg({ opposition: -6, stabilite: 3 }), s('energy', -6)], 'Une journée entière à l’hôtel de ville. La Commune suspend sa proclamation.'),
        c('prefet', 'Dissoudre le conseil municipal par décret', [kg({ stabilite: 5, opposition: 9 }), s('credibility', -2)], 'Le décret passe. Marseille, Grenoble et Lille s’agitent à leur tour.'),
      ],
    }),
  },
  {
    tag: 'rev_heritier_republicain', weight: 0.7, eligible: d => !!d.kingdom,
    build: () => ({
      title: 'L’héritier·e se dit républicain·e',
      context: 'Dans une interview, votre héritier·e déclare : « Je ne veux pas régner. La République me va très bien. »',
      choices: [
        c('soutenir', 'Défendre sa liberté de pensée', [kg({ opposition: -4, prestige: -3 }), s('popularity', 2)], 'Une famille royale moderne : l’image plaît, le trône vacille un peu.'),
        c('recadrer', 'Le ou la recadrer en privé', [kg({ prestige: 1 }), s('stress', 4)], 'Un communiqué rectificatif paraît. Personne n’y croit vraiment.'),
      ],
    }),
  },
  {
    tag: 'rev_sondage_republique', weight: 1, eligible: d => !!d.kingdom,
    build: d => ({
      title: 'Le baromètre de la République',
      context: `Un institut publie chaque mois la part de Français favorables au retour de la République : ${Math.min(78, 35 + Math.round(opp(d) / 2))} % ce mois-ci.`,
      choices: [
        c('reforme', 'Annoncer un référendum sur la monarchie dans un an', [kg({ opposition: -10, stabilite: -4 }), s('credibility', 3)], 'Le front républicain se prépare à une campagne. La rue se calme.'),
        c('bilan', 'Défendre votre bilan à la télévision', [kg({ prestige: 3 }), s('popularity', 1), s('stress', 3)], 'Une heure d’interview : vous parlez chômage, hôpital, sécurité. Pas couronne.'),
      ],
    }),
  },
];

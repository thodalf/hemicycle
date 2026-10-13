import { Effect, GameState, Segment } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';
import { monthIndex, yearOf } from '../engine/calendar';
import { accountability, segmentRows } from '../engine/country';
import { SEGMENTS } from './programme';

/* ============================================================
 *  Rendez-vous du calendrier (Euro et Coupe du monde, Tour de
 *  France, Fête de la musique, rentrée scolaire, César, trêve
 *  des confiseurs) et événements du pays : économie, électorats,
 *  coalition, circonscription.
 * ============================================================ */

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat, delta });
const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice =>
  ({ id, label, effects, outcome, ...extra });
const seg = (segment: Segment | '*', delta: number): Effect => ({ kind: 'segment', segment, delta });
const eco = (x: Omit<Extract<Effect, { kind: 'economy' }>, 'kind'>): Effect => ({ kind: 'economy', ...x });
const mood = (delta: number): Effect => ({ kind: 'coalition', mood: delta });
const atLeastCouncil = 'conseiller_municipal' as const;

/** Les années paires : l'Euro (2028, 2032…) ou la Coupe du monde (2030, 2034…) */
function footName(year: number): string | null {
  if (year % 2) return null;
  return year % 4 === 0 ? 'l’Euro' : 'la Coupe du monde';
}

// ── Rendez-vous du calendrier ───────────────────────────────

export const CALENDAR_EVENTS: RandomEvent[] = [
  {
    tag: 'foot_tournoi', weight: 5, eligible: d => monthIndex(d.week) === 5 && !!footName(yearOf(d.week)),
    build: (d, rng) => {
      const year = yearOf(d.week);
      const name = footName(year)!;
      // Le parcours des Bleus est écrit d'avance… vous ne le saurez qu'en juillet
      const run = rng.pick([0, 1, 1, 2, 2, 3, 3]);
      const base: Effect[] = [{ kind: 'flag', key: 'footYear', value: year }, { kind: 'flag', key: 'footRun', value: run }];
      return {
        title: `Les Bleus entrent dans ${name}`,
        context: `Premier match ce soir. Toute la France a le maillot sur le dos ; vos équipes vous demandent où vous serez pendant le tournoi.`,
        choices: [
          c('stade', 'Au stade, en tribune officielle', [...base, { kind: 'flag', key: 'footFan', value: 2 }, { kind: 'funds', account: 'personal', delta: -1200 }, s('energy', -4), s('popularity', 1)], 'Écharpe tricolore, Marseillaise à pleins poumons. Les caméras adorent.', { needMoney: 1200 }),
          c('bar', 'Dans un bar de quartier avec les supporters', [...base, { kind: 'flag', key: 'footFan', value: 1 }, s('popularity', 1), seg('populaires', 2), seg('jeunes', 1)], 'Une pinte, des cris, un but à la 89e : vous êtes « des leurs ».'),
          c('travail', 'Au travail : « la France a d’autres priorités »', [...base, { kind: 'flag', key: 'footFan', value: 0 }, s('credibility', 1), seg('jeunes', -2), seg('populaires', -1)], 'Sérieux. Un peu triste, aussi.'),
        ],
      };
    },
  },
  {
    tag: 'foot_resultat', weight: 5, eligible: d => monthIndex(d.week) === 6 && Number(d.player.flags['footYear'] ?? 0) === yearOf(d.week),
    build: d => {
      const name = footName(yearOf(d.week)) ?? 'le tournoi';
      const run = Number(d.player.flags['footRun'] ?? 0);
      const fan = Number(d.player.flags['footFan'] ?? 0);
      if (run === 3) return {
        title: `Les Bleus remportent ${name} !`,
        context: 'Un million de personnes sur les Champs-Élysées. L’équipe défile en bus à impériale, et tout le monde veut sa photo avec la coupe.',
        choices: [
          c('parade', 'Accueillir l’équipe à sa descente d’avion', [s('popularity', fan ? 4 : 2), seg('*', 2), eco({ confidence: 4 }), s('energy', -3)], fan ? 'Vous étiez là depuis le premier match : la photo avec le capitaine est sincère.' : '« Opportuniste », souffle un éditorialiste. La photo est belle quand même.'),
          c('sobre', 'Un message de félicitations, sans récupération', [s('credibility', 2), eco({ confidence: 3 })], 'La sobriété est remarquée.'),
        ],
      };
      if (run === 2) return {
        title: `Défaite en finale de ${name}`,
        context: 'Aux tirs au but. Le pays est sonné ; les joueurs pleurent sur la pelouse.',
        choices: [
          c('consoler', 'Saluer le parcours des Bleus', [s('popularity', 1), seg('populaires', 1)], '« Vous nous avez fait rêver. » Ça sonne juste.'),
          c('arbitre', 'Accuser l’arbitrage', [seg('populaires', 2), s('credibility', -2)], 'Une sortie populaire au comptoir, moins sur les plateaux.'),
        ],
      };
      return {
        title: 'Les Bleus éliminés',
        context: `Fin de parcours prématurée dans ${name}. Les commentateurs réclament la tête du sélectionneur.`,
        choices: [
          c('soutien', 'Un mot de soutien aux joueurs', [s('popularity', 1)], 'Rien à redire.'),
          c('selectionneur', 'Réclamer le départ du sélectionneur', [seg('jeunes', 1), seg('populaires', 1), s('credibility', -1)], 'On vous reproche de vous mêler de tout.'),
        ],
      };
    },
  },
  {
    tag: 'tour_de_france', weight: 3, minRank: atLeastCouncil, eligible: d => monthIndex(d.week) === 6,
    build: d => ({
      title: 'Le Tour de France passe chez vous',
      context: `Une étape traverse ${d.territory?.name.replace(/^Circonscription (de |d’)/, '') ?? 'votre circonscription'}. La caravane, les coureurs, les hélicoptères : une journée de fête.`,
      choices: [
        c('voiture', 'Monter dans la voiture du directeur de course', [s('popularity', 2), seg('ruraux', 2), s('energy', -3)], 'Vous saluez par la fenêtre. Les spectateurs croient voir un ministre.'),
        c('animation', 'Financer une grande fête au village-étape', [{ kind: 'funds', account: 'personal', delta: -1500 }, { kind: 'localProject', attachment: 5 }, seg('ruraux', 2)], 'Bal, buvette et maillots jaunes pour les enfants.', { needMoney: 1500 }),
        c('podium', 'Prendre la parole sur le podium d’arrivée', [{ kind: 'minigame', gameId: 'discours', title: 'Discours à l’arrivée d’étape', reward: [s('popularity', 3), seg('ruraux', 3)], penalty: [s('popularity', -1)] }], 'Le micro grésille, la foule attend le vainqueur… pas vous.'),
      ],
    }),
  },
  {
    tag: 'fete_musique', weight: 3, eligible: d => monthIndex(d.week) === 5 && d.week > 3,
    build: () => ({
      title: 'La Fête de la musique',
      context: 'Le 21 juin, une fanfare joue sous vos fenêtres et un groupe de rock local vous propose de monter sur scène pour un morceau.',
      choices: [
        c('scene', 'Monter sur scène', [{ kind: 'minigame', gameId: 'fete_village', title: 'Fête de la musique : la scène !', reward: [s('popularity', 3), seg('jeunes', 3)], penalty: [s('popularity', -2), seg('jeunes', -1)] }], 'Une guitare, trois accords, un public hilare. Pour le meilleur ou pour le pire.'),
        c('incognito', 'Se promener incognito, une glace à la main', [s('stress', -6), s('energy', 3)], 'Personne ne vous reconnaît. Un bonheur rare.'),
        c('groupe', 'Inviter le groupe local à jouer à la mairie', [seg('jeunes', 2), { kind: 'localProject', attachment: 2 }], 'Le guitariste est le fils de votre voisine. Le maire est conquis.'),
      ],
    }),
  },
  {
    tag: 'rentree_scolaire', weight: 3, minRank: atLeastCouncil, eligible: d => monthIndex(d.week) === 8,
    build: () => ({
      title: 'Rentrée : des classes sans professeur',
      context: 'Trois mille postes non pourvus, des classes à trente-cinq, une école de votre circonscription sans maître en CM2.',
      choices: [
        c('ecole', 'Passer la matinée dans l’école concernée', [{ kind: 'dossier', domain: 'education', delta: 3 }, seg('jeunes', 2), s('energy', -4)], 'Les enfants vous posent plus de questions qu’un journaliste.'),
        c('interpeller', 'Interpeller publiquement le ministre', [s('influence', 1), s('credibility', 1), seg('populaires', 1)], 'Une lettre ouverte reprise par la presse régionale.'),
        c('fournitures', 'Offrir des fournitures aux familles modestes', [{ kind: 'funds', account: 'personal', delta: -800 }, seg('populaires', 2)], 'Cartables, cahiers, calculatrices : un geste apprécié.', { needMoney: 800 }),
      ],
    }),
  },
  {
    tag: 'cesar', weight: 3, minRank: 'depute', eligible: d => monthIndex(d.week) === 1,
    build: () => ({
      title: 'Cérémonie des César : vous êtes visé·e',
      context: 'En recevant son prix, une actrice fustige « la politique culturelle de ceux qui nous gouvernent » en citant votre nom. La salle applaudit.',
      choices: [
        c('repondre', 'Répondre sèchement sur les réseaux', [seg('retraites', 2), seg('jeunes', -2), s('popularity', -1)], 'Le clash fait la une. Vos soutiens adorent, les autres moins.'),
        c('humour', 'Répondre avec humour', [s('popularity', 1), seg('jeunes', 2)], 'Votre réponse est plus partagée que son discours.',
          { risk: { baseChance: 0.3, onFailure: [s('popularity', -2)], failureNews: 'La blague tombe à plat. Gênance générale.' } }),
        c('ignorer', 'Ne rien dire', [s('stress', 1)], 'L’affaire s’éteint en deux jours.'),
      ],
    }),
  },
  {
    tag: 'treve_confiseurs', weight: 2, eligible: d => monthIndex(d.week) === 11 && d.week > 6,
    build: () => ({
      title: 'La trêve des confiseurs',
      context: 'Entre Noël et le Nouvel An, la politique s’arrête… presque. Comment passerez-vous les fêtes ?',
      choices: [
        c('famille', 'En famille, téléphone éteint', [s('stress', -8), s('energy', 6)], 'Une bûche, des cadeaux, une vraie coupure.'),
        c('maraude', 'Avec une association, auprès des sans-abri', [s('popularity', 2), seg('populaires', 2), s('energy', -4)], 'Une soupe chaude à minuit. On ne vous a pas filmé·e, et c’est tant mieux.'),
        c('travail', 'Au bureau, à préparer l’année', [s('influence', 1), s('stress', 3)], 'Personne ne vous dérange. Les idées viennent.'),
      ],
    }),
  },
];

// ── Le pays : économie, électorats, coalition, circonscription ─

export const COUNTRY_EVENTS: RandomEvent[] = [
  {
    tag: 'eco_bonne_nouvelle', weight: 1, eligible: d => !!d.economy && accountability(d) > 0 && (d.economy.growth >= 1.6 || d.economy.unemployment < 7),
    build: d => ({
      title: 'Bons chiffres de l’économie',
      context: `Croissance à ${d.economy!.growth.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %, chômage à ${d.economy!.unemployment.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % : l’Insee publie de bons chiffres.`,
      choices: [
        c('merite', 'S’en attribuer le mérite', [s('popularity', 2), s('credibility', -1)], '« C’est le fruit de notre politique. » Les économistes nuancent.'),
        c('prudence', 'Rester prudent·e', [s('credibility', 2), eco({ confidence: 2 })], '« Rien n’est acquis. » Une sobriété appréciée.'),
      ],
    }),
  },
  {
    tag: 'eco_plan_social', weight: 1, minRank: atLeastCouncil,
    build: () => ({
      title: 'Un grand plan social',
      context: 'Un équipementier automobile annonce 1 800 suppressions de postes et la fermeture de deux usines.',
      choices: [
        c('intervenir', 'Exiger un repreneur et des reclassements', [seg('populaires', 3), s('politicalCapital', -6), eco({ unemployment: -0.05 })], 'Des semaines de négociation. Une usine sur deux sauvée.'),
        c('marche', '« L’État ne peut pas tout »', [seg('cadres', 2), seg('populaires', -3), s('credibility', 1)], 'Une phrase qu’on vous ressortira.'),
      ],
    }),
  },
  {
    tag: 'eco_inflation', weight: 1, eligible: d => (d.economy?.inflation ?? 0) >= 3.5,
    build: d => {
      const gov = accountability(d) > 0;
      return {
        title: 'Les prix flambent',
        context: `Inflation à ${d.economy!.inflation.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % : le caddie, le plein, le loyer. Les retraités et les ménages modestes trinquent.`,
        choices: gov ? [
          c('bouclier', 'Un bouclier tarifaire', [eco({ inflation: -0.4, deficit: 0.2 }), seg('retraites', 3), seg('populaires', 2)], 'Les prix de l’énergie sont gelés. La facture, elle, ira à la dette.'),
          c('bce', 'Laisser la Banque centrale faire son travail', [s('credibility', 2), seg('retraites', -3)], 'Orthodoxe. Impopulaire.'),
        ] : [
          c('denoncer', 'Dénoncer l’inaction du gouvernement', [s('popularity', 1), seg('populaires', 2), seg('retraites', 2)], 'Un caddie à 150 € brandi en séance : l’image fait mouche.'),
          c('proposer', 'Proposer un plan chiffré', [s('credibility', 2), seg('cadres', 1)], 'Sérieux, mais peu relayé.'),
        ],
      };
    },
  },
  {
    tag: 'seg_point_faible', weight: 1, minRank: atLeastCouncil, eligible: d => !!d.electorate,
    build: d => {
      const worst = [...segmentRows(d)].sort((a, b) => a.offset - b.offset)[0];
      return {
        title: `Les ${worst.label.toLowerCase()} vous boudent`,
        context: `Une étude d’opinion le confirme : chez les ${worst.label.toLowerCase()}, votre cote n’est que de ${worst.approval} %. Votre équipe propose une opération reconquête.`,
        choices: [
          c('reconquete', 'Lancer l’opération reconquête', [seg(worst.id, 5), s('energy', -6)], 'Un mois de déplacements ciblés. Ça commence à payer.'),
          c('assumer', '« On ne peut pas plaire à tout le monde »', [s('credibility', 1), seg(worst.id, -1)], 'Cohérent. Mais l’écart se creuse.'),
        ],
      };
    },
  },
  {
    tag: 'seg_lyceens', weight: 0.8, eligible: d => (d.electorate?.offsets.jeunes ?? 0) <= -5,
    build: () => ({
      title: 'Les lycéens dans la rue',
      context: 'Des blocus devant les lycées, des slogans contre « une génération sacrifiée ». Votre nom est sur les pancartes.',
      choices: [
        c('dialogue', 'Recevoir une délégation de lycéens', [seg('jeunes', 4), seg('retraites', -1)], 'Ils sont mieux préparés que vos conseillers.'),
        c('fermete', '« La place des lycéens est en classe »', [seg('retraites', 2), seg('jeunes', -3)], 'Les parents approuvent. Les enfants, beaucoup moins.'),
      ],
    }),
  },
  {
    tag: 'seg_retraites', weight: 0.8, eligible: d => (d.electorate?.offsets.retraites ?? 0) <= -5,
    build: () => ({
      title: 'Le courrier des retraités',
      context: 'Trois cents lettres manuscrites en une semaine : « Vous nous avez oubliés. »',
      choices: [
        c('repondre', 'Répondre à chaque lettre, à la main', [seg('retraites', 4), s('energy', -6)], 'Des soirées entières. Certaines réponses sont encadrées dans des salons.'),
        c('club', 'Visiter un club du troisième âge', [seg('retraites', 3), s('energy', -3)], 'Une partie de belote, une tarte aux pommes, des doléances.'),
      ],
    }),
  },
  {
    tag: 'coal_menace', weight: 1.2, eligible: d => !!d.coalition && d.coalition.mood < 45,
    build: d => ({
      title: `${d.coalition!.name} menace de partir`,
      context: `« Nous ne sommes pas des supplétifs. » Le chef de file de ${d.coalition!.name} pose un ultimatum : une de ses réformes, ou c’est la rupture.`,
      choices: [
        c('ceder', 'Céder sur sa réforme', [mood(25), s('credibility', -2), { kind: 'cohesion', delta: -3 }], 'La coalition respire. Votre parti, moins.'),
        c('sommet', 'Convoquer un sommet de la majorité', [mood(12), s('energy', -6)], 'Une nuit de discussions, un communiqué commun au petit matin.'),
        c('tenir', 'Tenir bon', [mood(-10), { kind: 'cohesion', delta: 3 }, s('influence', 1)], 'Bras de fer engagé.'),
      ],
    }),
  },
  {
    tag: 'coal_ministre', weight: 0.8, eligible: d => !!d.coalition,
    build: d => ({
      title: 'Un ministre partenaire fait cavalier seul',
      context: `Un ministre issu de ${d.coalition!.name} annonce une mesure qui n’a jamais été arbitrée.`,
      choices: [
        c('recadrer', 'Le recadrer publiquement', [mood(-8), s('credibility', 2), s('influence', 1)], 'L’autorité est rétablie. Le partenaire grince.'),
        c('laisser', 'Laisser passer', [mood(5), { kind: 'cohesion', delta: -2 }], 'Le précédent est créé.'),
      ],
    }),
  },
  {
    tag: 'circo_rival_local', weight: 0.7, minRank: 'depute', eligible: d => !!d.territory && d.territory.kind !== 'bastion',
    build: d => ({
      title: 'Un enfant du pays vise votre siège',
      context: `Le maire le plus populaire de ${d.territory!.name.replace(/^Circonscription (de |d’)/, '')} laisse entendre qu’il pourrait se présenter contre vous.`,
      choices: [
        c('allier', 'Lui proposer d’être votre suppléant', [{ kind: 'localProject', attachment: 6 }, s('politicalCapital', -5)], 'Un ticket local imbattable… et un futur rival.'),
        c('ignorer', 'L’ignorer', [s('stress', 2)], 'Il prend des notes.',
          { risk: { baseChance: 0.4, onFailure: [{ kind: 'localProject', attachment: -6 }], failureNews: 'Il fait campagne contre vous dans chaque commune.' } }),
      ],
    }),
  },
];

/** Libellés des électorats (pour les textes) */
export const SEGMENT_LABEL = Object.fromEntries(SEGMENTS.map(x => [x.id, x.label])) as Record<Segment, string>;

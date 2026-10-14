import { Effect, GameState, Segment } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';
import { monthIndex, yearOf } from '../engine/calendar';
import { accountability, segmentRows } from '../engine/country';
import { annexedEnemies } from '../engine/annex';
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
  {
    tag: 'anx_resistance', weight: 1.4, eligible: d => annexedEnemies(d).length > 0,
    build: d => {
      const e = annexedEnemies(d)[0];
      const an = (mode: 'liberer'): Effect => ({ kind: 'annex', enemyId: e.id, mode });
      return {
        title: `Résistance armée ${e.of.startsWith('du') ? 'au' + e.of.slice(2) : 'en' + e.of.slice(5)}`,
        context: `Des attentats contre l’administration française, des grèves générales, des drapeaux interdits aux fenêtres : ${e.the} ne se résigne pas.`,
        choices: [
          c('reprimer', 'Réprimer fermement', [s('popularity', 1), { kind: 'intl', prestige: -5, tension: 5 }, seg('jeunes', -2), seg('retraites', 2)], 'Couvre-feu, arrestations, images terribles dans la presse étrangère.'),
          c('autonomie', 'Accorder une large autonomie', [s('credibility', 2), { kind: 'intl', prestige: 3 }], 'Un parlement local, une langue officielle : la tension baisse d’un cran.'),
          c('liberer', 'Rendre l’indépendance', [an('liberer')], 'Un référendum, un drapeau qu’on descend. Certains crient à la trahison, d’autres à la sagesse.'),
        ],
      };
    },
  },
  {
    tag: 'ministre_scandale', weight: 1, eligible: d => !!d.presidency?.cabinet && !d.presidency.cohabitation,
    build: (d, rng) => {
      const doms = Object.keys(d.presidency!.cabinet!) as (keyof NonNullable<NonNullable<GameState['presidency']>['cabinet']>)[];
      const dom = rng.pick(doms);
      const name = d.presidency!.cabinet![dom];
      return {
        title: `${name} dans la tourmente`,
        context: `Votre ministre est mis·e en cause pour des notes de frais extravagantes : un week-end à Courchevel aux frais du ministère.`,
        choices: [
          c('limoger', 'Le ou la limoger et remanier', [{ kind: 'presidency', approval: 2 }, { kind: 'decision', templateId: 'casting_gouvernement' }], 'Un communiqué à 22 h. Le remaniement suit.'),
          c('soutenir', 'Le ou la soutenir', [{ kind: 'presidency', approval: -3 }, { kind: 'exposure', delta: 3 }, { kind: 'cohesion', delta: 2 }], '« Une erreur administrative. » La presse n’en croit pas un mot.'),
        ],
      };
    },
  },
  {
    tag: 'ministre_demission', weight: 0.7, eligible: d => !!d.presidency?.cabinet && !d.presidency.cohabitation,
    build: d => ({
      title: 'Un ministre claque la porte',
      context: `Votre ministre de la Transition écologique démissionne en direct à la radio : « Je ne peux plus cautionner l’inaction. »`,
      choices: [
        c('remanier', 'Remanier dans la foulée', [{ kind: 'decision', templateId: 'casting_gouvernement' }, s('energy', -4)], 'Un nouveau casting, pour reprendre la main.'),
        c('minimiser', 'Minimiser : « une décision personnelle »', [{ kind: 'presidency', approval: -2 }, seg('jeunes', -2)], 'Les écologistes de la majorité grincent.'),
      ],
    }),
  },
  {
    tag: 'musee_cambriole', weight: 0.7,
    build: () => ({
      title: 'Les joyaux de la Couronne volés',
      context: 'En sept minutes, des cambrioleurs ont dérobé des bijoux historiques dans un grand musée parisien. Le monde entier se moque de la sécurité française.',
      choices: [
        c('securite', 'Réclamer un audit de la sécurité des musées', [s('credibility', 2), { kind: 'dossier', domain: 'securite', delta: 2 }], 'Un rapport accablant sort deux mois plus tard.'),
        c('humour', 'En plaisanter à la radio', [s('popularity', 1)], 'La blague fait rire. Les conservateurs du musée, beaucoup moins.',
          { risk: { baseChance: 0.35, onFailure: [s('credibility', -2), s('popularity', -1)], failureNews: 'On vous reproche de rire d’une perte patrimoniale.' } }),
      ],
    }),
  },
  {
    tag: 'vague_de_froid', weight: 0.8, eligible: d => [11, 0, 1].includes(monthIndex(d.week)),
    build: () => ({
      title: 'Vague de froid',
      context: 'Moins quinze degrés à Strasbourg, des sans-abri en danger, des canalisations qui gèlent.',
      choices: [
        c('gymnases', 'Ouvrir les gymnases', [s('popularity', 2), seg('populaires', 2), s('energy', -4)], 'Des lits de camp, de la soupe, des bénévoles.'),
        c('cheque', 'Réclamer un chèque énergie d’urgence', [seg('retraites', 2), seg('populaires', 1), eco({ deficit: 0.05 })], 'Le gouvernement cède sous la pression.'),
      ],
    }),
  },
  {
    tag: 'penurie_moutarde', weight: 0.5,
    build: () => ({
      title: 'Pénurie de moutarde',
      context: 'Plus un pot dans les rayons : la sécheresse au Canada a ruiné la récolte de graines. Les Français sont scandalisés.',
      choices: [
        c('souverainete', 'Plaider pour la souveraineté moutardière', [seg('ruraux', 2), s('popularity', 1)], '« Relocalisons la graine de moutarde en Bourgogne ! » Le Dijonnais applaudit.'),
        c('relativiser', 'Relativiser', [s('credibility', 1), seg('populaires', -1)], 'On vous reproche de ne pas comprendre la France.'),
      ],
    }),
  },
  {
    tag: 'controleurs_aeriens', weight: 0.7, eligible: d => [3, 6, 7, 11].includes(monthIndex(d.week)),
    build: () => ({
      title: 'Grève des contrôleurs aériens',
      context: 'Deux mille vols annulés en plein départ en vacances. Les aéroports sont pleins de familles furieuses.',
      choices: [
        c('service_minimum', 'Réclamer un service minimum', [seg('cadres', 2), seg('retraites', 1), seg('populaires', -1)], 'Le débat sur le droit de grève est relancé.'),
        c('dialogue', 'Appeler au dialogue', [s('credibility', 1), seg('populaires', 1)], 'Une médiation s’ouvre. Les vacanciers attendent.'),
      ],
    }),
  },

  {
    tag: 'sommet_crise_nuit', weight: 1, eligible: d => !!d.presidency || d.player.rankId === 'premier_ministre',
    build: () => ({
      title: 'Sommet européen de crise cette nuit',
      context: 'Une crise bancaire menace la zone euro. Les vingt-sept se réunissent en urgence à Bruxelles : il faut un texte avant l’ouverture des marchés.',
      choices: [
        c('y_aller', 'Y aller et négocier vous-même', [{ kind: 'minigame', gameId: 'sommet_ue', title: 'Sommet de crise à Bruxelles', reward: [{ kind: 'intl', prestige: 5 }, s('credibility', 3), eco({ confidence: 4 })], penalty: [{ kind: 'intl', prestige: -3 }, eco({ confidence: -3 })] }, s('energy', -8)], 'Avion à 18 h, café à 3 h du matin.'),
        c('ministre', 'Envoyer le ministre des Affaires étrangères', [{ kind: 'intl', prestige: -1 }, eco({ confidence: -1 })], 'On remarque votre absence.'),
      ],
    }),
  },
  {
    tag: 'chef_etat_invite', weight: 0.8, eligible: d => !!d.presidency,
    build: () => ({
      title: 'Un chef d’État s’invite',
      context: 'Un dirigeant étranger annonce sa visite officielle à Paris dans dix jours. Le protocole est sur les dents.',
      choices: [
        c('recevoir', 'Le recevoir avec tous les honneurs', [{ kind: 'minigame', gameId: 'visite_officielle', title: 'Visite d’État à l’Élysée', reward: [{ kind: 'intl', prestige: 4 }, s('popularity', 1)], penalty: [{ kind: 'intl', prestige: -4 }, s('popularity', -1)] }], 'Garde républicaine, tapis rouge, dîner d’État.'),
        c('sobre', 'Une visite de travail, sans faste', [{ kind: 'intl', prestige: 1 }, s('credibility', 1)], 'Deux heures de réunion, un communiqué. Efficace.'),
      ],
    }),
  },
  {
    tag: 'ev_deepfake', weight: 0.8, minRank: atLeastCouncil,
    build: () => ({
      title: 'Un faux de vous circule',
      context: 'Une vidéo truquée vous montre en train d’insulter les agriculteurs. Elle a été vue deux millions de fois en une nuit.',
      choices: [
        c('dementir', 'Démentir, preuves techniques à l’appui', [s('credibility', 1), s('stress', 3), seg('ruraux', -1)], 'Des experts décortiquent les pixels. Le démenti fait dix fois moins de vues que le faux.'),
        c('plainte', 'Porter plainte et exiger le retrait', [s('politicalCapital', -3), s('credibility', 2)], 'La plateforme retire la vidéo sous 48 heures. Le mal est en partie fait.'),
        c('rire', 'Publier un faux… encore plus absurde', [s('popularity', 2), seg('jeunes', 2), s('credibility', -1)], 'Vous voilà en astronaute dansant le twist. Plus personne ne croit aucune vidéo.'),
      ],
    }),
  },
  {
    tag: 'ev_baguette', weight: 0.7,
    build: () => ({
      title: 'La meilleure baguette de France',
      context: 'Le boulanger de votre quartier remporte le concours national de la meilleure baguette. Il fournira l’Élysée pendant un an.',
      choices: [
        c('visite', 'Passer le féliciter, en tablier', [s('popularity', 2), seg('ruraux', 1), seg('retraites', 1), s('energy', -3)], 'Photo devant le fournil, croûte dorée : la plus partagée de votre mois.'),
        c('message', 'Un message de félicitations', [s('popularity', 1)], 'Il l’affiche à côté de la caisse.'),
      ],
    }),
  },
  {
    tag: 'ev_danse_virale', weight: 0.6,
    build: () => ({
      title: 'Votre danse fait le tour des réseaux',
      context: 'Filmé·e à un mariage, vous dansez sur un tube de l’été. Huit millions de vues, des milliers de reprises.',
      choices: [
        c('assumer', 'Assumer, et relever le défi', [seg('jeunes', 3), s('popularity', 2), s('credibility', -1)], 'Un ministre étranger vous répond en vidéo. La diplomatie de la danse est née.'),
        c('ignorer', 'Ne rien dire', [s('credibility', 1)], 'La vague passe en quatre jours.'),
      ],
    }),
  },
  {
    tag: 'ev_pont_fissure', weight: 0.6, minRank: atLeastCouncil,
    build: () => ({
      title: 'Un pont fissuré',
      context: 'Une fissure inquiétante apparaît sur le pont qui relie les deux moitiés de votre ville. Les ingénieurs hésitent.',
      choices: [
        c('fermer', 'Fermer le pont par précaution', [s('credibility', 2), s('popularity', -1), seg('ruraux', -1)], 'Trente minutes de détour pour tout le monde, mais personne en danger.'),
        c('surveiller', 'Le laisser ouvert sous surveillance', [s('popularity', 1), { kind: 'exposure', delta: 2 }], 'Des capteurs, des inspections hebdomadaires… et des nuits agitées.'),
      ],
    }),
  },
  {
    tag: 'ev_lettre_enfant', weight: 0.7,
    build: () => ({
      title: 'La lettre d’une enfant',
      context: 'Une écolière de neuf ans vous écrit au crayon de couleur : « Pourquoi les grands ne règlent pas le problème des déchets dans la mer ? »',
      choices: [
        c('repondre', 'Lui répondre à la main, et aller voir sa classe', [s('popularity', 2), s('stress', -3), { kind: 'dossier', domain: 'ecologie', delta: 2 }, s('energy', -3)], 'Vingt-quatre questions, aucune langue de bois possible. La meilleure matinée du mois.'),
        c('courrier', 'Une réponse type du secrétariat', [s('credibility', -1)], 'La maman publie la lettre type. Quelques commentaires piquants.'),
      ],
    }),
  },
  {
    tag: 'ev_canicule_ecoles', weight: 2, eligible: d => [5, 6].includes(monthIndex(d.week)),
    build: () => ({
      title: 'Canicule dans les écoles',
      context: 'Trente-huit degrés dans les salles de classe. Des parents gardent leurs enfants à la maison ; les enseignants réclament des ventilateurs.',
      choices: [
        c('plan', 'Réclamer un plan de rénovation des écoles', [{ kind: 'dossier', domain: 'education', delta: 3 }, seg('jeunes', 1), eco({ deficit: 0.05 })], 'Isolation, arbres dans les cours, stores : un chantier de dix ans.'),
        c('horaires', 'Avancer les horaires de classe', [s('popularity', 1), seg('populaires', -1)], 'Cours de 7 h à 12 h. Les familles qui travaillent s’organisent comme elles peuvent.'),
      ],
    }),
  },
  {
    tag: 'ev_marche_noel', weight: 2, eligible: d => monthIndex(d.week) === 11,
    build: () => ({
      title: 'Le marché de Noël',
      context: 'Vin chaud, chalets en bois et chorale d’enfants : le marché de Noël ouvre ce week-end.',
      choices: [
        c('inaugurer', 'L’inaugurer en personne', [s('popularity', 2), seg('retraites', 1), s('energy', -3), s('stress', -2)], 'Un bonnet rouge, un gobelet fumant et cent poignées de main.'),
        c('famille', 'Y aller en famille, incognito', [s('stress', -5), s('energy', 3)], 'Personne ne vous reconnaît sous l’écharpe. Une soirée parfaite.'),
      ],
    }),
  },
  {
    tag: 'ev_startup', weight: 0.7,
    build: () => ({
      title: 'Une licorne près de chez vous',
      context: 'Une jeune entreprise de votre région lève 80 millions d’euros pour ses batteries au sodium. Ses fondateurs ont trente ans.',
      choices: [
        c('visiter', 'Visiter leurs locaux', [seg('cadres', 2), seg('jeunes', 1), { kind: 'dossier', domain: 'numerique', delta: 2 }, eco({ confidence: 1 })], 'Baby-foot, tableaux blancs, et une usine prévue dans votre circonscription.'),
        c('emplois', 'Exiger que l’usine reste en France', [seg('populaires', 2), s('credibility', 1)], 'Les fondateurs promettent. Les investisseurs, eux, n’ont rien promis.'),
      ],
    }),
  },
  {
    tag: 'ev_defi_lecteurs', weight: 0.6,
    build: () => ({
      title: 'Le défi des lecteurs',
      context: 'Un quotidien régional met les élus au défi : une grille de capitales du monde, résultats publiés demain en page 3.',
      choices: [
        c('jouer', 'Relever le défi', [{ kind: 'minigame', gameId: 'capitalodoku', title: 'Le défi des lecteurs', reward: [s('credibility', 2), s('popularity', 1)], penalty: [s('popularity', -1)] }], 'Le journaliste lance le chronomètre.'),
        c('decliner', 'Décliner poliment', [s('popularity', -1)], '« Trop occupé·e » : le journal publie une case vide à votre nom.'),
      ],
    }),
  },
  {
    tag: 'ev_metro_panne', weight: 0.6,
    build: () => ({
      title: 'Coincé·e dans le métro',
      context: 'Panne de signalisation : votre rame est bloquée quarante minutes dans un tunnel. Les voyageurs vous ont reconnu·e.',
      choices: [
        c('discuter', 'En profiter pour discuter', [s('popularity', 2), seg('populaires', 1), seg('cadres', 1), s('stress', 1)], 'Retraites, loyers, horaires de crèche : le meeting le plus improvisé de votre carrière.'),
        c('grille', 'Sortir le Metrodoku du journal', [{ kind: 'minigame', gameId: 'metrodoku', title: 'Metrodoku dans le tunnel', reward: [seg('jeunes', 2), s('stress', -3)], penalty: [] }], 'Votre voisin de siège vous souffle une station.'),
      ],
    }),
  },
];

/** Une petite phrase : un moment où une formule peut rester (tirage à part) */
export const PHRASE_EVENT: RandomEvent =
{
    tag: 'petite_phrase', weight: 1.4, minRank: 'conseiller_municipal',
    build: (_d, rng) => {
      const ctx = rng.pick(PHRASES);
      const q = (text: string, bold: number): Effect => ({ kind: 'quote', text, bold });
      return {
        title: ctx.title,
        context: `${ctx.context} Ce que vous direz restera peut-être.`,
        choices: [
          c('prudent', ctx.f[0], [q(ctx.f[0].replace(/^« | »$/g, ''), 0.05)], 'Une réponse sans risque. Sans relief non plus.'),
          c('marquant', ctx.f[1], [q(ctx.f[1].replace(/^« | »$/g, ''), 0.45)], 'La formule est reprise dans les titres du soir.'),
          c('provoc', ctx.f[2], [q(ctx.f[2].replace(/^« | »$/g, ''), 0.85)], 'Un silence, puis la salle s’enflamme. Pour le meilleur ou pour le pire.'),
        ],
      };
    },
  };

/** Les moments où une petite phrase peut naître : prudente, marquante, provocatrice */
const PHRASES: { title: string; context: string; f: [string, string, string] }[] = [
  { title: 'Sur le plateau du 20 heures', context: 'La journaliste vous interroge sur le pouvoir d’achat. Les caméras zooment.',
    f: ['« Nous agirons avec responsabilité et méthode. »', '« Le pouvoir d’achat, ce n’est pas un slogan : c’est un frigo plein. »', '« Les fins de mois difficiles, je connais : moi aussi je compte en fin de mois… mes rendez-vous. »'] },
  { title: 'Au pupitre du meeting', context: 'Cinq mille personnes, des drapeaux, un silence avant votre conclusion.',
    f: ['« Ensemble, nous construirons l’avenir. »', '« La France n’est pas fatiguée : elle est impatiente ! »', '« Ceux qui nous gouvernent ont des montres, nous, nous avons le temps ! »'] },
  { title: 'Devant l’usine qui ferme', context: 'Les salariés vous attendent derrière les grilles, gilets orange sur le dos.',
    f: ['« Je serai à vos côtés dans les négociations. »', '« Une usine qui ferme, c’est une ville qui s’éteint. »', '« Si l’État ne peut rien, alors à quoi sert l’État ? »'] },
  { title: 'Au milieu des tracteurs', context: 'Un agriculteur vous tend le micro, de la paille dans les bottes.',
    f: ['« Nous travaillons à des solutions concrètes. »', '« Sans paysans, pas de pays. »', '« Bruxelles connaît mieux les vaches en photo que dans les prés ! »'] },
  { title: 'Sur le climat, au micro du matin', context: 'Le présentateur cite le dernier rapport du GIEC.',
    f: ['« Le climat est une priorité de notre action. »', '« Il n’y a pas de planète B, et pas de plan B. »', '« L’écologie punitive, c’est l’écologie des riches. »'] },
  { title: 'Devant des lycéens', context: 'Un élève vous demande pourquoi il devrait croire en la politique.',
    f: ['« Parce que la démocratie a besoin de vous. »', '« La politique, si vous ne vous en occupez pas, elle s’occupe de vous. »', '« Franchement ? Ne croyez personne. Pas même moi. »'] },
  { title: 'Après une soirée électorale difficile', context: 'Les militants sont déçus. Les caméras attendent votre réaction.',
    f: ['« Nous prenons acte du résultat. »', '« On ne perd jamais : on gagne ou on apprend. »', '« Les électeurs se sont trompés, ils le comprendront vite. »'] },
  { title: 'Face aux élites, sur un plateau', context: 'On vous accuse d’être « déconnecté·e ».',
    f: ['« Je reste à l’écoute de tous les Français. »', '« Je préfère un marché du dimanche à un dîner en ville. »', '« Les vrais déconnectés, ce sont ceux qui n’ont jamais pris un RER à 7 heures. »'] },
  { title: 'Sur la sécurité, au journal régional', context: 'Une agression a choqué votre région.',
    f: ['« Toute la lumière doit être faite. »', '« La sécurité, c’est la première des libertés. »', '« Il faut nettoyer tout ça, et vite. »'] },
  { title: 'Sur l’école, au congrès des parents', context: 'On vous interpelle sur les professeurs non remplacés.',
    f: ['« Nous recruterons davantage. »', '« Une classe sans professeur, c’est une promesse trahie. »', '« Les vacances scolaires sont trop longues, voilà le vrai problème. »'] },
  { title: 'Dans une émission humoristique', context: 'L’humoriste vous pousse dans vos retranchements. Le public rit déjà.',
    f: ['« Je prends l’humour avec humour. »', '« Mon programme tient en trois mots : moins de blabla. Enfin, quatre. »', '« Si je n’étais pas en politique, je serais… humoriste. Ah, on me dit que c’est pareil. »'] },
];

/** Libellés des électorats (pour les textes) */
export const SEGMENT_LABEL = Object.fromEntries(SEGMENTS.map(x => [x.id, x.label])) as Record<Segment, string>;

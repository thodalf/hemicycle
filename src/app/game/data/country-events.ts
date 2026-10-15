import { Effect, GameState, Segment } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';
import { monthIndex, yearOf } from '../engine/calendar';
import { accountability, segmentRows } from '../engine/country';
import { annexedEnemies } from '../engine/annex';
import { SEGMENTS } from './programme';
import { freshDeparture } from '../engine/npc-life';
import { highOffice } from '../engine/office';

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
const kg = (x: Omit<Extract<Effect, { kind: 'kingdom' }>, 'kind'>): Effect => ({ kind: 'kingdom', ...x });
const atLeastCouncil = 'conseiller_municipal' as const;
const atTop = (d: GameState) => highOffice(d);
const st2 = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });

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
  {
    tag: 'ev_chat_mairie', weight: 0.6,
    build: () => ({
      title: 'Le chat de la mairie',
      context: 'Un chat roux s’est installé à l’accueil de la mairie. Il a désormais son propre compte sur les réseaux, plus suivi que le vôtre.',
      choices: [
        c('adopter', 'L’adopter officiellement', [s('popularity', 2), { kind: 'segment', segment: 'jeunes', delta: 2 }, s('stress', -2)], '« Monsieur le Chat » reçoit une médaille de la ville. Vous posez à côté, au second plan.'),
        c('refuge', 'Le confier à un refuge', [s('credibility', 1), s('popularity', -1)], 'Les commentaires sont impitoyables. Le chat, lui, est très bien traité.'),
      ],
    }),
  },
  {
    tag: 'ev_sondage_bidon', weight: 0.6, minRank: atLeastCouncil,
    build: () => ({
      title: 'Un sondage farfelu',
      context: 'Un institut publie : « Avec quel élu aimeriez-vous partir en vacances ? » Vous arrivez deuxième, juste derrière un ancien footballeur.',
      choices: [
        c('jouer', 'Jouer le jeu avec humour', [s('popularity', 2), { kind: 'momentum', delta: 2 }], '« Je prends le camping-car, il apporte le ballon. » La vidéo tourne partout.'),
        c('serieux', '« Je préfère parler du fond »', [s('credibility', 1)], 'Un peu raide. Mais personne ne vous en veut.'),
      ],
    }),
  },
  {
    tag: 'ev_inondation_cave', weight: 0.6, minRank: atLeastCouncil,
    build: () => ({
      title: 'Orage de grêle',
      context: 'Des grêlons gros comme des balles de golf ont haché les vignes et les vergers de votre circonscription en vingt minutes.',
      choices: [
        c('catastrophe', 'Réclamer l’état de catastrophe naturelle', [{ kind: 'segment', segment: 'ruraux', delta: 3 }, s('politicalCapital', -4), s('energy', -4)], 'Vous arpentez les parcelles avec les viticulteurs. L’arrêté tombe en trois semaines.'),
        c('assurance', 'Renvoyer vers les assurances', [{ kind: 'segment', segment: 'ruraux', delta: -2 }, s('credibility', 1)], 'Juridiquement exact. Humainement glacial.'),
      ],
    }),
  },
  {
    tag: 'ev_prof_menace', weight: 0.6, minRank: atLeastCouncil,
    build: () => ({
      title: 'Un professeur menacé',
      context: 'Un professeur d’histoire de votre ville est menacé sur les réseaux après un cours sur la liberté d’expression. Ses collègues demandent du soutien.',
      choices: [
        c('soutenir', 'Lui rendre visite et le soutenir publiquement', [s('credibility', 2), { kind: 'dossier', domain: 'education', delta: 2 }, { kind: 'flagAdd', key: 'menace', delta: 2 }], 'Une poignée de main devant le lycée, une protection policière renforcée.'),
        c('discret', 'Saisir le rectorat discrètement', [{ kind: 'dossier', domain: 'securite', delta: 1 }, s('credibility', -1)], 'Efficace, mais ses collègues auraient aimé vous voir.'),
      ],
    }),
  },
  {
    tag: 'ev_cagnotte_hopital', weight: 0.5,
    build: () => ({
      title: 'La cagnotte de l’hôpital',
      context: 'Les soignants de l’hôpital local lancent une cagnotte pour acheter un échographe. Une honte pour certains, un bel élan pour d’autres.',
      choices: [
        c('financer', 'Débloquer les fonds publics nécessaires', [{ kind: 'dossier', domain: 'sante', delta: 3 }, s('politicalCapital', -5), s('popularity', 2)], 'L’échographe arrive en un mois. La cagnotte finance une salle de repos.'),
        c('donner', 'Donner personnellement', [{ kind: 'funds', account: 'personal', delta: -300 }, s('popularity', 1)], 'Votre nom en bas de la liste des donateurs. Discret et apprécié.'),
      ],
    }),
  },
  {
    tag: 'ev_record_guinness', weight: 0.5,
    build: () => ({
      title: 'Un record du monde',
      context: 'Votre commune veut battre le record du monde de la plus longue table de banquet : 4 kilomètres, 12 000 convives.',
      choices: [
        c('participer', 'Présider le banquet', [s('popularity', 3), s('energy', -6), { kind: 'segment', segment: 'retraites', delta: 2 }], 'Record battu de 212 mètres. Vous avez serré 3 000 mains et mangé onze fromages.'),
        c('message', 'Envoyer un message de soutien', [s('popularity', 1)], 'Lu au micro entre le fromage et le dessert.'),
      ],
    }),
  },
  {
    tag: 'ev_greve_profs', weight: 0.6, minRank: atLeastCouncil,
    build: () => ({
      title: 'Les enseignants en grève',
      context: 'Les enseignants du département manifestent contre les fermetures de classes. Les parents d’élèves les rejoignent.',
      choices: [
        c('defiler', 'Défiler avec eux', [{ kind: 'segment', segment: 'populaires', delta: 2 }, { kind: 'dossier', domain: 'education', delta: 2 }, { kind: 'segment', segment: 'cadres', delta: -1 }], 'Une banderole, une écharpe tricolore, des slogans que vous chantez faux.'),
        c('mediation', 'Proposer une médiation avec le rectorat', [s('credibility', 2), s('politicalCapital', -3)], 'Deux classes sauvées sur cinq. Personne n’est pleinement satisfait.'),
      ],
    }),
  },
  {
    tag: 'ev_metro_mot', weight: 0.5,
    build: () => ({
      title: 'Le jeu de la matinale',
      context: 'La matinale de la radio vous propose de jouer en direct au mot mystère, avant votre interview politique.',
      choices: [
        c('jouer', 'Jouer en direct', [{ kind: 'minigame', gameId: 'motus_tele', title: 'Le mot de la matinale', reward: [s('popularity', 2), { kind: 'segment', segment: 'retraites', delta: 1 }], penalty: [s('popularity', -1)] }], 'Première lettre : à vous de jouer.'),
        c('passer', 'Passer directement à l’interview', [s('credibility', 1)], 'Sérieux, peut-être un peu trop.'),
      ],
    }),
  },
  {
    tag: 'pnj_obseques', weight: 4, eligible: d => !!freshDeparture(d, ['mort']),
    build: d => {
      const e = freshDeparture(d, ['mort'])!;
      const done: Effect = { kind: 'flag', key: `npcEv_${e.npcId}_${e.week}`, value: true };
      const mine = e.partyId === d.party.id;
      const close = e.relation >= 20;
      return {
        title: `Les obsèques de ${e.name}`,
        context: `${e.name} est mort·e à ${e.age} ans. ${mine ? 'Tout le parti est en deuil.' : e.relation <= -20 ? 'Vous vous êtes beaucoup affrontés.' : 'Une figure de la vie politique s’en va.'} La cérémonie a lieu jeudi ; ${e.successor} prend la relève.`,
        choices: [
          c('eloge', close || mine ? 'Prononcer l’éloge funèbre' : 'Assister à la cérémonie', [done, s('stress', 3), s('credibility', 2), ...(mine ? [{ kind: 'cohesion', delta: 3 } as Effect] : []), { kind: 'npcRelation', npcId: e.npcId, delta: 10 }],
            close || mine ? 'Votre voix se brise à la dernière phrase. Les caméras s’éteignent par pudeur.' : 'Au premier rang, en silence. Son successeur vient vous serrer la main.'),
          c('hommage', 'Un hommage écrit, sobre', [done, s('credibility', 1)], 'Quelques lignes justes, reprises par la presse.'),
          ...(e.relation <= -20 ? [c('adversaire', 'Saluer « un adversaire loyal »', [done, s('credibility', 3), { kind: 'segment', segment: 'retraites', delta: 1 } as Effect], '« Nous n’étions d’accord sur rien, mais je l’estimais. » Une phrase qui vous honore.')] : []),
        ],
      };
    },
  },
  {
    tag: 'pnj_depart', weight: 3, eligible: d => !!freshDeparture(d, ['retraite', 'prive', 'international', 'maladie']),
    build: d => {
      const e = freshDeparture(d, ['retraite', 'prive', 'international', 'maladie'])!;
      const done: Effect = { kind: 'flag', key: `npcEv_${e.npcId}_${e.week}`, value: true };
      const what = e.fate === 'retraite' ? 'son pot de départ à la retraite' : e.fate === 'prive' ? 'son dernier jour avant de rejoindre le privé' : e.fate === 'international' ? 'sa réception d’adieu avant de partir à l’étranger' : 'un dernier déjeuner avant de se retirer pour se soigner';
      return {
        title: `Le départ de ${e.name}`,
        context: `${e.name} (${e.age} ans) vous invite à ${what}. Son successeur, ${e.successor}, sera là aussi.`,
        choices: [
          c('y_aller', 'Y aller, et faire connaissance avec le successeur', [done, s('energy', -3), { kind: 'npcRelation', npcId: e.npcId, delta: 12 }, s('influence', 1)], `Un discours ému, un verre, et une longue conversation avec ${e.successor}.`),
          c('carte', 'Envoyer une carte', [done], 'Une carte chaleureuse, et rien de plus.'),
          ...(e.fate === 'prive' ? [c('pantouflage', 'Dénoncer le pantouflage', [done, s('credibility', 2), { kind: 'segment', segment: 'populaires', delta: 1 } as Effect, { kind: 'npcRelation', npcId: e.npcId, delta: -8 } as Effect], 'Votre tribune sur les allers-retours public-privé fait du bruit.')] : []),
        ],
      };
    },
  },
  {
    tag: 'pnj_ineligible', weight: 3, eligible: d => !!freshDeparture(d, ['ineligible']),
    build: d => {
      const e = freshDeparture(d, ['ineligible'])!;
      const done: Effect = { kind: 'flag', key: `npcEv_${e.npcId}_${e.week}`, value: true };
      return {
        title: `${e.name} condamné·e`,
        context: `${e.name} est déclaré·e inéligible pour cinq ans. Les journalistes attendent votre réaction.`,
        choices: [
          c('exemplarite', 'Appeler à l’exemplarité des élus', [done, s('credibility', 2), ...(e.partyId === d.party.id ? [{ kind: 'cohesion', delta: -2 } as Effect] : [])], 'Une réaction ferme, saluée par les associations anticorruption.'),
          c('presomption', 'Rappeler qu’il y a un appel possible', [done, ...(e.partyId === d.party.id ? [{ kind: 'cohesion', delta: 2 } as Effect] : []), s('credibility', -1)], 'Prudent, peut-être trop.'),
        ],
      };
    },
  },
  {
    tag: 'ev_doyen_assemblee', weight: 0.5, minRank: 'depute',
    build: () => ({
      title: 'Le doyen de l’Assemblée',
      context: 'Le doyen de l’Assemblée, 91 ans, annonce qu’il se représentera. « Tant que la tête suit. » Les plus jeunes ricanent.',
      choices: [
        c('saluer', 'Saluer son énergie', [{ kind: 'segment', segment: 'retraites', delta: 2 }, s('popularity', 1)], 'Il vous invite à déjeuner et vous raconte la IVe République.'),
        c('renouveau', 'Plaider pour le renouvellement', [{ kind: 'segment', segment: 'jeunes', delta: 2 }, { kind: 'segment', segment: 'retraites', delta: -1 }], '« Place aux jeunes » : la formule fait mouche.'),
      ],
    }),
  },
  {
    tag: 'ev_anniversaire_rival', weight: 0.5, eligible: d => d.npcs.some(n => n.isRival),
    build: (d) => {
      const n = [...d.npcs].filter(x => x.isRival).sort((a, b) => (b.age ?? 0) - (a.age ?? 0))[0];
      return {
        title: `Les ${Math.floor(n.age ?? 60)} ans de ${n.name}`,
        context: `${n.name} fête son anniversaire en grande pompe. Vous êtes invité·e, à votre grande surprise.`,
        choices: [
          c('venir', 'Y aller avec un cadeau', [{ kind: 'npcRelation', npcId: n.id, delta: 10 }, s('energy', -3)], 'Un livre dédicacé, une coupe de champagne, une trêve d’un soir.'),
          c('decliner', 'Décliner poliment', [{ kind: 'npcRelation', npcId: n.id, delta: -2 }], 'Votre absence est remarquée, et commentée.'),
        ],
      };
    },
  },
  {
    tag: 'ev_pluie_meeting', weight: 0.6,
    build: () => ({
      title: 'Discours sous la pluie',
      context: 'Une averse diluvienne s’abat sur votre meeting en plein air. Les militants vous regardent : on remballe ?',
      choices: [
        c('continuer', 'Continuer, trempé·e jusqu’aux os', [s('popularity', 3), { kind: 'momentum', delta: 2 }, { kind: 'health', delta: -1 }], 'La photo, cheveux collés et poing levé, devient l’image de la semaine.'),
        c('abri', 'Se replier sous le préau', [s('stress', -1)], 'Un discours écourté, mais tout le monde est au sec.'),
      ],
    }),
  },
  {
    tag: 'ev_livre_memoires', weight: 0.5, minRank: atLeastCouncil,
    build: () => ({
      title: 'Un éditeur vous propose un livre',
      context: 'Une grande maison d’édition vous propose d’écrire votre vision du pays. Un « nègre » est disponible si besoin.',
      choices: [
        c('ecrire', 'L’écrire vous-même, la nuit', [s('credibility', 3), s('energy', -8), { kind: 'funds', account: 'personal', delta: 3000 }], 'Six mois de nuits blanches, un vrai livre, de vraies critiques.'),
        c('plume', 'Confier l’écriture à une plume', [s('popularity', 1), { kind: 'funds', account: 'personal', delta: 5000 }, { kind: 'exposure', delta: 1 }], 'Un livre fluide… dont un journaliste retrouve vite le vrai auteur.'),
        c('refuser', 'Refuser : pas le temps', [], 'Vous avez mieux à faire. Pour l’instant.'),
      ],
    }),
  },
  {
    tag: 'ev_stage_lyceen', weight: 0.5,
    build: () => ({
      title: 'Un stagiaire de troisième',
      context: 'Un collégien de votre quartier vous demande de l’accueillir pour son stage d’observation. Il a déjà préparé vingt questions.',
      choices: [
        c('accueillir', 'L’accueillir toute la semaine', [{ kind: 'segment', segment: 'jeunes', delta: 2 }, s('stress', 1), s('popularity', 1)], 'Son rapport de stage, publié par sa mère, est hilarant et tendre.'),
        c('equipe', 'Le confier à votre équipe', [s('energy', 1)], 'Il a surtout fait des photocopies.'),
      ],
    }),
  },
  {
    tag: 'ev_selfie_star', weight: 0.5,
    build: () => ({
      title: 'Un selfie avec une star',
      context: 'Une chanteuse populaire vous croise dans un TGV et propose un selfie. Elle a douze millions d’abonnés… et des positions tranchées.',
      choices: [
        c('selfie', 'Accepter avec le sourire', [{ kind: 'segment', segment: 'jeunes', delta: 3 }, s('popularity', 1), s('credibility', -1)], 'La photo bat des records. Ses fans découvrent votre existence.'),
        c('poli', 'Discuter, mais sans photo', [s('credibility', 1)], 'Une conversation passionnante sur la musique à l’école. Personne n’en saura rien.'),
      ],
    }),
  },
  {
    tag: 'ev_panne_micro', weight: 0.6, minRank: atLeastCouncil,
    build: () => ({
      title: 'Le micro coupe',
      context: 'En plein discours, le micro coupe. Trois cents personnes vous regardent, un technicien s’agite en coulisses.',
      choices: [
        c('voix', 'Continuer à pleine voix, debout sur une chaise', [s('popularity', 2), { kind: 'momentum', delta: 2 }, s('energy', -3)], 'La salle se lève. Personne n’oubliera ce discours sans micro.'),
        c('attendre', 'Attendre que ça revienne', [s('stress', 2)], 'Dix minutes de flottement. On parle surtout de la panne.'),
      ],
    }),
  },
  {
    tag: 'ev_jumeaux_conseil', weight: 0.5, minRank: atLeastCouncil,
    build: () => ({
      title: 'Un conseil municipal des enfants',
      context: 'Les élèves de CM2 ont élu leur conseil municipal. Leur première proposition : des toboggans à la place des escaliers de la mairie.',
      choices: [
        c('ecouter', 'Les recevoir et étudier leurs idées', [{ kind: 'segment', segment: 'jeunes', delta: 1 }, s('popularity', 2), s('stress', -2)], 'Pas de toboggan, mais un jardin partagé et des bancs dans la cour.'),
        c('photo', 'Une photo officielle et c’est tout', [s('popularity', 1)], 'Les enfants sont un peu déçus. Les parents aussi.'),
      ],
    }),
  },
  {
    tag: 'ev_brouillard_aeroport', weight: 0.5, minRank: 'depute',
    build: () => ({
      title: 'Bloqué·e à l’aéroport',
      context: 'Le brouillard cloue tous les avions au sol. Vous devez être à Bruxelles demain matin pour une réunion cruciale.',
      choices: [
        c('voiture', 'Prendre la route toute la nuit', [s('energy', -10), s('credibility', 1), { kind: 'dossier', domain: 'diplomatie', delta: 2 }], 'Vous arrivez à 8 h 55, cravate de travers. On salue votre ténacité.'),
        c('visio', 'Participer en visioconférence', [s('energy', 2), { kind: 'dossier', domain: 'diplomatie', delta: -1 }], 'L’écran fige au moment crucial. Votre homologue a parlé à votre place.'),
      ],
    }),
  },
  {
    tag: 'ev_mot_jeu_tele', weight: 0.4,
    build: () => ({
      title: 'Défié·e au Metrodoku',
      context: 'Un humoriste vous met au défi, en direct, de remplir une grille de stations de métro plus vite que lui.',
      choices: [
        c('relever', 'Relever le défi', [{ kind: 'minigame', gameId: 'metrodoku', title: 'Le défi de l’humoriste', reward: [s('popularity', 2), { kind: 'segment', segment: 'jeunes', delta: 2 }], penalty: [s('popularity', -1)] }], 'Le chronomètre démarre. Le public retient son souffle.'),
        c('esquive', '« Je prends la ligne 14, elle est automatique »', [s('popularity', 1)], 'La blague fait sourire. Le défi, lui, reste ouvert.'),
      ],
    }),
  },
  {
    tag: 'roy_bastille', weight: 2, eligible: d => !!d.kingdom,
    build: () => ({
      title: 'Le front républicain à la Bastille',
      context: 'Tous les partis d’opposition défilent ensemble, pour la première fois depuis des décennies : « Rendez-nous la République ! »',
      choices: [
        c('recevoir', 'Recevoir une délégation des manifestants', [kg({ opposition: -6, prestige: 2 }), s('energy', -4)], 'Une heure d’échanges tendus mais respectueux. Les images apaisent.'),
        c('ignorer', 'Ignorer : « La rue ne gouverne pas »', [kg({ opposition: 6, stabilite: -3 })], 'Le cortège suivant est deux fois plus grand.'),
      ],
    }),
  },
  {
    tag: 'roy_tabloids', weight: 1.5, eligible: d => !!d.kingdom,
    build: () => ({
      title: 'La famille royale à la une des tabloïds',
      context: 'Un magazine britannique publie des photos de vos vacances, avec un titre moqueur : « Le roi bronze, la France râle ».',
      choices: [
        c('humour', 'Répondre avec humour', [kg({ prestige: 3 }), s('popularity', 2)], '« Même les rois mettent de la crème solaire. » Le pays sourit.'),
        c('proces', 'Attaquer le magazine en justice', [kg({ prestige: -2, opposition: 2 }), s('credibility', 1)], 'Vous gagnerez. Mais tout le monde a vu les photos.'),
      ],
    }),
  },
  {
    tag: 'roy_motion', weight: 1.2, eligible: d => !!d.kingdom && d.kingdom.opposition >= 55,
    build: d => ({
      title: 'L’Assemblée réclame un référendum',
      context: `Les députés de l’opposition déposent une motion pour un référendum sur le retour à la République. Front républicain : ${Math.round(d.kingdom!.opposition)}/100.`,
      choices: [
        c('accepter', 'Accepter le référendum et faire campagne', d.kingdom!.prestige >= 55
          ? [kg({ opposition: -20, prestige: 6, stabilite: 6 }), s('credibility', 3)]
          : [kg({ restore: true })],
          d.kingdom!.prestige >= 55 ? 'Le « non » à la République l’emporte de justesse : votre trône sort renforcé.' : 'Le « oui » l’emporte. Vous vous inclinez : la République est rétablie.'),
        c('refuser', 'Refuser : la Constitution ne le prévoit pas', [kg({ opposition: 8, stabilite: -6 }), s('credibility', -2)], 'Légal, mais la colère monte d’un cran.'),
      ],
    }),
  },
  {
    tag: 'roy_mariage_prince', weight: 1, eligible: d => !!d.kingdom,
    build: () => ({
      title: 'Un mariage royal à l’étranger',
      context: 'Une famille royale européenne vous invite au mariage de son héritier. Toutes les têtes couronnées seront là.',
      choices: [
        c('y_aller', 'Y aller en grande pompe', [kg({ prestige: 5 }), { kind: 'intl', prestige: 3 }, s('energy', -5)], 'Votre arrivée en calèche fait la une de toute l’Europe.'),
        c('sobre', 'Envoyer un message et rester au travail', [kg({ stabilite: 2 }), s('credibility', 1)], '« Le souverain qui préfère ses dossiers aux bals. » Les Français apprécient.'),
      ],
    }),
  },
  {
    tag: 'roy_liste_civile', weight: 1, eligible: d => !!d.kingdom,
    build: () => ({
      title: 'Le coût de la Couronne',
      context: 'La Cour des comptes publie le coût de la monarchie : 98 millions d’euros par an. L’opposition s’en empare.',
      choices: [
        c('baisser', 'Réduire de moitié la liste civile', [kg({ opposition: -5, prestige: 3 }), { kind: 'funds', account: 'personal', delta: -5000 }], 'Un geste salué jusque dans les rangs républicains.'),
        c('justifier', 'Défendre « le rayonnement de la France »', [kg({ opposition: 4 }), s('credibility', -1)], 'Les chiffres du tourisme ne convainquent personne.'),
      ],
    }),
  },
  {
    tag: 'roy_portrait', weight: 1, eligible: d => !!d.kingdom,
    build: () => ({
      title: 'Le portrait officiel',
      context: 'Un peintre célèbre doit réaliser votre portrait officiel, qui sera accroché dans toutes les mairies. Il vous propose deux styles.',
      choices: [
        c('hermine', 'En manteau d’hermine, sceptre en main', [kg({ prestige: 4, opposition: 3 })], 'Majestueux. Les caricaturistes s’en donnent à cœur joie.'),
        c('simple', 'En costume, à votre bureau', [kg({ opposition: -3, prestige: 1 }), s('credibility', 1)], 'Un souverain qui travaille : le portrait plaît aux mairies républicaines.'),
      ],
    }),
  },
  {
    tag: 'roy_sondage', weight: 1, eligible: d => !!d.kingdom,
    build: d => ({
      title: 'Faut-il garder la monarchie ?',
      context: `Un grand sondage demande aux Français s’ils veulent garder la monarchie. Prestige du trône : ${Math.round(d.kingdom!.prestige)}/100.`,
      choices: [
        c('commenter', 'Commenter : « Je sers tous les Français »', d.kingdom!.prestige >= 50 ? [kg({ prestige: 3, opposition: -2 })] : [kg({ opposition: 3 })],
          d.kingdom!.prestige >= 50 ? '54 % pour la Couronne. Votre réponse sobre est saluée.' : '41 % seulement. Le front républicain jubile.'),
        c('silence', 'Ne pas commenter les sondages', [kg({ stabilite: 2 })], 'Le silence royal : une vieille tradition.'),
      ],
    }),
  },
  {
    tag: 'roy_heritier_scandale', weight: 0.8, eligible: d => !!d.kingdom,
    build: () => ({
      title: 'L’héritier·e en boîte de nuit',
      context: 'Des photos montrent votre héritier·e dansant sur une table à Saint-Tropez, une bouteille de champagne à la main.',
      choices: [
        c('excuses', 'Présenter des excuses publiques', [kg({ prestige: -2, opposition: -2 }), s('credibility', 1)], '« La jeunesse a ses excès. » Les Français pardonnent vite.'),
        c('defendre', 'Défendre son droit à une vie privée', [kg({ prestige: -1, opposition: 2 }), { kind: 'segment', segment: 'jeunes', delta: 2 }], 'Les jeunes approuvent. Les tabloïds redoublent.'),
      ],
    }),
  },
  {
    tag: 'roy_visite_etat', weight: 1, eligible: d => !!d.kingdom,
    build: () => ({
      title: 'Une visite d’État au Royaume-Uni',
      context: 'Le roi d’Angleterre vous reçoit à Windsor. Il vous propose une promenade en calèche… et une partie de croquet.',
      choices: [
        c('croquet', 'Accepter le croquet (et perdre poliment)', [kg({ prestige: 4 }), { kind: 'intl', prestige: 3 }, s('popularity', 1)], 'Défaite élégante 3-2. La presse britannique vous adore.'),
        c('gagner', 'Jouer pour gagner', [kg({ prestige: 2 }), s('popularity', 3), { kind: 'intl', prestige: -1 }], 'Victoire 5-0. La France exulte ; Londres moins.'),
      ],
    }),
  },
  {
    tag: 'ev_canicule_classes', weight: 0.6, minRank: atLeastCouncil,
    build: () => ({
      title: 'Canicule dans les écoles',
      context: '38 °C dans les salles de classe en juin. Des parents réclament la fermeture des écoles ; les enseignants demandent des ventilateurs.',
      choices: [
        c('vegetaliser', 'Lancer un plan de végétalisation des cours', [{ kind: 'dossier', domain: 'ecologie', delta: 2 }, { kind: 'dossier', domain: 'education', delta: 2 }, s('politicalCapital', -4)], 'Arbres, ombrières, fontaines : un plan sur cinq ans, salué.'),
        c('horaires', 'Autoriser des horaires aménagés', [seg('populaires', -1), seg('retraites', 1), s('credibility', 1)], 'Cours de 7 h à 13 h : les familles s’organisent tant bien que mal.'),
      ],
    }),
  },
  {
    tag: 'ev_boulanger_record', weight: 0.6,
    build: () => ({
      title: 'Le boulanger champion du monde',
      context: 'Un boulanger de votre secteur vient d’être sacré meilleure baguette du monde. Il vous invite à goûter devant les caméras.',
      choices: [
        c('gouter', 'Y aller, croquer la baguette', [s('popularity', 2), seg('ruraux', 1), seg('retraites', 1)], 'Le crouton craque au micro. Le son devient un mème.'),
        c('apprendre', 'Demander à pétrir une fournée avec lui', [s('popularity', 3), s('energy', -4)], '4 h du matin, farine partout : le reportage fait un carton.'),
      ],
    }),
  },
  {
    tag: 'ev_trottinettes', weight: 0.6, minRank: atLeastCouncil,
    build: () => ({
      title: 'La guerre des trottinettes',
      context: 'Trottinettes électriques abandonnées partout, accidents en hausse : les riverains exigent une interdiction.',
      choices: [
        c('interdire', 'Les interdire en ville', [seg('retraites', 2), seg('jeunes', -2), s('credibility', 1)], 'Les trottoirs respirent. Les jeunes râlent.'),
        c('encadrer', 'Encadrer : parkings dédiés et vitesse limitée', [seg('jeunes', 1), seg('cadres', 1), { kind: 'dossier', domain: 'territoires', delta: 1 }], 'Un compromis qui fâche un peu tout le monde, donc juste.'),
      ],
    }),
  },
  {
    tag: 'ev_video_virale', weight: 0.6,
    build: () => ({
      title: 'Votre chute en direct',
      context: 'En descendant de l’estrade, vous trébuchez et finissez dans une plante verte. La vidéo cumule 9 millions de vues en une nuit.',
      choices: [
        c('assumer', 'En rire et reposter la vidéo', [s('popularity', 3), seg('jeunes', 3), { kind: 'trait', trait: 'meme' }], 'Vous devenez un mème. Pour toujours.'),
        c('ignorer', 'Ne rien dire et attendre que ça passe', [s('credibility', -1)], 'Ça passe. Lentement.'),
      ],
    }),
  },
  {
    tag: 'ev_marathon_paris', weight: 0.7, eligible: d => Number(d.player.flags['marathon'] ?? 0) >= 5 && !(d.player.traits ?? []).includes('marathonien'),
    build: d => ({
      title: 'Le marathon de Paris',
      context: `Vous êtes inscrit·e au marathon de Paris. ${Number(d.player.flags['marathon']) >= 8 ? 'Votre préparation a été sérieuse.' : 'Votre préparation a été… légère.'}`,
      choices: [
        c('courir', 'Courir les 42,195 km', [s('energy', -15), s('popularity', 3), { kind: 'trait', trait: 'marathonien' }], 'Ligne d’arrivée franchie en 4 h 12. Les photos sont superbes.',
          { risk: { baseChance: Number(d.player.flags['marathon']) >= 8 ? 0.15 : 0.55, onFailure: [s('energy', -10), s('popularity', -1)], failureNews: 'Abandon au 30ᵉ kilomètre : le mur, le vrai.' } }),
        c('semi', 'Se contenter du semi-marathon', [s('energy', -6), s('popularity', 1)], 'Raisonnable. Personne ne vous en veut.'),
      ],
    }),
  },
  {
    tag: 'ev_accident_ski', weight: 0.4,
    build: () => ({
      title: 'Le hors-piste de trop',
      context: 'En vacances à la montagne, des amis vous proposent une descente hors-piste « sans danger ».',
      choices: [
        c('y_aller', 'Y aller', [s('stress', -6), s('energy', 4)], 'Poudreuse parfaite, souvenirs magnifiques.',
          { risk: { baseChance: 0.35, onFailure: [s('energy', -20), { kind: 'trait', trait: 'balafre' }, s('popularity', 2)], failureNews: 'Chute dans un couloir : douze points de suture au front. La cicatrice restera.' } }),
        c('piste', 'Rester sur les pistes balisées', [s('stress', -3)], 'Prudence. Le vin chaud est très bon aussi.'),
      ],
    }),
  },
  {
    tag: 'ev_lettres_mentor', weight: 0.4, minRank: atLeastCouncil,
    build: () => ({
      title: 'Les lettres de votre mentor',
      context: 'Votre premier mentor politique s’est éteint. Sa fille vous remet une boîte de lettres qu’il vous écrivait sans jamais les envoyer.',
      choices: [
        c('lire', 'Les lire une à une, seul·e', [s('stress', -4), s('credibility', 2)], '« Ne deviens jamais ce que tu combats. » Vous relisez cette phrase souvent.'),
        c('publier', 'Les faire publier', [s('popularity', 2), { kind: 'income', base: 3000 }, { kind: 'exposure', delta: 1 }], 'Le recueil devient un succès de librairie. Certains trouvent le geste déplacé.'),
      ],
    }),
  },
  {
    tag: 'ev_greve_sncf_tournee', weight: 0.6, minRank: atLeastCouncil,
    build: () => ({
      title: 'Grève SNCF le jour de votre tournée',
      context: 'Trois rendez-vous en province sont prévus aujourd’hui, et un train sur deux est supprimé. Votre équipe propose d’annuler.',
      choices: [
        c('maintenir', 'Maintenir la tournée et trouver des trains', [{ kind: 'minigame', gameId: 'correspondances', title: 'La tournée malgré la grève', reward: [s('popularity', 3), seg('ruraux', 2)], penalty: [s('stress', 4), s('popularity', -1)] }], 'Vous voilà devant le tableau des départs, café à la main.'),
        c('annuler', 'Annuler et faire les rendez-vous en visio', [s('popularity', -1), s('energy', 3)], 'Les élus locaux sont déçus. La connexion, elle, a coupé deux fois.'),
      ],
    }),
  },
  {
    tag: 'ev_cortege_bloque', weight: 0.6, minRank: 'depute',
    build: () => ({
      title: 'Coincé·e dans les embouteillages',
      context: 'Votre rendez-vous avec un grand patron qui veut investir dans votre circonscription commence dans quinze minutes. Paris est bloqué par une manifestation.',
      choices: [
        c('foncer', 'Prendre le volant et foncer', [{ kind: 'minigame', gameId: 'cortege_paris', title: 'Quinze minutes pour traverser Paris', reward: [st2('influence', 3), { kind: 'economy', unemployment: -0.02 }], penalty: [st2('influence', -2)] }], 'Ceinture bouclée, GPS éteint : vous connaissez Paris.'),
        c('excuser', 'Appeler pour décaler', [s('influence', -1)], 'Il accepte de décaler… à dans trois semaines.'),
      ],
    }),
  },
  {
    tag: 'ev_depart_precipite', weight: 0.5, minRank: atLeastCouncil,
    build: () => ({
      title: 'Départ dans une heure',
      context: 'On vous demande de partir immédiatement pour un déplacement imprévu de plusieurs jours. Votre valise n’est pas faite.',
      choices: [
        c('valise', 'Faire sa valise soi-même, vite', [{ kind: 'minigame', gameId: 'valise_voyage', title: 'La valise en une heure', reward: [s('credibility', 2), s('popularity', 1)], penalty: [s('stress', 3)] }], 'Vous ouvrez l’armoire. Le chauffeur klaxonne déjà.'),
        c('assistant', 'Laisser votre assistant·e s’en charger', [s('stress', -1)], 'Il ou elle a pris trois cravates et aucune chaussette.'),
      ],
    }),
  },
  {
    tag: 'ev_avion_retarde', weight: 0.5, minRank: atLeastCouncil,
    build: () => ({
      title: 'Bloqué·e à l’aéroport',
      context: 'Votre vol est retardé de six heures. Dans le hall, des voyageurs vous reconnaissent et commencent à vous interpeller sur le pouvoir d’achat.',
      choices: [
        c('discuter', 'S’asseoir avec eux et discuter', [s('popularity', 3), seg('populaires', 2), s('energy', -4)], 'Six heures de débat improvisé : une vidéo de vous sur une valise en guise de tribune devient virale.'),
        c('salon', 'Se réfugier au salon VIP', [s('stress', -3), s('popularity', -2)], 'Un passager vous photographie derrière la vitre du salon. La légende est cruelle.'),
      ],
    }),
  },
  {
    tag: 'ev_plume_malade', weight: 0.5, minRank: atLeastCouncil,
    build: () => ({
      title: 'Votre plume a la grippe',
      context: 'Le grand discours est demain matin. Votre plume est clouée au lit avec 40 de fièvre ; il ne reste qu’un brouillon en désordre.',
      choices: [
        c('ecrire', 'Remettre le discours en ordre soi-même', [{ kind: 'minigame', gameId: 'plume_discours', title: 'Le discours de la nuit', reward: [s('credibility', 3), s('popularity', 2)], penalty: [s('popularity', -2)] }], 'Café, lampe de bureau, brouillon étalé sur la table.'),
        c('lire', 'Lire le texte d’un ancien discours', [s('credibility', -1)], 'Un journaliste reconnaît des phrases de l’an dernier. Gênant.'),
      ],
    }),
  },
  {
    tag: 'ev_standard_sature', weight: 0.5, minRank: atLeastCouncil,
    build: () => ({
      title: 'Votre numéro dans le journal',
      context: 'Une coquille du quotidien régional publie votre numéro de permanence en une. Le standard explose.',
      choices: [
        c('decrocher', 'Décrocher vous-même', [{ kind: 'minigame', gameId: 'standard_ministere', title: 'Le standard en folie', reward: [s('popularity', 3), seg('populaires', 2)], penalty: [s('stress', 4)] }], 'Le premier appel : un monsieur dont le chien aboie trop.'),
        c('repondeur', 'Mettre un répondeur', [s('popularity', -1)], '« Votre appel est important pour nous. » Pas tant que ça, visiblement.'),
      ],
    }),
  },
  {
    tag: 'ev_nuit_tractations', weight: 0.5, minRank: 'depute',
    build: () => ({
      title: 'La nuit des tractations',
      context: 'Le gouvernement vacille : une majorité de rechange est possible si quelqu’un sait compter les sièges cette nuit.',
      choices: [
        c('compter', 'Prendre la calculette et les téléphones', [{ kind: 'minigame', gameId: 'arithmetique_majorite', title: 'Trouver 289 sièges avant l’aube', reward: [s('influence', 5), s('politicalCapital', 8)], penalty: [s('influence', -2)] }], 'Tableau blanc, café froid, dix groupes à convaincre.'),
        c('dormir', 'Laisser les autres négocier', [s('stress', -3)], 'Vous dormez. Au réveil, la majorité s’est faite sans vous.'),
      ],
    }),
  },
  {
    tag: 'ev_collaborateur_debauche', weight: 0.5, eligible: d => d.player.team.length > 0,
    build: d => {
      const r = d.player.team[d.week % d.player.team.length];
      return {
        title: 'Un rival débauche votre équipe',
        context: `Un adversaire propose à ${r.name} un poste mieux payé dans son cabinet. Votre collaborateur·rice vous le dit franchement.`,
        choices: [
          c('surenchere', 'Surenchérir : +20 % de salaire', [{ kind: 'team', recruitId: r.id, salaryPct: 20, morale: 20 }], 'Il ou elle reste. Votre masse salariale grimpe.'),
          c('loyaute', 'Faire appel à sa loyauté', [{ kind: 'team', recruitId: r.id, morale: -5 }, s('influence', 1)], 'Il ou elle reste… pour l’instant, et en garde un petit goût amer.'),
          c('laisser', 'Le ou la laisser partir avec vos vœux', [{ kind: 'team', recruitId: r.id, leave: true }, s('credibility', 1)], 'Un départ élégant. Vous aurez peut-être un allié dans le camp d’en face.'),
        ],
      };
    },
  },
  {
    tag: 'ev_factcheck_epingle', weight: 0.5,
    build: () => ({
      title: 'Un fact-checker vous épingle',
      context: 'Le chiffre que vous avez cité hier soir à la télévision était faux : une cellule de vérification le démontre, graphique à l’appui.',
      choices: [
        c('corriger', 'Corriger publiquement, avec le bon chiffre', [s('credibility', 2), s('popularity', -1)], 'Rare et apprécié : « Un politique qui reconnaît une erreur. »'),
        c('maintenir', 'Maintenir : « C’est l’ordre de grandeur qui compte »', [s('credibility', -3), { kind: 'exposure', delta: 2 }], 'Le graphique tourne en boucle toute la semaine.'),
      ],
    }),
  },
  {
    tag: 'ev_perroquet', weight: 0.35,
    build: () => ({
      title: 'Le perroquet du marché',
      context: 'Au marché, le perroquet d’un poissonnier répète votre slogan à tue-tête. La vidéo fait des millions de vues.',
      choices: [
        c('mascotte', 'En faire votre mascotte de campagne', [s('popularity', 2), seg('jeunes', 2), s('credibility', -1)], 'Le perroquet a désormais son compte sur les réseaux.'),
        c('sourire', 'En rire, sans plus', [s('popularity', 1)], 'Un moment de légèreté bienvenu.'),
      ],
    }),
  },
  {
    tag: 'ev_village_sans_eau', weight: 0.45, minRank: atLeastCouncil,
    build: () => ({
      title: 'Un village sans eau potable',
      context: 'Une canalisation a cédé : depuis trois jours, un village de 800 habitants n’a plus d’eau au robinet.',
      choices: [
        c('citernes', 'Faire venir des citernes, tout de suite', [seg('ruraux', 3), { kind: 'funds', account: 'campaign', delta: -1500 }, s('energy', -3)], 'Les citernes arrivent dans la nuit. On vous remercie à la boulangerie.'),
        c('prefet', 'Saisir le préfet et le syndicat des eaux', [s('credibility', 1), seg('ruraux', -1)], 'La procédure suit son cours. Les habitants, eux, attendent.'),
      ],
    }),
  },
  {
    tag: 'ev_cantine_greve', weight: 0.4,
    build: () => ({
      title: 'La cantine en grève',
      context: 'Les agents de la cantine d’une école sont en grève : trois cents enfants sans repas chaud ce midi.',
      choices: [
        c('sandwichs', 'Aller distribuer vous-même des repas', [seg('populaires', 2), s('energy', -4), s('popularity', 1)], 'La photo de vous, tablier noué, fait sourire tout le monde.'),
        c('mediation', 'Proposer une médiation aux grévistes', [s('credibility', 2), { kind: 'dossier', domain: 'education', delta: 2 }], 'Un accord est trouvé en deux jours.'),
      ],
    }),
  },
  {
    tag: 'ev_discours_ia', weight: 0.4,
    build: () => ({
      title: 'Votre discours écrit par une IA ?',
      context: 'Un site affirme que votre dernier discours a été généré par une intelligence artificielle : « trop parfait pour être humain ».',
      choices: [
        c('brouillons', 'Publier vos brouillons raturés', [s('credibility', 2), s('energy', -3)], 'Vos pattes de mouche convainquent tout le monde.'),
        c('assumer', 'Plaisanter : « Si seulement ! »', [seg('jeunes', 2), s('credibility', -1)], 'Les jeunes adorent. Les éditorialistes un peu moins.'),
      ],
    }),
  },
  {
    tag: 'ev_tracteurs_permanence', weight: 0.4, minRank: atLeastCouncil,
    build: () => ({
      title: 'Des tracteurs devant votre permanence',
      context: 'Une trentaine d’agriculteurs bloquent votre permanence avec leurs tracteurs : prix du lait, normes, retraites agricoles.',
      choices: [
        c('cafe', 'Sortir leur servir le café et écouter', [seg('ruraux', 3), s('energy', -3)], 'Deux heures de discussion sur le trottoir. Ils repartent, pas convaincus, mais respectés.'),
        c('police', 'Demander l’évacuation', [seg('ruraux', -3), s('credibility', 1)], 'Les tracteurs repartent, le lisier reste.'),
      ],
    }),
  },
  {
    tag: 'ev_podcast_fleuve', weight: 0.4,
    build: () => ({
      title: 'Trois heures de podcast',
      context: 'Le podcast le plus écouté des moins de trente ans vous invite pour une interview de trois heures, sans montage.',
      choices: [
        c('accepter', 'Accepter, sans fiche ni conseiller', [seg('jeunes', 3), s('popularity', 1), s('stress', 3)], 'Trois heures à parler de tout, même de votre enfance. Un million d’écoutes.'),
        c('refuser', 'Décliner poliment', [], 'Un autre candidat y va. Il en parle encore.'),
      ],
    }),
  },
  {
    tag: 'ev_selfie_rival', weight: 0.35,
    build: () => ({
      title: 'Un selfie avec votre rival',
      context: 'Un militant vous a pris en photo en train de rire aux éclats avec votre pire adversaire, à la buvette de l’Assemblée.',
      choices: [
        c('humour', 'Assumer : « On peut s’opposer et se respecter »', [s('popularity', 2), s('credibility', 1)], 'La photo devient le symbole d’une politique apaisée.'),
        c('expliquer', 'Expliquer que c’était un malentendu', [s('credibility', -1)], 'Personne n’y croit, et la photo circule encore plus.'),
      ],
    }),
  },
  {
    tag: 'ev_chien_fugue', weight: 0.35,
    build: () => ({
      title: 'Votre chien a fugué en plein meeting',
      context: 'Au milieu de votre discours, votre chien s’échappe des coulisses et file entre les rangées. La salle éclate de rire.',
      choices: [
        c('chercher', 'Interrompre le discours pour le rattraper', [s('popularity', 2), { kind: 'segment', segment: 'jeunes', delta: 1 }], 'Vous le rattrapez sous les applaudissements. C’est le seul extrait qu’on retiendra.'),
        c('continuer', 'Continuer comme si de rien n’était', [s('credibility', 1)], 'Imperturbable. Le chien, lui, a mangé le buffet.'),
      ],
    }),
  },
  {
    tag: 'ev_coiffeur', weight: 0.35, minRank: atLeastCouncil,
    build: () => ({
      title: 'La facture du coiffeur',
      context: 'Un journal révèle que votre coiffeur est payé 400 euros la séance, sur vos frais de représentation.',
      choices: [
        c('rembourser', 'Rembourser tout, de votre poche', [{ kind: 'funds', account: 'personal', delta: -4800 }, s('credibility', 2)], 'Le geste désamorce l’affaire. Votre coiffure, elle, reste impeccable.'),
        c('assumer', 'Assumer : « L’image fait partie du métier »', [s('popularity', -3), { kind: 'exposure', delta: 3 }], 'La phrase est imprimée sur des tee-shirts. Pas à votre avantage.'),
      ],
    }),
  },
  {
    tag: 'ev_ecole_fermeture', weight: 0.4, minRank: atLeastCouncil,
    build: () => ({
      title: 'Une école de village va fermer',
      context: 'L’académie annonce la fermeture de la dernière classe d’un village de votre secteur : onze élèves, une institutrice, trente ans d’histoire.',
      choices: [
        c('battre', 'Se battre pour la garder', [{ kind: 'segment', segment: 'ruraux', delta: 3 }, s('politicalCapital', -4), { kind: 'dossier', domain: 'education', delta: 2 }], 'Après trois réunions et une pétition, la classe est sauvée pour un an.'),
        c('accompagner', 'Accompagner le regroupement avec le village voisin', [s('credibility', 1), { kind: 'segment', segment: 'ruraux', delta: -2 }], 'Le car scolaire part à 7 h 10. Les parents s’en souviendront.'),
      ],
    }),
  },
  {
    tag: 'ev_faux_compte', weight: 0.4,
    build: () => ({
      title: 'Un faux compte à votre nom',
      context: 'Un compte imitant le vôtre publie des messages absurdes : il promet la semaine de trois jours et un poney par foyer.',
      choices: [
        c('plainte', 'Porter plainte et faire fermer le compte', [s('credibility', 1), s('energy', -2)], 'Le compte disparaît. Les captures d’écran, non.'),
        c('humour', 'Répondre avec humour : « Pour le poney, on en reparle »', [s('popularity', 2), { kind: 'segment', segment: 'jeunes', delta: 2 }], 'Votre réponse fait plus de vues que tous les faux messages réunis.'),
      ],
    }),
  },
  {
    tag: 'ev_tempete_toits', weight: 0.4, minRank: atLeastCouncil,
    build: () => ({
      title: 'Une tempête arrache les toits',
      context: 'Dans la nuit, une tempête a arraché les toits d’une cinquantaine de maisons de votre secteur. Les sinistrés attendent.',
      choices: [
        c('terrain', 'Aller sur place dès l’aube, bâches à la main', [s('popularity', 3), s('energy', -6), { kind: 'segment', segment: 'ruraux', delta: 2 }], 'On vous voit grimper sur une échelle avec les pompiers.'),
        c('assureurs', 'Réunir les assureurs pour accélérer les indemnisations', [s('credibility', 2), { kind: 'dossier', domain: 'territoires', delta: 2 }], 'Les chèques arrivent en trois semaines au lieu de six mois.'),
      ],
    }),
  },
  {
    tag: 'ev_invitation_mariage', weight: 0.35,
    build: () => ({
      title: 'Invité·e à un mariage',
      context: 'Un couple d’électeurs que vous avez aidé à obtenir un logement vous invite à leur mariage, samedi, dans la salle des fêtes.',
      choices: [
        c('aller', 'Y aller, et danser', [{ kind: 'segment', segment: 'populaires', delta: 2 }, s('energy', -3), s('stress', -3)], 'Vous ouvrez le bal avec la grand-mère de la mariée.'),
        c('carte', 'Envoyer une carte et un cadeau', [s('credibility', 1)], 'Une attention appréciée, mais votre chaise est restée vide.'),
      ],
    }),
  },
  {
    tag: 'ev_abstention_record', weight: 0.35,
    build: () => ({
      title: 'Une abstention record',
      context: 'À l’élection partielle de dimanche, 78 % des inscrits ne sont pas allés voter dans votre département.',
      choices: [
        c('ecouter', 'Faire une tournée d’écoute des abstentionnistes', [s('credibility', 2), s('energy', -5), { kind: 'segment', segment: 'jeunes', delta: 1 }], '« Personne ne nous avait jamais demandé pourquoi. »'),
        c('accuser', 'Accuser le gouvernement de dégoûter les électeurs', [s('credibility', -2), s('popularity', 1)], 'Facile, et chacun le sait.'),
      ],
    }),
  },
  {
    tag: 'ev_montre_cadeau', weight: 0.35, minRank: atLeastCouncil,
    build: () => ({
      title: 'Une montre de luxe en cadeau',
      context: 'Un industriel de votre région vous fait livrer une montre suisse « pour vous remercier de votre soutien ».',
      choices: [
        c('renvoyer', 'La renvoyer avec une lettre polie', [s('credibility', 2)], 'L’industriel comprend le message.'),
        c('garder', 'La garder : « C’est un cadeau entre amis »', [{ kind: 'exposure', delta: 6 }, s('stress', -2)], 'Elle est très belle. Elle pourrait coûter très cher.'),
      ],
    }),
  },
  // ── Au sommet de l'État ──
  {
    tag: 'ev_chef_cuisinier', weight: 0.5, eligible: atTop,
    build: () => ({
      title: 'Le chef des cuisines démissionne',
      context: 'Le chef des cuisines du Palais, trente ans de maison, claque la porte : « On me demande des plateaux-repas pour les chefs d’État. »',
      choices: [
        c('retenir', 'Le recevoir et lui donner carte blanche', [s('popularity', 1), { kind: 'intl', prestige: 1 }, { kind: 'funds', account: 'personal', delta: -3000 }], 'Il reste. Le prochain dîner d’État sera mémorable.'),
        c('remplacer', 'Le remplacer par une jeune cheffe étoilée', [{ kind: 'segment', segment: 'jeunes', delta: 2 }, s('credibility', 1)], 'Une cuisine audacieuse, saluée par la critique.'),
      ],
    }),
  },
  {
    tag: 'ev_drone_palais', weight: 0.45, eligible: atTop,
    build: () => ({
      title: 'Un drone au-dessus du Palais',
      context: 'Un drone non identifié a survolé vos appartements privés pendant vingt minutes cette nuit. La sécurité est sur les dents.',
      choices: [
        c('renforcer', 'Renforcer la protection aérienne', [{ kind: 'funds', account: 'campaign', delta: -2000 }, s('stress', -2)], 'Un brouilleur et deux tireurs d’élite sur le toit.'),
        c('relativiser', 'Relativiser : sans doute un curieux', [s('stress', 3), s('popularity', 1)], 'C’était un étudiant en cinéma. Son court-métrage fait le buzz.'),
      ],
    }),
  },
  {
    tag: 'ev_portrait_officiel', weight: 0.4, eligible: atTop,
    build: () => ({
      title: 'Le portrait officiel',
      context: 'Votre portrait officiel va être accroché dans toutes les mairies de France. Deux photographes proposent leur version.',
      choices: [
        c('classique', 'Le portrait classique, dans la bibliothèque', [s('credibility', 1), { kind: 'segment', segment: 'retraites', delta: 1 }], 'Solennel, sans surprise.'),
        c('moderne', 'Une photo prise sur le terrain, en mouvement', [{ kind: 'segment', segment: 'jeunes', delta: 2 }, s('popularity', 1)], 'Le portrait le plus commenté depuis des décennies.'),
      ],
    }),
  },
  {
    tag: 'ev_chien_refuge', weight: 0.35, eligible: atTop,
    build: () => ({
      title: 'Un chien pour le Palais ?',
      context: 'Une association propose que vous adoptiez un chien de refuge. Elle a déjà choisi : un vieux labrador borgne nommé Gaston.',
      choices: [
        c('adopter', 'Adopter Gaston', [s('popularity', 3), s('stress', -4)], 'Gaston a désormais plus d’abonnés que vous.'),
        c('decliner', 'Décliner gentiment', [s('popularity', -1)], 'Gaston trouve une autre famille. La France vous en veut un peu.'),
      ],
    }),
  },
  {
    tag: 'ev_garden_party', weight: 0.6, eligible: d => highOffice(d) && monthIndex(d.week) === 6,
    build: () => ({
      title: 'La garden-party du 14 Juillet',
      context: 'Huit mille invités sont attendus dans les jardins après le défilé. Certains trouvent la fête trop coûteuse en ces temps difficiles.',
      choices: [
        c('maintenir', 'Maintenir la tradition', [{ kind: 'intl', prestige: 1 }, s('popularity', -1)], 'Petits fours, fanfare et ministres sous les tilleuls.'),
        c('ouvrir', 'L’ouvrir aux héros du quotidien', [s('popularity', 3), { kind: 'segment', segment: 'populaires', delta: 2 }], 'Infirmières, pompiers et caissières à l’honneur : la photo de l’année.'),
        c('annuler', 'L’annuler par sobriété', [s('credibility', 2), { kind: 'intl', prestige: -1 }], 'Économie symbolique, saluée par les uns, moquée par les autres.'),
      ],
    }),
  },
  // ── Partout ──
  {
    tag: 'ev_poubelles_rats', weight: 0.4,
    build: () => ({
      title: 'Les poubelles débordent',
      context: 'Depuis dix jours, les poubelles s’entassent sur les trottoirs des grandes villes. Les rats sont de sortie.',
      choices: [
        c('soutenir', 'Soutenir les revendications des éboueurs', [{ kind: 'segment', segment: 'populaires', delta: 3 }, { kind: 'segment', segment: 'cadres', delta: -1 }], 'Ils obtiennent une prime de pénibilité. Les rues redeviennent propres.'),
        c('requisitionner', 'Demander des réquisitions', [s('credibility', 1), { kind: 'segment', segment: 'populaires', delta: -2 }], 'Les camions repartent, la colère reste.'),
      ],
    }),
  },
  {
    tag: 'ev_nobel_francais', weight: 0.3,
    build: () => ({
      title: 'Un prix Nobel pour une Française',
      context: 'Une chercheuse française reçoit le prix Nobel de chimie. Elle a fait toute sa carrière à l’étranger, faute de moyens en France.',
      choices: [
        c('feliciter', 'La féliciter et promettre un plan pour la recherche', [s('credibility', 2), { kind: 'dossier', domain: 'education', delta: 2 }, s('politicalCapital', -3)], 'Elle accepte de parrainer le plan. Un beau symbole.'),
        c('tweet', 'Un message de félicitations, simplement', [s('popularity', 1)], 'Elle répond poliment, en rappelant pourquoi elle est partie.'),
      ],
    }),
  },
  {
    tag: 'ev_cyclone_outremer', weight: 0.35,
    build: () => ({
      title: 'Un cyclone frappe les Antilles',
      context: 'Un cyclone de catégorie 4 ravage la Guadeloupe : toits arrachés, routes coupées, eau potable coupée.',
      choices: [
        c('partir', 'Partir sur place avec les secours', [s('popularity', 3), s('energy', -8), { kind: 'dossier', domain: 'territoires', delta: 2 }], 'Vous arrivez avec le premier avion de secours. On ne l’oubliera pas.'),
        c('pont', 'Organiser un pont aérien depuis Paris', [s('credibility', 2), { kind: 'funds', account: 'campaign', delta: -2000 }], 'Efficace, mais on regrette votre absence sur place.'),
      ],
    }),
  },
  {
    tag: 'ev_metro_inonde', weight: 0.35,
    build: () => ({
      title: 'Le métro sous les eaux',
      context: 'Un orage d’une violence inouïe inonde douze stations de métro en une heure. Les images de quais transformés en piscines font le tour du monde.',
      choices: [
        c('plan', 'Annoncer un plan d’adaptation des transports au climat', [s('credibility', 2), { kind: 'dossier', domain: 'ecologie', delta: 2 }, s('politicalCapital', -3)], 'Un plan chiffré, salué par les experts.'),
        c('terrain', 'Descendre dans les stations avec les agents', [s('popularity', 2), s('energy', -4)], 'Bottes aux pieds, au milieu des pompes : la photo parle d’elle-même.'),
      ],
    }),
  },
  {
    tag: 'ev_bac_correction', weight: 0.35,
    build: () => ({
      title: 'Les copies du bac en otage',
      context: 'Des correcteurs menacent de ne pas rendre les notes du bac pour protester contre leurs conditions de travail. Les résultats tombent dans dix jours.',
      choices: [
        c('dialogue', 'Recevoir les correcteurs et leur donner des gages', [{ kind: 'dossier', domain: 'education', delta: 2 }, { kind: 'segment', segment: 'jeunes', delta: 1 }, s('politicalCapital', -3)], 'Les notes tombent à l’heure. Les profs ont été entendus.'),
        c('fermete', 'Rappeler que les examens sont un service public', [s('credibility', 1), { kind: 'segment', segment: 'jeunes', delta: -1 }], 'Les notes arrivent avec trois jours de retard.'),
      ],
    }),
  },
  {
    tag: 'ev_eclipse', weight: 0.25,
    build: () => ({
      title: 'Une éclipse totale de Soleil',
      context: 'Une éclipse totale traverse la France pour la première fois depuis un siècle. Des millions de personnes lèvent les yeux.',
      choices: [
        c('ecole', 'La regarder avec une classe d’enfants, lunettes sur le nez', [s('popularity', 2), s('stress', -3)], 'Les enfants hurlent de joie quand le jour revient. Vous aussi, un peu.'),
        c('travail', 'Rester au travail : il y a plus urgent', [s('energy', 2)], 'Vous la verrez en photo.'),
      ],
    }),
  },
  {
    tag: 'ev_meteorite', weight: 0.25,
    build: () => ({
      title: 'Une météorite dans un champ',
      context: 'Une météorite de quarante kilos s’est écrasée dans un champ de betteraves. L’agriculteur veut la vendre ; les scientifiques veulent l’étudier.',
      choices: [
        c('musee', 'Proposer que l’État l’achète pour le Muséum', [s('popularity', 1), s('credibility', 1), { kind: 'funds', account: 'campaign', delta: -1500 }], 'Elle rejoindra les collections nationales. L’agriculteur est ravi.'),
        c('marche', 'Laisser l’agriculteur la vendre', [{ kind: 'segment', segment: 'ruraux', delta: 1 }], 'Un collectionneur étranger l’achète. Les scientifiques fulminent.'),
      ],
    }),
  },
  {
    tag: 'ev_ministre_danse', weight: 0.35, eligible: d => d.player.rankId === 'president' || d.player.rankId === 'premier_ministre',
    build: () => ({
      title: 'Un ministre danse sur les réseaux',
      context: 'Un de vos ministres publie une vidéo où il danse en costume dans son bureau. Elle cumule dix millions de vues… et autant de moqueries.',
      choices: [
        c('rire', 'En rire publiquement', [s('popularity', 1), { kind: 'segment', segment: 'jeunes', delta: 2 }], 'La séquence humanise le gouvernement.'),
        c('recadrer', 'Le recadrer en Conseil des ministres', [s('credibility', 1)], 'La vidéo disparaît. Les mèmes, eux, restent.'),
      ],
    }),
  },
  {
    tag: 'ev_degat_eaux_palais', weight: 0.35, eligible: atTop,
    build: () => ({
      title: 'Dégât des eaux au Palais',
      context: 'Une canalisation a cédé au-dessus du salon des ambassadeurs. Une tapisserie du XVIIIᵉ siècle est trempée, et un dîner d’État a lieu dans trois jours.',
      choices: [
        c('deplacer', 'Déplacer le dîner dans les jardins, sous une tente', [{ kind: 'intl', prestige: 1 }, s('stress', 2)], 'Un dîner aux chandelles sous les arbres : les invités sont enchantés.'),
        c('restaurer', 'Tout faire restaurer en urgence', [{ kind: 'funds', account: 'campaign', delta: -3000 }, s('credibility', -1)], 'La facture fuite dans la presse. Elle aussi.'),
      ],
    }),
  },
  {
    tag: 'ev_musee_sature', weight: 0.3,
    build: () => ({
      title: 'Le musée ferme : trop de monde',
      context: 'Le plus grand musée du pays ferme ses portes deux heures : trop de visiteurs, des gardiens débordés, une bousculade devant un tableau célèbre.',
      choices: [
        c('reservation', 'Imposer la réservation et des créneaux', [s('credibility', 1), { kind: 'segment', segment: 'cadres', delta: 1 }], 'Plus calme, plus organisé… et un peu moins spontané.'),
        c('gratuit', 'Ouvrir en nocturne gratuite chaque mois', [s('popularity', 2), { kind: 'segment', segment: 'jeunes', delta: 2 }], 'Les nocturnes font salle comble.'),
      ],
    }),
  },
  {
    tag: 'ev_festival_annule', weight: 0.3, minRank: atLeastCouncil,
    build: () => ({
      title: 'Un festival menacé d’annulation',
      context: 'Le festival de théâtre de rue d’une petite ville annonce son annulation : la subvention régionale a été supprimée.',
      choices: [
        c('sauver', 'Trouver les fonds pour le sauver', [s('popularity', 1), { kind: 'segment', segment: 'jeunes', delta: 1 }, s('politicalCapital', -3)], 'Le festival aura lieu. Une compagnie joue en votre honneur.'),
        c('mecenes', 'Appeler les entreprises locales au mécénat', [s('credibility', 1)], 'Trois PME répondent : le festival est sauvé, en version réduite.'),
      ],
    }),
  },
  {
    tag: 'ev_boulangerie_derniere', weight: 0.35,
    build: () => ({
      title: 'La dernière boulangerie du canton ferme',
      context: 'Dans un canton rural, la dernière boulangerie baisse le rideau : le boulanger part à la retraite, personne ne reprend. Les habitants lancent une pétition.',
      choices: [
        c('aider', 'Proposer une aide à l’installation d’un jeune boulanger', [{ kind: 'segment', segment: 'ruraux', delta: 2 }, s('politicalCapital', -2), { kind: 'dossier', domain: 'territoires', delta: 2 }], 'Une jeune boulangère reprend le fournil au printemps.'),
        c('depot', 'Suggérer un dépôt de pain au bar-tabac', [{ kind: 'segment', segment: 'ruraux', delta: -1 }], 'Le pain arrive en camionnette. Ce n’est plus pareil.'),
      ],
    }),
  },
  {
    tag: 'ev_record_froid', weight: 0.3,
    build: () => ({
      title: 'Vague de froid record',
      context: 'Moins vingt dans l’Est, des sans-abri en danger, des réseaux électriques à la limite. Les associations appellent à l’aide.',
      choices: [
        c('gymnases', 'Ouvrir les gymnases et les bâtiments publics la nuit', [s('popularity', 2), { kind: 'dossier', domain: 'social', delta: 2 }, s('politicalCapital', -2)], 'Des milliers de lits de camp dans les gymnases : personne ne dort dehors.'),
        c('sobriete', 'Appeler à la sobriété électrique', [s('credibility', 1), { kind: 'segment', segment: 'retraites', delta: -1 }], 'Le réseau tient. Les appartements, eux, sont glacés.'),
      ],
    }),
  },
  {
    tag: 'ev_chanteur_hommage', weight: 0.25,
    build: () => ({
      title: 'Un géant de la chanson s’éteint',
      context: 'Le chanteur le plus populaire de sa génération est mort. Des milliers de fans se rassemblent spontanément devant sa maison.',
      choices: [
        c('hommage', 'Proposer un hommage national', [s('popularity', 2), { kind: 'segment', segment: 'retraites', delta: 2 }], 'Une foule immense chante ses refrains sous la pluie.'),
        c('sobre', 'Un communiqué sobre, et du respect', [s('credibility', 1)], 'Un texte juste, salué pour sa retenue.'),
      ],
    }),
  },
  {
    tag: 'ev_vol_musee', weight: 0.25,
    build: () => ({
      title: 'Cambriolage dans un grand musée',
      context: 'Des voleurs ont dérobé en sept minutes des bijoux historiques dans un grand musée parisien. Le monde entier se moque de la sécurité française.',
      choices: [
        c('audit', 'Exiger un audit de la sécurité de tous les musées', [s('credibility', 2), { kind: 'dossier', domain: 'securite', delta: 2 }], 'L’audit révèle des caméras en panne depuis des années.'),
        c('enquete', 'Faire confiance aux enquêteurs, sans commentaire', [s('credibility', -1)], 'Le silence est interprété comme de l’embarras.'),
      ],
    }),
  },
  {
    tag: 'ev_greve_controleurs', weight: 0.3,
    build: () => ({
      title: 'Grève des contrôleurs aériens',
      context: 'Les contrôleurs aériens cessent le travail en plein départ en vacances : deux mille vols annulés, des familles bloquées dans les aéroports.',
      choices: [
        c('service', 'Proposer une loi de service minimum', [s('credibility', 1), { kind: 'segment', segment: 'cadres', delta: 2 }, { kind: 'segment', segment: 'populaires', delta: -1 }], 'Le texte est déposé : les syndicats hurlent, les voyageurs applaudissent.'),
        c('negocier', 'Envoyer un médiateur cette nuit', [s('popularity', 1), s('politicalCapital', -2)], 'Accord à l’aube : les avions redécollent.'),
      ],
    }),
  },
  {
    tag: 'ev_eleve_genie', weight: 0.25, minRank: atLeastCouncil,
    build: () => ({
      title: 'Une lycéenne de génie',
      context: 'Une lycéenne d’une cité de banlieue remporte l’olympiade internationale de mathématiques. Sa photo, médaille au cou, fait le tour des réseaux.',
      choices: [
        c('recevoir', 'La recevoir avec sa classe et ses professeurs', [s('popularity', 1), { kind: 'segment', segment: 'jeunes', delta: 2 }, { kind: 'dossier', domain: 'education', delta: 1 }], 'Elle parle de ses profs avec une telle fierté que la salle se lève.'),
        c('tweet', 'La féliciter d’un message', [s('popularity', 1)], 'Un message parmi des milliers.'),
      ],
    }),
  },
  {
    tag: 'ev_penurie_moutarde', weight: 0.25,
    build: () => ({
      title: 'Plus de moutarde dans les rayons',
      context: 'Une sécheresse au Canada a ruiné la récolte de graines : les rayons de moutarde sont vides, et le pays s’en émeut bien plus que prévu.',
      choices: [
        c('filiere', 'Relancer la culture de la graine de moutarde en Bourgogne', [{ kind: 'segment', segment: 'ruraux', delta: 2 }, s('credibility', 1)], 'Les champs jaunes refleurissent en Bourgogne.'),
        c('humour', 'En plaisanter à la télévision', [s('popularity', 1), s('credibility', -1)], 'La blague fonctionne… jusqu’à la rupture de stock suivante.'),
      ],
    }),
  },
  {
    tag: 'ev_sommet_climat', weight: 0.3, eligible: atTop,
    build: () => ({
      title: 'Le sommet du climat bloque',
      context: 'À la conférence mondiale sur le climat, les négociations sont dans l’impasse à minuit. Votre délégation peut débloquer la situation… en cédant sur un point.',
      choices: [
        c('ceder', 'Céder pour sauver l’accord', [{ kind: 'intl', prestige: 2 }, { kind: 'dossier', domain: 'ecologie', delta: 3 }, s('politicalCapital', -4)], 'Un accord à l’aube : vous êtes cité dans tous les journaux du monde.'),
        c('tenir', 'Tenir bon : pas d’accord au rabais', [s('credibility', 1), { kind: 'intl', prestige: -1 }], 'Pas d’accord. Les ONG vous accusent d’avoir tout fait capoter.'),
      ],
    }),
  },
  {
    tag: 'ev_pont_fete', weight: 0.25,
    build: () => ({
      title: 'Un pont de mai qui fâche',
      context: 'Avec deux jours fériés un jeudi, le pays s’apprête à « faire le pont ». Les patrons s’inquiètent pour la productivité, les salariés pour leurs vacances.',
      choices: [
        c('profiter', 'Souhaiter à tous un bon week-end prolongé', [s('popularity', 1), { kind: 'segment', segment: 'populaires', delta: 1 }], 'Les routes sont bondées, les terrasses aussi.'),
        c('travailler', 'Rappeler que le pays a besoin de travailler', [s('credibility', 1), { kind: 'segment', segment: 'cadres', delta: 1 }, { kind: 'segment', segment: 'populaires', delta: -1 }], 'La phrase est mal reçue un jeudi de pont.'),
      ],
    }),
  },
  {
    tag: 'ev_robot_chirurgien', weight: 0.25,
    build: () => ({
      title: 'Un robot opère seul',
      context: 'Un hôpital universitaire annonce la première opération entièrement réalisée par un robot, sans chirurgien aux commandes. Le patient va bien.',
      choices: [
        c('saluer', 'Saluer une prouesse française', [{ kind: 'dossier', domain: 'sante', delta: 2 }, { kind: 'segment', segment: 'cadres', delta: 1 }], 'Les chercheurs sont reçus en héros.'),
        c('encadrer', 'Demander un cadre éthique avant d’aller plus loin', [s('credibility', 2)], 'Le comité d’éthique est saisi. Les soignants approuvent.'),
      ],
    }),
  },
  {
    tag: 'ev_profs_rythmes', weight: 0.3,
    build: () => ({
      title: 'Les profs dans la rue',
      context: 'Un professeur sur deux est en grève contre la réforme des rythmes scolaires. Les parents cherchent des solutions de garde.',
      choices: [
        c('ecouter', 'Recevoir les syndicats enseignants', [{ kind: 'dossier', domain: 'education', delta: 2 }, s('politicalCapital', -2), { kind: 'segment', segment: 'jeunes', delta: 1 }], 'Deux heures de discussion franche, et un calendrier revu.'),
        c('maintenir', 'Maintenir la réforme', [s('credibility', 1), { kind: 'segment', segment: 'jeunes', delta: -1 }], 'La grève reconductible est votée.'),
      ],
    }),
  },
  {
    tag: 'ev_record_loto', weight: 0.25,
    build: () => ({
      title: 'Un village gagne au loto',
      context: 'Les habitants d’un village de 300 âmes, qui jouaient ensemble depuis vingt ans, remportent la cagnotte record. Ils veulent rénover l’école et l’église.',
      choices: [
        c('feliciter', 'Aller les féliciter sur place', [s('popularity', 2), { kind: 'segment', segment: 'ruraux', delta: 2 }, s('energy', -3)], 'Un vin d’honneur mémorable sur la place du village.'),
        c('message', 'Un message chaleureux', [s('popularity', 1)], 'Le maire lit votre message devant la mairie.'),
      ],
    }),
  },
  {
    tag: 'ev_cyber_mairie', weight: 0.3, minRank: atLeastCouncil,
    build: () => ({
      title: 'Une mairie prise en otage',
      context: 'Des pirates ont chiffré tous les fichiers d’une grande mairie : état civil, paie, écoles. Ils réclament une rançon en cryptomonnaie.',
      choices: [
        c('refuser', 'Refuser de payer et tout reconstruire', [s('credibility', 2), { kind: 'dossier', domain: 'numerique', delta: 2 }, s('stress', 2)], 'Trois semaines de papier et de crayons, mais pas un euro aux pirates.'),
        c('negocier', 'Laisser la mairie négocier discrètement', [s('credibility', -1)], 'Les fichiers reviennent. La rumeur du paiement aussi.'),
      ],
    }),
  },
  {
    tag: 'ev_vague_chaleur_ecoles', weight: 0.3,
    build: () => ({
      title: '38 °C dans les classes',
      context: 'En pleine vague de chaleur de juin, les salles de classe dépassent 38 °C. Des parents gardent leurs enfants à la maison.',
      choices: [
        c('plan', 'Lancer un plan de rénovation thermique des écoles', [{ kind: 'dossier', domain: 'education', delta: 2 }, { kind: 'dossier', domain: 'ecologie', delta: 2 }, s('politicalCapital', -3)], 'Dix mille écoles rénovées en cinq ans : le plan est salué.'),
        c('horaires', 'Autoriser les écoles à finir à midi', [s('popularity', 1)], 'Les enfants rentrent plus tôt. Les parents, eux, jonglent.'),
      ],
    }),
  },
  {
    tag: 'ev_ambassadeur_gaffe', weight: 0.3, eligible: atTop,
    build: () => ({
      title: 'La gaffe de l’ambassadeur',
      context: 'Notre ambassadeur dans un pays allié a été enregistré en train de se moquer de ses dirigeants. L’enregistrement est partout.',
      choices: [
        c('rappeler', 'Le rappeler à Paris sur-le-champ', [{ kind: 'intl', prestige: 1 }, s('credibility', 1)], 'L’incident est clos en quarante-huit heures.'),
        c('soutenir', 'Le soutenir : c’était une conversation privée', [{ kind: 'intl', prestige: -2 }], 'Le pays allié convoque notre chargé d’affaires.'),
      ],
    }),
  },
  {
    tag: 'ev_tempete_vignes', weight: 0.3,
    build: () => ({
      title: 'La grêle ravage les vignes',
      context: 'Un orage de grêle a détruit en vingt minutes 80 % des vignes d’une appellation célèbre. Les vignerons parlent d’une année perdue.',
      choices: [
        c('calamite', 'Déclarer l’état de calamité agricole', [{ kind: 'segment', segment: 'ruraux', delta: 2 }, s('politicalCapital', -2)], 'Les indemnisations sont débloquées en dix jours.'),
        c('assurance', 'Rappeler l’importance de s’assurer', [s('credibility', 1), { kind: 'segment', segment: 'ruraux', delta: -2 }], 'Les vignerons non assurés ne l’oublieront pas.'),
      ],
    }),
  },
  {
    tag: 'ev_recomptage', weight: 0.3, minRank: atLeastCouncil,
    build: () => ({
      title: 'Recomptage dans un bureau de vote',
      context: 'Une élection municipale partielle se joue à trois voix. Le tribunal administratif ordonne un recomptage, et on vous demande d’y assister.',
      choices: [
        { ...c('compter', 'Compter vous-même, bulletin par bulletin', [s('credibility', 2), { kind: 'cohesion', delta: 1 }], 'Le procès-verbal porte votre signature.'), play: 'depouillement' },
        c('observer', 'Observer de loin, sans s’en mêler', [s('credibility', 1)], 'Le recomptage confirme le résultat. On ne vous a pas vu.'),
      ],
    }),
  },
  {
    tag: 'ev_promesse_chiffree', weight: 0.35,
    build: () => ({
      title: '« Combien ça coûte ? »',
      context: 'En direct, un journaliste vous demande de chiffrer votre dernière proposition. Votre conseiller économique est coincé dans un taxi.',
      choices: [
        { ...c('chiffrer', 'Chiffrer de tête, en direct', [s('credibility', 3), { kind: 'dossier', domain: 'economie', delta: 1 }], 'Les chiffres tombent, nets et précis.'), play: 'chiffrage' },
        c('renvoyer', 'Promettre un chiffrage détaillé demain', [s('credibility', -1)], '« Il ne sait pas », titre un site d’info.'),
      ],
    }),
  },
  {
    tag: 'ev_greve_routiers', weight: 0.3,
    build: () => ({
      title: 'Les routiers bloquent les dépôts',
      context: 'Les chauffeurs routiers bloquent les dépôts pétroliers contre la hausse du gazole. Les stations-service commencent à manquer de carburant.',
      choices: [
        { ...c('negocier', 'Recevoir les fédérations et négocier', [s('popularity', 1), { kind: 'segment', segment: 'populaires', delta: 1 }, s('politicalCapital', -2)], 'Une baisse temporaire des taxes, et les camions repartent.'), play: 'negociation_syndicale' },
        c('requisitionner', 'Faire lever les blocages par les forces de l’ordre', [s('credibility', 1), { kind: 'segment', segment: 'populaires', delta: -2 }], 'Les dépôts sont dégagés à l’aube. La colère, elle, reste.'),
      ],
    }),
  },
  {
    tag: 'ev_chat_viral', weight: 0.25,
    build: () => ({
      title: 'Un chat star des réseaux',
      context: 'Un chat roux s’est faufilé dans votre réunion publique et s’est endormi sur le pupitre. La photo a fait le tour d’Internet.',
      choices: [
        c('adopter', 'L’adopter : il a choisi son camp', [s('popularity', 2), { kind: 'segment', segment: 'jeunes', delta: 2 }], 'Il a désormais son propre compte. Plus suivi que le vôtre.'),
        c('proprietaire', 'Retrouver sa propriétaire', [s('popularity', 1)], 'Elle s’appelle Josiane, et elle votera pour vous.'),
      ],
    }),
  },
  {
    tag: 'ev_eboulement_route', weight: 0.25,
    build: () => ({
      title: 'Un éboulement coupe une vallée',
      context: 'Un pan de montagne s’est effondré sur la seule route d’une vallée des Pyrénées. Deux mille habitants sont isolés.',
      choices: [
        c('helico', 'Organiser un pont par hélicoptère', [s('popularity', 2), s('politicalCapital', -2), { kind: 'segment', segment: 'ruraux', delta: 2 }], 'Médecins, courses, écoliers : les rotations s’enchaînent.'),
        c('travaux', 'Accélérer les travaux de déblaiement', [{ kind: 'dossier', domain: 'territoires', delta: 2 }], 'La route rouvre en trois semaines, sur une voie.'),
      ],
    }),
  },
  {
    tag: 'ev_hopital_rouvre', weight: 0.25, minRank: atLeastCouncil,
    build: () => ({
      title: 'Des urgences fermées la nuit',
      context: 'Faute de médecins, les urgences d’un hôpital de sous-préfecture fermeront la nuit à partir du mois prochain. Une pétition réunit vingt mille signatures.',
      choices: [
        c('medecins', 'Faire venir des médecins volontaires de toute la région', [{ kind: 'dossier', domain: 'sante', delta: 3 }, s('politicalCapital', -3)], 'Les urgences restent ouvertes. Fragiles, mais ouvertes.'),
        c('regulation', 'Accepter, avec une régulation par le 15', [s('credibility', 1), { kind: 'segment', segment: 'ruraux', delta: -2 }], 'La nuit, il faut désormais appeler avant de venir.'),
      ],
    }),
  },
  {
    tag: 'ev_jo_jeunesse', weight: 0.25,
    build: () => ({
      title: 'Le champion du monde du village',
      context: 'Un jeune de dix-neuf ans, issu d’un village de mille habitants, devient champion du monde de canoë. Le village entier l’attend à la gare.',
      choices: [
        c('gare', 'Être à la gare pour l’accueillir', [s('popularity', 2), s('energy', -3), { kind: 'segment', segment: 'jeunes', delta: 1 }], 'Fanfare, banderoles, et un champion ému aux larmes.'),
        c('message', 'Un message de félicitations', [s('popularity', 1)], 'Il le lit à voix haute devant la foule.'),
      ],
    }),
  },
  {
    tag: 'ev_sommet_ue_nuit', weight: 0.3, eligible: atTop,
    build: () => ({
      title: 'Le budget européen se joue cette nuit',
      context: 'À Bruxelles, la négociation sur le budget européen dure depuis trente heures. Les agriculteurs français jouent gros.',
      choices: [
        { ...c('negocier', 'Négocier vous-même jusqu’au bout de la nuit', [{ kind: 'intl', prestige: 2 }, { kind: 'segment', segment: 'ruraux', delta: 2 }, s('energy', -5)], 'À l’aube, la politique agricole est sauvée.'), play: 'sommet_ue' },
        c('compromis', 'Accepter le compromis sur la table', [s('credibility', 1)], 'Un accord moyen. Personne n’est content, personne n’est furieux.'),
      ],
    }),
  },
  {
    tag: 'ev_lettre_ouverte', weight: 0.5, minRank: atLeastCouncil,
    build: () => ({
      title: 'Une lettre ouverte de cent maires',
      context: 'Cent maires ruraux vous adressent une lettre ouverte : écoles qui ferment, médecins qui partent, bureaux de poste supprimés.',
      choices: [
        c('repondre', 'Leur répondre un par un, et les recevoir', [{ kind: 'segment', segment: 'ruraux', delta: 3 }, s('energy', -5), { kind: 'dossier', domain: 'territoires', delta: 2 }], 'Cent lettres signées à la main. Ils s’en souviendront.'),
        c('tribune', 'Répondre par une tribune collective', [s('credibility', 1), { kind: 'segment', segment: 'ruraux', delta: 1 }], 'Une réponse générale, polie, un peu lointaine.'),
      ],
    }),
  },
  {
    tag: 'ev_robot_mairie', weight: 0.4,
    build: () => ({
      title: 'Un robot à l’accueil de la mairie',
      context: 'Une start-up propose un robot d’accueil pour la mairie : il répond 24 h sur 24 dans douze langues. Les agents d’accueil s’inquiètent.',
      choices: [
        c('tester', 'Le tester six mois', [{ kind: 'dossier', domain: 'numerique', delta: 3 }, { kind: 'segment', segment: 'jeunes', delta: 1 }, { kind: 'segment', segment: 'retraites', delta: -1 }], 'Il s’appelle « Marianne 2.0 ». Les enfants l’adorent, les anciens l’évitent.'),
        c('humains', 'Garder des humains à l’accueil', [{ kind: 'segment', segment: 'retraites', delta: 2 }, s('popularity', 1)], '« Un sourire ne se programme pas. » Applaudissements.'),
      ],
    }),
  },
  {
    tag: 'ev_tournoi_boules', weight: 0.5,
    build: () => ({
      title: 'Le tournoi de pétanque des élus',
      context: 'Le club de pétanque organise son tournoi annuel « élus contre habitants ». Votre adversaire en finale : le doyen du club, 87 ans.',
      choices: [
        c('gagner', 'Jouer pour gagner', [s('popularity', -1), s('stress', -2)], 'Vous gagnez. Le doyen vous serre la main ; la salle, elle, boude un peu.'),
        c('perdre', 'Le laisser gagner, discrètement', [s('popularity', 2), { kind: 'segment', segment: 'retraites', delta: 2 }], 'Il brandit la coupe sous les vivats. Vous offrez la tournée.'),
      ],
    }),
  },
  {
    tag: 'ev_neige_route', weight: 1.5, eligible: d => [0, 1, 11].includes(monthIndex(d.week)),
    build: () => ({
      title: 'Bloqué·e par la neige',
      context: 'Une tempête de neige bloque l’autoroute. Des centaines d’automobilistes passent la nuit dans leur voiture, dont vous.',
      choices: [
        c('aider', 'Distribuer couvertures et café avec les secours', [s('popularity', 3), s('energy', -6), { kind: 'segment', segment: 'populaires', delta: 1 }], 'Au petit matin, une photo de vous, bonnet sur la tête, thermos à la main.'),
        c('attendre', 'Attendre dans la voiture en travaillant vos dossiers', [{ kind: 'dossier', domain: 'territoires', delta: 2 }, s('stress', 2)], 'Une nuit productive, mais personne ne l’a vue.'),
      ],
    }),
  },
  {
    tag: 'ev_record_abonnes', weight: 0.4, eligible: d => (d.phone?.audience?.followers ?? 0) > 5000,
    build: () => ({
      title: 'Un youtubeur veut vous suivre une journée',
      context: 'Un vidéaste aux deux millions d’abonnés propose de vous suivre toute une journée, caméra au poing, sans coupe.',
      choices: [
        c('oui', 'Accepter, sans filtre', [s('popularity', 2), { kind: 'segment', segment: 'jeunes', delta: 4 }, { kind: 'exposure', delta: 1 }], 'La vidéo cumule quatre millions de vues. On y voit votre fou rire en réunion.'),
        c('non', 'Décliner', [], 'Il suivra votre rival à la place.'),
      ],
    }),
  },
  {
    tag: 'ev_appel_inconnu', weight: 0.5,
    build: () => ({
      title: 'Un ancien camarade de promotion',
      context: 'Un ancien camarade de fac, devenu grand patron, vous invite à dîner « en souvenir du bon vieux temps ». Il a sûrement une idée derrière la tête.',
      choices: [
        c('diner', 'Accepter le dîner', [s('influence', 2), { kind: 'segment', segment: 'cadres', delta: 1 }, { kind: 'exposure', delta: 1 }], 'Il voulait juste un conseil… et votre numéro direct.'),
        c('decliner', 'Décliner poliment', [s('credibility', 1)], 'Il insistera. Plus tard.'),
      ],
    }),
  },
  {
    tag: 'ev_greve_eboueurs', weight: 0.6, minRank: atLeastCouncil,
    build: () => ({
      title: 'Grève des éboueurs',
      context: 'Les poubelles s’entassent depuis dix jours. Les rats sortent en plein jour ; les touristes photographient.',
      choices: [
        c('negocier', 'Négocier une prime de pénibilité', [{ kind: 'segment', segment: 'populaires', delta: 2 }, s('politicalCapital', -4), s('popularity', 1)], 'Les camions repartent le lendemain matin.'),
        c('requisition', 'Réquisitionner une entreprise privée', [{ kind: 'segment', segment: 'cadres', delta: 1 }, { kind: 'segment', segment: 'populaires', delta: -2 }], 'Les rues sont propres. Les syndicats, eux, s’en souviendront.'),
      ],
    }),
  },
  {
    tag: 'ev_jumeaux', weight: 0.4,
    build: () => ({
      title: 'Des jumeaux portent votre prénom',
      context: 'Une famille de votre circonscription a appelé ses jumeaux comme vous, « en remerciement » pour une crèche que vous avez sauvée.',
      choices: [
        c('visite', 'Leur rendre visite avec un cadeau', [s('popularity', 2), s('stress', -3)], 'Deux bébés, un doudou chacun, et une photo qui fait le tour du canton.'),
        c('lettre', 'Envoyer une lettre émue', [s('popularity', 1)], 'La lettre est encadrée au-dessus des berceaux.'),
      ],
    }),
  },
  {
    tag: 'ev_debat_ia', weight: 0.5, minRank: atLeastCouncil,
    build: () => ({
      title: 'Vos discours écrits par une IA ?',
      context: 'Un journaliste affirme qu’un de vos discours a été rédigé par une intelligence artificielle. Il a un logiciel de détection.',
      choices: [
        c('nier', 'Démentir : « Je les écris moi-même »', [s('credibility', 1), s('stress', 2)], 'Vous publiez vos brouillons raturés. Le doute s’éteint.'),
        c('assumer', 'Assumer : « C’est un outil, comme un stylo »', [{ kind: 'segment', segment: 'jeunes', delta: 2 }, { kind: 'segment', segment: 'retraites', delta: -2 }, s('credibility', -1)], 'Le débat sur l’IA en politique est lancé, et vous êtes au centre.'),
      ],
    }),
  },
  {
    tag: 'ev_fete_quartier', weight: 0.6, eligible: d => [5, 6, 7].includes(monthIndex(d.week)),
    build: () => ({
      title: 'La fête des voisins',
      context: 'Tables dans la cour, merguez et salades : la fête des voisins de votre immeuble vous attend ce soir.',
      choices: [
        c('venir', 'Venir avec un gâteau maison', [s('popularity', 1), s('stress', -4), s('energy', 2)], 'Votre fondant au chocolat est jugé « honnête ». On vous parle enfin d’autre chose que de politique.'),
        c('travail', 'Rester travailler', [{ kind: 'dossier', domain: 'economie', delta: 1 }], 'Les rires montent jusqu’à votre fenêtre.'),
      ],
    }),
  },
  {
    tag: 'ev_lettre_detenu', weight: 0.4, minRank: atLeastCouncil,
    build: () => ({
      title: 'La lettre d’un détenu',
      context: 'Un détenu vous écrit : il a passé un diplôme en prison et cherche un employeur pour sa libération conditionnelle.',
      choices: [
        c('aider', 'L’aider à trouver un emploi', [{ kind: 'dossier', domain: 'justice', delta: 3 }, s('credibility', 1), { kind: 'segment', segment: 'retraites', delta: -1 }], 'Une entreprise de BTP l’embauche. Il vous écrit encore, un an plus tard, pour dire merci.'),
        c('transmettre', 'Transmettre à une association', [{ kind: 'dossier', domain: 'justice', delta: 1 }], 'L’association prend le relais.'),
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

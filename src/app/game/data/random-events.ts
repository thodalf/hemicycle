import { Decision, DecisionChoice, Domain, Effect, GameState, RankId } from '../models/game.models';
import type { Rng } from '../engine/rng';
import { rankOrder } from './ranks';
import { netWorth, owns, wealthImage } from '../engine/patrimoine';
import { ASSETS_BY_ID } from './assets';
import { OUTLETS } from './press';
import { ofParty } from './world';
import { effectValue, withCounterweight } from './actions';
import { LIFE_EVENTS } from './life-events';
import { EXTRA_EVENTS } from './extra-events';
import { CAMPAIGN_EVENTS, MORE_EVENTS, inPresidentialRace } from './campaign-events';
import { ZOMBIE_EVENTS, ZOMBIE_GATE } from './zombie-events';
import { APOC_EVENTS, APOC_GATE, DEVIL_DUE } from './apocalypse-events';
import { canStartArc } from '../engine/arcs';
import { CRISIS_EVENTS, CRISIS_GATES, FAMILY_EVENTS, MISC_ARC_EVENTS } from './life-arc-events';
import { PHONE_EVENTS } from './phone-events';
import { CALENDAR_EVENTS, COUNTRY_EVENTS, PHRASE_EVENT } from './country-events';
import { REVOLUTION_EVENTS } from './royal-events';
import { ALIEN_EVENTS, ALIEN_GATE } from './alien-events';
import { HOSTILE_EVENTS, INVASION_EVENT, PEACE_EVENTS, WAR_EVENTS } from './war-events';
import { RANK_EVENTS } from './rank-events';
import { INTL_EVENTS } from './intl-events';
import { intlRelevant } from '../engine/intl';

/* ============================================================
 *  Événements aléatoires : vie privée, médias, coulisses,
 *  imprévus. Les uns demandent une décision, les autres
 *  tombent simplement dans le fil d'actualité.
 * ============================================================ */

export interface RandomEvent {
  tag: string;
  minRank?: RankId;
  /** Poids relatif dans le tirage */
  weight: number;
  /** Condition supplémentaire d'apparition */
  eligible?: (d: GameState) => boolean;
  build: (d: GameState, rng: Rng) => { title: string; context: string; choices: EvChoice[]; domain?: Domain };
}

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat, delta });

/** Choix d'événement : peut exiger de l'argent ou un rang, filtré au tirage */
export type EvChoice = DecisionChoice & { needMoney?: number; needRank?: RankId };

const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice =>
  ({ id, label, effects, outcome, ...extra });


/* ── Portes d'entrée : Couronne et Loge dans une partie normale ─────
 * Ces événements ont leur propre tirage (4 % par mois chacun) :
 * c'est le seul moyen de débloquer les onglets hors scénario. */
const GATEWAY_EVENTS: RandomEvent[] = [
  {
    tag: 'offre_chronique', weight: 2,
    eligible: d => !d.press && !d.player.flags['closed_press'],
    build: d => ({
      title: 'Les médias vous font la cour',
      context: `Votre sens de la formule a été remarqué. Trois rédactions proposent à ${d.player.name} une chronique régulière, payée.`,
      choices: [
        c('tv', `Une chronique sur ${OUTLETS.tv.name}`, [{ kind: 'joinPress', outlet: 'tv' }], 'Plateau, maquillage, oreillette : vous voilà chroniqueur·se télé.'),
        c('radio', `Une chronique dans la matinale de ${OUTLETS.radio.name}`, [{ kind: 'joinPress', outlet: 'radio' }], 'Réveil à 5 h, micro à 7 h 50.'),
        c('presse', `Une tribune hebdomadaire au ${OUTLETS.presse.name.replace(/^Le /, '')}`, [{ kind: 'joinPress', outlet: 'presse' }], 'Votre première colonne paraît samedi.'),
        c('non', 'Décliner : un élu n’est pas un commentateur', [s('credibility', 1)], 'Les rédactions prennent note.'),
      ],
    }),
  },
  {
    tag: 'offre_journal', weight: 1,
    eligible: d => !d.press && !d.player.flags['closed_press'],
    build: () => ({
      title: 'Un quotidien cherche une plume',
      context: `La directrice du ${OUTLETS.presse.name.replace(/^Le /, '')} vous invite à déjeuner : « Vous écrivez bien. Et si vous écriviez pour nous ? »`,
      choices: [
        c('accepter', 'Accepter une rubrique', [{ kind: 'joinPress', outlet: 'presse' }, { kind: 'press', reputation: 5 }], 'Vous voilà dans l’ours du journal.'),
        c('refuser', 'Refuser poliment', [], 'Elle vous laisse sa carte.'),
      ],
    }),
  },
  {
    tag: 'emissaire_royaliste', weight: 2,
    eligible: d => !d.crown && !d.player.flags['closed_crown'],
    build: d => ({
      title: 'Un émissaire du prétendant',
      context: 'Un homme en loden vous attend à la sortie de votre permanence. Le prince Louis-Amaury de Valmont cherche « une voix politique » pour porter la cause de la Couronne. Il a lu vos discours.',
      choices: [
        c('rallier', 'Prendre la tête du cercle royaliste', [
          { kind: 'joinCrown' }, { kind: 'stance', delta: 6 }, { kind: 'cohesion', delta: -4 },
          { kind: 'faction', factionId: 'moderes', delta: -4 }, { kind: 'exposure', delta: 4 },
        ], 'Vous voici l’espoir des monarchistes. Votre parti tousse.'),
        c('coulisses', 'Soutenir la cause en coulisses (1 500 €)', [
          { kind: 'joinCrown' }, { kind: 'crown', soutien: -2, legitimite: 3 }, { kind: 'funds', account: 'personal', delta: -1500 },
          { kind: 'exposure', delta: 2 },
        ], 'Discrètement, vous financez le cercle. Le prince vous en sait gré.', { needMoney: 1500 }),
        c('decliner', 'Décliner poliment', [s('credibility', 1)], 'L’émissaire range sa carte de visite. « Le prince sait attendre. »'),
        c('denoncer', `Dénoncer publiquement une manœuvre contre la République`, [s('popularity', 2), { kind: 'stance', delta: -2 }, { kind: 'faction', factionId: 'moderes', delta: 2 }],
          `${d.player.name} défend la République : un tweet très partagé.`),
      ],
    }),
  },
  {
    tag: 'bal_legitimiste', weight: 1, minRank: 'conseiller_municipal',
    eligible: d => !d.crown && !d.player.flags['closed_crown'],
    build: () => ({
      title: 'Invitation au bal du château de Montfaucon',
      context: 'Carton gravé, dress code « tenue de soirée, décorations ». Toute la noblesse légitimiste sera là… et le prétendant compte vous parler entre deux valses.',
      choices: [
        c('valse', 'Y aller et écouter la proposition du prince', [
          { kind: 'joinCrown' }, { kind: 'crown', legitimite: 5 }, { kind: 'stance', delta: 5 },
          s('popularity', -1), { kind: 'exposure', delta: 3 },
        ], 'Au petit matin, vous voilà conseiller·e officieux·se du prince.'),
        c('photo', 'Faire une apparition, serrer des mains, repartir', [s('influence', 2), { kind: 'exposure', delta: 3 }], 'Quelques contacts utiles, une photo un peu gênante.'),
        c('refuser', 'Refuser l’invitation', [], 'Le carton finit dans un tiroir.'),
      ],
    }),
  },
  {
    tag: 'parrain_loge', weight: 2,
    eligible: d => !d.lodge && !d.player.flags['closed_lodge'],
    build: (d, rng) => {
      const npc = rng.pick(d.npcs.filter(n => n.relationToPlayer > 0 && !n.isRival));
      const who = npc?.name ?? 'un ancien bâtonnier que vous estimez';
      return {
        title: 'Une proposition à voix basse',
        context: `À la fin d’un dîner, ${who} vous glisse : « Vous avez l’étoffe. Accepteriez-vous que je vous présente à ma loge ? » Il faudra passer l’enquête, puis le bandeau.`,
        choices: [
          c('accepter', 'Accepter d’être initié·e (600 €)', [
            { kind: 'joinLodge' }, { kind: 'funds', account: 'personal', delta: -600 }, s('influence', 5), s('politicalCapital', 10),
            { kind: 'phoneBook', npcId: '$any' }, { kind: 'phoneBook', npcId: '$any' },
            ...(npc ? [{ kind: 'npcRelation' as const, npcId: npc.id, delta: 10 }] : []),
          ], 'Trois coups frappés à la porte du temple : vous êtes Apprenti·e.', { needMoney: 600 }),
          c('reflechir', 'Demander à réfléchir', [s('stress', 1)], '« Prenez votre temps. Nous saurons vous retrouver. »'),
          c('refuser', 'Refuser : pas de cercles fermés', [s('credibility', 1), ...(npc ? [{ kind: 'npcRelation' as const, npcId: npc.id, delta: -5 }] : [])],
            'Votre interlocuteur sourit, un peu déçu.'),
        ],
      };
    },
  },
  {
    tag: 'tenue_blanche', weight: 1,
    eligible: d => !d.lodge && !d.player.flags['closed_lodge'],
    build: d => ({
      title: 'Une tenue blanche ouverte',
      context: 'Une loge vous invite à donner une conférence devant ses membres et quelques « profanes ». Après le débat, le Vénérable vous retient : « Et si vous frappiez à notre porte ? »',
      choices: [
        c('frapper', 'Frapper à la porte du temple (600 €)', [
          { kind: 'joinLodge' }, { kind: 'lodge', fraternite: 8 }, { kind: 'funds', account: 'personal', delta: -600 },
          s('influence', 4), s('credibility', 2), s('politicalCapital', 8), { kind: 'phoneBook', npcId: '$any' },
        ], 'Vos futurs frères et sœurs vous accueillent chaleureusement.', { needMoney: 600 }),
        c('conference', 'Donner la conférence et en rester là', [s('credibility', 2), s('energy', -5), { kind: 'dossier', domain: d.agendaDomain, delta: 2 }], 'Un débat de haute tenue.'),
        c('decliner', 'Décliner', [], 'Vous avez d’autres priorités.'),
      ],
    }),
  },
];

const RANDOM_EVENTS: RandomEvent[] = [
  {
    tag: 'yacht', weight: 1, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Des vacances compromettantes',
      context: 'Un magazine publie des photos de vous sur le yacht d’un milliardaire, l’été dernier. « Simple invitation amicale », dites-vous.',
      choices: [
        c('rembourser', 'Rembourser le séjour et le faire savoir', [{ kind: 'funds', account: 'personal', delta: -6000 }, s('credibility', 2)], 'Le geste désamorce la polémique.'),
        c('assumer', 'Assumer : « J’ai le droit d’avoir des amis »', [s('popularity', -4), { kind: 'exposure', delta: 6 }], 'L’argument passe mal dans l’opinion.'),
        c('silence', 'Ne rien dire et attendre', [{ kind: 'exposure', delta: 10 }], 'L’affaire s’essouffle… mais reste dans les mémoires.'),
      ],
    }),
  },
  {
    tag: 'vieux_post', weight: 1.2,
    build: (_d, rng) => ({
      title: 'Un vieux message ressurgit',
      context: rng.pick([
        'Un message que vous aviez publié il y a dix ans, maladroit et outrancier, circule à nouveau.',
        'Une blague douteuse postée pendant vos études refait surface.',
      ]),
      choices: [
        c('excuses', 'Présenter des excuses sincères', [s('popularity', -1), s('credibility', 2)], 'Des excuses simples, bien reçues.'),
        c('contexte', 'Remettre dans le contexte', [s('popularity', -3)], 'Vos explications sont jugées alambiquées.', {
          risk: { baseChance: 0.4, scaleWith: 'credibility', scaleWeight: 0.5, onFailure: [s('popularity', -6), s('credibility', -3)], failureNews: 'Vos justifications aggravent la polémique.' },
        }),
        c('ignorer', 'Ignorer : ce n’est plus vous', [{ kind: 'exposure', delta: 4 }], 'La polémique meurt d’elle-même.'),
      ],
    }),
  },
  {
    tag: 'televisuel', weight: 1,
    build: () => ({
      title: 'Une émission de divertissement vous invite',
      context: 'Un concours de cuisine en prime time : des millions de téléspectateurs, mais une image peu sérieuse.',
      choices: [
        c('accepter', 'Accepter, tablier compris', [s('popularity', 6), s('credibility', -4), s('energy', -10)], 'Votre tarte tatin fait le buzz.', {
          risk: { baseChance: 0.3, onFailure: [s('popularity', -2), s('credibility', -6)], failureNews: 'Votre plat est jugé immangeable en direct. Les mèmes pleuvent.' },
        }),
        c('decliner', 'Décliner poliment', [s('credibility', 1)], 'Vous gardez votre sérieux.'),
        c('caritatif', 'Accepter si les gains vont à une association', [s('popularity', 4), s('credibility', 1), s('energy', -10)], 'Un beau geste, salué par la presse.'),
      ],
    }),
  },
  {
    tag: 'lanceur', weight: 0.9, minRank: 'conseiller_municipal',
    build: (d, rng) => {
      const rival = rng.pick(d.npcs.filter(n => n.isRival || n.relationToPlayer < -10));
      return {
        title: 'Un lanceur d’alerte vous contacte',
        context: `Il dit détenir des documents compromettants sur ${rival?.name ?? 'un de vos rivaux'}.`,
        choices: [
          c('publier', 'Transmettre les documents à la presse', [
            ...(rival ? [{ kind: 'npcStat' as const, npcId: rival.id, stat: 'popularity' as const, delta: -10 }, { kind: 'npcRelation' as const, npcId: rival.id, delta: -30 }] : []),
            { kind: 'exposure', delta: 6 },
          ], 'Votre rival est éclaboussé. Il sait d’où ça vient.'),
          c('justice', 'L’orienter vers la justice', [s('credibility', 3)], 'Vous restez dans les clous.'),
          c('refuser', 'Refuser : ce n’est pas votre façon de faire', [s('credibility', 1), s('politicalCapital', 3)], 'Votre droiture se sait.'),
        ],
      };
    },
  },
  {
    tag: 'radar', weight: 0.8, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Flashé à 172 km/h',
      context: 'Votre véhicule est contrôlé bien au-delà de la limite. Un journaliste local a l’information.',
      choices: [
        c('assumer', 'Payer, s’excuser, rendre le permis', [{ kind: 'funds', account: 'personal', delta: -750 }, s('credibility', 1), s('energy', -5)], 'On salue votre exemplarité.'),
        c('chauffeur', 'Dire que c’est votre chauffeur qui conduisait', [{ kind: 'exposure', delta: 8 }], 'Le chauffeur confirme… pour l’instant.', {
          risk: { baseChance: 0.45, onFailure: [s('credibility', -10), s('popularity', -6)], failureNews: 'La photo du radar vous montre au volant.' },
        }),
      ],
    }),
  },
  {
    tag: 'chien', weight: 1,
    build: () => ({
      title: 'Un chien abandonné devant votre permanence',
      context: 'Vos collaborateurs l’ont nourri. Il ne veut plus partir.',
      choices: [
        c('adopter', 'L’adopter (et le montrer)', [s('popularity', 4), s('stress', -6)], 'Le chien devient la star de vos réseaux.'),
        c('refuge', 'Le confier à un refuge', [s('stress', -1)], 'Le refuge vous remercie.'),
      ],
    }),
  },
  {
    tag: 'micro_ouvert', weight: 1, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Le micro était resté ouvert',
      context: 'Après une interview, vous avez traité un cadre du parti de « boulet ». Tout a été enregistré.',
      choices: [
        c('excuses', 'L’appeler et s’excuser publiquement', [s('popularity', -1), { kind: 'faction', factionId: '*', delta: -2 }], 'La blessure est pansée.'),
        c('assumer', 'Assumer : « Je dis tout haut ce que je pense »', [s('popularity', 3), { kind: 'faction', factionId: '*', delta: -5 }, { kind: 'cohesion', delta: -4 }], 'Le public aime la franchise, le parti beaucoup moins.'),
        c('trucage', 'Parler de montage', [{ kind: 'exposure', delta: 5 }], 'Personne n’y croit vraiment.'),
      ],
    }),
  },
  {
    tag: 'famille', weight: 0.9,
    build: (_d, rng) => {
      const joyful = rng.chance(0.5);
      return joyful ? {
        title: 'Un heureux événement',
        context: 'Une naissance dans votre famille proche. Les semaines à venir seront chargées.',
        choices: [
          c('pause', 'Prendre deux semaines pour la famille', [s('energy', 25), s('stress', -15), s('influence', -2)], 'Des jours précieux.'),
          c('instagram', 'Partager la nouvelle publiquement', [s('popularity', 3), s('stress', -5)], 'Une avalanche de messages bienveillants.'),
          c('travail', 'Continuer comme si de rien n’était', [s('stress', 6)], 'On vous trouve un peu froid·e.'),
        ],
      } : {
        title: 'Un deuil',
        context: 'Un proche vous a quitté. Il faut décider comment traverser cette période.',
        choices: [
          c('retrait', 'Se retirer quelques jours', [s('energy', 15), s('stress', -10), s('influence', -2)], 'Vos adversaires eux-mêmes respectent ce silence.'),
          c('continuer', 'Continuer à travailler pour tenir', [s('stress', 12), s('energy', -10)], 'Vous tenez, mais à quel prix.'),
        ],
      };
    },
  },
  {
    tag: 'sante', weight: 0.7,
    build: d => ({
      title: 'Alerte de santé',
      context: `Un malaise dans votre bureau. Le médecin est formel : ${d.player.stats.stress > 60 ? 'vous êtes au bord de l’épuisement' : 'il faut lever le pied'}.`,
      choices: [
        c('repos', 'Suivre ses conseils : une semaine de repos', [s('energy', 35), s('stress', -25), { kind: 'flag', key: 'bonusAp', value: -2 }], 'Vous revenez en forme.'),
        c('cacher', 'Cacher l’incident et continuer', [s('stress', 8)], 'Personne n’en sait rien.', {
          risk: { baseChance: 0.35, onFailure: [s('popularity', -3), s('credibility', -4), s('energy', -20)], failureNews: 'Un nouveau malaise, en public cette fois.' },
        }),
      ],
    }),
  },
  {
    tag: 'sondage_star', weight: 0.8,
    build: () => ({
      title: 'Vous voilà personnalité préférée des Français',
      context: 'Un sondage surprise vous place en tête d’un classement de popularité. Les médias vous courtisent.',
      choices: [
        c('capitaliser', 'Enchaîner les plateaux tant que ça dure', [s('popularity', 5), s('influence', 3), s('energy', -15), { kind: 'exposure', delta: 4 }], 'Vous êtes partout.'),
        c('humble', 'Rester humble et sur le terrain', [s('credibility', 3), s('popularity', 2)], 'La modestie plaît.'),
      ],
    }),
  },
  {
    tag: 'pacte', weight: 0.8, minRank: 'conseiller_municipal',
    build: (d, rng) => {
      const npc = rng.pick(d.npcs.filter(n => n.partyId === d.party.id && n.isRival)) ?? d.npcs[0];
      return {
        title: `${npc.name} vous propose un pacte`,
        context: '« Arrêtons de nous affaiblir mutuellement. Je vous soutiens maintenant, vous me soutiendrez plus tard. »',
        choices: [
          c('accepter', 'Accepter le pacte', [{ kind: 'npcRelation', npcId: npc.id, delta: 40 }, { kind: 'faction', factionId: '*', delta: 3 }, s('politicalCapital', -5)], 'Une trêve utile… jusqu’à quand ?'),
          c('refuser', 'Refuser', [{ kind: 'npcRelation', npcId: npc.id, delta: -15 }, s('credibility', 1)], 'Il ne l’oubliera pas.'),
          c('trahir', 'Accepter… et le faire fuiter', [{ kind: 'npcStat', npcId: npc.id, stat: 'influence', delta: -10 }, { kind: 'npcRelation', npcId: npc.id, delta: -50 }, { kind: 'exposure', delta: 5 }], 'Il est humilié. Le parti retient la leçon.'),
        ],
      };
    },
  },
  {
    tag: 'heritage', weight: 0.5,
    build: () => ({
      title: 'Un héritage inattendu',
      context: 'Une grand-tante oubliée vous lègue 40 000 €.',
      choices: [
        c('garder', 'Le garder', [{ kind: 'funds', account: 'personal', delta: 40000 }], 'Une bouffée d’oxygène pour vos finances.'),
        c('association', 'En donner la moitié à une association', [{ kind: 'funds', account: 'personal', delta: 20000 }, s('popularity', 3), s('credibility', 1)], 'Un geste remarqué.'),
        c('campagne', 'Tout verser à votre compte de campagne', [{ kind: 'funds', account: 'campaign', delta: 40000 }], 'Votre trésorier jubile.'),
      ],
    }),
  },
  {
    tag: 'piratage', weight: 0.7, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Votre téléphone a été piraté',
      context: 'Des hackers menacent de publier vos messages privés.',
      choices: [
        c('plainte', 'Porter plainte et tout dire', [s('credibility', 2), { kind: 'exposure', delta: 6 }], 'Les fuites sont anodines. Votre transparence paie.'),
        c('payer', 'Payer la rançon discrètement', [{ kind: 'funds', account: 'personal', delta: -10000 }, { kind: 'flagAdd', key: 'illegal', delta: 1 }], 'Les messages ne sortiront pas… cette fois.', {
          risk: { baseChance: 0.3, onFailure: [{ kind: 'exposure', delta: 20 }, s('popularity', -4)], failureNews: 'Ils publient quand même. Et révèlent que vous avez payé.' },
        }),
        c('ignorer', 'Ignorer la menace', [{ kind: 'exposure', delta: 10 }], 'Quelques messages embarrassants circulent.'),
      ],
    }),
  },
  {
    tag: 'imitateur', weight: 0.8, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Un humoriste vous imite chaque soir',
      context: 'Votre marionnette est devenue la vedette d’une émission satirique.',
      choices: [
        c('jouer', 'Participer à un sketch avec lui', [s('popularity', 5), s('credibility', -1)], 'Vous montrez que vous avez de l’humour.', {
          risk: { baseChance: 0.25, onFailure: [s('popularity', -3)], failureNews: 'Le sketch tombe à plat : gêne générale.' },
        }),
        c('ignorer', 'Ignorer', [s('popularity', 1)], 'Être imité, c’est exister.'),
        c('plaindre', 'Dénoncer un acharnement', [s('popularity', -4), s('stress', 4)], 'L’effet Streisand est immédiat.'),
      ],
    }),
  },
  {
    tag: 'pantouflage', weight: 0.6, minRank: 'depute',
    build: () => ({
      title: 'Une offre en or dans le privé',
      context: 'Un grand groupe vous propose un poste de directeur·rice des affaires publiques, très bien payé.',
      choices: [
        c('decliner', 'Décliner : la politique avant tout', [s('credibility', 2), s('influence', 1)], 'Vous restez au service du public.'),
        c('conseil', 'Accepter une mission de conseil à côté', [{ kind: 'income', base: 15000 }, { kind: 'exposure', delta: 12 }], 'L’argent rentre. Les soupçons de conflit d’intérêts aussi.'),
      ],
    }),
  },
  {
    tag: 'greve_transports', weight: 0.8,
    build: () => ({
      title: 'Grève générale des transports',
      context: 'Votre agenda du mois prochain est compromis.',
      choices: [
        c('velo', 'Tout faire à vélo, caméras incluses', [s('popularity', 3), s('energy', -15)], 'L’image d’un·e élu·e qui pédale plaît.'),
        c('soutien', 'Soutenir les grévistes', [s('popularity', 1), { kind: 'stance', delta: -4 }, { kind: 'contact', contactId: 'ct-ust', trust: 6 }], 'Les syndicats apprécient.'),
        c('critiquer', 'Dénoncer une prise d’otage des usagers', [s('popularity', 1), { kind: 'stance', delta: 4 }], 'Une partie de l’opinion approuve.'),
      ],
    }),
  },

  // ── Quand on est déjà royaliste ou franc-maçon hors scénario ──
  {
    tag: 'enquete_couronne', weight: 1.2, minRank: 'conseiller_municipal',
    eligible: d => !!d.crown && d.scenario !== 'royaute',
    build: () => ({
      title: 'Vos amitiés royalistes font la une',
      context: '« L’élu·e qui rêve d’un roi » : un hebdomadaire consacre sa couverture à vos liens avec le prétendant.',
      choices: [
        c('assumer', 'Assumer : « La France a besoin de verticalité »', [s('popularity', -3), { kind: 'crown', soutien: 5, legitimite: 3 }, { kind: 'stance', delta: 3 }], 'Les monarchistes exultent, les républicains s’étranglent.'),
        c('minimiser', 'Minimiser : « Une curiosité historique »', [{ kind: 'exposure', delta: 5 }, { kind: 'crown', soutien: -3 }], 'Personne n’est vraiment convaincu.'),
        c('rompre', 'Rompre avec le cercle du prince', [{ kind: 'leaveCrown' }, s('credibility', 2), { kind: 'faction', factionId: 'moderes', delta: 3 }], 'Le prince ne vous le pardonnera pas. Votre parti respire.'),
      ],
    }),
  },
  {
    tag: 'frere_service', weight: 1.2,
    eligible: d => !!d.lodge && d.scenario !== 'franc_macon',
    build: () => ({
      title: 'Un frère vous demande un service',
      context: '« Mon fils postule à un poste à la mairie. Un mot de toi suffirait… entre nous. »',
      choices: [
        c('appuyer', 'Glisser un mot en sa faveur', [{ kind: 'lodge', fraternite: 10, discretion: -6 }, { kind: 'exposure', delta: 4 }], 'Le fils est embauché. La loge vous en est reconnaissante.', {
          risk: { baseChance: 0.25, onFailure: [s('credibility', -5), { kind: 'lodge', discretion: -15 }], failureNews: 'Un syndicat dénonce un recrutement de complaisance.' },
        }),
        c('refuser', 'Refuser avec fermeté', [{ kind: 'lodge', fraternite: -8 }, s('credibility', 1)], 'Votre frère est vexé.'),
        c('demission', 'Démissionner de la loge', [{ kind: 'leaveLodge' }, s('credibility', 3)], 'Vous rendez votre tablier.'),
      ],
    }),
  },

  // ── Nouveaux imprévus ─────────────────────────────────────────
  {
    tag: 'canicule', weight: 1,
    build: () => ({
      title: 'Canicule historique',
      context: '43 °C à l’ombre. Les personnes âgées de votre circonscription souffrent.',
      choices: [
        c('salle', 'Ouvrir votre permanence en salle climatisée (800 €)', [{ kind: 'funds', account: 'personal', delta: -800 }, s('popularity', 4), s('energy', -6)], 'Les anciens viennent jouer aux cartes au frais. Belle image.'),
        c('climat', 'Prendre la parole sur l’urgence climatique', [{ kind: 'dossier', domain: 'ecologie', delta: 3 }, { kind: 'stance', delta: -3 }, { kind: 'contact', contactId: 'ct-climat', trust: 6 }], 'Le collectif Climat Urgence relaie votre tribune.'),
        c('rien', 'Rester au frais', [s('energy', 5), s('popularity', -2)], 'On vous reproche votre absence.'),
      ],
    }),
  },
  {
    tag: 'plateau_debat', weight: 1, minRank: 'conseiller_municipal',
    build: (d, rng) => {
      const rival = rng.pick(d.npcs.filter(n => n.isRival || n.relationToPlayer < -10));
      return {
        title: 'Une chaîne d’info vous propose un duel',
        context: `Ce soir en direct, face à ${rival?.name ?? 'un adversaire'}. Refuser, c’est laisser la chaise vide.`,
        choices: [
          c('accepter', 'Accepter le face-à-face', [{ kind: 'debate', stakes: 'face_a_face', ...(rival ? { opponentId: rival.id } : {}) }], 'Maquillage, oreillette : c’est parti.'),
          c('refuser', 'Refuser : « Je ne débats pas avec n’importe qui »', [s('popularity', -2), s('influence', -1)], 'La chaise vide fait le tour des réseaux.'),
        ],
      };
    },
  },
  {
    tag: 'agriculteurs', weight: 0.9,
    build: () => ({
      title: 'Du fumier devant votre permanence',
      context: 'Des agriculteurs en colère bloquent la rue avec leurs tracteurs. Ils exigent d’être reçus.',
      choices: [
        c('recevoir', 'Les recevoir et négocier', [{ kind: 'scene', sceneId: 'mediation' }], 'Café, chaises en cercle : la négociation commence en fin de mois.'),
        c('soutenir', 'Monter sur un tracteur avec eux', [s('popularity', 3), { kind: 'stance', delta: 3 }, { kind: 'contact', contactId: 'ct-maires', trust: 6 }, { kind: 'dossier', domain: 'territoires', delta: 2 }], 'La photo fait la une de la presse régionale.'),
        c('police', 'Demander l’évacuation', [s('popularity', -4), { kind: 'stance', delta: 2 }], 'Les tracteurs repartent. La rancune reste.'),
      ],
    }),
  },
  {
    tag: 'deepfake', weight: 0.9, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Une fausse vidéo de vous circule',
      context: 'Un hypertrucage vous montre en train d’insulter des retraités. Deux millions de vues en une nuit.',
      choices: [
        c('plainte', 'Porter plainte et démentir sobrement', [s('credibility', 1), { kind: 'exposure', delta: 3 }, s('stress', 3)], 'Le démenti circule, moins vite que la vidéo.'),
        c('humour', 'Répondre par une contre-vidéo pleine d’humour', [s('popularity', 5)], 'Votre réponse dépasse la fausse vidéo en vues.', {
          risk: { baseChance: 0.35, scaleWith: 'popularity', scaleWeight: 0.4, onFailure: [s('popularity', -4)], failureNews: 'Votre blague tombe à plat et relance la fausse vidéo.' },
        }),
        c('ignorer', 'Ne pas répondre', [s('popularity', -4)], 'Beaucoup croient encore que c’est vrai.'),
      ],
    }),
  },
  {
    tag: 'ecole', weight: 0.9,
    build: () => ({
      title: 'Une classe de CM2 veut vous interviewer',
      context: 'Le journal de l’école prépare un numéro spécial « Le métier d’élu ». Les questions sont redoutables.',
      choices: [
        c('accepter', 'Répondre à toutes les questions', [s('popularity', 2), s('stress', -4), { kind: 'dossier', domain: 'education', delta: 2 }, s('energy', -4)], '« Pourquoi vous êtes jamais d’accord entre adultes ? »'),
        c('collab', 'Envoyer un collaborateur', [], 'Les enfants sont déçus.'),
      ],
    }),
  },
  {
    tag: 'grands_crus', weight: 0.8, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Une caisse de grands crus livrée à votre bureau',
      context: 'Avec la carte d’un lobby qui suit de près un texte en discussion.',
      choices: [
        c('renvoyer', 'Renvoyer la caisse avec un mot sec', [s('credibility', 2), { kind: 'contact', contactId: 'ct-btp', trust: -5 }], 'Le lobby a compris.'),
        c('garder', 'La garder : ça ne se refuse pas', [s('stress', -4), { kind: 'flagAdd', key: 'illegal', delta: 1 }, { kind: 'exposure', delta: 4 }], 'Un excellent millésime. Un stagiaire a vu la livraison.'),
        c('tombola', 'L’offrir à la tombola des anciens', [s('popularity', 2)], 'Les gagnants trinquent à votre santé.'),
      ],
    }),
  },
  {
    tag: 'star', weight: 0.8,
    build: () => ({
      title: 'Une chanteuse populaire veut vous soutenir',
      context: 'Elle propose de chanter à votre prochain meeting et de vous citer en interview.',
      choices: [
        c('accepter', 'Accepter avec enthousiasme', [s('popularity', 5), { kind: 'momentum', delta: 6 }], 'Le meeting affiche complet.', {
          risk: { baseChance: 0.3, onFailure: [s('popularity', -4), s('credibility', -2)], failureNews: 'La chanteuse dérape en interview. On vous somme de vous désolidariser.' },
        }),
        c('discret', 'La remercier sans l’exposer', [s('popularity', 1)], 'Un soutien de cœur, sans risque.'),
      ],
    }),
  },
  {
    tag: 'accident_usine', weight: 0.7,
    build: () => ({
      title: 'Explosion dans une usine chimique',
      context: 'Un nuage de fumée noire au-dessus de votre circonscription. Pas de victime, mais la population a peur.',
      choices: [
        c('terrain', 'Se rendre immédiatement sur place', [s('popularity', 4), s('energy', -10), { kind: 'dossier', domain: 'ecologie', delta: 3 }], 'Casque sur la tête, vous rassurez les riverains.'),
        c('enquete', 'Exiger une commission d’enquête', [{ kind: 'scene', sceneId: 'commission' }], 'Les auditions commencent en fin de mois.', { needRank: 'depute' }),
        c('communique', 'Publier un communiqué', [s('popularity', -1)], 'Le service minimum.'),
      ],
    }),
  },
  {
    tag: 'transfuge', weight: 0.7, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Un élu adverse veut vous rejoindre',
      context: 'Un maire influent du camp d’en face frappe à votre porte. Il apporte ses réseaux… et sa réputation de girouette.',
      choices: [
        c('accueillir', 'L’accueillir à bras ouverts', [s('influence', 4), { kind: 'cohesion', delta: -3 }, { kind: 'faction', factionId: '*', delta: -2 }], 'Un beau coup. Les militants grincent des dents.'),
        c('refuser', 'Refuser : « Les convictions ne se négocient pas »', [s('credibility', 2), { kind: 'faction', factionId: '*', delta: 2 }], 'Vos militants applaudissent.'),
      ],
    }),
  },
  {
    tag: 'fuite_assistant', weight: 0.6, minRank: 'depute',
    build: () => ({
      title: 'Votre assistant a parlé à la presse',
      context: 'Des notes internes sur votre stratégie se retrouvent dans un quotidien. La source est dans votre bureau.',
      choices: [
        c('licencier', 'Le licencier sur-le-champ', [s('stress', 4), s('credibility', 1)], 'Le message est passé à toute l’équipe.'),
        c('pardonner', 'Lui laisser une seconde chance', [s('stress', -2), { kind: 'exposure', delta: 4 }], 'Il jure qu’on ne l’y reprendra pas.'),
        c('desinfo', 'Le garder… et lui donner de fausses infos', [{ kind: 'momentum', delta: 4 }, { kind: 'exposure', delta: 2 }], 'Vos rivaux se ruent sur une fausse piste.', {
          risk: { baseChance: 0.3, onFailure: [s('credibility', -4)], failureNews: 'La manipulation est éventée.' },
        }),
      ],
    }),
  },
  {
    tag: 'danse_virale', weight: 0.8,
    build: () => ({
      title: 'Votre pas de danse fait le tour d’internet',
      context: 'Filmé·e au bal du 14 Juillet : 8 millions de vues. Les jeunes adorent.',
      choices: [
        c('surfer', 'Surfer sur la vague (tutoriel compris)', [s('popularity', 5), s('credibility', -2)], 'Vous gagnez 200 000 abonnés.'),
        c('autoderision', 'Une réponse pleine d’autodérision', [s('popularity', 3)], 'Le juste ton.'),
        c('supprimer', 'Demander le retrait de la vidéo', [s('popularity', -2)], 'L’effet inverse : elle circule de plus belle.'),
      ],
    }),
  },
  {
    tag: 'collectif_colere', weight: 0.7,
    build: () => ({
      title: 'Un collectif vous demande de mener la marche',
      context: 'Après la fermeture d’une maternité, des milliers de personnes veulent défiler. Il leur manque une figure.',
      choices: [
        c('mener', 'Prendre la tête du cortège', [{ kind: 'protest' }], 'Les banderoles sont prêtes. À vous d’organiser la marche.'),
        c('soutenir', 'Soutenir sans défiler', [s('popularity', 1), { kind: 'dossier', domain: 'sante', delta: 2 }], 'Un soutien de principe.'),
        c('refuser', 'Refuser', [s('popularity', -2)], 'Le collectif vous le reproche publiquement.'),
      ],
    }),
  },
  {
    tag: 'marche_noel', weight: 0.7,
    build: () => ({
      title: 'Les commerçants vous invitent au marché de Noël',
      context: 'Vin chaud, chalets en bois et beaucoup d’électeurs. Une occasion en or… ou un piège à questions.',
      choices: [
        c('y_aller', 'Y passer la matinée', [{ kind: 'scene', sceneId: 'marche' }], 'Écharpe, gants, sourire : la tournée des stands commence.'),
        c('decliner', 'Décliner', [], 'Les commerçants sont un peu vexés.'),
      ],
    }),
  },
  {
    tag: 'livre_plume', weight: 0.6, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Un éditeur veut « votre » livre',
      context: 'Une plume l’écrirait pour vous en trois semaines. À-valoir : 8 000 €.',
      choices: [
        c('plume', 'Signer, la plume écrira', [{ kind: 'funds', account: 'personal', delta: 8000 }, s('influence', 2)], 'Le livre sort. Vous découvrez vos propres souvenirs.', {
          risk: { baseChance: 0.25, onFailure: [s('credibility', -6)], failureNews: 'Des passages entiers sont copiés d’un autre ouvrage.' },
        }),
        c('ecrire', 'L’écrire vous-même', [{ kind: 'funds', account: 'personal', delta: 5000 }, s('credibility', 3), s('energy', -15)], 'Nuits blanches, mais un livre sincère.'),
        c('refuser', 'Refuser', [], 'Pas le moment.'),
      ],
    }),
  },

  // ── Patrimoine ────────────────────────────────────────────────
  {
    tag: 'hatvp', weight: 2, minRank: 'depute',
    eligible: d => netWorth(d) > 150000,
    build: d => {
      const img = wealthImage(d);
      return {
        title: 'Votre déclaration de patrimoine est publiée',
        context: `La Haute Autorité met en ligne votre déclaration : ${Math.round(netWorth(d)).toLocaleString('fr-FR')} € de patrimoine net. Les journalistes épluchent chaque ligne.`,
        choices: [
          c('assumer', 'Tout détailler en conférence de presse', [s('credibility', 3), s('popularity', -Math.min(6, Math.round(img.score * 0.3)))], 'La transparence est saluée, le montant beaucoup moins.'),
          c('vendre', 'Vendre votre bien le plus voyant avant la publication', [{ kind: 'sellAsset', which: 'ostentatious', discount: 0.1 }, s('popularity', 1)], 'Vente précipitée, mais la déclaration paraît plus sobre.'),
          c('minorer', 'Sous-évaluer quelques biens', [{ kind: 'exposure', delta: 10 }, { kind: 'flagAdd', key: 'illegal', delta: 1 }], 'Personne ne remarque rien… pour l’instant.', {
            risk: { baseChance: 0.35, onFailure: [s('credibility', -6), { kind: 'decision', templateId: 'enquete' }], failureNews: 'Un journaliste compare avec le cadastre : la déclaration est fausse.' },
          }),
        ],
      };
    },
  },
  {
    tag: 'paparazzi', weight: 1.5, minRank: 'conseiller_municipal',
    eligible: d => owns(d, ['villa', 'yacht', 'sportive']),
    build: (d, rng) => {
      const a = rng.pick(d.player.assets.filter(x => ['villa', 'yacht', 'sportive'].includes(x.defId)))!;
      const label = ASSETS_BY_ID.get(a.defId)!.label.toLowerCase();
      return {
        title: 'Paparazzi',
        context: `Un magazine publie huit pages de photos : vous, votre ${label}, une coupe de champagne. Le titre : « La belle vie ».`,
        choices: [
          c('assumer', 'Assumer : « J’ai travaillé pour ça »', [s('popularity', -3), s('influence', 1)], 'Vos électeurs les plus modestes décrochent.'),
          c('vendre', `Vendre votre ${label}`, [{ kind: 'sellAsset', which: a.defId, discount: 0.15 }, s('popularity', 2)], 'Un geste d’humilité, salué par vos soutiens.'),
          c('proces', 'Attaquer le magazine en justice', [{ kind: 'funds', account: 'personal', delta: -3000 }, { kind: 'exposure', delta: 4 }, s('stress', 4)], 'Le procès relance l’affaire.'),
        ],
      };
    },
  },
  {
    tag: 'montre_polemique', weight: 1.5,
    eligible: d => owns(d, ['montre']),
    build: () => ({
      title: 'Votre montre fait polémique',
      context: 'Sur un plateau, la caméra zoome sur votre poignet. Un internaute retrouve le prix : l’équivalent de huit mois de SMIC.',
      choices: [
        c('encheres', 'La mettre aux enchères pour une association', [{ kind: 'sellAsset', which: 'montre', discount: 1 }, s('popularity', 4), s('credibility', 1)], 'L’association récolte une belle somme. Le buzz se retourne en votre faveur.'),
        c('cadeau', 'Dire que c’est un cadeau', [{ kind: 'exposure', delta: 5 }], 'L’explication passe… à peu près.', {
          risk: { baseChance: 0.35, onFailure: [s('credibility', -5), s('popularity', -3)], failureNews: 'La facture à votre nom est publiée.' },
        }),
        c('assumer', 'Assumer', [s('popularity', -3), s('influence', 1)], 'Les milieux d’affaires apprécient, l’opinion beaucoup moins.'),
      ],
    }),
  },
  {
    tag: 'krach', weight: 1.4,
    eligible: d => owns(d, ['actions', 'crypto']),
    build: () => ({
      title: 'Krach boursier',
      context: 'Les marchés dévissent de 25 % en trois séances. Votre portefeuille fond à vue d’œil.',
      choices: [
        c('garder', 'Ne rien vendre et attendre le rebond', [{ kind: 'assetValue', defIds: ['actions', 'crypto'], factor: 0.75 }, s('stress', 4)], 'Les pertes sont latentes. Pour l’instant.'),
        c('calme', 'Appeler au calme à la télévision', [{ kind: 'assetValue', defIds: ['actions', 'crypto'], factor: 0.75 }, s('credibility', 2), { kind: 'dossier', domain: 'economie', delta: 2 }], 'On salue votre sang-froid.'),
        c('vendre', 'Vendre en catastrophe une partie', [{ kind: 'assetValue', defIds: ['actions', 'crypto'], factor: 0.8 }, { kind: 'sellAsset', which: 'actions' }], 'Vous limitez la casse.'),
      ],
    }),
  },
  {
    tag: 'crypto_bulle', weight: 1.2,
    eligible: d => owns(d, ['crypto']),
    build: () => ({
      title: 'Vos cryptomonnaies s’envolent',
      context: 'Le cours a doublé en dix jours. Les forums parlent d’une bulle.',
      choices: [
        c('encaisser', 'Encaisser une partie', [{ kind: 'assetValue', defIds: ['crypto'], factor: 2 }, { kind: 'sellAsset', which: 'crypto' }], 'Vous empochez une jolie plus-value.'),
        c('garder', 'Tout garder : ça va encore monter', [{ kind: 'assetValue', defIds: ['crypto'], factor: 2.4 }], 'Ça monte encore !', {
          risk: { baseChance: 0.45, onFailure: [{ kind: 'assetValue', defIds: ['crypto'], factor: 0.35 }, s('stress', 6)], failureNews: 'La bulle éclate : le cours s’effondre de 65 %.' },
        }),
      ],
    }),
  },
  {
    tag: 'cambriolage', weight: 1,
    eligible: d => owns(d, ['art', 'montre', 'cave']),
    build: (d, rng) => {
      const a = rng.pick(d.player.assets.filter(x => ['art', 'montre', 'cave'].includes(x.defId)))!;
      const label = ASSETS_BY_ID.get(a.defId)!.label.toLowerCase();
      return {
        title: 'Cambriolage',
        context: `En rentrant, vous trouvez la porte forcée. Votre ${label} a disparu.`,
        choices: [
          c('assurance', 'Faire jouer l’assurance', [{ kind: 'sellAsset', which: a.defId, discount: 0.3 }, s('stress', 5)], 'L’assurance rembourse 70 % de la valeur.'),
          c('police', 'Tout miser sur l’enquête', [s('stress', 6)], 'Les enquêteurs retrouvent le receleur !', {
            risk: { baseChance: 0.5, onFailure: [{ kind: 'sellAsset', which: a.defId, discount: 1 }], failureNews: 'L’enquête piétine : le bien est perdu, sans indemnisation.' },
          }),
        ],
      };
    },
  },
  {
    tag: 'promoteur', weight: 1, minRank: 'conseiller_municipal',
    eligible: d => owns(d, ['maison', 'studio', 'locatif']),
    build: (d, rng) => {
      const a = rng.pick(d.player.assets.filter(x => ['maison', 'studio', 'locatif'].includes(x.defId)))!;
      const label = ASSETS_BY_ID.get(a.defId)!.label.toLowerCase();
      return {
        title: 'Un promoteur veut votre bien',
        context: `Il propose de racheter votre ${label} 35 % au-dessus du prix du marché. Il a aussi un projet en attente de permis…`,
        choices: [
          c('accepter', 'Accepter l’offre', [{ kind: 'assetValue', defIds: [a.defId], factor: 1.35 }, { kind: 'sellAsset', which: a.defId }, { kind: 'exposure', delta: 8 }], 'Une belle plus-value. Le permis, lui, sera regardé de près.'),
          c('refuser', 'Refuser : conflit d’intérêts évident', [s('credibility', 2)], 'Vous restez au-dessus de tout soupçon.'),
        ],
      };
    },
  },
  {
    tag: 'maison_famille', weight: 0.6,
    eligible: d => !owns(d, ['maison']),
    build: () => ({
      title: 'Vous héritez de la maison de famille',
      context: 'Une longère en pierre, des souvenirs d’enfance… et une toiture à refaire.',
      choices: [
        c('garder', 'La garder', [{ kind: 'gainAsset', defId: 'maison' }, s('stress', -3)], 'Les volets bleus vous attendent pour les week-ends.'),
        c('vendre', 'La vendre', [{ kind: 'funds', account: 'personal', delta: 190000 }], 'Une somme considérable rejoint vos comptes.'),
        c('commune', 'La céder à la commune pour en faire une maison des associations', [s('popularity', 5), s('credibility', 2)], 'Le geste fait la une de la presse locale.'),
      ],
    }),
  },
  {
    tag: 'train_de_vie', weight: 1.5, minRank: 'conseiller_municipal',
    eligible: d => wealthImage(d).score >= 14,
    build: () => ({
      title: 'Une enquête sur votre train de vie',
      context: '« Élu·e du peuple, vie de château » : un documentaire passe vos biens au crible.',
      choices: [
        c('vendre', 'Vendre ce qui choque', [{ kind: 'sellAsset', which: 'ostentatious', discount: 0.1 }, s('popularity', 2)], 'Vous montrez que vous avez entendu.'),
        c('justifier', 'Répondre point par point', [s('credibility', -1), s('popularity', -3)], 'Les justifications techniques passent mal.'),
        c('attaquer', 'Dénoncer un acharnement médiatique', [s('popularity', -1), s('stress', 4)], 'Vos partisans font bloc.', {
          risk: { baseChance: 0.4, onFailure: [s('popularity', -5)], failureNews: 'L’effet Streisand est total.' },
        }),
      ],
    }),
  },

  // ── Caisse du parti ──
  {
    tag: 'tresorier_parti', weight: 3,
    eligible: d => Number(d.player.flags['partySpent'] ?? 0) >= 15000 && d.party.leaderNpcId !== 'player',
    build: d => ({
      title: 'Le trésorier du parti s’inquiète',
      context: `Vous avez fait régler ${Number(d.player.flags['partySpent']).toLocaleString('fr-FR')} € par la fédération. « Les autres sections se plaignent », dit-il.`,
      choices: [
        c('rembourser', 'Rembourser 3 000 € de votre poche', [{ kind: 'funds', account: 'personal', delta: -3000 }, { kind: 'faction', factionId: '*', delta: 3 }, { kind: 'flag', key: 'partySpent', value: 0 }], 'Le trésorier range son tableau Excel.', { needMoney: 3000 }),
        c('justifier', 'Défendre chaque dépense devant le bureau', [s('politicalCapital', -10), { kind: 'flag', key: 'partySpent', value: 0 }], 'Vos dépenses sont validées, non sans grincements.'),
        c('ignorer', 'Ignorer', [{ kind: 'faction', factionId: '*', delta: -5 }, { kind: 'cohesion', delta: -3 }, { kind: 'flag', key: 'partySpent', value: 0 }], 'On vous traite de « panier percé » dans les couloirs.'),
      ],
    }),
  },

  // ── Encore d’autres imprévus ──
  {
    tag: 'jumelage', weight: 0.8, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Invitation de la ville jumelle',
      context: 'Le maire de votre ville jumelle, à l’étranger, vous invite pour les 50 ans du jumelage.',
      choices: [
        c('voyage', 'Faire le voyage', [s('energy', -10), { kind: 'dossier', domain: 'diplomatie', delta: 5 }, s('influence', 1)], 'Discours, fanfare, échange de cadeaux.'),
        c('visio', 'Envoyer une vidéo', [{ kind: 'dossier', domain: 'diplomatie', delta: 1 }], 'Le service minimum diplomatique.'),
      ],
    }),
  },
  {
    tag: 'ia_discours', weight: 0.8,
    build: () => ({
      title: 'Une citation inventée dans votre discours',
      context: 'Votre plume a utilisé une IA : la belle citation de Victor Hugo n’a jamais existé. Un historien s’amuse sur les réseaux.',
      choices: [
        c('avouer', 'Avouer avec humour', [s('popularity', 1), s('credibility', -1)], 'On rit avec vous plutôt que de vous.'),
        c('nier', 'Affirmer que la citation est authentique', [{ kind: 'exposure', delta: 3 }], 'Le doute persiste.', {
          risk: { baseChance: 0.5, onFailure: [s('credibility', -5)], failureNews: 'Trois spécialistes confirment : la citation est fausse.' },
        }),
      ],
    }),
  },
  {
    tag: 'club_foot', weight: 0.8,
    build: () => ({
      title: 'Le club de foot local au bord de la faillite',
      context: 'Cent ans d’histoire, 400 licenciés chez les jeunes. Le président vous appelle à l’aide.',
      choices: [
        c('mecenat', 'Faire un don personnel de 5 000 €', [{ kind: 'funds', account: 'personal', delta: -5000 }, s('popularity', 5)], 'Le club est sauvé. Votre nom est scandé au stade.', { needMoney: 5000 }),
        c('subvention', 'Obtenir une subvention publique', [s('popularity', 3), { kind: 'exposure', delta: 3 }], 'L’opposition parle de clientélisme.'),
        c('refuser', 'Refuser : ce n’est pas le rôle des élus', [s('popularity', -2), s('credibility', 1)], 'Les supporters ne l’oublieront pas.'),
      ],
    }),
  },
  {
    tag: 'eolien', weight: 0.8,
    build: () => ({
      title: 'Un parc éolien divise la région',
      context: 'Douze éoliennes sur la colline. Pétition contre, collectif pour : on attend votre position.',
      choices: [
        c('pour', 'Soutenir le projet', [{ kind: 'dossier', domain: 'ecologie', delta: 3 }, { kind: 'stance', delta: -2 }, s('popularity', -1), { kind: 'contact', contactId: 'ct-climat', trust: 6 }], 'Les écologistes applaudissent, les riverains grondent.'),
        c('contre', 'S’opposer au projet', [s('popularity', 2), { kind: 'stance', delta: 2 }, { kind: 'contact', contactId: 'ct-climat', trust: -6 }], 'Les riverains vous remercient.'),
        c('concertation', 'Organiser une concertation', [{ kind: 'scene', sceneId: 'mediation' }], 'Tout le monde autour de la table en fin de mois.'),
      ],
    }),
  },
  {
    tag: 'fact_check', weight: 0.9, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Épinglé·e par les vérificateurs',
      context: 'Un média de vérification juge « faux » un chiffre que vous avez cité à la radio.',
      choices: [
        c('corriger', 'Reconnaître l’erreur', [s('credibility', 1)], 'Rare et apprécié.'),
        c('maintenir', 'Maintenir : « J’ai mes sources »', [s('influence', 1)], 'Vos sources tiennent la route.', {
          risk: { baseChance: 0.5, scaleWith: 'credibility', scaleWeight: 0.5, onFailure: [s('credibility', -4)], failureNews: 'Vos « sources » sont démontées en direct.' },
        }),
      ],
    }),
  },
  {
    tag: 'mariage_star', weight: 0.7,
    build: () => ({
      title: 'Invité·e au mariage d’une star',
      context: 'Un animateur vedette se marie. Trois cents invités, des magazines partout.',
      choices: [
        c('y_aller', 'Y aller', [s('popularity', 2), s('influence', 2), { kind: 'exposure', delta: 3 }, s('energy', -8)], 'Vous voilà dans les pages people.'),
        c('decliner', 'Décliner', [], 'Vous préférez la discrétion.'),
      ],
    }),
  },
  {
    tag: 'sms_erreur', weight: 0.7, minRank: 'depute',
    build: () => ({
      title: 'Un SMS qui ne vous était pas destiné',
      context: 'Un ministre vous écrit par erreur : il détaille une manœuvre pour faire tomber un de vos alliés.',
      choices: [
        c('exploiter', 'Garder l’info et prévenir votre allié', [s('influence', 3), s('politicalCapital', 5)], 'Votre allié vous doit une fière chandelle.'),
        c('rendre', 'Lui signaler son erreur, discrètement', [s('credibility', 2), s('politicalCapital', 8)], 'Le ministre vous en sera redevable.'),
        c('presse', 'Transmettre à la presse', [s('popularity', 3), { kind: 'exposure', delta: 5 }, s('influence', -1)], 'Scandale au gouvernement. On se méfie désormais de vous.'),
      ],
    }),
  },

  // ── Rédaction ────────────────────────────────────────────────
  {
    tag: 'diffamation', weight: 1.4,
    eligible: d => !!d.press,
    build: (d, rng) => {
      const target = rng.pick(d.npcs.filter(n => n.influence > 40)) ?? d.npcs[0];
      return {
        title: 'Poursuivi·e en diffamation',
        context: `${target.name} vous attaque en justice pour un de vos éditoriaux. Il réclame 50 000 € de dommages et intérêts.`,
        choices: [
          c('proces', 'Aller au procès, preuves à l’appui', [{ kind: 'funds', account: 'personal', delta: -4000 }, { kind: 'press', reputation: 4 }, s('stress', 5)], 'Relaxe ! Le tribunal reconnaît votre bonne foi.', {
            risk: { baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.5, onFailure: [{ kind: 'funds', account: 'personal', delta: -15000 }, { kind: 'press', reputation: -8 }], failureNews: 'Condamné·e : 15 000 € et un démenti à publier.' },
          }),
          c('excuses', 'Publier un rectificatif', [{ kind: 'press', reputation: -4 }, { kind: 'npcRelation', npcId: target.id, delta: 10 }], 'L’affaire s’éteint, votre fierté un peu aussi.'),
          c('transaction', 'Transiger discrètement (8 000 €)', [{ kind: 'funds', account: 'personal', delta: -8000 }], 'Personne n’en saura rien.', { needMoney: 8000 }),
        ],
      };
    },
  },
  {
    tag: 'rachat_media', weight: 1,
    eligible: d => !!d.press,
    build: (d, rng) => {
      const p = d.press!;
      const shift = (p.ligne > 0 ? 1 : -1) * rng.int(15, 30);
      return {
        title: `${p.outlet} change de propriétaire`,
        context: `Un industriel rachète le média et annonce une « nouvelle ligne ». La rédaction est inquiète.`,
        choices: [
          c('motion', 'Signer la motion de défiance de la rédaction', [{ kind: 'press', ligne: shift, independance: 12, reputation: 4 }], 'La rédaction fait bloc : le nouveau patron recule un peu.', {
            risk: { baseChance: 0.3, onFailure: [{ kind: 'press', audience: -6, salaryPct: -15 }], failureNews: 'Le nouveau patron vous retire votre case horaire.' },
          }),
          c('accompagner', 'Accompagner la nouvelle direction', [{ kind: 'press', ligne: shift, independance: -12, salaryPct: 15 }], 'Promotion en vue… mais vos confrères vous regardent de travers.'),
          c('neutre', 'Se tenir à l’écart', [{ kind: 'press', ligne: shift }], 'Vous attendez de voir.'),
        ],
      };
    },
  },
  {
    tag: 'source_menacee', weight: 1,
    eligible: d => !!d.press && d.press.scoops > 0,
    build: () => ({
      title: 'Votre source est menacée',
      context: 'La police veut connaître l’origine de vos révélations. Votre source risque sa carrière.',
      choices: [
        c('proteger', 'Protéger le secret des sources, quoi qu’il en coûte', [{ kind: 'press', reputation: 6, independance: 4 }, s('stress', 6)], 'Les journalistes du pays entier vous soutiennent.'),
        c('negocier', 'Négocier avec les enquêteurs', [{ kind: 'press', reputation: -3 }, s('influence', 2)], 'Un compromis flou.'),
        c('lacher', 'Livrer son nom', [{ kind: 'press', reputation: -15, scoops: -1 }, s('influence', 3)], 'Plus aucune source ne vous parlera.'),
      ],
    }),
  },
  {
    tag: 'audience_record', weight: 1,
    eligible: d => !!d.press && d.press.audience >= 35,
    build: () => ({
      title: 'Audience record',
      context: 'Votre dernière intervention est la plus vue de la saison. La direction est aux anges.',
      choices: [
        c('augmentation', 'Demander une augmentation', [{ kind: 'press', salaryPct: 20, independance: -2 }], 'Accordée, sans discuter.'),
        c('carte_blanche', 'Demander carte blanche sur vos sujets', [{ kind: 'press', independance: 10, reputation: 2 }], 'Vous choisirez désormais vos sujets.'),
        c('equipe', 'Mettre l’équipe en avant', [{ kind: 'press', reputation: 3 }, s('stress', -3)], 'L’équipe vous adore.'),
      ],
    }),
  },
  {
    tag: 'clash_direct', weight: 1,
    eligible: d => !!d.press,
    build: () => ({
      title: 'Insulté·e en direct',
      context: 'Un invité furieux vous traite de « chien de garde » à l’antenne.',
      choices: [
        c('repondre', 'Répliquer du tac au tac', [{ kind: 'press', audience: 6, reputation: -2 }], 'L’extrait fait le tour des réseaux.'),
        c('calme', 'Garder son calme et reprendre l’interview', [{ kind: 'press', reputation: 4 }], 'Votre sang-froid est salué.'),
        c('couper', 'Mettre fin à l’interview', [{ kind: 'press', audience: 2, independance: 2 }], 'L’invité quitte le plateau sous les huées.'),
      ],
    }),
  },
  {
    tag: 'fausse_info', weight: 1,
    eligible: d => !!d.press,
    build: () => ({
      title: 'Vous avez relayé une fausse information',
      context: 'Une rumeur reprise un peu vite dans votre chronique s’avère totalement fausse.',
      choices: [
        c('rectifier', 'Rectifier en tête de chronique', [{ kind: 'press', reputation: -2 }], 'L’honnêteté limite les dégâts.'),
        c('maintenir', 'Maintenir : « On ne m’a pas encore prouvé le contraire »', [{ kind: 'press', audience: 3 }], 'Vos fidèles vous suivent.', {
          risk: { baseChance: 0.55, onFailure: [{ kind: 'press', reputation: -12 }], failureNews: 'Un démenti officiel, preuves à l’appui. Votre crédibilité s’effondre.' },
        }),
        c('silence', 'Ne rien dire', [{ kind: 'press', reputation: -5 }], 'D’autres s’en chargent pour vous.'),
      ],
    }),
  },
  {
    tag: 'prix_journalisme', weight: 1,
    eligible: d => !!d.press && d.press.scoops >= 2,
    build: () => ({
      title: 'Un grand prix de journalisme',
      context: 'Le jury salue « une enquête d’intérêt public ». La cérémonie est retransmise.',
      choices: [
        c('discours', 'Un discours engagé sur la liberté de la presse', [{ kind: 'press', reputation: 8, independance: 6 }, s('popularity', 2)], 'Ovation debout.'),
        c('sobre', 'Remercier sobrement', [{ kind: 'press', reputation: 6 }], 'Élégant.'),
      ],
    }),
  },
  {
    tag: 'mercato', weight: 1,
    eligible: d => !!d.press && d.press.grade >= 1,
    build: d => ({
      title: 'Un concurrent veut vous débaucher',
      context: `Un média rival vous offre 40 % de plus pour quitter ${d.press!.outlet}.`,
      choices: [
        c('negocier', 'Utiliser l’offre pour renégocier', [{ kind: 'press', salaryPct: 25, independance: -2 }], 'Votre direction s’aligne.', {
          risk: { baseChance: 0.25, onFailure: [{ kind: 'press', independance: -8 }], failureNews: 'Votre direction n’apprécie pas le chantage.' },
        }),
        c('fidele', 'Rester fidèle', [{ kind: 'press', independance: 5, reputation: 2 }], 'La rédaction apprécie votre loyauté.'),
      ],
    }),
  },
  {
    tag: 'double_casquette', weight: 1.6, minRank: 'depute',
    eligible: d => !!d.press && d.scenario !== 'editorialiste',
    build: d => ({
      title: 'Élu·e et chroniqueur·se : ça coince',
      context: `Le régulateur de l’audiovisuel s’interroge sur votre double casquette à ${d.press!.outlet}. Vos adversaires parlent de « propagande ».`,
      choices: [
        c('quitter', 'Renoncer à votre chronique', [{ kind: 'leavePress' }, s('credibility', 3)], 'Vous vous consacrez à votre mandat.'),
        c('garder', 'Garder votre chronique', [s('credibility', -3), { kind: 'exposure', delta: 5 }], 'La polémique enfle.'),
        c('temps', 'Accepter un décompte de temps de parole', [{ kind: 'press', audience: -6 }, s('credibility', 1)], 'Un compromis réglementaire.'),
      ],
    }),
  },

  // ── Fonder son parti ──────────────────────────────────────────
  {
    tag: 'dissidents', weight: 1.4, minRank: 'conseiller_municipal',
    eligible: d => !d.party.founder && d.scenario !== 'royaute' && d.week > 5 && !d.player.flags['foundOffer'],
    build: d => ({
      title: 'Des militants veulent vous suivre',
      context: `Une centaine de cadres ${ofParty(d.party.name)}, déçus par la direction, vous proposent de fonder un nouveau mouvement. Ils prendraient les frais en charge.`,
      choices: [
        c('ecouter', 'Les écouter : préparer la rupture', [{ kind: 'flag', key: 'foundOffer', value: true }, s('influence', 2)], 'Le bouton « fonder votre parti » vous attend dans le panneau du parti.'),
        c('refuser', 'Refuser : on change le parti de l’intérieur', [{ kind: 'faction', factionId: '*', delta: 4 }, { kind: 'cohesion', delta: 2 }], 'La direction apprend votre loyauté.'),
        c('peser', 'S’en servir pour peser face à la direction', [s('politicalCapital', 8), { kind: 'faction', factionId: '*', delta: -2 }], 'La menace fait son effet… et des jaloux.'),
      ],
    }),
  },
  {
    tag: 'caisse_vide', weight: 1.5,
    eligible: d => !!d.party.founder && (d.partyFinance?.treasury ?? 0) < 25,
    build: () => ({
      title: 'Les caisses de votre jeune parti sont vides',
      context: 'Le trésorier vous montre les comptes : de quoi tenir un mois, pas plus.',
      choices: [
        c('donateur', 'Accepter le chèque d’un riche donateur', [{ kind: 'partyTreasury', delta: 40 }, { kind: 'exposure', delta: 5 }], 'Il vous rappellera ce service.'),
        c('perso', 'Prêter 10 000 € de votre poche', [{ kind: 'funds', account: 'personal', delta: -10000 }, { kind: 'partyTreasury', delta: 10 }, { kind: 'cohesion', delta: 3 }], 'Les militants saluent votre engagement.', { needMoney: 10000 }),
        c('militants', 'Lancer un appel aux petits dons', [{ kind: 'partyTreasury', delta: 8 }, { kind: 'momentum', delta: 3 }], 'Des milliers de dons de 10 €.'),
      ],
    }),
  },
  {
    tag: 'ralliement_elu', weight: 1.2,
    eligible: d => !!d.party.founder,
    build: () => ({
      title: 'Un élu sortant veut rejoindre votre mouvement',
      context: 'Un député expérimenté quitte son groupe pour vous rejoindre. Il apporte son réseau… et quelques casseroles.',
      choices: [
        c('accueillir', 'L’accueillir en grande pompe', [s('influence', 4), { kind: 'partyTreasury', delta: 5 }, { kind: 'exposure', delta: 3 }, { kind: 'cohesion', delta: -2 }], 'Votre parti gagne en crédibilité institutionnelle.'),
        c('refuser', 'Refuser : « On ne recycle pas »', [s('credibility', 2), { kind: 'faction', factionId: '*', delta: 3 }], 'Vos militants adorent.'),
      ],
    }),
  },

  // ── Toujours plus d’imprévus ─────────────────────────────────
  {
    tag: 'tempete', weight: 0.9,
    build: () => ({
      title: 'Une tempête dévaste la région',
      context: 'Toitures arrachées, routes coupées, des milliers de foyers sans électricité.',
      choices: [
        c('terrain', 'Passer trois jours sur le terrain', [s('energy', -12), s('popularity', 4), { kind: 'dossier', domain: 'territoires', delta: 3 }], 'Bottes aux pieds, vous êtes partout.'),
        c('fonds', 'Créer une cagnotte d’urgence (2 000 € de votre poche)', [{ kind: 'funds', account: 'personal', delta: -2000 }, s('popularity', 3)], 'La cagnotte dépasse 200 000 €.', { needMoney: 2000 }),
        c('etat', 'Exiger l’état de catastrophe naturelle', [s('credibility', 2), { kind: 'contact', contactId: 'ct-maires', trust: 6 }], 'Le gouvernement s’exécute.'),
      ],
    }),
  },
  {
    tag: 'lettre_citoyenne', weight: 0.9,
    build: () => ({
      title: 'Une lettre bouleversante',
      context: 'Une mère isolée raconte son combat pour scolariser son fils handicapé. Elle vous écrit en dernier recours.',
      choices: [
        c('aider', 'L’appeler et débloquer la situation', [s('popularity', 2), s('energy', -5), { kind: 'dossier', domain: 'education', delta: 2 }], 'Son fils fera sa rentrée.'),
        c('loi', 'En faire le point de départ d’une proposition de loi', [s('credibility', 3), { kind: 'dossier', domain: 'social', delta: 4 }], 'Votre texte est cosigné par cinquante élus.', { needRank: 'depute' }),
        c('service', 'Transmettre à vos services', [], 'Un courrier type part dans la semaine.'),
      ],
    }),
  },
  {
    tag: 'mauvais_compte', weight: 0.8,
    build: () => ({
      title: 'Publié depuis le mauvais compte',
      context: 'Un message privé très franc sur un collègue part sur votre compte officiel. Il reste en ligne quatre minutes.',
      choices: [
        c('humour', 'En rire : « Mes doigts sont plus francs que moi »', [s('popularity', 2), { kind: 'faction', factionId: '*', delta: -2 }], 'L’humour sauve la mise.'),
        c('pirate', 'Parler d’un piratage', [{ kind: 'exposure', delta: 4 }], 'Personne n’y croit vraiment.', {
          risk: { baseChance: 0.4, onFailure: [s('credibility', -4)], failureNews: 'Les métadonnées prouvent que c’était bien vous.' },
        }),
        c('excuses', 'Appeler le collègue et s’excuser', [s('stress', 3)], 'Il accepte vos excuses, du bout des lèvres.'),
      ],
    }),
  },
  {
    tag: 'cantine', weight: 0.8,
    build: () => ({
      title: 'Bataille autour de la cantine',
      context: 'Les parents d’élèves réclament 100 % de bio et local à la cantine. Le coût double.',
      choices: [
        c('pour', 'Soutenir les parents', [s('popularity', 2), { kind: 'stance', delta: -2 }, { kind: 'dossier', domain: 'education', delta: 2 }], 'Les parents vous applaudissent.'),
        c('progressif', 'Proposer une transition sur trois ans', [s('credibility', 2), { kind: 'dossier', domain: 'ecologie', delta: 2 }], 'Un compromis apprécié.'),
        c('contre', 'Défendre le budget de la commune', [s('popularity', -1), { kind: 'stance', delta: 2 }], 'Les contribuables vous remercient.'),
      ],
    }),
  },
  {
    tag: 'faille_site', weight: 0.7,
    build: () => ({
      title: 'Une faille dans le site de votre campagne',
      context: 'Un chercheur en sécurité vous signale que les données de vos sympathisants sont accessibles.',
      choices: [
        c('corriger', 'Corriger et informer les sympathisants (2 500 €)', [{ kind: 'funds', account: 'personal', delta: -2500 }, s('credibility', 2)], 'Transparence saluée.'),
        c('discret', 'Corriger discrètement', [{ kind: 'exposure', delta: 4 }], 'Personne n’en saura rien… normalement.'),
        c('ignorer', 'Ignorer l’alerte', [], 'Le chercheur publie sa découverte.', {
          risk: { baseChance: 0.6, onFailure: [s('credibility', -5), { kind: 'exposure', delta: 8 }], failureNews: 'Les données de 12 000 sympathisants fuitent.' },
        }),
      ],
    }),
  },
  {
    tag: 'tele_realite', weight: 0.6,
    build: () => ({
      title: 'Une émission de télé-réalité vous veut',
      context: '« Élus en immersion » : une semaine dans la peau d’un ouvrier, caméras vingt-quatre heures sur vingt-quatre.',
      choices: [
        c('accepter', 'Accepter', [s('popularity', 5), s('credibility', -4), s('energy', -15)], 'Vos larmes à l’usine émeuvent le pays.', {
          risk: { baseChance: 0.3, onFailure: [s('popularity', -5)], failureNews: 'Le montage vous montre sous un jour désastreux.' },
        }),
        c('refuser', 'Refuser', [s('credibility', 1)], 'Votre dignité est intacte.'),
      ],
    }),
  },
  {
    tag: 'amphi', weight: 0.8,
    build: () => ({
      title: 'Chahut à l’université',
      context: 'Votre conférence dans un amphithéâtre est interrompue par des étudiants qui vous huent.',
      choices: [
        c('dialoguer', 'Proposer de débattre avec eux', [s('popularity', 3)], 'Le débat s’engage, l’amphi applaudit.', {
          risk: { baseChance: 0.4, scaleWith: 'credibility', scaleWeight: 0.6, onFailure: [s('popularity', -3), s('stress', 5)], failureNews: 'Le chahut tourne à l’humiliation filmée.' },
        }),
        c('partir', 'Quitter la salle', [s('popularity', -2)], 'Les images de votre départ circulent.'),
      ],
    }),
  },
  {
    tag: 'marathon', weight: 0.7,
    build: () => ({
      title: 'Courir un marathon pour une association',
      context: 'Une association de lutte contre une maladie rare vous propose de courir à ses couleurs.',
      choices: [
        c('courir', 'Relever le défi', [s('popularity', 3), s('energy', -15), s('stress', -6)], 'Arrivée en 4 h 12, médaille au cou.'),
        c('don', 'Faire un don à la place', [{ kind: 'funds', account: 'personal', delta: -500 }, s('popularity', 1)], 'Merci pour eux.'),
      ],
    }),
  },

  // ── Infiltration ─────────────────────────────────────────────
  {
    tag: 'mole_amitie', weight: 1,
    eligible: d => !!d.mole,
    build: (d, rng) => {
      const friend = rng.pick(d.npcs.filter(n => n.partyId === d.party.id && n.id !== d.party.leaderNpcId)) ?? d.npcs[0];
      return {
        title: 'Une amitié sincère',
        context: `${friend.name} vous a pris·e sous son aile. Ce soir, il vous confie ses doutes sur la direction… et des secrets.`,
        choices: [
          c('exploiter', 'Tout noter pour votre rapport', [{ kind: 'mole', intel: 12 }, s('stress', 7)], 'Le rapport sera bon. Le miroir, moins.'),
          c('proteger', 'Le protéger : ne rien transmettre', [{ kind: 'mole', cover: 6, handler: -6 }, { kind: 'npcRelation', npcId: friend.id, delta: 15 }, s('stress', -2)], 'Vous gardez son secret.'),
        ],
      };
    },
  },
  {
    tag: 'mole_test', weight: 1,
    eligible: d => !!d.mole,
    build: d => ({
      title: 'Un test de loyauté',
      context: `On vous demande de mener un tractage contre ${d.mole!.homeName}… votre propre camp.`,
      choices: [
        c('faire', 'Le faire, avec conviction', [{ kind: 'mole', cover: 12, handler: -8 }, s('stress', 6)], 'Vos « camarades » vous adoptent définitivement.'),
        c('maladie', 'Se faire porter malade', [{ kind: 'mole', cover: -8 }], 'Un certificat médical bien pratique… et remarqué.'),
        c('saboter', 'Y aller et saboter discrètement', [{ kind: 'mole', cover: 4, sabotage: 4 }], 'Les tracts finissent dans une benne.', {
          risk: { baseChance: 0.35, onFailure: [{ kind: 'mole', cover: -18 }], failureNews: 'Un militant vous voit jeter les tracts.' },
        }),
      ],
    }),
  },
  {
    tag: 'mole_contre', weight: 0.8,
    eligible: d => !!d.mole,
    build: d => ({
      title: 'Contre-espionnage',
      context: `Dans un courriel interne, vous découvrez que le parti a lui aussi une taupe… chez ${d.mole!.homeName}.`,
      choices: [
        c('alerter', `Alerter ${d.mole!.handler}`, [{ kind: 'mole', handler: 14, intel: 6, cover: -4 }], 'Votre camp démasque la taupe adverse.'),
        c('exploiter', 'Garder l’info pour plus tard', [{ kind: 'mole', intel: 4 }], 'Une carte dans votre manche.'),
      ],
    }),
  },
  {
    tag: 'mole_photo', weight: 0.8,
    eligible: d => !!d.mole,
    build: d => ({
      title: 'Une photo compromettante',
      context: `Une photo de vous en compagnie de ${d.mole!.handler} circule dans une boucle de militants.`,
      choices: [
        c('cousin', '« C’est ma cousine »', [{ kind: 'mole', cover: -4 }], 'L’explication passe.', {
          risk: { baseChance: 0.4, onFailure: [{ kind: 'mole', cover: -18 }], failureNews: 'Quelqu’un reconnaît la responsable de votre vrai camp.' },
        }),
        c('racheter', 'Racheter la photo au militant (2 000 €)', [{ kind: 'funds', account: 'personal', delta: -2000 }, { kind: 'mole', cover: 2 }], 'La photo disparaît.', { needMoney: 2000 }),
        c('assumer', 'Dire que vous l’espionniez, elle', [{ kind: 'mole', cover: 8, handler: -12 }], 'Retournement audacieux. Votre officier n’apprécie pas.'),
      ],
    }),
  },
  {
    tag: 'mole_responsabilite', weight: 0.8,
    eligible: d => !!d.mole,
    build: d => ({
      title: 'Une responsabilité dans le parti',
      context: `${d.party.name} vous propose de devenir secrétaire de section : plus d’accès, plus de regards.`,
      choices: [
        c('accepter', 'Accepter', [{ kind: 'mole', cover: 10, intel: 6 }, s('influence', 3), s('stress', 5)], 'Vous avez désormais les clés du local.'),
        c('decliner', 'Décliner modestement', [{ kind: 'mole', cover: -3 }], 'On s’étonne de votre manque d’ambition.'),
      ],
    }),
  },

  // ── Nouvelle fournée d’imprévus ───────────────────────────────
  {
    tag: 'stagiaire', weight: 0.9,
    build: () => ({
      title: 'Votre stagiaire a tweeté à votre place',
      context: 'Il avait les codes du compte. Son message, très drôle, est aussi très insultant pour un ministre.',
      choices: [
        c('assumer', 'Assumer le tweet', [s('popularity', 3), s('credibility', -4), { kind: 'exposure', delta: 4 }], 'Les réseaux adorent, le gouvernement beaucoup moins.'),
        c('supprimer', 'Supprimer et s’excuser', [s('credibility', 1), s('popularity', -2), s('stress', 3)], 'Le tweet survit en capture d’écran.'),
        c('stagiaire', 'Accuser publiquement le stagiaire', [s('popularity', -4), s('stress', 2)], 'Tout le monde trouve ça lâche.'),
      ],
    }),
  },
  {
    tag: 'appel_nuit', weight: 0.8, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Un appel à 3 h du matin',
      context: 'Un incendie ravage un immeuble de votre quartier. Trente familles sont à la rue.',
      choices: [
        c('y_aller', 'Y aller immédiatement', [s('popularity', 4), s('energy', -15), s('stress', 5)], 'Vous êtes là avant les caméras. Les habitants s’en souviendront.'),
        c('gymnase', 'Faire ouvrir un gymnase par téléphone', [s('credibility', 2), s('stress', 3), s('energy', -5)], 'Les familles dorment au chaud. On ne vous voit pas, mais c’est fait.'),
        c('matin', 'Attendre le matin', [s('energy', 5), s('popularity', -4)], 'Un journaliste note votre absence.'),
      ],
    }),
  },
  {
    tag: 'invitation_etrangere', weight: 0.7, minRank: 'depute',
    build: () => ({
      title: 'Un voyage officiel tous frais payés',
      context: 'Un régime autoritaire étranger vous invite à « observer » ses élections. Hôtel cinq étoiles compris.',
      choices: [
        c('refuser', 'Refuser poliment', [s('credibility', 2), { kind: 'dossier', domain: 'diplomatie', delta: 1 }, s('influence', -1)], 'Les ONG saluent votre prudence.'),
        c('accepter', 'Accepter', [s('influence', 3), { kind: 'dossier', domain: 'diplomatie', delta: 4 }, s('credibility', -6), { kind: 'exposure', delta: 8 }], 'Vous voilà en photo avec un dictateur.'),
        c('denoncer', 'Dénoncer publiquement l’invitation', [s('popularity', 2), s('credibility', 1), { kind: 'dossier', domain: 'diplomatie', delta: 2 }, s('stress', 3)], 'L’ambassade proteste officiellement.'),
      ],
    }),
  },
  {
    tag: 'petition', weight: 0.9,
    build: () => ({
      title: 'Une pétition à 100 000 signatures',
      context: 'Elle réclame la réouverture d’une ligne de bus supprimée. On vous demande de la porter.',
      choices: [
        c('porter', 'Porter la pétition jusqu’au ministère', [s('popularity', 4), { kind: 'dossier', domain: 'territoires', delta: 3 }, s('energy', -10), { kind: 'faction', factionId: 'reformistes', delta: -2 }], 'La photo devant le ministère fait le tour du département.'),
        c('signer', 'La signer, sans plus', [s('popularity', 1), s('credibility', -1)], 'Un soutien de façade, remarque la presse.'),
        c('critiquer', 'Expliquer pourquoi la ligne coûtait trop cher', [s('credibility', 3), s('popularity', -4)], 'Un discours de vérité, mal reçu.'),
      ],
    }),
  },
  {
    tag: 'fuite_sondage', weight: 0.8,
    build: () => ({
      title: 'Un sondage interne vous donne perdant',
      context: 'Le parti a commandé une étude confidentielle : vous seriez le pire candidat possible. Elle fuite.',
      choices: [
        c('rire', 'En rire publiquement', [s('popularity', 2), s('stress', 4), { kind: 'faction', factionId: '*', delta: -1 }], 'L’autodérision fait mouche.'),
        c('enquete', 'Exiger de savoir qui l’a commandée', [s('politicalCapital', 6), { kind: 'faction', factionId: '*', delta: -4 }, s('stress', 3)], 'Une enquête interne s’ouvre. Des têtes tombent.'),
        c('travailler', 'Se taire et redoubler d’efforts', [s('stress', 6), s('energy', -6), s('credibility', 1)], 'Vous serrez les dents.'),
      ],
    }),
  },
  {
    tag: 'chantier', weight: 0.8, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Un chantier qui n’en finit pas',
      context: 'Les travaux de la place centrale ont deux ans de retard. Les commerçants manifestent.',
      choices: [
        c('penalites', 'Exiger des pénalités au constructeur', [s('credibility', 2), { kind: 'contact', contactId: 'ct-btp', trust: -8 }, s('stress', 3)], 'Le constructeur menace d’arrêter le chantier.'),
        c('indemniser', 'Indemniser les commerçants', [s('popularity', 3), { kind: 'exposure', delta: 3 }, s('credibility', -1)], 'Les commerçants respirent, la Cour des comptes tique.'),
        c('defendre', 'Défendre le projet', [s('popularity', -3), { kind: 'dossier', domain: 'territoires', delta: 2 }], 'Vous promettent un résultat magnifique. Personne ne vous croit.'),
      ],
    }),
  },
  {
    tag: 'expert_conteste', weight: 0.7,
    build: d => ({
      title: 'Un prix Nobel vous contredit',
      context: `Un économiste de renom juge votre position sur ${d.agendaDomain === 'economie' ? 'l’économie' : 'le sujet du moment'} « naïve et dangereuse ».`,
      choices: [
        c('debattre', 'Proposer un débat public', [{ kind: 'debate', stakes: 'face_a_face' }], 'Le duel est fixé à la fin du mois.'),
        c('reconnaitre', 'Reconnaître une part de vérité', [s('credibility', 2), s('popularity', -2), { kind: 'stance', delta: 0 }], 'L’humilité surprend.'),
        c('ignorer', 'L’ignorer', [s('credibility', -3)], 'Son avis tourne en boucle.'),
      ],
    }),
  },
  {
    tag: 'perte_dossier', weight: 0.6,
    build: () => ({
      title: 'Un dossier oublié dans le train',
      context: 'Vos notes confidentielles sur la stratégie du parti ont disparu dans un TGV.',
      choices: [
        c('annonce', 'Lancer un appel public', [{ kind: 'exposure', delta: 6 }, s('popularity', 1)], 'Un voyageur honnête vous le rapporte… après l’avoir lu.'),
        c('silence', 'Ne rien dire et prier', [s('stress', 8)], 'Personne ne le retrouve. Pour l’instant.', {
          risk: { baseChance: 0.35, onFailure: [{ kind: 'exposure', delta: 12 }, { kind: 'faction', factionId: '*', delta: -5 }], failureNews: 'Le dossier atterrit chez un journaliste.' },
        }),
        c('prevenir', 'Prévenir la direction du parti', [{ kind: 'faction', factionId: '*', delta: -3 }, s('credibility', 1)], 'On vous en veut, mais on apprécie votre honnêteté.'),
      ],
    }),
  },
  {
    tag: 'ancien_mentor', weight: 0.7, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Votre ancien mentor est mis en examen',
      context: 'Celui qui vous a fait entrer en politique est soupçonné de corruption. Les journalistes attendent votre réaction.',
      choices: [
        c('soutenir', 'Lui apporter votre soutien', [s('credibility', -4), { kind: 'faction', factionId: 'ligne_dure', delta: 4 }, { kind: 'exposure', delta: 4 }], 'La fidélité, ça se paie.'),
        c('distance', 'Prendre vos distances', [s('credibility', 2), { kind: 'faction', factionId: 'ligne_dure', delta: -4 }, s('stress', 4)], 'Il ne vous le pardonnera jamais.'),
        c('justice', '« Laissons la justice faire son travail »', [s('popularity', -1), s('credibility', 1)], 'La formule consacrée, sans éclat.'),
      ],
    }),
  },
  {
    tag: 'jeunes_militants', weight: 0.8,
    build: () => ({
      title: 'Les jeunes du parti se rebellent',
      context: 'Ils publient une tribune : « Nos aînés ne comprennent rien au climat ni au numérique. »',
      choices: [
        c('soutenir', 'Les soutenir publiquement', [{ kind: 'faction', factionId: 'reformistes', delta: 6 }, { kind: 'faction', factionId: 'ligne_dure', delta: -5 }, s('popularity', 2)], 'La jeunesse vous adore, les anciens beaucoup moins.'),
        c('recadrer', 'Les recadrer', [{ kind: 'faction', factionId: 'ligne_dure', delta: 4 }, { kind: 'faction', factionId: 'reformistes', delta: -5 }, s('popularity', -1)], 'L’ordre règne. La relève s’en va.'),
        c('dialogue', 'Organiser un dialogue', [{ kind: 'cohesion', delta: 3 }, s('energy', -8), s('stress', 3)], 'Une soirée tendue, mais utile.'),
      ],
    }),
  },
  {
    tag: 'greve_faim', weight: 0.6, minRank: 'depute',
    build: () => ({
      title: 'Un salarié licencié s’installe devant votre permanence',
      context: 'Il réclame votre aide pour retrouver son emploi et refuse de partir.',
      choices: [
        c('recevoir', 'Le recevoir et appeler son ancien employeur', [s('popularity', 3), s('energy', -6), { kind: 'contact', contactId: 'ct-btp', trust: -4 }], 'Son employeur accepte de le recevoir.'),
        c('mediation', 'Lancer une médiation', [{ kind: 'scene', sceneId: 'mediation' }], 'La négociation commence en fin de mois.'),
        c('police', 'Faire évacuer le trottoir', [s('popularity', -5), s('stress', 2)], 'Les images de l’évacuation tournent en boucle.'),
      ],
    }),
  },
  {
    tag: 'canular', weight: 0.7,
    build: () => ({
      title: 'Piégé·e par un canular téléphonique',
      context: 'Un humoriste se faisant passer pour un chef d’État vous a fait dire des énormités. L’enregistrement sort ce soir.',
      choices: [
        c('rire', 'En rire avec lui en direct', [s('popularity', 3), s('credibility', -3)], 'Vous montrez que vous savez perdre.'),
        c('juridique', 'Menacer de poursuites', [s('popularity', -3), s('stress', 4), { kind: 'funds', account: 'personal', delta: -1500 }], 'L’effet Streisand est immédiat.'),
        c('silence', 'Ne pas commenter', [s('credibility', -2), s('popularity', -1)], 'Les extraits tournent sans réponse.'),
      ],
    }),
  },
];

/** Événements sans choix : ils tombent dans le fil d'actualité */
const NEWS_EVENTS: { title: string; body: string; effects: Effect[]; tone: 'positive' | 'negative' | 'neutral' }[] = [
  { title: 'Votre affiche détournée en mème', body: 'L’internet s’amuse de votre slogan. Bonne ou mauvaise publicité ?', effects: [s('popularity', 2), s('credibility', -1)], tone: 'neutral' },
  { title: 'Un portrait flatteur dans un quotidien national', body: '« L’étoile montante que personne n’a vue venir. »', effects: [s('credibility', 2), s('influence', 1)], tone: 'positive' },
  { title: 'Votre permanence taguée', body: 'Des inscriptions hostiles sur la vitrine. Les messages de soutien affluent.', effects: [s('popularity', 2), s('stress', 4)], tone: 'negative' },
  { title: 'Un livre-enquête vous égratigne', body: 'Un chapitre entier sur vos ambitions. Rien d’illégal, rien de flatteur.', effects: [s('credibility', -2), { kind: 'exposure', delta: 3 }], tone: 'negative' },
  { title: 'Une vieille photo de vous jeune militant·e', body: 'Cheveux longs, pancarte à la main : l’internet est attendri.', effects: [s('popularity', 2)], tone: 'positive' },
  { title: 'Panne géante d’électricité', body: 'Votre mois est perturbé.', effects: [s('energy', -8)], tone: 'neutral' },
  { title: 'Un ancien professeur raconte vos années d’études', body: '« Déjà brillant·e, déjà insupportable. »', effects: [s('popularity', 1), s('credibility', 1)], tone: 'positive' },
  { title: 'Rumeur de remaniement… sans vous', body: 'Votre nom ne figure sur aucune liste. On vous dit en perte de vitesse.', effects: [s('influence', -2), s('stress', 3)], tone: 'negative' },
  { title: 'Un rond-point baptisé à votre nom… par erreur', body: 'La mairie voulait honorer un homonyme décédé. La plaque est retirée dans l’hilarité.', effects: [s('popularity', 1)], tone: 'neutral' },
  { title: 'Lettre de menaces anonyme', body: 'Une plainte est déposée. Les témoignages de solidarité affluent.', effects: [s('stress', 6), s('popularity', 1)], tone: 'negative' },
  { title: 'Votre équipe de rugby locale championne', body: 'Vous étiez en tribune : la photo de votre joie fait le tour de la région.', effects: [s('popularity', 2), s('stress', -3)], tone: 'positive' },
  { title: 'Une coquille dans votre tract', body: '« Pour une France plus injuste ». 20 000 exemplaires à réimprimer.', effects: [{ kind: 'funds', account: 'personal', delta: -400 }, s('popularity', -1)], tone: 'negative' },
  { title: 'Un éditorialiste vous prédit un destin national', body: '« Retenez ce nom. »', effects: [s('influence', 2)], tone: 'positive' },
  { title: 'Votre compte suspendu par erreur', body: 'Pendant 48 heures, vous disparaissez des réseaux. Un algorithme vous a pris pour un robot.', effects: [s('influence', -1), s('stress', 3)], tone: 'negative' },
  { title: 'Un sosie dans une publicité pour du fromage', body: 'La ressemblance est troublante. Les ventes s’envolent.', effects: [s('popularity', 1)], tone: 'neutral' },
  { title: 'Votre ancienne prof de philo vous cite en cours', body: 'Comme contre-exemple. L’extrait fuite.', effects: [s('credibility', -1)], tone: 'negative' },
  { title: 'Une association vous décerne un prix', body: '« Élu·e le plus accessible de l’année ».', effects: [s('popularity', 2), s('credibility', 1)], tone: 'positive' },
  { title: 'Grippe carabinée', body: 'Trois jours au lit, agenda vidé.', effects: [s('energy', -12)], tone: 'negative' },
  { title: 'Classé·e parmi les élus les plus assidus', body: 'Un observatoire indépendant salue votre présence en séance.', effects: [s('credibility', 1)], tone: 'positive' },
  { title: 'Un restaurant baptise un plat à votre nom', body: 'Le « parmentier de la République » fait un carton.', effects: [s('popularity', 1)], tone: 'positive' },
  { title: 'Hausse des marchés', body: 'La Bourse gagne 6 % sur le mois.', effects: [{ kind: 'assetValue', defIds: ['actions'], factor: 1.06 }], tone: 'neutral' },
  { title: 'Flambée de l’immobilier', body: 'Les prix grimpent dans toutes les grandes villes.', effects: [{ kind: 'assetValue', defIds: ['studio', 'locatif', 'maison', 'villa'], factor: 1.04 }], tone: 'neutral' },
  { title: 'Chute des cryptomonnaies', body: 'Un grand exchange fait faillite. Les cours plongent.', effects: [{ kind: 'assetValue', defIds: ['crypto'], factor: 0.7 }], tone: 'negative' },
  { title: 'Une cote d’artiste qui s’envole', body: 'Une grande rétrospective dope le marché de l’art contemporain.', effects: [{ kind: 'assetValue', defIds: ['art'], factor: 1.25 }], tone: 'neutral' },
  { title: 'Votre vélo volé devant la mairie', body: 'L’histoire attendrit les réseaux.', effects: [s('popularity', 1), s('stress', 2)], tone: 'neutral' },
  { title: 'Tempête sur la côte', body: 'Des dégâts dans de nombreuses résidences secondaires.', effects: [{ kind: 'assetValue', defIds: ['villa', 'yacht'], factor: 0.92 }], tone: 'negative' },
  { title: 'Les chaînes d’info battent des records', body: 'L’actualité politique passionne : les audiences grimpent.', effects: [{ kind: 'press', audience: 3 }], tone: 'neutral' },
  { title: 'Grève dans les rédactions', body: 'Les journalistes dénoncent la concentration des médias.', effects: [{ kind: 'press', independance: 3 }], tone: 'neutral' },
  { title: 'Un baromètre vous classe parmi les plus influents', body: 'Une progression remarquée dans le classement annuel.', effects: [s('influence', 2)], tone: 'positive' },
  { title: 'Un sondage sur les nouveaux partis', body: 'Un Français sur trois se dit prêt à voter pour un parti récent.', effects: [s('popularity', 1)], tone: 'neutral' },
  { title: 'Votre portrait dessiné par un caricaturiste', body: 'Le nez un peu grand, mais on vous reconnaît.', effects: [s('popularity', 1)], tone: 'neutral' },
  { title: 'Embouteillage géant', body: 'Trois heures de bouchons pour rejoindre votre circonscription.', effects: [s('stress', 3), s('energy', -4)], tone: 'negative' },
  { title: 'Votre permanence cambriolée', body: 'Ordinateurs volés, dossiers éparpillés. La police enquête.', effects: [s('stress', 5), { kind: 'funds', account: 'personal', delta: -800 }], tone: 'negative' },
  { title: 'Un mème vous rend sympathique', body: 'Votre grimace pendant un discours est partagée un million de fois.', effects: [s('popularity', 2), s('credibility', -1)], tone: 'neutral' },
  { title: 'Votre taux de présence épinglé', body: 'Un site citoyen vous classe parmi les élus les moins présents.', effects: [s('credibility', -2), s('popularity', -1)], tone: 'negative' },
  { title: 'Une biographie non autorisée', body: '300 pages, quelques erreurs, beaucoup d’anecdotes.', effects: [s('popularity', 1), { kind: 'exposure', delta: 3 }], tone: 'neutral' },
  { title: 'Hausse des taux d’intérêt', body: 'Les crédits coûtent plus cher, l’immobilier ralentit.', effects: [{ kind: 'assetValue', defIds: ['studio', 'locatif', 'maison', 'villa'], factor: 0.96 }], tone: 'negative' },
  { title: 'Sommet européen à Bruxelles', body: 'Une nuit de négociations sur le budget de l’Union. La France obtient gain de cause sur la PAC.', effects: [{ kind: 'intl', partner: 'ue', relation: 2 }], tone: 'neutral' },
  { title: 'Visite d’État du président américain', body: 'Défilé, dîner à Versailles, déclarations sur l’amitié transatlantique.', effects: [{ kind: 'intl', partner: 'etats_unis', relation: 3 }], tone: 'neutral' },
  { title: 'Tensions en mer de Chine', body: 'Des incidents navals inquiètent les chancelleries.', effects: [{ kind: 'intl', tension: 4 }], tone: 'negative' },
  { title: 'Accord de libre-échange contesté', body: 'Les agriculteurs bloquent des autoroutes contre un traité avec l’Amérique du Sud.', effects: [{ kind: 'intl', partner: 'ue', relation: -2 }, s('stress', 2)], tone: 'negative' },
  { title: 'La France élue au Conseil des droits de l’homme', body: 'Un succès diplomatique discret.', effects: [{ kind: 'intl', prestige: 2 }], tone: 'positive' },
  { title: 'Le Salon du Bourget bat des records', body: 'Des commandes d’avions historiques pour l’industrie française.', effects: [{ kind: 'intl', prestige: 1 }, { kind: 'assetValue', defIds: ['actions'], factor: 1.02 }], tone: 'positive' },
  { title: 'Votre ville élue la plus agréable du pays', body: 'Un classement national qui flatte votre bilan local.', effects: [s('popularity', 2), s('stress', -2)], tone: 'positive' },
];

/* Tout a un prix : un choix d'événement très avantageux et sans risque reçoit une
 * contrepartie (exposition s'il rapporte de l'argent, stress sinon). */
const SPECIAL = new Set(['rank', 'intl', 'government', 'declare', 'die', 'resign', 'scene', 'debate', 'protest', 'joinCrown', 'joinLodge', 'joinPress', 'leaveCrown', 'leaveLodge', 'leavePress', 'gainAsset', 'sellAsset', 'flag', 'minigame', 'war', 'vote']);
function balanceChoice(c: DecisionChoice): DecisionChoice {
  if (c.risk || c.effects.some(e => SPECIAL.has(e.kind))) return c;
  const money = c.effects.some(e => (e.kind === 'funds' && e.delta > 0) || e.kind === 'income');
  const rule: [(n: number) => Effect, number, number] = money
    ? [n => ({ kind: 'exposure', delta: n }), 0.5, 6]
    : [n => ({ kind: 'stat', stat: 'stress', delta: n }), 0.6, 6];
  const gain = c.effects.map(effectValue).filter(v => v > 0).reduce((s, v) => s + v, 0);
  return gain >= 4 ? { ...c, effects: withCounterweight(c.effects, 0.45, rule) } : c;
}

const PRESS_TAGS = new Set(['diffamation', 'rachat_media', 'source_menacee', 'audience_record', 'clash_direct', 'fausse_info', 'prix_journalisme', 'mercato']);

let seq = 0;
const CALENDAR_TAGS = new Set(['voeux_janvier', 'voeux_elysee', 'garden_party']);

/** Tire éventuellement un événement aléatoire pour le mois */
export function rollRandomEvents(d: GameState, rng: Rng): { decision?: Decision; news?: typeof NEWS_EVENTS[number] } {
  const out: { decision?: Decision; news?: typeof NEWS_EVENTS[number] } = {};
  const canFire = (e: RandomEvent, cooldown: number) =>
    (!e.minRank || rankOrder(d.player.rankId) >= rankOrder(e.minRank))
    && (!e.eligible || e.eligible(d))
    && d.week - Number(d.player.flags[`ev_${e.tag}`] ?? -99) >= cooldown
    && !d.pendingDecisions.some(x => x.tag === `ev_${e.tag}`);
  // Dans le scénario « Éditorialiste », la vie de la rédaction domine l'actualité
  const w = (e: RandomEvent) => e.weight * ((d.scenario === 'editorialiste' && PRESS_TAGS.has(e.tag)) || (d.scenario === 'infiltre' && e.tag.startsWith('mole_')) ? 3 : 1);
  const pick = (pool: RandomEvent[]) => {
    const total = pool.reduce((t, e) => t + w(e), 0);
    let roll = rng.next() * total;
    return pool.find(e => (roll -= w(e)) < 0);
  };

  let ev: RandomEvent | undefined;
  // Portes d'entrée Couronne / Loge : tirage à part, une seule par mois
  // Jamais plus de deux grands arcs à la fois
  const room = canStartArc(d);
  if (d.week >= 4 && room) {
    const gates = GATEWAY_EVENTS.filter(e => canFire(e, 8));
    const crownGates = gates.filter(e => e.tag === 'emissaire_royaliste' || e.tag === 'bal_legitimiste');
    const lodgeGates = gates.filter(e => e.tag === 'parrain_loge' || e.tag === 'tenue_blanche');
    const pressGates = gates.filter(e => e.tag === 'offre_chronique' || e.tag === 'offre_journal');
    if (crownGates.length && rng.chance(0.04)) ev = pick(crownGates);
    else if (lodgeGates.length && rng.chance(0.04)) ev = pick(lodgeGates);
    else if (pressGates.length && rng.chance(0.045)) ev = pick(pressGates);
  }
  // Le règne : la rue et l'Assemblée mettent la Couronne à l'épreuve presque chaque mois
  if (!ev && d.kingdom && rng.chance(0.5 + d.kingdom.opposition / 300)) {
    const pool = [...REVOLUTION_EVENTS, ...COUNTRY_EVENTS.filter(e => e.tag.startsWith('roy_'))].filter(e => canFire(e, 8));
    if (pool.length) ev = pick(pool);
  }
  // Premier contact : la porte d'entrée (rare), puis les rebondissements du dossier
  if (!ev && room && d.week >= 4 && canFire(ALIEN_GATE, 12) && rng.chance(d.scenario === 'carriere' ? 0.012 : 0.006)) ev = ALIEN_GATE;
  if (!ev && d.alien && rng.chance(0.4)) {
    const pool = ALIEN_EVENTS.filter(e => canFire(e, 10));
    if (pool.length) ev = pick(pool);
  }
  // Épidémie Z : la porte d'entrée (rare), puis l'épidémie domine l'actualité
  if (!ev && room && canFire(ZOMBIE_GATE, 12) && rng.chance(0.008)) ev = ZOMBIE_GATE;
  // Fin du monde : la porte d'entrée (rare), les rebondissements, et le Diable qui réclame son dû
  if (!ev && canFire(DEVIL_DUE, 11) && rng.chance(0.7)) ev = DEVIL_DUE;
  if (!ev && room && canFire(APOC_GATE, 12) && rng.chance(0.006)) ev = APOC_GATE;
  if (!ev && d.apocalypse && d.apocalypse.phase < 4 && rng.chance(0.45)) {
    const pool = APOC_EVENTS.filter(e => canFire(e, 5));
    if (pool.length) ev = pick(pool);
  }
  if (!ev && d.zombie && rng.chance(0.45)) {
    const pool = ZOMBIE_EVENTS.filter(e => canFire(e, 6));
    if (pool.length) ev = pick(pool);
  }
  // Les crises au long cours : la porte d'entrée (rare), puis leurs rebondissements
  if (!ev && room && d.week > 6 && rng.chance(0.03)) {
    const pool = CRISIS_GATES.filter(e => canFire(e, 18));
    if (pool.length) ev = pick(pool);
  }
  if (!ev && d.crises && Object.values(d.crises).some(Boolean) && rng.chance(0.4)) {
    const pool = CRISIS_EVENTS.filter(e => canFire(e, 4));
    if (pool.length) ev = pick(pool);
  }
  // Une petite phrase qui peut rester
  if (!ev && d.week > 4 && canFire(PHRASE_EVENT, 8) && rng.chance(0.05)) ev = PHRASE_EVENT;
  // La vie de famille
  if (!ev && d.week > 3 && rng.chance(0.1)) {
    const pool = FAMILY_EVENTS.filter(e => canFire(e, 10));
    if (pool.length) ev = pick(pool);
  }
  // La guerre, puis les États hostiles en temps de paix
  if (!ev && d.war && rng.chance(0.35)) {
    const pool = WAR_EVENTS.filter(e => canFire(e, 6));
    if (pool.length) ev = pick(pool);
  }
  if (!ev && room && canFire(INVASION_EVENT, 24) && rng.chance(0.12)) ev = INVASION_EVENT;
  if (!ev && !d.war && d.week > 3 && rng.chance(0.06)) {
    const pool = HOSTILE_EVENTS.filter(e => canFire(e, 12));
    if (pool.length) ev = pick(pool);
  }
  // Rendez-vous du calendrier (vœux de janvier, 14 Juillet)
  if (!ev) {
    const dated = EXTRA_EVENTS.filter(e => CALENDAR_TAGS.has(e.tag) && canFire(e, 10));
    if (dated.length && rng.chance(0.85)) ev = pick(dated);
    // Les rendez-vous de l'année (Euro, Tour de France, rentrée…) : souvent, pas toujours
    const yearly = CALENDAR_EVENTS.filter(e => canFire(e, 10));
    if (!ev && yearly.length && rng.chance(yearly.some(e => e.tag === 'foot_resultat') ? 0.95 : 0.55)) ev = pick(yearly);
  }
  // La course à l'Élysée et les campagnes
  if (!ev && (inPresidentialRace(d) || d.player.finances.legalCeiling !== null) && rng.chance(0.3)) {
    const pool = CAMPAIGN_EVENTS.filter(e => canFire(e, 8));
    if (pool.length) ev = pick(pool);
  }
  // Les affaires de la fonction occupée, puis celles du monde
  if (!ev && d.week > 2 && rng.chance(0.2)) {
    const pool = RANK_EVENTS.filter(e => canFire(e, 10));
    if (pool.length) ev = pick(pool);
  }
  if (!ev && d.week > 2 && intlRelevant(d) && rng.chance(0.07)) {
    const pool = INTL_EVENTS.filter(e => canFire(e, 12));
    if (pool.length) ev = pick(pool);
  }
  if (!ev && d.week > 2 && rng.chance(0.34)) ev = pick([...RANDOM_EVENTS, ...LIFE_EVENTS, ...PEACE_EVENTS, ...EXTRA_EVENTS.filter(e => !CALENDAR_TAGS.has(e.tag)), ...MORE_EVENTS, ...MISC_ARC_EVENTS, ...PHONE_EVENTS, ...COUNTRY_EVENTS].filter(e => canFire(e, 14)));
  if (ev) {
    const { choices, ...built } = ev.build(d, rng);
    const usable = choices
      .filter(x => (!x.needMoney || d.player.finances.personal >= x.needMoney)
        && (!x.needRank || rankOrder(d.player.rankId) >= rankOrder(x.needRank)))
      .map(({ needMoney: _m, needRank: _r, ...x }) => x)
      .map(balanceChoice);
    d.player.flags[`ev_${ev.tag}`] = d.week;
    out.decision = {
      id: `ev-${d.week}-${++seq}`, tag: `ev_${ev.tag}`, week: d.week, deadlineWeek: d.week + 1,
      source: 'evenement', ...built, choices: usable,
    };
  }
  if (rng.chance(0.15)) out.news = rng.pick(NEWS_EVENTS);
  return out;
}

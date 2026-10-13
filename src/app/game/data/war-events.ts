import { Effect, GameState } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';
import { ENEMIES, ENEMIES_BY_ID, leadsWar } from '../engine/war';

/* ============================================================
 *  Événements des États hostiles (en temps de paix) et de la
 *  guerre (front, arrière, escalade vers la guerre totale).
 *  Tous les États en cause sont fictifs.
 * ============================================================ */

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat, delta });
const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice =>
  ({ id, label, effects, outcome, ...extra });
const play = (gameId: string, title: string, reward: Effect[], penalty?: Effect[]): Effect =>
  ({ kind: 'minigame', gameId, title, reward, ...(penalty ? { penalty } : {}) });
const host = (enemy: string, delta: number): Effect => ({ kind: 'hostile', enemy, delta });
const war = (x: Omit<Extract<Effect, { kind: 'war' }>, 'kind'>): Effect => ({ kind: 'war', ...x });

/** L'État le plus hostile du moment */
function worst(d: GameState): string {
  const h = d.intl.hostile ?? {};
  return Object.entries(h).sort((a, b) => a[1] - b[1])[0]?.[0] ?? ENEMIES[0].id;
}
const the = (id: string) => ENEMIES_BY_ID.get(id)?.the ?? id;
const of = (id: string) => ENEMIES_BY_ID.get(id)?.of ?? id;
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** En temps de paix : les États hostiles éprouvent la France */
export const HOSTILE_EVENTS: RandomEvent[] = [
  {
    tag: 'incident_frontiere', weight: 1, minRank: 'depute',
    build: d => {
      const id = worst(d);
      return {
        title: `Incident avec ${the(id)}`,
        context: `Un patrouilleur ${of(id)} a éperonné un navire de pêche français. Deux marins blessés, les images tournent en boucle.`,
        choices: [
          c('protester', 'Protester solennellement', [host(id, -4), { kind: 'intl', prestige: 1 }, s('credibility', 1)], 'L’ambassadeur est convoqué au Quai d’Orsay.'),
          c('enquete', 'Réclamer une enquête internationale', [host(id, 2), s('credibility', 2)], 'Une commission est nommée. Les marins attendront.'),
          c('fermete', 'Hausser le ton', [host(id, -10), s('popularity', 2), { kind: 'intl', tension: 3 }], '« La France ne se laissera pas intimider. » Applaudissements, et inquiétude.'),
        ],
      };
    },
  },
  {
    tag: 'cyberattaque_etat', weight: 0.9, minRank: 'conseiller_municipal',
    build: d => {
      const id = worst(d);
      const lead = leadsWar(d);
      return {
        title: 'Cyberattaque contre nos hôpitaux',
        context: `Rançongiciel dans trois CHU : opérations reportées, urgences en mode papier. Les experts désignent des pirates liés à ${the(id)}.`,
        choices: lead ? [
          c('riposte', 'Riposter dans le cyberespace', [host(id, -12), { kind: 'intl', prestige: 2, tension: 4 }, s('credibility', 1)], 'Les serveurs de leur agence de renseignement s’éteignent une nuit entière.'),
          c('onu', 'Saisir le Conseil de sécurité', [host(id, -3), s('credibility', 2)], 'Résolution bloquée, mais la France a pris date.'),
          c('discretion', 'Réparer sans accuser', [host(id, 3), s('popularity', -1)], 'Pas d’escalade. Les soignants, eux, trouvent le temps long.'),
        ] : [
          c('soignants', 'Aller soutenir les soignants', [s('popularity', 3), { kind: 'dossier', domain: 'sante', delta: 2 }, s('energy', -6)], 'Vous passez la nuit aux urgences, en mode papier vous aussi.'),
          c('accuser', `Accuser publiquement ${the(id)}`, [s('popularity', 2), host(id, -4)], 'Votre tweet est repris jusque dans leur presse officielle.'),
          c('numerique', 'Réclamer un plan de cybersécurité', [s('credibility', 2), { kind: 'dossier', domain: 'numerique', delta: 3 }], 'Votre tribune est citée par le ministre.'),
        ],
      };
    },
  },
  {
    tag: 'reseau_espions', weight: 0.7, minRank: 'depute',
    build: d => {
      const id = worst(d);
      return {
        title: 'Un réseau d’espions démantelé',
        context: `La DGSI arrête six personnes qui renseignaient ${the(id)} sur nos bases navales. L’une d’elles travaillait à l’Assemblée.`,
        choices: [
          c('expulser', 'Exiger l’expulsion de leurs diplomates', [host(id, -8), s('popularity', 2)], 'Douze diplomates quittent Paris dans la nuit.'),
          c('retourner', 'Laisser le renseignement les retourner', [s('influence', 2), host(id, 0)], 'Désormais, ce sont eux qui écoutent… pour nous.'),
          c('echange', 'Un échange discret', [host(id, 6), s('credibility', -1)], 'Deux de nos agents détenus là-bas rentrent en France.'),
        ],
      };
    },
  },
  {
    tag: 'ultimatum', weight: 1.3, minRank: 'ministre',
    eligible: d => leadsWar(d) && (d.intl.hostile?.[worst(d)] ?? 0) <= -55,
    build: d => {
      const id = worst(d);
      return {
        title: `Ultimatum ${of(id)}`,
        context: `Le régime exige le retrait de notre flotte et la fin des sanctions sous trente jours. Faute de quoi, « toutes les options sont sur la table ».`,
        choices: [
          c('ceder', 'Céder', [host(id, 25), { kind: 'intl', prestige: -8 }, s('popularity', -4)], 'La crise s’éteint. Votre réputation de fermeté, aussi.'),
          c('refuser', 'Refuser net', [host(id, -12), { kind: 'intl', prestige: 3, tension: 5 }, s('popularity', 2)], 'La France ne négocie pas sous la menace. La menace, elle, demeure.'),
          c('temporiser', 'Gagner du temps : négocier', [host(id, 10), s('credibility', 2)], 'Des diplomates partent pour Vienne.', {
            risk: { baseChance: 0.35, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [host(id, -15), { kind: 'intl', prestige: -3 }], failureNews: 'Les négociations tournent court : le régime claque la porte.' },
          }),
        ],
      };
    },
  },
  {
    tag: 'dissident', weight: 0.6, minRank: 'conseiller_municipal',
    build: d => {
      const id = worst(d);
      return {
        title: 'Un dissident demande l’asile',
        context: `Un célèbre écrivain ${of(id)}, emprisonné trois fois, est arrivé à Roissy. Il demande l’asile et une tribune.`,
        choices: [
          c('accueillir', 'Le recevoir publiquement', [host(id, -6), s('popularity', 2), s('credibility', 1)], 'Sa conférence de presse fait le tour du monde.'),
          c('discret', 'Faciliter son asile, sans bruit', [s('credibility', 1)], 'Il obtient ses papiers. Le régime ne dit rien.'),
        ],
      };
    },
  },
  {
    tag: 'detente', weight: 0.6, minRank: 'ministre',
    eligible: d => leadsWar(d),
    build: d => {
      const id = worst(d);
      return {
        title: `${cap(the(id))} propose un sommet`,
        context: 'À la surprise générale, le régime propose une rencontre au sommet à Genève : désarmement, prisonniers, commerce.',
        choices: [
          c('accepter', 'Accepter le sommet', [host(id, 15), { kind: 'intl', prestige: 2, tension: -5 }], 'Poignée de main glaciale, communiqué commun prudent : la fièvre retombe.'),
          c('conditions', 'Poser des conditions', [host(id, 6), s('credibility', 2)], 'Ils acceptent la moitié. C’est déjà ça.'),
          c('refuser', 'Refuser', [host(id, -6), s('popularity', 1)], '« Pas de photo avec un régime pareil. »'),
        ],
      };
    },
  },
];

/** La bascule : un État à bout de patience attaque la France */
export const INVASION_EVENT: RandomEvent = {
  tag: 'attaque_aube', weight: 1,
  eligible: d => !d.war && (d.intl.hostile?.[worst(d)] ?? 0) <= -70 && d.week - Number(d.player.flags['lastWar'] ?? -99) >= 18,
  build: d => {
    const id = worst(d);
    const lead = leadsWar(d);
    return {
      title: `${cap(the(id))} attaque la France`,
      context: `4 h 50 : les sirènes. ${cap(the(id))} a lancé une attaque sur notre territoire. Le pays se réveille en guerre.`,
      choices: lead ? [
        c('defense', 'Conseil de défense immédiat', [{ kind: 'war', invade: id }, s('stress', 8), s('credibility', 2)], 'Les armées ripostent. Vous parlez à la Nation à 7 heures.'),
        c('allies', 'Invoquer l’article 5 de nos alliances', [{ kind: 'war', invade: id }, { kind: 'intl', allRelations: 4 }, s('influence', 2)], 'Les alliés promettent leur aide. Il faudra la concrétiser.'),
      ] : [
        c('union', 'Se ranger derrière le gouvernement', [{ kind: 'war', invade: id }, s('credibility', 2)], 'Union sacrée : les querelles attendront.'),
        c('terrain', 'Rejoindre la cellule de crise locale', [{ kind: 'war', invade: id }, s('popularity', 3), s('energy', -8)], 'Vous organisez les abris de votre quartier.'),
      ],
    };
  },
};

/** En temps de guerre */
export const WAR_EVENTS: RandomEvent[] = [
  {
    tag: 'frappe_paris', weight: 1.2,
    eligible: d => !!d.war && !d.war.total && leadsWar(d) && d.week - d.war.since >= 2,
    build: d => ({
      title: 'Des missiles sur Paris',
      context: `Cette nuit, trois missiles tirés ${of(d.war!.enemyId)} ont frappé la banlieue parisienne. Quarante morts. L’état-major présente trois options.`,
      choices: [
        c('totale', 'Décréter la guerre totale', [war({ total: true }), s('stress', 8)], 'Mobilisation générale : la France entière entre en guerre.'),
        c('riposte', 'Une riposte limitée', [war({ front: 3, morale: 2, losses: 60 }), { kind: 'intl', tension: 5 }], 'Nos frappes visent leurs bases de lancement. Le pays respire, un peu.'),
        c('sangfroid', 'Garder son sang-froid', [war({ morale: 4, support: -2 }), s('credibility', 2)], 'Vous parlez à la Nation, sans haine ni escalade.'),
      ],
    }),
  },
  {
    tag: 'frappe_ville', weight: 1,
    eligible: d => !!d.war && !leadsWar(d),
    build: d => ({
      title: 'Une ville bombardée',
      context: `Des frappes ennemies ont touché la gare et un quartier de Lyon. Le gouvernement promet une riposte. Les caméras cherchent les élus.`,
      choices: [
        c('surplace', 'Se rendre sur place', [s('popularity', 3), war({ morale: 2 }), s('energy', -8)], 'Au milieu des gravats, vous aidez à distribuer des couvertures.'),
        c('union', 'Appeler à l’union sacrée', [s('credibility', 2), war({ support: 2 })], 'Votre déclaration est reprise par tous les journaux télévisés.'),
        c('critiquer', 'Critiquer l’impréparation du gouvernement', [s('popularity', 2), war({ support: -2 }), s('credibility', -1)], 'On vous trouve courageux·se… ou indécent·e.'),
      ],
    }),
  },
  {
    tag: 'alerte_drones', weight: 1,
    eligible: d => !!d.war,
    build: () => ({
      title: 'Alerte aux drones',
      context: 'Les sirènes hurlent : un essaim de drones vise la centrale électrique de votre département. Le préfet vous propose de rejoindre le centre de défense.',
      choices: [
        c('centre', 'Rejoindre le centre de défense', [play('interception', 'Les drones de la nuit', [war({ morale: 4 }), s('popularity', 3), s('credibility', 2)], [war({ morale: -3 }), s('stress', 5)])], 'Vous enfilez le casque. Les écrans s’allument.'),
        c('abri', 'Gagner l’abri avec les habitants', [s('popularity', 2), s('stress', 3)], 'Une nuit dans le métro, au milieu des familles.'),
      ],
    }),
  },
  {
    tag: 'volontaires', weight: 0.8,
    eligible: d => !!d.war,
    build: () => ({
      title: 'Les files devant les bureaux de recrutement',
      context: 'Des milliers de jeunes se pressent pour s’engager. Parmi eux, votre neveu, dix-neuf ans, qui vous demande votre avis.',
      choices: [
        c('soutenir', 'Le soutenir dans son choix', [war({ morale: 3 }), s('popularity', 2), s('stress', 5)], 'Il part pour le camp de Mourmelon. Vous dormez mal.'),
        c('dissuader', 'Lui conseiller de finir ses études', [s('stress', -1)], 'Il vous en veut. Sa mère vous remercie.'),
      ],
    }),
  },
  {
    tag: 'marche_noir', weight: 0.9,
    eligible: d => !!d.war?.total,
    build: d => ({
      title: 'Le marché noir prospère',
      context: 'Essence, beurre, médicaments : tout se revend trois fois le prix sous le manteau. Un proche d’un élu de votre parti serait dans le coup.',
      choices: leadsWar(d) ? [
        c('reprimer', 'Réprimer sans pitié', [war({ effort: 3, morale: -2 }), s('credibility', 2)], 'Les gendarmes saisissent des entrepôts entiers.'),
        c('tolerer', 'Fermer les yeux pour tenir l’arrière', [war({ morale: 2 }), { kind: 'exposure', delta: 4 }], 'Le marché noir fait office de soupape. Jusqu’au scandale ?'),
      ] : [
        c('denoncer', 'Dénoncer les profiteurs, y compris dans votre camp', [s('credibility', 3), { kind: 'cohesion', delta: -3 }], 'La presse salue votre courage. Votre parti, moins.'),
        c('silence', 'Ne rien dire', [{ kind: 'exposure', delta: 3 }], 'L’affaire éclate trois mois plus tard.'),
      ],
    }),
  },
  {
    tag: 'pacifistes', weight: 0.7,
    eligible: d => !!d.war && d.week - d.war.since >= 4,
    build: d => ({
      title: 'La marche pour la paix',
      context: 'Cent mille personnes défilent : « Ni guerre ni mobilisation ». Les organisateurs vous invitent à prendre la parole.',
      choices: leadsWar(d) ? [
        c('recevoir', 'Recevoir une délégation', [war({ morale: 2, support: -1 }), s('credibility', 2)], 'Une heure d’échange franc. Ils repartent sans être convaincus, mais écoutés.'),
        c('ignorer', 'Ignorer le cortège', [war({ morale: -2 }), s('popularity', -1)], 'Les manifestants vous traitent de va-t-en-guerre.'),
      ] : [
        c('defiler', 'Défiler avec eux', [s('popularity', 2), war({ support: -3 }), s('credibility', -1)], 'Votre présence fait polémique dans votre propre camp.'),
        c('condamner', 'Les accuser de faire le jeu de l’ennemi', [war({ support: 2 }), s('popularity', -1)], 'Le débat s’envenime.'),
        c('dialogue', 'Proposer un débat à l’Assemblée', [s('credibility', 2)], 'Le débat a lieu. Il est digne.'),
      ],
    }),
  },
  {
    tag: 'prisonniers', weight: 0.6,
    eligible: d => !!d.war && leadsWar(d) && d.week - d.war.since >= 3,
    build: d => ({
      title: 'Un échange de prisonniers',
      context: `Par l’entremise de la Croix-Rouge, ${the(d.war!.enemyId)} propose d’échanger cent prisonniers contre cent.`,
      choices: [
        c('accepter', 'Accepter l’échange', [war({ support: 4, morale: 3 }), host('$war', 5)], 'Sur le tarmac de Villacoublay, des familles en larmes.'),
        c('refuser', 'Refuser : pas de geste tant qu’ils bombardent', [war({ morale: -2 }), s('credibility', 1)], 'Les familles des prisonniers manifestent devant l’Élysée.'),
      ],
    }),
  },
  {
    tag: 'moral_troupes', weight: 0.6,
    eligible: d => !!d.war && leadsWar(d) && d.week - d.war.since >= 5,
    build: () => ({
      title: 'Le moral des troupes vacille',
      context: 'Huit mois sans relève pour certains régiments. Les rapports parlent de fatigue extrême et de refus d’obéissance isolés.',
      choices: [
        c('permissions', 'Accorder des permissions', [war({ front: -2, support: 3, morale: 3 })], 'Les trains de permissionnaires sont pris d’assaut.'),
        c('discipline', 'Rétablir la discipline', [war({ front: 1, support: -3 }), s('credibility', 1)], 'L’ordre revient. La confiance, moins vite.'),
        c('front', 'Aller au front leur parler', [war({ morale: 2, support: 2 }), s('energy', -10), s('influence', 2)], 'Dans une tranchée boueuse, vous écoutez plus que vous ne parlez.'),
      ],
    }),
  },
];

/** En temps de paix, partout : les vieilles bombes et les cérémonies */
export const PEACE_EVENTS: RandomEvent[] = [
  {
    tag: 'bombe_ancienne', weight: 0.6,
    eligible: d => !d.war,
    build: () => ({
      title: 'Une bombe de 1944 sous le chantier',
      context: 'En creusant pour le nouveau tramway, les ouvriers ont mis au jour un obus de la Seconde Guerre mondiale. Deux mille riverains à évacuer.',
      choices: [
        c('demineurs', 'Suivre l’opération avec les démineurs', [play('deminage', 'Déminage du chantier', [s('popularity', 3), s('credibility', 2)], [s('stress', 6), s('popularity', -1)])], 'Le chef démineur vous tend un casque.'),
        c('evacuation', 'Superviser l’évacuation', [s('credibility', 2), s('energy', -6)], 'Gymnase ouvert, cafés offerts : tout se passe dans le calme.'),
      ],
    }),
  },
];

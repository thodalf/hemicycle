import { Effect, GameState } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';
import { PARRAINAGES_REQUIRED, rankOrder } from './ranks';
import { monthIndex } from '../engine/calendar';

/* ============================================================
 *  Événements supplémentaires, dont plusieurs se jouent en
 *  mini-jeu (« À vous de jouer »), et des rendez-vous du
 *  calendrier (vœux de janvier, garden-party du 14 Juillet).
 * ============================================================ */

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat, delta });
const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice =>
  ({ id, label, effects, outcome, ...extra });
/** Choix « mini-jeu » : les gains dépendent de votre score */
const play = (gameId: string, title: string, reward: Effect[], penalty?: Effect[]): Effect =>
  ({ kind: 'minigame', gameId, title, reward, ...(penalty ? { penalty } : {}) });
const atLeast = (d: GameState, r: Parameters<typeof rankOrder>[0]) => rankOrder(d.player.rankId) >= rankOrder(r);

export const EXTRA_EVENTS: RandomEvent[] = [
  // ── À vous de jouer ─────────────────────────────────────
  {
    tag: 'micro_coupe', weight: 1, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Le micro coupe en plein discours',
      context: 'Grésillement, puis plus rien. Quatre cents personnes vous regardent. La technique cherche un câble.',
      choices: [
        c('improviser', 'Improviser à pleine voix', [play('discours', 'Discours sans micro', [s('popularity', 4), s('influence', 2), s('credibility', 1)])], 'Vous montez sur une chaise.'),
        c('attendre', 'Attendre que la technique répare', [s('popularity', -1), s('stress', 3)], 'Dix minutes de flottement. Une partie de la salle s’en va.'),
      ],
    }),
  },
  {
    tag: 'foire_canton', weight: 1,
    build: () => ({
      title: 'La foire du canton',
      context: 'Tracteurs, barbe à papa, concours de la plus belle vache. Tout le canton est là, et les caméras de France 3 aussi.',
      choices: [
        c('allees', 'Arpenter les allées', [play('bain_de_foule', 'Les allées de la foire', [s('popularity', 4), { kind: 'contact', contactId: 'ct-maires', trust: 4 }, { kind: 'dossier', domain: 'territoires', delta: 3 }])], 'Bottes aux pieds, main tendue.'),
        c('passer', 'Passer en coup de vent', [s('popularity', -1)], 'On vous a vu filer. On s’en souviendra.'),
      ],
    }),
  },
  {
    tag: 'courrier_deborde', weight: 0.9,
    build: () => ({
      title: 'Votre boîte aux lettres déborde',
      context: 'Trois cents courriers en retard, des relances, des colères. Vos bénévoles sont débordés.',
      choices: [
        c('trier', 'Retrousser ses manches et trier', [play('courrier', 'Le courrier en retard', [s('credibility', 3), s('popularity', 2), s('energy', -6)])], 'Vous vous installez à la grande table.'),
        c('interim', 'Payer un intérimaire', [{ kind: 'funds', account: 'personal', delta: -900 }, s('credibility', 1)], 'Tout est traité en une semaine. Proprement, sans âme.', { needMoney: 900 }),
        c('laisser', 'Laisser s’empiler', [s('popularity', -2)], '« Il·elle ne répond jamais. » La rumeur court.'),
      ],
    }),
  },
  {
    tag: 'interview_piege', weight: 1, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Interview piège à la radio',
      context: 'Le journaliste vedette vous a invité·e « pour parler du fond ». Son assistante vous prévient : il a préparé une liste de questions qui fâchent.',
      choices: [
        c('y_aller', 'Y aller et tenir bon', [play('matinale', 'Huit minutes au micro', [s('credibility', 3), s('influence', 3), s('popularity', 2)], [s('credibility', -4), s('popularity', -2), s('stress', 4)])], 'Le voyant rouge s’allume.'),
        c('annuler', 'Annuler au dernier moment', [s('popularity', -1), s('influence', -1)], '« L’invité·e s’est défilé·e », ironise l’animateur.'),
      ],
    }),
  },
  {
    tag: 'mecene', weight: 0.8,
    build: () => ({
      title: 'Un mécène vous fait signe',
      context: 'Un entrepreneur fortuné admire « votre énergie ». Il est prêt à soutenir votre action, dans les limites de la loi. Reste à savoir combien demander.',
      choices: [
        c('negocier', 'Négocier le montant', [play('negociation_donateur', 'Le rendez-vous avec le mécène', [{ kind: 'funds', account: 'campaign', delta: 15000 }, { kind: 'exposure', delta: 1 }])], 'Déjeuner dans un club discret.'),
        c('refuser', 'Décliner poliment', [s('credibility', 1)], 'Vous gardez les mains libres.'),
      ],
    }),
  },
  {
    tag: 'greve_cantine', weight: 0.9, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Grève des agents de cantine',
      context: 'Plus de repas dans les écoles depuis trois jours. Les parents s’impatientent, les agents réclament une prime.',
      choices: [
        c('negocier', 'Mener la négociation', [play('negociation_syndicale', 'La prime des agents', [s('credibility', 3), s('popularity', 2), { kind: 'contact', contactId: 'ct-ust', trust: 5 }])], 'Table ronde à la mairie, 18 heures.'),
        c('pourrir', 'Laisser pourrir', [s('popularity', -3), { kind: 'contact', contactId: 'ct-ust', trust: -5 }], 'Les sandwichs froids font la une du journal local.'),
      ],
    }),
  },
  {
    tag: 'vote_serre', weight: 1, minRank: 'depute',
    eligible: d => d.player.rankId === 'depute',
    build: () => ({
      title: 'Un vote serré se prépare',
      context: 'Le président du groupe vous demande de rallier les hésitants avant le scrutin de mardi. Chaque voix compte.',
      choices: [
        c('rallier', 'Faire la tournée des indécis', [play('pointage', 'Les indécis du groupe', [s('influence', 4), { kind: 'faction', factionId: '*', delta: 3 }, s('politicalCapital', 6)])], 'Vous sortez votre carnet.'),
        c('decliner', 'Laisser faire le président du groupe', [{ kind: 'faction', factionId: '*', delta: -1 }], 'On note votre absence d’entrain.'),
      ],
    }),
  },
  {
    tag: 'grand_oral', weight: 0.9,
    build: (d, rng) => {
      const domain = rng.pick(['economie', 'ecologie', 'sante', 'numerique', 'social'] as const);
      return {
        title: 'Grand oral devant des experts',
        context: 'Un cercle de réflexion vous invite à exposer vos idées devant un parterre de spécialistes. Ils connaissent leurs dossiers par cœur.',
        domain,
        choices: [
          c('reviser', 'Réviser ses fiches et y aller', [play('fiches', 'Le grand oral', [{ kind: 'dossier', domain: '$domain', delta: 7 }, s('credibility', 3), s('influence', 2)])], 'Fiches bristol, surligneur, café.'),
          c('impro', 'Y aller au culot', [s('credibility', d.player.dossiers[domain].mastery >= 50 ? 2 : -3)], d.player.dossiers[domain].mastery >= 50 ? 'Vous maîtrisez votre sujet : ça passe.' : 'Un expert vous reprend sur un chiffre. Silence glacial.'),
        ],
      };
    },
  },
  {
    tag: 'petanque', weight: 0.7,
    build: () => ({
      title: 'Le tournoi de pétanque des anciens',
      context: 'Le club du troisième âge vous invite à lancer le tournoi. Il y aura des photos, du pastis et beaucoup d’avis sur la politique.',
      choices: [
        c('jouer', 'Faire le tour des terrains', [play('selfies', 'Photos au boulodrome', [s('popularity', 3), s('stress', -3)])], 'Casquette vissée, sourire aux lèvres.'),
        c('discours', 'Juste un mot d’accueil', [s('popularity', 1)], 'Bref, efficace, applaudi poliment.'),
      ],
    }),
  },
  {
    tag: 'maires_rappellent', weight: 1.2,
    eligible: d => d.presidential.declared && d.presidential.parrainages < PARRAINAGES_REQUIRED && d.week < d.presidential.nextWeek - 5,
    build: () => ({
      title: 'Les maires rappellent',
      context: 'Votre équipe a laissé des messages à deux cents mairies. Les rappels arrivent tous en même temps.',
      choices: [
        c('decrocher', 'Prendre les appels vous-même', [play('parrainages', 'Le standard des parrainages', [{ kind: 'parrainages', delta: 70 }, s('energy', -8)])], 'Vous prenez le casque.'),
        c('equipe', 'Laisser l’équipe s’en charger', [{ kind: 'parrainages', delta: 25 }], 'Une vingtaine de promesses.'),
      ],
    }),
  },
  {
    tag: 'concours_eloquence', weight: 0.7,
    build: () => ({
      title: 'Invité·e d’un concours d’éloquence',
      context: 'Une faculté de droit organise un concours ouvert aux élus. Le sujet : « Faut-il se méfier des promesses ? »',
      choices: [
        c('concourir', 'Monter à la tribune', [play('eloquence', 'Le concours d’éloquence', [s('popularity', 3), s('credibility', 2), s('influence', 2)])], 'Toge empruntée, gorge sèche.'),
        c('jury', 'Préférer siéger dans le jury', [s('influence', 1)], 'Vous notez sans prendre de risque.'),
      ],
    }),
  },
  {
    tag: 'challenge_viral', weight: 0.8,
    build: () => ({
      title: 'Un challenge viral vous cible',
      context: 'Des milliers d’internautes vous interpellent en direct sous un mot-dièse moqueur. Votre équipe propose un live pour retourner la situation.',
      choices: [
        c('live', 'Faire le live et répondre', [play('moderation', 'Le live de la riposte', [s('popularity', 4), s('influence', 1)], [s('popularity', -4), { kind: 'exposure', delta: 3 }])], 'Vous lancez la caméra.'),
        c('ignorer', 'Laisser passer l’orage', [s('popularity', -1)], 'Trois jours plus tard, plus personne n’en parle. Presque.'),
      ],
    }),
  },
  {
    tag: 'voeux_janvier', weight: 4,
    eligible: d => monthIndex(d.week) === 0 && atLeast(d, 'depute') && !d.presidency,
    build: () => ({
      title: 'La cérémonie des vœux',
      context: 'Salle des fêtes comble, galette et cidre : il faut donner le ton de l’année.',
      choices: [
        c('discours', 'Prononcer un vrai discours', [play('discours', 'Vos vœux de nouvel an', [s('popularity', 3), s('influence', 2), { kind: 'faction', factionId: '*', delta: 2 }])], 'Vous prenez la parole.'),
        c('court', 'Faire court et passer aux galettes', [s('popularity', 1)], 'On apprécie la brièveté.'),
      ],
    }),
  },
  {
    tag: 'voeux_elysee', weight: 6,
    eligible: d => monthIndex(d.week) === 0 && !!d.presidency,
    build: () => ({
      title: 'Les vœux aux Français',
      context: '31 décembre, 20 heures. Bureau doré, drapeaux, prompteur : quarante millions de téléspectateurs.',
      choices: [
        c('allocution', 'Prononcer les vœux', [play('allocution', 'Les vœux du 31 décembre', [{ kind: 'presidency', approval: 4 }, s('popularity', 2)])], 'Le générique retentit.'),
        c('sobre', 'Une adresse sobre et brève', [{ kind: 'presidency', approval: 1 }], 'Trois minutes, sans éclat.'),
      ],
    }),
  },
  {
    tag: 'garden_party', weight: 6,
    eligible: d => monthIndex(d.week) === 6 && (!!d.presidency || ['ministre', 'premier_ministre'].includes(d.player.rankId)),
    build: d => ({
      title: 'Garden-party du 14 Juillet',
      context: d.presidency ? 'Après le défilé, les jardins de l’Élysée accueillent sept mille invités : élus, soignants, militaires, anonymes.' : 'Vous êtes invité·e aux jardins de l’Élysée. Tout le gouvernement est là, et la presse compte les poignées de main.',
      choices: [
        c('jardins', 'Fendre la foule des jardins', [play('bain_de_foule', 'Les jardins de l’Élysée', [s('popularity', 3), s('influence', 3), ...(d.presidency ? [{ kind: 'presidency' as const, approval: 2 }] : [])])], 'Vous descendez le perron.'),
        c('carre', 'Rester dans le carré officiel', [s('influence', 1)], 'Petits fours et conversations convenues.'),
      ],
    }),
  },

  // ── Imprévus sans mini-jeu ──────────────────────────────
  {
    tag: 'chat_mairie', weight: 0.6,
    build: () => ({
      title: 'Le chat de la mairie a disparu',
      context: 'Pompon, le chat roux qui dort à l’accueil depuis douze ans, n’est pas rentré. La page Facebook de la commune s’enflamme.',
      choices: [
        c('chercher', 'Organiser une battue', [s('popularity', 2), s('energy', -5)], 'Pompon est retrouvé dans une cave. Photo virale.'),
        c('ignorer', 'Ce n’est pas votre rôle', [s('popularity', -1)], '« Sans cœur », écrit une retraitée. 400 partages.'),
      ],
    }),
  },
  {
    tag: 'homonyme', weight: 0.6,
    build: d => ({
      title: 'Un homonyme fait scandale',
      context: `Un certain ${d.player.name.split(' ')[0]} ${d.player.name.split(' ').slice(1).join(' ')}, gérant d’un bar à chicha, est arrêté pour fraude. Les moteurs de recherche mélangent tout.`,
      choices: [
        c('dementir', 'Démentir sèchement', [s('credibility', 1), s('stress', 2)], 'Le démenti circule moins que la rumeur.'),
        c('humour', 'En rire sur les réseaux', [s('popularity', 3)], '« Je confirme : je ne sais pas faire de chicha. » Succès.'),
      ],
    }),
  },
  {
    tag: 'lettre_enfant', weight: 0.7,
    build: () => ({
      title: 'La lettre d’une enfant',
      context: 'Léna, 9 ans, vous écrit : « Pourquoi les grands ne font rien pour la planète ? » Elle a dessiné un ours polaire.',
      choices: [
        c('main', 'Lui répondre à la main', [s('popularity', 2), s('stress', -2)], 'Sa maîtresse affiche la lettre en classe.'),
        c('ecole', 'Aller la voir dans son école', [s('popularity', 3), { kind: 'dossier', domain: 'ecologie', delta: 2 }, s('energy', -6)], 'Une heure de questions redoutables.'),
        c('service', 'Laisser le service courrier répondre', [], 'Une réponse type, polie.'),
      ],
    }),
  },
  {
    tag: 'drone_jardin', weight: 0.5, minRank: 'depute',
    build: () => ({
      title: 'Un drone au-dessus de chez vous',
      context: 'Un drone survole votre jardin trois soirs de suite. Votre famille s’inquiète.',
      choices: [
        c('plainte', 'Porter plainte', [{ kind: 'flagAdd', key: 'protection', delta: 8 }, s('stress', 2)], 'La police identifie un « fan » un peu trop curieux.'),
        c('ignorer', 'Ne pas s’affoler', [s('stress', 4)], 'Le drone finit par disparaître. Le malaise, moins vite.'),
      ],
    }),
  },
  {
    tag: 'stagiaire', weight: 0.7,
    build: () => ({
      title: 'Le stagiaire a tweeté depuis votre compte',
      context: '« Trop hâte de la raclette ce soir 🧀🧀 » publié à 23 h 40 sur votre compte officiel. 12 000 likes.',
      choices: [
        c('assumer', 'Assumer : « Moi aussi j’ai hâte »', [s('popularity', 3)], 'Les marques de fromage vous écrivent.'),
        c('supprimer', 'Supprimer et s’excuser', [s('credibility', 1), s('popularity', -1)], 'Les captures d’écran, elles, restent.'),
      ],
    }),
  },
];

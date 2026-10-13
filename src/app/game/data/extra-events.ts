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
      title: 'Les maires vous attendent',
      context: 'Une trentaine de maires ruraux hésitent encore à vous parrainer. Ils veulent vous voir en personne, chez eux.',
      choices: [
        c('route', 'Prendre la route vous-même', [play('tournee_maires', 'La tournée des mairies', [{ kind: 'parrainages', delta: 70 }, s('energy', -8)])], 'Plein d’essence, carte routière, thermos de café.'),
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
  // ── Nouveaux imprévus ───────────────────────────────────
  {
    tag: 'festival_ete', weight: 0.8,
    eligible: d => [5, 6, 7].includes(monthIndex(d.week)),
    build: () => ({
      title: 'On vous tend le micro au festival',
      context: 'Le festival de l’été bat son plein. Entre deux groupes, l’organisateur vous invite sur scène : « Deux minutes, pas plus ! »',
      choices: [
        c('scene', 'Monter sur scène', [play('festival', 'Deux minutes sur la grande scène', [s('popularity', 4), { kind: 'dossier', domain: 'education', delta: 2 }], [s('popularity', -2)])], 'Dix mille personnes, et pas de prompteur.'),
        c('coulisses', 'Saluer les bénévoles en coulisses', [s('popularity', 1), s('energy', -3)], 'Moins de lumière, plus de mains serrées.'),
      ],
    }),
  },
  {
    tag: 'tempete_neige', weight: 0.9,
    eligible: d => [11, 0, 1].includes(monthIndex(d.week)),
    build: () => ({
      title: 'Tempête de neige',
      context: 'Quarante centimètres en une nuit. Routes coupées, villages isolés, personnes âgées sans chauffage.',
      choices: [
        c('terrain', 'Partir sur le terrain avec les secours', [s('popularity', 4), { kind: 'contact', contactId: 'ct-maires', trust: 3 }, s('energy', -8)], 'Bottes, pelle et photos dans la presse locale.'),
        c('cellule', 'Coordonner depuis la cellule de crise', [s('credibility', 3), s('stress', 3)], 'Rien de spectaculaire, tout fonctionne.'),
        c('tweet', 'Un message de soutien sur les réseaux', [s('popularity', -2)], '« Au chaud derrière son écran », répondent les maires.'),
      ],
    }),
  },
  {
    tag: 'telethon', weight: 1.2,
    eligible: d => monthIndex(d.week) === 11,
    build: () => ({
      title: 'Le Téléthon',
      context: 'Les associations de la circonscription organisent une nuit de défis. On compte sur vous pour relever le sien.',
      choices: [
        c('defi', 'Relever un défi en public', [play('bain_de_foule', 'La nuit du Téléthon', [s('popularity', 3), { kind: 'dossier', domain: 'sante', delta: 3 }])], 'Vous enfilez le t-shirt jaune.'),
        c('don', 'Faire un don personnel', [{ kind: 'funds', account: 'personal', delta: -500 }, s('popularity', 1), s('credibility', 1)], 'Discrètement, sans caméra.', { needMoney: 500 }),
        c('rien', 'Pas le temps cette année', [s('popularity', -1)], 'Les associations le notent.'),
      ],
    }),
  },
  {
    tag: 'panne_metro', weight: 0.7, minRank: 'depute',
    build: () => ({
      title: 'Coincé·e dans le métro',
      context: 'Panne géante sur la ligne 13 : vous voilà bloqué·e quarante minutes dans une rame bondée. Des voyageurs vous ont reconnu·e.',
      choices: [
        c('ecouter', 'Écouter leurs galères', [s('popularity', 3), { kind: 'dossier', domain: 'territoires', delta: 2 }, s('stress', 2)], 'Une vidéo de vous, accroupi·e, carnet en main, circule le soir même.'),
        c('telephone', 'Rester sur son téléphone', [s('popularity', -1)], 'On vous filme quand même, l’air ennuyé.'),
      ],
    }),
  },
  {
    tag: 'militant_viral', weight: 0.7,
    build: () => ({
      title: 'Un jeune militant devient viral',
      context: 'Un militant de 19 ans de votre équipe a répondu à un ministre en vidéo. Deux millions de vues. Il veut vous rencontrer.',
      choices: [
        c('promouvoir', 'Le mettre en avant', [s('popularity', 3), { kind: 'momentum', delta: 3 }, s('influence', -1)], 'Il passe sur les plateaux. Il vous cite à chaque fois, pour l’instant.'),
        c('encadrer', 'L’encadrer discrètement', [s('credibility', 2), { kind: 'cohesion', delta: 2 }], 'Un mentor plutôt qu’un projecteur.'),
        c('freiner', 'Le prier de se faire oublier', [{ kind: 'cohesion', delta: -3 }, s('popularity', -1)], 'Il le prend mal, et le dit en vidéo.'),
      ],
    }),
  },
  {
    tag: 'mariage_adversaire', weight: 0.5, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Invitation au mariage d’un adversaire',
      context: 'Votre principal adversaire local se marie et vous a invité·e. Toute la ville sera là, la presse locale aussi.',
      choices: [
        c('aller', 'Y aller, avec un beau cadeau', [s('popularity', 2), s('credibility', 2), { kind: 'funds', account: 'personal', delta: -250 }], 'Vous dansez même un rock. La photo fait la une.', { needMoney: 250 }),
        c('mot', 'Décliner avec un mot chaleureux', [s('credibility', 1)], 'Élégant, sans plus.'),
        c('ignorer', 'Ne pas répondre', [s('popularity', -1), { kind: 'cohesion', delta: 1 }], 'Vos militants apprécient. La ville, moins.'),
      ],
    }),
  },
  {
    tag: 'plume_fantome', weight: 0.5, minRank: 'depute',
    build: () => ({
      title: 'Une plume fantôme vous propose un livre',
      context: 'Un éditeur parisien veut votre livre pour la rentrée. Un nègre littéraire l’écrira en trois mois, d’après vos entretiens.',
      choices: [
        c('signer', 'Signer', [{ kind: 'funds', account: 'personal', delta: 6000 }, s('influence', 2), s('credibility', -1)], 'Le livre sort. Les critiques reconnaissent mal votre style.'),
        c('ecrire', 'L’écrire vous-même, le soir', [s('credibility', 3), s('influence', 2), s('energy', -10), s('stress', 4)], 'Six mois de nuits courtes. Un vrai livre.'),
        c('refuser', 'Refuser', [], 'Une autre fois, peut-être.'),
      ],
    }),
  },
  {
    tag: 'chien_adopte', weight: 0.5,
    build: () => ({
      title: 'Un chien à la permanence',
      context: 'Un chien errant s’est installé devant votre permanence. Les passants le nourrissent. Il vous suit jusqu’à la voiture.',
      choices: [
        c('adopter', 'L’adopter', [s('popularity', 3), s('stress', -4), { kind: 'flagAdd', key: 'chien', delta: 1 }], 'Il s’appelle désormais Préfet. Il a son compte Instagram.'),
        c('refuge', 'L’emmener au refuge', [s('popularity', 1)], 'Il est adopté en deux jours.'),
      ],
    }),
  },
  {
    tag: 'sondage_coquille', weight: 0.5, minRank: 'depute',
    build: () => ({
      title: 'Le sondage coquille',
      context: 'Un institut vous crédite par erreur de 31 % d’intentions de vote au lieu de 13 %. Le chiffre fait le tour des chaînes info avant le démenti.',
      choices: [
        c('humour', 'En rire publiquement', [s('popularity', 3), s('credibility', 1)], '« Je prends les 31 %, je rends les 13. » La formule tourne.'),
        c('profiter', 'Laisser courir la confusion', [{ kind: 'momentum', delta: 4 }, s('credibility', -3)], 'Deux jours d’euphorie, puis les moqueries.'),
      ],
    }),
  },
  {
    tag: 'diner_famille', weight: 0.6,
    build: () => ({
      title: 'Dîner de famille houleux',
      context: 'Repas dominical : votre beau-frère attaque votre bilan dès l’entrée. Votre mère vous fait les gros yeux.',
      choices: [
        c('debattre', 'Débattre jusqu’au dessert', [s('stress', 5), s('credibility', 1)], 'Vous gagnez le débat, pas la soirée.'),
        c('apaiser', 'Changer de sujet', [s('stress', -3)], 'On parle du chien du voisin. Tout le monde est soulagé.'),
        c('partir', 'Prétexter une urgence', [s('stress', 2), s('energy', 2)], 'Votre mère ne décroche plus pendant une semaine.'),
      ],
    }),
  },
  {
    tag: 'cambriolage_permanence', weight: 0.4, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Votre permanence cambriolée',
      context: 'Vitre brisée, ordinateurs volés, fichiers des militants dans la nature. La police est sur place.',
      choices: [
        c('transparence', 'Prévenir les militants et porter plainte', [s('credibility', 3), { kind: 'funds', account: 'campaign', delta: -1500 }, s('stress', 3)], 'Les militants apprécient la franchise.'),
        c('discret', 'Rester discret', [{ kind: 'funds', account: 'campaign', delta: -1500 }, { kind: 'exposure', delta: 4 }], 'Les fichiers ressortent un mois plus tard sur un forum.'),
      ],
    }),
  },
  {
    tag: 'consultation_locale', weight: 0.6, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Le cahier de doléances déborde',
      context: 'Votre consultation en ligne a reçu quatre mille contributions. Il faut en tirer des propositions avant la réunion publique.',
      choices: [
        c('trier', 'Trier soi-même les contributions', [play('consultation', 'Quatre mille contributions', [s('credibility', 3), s('popularity', 2), { kind: 'dossier', domain: 'social', delta: 2 }])], 'Café, surligneur, et c’est parti.'),
        c('cabinet', 'Confier ça à un cabinet', [{ kind: 'funds', account: 'campaign', delta: -2000 }, s('credibility', 1)], 'Un rapport impeccable, que personne ne lit.'),
      ],
    }),
  },
  {
    tag: 'jeu_motus', weight: 0.6, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Invité·e d’un jeu télévisé',
      context: 'Un jeu de lettres culte vous invite pour une spéciale « élus ». Le présentateur promet de ne pas vous ménager.',
      choices: [
        c('jouer', 'Jouer le jeu', [play('motus_tele', 'Le mot en six essais', [s('popularity', 4), s('influence', 1)], [s('popularity', -2), s('credibility', -1)])], 'La boule noire vous attend.'),
        c('decliner', 'Décliner poliment', [], 'Un autre élu prend votre place. Il gagne.'),
      ],
    }),
  },
  {
    tag: 'interro_departements', weight: 0.7, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'L’interro surprise sur la carte de France',
      context: 'En direct, un chroniqueur sort une grille : « Citez-moi un département frontalier en Occitanie… » La séquence peut devenir virale, dans un sens ou dans l’autre.',
      choices: [
        c('relever', 'Relever le défi', [play('interro_carte', 'La carte de France en direct', [s('credibility', 3), s('popularity', 2), { kind: 'dossier', domain: 'territoires', delta: 2 }], [s('credibility', -4), s('popularity', -2), s('stress', 3)])], 'Vous retroussez vos manches.'),
        c('esquiver', 'Botter en touche avec humour', [s('credibility', -1)], '« Je préfère parler des Français que réciter des numéros. » On vous trouve fuyant·e.'),
      ],
    }),
  },
  {
    tag: 'quiz_rentree', weight: 1.1, minRank: 'conseiller_municipal',
    eligible: d => monthIndex(d.week) === 8,
    build: () => ({
      title: 'Le grand quiz de la rentrée politique',
      context: 'Comme chaque septembre, une chaîne réunit des élus pour un quiz sur les institutions, l’histoire et la géographie. Une bonne note, et l’on vous trouve sérieux·se.',
      choices: [
        c('jouer', 'Participer', [play('quiz_tele', 'Le quiz de la rentrée', [s('credibility', 3), s('popularity', 3)], [s('credibility', -3), s('popularity', -1)])], 'Le buzzer est chaud.'),
        c('non', 'Laisser la place aux autres', [], 'Vous regardez l’émission chez vous. Vous auriez su répondre.'),
      ],
    }),
  },
  {
    tag: 'crue', weight: 0.6,
    eligible: d => [0, 1, 2, 10, 11].includes(monthIndex(d.week)),
    build: () => ({
      title: 'La rivière sort de son lit',
      context: 'Trois jours de pluie : les caves sont inondées, la départementale est coupée, des familles dorment au gymnase.',
      choices: [
        c('sacs', 'Remplir des sacs de sable avec les bénévoles', [s('popularity', 4), s('energy', -10), { kind: 'contact', contactId: 'ct-maires', trust: 3 }], 'Les photos de vous, trempé·e, font le tour du département.'),
        c('catnat', 'Obtenir l’état de catastrophe naturelle', [s('credibility', 3), s('influence', 1), s('stress', 3)], 'Coups de fil au préfet, dossier bouclé en dix jours : les assurances paieront.'),
        c('com', 'Un communiqué de soutien', [s('popularity', -2)], '« Où était-il·elle ? » demandent les sinistrés.'),
      ],
    }),
  },
  {
    tag: 'question_collegien', weight: 0.7,
    build: () => ({
      title: 'La question du collégien',
      context: 'En visite dans une classe de 4e, un élève lève la main : « Est-ce que vous avez déjà menti pour être élu·e ? » Un parent filme.',
      choices: [
        c('franchise', 'Répondre avec franchise', [s('credibility', 3), s('popularity', 2)], '« J’ai parfois promis trop vite. » La vidéo est partagée pour de bonnes raisons.'),
        c('pirouette', 'S’en tirer par une pirouette', [s('popularity', 1), s('credibility', -1)], 'La classe rit. L’élève, lui, n’est pas dupe.'),
        c('jamais', '« Jamais ! »', [s('credibility', -3)], 'Les commentaires sous la vidéo exhument vos anciennes promesses.'),
      ],
    }),
  },
  {
    tag: 'boulangerie', weight: 0.6,
    build: () => ({
      title: 'La dernière boulangerie ferme',
      context: 'Le boulanger part à la retraite sans repreneur. Le village n’aura plus de pain, et les habitants vous regardent.',
      choices: [
        c('repreneur', 'Chercher un repreneur avec la chambre des métiers', [s('popularity', 3), { kind: 'dossier', domain: 'territoires', delta: 3 }, s('energy', -6)], 'Un jeune couple reprend le fournil. Inauguration à la galette.'),
        c('local', 'Racheter le local avec la commune', [{ kind: 'funds', account: 'campaign', delta: -1500 }, s('popularity', 4)], 'Loyer modéré, artisan trouvé : la boulangerie rouvre.'),
        c('rien', 'C’est le marché', [s('popularity', -3)], 'Le dépôt de pain de la supérette ne remplace pas la boulangerie.'),
      ],
    }),
  },
  {
    tag: 'addition_salee', weight: 0.5, minRank: 'depute',
    build: () => ({
      title: 'L’addition salée',
      context: 'Un site d’information publie la note d’un dîner à 420 € réglé avec vos frais de mandat. Le homard est en photo.',
      choices: [
        c('rembourser', 'Rembourser et s’excuser', [{ kind: 'funds', account: 'personal', delta: -420 }, s('credibility', 1), s('popularity', -1)], 'L’affaire s’éteint en deux jours.'),
        c('justifier', 'Justifier : « Un dîner de travail »', [s('credibility', -3), { kind: 'exposure', delta: 4 }], 'Les convives démentent avoir parlé travail.'),
      ],
    }),
  },
  {
    tag: 'velo_vole', weight: 0.5,
    build: () => ({
      title: 'On vous a volé votre vélo',
      context: 'Votre vieux vélo, attaché devant la permanence, a disparu. Il ne reste que l’antivol, coupé net.',
      choices: [
        c('humour', 'En faire un post plein d’humour', [s('popularity', 3)], '« Avis de recherche : vélo rouge, très engagé politiquement. » 40 000 partages, et le vélo est retrouvé.'),
        c('plainte', 'Porter plainte, comme tout le monde', [s('credibility', 1), s('stress', 1)], 'Le commissariat vous donne un récépissé et un sourire las.'),
      ],
    }),
  },
  {
    tag: 'podcast_humour', weight: 0.6, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Le podcast qui pique',
      context: 'Un podcast humoristique très écouté invite des élus à un quiz sur la vie politique. Les mauvaises réponses deviennent des mèmes.',
      choices: [
        c('jouer', 'Relever le défi', [play('trivial', 'Le quiz du podcast', [s('popularity', 4), s('credibility', 1)], [s('popularity', -2), s('credibility', -2)])], 'Le générique est déjà moqueur.'),
        c('non', 'Décliner', [], 'Ils lisent votre refus à l’antenne, avec une voix de robot.'),
      ],
    }),
  },
  {
    tag: 'lettre_anonyme', weight: 0.5, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Une lettre anonyme',
      context: 'Une lettre non signée accuse l’un de vos proches collaborateurs de favoriser un entrepreneur ami.',
      choices: [
        c('enqueter', 'Vérifier discrètement', [s('stress', 3), s('credibility', 2)], 'Les marchés sont en règle. Vous savez désormais qui écrit des lettres anonymes.'),
        c('procureur', 'Transmettre au procureur', [s('credibility', 3), { kind: 'cohesion', delta: -2 }], 'L’enquête blanchit votre collaborateur. Il vous en veut un peu.'),
        c('ignorer', 'Jeter la lettre', [{ kind: 'exposure', delta: 3 }], 'Une copie arrive aussi à la presse locale.'),
      ],
    }),
  },
  {
    tag: 'grele', weight: 0.6,
    eligible: d => [4, 5, 6].includes(monthIndex(d.week)),
    build: () => ({
      title: 'La grêle a haché les vignes',
      context: 'Vingt minutes d’orage et la récolte de l’année est perdue sur trois communes. Les viticulteurs vous attendent.',
      choices: [
        c('terrain', 'Aller sur les parcelles dès le lendemain', [s('popularity', 3), { kind: 'dossier', domain: 'ecologie', delta: 2 }, s('energy', -6)], 'Vous écoutez longtemps. Ils s’en souviendront.'),
        c('fonds', 'Débloquer un fonds d’urgence', [{ kind: 'funds', account: 'campaign', delta: -1000 }, s('popularity', 2), s('credibility', 2)], 'Une aide versée en trois semaines, un record.'),
        c('ministre', 'Interpeller le ministre de l’Agriculture', [s('influence', 2), s('credibility', 1)], 'Le ministre promet une visite. Il viendra, en septembre.'),
      ],
    }),
  },
  {
    tag: 'fusion_communes', weight: 0.5, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Projet de fusion de communes',
      context: 'Trois petites communes veulent fusionner pour mutualiser leurs services. Les anciens craignent de perdre leur mairie et leur nom.',
      choices: [
        c('soutenir', 'Soutenir la fusion', [{ kind: 'dossier', domain: 'territoires', delta: 3 }, s('credibility', 2), { kind: 'contact', contactId: 'ct-maires', trust: -2 }], 'La commune nouvelle naît. Les clochers restent, les panneaux changent.'),
        c('referendum', 'Proposer une consultation locale', [s('popularity', 2), s('credibility', 1)], 'Les habitants votent oui à 58 %. Personne ne peut contester.'),
        c('opposer', 'S’y opposer', [s('popularity', 1), { kind: 'contact', contactId: 'ct-maires', trust: 3 }], 'Le projet est enterré. Les comptes, eux, restent dans le rouge.'),
      ],
    }),
  },
  {
    tag: 'ancien_camarade', weight: 0.5, minRank: 'depute',
    build: () => ({
      title: 'Un ancien camarade devenu lobbyiste',
      context: 'Votre voisin d’amphi, aujourd’hui représentant d’un grand groupe pharmaceutique, vous invite dans un restaurant étoilé « pour le plaisir ».',
      choices: [
        c('accepter', 'Accepter le dîner', [s('influence', 2), { kind: 'exposure', delta: 3 }], 'Il n’a parlé de son amendement qu’au dessert.'),
        c('declarer', 'Accepter et le déclarer à la déontologue', [s('credibility', 2), s('influence', 1)], 'Tout est transparent, et l’ambiance un peu froide.'),
        c('decliner', 'Décliner', [s('credibility', 1)], 'Un café en terrasse, à vos frais, suffira.'),
      ],
    }),
  },
  {
    tag: 'chiffre_faux', weight: 0.6, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Le mauvais chiffre en direct',
      context: 'À la radio, vous annoncez « 30 % de chômage chez les jeunes du département ». Le chiffre réel est de 13 %. L’animateur vous reprend.',
      choices: [
        c('corriger', 'Corriger aussitôt', [s('credibility', 1)], '« Je me suis trompé·e, merci. » On vous en sait gré.'),
        c('maintenir', 'Maintenir le chiffre', [s('credibility', -4), { kind: 'exposure', delta: 2 }], 'Les fact-checkeurs publient un article le soir même.'),
        c('reviser', 'Promettre de réviser ses fiches', [play('fiches', 'Réviser ses fiches', [s('credibility', 3), { kind: 'dossier', domain: 'economie', delta: 2 }])], 'Vous passez la nuit sur les chiffres de l’Insee.'),
      ],
    }),
  },
  {
    tag: 'mot_journal', weight: 0.5,
    build: () => ({
      title: 'Le défi du journal local',
      context: 'La gazette lance un défi aux élus : trouver le mot du jour en six essais. Les scores seront publiés vendredi.',
      choices: [
        c('jouer', 'Relever le défi', [play('mot_du_jour', 'Le mot de la gazette', [s('popularity', 3)], [s('popularity', -1)])], 'Première lettre : à vous de jouer.'),
        c('non', 'Laisser jouer les autres', [], 'Votre adversaire le trouve en deux coups. La gazette le souligne.'),
      ],
    }),
  },
  {
    tag: 'ceremonie_11_novembre', weight: 1.5, minRank: 'conseiller_municipal',
    eligible: d => monthIndex(d.week) === 10,
    build: () => ({
      title: 'La cérémonie du 11 Novembre',
      context: 'Le maire vous a demandé de présider la cérémonie au monument aux morts. Les anciens combattants observent chaque geste.',
      choices: [
        c('presider', 'Présider la cérémonie', [play('protocole', 'Le 11 Novembre', [s('credibility', 3), s('popularity', 2)], [s('credibility', -2), s('stress', 3)])], 'Les porte-drapeaux se mettent en place.'),
        c('assister', 'Assister au second rang', [s('popularity', 1)], 'Vous chantez la Marseillaise avec les enfants des écoles.'),
      ],
    }),
  },
  {
    tag: 'diner_officiel', weight: 0.7, minRank: 'ministre',
    build: () => ({
      title: 'Le plan de table du dîner officiel',
      context: 'Le chef du protocole est malade. Ce soir, deux cents invités, dont des ennemis jurés, et c’est à vous de faire le plan de table.',
      choices: [
        c('placer', 'S’en charger personnellement', [play('plan_table', 'Le dîner officiel', [s('influence', 3), { kind: 'intl', prestige: 2 }], [s('influence', -2), { kind: 'intl', prestige: -1 }])], 'Vous dépliez le plan de la salle des fêtes.'),
        c('deleguer', 'Confier la tâche à votre cabinet', [s('stress', -1)], 'Un ambassadeur se retrouve à côté des cuisines. Il s’en souviendra.'),
      ],
    }),
  },
  {
    tag: 'banquet_republicain', weight: 0.6, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Le banquet républicain',
      context: 'Pour le 14 Juillet, la commune organise un banquet. Les organisateurs vous laissent le plan de table… et les maires brouillés.',
      choices: [
        c('placer', 'Faire le plan de table', [play('banquet_maires', 'Le banquet républicain', [{ kind: 'contact', contactId: 'ct-maires', trust: 5 }, s('popularity', 2)])], 'Vous sortez votre stylo et une nappe en papier.'),
        c('libre', 'Placement libre', [s('popularity', 1), { kind: 'contact', contactId: 'ct-maires', trust: -2 }], 'Deux maires en viennent presque aux mains au dessert.'),
      ],
    }),
  },
  {
    tag: 'visite_chef_etat', weight: 0.6, minRank: 'depute',
    build: () => ({
      title: 'Une visite d’État dans votre région',
      context: 'Un président étranger fait étape dans votre ville. Le préfet vous demande de l’accueillir sur le parvis de l’hôtel de ville.',
      choices: [
        c('accueillir', 'L’accueillir selon le protocole', [play('visite_etat', 'Les honneurs sur le parvis', [s('influence', 2), s('credibility', 2), { kind: 'intl', prestige: 1 }])], 'La garde se met au garde-à-vous.'),
        c('decliner', 'Laisser le préfet s’en charger', [], 'Vous suivez la visite à la télévision régionale.'),
      ],
    }),
  },
  {
    tag: 'tour_exterieur', weight: 0.7, minRank: 'militant',
    eligible: d => !d.player.civil && ['militant', 'conseiller_municipal'].includes(d.player.rankId) && d.player.stats.credibility >= 40 && d.player.age >= 30,
    build: () => ({
      title: 'Une nomination au tour extérieur',
      context: 'Le gouvernement cherche des profils venus de la société civile. On vous propose d’entrer dans la haute fonction publique sans passer le concours.',
      choices: [
        c('accepter', 'Accepter la nomination', [{ kind: 'civil', join: 'tour' }, s('credibility', 2)], 'Le décret paraît au Journal officiel. Certains crient au « recasage ».'),
        c('refuser', 'Rester libre', [s('influence', -1)], 'Vous préférez garder votre liberté de parole.'),
      ],
    }),
  },
  {
    tag: 'devoir_reserve', weight: 0.8, minRank: 'militant',
    eligible: d => !!d.player.civil && ['militant', 'conseiller_municipal'].includes(d.player.rankId),
    build: () => ({
      title: 'Le devoir de réserve',
      context: 'Votre directeur vous convoque : vos prises de position publiques « posent problème » à un haut fonctionnaire. Il exige plus de discrétion.',
      choices: [
        c('discretion', 'Promettre la discrétion', [s('credibility', 1), s('popularity', -1)], 'Vous lissez vos tweets. Vos militants s’impatientent.'),
        c('assumer', 'Assumer votre engagement', [s('popularity', 2), { kind: 'civil', grade: -1 }], 'Mutation dans un service moins exposé. Votre parti salue votre courage.', {
          risk: { baseChance: 0.5, onFailure: [{ kind: 'stat', stat: 'stress', delta: 4 }], failureNews: 'Un avertissement est versé à votre dossier.' },
        }),
      ],
    }),
  },
  {
    tag: 'mutation_outremer', weight: 0.6, minRank: 'militant',
    eligible: d => !!d.player.civil && ['militant', 'conseiller_municipal'].includes(d.player.rankId) && (d.player.civil?.grade ?? 0) < 3,
    build: () => ({
      title: 'Une mutation outre-mer',
      context: 'On vous propose un poste à responsabilité à La Réunion, avec une promotion à la clé. Il faudra s’éloigner de votre circonscription.',
      choices: [
        c('partir', 'Accepter la mutation', [{ kind: 'civil', grade: 1 }, s('influence', -2), s('stress', 3)], 'Deux ans loin de la métropole : votre réseau local s’effrite, votre dossier s’étoffe.'),
        c('rester', 'Décliner', [s('influence', 1)], 'Votre directeur prend note. Pour l’avancement, il faudra attendre.'),
      ],
    }),
  },
  // ── Équipe, salaires, revenus ───────────────────────────
  {
    tag: 'augmentation_demandee', weight: 1, minRank: 'militant',
    eligible: d => d.player.team.length > 0,
    build: (d, rng) => {
      const r = rng.pick(d.player.team);
      return {
        title: `${r.name} demande une augmentation`,
        context: `« Ça fait des mois que je fais le travail de deux personnes. » ${r.name} gagne ${r.salary.toLocaleString('fr-FR')} € par mois et vous regarde droit dans les yeux.`,
        choices: [
          c('accorder', 'Accorder 10 %', [{ kind: 'team', recruitId: r.id, salaryPct: 10, morale: 20 }], 'Un grand sourire, et une énergie retrouvée.'),
          c('moitie', 'Proposer 5 %', [{ kind: 'team', recruitId: r.id, salaryPct: 5, morale: 6 }], '« C’est un début. »'),
          c('refuser', 'Refuser : les caisses sont vides', [{ kind: 'team', recruitId: r.id, morale: -25 }], 'Un silence glacial. Il ou elle commence à regarder les offres d’emploi.'),
        ],
      };
    },
  },
  {
    tag: 'debauchage', weight: 0.8, minRank: 'conseiller_municipal',
    eligible: d => d.player.team.length > 0,
    build: (d, rng) => {
      const r = rng.pick(d.player.team);
      return {
        title: `Un rival veut débaucher ${r.name}`,
        context: `Un adversaire propose à ${r.name} 30 % de plus pour rejoindre son équipe. Votre collaborateur·rice vous laisse une chance de surenchérir.`,
        choices: [
          c('surencherir', 'Surenchérir : +20 %', [{ kind: 'team', recruitId: r.id, salaryPct: 20, morale: 15 }], 'Fidélité retrouvée, masse salariale alourdie.'),
          c('loyaute', 'En appeler à la loyauté', [{ kind: 'team', recruitId: r.id, morale: -10 }, s('influence', 1)], 'Il ou elle reste… pour l’instant.', {
            risk: { baseChance: 0.4, onFailure: [{ kind: 'team', recruitId: r.id, morale: -60 }], failureNews: 'Les arguments n’ont pas suffi : le moral s’effondre, la porte n’est plus loin.' },
          }),
          c('laisser', 'Le ou la laisser partir avec élégance', [{ kind: 'team', recruitId: r.id, leave: true }, s('credibility', 1)], 'Un pot de départ, des bises, et un poste vacant.'),
        ],
      };
    },
  },
  {
    tag: 'equipe_greve', weight: 0.9, minRank: 'conseiller_municipal',
    eligible: d => d.player.team.length >= 3 && d.player.team.reduce((t, r) => t + (r.morale ?? 60), 0) / d.player.team.length < 40,
    build: () => ({
      title: 'Fronde dans votre équipe',
      context: 'Salaires bas, horaires impossibles : votre équipe vous remet une lettre collective. Ils menacent de tout arrêter avant la fin du mois.',
      choices: [
        c('augmenter', 'Augmenter tout le monde de 8 %', [{ kind: 'team', all: true, salaryPct: 8, morale: 20 }], 'La lettre finit à la corbeille, le sourire revient.'),
        c('dialogue', 'Réunion de crise et promesses', [{ kind: 'team', all: true, morale: 8 }, s('stress', 4)], 'On vous laisse une chance. Une seule.'),
        c('fermete', 'Rappeler qui est le patron', [{ kind: 'team', all: true, morale: -15 }, s('influence', 1)], 'Le travail reprend, dans un silence pesant.'),
      ],
    }),
  },
  {
    tag: 'pot_equipe', weight: 0.6, minRank: 'militant',
    eligible: d => d.player.team.length >= 2,
    build: () => ({
      title: 'Le pot de l’équipe',
      context: 'C’est l’anniversaire de la permanence : votre équipe a organisé un pot surprise, avec un gâteau à votre effigie.',
      choices: [
        c('rester', 'Rester toute la soirée', [{ kind: 'team', all: true, morale: 10 }, s('stress', -3), s('energy', -3)], 'Karaoké jusqu’à minuit. Les liens se resserrent.'),
        c('passer', 'Passer en coup de vent', [{ kind: 'team', all: true, morale: -3 }], 'Vous partez avant le gâteau. On le remarque.'),
      ],
    }),
  },
  {
    tag: 'offre_conseil_admin', weight: 0.6, minRank: 'militant',
    eligible: d => ['militant', 'conseiller_municipal', 'ancien_president'].includes(d.player.rankId) && !(d.player.sideIncomes ?? []).some(x => x.id === 'jetons') && d.player.stats.influence >= 25,
    build: () => ({
      title: 'Un siège au conseil d’administration',
      context: 'Une entreprise régionale vous propose un siège d’administrateur : six réunions par an, 1 800 € par mois de jetons de présence.',
      choices: [
        c('accepter', 'Accepter', [{ kind: 'side', id: 'jetons', label: 'Jetons de présence', amount: 1800, exposure: 0.5 }, s('influence', 2)], 'Votre première séance porte sur un plan social. Ambiance.'),
        c('refuser', 'Décliner pour rester libre', [s('credibility', 2)], 'Vous gardez votre indépendance.'),
      ],
    }),
  },
  {
    tag: 'controle_fiscal', weight: 0.6, minRank: 'conseiller_municipal',
    eligible: d => (d.player.sideIncomes ?? []).length > 0 || d.player.scandalExposure > 35,
    build: () => ({
      title: 'Contrôle fiscal',
      context: 'Un inspecteur des finances publiques épluche vos revenus annexes des trois dernières années. Quelques lignes posent question.',
      choices: [
        c('payer', 'Régulariser sans discuter', [{ kind: 'funds', account: 'personal', delta: -4000 }, s('credibility', 1)], 'Redressement payé. Personne n’en saura rien.'),
        c('contester', 'Contester avec un avocat fiscaliste', [{ kind: 'funds', account: 'personal', delta: -1500 }, s('stress', 4)], 'Le recours suit son cours.', {
          risk: { baseChance: 0.4, onFailure: [{ kind: 'funds', account: 'personal', delta: -6000 }, { kind: 'exposure', delta: 6 }], failureNews: 'Recours rejeté, pénalités en plus, et la presse a eu vent de l’affaire.' },
        }),
      ],
    }),
  },
  {
    tag: 'adaptation_livre', weight: 0.5, minRank: 'militant',
    eligible: d => (d.player.sideIncomes ?? []).some(x => x.id === 'droits'),
    build: () => ({
      title: 'Votre livre adapté à l’écran',
      context: 'Une plateforme veut adapter votre livre en mini-série. Un acteur connu pour jouer… vous.',
      choices: [
        c('ceder', 'Céder les droits', [{ kind: 'funds', account: 'personal', delta: 15000 }, s('popularity', 3)], 'Le tournage commence l’été prochain.'),
        c('controle', 'Exiger un droit de regard sur le scénario', [{ kind: 'funds', account: 'personal', delta: 8000 }, s('credibility', 1)], 'Moins d’argent, mais pas de caricature.'),
        c('refuser', 'Refuser', [], 'On ne fait pas de série sur vous de votre vivant.'),
      ],
    }),
  },
  {
    tag: 'billet_gagnant', weight: 0.3, minRank: 'militant',
    build: () => ({
      title: 'Un billet gagnant',
      context: 'Le jeu à gratter acheté au tabac du marché : 5 000 €. Le buraliste a déjà prévenu la presse locale.',
      choices: [
        c('association', 'Tout reverser à une association', [s('popularity', 3), s('credibility', 1)], 'La photo du chèque fait la une du journal local.'),
        c('garder', 'Garder le gain', [{ kind: 'funds', account: 'personal', delta: 5000 }, s('popularity', -1)], '« Un élu qui joue à l’argent ? » Quelques remarques, rien de grave.'),
      ],
    }),
  },
  {
    tag: 'salaire_polemique', weight: 1.2, minRank: 'militant',
    eligible: d => Number(d.player.flags['partyPayPct'] ?? 0) > 20 || Number(d.player.flags['presPayPct'] ?? 0) > 20,
    build: d => {
      const pres = Number(d.player.flags['presPayPct'] ?? 0) > 20 && !!d.presidency;
      return {
        title: pres ? 'Le traitement du président fait polémique' : 'Votre salaire de chef de parti fuite',
        context: pres ? 'Un hebdomadaire titre : « Le président le mieux payé de la Ve République ». Les syndicats s’en emparent.' : 'Un militant a publié votre fiche de paie sur les réseaux. Les fédérations s’agitent.',
        choices: [
          c('baisser', 'Revenir au salaire d’origine', [{ kind: 'leaderPay', ...(pres ? { president: 0 } : { party: 0 }) }, s('credibility', 1)], 'Le geste calme les esprits.'),
          c('justifier', 'Justifier : « C’est le prix des responsabilités »', [s('popularity', -3), { kind: 'exposure', delta: 3 }], 'La justification passe mal.'),
        ],
      };
    },
  },
  {
    tag: 'erreur_gps', weight: 0.5, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Perdu·e sur la route',
      context: 'Le GPS vous envoie dans un chemin de terre. Vous arriverez avec quarante minutes de retard à l’inauguration de la médiathèque.',
      choices: [
        c('rire', 'En rire à votre arrivée', [s('popularity', 2)], '« La France des territoires, je la connais… même ses chemins vicinaux ! » La salle rit.'),
        c('chauffeur', 'Accuser le chauffeur', [s('popularity', -2), { kind: 'team', all: true, morale: -5 }], 'L’anecdote fait le tour de la ville, et de votre équipe.'),
      ],
    }),
  },
  {
    tag: 'faux_compte', weight: 0.6, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Un faux compte à votre nom',
      context: 'Un compte se fait passer pour vous et publie des énormités. Des milliers d’abonnés y croient.',
      choices: [
        c('signaler', 'Le faire suspendre et porter plainte', [s('credibility', 2), s('stress', 2)], 'Le compte disparaît en deux jours.'),
        c('humour', 'Répondre avec humour depuis votre vrai compte', [s('popularity', 3)], '« Moi, au moins, je ne promets pas la semaine de deux jours. » Le vrai vous gagne des abonnés.'),
      ],
    }),
  },
  {
    tag: 'centenaire', weight: 0.6, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Les cent ans de Madame Lucienne',
      context: 'La doyenne de la commune fête ses cent ans à l’EHPAD. Elle a demandé que vous veniez « parce que vous avez une bonne tête ».',
      choices: [
        c('aller', 'Y aller avec des fleurs', [s('popularity', 2), s('stress', -3), { kind: 'dossier', domain: 'sante', delta: 1 }], 'Elle vous raconte 1944. Vous restez deux heures.'),
        c('lettre', 'Lui envoyer une lettre', [s('popularity', 1)], 'Elle l’affiche au-dessus de son lit.'),
      ],
    }),
  },
  {
    tag: 'fibre_village', weight: 0.6, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Le village sans internet',
      context: 'Trois hameaux attendent la fibre depuis cinq ans. Les télétravailleurs menacent de déménager.',
      choices: [
        c('operateur', 'Convoquer l’opérateur', [{ kind: 'dossier', domain: 'numerique', delta: 3 }, s('credibility', 2), s('energy', -4)], 'Un calendrier de travaux, enfin.'),
        c('relais', 'Installer un relais 4G provisoire', [{ kind: 'funds', account: 'campaign', delta: -1500 }, s('popularity', 3)], 'Les habitants respirent… et regardent leurs séries.'),
        c('promettre', 'Promettre que ça viendra', [s('popularity', -1)], 'On vous l’a déjà dit, répondent-ils.'),
      ],
    }),
  },
  {
    tag: 'saisonniers', weight: 0.5, minRank: 'conseiller_municipal',
    eligible: d => [5, 6, 7].includes(monthIndex(d.week)),
    build: () => ({
      title: 'Les saisonniers dorment dans leurs voitures',
      context: 'Vendanges, cueillettes, campings : des centaines de saisonniers ne trouvent pas de logement. Les employeurs s’inquiètent.',
      choices: [
        c('internat', 'Ouvrir les internats vides l’été', [s('popularity', 3), { kind: 'dossier', domain: 'social', delta: 2 }, { kind: 'contact', contactId: 'ct-maires', trust: 2 }], 'Une solution simple, saluée par tous.'),
        c('employeurs', 'Renvoyer la balle aux employeurs', [s('credibility', -1)], 'Ils vous en tiendront rigueur aux prochaines élections consulaires.'),
      ],
    }),
  },
];

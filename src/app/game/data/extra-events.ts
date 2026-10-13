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
        c('cabinet', 'Confier ça à un cabinet', [{ kind: 'funds', account: 'campaign', delta: -2000 }, s('credibility', 1)], 'Un rapport impeccable, que personne ne lit.', { needMoney: 2000 }),
      ],
    }),
  },
];

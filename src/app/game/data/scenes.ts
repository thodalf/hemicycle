import { Effect, GameState } from '../models/game.models';
import { SceneChoiceDef, SceneDef } from './scene-types';
import { balanceScene } from './balance';
import { PARTIES, ofParty } from './world';
import { SALON } from './scene-salon';

/* ============================================================
 *  Six scènes interactives, du marché du dimanche à la cellule
 *  de crise. Chaque scène : jauges, étapes, score, conséquences.
 * ============================================================ */

type Opts = Partial<Pick<SceneChoiceDef, 'hint' | 'requires' | 'money' | 'risk' | 'next'>>;
const ch = (id: string, label: string, delta: Record<string, number>, text: string, opts: Opts = {}): SceneChoiceDef =>
  ({ id, label, delta, text, ...opts });

const stat = (s: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat: s, delta });

// ── 1. Marché du dimanche ───────────────────────────────────

const encounter = (id: string, title: string, context: string, flavor: { listen: string; promise: string; facts: string; tract: string }) => ({
  id, title, context,
  choices: [
    ch('ecouter', flavor.listen, { convaincus: 8, energie: -12, image: 5 }, 'Vous prenez le temps. On vous en sait gré.'),
    ch('promettre', flavor.promise, { convaincus: 14, image: -2 }, 'Votre promesse fait mouche.', {
      risk: { chance: 0.45, scaleWith: 'credibility', weight: 0.6, onFail: { convaincus: 4, image: -10 }, failText: '« Vous dites tous ça. » La promesse sonne creux.' },
    }),
    ch('chiffres', flavor.facts, { convaincus: 16, energie: -6 }, 'Arguments solides : vous emportez l’adhésion.', {
      hint: 'Dépend de votre maîtrise du sujet à la une.',
      risk: { chance: 0.8, scaleWith: 'dossier', weight: 1, onFail: { convaincus: 2, image: -6, energie: -6 }, failText: 'Vous vous embrouillez dans vos chiffres.' },
    }),
    ch('tract', flavor.tract, { convaincus: 4, energie: 4 }, 'Un sourire, un tract, au suivant.'),
  ],
});

const MARCHE: SceneDef = {
  id: 'marche', title: 'Le marché du dimanche', eyebrow: 'Terrain',
  intro: 'Trois heures entre les étals, un sac de tracts et un sujet qui fait l’actualité : {domaine}.',
  band: '#2c3a2c', minRank: 'militant', domain: 'agenda',
  gauges: [
    { id: 'convaincus', label: 'Électeurs convaincus', min: 0, max: 100, start: 0, good: 'high' },
    { id: 'energie', label: 'Énergie', min: 0, max: 100, start: d => Math.round(d.player.stats.energy * 0.7), good: 'high',
      danger: { below: 8, label: 'À bout de souffle', text: 'Vous écourtez la tournée, épuisé·e.', end: true } },
    { id: 'image', label: 'Réputation locale', min: -50, max: 50, start: 0, good: 'high', format: 'signed' },
  ],
  stages: [['m_retraitee', 'm_livreur', 'm_commercant'], ['m_adversaire', 'm_mere', 'm_agri'], ['m_retraitee', 'm_livreur', 'm_commercant', 'm_mere', 'm_agri'], ['m_journal']],
  steps: [
    encounter('m_retraitee', 'Une retraitée inquiète', '« Avec ma pension, je ne m’en sors plus. Et vous, qu’est-ce que vous allez faire ? »',
      { listen: 'L’écouter raconter ses fins de mois', promise: 'Promettre de défendre les pensions', facts: 'Lui expliquer votre proposition, chiffres à l’appui', tract: 'Lui laisser un tract' }),
    encounter('m_livreur', 'Un jeune livreur désabusé', '« La politique ? Ça ne change rien pour des gens comme moi. »',
      { listen: 'Parler avec lui de ses conditions de travail', promise: 'Promettre un vrai statut pour les livreurs', facts: 'Lui montrer ce qui a changé grâce au vote des jeunes', tract: 'Lui tendre un tract et le laisser filer' }),
    encounter('m_commercant', 'Un commerçant en colère', '« Les charges, les loyers, les travaux dans la rue… On va tous fermer ! »',
      { listen: 'Le laisser vider son sac', promise: 'Promettre un moratoire sur les travaux', facts: 'Détailler les aides auxquelles il a droit', tract: 'Acheter une baguette et repartir' }),
    {
      id: 'm_adversaire', title: 'Un militant adverse vous provoque',
      context: 'Devant la foule du marché : « Alors, vous venez chercher des voix maintenant ? »',
      choices: [
        ch('ignorer', 'Ignorer la provocation avec le sourire', { image: 4 }, 'Votre calme est remarqué.'),
        ch('debattre', 'Débattre devant les passants', { convaincus: 18, energie: -15 }, 'Un attroupement se forme : vous marquez des points.', {
          risk: { chance: 0.45, scaleWith: 'influence', weight: 0.6, onFail: { convaincus: 4, image: -10, energie: -15 }, failText: 'La joute tourne à votre désavantage.' },
        }),
        ch('repartie', 'Répondre du tac au tac', { convaincus: 10, image: -5 }, 'Les rieurs sont de votre côté, les autres moins.'),
      ],
    },
    encounter('m_mere', 'Une mère de famille', '« L’école du quartier ferme une classe. Vous comptez faire quoi ? »',
      { listen: 'L’écouter, prendre ses coordonnées', promise: 'Promettre de vous battre pour la classe', facts: 'Expliquer le calcul des effectifs et vos solutions', tract: 'Lui donner un tract pour l’association des parents' }),
    encounter('m_agri', 'Un maraîcher derrière son étal', '« Les normes, les prix, les supermarchés… On travaille à perte. »',
      { listen: 'L’aider à décharger ses cagettes en discutant', promise: 'Promettre des prix plancher', facts: 'Comparer avec vous les marges de la grande distribution', tract: 'Lui acheter des légumes et filer' }),
    {
      id: 'm_journal', title: 'Le correspondant du journal local',
      context: '« Un mot pour nos lecteurs sur votre matinée ? »',
      choices: [
        ch('bilan', 'Raconter les rencontres de la matinée', { convaincus: 6, image: 6 }, 'Un portrait sympathique paraît mardi.'),
        ch('annonce', 'Annoncer une proposition locale', { convaincus: 10, image: 4 }, 'Votre proposition fait la une de l’édition locale.', {
          requires: { minMastery: 35 }, hint: 'Exige de maîtriser le sujet à la une (35).',
        }),
        ch('attaque', 'Attaquer le maire sortant', { convaincus: 8, image: -6 }, 'L’article insiste surtout sur la polémique.'),
        ch('photo', 'Une photo avec les commerçants, pas de déclaration', { image: 3, energie: 5 }, 'La photo est jolie, l’article court.'),
      ],
    },
  ],
  score: g => g['convaincus'] + g['image'] * 0.5 - (g['energie'] <= 8 ? 15 : 0),
  thresholds: { succes: 40, mitige: 22 },
  outcomes: {
    succes: 'Le quartier parle de vous. Les militants rentrent galvanisés.',
    mitige: 'Quelques contacts utiles, sans plus.',
    echec: 'Une matinée pour rien, ou presque.',
  },
  rewards: (status) => status === 'succes'
    ? [stat('popularity', 4), { kind: 'momentum', delta: 6 }, stat('influence', 1), { kind: 'dossier', domain: '$domain', delta: 3 }, stat('energy', -8)]
    : status === 'mitige' ? [stat('popularity', 2), stat('energy', -8)]
    : [stat('popularity', -1), stat('stress', 5), stat('energy', -8)],
};

// ── 2. Grand meeting ────────────────────────────────────────

const MEETING: SceneDef = {
  id: 'meeting', title: 'Grand meeting', eyebrow: 'Campagne',
  intro: 'Une salle à remplir, un discours à porter, des caméras à séduire.',
  band: '#1d2440', minRank: 'conseiller_municipal', domain: 'agenda',
  gauges: [
    { id: 'salle', label: 'Remplissage', min: 0, max: 100, start: d => 35 + d.player.stats.popularity * 0.5, good: 'high', format: 'pct' },
    { id: 'ferveur', label: 'Ferveur', min: 0, max: 100, start: 30, good: 'high' },
    { id: 'medias', label: 'Médias', min: 0, max: 100, start: d => 15 + d.player.stats.influence / 4, good: 'high' },
  ],
  stages: [['g_salle'], ['g_premiere'], ['g_discours'], ['g_perturbateurs', 'g_son', 'g_malaise'], ['g_final']],
  steps: [
    {
      id: 'g_salle', title: 'Choisir la salle', context: 'Votre équipe a trois options. Une salle trop grande, et les photos seront cruelles.',
      choices: [
        ch('gymnase', 'Un gymnase de quartier, intime', { salle: 20, medias: -5 }, 'Salle comble, ambiance chaleureuse.'),
        ch('palais', 'Le palais des congrès', { salle: -5, ferveur: 10, medias: 15 }, 'Une scène à la hauteur de vos ambitions.', {
          money: 4000, hint: '4 000 €. Il faut le remplir.',
          risk: { chance: 0.5, scaleWith: 'popularity', weight: 0.8, onFail: { salle: -25, medias: 5 }, failText: 'Des rangées vides : les photos font le tour des réseaux.' },
        }),
        ch('plein_air', 'En plein air, place de la mairie', { salle: 8, medias: 10 }, 'Le soleil est de la partie.', {
          risk: { chance: 0.3, onFail: { salle: -20, ferveur: -10 }, failText: 'Il pleut à verse. La place se vide.' },
        }),
      ],
    },
    {
      id: 'g_premiere', title: 'Qui chauffe la salle ?', context: 'Vingt minutes avant votre entrée.',
      choices: [
        ch('temoins', 'Des témoignages de citoyens', { ferveur: 10, medias: 5 }, 'Des histoires simples, qui touchent juste.'),
        ch('artiste', 'Un artiste populaire', { salle: 15, ferveur: 12, medias: 8 }, 'La salle chante avant même votre arrivée.', { money: 3000, hint: '3 000 €.' }),
        ch('elus', 'Les élus locaux du parti', { ferveur: 5 }, 'Discours convenus, mais le parti apprécie.'),
        ch('direct', 'Personne : vous entrez directement', { ferveur: -5, medias: 3 }, 'Entrée sobre. La salle met du temps à s’échauffer.'),
      ],
    },
    {
      id: 'g_discours', title: 'Le cœur du discours', context: 'Le sujet du moment : {domaine}. Quelle tonalité ?',
      choices: [
        ch('programme', 'Un discours programme, mesure par mesure', { ferveur: 8, medias: 14 }, 'Les journalistes notent vos mesures.', {
          requires: { minMastery: 35 }, hint: 'Exige de maîtriser le sujet (35).',
        }),
        ch('emotion', 'Des histoires vraies, de l’émotion', { ferveur: 18, medias: 6 }, 'Des larmes au premier rang.'),
        ch('combat', 'Un discours de combat contre vos adversaires', { ferveur: 22, medias: 10 }, 'La salle se lève à chaque attaque.', {
          risk: { chance: 0.4, scaleWith: 'credibility', weight: 0.6, onFail: { ferveur: 10, medias: -8 }, failText: 'Une attaque jugée trop violente fait polémique.' },
        }),
        ch('ouverture', 'Un discours d’ouverture, au-delà de votre camp', { ferveur: 5, medias: 14 }, 'Les éditorialistes saluent la hauteur de vue.'),
      ],
    },
    {
      id: 'g_perturbateurs', title: 'Des perturbateurs déploient une banderole', context: 'Au balcon, des militants adverses scandent des slogans.',
      choices: [
        ch('sortir', 'Le service d’ordre les raccompagne', { ferveur: 5, medias: -5 }, 'Incident clos en deux minutes.'),
        ch('scene', 'Les inviter à monter sur scène', { medias: 18, ferveur: 4 }, 'Vous leur donnez la parole, puis la réplique : le moment fort de la soirée.', {
          risk: { chance: 0.4, scaleWith: 'influence', weight: 0.6, onFail: { ferveur: -15, medias: 10 }, failText: 'Ils s’emparent du micro et ne le rendent plus.' },
        }),
        ch('ignorer', 'Ignorer et faire monter le son', { ferveur: 2 }, 'La musique couvre les slogans.'),
      ],
    },
    {
      id: 'g_son', title: 'Coupure de son en plein discours', context: 'Le micro s’éteint au milieu d’une phrase.',
      choices: [
        ch('chaise', 'Continuer sans micro, debout sur une chaise', { ferveur: 15, medias: 10 }, 'La salle reprend vos mots en chœur.', {
          risk: { chance: 0.35, scaleWith: 'popularity', weight: 0.6, onFail: { ferveur: -10 }, failText: 'Le fond de la salle n’entend rien et décroche.' },
        }),
        ch('pause', 'Faire une pause musicale', { ferveur: -5 }, 'Le temps de réparer, l’élan est retombé.'),
        ch('questions', 'Improviser un échange avec la salle', { ferveur: 10, medias: 5 }, 'Un moment spontané, très réussi.', {
          risk: { chance: 0.4, scaleWith: 'dossier', weight: 1, onFail: { ferveur: -6, medias: -4 }, failText: 'Une question technique vous met en difficulté.' },
        }),
      ],
    },
    {
      id: 'g_malaise', title: 'Un malaise au premier rang', context: 'Une personne s’effondre pendant votre discours.',
      choices: [
        ch('arreter', 'Arrêter le discours et appeler les secours', { ferveur: 6, medias: 8 }, 'Votre réaction humaine est saluée.'),
        ch('continuer', 'Continuer : les secouristes s’en occupent', { ferveur: -8, medias: -10 }, 'On vous reproche votre froideur.'),
      ],
    },
    {
      id: 'g_final', title: 'Le final', context: 'Dernières minutes. L’image qui restera.',
      choices: [
        ch('hymne', 'Hymne et drapeaux', { ferveur: 12 }, 'Une marée de drapeaux.'),
        ch('ralliement', 'Annoncer un ralliement de poids', { medias: 20, ferveur: 10 }, 'Une figure respectée vous rejoint sur scène : c’est l’info du soir.', {
          requires: { stat: 'influence', minStat: 40 }, hint: 'Exige une influence de 40.',
        }),
        ch('foule', 'Un bain de foule d’une heure', { ferveur: 8, medias: 6 }, 'Selfies, poignées de main, voix cassée.'),
      ],
    },
  ],
  score: g => g['salle'] * 0.3 + g['ferveur'] * 0.4 + g['medias'] * 0.3,
  thresholds: { succes: 65, mitige: 45 },
  outcomes: {
    succes: 'Un meeting réussi : les images tournent en boucle.',
    mitige: 'Un meeting correct, vite oublié.',
    echec: 'Un meeting raté : la presse parle d’une campagne qui patine.',
  },
  rewards: status => status === 'succes'
    ? [stat('popularity', 5), { kind: 'momentum', delta: 12 }, stat('influence', 2), stat('energy', -10)]
    : status === 'mitige' ? [stat('popularity', 2), { kind: 'momentum', delta: 5 }, stat('energy', -10)]
    : [stat('popularity', -2), stat('credibility', -1), stat('energy', -10), stat('stress', 6)],
};

// ── 3. Médiation sociale ────────────────────────────────────

const MEDIATION: SceneDef = {
  id: 'mediation', title: 'Médiation sociale', eyebrow: 'Négociation',
  intro: 'À {entreprise}, la grève dure depuis trois semaines. Direction et syndicats acceptent votre médiation.',
  band: '#30302a', minRank: 'depute', domain: 'social',
  setup: (_d, pick) => ({ entreprise: pick(['Aciéries du Nord', 'Logistique Atlantique', 'Pneus Arverne', 'Chantiers de l’Estuaire']) }),
  gauges: [
    { id: 'accord', label: 'Avancée vers un accord', min: 0, max: 100, start: 15, good: 'high' },
    { id: 'patience', label: 'Patience des syndicats', min: 0, max: 100, start: 60, good: 'high',
      danger: { below: 10, label: 'Rupture', text: 'Les syndicats claquent la porte : la grève est reconduite.', end: true } },
    { id: 'concessions', label: 'Coût pour la direction', min: 0, max: 100, start: 0, good: 'low',
      danger: { above: 85, label: 'La direction se retire', text: 'La direction de {entreprise} juge l’accord intenable et quitte la table.', end: true } },
  ],
  stages: [['n_ouverture'], ['n_salaires', 'n_emplois'], ['n_piquet', 'n_delocalisation'], ['n_nuit'], ['n_signature']],
  steps: [
    {
      id: 'n_ouverture', title: 'Ouverture des négociations', context: 'Autour de la table, les visages sont fermés.',
      choices: [
        ch('separement', 'Écouter chaque partie séparément', { patience: 12, accord: 5 }, 'Chacun se sent entendu.'),
        ch('calendrier', 'Imposer un calendrier serré', { accord: 10, patience: -10 }, 'Le rythme s’accélère, les syndicats grincent.'),
        ch('cafe', 'Réunir tout le monde autour d’un café', { accord: 8, patience: 5 }, 'La glace se brise.', {
          risk: { chance: 0.35, scaleWith: 'credibility', weight: 0.5, onFail: { patience: -10 }, failText: 'Le ton monte dès les premières minutes.' },
        }),
      ],
    },
    {
      id: 'n_salaires', title: 'Le nœud : les salaires', context: 'Les syndicats réclament 6 %, la direction propose 1 %.',
      choices: [
        ch('milieu', 'Proposer 3,5 % et une prime', { accord: 18, concessions: 18 }, 'Les deux camps examinent la proposition.'),
        ch('resultats', 'Indexer la hausse sur les résultats de l’entreprise', { accord: 16, concessions: 8 }, 'Une formule ingénieuse qui débloque la discussion.', {
          requires: { minMastery: 40 }, hint: 'Exige de maîtriser le dossier social (40).',
        }),
        ch('syndicats', 'Soutenir la revendication des syndicats', { accord: 8, patience: 15, concessions: 30 }, 'Les syndicats exultent, la direction blêmit.'),
        ch('direction', 'Défendre la position de la direction', { accord: 6, patience: -20 }, 'Les syndicats vous accusent de partialité.'),
      ],
    },
    {
      id: 'n_emplois', title: 'Le nœud : 400 emplois menacés', context: 'La direction veut supprimer un atelier entier.',
      choices: [
        ch('reclassement', 'Un plan de reclassement financé par la région', { accord: 18, concessions: 10 }, 'La région accepte de cofinancer.'),
        ch('moratoire', 'Un moratoire de deux ans sur les licenciements', { accord: 14, concessions: 25, patience: 10 }, 'Les syndicats y voient une victoire.'),
        ch('volontaires', 'Seulement des départs volontaires', { accord: 12, patience: -8, concessions: 6 }, 'Un compromis froid, mais un compromis.'),
        ch('repreneur', 'Chercher un repreneur pour l’atelier', { accord: 25, concessions: 5 }, 'Un industriel se montre intéressé.', {
          risk: { chance: 0.5, scaleWith: 'influence', weight: 0.6, onFail: { accord: 3, patience: -10 }, failText: 'Le repreneur se désiste au dernier moment.' },
        }),
      ],
    },
    {
      id: 'n_piquet', title: 'Un piquet de grève bloque l’usine', context: 'La direction exige le déblocage avant de continuer.',
      choices: [
        ch('parler', 'Aller parler aux grévistes', { patience: 15, accord: 5 }, 'Vous restez deux heures au piquet. Le respect est mutuel.', {
          risk: { chance: 0.3, scaleWith: 'popularity', weight: 0.6, onFail: { patience: -10 }, failText: 'Vous êtes accueilli·e par des sifflets.' },
        }),
        ch('evacuation', 'Demander l’évacuation du site', { patience: -30, accord: 5 }, 'L’usine est débloquée, la colère monte.'),
        ch('suspendre', 'Suspendre la séance', { patience: 5, accord: -5 }, 'On se reverra demain.'),
      ],
    },
    {
      id: 'n_delocalisation', title: 'La direction menace de délocaliser', context: '« Si c’est comme ça, on ferme et on part. »',
      choices: [
        ch('etat', 'Menacer de saisir l’État', { accord: 12, concessions: -10 }, 'La direction revient à de meilleurs sentiments.', {
          risk: { chance: 0.45, scaleWith: 'influence', weight: 0.6, onFail: { concessions: 10, accord: -5 }, failText: 'La direction ne vous prend pas au sérieux.' },
        }),
        ch('aides', 'Des aides publiques contre le maintien du site', { accord: 15, concessions: -15 }, 'Un accord gagnant-gagnant… payé par le contribuable.'),
        ch('presse', 'Alerter la presse', { patience: 10, concessions: -5, accord: -5 }, 'Le chantage fait scandale. La direction se raidit.'),
      ],
    },
    {
      id: 'n_nuit', title: 'La nuit de la dernière chance', context: '2 h du matin. Café froid, nerfs à vif.',
      choices: [
        ch('aube', 'Tenir jusqu’à l’aube', { accord: 18, patience: -10 }, 'À 6 h, les grandes lignes sont actées.'),
        ch('consulter', 'Suspendre pour que chacun consulte sa base', { patience: 12, accord: 6 }, 'Les mandats sont clarifiés.'),
        ch('texte', 'Rédiger vous-même un compromis, à prendre ou à laisser', { accord: 25 }, 'Votre texte fait consensus.', {
          risk: { chance: 0.45, scaleWith: 'credibility', weight: 0.6, onFail: { patience: -25 }, failText: 'Les deux camps rejettent votre texte.' },
        }),
      ],
    },
    {
      id: 'n_signature', title: 'La signature', context: 'Reste à conclure.',
      choices: [
        ch('cameras', 'Signer devant les caméras', { accord: 8 }, 'Poignées de main et flashs.'),
        ch('discrete', 'Une signature discrète', { accord: 5, patience: 5 }, 'Personne ne perd la face.'),
        ch('revoyure', 'Ajouter une clause de revoyure dans un an', { accord: 6, concessions: -8 }, 'La direction respire.'),
      ],
    },
  ],
  score: g => g['accord'] - g['concessions'] * 0.3 + g['patience'] * 0.15,
  thresholds: { succes: 76, mitige: 52 },
  outcomes: {
    succes: 'Accord signé : la grève est levée et l’on vous attribue le mérite.',
    mitige: 'Un accord a minima : le conflit couve encore.',
    echec: 'Échec de la médiation : le conflit s’enlise.',
  },
  rewards: (status, g) => {
    const base: Effect[] = status === 'succes'
      ? [stat('credibility', 6), stat('influence', 4), stat('popularity', 3), { kind: 'dossier', domain: 'social', delta: 5 }, { kind: 'contact', contactId: 'ct-ust', trust: 8 }]
      : status === 'mitige' ? [stat('credibility', 2), { kind: 'dossier', domain: 'social', delta: 3 }]
      : [stat('popularity', -3), stat('credibility', -3), stat('stress', 6)];
    if (g['concessions'] > 50) base.push({ kind: 'faction', factionId: 'reformistes', delta: -3 });
    return base;
  },
};

// ── 4. Commission d'enquête ─────────────────────────────────

const COMMISSION: SceneDef = {
  id: 'commission', title: 'Commission d’enquête', eyebrow: 'Assemblée',
  intro: 'La commission enquête sur {entreprise}, au cœur du dossier {domaine}. Son PDG est convoqué sous serment.',
  band: '#2f2433', minRank: 'depute', domain: 'agenda',
  setup: (_d, pick) => ({ entreprise: pick(['Groupe Vernier Énergie', 'Médilab', 'Autoroutes du Centre', 'TechNova', 'Agrisol']) }),
  gauges: [
    { id: 'revelations', label: 'Révélations', min: 0, max: 100, start: 0, good: 'high' },
    { id: 'serieux', label: 'Sérieux perçu', min: 0, max: 100, start: d => 40 + d.player.stats.credibility * 0.3, good: 'high' },
    { id: 'hostilite', label: 'Hostilité du témoin', min: 0, max: 100, start: 25, good: 'low',
      danger: { above: 85, label: 'Le témoin quitte la salle', text: 'Le PDG de {entreprise} se lève et quitte l’audition. Des questions resteront sans réponse.', delta: { revelations: -10 } } },
  ],
  stages: [['c_prep'], ['c_ouverture'], ['c_esquive', 'c_contre'], ['c_coup'], ['c_conclusion']],
  steps: [
    {
      id: 'c_prep', title: 'Préparer l’audition', context: 'La veille, votre bureau croule sous les dossiers.',
      choices: [
        ch('comptes', 'Éplucher les comptes toute la nuit', { serieux: 12 }, 'Vous connaissez chaque ligne du bilan.'),
        ch('lanceur', 'Rencontrer un lanceur d’alerte', { revelations: 12, hostilite: 5 }, 'Il vous confie des pistes précieuses.', {
          risk: { chance: 0.3, scaleWith: 'credibility', weight: 0.5, onFail: { serieux: -10 }, failText: 'Le lanceur d’alerte se révèle peu fiable.' },
        }),
        ch('fuite', 'Faire fuiter vos questions à la presse', { revelations: 5, hostilite: 15, serieux: -8 }, 'L’audition est très attendue… et le témoin préparé.'),
      ],
    },
    {
      id: 'c_ouverture', title: 'Premières questions', context: 'Les caméras de la chaîne parlementaire tournent.',
      choices: [
        ch('techniques', 'Des questions techniques, précises', { revelations: 15, serieux: 10 }, 'Il est obligé de concéder plusieurs points.', {
          risk: { chance: 0.7, scaleWith: 'dossier', weight: 1, onFail: { serieux: -10 }, failText: 'Vous confondez deux rapports. Le PDG sourit.' },
        }),
        ch('directes', 'Des questions directes, sans détour', { revelations: 10, hostilite: 15 }, 'Il se crispe, mais répond.'),
        ch('confiance', 'Le mettre en confiance', { hostilite: -15, revelations: 5 }, 'Il se détend, et parle plus qu’il ne le voudrait.'),
      ],
    },
    {
      id: 'c_esquive', title: '« Je n’ai pas ces chiffres en tête »', context: 'Le témoin esquive pour la troisième fois.',
      choices: [
        ch('serment', 'Lui rappeler qu’il témoigne sous serment', { revelations: 12, hostilite: 20 }, 'Le rappel fait son effet.'),
        ch('document', 'Sortir le document qui le contredit', { revelations: 22, hostilite: 10 }, 'Silence dans la salle. Il bredouille.', {
          requires: { minMastery: 40 }, hint: 'Exige de maîtriser le dossier (40).',
        }),
        ch('suite', 'Passer à la question suivante', { serieux: -5, hostilite: -5 }, 'Occasion manquée.'),
      ],
    },
    {
      id: 'c_contre', title: '« Ce n’est qu’une opération politique »', context: 'Le témoin contre-attaque devant les caméras.',
      choices: [
        ch('calme', 'Rester calme et reposer la question', { serieux: 12, hostilite: -5 }, 'Votre sang-froid tranche avec son agacement.'),
        ch('replique', 'Répliquer sèchement', { hostilite: 15, revelations: 5 }, 'L’échange est vif.', {
          risk: { chance: 0.4, scaleWith: 'credibility', weight: 0.6, onFail: { serieux: -12 }, failText: 'L’échange tourne au pugilat verbal.' },
        }),
        ch('president', 'Laisser le président de la commission recadrer', { serieux: 5 }, 'Le président rappelle le témoin à l’ordre.'),
      ],
    },
    {
      id: 'c_coup', title: 'Coup de théâtre', context: 'Un courriel interne de {entreprise} vous parvient en pleine séance.',
      choices: [
        ch('lire', 'Le lire immédiatement en séance', { revelations: 25, hostilite: 20 }, 'La salle retient son souffle : le courriel est accablant.', {
          risk: { chance: 0.35, scaleWith: 'credibility', weight: 0.5, onFail: { serieux: -15, revelations: 5 }, failText: 'Le courriel est un faux grossier. Vous êtes ridiculisé·e.' },
        }),
        ch('authentifier', 'Le faire authentifier d’abord', { revelations: 12, serieux: 8 }, 'Authentifié : il sera versé au rapport.'),
        ch('justice', 'Le transmettre à la justice', { serieux: 15, revelations: 5 }, 'Vous jouez la prudence institutionnelle.'),
      ],
    },
    {
      id: 'c_conclusion', title: 'Les conclusions', context: 'La commission rend ses travaux.',
      choices: [
        ch('rapport', 'Un rapport sévère et documenté', { serieux: 10, revelations: 5 }, 'Un rapport qui fera date.', {
          requires: { minMastery: 30 }, hint: 'Exige de maîtriser le dossier (30).',
        }),
        ch('procureur', 'Saisir le procureur', { revelations: 10, hostilite: 10 }, 'L’affaire prend un tour judiciaire.'),
        ch('presse', 'Une conférence de presse choc', { revelations: 8, serieux: -5 }, 'Les médias adorent, vos collègues moins.'),
      ],
    },
  ],
  score: g => g['revelations'] * 0.55 + g['serieux'] * 0.45 - (g['hostilite'] >= 85 ? 8 : 0),
  thresholds: { succes: 60, mitige: 40 },
  outcomes: {
    succes: 'Une audition qui fait date : vous vous imposez comme un·e parlementaire redouté·e.',
    mitige: 'Quelques avancées, un rapport de plus.',
    echec: 'Audition ratée : le témoin s’en sort sans dommage.',
  },
  rewards: status => status === 'succes'
    ? [stat('credibility', 6), stat('popularity', 4), stat('influence', 3), { kind: 'dossier', domain: '$domain', delta: 6 }]
    : status === 'mitige' ? [stat('credibility', 2), { kind: 'dossier', domain: '$domain', delta: 3 }]
    : [stat('credibility', -4), stat('stress', 5)],
};

// ── 5. Cellule de crise ─────────────────────────────────────

const CRISE: SceneDef = {
  id: 'crise', title: 'Cellule de crise', eyebrow: 'Gouvernement',
  intro: 'Le pays fait face à {crise}. Vous pilotez la cellule interministérielle.',
  band: '#3a2222', minRank: 'ministre', domain: 'agenda',
  setup: (_d, pick) => ({ crise: pick(['des inondations dans la vallée du Rhône', 'une cyberattaque contre les hôpitaux', 'une pénurie de carburant', 'une canicule record']) }),
  gauges: [
    { id: 'maitrise', label: 'Maîtrise de la situation', min: 0, max: 100, start: 25, good: 'high' },
    { id: 'confiance', label: 'Confiance des Français', min: 0, max: 100, start: d => 30 + d.player.stats.popularity * 0.4, good: 'high',
      danger: { below: 15, label: 'Défiance générale', text: 'Les sondages s’effondrent : l’opposition réclame votre démission.' } },
    { id: 'cout', label: 'Coût pour l’État', min: 0, max: 20, start: 0, good: 'low', format: 'md' },
  ],
  stages: [['k_heures'], ['k_terrain', 'k_renforts'], ['k_communication'], ['k_indemnites', 'k_restrictions'], ['k_assemblee']],
  steps: [
    {
      id: 'k_heures', title: 'Les premières heures', context: 'Face à {crise}, chaque minute compte.',
      choices: [
        ch('moyens', 'Mobiliser tous les moyens de l’État', { maitrise: 20, cout: 5 }, 'Pompiers, préfets, armée : tout le monde est sur le pont.'),
        ch('attendre', 'Attendre les remontées du terrain', { maitrise: 5, confiance: -8 }, 'On vous reproche de tarder.'),
        ch('coordinateur', 'Nommer un coordinateur expérimenté', { maitrise: 12, cout: 1 }, 'Un préfet chevronné prend les commandes.', {
          risk: { chance: 0.3, scaleWith: 'influence', weight: 0.5, onFail: { maitrise: -5 }, failText: 'Il se révèle vite débordé.' },
        }),
      ],
    },
    {
      id: 'k_terrain', title: 'Se rendre sur place ?', context: 'Les chaînes d’info tournent en boucle.',
      choices: [
        ch('oui', 'Oui, immédiatement', { confiance: 12, maitrise: -3 }, 'Votre présence rassure.', {
          risk: { chance: 0.3, scaleWith: 'popularity', weight: 0.6, onFail: { confiance: -10 }, failText: 'Vous êtes pris·e à partie par des habitants excédés.' },
        }),
        ch('non', 'Non : rester au centre de crise', { maitrise: 10 }, 'Vous gardez la main sur la coordination.'),
        ch('secretaire', 'Envoyer un secrétaire d’État', { maitrise: 5, confiance: 3 }, 'Un compromis honnête.'),
      ],
    },
    {
      id: 'k_renforts', title: 'Les préfets réclament des renforts', context: 'Les moyens locaux sont saturés.',
      choices: [
        ch('armee', 'L’armée en appui', { maitrise: 15, cout: 3, confiance: 5 }, 'Les militaires arrivent dans la nuit.'),
        ch('requisition', 'Réquisitionner des entreprises privées', { maitrise: 12, cout: 2 }, 'Les engins de chantier rejoignent les secours.', {
          risk: { chance: 0.35, scaleWith: 'influence', weight: 0.5, onFail: { confiance: -8 }, failText: 'Les patrons dénoncent un passage en force.' },
        }),
        ch('voisins', 'Demander l’aide des pays voisins', { maitrise: 8, cout: 1 }, 'L’Europe répond présent.'),
      ],
    },
    {
      id: 'k_communication', title: 'Communiquer', context: 'Un point presse est attendu dans une heure.',
      choices: [
        ch('verite', 'Tout dire, même les mauvaises nouvelles', { confiance: 12 }, 'Votre franchise est saluée.'),
        ch('rassurer', 'Rassurer, minimiser', { confiance: 6 }, 'Le ton apaisant fonctionne… pour l’instant.', {
          risk: { chance: 0.5, scaleWith: 'credibility', weight: 0.5, onFail: { confiance: -18 }, failText: 'La réalité vous rattrape : on vous accuse d’avoir menti.' },
        }),
        ch('experts', 'Un point presse quotidien avec les experts', { confiance: 10, maitrise: 5 }, 'Clair, régulier, rassurant.', {
          requires: { minMastery: 35 }, hint: 'Exige de maîtriser le dossier (35).',
        }),
        ch('pm', 'Laisser parler le Premier ministre', { confiance: -3 }, 'On remarque votre absence.'),
      ],
    },
    {
      id: 'k_indemnites', title: 'Indemniser tout le monde ?', context: 'Les sinistrés attendent des réponses.',
      choices: [
        ch('fonds', 'Un fonds d’urgence massif', { confiance: 12, cout: 8 }, 'Les aides tombent vite. Bercy grimace.'),
        ch('cible', 'Des aides ciblées sur les plus touchés', { confiance: 6, cout: 3 }, 'Juste, mais lent.'),
        ch('assurances', 'Renvoyer vers les assurances', { confiance: -10 }, 'Le sentiment d’abandon grandit.'),
      ],
    },
    {
      id: 'k_restrictions', title: 'Faut-il imposer des restrictions ?', context: 'Les experts sont divisés.',
      choices: [
        ch('strictes', 'Des restrictions strictes, immédiatement', { maitrise: 15, confiance: -8 }, 'Efficace, mais impopulaire.'),
        ch('recommandations', 'De simples recommandations', { maitrise: 4, confiance: 4 }, 'Peu suivies.'),
        ch('concertation', 'Des restrictions ciblées après concertation', { maitrise: 10, confiance: 5 }, 'Les élus locaux jouent le jeu.', {
          requires: { stat: 'influence', minStat: 50 }, hint: 'Exige une influence de 50.',
        }),
      ],
    },
    {
      id: 'k_assemblee', title: 'Questions au gouvernement', context: 'L’opposition vous attend de pied ferme.',
      choices: [
        ch('assumer', 'Assumer les erreurs', { confiance: 8 }, 'Un ton qui détonne, et qui convainc.'),
        ch('bilan', 'Défendre votre action point par point', { confiance: 10, maitrise: 5 }, 'Une démonstration implacable.', {
          risk: { chance: 0.6, scaleWith: 'dossier', weight: 1, onFail: { confiance: -10 }, failText: 'Les chiffres que vous citez sont contredits en séance.' },
        }),
        ch('recuperation', 'Accuser l’opposition de récupération', { confiance: -4 }, 'L’hémicycle s’embrase. Le pays se lasse.'),
      ],
    },
  ],
  score: g => g['maitrise'] * 0.5 + g['confiance'] * 0.5 - g['cout'] * 1.5,
  thresholds: { succes: 55, mitige: 38 },
  outcomes: {
    succes: 'Crise maîtrisée : votre stature d’homme ou de femme d’État s’affirme.',
    mitige: 'Crise surmontée, non sans critiques.',
    echec: 'Gestion de crise désastreuse : la commission d’enquête est déjà réclamée.',
  },
  rewards: status => status === 'succes'
    ? [stat('popularity', 6), stat('credibility', 6), stat('influence', 4), stat('stress', 8)]
    : status === 'mitige' ? [stat('credibility', 1), stat('stress', 8)]
    : [stat('popularity', -6), stat('credibility', -5), stat('stress', 12), { kind: 'exposure', delta: 6 }],
};

// ── 6. Alliance électorale ──────────────────────────────────

function nearestPartner(d: GameState) {
  return [...d.otherParties].sort((a, b) => Math.abs(a.position - d.party.position) - Math.abs(b.position - d.party.position))[0]
    ?? PARTIES[0];
}

const ALLIANCE: SceneDef = {
  id: 'alliance', title: 'Négocier une alliance', eyebrow: 'Direction du parti',
  intro: 'Seuls, vous ne gagnerez pas. Le partenaire naturel : {partenaire}.',
  band: '#24303a', minRank: 'chef_parti', domain: 'agenda',
  setup: d => ({ partenaire: nearestPartner(d).name, partenairePos: String(nearestPartner(d).position) }),
  gauges: [
    { id: 'accord', label: 'Avancée de l’accord', min: 0, max: 100, start: 20, good: 'high' },
    { id: 'sieges', label: 'Circonscriptions cédées', min: 0, max: 100, start: 0, good: 'low', format: 'pct' },
    { id: 'base', label: 'Adhésion des militants', min: 0, max: 100, start: 65, good: 'high',
      danger: { below: 25, label: 'Fronde militante', text: 'Une pétition interne dénonce « une alliance contre-nature ».', delta: { accord: -10 } } },
  ],
  stages: [['a_contact'], ['a_programme', 'a_retraites'], ['a_sieges'], ['a_tete'], ['a_annonce']],
  steps: [
    {
      id: 'a_contact', title: 'Premier contact avec {partenaire}', context: 'Il faut ouvrir la discussion sans perdre la face.',
      choices: [
        ch('diner', 'Un dîner discret entre chefs de parti', { accord: 12 }, 'Le courant passe.'),
        ch('lettre', 'Une lettre ouverte publique', { accord: 6, base: 8 }, 'Vos militants applaudissent l’initiative.', {
          risk: { chance: 0.35, scaleWith: 'credibility', weight: 0.5, onFail: { accord: -8 }, failText: 'Ils prennent mal d’être mis au pied du mur.' },
        }),
        ch('emissaires', 'Passer par des émissaires', { accord: 8, base: 3 }, 'Les canaux discrets fonctionnent.'),
      ],
    },
    {
      id: 'a_programme', title: 'Le programme commun : {domaine}', context: 'Vos positions divergent sur le sujet du moment.',
      choices: [
        ch('reprendre', 'Reprendre leurs propositions', { accord: 18, base: -15 }, 'Ils sont ravis. Vos militants beaucoup moins.'),
        ch('synthese', 'Une synthèse habile', { accord: 15, base: -3 }, 'Chacun s’y retrouve.', {
          requires: { minMastery: 40 }, hint: 'Exige de maîtriser le sujet (40).',
        }),
        ch('imposer', 'Imposer vos positions', { accord: 4, base: 10 }, 'Votre base est fière, la négociation patine.'),
      ],
    },
    {
      id: 'a_retraites', title: 'Le point qui fâche : les retraites', context: 'Un désaccord de fond entre vos deux partis.',
      choices: [
        ch('conference', 'Renvoyer à une grande conférence sociale', { accord: 12, base: -2 }, 'Une façon élégante de reporter le problème.'),
        ch('ceder', 'Céder sur ce point', { accord: 18, base: -14 }, 'L’accord avance, vos militants tiquent.'),
        ch('tenir', 'Tenir bon', { accord: -4, base: 10 }, 'Blocage. Mais vos troupes sont fières.'),
      ],
    },
    {
      id: 'a_sieges', title: 'Le partage des circonscriptions', context: 'Le nerf de la guerre : qui se présente où ?',
      choices: [
        ch('trente', 'Leur céder 30 % des circonscriptions', { accord: 15, sieges: 30, base: -8 }, 'Généreux. Peut-être trop.'),
        ch('primaire', 'Une primaire commune dans chaque circonscription', { accord: 10, sieges: 15 }, 'Le meilleur gagne. Ça vous semble juste.'),
        ch('tete', 'Seulement là où ils sont en tête', { accord: 6, sieges: 10 }, 'Logique, mais peu généreux.'),
        ch('rien', 'Rien du tout', { accord: -10, base: 5 }, 'Ils claquent presque la porte.'),
      ],
    },
    {
      id: 'a_tete', title: 'Qui mène l’alliance ?', context: 'La question que tout le monde évitait.',
      choices: [
        ch('vous', 'Vous, sans discussion', { accord: -8, base: 10 }, 'Ils finissent par s’incliner.', {
          risk: { chance: 0.4, scaleWith: 'influence', weight: 0.6, onFail: { accord: -15 }, failText: 'Ils menacent de rompre.' },
        }),
        ch('collegiale', 'Une direction collégiale', { accord: 12, base: -4 }, 'Un équilibre fragile, mais un équilibre.'),
        ch('eux', 'Leur chef, en échange de ministères', { accord: 18, base: -15, sieges: 10 }, 'Un accord rapide… et coûteux.'),
      ],
    },
    {
      id: 'a_annonce', title: 'L’annonce', context: 'Comment présenter l’accord au pays ?',
      choices: [
        ch('photo', 'Une grande photo de famille', { accord: 5, base: 5 }, 'L’image de l’union fait la une.'),
        ch('militants', 'Un texte commun soumis aux militants', { base: 10 }, 'Vos adhérents votent à 72 % pour.'),
        ch('communique', 'Un simple communiqué', { accord: 3 }, 'Sobre, efficace, vite oublié.'),
      ],
    },
  ],
  score: g => g['accord'] * 0.6 + g['base'] * 0.4 - g['sieges'] * 0.3,
  thresholds: { succes: 65, mitige: 45 },
  outcomes: {
    succes: 'Alliance conclue : la dynamique change de camp.',
    mitige: 'Un accord de façade, que chacun interprète à sa façon.',
    echec: 'Les négociations échouent : chacun repart seul.',
  },
  rewards: (status, g, d, vars) => {
    const partnerPos = Number(vars['partenairePos'] ?? d.party.position);
    const effects: Effect[] = status === 'succes'
      ? [stat('influence', 5), stat('popularity', 3), { kind: 'momentum', delta: 12 }, { kind: 'stance', delta: Math.round((partnerPos - d.player.stance) * 0.2) }]
      : status === 'mitige' ? [stat('influence', 2)]
      : [stat('influence', -3), { kind: 'cohesion', delta: -5 }];
    if (g['base'] < 35) effects.push({ kind: 'cohesion', delta: -6 }, { kind: 'faction', factionId: 'ligne_dure', delta: -6 });
    else if (status === 'succes') effects.push({ kind: 'faction', factionId: 'moderes', delta: 6 });
    return effects;
  },
};

// ── 7. Marché public arrangé (illégal) ──────────────────────

const MARCHE_PUBLIC: SceneDef = {
  id: 'marche_public', title: 'Le marché arrangé', eyebrow: 'Hors la loi',
  intro: 'Un marché de {montant} pour {objet}. {entreprise}, une entreprise amie, est prête à se montrer reconnaissante.',
  band: '#1f2a24', minRank: 'conseiller_municipal', domain: 'economie',
  setup: (_d, pick) => ({
    montant: pick(['4 millions d’euros', '7 millions d’euros', '12 millions d’euros']),
    objet: pick(['la rénovation du gymnase', 'le nouveau rond-point', 'la cantine centrale', 'l’éclairage public']),
    entreprise: pick(['BTP Durandal', 'Signalis', 'Restaurations Collectives du Centre', 'Lumens & Fils']),
  }),
  gauges: [
    { id: 'gain', label: 'Rétrocommission (k€)', min: 0, max: 150, start: 0, good: 'high' },
    { id: 'soupcons', label: 'Soupçons', min: 0, max: 100, start: 10, good: 'low',
      danger: { above: 80, label: 'Signalement à la justice', text: 'Un agent du service des marchés signale les irrégularités au procureur.', end: true } },
    { id: 'complices', label: 'Loyauté des complices', min: 0, max: 100, start: 60, good: 'high',
      danger: { below: 15, label: 'Un complice parle', text: 'Votre intermédiaire, se sentant lésé, raconte tout à un journaliste.', end: true } },
  ],
  stages: [['p_montage'], ['p_offres'], ['p_controle', 'p_concurrent'], ['p_argent']],
  steps: [
    {
      id: 'p_montage', title: 'Le montage', context: 'Comment faire passer l’argent ?',
      choices: [
        ch('surfacturation', 'Surfacturer les travaux de 10 %', { gain: 50, soupcons: 15 }, 'Les chiffres gonflent discrètement.'),
        ch('bureau', 'Un « bureau d’études » fictif encaisse les commissions', { gain: 40, soupcons: 8, complices: -5 }, 'Une coquille vide à Luxembourg fait l’affaire.'),
        ch('campagne', 'Des dons « spontanés » à votre campagne', { gain: 25, soupcons: 5 }, 'Les salariés de l’entreprise deviennent soudain très militants.'),
      ],
    },
    {
      id: 'p_offres', title: 'L’appel d’offres', context: 'Trois entreprises ont répondu. Il faut que la bonne gagne.',
      choices: [
        ch('criteres', 'Rédiger des critères taillés sur mesure', { gain: 15, soupcons: 10 }, 'Seule {entreprise} coche toutes les cases.', {
          risk: { chance: 0.4, scaleWith: 'dossier', weight: 0.8, onFail: { soupcons: 25 }, failText: 'Les critères sont si grossiers qu’un concurrent dépose un recours.' },
        }),
        ch('fuite', 'Faire fuiter les offres concurrentes', { gain: 20, soupcons: 18, complices: 5 }, '{entreprise} ajuste son prix à l’euro près.'),
        ch('commission', 'Peser sur les membres de la commission', { gain: 10, soupcons: 6, complices: -10 }, 'Un vote à quatre voix contre trois.'),
      ],
    },
    {
      id: 'p_controle', title: 'Un contrôle de la chambre régionale des comptes', context: 'Un magistrat demande à voir le dossier du marché.',
      choices: [
        ch('dossier', 'Lui fournir un dossier impeccable, réécrit pour l’occasion', { soupcons: -10, complices: -5 }, 'Le contrôle ne trouve rien.', {
          risk: { chance: 0.45, scaleWith: 'credibility', weight: 0.5, onFail: { soupcons: 30 }, failText: 'Des dates incohérentes mettent la puce à l’oreille du magistrat.' },
        }),
        ch('retarder', 'Faire traîner, égarer des pièces', { soupcons: 12 }, 'Le magistrat note votre « manque de coopération ».'),
        ch('sacrifier', 'Faire porter le chapeau à un fonctionnaire', { soupcons: -15, complices: -20 }, 'Le directeur des services est muté. Ses collègues ne vous le pardonnent pas.'),
      ],
    },
    {
      id: 'p_concurrent', title: 'Le concurrent évincé menace de porter plainte', context: '« Je sais comment {entreprise} a gagné. »',
      choices: [
        ch('compenser', 'Lui promettre le prochain marché', { soupcons: -10, gain: -10, complices: 5 }, 'Il retire sa plainte.'),
        ch('menacer', 'Lui faire comprendre qu’il a intérêt à se taire', { soupcons: 10, complices: 5 }, 'Il se tait. Pour l’instant.', {
          risk: { chance: 0.4, scaleWith: 'influence', weight: 0.6, onFail: { soupcons: 30 }, failText: 'Il enregistrait la conversation.' },
        }),
        ch('ignorer', 'L’ignorer', { soupcons: 15 }, 'Sa plainte est déposée, mais classée… pour l’instant.'),
      ],
    },
    {
      id: 'p_argent', title: 'Le partage', context: '{entreprise} est prête à payer. Quelle part pour vos intermédiaires ?',
      choices: [
        ch('genereux', 'Être généreux avec les intermédiaires', { gain: -10, complices: 25 }, 'Tout le monde est content. Et tient sa langue.'),
        ch('equitable', 'Un partage équitable', { complices: 5 }, 'Chacun repart avec sa part.'),
        ch('tout', 'Tout garder pour vous', { gain: 20, complices: -30 }, 'Les intermédiaires repartent les mains presque vides.'),
      ],
    },
  ],
  score: g => g['gain'] - g['soupcons'] * 0.4 + g['complices'] * 0.2,
  thresholds: { succes: 62, mitige: 30 },
  outcomes: {
    succes: 'L’argent est à l’abri. Personne ne sait rien… pour l’instant.',
    mitige: 'L’opération rapporte, mais laisse des traces.',
    echec: 'L’opération tourne mal : la justice s’en mêle.',
  },
  rewards: (status, g) => {
    const gained = status === 'echec' ? Math.round(g['gain'] * 0.3) : g['gain'];
    const effects: Effect[] = [
      { kind: 'income', base: gained * 1000 }, { kind: 'flagAdd', key: 'illegal', delta: 1 },
      { kind: 'exposure', delta: Math.round(g['soupcons'] / 3) },
    ];
    if (status === 'echec') effects.push({ kind: 'exposure', delta: 20 }, { kind: 'decision', templateId: 'enquete' });
    return effects;
  },
};

// ── 8. Tournée du prétendant (royauté) ──────────────────────

const crownStart = (d: GameState) => d.crown?.legitimite ?? 30;

const TOURNEE_PRINCE: SceneDef = {
  id: 'tournee_prince', title: 'La tournée du prétendant', eyebrow: 'Couronne',
  intro: '{pretendant} arrive en {region}. Les caméras attendent l’image : un prince parmi les Français, ou un anachronisme.',
  band: '#3b2d12', minRank: 'militant', domain: 'territoires',
  setup: (d, pick) => ({ pretendant: d.crown?.pretendant ?? 'le prétendant', region: pick(['Vendée', 'Anjou', 'Bretagne', 'Provence', 'Alsace', 'Auvergne']) }),
  gauges: [
    { id: 'foule', label: 'Foule', min: 0, max: 100, start: d => 15 + (d.crown?.soutien ?? 10) * 0.6, good: 'high' },
    { id: 'prestige', label: 'Prestige du prince', min: 0, max: 100, start: crownStart, good: 'high' },
    { id: 'ridicule', label: 'Ridicule', min: 0, max: 100, start: 15, good: 'low',
      danger: { above: 75, label: 'Risée nationale', text: 'Les humoristes s’emparent de la tournée : #LeRoiEstNu tourne en boucle.', delta: { prestige: -15 } } },
  ],
  stages: [['t_arrivee'], ['t_messe', 't_ferme'], ['t_maire', 't_contre'], ['t_discours']],
  steps: [
    {
      id: 't_arrivee', title: 'L’arrivée', context: 'Comment le prince doit-il arriver ?',
      choices: [
        ch('caleche', 'En calèche, avec la garde d’honneur des associations royalistes', { foule: 15, prestige: 10, ridicule: 20 }, 'Splendide… ou grotesque, selon les chaînes.'),
        ch('train', 'En TER, comme tout le monde', { foule: 5, prestige: 4, ridicule: -8 }, 'Un prince qui composte son billet : l’image plaît.'),
        ch('velo', 'À vélo, entouré de jeunes militants', { foule: 8, ridicule: 5 }, 'Sympathique, un peu forcé.'),
      ],
    },
    {
      id: 't_messe', title: 'La messe en la cathédrale', context: 'Le clergé local est partagé.',
      choices: [
        ch('premier_rang', 'Au premier rang, en majesté', { prestige: 12, ridicule: 6, foule: 5 }, 'Une image d’un autre siècle, saisissante.'),
        ch('discret', 'Discrètement, au milieu des fidèles', { prestige: 6, ridicule: -4 }, 'L’humilité est remarquée.'),
        ch('laicite', 'Renoncer : la France est laïque', { prestige: -3, foule: 4, ridicule: -6 }, 'Les traditionalistes grincent, les autres apprécient.'),
      ],
    },
    {
      id: 't_ferme', title: 'Visite d’une exploitation agricole', context: 'Les agriculteurs de la région sont à bout.',
      choices: [
        ch('ecouter', 'Écouter longuement, sans promettre', { prestige: 8, foule: 6 }, 'Un roi qui écoute : c’est nouveau.'),
        ch('traire', 'Mettre les mains dans le cambouis', { foule: 10, ridicule: 8 }, 'La photo du prince trayant une vache fait le tour du web.', {
          risk: { chance: 0.4, onFail: { ridicule: 20 }, failText: 'La vache n’est pas d’accord. La vidéo est vue 4 millions de fois.' },
        }),
        ch('promettre', 'Promettre « la protection de la Couronne »', { foule: 8, prestige: -4 }, 'Une promesse qui sonne creux pour un prince sans pouvoir.'),
      ],
    },
    {
      id: 't_maire', title: 'Le maire vous reçoit… ou pas', context: 'Le maire, républicain convaincu, hésite à recevoir le prince.',
      choices: [
        ch('respect', 'Saluer publiquement la République locale', { prestige: 8, ridicule: -5 }, 'Le maire est désarmé par tant de courtoisie.'),
        ch('forcer', 'Organiser la réception sans lui', { foule: 8, ridicule: 10 }, 'Une réception sur le parvis, sans écharpe tricolore.'),
        ch('charmer', 'Charmer le maire en privé', { prestige: 10 }, 'Le maire repart avec une photo dédicacée.', {
          risk: { chance: 0.45, scaleWith: 'influence', weight: 0.5, onFail: { ridicule: 12 }, failText: 'Le maire raconte l’entretien à la presse, mot pour mot.' },
        }),
      ],
    },
    {
      id: 't_contre', title: 'Des républicains chantent La Marseillaise', context: 'Une centaine de manifestants républicains attendent le prince.',
      choices: [
        ch('chanter', 'Le prince chante avec eux', { prestige: 12, ridicule: -6, foule: 4 }, 'Coup de maître : le prince entonne l’hymne avec ses opposants.'),
        ch('eviter', 'Changer d’itinéraire', { ridicule: 6 }, '« Le prince fuit » titre un site d’information.'),
        ch('dialoguer', 'Aller à leur rencontre', { prestige: 8, foule: 6 }, 'Un échange tendu, mais digne.', {
          risk: { chance: 0.4, scaleWith: 'credibility', weight: 0.5, onFail: { ridicule: 15, prestige: -6 }, failText: 'Le prince est hué, la scène est filmée.' },
        }),
      ],
    },
    {
      id: 't_discours', title: 'Le discours du soir', context: 'Sur le parvis, la foule attend.',
      choices: [
        ch('unite', 'Un roi au-dessus des partis, garant de l’unité', { prestige: 12, foule: 6 }, 'Le thème porte : l’arbitre plutôt que le monarque.'),
        ch('histoire', 'Mille ans d’histoire de France', { prestige: 8, ridicule: 4, foule: 4 }, 'Lyrique. Un peu long.'),
        ch('concret', 'Des propositions concrètes pour la région', { foule: 10, prestige: 4 }, 'Un prince qui parle de lignes de bus : étonnant.', {
          requires: { minMastery: 30 }, hint: 'Exige de maîtriser le dossier Territoires (30).',
        }),
      ],
    },
  ],
  score: g => g['foule'] * 0.4 + g['prestige'] * 0.5 - g['ridicule'] * 0.4,
  thresholds: { succes: 47, mitige: 30 },
  outcomes: {
    succes: 'Une tournée triomphale : l’idée monarchique gagne du terrain.',
    mitige: 'Une tournée correcte, vite oubliée.',
    echec: 'Une tournée ratée : le mouvement est tourné en dérision.',
  },
  rewards: (status, g) => status === 'succes'
    ? [{ kind: 'crown', soutien: 5, legitimite: 4 }, stat('popularity', 2)]
    : status === 'mitige' ? [{ kind: 'crown', soutien: 2, legitimite: 1 }]
    : [{ kind: 'crown', soutien: -3, legitimite: g['ridicule'] > 60 ? -6 : -2 }, stat('credibility', -2)],
};

// ── 9. Référendum sur la monarchie ──────────────────────────

const REFERENDUM: SceneDef = {
  id: 'referendum', title: 'Le référendum', eyebrow: 'Couronne',
  intro: '« Approuvez-vous le rétablissement d’une monarchie constitutionnelle, avec {pretendant} pour souverain ? » La campagne commence.',
  band: '#3b2d12', minRank: 'militant', domain: 'justice',
  setup: d => ({ pretendant: d.crown?.pretendant ?? 'le prétendant' }),
  gauges: [
    { id: 'oui', label: 'Intentions de vote « oui »', min: 0, max: 100, start: d => Math.round((d.crown?.soutien ?? 30) * 0.55 + (d.crown?.legitimite ?? 30) * 0.1), good: 'high', format: 'pct' },
    { id: 'participation', label: 'Participation', min: 0, max: 100, start: 55, good: 'high', format: 'pct' },
    { id: 'conseil', label: 'Censure du Conseil constitutionnel', min: 0, max: 100, start: 30, good: 'low',
      danger: { above: 85, label: 'Référendum invalidé', text: 'Le Conseil constitutionnel juge la procédure contraire à l’article 89 : le vote est annulé.', end: true } },
  ],
  stages: [['r_question'], ['r_campagne'], ['r_debat'], ['r_peur', 'r_scandale'], ['r_veille']],
  steps: [
    {
      id: 'r_question', title: 'La procédure', context: 'Par quelle voie organiser le référendum ?',
      choices: [
        ch('article89', 'Une révision constitutionnelle en bonne et due forme', { conseil: -20, oui: -3 }, 'Long, rigoureux, inattaquable.'),
        ch('article11', 'Un référendum direct, en contournant le Parlement', { conseil: 25, oui: 4, participation: 6 }, 'Rapide, populaire… juridiquement fragile.'),
        ch('consultation', 'Une consultation « indicative » d’abord', { conseil: -5, participation: -8 }, 'Prudent, mais moins mobilisateur.'),
      ],
    },
    {
      id: 'r_campagne', title: 'Le cœur de la campagne', context: 'Quel argument mettre en avant ?',
      choices: [
        ch('stabilite', 'La stabilité : un arbitre au-dessus des partis', { oui: 7 }, 'L’argument porte chez les déçus de la politique.'),
        ch('prestige', 'Le prestige de la France dans le monde', { oui: 4, participation: 3 }, 'Les images des monarchies européennes font rêver.'),
        ch('cout', 'Une monarchie qui coûte moins cher que l’Élysée', { oui: 6 }, 'Un chiffrage précis convainc les sceptiques.', {
          risk: { chance: 0.6, scaleWith: 'dossier', weight: 1, onFail: { oui: -4 }, failText: 'Vos chiffres sont démontés par les économistes.' },
        }),
      ],
    },
    {
      id: 'r_debat', title: 'Le grand débat télévisé', context: 'Face à vous, le chef de file du « non », républicain flamboyant.',
      choices: [
        ch('calme', 'Rester calme, respectueux de la République', { oui: 5 }, 'Vous désamorcez les accusations de nostalgie.'),
        ch('attaque', 'Attaquer « la République des affaires »', { oui: 6, participation: 4 }, 'Le coup porte.', {
          risk: { chance: 0.45, scaleWith: 'credibility', weight: 0.5, onFail: { oui: -6 }, failText: 'On vous renvoie à vos propres casseroles.' },
        }),
        ch('prince', 'Laisser le prince débattre lui-même', { oui: 8, participation: 5 }, 'Le prince crève l’écran.', {
          risk: { chance: 0.4, onFail: { oui: -8 }, failText: 'Le prince se montre hautain et déconnecté.' },
        }),
      ],
    },
    {
      id: 'r_peur', title: 'La campagne du « non » joue la peur', context: '« Demain, des privilèges et des courtisans ! »',
      choices: [
        ch('garanties', 'Publier des garanties : pas de privilèges, pas de noblesse', { oui: 6, conseil: -5 }, 'Les garanties rassurent.'),
        ch('ignorer', 'Ignorer et dérouler la campagne', { oui: -3 }, 'La peur s’installe.'),
        ch('contre', 'Contre-attaquer sur les dérives présidentielles', { oui: 4, participation: 3 }, 'Le débat se polarise.'),
      ],
    },
    {
      id: 'r_scandale', title: 'Un scandale éclabousse un cousin du prince', context: 'Une affaire fiscale dans la famille royale.',
      choices: [
        ch('condamner', 'Condamner fermement, le prince prend ses distances', { oui: 4 }, 'La fermeté est saluée.'),
        ch('minimiser', 'Minimiser l’affaire', { oui: -6 }, 'On parle de « monarchie des copains ».'),
        ch('transparence', 'Publier le patrimoine complet du prince', { oui: 7, participation: 2 }, 'Un geste inédit qui désarme les critiques.'),
      ],
    },
    {
      id: 'r_veille', title: 'La veille du scrutin', context: 'Derniers instants de campagne.',
      choices: [
        ch('mobiliser', 'Tout miser sur la mobilisation', { participation: 8, oui: 2 }, 'Vos militants frappent à toutes les portes.'),
        ch('allocution', 'Une allocution solennelle du prince', { oui: 5 }, 'Grave, simple, juste.'),
        ch('promesse', 'Promettre un second référendum dans dix ans', { oui: 6, conseil: 5 }, 'Une soupape qui rassure les hésitants.'),
      ],
    },
  ],
  score: g => g['oui'] + (g['participation'] - 55) * 0.1,
  thresholds: { succes: 55, mitige: 50 },
  outcomes: {
    succes: 'Le « oui » l’emporte : la France rétablit la monarchie.',
    mitige: 'Le « non » l’emporte de justesse.',
    echec: 'Le « non » l’emporte nettement.',
  },
  rewards: (status, _g, d, vars) => status === 'succes'
    ? [{ kind: 'end', status: 'victoire', title: 'Vive le Roi !', reason: `Le référendum est adopté. ${vars['pretendant']} est sacré à Reims ; vous devenez Chancelier·e du Royaume, ${d.player.name}.` }]
    : d.scenario !== 'royaute'
      // Dans une partie normale, l'échec ruine le cercle royaliste mais pas la carrière
      ? [stat('popularity', -12), stat('credibility', -10), stat('influence', -8), { kind: 'crown', soutien: -30, legitimite: -30, armee: -20 }]
      : [{ kind: 'end', status: 'defaite', title: 'La République tient bon', reason: status === 'mitige'
      ? 'Le « non » l’emporte de justesse. Le mouvement royaliste ne s’en relèvera pas.'
      : 'Le « non » l’emporte largement. Le prince repart en exil doré, et vous dans l’oubli.' }],
};

// ── 10. Coup de force institutionnel ────────────────────────

const COUP: SceneDef = {
  id: 'coup', title: 'La nuit de la Couronne', eyebrow: 'Hors la loi',
  intro: 'Minuit. Vos soutiens dans l’armée et la haute fonction publique attendent votre signal. Il faut s’emparer des institutions sans violence, avant l’aube.',
  band: '#2a1416', minRank: 'militant', domain: 'securite',
  gauges: [
    { id: 'controle', label: 'Contrôle des institutions', min: 0, max: 100, start: d => Math.round((d.crown?.armee ?? 50) * 0.3), good: 'high' },
    { id: 'resistance', label: 'Résistance républicaine', min: 0, max: 100, start: 35, good: 'low',
      danger: { above: 85, label: 'Échec du coup', text: 'La garde républicaine reste fidèle, la foule descend dans la rue : tout s’effondre.', end: true } },
    { id: 'legalite', label: 'Apparence de légalité', min: 0, max: 100, start: 40, good: 'high' },
  ],
  stages: [['k_signal'], ['k_medias'], ['k_elysee'], ['k_aube']],
  steps: [
    {
      id: 'k_signal', title: 'Le signal', context: 'Qui bouge en premier ?',
      choices: [
        ch('prefets', 'Les préfets ralliés proclament l’état d’urgence', { controle: 20, legalite: 10, resistance: 10 }, 'Les préfectures basculent une à une.'),
        ch('regiment', 'Un régiment loyal prend position autour des ministères', { controle: 28, resistance: 20, legalite: -10 }, 'Les blindés dans Paris : l’image fait le tour du monde.'),
        ch('parlement', 'Une convocation surprise du Parlement en Congrès', { legalite: 20, controle: 10, resistance: 5 }, 'Les élus ralliés affluent à Versailles.', {
          risk: { chance: 0.5, scaleWith: 'influence', weight: 0.6, onFail: { resistance: 20 }, failText: 'Le quorum n’est pas atteint. Le complot est éventé.' },
        }),
      ],
    },
    {
      id: 'k_medias', title: 'Les médias', context: 'Le pays se réveillera devant sa télévision.',
      choices: [
        ch('allocution', 'Une allocution du prince à 6 h', { legalite: 12, controle: 6 }, 'Le ton se veut rassurant.'),
        ch('couper', 'Couper les chaînes d’information', { controle: 12, resistance: 18, legalite: -15 }, 'Écrans noirs : la panique monte.'),
        ch('reseaux', 'Inonder les réseaux d’appels au calme', { resistance: -8, legalite: 4 }, 'L’opinion hésite.'),
      ],
    },
    {
      id: 'k_elysee', title: 'L’Élysée', context: 'Le président refuse de démissionner.',
      choices: [
        ch('negocier', 'Négocier une démission « pour raisons de santé »', { legalite: 15, controle: 10 }, 'Après trois heures, il signe.', {
          risk: { chance: 0.5, scaleWith: 'credibility', weight: 0.5, onFail: { resistance: 20 }, failText: 'Il enregistre la conversation et la diffuse.' },
        }),
        ch('isoler', 'L’isoler en coupant ses communications', { controle: 18, resistance: 12 }, 'Le président ne peut plus rien.'),
        ch('attendre', 'Attendre qu’il cède', { resistance: 10 }, 'Chaque heure perdue renforce les républicains.'),
      ],
    },
    {
      id: 'k_aube', title: 'L’aube', context: 'Les premiers rassemblements républicains se forment.',
      choices: [
        ch('referendum', 'Promettre un référendum de ratification', { legalite: 15, resistance: -12 }, 'La promesse calme une partie du pays.'),
        ch('couvre_feu', 'Instaurer un couvre-feu', { controle: 15, resistance: 15 }, 'La rue se vide. La colère reste.'),
        ch('liberer', 'Laisser manifester, sans répression', { resistance: -6, legalite: 8, controle: -8 }, 'Un geste d’apaisement.'),
      ],
    },
  ],
  score: g => g['controle'] * 0.6 + g['legalite'] * 0.3 - g['resistance'] * 0.4,
  thresholds: { succes: 44, mitige: 30 },
  outcomes: {
    succes: 'Le coup réussit : la monarchie est proclamée.',
    mitige: 'Le coup échoue de peu.',
    echec: 'Le coup échoue.',
  },
  rewards: (status, _g, d) => status === 'succes'
    ? [{ kind: 'end', status: 'victoire', title: 'Un royaume né d’un coup de force', reason: `La monarchie est proclamée à l’aube. ${d.player.name} devient Régent·e du Royaume… et l’Europe condamne. Une victoire qui aura un prix.` }]
    : [{ kind: 'end', status: 'defaite', title: 'Arrêté·e', reason: 'Le coup a échoué. Vous êtes jugé·e pour atteinte aux institutions de la République.' }],
};

// ── 11. Tenue de loge (franc-maçon) ─────────────────────────

const TENUE: SceneDef = {
  id: 'tenue', title: 'Tenue de loge', eyebrow: 'Loge',
  intro: 'Ce soir, à la loge {loge}, vous présentez une planche sur {domaine}. Les frères et les sœurs écoutent, puis débattent.',
  band: '#18233a', minRank: 'militant', domain: 'agenda',
  setup: d => ({ loge: d.lodge?.loge ?? 'votre loge' }),
  gauges: [
    { id: 'ecoute', label: 'Écoute des frères', min: 0, max: 100, start: d => 30 + (d.lodge?.fraternite ?? 30) * 0.3, good: 'high' },
    { id: 'profondeur', label: 'Profondeur de la planche', min: 0, max: 100, start: d => 15 + d.player.dossiers[d.agendaDomain].mastery * 0.3, good: 'high' },
    { id: 'politique', label: 'Soupçon d’arrivisme', min: 0, max: 100, start: 10, good: 'low',
      danger: { above: 70, label: 'Rappel à l’ordre', text: 'Le Vénérable vous rappelle que la loge n’est pas une tribune politique.', delta: { ecoute: -15 } } },
  ],
  stages: [['l_angle'], ['l_symbole'], ['l_debat', 'l_contradicteur'], ['l_agapes']],
  steps: [
    {
      id: 'l_angle', title: 'L’angle de votre planche', context: 'Comment aborder {domaine} ?',
      choices: [
        ch('philo', 'Un angle philosophique : le bien commun', { profondeur: 15, ecoute: 8 }, 'Vous citez Condorcet. On hoche la tête.'),
        ch('technique', 'Un exposé technique, chiffres à l’appui', { profondeur: 18 }, 'Rigoureux, un peu aride.', {
          risk: { chance: 0.6, scaleWith: 'dossier', weight: 1, onFail: { profondeur: 4, ecoute: -6 }, failText: 'Un frère économiste relève plusieurs erreurs.' },
        }),
        ch('programme', 'Glisser vos propositions politiques', { profondeur: 6, politique: 25 }, 'Certains froncent les sourcils.'),
      ],
    },
    {
      id: 'l_symbole', title: 'Le symbole', context: 'Une planche réussie s’appuie sur un symbole.',
      choices: [
        ch('equerre', 'L’équerre et le compas : la mesure et l’idéal', { profondeur: 10, ecoute: 6 }, 'Classique et maîtrisé.'),
        ch('pierre', 'La pierre brute que l’on taille', { profondeur: 12, ecoute: 4 }, 'Une belle image du travail sur soi.'),
        ch('lumiere', 'La lumière, sans développer', { ecoute: -4 }, 'Un peu convenu.'),
      ],
    },
    {
      id: 'l_debat', title: 'Le débat fraternel', context: 'Les frères et sœurs prennent la parole tour à tour.',
      choices: [
        ch('ecouter', 'Écouter chacun, remercier, nuancer', { ecoute: 12, profondeur: 5 }, 'L’humilité est la première vertu en loge.'),
        ch('defendre', 'Défendre pied à pied votre position', { profondeur: 8, ecoute: -6 }, 'Brillant mais raide.'),
        ch('rallier', 'Proposer à ceux qui sont d’accord de « se revoir »', { politique: 22, ecoute: 2 }, 'On murmure au fond du temple.'),
      ],
    },
    {
      id: 'l_contradicteur', title: 'Un frère vous contredit sévèrement', context: '« Ta planche est un tract déguisé. »',
      choices: [
        ch('remercier', 'Le remercier : la contradiction nous élève', { ecoute: 14, politique: -10 }, 'Le temple apprécie.'),
        ch('repondre', 'Lui répondre sur le fond', { profondeur: 10 }, 'Un échange de haute tenue.', {
          risk: { chance: 0.5, scaleWith: 'dossier', weight: 0.8, onFail: { ecoute: -10 }, failText: 'Il a raison, et tout le monde le voit.' },
        }),
        ch('irriter', 'Vous agacer', { ecoute: -12, politique: 8 }, 'Un faux pas qu’on vous rappellera.'),
      ],
    },
    {
      id: 'l_agapes', title: 'Les agapes', context: 'Le repas fraternel prolonge la tenue.',
      choices: [
        ch('simple', 'Rester simple et chaleureux', { ecoute: 8 }, 'Les liens se resserrent.'),
        ch('reseau', 'Parler affaires avec un frère influent', { politique: 15, ecoute: 2 }, 'Utile… mais remarqué.'),
        ch('servir', 'Aider au service et à la vaisselle', { ecoute: 10, politique: -5 }, 'Le geste est apprécié des plus anciens.'),
      ],
    },
  ],
  score: g => g['ecoute'] * 0.45 + g['profondeur'] * 0.45 - g['politique'] * 0.3,
  thresholds: { succes: 53, mitige: 35 },
  outcomes: {
    succes: 'Une planche remarquée : vos frères et sœurs vous voient grandir.',
    mitige: 'Une planche honnête, sans éclat.',
    echec: 'Une planche manquée : on vous juge trop pressé·e.',
  },
  rewards: (status, g) => {
    const e: Effect[] = status === 'succes'
      ? [{ kind: 'lodge', planches: 1, fraternite: 8 }, { kind: 'dossier', domain: '$domain', delta: 6 }, stat('credibility', 1)]
      : status === 'mitige' ? [{ kind: 'lodge', planches: 1, fraternite: 3 }, { kind: 'dossier', domain: '$domain', delta: 3 }]
      : [{ kind: 'lodge', fraternite: -5 }];
    if (g['politique'] > 50) e.push({ kind: 'lodge', fraternite: -4, discretion: -4 });
    return e;
  },
};

// ── 12. Convent : élection à la Grande Maîtrise ─────────────

const CONVENT: SceneDef = {
  id: 'convent', title: 'Le convent', eyebrow: 'Obédience',
  intro: 'Les délégués de toutes les loges de {obedience} élisent leur Grand Maître. Deux autres candidats sont en lice.',
  band: '#18233a', minRank: 'militant', domain: 'agenda',
  setup: d => ({ obedience: d.lodge?.obedience ?? 'l’obédience' }),
  gauges: [
    { id: 'voix', label: 'Délégués acquis', min: 0, max: 100, start: d => 5 + (d.lodge?.fraternite ?? 40) * 0.2, good: 'high', format: 'pct' },
    { id: 'estime', label: 'Estime des loges', min: 0, max: 100, start: d => 30 + (d.lodge?.planches ?? 0) * 3, good: 'high' },
    { id: 'politique', label: 'Accusation de politisation', min: 0, max: 100, start: d => 20 + d.player.stats.influence * 0.2, good: 'low',
      danger: { above: 80, label: 'Campagne de dénigrement', text: 'Un tract anonyme vous accuse de vouloir « mettre l’obédience au service d’un parti ».', delta: { voix: -12 } } },
  ],
  stages: [['v_profession'], ['v_tournee'], ['v_rival'], ['v_vote']],
  steps: [
    {
      id: 'v_profession', title: 'La profession de foi', context: 'Quel projet pour l’obédience ?',
      choices: [
        ch('spirituel', 'Revenir à l’essentiel : le travail sur soi', { estime: 12, politique: -10, voix: 4 }, 'Un retour aux sources apprécié des anciens.'),
        ch('societe', 'Une obédience engagée dans les débats de société', { voix: 10, politique: 10 }, 'Les jeunes loges applaudissent.'),
        ch('rayonnement', 'Le rayonnement international', { voix: 6, estime: 6 }, 'Un projet consensuel.'),
      ],
    },
    {
      id: 'v_tournee', title: 'La tournée des loges', context: 'Trois mois pour rencontrer les délégués.',
      choices: [
        ch('toutes', 'Visiter toutes les loges, même les plus petites', { voix: 14, estime: 6 }, 'Épuisant, mais chaque délégué a été écouté.'),
        ch('grandes', 'Se concentrer sur les grandes loges parisiennes', { voix: 10, estime: -4 }, 'Efficace, un peu méprisant.'),
        ch('promesses', 'Promettre des postes aux délégués', { voix: 16, politique: 15, estime: -8 }, 'Des voix… achetées, murmure-t-on.'),
      ],
    },
    {
      id: 'v_rival', title: 'Votre rival vous attaque', context: '« Un homme politique ne peut pas diriger l’obédience. »',
      choices: [
        ch('renoncer_mandat', 'Promettre de quitter la vie partisane', { voix: 14, politique: -20 }, 'Un engagement fort, qui vous coûtera.', { hint: 'Un engagement moral, qui pèsera.' }),
        ch('assumer', 'Assumer : un frère engagé dans la cité', { voix: 6, politique: 6 }, 'Le débat est lancé.'),
        ch('dossier', 'Ressortir un vieux dossier sur votre rival', { voix: 10, estime: -12, politique: 8 }, 'Le coup porte, mais déshonore.', {
          risk: { chance: 0.45, scaleWith: 'credibility', weight: 0.5, onFail: { voix: -10, estime: -10 }, failText: 'Le dossier est vide. Vous êtes discrédité·e.' },
        }),
      ],
    },
    {
      id: 'v_vote', title: 'Le vote', context: 'Dernier discours avant le scrutin.',
      choices: [
        ch('humble', 'Un discours humble et fraternel', { voix: 8, estime: 6 }, 'Les délégués sont touchés.'),
        ch('vision', 'Une grande vision pour les dix ans à venir', { voix: 10 }, 'Ambitieux, inspirant.'),
        ch('alliance', 'Un accord de dernière minute avec le troisième candidat', { voix: 14, politique: 8 }, 'Il se désiste en votre faveur.', {
          risk: { chance: 0.4, scaleWith: 'influence', weight: 0.5, onFail: { voix: -6 }, failText: 'Il refuse et le fait savoir.' },
        }),
      ],
    },
  ],
  score: g => g['voix'] + g['estime'] * 0.2 - g['politique'] * 0.15,
  thresholds: { succes: 62, mitige: 45 },
  outcomes: {
    succes: 'Élu·e Grand Maître de l’obédience.',
    mitige: 'Battu·e de peu : vous resterez une voix qui compte.',
    echec: 'Une défaite nette au convent.',
  },
  rewards: status => status === 'succes'
    ? [{ kind: 'grade', delta: 1 }, stat('influence', 6), { kind: 'lodge', fraternite: 10, discretion: -10 }, { kind: 'booster', count: 1, reason: 'Des frères et sœurs de talent proposent leurs services.' }]
    : status === 'mitige' ? [{ kind: 'lodge', fraternite: 3 }]
    : [{ kind: 'lodge', fraternite: -8 }, stat('stress', 6)],
};


// ── Rédaction : enquête journalistique ──────────────────────

const pressFx = (e: { audience?: number; reputation?: number; independance?: number; scoops?: number }): Effect => ({ kind: 'press', ...e });

const ENQUETE: SceneDef = {
  id: 'enquete', title: 'Enquête', eyebrow: 'Rédaction',
  intro: 'Une piste sérieuse : {sujet}. Trois semaines pour réunir des preuves… sans finir au tribunal.',
  band: '#2a2420', minRank: 'militant', domain: 'agenda',
  setup: (_d, pick) => ({
    sujet: pick(['un marché public truqué dans une grande métropole', 'les comptes opaques d’un laboratoire pharmaceutique',
      'un ancien ministre devenu lobbyiste', 'une association fantôme largement subventionnée', 'des emplois de complaisance au conseil régional']),
  }),
  gauges: [
    { id: 'preuves', label: 'Solidité des preuves', min: 0, max: 100, start: 10, good: 'high' },
    { id: 'sources', label: 'Confiance des sources', min: 0, max: 100, start: 50, good: 'high',
      danger: { below: 10, label: 'Silence radio', text: 'Vos sources ne répondent plus : l’enquête s’arrête.', end: true } },
    { id: 'juridique', label: 'Risque juridique', min: 0, max: 100, start: 15, good: 'low',
      danger: { above: 85, label: 'Mise en demeure', text: 'Les avocats de la partie adverse obtiennent la suspension de la publication.', end: true } },
  ],
  stages: [['e_piste'], ['e_source', 'e_documents'], ['e_pression', 'e_avocat'], ['e_verif'], ['e_publication']],
  steps: [
    {
      id: 'e_piste', title: 'Tirer le fil', context: 'Un courriel anonyme, quelques chiffres troublants.',
      choices: [
        ch('archives', 'Éplucher les archives publiques', { preuves: 12, sources: 0 }, 'Des incohérences apparaissent dans les comptes.'),
        ch('terrain', 'Aller sur place interroger les témoins', { preuves: 8, sources: 12 }, 'Un ancien salarié accepte de parler.'),
        ch('confrere', 'S’associer avec un confrère d’un autre journal', { preuves: 10, sources: 5, juridique: -5 }, 'À deux, on va plus vite et on se protège mieux.', {
          risk: { chance: 0.3, onFail: { sources: -10 }, failText: 'Votre confrère publie un bout de l’histoire sans vous.' },
        }),
      ],
    },
    {
      id: 'e_source', title: 'Une source clé hésite', context: 'Elle a peur pour son emploi.',
      choices: [
        ch('anonymat', 'Lui garantir l’anonymat absolu', { sources: 15, preuves: 10 }, 'Elle vous confie des courriels internes.'),
        ch('pression', 'La pousser : « C’est maintenant ou jamais »', { preuves: 18, sources: -20 }, 'Elle parle, mais vous en veut.'),
        ch('lacher', 'La laisser tranquille', { sources: 6 }, 'Elle vous rappellera peut-être.'),
      ],
    },
    {
      id: 'e_documents', title: 'Des documents tombent du camion', context: 'Une clé USB dans votre boîte aux lettres. Provenance inconnue.',
      choices: [
        ch('verifier', 'Tout faire authentifier par un expert', { preuves: 14, juridique: -5 }, 'Les documents sont authentiques.', { money: 800 }),
        ch('utiliser', 'Les utiliser tels quels', { preuves: 20, juridique: 15 }, 'Spectaculaire… et fragile juridiquement.'),
        ch('ignorer', 'Les écarter : trop risqué', { juridique: -8 }, 'Prudence.'),
      ],
    },
    {
      id: 'e_pression', title: 'Coup de fil du propriétaire', context: 'Le sujet dérange un annonceur important.',
      choices: [
        ch('tenir', 'Tenir bon', { preuves: 4 }, 'Vous continuez.', {
          risk: { chance: 0.35, scaleWith: 'influence', weight: 0.6, onFail: { juridique: 10, sources: -5 }, failText: 'On vous retire votre assistante pour « raisons budgétaires ».' },
        }),
        ch('ruser', 'Promettre d’édulcorer… et n’en rien faire', { preuves: 6, juridique: 6 }, 'Le propriétaire est rassuré. Pour l’instant.'),
        ch('ceder', 'Lever le pied', { preuves: -10, juridique: -10 }, 'L’enquête perd de sa force.'),
      ],
    },
    {
      id: 'e_avocat', title: 'Lettre d’avocat', context: 'La partie adverse menace d’un procès en diffamation.',
      choices: [
        ch('contradictoire', 'Envoyer vos questions pour respecter le contradictoire', { juridique: -15, preuves: 4 }, 'Leur réponse embarrassée renforce votre papier.'),
        ch('accelerer', 'Accélérer la publication', { juridique: 12, preuves: 6 }, 'Vous prenez de vitesse les avocats.'),
        ch('juriste', 'Faire relire par le juriste du journal', { juridique: -20, preuves: -4 }, 'Quelques phrases coupées, beaucoup de sécurité.'),
      ],
    },
    {
      id: 'e_verif', title: 'Vérification croisée', context: 'Un dernier point ne tient qu’à un témoignage.',
      choices: [
        ch('deuxieme', 'Trouver une deuxième source', { preuves: 14, sources: -5 }, 'Confirmé.', {
          risk: { chance: 0.4, scaleWith: 'dossier', weight: 0.7, onFail: { preuves: 2 }, failText: 'Impossible de trouver une confirmation.' },
        }),
        ch('conditionnel', 'Écrire au conditionnel', { preuves: 4, juridique: -8 }, 'Moins percutant, plus sûr.'),
        ch('affirmer', 'Affirmer sans détour', { preuves: 8, juridique: 14 }, 'Le titre claque.'),
      ],
    },
    {
      id: 'e_publication', title: 'Bouclage', context: 'Le papier est prêt. Comment le sortir ?',
      choices: [
        ch('une', 'En une, avec révélations en série', { preuves: 6, juridique: 6 }, 'Le scoop tourne en boucle.'),
        ch('sobre', 'Une publication sobre et documentée', { preuves: 4, juridique: -6 }, 'Les confrères reprennent sans réserve.'),
        ch('tele', 'Une exclusivité télévisée', { preuves: 3, sources: 5 }, 'Une audience record.'),
      ],
    },
  ],
  score: g => g['preuves'] - g['juridique'] * 0.4 + g['sources'] * 0.15,
  thresholds: { succes: 62, mitige: 40 },
  outcomes: {
    succes: 'Le scoop fait trembler le pouvoir : on ne parle que de votre enquête.',
    mitige: 'Votre papier est repris, mais il manque la pièce décisive.',
    echec: 'L’enquête tourne court. Vos confrères en sourient.',
  },
  rewards: status => status === 'succes'
    ? [pressFx({ scoops: 1, reputation: 8, audience: 6 }), stat('influence', 3), stat('credibility', 2)]
    : status === 'mitige' ? [pressFx({ reputation: 3, audience: 2 })]
    : [pressFx({ reputation: -6 }), stat('stress', 6)],
};

// ── Rédaction : émission en direct ──────────────────────────

const DIRECT: SceneDef = {
  id: 'direct', title: 'En direct', eyebrow: 'Rédaction',
  intro: 'Vous animez ce soir l’émission phare de {media}. Sujet : {domaine}. Trois invités, un public, zéro filet.',
  band: '#1d1f2b', minRank: 'militant', domain: 'agenda',
  setup: d => ({ media: d.press?.outlet ?? 'la chaîne' }),
  gauges: [
    { id: 'audience', label: 'Audience', min: 0, max: 100, start: d => 20 + (d.press?.audience ?? 20) * 0.4, good: 'high' },
    { id: 'credibilite', label: 'Crédibilité de l’émission', min: 0, max: 100, start: d => 25 + (d.press?.reputation ?? 30) * 0.4, good: 'high' },
    { id: 'tension', label: 'Tension sur le plateau', min: 0, max: 100, start: 25, good: 'low',
      danger: { above: 90, label: 'Clash incontrôlable', text: 'Deux invités en viennent presque aux mains : la régie coupe l’antenne.', end: true } },
  ],
  stages: [['d_ouverture'], ['d_derapage', 'd_chiffre'], ['d_breaking', 'd_public'], ['d_conclusion']],
  steps: [
    {
      id: 'd_ouverture', title: 'Lancement', context: 'Générique, lumière, caméra 1.',
      choices: [
        ch('choc', 'Ouvrir sur une question choc', { audience: 12, tension: 12 }, 'Les invités s’écharpent d’emblée.'),
        ch('pedago', 'Poser le décor avec un reportage', { credibilite: 10, audience: 3 }, 'Clair et instructif.'),
        ch('exclu', 'Annoncer une révélation en fin d’émission', { audience: 10, credibilite: -3 }, 'Personne ne zappe.'),
      ],
    },
    {
      id: 'd_derapage', title: 'Un invité dérape', context: 'Une phrase inacceptable, en direct.',
      choices: [
        ch('recadrer', 'Le recadrer fermement', { credibilite: 12, tension: 8 }, 'Le public applaudit.'),
        ch('laisser', 'Laisser filer : ça fait de l’audience', { audience: 12, credibilite: -12 }, 'Les réseaux s’enflamment.'),
        ch('pub', 'Lancer une page de publicité', { tension: -15, audience: -5 }, 'Le temps de faire redescendre la pression.'),
      ],
    },
    {
      id: 'd_chiffre', title: 'Un chiffre faux', context: 'Un invité assène une statistique douteuse.',
      choices: [
        ch('corriger', 'Corriger en direct, chiffres à l’appui', { credibilite: 14, tension: 6 }, 'Le fact-checking en direct est salué.', {
          requires: { minMastery: 35 }, hint: 'Exige de maîtriser le sujet (35).',
        }),
        ch('relance', 'Demander à l’invité sa source', { credibilite: 8, tension: 4 }, 'Il bafouille.'),
        ch('passer', 'Passer à autre chose', { credibilite: -6 }, 'Le chiffre restera.'),
      ],
    },
    {
      id: 'd_breaking', title: 'Dernière minute', context: 'Une dépêche tombe : un ministre démissionne.',
      choices: [
        ch('basculer', 'Basculer en édition spéciale', { audience: 15, tension: 5 }, 'Vous êtes les premiers.', {
          risk: { chance: 0.3, scaleWith: 'influence', weight: 0.5, onFail: { credibilite: -12 }, failText: 'L’information est démentie dix minutes plus tard.' },
        }),
        ch('verifier', 'Attendre une confirmation', { credibilite: 8, audience: -4 }, 'Vous l’annoncez avec un quart d’heure de retard, sans erreur.'),
      ],
    },
    {
      id: 'd_public', title: 'Une question du public', context: 'Une infirmière interpelle les invités, la voix tremblante.',
      choices: [
        ch('temps', 'Lui laisser tout le temps nécessaire', { credibilite: 8, audience: 8, tension: -8 }, 'Un moment de vérité qui tourne en boucle.'),
        ch('invite', 'Forcer un invité à lui répondre précisément', { credibilite: 10, tension: 10 }, 'L’invité s’enferre.'),
        ch('couper', 'Couper : le temps presse', { audience: -6, credibilite: -6 }, 'On vous le reprochera.'),
      ],
    },
    {
      id: 'd_conclusion', title: 'Conclusion', context: 'Trente secondes avant le générique.',
      choices: [
        ch('edito', 'Un éditorial tranchant', { audience: 8, tension: 4 }, 'Votre conclusion est citée partout.'),
        ch('synthese', 'Une synthèse équilibrée', { credibilite: 8 }, 'Sobre et efficace.'),
        ch('revelation', 'Tenir la promesse de la révélation', { audience: 10, credibilite: 5 }, 'Le scoop fait le buzz.', {
          risk: { chance: 0.4, onFail: { credibilite: -15 }, failText: 'La « révélation » tombe à plat.' },
        }),
      ],
    },
  ],
  score: g => g['audience'] * 0.55 + g['credibilite'] * 0.55 - Math.max(0, g['tension'] - 60) * 0.5,
  thresholds: { succes: 62, mitige: 45 },
  outcomes: {
    succes: 'Une émission de référence : audience record et confrères admiratifs.',
    mitige: 'Une émission correcte, vite oubliée.',
    echec: 'Une soirée ratée : la direction convoque l’équipe.',
  },
  rewards: (status, g) => {
    const out: Effect[] = status === 'succes'
      ? [pressFx({ audience: 9, reputation: 4 }), stat('popularity', 3), stat('influence', 2)]
      : status === 'mitige' ? [pressFx({ audience: 3, reputation: 1 })]
      : [pressFx({ audience: -5, reputation: -4 }), stat('stress', 6)];
    if (g['tension'] > 70) out.push(pressFx({ reputation: -3, audience: 3 }));
    return out;
  },
};

// ── Infiltration : réunion secrète du bureau ────────────────

const moleFx = (e: { intel?: number; cover?: number; sabotage?: number }): Effect => ({ kind: 'mole', ...e });

const BUREAU_SECRET: SceneDef = {
  id: 'bureau_secret', title: 'Réunion secrète', eyebrow: 'Infiltration',
  intro: 'Le bureau {parti} se réunit à huis clos. Vous avez obtenu une place au fond de la salle. Ouvrez grand les oreilles… et gardez votre sang-froid.',
  band: '#14181f', minRank: 'militant', domain: 'agenda',
  setup: d => ({ parti: ofParty(d.party.name) }),
  gauges: [
    { id: 'infos', label: 'Informations recueillies', min: 0, max: 100, start: 5, good: 'high' },
    { id: 'soupcon', label: 'Soupçons', min: 0, max: 100, start: d => 50 - (d.mole?.cover ?? 50) * 0.4, good: 'low',
      danger: { above: 80, label: 'On vous demande de sortir', text: '« Tu peux nous laisser un instant ? » Vous voilà dehors, et surveillé·e.', end: true } },
    { id: 'confiance', label: 'Confiance du bureau', min: 0, max: 100, start: 40, good: 'high' },
  ],
  stages: [['b_arrivee'], ['b_strategie', 'b_finances'], ['b_telephone', 'b_vote'], ['b_sortie']],
  steps: [
    {
      id: 'b_arrivee', title: 'Votre place', context: 'Une vingtaine de cadres, un vidéoprojecteur, du café tiède.',
      choices: [
        ch('fond', 'S’asseoir au fond, sans un mot', { soupcon: -5, infos: 4 }, 'Personne ne vous remarque.'),
        ch('notes', 'Prendre des notes ostensiblement', { infos: 12, soupcon: 10 }, 'Votre carnet se remplit. Quelques regards aussi.'),
        ch('compte_rendu', 'Proposer de rédiger le compte rendu', { infos: 18, confiance: 6, soupcon: 4 }, 'On vous confie le procès-verbal !', {
          risk: { chance: 0.35, scaleWith: 'influence', weight: 0.5, onFail: { soupcon: 12 }, failText: '« Pourquoi tant d’empressement ? » demande le secrétaire général.' },
        }),
      ],
    },
    {
      id: 'b_strategie', title: 'La stratégie électorale', context: 'Le directeur de campagne détaille les circonscriptions visées.',
      choices: [
        ch('question', 'Poser une question faussement naïve', { infos: 14, soupcon: 6 }, 'Il vous répond en détail.'),
        ch('taire', 'Se taire et mémoriser', { infos: 7, soupcon: -3 }, 'Votre mémoire fait le travail.'),
        ch('ferveur', 'Défendre la ligne avec ferveur', { confiance: 12, soupcon: -10 }, 'On vous applaudit. Ironie du sort.'),
      ],
    },
    {
      id: 'b_finances', title: 'Les comptes du parti', context: 'Le trésorier évoque « un problème de dons » à voix basse.',
      choices: [
        ch('approcher', 'Se rapprocher discrètement', { infos: 16, soupcon: 10 }, 'Vous captez les montants. Et un nom.'),
        ch('photo', 'Photographier le tableau projeté', { infos: 22, soupcon: 18 }, 'Clic. Le flash était activé.', {
          risk: { chance: 0.4, onFail: { soupcon: 15 }, failText: 'Le flash ! Tous les visages se tournent vers vous.' },
        }),
        ch('ignorer', 'Faire semblant de consulter son téléphone', { infos: 4, soupcon: -4 }, 'Vous n’entendez que des bribes.'),
      ],
    },
    {
      id: 'b_telephone', title: 'Votre téléphone vibre', context: 'Un message de votre officier traitant : « Alors ? »',
      choices: [
        ch('ignorer', 'L’ignorer', { soupcon: -2 }, 'Le téléphone vibre encore. Et encore.'),
        ch('repondre', 'Répondre sous la table', { infos: 6, soupcon: 12 }, 'Message envoyé.', {
          risk: { chance: 0.35, onFail: { soupcon: 15, confiance: -8 }, failText: 'Votre voisin lit par-dessus votre épaule.' },
        }),
        ch('eteindre', 'L’éteindre ostensiblement', { confiance: 4, soupcon: -4 }, '« Enfin quelqu’un de respectueux », glisse la présidente.'),
      ],
    },
    {
      id: 'b_vote', title: 'Le vote sur les investitures', context: 'On vote à main levée sur la liste des candidats.',
      choices: [
        ch('majorite', 'Voter avec la majorité', { confiance: 8, soupcon: -4 }, 'Vous vous fondez dans la masse.'),
        ch('faible', 'Pousser le candidat le plus faible', { infos: 6, soupcon: 8, confiance: -4 }, 'Une petite graine de défaite plantée.'),
        ch('abstention', 'S’abstenir', { soupcon: 8 }, 'Votre main reste baissée. On le note.'),
      ],
    },
    {
      id: 'b_sortie', title: 'Après la réunion', context: 'Quelques cadres restent boire un verre.',
      choices: [
        ch('verre', 'Rester boire un verre', { infos: 12, soupcon: 4, confiance: 6 }, 'Les langues se délient au deuxième verre.'),
        ch('tresorier', 'Raccompagner le trésorier', { infos: 18, soupcon: 8 }, 'Il vous parle de ses inquiétudes… et de comptes à l’étranger.', {
          risk: { chance: 0.4, scaleWith: 'popularity', weight: 0.4, onFail: { soupcon: 12 }, failText: 'Il se méfie et change de sujet.' },
        }),
        ch('partir', 'Partir vite', { soupcon: 5 }, 'Vous filez dans la nuit.'),
      ],
    },
  ],
  score: g => g['infos'] - g['soupcon'] * 0.5 + g['confiance'] * 0.2,
  thresholds: { succes: 42, mitige: 24 },
  outcomes: {
    succes: 'Une moisson exceptionnelle : votre carnet vaut de l’or.',
    mitige: 'Quelques éléments utiles, au prix de quelques regards appuyés.',
    echec: 'Rien d’exploitable, et des soupçons en plus.',
  },
  rewards: (status, g) => status === 'succes'
    ? [moleFx({ intel: 18, cover: 3 }), stat('stress', 4)]
    : status === 'mitige' ? [moleFx({ intel: 9, cover: -5 }), stat('stress', 5)]
    : [moleFx({ intel: Math.round(g['infos'] / 6), cover: -15 }), stat('stress', 8)],
};

// ── Infiltration : le grand déballage ───────────────────────

const DEBALLAGE: SceneDef = {
  id: 'deballage', title: 'Le grand déballage', eyebrow: 'Infiltration',
  intro: 'Salle comble, caméras de toutes les chaînes. Vous allez révéler ce que vous avez vu de l’intérieur {parti}.',
  band: '#2a1215', minRank: 'militant', domain: 'agenda',
  setup: d => ({ parti: ofParty(d.party.name) }),
  gauges: [
    { id: 'impact', label: 'Impact', min: 0, max: 100, start: 15, good: 'high' },
    { id: 'credibilite', label: 'Crédibilité des révélations', min: 0, max: 100, start: d => 20 + d.player.stats.credibility * 0.4 + Math.min(20, (d.mole?.delivered ?? 0) / 10), good: 'high' },
    { id: 'riposte', label: 'Riposte adverse', min: 0, max: 100, start: 20, good: 'low',
      danger: { above: 85, label: 'Contre-offensive', text: 'Le parti retourne l’opinion : « Un traître payé par l’adversaire ». La salle se vide.', end: true } },
  ],
  stages: [['g_ouverture'], ['g_preuves'], ['g_dementi', 'g_question'], ['g_final']],
  steps: [
    {
      id: 'g_ouverture', title: 'Les premiers mots', context: 'Les flashs crépitent.',
      choices: [
        ch('identite', 'Révéler d’emblée qui vous êtes', { impact: 16, riposte: 10 }, 'Un silence de mort, puis un brouhaha.'),
        ch('preuves', 'Commencer par les faits', { credibilite: 12, impact: 6 }, 'Méthodique. Les journalistes notent tout.'),
        ch('mise_en_scene', 'Une mise en scène spectaculaire', { impact: 14, credibilite: -6 }, 'Effet garanti, sérieux discutable.'),
      ],
    },
    {
      id: 'g_preuves', title: 'Les preuves', context: 'Le moment de sortir les documents.',
      choices: [
        ch('documents', 'Distribuer les documents internes', { credibilite: 16, impact: 8 }, 'Chaque rédaction repart avec son dossier.'),
        ch('enregistrements', 'Diffuser des enregistrements', { impact: 20, riposte: 10 }, 'La voix du chef résonne dans la salle.', {
          risk: { chance: 0.35, onFail: { credibilite: -15, riposte: 10 }, failText: 'Un expert conteste l’authenticité de la bande.' },
        }),
        ch('temoins', 'Faire témoigner deux anciens cadres', { credibilite: 10, impact: 10 }, 'Leurs récits concordent.'),
      ],
    },
    {
      id: 'g_dementi', title: 'Le démenti tombe', context: 'Le parti publie un communiqué : « Calomnies d’un agent de l’adversaire ».',
      choices: [
        ch('contre', 'Opposer une nouvelle preuve', { riposte: -15, credibilite: 6 }, 'Le démenti s’effondre.'),
        ch('attaque', 'Attaquer le chef personnellement', { impact: 10, riposte: 12 }, 'Le ton monte. Les caméras adorent.'),
        ch('calme', 'Rester calme : « Les faits parlent »', { credibilite: 6, riposte: 4 }, 'Votre sérénité impressionne.'),
      ],
    },
    {
      id: 'g_question', title: '« Pourquoi avoir trahi ? »', context: 'Une journaliste pose la question que tout le monde se pose.',
      choices: [
        ch('sincere', 'Répondre avec sincérité', { credibilite: 12, impact: 4 }, 'Votre émotion paraît vraie.'),
        ch('republique', '« Pour la démocratie »', { impact: 10, riposte: 4 }, 'La formule fera les titres.'),
        ch('cynique', '« La politique est une guerre »', { impact: 6, credibilite: -10, riposte: 8 }, 'Un frisson parcourt la salle.'),
      ],
    },
    {
      id: 'g_final', title: 'Le mot de la fin', context: 'Dernière question avant de partir.',
      choices: [
        ch('demission', 'Exiger la démission de la direction', { impact: 14, riposte: 8 }, 'Le hashtag #Démission s’envole.'),
        ch('camp', 'Annoncer rejoindre ouvertement votre camp', { impact: 8, credibilite: -4 }, 'Votre vrai camp vous accueille en héros.'),
        ch('justice', 'Annoncer saisir la justice', { credibilite: 10, riposte: -6 }, 'Le parquet se dit « attentif ».'),
      ],
    },
  ],
  score: g => g['impact'] * 0.5 + g['credibilite'] * 0.5 - g['riposte'] * 0.35,
  thresholds: { succes: 46, mitige: 34 },
  outcomes: {
    succes: 'Le parti adverse s’effondre dans les sondages. Opération réussie.',
    mitige: 'Le coup porte, mais votre réputation y laisse des plumes.',
    echec: 'Personne ne vous croit. Le parti adverse sort renforcé.',
  },
  rewards: (status, _g, d) => status === 'succes'
    ? [{ kind: 'end', status: 'victoire', title: 'Opération réussie', reason: `Vos révélations font tomber la direction ${ofParty(d.party.name)}. Dans votre camp, on parle déjà de vous pour de hautes fonctions.` }]
    : status === 'mitige'
    ? [stat('popularity', -5), { kind: 'end', status: 'victoire', title: 'Victoire à la Pyrrhus', reason: 'Le parti adverse est ébranlé, mais votre nom restera associé au mot « taupe ». Mission accomplie, carrière à reconstruire.' }]
    : [{ kind: 'end', status: 'defaite', title: 'Personne ne vous croit', reason: 'Vos révélations font pschitt. Rejeté·e par les deux camps, vous disparaissez de la vie politique.' }],
};

const RAW_SCENES: SceneDef[] = [
  MARCHE, MEETING, MEDIATION, COMMISSION, CRISE, ALLIANCE, MARCHE_PUBLIC,
  TOURNEE_PRINCE, REFERENDUM, COUP, TENUE, CONVENT, ENQUETE, DIRECT, BUREAU_SECRET, DEBALLAGE, SALON,
];
/* Chaque choix a un prix et aucun ne domine les autres (voir data/balance.ts) */
export const SCENES: SceneDef[] = RAW_SCENES.map(balanceScene);
export const SCENES_BY_ID = new Map(SCENES.map(s => [s.id, s]));

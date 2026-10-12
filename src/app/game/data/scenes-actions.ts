import { Effect } from '../models/game.models';
import { SceneChoiceDef, SceneDef } from './scene-types';

/* ============================================================
 *  Scénarios d'actions : des actions courantes jouées comme des
 *  scènes interactives — porte-à-porte, conférence de presse,
 *  visite d'usine, questions au gouvernement, live sur les
 *  réseaux, promotion d'un livre.
 * ============================================================ */

type Opts = Partial<Pick<SceneChoiceDef, 'hint' | 'requires' | 'money' | 'risk' | 'next'>>;
const ch = (id: string, label: string, delta: Record<string, number>, text: string, opts: Opts = {}): SceneChoiceDef =>
  ({ id, label, delta, text, ...opts });
const stat = (s: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat: s, delta });

// ── Porte-à-porte ───────────────────────────────────────────

const door = (id: string, title: string, context: string, c: [string, string, string, string]) => ({
  id, title, context,
  choices: [
    ch('ecouter', c[0], { convaincus: 7, souffle: -12, accueil: 4 }, 'Vous prenez le temps. La porte reste ouverte longtemps.'),
    ch('argument', c[1], { convaincus: 13, souffle: -6 }, 'L’argument porte.', {
      risk: { chance: 0.7, scaleWith: 'dossier', weight: 1, onFail: { convaincus: 2, accueil: -6 }, failText: 'On vous reprend sur un chiffre. La porte se referme.' },
    }),
    ch('promesse', c[2], { convaincus: 11, accueil: -3 }, 'Une promesse notée sur le frigo.', {
      risk: { chance: 0.45, scaleWith: 'credibility', weight: 0.6, onFail: { convaincus: 2, accueil: -8 }, failText: '« Vous dites tous ça. »' },
    }),
    ch('tract', c[3], { convaincus: 3, souffle: 4 }, 'Un tract glissé, au suivant.'),
  ],
});

export const PORTE_A_PORTE: SceneDef = {
  id: 'porte_a_porte', title: 'Le porte-à-porte', eyebrow: 'Terrain',
  intro: 'Une cage d’escalier, cinq étages, des sonnettes qui grésillent. Le sujet du moment : {domaine}.',
  band: '#2e3a46', minRank: 'militant', domain: 'agenda',
  gauges: [
    { id: 'convaincus', label: 'Électeurs convaincus', min: 0, max: 100, start: 0, good: 'high' },
    { id: 'accueil', label: 'Accueil dans l’immeuble', min: -50, max: 50, start: 0, good: 'high', format: 'signed' },
    { id: 'souffle', label: 'Souffle', min: 0, max: 100, start: d => Math.round(d.player.stats.energy * 0.75), good: 'high',
      danger: { below: 8, label: 'Les jambes coupées', text: 'Cinquième étage sans ascenseur : vous rendez les armes.', end: true } },
  ],
  stages: [['p_interphone', 'p_chien'], ['p_retraite', 'p_etudiant', 'p_famille'], ['p_adversaire', 'p_gardienne'], ['p_retraite', 'p_etudiant', 'p_famille', 'p_seul'], ['p_dernier']],
  steps: [
    {
      id: 'p_interphone', title: 'L’interphone de l’entrée',
      context: '« C’est pour quoi ? » La voix est méfiante.',
      choices: [
        ch('honnete', 'Se présenter franchement', { accueil: 4, convaincus: 3 }, 'La porte s’ouvre dans un bourdonnement.'),
        ch('livreur', 'Dire « C’est pour un colis »', { convaincus: 6, accueil: -8 }, 'Vous entrez… sous un regard noir quand la vérité éclate.'),
        ch('attendre', 'Attendre qu’un habitant sorte', { souffle: -6, accueil: 2 }, 'Dix minutes plus tard, une voisine vous tient la porte.'),
      ],
    },
    {
      id: 'p_chien', title: 'Un chien qui aboie derrière la porte',
      context: 'Un molosse gronde. Son maître entrouvre, sans retenir la bête.',
      choices: [
        ch('caresser', 'Tendre la main au chien', { accueil: 8, convaincus: 4 }, 'Le chien vous lèche la main : le maître est conquis.', {
          risk: { chance: 0.3, onFail: { souffle: -12, accueil: -4 }, failText: 'Le chien vous attrape le bas du pantalon.' },
        }),
        ch('parler', 'Parler fort par-dessus les aboiements', { convaincus: 5, accueil: -2 }, 'On vous entend… à peu près.'),
        ch('fuir', 'Passer à l’étage suivant', { souffle: -4 }, 'Prudence est mère de sûreté.'),
      ],
    },
    door('p_retraite', 'Une retraitée en robe de chambre', '« Entrez donc, il fait froid. Vous prendrez bien un café ? »',
      ['Prendre le café et l’écouter', 'Lui détailler votre proposition sur les retraites', 'Promettre une hausse des petites pensions', 'Lui laisser un tract']),
    door('p_etudiant', 'Un étudiant, casque sur les oreilles', '« La politique, franchement… »',
      ['Discuter de ses galères de logement', 'Lui expliquer votre plan pour les jeunes', 'Promettre le permis gratuit', 'Lui laisser un tract']),
    door('p_famille', 'Une mère de famille débordée', 'Trois enfants dans le couloir, une casserole sur le feu.',
      ['Proposer de repasser plus tard, l’écouter deux minutes', 'Parler cantine et périscolaire, chiffres à l’appui', 'Promettre une crèche dans le quartier', 'Lui glisser un tract']),
    door('p_seul', 'Un homme seul, sa télé allumée', '« Personne ne vient jamais ici. »',
      ['S’asseoir et l’écouter longuement', 'Parler de l’isolement et de vos propositions', 'Promettre de revenir le voir', 'Lui laisser un tract']),
    {
      id: 'p_adversaire', title: 'Un militant adverse dans l’escalier',
      context: 'Il fait le même immeuble, dans l’autre sens. Vous vous croisez au troisième.',
      choices: [
        ch('saluer', 'Le saluer cordialement', { accueil: 4 }, 'Les habitants apprécient le fair-play.'),
        ch('debattre', 'Débattre sur le palier', { convaincus: 14, souffle: -10 }, 'Les portes s’ouvrent pour assister au spectacle.', {
          risk: { chance: 0.45, scaleWith: 'influence', weight: 0.6, onFail: { convaincus: 2, accueil: -10 }, failText: 'Le ton monte : un voisin menace d’appeler la police.' },
        }),
        ch('doubler', 'Le doubler en prenant l’ascenseur', { convaincus: 6, souffle: 6, accueil: -2 }, 'Vous arrivez avant lui aux étages du haut.'),
      ],
    },
    {
      id: 'p_gardienne', title: 'La gardienne de l’immeuble',
      context: '« Vous avez une autorisation pour démarcher ici ? »',
      choices: [
        ch('charmer', 'La charmer et parler du quartier', { accueil: 8, convaincus: 4, souffle: -4 }, 'Elle vous donne les noms des voisins « qui votent ».'),
        ch('reglement', 'Invoquer le droit de démarcher', { convaincus: 4, accueil: -6 }, 'Elle vous laisse passer, en marmonnant.'),
        ch('partir', 'S’excuser et changer d’immeuble', { souffle: -8 }, 'Il faut tout recommencer en face.'),
      ],
    },
    {
      id: 'p_dernier', title: 'Le dernier palier',
      context: 'Une habitante vous rattrape : « Vous pourriez venir parler à notre association de locataires ? »',
      choices: [
        ch('accepter', 'Accepter, sur-le-champ', { convaincus: 10, souffle: -10 }, 'Vingt locataires vous écoutent dans le local à vélos.'),
        ch('rdv', 'Prendre rendez-vous pour la semaine prochaine', { accueil: 6, convaincus: 4 }, 'Votre carnet se remplit.'),
        ch('decliner', 'Décliner poliment', { souffle: 4, accueil: -2 }, 'Elle est un peu déçue.'),
      ],
    },
  ],
  score: g => g['convaincus'] + g['accueil'] * 0.5 - (g['souffle'] <= 8 ? 12 : 0),
  thresholds: { succes: 38, mitige: 22 },
  outcomes: {
    succes: 'L’immeuble parle de vous. Quelques voix gagnées une à une.',
    mitige: 'Des portes ouvertes, d’autres claquées.',
    echec: 'Beaucoup d’escaliers pour pas grand-chose.',
  },
  rewards: status => status === 'succes'
    ? [stat('popularity', 3), { kind: 'momentum', delta: 4 }, { kind: 'dossier', domain: '$domain', delta: 2 }, stat('energy', -6)]
    : status === 'mitige' ? [stat('popularity', 1), stat('energy', -6)]
    : [stat('stress', 4), stat('energy', -6)],
};

// ── Conférence de presse ────────────────────────────────────

export const CONFERENCE_PRESSE: SceneDef = {
  id: 'conference_presse_scene', title: 'La conférence de presse', eyebrow: 'Médias',
  intro: 'Trente journalistes, des caméras, un pupitre. Vous venez parler de {domaine}. Eux viennent pour autre chose.',
  band: '#3a2e46', minRank: 'conseiller_municipal', domain: 'agenda',
  gauges: [
    { id: 'message', label: 'Message passé', min: 0, max: 100, start: 10, good: 'high' },
    { id: 'image', label: 'Image', min: -50, max: 50, start: 0, good: 'high', format: 'signed' },
    { id: 'tension', label: 'Tension dans la salle', min: 0, max: 100, start: 25, good: 'low',
      danger: { above: 80, label: 'La conférence dérape', text: 'Vous quittez le pupitre sous les huées des journalistes.', delta: { image: -12 }, end: true } },
  ],
  stages: [['c_declaration'], ['c_piege', 'c_technique', 'c_rumeur'], ['c_piege', 'c_technique', 'c_rumeur', 'c_jeune'], ['c_micro'], ['c_fin']],
  steps: [
    {
      id: 'c_declaration', title: 'La déclaration liminaire',
      context: 'Cinq minutes pour poser votre message.',
      choices: [
        ch('chiffres', 'Une déclaration dense, chiffrée', { message: 14, tension: 2 }, 'Précis, solide.', {
          risk: { chance: 0.65, scaleWith: 'dossier', weight: 1, onFail: { message: 4, image: -6 }, failText: 'Un chiffre faux, relevé dès la première question.' },
        }),
        ch('formule', 'Une formule choc pour les titres', { message: 10, image: 5, tension: 8 }, 'La formule est reprise partout.'),
        ch('court', 'Une déclaration courte, place aux questions', { message: 5, tension: -6, image: 3 }, 'La salle apprécie.'),
      ],
    },
    {
      id: 'c_piege', title: 'La question piège',
      context: '« Que répondez-vous à ceux qui disent que vous avez changé d’avis trois fois ? »',
      choices: [
        ch('assumer', 'Assumer avec humour', { image: 6, tension: -4 }, 'Rires dans la salle.', {
          risk: { chance: 0.4, scaleWith: 'popularity', weight: 0.5, onFail: { image: -6, tension: 6 }, failText: 'L’humour tombe à plat.' },
        }),
        ch('recentrer', 'Recentrer sur votre message', { message: 8, tension: 6 }, 'Le message passe, la question reste.'),
        ch('attaquer', 'Attaquer le journaliste', { image: -4, tension: 14, message: 4 }, 'L’échange est vif. Il fera le buzz.'),
      ],
    },
    {
      id: 'c_technique', title: 'Une question très technique',
      context: 'Un journaliste spécialisé : « Quel est le coût exact de votre mesure ? »',
      choices: [
        ch('repondre', 'Répondre au centime près', { message: 12, image: 4 }, 'Impressionnant.', {
          risk: { chance: 0.7, scaleWith: 'dossier', weight: 1, onFail: { message: -2, image: -8 }, failText: 'Vous hésitez. Le doute s’installe.' },
        }),
        ch('renvoyer', 'Renvoyer à un document détaillé', { message: 4, tension: 4 }, 'Réponse prudente, un peu frustrante.'),
        ch('ordre', 'Donner un ordre de grandeur', { message: 6, image: -1 }, 'Honnête, sans plus.'),
      ],
    },
    {
      id: 'c_rumeur', title: 'Une rumeur sur votre vie privée',
      context: '« Est-il vrai que vous avez été vu·e avec… ? »',
      choices: [
        ch('refuser', 'Refuser sèchement de répondre', { tension: 8, image: 2 }, 'Silence glacial. La salle respecte.'),
        ch('dementir', 'Démentir en riant', { tension: -4, image: 3 }, 'La question est balayée.', {
          risk: { chance: 0.35, onFail: { image: -10, tension: 10 }, failText: 'Votre rire sonne faux. Le soupçon grandit.' },
        }),
        ch('recadrer', 'Recadrer : « Parlons des Français »', { message: 8, tension: 4 }, 'Applaudissements de votre équipe au fond.'),
      ],
    },
    {
      id: 'c_jeune', title: 'Une jeune journaliste stagiaire',
      context: 'Sa voix tremble : c’est sa première question.',
      choices: [
        ch('bienveillant', 'Répondre avec bienveillance', { image: 8, tension: -6 }, 'Un moment humain, très partagé.'),
        ch('message', 'En profiter pour dérouler votre message', { message: 10, image: -2 }, 'Efficace, un peu froid.'),
        ch('expedier', 'L’expédier en une phrase', { tension: 4, image: -6 }, 'La séquence est montée contre vous le soir même.'),
      ],
    },
    {
      id: 'c_micro', title: 'Le micro resté ouvert',
      context: 'Pendant une pause, vous glissez une remarque à votre attaché de presse. Le micro est-il coupé ?',
      choices: [
        ch('verifier', 'Vérifier avant de parler', { message: 2, tension: -2 }, 'Le micro était ouvert. Ouf.'),
        ch('confiance', 'Parler librement, ça va', { message: 4 }, 'Rien n’est sorti.', {
          risk: { chance: 0.4, onFail: { image: -14, tension: 14 }, failText: 'Votre remarque sur un confrère est diffusée en direct.' },
        }),
        ch('blague', 'Faire une blague au micro, exprès', { image: 6, tension: -4 }, 'La salle rit.', {
          risk: { chance: 0.3, scaleWith: 'popularity', weight: 0.4, onFail: { image: -8 }, failText: 'La blague est jugée déplacée.' },
        }),
      ],
    },
    {
      id: 'c_fin', title: 'La dernière question',
      context: '« Une dernière question, s’il vous plaît. »',
      choices: [
        ch('annonce', 'Conclure par une annonce', { message: 14, image: 4 }, 'Votre annonce fait les titres.', {
          requires: { minMastery: 35 }, hint: 'Exige de maîtriser le sujet à la une (35).',
        }),
        ch('resume', 'Résumer votre message en une phrase', { message: 8, tension: -4 }, 'Clair et net.'),
        ch('partir', 'Quitter la salle sans répondre', { tension: 10, image: -4 }, 'Les caméras filment votre départ.'),
      ],
    },
  ],
  score: g => g['message'] + g['image'] * 0.6 - g['tension'] * 0.25,
  thresholds: { succes: 30, mitige: 15 },
  outcomes: {
    succes: 'Votre message fait les titres. Les éditorialistes saluent la maîtrise.',
    mitige: 'Une conférence correcte, vite oubliée.',
    echec: 'Ce qu’on retiendra, ce n’est pas votre message.',
  },
  rewards: status => status === 'succes'
    ? [stat('credibility', 3), stat('popularity', 2), stat('influence', 2), { kind: 'dossier', domain: '$domain', delta: 2 }]
    : status === 'mitige' ? [stat('credibility', 1)]
    : [stat('credibility', -3), stat('popularity', -1), stat('stress', 4)],
};

// ── Visite d'usine ──────────────────────────────────────────

export const VISITE_USINE: SceneDef = {
  id: 'visite_usine', title: 'La visite d’usine', eyebrow: 'Terrain',
  intro: 'Casque de chantier, gilet fluo, odeur d’huile. Une usine qui embauche… ou qui menace de fermer.',
  band: '#46382e', minRank: 'conseiller_municipal', domain: 'economie',
  gauges: [
    { id: 'ouvriers', label: 'Confiance des ouvriers', min: -50, max: 50, start: 0, good: 'high', format: 'signed' },
    { id: 'direction', label: 'Confiance de la direction', min: -50, max: 50, start: 0, good: 'high', format: 'signed' },
    { id: 'image', label: 'Image', min: 0, max: 100, start: 20, good: 'high' },
    { id: 'colere', label: 'Colère syndicale', min: 0, max: 100, start: 35, good: 'low',
      danger: { above: 80, label: 'Débrayage', text: 'Les ouvriers cessent le travail et vous raccompagnent à la sortie.', delta: { image: -12 }, end: true } },
  ],
  stages: [['u_accueil'], ['u_chaine', 'u_syndicat'], ['u_patron', 'u_apprenti', 'u_syndicat'], ['u_question']],
  steps: [
    {
      id: 'u_accueil', title: 'L’accueil par la direction',
      context: 'Le PDG vous attend avec un diaporama de quarante slides.',
      choices: [
        ch('diapo', 'Écouter tout le diaporama', { direction: 10, ouvriers: -4 }, 'La direction est flattée. Les ouvriers attendent.'),
        ch('atelier', 'Proposer d’aller directement à l’atelier', { ouvriers: 8, direction: -4 }, 'Le PDG range son ordinateur.'),
        ch('les_deux', 'Un café avec la direction, puis l’atelier', { direction: 5, ouvriers: 4, image: -2 }, 'Équilibré, un peu long.'),
      ],
    },
    {
      id: 'u_chaine', title: 'La chaîne de production',
      context: 'Une ouvrière vous propose de tenir son poste cinq minutes.',
      choices: [
        ch('tenir', 'Accepter et mettre les mains dans le cambouis', { ouvriers: 12, image: 8 }, 'Photo parfaite : vous êtes adopté·e.', {
          risk: { chance: 0.35, onFail: { image: -6, ouvriers: 2 }, failText: 'Vous bloquez la chaîne. Rires et sifflets.' },
        }),
        ch('questions', 'Lui poser des questions sur ses conditions', { ouvriers: 8, colere: -6 }, 'Elle parle des cadences, de la paie, du dos qui fait mal.'),
        ch('photo', 'Une photo souriante et on avance', { image: 4, ouvriers: -4 }, '« Comme d’habitude », souffle quelqu’un.'),
      ],
    },
    {
      id: 'u_syndicat', title: 'Les délégués syndicaux',
      context: 'Ils vous attendent près de la machine à café : « Les salaires n’ont pas bougé depuis trois ans. »',
      choices: [
        ch('soutenir', 'Soutenir leurs revendications', { ouvriers: 12, colere: -10, direction: -10 }, 'Les délégués vous serrent la main.'),
        ch('mediation', 'Proposer une médiation', { colere: -8, direction: 4, ouvriers: 4 }, 'Une réunion tripartite est fixée.', {
          risk: { chance: 0.4, scaleWith: 'influence', weight: 0.5, onFail: { colere: 8 }, failText: '« Encore une réunion pour rien. »' },
        }),
        ch('esquiver', 'Botter en touche', { colere: 12, ouvriers: -6 }, 'Les délégués distribuent un tract contre vous.'),
      ],
    },
    {
      id: 'u_patron', title: 'Le PDG en tête-à-tête',
      context: '« Si l’État ne nous aide pas, on délocalise. »',
      choices: [
        ch('aide', 'Promettre de plaider pour une aide publique', { direction: 12, ouvriers: 4, image: -2 }, 'Il vous raccompagne avec chaleur.'),
        ch('conditions', 'Exiger des garanties d’emploi en échange', { direction: -4, ouvriers: 10, image: 4 }, 'Il grimace, mais signe une lettre d’engagement.', {
          risk: { chance: 0.45, scaleWith: 'influence', weight: 0.6, onFail: { direction: -8 }, failText: 'Il refuse tout engagement écrit.' },
        }),
        ch('chantage', 'Refuser le chantage à la délocalisation', { ouvriers: 6, direction: -12, colere: -4 }, 'Le ton est sec.'),
      ],
    },
    {
      id: 'u_apprenti', title: 'Un apprenti de dix-sept ans',
      context: '« Moi, je veux juste un CDI et un appart. C’est trop demander ? »',
      choices: [
        ch('ecouter', 'Prendre le temps de l’écouter', { ouvriers: 8, image: 4 }, 'Ses collègues vous regardent autrement.'),
        ch('formation', 'Parler apprentissage et formation', { ouvriers: 6, direction: 4 }, 'Le directeur des ressources humaines approuve.', {
          risk: { chance: 0.6, scaleWith: 'dossier', weight: 1, onFail: { ouvriers: -2, image: -4 }, failText: 'Vous confondez deux dispositifs.' },
        }),
        ch('selfie', 'Faire un selfie avec lui', { image: 6, ouvriers: -2 }, 'Il le poste aussitôt.'),
      ],
    },
    {
      id: 'u_question', title: 'Le micro de la presse locale',
      context: '« Alors, cette usine a-t-elle un avenir ? »',
      choices: [
        ch('engagement', 'S’engager publiquement pour le site', { ouvriers: 10, image: 8, direction: 4 }, 'Vos mots font la une du quotidien régional.', {
          risk: { chance: 0.4, scaleWith: 'credibility', weight: 0.6, onFail: { image: -8 }, failText: 'On vous ressort vos promesses non tenues.' },
        }),
        ch('prudence', 'Rester prudent', { image: 2, direction: 4 }, 'Une réponse mesurée.'),
        ch('attaque', 'Accuser le gouvernement', { ouvriers: 6, image: 4, direction: -6 }, 'La petite phrase est reprise.'),
      ],
    },
  ],
  score: g => g['ouvriers'] + g['direction'] * 0.6 + g['image'] * 0.4 - g['colere'] * 0.25,
  thresholds: { succes: 30, mitige: 15 },
  outcomes: {
    succes: 'Ouvriers et direction saluent votre visite. On reparlera de vous dans la région.',
    mitige: 'Une visite polie, sans éclat.',
    echec: 'Vous repartez sous les regards noirs.',
  },
  rewards: status => status === 'succes'
    ? [stat('popularity', 3), stat('credibility', 2), { kind: 'dossier', domain: 'economie', delta: 4 }, { kind: 'contact', contactId: 'ct-ust', trust: 4 }, stat('energy', -6)]
    : status === 'mitige' ? [stat('popularity', 1), stat('energy', -6)]
    : [stat('popularity', -2), { kind: 'contact', contactId: 'ct-ust', trust: -4 }, stat('energy', -6)],
};

// ── Questions au gouvernement ───────────────────────────────

export const QAG_SCENE: SceneDef = {
  id: 'qag_scene', title: 'Les questions au gouvernement', eyebrow: 'Hémicycle',
  intro: 'Mardi, 15 heures. L’hémicycle est plein, les caméras de LCP tournent. Le sujet : {domaine}.',
  band: '#2e3f2e', minRank: 'depute', domain: 'agenda',
  gauges: [
    { id: 'autorite', label: 'Autorité', min: 0, max: 100, start: 30, good: 'high' },
    { id: 'chahut', label: 'Chahut', min: 0, max: 100, start: 30, good: 'low',
      danger: { above: 85, label: 'Suspension de séance', text: 'La présidente suspend la séance. Votre intervention passe à la trappe.', delta: { autorite: -10 }, end: true } },
    { id: 'image', label: 'Image', min: -50, max: 50, start: 0, good: 'high', format: 'signed' },
  ],
  stages: [['q_entree'], ['q_interruption', 'q_chiffre'], ['q_reponse', 'q_interruption'], ['q_replique']],
  steps: [
    {
      id: 'q_entree', title: 'Vous prenez la parole',
      context: 'Deux minutes chrono. Les bancs d’en face préparent leurs sarcasmes.',
      choices: [
        ch('solennel', 'Un ton solennel, posé', { autorite: 10, chahut: -4 }, 'L’hémicycle se tait peu à peu.'),
        ch('choc', 'Une interpellation choc', { image: 8, chahut: 12, autorite: 4 }, 'Vos bancs se lèvent pour applaudir.'),
        ch('dossier', 'Entrer directement dans le dossier', { autorite: 12 }, 'Précis, technique.', {
          risk: { chance: 0.6, scaleWith: 'dossier', weight: 1, onFail: { autorite: -6, chahut: 8 }, failText: 'Vous perdez le fil. Les rires fusent.' },
        }),
      ],
    },
    {
      id: 'q_interruption', title: 'On vous interrompt',
      context: 'Un député d’en face hurle : « Et vous, qu’avez-vous fait ? »',
      choices: [
        ch('ignorer', 'Ignorer et poursuivre', { autorite: 6, chahut: 4 }, 'Vous gardez le fil.'),
        ch('repartie', 'Lui répondre du tac au tac', { image: 8, chahut: 10 }, 'La répartie fait mouche.', {
          risk: { chance: 0.4, scaleWith: 'popularity', weight: 0.5, onFail: { image: -8, chahut: 8 }, failText: 'Votre répartie tombe à plat.' },
        }),
        ch('presidente', 'Demander à la présidente de rétablir l’ordre', { chahut: -10, image: -2 }, 'Le calme revient. On vous trouve un peu scolaire.'),
      ],
    },
    {
      id: 'q_chiffre', title: 'Un chiffre contesté',
      context: 'Le ministre conteste votre chiffre depuis son banc.',
      choices: [
        ch('source', 'Citer votre source exacte', { autorite: 12, image: 4 }, 'Le ministre se tait.', {
          risk: { chance: 0.6, scaleWith: 'dossier', weight: 1, onFail: { autorite: -8, image: -6 }, failText: 'Votre source est périmée.' },
        }),
        ch('maintenir', 'Maintenir sans détailler', { autorite: 2, chahut: 6 }, 'Parole contre parole.'),
        ch('rebondir', 'Rebondir sur sa mauvaise foi', { image: 6, chahut: 6 }, 'Vos bancs applaudissent.'),
      ],
    },
    {
      id: 'q_reponse', title: 'La réponse du ministre',
      context: 'Il vous répond par une attaque personnelle.',
      choices: [
        ch('digne', 'Rester digne, secouer la tête', { autorite: 6, image: 4 }, 'Les caméras captent votre calme.'),
        ch('indigner', 'S’indigner bruyamment', { image: 4, chahut: 10 }, 'La séquence fera le tour des réseaux.'),
        ch('noter', 'Noter et préparer une réplique écrite', { autorite: 4, chahut: -4 }, 'Le communiqué partira ce soir.'),
      ],
    },
    {
      id: 'q_replique', title: 'Le droit de réplique',
      context: 'Il vous reste vingt secondes.',
      choices: [
        ch('phrase', 'Une petite phrase pour les journaux', { image: 10, autorite: 2 }, 'Elle sera dans tous les JT.', {
          risk: { chance: 0.35, scaleWith: 'popularity', weight: 0.4, onFail: { image: -6 }, failText: 'La formule est jugée outrancière.' },
        }),
        ch('resume', 'Résumer froidement votre argument', { autorite: 10 }, 'Implacable.'),
        ch('rendre', 'Rendre la parole', { chahut: -6 }, 'Sobre.'),
      ],
    },
  ],
  score: g => g['autorite'] + g['image'] * 0.6 - g['chahut'] * 0.3,
  thresholds: { succes: 35, mitige: 22 },
  outcomes: {
    succes: 'Votre intervention tourne en boucle sur les chaînes parlementaires.',
    mitige: 'Une question parmi d’autres.',
    echec: 'L’hémicycle n’a retenu que le chahut.',
  },
  rewards: status => status === 'succes'
    ? [stat('credibility', 3), stat('influence', 3), stat('popularity', 1), { kind: 'dossier', domain: '$domain', delta: 3 }]
    : status === 'mitige' ? [stat('credibility', 1)]
    : [stat('credibility', -2), stat('stress', 4)],
};

// ── Live sur les réseaux ────────────────────────────────────

export const LIVE_RESEAUX: SceneDef = {
  id: 'live_reseaux', title: 'Le live sur les réseaux', eyebrow: 'Médias',
  intro: 'Téléphone sur trépied, ring light, 400 personnes connectées. Le chat défile déjà.',
  band: '#2e3546', minRank: 'militant', domain: 'agenda',
  gauges: [
    { id: 'spectateurs', label: 'Spectateurs', min: 0, max: 100, start: 10, good: 'high' },
    { id: 'image', label: 'Image', min: -50, max: 50, start: 0, good: 'high', format: 'signed' },
    { id: 'trolls', label: 'Trolls', min: 0, max: 100, start: 20, good: 'low',
      danger: { above: 75, label: 'Raid de trolls', text: 'Le chat est submergé d’insultes. Vous coupez le live.', delta: { image: -10 }, end: true } },
  ],
  stages: [['l_intro'], ['l_question', 'l_troll'], ['l_question', 'l_buzz', 'l_troll'], ['l_fin']],
  steps: [
    {
      id: 'l_intro', title: 'Le lancement',
      context: 'Il faut accrocher dans les dix premières secondes.',
      choices: [
        ch('coulisses', 'Montrer les coulisses de votre journée', { spectateurs: 10, image: 4 }, 'Les gens adorent les coulisses.'),
        ch('annonce', 'Teaser une annonce', { spectateurs: 14, trolls: 6 }, 'Le compteur s’envole.'),
        ch('sujet', 'Entrer dans le vif du sujet', { image: 6, spectateurs: 4 }, 'Sérieux, un peu austère.'),
      ],
    },
    {
      id: 'l_question', title: 'Une question du chat',
      context: '« Et concrètement, vous feriez quoi sur {domaine} ? »',
      choices: [
        ch('concret', 'Répondre concrètement', { image: 8, spectateurs: 6 }, 'Les cœurs pleuvent.', {
          risk: { chance: 0.6, scaleWith: 'dossier', weight: 1, onFail: { image: -6, trolls: 8 }, failText: 'Un internaute vous corrige, captures à l’appui.' },
        }),
        ch('humour', 'Répondre avec humour', { spectateurs: 10, image: 2 }, 'Le moment est clippé.'),
        ch('ignorer', 'Passer à une autre question', { trolls: 6, spectateurs: -2 }, '« Il·elle esquive ! »'),
      ],
    },
    {
      id: 'l_troll', title: 'Un troll s’acharne',
      context: 'Un compte anonyme vous insulte à chaque message.',
      choices: [
        ch('bannir', 'Le bannir sans commentaire', { trolls: -10 }, 'Le chat respire.'),
        ch('repondre', 'Lui répondre en direct', { spectateurs: 12, trolls: 12 }, 'Le duel attire du monde… et ses amis.', {
          risk: { chance: 0.4, scaleWith: 'popularity', weight: 0.5, onFail: { image: -8 }, failText: 'Vous perdez votre calme en direct.' },
        }),
        ch('ironie', 'Lire son message avec ironie', { spectateurs: 8, image: 2, trolls: 4 }, 'Rires dans le chat.'),
      ],
    },
    {
      id: 'l_buzz', title: 'Un influenceur rejoint le live',
      context: 'Un vidéaste à deux millions d’abonnés se connecte et pose une question.',
      choices: [
        ch('inviter', 'L’inviter en duo', { spectateurs: 18, image: 4, trolls: 6 }, 'Le live devient viral.', {
          risk: { chance: 0.35, onFail: { image: -10 }, failText: 'Il vous tend un piège devant sa communauté.' },
        }),
        ch('saluer', 'Le saluer et répondre', { spectateurs: 8, image: 4 }, 'Ses abonnés débarquent.'),
        ch('ignorer', 'Ne pas changer de programme', { image: 2 }, 'Constant.'),
      ],
    },
    {
      id: 'l_fin', title: 'La fin du live',
      context: '« Merci à tous… »',
      choices: [
        ch('rdv', 'Donner rendez-vous la semaine prochaine', { spectateurs: 6, image: 4 }, 'Une habitude se crée.'),
        ch('appel', 'Appeler à adhérer et à donner', { spectateurs: 2, image: -2 }, 'Quelques adhésions, quelques moqueries.'),
        ch('emotion', 'Un mot sincère, personnel', { image: 8 }, 'Votre conclusion est partagée des milliers de fois.', {
          risk: { chance: 0.3, scaleWith: 'credibility', weight: 0.5, onFail: { image: -4 }, failText: 'Jugé un peu surjoué.' },
        }),
      ],
    },
  ],
  score: g => g['spectateurs'] * 0.8 + g['image'] * 0.6 - g['trolls'] * 0.3,
  thresholds: { succes: 30, mitige: 15 },
  outcomes: {
    succes: 'Le replay cartonne. Des milliers de nouveaux abonnés.',
    mitige: 'Un live honnête, une audience modeste.',
    echec: 'Le live est surtout resté comme un défouloir pour vos détracteurs.',
  },
  rewards: status => status === 'succes'
    ? [stat('popularity', 4), { kind: 'momentum', delta: 4 }, stat('influence', 1)]
    : status === 'mitige' ? [stat('popularity', 1)]
    : [stat('popularity', -2), stat('stress', 4), { kind: 'exposure', delta: 2 }],
};

// ── Promotion d'un livre (fin du projet « livre ») ──────────

export const PROMO_LIVRE: SceneDef = {
  id: 'promo_livre', title: 'La promotion de votre livre', eyebrow: 'Librairies et plateaux',
  intro: 'Votre livre sort mardi. Une semaine de plateaux, de dédicaces et de critiques.',
  band: '#46402e', minRank: 'militant', domain: 'agenda',
  gauges: [
    { id: 'ventes', label: 'Ventes', min: 0, max: 100, start: 10, good: 'high' },
    { id: 'critique', label: 'Critique', min: -50, max: 50, start: 0, good: 'high', format: 'signed' },
    { id: 'polemique', label: 'Polémique', min: 0, max: 100, start: 10, good: 'low',
      danger: { above: 75, label: 'Le livre déclenche une tempête', text: 'Un chapitre est sorti de son contexte : tollé général.', delta: { critique: -12 }, end: true } },
  ],
  stages: [['b_matinale'], ['b_dedicace', 'b_critique'], ['b_extrait', 'b_dedicace'], ['b_bilan']],
  steps: [
    {
      id: 'b_matinale', title: 'La matinale radio',
      context: '7 h 50, l’invité politique. Le journaliste a lu le livre… en diagonale.',
      choices: [
        ch('fond', 'Défendre le fond du livre', { critique: 8, ventes: 6 }, 'Un entretien sérieux.', {
          risk: { chance: 0.5, scaleWith: 'dossier', weight: 1, onFail: { critique: -6 }, failText: 'On vous prend en défaut sur un chapitre.' },
        }),
        ch('anecdote', 'Raconter l’anecdote la plus croustillante', { ventes: 12, polemique: 10 }, 'Elle fait le tour des réseaux.'),
        ch('modeste', 'Rester modeste', { critique: 4, ventes: 2 }, 'Sympathique, peu vendeur.'),
      ],
    },
    {
      id: 'b_dedicace', title: 'Séance de dédicaces',
      context: 'Une file d’attente devant la librairie… ou trois personnes ?',
      choices: [
        ch('tous', 'Dédicacer longuement chaque exemplaire', { ventes: 8, critique: 2 }, 'Les lecteurs repartent ravis.'),
        ch('reseaux', 'Filmer la file pour les réseaux', { ventes: 10, polemique: 4 }, 'L’effet d’entraînement fonctionne.'),
        ch('libraire', 'Discuter avec le libraire', { critique: 6 }, 'Il vous met en vitrine.'),
      ],
    },
    {
      id: 'b_critique', title: 'Une critique assassine',
      context: 'Un grand hebdomadaire titre : « Vide et prétentieux ».',
      choices: [
        ch('repondre', 'Répondre par une tribune', { critique: 4, polemique: 8, ventes: 6 }, 'Le duel fait vendre.'),
        ch('ignorer', 'Ignorer', { critique: -2 }, 'La critique reste la seule critique.'),
        ch('rire', 'En faire un argument de vente', { ventes: 10, critique: -2 }, '« Le livre que les élites détestent. »'),
      ],
    },
    {
      id: 'b_extrait', title: 'Un extrait qui fait réagir',
      context: 'Un passage sur un ancien allié est repris partout.',
      choices: [
        ch('assumer', 'Assumer chaque mot', { ventes: 12, polemique: 14 }, 'Les ventes explosent, l’ancien allié aussi.'),
        ch('nuancer', 'Nuancer, s’excuser auprès de l’intéressé', { critique: 6, polemique: -8 }, 'L’affaire se calme.'),
        ch('contexte', 'Rappeler le contexte complet', { critique: 4, polemique: -4 }, 'Une mise au point utile.', {
          risk: { chance: 0.4, scaleWith: 'credibility', weight: 0.5, onFail: { polemique: 8 }, failText: 'Personne ne lit la mise au point.' },
        }),
      ],
    },
    {
      id: 'b_bilan', title: 'Le dimanche soir',
      context: 'Votre éditeur appelle : « On attaque la deuxième semaine ? »',
      choices: [
        ch('poche', 'Accepter une tournée en région', { ventes: 10, critique: 2 }, 'Six villes, six librairies.'),
        ch('stop', 'Clore la promotion', { critique: 4 }, 'Retour à la politique.'),
        ch('adaptation', 'Évoquer une adaptation en série', { ventes: 6, polemique: 6 }, 'Les médias s’emballent.'),
      ],
    },
  ],
  score: g => g['ventes'] + g['critique'] * 0.6 - g['polemique'] * 0.3,
  thresholds: { succes: 32, mitige: 18 },
  outcomes: {
    succes: 'Le livre entre dans les meilleures ventes. Votre nom circule.',
    mitige: 'Un succès d’estime.',
    echec: 'Le livre finit au pilon.',
  },
  rewards: status => status === 'succes'
    ? [stat('popularity', 4), stat('credibility', 3), { kind: 'income', base: 12000 }]
    : status === 'mitige' ? [stat('popularity', 1), { kind: 'income', base: 3000 }]
    : [stat('credibility', -2), stat('stress', 4)],
};

export const ACTION_SCENES: SceneDef[] = [PORTE_A_PORTE, CONFERENCE_PRESSE, VISITE_USINE, QAG_SCENE, LIVE_RESEAUX, PROMO_LIVRE];

import { Effect, GameState } from '../models/game.models';
import type { CallOption, PhoneEntry } from './phone';
import { grantNumber } from './phone';
import { ENEMIES } from './war';
import { DEVIL } from './apocalypse';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Chaque scénario débloque ses numéros : le Vénérable de votre
 *  loge, l'émissaire extraterrestre, le Prince, la rédaction,
 *  l'officier traitant, la virologue, la cheffe d'état-major, le
 *  commissaire de la DGSI, le Grand Prêtre de l'Aube Noire… et
 *  Monsieur Nicolas en personne.
 * ============================================================ */

type Result = { answer: string; effects: Effect[]; notes?: string[] };
interface ScenOption {
  id: `sc_${string}`;
  label: string;
  hint: string;
  ask: string;
  /** Mois avant de pouvoir redemander */
  cooldown?: number;
  run: (d: GameState, rng: Rng) => Result;
}
interface ScenContact {
  key: string;
  icon: string;
  when: (d: GameState) => boolean;
  name: (d: GameState) => string;
  role: (d: GameState) => string;
  options: (d: GameState) => ScenOption[];
}

const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });

/** Une information compromettante sur une personnalité au hasard */
function kompromat(d: GameState, rng: Rng): string | null {
  const n = rng.pick(d.npcs);
  if (!n) return null;
  d.player.flags[`kompromat_${n.id}`] = Number(d.player.flags[`kompromat_${n.id}`] ?? 0) + 1;
  return n.name;
}

const CONTACTS: ScenContact[] = [
  // ── La loge ──
  {
    key: 'sc:loge', icon: '🔺', when: d => !!d.lodge,
    name: d => `Le Vénérable · ${d.lodge!.loge}`, role: d => `Votre loge · ${d.lodge!.obedience}`,
    options: () => [
      { id: 'sc_loge_service', label: 'Demander un service fraternel', hint: 'Un frère bien placé, une porte qui s’ouvre.', ask: 'Mon frère, j’aurais besoin d’un coup de main…', cooldown: 3,
        run: (d, rng) => rng.chance(clamp(0.35 + d.lodge!.fraternite / 120, 0.15, 0.9))
          ? { answer: 'Un frère siège au conseil d’administration qui vous intéresse. Il vous recevra mardi.', effects: [st('influence', 3), st('politicalCapital', 5), { kind: 'lodge', discretion: -3 }] }
          : { answer: 'La fraternité n’est pas un guichet, mon frère. Revenez quand vous aurez donné.', effects: [{ kind: 'lodge', fraternite: -2 }] } },
      { id: 'sc_loge_numero', label: 'Obtenir le numéro d’un frère haut placé', hint: 'Ministres, préfets, patrons : la chaîne d’union est longue.', ask: 'Vous connaîtriez quelqu’un, en haut ?', cooldown: 6,
        run: (d, rng) => { const got = grantNumber(d, rng); return { answer: got ? 'Je vous transmets ses coordonnées. Il saura qui vous êtes.' : 'Vous connaissez déjà tout le monde, il me semble.', effects: [], notes: got ? [got] : [] }; } },
      { id: 'sc_loge_planche', label: 'Proposer une planche sur un sujet de société', hint: 'Fin de vie, laïcité, école : un débat entre frères.', ask: 'Je voudrais présenter une planche à la prochaine tenue.', cooldown: 2,
        run: d => ({ answer: 'Excellent sujet. La tenue du mois prochain vous est réservée.', effects: [{ kind: 'lodge', planches: 1, fraternite: 3 }, st('credibility', 1), { kind: 'dossier', domain: d.agendaDomain, delta: 2 }] }) },
    ],
  },
  {
    key: 'sc:grandmaitre', icon: '⚜️', when: d => !!d.lodge && d.lodge.grade >= 3,
    name: () => 'Le Grand Maître', role: d => `Grand Maître · ${d.lodge!.obedience}`,
    options: () => [
      { id: 'sc_gm_reseau', label: 'Mobiliser les frères parlementaires sur un texte', hint: 'Des voix de tous les bancs, sans que personne ne sache pourquoi.', ask: 'Nos frères de l’Assemblée pourraient-ils m’aider ?', cooldown: 6,
        run: () => ({ answer: 'Ils voteront selon leur conscience… éclairée.', effects: [{ kind: 'flagAdd', key: 'billSupport', delta: 8 }, { kind: 'lodge', discretion: -4 }], notes: ['8 voix promises pour votre prochain texte'] }) },
    ],
  },
  // ── Premier contact ──
  {
    key: 'sc:alien', icon: '👽', when: d => !!d.alien && d.alien.phase >= 1,
    name: d => `L’émissaire ${d.alien!.species}`, role: () => 'Fréquence 1 420 MHz',
    options: () => [
      { id: 'sc_alien_paix', label: 'Envoyer un message de paix', hint: 'Les nombres premiers, puis une phrase simple.', ask: '2, 3, 5, 7, 11… Nous venons en paix.', cooldown: 2,
        run: () => ({ answer: '··· ·–· ·· ··· (Le signal répond par une suite de nombres premiers… plus longue.)', effects: [{ kind: 'alien', confiance: 5, panique: -2 }] }) },
      { id: 'sc_alien_langue', label: 'Échanger quelques mots', hint: 'Un cours de langue à des années-lumière.', ask: 'Bonjour. Je. Suis. Humain.', cooldown: 1,
        run: () => ({ answer: '« BON-JOUR. TU. ES. PETIT. » (C’est un progrès.)', effects: [{ kind: 'alien', comprehension: 6 }, st('energy', -4)] }) },
      { id: 'sc_alien_techno', label: 'Demander un savoir technologique', hint: 'Une énergie propre ? Un remède ? Ils peuvent refuser.', ask: 'Pourriez-vous partager un peu de votre savoir ?', cooldown: 6,
        run: (d, rng) => rng.chance(clamp((d.alien!.confiance ?? 30) / 100, 0.1, 0.85))
          ? { answer: 'Un schéma s’affiche : une batterie qui ne se décharge jamais. Les ingénieurs pleurent de joie.', effects: [{ kind: 'economy', growth: 0.2, confidence: 4 }, { kind: 'dossier', domain: 'numerique', delta: 5 }, st('influence', 2)] }
          : { answer: '« PAS. ENCORE. » Le signal se tait trois jours.', effects: [{ kind: 'alien', confiance: -6 }] } },
      { id: 'sc_alien_secret', label: 'Leur demander qui ment au gouvernement', hint: 'Ils écoutent toutes nos communications.', ask: 'Vous qui entendez tout… qui ment ?', cooldown: 6,
        run: (d, rng) => { const n = kompromat(d, rng); return { answer: n ? `Le signal épelle un nom : ${n}. Puis des chiffres de compte bancaire.` : 'Silence.', effects: [{ kind: 'alien', confiance: -2 }], notes: n ? [`Information compromettante sur ${n}`] : [] }; } },
    ],
  },
  // ── La Couronne ──
  {
    key: 'sc:prince', icon: '👑', when: d => !!d.crown,
    name: d => d.crown!.pretendant, role: () => 'Prétendant au trône de France',
    options: () => [
      { id: 'sc_prince_salon', label: 'Être reçu·e au salon du Prince', hint: 'Lustres, vieilles familles et un thé à la bergamote.', ask: 'Monseigneur, me ferez-vous l’honneur d’une audience ?', cooldown: 2,
        run: () => ({ answer: 'Monseigneur vous attend jeudi, à dix-sept heures. Tenue correcte exigée.', effects: [{ kind: 'crown', legitimite: 3 }, st('influence', 1), { kind: 'segment', segment: 'retraites', delta: 1 }] }) },
      { id: 'sc_prince_generaux', label: 'Organiser un déjeuner avec des généraux', hint: 'Des épaulettes acquises à la cause.', ask: 'Quelques officiers aimeraient vous rencontrer, Monseigneur.', cooldown: 3,
        run: () => ({ answer: 'Un déjeuner au cercle militaire. On y parle beaucoup de « l’ordre ».', effects: [{ kind: 'crown', armee: 4 }, { kind: 'exposure', delta: 2 }] }) },
      { id: 'sc_prince_soutien', label: 'Solliciter un soutien financier discret', hint: 'Les vieilles fortunes aiment les causes perdues.', ask: 'La cause aurait besoin de moyens…', cooldown: 6,
        run: () => ({ answer: 'Un notaire vous contactera. Discrètement.', effects: [{ kind: 'funds', account: 'campaign', delta: 5000 }, { kind: 'exposure', delta: 3 }, { kind: 'crown', soutien: 1 }] }) },
    ],
  },
  // ── La rédaction ──
  {
    key: 'sc:redac', icon: '🗞️', when: d => !!d.press,
    name: d => `Rédaction de ${d.press!.outlet}`, role: () => 'Votre rédacteur·rice en chef',
    options: () => [
      { id: 'sc_redac_une', label: 'Négocier la une de demain', hint: 'Votre papier en tête de gondole.', ask: 'Mon papier mérite la une, non ?', cooldown: 2,
        run: (d, rng) => rng.chance(0.55) ? { answer: 'D’accord. Mais titre choc, et pas plus de 6 000 signes.', effects: [{ kind: 'press', audience: 3 }, st('popularity', 1)] } : { answer: 'La une est prise. Page 4, et c’est déjà bien.', effects: [] } },
      { id: 'sc_redac_scoop', label: 'Récupérer un tuyau de la rédaction', hint: 'Les journalistes savent tout sur tout le monde.', ask: 'Tu n’aurais pas un tuyau qui traîne ?', cooldown: 4,
        run: (d, rng) => { const n = kompromat(d, rng); return { answer: n ? `On n’a pas assez pour publier, mais ${n} a des choses à cacher.` : 'Rien de sérieux en ce moment.', effects: [{ kind: 'press', scoops: 1 }], notes: n ? [`Information compromettante sur ${n}`] : [] }; } },
    ],
  },
  // ── L'infiltration ──
  {
    key: 'sc:handler', icon: '🕶️', when: d => !!d.mole,
    name: d => d.mole!.handler, role: d => `Officier traitant · ${d.mole!.homeName}`,
    options: () => [
      { id: 'sc_mole_rapport', label: 'Faire un rapport oral', hint: 'Il préfère les informations fraîches.', ask: 'J’ai du nouveau.', cooldown: 1,
        run: () => ({ answer: 'Bien. Continuez. Et effacez cet appel.', effects: [{ kind: 'mole', intel: 4, handler: 4 }] }) },
      { id: 'sc_mole_couverture', label: 'Demander de l’aide pour votre couverture', hint: 'Une fausse piste, un témoin bien choisi.', ask: 'On commence à me soupçonner.', cooldown: 3,
        run: () => ({ answer: 'Un article sur un autre suspect paraîtra jeudi. Respirez.', effects: [{ kind: 'mole', cover: 8, handler: -3 }] }) },
    ],
  },
  // ── Épidémie Z ──
  {
    key: 'sc:viro', icon: '🧪', when: d => !!d.zombie,
    name: () => 'Pr Hélène Varga', role: () => 'Virologue · Institut national des virus émergents',
    options: () => [
      { id: 'sc_z_vaccin', label: 'Faire le point sur le vaccin', hint: 'Elle dort quatre heures par nuit, au labo.', ask: 'Où en est le vaccin ?', cooldown: 1,
        run: () => ({ answer: 'Un candidat prometteur sur les primates. Il me faut des crédits, pas des appels.', effects: [{ kind: 'zombie', cure: 4 }, st('stress', -1)] }) },
      { id: 'sc_z_bastion', label: 'Demander une place dans un bastion sécurisé', hint: 'Pour vous et vos proches.', ask: 'Si ça tourne mal… il y a une place pour ma famille ?', cooldown: 99,
        run: () => ({ answer: 'Le bastion de Brest. Badge 0417. Ne le dites à personne.', effects: [{ kind: 'zombie', shelter: true }, { kind: 'exposure', delta: 2 }] }) },
    ],
  },
  // ── Le sosie ──
  {
    key: 'sc:sosie', icon: '🎭', when: d => !!d.crises?.sosie,
    name: () => 'Votre sosie', role: () => 'Numéro masqué · il vous a laissé un message',
    options: () => [
      { id: 'sc_sosie_marche', label: 'Lui proposer un marché', hint: 'Qu’il fasse vos inaugurations ennuyeuses… et rien d’autre. Risqué.', ask: 'Et si on trouvait un arrangement, vous et moi ?', cooldown: 3,
        run: (d, rng) => rng.chance(0.5)
          ? { answer: '« Les ronds-points, ça me va. Mais je garde votre écharpe. »', effects: [st('energy', 10), st('stress', -3), { kind: 'crisis', arc: 'sosie', risk: 3 }] }
          : { answer: '« Un marché ? Avec vous ? Je préfère être l’original. » Il raccroche en riant… avec votre rire.', effects: [{ kind: 'crisis', arc: 'sosie', risk: 4 }, st('stress', 2)] } },
      { id: 'sc_sosie_piege', label: 'Lui tendre un piège', hint: 'Un faux rendez-vous, des policiers en civil.', ask: 'Retrouvons-nous demain à midi, au café de la gare.', cooldown: 4,
        run: (d, rng) => rng.chance(0.45)
          ? { answer: 'Il vient. Les policiers aussi. Ses papiers sont faux, son accent aussi.', effects: [{ kind: 'crisis', arc: 'sosie', gauge: 14 }, st('credibility', 1)] }
          : { answer: 'Personne au rendez-vous. Le soir même, il poste une photo de vous… à ce café.', effects: [{ kind: 'crisis', arc: 'sosie', gauge: 2, risk: 3 }] } },
    ],
  },
  // ── La grève générale ──
  {
    key: 'sc:intersyndicale', icon: '✊', when: d => !!d.crises?.greve_generale,
    name: () => 'Martine Lebrun', role: () => 'Porte-parole de l’intersyndicale',
    options: () => [
      { id: 'sc_greve_canal', label: 'Ouvrir un canal discret', hint: 'Se parler sans caméras : ça avance mieux.', ask: 'On peut se parler franchement, sans micros ?', cooldown: 2,
        run: () => ({ answer: 'Franchement ? Il faut du concret sur les salaires. Le reste, on peut en discuter.', effects: [{ kind: 'crisis', arc: 'greve_generale', gauge: 6 }, st('influence', 1)] }) },
      { id: 'sc_greve_concession', label: 'Mettre une concession sur la table', hint: 'Un coup de pouce sur les salaires : la grève reflue, la dette grimpe.', ask: 'Si je vous obtiens un geste sur les salaires, vous suspendez ?', cooldown: 4,
        run: () => ({ answer: 'Je soumets ça aux assemblées générales ce soir. Je ne promets rien… mais c’est sérieux.', effects: [{ kind: 'crisis', arc: 'greve_generale', gauge: 10, risk: -4 }, { kind: 'economy', deficit: 0.1 }, { kind: 'segment', segment: 'populaires', delta: 1 }] }) },
    ],
  },
  // ── Le trésor des Templiers ──
  {
    key: 'sc:templiers', icon: '🗝️', when: d => !!d.crises?.templiers,
    name: () => 'Pr Agnès Montclar', role: () => 'Médiéviste · cheffe des fouilles de la crypte',
    options: () => [
      { id: 'sc_templiers_point', label: 'Faire le point sur les fouilles', hint: 'Elle dort sur place, dans une caravane.', ask: 'Alors, ce dernier coffre ?', cooldown: 1,
        run: () => ({ answer: 'Un reliquaire du XIIIe siècle, intact. Je vous envoie la photo. Ne la publiez pas encore !', effects: [{ kind: 'crisis', arc: 'templiers', gauge: 5 }, st('stress', -1)] }) },
      { id: 'sc_templiers_exclu', label: 'Lui demander une exclusivité pour la presse', hint: 'Une photo du trésor avec vous : risqué pour le chantier.', ask: 'Et si on montrait une pièce aux caméras, ensemble ?', cooldown: 4,
        run: () => ({ answer: 'Une seule pièce, deux minutes, et pas de flash.', effects: [st('popularity', 3), { kind: 'crisis', arc: 'templiers', risk: 4 }] }) },
    ],
  },
  // ── L'Eurovision ──
  {
    key: 'sc:eurovision', icon: '🎤', when: d => !!d.crises?.eurovision,
    name: () => 'Jean-Marc Delval', role: () => 'Producteur exécutif de la finale',
    options: () => [
      { id: 'sc_euro_point', label: 'Faire le point sur le show', hint: 'Il répond depuis un plateau en ébullition.', ask: 'On en est où, Jean-Marc ?', cooldown: 1,
        run: () => ({ answer: 'Les écrans LED arrivent mardi. Le dragon gonflable, je n’en parle même pas.', effects: [{ kind: 'crisis', arc: 'eurovision', gauge: 5 }] }) },
      { id: 'sc_euro_chanter', label: 'Proposer de chanter en ouverture', hint: 'Un couplet en direct devant 160 millions de personnes. Audacieux.', ask: 'Et si j’ouvrais la soirée… en chantant ?', cooldown: 99,
        run: (d, rng) => rng.chance(0.5)
          ? { answer: 'C’est fou. On le fait. (Votre couplet devient un mème européen… plutôt affectueux.)', effects: [st('popularity', 4), { kind: 'segment', segment: 'jeunes', delta: 3 }, { kind: 'crisis', arc: 'eurovision', gauge: 4 }] }
          : { answer: 'On a fait un essai. Avec tout le respect que je vous dois : non.', effects: [st('stress', 2)] } },
    ],
  },
  // ── La comète ──
  {
    key: 'sc:comete', icon: '☄️', when: d => !!d.crises?.comete,
    name: () => 'Dr Léa Moreau-Saïd', role: () => 'Directrice de la mission de déviation · Agence spatiale européenne',
    options: () => [
      { id: 'sc_comete_point', label: 'Faire le point sur la trajectoire', hint: 'Les derniers calculs de l’Observatoire.', ask: 'Où en est la comète ?', cooldown: 1,
        run: () => ({ answer: 'Les calculs se précisent : une chance sur quarante maintenant. Le vaisseau est prêt à 80 %.', effects: [{ kind: 'crisis', arc: 'comete', gauge: 4 }, st('stress', -1)] }) },
      { id: 'sc_comete_live', label: 'Organiser un direct depuis Kourou', hint: 'Montrer la fusée aux Français : rassurant… si tout se passe bien.', ask: 'Et si on montrait la fusée en direct ?', cooldown: 4,
        run: (d, rng) => rng.chance(0.7)
          ? { answer: 'Le direct est superbe. Les Français voient enfin qu’on agit.', effects: [{ kind: 'crisis', arc: 'comete', risk: -6 }, st('popularity', 2)] }
          : { answer: 'Une alarme retentit pendant le direct. Fausse alerte, mais l’image tourne en boucle.', effects: [{ kind: 'crisis', arc: 'comete', risk: 5 }] } },
    ],
  },
  // ── Le référendum ──
  {
    key: 'sc:referendum', icon: '🗳️', when: d => !!d.crises?.referendum,
    name: () => 'Samia Berthier', role: () => 'Initiatrice de la pétition · collectif citoyen',
    options: () => [
      { id: 'sc_ref_terrain', label: 'Coordonner les bénévoles', hint: 'Son réseau de quarante mille bénévoles.', ask: 'On coordonne nos équipes de terrain ?', cooldown: 2,
        run: () => ({ answer: 'Nos bénévoles tractent dans 600 villes ce week-end. Envoyez-nous vos militants.', effects: [{ kind: 'crisis', arc: 'referendum', gauge: 6 }, { kind: 'segment', segment: 'populaires', delta: 1 }] }) },
      { id: 'sc_ref_sondage', label: 'Partager un sondage interne', hint: 'Les chiffres bruts de son collectif.', ask: 'Vous avez des chiffres frais ?', cooldown: 3,
        run: () => ({ answer: 'Au coude à coude. Ce sont les retraités qui feront la différence.', effects: [{ kind: 'crisis', arc: 'referendum', gauge: 3, risk: -2 }, st('influence', 1)] }) },
    ],
  },
  // ── Le séisme ──
  {
    key: 'sc:seisme', icon: '🏚️', when: d => !!d.crises?.seisme,
    name: () => 'Colonel Yannick Ferrand', role: () => 'Commandant des secours · zone sinistrée',
    options: () => [
      { id: 'sc_seisme_point', label: 'Faire le point avec les secours', hint: 'Il dort deux heures par nuit, dans un camion.', ask: 'Colonel, où en êtes-vous ?', cooldown: 1,
        run: () => ({ answer: 'Deux villages de plus raccordés à l’eau. Il me faudrait des modules d’hébergement.', effects: [{ kind: 'crisis', arc: 'seisme', gauge: 4 }, st('stress', -1)] }) },
      { id: 'sc_seisme_renforts', label: 'Lui envoyer des renforts militaires', hint: 'Le génie, des hélicoptères, des bras.', ask: 'Je vous envoie le génie militaire. Ça vous aide ?', cooldown: 4,
        run: () => ({ answer: 'Énormément. Les routes seront dégagées en une semaine.', effects: [{ kind: 'crisis', arc: 'seisme', gauge: 8, risk: -4 }, st('politicalCapital', -4)] }) },
    ],
  },
  // ── Le gros lot ──
  {
    key: 'sc:loto', icon: '🍀', when: d => !!d.crises?.loto,
    name: () => 'Maître Claire Dubreuil', role: () => 'Notaire · gestion de votre gain',
    options: () => [
      { id: 'sc_loto_conseil', label: 'Lui demander conseil', hint: 'Quarante ans de successions et de gros lots.', ask: 'Qu’est-ce que je dois faire de tout cet argent ?', cooldown: 2,
        run: () => ({ answer: 'Ne rien acheter pendant six mois, et donner avant qu’on ne vous demande. Croyez-moi.', effects: [{ kind: 'crisis', arc: 'loto', gauge: 4, risk: -2 }] }) },
      { id: 'sc_loto_don', label: 'Faire un don anonyme', hint: 'Un hôpital, une école, sans votre nom… pour l’instant.', ask: 'Je voudrais faire un don, sans que mon nom apparaisse.', cooldown: 4,
        run: (_d, rng) => rng.chance(0.6)
          ? { answer: 'C’est fait. Le directeur de l’hôpital pleure au téléphone. Il ne saura jamais que c’est vous.', effects: [{ kind: 'crisis', arc: 'loto', gauge: 8 }, st('stress', -3)] }
          : { answer: 'C’est fait… mais un journaliste a remonté la piste. Votre générosité fait la une.', effects: [{ kind: 'crisis', arc: 'loto', gauge: 6 }, st('popularity', 2)] } },
    ],
  },
  // ── La tempête solaire ──
  {
    key: 'sc:tempete', icon: '🌞', when: d => !!d.crises?.tempete_solaire,
    name: () => 'Dr Sami Haddad', role: () => 'Astrophysicien · Observatoire de Meudon',
    options: () => [
      { id: 'sc_tempete_point', label: 'Faire le point sur l’éruption', hint: 'Il suit le Soleil heure par heure.', ask: 'Docteur, le pire est-il passé ?', cooldown: 1,
        run: () => ({ answer: 'La deuxième vague arrive mardi, plus faible. Préparez les hôpitaux.', effects: [{ kind: 'crisis', arc: 'tempete_solaire', gauge: 4, risk: -2 }] }) },
    ],
  },
  // ── L'Exposition universelle ──
  {
    key: 'sc:expo', icon: '🎡', when: d => !!d.crises?.expo_universelle,
    name: () => 'Isabelle Kervella', role: () => 'Commissaire générale de l’Exposition',
    options: () => [
      { id: 'sc_expo_point', label: 'Faire le point sur le chantier', hint: 'Elle connaît chaque grue par son prénom.', ask: 'Où en sont les pavillons ?', cooldown: 1,
        run: () => ({ answer: 'Cent douze pavillons sur cent quatre-vingts. On tiendra, si personne ne change d’avis sur la tour.', effects: [{ kind: 'crisis', arc: 'expo_universelle', gauge: 4 }] }) },
      { id: 'sc_expo_rallonge', label: 'Lui accorder une rallonge budgétaire', hint: 'Plus de moyens, plus de dette.', ask: 'Combien vous manque-t-il ?', cooldown: 4,
        run: () => ({ answer: 'Cent millions. Avec ça, j’ouvre à l’heure.', effects: [{ kind: 'crisis', arc: 'expo_universelle', gauge: 8, risk: -3 }, { kind: 'economy', deficit: 0.05 }] }) },
    ],
  },
  // ── La pénurie de médicaments ──
  {
    key: 'sc:penurie', icon: '💊', when: d => !!d.crises?.penurie_medicaments,
    name: () => 'Dr Fanny Leclerc', role: () => 'Présidente de l’ordre des pharmaciens',
    options: () => [
      { id: 'sc_penurie_point', label: 'Faire le point sur les ruptures', hint: 'Elle tient la liste à jour, officine par officine.', ask: 'Où en sont les ruptures ?', cooldown: 1,
        run: () => ({ answer: 'Moins d’antibiotiques en rupture, mais l’insuline reste tendue dans le Nord.', effects: [{ kind: 'crisis', arc: 'penurie_medicaments', gauge: 4, risk: -2 }] }) },
    ],
  },
  // ── Le train du futur ──
  {
    key: 'sc:train', icon: '🚄', when: d => !!d.crises?.train_futur,
    name: () => 'Hugo Ferraris', role: () => 'Ingénieur en chef du train magnétique',
    options: () => [
      { id: 'sc_train_point', label: 'Faire le point sur le projet', hint: 'Il dort dans le prototype.', ask: 'Alors, ce train ?', cooldown: 1,
        run: () => ({ answer: 'La lévitation est stable à 500. À 600, ça vibre encore un peu. Rien de grave… je crois.', effects: [{ kind: 'crisis', arc: 'train_futur', gauge: 4 }] }) },
      { id: 'sc_train_visite', label: 'Organiser une visite pour la presse', hint: 'Belles images, risque de panne en direct.', ask: 'On montre le prototype aux journalistes ?', cooldown: 4,
        run: (_d, rng) => rng.chance(0.7)
          ? { answer: 'Démonstration parfaite. Les journalistes applaudissent.', effects: [{ kind: 'crisis', arc: 'train_futur', gauge: 5, risk: -3 }, st('popularity', 2)] }
          : { answer: 'Panne de lévitation devant les caméras. Le train s’est posé. Doucement.', effects: [{ kind: 'crisis', arc: 'train_futur', risk: 5 }] } },
    ],
  },
  // ── Les pandas ──
  {
    key: 'sc:pandas', icon: '🐼', when: d => !!d.crises?.pandas,
    name: () => 'Dr Mei Lin Dubois', role: () => 'Soigneuse en chef des pandas',
    options: () => [
      { id: 'sc_pandas_nouvelles', label: 'Prendre des nouvelles des pandas', hint: 'Elle dort à côté de l’enclos.', ask: 'Comment vont nos pandas ?', cooldown: 1,
        run: () => ({ answer: 'Ils ont mangé 30 kilos de bambou et fait une sieste de six heures. Tout va bien.', effects: [{ kind: 'crisis', arc: 'pandas', gauge: 4, risk: -1 }] }) },
      { id: 'sc_pandas_live', label: 'Proposer un direct depuis l’enclos', hint: 'Mignon, mais imprévisible.', ask: 'Et si on faisait un direct avec les pandas ?', cooldown: 3,
        run: (_d, rng) => rng.chance(0.7)
          ? { answer: 'Le petit a fait une roulade devant la caméra. Dix millions de vues !', effects: [{ kind: 'crisis', arc: 'pandas', gauge: 5 }, st('popularity', 2)] }
          : { answer: 'Ils ont dormi pendant tout le direct. Quarante minutes de dos poilu.', effects: [{ kind: 'crisis', arc: 'pandas', risk: 2 }] } },
    ],
  },
  // ── La Coupe du monde ──
  {
    key: 'sc:coupe', icon: '⚽', when: d => !!d.crises?.coupe_monde,
    name: () => 'Didier Lacombe', role: () => 'Président du comité d’organisation du Mondial',
    options: () => [
      { id: 'sc_coupe_point', label: 'Faire le point sur l’organisation', hint: 'Il a trois téléphones et zéro heure de sommeil.', ask: 'Tout est prêt pour le Mondial ?', cooldown: 1,
        run: () => ({ answer: 'Les stades oui. Les navettes… on y travaille. Les frites dans les fan-zones : prêtes.', effects: [{ kind: 'crisis', arc: 'coupe_monde', gauge: 4, risk: -2 }] }) },
    ],
  },
  // ── Le jubilé ──
  {
    key: 'sc:jubile', icon: '🎆', when: d => !!d.crises?.jubile,
    name: () => 'Comte Aymeric de Valfleury', role: () => 'Grand chambellan du Palais',
    options: () => [
      { id: 'sc_jubile_point', label: 'Faire le point sur les préparatifs', hint: 'Il a un plan de table pour chaque bal.', ask: 'Où en est le jubilé, mon cher comte ?', cooldown: 1,
        run: () => ({ answer: 'Les feux d’artifice sont commandés, le carrosse est verni. Seuls les républicains me donnent des migraines.', effects: [{ kind: 'crisis', arc: 'jubile', gauge: 4, risk: -2 }] }) },
    ],
  },
  // ── La guerre ──
  {
    key: 'sc:cema', icon: '🎖️', when: d => !!d.war,
    name: () => 'Générale Anne Corbière', role: () => 'Cheffe d’état-major des armées',
    options: () => [
      { id: 'sc_war_front', label: 'Faire le point sur le front', hint: 'Cartes, pertes, besoins : la vérité sans fard.', ask: 'Générale, où en est-on vraiment ?', cooldown: 1,
        run: () => ({ answer: 'Nous tenons. Mais il me faut des drones, et vite.', effects: [{ kind: 'war', front: 2 }, st('stress', 2)] }) },
      { id: 'sc_war_moral', label: 'Annoncer une visite aux troupes', hint: 'Un treillis, une gamelle, des poignées de main.', ask: 'Je veux voir les soldats en première ligne.', cooldown: 2,
        run: () => ({ answer: 'Ils seront fiers. Je vous préviens : il fait froid, là-bas.', effects: [{ kind: 'war', morale: 4 }, st('popularity', 1), st('energy', -4)] }) },
      { id: 'sc_war_paix', label: 'Sonder une sortie de crise', hint: 'Des canaux discrets existent, même en guerre.', ask: 'Ont-ils envie d’en finir, en face ?', cooldown: 3,
        run: () => ({ answer: 'Leur état-major est épuisé lui aussi. Il y a peut-être une porte.', effects: [{ kind: 'hostile', enemy: '$war', delta: 8 }, { kind: 'war', support: -2 }] }) },
    ],
  },
  // ── Le complot contre vous ──
  {
    key: 'sc:dgsi', icon: '🛡️', when: d => !!d.plot,
    name: () => 'Commissaire Marc Leroy', role: () => 'DGSI · protection des personnalités',
    options: () => [
      { id: 'sc_plot_enquete', label: 'Demander où en est l’enquête', hint: 'Il ne dit jamais tout, mais il dit l’essentiel.', ask: 'Vous avancez, commissaire ?', cooldown: 1,
        run: () => ({ answer: 'Nous avons un nom, pas encore de preuves. Ne changez rien à vos habitudes.', effects: [{ kind: 'plot', intel: 8 }] }) },
      { id: 'sc_plot_protection', label: 'Renforcer votre protection', hint: 'Itinéraires changés, voiture blindée.', ask: 'Je veux plus de protection.', cooldown: 2,
        run: () => ({ answer: 'Deux officiers de plus, dès ce soir. Évitez les bains de foule.', effects: [{ kind: 'plot', danger: -6 }, st('stress', -2)] }) },
    ],
  },
  // ── La fin du monde ──
  {
    key: 'sc:pretre', icon: '🌑', when: d => !!d.apocalypse && (d.apocalypse.phase === 1 || d.apocalypse.phase === 2),
    name: () => 'Le Grand Prêtre', role: () => 'Ordre de l’Aube Noire',
    options: () => [
      { id: 'sc_apo_menacer', label: 'Le menacer de poursuites', hint: 'Il ne craint pas grand-chose. Peut-être la justice.', ask: 'Arrêtez tout, ou je vous fais arrêter.', cooldown: 2,
        run: (d, rng) => rng.chance(0.5) ? { answer: '« Vous êtes plus courageux·se que les autres. » Trois membres quittent l’Ordre le lendemain.', effects: [{ kind: 'apocalypse', cult: -6 }, st('stress', 2)] } : { answer: 'Un rire, puis la ligne coupe. Le soir, un soleil noir est peint sur votre porte.', effects: [{ kind: 'apocalypse', darkness: 3 }, st('stress', 5)] } },
      { id: 'sc_apo_infiltrer', label: 'Feindre de vouloir rejoindre l’Ordre', hint: 'Pour voir de l’intérieur. Dangereux.', ask: 'J’aimerais en savoir plus sur votre… communauté.', cooldown: 4,
        run: () => ({ answer: 'Venez seul·e, samedi, à minuit. Portez du noir.', effects: [{ kind: 'apocalypse', cult: -10 }, { kind: 'exposure', delta: 5 }, st('stress', 4)] }) },
    ],
  },
  {
    key: 'sc:diable', icon: '😈', when: d => (!!d.apocalypse && d.apocalypse.phase === 3) || Number(d.player.flags['devilDebt'] ?? 0) > 0,
    name: () => DEVIL, role: () => 'Le Diable, en personne',
    options: d => d.apocalypse?.phase === 3 && !d.apocalypse.pact ? [
      { id: 'sc_devil_pacte', label: 'Signer le pacte', hint: 'Il part, tout vous réussit… et il reviendra chaque année.', ask: 'Je vous écoute. Quelles sont vos conditions ?',
        run: () => ({ answer: '« Une petite signature, ici. Ne lisez pas les petites lignes, c’est très ennuyeux. »', effects: [{ kind: 'apocalypse', pact: true }] }) },
      { id: 'sc_devil_partir', label: 'Lui ordonner de partir', hint: 'Il n’aime pas qu’on lui donne des ordres.', ask: 'Quittez ce pays. Maintenant.', cooldown: 1,
        run: (_d, rng) => rng.chance(0.5) ? { answer: '« Quel aplomb ! » Il rit, mais quelque chose a vacillé dans sa voix.', effects: [{ kind: 'apocalypse', resistance: 5 }] } : { answer: '« Non. » Toutes les ampoules de votre bureau éclatent.', effects: [{ kind: 'apocalypse', darkness: 3 }, st('stress', 4)] } },
      { id: 'sc_devil_marchander', label: 'Lui demander ce qu’il veut vraiment', hint: 'Comprendre l’adversaire.', ask: 'Qu’est-ce que vous voulez, au fond ?', cooldown: 2,
        run: () => ({ answer: '« Ce que vous voulez tous : être aimé. Et un peu de chaos, pour le plaisir. »', effects: [st('influence', 1), st('stress', 3), { kind: 'apocalypse', resistance: 2 }] }) },
    ] : [
      { id: 'sc_devil_nouvelles', label: 'Prendre de ses nouvelles', hint: 'Il répond toujours. C’est bien le problème.', ask: 'Vous allez bien ?', cooldown: 3,
        run: () => ({ answer: '« Toujours ravi de vous entendre. Je repasse bientôt, ne vous inquiétez pas. »', effects: [st('stress', 2), st('influence', 2)] }) },
    ],
  },
  // ── Coalition et territoires annexés ──
  {
    key: 'sc:coalition', icon: '🤝', when: d => !!d.coalition,
    name: d => `Chef de file · ${d.coalition!.name}`, role: () => 'Votre partenaire de coalition',
    options: () => [
      { id: 'sc_coal_dejeuner', label: 'Proposer un déjeuner de travail', hint: 'Un peu de considération évite bien des crises.', ask: 'On déjeune cette semaine ?', cooldown: 1,
        run: () => ({ answer: 'Avec plaisir. On a deux ou trois sujets à régler.', effects: [{ kind: 'coalition', mood: 8 }, st('energy', -2)] }) },
    ],
  },
];

/** Gouverneurs des territoires annexés (un contact par territoire) */
function annexContacts(d: GameState): ScenContact[] {
  return ENEMIES.filter(e => d.player.flags[`annexed_${e.id}`]).map(e => ({
    key: `sc:anx_${e.id}`, icon: '🏴', when: () => true,
    name: () => `Gouverneur ${e.of}`, role: () => 'Territoire annexé',
    options: () => [
      { id: `sc_anx_apaiser_${e.id}` as const, label: 'Ordonner une politique d’apaisement', hint: 'Libérer des prisonniers, rouvrir les écoles.', ask: 'Où en est la situation ?', cooldown: 2,
        run: () => ({ answer: 'Les manifestations se calment. Les durs du régime déchu, non.', effects: [st('credibility', 1), { kind: 'intl', prestige: 2 }] }) },
      { id: `sc_anx_invest_${e.id}` as const, label: 'Lancer un plan d’investissement', hint: 'Routes, hôpitaux, emplois : acheter la paix.', ask: 'Il nous faut gagner les cœurs.', cooldown: 4,
        run: () => ({ answer: 'Les chantiers démarrent. On commence à nous saluer dans la rue.', effects: [{ kind: 'economy', deficit: 0.1, growth: 0.05 }, st('popularity', 1)] }) },
    ],
  }));
}

function allContacts(d: GameState): ScenContact[] {
  return [...CONTACTS, ...annexContacts(d)].filter(c => c.when(d));
}

/** L'âge des personnages des scénarios (il avance avec la partie) */
const SCEN_AGES: Record<string, number | string> = {
  'sc:loge': 64, 'sc:grandmaitre': 71, 'sc:alien': '312 ans (terriens)', 'sc:prince': 39, 'sc:redac': 52, 'sc:handler': 47, 'sc:viro': 49,
  'sc:sosie': 'votre âge, à un jour près', 'sc:intersyndicale': 54, 'sc:templiers': 58, 'sc:eurovision': 46, 'sc:cema': 59, 'sc:dgsi': 56,
  'sc:pretre': 67, 'sc:diable': 'sans âge', 'sc:coalition': 55, 'sc:comete': 44, 'sc:referendum': 33, 'sc:seisme': 51, 'sc:loto': 62, 'sc:tempete': 41, 'sc:expo': 53, 'sc:penurie': 57, 'sc:train': 38, 'sc:pandas': 36, 'sc:coupe': 61, 'sc:jubile': 73,
};

export function scenarioAge(d: GameState, key: string): string {
  const base = SCEN_AGES[key.startsWith('sc:anx_') ? 'sc:anx' : key] ?? (key.startsWith('sc:anx_') ? 57 : 50);
  if (typeof base === 'string') return base === 'votre âge, à un jour près' ? `${Math.floor(d.player.age)} ans, comme vous` : base;
  return `${base + Math.floor(d.week / 12)} ans`;
}

export function scenarioEntries(d: GameState): PhoneEntry[] {
  return allContacts(d).map(c => ({ key: c.key, kind: 'scenario', name: c.name(d), role: `${c.role(d)} · ${scenarioAge(d, c.key)}`, icon: c.icon }));
}

export function scenarioOptions(d: GameState, e: PhoneEntry, block?: string): CallOption[] {
  const c = allContacts(d).find(x => x.key === e.key);
  if (!c) return [];
  return c.options(d).map(o => {
    const wait = o.cooldown && d.week - Number(d.player.flags[`cd_${o.id}`] ?? -99) < o.cooldown ? 'Déjà demandé il y a peu' : undefined;
    return { id: o.id, label: o.label, hint: o.hint, ok: !block && !wait, reason: block ?? wait };
  });
}

export function scenarioAsk(d: GameState, e: PhoneEntry, id: string): string | undefined {
  return allContacts(d).find(x => x.key === e.key)?.options(d).find(o => o.id === id)?.ask;
}

export function scenarioCall(d: GameState, e: PhoneEntry, id: string, rng: Rng): Result {
  const o = allContacts(d).find(x => x.key === e.key)?.options(d).find(x => x.id === id);
  if (!o) return { answer: '…', effects: [] };
  d.player.flags[`cd_${o.id}`] = d.week;
  return o.run(d, rng);
}

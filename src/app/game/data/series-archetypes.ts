import { Effect, GameState } from '../models/game.models';

/* ============================================================
 *  Les discussions de fond au téléphone : n'importe quel contact
 *  peut ouvrir avec vous une série de questions à choix multiple
 *  étalée sur plusieurs mois (ou vous pouvez la lui proposer, en
 *  l'appelant). Chaque interlocuteur a ses attentes (`ideal` : la
 *  position qu'il espère, de −2 à +2), ses sujets de prédilection,
 *  ses relances quand vous allez dans son sens ou à rebours, et un
 *  bilan final qui pèse sur votre relation.
 * ============================================================ */

export interface SeriesCtx {
  d: GameState;
  /** Identifiants utiles selon l'interlocuteur */
  npcId?: string;
  contactId?: string;
  recruitId?: string;
  name: string;
}

export interface SeriesArchetype {
  id: string;
  /** Titre de la série ({nom} : l'interlocuteur) */
  title: string;
  /** Le premier message ({nom} : l'interlocuteur, {moi} : le joueur) */
  intro: string;
  introTu?: string;
  /** Ce que l'interlocuteur espère entendre (−2 … +2) */
  ideal: (c: SeriesCtx) => number;
  /** Sujets de prédilection (ids de data/positions) */
  topics: string[];
  questions: number;
  /** La relance quand vous allez dans son sens, et quand vous allez à rebours */
  agree: string;
  disagree: string;
  agreeTu?: string;
  disagreeTu?: string;
  /** Le bilan */
  good: { text: string; textTu?: string; effects: (c: SeriesCtx) => Effect[] };
  mixed: { text: string; textTu?: string; effects: (c: SeriesCtx) => Effect[] };
  bad: { text: string; textTu?: string; effects: (c: SeriesCtx) => Effect[] };
}

const st = (stat: 'popularity' | 'credibility' | 'influence' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
const rel = (c: SeriesCtx, delta: number): Effect[] => (c.npcId ? [{ kind: 'npcRelation', npcId: c.npcId, delta, reason: 'Une discussion de fond' }] : []);
const trust = (c: SeriesCtx, t: number, balance = 0): Effect[] => (c.contactId ? [{ kind: 'contact', contactId: c.contactId, trust: t, ...(balance ? { balance } : {}) }] : []);
const morale = (c: SeriesCtx, m: number): Effect[] => (c.recruitId ? [{ kind: 'team', recruitId: c.recruitId, morale: m }] : []);
const partyLean = (d: GameState) => Math.max(-2, Math.min(2, d.party.position / 30));

const SOCIAL = ['smic', 'age_retraite', 'assurance_chomage', 'semaine_4j', 'superprofits', 'jours_feries', 'succession', 'isf'];
const ECO = ['isf', 'superprofits', 'succession', 'dette', 'voiture_thermique', 'glyphosate', 'nucleaire', 'ia', 'semaine_4j', 'assurance_chomage'];
const SOCIETY = ['fin_de_vie', 'cannabis', 'chasse', 'corrida', 'telephone_ecole', 'viande', 'heure_ete', 'uniforme', 'reseaux_15', 'vitesse_80'];
const SERVICES = ['deserts_medicaux', 'services_ruraux', 'aide_developpement', 'eoliennes', 'viande', 'franchises', 'depassements', 'notes', 'vote_16'];
const INSTITUTIONS = ['proportionnelle', 'vote_obligatoire', 'ric', 'cumul_mandats', 'vote_16', 'defense_europeenne', 'elargissement', 'peines_planchers', 'police_municipale', 'videosurveillance'];

export const ARCHETYPES: Record<string, SeriesArchetype> = {
  syndicat: {
    id: 'syndicat', title: 'Le tour de table avec {nom}', questions: 4, topics: SOCIAL,
    intro: '{nom} ici. Avant le congrès, nos adhérents veulent savoir ce que vous pensez vraiment. Quatre questions, une par mois. Vos réponses iront dans notre journal interne.',
    ideal: () => -1.5,
    agree: 'Ça, nos adhérents vont l’applaudir. Vous le défendrez dans l’hémicycle, pas seulement au téléphone ?',
    agreeTu: 'Ça, nos adhérents vont l’applaudir. Tu le défendras dans l’hémicycle, pas seulement au téléphone ?',
    disagreeTu: 'Là, tu nous perds. Les salariés ne comprendront pas. Tu pourrais revoir ta copie ?',
    introTu: '{nom} ici. Avant le congrès, nos adhérents veulent savoir ce que tu penses vraiment. Quatre questions, une par mois, entre nous… et dans notre journal interne.',
    disagree: 'Là, vous nous perdez. Les salariés ne comprendront pas. Vous pourriez revoir votre copie ?',
    good: { text: 'Notre journal titre : « Un allié des salariés ». La base vous fera bon accueil.', textTu: 'Notre journal titre : « Un allié des salariés ». La base te fera bon accueil.', effects: c => [...trust(c, 10, 1), { kind: 'segment', segment: 'populaires', delta: 3 }, st('influence', 1)] },
    mixed: { text: 'Des désaccords, des convergences. On restera vigilants, mais la porte reste ouverte.', effects: c => [...trust(c, 2), { kind: 'segment', segment: 'populaires', delta: 1 }] },
    bad: { text: 'Notre conseil national vous classe parmi les adversaires des salariés. Ça circulera dans les cortèges.', textTu: 'Notre conseil national te classe parmi les adversaires des salariés. Désolé, ça circulera dans les cortèges.', effects: c => [...trust(c, -12), { kind: 'segment', segment: 'populaires', delta: -4 }] },
  },
  patronat: {
    id: 'patronat', title: 'Le petit-déjeuner de {nom}', questions: 4, topics: ECO,
    intro: '{nom}. Nos adhérents investissent en fonction de la visibilité politique. Je vous propose un échange suivi : quatre questions, une par mois, et je rendrai compte à mon conseil.',
    ideal: () => 1.5,
    agree: 'Voilà un discours que les investisseurs comprennent. Vous seriez prêt·e à le porter dans une tribune ?',
    agreeTu: 'Voilà un discours que les investisseurs comprennent. Tu serais prêt·e à le porter dans une tribune ?',
    disagreeTu: 'Ça m’inquiète. Avec ça, des projets d’usine partiront ailleurs. Tu es sûr·e de toi ?',
    introTu: '{nom}. Entre nous : mon conseil veut savoir où tu vas. Je te propose un échange suivi, quatre questions, une par mois.',
    disagree: 'Ça m’inquiète. Avec ça, des projets d’usine partiront ailleurs. Vous êtes sûr·e de vous ?',
    good: { text: 'Mon conseil vous considère comme un interlocuteur fiable. Nos membres sauront s’en souvenir, y compris pour votre campagne.', textTu: 'Mon conseil te considère comme un interlocuteur fiable. Nos membres sauront s’en souvenir, y compris pour ta campagne.', effects: c => [...trust(c, 10, 1), { kind: 'funds', account: 'campaign', delta: 4000 }, { kind: 'segment', segment: 'cadres', delta: 2 }, { kind: 'exposure', delta: 2 }] },
    mixed: { text: 'Pragmatique sur certains points, inquiétant sur d’autres. On continuera à se parler.', effects: c => [...trust(c, 2)] },
    bad: { text: 'Mon rapport à notre conseil sera sévère. Ne comptez pas sur nous.', effects: c => [...trust(c, -12), { kind: 'segment', segment: 'cadres', delta: -3 }, { kind: 'economy', confidence: -1 }] },
  },
  association: {
    id: 'association', title: 'Questions de terrain avec {nom}', questions: 4, topics: SERVICES,
    intro: '{nom}, de l’association. Nos bénévoles m’ont confié une liste de questions pour vous. On peut en faire une par mois ? Nous publierons vos réponses dans notre bulletin.',
    ideal: () => -0.8,
    agree: 'Merci ! Nos bénévoles vont être soulagés. Vous viendriez le dire à notre assemblée générale ?',
    agreeTu: 'Merci ! Nos bénévoles vont être soulagés. Tu viendrais le dire à notre assemblée générale ?',
    disagreeTu: 'Nos bénévoles vont être déçus. Tu connais la réalité du terrain ? On pourrait te la montrer.',
    introTu: 'C’est {nom}, de l’association. Nos bénévoles m’ont confié des questions pour toi. On en fait une par mois ?',
    disagree: 'Nos bénévoles vont être déçus. Vous connaissez la réalité du terrain ? On pourrait vous la montrer.',
    good: { text: 'Notre bulletin vous salue comme « un élu qui écoute ». Vous serez toujours le bienvenu chez nous.', textTu: 'Notre bulletin te salue comme « un élu qui écoute ». Tu seras toujours le bienvenu chez nous.', effects: c => [...trust(c, 10), st('popularity', 2), { kind: 'segment', segment: 'retraites', delta: 1 }] },
    mixed: { text: 'Nous avons publié vos réponses telles quelles. Nos membres se feront leur avis.', textTu: 'On a publié tes réponses telles quelles. Nos membres se feront leur avis.', effects: c => [...trust(c, 3)] },
    bad: { text: 'Notre bulletin regrette vos positions. Nos bénévoles sont nombreux, et ils votent.', textTu: 'Notre bulletin regrette tes positions. Nos bénévoles sont nombreux, et ils votent.', effects: c => [...trust(c, -10), st('popularity', -2)] },
  },
  culte: {
    id: 'culte', title: 'Un dialogue avec {nom}', questions: 3, topics: ['fin_de_vie', 'cannabis', 'jours_feries', 'aide_developpement', 'reseaux_15', 'telephone_ecole'],
    intro: '{nom}. Notre communauté aimerait mieux connaître vos convictions sur quelques sujets de société. Me permettez-vous de vous poser trois questions, au fil des mois ?',
    ideal: () => 0.6,
    agree: 'Je vous remercie de cette réponse, qui rejoint nos préoccupations. Puis-je la partager avec notre communauté ?',
    disagree: 'Je respecte votre point de vue, même si nous ne le partageons pas. Pouvez-vous m’expliquer votre raisonnement ?',
    good: { text: 'Notre communauté a apprécié votre écoute et votre franchise. Vous y serez toujours accueilli avec respect.', effects: c => [...trust(c, 8), st('credibility', 1)] },
    mixed: { text: 'Nous ne sommes pas d’accord sur tout, et c’est normal en démocratie. Le dialogue continuera.', effects: c => [...trust(c, 2)] },
    bad: { text: 'Nos positions sont éloignées. Nous le dirons à nos fidèles, sans hostilité, mais clairement.', effects: c => [...trust(c, -6)] },
  },
  journaliste: {
    id: 'journaliste', title: 'Le off avec {nom}', questions: 4, topics: [...INSTITUTIONS, ...SOCIETY],
    intro: '{nom}. Rien à publier pour l’instant : je prépare un livre sur la nouvelle génération politique. Quelques questions, en off, sur plusieurs mois. Je veux comprendre comment vous pensez.',
    ideal: () => 0,
    agree: 'Intéressant. Et vous le diriez en on, à visage découvert ?',
    agreeTu: 'Intéressant. Et tu le dirais en on, à visage découvert ?',
    disagreeTu: 'Tu sais que c’est minoritaire dans ton camp ? Tu le maintiens ?',
    introTu: '{nom}. Rien à publier pour l’instant : je prépare un livre sur la nouvelle génération politique. Quelques questions en off, sur plusieurs mois ? Je veux comprendre comment tu penses.',
    disagree: 'Vous savez que c’est minoritaire dans votre camp ? Vous le maintenez ?',
    good: { text: 'Mon chapitre sur vous s’intitulera « Le cohérent ». Mes confrères le liront.', textTu: 'Mon chapitre sur toi s’intitulera « Le cohérent ». Mes confrères le liront.', effects: c => [...trust(c, 8), st('credibility', 3)] },
    mixed: { text: 'Je ne suis pas sûr d’avoir compris votre ligne. Ce sera un chapitre court.', textTu: 'Je ne suis pas sûr d’avoir compris ta ligne. Ce sera un chapitre court.', effects: c => [...trust(c, 1)] },
    bad: { text: 'Mon chapitre sur vous s’appellera « Le flou ». Désolé, c’est ce que j’ai entendu.', textTu: 'Mon chapitre sur toi s’appellera « Le flou ». Désolé, c’est ce que j’ai entendu.', effects: c => [...trust(c, -4), st('credibility', -3)] },
  },
  equipe: {
    id: 'equipe', title: 'Les points du lundi avec {nom}', questions: 4, topics: [...SOCIAL.slice(0, 4), ...SOCIETY.slice(0, 4), ...INSTITUTIONS.slice(0, 3)],
    intro: '{nom} ici. Pour bien vous représenter, j’ai besoin de savoir exactement ce que vous pensez. Je vous propose un point par mois sur un grand sujet ; je bâtirai vos éléments de langage avec.',
    ideal: c => partyLean(c.d),
    agree: 'Parfait, c’est cohérent avec la ligne. Je l’intègre à vos éléments de langage ?',
    disagree: 'Hum. C’est l’inverse de ce que défend le parti. Je dois le dire comme ça aux journalistes ?',
    good: { text: 'J’ai tout ce qu’il faut : vos éléments de langage tiennent debout. On ne vous prendra plus en défaut.', effects: c => [...morale(c, 10), st('credibility', 2), st('stress', -3)] },
    mixed: { text: 'J’ai de quoi travailler, mais certaines réponses vont être difficiles à défendre.', effects: c => [...morale(c, 2)] },
    bad: { text: 'Franchement, je ne sais plus quoi répondre aux journalistes. Votre ligne part dans tous les sens.', effects: c => [...morale(c, -10), st('stress', 3)] },
  },
  parti: {
    id: 'parti', title: 'Le test de loyauté de {nom}', questions: 4, topics: [...SOCIAL.slice(0, 3), ...ECO.slice(0, 3), ...INSTITUTIONS.slice(0, 3)],
    intro: '{nom}. Le parti prépare son programme et ses investitures. J’aimerais m’assurer que nous sommes sur la même ligne : une question par mois, en toute franchise.',
    ideal: c => partyLean(c.d),
    agree: 'C’est exactement la ligne. Tu le défendras au bureau politique ?',
    disagree: 'Ce n’est pas la ligne du parti, tu le sais. Tu comptes le dire publiquement ?',
    good: { text: 'Tu es sur la ligne. Je m’en souviendrai au moment des investitures.', effects: c => [...rel(c, 10), st('politicalCapital', 6), { kind: 'cohesion', delta: 2 }] },
    mixed: { text: 'On n’est pas d’accord sur tout. C’est la démocratie interne… dans une certaine limite.', effects: c => [...rel(c, 1)] },
    bad: { text: 'Tu t’éloignes du parti. Ne t’étonne pas si d’autres passent devant toi.', effects: c => [...rel(c, -12), st('politicalCapital', -6), { kind: 'faction', factionId: 'ligne_dure', delta: -4 }] },
  },
  personnalite: {
    id: 'personnalite', title: 'Les conversations avec {nom}', questions: 4, topics: [...INSTITUTIONS, ...ECO.slice(0, 4), ...SOCIETY.slice(0, 4)],
    intro: '{nom}. On se croise souvent sans vraiment se parler. Et si on échangeait, une question par mois, sur le fond ? J’aimerais savoir s’il y a matière à travailler ensemble.',
    ideal: c => { const n = c.d.npcs.find(x => x.id === c.npcId); const p = [c.d.party, ...c.d.otherParties].find(x => x.id === n?.partyId); return Math.max(-2, Math.min(2, (p?.position ?? 0) / 30)); },
    agree: 'On est d’accord là-dessus, c’est rare entre nous. On pourrait déposer quelque chose ensemble ?',
    agreeTu: 'On est d’accord là-dessus. On pourrait déposer quelque chose ensemble, toi et moi ?',
    disagreeTu: 'On ne sera jamais d’accord sur ce point. Mais j’aime ta franchise. Tu ne bougeras pas ?',
    introTu: '{nom}. On se croise souvent sans vraiment se parler. Et si on échangeait, une question par mois, sur le fond ? J’ai l’impression qu’on pourrait faire des choses ensemble.',
    disagree: 'On ne sera jamais d’accord sur ce point. Mais je respecte la franchise. Vous ne bougerez pas ?',
    good: { text: 'Je crois qu’on peut travailler ensemble. Mon téléphone vous est ouvert.', textTu: 'Je crois qu’on peut travailler ensemble. Mon téléphone t’est ouvert.', effects: c => [...rel(c, 14), st('influence', 2)] },
    mixed: { text: 'Pas d’alliance, mais du respect. C’est déjà beaucoup.', effects: c => [...rel(c, 4)] },
    bad: { text: 'Au moins, c’est clair : nous sommes adversaires. Je m’en souviendrai.', effects: c => [...rel(c, -10)] },
  },
  gouvernement: {
    id: 'gouvernement', title: 'Les échanges avec {nom}', questions: 3, topics: [...ECO.slice(0, 5), ...INSTITUTIONS.slice(0, 4)],
    intro: '{nom}. Le gouvernement prépare ses arbitrages. Je souhaiterais connaître votre position sur quelques sujets, au fil des mois, avant de trancher.',
    ideal: c => partyLean(c.d) * 0.6,
    agree: 'Votre position rejoint celle du gouvernement. Pourrions-nous compter sur votre voix ?',
    disagree: 'Le gouvernement ne partage pas cette analyse. Seriez-vous prêt·e à nuancer, dans l’intérêt général ?',
    good: { text: 'Le gouvernement saura s’appuyer sur vous. Vos dossiers avanceront plus vite.', effects: () => [st('influence', 3), st('politicalCapital', 4)] },
    mixed: { text: 'Nous prenons acte de vos positions. Le dialogue continuera.', effects: () => [st('influence', 1)] },
    bad: { text: 'Vos positions compliquent nos arbitrages. Nous en tiendrons compte.', effects: () => [st('influence', -3), st('politicalCapital', -4)] },
  },
  famille: {
    id: 'famille', title: 'Les dîners de famille avec {nom}', questions: 3, topics: SOCIETY,
    intro: 'C’est {nom}. À chaque dîner, tout le monde se dispute sur la politique et on me demande ce que TOI tu en penses. Je te pose une question par mois, d’accord ? Et sois sincère, hein.',
    ideal: () => 0,
    agree: 'Ah, ça va plaire à tonton ! Je peux lui dire que c’est toi qui le dis ?',
    disagree: 'Mamie ne va pas être contente… Tu es sûr·e ? Tu ne dis pas ça pour tes électeurs ?',
    good: { text: 'Le dernier dîner s’est super bien passé : tout le monde t’a trouvé·e sincère. Tu nous manques, viens plus souvent.', effects: () => [st('stress', -6), { kind: 'health', delta: 2 }] },
    mixed: { text: 'Bon, on s’est disputés comme d’habitude. Mais tu as fait parler tout le monde !', effects: () => [st('stress', -2)] },
    bad: { text: 'Honnêtement, on a l’impression que tu nous réponds comme à des électeurs. Ça fait un peu de peine.', effects: () => [st('stress', 4)] },
  },
};

/** L'archétype d'un interlocuteur du répertoire */
export function archetypeFor(kind: string, key: string, d: GameState): string | null {
  if (kind === 'contact') {
    const c = d.contacts.find(x => `contact:${x.id}` === key);
    if (!c) return null;
    return c.type === 'syndicat' ? 'syndicat' : c.type === 'lobby' || c.type === 'industriel' ? 'patronat' : c.type === 'association' ? 'association' : c.type === 'culte' ? 'culte' : 'journaliste';
  }
  if (kind === 'equipe') return 'equipe';
  if (kind === 'chef' || kind === 'collegue') return 'parti';
  if (kind === 'personnalite' || kind === 'scenario') return 'personnalite';
  if (kind === 'gouvernement') return 'gouvernement';
  if (kind === 'proche') return 'famille';
  return null;
}

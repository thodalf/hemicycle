import { Effect, GameState, PhoneMessage, PhoneReply } from '../models/game.models';
import { RANKS } from '../data/ranks';
import { applyEffects, pushNews } from './effects';
import { Rng } from './rng';
import { nameRng, personName, lastName } from '../data/names';
import { Office, honorific, office, seat } from './office';

/* ============================================================
 *  Les appels entrants : chaque mois, le téléphone peut sonner
 *  pour une vraie occasion (une exclusivité, un service, une
 *  alerte, un dossier). Il faut décrocher avant la fin du mois :
 *  un appel manqué a ses conséquences.
 * ============================================================ */

const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
const rep = (id: string, label: string, effects: Effect[], answer?: string): PhoneReply => ({ id, label, effects, ...(answer ? { answer } : {}) });

interface Incoming {
  id: string;
  from: string;
  role: string;
  text: string;
  minOrder?: number;
  /** Fonctions pour lesquelles l'appel a du sens (toutes par défaut) */
  offices?: Office[];
  when?: (d: GameState) => boolean;
  replies: (d: GameState) => PhoneReply[];
  missed: Effect[];
}

const CALLS: Incoming[] = [
  { id: 'exclu', from: 'Clémence Arnaud', role: 'Rédactrice en chef · grand quotidien', text: 'J’ai une place en une demain matin. Une interview, si vous me donnez quelque chose de neuf. J’ai besoin de votre réponse maintenant.',
    replies: d => [rep('annonce', 'Lui confier une annonce exclusive', [st('popularity', 3), st('influence', 2), { kind: 'dossier', domain: d.agendaDomain, delta: 2 }], 'Parfait. Vous ferez la une.'),
      rep('fond', 'Proposer une tribune de fond', [st('credibility', 3)], 'Moins sexy, mais solide. Page 3.'), rep('non', 'Décliner', [], 'Dommage. Votre rival a dit oui.')],
    missed: [st('influence', -1)] },
  { id: 'prefet', from: 'Le préfet', role: 'Préfecture', offices: ['base', 'depute', 'gouv'], text: 'Une usine menace de fermer dans votre secteur. Une réunion de crise ce soir : votre présence pèserait lourd.',
    replies: () => [rep('y_aller', 'J’arrive', [st('energy', -6), { kind: 'segment', segment: 'populaires', delta: 3 }, st('popularity', 2), { kind: 'economy', unemployment: -0.02 }], 'Merci. Les syndicats apprécieront.'),
      rep('equipe', 'Envoyer un collaborateur', [st('credibility', 1)], 'Je comprends. On fera avec.')],
    missed: [{ kind: 'segment', segment: 'populaires', delta: -2 }] },
  { id: 'mecene', from: 'Bertrand Valois', role: 'Industriel · mécène', offices: ['base', 'depute', 'gouv'], text: 'J’aimerais soutenir votre action. Disons… un dîner, et un chèque pour vos projets ? Rien en échange, évidemment.',
    replies: () => [rep('accepter', 'Accepter le dîner et le chèque', [{ kind: 'funds', account: 'campaign', delta: 15000 }, { kind: 'exposure', delta: 3 }], 'Je savais qu’on se comprendrait.'),
      rep('transparence', 'Accepter, mais tout déclarer publiquement', [{ kind: 'funds', account: 'campaign', delta: 8000 }, st('credibility', 1)], 'Hum. Soit. La transparence a un prix.'),
      rep('refuser', 'Refuser poliment', [st('credibility', 2)], 'Comme vous voudrez.')],
    missed: [] },
  { id: 'vote_echange', from: 'Un collègue de l’autre bord', role: 'Député·e', minOrder: 2, offices: ['depute'], text: 'Je vote votre amendement si vous votez le mien. Personne n’en saura rien.',
    replies: () => [rep('deal', 'Marché conclu', [{ kind: 'flagAdd', key: 'billSupport', delta: 6 }, { kind: 'faction', factionId: '*', delta: -2 }], 'Parfait. Mardi, en séance.'),
      rep('non', 'Je vote selon ma conscience', [st('credibility', 2)], 'Tant pis pour vous.')],
    missed: [] },
  { id: 'prof', from: 'Mme Lacombe', role: 'Votre ancienne professeure', text: 'Je ne voulais pas vous déranger… L’école où vous avez appris à lire va fermer. Pourriez-vous faire quelque chose ?',
    replies: () => [rep('aider', 'Promettre de se battre pour l’école', [{ kind: 'dossier', domain: 'education', delta: 3 }, st('popularity', 2), st('politicalCapital', -4)], 'Je savais que vous n’aviez pas oublié.'),
      rep('visite', 'Lui rendre visite, simplement', [st('stress', -4), st('energy', -2)], 'Le thé sera prêt.')],
    missed: [st('stress', 2)] },
  { id: 'lanceur', from: 'Numéro masqué', role: 'Lanceur d’alerte', text: 'J’ai des documents sur un scandale sanitaire. Je ne fais confiance qu’à vous. On se voit ?',
    replies: d => [rep('rencontrer', 'Le rencontrer, avec un avocat', [{ kind: 'dossier', domain: 'sante', delta: 4 }, st('credibility', 3), st('stress', 3)], 'Gare du Nord, quai 7, 19 h.'),
      rep('presse', 'Le renvoyer vers un journaliste', [st('influence', 1)], 'Vous me décevez. Mais d’accord.'),
      ...(d.player.rankId === 'depute' ? [rep('commission', 'Demander une commission d’enquête', [st('credibility', 4), st('politicalCapital', -6), { kind: 'dossier', domain: 'sante', delta: 3 }], 'Enfin quelqu’un qui agit.')] : [])],
    missed: [st('credibility', -1)] },
  { id: 'plateau', from: 'Programmateur TV', role: 'Émission politique du dimanche', offices: ['base', 'depute', 'gouv'], text: 'Un invité s’est décommandé. Vous pouvez être en plateau dans deux heures ?',
    replies: () => [rep('oui', 'J’y vais', [st('popularity', 3), st('energy', -6), st('stress', 2)], 'Génial ! Maquillage à 17 h.'),
      rep('non', 'Pas aujourd’hui', [], 'Je vous rappellerai… peut-être.')],
    missed: [st('popularity', -1)] },
  { id: 'maire', from: 'Le maire d’un petit village', role: 'Maire rural', offices: ['base', 'depute', 'gouv'], text: 'L’orage a arraché le toit de l’école. On n’a pas les moyens. Vous pouvez nous aider ?',
    replies: () => [rep('reserve', 'Mobiliser une aide d’urgence', [{ kind: 'segment', segment: 'ruraux', delta: 3 }, st('politicalCapital', -5), st('popularity', 1)], 'Merci, du fond du cœur.'),
      rep('dossier', 'Monter un dossier de subvention', [{ kind: 'dossier', domain: 'territoires', delta: 2 }], 'On remplit le formulaire. Encore un.')],
    missed: [{ kind: 'segment', segment: 'ruraux', delta: -2 }] },
  { id: 'syndicat', from: 'Secrétaire général·e', role: 'Grande centrale syndicale', minOrder: 3, offices: ['gouv', 'elysee'], text: 'Une grève se prépare. Si vous nous recevez cette semaine, on peut peut-être l’éviter.',
    replies: () => [rep('recevoir', 'Les recevoir dès demain', [{ kind: 'segment', segment: 'populaires', delta: 2 }, st('credibility', 2), st('energy', -3)], 'On viendra avec nos propositions.'),
      rep('non', 'Renvoyer au dialogue social normal', [{ kind: 'segment', segment: 'cadres', delta: 1 }, { kind: 'segment', segment: 'populaires', delta: -2 }], 'Ce sera la grève, alors.')],
    missed: [{ kind: 'segment', segment: 'populaires', delta: -2 }] },
  { id: 'ambassadeur', from: 'L’ambassadeur du Japon', role: 'Ambassade', minOrder: 3, offices: ['gouv', 'elysee', 'couronne'], text: 'Un investisseur japonais hésite entre la France et l’Allemagne pour une usine. Un mot de vous ferait la différence.',
    replies: () => [rep('convaincre', 'Le recevoir et plaider pour la France', [{ kind: 'economy', unemployment: -0.05, confidence: 2 }, { kind: 'intl', prestige: 1 }, st('energy', -3)], 'Il sera ravi. Il adore les fromages.'),
      rep('plus_tard', 'Proposer un rendez-vous le mois prochain', [], 'Je crains qu’il ne puisse attendre.')],
    missed: [{ kind: 'economy', confidence: -1 }] },
  { id: 'ami', from: 'Votre meilleur ami d’enfance', role: 'Ami', text: 'Ça fait des mois qu’on ne s’est pas vus. Ce soir, pizza et vieux souvenirs ?',
    replies: () => [rep('oui', 'Avec plaisir', [st('stress', -6), st('energy', 3)], 'Génial ! J’apporte la bière.'),
      rep('non', 'Pas ce soir, désolé·e', [st('stress', 1)], 'Comme toujours…')],
    missed: [st('stress', 2)] },
  { id: 'sondeur', from: 'Institut de sondage', role: 'Directeur d’études', offices: ['base', 'depute', 'gouv', 'elysee'], text: 'J’ai des chiffres pas encore publiés. Ils vous intéressent ? Disons, une étude commandée par votre équipe…',
    replies: () => [rep('acheter', 'Commander l’étude (2 000 €)', [{ kind: 'funds', account: 'personal', delta: -2000 }, { kind: 'momentum', delta: 4 }, { kind: 'dossier', domain: 'economie', delta: 1 }], 'Vous les aurez ce soir.'),
      rep('non', 'Non merci', [], 'Vos rivaux, eux, les achètent.')],
    missed: [] },
  // ── Au sommet de l'État ──
  { id: 'etat_major', from: 'Le chef d’état-major des armées', role: 'Ministère des Armées', offices: ['elysee', 'couronne'], text: 'Un navire non identifié croise au large de Brest depuis trois jours, sans répondre aux appels. J’attends vos ordres.',
    replies: () => [rep('escorter', 'Le faire escorter par une frégate', [{ kind: 'intl', prestige: 1 }, st('energy', -2)], 'Bien reçu. La frégate appareille dans l’heure.'),
      rep('diplomatie', 'Saisir d’abord la voie diplomatique', [st('credibility', 1), st('stress', 2)], 'Entendu. Mais je garde un œil dessus.')],
    missed: [{ kind: 'intl', prestige: -1 }, st('stress', 2)] },
  { id: 'homologue', from: 'La cheffe du gouvernement d’un grand pays voisin', role: 'Ligne directe', offices: ['elysee', 'couronne'], text: 'Avant le sommet de jeudi, j’aimerais que nous accordions nos positions. Vous avez dix minutes ?',
    replies: () => [rep('accord', 'Accorder vos positions', [{ kind: 'intl', prestige: 2 }, st('credibility', 1)], 'Parfait. Front commun jeudi.'),
      rep('tenir', 'Défendre seul·e la ligne française', [st('popularity', 1), { kind: 'intl', prestige: -1 }], 'Comme vous voudrez. Le sommet sera tendu.')],
    missed: [{ kind: 'intl', prestige: -1 }] },
  { id: 'secretaire_general', from: 'Votre secrétaire général', role: 'Présidence de la République', offices: ['elysee'], text: 'Un ministre a tenu des propos déplacés à la radio ce matin. Ça tourne en boucle. Recadrage public ou discret ?',
    replies: () => [rep('public', 'Un recadrage public', [st('credibility', 2), { kind: 'presidency', approval: 1 }, st('influence', -1)], 'Le communiqué part dans dix minutes.'),
      rep('discret', 'Un coup de fil discret', [st('influence', 1)], 'Je l’appelle. Il comprendra.')],
    missed: [st('credibility', -1)] },
  { id: 'pm_arbitrage', from: 'Le Premier ministre', role: 'Matignon', offices: ['elysee'], when: d => !!d.presidency && !d.presidency.cohabitation,
    text: 'Bercy et l’Écologie s’écharpent sur le budget. J’ai besoin de votre arbitrage avant ce soir.',
    replies: () => [rep('economie', 'Trancher pour Bercy', [{ kind: 'dossier', domain: 'economie', delta: 2 }, { kind: 'segment', segment: 'cadres', delta: 1 }, { kind: 'segment', segment: 'jeunes', delta: -1 }], 'Bercy vous remercie. L’Écologie boude.'),
      rep('ecologie', 'Trancher pour l’Écologie', [{ kind: 'dossier', domain: 'ecologie', delta: 2 }, { kind: 'segment', segment: 'jeunes', delta: 2 }, { kind: 'segment', segment: 'cadres', delta: -1 }], 'Le ministre des Finances démissionnera peut-être. Ou pas.')],
    missed: [{ kind: 'presidency', majority: -1 }] },
  { id: 'prefet_police', from: 'Le préfet de police', role: 'Préfecture de police de Paris', offices: ['elysee', 'couronne', 'gouv'], text: 'Un cortège non déclaré se dirige vers vous. Quelques milliers de personnes, plutôt calmes. On disperse ?',
    replies: d => [rep('dialogue', 'Recevoir une délégation', [st('popularity', 2), st('energy', -3)], `Je les fais escorter ${seat(d)}. Une délégation de cinq.`),
      rep('disperser', 'Disperser le cortège', [st('credibility', 1), st('popularity', -2), { kind: 'segment', segment: 'jeunes', delta: -2 }], 'Bien reçu. Les images ne seront pas belles.')],
    missed: [st('popularity', -1)] },
  { id: 'nobel', from: 'Une lauréate du prix Nobel de physique', role: 'Recherche publique', offices: ['elysee', 'couronne', 'gouv'], text: 'Mille chercheurs ont signé une lettre sur l’avenir de la recherche. J’aimerais vous la remettre en main propre.',
    replies: d => [rep('recevoir', 'La recevoir longuement', [st('credibility', 2), { kind: 'dossier', domain: 'education', delta: 2 }, st('energy', -2)], `Merci, ${honorific(d)}. Nous serons là jeudi.`),
      rep('deleguer', 'La faire recevoir par un conseiller', [st('credibility', -1)], 'Je vois. Nous le ferons savoir.')],
    missed: [st('credibility', -1)] },
  { id: 'chambellan', from: 'Le grand chambellan', role: 'Maison royale', offices: ['couronne'], text: 'Un souverain étranger nous offre un cheval de course pour votre anniversaire. L’animal arrive demain. Que dois-je répondre ?',
    replies: () => [rep('accepter', 'Accepter avec gratitude', [{ kind: 'intl', prestige: 1 }, { kind: 'segment', segment: 'populaires', delta: -1 }], 'Il sera installé aux écuries royales.'),
      rep('offrir', 'L’offrir à la Garde républicaine', [st('popularity', 2)], 'Un geste élégant, Votre Majesté.')],
    missed: [] },
  { id: 'majordome', from: 'L’intendant du Palais', role: 'Maison royale', offices: ['couronne'], text: 'La toiture de l’aile est du Palais fuit de nouveau. Les restaurateurs veulent huit mois de chantier et une fortune.',
    replies: () => [rep('chantier', 'Lancer le chantier sur votre cassette personnelle', [{ kind: 'funds', account: 'personal', delta: -12000 }, st('popularity', 2)], 'Le pays appréciera que la Couronne paie de sa poche.'),
      rep('reporter', 'Reporter les travaux', [st('stress', 2)], 'Je fais poser des seaux, Votre Majesté.')],
    missed: [] },
  // ── Au gouvernement ──
  { id: 'dircab', from: 'Votre directeur de cabinet', role: 'Cabinet ministériel', offices: ['gouv'], text: 'Une note confidentielle de votre administration vient de fuiter dans la presse. On cherche le responsable ?',
    replies: () => [rep('enquete', 'Ouvrir une enquête interne', [{ kind: 'exposure', delta: -2 }, st('stress', 2)], 'Discrètement, je m’en occupe.'),
      rep('assumer', 'Assumer le contenu de la note', [st('credibility', 2), st('popularity', -1)], 'Courageux. Je prépare les éléments de langage.')],
    missed: [{ kind: 'exposure', delta: 2 }] },
  { id: 'matignon_convoque', from: 'Le cabinet du Premier ministre', role: 'Matignon', offices: ['gouv'], when: d => d.player.rankId === 'ministre', text: 'Le Premier ministre souhaite vous voir demain à 7 h 30. Il n’a pas précisé pourquoi.',
    replies: () => [rep('oui', 'Confirmer le rendez-vous', [st('influence', 2), st('stress', 2)], 'C’est noté. Café serré, j’imagine.'),
      rep('decaler', 'Demander un autre créneau', [st('influence', -1)], 'Il n’aime pas qu’on le fasse attendre.')],
    missed: [st('influence', -2)] },
  { id: 'agents_greve', from: 'Le délégué syndical de votre administration', role: 'Intersyndicale', offices: ['gouv'], text: 'Les agents de votre ministère menacent de faire grève : effectifs, primes, locaux insalubres. Vous nous recevez ?',
    replies: () => [rep('recevoir', 'Les recevoir cette semaine', [{ kind: 'segment', segment: 'populaires', delta: 1 }, st('energy', -3), st('credibility', 1)], 'On viendra avec nos revendications.'),
      rep('dircab', 'Les renvoyer vers le directeur de cabinet', [st('stress', -1), { kind: 'segment', segment: 'populaires', delta: -1 }], 'Ce sera la grève, alors.')],
    missed: [st('popularity', -1)] },
];

/** Les personnes qui appellent changent d'une partie à l'autre (mais restent les mêmes au fil d'une partie) */
const NAMED: Record<string, 'f' | 'm' | 'mme'> = { exclu: 'f', mecene: 'm', prof: 'mme' };
function callerName(d: GameState, c: Incoming): string {
  const kind = NAMED[c.id];
  if (!kind) return c.from;
  const next = nameRng(d.seed, `appel:${c.id}`);
  return kind === 'mme' ? `Mme ${lastName(next)}` : personName(next, kind);
}

/** Chaque mois : peut-être un appel entrant ; les appels non pris sont manqués */
export function monthlyIncomingCall(d: GameState, rng: Rng, add: (m: Omit<PhoneMessage, 'id' | 'week'>) => void): void {
  const msgs = d.phone?.messages ?? [];
  // Les appels du mois passé sans réponse : manqués
  for (const m of msgs) {
    if (!m.urgent || m.answered || m.week >= d.week) continue;
    m.answered = m.kind === 'appel' ? '📵 Appel manqué' : '📵 Resté sans réponse';
    m.read = true;
    if (m.missed?.length) {
      const out = applyEffects(d, m.missed, {}, rng);
      m.summary = out;
      pushNews(d, 'actu', 'negative', `${m.kind === 'appel' ? 'Appel manqué' : 'Message ignoré'} : ${m.from}`, `Vous n’avez pas décroché. ${out.join(' · ')}`.trim());
    }
  }
  const order = RANKS[d.player.rankId]?.order ?? 0;
  if (!rng.chance(0.55 + Math.min(0.25, order * 0.03))) return;
  const recent = new Set(msgs.filter(m => m.urgent && d.week - m.week < 8).map(m => m.who));
  const where = office(d);
  const pool = CALLS.filter(c => (c.minOrder ?? 0) <= order && (!c.offices || c.offices.includes(where)) && !recent.has(`call:${c.id}`) && (!c.when || c.when(d)));
  if (!pool.length) return;
  const c = rng.pick(pool);
  add({ kind: 'appel', who: `call:${c.id}`, from: callerName(d, c), role: c.role, text: `📞 ${c.text}`, replies: c.replies(d), urgent: true, missed: c.missed });
}

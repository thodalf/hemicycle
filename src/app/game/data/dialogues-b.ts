import type { ContactType, Domain, Effect, GameState, Segment } from '../models/game.models';
import { DialogueDef, contactSpeaker, familySpeaker, guestSpeaker, mem, personalitySpeaker, rankAtLeast, st } from './dialogue-types';

/* ============================================================
 *  Conversations à embranchements, lot B : le réseau, les
 *  médias, les personnalités et la vie privée.
 *  Clés de mémoire : préfixe b_ (voir dialogue-types.ts).
 * ============================================================ */

const hasContact = (d: GameState, type: ContactType): boolean => d.contacts.some(c => c.type === type);
const hasPerso = (d: GameState, f: (rel: number) => boolean): boolean => {
  const book = new Set(d.player.phoneBook ?? []);
  return d.npcs.some(n => book.has(n.id) && f(n.relationToPlayer));
};
const perso = (d: GameState): number => d.player.finances.personal;
const seg = (segment: Segment, delta: number): Effect => ({ kind: 'segment', segment, delta });
const exp = (delta: number): Effect => ({ kind: 'exposure', delta });
const eur = (delta: number, account: 'personal' | 'campaign' = 'personal'): Effect => ({ kind: 'funds', account, delta });
const dos = (domain: Domain, delta: number): Effect => ({ kind: 'dossier', domain, delta });
const coh = (delta: number): Effect => ({ kind: 'cohesion', delta });
const mom = (delta: number): Effect => ({ kind: 'momentum', delta });
/** Confiance (et crédit de faveurs) du contact qui écrit */
const ct = (trust: number, balance = 0): Effect => ({ kind: 'contact', contactId: '$speaker', trust, ...(balance ? { balance } : {}) });
/** Relation avec la personnalité qui écrit */
const rel = (delta: number): Effect => ({ kind: 'npcRelation', npcId: '$speaker', delta });

const ENNEMI = (r: number) => r < -20;
const AMI = (r: number) => r > 20;

export const DIALOGUES_B: DialogueDef[] = [
  // ── 1. Un lobbyiste et son « voyage d'étude » ──
  {
    id: 'b_lobby_voyage', weight: 1, eligible: d => rankAtLeast(d, 2) && hasContact(d, 'lobby'),
    who: contactSpeaker('lobby'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Bonjour ! Notre fédération organise un « voyage d’étude » à Lisbonne sur les ports du futur. Trois jours, un hôtel au bord du Tage, quelques visites techniques. Votre place est réservée, il suffit de dire oui.',
        choices: [
          { id: 'accepter', label: 'J’accepte, ça m’intéresse', effects: [st('energy', 4), st('stress', -3), ct(4, -1), dos('economie', 2)], remember: { b_voyage_accepte: 1 }, next: 'programme' },
          { id: 'declarer', label: 'J’y vais, mais je paie mon billet et je le déclare', hint: '1 200 € de votre poche', effects: [eur(-1200), st('credibility', 2), ct(1), dos('economie', 2), st('energy', -2)], remember: { b_voyage_accepte: 1, b_voyage_declare: 1 }, end: 'C’est très inhabituel… mais soit. Bon voyage quand même.' },
          { id: 'refuser', label: 'Non merci, je ne voyage pas aux frais d’un lobby', effects: [st('credibility', 1), ct(-5)], end: 'Dommage. Nos adhérents retiendront que vous n’êtes pas curieux·se.' },
        ],
        ignore: [ct(-2)],
      },
      programme: {
        text: 'Parfait ! Sur place, notre président aimerait vous présenter un petit amendement sur les concessions portuaires. Rien de contraignant : un dîner, une conversation.',
        choices: [
          { id: 'diner', label: 'Va pour le dîner', effects: [ct(3, -1), st('politicalCapital', 1)], remember: { b_diner_lobby: 1 }, end: 'Merveilleux. Nous vous enverrons le texte à votre retour.', later: { months: 5, node: 'facture' } },
          { id: 'visites', label: 'Je viens pour les visites, pas pour l’amendement', effects: [st('credibility', 1), ct(-2)], end: 'Bien sûr, bien sûr. On en reparlera.', later: { months: 6, node: 'facture' } },
          { id: 'annuler', label: 'Finalement, j’annule', hint: 'On n’aime pas les faux bonds', effects: [ct(-4), st('energy', -1)], remember: { b_voyage_accepte: -1 }, end: 'C’est noté. La chambre sera perdue, tant pis.' },
        ],
      },
      facture: {
        text: d => mem(d, 'b_diner_lobby')
          ? 'Bonjour ! Vous vous souvenez de notre dîner à Lisbonne ? L’amendement sur les concessions passe en commission mardi. Nous comptons sur vous pour le déposer.'
          : 'Bonjour. L’amendement sur les concessions portuaires passe en commission mardi. Après Lisbonne, nous pensions pouvoir compter sur un petit geste de votre part.',
        effects: [st('stress', 2)],
        choices: [
          { id: 'deposer', label: 'Je dépose l’amendement', effects: [ct(6, 2), dos('economie', 1), st('credibility', -3), exp(3)], remember: { b_amendement_lobby: 1 }, end: 'Parfait. Nos adhérents sauront s’en souvenir.' },
          { id: 'reecrire', label: 'Je le dépose, réécrit à ma façon', if: d => d.player.stats.influence >= 35, hint: 'Il faut de l’influence pour imposer sa version', effects: [ct(2), st('politicalCapital', -2), dos('economie', 2), st('energy', -3)], end: 'Ce n’est pas tout à fait notre texte… mais c’est un début.' },
          { id: 'rien', label: 'Je ne dépose rien', effects: [ct(-6), st('credibility', 1)], remember: { b_lobby_froisse: 1 }, end: 'Nous en prenons acte. Les voyages, c’est fini pour vous.' },
        ],
        ignore: [ct(-4)],
      },
    },
  },

  // ── 2. Une journaliste a un document et propose un off ──
  {
    id: 'b_journaliste_document', weight: 1, eligible: d => rankAtLeast(d, 2) && hasContact(d, 'journaliste'),
    who: contactSpeaker('journaliste'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => {
          if (mem(d, 'b_voyage_accepte') > 0) return 'Bonjour. J’ai la liste des invités d’un voyage à Lisbonne offert par une fédération professionnelle. Votre nom y figure. Je vous propose d’en parler, en off d’abord.';
          if (mem(d, 'b_pret_banque') > 0) return 'Bonjour. J’ai un document qui montre que vous avez obtenu un prêt à un taux très avantageux, auprès d’une banque dont vous examinez la régulation. Je vous propose d’en parler, en off d’abord.';
          return 'Bonjour. J’ai récupéré une note interne de votre parti qui vous décrit comme « encombrant·e » pour les prochaines investitures. Je publie lundi. Vous voulez réagir, en off d’abord ?';
        },
        choices: [
          { id: 'off', label: 'Va pour un off, si je relis mes citations', effects: [st('energy', -2), ct(3)], next: 'off' },
          { id: 'silence', label: 'Je n’ai rien à vous dire', effects: [ct(-3)], next: 'sans_vous' },
          { id: 'avocat', label: 'Publiez et vous aurez affaire à mon avocat', hint: 'Risqué : la presse déteste les menaces', effects: [eur(-1500), st('stress', 2)], remember: { b_menace_presse: 1 }, risk: { chance: 0.5, scaleWith: 'influence', fail: 'contre_feu' }, end: 'Très bien. Je vais… revoir mon papier avec ma rédaction en chef.' },
        ],
        ignore: [ct(-3), exp(2)],
      },
      off: {
        text: 'Merci. En échange de votre version, votre nom ne sera pas dans le titre. Mais ma rédaction veut du concret : vous auriez quelque chose sur quelqu’un d’autre ?',
        choices: [
          { id: 'balancer', label: 'Une info sur un adversaire, mais pas de moi', effects: [ct(6, 1), st('influence', 2), st('credibility', -2)], remember: { b_off_journaliste: 1 }, end: 'Vous êtes précieux·se. Votre nom sera en page 6, en tout petit.', later: { months: 7, node: 'renvoi' } },
          { id: 'recus', label: 'Le voyage, je l’ai payé : voici les reçus', if: d => mem(d, 'b_voyage_declare') > 0, effects: [st('credibility', 4), ct(2)], end: 'Ah. Ça change tout : il n’y a plus d’article sur vous. Chapeau.' },
          { id: 'fond', label: 'Je m’explique sur le fond, rien de plus', effects: [st('credibility', 1), exp(3), st('popularity', -1)], end: 'C’est honnête. L’article sera sévère, mais juste.' },
        ],
      },
      sans_vous: {
        text: 'Dommage. L’article sortira donc sans votre version, et votre silence sera interprété. Dernière chance ?',
        choices: [
          { id: 'rappel', label: 'Bon. Rappelez-moi ce soir', effects: [st('stress', 2)], next: 'off' },
          { id: 'publiez', label: 'Publiez', effects: [st('credibility', -4), exp(5), ct(-2)], end: 'Comme vous voudrez. Lundi, page 3.' },
        ],
      },
      contre_feu: {
        text: 'Ma rédaction a adoré votre menace : elle ouvre le papier. « L’élu·e qui menace la presse ». Des regrets ?',
        effects: [st('credibility', -5), exp(6), ct(-6)],
        choices: [
          { id: 'excuses', label: 'Je présente mes excuses', effects: [st('credibility', 2), st('politicalCapital', -2)], end: 'C’est noté. Ce sera dans la mise à jour de l’article.' },
          { id: 'maintenir', label: 'Je maintiens chaque mot', effects: [st('popularity', 1), st('stress', 3)], end: 'Vos soutiens vont adorer. Les autres, beaucoup moins.' },
        ],
      },
      renvoi: {
        text: 'Bonjour. Votre tuyau a fait un carton. Mon rédacteur en chef veut maintenant un grand portrait de vous, bien placé. Je vous renvoie l’ascenseur, si vous voulez.',
        effects: [st('influence', 1), ct(2)],
        choices: [
          { id: 'portrait', label: 'Avec plaisir', effects: [st('popularity', 3), exp(4), st('energy', -3)], end: 'Le photographe passe jeudi. Mettez une belle chemise.' },
          { id: 'discret', label: 'Je préfère rester discret·e', effects: [st('stress', -2), ct(-1)], end: 'Comme vous voudrez. L’offre tient.' },
        ],
      },
    },
  },

  // ── 3. Un industriel menace de fermer son usine ──
  {
    id: 'b_industriel_usine', weight: 1, eligible: d => rankAtLeast(d, 2) && hasContact(d, 'industriel'),
    who: contactSpeaker('industriel'),
    start: 'debut',
    nodes: {
      debut: {
        call: true,
        text: 'Je serai direct : notre usine de votre circonscription perd de l’argent. Sans l’aide promise par l’État, je ferme dans six mois. 240 salariés. Vous pouvez débloquer ça, ou pas.',
        choices: [
          { id: 'porter', label: 'Je porte votre demande au ministère', effects: [st('politicalCapital', -4), dos('economie', 2), ct(4, -1)], remember: { b_aide_usine: 1 }, next: 'contreparties' },
          { id: 'comptes', label: 'Je veux d’abord voir vos comptes', effects: [st('energy', -3), ct(-2), st('credibility', 2)], next: 'comptes' },
          { id: 'syndicats', label: 'Je mets les syndicats dans la boucle', if: d => hasContact(d, 'syndicat'), effects: [ct(-4), seg('populaires', 2)], remember: { b_mediation_usine: 1 }, end: 'Vous allez mettre le feu. Faites comme vous voulez, mais je ne négocierai pas sous la pression.', later: { months: 4, node: 'table_ronde' } },
          { id: 'bluff', label: 'Vous bluffez. Je ne cède pas au chantage', hint: 'Et s’il ne bluffe pas ?', effects: [st('credibility', 2), ct(-5)], risk: { chance: 0.45, scaleWith: 'credibility', fail: 'fermeture' }, end: '… Bon. Je garde l’usine ouverte pour l’instant. Mais je m’en souviendrai.' },
        ],
        ignore: [ct(-3), seg('populaires', -1)],
      },
      contreparties: {
        text: 'Merci. Le ministère exigera des engagements : maintien de l’emploi pendant trois ans. Entre nous, je préférerais deux. Vous pouvez arranger ça ?',
        choices: [
          { id: 'trois', label: 'Trois ans, c’est le minimum', effects: [ct(-2), seg('populaires', 3), st('credibility', 1)], end: 'Vous êtes dur·e en affaires. Va pour trois ans.', later: { months: 8, node: 'bilan' } },
          { id: 'deux', label: 'Deux ans, si c’est le prix', effects: [ct(4, 1), seg('populaires', -2), dos('economie', 1)], remember: { b_usine_complaisant: 1 }, end: 'Voilà qui est raisonnable. Je n’oublierai pas.', later: { months: 8, node: 'bilan' } },
        ],
      },
      comptes: {
        text: 'Mes comptes ? Vous n’êtes pas commissaire aux comptes. Bon… je vous les envoie. Vous verrez que la situation est grave.',
        choices: [
          { id: 'benefices', label: 'Ils montrent des bénéfices : je refuse', effects: [st('credibility', 3), ct(-6), dos('economie', 2)], end: 'Les bénéfices d’hier ne paient pas les machines de demain. Bonne chance.', later: { months: 6, node: 'fermeture' } },
          { id: 'aider', label: 'C’est grave, en effet : je vous aide', effects: [st('politicalCapital', -3), ct(3), dos('economie', 2)], remember: { b_aide_usine: 1 }, end: 'Merci. On se reparle quand l’argent arrive.', later: { months: 8, node: 'bilan' } },
        ],
      },
      fermeture: {
        text: 'Voilà, c’est fait : la fermeture est annoncée ce matin. Les salariés sont devant les grilles, les caméras aussi. Ils vous cherchent.',
        effects: [seg('populaires', -4), st('popularity', -3), exp(4), st('stress', 3)],
        choices: [
          { id: 'grilles', label: 'Je vais devant l’usine', effects: [st('energy', -5), seg('populaires', 3), st('popularity', 1)], end: 'Bon courage. Moi, je n’irai pas.' },
          { id: 'repreneur', label: 'Je cherche un repreneur', effects: [st('politicalCapital', -3), dos('economie', 3), st('energy', -3)], end: 'Si vous trouvez quelqu’un pour la racheter, je vous la vends. Bonne chasse.' },
        ],
      },
      bilan: {
        text: d => mem(d, 'b_usine_complaisant')
          ? 'Petit bilan : l’aide est arrivée, l’usine tourne. Comme convenu, nous préparons un plan de départs volontaires pour dans deux ans… ou un peu avant.'
          : 'Petit bilan : l’aide est arrivée, l’usine tourne, et nous embauchons même douze intérimaires. Je vous dois une fière chandelle.',
        effects: [dos('economie', 2), ct(3)],
        choices: [
          { id: 'annoncer', label: 'Je fais savoir que l’usine est sauvée', effects: [st('popularity', 3), seg('populaires', 2), exp(2)], end: 'Faites. C’est mérité.' },
          { id: 'tenir', label: 'Aucun départ avant la date promise', if: d => mem(d, 'b_usine_complaisant') > 0, effects: [ct(-3), seg('populaires', 2), st('credibility', 2)], end: 'Vous me tenez par la parole. Soit.' },
          { id: 'dette', label: 'Gardez en tête que vous me devez un service', effects: [ct(-1, 2), st('influence', 1)], end: 'Je n’oublie jamais une dette.' },
        ],
      },
      table_ronde: {
        text: 'La table ronde avec les syndicats a eu lieu. Je l’admets : ça a désamorcé la grève. On signe un accord de site, mais il me manque toujours l’aide de l’État.',
        effects: [seg('populaires', 2), st('credibility', 2)],
        choices: [
          { id: 'defendre', label: 'Je défends l’accord au ministère', effects: [st('politicalCapital', -3), dos('economie', 2), ct(4)], remember: { b_aide_usine: 1 }, end: 'Merci. Pour une fois, tout le monde sort gagnant.' },
          { id: 'suffit', label: 'Votre accord se suffit à lui-même', effects: [ct(-2), st('energy', 1)], end: 'Facile à dire quand on ne paie pas les salaires.' },
        ],
      },
    },
  },

  // ── 4. Un syndicaliste propose un accord secret ──
  {
    id: 'b_syndicat_secret', weight: 1, eligible: d => rankAtLeast(d, 2) && hasContact(d, 'syndicat'),
    who: contactSpeaker('syndicat'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `${mem(d, 'b_mediation_usine') > 0 ? 'Vous avez joué le jeu à la table ronde de l’usine, alors je vous fais confiance. ' : mem(d, 'b_aide_usine') > 0 ? 'Vous avez aidé l’usine, les gars le savent. ' : ''}Je vous propose un accord, entre nous : je calme la grève des transporteurs qui démarre dans le département, vous défendez publiquement notre amendement sur les salaires. Personne n’a besoin de savoir.`,
        choices: [
          { id: 'conclu', label: 'Marché conclu', effects: [ct(5, -1), seg('populaires', 2), dos('social', 2), st('credibility', -1)], remember: { b_accord_syndical: 1 }, next: 'gage' },
          { id: 'public', label: 'Je défends l’amendement, publiquement et sans accord', effects: [seg('populaires', 3), seg('cadres', -2), st('politicalCapital', -2), ct(2)], end: 'Sans contrepartie ? Vous êtes un drôle d’oiseau. Je calmerai quand même les troupes.' },
          { id: 'non', label: 'Je ne négocie pas en secret', effects: [st('credibility', 2), ct(-5)], end: 'Alors la grève durera. Et on dira que vous n’avez rien fait.', later: { months: 3, node: 'greve' } },
        ],
        ignore: [ct(-3)],
      },
      gage: {
        text: 'Il me faut un gage pour mes adhérents : une phrase de vous dans la presse, cette semaine. Ensuite, je débranche le mouvement.',
        choices: [
          { id: 'interview', label: 'Je donne une interview demain', effects: [exp(3), st('energy', -2), seg('populaires', 2), seg('cadres', -1)], end: 'Parfait. Le mouvement s’arrêtera vendredi.', later: { months: 6, node: 'fuite' } },
          { id: 'tweet', label: 'Un message sur les réseaux, pas plus', hint: 'La base pourrait trouver ça léger', effects: [seg('populaires', 1)], risk: { chance: 0.4, scaleWith: 'influence', fail: 'deborde' }, end: 'Un message… Bon, ça suffira. De justesse.', later: { months: 6, node: 'fuite' } },
        ],
      },
      deborde: {
        text: 'Mes adhérents trouvent votre message ridicule. La base m’a débordé : la grève continue et votre nom circule dans les assemblées générales.',
        effects: [seg('populaires', -3), st('stress', 3), ct(-3)],
        choices: [
          { id: 'parler', label: 'J’irai leur parler en personne', effects: [st('energy', -5), seg('populaires', 3)], end: 'Courageux. On verra comment ils vous reçoivent.' },
          { id: 'lacher', label: 'Ce n’est plus mon problème', effects: [st('credibility', -2), ct(-3)], end: 'Notre accord est caduc, alors.' },
        ],
      },
      fuite: {
        text: 'Mauvaise nouvelle : quelqu’un chez nous a parlé de notre arrangement. Un journaliste me pose des questions. Je nie tout, mais il faut accorder nos violons.',
        effects: [st('stress', 3), exp(3)],
        choices: [
          { id: 'nier', label: 'On nie ensemble, en bloc', hint: 'Si une preuve existe…', effects: [ct(2)], risk: { chance: 0.4, scaleWith: 'credibility', fail: 'revele' }, end: 'Ça tient. Il n’a rien de solide.' },
          { id: 'assumer', label: 'J’assume : négocier la paix sociale, c’est mon rôle', effects: [st('credibility', -2), seg('populaires', 2), seg('cadres', -2), ct(3)], end: 'Gonflé. Mais ça peut passer.' },
          { id: 'accuser', label: 'Je dirai que l’idée venait de vous', effects: [ct(-8), st('credibility', -1)], remember: { b_syndicat_lache: 1 }, end: 'Je m’en souviendrai, croyez-moi.' },
        ],
      },
      revele: {
        text: 'C’est sorti : « Le pacte secret entre un·e député·e et un syndicat ». Mes adhérents me demandent des comptes, vos électeurs aussi.',
        effects: [st('credibility', -5), exp(5), seg('cadres', -2)],
        choices: [
          { id: 'front', label: 'On fait front commun', effects: [ct(4), seg('populaires', 2), st('stress', 2)], end: 'À deux, on tiendra. Peut-être.' },
          { id: 'distance', label: 'Je prends mes distances', effects: [ct(-6), st('credibility', 1)], end: 'Chacun pour soi, donc. C’est noté.' },
        ],
      },
      greve: {
        text: 'La grève dure depuis trois semaines. Les camions bloquent la rocade de votre ville, et les commerçants vous accusent de n’avoir rien fait.',
        effects: [st('popularity', -2), seg('ruraux', -2), st('stress', 2)],
        choices: [
          { id: 'mediateur', label: 'Je viens jouer les médiateurs', effects: [st('energy', -6), seg('populaires', 2), st('credibility', 2), ct(3)], end: 'Enfin. On vous attend demain à 8 h au dépôt.' },
          { id: 'prefet', label: 'Je demande au préfet de faire lever les blocages', effects: [seg('populaires', -3), seg('cadres', 2), ct(-4)], end: 'Vous avez choisi votre camp.' },
        ],
      },
    },
  },

  // ── 5. Un rival propose une trêve ──
  {
    id: 'b_rival_treve', weight: 1, eligible: d => rankAtLeast(d, 2) && hasPerso(d, ENNEMI),
    who: personalitySpeaker(ENNEMI),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `On se tape dessus depuis trop longtemps, et ça profite à nos adversaires communs. ${mem(d, 'b_dette_allie') > 0 ? 'Et je sais que certains de tes amis te boudent en ce moment. ' : ''}Je te propose une trêve : plus d’attaques personnelles d’ici aux élections. Tope là ?`,
        choices: [
          { id: 'accepter', label: 'Trêve acceptée', effects: [rel(10), st('stress', -3), st('influence', -1)], remember: { b_treve_rival: 1 }, end: 'Bien. On verra combien de temps on tient.', later: { months: 6, node: 'test' } },
          { id: 'public', label: 'Seulement si tu le dis publiquement', effects: [rel(4), st('credibility', 2), st('energy', -2)], next: 'public' },
          { id: 'double', label: 'Faire semblant d’accepter', if: d => d.player.stats.influence >= 40, hint: 'Double jeu : il faut du poids', effects: [rel(6), st('influence', 2)], remember: { b_treve_trahie: 1 }, next: 'double' },
          { id: 'non', label: 'Pas de trêve. Je gagne à la loyale', effects: [rel(-5), st('credibility', 1), st('stress', 2)], end: 'Comme tu veux. Ce sera la guerre, alors.' },
        ],
        ignore: [rel(-4)],
      },
      public: {
        text: 'Publiquement ? Tu veux que je me mette à genoux devant les caméras ? Bon… une déclaration commune, sobre, sur l’intérêt général. Ça te va ?',
        choices: [
          { id: 'ok', label: 'Ça me va', effects: [st('popularity', 2), st('credibility', 2), rel(5), exp(2)], remember: { b_treve_rival: 1 }, end: 'Je fais rédiger le texte.', later: { months: 6, node: 'test' } },
          { id: 'torts', label: 'Non : tu dois reconnaître tes torts', effects: [rel(-6), st('popularity', 1)], end: 'Alors oublie ma proposition.' },
        ],
      },
      double: {
        text: 'Parfait. Tant qu’on y est : je me présente à la présidence de la commission. Ton silence suffira.',
        choices: [
          { id: 'trahir', label: 'Promis… et je soutiens ton concurrent en douce', hint: 'S’il l’apprend, ta parole ne vaudra plus rien', effects: [st('politicalCapital', 3)], risk: { chance: 0.5, scaleWith: 'influence', fail: 'demasque' }, end: 'Merci. Je n’oublierai pas.', later: { months: 5, node: 'test' } },
          { id: 'franc', label: 'Finalement, je joue franc-jeu avec toi', effects: [rel(4), st('influence', -1)], remember: { b_treve_rival: 1, b_treve_trahie: -1 }, end: 'Tu me surprends. Dans le bon sens.', later: { months: 6, node: 'test' } },
        ],
      },
      demasque: {
        text: 'Tu m’as pris pour un idiot ? Ton petit jeu avec mon concurrent est connu de tout le groupe. Notre trêve est morte, et ta parole ne vaut plus grand-chose.',
        effects: [rel(-15), st('credibility', -4), st('politicalCapital', -3), coh(-2)],
        choices: [
          { id: 'politique', label: 'C’est la politique', effects: [st('stress', 2), st('influence', 1)], end: 'Alors ne t’étonne pas de la suite.' },
          { id: 'pardon', label: 'Je te présente mes excuses', effects: [st('credibility', 1), st('politicalCapital', -2), rel(3)], end: 'Des excuses… On verra si elles valent quelque chose.' },
        ],
      },
      test: {
        text: d => mem(d, 'b_treve_trahie') > 0
          ? 'La présidence de commission m’a échappé, et j’ai appris des choses sur ton rôle. Je préfère te le dire en face : je sais.'
          : 'Des mois de trêve, et pas un coup bas. J’avoue, je ne pensais pas qu’on tiendrait. Mais un de mes proches a une info sur toi et veut la sortir.',
        effects: [st('stress', 2)],
        choices: [
          { id: 'empecher', label: 'Si tu tiens à la trêve, tu l’en empêches', if: d => mem(d, 'b_treve_trahie') <= 0, effects: [rel(4), st('credibility', 1)], end: 'C’est fait. Je tiens ma parole, tu tiens la tienne.' },
          { id: 'dossiers', label: 'Laisse sortir. J’ai aussi des dossiers', if: d => mem(d, 'b_treve_trahie') <= 0, effects: [rel(-10), st('influence', 2), exp(3)], end: 'Alors la trêve est finie.' },
          { id: 'nier', label: 'Tu ne prouveras rien', if: d => mem(d, 'b_treve_trahie') > 0, effects: [rel(-8), st('stress', 2)], end: 'Je n’ai pas besoin de prouver. Tout le monde le sait.' },
          { id: 'reparer', label: 'J’ai eu tort. Je te soutiendrai la prochaine fois', if: d => mem(d, 'b_treve_trahie') > 0, effects: [rel(6), st('politicalCapital', -3)], end: 'Je prends note. La prochaine fois, ne me déçois pas.' },
        ],
      },
    },
  },

  // ── 6. Un allié demande un retour d'ascenseur ──
  {
    id: 'b_allie_ascenseur', weight: 1, eligible: d => rankAtLeast(d, 2) && hasPerso(d, AMI),
    who: personalitySpeaker(AMI),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Ma tribune pour sauver la maternité de ma ville paraît dimanche. Il me faut des signatures de poids, et la tienne compte. Je t’ai soutenu·e quand tu en avais besoin, tu te souviens ?',
        choices: [
          { id: 'signer', label: 'Je signe, évidemment', effects: [rel(8), dos('sante', 1), st('politicalCapital', -2)], remember: { b_ascenseur_rendu: 1 }, next: 'plus' },
          { id: 'paragraphe', label: 'Je signe si tu retires l’attaque contre le gouvernement', effects: [rel(2), st('energy', -2)], next: 'negocie' },
          { id: 'refuser', label: 'Je ne peux pas, la direction s’y oppose', effects: [rel(-8), st('politicalCapital', 2)], remember: { b_dette_allie: 1 }, end: 'Je vois. Je saurai m’en souvenir quand tu auras besoin de moi.', later: { months: 8, node: 'rappel' } },
        ],
        ignore: [rel(-5)],
      },
      plus: {
        text: 'Merci ! Et tant qu’on y est, viendrais-tu à la manifestation de samedi devant l’hôpital ? Les caméras seront là.',
        choices: [
          { id: 'venir', label: 'J’y serai', effects: [st('energy', -4), exp(3), seg('ruraux', 2), dos('sante', 1)], end: 'Tu es un·e vrai·e ami·e.', later: { months: 7, node: 'renvoi' } },
          { id: 'assez', label: 'La tribune, c’est déjà beaucoup', effects: [rel(-2)], end: 'Tu as raison, je ne vais pas abuser.', later: { months: 7, node: 'renvoi' } },
        ],
      },
      negocie: {
        text: 'Retirer ce paragraphe, c’est retirer le cœur du texte. Bon… je l’adoucis. Mais tu signes en premier, en haut de la liste.',
        choices: [
          { id: 'premier', label: 'Marché conclu, je signe en tête', effects: [rel(5), exp(2), st('politicalCapital', -1)], remember: { b_ascenseur_rendu: 1 }, end: 'Merci. Ça va faire du bruit.', later: { months: 7, node: 'renvoi' } },
          { id: 'bas', label: 'En bas de la liste, ou rien', effects: [rel(-4)], remember: { b_dette_allie: 1 }, end: 'Tu chipotes. C’est noté.' },
        ],
      },
      renvoi: {
        text: 'La maternité est sauvée ! Le ministère a cédé, et ta signature a pesé. Je te dois une fière chandelle : dis-moi ce que tu veux.',
        effects: [rel(5), dos('sante', 2), st('popularity', 1)],
        choices: [
          { id: 'congres', label: 'Ton soutien au prochain congrès', effects: [st('politicalCapital', 3), { kind: 'faction', factionId: '*', delta: 1 }], end: 'Tu l’as. Et je ferai passer le mot.' },
          { id: 'rien', label: 'Rien. C’était pour la maternité', effects: [st('credibility', 2), rel(3)], end: 'Tu es rare, tu sais.' },
        ],
      },
      rappel: {
        text: 'La maternité a fermé. Je ne dis pas que c’est ta faute, mais je n’ai pas oublié ton silence. Au groupe, plusieurs collègues pensent comme moi.',
        effects: [rel(-4), st('politicalCapital', -2), coh(-1)],
        choices: [
          { id: 'voir', label: 'Je viens te voir pour en parler', effects: [st('energy', -3), rel(5)], end: 'D’accord. Mais tu paies le café.' },
          { id: 'raisons', label: 'J’avais mes raisons', effects: [st('stress', 2)], end: 'Tout le monde en a. C’est bien le problème.' },
        ],
      },
    },
  },

  // ── 7. Un humoriste vous invite dans son émission ──
  {
    id: 'b_humoriste', weight: 1, eligible: d => rankAtLeast(d, 2),
    who: guestSpeaker('b_humoriste', 'Lou Fargeot', 'Humoriste, « Le Grand Bazar »'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Salut ! Ici Lou, de l’émission « Le Grand Bazar ». On adorerait vous recevoir dimanche : sketch, questions décalées, peut-être une chanson. Nos invités politiques gagnent toujours des points chez les jeunes… quand ça se passe bien.',
        choices: [
          { id: 'jouer', label: 'Avec plaisir, je joue le jeu', hint: 'Une blague ratée, et c’est la séquence de l’année', effects: [seg('jeunes', 3), st('popularity', 2), exp(3), st('energy', -3)], remember: { b_humoriste_ok: 1 }, risk: { chance: 0.4, scaleWith: 'popularity', fail: 'bide' }, next: 'triomphe' },
          { id: 'sans_chanson', label: 'Oui, mais pas de chanson', effects: [seg('jeunes', 1), st('popularity', 1), st('energy', -2)], next: 'conditions' },
          { id: 'non', label: 'Je ne fais pas de divertissement', effects: [st('credibility', 1), seg('jeunes', -1)], end: 'Dommage ! On vous fera quand même une marionnette. Elle sera moins sympa que vous.', later: { months: 4, node: 'marionnette' } },
        ],
      },
      triomphe: {
        text: 'Énorme ! Votre réplique sur la cantine de l’Assemblée fait deux millions de vues. La production veut vous réinviter pour la spéciale de fin d’année.',
        choices: [
          { id: 'revenir', label: 'Je reviens volontiers', effects: [seg('jeunes', 2), st('credibility', -2), st('energy', -2)], end: 'Génial ! On vous prépare un truc mémorable.', later: { months: 5, node: 'speciale' } },
          { id: 'une_fois', label: 'Une fois, c’était bien', effects: [st('credibility', 1)], end: 'Sage. La porte reste ouverte.' },
        ],
      },
      bide: {
        text: 'Aïe… votre blague sur les retraités est mal passée. Le passage tourne en boucle, avec des commentaires peu flatteurs. On peut rattraper le coup ?',
        effects: [seg('retraites', -4), st('credibility', -3), exp(4)],
        choices: [
          { id: 'excuses', label: 'Je m’excuse auprès des retraités', effects: [st('credibility', 1), seg('retraites', 2), st('energy', -2)], end: 'Classe. On diffusera vos excuses en ouverture dimanche prochain.' },
          { id: 'assumer', label: 'C’était de l’humour, on assume', effects: [seg('jeunes', 2), seg('retraites', -2)], end: 'Les jeunes adorent. Les autres, un peu moins.' },
        ],
      },
      conditions: {
        text: 'Pas de chanson, promis. Mais il y aura le « jeu des prix » : on vous demandera le prix d’une baguette, d’un ticket de métro, d’un plein d’essence. Prêt·e ?',
        choices: [
          { id: 'reviser', label: 'Je révise et j’y vais', hint: 'Un trou de mémoire coûte cher', effects: [st('energy', -3), seg('jeunes', 1)], remember: { b_humoriste_ok: 1 }, risk: { chance: 0.35, scaleWith: 'credibility', fail: 'bide' }, end: 'Sans faute ! Le public vous a applaudi·e. Revenez quand vous voulez.' },
          { id: 'decliner', label: 'Finalement, je décline', effects: [st('stress', -1), seg('jeunes', -1)], end: 'Tant pis. On dira que vous avez eu peur de la baguette.', later: { months: 4, node: 'marionnette' } },
        ],
      },
      marionnette: {
        text: 'Coucou, c’est Lou. Votre marionnette est devenue le personnage culte de l’émission : elle bafouille et se cache sous les tables. Vous voulez venir lui donner la réplique ?',
        effects: [exp(3), st('credibility', -1)],
        choices: [
          { id: 'face', label: 'Pourquoi pas, face à ma marionnette', effects: [st('popularity', 3), seg('jeunes', 3), st('energy', -3)], remember: { b_humoriste_ok: 1 }, end: 'Ça va être culte. Merci d’avoir de l’humour !' },
          { id: 'mauvais_gout', label: 'Je trouve ça de mauvais goût', effects: [st('stress', 2), seg('jeunes', -1)], end: 'C’est la règle du jeu. Elle continuera sans vous.' },
        ],
      },
      speciale: {
        text: 'La spéciale est en boîte : audience record, et vous êtes l’invité·e la plus commentée. Mais un éditorialiste vous traite de « clown de la République ».',
        effects: [seg('jeunes', 3), st('popularity', 2), st('credibility', -2)],
        choices: [
          { id: 'repondre', label: 'Je lui réponds avec humour', effects: [st('popularity', 1), exp(2)], end: 'Votre réponse fait encore plus de vues que l’émission. Bravo.' },
          { id: 'arreter', label: 'J’arrête la télé de divertissement', effects: [st('credibility', 2), seg('jeunes', -1)], end: 'Dommage. Vous étiez notre meilleur·e invité·e.' },
        ],
      },
    },
  },

  // ── 8. Une influenceuse propose un live ──
  {
    id: 'b_influenceuse_live', weight: 1, eligible: d => rankAtLeast(d, 1),
    who: guestSpeaker('b_influenceuse', 'Maëlle Tran', 'Créatrice de contenu'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `Hello ! Je suis Maëlle, 800 000 abonnés sur les réseaux. ${mem(d, 'b_humoriste_ok') > 0 ? 'Je vous ai vu·e au « Grand Bazar », vous étiez trop drôle. ' : ''}Je vous propose un live d’une heure : mes abonnés posent leurs questions, sans filtre. Ça vous tente ?`,
        choices: [
          { id: 'banco', label: 'Banco, sans filtre', hint: 'Une question piège peut devenir un mème', effects: [seg('jeunes', 4), st('energy', -3), exp(3)], remember: { b_live_fait: 1 }, risk: { chance: 0.4, scaleWith: 'credibility', fail: 'piege' }, next: 'apres_live' },
          { id: 'themes', label: 'Oui, si on choisit les thèmes ensemble', effects: [seg('jeunes', 2), st('energy', -2)], next: 'themes' },
          { id: 'non', label: 'Pas mon genre, désolé·e', effects: [seg('jeunes', -2)], end: 'Ok… mes abonnés vont dire que vous les snobez.' },
        ],
      },
      apres_live: {
        text: 'Le live a fait 300 000 vues ! Une marque veut sponsoriser notre prochain live ensemble, avec un cachet. Partant·e ?',
        choices: [
          { id: 'sans', label: 'Pas de sponsor, juste nous deux', effects: [st('credibility', 2), st('energy', -2)], end: 'Respect. On se refait ça bientôt.', later: { months: 6, node: 'retour' } },
          { id: 'association', label: 'Si le cachet va à une association', effects: [st('popularity', 2), st('credibility', -1), seg('jeunes', 1)], end: 'Trop bien, j’adore l’idée.', later: { months: 6, node: 'retour' } },
        ],
      },
      themes: {
        text: 'Ok pour les thèmes : logement, études, climat. Mais mes abonnés détestent la langue de bois, je vous préviens.',
        choices: [
          { id: 'cash', label: 'Je parle cash', effects: [seg('jeunes', 3), st('credibility', 1), st('energy', -3)], remember: { b_live_fait: 1 }, end: 'Top. Vous avez un vrai fan-club maintenant.', later: { months: 6, node: 'retour' } },
          { id: 'prudent', label: 'Je reste prudent·e', effects: [seg('jeunes', -1), st('credibility', 1)], end: 'Mouais. Ils ont trouvé ça un peu scolaire.' },
        ],
      },
      piege: {
        text: 'Oups. Un abonné vous a demandé le montant de votre loyer en direct, et votre hésitation est devenue un mème. On fait une vidéo de rattrapage ?',
        effects: [st('credibility', -3), exp(4), seg('jeunes', -2)],
        choices: [
          { id: 'video', label: 'Oui, et j’assume tout', effects: [st('energy', -2), seg('jeunes', 3), st('credibility', 1)], end: 'Le rattrapage marche encore mieux que le live. Les gens aiment la sincérité.' },
          { id: 'laisser', label: 'Non, laissons passer', effects: [st('stress', 2)], end: 'Comme vous voulez. Ça passera… dans une semaine ou deux.' },
        ],
      },
      retour: {
        text: 'Coucou ! Après notre live, une de mes abonnées a lancé une pétition pour le logement étudiant : 50 000 signatures. Elle aimerait que vous la portiez.',
        effects: [seg('jeunes', 2)],
        choices: [
          { id: 'porter', label: 'Je la porte', effects: [dos('education', 2), st('politicalCapital', -2), seg('jeunes', 3)], end: 'Elle est aux anges. Je fais une story !' },
          { id: 'relayer', label: 'Je la relaie, sans plus', effects: [seg('jeunes', 1), st('credibility', -1)], end: 'C’est déjà ça. Merci.' },
        ],
      },
    },
  },

  // ── 9. Votre ancien professeur vous reproche un vote ──
  {
    id: 'b_ancien_prof', weight: 1, eligible: d => rankAtLeast(d, 2),
    who: guestSpeaker('b_prof', 'Henri Garnier', 'Votre ancien professeur'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `Bonjour, c’est Henri Garnier, votre professeur d’histoire en terminale. J’ai suivi votre vote sur la réforme du lycée. ${mem(d, 'b_livre_publie') > 0 ? 'Vous écriviez pourtant le contraire dans votre livre. ' : mem(d, 'b_chronique') > 0 ? 'Vous écriviez pourtant le contraire dans votre chronique. ' : ''}Je suis déçu. Je croyais vous avoir appris à penser par vous-même.`,
        choices: [
          { id: 'expliquer', label: 'Je vous explique mon vote', effects: [st('energy', -2)], next: 'debat' },
          { id: 'aveu', label: 'Vous avez raison : j’ai suivi la consigne', effects: [st('credibility', 1), st('politicalCapital', -1)], next: 'aveu' },
          { id: 'comptes', label: 'Avec respect, je ne vous dois pas de comptes', effects: [st('stress', -1), st('credibility', -1)], end: 'Peut-être pas à moi. Mais à vos électeurs, si.', later: { months: 6, node: 'tribune' } },
        ],
        ignore: [st('credibility', -1)],
      },
      debat: {
        text: 'Vos arguments se tiennent, je l’admets. Mais mes collègues sont en colère. Accepteriez-vous de venir en parler aux professeurs du lycée ?',
        choices: [
          { id: 'venir', label: 'Je viendrai', effects: [st('energy', -5), dos('education', 3), st('credibility', 2)], remember: { b_prof_reconcilie: 1 }, end: 'Merci. Ce sera musclé, mais honnête.', later: { months: 5, node: 'visite' } },
          { id: 'temps', label: 'Pas le temps, hélas', effects: [st('credibility', -1)], end: 'Je transmettrai. Ils ne seront pas surpris.', later: { months: 6, node: 'tribune' } },
        ],
      },
      aveu: {
        text: 'C’est honnête. Alors réparez : un amendement en seconde lecture corrige le pire. Votez-le.',
        choices: [
          { id: 'voter', label: 'Je le voterai', hint: 'Votre groupe ne va pas aimer', effects: [st('politicalCapital', -3), dos('education', 2), st('credibility', 2)], remember: { b_prof_reconcilie: 1 }, end: 'Voilà l’élève que je connaissais.', later: { months: 5, node: 'visite' } },
          { id: 'groupe', label: 'Je ne peux pas désobéir au groupe', effects: [coh(1), st('credibility', -1)], end: 'Alors je n’ai plus rien à vous apprendre.', later: { months: 6, node: 'tribune' } },
        ],
      },
      tribune: {
        text: 'Bonjour. Je vous préviens par correction : avec trente collègues, nous publions une tribune contre votre vote dans la presse régionale. Votre nom y figure.',
        effects: [st('popularity', -2), seg('cadres', -1), exp(3)],
        choices: [
          { id: 'lettre', label: 'Je réponds par une lettre ouverte', effects: [st('energy', -3), st('credibility', 2)], end: 'Nous la lirons avec attention. C’est déjà ça.' },
          { id: 'silence', label: 'Je ne réponds pas', effects: [st('stress', 2)], end: 'Votre silence sera commenté en salle des profs.' },
        ],
      },
      visite: {
        text: 'Votre venue a marqué les esprits. Deux élèves voudraient faire un stage dans votre équipe. Et moi, je voulais simplement vous dire merci.',
        effects: [st('credibility', 2), seg('jeunes', 2), st('stress', -2)],
        choices: [
          { id: 'stagiaires', label: 'Envoyez-les-moi', effects: [st('energy', -2), seg('jeunes', 1)], end: 'Ils seront ravis. Moi aussi.' },
          { id: 'merci', label: 'Merci à vous, monsieur', effects: [st('stress', -1)], end: 'Continuez à penser par vous-même. C’est tout ce que je demande.' },
        ],
      },
    },
  },

  // ── 10. Votre sœur a besoin d'argent ──
  {
    id: 'b_soeur_argent', weight: 1, eligible: d => rankAtLeast(d, 1),
    who: familySpeaker('Votre sœur'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'C’est moi. Je suis un peu gênée… Ma boutique ne tient plus, j’ai trois mois de loyer en retard. Il me faudrait 4 000 €. Je n’ai personne d’autre à qui demander.',
        choices: [
          { id: 'donner', label: 'Je te les donne', if: d => perso(d) >= 4000, effects: [eur(-4000), st('stress', -1)], remember: { b_soeur_aidee: 1 }, end: 'Merci… Je te rembourserai, promis.', later: { months: 9, node: 'remboursement' } },
          { id: 'moitie', label: 'Je peux t’en prêter la moitié', if: d => perso(d) >= 2000, effects: [eur(-2000)], next: 'moitie' },
          { id: 'solution', label: 'Pas d’argent, mais je t’aide à trouver une solution', effects: [st('energy', -4)], next: 'solution' },
          { id: 'non', label: 'Non. Il faut que tu te débrouilles', effects: [st('stress', 3)], remember: { b_soeur_refus: 1 }, end: 'D’accord. Je pensais pouvoir compter sur toi.', later: { months: 8, node: 'froid' } },
        ],
        ignore: [st('stress', 3)],
      },
      moitie: {
        text: 'La moitié, c’est déjà énorme. Pour le reste… tu crois qu’un de tes contacts pourrait me trouver un local moins cher ?',
        choices: [
          { id: 'mairie', label: 'Je passe un coup de fil à la mairie', hint: 'Le mélange des genres peut se voir', effects: [st('politicalCapital', -1)], remember: { b_soeur_aidee: 1 }, risk: { chance: 0.3, scaleWith: 'credibility', fail: 'favoritisme' }, end: 'Le local est à moi ! Tu m’as sauvée.', later: { months: 9, node: 'remboursement' } },
          { id: 'pas_ca', label: 'Ça, je ne peux pas le faire', effects: [st('credibility', 1), st('stress', 1)], remember: { b_soeur_aidee: 1 }, end: 'Je comprends. Merci déjà pour ça.', later: { months: 9, node: 'remboursement' } },
        ],
      },
      solution: {
        text: 'Une solution ? Tu veux dire quoi, un banquier ? Une association ? Je suis à bout, tu sais.',
        choices: [
          { id: 'banque', label: 'Je t’accompagne à la banque samedi', effects: [st('energy', -4), st('stress', 1)], remember: { b_soeur_aidee: 1 }, end: 'Merci d’être là. Vraiment.', later: { months: 9, node: 'remboursement' } },
          { id: 'asso', label: 'Je te mets en contact avec une association', if: d => hasContact(d, 'association'), effects: [st('energy', -1)], remember: { b_soeur_refus: 1 }, end: 'Ok… Ce n’est pas ce que j’espérais, mais merci.', later: { months: 8, node: 'froid' } },
        ],
      },
      favoritisme: {
        text: 'Catastrophe : un élu d’opposition a appris que la mairie m’avait trouvé un local. Il parle de « passe-droit familial ». Je suis désolée…',
        effects: [st('credibility', -4), exp(4), st('stress', 3)],
        choices: [
          { id: 'transparence', label: 'Tu paieras le loyer normal, et on le dit', effects: [st('credibility', 2), st('energy', -2)], end: 'D’accord. Je paierai le prix normal, tant pis.' },
          { id: 'laisser', label: 'Je laisse dire', effects: [st('credibility', -1), st('stress', 1)], end: 'Si tu le dis… Mais je n’aime pas voir mon nom dans le journal.' },
        ],
      },
      remboursement: {
        text: 'Devine quoi : la boutique repart ! Meilleur trimestre depuis l’ouverture. Je te rembourse une partie ce mois-ci, et je t’invite à dîner.',
        effects: [eur(2000), st('stress', -3)],
        choices: [
          { id: 'diner', label: 'Avec plaisir', effects: [st('energy', 2)], end: 'Samedi, chez moi. Sans téléphone !' },
          { id: 'affiche', label: 'Tu mettrais mon affiche dans ta vitrine ?', effects: [st('popularity', 1), seg('populaires', 1)], end: 'En grand ! Mais tu viens quand même dîner.' },
        ],
      },
      froid: {
        text: 'Je voulais te dire : j’ai fermé la boutique. Je ne t’en veux pas… enfin, si, un peu. Maman est au courant, Noël risque d’être tendu.',
        effects: [st('stress', 4), st('energy', -2)],
        choices: [
          { id: 'parler', label: 'Je suis désolé·e. On en parle ?', effects: [st('energy', -3), st('stress', -2)], end: 'Viens dimanche. On parlera.' },
          { id: 'rebondir', label: 'Je t’aide à rebondir maintenant', if: d => perso(d) >= 1500, effects: [eur(-1500), st('stress', -3)], end: 'Merci. Ça compte beaucoup, même tard.' },
        ],
      },
    },
  },

  // ── 11. Un ami d'enfance veut un emploi ──
  {
    id: 'b_ami_emploi', weight: 1, eligible: d => rankAtLeast(d, 2),
    who: guestSpeaker('b_ami', 'Julien', 'Ami d’enfance'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `Salut toi ! C’est Julien, du collège. Je sais, ça fait longtemps… ${mem(d, 'b_soeur_aidee') > 0 ? 'Ta sœur m’a dit que tu avais aidé sa boutique, alors j’ose. ' : ''}Je suis au chômage depuis un an. Il ne te faudrait pas un assistant, par hasard ? Je ferais n’importe quoi.`,
        choices: [
          { id: 'embaucher', label: 'Je t’embauche à mi-temps', effects: [st('stress', -1), st('credibility', -1)], remember: { b_ami_embauche: 1 }, next: 'embauche' },
          { id: 'recommander', label: 'Je te recommande à un contact', if: d => d.contacts.length > 0, effects: [st('influence', -1), st('energy', -1)], end: 'Tu es génial·e. Je t’envoie mon CV ce soir.', later: { months: 6, node: 'recommande' } },
          { id: 'non', label: 'Je ne mélange pas amitié et travail', effects: [st('credibility', 1), st('stress', 1)], remember: { b_ami_vexe: 1 }, end: 'Je vois. Tu es devenu·e quelqu’un d’important.' },
        ],
        ignore: [st('stress', 1)],
      },
      embauche: {
        text: 'Merci, merci ! Juste une chose : je garde un petit boulot à côté, je ne pourrai pas venir tous les jours. Ça passe ?',
        choices: [
          { id: 'temps_plein', label: 'Non : présence au bureau, comme tout le monde', effects: [st('energy', -1)], end: 'Ok, ok. Je serai là lundi à 9 h.', later: { months: 7, node: 'bilan' } },
          { id: 'arranger', label: 'On s’arrangera', hint: 'Un emploi peu fréquenté, ça se remarque', effects: [{ kind: 'secret', owner: 'player', type: 'emploi_fictif' }, st('stress', 2)], remember: { b_ami_fictif: 1 }, end: 'T’es un·e vrai·e pote.', later: { months: 7, node: 'bilan' } },
        ],
      },
      bilan: {
        text: d => mem(d, 'b_ami_fictif') > 0
          ? 'Salut… Un journaliste m’a appelé : il demande ce que je fais exactement pour toi. Je lui ai dit que je « faisais de la veille ». Il n’avait pas l’air convaincu.'
          : 'Salut ! Petit point après quelques mois : je crois que je ne suis pas fait pour ce boulot. Je rate des réunions, l’équipe m’en veut. Tu me gardes quand même ?',
        effects: [st('stress', 2)],
        choices: [
          { id: 'separer', label: 'Je dois me séparer de toi', effects: [st('credibility', 1), st('stress', 2)], remember: { b_ami_licencie: 1 }, end: 'Je vois. Tu me jettes comme un vieux tract.' },
          { id: 'former', label: 'Je te garde et je te forme', if: d => mem(d, 'b_ami_fictif') <= 0, effects: [st('energy', -4), st('politicalCapital', -1)], end: 'Merci. Je vais faire mes preuves, promis.' },
          { id: 'assumer', label: 'On ne change rien, tu tiens ta version', if: d => mem(d, 'b_ami_fictif') > 0, hint: 'Si le journaliste creuse…', effects: [st('stress', 2)], risk: { chance: 0.5, scaleWith: 'influence', fail: 'scandale' }, end: 'D’accord. Je dirai que je relis tes discours.' },
        ],
      },
      scandale: {
        text: 'L’article est sorti : « Un ami d’enfance payé à ne rien faire ». Je suis désolé, j’ai trop parlé. Qu’est-ce que je fais ?',
        effects: [{ kind: 'secret', owner: 'player', reveal: true, type: 'emploi_fictif' }, st('credibility', -6), exp(6)],
        choices: [
          { id: 'demission', label: 'Tu démissionnes aujourd’hui', effects: [st('credibility', 1)], remember: { b_ami_licencie: 1 }, end: 'Compris. Je disparais. Désolé pour tout.' },
          { id: 'front', label: 'On fait front ensemble', effects: [st('popularity', -2), st('stress', 3)], end: 'Merci de ne pas me lâcher. Je ne l’oublierai pas.' },
        ],
      },
      recommande: {
        text: 'Ton contact m’a pris à l’essai, et je viens de signer un CDI ! Je ne sais pas comment te remercier. Si un jour tu as besoin de bras pour une campagne, je suis là.',
        effects: [st('stress', -2), { kind: 'partyMembers', delta: 1 }],
        choices: [
          { id: 'affiches', label: 'Viens coller des affiches avec nous', effects: [mom(2), st('energy', -1)], end: 'Avec plaisir ! J’amène mon frère.' },
          { id: 'profite', label: 'Profite de ton nouveau boulot', effects: [st('stress', -1)], end: 'Merci, vraiment. À bientôt.' },
        ],
      },
    },
  },

  // ── 12. Un sondeur propose de « soigner » un sondage ──
  {
    id: 'b_sondeur', weight: 1, eligible: d => rankAtLeast(d, 2),
    who: guestSpeaker('b_sondeur', 'Bertrand Mérel', 'Institut de sondage'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Bonjour. Nous réalisons une enquête sur les personnalités préférées des Français. Entre nous, on peut « soigner » la formulation des questions. Pour 15 000 €, vous gagnez cinq points. Et la presse adore les dynamiques.',
        choices: [
          { id: 'comment', label: 'Intéressant. Comment ça marche ?', effects: [st('stress', 1)], next: 'methode' },
          { id: 'non', label: 'Non. Et ne m’appelez plus', effects: [st('credibility', 1)], end: 'Comme vous voudrez. Votre concurrent, lui, n’a pas hésité.', later: { months: 5, node: 'concurrent' } },
          { id: 'signaler', label: 'Je signale votre offre à la commission', effects: [st('energy', -3), st('credibility', 3), st('politicalCapital', -1)], remember: { b_sondeur_denonce: 1 }, end: 'Vous allez le regretter. Ce milieu est petit.', later: { months: 6, node: 'denonce' } },
        ],
      },
      methode: {
        text: 'Simple : on pose la question sur vous juste après un sujet où vous êtes fort·e. Facture « conseil en communication ». Je lance ?',
        choices: [
          { id: 'campagne', label: 'Allez-y, sur les fonds de campagne', if: d => d.player.finances.campaign >= 15000, hint: 'Illégal si ça se sait', effects: [eur(-15000, 'campaign'), st('popularity', 3), mom(4)], remember: { b_sondage_soigne: 1 }, end: 'Vous allez être surpris·e en lisant les journaux jeudi.', later: { months: 6, node: 'controle' } },
          { id: 'perso', label: 'Allez-y, sur mes fonds personnels', if: d => perso(d) >= 15000, hint: 'Illégal si ça se sait', effects: [eur(-15000), st('popularity', 3), mom(4)], remember: { b_sondage_soigne: 1 }, end: 'Vous allez être surpris·e en lisant les journaux jeudi.', later: { months: 6, node: 'controle' } },
          { id: 'renoncer', label: 'Finalement, non', effects: [st('stress', 1)], end: 'Dommage. L’offre ne se représentera pas.', later: { months: 5, node: 'concurrent' } },
        ],
      },
      controle: {
        text: 'Problème : la commission des sondages épluche notre dernière enquête et pose des questions sur la facture « conseil ». Je dirai que vous ne saviez rien, si vous restez discret·e.',
        effects: [st('stress', 4)],
        choices: [
          { id: 'discret', label: 'Restons discrets', effects: [st('stress', 1)], risk: { chance: 0.45, scaleWith: 'influence', fail: 'epingle' }, end: 'Ouf. Ils ont classé l’affaire.' },
          { id: 'avouer', label: 'Je dis tout à la commission', effects: [st('credibility', -2), st('popularity', -2), exp(4)], end: 'Vous me lâchez ? Bravo. On se reverra au tribunal.' },
        ],
      },
      epingle: {
        text: 'La commission publie un communiqué : « enquête biaisée au profit d’un·e élu·e ». Votre nom est partout.',
        effects: [st('credibility', -6), st('popularity', -3), exp(6)],
        choices: [
          { id: 'ignorance', label: 'Je plaide l’ignorance', effects: [st('credibility', -1), st('stress', 3)], end: 'Bonne chance. Moi, je ne dirai rien.' },
          { id: 'reconnaitre', label: 'Je reconnais, et je présente mes excuses', effects: [st('credibility', 2), st('politicalCapital', -2)], end: 'Courageux. Ou suicidaire.' },
        ],
      },
      concurrent: {
        text: 'Vous avez vu le sondage de ce matin ? Votre concurrent a pris six points. Je vous avais prévenu·e. Ma proposition tient toujours, à 20 000 € cette fois.',
        effects: [st('popularity', -2), mom(-3)],
        choices: [
          { id: 'toujours_non', label: 'Toujours non', effects: [st('credibility', 2)], end: 'Les principes, ça ne fait pas gagner d’élections.' },
          { id: 'presse', label: 'Je raconte vos pratiques à la presse', if: d => hasContact(d, 'journaliste'), effects: [st('energy', -3), st('credibility', 2), st('influence', 1)], remember: { b_sondeur_denonce: 1 }, end: 'Vous n’avez aucune preuve. Bonne journée.' },
        ],
      },
      denonce: {
        text: 'La commission a ouvert une enquête sur notre institut, grâce à vous. Sachez que tous les instituts se parlent : vos chiffres risquent d’être moins flatteurs pendant un moment.',
        effects: [st('credibility', 3), st('popularity', -2)],
        choices: [
          { id: 'electeurs', label: 'Les électeurs jugeront', effects: [st('stress', 1)], end: 'Les électeurs lisent les sondages.' },
          { id: 'loi', label: 'Je fais campagne pour mieux encadrer les sondages', effects: [dos('justice', 2), st('politicalCapital', -2)], end: 'Vous perdez votre temps.' },
        ],
      },
    },
  },

  // ── 13. Un éditeur veut votre livre ──
  {
    id: 'b_editeur_livre', weight: 1, eligible: d => rankAtLeast(d, 2),
    who: guestSpeaker('b_editeur', 'Claire Vasseur', 'Éditrice'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Bonjour ! Je dirige une collection d’essais politiques. Je vous verrais bien en livre : votre parcours, vos idées, un titre fort. 8 000 € d’à-valoir. Qu’en dites-vous ?',
        choices: [
          { id: 'fond', label: 'J’écris moi-même, sur le fond', hint: 'Des soirées entières', effects: [eur(8000), st('energy', -5), st('stress', 2)], remember: { b_livre_publie: 1 }, end: 'Parfait. Je vous laisse huit mois.', later: { months: 8, node: 'sortie_fond' } },
          { id: 'plume', label: 'Avec une plume, et des confidences', effects: [eur(4000), st('energy', -1)], next: 'plume' },
          { id: 'comptes', label: 'Un livre pour régler mes comptes', effects: [eur(8000), st('energy', -3)], remember: { b_livre_publie: 1, b_livre_regle: 1 }, end: 'Ah, ça, ça se vend ! Je vous prépare une belle couverture.', later: { months: 8, node: 'sortie_comptes' } },
          { id: 'non', label: 'Pas le moment', effects: [st('influence', -1)], end: 'Je garde votre numéro. Les livres arrivent toujours au bon moment… ou trop tard.' },
        ],
      },
      plume: {
        text: 'Ma plume est excellente : elle a écrit pour deux anciens ministres. Il faudra tout lui raconter… y compris des choses que vous n’aimeriez pas lire imprimées.',
        choices: [
          { id: 'confiance', label: 'Je lui fais confiance', hint: 'Les plumes parlent parfois en dîner', effects: [st('energy', -2)], remember: { b_livre_publie: 1 }, risk: { chance: 0.35, scaleWith: 'influence', fail: 'indiscretion' }, end: 'Parfait. Sortie dans huit mois.', later: { months: 8, node: 'sortie_fond' } },
          { id: 'relire', label: 'Je relis tout, ligne à ligne', effects: [st('energy', -4)], remember: { b_livre_publie: 1 }, end: 'Ce sera plus long, mais plus sûr. Sortie dans huit mois.', later: { months: 8, node: 'sortie_fond' } },
        ],
      },
      indiscretion: {
        text: 'Ennui : la plume a raconté dans un dîner ce que vous lui avez confié sur la direction de votre parti. C’est remonté jusqu’en haut.',
        effects: [st('politicalCapital', -4), coh(-2), st('stress', 3)],
        choices: [
          { id: 'expliquer', label: 'J’appelle la direction pour m’expliquer', effects: [st('energy', -3), st('politicalCapital', 1)], end: 'Bon courage. Le livre, lui, continue.' },
          { id: 'renoncer', label: 'Je renonce au livre', effects: [eur(-4000), st('stress', -2)], remember: { b_livre_publie: -1 }, end: 'Je comprends. Vous rembourserez l’à-valoir, bien sûr.' },
        ],
      },
      sortie_fond: {
        text: 'Le livre sort demain ! Les premières critiques sont bonnes : « sérieux, documenté ». Ce ne sera pas un best-seller, mais on vous prend au sérieux.',
        effects: [st('credibility', 4), st('influence', 2)],
        choices: [
          { id: 'tournee', label: 'Je fais la tournée des librairies', effects: [st('energy', -5), st('popularity', 2), seg('cadres', 2)], end: 'Les libraires vous adorent. On réimprime !' },
          { id: 'seul', label: 'Je laisse le livre vivre sa vie', effects: [st('stress', -1)], end: 'Il fera son chemin, doucement.' },
        ],
      },
      sortie_comptes: {
        text: 'C’est un carton : 40 000 exemplaires ! Mais trois personnalités de votre camp menacent de vous poursuivre, et le groupe parle de sanctions.',
        effects: [st('popularity', 3), exp(5), coh(-3), st('politicalCapital', -4), eur(5000)],
        choices: [
          { id: 'assumer', label: 'J’assume chaque ligne', effects: [st('influence', 3), { kind: 'faction', factionId: '*', delta: -2 }], end: 'Le tome 2 est déjà commandé.' },
          { id: 'edulcorer', label: 'J’édulcore la réédition', effects: [st('credibility', -2), st('politicalCapital', 2)], end: 'Dommage, c’était le meilleur passage.' },
        ],
      },
    },
  },

  // ── 14. Un hacker prétend avoir vos mails ──
  {
    id: 'b_hacker', weight: 0.5, eligible: d => rankAtLeast(d, 2),
    who: guestSpeaker('b_hacker', 'Numéro inconnu', 'Inconnu'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => {
          const indice = mem(d, 'b_sondage_soigne') > 0 ? 'Vos échanges avec un institut de sondage sont… instructifs.'
            : mem(d, 'b_voyage_accepte') > 0 ? 'Les photos de Lisbonne sont jolies.'
            : 'Certains échanges avec votre équipe sont savoureux.';
          return `Bonsoir. J’ai accès à votre messagerie depuis trois semaines. ${indice} 5 000 € en cryptomonnaie et tout disparaît. Vous avez 48 heures.`;
        },
        choices: [
          { id: 'preuve', label: 'Prouvez-le', effects: [st('stress', 2)], next: 'preuve' },
          { id: 'payer', label: 'Je paie', if: d => perso(d) >= 5000, effects: [eur(-5000), st('stress', -1)], remember: { b_hacker_paye: 1 }, end: 'Sage décision. Au plaisir.', later: { months: 4, node: 'rechute' } },
          { id: 'plainte', label: 'Je porte plainte immédiatement', effects: [st('energy', -3), st('credibility', 1)], next: 'plainte' },
        ],
        ignore: [st('stress', 3)],
      },
      preuve: {
        text: 'Voici l’objet d’un de vos mails du mois dernier : « Re: point d’étape, NE PAS DIFFUSER ». Convaincu·e ? Le prix vient de passer à 7 000 €.',
        choices: [
          { id: 'bluff', label: 'Tout le monde a ce genre de mail. Bluff', hint: 'S’il a vraiment vos mails…', effects: [st('stress', 2)], risk: { chance: 0.4, scaleWith: 'influence', fail: 'publie' }, end: 'Vous êtes plus coriace que prévu. Je passe à quelqu’un d’autre.' },
          { id: 'payer', label: 'Je paie, mais c’est la dernière fois', if: d => perso(d) >= 7000, effects: [eur(-7000)], remember: { b_hacker_paye: 1 }, end: 'Bien sûr. La dernière fois.', later: { months: 4, node: 'rechute' } },
          { id: 'securiser', label: 'Je change mes mots de passe et je porte plainte', effects: [st('energy', -4), eur(-800)], next: 'plainte' },
        ],
      },
      plainte: {
        text: 'Une plainte ? Amusant. Les gendarmes vont fouiller votre messagerie avant moi. Vous êtes sûr·e de vouloir qu’ils lisent tout ?',
        choices: [
          { id: 'rien_a_cacher', label: 'Oui. Je n’ai rien à cacher', effects: [st('credibility', 3), st('stress', 2), st('energy', -2)], end: '… Bon. Vous n’entendrez plus parler de moi.', later: { months: 5, node: 'arrestation' } },
          { id: 'retirer', label: 'Vous avez gagné, je paie', if: d => perso(d) >= 5000, effects: [eur(-5000), st('credibility', -1)], remember: { b_hacker_paye: 1 }, end: 'Ah, voilà qui est raisonnable.', later: { months: 4, node: 'rechute' } },
        ],
      },
      publie: {
        text: 'Vous l’aurez voulu. Une dizaine de vos mails circulent sur un forum. Rien d’illégal, mais vos commentaires sur certains collègues sont… savoureux.',
        effects: [st('credibility', -3), st('politicalCapital', -4), exp(5), coh(-2)],
        choices: [
          { id: 'excuses', label: 'Je présente mes excuses aux collègues', effects: [st('energy', -3), st('politicalCapital', 2)], end: 'Touchant. Bonne chance.' },
          { id: 'denoncer', label: 'Je dénonce un piratage criminel', effects: [st('credibility', 1), st('popularity', 1), dos('numerique', 1)], end: 'Dénoncez. Le mal est fait.' },
        ],
      },
      rechute: {
        text: 'Rebonjour. J’ai gardé une copie, évidemment. 10 000 € cette fois. On ne se débarrasse jamais vraiment de moi.',
        effects: [st('stress', 5)],
        choices: [
          { id: 'police', label: 'Cette fois, je vais à la police', effects: [st('energy', -3), st('credibility', -2), exp(2)], end: 'Avec votre premier virement sur votre relevé ? Bon courage pour l’expliquer.' },
          { id: 'repayer', label: 'Je paie encore', if: d => perso(d) >= 10000, effects: [eur(-10000), st('stress', 2)], end: 'Toujours un plaisir.' },
        ],
      },
      arrestation: {
        text: 'Gendarmerie nationale, cellule cyber : ce numéro a été saisi. L’auteur des menaces a été interpellé ; il visait une quinzaine d’élus. Votre plainte a été décisive.',
        effects: [st('credibility', 3), st('stress', -4), exp(2)],
        choices: [
          { id: 'saluer', label: 'Je salue publiquement les enquêteurs', effects: [st('popularity', 2), dos('securite', 1)], end: 'Merci pour eux.' },
          { id: 'loi', label: 'Je propose un texte sur la cybersécurité des élus', effects: [dos('numerique', 3), st('politicalCapital', -2), st('energy', -2)], end: 'Bonne initiative. Nous restons à votre disposition.' },
        ],
      },
    },
  },

  // ── 15. Une ONG vous demande de parrainer une campagne ──
  {
    id: 'b_ong_campagne', weight: 1, eligible: d => rankAtLeast(d, 1) && hasContact(d, 'association'),
    who: contactSpeaker('association'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Bonjour ! Notre ONG lance une grande campagne contre le gaspillage alimentaire. Il nous faut un parrain ou une marraine politique : votre visage sur les affiches, quelques déplacements. Vous êtes partant·e ?',
        choices: [
          { id: 'parrainer', label: 'Je parraine, avec plaisir', effects: [st('popularity', 2), st('energy', -4), ct(5), dos('ecologie', 2)], remember: { b_parrain_ong: 1 }, next: 'details' },
          { id: 'don', label: 'Je fais un don, sans apparaître', if: d => perso(d) >= 1000, effects: [eur(-1000), ct(3)], end: 'C’est généreux. On vous remerciera… discrètement.' },
          { id: 'non', label: 'Je ne m’associe à aucune ONG', effects: [ct(-4), st('credibility', 1)], end: 'Dommage. On cherchera ailleurs.' },
        ],
        ignore: [ct(-2)],
      },
      details: {
        text: d => mem(d, 'b_amendement_lobby') > 0
          ? 'Super ! Petit détail gênant : nos militants ont remarqué que vous aviez déposé l’amendement de la fédération portuaire. Certains trouvent votre parrainage incohérent.'
          : 'Super ! Notre tournée passe par les marchés et les cantines scolaires. Il y aura aussi une action devant un supermarché qui jette encore ses invendus.',
        choices: [
          { id: 'tournee', label: 'Je ferai toute la tournée', if: d => mem(d, 'b_amendement_lobby') <= 0, effects: [st('energy', -5), seg('populaires', 2), seg('ruraux', 1)], end: 'Génial ! On commence samedi au marché.', later: { months: 6, node: 'bilan' } },
          { id: 'pas_commerce', label: 'Pas d’action devant un commerce', if: d => mem(d, 'b_amendement_lobby') <= 0, effects: [ct(-2), seg('cadres', 1)], end: 'On comprend. On vous gardera pour les cantines.', later: { months: 6, node: 'bilan' } },
          { id: 'expliquer', label: 'Je m’explique devant vos militants', if: d => mem(d, 'b_amendement_lobby') > 0, hint: 'Ils peuvent voter votre départ', effects: [st('energy', -3)], risk: { chance: 0.4, scaleWith: 'credibility', fail: 'retrait' }, end: 'Ils ont apprécié la franchise. Vous restez notre parrain·e.', later: { months: 6, node: 'bilan' } },
          { id: 'retirer', label: 'Je préfère me retirer', if: d => mem(d, 'b_amendement_lobby') > 0, effects: [ct(-2), st('popularity', -1)], end: 'C’est peut-être plus sage. Merci quand même.' },
        ],
      },
      retrait: {
        text: 'Désolée, nos militants ont voté : ils ne veulent plus de vous comme parrain·e. On le dira sobrement dans un communiqué.',
        effects: [st('credibility', -3), exp(3), ct(-4)],
        choices: [
          { id: 'respecter', label: 'Je respecte leur choix', effects: [st('credibility', 1)], end: 'Merci pour votre élégance.' },
          { id: 'erreur', label: 'C’est une erreur', effects: [st('stress', 2)], end: 'Peut-être. Mais c’est leur décision.' },
        ],
      },
      bilan: {
        text: 'La campagne est un succès : 300 tonnes de nourriture sauvées, et une proposition de loi rédigée par nos juristes. Vous pourriez la porter ?',
        effects: [st('popularity', 2), ct(3), dos('ecologie', 1)],
        choices: [
          { id: 'deposer', label: 'Je la porte', if: d => rankAtLeast(d, 2), effects: [st('politicalCapital', -3), dos('ecologie', 3), seg('jeunes', 2)], end: 'Merci ! On mobilise nos adhérents pour la séance.' },
          { id: 'transmettre', label: 'Je la transmets à un collègue mieux placé', effects: [st('influence', 1), ct(-1)], end: 'Pourquoi pas. Pourvu qu’elle avance.' },
        ],
      },
    },
  },

  // ── 16. Un responsable religieux veut être reçu ──
  {
    id: 'b_culte_audience', weight: 1, eligible: d => rankAtLeast(d, 1) && hasContact(d, 'culte'),
    who: contactSpeaker('culte'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `Bonjour. ${mem(d, 'b_parrain_ong') > 0 ? 'Nous avons vu votre engagement contre le gaspillage alimentaire. ' : ''}Notre communauté tient un local d’entraide où nous servons des repas chaque soir, à tous ceux qui en ont besoin. Il doit fermer pour des travaux de mise aux normes que nous ne pouvons pas payer. Accepteriez-vous de me recevoir ?`,
        choices: [
          { id: 'recevoir', label: 'Je vous reçois à ma permanence', effects: [st('energy', -2), ct(4)], next: 'reunion' },
          { id: 'orienter', label: 'Je vous oriente vers les services sociaux', effects: [ct(-3), st('energy', 1)], end: 'Nous les avons déjà vus. Merci quand même.', later: { months: 5, node: 'fermeture' } },
          { id: 'table', label: 'Je réunis tous les acteurs de l’entraide', hint: 'Cultes et associations, autour d’une table', effects: [st('energy', -5), st('credibility', 2), ct(2), dos('social', 2)], remember: { b_table_cultes: 1 }, end: 'Une belle idée. Nous y serons.', later: { months: 4, node: 'table' } },
        ],
        ignore: [ct(-3)],
      },
      reunion: {
        text: 'Merci de nous recevoir. Les travaux coûtent 40 000 €. La mairie hésite : financer un local tenu par une communauté religieuse, ça fait débat. Que pouvez-vous faire ?',
        choices: [
          { id: 'subvention', label: 'Je défends une aide à l’activité alimentaire', hint: 'L’action sociale peut être aidée, pas le culte', effects: [st('politicalCapital', -3), dos('social', 2), ct(5), seg('populaires', 2)], remember: { b_aide_culte: 1 }, end: 'Merci. Nous n’oublierons pas votre soutien.', later: { months: 6, node: 'inauguration' } },
          { id: 'association', label: 'Je vous aide à créer une association distincte', effects: [st('energy', -4), st('credibility', 2), ct(3)], end: 'C’est plus long, mais plus solide. Merci.', later: { months: 6, node: 'inauguration' } },
          { id: 'rien', label: 'Je ne peux rien faire, désolé·e', effects: [ct(-4)], end: 'Nous continuerons à chercher.', later: { months: 5, node: 'fermeture' } },
        ],
      },
      fermeture: {
        text: 'Le local a fermé la semaine dernière. Deux cents personnes n’ont plus de repas le soir, et les autres associations sont débordées.',
        effects: [seg('populaires', -2), st('stress', 2), dos('social', -1)],
        choices: [
          { id: 'collecte', label: 'Je lance une collecte', effects: [st('energy', -4), eur(-500), seg('populaires', 2), ct(3)], end: 'Merci. Chaque repas compte.' },
          { id: 'prefet', label: 'J’alerte le préfet', effects: [st('politicalCapital', -1), dos('social', 1)], end: 'Espérons qu’il vous entende.' },
        ],
      },
      inauguration: {
        text: 'Le local rouvre samedi, aux normes ! Nous aimerions que vous coupiez le ruban, avec les bénévoles et les habitants du quartier.',
        effects: [seg('populaires', 2), ct(3), st('popularity', 1)],
        choices: [
          { id: 'venir', label: 'J’y serai', effects: [st('energy', -2), st('popularity', 2), exp(2)], end: 'Merci. Les bénévoles seront heureux de vous voir.' },
          { id: 'retrait', label: 'Je préfère rester en retrait', effects: [st('credibility', 1)], end: 'Nous comprenons. Vous serez toujours le bienvenu ici.' },
        ],
      },
      table: {
        text: 'La table ronde a réuni six communautés et quatre associations. Elles proposent de mutualiser une cuisine centrale, si la ville prête un bâtiment.',
        effects: [st('credibility', 2), dos('social', 2)],
        choices: [
          { id: 'batiment', label: 'Je plaide pour le bâtiment', effects: [st('politicalCapital', -3), seg('populaires', 3)], end: 'Si vous y arrivez, ce sera une première dans la région.' },
          { id: 'mairie', label: 'Je laisse la mairie décider', effects: [ct(-2), st('energy', 1)], end: 'Nous attendrons sa réponse. Avec patience.' },
        ],
      },
    },
  },

  // ── 17. Un banquier propose un prêt avantageux ──
  {
    id: 'b_banquier_pret', weight: 1, eligible: d => rankAtLeast(d, 2),
    who: guestSpeaker('b_banquier', 'Édouard Lassalle', 'Banque privée'),
    start: 'debut',
    nodes: {
      debut: {
        call: true,
        text: 'Bonjour. Je m’occupe des clients particuliers de notre banque privée. Votre projet immobilier m’intéresse : je peux vous proposer 30 000 € à un taux… disons amical. Aucune contrepartie, bien sûr.',
        choices: [
          { id: 'accepter', label: 'J’accepte', effects: [{ kind: 'loan', amount: 30000, total: 30300, lender: 'Banque privée' }], remember: { b_pret_banque: 1 }, next: 'dejeuner' },
          { id: 'normal', label: 'Au taux normal, alors', effects: [{ kind: 'loan', amount: 30000, total: 33000, lender: 'Banque privée' }, st('credibility', 1)], end: 'Comme vous voudrez… Vous êtes bien scrupuleux·se.' },
          { id: 'non', label: 'Non merci', effects: [st('stress', 1)], end: 'Ma porte reste ouverte.' },
        ],
      },
      dejeuner: {
        text: 'Parfait. Notre président aimerait déjeuner avec vous le mois prochain. Il suit de très près le projet de taxe sur les transactions financières.',
        choices: [
          { id: 'oui', label: 'Avec plaisir', effects: [st('energy', -2), dos('economie', 1)], remember: { b_dejeuner_banque: 1 }, end: 'Il sera ravi.', later: { months: 5, node: 'vote' } },
          { id: 'non', label: 'Je ne déjeune pas avec les banques', effects: [st('credibility', 1)], end: 'Bien sûr. Je transmettrai.', later: { months: 6, node: 'vote' } },
        ],
      },
      vote: {
        text: d => `${mem(d, 'b_dejeuner_banque') > 0 ? 'Merci encore pour ce déjeuner. ' : ''}La taxe sur les transactions passe en séance la semaine prochaine. Nous comptons sur votre abstention, au minimum. Je rappelle que votre taux est révisable chaque année.`,
        effects: [st('stress', 3)],
        choices: [
          { id: 'abstention', label: 'Je m’abstiendrai', effects: [st('credibility', -3), dos('economie', -1)], remember: { b_abstention_banque: 1 }, end: 'Merci de votre compréhension.' },
          { id: 'pour', label: 'Je voterai pour la taxe', effects: [st('credibility', 2), eur(-1500)], end: 'Votre taux sera revu. Rien de personnel.' },
          { id: 'denoncer', label: 'Je dénonce cette pression publiquement', hint: 'Votre propre prêt pourrait se retourner contre vous', effects: [st('credibility', 3), exp(4)], risk: { chance: 0.4, scaleWith: 'credibility', fail: 'retourne' }, end: 'Vous n’avez aucune preuve écrite. Mais soit.' },
        ],
        ignore: [st('credibility', -1)],
      },
      retourne: {
        text: 'Notre service juridique rappelle que vous avez accepté un taux préférentiel. La presse s’y intéresse maintenant… à vous.',
        effects: [st('credibility', -5), exp(5)],
        choices: [
          { id: 'publier', label: 'Je publie le contrat de prêt', effects: [st('credibility', 2), st('stress', 2)], end: 'Transparence… C’est votre choix.' },
          { id: 'taire', label: 'Je me tais', effects: [st('stress', 3)], end: 'Sage. Tout finit par se tasser.' },
        ],
      },
    },
  },

  // ── 18. Une documentariste veut vous suivre ──
  {
    id: 'b_documentariste', weight: 1, eligible: d => rankAtLeast(d, 2),
    who: guestSpeaker('b_docu', 'Inès Moreau', 'Documentariste'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Bonjour ! Je prépare un documentaire pour une grande chaîne : un an dans la vie d’un·e élu·e, sans fard. Je voudrais vous suivre partout, réunions comprises. Ce genre de film fait une carrière… ou la défait.',
        choices: [
          { id: 'total', label: 'Accès total', effects: [exp(4), st('stress', 3)], remember: { b_docu_total: 1 }, next: 'tournage' },
          { id: 'regard', label: 'Oui, avec un droit de regard au montage', effects: [st('energy', -2)], next: 'regard' },
          { id: 'non', label: 'Non, ma vie n’est pas un spectacle', effects: [st('influence', -1)], end: 'Je comprends. Je suivrai quelqu’un d’autre… peut-être un de vos rivaux.' },
        ],
      },
      tournage: {
        text: 'Premier mois de tournage. Votre équipe est tendue devant la caméra. Hier, j’ai filmé une dispute entre vous et un collaborateur. Je peux la garder ?',
        choices: [
          { id: 'garder', label: 'Gardez tout, c’est la vérité', effects: [{ kind: 'team', morale: -3, all: true }, st('credibility', 1)], end: 'Merci. Ce sera un grand film.', later: { months: 10, node: 'projection' } },
          { id: 'couper', label: 'Coupez cette scène, s’il vous plaît', effects: [st('stress', -1), st('energy', -1)], end: 'D’accord. Mais vous me devez une vraie scène forte.', later: { months: 10, node: 'projection' } },
        ],
      },
      regard: {
        text: 'Un droit de regard ? La chaîne déteste ça. Je peux vous montrer le film avant diffusion, sans droit de coupe. C’est mon dernier mot.',
        choices: [
          { id: 'ok', label: 'D’accord', effects: [exp(3), st('stress', 1)], end: 'Parfait. On commence lundi.', later: { months: 10, node: 'projection' } },
          { id: 'stop', label: 'Alors on arrête là', effects: [st('stress', -1), st('influence', -1)], end: 'Dommage, vous aviez une vraie présence à l’écran.' },
        ],
      },
      projection: {
        text: d => mem(d, 'b_docu_total') > 0
          ? 'Le film est fini. Il est dur, et honnête : on vous voit fatigué·e, en colère, mais convaincu·e. Projection de presse jeudi. Les gens vont vous aimer… ou vous détester.'
          : 'Le film est fini. Il est plus sage que prévu, mais il vous montre au travail, sans fard. La chaîne le programme en première partie de soirée.',
        effects: [exp(5), st('popularity', 2)],
        choices: [
          { id: 'projection', label: 'Je viens à la projection', hint: 'Les journalistes guettent la scène qui fâche', effects: [st('energy', -2), st('popularity', 2), seg('jeunes', 2)], risk: { chance: 0.35, scaleWith: 'popularity', fail: 'polemique' }, end: 'Salle debout à la fin. Vous avez gagné des milliers d’électeurs.' },
          { id: 'discret', label: 'Je reste discret·e pendant la diffusion', effects: [st('stress', -1)], end: 'Le film parle pour vous. Merci pour cette année.' },
        ],
      },
      polemique: {
        text: 'Une scène fait polémique : on vous entend traiter un électeur de « casse-pieds », micro ouvert. Ça tourne en boucle sur les réseaux.',
        effects: [st('popularity', -5), st('credibility', -3), exp(4)],
        choices: [
          { id: 'excuses', label: 'Je m’excuse auprès de l’électeur', effects: [st('energy', -2), st('popularity', 2)], end: 'Il a accepté vos excuses en direct. Joli rattrapage.' },
          { id: 'humain', label: 'Ça s’appelle être humain', effects: [seg('jeunes', 1), seg('retraites', -2)], end: 'Une partie du public vous donne raison. L’autre, non.' },
        ],
      },
    },
  },

  // ── 19. Un ancien collaborateur licencié menace de parler ──
  {
    id: 'b_ex_collab', weight: 1,
    eligible: d => rankAtLeast(d, 2) && (d.player.team.length > 0 || mem(d, 'b_ami_licencie') > 0),
    who: d => mem(d, 'b_ami_licencie') > 0
      ? guestSpeaker('b_ami', 'Julien', 'Ami d’enfance')(d)
      : guestSpeaker('b_excollab', 'Sébastien Royer', 'Ancien collaborateur')(d),
    start: 'debut',
    nodes: {
      debut: {
        text: d => mem(d, 'b_ami_licencie') > 0
          ? 'C’est Julien. Depuis que tu m’as viré, je n’ai rien retrouvé. J’en ai vu, des choses, dans ton bureau. Un journaliste me propose de raconter. Je ne sais pas encore ce que je vais faire.'
          : 'Bonjour, c’est Sébastien. Licencié en deux phrases après trois ans de soirées au bureau, vous vous souvenez ? Un journaliste me propose de raconter les coulisses. J’hésite encore.',
        choices: [
          { id: 'demande', label: 'Quelle est la demande ?', effects: [st('stress', 1)], next: 'demande' },
          { id: 'menace', label: 'Aucune menace ne marche avec moi', hint: 'Risqué : il n’a plus rien à perdre', effects: [st('stress', 2)], risk: { chance: 0.5, scaleWith: 'influence', fail: 'temoignage' }, end: d => mem(d, 'b_ami_licencie') > 0 ? 'Tu as raison, je ne suis pas comme ça. Je me tais.' : 'Soit. Je ne parlerai pas… pour cette fois.' },
          { id: 'emploi', label: 'Je peux aider à retrouver un emploi', if: d => d.contacts.length > 0, effects: [st('influence', -2), st('politicalCapital', -1)], end: 'C’est… inattendu. D’accord, j’attends votre appel.', later: { months: 5, node: 'nouvel_emploi' } },
        ],
        ignore: [exp(2), st('credibility', -2)],
      },
      demande: {
        text: 'Six mois de salaire en « indemnité transactionnelle », et une lettre de recommandation élogieuse. Après, j’oublie tout.',
        choices: [
          { id: 'payer', label: 'Une indemnité, et un accord de confidentialité', if: d => perso(d) >= 6000, effects: [eur(-6000), st('stress', -2)], remember: { b_collab_achete: 1 }, end: 'Marché conclu. Bonne continuation.', later: { months: 9, node: 'reparle' } },
          { id: 'lettre', label: 'La lettre, oui. L’argent, non', effects: [st('credibility', -1)], risk: { chance: 0.35, scaleWith: 'credibility', fail: 'temoignage' }, end: 'Va pour la lettre. Je m’en contenterai.' },
          { id: 'rien', label: 'Rien du tout, je n’ai rien à cacher', effects: [st('credibility', 1)], next: 'temoignage' },
        ],
      },
      temoignage: {
        text: 'L’article est en ligne : « Dans les coulisses d’un bureau toxique ». Horaires impossibles, colères, notes de frais limites. Les réseaux s’en donnent à cœur joie.',
        effects: [st('credibility', -4), st('popularity', -3), exp(5), { kind: 'team', morale: -3, all: true }],
        choices: [
          { id: 'reconnaitre', label: 'Je reconnais des erreurs de management', effects: [st('credibility', 2), st('energy', -2)], end: 'Au moins, c’est dit.' },
          { id: 'vengeance', label: 'Je dénonce une vengeance', effects: [st('popularity', 1), st('credibility', -1), st('stress', 2)], end: 'La presse adorera la suite.' },
        ],
      },
      nouvel_emploi: {
        text: d => mem(d, 'b_ami_licencie') > 0
          ? 'J’ai signé un contrat grâce à ton coup de fil. On est quittes. Et… merci. Je n’ai jamais rappelé le journaliste.'
          : 'J’ai signé un contrat grâce à votre recommandation. Nous sommes quittes. Je n’ai jamais rappelé le journaliste.',
        effects: [st('stress', -3), st('credibility', 1)],
        choices: [
          { id: 'route', label: 'Bonne route', effects: [st('energy', 1)], end: 'Merci. Bonne route à vous aussi.' },
        ],
      },
      reparle: {
        text: 'Le journaliste est revenu à la charge, avec une offre plus grosse. Notre accord tient… mais il dit qu’un silence payé, c’est déjà une information.',
        effects: [st('stress', 4), exp(2)],
        choices: [
          { id: 'clause', label: 'La clause de confidentialité s’applique', effects: [eur(-1000)], risk: { chance: 0.4, scaleWith: 'influence', fail: 'temoignage' }, end: 'D’accord. Je ne dirai rien.' },
          { id: 'devants', label: 'Je prends les devants et j’en parle moi-même', effects: [st('credibility', -1), exp(3), st('stress', -2)], end: 'Malin. Il n’y a plus de scoop.' },
        ],
      },
    },
  },

  // ── 20. Un patron de presse propose une chronique ──
  {
    id: 'b_patron_presse', weight: 1, eligible: d => rankAtLeast(d, 2) && d.player.stats.influence >= 30,
    who: guestSpeaker('b_patron', 'Gérald Montfort', 'Patron de presse'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => {
          const intro = mem(d, 'b_off_journaliste') > 0 ? 'Une de mes journalistes dit que vous comprenez comment fonctionne la presse. '
            : mem(d, 'b_menace_presse') > 0 ? 'On me dit que vous avez menacé une de mes journalistes. J’aime les gens qui ont du caractère. '
            : '';
          return `Bonjour. Mon groupe possède un quotidien national et deux radios. ${intro}J’aimerais vous confier une chronique hebdomadaire en page Débats. Liberté totale, évidemment.`;
        },
        choices: [
          { id: 'accepter', label: 'J’accepte', effects: [st('influence', 3), st('credibility', 2), st('energy', -4)], remember: { b_chronique: 1 }, next: 'regles' },
          { id: 'plume', label: 'Je propose une plume de mon équipe', if: d => d.player.team.length > 0, effects: [st('influence', 1), { kind: 'team', morale: 2, all: true }], end: 'Hmm. Ce n’est pas vous que mes lecteurs veulent lire. Mais soit, à l’essai.' },
          { id: 'refuser', label: 'Un élu ne doit pas dépendre d’un patron de presse', effects: [st('credibility', 2), st('influence', -1)], end: 'Très noble. Mes éditorialistes s’en souviendront.', later: { months: 6, node: 'edito' } },
        ],
      },
      regles: {
        text: 'Parfait. Une seule règle tacite : on évite de parler de la concentration des médias. C’est mon métier, vous comprenez.',
        choices: [
          { id: 'entendu', label: 'Entendu', effects: [st('credibility', -2)], remember: { b_chronique_docile: 1 }, end: 'Bienvenue dans la maison.', later: { months: 6, node: 'loi' } },
          { id: 'libre', label: 'Je parlerai de ce que je veux', hint: 'Il pourrait vous remercier vite', effects: [st('credibility', 2)], risk: { chance: 0.45, scaleWith: 'influence', fail: 'remercie' }, end: 'Vous avez du cran. Je ferai avec.', later: { months: 6, node: 'loi' } },
        ],
      },
      remercie: {
        text: 'Finalement, la direction de la rédaction préfère « faire tourner les plumes ». Votre chronique s’arrête après trois numéros. Rien de personnel.',
        effects: [st('influence', -2), exp(2)],
        choices: [
          { id: 'raconter', label: 'Je raconte pourquoi dans un autre journal', effects: [st('credibility', 3), st('stress', 2)], end: 'Ce serait une erreur. Mais vous êtes libre.' },
          { id: 'page', label: 'Je tourne la page', effects: [st('stress', -1)], end: 'Sage décision. Sans rancune.' },
        ],
      },
      loi: {
        text: d => `Une proposition de loi contre la concentration des médias arrive en commission. ${mem(d, 'b_chronique_docile') > 0 ? 'Vous avez été discret·e sur le sujet jusqu’ici, j’apprécie. J’aimerais que vous votiez contre.' : 'Je sais ce que vous en pensez. Mais votre chronique a besoin d’un journal pour exister.'}`,
        effects: [st('stress', 2)],
        choices: [
          { id: 'contre', label: 'Je voterai contre', effects: [st('credibility', -4), st('influence', 2)], end: 'Je n’en attendais pas moins.' },
          { id: 'pour', label: 'Je voterai pour, et j’arrête la chronique', effects: [st('credibility', 4), st('influence', -3)], remember: { b_chronique: -1 }, end: 'Votre dernière chronique paraîtra dimanche.' },
          { id: 'ecrire', label: 'Je m’abstiens, et j’écris sur le sujet', if: d => d.player.stats.influence >= 45, effects: [st('credibility', 1), st('energy', -3), exp(3)], end: 'Audacieux. On verra si mes lecteurs suivent.' },
        ],
      },
      edito: {
        text: 'Vous avez vu l’éditorial de ce matin ? « Ces élus qui méprisent la presse ». Ce n’est pas moi qui l’ai écrit, bien sûr.',
        effects: [st('popularity', -2), st('credibility', -1), exp(3)],
        choices: [
          { id: 'tribune', label: 'Je réponds par une tribune ailleurs', effects: [st('energy', -2), st('credibility', 2)], end: 'La concurrence vous remercie.' },
          { id: 'entretien', label: 'Je vous propose un entretien, finalement', effects: [st('influence', 1), st('credibility', -1)], end: 'Voilà qui est raisonnable. Ma rédaction vous appelle.' },
        ],
      },
    },
  },
];

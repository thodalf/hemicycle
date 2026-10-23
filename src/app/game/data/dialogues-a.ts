import { DialogueDef, chiefSpeaker, contactSpeaker, familySpeaker, guestSpeaker, mem, rankAtLeast, st, teamSpeaker } from './dialogue-types';
import type { ContactType, Effect, GameState, Segment, StaffRole } from '../models/game.models';

/* ============================================================
 *  Conversations à embranchements (voir dialogue-types.ts).
 *  Lot A : les débuts et la vie de terrain — militant·e,
 *  conseiller·e municipal·e, député·e.
 *
 *  Mémoire partagée entre les conversations du lot (mem_a_…) :
 *   a_pacte_maire, a_maire_ennemi, a_maire_trace, a_promesse_quartier,
 *   a_terrasse_faveur, a_julien_allie, a_julien_ecrase, a_caisse_couverte,
 *   a_caisse_papier, a_caisse_denoncee, a_voisin_antenne, a_alliance_ferrand,
 *   a_ruraux_promesse, a_ecole_mobilisee, a_promoteur_dette, a_promoteur_refus,
 *   a_antenne_signee, a_club_subvention, a_dette_lobby, a_info_chauffeur,
 *   a_assistant_soutenu, a_prefet_secret, a_discours_fete, a_raymond_retenu.
 * ============================================================ */

/* ── Petits outils du lot ─────────────────────────────────── */

/** Les scénarios où l'on fait une carrière d'élu « classique » */
const terrain = (d: GameState): boolean => d.scenario !== 'royaute' && d.scenario !== 'editorialiste';
/** Militant·e, conseiller·e municipal·e ou député·e */
const debuts = (d: GameState): boolean => terrain(d) && !rankAtLeast(d, 3);
/** Déjà élu·e localement, pas encore ministre */
const eluLocal = (d: GameState): boolean => debuts(d) && rankAtLeast(d, 1);
const hasRole = (d: GameState, role: StaffRole): boolean => d.player.team.some(r => r.role === role);
const hasContact = (d: GameState, type: ContactType): boolean => d.contacts.some(c => c.type === type);
const g = (d: GameState, masc: string, fem: string): string => (d.player.gender === 'femme' ? fem : masc);

const seg = (segment: Segment, delta: number): Effect => ({ kind: 'segment', segment, delta });
const expo = (delta: number): Effect => ({ kind: 'exposure', delta });
const perso = (delta: number): Effect => ({ kind: 'funds', account: 'personal', delta });
const campagne = (delta: number): Effect => ({ kind: 'funds', account: 'campaign', delta });
const ancrage = (delta: number): Effect => ({ kind: 'localProject', attachment: delta });
const membres = (delta: number): Effect => ({ kind: 'partyMembers', delta });
const cohesion = (delta: number): Effect => ({ kind: 'cohesion', delta });
const momentum = (delta: number): Effect => ({ kind: 'momentum', delta });
const confiance = (trust: number, balance?: number): Effect => ({ kind: 'contact', contactId: '$speaker', trust, ...(balance ? { balance } : {}) });
const moral = (morale: number): Effect => ({ kind: 'team', recruitId: '$speaker', morale });
const depart: Effect = { kind: 'team', recruitId: '$speaker', leave: true };

export const DIALOGUES_A: DialogueDef[] = [
  // ── 1. Le maire propose un marché : soutien contre silence ──
  {
    id: 'a_maire_marche', weight: 1, eligible: eluLocal,
    who: guestSpeaker('a_maire', 'Le maire', 'Mairie'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Bonsoir. On ne s’est jamais vraiment parlé, vous et moi. Ma majorité peut soutenir vos projets au prochain conseil. En échange, j’aimerais que vous cessiez vos questions sur le marché de la piscine. Entre gens raisonnables…',
        choices: [
          { id: 'accepter', label: 'Marché conclu, on oublie la piscine', effects: [st('politicalCapital', 4), st('credibility', -2), ancrage(2)], remember: { a_pacte_maire: 1 }, next: 'scelle' },
          { id: 'negocier', label: 'Je veux d’abord un geste public', hint: 'Il n’aime pas qu’on lui force la main', effects: [st('energy', -2)], risk: { chance: 0.4, scaleWith: 'influence', fail: 'vexe' }, next: 'geste' },
          { id: 'refuser', label: 'Je continuerai à poser mes questions', effects: [st('credibility', 3), st('politicalCapital', -3)], remember: { a_maire_ennemi: 1 }, next: 'menace' },
        ],
        ignore: [st('politicalCapital', -2)],
      },
      scelle: {
        text: 'Parfait. Vous verrez, la ville sait être reconnaissante. Mon directeur de cabinet vous appellera pour les détails.',
        choices: [
          { id: 'ok', label: 'Entendu', end: d => `À bientôt, ${g(d, 'cher ami', 'chère amie')}.`, later: { months: 9, node: 'retour_piscine' } },
          { id: 'trace', label: 'Je garde vos messages, par prudence', hint: 'Une assurance… qu’il n’oubliera pas', effects: [st('influence', 2), st('stress', 2)], remember: { a_maire_trace: 1 }, end: d => `Vous êtes moins ${g(d, 'naïf', 'naïve')} que je ne pensais. Méfiez-vous quand même.`, later: { months: 9, node: 'retour_piscine' } },
        ],
      },
      geste: {
        text: 'Bon. Je vous inviterai à l’inauguration du square, au premier rang, et je citerai votre nom dans mon discours. Mais la piscine, on n’en parle plus.',
        choices: [
          { id: 'ok', label: 'Ça me va', effects: [st('politicalCapital', 2), st('popularity', 2), ancrage(2)], remember: { a_pacte_maire: 1 }, end: 'Premier rang, donc. Ne soyez pas en retard.', later: { months: 9, node: 'retour_piscine' } },
          { id: 'non', label: 'Le square, oui. La piscine, je continue.', effects: [st('credibility', 2), st('politicalCapital', -2)], remember: { a_maire_ennemi: 1 }, end: 'Vous jouez avec le feu.', later: { months: 8, node: 'retour_ennemi' } },
        ],
      },
      vexe: {
        text: 'Un geste public ? Vous croyez que j’ai besoin de vous ? Oubliez ma proposition. Et oubliez aussi vos jardins partagés.',
        effects: [st('politicalCapital', -3), ancrage(-1)],
        choices: [
          { id: 'excuses', label: 'Je me suis mal exprimé·e, reprenons', effects: [st('credibility', -2)], remember: { a_pacte_maire: 1 }, end: 'Je préfère ça. On fait comme j’ai dit.', later: { months: 9, node: 'retour_piscine' } },
          { id: 'tant_pis', label: 'Très bien. On se reverra au conseil.', remember: { a_maire_ennemi: 1 }, end: 'C’est ça.', later: { months: 8, node: 'retour_ennemi' } },
        ],
      },
      menace: {
        text: 'Comme vous voudrez. Mais n’attendez plus rien de la mairie : ni salle, ni subvention, ni place sur l’estrade.',
        choices: [
          { id: 'presse', label: 'Je transmets le dossier à la presse locale', hint: 'Coup d’éclat risqué', effects: [st('popularity', 2), st('politicalCapital', -3), st('energy', -3)], risk: { chance: 0.4, scaleWith: 'credibility', fail: 'diffamation' }, end: 'La presse locale titre sur le marché de la piscine. Le maire ne décolère pas.', later: { months: 8, node: 'retour_ennemi' } },
          { id: 'attendre', label: 'J’attends mon heure', effects: [st('stress', 2)], end: 'Votre heure ? Elle ne viendra pas.', later: { months: 8, node: 'retour_ennemi' } },
        ],
      },
      diffamation: {
        text: 'Mes avocats vous envoient une mise en demeure pour diffamation. Les chiffres de votre « dossier » étaient faux, je vous signale.',
        effects: [st('credibility', -5), expo(4), st('stress', 3)],
        choices: [
          { id: 'retirer', label: 'Je retire et je présente mes excuses', effects: [st('credibility', 1), st('politicalCapital', -2)], end: 'Sage décision.' },
          { id: 'maintenir', label: 'Je maintiens, on se verra au tribunal', effects: [st('energy', -4), perso(-1500), st('credibility', 1)], end: 'Comme vous voudrez. Mon avocat est très patient.' },
        ],
      },
      retour_piscine: {
        text: d => `La chambre régionale des comptes épluche le marché de la piscine. ${mem(d, 'a_maire_trace') ? 'Je sais que vous avez gardé mes messages. ' : ''}Si on vous interroge, vous n’avez rien vu. On est d’accord ?`,
        effects: [expo(4), st('stress', 2)],
        choices: [
          { id: 'couvrir', label: 'On est d’accord, je n’ai rien vu', effects: [st('credibility', -3), st('politicalCapital', 3), expo(2)], remember: { a_pacte_maire: 1 }, end: 'Je savais que je pouvais compter sur vous.' },
          { id: 'temoigner', label: 'Je dirai la vérité aux enquêteurs', effects: [st('credibility', 5), st('politicalCapital', -4), st('popularity', 2)], remember: { a_maire_ennemi: 1 }, end: 'Alors vous êtes fini·e dans cette ville.' },
          { id: 'messages', label: 'Je remets vos messages aux magistrats', if: d => mem(d, 'a_maire_trace') > 0, hint: 'Les messages que vous aviez gardés', effects: [st('credibility', 6), st('influence', 3), expo(-3), st('politicalCapital', -3)], remember: { a_maire_ennemi: 1 }, end: '…' },
        ],
      },
      retour_ennemi: {
        text: 'Je vous préviens par courtoisie : je soutiendrai votre adversaire aux prochaines élections. Ma machine électorale, vous la connaissez.',
        effects: [st('politicalCapital', -2), ancrage(-2), momentum(-3)],
        choices: [
          { id: 'defier', label: 'Vos électeurs ne vous appartiennent pas', effects: [st('popularity', 2), st('stress', 3)], end: 'Nous verrons bien.' },
          { id: 'treve', label: 'Faisons une trêve jusqu’aux élections', if: d => d.player.stats.politicalCapital >= 20, hint: 'Il faut du poids pour qu’il accepte', effects: [st('politicalCapital', -4), momentum(3)], end: 'Trêve. Mais je n’oublie rien.' },
          { id: 'ignorer', label: 'Je ne réponds pas aux menaces', effects: [st('credibility', 1), st('stress', 1)], end: 'Le silence, c’est aussi une réponse.' },
        ],
      },
    },
  },

  // ── 2. L'association de quartier réclame une promesse ──
  {
    id: 'a_asso_quartier', weight: 1, eligible: d => debuts(d) && hasContact(d, 'association'),
    who: contactSpeaker('association'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Bonjour. Le collectif du quartier des Tilleuls se réunit jeudi. Les habitants attendent un engagement clair sur la maison de quartier, fermée depuis deux ans. Vous viendrez le prendre, cet engagement ?',
        choices: [
          { id: 'promettre', label: 'Je viendrai et je m’engagerai', effects: [st('energy', -4), st('popularity', 2), confiance(5)], remember: { a_promesse_quartier: 1 }, next: 'reunion' },
          { id: 'ecouter', label: 'Je viendrai écouter, sans rien promettre', effects: [st('energy', -3), st('credibility', 2), confiance(-2)], next: 'deception' },
          { id: 'courrier', label: 'Je ne peux pas, je vous écris', effects: [st('popularity', -2), confiance(-4)], end: 'Un courrier… Les habitants apprécieront.', later: { months: 6, node: 'retour_froid' } },
        ],
        ignore: [confiance(-5), st('popularity', -1)],
      },
      reunion: {
        text: 'Salle comble. Une habitante vous lance : « Rouverte quand ? Avant ou après les élections ? » Tout le monde vous regarde.',
        choices: [
          { id: 'date', label: 'Avant l’été prochain, je m’y engage', effects: [st('popularity', 3), st('credibility', -1), { kind: 'promise', domain: 'social', text: 'Rouvrir la maison de quartier des Tilleuls', months: 18 }], remember: { a_promesse_quartier: 1 }, end: 'Applaudissements. Ils ont noté la date, croyez-moi.', later: { months: 10, node: 'retour_promesse' } },
          { id: 'flou', label: 'Dès que les financements seront réunis', effects: [st('credibility', -2), st('popularity', -1)], end: 'Murmures dans la salle. On connaît la chanson.', later: { months: 10, node: 'retour_promesse' } },
          { id: 'verite', label: 'Pas de date tant que le budget n’est pas voté', effects: [st('credibility', 3), st('popularity', -1)], end: 'Un silence. Puis un vieux monsieur applaudit : « Au moins, c’est franc. »', later: { months: 10, node: 'retour_promesse' } },
        ],
      },
      deception: {
        text: 'Les habitants espéraient plus. Certains disent que vous êtes « comme les autres ». Vous voulez quand même dire un mot à la fin ?',
        choices: [
          { id: 'mot', label: 'Oui : je reviendrai avec des chiffres', effects: [st('energy', -2), st('credibility', 2)], end: 'D’accord. On vous attend avec vos chiffres.', later: { months: 6, node: 'retour_froid' } },
          { id: 'partir', label: 'Je préfère m’éclipser', effects: [st('popularity', -2), confiance(-3)], end: 'Vous êtes parti·e avant le pot. Ça s’est remarqué.' },
        ],
      },
      retour_promesse: {
        text: d => mem(d, 'a_promesse_quartier') >= 2
          ? `L’échéance approche et la maison de quartier est toujours fermée. Les habitants ont ressorti la vidéo de votre engagement. ${mem(d, 'a_pacte_maire') ? 'On murmure que le budget est parti dans la piscine du maire. ' : ''}Qu’est-ce qu’on leur dit ?`
          : 'Dix mois après la réunion, où en est la maison de quartier ? Les habitants s’impatientent et le collectif ne sait plus quoi leur répondre.',
        effects: [st('stress', 2)],
        choices: [
          { id: 'financer', label: 'Je mets tout mon poids pour débloquer les travaux', hint: 'Coûteux en capital politique', effects: [st('politicalCapital', -5), { kind: 'promise', domain: 'social', keep: true }, ancrage(4), confiance(6)], end: 'Les travaux commencent lundi ! Les gamins du quartier n’en reviennent pas.' },
          { id: 'chantier', label: 'J’organise un chantier participatif', effects: [st('energy', -6), st('popularity', 2), ancrage(2)], risk: { chance: 0.35, scaleWith: 'popularity', fail: 'chantier_rate' }, end: 'Cinquante bénévoles, des pots de peinture, une fresque : la maison revit.' },
          { id: 'excuses', label: 'Je reconnais mon retard et je m’excuse', effects: [st('credibility', 1), st('popularity', -3), confiance(-3)], end: 'Des excuses… On s’en contentera, pour cette fois.' },
        ],
      },
      chantier_rate: {
        text: 'Le chantier a tourné court : pas d’assurance, la mairie a fait fermer les lieux. Une photo de vous, rouleau à la main devant des grilles cadenassées, circule partout.',
        effects: [st('popularity', -2), st('credibility', -2), expo(2)],
        choices: [
          { id: 'rire', label: 'J’en ris avec eux sur les réseaux', effects: [st('popularity', 1)], end: 'L’autodérision a payé : les habitants ont partagé la photo avec tendresse.' },
          { id: 'mairie', label: 'Je mets la mairie face à ses responsabilités', effects: [st('politicalCapital', -2), st('credibility', 1)], remember: { a_maire_ennemi: 1 }, end: 'Le maire a peu goûté votre communiqué. Les habitants, beaucoup.' },
        ],
      },
      retour_froid: {
        text: 'Votre courrier a été lu en réunion. Les habitants ont voté une motion : « Les élus absents ne sont pas les bienvenus. » Le journal du quartier en parle.',
        effects: [st('popularity', -2), ancrage(-2)],
        choices: [
          { id: 'venir', label: 'Je viens à la prochaine réunion, sans caméra', effects: [st('energy', -4), confiance(4), st('popularity', 1)], end: 'D’accord. Venez, et écoutez.' },
          { id: 'ignorer', label: 'Je n’ai pas de temps pour les motions', effects: [st('credibility', -1), seg('populaires', -2)], end: 'C’est noté. Les urnes noteront aussi.' },
        ],
      },
    },
  },

  // ── 3. La cafetière et sa terrasse ──
  {
    id: 'a_terrasse', weight: 1, eligible: eluLocal,
    who: guestSpeaker('a_cafetiere', 'Sylvie, Café des Halles', 'Commerçante'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Bonjour ! Sylvie, du Café des Halles. La mairie me refuse l’extension de ma terrasse : trois tables de plus, rien du tout. Vous pourriez dire un mot au service de la voirie ? Votre café est offert à vie !',
        choices: [
          { id: 'maire', label: 'J’appelle le maire, il me doit bien ça', if: d => mem(d, 'a_pacte_maire') > 0, hint: 'Votre arrangement avec le maire', effects: [st('politicalCapital', -1), st('credibility', -1)], remember: { a_terrasse_faveur: 1 }, next: 'obtenu' },
          { id: 'appuyer', label: 'Je vais appuyer votre demande', effects: [st('politicalCapital', -3), st('energy', -2)], remember: { a_terrasse_faveur: 1 }, risk: { chance: 0.4, scaleWith: 'influence', fail: 'refus' }, next: 'obtenu' },
          { id: 'recours', label: 'Faites un recours, je vous aide à le rédiger', effects: [st('energy', -3), st('credibility', 2)], next: 'recours' },
          { id: 'refuser', label: 'Je ne fais pas de passe-droit', effects: [st('credibility', 2), st('popularity', -1)], end: d => `Ah. Bon. Je pensais que vous étiez ${g(d, 'différent', 'différente')} des autres.` },
        ],
        ignore: [st('popularity', -1)],
      },
      obtenu: {
        text: 'Ça y est, autorisation signée ! Tout le quartier sait que c’est grâce à vous. Je vous garde une table au soleil, réservée.',
        effects: [st('popularity', 2), seg('populaires', 1)],
        choices: [
          { id: 'qg', label: 'J’en ferai ma permanence du samedi', effects: [st('energy', -2), ancrage(3), st('popularity', 1)], end: 'Génial ! Je mets une petite affichette.', later: { months: 7, node: 'retour_jaloux' } },
          { id: 'discret', label: 'Gardez ça pour vous, s’il vous plaît', effects: [expo(-1)], end: 'Motus. Mais le café reste offert.', later: { months: 7, node: 'retour_jaloux' } },
        ],
      },
      refus: {
        text: 'La voirie a dit non, et le chef de service a demandé de quel droit vous interveniez. Ça fait un peu désordre…',
        effects: [st('politicalCapital', -2), st('credibility', -1)],
        choices: [
          { id: 'excuses', label: 'Je m’excuse auprès du service', effects: [st('credibility', 1)], end: 'Tant pis pour la terrasse. Merci d’avoir essayé.' },
          { id: 'insister', label: 'J’insiste, c’est une question de principe', effects: [st('politicalCapital', -2), st('popularity', 1), expo(2)], end: 'Le chef de service a transmis votre appel à l’inspection. Bon courage.' },
        ],
      },
      recours: {
        text: 'J’ai suivi vos conseils, le recours est parti. Le tribunal administratif, c’est long ? Les beaux jours arrivent…',
        choices: [
          { id: 'patience', label: 'Comptez six mois, mais le droit est pour vous', effects: [st('credibility', 1)], end: 'Six mois… Je patienterai.', later: { months: 6, node: 'retour_recours' } },
          { id: 'accelerer', label: 'Je passe un coup de fil pour accélérer', effects: [st('politicalCapital', -2)], remember: { a_terrasse_faveur: 1 }, end: 'Merci ! Vous êtes formidable.', later: { months: 6, node: 'retour_recours' } },
        ],
      },
      retour_recours: {
        text: 'Le tribunal m’a donné raison ! Trois tables de plus, en toute légalité. J’ai raconté à tous mes clients comment vous m’avez aidée.',
        effects: [st('popularity', 2), st('credibility', 2), seg('populaires', 1)],
        choices: [
          { id: 'bravo', label: 'Bravo, c’est votre victoire', end: 'La nôtre ! Passez boire un café quand vous voulez.' },
          { id: 'temoigner', label: 'Venez en parler à ma réunion publique', effects: [st('energy', -2), momentum(3)], end: 'Avec plaisir ! Je ferai même le café.' },
        ],
      },
      retour_jaloux: {
        text: d => `Le restaurateur d’en face a écrit au journal : il dit que ma terrasse est « un cadeau d’élu ». ${mem(d, 'a_pacte_maire') ? 'Il parle même de vos arrangements avec le maire. ' : ''}Je fais quoi ?`,
        effects: [expo(3), st('stress', 2)],
        choices: [
          { id: 'etendre', label: 'Je soutiens aussi sa demande de terrasse', effects: [st('politicalCapital', -3), st('popularity', 1), expo(-2)], end: 'Bien joué : il a retiré sa lettre. Deux terrasses, deux électeurs.' },
          { id: 'nier', label: 'Répondez qu’il n’y a eu aucune intervention', effects: [st('credibility', -2)], risk: { chance: 0.4, scaleWith: 'credibility', fail: 'demasque' }, end: 'J’ai répondu. L’affaire retombe.' },
          { id: 'assumer', label: 'J’assume : j’aide les commerces du quartier', effects: [st('credibility', 1), seg('cadres', -1), seg('populaires', 1)], end: 'Les habitués vous applaudissent. Lui, moins.' },
        ],
      },
      demasque: {
        text: 'Le journal a publié le courriel que vous aviez envoyé à la voirie. « Aucune intervention », vraiment ?',
        effects: [st('credibility', -4), expo(4)],
        choices: [
          { id: 'reconnaitre', label: 'Je reconnais et je m’explique', effects: [st('credibility', 1)], end: 'Votre mise au point est passée. De justesse.' },
          { id: 'silence', label: 'Pas de commentaire', effects: [st('popularity', -2)], end: 'Le journal a titré sur votre silence.' },
        ],
      },
    },
  },

  // ── 4. Un militant veut vous disputer l'investiture (le ou la chef·fe vous prévient) ──
  {
    id: 'a_rival_interne', weight: 1, eligible: d => debuts(d) && !!chiefSpeaker(d),
    who: d => chiefSpeaker(d),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `Julien, de ta section, veut te disputer l’investiture. Il a des soutiens chez les jeunes militants. ${mem(d, 'a_alliance_ferrand') ? 'Et franchement, ton flirt avec l’opposition municipale ne t’aide pas. ' : ''}Je tranche, ou on laisse voter ?`,
        choices: [
          { id: 'trancher', label: 'Tranche pour moi, tu me connais', if: d => mem(d, 'loyal_chef') > 0, hint: 'Votre loyauté passée', effects: [st('politicalCapital', -2), cohesion(-2)], remember: { a_julien_ecrase: 1 }, next: 'tranche' },
          { id: 'vote', label: 'Laisse voter les militants', effects: [st('credibility', 2), st('stress', 3)], next: 'campagne_interne' },
          { id: 'deal', label: 'Je vais lui proposer quelque chose', effects: [st('politicalCapital', -3)], next: 'deal' },
        ],
        ignore: [st('politicalCapital', -2)],
      },
      tranche: {
        text: 'C’est fait : ta candidature est validée par le bureau. Julien crie au déni de démocratie sur la boucle des militants.',
        effects: [membres(-10), seg('jeunes', -1)],
        choices: [
          { id: 'appeler', label: 'Je l’appelle pour calmer le jeu', effects: [st('energy', -3), cohesion(1)], end: 'Il n’a pas décroché. Il t’en voudra longtemps.', later: { months: 8, node: 'retour_ecrase' } },
          { id: 'laisser', label: 'Laisse-le crier', effects: [cohesion(-1)], end: 'Comme tu veux. Mais il ne lâchera pas.', later: { months: 8, node: 'retour_ecrase' } },
        ],
      },
      campagne_interne: {
        text: 'Vote dans trois semaines. Julien fait du porte-à-porte chez chaque adhérent. Tu fais campagne comment ?',
        choices: [
          { id: 'kevin', label: 'J’appelle Kevin et ses bénévoles', if: d => mem(d, 'kevin_loyal') > 0, hint: 'Kevin vous doit une fière chandelle', effects: [st('energy', -2), membres(5)], next: 'victoire' },
          { id: 'anciens', label: 'Raymond et les anciens votent pour moi', if: d => mem(d, 'a_raymond_retenu') > 0, hint: 'Le vieux militant que vous avez retenu', effects: [st('energy', -2), seg('retraites', 1)], next: 'victoire' },
          { id: 'terrain', label: 'Je fais le tour des adhérents, un par un', effects: [st('energy', -7)], risk: { chance: 0.4, scaleWith: 'popularity', fail: 'defaite' }, next: 'victoire' },
          { id: 'debat', label: 'Je propose un débat devant la section', effects: [st('stress', 2)], risk: { chance: 0.45, scaleWith: 'credibility', fail: 'defaite' }, next: 'victoire' },
        ],
      },
      victoire: {
        text: 'Résultat : tu gagnes l’investiture, 61 % contre 39 %. Julien demande à te parler. Il a l’air sonné.',
        effects: [st('politicalCapital', 4), momentum(3)],
        choices: [
          { id: 'tendre', label: 'Je lui propose d’être mon suppléant', effects: [cohesion(2)], remember: { a_julien_allie: 1 }, end: 'Il accepte. Une section unie, ça change tout.', later: { months: 8, node: 'retour_allie' } },
          { id: 'ignorer', label: 'Il a perdu, qu’il se range', effects: [cohesion(-1)], remember: { a_julien_ecrase: 1 }, end: 'Il se range… pour l’instant.', later: { months: 8, node: 'retour_ecrase' } },
        ],
      },
      defaite: {
        text: 'Coup de tonnerre : Julien l’emporte d’une poignée de voix. La section a parlé. Tu encaisses ?',
        effects: [st('politicalCapital', -5), st('stress', 4), momentum(-4)],
        choices: [
          { id: 'soutenir', label: 'Je soutiens Julien, la section avant tout', effects: [st('credibility', 3), cohesion(3)], remember: { a_julien_allie: 1 }, end: 'Respect. Le parti s’en souviendra, moi aussi.' },
          { id: 'contester', label: 'Je conteste : des adhésions de dernière minute', effects: [cohesion(-3), st('credibility', -1), st('influence', 1)], remember: { a_julien_ecrase: 1 }, end: 'La commission des conflits va adorer. Bon courage.' },
        ],
      },
      deal: {
        text: 'Il veut la deuxième place sur ta liste et la présidence de la commission jeunesse. Il dit que c’est à prendre ou à laisser.',
        choices: [
          { id: 'accepter', label: 'Va pour les deux', effects: [st('politicalCapital', -2), cohesion(2), seg('jeunes', 1)], remember: { a_julien_allie: 1 }, end: 'Il retire sa candidature. Bien négocié.', later: { months: 8, node: 'retour_allie' } },
          { id: 'moitie', label: 'La commission jeunesse, pas la liste', risk: { chance: 0.5, scaleWith: 'influence', fail: 'campagne_interne' }, end: 'Il a accepté, en grommelant. Il voulait surtout exister.' },
          { id: 'refuser', label: 'Pas de chantage : qu’il se présente', effects: [st('credibility', 1)], next: 'campagne_interne' },
        ],
      },
      retour_allie: {
        text: 'Julien a fait un boulot remarquable : la section a doublé chez les moins de trente ans. Il aimerait être associé à ta prochaine campagne.',
        effects: [membres(15), seg('jeunes', 2), momentum(2)],
        choices: [
          { id: 'directeur', label: 'Il sera mon directeur de campagne', effects: [cohesion(2), st('politicalCapital', -1)], end: 'Il est ému. Tu viens de te faire un fidèle.' },
          { id: 'merci', label: 'Merci, mais je garde mon équipe', end: 'Il comprend. Il reste dans les parages.' },
        ],
      },
      retour_ecrase: {
        text: 'Julien a quitté la section avec une dizaine de jeunes militants. Il soutient la liste d’en face et se répand sur toi dans la presse locale.',
        effects: [membres(-12), momentum(-3), st('popularity', -1)],
        choices: [
          { id: 'repondre', label: 'Je réponds point par point', effects: [st('energy', -3), st('credibility', 1), st('stress', 2)], end: 'Ta réponse est solide. Mais le feuilleton continue.' },
          { id: 'laisser', label: 'Je laisse dire, ça passera', effects: [st('popularity', -1)], end: 'Ça finira par passer. Peut-être.' },
        ],
      },
    },
  },

  // ── 5. Le trésorier a « emprunté » la caisse ──
  {
    id: 'a_tresorier_caisse', weight: 1, eligible: debuts,
    who: guestSpeaker('a_tresorier', 'Michel, trésorier de section', 'Votre section'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Je préfère te le dire avant que ça se sache. J’ai emprunté 1 800 € dans la caisse de la section pour une facture de garage. Je rembourse dans deux mois, promis. Tu ne dis rien ?',
        choices: [
          { id: 'couvrir', label: 'Je remets l’argent moi-même, tu me rembourses', effects: [perso(-1800)], remember: { a_caisse_couverte: 1 }, next: 'merci' },
          { id: 'delai', label: 'Deux mois, pas un jour de plus', effects: [st('stress', 2)], risk: { chance: 0.45, scaleWith: 'influence', fail: 'pas_rembourse' }, end: 'Merci. Tu auras l’argent avant la réunion de section.' },
          { id: 'federation', label: 'Je dois prévenir la fédération', effects: [st('credibility', 2), cohesion(-1)], remember: { a_caisse_denoncee: 1 }, next: 'colere' },
        ],
        ignore: [expo(2)],
      },
      merci: {
        text: 'Tu me sauves. Je te rembourse dès que je peux, et je ne toucherai plus jamais à la caisse.',
        choices: [
          { id: 'confiance', label: 'Je te fais confiance', end: 'Merci, vraiment.', later: { months: 5, node: 'retour_dette' } },
          { id: 'papier', label: 'On signe une reconnaissance de dette', effects: [st('credibility', 1)], remember: { a_caisse_papier: 1 }, end: 'Tu as raison. Je passe la signer demain.', later: { months: 5, node: 'retour_dette' } },
        ],
      },
      retour_dette: {
        text: d => mem(d, 'a_caisse_papier')
          ? 'Voilà, je t’ai viré les 1 800 €, comme sur la reconnaissance de dette. Et une info : la fédé prépare un audit de toutes les sections.'
          : 'Je n’ai pas encore tout… Je peux te rendre 600 € maintenant. Et une info : la fédé prépare un audit de toutes les sections.',
        effects: [st('stress', 1)],
        choices: [
          { id: 'merci_audit', label: 'Merci Michel. On prépare l’audit ensemble', if: d => mem(d, 'a_caisse_papier') > 0, effects: [perso(1800), st('energy', -2), expo(-2)], end: 'Avec toi derrière, je suis plus serein. Je te dois une fière chandelle.' },
          { id: 'partiel', label: 'Je prends les 600 €, le reste plus tard', if: d => !mem(d, 'a_caisse_papier'), effects: [perso(600)], end: 'Promis, le reste avant l’été.' },
          { id: 'effacer', label: 'Laisse tomber la dette, oublions ça', if: d => !mem(d, 'a_caisse_papier'), effects: [cohesion(1), membres(2)], end: 'Je ne sais pas comment te remercier. Toute la section le saura.' },
          { id: 'audit', label: 'L’audit ? Dis-moi tout ce que tu sais', effects: [st('influence', 1), st('energy', -1)], end: 'Ils vont éplucher les notes de frais. Je t’envoie les dates, et je te rembourse dès que possible.' },
        ],
      },
      colere: {
        text: 'Tu me dénonces ? Après vingt ans de collage d’affiches ? Je pensais qu’on était camarades.',
        effects: [st('stress', 2)],
        choices: [
          { id: 'ferme', label: 'Les règles sont les mêmes pour tous', effects: [st('credibility', 2), membres(-5)], end: 'Très bien. Je démissionne de la trésorerie ce soir.', later: { months: 6, node: 'retour_audit' } },
          { id: 'adoucir', label: 'Je dirai que tu es venu de toi-même', effects: [st('credibility', 1), st('energy', -2)], end: 'Merci quand même… Ça change un peu les choses.', later: { months: 6, node: 'retour_audit' } },
        ],
      },
      retour_audit: {
        text: 'L’audit de la fédération est tombé : notre section est citée en exemple pour sa transparence. Le délégué national veut te rencontrer. Sans rancune, va.',
        effects: [st('credibility', 3), st('politicalCapital', 3), cohesion(1)],
        choices: [
          { id: 'aller', label: 'J’y vais', effects: [st('energy', -2), st('influence', 2)], end: 'Raconte-lui comment on fait les choses ici.' },
          { id: 'modeste', label: 'Je n’en fais pas un trophée', effects: [st('credibility', 1)], end: 'C’est bien toi, ça.' },
        ],
      },
      pas_rembourse: {
        text: 'Je suis désolé… Je ne pourrai pas rembourser à temps. Et la fédération lance un audit des comptes le mois prochain.',
        effects: [st('stress', 3), expo(3)],
        choices: [
          { id: 'payer', label: 'Je comble le trou de ma poche', effects: [perso(-1800), expo(-2)], end: 'Merci… Je te rembourserai, même s’il faut dix ans.' },
          { id: 'avouer', label: 'On prévient la fédé ensemble', effects: [st('credibility', 1), cohesion(-2)], remember: { a_caisse_denoncee: 1 }, end: 'D’accord. Au moins, on l’aura dit nous-mêmes.' },
          { id: 'maquiller', label: 'On fait passer ça en frais de campagne', hint: 'Très risqué', effects: [expo(5)], risk: { chance: 0.5, scaleWith: 'credibility', fail: 'decouvert' }, end: 'Ni vu ni connu. Pour l’instant.' },
        ],
      },
      decouvert: {
        text: 'Le commissaire aux comptes de la fédération a repéré l’écriture. Ton nom est sur le bordereau.',
        effects: [st('credibility', -6), st('politicalCapital', -4), expo(4)],
        choices: [
          { id: 'rembourser', label: 'Je rembourse et je présente mes excuses', effects: [perso(-1800), st('credibility', 2)], end: 'La fédé prend acte. Ça laissera des traces.' },
          { id: 'charger', label: 'Je charge Michel', effects: [cohesion(-3), st('credibility', -2)], end: 'J’ai tout raconté, y compris ta proposition. Ça ne passe pas.' },
        ],
      },
    },
  },

  // ── 6. Le voisin qui vous a filmé·e ──
  {
    id: 'a_voisin_filme', weight: 1, eligible: debuts,
    who: guestSpeaker('a_voisin', 'M. Garnier, votre voisin', 'Voisinage'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Bonsoir. Je vous ai filmé·e ce matin, garé·e vingt minutes sur la place de livraison, vos tracts bien visibles sur le tableau de bord. Je n’ai encore rien publié. Vous voyez où je veux en venir ?',
        choices: [
          { id: 'excuser', label: 'Vous avez raison, je vous présente mes excuses', effects: [st('credibility', 1), st('energy', -1)], next: 'demande' },
          { id: 'publier', label: 'Publiez si vous voulez, c’est dérisoire', effects: [st('stress', 1)], risk: { chance: 0.5, scaleWith: 'popularity', fail: 'buzz' }, end: 'Bon… finalement, je ne publie rien. Ça n’intéresserait personne.' },
          { id: 'demander', label: 'Qu’est-ce que vous voulez ?', next: 'demande' },
        ],
      },
      demande: {
        text: 'Je préside le collectif contre l’antenne-relais du square. Signez notre pétition, et ma vidéo disparaît. Simple, non ?',
        choices: [
          { id: 'signer', label: 'D’accord, je signerai', effects: [st('credibility', -2)], remember: { a_voisin_antenne: 1 }, end: 'Ravi qu’on se comprenne. Le collectif vous contactera.' },
          { id: 'refuser', label: 'Je ne signe rien sous la pression', hint: 'Il gardera la vidéo sous le coude', effects: [st('credibility', 2), st('stress', 2)], end: 'Comme vous voudrez. Je garde la vidéo au chaud.', later: { months: 5, node: 'retour_voisin' } },
          { id: 'devancer', label: 'Je publie moi-même la vidéo, avec mes excuses', effects: [st('popularity', 1), st('credibility', 2), expo(-1), st('energy', -1)], end: 'Vous publiez vous-même ma vidéo ? Malin. Les gens trouvent ça sympathique.' },
        ],
      },
      buzz: {
        text: 'La vidéo est en ligne : « Les petits privilèges d’un politique ». Douze mille vues dans la soirée, et ça monte.',
        effects: [st('popularity', -3), expo(3), st('stress', 2)],
        choices: [
          { id: 'excuses', label: 'Je m’excuse publiquement', effects: [st('credibility', 1), st('popularity', 1)], end: 'Vos excuses calment le jeu. Les commentaires passent à autre chose.' },
          { id: 'chantage', label: 'Je révèle qu’il a tenté un chantage', effects: [st('credibility', 1), st('stress', 2), expo(1)], end: 'La moitié des commentaires vous soutiennent, l’autre moitié ricane.' },
        ],
      },
      retour_voisin: {
        text: 'Je voulais vous dire : l’antenne a été installée. Votre refus nous a coûté cher. Mais j’ai gardé la vidéo, et les élections approchent…',
        effects: [st('stress', 2), expo(2)],
        choices: [
          { id: 'cafe', label: 'Je vous propose un café pour en parler', effects: [st('energy', -2), expo(-2)], end: 'Un café… pourquoi pas. On a peut-être mal commencé.' },
          { id: 'indifferent', label: 'Faites ce que vous voulez de votre vidéo', effects: [st('popularity', -1), st('credibility', 1)], end: 'Je n’y manquerai pas.' },
        ],
      },
    },
  },

  // ── 7. L'élue d'opposition propose une alliance locale ──
  {
    id: 'a_alliance_opposition', weight: 1, eligible: eluLocal,
    who: guestSpeaker('a_ferrand', 'Nadia Ferrand', 'Élue d’opposition'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `Bonjour, Nadia Ferrand, de l’opposition municipale. ${mem(d, 'a_maire_ennemi') ? 'Il paraît que le maire et vous, ce n’est plus le grand amour. ' : mem(d, 'a_club_subvention') ? 'Je sais que le maire vous a accordé une subvention express pour le club de foot. Ça se paie, ces choses-là. ' : ''}Le budget passe en conseil dans quinze jours. Ensemble, on peut le faire tomber. Ça vous tente ?`,
        choices: [
          { id: 'allier', label: 'Oui, unissons-nous contre ce budget', effects: [st('politicalCapital', -3), { kind: 'faction', factionId: 'ligne_dure', delta: -3 }, st('influence', 3)], remember: { a_alliance_ferrand: 1 }, next: 'plan' },
          { id: 'secret', label: 'Discrètement : je m’abstiendrai', effects: [st('influence', 2)], remember: { a_alliance_ferrand: 1 }, risk: { chance: 0.4, scaleWith: 'influence', fail: 'fuite' }, end: 'Une abstention discrète, c’est déjà beaucoup. Merci.' },
          { id: 'refuser', label: 'Je ne vote pas avec l’opposition', effects: [cohesion(2), { kind: 'faction', factionId: 'ligne_dure', delta: 2 }, st('influence', -1)], end: 'Dommage. Vous resterez dans l’ombre du maire.' },
          { id: 'prevenir', label: 'Je vais prévenir le maire de votre manœuvre', if: d => mem(d, 'a_pacte_maire') > 0, hint: 'Utile à votre arrangement', effects: [st('politicalCapital', 4), st('credibility', -2)], end: 'Vous me décevez. Je ne l’oublierai pas.' },
        ],
      },
      plan: {
        text: 'Il nous manque trois voix. Vous connaissez des élus de la majorité qui doutent ? On se voit jeudi, sans téléphone.',
        choices: [
          { id: 'rallier', label: 'Je m’occupe de convaincre deux collègues', effects: [st('energy', -5)], risk: { chance: 0.45, scaleWith: 'influence', fail: 'fuite' }, next: 'rallies' },
          { id: 'public', label: 'Faisons-le au grand jour, tribune commune', effects: [st('credibility', 2), cohesion(-3), st('popularity', 2)], end: 'Tribune commune ! La presse va adorer.', later: { months: 6, node: 'retour_budget' } },
        ],
      },
      rallies: {
        text: 'Vous les avez convaincus ! Le maire est en minorité sur son propre budget. Historique. On rédige ensemble les contre-propositions ?',
        effects: [st('influence', 2)],
        choices: [
          { id: 'cantines', label: 'Oui : priorité aux cantines et au périscolaire', effects: [st('energy', -2), { kind: 'dossier', domain: 'education', delta: 2 }], end: 'Parfait. Je m’occupe des chiffres.', later: { months: 6, node: 'retour_budget' } },
          { id: 'solo', label: 'Je présenterai mes propres propositions', effects: [st('politicalCapital', 2)], end: 'Chacun pour soi, donc. On verra en séance.' },
        ],
      },
      fuite: {
        text: 'Quelqu’un a parlé : le maire sait tout. Il vous accuse de « trahison » en pleine réunion de majorité.',
        effects: [st('politicalCapital', -4), cohesion(-2), st('stress', 3)],
        choices: [
          { id: 'assumer', label: 'J’assume, ce budget est mauvais', effects: [st('credibility', 2)], remember: { a_maire_ennemi: 1 }, end: 'Au moins, vous êtes cohérent·e. On reste en contact.' },
          { id: 'nier', label: 'Je nie en bloc', effects: [st('credibility', -3)], end: 'Personne n’est dupe, mais l’orage passe.' },
        ],
      },
      retour_budget: {
        text: 'Le budget a été rejeté en première lecture ! Le maire a dû revoir sa copie, avec nos propositions sur les cantines. Les habitants l’ont remarqué.',
        effects: [st('popularity', 3), st('influence', 2), seg('populaires', 1), ancrage(2)],
        choices: [
          { id: 'bravo', label: 'Bravo à nous deux', end: 'On refait équipe quand vous voulez.' },
          { id: 'liberte', label: 'Je reprends ma liberté maintenant', effects: [cohesion(1)], end: 'Comme vous voulez. Vous savez où me trouver.' },
        ],
      },
    },
  },

  // ── 8. Les éleveurs en colère (via un contact syndical) ──
  {
    id: 'a_agriculteurs', weight: 1, eligible: d => debuts(d) && hasContact(d, 'syndicat'),
    who: contactSpeaker('syndicat'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Je relaie un appel des éleveurs du canton : ils bloquent la départementale avec trente tracteurs depuis ce matin. Prix du lait, normes, paperasse. Ils veulent un élu sur place. Vous venez ?',
        choices: [
          { id: 'venir', label: 'J’arrive, avec des croissants', effects: [st('energy', -5), seg('ruraux', 3), confiance(4)], next: 'barrage' },
          { id: 'normes', label: 'Ces normes protègent l’eau, je les défends', effects: [seg('ruraux', -3), { kind: 'dossier', domain: 'ecologie', delta: 3 }, st('credibility', 2), confiance(-4)], end: 'Ils ne l’oublieront pas. Moi non plus.', later: { months: 8, node: 'retour_colere' } },
          { id: 'appel', label: 'Je les appelle, mais je ne viens pas', effects: [st('energy', -1), seg('ruraux', -1)], end: 'Un coup de fil… ils auraient préféré vous voir.' },
        ],
        ignore: [seg('ruraux', -2), confiance(-3)],
      },
      barrage: {
        text: 'Sur place, un éleveur vous tend un micro improvisé : « Alors, vous êtes avec nous ou avec les bureaux ? » Les caméras de la télé régionale tournent.',
        choices: [
          { id: 'avec', label: 'Je porterai vos revendications, promis', effects: [st('popularity', 2), seg('ruraux', 2), { kind: 'promise', domain: 'territoires', text: 'Simplifier les démarches des exploitations agricoles', months: 18 }], remember: { a_ruraux_promesse: 1 }, end: 'Ils applaudissent. Ils viendront vérifier.', later: { months: 9, node: 'retour_promesse' } },
          { id: 'nuance', label: 'Je défends les prix, pas la fin des normes', effects: [st('credibility', 3), seg('ruraux', 1), { kind: 'dossier', domain: 'ecologie', delta: 1 }], end: 'Des sifflets, puis une poignée de main. C’était honnête.' },
          { id: 'tracteur', label: 'Je monte sur un tracteur pour la photo', effects: [st('popularity', 2)], risk: { chance: 0.45, scaleWith: 'credibility', fail: 'photo' }, end: 'La photo fait la une du quotidien régional. Bon visuel.' },
        ],
      },
      photo: {
        text: 'La photo tourne… mais avec une légende moqueuse : « Le citadin découvre la campagne ». Les éleveurs, eux, ne rient pas.',
        effects: [st('credibility', -3), seg('ruraux', -1)],
        choices: [
          { id: 'rire', label: 'J’en ris de bon cœur', effects: [st('popularity', 1)], end: 'L’autodérision sauve un peu la mise.' },
          { id: 'ferme', label: 'Je reviens passer une journée à la ferme', effects: [st('energy', -5), seg('ruraux', 3)], end: 'Une vraie journée, traite à cinq heures comprise. Respect.' },
        ],
      },
      retour_promesse: {
        text: 'Neuf mois après le barrage, on vous attend toujours. Les dossiers d’aide sont toujours aussi kafkaïens. Vous aviez promis, devant les caméras.',
        effects: [st('stress', 2), seg('ruraux', -1)],
        choices: [
          { id: 'deposer', label: 'Je dépose une proposition dès ce mois-ci', effects: [st('politicalCapital', -4), st('energy', -3), { kind: 'promise', domain: 'territoires', keep: true }, seg('ruraux', 3), confiance(4)], end: 'Enfin ! On suivra ça de près.' },
          { id: 'complique', label: 'C’est plus compliqué que prévu', effects: [st('credibility', -2), seg('ruraux', -2), confiance(-3)], end: 'C’est toujours plus compliqué. Pour vous.' },
        ],
      },
      retour_colere: {
        text: 'Les éleveurs se souviennent de votre sortie sur les normes. Ils ont tapissé votre permanence d’affiches « Élu hors-sol ».',
        effects: [st('popularity', -1), seg('ruraux', -2), st('stress', 2)],
        choices: [
          { id: 'debat', label: 'Je les invite à débattre, sans caméras', effects: [st('energy', -3), seg('ruraux', 2), confiance(3)], end: 'Trois heures de débat dans une grange. Ils repartent moins fâchés.' },
          { id: 'tenir', label: 'Je maintiens ma position', effects: [st('credibility', 2), { kind: 'dossier', domain: 'ecologie', delta: 1 }], end: 'Constant, au moins. Ça, ils le reconnaissent.' },
        ],
      },
    },
  },

  // ── 9. La directrice d'école et la classe menacée ──
  {
    id: 'a_ecole_classe', weight: 1, eligible: eluLocal,
    who: guestSpeaker('a_directrice', 'Mme Aubert, directrice d’école', 'École Jules-Ferry'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Bonjour, Mme Aubert, directrice de l’école Jules-Ferry. L’académie veut fermer une classe à la rentrée : nos CP passeraient à 29 élèves. Les parents sont à cran. Pouvez-vous nous aider ?',
        choices: [
          { id: 'rectorat', label: 'J’écris au recteur et je demande un rendez-vous', effects: [st('energy', -3), st('credibility', 2), { kind: 'dossier', domain: 'education', delta: 2 }], risk: { chance: 0.5, scaleWith: 'influence', fail: 'refus_rectorat' }, next: 'gagne' },
          { id: 'mobiliser', label: 'Je mobilise les parents avec vous', effects: [st('energy', -5), st('popularity', 2)], remember: { a_ecole_mobilisee: 1 }, next: 'mobilisation' },
          { id: 'honnete', label: 'Les effectifs baissent, je ne peux rien promettre', effects: [st('credibility', 2), st('popularity', -2)], end: 'Je comprends. Les parents, eux, comprendront moins.', later: { months: 8, node: 'retour_fermee' } },
        ],
        ignore: [st('popularity', -1)],
      },
      refus_rectorat: {
        text: 'Le recteur ne vous a même pas reçu·e : « décision prise ». Les parents vous reprochent d’avoir choisi la voie feutrée.',
        effects: [st('credibility', -1), st('popularity', -1)],
        choices: [
          { id: 'mobiliser', label: 'Alors on mobilise', effects: [st('energy', -3)], remember: { a_ecole_mobilisee: 1 }, next: 'mobilisation' },
          { id: 'arreter', label: 'Je n’irai pas plus loin', effects: [st('popularity', -2)], end: 'Très bien. Je l’annoncerai aux parents.', later: { months: 8, node: 'retour_fermee' } },
        ],
      },
      mobilisation: {
        text: 'Deux cents parents, des banderoles, la presse locale. Certains proposent d’occuper l’école une nuit. On fait quoi ?',
        choices: [
          { id: 'occuper', label: 'On occupe, je dors sur place avec vous', effects: [st('energy', -6), expo(1)], risk: { chance: 0.4, scaleWith: 'popularity', fail: 'evacuation' }, next: 'gagne' },
          { id: 'petition', label: 'Une pétition et une délégation au rectorat', effects: [st('energy', -3), st('credibility', 2)], end: 'Huit cents signatures. Le rectorat promet de « réexaminer ». On verra.', later: { months: 8, node: 'retour_fermee' } },
        ],
      },
      gagne: {
        text: 'Victoire : l’académie renonce à la fermeture ! Les parents parlent de vous dans tous les groupes de discussion de l’école.',
        effects: [st('popularity', 3), { kind: 'dossier', domain: 'education', delta: 2 }, ancrage(3)],
        choices: [
          { id: 'vigilant', label: 'Je reste vigilant·e pour l’an prochain', effects: [st('energy', -1)], end: 'Merci. Les enfants vous ont préparé une chanson pour la kermesse.', later: { months: 10, node: 'retour_an' } },
          { id: 'merite', label: 'Le mérite revient aux parents', effects: [st('credibility', 1)], end: 'Ils seront touchés. Vous aussi, vous avez compté.', later: { months: 10, node: 'retour_an' } },
        ],
      },
      evacuation: {
        text: 'L’inspection a fait fermer les locaux à 6 h et me convoque. La photo de vous sur un tapis de gym fait le tour du département.',
        effects: [st('credibility', -3), expo(2), st('popularity', 1)],
        choices: [
          { id: 'couvrir', label: 'Je prends tout sur moi auprès de l’inspection', effects: [st('politicalCapital', -2), st('credibility', 2)], end: 'Merci. Vous m’avez protégée, je ne l’oublierai pas.' },
          { id: 'parents', label: 'C’était une initiative des parents', effects: [st('credibility', -2), st('popularity', -1)], end: 'Les parents l’ont mauvaise. Moi aussi, un peu.' },
        ],
      },
      retour_fermee: {
        text: 'C’est la rentrée. La classe a fermé : 29 élèves en CP. Les parents vous croisent au portail sans un mot.',
        effects: [st('popularity', -2), { kind: 'dossier', domain: 'education', delta: -1 }],
        choices: [
          { id: 'devoirs', label: 'Je monte une aide aux devoirs avec des bénévoles', effects: [st('energy', -3), st('popularity', 2), ancrage(1)], end: 'C’est déjà ça. Les enfants en ont besoin.' },
          { id: 'promesse', label: 'Je me battrai pour la rouvrir', effects: [{ kind: 'promise', domain: 'education', text: 'Rouvrir la classe fermée de l’école Jules-Ferry', months: 12 }, st('popularity', 1)], end: 'Je prends note. Les parents aussi.' },
        ],
      },
      retour_an: {
        text: 'Un an plus tard : la classe est toujours ouverte et les résultats en lecture des CP ont bondi. Les parents ont créé une association. Ils aimeraient vous en nommer membre d’honneur.',
        effects: [st('popularity', 2), ancrage(2)],
        choices: [
          { id: 'accepter', label: 'Avec joie', effects: [st('energy', -2), seg('jeunes', 1)], end: 'Merveilleux. Première réunion jeudi, il y aura des crêpes.' },
          { id: 'retrait', label: 'Je préfère rester en retrait', effects: [st('credibility', 1)], end: 'Je comprends. La porte reste ouverte.' },
        ],
      },
    },
  },

  // ── 10. Le promoteur et le permis de construire ──
  {
    id: 'a_promoteur', weight: 1, eligible: eluLocal,
    who: guestSpeaker('a_promoteur', 'Laurent Sabatier', 'Promoteur immobilier'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Bonjour, Laurent Sabatier, promoteur. Mon permis pour la résidence du Clos-Vert passe en commission le mois prochain. Je soutiens volontiers les élus qui aiment leur ville… Votre association de financement accepte les dons, je crois ?',
        choices: [
          { id: 'don', label: 'Les dons sont légaux, je ne refuse pas', effects: [campagne(6000), expo(4)], remember: { a_promoteur_dette: 1 }, next: 'contrepartie' },
          { id: 'social', label: 'Je soutiens le permis si 30 % de logements sociaux', effects: [st('credibility', 2), { kind: 'dossier', domain: 'social', delta: 2 }], next: 'negociation' },
          { id: 'refuser', label: 'Votre permis sera examiné comme les autres', effects: [st('credibility', 3)], remember: { a_promoteur_refus: 1 }, end: 'Comme vous voudrez. J’ai d’autres interlocuteurs.', later: { months: 7, node: 'retour_refus' } },
        ],
      },
      contrepartie: {
        text: 'Merci pour votre compréhension. Pour la commission, je compte sur votre voix. Et sur votre discrétion, bien sûr.',
        choices: [
          { id: 'voter', label: 'Vous l’aurez', effects: [st('politicalCapital', 2), expo(2)], end: 'Parfait. Les grues arrivent au printemps.', later: { months: 8, node: 'retour_enquete' } },
          { id: 'rendre', label: 'Finalement, je vous rends votre don', effects: [campagne(-6000), expo(-3), st('credibility', 2)], end: 'Vous me rendez mon chèque ? C’est une première.' },
          { id: 'deport', label: 'Je me déporte du vote, par prudence', effects: [st('credibility', 1), expo(-1)], end: 'Se déporter… avec mon don en poche. Habile.', later: { months: 8, node: 'retour_enquete' } },
        ],
      },
      negociation: {
        text: 'Trente pour cent ? Vous voulez ma ruine. Je monte à vingt, avec une crèche au rez-de-chaussée. Dernière offre.',
        choices: [
          { id: 'vingt', label: 'Vingt pour cent et la crèche : d’accord', effects: [{ kind: 'dossier', domain: 'social', delta: 1 }, ancrage(2), st('popularity', 1)], end: 'Marché conclu. Vous savez négocier.', later: { months: 8, node: 'retour_creche' } },
          { id: 'tenir', label: 'Trente, ou je vote contre', effects: [st('credibility', 2)], risk: { chance: 0.5, scaleWith: 'influence', fail: 'abandon' }, next: 'cede' },
        ],
      },
      cede: {
        text: 'Bon. Trente pour cent. Mais vous me devrez une inauguration en grande pompe.',
        effects: [{ kind: 'dossier', domain: 'social', delta: 2 }, st('popularity', 2)],
        choices: [
          { id: 'pompe', label: 'Avec plaisir', end: 'Je retiens. Champagne et fanfare.', later: { months: 8, node: 'retour_creche' } },
          { id: 'sobre', label: 'Pas de ruban, juste des logements', effects: [st('credibility', 1)], end: d => `Vous êtes ${g(d, 'un drôle d’élu', 'une drôle d’élue')}. Mais d’accord.`, later: { months: 8, node: 'retour_creche' } },
        ],
      },
      abandon: {
        text: 'J’abandonne le projet. Trois cents logements de moins. La presse va adorer savoir pourquoi.',
        effects: [st('popularity', -2), { kind: 'dossier', domain: 'social', delta: -1 }, st('stress', 2)],
        choices: [
          { id: 'assumer', label: 'Je m’expliquerai, j’assume', effects: [st('credibility', 2), st('popularity', -1)], end: 'Bonne chance pour expliquer ça aux mal-logés.' },
          { id: 'rouvrir', label: 'Revenez quand vous voudrez discuter', effects: [st('politicalCapital', -1)], end: 'Peut-être. Quand vous serez plus raisonnable.' },
        ],
      },
      retour_enquete: {
        text: 'Un juge s’intéresse aux dons reçus par les élus qui ont examiné le permis du Clos-Vert. Je ne dirai rien, évidemment. Vous non plus, j’espère ?',
        effects: [expo(4), st('stress', 3)],
        choices: [
          { id: 'silence', label: 'Je n’ai rien à cacher, je ne dirai rien', risk: { chance: 0.45, scaleWith: 'credibility', fail: 'mis_en_cause' }, end: 'Le juge a classé votre volet. Vous l’avez échappé belle.' },
          { id: 'declarer', label: 'Je déclare tout spontanément au juge', effects: [st('credibility', 3), expo(-2), st('politicalCapital', -3)], end: 'Vous me lâchez ? Je m’en souviendrai.' },
        ],
      },
      mis_en_cause: {
        text: 'Votre nom est cité dans le journal : « Dons du promoteur : les élus qui ont examiné le permis ». Je n’y suis pour rien.',
        effects: [st('credibility', -6), expo(5), st('popularity', -3)],
        choices: [
          { id: 'rembourser', label: 'Je rends le don et je m’explique', effects: [campagne(-6000), st('credibility', 2)], end: 'Comme vous voudrez. L’orage passera.' },
          { id: 'amalgame', label: 'Je dénonce un amalgame', effects: [st('credibility', -1), st('stress', 3)], end: 'Bon courage avec ça.' },
        ],
      },
      retour_creche: {
        text: 'La résidence est sortie de terre. La crèche ouvre lundi, quarante berceaux. Les familles du quartier sont ravies, et moi aussi, je l’avoue.',
        effects: [st('popularity', 3), ancrage(4), { kind: 'dossier', domain: 'social', delta: 1 }],
        choices: [
          { id: 'ruban', label: 'Je coupe le ruban', effects: [st('energy', -2), st('popularity', 1)], end: 'Les photographes sont là. Souriez !' },
          { id: 'familles', label: 'Laissons les familles inaugurer', effects: [st('credibility', 1)], end: 'Belle idée. Les parents ont adoré.' },
        ],
      },
      retour_refus: {
        text: 'Mon permis est passé sans vous. Et je finance désormais votre adversaire. Les élections coûtent cher, n’est-ce pas ?',
        effects: [momentum(-3)],
        choices: [
          { id: 'denoncer', label: 'Je le dirai publiquement', effects: [st('popularity', 2), st('credibility', 1), st('stress', 2)], end: 'Faites. Tout est parfaitement légal.' },
          { id: 'indifferent', label: 'Grand bien vous fasse', effects: [st('credibility', 1)], end: 'On verra qui rira le soir de l’élection.' },
        ],
      },
    },
  },

  // ── 11. La pétition contre l'antenne-relais ──
  {
    id: 'a_antenne', weight: 1, eligible: debuts,
    who: guestSpeaker('a_collectif', 'Collectif Ondes Tranquilles', 'Pétition'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => mem(d, 'a_voisin_antenne')
          ? 'Bonjour ! M. Garnier nous a dit que vous signeriez notre pétition contre l’antenne-relais du square. On publie la liste des signataires demain. On vous ajoute ?'
          : 'Bonjour, ici le collectif Ondes Tranquilles. 1 200 habitants ont signé contre l’antenne-relais prévue au square, à deux pas de l’école. Vous signez avec nous ?',
        choices: [
          { id: 'signer', label: 'Je signe', effects: [st('popularity', 2), st('credibility', -2), seg('retraites', 1), { kind: 'dossier', domain: 'numerique', delta: -1 }], remember: { a_antenne_signee: 1 }, next: 'signe' },
          { id: 'mesures', label: 'Je demande d’abord des mesures indépendantes', effects: [st('energy', -2), st('credibility', 2)], next: 'mesures' },
          { id: 'refuser', label: 'Les études sont rassurantes, je ne signe pas', effects: [st('credibility', 2), st('popularity', -2), seg('jeunes', 1), { kind: 'dossier', domain: 'numerique', delta: 2 }], end: 'On s’en souviendra dans les urnes.' },
          { id: 'chantage', label: 'Je ne signerai rien : on m’a fait chanter', if: d => mem(d, 'a_voisin_antenne') > 0, hint: 'Vous rompez le marché avec votre voisin', effects: [st('credibility', 3), expo(2)], end: 'Du chantage ? M. Garnier ? On va… en parler entre nous.', later: { months: 4, node: 'retour_garnier' } },
        ],
      },
      signe: {
        text: 'Merci ! Votre nom est en tête de liste. Un journaliste du quotidien local veut vous interroger sur les ondes.',
        choices: [
          { id: 'interview', label: 'J’y vais, je parle principe de précaution', effects: [st('popularity', 1)], risk: { chance: 0.4, scaleWith: 'credibility', fail: 'interview_rate' }, end: 'Interview claire et mesurée. Le collectif est ravi.' },
          { id: 'discret', label: 'Je préfère rester discret·e', effects: [st('credibility', 1)], end: 'Dommage, mais merci quand même.', later: { months: 6, node: 'retour_antenne' } },
        ],
      },
      interview_rate: {
        text: 'Le journaliste vous a demandé ce qui distingue la 4G de la 5G… Votre réponse fait sourire les spécialistes.',
        effects: [st('credibility', -3), seg('cadres', -1)],
        choices: [
          { id: 'reconnaitre', label: 'Je reconnais ne pas être expert·e', effects: [st('credibility', 1)], end: 'L’humilité, ça plaît aussi.' },
          { id: 'piege', label: 'Je dénonce une question piège', effects: [st('stress', 2)], end: 'Le journaliste publie l’échange intégral. Aïe.' },
        ],
      },
      mesures: {
        text: 'D’accord pour des mesures. Mais qui paie ? L’opérateur refuse, la mairie traîne.',
        choices: [
          { id: 'payer', label: 'J’en finance une partie de ma poche', effects: [perso(-1500), st('credibility', 2)], end: 'Merci ! Le laboratoire passe le mois prochain.', later: { months: 4, node: 'resultats' } },
          { id: 'pression', label: 'Je fais pression sur l’opérateur', effects: [st('politicalCapital', -3)], end: 'L’opérateur accepte de payer les mesures. On verra bien.', later: { months: 4, node: 'resultats' } },
        ],
      },
      resultats: {
        text: 'Les résultats sont là : exposition très inférieure aux seuils, même devant l’école. Le collectif est partagé : certains vous remercient, d’autres crient au rapport de complaisance.',
        effects: [st('credibility', 3), { kind: 'dossier', domain: 'numerique', delta: 1 }],
        choices: [
          { id: 'publier', label: 'Je publie tout, en toute transparence', effects: [st('credibility', 2), st('popularity', -1)], end: 'Les chiffres sont en ligne. Le débat se calme.' },
          { id: 'deplacer', label: 'Je propose de déplacer l’antenne de cent mètres', effects: [st('politicalCapital', -3), st('popularity', 2)], end: 'Compromis accepté. Tout le monde râle un peu, donc c’est juste.' },
        ],
      },
      retour_antenne: {
        text: 'L’antenne a été installée malgré la pétition. Vous aviez signé, vous vous souvenez ? Que comptez-vous faire maintenant ?',
        effects: [st('popularity', -1), st('stress', 1)],
        choices: [
          { id: 'recours', label: 'Je dépose un recours avec vous', effects: [st('energy', -3), st('popularity', 1), seg('retraites', 1)], end: 'Merci. On ne lâche rien.' },
          { id: 'rien', label: 'J’ai signé, je ne peux rien de plus', effects: [st('credibility', -1), st('popularity', -1)], end: 'Une signature, et puis plus rien. Typique.' },
        ],
      },
      retour_garnier: {
        text: 'Nous avons exclu M. Garnier du collectif. Il a publié sa vidéo de vous sur la place de livraison… elle fait un flop : les gens retiennent surtout son chantage.',
        effects: [st('credibility', 2), expo(-2), st('popularity', 1)],
        choices: [
          { id: 'merci', label: 'Merci de votre honnêteté', end: 'C’est la moindre des choses.' },
          { id: 'ecoute', label: 'Je reste à votre écoute sur l’antenne', effects: [st('energy', -1), seg('retraites', 1)], end: 'Alors on se reparlera. Sans chantage, cette fois.' },
        ],
      },
    },
  },

  // ── 12. Le président du club de foot ──
  {
    id: 'a_club_foot', weight: 1, eligible: debuts,
    who: guestSpeaker('a_club', 'Didier, président de l’US', 'Club de football'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Salut ! Didier, président de l’US. Notre minibus a rendu l’âme, et on a 140 gamins qui jouent le samedi aux quatre coins du département. Tu pourrais nous donner un coup de main ? On mettrait ton nom sur les maillots…',
        choices: [
          { id: 'mairie', label: 'Je demande une subvention au maire', if: d => mem(d, 'a_pacte_maire') > 0, hint: 'Votre arrangement avec le maire', effects: [st('politicalCapital', -2)], remember: { a_club_subvention: 1 }, next: 'subvention' },
          { id: 'don', label: 'Je participe de ma poche', effects: [perso(-2000), st('popularity', 2), seg('populaires', 1)], next: 'maillots' },
          { id: 'cagnotte', label: 'Lançons une cagnotte, je la relaie', effects: [st('energy', -3), st('popularity', 1)], risk: { chance: 0.4, scaleWith: 'popularity', fail: 'cagnotte_vide' }, end: 'Cagnotte remplie en dix jours ! Les gamins t’ont fait une banderole.' },
          { id: 'refuser', label: 'Je ne peux pas, désolé·e', effects: [st('popularity', -1)], end: 'Pas grave. On se débrouillera.' },
        ],
        ignore: [st('popularity', -1)],
      },
      subvention: {
        text: 'Le maire a signé la subvention en trois jours. Il a même posé avec nous pour la photo… sans toi. Bizarre, non ?',
        effects: [ancrage(2)],
        choices: [
          { id: 'essentiel', label: 'L’essentiel, c’est le minibus', effects: [st('credibility', 1)], end: 'T’es réglo. Viens au match samedi !', later: { months: 7, node: 'retour_coupe' } },
          { id: 'tribune', label: 'Je viendrai au prochain match en tribune', effects: [st('energy', -2), st('popularity', 2)], end: 'On te garde une place au premier rang.', later: { months: 7, node: 'retour_coupe' } },
        ],
      },
      maillots: {
        text: 'Merci, vraiment ! Alors, ton nom sur les maillots, on le met ?',
        choices: [
          { id: 'oui', label: 'Oui, en gros', effects: [st('popularity', 2), expo(1)], risk: { chance: 0.35, scaleWith: 'credibility', fail: 'regle' }, end: 'Ton nom en lettres blanches sur fond vert. Superbe !' },
          { id: 'non', label: 'Non, juste « Merci aux donateurs »', effects: [st('credibility', 2)], end: 'La classe. Les parents l’ont remarqué, crois-moi.', later: { months: 7, node: 'retour_coupe' } },
        ],
      },
      regle: {
        text: 'Problème : on nous dit que ton nom sur les maillots, c’est de la publicité politique déguisée. Il faut tout réimprimer.',
        effects: [st('credibility', -2), expo(2)],
        choices: [
          { id: 'payer', label: 'Je paie la réimpression', effects: [perso(-600)], end: 'Merci. Les nouveaux maillots sont encore plus beaux.' },
          { id: 'garder', label: 'Les gamins garderont les anciens', effects: [expo(2)], end: 'Bon… on croise les doigts.' },
        ],
      },
      cagnotte_vide: {
        text: 'La cagnotte stagne à 340 €. Les gens disent que c’est à la mairie de payer. On fait quoi ?',
        choices: [
          { id: 'completer', label: 'Je complète de ma poche', effects: [perso(-1600), st('popularity', 2)], end: 'T’es au top. Le minibus arrive lundi.' },
          { id: 'loto', label: 'On organise un loto', effects: [st('energy', -4), ancrage(2), st('popularity', 1)], end: 'Le loto a fait salle comble. Minibus payé !' },
        ],
      },
      retour_coupe: {
        text: 'Les U13 ont gagné la coupe départementale ! Ils veulent que tu remettes les médailles dimanche. Tous les parents seront là.',
        effects: [st('popularity', 2), ancrage(2)],
        choices: [
          { id: 'venir', label: 'J’y serai', effects: [st('energy', -2), st('popularity', 2), seg('populaires', 1)], end: 'Les gamins sont fous de joie. Prépare-toi à être aspergé·e de soda.' },
          { id: 'club', label: 'Je laisse l’honneur au club', effects: [st('credibility', 1)], end: 'T’es modeste. On t’enverra la photo.' },
        ],
      },
    },
  },

  // ── 13. L'ancien camarade de promo devenu lobbyiste ──
  {
    id: 'a_lobbyiste', weight: 1, eligible: d => terrain(d) && d.player.rankId === 'depute',
    who: guestSpeaker('a_lobbyiste', 'Arnaud, ancien de promo', 'Cabinet d’affaires publiques'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `Salut ! Arnaud, de la promo. Ça fait une paye ! Je travaille dans les affaires publiques, pour un opérateur télécom. ${mem(d, 'a_antenne_signee') ? 'J’ai vu que tu avais signé contre une antenne-relais… on en rira autour d’un verre. ' : ''}Un amendement en commission m’intéresse. Dîner jeudi, je t’invite ?`,
        choices: [
          { id: 'diner', label: 'Avec plaisir, en souvenir du bon vieux temps', effects: [st('energy', -2), st('influence', 2)], remember: { a_dette_lobby: 1 }, next: 'diner' },
          { id: 'registre', label: 'D’accord, mais à mon bureau, et déclaré', effects: [st('credibility', 3), st('energy', -2)], next: 'bureau' },
          { id: 'refuser', label: 'Je ne parle pas d’amendements à table', effects: [st('credibility', 2), st('influence', -1)], end: d => `Toujours aussi ${g(d, 'droit', 'droite')}. Bon, à la prochaine soirée des anciens.` },
        ],
      },
      diner: {
        text: 'Excellente soirée ! Voilà l’amendement, deux lignes. Si tu le déposes, mon client saura se montrer reconnaissant… envers ta circonscription, j’entends.',
        choices: [
          { id: 'deposer', label: 'Je le dépose tel quel', effects: [st('influence', 3), st('credibility', -3), { kind: 'dossier', domain: 'numerique', delta: 1 }, expo(3)], end: 'Tu ne le regretteras pas.', later: { months: 8, node: 'retour_lobby' } },
          { id: 'reecrire', label: 'Je le réécris à ma façon', effects: [st('energy', -3), st('credibility', 1), { kind: 'dossier', domain: 'numerique', delta: 2 }], risk: { chance: 0.4, scaleWith: 'credibility', fail: 'photo_diner' }, end: 'Ta version est moins généreuse, mais elle passe. Bien joué.' },
          { id: 'decliner', label: 'Finalement, non', effects: [st('influence', -1)], end: 'Dommage. Le dîner, c’était pour l’amitié, bien sûr.' },
        ],
      },
      bureau: {
        text: 'Rendez-vous déclaré, très bien. Voici notre note. Franchement, c’est d’intérêt général : couvrir les zones blanches de ta circonscription.',
        choices: [
          { id: 'etudier', label: 'Je l’étudie sérieusement', effects: [st('energy', -2), { kind: 'dossier', domain: 'numerique', delta: 3 }, st('credibility', 1)], end: 'Merci. C’est tout ce que je demandais.', later: { months: 8, node: 'retour_zones' } },
          { id: 'ecarter', label: 'Je n’en ferai rien', effects: [st('influence', -1)], end: 'Tant pis. Bonne continuation, cher collègue de promo.' },
        ],
      },
      photo_diner: {
        text: d => `Un média en ligne publie une photo de notre dîner : « ${g(d, 'Le député', 'La députée')} et le lobbyiste ». Désolé, je n’avais pas vu le photographe.`,
        effects: [st('credibility', -4), expo(4)],
        choices: [
          { id: 'agenda', label: 'Je publie mon agenda complet', effects: [st('credibility', 2), st('energy', -2)], end: 'Transparence totale. Ça calme le jeu.' },
          { id: 'amis', label: 'Je dis que c’était un dîner entre amis', effects: [st('credibility', -1)], end: 'Personne n’y croit vraiment.' },
        ],
      },
      retour_lobby: {
        text: 'Mon client a été ravi. Il implante un centre de données dans ta circonscription : 80 emplois. Il aimerait maintenant que tu soutiennes un autre texte… On en parle ?',
        effects: [st('popularity', 2), ancrage(3), expo(2)],
        choices: [
          { id: 'stop', label: 'Merci pour les emplois, mais on s’arrête là', effects: [st('credibility', 2), st('influence', -2)], end: 'Comme tu veux. Le centre est signé, de toute façon.' },
          { id: 'parler', label: 'On en parle', effects: [st('influence', 3), expo(3), st('credibility', -2)], end: 'Je savais qu’on se comprenait.' },
        ],
      },
      retour_zones: {
        text: 'Ton amendement sur les zones blanches est passé ! Trois vallées de ta circonscription auront du réseau l’an prochain. Mon client, ravi, n’a rien demandé de plus.',
        effects: [seg('ruraux', 3), { kind: 'dossier', domain: 'numerique', delta: 2 }, st('popularity', 1)],
        choices: [
          { id: 'annoncer', label: 'Je vais l’annoncer sur place', effects: [st('energy', -3), ancrage(3)], end: 'Les maires des vallées t’attendent avec du vin chaud.' },
          { id: 'merci', label: 'Merci pour la note, Arnaud', end: 'Avec plaisir. Toujours dans les règles.' },
        ],
      },
    },
  },

  // ── 14. L'attaché·e de presse et le journaliste local ──
  {
    id: 'a_attache_presse', weight: 1, eligible: d => debuts(d) && hasRole(d, 'attache_presse'),
    who: teamSpeaker('attache_presse'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `Un journaliste du quotidien local prépare un portrait de vous. ${mem(d, 'a_pacte_maire') ? 'Il pose beaucoup de questions sur vos rapports avec le maire. ' : ''}${mem(d, 'a_promoteur_dette') ? 'Et il a la liste des donateurs de votre association de financement. ' : ''}${mem(d, 'a_terrasse_faveur') ? 'Il a aussi entendu parler d’une terrasse au Café des Halles. ' : ''}${mem(d, 'a_dette_lobby') ? 'Et il a une photo de vous au restaurant avec un lobbyiste. ' : ''}Il veut une interview vendredi. Je lui dis quoi ?`,
        choices: [
          { id: 'interview', label: 'J’accepte, on prépare ensemble', effects: [st('energy', -4), st('popularity', 1)], next: 'prepa' },
          { id: 'refuser', label: 'Pas d’interview', effects: [st('popularity', -1), expo(1)], end: 'Entendu. Il écrira sans vous, alors.', later: { months: 3, node: 'retour_portrait' } },
          { id: 'contre_feu', label: 'Donnez-lui plutôt une info sur mon adversaire', hint: 'Risqué pour votre crédibilité', effects: [st('credibility', -1), moral(-2)], risk: { chance: 0.5, scaleWith: 'credibility', fail: 'boomerang' }, end: 'Il a mordu à l’hameçon. Votre adversaire passe un mauvais week-end.' },
        ],
        ignore: [moral(-3)],
      },
      prepa: {
        text: 'Je vous ai préparé dix questions pièges. La plus dure : « Qu’avez-vous fait concrètement pour la ville ? » Vous répondez comment ?',
        choices: [
          { id: 'bilan', label: 'Je déroule mon bilan, chiffres à l’appui', effects: [st('credibility', 3), st('energy', -2)], end: 'Parfait. Le portrait sera flatteur, je le sens.', later: { months: 3, node: 'publie' } },
          { id: 'anecdote', label: 'Je raconte une histoire de terrain', effects: [st('popularity', 2)], risk: { chance: 0.35, scaleWith: 'popularity', fail: 'derapage' }, end: 'Votre anecdote fait le titre du portrait. Très bon.' },
          { id: 'franchise', label: 'Je vide mon sac sur les dossiers gênants', if: d => mem(d, 'a_pacte_maire') + mem(d, 'a_promoteur_dette') + mem(d, 'a_terrasse_faveur') + mem(d, 'a_dette_lobby') > 0, hint: 'Prendre les devants', effects: [st('credibility', 4), expo(-3), st('politicalCapital', -3)], end: 'Vous avez coupé l’herbe sous le pied à toutes les rumeurs. Gonflé.' },
        ],
      },
      derapage: {
        text: 'Dans votre anecdote, vous avez cité le prénom d’une habitante. Elle s’est reconnue, et elle n’est pas contente du tout.',
        effects: [st('credibility', -2), st('popularity', -1), expo(1)],
        choices: [
          { id: 'excuses', label: 'Je l’appelle pour m’excuser', effects: [st('energy', -2), st('credibility', 1)], end: 'Elle a accepté vos excuses. Ouf.' },
          { id: 'rectificatif', label: 'Je demande un rectificatif au journal', effects: [st('politicalCapital', -1)], end: 'Le rectificatif paraîtra en page 14. Personne ne le lira.' },
        ],
      },
      boomerang: {
        text: 'Le journaliste a vérifié l’info : elle était fausse. Il écrit maintenant sur « les méthodes de votre entourage ». Et il me cite.',
        effects: [st('credibility', -5), expo(3), moral(-6)],
        choices: [
          { id: 'couvrir', label: 'Je vous couvre, c’était mon idée', effects: [st('credibility', 1), moral(5)], end: 'Merci. Je ne l’oublierai pas.' },
          { id: 'lacher', label: 'Vous avez agi de votre propre chef', effects: [depart, st('credibility', 1)], end: 'De mon propre chef ? Très bien. Ma démission sera sur votre bureau demain.' },
        ],
      },
      retour_portrait: {
        text: d => `Le portrait est paru sans vous. Titre : « ${g(d, 'L’élu', 'L’élue')} qui fuit les questions ». ${mem(d, 'a_pacte_maire') ? 'Un paragraphe entier sur la piscine du maire.' : 'Rien de grave, mais le ton est sec.'}`,
        effects: [st('popularity', -2), st('credibility', -1)],
        choices: [
          { id: 'reponse', label: 'On demande un droit de réponse', effects: [st('energy', -2), st('credibility', 2)], end: 'Je m’en occupe. Il paraîtra jeudi.' },
          { id: 'tourner', label: 'On passe à autre chose', effects: [st('stress', 1)], end: 'Entendu. La semaine prochaine, on l’aura oublié.' },
        ],
      },
      publie: {
        text: 'Le portrait est paru : pleine page, photo flatteuse, votre bilan en encadré. Trois autres médias me demandent une interview.',
        effects: [st('popularity', 2), st('influence', 2), moral(3)],
        choices: [
          { id: 'toutes', label: 'Acceptez-les toutes', effects: [st('energy', -4), st('popularity', 2)], end: 'Agenda bouclé. Ça va être une grosse semaine.' },
          { id: 'une', label: 'Une seule, la plus sérieuse', effects: [st('credibility', 2)], end: 'Bon choix. La rareté fait le prix.' },
        ],
      },
    },
  },

  // ── 15. Le chauffeur a vu quelque chose ──
  {
    id: 'a_chauffeur_vu', weight: 1, eligible: d => terrain(d) && !rankAtLeast(d, 4) && hasRole(d, 'chauffeur'),
    who: teamSpeaker('chauffeur'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => {
          const qui = mem(d, 'a_julien_ecrase') ? 'Julien, de votre section' : mem(d, 'a_alliance_ferrand') ? 'Mme Ferrand, de l’opposition' : 'un responsable de votre parti';
          const avec = mem(d, 'a_promoteur_refus') || mem(d, 'a_promoteur_dette') ? 'M. Sabatier, le promoteur' : 'un journaliste du quotidien local';
          return `Je ne sais pas si je dois vous le dire… Hier soir, en vous attendant, j’ai vu ${qui} sortir d’un restaurant avec ${avec}. Ils avaient l’air très complices.`;
        },
        choices: [
          { id: 'photo', label: 'Vous avez pris une photo ?', next: 'photo' },
          { id: 'oublier', label: 'Ça ne nous regarde pas, oubliez ça', effects: [st('credibility', 1), moral(2)], end: 'Bien compris. Je n’ai rien vu.' },
          { id: 'surveiller', label: 'Gardez les yeux ouverts, discrètement', effects: [st('influence', 1), moral(-3)], remember: { a_info_chauffeur: 1 }, end: 'Je ne suis pas détective, mais d’accord.', later: { months: 5, node: 'retour_info' } },
        ],
        ignore: [moral(-2)],
      },
      photo: {
        text: 'Oui, une, de loin. On voit bien les visages. Je vous l’envoie ?',
        choices: [
          { id: 'utiliser', label: 'Envoyez. Ça peut servir', effects: [st('influence', 3)], remember: { a_info_chauffeur: 1 }, risk: { chance: 0.4, scaleWith: 'credibility', fail: 'fuite_photo' }, end: 'Envoyée. Je l’efface de mon téléphone.' },
          { id: 'effacer', label: 'Effacez-la, je ne veux pas jouer à ça', effects: [st('credibility', 2), moral(3)], end: 'C’est tout à votre honneur. Effacée.', later: { months: 6, node: 'retour_loyal' } },
        ],
      },
      retour_info: {
        text: 'Je les ai revus, trois fois ce mois-ci. Ce soir, en sortant, ils ont parlé de vous à voix haute : une histoire de « dossier » à sortir avant les élections.',
        effects: [st('stress', 2)],
        choices: [
          { id: 'devancer', label: 'Je prépare une contre-attaque', effects: [st('energy', -3), st('influence', 2), expo(-2)], end: 'Si on sait ce qu’ils préparent, on a un coup d’avance.' },
          { id: 'face', label: 'Je vais les voir en face', effects: [st('credibility', 2), st('stress', 2)], risk: { chance: 0.4, scaleWith: 'influence', fail: 'confrontation' }, end: 'Ils ont bafouillé. Le « dossier » ne sortira pas.' },
        ],
      },
      confrontation: {
        text: 'La rencontre s’est mal passée : ils racontent partout que vous les faites suivre par votre chauffeur. C’est-à-dire moi.',
        effects: [st('credibility', -3), expo(3), moral(-4)],
        choices: [
          { id: 'nier', label: 'Je nie et je change de sujet', effects: [st('credibility', -1)], end: 'Bon. Moi, je fais profil bas.' },
          { id: 'maladresse', label: 'Je reconnais une maladresse', effects: [st('credibility', 1), moral(2)], end: 'Merci. Je préfère rester dans l’ombre, c’est mon métier.' },
        ],
      },
      fuite_photo: {
        text: 'La photo a fuité. Tout le monde sait qu’elle vient de votre voiture. On parle de « méthodes de barbouzes ».',
        effects: [st('credibility', -4), expo(4), moral(-5)],
        choices: [
          { id: 'assumer', label: 'Je prends tout sur moi', effects: [st('credibility', 1), moral(4)], end: 'Merci de me couvrir.' },
          { id: 'lacher', label: 'Mon chauffeur a pris l’initiative', effects: [depart, st('credibility', -1)], end: 'Si c’est comme ça… je rends les clés ce soir.' },
        ],
      },
      retour_loyal: {
        text: 'Je voulais vous dire : on m’a proposé 500 € pour savoir où vous alliez et qui vous voyiez. J’ai refusé, évidemment. Vous avez été réglo avec moi.',
        effects: [moral(5), expo(-2)],
        choices: [
          { id: 'prime', label: 'Merci. Voilà une prime pour vous', effects: [perso(-500), moral(6)], end: 'Ce n’était pas pour ça, mais merci.' },
          { id: 'qui', label: 'Vous savez qui a proposé ?', effects: [st('influence', 2)], end: 'Je n’ai pas de nom. Mais la voiture avait un macaron de la mairie.' },
        ],
      },
    },
  },

  // ── 16. L'assistant·e parlementaire veut se présenter ──
  {
    id: 'a_assistant_candidat', weight: 1, eligible: d => terrain(d) && rankAtLeast(d, 2) && !rankAtLeast(d, 4) && hasRole(d, 'assistant_parlementaire'),
    who: teamSpeaker('assistant_parlementaire'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Je voulais vous en parler avant tout le monde : on me propose de conduire une liste aux municipales dans ma commune. Je resterais avec vous, à mi-temps pendant la campagne. Vous en pensez quoi ?',
        choices: [
          { id: 'soutenir', label: 'Foncez, je vous soutiens', effects: [moral(8), st('energy', -2), st('stress', 2)], remember: { a_assistant_soutenu: 1 }, next: 'soutien' },
          { id: 'reporter', label: 'Attendez le prochain mandat, j’ai besoin de vous', effects: [moral(-5)], risk: { chance: 0.4, scaleWith: 'influence', fail: 'depart' }, end: 'D’accord… je reporte. Mais je n’oublierai pas.' },
          { id: 'interdire', label: 'C’est incompatible avec votre poste', effects: [moral(-10), st('credibility', 1)], next: 'ultimatum' },
        ],
      },
      soutien: {
        text: 'Merci ! Est-ce que je peux mettre votre photo sur ma profession de foi ? Ça m’aiderait beaucoup.',
        choices: [
          { id: 'photo', label: 'Oui, ma photo et mon soutien officiel', effects: [st('influence', 1), expo(1), cohesion(-1)], end: 'Génial ! Je vous montre le tract demain.', later: { months: 6, node: 'elu' } },
          { id: 'discret', label: 'Soutien discret, sans ma photo', effects: [st('credibility', 1)], end: 'Je comprends. Merci quand même.', later: { months: 6, node: 'elu_discret' } },
        ],
      },
      elu: {
        text: 'J’ai gagné ! 52 % au second tour. Ma commune sera votre meilleure alliée dans la circonscription. Je dois en revanche quitter votre équipe : la mairie, c’est à plein temps.',
        effects: [depart, st('influence', 3), ancrage(4), st('popularity', 1)],
        choices: [
          { id: 'bravo', label: 'Félicitations, et bon mandat', end: 'Merci pour tout. Appelez-moi quand vous voulez.' },
          { id: 'reseau', label: 'Je compte sur vous pour la suite', effects: [st('politicalCapital', 2)], end: 'Évidemment. Vous aurez mon soutien, et celui de mon conseil.' },
        ],
      },
      elu_discret: {
        text: 'J’ai gagné, de justesse ! Je quitte votre équipe pour la mairie. Sans rancune pour la photo : vous aviez sans doute raison.',
        effects: [depart, ancrage(2), st('influence', 1)],
        choices: [
          { id: 'bravo', label: 'Bravo, et bon mandat', end: 'Merci. Je n’oublie pas d’où je viens.' },
          { id: 'contact', label: 'Restons en contact', effects: [st('energy', -1), st('politicalCapital', 1)], end: 'Bien sûr. Ma porte vous est grande ouverte.' },
        ],
      },
      ultimatum: {
        text: 'Alors je dois choisir ? Je vous ai donné trois ans. Je crois que je vais choisir ma commune.',
        effects: [st('stress', 2)],
        choices: [
          { id: 'lacher', label: 'Bonne chance, alors', effects: [depart, { kind: 'team', morale: -4, all: true }], end: 'Merci quand même. Je vous enverrai les dossiers en cours.' },
          { id: 'ceder', label: 'Restez, faites campagne, on s’organisera', effects: [moral(6), st('energy', -3)], remember: { a_assistant_soutenu: 1 }, end: 'Merci. Je savais que vous finiriez par comprendre.', later: { months: 6, node: 'elu_discret' } },
        ],
      },
      depart: {
        text: 'Désolé·e, j’ai réfléchi : je pars faire campagne. Je vous remets ma démission.',
        effects: [depart, { kind: 'team', morale: -4, all: true }, st('stress', 2)],
        choices: [
          { id: 'comprendre', label: 'Je comprends. Bonne campagne', effects: [st('credibility', 1)], end: 'Merci. Vous allez me manquer.' },
          { id: 'reproche', label: 'Vous me lâchez en pleine session', effects: [st('stress', 1)], end: 'Je suis désolé·e que vous le voyiez comme ça.' },
        ],
      },
    },
  },

  // ── 17. Un SMS du préfet : l'usine va fermer ──
  {
    id: 'a_sms_prefet', weight: 1, eligible: eluLocal,
    who: guestSpeaker('a_prefet', 'Le préfet', 'Préfecture'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Bonsoir. Je vous informe à titre confidentiel : le groupe propriétaire de l’usine de la zone nord annoncera lundi la fermeture du site. 230 emplois. Je compte sur votre discrétion d’ici là. L’État prépare un accompagnement.',
        choices: [
          { id: 'secret', label: 'Vous avez ma parole', effects: [st('politicalCapital', 2)], remember: { a_prefet_secret: 1 }, next: 'reunion' },
          { id: 'salaries', label: 'Je préviens les représentants des salariés', effects: [seg('populaires', 3), st('popularity', 1), st('politicalCapital', -4), st('credibility', -1)], next: 'fache' },
          { id: 'reprise', label: 'Je prépare dès ce soir un plan de reprise', effects: [st('energy', -6), { kind: 'dossier', domain: 'economie', delta: 3 }], next: 'reprise' },
        ],
        ignore: [st('politicalCapital', -1)],
      },
      reunion: {
        text: d => `Merci. Je vous convie lundi à la réunion de crise en préfecture, avant l’annonce. Vous serez ${g(d, 'le seul élu', 'la seule élue')} de votre bord.`,
        choices: [
          { id: 'aller', label: 'J’y serai', effects: [st('energy', -3), st('influence', 3)], end: 'Parfait. 8 h, entrée côté jardin.', later: { months: 4, node: 'retour_ouvriers' } },
          { id: 'exiger', label: 'Seulement si les salariés sont reçus aussi', effects: [st('credibility', 2), st('politicalCapital', -2), seg('populaires', 1)], end: d => `Je verrai ce que je peux faire. Vous êtes ${g(d, 'exigeant', 'exigeante')}.` },
        ],
      },
      fache: {
        text: d => `Je constate que la confidentialité n’est pas votre fort. Vous ne serez plus ${g(d, 'informé', 'informée')} à l’avance. Les salariés occupent l’usine depuis ce matin.`,
        effects: [st('politicalCapital', -2), seg('populaires', 1)],
        choices: [
          { id: 'soutenir', label: 'Je vais soutenir les salariés sur place', effects: [st('energy', -4), st('popularity', 3), seg('populaires', 2)], end: 'Les salariés vous ont accueilli·e sous les applaudissements. La préfecture, beaucoup moins.' },
          { id: 'mediation', label: 'Je joue les médiateurs avec la direction', effects: [st('energy', -5), st('credibility', 2)], risk: { chance: 0.45, scaleWith: 'influence', fail: 'mediation_rate' }, end: 'Une table ronde est organisée. Grâce à vous, personne n’a claqué la porte.' },
        ],
      },
      mediation_rate: {
        text: 'La médiation a échoué devant les caméras : la direction a quitté la salle. Les salariés vous reprochent votre « naïveté ».',
        effects: [st('credibility', -3), seg('populaires', -2)],
        choices: [
          { id: 'rester', label: 'Je reste à leurs côtés', effects: [st('energy', -3), seg('populaires', 2)], end: 'Ils l’ont remarqué. Ça compte.' },
          { id: 'etat', label: 'Je laisse l’État reprendre la main', effects: [st('politicalCapital', 1)], end: 'Je reprends le dossier. Merci de votre aide.' },
        ],
      },
      reprise: {
        text: 'Un plan de reprise en un week-end ? Si vous trouvez un repreneur sérieux, je vous ouvre toutes les portes de l’administration. Sinon, n’en parlons plus.',
        choices: [
          { id: 'chercher', label: 'Je mobilise mon carnet d’adresses', effects: [st('energy', -4)], risk: { chance: 0.55, scaleWith: 'influence', fail: 'sans_repreneur' }, next: 'repreneur' },
          { id: 'scop', label: 'Je propose une coopérative aux salariés', effects: [st('energy', -3), seg('populaires', 2), { kind: 'dossier', domain: 'economie', delta: 1 }], end: 'Une coopérative ? Ambitieux. On verra si les salariés suivent.', later: { months: 8, node: 'retour_scop' } },
        ],
      },
      repreneur: {
        text: 'Un industriel de la région est intéressé : il reprendrait 150 salariés sur 230. Je dois dire que vous m’impressionnez.',
        effects: [{ kind: 'dossier', domain: 'economie', delta: 3 }, st('influence', 3), st('popularity', 2)],
        choices: [
          { id: 'signer', label: 'On signe, 150 emplois sauvés', effects: [seg('populaires', 2)], end: 'Je prépare les documents.', later: { months: 6, node: 'retour_repreneur' } },
          { id: 'plus', label: 'Je me bats pour les 230', effects: [st('politicalCapital', -3), st('energy', -2), seg('populaires', 1)], end: 'L’industriel a réfléchi : il monte à 170. Je n’aurais pas parié dessus.', later: { months: 6, node: 'retour_repreneur' } },
        ],
      },
      sans_repreneur: {
        text: 'Personne de sérieux. Le week-end est passé, l’annonce est tombée. Vous avez fait de votre mieux.',
        effects: [st('stress', 3), st('energy', -2)],
        choices: [
          { id: 'salaries', label: 'Je soutiens les salariés', effects: [seg('populaires', 2)], end: 'Ils vous en sauront gré.' },
          { id: 'accompagnement', label: 'Je pousse l’accompagnement de l’État', effects: [st('credibility', 1)], end: 'Je transmets à Paris. Merci.' },
        ],
      },
      retour_ouvriers: {
        text: 'Je vous préviens : les salariés ont appris que des élus savaient tout une semaine avant eux. Votre nom circule sur le piquet de grève.',
        effects: [seg('populaires', -3), st('popularity', -2), st('stress', 2)],
        choices: [
          { id: 'expliquer', label: 'Je vais m’expliquer devant eux', effects: [st('energy', -4), st('credibility', 2), seg('populaires', 1)], end: 'Ils vous ont écouté·e jusqu’au bout. Pas convaincus, mais respectueux.' },
          { id: 'secret_etat', label: 'J’ai respecté la parole donnée à l’État', effects: [st('credibility', 1), seg('populaires', -1), st('politicalCapital', 2)], end: 'C’est à votre honneur. L’État s’en souviendra.' },
        ],
      },
      retour_repreneur: {
        text: 'L’usine a rouvert sous un nouveau nom. Les salariés repris vous ont fait parvenir une photo de groupe, devant les machines.',
        effects: [st('popularity', 3), seg('populaires', 2), ancrage(3)],
        choices: [
          { id: 'visiter', label: 'Je viens visiter le site', effects: [st('energy', -2), st('popularity', 1)], end: 'On vous attend. Casque et gilet fournis.' },
          { id: 'afficher', label: 'Je l’affiche dans ma permanence', end: 'Belle photo. Elle a sa place.' },
        ],
      },
      retour_scop: {
        text: 'La coopérative a vu le jour avec 80 salariés associés. Le chemin est rude, mais le carnet de commandes se remplit.',
        effects: [{ kind: 'dossier', domain: 'economie', delta: 2 }, seg('populaires', 2), st('popularity', 2)],
        choices: [
          { id: 'commande', label: 'Je passe une commande pour ma permanence', effects: [perso(-400), st('popularity', 1)], end: 'Le geste a touché les salariés.' },
          { id: 'pret', label: 'Je plaide pour un prêt régional', effects: [st('politicalCapital', -3), { kind: 'dossier', domain: 'economie', delta: 1 }], end: 'Le prêt est accordé. Ils respirent.' },
        ],
      },
    },
  },

  // ── 18. La cagnotte pour une famille sinistrée ──
  {
    id: 'a_cagnotte', weight: 1, eligible: debuts,
    who: guestSpeaker('a_entraide', 'Hélène, collectif d’entraide', 'Entraide du quartier'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `Bonjour, Hélène, du collectif d’entraide. La maison de la famille Moreau a brûlé cette nuit : personne n’est blessé, mais ils ont tout perdu. ${mem(d, 'a_ecole_mobilisee') ? 'Leurs enfants sont à Jules-Ferry ; Mme Aubert m’a dit qu’on pouvait compter sur vous. ' : ''}On a lancé une cagnotte. Vous pouvez la relayer ?`,
        choices: [
          { id: 'discret', label: 'Je donne, discrètement', effects: [perso(-500), st('credibility', 1)], end: 'Merci du fond du cœur. Personne ne le saura, c’est promis.', later: { months: 4, node: 'retour_moreau' } },
          { id: 'relayer', label: 'Je relaie et je donne publiquement', effects: [perso(-500), st('popularity', 2)], risk: { chance: 0.4, scaleWith: 'credibility', fail: 'recuperation' }, end: 'Votre partage a fait exploser les dons : 14 000 € en deux jours !' },
          { id: 'logement', label: 'Je leur trouve un logement d’urgence', if: d => rankAtLeast(d, 1), hint: 'Vos réseaux d’élu·e', effects: [st('politicalCapital', -3), st('energy', -3), ancrage(3)], next: 'logement' },
          { id: 'rien', label: 'Je ne mélange pas politique et charité', effects: [st('popularity', -2)], end: 'Ce n’était pas de la politique. C’étaient des voisins.' },
        ],
      },
      logement: {
        text: 'Un appartement d’urgence est libre dès ce soir ! Ils n’en reviennent pas. M. Moreau voudrait vous remercier en personne.',
        effects: [st('popularity', 2)],
        choices: [
          { id: 'visite', label: 'Je passe les voir, sans photographe', effects: [st('energy', -2), st('credibility', 2)], end: 'Il vous a serré la main longtemps. Ça valait tous les discours.', later: { months: 4, node: 'retour_moreau' } },
          { id: 'inutile', label: 'Pas la peine, l’essentiel est fait', end: 'Quelle modestie. Je leur transmets.' },
        ],
      },
      recuperation: {
        text: 'Des commentaires vous accusent de « récupérer le malheur des Moreau ». Un opposant a fait une capture de votre message.',
        effects: [st('credibility', -2), st('popularity', -1), expo(1)],
        choices: [
          { id: 'supprimer', label: 'Je supprime le message, seule la cagnotte compte', effects: [st('credibility', 1)], end: 'Les dons continuent d’arriver. C’est ce qui compte.' },
          { id: 'repondre', label: 'Je réponds aux critiques', effects: [st('stress', 2), st('popularity', 1)], end: 'Le débat s’envenime un peu, puis s’éteint.' },
        ],
      },
      retour_moreau: {
        text: 'Les Moreau ont retrouvé une maison. Ils organisent une petite fête pour remercier tous ceux qui ont aidé, et tiennent à ce que vous veniez.',
        effects: [st('popularity', 1), ancrage(2)],
        choices: [
          { id: 'venir', label: 'J’y vais avec plaisir', effects: [st('energy', -2), st('popularity', 2), seg('populaires', 1)], end: 'Les enfants vous ont fait un dessin. Il est sur le frigo de la permanence, maintenant.' },
          { id: 'fleurs', label: 'Je fais livrer des fleurs', effects: [perso(-60)], end: 'Les fleurs trônent au milieu de la table. Merci.' },
        ],
      },
    },
  },

  // ── 19. La fête du village et le discours (Maman a promis pour vous) ──
  {
    id: 'a_fete_village', weight: 1, eligible: debuts,
    who: familySpeaker('Maman'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `${g(d, 'Mon chéri', 'Ma chérie')}, j’ai croisé le comité des fêtes au marché. Je leur ai dit que tu ferais le discours de la fête du village samedi. Tu ne m’en veux pas ? ${mem(d, 'a_maire_ennemi') ? 'Le maire faisait une drôle de tête quand je l’ai dit.' : 'Le maire avait l’air ravi.'}`,
        choices: [
          { id: 'accepter', label: 'D’accord maman, je le ferai', effects: [st('energy', -3)], next: 'discours' },
          { id: 'refuser', label: 'Maman, tu aurais dû me demander', effects: [st('stress', 1), st('popularity', -1)], end: d => `Bon… je leur dirai que tu es ${g(d, 'débordé', 'débordée')}. Ta tante sera déçue.` },
          { id: 'deleguer', label: 'J’envoie quelqu’un de mon équipe', if: d => d.player.team.length > 0, effects: [ancrage(-1)], end: 'Quelqu’un de ton équipe ? Les gens voulaient te voir, toi.' },
        ],
      },
      discours: {
        text: d => `Le comité te laisse cinq minutes, entre la tombola et le lâcher de ballons. ${mem(d, 'a_ruraux_promesse') ? 'Les éleveurs du comité parlent encore de ta promesse au barrage. ' : ''}Tu vas dire quoi ? Fais court, les gens ont faim.`,
        choices: [
          { id: 'humour', label: 'Un discours drôle et léger', effects: [st('popularity', 1)], risk: { chance: 0.4, scaleWith: 'popularity', fail: 'blague' }, next: 'succes' },
          { id: 'politique', label: 'Un vrai discours sur l’avenir du village', effects: [st('credibility', 2), st('energy', -2), seg('ruraux', 1)], end: 'Les gens ont écouté poliment. Ton oncle dit que c’était « un peu long ».', later: { months: 10, node: 'retour_fete' } },
          { id: 'maire', label: 'Je rends hommage au maire', if: d => mem(d, 'a_pacte_maire') > 0, hint: 'Votre arrangement avec le maire', effects: [st('politicalCapital', 2), st('credibility', -1)], end: 'Le maire t’a donné l’accolade. Les gens ont trouvé ça un peu arrangé.' },
        ],
      },
      succes: {
        text: d => `Tu as fait rire tout le monde ! Même Mme Lefèvre, qui ne rit jamais. Le comité veut te nommer ${g(d, 'président', 'présidente')} d’honneur.`,
        effects: [ancrage(3), st('popularity', 1)],
        choices: [
          { id: 'accepter', label: 'J’accepte avec plaisir', effects: [st('energy', -2), ancrage(2)], remember: { a_discours_fete: 1 }, end: 'Ils vont graver ton nom sur la coupe du concours de pétanque !', later: { months: 10, node: 'retour_fete' } },
          { id: 'decliner', label: 'Qu’ils choisissent plutôt un bénévole', effects: [st('credibility', 1)], end: 'C’est gentil de ta part. Le comité est touché.' },
        ],
      },
      blague: {
        text: 'Ta blague sur les impôts locaux n’a pas fait rire grand monde… surtout pas le maire. Ton oncle dit que c’était « limite ».',
        effects: [st('popularity', -2), st('politicalCapital', -1)],
        choices: [
          { id: 'excuses', label: 'Je m’excuse au micro', effects: [st('credibility', 1)], end: 'Les gens ont applaudi ton excuse. Plus que la blague.' },
          { id: 'assumer', label: 'C’était de l’humour, quand même', effects: [st('stress', 1)], end: 'Si tu le dis. Ta tante, elle, rit encore.' },
        ],
      },
      retour_fete: {
        text: d => `${g(d, 'Mon chéri', 'Ma chérie')}, le comité des fêtes prépare l’édition de cette année. ${mem(d, 'a_discours_fete') ? `En tant que ${g(d, 'président', 'présidente')} d’honneur, ils comptent sur toi pour l’ouvrir.` : 'Ils se demandent si tu reviendras faire un discours.'} Et ils voudraient un petit coup de pouce pour la buvette…`,
        effects: [st('popularity', 1)],
        choices: [
          { id: 'revenir', label: 'Je viendrai, et je paie la sono', effects: [perso(-400), st('popularity', 2), ancrage(3)], end: 'Je le savais ! Je préviens tout le monde.' },
          { id: 'non', label: 'Pas cette année, je suis trop pris·e', effects: [ancrage(-2)], end: 'Bon. Je leur dirai. Mais ils seront déçus, tu sais.' },
        ],
      },
    },
  },

  // ── 20. Le vieux militant qui menace de rendre sa carte ──
  {
    id: 'a_vieux_militant', weight: 1, eligible: debuts,
    who: guestSpeaker('a_raymond', 'Raymond, militant depuis 1981', 'Votre section'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `C’est Raymond. Quarante ans de carte, et je crois que je vais la rendre. La direction a lâché les retraités, et toi tu n’as rien dit. ${mem(d, 'a_caisse_denoncee') ? 'Et tu as livré Michel à la fédé, un camarade de trente ans. ' : mem(d, 'a_caisse_couverte') ? 'Michel m’a dit que tu l’avais tiré d’affaire, je sais que tu as du cœur. ' : ''}Convaincs-moi de rester.`,
        choices: [
          { id: 'visite', label: 'Je passe te voir demain, on en parle', effects: [st('energy', -4)], next: 'cuisine' },
          { id: 'ligne', label: 'La ligne du parti est la bonne, Raymond', effects: [cohesion(1), seg('retraites', -1), membres(-3)], end: 'Alors je la rends. Salut.', later: { months: 6, node: 'retour_rendu' } },
          { id: 'laisser', label: 'Je respecte ton choix', effects: [membres(-2)], end: 'Tu ne cherches même pas à me retenir… Ça en dit long.', later: { months: 6, node: 'retour_rendu' } },
        ],
        ignore: [membres(-3), seg('retraites', -1)],
      },
      cuisine: {
        text: d => `Merci d’être ${g(d, 'venu', 'venue')}. Café, madeleines… Regarde cette photo de 1981, le soir de la victoire : on y croyait, nous. Et toi, tu crois à quoi ?`,
        choices: [
          { id: 'sincere', label: 'Je lui parle de ce qui me fait tenir', effects: [st('credibility', 2), st('stress', -2)], next: 'reste' },
          { id: 'porte_voix', label: 'Je porterai la voix des retraités au parti', effects: [st('politicalCapital', -3), seg('retraites', 3)], remember: { a_raymond_retenu: 1 }, next: 'reste' },
          { id: 'julien', label: 'Les jeunes de Julien ont besoin d’un ancien', if: d => mem(d, 'a_julien_allie') > 0, hint: 'La section rajeunie par Julien', effects: [membres(3), cohesion(1)], remember: { a_raymond_retenu: 1 }, next: 'reste' },
        ],
      },
      reste: {
        text: 'Bon. Je garde ma carte. Mais je te tiens à l’œil, hein. Et j’ai une idée : un banquet des anciens, avec tous les camarades qui ont décroché.',
        choices: [
          { id: 'banquet', label: 'Banco, organisons-le', effects: [st('energy', -3), perso(-300)], remember: { a_raymond_retenu: 1 }, end: 'Je m’occupe de la liste. Tu t’occupes du vin.', later: { months: 5, node: 'banquet' } },
          { id: 'plus_tard', label: 'Gardons ça pour plus tard', end: 'Comme tu veux. Mais on n’a pas l’éternité, nous.' },
        ],
      },
      banquet: {
        text: 'Le banquet des anciens : quatre-vingts couverts ! Une vingtaine de camarades ont repris leur carte, et ils veulent tous te raconter 1981.',
        effects: [membres(20), seg('retraites', 2), cohesion(1)],
        choices: [
          { id: 'rester', label: 'Je reste jusqu’au café', effects: [st('energy', -3), st('popularity', 1)], end: 'Raymond a les larmes aux yeux. « Comme au bon vieux temps. »' },
          { id: 'filer', label: 'Je fais un discours et je file', end: 'Ils ont applaudi. Raymond aurait aimé que tu restes.' },
        ],
      },
      retour_rendu: {
        text: 'Raymond a écrit au journal local : « Pourquoi j’ai rendu ma carte après quarante ans ». Une demi-page, sans méchanceté, mais ça fait mal.',
        effects: [membres(-10), seg('retraites', -2), st('popularity', -1)],
        choices: [
          { id: 'appeler', label: 'Je l’appelle pour saluer sa franchise', effects: [st('credibility', 2), st('energy', -2)], end: 'Il a été surpris. « Toi au moins, tu décroches. »' },
          { id: 'repondre', label: 'Je publie une réponse', effects: [st('stress', 2), st('credibility', -1)], end: 'Le courrier des lecteurs s’enflamme. Raymond ne répond plus.' },
        ],
      },
    },
  },
];

import { Effect, GameState, RankId } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';
import { MINISTRIES } from '../engine/government';

/* ============================================================
 *  Événements propres à chaque fonction : la vie d'une section,
 *  d'un conseil municipal, de l'Assemblée, d'un ministère, de
 *  Matignon, de la direction d'un parti, d'une campagne.
 * ============================================================ */

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat, delta });
const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice =>
  ({ id, label, effects, outcome, ...extra });
const gov = (x: Omit<Extract<Effect, { kind: 'government' }>, 'kind'>): Effect => ({ kind: 'government', ...x });
const only = (...ranks: RankId[]) => (d: GameState) => ranks.includes(d.player.rankId) && !d.presidency;
const ministry = (d: GameState) => (d.portfolio ? MINISTRIES[d.portfolio] : 'de votre ministère');

export const RANK_EVENTS: RandomEvent[] = [
  // ── Militant·e ───────────────────────────────────────────
  {
    tag: 'm_collage', weight: 1, eligible: only('militant'),
    build: () => ({
      title: 'Collage nocturne',
      context: '23 h, seau de colle à la main. Une équipe de colleurs adverses arrive au même panneau.',
      choices: [
        c('discuter', 'Proposer de partager le panneau', [s('popularity', 1), s('stress', 2), s('energy', -4)], 'Une cigarette, deux affiches côte à côte. Presque cordial.'),
        c('recouvrir', 'Recouvrir leurs affiches dès leur départ', [{ kind: 'momentum', delta: 3 }, { kind: 'cohesion', delta: 2 }, s('energy', -6)], 'Au matin, le quartier est à vos couleurs.',
          { risk: { baseChance: 0.3, onFailure: [{ kind: 'health', delta: -5 }, s('stress', 6)], failureNews: 'Ils reviennent. La bousculade vous laisse un œil au beurre noir.' } }),
        c('rentrer', 'Laisser tomber et rentrer', [s('energy', 4), { kind: 'faction', factionId: 'ligne_dure', delta: -2 }], 'Les camarades vous trouvent un peu mou·molle.'),
      ],
    }),
  },
  {
    tag: 'm_tresorier', weight: 1, eligible: only('militant'),
    build: () => ({
      title: 'On vous propose la trésorerie de la section',
      context: 'Le trésorier part en province. « Tu es sérieux·se, tu sais compter. Ça te dit ? »',
      choices: [
        c('accepter', 'Accepter', [s('influence', 3), s('credibility', 2), s('stress', 5), s('energy', -6)], 'Vous héritez d’un classeur et d’un découvert de 312 €.'),
        c('secretaire', 'Viser plutôt le poste de secrétaire de section', [s('influence', 4), { kind: 'faction', factionId: '*', delta: -2 }], 'Une ambition remarquée… et commentée.',
          { risk: { baseChance: 0.4, scaleWith: 'influence', scaleWeight: 0.6, onFailure: [s('influence', -1), s('stress', 4)], failureNews: 'Le vote vous est défavorable.' } }),
        c('refuser', 'Décliner poliment', [s('energy', 2)], 'Un autre s’y colle.'),
      ],
    }),
  },
  {
    tag: 'm_liste', weight: 1, eligible: only('militant'),
    build: d => ({
      title: 'La liste municipale se prépare',
      context: `${d.npcs.find(n => n.rankId === 'conseiller_municipal' && n.partyId === d.party.id)?.name ?? 'La tête de liste'} cherche des noms pour la prochaine liste.`,
      choices: [
        c('position', 'Réclamer une place éligible', [s('influence', 3), s('stress', 4), { kind: 'faction', factionId: 'moderes', delta: -2 }], 'On vous promet « une bonne place ».'),
        c('soutien', 'Faire campagne pour la liste sans rien demander', [{ kind: 'faction', factionId: '*', delta: 3 }, s('energy', -8)], 'On saura s’en souvenir.'),
        c('ailleurs', 'Garder vos forces pour autre chose', [s('energy', 3)], 'La liste se fait sans vous.'),
      ],
    }),
  },

  // ── Conseiller·e municipal·e ─────────────────────────────
  {
    tag: 'c_budget_ville', weight: 1, eligible: only('conseiller_municipal'),
    build: () => ({
      title: 'Vote du budget de la ville',
      context: 'Le maire propose de hausser la taxe foncière pour financer une nouvelle médiathèque.',
      choices: [
        c('pour', 'Voter pour', [s('influence', 3), s('popularity', -2), { kind: 'dossier', domain: 'territoires', delta: 3 }], 'Le maire vous remercie d’un hochement de tête.'),
        c('contre', 'Voter contre et le faire savoir', [s('popularity', 3), s('influence', -2), { kind: 'faction', factionId: 'moderes', delta: -2 }], 'Les propriétaires vous applaudissent.'),
        c('amender', 'Proposer un amendement chiffré', [s('credibility', 4), s('energy', -8)], 'Votre amendement est adopté : hausse divisée par deux.',
          { risk: { baseChance: 0.45, scaleWith: 'credibility', scaleWeight: 0.6, onFailure: [s('credibility', -1), s('stress', 3)], failureNews: 'Votre amendement est balayé.' } }),
      ],
    }),
  },
  {
    tag: 'c_permis', weight: 1, eligible: only('conseiller_municipal'),
    build: () => ({
      title: 'Un permis de construire contesté',
      context: 'Un promoteur veut bâtir six étages à la place d’un square. Les riverains manifestent devant la mairie.',
      choices: [
        c('riverains', 'Prendre le parti des riverains', [s('popularity', 4), { kind: 'contact', contactId: 'ct-btp', trust: -6 }], 'Le square est sauvé, pour l’instant.'),
        c('promoteur', 'Défendre le projet : il faut des logements', [s('credibility', 2), { kind: 'contact', contactId: 'ct-btp', trust: 6 }, s('popularity', -3)], 'Un panneau « Logements sociaux » apaise un peu la colère.'),
        c('mediation', 'Organiser une concertation', [{ kind: 'dossier', domain: 'territoires', delta: 5 }, s('energy', -10), s('popularity', 1)], 'Trois réunions publiques, un projet revu à la baisse.'),
      ],
    }),
  },
  {
    tag: 'c_delegation', weight: 1, eligible: only('conseiller_municipal'),
    build: () => ({
      title: 'Le maire vous confie une délégation',
      context: '« Sport et vie associative. C’est un beau portefeuille, et beaucoup de week-ends. »',
      choices: [
        c('accepter', 'Accepter', [s('credibility', 3), s('popularity', 2), s('energy', -10), s('stress', 4)], 'Vous voilà adjoint·e. Les clubs vous adorent.'),
        c('urbanisme', 'Réclamer l’urbanisme à la place', [s('influence', 5), { kind: 'exposure', delta: 3 }], 'Le portefeuille le plus convoité.',
          { risk: { baseChance: 0.5, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [s('influence', -2)], failureNews: 'Le maire n’apprécie pas : vous n’aurez rien.' } }),
        c('refuser', 'Refuser pour garder votre liberté de parole', [s('credibility', 1), s('influence', -1)], 'Vous restez libre… et en marge.'),
      ],
    }),
  },

  // ── Député·e ─────────────────────────────────────────────
  {
    tag: 'd_loi', weight: 1.2, eligible: only('depute'),
    build: () => ({
      title: 'Vote d’une loi controversée',
      context: 'Le groupe exige la discipline de vote sur un texte qui fâche votre circonscription.',
      choices: [
        c('pour', 'Voter avec le groupe', [{ kind: 'faction', factionId: '*', delta: 3 }, s('popularity', -3)], 'Le président de groupe vous tape sur l’épaule.'),
        c('contre', 'Voter contre', [s('popularity', 3), s('credibility', 1), { kind: 'faction', factionId: '*', delta: -5 }, { kind: 'cohesion', delta: -2 }], 'Votre nom figure parmi les frondeurs.'),
        c('absent', 'S’arranger pour être absent·e', [s('credibility', -2), s('stress', 2)], 'Votre siège vide est photographié.'),
      ],
    }),
  },
  {
    tag: 'd_rapport', weight: 1, eligible: only('depute'),
    build: d => ({
      title: 'Une mission d’information vous est confiée',
      context: `Six mois de travail sur « ${d.agendaDomain === 'sante' ? 'les déserts médicaux' : d.agendaDomain === 'ecologie' ? 'l’adaptation au climat' : 'l’efficacité de l’action publique'} ». Un rapport qui peut compter.`,
      domain: d.agendaDomain,
      choices: [
        c('accepter', 'Accepter et s’y consacrer', [{ kind: 'dossier', domain: '$domain', delta: 8 }, s('credibility', 4), s('energy', -15), s('stress', 5)], 'Votre rapport est cité au 20 h.'),
        c('deleguer', 'Accepter et le confier à vos collaborateurs', [{ kind: 'dossier', domain: '$domain', delta: 3 }, s('credibility', 1)], 'Un rapport honnête, sans éclat.'),
        c('refuser', 'Décliner : la circonscription d’abord', [s('popularity', 1), s('influence', -1)], 'Un collègue en hérite.'),
      ],
    }),
  },
  {
    tag: 'd_niche', weight: 1, eligible: only('depute'),
    build: () => ({
      title: 'La niche parlementaire de votre groupe',
      context: 'Une journée réservée aux textes de votre groupe. Le président vous propose d’en porter un.',
      choices: [
        c('debat', 'Défendre un texte offensif en séance', [{ kind: 'debate', stakes: 'hemicycle' }, s('influence', 2)], 'Le débat s’annonce électrique.'),
        c('consensus', 'Porter un texte consensuel', [s('credibility', 4), s('popularity', 1), s('energy', -8)], 'Adopté à l’unanimité, enfin presque.'),
        c('ceder', 'Laisser la place à un collègue', [{ kind: 'faction', factionId: 'moderes', delta: 3 }], 'Votre collègue vous doit un service.'),
      ],
    }),
  },
  {
    tag: 'd_usine', weight: 1, eligible: only('depute'),
    build: () => ({
      title: 'Une usine ferme dans votre circonscription',
      context: '320 salariés, un repreneur introuvable, des pneus qui brûlent devant les grilles.',
      choices: [
        c('mediation', 'Mener la médiation vous-même', [{ kind: 'scene', sceneId: 'mediation' }], 'Direction, syndicats, préfet : tout le monde autour de la table.'),
        c('gouvernement', 'Interpeller le gouvernement', [s('popularity', 3), s('influence', -1), { kind: 'contact', contactId: 'ct-ust', trust: 4 }], 'Votre question fait le tour des réseaux.'),
        c('repreneur', 'Chercher un repreneur dans votre réseau', [s('energy', -12), s('credibility', 2)], 'Un industriel accepte d’étudier le dossier.',
          { risk: { baseChance: 0.55, scaleWith: 'influence', scaleWeight: 0.6, onFailure: [s('popularity', -3), s('stress', 6)], failureNews: 'Le repreneur se désiste. On vous accuse d’avoir vendu de l’espoir.' } }),
      ],
    }),
  },

  // ── Ministre ─────────────────────────────────────────────
  {
    tag: 'min_debat', weight: 1.3, eligible: only('ministre'),
    build: d => ({
      title: 'Votre projet de loi en débat à l’Assemblée',
      context: `Le texte du ministère ${ministry(d).replace(/^de l’|^de la |^du |^des /, '')} arrive en séance. L’opposition a déposé 3 000 amendements.`,
      choices: [
        c('debattre', 'Le défendre en personne dans l’hémicycle', [{ kind: 'debate', stakes: 'hemicycle' }, s('credibility', 2)], 'Vous montez au banc du gouvernement.'),
        c('amendements', 'Accepter des amendements pour accélérer', [s('influence', -2), s('credibility', 2), s('stress', -2)], 'Le texte passe, édulcoré.'),
        c('reporter', 'Reporter l’examen', [s('credibility', -3), s('stress', -3)], 'L’opposition crie victoire.'),
      ],
    }),
  },
  {
    tag: 'min_greve', weight: 1, eligible: only('ministre'),
    build: d => ({
      title: 'Grève dans les services du ministère',
      context: `Les agents du ministère ${ministry(d)} cessent le travail contre la réorganisation que vous portez.`,
      choices: [
        c('negocier', 'Ouvrir des négociations', [s('politicalCapital', -10), s('popularity', 1), { kind: 'contact', contactId: 'ct-ust', trust: 4 }], 'Un protocole d’accord est signé.'),
        c('tenir', 'Tenir bon', [s('credibility', 2), s('popularity', -3), s('stress', 6)], 'Trois semaines de conflit. Vous tenez.'),
        c('suspendre', 'Suspendre la réforme', [s('credibility', -4), s('stress', -4)], 'La grève cesse. Votre autorité en prend un coup.'),
      ],
    }),
  },
  {
    tag: 'min_bercy', weight: 1, eligible: only('ministre'),
    build: () => ({
      title: 'Bercy rabote votre budget',
      context: 'Une lettre plafond arrive : −8 % sur vos crédits. Votre administration est en émoi.',
      choices: [
        c('matignon', 'Plaider à Matignon', [s('influence', 3), s('politicalCapital', -8)], 'Le Premier ministre tranche en votre faveur.',
          { risk: { baseChance: 0.45, scaleWith: 'influence', scaleWeight: 0.6, onFailure: [s('influence', -3), s('stress', 4)], failureNews: 'Matignon donne raison à Bercy.' } }),
        c('accepter', 'Accepter et chercher des économies', [s('credibility', 2), s('popularity', -2)], 'Vous passez pour un·e ministre responsable.'),
        c('fuite', 'Faire fuiter le chiffre dans la presse', [s('popularity', 2), s('influence', -3), { kind: 'exposure', delta: 3 }], 'Le gouvernement se déchire en public.'),
      ],
    }),
  },
  {
    tag: 'min_fuite', weight: 0.8, eligible: only('ministre'),
    build: () => ({
      title: 'Une note de votre cabinet fuite',
      context: 'Un hebdomadaire publie une note interne : « Les syndicats ne pèsent plus rien, on peut passer en force. »',
      choices: [
        c('assumer', 'Assumer le fond', [s('credibility', 1), s('popularity', -3), { kind: 'contact', contactId: 'ct-ust', trust: -8 }], 'La franchise passe mal chez les syndicats.'),
        c('limoger', 'Limoger votre directeur de cabinet', [s('credibility', 2), s('stress', 5), s('influence', -1)], 'Il part, furieux. Il écrira sûrement un livre.'),
        c('dementir', 'Démentir l’authenticité', [s('stress', 3)], 'Vous niez en bloc.',
          { risk: { baseChance: 0.5, onFailure: [s('credibility', -7), { kind: 'exposure', delta: 6 }], failureNews: 'Le journal publie le fac-similé. Le mensonge est pire que la note.' } }),
      ],
    }),
  },
  {
    tag: 'min_recadrage', weight: 0.8, eligible: only('ministre'),
    build: () => ({
      title: 'Recadré·e en Conseil des ministres',
      context: 'Le président vous reproche publiquement une déclaration « hors de la ligne du gouvernement ».',
      choices: [
        c('excuses', 'Faire amende honorable', [s('influence', -2), s('stress', 3)], 'Vous rentrez dans le rang.'),
        c('tenir', 'Maintenir vos propos', [s('popularity', 3), s('influence', 2), s('stress', 6)], 'Une fronde dont on parle.',
          { risk: { baseChance: 0.3, onFailure: [{ kind: 'rank', rankId: 'depute' }, s('popularity', 2)], failureNews: 'Vous êtes débarqué·e au remaniement suivant.' } }),
        c('demission', 'Menacer de démissionner', [s('influence', 4), s('politicalCapital', -10)], 'Le président recule.',
          { risk: { baseChance: 0.4, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [{ kind: 'rank', rankId: 'depute' }, s('credibility', 3)], failureNews: 'Le président accepte votre démission.' } }),
      ],
    }),
  },
  {
    tag: 'matignon', weight: 1, eligible: d => only('ministre')(d) && d.player.stats.influence >= 55 && d.player.stats.credibility >= 45
      && d.presidential.incumbentPartyId === d.party.id,
    build: d => ({
      title: 'Matignon vous tend les bras',
      context: `${d.presidential.incumbentName} vous reçoit : « Je veux un nouveau souffle. Je veux que vous formiez le gouvernement. »`,
      choices: [
        c('accepter', 'Accepter de devenir Premier·e ministre', [{ kind: 'rank', rankId: 'premier_ministre' }, s('influence', 6), s('stress', 8)], 'Passation de pouvoirs dans la cour de Matignon.'),
        c('conditions', 'Poser vos conditions : les mains libres', [{ kind: 'rank', rankId: 'premier_ministre' }, s('politicalCapital', 15), s('influence', 4)], 'Le président accepte vos conditions.',
          { risk: { baseChance: 0.35, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [s('influence', -3)], failureNews: 'Le président choisit quelqu’un de moins exigeant.' } }),
        c('refuser', 'Refuser : rester ministre', [s('credibility', 2), s('influence', -2)], 'Un autre s’installe rue de Varenne.'),
      ],
    }),
  },

  // ── Premier·e ministre ───────────────────────────────────
  {
    tag: 'pm_fronde', weight: 1, eligible: only('premier_ministre'),
    build: () => ({
      title: 'Fronde au gouvernement',
      context: 'Trois ministres critiquent votre réforme phare dans la presse du dimanche.',
      choices: [
        c('recadrer', 'Les recadrer en séminaire', [gov({ cohesion: 6 }), s('stress', 4), s('energy', -6)], 'Le rappel à l’ordre fonctionne… pour un temps.'),
        c('limoger', 'Limoger le meneur', [gov({ cohesion: 10, majority: -5 }), s('influence', 3)], 'L’exemple est donné. Ses amis à l’Assemblée s’en souviendront.'),
        c('ceder', 'Amender la réforme', [gov({ cohesion: 4 }), s('credibility', -3)], 'La paix revient, l’ambition aussi recule.'),
      ],
    }),
  },
  {
    tag: 'pm_elysee', weight: 1, eligible: only('premier_ministre'),
    build: d => ({
      title: 'Désaccord avec l’Élysée',
      context: `${d.presidential.incumbentName} veut une mesure que vous jugez dangereuse pour les finances publiques.`,
      choices: [
        c('aligner', 'S’aligner sur le président', [s('influence', -2), gov({ cohesion: 3 }), s('stress', 3)], 'Le couple exécutif tient.'),
        c('tenir', 'Tenir tête', [s('popularity', 3), s('influence', 3), s('stress', 6)], 'Votre fermeté impressionne.',
          { risk: { baseChance: 0.3, onFailure: [gov({ fall: true })], failureNews: 'Le président demande votre démission.' } }),
        c('compromis', 'Proposer un compromis', [s('politicalCapital', -10), s('credibility', 2)], 'Une version allégée est annoncée.'),
      ],
    }),
  },
  {
    tag: 'pm_demission_ministre', weight: 0.8, eligible: only('premier_ministre'),
    build: () => ({
      title: 'Un ministre démissionne avec fracas',
      context: 'Le ministre de l’Écologie claque la porte en direct à la radio : « Je ne sers plus à rien. »',
      choices: [
        c('fidele', 'Le remplacer par un fidèle', [gov({ cohesion: 6 }), s('popularity', -2)], 'Le remplaçant est discret.'),
        c('ouverture', 'Nommer une personnalité de la société civile', [gov({ majority: 3 }), s('popularity', 3), s('politicalCapital', -8)], 'Une nomination saluée.'),
        c('critique', 'Dénoncer sa déloyauté', [gov({ cohesion: -4 }), s('influence', 2), s('stress', 4)], 'Échange d’amabilités par médias interposés.'),
      ],
    }),
  },
  {
    tag: 'pm_greve', weight: 0.8, eligible: only('premier_ministre'),
    build: () => ({
      title: 'Le pays bloqué contre votre réforme',
      context: 'Raffineries à l’arrêt, trains supprimés. Les syndicats exigent le retrait du texte.',
      choices: [
        c('tenir', 'Maintenir le texte', [s('credibility', 3), s('popularity', -5), gov({ majority: -3 }), s('stress', 8)], 'Le texte passe, la colère reste.'),
        c('retirer', 'Retirer la réforme', [s('popularity', 4), s('credibility', -5), gov({ cohesion: -4 })], 'La rue a gagné.'),
        c('negocier', 'Ouvrir une grande négociation', [{ kind: 'contact', contactId: 'ct-ust', trust: 6 }, s('politicalCapital', -15), gov({ majority: 2 })], 'Un compromis se dessine en trois semaines.'),
      ],
    }),
  },

  // ── Chef·fe de parti ─────────────────────────────────────
  {
    tag: 'cp_contestation', weight: 1, eligible: only('chef_parti'),
    build: () => ({
      title: 'Votre leadership contesté',
      context: 'Une tribune signée par quarante cadres réclame « un nouveau souffle » à la tête du parti.',
      choices: [
        c('congres', 'Convoquer un congrès anticipé', [s('influence', 5), { kind: 'cohesion', delta: 6 }, s('stress', 8)], 'Vous êtes réélu·e avec 61 %.',
          { risk: { baseChance: 0.35, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [s('influence', -6), { kind: 'cohesion', delta: -6 }], failureNews: 'Réélu·e de justesse : le parti est coupé en deux.' } }),
        c('compromis', 'Faire entrer les frondeurs à la direction', [{ kind: 'cohesion', delta: 4 }, s('influence', -2), { kind: 'faction', factionId: '*', delta: 2 }], 'La paix des braves.'),
        c('exclure', 'Exclure les meneurs', [{ kind: 'cohesion', delta: -6 }, s('influence', 3), { kind: 'faction', factionId: 'reformistes', delta: -6 }], 'L’autorité est rétablie, la blessure ouverte.'),
      ],
    }),
  },
  {
    tag: 'cp_alliance', weight: 1, eligible: only('chef_parti'),
    build: d => {
      const other = [...d.otherParties].sort((a, b) => Math.abs(a.position - d.party.position) - Math.abs(b.position - d.party.position))[0];
      return {
        title: `${other?.name ?? 'Un parti voisin'} propose une alliance`,
        context: 'Des candidatures communes aux prochaines élections, un programme partagé. Votre ligne dure fulmine.',
        choices: [
          c('accepter', 'Signer l’accord', [s('influence', 4), { kind: 'momentum', delta: 5 }, { kind: 'faction', factionId: 'ligne_dure', delta: -6 }, { kind: 'stance', delta: Math.sign((other?.position ?? 0) - d.party.position) * 4 }], 'Une photo de famille à la une.'),
          c('negocier', 'Négocier des circonscriptions', [s('influence', 2), s('politicalCapital', -8), { kind: 'cohesion', delta: 2 }], 'Un accord a minima.'),
          c('refuser', 'Refuser : nous irons seuls', [{ kind: 'faction', factionId: 'ligne_dure', delta: 4 }, s('influence', -2)], 'L’indépendance a un prix électoral.'),
        ],
      };
    },
  },
  {
    tag: 'cp_tresorerie', weight: 0.8, eligible: only('chef_parti'),
    build: () => ({
      title: 'Le trésorier tire la sonnette d’alarme',
      context: 'Les comptes du parti plongent. Les permanents ne seront pas payés dans trois mois.',
      choices: [
        c('dons', 'Lancer un grand appel aux dons', [{ kind: 'partyTreasury', delta: 60 }, s('energy', -8), { kind: 'momentum', delta: 2 }], 'Des milliers de petits dons arrivent.'),
        c('emprunt', 'Emprunter auprès d’une banque', [{ kind: 'partyTreasury', delta: 120 }, { kind: 'exposure', delta: 3 }, s('stress', 4)], 'Le parti respire, à crédit.'),
        c('couper', 'Couper dans les dépenses', [{ kind: 'partyTreasury', delta: 40 }, { kind: 'cohesion', delta: -4 }], 'Deux permanents sont licenciés.'),
      ],
    }),
  },

  // ── Candidat·e à la présidence ───────────────────────────
  {
    tag: 'cand_gaffe', weight: 1, eligible: only('candidat_presidence'),
    build: () => ({
      title: 'Une gaffe de campagne',
      context: 'Interrogé·e sur le prix d’un ticket de métro, vous répondez « autour de 10 € ». La vidéo est partout.',
      choices: [
        c('rire', 'En rire et prendre le métro devant les caméras', [s('popularity', 2), s('credibility', -1), s('energy', -4)], 'L’autodérision désamorce la polémique.'),
        c('excuses', 'Présenter des excuses sobres', [s('credibility', 1), { kind: 'momentum', delta: -3 }], 'L’affaire s’éteint en deux jours.'),
        c('contre', 'Dénoncer une campagne de dénigrement', [s('popularity', -3), { kind: 'momentum', delta: 2 }, s('stress', 4)], 'Vos partisans serrent les rangs, les autres rient.'),
      ],
    }),
  },
  {
    tag: 'cand_ralliement', weight: 1, eligible: only('candidat_presidence'),
    build: () => ({
      title: 'Une personnalité veut se rallier',
      context: 'Un ancien ministre très médiatique, au passé judiciaire chargé, veut vous soutenir publiquement.',
      choices: [
        c('accepter', 'Accepter son soutien', [{ kind: 'momentum', delta: 8 }, s('popularity', 2), { kind: 'exposure', delta: 6 }, s('credibility', -2)], 'Il monte sur scène à votre meeting.'),
        c('discret', 'Accepter, mais en coulisses', [{ kind: 'momentum', delta: 3 }, { kind: 'exposure', delta: 2 }], 'Son carnet d’adresses vous ouvre des portes.'),
        c('refuser', 'Refuser poliment', [s('credibility', 3)], 'La presse salue votre exigence.'),
      ],
    }),
  },
  {
    tag: 'cand_fuite', weight: 0.8, eligible: only('candidat_presidence'),
    build: () => ({
      title: 'Une mesure de votre programme fuite',
      context: 'Un document de travail évoque le report de l’âge de la retraite. Personne ne devait le voir.',
      choices: [
        c('assumer', 'Assumer la mesure', [s('credibility', 3), s('popularity', -4)], 'Le courage paie chez les éditorialistes, moins chez les électeurs.'),
        c('dementir', 'Démentir : ce n’était qu’une piste', [s('credibility', -3), { kind: 'momentum', delta: -2 }], 'Le soupçon reste.'),
        c('retourner', 'Retourner l’attaque : « Qui vous a donné ce document ? »', [{ kind: 'momentum', delta: 3 }, s('stress', 5)], 'Le débat dévie sur la fuite elle-même.'),
      ],
    }),
  },
];

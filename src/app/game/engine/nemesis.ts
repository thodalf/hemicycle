import { Decision, DecisionChoice, Effect, GameState, Segment } from '../models/game.models';
import { rankOrder } from '../data/ranks';
import { SEGMENTS } from '../data/programme';
import { hubrisOf, mods } from './difficulty';
import { pushNews } from './effects';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Némésis : plus on domine, plus la chute guette.
 *
 *  Chaque mois, la « domination » du joueur est mesurée
 *  (popularité, électorats, majorité, lois adoptées à la chaîne,
 *  cote de confiance…). Elle nourrit une jauge d'hubris qui
 *  appelle les retours de bâton : affaires, fuites, frondes,
 *  krachs, grèves, livres-confessions, censure d'une loi phare…
 *  Aucun choix n'en sort indemne : on choisit ce qu'on sacrifie.
 * ============================================================ */

const st = (stat: 'popularity' | 'credibility' | 'influence' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
const seg = (segment: Segment | '*', delta: number): Effect => ({ kind: 'segment', segment, delta });
const flagAdd = (key: string, delta: number): Effect => ({ kind: 'flagAdd', key, delta });
const calm = (n: number): Effect => flagAdd('hubris', -n);

/** Les leviers du pouvoir, selon la place occupée : cote de confiance et majorité */
function power(d: GameState, approval: number, majority: number): Effect[] {
  const out: Effect[] = [];
  if (d.presidency) out.push({ kind: 'presidency', ...(approval ? { approval } : {}), ...(majority ? { majority } : {}) });
  if (d.government && majority) out.push({ kind: 'government', majority, cohesion: Math.round(majority / 2) });
  return out;
}

const governing = (d: GameState) => !!d.presidency || !!d.government;
const national = (d: GameState) => rankOrder(d.player.rankId) >= rankOrder('depute');
const known = (d: GameState) => rankOrder(d.player.rankId) >= rankOrder('conseiller_municipal');

/** Votre cote la plus basse parmi les électorats */
function minSegment(d: GameState): number {
  const off = d.electorate?.offsets;
  const pop = d.player.stats.popularity;
  if (!off) return pop;
  return Math.min(...SEGMENTS.map(s => clamp(pop + (off[s.id] ?? 0))));
}

/** Lois adoptées ces douze derniers mois (scrutins gagnés et réformes) */
export function recentWins(d: GameState): number {
  const votes = (d.voteHistory ?? []).filter(h => h.adopted && d.week - h.week <= 12).length;
  const laws = (d.laws ?? []).filter(l => d.week - l.week <= 12).length;
  return Math.max(votes, laws);
}

/** La domination du moment (0 … 100) : ce qui attire la foudre */
export function dominance(d: GameState): number {
  const s = d.player.stats;
  let x = Math.max(0, s.popularity - 62) * 1.1
    + Math.max(0, s.credibility - 70) * 0.4
    + Math.max(0, s.influence - 70) * 0.4
    + Math.max(0, minSegment(d) - 60) * 0.7
    + Math.max(0, recentWins(d) - 2) * 4;
  const pr = d.presidency;
  if (pr) x += Math.max(0, pr.approval - 58) * 0.6 + Math.max(0, pr.majority - 54) * 0.8;
  const g = d.government;
  if (g) x += Math.max(0, g.majority - 54) * 0.8;
  const top = d.presidential?.barometer?.at(-1)?.results?.['player'];
  if (top && top > 35) x += (top - 35) * 0.5;
  return Math.round(clamp(x));
}

export function hubrisLabel(h: number): string {
  return h >= 75 ? 'La chute est proche' : h >= 50 ? 'On vous attend au tournant' : h >= 25 ? 'L’arrogance du pouvoir' : 'Sous contrôle';
}

interface Nemesis {
  id: string;
  weight: number;
  /** Hubris minimal pour tirer cet événement */
  min?: number;
  eligible?: (d: GameState) => boolean;
  /** Ce qui arrive avant même de choisir (le coup est déjà porté) */
  hit?: (d: GameState, rng: Rng) => void;
  title: string;
  context: (d: GameState) => string;
  choices: (d: GameState) => DecisionChoice[];
}

function partyRival(d: GameState): { id: string; name: string } | null {
  const n = [...d.npcs].filter(x => x.partyId === d.party.id).sort((a, b) => (b.influence + b.ambition) - (a.influence + a.ambition))[0];
  return n ? { id: n.id, name: n.name } : null;
}

export const NEMESES: Nemesis[] = [
  {
    id: 'nm_retournement', weight: 4, min: 60, eligible: known,
    hit: d => {
      const s = d.player.stats;
      s.popularity = clamp(s.popularity - 10 * mods(d).loss);
      const off = d.electorate?.offsets;
      if (off) for (const k of Object.keys(off) as Segment[]) off[k] = clamp(off[k] - 5, -30, 30);
      if (d.presidency) d.presidency.approval = clamp(d.presidency.approval - 10);
    },
    title: 'Le grand retournement',
    context: () => 'Personne ne sait vraiment ce qui a fait basculer l’opinion. Une phrase de trop, une photo, l’impression que vous ne doutez plus de rien. En trois semaines, l’adoration devient lassitude, puis agacement. Les sondeurs n’avaient jamais vu une chute aussi rapide.',
    choices: d => [
      { id: 'humilite', label: 'Faire acte d’humilité à la télévision', hint: 'Reconnaître ses erreurs : la crédibilité en pâtit, l’opinion se calme.', effects: [st('credibility', -5), st('popularity', 3), calm(20), st('stress', 6)], outcome: 'Vingt minutes de mea culpa. Une partie du pays vous en sait gré, l’autre y voit une faiblesse.' },
      { id: 'cap', label: 'Garder le cap, coûte que coûte', hint: 'Ne rien changer : le capital politique suit, l’opinion décroche encore.', effects: [st('popularity', -5), seg('*', -3), st('politicalCapital', 6), calm(8)], outcome: 'Vous refusez de commenter les sondages. Les éditorialistes parlent d’autisme politique.' },
      { id: 'remanier', label: d.presidency || d.government ? 'Remanier l’équipe pour changer de visage' : 'Changer d’équipe et de communication', effects: [...power(d, 3, -4), st('politicalCapital', -15), { kind: 'team', morale: -10, all: true }, calm(25)], outcome: 'Nouvelles têtes, nouvelle séquence. Les anciens ne vous le pardonnent pas.' },
    ],
  },
  {
    id: 'nm_affaire', weight: 3, eligible: known,
    title: 'L’affaire de votre bras droit',
    context: () => 'Votre plus proche collaborateur est placé en garde à vue : des marchés attribués à une société appartenant à son beau-frère. Il jure qu’il n’y a rien. Les enquêteurs ont emporté des cartons de votre secrétariat.',
    choices: () => [
      { id: 'lacher', label: 'Le lâcher immédiatement', hint: 'Couper la branche avant qu’elle ne casse.', effects: [st('popularity', -3), st('credibility', 2), { kind: 'team', morale: -15, all: true }, calm(15)], outcome: 'Il apprend sa mise à pied par la radio. Votre équipe, elle, a bien compris le message.' },
      { id: 'defendre', label: 'Le défendre publiquement', hint: 'La loyauté paie… si le dossier est vide.', effects: [st('credibility', -3), { kind: 'team', morale: 8, all: true }, calm(10)], outcome: 'Vous parlez de présomption d’innocence. Les juges, de « faisceau d’indices ».',
        risk: { baseChance: 0.5, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [st('popularity', -9), st('credibility', -10), { kind: 'exposure', delta: 18 }], failureNews: 'Un second volet de l’enquête vous vise directement : l’argent remontait jusqu’à votre micro-parti.' } },
      { id: 'transparence', label: 'Ouvrir tous vos dossiers à la presse', hint: 'Cher en capital politique, mais l’affaire s’éteint.', effects: [st('politicalCapital', -18), st('energy', -10), st('popularity', -2), { kind: 'exposure', delta: -8 }, calm(20)], outcome: 'Trois mille pages mises en ligne. Rien de plus n’en sort, mais tout le monde a vu le ménage.' },
    ],
  },
  {
    id: 'nm_fuite', weight: 3, eligible: known,
    hit: d => { d.player.stats.popularity = clamp(d.player.stats.popularity - 5 * mods(d).loss); },
    title: 'Les messages privés',
    context: () => 'Un site d’investigation publie deux ans de messages d’une boucle privée de votre entourage. Vous y moquez « les gens qui se lèvent pour rien », vos alliés, quelques électeurs. Les captures tournent en boucle sur les réseaux.',
    choices: () => [
      { id: 'excuses', label: 'Présenter des excuses sans détour', effects: [st('credibility', -4), seg('populaires', 2), calm(15)], outcome: 'Les excuses sont jugées sincères par un Français sur deux. C’est déjà ça.' },
      { id: 'dementir', label: 'Dénoncer des messages sortis de leur contexte', hint: 'Si d’autres captures sortent, c’est la catastrophe.', effects: [st('credibility', 1), calm(6)], outcome: 'Vous parlez de montage. Le site promet « la suite lundi ».',
        risk: { baseChance: 0.55, onFailure: [st('popularity', -8), st('credibility', -8), seg('*', -4)], failureNews: 'Lundi, la suite tombe : un audio, cette fois. Impossible de parler de montage.' } },
      { id: 'contre', label: 'Attaquer le site en justice', effects: [st('credibility', -2), seg('jeunes', -4), seg('cadres', 2), { kind: 'momentum', delta: -6 }, calm(10)], outcome: 'La plainte pour recel fait la une. L’effet Streisand aussi.' },
    ],
  },
  {
    id: 'nm_fronde', weight: 4, eligible: d => governing(d) || d.player.rankId === 'chef_parti',
    hit: d => {
      if (d.presidency) d.presidency.majority = clamp(d.presidency.majority - 8);
      if (d.government) d.government.majority = clamp(d.government.majority - 8);
      d.party.cohesion = clamp(d.party.cohesion - 8);
    },
    title: 'Quarante députés claquent la porte',
    context: () => 'Ils se disent « ni godillots ni courtisans ». Quarante députés de votre camp annoncent la création d’un groupe autonome. Ils voteront « au cas par cas ». Vos textes en cours n’ont plus de majorité assurée.',
    choices: d => [
      { id: 'negocier', label: 'Négocier un à un leur retour', hint: 'Des postes, des circonscriptions, des promesses.', effects: [...power(d, 0, 6), st('politicalCapital', -22), { kind: 'faction', factionId: '*', delta: 3 }, calm(12)], outcome: 'Vingt-cinq reviennent. Quinze restent dehors, et ils parlent fort.' },
      { id: 'exclure', label: 'Les exclure du parti', hint: 'L’autorité restaurée, la majorité amputée.', effects: [...power(d, 2, -6), { kind: 'cohesion', delta: 8 }, st('influence', 2), calm(10)], outcome: 'Les exclus créent leur parti. Vos fidèles serrent les rangs.' },
      { id: 'reculer', label: 'Retirer les textes contestés', effects: [...power(d, -2, 4), st('credibility', -5), { kind: 'faction', factionId: 'ligne_dure', delta: -6 }, calm(18)], outcome: 'Vous suspendez trois réformes. La fronde se dégonfle, votre programme aussi.' },
    ],
  },
  {
    id: 'nm_krach', weight: 2, eligible: national,
    title: 'Krach éclair',
    context: () => 'En une séance, la Bourse de Paris perd 11 %. Une grande banque est suspendue de cotation, les taux s’envolent. On cherche un coupable, et le gouvernement fait une cible commode.',
    choices: () => [
      { id: 'garantir', label: 'Plaider pour une garantie publique massive', effects: [{ kind: 'economy', deficit: 0.4, confidence: 4 }, st('credibility', 3), st('popularity', -3), { kind: 'crisis', arc: 'krach', start: true, risk: 5 }, calm(15)], outcome: 'Les marchés se calment. La facture, elle, arrivera plus tard.' },
      { id: 'rigueur', label: 'Annoncer un plan de rigueur préventif', effects: [{ kind: 'economy', deficit: -0.3, growth: -0.4, confidence: -2 }, seg('populaires', -6), seg('cadres', 3), st('popularity', -5), { kind: 'crisis', arc: 'krach', start: true }, calm(18)], outcome: 'Gel des dépenses, report des investissements : la rue gronde.' },
      { id: 'laisser', label: 'Laisser les marchés se corriger', effects: [{ kind: 'economy', growth: -0.8, unemployment: 0.5, confidence: -6 }, st('popularity', -4), { kind: 'crisis', arc: 'krach', start: true, gauge: -10, risk: 15 }, calm(10)], outcome: '« Le gouvernement regarde la maison brûler », titre un quotidien.' },
    ],
  },
  {
    id: 'nm_greve', weight: 3, eligible: national,
    hit: d => { const off = d.electorate?.offsets; if (off) off.populaires = clamp(off.populaires - 4, -30, 30); },
    title: 'La grève générale',
    context: () => 'Les syndicats, unis pour la première fois depuis des années, appellent à une grève reconductible. Raffineries, ports, trains, écoles : le pays ralentit. Vos succès passés sont devenus des griefs.',
    choices: () => [
      { id: 'table', label: 'Ouvrir une grande conférence sociale', hint: 'Négocier vous-même, à la table des syndicats.', play: 'negociation_syndicale', effects: [st('politicalCapital', -12), seg('populaires', 4), { kind: 'economy', deficit: 0.15 }, { kind: 'crisis', arc: 'greve_generale', start: true, gauge: 10 }, calm(18)], outcome: 'Les syndicats acceptent de s’asseoir. La grève continue pendant qu’on parle.' },
      { id: 'tenir', label: 'Tenir bon et réquisitionner', effects: [seg('populaires', -6), seg('retraites', 3), st('credibility', 2), st('popularity', -6), { kind: 'crisis', arc: 'greve_generale', start: true, risk: 10 }, calm(12)], outcome: 'Les réquisitions de raffineries font hurler. Le carburant revient, la colère non.' },
      { id: 'ceder', label: 'Lâcher sur les salaires', effects: [{ kind: 'economy', deficit: 0.35, inflation: 0.4 }, seg('populaires', 5), seg('cadres', -5), st('credibility', -6), calm(16)], outcome: 'Accord signé en une nuit. Les marchés et la Commission européenne froncent les sourcils.' },
    ],
  },
  {
    id: 'nm_note', weight: 2, eligible: national,
    title: 'La France dégradée',
    context: () => 'Un vendredi soir, une grande agence de notation abaisse la note de la France d’un cran. « Absence de trajectoire crédible », « dérive des comptes ». La charge de la dette s’alourdit dès lundi.',
    choices: () => [
      { id: 'economies', label: 'Annoncer dix milliards d’économies', effects: [{ kind: 'economy', deficit: -0.3, growth: -0.2 }, seg('populaires', -4), seg('retraites', -3), st('credibility', 3), st('popularity', -4), calm(12)], outcome: 'Les marchés saluent. Les collectivités et les retraités, beaucoup moins.' },
      { id: 'contester', label: 'Contester la méthode des agences', effects: [st('popularity', 2), st('credibility', -5), { kind: 'economy', confidence: -3 }, calm(8)], outcome: 'Le discours souverainiste plaît. Les investisseurs, eux, vendent.' },
      { id: 'impots', label: 'Augmenter la fiscalité sur les hauts revenus', effects: [{ kind: 'economy', deficit: -0.25 }, seg('cadres', -7), seg('populaires', 3), st('influence', -3), calm(12)], outcome: 'La mesure est populaire. Trois grands patrons annoncent leur départ.' },
    ],
  },
  {
    id: 'nm_cour', weight: 2, eligible: known,
    title: 'Le rapport qui tue',
    context: () => 'La Cour des comptes publie un rapport au vitriol sur votre gestion : dépenses de communication multipliées par trois, objectifs non tenus, « pilotage par l’annonce ». Chaque chaîne d’info en lit des extraits.',
    choices: () => [
      { id: 'reconnaitre', label: 'Reconnaître et corriger', effects: [st('credibility', -3), st('politicalCapital', -8), calm(14)], outcome: 'Vous annoncez un plan de correction. On vous croit à moitié.' },
      { id: 'contre_expertise', label: 'Commander une contre-expertise', effects: [st('credibility', -6), st('popularity', -2), calm(6)], outcome: 'Les magistrats financiers publient une réponse cinglante.' },
      { id: 'communication', label: 'Couper tous les budgets de communication', effects: [st('popularity', 2), { kind: 'momentum', delta: -10 }, st('influence', -3), calm(12)], outcome: 'Plus de campagnes, plus d’affiches. On vous voit moins, on vous reproche moins.' },
    ],
  },
  {
    id: 'nm_censure', weight: 3, eligible: d => (d.laws ?? []).some(l => l.status === 'en_vigueur' && d.week - l.week <= 24),
    hit: d => {
      const law = [...(d.laws ?? [])].reverse().find(l => l.status === 'en_vigueur' && d.week - l.week <= 24);
      censured = law?.title ?? '';
      if (law) law.status = 'abrogee';
    },
    title: 'Votre loi phare censurée',
    context: () => `Le Conseil constitutionnel censure l’essentiel de « ${censured || 'votre dernière loi'} » : atteinte disproportionnée aux libertés, cavaliers législatifs, insincérité budgétaire. Des mois de travail effacés en une décision de vingt pages.`,
    choices: d => [
      { id: 'reecrire', label: 'Réécrire le texte et le représenter', effects: [st('politicalCapital', -14), st('energy', -10), { kind: 'vote', own: true }, calm(10)], outcome: 'Un nouveau texte, plus prudent, repart pour la navette.' },
      { id: 'attaquer', label: 'Dénoncer le « gouvernement des juges »', effects: [st('credibility', -7), seg('retraites', 2), seg('cadres', -4), { kind: 'faction', factionId: 'ligne_dure', delta: 5 }, calm(6)], outcome: 'Les juristes s’indignent. Votre base applaudit.' },
      { id: 'tourner', label: 'Prendre acte et passer à autre chose', effects: [st('popularity', -3), st('credibility', 2), ...power(d, -3, 0), calm(14)], outcome: 'Vous tournez la page. Vos électeurs, eux, se demandent ce qu’il reste du programme.' },
    ],
  },
  {
    id: 'nm_livre', weight: 2, eligible: known,
    title: 'Le livre de l’ancien conseiller',
    context: () => '« Dans l’ombre du pouvoir », trois cents pages signées par un ancien membre de votre équipe. Colères, mépris, arrangements : tout y est, ou presque. Premier tirage épuisé en deux jours.',
    choices: () => [
      { id: 'silence', label: 'Ne rien dire, ne rien lire', effects: [st('popularity', -3), st('credibility', -2), calm(10)], outcome: 'Le silence est lu comme un aveu. Le livre se vend quand même.' },
      { id: 'proces', label: 'Attaquer en diffamation', hint: 'Si les passages sont vrais, le procès les rendra célèbres.', effects: [st('energy', -8), calm(8)], outcome: 'Assignation déposée. Le procès aura lieu dans dix-huit mois.',
        risk: { baseChance: 0.45, onFailure: [st('popularity', -6), st('credibility', -7), { kind: 'exposure', delta: 10 }], failureNews: 'Les témoins cités par l’auteur confirment tout. La presse en fait un feuilleton.' } },
      { id: 'repondre', label: 'Répondre par votre propre livre', effects: [st('energy', -15), st('politicalCapital', -6), st('popularity', 2), calm(14)], outcome: 'Votre version des faits sort en librairie. Elle se vend deux fois moins.' },
    ],
  },
  {
    id: 'nm_micro', weight: 3, eligible: known,
    hit: d => { d.player.stats.popularity = clamp(d.player.stats.popularity - 4 * mods(d).loss); },
    title: 'Le micro resté ouvert',
    context: () => 'À la fin d’un déplacement, vous lâchez une phrase méprisante sur « ces gens qui ne comprennent rien ». Le micro d’une équipe de télévision était encore ouvert. Trois secondes, vingt millions de vues.',
    choices: () => [
      { id: 'assumer', label: 'Assumer et préciser votre pensée', effects: [st('credibility', -2), seg('populaires', -5), seg('cadres', 2), calm(8)], outcome: 'Votre précision aggrave plutôt les choses.' },
      { id: 'excuses', label: 'S’excuser sur le terrain, au même endroit', effects: [st('energy', -10), seg('populaires', 3), st('popularity', 2), calm(16)], outcome: 'Vous revenez serrer les mains. L’accueil est froid, mais les images sont bonnes.' },
      { id: 'humour', label: 'Désamorcer par l’autodérision', hint: 'Un exercice d’éloquence périlleux.', play: 'eloquence', effects: [st('popularity', 3), { kind: 'momentum', delta: 4 }, calm(14)], outcome: 'Votre trait d’humour sur vous-même fait sourire. Une partie du pays passe l’éponge.' },
    ],
  },
  {
    id: 'nm_dauphin', weight: 3, eligible: d => !!partyRival(d) && national(d),
    hit: d => { const r = partyRival(d); if (r) { const n = d.npcs.find(x => x.id === r.id)!; n.popularity = clamp(n.popularity + 12); n.relationToPlayer = clamp(n.relationToPlayer - 25, -100, 100); n.isRival = true; } },
    title: 'Le dauphin prend le large',
    context: d => `${partyRival(d)?.name ?? 'Votre plus brillant second'} rassemble deux mille personnes dans une salle de banlieue et lance son propre mouvement « pour une autre façon de faire ». Pas un mot contre vous ; tout le monde a compris. Vos soutiens les plus jeunes y étaient.`,
    choices: d => {
      const r = partyRival(d);
      return [
        { id: 'rallier', label: 'Lui proposer un grand rôle à vos côtés', effects: [...(r ? [{ kind: 'npcRelation', npcId: r.id, delta: 20, reason: 'Un grand rôle offert' } as Effect] : []), st('influence', -5), st('politicalCapital', -10), calm(12)], outcome: 'Il accepte… et s’installe dans la lumière, juste à côté de vous.' },
        { id: 'isoler', label: 'Couper ses relais dans le parti', effects: [...(r ? [{ kind: 'npcStat', npcId: r.id, stat: 'influence', delta: -12 } as Effect] : []), { kind: 'cohesion', delta: -8 }, seg('jeunes', -4), calm(8)], outcome: 'Ses soutiens perdent leurs postes. Le parti se déchire en coulisses.' },
        { id: 'ignorer', label: 'Faire comme si de rien n’était', effects: [...(r ? [{ kind: 'npcStat', npcId: r.id, stat: 'popularity', delta: 6 } as Effect] : []), { kind: 'momentum', delta: -8 }, calm(6)], outcome: 'Il occupe les plateaux pendant que vous gouvernez. Les sondages le testent déjà.' },
      ];
    },
  },
  {
    id: 'nm_malaise', weight: 1, eligible: known,
    hit: d => { d.player.stats.energy = clamp(d.player.stats.energy - 20); },
    title: 'Le malaise',
    context: () => 'En pleine cérémonie, vous vacillez et devez vous asseoir. Rien de grave, disent les médecins : surmenage. Les rumeurs, elles, n’ont pas besoin de médecins.',
    choices: d => [
      { id: 'bulletin', label: 'Publier un bulletin de santé complet', effects: [st('credibility', 2), st('popularity', 1), { kind: 'health', delta: 4 }, calm(8)], outcome: 'La transparence coupe court aux rumeurs.' },
      { id: 'repos', label: 'Prendre deux semaines de vrai repos', effects: [st('stress', -15), { kind: 'health', delta: 8 }, { kind: 'momentum', delta: -10 }, ...power(d, -2, 0), calm(12)], outcome: 'Deux semaines loin de tout. À votre retour, d’autres ont occupé la place.' },
      { id: 'nier', label: 'Reprendre le travail dès le lendemain', effects: [st('stress', 10), { kind: 'health', delta: -6 }, st('popularity', 1), calm(4)], outcome: 'Vous enchaînez trois déplacements pour montrer que tout va bien. Votre médecin désapprouve.' },
    ],
  },
  {
    id: 'nm_deepfake', weight: 2, eligible: known,
    hit: d => { d.player.stats.popularity = clamp(d.player.stats.popularity - 4 * mods(d).loss); },
    title: 'La vidéo truquée',
    context: () => 'Une vidéo plus vraie que nature vous montre annonçant la suppression d’un jour férié et la hausse de la TVA. Elle est fausse, mais elle a été vue douze millions de fois avant le premier démenti.',
    choices: () => [
      { id: 'plainte', label: 'Porter plainte et saisir les plateformes', effects: [{ kind: 'dossier', domain: 'numerique', delta: 3 }, st('energy', -6), st('credibility', 2), calm(8)], outcome: 'La vidéo est retirée. Ses copies, elles, circulent encore.' },
      { id: 'loi', label: 'Annoncer une loi contre les hypertrucages', effects: [{ kind: 'dossier', domain: 'numerique', delta: 5 }, seg('jeunes', -3), st('politicalCapital', -8), calm(12)], outcome: 'Les défenseurs des libertés numériques s’inquiètent. Le texte est déposé.' },
      { id: 'laisser', label: 'Ne pas lui faire de publicité', effects: [calm(4)], outcome: 'Vous ne commentez pas.',
        risk: { baseChance: 0.5, onFailure: [st('popularity', -6), seg('retraites', -5)], failureNews: 'Un Français sur cinq croit encore que vous avez annoncé la hausse de la TVA.' } },
    ],
  },
  {
    id: 'nm_ronds_points', weight: 3, eligible: national,
    hit: d => { const off = d.electorate?.offsets; if (off) { off.ruraux = clamp(off.ruraux - 6, -30, 30); off.populaires = clamp(off.populaires - 4, -30, 30); } },
    title: 'La colère des ronds-points',
    context: () => 'Tout est parti d’une hausse de quelques centimes sur le carburant. Des milliers de gilets fluo occupent les ronds-points, chaque samedi. Pas de chef, pas de syndicat, pas d’interlocuteur : juste une colère qui vous vise personnellement.',
    choices: () => [
      { id: 'annuler', label: 'Annuler la hausse et ouvrir un grand débat', effects: [{ kind: 'economy', deficit: 0.15 }, seg('ruraux', 4), st('credibility', -4), st('energy', -12), calm(18)], outcome: 'Des centaines de réunions publiques. La colère se fait parole.' },
      { id: 'fermete', label: 'Maintenir la mesure, faire respecter l’ordre', effects: [seg('ruraux', -6), seg('populaires', -4), seg('retraites', 3), st('popularity', -5), { kind: 'protest' }, calm(10)], outcome: 'Le mouvement se durcit. Chaque samedi devient un test.' },
      { id: 'cheque', label: 'Distribuer un chèque carburant', effects: [{ kind: 'economy', deficit: 0.25 }, seg('ruraux', 3), st('popularity', 2), st('credibility', -3), calm(12)], outcome: 'Cent euros par foyer modeste. Le mouvement s’essouffle, la dette grossit.' },
    ],
  },
  {
    id: 'nm_facs', weight: 2, eligible: national,
    hit: d => { const off = d.electorate?.offsets; if (off) off.jeunes = clamp(off.jeunes - 7, -30, 30); },
    title: 'Les facs bloquées',
    context: () => 'Une réforme mal expliquée, une vidéo d’évacuation musclée, et quarante universités sont bloquées. Les lycéens suivent. La jeunesse, qui vous portait, vous tourne le dos.',
    choices: d => [
      { id: 'dialogue', label: 'Recevoir les organisations étudiantes', effects: [seg('jeunes', 4), { kind: 'dossier', domain: 'education', delta: 2 }, st('politicalCapital', -8), calm(14)], outcome: 'Le dialogue s’ouvre, les blocages se lèvent un à un.' },
      { id: 'evacuer', label: 'Faire lever les blocages', effects: [seg('jeunes', -5), seg('retraites', 3), st('popularity', -3), calm(8)], outcome: 'Les campus rouvrent. Le ressentiment, lui, ne se lève pas.' },
      { id: 'retirer', label: 'Retirer la réforme', effects: [seg('jeunes', 5), st('credibility', -6), ...power(d, -2, -2), calm(16)], outcome: 'Victoire de la rue, revers pour vous.' },
    ],
  },
  {
    id: 'nm_retraites', weight: 2, eligible: national,
    hit: d => { const off = d.electorate?.offsets; if (off) off.retraites = clamp(off.retraites - 7, -30, 30); },
    title: 'Les retraités dans la rue',
    context: () => 'La revalorisation des pensions est plus faible que l’inflation. Pour la première fois, les retraités défilent en masse. Le cœur de l’électorat, celui qui vote à chaque fois, gronde.',
    choices: () => [
      { id: 'rattraper', label: 'Indexer les pensions sur l’inflation', effects: [{ kind: 'economy', deficit: 0.3 }, seg('retraites', 5), seg('jeunes', -3), calm(14)], outcome: 'Les retraités rentrent chez eux. Les jeunes actifs font les comptes.' },
      { id: 'tenir', label: 'Expliquer la contrainte budgétaire', effects: [seg('retraites', -4), st('credibility', 2), st('popularity', -4), calm(8)], outcome: 'Votre pédagogie ne convainc pas ceux qui comptent leurs fins de mois.' },
      { id: 'prime', label: 'Une prime exceptionnelle, une seule fois', effects: [{ kind: 'economy', deficit: 0.12 }, seg('retraites', 2), st('credibility', -3), calm(10)], outcome: 'La prime calme les esprits jusqu’au prochain trimestre.' },
    ],
  },
  {
    id: 'nm_allie', weight: 3, eligible: d => !!d.coalition,
    hit: d => { if (d.presidency) d.presidency.majority = clamp(d.presidency.majority - 6); if (d.government) d.government.majority = clamp(d.government.majority - 6); },
    title: 'Votre allié rompt la coalition',
    context: () => 'Votre partenaire de coalition estime que vous gouvernez « seul et contre tous ». Son bureau national vote la sortie de la majorité. Ses ministres ont vingt-quatre heures pour choisir.',
    choices: d => [
      { id: 'retenir', label: 'Lui céder un grand ministère', effects: [{ kind: 'coalition', mood: 25 }, st('politicalCapital', -20), st('influence', -4), calm(14)], outcome: 'La coalition survit, rééquilibrée à vos dépens.' },
      { id: 'rompre', label: 'Acter la rupture', effects: [{ kind: 'coalition', leave: true }, ...power(d, 0, -8), { kind: 'cohesion', delta: 6 }, calm(12)], outcome: 'Vous gouvernerez seul. Sans majorité absolue.' },
      { id: 'debaucher', label: 'Débaucher ses ministres un à un', effects: [{ kind: 'coalition', mood: -20 }, ...power(d, 0, 3), st('credibility', -5), calm(8)], outcome: 'Trois ministres restent. Leur parti les exclut.' },
    ],
  },
  {
    id: 'nm_panne', weight: 1, eligible: national,
    title: 'La grande panne',
    context: () => 'Un défaut en cascade sur le réseau électrique plonge un tiers du pays dans le noir pendant dix-huit heures. Trains bloqués, hôpitaux sur groupes électrogènes. On découvre que les alertes avaient été ignorées.',
    choices: () => [
      { id: 'plan', label: 'Un plan d’urgence pour le réseau', effects: [{ kind: 'crisis', arc: 'blackout', start: true, gauge: 10 }, { kind: 'economy', deficit: 0.2 }, st('credibility', 2), calm(14)], outcome: 'Des milliards pour le réseau. Les coupures tournantes, elles, commencent.' },
      { id: 'coupables', label: 'Chercher les responsables chez l’opérateur', effects: [{ kind: 'crisis', arc: 'blackout', start: true }, st('popularity', 1), st('credibility', -3), calm(8)], outcome: 'Le patron de l’opérateur démissionne. Le réseau reste fragile.' },
    ],
  },
  {
    id: 'nm_canicule', weight: 1, eligible: national,
    title: 'L’été de feu',
    context: () => '46 degrés à Nîmes, des forêts qui brûlent de la Gironde aux Alpes, des villages sans eau. On vous reproche d’avoir sacrifié la prévention pendant des années.',
    choices: () => [
      { id: 'urgence', label: 'Déclarer l’urgence climatique nationale', effects: [{ kind: 'crisis', arc: 'canicule', start: true, gauge: 10 }, { kind: 'dossier', domain: 'ecologie', delta: 4 }, seg('ruraux', -3), seg('jeunes', 3), calm(14)], outcome: 'Restrictions d’eau, chantiers suspendus, moyens aériens doublés.' },
      { id: 'terrain', label: 'Aller au contact, sur les incendies', effects: [{ kind: 'crisis', arc: 'canicule', start: true }, st('energy', -15), st('popularity', 2), calm(10)], outcome: 'Les images au milieu des pompiers sont fortes. Les critiques aussi.' },
    ],
  },
  {
    id: 'nm_patrimoine', weight: 2, eligible: known,
    hit: d => { d.player.scandalExposure = clamp(d.player.scandalExposure + 8); },
    title: 'La déclaration de patrimoine',
    context: () => 'Un journal compare votre déclaration de patrimoine aux registres : une maison de famille sous-évaluée, un placement oublié. Rien d’illégal, peut-être. Mais « l’oubli » fait sa une.',
    choices: () => [
      { id: 'rectifier', label: 'Rectifier et publier tous vos comptes', effects: [{ kind: 'funds', account: 'personal', delta: -3000 }, st('credibility', 1), { kind: 'exposure', delta: -6 }, calm(14)], outcome: 'Déclaration corrigée, redressement payé. L’affaire s’éteint.' },
      { id: 'minimiser', label: 'Parler d’une erreur de bonne foi', effects: [calm(6)], outcome: 'Vous parlez d’un formulaire mal rempli.',
        risk: { baseChance: 0.5, onFailure: [st('credibility', -8), { kind: 'exposure', delta: 14 }, st('popularity', -5)], failureNews: 'La Haute Autorité saisit la justice. Le mot « fraude » apparaît dans les titres.' } },
    ],
  },
  {
    id: 'nm_culte', weight: 3, min: 30, eligible: d => known(d) && d.player.stats.popularity >= 70,
    title: 'Le culte de la personnalité',
    context: () => 'Un hebdomadaire titre « Le pays d’un seul homme » et égrène vos affiches, vos selfies, vos lois au nom de votre bilan. Les humoristes s’en emparent. Ce qui faisait votre force devient un sujet de moquerie.',
    choices: () => [
      { id: 'discret', label: 'Disparaître des écrans un trimestre', effects: [{ kind: 'momentum', delta: -15 }, st('influence', -3), calm(25)], outcome: 'On vous voit moins. On vous reproche moins. On vous oublie un peu.' },
      { id: 'autoderision', label: 'S’en moquer soi-même', play: 'eloquence', effects: [st('popularity', 2), calm(15)], outcome: 'Votre imitation de votre propre imitateur fait le tour des réseaux.' },
      { id: 'ignorer', label: 'Ignorer les moqueries', effects: [st('popularity', -4), seg('jeunes', -4), seg('cadres', -3), calm(6)], outcome: 'Les moqueries redoublent. La lassitude s’installe.' },
    ],
  },
  {
    id: 'nm_motion', weight: 3, min: 35, eligible: d => !!d.government || !!d.presidency,
    hit: d => { if (d.presidency) d.presidency.majority = clamp(d.presidency.majority - 5); if (d.government) d.government.majority = clamp(d.government.majority - 5); },
    title: 'La motion de censure surprise',
    context: () => 'Toutes les oppositions, de la gauche à la droite, signent une motion de censure commune. Jusqu’ici, elle n’avait aucune chance. Mais une poignée de députés de votre camp hésitent : ils ne supportent plus d’être tenus à l’écart.',
    choices: d => [
      { id: 'convaincre', label: 'Recevoir les hésitants un par un', effects: [...power(d, 0, 5), st('politicalCapital', -16), st('stress', 8), calm(14)], outcome: 'La motion échoue à onze voix. Onze.',
        risk: { baseChance: 0.18, scaleWith: 'influence', scaleWeight: 0.3, onFailure: d.government ? [{ kind: 'government', fall: true }] : [{ kind: 'presidency', pm: true, majority: -6, approval: -6 }], failureNews: 'La motion est adoptée. Le gouvernement doit remettre sa démission.' } },
      { id: 'concession', label: 'Lâcher une réforme pour sauver la majorité', effects: [...power(d, -2, 9), st('credibility', -6), calm(16)], outcome: 'Vous retirez votre texte le plus contesté. La motion échoue largement.' },
    ],
  },
  {
    id: 'nm_lobby', weight: 2, eligible: national,
    title: 'Les dîners discrets',
    context: () => 'Une enquête révèle une série de dîners entre votre entourage et les dirigeants d’un grand groupe, juste avant un amendement très favorable à ce même groupe. Les associations anticorruption saisissent le parquet.',
    choices: () => [
      { id: 'retirer', label: 'Faire retirer l’amendement', effects: [st('credibility', 2), st('influence', -5), st('politicalCapital', -6), calm(14)], outcome: 'L’amendement disparaît. Le groupe cesse de vous inviter.' },
      { id: 'registre', label: 'Publier un registre de tous vos rendez-vous', effects: [st('credibility', 3), st('energy', -6), { kind: 'exposure', delta: -4 }, calm(16)], outcome: 'La transparence devient votre ligne. Vos rendez-vous se raréfient.' },
      { id: 'nier', label: 'Nier tout lien', effects: [calm(5)], outcome: 'Vous parlez de coïncidence.',
        risk: { baseChance: 0.5, onFailure: [st('credibility', -9), { kind: 'exposure', delta: 12 }, seg('populaires', -5)], failureNews: 'Les SMS d’un convive sont publiés. Ils mentionnent votre nom.' } },
    ],
  },
  {
    id: 'nm_hacker', weight: 1, eligible: national,
    title: 'Les fuites du ministère',
    context: () => 'Un groupe de pirates publie trente gigaoctets de documents internes : notes, échanges, mauvais calculs. Chaque jour, un nouvel extrait embarrassant.',
    choices: () => [
      { id: 'cyber', label: 'Mobiliser les experts et assumer les documents', effects: [{ kind: 'crisis', arc: 'hacker', start: true }, st('credibility', 1), { kind: 'dossier', domain: 'numerique', delta: 2 }, calm(12)], outcome: 'Vous commentez chaque fuite avant qu’elle ne sorte. Épuisant.' },
      { id: 'faux', label: 'Dénoncer des documents falsifiés', effects: [{ kind: 'crisis', arc: 'hacker', start: true, risk: 10 }, st('credibility', -4), calm(6)], outcome: 'Certains l’étaient. La plupart, non.' },
    ],
  },
];

/** Le titre de la loi censurée, le temps de rédiger la décision */
let censured = '';

function eligible(d: GameState, n: Nemesis, h: number): boolean {
  if ((n.min ?? 0) > h) return false;
  if (n.eligible && !n.eligible(d)) return false;
  if (d.week - Number(d.player.flags[`ev_${n.id}`] ?? -999) < 30) return false;
  return !d.pendingDecisions.some(x => x.tag === n.id);
}

/**
 * Chaque mois : la domination nourrit l'hubris, l'hubris appelle la foudre.
 * L'usure du sommet érode aussi les jauges les plus hautes.
 */
export function monthlyNemesis(d: GameState, rng: Rng): void {
  const p = d.player;
  if (d.status !== 'en_cours' || p.flags['retired']) return;
  const m = mods(d);
  const dom = dominance(d);
  let h = hubrisOf(d);
  h = clamp(h + dom * 0.14 * m.threat - (dom < 10 ? 4 : dom < 25 ? 1.5 : 0));
  p.flags['hubris'] = Math.round(h * 10) / 10;
  p.flags['dominance'] = dom;

  // Les alertes de la presse avant l'orage
  const warned = Number(p.flags['hubrisWarn'] ?? 0);
  const level = h >= 75 ? 3 : h >= 50 ? 2 : h >= 25 ? 1 : 0;
  if (level > warned) {
    const t = level === 3 ? ['« Rien ne semble pouvoir l’arrêter… jusqu’à quand ? »', 'Les éditorialistes guettent la chute : dans l’histoire politique, aucune domination de ce genre n’a duré. Un faux pas suffira.']
      : level === 2 ? ['Les commentateurs parlent d’arrogance', 'Vos adversaires se coalisent, vos alliés se sentent négligés : l’opinion commence à se lasser de vous voir gagner.']
      : ['L’état de grâce ne durera pas', 'Les succès s’enchaînent. Dans les rédactions comme dans les partis, on commence à chercher la faille.'];
    pushNews(d, 'actu', 'neutral', t[0], t[1]);
  }
  p.flags['hubrisWarn'] = level;

  if (!known(d) || p.flags['monarchie']) return;
  if (d.week - Number(p.flags['nemesisWeek'] ?? -99) < (h >= 45 ? 2 : 3)) return;
  if (d.pendingDecisions.length >= 4) return;
  const chance = clamp((h - 12) / 110 + (dom >= 40 ? 0.08 : 0) + m.risk, 0, 0.55);
  if (!rng.chance(chance)) return;
  {
    const pool = NEMESES.filter(n => eligible(d, n, h));
    const total = pool.reduce((t, n) => t + n.weight * (n.id === 'nm_retournement' ? 1 + h / 40 : 1), 0);
    let roll = rng.next() * total;
    const n = pool.find(x => (roll -= x.weight * (x.id === 'nm_retournement' ? 1 + h / 40 : 1)) < 0);
    if (!n) return;
    p.flags['nemesisWeek'] = d.week;
    p.flags[`ev_${n.id}`] = d.week;
    p.flags['nemesisCount'] = Number(p.flags['nemesisCount'] ?? 0) + 1;
    n.hit?.(d, rng);
    // Le coup lui-même fait retomber un peu la pression ; les choix font le reste
    p.flags['hubris'] = clamp(h - 8);
    const dec: Decision = { id: nextId(d, 'dec'), tag: n.id, week: d.week, deadlineWeek: d.week + 1, source: 'evenement', title: n.title, context: n.context(d), choices: n.choices(d) };
    d.pendingDecisions.push(dec);
  }
}

export const NEMESIS_IDS = NEMESES.map(n => n.id);

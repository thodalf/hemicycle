import {
  DOMAINS, DOMAIN_LABELS, DebateCard, DebateExchange, DebateMove, DebateStakes, DebateState, Domain, Effect,
  FactionId, GameState, Npc, NpcTrait, StaffRole,
} from '../models/game.models';
import { rankOrder } from '../data/ranks';
import { Rng, clamp, nextId } from './rng';
import { programCards } from './programme';
import { composureTraitBonus, debateTraitMult } from './traits';

/* ============================================================
 *  Débat au tour par tour : moteur pur, sans Angular.
 *
 *  Triangle : Faits > Émotion > Attaque > Faits
 *  Parade : renvoie une attaque, mais reste passive face au reste.
 *  Les Faits ne valent que sur le sujet de la manche : la maîtrise
 *  des dossiers devient une arme.
 * ============================================================ */

export const MOVE_LABELS: Record<DebateMove, string> = {
  faits: 'Faits', attaque: 'Attaque', emotion: 'Émotion', parade: 'Parade',
};

/** Qui bat qui (hors parade) */
export const BEATS: Record<Exclude<DebateMove, 'parade'>, DebateMove> = {
  faits: 'emotion', emotion: 'attaque', attaque: 'faits',
};

const OPP_LABELS: Record<DebateMove, string[]> = {
  faits: ['Avalanche de chiffres', 'Cite un rapport officiel', 'Démonstration chiffrée'],
  attaque: ['Attaque personnelle', 'Raille votre inexpérience', 'Ressort une vieille déclaration'],
  emotion: ['Envolée émotionnelle', 'Témoignage poignant', 'Appel aux « vrais gens »'],
  parade: ['Esquive habile', 'Joue l’apaisement', '« Je ne répondrai pas à ça »'],
};

/** Libellés adverses teintés par son camp */
const OPP_LEAN_LABELS: Record<'gauche' | 'droite', Partial<Record<DebateMove, string[]>>> = {
  gauche: {
    attaque: ['Dénonce vos « cadeaux aux plus riches »', 'Vous accuse de mépris social'],
    emotion: ['Parle des fins de mois difficiles', 'Défend « ceux qui n’ont rien »'],
  },
  droite: {
    attaque: ['Dénonce votre « laxisme »', 'Vous accuse de matraquage fiscal'],
    emotion: ['Parle des « Français qui travaillent »', 'Invoque l’ordre et l’autorité'],
  },
};

/** Propositions marquées : une de gauche, une de droite par domaine */
const IDEAS: Record<Domain, Record<'gauche' | 'droite', { label: string; move: DebateMove }>> = {
  education: {
    gauche: { label: 'Revaloriser les enseignants, moins d’élèves par classe', move: 'faits' },
    droite: { label: 'Autorité, uniforme et retour aux fondamentaux', move: 'emotion' },
  },
  sante: {
    gauche: { label: 'Un grand plan pour l’hôpital public', move: 'emotion' },
    droite: { label: 'Ouvrir au privé pour réduire l’attente', move: 'faits' },
  },
  numerique: {
    gauche: { label: 'Taxer les géants du numérique', move: 'faits' },
    droite: { label: 'Faire de la France une nation de start-up', move: 'emotion' },
  },
  territoires: {
    gauche: { label: 'Rouvrir les services publics de proximité', move: 'emotion' },
    droite: { label: 'Libérer les communes des normes', move: 'faits' },
  },
  justice: {
    gauche: { label: 'Des moyens pour la réinsertion', move: 'faits' },
    droite: { label: 'Exécution réelle de toutes les peines', move: 'emotion' },
  },
  economie: {
    gauche: { label: 'Taxer les superprofits', move: 'faits' },
    droite: { label: 'Baisser les charges des entreprises', move: 'faits' },
  },
  ecologie: {
    gauche: { label: 'Planification écologique', move: 'faits' },
    droite: { label: 'Écologie de l’innovation, pas de la punition', move: 'emotion' },
  },
  securite: {
    gauche: { label: 'Police de proximité et prévention', move: 'faits' },
    droite: { label: 'Tolérance zéro', move: 'emotion' },
  },
  social: {
    gauche: { label: 'Hausse du SMIC', move: 'emotion' },
    droite: { label: 'Valoriser le travail, réformer les aides', move: 'faits' },
  },
  diplomatie: {
    gauche: { label: 'Une Europe sociale et solidaire', move: 'emotion' },
    droite: { label: 'Souveraineté d’abord', move: 'emotion' },
  },
};

export const STAKES_INFO: Record<DebateStakes, { title: string; rounds: number; bonus: number }> = {
  face_a_face: { title: 'Face-à-face télévisé', rounds: 4, bonus: 0 },
  hemicycle: { title: 'Joute dans l’hémicycle', rounds: 3, bonus: 2 },
  debat_electoral: { title: 'Débat décisif', rounds: 5, bonus: 10 },
  duel_interne: { title: 'Duel au bureau national', rounds: 4, bonus: 4 },
  entre_deux_tours: { title: 'Débat d’entre-deux-tours', rounds: 6, bonus: 12 },
};

const STYLE_BY_TRAIT: Record<NpcTrait, Partial<Record<DebateMove, number>>> = {
  ideologue: { faits: 1.2 },
  integre: { faits: 0.8, parade: 0.4 },
  mediatique: { emotion: 1.2 },
  carrieriste: { attaque: 0.8 },
  sulfureux: { attaque: 1.4 },
  manoeuvrier: { parade: 0.8, attaque: 0.4 },
};

// ── Création ────────────────────────────────────────────────

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickOpponent(d: GameState, stakes: DebateStakes, rng: Rng): Npc | null {
  const own = d.npcs.filter(n => n.partyId === d.party.id && n.id !== d.party.leaderNpcId);
  const opposition = d.npcs.filter(n => n.partyId !== d.party.id);
  if (stakes === 'duel_interne') {
    return [...own].sort((a, b) => a.relationToPlayer - b.relationToPlayer)[0] ?? null;
  }
  if (stakes === 'hemicycle') {
    return rng.pick([...opposition].sort((a, b) => b.influence - a.influence).slice(0, 3));
  }
  const order = rankOrder(d.player.rankId);
  const peers = opposition.filter(n => Math.abs(rankOrder(n.rankId) - order) <= 1);
  const enemies = own.filter(n => n.relationToPlayer < -20);
  const pool = [...peers, ...enemies];
  return rng.pick(pool.length ? pool : opposition);
}

function buildDeck(d: GameState, rng: Rng, topics: Domain[]): DebateCard[] {
  // Seuls les dossiers en jeu dans ce débat (sujets des manches + actualité) fournissent des cartes
  const inPlay = [...new Set([...topics, d.agendaDomain])];
  const p = d.player;
  const s = p.stats;
  const has = (role: StaffRole) => p.staff.includes(role);
  let n = 0;
  const card = (c: Omit<DebateCard, 'id'>): DebateCard => ({ ...c, id: `c${++n}`, power: Math.round(c.power * debateTraitMult(d, c.move)) });
  const deck: DebateCard[] = [];

  for (const domain of inPlay) {
    const power = 18 + p.dossiers[domain].mastery * 0.55 + p.skills[domain] * 4;
    deck.push(card({ move: 'faits', domain, label: `Chiffres : ${DOMAIN_LABELS[domain]}`, power }));
  }
  deck.push(card({
    move: 'faits', domain: d.agendaDomain, label: `Dossier béton : ${DOMAIN_LABELS[d.agendaDomain]}`,
    power: 22 + p.dossiers[d.agendaDomain].mastery * 0.55,
  }));
  for (const label of ['Mettre en cause son bilan', 'Pointer ses contradictions']) {
    deck.push(card({ move: 'attaque', label, power: 22 + s.influence * 0.35 }));
  }
  for (const label of ['Témoignage d’électeur', 'Appel au bon sens']) {
    deck.push(card({ move: 'emotion', label, power: 22 + s.popularity * 0.35 }));
  }
  for (const label of ['Recadrer le débat', 'Garder son calme', '« Laissez-moi finir »']) {
    deck.push(card({ move: 'parade', label, power: 24 + s.credibility * 0.3 }));
  }
  // Propositions marquées à gauche ou à droite (ou mesures du programme présidentiel)
  if (d.program?.validated) {
    for (const c of programCards(d, rng)) deck.push(card(c));
  } else for (const domain of inPlay) {
    for (const side of ['gauche', 'droite'] as const) {
      const idea = IDEAS[domain][side];
      const power = idea.move === 'faits'
        ? 18 + p.dossiers[domain].mastery * 0.55 + p.skills[domain] * 4
        : 22 + s.popularity * 0.35;
      deck.push(card({ move: idea.move, domain, lean: side === 'gauche' ? -1 : 1, label: idea.label, power }));
    }
  }
  deck.push(card({ move: 'attaque', lean: -1, label: 'Dénoncer les cadeaux aux plus riches', power: 22 + s.influence * 0.35 }));
  deck.push(card({ move: 'attaque', lean: 1, label: 'Dénoncer le laxisme', power: 22 + s.influence * 0.35 }));
  deck.push(card({ move: 'emotion', special: 'anecdote', label: 'Anecdote de terrain', power: 30 + s.popularity * 0.3 }));
  const punchlines = has('plume') ? 2 : 1;
  for (let i = 0; i < punchlines; i++) {
    deck.push(card({ move: 'attaque', special: 'petite_phrase', label: 'Petite phrase assassine', power: 34 + s.influence * 0.3 }));
  }
  if (s.credibility >= 35) {
    deck.push(card({ move: 'parade', special: 'fact_check', label: 'Fact-checking en direct', power: 30 + s.credibility * 0.3 }));
  }
  if (rankOrder(p.rankId) >= rankOrder('ministre')) {
    const best = [...DOMAINS].sort((a, b) => p.dossiers[b].mastery - p.dossiers[a].mastery)[0];
    deck.push(card({ move: 'faits', special: 'bilan', domain: best, label: 'Défendre son bilan', power: 40 + p.dossiers[best].mastery * 0.4 }));
  }
  return shuffle(deck, rng);
}

export function createDebate(
  d: GameState, rng: Rng, stakes: DebateStakes, opponentId?: string, audienceLean?: number,
): DebateState | null {
  const npc = (opponentId && d.npcs.find(n => n.id === opponentId)) || pickOpponent(d, stakes, rng);
  if (!npc) return null;
  const info = STAKES_INFO[stakes];
  const topics: Domain[] = [d.agendaDomain];
  while (topics.length < info.rounds) {
    const next = rng.pick(DOMAINS);
    if (next !== topics.at(-1)) topics.push(next);
  }
  const style: Record<DebateMove, number> = { faits: 1, attaque: 1, emotion: 1, parade: 0.6 };
  for (const t of npc.traits) {
    for (const [m, w] of Object.entries(STYLE_BY_TRAIT[t])) style[m as DebateMove] += w;
  }
  const party = [d.party, ...d.otherParties].find(p => p.id === npc.partyId);
  const deck = buildDeck(d, rng, topics);
  const hasCoach = d.player.staff.includes('coach');
  // Répétitions : un débat préparé commence avec plus de sang-froid (deux séances au plus)
  const prep = Math.min(2, Number(d.player.flags['debatePrep'] ?? 0));
  d.player.flags['debatePrep'] = 0;

  const debate: DebateState = {
    id: nextId(d, 'debat'),
    stakes,
    title: stakes === 'face_a_face' && rankOrder(d.player.rankId) < 1 ? 'Débat en réunion publique' : info.title,
    opponentId: npc.id,
    opponentName: npc.name,
    opponentColor: party?.color ?? '#888',
    round: 1,
    maxRounds: info.rounds,
    topics,
    audience: 0,
    audienceLean: Math.round(audienceLean ?? defaultAudienceLean(d, stakes, rng)),
    oppLean: party?.position ?? 0,
    playerStance: d.player.stance,
    stanceShift: 0,
    partyImpact: { ligne_dure: 0, moderes: 0, reformistes: 0 },
    flipflops: 0,
    composure: clamp(55 + d.player.stats.credibility / 4 + (hasCoach ? 20 : 0) - d.player.stats.stress / 5 + prep * 12 + composureTraitBonus(d)),
    oppComposure: clamp(60 + npc.influence / 4),
    oppPower: clamp(28 + (npc.popularity + npc.influence) * 0.22 + info.bonus, 25, 72),
    oppStyle: style,
    oppIntent: 'faits',
    intentRevealed: false,
    hand: deck.slice(0, 5),
    deck: deck.slice(5),
    combo: 0,
    breathsLeft: 1,
    log: [],
    status: 'en_cours',
    ko: false,
    rewardSummary: [],
  };
  prepareRound(debate, d, rng);
  return debate;
}

/** Qui regarde ? Militants au bureau national, électorat local ou national ailleurs */
function defaultAudienceLean(d: GameState, stakes: DebateStakes, rng: Rng): number {
  switch (stakes) {
    case 'duel_interne': return d.party.position;
    case 'face_a_face': return rng.range(-35, 35);
    case 'hemicycle': return rng.range(-12, 12);
    case 'debat_electoral': return rng.range(-15, 15);
    case 'entre_deux_tours': return rng.range(-8, 8);
  }
}

export function currentStance(debate: DebateState): number {
  return clamp(debate.playerStance + debate.stanceShift, -100, 100);
}

/** Effet d'une carte marquée sur le public et sur votre cohérence */
export function ideology(debate: DebateState, card: DebateCard): { mult: number; resonance?: 'adhere' | 'grince'; flipflop: boolean } {
  if (!card.lean) return { mult: 1, flipflop: false };
  let mult = 1;
  let resonance: 'adhere' | 'grince' | undefined;
  const fit = debate.audienceLean * card.lean;
  if (fit > 15) { mult *= 1.2; resonance = 'adhere'; }
  else if (fit < -15) { mult *= 0.8; resonance = 'grince'; }
  const flipflop = currentStance(debate) * card.lean < -30;
  if (flipflop) mult *= 0.85;
  return { mult, resonance, flipflop };
}

/** Choisit l'intention de l'adversaire. Il apprend : si vous répétez un coup, il le contre. */
function prepareRound(debate: DebateState, d: GameState, rng: Rng): void {
  const odds = baseOdds(debate);
  debate.oppOdds = odds;
  let roll = rng.next();
  debate.oppIntent = MOVES.find(m => (roll -= odds[m]) < 0) ?? 'attaque';
  const reveal = 0.3 + d.player.stats.credibility / 300 + (d.player.staff.includes('plume') ? 0.15 : 0);
  debate.intentRevealed = rng.chance(Math.min(0.9, reveal));
}

const MOVES: DebateMove[] = ['faits', 'attaque', 'emotion', 'parade'];

/** Distribution du prochain coup : son style, et le contre s'il vous voit répéter le même coup */
function baseOdds(debate: DebateState): Record<DebateMove, number> {
  const total = MOVES.reduce((s, m) => s + debate.oppStyle[m], 0);
  const odds = Object.fromEntries(MOVES.map(m => [m, debate.oppStyle[m] / total])) as Record<DebateMove, number>;
  const last = debate.log.slice(-2).map(e => e.playerMove);
  const repeated = last.length === 2 && last[0] === last[1] ? last[0] : null;
  if (!repeated) return odds;
  const counter = repeated === 'parade' ? 'faits'
    : (Object.keys(BEATS) as Exclude<DebateMove, 'parade'>[]).find(m => BEATS[m] === repeated)!;
  for (const m of MOVES) odds[m] *= 0.45;
  if (repeated === 'attaque') { odds.parade += 0.275; odds[counter] += 0.275; } else odds[counter] += 0.55;
  return odds;
}

/** Risque qu'il change de pied quand vos notes ont deviné son coup */
export function feintChance(debate: DebateState): number {
  return debate.oppStyle.parade > 1 ? 0.3 : 0.18;
}

/** Ce que le joueur sait du prochain coup adverse, en probabilités */
export function oppOdds(debate: DebateState): Record<DebateMove, number> {
  if (debate.intentRevealed) {
    const f = feintChance(debate);
    return Object.fromEntries(MOVES.map(m => [m, m === debate.oppIntent ? 1 - f : f / 3])) as Record<DebateMove, number>;
  }
  return debate.oppOdds ?? baseOdds(debate);
}

/** Chances d'une carte face aux coups possibles de l'adversaire (en %) */
export function cardChances(debate: DebateState, card: DebateCard): { win: number; draw: number; lose: number; beats: DebateMove[]; losesTo: DebateMove[] } {
  const odds = oppOdds(debate);
  const pEff = effectivePower(debate, card).power;
  let win = 0, draw = 0, lose = 0;
  const beats: DebateMove[] = [], losesTo: DebateMove[] = [];
  for (const m of MOVES) {
    const o = outcomeOf(card, m);
    if (o === 'gagne' || o === 'renvoi' || o === 'gagne_doux') { win += odds[m]; if (o !== 'gagne_doux') beats.push(m); }
    else if (o === 'egal') { if (pEff > debate.oppPower * 1.05) win += odds[m]; else if (pEff < debate.oppPower * 0.95) lose += odds[m]; else draw += odds[m]; }
    else { lose += odds[m]; if (o === 'perdu') losesTo.push(m); }
  }
  return { win: Math.round(win * 100), draw: Math.round(draw * 100), lose: Math.round(lose * 100), beats, losesTo };
}

// ── Résolution d'une manche ─────────────────────────────────

export function currentTopic(debate: DebateState): Domain {
  return debate.topics[Math.min(debate.round, debate.maxRounds) - 1];
}

/** Puissance réelle d'une carte pour la manche en cours (affichée dans l'interface) */
export function effectivePower(debate: DebateState, card: DebateCard): { power: number; note?: string } {
  let power = card.power;
  let note: string | undefined;
  if (card.move === 'faits' && card.special !== 'bilan') {
    if (card.domain === currentTopic(debate)) { power *= 1.35; note = 'Sur le sujet'; }
    else { power *= 0.55; note = 'Hors sujet'; }
  }
  else if (card.domain && card.special !== 'bilan') {
    if (card.domain === currentTopic(debate)) { power *= 1.15; note = 'Sur le sujet'; }
    else power *= 0.9;
  }
  if (card.special === 'bilan') power *= 1.2;
  const ideo = ideology(debate, card);
  power *= ideo.mult;
  const notes = [note];
  if (ideo.resonance === 'adhere') notes.push('Le public adhère');
  if (ideo.resonance === 'grince') notes.push('Le public grince');
  if (ideo.flipflop) notes.push('Volte-face');
  if (debate.composure < 30) { power *= 0.8; notes.push('Nerveux'); }
  const joined = notes.filter(Boolean).join(' · ');
  return { power: Math.round(power), note: joined || undefined };
}

type Outcome = 'gagne' | 'perdu' | 'egal' | 'gagne_doux' | 'perdu_doux' | 'renvoi';

/** Aperçu affiché sur la carte quand l'intention adverse est connue */
export function previewOutcome(card: DebateCard, opp: DebateMove): 'gagne' | 'perdu' | 'egal' {
  const o = outcomeOf(card, opp);
  return o === 'gagne' || o === 'renvoi' || o === 'gagne_doux' ? 'gagne' : o === 'egal' ? 'egal' : 'perdu';
}

function outcomeOf(card: DebateCard, opp: DebateMove): Outcome {
  const p = card.move;
  if (card.special === 'fact_check' && opp === 'faits') return 'gagne';
  if (p === opp) return 'egal';
  if (p === 'parade') return opp === 'attaque' ? 'renvoi' : 'perdu_doux';
  if (opp === 'parade') return p === 'attaque' ? 'perdu' : 'gagne_doux';
  return BEATS[p] === opp ? 'gagne' : 'perdu';
}

const TEXTS: Record<string, string[]> = {
  'gagne:faits': ['Vos chiffres sur {t} dégonflent son envolée. Le public hoche la tête.', 'Précis, sourcé, imparable : sur {t}, vous l’écrasez.'],
  'gagne:emotion': ['Vous retournez son attaque : « Les gens attendent mieux que ces petites phrases. » Applaudissements.', 'Votre sincérité désarme son agressivité.'],
  'gagne:attaque': ['Vous le coupez en plein tableur : « Vous récitez, vous ne comprenez pas. » Il perd le fil.', 'Votre pique fait mouche : il bafouille sur ses propres chiffres.'],
  'gagne:fact_check': ['Fact-check en direct : son chiffre est faux. Le présentateur confirme. Silence gêné.'],
  'renvoi': ['Vous laissez passer l’orage puis recadrez calmement. L’attaque lui revient en pleine figure.'],
  'gagne_doux': ['Il esquive, mais vous marquez quelques points sur {t}.'],
  'perdu_doux': ['Vous temporisez, il en profite pour dérouler son argumentaire.'],
  'perdu:attaque': ['Votre attaque se brise sur son calme : « Je vous laisse à vos insultes. »', 'Votre pique tombe à plat : il rit, le public avec lui.'],
  'perdu:faits': ['Vous noyez le public dans les chiffres ; son émotion l’emporte.', 'Il vous interrompt : « Les Français ne sont pas des tableaux Excel. »'],
  'perdu:emotion': ['Votre émotion sonne creux face à son offensive.', 'Il démonte votre anecdote : « Facile, l’émotion, quand on n’a pas de bilan. »'],
  'egal': ['Échange tendu, aucun des deux ne lâche.', 'Les arguments se croisent sans se toucher.'],
};

function oppLabel(debate: DebateState, move: DebateMove, rng: Rng): string {
  const side = debate.oppLean <= -15 ? 'gauche' : debate.oppLean >= 15 ? 'droite' : null;
  const flavored = side ? OPP_LEAN_LABELS[side][move] : undefined;
  return rng.pick(flavored && rng.chance(0.6) ? flavored : OPP_LABELS[move]);
}

function text(key: string, topic: Domain, rng: Rng): string {
  const bank = TEXTS[key] ?? TEXTS['egal'];
  return rng.pick(bank).replace('{t}', DOMAIN_LABELS[topic].toLowerCase());
}

export function playCard(debate: DebateState, d: GameState, rng: Rng, cardId: string): void {
  if (debate.status !== 'en_cours') return;
  const card = debate.hand.find(c => c.id === cardId);
  if (!card) return;
  const topic = currentTopic(debate);
  // Les manœuvriers changent parfois de pied au dernier moment
  let feint = false;
  if (debate.intentRevealed && rng.chance(debate.oppStyle.parade > 1 ? 0.3 : 0.18)) {
    const others = (['faits', 'attaque', 'emotion', 'parade'] as DebateMove[]).filter(m => m !== debate.oppIntent);
    debate.oppIntent = rng.pick(others);
    feint = true;
  }
  const opp = debate.oppIntent;
  const pEff = effectivePower(debate, card).power;
  const oppSide = Math.sign(debate.oppLean) * (Math.abs(debate.oppLean) > 15 ? 1 : 0);
  const oppFit = (opp === 'attaque' || opp === 'emotion') ? debate.audienceLean * oppSide : 0;
  const oEff = debate.oppPower * rng.range(0.85, 1.15) * (debate.oppComposure < 30 ? 0.8 : 1) * (opp === 'faits' ? 1.1 : 1)
    * (oppFit > 15 ? 1.15 : oppFit < -15 ? 0.9 : 1);
  const outcome = outcomeOf(card, opp);

  let swing = 0;
  let key: string = outcome;
  switch (outcome) {
    case 'gagne':
      swing = 6 + pEff * 0.45 + debate.combo * 3;
      if (card.special === 'petite_phrase') swing *= 1.6;
      debate.oppComposure -= 12 + pEff * 0.2;
      debate.combo += 1;
      key = card.special === 'fact_check' ? 'gagne:fact_check' : `gagne:${card.move}`;
      break;
    case 'renvoi':
      swing = 8 + pEff * 0.4 + debate.combo * 3;
      debate.oppComposure -= 14;
      debate.combo += 1;
      break;
    case 'gagne_doux':
      swing = 3 + pEff * 0.2;
      debate.oppComposure += 4;
      break;
    case 'perdu':
      swing = -(6 + oEff * 0.45);
      if (card.special === 'petite_phrase') { swing *= 1.5; debate.composure -= 6; d.player.scandalExposure = clamp(d.player.scandalExposure + 4); }
      debate.composure -= 12 + oEff * 0.2;
      debate.combo = 0;
      key = `perdu:${card.move}`;
      break;
    case 'perdu_doux':
      swing = -(3 + oEff * 0.2);
      debate.composure += 6;
      debate.combo = 0;
      break;
    case 'egal':
      swing = (pEff - oEff) * 0.35;
      debate.composure -= 4;
      debate.oppComposure -= 4;
      break;
  }
  if (card.special === 'anecdote') debate.composure += 8;

  // Clivage idéologique : le joueur se positionne, les courants du parti réagissent
  const ideo = ideology(debate, card);
  if (card.lean) {
    if (card.lean * debate.oppLean < -15) swing *= 1.1;
    const before = currentStance(debate);
    debate.stanceShift += card.lean * 6;
    const after = currentStance(debate);
    for (const f of d.party.factions) {
      debate.partyImpact[f.id as FactionId] += (Math.abs(before - f.position) - Math.abs(after - f.position)) * 0.5;
    }
    if (ideo.flipflop) debate.flipflops += 1;
  }

  let line = (feint ? 'Il change de pied au dernier moment ! ' : '') + text(key, card.move === 'faits' && card.domain ? card.domain : topic, rng);
  if (card.move === 'faits' && card.special !== 'bilan' && card.domain !== topic) line += ' (Hors sujet : le public décroche.)';
  if (card.special === 'petite_phrase' && outcome === 'gagne') line += ' La séquence devient virale.';
  if (ideo.resonance === 'adhere') line += ' Le public, acquis à ces idées, applaudit.';
  if (ideo.resonance === 'grince') line += ' Une partie de la salle grince des dents.';
  if (ideo.flipflop) line += ' « Vous disiez l’inverse il y a un mois ! » lui lance-t-on.';

  const exchange: DebateExchange = {
    round: debate.round, topic, playerMove: card.move, playerLabel: card.label, playerLean: card.lean,
    oppMove: opp, oppLabel: oppLabel(debate, opp, rng), swing: Math.round(swing),
    outcome: swing > 0.5 ? 'gagne' : swing < -0.5 ? 'perdu' : 'egal', text: line,
  };
  debate.log.push(exchange);
  debate.audience = clamp(debate.audience + swing, -100, 100);
  debate.composure = clamp(debate.composure);
  debate.oppComposure = clamp(debate.oppComposure);

  // Défausse + pioche
  debate.hand = debate.hand.filter(c => c.id !== cardId);
  const drawn = debate.deck.shift();
  if (drawn) debate.hand.push(drawn);

  advance(debate, d, rng);
}

/** Reprendre son souffle : sacrifie la manche pour regagner du sang-froid */
export function breathe(debate: DebateState, d: GameState, rng: Rng): void {
  if (debate.status !== 'en_cours' || debate.breathsLeft < 1) return;
  debate.breathsLeft -= 1;
  const swing = -(4 + debate.oppPower * 0.15);
  debate.composure = clamp(debate.composure + 25);
  debate.audience = clamp(debate.audience + swing, -100, 100);
  debate.combo = 0;
  debate.log.push({
    round: debate.round, topic: currentTopic(debate), playerMove: 'parade', playerLabel: 'Reprendre son souffle',
    oppMove: debate.oppIntent, oppLabel: oppLabel(debate, debate.oppIntent, rng), swing: Math.round(swing), outcome: 'perdu',
    text: 'Vous buvez un verre d’eau et laissez passer la manche. Il occupe le terrain, mais vous retrouvez vos esprits.',
  });
  advance(debate, d, rng);
}

function advance(debate: DebateState, d: GameState, rng: Rng): void {
  if (debate.composure <= 0) {
    debate.status = 'perdu';
    debate.ko = true;
  } else if (debate.oppComposure <= 0) {
    debate.status = 'gagne';
    debate.ko = true;
  } else if (debate.round >= debate.maxRounds) {
    debate.status = debate.audience >= 6 ? 'gagne' : debate.audience <= -6 ? 'perdu' : 'nul';
  } else {
    debate.round += 1;
    prepareRound(debate, d, rng);
  }
}

// ── Conséquences ────────────────────────────────────────────

export function debateRewards(debate: DebateState): Effect[] {
  const opp = debate.opponentId;
  const ko = debate.ko;
  const R: Record<DebateStakes, Record<'gagne' | 'perdu' | 'nul', Effect[]>> = {
    face_a_face: {
      gagne: [{ kind: 'stat', stat: 'popularity', delta: 5 }, { kind: 'stat', stat: 'credibility', delta: 4 }, { kind: 'stat', stat: 'influence', delta: 2 }, { kind: 'npcStat', npcId: opp, stat: 'popularity', delta: -4 }],
      perdu: [{ kind: 'stat', stat: 'popularity', delta: -3 }, { kind: 'stat', stat: 'credibility', delta: -4 }, { kind: 'stat', stat: 'stress', delta: 8 }],
      nul: [{ kind: 'stat', stat: 'credibility', delta: 1 }],
    },
    hemicycle: {
      gagne: [{ kind: 'stat', stat: 'credibility', delta: 5 }, { kind: 'stat', stat: 'influence', delta: 4 }, { kind: 'faction', factionId: '*', delta: 3 }],
      perdu: [{ kind: 'stat', stat: 'credibility', delta: -4 }, { kind: 'stat', stat: 'influence', delta: -2 }],
      nul: [{ kind: 'stat', stat: 'influence', delta: 1 }],
    },
    debat_electoral: {
      gagne: [{ kind: 'momentum', delta: 25 }, { kind: 'stat', stat: 'popularity', delta: 5 }, { kind: 'npcStat', npcId: opp, stat: 'popularity', delta: -6 }],
      perdu: [{ kind: 'momentum', delta: -20 }, { kind: 'stat', stat: 'popularity', delta: -4 }, { kind: 'stat', stat: 'stress', delta: 10 }],
      nul: [{ kind: 'momentum', delta: 3 }],
    },
    entre_deux_tours: {
      gagne: [{ kind: 'flagAdd', key: 'e2t', delta: 5 }, { kind: 'momentum', delta: 15 }, { kind: 'stat', stat: 'popularity', delta: 4 }, { kind: 'npcStat', npcId: opp, stat: 'popularity', delta: -6 }],
      perdu: [{ kind: 'flagAdd', key: 'e2t', delta: -5 }, { kind: 'momentum', delta: -12 }, { kind: 'stat', stat: 'popularity', delta: -3 }, { kind: 'stat', stat: 'stress', delta: 12 }],
      nul: [{ kind: 'flagAdd', key: 'e2t', delta: 1 }, { kind: 'momentum', delta: 2 }],
    },
    duel_interne: {
      gagne: [{ kind: 'faction', factionId: '*', delta: 6 }, { kind: 'stat', stat: 'influence', delta: 4 }, { kind: 'npcStat', npcId: opp, stat: 'influence', delta: -6 }],
      perdu: [{ kind: 'faction', factionId: '*', delta: -5 }, { kind: 'stat', stat: 'influence', delta: -3 }],
      nul: [{ kind: 'cohesion', delta: 2 }],
    },
  };
  const status = debate.status === 'en_cours' ? 'nul' : debate.status;
  const effects = [...R[debate.stakes][status], { kind: 'npcRelation', npcId: opp, delta: -8 } as Effect];
  if (ko && status === 'gagne') effects.push({ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'stat', stat: 'politicalCapital', delta: 8 });
  if (ko && status === 'perdu') effects.push({ kind: 'stat', stat: 'credibility', delta: -4 }, { kind: 'stat', stat: 'stress', delta: 10 });
  // Un K.-O. le soir du grand débat marque le second tour
  if (ko && debate.stakes === 'entre_deux_tours') effects.push({ kind: 'flagAdd', key: 'e2t', delta: status === 'gagne' ? 2 : -2 });
  // Positionnement idéologique et réaction des courants
  if (debate.stanceShift) effects.push({ kind: 'stance', delta: debate.stanceShift });
  for (const [factionId, raw] of Object.entries(debate.partyImpact) as [FactionId, number][]) {
    const delta = Math.max(-12, Math.min(12, Math.round(raw)));
    if (delta) effects.push({ kind: 'faction', factionId, delta });
  }
  if (debate.flipflops) effects.push({ kind: 'stat', stat: 'credibility', delta: -2 * debate.flipflops });
  return effects;
}

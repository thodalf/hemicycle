import { MISSIONS, TAXES } from './budget';
import { createPress } from './press';
import { setupFoundedPartyAtStart } from '../engine/founding';
import { initialHealth, startAge } from '../engine/life';
import { initPresidential } from '../engine/presidency';
import { initIntl } from '../engine/intl';
import {
  BudgetDraft, DOMAINS, Domain, OutletKind, ScenarioId, DossierState, Faction, FactionId, GameState, NetworkContact, Npc, PartyInfo,
} from '../models/game.models';

/** Partis fictifs */
export const PARTIES: PartyInfo[] = [
  { id: 'gc', name: 'Gauche Commune', color: '#b3263b', position: -72 },
  { id: 'ase', name: 'Alliance Sociale et Écologique', color: '#2f8a5b', position: -40 },
  { id: 'ut', name: 'Union des Territoires', color: '#8e3b6e', position: -5 },
  { id: 'rr', name: 'Renouveau Républicain', color: '#2b5aa8', position: 40 },
  { id: 'mp', name: 'Mouvement Populaire', color: '#c27c0e', position: 72 },
];

/** Mouvement fictif du scénario « Retour à la royauté » */
export const ROYAL_PARTY: PartyInfo = { id: 'lc', name: 'Ligue de la Couronne', color: '#8a6a1f', position: 45 };

/** « du Renouveau… », « de l’Union… », « de la Gauche… » */
export function ofParty(name: string): string {
  if (/^[AEIOUÉ]/.test(name)) return `de l’${name}`;
  if (name.startsWith('Gauche')) return `de la ${name}`;
  return `du ${name}`;
}

/** « au Renouveau… », « à l’Union… », « à la Gauche… » */
export function toParty(name: string): string {
  if (/^[AEIOUÉ]/.test(name)) return `à l’${name}`;
  if (name.startsWith('Gauche')) return `à la ${name}`;
  return `au ${name}`;
}

/** Libellé d'une position sur l'axe gauche-droite */
export function stanceLabel(v: number): string {
  if (v <= -60) return 'très à gauche';
  if (v <= -25) return 'gauche';
  if (v <= -8) return 'centre gauche';
  if (v < 8) return 'centre';
  if (v < 25) return 'centre droit';
  if (v < 60) return 'droite';
  return 'très à droite';
}

/** La ligne dure tire vers l'extrême de son camp, les modérés vers le centre */
export function factionPositions(partyPosition: number): Record<FactionId, number> {
  const side = partyPosition < 0 ? -1 : 1;
  const c = (v: number) => Math.max(-100, Math.min(100, Math.round(v)));
  return {
    ligne_dure: c(partyPosition + 28 * side),
    moderes: c(partyPosition - 25 * side),
    reformistes: c(partyPosition - 8 * side),
  };
}

const OPPOSITION_FIGURES: Record<string, [string, string]> = {
  rr: ['Bertrand Achour', 'Claire Montagnac'],
  ase: ['Nadia Ferhat', 'Yves Le Goff'],
  mp: ['Paul-Henri Gaillard', 'Inès Moreau'],
  ut: ['Gilles Marchetti', 'Anaïs Roussel'],
  gc: ['Rosa Delcourt', 'Malik Benali'],
};

export function makeFactions(partyPosition: number): Faction[] {
  const pos = factionPositions(partyPosition);
  return [
    { id: 'ligne_dure', name: 'Ligne dure', weight: 35, position: pos.ligne_dure, satisfaction: 50, supportForPlayer: 35 },
    { id: 'moderes', name: 'Modérés', weight: 40, position: pos.moderes, satisfaction: 55, supportForPlayer: 40 },
    { id: 'reformistes', name: 'Réformistes', weight: 25, position: pos.reformistes, satisfaction: 50, supportForPlayer: 40 },
  ];
}

function makeNpcs(partyId: string): Npc[] {
  const internal: Npc[] = [
    {
      id: 'npc-vasseur', name: 'Hélène Vasseur', partyId, rankId: 'chef_parti', factionId: 'moderes',
      traits: ['integre', 'manoeuvrier'], ambition: 60, loyalty: 65, aggressiveness: 30,
      popularity: 55, influence: 75, relationToPlayer: 10, isRival: false,
    },
    {
      id: 'npc-delorme', name: 'Marc-Antoine Delorme', partyId, rankId: 'depute', factionId: 'ligne_dure',
      traits: ['carrieriste', 'sulfureux'], ambition: 85, loyalty: 30, aggressiveness: 70,
      popularity: 32, influence: 45, relationToPlayer: -5, isRival: true,
    },
    {
      id: 'npc-lemaire', name: 'Sophie Lemaire-Kahn', partyId, rankId: 'ministre', factionId: 'reformistes',
      traits: ['mediatique', 'carrieriste'], ambition: 78, loyalty: 45, aggressiveness: 45,
      popularity: 50, influence: 60, relationToPlayer: 0, isRival: true,
    },
    {
      id: 'npc-pradel', name: 'Julien Pradel', partyId, rankId: 'conseiller_municipal', factionId: 'moderes',
      traits: ['ideologue'], ambition: 55, loyalty: 55, aggressiveness: 40,
      popularity: 16, influence: 14, relationToPlayer: 0, isRival: true,
    },
  ];
  const opposition: Npc[] = PARTIES.filter(p => p.id !== partyId).flatMap(p => {
    const [leader, local] = OPPOSITION_FIGURES[p.id];
    const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z]+/g, '-');
    return [
      {
        id: `npc-${slug(leader)}`, name: leader, partyId: p.id, rankId: 'chef_parti', factionId: null,
        traits: ['mediatique'], ambition: 80, loyalty: 50, aggressiveness: 50,
        popularity: 45 + p.name.length % 10, influence: 70, relationToPlayer: -10, isRival: false,
      } as Npc,
      {
        id: `npc-${slug(local)}`, name: local, partyId: p.id, rankId: 'conseiller_municipal', factionId: null,
        traits: ['ideologue'], ambition: 55, loyalty: 60, aggressiveness: 35,
        popularity: 14 + local.length % 8, influence: 12, relationToPlayer: -5, isRival: false,
      } as Npc,
    ];
  });
  return [...internal, ...opposition];
}

function makeContacts(): NetworkContact[] {
  return [
    { id: 'ct-hamon', name: 'Lucie Hamon (L’Éclaireur)', type: 'journaliste', domain: 'social', trust: 20, balance: 0, power: 50 },
    { id: 'ct-castaing', name: 'Rémi Castaing (Éco Hebdo)', type: 'journaliste', domain: 'economie', trust: 10, balance: 0, power: 60 },
    { id: 'ct-btp', name: 'Fédération du Bâtiment', type: 'lobby', domain: 'economie', trust: 15, balance: 0, power: 65 },
    { id: 'ct-vernier', name: 'Groupe Vernier Énergie', type: 'industriel', domain: 'ecologie', trust: 5, balance: 0, power: 80 },
    { id: 'ct-ust', name: 'Union Syndicale des Travailleurs', type: 'syndicat', domain: 'social', trust: 15, balance: 0, power: 60 },
    { id: 'ct-climat', name: 'Collectif Climat Urgence', type: 'association', domain: 'ecologie', trust: 20, balance: 0, power: 40 },
    { id: 'ct-police', name: 'Syndicat des Gardiens de la Paix', type: 'syndicat', domain: 'securite', trust: 10, balance: 0, power: 55 },
    { id: 'ct-europe', name: 'Cercle Europe & Monde', type: 'lobby', domain: 'diplomatie', trust: 10, balance: 0, power: 45 },
    ...NEW_CONTACTS.map(c => ({ ...c })),
  ];
}

/** Contacts liés aux dossiers ajoutés (éducation, santé, numérique, territoires, justice) */
export const NEW_CONTACTS: NetworkContact[] = [
  { id: 'ct-enseignants', name: 'Fédération des enseignants', type: 'syndicat', domain: 'education', trust: 15, balance: 0, power: 55 },
  { id: 'ct-soignants', name: 'Collectif des soignants', type: 'association', domain: 'sante', trust: 20, balance: 0, power: 45 },
  { id: 'ct-tech', name: 'France Tech Alliance', type: 'lobby', domain: 'numerique', trust: 10, balance: 0, power: 60 },
  { id: 'ct-maires', name: 'Association des maires ruraux', type: 'association', domain: 'territoires', trust: 20, balance: 0, power: 50 },
  { id: 'ct-avocats', name: 'Conférence des avocats', type: 'lobby', domain: 'justice', trust: 10, balance: 0, power: 40 },
];

export interface NewGameOptions {
  name: string;
  gender: 'femme' | 'homme';
  partyId: string;
  seed?: number;
  /** 'carriere' : de militant·e à l'Élysée · 'presidentielle' : départ en pleine campagne */
  scenario?: ScenarioId;
  /** Parti fondé par le joueur (remplace partyId) */
  customParty?: { name: string; color: string; position: number };
  /** Média du scénario « Éditorialiste » */
  outlet?: OutletKind;
  /** Parti à infiltrer (scénario « Infiltré·e ») ; partyId est alors votre vrai camp */
  targetPartyId?: string;
}

/** Le parti le plus éloigné idéologiquement : cible par défaut d'une infiltration */
export function defaultTarget(homeId: string): string {
  const home = PARTIES.find(p => p.id === homeId) ?? PARTIES[0];
  return [...PARTIES].filter(p => p.id !== home.id).sort((a, b) => Math.abs(b.position - home.position) - Math.abs(a.position - home.position))[0].id;
}

export function createInitialState(opts: NewGameOptions): GameState {
  const infiltre = opts.scenario === 'infiltre';
  const home = PARTIES.find(p => p.id === opts.partyId) ?? PARTIES[0];
  const target = infiltre ? PARTIES.find(p => p.id === (opts.targetPartyId ?? defaultTarget(home.id)) && p.id !== home.id) ?? PARTIES.find(p => p.id === defaultTarget(home.id))! : null;
  const custom = opts.customParty && opts.scenario !== 'royaute' && !infiltre
    ? { id: 'perso', name: opts.customParty.name, color: opts.customParty.color, position: opts.customParty.position } : null;
  const party = target ?? custom ?? (opts.scenario === 'royaute' ? ROYAL_PARTY : home);
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const dossiers = Object.fromEntries(
    DOMAINS.map(d => [d, { mastery: 10, lastStudiedWeek: null } satisfies DossierState]),
  ) as Record<Domain, DossierState>;
  const skills = Object.fromEntries(DOMAINS.map(d => [d, 0])) as Record<Domain, number>;

  const state: GameState = {
    version: 2,
    seed,
    rngState: seed,
    week: 1,
    idCounter: 0,
    agendaDomain: DOMAINS[seed % DOMAINS.length],
    agendaLockedUntil: 0,
    debate: null,
    objectives: [],
    program: null,
    protest: null,
    scene: null,
    scenario: opts.scenario ?? 'carriere',
    crown: null,
    lodge: null,
    press: null,
    mole: null,
    partyFinance: null,
    nationalBudget: null,
    status: 'en_cours',
    milestones: [],
    death: null,
    presidency: null,
    portfolio: null,
    government: null,
    intl: initIntl(),
    project: null,
    war: null,
    vote: null,
    voteHistory: [],
    minigames: [],
    alien: null,
    presidential: null as unknown as GameState['presidential'],
    player: {
      name: opts.name.trim() || 'Camille Martin',
      gender: opts.gender,
      rankId: 'militant',
      stats: { popularity: 8, influence: 6, politicalCapital: 10, credibility: 20, stress: 15, energy: 85 },
      dossiers,
      skills,
      skillPoints: 1,
      finances: { personal: 4000, campaign: 0, campaignSpent: 0, legalCeiling: null },
      actionPoints: { max: 5, current: 5 },
      scandalExposure: 0,
      momentum: 0,
      stance: party.position,
      staff: [],
      team: [],
      pool: [],
      boosters: 1,
      assets: [],
      loans: [],
      age: 0,
      health: 80,
      flags: { plotEra: 1 },
    },
    party: { ...party, factions: makeFactions(party.position), leaderNpcId: 'npc-vasseur', cohesion: 60 },
    otherParties: PARTIES.filter(p => p.id !== party.id),
    npcs: makeNpcs(party.id),
    contacts: makeContacts(),
    news: [],
    pendingDecisions: [],
    polls: [],
    elections: [],
    cooldowns: {},
  };
  if (opts.scenario === 'presidentielle') startPresidentialCampaign(state);
  if (opts.scenario === 'bercy') startAtBercy(state);
  if (opts.scenario === 'royaute') startRoyalty(state);
  if (opts.scenario === 'franc_macon') startLodge(state);
  if (opts.scenario === 'editorialiste') startPress(state, opts.outlet ?? 'radio');
  if (opts.scenario === 'contact') startContact(state);
  if (opts.scenario === 'invasion') startInvasionScenario(state);
  if (opts.scenario === 'guerre_totale') startTotalWarScenario(state);
  if (opts.scenario === 'complot') startComplotScenario(state);
  if (infiltre) startMole(state, home);
  if (custom && opts.customParty) setupFoundedPartyAtStart(state, opts.customParty);
  state.player.age = startAge(state.scenario);
  state.player.health = initialHealth(state.player.age);
  state.presidential = initPresidential(state);
  if (opts.scenario === 'guerre_totale') {
    state.presidential = { nextWeek: 46, incumbentId: 'player', incumbentName: state.player.name, incumbentMandates: 1, incumbentPartyId: state.party.id, declared: false, parrainages: 0 };
  }
  return state;
}

/** Scénario « Le complot » : député·e menacé·e de mort, un complot à déjouer */
function startComplotScenario(s: GameState): void {
  const p = s.player;
  p.rankId = 'depute';
  p.actionPoints = { max: 7, current: 7 };
  p.stats = { popularity: 38, influence: 35, politicalCapital: 30, credibility: 45, stress: 35, energy: 85 };
  for (const domain of DOMAINS) p.dossiers[domain].mastery = 25;
  p.dossiers.justice.mastery = 50;
  p.dossiers.securite.mastery = 40;
  p.finances.personal = 14_000;
  p.flags['menace'] = 40;
}

/** Scénario « Guerre contre la Nation » : ministre de l'Intérieur quand la France est attaquée */
function startInvasionScenario(s: GameState): void {
  const p = s.player;
  p.rankId = 'ministre';
  p.actionPoints = { max: 8, current: 8 };
  p.stats = { popularity: 40, influence: 55, politicalCapital: 40, credibility: 50, stress: 30, energy: 90 };
  for (const domain of DOMAINS) p.dossiers[domain].mastery = 28;
  p.dossiers.securite.mastery = 55;
  p.dossiers.diplomatie.mastery = 40;
  p.skills.securite = 2;
  s.portfolio = 'securite';
  p.finances.personal = 15_000;
  s.party.factions.forEach(f => (f.supportForPlayer = 50));
  s.intl.tension = 60;
  s.intl.hostile = { karstanie: -88, meridia: -25, kantor: -40, zamerie: -35, valdovie: -15 };
}

/** Scénario « Guerre totale » : président·e d'une France déjà en guerre, qui bascule dans la guerre totale */
function startTotalWarScenario(s: GameState): void {
  const p = s.player;
  p.rankId = 'president';
  p.actionPoints = { max: 9, current: 9 };
  p.stats = { popularity: 48, influence: 70, politicalCapital: 50, credibility: 55, stress: 35, energy: 90 };
  for (const domain of DOMAINS) p.dossiers[domain].mastery = 35;
  p.dossiers.diplomatie.mastery = 55;
  p.dossiers.securite.mastery = 50;
  p.finances.personal = 40_000;
  s.party.factions.forEach(f => (f.supportForPlayer = 55));
  s.presidency = { since: 1, mandates: 1, approval: 50, majority: 54, security: 55, threat: 40, primeMinister: 'Claire Montel', reforms: 0, cohabitation: false, lastCrisisWeek: 1 };
  s.intl.tension = 70;
  s.intl.hostile = { karstanie: -40, meridia: -96, kantor: -40, zamerie: -35, valdovie: -15 };
}

/** Scénario « Retour à la royauté » : vous dirigez un mouvement royaliste fictif */
function startRoyalty(s: GameState): void {
  const p = s.player;
  p.rankId = 'chef_parti';
  p.actionPoints = { max: 8, current: 8 };
  p.stats = { popularity: 22, influence: 35, politicalCapital: 30, credibility: 30, stress: 20, energy: 90 };
  for (const domain of DOMAINS) p.dossiers[domain].mastery = 25;
  p.finances.personal = 20_000;
  s.party.leaderNpcId = 'player';
  s.party.factions.forEach(f => (f.supportForPlayer = 55));
  s.crown = { pretendant: 'le prince Louis-Amaury de Valmont', soutien: 12, legitimite: 30, armee: 12 };
}

/** Scénario « Premier contact » : député·e nommé·e à la tête de la cellule du Premier contact */
function startContact(s: GameState): void {
  const p = s.player;
  p.rankId = 'depute';
  p.actionPoints = { max: 7, current: 7 };
  p.stats = { popularity: 34, influence: 40, politicalCapital: 35, credibility: 48, stress: 25, energy: 90 };
  for (const domain of DOMAINS) p.dossiers[domain].mastery = 25;
  p.dossiers.numerique.mastery = 45;
  p.dossiers.diplomatie.mastery = 40;
  p.finances.personal = 12_000;
  p.flags['hautCommissaire'] = true;
  s.alien = { species: 'les Vélari', phase: 0, comprehension: 8, confiance: 30, panique: 18, rivalite: 15, gifts: 0, since: 1 };
}

/** Scénario « Infiltré·e » : militant·e de votre camp, encarté·e chez l'adversaire */
function startMole(s: GameState, home: PartyInfo): void {
  const p = s.player;
  p.stats = { popularity: 6, influence: 8, politicalCapital: 12, credibility: 22, stress: 20, energy: 90 };
  p.finances.personal = 3_000;
  p.stance = s.party.position;
  s.mole = {
    homeId: home.id, homeName: home.name, homeColor: home.color, homePosition: home.position,
    handler: 'Agnès Royer', handlerTrust: 55, cover: 70, intel: 0, delivered: 0, sabotage: 0, lastReport: 1,
  };
}

/** Scénario « Éditorialiste » : journaliste politique dans un média fictif */
function startPress(s: GameState, kind: OutletKind): void {
  const p = s.player;
  p.stats = { popularity: 14, influence: 16, politicalCapital: 10, credibility: 35, stress: 15, energy: 90 };
  for (const domain of DOMAINS) p.dossiers[domain].mastery = 22;
  p.finances.personal = 6_000;
  s.press = createPress(kind, s.week);
}

/** Scénario « Franc-maçon » : un·e élu·e local·e initié·e dans une loge fictive */
function startLodge(s: GameState): void {
  const p = s.player;
  p.rankId = 'conseiller_municipal';
  p.actionPoints = { max: 6, current: 6 };
  p.stats = { popularity: 22, influence: 20, politicalCapital: 20, credibility: 30, stress: 15, energy: 90 };
  for (const domain of DOMAINS) p.dossiers[domain].mastery = 20;
  p.finances.personal = 8_000;
  s.lodge = {
    loge: 'Les Compagnons de l’Aube', obedience: 'l’Obédience de l’Équerre et du Compas',
    grade: 0, fraternite: 30, discretion: 85, planches: 0,
  };
}

/** Scénario court : ministre de l'Économie, premier budget à boucler en trois mois */
function startAtBercy(s: GameState): void {
  const p = s.player;
  p.rankId = 'ministre';
  p.actionPoints = { max: 8, current: 8 };
  p.stats = { popularity: 42, influence: 58, politicalCapital: 40, credibility: 50, stress: 25, energy: 90 };
  for (const domain of DOMAINS) p.dossiers[domain].mastery = 30;
  p.dossiers.economie.mastery = 55;
  p.skills.economie = 2;
  s.portfolio = 'economie';
  p.finances.personal = 15_000;
  s.party.factions.forEach(f => (f.supportForPlayer = 50));
  s.nationalBudget = {
    year: 2028, pending: true, deadlineWeek: 4, nextDueWeek: 13,
    draft: {
      missions: Object.fromEntries(MISSIONS.map(m => [m.id, m.base])) as BudgetDraft['missions'],
      taxes: Object.fromEntries(TAXES.map(t => [t.id, t.base])) as BudgetDraft['taxes'],
    },
    rejected: false, debtPenalty: 0, history: [],
  };
}

/** Scénario court : candidat·e investi·e, campagne présidentielle de cinq mois, programme à bâtir */
function startPresidentialCampaign(s: GameState): void {
  const p = s.player;
  p.rankId = 'candidat_presidence';
  p.actionPoints = { max: 9, current: 9 };
  p.stats = { popularity: 50, influence: 60, politicalCapital: 50, credibility: 52, stress: 25, energy: 90 };
  for (const domain of DOMAINS) p.dossiers[domain].mastery = 35;
  for (const domain of DOMAINS) p.skills[domain] = 1;
  p.skillPoints = 2;
  p.finances = { personal: 25_000, campaign: 120_000, campaignSpent: 0, legalCeiling: 400_000 };
  s.party.leaderNpcId = 'player';
  s.party.factions.forEach(f => (f.supportForPlayer = 52));
  const former = s.npcs.find(n => n.id === 'npc-vasseur');
  if (former) former.rankId = 'ministre';

  const leaders = s.npcs
    .filter(n => n.partyId !== s.party.id && n.rankId === 'chef_parti')
    .sort((a, b) => b.influence - a.influence)
    .slice(0, 3);
  leaders.forEach(n => (n.popularity = Math.max(n.popularity, 46)));
  s.elections.push({
    id: 'elec-0', type: 'presidentielle', campaignStartWeek: 1, week: 6,
    candidateIds: ['player', ...leaders.map(n => n.id)], resolved: false,
  });
  s.program = { answers: {}, validated: false };
}

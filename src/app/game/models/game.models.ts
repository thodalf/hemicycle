/* ============================================================
 *  Modèles de données — Simulateur de carrière politique
 *  Toutes les jauges sont normalisées sur 0‑100 sauf mention.
 * ============================================================ */

// ── Énumérations ────────────────────────────────────────────

export type RankId =
  | 'militant'
  | 'conseiller_municipal'
  | 'depute'
  | 'ministre'
  | 'premier_ministre'
  | 'chef_parti'
  | 'candidat_presidence'
  | 'president'
  | 'ancien_president'
  | 'roi';

export type Domain =
  | 'economie' | 'ecologie' | 'securite' | 'diplomatie' | 'social'
  | 'education' | 'sante' | 'numerique' | 'territoires' | 'justice';
export const DOMAINS: readonly Domain[] = [
  'economie', 'social', 'ecologie', 'securite', 'justice',
  'education', 'sante', 'numerique', 'territoires', 'diplomatie',
];
export const DOMAIN_LABELS: Record<Domain, string> = {
  economie: 'Économie',
  ecologie: 'Écologie',
  securite: 'Sécurité',
  diplomatie: 'Diplomatie',
  social: 'Social',
  education: 'Éducation',
  sante: 'Santé',
  numerique: 'Numérique',
  territoires: 'Territoires',
  justice: 'Justice',
};

export type StatKey = 'popularity' | 'influence' | 'politicalCapital' | 'credibility' | 'stress' | 'energy';
export const STAT_LABELS: Record<StatKey, string> = {
  popularity: 'Popularité',
  influence: 'Influence',
  politicalCapital: 'Capital politique',
  credibility: 'Crédibilité',
  stress: 'Stress',
  energy: 'Énergie',
};

export type ActionCategory = 'fonction' | 'elysee' | 'contact' | 'zombie' | 'apocalypse' | 'saga' | 'crise' | 'lutte' | 'eclat' | 'territoire' | 'securite' | 'intrigue' | 'guerre' | 'arriere' | 'administration' | 'international' | 'terrain' | 'medias' | 'dossiers' | 'parti' | 'reseau' | 'argent' | 'redaction' | 'infiltration' | 'couronne' | 'loge' | 'sante' | 'repos';
export const CATEGORY_LABELS: Record<ActionCategory, string> = {
  fonction: 'Fonction',
  elysee: 'Élysée',
  contact: 'Premier contact',
  securite: 'Sécurité',
  zombie: 'Épidémie Z',
  apocalypse: 'Fin du monde',
  saga: 'Saga',
  crise: 'Crise',
  lutte: 'Lutte',
  eclat: 'Actions d’éclat',
  territoire: 'Territoire',
  intrigue: 'Intrigues',
  guerre: 'Guerre',
  arriere: 'Effort de guerre',
  administration: 'Administration',
  international: 'International',
  terrain: 'Terrain',
  medias: 'Médias',
  dossiers: 'Dossiers',
  parti: 'Parti',
  reseau: 'Réseau',
  argent: 'Argent',
  redaction: 'Rédaction',
  infiltration: 'Infiltration',
  couronne: 'Couronne',
  loge: 'Loge',
  sante: 'Santé',
  repos: 'Repos',
};

export type ScenarioId = 'carriere' | 'presidentielle' | 'bercy' | 'royaute' | 'franc_macon' | 'editorialiste' | 'infiltre' | 'contact' | 'invasion' | 'guerre_totale' | 'complot';

export type ContactType = 'lobby' | 'industriel' | 'syndicat' | 'journaliste' | 'association' | 'culte';
export type FactionId = 'ligne_dure' | 'moderes' | 'reformistes';
export type ElectionType = 'municipales' | 'legislatives' | 'primaire' | 'presidentielle';
export type NewsKind =
  | 'actu' | 'action' | 'decision' | 'scandale' | 'sondage'
  | 'rival' | 'parti' | 'election' | 'reseau' | 'systeme';
export type Tone = 'positive' | 'neutral' | 'negative';
export type NpcTrait = 'carrieriste' | 'ideologue' | 'mediatique' | 'manoeuvrier' | 'integre' | 'sulfureux';
/** 'victoire' et 'defaite' ne durent qu'un instant : elles deviennent des chapitres de vie.
 * Seule la mort ('mort') termine la partie. */
export type GameStatus = 'en_cours' | 'victoire' | 'defaite' | 'mort';
export type DeathCause = 'vieillesse' | 'maladie' | 'accident' | 'assassinat';

// ── Joueur ──────────────────────────────────────────────────

export type Stats = Record<StatKey, number>;
export type StatRequirements = Partial<Record<StatKey, number>>;

export interface DossierState {
  /** 0‑100 : débattre sans maîtrise = risque de discrédit */
  mastery: number;
  lastStudiedWeek: number | null;
}

/** Un bien possédé : sa valeur évolue, il peut être grevé d'un crédit */
export interface OwnedAsset {
  uid: string;
  defId: string;
  value: number;
  /** Capital restant dû (crédit immobilier) */
  debt: number;
  /** Mensualité du crédit */
  payment: number;
  boughtWeek: number;
  boughtPrice: number;
}

export interface Finances {
  personal: number;
  /** Compte de campagne (dons, faveurs) */
  campaign: number;
  /** Dépenses engagées depuis l'ouverture de la campagne en cours */
  campaignSpent: number;
  /** Plafond légal — null hors campagne */
  legalCeiling: number | null;
}

export interface Player {
  name: string;
  gender: 'femme' | 'homme';
  rankId: RankId;
  stats: Stats;
  dossiers: Record<Domain, DossierState>;
  /** Arbre de compétences : niveau 0‑5 par domaine */
  skills: Record<Domain, number>;
  skillPoints: number;
  /** Talents achetés avec les points de compétence (niveau par talent) */
  talents?: Record<string, number>;
  /** Numéros de personnalités politiques obtenus (ids de PNJ) */
  phoneBook?: string[];
  finances: Finances;
  actionPoints: { max: number; current: number };
  /** Risque latent de fuite / scandale (0‑100) */
  scandalExposure: number;
  /** Dynamique de campagne : alimente les sondages, décroît chaque mois */
  momentum: number;
  /** Positionnement idéologique : -100 (gauche) … +100 (droite) */
  stance: number;
  /** Rôles couverts par l'équipe (déduit de team, utilisé par les bonus de rôle) */
  staff: StaffRole[];
  /** Personnes recrutées */
  team: Recruit[];
  /** Candidats disponibles, issus des boosters */
  pool: Recruit[];
  /** Boosters reçus, pas encore ouverts */
  boosters: number;
  /** Biens personnels (patrimoine) */
  assets: OwnedAsset[];
  /** Âge en années (avance d'1/12 par mois) */
  age: number;
  /** Emprunts en cours */
  loans: Loan[];
  /** Santé 0-100 : sous 35, les alertes médicales et le risque de mort grimpent */
  health: number;
  /** Haute fonction publique : corps, grade (en disponibilité pendant un mandat national) */
  civil?: CivilState | null;
  /** Revenus annexes récurrents (enseignement, conseil, chronique, droits d'auteur…) */
  sideIncomes?: SideIncome[];
  /** Traits de personnage (naissance et acquis) : définitifs */
  traits?: string[];
  /** Style de vie choisi, expérience et avantages débloqués */
  lifestyle?: { id: string; xp: number; perks: string[] } | null;
  /** Données des grandes décisions : allié réconcilié, chef des exclus, sujet du livre blanc… */
  edictData?: Record<string, string>;
  /** Renommée (s'accumule, se dépense pour les actions d'éclat) */
  renown?: number;
  /** Crainte inspirée (0-100) */
  dread?: number;
  flags: Record<string, boolean | number>;
}

export interface SideIncome {
  id: string;
  label: string;
  /** Montant mensuel net */
  amount: number;
  since: number;
  /** Dernier mois versé (inclus) ; null : sans fin */
  until: number | null;
  /** Exposition aux scandales ajoutée chaque mois */
  exposure?: number;
  /** Compatible avec une fonction gouvernementale (droits d'auteur, placements) */
  compatible?: boolean;
}

export type CorpsId = 'prefet' | 'conseil_etat' | 'finances' | 'diplomatie' | 'comptes';

export interface CivilState {
  corps: CorpsId;
  /** 0 … 3 */
  grade: number;
  since: number;
  lastPromo: number;
}

// ── Progression ─────────────────────────────────────────────

export type PromotionRule =
  | { via: 'election'; election: ElectionType; to: RankId; requires: StatRequirements; minActions?: number }
  | { via: 'nomination'; occasion: string; to: RankId; requires: StatRequirements; minPartySupport: number; minActions?: number };

export interface RankDefinition {
  id: RankId;
  label: string;
  order: number;
  monthlyActionPoints: number;
  monthlyIncome: number;
  promotion: PromotionRule | null;
}

export interface ElectionConfig {
  label: string;
  /** Nombre d'adversaires générés */
  opponents: number;
  /** Primaire : adversaires issus du parti */
  internal: boolean;
  campaignMonths: number;
  /** Mois entre deux scrutins du même type */
  interval: number;
  legalCeiling: number;
}

// ── Effets (langage commun actions / décisions / événements) ─

/** '$domain' et '$target' sont résolus au moment de l'exécution */
export type DomainRef = Domain | '$domain';
export type TargetRef = string;

export type Effect =
  | { kind: 'stat'; stat: StatKey; delta: number }
  | { kind: 'trait'; trait: string }
  | { kind: 'renown'; delta: number }
  | { kind: 'dread'; delta: number }
  | { kind: 'secret'; owner?: string; reveal?: boolean; type?: string }
  | { kind: 'hook'; npcId: string; strength: 'faible' | 'fort'; reason?: string }
  | { kind: 'struggle'; balance?: number; progress?: number }
  | { kind: 'fronde'; factionId?: FactionId | '*'; delta: number }
  | { kind: 'edict'; id: string; op: 'break' | 'violate' }
  | { kind: 'dossier'; domain: DomainRef; delta: number }
  | { kind: 'funds'; account: 'personal' | 'campaign'; delta: number }
  | { kind: 'faction'; factionId: FactionId | '*' | '$target'; delta: number }
  | { kind: 'cohesion'; delta: number }
  | { kind: 'npcRelation'; npcId: TargetRef; delta: number; reason?: string }
  | { kind: 'contact'; contactId: TargetRef; trust?: number; balance?: number }
  | { kind: 'favor'; contactId: TargetRef }
  | { kind: 'exposure'; delta: number }
  | { kind: 'skillPoints'; delta: number }
  | { kind: 'npcStat'; npcId: TargetRef; stat: 'popularity' | 'influence'; delta: number }
  | { kind: 'momentum'; delta: number }
  | { kind: 'decision'; templateId: string }
  | { kind: 'debate'; stakes: DebateStakes; opponentId?: TargetRef }
  | { kind: 'agenda'; domain: DomainRef; weeks: number }
  | { kind: 'war'; front?: number; support?: number; losses?: number; ally?: string; peace?: boolean; declare?: string; invade?: string; total?: boolean; effort?: number; morale?: number }
  | { kind: 'hostile'; enemy: string; delta: number }
  | { kind: 'civil'; join?: CorpsId | 'classement' | 'sortie' | 'tour'; grade?: number; leave?: boolean; study?: number }
  | { kind: 'team'; recruitId?: string; morale?: number; salaryPct?: number; all?: boolean; leave?: boolean; vacation?: number }
  | { kind: 'side'; id: string; label: string; amount: number; months?: number; exposure?: number; scale?: StatKey; mult?: number; compatible?: boolean; stop?: boolean }
  | { kind: 'leaderPay'; party?: number; president?: number }
  | { kind: 'plot'; danger?: number; intel?: number; start?: boolean; vest?: boolean }
  | { kind: 'vote'; billId?: string; own?: boolean }
  | { kind: 'alien'; comprehension?: number; confiance?: number; panique?: number; rivalite?: number; join?: boolean; gift?: boolean }
  | { kind: 'minigame'; gameId: string; reward: Effect[]; penalty?: Effect[]; title?: string }
  | { kind: 'stance'; delta: number }
  | { kind: 'protest' }
  | { kind: 'scene'; sceneId: string }
  | { kind: 'income'; base: number; scale?: StatKey; mult?: number }
  | { kind: 'flagAdd'; key: string; delta: number }
  | { kind: 'dossierScale'; domain: DomainRef; factor: number }
  | { kind: 'booster'; count: number; reason: string }
  | { kind: 'crown'; soutien?: number; legitimite?: number; armee?: number }
  | { kind: 'kingdom'; prestige?: number; stabilite?: number; opposition?: number; restore?: boolean; fall?: 'decheance' | 'revolution'; regime?: number; ordonnance?: boolean; deed?: string; chantier?: string; progress?: number }
  | { kind: 'lodge'; fraternite?: number; discretion?: number; planches?: number }
  | { kind: 'end'; status: 'victoire' | 'defaite'; reason: string; title: string }
  | { kind: 'grade'; delta: number }
  | { kind: 'joinCrown' }
  | { kind: 'joinLodge' }
  | { kind: 'leaveCrown' }
  | { kind: 'joinPress'; outlet: OutletKind }
  | { kind: 'leavePress' }
  | { kind: 'press'; audience?: number; reputation?: number; independance?: number; scoops?: number; ligne?: number; salaryPct?: number }
  | { kind: 'pressGrade'; delta: number }
  | { kind: 'gainAsset'; defId: string }
  | { kind: 'loan'; amount: number; total: number; lender?: string }
  | { kind: 'mole'; cover?: number; intel?: number; deliver?: boolean; sabotage?: number; leaderPop?: number; handler?: number }
  | { kind: 'bankrupt' }
  | { kind: 'assetValue'; defIds?: string[]; factor: number }
  | { kind: 'sellAsset'; which: 'ostentatious' | 'any' | string; discount?: number }
  | { kind: 'leaveLodge' }
  | { kind: 'partyTreasury'; delta: number }
  | { kind: 'partyMembers'; delta: number }
  | { kind: 'partyAllocation'; line: PartyLine; value: number }
  | { kind: 'rank'; rankId: RankId }
  | { kind: 'health'; delta: number }
  | { kind: 'presidency'; approval?: number; majority?: number; security?: number; threat?: number; reform?: boolean; force?: boolean; pm?: boolean; dissolve?: boolean; pmName?: string; pmNpcId?: string; cabinet?: string }
  | { kind: 'parrainages'; delta: number }
  | { kind: 'declare' }
  | { kind: 'resign'; why?: 'demission' | 'destitution' }
  | { kind: 'die'; cause: DeathCause; text: string }
  | { kind: 'intl'; partner?: string; relation?: number; prestige?: number; tension?: number; crisis?: number; startCrisis?: string; allRelations?: number }
  | { kind: 'government'; majority?: number; cohesion?: number; form?: string; fall?: boolean }
  | { kind: 'flag'; key: string; value: boolean | number }
  | { kind: 'phoneBook'; npcId: TargetRef }
  | { kind: 'family'; partner?: 'meet' | 'marry' | 'divorce'; child?: boolean; parentHealth?: number; childPath?: 'politique' | 'adverse' | 'ailleurs' }
  | { kind: 'heir'; npcId: TargetRef }
  | { kind: 'promise'; domain: DomainRef; text?: string; months?: number; keep?: boolean }
  | { kind: 'localProject'; id?: string; boost?: number; attachment?: number }
  | { kind: 'rivalPlot'; counter?: boolean; start?: TargetRef }
  | { kind: 'economy'; growth?: number; unemployment?: number; deficit?: number; inflation?: number; confidence?: number }
  | { kind: 'segment'; segment: Segment | '*'; delta: number }
  | { kind: 'coalition'; partyId?: string; open?: boolean; mood?: number; leave?: boolean }
  | { kind: 'circo'; move: CircoKind }
  | { kind: 'quote'; text: string; bold: number }
  | { kind: 'annex'; enemyId: string; mode: 'annex' | 'protectorat' | 'reparations' | 'magnanime' | 'liberer' }
  | { kind: 'crisis'; arc: CrisisArcId; start?: boolean; gauge?: number; risk?: number; meta?: string }
  | { kind: 'saga'; start?: string; a?: number; b?: number; c?: number }
  | { kind: 'apocalypse'; start?: boolean; darkness?: number; resistance?: number; cult?: number; pact?: boolean; raid?: boolean }
  | { kind: 'zombie'; start?: 'alerte' | 'minimiser' | 'confiner'; infection?: number; containment?: number; panic?: number; cure?: number; shelter?: boolean }
  | { kind: 'scheme'; type?: string; targetId?: TargetRef; progress?: number; secrecy?: number; abandon?: boolean; ally?: TargetRef };

export interface EffectContext {
  domain?: Domain;
  targetId?: string;
  /** Raison retenue dans les souvenirs des personnages (action, décision…) */
  reason?: string;
}

export interface RiskProfile {
  baseChance: number;
  /** La réussite dépend d'une stat ou de la maîtrise du dossier ciblé */
  scaleWith?: StatKey | 'dossier';
  scaleWeight?: number;
  onFailure: Effect[];
  failureNews?: string;
}

// ── Actions mensuelles ───────────────────────────────────

export interface ActionCost {
  ap: number;
  energy?: number;
  money?: number;
  politicalCapital?: number;
  /** Renommée dépensée (actions d'éclat) */
  renown?: number;
}

export interface ActionDefinition {
  id: string;
  label: string;
  description: string;
  category: ActionCategory;
  minRank: RankId;
  /** Action propre à un scénario (royauté, loge…) */
  scenario?: ScenarioId;
  /** Seuils propres aux scénarios */
  requires?: { soutien?: number; legitimite?: number; armee?: number; grade?: number; asset?: string[]; pressGrade?: number; moleDelivered?: number; minAge?: number; maxHealth?: number; declared?: boolean; crisis?: boolean; government?: boolean; alienPhase?: number; war?: boolean; peace?: boolean; warPower?: boolean; staff?: StaffRole; civil?: boolean; homeFront?: boolean; totalWar?: boolean; noGovernment?: boolean; minFunds?: number; placement?: number; team?: boolean; secondRound?: boolean; schemes?: boolean; portfolio?: Domain; arc?: CrisisArcId; heir?: boolean; promises?: boolean; coalition?: boolean; governing?: boolean; appoint?: boolean; kingdom?: boolean; renownTier?: number; dread?: number; struggle?: string; lifestyle?: string; knownSecret?: boolean; decision?: string; partyLeader?: boolean; treasury?: number; natCrisis?: string; saga?: string; sagaPhase?: number[]; regimeMin?: number; regimeMax?: number; chantier?: boolean; noChantier?: boolean; chantierId?: string; campaign?: ElectionType };
  /** Réservée à certains rangs exactement (ex. ancien·ne président·e) */
  onlyRanks?: RankId[];
  /** Dépense qui ne peut jamais être prise en charge par le parti */
  personalOnly?: boolean;
  /** Dépense réglée uniquement par la caisse du parti (réservée à sa direction) */
  partyOnly?: boolean;
  cost: ActionCost;
  target?: 'domain' | 'npc' | 'contact' | 'faction' | 'partner' | 'enemy';
  targetCondition?: { minTrust?: number };
  effects: Effect[];
  risk?: RiskProfile;
  maxPerMonth?: number;
  /** Mini-jeu qui décide de l'ampleur des gains */
  minigame?: string;
  /** Mois avant de pouvoir refaire l'action */
  cooldown?: number;
  successNews?: string;
}

/** Qui règle la dépense d'une action */
export type Payer = 'perso' | 'parti';

export interface PlannedAction {
  uid: string;
  actionId: string;
  payer?: Payer;
  domain?: Domain;
  targetId?: string;
}

// ── Parti, PNJ, réseau ──────────────────────────────────────

export interface Faction {
  id: FactionId;
  name: string;
  /** Poids au congrès (somme = 100) */
  weight: number;
  /** Position idéologique du courant */
  position: number;
  /** Satisfaction envers la ligne du parti */
  satisfaction: number;
  /** Soutien au joueur */
  supportForPlayer: number;
}

export interface PartyInfo {
  id: string;
  name: string;
  color: string;
  /** Position idéologique : -100 (gauche) … +100 (droite) */
  position: number;
}

export interface Party extends PartyInfo {
  factions: Faction[];
  /** 'player' quand le joueur prend la tête du parti */
  leaderNpcId: string;
  cohesion: number;
  /** Parti fondé par le joueur : il en reste le chef quel que soit son rang */
  founder?: boolean;
  foundedWeek?: number;
}

export interface Npc {
  id: string;
  name: string;
  partyId: string;
  rankId: RankId;
  factionId: FactionId | null;
  traits: NpcTrait[];
  ambition: number;
  loyalty: number;
  aggressiveness: number;
  popularity: number;
  influence: number;
  /** -100 (ennemi juré) … +100 (allié fidèle) */
  relationToPlayer: number;
  isRival: boolean;
  /** Âge (années, fractionnaire) : les personnalités vieillissent */
  age?: number;
  /** Traits de caractère (naissance, tempérament) */
  persona?: string[];
}

export interface NetworkContact {
  id: string;
  name: string;
  type: ContactType;
  domain: Domain;
  trust: number;
  /** > 0 : il vous doit des faveurs · < 0 : vous lui devez */
  balance: number;
  power: number;
}

// ── Actualité, décisions, scrutins ──────────────────────────

export interface NewsItem {
  id: string;
  week: number;
  kind: NewsKind;
  tone: Tone;
  title: string;
  body?: string;
  /** Digne de la une du journal */
  une?: boolean;
}

export interface ChoiceRequirement {
  domain?: Domain;
  minMastery?: number;
  stat?: StatKey;
  minStat?: number;
}

export interface DecisionChoice {
  id: string;
  label: string;
  hint?: string;
  requires?: ChoiceRequirement;
  effects: Effect[];
  risk?: RiskProfile;
  outcome?: string;
  /** Ce choix se joue : un mini-jeu décide de l'ampleur de ses effets */
  play?: string;
}

export interface Decision {
  id: string;
  /** Sert à éviter les doublons (ex. un seul scandale à la fois) */
  tag: string;
  week: number;
  /** À la semaine butoir, la décision devient bloquante */
  deadlineWeek: number;
  source: 'medias' | 'parti' | 'reseau' | 'rival' | 'carriere' | 'evenement';
  title: string;
  context: string;
  domain?: Domain;
  targetId?: string;
  choices: DecisionChoice[];
}

export interface PollSnapshot {
  week: number;
  electionId: string;
  /** candidatId ('player' | npcId) → % */
  results: Record<string, number>;
}

export interface ElectionResult {
  firstRound: Record<string, number>;
  secondRound?: Record<string, number>;
  winnerId: string;
}

export interface ScheduledElection {
  id: string;
  type: ElectionType;
  week: number;
  campaignStartWeek: number;
  candidateIds: string[];
  resolved: boolean;
  result?: ElectionResult;
  /** Présidentielle : premier tour joué, second tour le mois suivant */
  firstRound?: Record<string, number>;
  finalists?: [string, string];
  secondRoundWeek?: number;
}

// ── Débat (combat au tour par tour) ─────────────────────────

/** Triangle : Faits > Émotion > Attaque > Faits. La parade neutralise l'attaque. */
export type DebateMove = 'faits' | 'attaque' | 'emotion' | 'parade';
export type DebateSpecial = 'petite_phrase' | 'fact_check' | 'anecdote' | 'bilan' | 'programme';
export type DebateStakes = 'face_a_face' | 'hemicycle' | 'debat_electoral' | 'duel_interne' | 'entre_deux_tours';
export type DebateStatus = 'en_cours' | 'gagne' | 'perdu' | 'nul';

export interface DebateCard {
  id: string;
  move: DebateMove;
  label: string;
  /** Marqueur idéologique : -1 gauche, +1 droite */
  lean?: -1 | 1;
  /** Puissance de base (avant bonus de sujet / nervosité) */
  power: number;
  domain?: Domain;
  special?: DebateSpecial;
}

export interface DebateExchange {
  round: number;
  topic: Domain;
  playerMove: DebateMove;
  playerLabel: string;
  playerLean?: -1 | 1;
  oppMove: DebateMove;
  oppLabel: string;
  /** Variation de l'audience (+ = en votre faveur) */
  swing: number;
  outcome: 'gagne' | 'perdu' | 'egal';
  text: string;
}

export interface DebateState {
  id: string;
  stakes: DebateStakes;
  title: string;
  opponentId: string;
  opponentName: string;
  opponentColor: string;
  round: number;
  maxRounds: number;
  topics: Domain[];
  /** -100 … +100 : balance de l'audience */
  audience: number;
  /** Orientation politique du public : -100 (gauche) … +100 (droite) */
  audienceLean: number;
  /** Position de l'adversaire (celle de son parti) */
  oppLean: number;
  /** Position du joueur au début du débat, et déplacement depuis */
  playerStance: number;
  stanceShift: number;
  /** Effet cumulé sur le soutien de chaque courant du parti */
  partyImpact: Record<FactionId, number>;
  /** Volte-face idéologiques pendant le débat */
  flipflops: number;
  composure: number;
  oppComposure: number;
  oppPower: number;
  /** Probabilités de jeu de l'adversaire selon son style */
  oppStyle: Record<DebateMove, number>;
  oppIntent: DebateMove;
  intentRevealed: boolean;
  /** Probabilités réelles du prochain coup adverse (affichées au joueur) */
  oppOdds?: Record<DebateMove, number>;
  hand: DebateCard[];
  deck: DebateCard[];
  combo: number;
  breathsLeft: number;
  log: DebateExchange[];
  status: DebateStatus;
  ko: boolean;
  rewardSummary: string[];
}

// ── Vie, présidence ─────────────────────────────────────────

/** Les fins de scénario ne terminent plus la partie : elles deviennent des chapitres */
export interface Milestone {
  week: number;
  age: number;
  title: string;
  text: string;
  kind: 'victoire' | 'revers' | 'carriere';
}

export interface DeathInfo {
  week: number;
  age: number;
  cause: DeathCause;
  text: string;
}

/** Calendrier présidentiel : un scrutin tous les cinq ans (60 mois) */
export interface PresidentialCalendar {
  /** Semaine du prochain scrutin */
  nextWeek: number;
  /** Président·e en exercice : 'player' ou id de PNJ */
  incumbentId: string | null;
  incumbentName: string;
  /** Mandats consécutifs du président en exercice (PNJ) */
  incumbentMandates: number;
  /** Parti au pouvoir */
  incumbentPartyId?: string;
  /** Candidature déclarée pour le prochain scrutin */
  declared: boolean;
  declaredWeek?: number;
  /** Parrainages d'élus recueillis (500 requis) */
  parrainages: number;
  /** Rang à retrouver en cas de défaite */
  prevRank?: RankId;
  /** Baromètre mensuel des intentions de vote (les 18 mois qui précèdent le scrutin) */
  barometer?: Barometer[];
}

/** Un duel de second tour (hypothèse ou sondage d'entre-deux-tours) */
export interface PollDuel {
  a: string;
  b: string;
  results: Record<string, number>;
}

export interface Barometer {
  week: number;
  pollster: string;
  /** Premier tour : candidatId → % */
  results: Record<string, number>;
  /** Hypothèses de second tour */
  duels: PollDuel[];
  /** Vous êtes testé·e sans être (encore) candidat·e */
  hypothetical: boolean;
}

export interface PresidencyState {
  since: number;
  mandates: number;
  /** Cote de confiance (0-100) */
  approval: number;
  /** Soutien de l'Assemblée (≥ 50 : majorité) */
  majority: number;
  /** Protection rapprochée (0-100) */
  security: number;
  /** Menace terroriste / d'attentat contre vous (0-100) */
  threat: number;
  primeMinister: string;
  /** Premier ministre choisi parmi les personnalités (sinon, un·e technocrate) */
  pmNpcId?: string;
  /** Le gouvernement nommé par vous : un nom par ministère */
  cabinet?: Partial<Record<Domain, string>>;
  cabinetStyle?: string;
  reforms: number;
  cohabitation: boolean;
  lastCrisisWeek: number;
  /** Promesses de campagne devenues engagements */
  pledges?: import('../engine/pledges').Pledge[];
}

/** Projet au long cours en cours */
export interface ActiveProject {
  id: string;
  startWeek: number;
  /** Mois déjà accomplis */
  done: number;
  /** Durée totale, en mois */
  months: number;
  /** Domaine travaillé, figé au lancement */
  domain?: Domain;
}

/** Gouvernement dirigé par le joueur (Premier·e ministre) */
export interface GovernmentState {
  since: number;
  /** Soutien de l'Assemblée au gouvernement (≥ 50 : majorité) */
  majority: number;
  /** Solidarité des ministres (0-100) */
  cohesion: number;
  /** Composition choisie : « d'ouverture », « de fidèles »… (vide tant que non formé) */
  composition: string;
}

/** Politique internationale */
export interface IntlCrisis {
  name: string;
  /** 0-100 : à 0, la crise est résolue */
  intensity: number;
  since: number;
}

export interface IntlState {
  /** Rayonnement de la France et le vôtre à l'étranger (0-100) */
  prestige: number;
  /** Tensions internationales (0-100) */
  tension: number;
  /** Relations avec chaque partenaire : -100 … +100 */
  relations: Record<string, number>;
  crisis: IntlCrisis | null;
  treaties: number;
  /** Relations avec les États fictifs hostiles (-100 … +100) : trop bas, ils attaquent */
  hostile?: Record<string, number>;
}

// ── Équipe & objectifs ──────────────────────────────────────

export type StaffRole = 'conseiller' | 'coach' | 'plume' | 'tresorier' | 'directeur_campagne' | 'spin_doctor'
  | 'community_manager' | 'chauffeur' | 'attache_presse' | 'sondeur' | 'assistant_parlementaire' | 'juriste'
  | 'garde_du_corps' | 'chef_cabinet' | 'sherpa';

export type Rarity = 'commun' | 'rare' | 'legendaire';
export type TraitId =
  | 'carnet' | 'bourreau' | 'mediatique' | 'technocrate' | 'leveur' | 'fidele' | 'stratege' | 'reseaux_sociaux'
  | 'gaffeur' | 'ambitieux' | 'dispendieux' | 'colerique' | 'mal_vu' | 'casseroles' | 'paresseux';

export interface Recruit {
  id: string;
  name: string;
  role: StaffRole;
  rarity: Rarity;
  /** Salaire mensuel (€) */
  salary: number;
  traits: TraitId[];
  bio: string;
  /** Salaire attendu sur le marché (prétentions) */
  ask?: number;
  /** Moral 0-100 : sous 25, la démission guette ; au-dessus de 80, on se surpasse */
  morale?: number;
  hiredWeek?: number;
  /** Dernier mois où il ou elle a prévenu qu'il ou elle songe à partir */
  warnedWeek?: number;
  /** Mission confiée chaque mois (conseil) */
  mission?: string;
  /** Cible de la mission (courant, personnalité) */
  missionTarget?: string;
  /** Congés : absent·e du mois leaveFrom (inclus) au mois leaveUntil (exclu) */
  leaveFrom?: number;
  leaveUntil?: number;
}

// ── Scénarios spéciaux ──────────────────────────────────────

export interface CrownState {
  pretendant: string;
  /** Adhésion des Français à la monarchie (%) */
  soutien: number;
  /** Légitimité du prétendant (0-100) */
  legitimite: number;
  /** Ralliement de l'armée et des hauts fonctionnaires (0-100) */
  armee: number;
  /** Le prince a renoncé au trône en faveur du joueur */
  renounced?: boolean;
}

export interface LodgeState {
  loge: string;
  obedience: string;
  /** 0 Apprenti · 1 Compagnon · 2 Maître · 3 Vénérable Maître · 4 Grand Maître */
  grade: number;
  fraternite: number;
  /** Plus elle baisse, plus le risque de révélation grimpe */
  discretion: number;
  planches: number;
}

/** Scénario « Infiltré·e » : taupe dans le parti adverse */
export interface MoleState {
  /** Votre vrai camp */
  homeId: string;
  homeName: string;
  homeColor: string;
  homePosition: number;
  /** Officier traitant (fictif) */
  handler: string;
  handlerTrust: number;
  /** Couverture : à 0, vous êtes démasqué·e */
  cover: number;
  /** Renseignements en main, pas encore transmis */
  intel: number;
  /** Renseignements transmis à votre camp (objectif : 100) */
  delivered: number;
  /** Dégâts infligés au parti infiltré */
  sabotage: number;
  lastReport: number;
}

/** Type de média du scénario « Éditorialiste » */
export type OutletKind = 'presse' | 'tv' | 'radio';

export interface PressState {
  kind: OutletKind;
  outlet: string;
  /** Propriétaire du média (fictif) */
  owner: string;
  /** 0 Pigiste · 1 Chroniqueur · 2 Éditorialiste · 3 Éditorialiste vedette · 4 Directeur de la rédaction */
  grade: number;
  /** Audience de vos interventions (0-100) */
  audience: number;
  /** Réputation journalistique (0-100) */
  reputation: number;
  /** Indépendance vis-à-vis du propriétaire (0-100) */
  independance: number;
  /** Ligne éditoriale du média sur l'axe gauche-droite */
  ligne: number;
  /** Salaire mensuel, en euros */
  salary: number;
  scoops: number;
  /** Mois d'arrivée */
  since: number;
  /** Mois de la dernière promotion */
  gradeWeek?: number;
}

export interface StaffDefinition {
  role: StaffRole;
  name: string;
  title: string;
  perk: string;
  monthlySalary: number;
  minRank: RankId;
}

export type ObjectiveKind = 'debate_win' | 'stat' | 'category' | 'dossier' | 'faction' | 'contact';

export interface Objective {
  id: string;
  kind: ObjectiveKind;
  label: string;
  target: number;
  progress: number;
  /** Paramètre selon le type : stat, catégorie, domaine… */
  param?: string;
  deadlineWeek: number;
  reward: Effect[];
  rewardLabel: string;
}

// ── Programme présidentiel ──────────────────────────────────

export type Segment = 'jeunes' | 'retraites' | 'populaires' | 'cadres' | 'ruraux';

export interface ProgramOption {
  id: 'a' | 'b' | 'c' | 'd';
  label: string;
  /** Position sur l'axe gauche-droite */
  position: number;
  /** Coût net estimé en milliards d'euros par an (négatif = recettes ou économies) */
  cost: number;
  /** Effet sur chaque électorat (-3 … +3) */
  appeal: Partial<Record<Segment, number>>;
}

export interface ProgramQuestion {
  id: string;
  domain: Domain;
  theme: string;
  question: string;
  options: ProgramOption[];
}

export interface ProgramState {
  /** questionId → optionId */
  answers: Record<string, ProgramOption['id']>;
  validated: boolean;
  validatedWeek?: number;
}

// ── Manifestation ───────────────────────────────────────────

export type ProtestPhase = 'preparation' | 'mobilisation' | 'cortege' | 'incident' | 'discours' | 'bilan';
export type ProtestScale = 'locale' | 'nationale';

export interface ProtestCause {
  id: string;
  label: string;
  domain: Domain;
  /** -1 cause de gauche, 0 transpartisane, +1 cause de droite */
  lean: -1 | 0 | 1;
}

/** Variation des jauges : turnout en %, les autres en points */
export interface ProtestDelta {
  turnout?: number;
  tension?: number;
  media?: number;
  image?: number;
  money?: number;
  /** Multiplicateur du déplacement idéologique (discours) */
  stance?: number;
}

export interface ProtestChoice {
  id: string;
  label: string;
  hint?: string;
  requires?: { ally?: boolean; minMastery?: number };
  delta: ProtestDelta;
  risk?: { chance: number; scaleWith?: StatKey | 'dossier'; weight?: number; onFail: ProtestDelta; failText: string };
  text: string;
}

export interface ProtestEvent {
  id: string;
  phase: ProtestPhase;
  title: string;
  context: string;
  choices: ProtestChoice[];
}

export interface ProtestLogEntry {
  phase: ProtestPhase;
  choice: string;
  text: string;
  tone: Tone;
}

export interface ProtestState {
  id: string;
  phase: ProtestPhase;
  scale: ProtestScale;
  causeOptions: ProtestCause[];
  cause: ProtestCause | null;
  allies: string[];
  turnout: number;
  target: number;
  /** 0-100 : à 80, débordements */
  tension: number;
  /** 0-100 */
  media: number;
  /** -50 … +50 : image du mouvement dans l'opinion */
  image: number;
  stanceMult: number;
  overflow: boolean;
  event: ProtestEvent | null;
  usedEvents: string[];
  log: ProtestLogEntry[];
  status: 'en_cours' | 'succes' | 'mitige' | 'echec';
  organizers: number;
  police: number;
  rewardSummary: string[];
}

// ── Scènes interactives (marché, meeting, négociation…) ─────

export interface SceneLogEntry {
  step: string;
  choice: string;
  text: string;
  tone: Tone;
}

export interface SceneState {
  id: string;
  defId: string;
  stage: number;
  stepId: string | null;
  gauges: Record<string, number>;
  /** Variables de texte (partenaire, entreprise, crise…) */
  vars: Record<string, string>;
  domain: Domain;
  usedSteps: string[];
  /** Seuils déjà franchis (déclenchés une seule fois) */
  triggered: string[];
  log: SceneLogEntry[];
  status: 'en_cours' | 'succes' | 'mitige' | 'echec';
  score: number;
  brokenBy?: string;
  rewardSummary: string[];
}

// ── Budgets ─────────────────────────────────────────────────

export type PartyLine = 'permanents' | 'communication' | 'formation' | 'federations' | 'evenements' | 'campagne' | 'numerique' | 'etudes' | 'jeunes' | 'galas';

export interface PartyFinance {
  /** En milliers d'euros */
  treasury: number;
  members: number;
  /** Cotisation annuelle moyenne en euros */
  fee: number;
  /** Dépenses mensuelles par poste, en milliers d'euros */
  allocations: Record<PartyLine, number>;
  lastSettledWeek: number;
  history: { week: number; treasury: number; members: number; balance: number }[];
}

export type MissionId = 'education' | 'defense' | 'securite' | 'justice' | 'sante' | 'ecologie' | 'economie' | 'territoires' | 'recherche' | 'logement' | 'transports' | 'culture' | 'agriculture';
export type TaxId = 'tva' | 'ir' | 'is' | 'energie' | 'patrimoine' | 'csg' | 'succession' | 'niches' | 'superprofits' | 'comportement' | 'economies';

export interface BudgetDraft {
  /** Crédits par mission, en milliards d'euros */
  missions: Record<MissionId, number>;
  /** Valeur de chaque levier fiscal (taux ou variation) */
  taxes: Record<TaxId, number>;
}

export interface NationalBudget {
  year: number;
  pending: boolean;
  deadlineWeek: number;
  nextDueWeek: number;
  draft: BudgetDraft;
  /** Résultat du dernier vote, tant que le joueur n'a pas tranché */
  rejected: boolean;
  /** Surcoût de la dette après un dérapage (Md€) */
  debtPenalty: number;
  history: { year: number; deficitPct: number; via: 'vote' | '49.3' }[];
}

// ── État global ─────────────────────────────────────────────

/** Le niveau de difficulté de la partie */
export type Difficulty = 'decouverte' | 'normal' | 'difficile' | 'impitoyable';

export interface GameState {
  /** 2 : un tour = un mois (1 : un tour = une semaine) */
  version: 2;
  seed: number;
  rngState: number;
  /** Tour en cours, en mois (1 = janvier 2027) */
  week: number;
  idCounter: number;
  /** Sujet qui domine l'actualité ce mois-ci (oriente interviews, débats et votes) */
  agendaDomain: Domain;
  /** Mois jusqu'auquel l'agenda est verrouillé par une crise */
  agendaLockedUntil: number;
  /** Crise nationale en cours (inondations, grève, krach…) */
  nationalCrisis?: { id: string; since: number; until: number } | null;
  debate: DebateState | null;
  objectives: Objective[];
  program: ProgramState | null;
  protest: ProtestState | null;
  scene: SceneState | null;
  /** Difficulté choisie à la création (« normal » par défaut) */
  difficulty?: Difficulty;
  scenario: ScenarioId;
  crown: CrownState | null;
  lodge: LodgeState | null;
  press: PressState | null;
  mole: MoleState | null;
  partyFinance: PartyFinance | null;
  nationalBudget: NationalBudget | null;
  status: GameStatus;
  endReason?: string;
  endTitle?: string;
  /** Chapitres de la vie du personnage (victoires de scénario, revers, grandes étapes) */
  milestones: Milestone[];
  death: DeathInfo | null;
  presidential: PresidentialCalendar;
  presidency: PresidencyState | null;
  /** Ministère du joueur quand il est ministre */
  portfolio: Domain | null;
  government: GovernmentState | null;
  intl: IntlState;
  project: ActiveProject | null;
  /** Guerre en cours */
  war: WarState | null;
  /** Scrutin public en cours à l'Assemblée */
  vote: AssemblyVote | null;
  /** Projets de loi rédigés par le joueur (nom, domaine, orientation, ampleur) */
  customBills?: CustomBill[];
  /** Ce que chaque personnalité pense de vous, raison par raison (s'estompe avec le temps) */
  opinions?: OpinionMod[];
  /** Ce dont les personnalités se souviennent pour toujours */
  memories?: Memory[];
  /** Les secrets : ceux des personnalités et les vôtres */
  secrets?: Secret[];
  /** Vos moyens de pression sur les personnalités */
  hooks?: Hook[];
  /** Les frondes des courants du parti */
  frondes?: Fronde[];
  /** Activité en cours (université d'été, dîner, congrès…) */
  activity?: ActivityState | null;
  /** Grande lutte en cours (sur plusieurs années) */
  struggle?: StruggleState | null;
  /** Derniers votes du joueur à l'Assemblée */
  voteHistory: VoteRecord[];
  /** Mini-jeux à jouer (file d'attente) */
  minigames: MinigameState[];
  /** Premier contact avec une civilisation extraterrestre */
  alien: AlienState | null;
  phone?: PhoneState;
  /** Vos complots en cours */
  schemes?: Scheme[];
  /** Épidémie Z en cours */
  zombie?: ZombieState | null;
  apocalypse?: ApocalypseState | null;
  /** Grande saga au long cours (l'Éveil, le Parc, la base lunaire…) */
  saga?: SagaState | null;
  /** Sagas déjà vécues (elles ne reviennent pas) */
  sagasDone?: string[];
  family?: FamilyState;
  romance?: Romance | null;
  heir?: HeirState | null;
  promises?: Promise[];
  territory?: TerritoryState;
  rivalPlots?: RivalPlot[];
  crises?: Partial<Record<CrisisArcId, CrisisArc>>;
  economy?: EconomyState;
  electorate?: ElectorateState;
  electoralMap?: ElectoralMap | null;
  coalition?: Coalition | null;
  /** Votre image par thème (0-100) */
  reputation?: Record<Domain, number>;
  /** Vos petites phrases restées dans les mémoires */
  quotes?: Quote[];
  /** Vos lois et réformes adoptées */
  laws?: Law[];
  plot?: PlotState | null;
  player: Player;
  party: Party;
  otherParties: PartyInfo[];
  npcs: Npc[];
  contacts: NetworkContact[];
  news: NewsItem[];
  pendingDecisions: Decision[];
  polls: PollSnapshot[];
  /** Cote de popularité mois après mois, pour le baromètre du journal */
  barometre?: number[];
  /** La confiance dans l'exécutif, mois après mois (baromètre du journal quand le joueur est inconnu) */
  barometreNat?: number[];
  elections: ScheduledElection[];
  /** actionId → mois à partir duquel l'action redevient disponible */
  cooldowns: Record<string, number>;
  /** Ministres nommés par téléphone, pour le gouvernement en place */
  cabinetPicks?: { salt: string; picks: Partial<Record<Domain, string>> };
  /** Départs des personnalités : décès, retraites, reconversions… */
  npcLog?: import('../engine/npc-life').NpcLogEntry[];
  /** Le royaume : vous êtes sur le trône d'une monarchie constitutionnelle */
  kingdom?: import('../engine/kingdom').KingdomState | null;
}

// ── Emprunts ────────────────────────────────────────────────

export type LoanAccount = 'personal' | 'campaign';
export type LoanKind = 'banque' | 'revolving' | 'proche' | 'campagne' | 'parti' | 'ancien' | 'culte';

export interface Loan {
  id: string;
  kind: LoanKind;
  lender: string;
  /** Compte crédité, et qui rembourse en priorité */
  account: LoanAccount;
  principal: number;
  /** Capital restant dû */
  remaining: number;
  /** Taux annuel (0.05 = 5 %) */
  rate: number;
  /** Mensualité */
  monthly: number;
  months: number;
  startWeek: number;
}

// ── Guerre ──────────────────────────────────────────────────

// ── Téléphone ───────────────────────────────────────────────

export interface PhoneReply {
  id: string;
  label: string;
  effects: Effect[];
  /** Réponse de l'interlocuteur */
  answer?: string;
}

export interface PhoneMessage {
  id: string;
  week: number;
  kind: 'sms' | 'appel';
  /** Clé de l'interlocuteur : equipe:<id>, chef, contact:<id>, collegue:<id>, proche */
  who: string;
  from: string;
  role: string;
  text: string;
  /** Message envoyé (ou appel passé) par vous */
  outgoing?: boolean;
  replies?: PhoneReply[];
  answered?: string;
  read?: boolean;
  /** Résumé des effets, affiché sous la bulle */
  summary?: string[];
  /** Votre réaction (emoji) à un message reçu */
  reaction?: string;
  /** Appel entrant urgent : à prendre avant la fin du mois */
  urgent?: boolean;
  /** Effets si l'appel est manqué */
  missed?: Effect[];
}

/** Une histoire en cours avec quelqu'un de votre téléphone */
export interface Romance {
  key: string;
  name: string;
  /** 0 premier dîner · 1 deuxième rendez-vous · 2 histoire sérieuse · 3 en couple / liaison */
  stage: number;
  since: number;
  /** Liaison cachée (vous étiez déjà en couple) */
  secret?: boolean;
}

export type SchemeType = 'espionnage' | 'calomnie' | 'sabotage' | 'debauchage' | 'chantage' | 'rallier' | 'fouiller' | 'putsch';

/** Un complot du joueur contre un PNJ */
export interface Scheme {
  id: string;
  type: SchemeType;
  targetId: string;
  targetName: string;
  since: number;
  /** 0-100 : à 100, le complot aboutit */
  progress: number;
  /** 0-100 : plus elle baisse, plus le risque d'être découvert grandit */
  secrecy: number;
  /** Complices ralliés (au téléphone ou en coulisses) : le complot avance plus vite, mais chaque bouche de plus peut parler */
  allies?: SchemeAlly[];
}

export interface SchemeAlly {
  /** Clé du répertoire (« collegue:… », « perso:… », « contact:… ») */
  key: string;
  name: string;
  npcId?: string;
  contactId?: string;
  since: number;
}

export interface PhoneState {
  messages: PhoneMessage[];
  /** Appels passés ce mois-ci */
  callsUsed: number;
  callsWeek: number;
  /** Dernier appel à chacun (mois) */
  called: Record<string, number>;
  /** Dernier SMS envoyé à chacun (mois) */
  sms?: Record<string, number>;
  /** Réseaux sociaux : réactions publiées ce mois-ci */
  social?: { week: number; posts: number; reacted: string[] };
  /** Votre audience : abonnés, tendances, publications */
  audience?: import('../engine/social').SocialStats;
}

// ── Complot ─────────────────────────────────────────────────

export interface PlotState {
  since: number;
  /** Imminence du passage à l'acte (0-100) : à 100, la tentative */
  danger: number;
  /** Ce que vous savez du complot (0-100) : à 100, arrestations */
  intel: number;
  /** Profil du commanditaire (révélé par l'enquête) */
  suspect: string;
  motive: string;
  /** Signes avant-coureurs */
  signs: { week: number; text: string }[];
  /** Mesures de protection prises : gilet pare-balles, trajets changés… */
  vest?: boolean;
}

export interface WarLogEntry {
  week: number;
  text: string;
  front: number;
  tone: Tone;
}

export interface WarState {
  enemyId: string;
  enemy: string;
  /** « contre la Karstanie » */
  against: string;
  casus: string;
  since: number;
  /** 0 (défaite) … 100 (victoire) ; 50 = statu quo */
  front: number;
  /** Soutien de l'opinion à la guerre (0-100) */
  support: number;
  /** Soldats tombés */
  losses: number;
  /** Coût cumulé, en milliards d'euros */
  cost: number;
  /** Partenaires engagés à vos côtés */
  allies: string[];
  /** Autorisée par le Parlement (art. 35) */
  authorized: boolean;
  log: WarLogEntry[];
  /** La France est attaquée : guerre de défense, sur notre sol si le front recule */
  defensive?: boolean;
  /** Guerre totale : toute la Nation mobilisée */
  total?: boolean;
  /** Effort de guerre : production d'armement, réquisitions (0-100) */
  effort?: number;
  /** Moral de l'arrière (0-100) : à zéro, le pays s'effondre */
  morale?: number;
}

// ── Votes à l'Assemblée ─────────────────────────────────────

export type Ballot = 'pour' | 'contre' | 'abstention';

export interface AssemblyGroup {
  partyId: string;
  name: string;
  color: string;
  seats: number;
  position: number;
  /** Groupe de la majorité gouvernementale */
  majority: boolean;
}

export interface VoteTally {
  pour: number;
  contre: number;
  abstention: number;
}

export interface OpinionMod {
  id: string;
  npcId: string;
  label: string;
  /** Valeur d'origine */
  value: number;
  /** Ce qu'il en reste */
  left: number;
  months: number;
  week: number;
}

export interface Memory {
  npcId: string;
  text: string;
  value: number;
  week: number;
}

export interface Secret {
  id: string;
  /** 'player' ou id de la personnalité */
  owner: string;
  type: string;
  /** Connu du joueur (pour un secret de PNJ) */
  known: boolean;
  /** Personnalités qui connaissent ce secret du joueur */
  knownBy: string[];
  exposed: boolean;
  week: number;
}

export interface Hook {
  npcId: string;
  strength: 'faible' | 'fort';
  reason: string;
  week: number;
  /** Dernière utilisation */
  usedWeek?: number;
}

export interface Fronde {
  factionId: FactionId;
  demand: 'ligne' | 'postes' | 'consultation' | 'demission';
  strength: number;
  since: number;
}

export interface ActivityState {
  type: string;
  guests: string[];
  stage: number;
  /** Indices des scènes tirées */
  steps: number[];
  log: string[];
  status: 'en_cours' | 'fini';
  summary: string[];
  week: number;
}

export interface StruggleState {
  id: string;
  phase: number;
  progress: number;
  /** -100 … +100 : vers l'un ou l'autre dénouement */
  balance: number;
  since: number;
}

export interface CustomBill {
  id: string;
  title: string;
  summary: string;
  domain: Domain;
  /** -100 (gauche) … +100 (droite) */
  lean: number;
  opinion: number;
  /** 1 : modeste · 2 : ambitieuse · 3 : historique */
  scale: 1 | 2 | 3;
  /** Coût budgétaire annuel, en milliards (négatif : économies) */
  budget: number;
  week: number;
}

export interface AssemblyVote {
  id: string;
  week: number;
  billId: string;
  title: string;
  summary: string;
  domain: Domain;
  /** Orientation du texte : -100 (gauche) … +100 (droite) */
  lean: number;
  /** Part des Français favorables au texte */
  opinion: number;
  /** Texte du gouvernement ou proposition d'un groupe */
  origin: 'gouvernement' | 'opposition' | 'majorite';
  /** Rôle du joueur dans ce scrutin */
  role: 'depute' | 'rapporteur' | 'gouvernement' | 'chef';
  /** Consigne de votre groupe */
  partyLine: Ballot;
  /** Points de bascule obtenus par vos interventions */
  swing: number;
  /** Humeur cachée de la majorité (fronde, discipline) : seul un sondeur la devine */
  mood?: number;
  /** Étapes déjà jouées : intervention, négociation… */
  moves: string[];
  /** Texte déposé par le joueur (ou son groupe à son initiative) */
  own?: boolean;
  /** Autorisation d'entrer en guerre (art. 35) : ennemi visé */
  warEnemy?: string;
  status: 'debat' | 'resultat';
  playerBallot?: Ballot;
  result?: {
    tally: VoteTally;
    adopted: boolean;
    /** Vote de chaque siège, dans l'ordre de l'hémicycle (gauche → droite) */
    seats: Ballot[];
    groups: { partyId: string; name: string; color: string; seats: number; tally: VoteTally }[];
    via: 'vote' | '49.3';
    summary: string[];
  };
}

export interface VoteRecord {
  week: number;
  title: string;
  ballot: Ballot | '49.3';
  adopted: boolean;
  rebel: boolean;
}

// ── Mini-jeux ───────────────────────────────────────────────

export type MinigameTier = 'brillant' | 'reussi' | 'mitige' | 'rate';

export interface MinigameState {
  id: string;
  gameId: string;
  title: string;
  /** Action ou événement d'origine */
  origin: string;
  /** Effets pleins (réussite) ; pondérés selon le score */
  reward: Effect[];
  /** Effets en cas d'échec */
  penalty: Effect[];
  domain?: Domain;
  targetId?: string;
  /** 0,7 (facile) … 1,4 (difficile) : dépend de la fatigue et du stress */
  difficulty: number;
  status: 'pret' | 'fini';
  /** Partie lancée depuis la salle de jeux (hors agenda) */
  arcade?: string;
  /** Gains à prendre (sinon : pour le plaisir) */
  paid?: boolean;
  score?: number;
  tier?: MinigameTier;
  summary?: string[];
}

// ── Premier contact ─────────────────────────────────────────

// ── Vie privée ──────────────────────────────────────────────

export interface Relative {
  name: string;
  /** Mois de naissance (enfants) */
  born?: number;
  gender?: 'f' | 'm';
  /** Parents : santé 0-100 */
  health?: number;
  alive: boolean;
  /** Enfant adulte : sa voie */
  path?: 'politique' | 'adverse' | 'ailleurs';
}

export interface FamilyState {
  partner: (Relative & { since: number; married?: boolean }) | null;
  children: Relative[];
  parents: Relative[];
  /** Divorces passés */
  divorces: number;
}

/** Votre dauphin·e : son ascension rejaillit sur vous */
export interface HeirState { npcId: string; since: number; lastRank: RankId }

/** Une promesse publique, à tenir avant l'échéance */
export interface Promise {
  id: string;
  text: string;
  domain: Domain;
  madeWeek: number;
  dueWeek: number;
  /** Maîtrise du dossier au moment de la promesse */
  baseline: number;
  status: 'en_cours' | 'tenue' | 'trahie';
}

/** Un projet local dans votre territoire */
export interface LocalProject { id: string; label: string; icon: string; done: number; months: number; x: number; y: number; finished?: boolean }

export interface TerritoryState {
  name: string;
  communes: { name: string; x: number; y: number }[];
  /** Attachement des habitants (0-100) : compte aux élections locales */
  attachment: number;
  projects: LocalProject[];
  /** Région de la circonscription (code de région, ou « OM » pour l'outre-mer) */
  region?: string;
  /** Bastion, circonscription disputée ou terre de mission */
  kind?: CircoKind;
}

export type CircoKind = 'bastion' | 'disputee' | 'mission';

/** Une petite phrase restée dans les mémoires */
export interface Quote { id: string; text: string; week: number; fame: 'culte' | 'boulet' }

/** Une loi ou une réforme adoptée : elle vit après le vote */
export interface Law { id: string; title: string; domain: Domain; week: number; mastery: number; status: 'en_vigueur' | 'evaluee' | 'abrogee'; verdict?: 'succes' | 'echec' }

/** L'économie française : réagit aux réformes, aux crises et à la conjoncture */
export interface EconomyState {
  /** Taux de chômage (%) */
  unemployment: number;
  /** Croissance annuelle du PIB (%) */
  growth: number;
  /** Déficit public (% du PIB) */
  deficit: number;
  /** Dette publique (% du PIB) */
  debt: number;
  /** Inflation annuelle (%) */
  inflation: number;
  /** Confiance des ménages et des entreprises (0-100) */
  confidence: number;
  /** Note souveraine : 0 = AAA, 1 = AA+, … */
  rating: number;
  /** Prochaine revue de la note (mois) */
  nextReview: number;
  history: { week: number; unemployment: number; growth: number; deficit: number; debt: number; inflation: number }[];
}

/** Votre cote par catégorie d'électeurs : écart (en points) à votre popularité générale */
export interface ElectorateState {
  offsets: Record<Segment, number>;
}

/** La carte électorale : le parti en tête dans chaque région */
export interface ElectoralMap {
  label: string;
  week: number;
  regions: Record<string, { partyId: string; share: number }>;
}

/** Une coalition de gouvernement avec un parti voisin */
export interface Coalition {
  partyId: string;
  name: string;
  color: string;
  since: number;
  /** Humeur du partenaire (0-100) : trop basse, il claque la porte */
  mood: number;
  /** Points de majorité qu'il apporte */
  bonus: number;
  ministries: number;
}

/** Un complot qu'un rival mène contre vous */
export interface RivalPlot { npcId: string; since: number; progress: number; kind: 'dossier' | 'rumeurs' | 'investiture' }

/** Les arcs de crise génériques : cyberattaque, procès, Jeux olympiques, dissolution */
export type CrisisArcId = 'cyber' | 'proces' | 'jo' | 'dissolution' | 'krach' | 'megafeux' | 'agriculteurs' | 'taupe'
  | 'blackout' | 'crue' | 'secheresse' | 'autonomie' | 'ia' | 'frelons'
  | 'mars' | 'napoleon' | 'atlantide' | 'ia_candidate' | 'grand_hiver' | 'sosie' | 'greve_generale' | 'templiers' | 'eurovision' | 'comete' | 'referendum' | 'seisme' | 'loto' | 'tempete_solaire' | 'expo_universelle' | 'penurie_medicaments' | 'train_futur' | 'pandas' | 'coupe_monde' | 'jubile' | 'diamants' | 'ours' | 'penurie_essence' | 'capitale_culture' | 'canicule' | 'hacker' | 'barons' | 'grand_debat' | 'tour_eiffel' | 'baleine' | 'mariage_princier' | 'cathedrale' | 'punaises' | 'esport' | 'satellite' | 'casse' | 'vin' | 'nuage' | 'taxis' | 'fusion' | 'viaduc' | 'tresor' | 'algues' | 'barrage' | 'aviaire' | 'skipper' | 'drones' | 'cyclone' | 'lithium' | 'sous_marin' | 'joconde' | 'quatre_jours';
export interface CrisisArc { since: number; months: number; gauge: number; risk: number; meta?: string }

/** Une grande saga : trois jauges (a = votre camp, b = la menace, c = l'opinion), des phases, une fin */
export interface SagaState {
  id: string;
  since: number;
  phase: number;
  phaseSince: number;
  a: number;
  b: number;
  c: number;
  /** Fin obtenue (la saga est alors terminée) */
  outcome?: string;
}

/** Épidémie Z : un virus qui transforme les malades en morts-vivants */
/** Fin du monde : une secte, des présages, puis le Diable en personne */
export interface ApocalypseState {
  since: number;
  /** 0 présages, 1 la secte, 2 le rituel, 3 le Diable, 4 dénouement */
  phase: number;
  phaseSince: number;
  /** Ténèbres qui gagnent le pays (0-100) */
  darkness: number;
  /** Résistance : foi, raison, solidarité (0-100) */
  resistance: number;
  /** Emprise de la secte (0-100) */
  cult: number;
  /** Pacte signé avec le Diable */
  pact?: boolean;
  outcome?: 'secte_demantelee' | 'diable_repousse' | 'regne' | 'pacte';
}

export interface ZombieState {
  since: number;
  /** Part du territoire touchée (0-100) */
  infection: number;
  /** Efficacité du confinement et des cordons sanitaires (0-100) */
  containment: number;
  /** Peur dans l'opinion (0-100) */
  panic: number;
  /** Avancée de la recherche d'un vaccin (0-100) */
  cure: number;
  /** Vaccin en cours de déploiement */
  vaccine?: boolean;
  /** Le pays est déjà tombé une fois */
  fell?: boolean;
}

export interface AlienState {
  /** Nom de la civilisation (fictive) */
  species: string;
  /** 0 signal · 1 approche · 2 en orbite · 3 rencontre · 4 ambassade */
  phase: number;
  /** Compréhension de leur langue et de leurs intentions (0-100) */
  comprehension: number;
  /** Leur confiance envers l'humanité (0-100) */
  confiance: number;
  /** Peur dans l'opinion (0-100) : à 95, émeutes */
  panique: number;
  /** Appétit des grandes puissances pour confisquer le contact (0-100) */
  rivalite: number;
  /** Technologies offertes */
  gifts: number;
  since: number;
}

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
  | 'ancien_president';

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

export type ActionCategory = 'fonction' | 'elysee' | 'contact' | 'guerre' | 'arriere' | 'administration' | 'international' | 'terrain' | 'medias' | 'dossiers' | 'parti' | 'reseau' | 'argent' | 'redaction' | 'infiltration' | 'couronne' | 'loge' | 'sante' | 'repos';
export const CATEGORY_LABELS: Record<ActionCategory, string> = {
  fonction: 'Fonction',
  elysee: 'Élysée',
  contact: 'Premier contact',
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

export type ScenarioId = 'carriere' | 'presidentielle' | 'bercy' | 'royaute' | 'franc_macon' | 'editorialiste' | 'infiltre' | 'contact' | 'invasion' | 'guerre_totale';

export type ContactType = 'lobby' | 'industriel' | 'syndicat' | 'journaliste' | 'association';
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
  flags: Record<string, boolean | number>;
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
  | { via: 'election'; election: ElectionType; to: RankId; requires: StatRequirements }
  | { via: 'nomination'; occasion: string; to: RankId; requires: StatRequirements; minPartySupport: number };

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
  | { kind: 'dossier'; domain: DomainRef; delta: number }
  | { kind: 'funds'; account: 'personal' | 'campaign'; delta: number }
  | { kind: 'faction'; factionId: FactionId | '*' | '$target'; delta: number }
  | { kind: 'cohesion'; delta: number }
  | { kind: 'npcRelation'; npcId: TargetRef; delta: number }
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
  | { kind: 'partyAllocation'; line: PartyLine; value: number }
  | { kind: 'rank'; rankId: RankId }
  | { kind: 'health'; delta: number }
  | { kind: 'presidency'; approval?: number; majority?: number; security?: number; threat?: number; reform?: boolean; force?: boolean; pm?: boolean; dissolve?: boolean }
  | { kind: 'parrainages'; delta: number }
  | { kind: 'declare' }
  | { kind: 'resign'; why?: 'demission' | 'destitution' }
  | { kind: 'die'; cause: DeathCause; text: string }
  | { kind: 'intl'; partner?: string; relation?: number; prestige?: number; tension?: number; crisis?: number; startCrisis?: string; allRelations?: number }
  | { kind: 'government'; majority?: number; cohesion?: number; form?: string; fall?: boolean }
  | { kind: 'flag'; key: string; value: boolean | number };

export interface EffectContext {
  domain?: Domain;
  targetId?: string;
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
  requires?: { soutien?: number; legitimite?: number; armee?: number; grade?: number; asset?: string[]; pressGrade?: number; moleDelivered?: number; minAge?: number; maxHealth?: number; declared?: boolean; crisis?: boolean; government?: boolean; alienPhase?: number; war?: boolean; peace?: boolean; warPower?: boolean; staff?: StaffRole; civil?: boolean; homeFront?: boolean; totalWar?: boolean };
  /** Réservée à certains rangs exactement (ex. ancien·ne président·e) */
  onlyRanks?: RankId[];
  /** Dépense qui ne peut jamais être prise en charge par le parti */
  personalOnly?: boolean;
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
}

// ── Débat (combat au tour par tour) ─────────────────────────

/** Triangle : Faits > Émotion > Attaque > Faits. La parade neutralise l'attaque. */
export type DebateMove = 'faits' | 'attaque' | 'emotion' | 'parade';
export type DebateSpecial = 'petite_phrase' | 'fact_check' | 'anecdote' | 'bilan' | 'programme';
export type DebateStakes = 'face_a_face' | 'hemicycle' | 'debat_electoral' | 'duel_interne';
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
  reforms: number;
  cohabitation: boolean;
  lastCrisisWeek: number;
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

export type PartyLine = 'permanents' | 'communication' | 'formation' | 'federations' | 'evenements' | 'campagne';

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

export type MissionId = 'education' | 'defense' | 'securite' | 'justice' | 'sante' | 'ecologie' | 'economie' | 'territoires' | 'recherche';
export type TaxId = 'tva' | 'ir' | 'is' | 'energie' | 'patrimoine';

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
  debate: DebateState | null;
  objectives: Objective[];
  program: ProgramState | null;
  protest: ProtestState | null;
  scene: SceneState | null;
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
  /** Derniers votes du joueur à l'Assemblée */
  voteHistory: VoteRecord[];
  /** Mini-jeux à jouer (file d'attente) */
  minigames: MinigameState[];
  /** Premier contact avec une civilisation extraterrestre */
  alien: AlienState | null;
  player: Player;
  party: Party;
  otherParties: PartyInfo[];
  npcs: Npc[];
  contacts: NetworkContact[];
  news: NewsItem[];
  pendingDecisions: Decision[];
  polls: PollSnapshot[];
  elections: ScheduledElection[];
  /** actionId → mois à partir duquel l'action redevient disponible */
  cooldowns: Record<string, number>;
}

// ── Emprunts ────────────────────────────────────────────────

export type LoanAccount = 'personal' | 'campaign';
export type LoanKind = 'banque' | 'revolving' | 'proche' | 'campagne' | 'parti' | 'ancien';

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
  score?: number;
  tier?: MinigameTier;
  summary?: string[];
}

// ── Premier contact ─────────────────────────────────────────

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

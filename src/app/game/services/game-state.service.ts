import { initHostile, startInvasion, startWar } from '../engine/war';
import { initTerritory } from '../engine/territory';
import { ensureCirco, initEconomy, initElectorate } from '../engine/country';
import { initFamily } from '../engine/family';
import { welcomePhone } from '../engine/phone';
import { migrateTeamPay } from '../engine/team-pay';
import { reviveFromAssassination, startPlot } from '../engine/plot';
import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { DOMAINS, GameState, StatKey } from '../models/game.models';
import { RANKS } from '../data/ranks';
import { PROJECTS_BY_ID } from '../data/projects';
import { WEEKS_PER_MONTH, inMonth, monthLabel, weekToTurn } from '../engine/calendar';
import { migrateLoans } from '../engine/loans';
import { CULTES, NEW_CONTACTS, NewGameOptions, PARTIES, createInitialState, factionPositions, ofParty, toParty } from '../data/world';
import { availableFunds, partySupport } from '../engine/effects';
import { Rng } from '../engine/rng';
import { weeklyObjectives } from '../engine/objectives';
import { ensurePartyFinance } from '../engine/budget';
import { migrateTeam } from '../engine/recruits';
import { PartyDraft, foundPartyInGame } from '../engine/founding';
import { MOLE_GOAL } from '../engine/mole';
import { initialHealth, settleEndings, startAge } from '../engine/life';
import { initPresidential } from '../engine/presidency';
import { initIntl } from '../engine/intl';
import { roleLabel } from '../engine/government';


const RESUME_KEY = 'polsim.resume.v1';

/** Flags qui contiennent un numéro de tour */
const WEEK_FLAGS = /^(lastOffer|lastHealthAlert|desert|ineligibleUntil|nextElectionWeek|retired|lastRevelation|lastProjectDone|lastVote|lastWar|familyLoan|bankBan|ev_.+|proj_.+|last_.+|bill_.+)$/;

/**
 * Version 1 → 2 : le tour de jeu passe de la semaine au mois.
 * Toutes les dates (numéros de semaine) deviennent des numéros de mois ;
 * salaires et mensualités hebdomadaires deviennent mensuels.
 */
function toMonths(s: GameState): void {
  const T = weekToTurn;
  const money = (v: number) => Math.round(v * WEEKS_PER_MONTH / 10) * 10;
  s.week = T(s.week);
  s.agendaLockedUntil = T(s.agendaLockedUntil ?? 0);
  for (const n of s.news ?? []) n.week = T(n.week);
  for (const x of s.pendingDecisions ?? []) { x.week = T(x.week); x.deadlineWeek = T(x.deadlineWeek); }
  for (const x of s.polls ?? []) x.week = T(x.week);
  for (const e of s.elections ?? []) { e.week = T(e.week); e.campaignStartWeek = T(e.campaignStartWeek); }
  for (const k of Object.keys(s.cooldowns ?? {})) s.cooldowns[k] = T(s.cooldowns[k]);
  for (const o of s.objectives ?? []) o.deadlineWeek = T(o.deadlineWeek);
  for (const m of s.milestones ?? []) m.week = T(m.week);
  if (s.death) s.death.week = T(s.death.week);
  if (s.presidential) {
    s.presidential.nextWeek = T(s.presidential.nextWeek);
    if (s.presidential.declaredWeek) s.presidential.declaredWeek = T(s.presidential.declaredWeek);
  }
  if (s.presidency) { s.presidency.since = T(s.presidency.since); s.presidency.lastCrisisWeek = T(s.presidency.lastCrisisWeek); }
  if (s.government) s.government.since = T(s.government.since);
  if (s.intl?.crisis) s.intl.crisis.since = T(s.intl.crisis.since);
  if (s.project) {
    const old = s.project as typeof s.project & { weeks?: number };
    const def = PROJECTS_BY_ID.get(old.id);
    const months = def?.months ?? Math.max(1, Math.round((old.weeks ?? 4) / WEEKS_PER_MONTH));
    const done = Math.min(months - 1, Math.round((old.done / Math.max(1, old.weeks ?? months)) * months));
    s.project = { id: old.id, startWeek: T(old.startWeek), done, months, ...(old.domain ? { domain: old.domain } : {}) };
  }
  if (s.party?.foundedWeek) s.party.foundedWeek = T(s.party.foundedWeek);
  if (s.partyFinance) {
    s.partyFinance.lastSettledWeek = T(s.partyFinance.lastSettledWeek);
    for (const h of s.partyFinance.history) h.week = T(h.week);
  }
  if (s.nationalBudget) { s.nationalBudget.deadlineWeek = T(s.nationalBudget.deadlineWeek); s.nationalBudget.nextDueWeek = T(s.nationalBudget.nextDueWeek); }
  if (s.press) {
    s.press.since = T(s.press.since);
    if (s.press.gradeWeek) s.press.gradeWeek = T(s.press.gradeWeek);
    s.press.salary = money(s.press.salary);
  }
  if (s.mole) s.mole.lastReport = T(s.mole.lastReport);
  if (s.program?.validatedWeek) s.program.validatedWeek = T(s.program.validatedWeek);
  const p = s.player;
  for (const d of Object.values(p.dossiers)) if (d.lastStudiedWeek !== null) d.lastStudiedWeek = T(d.lastStudiedWeek);
  for (const a of p.assets ?? []) { a.boughtWeek = T(a.boughtWeek); a.payment = money(a.payment); }
  for (const r of [...(p.team ?? []), ...(p.pool ?? [])]) r.salary = Math.round(r.salary * WEEKS_PER_MONTH / 50) * 50;
  for (const [k, v] of Object.entries(p.flags)) {
    if (typeof v === 'number' && v > 0 && WEEK_FLAGS.test(k)) p.flags[k] = T(v);
  }
  if (p.flags['overdraftWeeks']) p.flags['overdraftWeeks'] = Math.ceil(Number(p.flags['overdraftWeeks']) / WEEKS_PER_MONTH);
  p.actionPoints.max = RANKS[p.rankId].monthlyActionPoints;
  p.actionPoints.current = p.actionPoints.max;
  (s as { version: number }).version = 2;
}

/** Complète une sauvegarde créée avant l'ajout des débats, de l'équipe et des objectifs */
export function migrate(s: GameState): GameState {
  if ((s as { version: number }).version === 1) toMonths(s);
  s.debate ??= null;
  // Les objectifs « Rallier un courant » ont été retirés
  s.objectives = (s.objectives ?? []).filter(o => o.kind !== 'faction');
  s.program ??= null;
  s.protest ??= null;
  s.scene ??= null;
  s.partyFinance ??= null;
  s.nationalBudget ??= null;
  s.agendaLockedUntil ??= 0;
  s.player.staff ??= [];
  s.player.assets ??= [];
  // Positionnement gauche-droite (ajouté après coup)
  for (const p of [s.party, ...s.otherParties]) {
    p.position ??= PARTIES.find(x => x.id === p.id)?.position ?? 0;
  }
  const pos = factionPositions(s.party.position);
  for (const f of s.party.factions) f.position ??= pos[f.id];
  s.player.stance ??= s.party.position;
  migrateTeam(s);
  s.scenario ??= 'carriere';
  s.crown ??= null;
  s.lodge ??= null;
  s.press ??= null;
  s.mole ??= null;
  // Âge, santé, chapitres de vie, calendrier présidentiel
  s.player.age ??= startAge(s.scenario) + (s.week - 1) / 12;
  s.player.health ??= initialHealth(s.player.age);
  s.milestones ??= [];
  s.death ??= null;
  s.presidency ??= null;
  s.portfolio ??= null;
  s.government ??= null;
  s.intl ??= initIntl();
  s.project ??= null;
  s.war ??= null;
  s.vote ??= null;
  s.voteHistory ??= [];
  s.minigames ??= [];
  s.alien ??= null;
  s.player.civil ??= null;
  migrateTeamPay(s);
  s.plot ??= null;
  // Avant les complots, l'assassinat tombait sans prévenir : ces parties-là reprennent vie
  if (!s.player.flags['plotEra']) {
    if (s.status === 'mort' && s.death?.cause === 'assassinat') reviveFromAssassination(s);
    s.player.flags['plotEra'] = 1;
  }
  s.intl.hostile ??= initHostile();
  migrateLoans(s);
  if (!s.presidential) {
    s.presidential = initPresidential(s);
    // Une partie déjà avancée : le calendrier rattrape la date courante
    while (s.presidential.nextWeek <= s.week) s.presidential.nextWeek += 60;
  }
  // Une ancienne fin de partie devient un chapitre : la vie continue
  if (s.status === 'victoire' || s.status === 'defaite') {
    if (s.player.rankId === 'president' && s.status === 'victoire') {
      s.endTitle ??= 'Élu·e président·e de la République';
      s.player.flags['presMandates'] = 1;
      s.presidency = { since: s.week, mandates: 1, approval: 55, majority: 52, security: 60, threat: 30, primeMinister: 'Claire Montel', reforms: 0, cohabitation: false, lastCrisisWeek: s.week };
      s.presidential.incumbentId = 'player';
      s.presidential.incumbentName = s.player.name;
      s.presidential.incumbentMandates = 1;
      s.presidential.nextWeek = s.week + 60;
    }
    settleEndings(s);
  }
  // Nouveaux dossiers et contacts associés
  for (const domain of DOMAINS) {
    s.player.dossiers[domain] ??= { mastery: 10, lastStudiedWeek: null };
    s.player.skills[domain] ??= 0;
  }
  for (const c of [...NEW_CONTACTS, ...CULTES]) if (!s.contacts.some(x => x.id === c.id)) s.contacts.push({ ...c });
  s.schemes ??= [];
  s.promises ??= [];
  s.territory ??= initTerritory();
  s.economy ??= initEconomy(s);
  s.electorate ??= initElectorate(s);
  ensureCirco(s);
  s.family ??= initFamily(s);
  s.rivalPlots ??= [];
  s.crises ??= {};
  if (s.debate && s.debate.audienceLean === undefined) s.debate = null;
  return s;
}

/**
 * Source de vérité unique du jeu.
 * - L'état est un signal immuable : chaque modification passe par `mutate`,
 *   qui clone l'état, applique la transformation puis publie le nouvel objet.
 * - Les autres services exposent des fonctions (draft, rng) => void et
 *   n'écrivent jamais directement dans le signal.
 */
@Injectable({ providedIn: 'root' })
export class GameStateService {
  private readonly auth = inject(AuthService);
  private readonly _state = signal<GameState | null>(null);
  /** Emplacement de sauvegarde de la partie en cours (1 à 3) */
  readonly slot = signal(1);
  readonly saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  private pending: ReturnType<typeof setTimeout> | null = null;
  private pendingState: GameState | null = null;
  readonly state = this._state.asReadonly();

  /** À n'utiliser que sous le tableau de bord (partie démarrée) */
  readonly s = computed(() => this._state()!);

  readonly started = computed(() => this._state() !== null);
  readonly player = computed(() => this.s().player);
  readonly stats = computed(() => this.s().player.stats);
  readonly week = computed(() => this.s().week);
  readonly rank = computed(() => RANKS[this.s().player.rankId]);
  /** Intitulé complet : « Ministre de la Santé », « Premier·e ministre »… */
  readonly roleLabel = computed(() => roleLabel(this.s()));
  readonly funds = computed(() => availableFunds(this.s()));
  readonly partySupport = computed(() => Math.round(partySupport(this.s())));
  /** « mars 2029 » */
  readonly date = computed(() => monthLabel(this.s().week));
  /** Libellés de calendrier pour les gabarits */
  month(turn: number): string { return monthLabel(turn); }
  inMonth(turn: number): string { return inMonth(turn); }

  newGame(opts: NewGameOptions): void {
    const state = createInitialState(opts);
    weeklyObjectives(state, new Rng(state));
    ensurePartyFinance(state);
    welcomePhone(state);
    state.family = initFamily(state);
    state.territory = initTerritory();
    state.economy = initEconomy(state);
    state.electorate = initElectorate(state);
    ensureCirco(state);
    if (opts.scenario === 'invasion') startInvasion(state, 'karstanie');
    if (opts.scenario === 'complot') startPlot(state, new Rng(state));
    if (opts.scenario === 'guerre_totale') { startWar(state, 'meridia', true, { total: true }); if (state.war) { state.war.front = 47; state.war.morale = 58; } }
    state.news.push(opts.scenario === 'bercy'
      ? {
        id: 'news-0', week: 1, kind: 'actu', tone: 'neutral',
        title: `${state.player.name} nommé·e à Bercy`,
        body: 'Premier dossier : la loi de finances 2028, à soumettre à l’Assemblée avant avril 2027.',
      }
      : opts.scenario === 'presidentielle'
      ? {
        id: 'news-0', week: 1, kind: 'election', tone: 'neutral',
        title: `${state.player.name}, candidat·e ${ofParty(state.party.name)} à la présidentielle`,
        body: 'Cinq mois de campagne, vote en juin. Première étape : bâtir votre programme en vingt questions.',
      }
      : opts.scenario === 'infiltre' && state.mole
      ? {
        id: 'news-0', week: 1, kind: 'systeme', tone: 'neutral',
        title: `${state.player.name} prend sa carte ${toParty(state.party.name)}… sous couverture`,
        body: `Pour ${state.mole.homeName}, vous espionnez l’adversaire. Objectif : transmettre ${MOLE_GOAL} renseignements à ${state.mole.handler}, puis tout déballer. Ne vous faites pas prendre.`,
      }
      : opts.scenario === 'editorialiste' && state.press
      ? {
        id: 'news-0', week: 1, kind: 'actu', tone: 'neutral',
        title: `${state.player.name} fait ses débuts à ${state.press.outlet}`,
        body: 'Pigiste pour commencer. Objectif : diriger la rédaction et faire l’opinion (audience 65, influence 60).',
      }
      : opts.scenario === 'complot'
      ? {
        id: 'news-0', week: 1, kind: 'actu', tone: 'negative',
        title: `${state.player.name}, député·e sous menace`,
        body: 'Depuis votre rapport sur les marchés truqués, les menaces se multiplient. Quelqu’un veut votre mort. Enquêter, se protéger, tenir : déjouer le complot avant qu’il ne frappe.',
      }
      : opts.scenario === 'invasion'
      ? {
        id: 'news-0', week: 1, kind: 'actu', tone: 'negative',
        title: `${state.player.name}, ministre de l’Intérieur d’un pays attaqué`,
        body: 'La Karstanie a frappé à l’aube. Défendre le territoire, tenir l’arrière, rallier les alliés : objectif, la libération.',
      }
      : opts.scenario === 'guerre_totale'
      ? {
        id: 'news-0', week: 1, kind: 'actu', tone: 'negative',
        title: `${state.player.name}, président·e d’une France en guerre totale`,
        body: 'La Méridia a choisi l’escalade : mobilisation générale, économie de guerre, moral de l’arrière à tenir. Objectif : la victoire, sans que le pays s’effondre.',
      }
      : opts.scenario === 'contact'
      ? {
        id: 'news-0', week: 1, kind: 'actu', tone: 'neutral',
        title: 'Un signal venu des étoiles',
        body: 'Nançay capte un message régulier venu de Proxima du Centaure. Matignon vous confie la cellule du Premier contact : comprendre, se faire comprendre, rassurer le pays et garder la main face aux grandes puissances.',
      }
      : state.party.founder
      ? {
        id: 'news-0', week: 1, kind: 'parti', tone: 'neutral',
        title: `${state.player.name} fonde « ${state.party.name} »`,
        body: 'Quelques centaines d’adhérents, une trésorerie de poche et tout à construire. Le parti est à vous.',
      }
      : {
        id: 'news-0', week: 1, kind: 'systeme', tone: 'neutral',
        title: `${state.player.name} prend sa carte ${toParty(state.party.name)}`,
        body: 'Premier objectif : se faire un nom localement et décrocher une place sur la liste municipale.',
      });
    this._state.set(state);
    this.save(state);
    this.rememberResume(this.slot());
  }

  /** Fonder son propre parti en cours de partie */
  foundParty(draft: PartyDraft): void {
    this.mutate(d => foundPartyInGame(d, draft));
  }

  /** Transaction : clone → mutation → publication → sauvegarde */
  mutate(fn: (draft: GameState, rng: Rng) => void): void {
    const current = this._state();
    if (!current) return;
    const draft = structuredClone(current);
    fn(draft, new Rng(draft));
    // Les fins de scénario deviennent des chapitres : seule la mort termine la partie
    settleEndings(draft);
    this._state.set(draft);
    this.save(draft);
  }

  stat(key: StatKey) {
    return computed(() => this.stats()[key]);
  }

  constructor() {
    // Fermer l'onglet n'efface pas le dernier mois joué
    if (typeof window !== 'undefined') window.addEventListener('pagehide', () => void this.flush());
  }

  /** Ouvre la partie d'un emplacement */
  async open(slot: number): Promise<boolean> {
    const store = this.auth.store();
    if (!store) return false;
    const state = await store.load(slot);
    if (!state || (state.version as number) > 2) return false;
    this.slot.set(slot);
    const weekly = (state.version as number) === 1;
    const wasDead = state.status === 'mort';
    const migrated = migrate(state);
    this._state.set(migrated);
    this.saveStatus.set('saved');
    // Ancienne partie hebdomadaire convertie au mois, ou partie ressuscitée : on l'enregistre tout de suite
    if (weekly || (wasDead && migrated.status !== 'mort')) this.save(migrated);
    this.rememberResume(slot);
    return true;
  }

  /** Prépare un emplacement pour une nouvelle partie (newGame suivra) */
  useSlot(slot: number): void {
    this.slot.set(slot);
  }

  /** Revient au menu des parties, après avoir enregistré */
  async leave(): Promise<void> {
    await this.flush();
    this._state.set(null);
    try { sessionStorage.removeItem(RESUME_KEY); } catch { /* stockage indisponible */ }
  }

  /** Un rechargement de la page reprend directement la partie en cours */
  private rememberResume(slot: number): void {
    const a = this.auth.account();
    try { if (a) sessionStorage.setItem(RESUME_KEY, `${a.kind}:${a.name}:${slot}`); } catch { /* stockage indisponible */ }
  }

  /** Emplacement à rouvrir automatiquement pour ce compte, s'il y en a un */
  resumeSlot(): number | null {
    const a = this.auth.account();
    try {
      const [kind, name, slot] = (sessionStorage.getItem(RESUME_KEY) ?? '').split(':');
      return a && kind === a.kind && name === a.name ? Number(slot) || null : null;
    } catch { return null; }
  }

  /** Compatibilité : quitter = revenir au menu (la sauvegarde est conservée) */
  quit(): void {
    void this.leave();
  }

  /** Enregistre immédiatement ce qui attend */
  async flush(): Promise<void> {
    if (this.pending) clearTimeout(this.pending);
    this.pending = null;
    const s = this.pendingState;
    this.pendingState = null;
    if (s) await this.write(s);
  }

  /** Les écritures sont regroupées : une toutes les 1,5 s au plus en ligne */
  private save(state: GameState): void {
    const store = this.auth.store();
    if (!store) return;
    this.pendingState = state;
    this.saveStatus.set('saving');
    if (this.pending) clearTimeout(this.pending);
    this.pending = setTimeout(() => void this.flush(), store.kind === 'cloud' ? 1500 : 250);
  }

  private async write(state: GameState): Promise<void> {
    const store = this.auth.store();
    if (!store) return;
    try {
      await store.save(this.slot(), state);
      if (!this.pendingState) this.saveStatus.set('saved');
    } catch {
      this.saveStatus.set('error');
    }
  }
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { DOMAINS, GameState, StatKey } from '../models/game.models';
import { RANKS, START_DATE } from '../data/ranks';
import { NEW_CONTACTS, NewGameOptions, PARTIES, createInitialState, factionPositions, ofParty, toParty } from '../data/world';
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

/** Complète une sauvegarde créée avant l'ajout des débats, de l'équipe et des objectifs */
function migrate(s: GameState): GameState {
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
  s.player.age ??= startAge(s.scenario) + (s.week - 1) / 52;
  s.player.health ??= initialHealth(s.player.age);
  s.milestones ??= [];
  s.death ??= null;
  s.presidency ??= null;
  s.portfolio ??= null;
  s.government ??= null;
  s.intl ??= initIntl();
  s.project ??= null;
  if (!s.presidential) {
    s.presidential = initPresidential(s);
    // Une partie déjà avancée : le calendrier rattrape la date courante
    while (s.presidential.nextWeek <= s.week) s.presidential.nextWeek += 260;
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
      s.presidential.nextWeek = s.week + 260;
    }
    settleEndings(s);
  }
  // Nouveaux dossiers et contacts associés
  for (const domain of DOMAINS) {
    s.player.dossiers[domain] ??= { mastery: 10, lastStudiedWeek: null };
    s.player.skills[domain] ??= 0;
  }
  for (const c of NEW_CONTACTS) if (!s.contacts.some(x => x.id === c.id)) s.contacts.push({ ...c });
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
  readonly date = computed(() => {
    const d = new Date(START_DATE);
    d.setDate(d.getDate() + (this.s().week - 1) * 7);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  });

  newGame(opts: NewGameOptions): void {
    const state = createInitialState(opts);
    weeklyObjectives(state, new Rng(state));
    ensurePartyFinance(state);
    state.news.push(opts.scenario === 'bercy'
      ? {
        id: 'news-0', week: 1, kind: 'actu', tone: 'neutral',
        title: `${state.player.name} nommé·e à Bercy`,
        body: 'Premier dossier : la loi de finances 2028, à soumettre à l’Assemblée avant la semaine 4.',
      }
      : opts.scenario === 'presidentielle'
      ? {
        id: 'news-0', week: 1, kind: 'election', tone: 'neutral',
        title: `${state.player.name}, candidat·e ${ofParty(state.party.name)} à la présidentielle`,
        body: 'Huit semaines de campagne. Première étape : bâtir votre programme en vingt questions.',
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
    // Fermer l'onglet n'efface pas la dernière semaine jouée
    if (typeof window !== 'undefined') window.addEventListener('pagehide', () => void this.flush());
  }

  /** Ouvre la partie d'un emplacement */
  async open(slot: number): Promise<boolean> {
    const store = this.auth.store();
    if (!store) return false;
    const state = await store.load(slot);
    if (!state || state.version !== 1) return false;
    this.slot.set(slot);
    this._state.set(migrate(state));
    this.saveStatus.set('saved');
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

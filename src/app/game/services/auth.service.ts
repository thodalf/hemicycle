import { Injectable, computed, signal } from '@angular/core';
import { CloudDb, CloudStore, LocalStore, SaveStore, SlotMeta, metaOf } from './save-store';
import { GameState } from '../models/game.models';

/* ============================================================
 *  Authentification et choix du stockage des sauvegardes.
 *   - Compte Claude (page publiée) : identité fournie par la
 *     plateforme, sauvegardes privées en ligne.
 *   - Comptes locaux : pseudo + mot de passe (PBKDF2), propres
 *     à ce navigateur.
 *   - Invité : sans compte, dans ce navigateur.
 * ============================================================ */

export interface Account {
  kind: 'cloud' | 'local' | 'guest';
  name: string;
}

interface LocalAccountRecord {
  name: string;
  salt: string;
  hash: string;
  iterations: number;
  createdAt: number;
}

const ACCOUNTS_KEY = 'polsim.accounts.v1';
const SESSION_KEY = 'polsim.session.v1';
const LEGACY_SAVE = 'polsim.save.v1';
const LEGACY_BACKUP = 'polsim.save.v1.backup';
const RECOVERED = 'polsim.recovered.v1';
const ITERATIONS = 150_000;
const GUEST = '__invite__';

/* Accès minimal aux capacités de la page publiée (absentes ailleurs) */
interface ClaudeUser { id(): Promise<string | null>; name(): Promise<string> }
interface ClaudeRuntime { use(name: string): Promise<unknown> }

function runtime(): ClaudeRuntime | null {
  const c = (globalThis as unknown as { claude?: ClaudeRuntime }).claude;
  return c && typeof c.use === 'function' ? c : null;
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('crypto_unavailable');
  const key = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256);
  return b64(new Uint8Array(bits));
}

/** Comparaison en temps constant des empreintes */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly account = signal<Account | null>(null);
  readonly store = signal<SaveStore | null>(null);
  /** 'checking' tant que la plateforme n'a pas répondu */
  readonly cloud = signal<'checking' | 'available' | 'unavailable'>('checking');
  readonly cloudName = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly signedIn = computed(() => this.account() !== null);

  private cloudDb: CloudDb | null = null;
  private cloudUid: string | null = null;

  constructor() {
    void this.probeCloud();
  }

  /** La page publiée fournit-elle une identité et un stockage privé ? */
  private async probeCloud(): Promise<void> {
    const rt = runtime();
    if (!rt) { this.cloud.set('unavailable'); this.restoreLocalSession(); return; }
    try {
      const [user, db] = await Promise.all([rt.use('user') as Promise<ClaudeUser | null>, rt.use('db') as Promise<CloudDb | null>]);
      const uid = user ? await user.id() : null;
      if (user && db && uid) {
        this.cloudDb = db;
        this.cloudUid = uid;
        this.cloudName.set((await user.name()) || 'votre compte Claude');
        this.cloud.set('available');
        // Le compte Claude est déjà authentifié par la plateforme : on s'y connecte d'office,
        // sauf si le joueur avait choisi un compte local sur cet appareil.
        if (!this.restoreLocalSession()) await this.useCloud();
        return;
      }
    } catch { /* capacité indisponible */ }
    this.cloud.set('unavailable');
    this.restoreLocalSession();
  }

  async useCloud(): Promise<void> {
    if (!this.cloudDb || !this.cloudUid) return;
    const store = new CloudStore(this.cloudDb, this.cloudUid);
    // La partie jouée avant l'arrivée des comptes rejoint le compte en ligne
    await this.importLegacy(store, `cloud:${this.cloudName()}`);
    this.store.set(store);
    this.account.set({ kind: 'cloud', name: this.cloudName() });
    this.forgetSession();
  }

  async playAsGuest(): Promise<void> {
    const store = new LocalStore('guest', 'polsim.guest');
    await this.importLegacy(store, 'guest:Invité·e');
    this.store.set(store);
    this.account.set({ kind: 'guest', name: 'Invité·e' });
    try { localStorage.setItem(SESSION_KEY, GUEST); } catch { /* stockage indisponible */ }
  }

  async register(name: string, password: string, confirm: string): Promise<boolean> {
    this.error.set('');
    const clean = name.trim();
    if (!/^[\p{L}\p{N}_.-]{3,24}$/u.test(clean)) return this.fail('Pseudo : 3 à 24 caractères (lettres, chiffres, . _ -).');
    if (password.length < 8) return this.fail('Mot de passe : 8 caractères minimum.');
    if (password !== confirm) return this.fail('Les deux mots de passe ne correspondent pas.');
    const accounts = this.accounts();
    if (accounts.some(a => a.name.toLowerCase() === clean.toLowerCase())) return this.fail('Ce pseudo existe déjà sur cet appareil.');
    this.busy.set(true);
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await derive(password, salt, ITERATIONS);
      accounts.push({ name: clean, salt: b64(salt), hash, iterations: ITERATIONS, createdAt: Date.now() });
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      await this.openLocal(clean, true);
      return true;
    } catch {
      return this.fail('Impossible de créer le compte dans ce navigateur.');
    } finally {
      this.busy.set(false);
    }
  }

  async login(name: string, password: string): Promise<boolean> {
    this.error.set('');
    const rec = this.accounts().find(a => a.name.toLowerCase() === name.trim().toLowerCase());
    this.busy.set(true);
    try {
      // Même coût de calcul que le compte existe ou non
      const hash = await derive(password, rec ? unb64(rec.salt) : new Uint8Array(16), rec?.iterations ?? ITERATIONS);
      if (!rec || !same(hash, rec.hash)) return this.fail('Pseudo ou mot de passe incorrect.');
      await this.openLocal(rec.name, false);
      return true;
    } catch {
      return this.fail('Connexion impossible dans ce navigateur.');
    } finally {
      this.busy.set(false);
    }
  }

  logout(): void {
    this.account.set(null);
    this.store.set(null);
    this.forgetSession();
  }

  localAccounts(): string[] {
    return this.accounts().map(a => a.name);
  }

  private async openLocal(name: string, fresh: boolean): Promise<void> {
    const store = new LocalStore('local', `polsim.acct.${name.toLowerCase()}`);
    if (fresh) await this.importLegacy(store, `local:${name}`);
    this.store.set(store);
    this.account.set({ kind: 'local', name });
    try { localStorage.setItem(SESSION_KEY, name); } catch { /* stockage indisponible */ }
  }

  /** Reprend la session locale mémorisée sur cet appareil */
  private restoreLocalSession(): boolean {
    try {
      const name = localStorage.getItem(SESSION_KEY);
      if (name === GUEST) { void this.playAsGuest(); return true; }
      if (name && this.accounts().some(a => a.name === name)) {
        void this.openLocal(name, false);
        return true;
      }
    } catch { /* stockage indisponible */ }
    return false;
  }

  private forgetSession(): void {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* stockage indisponible */ }
  }

  private accounts(): LocalAccountRecord[] {
    try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? '[]') as LocalAccountRecord[]; } catch { return []; }
  }

  /** Une partie lancée avant l'arrivée des comptes rejoint le premier emplacement libre */
  private async importLegacy(store: SaveStore, who: string): Promise<void> {
    try {
      const raw = localStorage.getItem(LEGACY_SAVE);
      if (!raw) return;
      const used = new Set((await store.list()).map(m => m.slot));
      const free = [1, 2, 3].find(s => !used.has(s));
      if (free === undefined) return;
      await store.save(free, JSON.parse(raw));
      // On garde une copie de secours plutôt que d'effacer
      localStorage.setItem(LEGACY_BACKUP, raw);
      localStorage.removeItem(LEGACY_SAVE);
      this.markRecovered(`${who}:${LEGACY_BACKUP}`);
    } catch { /* ancienne sauvegarde illisible */ }
  }

  /**
   * Toutes les parties présentes dans ce navigateur, hors compte courant : ancienne sauvegarde,
   * invité, autres comptes locaux. Permet de récupérer une partie « perdue » en changeant de compte.
   */
  deviceSaves(): { key: string; origin: string; meta: SlotMeta }[] {
    const out: { key: string; origin: string; meta: SlotMeta }[] = [];
    const current = this.account();
    let recovered = new Set<string>();
    try { recovered = new Set(JSON.parse(localStorage.getItem(RECOVERED) ?? '[]') as string[]); } catch { /* illisible */ }
    const own = current?.kind === 'guest' ? 'polsim.guest.' : current?.kind === 'local' ? `polsim.acct.${current.name.toLowerCase()}.` : null;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (own && key.startsWith(own)) continue;
        if (recovered.has(`${current?.kind}:${current?.name}:${key}`)) continue;
        let origin = '';
        if (key === LEGACY_SAVE || key === LEGACY_BACKUP) origin = 'Partie d’avant les comptes';
        else if (/^polsim\.guest\.slot-\d$/.test(key)) origin = 'Mode invité';
        else {
          const m = key.match(/^polsim\.acct\.(.+)\.slot-\d$/);
          if (m) origin = `Compte local « ${m[1]} »`;
        }
        if (!origin) continue;
        const state = this.readState(key);
        if (state) out.push({ key, origin, meta: metaOf(0, state) });
      }
    } catch { /* stockage indisponible */ }
    // La copie de secours fait doublon si l'originale existe encore
    return out.filter(s => !(s.key === LEGACY_BACKUP && out.some(o => o.key === LEGACY_SAVE)));
  }

  /** Copie une partie trouvée dans ce navigateur vers un emplacement du compte courant */
  async recover(key: string, slot: number): Promise<boolean> {
    const state = this.readState(key);
    const store = this.store();
    if (!state || !store) return false;
    await store.save(slot, state);
    this.markRecovered(`${this.account()?.kind}:${this.account()?.name}:${key}`);
    if (key === LEGACY_SAVE) this.markRecovered(`${this.account()?.kind}:${this.account()?.name}:${LEGACY_BACKUP}`);
    return true;
  }

  private markRecovered(id: string): void {
    try {
      const done = new Set(JSON.parse(localStorage.getItem(RECOVERED) ?? '[]') as string[]);
      done.add(id);
      localStorage.setItem(RECOVERED, JSON.stringify([...done]));
    } catch { /* stockage indisponible */ }
  }

  private readState(key: string): GameState | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as GameState | { state: GameState };
      const state = 'state' in parsed ? parsed.state : parsed;
      return ((state?.version as number) === 1 || state?.version === 2) && state.player && state.party ? state : null;
    } catch { return null; }
  }

  private fail(message: string): false {
    this.error.set(message);
    return false;
  }
}

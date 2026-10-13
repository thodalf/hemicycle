import { GameState } from '../models/game.models';
import { monthLabel } from '../engine/calendar';
import { RANKS } from '../data/ranks';

/* ============================================================
 *  Stockage des sauvegardes : trois emplacements par compte.
 *   - CloudStore : base de données privée de la page publiée
 *     (compte Claude), sous data/users/<id>/ — synchronisée
 *     sur tous les appareils.
 *   - LocalStore : navigateur (comptes locaux et invité).
 * ============================================================ */

export const SLOTS = [1, 2, 3] as const;

export interface SlotMeta {
  slot: number;
  name: string;
  rank: string;
  week: number;
  scenario: string;
  party: string;
  partyColor: string;
  status: string;
  age?: number;
  /** « mars 2029 » (sauvegardes mensuelles) */
  date?: string;
  updatedAt: number;
}

export interface SaveStore {
  readonly kind: 'cloud' | 'local' | 'guest';
  list(): Promise<SlotMeta[]>;
  load(slot: number): Promise<GameState | null>;
  save(slot: number, state: GameState): Promise<void>;
  remove(slot: number): Promise<void>;
}

const SCENARIO_LABELS: Record<string, string> = {
  carriere: 'Carrière', presidentielle: 'Présidentielle', bercy: 'Bercy', royaute: 'Royauté',
  franc_macon: 'Franc-maçon', editorialiste: 'Éditorialiste', infiltre: 'Infiltré·e', contact: 'Premier contact', invasion: 'Guerre contre la Nation', guerre_totale: 'Guerre totale', complot: 'Le complot',
};

export function metaOf(slot: number, s: GameState): SlotMeta {
  // Les anciennes fins de partie (victoire, défaite) sont désormais des chapitres
  const status = s.status === 'mort' ? 'mort' : 'en_cours';
  return {
    slot, name: s.player.name, rank: RANKS[s.player.rankId]?.label ?? s.player.rankId, week: s.week,
    scenario: SCENARIO_LABELS[s.scenario] ?? s.scenario, party: s.party.name, partyColor: s.party.color,
    status, age: s.player.age ? Math.floor(s.player.age) : undefined,
    date: (s.version as number) === 2 ? monthLabel(s.week) : undefined, updatedAt: Date.now(),
  };
}

// ── Compression (gzip + base64) pour rester loin de la limite de 256 Kio par document ──

async function gzip(text: string): Promise<string | null> {
  if (typeof CompressionStream === 'undefined') return null;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function gunzip(b64: string): Promise<string> {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/** Les actualités les plus anciennes sont élaguées si la sauvegarde devient trop lourde */
function compact(state: GameState): string {
  let json = JSON.stringify(state);
  if (json.length > 400_000) json = JSON.stringify({ ...state, news: state.news.slice(0, 60) });
  return json;
}

// ── Navigateur ──

export class LocalStore implements SaveStore {
  constructor(readonly kind: 'local' | 'guest', private readonly prefix: string) {}

  private key(slot: number) { return `${this.prefix}.slot-${slot}`; }

  async list(): Promise<SlotMeta[]> {
    const out: SlotMeta[] = [];
    for (const slot of SLOTS) {
      try {
        const raw = localStorage.getItem(this.key(slot));
        if (raw) out.push((JSON.parse(raw) as { meta: SlotMeta }).meta);
      } catch { /* emplacement illisible : ignoré */ }
    }
    return out;
  }

  async load(slot: number): Promise<GameState | null> {
    try {
      const raw = localStorage.getItem(this.key(slot));
      return raw ? (JSON.parse(raw) as { state: GameState }).state : null;
    } catch { return null; }
  }

  async save(slot: number, state: GameState): Promise<void> {
    localStorage.setItem(this.key(slot), `{"meta":${JSON.stringify(metaOf(slot, state))},"state":${compact(state)}}`);
  }

  async remove(slot: number): Promise<void> {
    try { localStorage.removeItem(this.key(slot)); } catch { /* stockage indisponible */ }
  }
}

// ── En ligne (compte Claude) ──

/* Types minimaux du magasin de documents fourni par la page publiée */
interface DocSnap { exists: boolean; data(): Record<string, unknown> | undefined }
interface DocRef { get(): Promise<DocSnap>; set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> }
interface ColRef { doc(id: string): DocRef; get(): Promise<{ docs: DocSnap[] }> }
export interface CloudDb { collection(path: string): ColRef }

export class CloudStore implements SaveStore {
  readonly kind = 'cloud' as const;
  /** Une écriture à la fois par document */
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly db: CloudDb, private readonly uid: string) {}

  private ref(slot: number) { return this.db.collection(`data/users/${this.uid}`).doc(`slot-${slot}`); }

  async list(): Promise<SlotMeta[]> {
    const snap = await this.db.collection(`data/users/${this.uid}`).get();
    return snap.docs.filter(d => d.exists).map(d => d.data()?.['meta'] as SlotMeta).filter(Boolean);
  }

  async load(slot: number): Promise<GameState | null> {
    const snap = await this.ref(slot).get();
    if (!snap.exists) return null;
    const body = snap.data()!;
    const json = typeof body['gz'] === 'string' ? await gunzip(body['gz']) : body['json'] as string;
    return json ? JSON.parse(json) as GameState : null;
  }

  save(slot: number, state: GameState): Promise<void> {
    const run = async () => {
      const json = compact(state);
      const gz = await gzip(json);
      await this.ref(slot).set({ meta: metaOf(slot, state) as unknown as Record<string, unknown>, ...(gz ? { gz } : { json }) });
    };
    this.chain = this.chain.then(run, run);
    return this.chain;
  }

  async remove(slot: number): Promise<void> {
    await this.ref(slot).delete();
  }
}

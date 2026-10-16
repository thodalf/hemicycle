import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/* ============================================================
 *  Le combat tactique : une vraie bataille au tour par tour sur
 *  une grille. Chaque unité se déplace puis attaque ; le terrain
 *  protège (forêt, colline, ville) ou bloque (eau, îles) ; les
 *  défenseurs ripostent au contact. Trois variantes : bataille
 *  terrestre (guerre), bataille navale (pirates), défense contre
 *  les morts-vivants (épidémie Z).
 * ============================================================ */

type Terrain = 'plaine' | 'foret' | 'colline' | 'eau' | 'ville' | 'mer' | 'ile' | 'port' | 'rue' | 'immeuble' | 'refuge';
type Side = 'p' | 'e';
type Mode = 'terre' | 'mer' | 'zombies';

interface UnitType { type: string; name: string; icon: string; hp: number; mv: number; atk: number; rng: number; fly?: boolean; heavy?: boolean }
interface Unit extends UnitType { id: number; side: Side; x: number; y: number; moved: boolean; acted: boolean; max: number }
interface Fx { x: number; y: number; text: string; tone: 'hit' | 'kill' | 'miss'; id: number }

const W = 8, H = 7;

const TYPES: Record<string, UnitType> = {
  inf: { type: 'inf', name: 'Infanterie', icon: '🪖', hp: 7, mv: 2, atk: 3, rng: 1 },
  char: { type: 'char', name: 'Blindé', icon: '🛡️', hp: 10, mv: 3, atk: 4, rng: 1, heavy: true },
  art: { type: 'art', name: 'Artillerie', icon: '🎯', hp: 5, mv: 1, atk: 4, rng: 3 },
  drone: { type: 'drone', name: 'Drone', icon: '🛸', hp: 4, mv: 4, atk: 2, rng: 2, fly: true },
  fregate: { type: 'fregate', name: 'Frégate', icon: '🚢', hp: 10, mv: 2, atk: 4, rng: 2, heavy: true },
  patrouilleur: { type: 'patrouilleur', name: 'Patrouilleur', icon: '🚤', hp: 6, mv: 3, atk: 3, rng: 1 },
  helico: { type: 'helico', name: 'Hélicoptère', icon: '🚁', hp: 5, mv: 4, atk: 3, rng: 2, fly: true },
  sousmarin: { type: 'sousmarin', name: 'Sous-marin', icon: '🐋', hp: 7, mv: 2, atk: 5, rng: 1 },
  pirate: { type: 'pirate', name: 'Vedette pirate', icon: '🏴‍☠️', hp: 5, mv: 3, atk: 3, rng: 1 },
  cargo: { type: 'cargo', name: 'Navire-mère', icon: '⛴️', hp: 9, mv: 1, atk: 3, rng: 2, heavy: true },
  gendarme: { type: 'gendarme', name: 'Gendarmes', icon: '👮', hp: 7, mv: 2, atk: 3, rng: 1 },
  pompier: { type: 'pompier', name: 'Pompiers', icon: '🚒', hp: 8, mv: 3, atk: 2, rng: 1, heavy: true },
  tireur: { type: 'tireur', name: 'Tireurs d’élite', icon: '🔭', hp: 4, mv: 1, atk: 4, rng: 3 },
  zombie: { type: 'zombie', name: 'Mort-vivant', icon: '🧟', hp: 4, mv: 1, atk: 2, rng: 1 },
  horde: { type: 'horde', name: 'Horde', icon: '🧟‍♂️', hp: 7, mv: 1, atk: 3, rng: 1, heavy: true },
};

const TERRAIN: Record<Terrain, { label: string; cost: number; def: number; block?: 'ground' | 'sea' | 'all' }> = {
  plaine: { label: 'Plaine', cost: 1, def: 0 }, foret: { label: 'Forêt', cost: 2, def: 1 }, colline: { label: 'Colline (+1 portée)', cost: 2, def: 1 },
  eau: { label: 'Rivière', cost: 1, def: 0, block: 'ground' }, ville: { label: 'Ville à tenir', cost: 1, def: 1 },
  mer: { label: 'Mer', cost: 1, def: 0 }, ile: { label: 'Récif', cost: 1, def: 0, block: 'sea' }, port: { label: 'Port à tenir', cost: 1, def: 1 },
  rue: { label: 'Rue', cost: 1, def: 0 }, immeuble: { label: 'Immeuble', cost: 1, def: 0, block: 'all' }, refuge: { label: 'Refuge à protéger', cost: 1, def: 2 },
};

const MODES: Record<Mode, { turns: number; objective: Terrain; brief: string; player: string[]; enemy: string[] }> = {
  terre: { turns: 8, objective: 'ville', brief: 'Tenez les villes en fin de bataille, ou détruisez l’ennemi.', player: ['inf', 'inf', 'char', 'art', 'drone'], enemy: ['inf', 'inf', 'inf', 'char', 'art'] },
  mer: { turns: 8, objective: 'port', brief: 'Reprenez les ports et coulez la flottille pirate.', player: ['fregate', 'patrouilleur', 'patrouilleur', 'helico', 'sousmarin'], enemy: ['pirate', 'pirate', 'pirate', 'pirate', 'cargo'] },
  zombies: { turns: 8, objective: 'refuge', brief: 'Protégez les refuges pendant huit tours : chaque refuge atteint par un mort-vivant est perdu.', player: ['gendarme', 'gendarme', 'pompier', 'tireur'], enemy: ['zombie', 'zombie', 'zombie', 'horde'] },
};

let uid = 0;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

@Component({
  selector: 'app-tactique-game',
  template: `
    <div class="tac" [class]="'tac m-' + mode">
      <div class="head">
        <span class="turn">Tour <b class="mono">{{ turn() }}</b>/{{ maxTurns }}</span>
        <span class="obj">🎯 {{ objText() }}</span>
        <span class="forces"><b class="p">{{ alive('p') }}</b> contre <b class="e">{{ alive('e') }}</b></span>
      </div>
      <p class="brief">@if (!over()) { {{ brief }} {{ hintText() }} } @else { <b>{{ message() }}</b> }</p>
      <div class="board" [style.grid-template-columns]="'repeat(' + w + ', 1fr)'" role="grid" aria-label="Champ de bataille">
        @for (cell of cells; track $index; let i = $index) {
          @let u = unitAt(i % w, floor(i / w));
          <button type="button" class="cell" [class]="'cell t-' + cell" [class.reach]="reach().has(i)" [class.target]="targets().has(i)"
                  [class.sel]="u && sel() === u.id" [class.owned]="ctrl()[i] === 'p'" [class.lost]="ctrl()[i] === 'e'" [disabled]="over() || busy()"
                  (click)="click(i % w, floor(i / w))" [attr.aria-label]="terrainLabel(cell) + (u ? ' : ' + u.name + ' ' + (u.side === 'p' ? 'allié' : 'ennemi') + ', ' + u.hp + ' PV' : '')">
            @if (u) {
              <span class="unit" [class.enemy]="u.side === 'e'" [class.done]="u.side === 'p' && u.moved && u.acted">
                <span class="ic">{{ u.icon }}</span>
                <i class="hp"><em [style.width.%]="u.hp / u.max * 100"></em></i>
              </span>
            }
            @for (f of fxAt(i % w, floor(i / w)); track f.id) { <span class="fx" [class]="'fx ' + f.tone">{{ f.text }}</span> }
          </button>
        }
      </div>
      <div class="side">
        @if (selUnit(); as u) {
          <div class="card-u"><b>{{ u.icon }} {{ u.name }}</b> <span class="mono">{{ u.hp }}/{{ u.max }} PV</span>
            <small>Déplacement {{ u.mv }} · Attaque {{ u.atk }} · Portée {{ u.rng }}@if (u.fly) { · vole }</small>
            <small>{{ u.moved ? (u.acted ? 'A déjà agi.' : 'Peut encore attaquer.') : 'Choisissez une case bleue, ou une cible rouge.' }}</small></div>
        } @else if (!over()) { <p class="muted small">Touchez une de vos unités pour la déplacer (cases bleues) puis attaquer (cibles rouges).</p> }
        <ul class="log">@for (l of log(); track $index) { <li>{{ l }}</li> }</ul>
        @if (!over()) { <button class="btn primary small" [disabled]="busy()" (click)="endTurn()">Fin du tour →</button> }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .tac { display: grid; gap: 8px; }
    .head { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; font-size: 12.5px; .p { color: #2f6fb3; } .e { color: var(--bad); } }
    .brief { margin: 0; font-size: 12.5px; color: var(--ink-2); }
    .board { display: grid; gap: 2px; padding: 4px; border-radius: 10px; background: #2b2a26; width: 100%; max-width: 520px; justify-self: center; user-select: none; }
    .cell { position: relative; aspect-ratio: 1; border: 0; border-radius: 4px; padding: 0; cursor: pointer; display: grid; place-items: center; overflow: visible;
      &:disabled { cursor: default; } }
    .t-plaine { background: #a8b77a; } .t-foret { background: #5f7d45; background-image: radial-gradient(circle at 30% 35%, #4a6636 18%, transparent 20%), radial-gradient(circle at 70% 65%, #4a6636 18%, transparent 20%); }
    .t-colline { background: #b29a6a; background-image: radial-gradient(ellipse at 50% 80%, #9c845a 45%, transparent 47%); }
    .t-eau { background: #5d8fb5; } .t-ville { background: #c8c2b4; background-image: linear-gradient(90deg, transparent 30%, #8f8778 30% 40%, transparent 40% 60%, #8f8778 60% 70%, transparent 70%); }
    .t-mer { background: #2f5f86; } .t-ile { background: #8a7d5e; } .t-port { background: #9aa7b0; background-image: linear-gradient(0deg, #6f7c86 25%, transparent 25%); }
    .t-rue { background: #8c8c88; } .t-immeuble { background: #4d4b47; } .t-refuge { background: #d8c79a; }
    .cell.owned { box-shadow: inset 0 0 0 3px #2f6fb3; } .cell.lost { box-shadow: inset 0 0 0 3px var(--bad); }
    .cell.reach::after { content: ''; position: absolute; inset: 0; border-radius: 4px; background: rgba(60, 140, 230, .45); }
    .cell.target::after { content: ''; position: absolute; inset: 0; border-radius: 4px; background: rgba(220, 50, 40, .5); animation: pulse 1s ease-in-out infinite; }
    .cell.sel { outline: 3px solid #f4d35e; outline-offset: -3px; }
    @keyframes pulse { 50% { opacity: .55; } }
    .unit { position: relative; z-index: 1; display: grid; place-items: center; width: 86%; height: 86%; border-radius: 50%; background: #e9f1fb; box-shadow: 0 0 0 2px #2f6fb3; transition: transform .25s ease;
      &.enemy { background: #fbe9e7; box-shadow: 0 0 0 2px var(--bad); } &.done { filter: grayscale(.7); opacity: .75; }
      .ic { font-size: clamp(13px, 3.6vw, 22px); line-height: 1; } }
    .hp { position: absolute; left: 8%; right: 8%; bottom: -3px; height: 4px; border-radius: 2px; background: rgba(0,0,0,.35); overflow: hidden;
      em { display: block; height: 100%; background: #3fb36b; } }
    .unit.enemy .hp em { background: #e0533d; }
    .fx { position: absolute; z-index: 3; top: -6px; font: 800 13px var(--font-body); pointer-events: none; animation: rise .9s ease forwards; text-shadow: 0 1px 2px #000;
      &.hit { color: #ffd166; } &.kill { color: #ff6b5b; } &.miss { color: #fff; } }
    @keyframes rise { to { transform: translateY(-18px); opacity: 0; } }
    .side { display: grid; gap: 6px; }
    .card-u { display: grid; gap: 2px; padding: 8px 10px; border-radius: 10px; background: var(--surface-2); font-size: 13px; small { color: var(--ink-2); font-size: 11.5px; } }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 92px; overflow: auto; font-size: 11.5px; color: var(--ink-2); }
    .small { font-size: 12px; margin: 0; }
    @media (prefers-reduced-motion: reduce) { .cell.target::after, .fx { animation: none; } }
  `,
})
export class TactiqueGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly w = W;
  protected readonly floor = Math.floor;
  protected mode: Mode = 'terre';
  protected maxTurns = 8;
  protected brief = '';
  protected cells: Terrain[] = [];
  protected readonly units = signal<Unit[]>([]);
  protected readonly sel = signal<number | null>(null);
  protected readonly turn = signal(1);
  protected readonly over = signal(false);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly log = signal<string[]>([]);
  protected readonly fx = signal<Fx[]>([]);
  /** Qui tient chaque objectif (dernier occupant) */
  protected readonly ctrl = signal<Record<number, Side>>({});
  private startHp = 1;
  private lostRefuges = new Set<number>();
  private timers: ReturnType<typeof setTimeout>[] = [];

  protected readonly selUnit = computed(() => this.units().find(u => u.id === this.sel()) ?? null);
  protected readonly reach = computed(() => {
    const u = this.selUnit();
    return u && !u.moved && !this.over() ? new Set([...this.moves(u)].map(([x, y]) => y * W + x)) : new Set<number>();
  });
  protected readonly targets = computed(() => {
    const u = this.selUnit();
    if (!u || u.acted || this.over()) return new Set<number>();
    return new Set(this.units().filter(e => e.side === 'e' && dist(u, e) <= this.range(u)).map(e => e.y * W + e.x));
  });

  ngOnInit(): void {
    const id = this.def().id;
    this.mode = id.includes('naval') ? 'mer' : id.includes('zombie') ? 'zombies' : 'terre';
    const m = MODES[this.mode];
    this.maxTurns = m.turns;
    this.brief = m.brief;
    this.cells = this.makeMap();
    this.deploy(m.player, 'p');
    this.deploy(this.enemyForces(m.enemy), 'e');
    this.startHp = this.units().filter(u => u.side === 'p').reduce((t, u) => t + u.max, 0);
    this.say(this.mode === 'zombies' ? 'Les morts-vivants approchent des refuges.' : this.mode === 'mer' ? 'La flottille pirate est en vue.' : 'Les deux armées se font face.');
  }

  ngOnDestroy(): void { this.timers.forEach(t => clearTimeout(t)); }

  /* ── Carte et déploiement ── */

  private makeMap(): Terrain[] {
    const r = Math.random;
    const map: Terrain[] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.mode === 'mer') map.push(r() < 0.1 && x > 1 && x < W - 2 ? 'ile' : 'mer');
      else if (this.mode === 'zombies') map.push(r() < 0.14 && y > 0 && y < H - 1 ? 'immeuble' : 'rue');
      else map.push(r() < 0.16 ? 'foret' : r() < 0.1 ? 'colline' : 'plaine');
    }
    if (this.mode === 'terre') {
      // Une rivière avec deux gués
      const river = 3 + Math.floor(r() * 2);
      for (let y = 0; y < H; y++) map[y * W + river] = y === 1 || y === H - 2 ? 'plaine' : 'eau';
    }
    // Les objectifs : au centre et chez l'adversaire
    const objs: [number, number][] = this.mode === 'terre' ? [[2, 3], [W - 3, 1], [W - 3, H - 2]] : this.mode === 'mer' ? [[W - 2, 1], [W - 2, H - 2], [W - 3, 3]] : [[3, 3], [4, 3], [3, 4]];
    for (const [x, y] of objs) map[y * W + x] = MODES[this.mode].objective;
    return map;
  }

  private enemyForces(base: string[]): string[] {
    const extra = this.diff() >= 1.2 ? 1 : 0;
    const add = this.mode === 'zombies' ? ['zombie', 'zombie'] : this.mode === 'mer' ? ['pirate'] : ['inf'];
    return [...base, ...add.slice(0, extra + (this.mode === 'zombies' ? 1 : 0))];
  }

  private deploy(list: string[], side: Side): void {
    const out = [...this.units()];
    for (const t of list) {
      const T = TYPES[t];
      let x = 0, y = 0, tries = 0;
      do {
        if (this.mode === 'zombies') {
          if (side === 'p') { x = 2 + Math.floor(Math.random() * 4); y = 2 + Math.floor(Math.random() * 3); }
          else { const edge = Math.floor(Math.random() * 4); x = edge === 0 ? 0 : edge === 1 ? W - 1 : Math.floor(Math.random() * W); y = edge === 2 ? 0 : edge === 3 ? H - 1 : Math.floor(Math.random() * H); }
        } else {
          x = side === 'p' ? Math.floor(Math.random() * 2) : W - 1 - Math.floor(Math.random() * 2);
          y = Math.floor(Math.random() * H);
        }
        tries++;
      } while ((this.blocked(T, x, y) || out.some(u => u.x === x && u.y === y)) && tries < 200);
      out.push({ ...T, id: ++uid, side, x, y, moved: false, acted: false, max: T.hp });
    }
    this.units.set(out);
  }

  /* ── Règles ── */

  protected terrainLabel(t: Terrain): string { return TERRAIN[t].label; }
  protected unitAt(x: number, y: number): Unit | undefined { return this.units().find(u => u.x === x && u.y === y); }
  protected fxAt(x: number, y: number): Fx[] { return this.fx().filter(f => f.x === x && f.y === y); }
  protected alive(side: Side): number { return this.units().filter(u => u.side === side).length; }
  private terrain(x: number, y: number): Terrain { return this.cells[y * W + x]; }

  private blocked(u: UnitType, x: number, y: number): boolean {
    const b = TERRAIN[this.terrain(x, y)].block;
    if (!b) return false;
    if (b === 'all') return true;
    if (u.fly) return false;
    return this.mode === 'mer' ? b === 'sea' : b === 'ground';
  }

  /** Portée : +1 depuis une colline pour les unités à distance */
  private range(u: Unit): number { return u.rng + (u.rng >= 2 && this.terrain(u.x, u.y) === 'colline' ? 1 : 0); }

  /** Cases atteignables (coût du terrain, unités bloquantes) */
  private moves(u: Unit): [number, number][] {
    const best = new Map<number, number>([[u.y * W + u.x, 0]]);
    const queue: [number, number, number][] = [[u.x, u.y, 0]];
    while (queue.length) {
      const [x, y, c] = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || this.blocked(u, nx, ny)) continue;
        const occ = this.unitAt(nx, ny);
        if (occ && occ.side !== u.side) continue;
        const nc = c + (u.fly ? 1 : TERRAIN[this.terrain(nx, ny)].cost);
        if (nc > u.mv || (best.get(ny * W + nx) ?? 99) <= nc) continue;
        best.set(ny * W + nx, nc);
        queue.push([nx, ny, nc]);
      }
    }
    const out: [number, number][] = [];
    for (const k of best.keys()) { const x = k % W, y = Math.floor(k / W); if (!this.unitAt(x, y) || (x === u.x && y === u.y)) out.push([x, y]); }
    return out;
  }

  private damage(a: Unit, d: Unit): number {
    const def = TERRAIN[this.terrain(d.x, d.y)].def + (d.heavy && !a.heavy ? 1 : 0);
    const roll = Math.floor(Math.random() * 3) - 1;
    return Math.max(1, a.atk - def + roll);
  }

  private strike(a: Unit, d: Unit): void {
    const dmg = this.damage(a, d);
    d.hp -= dmg;
    this.pop(d.x, d.y, d.hp <= 0 ? '💥' : `−${dmg}`, d.hp <= 0 ? 'kill' : 'hit');
    if (d.hp <= 0) {
      this.say(`${a.icon} ${a.name}${a.side === 'e' ? ' adverse' : ''} ⟶ ${d.side === 'p' ? 'votre unité' : 'cible'} ${d.name.toLowerCase()} détruite.`);
      this.units.set(this.units().filter(u => u.id !== d.id));
      return;
    }
    // Riposte au contact
    if (dist(a, d) <= this.range(d) && dist(a, d) === 1) {
      const back = Math.max(1, Math.floor(this.damage(d, a) / 2));
      a.hp -= back;
      this.pop(a.x, a.y, a.hp <= 0 ? '💥' : `−${back}`, a.hp <= 0 ? 'kill' : 'miss');
      if (a.hp <= 0) this.units.set(this.units().filter(u => u.id !== a.id));
    }
    this.units.set([...this.units()]);
  }

  /* ── Tour du joueur ── */

  protected click(x: number, y: number): void {
    if (this.over() || this.busy()) return;
    const here = this.unitAt(x, y);
    const u = this.selUnit();
    const i = y * W + x;
    if (u && this.targets().has(i) && here) {
      u.acted = true; u.moved = true;
      this.strike(u, here);
      this.after();
      return;
    }
    if (u && this.reach().has(i) && (!here || here.id === u.id)) {
      u.x = x; u.y = y; u.moved = true;
      this.capture(u);
      this.units.set([...this.units()]);
      // Plus de cible : l'unité a fini
      if (!this.targets().size) { u.acted = true; this.sel.set(null); }
      this.after();
      return;
    }
    if (here?.side === 'p' && !(here.moved && here.acted)) { this.sel.set(here.id); return; }
    this.sel.set(null);
  }

  private capture(u: Unit): void {
    const t = this.terrain(u.x, u.y);
    if (t === MODES[this.mode].objective) this.ctrl.update(c => ({ ...c, [u.y * W + u.x]: u.side }));
    if (this.mode === 'zombies' && u.side === 'e' && t === 'refuge' && !this.lostRefuges.has(u.y * W + u.x)) {
      this.lostRefuges.add(u.y * W + u.x);
      this.say('Un refuge est envahi !');
      this.miss.emit();
    }
  }

  private after(): void {
    this.progress.emit({ live: this.ratio(), time: 1 - this.turn() / this.maxTurns });
    if (!this.alive('e') && this.mode !== 'zombies') return this.finish();
    if (!this.alive('p')) return this.finish();
    if (this.units().filter(u => u.side === 'p').every(u => u.moved && u.acted)) this.endTurn();
  }

  /* ── Tour de l'ennemi ── */

  protected endTurn(): void {
    if (this.over() || this.busy()) return;
    this.sel.set(null);
    this.busy.set(true);
    const enemies = this.units().filter(u => u.side === 'e');
    let k = 0;
    const step = () => {
      if (this.over()) return;
      if (k >= enemies.length) return this.newTurn();
      const id = enemies[k++].id;
      const e = this.units().find(u => u.id === id);
      if (e) this.aiMove(e);
      this.timers.push(setTimeout(step, 260));
    };
    this.timers.push(setTimeout(step, 200));
  }

  private aiMove(e: Unit): void {
    const players = this.units().filter(u => u.side === 'p');
    if (!players.length) return;
    const inRange = () => this.units().filter(p => p.side === 'p' && dist(e, p) <= this.range(e)).sort((a, b) => a.hp - b.hp)[0];
    let target = inRange();
    // Les unités à distance tirent sans bouger ; les autres avancent
    if (!target || e.rng === 1) {
      const objective = MODES[this.mode].objective;
      const objTiles = this.cells.map((t, i) => (t === objective && this.ctrl()[i] !== 'e' && !this.lostRefuges.has(i) ? i : -1)).filter(i => i >= 0).map(i => ({ x: i % W, y: Math.floor(i / W) }));
      const goals = this.mode === 'zombies' || Math.random() < 0.4 ? [...objTiles, ...players] : players;
      const goal = goals.sort((a, b) => dist(e, a) - dist(e, b))[0];
      if (!target && goal) {
        let best: [number, number] = [e.x, e.y], bestD = dist(e, goal);
        for (const [x, y] of this.moves(e)) { const dd = dist({ x, y }, goal); if (dd < bestD) { best = [x, y]; bestD = dd; } }
        e.x = best[0]; e.y = best[1];
        this.capture(e);
        this.units.set([...this.units()]);
      }
      target = inRange();
    }
    if (target) this.strike(e, target);
  }

  private newTurn(): void {
    this.busy.set(false);
    if (!this.alive('p')) return this.finish();
    if (this.turn() >= this.maxTurns) return this.finish();
    this.turn.update(t => t + 1);
    // Les morts-vivants affluent ; les pirates reçoivent des renforts à mi-bataille
    if (this.mode === 'zombies') this.deploy(this.turn() % 2 ? ['zombie'] : ['zombie', 'zombie'].slice(0, this.diff() >= 1.2 ? 2 : 1), 'e');
    if (this.mode === 'mer' && this.turn() === 4) { this.deploy(['pirate'], 'e'); this.say('Des renforts pirates surgissent à l’horizon.'); }
    for (const u of this.units()) { u.moved = false; u.acted = false; }
    this.units.set([...this.units()]);
    this.progress.emit({ live: this.ratio(), time: 1 - this.turn() / this.maxTurns });
  }

  /* ── Bilan ── */

  protected objText(): string {
    const objective = MODES[this.mode].objective;
    const all = this.cells.map((t, i) => (t === objective ? i : -1)).filter(i => i >= 0);
    if (this.mode === 'zombies') return `Refuges intacts : ${all.length - this.lostRefuges.size}/${all.length}`;
    const mine = all.filter(i => this.ctrl()[i] === 'p').length;
    return `${objective === 'ville' ? 'Villes tenues' : 'Ports tenus'} : ${mine}/${all.length}`;
  }

  protected hintText(): string {
    return this.mode === 'zombies' ? 'Les tireurs portent loin, les pompiers encaissent.' : this.mode === 'mer' ? 'Les hélicoptères survolent les récifs ; le sous-marin frappe fort au contact.' : 'Forêts et villes protègent ; l’artillerie tire plus loin depuis une colline.';
  }

  private ratio(): number {
    const hp = this.units().filter(u => u.side === 'p').reduce((t, u) => t + u.hp, 0) / this.startHp;
    const objective = MODES[this.mode].objective;
    const all = this.cells.map((t, i) => (t === objective ? i : -1)).filter(i => i >= 0);
    const obj = this.mode === 'zombies' ? (all.length - this.lostRefuges.size) / all.length : all.filter(i => this.ctrl()[i] === 'p').length / all.length;
    const kills = this.mode === 'zombies' ? 0.5 : 1 - this.alive('e') / Math.max(1, this.alive('e') + 3);
    return Math.max(0, Math.min(1, 0.45 * obj + 0.3 * hp + 0.25 * kills));
  }

  private finish(): void {
    if (this.over()) return;
    this.over.set(true);
    this.busy.set(false);
    this.timers.forEach(t => clearTimeout(t));
    let r = this.ratio();
    const wiped = !this.alive('e') && this.mode !== 'zombies';
    if (wiped) r = Math.max(r, 0.75 + 0.25 * r);
    if (!this.alive('p')) r = Math.min(r, 0.15);
    if (r < 0.5) this.miss.emit();
    this.message.set(!this.alive('p') ? 'Vos forces sont anéanties : la bataille est perdue.'
      : wiped ? (this.mode === 'mer' ? 'La flottille pirate est coulée : la Manche est libre.' : 'L’ennemi est mis en déroute !')
      : r >= 0.7 ? (this.mode === 'zombies' ? 'Les refuges ont tenu jusqu’à l’aube.' : 'Une victoire nette : les objectifs sont à vous.')
      : r >= 0.45 ? 'Une issue indécise : chacun campe sur ses positions.' : 'Un revers : l’adversaire prend l’avantage.');
    this.progress.emit({ live: r, time: 0 });
    this.timers.push(setTimeout(() => this.done.emit(Math.max(0.1, r)), 2400));
  }

  private say(t: string): void { this.log.update(l => [t, ...l].slice(0, 6)); }
  private pop(x: number, y: number, text: string, tone: Fx['tone']): void {
    const f: Fx = { x, y, text, tone, id: ++uid };
    this.fx.update(a => [...a, f]);
    this.timers.push(setTimeout(() => this.fx.update(a => a.filter(z => z.id !== f.id)), 900));
  }
}

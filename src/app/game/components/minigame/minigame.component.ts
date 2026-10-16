import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, HostListener, computed, effect, inject, signal, untracked } from '@angular/core';
import { MinigameDef, TriItem } from '../../data/minigames';
import { TIER_LABELS, tierOf } from '../../engine/minigame';
import { MinigameService } from '../../services/minigame.service';
import { FxService } from '../../services/fx.service';
import { MotGameComponent } from './games/mot-game.component';
import { GrilleGameComponent } from './games/grille-game.component';
import { saveProgress } from '../../engine/arcade-save';
import { QuizGameComponent } from './games/quiz-game.component';
import { ProtocoleGameComponent } from './games/protocole-game.component';
import { TableGameComponent } from './games/table-game.component';
import { InterceptionGameComponent } from './games/interception-game.component';
import { DeminageGameComponent } from './games/deminage-game.component';
import { InterviewGameComponent } from './games/interview-game.component';
import { CmpGameComponent } from './games/cmp-game.component';
import { SommetGameComponent } from './games/sommet-game.component';
import { VisiteGameComponent } from './games/visite-game.component';
import { TrainGameComponent } from './games/train-game.component';
import { CortegeGameComponent } from './games/cortege-game.component';
import { ValiseGameComponent } from './games/valise-game.component';
import { MajoriteGameComponent } from './games/majorite-game.component';
import { StandardGameComponent } from './games/standard-game.component';
import { PlumeGameComponent } from './games/plume-game.component';
import { FactcheckGameComponent } from './games/factcheck-game.component';
import { InvestituresGameComponent } from './games/investitures-game.component';
import { ArbitrageGameComponent } from './games/arbitrage-game.component';
import { CitationsGameComponent } from './games/citations-game.component';
import { LectureGameComponent } from './games/lecture-game.component';
import { SecuriteGameComponent } from './games/securite-game.component';
import { InterpreteGameComponent } from './games/interprete-game.component';
import { FrondeursGameComponent } from './games/frondeurs-game.component';
import { RabotGameComponent } from './games/rabot-game.component';
import { PrenomsGameComponent } from './games/prenoms-game.component';
import { AgendaGameComponent } from './games/agenda-game.component';
import { PrompteurGameComponent } from './games/prompteur-game.component';
import { ChiffrageGameComponent } from './games/chiffrage-game.component';
import { TactiqueGameComponent } from './games/tactique-game.component';
import { PortraitGameComponent } from './games/portrait-game.component';
import { DepouillementGameComponent } from './games/depouillement-game.component';

type Phase = 'intro' | 'play' | 'over';

interface Cell { kind: 'good' | 'bad'; until: number; id: number }
interface Card { face: string; open: boolean; found: boolean; id: number }
interface Seat { x: number; y: number; state: 'idle' | 'hot' | 'trap' | 'won' | 'lost'; until: number }
interface Village { name: string; x: number; y: number; gain: number; visited: boolean }

/** Contour simplifié de l'Hexagone (repère 0-100) */
export const FRANCE = '48,4 60,9 74,12 90,22 88,36 84,48 90,60 88,76 76,86 62,90 50,94 40,90 28,92 14,86 16,72 8,58 4,42 14,34 22,22 36,14';
const SPOTS: [number, number][] = [
  [24, 30], [36, 22], [62, 18], [76, 24], [82, 38], [70, 34], [58, 32], [42, 36], [28, 44], [14, 48], [22, 60],
  [36, 54], [50, 48], [64, 50], [78, 56], [80, 70], [66, 66], [52, 62], [40, 70], [28, 78], [46, 82], [60, 80], [72, 78],
];
const VILLAGES = ['Saint-Aubin', 'Vauclair', 'Montrevel', 'Les Granges', 'Beauvallon', 'Fontenoy', 'Rochebrune', 'Mirabel', 'Valcourt',
  'Sainte-Colombe', 'Plouguern', 'Castelvieil', 'Lanvaux', 'Bellegarde', 'Puymorin', 'Les Aulnes', 'Coulanges', 'Brémontier'];
const PARIS = { x: 50, y: 27 };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const DURATION = 15000;

/**
 * Les quatorze mini-jeux : poignées de main, applaudimètre, mémoire, tri,
 * marchandage, pointage, tournée, mot du jour, grille, quiz,
 * protocole, plan de table, interception, déminage.
 * Chacun produit un score de 0 à 1.
 */
@Component({
  selector: 'app-minigame',
  imports: [DecimalPipe, MotGameComponent, GrilleGameComponent, QuizGameComponent, ProtocoleGameComponent, TableGameComponent, InterceptionGameComponent, DeminageGameComponent, InterviewGameComponent, CmpGameComponent, SommetGameComponent, VisiteGameComponent, TrainGameComponent, CortegeGameComponent, ValiseGameComponent, MajoriteGameComponent, StandardGameComponent, PlumeGameComponent, FactcheckGameComponent, InvestituresGameComponent, ArbitrageGameComponent, CitationsGameComponent, LectureGameComponent, SecuriteGameComponent, InterpreteGameComponent, FrondeursGameComponent, RabotGameComponent, PrenomsGameComponent, AgendaGameComponent, PrompteurGameComponent, ChiffrageGameComponent, DepouillementGameComponent, TactiqueGameComponent, PortraitGameComponent],
  templateUrl: './minigame.component.html',
  styleUrl: './minigame.component.scss',
})
export class MinigameComponent {
  protected readonly svc = inject(MinigameService);
  private readonly fx = inject(FxService);
  protected readonly g = this.svc.current;
  protected readonly def = this.svc.def;
  protected readonly phase = signal<Phase>('intro');
  protected readonly timeLeft = signal(1);
  protected readonly liveScore = signal(0);
  protected readonly message = signal('');
  protected readonly shake = signal(false);
  protected readonly tierLabels = TIER_LABELS;
  /** Jeux qui affichent eux-mêmes leur progression */
  protected readonly selfScored = new Set(['tournee', 'mot', 'quiz', 'grille', 'protocole', 'table', 'interception', 'deminage', 'interview', 'cmp', 'sommet', 'visite', 'train', 'cortege', 'valise', 'majorite', 'standard', 'plume', 'factcheck', 'investitures', 'arbitrage', 'citations', 'lecture', 'securite', 'interprete', 'frondeurs', 'rabot', 'prenoms', 'agenda', 'prompteur', 'chiffrage', 'depouillement', 'tactique', 'portrait']);
  private timer: ReturnType<typeof setInterval> | null = null;
  private started = 0;
  private seq = 0;
  /** Le mini-jeu affiché, et celui qui est en cours de partie */
  private shownId: string | null = null;
  private playingId: string | null = null;

  /** Difficulté : 0,7 (frais et dispos) … 1,4 (épuisé·e) */
  private readonly diff = computed(() => this.g()?.difficulty ?? 1);
  protected readonly diffLabel = computed(() => {
    const d = this.diff();
    return d <= 0.9 ? 'En pleine forme : c’est plus facile' : d >= 1.2 ? 'Fatigue et stress : c’est plus dur' : 'Difficulté normale';
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
    // Nouveau mini-jeu dans la file : on revient à l'écran d'accueil
    // (seulement quand l'identifiant change : une autre mise à jour de l'état ne doit pas interrompre la partie)
    effect(() => {
      const id = this.g()?.id;
      untracked(() => {
        if (!id || id === this.shownId) return;
        this.shownId = id;
        this.stop();
        this.phase.set('intro');
        this.message.set('');
      });
    });
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private loop(fn: (now: number, elapsed: number) => void, ms = 50): void {
    this.stop();
    this.started = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now();
      fn(now, now - this.started);
    }, ms);
  }

  protected resumable(id: string): boolean { return !!saveProgress(id); }

  start(): void {
    const def = this.def();
    if (!def) return;
    this.phase.set('play');
    this.playingId = this.g()?.id ?? null;
    this.liveScore.set(0);
    this.message.set('');
    switch (def.kind) {
      case 'poignees': this.startPoignees(); break;
      case 'applaudimetre': this.startApplause(def); break;
      case 'memoire': this.startMemory(def); break;
      case 'tri': this.startTri(def); break;
      case 'marchandage': this.startDeal(def); break;
      case 'pointage': this.startPointage(); break;
      case 'tournee': this.startTournee(); break;
      // Mot, grille, quiz : chaque jeu gère son propre déroulé
      default: this.stop(); this.timeLeft.set(1);
    }
  }

  protected delegate(): void {
    this.stop();
    this.svc.delegate();
  }

  /** Progression remontée par les jeux autonomes (mot, grille, quiz) */
  protected onProgress(p: { live: number; time: number }): void {
    this.liveScore.set(p.live);
    this.timeLeft.set(p.time);
  }

  protected miss(): void {
    this.bump();
  }

  protected end(score: number): void {
    // Un minuteur d'une partie précédente ne doit jamais conclure la suivante
    const cur = this.g();
    if (!cur || cur.status !== 'pret' || cur.id !== this.playingId || this.phase() !== 'play') return;
    this.stop();
    this.phase.set('over');
    const s = Math.max(0, Math.min(1, score));
    this.svc.finish(s);
    const tier = tierOf(s);
    const w = window.innerWidth, h = window.innerHeight;
    if (tier === 'brillant') { this.fx.burst(w / 2, h * 0.4, 'good', 28); setTimeout(() => this.fx.burst(w * 0.35, h * 0.35, 'good', 18), 180); setTimeout(() => this.fx.burst(w * 0.65, h * 0.35, 'good', 18), 320); }
    else if (tier === 'reussi') this.fx.burst(w / 2, h * 0.4, 'good', 18);
    else if (tier === 'rate') { this.fx.tomatoes(); this.fx.shake(); }
  }

  protected close(): void {
    this.svc.close();
  }

  protected tierOf(score: number) { return tierOf(score); }

  private bump(): void {
    this.shake.set(true);
    setTimeout(() => this.shake.set(false), 350);
  }

  // ── Poignées de main ────────────────────────────────────
  protected readonly cells = signal<(Cell | null)[]>(Array(9).fill(null));
  private hits = 0;
  private bads = 0;
  private spawnedGood = 0;
  protected readonly pops = signal<{ i: number; good: boolean; id: number }[]>([]);

  private startPoignees(): void {
    this.cells.set(Array(9).fill(null));
    this.hits = this.bads = this.spawnedGood = 0;
    const d = this.diff();
    let next = 0;
    this.loop((now, t) => {
      this.timeLeft.set(Math.max(0, 1 - t / DURATION));
      const cells = this.cells().map(c => (c && c.until < now ? null : c));
      if (t >= next) {
        const free = cells.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
        if (free.length) {
          const i = free[Math.floor(Math.random() * free.length)];
          const bad = Math.random() < 0.28;
          if (!bad) this.spawnedGood++;
          cells[i] = { kind: bad ? 'bad' : 'good', until: now + 1150 / d, id: ++this.seq };
        }
        next = t + (620 + Math.random() * 260) / d;
      }
      this.cells.set(cells);
      if (t >= DURATION) this.end(this.poigneesScore());
    });
  }

  private poigneesScore(): number {
    return (this.hits - 1.2 * this.bads) / Math.max(4, this.spawnedGood * 0.75);
  }

  protected hitCell(i: number): void {
    if (this.phase() !== 'play') return;
    const c = this.cells()[i];
    if (!c) return;
    if (c.kind === 'good') this.hits++;
    else { this.bads++; this.bump(); }
    this.pops.update(p => [...p.slice(-6), { i, good: c.kind === 'good', id: ++this.seq }]);
    this.cells.update(cs => cs.map((x, k) => (k === i ? null : x)));
    this.liveScore.set(Math.max(0, this.poigneesScore()));
  }

  // ── Applaudimètre ───────────────────────────────────────
  protected readonly cursor = signal(0);
  protected readonly zone = signal({ center: 0.5, width: 0.16 });
  protected readonly round = signal(0);
  protected readonly applause = signal(0);
  protected readonly reactions = signal<string[]>([]);
  private accs: number[] = [];
  private paused = false;

  private startApplause(def: MinigameDef): void {
    this.accs = [];
    this.round.set(0);
    this.reactions.set([]);
    this.newZone();
    const speed = 2.3 * this.diff();
    this.loop((_now, t) => {
      if (!this.paused) this.cursor.set((Math.sin((t / 1000) * speed - Math.PI / 2) + 1) / 2);
      this.applause.update(a => Math.max(0, a - 0.02));
      this.timeLeft.set(1 - this.round() / (def.lines?.length ?? 5));
    }, 30);
  }

  private newZone(): void {
    this.zone.set({ center: 0.15 + Math.random() * 0.7, width: Math.max(0.09, 0.17 / this.diff()) });
  }

  protected launch(): void {
    const def = this.def();
    if (this.phase() !== 'play' || def?.kind !== 'applaudimetre' || this.paused) return;
    const z = this.zone();
    const dist = Math.abs(this.cursor() - z.center);
    const acc = Math.max(0, 1 - dist / z.width);
    this.accs.push(acc);
    this.applause.set(acc);
    const label = acc >= 0.75 ? 'Ovation !' : acc >= 0.45 ? 'Applaudissements' : acc > 0.1 ? 'Quelques murmures' : 'Silence gêné…';
    this.reactions.update(r => [...r, label]);
    if (acc < 0.1) this.bump();
    this.liveScore.set(this.accs.reduce((a, b) => a + b, 0) / this.accs.length);
    this.paused = true;
    setTimeout(() => {
      this.paused = false;
      this.round.update(r => r + 1);
      if (this.round() >= (def.lines?.length ?? 5)) this.end(this.accs.reduce((a, b) => a + b, 0) / this.accs.length);
      else this.newZone();
    }, 750);
  }

  // ── Mémoire ─────────────────────────────────────────────
  protected readonly cards = signal<Card[]>([]);
  private open: number[] = [];
  private attempts = 0;
  private found = 0;
  private memLimit = 40000;

  private startMemory(def: MinigameDef): void {
    const faces = [...(def.pairs ?? [])].sort(() => Math.random() - 0.5).slice(0, 6);
    const deck = [...faces, ...faces].sort(() => Math.random() - 0.5).map(face => ({ face, open: false, found: false, id: ++this.seq }));
    this.cards.set(deck);
    this.open = [];
    this.attempts = this.found = 0;
    this.memLimit = 40000 / this.diff();
    this.loop((_now, t) => {
      this.timeLeft.set(Math.max(0, 1 - t / this.memLimit));
      if (t >= this.memLimit) this.end(this.memoryScore());
    }, 100);
  }

  private memoryScore(): number {
    return (this.found / 6) * Math.max(0.35, Math.min(1, 1 - (this.attempts - 6) / 14));
  }

  protected flip(i: number): void {
    if (this.phase() !== 'play' || this.open.length >= 2) return;
    const c = this.cards()[i];
    if (!c || c.open || c.found) return;
    this.cards.update(cs => cs.map((x, k) => (k === i ? { ...x, open: true } : x)));
    this.open.push(i);
    if (this.open.length === 2) {
      this.attempts++;
      const [a, b] = this.open;
      const cs = this.cards();
      if (cs[a].face === cs[b].face) {
        this.found++;
        this.cards.update(list => list.map((x, k) => (k === a || k === b ? { ...x, found: true } : x)));
        this.open = [];
        this.liveScore.set(this.memoryScore());
        if (this.found === 6) setTimeout(() => this.end(this.memoryScore()), 400);
      } else {
        setTimeout(() => {
          this.cards.update(list => list.map((x, k) => (k === a || k === b ? { ...x, open: false } : x)));
          this.open = [];
        }, 650);
      }
    }
  }

  // ── Tri ─────────────────────────────────────────────────
  protected readonly item = signal<TriItem | null>(null);
  protected readonly itemLeft = signal(1);
  protected readonly triCount = signal(0);
  protected readonly flash = signal<'ok' | 'ko' | null>(null);
  private queue: TriItem[] = [];
  private correct = 0;
  private itemStart = 0;
  private window = 3200;
  readonly triTotal = 10;

  private startTri(def: MinigameDef): void {
    this.queue = [...(def.items ?? [])].sort(() => Math.random() - 0.5).slice(0, this.triTotal);
    this.correct = 0;
    this.triCount.set(0);
    this.window = 3300 / this.diff();
    this.nextItem();
    this.loop(now => {
      const left = 1 - (now - this.itemStart) / this.window;
      this.itemLeft.set(Math.max(0, left));
      this.timeLeft.set(1 - this.triCount() / this.triTotal);
      if (left <= 0 && this.item()) this.answer(null);
    });
  }

  private nextItem(): void {
    const it = this.queue.shift() ?? null;
    this.item.set(it);
    this.itemStart = performance.now();
    if (!it) this.end(this.correct / this.triTotal);
  }

  protected answer(side: 'gauche' | 'droite' | null): void {
    const it = this.item();
    if (this.phase() !== 'play' || !it) return;
    const ok = side === it.side;
    if (ok) this.correct++;
    else this.bump();
    this.flash.set(ok ? 'ok' : 'ko');
    setTimeout(() => this.flash.set(null), 260);
    this.triCount.update(n => n + 1);
    this.liveScore.set(this.correct / this.triTotal);
    this.item.set(null);
    setTimeout(() => this.nextItem(), 180);
  }

  // ── Marchandage ─────────────────────────────────────────
  protected readonly offer = signal(0);
  protected readonly tries = signal<{ value: number; verdict: string; warm: number }[]>([]);
  protected readonly mood = signal('😐');
  private target = 0;
  readonly maxTries = 5;

  private startDeal(def: MinigameDef): void {
    const min = def.min ?? 0, max = def.max ?? 100, span = max - min;
    this.target = Math.round((min + span * (0.25 + Math.random() * 0.5)) * 10) / 10;
    this.offer.set(Math.round((min + span / 2) * 10) / 10);
    this.tries.set([]);
    this.mood.set('😐');
    this.timeLeft.set(1);
    this.stop();
  }

  protected step(def: MinigameDef): number {
    const span = (def.max ?? 100) - (def.min ?? 0);
    return span <= 12 ? 0.1 : 1;
  }

  protected propose(): void {
    const def = this.def();
    if (this.phase() !== 'play' || !def) return;
    const v = this.offer();
    const span = (def.max ?? 100) - (def.min ?? 0);
    const ask = def.mode === 'demander';
    const accepted = ask ? v <= this.target : v >= this.target;
    const gap = Math.abs(v - this.target) / span;
    const warm = Math.max(0, 1 - gap * 3);
    const n = this.tries().length + 1;
    if (accepted) {
      const waste = gap / 0.35;
      const score = Math.max(0.25, 1 - waste) - 0.06 * (n - 1);
      this.tries.update(t => [...t, { value: v, verdict: 'Accepté !', warm: 1 }]);
      this.mood.set(score > 0.7 ? '🤝' : '🙂');
      this.timeLeft.set(0);
      setTimeout(() => this.end(score), 600);
      return;
    }
    const verdict = gap < 0.05 ? 'Presque…' : gap < 0.15 ? 'On se rapproche' : gap < 0.3 ? 'Loin du compte' : 'Inacceptable !';
    this.mood.set(gap < 0.05 ? '🤔' : gap < 0.15 ? '😕' : '😤');
    this.tries.update(t => [...t, { value: v, verdict: `${ask ? 'Trop' : 'Pas assez'} — ${verdict}`, warm }]);
    this.timeLeft.set(1 - n / this.maxTries);
    this.bump();
    if (n >= this.maxTries) {
      this.mood.set('🚪');
      setTimeout(() => this.end(0.1), 600);
    }
  }

  protected setOffer(v: number): void {
    this.offer.set(Math.round(v * 10) / 10);
  }

  // ── Pointage ────────────────────────────────────────────
  protected readonly seats = signal<Seat[]>([]);
  private won = 0;
  private lost = 0;
  private hotSpawned = 0;

  private startPointage(): void {
    const seats: Seat[] = [];
    // Trois rangées en demi-cercle, de l'intérieur vers l'extérieur
    const rows = [6, 9, 12];
    rows.forEach((n, r) => {
      const radius = 20 + r * 13;
      for (let k = 0; k < n; k++) {
        const a = Math.PI - (Math.PI * (k + 0.5)) / n;
        seats.push({ x: 50 + Math.cos(a) * radius, y: 52 - Math.sin(a) * radius, state: 'idle', until: 0 });
      }
    });
    this.seats.set(seats);
    this.won = this.lost = this.hotSpawned = 0;
    const d = this.diff();
    let next = 0;
    this.loop((now, t) => {
      this.timeLeft.set(Math.max(0, 1 - t / DURATION));
      const list = this.seats().map(s => ((s.state === 'hot' || s.state === 'trap') && s.until < now ? { ...s, state: s.state === 'hot' ? 'lost' as const : 'idle' as const } : s));
      if (t >= next) {
        const idle = list.map((s, i) => (s.state === 'idle' ? i : -1)).filter(i => i >= 0);
        if (idle.length) {
          const i = idle[Math.floor(Math.random() * idle.length)];
          const trap = Math.random() < 0.22;
          if (!trap) this.hotSpawned++;
          list[i] = { ...list[i], state: trap ? 'trap' : 'hot', until: now + 1300 / d };
        }
        next = t + (520 + Math.random() * 300) / d;
      }
      this.seats.set(list);
      if (t >= DURATION) this.end(this.pointageScore());
    });
  }

  private pointageScore(): number {
    return (this.won - this.lost) / Math.max(4, this.hotSpawned * 0.8);
  }

  protected hitSeat(i: number): void {
    if (this.phase() !== 'play') return;
    const s = this.seats()[i];
    if (s.state === 'hot') { this.won++; this.seats.update(l => l.map((x, k) => (k === i ? { ...x, state: 'won' as const } : x))); }
    else if (s.state === 'trap') { this.lost++; this.bump(); this.seats.update(l => l.map((x, k) => (k === i ? { ...x, state: 'idle' as const } : x))); }
    this.liveScore.set(Math.max(0, this.pointageScore()));
  }

  // ── Tournée ─────────────────────────────────────────────
  protected readonly villages = signal<Village[]>([]);
  protected readonly car = signal(PARIS);
  protected readonly trail = signal<string>(`${PARIS.x},${PARIS.y}`);
  protected readonly fuel = signal(1);
  protected readonly collected = signal(0);
  protected readonly france = FRANCE;
  protected readonly paris = PARIS;
  private fuelLeft = 0;
  private fuelMax = 0;
  private best = 1;

  private startTournee(): void {
    const spots = [...SPOTS].sort(() => Math.random() - 0.5).slice(0, 11);
    const names = [...VILLAGES].sort(() => Math.random() - 0.5);
    const list = spots.map(([x, y], i) => ({ name: names[i], x, y, gain: Math.random() < 0.2 ? 3 : Math.random() < 0.5 ? 2 : 1, visited: false }));
    this.villages.set(list);
    this.car.set(PARIS);
    this.trail.set(`${PARIS.x},${PARIS.y}`);
    this.collected.set(0);
    this.fuelMax = this.fuelLeft = 165 / this.diff();
    this.fuel.set(1);
    this.timeLeft.set(1);
    // Meilleur de trois stratégies gloutonnes : la référence à battre
    const greedy = (pick: (from: { x: number; y: number }, c: Village[], fuel: number) => Village | undefined) => {
      let fuel = this.fuelMax, at: { x: number; y: number } = PARIS, total = 0;
      const left = list.map(v => ({ ...v }));
      for (;;) {
        const ok = left.filter(v => !v.visited && dist(at, v) <= fuel);
        const v = pick(at, ok, fuel);
        if (!v) break;
        fuel -= dist(at, v); total += v.gain; v.visited = true; at = v;
      }
      return total;
    };
    this.best = Math.max(1,
      greedy((at, c) => c.sort((p, q) => q.gain / Math.max(1, dist(at, q)) - p.gain / Math.max(1, dist(at, p)))[0]),
      greedy((at, c) => c.sort((p, q) => dist(at, p) - dist(at, q))[0]),
      greedy((at, c) => c.sort((p, q) => q.gain - p.gain || dist(at, p) - dist(at, q))[0]));
    this.stop();
  }

  protected reachable(v: Village): boolean {
    return !v.visited && dist(this.car(), v) <= this.fuelLeft;
  }

  protected goTo(i: number): void {
    const v = this.villages()[i];
    if (this.phase() !== 'play' || !v || !this.reachable(v)) return;
    this.fuelLeft -= dist(this.car(), v);
    this.fuel.set(this.fuelLeft / this.fuelMax);
    this.timeLeft.set(this.fuel());
    this.collected.update(c => c + v.gain);
    this.villages.update(list => list.map((x, k) => (k === i ? { ...x, visited: true } : x)));
    this.car.set({ x: v.x, y: v.y });
    this.trail.update(t => `${t} ${v.x},${v.y}`);
    this.liveScore.set(Math.min(1, this.collected() / this.best));
    if (!this.villages().some(x => this.reachable(x))) {
      this.message.set('Panne sèche : la tournée s’arrête là.');
      setTimeout(() => this.end(this.collected() / this.best), 900);
    }
  }

  protected homeward(): void {
    if (this.phase() === 'play') this.end(this.collected() / this.best);
  }

  // ── Clavier ─────────────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    const def = this.def();
    if (!def || this.phase() !== 'play') return;
    if (def.kind === 'applaudimetre' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); this.launch(); }
    if (def.kind === 'tri' && e.key === 'ArrowLeft') { e.preventDefault(); this.answer('gauche'); }
    if (def.kind === 'tri' && e.key === 'ArrowRight') { e.preventDefault(); this.answer('droite'); }
    if (def.kind === 'poignees' && /^[1-9]$/.test(e.key)) this.hitCell(Number(e.key) - 1);
  }
}

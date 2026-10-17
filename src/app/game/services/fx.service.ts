import { Injectable, signal } from '@angular/core';
import { monthIndex, monthLabel, yearOf } from '../engine/calendar';

/* ============================================================
 *  Effets visuels 2D éphémères : chiffres flottants, gerbes de
 *  confettis, jetons qui volent vers l'agenda, tampons, page
 *  de calendrier, feux d'artifice, éclair, ligne de front,
 *  billets, secousse. Purement décoratif : rien ici ne touche
 *  à l'état du jeu.
 * ============================================================ */

export type FxTone = 'good' | 'bad' | 'neutral';

export interface FxParticle { dx: number; dy: number; rot: number; color: string; shape: 'dot' | 'square' | 'star'; delay: number }

export interface FxItem {
  id: number;
  kind: 'float' | 'burst' | 'fly' | 'stamp' | 'week' | 'month' | 'ticker' | 'coin' | 'note' | 'banner' | 'flash' | 'front' | 'rocket'
    | 'tomato' | 'paper' | 'plane' | 'heart' | 'spot' | 'ballot' | 'mic' | 'rain' | 'ufo' | 'scen' | 'crown';
  /** Mois précédent (page de calendrier) */
  old?: string;
  icon?: string;
  x: number;
  y: number;
  text?: string;
  sub?: string;
  tone?: FxTone;
  dx?: number;
  dy?: number;
  delay?: number;
  parts?: FxParticle[];
}

const GOOD = ['#2f7d4f', '#6cc790', '#e6b45c', '#1f3b73', '#8fb0f0'];
const BAD = ['#b8402b', '#f08a72', '#4a5263', '#8a8f9a'];

/** Ton d'une ligne de résumé (« Popularité +3 », « Stress +6 », « Fonds perso −500 € ») */
export function toneOfSummary(s: string): FxTone {
  const neg = /[−-]\s?\d/.test(s);
  const pos = /\+\s?\d/.test(s);
  if (!neg && !pos) return /Raté|perdu|quitt|Faillite|Vente forcée/i.test(s) ? 'bad' : 'neutral';
  const inverse = /stress|exposition/i.test(s);
  return neg !== inverse ? 'bad' : 'good';
}

export interface ElectionNight {
  title: string;
  rounds: { label: string; rows: { name: string; color: string; share: number; player: boolean }[] }[];
  winner: string;
  playerWon: boolean;
  /** Soirée de premier tour : verdict personnalisé (qualifié·e pour le second tour) */
  verdict?: { title: string; text: string };
}

@Injectable({ providedIn: 'root' })
export class FxService {
  readonly items = signal<FxItem[]>([]);
  /** Soirée électorale en cours d'affichage */
  readonly election = signal<ElectionNight | null>(null);
  private seq = 0;
  private readonly reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    // Pour tester les animations à la main : ?fxdebug dans l'adresse
    if (typeof location !== 'undefined' && location.search.includes('fxdebug')) (window as unknown as { fx: FxService }).fx = this;
  }

  /* ── La file des grandes animations ──────────────────────
   *  Les animations plein écran (page du mois, tampons, une de
   *  journal, projecteurs, avion…) passent une par une : chacune
   *  attend que la précédente soit terminée. Les petits effets
   *  (chiffres flottants, confettis, pièces) restent immédiats.
   */
  private readonly chain: (() => number)[] = [];
  private running = false;
  private grouping = false;
  private groupDur = 0;
  /** Nombre d'animations en attente (pour les tests) */
  readonly pending = signal(0);

  private enqueue(dur: number, run: () => void): void {
    if (this.reduced || typeof window === 'undefined') return;
    if (this.grouping) { run(); this.groupDur = Math.max(this.groupDur, dur); return; }
    // Au-delà de huit animations en attente, les plus anciennes sont abandonnées
    if (this.chain.length >= 8) this.chain.shift();
    this.chain.push(() => { run(); return dur; });
    this.kick();
  }

  /** Plusieurs grandes animations jouées ensemble, comme une seule étape de la file */
  group(fn: () => void): void {
    if (this.reduced || typeof window === 'undefined') { fn(); return; }
    if (this.grouping) { fn(); return; }
    this.chain.push(() => {
      this.grouping = true; this.groupDur = 0;
      try { fn(); } finally { this.grouping = false; }
      return this.groupDur;
    });
    this.kick();
  }

  private kick(): void {
    this.pending.set(this.chain.length);
    if (!this.running) this.next();
  }

  private paused = false;
  /** Suspend la file (une carte « chapitre » ou une soirée électorale occupe l'écran) */
  pause(): void { this.paused = true; }
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (!this.running) this.next();
  }

  private next(): void {
    if (this.paused) { this.running = false; return; }
    const job = this.chain.shift();
    this.pending.set(this.chain.length);
    if (!job) { this.running = false; return; }
    this.running = true;
    let dur = 0;
    try { dur = job(); } catch { dur = 0; }
    setTimeout(() => this.next(), dur ? dur + 220 : 0);
  }

  private add(item: Omit<FxItem, 'id'>, ttl: number): void {
    if (this.reduced || typeof window === 'undefined') return;
    const id = ++this.seq;
    this.items.update(list => [...list.slice(-40), { ...item, id }]);
    setTimeout(() => this.items.update(list => list.filter(i => i.id !== id)), ttl + (item.delay ?? 0));
  }

  private center(el: Element | null): { x: number; y: number } | null {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /** Chiffre ou texte qui s'élève et s'efface */
  float(text: string, tone: FxTone, x: number, y: number, delay = 0): void {
    this.add({ kind: 'float', text, tone, x, y, delay }, 1600);
  }

  floatAt(el: Element | null, text: string, tone: FxTone, delay = 0): void {
    const c = this.center(el);
    if (c) this.float(text, tone, c.x, c.y, delay);
  }

  /** Gerbe de confettis (succès) ou d'éclats (échec) */
  burst(x: number, y: number, tone: FxTone = 'good', count = 16): void {
    const palette = tone === 'bad' ? BAD : GOOD;
    const parts: FxParticle[] = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 50 + Math.random() * 70;
      return {
        dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist - (tone === 'bad' ? -20 : 30),
        rot: Math.random() * 540 - 270, color: palette[i % palette.length],
        shape: (['dot', 'square', 'star'] as const)[i % 3], delay: Math.random() * 80,
      };
    });
    this.add({ kind: 'burst', x, y, tone, parts }, 1100);
  }

  burstAt(el: Element | null, tone: FxTone = 'good'): void {
    const c = this.center(el);
    if (c) this.burst(c.x, c.y, tone);
  }

  /** Un jeton vole d'un élément vers un autre (action planifiée → agenda) */
  fly(from: Element | null, to: Element | null, text: string): void {
    const a = this.center(from), b = this.center(to);
    if (!a || !b) return;
    this.add({ kind: 'fly', x: a.x, y: a.y, dx: b.x - a.x, dy: b.y - a.y, text }, 750);
  }

  /** Grand tampon au centre de l'écran */
  stamp(text: string, tone: FxTone, sub = ''): void {
    this.enqueue(1500, () => this.add({ kind: 'stamp', text, sub, tone, x: window.innerWidth / 2, y: window.innerHeight * 0.38 }, 1500));
  }

  /** Page de calendrier qui tourne en fin de mois */
  monthTurn(from: number, to: number): void {
    const name = (t: number) => monthLabel(t).split(' ')[0];
    const icon = ['❄️', '❄️', '🌱', '🌷', '🌸', '☀️', '☀️', '🏖️', '🍂', '🍂', '🍁', '🎄'][monthIndex(to)];
    this.enqueue(1900, () => this.add({ kind: 'month', text: name(to), sub: String(yearOf(to)), old: name(from), icon, x: window.innerWidth / 2, y: 90 }, 1900));
  }

  /** Nouvel an : fusées, gerbes et bandeau */
  newYear(year: number): void {
    this.enqueue(3100, () => this.newYearNow(year));
  }
  private newYearNow(year: number): void {
    const w = window.innerWidth, h = window.innerHeight;
    [0.2, 0.5, 0.8, 0.35, 0.65].forEach((x, i) => {
      const delay = i * 260;
      this.add({ kind: 'rocket', x: w * x, y: h, dy: -h * (0.55 + (i % 2) * 0.12), delay }, 900);
      setTimeout(() => this.burst(w * x, h * (0.45 - (i % 2) * 0.12), 'good', 26), delay + 820);
    });
    this.add({ kind: 'banner', text: `Bonne année ${year}`, sub: 'Vœux à la presse, galettes et bonnes résolutions', x: w / 2, y: h * 0.3, delay: 500 }, 2600);
  }

  /** Feu d'artifice avec bandeau (scénario remporté, jubilé, Coupe du monde) */
  fireworks(text: string, sub = ''): void {
    this.enqueue(3000, () => this.fireworksNow(text, sub));
  }
  private fireworksNow(text: string, sub: string): void {
    const w = window.innerWidth, h = window.innerHeight;
    [0.15, 0.45, 0.8, 0.3, 0.6, 0.9, 0.5].forEach((x, i) => {
      const delay = i * 220;
      const top = 0.22 + ((i * 37) % 20) / 100;
      this.add({ kind: 'rocket', x: w * x, y: h, dy: -h * (1 - top), delay }, 900);
      setTimeout(() => this.burst(w * x, h * top, i % 3 === 2 ? 'neutral' : 'good', 24), delay + 820);
    });
    this.add({ kind: 'banner', text, sub, x: w / 2, y: h * 0.3, delay: 400 }, 2600);
  }

  /** Un nouveau scénario s'ouvre : grande icône rayonnante et titre */
  scenario(icon: string, text: string, sub = 'Nouveau scénario'): void {
    if (typeof window === 'undefined') return;
    this.enqueue(2600, () => this.add({ kind: 'scen', icon, text, sub, x: window.innerWidth / 2, y: window.innerHeight * 0.38 }, 2600));
  }

  /** Une couronne se pose sur un élément, en scintillant (action royale) */
  crown(el: Element | null): void {
    const c = this.center(el);
    if (!c) return;
    this.add({ kind: 'crown', x: c.x, y: c.y }, 1400);
  }

  /** Éclair plein écran (déclaration de guerre, défaite) */
  flash(tone: FxTone = 'bad'): void {
    this.enqueue(700, () => this.add({ kind: 'flash', tone, x: 0, y: 0 }, 900));
  }

  /** La ligne de front avance (chevrons verts) ou recule (chevrons rouges) */
  frontline(advance: boolean): void {
    if (typeof window === 'undefined') return;
    this.enqueue(1800, () => this.add({ kind: 'front', tone: advance ? 'good' : 'bad', text: advance ? 'Le front avance' : 'Le front recule', x: 0, y: window.innerHeight * 0.42 }, 1800));
  }

  /** Pluie de tomates (huées, mini-jeu raté) */
  tomatoes(count = 9): void {
    this.enqueue(1300 + count * 90, () => this.tomatoesNow(count));
  }
  private tomatoesNow(count: number): void {
    const w = window.innerWidth, h = window.innerHeight;
    for (let i = 0; i < count; i++) {
      const fromLeft = i % 2 === 0;
      const x = fromLeft ? -30 : w + 30, y = h * (0.55 + Math.random() * 0.4);
      const tx = w * (0.3 + Math.random() * 0.4), ty = h * (0.25 + Math.random() * 0.3);
      this.add({ kind: 'tomato', x, y, dx: tx - x, dy: ty - y, delay: i * 90 }, 1300);
    }
  }

  /** La une d'un journal qui tourne sur elle-même (scandale, révélation) */
  newspaper(headline: string, sub = 'ÉDITION SPÉCIALE'): void {
    if (typeof window === 'undefined') return;
    this.enqueue(2600, () => this.add({ kind: 'paper', text: headline, sub, x: window.innerWidth / 2, y: window.innerHeight * 0.42 }, 2600));
  }

  /** Un avion traverse l'écran (déplacement à l'étranger, sommet) */
  plane(text = ''): void {
    if (typeof window === 'undefined') return;
    this.enqueue(2400, () => this.add({ kind: 'plane', text, x: -80, y: window.innerHeight * (0.18 + Math.random() * 0.12), dx: window.innerWidth + 160 }, 2400));
  }

  /** Une soucoupe traverse l'écran, s'arrête et balaie la page de son rayon (premier contact) */
  ufo(text = ''): void {
    if (typeof window === 'undefined') return;
    this.enqueue(3400, () => this.add({ kind: 'ufo', text, x: -90, y: window.innerHeight * 0.22, dx: window.innerWidth + 180 }, 3400));
  }

  /** Battement de cœur (alerte de santé) */
  heartbeat(): void {
    if (typeof window === 'undefined') return;
    this.enqueue(1900, () => this.add({ kind: 'heart', x: window.innerWidth / 2, y: window.innerHeight * 0.4 }, 1900));
  }

  /** Projecteurs qui balaient la scène (promotion, grand discours) */
  spotlight(text: string, sub = ''): void {
    if (typeof window === 'undefined') return;
    this.enqueue(2300, () => this.add({ kind: 'spot', text, sub, x: window.innerWidth / 2, y: window.innerHeight * 0.36 }, 2300));
  }

  /** Un bulletin glisse dans l'urne (scrutin) */
  ballot(text = 'A voté !'): void {
    if (typeof window === 'undefined') return;
    this.enqueue(1900, () => this.add({ kind: 'ballot', text, x: window.innerWidth / 2, y: window.innerHeight * 0.42 }, 1900));
  }

  /** Micro et ondes (prise de parole, débat, interview) */
  mic(el: Element | null): void {
    const c = this.center(el);
    if (c) this.add({ kind: 'mic', x: c.x, y: c.y }, 1300);
  }

  /** Pluie ou neige sur l'écran (catastrophe, deuil, défaite) */
  rain(snow = false): void {
    if (typeof window === 'undefined') return;
    this.enqueue(2600, () => this.add({ kind: 'rain', tone: snow ? 'neutral' : 'bad', x: 0, y: 0 }, 2600));
  }

  /** Billets qui volent vers le badge des fonds (emprunt) */
  banknotes(target: Element | null, count = 6): void {
    const c = this.center(target);
    if (!c) return;
    for (let i = 0; i < count; i++) {
      const x = window.innerWidth * (0.3 + Math.random() * 0.4), y = window.innerHeight * (0.55 + Math.random() * 0.15);
      this.add({ kind: 'note', x, y, dx: c.x - x, dy: c.y - y, delay: i * 90, tone: 'good' }, 1100);
    }
  }

  /** Bandeau « Flash info » qui défile en haut de l'écran */
  ticker(text: string): void {
    this.add({ kind: 'ticker', text, x: 0, y: 0 }, 5200);
  }

  /** Pièces qui volent vers le badge des fonds (gain) ou s'en échappent (perte) */
  coins(target: Element | null, gain: boolean, count = 7): void {
    const c = this.center(target);
    if (!c) return;
    for (let i = 0; i < count; i++) {
      const delay = i * 70;
      if (gain) {
        const x = window.innerWidth * (0.35 + Math.random() * 0.3), y = window.innerHeight * (0.45 + Math.random() * 0.2);
        this.add({ kind: 'coin', x, y, dx: c.x - x, dy: c.y - y, delay, tone: 'good' }, 900);
      } else {
        this.add({ kind: 'coin', x: c.x, y: c.y, dx: (Math.random() - 0.5) * 120, dy: 120 + Math.random() * 80, delay, tone: 'bad' }, 900);
      }
    }
  }

  /** Secousse de l'écran (scandale, crise, banqueroute, échec) */
  shake(): void {
    if (this.reduced || typeof document === 'undefined') return;
    const b = document.body;
    b.classList.remove('fx-shake');
    void b.offsetWidth;
    b.classList.add('fx-shake');
    setTimeout(() => b.classList.remove('fx-shake'), 500);
  }
}

import { Injectable, signal } from '@angular/core';

/* ============================================================
 *  Effets visuels 2D éphémères : chiffres flottants, gerbes de
 *  confettis, jetons qui volent vers l'agenda, tampons, page
 *  de calendrier, secousse. Purement décoratif : rien ici ne
 *  touche à l'état du jeu.
 * ============================================================ */

export type FxTone = 'good' | 'bad' | 'neutral';

export interface FxParticle { dx: number; dy: number; rot: number; color: string; shape: 'dot' | 'square' | 'star'; delay: number }

export interface FxItem {
  id: number;
  kind: 'float' | 'burst' | 'fly' | 'stamp' | 'week' | 'ticker' | 'coin';
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
}

@Injectable({ providedIn: 'root' })
export class FxService {
  readonly items = signal<FxItem[]>([]);
  /** Soirée électorale en cours d'affichage */
  readonly election = signal<ElectionNight | null>(null);
  private seq = 0;
  private readonly reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    this.add({ kind: 'stamp', text, sub, tone, x: window.innerWidth / 2, y: window.innerHeight * 0.38 }, 1500);
  }

  /** Page de calendrier qui tourne en fin de semaine */
  weekTurn(from: number, to: number, date: string): void {
    this.add({ kind: 'week', text: `Semaine ${to}`, sub: date, x: window.innerWidth / 2, y: 90, dx: from }, 1700);
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

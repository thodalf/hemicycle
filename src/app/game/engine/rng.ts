import { GameState } from '../models/game.models';

/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 * L'état est stocké dans GameState.rngState : une partie sauvegardée
 * rejoue exactement les mêmes tirages, ce qui facilite le débogage.
 */
export class Rng {
  constructor(private readonly state: GameState) {}

  next(): number {
    let t = (this.state.rngState = (this.state.rngState + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}

export const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

export function nextId(d: GameState, prefix: string): string {
  d.idCounter += 1;
  return `${prefix}-${d.idCounter}`;
}

/** Nombre à la française : virgule décimale, au plus `digits` décimales (54,3 ; 1 372,9) */
export const fr = (v: number, digits = 1): string => (Math.round(v * 10 ** digits) / 10 ** digits).toLocaleString('fr-FR', { maximumFractionDigits: digits });
/** Variation signée à la française : +2,3 / -1 */
export const frSigned = (n: number, digits = 1): string => (n > 0 ? `+${fr(n, digits)}` : fr(n, digits));

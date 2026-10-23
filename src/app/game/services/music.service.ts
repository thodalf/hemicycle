import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { FxService } from './fx.service';

/* ============================================================
 *  La musique de fond : « Democracy Tapes », en boucle.
 *  - Elle démarre au premier geste du joueur (les navigateurs
 *    interdisent le son automatique).
 *  - Un bouton la coupe ; le choix est retenu dans le navigateur.
 *  - Elle baisse pendant les annonces : grandes animations
 *    (page du mois, tampons, unes, projecteurs…), carte d'un
 *    nouveau chapitre, soirée électorale.
 *  Le volume passe par un nœud de gain (Web Audio) quand il est
 *  disponible : sur iPhone, le volume d'un <audio> est figé.
 * ============================================================ */

const SRC = 'audio/democracy-tapes.mp3';
const KEY = 'polsim.music.muted';
const NORMAL = 0.32;
const DUCKED = 0.07;

function readMuted(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

@Injectable({ providedIn: 'root' })
export class MusicService {
  private readonly fx = inject(FxService);
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private level = 0;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;

  readonly muted = signal(readMuted());
  readonly started = signal(false);
  /** Annonces en cours, déclarées par les écrans (chapitre…) */
  private readonly holds = signal<Record<string, boolean>>({});
  readonly ducked = computed(() => this.fx.busy() || !!this.fx.election() || Object.values(this.holds()).some(Boolean));

  constructor() {
    if (typeof window === 'undefined') return;
    // Le premier geste du joueur lance la musique
    const kick = () => {
      window.removeEventListener('pointerdown', kick, true);
      window.removeEventListener('keydown', kick, true);
      if (!this.muted()) this.start();
    };
    window.addEventListener('pointerdown', kick, true);
    window.addEventListener('keydown', kick, true);
    // Le volume suit le bouton et les annonces
    effect(() => {
      const target = this.muted() ? 0 : this.ducked() ? DUCKED : NORMAL;
      if (this.started()) this.fadeTo(target, this.muted() ? 350 : this.ducked() ? 450 : 1200);
    });
  }

  /** Une annonce occupe l'écran : la musique baisse tant qu'elle dure */
  hold(key: string, on: boolean): void {
    if (!!this.holds()[key] === on) return;
    this.holds.update(h => ({ ...h, [key]: on }));
  }

  toggle(): void {
    const muted = !this.muted();
    this.muted.set(muted);
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* navigation privée */ }
    if (!muted) this.start();
  }

  private start(): void {
    if (typeof Audio === 'undefined') return;
    if (!this.audio) {
      const a = new Audio(SRC);
      a.loop = true;
      a.preload = 'auto';
      this.audio = a;
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          this.ctx = new Ctx();
          this.gain = this.ctx.createGain();
          this.gain.gain.value = 0;
          this.ctx.createMediaElementSource(a).connect(this.gain).connect(this.ctx.destination);
        } else {
          a.volume = 0;
        }
      } catch {
        this.ctx = null; this.gain = null; a.volume = 0;
      }
    }
    void this.ctx?.resume().catch(() => {});
    this.audio.play().then(() => {
      this.started.set(true);
      this.fadeTo(this.ducked() ? DUCKED : NORMAL, 1500);
    }).catch(() => { /* le navigateur attend un autre geste */ });
  }

  private apply(v: number): void {
    this.level = v;
    if (this.gain) this.gain.gain.value = v;
    else if (this.audio) this.audio.volume = Math.max(0, Math.min(1, v));
  }

  private fadeTo(target: number, ms: number): void {
    if (this.fadeTimer) clearInterval(this.fadeTimer);
    const from = this.level;
    const steps = Math.max(1, Math.round(ms / 40));
    let k = 0;
    if (target > 0 && this.audio?.paused && this.started()) void this.audio.play().catch(() => {});
    this.fadeTimer = setInterval(() => {
      k++;
      this.apply(from + (target - from) * (k / steps));
      if (k >= steps) {
        clearInterval(this.fadeTimer!);
        this.fadeTimer = null;
        if (target === 0) this.audio?.pause();
      }
    }, 40);
  }
}

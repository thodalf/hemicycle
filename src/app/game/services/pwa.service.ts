import { Injectable, computed, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/** Événement non standard de Chrome / Edge / Android */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'polsim.pwa.dismissed';

/**
 * Webapp : installation sur l'écran d'accueil, mise à jour quand une
 * nouvelle version est en ligne, et état hors ligne.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly sw = inject(SwUpdate);
  private deferred: InstallPromptEvent | null = null;

  /** Le navigateur propose l'installation (Chrome, Edge, Android) */
  readonly canPrompt = signal(false);
  /** Déjà lancée comme une application */
  readonly standalone = signal(false);
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly updateReady = signal(false);
  readonly installed = signal(false);
  readonly dismissed = signal(false);
  /** iPhone / iPad dans Safari : installation manuelle par « Partager » */
  readonly ios = signal(false);

  /** Il y a quelque chose à proposer : un bouton ou des instructions */
  readonly offer = computed(() => !this.standalone() && !this.installed() && !this.dismissed() && (this.canPrompt() || this.ios()));

  constructor() {
    if (typeof window === 'undefined') return;
    try { this.dismissed.set(localStorage.getItem(DISMISS_KEY) === '1'); } catch { /* stockage indisponible */ }
    const mq = window.matchMedia?.('(display-mode: standalone)');
    const isStandalone = () => !!mq?.matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    this.standalone.set(isStandalone());
    mq?.addEventListener?.('change', () => this.standalone.set(isStandalone()));

    const ua = navigator.userAgent;
    const iosDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    // Seule une page servie avec son manifeste peut s'installer (pas l'aperçu en un seul fichier)
    const installable = !!document.querySelector('link[rel="manifest"]');
    this.ios.set(installable && iosDevice && !/CriOS|FxiOS|EdgiOS/.test(ua));

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.deferred = e as InstallPromptEvent;
      this.canPrompt.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.installed.set(true);
      this.canPrompt.set(false);
      this.deferred = null;
    });
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));

    if (this.sw.isEnabled) {
      this.sw.versionUpdates.subscribe(ev => {
        if (ev.type === 'VERSION_READY') this.updateReady.set(true);
      });
      this.sw.unrecoverable.subscribe(() => this.updateReady.set(true));
      // Vérifier les mises à jour toutes les 30 minutes
      setInterval(() => this.sw.checkForUpdate().catch(() => undefined), 30 * 60 * 1000);
    }
  }

  async install(): Promise<void> {
    const ev = this.deferred;
    if (!ev) return;
    await ev.prompt();
    const choice = await ev.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    this.deferred = null;
    this.canPrompt.set(false);
    if (choice.outcome === 'accepted') this.installed.set(true);
  }

  dismiss(): void {
    this.dismissed.set(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* stockage indisponible */ }
  }

  async reload(): Promise<void> {
    try { if (this.sw.isEnabled) await this.sw.activateUpdate(); } catch { /* on recharge quand même */ }
    location.reload();
  }
}

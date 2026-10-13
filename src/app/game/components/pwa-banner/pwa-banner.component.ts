import { Component, inject, input } from '@angular/core';
import { PwaService } from '../../services/pwa.service';

/**
 * Bandeaux de la webapp : proposer l'installation (hors partie),
 * annoncer une nouvelle version, signaler le mode hors ligne.
 */
@Component({
  selector: 'app-pwa-banner',
  template: `
    @if (!inGame() && pwa.offer()) {
      <aside class="install card" aria-label="Installer l’application">
        <img src="icons/icon-192.png" alt="" width="44" height="44" />
        <div class="txt">
          <strong>Installez Hémicycle</strong>
          @if (pwa.canPrompt()) {
            <span class="muted">Sur votre écran d’accueil, en plein écran, et jouable hors connexion.</span>
          } @else {
            <span class="muted">Dans Safari : touchez <svg class="share" viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M10 2v11M6 6l4-4 4 4M4 9v8h12V9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Partager, puis « Sur l’écran d’accueil ».</span>
          }
        </div>
        <div class="cta">
          @if (pwa.canPrompt()) { <button class="btn primary small" (click)="pwa.install()">Installer</button> }
          <button class="btn small ghost" (click)="pwa.dismiss()" aria-label="Ne plus proposer">Plus tard</button>
        </div>
      </aside>
    }
    @if (pwa.updateReady()) {
      <div class="toast" role="status">
        <span>Une nouvelle version d’Hémicycle est prête.</span>
        <button class="btn primary small" (click)="pwa.reload()">Mettre à jour</button>
      </div>
    }
    @if (!pwa.online()) {
      <div class="offline" role="status">Hors ligne · la partie continue, sauvegardée sur cet appareil</div>
    }
  `,
  styles: `
    :host { display: contents; }
    .install { display: flex; align-items: center; gap: 12px; max-width: 760px; margin: 12px auto 0; padding: 12px 14px;
      width: calc(100% - 32px); box-sizing: border-box; border-left: 4px solid var(--accent); }
    .install img { border-radius: 10px; flex: none; }
    .txt { display: grid; gap: 2px; flex: 1; font-size: 13.5px; }
    .share { vertical-align: -2px; color: var(--accent); }
    .cta { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .ghost { background: none; }
    .toast { position: fixed; z-index: 400; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%);
      display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 16px; border-radius: 12px; background: var(--ink); color: var(--bg);
      box-shadow: 0 8px 28px rgba(0,0,0,.25); font-size: 13.5px; width: max-content; max-width: calc(100% - 32px); animation: up .35s ease; }
    .offline { position: fixed; z-index: 390; top: env(safe-area-inset-top, 0px); left: 50%; transform: translateX(-50%); padding: 4px 12px;
      border-radius: 0 0 10px 10px; background: var(--warn); color: #fff; font-size: 12px; font-weight: 600; white-space: nowrap; }
    @keyframes up { from { transform: translate(-50%, 20px); opacity: 0; } }
    @media (max-width: 520px) {
      .install { flex-wrap: wrap; } .cta { width: 100%; }
      .toast { flex-direction: column; align-items: stretch; text-align: center; }
    }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
  `,
})
export class PwaBannerComponent {
  protected readonly pwa = inject(PwaService);
  readonly inGame = input(false);
}

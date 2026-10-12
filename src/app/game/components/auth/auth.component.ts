import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';

/** Écran de connexion : compte Claude, compte local ou invité */
@Component({
  selector: 'app-auth',
  template: `
    <main class="wrap">
      <div class="eyebrow">Simulateur de carrière politique</div>
      <h1>Hémicycle</h1>
      <p class="lede">Connectez-vous pour retrouver vos parties : trois emplacements de sauvegarde par compte.</p>

      @if (auth.cloud() === 'checking') {
        <div class="card checking"><span class="spinner" aria-hidden="true"></span> Vérification de votre compte…</div>
      }

      @if (auth.cloud() === 'available') {
        <section class="card cloud">
          <div>
            <span class="eyebrow">Compte Claude</span>
            <strong>{{ auth.cloudName() }}</strong>
            <span class="muted">Sauvegarde en ligne, privée, retrouvée sur tous vos appareils.</span>
          </div>
          <button class="btn primary" (click)="auth.useCloud()">Continuer</button>
        </section>
        <div class="or"><span>ou un compte local à ce navigateur</span></div>
      }

      <form class="card" (submit)="submit($event)">
        <nav class="tabs" role="tablist">
          <button type="button" role="tab" [class.on]="mode() === 'login'" (click)="mode.set('login'); auth.error.set('')">Se connecter</button>
          <button type="button" role="tab" [class.on]="mode() === 'register'" (click)="mode.set('register'); auth.error.set('')">Créer un compte</button>
        </nav>
        <label class="field">
          <span class="eyebrow">Pseudo</span>
          <input type="text" autocomplete="username" [value]="name()" (input)="name.set($any($event.target).value)" maxlength="24" required />
        </label>
        <label class="field">
          <span class="eyebrow">Mot de passe</span>
          <input type="password" [attr.autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'" [value]="password()" (input)="password.set($any($event.target).value)" required />
        </label>
        @if (mode() === 'register') {
          <label class="field">
            <span class="eyebrow">Confirmer le mot de passe</span>
            <input type="password" autocomplete="new-password" [value]="confirm()" (input)="confirm.set($any($event.target).value)" required />
          </label>
        }
        @if (auth.error()) { <p class="error" role="alert">{{ auth.error() }}</p> }
        <button class="btn primary go" type="submit" [disabled]="auth.busy()">
          {{ auth.busy() ? 'Un instant…' : mode() === 'login' ? 'Se connecter' : 'Créer mon compte' }}
        </button>
        @if (known().length && mode() === 'login') {
          <p class="muted small">Comptes sur cet appareil : {{ known().join(', ') }}</p>
        }
        <p class="muted small">Les comptes locaux vivent dans ce navigateur (mot de passe chiffré). Pour changer d’appareil,
          exportez votre sauvegarde depuis le menu des parties.</p>
      </form>

      <button class="link" (click)="auth.playAsGuest()">Jouer sans compte (invité·e)</button>
    </main>
  `,
  styles: `
    .wrap { max-width: 480px; margin: 0 auto; padding: 64px 16px; display: grid; gap: 14px; }
    h1 { font-size: 56px; line-height: 1; margin: 0; }
    .lede { color: var(--ink-2); margin: 0; }
    .card { padding: 20px; display: grid; gap: 12px; animation: rise .4s ease both; }
    .cloud { display: flex; justify-content: space-between; align-items: center; gap: 12px; border-left: 4px solid var(--accent);
      div { display: grid; gap: 2px; } strong { font-family: var(--font-display); font-size: 19px; } .muted { font-size: 12.5px; } }
    .checking { display: flex; align-items: center; gap: 10px; color: var(--ink-2); }
    .spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--line); border-top-color: var(--accent); animation: spin .8s linear infinite; }
    .or { display: flex; align-items: center; gap: 10px; color: var(--ink-3); font-size: 12px;
      &::before, &::after { content: ''; flex: 1; height: 1px; background: var(--line); } }
    .tabs { display: flex; gap: 4px; padding: 3px; border-radius: 9px; background: var(--surface-2); border: 1px solid var(--line);
      button { flex: 1; border: 0; background: none; padding: 7px; border-radius: 7px; cursor: pointer; font: inherit; color: var(--ink-2); }
      button.on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 3px rgba(0,0,0,.12); font-weight: 600; } }
    .field { display: grid; gap: 6px; }
    input { padding: 9px 10px; font-size: 15px; }
    .error { color: var(--bad); margin: 0; font-size: 13px; }
    .go { padding: 11px; font-size: 15px; }
    .small { font-size: 12px; margin: 0; line-height: 1.45; }
    .link { justify-self: center; background: none; border: 0; color: var(--accent); text-decoration: underline; cursor: pointer; font: inherit; }
    @keyframes rise { from { opacity: 0; transform: translateY(10px); } }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 480px) { h1 { font-size: 42px; } .cloud { flex-direction: column; align-items: stretch; } }
  `,
})
export class AuthComponent {
  protected readonly auth = inject(AuthService);
  protected readonly mode = signal<'login' | 'register'>(this.auth.localAccounts().length ? 'login' : 'register');
  protected readonly name = signal('');
  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly known = signal(this.auth.localAccounts());

  protected async submit(e: Event): Promise<void> {
    e.preventDefault();
    const ok = this.mode() === 'login'
      ? await this.auth.login(this.name(), this.password())
      : await this.auth.register(this.name(), this.password(), this.confirm());
    if (ok) { this.password.set(''); this.confirm.set(''); }
  }
}

import { Component, computed, inject, output, signal } from '@angular/core';
import { FOUNDING_COST, PARTY_COLORS, canFoundParty } from '../../engine/founding';
import { GameStateService } from '../../services/game-state.service';
import { PartyFormComponent } from '../party-form/party-form.component';

/** Overlay : claquer la porte et fonder son propre parti en cours de partie */
@Component({
  selector: 'app-found-party',
  imports: [PartyFormComponent],
  template: `
    <div class="overlay" role="dialog" aria-modal="true" aria-label="Fonder un parti">
      <section class="sheet card">
        <span class="eyebrow">Rupture</span>
        <h2>Fonder votre propre parti</h2>
        <p class="muted">Vous quittez {{ old() }}. Ses cadres vous en voudront ; un proche vous suivra peut-être.
          Vous partez avec quelques centaines d’adhérents, une petite trésorerie et un parti qui vous appartient : plus de
          congrès à gagner, mais une implantation à construire (malus électoral qui s’efface en un an).</p>
        <app-party-form [(name)]="name" [(color)]="color" [(position)]="position" />
        <div class="cost">
          @if (free()) {
            <span class="chip good">Vos soutiens prennent les frais en charge</span>
          } @else {
            <span class="chip">Coût : {{ cost.money.toLocaleString('fr-FR') }} € et {{ cost.politicalCapital }} de capital politique</span>
          }
          @if (!check().ok) { <span class="chip bad">{{ check().reason }}</span> }
        </div>
        <div class="cta">
          <button class="btn" (click)="closed.emit()">Annuler</button>
          <button class="btn primary" [disabled]="!check().ok || !name().trim()" (click)="confirm()">Fonder « {{ name() || '…' }} »</button>
        </div>
      </section>
    </div>
  `,
  styles: `
    .overlay { position: fixed; inset: 0; z-index: 20; overflow-y: auto; background: rgba(10, 12, 18, .6); backdrop-filter: blur(3px);
      display: grid; justify-items: center; align-items: start; padding: max(24px, env(safe-area-inset-top, 0px)) 16px 32px; }
    .sheet { width: 100%; max-width: 560px; display: grid; gap: 12px; padding: 22px; }
    h2 { font-size: 26px; margin: 0; }
    p { margin: 0; font-size: 13.5px; line-height: 1.5; }
    .cost { display: flex; flex-wrap: wrap; gap: 6px; }
    .cta { display: flex; justify-content: flex-end; gap: 8px; }
  `,
})
export class FoundPartyComponent {
  private readonly game = inject(GameStateService);
  readonly closed = output<void>();
  protected readonly name = signal('');
  protected readonly color = signal(PARTY_COLORS[5]);
  protected readonly position = signal(Math.round(this.game.player().stance / 5) * 5);
  protected readonly cost = FOUNDING_COST;
  protected readonly free = computed(() => !!this.game.player().flags['foundOffer']);
  protected readonly check = computed(() => canFoundParty(this.game.s(), this.free()));
  protected readonly old = computed(() => this.game.s().party.name);

  protected confirm(): void {
    this.game.foundParty({ name: this.name(), color: this.color(), position: this.position() });
    this.closed.emit();
  }
}

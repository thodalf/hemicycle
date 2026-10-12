import { Component, effect, inject, signal } from '@angular/core';
import { DashboardComponent } from './game/components/dashboard/dashboard.component';
import { NewGameComponent } from './game/components/new-game/new-game.component';
import { AuthComponent } from './game/components/auth/auth.component';
import { SlotsComponent } from './game/components/slots/slots.component';
import { GameStateService } from './game/services/game-state.service';
import { AuthService } from './game/services/auth.service';

@Component({
  selector: 'app-root',
  imports: [DashboardComponent, NewGameComponent, AuthComponent, SlotsComponent],
  template: `
    @if (!auth.signedIn()) {
      <app-auth />
    } @else if (game.started()) {
      <app-dashboard />
    } @else if (creating()) {
      <app-new-game (back)="creating.set(false)" />
    } @else {
      <app-slots (create)="creating.set(true)" />
    }
  `,
})
export class App {
  protected readonly game = inject(GameStateService);
  protected readonly auth = inject(AuthService);
  protected readonly creating = signal(false);

  /** Une partie lancée referme l'écran de création */
  private readonly reset = effect(() => {
    if (this.game.started()) this.creating.set(false);
  });
}

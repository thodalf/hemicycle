import { Component, inject } from '@angular/core';
import { TeamService } from '../../services/team.service';
import { RecruitCardComponent } from '../recruit-card/recruit-card.component';

/** Ouverture d'un booster : trois candidats se dévoilent */
@Component({
  selector: 'app-booster',
  imports: [RecruitCardComponent],
  template: `
    <div class="overlay" role="dialog" aria-modal="true" aria-label="Booster de recrutement">
      <section class="sheet">
        <header>
          <span class="eyebrow">Booster de recrutement</span>
          <h2>Trois profils frappent à votre porte</h2>
          <p class="muted">Ils rejoignent votre vivier de candidats. Recrutez-les depuis le panneau Équipe.</p>
        </header>
        <div class="cards">
          @for (r of team.revealed(); track r.id; let i = $index) {
            <div class="slot" [style.animation-delay.ms]="i * 180">
              <app-recruit-card [recruit]="r" />
            </div>
          }
        </div>
        <footer>
          @if (team.boosters() > 0) {
            <button class="btn" (click)="team.open()">Ouvrir le suivant ({{ team.boosters() }})</button>
          }
          <button class="btn primary" (click)="team.revealed.set(null)">Continuer</button>
        </footer>
      </section>
    </div>
  `,
  styles: `
    .overlay { position: fixed; inset: 0; z-index: 30; overflow-y: auto; background: rgba(10, 12, 18, .7); backdrop-filter: blur(4px);
      display: grid; justify-items: center; align-items: start; padding: max(32px, env(safe-area-inset-top, 0px)) 16px 32px; }
    .sheet { width: 100%; max-width: 860px; background: var(--surface); border-radius: 14px; border: 1px solid var(--line);
      box-shadow: 0 24px 60px -20px rgba(0, 0, 0, .55); padding: 20px; display: grid; gap: 16px; }
    header h2 { font-size: 24px; margin: 4px 0; }
    header p { margin: 0; font-size: 13px; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .slot { animation: deal .45s cubic-bezier(.2, .9, .3, 1.2) both; }
    @keyframes deal { from { transform: translateY(24px) rotateY(80deg); opacity: 0; } to { transform: none; opacity: 1; } }
    footer { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
    @media (max-width: 720px) { .cards { grid-template-columns: 1fr; } }
    @media (prefers-reduced-motion: reduce) { .slot { animation: none; } }
  `,
})
export class BoosterComponent {
  protected readonly team = inject(TeamService);
}

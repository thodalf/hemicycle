import { Component, inject, signal } from '@angular/core';
import { TeamService } from '../../services/team.service';
import { RecruitCardComponent } from '../recruit-card/recruit-card.component';

/** Équipe recrutée, vivier de candidats et boosters à ouvrir */
@Component({
  selector: 'app-team-panel',
  imports: [RecruitCardComponent],
  template: `
    <section class="card">
      <div class="card-title">
        <span>Équipe</span>
        <span class="chip mono">{{ team.payroll() }} €/sem.</span>
      </div>

      @if (team.boosters() > 0) {
        <button class="booster-btn" (click)="team.open()">
          <span class="pack" aria-hidden="true"></span>
          <span><strong>{{ team.boosters() }} booster{{ team.boosters() > 1 ? 's' : '' }} à ouvrir</strong><small>Trois profils à recruter</small></span>
        </button>
      }

      <div class="list">
        @for (r of team.team(); track r.id) {
          <app-recruit-card [recruit]="r" [compact]="true">
            <button class="btn small" (click)="team.fire(r.id)">Renvoyer</button>
          </app-recruit-card>
        } @empty {
          <p class="muted small">Personne pour l’instant. Ouvrez un booster, puis recrutez depuis le vivier.</p>
        }
      </div>

      @if (team.pool().length) {
        <button class="toggle" (click)="showPool.set(!showPool())" [attr.aria-expanded]="showPool()">
          Vivier de candidats ({{ team.pool().length }}) {{ showPool() ? '▴' : '▾' }}
        </button>
        @if (showPool()) {
          <div class="list">
            @for (r of team.pool(); track r.id) {
              @let chk = team.check(r);
              @let occ = team.occupant(r);
              <app-recruit-card [recruit]="r">
                <button class="btn small primary" [disabled]="!chk.ok" (click)="team.hire(r.id)">{{ occ ? 'Remplacer ' + occ.name.split(' ')[0] : 'Recruter' }}</button>
                <button class="btn small" (click)="team.dismiss(r.id)">Écarter</button>
                @if (!chk.ok) { <small class="why">{{ chk.reason }}</small> }
              </app-recruit-card>
            }
          </div>
        }
      }
    </section>
  `,
  styles: `
    .list { display: grid; gap: 8px; margin-top: 8px; }
    .small { font-size: 12.5px; margin: 0; }
    .booster-btn {
      display: flex; gap: 10px; align-items: center; width: 100%; text-align: left; cursor: pointer; padding: 10px 12px;
      border-radius: 10px; border: 1px dashed var(--warn); background: var(--warn-soft); color: var(--ink);
      span:last-child { display: grid; } small { font-size: 11.5px; color: var(--ink-2); }
      &:hover { border-style: solid; }
    }
    .pack { width: 26px; height: 34px; border-radius: 4px; flex-shrink: 0; background: linear-gradient(135deg, var(--warn), var(--accent)); box-shadow: 2px 2px 0 var(--line); }
    .toggle { margin-top: 10px; width: 100%; text-align: left; border: 0; background: none; cursor: pointer; font-weight: 600; color: var(--accent); padding: 4px 0; }
    .why { font-size: 11px; color: var(--bad); width: 100%; }
  `,
})
export class TeamPanelComponent {
  protected readonly team = inject(TeamService);
  protected readonly showPool = signal(true);
}

import { Component, computed, inject, signal } from '@angular/core';
import { RankId, StaffRole } from '../../models/game.models';
import { STAFF_ICONS } from '../../data/staff';
import { RANKS } from '../../data/ranks';
import { FxService } from '../../services/fx.service';
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
        <span class="chip mono">{{ team.payroll().toLocaleString('fr-FR') }} €/mois</span>
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

      <button class="toggle" (click)="showPosts.set(!showPosts())" [attr.aria-expanded]="showPosts()">
        Organigramme ({{ filled() }}/{{ team.posts().length }} postes) {{ showPosts() ? '▴' : '▾' }}
      </button>
      @if (showPosts()) {
        <ul class="posts">
          @for (p of team.posts(); track p.def.role) {
            <li [class.filled]="!!p.holder" [class.locked]="!p.unlocked">
              <span class="ico" aria-hidden="true">{{ icons[p.def.role] }}</span>
              <span class="p-main">
                <strong>{{ p.def.title }}</strong>
                <small class="muted">{{ p.holder ? p.holder.name : p.unlocked ? 'Poste vacant' : 'Dès le rang ' + rankLabel(p.def.minRank) }}</small>
                <small class="perk">{{ p.def.perk }}</small>
              </span>
              @if (!p.holder && p.unlocked) {
                <button class="btn small" [disabled]="!p.hunt.ok" [title]="p.hunt.reason ?? ''" (click)="hunt(p.def.role, $event)">Chasseur de têtes · {{ p.fee.toLocaleString('fr-FR') }} €</button>
              }
            </li>
          }
        </ul>
      }

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
    .posts { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 6px; }
    .posts li { display: grid; grid-template-columns: 26px 1fr; gap: 4px 8px; align-items: start; padding: 8px 10px; border-radius: 10px; border: 1px dashed var(--line);
      .btn { grid-column: 2; justify-self: start; } }
    .posts li.filled { border-style: solid; background: var(--good-soft); }
    .posts li.locked { opacity: .55; }
    .ico { font-size: 18px; line-height: 1.2; }
    .p-main { display: grid; gap: 1px; strong { font-size: 13px; } small { font-size: 11.5px; } .perk { color: var(--ink-2); line-height: 1.35; } }
  `,
})
export class TeamPanelComponent {
  protected readonly team = inject(TeamService);
  protected readonly showPool = signal(true);
  protected readonly showPosts = signal(false);
  protected readonly icons = STAFF_ICONS;
  private readonly fx = inject(FxService);
  protected readonly filled = computed(() => this.team.posts().filter(p => p.holder).length);
  protected rankLabel(id: RankId): string { return RANKS[id].label; }
  protected hunt(role: StaffRole, ev: Event): void {
    if (this.team.headhunt(role)) {
      this.showPool.set(true);
      this.fx.floatAt(ev.currentTarget as Element, 'Nouveau profil au vivier', 'good');
    }
  }
}

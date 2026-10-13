import { Component, computed, inject, signal } from '@angular/core';
import { RankId, Recruit, StaffRole } from '../../models/game.models';
import { askOf, moraleLabel, moraleOf, moraleTarget, offerChance, payBounds } from '../../engine/team-pay';
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
      @if (team.team().length) {
        <p class="funding small">
          <span>Parti : <strong class="mono">{{ team.funding().party.toLocaleString('fr-FR') }} €</strong></span>
          <span>Votre poche : <strong class="mono">{{ team.funding().personal.toLocaleString('fr-FR') }} €</strong></span>
          <small class="muted">Le parti paie les postes politiques dans la limite de son budget. Chauffeur, plume et spin doctor restent à vos frais.</small>
        </p>
      }

      @if (team.boosters() > 0) {
        <button class="booster-btn" (click)="team.open()">
          <span class="pack" aria-hidden="true"></span>
          <span><strong>{{ team.boosters() }} booster{{ team.boosters() > 1 ? 's' : '' }} à ouvrir</strong><small>Trois profils à recruter</small></span>
        </button>
      }

      <div class="list">
        @for (r of team.team(); track r.id) {
          <app-recruit-card [recruit]="r" [compact]="true">
            <div class="pay">
              <div class="morale" [title]="'Moral ' + morale(r)">
                <span class="m-lbl">{{ moraleLabel(morale(r)) }}</span>
                <span class="m-bar"><i [style.width.%]="morale(r)" [class.low]="morale(r) < 35" [class.high]="morale(r) >= 80"></i></span>
              </div>
              <div class="stepper" role="group" [attr.aria-label]="'Salaire de ' + r.name">
                <button type="button" class="st" (click)="change(r, -1)" aria-label="Baisser le salaire">−</button>
                <span class="mono">{{ r.salary.toLocaleString('fr-FR') }} €</span>
                <button type="button" class="st" (click)="change(r, 1)" aria-label="Augmenter le salaire">+</button>
              </div>
              <small class="muted ask">Prétentions {{ ask(r).toLocaleString('fr-FR') }} €</small>
              <small class="payer" [class.party]="team.funding().partyIds.includes(r.id)">{{ team.funding().partyIds.includes(r.id) ? 'Payé par le parti' : team.personalRoles.includes(r.role) ? 'À vos frais (poste personnel)' : 'À vos frais (budget du parti épuisé)' }}</small>
            </div>
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
              @let o = offerOf(r);
              <app-recruit-card [recruit]="r">
                <div class="offer">
                  <span class="muted">Votre offre</span>
                  <div class="stepper">
                    <button type="button" class="st" (click)="bump(r, -1)" aria-label="Baisser l’offre">−</button>
                    <span class="mono">{{ o.toLocaleString('fr-FR') }} €</span>
                    <button type="button" class="st" (click)="bump(r, 1)" aria-label="Augmenter l’offre">+</button>
                  </div>
                  <small [class.risky]="chance(r) < 1">{{ chance(r) >= 1 ? 'Acceptée à coup sûr' : 'Chances d’accepter : ' + (chance(r) * 100).toFixed(0) + ' %' }} · moral de départ {{ startMorale(r) }}</small>
                </div>
                <button class="btn small primary" [disabled]="!chk.ok" (click)="propose(r)">{{ occ ? 'Remplacer ' + occ.name.split(' ')[0] : 'Proposer ' + o.toLocaleString('fr-FR') + ' €' }}</button>
                <button class="btn small" (click)="team.dismiss(r.id)">Écarter</button>
                @if (!chk.ok) { <small class="why">{{ chk.reason }}</small> }
                @if (answers()[r.id]; as a) { <small class="answer">{{ a }}</small> }
              </app-recruit-card>
            }
          </div>
        }
      }
    </section>
  `,
  styles: `
    .funding { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; margin: 0 0 10px; font-size: 12.5px; small { grid-column: 1 / -1; font-size: 11px; } }
    .payer { font-size: 11px; color: var(--ink-3); } .payer.party { color: var(--good); }
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
    .pay, .offer { width: 100%; display: grid; grid-template-columns: 1fr auto; gap: 4px 8px; align-items: center; font-size: 12px; }
    .offer small, .ask { grid-column: 1 / -1; font-size: 11px; }
    .offer small.risky { color: var(--warn); }
    .morale { display: grid; gap: 2px; .m-lbl { font-size: 11px; color: var(--ink-2); } }
    .m-bar { height: 5px; border-radius: 3px; background: var(--surface-2); overflow: hidden;
      i { display: block; height: 100%; background: var(--accent); } i.low { background: var(--bad); } i.high { background: var(--good); } }
    .stepper { display: inline-flex; align-items: center; gap: 4px; .mono { min-width: 64px; text-align: center; font-size: 12px; } }
    .st { width: 26px; height: 26px; border-radius: 7px; border: 1px solid var(--line); background: var(--surface); cursor: pointer; font-size: 14px; line-height: 1; color: var(--ink); }
    .st:hover { border-color: var(--accent); color: var(--accent); }
    .answer { width: 100%; font-size: 11.5px; color: var(--ink-2); font-style: italic; }
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
  /** Offres en cours de négociation, par candidat·e */
  private readonly offers = signal<Record<string, number>>({});
  protected readonly answers = signal<Record<string, string>>({});
  protected ask(r: Recruit): number { return askOf(r); }
  protected morale(r: Recruit): number { return Math.round(moraleOf(r)); }
  protected moraleLabel(m: number): string { return moraleLabel(m); }
  protected offerOf(r: Recruit): number { return this.offers()[r.id] ?? askOf(r); }
  protected chance(r: Recruit): number { return offerChance(r, this.offerOf(r)); }
  protected startMorale(r: Recruit): number { return Math.round(moraleTarget({ ...r, ask: askOf(r), salary: this.offerOf(r) })); }
  private step(r: Recruit): number { return Math.max(50, Math.round(askOf(r) * 0.05 / 50) * 50); }
  protected bump(r: Recruit, dir: 1 | -1): void {
    const { min, max } = payBounds(r);
    const v = Math.min(max, Math.max(min, this.offerOf(r) + dir * this.step(r)));
    this.offers.update(o => ({ ...o, [r.id]: v }));
  }
  protected propose(r: Recruit): void {
    const res = this.team.offer(r.id, this.offerOf(r));
    if (!res.ok) this.answers.update(a => ({ ...a, [r.id]: res.text }));
  }
  protected change(r: Recruit, dir: 1 | -1): void {
    this.team.setSalary(r.id, r.salary + dir * this.step(r));
  }
  protected hunt(role: StaffRole, ev: Event): void {
    if (this.team.headhunt(role)) {
      this.showPool.set(true);
      this.fx.floatAt(ev.currentTarget as Element, 'Nouveau profil au vivier', 'good');
    }
  }
}

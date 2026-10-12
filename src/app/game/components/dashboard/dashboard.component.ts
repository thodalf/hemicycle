import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { DOMAIN_LABELS } from '../../models/game.models';
import { GameStateService } from '../../services/game-state.service';
import { DebateArenaComponent } from '../debate-arena/debate-arena.component';
import { ProgramBuilderComponent } from '../program-builder/program-builder.component';
import { ProtestComponent } from '../protest/protest.component';
import { SceneComponent } from '../scene/scene.component';
import { BoosterComponent } from '../booster/booster.component';
import { ScenarioPanelComponent } from '../scenario-panel/scenario-panel.component';
import { TeamService } from '../../services/team.service';
import { BudgetComponent } from '../budget/budget.component';
import { BudgetService } from '../../services/budget.service';
import { PatrimoineComponent } from '../patrimoine/patrimoine.component';
import { VitalsComponent } from '../vitals/vitals.component';
import { FxLayerComponent } from '../fx-layer/fx-layer.component';
import { ElectionNightComponent } from '../election-night/election-night.component';
import { FxService } from '../../services/fx.service';
import { AuthService } from '../../services/auth.service';
import { RANKS } from '../../data/ranks';
import { PatrimoineService } from '../../services/patrimoine.service';
import { ProgramService } from '../../services/program.service';
import { DecisionPanelComponent } from '../decision-panel/decision-panel.component';
import { ObjectivesPanelComponent } from '../objectives-panel/objectives-panel.component';
import { TeamPanelComponent } from '../team-panel/team-panel.component';
import { ElectionPanelComponent } from '../election-panel/election-panel.component';
import { NewsFeedComponent } from '../news-feed/news-feed.component';
import { PartyPanelComponent } from '../party-panel/party-panel.component';
import { ProfilePanelComponent } from '../profile-panel/profile-panel.component';
import { WeekPlannerComponent } from '../week-planner/week-planner.component';

@Component({
  selector: 'app-dashboard',
  imports: [
    DecimalPipe,
    ProfilePanelComponent, WeekPlannerComponent, DecisionPanelComponent,
    PartyPanelComponent, ElectionPanelComponent, NewsFeedComponent,
    DebateArenaComponent, ObjectivesPanelComponent, TeamPanelComponent, ProgramBuilderComponent, ProtestComponent, BudgetComponent, SceneComponent, BoosterComponent, ScenarioPanelComponent, PatrimoineComponent, VitalsComponent, FxLayerComponent, ElectionNightComponent,
  ],
  template: `
    <header class="topbar">
      <div class="brand">Hémicycle</div>
      <div class="facts">
        <span><span class="eyebrow">Semaine</span> <strong class="mono">{{ game.week() }}</strong></span>
        <span><span class="eyebrow">À la une</span> <strong>{{ agenda() }}</strong></span>
        <span><span class="eyebrow">Rang</span> <strong>{{ game.rank().label }}</strong></span>
      </div>
      <app-vitals />
      <span class="save" [class]="'s-' + game.saveStatus()" [title]="saveTip()">
        <span class="dot" aria-hidden="true"></span>{{ saveLabel() }}
      </span>
      <button class="btn small" (click)="confirmQuit()">Mes parties</button>
    </header>

    <div class="grid">
      <div class="col-left">
        <app-profile-panel />
        <section class="card budget-card wealth-card">
          <div class="card-title"><span>Patrimoine</span>
            <span class="chip" [class.bad]="wealth.image().popularity < 0" [class.good]="wealth.image().popularity > 0">{{ wealth.image().label }}</span></div>
          <div class="b-row"><span>Patrimoine net</span><strong class="mono">{{ wealth.net() | number: '1.0-0' }} €</strong></div>
          <div class="b-row"><span>Biens</span><strong class="mono">{{ wealth.owned().length }}</strong></div>
          @if (wealth.image().popularity) {
            <div class="b-row"><span>Effet sur l’opinion</span><strong class="mono" [class.neg]="wealth.image().popularity < 0">{{ wealth.image().popularity > 0 ? '+' : '' }}{{ wealth.image().popularity | number: '1.2-2' }}/sem.</strong></div>
          }
          <button class="btn small" (click)="wealthOpen.set(true)">Acheter, vendre</button>
        </section>
        @if (budget.anyAccess()) {
          <section class="card budget-card">
            <div class="card-title"><span>Budgets</span></div>
            @if (budget.party(); as f) {
              @if (budget.partyAccess()) {
                <div class="b-row"><span>Trésorerie du parti</span><strong class="mono" [class.neg]="f.treasury < 0">{{ f.treasury | number: '1.0-0' }} k€</strong></div>
                <div class="b-row"><span>Adhérents</span><strong class="mono">{{ f.members | number: '1.0-0' }}</strong></div>
              }
            }
            @if (budget.nationalReport(); as r) {
              @if (budget.national()) {
                <div class="b-row"><span>Déficit de l’État</span><strong class="mono">{{ r.deficitPct | number: '1.1-1' }} %</strong></div>
              }
            }
            <button class="btn small" (click)="budgetOpen.set(true)">Ouvrir les budgets</button>
          </section>
        }
        <app-team-panel />
      </div>
      <main class="col-main">
        @if (game.s().crown || game.s().lodge || game.s().press || game.s().mole) {
          <app-scenario-panel />
        }
        @if (program.pending()) {
          <section class="card program-cta">
            <div>
              <span class="eyebrow">Campagne présidentielle</span>
              <strong>Votre programme : {{ program.report().answered }} / 20 questions</strong>
              <span class="muted">À présenter avant de clore la semaine.</span>
            </div>
            <button class="btn primary" (click)="builderHidden.set(false)">Construire le programme</button>
          </section>
        }
        @if (budget.national()?.pending && budget.stateAccess()) {
          <section class="card program-cta">
            <div>
              <span class="eyebrow">Bercy</span>
              <strong>Loi de finances {{ budget.national()!.year }} à soumettre</strong>
              <span class="muted">Avant la semaine {{ budget.national()!.deadlineWeek }}{{ budget.national()!.rejected ? ' · rejetée par l’Assemblée' : '' }}.</span>
            </div>
            <button class="btn primary" (click)="budgetOpen.set(true)">Préparer le budget</button>
          </section>
        }
        <app-decision-panel />
        <app-objectives-panel />
        <app-week-planner />
      </main>
      <div class="col-right">
        <app-news-feed />
        <app-election-panel />
        <app-party-panel />
      </div>
    </div>

    @if (game.s().debate) {
      <app-debate-arena />
    } @else if (game.s().protest) {
      <app-protest />
    } @else if (game.s().scene) {
      <app-scene />
    } @else if (program.pending() && !builderHidden()) {
      <app-program-builder (closed)="builderHidden.set(true)" />
    } @else if (budgetOpen()) {
      <app-budget (closed)="budgetOpen.set(false)" />
    } @else if (wealthOpen()) {
      <app-patrimoine (closed)="wealthOpen.set(false)" />
    }

    <app-election-night />
    <app-fx-layer />

    @if (team.revealed()) {
      <app-booster />
    }

    @if (game.s().status !== 'en_cours' && !game.s().debate && !game.s().protest && !game.s().scene) {
      <div class="overlay" role="dialog" aria-modal="true">
        <div class="card end">
          <div class="eyebrow">{{ game.s().status === 'victoire' ? 'Victoire' : 'Fin de carrière' }} · semaine {{ game.week() }}</div>
          <h2>{{ game.s().endTitle ?? (game.s().status === 'victoire' ? 'Président·e de la République' : 'Rideau.') }}</h2>
          <p>{{ game.s().endReason }}</p>
          <button class="btn primary" (click)="game.quit()">Retour à mes parties</button>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .topbar {
      position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; display: flex; align-items: center; gap: 24px;
      padding: 10px 20px; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--line);
    }
    .brand { font-family: var(--font-display); font-size: 20px; font-weight: 700; }
    .facts { display: flex; gap: 20px; flex: 1; flex-wrap: wrap; font-size: 13px; .eyebrow { margin-right: 4px; } }
    .grid {
      display: grid; gap: 16px; padding: 16px 20px 40px; max-width: 1560px; margin: 0 auto;
      grid-template-columns: 280px minmax(0, 1fr) 320px; align-items: start;
    }
    .program-cta { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
      border-left: 4px solid var(--accent);
      > div { display: grid; gap: 2px; } strong { font-family: var(--font-display); font-size: 17px; } }
    .budget-card { display: grid; gap: 6px; .card-title { margin-bottom: 4px; } .btn { margin-top: 6px; justify-self: start; } }
    .b-row { display: flex; justify-content: space-between; font-size: 13px; .neg { color: var(--bad); } }
    .col-left, .col-main, .col-right { display: grid; gap: 16px; align-content: start; min-width: 0; }
    .overlay { position: fixed; inset: 0; background: rgba(10, 12, 18, .55); display: grid; place-items: center; padding: 16px; z-index: 10; }
    .end { max-width: 440px; text-align: center; padding: 28px; h2 { font-size: 30px; margin: 8px 0; } p { color: var(--ink-2); } }
    .topbar { flex-wrap: wrap; row-gap: 6px; }
    .save { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-2); white-space: nowrap;
      .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ink-3); } }
    .save.s-saved .dot { background: var(--good); }
    .save.s-saving .dot { background: var(--warn); animation: save-pulse .8s ease-in-out infinite; }
    .save.s-error { color: var(--bad); .dot { background: var(--bad); } }
    @keyframes save-pulse { 50% { opacity: .3; } }
    @media (max-width: 1200px) {
      .grid { grid-template-columns: 260px minmax(0, 1fr); }
      .col-right { grid-column: 1 / -1; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    }
    @media (max-width: 820px) {
      .grid { grid-template-columns: 1fr; padding: 12px 16px 32px; }
      .col-left { order: 2; } .col-main { order: 1; } .col-right { order: 3; }
      .topbar { gap: 12px; padding: 10px 16px; flex-wrap: wrap; }
    }
  `,
})
export class DashboardComponent {
  protected readonly game = inject(GameStateService);
  protected readonly program = inject(ProgramService);
  protected readonly builderHidden = signal(false);
  protected readonly budget = inject(BudgetService);
  protected readonly budgetOpen = signal(false);
  protected readonly team = inject(TeamService);
  protected readonly wealth = inject(PatrimoineService);
  protected readonly wealthOpen = signal(false);
  private readonly fx = inject(FxService);
  private lastRank = this.game.player().rankId;
  private lastStatus = this.game.s().status;

  /** Promotions, victoire et défaite : tampon et confettis */
  private readonly celebrate = effect(() => {
    const rank = this.game.player().rankId;
    const status = this.game.s().status;
    untracked(() => {
      if (rank !== this.lastRank && RANKS[rank].order > RANKS[this.lastRank].order) {
        setTimeout(() => {
          this.fx.stamp('Promotion !', 'good', RANKS[rank].label);
          this.burstAround();
        }, 400);
      }
      if (status !== this.lastStatus && status !== 'en_cours') {
        setTimeout(() => {
          if (status === 'victoire') { this.fx.stamp('Victoire !', 'good', this.game.s().endTitle ?? ''); this.burstAround(); setTimeout(() => this.burstAround(), 500); }
          else { this.fx.stamp('Rideau', 'bad', this.game.s().endTitle ?? ''); this.fx.shake(); }
        }, 300);
      }
      this.lastRank = rank;
      this.lastStatus = status;
    });
  });

  private burstAround(): void {
    const w = window.innerWidth, h = window.innerHeight;
    [[0.3, 0.35], [0.5, 0.25], [0.7, 0.35]].forEach(([x, y], i) => setTimeout(() => this.fx.burst(w * x, h * y, 'good', 22), i * 140));
  }

  protected agenda() { return DOMAIN_LABELS[this.game.s().agendaDomain]; }
  protected confirmQuit() { this.game.quit(); }
  private readonly auth = inject(AuthService);
  protected saveLabel(): string {
    const who = this.auth.account();
    const st = this.game.saveStatus();
    if (st === 'saving') return 'Enregistrement…';
    if (st === 'error') return 'Sauvegarde impossible';
    return who?.kind === 'cloud' ? 'Sauvegardé en ligne' : who?.kind === 'local' ? `Sauvegardé · ${who.name}` : 'Sauvegardé (invité)';
  }
  protected saveTip(): string {
    const who = this.auth.account();
    return `${who?.kind === 'cloud' ? 'Compte Claude' : who?.kind === 'local' ? 'Compte local' : 'Invité'} · emplacement ${this.game.slot()}`;
  }
}

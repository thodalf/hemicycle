import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
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
import { LifePanelComponent } from '../life-panel/life-panel.component';
import { GovernmentPanelComponent } from '../government-panel/government-panel.component';
import { WorldPanelComponent } from '../world-panel/world-panel.component';
import { PresidencyPanelComponent } from '../presidency-panel/presidency-panel.component';
import { WarPanelComponent } from '../war-panel/war-panel.component';
import { ALIEN_PHASES } from '../../engine/alien';
import { PhoneComponent } from '../phone/phone.component';
import { PlotPanelComponent } from '../plot-panel/plot-panel.component';
import { PhoneService } from '../../services/phone.service';
import { ContactPanelComponent } from '../contact-panel/contact-panel.component';
import { AssemblyVoteComponent } from '../assembly-vote/assembly-vote.component';
import { BankComponent } from '../bank/bank.component';
import { MinigameComponent } from '../minigame/minigame.component';
import { BankService } from '../../services/bank.service';
import { DEATH_LABELS, lifeSummary } from '../../engine/life';
import { Milestone } from '../../models/game.models';

@Component({
  selector: 'app-dashboard',
  imports: [
    DecimalPipe,
    ProfilePanelComponent, WeekPlannerComponent, DecisionPanelComponent,
    PartyPanelComponent, ElectionPanelComponent, NewsFeedComponent,
    DebateArenaComponent, ObjectivesPanelComponent, TeamPanelComponent, ProgramBuilderComponent, ProtestComponent, BudgetComponent, SceneComponent, BoosterComponent, ScenarioPanelComponent, PatrimoineComponent, VitalsComponent, FxLayerComponent, ElectionNightComponent,
    LifePanelComponent, PresidencyPanelComponent, GovernmentPanelComponent, WorldPanelComponent,
    WarPanelComponent, ContactPanelComponent, PhoneComponent, PlotPanelComponent, AssemblyVoteComponent, BankComponent, MinigameComponent,
  ],
  template: `
    <header class="topbar">
      <div class="brand">Hémicycle</div>
      <div class="facts">
        <span class="date"><span class="eyebrow">Date</span> <strong>{{ game.date() }}</strong></span>
        <span><span class="eyebrow">À la une</span> <strong>{{ agenda() }}</strong></span>
        <span><span class="eyebrow">Rang</span> <strong>{{ game.roleLabel() }}</strong></span>
      </div>
      <app-vitals />
      <span class="save" [class]="'s-' + game.saveStatus()" [title]="saveTip()">
        <span class="dot" aria-hidden="true"></span><span class="save-lbl">{{ saveLabel() }}</span>
      </span>
      <button class="btn small phone-btn" (click)="phone.show()" [attr.aria-label]="'Téléphone' + (phone.unread() ? ', ' + phone.unread() + ' non lus' : '')">📱@if (phone.unread()) { <b class="badge">{{ phone.unread() }}</b> }</button>
      <button class="btn small quit" (click)="confirmQuit()" aria-label="Mes parties">Mes parties</button>
    </header>

    <div class="grid" [attr.data-tab]="tab()">
      <div class="col-left">
        <app-profile-panel />
        <!-- Votre fonction : Élysée, gouvernement, scénarios -->
        @if (game.s().presidency) { <app-presidency-panel /> }
        <app-government-panel />
        <app-contact-panel />
        @if (game.s().crown || game.s().lodge || game.s().press || game.s().mole) {
          <app-scenario-panel />
        }
        <app-life-panel />
        <section class="card budget-card wealth-card">
          <div class="card-title"><span>Patrimoine</span>
            <span class="chip" [class.bad]="wealth.image().popularity < 0" [class.good]="wealth.image().popularity > 0">{{ wealth.image().label }}</span></div>
          <div class="b-row"><span>Patrimoine net</span><strong class="mono">{{ wealth.net() | number: '1.0-0' }} €</strong></div>
          <div class="b-row"><span>Biens</span><strong class="mono">{{ wealth.owned().length }}</strong></div>
          @if (wealth.image().popularity) {
            <div class="b-row"><span>Effet sur l’opinion</span><strong class="mono" [class.neg]="wealth.image().popularity < 0">{{ wealth.image().popularity > 0 ? '+' : '' }}{{ wealth.image().popularity | number: '1.2-2' }}/mois</strong></div>
          }
          @if (bank.debt()) {
            <div class="b-row"><span>Emprunts</span><strong class="mono neg">{{ bank.debt() | number: '1.0-0' }} € · {{ bank.monthly() | number: '1.0-0' }} €/mois</strong></div>
          }
          <div class="row-btns">
            <button class="btn small" (click)="wealthOpen.set(true)">Acheter, vendre</button>
            <button class="btn small" (click)="bankOpen.set(true)">Emprunter</button>
          </div>
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
        <app-plot-panel />
        <app-war-panel />
        @if (!game.s().presidency) { <app-presidency-panel /> }
        @if (program.pending()) {
          <section class="card program-cta">
            <div>
              <span class="eyebrow">Campagne présidentielle</span>
              <strong>Votre programme : {{ program.report().answered }} / 20 questions</strong>
              <span class="muted">À présenter avant de clore le mois.</span>
            </div>
            <button class="btn primary" (click)="builderHidden.set(false)">Construire le programme</button>
          </section>
        }
        @if (budget.national()?.pending && budget.stateAccess()) {
          <section class="card program-cta">
            <div>
              <span class="eyebrow">Bercy</span>
              <strong>Loi de finances {{ budget.national()!.year }} à soumettre</strong>
              <span class="muted">Avant {{ game.month(budget.national()!.deadlineWeek) }}{{ budget.national()!.rejected ? ' · rejetée par l’Assemblée' : '' }}.</span>
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
        <app-world-panel />
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
    } @else if (game.s().vote) {
      <app-assembly-vote />
    } @else if (game.s().minigames.length) {
      <app-minigame />
    } @else if (program.pending() && !builderHidden()) {
      <app-program-builder (closed)="builderHidden.set(true)" />
    } @else if (budgetOpen()) {
      <app-budget (closed)="budgetOpen.set(false)" />
    } @else if (wealthOpen()) {
      <app-patrimoine (closed)="wealthOpen.set(false)" />
    } @else if (bankOpen()) {
      <app-bank (closed)="bankOpen.set(false)" />
    }

    <!-- Téléphone : une colonne à la fois, onglets en bas d'écran -->
    <nav class="mobile-tabs" aria-label="Sections">
      @for (t of tabs; track t.id) {
        <button type="button" [class.on]="tab() === t.id" [attr.aria-current]="tab() === t.id ? 'page' : null" (click)="setTab(t.id)">
          <span class="ico" aria-hidden="true">{{ t.icon }}</span>
          <span>{{ t.label }}</span>
          @if (t.id === 'agenda' && game.s().pendingDecisions.length + (game.s().vote ? 1 : 0) + (game.s().minigames.length)) { <b class="badge">{{ game.s().pendingDecisions.length + (game.s().vote ? 1 : 0) + (game.s().minigames.length) }}</b> }
          @if (t.id === 'actu' && unread()) { <b class="badge dot-badge" aria-label="Nouvelles"></b> }
        </button>
      }
    </nav>

    <app-phone />
    <app-election-night />
    <app-fx-layer />

    @if (team.revealed()) {
      <app-booster />
    }

    @if (game.s().status === 'mort' && game.s().death; as death) {
      <div class="overlay obit-wrap" role="dialog" aria-modal="true" aria-labelledby="obit-name">
        <article class="card obit">
          <div class="eyebrow">Nécrologie · {{ deathLabel(death.cause) }}</div>
          <div class="cross" aria-hidden="true"></div>
          <h2 id="obit-name">{{ game.player().name }}</h2>
          <p class="dates mono">{{ summary().born }} – {{ summary().died }} · {{ death.age }} ans</p>
          <p class="cause">{{ death.text }}</p>
          <p class="epitaph">« {{ summary().epitaph }} »</p>
          <dl class="facts-grid">
            <div><dt>Plus haute fonction</dt><dd>{{ summary().bestRank }}</dd></div>
            <div><dt>Mandats présidentiels</dt><dd class="mono">{{ summary().mandates }}</dd></div>
            <div><dt>Réformes</dt><dd class="mono">{{ summary().reforms }}</dd></div>
            <div><dt>Patrimoine laissé</dt><dd class="mono">{{ wealth.net() | number: '1.0-0' }} €</dd></div>
          </dl>
          @if (game.s().milestones.length) {
            <ol class="timeline">
              @for (m of game.s().milestones; track $index) {
                <li [class]="'k-' + m.kind"><span class="mono">{{ m.age }} ans</span> <strong>{{ m.title }}</strong><span class="muted"> — {{ m.text }}</span></li>
              }
            </ol>
          }
          <button class="btn primary" (click)="game.quit()">Retour à mes parties</button>
        </article>
      </div>
    } @else if (chapter(); as m) {
      <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="chapter-title">
        <div class="card end chapter" [class]="'k-' + m.kind">
          <div class="eyebrow">Nouveau chapitre · {{ m.age }} ans · {{ game.month(m.week) }}</div>
          <h2 id="chapter-title">{{ m.title }}</h2>
          <p>{{ m.text }}</p>
          <p class="muted small">{{ m.kind === 'revers' ? 'Un revers, pas une fin : la partie continue.' : 'La partie continue : seule la mort met fin à une vie politique.' }}</p>
          <button class="btn primary" (click)="chapter.set(null)">Continuer</button>
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
    .row-btns { display: flex; gap: 6px; flex-wrap: wrap; }
    .date strong { text-transform: capitalize; }
    .b-row { display: flex; justify-content: space-between; font-size: 13px; .neg { color: var(--bad); } }
    .col-left, .col-main, .col-right { display: grid; gap: 16px; align-content: start; min-width: 0; }
    .overlay { position: fixed; inset: 0; background: rgba(10, 12, 18, .55); display: grid; place-items: center; padding: 16px; z-index: 10; }
    .end { max-width: 440px; text-align: center; padding: 28px; h2 { font-size: 30px; margin: 8px 0; } p { color: var(--ink-2); } .small { font-size: 12.5px; } }
    .chapter { border-top: 5px solid var(--accent); animation: rise .45s cubic-bezier(.2,.8,.3,1.2); }
    .chapter.k-victoire { border-top-color: var(--good); }
    .chapter.k-revers { border-top-color: var(--bad); }
    .obit-wrap { background: rgba(8, 8, 10, .78); }
    .obit { max-width: 560px; max-height: calc(100dvh - 32px); overflow: auto; text-align: center; padding: 30px 28px;
      font-family: var(--font-display); border: 1px solid var(--ink-3); animation: rise .8s ease;
      h2 { font-size: 34px; margin: 6px 0 2px; } .dates { margin: 0; color: var(--ink-2); }
      .cause { margin: 14px 0 6px; color: var(--ink-2); } .epitaph { font-style: italic; margin: 0 0 16px; }
      .btn { margin-top: 18px; font-family: var(--font-body, inherit); } }
    .cross { width: 2px; height: 26px; margin: 8px auto 0; background: var(--ink-2); position: relative;
      &::after { content: ''; position: absolute; left: -7px; top: 7px; width: 16px; height: 2px; background: var(--ink-2); } }
    .facts-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin: 0; text-align: left; font-size: 13px;
      font-family: var(--font-body, inherit);
      div { padding: 6px 10px; border-radius: 8px; background: var(--surface-2); } dt { color: var(--ink-3); font-size: 11.5px; } dd { margin: 0; font-weight: 600; } }
    .timeline { list-style: none; padding: 0; margin: 16px 0 0; display: grid; gap: 4px; text-align: left; font-size: 12.5px; font-family: var(--font-body, inherit);
      li { padding-left: 10px; border-left: 3px solid var(--line); } .mono { margin-right: 6px; color: var(--ink-3); } .k-victoire { border-left-color: var(--good); } .k-revers { border-left-color: var(--bad); } .k-carriere { border-left-color: var(--accent); } }
    @keyframes rise { from { opacity: 0; transform: translateY(18px) scale(.97); } }
    @media (prefers-reduced-motion: reduce) { .chapter, .obit { animation: none; } }
    .topbar { flex-wrap: wrap; row-gap: 6px; }
    .save { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-2); white-space: nowrap;
      .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ink-3); } }
    .save.s-saved .dot { background: var(--good); }
    .save.s-saving .dot { background: var(--warn); animation: save-pulse .8s ease-in-out infinite; }
    .save.s-error { color: var(--bad); .dot { background: var(--bad); } }
    @keyframes save-pulse { 50% { opacity: .3; } }
    .phone-btn { position: relative; font-size: 15px; padding: 4px 10px;
      .badge { position: absolute; top: -6px; right: -6px; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px; background: var(--bad); color: #fff;
        font: 700 10.5px var(--font-body); display: grid; place-items: center; } }
    @media (max-width: 1200px) {
      .grid { grid-template-columns: 260px minmax(0, 1fr); }
      .col-right { grid-column: 1 / -1; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
    }
    .mobile-tabs { display: none; }
    @media (max-width: 820px) {
      .grid { grid-template-columns: 1fr; padding: 12px 12px calc(84px + env(safe-area-inset-bottom, 0px)); gap: 12px; }
      .col-left, .col-main, .col-right { gap: 12px; }
      .col-right { grid-template-columns: 1fr; }
      /* Une colonne à la fois */
      .grid[data-tab='agenda'] .col-left, .grid[data-tab='agenda'] .col-right,
      .grid[data-tab='moi'] .col-main, .grid[data-tab='moi'] .col-right,
      .grid[data-tab='actu'] .col-left, .grid[data-tab='actu'] .col-main { display: none; }
      /* Barre du haut compacte */
      .topbar { display: grid; grid-template-columns: auto 1fr auto auto auto; gap: 4px 10px; padding: 8px 12px; align-items: center; }
      .brand { font-size: 17px; }
      .facts { gap: 10px; font-size: 12px; flex-wrap: nowrap; overflow: hidden; }
      .facts > span:nth-child(n+2) { display: none; }
      .save .save-lbl { display: none; }
      .quit { padding: 4px 8px; }
      .brand { order: 1; } .facts { order: 2; } .save { order: 3; } .phone-btn { order: 4; } .quit { order: 5; justify-self: end; }
      app-vitals { grid-column: 1 / -1; order: 6; }
      .mobile-tabs {
        display: grid; grid-template-columns: repeat(3, 1fr); position: fixed; left: 0; right: 0; bottom: 0; z-index: 8;
        background: color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter: blur(10px);
        border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom, 0px);
      }
      .mobile-tabs button {
        position: relative; display: grid; justify-items: center; gap: 2px; padding: 8px 4px 9px; border: 0; background: none;
        font-size: 11.5px; font-weight: 500; color: var(--ink-3); cursor: pointer; min-height: 56px;
      }
      .mobile-tabs .ico { font-size: 19px; line-height: 1; filter: grayscale(1); opacity: .7; }
      .mobile-tabs button.on { color: var(--accent); .ico { filter: none; opacity: 1; } }
      .mobile-tabs button.on::before { content: ''; position: absolute; top: 0; left: 30%; right: 30%; height: 3px; border-radius: 0 0 3px 3px; background: var(--accent); }
      .badge { position: absolute; top: 5px; left: calc(50% + 8px); min-width: 17px; height: 17px; padding: 0 5px; border-radius: 999px;
        background: var(--bad); color: #fff; font-size: 10.5px; line-height: 17px; text-align: center; }
      .dot-badge { min-width: 9px; width: 9px; height: 9px; padding: 0; top: 7px; }
      .end { padding: 22px 18px; h2 { font-size: 25px; } }
      .obit { padding: 22px 16px; h2 { font-size: 28px; } }
      .facts-grid { grid-template-columns: 1fr; }
    }
  `,
})
export class DashboardComponent {
  protected readonly game = inject(GameStateService);
  protected readonly program = inject(ProgramService);

  /** Navigation mobile : agenda, profil, actualité */
  protected readonly tabs = [
    { id: 'agenda', label: 'Agenda', icon: '🗓️' },
    { id: 'moi', label: 'Profil', icon: '👤' },
    { id: 'actu', label: 'Actualité', icon: '📰' },
  ] as const;
  protected readonly tab = signal<'agenda' | 'moi' | 'actu'>('agenda');
  private readonly seenNews = signal(this.game.s().news[0]?.id ?? '');
  protected readonly unread = computed(() => this.tab() !== 'actu' && (this.game.s().news[0]?.id ?? '') !== this.seenNews());
  protected setTab(t: 'agenda' | 'moi' | 'actu'): void {
    if (t === 'actu' || this.tab() === 'actu') this.seenNews.set(this.game.s().news[0]?.id ?? '');
    this.tab.set(t);
    window.scrollTo({ top: 0 });
  }
  protected readonly builderHidden = signal(false);
  protected readonly budget = inject(BudgetService);
  protected readonly budgetOpen = signal(false);
  protected readonly team = inject(TeamService);
  protected readonly wealth = inject(PatrimoineService);
  protected readonly wealthOpen = signal(false);
  protected readonly bank = inject(BankService);
  protected readonly bankOpen = signal(false);
  private readonly fx = inject(FxService);
  private lastRank = this.game.player().rankId;
  private lastStatus = this.game.s().status;
  private lastMilestones = this.game.s().milestones.length;
  private lastAlien = this.game.s().alien?.phase ?? -1;
  /** Dernier chapitre ouvert, affiché en grand */
  protected readonly chapter = signal<Milestone | null>(null);
  protected readonly summary = () => lifeSummary(this.game.s());
  protected deathLabel(c: keyof typeof DEATH_LABELS) { return DEATH_LABELS[c]; }

  /** Promotions, victoire et défaite : tampon et confettis */
  private readonly celebrate = effect(() => {
    const rank = this.game.player().rankId;
    const status = this.game.s().status;
    const milestones = this.game.s().milestones;
    const alien = this.game.s().alien?.phase ?? -1;
    untracked(() => {
      if (alien > this.lastAlien) setTimeout(() => this.fx.ufo(alien === 0 ? 'Un signal venu des étoiles' : ALIEN_PHASES[alien]), 300);
      this.lastAlien = alien;
      if (milestones.length > this.lastMilestones && status !== 'mort') {
        const m = milestones.at(-1)!;
        setTimeout(() => {
          if (m.kind !== 'carriere') this.chapter.set(m);
          if (m.kind === 'victoire') { this.fx.stamp('Nouveau chapitre', 'good', m.title); this.burstAround(); }
          else if (m.kind === 'revers') { this.fx.stamp('Revers', 'bad', m.title); this.fx.shake(); this.fx.rain(); }
          else this.fx.stamp('Chapitre', 'neutral', m.title);
        }, 700);
      }
      this.lastMilestones = milestones.length;
      if (rank !== this.lastRank && RANKS[rank].order > RANKS[this.lastRank].order) {
        setTimeout(() => {
          this.fx.spotlight('Promotion !', RANKS[rank].label);
          this.burstAround();
        }, 400);
      }
      if (status !== this.lastStatus && status === 'mort') {
        setTimeout(() => { this.fx.stamp('In memoriam', 'bad', this.game.s().endTitle ?? ''); this.fx.rain(); }, 300);
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
  protected readonly phone = inject(PhoneService);
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

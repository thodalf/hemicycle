import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { ActionPlannerService } from '../../services/action-planner.service';
import { loanDebt, moneyHealth } from '../../engine/bankruptcy';
import { healthLabel } from '../../engine/life';

/** Fatigue = manque d'énergie + stress accumulé (0 = reposé, 100 = burn-out) */
export function fatigueOf(energy: number, stress: number): number {
  return Math.round(Math.max(0, Math.min(100, (100 - energy) * 0.55 + stress * 0.45)));
}

const LEVELS: { max: number; label: string; tone: string }[] = [
  { max: 25, label: 'Reposé·e', tone: 'good' },
  { max: 45, label: 'En forme', tone: 'good' },
  { max: 65, label: 'Fatigué·e', tone: 'warn' },
  { max: 80, label: 'Épuisé·e', tone: 'bad' },
  { max: 101, label: 'Burn-out imminent', tone: 'bad' },
];

/** Indicateurs vitaux de la barre du haut : fatigue et trésorerie personnelle */
@Component({
  selector: 'app-vitals',
  imports: [DecimalPipe],
  template: `
    <div class="vital fatigue" [class]="'tone-' + level().tone" [class.alarm]="projected() >= 80" [title]="tip()">
      <span class="eyebrow">Fatigue</span>
      <span class="gauge" aria-hidden="true">
        <span class="now" [style.width.%]="fatigue()"></span>
        @if (projected() > fatigue()) {
          <span class="plan" [style.left.%]="fatigue()" [style.width.%]="projected() - fatigue()"></span>
        }
      </span>
      <strong class="mono">{{ projected() }}</strong>
      <span class="lbl">{{ level().label }}</span>
      <span class="sr">Fatigue {{ projected() }} sur 100 : {{ level().label }}. Énergie {{ energy() }}, stress {{ stress() }}.</span>
    </div>
    <div class="vital health" [class]="'tone-' + healthInfo().tone" [class.alarm]="hp() < 30" [title]="healthTip()">
      <span class="eyebrow">Santé</span>
      <span class="gauge" aria-hidden="true"><span class="now" [style.width.%]="hp()"></span></span>
      <strong class="mono">{{ hp() }}</strong>
      <span class="lbl">{{ age() }} ans</span>
      <span class="sr">Santé {{ hp() }} sur 100 : {{ healthInfo().label }}. Âge : {{ age() }} ans.</span>
    </div>
    <div class="vital money" [class]="'h-' + health()" [title]="moneyTip()">
      <span class="eyebrow">Fonds</span>
      @for (f of [funds()]; track f) { <strong class="mono pulse" [class.gain]="trend() > 0" [class.loss]="trend() < 0">{{ f | number: '1.0-0' }} €</strong> }
      @if (health() === 'decouvert') { <span class="tag">Découvert</span> }
      @if (health() === 'danger') { <span class="tag">Banqueroute</span> }
    </div>
  `,
  styles: `
    :host { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
    .vital { display: flex; align-items: center; gap: 6px; font-size: 13px; padding: 3px 8px; border-radius: 999px; border: 1px solid transparent; }
    .gauge { position: relative; width: 74px; height: 7px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; }
    .now, .plan { position: absolute; top: 0; bottom: 0; left: 0; transition: width .5s ease, left .5s ease; }
    .now { background: var(--c, var(--good)); }
    .plan { background: repeating-linear-gradient(135deg, var(--c, var(--warn)) 0 3px, transparent 3px 6px); opacity: .7; }
    .tone-good { --c: var(--good); }
    .tone-warn { --c: var(--warn); }
    .tone-bad { --c: var(--bad); .lbl { color: var(--bad); font-weight: 600; } }
    .health .lbl { color: var(--ink-2); font-weight: 400; }
    .lbl { color: var(--ink-2); }
    .alarm { border-color: var(--bad); animation: alarm 1.4s ease-in-out infinite; }
    @media (prefers-reduced-motion: no-preference) { .pulse.gain { animation: gain .9s ease; } .pulse.loss { animation: loss .9s ease; } }
    @keyframes gain { 30% { color: var(--good); transform: scale(1.12); } }
    @keyframes loss { 30% { color: var(--bad); transform: translateX(-3px); } 50% { transform: translateX(3px); } }
    .pulse { display: inline-block; }
    .money .tag { font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 999px; background: var(--bad); color: var(--surface); }
    .h-tendu strong { color: var(--warn); }
    .h-decouvert strong, .h-danger strong { color: var(--bad); }
    .h-danger { border-color: var(--bad); animation: alarm 1s ease-in-out infinite; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    @keyframes alarm { 0%, 100% { box-shadow: 0 0 0 0 transparent; } 50% { box-shadow: 0 0 0 4px var(--bad-soft); } }
    @media (prefers-reduced-motion: reduce) { .alarm, .h-danger { animation: none; } }
    @media (max-width: 820px) { .lbl { display: none; } }
    @media (max-width: 640px) {
      :host { gap: 4px; justify-content: space-between; flex-wrap: nowrap; }
      .vital { gap: 5px; padding: 2px 4px; font-size: 12px; }
      .vital .eyebrow { font-size: 9.5px; letter-spacing: .04em; }
      .gauge { width: 34px; }
      .money .tag { font-size: 10px; padding: 1px 5px; }
    }
  `,
})
export class VitalsComponent {
  private readonly game = inject(GameStateService);
  private readonly planner = inject(ActionPlannerService);

  protected readonly energy = computed(() => Math.round(this.game.stats().energy));
  protected readonly stress = computed(() => Math.round(this.game.stats().stress));
  protected readonly fatigue = computed(() => fatigueOf(this.energy(), this.stress()));
  /** Fatigue une fois l'agenda du mois exécuté */
  protected readonly projected = computed(() => {
    const cost = this.planner.spent().energy;
    return fatigueOf(this.energy() - cost, this.stress() + cost / 3);
  });
  protected readonly level = computed(() => LEVELS.find(l => this.projected() < l.max)!);
  protected readonly tip = computed(() =>
    `Énergie ${this.energy()} · stress ${this.stress()}` +
    (this.projected() !== this.fatigue() ? ` · après votre agenda : ${this.projected()}` : '') +
    ' · Au-delà de 80, le burn-out guette (stress 95 : mois perdu). Un stress élevé use le cœur : risque d’infarctus.');

  protected readonly hp = computed(() => Math.round(this.game.player().health));
  protected readonly age = computed(() => Math.floor(this.game.player().age));
  protected readonly healthInfo = computed(() => healthLabel(this.hp()));
  protected readonly healthTip = computed(() => `${this.healthInfo().label} · ${this.age()} ans · Sous 38, alertes médicales ; plus la santé est basse, plus le risque de mourir grimpe.`);

  protected readonly funds = computed(() => this.game.player().finances.personal);
  private lastFunds: number | null = null;
  /** Sens de la dernière variation des fonds (pour l'animation) */
  protected readonly trend = computed(() => {
    const f = this.funds();
    const prev = this.lastFunds;
    this.lastFunds = f;
    return prev === null ? 0 : Math.sign(f - prev);
  });
  protected readonly health = computed(() => moneyHealth(this.game.s()));
  protected readonly moneyTip = computed(() => {
    const debt = loanDebt(this.game.s());
    const weeks = Number(this.game.player().flags['overdraftWeeks'] ?? 0);
    return `Fonds personnels${debt ? ` · prêts à rembourser : ${debt.toLocaleString('fr-FR')} €` : ''}` +
      (weeks ? ` · découvert depuis ${weeks} mois` : '') +
      ' · Découvert prolongé (2 mois) ou supérieur à 12 000 € : procédure de banqueroute.';
  });
}

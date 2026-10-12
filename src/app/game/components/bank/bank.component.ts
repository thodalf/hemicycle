import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, output, signal } from '@angular/core';
import { LoanKind } from '../../models/game.models';
import { LoanOffer, loanCost, monthlyPayment } from '../../engine/loans';
import { durationLabel } from '../../engine/calendar';
import { BankService } from '../../services/bank.service';
import { GameStateService } from '../../services/game-state.service';
import { FxService } from '../../services/fx.service';

/** La banque : emprunter (pour soi ou pour la campagne), suivre et solder ses prêts */
@Component({
  selector: 'app-bank',
  imports: [DecimalPipe],
  template: `
    <div class="overlay" role="dialog" aria-modal="true" aria-label="Banque et emprunts">
      <section class="sheet">
        <header class="head">
          <div>
            <span class="eyebrow">Finances</span>
            <h2>Banque &amp; emprunts</h2>
          </div>
          <button class="btn small" (click)="closed.emit()">Fermer</button>
        </header>

        <div class="kpis">
          <div class="kpi"><span class="eyebrow">Fonds personnels</span><strong class="mono">{{ game.player().finances.personal | number: '1.0-0' }} €</strong></div>
          <div class="kpi"><span class="eyebrow">Compte de campagne</span><strong class="mono">{{ game.player().finances.campaign | number: '1.0-0' }} €</strong>
            <small class="muted">{{ game.player().finances.legalCeiling !== null ? 'Campagne en cours' : 'Hors campagne' }}</small></div>
          <div class="kpi"><span class="eyebrow">Reste à rembourser</span><strong class="mono">{{ bank.debt() | number: '1.0-0' }} €</strong></div>
          <div class="kpi"><span class="eyebrow">Mensualités</span><strong class="mono">{{ bank.monthly() | number: '1.0-0' }} €/mois</strong>
            <div class="ratio" [class.over]="bank.ratio() > bank.maxRatio"><span [style.width.%]="Math.min(100, bank.ratio() / bank.maxRatio * 100)"></span></div>
            <small class="muted">{{ bank.ratio() * 100 | number: '1.0-0' }} % de vos revenus (35 % max.)</small></div>
          <div class="kpi"><span class="eyebrow">Solidité financière</span><strong class="mono" [class.bad-t]="bank.score() < 40" [class.good-t]="bank.score() >= 65">{{ bank.score() }}/100</strong>
            <small class="muted">Crédibilité, épargne, dettes, faillites passées</small></div>
        </div>

        <div class="cols">
          <div class="col">
            <h3>Offres</h3>
            <ul class="offers">
              @for (o of bank.offers(); track o.kind) {
                @let a = amountOf(o);
                @let m = monthsOf(o);
                <li [class.disabled]="!o.ok" [class.campaign]="o.account === 'campaign'">
                  <div class="o-head">
                    <strong>{{ o.title }}</strong>
                    <span class="chip" [class.accent]="o.account === 'campaign'">{{ o.account === 'campaign' ? 'Compte de campagne' : 'Fonds perso' }}</span>
                  </div>
                  <small class="muted">{{ o.lender }} · {{ o.description }}</small>
                  @if (o.ok) {
                    <label class="amount">
                      <span>Montant</span>
                      <input type="range" [min]="o.min" [max]="o.max" [step]="step(o)" [value]="a" (input)="setAmount(o.kind, $any($event.target).valueAsNumber)" [attr.aria-label]="'Montant : ' + o.title" />
                      <strong class="mono">{{ a | number: '1.0-0' }} €</strong>
                    </label>
                    <div class="durations" role="group" [attr.aria-label]="'Durée : ' + o.title">
                      @for (d of o.durations; track d) {
                        <button type="button" [class.on]="d === m" (click)="setMonths(o.kind, d)">{{ label(d) }}</button>
                      }
                    </div>
                    <div class="terms mono">
                      <span>Taux {{ o.rate * 100 | number: '1.1-1' }} %</span>
                      <span>{{ pay(o) | number: '1.0-0' }} €/mois</span>
                      <span>Coût {{ cost(o) | number: '1.0-0' }} €</span>
                    </div>
                    @if (o.strings) { <small class="strings">{{ o.strings }}</small> }
                    <button class="btn small primary" (click)="take(o, $event)">Emprunter {{ a | number: '1.0-0' }} €</button>
                  } @else {
                    <small class="why">{{ o.reason }}</small>
                  }
                </li>
              }
            </ul>
            @if (game.player().finances.legalCeiling === null) {
              <p class="note muted">Pendant une campagne électorale, deux offres de plus : le prêt de campagne (remboursé par l’État si vous dépassez 5 % des voix) et l’avance du parti.</p>
            }
          </div>
          <div class="col">
            <h3>Prêts en cours</h3>
            <ul class="loans">
              @for (l of bank.loans(); track l.id) {
                <li [class.new]="l.startWeek === game.week()">
                  <div class="o-head"><strong>{{ l.lender }}</strong><span class="mono">{{ l.monthly | number: '1.0-0' }} €/mois</span></div>
                  <div class="bar"><span [style.width.%]="(1 - l.remaining / l.principal) * 100"></span></div>
                  <small class="muted">{{ l.remaining | number: '1.0-0' }} € restants sur {{ l.principal | number: '1.0-0' }} € · {{ l.rate * 100 | number: '1.1-1' }} % · {{ l.account === 'campaign' ? 'compte de campagne' : 'fonds perso' }} · depuis {{ game.month(l.startWeek) }}</small>
                  <button class="btn small" [disabled]="!bank.canRepay(l.id)" (click)="repay(l.id)">Solder ({{ bank.repayCost(l.id) | number: '1.0-0' }} €)</button>
                </li>
              } @empty {
                <li class="empty muted">Aucun prêt en cours.</li>
              }
            </ul>
            @if (said().length) { <p class="said">{{ said().join(' · ') }}</p> }
            <p class="note muted">Les mensualités sont prélevées à chaque fin de mois. Un découvert prolongé déclenche agios, procédure bancaire, voire faillite personnelle.</p>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: `
    .overlay { position: fixed; inset: 0; z-index: 20; overflow-y: auto; background: rgba(10, 12, 18, .6); backdrop-filter: blur(3px);
      display: grid; justify-items: center; align-items: start; padding: max(24px, env(safe-area-inset-top, 0px)) 16px 32px; }
    .sheet { width: 100%; max-width: 1040px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
      box-shadow: 0 24px 60px -20px rgba(0,0,0,.55); overflow: hidden; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 14px 20px; border-bottom: 1px solid var(--line);
      h2 { font-size: 24px; margin-top: 2px; } }
    .kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; padding: 14px 20px; background: var(--surface-2); border-bottom: 1px solid var(--line); }
    .kpi { display: grid; gap: 3px; align-content: start; strong { font-size: 18px; } small { font-size: 11.5px; } }
    .ratio { height: 5px; border-radius: 3px; background: var(--surface); border: 1px solid var(--line); overflow: hidden;
      span { display: block; height: 100%; background: var(--good); transition: width .5s; } }
    .ratio.over span { background: var(--bad); }
    .good-t { color: var(--good); } .bad-t { color: var(--bad); }
    .cols { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, .9fr); gap: 24px; padding: 16px 20px 20px; }
    .col { display: grid; gap: 10px; align-content: start; min-width: 0; h3 { font-size: 17px; margin-top: 4px; } }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .offers li, .loans li { display: grid; gap: 6px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; }
    .offers li.campaign { border-left: 4px solid var(--accent); }
    .offers li.disabled { opacity: .65; }
    .loans li { background: var(--surface-2); }
    .loans li.new { animation: glow 1.6s ease; }
    @keyframes glow { 0% { box-shadow: 0 0 0 3px var(--good); } 100% { box-shadow: 0 0 0 0 transparent; } }
    .loans li.empty { display: block; background: none; border-style: dashed; font-size: 13px; }
    .o-head { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
    .amount { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; font-size: 12.5px;
      input { width: 100%; accent-color: var(--accent); } strong { min-width: 84px; text-align: right; } }
    .durations { display: flex; flex-wrap: wrap; gap: 4px;
      button { border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 4px 10px; font: inherit; font-size: 12px; cursor: pointer; color: var(--ink-2); }
      button.on { background: var(--accent); border-color: var(--accent); color: var(--surface); } }
    .terms { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12.5px; }
    .strings { color: var(--warn); }
    .why { color: var(--bad); }
    .bar { height: 6px; border-radius: 3px; background: var(--surface); border: 1px solid var(--line); overflow: hidden;
      span { display: block; height: 100%; background: var(--good); transition: width .5s; } }
    .btn { justify-self: start; }
    .note { font-size: 12px; margin: 0; }
    .said { margin: 0; font-size: 12.5px; padding: 8px 10px; border-radius: 8px; background: var(--good-soft); }
    @media (max-width: 860px) { .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .cols { grid-template-columns: 1fr; } }
  `,
})
export class BankComponent {
  protected readonly game = inject(GameStateService);
  protected readonly bank = inject(BankService);
  private readonly fx = inject(FxService);
  readonly closed = output<void>();
  protected readonly Math = Math;
  private readonly amounts = signal<Partial<Record<LoanKind, number>>>({});
  private readonly months = signal<Partial<Record<LoanKind, number>>>({});
  protected readonly said = signal<string[]>([]);

  protected step(o: LoanOffer): number {
    return o.max - o.min > 20000 ? 1000 : o.max - o.min > 4000 ? 500 : 100;
  }
  protected amountOf(o: LoanOffer): number {
    const v = this.amounts()[o.kind] ?? Math.round(((o.min + o.max) / 2) / this.step(o)) * this.step(o);
    return Math.min(o.max, Math.max(o.min, v));
  }
  protected monthsOf(o: LoanOffer): number {
    const m = this.months()[o.kind];
    return m && o.durations.includes(m) ? m : o.durations[Math.min(1, o.durations.length - 1)];
  }
  protected setAmount(kind: LoanKind, v: number): void { this.amounts.update(a => ({ ...a, [kind]: v })); }
  protected setMonths(kind: LoanKind, v: number): void { this.months.update(a => ({ ...a, [kind]: v })); }
  protected label(m: number): string { return durationLabel(m); }
  protected pay(o: LoanOffer): number { return monthlyPayment(this.amountOf(o), o.rate, this.monthsOf(o)); }
  protected cost(o: LoanOffer): number { return loanCost(this.amountOf(o), o.rate, this.monthsOf(o)); }

  protected take(o: LoanOffer, ev: Event): void {
    const out = this.bank.borrow(o.kind, this.amountOf(o), this.monthsOf(o));
    this.said.set(out);
    if (out.length) {
      this.fx.banknotes(document.querySelector('app-vitals .money'), 7);
      this.fx.floatAt(ev.currentTarget as Element, out[0], 'good');
    }
  }

  protected repay(id: string): void {
    const out = this.bank.repay(id);
    this.said.set(out);
    if (out.length) this.fx.coins(document.querySelector('app-vitals .money'), false, 6);
  }
}

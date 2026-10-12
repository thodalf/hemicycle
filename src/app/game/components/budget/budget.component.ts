import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, output, signal } from '@angular/core';
import { MissionId, PartyLine, TaxId } from '../../models/game.models';
import { MISSIONS, MISSION_RANGE, PARTY_FIXED_COSTS, PARTY_LINES, TAXES } from '../../data/budget';
import { stanceLabel } from '../../data/world';
import { BudgetService } from '../../services/budget.service';
import { GameStateService } from '../../services/game-state.service';
import { StanceAxisComponent, StanceMarker } from '../stance-axis/stance-axis.component';

type Tab = 'parti' | 'etat';

/** Écran des budgets : trésorerie du parti et loi de finances */
@Component({
  selector: 'app-budget',
  imports: [DecimalPipe, StanceAxisComponent],
  templateUrl: './budget.component.html',
  styleUrl: './budget.component.scss',
})
export class BudgetComponent {
  protected readonly game = inject(GameStateService);
  protected readonly svc = inject(BudgetService);
  readonly closed = output<void>();

  protected readonly tab = signal<Tab>(this.svc.stateAccess() && this.svc.national()?.pending ? 'etat' : this.svc.partyAccess() ? 'parti' : 'etat');
  protected readonly lines = PARTY_LINES;
  protected readonly fixed = PARTY_FIXED_COSTS;
  protected readonly missions = MISSIONS;
  protected readonly taxes = TAXES;
  protected readonly range = MISSION_RANGE;

  /** Courbe de trésorerie (12 derniers mois) */
  protected readonly spark = computed(() => {
    const h = this.svc.party()?.history ?? [];
    if (h.length < 2) return null;
    const values = h.map(x => x.treasury);
    const min = Math.min(0, ...values), max = Math.max(...values, 1);
    const pts = values.map((v, i) => [(i / (values.length - 1)) * 240, 56 - ((v - min) / (max - min)) * 48 - 4]);
    const line = pts.map(p => p.join(',')).join(' ');
    const zero = 56 - ((0 - min) / (max - min)) * 48 - 4;
    return { line, area: `0,${zero} ${line} 240,${zero}`, zero, last: pts.at(-1)!, min, max };
  });

  protected readonly axis = computed<StanceMarker[]>(() => {
    const r = this.svc.nationalReport();
    return [
      { label: 'Budget', value: r?.position ?? 0, color: 'var(--ink)', row: 'top' },
      { label: 'Parti', value: this.game.s().party.position, color: this.game.s().party.color, row: 'bottom' },
    ];
  });

  protected missionValue(id: MissionId) { return this.svc.national()?.draft.missions[id] ?? 0; }
  protected taxValue(id: TaxId) { return this.svc.national()?.draft.taxes[id] ?? 0; }
  protected missionPct(id: MissionId, base: number) { return Math.round(((this.missionValue(id) - base) / base) * 100); }
  protected stance(v: number) { return stanceLabel(v); }
  protected keur(v: number) {
    return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(2).replace('.', ',')} M€` : `${Math.round(v)} k€`;
  }
  protected md(v: number) { return `${v.toFixed(1).replace('.', ',')} Md€`; }
  protected signed(n: number) { return n > 0 ? `+${n}` : `${n}`; }
  protected num(e: Event) { return +(e.target as HTMLInputElement).value; }
  protected setLine(id: PartyLine, e: Event) { this.svc.setAllocation(id, this.num(e)); }
}

import { Injectable, computed, inject } from '@angular/core';
import { MissionId, PartyLine, TaxId } from '../models/game.models';
import { PARTY_LINES } from '../data/budget';
import {
  partyScale,
  canHandleNationalBudget, force493, nationalReport, partyReport, playerLeadsParty, resetDraft, reviseBudget,
  setMission, setTax, submitBudget, budgetRoleNote,
} from '../engine/budget';
import { partySupport } from '../engine/effects';
import { GameStateService } from './game-state.service';

/** Budget du parti et loi de finances */
@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly game = inject(GameStateService);

  readonly partyAccess = computed(() => {
    const s = this.game.state();
    return !!s?.partyFinance && playerLeadsParty(s);
  });
  readonly stateAccess = computed(() => {
    const s = this.game.state();
    return !!s && (canHandleNationalBudget(s) || !!s.nationalBudget);
  });
  readonly anyAccess = computed(() => this.partyAccess() || this.stateAccess());
  readonly roleNote = computed(() => { const s = this.game.state(); return s ? budgetRoleNote(s) : null; });

  readonly party = computed(() => this.game.state()?.partyFinance ?? null);
  readonly partyReport = computed(() => {
    const s = this.game.state();
    return s ? partyReport(s) : null;
  });

  readonly national = computed(() => this.game.state()?.nationalBudget ?? null);
  readonly nationalReport = computed(() => {
    const s = this.game.state();
    return s ? nationalReport(s) : null;
  });
  readonly canEditNational = computed(() => {
    const s = this.game.state();
    return !!s?.nationalBudget?.pending && canHandleNationalBudget(s) && !s.nationalBudget.rejected;
  });
  readonly censureRisk = computed(() => {
    const s = this.game.state();
    return s ? Math.round(Math.max(0.05, Math.min(0.6, 0.2 + (50 - partySupport(s)) / 200)) * 100) : 0;
  });

  /** Taille du parti (1 = grand parti historique) : borne les curseurs */
  readonly scale = computed(() => { const s = this.game.state(); return s ? partyScale(s) : 1; });

  setAllocation(line: PartyLine, value: number): void {
    const def = PARTY_LINES.find(l => l.id === line)!;
    this.game.mutate(d => {
      const k = partyScale(d);
      if (d.partyFinance) d.partyFinance.allocations[line] = Math.max(def.min * k, Math.min(def.max * k, Math.round(value * 10) / 10));
    });
  }

  setFee(value: number): void {
    this.game.mutate(d => { if (d.partyFinance) d.partyFinance.fee = Math.max(10, Math.min(100, Math.round(value))); });
  }

  setMission(id: MissionId, value: number): void { this.game.mutate(d => setMission(d, id, value)); }
  setTax(id: TaxId, value: number): void { this.game.mutate(d => setTax(d, id, value)); }
  reset(): void { this.game.mutate(d => resetDraft(d)); }
  submit(): void { this.game.mutate((d, rng) => { submitBudget(d, rng); }); }
  force493(): void { this.game.mutate((d, rng) => force493(d, rng)); }
  revise(): void { this.game.mutate((d, rng) => reviseBudget(d, rng)); }
}

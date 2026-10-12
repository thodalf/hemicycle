import { Injectable, computed, inject } from '@angular/core';
import { LoanKind } from '../models/game.models';
import { RANKS } from '../data/ranks';
import { MAX_DEBT_RATIO, borrow, creditScore, loanDebt, loanOffers, loanPayments, repayCost, repayLoan } from '../engine/loans';
import { GameStateService } from './game-state.service';

/** Façade des emprunts : offres du moment, prêts en cours, remboursements */
@Injectable({ providedIn: 'root' })
export class BankService {
  private readonly game = inject(GameStateService);

  readonly offers = computed(() => loanOffers(this.game.s()));
  readonly loans = computed(() => this.game.s().player.loans ?? []);
  readonly debt = computed(() => loanDebt(this.game.s()));
  readonly monthly = computed(() => loanPayments(this.game.s()));
  readonly score = computed(() => creditScore(this.game.s()));
  /** Part des revenus mensuels consacrée aux mensualités */
  readonly ratio = computed(() => this.monthly() / RANKS[this.game.s().player.rankId].monthlyIncome);
  readonly maxRatio = MAX_DEBT_RATIO;

  borrow(kind: LoanKind, amount: number, months: number): string[] {
    let out: string[] = [];
    this.game.mutate(d => { out = borrow(d, kind, amount, months); });
    return out;
  }

  repayCost(id: string): number {
    const l = this.loans().find(x => x.id === id);
    return l ? repayCost(l) : 0;
  }

  canRepay(id: string): boolean {
    const s = this.game.s();
    const l = s.player.loans.find(x => x.id === id);
    if (!l) return false;
    const fromCampaign = l.account === 'campaign' ? Math.max(0, s.player.finances.campaign) : 0;
    return s.player.finances.personal + fromCampaign >= repayCost(l);
  }

  repay(id: string): string[] {
    let out: string[] = [];
    this.game.mutate(d => { out = repayLoan(d, id); });
    return out;
  }
}

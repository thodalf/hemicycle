import { Injectable, computed, inject, signal } from '@angular/core';
import { Recruit, StaffRole } from '../models/game.models';
import { dismissCandidate, fireRecruit, headhunt, headhuntCheck, headhuntFee, hireCheck, hireRecruit, openBooster, payroll } from '../engine/recruits';
import { STAFF } from '../data/staff';
import { rankOrder } from '../data/ranks';
import { GameStateService } from './game-state.service';

/** Équipe, vivier de candidats et boosters */
@Injectable({ providedIn: 'root' })
export class TeamService {
  private readonly game = inject(GameStateService);

  readonly team = computed(() => this.game.player().team);
  readonly pool = computed(() => this.game.player().pool);
  readonly boosters = computed(() => this.game.player().boosters);
  readonly payroll = computed(() => payroll(this.game.s()));
  /** Cartes du dernier booster ouvert (affichées dans l'écran d'ouverture) */
  readonly revealed = signal<Recruit[] | null>(null);

  check(r: Recruit) { return hireCheck(this.game.s(), r); }
  occupant(r: Recruit) { return this.team().find(x => x.role === r.role) ?? null; }

  open(): void {
    let cards: Recruit[] = [];
    this.game.mutate((d, rng) => { cards = openBooster(d, rng); });
    if (cards.length) this.revealed.set(cards);
  }

  /** Organigramme : chaque poste, son titulaire ou sa vacance */
  readonly posts = computed(() => {
    const s = this.game.s();
    return STAFF.map(def => ({
      def, holder: s.player.team.find(r => r.role === def.role) ?? null,
      unlocked: rankOrder(s.player.rankId) >= rankOrder(def.minRank),
      hunt: headhuntCheck(s, def.role), fee: headhuntFee(def.role),
    }));
  });

  headhunt(role: StaffRole): boolean {
    let ok = false;
    this.game.mutate((d, rng) => { ok = !!headhunt(d, role, rng); });
    return ok;
  }

  hire(id: string): void { this.game.mutate(d => hireRecruit(d, id)); }
  fire(id: string): void { this.game.mutate(d => fireRecruit(d, id)); }
  dismiss(id: string): void { this.game.mutate(d => dismissCandidate(d, id)); }
}

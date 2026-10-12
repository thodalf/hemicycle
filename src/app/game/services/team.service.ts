import { Injectable, computed, inject, signal } from '@angular/core';
import { Recruit } from '../models/game.models';
import { dismissCandidate, fireRecruit, hireCheck, hireRecruit, openBooster, payroll } from '../engine/recruits';
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

  hire(id: string): void { this.game.mutate(d => hireRecruit(d, id)); }
  fire(id: string): void { this.game.mutate(d => fireRecruit(d, id)); }
  dismiss(id: string): void { this.game.mutate(d => dismissCandidate(d, id)); }
}

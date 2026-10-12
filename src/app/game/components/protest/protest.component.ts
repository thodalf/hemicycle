import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { DOMAIN_LABELS, ProtestChoice, ProtestPhase } from '../../models/game.models';
import { allyCandidates, canGoNational, choiceAvailable, expectedTurnout, failChance, protestScore } from '../../engine/protest';
import { GameStateService } from '../../services/game-state.service';
import { ProtestService } from '../../services/protest.service';

const STEPS: { id: ProtestPhase; label: string }[] = [
  { id: 'preparation', label: 'Préparation' },
  { id: 'mobilisation', label: 'Mobilisation' },
  { id: 'cortege', label: 'Cortège' },
  { id: 'incident', label: 'Imprévu' },
  { id: 'discours', label: 'Discours' },
  { id: 'bilan', label: 'Bilan' },
];

/**
 * Manifestation : préparation (cause, échelle, alliés) puis quatre étapes à choix.
 * Les jauges réagissent à chaque décision ; à 80 de tension, c'est le débordement.
 */
@Component({
  selector: 'app-protest',
  imports: [DecimalPipe],
  templateUrl: './protest.component.html',
  styleUrl: './protest.component.scss',
})
export class ProtestComponent {
  protected readonly game = inject(GameStateService);
  protected readonly svc = inject(ProtestService);
  protected readonly steps = STEPS;

  protected readonly p = computed(() => this.svc.protest()!);
  protected readonly stepIndex = computed(() => STEPS.findIndex(s => s.id === this.p().phase));
  protected readonly national = computed(() => canGoNational(this.game.s()));
  protected readonly allies = computed(() => allyCandidates(this.game.s(), this.p()));
  protected readonly estimate = computed(() => expectedTurnout(this.p(), this.game.s()));
  protected readonly score = computed(() => protestScore(this.p()));
  protected readonly turnoutRatio = computed(() => Math.min(100, (this.p().turnout / Math.max(1, this.p().target)) * 50));
  protected readonly log = computed(() => [...this.p().log].reverse());

  protected domain(id: keyof typeof DOMAIN_LABELS) { return DOMAIN_LABELS[id]; }
  protected leanLabel(lean: number) { return lean < 0 ? 'Cause de gauche' : lean > 0 ? 'Cause de droite' : 'Transpartisane'; }
  protected available(c: ProtestChoice) { return choiceAvailable(this.p(), this.game.s(), c); }
  protected success(c: ProtestChoice) {
    const f = failChance(this.p(), this.game.s(), c);
    return f === null ? null : Math.round((1 - f) * 100);
  }
  protected reason(c: ProtestChoice): string {
    if (c.requires?.ally && !this.p().allies.length) return 'Aucun allié';
    if (c.requires?.minMastery !== undefined) return `Dossier < ${c.requires.minMastery}`;
    return 'Fonds insuffisants';
  }
  protected signed(n: number) { return n > 0 ? `+${n}` : `${n}`; }

  /** Aperçu des effets en cas de réussite */
  protected effects(c: ProtestChoice): string {
    const d = c.delta;
    const parts: string[] = [];
    if (d.turnout) parts.push(`Affluence ${this.signed(d.turnout)} %`);
    if (d.tension) parts.push(`Tension ${this.signed(d.tension)}`);
    if (d.media) parts.push(`Médias ${this.signed(d.media)}`);
    if (d.image) parts.push(`Image ${this.signed(d.image)}`);
    if (d.money) parts.push(`−${d.money} €`);
    return parts.join(' · ');
  }
}

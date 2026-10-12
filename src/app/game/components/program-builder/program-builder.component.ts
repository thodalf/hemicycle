import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, output, signal } from '@angular/core';
import { DOMAIN_LABELS, ProgramOption, ProgramQuestion } from '../../models/game.models';
import { PROGRAM, SEGMENTS } from '../../data/programme';
import { stanceLabel } from '../../data/world';
import { COHERENCE_LABELS, FUNDING_LABELS } from '../../engine/programme';
import { GameStateService } from '../../services/game-state.service';
import { ProgramService } from '../../services/program.service';
import { StanceAxisComponent, StanceMarker } from '../stance-axis/stance-axis.component';

/**
 * Programme présidentiel : 20 questions, 4 options.
 * Le panneau de droite montre en direct la position, le coût, la cohérence,
 * l'effet sur les électorats et la réaction des courants du parti.
 */
@Component({
  selector: 'app-program-builder',
  imports: [DecimalPipe, StanceAxisComponent],
  templateUrl: './program-builder.component.html',
  styleUrl: './program-builder.component.scss',
})
export class ProgramBuilderComponent {
  protected readonly game = inject(GameStateService);
  protected readonly program = inject(ProgramService);
  readonly closed = output<void>();

  protected readonly questions = PROGRAM;
  protected readonly groups = [...new Set(PROGRAM.map(q => q.domain))].map(domain => ({
    domain, label: DOMAIN_LABELS[domain],
    items: PROGRAM.map((q, index) => ({ q, index })).filter(x => x.q.domain === domain),
  }));

  protected readonly index = signal(this.firstUnanswered());
  protected readonly current = computed(() => PROGRAM[this.index()]);
  protected readonly report = this.program.report;
  protected readonly complete = computed(() => this.report().answered === this.report().total);

  protected readonly axis = computed<StanceMarker[]>(() => [
    { label: 'Programme', value: this.report().position, color: 'var(--ink)', row: 'top' },
    { label: 'Parti', value: this.game.s().party.position, color: this.game.s().party.color, row: 'bottom' },
    { label: 'Électorat', value: 0, color: 'var(--ink-3)', row: 'bottom' },
  ]);

  protected readonly segmentRows = computed(() =>
    this.report().segments.map(s => ({ ...s, width: Math.min(100, Math.abs(s.score) / 15 * 100) / 2 })));

  protected choose(q: ProgramQuestion, o: ProgramOption): void {
    this.program.answer(q.id, o.id);
    const next = this.nextUnanswered(this.index());
    if (next !== null) setTimeout(() => this.index.set(next), 160);
  }

  protected go(delta: number): void {
    this.index.set(Math.max(0, Math.min(PROGRAM.length - 1, this.index() + delta)));
  }

  protected selected(q: ProgramQuestion): string | undefined {
    return this.program.answers()[q.id];
  }

  protected stance(v: number) { return stanceLabel(v); }
  protected side(v: number) { return v <= -20 ? 'left' : v >= 20 ? 'right' : 'centre'; }
  protected domainLabel(q: ProgramQuestion) { return DOMAIN_LABELS[q.domain]; }
  protected coherenceLabel() { return COHERENCE_LABELS[this.report().coherence]; }
  protected fundingLabel() { return FUNDING_LABELS[this.report().funding]; }
  protected cost(n: number) { return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} Md€/an`; }

  protected appeal(o: ProgramOption): { pleases: string; worries: string } {
    const label = (id: string) => SEGMENTS.find(s => s.id === id)!.label;
    const entries = Object.entries(o.appeal);
    return {
      pleases: entries.filter(([, v]) => v! > 0).sort((a, b) => b[1]! - a[1]!).map(([k]) => label(k)).join(', '),
      worries: entries.filter(([, v]) => v! < 0).sort((a, b) => a[1]! - b[1]!).map(([k]) => label(k)).join(', '),
    };
  }

  protected present(): void {
    this.program.validate();
    this.closed.emit();
  }

  private firstUnanswered(): number {
    const answers = this.program.answers();
    const i = PROGRAM.findIndex(q => !answers[q.id]);
    return i < 0 ? 0 : i;
  }

  private nextUnanswered(from: number): number | null {
    const answers = this.program.answers();
    for (let k = 1; k <= PROGRAM.length; k++) {
      const i = (from + k) % PROGRAM.length;
      if (!answers[PROGRAM[i].id]) return i;
    }
    return null;
  }
}

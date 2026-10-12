import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { DOMAIN_LABELS, DebateCard, DebateMove } from '../../models/game.models';
import { MOVE_LABELS, currentStance, previewOutcome } from '../../engine/debate';
import { stanceLabel } from '../../data/world';
import { StanceAxisComponent, StanceMarker } from '../stance-axis/stance-axis.component';
import { DebateService } from '../../services/debate.service';
import { GameStateService } from '../../services/game-state.service';

const PROFILE: Record<DebateMove, string> = {
  faits: 'Technicien : il aime les chiffres',
  attaque: 'Bretteur : il cherche la faute',
  emotion: 'Tribun : il joue sur l’émotion',
  parade: 'Esquiveur : il fuit l’affrontement',
};

/**
 * Débat au tour par tour.
 * Chaque manche a un sujet ; l'adversaire prépare un coup (parfois deviné).
 * Le joueur choisit une carte de sa main : le triangle Faits > Émotion > Attaque > Faits
 * et la maîtrise des dossiers décident de l'issue.
 */
@Component({
  selector: 'app-debate-arena',
  imports: [DecimalPipe, NgTemplateOutlet, StanceAxisComponent],
  templateUrl: './debate-arena.component.html',
  styleUrl: './debate-arena.component.scss',
})
export class DebateArenaComponent {
  protected readonly game = inject(GameStateService);
  protected readonly svc = inject(DebateService);

  protected readonly d = computed(() => this.svc.debate()!);
  protected readonly moveLabels = MOVE_LABELS;

  protected readonly initials = computed(() => initials(this.game.player().name));
  protected readonly oppInitials = computed(() => initials(this.d().opponentName));
  protected readonly topicLabel = computed(() => {
    const t = this.svc.topic();
    return t ? DOMAIN_LABELS[t] : '';
  });

  /** Remplissage de la jauge d'audience depuis le centre */
  protected readonly meter = computed(() => {
    const a = this.d().audience;
    return { width: Math.abs(a) / 2, side: a >= 0 ? 'left' : 'right' };
  });

  protected readonly profile = computed(() => {
    const style = this.d().oppStyle;
    const top = (Object.keys(style) as DebateMove[]).sort((a, b) => style[b] - style[a])[0];
    return PROFILE[top];
  });

  protected readonly crowd = computed(() => stanceLabel(this.d().audienceLean));

  protected readonly axis = computed<StanceMarker[]>(() => {
    const d = this.d();
    return [
      { label: 'Vous', value: currentStance(d), color: 'var(--ink)', row: 'top' },
      { label: 'Public', value: d.audienceLean, color: 'var(--ink-3)', row: 'bottom' },
      { label: d.opponentName.split(' ')[0], value: d.oppLean, color: d.opponentColor, row: 'bottom' },
    ];
  });

  protected readonly impact = computed(() => {
    const d = this.d();
    return this.game.s().party.factions.map(f => ({
      id: f.id, name: f.name, position: stanceLabel(f.position),
      delta: Math.max(-12, Math.min(12, Math.round(d.partyImpact[f.id]))),
    }));
  });

  protected readonly recentLog = computed(() => [...this.d().log].reverse());

  protected readonly verdict = computed(() => {
    const d = this.d();
    const titles = { gagne: 'Victoire', perdu: 'Défaite', nul: 'Match nul', en_cours: '' };
    return { title: titles[d.status] + (d.ko ? ' par K.-O.' : ''), tone: d.status };
  });

  protected power(card: DebateCard) {
    return this.svc.power(card);
  }

  protected preview(card: DebateCard): 'gagne' | 'perdu' | 'egal' | null {
    const d = this.d();
    return d.intentRevealed ? previewOutcome(card, d.oppIntent) : null;
  }

  protected domainLabel(card: DebateCard) {
    return card.domain ? DOMAIN_LABELS[card.domain] : '';
  }

  protected signed(n: number) {
    return n > 0 ? `+${n}` : `${n}`;
  }
}

function initials(name: string): string {
  return name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

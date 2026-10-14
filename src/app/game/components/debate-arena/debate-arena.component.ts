import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DOMAIN_LABELS, DebateCard, DebateExchange, DebateMove, Domain } from '../../models/game.models';
import { BEATS, MOVE_LABELS, currentStance, feintChance } from '../../engine/debate';
import { stanceLabel } from '../../data/world';
import { StanceAxisComponent, StanceMarker } from '../stance-axis/stance-axis.component';
import { DebateService } from '../../services/debate.service';
import { FxService, toneOfSummary } from '../../services/fx.service';
import { GameStateService } from '../../services/game-state.service';

const PROFILE: Record<DebateMove, string> = {
  faits: 'Technicien : il aime les chiffres',
  attaque: 'Bretteur : il cherche la faute',
  emotion: 'Tribun : il joue sur l’émotion',
  parade: 'Esquiveur : il fuit l’affrontement',
};

const HELP_KEY = 'polsim.debateHelpSeen';
const MOVES: DebateMove[] = ['faits', 'emotion', 'attaque', 'parade'];

/**
 * Débat au tour par tour, version lisible.
 * Chaque manche : un sujet, un argument de chaque côté, joués en même temps.
 * Les cartes affichent leurs chances de gagner la manche selon ce que
 * l'adversaire risque de jouer ; la manche se dénoue ensuite en grand.
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
  private readonly fx = inject(FxService);

  protected readonly d = computed(() => this.svc.debate()!);
  protected readonly moveLabels = MOVE_LABELS;

  protected readonly helpOn = signal(readHelp());
  protected readonly showHelp = computed(() => this.helpOn());
  protected readonly shakeOn = signal(false);

  protected readonly initials = computed(() => initials(this.game.player().name));
  protected readonly oppInitials = computed(() => initials(this.d().opponentName));
  protected readonly topicLabel = computed(() => {
    const t = this.svc.topic();
    return t ? DOMAIN_LABELS[t] : '';
  });

  /** Points de manche : gagnée, perdue, serrée, en cours, à venir */
  protected readonly roundDots = computed(() => {
    const d = this.d();
    return Array.from({ length: d.maxRounds }, (_, i) => {
      const e = d.log.find(x => x.round === i + 1);
      if (e) return e.outcome;
      return i + 1 === d.round ? 'now' : 'todo';
    });
  });

  /** Remplissage de la jauge d'audience depuis le centre */
  protected readonly meter = computed(() => {
    const a = this.d().audience;
    return { width: Math.abs(a) / 2, side: a >= 0 ? 'left' : 'right' };
  });

  /** Le score en clair : qui mène, et ce qu'il faut pour gagner */
  protected readonly score = computed(() => {
    const a = Math.round(this.d().audience);
    if (a >= 6) return { text: `Vous menez de ${a}`, tone: 'good' };
    if (a <= -6) return { text: `Il mène de ${-a}`, tone: 'bad' };
    return { text: a === 0 ? 'À égalité · il faut +6 pour gagner' : `Au coude-à-coude (${a > 0 ? '+' : ''}${a}) · il faut +6`, tone: 'neutral' };
  });

  protected readonly profile = computed(() => {
    const style = this.d().oppStyle;
    const top = (Object.keys(style) as DebateMove[]).sort((a, b) => style[b] - style[a])[0];
    return PROFILE[top];
  });

  protected readonly oddsRows = computed(() => {
    const odds = this.svc.odds();
    if (!odds) return [];
    const max = Math.max(...MOVES.map(m => odds[m]));
    return MOVES.map(m => ({ move: m, pct: Math.round(odds[m] * 100), top: odds[m] === max }));
  });

  protected readonly bluff = computed(() => Math.round(feintChance(this.d()) * 100));

  /** La carte qui a le plus de chances (légère mise en valeur) */
  protected readonly bestId = computed(() => {
    const d = this.d();
    let best: { id: string; score: number } | null = null;
    for (const c of d.hand) {
      const ch = this.svc.chances(c);
      const score = ch.win * 1000 + this.svc.power(c).power - ch.lose * 10;
      if (!best || score > best.score) best = { id: c.id, score };
    }
    return best?.id ?? null;
  });

  protected readonly crowd = computed(() => stanceLabel(this.d().audienceLean).toLowerCase());

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

  /** Effets à la révélation d'une manche : confettis, secousse, verdict */
  private readonly onReveal = effect(() => {
    const rv = this.svc.reveal();
    untracked(() => {
      if (!rv) return;
      const w = window.innerWidth, h = window.innerHeight;
      if (rv.ex.outcome === 'gagne') setTimeout(() => this.fx.burst(w / 2, h * 0.45, 'good', rv.ex.swing >= 20 ? 26 : 16), 550);
      if (rv.ex.outcome === 'perdu') setTimeout(() => { this.shakeOn.set(true); setTimeout(() => this.shakeOn.set(false), 450); }, 550);
      if (rv.status === 'gagne') setTimeout(() => this.fx.stamp(this.d().ko ? 'K.-O. !' : 'Victoire', 'good', 'Le public est avec vous'), 900);
      if (rv.status === 'perdu') setTimeout(() => this.fx.stamp(this.d().ko ? 'K.-O.' : 'Défaite', 'bad', 'La séquence vous échappe'), 900);
    });
  });

  protected play(id: string, ev: Event): void {
    this.fx.mic(ev.currentTarget as Element);
    this.svc.play(id);
  }

  protected hideHelp(): void {
    this.helpOn.set(false);
    try { localStorage.setItem(HELP_KEY, '1'); } catch { /* navigation privée */ }
  }

  protected power(card: DebateCard) {
    return this.svc.power(card);
  }

  protected chances(card: DebateCard) {
    return this.svc.chances(card);
  }

  protected names(moves: DebateMove[]): string {
    return moves.map(m => MOVE_LABELS[m]).join(', ');
  }

  protected cleanNote(note: string): string {
    return note.split(' · ').filter(n => n !== 'Sur le sujet' && n !== 'Hors sujet').join(' · ');
  }

  protected domainName(t: Domain): string {
    return DOMAIN_LABELS[t];
  }

  /** La règle qui a décidé de la manche, en une phrase */
  protected why(e: DebateExchange): string {
    const p = e.playerMove, o = e.oppMove;
    const L = MOVE_LABELS;
    if (e.playerLabel === 'Reprendre son souffle') return 'Vous laissez filer la manche pour retrouver du sang-froid (+25).';
    if (e.playerLabel === 'Fact-checking en direct' && o === 'faits') return 'Le fact-checking démonte ses chiffres.';
    if (p === o) return `Même coup des deux côtés : la force des arguments a départagé.`;
    if (p === 'parade') return o === 'attaque' ? 'Votre Parade renvoie son Attaque.' : `La Parade ne sert qu’à renvoyer une Attaque : face à ${L[o]}, vous temporisez.`;
    if (o === 'parade') return p === 'attaque' ? 'Il pare votre Attaque et vous la renvoie.' : `Il esquive : votre argument (${L[p]}) ne marque que quelques points.`;
    return BEATS[p as Exclude<DebateMove, 'parade'>] === o ? `${L[p]} bat ${L[o]}.` : `${L[o]} bat ${L[p]}.`;
  }

  protected tone(summary: string) {
    return toneOfSummary(summary);
  }

  protected abs(n: number) {
    return Math.abs(n);
  }

  protected signed(n: number) {
    return n > 0 ? `+${n}` : `${n}`;
  }
}

function readHelp(): boolean {
  try { return localStorage.getItem(HELP_KEY) !== '1'; } catch { return true; }
}

function initials(name: string): string {
  return name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

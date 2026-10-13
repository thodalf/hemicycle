import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { TurnService } from '../../services/turn.service';
import { healthLabel, lifeRisks, lifeSummary } from '../../engine/life';
import { childAge } from '../../engine/family';
import { JournalComponent } from '../journal/journal.component';
import { AchievementsComponent } from '../achievements/achievements.component';

/** Âge, santé, risques et chapitres de vie ; retraite */
@Component({
  selector: 'app-life-panel',
  imports: [DecimalPipe, JournalComponent, AchievementsComponent],
  template: `
    <section class="card life">
      <div class="card-title"><span>Une vie</span><span class="chip" [class]="'t-' + health().tone">{{ health().label }}</span></div>
      <div class="b-row"><span>Âge</span><strong class="mono">{{ age() }} ans</strong></div>
      <div class="b-row"><span>Né·e en</span><strong class="mono">{{ summary().born }}</strong></div>
      <div class="g">
        <div class="b-row"><span>Santé</span><strong class="mono">{{ game.player().health | number: '1.0-0' }}</strong></div>
        <div class="track"><span class="fill" [class]="'t-' + health().tone" [style.width.%]="game.player().health"></span></div>
      </div>
      <details>
        <summary>Risques de mort (par an)</summary>
        <div class="b-row"><span>Maladie, vieillesse</span><strong class="mono">{{ risks().natural * 100 | number: '1.1-1' }} %</strong></div>
        <div class="b-row" [class.hot]="risks().stress > 0.005"><span>Surmenage (stress {{ game.stats().stress | number: '1.0-0' }})</span><strong class="mono">{{ risks().stress * 100 | number: '1.1-1' }} %</strong></div>
        <div class="b-row"><span>Accident</span><strong class="mono">{{ risks().accident * 100 | number: '1.2-2' }} %</strong></div>
        <div class="b-row"><span>Complot contre vous</span><strong class="mono">{{ risks().assassination * 100 | number: '1.2-2' }} %</strong></div>
        <p class="muted tip">Le stress tue : au-delà de 55, il abîme la santé, double la mortalité naturelle à 100 et expose à l’infarctus. L’épuisement et l’âge abîment aussi la santé ; bilans, sport et cures (onglet Santé) l’entretiennent. Les hautes fonctions exposent aux complots, qui se voient venir : on enquête et on se protège avant qu’ils ne frappent ; une voiture de sport, aux accidents.</p>
      </details>

      <div class="family">
        <div class="eyebrow">Famille</div>
        <ul>
          <li>{{ fam().partner ? (fam().partner!.married ? 'Marié·e à ' : 'En couple avec ') + fam().partner!.name : fam().divorces ? 'Séparé·e' : 'Célibataire' }}</li>
          @for (k of fam().children; track $index) {
            <li>{{ k.gender === 'f' ? '👧' : '👦' }} {{ k.name }}, {{ kidAge(k.born ?? 0) }} an{{ kidAge(k.born ?? 0) > 1 ? 's' : '' }}{{ k.path === 'politique' ? ' · milite avec vous' : k.path === 'adverse' ? ' · dans le camp d’en face' : k.path === 'ailleurs' ? ' · loin de la politique' : '' }}</li>
          }
          @for (pa of fam().parents; track pa.name) {
            <li [class.muted]="!pa.alive">{{ pa.name === 'Maman' ? 'Votre mère' : 'Votre père' }} : {{ pa.alive ? 'santé ' + (pa.health ?? 0 | number: '1.0-0') : 'disparu·e' }}</li>
          }
          @if (heir(); as h) { <li>🎖️ Dauphin·e : <strong>{{ h }}</strong></li> }
        </ul>
      </div>

      <div class="links">
        <button class="link" (click)="journal.set(true)">📖 Journal de bord</button>
        <button class="link" (click)="trophies.set(true)">🏆 Succès</button>
      </div>
      @if (journal()) { <app-journal (closed)="journal.set(false)" /> }
      @if (trophies()) { <app-achievements (closed)="trophies.set(false)" /> }

      @if (milestones().length) {
        <div class="chapters">
          <div class="eyebrow">Chapitres</div>
          <ol>
            @for (m of shown(); track $index) {
              <li [class]="'k-' + m.kind" [title]="m.text"><span class="mono">{{ m.age }} ans</span> {{ m.title }}</li>
            }
          </ol>
          @if (milestones().length > 4) {
            <button class="link" (click)="all.set(!all())">{{ all() ? 'Réduire' : 'Tous les chapitres (' + milestones().length + ')' }}</button>
          }
        </div>
      }

      @if (canRetire()) {
        @if (confirm()) {
          <div class="confirm">
            <p class="muted">Les années défileront jusqu’à votre dernier jour. C’est la fin de la partie.</p>
            <button class="btn small danger" (click)="retire()">Se retirer définitivement</button>
            <button class="btn small" (click)="confirm.set(false)">Annuler</button>
          </div>
        } @else {
          <button class="btn small" (click)="confirm.set(true)">Se retirer de la vie publique…</button>
        }
      }
    </section>
  `,
  styles: `
    .life { display: grid; gap: 6px; }
    .family ul { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 3px; font-size: 12.5px; }
    .links { display: flex; gap: 14px; flex-wrap: wrap; }
    .card-title { margin-bottom: 4px; }
    .b-row { display: flex; justify-content: space-between; font-size: 13px; }
    .g { display: grid; gap: 4px; }
    .track { position: relative; height: 7px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; }
    .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; transition: width .5s; background: var(--good); }
    .fill.t-warn { background: var(--warn); }
    .fill.t-bad { background: var(--bad); animation: pulse 1.2s ease-in-out infinite; }
    .chip.t-good { color: var(--good); }
    .chip.t-warn { color: var(--warn); }
    .chip.t-bad { color: var(--bad); font-weight: 600; }
    details { font-size: 12.5px; summary { cursor: pointer; color: var(--ink-2); margin: 2px 0; } .b-row { font-size: 12.5px; } }
    .tip { font-size: 11.5px; margin: 6px 0 0; }
    .hot { color: var(--bad); font-weight: 600; }
    .chapters { margin-top: 6px; ol { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 3px; } }
    .chapters li { font-size: 12.5px; padding-left: 10px; border-left: 3px solid var(--line); .mono { color: var(--ink-3); margin-right: 4px; } }
    .chapters li.k-victoire { border-left-color: var(--good); }
    .chapters li.k-revers { border-left-color: var(--bad); }
    .chapters li.k-carriere { border-left-color: var(--accent); }
    .link { background: none; border: 0; padding: 0; color: var(--accent); font-size: 12px; cursor: pointer; justify-self: start; margin-top: 4px; }
    .confirm { display: flex; flex-wrap: wrap; gap: 6px; p { margin: 0; font-size: 12px; width: 100%; } }
    .danger { background: var(--bad); color: var(--surface); border-color: var(--bad); }
    .btn { justify-self: start; margin-top: 6px; }
    @keyframes pulse { 50% { opacity: .5; } }
    @media (prefers-reduced-motion: reduce) { .fill.t-bad { animation: none; } }
  `,
})
export class LifePanelComponent {
  protected readonly game = inject(GameStateService);
  private readonly turn = inject(TurnService);
  protected readonly all = signal(false);
  protected readonly journal = signal(false);
  protected readonly trophies = signal(false);
  protected readonly fam = computed(() => this.game.s().family ?? { partner: null, children: [], parents: [], divorces: 0 });
  protected readonly heir = computed(() => { const h = this.game.s().heir; return h ? this.game.s().npcs.find(n => n.id === h.npcId)?.name ?? null : null; });
  protected kidAge(born: number): number { return childAge(this.game.s(), born); }
  protected readonly confirm = signal(false);
  protected readonly age = computed(() => Math.floor(this.game.player().age));
  protected readonly health = computed(() => healthLabel(this.game.player().health));
  protected readonly risks = computed(() => lifeRisks(this.game.s()));
  protected readonly summary = computed(() => lifeSummary(this.game.s()));
  protected readonly milestones = computed(() => this.game.s().milestones);
  protected readonly shown = computed(() => {
    const m = [...this.milestones()].reverse();
    return this.all() ? m : m.slice(0, 4);
  });
  /** On peut raccrocher à partir de 50 ans, ou après avoir quitté l'Élysée */
  protected readonly canRetire = computed(() => {
    const s = this.game.s();
    return s.status === 'en_cours' && !s.presidency && (s.player.age >= 50 || s.player.rankId === 'ancien_president');
  });

  protected retire(): void {
    this.confirm.set(false);
    this.turn.retire();
  }
}

import { DecimalPipe } from '@angular/common';
import { durationLabel, monthLabel } from '../../engine/calendar';
import { Component, computed, inject, signal } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { TurnService } from '../../services/turn.service';
import { FxService } from '../../services/fx.service';
import { PARRAINAGES_REQUIRED } from '../../data/ranks';
import { campaignOpensAt } from '../../engine/presidency';
import { lifeRisks } from '../../engine/life';

/** Calendrier présidentiel, candidature et tableau de bord de l'Élysée */
@Component({
  selector: 'app-presidency-panel',
  imports: [DecimalPipe],
  template: `
    @if (game.s().presidency; as pr) {
      <section class="card elysee">
        <div class="card-title">
          <span class="seal-title"><span class="seal" aria-hidden="true"></span>Palais de l’Élysée</span>
          <span class="chip accent">{{ pr.mandates > 1 ? 'Second mandat' : 'Premier mandat' }}</span>
        </div>
        <p class="muted small">Premier ministre : <strong>{{ pr.primeMinister }}</strong>
          @if (pr.cohabitation) { · <span class="chip bad">Cohabitation</span> }
          · {{ pr.reforms }} réforme(s) adoptée(s) · fin du mandat en {{ dateLabel(cal().nextWeek) }}</p>
        <div class="gauges">
          <div class="g">
            <div class="row"><span>Cote de confiance</span><span class="mono">{{ pr.approval | number: '1.0-0' }} %</span></div>
            <div class="track"><span class="fill" [class.low]="pr.approval < 25" [class.ok]="pr.approval >= 45" [style.width.%]="pr.approval"></span></div>
            <small class="muted">S’use chaque mois. Sous 12 %, avec une Assemblée hostile : destitution possible.</small>
          </div>
          <div class="g">
            <div class="row"><span>Majorité à l’Assemblée</span><span class="mono">{{ pr.majority | number: '1.0-0' }} %</span></div>
            <div class="track"><span class="fill" [class.low]="pr.majority < 35" [class.ok]="pr.majority >= 50" [style.width.%]="pr.majority"></span><i class="mark" style="left: 50%"></i></div>
            <small class="muted">Au-dessus de 50, vos réformes passent. Sous 30, motion de censure.</small>
          </div>
          <div class="g">
            <div class="row"><span>Sécurité</span><span class="mono">{{ pr.security | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill ok" [style.width.%]="pr.security"></span></div>
            <small class="muted">Protection rapprochée (GSPR).</small>
          </div>
          <div class="g">
            <div class="row"><span>Menace</span><span class="mono">{{ pr.threat | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill" [class.low]="pr.threat >= 50" [style.width.%]="pr.threat"></span></div>
            <small class="muted">Risque d’attentat : {{ risk() | number: '1.1-1' }} % par an.</small>
          </div>
        </div>
        <div class="foot">
          @if (cal().declared) {
            <span class="chip good">Candidat·e à sa succession · {{ parrainages() }}/{{ required }} parrainages</span>
          } @else if (pr.mandates < 2) {
            <button class="btn small" [disabled]="!turn.declaration().ok" [title]="turn.declaration().reason ?? ''" (click)="declare($event)">Briguer un second mandat</button>
            @if (!turn.declaration().ok) { <small class="muted">{{ turn.declaration().reason }}</small> }
          } @else {
            <small class="muted">Deux mandats : vous ne pouvez pas vous représenter.</small>
          }
          @if (confirmResign()) {
            <span class="confirm">Quitter l’Élysée ?
              <button class="btn small danger" (click)="resign()">Oui, démissionner</button>
              <button class="btn small" (click)="confirmResign.set(false)">Non</button></span>
          } @else {
            <button class="btn small ghost" (click)="confirmResign.set(true)">Démissionner</button>
          }
        </div>
      </section>
    } @else if (!game.s().player.flags['monarchie']) {
      <section class="card race" [class.hot]="cal().declared">
        <div class="card-title">
          <span>Élection présidentielle</span>
          <span class="chip" [class.accent]="weeksLeft() <= 18">dans {{ left() }}</span>
        </div>
        <p class="muted small">Scrutin en {{ dateLabel(cal().nextWeek) }} ·
          à l’Élysée : <strong>{{ cal().incumbentName }}</strong>{{ cal().incumbentMandates >= 2 ? ' (ne peut se représenter)' : '' }}</p>
        @if (cal().declared) {
          <div class="g">
            <div class="row"><span>Parrainages d’élus</span><span class="mono">{{ parrainages() }} / {{ required }}</span></div>
            <div class="track"><span class="fill" [class.ok]="parrainages() >= required" [style.width.%]="Math.min(100, parrainages() / required * 100)"></span></div>
            <small class="muted">
              @if (parrainages() >= required) { Candidature validée à l’ouverture de la campagne ({{ dateLabel(opens()) }}). }
              @else { À réunir avant {{ dateLabel(opens()) }} — onglets Parti et Terrain. }
            </small>
          </div>
        } @else {
          <div class="declare">
            <button class="btn primary" [disabled]="!turn.declaration().ok" (click)="declare($event)">Se déclarer candidat·e à la présidence</button>
            <small class="muted">{{ turn.declaration().ok ? 'Il faudra ' + required + ' parrainages d’élus. Sans l’appui de votre parti, c’est une candidature dissidente.' : turn.declaration().reason }}</small>
          </div>
        }
      </section>
    }
  `,
  styles: `
    .small { font-size: 12.5px; margin: 0 0 10px; }
    .gauges { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .g { display: grid; gap: 4px; small { font-size: 11.5px; } }
    .row { display: flex; justify-content: space-between; font-size: 13px; }
    .track { position: relative; height: 7px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); }
    .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: var(--accent); transition: width .4s; }
    .fill.ok { background: var(--good); }
    .fill.low { background: var(--bad); }
    .mark { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--ink); }
    .elysee { border-left: 4px solid #1f3a8a;
      background-image: linear-gradient(90deg, color-mix(in srgb, #1f3a8a 6%, transparent), transparent 40%); }
    .race { border-left: 4px solid var(--line); }
    .race.hot { border-left-color: var(--accent); }
    .seal-title { display: inline-flex; align-items: center; gap: 8px; }
    .seal { display: inline-block; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--surface); box-shadow: 0 0 0 1px var(--line);
      background: linear-gradient(90deg, #1f3a8a 0 33.3%, #f4f4f4 0 66.6%, #c0262d 0); }
    .foot { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-top: 12px; }
    .foot .ghost { margin-left: auto; }
    .confirm { margin-left: auto; display: inline-flex; gap: 6px; align-items: center; font-size: 12.5px; }
    .danger { background: var(--bad); color: var(--surface); border-color: var(--bad); }
    .declare { display: grid; gap: 6px; justify-items: start; small { font-size: 12px; } }
  `,
})
export class PresidencyPanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly turn = inject(TurnService);
  private readonly fx = inject(FxService);
  protected readonly required = PARRAINAGES_REQUIRED;
  protected readonly Math = Math;
  protected readonly confirmResign = signal(false);
  protected readonly cal = computed(() => this.game.s().presidential);
  protected readonly weeksLeft = computed(() => this.cal().nextWeek - this.game.week());
  protected readonly parrainages = computed(() => this.cal().parrainages);
  protected readonly opens = computed(() => campaignOpensAt(this.game.s()));
  protected readonly risk = computed(() => lifeRisks(this.game.s()).assassination * 100);

  protected dateLabel(week: number): string {
    return monthLabel(week);
  }
  protected readonly left = computed(() => durationLabel(this.weeksLeft()));

  protected declare(event: Event): void {
    this.turn.declare();
    const el = event.currentTarget as Element;
    this.fx.burstAt(el, 'good');
  }

  protected resign(): void {
    this.confirmResign.set(false);
    this.turn.resign();
    this.fx.stamp('Démission', 'bad', 'Élection anticipée');
  }
}

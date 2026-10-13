import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { PARTNERS_BY_ID } from '../../engine/intl';
import { leadsWar, theEnemy, warBalance } from '../../engine/war';
import { durationLabel } from '../../engine/calendar';

/** Le pays en guerre : ligne de front, opinion, pertes, alliés, journal des opérations */
@Component({
  selector: 'app-war-panel',
  imports: [DecimalPipe],
  template: `
    @if (game.s().war; as w) {
      <section class="card war">
        <div class="card-title">
          <span class="title"><span class="smoke" aria-hidden="true"><i></i><i></i><i></i></span>{{ w.defensive ? 'La France attaquée par ' + enemyThe() : 'En guerre ' + w.against }}</span>
          <span class="chips">@if (w.total) { <span class="chip total">Guerre totale</span> }<span class="chip bad">{{ months() }}</span></span>
        </div>
        <p class="casus muted">{{ w.casus }}</p>

        <div class="front" [attr.aria-label]="'Ligne de front : ' + (w.front | number: '1.0-0') + ' sur 100'">
          <span class="side us">France{{ w.allies.length ? ' et alliés' : '' }}</span>
          <span class="side them">{{ w.enemy }}</span>
          <div class="field">
            <span class="ours" [style.width.%]="w.front"></span>
            <span class="line" [style.left.%]="w.front"><i></i></span>
          </div>
          <div class="ticks">@if (w.defensive) { <span>Capitulation</span><span>Frontière</span><span>Libération</span> } @else { <span>Défaite</span><span>Statu quo</span><span>Victoire</span> }</div>
          @if (w.defensive && w.front < 50) { <p class="occupied">Territoire occupé : {{ (50 - w.front) * 2 | number: '1.0-0' }} % de la zone de combat</p> }
        </div>

        <div class="stats">
          <div><span class="eyebrow">Soutien de l’opinion</span><strong class="mono" [class.neg]="w.support < 35">{{ w.support | number: '1.0-0' }} %</strong>
            <div class="track"><span [class.low]="w.support < 35" [style.width.%]="w.support"></span></div></div>
          <div><span class="eyebrow">Soldats tombés</span><strong class="mono">{{ w.losses | number: '1.0-0' }}</strong></div>
          <div><span class="eyebrow">Coût</span><strong class="mono">{{ w.cost | number: '1.1-1' }} Md€</strong></div>
          <div><span class="eyebrow">Rapport de force</span><strong [class.neg]="balance() < 0" [class.pos]="balance() > 0">{{ balanceLabel() }}</strong></div>
          @if (w.morale !== undefined) {
            <div><span class="eyebrow">Moral de l’arrière</span><strong class="mono" [class.neg]="w.morale < 30">{{ w.morale | number: '1.0-0' }}</strong>
              <div class="track"><span [class.low]="w.morale < 30" [style.width.%]="w.morale"></span></div></div>
            <div><span class="eyebrow">Effort de guerre</span><strong class="mono">{{ w.effort ?? 0 | number: '1.0-0' }}</strong>
              <div class="track"><span class="eff" [style.width.%]="w.effort ?? 0"></span></div></div>
          }
        </div>
        @if (w.total) { <p class="muted small warn-total">Guerre totale : pertes et coûts décuplés, l’arrière s’use vite. Moral à zéro : effondrement du pays.</p> }

        @if (w.allies.length) {
          <div class="allies">@for (a of allies(); track a) { <span class="chip good">{{ a }}</span> }</div>
        }
        <ol class="log">
          @for (l of w.log.slice(0, 4); track $index) {
            <li [class]="'t-' + l.tone"><span class="mono">{{ game.month(l.week) }}</span> {{ l.text }}</li>
          }
        </ol>
        <p class="muted small">{{ leads() ? 'Onglets Guerre et Effort de guerre : offensives, alliés, discours à la Nation, cessez-le-feu.' : 'La conduite de la guerre revient au président et au gouvernement. Onglet Effort de guerre : réserve, accueil des déplacés, défense civile.' }}</p>
      </section>
    }
  `,
  styles: `
    .war { border-left: 4px solid var(--bad); display: grid; gap: 10px; .card-title { margin-bottom: 0; } }
    .title { display: inline-flex; align-items: center; gap: 10px; }
    .smoke { position: relative; width: 18px; height: 18px; i { position: absolute; bottom: 0; width: 8px; height: 8px; border-radius: 50%; background: var(--ink-3); opacity: 0; animation: smoke 2.4s ease-out infinite; }
      i:nth-child(2) { left: 6px; animation-delay: .8s; } i:nth-child(3) { left: 10px; animation-delay: 1.6s; } }
    @keyframes smoke { 0% { opacity: .7; transform: translateY(0) scale(.6); } 100% { opacity: 0; transform: translateY(-16px) scale(1.6); } }
    .casus { margin: 0; font-size: 12.5px; }
    .front { display: grid; gap: 4px; }
    .side { font-size: 12px; font-weight: 600; } .them { justify-self: end; margin-top: -20px; }
    .field { position: relative; height: 22px; border-radius: 6px; overflow: hidden; background: repeating-linear-gradient(135deg, #8f3a2c 0 8px, #a2483a 8px 16px); }
    .ours { position: absolute; left: 0; top: 0; bottom: 0; background: repeating-linear-gradient(135deg, #2b5aa8 0 8px, #3866b5 8px 16px); transition: width 1.2s cubic-bezier(.3,1.3,.5,1); }
    .line { position: absolute; top: -2px; bottom: -2px; width: 4px; margin-left: -2px; background: #f4d27a; box-shadow: 0 0 10px 3px rgba(244,210,122,.7); transition: left 1.2s cubic-bezier(.3,1.3,.5,1);
      i { position: absolute; inset: 0; animation: spark 1.1s ease-in-out infinite; background: #fff; opacity: .6; } }
    @keyframes spark { 50% { opacity: 0; } }
    .ticks { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--ink-3); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;
      div { display: grid; gap: 2px; } strong { font-size: 16px; } .neg { color: var(--bad); } .pos { color: var(--good); } }
    .track { height: 5px; border-radius: 3px; background: var(--surface-2); overflow: hidden; span { display: block; height: 100%; background: var(--good); transition: width .6s; } span.low { background: var(--bad); } }
    .allies { display: flex; gap: 6px; flex-wrap: wrap; }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 12.5px;
      li { padding-left: 8px; border-left: 3px solid var(--line); } .mono { color: var(--ink-3); font-size: 11px; margin-right: 4px; }
      .t-positive { border-left-color: var(--good); } .t-negative { border-left-color: var(--bad); } }
    .small { font-size: 11.5px; margin: 0; }
    .chips { display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .chip.total { background: #3a1010; color: #ffd9cf; }
    .occupied { margin: 2px 0 0; font-size: 12px; font-weight: 600; color: var(--bad); }
    .eff { background: var(--warn) !important; }
    .warn-total { color: var(--bad); }
    @media (prefers-reduced-motion: reduce) { .smoke i, .line i { animation: none; } }
  `,
})
export class WarPanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly leads = computed(() => leadsWar(this.game.s()));
  protected readonly balance = computed(() => warBalance(this.game.s()));
  protected readonly balanceLabel = computed(() => {
    const b = this.balance();
    return b > 0.12 ? 'Nettement favorable' : b > 0.03 ? 'Favorable' : b > -0.03 ? 'Équilibré' : b > -0.12 ? 'Défavorable' : 'Très défavorable';
  });
  protected readonly months = computed(() => {
    const w = this.game.s().war!;
    const m = this.game.s().week - w.since;
    return m < 1 ? 'Depuis ce mois-ci' : `Depuis ${durationLabel(m)}`;
  });
  protected readonly enemyThe = computed(() => theEnemy(this.game.s().war?.enemyId ?? ''));
  protected readonly allies = computed(() => (this.game.s().war?.allies ?? []).map(a => PARTNERS_BY_ID.get(a)?.name ?? a));
}

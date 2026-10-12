import { Component, computed, input } from '@angular/core';
import { Recruit } from '../../models/game.models';
import { RARITY_LABELS, TRAITS } from '../../data/recruits';
import { STAFF_BY_ROLE } from '../../data/staff';

/** Carte d'une recrue : rôle, rareté, atouts et travers */
@Component({
  selector: 'app-recruit-card',
  template: `
    <article class="rc" [class]="'rc ' + recruit().rarity" [class.compact]="compact()">
      <header>
        <span class="rarity">{{ rarity() }}</span>
        <span class="salary mono">{{ recruit().salary.toLocaleString('fr-FR') }} €/mois</span>
      </header>
      <strong class="name">{{ recruit().name }}</strong>
      <span class="role">{{ role().title }}</span>
      @if (!compact()) { <span class="bio muted">{{ recruit().bio }}</span> }
      <p class="perk">{{ role().perk }}</p>
      @if (traits().length) {
        <ul class="traits">
          @for (t of traits(); track t.id) {
            <li [class.good]="t.good" [class.bad]="!t.good" [title]="t.description">
              <span>{{ t.good ? '+' : '−' }} {{ t.label }}</span>
              @if (!compact()) { <small>{{ t.description }}</small> }
            </li>
          }
        </ul>
      }
      <div class="actions"><ng-content /></div>
    </article>
  `,
  styles: `
    :host { display: block; }
    .rc {
      --rc: var(--line);
      display: grid; gap: 4px; padding: 10px 12px; border-radius: 10px; background: var(--surface);
      border: 1px solid var(--line); border-top: 3px solid var(--rc); height: 100%; align-content: start;
    }
    .rc.rare { --rc: var(--accent); }
    .rc.legendaire { --rc: var(--warn); background: linear-gradient(180deg, var(--warn-soft), var(--surface) 70%); }
    header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .rarity { font: 600 10.5px/1 var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
    .rc.rare .rarity { color: var(--accent); }
    .rc.legendaire .rarity { color: var(--warn); }
    .salary { font-size: 11px; color: var(--ink-3); }
    .name { font-family: var(--font-display); font-size: 16px; line-height: 1.2; }
    .role { font-size: 12.5px; font-weight: 600; color: var(--ink-2); }
    .bio { font-size: 11.5px; font-style: italic; }
    .perk { margin: 2px 0 0; font-size: 12px; color: var(--ink-2); line-height: 1.4; }
    .traits { list-style: none; margin: 4px 0 0; padding: 0; display: grid; gap: 3px; }
    .traits li { display: grid; font-size: 12px; font-weight: 600; small { font-weight: 400; color: var(--ink-3); font-size: 11px; } }
    .traits li.good { color: var(--good); }
    .traits li.bad { color: var(--bad); }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; &:empty { display: none; } }
    .compact .perk { display: none; }
  `,
})
export class RecruitCardComponent {
  readonly recruit = input.required<Recruit>();
  readonly compact = input(false);
  protected readonly role = computed(() => STAFF_BY_ROLE.get(this.recruit().role)!);
  protected readonly rarity = computed(() => RARITY_LABELS[this.recruit().rarity]);
  protected readonly traits = computed(() => this.recruit().traits.map(id => ({ id, ...TRAITS[id] })));
}

import { Component, computed, output } from '@angular/core';
import { ACHIEVEMENTS, unlockedAchievements } from '../../data/achievements';

/** Les succès, d'une partie à l'autre */
@Component({
  selector: 'app-achievements',
  template: `
    <div class="overlay" role="dialog" aria-modal="true" aria-label="Succès" (click)="closed.emit()">
      <section class="box" (click)="$event.stopPropagation()">
        <header>
          <div><span class="eyebrow">Toutes parties confondues</span><h2>Succès · {{ count() }} / {{ total }}</h2></div>
          <button class="btn small" (click)="closed.emit()" aria-label="Fermer">✕</button>
        </header>
        <ul>
          @for (a of list(); track a.id) {
            <li [class.on]="a.date">
              <span class="ico" aria-hidden="true">{{ a.date ? a.icon : '🔒' }}</span>
              <span class="t"><strong>{{ a.title }}</strong><small>{{ a.text }}</small></span>
              @if (a.date) { <small class="mono date">{{ a.date }}</small> }
            </li>
          }
        </ul>
        <p class="muted note">Les succès sont gardés dans ce navigateur.</p>
      </section>
    </div>
  `,
  styles: `
    .overlay { position: fixed; inset: 0; z-index: 60; background: rgba(10, 14, 22, .55); display: grid; place-items: center; padding: 16px; }
    .box { width: min(560px, 100%); max-height: calc(100dvh - 32px); overflow: auto; background: var(--surface); border-radius: 14px; padding: 18px 20px; display: grid; gap: 12px; border: 1px solid var(--line); }
    header { display: flex; justify-content: space-between; align-items: start; h2 { margin: 2px 0 0; font-size: 22px; } }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    li { display: grid; grid-template-columns: 28px 1fr auto; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 10px; background: var(--surface-2); opacity: .6; }
    li.on { opacity: 1; box-shadow: inset 0 0 0 1px var(--accent); }
    .ico { font-size: 20px; text-align: center; } .t { display: grid; font-size: 13px; small { font-size: 11.5px; color: var(--ink-2); } }
    .date { font-size: 11px; color: var(--ink-3); }
    .note { margin: 0; font-size: 11.5px; }
  `,
})
export class AchievementsComponent {
  readonly closed = output<void>();
  protected readonly total = ACHIEVEMENTS.length;
  private readonly store = unlockedAchievements();
  protected readonly list = computed(() => ACHIEVEMENTS.map(a => ({ ...a, date: this.store[a.id] ?? '' })).sort((a, b) => Number(!!b.date) - Number(!!a.date)));
  protected readonly count = computed(() => this.list().filter(a => a.date).length);
}

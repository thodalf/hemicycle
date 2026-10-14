import { Component, DestroyRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { ObjectivesPanelComponent } from '../objectives-panel/objectives-panel.component';

/**
 * Les objectifs, toujours à portée de main : dès que le volet de l'agenda sort de l'écran
 * (on fait défiler la page, on change d'onglet), une pastille flottante prend le relais.
 */
@Component({
  selector: 'app-objectives-fab',
  imports: [ObjectivesPanelComponent],
  template: `
    @if (show() || open()) {
      <button type="button" class="obj-fab" [class.raised]="raised()" [class.on]="open()" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-label="Objectifs du moment">
        <svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="trk" /><circle cx="18" cy="18" r="15" class="val" [style.stroke-dasharray]="dash()" /></svg>
        <span class="ic">🎯</span><b>{{ done() }}/{{ total() }}</b>
      </button>
    }
    @if (open()) {
      <div class="veil" (click)="open.set(false)"></div>
      <section class="pop" [class.raised]="raised()" role="dialog" aria-label="Objectifs du moment">
        <header><strong>🎯 Objectifs du moment</strong><button type="button" class="x" (click)="open.set(false)" aria-label="Fermer">✕</button></header>
        <app-objectives-panel [embedded]="true" />
      </section>
    }
  `,
  styles: `
    .obj-fab { position: fixed; right: 16px; bottom: 20px; z-index: 9; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px 6px 6px; border-radius: 999px;
      border: 1px solid var(--line); background: color-mix(in srgb, var(--surface) 94%, transparent); backdrop-filter: blur(8px); color: var(--ink);
      box-shadow: 0 8px 24px -10px rgba(0,0,0,.35); font: 600 13px var(--font-body); cursor: pointer; animation: fab-in .25s cubic-bezier(.2,.9,.3,1.3);
      svg { width: 30px; height: 30px; transform: rotate(-90deg); position: absolute; left: 4px; top: 50%; margin-top: -15px; }
      .trk { fill: none; stroke: var(--line); stroke-width: 3; } .val { fill: none; stroke: var(--good); stroke-width: 3; stroke-linecap: round; transition: stroke-dasharray .4s ease; }
      .ic { width: 30px; height: 30px; display: grid; place-items: center; font-size: 15px; position: relative; }
      &.on { border-color: var(--accent); } }
    @keyframes fab-in { from { transform: scale(.6) translateY(10px); opacity: 0; } }
    .veil { position: fixed; inset: 0; z-index: 9; background: rgba(10, 12, 18, .25); }
    .pop { position: fixed; right: 16px; bottom: 70px; z-index: 10; width: min(380px, calc(100vw - 32px)); max-height: 65vh; overflow-y: auto; padding: 10px 12px 12px;
      border-radius: 14px; border: 1px solid var(--line); background: var(--surface); box-shadow: 0 20px 50px -18px rgba(0,0,0,.5); animation: pop-in .22s ease;
      header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 14px; }
      .x { border: 0; background: none; color: var(--ink-3); font-size: 15px; cursor: pointer; } }
    @keyframes pop-in { from { transform: translateY(10px); opacity: 0; } }
    @media (max-width: 820px) {
      .obj-fab { right: 12px; bottom: calc(68px + env(safe-area-inset-bottom, 0px)); }
      .obj-fab.raised { bottom: calc(134px + env(safe-area-inset-bottom, 0px)); }
      .pop { right: 12px; left: 12px; width: auto; bottom: calc(118px + env(safe-area-inset-bottom, 0px)); }
      .pop.raised { bottom: calc(184px + env(safe-area-inset-bottom, 0px)); }
    }
  `,
})
export class ObjectivesFabComponent {
  private readonly game = inject(GameStateService);
  private readonly destroy = inject(DestroyRef);
  /** Sur l'agenda mobile, la barre « Terminer le mois » occupe le bas : on monte d'un cran */
  readonly raised = input(false);
  protected readonly open = signal(false);
  /** Le volet de l'agenda est-il à l'écran ? */
  private readonly foldVisible = signal(true);
  protected readonly total = computed(() => this.game.s().objectives.length);
  protected readonly done = computed(() => this.game.s().objectives.filter(o => o.progress >= o.target).length);
  protected readonly show = computed(() => this.total() > 0 && !this.foldVisible());
  /** Anneau de progression : la moyenne des objectifs */
  protected readonly dash = computed(() => {
    const os = this.game.s().objectives;
    const r = os.length ? os.reduce((t, o) => t + Math.min(1, o.progress / Math.max(1, o.target)), 0) / os.length : 0;
    const c = 2 * Math.PI * 15;
    return `${(r * c).toFixed(1)} ${c.toFixed(1)}`;
  });

  private readonly watch = afterNextRender(() => {
    const check = () => {
      const fold = document.querySelector('app-week-planner .obj-fold') as HTMLElement | null;
      if (!fold || !fold.offsetParent) { this.foldVisible.set(false); return; }
      const r = fold.getBoundingClientRect();
      const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h')) || 0;
      this.foldVisible.set(r.bottom > top + 24 && r.top < window.innerHeight - 40);
    };
    check();
    const onScroll = () => requestAnimationFrame(check);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    // Les onglets changent sans défilement : un coup d'œil régulier suffit
    const timer = setInterval(check, 700);
    this.destroy.onDestroy(() => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); clearInterval(timer); });
  });
}

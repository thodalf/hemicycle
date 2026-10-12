import { Component, input } from '@angular/core';
import { stanceLabel } from '../../data/world';

export interface StanceMarker {
  label: string;
  value: number;
  color: string;
  /** 'top' : étiquette au-dessus (vous) · 'bottom' : en dessous */
  row: 'top' | 'bottom';
}

/** Axe gauche-droite avec repères (vous, parti, public, adversaire…) */
@Component({
  selector: 'app-stance-axis',
  template: `
    <div class="axis" role="img" [attr.aria-label]="summary()">
      <div class="rail">
        <span class="tick" style="left: 25%"></span>
        <span class="tick mid"></span>
        <span class="tick" style="left: 75%"></span>
        @for (m of markers(); track m.label) {
          <span class="mk" [class.top]="m.row === 'top'" [style.left.%]="pos(m.value)" [style.--c]="m.color"
                [title]="m.label + ' : ' + label(m.value)">
            <span class="dot"></span>
            <span class="lbl">{{ m.label }}</span>
          </span>
        }
      </div>
      <div class="ends"><span>Gauche</span><span>Centre</span><span>Droite</span></div>
    </div>
  `,
  styles: `
    .axis { padding: 24px 0 0; }
    .rail { position: relative; height: 6px; border-radius: 3px; background: var(--surface-2); border: 1px solid var(--line); margin: 0 8px 22px; }
    .tick { position: absolute; top: -3px; width: 1px; height: 10px; background: var(--line); }
    .tick.mid { left: 50%; background: var(--ink-3); }
    .mk { position: absolute; top: 50%; transform: translate(-50%, -50%); transition: left .4s ease; }
    .dot { display: block; width: 12px; height: 12px; border-radius: 50%; background: var(--c); border: 2px solid var(--surface); box-shadow: 0 0 0 1px var(--c); }
    .lbl { position: absolute; left: 50%; transform: translateX(-50%); top: 14px; white-space: nowrap; font-size: 11px; color: var(--ink-2); }
    .mk.top { z-index: 1; }
    .mk.top .dot { width: 14px; height: 14px; }
    .mk.top .lbl { top: auto; bottom: 16px; font-weight: 600; color: var(--ink); }
    .ends { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--ink-3); text-transform: uppercase; letter-spacing: .06em; }
    @media (prefers-reduced-motion: reduce) { .mk { transition: none; } }
  `,
})
export class StanceAxisComponent {
  readonly markers = input.required<StanceMarker[]>();

  protected pos(v: number) {
    return (Math.max(-100, Math.min(100, v)) + 100) / 2;
  }
  protected label(v: number) {
    return stanceLabel(v);
  }
  protected summary() {
    return this.markers().map(m => `${m.label} : ${stanceLabel(m.value)}`).join(', ');
  }
}

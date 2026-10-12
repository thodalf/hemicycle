import { Component, computed, input, model } from '@angular/core';
import { PARTIES, stanceLabel } from '../../data/world';
import { PARTY_COLORS, partyInitials } from '../../engine/founding';
import { StanceAxisComponent, StanceMarker } from '../stance-axis/stance-axis.component';

/** Formulaire de création d'un parti : nom, couleur, position sur l'axe */
@Component({
  selector: 'app-party-form',
  imports: [StanceAxisComponent],
  template: `
    <div class="form">
      <div class="preview" [style.--c]="color()">
        <span class="badge">{{ initials() }}</span>
        <div><strong>{{ name() || 'Votre parti' }}</strong><small>{{ label() }}</small></div>
      </div>
      <label class="field">
        <span class="eyebrow">Nom du parti</span>
        <input type="text" [value]="name()" (input)="name.set($any($event.target).value)" maxlength="48"
               placeholder="Ex. : Nouvelle République, Les Communs…" />
      </label>
      <div class="field">
        <span class="eyebrow">Couleur</span>
        <div class="swatches" role="radiogroup" aria-label="Couleur du parti">
          @for (c of colors; track c) {
            <button type="button" role="radio" [attr.aria-checked]="color() === c" [class.on]="color() === c"
                    [style.background]="c" (click)="color.set(c)" [attr.aria-label]="'Couleur ' + c"></button>
          }
        </div>
      </div>
      <label class="field">
        <span class="eyebrow">Position : {{ label() }}</span>
        <input type="range" min="-90" max="90" step="5" [value]="position()" (input)="position.set(+$any($event.target).value)" />
      </label>
      <app-stance-axis [markers]="markers()" />
      @if (nearest(); as n) {
        <small class="muted">Parti existant le plus proche : {{ n.name }} ({{ n.gap }} points d’écart). {{ n.gap < 15 ? 'Vous chasserez sur les mêmes terres.' : 'Un espace politique à prendre.' }}</small>
      }
      @if (note()) { <small class="muted">{{ note() }}</small> }
    </div>
  `,
  styles: `
    .form { display: grid; gap: 12px; }
    .preview { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line);
      border-left: 5px solid var(--c); background: var(--surface-2);
      div { display: grid; } strong { font-family: var(--font-display); font-size: 17px; } small { color: var(--ink-3); font-size: 12px; } }
    .badge { display: grid; place-items: center; min-width: 40px; height: 40px; padding: 0 6px; border-radius: 8px; background: var(--c); color: #fff;
      font-weight: 700; font-size: 14px; letter-spacing: .02em; }
    .field { display: grid; gap: 6px; }
    input[type=text] { padding: 9px 10px; font-size: 15px; }
    input[type=range] { width: 100%; accent-color: var(--accent); }
    .swatches { display: flex; flex-wrap: wrap; gap: 6px;
      button { width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--surface); box-shadow: 0 0 0 1px var(--line); cursor: pointer; }
      button.on { box-shadow: 0 0 0 2px var(--ink); } }
    small { font-size: 12px; line-height: 1.4; }
  `,
})
export class PartyFormComponent {
  readonly name = model('');
  readonly color = model(PARTY_COLORS[5]);
  readonly position = model(0);
  readonly note = input('');

  protected readonly colors = PARTY_COLORS;
  protected readonly initials = computed(() => partyInitials(this.name() || 'Votre parti'));
  protected readonly label = computed(() => { const l = stanceLabel(this.position()); return l.charAt(0).toUpperCase() + l.slice(1); });
  protected readonly markers = computed<StanceMarker[]>(() => [
    ...PARTIES.map(p => ({ label: p.name.split(' ').map(w => w[0]).join(''), value: p.position, color: p.color, row: 'bottom' as const })),
    { label: 'Vous', value: this.position(), color: this.color(), row: 'top' as const },
  ]);
  protected readonly nearest = computed(() => {
    const n = [...PARTIES].sort((a, b) => Math.abs(a.position - this.position()) - Math.abs(b.position - this.position()))[0];
    return { name: n.name, gap: Math.abs(n.position - this.position()) };
  });
}

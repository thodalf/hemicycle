import { Component, computed, input, signal } from '@angular/core';
import { TRAITS, TRAIT_KIND_LABELS, TraitDef, TraitId, TraitKind, traitLabel } from '../../data/traits';

/** Résumé lisible des effets d'un trait */
export function traitEffects(t: TraitDef): string[] {
  const m = t.mods;
  const pct = (v: number) => `${v > 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)} %`;
  const S: Record<string, string> = { popularity: 'popularité', influence: 'influence', credibility: 'crédibilité', politicalCapital: 'capital politique', stress: 'stress', energy: 'énergie', health: 'santé' };
  const out: string[] = [];
  for (const [k, v] of Object.entries(m.gain ?? {})) out.push(`${k === 'stress' ? 'Hausses' : 'Gains'} de ${S[k]} ${pct(v)}`);
  for (const [k, v] of Object.entries(m.loss ?? {})) out.push(`Pertes de ${S[k]} ${pct(v)}`);
  for (const [k, v] of Object.entries(m.monthly ?? {})) out.push(`${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString('fr-FR')} ${S[k]} par mois`);
  for (const [k, v] of Object.entries(m.debate ?? {})) out.push(`Débat : ${({ faits: 'Faits', attaque: 'Attaque', emotion: 'Émotion', parade: 'Parade' } as Record<string, string>)[k]} ${pct(v)}`);
  if (m.composure) out.push(`Sang-froid en débat ${m.composure > 0 ? '+' : '−'}${Math.abs(m.composure)}`);
  if (m.exposure) out.push(`Exposition aux scandales ${pct(m.exposure)}`);
  if (m.mastery) out.push(`Apprentissage des dossiers ${pct(m.mastery)}`);
  if (m.relationUp) out.push(`Amitiés ${pct(m.relationUp)}`);
  if (m.relationDown) out.push(`Rancunes ${pct(m.relationDown)}`);
  if (m.life) out.push(`Espérance de vie ${m.life > 0 ? '+' : '−'}${Math.abs(m.life)} ans`);
  return out;
}

/**
 * Pastilles de traits, façon Crusader Kings : une icône, un nom ; un clic
 * dévoile la description et les effets. `grouped` les range par origine.
 */
@Component({
  selector: 'app-traits',
  template: `
    @if (grouped()) {
      @for (g of groups(); track g.kind) {
        <div class="grp">
          <span class="eyebrow">{{ g.label }}</span>
          <div class="chips">
            @for (t of g.items; track t.id) {
              <button type="button" class="trait" [class]="'t-' + t.tone" [class.on]="open() === t.id" [class.fresh]="t.id === fresh()" (click)="toggle(t.id)" [attr.aria-expanded]="open() === t.id">
                <span class="ic">{{ t.icon }}</span>{{ name(t.id) }}
              </button>
            }
          </div>
        </div>
      }
    } @else {
      <span class="chips inline">
        @for (t of items(); track t.id) {
          <button type="button" class="trait mini" [class]="'t-' + t.tone" [class.on]="open() === t.id" (click)="toggle(t.id); $event.stopPropagation()" [title]="name(t.id) + ' : ' + t.desc">
            <span class="ic">{{ t.icon }}</span>@if (!compact()) { {{ name(t.id) }} }
          </button>
        }
      </span>
    }
    @if (openDef(); as t) {
      <div class="detail" [class]="'t-' + t.tone">
        <strong>{{ t.icon }} {{ name(t.id) }}</strong> <small class="muted">· {{ kindLabel(t.kind) }} · définitif</small>
        <p>{{ t.desc }}</p>
        <ul>@for (e of effects(t); track e) { <li>{{ e }}</li> }</ul>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .grp { display: grid; gap: 5px; margin-bottom: 8px; }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .chips.inline { display: inline-flex; gap: 3px; vertical-align: middle; }
    .trait { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px 3px 4px; border-radius: 999px; cursor: pointer;
      font: 500 12.5px var(--font-body); color: var(--ink); background: var(--surface-2); border: 1px solid var(--line);
      transition: transform .15s, box-shadow .15s;
      .ic { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; background: var(--surface); box-shadow: inset 0 0 0 2px var(--tc); }
      &:hover { transform: translateY(-1px); } &.on { box-shadow: 0 0 0 2px var(--tc); } }
    .trait.mini { padding: 0; border: 0; background: none; .ic { width: 20px; height: 20px; font-size: 12px; } }
    .t-good { --tc: color-mix(in srgb, var(--good) 70%, transparent); }
    .t-bad { --tc: color-mix(in srgb, var(--bad) 70%, transparent); }
    .t-mixed { --tc: color-mix(in srgb, var(--warn) 70%, transparent); }
    .fresh { animation: trait-new 1.6s cubic-bezier(.3, 1.5, .5, 1); }
    @keyframes trait-new { 0% { transform: scale(.3) rotate(-20deg); } 30% { transform: scale(1.25) rotate(4deg); box-shadow: 0 0 0 6px var(--tc); } 60% { transform: scale(1); } }
    .detail { margin-top: 6px; padding: 8px 10px; border-radius: 8px; background: var(--surface-2); border-left: 3px solid var(--tc); font-size: 12.5px; animation: det-in .2s ease;
      p { margin: 4px 0; } ul { margin: 0; padding-left: 16px; color: var(--ink-2); } }
    @keyframes det-in { from { opacity: 0; transform: translateY(-4px); } }
  `,
})
export class TraitsComponent {
  readonly ids = input<string[]>([]);
  readonly gender = input<'femme' | 'homme'>('homme');
  readonly grouped = input(false);
  readonly compact = input(false);
  /** Trait tout juste acquis : il arrive en tournoyant */
  readonly fresh = input<string | null>(null);

  protected readonly open = signal<string | null>(null);
  protected readonly items = computed(() => this.ids().map(id => TRAITS[id as TraitId]).filter(Boolean));
  protected readonly groups = computed(() => (['naissance', 'temperament', 'acquis'] as TraitKind[])
    .map(kind => ({ kind, label: TRAIT_KIND_LABELS[kind], items: this.items().filter(t => t.kind === kind) }))
    .filter(g => g.items.length));
  protected readonly openDef = computed(() => (this.open() ? TRAITS[this.open() as TraitId] : null));

  protected toggle(id: string) { this.open.set(this.open() === id ? null : id); }
  protected name(id: TraitId) { return traitLabel(id, this.gender()); }
  protected kindLabel(k: TraitKind) { return TRAIT_KIND_LABELS[k]; }
  protected effects(t: TraitDef) { return traitEffects(t); }
}

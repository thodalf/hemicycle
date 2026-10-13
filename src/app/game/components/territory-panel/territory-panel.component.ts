import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { localBonus } from '../../engine/territory';
import { CIRCO_HINTS, CIRCO_LABELS, MAP_REGIONS } from '../../engine/country';
import { CircoKind } from '../../models/game.models';
import { promiseProgress } from '../../engine/promises';
import { DOMAIN_LABELS, Domain } from '../../models/game.models';

/** Votre territoire (carte, chantiers, attachement) et vos promesses */
@Component({
  selector: 'app-territory-panel',
  imports: [DecimalPipe],
  template: `
    @if (game.s().territory; as t) {
      <section class="card terr" aria-label="Votre territoire">
        <div class="card-title"><span>{{ t.name }}</span><span class="chip">Attachement {{ t.attachment | number: '1.0-0' }}</span></div>
        <p class="kind" [class]="'k-' + (t.kind ?? 'disputee')"><strong>{{ kindLabel(t.kind) }}</strong>@if (regionName(t.region); as rn) { · {{ rn }} } <span class="muted">— {{ kindHint(t.kind) }}</span></p>
        <svg viewBox="0 0 100 100" class="map" role="img" [attr.aria-label]="'Carte de ' + t.name">
          <path class="land" d="M10,38 C14,18 36,8 56,12 C76,14 94,26 92,48 C96,66 86,88 62,90 C40,94 18,86 10,68 C4,58 6,46 10,38 Z" />
          @for (c of t.communes; track c.name) {
            <circle [attr.cx]="c.x" [attr.cy]="c.y" r="1.6" class="town" />
            <text [attr.x]="c.x" [attr.y]="c.y - 3" class="tname">{{ c.name }}</text>
          }
          @for (p of t.projects; track p.id) {
            <g [attr.transform]="'translate(' + p.x + ' ' + p.y + ')'" [class.done]="p.finished">
              <circle r="4.6" class="pin" />
              <text y="1.8" class="picon">{{ p.icon }}</text>
            </g>
          }
        </svg>
        <ul class="projects">
          @for (p of t.projects; track p.id) {
            <li [class.done]="p.finished">
              <span>{{ p.icon }} {{ p.label }}</span>
              @if (p.finished) { <small class="good">Inauguré</small> }
              @else { <span class="bar"><i [style.width.%]="(p.done / p.months) * 100"></i></span><small class="mono">{{ p.done }}/{{ p.months }} mois</small> }
            </li>
          } @empty {
            <li class="muted">Aucun chantier : onglet Territoire pour en lancer un.</li>
          }
        </ul>
        <p class="note muted">Bonus aux municipales et législatives : +{{ bonus() | number: '1.0-1' }} points de score.</p>

        <div class="eyebrow">Vos promesses</div>
        <ul class="promises">
          @for (p of promises(); track p.id) {
            <li [class]="'s-' + p.status">
              <span class="pt"><strong>« {{ p.text }} »</strong><small class="muted">{{ label(p.domain) }} · {{ p.status === 'en_cours' ? 'échéance ' + game.month(p.dueWeek) : p.status === 'tenue' ? 'tenue' : 'trahie' }}</small></span>
              @if (p.status === 'en_cours') { <span class="bar"><i [style.width.%]="prog(p)"></i></span> }
            </li>
          } @empty {
            <li class="muted">Aucune promesse : « Faire une promesse publique » (onglet Médias).</li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    .terr { display: grid; gap: 8px; .card-title { margin-bottom: 0; } }
    .map { width: 100%; max-height: 210px; background: color-mix(in srgb, var(--accent) 6%, var(--surface-2)); border-radius: 10px; }
    .land { fill: color-mix(in srgb, var(--good) 14%, var(--surface)); stroke: var(--ink-3); stroke-width: .4; }
    .town { fill: var(--ink-2); }
    .tname { font: 3.2px var(--font-body); fill: var(--ink-2); text-anchor: middle; }
    .pin { fill: var(--surface); stroke: var(--warn); stroke-width: .7; }
    .done .pin { stroke: var(--good); fill: color-mix(in srgb, var(--good) 20%, var(--surface)); }
    .picon { font-size: 5px; text-anchor: middle; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px; }
    .projects li { display: grid; grid-template-columns: 1fr 70px auto; gap: 8px; align-items: center; font-size: 12.5px; }
    .projects li.done { grid-template-columns: 1fr auto; }
    .bar { height: 6px; border-radius: 3px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; i { display: block; height: 100%; background: var(--accent); } }
    .good { color: var(--good); font-weight: 600; }
    .note { margin: 0; font-size: 11.5px; }
    .kind { margin: 0; font-size: 12px; padding-left: 8px; border-left: 3px solid var(--warn); } .kind.k-bastion { border-left-color: var(--good); } .kind.k-mission { border-left-color: var(--bad); }
    .promises li { display: grid; grid-template-columns: 1fr 60px; gap: 8px; align-items: center; font-size: 12.5px; padding-left: 8px; border-left: 3px solid var(--line); }
    .promises li.s-tenue { border-left-color: var(--good); grid-template-columns: 1fr; } .promises li.s-trahie { border-left-color: var(--bad); grid-template-columns: 1fr; }
    .pt { display: grid; small { font-size: 11px; } }
  `,
})
export class TerritoryPanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly bonus = computed(() => localBonus(this.game.s()));
  protected readonly promises = computed(() => [...(this.game.s().promises ?? [])].reverse().slice(0, 6));
  protected prog(p: Parameters<typeof promiseProgress>[1]): number { return promiseProgress(this.game.s(), p); }
  protected label(d: Domain): string { return DOMAIN_LABELS[d]; }
  protected kindLabel(k?: CircoKind): string { return CIRCO_LABELS[k ?? 'disputee']; }
  protected kindHint(k?: CircoKind): string { return CIRCO_HINTS[k ?? 'disputee']; }
  protected regionName(id?: string): string | undefined { return MAP_REGIONS.find(r => r.id === id)?.name; }
}

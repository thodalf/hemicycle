import { Component, computed, inject, signal } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { CARD_BY_ID, PILLARS, RequeteResult, answerRequete, requetes, textOf } from '../../engine/requetes';
import type { Pillar, ReqCard } from '../../data/requetes-types';

/* ============================================================
 *  Les requêtes du mois, à la Reigns : une pile de cartes, deux
 *  réponses (glisser à gauche ou à droite, ou les boutons), et
 *  quatre piliers en haut. En survolant ou en glissant vers une
 *  réponse, des points apparaissent sous les piliers qui vont
 *  bouger — plus gros pour un gros effet — sans dire dans quel sens.
 * ============================================================ */

@Component({
  selector: 'app-requetes',
  template: `
    @if (visible()) {
      <section class="card req" aria-label="Les requêtes du mois">
        <header class="head">
          <h2 class="card-title">📜 Les requêtes du mois</h2>
          <small class="muted">{{ hand().length ? hand().length + ' en attente' : 'Toutes traitées' }}</small>
        </header>
        <div class="pillars" role="group" aria-label="Les quatre piliers">
          @for (p of pillars(); track p.id) {
            <div class="pil" [class.danger]="p.value <= 15 || p.value >= 85" [title]="p.label + ' : ' + p.value + ' / 100'">
              <span class="gauge"><span class="fill" [style.height.%]="p.value"></span><span class="ico">{{ p.icon }}</span></span>
              <span class="dot" [class]="'dot s' + preview()[p.id]"></span>
              <small>{{ p.label }}</small>
            </div>
          }
        </div>
        @if (last(); as l) {
          <div class="outcome" [class.bad]="!!l.fall">
            @if (l.text) { <p>{{ l.text }}</p> }
            <div class="chips">
              @for (x of l.chips; track $index) { <span>{{ x }}</span> }
            </div>
            @if (l.fall) { <p class="fall">⚠️ {{ l.fall }} : une décision vous attend.</p> }
          </div>
        }
        @if (card(); as c) {
          <article class="rcard" [style.transform]="'translateX(' + dx() + 'px) rotate(' + dx() / 18 + 'deg)'" [class.anim]="!dragging()"
                   (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up()" (pointercancel)="cancel()" (pointerleave)="dragging() && up()">
            <div class="portrait" aria-hidden="true">{{ c.icon }}</div>
            <strong class="nm">{{ c.name }}</strong>
            <small class="role">{{ c.role }}</small>
            <p class="txt">{{ text(c) }}</p>
            <div class="hint-l" [style.opacity]="dx() < -20 ? 1 : 0">{{ c.left.label }}</div>
            <div class="hint-r" [style.opacity]="dx() > 20 ? 1 : 0">{{ c.right.label }}</div>
          </article>
          <div class="choices">
            <button type="button" class="btn" (mouseenter)="hover.set('left')" (mouseleave)="hover.set(null)" (focus)="hover.set('left')" (blur)="hover.set(null)" (click)="choose('left')">◀ {{ c.left.label }}</button>
            <button type="button" class="btn" (mouseenter)="hover.set('right')" (mouseleave)="hover.set(null)" (focus)="hover.set('right')" (blur)="hover.set(null)" (click)="choose('right')">{{ c.right.label }} ▶</button>
          </div>
          <p class="muted small">Glissez la carte ou choisissez. Les points montrent quels piliers vont bouger, pas dans quel sens. À 0 comme à 100, un pilier vous fait chuter.</p>
        } @else {
          <p class="muted small">Plus de requête ce mois-ci. Les suivantes arriveront le mois prochain ; celles qu’on laisse sans réponse agacent.</p>
        }
      </section>
    }
  `,
  styles: [`
    .req { display: grid; gap: 10px; overflow: hidden; }
    .head { display: flex; justify-content: space-between; align-items: baseline; }
    .head h2 { margin: 0; }
    .pillars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; }
    .pil { display: grid; justify-items: center; gap: 3px; }
    .pil small { font-size: 11px; color: var(--ink-2); }
    .gauge { position: relative; width: 38px; height: 44px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--line); overflow: hidden; display: grid; place-items: center; }
    .fill { position: absolute; left: 0; right: 0; bottom: 0; background: color-mix(in srgb, var(--accent) 35%, transparent); transition: height .5s ease; }
    .pil.danger .fill { background: color-mix(in srgb, var(--bad) 45%, transparent); }
    .pil.danger .gauge { border-color: var(--bad); }
    .ico { position: relative; font-size: 20px; }
    .dot { width: 0; height: 0; border-radius: 50%; background: var(--ink); transition: all .15s; }
    .dot.s1 { width: 6px; height: 6px; } .dot.s2 { width: 10px; height: 10px; } .dot.s3 { width: 14px; height: 14px; }
    .rcard { position: relative; display: grid; justify-items: center; gap: 4px; padding: 18px 16px 16px; border-radius: 16px; border: 1px solid var(--line);
      background: var(--surface); box-shadow: var(--shadow); touch-action: pan-y; user-select: none; cursor: grab; text-align: center; }
    .rcard.anim { transition: transform .25s cubic-bezier(.2,.8,.3,1.1); }
    .portrait { font-size: 46px; line-height: 1; }
    .nm { font-family: var(--font-display); font-size: 17px; }
    .role { color: var(--ink-2); font-size: 12px; }
    .txt { margin: 6px 0 0; font-size: 14.5px; line-height: 1.45; }
    .hint-l, .hint-r { position: absolute; top: 10px; padding: 4px 10px; border-radius: 8px; font-weight: 700; font-size: 12.5px; background: var(--ink); color: var(--surface); transition: opacity .1s; pointer-events: none; max-width: 45%; }
    .hint-l { right: 10px; } .hint-r { left: 10px; }
    .choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .choices .btn { white-space: normal; }
    .small { font-size: 12px; margin: 0; }
    .outcome { border-left: 3px solid var(--accent); padding: 6px 10px; background: var(--surface-2); border-radius: 0 8px 8px 0; font-size: 13px; }
    .outcome.bad { border-left-color: var(--bad); }
    .outcome p { margin: 0 0 4px; }
    .outcome .chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .outcome .chips span { font-size: 11px; padding: 1px 7px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); }
    .fall { color: var(--bad); font-weight: 600; }
  `],
})
export class RequetesComponent {
  private readonly game = inject(GameStateService);
  protected readonly hover = signal<'left' | 'right' | null>(null);
  protected readonly dx = signal(0);
  protected readonly dragging = signal(false);
  protected readonly last = signal<{ text: string; chips: string[]; fall?: string } | null>(null);
  private startX = 0;

  protected readonly state = computed(() => this.game.s().requetes ?? null);
  protected readonly visible = computed(() => !!this.state() && (this.state()!.hand.length > 0 || this.state()!.answered > 0 || !!this.last()));
  protected readonly hand = computed(() => this.state()?.hand ?? []);
  protected readonly card = computed((): ReqCard | null => { const id = this.hand()[0]; return id ? CARD_BY_ID.get(id) ?? null : null; });
  protected readonly pillars = computed(() => PILLARS.map(p => ({ ...p, value: Math.round(this.state()?.pillars[p.id] ?? 50) })));
  /** Les points d'aperçu : taille 0 à 3 selon l'ampleur, pour la réponse survolée ou glissée */
  protected readonly preview = computed((): Record<Pillar, number> => {
    const c = this.card();
    const side = this.dx() < -20 ? 'left' : this.dx() > 20 ? 'right' : this.hover();
    const out: Record<Pillar, number> = { peuple: 0, parti: 0, medias: 0, puissants: 0 };
    if (!c || !side) return out;
    for (const [p, v] of Object.entries(c[side].pillars) as [Pillar, number][]) out[p] = Math.abs(v) >= 14 ? 3 : Math.abs(v) >= 8 ? 2 : v ? 1 : 0;
    return out;
  });

  protected text(c: ReqCard): string { return textOf(this.game.s(), c); }

  protected choose(side: 'left' | 'right'): void {
    const c = this.card();
    if (!c) return;
    let res: RequeteResult | null = null;
    this.game.mutate((d, rng) => { res = answerRequete(d, c.id, side, rng); });
    this.hover.set(null);
    this.dx.set(0);
    const r = res as RequeteResult | null;
    if (!r) return;
    const arrows = (Object.entries(r.deltas) as [Pillar, number][]).filter(([, v]) => v).map(([p, v]) => `${PILLARS.find(x => x.id === p)!.icon} ${v > 0 ? '+' : ''}${v}`);
    this.last.set({ text: r.outcome, chips: [...arrows, ...r.summary], fall: r.fall });
  }

  protected down(e: PointerEvent): void {
    this.dragging.set(true);
    this.startX = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  protected move(e: PointerEvent): void {
    if (this.dragging()) this.dx.set(Math.max(-160, Math.min(160, e.clientX - this.startX)));
  }
  protected up(): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    const x = this.dx();
    if (x <= -90) this.choose('left');
    else if (x >= 90) this.choose('right');
    else this.dx.set(0);
  }
  protected cancel(): void { this.dragging.set(false); this.dx.set(0); }

  constructor() {
    // Toujours un état prêt (les anciennes parties n'en ont pas)
    if (!this.game.s().requetes) queueMicrotask(() => this.game.mutate(d => { requetes(d); }));
  }
}

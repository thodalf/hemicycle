import { Component, computed, inject, output, signal } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { FxService } from '../../services/fx.service';
import { LIFESTYLES, Lifestyle, XP_MONTHLY, XP_PER_ACTION, XP_PER_PERK } from '../../data/lifestyles';
import { TRAITS, TraitId, traitLabel } from '../../data/traits';
import { CATEGORY_LABELS, ActionCategory } from '../../models/game.models';
import { chooseLifestyle, perksIn } from '../../engine/character';

/** Tout sur les styles de vie : portraits, avantages, progression, choix */
@Component({
  selector: 'app-lifestyle-modal',
  template: `
    <div class="overlay" role="dialog" aria-modal="true" aria-label="Styles de vie" (click)="close.emit()">
      <section class="sheet" (click)="$event.stopPropagation()">
        <header>
          <div><span class="eyebrow">Votre façon de faire de la politique</span><h2>Styles de vie</h2></div>
          <button class="btn small" (click)="close.emit()" aria-label="Fermer">✕</button>
        </header>
        <p class="intro">Un style de vie gagne un peu d’expérience chaque mois, et davantage quand vos actions s’y rattachent (trois actions comptées par mois au plus) : il faut deux bonnes années pour aller au bout de l’arbre. Chaque palier débloque un avantage permanent ; au bout de l’arbre, un trait pour la vie. Changer de style remet l’expérience en cours à zéro, mais vous gardez tous les avantages acquis.</p>
        @if (current(); as c) {
          <div class="now">
            <span class="big">{{ c.def.icon }}</span>
            <div><strong>{{ c.def.label }}</strong> <small class="muted">· {{ c.done }}/{{ c.def.perks.length }} avantages</small>
              @if (c.done < c.def.perks.length) {
                <span class="xp"><i [style.width.%]="c.pct"></i></span>
                <small class="muted">Prochain avantage : {{ c.def.perks[c.done].label }} — {{ c.xp }}/{{ xpPer }} d’expérience (environ {{ c.months }} mois)</small>
              } @else { <small class="good-t">Arbre terminé : trait « {{ trait(c.def.trait).label }} » acquis.</small> }
            </div>
          </div>
        }
        <div class="list">
          @for (l of lifestyles; track l.id) {
            <article class="ls" [class.on]="l.id === currentId()" [class.open]="openId() === l.id">
              <button type="button" class="head" (click)="openId.set(openId() === l.id ? null : l.id)" [attr.aria-expanded]="openId() === l.id">
                <span class="ic">{{ l.icon }}</span>
                <span class="t"><strong>{{ l.label }}</strong><small>{{ l.tagline }}</small></span>
                <span class="dots">@for (p of l.perks; track p.id) { <i [class.got]="has(p.id)"></i> }</span>
              </button>
              @if (openId() === l.id) {
                <div class="body">
                  <p>{{ l.desc }}</p>
                  <p class="who">🎯 {{ l.forWho }}</p>
                  <p class="cats">Expérience doublée avec les actions : @for (c of l.categories; track c) { <span class="chip">{{ cat(c) }}</span> }</p>
                  <ol class="tree">
                    @for (p of l.perks; track p.id; let i = $index) {
                      <li [class.got]="has(p.id)" [class.next]="!has(p.id) && i === done(l)"><b>{{ has(p.id) ? '✓' : i + 1 }}</b><span><strong>{{ p.label }}</strong><small>{{ p.desc }}</small></span></li>
                    }
                    <li class="final" [class.got]="done(l) >= l.perks.length"><b>{{ trait(l.trait).icon }}</b><span><strong>Trait : {{ trait(l.trait).label }}</strong><small>{{ trait(l.trait).desc }}</small></span></li>
                  </ol>
                  @if (l.id === currentId()) { <span class="chip good">Votre style actuel</span> }
                  @else if (confirm() === l.id) {
                    <div class="confirm"><span>L’expérience en cours ({{ xpNow() }}) sera perdue. Les avantages déjà acquis restent.</span>
                      <span class="btns"><button class="btn small primary" (click)="choose(l, $event)">Adopter « {{ l.label }} »</button><button class="btn small" (click)="confirm.set(null)">Annuler</button></span></div>
                  } @else { <button class="btn small primary" (click)="currentId() && xpNow() > 0 ? confirm.set(l.id) : choose(l, $event)">Adopter ce style</button> }
                </div>
              }
            </article>
          }
        </div>
      </section>
    </div>
  `,
  styles: `
    .overlay { position: fixed; inset: 0; z-index: 30; background: rgba(10, 12, 18, .6); backdrop-filter: blur(3px); display: grid; place-items: start center; overflow-y: auto; padding: 24px 16px; }
    .sheet { width: 100%; max-width: 640px; background: var(--surface); border-radius: 14px; box-shadow: 0 24px 60px -20px rgba(0,0,0,.5); padding: 16px 18px 20px; display: grid; gap: 12px; align-content: start; }
    header { display: flex; justify-content: space-between; align-items: start; gap: 8px; h2 { margin: 0; font: 700 22px var(--font-display); } }
    .intro { margin: 0; font-size: 13px; color: var(--ink-2); }
    .now { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: center; padding: 10px; border-radius: 10px; background: var(--surface-2); font-size: 13px;
      .big { font-size: 30px; } div { display: grid; gap: 4px; } .good-t { color: var(--good); } }
    .xp { display: block; height: 7px; border-radius: 4px; background: var(--line); overflow: hidden; i { display: block; height: 100%; background: var(--accent); transition: width .4s ease; } }
    .list { display: grid; gap: 6px; }
    .ls { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; &.on { border-color: var(--accent); box-shadow: inset 3px 0 0 var(--accent); } }
    .head { width: 100%; display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; padding: 10px 12px; border: 0; background: none; color: var(--ink); text-align: left; cursor: pointer; font: inherit;
      &:hover { background: var(--surface-2); } .ic { font-size: 24px; } .t { display: grid; strong { font: 700 15px var(--font-display); } small { font-size: 12px; color: var(--ink-3); } } }
    .dots { display: flex; gap: 3px; i { width: 9px; height: 9px; border-radius: 50%; border: 1px solid var(--ink-3); } i.got { background: var(--good); border-color: var(--good); } }
    .body { padding: 0 12px 12px; display: grid; gap: 8px; > .chip, > .btn { justify-self: start; } font-size: 13px; animation: open .25s ease; p { margin: 0; } .who { color: var(--ink-2); } .cats { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; color: var(--ink-2); font-size: 12px; } }
    @keyframes open { from { opacity: 0; transform: translateY(-4px); } }
    .tree { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px;
      li { display: grid; grid-template-columns: 26px 1fr; gap: 8px; align-items: start; padding: 6px 8px; border-radius: 8px; background: var(--surface-2); opacity: .75;
        b { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); border: 1px solid var(--line); font-size: 12px; }
        span { display: grid; small { color: var(--ink-3); font-size: 12px; } } }
      li.got { opacity: 1; b { background: var(--good); color: var(--surface); border-color: var(--good); } }
      li.next { opacity: 1; box-shadow: inset 0 0 0 1px var(--accent); }
      li.final { background: color-mix(in srgb, var(--accent) 8%, var(--surface)); } }
    .confirm { display: grid; gap: 6px; padding: 8px; border-radius: 8px; background: color-mix(in srgb, var(--accent) 10%, var(--surface)); font-size: 12.5px; }
    .btns { display: flex; flex-wrap: wrap; gap: 6px; }
  `,
})
export class LifestyleModalComponent {
  private readonly game = inject(GameStateService);
  private readonly fx = inject(FxService);
  readonly close = output<void>();
  protected readonly lifestyles = LIFESTYLES;
  protected readonly xpPer = XP_PER_PERK;
  protected readonly confirm = signal<string | null>(null);
  protected readonly currentId = computed(() => this.game.player().lifestyle?.id ?? null);
  protected readonly openId = signal<string | null>(this.game.player().lifestyle?.id ?? LIFESTYLES[0].id);
  protected readonly xpNow = computed(() => Math.round(this.game.player().lifestyle?.xp ?? 0));
  protected readonly current = computed(() => {
    const ls = this.game.player().lifestyle;
    const def = ls ? LIFESTYLES.find(l => l.id === ls.id) : undefined;
    if (!ls || !def) return null;
    const done = perksIn(this.game.s(), def.id);
    return { def, done, xp: Math.round(ls.xp), pct: Math.min(100, (ls.xp / XP_PER_PERK) * 100), months: Math.max(1, Math.ceil((XP_PER_PERK - ls.xp) / (XP_MONTHLY + XP_PER_ACTION * 2))) };
  });

  protected has(id: string) { return !!this.game.player().lifestyle?.perks.includes(id); }
  protected done(l: Lifestyle) { return perksIn(this.game.s(), l.id); }
  protected trait(id: string) { const t = TRAITS[id as TraitId]; return { icon: t?.icon ?? '🏅', label: t ? traitLabel(id as TraitId, this.game.player().gender) : id, desc: t?.desc ?? '' }; }
  protected cat(c: string) { return CATEGORY_LABELS[c as ActionCategory] ?? c; }

  protected choose(l: Lifestyle, ev: Event): void {
    this.game.mutate(d => chooseLifestyle(d, l.id));
    this.confirm.set(null);
    this.fx.stamp(l.label, 'good', l.tagline);
    this.fx.burstAt(ev.currentTarget as Element, 'good');
  }
}

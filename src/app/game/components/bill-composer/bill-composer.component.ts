import { Component, computed, inject, signal } from '@angular/core';
import { DOMAINS, DOMAIN_LABELS, Domain } from '../../models/game.models';
import { GameStateService } from '../../services/game-state.service';
import { FxService } from '../../services/fx.service';
import { BillDraft, SCALE_LABELS, SUGGESTED_TITLES, canAfford, canDraft, leanLabel, proposeBill, quoteBill } from '../../engine/custom-bill';
import { fr } from '../../engine/rng';

/**
 * Rédiger un projet de loi sur mesure : nom, domaine, orientation, ampleur.
 * Le jeu chiffre le texte en direct (coût budgétaire, prix politique,
 * opinion, chances d'adoption) ; « Déposer » l'envoie à l'Assemblée.
 */
@Component({
  selector: 'app-bill-composer',
  template: `
    <section class="composer" [class.open]="open()">
      <button type="button" class="head" (click)="open.set(!open())" [attr.aria-expanded]="open()">
        <span class="ico" aria-hidden="true">📜</span>
        <span class="t"><strong>Rédiger un projet de loi sur mesure</strong><small>Vous choisissez le nom, le domaine, l’orientation et l’ampleur ; le jeu chiffre le coût.</small></span>
        <span class="chev" aria-hidden="true">{{ open() ? '▴' : '▾' }}</span>
      </button>
      @if (open()) {
        <div class="body">
          <label class="field">
            <span class="lbl">Nom du texte</span>
            <span class="row">
              <input type="text" maxlength="80" [value]="title()" (input)="title.set($any($event.target).value)" [placeholder]="suggestions()[0]" />
              <button type="button" class="btn small" (click)="suggest()" title="Proposer un nom">🎲</button>
            </span>
          </label>

          <div class="field">
            <span class="lbl">Domaine</span>
            <div class="chips">
              @for (dm of domains; track dm) {
                <button type="button" class="chip-btn" [class.on]="domain() === dm" (click)="setDomain(dm)">
                  {{ label(dm) }} <small class="mono">{{ mastery(dm) }}</small>
                </button>
              }
            </div>
          </div>

          <div class="field">
            <span class="lbl">Orientation : <b [class]="lean() < -15 ? 't-gauche' : lean() > 15 ? 't-droite' : ''">{{ leanText() }}</b></span>
            <div class="slider">
              <input type="range" min="-100" max="100" step="5" [value]="lean()" (input)="lean.set(+$any($event.target).value)" aria-label="Orientation du texte" />
              <span class="mark party" [style.left.%]="(game.s().party.position + 100) / 2" title="Ligne de votre parti">▲</span>
              <span class="mark me" [style.left.%]="(game.player().stance + 100) / 2" title="Votre ligne">●</span>
            </div>
            <span class="ends"><span>Gauche</span><small class="muted">▲ votre parti · ● vous</small><span>Droite</span></span>
          </div>

          <div class="field">
            <span class="lbl">Ampleur</span>
            <div class="seg">
              @for (sc of scales; track sc) {
                <button type="button" [class.on]="scale() === sc" (click)="scale.set(sc)">{{ scaleLabel(sc) }}</button>
              }
            </div>
          </div>

          @let q = quote();
          <div class="quote" [class.bump]="bump()">
            <span class="eyebrow">Le jeu chiffre votre texte</span>
            <div class="grid">
              <div class="cell" [class.bad]="q.budget > 0" [class.good]="q.budget < 0">
                <small>Coût budgétaire</small>
                <strong class="mono">{{ q.budget >= 0 ? '+' : '−' }}{{ num(abs(q.budget)) }} Md€/an</strong>
                <small>déficit {{ q.deficit >= 0 ? '+' : '−' }}{{ num(abs(q.deficit), 2) }} pt</small>
              </div>
              <div class="cell">
                <small>Prix politique</small>
                <strong class="mono">◆ {{ q.politicalCapital }}</strong>
                <small>{{ q.ap }} PA · ⚡ {{ q.energy }}</small>
              </div>
              <div class="cell" [class.good]="q.opinion >= 55" [class.bad]="q.opinion < 45">
                <small>Opinion favorable</small>
                <strong class="mono">{{ q.opinion }} %</strong>
                <small>des Français</small>
              </div>
              <div class="cell" [class.good]="q.adoptedChance >= 60" [class.bad]="q.adoptedChance < 40">
                <small>Chances d’adoption</small>
                <strong class="mono">{{ q.adoptedChance }} %</strong>
                <span class="bar"><i [style.width.%]="q.adoptedChance"></i></span>
              </div>
            </div>
            @if (q.notes.length) { <ul class="notes">@for (n of q.notes; track n) { <li>{{ n }}</li> }</ul> }
          </div>

          <div class="cta">
            @if (block(); as b) { <span class="reason">{{ b }}</span> }
            <button class="btn primary" [disabled]="!!block()" (click)="submit($event)">Déposer à l’Assemblée</button>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .composer { border: 1px solid var(--line); border-radius: 12px; margin: 10px 0; background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 6%, var(--surface)), var(--surface)); overflow: hidden; }
    .composer.open { box-shadow: var(--shadow); }
    .head { width: 100%; display: flex; gap: 10px; align-items: center; text-align: left; padding: 10px 12px; border: 0; background: none; cursor: pointer; color: var(--ink);
      .ico { font-size: 24px; } .t { flex: 1; display: grid; small { color: var(--ink-3); font-size: 12px; } } .chev { color: var(--ink-3); } }
    .body { padding: 4px 12px 12px; display: grid; gap: 12px; animation: unfold .25s ease; }
    @keyframes unfold { from { opacity: 0; transform: translateY(-6px); } }
    .field { display: grid; gap: 5px; }
    .lbl { font-size: 12px; font-weight: 600; color: var(--ink-2); }
    .row { display: flex; gap: 6px; input { flex: 1; min-width: 0; } }
    input[type=text] { font: inherit; padding: 7px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .chip-btn { font: 500 12px var(--font-body); padding: 4px 9px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer;
      small { color: var(--ink-3); } &.on { background: var(--accent); color: var(--surface); border-color: var(--accent); small { color: rgba(255,255,255,.75); } } }
    .slider { position: relative; padding-top: 12px;
      input { width: 100%; accent-color: var(--accent); }
      .mark { position: absolute; top: 0; transform: translateX(-50%); font-size: 10px; line-height: 1; pointer-events: none; }
      .party { color: var(--ink-2); } .me { color: var(--accent); } }
    .ends { display: flex; justify-content: space-between; font-size: 11px; color: var(--ink-3); span:first-child { color: var(--left); } span:last-child { color: var(--right); } }
    .t-gauche { color: var(--left); } .t-droite { color: var(--right); }
    .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; width: fit-content;
      button { font: 500 12.5px var(--font-body); padding: 6px 12px; border: 0; background: var(--surface); color: var(--ink); cursor: pointer; }
      button + button { border-left: 1px solid var(--line); } button.on { background: var(--accent); color: var(--surface); } }
    .quote { padding: 10px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--line); display: grid; gap: 8px; }
    .quote.bump { animation: quote-bump .4s ease; }
    @keyframes quote-bump { 40% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); } }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .cell { display: grid; gap: 1px; padding: 6px 8px; border-radius: 8px; background: var(--surface); border: 1px solid var(--line);
      small { font-size: 10.5px; color: var(--ink-3); } strong { font-size: 16px; }
      &.good strong { color: var(--good); } &.bad strong { color: var(--bad); }
      .bar { height: 5px; border-radius: 3px; background: var(--line); overflow: hidden; margin-top: 3px; i { display: block; height: 100%; background: var(--accent); transition: width .4s ease; } } }
    .notes { margin: 0; padding-left: 16px; font-size: 12px; color: var(--ink-2); }
    .cta { display: flex; gap: 10px; align-items: center; justify-content: flex-end; flex-wrap: wrap; .reason { font-size: 12px; color: var(--bad); } }
    @media (max-width: 640px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  `,
})
export class BillComposerComponent {
  protected readonly game = inject(GameStateService);
  private readonly fx = inject(FxService);

  protected readonly domains = DOMAINS;
  protected readonly scales = [1, 2, 3] as const;
  protected readonly open = signal(false);
  protected readonly title = signal('');
  protected readonly domain = signal<Domain>(this.game.s().agendaDomain);
  protected readonly lean = signal(Math.round(this.game.player().stance / 5) * 5);
  protected readonly scale = signal<1 | 2 | 3>(2);
  protected readonly bump = signal(false);

  protected readonly suggestions = computed(() => SUGGESTED_TITLES[this.domain()]);
  protected readonly draft = computed<BillDraft>(() => ({ title: this.title() || this.suggestions()[0], domain: this.domain(), lean: this.lean(), scale: this.scale() }));
  protected readonly quote = computed(() => quoteBill(this.game.s(), this.draft()));
  protected readonly leanText = computed(() => leanLabel(this.lean()));
  protected readonly block = computed(() => canDraft(this.game.s()) ?? canAfford(this.game.s(), this.quote()));

  protected label(d: Domain) { return DOMAIN_LABELS[d]; }
  protected mastery(d: Domain) { return Math.round(this.game.player().dossiers[d]?.mastery ?? 0); }
  protected scaleLabel(s: 1 | 2 | 3) { return SCALE_LABELS[s]; }
  protected abs(n: number) { return Math.abs(n); }
  protected num(n: number, digits = 1) { return fr(n, digits); }

  protected setDomain(d: Domain): void {
    const wasSuggested = !this.title() || SUGGESTED_TITLES[this.domain()].includes(this.title());
    this.domain.set(d);
    if (wasSuggested) this.title.set('');
    this.pulse();
  }

  protected suggest(): void {
    const list = this.suggestions();
    const i = list.indexOf(this.title());
    this.title.set(list[(i + 1) % list.length]);
  }

  private pulse(): void {
    this.bump.set(false);
    setTimeout(() => this.bump.set(true));
  }

  protected submit(ev: Event): void {
    const draft = this.draft();
    let out: string[] = [];
    this.game.mutate((d, rng) => { out = proposeBill(d, draft, rng); });
    if (!out.length) return;
    this.fx.burstAt(ev.currentTarget as Element, 'good');
    this.fx.newspaper(draft.title.toUpperCase(), 'PROJET DE LOI DÉPOSÉ');
    this.open.set(false);
    this.title.set('');
  }
}

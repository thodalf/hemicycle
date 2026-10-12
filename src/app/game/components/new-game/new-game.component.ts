import { Component, computed, inject, output, signal } from '@angular/core';
import { PARTIES, defaultTarget, stanceLabel } from '../../data/world';
import { GameStateService } from '../../services/game-state.service';
import { OutletKind, ScenarioId } from '../../models/game.models';
import { OUTLETS } from '../../data/press';
import { PARTY_COLORS } from '../../engine/founding';
import { PartyFormComponent } from '../party-form/party-form.component';

@Component({
  selector: 'app-new-game',
  imports: [PartyFormComponent],
  template: `
    <main class="wrap">
      <button class="back" type="button" (click)="back.emit()">← Mes parties</button>
      <div class="eyebrow">Simulateur de carrière politique · emplacement {{ slot() }}</div>
      <h1>Hémicycle</h1>
      <p class="lede">De militant·e de section à l’Élysée. Chaque semaine compte : terrain, médias, dossiers, courants, réseau.
        Les rivaux, eux, ne dorment jamais.</p>

      <form class="card" (submit)="start($event)">
        <label class="field">
          <span class="eyebrow">Votre nom</span>
          <input type="text" [value]="name()" (input)="name.set($any($event.target).value)" maxlength="40" />
        </label>

        <fieldset class="field">
          <legend class="eyebrow">Vous êtes</legend>
          <div class="seg">
            <button type="button" [class.on]="gender() === 'femme'" (click)="gender.set('femme')">une femme</button>
            <button type="button" [class.on]="gender() === 'homme'" (click)="gender.set('homme')">un homme</button>
          </div>
        </fieldset>

        <fieldset class="field">
          <legend class="eyebrow">Scénario</legend>
          <div class="scenarios">
            <button type="button" class="scenario" [class.on]="scenario() === 'carriere'" (click)="scenario.set('carriere')">
              <strong>Carrière complète</strong><small>De militant·e de section jusqu’à l’Élysée.</small>
            </button>
            <button type="button" class="scenario" [class.on]="scenario() === 'presidentielle'" (click)="scenario.set('presidentielle')">
              <strong>Campagne présidentielle</strong><small>Candidat·e investi·e et chef·fe de parti : programme, 8 semaines, budget du parti.</small>
            </button>
            <button type="button" class="scenario" [class.on]="scenario() === 'bercy'" (click)="scenario.set('bercy')">
              <strong>Ministre à Bercy</strong><small>Bouclez le budget de la France et faites-le voter à l’Assemblée.</small>
            </button>
            <button type="button" class="scenario" [class.on]="scenario() === 'royaute'" (click)="scenario.set('royaute')">
              <strong>Retour à la royauté</strong><small>Menez un mouvement royaliste : référendum ou coup de force pour abolir la République.</small>
            </button>
            <button type="button" class="scenario" [class.on]="scenario() === 'franc_macon'" (click)="scenario.set('franc_macon')">
              <strong>Franc-maçon</strong><small>Élu·e initié·e : gravir les grades de la loge et les marches du pouvoir.</small>
            </button>
            <button type="button" class="scenario" [class.on]="scenario() === 'editorialiste'" (click)="scenario.set('editorialiste')">
              <strong>Éditorialiste</strong><small>Journaliste politique : de pigiste à directeur·rice de la rédaction. Faire et défaire les carrières.</small>
            </button>
            <button type="button" class="scenario" [class.on]="scenario() === 'infiltre'" (click)="scenario.set('infiltre')">
              <strong>Infiltré·e</strong><small>Encarté·e chez l’adversaire sous une fausse identité : espionner, saboter, transmettre… et ne jamais se faire prendre.</small>
            </button>
          </div>
        </fieldset>

        @if (scenario() === 'editorialiste') {
          <fieldset class="field">
            <legend class="eyebrow">Votre média</legend>
            <div class="scenarios">
              @for (o of outlets; track o.kind) {
                <button type="button" class="scenario" [class.on]="outlet() === o.kind" (click)="outlet.set(o.kind)">
                  <strong>{{ o.name }} <span class="muted">· {{ o.label }}</span></strong><small>{{ o.pitch }}</small>
                </button>
              }
            </div>
          </fieldset>
        }

        <fieldset class="field">
          <legend class="eyebrow">{{ scenario() === 'editorialiste' ? 'Votre sensibilité politique' : scenario() === 'infiltre' ? 'Votre vrai camp' : 'Votre parti' }} · de gauche à droite{{ scenario() === 'royaute' ? ' (ignoré : vous dirigez la Ligue de la Couronne)' : '' }}</legend>
          <div class="parties">
            @for (p of parties; track p.id) {
              <button type="button" class="party" [class.on]="partyId() === p.id" (click)="partyId.set(p.id)">
                <span class="swatch" [style.background]="p.color"></span>
                <span class="pname">{{ p.name }}<small>{{ label(p.position) }}</small></span>
              </button>
            }
            @if (scenario() !== 'royaute' && scenario() !== 'infiltre') {
              <button type="button" class="party create" [class.on]="partyId() === 'perso'" (click)="partyId.set('perso')">
                <span class="swatch plus">+</span>
                <span class="pname">Fonder mon propre parti<small>Vous en êtes le chef dès le départ. Petit, pauvre, mais à vous.</small></span>
              </button>
            }
          </div>
          @if (partyId() === 'perso' && scenario() !== 'royaute' && scenario() !== 'infiltre') {
            <div class="custom card">
              <app-party-form [(name)]="partyName" [(color)]="partyColor" [(position)]="partyPosition" />
            </div>
          }
        </fieldset>

        @if (scenario() === 'infiltre') {
          <fieldset class="field">
            <legend class="eyebrow">Parti à infiltrer</legend>
            <div class="parties">
              @for (p of targets(); track p.id) {
                <button type="button" class="party" [class.on]="target() === p.id" (click)="targetId.set(p.id)">
                  <span class="swatch" [style.background]="p.color"></span>
                  <span class="pname">{{ p.name }}<small>{{ label(p.position) }} · écart idéologique {{ gap(p.position) }}</small></span>
                </button>
              }
            </div>
            <small class="muted hint">Plus l’écart est grand, plus il sera dur de jouer le jeu sans se trahir.</small>
          </fieldset>
        }

        <button class="btn primary go" type="submit">Prendre sa carte →</button>
      </form>
    </main>
  `,
  styles: `
    .wrap { max-width: 560px; margin: 0 auto; padding: 40px 16px 64px; }
    .back { background: none; border: 0; padding: 0; margin-bottom: 18px; color: var(--accent); cursor: pointer; font: inherit; }
    h1 { font-size: 56px; line-height: 1; margin: 8px 0 12px; }
    .lede { color: var(--ink-2); font-size: 15px; margin: 0 0 24px; }
    form { display: grid; gap: 18px; padding: 22px; }
    fieldset { border: 0; padding: 0; margin: 0; }
    .field { display: grid; gap: 8px; }
    input { padding: 9px 10px; font-size: 15px; }
    .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; width: fit-content;
      button { border: 0; background: var(--surface); padding: 8px 14px; cursor: pointer; }
      button.on { background: var(--accent); color: var(--surface); } }
    .parties { display: grid; grid-template-columns: 1fr; gap: 6px; }
    .party { display: flex; align-items: center; gap: 8px; text-align: left; padding: 10px 12px; border-radius: 8px;
      border: 1px solid var(--line); background: var(--surface); cursor: pointer;
      &.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); } }
    .scenarios { display: grid; grid-template-columns: 1fr; gap: 6px; }
    .scenario { display: grid; gap: 3px; text-align: left; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--line);
      background: var(--surface); cursor: pointer; small { color: var(--ink-3); font-size: 12px; line-height: 1.35; }
      &.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); } }
    .pname { display: grid; small { color: var(--ink-3); font-size: 12px; } }
    .swatch { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
    .swatch.plus { display: grid; place-items: center; width: 12px; height: 12px; font-size: 13px; font-weight: 700; color: var(--accent); }
    .party.create { border-style: dashed; }
    .custom { padding: 14px; margin-top: 6px; }
    .go { padding: 11px; font-size: 15px; }
    .hint { font-size: 12px; }
    @media (max-width: 480px) { h1 { font-size: 42px; } }
  `,
})
export class NewGameComponent {
  private readonly game = inject(GameStateService);
  readonly back = output<void>();
  protected readonly slot = this.game.slot;
  protected readonly parties = PARTIES;
  protected readonly name = signal('Camille Martin');
  protected readonly gender = signal<'femme' | 'homme'>('femme');
  protected readonly partyId = signal('ut');
  protected readonly scenario = signal<ScenarioId>('carriere');
  protected readonly outlet = signal<OutletKind>('radio');
  protected readonly targetId = signal<string | null>(null);
  private readonly home = computed(() => this.partyId() === 'perso' ? 'ut' : this.partyId());
  protected readonly targets = computed(() => PARTIES.filter(p => p.id !== this.home()));
  protected readonly target = computed(() => {
    const t = this.targetId();
    return t && t !== this.home() ? t : defaultTarget(this.home());
  });
  protected gap(pos: number): number {
    return Math.abs(pos - (PARTIES.find(p => p.id === this.home())?.position ?? 0));
  }
  protected readonly outlets = Object.values(OUTLETS);
  protected readonly partyName = signal('');
  protected readonly partyColor = signal(PARTY_COLORS[5]);
  protected readonly partyPosition = signal(0);

  protected label(v: number) {
    const l = stanceLabel(v);
    return l.charAt(0).toUpperCase() + l.slice(1);
  }

  protected start(e: Event): void {
    e.preventDefault();
    const custom = this.partyId() === 'perso' && this.scenario() !== 'royaute' && this.scenario() !== 'infiltre';
    this.game.newGame({
      name: this.name(), gender: this.gender(), partyId: custom ? 'ut' : this.scenario() === 'infiltre' ? this.home() : this.partyId(), scenario: this.scenario(),
      outlet: this.outlet(),
      targetPartyId: this.scenario() === 'infiltre' ? this.target() : undefined,
      customParty: custom ? { name: this.partyName().trim() || 'Mouvement citoyen', color: this.partyColor(), position: this.partyPosition() } : undefined,
    });
  }
}

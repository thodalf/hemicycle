import { Component, inject, output, signal } from '@angular/core';
import { PARTIES, stanceLabel } from '../../data/world';
import { GameStateService } from '../../services/game-state.service';
import { PARTY_COLORS } from '../../engine/founding';
import { PartyFormComponent } from '../party-form/party-form.component';
import { DIFFICULTIES, Difficulty } from '../../engine/difficulty';

@Component({
  selector: 'app-new-game',
  imports: [PartyFormComponent],
  template: `
    <main class="wrap">
      <button class="back" type="button" (click)="back.emit()">← Mes parties</button>
      <div class="eyebrow">Simulateur de carrière politique · emplacement {{ slot() }}</div>
      <h1>Hémicycle</h1>
      <p class="lede">De militant·e de section à l’Élysée. Chaque mois compte : terrain, médias, dossiers, courants, réseau.
        Les rivaux, eux, ne dorment jamais. Les victoires et les revers ne sont que des chapitres : la partie ne s’achève qu’à votre mort.</p>

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
          <legend class="eyebrow">Votre parti · de gauche à droite</legend>
          <div class="parties">
            @for (p of parties; track p.id) {
              <button type="button" class="party" [class.on]="partyId() === p.id" (click)="partyId.set(p.id)">
                <span class="swatch" [style.background]="p.color"></span>
                <span class="pname">{{ p.name }}<small>{{ label(p.position) }}</small></span>
              </button>
            }
            <button type="button" class="party create" [class.on]="partyId() === 'perso'" (click)="partyId.set('perso')">
              <span class="swatch plus">+</span>
              <span class="pname">Fonder mon propre parti<small>Vous en êtes le chef dès le départ. Petit, pauvre, mais à vous.</small></span>
            </button>
          </div>
          @if (partyId() === 'perso') {
            <div class="custom card">
              <app-party-form [(name)]="partyName" [(color)]="partyColor" [(position)]="partyPosition" />
            </div>
          }
        </fieldset>

        <fieldset class="field">
          <legend class="eyebrow">Difficulté</legend>
          <div class="diffs">
            @for (x of difficulties; track x.id) {
              <button type="button" class="diff" [class.on]="difficulty() === x.id" (click)="difficulty.set(x.id)" [attr.aria-pressed]="difficulty() === x.id">
                <span class="dic" aria-hidden="true">{{ x.icon }}</span><span class="pname">{{ x.label }}<small>{{ x.blurb }}</small></span>
              </button>
            }
          </div>
        </fieldset>

        <p class="muted hint">Une seule partie, une vie entière : guerres, complots, premier contact, royauté, épidémies… tout peut arriver en cours de route.</p>

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
    .diffs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
    @media (max-width: 420px) { .diffs { grid-template-columns: 1fr; } }
    .diff { display: flex; gap: 8px; align-items: flex-start; text-align: left; padding: 9px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); cursor: pointer; color: var(--ink); font: inherit;
      &.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); } .dic { font-size: 18px; line-height: 1.2; } }
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
  protected readonly partyName = signal('');
  protected readonly partyColor = signal(PARTY_COLORS[5]);
  protected readonly partyPosition = signal(0);
  protected readonly difficulties = DIFFICULTIES;
  protected readonly difficulty = signal<Difficulty>('normal');

  protected label(v: number) {
    const l = stanceLabel(v);
    return l.charAt(0).toUpperCase() + l.slice(1);
  }

  protected start(e: Event): void {
    e.preventDefault();
    const custom = this.partyId() === 'perso';
    this.game.newGame({
      name: this.name(), gender: this.gender(), partyId: custom ? 'ut' : this.partyId(), scenario: 'carriere', difficulty: this.difficulty(),
      customParty: custom ? { name: this.partyName().trim() || 'Mouvement citoyen', color: this.partyColor(), position: this.partyPosition() } : undefined,
    });
  }
}

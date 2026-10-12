import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { GRADES, GRADE_REQUIREMENTS } from '../../engine/scenarios';
import { GameStateService } from '../../services/game-state.service';
import { OUTLETS, PRESS_GRADES, PRESS_REQUIREMENTS } from '../../data/press';
import { stanceLabel } from '../../data/world';
import { MOLE_GOAL } from '../../engine/mole';

/** Tableau de bord des scénarios « Retour à la royauté » et « Franc-maçon » */
@Component({
  selector: 'app-scenario-panel',
  imports: [DecimalPipe],
  template: `
    @if (game.s().mole; as m) {
      <section class="card mole">
        <div class="card-title"><span class="radar-title"><span class="radar" aria-hidden="true"></span>Mission d’infiltration</span><span class="chip bad">Top secret</span></div>
        <p class="muted small">Vrai camp : <strong [style.color]="m.homeColor">{{ m.homeName }}</strong> · encarté·e chez
          <strong [style.color]="game.s().party.color">{{ game.s().party.name }}</strong> · officier traitant : {{ m.handler }}</p>
        <div class="gauges">
          <div class="g">
            <div class="row"><span>Couverture</span><span class="mono">{{ m.cover | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill" [class.low]="m.cover < 30" [class.ok]="m.cover >= 60" [style.width.%]="m.cover"></span><i class="mark" style="left: 45%"></i></div>
            <small class="muted">Sous 45, le service d’ordre enquête. À 0, vous êtes démasqué·e.</small>
          </div>
          <div class="g">
            <div class="row"><span>Rapports transmis</span><span class="mono">{{ m.delivered }} / {{ goal }}</span></div>
            <div class="track"><span class="fill ok" [style.width.%]="Math.min(100, m.delivered / goal * 100)"></span></div>
            <small class="muted">En main : <strong>{{ m.intel }}</strong> renseignement(s) — à transmettre à l’officier.</small>
          </div>
          <div class="g">
            <div class="row"><span>Confiance de l’officier</span><span class="mono">{{ m.handlerTrust | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill" [class.low]="m.handlerTrust < 25" [style.width.%]="m.handlerTrust"></span></div>
            <small class="muted">Sabotage infligé : {{ m.sabotage }} · écart de ligne : {{ gap() }} pts{{ gap() > 15 ? ' (suspect)' : '' }}.</small>
          </div>
        </div>
        <p class="muted small next">
          @if (m.delivered >= goal) { <strong>Prêt·e :</strong> le grand déballage est disponible (onglet Infiltration). }
          @else { Victoire : transmettre {{ goal }} renseignements puis réussir le grand déballage — ou prendre la tête du parti infiltré. }
        </p>
      </section>
    }
    @if (game.s().press; as p) {
      <section class="card press">
        <div class="card-title"><span>{{ p.outlet }}</span>
          <span class="chip accent">{{ game.s().scenario === 'editorialiste' ? 'Objectif : diriger la rédaction' : outletLabel() }}</span></div>
        <p class="muted small">{{ outletLabel() }} · propriétaire : {{ p.owner }} · ligne {{ stance(p.ligne) }} ·
          <strong class="mono">{{ p.salary | number: '1.0-0' }} €/sem.</strong></p>
        <ol class="grades">
          @for (g of pressGrades; track g; let i = $index) {
            <li [class.done]="i < p.grade" [class.now]="i === p.grade">{{ g }}</li>
          }
        </ol>
        <div class="gauges">
          <div class="g">
            <div class="row"><span>Audience</span><span class="mono">{{ p.audience | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill" [class.low]="p.audience < 12" [style.width.%]="p.audience"></span>
              @if (pressNext(); as n) { <i class="mark" [style.left.%]="n.audience"></i> }</div>
            <small class="muted">Chroniques, émissions, polémiques. Sous 8 (avec une réputation faible), c’est la porte.</small>
          </div>
          <div class="g">
            <div class="row"><span>Réputation</span><span class="mono">{{ p.reputation | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill ok" [style.width.%]="p.reputation"></span>
              @if (pressNext(); as n) { <i class="mark" [style.left.%]="n.reputation"></i> }</div>
            <small class="muted">Éditos solides, enquêtes, interviews.</small>
          </div>
          <div class="g">
            <div class="row"><span>Indépendance</span><span class="mono">{{ p.independance | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill" [class.low]="p.independance < 30" [style.width.%]="p.independance"></span></div>
            <small class="muted">Écart avec la ligne du média : {{ gap() }} pts{{ gap() > 35 ? ' — le propriétaire s’agace' : '' }}.</small>
          </div>
        </div>
        <p class="muted small next">Scoops : <strong>{{ p.scoops }}</strong>
          @if (pressNext(); as n) {
            · Prochain poste ({{ pressGrades[p.grade + 1] }}) : audience {{ n.audience }}, réputation {{ n.reputation }}, {{ n.scoops }} scoop(s){{ n.influence ? ', influence ' + n.influence : '' }}.
          } @else if (game.s().scenario === 'editorialiste') {
            · Victoire : audience 65 et influence 60.
          }
        </p>
      </section>
    }
    @if (game.s().crown; as c) {
      <section class="card crown">
        <div class="card-title"><span>La Couronne</span><span class="chip warn">Objectif : restaurer la monarchie</span></div>
        <p class="muted small">Prétendant : <strong>{{ c.pretendant }}</strong></p>
        <div class="gauges">
          @for (g of crownGauges(); track g.label) {
            <div class="g">
              <div class="row"><span>{{ g.label }}</span><span class="mono">{{ g.value | number: '1.0-0' }}{{ g.unit }}</span></div>
              <div class="track"><span class="fill" [style.width.%]="g.value" [class.ok]="g.value >= g.target"></span><i class="mark" [style.left.%]="g.target"></i></div>
              <small class="muted">{{ g.hint }}</small>
            </div>
          }
        </div>
        <div class="paths">
          <div [class.ready]="referendumReady()"><strong>Voie légale</strong> · référendum : soutien 45 % et légitimité 55
            <span class="chip" [class.good]="referendumReady()">{{ referendumReady() ? 'Possible' : 'Pas encore' }}</span></div>
          <div [class.ready]="coupReady()"><strong>Voie de force</strong> · coup institutionnel : armée 70
            <span class="chip" [class.bad]="coupReady()">{{ coupReady() ? 'Possible' : 'Pas encore' }}</span></div>
        </div>
      </section>
    }
    @if (game.s().lodge; as l) {
      <section class="card lodge">
        <div class="card-title"><span>La Loge</span><span class="chip accent">Objectif : Grand Maître et ministre</span></div>
        <p class="muted small">{{ l.loge }} · {{ l.obedience }}</p>
        <ol class="grades">
          @for (g of grades; track g; let i = $index) {
            <li [class.done]="i < l.grade" [class.now]="i === l.grade">{{ g }}</li>
          }
        </ol>
        <div class="gauges">
          <div class="g">
            <div class="row"><span>Fraternité</span><span class="mono">{{ l.fraternite | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill ok" [style.width.%]="l.fraternite"></span></div>
            <small class="muted">S’érode sans tenues ni agapes.</small>
          </div>
          <div class="g">
            <div class="row"><span>Discrétion</span><span class="mono">{{ l.discretion | number: '1.0-0' }}</span></div>
            <div class="track"><span class="fill" [class.low]="l.discretion <= 20" [style.width.%]="l.discretion"></span><i class="mark" style="left: 20%"></i></div>
            <small class="muted">Sous 20, la presse risque de révéler votre appartenance.</small>
          </div>
          <div class="g">
            <div class="row"><span>Planches présentées</span><span class="mono">{{ l.planches }}</span></div>
            @if (next(); as n) {
              <small class="muted">Grade suivant : {{ n.planches }} planches, fraternité {{ n.fraternite }}{{ n.influence ? ', influence ' + n.influence : '' }}.</small>
            } @else if (l.grade === 3) {
              <small class="muted">Grand Maître : à conquérir au convent (onglet Loge).</small>
            }
          </div>
        </div>
      </section>
    }
  `,
  styles: `
    .small { font-size: 12.5px; margin: 0 0 10px; }
    .gauges { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .g { display: grid; gap: 4px; small { font-size: 11.5px; } }
    .row { display: flex; justify-content: space-between; font-size: 13px; }
    .track { position: relative; height: 7px; border-radius: 4px; background: var(--surface-2); border: 1px solid var(--line); }
    .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: var(--accent); transition: width .4s; }
    .fill.ok { background: var(--good); }
    .fill.low { background: var(--bad); }
    .mark { position: absolute; top: -4px; bottom: -4px; width: 2px; background: var(--ink); }
    .paths { display: grid; gap: 6px; margin-top: 12px; font-size: 12.5px;
      div { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 6px 10px; border-radius: 8px; background: var(--surface-2); }
      .chip { margin-left: auto; } }
    .crown { border-left: 4px solid #8a6a1f; }
    .lodge { border-left: 4px solid var(--accent); }
    .press { border-left: 4px solid #b0452f; }
    .radar-title { display: inline-flex; align-items: center; gap: 8px; }
    .radar { width: 18px; height: 18px; border-radius: 50%; border: 1px solid #2f7d4f; position: relative; overflow: hidden;
      background: radial-gradient(circle, transparent 55%, rgba(47,125,79,.15) 56%); }
    .radar::after { content: ''; position: absolute; inset: 0; background: conic-gradient(from 0deg, rgba(47,125,79,.85), transparent 30%); animation: radar 2s linear infinite; }
    @keyframes radar { to { transform: rotate(360deg); } }
    .mole .fill.low { animation: danger-pulse 1s ease-in-out infinite; }
    @keyframes danger-pulse { 50% { opacity: .45; } }
    @media (prefers-reduced-motion: reduce) { .radar::after, .mole .fill.low { animation: none; } }
    .mole { border-left: 4px solid #14181f; background-image: repeating-linear-gradient(135deg, transparent 0 14px, color-mix(in srgb, var(--ink) 3%, transparent) 14px 15px); }
    .next { margin: 10px 0 0; }
    .grades { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-wrap: wrap; gap: 4px; }
    .grades li { font-size: 11.5px; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink-3);
      &.done { color: var(--ink); border-color: var(--ink-3); }
      &.now { background: var(--accent); color: var(--surface); border-color: var(--accent); font-weight: 600; } }
  `,
})
export class ScenarioPanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly grades = GRADES;
  protected readonly pressGrades = PRESS_GRADES;
  protected readonly goal = MOLE_GOAL;
  protected readonly Math = Math;
  protected readonly outletLabel = computed(() => { const p = this.game.s().press; return p ? OUTLETS[p.kind].label : ''; });
  protected readonly pressNext = computed(() => { const p = this.game.s().press; return p && p.grade < 4 ? PRESS_REQUIREMENTS[p.grade] : null; });
  protected readonly gap = computed(() => {
    const s = this.game.s();
    if (s.mole) return Math.round(Math.abs(s.player.stance - s.party.position));
    return s.press ? Math.round(Math.abs(s.player.stance - s.press.ligne)) : 0;
  });
  protected stance(v: number) { return stanceLabel(v); }

  protected readonly crownGauges = computed(() => {
    const c = this.game.s().crown!;
    return [
      { label: 'Soutien des Français', value: c.soutien, target: 45, unit: ' %', hint: 'Grandit avec votre popularité et les tournées.' },
      { label: 'Légitimité du prétendant', value: c.legitimite, target: 55, unit: '', hint: 'Banquets, constitution, mariage princier.' },
      { label: 'Ralliement de l’armée', value: c.armee, target: 70, unit: '', hint: 'Dîners discrets avec des officiers.' },
    ];
  });
  protected readonly referendumReady = computed(() => {
    const c = this.game.s().crown;
    return !!c && c.soutien >= 45 && c.legitimite >= 55;
  });
  protected readonly coupReady = computed(() => (this.game.s().crown?.armee ?? 0) >= 70);
  protected readonly next = computed(() => {
    const l = this.game.s().lodge;
    return l && l.grade < 3 ? GRADE_REQUIREMENTS[l.grade] : null;
  });
}

import { COURT_AMENITIES, courtCost, courtGrandeur, kingdomGauges, restoreRepublic, setCourt } from '../../engine/kingdom';
import { CHANTIER_BY_ID, nicknameRace, regimeLabel, regnalName, reignNickname } from '../../engine/reign';
import { durationLabel } from '../../engine/calendar';
import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FinishedArc, closeArc, finishedArcs } from '../../engine/arcs';
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
    @if (finished().length) {
      <section class="card closing" aria-label="Scénarios terminés">
        <div class="card-title"><span>Scénarios terminés</span></div>
        @for (f of finished(); track f.id) {
          <div class="fin">
            <span><strong>{{ f.label }}</strong> <small class="muted">· {{ f.why }}</small></span>
            @if (confirmClose() === f.id) {
              <span class="cf"><button class="btn small" (click)="close(f.id)">Confirmer</button><button class="btn small ghost" (click)="confirmClose.set(null)">Annuler</button></span>
            } @else {
              <button class="btn small" (click)="confirmClose.set(f.id)">Clore ce scénario</button>
            }
          </div>
        }
        <small class="muted">Clore range le scénario dans vos mémoires : son panneau, ses actions et ses événements disparaissent, et il ne reviendra pas.</small>
      </section>
    }
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
          @else { Objectif du scénario : transmettre {{ goal }} renseignements puis réussir le grand déballage — ou prendre la tête du parti infiltré. }
        </p>
      </section>
    }
    @if (game.s().press; as p) {
      <section class="card press">
        <div class="card-title"><span>{{ p.outlet }}</span>
          <span class="chip accent">{{ game.s().scenario === 'editorialiste' ? 'Objectif : diriger la rédaction' : outletLabel() }}</span></div>
        <p class="muted small">{{ outletLabel() }} · propriétaire : {{ p.owner }} · ligne {{ stance(p.ligne) }} ·
          <strong class="mono">{{ p.salary | number: '1.0-0' }} €/mois</strong></p>
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
            · Objectif du scénario : audience 65 et influence 60.
          }
        </p>
      </section>
    }
    @if (game.s().kingdom; as k) {
      <section class="card crown kingdom">
        <div class="card-title"><span>👑 Le Royaume</span><span class="chip warn">{{ k.title }}</span></div>
        <p class="nick">{{ nick().regnal }} <em>« {{ nick().name }} »</em></p>
        <p class="muted small">Sur le trône depuis {{ reign() }}. Plus d’élections pour vous ; votre parti vous soutient, tous les autres font front.</p>
        <div class="regime">
          <div class="row"><span class="eyebrow">Le régime</span><b>{{ regime().label }}</b></div>
          <div class="rtrack"><span class="mark" [style.left.%]="(regime().value + 100) / 2"></span></div>
          <div class="ends"><span>Apparat · stable et aimé</span><span>Absolu · leviers et révolte</span></div>
          <small class="muted">{{ regime().text }}</small>
        </div>
        <div class="gauges">
          @for (g of kingdomGauges(); track g.label) {
            <div class="g">
              <div class="row"><span>{{ g.label }}</span><span class="mono">{{ g.value | number: '1.0-0' }}</span></div>
              <div class="track"><span class="fill" [style.width.%]="g.value" [class.ok]="g.good" [class.low]="!g.good"></span></div>
              <small class="muted">{{ g.hint }}</small>
            </div>
          }
        </div>
        <div class="chantier">
          <div class="row"><span class="eyebrow">Les grands chantiers</span>@if (legacy().length) { <span class="legacy">@for (l of legacy(); track l.id) { <span [title]="l.label">{{ l.icon }}</span> } </span> }</div>
          @if (chantier(); as c) {
            <div class="crow"><span>{{ c.icon }} {{ c.label }}</span><span class="mono">{{ c.progress | number: '1.0-0' }} %</span></div>
            <div class="track"><span class="fill ok" [style.width.%]="c.progress"></span></div>
            <small class="muted">Chaque mois, le chantier coûte du déficit et arme le front républicain. Achevé, il nourrit le prestige et votre héritage.</small>
          } @else {
            <small class="muted">Aucun chantier en cours : lancez-en un depuis l’onglet de la Couronne (Versailles du XXIᵉ siècle, Exposition universelle, ville nouvelle, canal…).</small>
          }
        </div>
        <div class="race">
          <span class="eyebrow">Le surnom pour l’histoire</span>
          @for (r of race(); track r.id) {
            <div class="rrow" [title]="r.hint"><span>{{ r.name }}</span><i><em [style.width.%]="r.score"></em></i><small class="muted">{{ r.hint }}</small></div>
          }
        </div>
        <div class="court">
          <div class="row"><span class="eyebrow">La cour</span><span class="mono">Grandeur {{ grandeur() }} · {{ courtCost() | number: '1.0-0' }} €/mois</span></div>
          @for (c of amenities; track c.id) {
            <div class="amen">
              <span>{{ c.icon }} {{ c.label }}</span>
              <span class="lvl">{{ c.levels[courtLevel(c.id)] }}</span>
              <span class="st"><button type="button" (click)="setCourtLevel(c.id, -1)" [disabled]="courtLevel(c.id) <= 0">−</button><button type="button" (click)="setCourtLevel(c.id, 1)" [disabled]="courtLevel(c.id) >= 3">+</button></span>
            </div>
          }
          <small class="muted">Au-dessus de 40, la grandeur nourrit le prestige ; au-dessus de 50, le luxe arme le front républicain. Un mécénat généreux apporte de la renommée.</small>
        </div>
        @if (confirmRepublic()) {
          <div class="confirm"><span>Abdiquer et rétablir la République ? Une présidentielle aura lieu dans un an.</span>
            <button class="btn small primary" (click)="restore()">Oui, rendre le pouvoir</button>
            <button class="btn small" (click)="confirmRepublic.set(false)">Non</button></div>
        } @else {
          <button class="btn small" (click)="confirmRepublic.set(true)">🇫🇷 Rétablir la République</button>
        }
      </section>
    } @else if (game.s().crown; as c) {
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
    .closing { display: grid; gap: 8px; .card-title { margin-bottom: 0; } } .fin { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; } .cf { display: inline-flex; gap: 6px; }
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
    .court { display: grid; gap: 4px; padding: 8px 0 4px; border-top: 1px dashed var(--line); margin-top: 6px;
      .row { display: flex; justify-content: space-between; font-size: 12px; } }
    .amen { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; font-size: 12.5px;
      .lvl { color: var(--ink-3); font-size: 11.5px; } .st { display: inline-flex; gap: 2px; button { width: 24px; height: 22px; border-radius: 6px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; } } }
    .nick { margin: 0; font: 600 17px var(--font-display, Fraunces, serif); color: #7a5f22; em { font-style: italic; } }
    .regime, .chantier, .race { display: grid; gap: 4px; padding: 8px 0 4px; border-top: 1px dashed var(--line); margin-top: 6px; font-size: 12.5px;
      .row { display: flex; justify-content: space-between; align-items: center; } }
    .rtrack { position: relative; height: 10px; border-radius: 5px; background: linear-gradient(90deg, #4f8bc9, #d9d2bf 50%, #b0452f); .mark { position: absolute; top: -4px; width: 4px; height: 18px; margin-left: -2px; border-radius: 2px; background: var(--ink); transition: left .6s ease; } }
    .ends { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--ink-3); }
    .crow { display: flex; justify-content: space-between; }
    .legacy { font-size: 16px; letter-spacing: 2px; }
    .rrow { display: grid; grid-template-columns: 120px 1fr; gap: 2px 8px; align-items: center;
      i { height: 6px; border-radius: 3px; background: var(--surface-2); overflow: hidden; } em { display: block; height: 100%; background: #c9a227; transition: width .6s; }
      small { grid-column: 1 / -1; font-size: 10.5px; } }
    .kingdom { background: linear-gradient(135deg, color-mix(in srgb, #c9a227 10%, var(--surface)), var(--surface)); animation: royal-in .6s ease;
      .confirm { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12.5px; }
      .fill { transition: width .9s cubic-bezier(.3,1.3,.5,1); overflow: hidden; }
      .fill.ok::after { content: ''; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 30%, rgba(255,240,190,.75) 50%, transparent 70%);
        transform: translateX(-100%); animation: royal-shine 3.2s ease-in-out infinite; }
      .fill.low { animation: danger-pulse 1.2s ease-in-out infinite; }
      .card-title span:first-child { display: inline-block; animation: crown-sway 4s ease-in-out infinite; transform-origin: 20% 80%; } }
    @keyframes royal-shine { 0%, 55% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
    @keyframes crown-sway { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-3deg); } }
    @keyframes royal-in { from { box-shadow: 0 0 0 6px color-mix(in srgb, #c9a227 50%, transparent); } }
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
  protected readonly finished = computed(() => finishedArcs(this.game.s()));
  protected readonly confirmClose = signal<string | null>(null);
  protected close(id: FinishedArc['id']): void {
    this.game.mutate(d => closeArc(d, id));
    this.confirmClose.set(null);
  }
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

  protected readonly amenities = COURT_AMENITIES;
  protected readonly grandeur = computed(() => { const k = this.game.s().kingdom; return k ? courtGrandeur({ ...k, court: k.court ?? { table: 1, ceremonial: 1, mecenat: 0, garde: 1 } }) : 0; });
  protected readonly courtCost = computed(() => { const k = this.game.s().kingdom; return k ? courtCost({ ...k, court: k.court ?? { table: 1, ceremonial: 1, mecenat: 0, garde: 1 } }) : 0; });
  protected courtLevel(id: string): number { const c = this.game.s().kingdom?.court ?? { table: 1, ceremonial: 1, mecenat: 0, garde: 1 }; return c[id] ?? 0; }
  protected setCourtLevel(id: string, delta: number): void { this.game.mutate(d => setCourt(d, id, this.courtLevel(id) + delta)); }
  protected readonly nick = computed(() => { const d = this.game.s(); return { regnal: d.kingdom ? regnalName(d) : '', name: d.kingdom ? d.kingdom.nickname ?? reignNickname(d) : '' }; });
  protected readonly regime = computed(() => { const v = this.game.s().kingdom?.regime ?? 0; return { value: v, ...regimeLabel(v) }; });
  protected readonly chantier = computed(() => { const c = this.game.s().kingdom?.chantier; const def = c ? CHANTIER_BY_ID.get(c.id) : undefined; return c && def ? { ...def, progress: c.progress } : null; });
  protected readonly legacy = computed(() => (this.game.s().kingdom?.legacy ?? []).map(id => CHANTIER_BY_ID.get(id)).filter(x => !!x));
  protected readonly race = computed(() => nicknameRace(this.game.s()).slice(0, 4).map(r => ({ ...r, score: Math.min(100, r.score) })));
  protected readonly kingdomGauges = computed(() => { const k = this.game.s().kingdom; return k ? kingdomGauges(k) : []; });
  protected readonly reign = computed(() => { const k = this.game.s().kingdom; return k ? durationLabel(Math.max(1, this.game.s().week - k.since)) : ''; });
  protected readonly confirmRepublic = signal(false);
  protected restore(): void {
    this.confirmRepublic.set(false);
    this.game.mutate(d => restoreRepublic(d, false));
  }
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

import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { DOMAINS, DOMAIN_LABELS, Domain, STAT_LABELS, StatKey } from '../../models/game.models';
import { GameStateService } from '../../services/game-state.service';
import { ProgressionService } from '../../services/progression.service';
import { LEADER_PAY_LIMITS, leaderPayCheck, leaderPayPreview, remuneration, setLeaderPay } from '../../engine/remuneration';
import { CORPS_BY_ID, civilActive, civilTitle, promoThreshold } from '../../engine/civil';

const GAUGES: { key: StatKey; inverse?: boolean; hint: string }[] = [
  { key: 'popularity', hint: 'Opinion publique' },
  { key: 'influence', hint: 'Poids dans les cercles de pouvoir' },
  { key: 'credibility', hint: 'Sérieux perçu, maîtrise des sujets' },
  { key: 'politicalCapital', hint: 'Monnaie des manœuvres et nominations' },
  { key: 'energy', hint: 'Se régénère chaque mois' },
  { key: 'stress', inverse: true, hint: 'À 95 : burn-out' },
];

/** Profil, jauges, finances, prochain palier, dossiers & arbre de compétences */
@Component({
  selector: 'app-profile-panel',
  imports: [DecimalPipe],
  template: `
    <section class="card">
      <div class="eyebrow">{{ game.s().party.name }}</div>
      <h2 class="name">{{ game.player().name }}</h2>
      <div class="rank"><span class="dot" [style.background]="game.s().party.color"></span>{{ game.roleLabel() }}</div>

      <ul class="gauges">
        @for (g of gauges; track g.key) {
          @let v = game.stats()[g.key];
          <li [title]="g.hint" [attr.data-stat]="g.key">
            <div class="row"><span>{{ label(g.key) }}</span><span class="mono">{{ v | number: '1.0-0' }}</span></div>
            <div class="bar"><span [style.width.%]="v" [style.background]="color(v, g.inverse)"></span></div>
          </li>
        }
        <li title="Risque de fuite ou de scandale">
          <div class="row"><span>Exposition aux scandales</span><span class="mono">{{ game.player().scandalExposure | number: '1.0-0' }}</span></div>
          <div class="bar"><span [style.width.%]="game.player().scandalExposure" [style.background]="color(game.player().scandalExposure, true)"></span></div>
        </li>
      </ul>

      <dl class="money mono">
        <div><dt>Fonds personnels</dt><dd>{{ game.player().finances.personal | number: '1.0-0' }} €</dd></div>
        <div><dt>Compte de campagne</dt><dd>{{ game.player().finances.campaign | number: '1.0-0' }} €</dd></div>
      </dl>
    </section>

    @if (pay(); as r) {
      <section class="card pay">
        <div class="card-title"><span>Rémunération</span><span class="chip accent mono">{{ r.total | number: '1.0-0' }} €/mois</span></div>
        <ul class="pay-lines">
          @for (l of r.lines; track l.label) {
            <li [class.off]="!l.amount">
              <span class="lbl">{{ l.label }}@if (l.note) { <small class="muted">{{ l.note }}</small> }
                @if (l.edit) { <button type="button" class="link-btn" (click)="openEdit(l.edit)">Fixer mon salaire</button> }</span>
              <span class="mono">{{ l.amount ? (l.amount | number: '1.0-0') + ' €' : '—' }}</span>
            </li>
            @if (l.edit && editing() === l.edit) {
              <li class="editor">
                @let chk = payCheck(l.edit);
                <label>
                  <span>{{ l.edit === 'party' ? 'Salaire de chef·fe de parti' : 'Traitement présidentiel' }} : <b class="mono">{{ draft() > 0 ? '+' : '' }}{{ draft() }} %</b></span>
                  <input type="range" [min]="limits[l.edit].min" [max]="limits[l.edit].max" step="10" [value]="draft()" (input)="draft.set($any($event.target).valueAsNumber)" [disabled]="!chk.ok" />
                </label>
                <small class="muted">{{ chk.ok ? preview(l.edit) : chk.reason }}</small>
                <div class="ed-btns">
                  <button type="button" class="btn small primary" [disabled]="!chk.ok" (click)="applyPay(l.edit)">Valider</button>
                  <button type="button" class="btn small" (click)="editing.set(null)">Annuler</button>
                </div>
              </li>
            }
          }
          <li class="sum"><span class="lbl">Rémunération totale</span><span class="mono">{{ r.total | number: '1.0-0' }} €</span></li>
        </ul>
        <ul class="pay-lines small">
          <li><span class="lbl">Mis de côté chaque mois<small class="muted">un tiers environ, le reste fait vivre le foyer</small></span><span class="mono pos">+{{ r.saved | number: '1.0-0' }} €</span></li>
          @for (c of r.charges; track c.label) { <li><span class="lbl">{{ c.label }}</span><span class="mono neg">−{{ c.amount | number: '1.0-0' }} €</span></li> }
          <li class="sum"><span class="lbl">Solde du mois</span><span class="mono" [class.neg]="r.net < 0" [class.pos]="r.net > 0">{{ r.net > 0 ? '+' : '' }}{{ r.net | number: '1.0-0' }} €</span></li>
        </ul>
        @if (civil(); as c) {
          <p class="muted civ">{{ c.corps }} · {{ c.title }}{{ c.active ? ' · un point d’action en moins chaque mois' : ' · en disponibilité pendant votre mandat' }}{{ c.next ? ' · avancement à ' + c.next + ' de crédibilité' : '' }}</p>
        }
      </section>
    }

    @if (progression.nextStep(); as step) {
      <section class="card">
        <div class="card-title"><span>Prochain palier</span><span class="chip" [class.good]="step.ready">{{ step.ready ? 'Prêt·e' : 'En cours' }}</span></div>
        <strong>{{ step.to.label }}</strong>
        <div class="muted via">{{ step.via }}</div>
        <ul class="reqs">
          @for (r of step.requirements; track r.label) {
            <li>
              <div class="row"><span>{{ r.label }}</span><span class="mono">{{ r.current }} / {{ r.target }}</span></div>
              <div class="bar"><span [style.width.%]="100 * r.current / r.target" [style.background]="r.met ? 'var(--good)' : 'var(--accent)'"></span></div>
            </li>
          }
        </ul>
      </section>
    }

    <section class="card">
      <div class="card-title">
        <span>Dossiers & compétences</span>
        <span class="chip" [class.accent]="game.player().skillPoints > 0">{{ game.player().skillPoints }} pt</span>
      </div>
      <ul class="dossiers">
        @for (d of domains; track d) {
          @let dossier = game.player().dossiers[d];
          <li [class.hot]="d === game.s().agendaDomain">
            <span class="d-name">{{ domainLabel(d) }}</span>
            <span class="stars" [attr.aria-label]="'Compétence niveau ' + game.player().skills[d]" [title]="'Compétence ' + game.player().skills[d] + ' / 5'">
              @for (i of levels; track i) { <span [class.on]="i < game.player().skills[d]"></span> }
            </span>
            <span class="mono d-val">{{ dossier.mastery | number: '1.0-0' }}</span>
            <button class="plus" [disabled]="!canUpgrade(d)" (click)="progression.upgradeSkill(d)"
                    [attr.aria-label]="'Améliorer la compétence ' + domainLabel(d)" title="Dépenser un point de compétence">+</button>
            <div class="bar d-bar"><span [style.width.%]="dossier.mastery"></span></div>
          </li>
        }
      </ul>
      <p class="legend muted">Carrés : niveau de compétence (accélère l’étude, ralentit l’oubli). <span class="hot-key">●</span> à la une.</p>
    </section>
  `,
  styles: `
    :host { display: grid; gap: 12px; align-content: start; }
    .name { font-size: 24px; margin-top: 4px; }
    .rank { display: flex; align-items: center; gap: 6px; color: var(--ink-2); margin: 2px 0 14px; }
    .dot { width: 9px; height: 9px; border-radius: 50%; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; margin-bottom: 4px; align-items: center; }
    .money { margin: 14px 0 0; padding-top: 12px; border-top: 1px solid var(--line); display: grid; gap: 4px; font-size: 12.5px;
      div { display: flex; justify-content: space-between; } dt { color: var(--ink-3); font-family: var(--font-body); } dd { margin: 0; } }
    .via { font-size: 12.5px; margin-bottom: 10px; }
    .pay { display: grid; gap: 8px; .card-title { margin-bottom: 0; } }
    .pay-lines { gap: 5px; font-size: 13px;
      li { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
      .lbl { display: grid; } small { font-size: 11px; } .mono { white-space: nowrap; }
      li.off { color: var(--ink-3); }
      li.sum { border-top: 1px solid var(--line); padding-top: 5px; font-weight: 600; }
      .pos { color: var(--good); } .neg { color: var(--bad); } }
    .pay-lines.small { font-size: 12.5px; }
    .civ { margin: 0; font-size: 11.5px; }
    .link-btn { justify-self: start; border: 0; background: none; padding: 0; color: var(--accent); font: 600 11.5px var(--font-body); cursor: pointer; text-decoration: underline; }
    .pay-lines li.editor { display: grid; gap: 6px; padding: 8px 10px; border-radius: 8px; background: var(--surface-2);
      label { display: grid; gap: 4px; font-size: 12.5px; } input { width: 100%; } .ed-btns { display: flex; gap: 6px; } }
    .dossiers { gap: 7px; }
    .dossiers li { display: grid; grid-template-columns: minmax(0, 1fr) auto 26px 22px; column-gap: 8px; row-gap: 3px; align-items: center; font-size: 13px; }
    .dossiers li.hot .d-name { font-weight: 600; }
    .dossiers li.hot .d-name::after { content: ' ●'; color: var(--warn); }
    .d-val { text-align: right; font-size: 12px; }
    .d-bar { grid-column: 1 / -1; height: 4px; }
    .plus { width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--line); background: var(--surface); cursor: pointer; line-height: 1; padding: 0;
      &:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); } &:disabled { opacity: .35; cursor: not-allowed; } }
    .legend { margin: 10px 0 0; font-size: 11.5px; line-height: 1.4; }
    .hot-key { color: var(--warn); }
    .stars { display: flex; gap: 2px; span { width: 8px; height: 8px; border-radius: 2px; border: 1px solid var(--ink-3); } span.on { background: var(--accent); border-color: var(--accent); } }
  `,
})
export class ProfilePanelComponent {
  protected readonly game = inject(GameStateService);
  protected readonly progression = inject(ProgressionService);
  protected readonly gauges = GAUGES;
  protected readonly domains = DOMAINS;
  protected readonly levels = [0, 1, 2, 3, 4];

  private readonly skillPoints = computed(() => this.game.player().skillPoints);
  protected readonly pay = computed(() => remuneration(this.game.s()));
  protected readonly limits = LEADER_PAY_LIMITS;
  protected readonly editing = signal<'party' | 'president' | null>(null);
  protected readonly draft = signal(0);
  protected openEdit(which: 'party' | 'president'): void {
    this.draft.set(Number(this.game.player().flags[which === 'party' ? 'partyPayPct' : 'presPayPct'] ?? 0));
    this.editing.set(this.editing() === which ? null : which);
  }
  protected payCheck(which: 'party' | 'president') { return leaderPayCheck(this.game.s(), which); }
  protected preview(which: 'party' | 'president'): string { return leaderPayPreview(this.game.s(), which, this.draft()); }
  protected applyPay(which: 'party' | 'president'): void {
    this.game.mutate(d => setLeaderPay(d, which, this.draft()));
    this.editing.set(null);
  }
  protected readonly civil = computed(() => {
    const s = this.game.s();
    const c = s.player.civil;
    if (!c) return null;
    const def = CORPS_BY_ID.get(c.corps)!;
    return { corps: def.name, title: civilTitle(c), active: civilActive(s), next: c.grade < def.grades.length - 1 ? promoThreshold(c) : 0 };
  });

  protected label(k: StatKey) { return STAT_LABELS[k]; }
  protected domainLabel(d: Domain) { return DOMAIN_LABELS[d]; }
  protected canUpgrade(d: Domain) { return this.skillPoints() > 0 && this.game.player().skills[d] < 5; }
  protected color(v: number, inverse = false) {
    const x = inverse ? 100 - v : v;
    return x < 25 ? 'var(--bad)' : x < 50 ? 'var(--warn)' : 'var(--accent)';
  }
}

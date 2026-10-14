import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';
import { FxService } from '../../services/fx.service';
import { PersonLinkComponent } from '../person-link/person-link.component';
import { TraitsComponent } from '../traits/traits.component';
import { RANKS } from '../../data/ranks';
import { opinionBreakdown } from '../../engine/memories';
import { HOOK_USES, HookUse, SECRET_BY_ID, blackmail, expose, hookOn, hookReady, knownSecretsOf, playerSecrets, useHook } from '../../engine/secrets';
import { DEMANDS, frondes } from '../../engine/frondes';
import { ACTIVITIES, ActivityDef, activityAvailability, activityCost, guestPool, startActivity } from '../../engine/activities';
import { PHASES, STRUGGLE_BY_ID, breakDecision, cooldownText, decisionCooldown, decisionsState, takeDecision } from '../../engine/grand';
import { DECISION_INTERVAL, decisionActive } from '../../data/great-decisions';

type Tab = 'personnages' | 'parti' | 'activites' | 'decisions' | 'lutte';

/** Le grand jeu : personnages et souvenirs, secrets et leviers, frondes, activités, décisions, luttes */
@Component({
  selector: 'app-grand-panel',
  imports: [DecimalPipe, PersonLinkComponent, TraitsComponent],
  template: `
    <section class="card grand">
      <div class="card-title"><span>♟️ Le grand jeu</span>
        @if (frondeCount()) { <span class="chip bad">{{ frondeCount() }} fronde{{ frondeCount() > 1 ? 's' : '' }}</span> }
        @if (s().struggle) { <span class="chip warn">Lutte en cours</span> }
      </div>
      <nav class="tabs" role="tablist">
        @for (t of tabs(); track t[0]) { <button role="tab" [class.active]="tab() === t[0]" (click)="tab.set(t[0])">{{ t[1] }}</button> }
      </nav>

      @switch (tab()) {
        @case ('personnages') {
          <ul class="people">
            @for (n of people(); track n.id) {
              <li [class.open]="open() === n.id">
                <button type="button" class="row" (click)="open.set(open() === n.id ? null : n.id)">
                  <span class="nm">{{ n.name }} <small class="muted">· {{ rank(n.rankId) }}</small></span>
                  <span class="marks">
                    @if (hook(n.id); as h) { <span title="Levier {{ h.strength }}">{{ h.strength === 'fort' ? '🔒' : '🔑' }}</span> }
                    @if (known(n.id).length) { <span title="Vous connaissez un de ses secrets">🤫</span> }
                    @if (knowsMine(n.id)) { <span title="Connaît un de vos secrets">⚠️</span> }
                  </span>
                  <span class="mono rel" [class.pos]="n.relationToPlayer > 0" [class.neg]="n.relationToPlayer < 0">{{ n.relationToPlayer > 0 ? '+' : '' }}{{ n.relationToPlayer | number: '1.0-0' }}</span>
                </button>
                @if (open() === n.id) {
                  @let b = breakdown(n.id);
                  <div class="dossier">
                    <div class="who"><app-person [name]="n.name" /> @if (n.persona?.length) { <app-traits [ids]="n.persona ?? []" [compact]="true" /> }</div>
                    <ul class="mods">
                      <li><span>Socle</span><span class="mono">{{ b.base > 0 ? '+' : '' }}{{ b.base }}</span></li>
                      @for (m of b.mods; track m.id) {
                        <li><span>{{ m.label }} <small class="muted">· {{ month(m.week) }} · s’estompe</small></span><span class="mono" [class.pos]="m.left > 0" [class.neg]="m.left < 0">{{ m.left > 0 ? '+' : '' }}{{ m.left | number: '1.0-0' }}</span></li>
                      }
                    </ul>
                    @if (b.memories.length) {
                      <div class="mem"><span class="eyebrow">Souvenirs</span>
                        @for (m of b.memories; track $index) { <span class="memo" [class.pos]="m.value > 0" [class.neg]="m.value < 0">{{ m.value > 0 ? '💚' : '💢' }} {{ m.text }} <small class="muted">({{ month(m.week) }})</small></span> }
                      </div>
                    }
                    @for (sec of known(n.id); track sec.id) {
                      <div class="secret">🤫 <b>{{ secretLabel(sec.type) }}</b> <small class="muted">— {{ secretText(sec.type) }}</small>
                        <span class="btns"><button class="btn small" [class.danger]="charte()" [title]="charte() ? 'Votre charte éthique l’interdit : ce serait un parjure' : ''" (click)="doBlackmail(sec.id, $event)">{{ charte() ? 'Faire chanter (parjure)' : 'Faire chanter' }}</button><button class="btn small" (click)="doExpose(sec.id, $event)">Dénoncer</button></span>
                      </div>
                    }
                    @if (hook(n.id); as h) {
                      <div class="hook">{{ h.strength === 'fort' ? '🔒 Levier fort' : '🔑 Levier faible' }} <small class="muted">— {{ h.reason }}</small>
                        @if (ready(n.id)) {
                          <span class="btns">@for (u of uses(h.strength); track u.id) { <button class="btn small" [title]="u.hint" (click)="doUse(n.id, u.id, $event)">{{ u.label }}</button> }</span>
                        } @else { <small class="muted"> · déjà utilisé récemment</small> }
                      </div>
                    }
                  </div>
                }
              </li>
            }
          </ul>
          @if (mine().length) {
            <div class="mine"><span class="eyebrow">Vos secrets</span>
              @for (sec of mine(); track sec.id) { <span>🔐 {{ secretLabel(sec.type) }} — @if (sec.knownBy.length) { <b class="neg">connu de {{ names(sec.knownBy) }}</b> } @else { <span class="muted">personne ne sait</span> }</span> }
            </div>
          }
        }
        @case ('parti') {
          @if (!fr().length) { <p class="muted small">Aucune fronde : les courants vous suivent. Surveillez leur soutien : sous 30, un courant s’organise.</p> }
          @for (f of fr(); track f.factionId) {
            <div class="fronde">
              <div class="row2"><strong>{{ factionName(f.factionId) }}</strong><span class="chip bad">{{ demand(f.demand) }}</span></div>
              <div class="bar"><i [style.width.%]="f.strength" [class.hot]="f.strength >= 80"></i></div>
              <small class="muted">Force {{ f.strength | number: '1.0-0' }} / 100 · ultimatum à 80. Votre crainte ({{ dread() | number: '1.0-0' }}) la freine ; une mission « choyer un courant » l’apaise.</small>
            </div>
          }
        }
        @case ('activites') {
          @if (picking(); as def) {
            <div class="pick">
              <strong>{{ def.icon }} {{ def.label }}</strong> <small class="muted">— choisissez jusqu’à {{ def.guests }} invité·e·s</small>
              <div class="guests">
                @for (n of pool(def); track n.id) {
                  <button type="button" class="g" [class.on]="chosen().includes(n.id)" (click)="toggleGuest(n.id, def.guests)">{{ n.name }} <small class="mono">{{ n.relationToPlayer > 0 ? '+' : '' }}{{ n.relationToPlayer | number: '1.0-0' }}</small></button>
                }
              </div>
              <span class="btns"><button class="btn primary small" [disabled]="!chosen().length" (click)="start(def, $event)">Commencer</button><button class="btn small" (click)="picking.set(null)">Annuler</button></span>
            </div>
          } @else {
            @for (a of activities(); track a.def.id) {
              <div class="act" [class.off]="a.block">
                <span class="ic">{{ a.def.icon }}</span>
                <span class="tx"><strong>{{ a.def.label }}</strong><small class="muted">{{ a.def.desc }} · {{ a.def.ap }} PA · {{ a.price | number: '1.0-0' }} € · {{ a.def.guests }} invité·e·s</small>
                  @if (a.block) { <small class="reason">{{ a.block }}</small> }</span>
                <button class="btn small" [disabled]="!!a.block" (click)="picking.set(a.def); chosen.set([])">Organiser</button>
              </div>
            }
          }
        }
        @case ('decisions') {
          <div class="gd-head">
            <div class="row2"><strong>Une grande décision tous les huit ans</strong>
              @if (cooldown(); as cd) { <span class="chip warn">Prochaine dans {{ cd }}</span> } @else { <span class="chip good">Une décision est possible</span> }</div>
            <div class="bar clock"><i [style.width.%]="clockPct()"></i></div>
            <small class="muted">Chaque décision vous engage pour la vie : un avantage durable, un prix durable, et chaque année un rendez-vous qui vous demande des comptes. On peut la renier… à grand prix.</small>
          </div>
          @if (engaged().length) {
            <span class="eyebrow">Vos engagements</span>
            @for (x of engaged(); track x.g.id) {
              <article class="gd mine-gd" [class.broken]="x.broken">
                <header><span class="ic">{{ x.g.icon }}</span><strong>{{ x.g.label }}</strong>
                  <span class="chip" [class.good]="!x.broken && !x.running" [class.warn]="x.running" [class.bad]="x.broken">{{ x.broken ? 'Renié' : x.running ? 'En cours' : 'En vigueur' }}</span></header>
                @if (x.since !== null) { <small class="muted">Depuis {{ month(x.since) }}</small> }
                @if (!x.broken) {
                  <ul class="pc">
                    @for (t of x.g.pros; track t) { <li class="pro">{{ t }}</li> }
                    @for (t of x.g.cons; track t) { <li class="con">{{ t }}</li> }
                  </ul>
                  @if (confirmBreak() === x.g.id) {
                    <div class="confirm bad"><span>Renier : {{ x.g.breakText }}. Le délai de huit ans ne repart pas à zéro.</span>
                      <span class="btns"><button class="btn small danger" (click)="renounce(x.g.id, $event)">Renier pour de bon</button><button class="btn small" (click)="confirmBreak.set(null)">Annuler</button></span></div>
                  } @else { <span class="btns"><button class="btn small ghost" (click)="confirmBreak.set(x.g.id)">Renier…</button></span> }
                }
              </article>
            }
          }
          <span class="eyebrow">Les grandes décisions</span>
          @for (x of open_(); track x.g.id) {
            <article class="gd" [class.off]="!!x.block">
              <header><span class="ic">{{ x.g.icon }}</span><strong>{{ x.g.label }}</strong><span class="chip">{{ costLabel(x.g.cost) }}</span></header>
              <p class="muted small">{{ x.g.desc }}</p>
              <ul class="pc">
                @for (t of x.g.pros; track t) { <li class="pro">{{ t }}</li> }
                @for (t of x.g.cons; track t) { <li class="con">{{ t }}</li> }
              </ul>
              @if (x.excl.length) { <small class="excl">⛔ Incompatible avec : {{ x.excl.join(', ') }}</small> }
              @if (x.cond) { <small class="reason">{{ x.cond }}</small> }
              @if (!x.block) {
                @if (confirm() === x.g.id) {
                  <div class="confirm"><span><b>C’est pour la vie.</b> Votre prochaine grande décision ne viendra pas avant huit ans.</span>
                    <span class="btns"><button class="btn small primary" (click)="decide(x.g.id, $event)">Je m’engage</button><button class="btn small" (click)="confirm.set(null)">Annuler</button></span></div>
                } @else { <span class="btns"><button class="btn small primary" (click)="confirm.set(x.g.id)">Décider…</button></span> }
              }
            </article>
          }
        }
        @case ('lutte') {
          @if (struggle(); as st) {
            <div class="lutte">
              <strong>{{ st.def.icon }} {{ st.def.label }}</strong>
              <p class="muted small">{{ st.def.desc }}</p>
              <div class="phases">@for (p of phases; track p; let i = $index) { <span [class.done]="i < st.s.phase" [class.now]="i === st.s.phase">{{ p }}</span> }</div>
              <p class="small">{{ st.def.phases[st.s.phase] }}</p>
              <div class="bar"><i [style.width.%]="st.s.progress"></i></div>
              <div class="tug">
                <span>{{ st.def.sides[0] }}</span>
                <span class="track"><i [style.left.%]="(st.s.balance + 100) / 2"></i></span>
                <span>{{ st.def.sides[1] }}</span>
              </div>
              <small class="muted">Des actions dans l’agenda (catégorie « Lutte ») font pencher la balance et accélèrent le dénouement.</small>
            </div>
          } @else { <p class="muted small">Aucune grande lutte en cours. Elles surviennent d’elles-mêmes, tous les deux ou trois ans : recomposition politique, décentralisation, colère des territoires…</p> }
        }
      }
    </section>
  `,
  styles: `
    .grand { display: grid; gap: 10px; }
    .tabs { display: flex; gap: 4px; flex-wrap: wrap; button { font: 500 12.5px var(--font-body); padding: 5px 10px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); cursor: pointer; }
      button.active { background: var(--accent); color: var(--surface); border-color: var(--accent); } }
    .people { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; max-height: 520px; overflow-y: auto; }
    .row { width: 100%; display: grid; grid-template-columns: 1fr auto 42px; gap: 8px; align-items: center; text-align: left; padding: 6px 8px; border: 0; border-radius: 8px; background: none; color: var(--ink); font: 13px var(--font-body); cursor: pointer;
      &:hover { background: var(--surface-2); } .rel { text-align: right; } }
    li.open .row { background: var(--surface-2); }
    .pos { color: var(--good); } .neg { color: var(--bad); }
    .dossier { padding: 8px 10px 10px; display: grid; gap: 8px; font-size: 12.5px; border-left: 3px solid var(--accent); margin: 2px 0 6px 6px; animation: open .25s ease; }
    @keyframes open { from { opacity: 0; transform: translateY(-4px); } }
    .who { display: flex; gap: 8px; align-items: center; font-weight: 600; }
    .mods { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; li { display: flex; justify-content: space-between; gap: 8px; } }
    .mem { display: grid; gap: 2px; .memo { font-size: 12px; } }
    .secret, .hook { display: grid; gap: 4px; padding: 6px 8px; border-radius: 8px; background: var(--surface-2); }
    .btns { display: flex; flex-wrap: wrap; gap: 4px; }
    .mine { display: grid; gap: 3px; font-size: 12.5px; margin-top: 6px; }
    .fronde { display: grid; gap: 4px; padding: 8px; border-radius: 8px; background: var(--surface-2); .row2 { display: flex; justify-content: space-between; } }
    .bar { height: 7px; border-radius: 4px; background: var(--line); overflow: hidden; i { display: block; height: 100%; background: var(--accent); transition: width .4s ease; } i.hot { background: var(--bad); animation: hot 1s infinite; } }
    @keyframes hot { 50% { opacity: .6; } }
    .act { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; padding: 8px; border-radius: 10px; border: 1px solid var(--line);
      .ic { font-size: 22px; } .tx { display: grid; gap: 2px; small { font-size: 11.5px; } } .reason { color: var(--bad); } &.off { opacity: .7; } }
    .pick { display: grid; gap: 8px; .guests { display: flex; flex-wrap: wrap; gap: 4px; max-height: 220px; overflow-y: auto; }
      .g { font: 12px var(--font-body); padding: 4px 9px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
      .g.on { background: var(--accent); color: var(--surface); border-color: var(--accent); } }
    .lutte { display: grid; gap: 6px; p { margin: 0; } }
    .phases { display: flex; gap: 4px; flex-wrap: wrap; span { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: var(--surface-2); color: var(--ink-3); } .done { background: var(--good-soft); color: var(--good); } .now { background: var(--accent); color: var(--surface); } }
    .tug { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; font-size: 12px; font-weight: 600;
      .track { position: relative; height: 8px; border-radius: 4px; background: linear-gradient(90deg, var(--left), var(--line), var(--right)); i { position: absolute; top: -4px; width: 4px; height: 16px; margin-left: -2px; background: var(--ink); border-radius: 2px; transition: left .5s ease; } } }
    .small { font-size: 12.5px; }
    .btn.danger { background: var(--bad); color: var(--surface); border-color: var(--bad); }
    .btn.ghost { background: none; color: var(--ink-2); }
    .gd-head { display: grid; gap: 5px; padding: 10px; border-radius: 10px; background: var(--surface-2); .row2 { display: flex; justify-content: space-between; gap: 8px; align-items: center; flex-wrap: wrap; } }
    .clock i { background: linear-gradient(90deg, var(--accent), var(--good)); }
    .eyebrow { margin-top: 4px; }
    .gd { display: grid; gap: 6px; padding: 10px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); animation: open .25s ease;
      header { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; .ic { font-size: 24px; } strong { font: 700 14px var(--font-display); } }
      p { margin: 0; } &.off { opacity: .78; } .reason { color: var(--bad); font-size: 12px; } .excl { font-size: 11.5px; color: var(--ink-3); } }
    .gd.mine-gd { border-color: color-mix(in srgb, var(--good) 45%, var(--line)); background: color-mix(in srgb, var(--good) 5%, var(--surface)); }
    .gd.broken { border-color: var(--line); background: var(--surface-2); opacity: .7; }
    .pc { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: 12px;
      li { padding-left: 20px; position: relative; } li::before { position: absolute; left: 0; }
      .pro::before { content: '✅'; } .con::before { content: '⚠️'; } .con { color: var(--ink-2); } }
    .confirm { display: grid; gap: 6px; padding: 8px; border-radius: 8px; background: color-mix(in srgb, var(--accent) 10%, var(--surface)); font-size: 12.5px; animation: open .2s ease;
      &.bad { background: color-mix(in srgb, var(--bad) 10%, var(--surface)); } }
  `,
})
export class GrandPanelComponent {
  protected readonly game = inject(GameStateService);
  private readonly fx = inject(FxService);
  /** L'onglet Lutte n'existe que pendant une grande lutte */
  protected readonly tabs = computed<[Tab, string][]>(() => {
    const all: [Tab, string][] = [['personnages', 'Personnages'], ['parti', 'Frondes'], ['activites', 'Activités'], ['decisions', 'Décisions'], ['lutte', 'Lutte']];
    return this.game.s().struggle ? all : all.filter(([t]) => t !== 'lutte');
  });
  private readonly tabState = signal<Tab>('personnages');
  protected readonly tab = Object.assign(computed(() => (this.tabs().some(([t]) => t === this.tabState()) ? this.tabState() : 'personnages')), { set: (t: Tab) => this.tabState.set(t) });
  protected readonly open = signal<string | null>(null);
  protected readonly picking = signal<ActivityDef | null>(null);
  protected readonly chosen = signal<string[]>([]);
  protected readonly phases = PHASES;

  protected readonly s = computed(() => this.game.s());
  protected readonly people = computed(() => [...this.s().npcs].sort((a, b) => Math.abs(b.relationToPlayer) - Math.abs(a.relationToPlayer)));
  protected readonly fr = computed(() => frondes(this.s()));
  protected readonly frondeCount = computed(() => (this.s().frondes ?? []).length);
  protected readonly dread = computed(() => this.s().player.dread ?? 0);
  protected readonly mine = computed(() => playerSecrets(this.s()));
  protected readonly activities = computed(() => ACTIVITIES.map(def => ({ def, price: activityCost(this.s(), def), block: activityAvailability(this.s(), def) })));
  protected readonly decisions = computed(() => decisionsState(this.s()));
  protected readonly engaged = computed(() => this.decisions().filter(x => x.done));
  protected readonly open_ = computed(() => this.decisions().filter(x => !x.done).sort((a, b) => Number(!!a.cond) - Number(!!b.cond)));
  protected readonly cooldown = computed(() => { const m = decisionCooldown(this.s()); return m ? cooldownText(m) : null; });
  protected readonly clockPct = computed(() => 100 - (decisionCooldown(this.s()) / DECISION_INTERVAL) * 100);
  protected readonly charte = computed(() => decisionActive(this.s(), 'charte'));
  protected readonly confirm = signal<string | null>(null);
  protected readonly confirmBreak = signal<string | null>(null);
  protected readonly struggle = computed(() => { const st = this.s().struggle; return st ? { s: st, def: STRUGGLE_BY_ID.get(st.id)! } : null; });

  protected rank(id: string) { return RANKS[id as keyof typeof RANKS]?.label ?? ''; }
  protected breakdown(id: string) { return opinionBreakdown(this.s(), id); }
  protected hook(id: string) { return hookOn(this.s(), id); }
  protected ready(id: string) { const h = hookOn(this.s(), id); return !!h && hookReady(this.s(), h); }
  protected known(id: string) { return knownSecretsOf(this.s(), id); }
  protected knowsMine(id: string) { return playerSecrets(this.s()).some(x => x.knownBy.includes(id)); }
  protected uses(strength: 'faible' | 'fort') { return HOOK_USES.filter(u => !u.strong || strength === 'fort'); }
  protected secretLabel(t: string) { return SECRET_BY_ID.get(t)?.label ?? t; }
  protected secretText(t: string) { return SECRET_BY_ID.get(t)?.text ?? ''; }
  protected month(w: number) { return this.game.month(w); }
  protected names(ids: string[]) { return ids.map(id => this.s().npcs.find(n => n.id === id)?.name ?? '?').join(', '); }
  protected factionName(id: string) { return this.s().party.factions.find(f => f.id === id)?.name ?? id; }
  protected demand(d: keyof typeof DEMANDS) { return DEMANDS[d].label; }
  protected pool(def: ActivityDef) { return guestPool(this.s(), def); }
  protected cost(c: { politicalCapital?: number; money?: number; renown?: number }) {
    const parts = [c.politicalCapital ? `◆ ${c.politicalCapital}` : '', c.money ? `${c.money.toLocaleString('fr-FR')} €` : '', c.renown ? `${c.renown} renommée` : ''].filter(Boolean);
    return parts.length ? ` · ${parts.join(' · ')}` : '';
  }

  protected toggleGuest(id: string, max: number): void {
    const cur = this.chosen();
    this.chosen.set(cur.includes(id) ? cur.filter(x => x !== id) : cur.length < max ? [...cur, id] : cur);
  }

  protected start(def: ActivityDef, ev: Event): void {
    const guests = this.chosen();
    this.game.mutate((d, rng) => { startActivity(d, def.id, guests, rng); });
    this.fx.burstAt(ev.currentTarget as Element, 'good');
    this.picking.set(null);
  }

  protected doBlackmail(id: string, ev: Event): void {
    this.game.mutate((d, rng) => { blackmail(d, id, rng); });
    this.fx.stamp('Chantage', 'bad', 'Il ou elle est à votre merci');
    this.fx.burstAt(ev.currentTarget as Element, 'bad');
  }

  protected doExpose(id: string, ev: Event): void {
    this.game.mutate((d, rng) => { expose(d, id, rng); });
    const sec = (this.s().secrets ?? []).find(x => x.id === id);
    this.fx.newspaper('RÉVÉLATIONS', sec ? this.secretLabel(sec.type).toUpperCase() : '');
    this.fx.burstAt(ev.currentTarget as Element, 'bad');
  }

  protected doUse(npcId: string, use: HookUse, ev: Event): void {
    this.game.mutate((d, rng) => { useHook(d, npcId, use, rng); });
    this.fx.burstAt(ev.currentTarget as Element, 'neutral');
  }

  protected decide(id: string, ev: Event): void {
    const label = this.decisions().find(x => x.g.id === id)?.g.label ?? '';
    this.game.mutate((d, rng) => { takeDecision(d, id, rng); });
    this.confirm.set(null);
    this.fx.stamp('Grande décision', 'good', label);
    this.fx.burstAt(ev.currentTarget as Element, 'good');
  }

  protected renounce(id: string, ev: Event): void {
    this.game.mutate((d, rng) => { breakDecision(d, id, rng); });
    this.confirmBreak.set(null);
    this.fx.stamp('Engagement renié', 'bad', 'On s’en souviendra');
    this.fx.burstAt(ev.currentTarget as Element, 'bad');
  }

  protected costLabel(c: { politicalCapital?: number; money?: number; renown?: number }) {
    return [c.politicalCapital ? `◆ ${c.politicalCapital} capital` : '', c.money ? `${c.money.toLocaleString('fr-FR')} €` : '', c.renown ? `★ ${c.renown} renommée` : ''].filter(Boolean).join(' · ');
  }
}

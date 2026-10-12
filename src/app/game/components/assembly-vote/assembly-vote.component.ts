import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Ballot, DOMAIN_LABELS, VoteTally } from '../../models/game.models';
import { AssemblyService } from '../../services/assembly.service';
import { GameStateService } from '../../services/game-state.service';
import { FxService } from '../../services/fx.service';
import { BALLOT_LABELS } from '../../engine/assembly';
import { HemicycleComponent } from '../hemicycle/hemicycle.component';

const DURATION = 2200;

/**
 * Scrutin public : le texte, l'opinion, le pointage groupe par groupe,
 * vos interventions, votre vote — puis le dépouillement animé dans l'hémicycle.
 */
@Component({
  selector: 'app-assembly-vote',
  imports: [DecimalPipe, HemicycleComponent],
  template: `
    @if (v(); as v) {
      <div class="overlay" role="dialog" aria-modal="true" aria-label="Scrutin public à l’Assemblée nationale">
        <section class="sheet" [class.war]="!!v.warEnemy">
          <header class="band">
            <div class="band-top">
              <span class="eyebrow on-dark">{{ v.warEnemy ? 'Article 35 · Parlement réuni en urgence' : 'Scrutin public · Assemblée nationale' }}</span>
              <span class="origin">{{ originLabel() }}</span>
            </div>
            <h2>{{ v.title }}</h2>
            <p class="intro">{{ v.summary }}</p>
            <div class="tags">
              <span class="tag">À la une : {{ domain() }}</span>
              <span class="tag">{{ roleLabel() }}</span>
            </div>
          </header>

          @if (v.status === 'debat') {
            <div class="gauges">
              <div class="g">
                <span class="eyebrow">L’opinion</span>
                <strong class="mono">{{ v.opinion | number: '1.0-0' }} % favorables</strong>
                <div class="track"><span class="fill" [class.good]="v.opinion >= 55" [class.bad]="v.opinion <= 45" [style.width.%]="v.opinion"></span><i class="mid"></i></div>
              </div>
              <div class="g">
                <span class="eyebrow">Orientation du texte</span>
                <strong>{{ leanLabel() }}</strong>
                <div class="axis"><i class="you" [style.left.%]="(game.player().stance + 100) / 2" title="Vous"></i><i class="bill" [style.left.%]="(v.lean + 100) / 2" title="Le texte"></i></div>
                <small class="muted">● le texte · ◆ vous</small>
              </div>
              @if (v.role === 'depute' || v.role === 'rapporteur') {
                <div class="g">
                  <span class="eyebrow">Consigne du groupe</span>
                  <strong class="line" [class]="'b-' + v.partyLine">{{ ballotLabel(v.partyLine) }}</strong>
                  <small class="muted">La suivre plaît au parti ; s’en écarter fait parler de vous.</small>
                </div>
              }
            </div>

            <div class="content">
              <div class="duo">
                <div class="hemi">
                  <app-hemicycle [groups]="hemiGroups()" [center]="'577 sièges'" />
                  <ul class="legend">
                    @for (g of svc.forecast()?.groups ?? []; track g.group.partyId) {
                      <li><i [style.background]="g.group.color"></i><span>{{ g.group.name }}</span><span class="mono">{{ g.group.seats }}</span>
                        <span class="lean" [class]="'b-' + g.lean">{{ g.lean === 'pour' ? '▲' : g.lean === 'contre' ? '▼' : '◇' }}</span></li>
                    }
                  </ul>
                </div>
                <div class="count">
                  <h3>Pointage</h3>
                  @if (svc.forecast(); as f) {
                    <div class="tally mono">
                      <span class="b-pour">Pour ≈ {{ f.tally.pour | number: '1.0-0' }}</span>
                      <span class="b-contre">Contre ≈ {{ f.tally.contre | number: '1.0-0' }}</span>
                      <span class="b-abstention">Abst. ≈ {{ f.tally.abstention | number: '1.0-0' }}</span>
                    </div>
                    <small class="muted">{{ f.margin <= 5 ? 'Pointage de votre sondeur : fiable à quelques voix près.' : 'Pointage incertain (± ' + f.margin + ' voix). Un sondeur dans l’équipe le préciserait.' }}</small>
                    <div class="chance"><span [style.width.%]="f.adoptedChance * 100"></span></div>
                    <small>Chances d’adoption : <strong class="mono">{{ f.adoptedChance * 100 | number: '1.0-0' }} %</strong></small>
                  }

                  <h3>Avant le vote</h3>
                  <div class="moves">
                    @for (m of svc.moves(); track m.id) {
                      @if (m.id === 'negocier' && !(v.role === 'gouvernement' && v.origin === 'gouvernement')) {
                        <div class="move two">
                          <strong>{{ m.label }}</strong><small class="muted">{{ m.hint }}</small>
                          <span class="row">
                            <button class="btn small" [disabled]="!m.ok" (click)="play(m.id, 1)">… pour le texte</button>
                            <button class="btn small" [disabled]="!m.ok" (click)="play(m.id, -1)">… contre</button>
                          </span>
                          @if (!m.ok) { <small class="why">{{ m.reason }}</small> }
                        </div>
                      } @else {
                        <button class="move" [disabled]="!m.ok" (click)="play(m.id, 1)" [class.danger]="m.id === '493' || m.id === 'retirer'">
                          <strong>{{ m.label }}</strong><small class="muted">{{ m.hint }}</small>
                          @if (!m.ok) { <small class="why">{{ m.reason }}</small> }
                        </button>
                      }
                    }
                  </div>
                  @if (lastMove().length) { <p class="said">{{ lastMove().join(' · ') }}</p> }
                </div>
              </div>

              <h3>{{ ballotTitle() }}</h3>
              <div class="ballots">
                @for (b of ballotChoices(); track b.ballot) {
                  <button class="ballot" [class]="'ballot b-' + b.ballot" (click)="cast(b.ballot)">
                    <strong>{{ b.label }}</strong>
                    @if (b.note) { <small>{{ b.note }}</small> }
                    @if (b.chance !== null) { <small class="mono">adoption ≈ {{ b.chance * 100 | number: '1.0-0' }} %</small> }
                  </button>
                }
              </div>
            </div>
          } @else if (v.result; as r) {
            <div class="content result">
              @if (r.via === '49.3') {
                <div class="verdict show good">Adopté par le 49.3</div>
              } @else {
                <app-hemicycle [groups]="resultGroups()" [ballots]="r.seats" [duration]="duration" [center]="shown().pour + ' – ' + shown().contre" />
                <div class="tally big mono">
                  <span class="b-pour">Pour {{ shown().pour }}</span>
                  <span class="b-contre">Contre {{ shown().contre }}</span>
                  <span class="b-abstention">Abstentions {{ shown().abstention }}</span>
                </div>
                <div class="verdict" [class.show]="done()" [class.good]="r.adopted" [class.bad]="!r.adopted">
                  {{ r.adopted ? 'Adopté' : 'Rejeté' }}
                </div>
                <table class="groups" [class.show]="done()">
                  <thead><tr><th>Groupe</th><th>Pour</th><th>Contre</th><th>Abst.</th></tr></thead>
                  <tbody>
                    @for (g of r.groups; track g.partyId) {
                      <tr><td><i [style.background]="g.color"></i>{{ g.name }}</td><td class="mono">{{ g.tally.pour }}</td><td class="mono">{{ g.tally.contre }}</td><td class="mono">{{ g.tally.abstention }}</td></tr>
                    }
                  </tbody>
                </table>
              }
              @if (r.summary.length) {
                <div class="summary" [class.show]="done() || r.via === '49.3'">
                  @for (x of r.summary; track $index) { <span class="chip">{{ x }}</span> }
                </div>
              }
              <button class="btn primary" [disabled]="!done() && r.via !== '49.3'" (click)="close()">Quitter l’hémicycle</button>
            </div>
          }
        </section>
      </div>
    }
  `,
  styles: `
    .overlay { position: fixed; inset: 0; z-index: 20; overflow-y: auto; background: rgba(10, 12, 18, .6); backdrop-filter: blur(3px);
      display: grid; justify-items: center; align-items: start; padding: max(24px, env(safe-area-inset-top, 0px)) 16px 32px; }
    .sheet { width: 100%; max-width: 960px; background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
      box-shadow: 0 24px 60px -20px rgba(0,0,0,.55); overflow: hidden; }
    .band { color: #f1efe9; padding: 16px 20px 14px; background: #23305a;
      background-image: radial-gradient(120% 140% at 0% -30%, rgba(255,255,255,.14), transparent 60%);
      h2 { font-size: 23px; margin-top: 6px; } }
    .war .band { background-color: #5c1f1f; }
    .band-top { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; flex-wrap: wrap; }
    .on-dark { color: rgba(241,239,233,.65); }
    .origin { font-size: 12px; color: rgba(241,239,233,.85); }
    .intro { margin: 6px 0 10px; color: rgba(241,239,233,.85); font-size: 13.5px; max-width: 70ch; }
    .tags { display: flex; gap: 6px; flex-wrap: wrap; }
    .tag { font-size: 11.5px; padding: 3px 9px; border-radius: 999px; background: rgba(255,255,255,.14); }
    .gauges { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; padding: 14px 20px; background: var(--surface-2); border-bottom: 1px solid var(--line); }
    .g { display: grid; gap: 4px; strong { font-size: 17px; } small { font-size: 11px; } }
    .track { position: relative; height: 6px; border-radius: 3px; background: var(--surface); border: 1px solid var(--line); }
    .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; background: var(--accent); transition: width .35s; }
    .fill.good { background: var(--good); } .fill.bad { background: var(--bad); }
    .mid { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: var(--ink-3); }
    .axis { position: relative; height: 8px; border-radius: 4px; background: linear-gradient(90deg, #b3263b, #c9c3b4, #2b5aa8); margin: 4px 0;
      i { position: absolute; top: 50%; transform: translate(-50%, -50%); }
      .bill { width: 12px; height: 12px; border-radius: 50%; background: var(--ink); border: 2px solid var(--surface); }
      .you { width: 10px; height: 10px; background: var(--warn); transform: translate(-50%, -50%) rotate(45deg); border: 2px solid var(--surface); } }
    .line { font-family: var(--font-display); }
    .b-pour { color: var(--good); } .b-contre { color: var(--bad); } .b-abstention { color: var(--ink-3); }
    .content { padding: 16px 20px 20px; display: grid; gap: 10px; h3 { font-size: 18px; margin: 4px 0 0; } }
    .duo { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 18px; }
    .hemi { display: grid; gap: 8px; align-content: start; }
    .legend { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: 12.5px;
      li { display: grid; grid-template-columns: 12px 1fr 34px 18px; gap: 6px; align-items: center; }
      i { width: 10px; height: 10px; border-radius: 3px; } .mono { text-align: right; } .lean { text-align: center; font-size: 11px; } }
    .count { display: grid; gap: 6px; align-content: start; }
    .tally { display: flex; gap: 12px; flex-wrap: wrap; font-size: 14px; font-weight: 600; }
    .tally.big { justify-content: center; font-size: 18px; gap: 18px; }
    .chance { height: 8px; border-radius: 4px; background: var(--bad-soft); overflow: hidden; span { display: block; height: 100%; background: var(--good); transition: width .4s; } }
    .moves { display: grid; gap: 6px; }
    .move { display: grid; gap: 3px; text-align: left; padding: 9px 11px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); cursor: pointer; color: var(--ink);
      strong { font-size: 13.5px; } small { font-size: 11.5px; }
      &:hover:not(:disabled) { border-color: var(--accent); } &:disabled { opacity: .5; cursor: not-allowed; }
      &.danger strong { color: var(--bad); } }
    .move.two { cursor: default; .row { display: flex; gap: 6px; flex-wrap: wrap; } }
    .why { color: var(--bad); }
    .said { margin: 0; font-size: 12.5px; padding: 8px 10px; border-radius: 8px; background: var(--accent-soft); color: var(--ink); animation: pop .4s ease; }
    .ballots { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; }
    .ballot { display: grid; gap: 3px; padding: 14px 12px; border-radius: 12px; border: 2px solid currentColor; background: var(--surface); cursor: pointer;
      text-align: center; transition: transform .15s, box-shadow .15s;
      strong { font: 700 18px var(--font-display); } small { font-size: 11.5px; color: var(--ink-2); }
      &:hover { transform: translateY(-2px); box-shadow: 0 8px 18px -10px currentColor; } }
    .result { justify-items: center; text-align: center; app-hemicycle { width: min(560px, 100%); } }
    .verdict { font: 800 34px/1 var(--font-display); text-transform: uppercase; letter-spacing: .08em; padding: 8px 26px; border: 4px solid currentColor;
      border-radius: 10px; transform: rotate(-6deg) scale(2); opacity: 0; transition: opacity .2s, transform .35s cubic-bezier(.2,.9,.3,1.4); }
    .verdict.show { opacity: 1; transform: rotate(-6deg) scale(1); }
    .verdict.good { color: var(--good); } .verdict.bad { color: var(--bad); }
    .groups { border-collapse: collapse; font-size: 12.5px; opacity: 0; transition: opacity .4s .2s; width: min(520px, 100%);
      th, td { padding: 4px 8px; text-align: right; border-bottom: 1px solid var(--line); } th:first-child, td:first-child { text-align: left; }
      i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 6px; } }
    .groups.show, .summary.show { opacity: 1; }
    .summary { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; opacity: 0; transition: opacity .4s .3s; }
    @keyframes pop { from { opacity: 0; transform: translateY(4px); } }
    @media (max-width: 720px) { .duo { grid-template-columns: 1fr; } .band h2 { font-size: 20px; } .verdict { font-size: 26px; } }
  `,
})
export class AssemblyVoteComponent {
  protected readonly svc = inject(AssemblyService);
  protected readonly game = inject(GameStateService);
  private readonly fx = inject(FxService);
  protected readonly duration = DURATION;
  protected readonly v = this.svc.vote;
  protected readonly lastMove = signal<string[]>([]);
  protected readonly shown = signal<VoteTally>({ pour: 0, contre: 0, abstention: 0 });
  protected readonly done = signal(false);

  protected readonly domain = computed(() => DOMAIN_LABELS[this.v()!.domain]);
  protected readonly hemiGroups = computed(() => this.svc.groups().map(g => ({ color: g.color, seats: g.seats })));
  protected readonly resultGroups = computed(() => (this.v()?.result?.groups ?? []).map(g => ({ color: g.color, seats: g.seats })));

  protected readonly originLabel = computed(() => {
    const v = this.v()!;
    if (v.warEnemy) return 'Demande d’autorisation du gouvernement';
    return v.origin === 'gouvernement' ? 'Projet de loi du gouvernement' : v.origin === 'majorite' ? 'Proposition de loi de la majorité' : 'Proposition de loi de l’opposition';
  });
  protected readonly roleLabel = computed(() => {
    switch (this.v()!.role) {
      case 'gouvernement': return this.v()!.origin === 'gouvernement' ? 'Vous défendez ce texte au banc du gouvernement' : 'Vous donnez l’avis du gouvernement';
      case 'rapporteur': return 'Vous êtes rapporteur·e du texte';
      case 'chef': return 'Vous fixez la consigne de votre parti';
      default: return 'Vous votez en député·e';
    }
  });
  protected readonly leanLabel = computed(() => {
    const l = this.v()!.lean;
    return l <= -35 ? 'Texte de gauche' : l <= -10 ? 'Plutôt à gauche' : l < 10 ? 'Transpartisan' : l < 35 ? 'Plutôt à droite' : 'Texte de droite';
  });
  protected readonly ballotTitle = computed(() => {
    const v = this.v()!;
    if (v.role === 'gouvernement') return v.origin === 'gouvernement' ? 'Le vote' : 'Avis du gouvernement';
    if (v.role === 'chef') return 'Consigne de vote';
    return 'Votre vote';
  });
  protected readonly ballotChoices = computed(() => {
    const v = this.v()!;
    const chance = (b: Ballot) => (v.role === 'gouvernement' || v.role === 'chef' ? this.svc.chanceWith(b) : null);
    if (v.role === 'gouvernement' && v.origin === 'gouvernement') {
      return [{ ballot: 'pour' as Ballot, label: v.warEnemy ? 'Demander l’autorisation au Parlement' : 'Passer au vote', note: 'Le moment de vérité', chance: this.svc.chanceWith('pour') }];
    }
    const labels: Record<Ballot, string> = v.role === 'gouvernement'
      ? { pour: 'Avis favorable', contre: 'Avis défavorable', abstention: 'Sagesse de l’Assemblée' }
      : v.role === 'chef' ? { pour: 'Voter pour', contre: 'Voter contre', abstention: 'Liberté de vote' }
      : { pour: 'Pour', contre: 'Contre', abstention: 'Abstention' };
    return (['pour', 'contre', 'abstention'] as Ballot[]).map(b => ({
      ballot: b, label: labels[b], chance: chance(b),
      note: (v.role === 'depute' || v.role === 'rapporteur') ? (b === v.partyLine ? 'Consigne du groupe' : 'Contre la consigne') : '',
    }));
  });

  protected ballotLabel(b: Ballot) { return BALLOT_LABELS[b]; }

  protected play(id: string, dir: 1 | -1): void {
    this.lastMove.set(this.svc.play(id, dir));
  }

  protected cast(b: Ballot): void {
    this.lastMove.set([]);
    this.svc.cast(b);
  }

  protected close(): void {
    this.svc.close();
  }

  /** Dépouillement : compteurs qui défilent pendant que l'hémicycle se colore */
  private readonly count = effect(() => {
    const r = this.v()?.result;
    untracked(() => {
      if (!r || r.via === '49.3') { this.done.set(!!r); return; }
      this.done.set(false);
      const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const start = performance.now();
      const total = r.seats.length;
      const tick = (now: number) => {
        const k = reduce ? total : Math.min(total, Math.floor(((now - start) / DURATION) * total));
        const t: VoteTally = { pour: 0, contre: 0, abstention: 0 };
        for (let i = 0; i < k; i++) t[r.seats[i]] += 1;
        this.shown.set(t);
        if (k < total) requestAnimationFrame(tick);
        else {
          this.done.set(true);
          if (r.adopted) this.fx.burst(window.innerWidth / 2, window.innerHeight * 0.45, 'good', 24);
          else this.fx.shake();
          if (this.v()?.warEnemy && r.adopted) setTimeout(() => { this.fx.flash('bad'); this.fx.stamp('Mobilisation générale', 'bad', 'La France entre en guerre'); }, 300);
        }
      };
      requestAnimationFrame(tick);
    });
  });
}

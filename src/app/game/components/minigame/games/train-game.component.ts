import { Component, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Leg { from: string; to: string; mode: string; minutes: number }
interface Route {
  id: string;
  label: string;
  legs: Leg[];
  /** Départ (minutes depuis minuit) */
  depart: number;
  price: number;
  /** Probabilité d'arriver à l'heure à chaque tronçon */
  reliability: number;
  /** Marge de correspondance (minutes) */
  buffer: number;
}
interface Trip { from: string; to: string; meeting: number; what: string; routes: Route[] }
interface Result { route: Route; delay: number; missed: boolean; arrival: number; late: number; points: number }

const CITIES: [string, string, number][] = [
  // destination, gare de correspondance, durée TGV directe (min)
  ['Lyon', 'Dijon', 120], ['Bordeaux', 'Poitiers', 130], ['Lille', 'Arras', 62], ['Strasbourg', 'Nancy', 110],
  ['Nantes', 'Le Mans', 125], ['Rennes', 'Le Mans', 90], ['Marseille', 'Lyon', 190], ['Montpellier', 'Nîmes', 200],
  ['Tours', 'Saint-Pierre-des-Corps', 65], ['Reims', 'Champagne-Ardenne', 50], ['Grenoble', 'Lyon', 180], ['Clermont-Ferrand', 'Nevers', 200],
];
const WHAT = ['Inauguration d’une médiathèque', 'Déjeuner avec la presse régionale', 'Visite d’usine', 'Meeting en soirée', 'Rencontre avec des agriculteurs', 'Conseil d’administration de l’hôpital', 'Remise de médailles', 'Débat au lycée'];

const hhmm = (m: number) => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}`;

/** La journée en train : trois rendez-vous, trois itinéraires à choisir entre vitesse, prix et fiabilité */
@Component({
  selector: 'app-train-game',
  template: `
    <div class="trains">
      <div class="steps" aria-hidden="true">
        @for (t of trips; track $index) { <span [class.done]="$index < index()" [class.now]="$index === index()">{{ t.to }}</span> }
      </div>
      @if (trip(); as t) {
        <div class="brief">
          <span class="clock mono">🕗 {{ hhmm(now()) }}</span>
          <span><strong>{{ t.from }} → {{ t.to }}</strong> · {{ t.what }} à <b class="mono">{{ hhmm(t.meeting) }}</b></span>
          <span class="purse mono">Budget : {{ budget() }} €</span>
        </div>
        @if (!result()) {
          <div class="board" role="list">
            <div class="board-head"><span>Départ</span><span>Itinéraire</span><span>Arrivée</span><span>Prix</span><span>Fiabilité</span></div>
            @for (r of t.routes; track r.id) {
              <button type="button" class="row" role="listitem" (click)="pick(r)" [disabled]="r.price > budget()" [class.tight]="arrival(r) > t.meeting - 10">
                <span class="mono dep">{{ hhmm(r.depart) }}</span>
                <span class="lbl">{{ r.label }} <small class="muted">{{ legsText(r) }}</small></span>
                <span class="mono">{{ hhmm(arrival(r)) }}</span>
                <span class="mono">{{ r.price }} €</span>
                <span class="rel"><i [style.width.%]="r.reliability * 100"></i></span>
              </button>
            }
          </div>
          @if (!affordable()) { <button class="btn small" (click)="giveUp()">Plus de budget : renoncer à ce rendez-vous</button> }
          <p class="hint muted">Arriver avant {{ hhmm(t.meeting) }}. Une correspondance serrée peut sauter au moindre retard ; les TER sont lents mais rarement en retard.</p>
        } @else {
          @let r = result()!;
          <div class="journey" [class.late]="r.late > 0">
            <div class="track"><span class="train" [style.animation-duration.ms]="1200">🚄</span></div>
            <p class="verdict">
              @if (r.missed) { 😩 Correspondance manquée ! }
              @else if (r.delay > 0) { ⏱️ {{ r.delay }} min de retard en route. }
              @else if (r.late > 0) { 🐢 Aucun retard, mais l’itinéraire était trop lent. }
              @else { ✅ Tout est à l’heure. }
              Arrivée à <b class="mono">{{ hhmm(r.arrival) }}</b> :
              {{ r.late > 0 ? 'vous arrivez avec ' + r.late + ' min de retard au rendez-vous.' : 'vous êtes là à temps.' }}
            </p>
            <button class="btn primary small" (click)="next()">{{ index() + 1 < trips.length ? 'Trajet suivant →' : 'Fin de la journée' }}</button>
          </div>
        }
      }
      @if (log().length) {
        <ol class="log">@for (l of log(); track $index) { <li [class.bad]="l.late > 0">{{ trips[$index].to }} · {{ l.route.label }} · {{ l.late > 0 ? '+' + l.late + ' min' : 'à l’heure' }}</li> }</ol>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .trains { display: grid; gap: 10px; }
    .steps { display: flex; gap: 6px; flex-wrap: wrap; span { font-size: 12px; padding: 3px 9px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--line); color: var(--ink-3); }
      .now { border-color: var(--accent); color: var(--accent); font-weight: 600; } .done { background: var(--good-soft); color: var(--good); } }
    .brief { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; font-size: 13.5px; .clock, .purse { font-size: 12.5px; color: var(--ink-2); } }
    .board { display: grid; gap: 4px; background: #111827; color: #fde68a; border-radius: 10px; padding: 8px; font-size: 12.5px; .mono { white-space: nowrap; } }
    .board-head, .row { display: grid; grid-template-columns: 52px 1fr 58px 52px 54px; gap: 6px; align-items: center; }
    .board-head { color: #9ca3af; font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; padding: 0 6px; }
    .row { text-align: left; border: 0; border-radius: 6px; padding: 6px; background: rgba(255,255,255,.04); color: inherit; font: inherit; cursor: pointer; animation: flap .4s ease both;
      &:hover:not(:disabled) { background: rgba(253, 230, 138, .14); } &:disabled { opacity: .4; cursor: not-allowed; }
      &.tight .dep { color: #fca5a5; }
      .lbl small { display: block; color: #9ca3af; font-size: 10.5px; } }
    .row:nth-child(3) { animation-delay: .05s; } .row:nth-child(4) { animation-delay: .1s; } .row:nth-child(5) { animation-delay: .15s; } .row:nth-child(6) { animation-delay: .2s; }
    @keyframes flap { from { transform: rotateX(80deg); opacity: 0; } }
    .rel { height: 6px; border-radius: 3px; background: rgba(255,255,255,.15); overflow: hidden; i { display: block; height: 100%; background: #86efac; } }
    .hint { margin: 0; font-size: 12px; }
    .journey { display: grid; gap: 8px; justify-items: center; text-align: center; }
    .track { position: relative; width: 100%; height: 34px; border-bottom: 3px dashed var(--line); }
    .train { position: absolute; left: 0; bottom: 2px; font-size: 26px; animation: ride 1.2s cubic-bezier(.5, 0, .3, 1) forwards; }
    .journey.late .train { animation-timing-function: cubic-bezier(.7, 0, .9, .6); }
    @keyframes ride { from { left: 0; } to { left: calc(100% - 34px); } }
    .verdict { margin: 0; font-size: 13.5px; animation: pop .35s 1.1s both; }
    @keyframes pop { from { opacity: 0; transform: translateY(6px); } }
    .log { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: 12px; li { padding: 3px 8px; border-radius: 6px; background: var(--good-soft); } li.bad { background: var(--bad-soft); } }
    @media (max-width: 520px) { .board { font-size: 11.5px; padding: 6px; } .board-head, .row { grid-template-columns: 46px 1fr 48px 40px; gap: 4px; } .board-head span:last-child, .rel { display: none; } }
  `,
})
export class TrainGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected trips: Trip[] = [];
  protected readonly index = signal(0);
  protected readonly now = signal(7 * 60);
  protected readonly budget = signal(260);
  protected readonly result = signal<Result | null>(null);
  protected readonly log = signal<Result[]>([]);
  protected readonly trip = computed(() => this.trips[this.index()] ?? null);
  protected readonly hhmm = hhmm;

  ngOnInit(): void {
    const pool = [...CITIES].sort(() => Math.random() - 0.5).slice(0, 3);
    let from = 'Paris';
    let t = 7 * 60;
    this.trips = pool.map(([to, hub, direct], i) => {
      const meeting = t + direct + 70 - Math.round(this.diff() * 15) + i * 25;
      const trip: Trip = { from, to, meeting, what: WHAT[Math.floor(Math.random() * WHAT.length)], routes: this.routes(from, to, hub, direct, t) };
      from = to;
      t = meeting + 90;
      return trip;
    });
    this.budget.set(Math.round(230 + 40 / this.diff()));
  }

  private routes(from: string, to: string, hub: string, direct: number, t: number): Route[] {
    const r = (id: string, label: string, legs: Leg[], depart: number, price: number, reliability: number, buffer = 0): Route => ({ id, label, legs, depart, price, reliability, buffer });
    const jitter = () => Math.round(Math.random() * 3) * 5;
    const half = Math.round(direct * 0.55);
    return [
      r('tgv', 'TGV direct', [{ from, to, mode: 'TGV', minutes: direct }], t + 20 + jitter(), 85 + Math.round(direct / 6), 0.72),
      r('tgv_tot', 'TGV de bonne heure', [{ from, to, mode: 'TGV', minutes: direct }], t + jitter(), 120 + Math.round(direct / 5), 0.8),
      r('corresp', `Via ${hub} (correspondance 8 min)`, [{ from, to: hub, mode: 'TGV', minutes: half }, { from: hub, to, mode: 'TER', minutes: Math.round(direct * 0.6) }], t + 10 + jitter(), 55 + Math.round(direct / 8), 0.78, 8),
      r('ic', 'Intercités', [{ from, to, mode: 'Intercités', minutes: Math.round(direct * 1.55) }], t + jitter(), 38 + Math.round(direct / 10), 0.9),
      r('bus', 'Car longue distance', [{ from, to, mode: 'Car', minutes: Math.round(direct * 2.2) }], t + jitter(), 15 + Math.round(direct / 20), 0.85),
      r('car', 'Voiture avec chauffeur', [{ from, to, mode: 'Voiture', minutes: Math.round(direct * 1.9) }], t + 5, 150 + Math.round(direct / 2), 0.62),
    ].sort((a, b) => a.depart - b.depart);
  }

  protected affordable(): boolean {
    return !!this.trip()?.routes.some(r => r.price <= this.budget());
  }

  /** Plus un euro : le rendez-vous est manqué */
  protected giveUp(): void {
    const t = this.trip();
    if (!t || this.result()) return;
    const res: Result = { route: { ...t.routes[0], label: 'Rendez-vous annulé' }, delay: 0, missed: true, arrival: t.meeting + 120, late: 120, points: 0 };
    this.miss.emit();
    this.result.set(res);
    this.log.update(l => [...l, res]);
  }

  protected legsText(r: Route): string {
    return r.legs.map(l => `${l.mode} ${Math.floor(l.minutes / 60)} h ${String(l.minutes % 60).padStart(2, '0')}`).join(' + ');
  }

  protected arrival(r: Route): number {
    return r.depart + r.legs.reduce((s, l) => s + l.minutes, 0) + (r.legs.length > 1 ? r.buffer : 0);
  }

  protected pick(r: Route): void {
    const t = this.trip();
    if (!t || this.result() || r.price > this.budget()) return;
    this.budget.update(b => b - r.price);
    let delay = 0;
    let missed = false;
    r.legs.forEach((_, i) => {
      if (Math.random() > r.reliability) {
        const d = 5 + Math.round(Math.random() * 6) * 5 * this.diff();
        delay += Math.round(d);
        // Un retard sur le premier tronçon fait sauter une correspondance serrée
        if (i === 0 && r.legs.length > 1 && d > r.buffer) missed = true;
      }
    });
    if (missed) delay += 55;
    const arrival = this.arrival(r) + delay;
    const late = Math.max(0, arrival - t.meeting);
    const points = late === 0 ? 1 : late <= 15 ? 0.6 : late <= 40 ? 0.3 : 0;
    if (late > 0) this.miss.emit();
    const res: Result = { route: r, delay, missed, arrival, late, points };
    this.result.set(res);
    this.now.set(arrival);
    this.log.update(l => [...l, res]);
    this.progress.emit({ live: this.score(), time: 1 - (this.index() + 1) / this.trips.length });
  }

  protected next(): void {
    this.result.set(null);
    if (this.index() + 1 >= this.trips.length) {
      const s = this.score();
      this.progress.emit({ live: s, time: 0 });
      setTimeout(() => this.done.emit(s), 600);
      this.index.set(this.trips.length);
      return;
    }
    this.index.update(i => i + 1);
  }

  private score(): number {
    const l = this.log();
    const pts = l.reduce((s, r) => s + r.points, 0) / this.trips.length;
    // Un petit bonus pour les économies
    return Math.min(1, pts * 0.92 + (this.budget() / 260) * 0.08 * (l.length / this.trips.length));
  }
}

import { Component, OnDestroy, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Call { who: string; ask: string; to: string }

const DESKS = ['Santé', 'Éducation', 'Intérieur', 'Économie', 'Écologie', 'Justice'];
const CALLS: Call[] = [
  { who: 'Un maire rural', ask: 'Le dernier médecin du village part à la retraite.', to: 'Santé' },
  { who: 'Une directrice d’hôpital', ask: 'Les urgences ferment la nuit faute de personnel.', to: 'Santé' },
  { who: 'Un pharmacien', ask: 'Rupture d’antibiotiques dans tout le département.', to: 'Santé' },
  { who: 'Une principale de collège', ask: 'Il manque trois professeurs depuis la rentrée.', to: 'Éducation' },
  { who: 'Des parents d’élèves', ask: 'Une classe va fermer à la rentrée prochaine.', to: 'Éducation' },
  { who: 'Un président d’université', ask: 'Les amphis débordent, il faut des moyens.', to: 'Éducation' },
  { who: 'Un préfet', ask: 'Rodéos urbains toutes les nuits dans le quartier nord.', to: 'Intérieur' },
  { who: 'Un syndicat de police', ask: 'Les commissariats tombent en ruine.', to: 'Intérieur' },
  { who: 'Une maire de banlieue', ask: 'Des feux de poubelles depuis trois soirs.', to: 'Intérieur' },
  { who: 'Un patron de PME', ask: 'La banque refuse de prolonger mon prêt.', to: 'Économie' },
  { who: 'Un délégué syndical', ask: 'L’usine annonce 300 licenciements.', to: 'Économie' },
  { who: 'Une artisane boulangère', ask: 'Ma facture d’électricité a triplé.', to: 'Économie' },
  { who: 'Un apiculteur', ask: 'Mes abeilles meurent à cause d’un pesticide.', to: 'Écologie' },
  { who: 'Une association de riverains', ask: 'Une décharge sauvage pollue la rivière.', to: 'Écologie' },
  { who: 'Un agriculteur', ask: 'La nappe phréatique est à sec, plus d’irrigation.', to: 'Écologie' },
  { who: 'Une avocate', ask: 'Les audiences sont renvoyées à dans deux ans.', to: 'Justice' },
  { who: 'Un directeur de prison', ask: 'Ma prison est à 180 % de sa capacité.', to: 'Justice' },
  { who: 'Une victime', ask: 'Ma plainte n’a jamais été instruite.', to: 'Justice' },
];

/** Le standard : chaque appel au bon ministère, avant que la file ne déborde */
@Component({
  selector: 'app-standard-game',
  template: `
    <div class="std">
      <div class="top">
        <span>☎️ <b class="mono">{{ done_() }}</b> appels traités</span>
        <span class="queue">En attente : @for (q of queueDots(); track $index) { <i></i> }</span>
        <span class="mono">⏱️ {{ left() }} s</span>
      </div>
      @if (current(); as c) {
        <div class="call" [class.shake]="flash() === 'bad'" [class.okf]="flash() === 'good'">
          <small class="muted">{{ c.who }}</small>
          <p>« {{ c.ask }} »</p>
        </div>
        <div class="desks">
          @for (desk of desks; track desk) { <button type="button" class="desk" (click)="route(desk)" [disabled]="over()">{{ desk }}</button> }
        </div>
      }
      @if (over()) { <p class="said">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .std { display: grid; gap: 10px; }
    .top { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; flex-wrap: wrap; align-items: center; }
    .queue { display: inline-flex; gap: 3px; align-items: center; font-size: 12px; color: var(--ink-3);
      i { width: 8px; height: 8px; border-radius: 50%; background: var(--warn); animation: blink 1s ease-in-out infinite; } }
    @keyframes blink { 50% { opacity: .35; } }
    .call { padding: 12px 14px; border-radius: 12px; background: var(--surface-2); border-left: 4px solid var(--accent); animation: ring .35s ease;
      p { margin: 4px 0 0; font-size: 15px; font-weight: 600; } }
    .call.shake { animation: shake .35s ease; border-left-color: var(--bad); } .call.okf { border-left-color: var(--good); }
    @keyframes ring { from { transform: translateX(-10px); opacity: 0; } }
    @keyframes shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
    .desks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .desk { padding: 10px 6px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 600 13px var(--font-body); cursor: pointer;
      &:hover:not(:disabled) { border-color: var(--accent); } &:active { transform: scale(.97); } }
    .said { margin: 0; text-align: center; font-weight: 600; font-size: 13px; }
  `,
})
export class StandardGameComponent implements OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly desks = DESKS;
  private queue: Call[] = [];
  protected readonly current = signal<Call | null>(null);
  protected readonly done_ = signal(0);
  private errors = 0;
  protected readonly left = signal(30);
  protected readonly waiting = signal(2);
  protected readonly over = signal(false);
  protected readonly flash = signal<'good' | 'bad' | null>(null);
  protected readonly message = signal('');
  protected readonly queueDots = computed(() => Array(Math.min(8, this.waiting())));
  private timer: ReturnType<typeof setInterval> | null = null;
  private target = 12;

  ngOnInit(): void {
    this.queue = [...CALLS, ...CALLS].sort(() => Math.random() - 0.5);
    this.current.set(this.queue.shift()!);
    this.target = Math.round(10 + this.diff() * 3);
    const total = 30;
    this.timer = setInterval(() => {
      if (this.over()) return;
      this.left.update(t => t - 1);
      if (this.left() % 3 === 0) this.waiting.update(w => w + 1);
      this.progress.emit({ live: this.score(), time: this.left() / total });
      if (this.left() <= 0 || this.waiting() >= 10) this.finish();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  protected route(desk: string): void {
    const c = this.current();
    if (!c || this.over()) return;
    if (desk === c.to) { this.done_.update(n => n + 1); this.flash.set('good'); this.waiting.update(w => Math.max(0, w - 1)); }
    else { this.errors++; this.flash.set('bad'); this.miss.emit(); }
    setTimeout(() => this.flash.set(null), 350);
    this.current.set(this.queue.shift() ?? CALLS[Math.floor(Math.random() * CALLS.length)]);
  }

  private score(): number {
    return Math.max(0, Math.min(1, (this.done_() - this.errors * 0.7) / this.target));
  }

  private finish(): void {
    if (this.over()) return;
    this.over.set(true);
    if (this.timer) clearInterval(this.timer);
    const s = this.score();
    this.message.set(this.waiting() >= 10 ? 'Le standard a sauté : des dizaines d’appels sans réponse.' : s >= 0.85 ? 'Standard impeccable : chaque appel au bon endroit.' : `${this.done_()} appels traités, ${this.errors} mal aiguillés.`);
    this.progress.emit({ live: s, time: 0 });
    setTimeout(() => this.done.emit(s), 1800);
  }
}

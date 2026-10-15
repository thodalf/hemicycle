import { Component, OnDestroy, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

const HOURS = [8, 9, 10, 11, 14, 15, 16, 17];
const MEETINGS = [
  { icon: '📰', name: 'Interview au Figaro' }, { icon: '🏭', name: 'Visite d’usine' }, { icon: '🤝', name: 'Syndicats' },
  { icon: '🎙️', name: 'Matinale radio' }, { icon: '🏛️', name: 'Questions au gouvernement' }, { icon: '🌍', name: 'Ambassadeur' },
  { icon: '📊', name: 'Point budget' }, { icon: '🎓', name: 'Remise de diplômes' }, { icon: '🚒', name: 'Caserne des pompiers' },
  { icon: '☕', name: 'Café avec les militants' }, { icon: '📞', name: 'Appel du Premier ministre' }, { icon: '🧑‍⚖️', name: 'Avocats du parti' },
];

interface Rule { text: string; ok: (slot: number, at: (m: number) => number | undefined) => boolean }
interface Meeting { icon: string; name: string; rule: Rule }

/** L'agenda impossible : caser chaque rendez-vous en respectant les contraintes de chacun */
@Component({
  selector: 'app-agenda-game',
  template: `
    <div class="ag">
      <p class="hint">@if (!over()) { Touchez un rendez-vous, puis un créneau. Chacun a sa contrainte : tout doit tenir dans la journée. } @else { {{ message() }} }</p>
      <div class="cols">
        <ul class="meet">
          @for (m of meetings; track m.name; let k = $index) {
            @let at = place()[k];
            <li><button type="button" [class.sel]="sel() === k" [class.placed]="at !== undefined" [class.ok]="over() && check()[k]" [class.ko]="over() && !check()[k]" [disabled]="over()" (click)="sel.set(sel() === k ? null : k)">
              <span class="ic">{{ m.icon }}</span><span><b>{{ m.name }}</b><small>{{ m.rule.text }}</small></span>
              @if (at !== undefined) { <em class="mono">{{ hours[at] }} h</em> }
            </button></li>
          }
        </ul>
        <ol class="day">
          @for (h of hours; track h; let s = $index) {
            @let who = occupant()[s];
            @if (s === 4) { <li class="lunch">🍽️ Déjeuner</li> }
            <li><button type="button" class="slot" [class.full]="who !== undefined" [class.target]="sel() !== null" [disabled]="over()" (click)="drop(s)">
              <span class="mono">{{ h }} h</span>@if (who !== undefined) { <span>{{ meetings[who].icon }} {{ meetings[who].name }}</span> }
            </button></li>
          }
        </ol>
      </div>
      @if (!over()) {
        <div class="foot"><span class="timer"><i [style.width.%]="left() * 100"></i></span>
          <button class="btn primary small" [disabled]="placedCount() < meetings.length" (click)="finish()">Valider l’agenda ({{ placedCount() }}/{{ meetings.length }})</button></div>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .ag { display: grid; gap: 10px; }
    .hint { margin: 0; font-size: 12.5px; color: var(--ink-2); }
    .cols { display: grid; grid-template-columns: 1.3fr 1fr; gap: 10px; }
    @media (max-width: 520px) { .cols { grid-template-columns: 1fr; } }
    ul, ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px; align-content: start; }
    .meet button { width: 100%; display: grid; grid-template-columns: 24px 1fr auto; gap: 8px; align-items: center; text-align: left; padding: 7px 9px; border-radius: 10px; border: 1px solid var(--line);
      background: var(--surface); color: var(--ink); font: 13px var(--font-body); cursor: pointer; transition: transform .12s ease;
      b { display: block; font-size: 13px; } small { display: block; font-size: 11.5px; color: var(--ink-2); } em { font-style: normal; font-size: 12px; font-weight: 700; color: var(--accent); }
      &.sel { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent); transform: translateX(4px); }
      &.placed { background: var(--surface-2); } &.ok { border-color: var(--good); background: var(--good-soft); } &.ko { border-color: var(--bad); background: var(--bad-soft); } }
    .slot { width: 100%; display: flex; gap: 8px; align-items: center; padding: 7px 9px; border-radius: 8px; border: 1px dashed var(--line); background: var(--surface); color: var(--ink); font: 12.5px var(--font-body); cursor: pointer; min-height: 34px;
      &.target:not(:disabled):hover { border-color: var(--accent); border-style: solid; } &.full { border-style: solid; background: var(--surface-2); animation: drop .25s ease; } }
    @keyframes drop { from { transform: scale(.94); } }
    .lunch { text-align: center; font-size: 11.5px; color: var(--ink-3); padding: 2px; }
    .foot { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .timer { height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; i { display: block; height: 100%; background: var(--accent); transition: width .2s linear; } }
  `,
})
export class AgendaGameComponent implements OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly hours = HOURS;
  protected meetings: Meeting[] = [];
  /** Créneau choisi pour chaque rendez-vous */
  protected readonly place = signal<(number | undefined)[]>([]);
  protected readonly sel = signal<number | null>(null);
  protected readonly left = signal(1);
  protected readonly over = signal(false);
  protected readonly message = signal('');
  protected readonly occupant = computed(() => { const o: (number | undefined)[] = []; this.place().forEach((s, k) => { if (s !== undefined) o[s] = k; }); return o; });
  protected readonly placedCount = computed(() => this.place().filter(x => x !== undefined).length);
  protected readonly check = computed(() => this.meetings.map((m, k) => { const s = this.place()[k]; return s !== undefined && m.rule.ok(s, j => this.place()[j]); }));
  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const n = this.diff() >= 3 ? 7 : 6;
    const picks = [...MEETINGS].sort(() => Math.random() - 0.5).slice(0, n);
    // Une solution cachée : on en déduit des contraintes qu'elle respecte
    const sol = [...HOURS.keys()].sort(() => Math.random() - 0.5).slice(0, n);
    this.meetings = picks.map((m, k) => ({ ...m, rule: this.ruleFor(k, sol, picks) }));
    this.place.set(Array(n).fill(undefined));
    const total = Math.max(45000, 90000 - (this.diff() - 1) * 12000), t0 = Date.now();
    this.timer = setInterval(() => {
      const l = 1 - (Date.now() - t0) / total;
      this.left.set(Math.max(0, l));
      this.progress.emit({ live: this.check().filter(Boolean).length / this.meetings.length, time: Math.max(0, l) });
      if (l <= 0) this.finish();
    }, 250);
  }

  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }

  private ruleFor(k: number, sol: number[], picks: { name: string }[]): Rule {
    const s = sol[k], h = HOURS[s];
    const other = (k + 1) % sol.length, oh = HOURS[sol[other]], oname = picks[other].name;
    const opts: Rule[] = [];
    if (h <= 11) opts.push({ text: 'Le matin uniquement', ok: x => HOURS[x] <= 11 });
    if (h >= 14) opts.push({ text: 'L’après-midi uniquement', ok: x => HOURS[x] >= 14 });
    if (h <= 9) opts.push({ text: 'Avant 10 h', ok: x => HOURS[x] < 10 });
    if (h >= 16) opts.push({ text: 'Pas avant 16 h', ok: x => HOURS[x] >= 16 });
    if (h === 11 || h === 14) opts.push({ text: 'Juste avant ou juste après le déjeuner', ok: x => HOURS[x] === 11 || HOURS[x] === 14 });
    if (h > oh) opts.push({ text: `Après « ${oname} »`, ok: (x, at) => { const j = at(other); return j !== undefined && HOURS[x] > HOURS[j]; } });
    if (h < oh) opts.push({ text: `Avant « ${oname} »`, ok: (x, at) => { const j = at(other); return j !== undefined && HOURS[x] < HOURS[j]; } });
    if (h !== 8 && h !== 17) opts.push({ text: 'Ni à 8 h, ni à 17 h', ok: x => HOURS[x] !== 8 && HOURS[x] !== 17 });
    return opts[Math.floor(Math.random() * opts.length)];
  }

  protected drop(s: number): void {
    const k = this.sel();
    if (this.over()) return;
    const p = [...this.place()];
    if (k === null) {
      // Toucher un créneau occupé le libère
      const who = this.occupant()[s];
      if (who !== undefined) { p[who] = undefined; this.place.set(p); this.sel.set(who); }
      return;
    }
    const prev = this.occupant()[s];
    if (prev !== undefined && prev !== k) p[prev] = undefined;
    p[k] = s;
    this.place.set(p);
    this.sel.set(null);
  }

  protected finish(): void {
    if (this.over()) return;
    if (this.timer) clearInterval(this.timer);
    this.over.set(true);
    const r = this.check().filter(Boolean).length / this.meetings.length;
    if (r < 1) this.miss.emit();
    this.message.set(r === 1 ? 'Une journée parfaite : tout le monde a été reçu à l’heure qui lui convenait.' : r >= 0.6 ? 'Quelques grincements de dents, mais la journée tient.' : 'Un agenda intenable : on vous attend à trois endroits à la fois.');
    this.progress.emit({ live: r, time: 0 });
    setTimeout(() => this.done.emit(Math.max(0.1, r)), 2200);
  }
}

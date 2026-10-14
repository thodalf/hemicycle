import { dailyPlayed, dailyWord, markDailyPlayed } from '../../../engine/daily';
import { Component, DestroyRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';
import { MotResult, MotSave, clearSave, loadSave, saveResult, writeSave } from '../../../engine/arcade-save';
import { todayKey } from '../../../engine/daily';
import { ArcadeResultComponent } from '../../arcade-panel/arcade-result.component';

type Mark = 'ok' | 'mal' | 'non';
const ROWS = 6;
const KEYS = ['AZERTYUIOP', 'QSDFGHJKLM', 'WXCVBN'];
const ROW_SCORE = [1, 1, 0.92, 0.8, 0.65, 0.5];

/** Le mot du jour : six essais, première lettre donnée (façon Sutom / Motus) */
export function markGuess(guess: string, word: string): Mark[] {
  const res: Mark[] = Array(word.length).fill('non');
  const left: Record<string, number> = {};
  for (let i = 0; i < word.length; i++) {
    if (guess[i] === word[i]) res[i] = 'ok';
    else left[word[i]] = (left[word[i]] ?? 0) + 1;
  }
  for (let i = 0; i < word.length; i++) {
    if (res[i] !== 'ok' && left[guess[i]] > 0) { res[i] = 'mal'; left[guess[i]]--; }
  }
  return res;
}

@Component({
  selector: 'app-mot-game',
  imports: [ArcadeResultComponent],
  template: `
    <div class="mot" [class.shake]="shaking()">
      <div class="board" [style.--n]="word.length" role="grid" aria-label="Grille du mot">
        @for (r of rowsView(); track $index) {
          <div class="row" role="row">
            @for (c of r; track $index) {
              <span class="tile" role="gridcell" [class]="'tile ' + (c.mark ?? '')" [class.hint]="c.hint" [class.cur]="c.cur" [style.animation-delay.ms]="$index * 90">{{ c.ch }}</span>
            }
          </div>
        }
      </div>
      <p class="said" aria-live="polite">{{ message() || ' ' }}</p>
      @if (result(); as r) {
        <app-arcade-result [result]="r" [showBoard]="false" />
        <button type="button" class="btn primary cont" (click)="done.emit(score)">Continuer</button>
      }
      @if (!result()) {
      <div class="kbd" aria-label="Clavier">
        @for (line of keys; track $index; let last = $last) {
          <div class="kline">
            @if (last) { <button type="button" class="key wide" (click)="enter()">Entrée</button> }
            @for (k of line.split(''); track k) {
              <button type="button" class="key" [class]="'key ' + (used()[k] ?? '')" (click)="type(k)">{{ k }}</button>
            }
            @if (last) { <button type="button" class="key wide" (click)="back()" aria-label="Effacer">⌫</button> }
          </div>
        }
      </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .mot { display: grid; gap: 10px; justify-items: center; }
    .board { display: grid; gap: 5px; }
    .row { display: grid; grid-template-columns: repeat(var(--n), min(40px, calc((100vw - 60px) / var(--n) - 5px))); gap: 5px; }
    .tile { aspect-ratio: 1; display: grid; place-items: center; font: 700 clamp(15px, 4.2vw, 21px) var(--font-mono, monospace); color: #fff;
      background: #1d4f8a; border: 2px solid #2f6cb0; border-radius: 4px; text-transform: uppercase; }
    .tile.hint { color: rgba(255,255,255,.4); }
    .tile.cur { border-color: #f4d27a; }
    .tile.ok { background: #d3352b; border-color: #d3352b; border-radius: 4px; animation: flip .45s ease both; }
    .tile.mal { background: #e8b21f; border-color: #1d4f8a; border-radius: 50%; color: #1d2a3a; animation: flip .45s ease both; }
    .tile.non { animation: flip .45s ease both; }
    @keyframes flip { 0% { transform: rotateX(90deg); } 100% { transform: none; } }
    .said { min-height: 20px; margin: 0; font-size: 13px; font-weight: 600; text-align: center; }
    .cont { justify-self: center; margin-top: 6px; }
    .kbd { display: grid; gap: 5px; width: 100%; max-width: 480px; }
    .kline { display: flex; gap: 4px; justify-content: center; }
    .key { flex: 1; min-width: 0; height: 40px; border: 0; border-radius: 6px; background: var(--surface-2); color: var(--ink); font: 600 14px var(--font-body); cursor: pointer; }
    .key.wide { flex: 1.7; font-size: 12px; }
    .key.ok { background: #d3352b; color: #fff; } .key.mal { background: #e8b21f; } .key.non { opacity: .35; }
    .shake { animation: sh .35s; }
    @keyframes sh { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
    @media (prefers-reduced-motion: reduce) { .tile { animation: none !important; } }
  `,
})
export class MotGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();
  /** Salle de jeux : la partie se sauvegarde et se reprend (jusqu'à minuit) */
  readonly saveKey = input<string | null>(null);

  protected readonly keys = KEYS;
  protected word = '';
  protected readonly guesses = signal<{ text: string; marks: Mark[] }[]>([]);
  protected readonly current = signal('');
  protected readonly message = signal('');
  protected readonly shaking = signal(false);
  private over = false;
  protected score = 0;
  protected readonly result = signal<MotResult | null>(null);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.timer && clearInterval(this.timer));
  }

  ngOnInit(): void {
    const words = this.def().words ?? ['SCRUTIN'];
    const daily = !!this.def().daily;
    this.word = daily ? dailyWord(words) : words[Math.floor(Math.random() * words.length)];
    this.current.set(this.word[0]);
    // Déjà joué aujourd'hui : l'équipe s'en charge, revenez demain
    if (daily && dailyPlayed()) {
      this.over = true;
      this.message.set('Le mot du jour a déjà été joué aujourd’hui. Revenez demain pour un nouveau mot ! Votre équipe fait de son mieux en attendant.');
      setTimeout(() => this.done.emit(0.5), 2600);
      return;
    }
    const key = this.saveKey();
    if (key) {
      const saved = loadSave<MotSave>(key);
      if (saved?.kind === 'mot' && saved.guesses.every(g => g.length === this.word.length)) {
        this.guesses.set(saved.guesses.map(text => ({ text, marks: markGuess(text, this.word) })));
        if (saved.guesses.length) this.message.set(`Partie reprise : ${saved.guesses.length} essai(s) déjà joué(s).`);
      }
      this.timer = setInterval(() => this.progress.emit({ live: this.live(), time: 1 }), 500);
      return;
    }
    const limit = 150000 / this.diff();
    const t0 = performance.now();
    this.timer = setInterval(() => {
      const t = performance.now() - t0;
      this.progress.emit({ live: this.live(), time: Math.max(0, 1 - t / limit) });
      if (t >= limit) this.finish(false, 'Temps écoulé !');
    }, 250);
  }

  /** Lettres déjà trouvées à leur place : affichées en filigrane */
  private readonly known = computed(() => {
    const k: (string | null)[] = Array(this.word.length).fill(null);
    k[0] = this.word[0];
    for (const g of this.guesses()) g.marks.forEach((m, i) => { if (m === 'ok') k[i] = this.word[i]; });
    return k;
  });

  protected readonly rowsView = computed(() => {
    const n = this.word.length;
    const out: { ch: string; mark?: Mark; hint?: boolean; cur?: boolean }[][] = [];
    for (const g of this.guesses()) out.push(g.text.split('').map((ch, i) => ({ ch, mark: g.marks[i] })));
    if (out.length < ROWS && !this.over) {
      const cur = this.current();
      out.push(Array.from({ length: n }, (_, i) => (i < cur.length ? { ch: cur[i], cur: i === cur.length - 1 } : { ch: this.known()[i] ?? '·', hint: true })));
    }
    while (out.length < ROWS) out.push(Array.from({ length: n }, () => ({ ch: '' })));
    return out;
  });

  /** État de chaque lettre du clavier (le meilleur connu) */
  protected readonly used = computed(() => {
    const rank: Record<Mark, number> = { ok: 3, mal: 2, non: 1 };
    const u: Record<string, Mark> = {};
    for (const g of this.guesses()) g.text.split('').forEach((ch, i) => { const m = g.marks[i]; if (!u[ch] || rank[m] > rank[u[ch]]) u[ch] = m; });
    return u;
  });

  private live(): number {
    const best = Math.max(0, ...this.guesses().map(g => g.marks.filter(m => m === 'ok').length - 1));
    return best / Math.max(1, this.word.length - 1);
  }

  protected type(k: string): void {
    if (this.over) return;
    this.message.set('');
    if (this.current().length < this.word.length) this.current.update(c => c + k);
  }

  protected back(): void {
    if (this.over) return;
    if (this.current().length > 1) this.current.update(c => c.slice(0, -1));
  }

  protected enter(): void {
    if (this.over) return;
    const g = this.current();
    if (g.length < this.word.length) { this.message.set(`Il faut ${this.word.length} lettres.`); this.wobble(); return; }
    const marks = markGuess(g, this.word);
    this.guesses.update(list => [...list, { text: g, marks }]);
    this.current.set(this.word[0]);
    const key = this.saveKey();
    if (key) writeSave(key, { kind: 'mot', guesses: this.guesses().map(x => x.text) });
    if (g === this.word) { this.finish(true, ['Du premier coup !', 'Bravo !', 'Bien joué !', 'Trouvé !', 'Trouvé, de justesse', 'Ouf, trouvé !'][this.guesses().length - 1]); return; }
    this.miss.emit();
    if (this.guesses().length >= ROWS) this.finish(false, 'Perdu…');
  }

  private finish(found: boolean, text: string): void {
    if (this.over) return;
    this.over = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.message.set(`${text} Le mot était ${this.word}.`);
    const key = this.saveKey();
    if (key) clearSave(key);
    if (this.def().daily) markDailyPlayed();
    const score = found ? ROW_SCORE[this.guesses().length - 1] : 0.3 * this.live();
    this.score = score;
    this.progress.emit({ live: score, time: 0 });
    if (key) {
      const r: Omit<MotResult, 'day'> = { kind: 'mot', id: key, title: this.def().title, icon: this.def().icon, word: this.word, guesses: this.guesses(), found };
      saveResult(r);
      this.result.set({ ...r, day: todayKey() });
      return;
    }
    setTimeout(() => this.done.emit(score), 1500);
  }

  private wobble(): void {
    this.shaking.set(true);
    setTimeout(() => this.shaking.set(false), 350);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (this.over || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') { e.preventDefault(); this.enter(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); this.back(); return; }
    const k = e.key.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    if (/^[A-Z]$/.test(k)) { e.preventDefault(); this.type(k); }
  }
}

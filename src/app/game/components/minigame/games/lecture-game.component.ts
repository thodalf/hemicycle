import { Component, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Q { text: string; options: string[]; answer: number; why: string }

const NAMES = ['Union des Territoires', 'Rassemblement Républicain', 'Gauche Commune', 'Mouvement Progressiste', 'Écologie Populaire', 'Alliance du Centre'];
const SEGS = ['Jeunes', 'Retraités', 'Classes populaires', 'Cadres', 'Ruraux'];

/** Décrypter un sondage : lire les chiffres avant de les commenter à l'antenne */
@Component({
  selector: 'app-lecture-game',
  template: `
    <div class="lec">
      <div class="poll">
        <p class="src">Sondage Hémicycle Opinion · 1 004 personnes · marge d’erreur ± {{ margin }} points</p>
        <ul class="bars">@for (p of parties; track p.name) { <li><span>{{ p.name }}</span><i><em [style.width.%]="p.v * 2.8"></em></i><b>{{ p.v }} %</b></li> }</ul>
        <table>
          <tr><th></th>@for (s of segs; track s) { <th>{{ s }}</th> }</tr>
          <tr><td>{{ parties[0].name }}</td>@for (v of segVals; track $index) { <td>{{ v }} %</td> }</tr>
        </table>
      </div>
      @if (!over()) {
        @if (qs[i()]; as q) {
          <p class="q"><span class="mono">{{ i() + 1 }}/{{ qs.length }}</span> {{ q.text }}</p>
          @if (shown(); as r) { <p class="why" [class.ok]="r">{{ r ? 'Exact.' : 'Non.' }} {{ q.why }}</p> }
          @else { <div class="opts">@for (o of q.options; track o; let k = $index) { <button type="button" (click)="answer(k)">{{ o }}</button> }</div> }
        }
      } @else { <p class="said">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .lec { display: grid; gap: 10px; }
    .poll { padding: 10px; border-radius: 10px; background: #f6f1e4; color: #2a2620; border: 1px solid #d9cfb8; display: grid; gap: 8px; }
    .src { margin: 0; font: italic 11.5px Georgia, serif; }
    .bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 12.5px;
      li { display: grid; grid-template-columns: minmax(0, 150px) 1fr 40px; gap: 8px; align-items: center; } span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      i { height: 10px; background: rgba(0,0,0,.08); border-radius: 2px; overflow: hidden; } em { display: block; height: 100%; background: #1f3a5f; } b { text-align: right; } }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; th, td { border: 1px solid #d9cfb8; padding: 3px 4px; text-align: center; } td:first-child { text-align: left; font-weight: 600; } }
    .q { margin: 0; font-weight: 600; font-size: 14px; .mono { color: var(--ink-3); margin-right: 4px; } }
    .opts { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 6px;
      button { padding: 9px 8px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 600 13px var(--font-body); cursor: pointer; &:hover { border-color: var(--accent); } } }
    .why { margin: 0; padding: 8px 10px; border-radius: 8px; font-size: 12.5px; background: var(--bad-soft); &.ok { background: var(--good-soft); } }
    .said { margin: 0; text-align: center; font-weight: 600; font-size: 13px; }
  `,
})
export class LectureGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected margin = 3;
  protected parties: { name: string; v: number }[] = [];
  protected segs = SEGS;
  protected segVals: number[] = [];
  protected qs: Q[] = [];
  protected readonly i = signal(0);
  protected readonly score = signal(0);
  protected readonly shown = signal<boolean | null>(null);
  protected readonly over = signal(false);
  protected readonly message = signal('');

  ngOnInit(): void {
    const r = (a: number, b: number) => Math.round(a + Math.random() * (b - a));
    const names = [...NAMES].sort(() => Math.random() - 0.5).slice(0, 5);
    // Un duel serré en tête, une fois sur deux
    const top = r(24, 30);
    const second = Math.random() < 0.5 ? top - r(1, 2) : top - r(5, 9);
    const vals = [top, second, r(12, Math.min(19, second - 3)), r(8, 12), r(4, 7)];
    this.parties = names.map((name, k) => ({ name, v: vals[k] }));
    this.segVals = SEGS.map(() => r(vals[0] - 12, vals[0] + 12));
    const tie = top - second <= this.margin;
    const best = this.segVals.indexOf(Math.max(...this.segVals));
    const gap13 = vals[0] - vals[2];
    const shuffle = (ans: string, wrong: string[]) => { const opts = [ans, ...wrong].sort(() => Math.random() - 0.5); return { options: opts, answer: opts.indexOf(ans) }; };
    this.qs = [
      { text: 'Qui arrive en tête de ce sondage ?', ...shuffle(names[0], names.slice(1, 4)), why: `${names[0]} : ${vals[0]} %.` },
      { text: 'Les deux premiers sont-ils séparés au-delà de la marge d’erreur ?', ...shuffle(tie ? 'Non, ils sont à égalité statistique' : 'Oui, l’écart est significatif', [tie ? 'Oui, l’écart est significatif' : 'Non, ils sont à égalité statistique']), why: `Écart de ${vals[0] - vals[1]} point${vals[0] - vals[1] > 1 ? 's' : ''} pour une marge de ± ${this.margin} : ${tie ? 'impossible de les départager.' : 'l’avance est réelle.'}` },
      { text: 'Combien de points séparent le premier du troisième ?', ...shuffle(`${gap13} points`, [`${gap13 + 4} points`, `${Math.max(1, gap13 - 3)} points`, `${vals[2]} points`]), why: `${vals[0]} − ${vals[2]} = ${gap13}.` },
      { text: `Quel électorat donne son meilleur score à « ${names[0]} » ?`, ...shuffle(SEGS[best], SEGS.filter((_, k) => k !== best).slice(0, 3)), why: `${SEGS[best]} : ${this.segVals[best]} %.` },
    ];
  }

  protected answer(k: number): void {
    if (this.shown() !== null || this.over()) return;
    const ok = k === this.qs[this.i()].answer;
    if (ok) this.score.update(x => x + 1); else this.miss.emit();
    this.shown.set(ok);
    this.progress.emit({ live: this.score() / this.qs.length, time: 1 - (this.i() + 1) / this.qs.length });
    setTimeout(() => {
      this.shown.set(null);
      if (this.i() + 1 >= this.qs.length) return this.finish();
      this.i.update(x => x + 1);
    }, ok ? 1300 : 2400);
  }

  private finish(): void {
    this.over.set(true);
    const r = this.score() / this.qs.length;
    this.message.set(r === 1 ? 'Lecture parfaite : vous corrigez même le présentateur.' : r >= 0.5 ? 'Correct, avec une approximation qui fera sourire les sondeurs.' : 'Vous avez fait dire au sondage ce qu’il ne disait pas.');
    this.progress.emit({ live: r, time: 0 });
    setTimeout(() => this.done.emit(Math.max(0.1, r)), 2000);
  }
}

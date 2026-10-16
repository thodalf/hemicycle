import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/* ============================================================
 *  Le portrait officiel : composer le tableau du règne, élément
 *  par élément (pose, costume, décor, regard, attribut). Chaque
 *  choix pèse sur trois impressions (majesté, proximité,
 *  modernité) ; le pays attend un certain portrait, qu'il faut
 *  deviner dans la commande du chambellan.
 * ============================================================ */

type Axis = 'maj' | 'pro' | 'mod';
interface Opt { icon: string; label: string; v: Record<Axis, number> }
interface Step { name: string; opts: Opt[] }

const STEPS: Step[] = [
  { name: 'La pose', opts: [
    { icon: '🧍', label: 'En pied, la main sur la hanche', v: { maj: 3, pro: 0, mod: 0 } },
    { icon: '🪑', label: 'Assis sur le trône', v: { maj: 4, pro: -1, mod: -1 } },
    { icon: '🚶', label: 'En marche, saisi sur le vif', v: { maj: 0, pro: 2, mod: 3 } },
    { icon: '🙂', label: 'Accoudé, souriant', v: { maj: -1, pro: 3, mod: 1 } },
  ] },
  { name: 'Le costume', opts: [
    { icon: '👑', label: 'Manteau d’hermine et couronne', v: { maj: 4, pro: -2, mod: -2 } },
    { icon: '🎖️', label: 'Grand uniforme d’apparat', v: { maj: 3, pro: 0, mod: -1 } },
    { icon: '👔', label: 'Costume sombre, sans cravate', v: { maj: 0, pro: 1, mod: 3 } },
    { icon: '🧥', label: 'Pull de laine, manches retroussées', v: { maj: -2, pro: 4, mod: 1 } },
  ] },
  { name: 'Le décor', opts: [
    { icon: '🏰', label: 'La galerie des glaces', v: { maj: 4, pro: -1, mod: -1 } },
    { icon: '🌾', label: 'Un champ de blé au couchant', v: { maj: 0, pro: 3, mod: 0 } },
    { icon: '🏙️', label: 'Les toits de Paris', v: { maj: 1, pro: 1, mod: 2 } },
    { icon: '🔬', label: 'Un laboratoire de recherche', v: { maj: 0, pro: 0, mod: 4 } },
  ] },
  { name: 'Le regard', opts: [
    { icon: '🦅', label: 'Au loin, vers l’avenir', v: { maj: 3, pro: 0, mod: 1 } },
    { icon: '👀', label: 'Droit dans les yeux du spectateur', v: { maj: 1, pro: 3, mod: 1 } },
    { icon: '😌', label: 'Bienveillant, un peu las', v: { maj: 0, pro: 2, mod: 0 } },
    { icon: '🤨', label: 'Sévère, le sourcil levé', v: { maj: 3, pro: -2, mod: 0 } },
  ] },
  { name: 'L’attribut', opts: [
    { icon: '⚜️', label: 'Le sceptre et la main de justice', v: { maj: 4, pro: -1, mod: -2 } },
    { icon: '📖', label: 'La Constitution, ouverte', v: { maj: 1, pro: 1, mod: 1 } },
    { icon: '🐕', label: 'Le chien de la famille', v: { maj: -1, pro: 4, mod: 0 } },
    { icon: '📱', label: 'Une tablette numérique', v: { maj: -1, pro: 1, mod: 4 } },
  ] },
];

const COMMANDS: { text: string; target: Record<Axis, number> }[] = [
  { text: '« Le pays doute : il veut voir un souverain qui lui ressemble, simple et proche. »', target: { maj: 3, pro: 14, mod: 5 } },
  { text: '« Les chancelleries nous regardent : il faut un portrait qui en impose, digne des plus grandes cours. »', target: { maj: 16, pro: 0, mod: 1 } },
  { text: '« La jeunesse ne se reconnaît plus dans la couronne : montrez une monarchie tournée vers demain. »', target: { maj: 3, pro: 4, mod: 14 } },
  { text: '« Un juste milieu : de la tenue, mais de la chaleur, et un pied dans notre siècle. »', target: { maj: 8, pro: 7, mod: 7 } },
  { text: '« La tradition avant tout, mais que le peuple sente qu’on l’aime. »', target: { maj: 11, pro: 9, mod: 0 } },
];

const LABEL: Record<Axis, string> = { maj: 'Majesté', pro: 'Proximité', mod: 'Modernité' };

@Component({
  selector: 'app-portrait-game',
  template: `
    <div class="pt">
      <p class="cmd"><b>La commande du chambellan</b> {{ command.text }}</p>
      <div class="cols">
        <div class="canvas" [class.reveal]="over()">
          <div class="frame">
            <span class="bg">{{ pick(2)?.icon ?? '' }}</span>
            <span class="who">{{ pick(0)?.icon ?? '🖼️' }}</span>
            <span class="costume">{{ pick(1)?.icon ?? '' }}</span>
            <span class="eyes">{{ pick(3)?.icon ?? '' }}</span>
            <span class="attr">{{ pick(4)?.icon ?? '' }}</span>
          </div>
          <div class="bars">
            @for (a of axes; track a) {
              <div class="b"><span>{{ label[a] }}</span><i><em [style.width.%]="pct(a)"></em></i></div>
            }
          </div>
        </div>
        <div class="choice">
          @if (!over()) {
            <p class="step">{{ step() + 1 }}/{{ steps.length }} · <b>{{ steps[step()].name }}</b></p>
            <div class="opts">
              @for (o of steps[step()].opts; track o.label) {
                <button type="button" class="opt" (click)="choose(o)"><span class="ic">{{ o.icon }}</span>{{ o.label }}</button>
              }
            </div>
            <div class="timer"><i [style.width.%]="left() * 100"></i></div>
          } @else {
            <p class="verdict"><b>{{ verdict() }}</b></p>
            <p class="muted small">Ce qu’attendait le pays : @for (a of axes; track a) { {{ label[a] }} {{ command.target[a] }}@if (!$last) { · } }</p>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .pt { display: grid; gap: 10px; }
    .cmd { margin: 0; font-size: 13px; color: var(--ink-2); padding: 8px 10px; border-left: 3px solid #b08d3c; background: var(--surface-2); border-radius: 0 8px 8px 0; b { display: block; color: var(--ink); font-size: 12px; } }
    .cols { display: grid; grid-template-columns: 1fr 1.2fr; gap: 12px; }
    @media (max-width: 520px) { .cols { grid-template-columns: 1fr; } }
    .canvas { display: grid; gap: 8px; }
    .frame { position: relative; aspect-ratio: 4 / 5; border-radius: 6px; border: 10px solid #b08d3c; box-shadow: inset 0 0 0 2px #7a5f22, 0 4px 14px rgba(0,0,0,.25);
      background: radial-gradient(ellipse at 50% 35%, #5d4a33, #2b2219); overflow: hidden; transition: filter .6s;
      span { position: absolute; line-height: 1; transition: transform .35s ease, opacity .35s; }
      .bg { inset: 0; display: grid; place-items: center; font-size: 110px; opacity: .28; filter: blur(1px); }
      .who { left: 50%; top: 42%; transform: translate(-50%, -50%); font-size: 64px; }
      .costume { left: 50%; top: 70%; transform: translate(-50%, -50%); font-size: 40px; }
      .eyes { left: 50%; top: 15%; transform: translateX(-50%); font-size: 26px; }
      .attr { right: 10%; bottom: 8%; font-size: 34px; } }
    .canvas.reveal .frame { filter: sepia(.25) contrast(1.05); }
    .bars { display: grid; gap: 4px; }
    .b { display: grid; grid-template-columns: 80px 1fr; gap: 6px; align-items: center; font-size: 11.5px;
      i { height: 7px; border-radius: 4px; background: var(--surface-2); overflow: hidden; } em { display: block; height: 100%; background: #b08d3c; transition: width .4s; } }
    .step { margin: 0 0 6px; font-size: 13px; }
    .opts { display: grid; gap: 6px; }
    .opt { display: flex; gap: 8px; align-items: center; text-align: left; padding: 9px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface);
      color: var(--ink); font: 13px var(--font-body); cursor: pointer; transition: transform .12s, border-color .12s;
      &:hover { border-color: #b08d3c; transform: translateX(3px); } .ic { font-size: 20px; } }
    .timer { margin-top: 8px; height: 5px; border-radius: 3px; background: var(--surface-2); overflow: hidden; i { display: block; height: 100%; background: var(--accent); transition: width .2s linear; } }
    .verdict { margin: 0; font-size: 14px; } .small { font-size: 12px; margin: 4px 0 0; }
  `,
})
export class PortraitGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly steps = STEPS;
  protected readonly axes: Axis[] = ['maj', 'pro', 'mod'];
  protected readonly label = LABEL;
  protected command = COMMANDS[0];
  protected readonly picks = signal<Opt[]>([]);
  protected readonly step = computed(() => this.picks().length);
  protected readonly over = signal(false);
  protected readonly left = signal(1);
  protected readonly verdict = signal('');
  private timer?: ReturnType<typeof setInterval>;
  private finishT?: ReturnType<typeof setTimeout>;
  private stepStart = Date.now();

  ngOnInit(): void {
    this.command = COMMANDS[Math.floor(Math.random() * COMMANDS.length)];
    const per = 12000 / Math.max(0.7, this.diff());
    this.timer = setInterval(() => {
      if (this.over()) return;
      const l = 1 - (Date.now() - this.stepStart) / per;
      this.left.set(Math.max(0, l));
      // Le peintre s'impatiente : il choisit au hasard
      if (l <= 0) { this.miss.emit(); const o = STEPS[this.step()].opts; this.choose(o[Math.floor(Math.random() * o.length)]); }
    }, 150);
  }

  ngOnDestroy(): void { clearInterval(this.timer); clearTimeout(this.finishT); }

  protected pick(i: number): Opt | undefined { return this.picks()[i]; }

  private sum(): Record<Axis, number> {
    const s = { maj: 0, pro: 0, mod: 0 };
    for (const p of this.picks()) for (const a of this.axes) s[a] += p.v[a];
    return s;
  }

  protected pct(a: Axis): number { return Math.max(0, Math.min(100, (this.sum()[a] + 4) / 24 * 100)); }

  private score(): number {
    const s = this.sum();
    const t = this.command.target;
    const d = Math.sqrt(this.axes.reduce((acc, a) => acc + (s[a] - t[a]) ** 2, 0));
    return Math.max(0, Math.min(1, 1 - d / 18));
  }

  protected choose(o: Opt): void {
    if (this.over()) return;
    this.picks.update(p => [...p, o]);
    this.stepStart = Date.now();
    this.left.set(1);
    this.progress.emit({ live: this.score(), time: 1 - this.step() / STEPS.length });
    if (this.step() >= STEPS.length) this.finish();
  }

  private finish(): void {
    this.over.set(true);
    clearInterval(this.timer);
    const r = this.score();
    this.verdict.set(r >= 0.8 ? 'Un chef-d’œuvre : le portrait sera dans tous les manuels d’histoire.'
      : r >= 0.6 ? 'Un beau portrait, que la presse salue.'
      : r >= 0.4 ? 'Le portrait divise : certains le trouvent à côté de son époque.'
      : 'Un fiasco : le tableau fait le tour des réseaux… pour les mauvaises raisons.');
    if (r < 0.4) this.miss.emit();
    this.finishT = setTimeout(() => this.done.emit(Math.max(0.1, r)), 2200);
  }
}

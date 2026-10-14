import { Component, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Speech { title: string; lines: string[] }

/** Chaque discours suit le même fil : accroche, constat, cause, proposition, appel */
const SPEECHES: Speech[] = [
  { title: 'Discours sur l’hôpital', lines: [
    'Il y a trois semaines, j’ai passé une nuit aux urgences de notre ville.',
    'J’y ai vu des soignants épuisés et des patients qui attendaient depuis neuf heures.',
    'Depuis vingt ans, on ferme des lits pour faire des économies.',
    'Je propose de rouvrir 5 000 lits et de mieux payer celles et ceux qui soignent.',
    'Ensemble, rendons à l’hôpital les moyens de sauver des vies.',
  ] },
  { title: 'Discours sur l’école', lines: [
    'Ma grand-mère était institutrice dans un village de trois cents âmes.',
    'Aujourd’hui, un élève sur cinq entre en sixième sans savoir bien lire.',
    'Nous avons laissé le métier d’enseignant perdre son prestige et ses moyens.',
    'Je propose des classes de quinze élèves en primaire, partout en France.',
    'Faisons de l’école la première promesse de la République.',
  ] },
  { title: 'Discours sur l’industrie', lines: [
    'Dans cette usine, mon père a travaillé trente-deux ans.',
    'Elle a fermé il y a dix ans, et la ville ne s’en est jamais remise.',
    'Nous avons cru qu’un pays pouvait vivre sans fabriquer.',
    'Je propose un fonds de relocalisation pour cent usines en cinq ans.',
    'Rallumons ensemble les lumières de nos ateliers.',
  ] },
  { title: 'Discours sur le climat', lines: [
    'L’été dernier, la rivière de mon enfance était à sec.',
    'Les sécheresses, les incendies et les inondations se multiplient.',
    'Nous avons trop longtemps repoussé les décisions difficiles.',
    'Je propose un grand plan de rénovation des logements et des transports propres.',
    'Agissons maintenant, pour que nos enfants nous remercient.',
  ] },
  { title: 'Discours sur la sécurité', lines: [
    'Mardi soir, une infirmière s’est fait agresser en rentrant du travail.',
    'Dans certains quartiers, la peur s’est installée dans les halls d’immeuble.',
    'La police de proximité a disparu, et l’État avec elle.',
    'Je propose 10 000 policiers de terrain, à pied, dans chaque quartier.',
    'La tranquillité est un droit : rendons-la à chaque Français.',
  ] },
];
const STEPS = ['Accroche', 'Constat', 'Cause', 'Proposition', 'Appel'];

/** La plume : remettre le discours dans l'ordre, de l'accroche à l'appel final */
@Component({
  selector: 'app-plume-game',
  template: `
    <div class="plume">
      <p class="title"><strong>✒️ {{ speech.title }}</strong> <small class="muted">— cliquez les phrases dans l’ordre du discours</small></p>
      <ol class="draft">
        @for (step of steps; track step; let i = $index) {
          <li [class.filled]="order()[i] !== undefined" [class.good]="over() && order()[i] === i" [class.bad]="over() && order()[i] !== undefined && order()[i] !== i">
            <span class="step">{{ step }}</span>
            <span class="txt">{{ order()[i] !== undefined ? speech.lines[order()[i]] : '…' }}</span>
          </li>
        }
      </ol>
      @if (!over()) {
        <div class="pool">
          @for (i of shuffled; track i) {
            @if (!order().includes(i)) { <button type="button" class="line" (click)="pick(i)">{{ speech.lines[i] }}</button> }
          }
        </div>
        @if (order().length) { <button class="btn small" (click)="undo()">↶ Retirer la dernière</button> }
      } @else { <p class="said">{{ message() }}</p> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .plume { display: grid; gap: 10px; }
    .title { margin: 0; font-size: 14px; small { font-size: 12px; } }
    .draft { list-style: none; margin: 0; padding: 10px; display: grid; gap: 5px; border-radius: 10px; background: #fbf8ef; border: 1px solid var(--line);
      font-family: Georgia, serif;
      li { display: grid; grid-template-columns: 92px 1fr; gap: 8px; font-size: 13px; padding: 4px 6px; border-radius: 6px; }
      li.filled .txt { animation: ink .4s ease; } li.good { background: var(--good-soft); } li.bad { background: var(--bad-soft); }
      .step { font: 600 10.5px var(--font-body); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); padding-top: 2px; }
      .txt { color: var(--ink); } }
    @keyframes ink { from { opacity: 0; filter: blur(2px); } }
    .pool { display: grid; gap: 5px; }
    .line { text-align: left; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 13px var(--font-body); cursor: pointer;
      &:hover { border-color: var(--accent); } }
    .said { margin: 0; text-align: center; font-weight: 600; font-size: 13px; }
  `,
})
export class PlumeGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly steps = STEPS;
  protected speech: Speech = SPEECHES[0];
  protected shuffled: number[] = [];
  protected readonly order = signal<number[]>([]);
  protected readonly over = signal(false);
  protected readonly message = signal('');
  protected readonly correct = computed(() => this.order().filter((v, i) => v === i).length);

  ngOnInit(): void {
    this.speech = SPEECHES[Math.floor(Math.random() * SPEECHES.length)];
    this.shuffled = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5);
  }

  protected pick(i: number): void {
    if (this.over()) return;
    this.order.update(o => [...o, i]);
    this.progress.emit({ live: this.correct() / 5, time: 1 - this.order().length / 5 });
    if (this.order().length === 5) this.finish();
  }

  protected undo(): void {
    this.order.update(o => o.slice(0, -1));
  }

  private finish(): void {
    this.over.set(true);
    const c = this.correct();
    const s = c === 5 ? 1 : c >= 3 ? 0.6 : c >= 1 ? 0.3 : 0.1;
    if (c < 5) this.miss.emit();
    this.message.set(c === 5 ? 'Un discours limpide : la salle se lève à la dernière phrase.' : c >= 3 ? 'Le fil se tient, presque. Quelques transitions boiteuses.' : 'Un discours décousu : la salle décroche dès la deuxième minute.');
    this.progress.emit({ live: s, time: 0 });
    setTimeout(() => this.done.emit(s), 2200);
  }
}

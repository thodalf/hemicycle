import { Component, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

type Tag = 'ouvrier' | 'cadre' | 'rural' | 'jeunes' | 'seniors' | 'local' | 'ecologie' | 'securite' | 'economie' | 'social';
const TAG_LABEL: Record<Tag, string> = { ouvrier: '🔧 ouvrier', cadre: '💼 cadres', rural: '🌾 rural', jeunes: '🎓 jeunes', seniors: '🧓 seniors', local: '📍 enraciné', ecologie: '🌿 écologie', securite: '🛡️ sécurité', economie: '📈 économie', social: '🤝 social' };

interface Circo { name: string; tags: [Tag, Tag] }
interface Cand { name: string; bio: string; tags: [Tag, Tag] }

const CIRCOS: Circo[] = [
  { name: 'Bassin minier du Nord', tags: ['ouvrier', 'social'] },
  { name: 'Centre-ville de Bordeaux', tags: ['cadre', 'economie'] },
  { name: 'Plateaux du Cantal', tags: ['rural', 'local'] },
  { name: 'Ville universitaire de Rennes', tags: ['jeunes', 'ecologie'] },
  { name: 'Côte d’Azur', tags: ['seniors', 'securite'] },
  { name: 'Vallée industrielle du Doubs', tags: ['ouvrier', 'economie'] },
  { name: 'Bocage normand', tags: ['rural', 'seniors'] },
  { name: 'Banlieue est de Lyon', tags: ['jeunes', 'social'] },
  { name: 'Quartiers d’affaires de l’Ouest parisien', tags: ['cadre', 'securite'] },
  { name: 'Vignobles d’Alsace', tags: ['local', 'ecologie'] },
];
/** Biographies, au masculin et au féminin */
const BIOS: Record<string, [string, string]> = {
  'ouvrier,social': ['Ancien délégué syndical', 'Ancienne déléguée syndicale'], 'cadre,economie': ['Directeur financier', 'Directrice financière'],
  'rural,local': ['Éleveur, maire de son village', 'Éleveuse, maire de son village'], 'jeunes,ecologie': ['Militant pour le climat, 26 ans', 'Militante pour le climat, 26 ans'],
  'seniors,securite': ['Commissaire de police retraité', 'Commissaire de police retraitée'], 'ouvrier,economie': ['Chef d’atelier, repreneur d’usine', 'Cheffe d’atelier, repreneuse d’usine'],
  'rural,seniors': ['Médecin de campagne', 'Médecin de campagne'], 'jeunes,social': ['Éducateur de rue', 'Éducatrice de rue'],
  'cadre,securite': ['Avocat d’affaires, ancien magistrat', 'Avocate d’affaires, ancienne magistrate'], 'local,ecologie': ['Vigneron en bio', 'Vigneronne en bio'],
};
const FIRST: [string, 0 | 1][] = [['Claire', 1], ['Mehdi', 0], ['Sophie', 1], ['Julien', 0], ['Nadia', 1], ['Bruno', 0], ['Inès', 1], ['Hugo', 0], ['Agnès', 1], ['Karim', 0], ['Léa', 1], ['Paul', 0]];
const LAST = ['Martel', 'Benali', 'Roussel', 'Garnier', 'Lefèvre', 'Da Silva', 'Perrin', 'Morel', 'Haddad', 'Lemoine', 'Faure', 'Royer'];

/** La commission d'investiture : la bonne tête dans la bonne circonscription */
@Component({
  selector: 'app-investitures-game',
  template: `
    <div class="inv">
      <p class="hint">@if (!over()) { Choisissez un·e candidat·e, puis sa circonscription. Les étiquettes communes font gagner des voix. } @else { {{ message() }} }</p>
      <div class="cands">
        @for (c of cands; track c.name; let i = $index) {
          <button type="button" class="cand" [class.sel]="sel() === i" [class.used]="placedIn(i) >= 0" [disabled]="over()" (click)="sel.set(sel() === i ? null : i)">
            <strong>{{ c.name }}</strong><small>{{ c.bio }}</small>
            <span class="tags">@for (t of c.tags; track t) { <i>{{ tag(t) }}</i> }</span>
          </button>
        }
      </div>
      <div class="circos">
        @for (z of circos; track z.name; let j = $index) {
          @let ci = assign()[j];
          <button type="button" class="circo" [class.target]="sel() !== null" [class.filled]="ci !== undefined && ci !== null" [disabled]="over()" (click)="place(j)">
            <span class="zn">{{ z.name }}</span>
            <span class="tags">@for (t of z.tags; track t) { <i [class.hit]="ci !== undefined && ci !== null && cands[ci].tags.includes(t)">{{ tag(t) }}</i> }</span>
            @if (ci !== undefined && ci !== null) { <span class="who">→ {{ cands[ci].name }} <b>{{ fit(ci, j) }}/2</b></span> }
          </button>
        }
      </div>
      @if (!over()) { <button class="btn primary small" [disabled]="placed() < circos.length" (click)="finish()">Valider les investitures ({{ placed() }}/{{ circos.length }})</button> }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .inv { display: grid; gap: 10px; }
    .hint { margin: 0; font-size: 12.5px; color: var(--ink-2); }
    .cands, .circos { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px; }
    .cand, .circo { text-align: left; display: grid; gap: 3px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 12.5px var(--font-body); cursor: pointer; transition: transform .12s ease, border-color .12s ease;
      small { color: var(--ink-3); font-size: 11.5px; } &:disabled { cursor: default; } }
    .cand.sel { border-color: var(--accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent); transform: translateY(-2px); }
    .cand.used { opacity: .55; }
    .circo { background: var(--surface-2); .zn { font-weight: 600; } .who { font-size: 12px; b { color: var(--good); } } }
    .circo.target:not(:disabled):hover { border-color: var(--accent); }
    .circo.filled { animation: pop .25s ease; }
    @keyframes pop { 50% { transform: scale(1.03); } }
    .tags { display: flex; flex-wrap: wrap; gap: 3px; i { font-style: normal; font-size: 10.5px; padding: 1px 6px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--line); } }
    .circo .tags i { background: var(--surface); } .tags i.hit { background: var(--good-soft); border-color: var(--good); }
  `,
})
export class InvestituresGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected circos: Circo[] = [];
  protected cands: Cand[] = [];
  protected readonly sel = signal<number | null>(null);
  /** assign[circo] = index du candidat */
  protected readonly assign = signal<(number | null)[]>([]);
  protected readonly over = signal(false);
  protected readonly message = signal('');
  protected readonly placed = computed(() => this.assign().filter(x => x !== null && x !== undefined).length);

  ngOnInit(): void {
    const n = this.diff() >= 3 ? 6 : 5;
    this.circos = [...CIRCOS].sort(() => Math.random() - 0.5).slice(0, n);
    const firsts = [...FIRST].sort(() => Math.random() - 0.5), lasts = [...LAST].sort(() => Math.random() - 0.5);
    // Un profil taillé pour chaque circonscription… avec une étiquette brouillée sur deux profils
    this.cands = this.circos.map((z, i) => {
      const tags: [Tag, Tag] = [...z.tags] as [Tag, Tag];
      if (i % 3 === 1) tags[1] = this.circos[(i + 1) % n].tags[0];
      const [first, fem] = firsts[i];
      return { name: `${first} ${lasts[i]}`, bio: BIOS[z.tags.join(',')]?.[fem] ?? (fem ? 'Militante de longue date' : 'Militant de longue date'), tags };
    }).sort(() => Math.random() - 0.5);
    this.assign.set(this.circos.map(() => null));
  }

  protected tag(t: Tag) { return TAG_LABEL[t]; }
  protected placedIn(i: number) { return this.assign().indexOf(i); }
  protected fit(ci: number, j: number) { return this.cands[ci].tags.filter(t => this.circos[j].tags.includes(t)).length; }

  protected place(j: number): void {
    const i = this.sel();
    if (this.over()) return;
    const a = [...this.assign()];
    if (i === null) { a[j] = null; this.assign.set(a); return; }
    const prev = a.indexOf(i);
    if (prev >= 0) a[prev] = null;
    a[j] = i;
    this.assign.set(a);
    this.sel.set(null);
    this.progress.emit({ live: this.total() / (2 * this.circos.length), time: 1 - this.placed() / this.circos.length });
  }

  private total(): number { return this.assign().reduce<number>((t, ci, j) => t + (ci === null || ci === undefined ? 0 : this.fit(ci, j)), 0); }

  protected finish(): void {
    if (this.over()) return;
    this.over.set(true);
    // Le meilleur score possible, pour juger équitablement
    const best = this.bestTotal();
    const r = best ? this.total() / best : 1;
    if (r < 1) this.miss.emit();
    this.message.set(r >= 1 ? 'Des investitures parfaites : chaque candidat·e colle à son terrain.' : r >= 0.75 ? 'De bons choix, quelques parachutages discutables.' : 'Des parachutages en série : les fédérations grondent.');
    this.progress.emit({ live: r, time: 0 });
    setTimeout(() => this.done.emit(Math.max(0.1, Math.min(1, r))), 2000);
  }

  private bestTotal(): number {
    const n = this.circos.length;
    let best = 0;
    const used = new Array(n).fill(false);
    const go = (j: number, acc: number) => {
      if (j === n) { best = Math.max(best, acc); return; }
      for (let i = 0; i < n; i++) if (!used[i]) { used[i] = true; go(j + 1, acc + this.fit(i, j)); used[i] = false; }
    };
    go(0, 0);
    return best;
  }
}

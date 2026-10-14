import { Component, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

interface Item { id: string; icon: string; name: string; kg: number; tags: string[] }
interface Trip { title: string; brief: string[]; needs: string[]; bonus: string[] }

const ITEMS: Item[] = [
  { id: 'costume', icon: '🤵', name: 'Costume de cérémonie', kg: 2, tags: ['gala', 'officiel'] },
  { id: 'parapluie', icon: '☂️', name: 'Parapluie', kg: 1, tags: ['pluie'] },
  { id: 'dossiers', icon: '📁', name: 'Dossiers techniques', kg: 2, tags: ['negociation', 'officiel'] },
  { id: 'bottes', icon: '🥾', name: 'Bottes de terrain', kg: 2, tags: ['terrain', 'pluie'] },
  { id: 'cadeau', icon: '🎁', name: 'Cadeau protocolaire', kg: 1, tags: ['officiel', 'hote'] },
  { id: 'chargeur', icon: '🔋', name: 'Batterie de secours', kg: 0.5, tags: ['long', 'presse'] },
  { id: 'doudoune', icon: '🧥', name: 'Doudoune', kg: 2, tags: ['froid'] },
  { id: 'creme', icon: '🧴', name: 'Crème solaire', kg: 0.5, tags: ['soleil'] },
  { id: 'discours', icon: '📜', name: 'Discours imprimé', kg: 0.5, tags: ['discours', 'officiel'] },
  { id: 'dictionnaire', icon: '📕', name: 'Guide de conversation', kg: 1, tags: ['etranger'] },
  { id: 'baskets', icon: '👟', name: 'Baskets de course', kg: 1, tags: ['sport'] },
  { id: 'livre', icon: '📚', name: 'Pavé de 900 pages', kg: 2, tags: [] },
  { id: 'echarpe', icon: '🎗️', name: 'Écharpe tricolore', kg: 0.5, tags: ['officiel', 'terrain'] },
  { id: 'chapeau', icon: '👒', name: 'Chapeau de paille', kg: 1, tags: ['soleil'] },
  { id: 'medocs', icon: '💊', name: 'Trousse de pharmacie', kg: 1, tags: ['long', 'etranger'] },
  { id: 'console', icon: '🎮', name: 'Console de jeux', kg: 1.5, tags: [] },
];

const TRIPS: Trip[] = [
  { title: 'Sommet européen à Bruxelles', brief: ['Deux jours de négociations', 'Pluie annoncée', 'Dîner de gala le soir'], needs: ['negociation', 'pluie', 'gala'], bonus: ['officiel', 'long'] },
  { title: 'Inondations dans le Gard', brief: ['Visite des sinistrés', 'Boue et pluie', 'Point presse en fin de journée'], needs: ['terrain', 'pluie', 'presse'], bonus: ['officiel'] },
  { title: 'Visite d’État à Tokyo', brief: ['Cinq jours à l’étranger', 'Échange de cadeaux avec l’Empereur', 'Discours devant le Parlement japonais'], needs: ['hote', 'discours', 'etranger'], bonus: ['officiel', 'long', 'gala'] },
  { title: 'Tournée des stations de ski', brief: ['Trois jours dans les Alpes', '−12 °C au sommet', 'Interviews en direct'], needs: ['froid', 'presse'], bonus: ['terrain', 'long'] },
  { title: 'Outre-mer : la Martinique', brief: ['Soleil de plomb', 'Visite des quartiers', 'Commémoration officielle'], needs: ['soleil', 'terrain', 'officiel'], bonus: ['discours', 'long'] },
  { title: 'Marathon caritatif à Lyon', brief: ['10 km pour une association', 'Discours à l’arrivée', 'Soleil en matinée'], needs: ['sport', 'discours'], bonus: ['soleil', 'presse'] },
];

/** La valise du déplacement : emporter ce qui servira vraiment, dans la limite du poids */
@Component({
  selector: 'app-valise-game',
  template: `
    <div class="valise">
      <div class="trip">
        <strong>✈️ {{ trip.title }}</strong>
        <ul>@for (b of trip.brief; track b) { <li>{{ b }}</li> }</ul>
      </div>
      <div class="bag" [class.full]="weight() > cap" [class.shut]="over()">
        <span class="bag-ico">🧳</span>
        <span class="gauge"><i [style.width.%]="Math.min(100, weight() / cap * 100)"></i></span>
        <span class="mono">{{ fmt(weight()) }} / {{ cap }} kg</span>
      </div>
      <div class="items">
        @for (it of items; track it.id) {
          <button type="button" class="item" [class.in]="picked().has(it.id)" (click)="toggle(it)" [disabled]="over() || (!picked().has(it.id) && weight() + it.kg > cap)">
            <span class="ic">{{ it.icon }}</span><span class="nm">{{ it.name }}</span><small class="mono">{{ fmt(it.kg) }} kg</small>
          </button>
        }
      </div>
      @if (!over()) {
        <button class="btn primary" (click)="close()" [disabled]="!picked().size">Fermer la valise</button>
      } @else {
        <ul class="review">
          @for (r of review(); track r.name) { <li [class]="r.kind">{{ r.icon }} {{ r.name }} : {{ r.text }}</li> }
        </ul>
        <p class="said">{{ message() }}</p>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .valise { display: grid; gap: 10px; }
    .trip { padding: 8px 12px; border-radius: 10px; background: var(--surface-2); border: 1px dashed var(--line); font-size: 13px; ul { margin: 4px 0 0; padding-left: 18px; } }
    .bag { display: flex; align-items: center; gap: 10px; font-size: 13px; transition: transform .2s;
      .bag-ico { font-size: 28px; } .gauge { flex: 1; height: 10px; border-radius: 5px; background: var(--line); overflow: hidden; i { display: block; height: 100%; background: var(--accent); transition: width .3s ease; } } }
    .bag.shut .bag-ico { animation: shut .6s cubic-bezier(.3, 1.6, .5, 1); }
    @keyframes shut { 30% { transform: scale(1.3) rotate(-8deg); } 60% { transform: scale(.9) rotate(4deg); } }
    .items { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
    .item { display: grid; grid-template-columns: auto 1fr auto; gap: 6px; align-items: center; text-align: left; padding: 7px 9px; border-radius: 10px; border: 1px solid var(--line);
      background: var(--surface); color: var(--ink); font: 12.5px var(--font-body); cursor: pointer; transition: transform .15s;
      .ic { font-size: 18px; } small { color: var(--ink-3); }
      &.in { border-color: var(--accent); background: var(--accent-soft); animation: drop-in .3s ease; }
      &:disabled:not(.in) { opacity: .45; cursor: not-allowed; } }
    @keyframes drop-in { 40% { transform: translateY(4px) scale(.95); } }
    .review { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: 12.5px;
      li { padding: 3px 8px; border-radius: 6px; } .good { background: var(--good-soft); } .bad { background: var(--bad-soft); } .meh { background: var(--surface-2); } }
    .said { margin: 0; text-align: center; font-weight: 600; font-size: 13px; }
  `,
})
export class ValiseGameComponent {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly Math = Math;
  protected trip: Trip = TRIPS[0];
  protected items: Item[] = [];
  protected cap = 8;
  protected readonly picked = signal(new Set<string>());
  protected readonly over = signal(false);
  protected readonly message = signal('');
  protected readonly review = signal<{ icon: string; name: string; text: string; kind: string }[]>([]);
  protected readonly weight = computed(() => this.items.filter(i => this.picked().has(i.id)).reduce((s, i) => s + i.kg, 0));

  ngOnInit(): void {
    this.trip = TRIPS[Math.floor(Math.random() * TRIPS.length)];
    // Les objets indispensables sont toujours proposés, le reste complète au hasard
    const must = this.trip.needs.map(n => ITEMS.find(i => i.tags.includes(n))!).filter((x, i, a) => a.indexOf(x) === i);
    const rest = ITEMS.filter(i => !must.includes(i)).sort(() => Math.random() - 0.5).slice(0, 12 - must.length);
    this.items = [...must, ...rest].sort(() => Math.random() - 0.5);
    this.cap = Math.round(8 - (this.diff() - 1) * 2);
  }

  protected fmt(n: number) { return n.toLocaleString('fr-FR'); }

  private value(it: Item): number {
    return it.tags.reduce((s, t) => s + (this.trip.needs.includes(t) ? 3 : this.trip.bonus.includes(t) ? 1 : 0), 0);
  }

  protected toggle(it: Item): void {
    if (this.over()) return;
    const set = new Set(this.picked());
    if (set.has(it.id)) set.delete(it.id); else if (this.weight() + it.kg <= this.cap) set.add(it.id);
    this.picked.set(set);
  }

  /** Meilleur remplissage possible (petit sac à dos) */
  private best(): number {
    const its = this.items;
    let best = 0;
    for (let mask = 0; mask < 1 << its.length; mask++) {
      let w = 0, v = 0;
      for (let i = 0; i < its.length; i++) if (mask & (1 << i)) { w += its[i].kg; v += this.value(its[i]); if (w > this.cap) break; }
      if (w <= this.cap && v > best) best = v;
    }
    return best;
  }

  protected close(): void {
    this.over.set(true);
    const chosen = this.items.filter(i => this.picked().has(i.id));
    const got = chosen.reduce((s, i) => s + this.value(i), 0);
    const missing = this.trip.needs.filter(n => !chosen.some(i => i.tags.includes(n)));
    const s = Math.max(0, Math.min(1, got / Math.max(1, this.best()) - missing.length * 0.12));
    this.review.set(chosen.map(i => {
      const v = this.value(i);
      return { icon: i.icon, name: i.name, kind: v >= 3 ? 'good' : v > 0 ? 'meh' : 'bad', text: v >= 3 ? 'indispensable' : v > 0 ? 'utile' : 'inutile, et lourd' };
    }));
    const MISS: Record<string, string> = { pluie: 'trempé·e jusqu’aux os', gala: 'en jean au dîner de gala', negociation: 'sans vos dossiers à la table', terrain: 'les chaussures dans la boue', presse: 'téléphone à plat avant la conférence', hote: 'les mains vides devant votre hôte', discours: 'improvisant votre discours', etranger: 'perdu·e sans traduction', froid: 'grelottant·e', soleil: 'rouge comme une tomate', sport: 'courant en mocassins', officiel: 'sans écharpe ni protocole' };
    if (missing.length) this.miss.emit();
    this.message.set(missing.length ? `Oubli : vous voilà ${missing.map(m => MISS[m] ?? m).join(', ')}.` : s >= 0.9 ? 'Valise parfaite : rien ne manque, rien de trop.' : 'Une valise correcte, quelques kilos inutiles.');
    this.progress.emit({ live: s, time: 0 });
    setTimeout(() => this.done.emit(s), 2600);
  }
}

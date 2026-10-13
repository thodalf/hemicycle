import { Component, computed, inject, output } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { lifeSummary } from '../../engine/life';
import { RANKS } from '../../data/ranks';
import { DOMAIN_LABELS } from '../../models/game.models';

interface Year { age: number; items: { title: string; text: string; kind: string }[] }

/** Journal de bord : la frise d'une vie politique, exportable en « mémoires » */
@Component({
  selector: 'app-journal',
  template: `
    <div class="overlay" role="dialog" aria-modal="true" aria-label="Journal de bord" (click)="closed.emit()">
      <section class="book" (click)="$event.stopPropagation()">
        <header>
          <div>
            <span class="eyebrow">Journal de bord</span>
            <h2>{{ game.player().name }}</h2>
            <p class="muted">Né·e en {{ summary().born }} · {{ rank() }} · {{ age() }} ans</p>
          </div>
          <button class="btn small" (click)="closed.emit()" aria-label="Fermer">✕</button>
        </header>
        <ol class="years">
          @for (y of years(); track y.age) {
            <li>
              <span class="age mono">{{ y.age }} ans</span>
              <ul>
                @for (it of y.items; track $index) {
                  <li [class]="'k-' + it.kind"><strong>{{ it.title }}</strong><small>{{ it.text }}</small></li>
                }
              </ul>
            </li>
          } @empty {
            <li class="muted">Pas encore de chapitre : l’histoire commence.</li>
          }
        </ol>
        <div class="foot">
          <button class="btn primary" (click)="exportMemoirs()">📜 Exporter mes mémoires</button>
          <small class="muted">Un fichier texte (Markdown) à garder ou à partager.</small>
        </div>
      </section>
    </div>
  `,
  styles: `
    .overlay { position: fixed; inset: 0; z-index: 60; background: rgba(10, 14, 22, .55); display: grid; place-items: center; padding: 16px; }
    .book { width: min(640px, 100%); max-height: calc(100dvh - 32px); overflow: auto; background: var(--surface); border-radius: 14px; padding: 18px 20px;
      display: grid; gap: 12px; border: 1px solid var(--line); box-shadow: 0 24px 60px -20px rgba(0,0,0,.6); }
    header { display: flex; justify-content: space-between; align-items: start; gap: 12px; h2 { margin: 2px 0; font-size: 24px; } p { margin: 0; font-size: 13px; } }
    .years { list-style: none; margin: 0; padding: 0 0 0 10px; border-left: 2px solid var(--line); display: grid; gap: 12px; }
    .years > li { display: grid; gap: 4px; position: relative; padding-left: 12px; }
    .years > li::before { content: ''; position: absolute; left: -17px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: var(--accent); }
    .age { font-size: 12px; color: var(--ink-3); }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    ul li { display: grid; gap: 1px; font-size: 13px; padding-left: 8px; border-left: 3px solid var(--line); small { font-size: 12px; color: var(--ink-2); } }
    li.k-victoire { border-left-color: var(--good); } li.k-revers { border-left-color: var(--bad); } li.k-carriere { border-left-color: var(--accent); }
    .foot { display: grid; gap: 4px; justify-items: start; padding-top: 8px; border-top: 1px solid var(--line); small { font-size: 11.5px; } }
  `,
})
export class JournalComponent {
  protected readonly game = inject(GameStateService);
  readonly closed = output<void>();
  protected readonly summary = computed(() => lifeSummary(this.game.s()));
  protected readonly age = computed(() => Math.floor(this.game.player().age));
  protected readonly rank = computed(() => RANKS[this.game.player().rankId].label);
  protected readonly years = computed<Year[]>(() => {
    const map = new Map<number, Year>();
    for (const m of this.game.s().milestones) {
      const y = map.get(m.age) ?? { age: m.age, items: [] };
      y.items.push({ title: m.title, text: m.text, kind: m.kind });
      map.set(m.age, y);
    }
    return [...map.values()].sort((a, b) => a.age - b.age);
  });

  protected exportMemoirs(): void {
    const s = this.game.s();
    const p = s.player;
    const lines: string[] = [];
    lines.push(`# Mémoires de ${p.name}`, '');
    lines.push(`*Né·e en ${this.summary().born}. ${s.status === 'mort' ? `Disparu·e à ${Math.floor(p.age)} ans.` : `${Math.floor(p.age)} ans aujourd’hui.`}*`, '');
    lines.push(`**Dernière fonction :** ${RANKS[p.rankId].label} · **Parti :** ${s.party.name}`, '');
    lines.push('## Une vie en chapitres', '');
    for (const y of this.years()) {
      lines.push(`### ${y.age} ans`);
      for (const it of y.items) lines.push(`- **${it.title}** — ${it.text}`);
      lines.push('');
    }
    const f = s.family;
    if (f) {
      lines.push('## Famille', '');
      lines.push(f.partner ? `- ${f.partner.married ? 'Marié·e à' : 'En couple avec'} ${f.partner.name}` : '- Seul·e');
      for (const k of f.children) lines.push(`- ${k.name}`);
      lines.push('');
    }
    const prom = s.promises ?? [];
    if (prom.length) {
      lines.push('## Promesses', '');
      for (const x of prom) lines.push(`- « ${x.text} » (${DOMAIN_LABELS[x.domain].toLowerCase()}) : ${x.status === 'tenue' ? 'tenue' : x.status === 'trahie' ? 'trahie' : 'en cours'}`);
      lines.push('');
    }
    lines.push('## Le bilan', '');
    lines.push(`- Popularité ${Math.round(p.stats.popularity)}, influence ${Math.round(p.stats.influence)}, crédibilité ${Math.round(p.stats.credibility)}`);
    lines.push(`- Patrimoine : ${Math.round(p.finances.personal).toLocaleString('fr-FR')} €`);
    lines.push('', '*Écrit avec Hémicycle.*');
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const slug = p.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'hemicycle';
    a.download = `memoires-${slug}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
}

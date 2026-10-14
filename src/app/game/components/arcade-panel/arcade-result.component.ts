import { Component, computed, input, signal } from '@angular/core';
import { ArcadeResult } from '../../engine/arcade-save';
import { copyText, downloadBlob, shareImage, shareText } from '../../engine/arcade-share';

/** Résultat d'une partie de la salle de jeux : grille, toutes les réponses possibles, partage */
@Component({
  selector: 'app-arcade-result',
  template: `
    @if (result(); as r) {
      <div class="res">
        @if (r.kind === 'grille') {
          <p class="score"><strong class="mono">{{ r.found }}/9</strong> · {{ outcomeLabel() }}</p>
          <div class="grid">
            <span class="corner" aria-hidden="true">{{ r.icon }}</span>
            @for (c of r.cols; track $index) { <span class="crit">@if (c.badge) { <i class="lb" [style.background]="c.color">{{ c.badge }}</i> }{{ c.label }}</span> }
            @for (row of r.rows; track $index; let i = $index) {
              <span class="crit">@if (row.badge) { <i class="lb" [style.background]="row.color">{{ row.badge }}</i> }{{ row.label }}</span>
              @for (c of r.cols; track $index; let j = $index) {
                @let mine = r.cells[i * 3 + j];
                <div class="cell" [class.ok]="!!mine" [style.animation-delay.ms]="(i * 3 + j) * 70">
                  @if (mine) { <b>{{ mine }}</b> } @else { <b class="miss">—</b> }
                  <small>{{ r.answers[i * 3 + j].length }} réponse{{ r.answers[i * 3 + j].length > 1 ? 's' : '' }}</small>
                </div>
              }
            }
          </div>
          <details class="all" [open]="openAll()">
            <summary>Toutes les réponses possibles</summary>
            <ul>
              @for (row of r.rows; track $index; let i = $index) {
                @for (c of r.cols; track $index; let j = $index) {
                  <li><span class="muted">{{ row.badge ? 'Ligne ' + row.badge : row.label }} × {{ c.badge ? 'ligne ' + c.badge : c.label }}</span>
                    <span>@for (a of r.answers[i * 3 + j]; track a; let last = $last) { <span [class.mine]="a === r.cells[i * 3 + j]">{{ a }}</span>{{ last ? '' : ', ' }} }</span></li>
                }
              }
            </ul>
          </details>
        } @else {
          <p class="score"><strong class="mono">{{ r.found ? r.guesses.length : 'X' }}/6</strong> · le mot était <strong>{{ r.word }}</strong></p>
          @if (showBoard()) {
          <div class="board" [style.--n]="r.word.length">
            @for (g of r.guesses; track $index) {
              <div class="row">@for (m of g.marks; track $index; let k = $index) { <span class="tile" [class]="'tile ' + m">{{ g.text[k] }}</span> }</div>
            }
          </div>
          }
        }
        <div class="share" role="group" aria-label="Partager">
          <button type="button" class="btn small" (click)="copy()">📋 Copier pour les réseaux</button>
          <button type="button" class="btn small" (click)="image()">🖼️ Image à publier</button>
          @if (canShare) { <button type="button" class="btn small" (click)="nativeShare()">📤 Partager</button> }
        </div>
        @if (said()) { <p class="said" aria-live="polite">{{ said() }}</p> }
        <pre class="preview">{{ text() }}</pre>
      </div>
    }
  `,
  styles: `
    :host { display: block; width: 100%; }
    .res { display: grid; gap: 10px; }
    .score { margin: 0; text-align: center; font-size: 14px; strong.mono { font-size: 18px; } }
    .grid { display: grid; grid-template-columns: minmax(64px, .8fr) repeat(3, 1fr); gap: 4px; }
    .corner { display: grid; place-items: center; font-size: 20px; }
    .crit { display: grid; place-items: center; align-content: center; gap: 2px; text-align: center; padding: 4px; font-size: 10.5px; font-weight: 600; line-height: 1.2;
      background: var(--surface-2); border-radius: 6px; color: var(--ink-2); overflow-wrap: anywhere; }
    .lb { display: inline-grid; place-items: center; min-width: 20px; height: 20px; padding: 0 4px; border-radius: 999px; color: #fff; font: 700 11px var(--font-body); font-style: normal;
      text-shadow: 0 0 2px rgba(0,0,0,.6); }
    .cell { display: grid; place-content: center; justify-items: center; gap: 2px; padding: 6px 4px; min-height: 58px; border-radius: 8px; text-align: center;
      border: 2px solid var(--bad); background: var(--bad-soft); b { font-size: 12px; line-height: 1.15; overflow-wrap: anywhere; } small { font-size: 10px; color: var(--ink-3); } }
    .cell.ok { border-color: var(--good); background: var(--good-soft); }
    .cell { animation: cell-in .45s cubic-bezier(.2,.9,.3,1.3) both; }
    .tile { animation: cell-in .35s ease both; }
    .score { animation: cell-in .5s ease both; }
    @keyframes cell-in { from { transform: scale(.6) rotateX(70deg); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .cell, .tile, .score { animation: none; } }
    .miss { color: var(--bad); }
    .all { font-size: 12.5px; summary { cursor: pointer; font-weight: 600; } ul { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 5px; max-height: 260px; overflow: auto; }
      li { display: grid; gap: 1px; padding-bottom: 4px; border-bottom: 1px solid var(--line); } .mine { font-weight: 700; color: var(--good); } }
    .board { display: grid; gap: 4px; justify-content: center; }
    .row { display: grid; grid-template-columns: repeat(var(--n), 32px); gap: 4px; }
    .tile { display: grid; place-items: center; height: 32px; font: 700 15px var(--font-mono); color: #fff; border-radius: 4px; }
    .tile.ok { background: #d6453d; } .tile.mal { background: #e6b43c; border-radius: 50%; color: #1b2130; } .tile.non { background: #2f6cb0; }
    .share { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
    .said { margin: 0; text-align: center; font-size: 12.5px; font-weight: 600; color: var(--good); }
    .preview { margin: 0; padding: 8px 10px; border-radius: 8px; background: var(--surface-2); font: 12px/1.35 var(--font-mono); white-space: pre-wrap; text-align: center; }
  `,
})
export class ArcadeResultComponent {
  readonly result = input.required<ArcadeResult | null>();
  readonly openAll = input(false);
  /** Masquer la grille (déjà affichée par le jeu) */
  readonly showBoard = input(true);
  protected readonly said = signal('');
  protected readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  protected readonly text = computed(() => { const r = this.result(); return r ? shareText(r) : ''; });
  protected readonly outcomeLabel = computed(() => {
    const r = this.result();
    if (!r || r.kind !== 'grille') return '';
    return r.outcome === 'complete' ? (r.mistakes ? `grille complète, ${r.mistakes} erreur${r.mistakes > 1 ? 's' : ''}` : 'grille complète sans faute !') : r.outcome === 'perdu' ? 'plus d’essais' : 'grille rendue';
  });

  protected async copy(): Promise<void> {
    this.said.set((await copyText(this.text())) ? 'Copié ! Collez-le où vous voulez.' : 'Copie impossible ici : sélectionnez le texte ci-dessous.');
  }

  protected async image(): Promise<void> {
    const r = this.result();
    if (!r) return;
    const blob = await shareImage(r);
    if (!blob) { this.said.set('Image impossible dans ce navigateur.'); return; }
    try { await downloadBlob(blob, `hemicycle-${r.id}-${r.day}.png`); this.said.set('Image enregistrée.'); } catch { this.said.set('Enregistrement annulé.'); }
  }

  protected async nativeShare(): Promise<void> {
    const r = this.result();
    if (!r) return;
    try {
      const blob = await shareImage(r);
      const file = blob ? new File([blob], `hemicycle-${r.id}.png`, { type: 'image/png' }) : null;
      const data: ShareData = file && navigator.canShare?.({ files: [file] }) ? { text: this.text(), files: [file] } : { text: this.text() };
      await navigator.share(data);
    } catch { /* partage annulé */ }
  }
}

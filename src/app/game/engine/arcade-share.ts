import { ArcadeResult } from './arcade-save';

/* ============================================================
 *  Partager sa partie du jour : un texte à coller (façon Wordle,
 *  sans divulgacher les réponses) et une image carrée pour les
 *  réseaux sociaux.
 * ============================================================ */

const frDate = (day: string) => day.split('-').reverse().join('/');

/** Le site du jeu, ajouté à chaque partage */
export const SHARE_URL = 'https://hemicycle.linereve.com/';

export function shareText(r: ArcadeResult): string {
  if (r.kind === 'grille') {
    const lines = [0, 1, 2].map(i => [0, 1, 2].map(j => (r.cells[i * 3 + j] ? '🟩' : '🟥')).join(''));
    const tail = r.outcome === 'complete' ? (r.mistakes ? `${r.mistakes} erreur${r.mistakes > 1 ? 's' : ''}` : 'sans faute !') : r.outcome === 'perdu' ? 'plus d’essais' : 'grille rendue';
    return [`${r.icon} Hémicycle · ${r.title} du ${frDate(r.day)}`, `${r.found}/9 · ${tail}${r.points !== undefined ? ` · ⭐ ${r.points} pts` : ''}`, ...lines, '', `Jouez aussi : ${SHARE_URL}`].join('\n');
  }
  const em = { ok: '🟥', mal: '🟨', non: '🟦' } as const;
  return [`${r.icon} Hémicycle · ${r.title} du ${frDate(r.day)}`, `${r.found ? r.guesses.length : 'X'}/6 · ${r.word.length} lettres`, ...r.guesses.map(g => g.marks.map(m => em[m]).join('')), '', `Jouez aussi : ${SHARE_URL}`].join('\n');
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Une image 1080 × 1080, sans réponse dévoilée */
export async function shareImage(r: ArcadeResult): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const S = 1080;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const c = cv.getContext('2d');
  if (!c) return null;
  const g = c.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, '#1f3a5f'); g.addColorStop(1, '#14253d');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  c.fillStyle = '#ffffff'; c.textAlign = 'center';
  c.font = '700 64px Georgia, serif';
  c.fillText(`${r.title}`, S / 2, 140);
  c.font = '500 34px system-ui, sans-serif'; c.fillStyle = '#c9d6ea';
  c.fillText(`Partie du ${frDate(r.day)}`, S / 2, 195);

  if (r.kind === 'grille') {
    const size = 190, gap = 26, x0 = (S - (size * 3 + gap * 2)) / 2, y0 = 270;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const ok = !!r.cells[i * 3 + j];
      roundRect(c, x0 + j * (size + gap), y0 + i * (size + gap), size, size, 26);
      c.fillStyle = ok ? '#2f9e5b' : '#b8402b'; c.fill();
      c.fillStyle = 'rgba(255,255,255,.92)'; c.font = '700 84px system-ui, sans-serif';
      const pt = r.pts?.[i * 3 + j];
      c.fillText(ok ? '✓' : '✗', x0 + j * (size + gap) + size / 2, y0 + i * (size + gap) + size / 2 + (pt ? 10 : 30));
      if (ok && pt) { c.font = '700 34px system-ui, sans-serif'; c.fillText(`+${pt}`, x0 + j * (size + gap) + size / 2, y0 + i * (size + gap) + size - 28); }
    }
    c.fillStyle = '#ffffff'; c.font = '700 60px system-ui, sans-serif';
    c.fillText(r.points !== undefined ? `${r.found}/9 · ⭐ ${r.points} pts` : `${r.found}/9`, S / 2, 975);
    c.font = '500 30px system-ui, sans-serif'; c.fillStyle = '#c9d6ea';
    c.fillText(r.outcome === 'complete' ? (r.mistakes ? `${r.mistakes} erreur${r.mistakes > 1 ? 's' : ''} sur ${r.maxMistakes}` : 'Sans faute !') : r.outcome === 'perdu' ? 'Plus d’essais' : 'Grille rendue', S / 2, 1020);
  } else {
    const n = r.word.length, rows = 6;
    const size = Math.min(110, Math.floor(860 / n) - 10), gap = 10;
    const x0 = (S - (size * n + gap * (n - 1))) / 2, y0 = 250;
    const col = { ok: '#d6453d', mal: '#e6b43c', non: '#2f6cb0' } as const;
    for (let i = 0; i < rows; i++) for (let j = 0; j < n; j++) {
      const m = r.guesses[i]?.marks[j];
      roundRect(c, x0 + j * (size + gap), y0 + i * (size + gap), size, size, m === 'ok' ? 12 : size / 2.4);
      c.fillStyle = m ? col[m] : 'rgba(255,255,255,.12)'; c.fill();
    }
    c.fillStyle = '#ffffff'; c.font = '700 60px system-ui, sans-serif';
    c.fillText(`${r.found ? r.guesses.length : 'X'}/6`, S / 2, 975);
    c.font = '500 30px system-ui, sans-serif'; c.fillStyle = '#c9d6ea';
    c.fillText(r.found ? `Trouvé en ${r.guesses.length} essai${r.guesses.length > 1 ? 's' : ''}` : 'Pas trouvé cette fois', S / 2, 1020);
  }
  c.font = '600 26px system-ui, sans-serif'; c.fillStyle = 'rgba(255,255,255,.7)';
  c.fillText('hemicycle.linereve.com', S / 2, 1068);
  return new Promise(res => cv.toBlob(b => res(b), 'image/png'));
}

interface Downloads { save(o: { filename: string; data: string | Blob }): Promise<unknown> }

/** Télécharger un fichier (par la plateforme dans la page publiée, sinon par un lien) */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const rt = (globalThis as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
  const downloads = rt ? await rt.use('downloads').catch(() => null) as Downloads | null : null;
  if (downloads) { await downloads.save({ filename, data: blob }); return; }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Copier un texte dans le presse-papiers (avec repli) */
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* repli */ }
  try {
    const t = Object.assign(document.createElement('textarea'), { value: text });
    t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.append(t); t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  } catch { return false; }
}

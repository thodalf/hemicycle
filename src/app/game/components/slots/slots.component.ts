import { Component, computed, effect, inject, output, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { GameStateService } from '../../services/game-state.service';
import { SLOTS, SlotMeta } from '../../services/save-store';
import { GameState } from '../../models/game.models';

interface ExportFile {
  format: 'hemicycle-save';
  version: 1;
  exportedAt: string;
  state: GameState;
}

interface Downloads { save(o: { filename: string; data: string | Blob }): Promise<unknown> }

/** Menu des parties : trois emplacements, reprise, export, import, suppression */
@Component({
  selector: 'app-slots',
  template: `
    <main class="wrap">
      <header class="head">
        <div>
          <div class="eyebrow">Hémicycle · mes parties</div>
          <h1>Bonjour, {{ auth.account()?.name }}</h1>
          <span class="where" [class]="'k-' + auth.account()?.kind">{{ storageLabel() }}</span>
        </div>
        <button class="btn small" (click)="logout()">{{ auth.account()?.kind === 'guest' ? 'Se connecter' : 'Changer de compte' }}</button>
      </header>

      @if (loading()) {
        <p class="muted">Chargement des sauvegardes…</p>
      }
      @if (message()) { <p class="msg" [class.bad]="messageBad()" role="status">{{ message() }}</p> }

      <ul class="slots">
        @for (n of slots; track n) {
          @let m = meta(n);
          <li class="slot card" [class.empty]="!m" [style.--c]="m?.partyColor ?? 'var(--line)'">
            <div class="num">{{ n }}</div>
            @if (m) {
              <div class="info">
                <strong>{{ m.name }}</strong>
                <span>{{ m.rank }} · {{ m.party }}</span>
                <span class="muted">{{ m.scenario }} · semaine {{ m.week }} · {{ ago(m.updatedAt) }}
                  @if (m.status !== 'en_cours') { · <b>{{ m.status === 'victoire' ? 'Victoire' : 'Terminée' }}</b> }</span>
              </div>
              <div class="cta">
                <button class="btn primary small" (click)="resume(n)">{{ m.status === 'en_cours' ? 'Continuer' : 'Revoir' }}</button>
                <button class="btn small" (click)="exportSlot(n)">Exporter</button>
                <button class="btn small" (click)="pickImport(n)">Importer ici</button>
                <button class="btn small danger" (click)="remove(n)">{{ confirmDelete() === n ? 'Confirmer la suppression' : 'Supprimer' }}</button>
              </div>
            } @else {
              <div class="info"><strong>Emplacement libre</strong><span class="muted">Une nouvelle carrière vous attend.</span></div>
              <div class="cta">
                <button class="btn primary small" (click)="create(n)">Nouvelle partie</button>
                <button class="btn small" (click)="pickImport(n)">Importer une sauvegarde</button>
              </div>
            }
          </li>
        }
      </ul>
      @if (found().length) {
        <section class="found card">
          <div class="eyebrow">Parties trouvées dans ce navigateur</div>
          <p class="muted small">Elles ne sont pas encore dans ce compte. Copiez-les dans un emplacement libre pour les retrouver ici.</p>
          <ul>
            @for (f of found(); track f.key) {
              <li>
                <span class="sw" [style.background]="f.meta.partyColor"></span>
                <span class="fi"><strong>{{ f.meta.name }}</strong> · {{ f.meta.rank }} · {{ f.meta.scenario }} · semaine {{ f.meta.week }}
                  <small class="muted">{{ f.origin }}</small></span>
                @if (freeSlot(); as n) {
                  <button class="btn small primary" (click)="recover(f.key, n)">Récupérer dans l’emplacement {{ n }}</button>
                } @else {
                  <small class="muted">Libérez un emplacement pour la récupérer</small>
                }
              </li>
            }
          </ul>
        </section>
      }
      <input #file type="file" accept="application/json,.json" hidden (change)="importFile($event)" />
    </main>
  `,
  styles: `
    .wrap { max-width: 640px; margin: 0 auto; padding: 48px 16px; display: grid; gap: 16px; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
    h1 { font-size: 34px; margin: 4px 0; }
    .where { font-size: 12.5px; padding: 3px 9px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--line); }
    .where.k-cloud { background: var(--good-soft); color: var(--good); border-color: transparent; }
    .slots { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .slot { display: grid; grid-template-columns: 44px 1fr; gap: 6px 14px; align-items: center; border-left: 5px solid var(--c);
      animation: rise .4s ease both; }
    .slot:nth-child(2) { animation-delay: .06s; } .slot:nth-child(3) { animation-delay: .12s; }
    .slot.empty { border-left-style: dashed; }
    .num { grid-row: span 2; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 10px; background: var(--surface-2);
      font: 700 20px var(--font-display); color: var(--ink-2); }
    .info { display: grid; gap: 2px; font-size: 13.5px; strong { font-family: var(--font-display); font-size: 18px; } .muted { font-size: 12.5px; } }
    .cta { display: flex; flex-wrap: wrap; gap: 6px; }
    .danger { color: var(--bad); }
    .found { display: grid; gap: 8px; border-left: 4px solid var(--warn); animation: rise .4s ease both;
      ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
      li { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 13.5px; }
      .fi { flex: 1; display: grid; min-width: 180px; } .small { margin: 0; font-size: 12.5px; } }
    .sw { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
    .msg { margin: 0; padding: 8px 12px; border-radius: 8px; background: var(--good-soft); font-size: 13px; }
    .msg.bad { background: var(--bad-soft); }
    @keyframes rise { from { opacity: 0; transform: translateY(10px); } }
  `,
})
export class SlotsComponent {
  protected readonly auth = inject(AuthService);
  private readonly game = inject(GameStateService);
  readonly create$ = output<number>({ alias: 'create' });

  protected readonly slots = SLOTS;
  protected readonly metas = signal<SlotMeta[]>([]);
  protected readonly loading = signal(true);
  protected readonly message = signal('');
  protected readonly messageBad = signal(false);
  protected readonly confirmDelete = signal<number | null>(null);
  protected readonly found = signal<ReturnType<AuthService['deviceSaves']>>([]);
  protected readonly freeSlot = computed(() => SLOTS.find(n => !this.metas().some(m => m.slot === n)) ?? null);
  private importTarget = 1;

  private readonly reload = effect(() => {
    const store = this.auth.store();
    if (!store) return;
    // Après un rechargement de la page, on rouvre directement la partie en cours
    const resume = this.game.resumeSlot();
    if (resume) void this.game.open(resume).then(ok => { if (!ok) void this.refresh(); });
    else void this.refresh();
  });

  protected storageLabel(): string {
    switch (this.auth.account()?.kind) {
      case 'cloud': return 'Sauvegarde en ligne · compte Claude';
      case 'local': return 'Compte local · ce navigateur';
      default: return 'Invité·e · ce navigateur uniquement';
    }
  }

  protected meta(n: number): SlotMeta | undefined {
    return this.metas().find(m => m.slot === n);
  }

  protected ago(t: number): string {
    const min = Math.round((Date.now() - t) / 60000);
    if (min < 1) return 'à l’instant';
    if (min < 60) return `il y a ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `il y a ${h} h`;
    return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  private async refresh(): Promise<void> {
    const store = this.auth.store();
    if (!store) return;
    this.loading.set(true);
    try { this.metas.set(await store.list()); } catch { this.say('Impossible de lire vos sauvegardes pour le moment.', true); }
    this.found.set(this.auth.deviceSaves());
    this.loading.set(false);
  }

  private say(text: string, bad = false): void {
    this.message.set(text);
    this.messageBad.set(bad);
  }

  protected async resume(n: number): Promise<void> {
    if (!(await this.game.open(n))) this.say('Cette sauvegarde est illisible.', true);
  }

  protected create(n: number): void {
    this.game.useSlot(n);
    this.create$.emit(n);
  }

  protected async remove(n: number): Promise<void> {
    if (this.confirmDelete() !== n) { this.confirmDelete.set(n); return; }
    this.confirmDelete.set(null);
    await this.auth.store()?.remove(n);
    this.say(`Emplacement ${n} supprimé.`);
    await this.refresh();
  }

  protected async exportSlot(n: number): Promise<void> {
    const state = await this.auth.store()?.load(n);
    if (!state) return;
    const file: ExportFile = { format: 'hemicycle-save', version: 1, exportedAt: new Date().toISOString(), state };
    const data = JSON.stringify(file);
    const filename = `hemicycle-${state.player.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-semaine-${state.week}.json`;
    // Dans la page publiée, le téléchargement passe par la plateforme ; ailleurs, par un lien
    const rt = (globalThis as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
    const downloads = rt ? await rt.use('downloads') as Downloads | null : null;
    try {
      if (downloads) await downloads.save({ filename, data: new Blob([data], { type: 'application/json' }) });
      else {
        const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: filename });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
      this.say(`Sauvegarde exportée : ${filename}`);
    } catch {
      this.say('Export annulé.', true);
    }
  }

  protected pickImport(n: number): void {
    this.importTarget = n;
    (document.querySelector('app-slots input[type=file]') as HTMLInputElement | null)?.click();
  }

  protected async importFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text()) as ExportFile | GameState;
      const state = 'format' in parsed && parsed.format === 'hemicycle-save' ? parsed.state : parsed as GameState;
      if (state?.version !== 1 || !state.player || !state.party) throw new Error('format');
      await this.auth.store()?.save(this.importTarget, state);
      this.say(`Partie de ${state.player.name} importée dans l’emplacement ${this.importTarget}.`);
      await this.refresh();
    } catch {
      this.say('Ce fichier n’est pas une sauvegarde Hémicycle valide.', true);
    }
  }

  protected async recover(key: string, n: number): Promise<void> {
    if (await this.auth.recover(key, n)) this.say(`Partie récupérée dans l’emplacement ${n}.`);
    else this.say('Cette partie est illisible.', true);
    await this.refresh();
    // Une partie récupérée n'est plus proposée si elle est identique à un emplacement
    this.found.update(list => list.filter(f => f.key !== key));
  }

  protected logout(): void {
    this.auth.logout();
  }
}

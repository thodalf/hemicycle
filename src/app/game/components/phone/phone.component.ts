import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { PhoneService } from '../../services/phone.service';
import { EXTRA_CALL_ENERGY, PhoneEntry } from '../../engine/phone';
import { PhoneMessage } from '../../models/game.models';

const GROUPS: { kind: PhoneEntry['kind']; label: string }[] = [
  { kind: 'equipe', label: 'Équipe' },
  { kind: 'chef', label: 'Parti' },
  { kind: 'collegue', label: 'Collègues' },
  { kind: 'contact', label: 'Réseau' },
  { kind: 'proche', label: 'Proches' },
];

/** Le téléphone : SMS, appels, répertoire */
@Component({
  selector: 'app-phone',
  template: `
    @if (phone.open()) {
      <div class="phone-wrap" role="dialog" aria-modal="true" aria-label="Téléphone" (click)="phone.close()">
        <div class="device" (click)="$event.stopPropagation()">
          <div class="statusbar"><span class="mono">{{ game.date() }}</span><span class="notch" aria-hidden="true"></span><span>📶 🔋</span></div>

          @if (thread(); as t) {
            <header class="th-head">
              <button type="button" class="back" (click)="phone.thread.set(null); calling.set(false)" aria-label="Retour">‹</button>
              <span class="avatar" aria-hidden="true">{{ t.icon }}</span>
              <div class="who"><strong>{{ t.name }}</strong><small>{{ t.role }}{{ t.bond !== undefined ? ' · relation ' + (t.bond > 0 ? '+' : '') + t.bond : '' }}</small></div>
              @if (t.callable) { <button type="button" class="call-btn" (click)="calling.set(!calling())" aria-label="Appeler">📞</button> }
            </header>
            <div class="bubbles" role="log" #log>
              @for (m of chrono(); track m.id) {
                <div class="bubble" [class.out]="m.outgoing" [class.call]="m.kind === 'appel'">
                  <p>{{ m.kind === 'appel' && !m.outgoing ? '📞 ' : '' }}{{ m.text }}</p>
                  @if (m.summary?.length) { <div class="chips">@for (x of m.summary; track $index) { <span>{{ x }}</span> }</div> }
                  <small class="mono">{{ game.month(m.week) }}{{ m.answered && !m.outgoing ? ' · ' + (m.answered === 'Sans réponse' ? 'sans réponse' : 'répondu') : '' }}</small>
                </div>
              } @empty { <p class="empty">Aucun message. Un coup de fil ?</p> }
            </div>
            @if (pending(); as m) {
              <div class="replies">
                @for (r of m.replies; track r.id) { <button type="button" class="reply" (click)="phone.reply(m.id, r.id)">{{ r.label }}</button> }
              </div>
            }
            @if (calling() && t.callable) {
              <div class="call-sheet">
                <div class="cs-head"><strong>Appeler {{ t.name }}</strong><small class="muted">{{ callInfo() }}</small></div>
                @for (o of options(); track o.id) {
                  <button type="button" class="opt" [disabled]="!o.ok" (click)="phone.call(t.key, o.id); calling.set(false)">
                    <strong>{{ o.label }}</strong><small>{{ o.ok ? o.hint : o.reason }}</small>
                  </button>
                }
              </div>
            }
          } @else {
            <nav class="tabs" role="tablist">
              <button type="button" role="tab" [class.on]="phone.tab() === 'messages'" (click)="phone.tab.set('messages')">Messages @if (phone.unread()) { <b class="badge">{{ phone.unread() }}</b> }</button>
              <button type="button" role="tab" [class.on]="phone.tab() === 'repertoire'" (click)="phone.tab.set('repertoire')">Répertoire</button>
              <button type="button" class="x" (click)="phone.close()" aria-label="Fermer le téléphone">✕</button>
            </nav>
            <p class="calls mono">{{ callInfo() }}</p>
            @if (phone.tab() === 'messages') {
              <ul class="threads">
                @for (th of threads(); track th.who) {
                  <li><button type="button" (click)="phone.openThread(th.who)">
                    <span class="avatar" aria-hidden="true">{{ th.icon }}</span>
                    <span class="t-txt"><strong>{{ th.name }}</strong><small>{{ th.last }}</small></span>
                    <span class="t-meta"><small class="mono">{{ game.month(th.week) }}</small>@if (th.unread) { <b class="badge">{{ th.unread }}</b> } @else if (th.waiting) { <b class="dot" title="En attente de réponse"></b> }</span>
                  </button></li>
                } @empty { <li class="empty">Pas encore de messages. Ils arrivent au fil des mois.</li> }
              </ul>
            } @else {
              <div class="dir">
                @for (g of groups(); track g.label) {
                  <h3>{{ g.label }}</h3>
                  <ul class="threads">
                    @for (e of g.entries; track e.key) {
                      <li><button type="button" (click)="phone.openThread(e.key); calling.set(true)">
                        <span class="avatar" aria-hidden="true">{{ e.icon }}</span>
                        <span class="t-txt"><strong>{{ e.name }}</strong><small>{{ e.role }}{{ e.bond !== undefined ? ' · ' + (e.bond > 0 ? '+' : '') + e.bond : '' }}</small></span>
                        <span class="t-meta">📞</span>
                      </button></li>
                    }
                  </ul>
                }
              </div>
            }
          }
          <button type="button" class="home" (click)="phone.close()" aria-label="Fermer le téléphone"></button>
        </div>
      </div>
    }
  `,
  styles: `
    .phone-wrap { position: fixed; inset: 0; z-index: 320; background: rgba(15,18,28,.45); display: grid; place-items: center; padding: 16px; animation: fade .2s ease; }
    @keyframes fade { from { opacity: 0; } }
    .device { position: relative; width: min(380px, 100%); height: min(720px, calc(100dvh - 32px)); background: var(--surface); border-radius: 36px;
      border: 10px solid #1b1f2a; box-shadow: 0 24px 60px rgba(0,0,0,.4); display: flex; flex-direction: column; overflow: hidden; animation: rise .3s cubic-bezier(.2,.9,.3,1.2); }
    @keyframes rise { from { transform: translateY(30px) scale(.97); opacity: 0; } }
    .statusbar { display: flex; justify-content: space-between; align-items: center; padding: 8px 18px 4px; font-size: 11.5px; color: var(--ink-2); }
    .notch { width: 90px; height: 20px; border-radius: 0 0 12px 12px; background: #1b1f2a; margin-top: -8px; }
    .tabs { display: flex; gap: 4px; padding: 6px 12px; border-bottom: 1px solid var(--line);
      button { flex: 1; border: 0; background: none; padding: 8px; border-radius: 10px; font: 600 13.5px var(--font-body); color: var(--ink-2); cursor: pointer; }
      button.on { background: var(--accent-soft); color: var(--accent); }
      button.x { flex: none; width: 36px; color: var(--ink-3); } }
    .badge { display: inline-grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--bad); color: #fff; font-size: 11px; margin-left: 4px; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--warn); display: inline-block; }
    .calls { margin: 6px 14px 0; font-size: 11px; color: var(--ink-3); }
    .threads { list-style: none; margin: 0; padding: 4px 8px; display: grid;
      button { width: 100%; display: grid; grid-template-columns: 40px 1fr auto; gap: 10px; align-items: center; padding: 9px 6px; border: 0; background: none;
        border-bottom: 1px solid var(--line); text-align: left; cursor: pointer; color: var(--ink); font: inherit; }
      button:hover { background: var(--surface-2); } }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--surface-2); display: grid; place-items: center; font-size: 20px; }
    .t-txt { display: grid; min-width: 0; strong { font-size: 14px; } small { font-size: 12px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } }
    .t-meta { display: grid; justify-items: end; gap: 3px; small { font-size: 10.5px; color: var(--ink-3); } }
    .dir { overflow-y: auto; flex: 1; h3 { margin: 10px 14px 0; font: 600 11px var(--font-body); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); } }
    .tabs ~ .threads, .tabs ~ .calls ~ .threads { overflow-y: auto; flex: 1; }
    .th-head { display: grid; grid-template-columns: auto 40px 1fr auto; gap: 8px; align-items: center; padding: 6px 10px 8px; border-bottom: 1px solid var(--line);
      .who { display: grid; min-width: 0; small { font-size: 11.5px; color: var(--ink-3); } } }
    .back { border: 0; background: none; font-size: 28px; line-height: 1; color: var(--accent); cursor: pointer; padding: 0 4px; }
    .call-btn { border: 0; width: 38px; height: 38px; border-radius: 50%; background: var(--good); color: #fff; font-size: 17px; cursor: pointer; }
    .bubbles { flex: 1; overflow-y: auto; display: flex; flex-direction: column; justify-content: flex-start; gap: 8px; padding: 12px; }
    .bubble { max-width: 82%; align-self: flex-start; background: var(--surface-2); border: 1px solid var(--line); border-radius: 16px 16px 16px 4px; padding: 8px 11px;
      p { margin: 0; font-size: 13.5px; line-height: 1.35; } small { display: block; margin-top: 3px; font-size: 10px; color: var(--ink-3); } }
    .bubble.out { align-self: flex-end; background: var(--accent); color: #fff; border-color: transparent; border-radius: 16px 16px 4px 16px; small { color: rgba(255,255,255,.7); } }
    .bubble.call:not(.out) { border-left: 3px solid var(--good); }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; span { font-size: 10.5px; padding: 1px 6px; border-radius: 8px; background: var(--accent-soft); color: var(--accent); } }
    .empty { text-align: center; color: var(--ink-3); font-size: 13px; padding: 30px 10px; list-style: none; }
    .replies { display: grid; gap: 6px; padding: 8px 12px; border-top: 1px solid var(--line); }
    .reply { border: 1px solid var(--accent); background: var(--surface); color: var(--accent); border-radius: 18px; padding: 8px 12px; font: 600 13px var(--font-body); cursor: pointer; text-align: left; }
    .reply:hover { background: var(--accent-soft); }
    .call-sheet { display: grid; gap: 6px; padding: 10px 12px 12px; border-top: 1px solid var(--line); background: var(--surface-2); animation: rise .2s ease;
      .cs-head { display: grid; small { font-size: 11px; } } }
    .opt { display: grid; gap: 2px; text-align: left; padding: 9px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); cursor: pointer; color: var(--ink); font: inherit;
      strong { font-size: 13px; } small { font-size: 11.5px; color: var(--ink-3); } }
    .opt:hover:not(:disabled) { border-color: var(--good); }
    .opt:disabled { opacity: .55; cursor: not-allowed; }
    .home { align-self: center; width: 110px; height: 5px; border-radius: 3px; border: 0; background: var(--ink-3); margin: 8px 0 10px; cursor: pointer; flex: none; }
    @media (max-width: 520px) { .phone-wrap { padding: 0; } .device { width: 100%; height: 100dvh; border-radius: 0; border: 0; } }
    @media (prefers-reduced-motion: reduce) { .phone-wrap, .device, .call-sheet { animation: none; } }
  `,
})
export class PhoneComponent {
  protected readonly game = inject(GameStateService);
  protected readonly phone = inject(PhoneService);
  protected readonly calling = signal(false);

  private readonly all = computed<PhoneMessage[]>(() => this.game.s().phone?.messages ?? []);

  protected readonly threads = computed(() => {
    const dir = new Map(this.phone.directory().map(e => [e.key, e]));
    const out = new Map<string, { who: string; name: string; icon: string; last: string; week: number; unread: number; waiting: boolean }>();
    for (const m of this.all()) {
      const t = out.get(m.who) ?? { who: m.who, name: dir.get(m.who)?.name ?? m.from, icon: dir.get(m.who)?.icon ?? '💬', last: m.text, week: m.week, unread: 0, waiting: false };
      if (!m.outgoing && !m.read) t.unread++;
      if (!m.outgoing && m.replies && !m.answered) t.waiting = true;
      out.set(m.who, t);
    }
    return [...out.values()];
  });

  protected readonly thread = computed(() => {
    const key = this.phone.thread();
    if (!key) return null;
    const e = this.phone.directory().find(x => x.key === key);
    const m = this.all().find(x => x.who === key);
    return { key, name: e?.name ?? m?.from ?? '?', role: e?.role ?? m?.role ?? '', icon: e?.icon ?? '💬', bond: e?.bond, callable: !!e };
  });

  protected readonly messages = computed(() => this.all().filter(m => m.who === this.phone.thread()));
  /** Conversation dans l'ordre chronologique, groupée en haut de l'écran */
  protected readonly chrono = computed(() => [...this.messages()].reverse());
  private readonly log = viewChild<ElementRef<HTMLElement>>('log');

  constructor() {
    // On garde le dernier message en vue quand la conversation déborde
    effect(() => {
      this.chrono();
      const el = this.log()?.nativeElement;
      if (el) setTimeout(() => (el.scrollTop = el.scrollHeight), 0);
    });
  }
  /** Le dernier SMS reçu qui attend une réponse */
  protected readonly pending = computed(() => this.messages().find(m => !m.outgoing && m.replies?.length && !m.answered) ?? null);
  protected readonly options = computed(() => { this.game.s(); const k = this.phone.thread(); return k ? this.phone.options(k) : []; });

  protected readonly groups = computed(() => GROUPS.map(g => ({ label: g.label, entries: this.phone.directory().filter(e => e.kind === g.kind) })).filter(g => g.entries.length));

  protected callInfo(): string {
    const c = this.phone.calls();
    return c.free ? `Appels ce mois : ${c.used} / ${c.max} · encore ${c.free} sans fatigue` : `Forfait épuisé : chaque appel coûte ${EXTRA_CALL_ENERGY} d’énergie`;
  }
}

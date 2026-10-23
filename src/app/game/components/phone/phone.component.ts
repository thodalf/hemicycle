import { FxService } from '../../services/fx.service';
import { TraitsComponent } from '../traits/traits.component';
import { MILESTONES, PostResult, fmtFollowers } from '../../engine/social';
import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';
import { PhoneService } from '../../services/phone.service';
import { EXTRA_CALL_ENERGY, PhoneEntry } from '../../engine/phone';
import { QUICK_SMS, REACTIONS } from '../../engine/phone-extra';
import { positionsList } from '../../engine/phone-dialogues';
import { PhoneMessage } from '../../models/game.models';

const GROUPS: { kind: PhoneEntry['kind']; label: string }[] = [
  { kind: 'equipe', label: 'Équipe' },
  { kind: 'chef', label: 'Parti' },
  { kind: 'scenario', label: 'Numéros spéciaux' },
  { kind: 'gouvernement', label: 'Gouvernement' },
  { kind: 'collegue', label: 'Collègues' },
  { kind: 'personnalite', label: 'Personnalités' },
  { kind: 'contact', label: 'Réseau' },
  { kind: 'proche', label: 'Proches' },
];

/** Le téléphone : SMS, appels, répertoire */
@Component({
  selector: 'app-phone',
  imports: [TraitsComponent],
  template: `
    @if (phone.open()) {
      <div class="phone-wrap" role="dialog" aria-modal="true" aria-label="Téléphone" (click)="phone.close()">
        <div class="device" (click)="$event.stopPropagation()">
          <div class="statusbar"><span class="mono">{{ game.date() }}</span><span class="notch" aria-hidden="true"></span><span>📶 🔋</span></div>

          @if (thread(); as t) {
            <header class="th-head">
              <button type="button" class="back" (click)="phone.thread.set(null); calling.set(false)" aria-label="Retour">‹</button>
              <span class="avatar" aria-hidden="true">{{ t.icon }}</span>
              <div class="who"><strong>{{ t.name }}@if (phone.romance()?.key === t.key) { <span class="heart" title="Une histoire en cours"> 💗</span> }</strong><small>{{ t.role || roleOf(t.key) }}{{ t.bond !== undefined ? ' · relation ' + (t.bond > 0 ? '+' : '') + t.bond : '' }}</small>@if (persona(t.key, t.name); as ps) { @if (ps.length) { <app-traits class="persona" [ids]="ps" [compact]="true" /> } }</div>
              @if (t.callable) { <button type="button" class="call-btn" (click)="calling.set(!calling())" aria-label="Appeler">📞</button> }
            </header>
            <div class="bubbles" role="log" #log>
              @for (m of chrono(); track m.id) {
                <div class="bubble" [class.out]="m.outgoing" [class.call]="m.kind === 'appel'">
                  <p>{{ m.kind === 'appel' && !m.outgoing ? '📞 ' : '' }}{{ m.text }}</p>
                  @if (m.summary?.length) { <div class="chips">@for (x of m.summary; track $index) { <span>{{ x }}</span> }</div> }
                  <small class="mono">{{ game.month(m.week) }}{{ m.answered && !m.outgoing ? ' · ' + (m.answered === 'Sans réponse' ? 'sans réponse' : 'répondu') : '' }}</small>
                  @if (m.reaction) { <span class="react-on" aria-label="Votre réaction">{{ m.reaction }}</span> }
                  @else if (!m.outgoing && m.id === lastIncoming()) {
                    <span class="react-bar" role="group" aria-label="Réagir">@for (r of reactions; track r) { <button type="button" (click)="phone.react(m.id, r)">{{ r }}</button> }</span>
                  }
                </div>
              } @empty { <p class="empty">{{ t.callable ? 'Aucun message. Un coup de fil ?' : 'Vous n’avez pas encore son numéro. Demandez-le au chef du parti, à un·e collègue ou à un·e journaliste.' }}</p> }
            </div>
            @if (pending(); as m) {
              <div class="replies">
                @if (m.qcm?.kind === 'position') { <p class="qcm-head">❓ <b>Question à choix multiple</b> · votre réponse sera publiée et retenue : changer d’avis plus tard vous coûtera cher.</p> }
                @else if (m.qcm?.kind === 'colle') { <p class="qcm-head">🎯 <b>Colle</b> · une seule bonne réponse{{ m.qcm?.asker === 'tv' ? ', et la caméra tourne' : '' }}.</p> }
                @else if (m.dlg) { <p class="qcm-head">💬 <b>Votre réponse compte</b> · on s’en souviendra.</p> }
                @for (r of m.replies; track r.id) { <button type="button" class="reply" [class.qcm]="!!m.qcm" (click)="phone.reply(m.id, r.id)"><span>{{ r.label }}</span>@if (r.hint) { <small>{{ r.hint }}</small> }</button> }
              </div>
            }
            @if (!pending() && !calling() && t.callable) {
              @if (phone.canSms(t.key)) {
                <div class="quick" role="group" aria-label="SMS rapides">
                  @for (q of quick; track q.id) { <button type="button" (click)="phone.sms(t.key, q.id)">{{ q.label }}</button> }
                </div>
              } @else { <p class="sent muted">SMS envoyé ce mois-ci. Pour plus, appelez.</p> }
            }
            @if (calling() && t.callable) {
              <div class="call-sheet">
                <div class="cs-head"><strong>Appeler {{ t.name }}</strong><small class="muted">{{ callInfo() }}</small></div>
                @for (o of options(); track o.id) {
                  @if (!o.group) {
                    <button type="button" class="opt" [disabled]="!o.ok" (click)="phone.call(t.key, o.id); calling.set(false)">
                      <strong>{{ o.label }}</strong><small>{{ o.ok ? o.hint : o.reason }}</small>
                    </button>
                  }
                }
                @if (ministries().length) {
                  <div class="opt-group" role="group" aria-label="Lui confier un ministère">
                    <strong>💼 Lui confier un ministère</strong>
                    <small class="muted">{{ ministryNote() }}</small>
                    <div class="chips-row">
                      @for (o of ministries(); track o.id) {
                        <button type="button" [disabled]="!o.ok" [title]="o.ok ? o.hint : (o.reason ?? '')" (click)="phone.call(t.key, o.id); calling.set(false)">{{ o.chip }}</button>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          } @else {
            <nav class="tabs" role="tablist">
              <button type="button" role="tab" [class.on]="phone.tab() === 'messages'" (click)="phone.tab.set('messages')">Messages @if (phone.unread()) { <b class="badge">{{ phone.unread() }}</b> }</button>
              <button type="button" role="tab" [class.on]="phone.tab() === 'repertoire'" (click)="phone.tab.set('repertoire')">Répertoire</button>
              <button type="button" role="tab" [class.on]="phone.tab() === 'reseaux'" (click)="phone.tab.set('reseaux'); phone.ensureAudience()">Réseaux</button>
              <button type="button" role="tab" [class.on]="phone.tab() === 'positions'" (click)="phone.tab.set('positions')">Positions</button>
              <button type="button" class="x" (click)="phone.close()" aria-label="Fermer le téléphone">✕</button>
            </nav>
            <p class="calls mono">{{ callInfo() }}</p>
            @if (phone.tab() === 'reseaux') {
              <div class="feed">
                <div class="audience">
                  @if (phone.audience(); as a) {
                    <div class="aud-head">
                      <div><strong class="mono count" [class.bump]="bump()">{{ fmt(a.followers) }}</strong><small class="muted"> abonnés</small></div>
                      <button type="button" class="live" [disabled]="a.liveWeek === game.s().week || game.s().player.stats.energy < 8" (click)="goLive()">🔴 Live{{ a.liveWeek === game.s().week ? ' fait' : '' }}</button>
                    </div>
                    <div class="miles" aria-label="Paliers d’abonnés">
                      @for (m of milestones; track m) { <span [class.on]="a.followers >= m">{{ fmt(m) }}</span> }
                    </div>
                    <span class="muted small">Tendances du mois ({{ phone.socialLeft() }} / 3 publications)</span>
                    <div class="trends">
                      @for (t of a.trends; track t.tag; let i = $index) {
                        <button type="button" class="trend" [disabled]="phone.socialLeft() <= 0" (click)="post('tendance', i)" [style.--hot]="t.hot">{{ t.tag }} <small>{{ t.hot >= 1.5 ? '🔥' : '' }}</small></button>
                      }
                    </div>
                  }
                  <div class="quick">
                    <button type="button" [disabled]="phone.socialLeft() <= 0" (click)="post('terrain')">📸 Photo de terrain</button>
                    <button type="button" [disabled]="phone.socialLeft() <= 0" (click)="post('coulisses')">🏛️ Coulisses</button>
                    <button type="button" [disabled]="phone.socialLeft() <= 0" (click)="post('vie')">☕ Vie perso</button>
                  </div>
                  @if (said().length) { <div class="chips" [class.viral]="said()[0] === '🔥 Viral !'">@for (x of said(); track $index) { <span>{{ x }}</span> }</div> }
                  @if (phone.audience(); as a) {
                    @if (a.posts.length) {
                      <details class="mine"><summary>Vos publications</summary>
                        @for (mp of a.posts.slice(0, 6); track mp.id) {
                          <article class="post own" [class.viral]="mp.viral">
                            <p>{{ mp.text }}</p>
                            <footer><small class="muted">♥ {{ fmt(mp.likes) }} · ↻ {{ fmt(mp.shares) }} · {{ game.month(mp.week) }}</small>@if (mp.viral) { <b class="vbadge">🔥 viral</b> }</footer>
                          </article>
                        }
                      </details>
                    }
                  }
                </div>
                @for (po of phone.feed(); track po.id) {
                  <article class="post" [class.neg]="po.tone === 'negative'">
                    <header><strong>{{ po.author }}</strong> <small class="muted">{{ po.handle }} · {{ game.month(po.week) }}</small></header>
                    <p>{{ po.text }}</p>
                    <footer>
                      <small class="muted">♥ {{ po.likes.toLocaleString('fr-FR') }}</small>
                      @if (phone.reacted().includes(po.id)) { <small class="done">Vous avez réagi</small> }
                      @else {
                        <span class="acts">
                          <button type="button" [disabled]="phone.socialLeft() <= 0" (click)="comment(po.id, 'soutien')">👍 Soutenir</button>
                          <button type="button" [disabled]="phone.socialLeft() <= 0" (click)="comment(po.id, 'pique')">🌶️ Piquer</button>
                          <button type="button" [disabled]="phone.socialLeft() <= 0" (click)="comment(po.id, 'humour')">😂 Humour</button>
                        </span>
                      }
                    </footer>
                  </article>
                } @empty { <p class="empty">Rien de neuf sur les réseaux ce mois-ci.</p> }
              </div>
            } @else if (phone.tab() === 'positions') {
              <div class="positions">
                <p class="muted small">Ce que vous avez déclaré, sujet par sujet. Les journalistes ont de la mémoire : changer d’avis est un revirement, de plus en plus coûteux.</p>
                @if (colles(); as c) { <p class="colles">🎯 Colles : <b>{{ c.right }}</b> bonne{{ c.right > 1 ? 's' : '' }} réponse{{ c.right > 1 ? 's' : '' }}, <b>{{ c.wrong }}</b> raté{{ c.wrong > 1 ? 's' : '' }}</p> }
                <ul>
                  @for (p of positions(); track p.topic) {
                    <li [class.flip]="p.flips > 0"><strong>{{ p.topic }}</strong><span>« {{ p.answer }} »</span>
                      <small class="muted">{{ game.month(p.week) }} · déclaré {{ p.times }} fois{{ p.flips ? ' · ' + p.flips + ' revirement' + (p.flips > 1 ? 's' : '') : '' }}</small></li>
                  } @empty { <li class="empty">Aucune prise de position pour l’instant. Les journalistes vous poseront bientôt la question.</li> }
                </ul>
              </div>
            } @else if (phone.tab() === 'messages') {
              <ul class="threads">
                @for (th of threads(); track th.who) {
                  <li [class.ringing]="th.urgent"><button type="button" (click)="phone.openThread(th.who)">
                    <span class="avatar" aria-hidden="true">{{ th.icon }}</span>
                    <span class="t-txt"><strong>{{ th.name }}@if (th.urgent) { <em class="ring-lbl">· appel entrant</em> }</strong><small>{{ th.last }}</small></span>
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
    .reply { display: grid; gap: 2px; }
    .reply small { font-weight: 400; font-size: 11.5px; color: var(--ink-2); }
    .reply.qcm { border-radius: 10px; }
    .qcm-head { margin: 0; font-size: 12px; color: var(--ink-2); }
    .positions { overflow-y: auto; flex: 1; padding: 8px 14px;
      ul { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 8px; }
      li { display: grid; gap: 2px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); font-size: 13px; }
      li.flip { border-color: var(--warn); }
      .small { font-size: 12px; margin: 0; }
      .colles { margin: 8px 0 0; font-size: 13px; } }
    .heart { font-size: 13px; }
    .react-bar { display: inline-flex; gap: 2px; margin-top: 4px; button { border: 0; background: var(--surface); border-radius: 12px; padding: 1px 5px; cursor: pointer; font-size: 13px; } button:hover { transform: scale(1.15); } }
    .react-on { display: inline-block; margin-top: 3px; font-size: 14px; }
    .quick { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px; border-top: 1px solid var(--line);
      button { border: 1px solid var(--line); background: var(--surface); border-radius: 16px; padding: 6px 10px; font: 12.5px var(--font-body); color: var(--ink); cursor: pointer; }
      button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); } button:disabled { opacity: .45; cursor: default; } }
    .sent { margin: 0; padding: 8px 14px; font-size: 11.5px; border-top: 1px solid var(--line); }
    .feed { flex: 1; overflow-y: auto; display: grid; align-content: start; gap: 8px; padding: 8px 10px; }
    .compose { display: grid; gap: 4px; font-size: 12px; .quick { border: 0; padding: 4px 0; } }
    .audience { display: grid; gap: 6px; font-size: 12px; padding: 8px 10px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line);
      .quick { border: 0; padding: 2px 0; } .small { font-size: 11px; } }
    .aud-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; .count { font-size: 20px; display: inline-block; transition: transform .3s; } .count.bump { animation: count-bump .6s ease; color: var(--good); } }
    @keyframes count-bump { 30% { transform: scale(1.35); } }
    .live { border: 0; border-radius: 999px; padding: 5px 10px; background: #d6453d; color: #fff; font: 600 12px var(--font-body); cursor: pointer; animation: live-pulse 1.6s ease-in-out infinite; }
    .live:disabled { opacity: .45; animation: none; cursor: default; }
    @keyframes live-pulse { 50% { box-shadow: 0 0 0 6px rgba(214, 69, 61, .2); } }
    .miles { display: flex; gap: 3px; span { flex: 1; text-align: center; font: 600 9.5px var(--font-mono); padding: 2px 0; border-radius: 4px; background: var(--surface-2); color: var(--ink-3); } span.on { background: var(--good-soft); color: var(--good); } }
    .trends { display: flex; flex-wrap: wrap; gap: 5px; }
    .trend { border: 1px solid #2f6cb0; color: #2f6cb0; background: none; border-radius: 999px; padding: 4px 9px; font: 600 12px var(--font-body); cursor: pointer; animation: trend-in .4s ease both; }
    .trend:hover:not(:disabled) { background: #2f6cb0; color: #fff; }
    .trend:disabled { opacity: .45; cursor: default; }
    @keyframes trend-in { from { transform: translateY(6px); opacity: 0; } }
    .chips.viral span:first-child { background: #d6453d; color: #fff; animation: count-bump .6s ease; }
    .mine { summary { cursor: pointer; font-weight: 600; } .own { margin-top: 6px; } .own.viral { border-color: #d6453d; } }
    .ringing button { background: color-mix(in srgb, #d6453d 10%, var(--surface)); }
    .ringing .avatar { animation: ring .9s ease-in-out infinite; display: inline-block; }
    .ring-lbl { font-style: normal; font-size: 11px; color: #d6453d; font-weight: 600; }
    @keyframes ring { 0%, 50%, 100% { transform: rotate(0); } 10%, 30% { transform: rotate(-14deg); } 20%, 40% { transform: rotate(14deg); } }
    .vbadge { margin-left: 6px; font-size: 11px; color: #d6453d; }
    .post { border: 1px solid var(--line); border-radius: 12px; padding: 8px 10px; display: grid; gap: 4px; font-size: 13px;
      header { font-size: 12.5px; } p { margin: 0; line-height: 1.35; } footer { display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap; }
      .acts { display: flex; gap: 4px; button { border: 0; background: var(--surface-2); border-radius: 12px; padding: 3px 8px; font: 11.5px var(--font-body); cursor: pointer; color: var(--ink); } button:disabled { opacity: .4; } }
      .done { color: var(--good); font-size: 11px; } }
    .post.neg { border-left: 3px solid var(--bad); }
    .call-sheet { display: grid; gap: 6px; padding: 10px 12px 12px; border-top: 1px solid var(--line); background: var(--surface-2); animation: rise .2s ease;
      .cs-head { display: grid; small { font-size: 11px; } } }
    .opt-group { display: grid; gap: 4px; padding: 9px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); font-size: 13px;
      small { font-size: 11.5px; } }
    .chips-row { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 2px;
      button { padding: 5px 9px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink); font: 12px var(--font-body); cursor: pointer; }
      button:hover:not(:disabled) { border-color: var(--accent); }
      button:disabled { opacity: .45; cursor: default; } }
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
  private readonly fx = inject(FxService);
  protected readonly calling = signal(false);

  private readonly all = computed<PhoneMessage[]>(() => this.game.s().phone?.messages ?? []);

  /** Rôle d'une personne hors répertoire (personnalité sans numéro…) */
  /** Traits de caractère d'une personnalité (pastilles cliquables) */
  protected persona(key: string, name: string): string[] {
    const s = this.game.s();
    const id = key.split(':')[1];
    const n = (id && s.npcs.find(x => x.id === id)) || s.npcs.find(x => x.name === name);
    return n?.persona ?? [];
  }

  protected roleOf(key: string): string {
    const s = this.game.s();
    if (key.startsWith('perso:')) { const n = s.npcs.find(x => x.id === key.slice(6)); const party = n ? [s.party, ...s.otherParties].find(p => p.id === n.partyId) : null; return n ? `${party?.name ?? 'Personnalité'} · numéro inconnu` : ''; }
    return '';
  }
  protected readonly threads = computed(() => {
    const dir = new Map(this.phone.directory().map(e => [e.key, e]));
    const out = new Map<string, { who: string; name: string; icon: string; last: string; week: number; unread: number; waiting: boolean; urgent: boolean }>();
    for (const m of this.all()) {
      const t = out.get(m.who) ?? { who: m.who, name: dir.get(m.who)?.name ?? m.from, icon: dir.get(m.who)?.icon ?? (m.urgent ? '📞' : m.who === 'qcm:colle' ? '🎯' : m.who.startsWith('qcm:') ? '❓' : '💬'), last: m.text, week: m.week, unread: 0, waiting: false, urgent: false };
      if (!m.outgoing && !m.read) t.unread++;
      if (!m.outgoing && m.replies && !m.answered) t.waiting = true;
      if (m.urgent && !m.answered) t.urgent = true;
      out.set(m.who, t);
    }
    // Les appels entrants qui sonnent passent en tête
    return [...out.values()].sort((a, b) => Number(b.urgent) - Number(a.urgent));
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
  protected readonly ministries = computed(() => this.options().filter(o => o.group === 'ministere'));
  protected readonly ministryNote = computed(() => {
    const m = this.ministries();
    const blocked = m.find(o => !o.ok && o.reason && o.reason !== 'Déjà à ce poste');
    return blocked?.reason ?? 'Un remaniement par mois. Il ou elle peut refuser.';
  });

  protected readonly groups = computed(() => GROUPS.map(g => ({ label: g.label, entries: this.phone.directory().filter(e => e.kind === g.kind) })).filter(g => g.entries.length));

  protected readonly positions = computed(() => positionsList(this.game.s()));
  protected readonly colles = computed(() => { const c = this.game.s().phone?.dlg?.colles; return c && c.right + c.wrong ? c : null; });
  protected readonly quick = QUICK_SMS;
  protected readonly reactions = REACTIONS;
  protected readonly said = signal<string[]>([]);
  /** Le dernier message reçu de la conversation : on peut y réagir */
  protected readonly lastIncoming = computed(() => this.messages().find(m => !m.outgoing)?.id ?? null);
  protected readonly milestones = MILESTONES;
  protected readonly bump = signal(false);
  protected fmt(n: number): string { return fmtFollowers(n); }
  protected post(kind: 'terrain' | 'coulisses' | 'vie' | 'tendance', i = 0): void { this.react(this.phone.publish(kind, i)); }
  protected goLive(): void { this.react(this.phone.live()); }
  private react(r: PostResult | null): void {
    if (!r) return;
    this.said.set(r.lines);
    this.bump.set(true);
    setTimeout(() => this.bump.set(false), 700);
    const w = window.innerWidth, h = window.innerHeight;
    this.fx.float(`+${fmtFollowers(r.gained)} abonnés`, 'good', w / 2, h * 0.45);
    if (r.viral) { this.fx.newspaper('Votre publication fait le buzz', 'VIRAL'); [0.3, 0.5, 0.7].forEach((x, k) => setTimeout(() => this.fx.burst(w * x, h * 0.4, 'good', 18), k * 150)); }
    if (r.milestone) setTimeout(() => this.fx.spotlight(`${fmtFollowers(r.milestone!)} abonnés !`, 'Un nouveau palier sur les réseaux'), r.viral ? 1800 : 300);
  }
  protected comment(id: string, tone: 'soutien' | 'pique' | 'humour'): void { this.said.set(this.phone.comment(id, tone)); }

  protected callInfo(): string {
    const c = this.phone.calls();
    return c.free ? `Appels ce mois : ${c.used} / ${c.max} · encore ${c.free} sans fatigue` : `Forfait épuisé : chaque appel coûte ${EXTRA_CALL_ENERGY} d’énergie`;
  }
}

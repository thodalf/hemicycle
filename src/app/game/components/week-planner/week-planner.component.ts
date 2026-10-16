import { costOf, saturation } from '../../engine/difficulty';
import { SAGA_BY_ID } from '../../data/saga-defs';
import { RoyalPipe } from '../shared/royal.pipe';
import { tierOdds } from '../../engine/outcomes';
import { ObjectivesPanelComponent } from '../objectives-panel/objectives-panel.component';
import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, afterNextRender, effect, computed, inject, signal } from '@angular/core';
import {
  ActionCategory, ActionDefinition, CATEGORY_LABELS, DOMAINS, DOMAIN_LABELS, Domain, Payer, PlannedAction,
} from '../../models/game.models';
import { ACTIONS_BY_ID } from '../../data/actions';
import { RANKS } from '../../data/ranks';
import { ActionPlannerService, partyFundable } from '../../services/action-planner.service';
import { partyCapitalCost, wearFactor } from '../../engine/effects';
import { describeEffects } from '../../engine/describe';
import { GameStateService } from '../../services/game-state.service';
import { TurnService } from '../../services/turn.service';
import { FxService } from '../../services/fx.service';
import { ELECTIONS } from '../../data/ranks';
import { PARTNERS, PARTNERS_BY_ID } from '../../engine/intl';
import { PROJECTS, PROJECTS_BY_ID, projectLeaves, projectLoadLabel, projectVisible } from '../../data/projects';
import { projectAvailability } from '../../engine/projects';
import { ENEMIES, ENEMIES_BY_ID } from '../../engine/war';
import { durationLabel, monthIndex, yearOf } from '../../engine/calendar';

/** Actions qui peuvent viser n'importe quelle personnalité, pas seulement votre parti */
const ANY_NPC = ['dejeuner', 'diner_maison', 'off', 'grand_oral', 'clash_reseaux', 'demonter', 'numero_personnalite'];

interface TargetOption {
  id: string;
  label: string;
}

/** Actions de déplacement (un avion traverse l'écran) */
const TRIPS = new Set(['voyage_etat', 'sommet_bilateral', 'conferences_inter', 'tournee_mondiale']);
const SCANDAL_TAGS = /scandale|revelation|enquete|diffamation|paparazzi|fuite|hatvp|train_de_vie/;
const report0 = (r: { deltas: { key: string; delta: number }[] } | null) => r?.deltas;

/** Saisons du calendrier (bandeau de l'agenda) */
const SEASONS = ['❄️', '❄️', '🌱', '🌷', '🌸', '☀️', '☀️', '🏖️', '🍂', '🍂', '🍁', '🎄'];

/**
 * Gestion du mois.
 * Le joueur compose son agenda (budget de points d'action), voit les coûts
 * cumulés en temps réel, puis clôt le mois — sauf si une décision urgente
 * attend une réponse.
 */
/** Un écran interactif occupe la scène : on ne joue pas d'animation par-dessus */
export function blockingOverlay(st: { scene?: unknown; debate?: unknown; protest?: unknown; vote?: unknown; minigames?: unknown[]; activity?: unknown }): boolean {
  return !!(st.scene || st.debate || st.protest || st.vote || st.activity || (st.minigames ?? []).length);
}

/** Un petit pictogramme qui s'envole quand on planifie */
const CATEGORY_ICONS: Partial<Record<string, string>> = {
  terrain: '🤝', dossiers: '📚', parti: '🌹', reseau: '☎️', crise: '🚨', lutte: '⚖️', eclat: '🌟', couronne: '👑', loge: '🔺', territoire: '🏗️',
  sante: '💪', repos: '😴', guerre: '🎖️', international: '🌍', elysee: '🇫🇷', fonction: '🏛️', intrigue: '🕯️', zombie: '🧟', apocalypse: '🔥', saga: '📜', contact: '👽',
};

import { BillComposerComponent } from '../bill-composer/bill-composer.component';
import { voteRole } from '../../engine/assembly';

@Component({
  selector: 'app-week-planner',
  imports: [DecimalPipe, BillComposerComponent, ObjectivesPanelComponent, RoyalPipe],
  templateUrl: './week-planner.component.html',
  styleUrl: './week-planner.component.scss',
})
export class WeekPlannerComponent {
  protected readonly game = inject(GameStateService);
  protected readonly planner = inject(ActionPlannerService);
  protected readonly turn = inject(TurnService);
  private readonly anim = inject(FxService);
  /** Le projet de loi sur mesure : pour qui siège, gouverne ou dirige le parti */
  protected readonly billVisible = computed(() => !!voteRole(this.game.s()));
  /** Barre du bas : masquée quand le vrai bouton est visible ; repliable */
  protected readonly endVisible = signal(false);
  protected readonly mini = signal(false);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly watchEnd = afterNextRender(() => {
    const el = (this.host.nativeElement as HTMLElement).querySelector('.plan button.end');
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(entries => this.endVisible.set(entries.some(e => e.isIntersecting)), { threshold: 0.2 });
    io.observe(el);
    this.destroy.onDestroy(() => io.disconnect());
  });
  private readonly destroy = inject(DestroyRef);

  /** Onglets présents dans ce scénario, scénario en premier */
  protected readonly categories = computed(() => {
    const present = new Set([...this.planner.unlocked(), ...this.planner.locked()].map(a => a.category));
    const sagaTab = this.game.s().saga ? SAGA_BY_ID.get(this.game.s().saga!.id)?.tab : undefined;
    const all = (Object.entries(CATEGORY_LABELS) as [ActionCategory, string][]).filter(([c]) => present.has(c)).map(([c, l]) => [c, c === 'saga' && sagaTab ? sagaTab : l] as [ActionCategory, string]);
    const scenario = this.game.s().scenario;
    // L'onglet Guerre n'existe qu'en temps de guerre, et passe alors en tête
    if (this.game.s().war) {
      const war = all.filter(([c]) => c === 'guerre' || c === 'arriere');
      const rest = all.filter(([c]) => c !== 'guerre' && c !== 'arriere');
      all.splice(0, all.length, ...war, ...rest);
    } else {
      all.splice(0, all.length, ...all.filter(([c]) => c !== 'guerre' && c !== 'arriere'));
    }
    const withProjects = (list: [ActionCategory | 'projets', string][]) => [...list.slice(0, 1), ['projets', 'Projets'] as [ActionCategory | 'projets', string], ...list.slice(1)];
    // Épidémie Z : l'onglet passe devant tout le reste
    if (this.game.s().zombie) {
      const zz = all.filter(([c]) => c === 'zombie');
      all.splice(0, all.length, ...zz, ...all.filter(([c]) => c !== 'zombie'));
      return withProjects(all);
    }
    // Un complot en cours : l'onglet Sécurité passe devant
    if (this.game.s().plot) {
      const sec = all.filter(([c]) => c === 'securite');
      all.splice(0, all.length, ...sec, ...all.filter(([c]) => c !== 'securite'));
      return withProjects(all);
    }
    if (this.game.s().saga && !this.game.s().saga!.outcome && present.has('saga')) return withProjects([...all.filter(([c]) => c === 'saga'), ...all.filter(([c]) => c !== 'saga')]);
    if (this.game.s().war && (all[0]?.[0] === 'guerre' || all[0]?.[0] === 'arriere')) return withProjects(all);
    if (this.game.s().presidency) return withProjects([...all.filter(([c]) => c === 'elysee'), ...all.filter(([c]) => c !== 'elysee')]);
    if (present.has('fonction') && !['royaute', 'franc_macon', 'editorialiste', 'infiltre', 'contact'].includes(scenario)) return withProjects([...all.filter(([c]) => c === 'fonction'), ...all.filter(([c]) => c !== 'fonction')]);
    const first = scenario === 'royaute' ? 'couronne' : scenario === 'franc_macon' ? 'loge' : scenario === 'editorialiste' ? 'redaction' : scenario === 'infiltre' ? 'infiltration' : scenario === 'contact' ? 'contact' : null;
    return withProjects(first ? [...all.filter(([c]) => c === first), ...all.filter(([c]) => c !== first)] : all);
  });
  protected readonly category = signal<ActionCategory | 'projets'>(this.categories()[0]?.[0] ?? 'terrain');
  /** Un onglet qui disparaît (fin d'une lutte…) renvoie au premier onglet */
  private readonly keepCategory = effect(() => {
    const cats = this.categories();
    const cur = this.category();
    if (cur !== 'projets' && cats.length && !cats.some(([c]) => c === cur)) this.category.set(cats[0][0]);
  });
  protected readonly confirmAbandon = signal(false);

  /* ── Glisser d'une catégorie à l'autre (mobile) ──────────── */
  protected catSwipe: { x: number; y: number; t: number } | null = null;
  protected readonly catAnim = signal<'l' | 'r' | null>(null);
  private catTimer: ReturnType<typeof setTimeout> | null = null;

  protected catSwipeStart(ev: TouchEvent): void {
    this.catSwipe = null;
    if (ev.touches.length !== 1 || document.querySelector('.overlay')) return;
    // Pas sur la bande d'onglets (elle défile déjà), ni sur un champ de saisie ou un curseur
    for (let n = ev.target as HTMLElement | null; n && !n.classList?.contains('catalog'); n = n.parentElement) {
      if (n.matches?.('nav.tabs, input, textarea, select, [contenteditable], app-bill-composer')) return;
      const ox = getComputedStyle(n).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 4) return;
    }
    const t = ev.touches[0];
    this.catSwipe = { x: t.clientX, y: t.clientY, t: Date.now() };
  }

  protected catSwipeEnd(ev: TouchEvent): void {
    const s0 = this.catSwipe;
    this.catSwipe = null;
    if (!s0 || !ev.changedTouches.length) return;
    const t = ev.changedTouches[0];
    const dx = t.clientX - s0.x, dy = t.clientY - s0.y;
    // Un geste franc et horizontal : au moins 60 px, deux fois plus large que haut, en moins de 0,7 s
    if (Date.now() - s0.t > 700 || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
    const ids = this.categories().map(c => c[0]);
    const j = ids.indexOf(this.category()) + (dx < 0 ? 1 : -1);
    if (j < 0 || j >= ids.length) return;
    this.category.set(ids[j]);
    this.catAnim.set(null);
    if (this.catTimer) clearTimeout(this.catTimer);
    requestAnimationFrame(() => {
      this.catAnim.set(dx < 0 ? 'l' : 'r');
      // L'onglet actif revient au centre de la bande
      const host = this.host.nativeElement as HTMLElement;
      host.querySelector(`nav.tabs [data-cat="${ids[j]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
    this.catTimer = setTimeout(() => this.catAnim.set(null), 320);
  }

  /** Chances de coup d'éclat et de raté, affichées sur chaque action */
  protected costOf(a: ActionDefinition) { return costOf(this.game.s(), a); }
  /** La prochaine action de cette catégorie : quelle perte, faute de variété ? */
  protected satNext(a: ActionDefinition): number {
    if (['repos', 'sante', 'argent'].includes(a.category)) return 0;
    const rank = this.planner.plan().filter(p => ACTIONS_BY_ID.get(p.actionId)?.category === a.category).length;
    return Math.round((1 - saturation(rank)) * 100);
  }
  protected odds(a: ActionDefinition): { eclat: number; rate: number } | null {
    if (['repos', 'sante', 'argent'].includes(a.category) || a.minigame) return null;
    const o = tierOdds(this.game.s(), a);
    return { eclat: Math.round(o.eclat * 100), rate: Math.round(o.rate * 100) };
  }

  /** Objectifs : un volet repliable, ouvert ou fermé selon votre dernier choix */
  protected readonly objOpen = signal(((): boolean => { try { return localStorage.getItem('polsim.objOpen') !== '0'; } catch { return true; } })());
  protected objToggle(ev: Event): void {
    const open = (ev.target as HTMLDetailsElement).open;
    this.objOpen.set(open);
    try { localStorage.setItem('polsim.objOpen', open ? '1' : '0'); } catch { /* navigation privée */ }
  }
  protected readonly objDone = computed(() => this.game.s().objectives.filter(o => o.progress >= o.target).length);
  protected objPct(o: { progress: number; target: number }) { return Math.max(0, Math.min(100, (100 * o.progress) / o.target)); }

  /** Projet en cours */
  protected readonly current = computed(() => {
    const s = this.game.s();
    const def = s.project ? PROJECTS_BY_ID.get(s.project.id) : null;
    return def && s.project ? { def, done: s.project.done, months: s.project.months, load: projectLoadLabel(def) } : null;
  });

  /** Projets proposés à votre rang */
  protected readonly projects = computed(() => {
    const s = this.game.s();
    return PROJECTS.filter(p => projectVisible(s, p)).map(def => {
      const f = describeEffects(def.final);
      const w = describeEffects(def.monthly);
      const risk = def.risk ? describeEffects(def.risk.onFailure) : null;
      return {
        def, av: projectAvailability(s, def), load: projectLoadLabel(def), big: projectLeaves(def) !== null, duration: durationLabel(def.months),
        monthly: [...w.gains, ...w.losses, ...w.other], final: [...f.gains, ...f.losses, ...f.other],
        riskText: risk ? 'En cas d’échec : ' + [...risk.losses, ...risk.gains, ...risk.other].map(c => c.text).join(', ') : '',
      };
    });
  });
  /** Cible choisie pour chaque action ciblée (actionId → domaine / id) */
  private readonly targets = signal<Record<string, string>>({});
  protected readonly reportOpen = signal(true);
  /** Payeur choisi pour chaque action payante (perso par défaut) */
  private readonly payers = signal<Record<string, Payer>>({});
  protected readonly fundable = partyFundable;

  protected readonly visibleActions = computed(() =>
    this.planner.unlocked().filter(a => a.category === this.category()));
  protected readonly lockedActions = computed(() =>
    this.planner.locked().filter(a => a.category === this.category()));

  protected readonly apPips = computed(() => {
    const ap = this.game.player().actionPoints;
    const spent = this.planner.spent().ap;
    return Array.from({ length: ap.max }, (_, i) =>
      i < spent ? 'planned' : i < ap.current ? 'free' : 'lost');
  });

  protected targetOptions(action: ActionDefinition): TargetOption[] {
    const s = this.game.s();
    switch (action.target) {
      case 'domain':
        return DOMAINS.map(d => ({
          id: d, label: `${DOMAIN_LABELS[d]} · ${Math.round(s.player.dossiers[d].mastery)}${d === s.agendaDomain ? ' · à la une' : ''}`,
        }));
      case 'npc':
      {
        const wide = ANY_NPC.includes(action.id) || action.category === 'intrigue';
        const parties = [s.party, ...s.otherParties];
        return s.npcs
          .filter(n => n.partyId === s.party.id || wide)
          .filter(n => action.id !== 'numero_personnalite' || !(s.player.phoneBook ?? []).includes(n.id))
          .map(n => ({ id: n.id, label: `${n.name}${wide ? ' · ' + (parties.find(x => x.id === n.partyId)?.name ?? '') : ''} (${n.relationToPlayer > 0 ? '+' : ''}${Math.round(n.relationToPlayer)})${Number(s.player.flags['kompromat_' + n.id] ?? 0) > 0 ? ' · 📁 dossier' : ''}` }));
      }
      case 'contact':
        return s.contacts.map(c => ({ id: c.id, label: `${c.name} · conf. ${Math.round(c.trust)} · crédit ${c.balance}` }));
      case 'faction':
        return s.party.factions.map(f => ({ id: f.id, label: `${f.name} · ${Math.round(f.supportForPlayer)} %` }));
      case 'partner':
        return PARTNERS.filter(p => !s.war?.allies.includes(p.id)).map(p => ({ id: p.id, label: `${p.name} · ${Math.round(s.intl.relations[p.id] ?? 0)}` }));
      case 'enemy':
        return ENEMIES.filter(e => !s.player.flags[`annexed_${e.id}`]).map(e => { const r = Math.round(s.intl.hostile?.[e.id] ?? 0); return { id: e.id, label: `${e.name} · relations ${r > 0 ? '+' : ''}${r} · puissance ${Math.round(e.strength * 100)}` }; });
      default:
        return [];
    }
  }

  protected selectedTarget(action: ActionDefinition): string {
    const chosen = this.targets()[action.id];
    if (chosen) return chosen;
    if (action.target === 'domain') return this.game.s().agendaDomain;
    return this.targetOptions(action)[0]?.id ?? '';
  }

  protected setTarget(action: ActionDefinition, value: string): void {
    this.targets.update(t => ({ ...t, [action.id]: value }));
  }

  /** Gains et pertes affichés sur la carte (mis en cache par action) */
  private readonly fxCache = new Map<string, ReturnType<typeof describeEffects>>();
  protected fx(action: ActionDefinition) {
    let v = this.fxCache.get(action.id);
    if (!v) { v = describeEffects(action.effects); this.fxCache.set(action.id, v); }
    return v;
  }
  /** Lassitude prévue si l'action est répétée (et une fois de plus si déjà planifiée ce mois-ci) */
  protected wear(action: ActionDefinition): number {
    const s = this.game.s();
    const planned = this.planner.plan().filter(p => p.actionId === action.id).length;
    const base = wearFactor(s, action.id);
    const streakNow = base < 1 ? Math.round((1 - base) / 0.2) : 0;
    return Math.max(0.4, 1 - 0.2 * (streakNow + planned));
  }

  protected failText(action: ActionDefinition): string {
    if (!action.risk) return '';
    const f = describeEffects(action.risk.onFailure);
    return 'En cas d’échec : ' + [...f.losses, ...f.gains, ...f.other].map(c => c.text).join(', ');
  }

  protected payer(action: ActionDefinition): Payer {
    if (action.partyOnly) return 'parti';
    return partyFundable(action) ? this.payers()[action.id] ?? 'perso' : 'perso';
  }

  protected setPayer(action: ActionDefinition, payer: Payer): void {
    this.payers.update(p => ({ ...p, [action.id]: payer }));
  }

  /** Infobulle du bouton « Parti » */
  protected partyHint(action: ActionDefinition): string {
    const left = this.planner.envelopeLeft().toLocaleString('fr-FR');
    const pc = partyCapitalCost(this.game.s(), costOf(this.game.s(), action).money ?? 0);
    return this.planner.leaderPays()
      ? `Réglé par la trésorerie du parti (reste ${left} €)`
      : `Enveloppe de la fédération : ${left} € restants · coûte ${pc} pt de capital politique`;
  }

  protected availability(action: ActionDefinition) {
    return this.planner.availability(action, action.target ? this.selectedTarget(action) : undefined, this.payer(action));
  }

  protected plan(action: ActionDefinition, event?: Event): void {
    const target = this.selectedTarget(action);
    const ok = this.planner.add(action.id, action.target === 'domain'
      ? { domain: target as Domain }
      : action.target ? { targetId: target } : undefined, this.payer(action));
    // Un jeton « −n PA » s'envole de la carte vers l'agenda du mois
    if (ok && event) {
      this.anim.fly(event.currentTarget as Element, document.querySelector('app-week-planner .plan-list'), `${action.cost.ap} PA`);
      if (action.category === 'medias') this.anim.mic(event.currentTarget as Element);
      const icon = CATEGORY_ICONS[action.category];
      if (icon) this.anim.floatAt(event.currentTarget as Element, icon, 'neutral', 120);
      if (action.category === 'argent') this.anim.coins(event.currentTarget as Element, true, 5);
      if (action.category === 'couronne') this.anim.crown(event.currentTarget as Element);
    }
  }

  protected describe(p: PlannedAction): { label: string; target?: string; ap: number; party: boolean } {
    const a = ACTIONS_BY_ID.get(p.actionId)!;
    const s = this.game.s();
    let target: string | undefined;
    if (p.domain) target = DOMAIN_LABELS[p.domain];
    else if (p.targetId) {
      target = s.npcs.find(n => n.id === p.targetId)?.name
        ?? s.contacts.find(c => c.id === p.targetId)?.name.split(' (')[0]
        ?? s.party.factions.find(f => f.id === p.targetId)?.name
        ?? PARTNERS_BY_ID.get(p.targetId)?.name
        ?? ENEMIES_BY_ID.get(p.targetId)?.name;
    }
    return { label: a.label, target, ap: a.cost.ap, party: p.payer === 'parti' };
  }

  protected rankLabel(a: ActionDefinition): string {
    return RANKS[a.minRank].label;
  }


  protected scrollToPlan(): void {
    document.querySelector('app-week-planner .plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected scrollToDecisions(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected lancer(id: string): void {
    if (this.turn.lancer(id)) {
      this.anim.stamp('Projet lancé', 'neutral', PROJECTS_BY_ID.get(id)?.label ?? '');
      this.category.set(this.categories()[0]?.[0] ?? 'terrain');
    }
  }

  protected abandon(): void {
    this.confirmAbandon.set(false);
    this.turn.abandon();
  }

  protected devote(): void {
    const from = this.game.week();
    const label = this.current()?.def.label ?? '';
    this.turn.devote();
    this.reportOpen.set(true);
    const after = this.game.s();
    if (after.week !== from && after.status !== 'mort') this.anim.monthTurn(from, after.week);
    if (!after.project && after.status !== 'mort') setTimeout(() => this.anim.stamp('Projet abouti', 'good', label), 900);
  }

  /** Les animations attendues, jouées quand plus rien ne couvre l'écran */
  private deferred: (() => void) | null = null;
  private readonly flushDeferred = effect(() => {
    const st = this.game.state();
    if (!st || !this.deferred || blockingOverlay(st)) return;
    const fn = this.deferred;
    this.deferred = null;
    setTimeout(fn, 350);
  });

  /** Icône de saison du mois en cours */
  protected readonly season = computed(() => SEASONS[monthIndex(this.game.week())]);

  protected endWeek(): void {
    const before = this.game.s();
    const from = before.week;
    const known = new Set(before.pendingDecisions.map(d => d.id));
    const planned = this.planner.plan().map(p => ACTIONS_BY_ID.get(p.actionId)!).filter(Boolean);
    const funds = before.player.finances.personal;
    this.turn.endWeek();
    this.reportOpen.set(true);

    // Animations : page de calendrier, variations au-dessus des jauges, secousse si coup dur
    const after = this.game.s();
    if (after.week === from) return;
    // Les animations du mois attendent que les écrans interactifs (mini-jeu, scène, débat, vote) soient fermés
    const play = () => {
      const now = this.game.s();
      const overlay = !!(now.scene || now.debate || now.protest || now.vote);
      if (!overlay) this.anim.monthTurn(from, after.week);
      if (yearOf(after.week) !== yearOf(from)) setTimeout(() => this.anim.newYear(yearOf(after.week)), overlay ? 300 : 1500);
      else if (monthIndex(after.week) === 11 && !overlay) setTimeout(() => this.anim.rain(true), 600);
      // Voyages : un avion traverse l'écran
      const trip = planned.find(a => a.category === 'international' || TRIPS.has(a.id));
      if (trip && !overlay) setTimeout(() => this.anim.plane(trip.label), 500);
      // Nouvelles décisions marquantes : une de journal, battement de cœur
      const fresh = after.pendingDecisions.filter(d => !known.has(d.id));
      const scoop = fresh.find(d => SCANDAL_TAGS.test(d.tag));
      if (scoop) setTimeout(() => this.anim.newspaper(scoop.title), 1300);
      if (fresh.some(d => d.tag === 'alerte_sante')) setTimeout(() => this.anim.heartbeat(), 900);
      // Popularité en chute libre : les tomates volent
      const dropPop = (report0(this.turn.lastReport())?.find(x => x.key === 'popularity')?.delta ?? 0);
      if (dropPop <= -5 && !overlay) setTimeout(() => this.anim.tomatoes(7), 1100);
      const report = this.turn.lastReport();
      report?.deltas.forEach((x, i) => {
        const el = document.querySelector(`app-profile-panel [data-stat="${x.key}"]`);
        const good = x.key === 'stress' ? x.delta < 0 : x.delta > 0;
        this.anim.floatAt(el, `${x.delta > 0 ? '+' : '−'}${Math.abs(x.delta)}`, good ? 'good' : 'bad', 500 + i * 140);
      });
      if (report?.project) {
        const pr = report.project;
        const el = document.querySelector('app-week-planner .project-box') ?? document.querySelector('app-week-planner .mobile-end');
        this.anim.floatAt(el, pr.finished ? `✓ ${pr.label}` : `Projet ${pr.done}/${pr.months} mois`, 'good', 400);
        if (pr.finished) setTimeout(() => this.anim.stamp('Projet abouti', 'good', pr.label), 1000);
      }
      const df = Math.round(after.player.finances.personal - funds);
      if (df) this.anim.floatAt(document.querySelector('app-vitals .money'), `${df > 0 ? '+' : '−'}${Math.abs(df).toLocaleString('fr-FR')} €`, df > 0 ? 'good' : 'bad', 700);
      if (Math.abs(df) >= 100 && !overlay) this.anim.coins(document.querySelector('app-vitals .money'), df > 0, Math.min(10, 3 + Math.round(Math.abs(df) / 1500)));

      // Flash info sur les coups durs du mois
      const freshNews = after.news.filter(n => n.week === after.week);
      const flash = freshNews.find(n => n.kind === 'scandale' || (n.kind === 'actu' && n.tone === 'negative'));
      if (flash) setTimeout(() => this.anim.ticker(`${flash.title}${flash.body ? ' — ' + flash.body : ''}`), 900);

      // Coups d'éclat et ratés du mois : un tampon, une petite secousse
      const eclats = freshNews.filter(n => n.title.startsWith('Coup d’éclat'));
      const rates = freshNews.filter(n => n.title.startsWith('Raté : '));
      if (eclats.length) setTimeout(() => this.anim.stamp(eclats.length > 1 ? `${eclats.length} coups d’éclat` : 'Coup d’éclat', 'good', eclats[0].title.replace('Coup d’éclat : ', '')), 1400);
      else if (rates.length) setTimeout(() => this.anim.stamp(rates.length > 1 ? `${rates.length} ratés` : 'Raté', 'bad', rates[0].title.replace('Raté : ', '')), 1400);

      // Objectifs atteints : gerbe de confettis sur le panneau
      const done = freshNews.filter(n => n.title.startsWith('Objectif atteint'));
      done.forEach((n, i) => setTimeout(() => {
        const panel = document.querySelector('.obj-fab') ?? document.querySelector('.obj-fold');
        this.anim.burstAt(panel, 'good');
        this.anim.floatAt(panel, n.title.replace('Objectif atteint : ', '✓ '), 'good');
      }, 1100 + i * 400));

      // Taupe : rapport transmis
      if (after.news.filter(n => n.week >= from).some(n => n.title === 'Transmettre un rapport à votre officier' && /Rapport transmis/.test(n.body ?? ''))) {
        setTimeout(() => this.anim.stamp('Transmis', 'neutral', 'Top secret'), 1000);
      }

      // Soirée électorale
      const justResolved = after.elections.filter(e => e.resolved && e.result && before.elections.some(b => b.id === e.id && !b.resolved));
      const e = justResolved[0];
      if (e?.result) {
        this.anim.ballot();
        if (e.result.winnerId !== 'player') setTimeout(() => this.anim.rain(), 4200);
        const name = (id: string) => id === 'player' ? after.player.name : after.npcs.find(n => n.id === id)?.name ?? id;
        const color = (id: string) => {
          if (id === 'player') return after.party.color;
          const pid = after.npcs.find(n => n.id === id)?.partyId;
          return [after.party, ...after.otherParties].find(p => p.id === pid)?.color ?? '#8a8f9a';
        };
        const rows = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1])
          .map(([id, share]) => ({ name: name(id), color: color(id), share, player: id === 'player' }));
        const rounds = [{ label: e.result.secondRound ? 'Premier tour' : 'Résultats', rows: rows(e.result.firstRound) }];
        if (e.result.secondRound) rounds.push({ label: 'Second tour', rows: rows(e.result.secondRound) });
        setTimeout(() => this.anim.election.set({
          title: ELECTIONS[e.type].label, rounds, winner: name(e.result!.winnerId), playerWon: e.result!.winnerId === 'player',
        }), 600);
      }
      // Soirée du premier tour : qualifié·e pour le second
      const qualified = after.elections.find(x => !x.resolved && x.firstRound && x.finalists && before.elections.some(b => b.id === x.id && !b.firstRound));
      if (!e && qualified?.firstRound) {
        this.anim.ballot();
        const name = (id: string) => id === 'player' ? after.player.name : after.npcs.find(n => n.id === id)?.name ?? id;
        const color = (id: string) => {
          if (id === 'player') return after.party.color;
          const pid = after.npcs.find(n => n.id === id)?.partyId;
          return [after.party, ...after.otherParties].find(p => p.id === pid)?.color ?? '#8a8f9a';
        };
        const rows = Object.entries(qualified.firstRound).sort((a, b) => b[1] - a[1])
          .map(([id, share]) => ({ name: name(id), color: color(id), share, player: id === 'player' }));
        const rival = name(qualified.finalists!.find(id => id !== 'player')!);
        setTimeout(() => this.anim.election.set({
          title: 'Présidentielle · premier tour', rounds: [{ label: 'Premier tour', rows }], winner: name(qualified.finalists![0]), playerWon: true,
          verdict: { title: 'Qualifié·e !', text: `Second tour face à ${rival}, le mois prochain. Avant cela : le débat.` },
        }), 600);
      }

      // Guerre : le front a bougé
      if (after.war && before.war) {
        const move = after.war.front - before.war.front;
        if (Math.abs(move) >= 3) setTimeout(() => this.anim.frontline(move > 0), 800);
      }
      const hard = after.pendingDecisions.filter(d => !known.has(d.id)).some(d => ['scandale', 'crise', 'banqueroute', 'revelation', 'enquete', 'defiance'].includes(d.tag));
      if (hard || (after.player.finances.personal < 0 && funds >= 0)) setTimeout(() => this.anim.shake(), 650);
    };
    if (blockingOverlay(after)) this.deferred = play;
    else play();
  }
}

import { Component, HostListener, computed, effect, inject, output, signal } from '@angular/core';
import { GameStateService } from '../../services/game-state.service';

type Tab = 'agenda' | 'moi' | 'pays' | 'actu' | 'jeux';
interface Step { title: string; text: string; target?: string; tab?: Tab }

const STEPS: Step[] = [
  { title: 'Bienvenue à l’Hémicycle', text: 'Vous commencez militant·e de section. Chaque tour dure un mois : vous planifiez vos actions, puis le monde réagit. Jusqu’où irez-vous ? Conseil municipal, Assemblée, gouvernement, Élysée… La partie ne s’arrête qu’à votre mort.' },
  { title: 'Vos jauges vitales', text: 'Fatigue, santé et fonds. Trop de fatigue mène au burn-out ; une santé fragile raccourcit la vie ; un compte à découvert mène à la banqueroute. Pensez au repos.', target: 'app-vitals' },
  { title: 'Votre profil', text: 'Popularité, influence, crédibilité, capital politique : ce sont vos ressources pour monter en grade. Dessous : vos dossiers (économie, santé…), vos compétences, vos talents, votre rémunération et votre équipe.', target: 'app-profile-panel', tab: 'moi' },
  { title: 'L’agenda du mois', text: 'Chaque action coûte des points d’action (PA), de l’énergie, parfois de l’argent. Le temps compte : un déplacement, une émission ou un dossier prennent 2 PA, un voyage 3 ; une action très payante, l’épuisement ou la même action répétée dans le mois coûtent plus ; un bon collaborateur en fait gagner. Survolez les PA pour savoir pourquoi. Les onglets regroupent terrain, médias, dossiers, parti, réseau, intrigues… Choisissez, puis « Planifier ».', target: 'app-week-planner', tab: 'agenda' },
  { title: 'Les décisions', text: 'Crises, propositions, dilemmes : certaines décisions doivent être tranchées avant la fin du mois. Lisez les chances de succès indiquées sur chaque choix.', target: 'app-decision-panel', tab: 'agenda' },
  { title: 'Finir le mois', text: 'Quand votre agenda est prêt, finissez le mois : vos actions s’exécutent, les rivaux jouent, l’actualité tombe. Un bilan s’affiche ensuite.', target: 'button.end', tab: 'agenda' },
  { title: 'Le téléphone', text: 'SMS de l’équipe, du parti, des contacts. Vous pouvez appeler pour demander un soutien sur un texte, de l’argent, ou un numéro de personnalité. Quatre appels par mois sans fatigue.', target: '.phone-btn' },
  { title: 'Monter en grade', text: 'Le panneau « Prochain palier » indique ce qu’il faut pour la prochaine investiture : seuils de stats, soutien du parti. Ensuite, une campagne et une élection. Les objectifs du mois rapportent des bonus.', target: 'app-objectives-panel', tab: 'agenda' },
  { title: 'L’actualité', text: 'Résultats de vos actions, rivaux, sondages, scrutins. Et parfois l’inattendu : une guerre, un complot, un signal venu des étoiles, une épidémie… Tout peut arriver en cours de partie.', target: 'app-news-feed', tab: 'actu' },
  { title: 'La salle de jeux', text: 'Le mot du jour, Metrodoku, Capitalodoku et Villodoku se jouent à tout moment, sans point d’action. Gains immédiats (une fois par jour pour le mot, une fois par mois pour les grilles), et un point d’action rendu si la partie est brillante.', target: 'app-arcade-panel', tab: 'jeux' },
  { title: 'À vous de jouer', text: 'Pour commencer : un peu de terrain pour la popularité, un dossier à étudier pour la crédibilité, et du repos. Vous pourrez revoir ce tutoriel avec le bouton « ? » en haut de l’écran.' },
];

const SEEN_KEY = 'polsim.tutoSeen';

/** Tutoriel des premiers pas : une bulle par étape, la zone concernée mise en lumière */
@Component({
  selector: 'app-tutorial',
  template: `
    @if (open()) {
      <div class="tuto" role="dialog" aria-modal="true" [attr.aria-label]="'Tutoriel : ' + step().title">
        @if (hole(); as h) {
          <div class="hole" [style.top.px]="h.top" [style.left.px]="h.left" [style.width.px]="h.width" [style.height.px]="h.height"></div>
        } @else {
          <div class="veil"></div>
        }
        <section class="bubble" [class.top]="placeTop()">
          <div class="progress" aria-hidden="true">@for (s of steps; track $index) { <i [class.on]="$index <= index()"></i> }</div>
          <span class="eyebrow">Tutoriel · {{ index() + 1 }} / {{ steps.length }}</span>
          <h2>{{ step().title }}</h2>
          <p>{{ step().text }}</p>
          <div class="btns">
            <button type="button" class="btn small ghost" (click)="finish()">Passer</button>
            <span class="spacer"></span>
            @if (index() > 0) { <button type="button" class="btn small" (click)="go(index() - 1)">Précédent</button> }
            <button type="button" class="btn small primary" (click)="next()">{{ index() === steps.length - 1 ? 'C’est parti' : 'Suivant' }}</button>
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    .tuto { position: fixed; inset: 0; z-index: 70; }
    .veil { position: absolute; inset: 0; background: rgba(10, 14, 22, .58); }
    .hole { position: absolute; border-radius: 10px; box-shadow: 0 0 0 9999px rgba(10, 14, 22, .58), 0 0 0 3px var(--accent) inset;
      transition: top .3s, left .3s, width .3s, height .3s; pointer-events: none; }
    .bubble { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); width: min(460px, calc(100% - 32px));
      background: var(--surface); color: var(--ink); border-radius: 14px; padding: 16px 18px; display: grid; gap: 8px;
      box-shadow: 0 24px 60px -20px rgba(0,0,0,.6); border: 1px solid var(--line); animation: pop .25s ease; }
    .bubble.top { bottom: auto; top: 24px; }
    h2 { font-size: 20px; margin: 0; }
    p { margin: 0; font-size: 14px; line-height: 1.5; color: var(--ink-2); }
    .btns { display: flex; gap: 8px; align-items: center; margin-top: 4px; } .spacer { flex: 1; }
    .progress { display: flex; gap: 4px; i { flex: 1; height: 3px; border-radius: 2px; background: var(--line); } i.on { background: var(--accent); } }
    @keyframes pop { from { opacity: 0; transform: translate(-50%, 8px); } }
    @media (max-width: 760px) { .bubble { bottom: 76px; } .bubble.top { top: 12px; } }
    @media (prefers-reduced-motion: reduce) { .bubble, .hole { animation: none; transition: none; } }
  `,
})
export class TutorialComponent {
  private readonly game = inject(GameStateService);
  readonly tab = output<Tab>();
  protected readonly steps = STEPS;
  protected readonly open = signal(false);
  protected readonly index = signal(0);
  protected readonly step = computed(() => STEPS[this.index()]);
  protected readonly hole = signal<{ top: number; left: number; width: number; height: number } | null>(null);
  protected readonly placeTop = signal(false);
  private started = false;

  constructor() {
    // Première partie : le tutoriel s'ouvre tout seul
    effect(() => {
      const s = this.game.state();
      if (!s || this.started) return;
      this.started = true;
      let seen = false;
      try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { /* stockage indisponible */ }
      if (!seen && !s.player.flags['tutoDone'] && s.week <= 3) setTimeout(() => this.start(), 700);
    });
  }

  start(): void {
    this.open.set(true);
    this.go(0);
  }

  protected next(): void {
    if (this.index() >= STEPS.length - 1) this.finish();
    else this.go(this.index() + 1);
  }

  protected go(i: number): void {
    this.index.set(i);
    const st = STEPS[i];
    if (st.tab) this.tab.emit(st.tab);
    this.hole.set(null);
    setTimeout(() => this.locate(true), 220);
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  protected onMove(): void {
    if (this.open()) this.locate(false);
  }

  private locate(scroll: boolean): void {
    const sel = this.step().target;
    const el = sel ? (Array.from(document.querySelectorAll(sel)).find(x => (x as HTMLElement).offsetParent !== null) as HTMLElement | undefined) : undefined;
    if (!el) { this.hole.set(null); this.placeTop.set(false); return; }
    if (scroll) el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    const r = el.getBoundingClientRect();
    const pad = 6;
    const top = Math.max(4, r.top - pad);
    const height = Math.min(r.height + pad * 2, innerHeight - top - 4);
    this.hole.set({ top, left: Math.max(4, r.left - pad), width: Math.min(r.width + pad * 2, innerWidth - 8), height });
    // La bulle se place à l'opposé de la zone éclairée
    this.placeTop.set(r.top + r.height / 2 > innerHeight / 2);
  }

  protected finish(): void {
    this.open.set(false);
    this.hole.set(null);
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* stockage indisponible */ }
    this.game.mutate(d => { d.player.flags['tutoDone'] = true; });
  }
}

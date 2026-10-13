import { Component, computed, input } from '@angular/core';
import { Decision } from '../../models/game.models';

export type EmblemKind = 'ovni' | 'espion' | 'tv' | 'journal' | 'sirene' | 'parti' | 'epees' | 'poignee' | 'trophee' | 'eclair' | 'pieces' | 'cloche';

/** Choisit l'illustration animée d'une décision selon sa nature */
export function emblemFor(d: Decision): EmblemKind {
  const t = d.tag;
  if (t.startsWith('ev_al_') || t === 'ev_signal_etoiles') return 'ovni';
  if (t.startsWith('ev_mole') || t === 'soupcons' || t === 'officier') return 'espion';
  if (t === 'banqueroute' || t === 'faillite_parti' || t.includes('krach') || t === 'ev_caisse_vide') return 'pieces';
  if (t === 'crise' || t.includes('tempete') || t.includes('accident') || t.includes('canicule')) return 'sirene';
  if (t === 'scandale' || t === 'revelation' || t === 'enquete' || t.includes('diffamation') || t.includes('paparazzi') || t.includes('hatvp') || t.includes('train_de_vie')) return 'journal';
  if (t === 'remaniement' || t === 'congres' || t === 'elevation' || t === 'promotion_redaction' || t.includes('prix')) return 'trophee';
  switch (d.source) {
    case 'medias': return 'tv';
    case 'parti': return 'parti';
    case 'rival': return 'epees';
    case 'reseau': return 'poignee';
    case 'carriere': return 'trophee';
    case 'evenement': return 'eclair';
  }
  return 'cloche';
}

/** Petite illustration 2D animée (SVG + CSS) en tête des cartes de décision */
@Component({
  selector: 'app-emblem',
  template: `
    <svg viewBox="0 0 48 48" [attr.class]="'em ' + kind()" aria-hidden="true">
      @switch (kind()) {
        @case ('ovni') {
          <g class="stars"><circle cx="6" cy="8" r=".8" /><circle cx="40" cy="6" r=".8" /><circle cx="44" cy="20" r=".6" /><circle cx="4" cy="22" r=".6" /></g>
          <path class="tractor" d="M18 24 L12 44 L36 44 L30 24 Z" />
          <g class="saucer">
            <path class="dome" d="M17 19 a7 6 0 0 1 14 0 z" />
            <ellipse class="disc" cx="24" cy="21" rx="16" ry="5" />
            <circle class="light l1" cx="14" cy="22" r="1.3" /><circle class="light l2" cx="24" cy="23.5" r="1.3" /><circle class="light l3" cx="34" cy="22" r="1.3" />
          </g>
        }
        @case ('espion') {
          <g class="loupe"><circle cx="20" cy="20" r="11" /><line x1="28" y1="28" x2="40" y2="40" class="manche" /></g>
          <circle class="oeil" cx="20" cy="20" r="3.5" />
        }
        @case ('tv') {
          <g class="antenna"><line x1="24" y1="12" x2="16" y2="3" /><line x1="24" y1="12" x2="32" y2="3" /></g>
          <rect class="frame" x="6" y="12" width="36" height="26" rx="4" />
          <rect class="screen" x="10" y="16" width="28" height="18" rx="2" />
          <line class="scan" x1="10" x2="38" y1="20" y2="20" />
          <line class="foot" x1="18" y1="42" x2="30" y2="42" />
        }
        @case ('journal') {
          <g class="spin">
            <rect class="paper" x="7" y="9" width="34" height="30" rx="2" />
            <line class="head" x1="11" y1="15" x2="37" y2="15" />
            <line x1="11" y1="21" x2="23" y2="21" /><line x1="11" y1="25" x2="23" y2="25" /><line x1="11" y1="29" x2="23" y2="29" /><line x1="11" y1="33" x2="37" y2="33" />
            <text class="bang" x="31" y="29">!</text>
          </g>
        }
        @case ('sirene') {
          <g class="beams"><path d="M24 20 L4 8 L4 16 Z" /><path d="M24 20 L44 8 L44 16 Z" /></g>
          <path class="dome" d="M14 34 v-8 a10 10 0 0 1 20 0 v8 z" />
          <rect class="base" x="10" y="34" width="28" height="6" rx="2" />
        }
        @case ('parti') {
          <line class="pole" x1="12" y1="6" x2="12" y2="44" />
          <path class="flag" d="M12 8 C20 4 26 12 38 8 L38 24 C26 28 20 20 12 24 Z" />
        }
        @case ('epees') {
          <g class="sword l"><line x1="10" y1="40" x2="36" y2="10" /><line class="guard" x1="14" y1="30" x2="20" y2="36" /></g>
          <g class="sword r"><line x1="38" y1="40" x2="12" y2="10" /><line class="guard" x1="34" y1="30" x2="28" y2="36" /></g>
          <circle class="spark" cx="24" cy="24" r="3" />
        }
        @case ('poignee') {
          <rect class="hand l" x="4" y="20" width="22" height="10" rx="5" />
          <rect class="hand r" x="22" y="20" width="22" height="10" rx="5" />
        }
        @case ('trophee') {
          <g class="cup">
            <path d="M15 8 h18 v8 a9 9 0 0 1 -18 0 z" />
            <path class="ears" d="M15 11 h-5 a5 5 0 0 0 5 7 M33 11 h5 a5 5 0 0 1 -5 7" />
            <line x1="24" y1="25" x2="24" y2="33" /><rect x="16" y="33" width="16" height="6" rx="1" />
          </g>
          <path class="shine" d="M38 4 l1.5 3.5 l3.5 1.5 l-3.5 1.5 l-1.5 3.5 l-1.5 -3.5 l-3.5 -1.5 l3.5 -1.5 z" />
        }
        @case ('eclair') {
          <circle class="halo" cx="24" cy="24" r="18" />
          <path class="bolt" d="M27 4 L13 27 h10 l-3 17 l15 -25 h-10 z" />
        }
        @case ('pieces') {
          <ellipse class="coin c1" cx="16" cy="40" rx="9" ry="3.5" />
          <ellipse class="coin c2" cx="30" cy="36" rx="9" ry="3.5" />
          <ellipse class="coin c3" cx="24" cy="12" rx="9" ry="3.5" />
          <ellipse class="coin c4" cx="34" cy="8" rx="7" ry="3" />
        }
        @default {
          <g class="bell"><path d="M14 32 v-10 a10 10 0 0 1 20 0 v10 l3 4 h-26 z" /><circle cx="24" cy="40" r="3" /></g>
        }
      }
    </svg>
  `,
  styles: `
    :host { display: inline-flex; width: 44px; height: 44px; flex-shrink: 0; }
    svg { width: 100%; height: 100%; overflow: visible; fill: none; stroke: var(--ink); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    /* Loupe d'espion qui balaie, œil qui cligne */
    .espion .loupe { stroke-width: 2.6; animation: sweep 2.4s ease-in-out infinite; }
    .espion .manche { stroke-width: 4; }
    .espion .oeil { fill: var(--ink); stroke: none; transform-origin: 20px 20px; animation: sweep 2.4s ease-in-out infinite, wink 2.4s ease-in-out infinite; }
    @keyframes sweep { 0%, 100% { transform: translate(-3px, 0); } 50% { transform: translate(5px, 3px); } }
    @keyframes wink { 0%, 44%, 52%, 100% { r: 3.5; } 48% { r: .6; } }
    /* Télévision : l'écran grésille, l'antenne vibre */
    .tv .screen { fill: var(--accent-soft); stroke: none; animation: flicker 1.8s steps(2) infinite; }
    .tv .scan { stroke: var(--accent); stroke-width: 1.5; animation: scan 1.6s linear infinite; }
    .tv .antenna { transform-origin: 24px 12px; animation: wiggle 1.2s ease-in-out infinite; }
    /* Journal : arrive en tournoyant, le point d'exclamation clignote */
    .journal .spin { transform-origin: 24px 24px; animation: spin-in .7s cubic-bezier(.2,.8,.3,1.3) both; }
    .journal .paper { fill: var(--surface); }
    .journal .head { stroke-width: 3.5; }
    .journal .bang { fill: var(--bad); stroke: none; font: 900 16px var(--font-display); animation: blink .8s steps(2) infinite; }
    /* Sirène : gyrophare */
    .sirene .dome { fill: var(--bad); stroke: var(--bad); }
    .sirene .beams path { fill: var(--bad); stroke: none; opacity: .35; transform-origin: 24px 20px; animation: beam 1s ease-in-out infinite alternate; }
    /* Drapeau du parti qui flotte */
    .parti .flag { fill: var(--accent); stroke: var(--accent); transform-origin: 12px 16px; animation: wave 1.6s ease-in-out infinite; }
    /* Épées qui s'entrechoquent */
    .epees .sword.l { transform-origin: 10px 40px; animation: clash-l 1.6s ease-in-out infinite; }
    .epees .sword.r { transform-origin: 38px 40px; animation: clash-r 1.6s ease-in-out infinite; }
    .epees .guard { stroke-width: 3.5; }
    .epees .spark { fill: var(--warn); stroke: none; transform-origin: 24px 24px; animation: spark 1.6s ease-in-out infinite; }
    /* Poignée de main */
    .poignee .hand { fill: var(--warn-soft); }
    .poignee .hand.l { animation: shake-l 1.2s ease-in-out infinite; }
    .poignee .hand.r { animation: shake-r 1.2s ease-in-out infinite; }
    /* Trophée qui rebondit, étoile qui scintille */
    .trophee .cup { fill: var(--warn-soft); stroke: var(--warn); animation: bounce 1.4s cubic-bezier(.3,1.6,.5,1) infinite; }
    .trophee .shine { fill: var(--warn); stroke: none; transform-origin: 38px 9px; animation: twinkle 1.4s ease-in-out infinite; }
    /* Éclair */
    .eclair .bolt { fill: var(--warn); stroke: var(--warn); animation: flash 2s ease-in-out infinite; }
    .eclair .halo { stroke: var(--warn); stroke-width: 1.5; opacity: 0; transform-origin: 24px 24px; animation: halo 2s ease-out infinite; }
    /* Pièces qui tombent */
    .pieces .coin { fill: var(--warn); stroke: #8a6a1f; stroke-width: 1.5; }
    .pieces .c3 { animation: fall 1.4s ease-in infinite; }
    .pieces .c4 { animation: fall 1.4s .5s ease-in infinite; }
    /* Soucoupe qui plane, rayon tracteur */
    .ovni .disc { fill: #9fb3c8; stroke: #44566b; }
    .ovni .dome { fill: #bfe6d8; stroke: #44566b; }
    .ovni .saucer { animation: hover-ufo 2.2s ease-in-out infinite; }
    .ovni .light { fill: #f4d27a; stroke: none; animation: blink 1s steps(2) infinite; }
    .ovni .l2 { animation-delay: .33s; } .ovni .l3 { animation-delay: .66s; }
    .ovni .tractor { fill: rgba(140, 220, 190, .35); stroke: none; animation: flicker 1.4s ease-in-out infinite; }
    .ovni .stars circle { fill: var(--ink-3); stroke: none; animation: blink 2s steps(2) infinite; }
    @keyframes hover-ufo { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
    /* Cloche */
    .cloche .bell { transform-origin: 24px 10px; animation: ring 1.6s ease-in-out infinite; }

    @keyframes flicker { 50% { opacity: .55; } }
    @keyframes scan { from { transform: translateY(0); } to { transform: translateY(13px); } }
    @keyframes wiggle { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
    @keyframes spin-in { from { transform: rotate(-540deg) scale(0); opacity: 0; } }
    @keyframes blink { 50% { opacity: .2; } }
    @keyframes beam { from { transform: rotate(-18deg); opacity: .15; } to { transform: rotate(18deg); opacity: .5; } }
    @keyframes wave { 0%, 100% { transform: skewY(0) scaleX(1); } 50% { transform: skewY(-6deg) scaleX(.94); } }
    @keyframes clash-l { 0%, 100% { transform: rotate(-14deg); } 45%, 55% { transform: rotate(0); } }
    @keyframes clash-r { 0%, 100% { transform: rotate(14deg); } 45%, 55% { transform: rotate(0); } }
    @keyframes spark { 0%, 40%, 60%, 100% { transform: scale(0); } 50% { transform: scale(1.8); } }
    @keyframes shake-l { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(2px, -4px); } }
    @keyframes shake-r { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-2px, -4px); } }
    @keyframes bounce { 0%, 100% { transform: translateY(0); } 30% { transform: translateY(-5px); } }
    @keyframes twinkle { 0%, 100% { transform: scale(.4) rotate(0); opacity: .4; } 50% { transform: scale(1.2) rotate(45deg); opacity: 1; } }
    @keyframes flash { 0%, 70%, 100% { opacity: 1; } 75%, 85% { opacity: .2; } 80%, 90% { opacity: 1; } }
    @keyframes halo { 0%, 70% { opacity: 0; transform: scale(.6); } 80% { opacity: .8; } 100% { opacity: 0; transform: scale(1.2); } }
    @keyframes fall { from { transform: translateY(-8px); opacity: 0; } 20% { opacity: 1; } to { transform: translateY(24px); opacity: 0; } }
    @keyframes ring { 0%, 50%, 100% { transform: rotate(0); } 10%, 30% { transform: rotate(14deg); } 20%, 40% { transform: rotate(-14deg); } }
    @media (prefers-reduced-motion: reduce) { svg * { animation: none !important; } }
  `,
})
export class EmblemComponent {
  readonly decision = input.required<Decision>();
  protected readonly kind = computed(() => emblemFor(this.decision()));
}

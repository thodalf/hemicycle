import { Component, inject } from '@angular/core';
import { FxService } from '../../services/fx.service';

/** Calque d'effets 2D, au-dessus de tout, sans capter les clics */
@Component({
  selector: 'app-fx-layer',
  template: `
    @for (i of fx.items(); track i.id) {
      @switch (i.kind) {
        @case ('float') {
          <span class="float" [class]="'t-' + i.tone" [style.left.px]="i.x" [style.top.px]="i.y" [style.animation-delay.ms]="i.delay">{{ i.text }}</span>
        }
        @case ('burst') {
          <span class="burst" [style.left.px]="i.x" [style.top.px]="i.y">
            @for (p of i.parts; track $index) {
              <i [class]="p.shape" [style.--dx.px]="p.dx" [style.--dy.px]="p.dy" [style.--rot.deg]="p.rot"
                 [style.background]="p.shape === 'star' ? 'none' : p.color" [style.color]="p.color" [style.animation-delay.ms]="p.delay">{{ p.shape === 'star' ? '★' : '' }}</i>
            }
          </span>
        }
        @case ('fly') {
          <span class="fly" [style.left.px]="i.x" [style.top.px]="i.y" [style.--dx.px]="i.dx" [style.--dy.px]="i.dy">{{ i.text }}</span>
        }
        @case ('stamp') {
          <span class="stamp" [class]="'t-' + i.tone" [style.left.px]="i.x" [style.top.px]="i.y">
            <strong>{{ i.text }}</strong>@if (i.sub) { <small>{{ i.sub }}</small> }
          </span>
        }
        @case ('ticker') {
          <div class="ticker"><span class="tag">Flash info</span><span class="scroll"><span>{{ i.text }}</span></span></div>
        }
        @case ('coin') {
          <span class="coin" [class.lost]="i.tone === 'bad'" [style.left.px]="i.x" [style.top.px]="i.y" [style.--dx.px]="i.dx" [style.--dy.px]="i.dy" [style.animation-delay.ms]="i.delay">€</span>
        }
        @case ('month') {
          <span class="week month" [style.left.px]="i.x" [style.top.px]="i.y">
            <span class="page old"><b>{{ i.old }}</b></span>
            <span class="page new"><span class="ico">{{ i.icon }}</span><b>{{ i.text }}</b><em>{{ i.sub }}</em></span>
          </span>
        }
        @case ('note') {
          <span class="note" [style.left.px]="i.x" [style.top.px]="i.y" [style.--dx.px]="i.dx" [style.--dy.px]="i.dy" [style.animation-delay.ms]="i.delay">€</span>
        }
        @case ('rocket') {
          <span class="rocket" [style.left.px]="i.x" [style.top.px]="i.y" [style.--dy.px]="i.dy" [style.animation-delay.ms]="i.delay"></span>
        }
        @case ('banner') {
          <span class="banner" [style.left.px]="i.x" [style.top.px]="i.y" [style.animation-delay.ms]="i.delay">
            <strong>{{ i.text }}</strong><small>{{ i.sub }}</small>
          </span>
        }
        @case ('flash') {
          <span class="flash" [class]="'t-' + i.tone"></span>
        }
        @case ('front') {
          <span class="front" [class]="'t-' + i.tone" [style.top.px]="i.y">
            <span class="chevrons">@for (c of chevrons; track $index) { <i>{{ i.tone === 'good' ? '›' : '‹' }}</i> }</span>
            <strong>{{ i.text }}</strong>
          </span>
        }
      }
    }
  `,
  styles: `
    :host { position: fixed; inset: 0; pointer-events: none; z-index: 60; overflow: hidden; }
    .float { position: absolute; transform: translate(-50%, -50%); font: 700 15px/1 var(--font-mono); padding: 3px 7px; border-radius: 999px;
      background: var(--surface); box-shadow: var(--shadow); opacity: 0; animation: float-up 1.5s cubic-bezier(.2,.7,.3,1) forwards; white-space: nowrap; }
    .float.t-good { color: var(--good); } .float.t-bad { color: var(--bad); } .float.t-neutral { color: var(--accent); }
    @keyframes float-up {
      0% { opacity: 0; transform: translate(-50%, -30%) scale(.6); }
      15% { opacity: 1; transform: translate(-50%, -60%) scale(1.15); }
      30% { transform: translate(-50%, -80%) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -260%) scale(.95); }
    }
    .burst { position: absolute; width: 0; height: 0; }
    .burst i { position: absolute; left: -4px; top: -4px; width: 8px; height: 8px; opacity: 0; font-style: normal; font-size: 13px; line-height: 8px;
      animation: burst .95s cubic-bezier(.15,.7,.3,1) forwards; }
    .burst i.dot { border-radius: 50%; }
    .burst i.square { width: 7px; height: 10px; border-radius: 1px; }
    @keyframes burst {
      0% { opacity: 1; transform: translate(0, 0) rotate(0) scale(.4); }
      70% { opacity: 1; }
      100% { opacity: 0; transform: translate(var(--dx), calc(var(--dy) + 40px)) rotate(var(--rot)) scale(1); }
    }
    .fly { position: absolute; transform: translate(-50%, -50%); padding: 4px 9px; border-radius: 999px; background: var(--accent); color: var(--surface);
      font: 600 12px/1 var(--font-body); box-shadow: var(--shadow); animation: fly .7s cubic-bezier(.5,0,.3,1) forwards; }
    @keyframes fly {
      0% { transform: translate(-50%, -50%) scale(.6); opacity: .2; }
      20% { transform: translate(-50%, -90%) scale(1.1); opacity: 1; }
      100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.5); opacity: .3; }
    }
    .stamp { position: absolute; transform: translate(-50%, -50%) rotate(-8deg); display: grid; justify-items: center; gap: 2px;
      padding: 10px 26px; border: 4px solid currentColor; border-radius: 10px; background: color-mix(in srgb, var(--surface) 88%, transparent);
      font-family: var(--font-display); text-transform: uppercase; letter-spacing: .06em; animation: stamp 1.45s ease forwards;
      strong { font-size: 34px; line-height: 1; } small { font: 500 12px var(--font-body); text-transform: none; letter-spacing: 0; color: var(--ink-2); } }
    .stamp.t-good { color: var(--good); } .stamp.t-bad { color: var(--bad); } .stamp.t-neutral { color: var(--accent); }
    @keyframes stamp {
      0% { opacity: 0; transform: translate(-50%, -50%) rotate(-8deg) scale(2.6); }
      14% { opacity: 1; transform: translate(-50%, -50%) rotate(-8deg) scale(.92); }
      22% { transform: translate(-50%, -50%) rotate(-8deg) scale(1.04); }
      30%, 78% { opacity: 1; transform: translate(-50%, -50%) rotate(-8deg) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -50%) rotate(-8deg) scale(1); }
    }
    .ticker { position: absolute; left: 0; right: 0; top: 52px; height: 34px; display: flex; align-items: stretch; background: #b8402b; color: #fff;
      box-shadow: 0 6px 18px -6px rgba(0,0,0,.4); animation: ticker-life 5.1s ease forwards; overflow: hidden;
      .tag { display: grid; place-items: center; padding: 0 14px; background: #1b2130; font: 700 12px var(--font-body); text-transform: uppercase; letter-spacing: .1em;
        position: relative; z-index: 1; animation: tag-blink .8s steps(2) 3; }
      .scroll { flex: 1; overflow: hidden; display: flex; align-items: center; }
      .scroll span { white-space: nowrap; font: 600 14px var(--font-body); padding-left: 100%; animation: ticker-run 5s linear forwards; } }
    @keyframes ticker-life { 0% { transform: translateY(-100%); } 6%, 92% { transform: translateY(0); } 100% { transform: translateY(-100%); } }
    @keyframes ticker-run { to { transform: translateX(-100%); } }
    @keyframes tag-blink { 50% { background: #fff; color: #b8402b; } }
    .coin { position: absolute; width: 20px; height: 20px; margin: -10px 0 0 -10px; border-radius: 50%; display: grid; place-items: center;
      background: radial-gradient(circle at 35% 30%, #fbe3a1, #e6b45c 55%, #a77a1c); color: #6b4a07; font: 800 11px var(--font-body);
      box-shadow: 0 2px 4px rgba(0,0,0,.25); opacity: 0; animation: coin-in .85s cubic-bezier(.5,0,.3,1) forwards; }
    .coin.lost { animation-name: coin-out; }
    @keyframes coin-in {
      0% { opacity: 0; transform: translate(0, 0) scale(.4) rotateY(0); }
      15% { opacity: 1; transform: translate(0, -30px) scale(1) rotateY(180deg); }
      100% { opacity: .9; transform: translate(var(--dx), var(--dy)) scale(.6) rotateY(720deg); }
    }
    @keyframes coin-out {
      0% { opacity: 1; transform: translate(0, 0) scale(.9); }
      30% { transform: translate(calc(var(--dx) * .3), -20px) rotate(90deg); }
      100% { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(400deg) scale(.7); }
    }
    .month .page b { font-size: 26px; text-transform: capitalize; }
    .month .page .ico { font-size: 18px; line-height: 1; margin-bottom: 2px; }
    .month { width: 132px; }
    .note { position: absolute; width: 30px; height: 16px; margin: -8px 0 0 -15px; border-radius: 3px; display: grid; place-items: center;
      background: linear-gradient(135deg, #9fd3b0, #5fa77a); color: #1d4d31; font: 800 10px var(--font-body); border: 1px solid #3f7d57;
      box-shadow: 0 2px 4px rgba(0,0,0,.25); opacity: 0; animation: note-in 1s cubic-bezier(.4,0,.3,1) forwards; }
    @keyframes note-in {
      0% { opacity: 0; transform: translate(0, 0) rotate(-20deg) scale(.5); }
      20% { opacity: 1; transform: translate(10px, -40px) rotate(15deg) scale(1.1); }
      60% { transform: translate(calc(var(--dx) * .6), calc(var(--dy) * .6 - 30px)) rotate(-10deg) scale(.9); }
      100% { opacity: .8; transform: translate(var(--dx), var(--dy)) rotate(0) scale(.5); }
    }
    .rocket { position: absolute; width: 4px; height: 14px; margin-left: -2px; border-radius: 2px; opacity: 0;
      background: linear-gradient(#fff6c8, #e6b45c); box-shadow: 0 6px 10px #e6b45c; animation: rocket .85s cubic-bezier(.2,.6,.4,1) forwards; }
    @keyframes rocket { 0% { opacity: 1; transform: translateY(0); } 90% { opacity: 1; } 100% { opacity: 0; transform: translateY(var(--dy)); } }
    .banner { position: absolute; transform: translate(-50%, -50%); display: grid; justify-items: center; gap: 4px; padding: 14px 30px;
      border-radius: 14px; background: color-mix(in srgb, var(--surface) 92%, transparent); box-shadow: 0 14px 40px -12px rgba(0,0,0,.45);
      border: 2px solid #e6b45c; opacity: 0; animation: banner 2.4s ease forwards;
      strong { font: 700 30px/1.1 var(--font-display); color: #a77a1c; } small { font-size: 12.5px; color: var(--ink-2); } }
    @keyframes banner {
      0% { opacity: 0; transform: translate(-50%, -50%) scale(.6); }
      15% { opacity: 1; transform: translate(-50%, -50%) scale(1.06); }
      25%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -60%) scale(.98); }
    }
    .flash { position: absolute; inset: 0; opacity: 0; animation: flash .85s ease-out forwards; }
    .flash.t-bad { background: radial-gradient(circle at 50% 40%, rgba(255,255,255,.9), rgba(184,64,43,.55) 60%, rgba(60,10,10,.5)); }
    .flash.t-good { background: radial-gradient(circle at 50% 40%, rgba(255,255,255,.9), rgba(47,125,79,.4) 60%, transparent); }
    .flash.t-neutral { background: rgba(255,255,255,.8); }
    @keyframes flash { 0% { opacity: 0; } 8% { opacity: 1; } 30% { opacity: .5; } 45% { opacity: .8; } 100% { opacity: 0; } }
    .front { position: absolute; left: 0; right: 0; height: 64px; margin-top: -32px; display: grid; place-items: center; overflow: hidden;
      animation: front-life 1.8s ease forwards;
      strong { position: relative; font: 700 20px var(--font-display); padding: 4px 16px; border-radius: 999px; background: var(--surface); box-shadow: var(--shadow); } }
    .front.t-good { background: linear-gradient(90deg, transparent, rgba(47,125,79,.28), transparent); strong { color: var(--good); } }
    .front.t-bad { background: linear-gradient(90deg, transparent, rgba(184,64,43,.28), transparent); strong { color: var(--bad); } }
    .chevrons { position: absolute; inset: 0; display: flex; align-items: center; gap: 22px; white-space: nowrap; font: 800 46px/1 var(--font-display); opacity: .55; }
    .front.t-good .chevrons { color: var(--good); animation: march-right 1.8s linear forwards; }
    .front.t-bad .chevrons { color: var(--bad); animation: march-left 1.8s linear forwards; }
    .chevrons i { font-style: normal; }
    @keyframes march-right { from { transform: translateX(-30%); } to { transform: translateX(10%); } }
    @keyframes march-left { from { transform: translateX(10%); } to { transform: translateX(-30%); } }
    @keyframes front-life { 0% { opacity: 0; transform: scaleY(.2); } 12%, 82% { opacity: 1; transform: scaleY(1); } 100% { opacity: 0; } }
    .week { position: absolute; transform: translateX(-50%); width: 110px; height: 104px; perspective: 500px; animation: week-life 1.7s ease forwards; }
    .page { position: absolute; inset: 0; display: grid; place-items: center; align-content: center; gap: 0; border-radius: 10px; background: var(--surface);
      border: 1px solid var(--line); box-shadow: 0 10px 30px -10px rgba(0,0,0,.4); border-top: 14px solid var(--bad); backface-visibility: hidden;
      b { font: 700 40px/1 var(--font-display); } small { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--ink-3); }
      em { font-style: normal; font-size: 11px; color: var(--ink-2); } }
    .page.old { transform-origin: top center; animation: page-flip .7s .25s ease-in forwards; z-index: 1; }
    @keyframes page-flip { to { transform: rotateX(-110deg) translateY(-10px); opacity: 0; } }
    @keyframes week-life {
      0% { opacity: 0; transform: translate(-50%, -30px); }
      12%, 80% { opacity: 1; transform: translate(-50%, 0); }
      100% { opacity: 0; transform: translate(-50%, -20px); }
    }
  `,
})
export class FxLayerComponent {
  protected readonly fx = inject(FxService);
  protected readonly chevrons = Array.from({ length: 40 });
}

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
        @case ('tomato') {
          <span class="tomato" [style.left.px]="i.x" [style.top.px]="i.y" [style.--dx.px]="i.dx" [style.--dy.px]="i.dy" [style.animation-delay.ms]="i.delay">🍅</span>
        }
        @case ('paper') {
          <span class="paper" [style.left.px]="i.x" [style.top.px]="i.y">
            <small class="mast">LE COURRIER NATIONAL · {{ i.sub }}</small>
            <strong>{{ i.text }}</strong>
            <span class="cols"><i></i><i></i><i></i></span>
          </span>
        }
        @case ('plane') {
          <span class="plane" [style.left.px]="i.x" [style.top.px]="i.y" [style.--dx.px]="i.dx">
            <span class="trail"></span><span class="jet">✈️</span>@if (i.text) { <small>{{ i.text }}</small> }
          </span>
        }
        @case ('ufo') {
          <span class="ufo" [style.left.px]="i.x" [style.top.px]="i.y" [style.--dx.px]="i.dx">
            <span class="saucer"><span class="dome"></span><span class="disc"></span><span class="lt"><b></b><b></b><b></b><b></b></span></span>
            <span class="ray"></span>
            @if (i.text) { <small>{{ i.text }}</small> }
          </span>
        }
        @case ('heart') {
          <span class="heart" [style.left.px]="i.x" [style.top.px]="i.y">
            <b>❤</b>
            <svg viewBox="0 0 200 40" class="ecg"><polyline points="0,20 50,20 60,8 70,32 80,4 90,36 100,20 200,20" /></svg>
          </span>
        }
        @case ('spot') {
          <span class="spot">
            <i class="beam l"></i><i class="beam r"></i>
            <span class="spot-text" [style.left.px]="i.x" [style.top.px]="i.y"><strong>{{ i.text }}</strong>@if (i.sub) { <small>{{ i.sub }}</small> }</span>
          </span>
        }
        @case ('ballot') {
          <span class="ballot" [style.left.px]="i.x" [style.top.px]="i.y">
            <span class="sheet-b">✓</span><span class="urn"><i></i></span><small>{{ i.text }}</small>
          </span>
        }
        @case ('mic') {
          <span class="mic" [style.left.px]="i.x" [style.top.px]="i.y"><b>🎙️</b><i></i><i></i><i></i></span>
        }
        @case ('rain') {
          <span class="rain" [class.snow]="i.tone === 'neutral'">@for (d of drops; track $index) { <i [style.left.%]="d.x" [style.animation-delay.ms]="d.delay" [style.animation-duration.ms]="d.dur"></i> }</span>
        }
        @case ('note') {
          <span class="note" [style.left.px]="i.x" [style.top.px]="i.y" [style.--dx.px]="i.dx" [style.--dy.px]="i.dy" [style.animation-delay.ms]="i.delay">€</span>
        }
        @case ('scen') {
          <span class="scen" [style.left.px]="i.x" [style.top.px]="i.y">
            <i class="rays"></i><b class="ico">{{ i.icon }}</b>
            <small>{{ i.sub }}</small><strong>{{ i.text }}</strong>
          </span>
        }
        @case ('crown') {
          <span class="crown" [style.left.px]="i.x" [style.top.px]="i.y"><b>👑</b><i></i><i></i><i></i><i></i></span>
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
    .tomato { position: absolute; font-size: 30px; margin: -15px 0 0 -15px; opacity: 0; animation: tomato 1.2s cubic-bezier(.3,.1,.5,1) forwards; }
    @keyframes tomato {
      0% { opacity: 1; transform: translate(0, 0) rotate(0); }
      70% { opacity: 1; transform: translate(var(--dx), var(--dy)) rotate(540deg) scale(1); }
      78% { transform: translate(var(--dx), var(--dy)) scale(1.8, .5); }
      100% { opacity: 0; transform: translate(var(--dx), calc(var(--dy) + 30px)) scale(1.8, .4); }
    }
    .paper { position: absolute; width: 320px; max-width: 86vw; padding: 14px 16px 16px; background: #f7f3e8; color: #1d1d1d; border: 1px solid #c9c1ad;
      box-shadow: 0 20px 50px -18px rgba(0,0,0,.6); display: grid; gap: 8px; animation: paper-spin 2.5s cubic-bezier(.2,.8,.3,1) forwards;
      .mast { font: 700 10px var(--font-body); letter-spacing: .12em; border-bottom: 2px solid #1d1d1d; padding-bottom: 4px; }
      strong { font: 800 24px/1.1 var(--font-display); text-transform: uppercase; }
      .cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; i { height: 34px; background: repeating-linear-gradient(#bdb6a3 0 2px, transparent 2px 6px); } } }
    @keyframes paper-spin {
      0% { opacity: 0; transform: translate(-50%, -50%) rotate(-720deg) scale(.05); }
      40% { opacity: 1; transform: translate(-50%, -50%) rotate(-6deg) scale(1.05); }
      48%, 85% { transform: translate(-50%, -50%) rotate(-4deg) scale(1); opacity: 1; }
      100% { opacity: 0; transform: translate(-50%, -40%) rotate(-4deg) scale(.96); }
    }
    .plane { position: absolute; display: flex; align-items: center; gap: 6px; animation: plane 2.3s cubic-bezier(.4,0,.6,1) forwards;
      .jet { font-size: 34px; display: inline-block; transform: rotate(45deg); }
      .trail { width: 140px; height: 3px; border-radius: 2px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.95)); box-shadow: 0 0 6px rgba(80,90,110,.3); }
      small { font: 600 12px var(--font-body); padding: 2px 8px; border-radius: 999px; background: var(--surface); box-shadow: var(--shadow); } }
    @keyframes plane { from { transform: translate(0, 30px); } to { transform: translate(var(--dx), -30px); } }
    .ufo { position: absolute; display: grid; justify-items: center; animation: ufo 3.3s cubic-bezier(.45,0,.55,1) forwards;
      .saucer { position: relative; width: 96px; height: 44px; animation: wob .7s ease-in-out infinite; }
      .dome { position: absolute; left: 30px; width: 36px; top: 0; height: 24px; border-radius: 18px 18px 6px 6px; background: linear-gradient(#e2fff3, #6cc4a8); }
      .disc { position: absolute; left: 0; right: 0; top: 16px; height: 22px; border-radius: 50%; background: linear-gradient(#d4e0ec, #5f758c); box-shadow: 0 0 22px rgba(140,240,200,.8); }
      .lt { position: absolute; left: 10px; right: 10px; top: 24px; display: flex; justify-content: space-between;
        b { width: 7px; height: 7px; border-radius: 50%; background: #ffd36b; box-shadow: 0 0 6px #ffd36b; animation: lb .5s steps(2) infinite; }
        b:nth-child(even) { animation-delay: .25s; } }
      .ray { width: 120px; height: 0; margin-top: -4px; background: linear-gradient(rgba(150,255,210,.75), rgba(150,255,210,0));
        clip-path: polygon(30% 0, 70% 0, 100% 100%, 0 100%); animation: ray 3.3s ease forwards; }
      small { margin-top: 6px; font: 600 12px var(--font-body); padding: 2px 10px; border-radius: 999px; background: #0b1022; color: #d9fff1; box-shadow: var(--shadow); } }
    @keyframes ufo { 0% { transform: translate(0, -40px); } 38%, 70% { transform: translate(calc(var(--dx) / 2), 0); } 100% { transform: translate(var(--dx), -90px); } }
    @keyframes wob { 50% { transform: translateY(-4px) rotate(-3deg); } }
    @keyframes lb { 50% { opacity: .2; } }
    @keyframes ray { 0%, 36% { height: 0; } 46%, 66% { height: 220px; } 76%, 100% { height: 0; } }
    .heart { position: absolute; transform: translate(-50%, -50%); display: grid; justify-items: center; gap: 4px; animation: heart-life 1.9s ease forwards;
      b { font-size: 64px; color: #c0392b; line-height: 1; animation: beat .6s ease-in-out 3; }
      .ecg { width: 200px; height: 40px; polyline { fill: none; stroke: #c0392b; stroke-width: 3; stroke-dasharray: 320; stroke-dashoffset: 320; animation: ecg 1.2s linear forwards; } } }
    @keyframes beat { 0%, 100% { transform: scale(1); } 15% { transform: scale(1.25); } 30% { transform: scale(.95); } 45% { transform: scale(1.15); } }
    @keyframes ecg { to { stroke-dashoffset: 0; } }
    @keyframes heart-life { 0% { opacity: 0; } 10%, 80% { opacity: 1; } 100% { opacity: 0; } }
    .scen { position: absolute; transform: translate(-50%, -50%); display: grid; justify-items: center; gap: 2px; text-align: center; animation: scen-life 2.6s ease forwards;
      .rays { position: absolute; left: 50%; top: 46px; width: 260px; height: 260px; margin: -130px 0 0 -130px; border-radius: 50%; z-index: -1;
        background: repeating-conic-gradient(rgba(230,180,92,.35) 0 10deg, rgba(230,180,92,0) 10deg 24deg); mask: radial-gradient(circle, #000 20%, transparent 70%);
        animation: rays 2.6s linear forwards; }
      .ico { font-size: 76px; line-height: 92px; filter: drop-shadow(0 8px 18px rgba(0,0,0,.3)); animation: scen-ico 2.6s cubic-bezier(.2,1.4,.4,1) forwards; }
      small { font: 700 12px var(--font-mono); letter-spacing: .14em; text-transform: uppercase; color: var(--accent); background: var(--surface); padding: 3px 10px; border-radius: 999px; box-shadow: var(--shadow); }
      strong { font: 800 26px var(--font-display); color: var(--ink); background: var(--surface); padding: 4px 14px; border-radius: 10px; box-shadow: var(--shadow); max-width: 86vw; } }
    @keyframes scen-life { 0% { opacity: 0; } 10%, 82% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -60%); } }
    @keyframes scen-ico { 0% { transform: scale(.2) rotate(-25deg); } 30% { transform: scale(1.15) rotate(6deg); } 45%, 100% { transform: scale(1) rotate(0); } }
    @keyframes rays { from { transform: rotate(0) scale(.6); } to { transform: rotate(80deg) scale(1.1); } }
    .crown { position: absolute; width: 0; height: 0;
      b { position: absolute; left: -16px; top: -60px; font-size: 30px; animation: crown-drop 1.4s cubic-bezier(.3,1.5,.5,1) forwards; }
      i { position: absolute; left: -3px; top: -30px; width: 6px; height: 6px; border-radius: 50%; background: #f5d27a; box-shadow: 0 0 8px #f5d27a; opacity: 0; animation: sparkle .9s .45s ease-out forwards; }
      i:nth-of-type(1) { --sx: -26px; --sy: -14px; } i:nth-of-type(2) { --sx: 26px; --sy: -14px; } i:nth-of-type(3) { --sx: -18px; --sy: 16px; } i:nth-of-type(4) { --sx: 18px; --sy: 16px; } }
    @keyframes crown-drop { 0% { opacity: 0; transform: translateY(-40px) rotate(-20deg); } 35% { opacity: 1; transform: translateY(14px) rotate(4deg); } 55% { transform: translateY(8px) rotate(0); } 85% { opacity: 1; } 100% { opacity: 0; transform: translateY(-6px); } }
    @keyframes sparkle { 0% { opacity: 1; transform: translate(0, 0) scale(.4); } 100% { opacity: 0; transform: translate(var(--sx), var(--sy)) scale(1.3); } }
    .spot { position: absolute; inset: 0; background: rgba(10,10,20,.35); animation: spot-life 2.3s ease forwards; }
    .beam { position: absolute; top: -10%; width: 34vw; height: 120%; background: linear-gradient(rgba(255,240,200,.55), rgba(255,240,200,0) 80%);
      clip-path: polygon(45% 0, 55% 0, 100% 100%, 0 100%); mix-blend-mode: screen; }
    .beam.l { left: 5%; transform-origin: 50% 0; animation: sweep-l 2.2s ease-in-out forwards; }
    .beam.r { right: 5%; transform-origin: 50% 0; animation: sweep-r 2.2s ease-in-out forwards; }
    @keyframes sweep-l { from { transform: rotate(-35deg); } to { transform: rotate(18deg); } }
    @keyframes sweep-r { from { transform: rotate(35deg); } to { transform: rotate(-18deg); } }
    .spot-text { position: absolute; transform: translate(-50%, -50%); display: grid; justify-items: center; gap: 4px; color: #fff8e1;
      text-shadow: 0 2px 18px rgba(255,210,120,.9); strong { font: 800 36px var(--font-display); } small { font: 500 14px var(--font-body); }
      animation: spot-text 2.2s ease forwards; }
    @keyframes spot-text { 0% { opacity: 0; transform: translate(-50%, -40%) scale(.9); } 25%, 80% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 100% { opacity: 0; } }
    @keyframes spot-life { 0% { opacity: 0; } 12%, 85% { opacity: 1; } 100% { opacity: 0; } }
    .ballot { position: absolute; transform: translate(-50%, -50%); width: 150px; height: 170px; padding: 10px; border-radius: 16px; background: var(--surface); box-shadow: 0 14px 40px -12px rgba(0,0,0,.45); animation: heart-life 1.9s ease forwards;
      .sheet-b { position: absolute; left: 50px; top: 12px; width: 50px; height: 34px; background: #fff; border: 1px solid #bbb; display: grid; place-items: center;
        color: var(--good); font-weight: 800; animation: drop 1s .2s cubic-bezier(.5,0,.7,1) forwards; z-index: 0; }
      .urn { position: absolute; left: 25px; bottom: 34px; width: 100px; height: 80px; border-radius: 6px; background: linear-gradient(135deg, rgba(220,230,245,.7), rgba(170,185,210,.55));
        border: 2px solid #8a9ab5; z-index: 1; i { position: absolute; left: 25px; top: -2px; width: 50px; height: 5px; background: #4a5263; border-radius: 3px; } }
      small { position: absolute; bottom: 8px; left: 0; right: 0; text-align: center; font: 700 15px var(--font-display); color: var(--ink); } }
    @keyframes drop { 0% { transform: translateY(0) rotate(-8deg); } 70% { transform: translateY(64px) rotate(0); } 100% { transform: translateY(64px); opacity: 0; } }
    .mic { position: absolute; transform: translate(-50%, -50%); b { font-size: 26px; position: relative; z-index: 1; }
      i { position: absolute; left: 50%; top: 50%; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%; border: 2px solid var(--accent);
        opacity: 0; animation: wave 1.2s ease-out forwards; }
      i:nth-of-type(2) { animation-delay: .2s; } i:nth-of-type(3) { animation-delay: .4s; } }
    @keyframes wave { 0% { opacity: .9; transform: scale(.5); } 100% { opacity: 0; transform: scale(3); } }
    .rain { position: absolute; inset: 0; animation: heart-life 2.6s ease forwards;
      i { position: absolute; top: -10%; width: 2px; height: 22px; background: linear-gradient(transparent, rgba(110,140,190,.75)); animation: fall linear infinite; } }
    .rain.snow i { width: 8px; height: 8px; border-radius: 50%; background: #fff; box-shadow: 0 0 2px 1px rgba(70,95,140,.55); }
    @keyframes fall { to { transform: translateY(115vh); } }
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
  /** Gouttes de pluie (ou flocons) : positions fixes, durées variées */
  protected readonly drops = Array.from({ length: 70 }, (_, i) => ({ x: (i * 37) % 100, delay: (i * 53) % 900, dur: 700 + ((i * 97) % 600) }));
}

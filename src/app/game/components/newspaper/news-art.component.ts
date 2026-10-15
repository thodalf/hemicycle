import { Component, computed, input } from '@angular/core';
import { ArtTheme } from '../../engine/newspaper';

type Bust = [number, number, number, number];

/**
 * Une photo de presse : scènes en perspective, arrière-plans flous (profondeur de champ),
 * éclairages, grain argentique et vignettage. Teinte selon le ton de l'article.
 */
@Component({
  selector: 'app-news-art',
  template: `
    <svg viewBox="0 0 320 200" role="img" [attr.aria-label]="label()" preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter [attr.id]="id('far')" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.6" /></filter>
        <filter [attr.id]="id('mid')" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.1" /></filter>
        <filter [attr.id]="id('soft')" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
        <filter [attr.id]="id('grain')" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" [attr.seed]="seedNum()" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer><feFuncA type="table" tableValues="0 .22" /></feComponentTransfer>
        </filter>
        <radialGradient [attr.id]="id('vig')" cx="50%" cy="48%" r="72%"><stop offset=".55" stop-color="#000" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity=".55" /></radialGradient>
        <linearGradient [attr.id]="id('sky')" x1="0" y1="0" x2="0" y2="1"><stop offset="0" [attr.stop-color]="night() ? p().k0 : p().k3" /><stop offset="1" [attr.stop-color]="night() ? p().k2 : p().k4" /></linearGradient>
        <linearGradient [attr.id]="id('wall')" x1="0" y1="0" x2="0" y2="1"><stop offset="0" [attr.stop-color]="p().k1" /><stop offset=".7" [attr.stop-color]="p().k2" /><stop offset="1" [attr.stop-color]="p().k1" /></linearGradient>
        <linearGradient [attr.id]="id('floor')" x1="0" y1="0" x2="0" y2="1"><stop offset="0" [attr.stop-color]="p().k2" /><stop offset="1" [attr.stop-color]="p().k0" /></linearGradient>
        <radialGradient [attr.id]="id('spot')" cx="50%" cy="0%" r="80%"><stop offset="0" [attr.stop-color]="p().k4" stop-opacity=".85" /><stop offset="1" [attr.stop-color]="p().k4" stop-opacity="0" /></radialGradient>
        <radialGradient [attr.id]="id('glow')" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".9" /><stop offset="1" stop-color="#fff" stop-opacity="0" /></radialGradient>
      </defs>

      <g class="kb" [class.kb-alt]="seedNum() % 2 === 1"><g [attr.transform]="mirror() ? 'translate(320 0) scale(-1 1)' : null">
      @switch (theme()) {
        @case ('hemicycle') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('wall') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'">
            @for (r of tiers; track $index) { <path [attr.d]="'M' + (160 - r[0]) + ' ' + r[1] + ' Q160 ' + (r[1] - r[2]) + ' ' + (160 + r[0]) + ' ' + r[1]" fill="none" [attr.stroke]="p().k1" [attr.stroke-width]="r[3]" /> }
            @for (h of farHeads; track $index) { <circle [attr.cx]="h[0]" [attr.cy]="h[1]" [attr.r]="h[2]" [attr.fill]="p().k0" opacity=".75" /> }
          </g>
          <rect x="0" y="0" width="320" height="200" [attr.fill]="'url(#' + id('spot') + ')'" opacity=".35" />
          <g [attr.filter]="'url(#' + id('mid') + ')'">
            <path d="M118 200 L128 132 L192 132 L202 200 Z" [attr.fill]="p().k1" />
            <rect x="122" y="124" width="76" height="12" rx="2" [attr.fill]="p().k3" />
            <path d="M150 124 L156 104 L164 104 L170 124 Z" [attr.fill]="p().k0" />
            <circle cx="160" cy="98" r="7" [attr.fill]="p().k0" />
          </g>
          @for (b of frontRow; track $index) { <path [attr.d]="bust(b)" [attr.fill]="p().k0" [attr.opacity]="b[3]" /> }
        }
        @case ('urne') {
          <rect width="320" height="200" [attr.fill]="p().k2" />
          <g [attr.filter]="'url(#' + id('far') + ')'">
            @for (x of [20, 90, 240]; track x) { <rect [attr.x]="x" y="20" width="56" height="150" [attr.fill]="p().k1" /> <path [attr.d]="'M' + x + ' 20 q14 70 4 150 M' + (x + 20) + ' 20 q-6 70 6 150 M' + (x + 40) + ' 20 q10 70 -2 150'" [attr.stroke]="p().k0" stroke-width="3" fill="none" opacity=".5" /> }
            <path d="M0 150 H320 V200 H0Z" [attr.fill]="p().k1" />
          </g>
          <rect x="100" y="96" width="120" height="96" rx="4" [attr.fill]="p().k4" opacity=".28" [attr.stroke]="p().k4" stroke-width="2" />
          <rect x="100" y="90" width="120" height="10" rx="2" [attr.fill]="p().k0" />
          <rect x="146" y="92" width="28" height="4" [attr.fill]="p().k4" />
          @for (e of envs; track $index) { <rect [attr.x]="e[0]" [attr.y]="e[1]" width="34" height="22" [attr.transform]="'rotate(' + e[2] + ' ' + (e[0] + 17) + ' ' + (e[1] + 11) + ')'" [attr.fill]="p().k3" opacity=".75" /> }
          <path d="M108 100 L112 186" [attr.stroke]="p().k4" stroke-width="3" opacity=".6" />
          <rect x="146" y="48" width="30" height="40" transform="rotate(-6 161 68)" [attr.fill]="p().k4" />
          <path d="M150 30 C170 24 196 26 214 40 L232 70 C226 76 214 74 206 66 L186 52 C180 50 176 54 176 60" [attr.fill]="p().k1" />
        }
        @case ('foule') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('sky') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'">
            <path d="M0 30 L70 22 L70 140 L0 140Z M250 22 L320 30 L320 140 L250 140Z" [attr.fill]="p().k2" />
            @for (w of windows; track $index) { <rect [attr.x]="w[0]" [attr.y]="w[1]" width="8" height="12" [attr.fill]="p().k1" /> }
            @for (h of farCrowd; track $index) { <circle [attr.cx]="h[0]" [attr.cy]="h[1]" [attr.r]="h[2]" [attr.fill]="p().k0" opacity=".7" /> }
            <rect x="100" y="70" width="120" height="26" [attr.fill]="p().k4" transform="rotate(-3 160 83)" />
            <path d="M110 80 H210 M110 88 H180" [attr.stroke]="p().k1" stroke-width="4" transform="rotate(-3 160 83)" />
          </g>
          <rect width="320" height="200" [attr.fill]="p().k4" opacity=".12" [attr.filter]="'url(#' + id('soft') + ')'" />
          <g [attr.filter]="'url(#' + id('mid') + ')'">@for (b of midCrowd; track $index) { <path [attr.d]="bust(b)" [attr.fill]="p().k1" [attr.opacity]="b[3]" /> }</g>
          <rect x="196" y="98" width="4" height="70" [attr.fill]="p().k0" />
          <path d="M200 100 C220 96 236 104 262 98 L262 130 C236 136 220 128 200 132Z" [attr.fill]="accent()" opacity=".9" />
          @for (b of frontCrowd; track $index) { <path [attr.d]="bust(b)" [attr.fill]="p().k0" [attr.opacity]="b[3]" /> }
        }
        @case ('courbe') {
          <rect width="320" height="200" [attr.fill]="p().k0" />
          <g [attr.filter]="'url(#' + id('mid') + ')'">
            @for (m of monitors; track $index) {
              <rect [attr.x]="m[0]" [attr.y]="m[1]" [attr.width]="m[2]" [attr.height]="m[3]" rx="2" [attr.fill]="p().k1" [attr.stroke]="p().k2" stroke-width="2" />
              <path [attr.d]="chart(m)" fill="none" [attr.stroke]="$index === 1 ? accent() : p().k4" stroke-width="2" />
            }
          </g>
          <ellipse cx="160" cy="80" rx="150" ry="70" [attr.fill]="p().k4" opacity=".08" [attr.filter]="'url(#' + id('soft') + ')'" />
          <path d="M0 200 L0 150 C30 120 70 118 92 140 C100 112 120 104 136 112 C146 92 176 92 184 116 C196 136 196 160 190 200Z" [attr.fill]="p().k0" />
          <circle cx="160" cy="104" r="20" [attr.fill]="p().k0" />
        }
        @case ('loupe') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('floor') + ')'" />
          <ellipse cx="170" cy="70" rx="160" ry="110" [attr.fill]="p().k4" opacity=".35" [attr.filter]="'url(#' + id('soft') + ')'" />
          <g [attr.filter]="'url(#' + id('mid') + ')'">
            <rect x="40" y="60" width="130" height="120" [attr.fill]="p().k3" transform="rotate(-10 105 120)" />
            <rect x="200" y="40" width="70" height="52" [attr.fill]="p().k2" transform="rotate(8 235 66)" />
          </g>
          <rect x="90" y="40" width="140" height="150" [attr.fill]="p().k4" transform="rotate(5 160 115)" />
          @for (l of lines; track l) { <rect [attr.x]="104" [attr.y]="58 + l * 11" [attr.width]="l % 4 === 3 ? 70 : 110" height="4" [attr.fill]="p().k1" opacity=".55" transform="rotate(5 160 115)" /> }
          <rect x="112" y="128" width="80" height="12" [attr.fill]="p().k0" transform="rotate(5 160 115)" />
          <text x="160" y="72" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="15" [attr.fill]="accent()" opacity=".85" transform="rotate(-8 160 70)" letter-spacing="2">CONFIDENTIEL</text>
          <circle cx="232" cy="138" r="30" fill="none" [attr.stroke]="p().k0" stroke-width="7" />
          <circle cx="232" cy="138" r="27" [attr.fill]="p().k4" opacity=".25" />
          <path d="M254 160 L292 196" [attr.stroke]="p().k0" stroke-width="12" stroke-linecap="round" />
        }
        @case ('drapeau') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('sky') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'">
            <path d="M0 120 L320 108 L320 200 L0 200Z" [attr.fill]="p().k2" />
            @for (s of soldiers; track $index) { <rect [attr.x]="s[0]" [attr.y]="s[1]" [attr.width]="s[2]" [attr.height]="s[2] * 3.4" [attr.rx]="s[2] / 3" [attr.fill]="p().k0" opacity=".8" /> <circle [attr.cx]="s[0] + s[2] / 2" [attr.cy]="s[1] - s[2] * .5" [attr.r]="s[2] * .55" [attr.fill]="p().k0" opacity=".8" /> }
          </g>
          <rect x="60" y="10" width="5" height="190" [attr.fill]="p().k0" />
          <path d="M65 16 C110 6 140 34 182 22 C222 12 248 36 286 26 L286 106 C248 116 222 92 182 102 C140 114 110 86 65 96Z" [attr.fill]="p().k3" />
          <path d="M65 16 C85 12 100 18 138 24 L138 104 C100 96 85 92 65 96Z" [attr.fill]="p().k1" />
          <path d="M214 16 C240 12 260 34 286 26 L286 106 C260 114 240 94 214 98Z" [attr.fill]="accent()" opacity=".85" />
          <path d="M95 30 C120 40 150 50 182 40 M120 70 C150 84 190 86 230 70" [attr.stroke]="p().k0" stroke-width="6" fill="none" opacity=".15" />
        }
        @case ('croix') {
          <rect width="320" height="200" [attr.fill]="p().k2" />
          <path d="M0 0 L130 70 L190 70 L320 0Z" [attr.fill]="p().k3" />
          <path d="M0 200 L130 120 L190 120 L320 200Z" [attr.fill]="'url(#' + id('floor') + ')'" />
          <path d="M0 0 L130 70 L130 120 L0 200Z M320 0 L190 70 L190 120 L320 200Z" [attr.fill]="p().k1" />
          @for (l of [0, 1, 2, 3]; track l) { <rect [attr.x]="146 - l * 34" [attr.y]="58 - l * 16" [attr.width]="28 + l * 68" height="4" [attr.fill]="'url(#' + id('glow') + ')'" /> }
          @for (d of [0, 1, 2]; track d) { <rect [attr.x]="104 - d * 34" [attr.y]="78 - d * 12" [attr.width]="10 + d * 4" [attr.height]="40 + d * 26" [attr.fill]="p().k0" opacity=".55" /> }
          <g [attr.filter]="'url(#' + id('mid') + ')'">
            <rect x="150" y="104" width="44" height="14" [attr.fill]="p().k4" /><path d="M150 118 v10 M194 118 v10" [attr.stroke]="p().k0" stroke-width="2" />
          </g>
          <path [attr.d]="bust([226, 120, 1.7, 1])" [attr.fill]="p().k0" />
          <rect x="207" y="150" width="38" height="50" [attr.fill]="p().k0" />
        }
        @case ('couronne') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('sky') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'">
            <rect x="30" y="40" width="260" height="120" [attr.fill]="p().k3" />
            <path d="M20 44 L160 10 L300 44Z" [attr.fill]="p().k2" />
            @for (c of columns; track c) { <rect [attr.x]="c" y="54" width="10" height="100" [attr.fill]="p().k4" /> <rect [attr.x]="c - 2" y="150" width="14" height="6" [attr.fill]="p().k2" /> }
            <rect x="130" y="96" width="60" height="6" [attr.fill]="p().k1" />
            @for (x of [148, 160, 172]; track x) { <circle [attr.cx]="x" cy="88" r="4" [attr.fill]="p().k0" /> }
          </g>
          <rect x="0" y="150" width="320" height="50" [attr.fill]="p().k2" />
          @for (b of frontCrowd; track $index) { <path [attr.d]="bust(b)" [attr.fill]="p().k0" [attr.opacity]="b[3]" /> }
          <path d="M260 120 L264 60 M264 60 C280 56 290 64 306 60 L306 82 C290 86 280 78 264 82" [attr.stroke]="p().k0" stroke-width="3" [attr.fill]="accent()" />
        }
        @case ('monument') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('sky') + ')'" />
          <circle cx="250" cy="70" r="40" [attr.fill]="p().k4" opacity=".7" [attr.filter]="'url(#' + id('soft') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'"><path d="M0 150 L40 138 L80 146 L120 132 L320 140 L320 160 L0 160Z" [attr.fill]="p().k2" /></g>
          <path d="M160 6 L156 50 L148 92 L134 130 L112 160 L130 160 Q160 130 190 160 L208 160 L186 130 L172 92 L164 50Z" [attr.fill]="p().k0" />
          @for (k of lattice; track k) { <path [attr.d]="'M' + (152 - k * 1.6) + ' ' + (60 + k * 9) + ' L' + (168 + k * 1.6) + ' ' + (68 + k * 9) + ' M' + (168 + k * 1.6) + ' ' + (60 + k * 9) + ' L' + (152 - k * 1.6) + ' ' + (68 + k * 9)" [attr.stroke]="p().k3" stroke-width=".8" opacity=".55" /> }
          <path d="M144 96 H176 M138 124 H182" [attr.stroke]="p().k3" stroke-width="2" opacity=".7" />
          <rect x="0" y="160" width="320" height="40" [attr.fill]="p().k1" />
          <path d="M150 162 L146 200 M170 162 L176 200" [attr.stroke]="p().k3" stroke-width="3" opacity=".35" [attr.filter]="'url(#' + id('mid') + ')'" />
          <path d="M0 176 Q80 172 160 178 T320 176" [attr.stroke]="p().k3" stroke-width="1.5" fill="none" opacity=".4" />
        }
        @case ('globe') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('wall') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'">
            @for (f of flags; track $index) { <rect [attr.x]="f" y="20" width="3" height="90" [attr.fill]="p().k0" /> <path [attr.d]="'M' + (f + 3) + ' 24 q12 6 22 0 v26 q-10 6 -22 0z'" [attr.fill]="$index === 2 ? accent() : p().k3" /> }
            <circle cx="160" cy="30" r="16" [attr.fill]="p().k4" opacity=".6" />
          </g>
          <path d="M20 130 L300 130 L320 170 L0 170Z" [attr.fill]="p().k3" />
          <path d="M0 170 H320 V200 H0Z" [attr.fill]="p().k1" />
          @for (b of tableBusts; track $index) { <path [attr.d]="bust(b)" [attr.fill]="p().k0" [attr.opacity]="b[3]" /> }
          @for (x of [70, 130, 190, 250]; track x) { <rect [attr.x]="x" y="122" width="16" height="10" [attr.fill]="p().k4" /> }
        }
        @case ('nature') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('sky') + ')'" />
          <circle cx="230" cy="60" r="34" [attr.fill]="p().k4" [attr.filter]="'url(#' + id('soft') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'"><path d="M0 120 Q60 96 120 110 T240 100 T320 108 V200 H0Z" [attr.fill]="p().k2" /></g>
          <g [attr.filter]="'url(#' + id('mid') + ')'"><path d="M0 146 Q80 120 160 138 T320 132 V200 H0Z" [attr.fill]="p().k1" /></g>
          @for (r of [0, 1, 2, 3, 4, 5]; track r) { <path [attr.d]="'M0 ' + (160 + r * 8) + ' Q160 ' + (150 + r * 8) + ' 320 ' + (162 + r * 8)" [attr.stroke]="p().k0" stroke-width="2" fill="none" opacity=".35" /> }
          @for (t of trees; track $index) { <path [attr.d]="tree(t)" [attr.fill]="p().k0" /> <rect [attr.x]="t[0] - 1" [attr.y]="t[1] + t[2] * 2.2" width="2" [attr.height]="t[2]" [attr.fill]="p().k0" /> }
        }
        @case ('tribunal') {
          <rect width="320" height="200" [attr.fill]="p().k1" />
          @for (x of panels; track x) { <rect [attr.x]="x" y="0" width="26" height="130" [attr.fill]="p().k2" opacity=".55" /> }
          <g [attr.filter]="'url(#' + id('far') + ')'">
            <rect x="60" y="70" width="200" height="40" [attr.fill]="p().k0" />
            @for (b of judges; track $index) { <path [attr.d]="bust(b)" [attr.fill]="p().k0" /> }
            <circle cx="160" cy="26" r="14" [attr.fill]="p().k3" opacity=".7" />
          </g>
          <rect x="0" y="110" width="320" height="90" [attr.fill]="'url(#' + id('floor') + ')'" />
          <rect x="0" y="0" width="320" height="200" [attr.fill]="'url(#' + id('spot') + ')'" opacity=".25" />
          <path [attr.d]="bust([90, 112, 2.3, 1])" [attr.fill]="p().k0" />
          <path d="M84 146 L96 146 L93 168 L87 168Z" [attr.fill]="p().k4" />
          <path [attr.d]="bust([250, 118, 2, 1])" [attr.fill]="p().k0" opacity=".9" />
        }
        @case ('ecole') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('wall') + ')'" />
          <rect x="70" y="26" width="180" height="70" [attr.fill]="p().k0" [attr.stroke]="p().k2" stroke-width="4" />
          @for (l of [0, 1, 2]; track l) { <path [attr.d]="'M' + (86) + ' ' + (44 + l * 16) + ' q' + (40 + l * 10) + ' -6 ' + (90 - l * 20) + ' 0'" [attr.stroke]="p().k4" stroke-width="2" fill="none" opacity=".8" /> }
          <g [attr.filter]="'url(#' + id('mid') + ')'">
            @for (dsk of desks; track $index) { <rect [attr.x]="dsk[0]" [attr.y]="dsk[1]" [attr.width]="dsk[2]" [attr.height]="dsk[2] * .3" [attr.fill]="p().k2" /> <circle [attr.cx]="dsk[0] + dsk[2] / 2" [attr.cy]="dsk[1] - dsk[2] * .25" [attr.r]="dsk[2] * .2" [attr.fill]="p().k0" /> }
          </g>
          <path [attr.d]="bust([268, 100, 2.1, 1])" [attr.fill]="p().k0" />
          <rect x="0" y="0" width="70" height="200" [attr.fill]="p().k4" opacity=".18" [attr.filter]="'url(#' + id('soft') + ')'" />
        }
        @case ('usine') {
          <rect width="320" height="200" [attr.fill]="p().k1" />
          @for (k of trusses; track k) { <path [attr.d]="'M' + k + ' 0 L' + (k + 40) + ' 40 L' + (k + 80) + ' 0'" [attr.stroke]="p().k2" stroke-width="3" fill="none" /> }
          <rect x="0" y="38" width="320" height="4" [attr.fill]="p().k2" />
          <g [attr.filter]="'url(#' + id('far') + ')'">
            <rect x="30" y="80" width="90" height="70" [attr.fill]="p().k0" /><rect x="190" y="70" width="110" height="80" [attr.fill]="p().k0" />
            <rect x="150" y="50" width="16" height="100" [attr.fill]="p().k0" />
          </g>
          <circle cx="156" cy="124" r="26" [attr.fill]="'url(#' + id('glow') + ')'" />
          @for (sp of sparks; track $index) { <path [attr.d]="'M156 124 l' + sp[0] + ' ' + sp[1]" [attr.stroke]="p().k4" stroke-width="1.2" opacity=".8" /> }
          <rect x="0" y="150" width="320" height="50" [attr.fill]="'url(#' + id('floor') + ')'" />
          @for (b of workers; track $index) { <path [attr.d]="bust(b)" [attr.fill]="p().k0" /> <path [attr.d]="'M' + (b[0] - b[2] * 10) + ' ' + (b[1] - b[2] * 6) + ' q' + (b[2] * 10) + ' ' + (-b[2] * 9) + ' ' + (b[2] * 20) + ' 0z'" [attr.fill]="accent()" opacity=".9" /> }
        }
        @case ('ferme') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('sky') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'"><path d="M0 104 Q90 92 180 100 T320 96 V120 H0Z" [attr.fill]="p().k2" />
            <path d="M236 64 L262 46 L288 64 V100 H236Z" [attr.fill]="p().k1" /><rect x="254" y="80" width="14" height="20" [attr.fill]="p().k0" /></g>
          <path d="M0 110 H320 V200 H0Z" [attr.fill]="p().k2" />
          @for (r of furrows; track r) { <path [attr.d]="'M160 110 L' + r + ' 200'" [attr.stroke]="p().k1" stroke-width="2" opacity=".6" /> }
          <g transform="translate(70 120)">
            <rect x="0" y="10" width="54" height="22" rx="3" [attr.fill]="p().k0" /><rect x="30" y="-8" width="22" height="20" [attr.fill]="p().k0" /><rect x="34" y="-4" width="14" height="10" [attr.fill]="p().k3" opacity=".5" />
            <circle cx="12" cy="36" r="14" [attr.fill]="p().k0" /><circle cx="12" cy="36" r="6" [attr.fill]="p().k2" /><circle cx="48" cy="38" r="9" [attr.fill]="p().k0" />
          </g>
          <circle cx="60" cy="40" r="20" [attr.fill]="p().k4" opacity=".8" [attr.filter]="'url(#' + id('soft') + ')'" />
        }
        @case ('ville') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('sky') + ')'" />
          <path d="M0 0 L120 70 L120 150 L0 200Z" [attr.fill]="p().k1" /><path d="M320 0 L200 70 L200 150 L320 200Z" [attr.fill]="p().k1" />
          @for (w of streetWindows; track $index) { <rect [attr.x]="w[0]" [attr.y]="w[1]" [attr.width]="w[2]" [attr.height]="w[2] * 1.4" [attr.fill]="night() ? '#f3d58a' : p().k2" [attr.opacity]="night() ? (($index % 3) ? .9 : .2) : .7" /> }
          <path d="M120 150 L200 150 L320 200 L0 200Z" [attr.fill]="'url(#' + id('floor') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'"><rect x="120" y="70" width="80" height="80" [attr.fill]="p().k2" /></g>
          @for (l of lamps; track $index) { <rect [attr.x]="l[0]" [attr.y]="l[1]" width="2" [attr.height]="l[2]" [attr.fill]="p().k0" /> <circle [attr.cx]="l[0] + 1" [attr.cy]="l[1]" [attr.r]="l[2] * .25" [attr.fill]="'url(#' + id('glow') + ')'" [attr.opacity]="night() ? 1 : .35" /> }
          @for (cr of cars; track $index) { <rect [attr.x]="cr[0]" [attr.y]="cr[1]" [attr.width]="cr[2]" [attr.height]="cr[2] * .4" rx="3" [attr.fill]="p().k0" /> <circle [attr.cx]="cr[0] + 3" [attr.cy]="cr[1] + cr[2] * .2" r="3" fill="#fff" [attr.opacity]="night() ? .9 : .2" /> }
        }
        @case ('aeroport') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('sky') + ')'" />
          <path d="M0 130 H320 V200 H0Z" [attr.fill]="p().k2" />
          <path d="M0 160 L320 150" [attr.stroke]="p().k4" stroke-width="2" stroke-dasharray="16 12" opacity=".6" />
          <g [attr.filter]="'url(#' + id('mid') + ')'">
            <path d="M40 104 Q40 90 64 88 L250 84 Q286 86 292 98 Q286 110 250 112 L64 114 Q40 114 40 104Z" [attr.fill]="p().k3" />
            <path d="M140 100 L200 140 L222 140 L180 98Z M60 92 L46 66 L60 66 L84 90Z" [attr.fill]="p().k2" />
            @for (k of [0, 1, 2, 3, 4, 5, 6, 7]; track k) { <circle [attr.cx]="100 + k * 18" cy="96" r="2.5" [attr.fill]="p().k0" /> }
            <path d="M250 112 L262 140 L274 140 L262 112Z" [attr.fill]="p().k0" />
          </g>
          @for (b of officials; track $index) { <path [attr.d]="bust(b)" [attr.fill]="p().k0" /> }
          <rect x="0" y="182" width="320" height="18" [attr.fill]="accent()" opacity=".55" />
        }
        @case ('port') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('sky') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'">
            @for (c of cranes; track $index) { <path [attr.d]="'M' + c + ' 120 V40 H' + (c + 60) + ' M' + c + ' 40 L' + (c - 20) + ' 52 M' + (c + 40) + ' 40 V70'" [attr.stroke]="p().k1" stroke-width="5" fill="none" /> }
          </g>
          @for (ct of containers; track $index) { <rect [attr.x]="ct[0]" [attr.y]="ct[1]" width="34" height="14" [attr.fill]="ct[2] ? accent() : p().k1" [attr.opacity]="ct[2] ? .8 : 1" [attr.stroke]="p().k0" stroke-width="1" /> }
          <path d="M0 150 H320 V200 H0Z" [attr.fill]="p().k1" />
          @for (r of [0, 1, 2, 3]; track r) { <path [attr.d]="'M0 ' + (160 + r * 10) + ' q40 -4 80 0 t80 0 t80 0 t80 0'" [attr.stroke]="p().k3" stroke-width="1.2" fill="none" opacity=".35" /> }
          <path d="M150 140 L310 140 L296 166 L164 166Z" [attr.fill]="p().k0" /><rect x="250" y="112" width="34" height="28" [attr.fill]="p().k0" />
        }
        @case ('stade') {
          <rect width="320" height="200" [attr.fill]="night() ? p().k0 : p().k1" />
          <ellipse cx="160" cy="150" rx="210" ry="110" [attr.fill]="p().k1" />
          <g [attr.filter]="'url(#' + id('far') + ')'">@for (h of stadiumCrowd; track $index) { <circle [attr.cx]="h[0]" [attr.cy]="h[1]" r="2.4" [attr.fill]="$index % 9 === 0 ? accent() : p().k3" opacity=".75" /> }</g>
          <ellipse cx="160" cy="168" rx="150" ry="44" [attr.fill]="p().k2" />
          @for (st of [0, 1, 2, 3, 4]; track st) { <path [attr.d]="'M' + (40 + st * 60) + ' 130 L' + (20 + st * 70) + ' 212'" [attr.stroke]="p().k3" stroke-width="10" opacity=".18" /> }
          @for (f of floods; track $index) { <circle [attr.cx]="f" cy="18" r="16" [attr.fill]="'url(#' + id('glow') + ')'" /> <rect [attr.x]="f - 1" y="18" width="2" height="60" [attr.fill]="p().k0" /> }
        }
        @case ('labo') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('wall') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'">
            <rect x="200" y="30" width="100" height="64" [attr.fill]="p().k0" /><path d="M210 80 L230 60 L250 70 L270 44 L290 54" [attr.stroke]="p().k4" stroke-width="2" fill="none" />
            @for (sh of [0, 1]; track sh) { <rect x="20" [attr.y]="40 + sh * 34" width="150" height="4" [attr.fill]="p().k2" /> }
          </g>
          <rect x="0" y="130" width="320" height="70" [attr.fill]="p().k2" />
          @for (fl of flasks; track $index) { <path [attr.d]="'M' + fl[0] + ' ' + fl[1] + ' v12 l-' + fl[2] + ' ' + (fl[2] * 1.4) + ' h' + (fl[2] * 2 + 6) + ' l-' + fl[2] + ' -' + (fl[2] * 1.4) + ' v-12z'" [attr.fill]="$index === 1 ? accent() : p().k4" opacity=".8" [attr.stroke]="p().k0" stroke-width="1.5" /> }
          <path [attr.d]="bust([200, 96, 2.2, 1])" [attr.fill]="p().k4" />
          <circle cx="200" cy="92" r="16" [attr.fill]="p().k0" />
          <rect x="186" y="88" width="28" height="8" rx="4" [attr.fill]="p().k3" opacity=".8" />
        }
        @case ('plateau') {
          <rect width="320" height="200" [attr.fill]="p().k0" />
          <g [attr.filter]="'url(#' + id('far') + ')'">
            <rect x="40" y="20" width="240" height="100" [attr.fill]="p().k1" />
            @for (k of [0, 1, 2, 3, 4, 5]; track k) { <rect [attr.x]="52 + k * 38" y="34" width="30" height="72" [attr.fill]="k % 2 ? p().k2 : accent()" opacity=".45" /> }
          </g>
          <path d="M50 150 Q160 120 270 150 L270 170 Q160 140 50 170Z" [attr.fill]="p().k3" />
          <path [attr.d]="bust([116, 98, 1.6, 1])" [attr.fill]="p().k0" /><path [attr.d]="bust([210, 96, 1.65, 1])" [attr.fill]="p().k0" />
          <path d="M0 200 L20 150 L60 150 L80 200Z M240 200 L260 150 L300 150 L320 200Z" [attr.fill]="p().k0" />
          <rect x="22" y="132" width="36" height="22" rx="3" [attr.fill]="p().k0" /><rect x="262" y="132" width="36" height="22" rx="3" [attr.fill]="p().k0" />
          <circle cx="58" cy="140" r="3" fill="#e53935" /><circle cx="160" cy="0" r="80" [attr.fill]="'url(#' + id('spot') + ')'" opacity=".5" />
        }
        @case ('gare') {
          <rect width="320" height="200" [attr.fill]="p().k2" />
          @for (a of arches; track a) { <path [attr.d]="'M' + a + ' 120 Q' + (a + 40) + ' 10 ' + (a + 80) + ' 120'" [attr.stroke]="p().k1" stroke-width="4" fill="none" /> }
          <path d="M0 40 Q160 -30 320 40" [attr.stroke]="p().k1" stroke-width="6" fill="none" />
          <rect x="0" y="0" width="320" height="120" [attr.fill]="'url(#' + id('spot') + ')'" opacity=".4" />
          <path d="M0 200 L120 120 L200 120 L320 200Z" [attr.fill]="'url(#' + id('floor') + ')'" />
          <g [attr.filter]="'url(#' + id('mid') + ')'"><path d="M126 80 Q160 64 194 80 L194 128 L126 128Z" [attr.fill]="p().k0" /><rect x="138" y="88" width="44" height="16" rx="3" [attr.fill]="p().k3" opacity=".7" />
            <circle cx="140" cy="118" r="4" fill="#fff" opacity=".8" /><circle cx="180" cy="118" r="4" fill="#fff" opacity=".8" /></g>
          <circle cx="160" cy="34" r="12" [attr.fill]="p().k4" [attr.stroke]="p().k0" stroke-width="2" /><path d="M160 34 V27 M160 34 L165 37" [attr.stroke]="p().k0" stroke-width="1.5" />
          @for (b of travelers; track $index) { <path [attr.d]="bust(b)" [attr.fill]="p().k0" [attr.opacity]="b[3]" /> }
        }
        @case ('police') {
          <rect width="320" height="200" [attr.fill]="night() ? p().k0 : p().k1" />
          <circle cx="70" cy="70" r="60" fill="#3a6fd8" opacity=".35" [attr.filter]="'url(#' + id('soft') + ')'" />
          <circle cx="240" cy="64" r="50" fill="#3a6fd8" opacity=".25" [attr.filter]="'url(#' + id('soft') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'"><rect x="20" y="80" width="110" height="50" rx="6" [attr.fill]="p().k2" /><rect x="200" y="76" width="110" height="54" rx="6" [attr.fill]="p().k2" />
            <rect x="60" y="72" width="30" height="8" fill="#3a6fd8" /><rect x="240" y="68" width="30" height="8" fill="#3a6fd8" /></g>
          <rect x="0" y="140" width="320" height="60" [attr.fill]="'url(#' + id('floor') + ')'" />
          @for (b of officers; track $index) { <path [attr.d]="bust(b)" [attr.fill]="p().k0" /> <rect [attr.x]="b[0] - b[2] * 14" [attr.y]="b[1] + b[2] * 14" [attr.width]="b[2] * 22" [attr.height]="b[2] * 30" rx="4" [attr.fill]="p().k3" opacity=".35" [attr.stroke]="p().k4" stroke-width="1" /> }
        }
        @case ('mer') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('sky') + ')'" />
          <circle cx="220" cy="78" r="30" [attr.fill]="p().k4" [attr.filter]="'url(#' + id('soft') + ')'" />
          <path d="M0 96 H320 V140 H0Z" [attr.fill]="p().k2" />
          @for (r of waves; track $index) { <path [attr.d]="'M' + r[0] + ' ' + r[1] + ' q' + r[2] / 4 + ' -3 ' + r[2] / 2 + ' 0 t' + r[2] / 2 + ' 0'" [attr.stroke]="p().k4" stroke-width="1.2" fill="none" [attr.opacity]="r[3]" /> }
          <path d="M0 136 Q80 128 160 134 T320 130 V200 H0Z" [attr.fill]="p().k3" />
          <path d="M0 150 Q100 140 200 150 T320 146 V200 H0Z" [attr.fill]="p().k2" opacity=".5" />
          <g [attr.filter]="'url(#' + id('mid') + ')'">@for (b of beachgoers; track $index) { <path [attr.d]="bust(b)" [attr.fill]="p().k0" [attr.opacity]="b[3]" /> }</g>
          <path d="M70 170 L76 108" [attr.stroke]="p().k0" stroke-width="2" /><path d="M46 112 Q76 86 106 112Z" [attr.fill]="accent()" opacity=".85" />
        }
        @case ('montagne') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('sky') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'">
            <path d="M0 120 L60 50 L110 100 L170 30 L240 104 L290 60 L320 90 V140 H0Z" [attr.fill]="p().k2" />
            <path d="M48 64 L60 50 L74 66 L64 62Z M156 46 L170 30 L186 48 L172 42Z M280 70 L290 60 L300 72Z" [attr.fill]="p().k4" />
          </g>
          <g [attr.filter]="'url(#' + id('mid') + ')'"><path d="M0 150 L80 96 L150 140 L230 90 L320 140 V200 H0Z" [attr.fill]="p().k1" /></g>
          <path d="M0 170 Q160 150 320 172 V200 H0Z" [attr.fill]="p().k4" opacity=".85" />
          @for (t of pines; track $index) { <path [attr.d]="'M' + t[0] + ' ' + (t[1] - t[2] * 3) + ' l' + t[2] + ' ' + t[2] * 3 + ' h-' + t[2] * 2 + 'z'" [attr.fill]="p().k0" /> }
          <path d="M210 150 L232 136 L254 150 V172 H210Z" [attr.fill]="p().k0" /><rect x="226" y="158" width="10" height="10" [attr.fill]="night() ? '#f3d58a' : p().k3" />
        }
        @case ('pont') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('sky') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'"><path d="M0 110 Q80 84 160 100 T320 92 V150 H0Z" [attr.fill]="p().k2" /></g>
          <path d="M0 150 H320 V200 H0Z" [attr.fill]="p().k1" />
          @for (r of [0, 1, 2]; track r) { <path [attr.d]="'M0 ' + (162 + r * 12) + ' q40 -3 80 0 t80 0 t80 0 t80 0'" [attr.stroke]="p().k3" stroke-width="1" fill="none" opacity=".35" /> }
          <rect x="0" y="70" width="320" height="10" [attr.fill]="p().k0" />
          @for (x of piers; track x) { <path [attr.d]="'M' + (x - 7) + ' 80 L' + (x - 10) + ' 156 L' + (x + 10) + ' 156 L' + (x + 7) + ' 80Z'" [attr.fill]="p().k0" /> <path [attr.d]="'M' + (x + 10) + ' 82 Q' + (x + 40) + ' 116 ' + (x + 70) + ' 82'" [attr.stroke]="p().k0" stroke-width="2" fill="none" opacity=".6" /> }
          <path d="M150 70 l6 10 l-4 4 l7 10" [attr.stroke]="accent()" stroke-width="2.2" fill="none" />
          @for (k of [30, 96, 230]; track k) { <rect [attr.x]="k" y="62" width="18" height="8" rx="2" [attr.fill]="p().k1" /> }
        }
        @case ('musee') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('wall') + ')'" />
          @for (f of frames; track $index) { <rect [attr.x]="f[0]" [attr.y]="f[1]" [attr.width]="f[2]" [attr.height]="f[3]" [attr.fill]="$index === 1 && tone() === 'negative' ? p().k1 : p().k2" [attr.stroke]="p().k3" stroke-width="4" />
            @if (!($index === 1 && tone() === 'negative')) { <path [attr.d]="'M' + (f[0] + 6) + ' ' + (f[1] + f[3] - 8) + ' l' + f[2] * .3 + ' -' + f[3] * .4 + ' l' + f[2] * .25 + ' ' + f[3] * .2 + ' l' + (f[2] * .45 - 12) + ' ' + f[3] * .2" [attr.stroke]="p().k4" stroke-width="2" fill="none" opacity=".6" /> }
            <circle [attr.cx]="f[0] + f[2] / 2" [attr.cy]="f[1] - 14" r="16" [attr.fill]="'url(#' + id('glow') + ')'" opacity=".5" /> }
          <rect x="0" y="150" width="320" height="50" [attr.fill]="'url(#' + id('floor') + ')'" />
          <rect x="120" y="150" width="80" height="10" [attr.fill]="p().k0" /><rect x="126" y="160" width="4" height="12" [attr.fill]="p().k0" /><rect x="190" y="160" width="4" height="12" [attr.fill]="p().k0" />
          <path [attr.d]="bust([60, 120, 2, 1])" [attr.fill]="p().k0" /><path [attr.d]="bust([270, 126, 1.8, .95])" [attr.fill]="p().k0" />
        }
        @case ('marche') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('sky') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'"><rect x="0" y="40" width="320" height="70" [attr.fill]="p().k2" />@for (w of [20, 70, 120, 170, 220, 270]; track w) { <rect [attr.x]="w" y="52" width="22" height="30" [attr.fill]="p().k1" /> }</g>
          @for (st of stalls; track $index) {
            @for (k of [0, 1, 2, 3, 4]; track k) { <path [attr.d]="'M' + (st + k * 16) + ' 96 L' + (st + k * 16 + 16) + ' 96 L' + (st + k * 16 + 18) + ' 114 L' + (st + k * 16 - 2) + ' 114Z'" [attr.fill]="k % 2 ? p().k4 : accent()" opacity=".85" /> }
            <rect [attr.x]="st" y="130" width="80" height="22" [attr.fill]="p().k1" />
            @for (k of [0, 1, 2, 3, 4, 5, 6]; track k) { <circle [attr.cx]="st + 6 + k * 11" cy="128" r="5" [attr.fill]="k % 3 ? p().k3 : p().k4" /> }
          }
          <rect x="0" y="152" width="320" height="48" [attr.fill]="'url(#' + id('floor') + ')'" />
          @for (b of shoppers; track $index) { <path [attr.d]="bust(b)" [attr.fill]="p().k0" [attr.opacity]="b[3]" /> }
        }
        @case ('route') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('sky') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'"><path d="M0 100 Q100 88 200 98 T320 94 V110 H0Z" [attr.fill]="p().k2" /></g>
          <path d="M150 100 L170 100 L320 200 L0 200Z" [attr.fill]="p().k1" />
          @for (k of [0, 1, 2, 3, 4]; track k) { <path [attr.d]="'M' + (160) + ' ' + (106 + k * k * 4) + ' L160 ' + (110 + k * k * 4 + k * 3)" [attr.stroke]="p().k4" [attr.stroke-width]="1 + k" opacity=".7" /> }
          <rect x="60" y="56" width="200" height="6" [attr.fill]="p().k0" /><rect x="60" y="62" width="4" height="60" [attr.fill]="p().k0" /><rect x="256" y="62" width="4" height="60" [attr.fill]="p().k0" />
          <rect x="90" y="40" width="60" height="18" [attr.fill]="accent()" opacity=".85" /><rect x="170" y="40" width="60" height="18" [attr.fill]="p().k1" />
          @for (cr of jam; track $index) { <rect [attr.x]="cr[0]" [attr.y]="cr[1]" [attr.width]="cr[2]" [attr.height]="cr[2] * .55" rx="3" [attr.fill]="p().k0" /> <circle [attr.cx]="cr[0] + cr[2] * .15" [attr.cy]="cr[1] + cr[2] * .35" [attr.r]="cr[2] * .07" fill="#e53935" [attr.opacity]="night() ? .95 : .6" /> <circle [attr.cx]="cr[0] + cr[2] * .85" [attr.cy]="cr[1] + cr[2] * .35" [attr.r]="cr[2] * .07" fill="#e53935" [attr.opacity]="night() ? .95 : .6" /> }
        }
        @case ('concert') {
          <rect width="320" height="200" [attr.fill]="p().k0" />
          @for (bm of beams; track $index) { <path [attr.d]="'M' + bm[0] + ' 0 L' + (bm[1] - 22) + ' 112 L' + (bm[1] + 22) + ' 112Z'" [attr.fill]="$index % 2 ? p().k4 : accent()" opacity=".2" /> }
          <circle cx="160" cy="86" r="50" [attr.fill]="'url(#' + id('glow') + ')'" opacity=".3" />
          <rect x="30" y="112" width="260" height="22" [attr.fill]="p().k1" />
          <rect x="60" y="88" width="26" height="24" [attr.fill]="p().k1" /><rect x="234" y="88" width="26" height="24" [attr.fill]="p().k1" />
          <path [attr.d]="bust([160, 78, 1, 1])" [attr.fill]="p().k3" /><rect x="152" y="96" width="16" height="16" [attr.fill]="p().k3" />
          <path d="M168 112 L172 84" [attr.stroke]="p().k2" stroke-width="1.5" /><circle cx="172" cy="83" r="2.2" [attr.fill]="p().k2" />
          <path d="M0 150 Q160 136 320 150 V200 H0Z" [attr.fill]="p().k0" />
          <g [attr.filter]="'url(#' + id('mid') + ')'">@for (h of fans; track $index) { <circle [attr.cx]="h[0]" [attr.cy]="h[1]" [attr.r]="h[2]" [attr.fill]="p().k1" /> @if ($index % 4 === 0) { <path [attr.d]="'M' + h[0] + ' ' + h[1] + ' l' + ($index % 8 ? 6 : -6) + ' -24'" [attr.stroke]="p().k1" stroke-width="4" stroke-linecap="round" /> } }</g>
          @for (b of [[50, 186, 2, 1], [140, 190, 2.2, 1], [250, 186, 2.1, 1]]; track $index) { <path [attr.d]="bust($any(b))" [attr.fill]="p().k0" /> }
        }
        @case ('espace') {
          <rect width="320" height="200" [attr.fill]="p().k0" />
          @for (st of stars; track $index) { <circle [attr.cx]="st[0]" [attr.cy]="st[1] * 1.6" [attr.r]="st[2]" fill="#fff" opacity=".75" /> }
          <path d="M0 170 H320 V200 H0Z" [attr.fill]="p().k1" />
          <path d="M196 170 V40 M210 170 V40 M196 60 H210 M196 90 H210 M196 120 H210 M196 150 H210 M196 60 L210 90 M196 90 L210 120 M196 120 L210 150" [attr.stroke]="p().k2" stroke-width="2" />
          <path d="M150 54 Q160 20 170 54 V140 H150Z" [attr.fill]="p().k4" /><rect x="150" y="80" width="20" height="6" [attr.fill]="accent()" />
          <path d="M150 120 L138 146 L150 140Z M170 120 L182 146 L170 140Z" [attr.fill]="p().k3" />
          <circle cx="160" cy="160" r="40" [attr.fill]="'url(#' + id('glow') + ')'" />
          <g [attr.filter]="'url(#' + id('soft') + ')'">@for (sm of smoke; track $index) { <circle [attr.cx]="sm[0]" cy="172" [attr.r]="sm[1]" [attr.fill]="p().k3" opacity=".7" /> }</g>
        }
        @case ('chantier') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('sky') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'">
            @for (fl of [0, 1, 2, 3]; track fl) { <rect x="150" [attr.y]="150 - fl * 26" width="130" height="3" [attr.fill]="p().k1" /> }
            @for (c of [150, 192, 234, 277]; track c) { <rect [attr.x]="c" y="72" width="3" height="80" [attr.fill]="p().k1" /> }
          </g>
          <path d="M60 170 V30 M66 170 V30" [attr.stroke]="p().k0" stroke-width="2" />
          @for (k of lattice; track k) { <path [attr.d]="'M60 ' + (170 - k * 17) + ' L66 ' + (161 - k * 17)" [attr.stroke]="p().k0" stroke-width="1.2" /> }
          <path d="M30 34 H280 M30 34 L63 22 L280 34" [attr.stroke]="p().k0" stroke-width="3" fill="none" />
          <path d="M220 34 V84" [attr.stroke]="p().k0" stroke-width="1" /><rect x="210" y="84" width="22" height="12" [attr.fill]="accent()" opacity=".85" />
          <rect x="0" y="170" width="320" height="30" [attr.fill]="'url(#' + id('floor') + ')'" />
          @for (k of [0, 1, 2, 3, 4, 5, 6, 7]; track k) { <rect [attr.x]="10 + k * 18" y="160" width="9" height="8" [attr.fill]="k % 2 ? p().k4 : accent()" /> }
          @for (b of workers; track $index) { <path [attr.d]="bust(b)" [attr.fill]="p().k0" /> <path [attr.d]="'M' + (b[0] - b[2] * 10) + ' ' + (b[1] - b[2] * 6) + ' q' + (b[2] * 10) + ' ' + (-b[2] * 9) + ' ' + (b[2] * 20) + ' 0z'" fill="#e8b23a" opacity=".9" /> }
        }
        @case ('bureau') {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('wall') + ')'" />
          <rect x="110" y="10" width="100" height="120" [attr.fill]="p().k4" opacity=".75" /><path d="M160 10 V130 M110 50 H210 M110 90 H210" [attr.stroke]="p().k2" stroke-width="3" />
          <path d="M96 0 Q112 70 100 140 L90 140 Q96 70 86 0Z M224 0 Q208 70 220 140 L230 140 Q224 70 234 0Z" [attr.fill]="p().k1" />
          <rect x="0" y="0" width="320" height="8" [attr.fill]="p().k3" opacity=".6" />
          <g [attr.filter]="'url(#' + id('mid') + ')'"><path d="M40 30 V140" [attr.stroke]="p().k0" stroke-width="2" /><path d="M42 32 h22 v34 h-22z" [attr.fill]="'#2d4b78'" opacity=".85" /><path d="M64 32 h22 v34 h-22z" [attr.fill]="p().k4" /><path d="M86 32 h22 v34 h-22z" [attr.fill]="'#9e2a22'" opacity=".85" /></g>
          <path [attr.d]="bust([160, 112, 2, 1])" [attr.fill]="p().k0" />
          <path d="M60 150 H260 L276 200 H44Z" [attr.fill]="p().k1" /><rect x="60" y="144" width="200" height="8" [attr.fill]="p().k2" />
          <rect x="190" y="136" width="30" height="8" [attr.fill]="p().k4" opacity=".8" /><circle cx="110" cy="138" r="6" [attr.fill]="p().k3" />
        }
        @default {
          <rect width="320" height="200" [attr.fill]="'url(#' + id('wall') + ')'" />
          <g [attr.filter]="'url(#' + id('far') + ')'">
            @for (f of [60, 100, 220, 260]; track f) { <rect [attr.x]="f" y="10" width="3" height="120" [attr.fill]="p().k0" /> <path [attr.d]="'M' + (f + 3) + ' 14 q14 8 26 0 v34 q-12 8 -26 0z'" [attr.fill]="p().k3" /> }
          </g>
          <ellipse cx="160" cy="40" rx="110" ry="90" [attr.fill]="p().k4" opacity=".25" [attr.filter]="'url(#' + id('soft') + ')'" />
          <path [attr.d]="bust([160, 84, 2.1, 1])" [attr.fill]="p().k0" />
          <path d="M112 200 L118 134 L202 134 L208 200Z" [attr.fill]="p().k1" />
          <rect x="114" y="128" width="92" height="10" rx="2" [attr.fill]="p().k2" />
          @for (m of mics; track $index) { <path [attr.d]="'M' + m[0] + ' 128 L' + m[1] + ' ' + m[2]" [attr.stroke]="p().k0" stroke-width="2" /> <rect [attr.x]="m[1] - 4" [attr.y]="m[2] - 10" width="8" height="12" rx="4" [attr.fill]="$index === 2 ? accent() : p().k0" /> }
          @for (f of flashes; track $index) { <circle [attr.cx]="f[0]" [attr.cy]="f[1]" [attr.r]="f[2]" [attr.fill]="'url(#' + id('glow') + ')'" /> }
          <g [attr.filter]="'url(#' + id('far') + ')'">@for (b of pressRow; track $index) { <path [attr.d]="bust(b)" [attr.fill]="p().k0" opacity=".9" /> <rect [attr.x]="b[0] - 8" [attr.y]="b[1] - 6" width="16" height="10" rx="2" [attr.fill]="p().k1" /> }</g>
        }
      }
      @if (night() && outdoor()) { @for (st of stars; track $index) { <circle [attr.cx]="st[0]" [attr.cy]="st[1]" [attr.r]="st[2]" fill="#fff" opacity=".7" /> } }
      </g></g>
      <rect width="320" height="200" [attr.fill]="'url(#' + id('vig') + ')'" />
      <rect width="320" height="200" [attr.filter]="'url(#' + id('grain') + ')'" />
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { display: block; width: 100%; height: 100%; }
    /* Un lent travelling, comme une caméra qui respire */
    @media (prefers-reduced-motion: no-preference) {
      .kb { transform-origin: 50% 50%; animation: kb 22s ease-in-out infinite alternate; }
      .kb-alt { animation-name: kb-alt; }
    }
    @keyframes kb { from { transform: scale(1.02) translate(0, 0); } to { transform: scale(1.09) translate(-6px, -3px); } }
    @keyframes kb-alt { from { transform: scale(1.08) translate(-5px, 2px); } to { transform: scale(1.02) translate(4px, -2px); } }
  `,
})
export class NewsArtComponent {
  readonly theme = input<ArtTheme>('micro');
  readonly tone = input<'positive' | 'neutral' | 'negative'>('neutral');
  readonly seed = input('a');

  /** Cinq valeurs de gris teintées : un tirage sépia, froid ou neutre selon le ton */
  protected readonly p = computed(() => this.tone() === 'positive'
    ? { k0: '#1d1913', k1: '#4a4134', k2: '#8a7d68', k3: '#c7baa0', k4: '#f1e8d4' }
    : this.tone() === 'negative'
      ? { k0: '#121518', k1: '#363c43', k2: '#6e757d', k3: '#a9afb5', k4: '#dde1e4' }
      : { k0: '#191817', k1: '#43403c', k2: '#7f7a72', k3: '#bdb7ad', k4: '#ece8e1' });
  protected readonly accent = computed(() => (this.tone() === 'negative' ? '#9e2a22' : this.tone() === 'positive' ? '#2d4b78' : '#7a2d26'));
  protected readonly seedNum = computed(() => [...this.seed()].reduce((t, c) => t + c.charCodeAt(0), 0) % 97);
  protected readonly label = computed(() => `Photo : ${this.theme()}`);
  /** Variantes : la même scène, cadrée autrement (miroir) ou de nuit */
  protected readonly mirror = computed(() => this.seedNum() % 2 === 1 && this.theme() !== 'loupe');
  protected readonly outdoor = computed(() => ['foule', 'monument', 'nature', 'couronne', 'drapeau', 'ville', 'port', 'stade', 'ferme', 'aeroport', 'mer', 'montagne', 'pont', 'marche', 'route', 'chantier'].includes(this.theme()));
  protected readonly night = computed(() => this.outdoor() && this.seedNum() % 3 === 0);
  protected id(name: string) { return `${name}-${this.seed()}`; }

  /** Une silhouette en buste : tête, cou, épaules */
  protected bust([x, y, s]: Bust): string {
    const h = 9 * s;
    // Épaules larges et tombantes, cou court, tête légèrement ovale
    return `M${x - h * 2.9} ${y + h * 5} C${x - h * 2.8} ${y + h * 2.6} ${x - h * 2.1} ${y + h * 1.75} ${x - h * .7} ${y + h * 1.5} `
      + `C${x - h * .55} ${y + h * 1.3} ${x - h * .5} ${y + h * 1.15} ${x - h * .55} ${y + h * .95} `
      + `C${x - h * 1.1} ${y + h * .6} ${x - h * 1.05} ${y - h * 1.1} ${x} ${y - h * 1.1} C${x + h * 1.05} ${y - h * 1.1} ${x + h * 1.1} ${y + h * .6} ${x + h * .55} ${y + h * .95} `
      + `C${x + h * .5} ${y + h * 1.15} ${x + h * .55} ${y + h * 1.3} ${x + h * .7} ${y + h * 1.5} C${x + h * 2.1} ${y + h * 1.75} ${x + h * 2.8} ${y + h * 2.6} ${x + h * 2.9} ${y + h * 5}Z`;
  }

  protected tree([x, y, s]: [number, number, number]): string {
    return `M${x} ${y} Q${x - s * 1.2} ${y + s * 1.6} ${x - s * .2} ${y + s * 2.4} Q${x + s * 1.3} ${y + s * 1.6} ${x} ${y}Z`;
  }

  protected chart(m: number[]): string {
    const [x, y, w, h] = m;
    const up = this.tone() !== 'negative';
    const pts = [0, .15, .3, .45, .6, .75, .9].map((t, i) => `${x + 6 + t * (w - 12)},${y + h * (up ? .8 - t * .55 + (i % 2) * .1 : .25 + t * .55 - (i % 2) * .1)}`);
    return 'M' + pts.join(' L');
  }

  // Décors
  protected readonly tiers = [[150, 70, 40, 7], [135, 86, 34, 7], [120, 102, 28, 7], [104, 118, 22, 7], [88, 134, 16, 7]];
  protected readonly farHeads: [number, number, number][] = Array.from({ length: 46 }, (_, i) => {
    const row = i % 5, k = Math.floor(i / 5);
    const r = [150, 135, 120, 104, 88][row], y0 = [70, 86, 102, 118, 134][row], bow = [40, 34, 28, 22, 16][row];
    const t = (k + .5) / 9.5, x = 160 - r + t * 2 * r, y = y0 - bow * (1 - Math.pow(2 * t - 1, 2)) - 5;
    return [x, y, 3 + row * .4];
  });
  protected readonly frontRow: Bust[] = [[22, 160, 2.2, 1], [74, 166, 2, .95], [250, 164, 2.1, 1], [302, 158, 2.3, 1]];
  protected readonly envs = [[112, 150, -12], [140, 160, 8], [168, 146, -4], [184, 162, 14], [120, 170, 3]];
  protected readonly windows: [number, number][] = [10, 30, 50, 262, 282, 302].flatMap(x => [44, 70, 96].map(y => [x, y] as [number, number]));
  protected readonly farCrowd: [number, number, number][] = Array.from({ length: 40 }, (_, i) => [8 + (i * 37) % 312, 112 + (i % 4) * 5, 4 + (i % 3)]);
  protected readonly midCrowd: Bust[] = [[30, 120, 1.1, .9], [70, 118, 1.2, .85], [112, 122, 1.1, .9], [150, 116, 1.25, .85], [232, 120, 1.15, .9], [276, 116, 1.2, .85], [312, 122, 1.1, .9]];
  protected readonly frontCrowd: Bust[] = [[18, 150, 2, 1], [66, 158, 2.3, 1], [126, 154, 2.1, 1], [184, 160, 2.4, 1], [244, 152, 2.2, 1], [300, 158, 2.3, 1]];
  protected readonly monitors = [[18, 24, 88, 58], [116, 16, 96, 66], [222, 24, 86, 58], [40, 92, 76, 48], [206, 92, 76, 48]];
  protected readonly lines = [0, 1, 2, 3, 4, 5, 7, 8, 9];
  protected readonly soldiers: [number, number, number][] = Array.from({ length: 22 }, (_, i) => [10 + i * 14.5, 104 + (i % 2) * 3, 6]);
  protected readonly columns = [48, 80, 112, 198, 230, 262];
  protected readonly lattice = [0, 1, 2, 3, 4, 5, 6, 7];
  protected readonly flags = [40, 90, 150, 210, 270];
  protected readonly tableBusts: Bust[] = [[70, 92, 1.3, 1], [130, 88, 1.35, 1], [190, 88, 1.35, 1], [250, 92, 1.3, 1]];
  protected readonly trees: [number, number, number][] = [[40, 112, 10], [62, 118, 8], [276, 110, 11], [296, 116, 9]];
  protected readonly mics = [[138, 112, 110], [150, 126, 104], [160, 160, 102], [170, 192, 104], [182, 206, 110]];
  protected readonly flashes = [[40, 120, 22], [286, 110, 18], [96, 150, 14]];
  protected readonly stars = Array.from({ length: 26 }, (_, i) => [(i * 53) % 320, (i * 29) % 70, (i % 3) * .3 + .5]);
  protected readonly panels = [10, 50, 90, 130, 170, 210, 250, 290];
  protected readonly judges: Bust[] = [[110, 48, 1.1, 1], [160, 44, 1.2, 1], [210, 48, 1.1, 1]];
  protected readonly desks = [[40, 150, 46], [110, 150, 46], [180, 150, 46], [70, 122, 34], [130, 122, 34], [190, 122, 34], [100, 104, 26], [150, 104, 26]];
  protected readonly trusses = [0, 80, 160, 240];
  protected readonly sparks = [[-18, -14], [14, -20], [22, -6], [-24, 2], [8, -24], [-10, -22]];
  protected readonly workers: Bust[] = [[50, 150, 1.4, 1], [270, 146, 1.6, 1]];
  protected readonly furrows = [-80, 0, 60, 110, 160, 210, 260, 320, 400];
  protected readonly streetWindows: [number, number, number][] = [...[10, 40, 70, 96].flatMap(x => [30, 60, 90, 120].map(y => [x, y + (x > 60 ? 10 : 0), 12] as [number, number, number])), ...[214, 240, 270, 300].flatMap(x => [30, 60, 90, 120].map(y => [x, y + (x < 260 ? 10 : 0), 12] as [number, number, number]))];
  protected readonly lamps: [number, number, number][] = [[110, 120, 50], [208, 120, 50], [60, 140, 60], [258, 140, 60]];
  protected readonly cars: [number, number, number][] = [[130, 160, 26], [168, 152, 20], [196, 170, 30]];
  protected readonly officials: Bust[] = [[120, 140, 1.2, 1], [160, 138, 1.3, 1], [200, 140, 1.2, 1]];
  protected readonly cranes = [30, 140, 230];
  protected readonly containers: [number, number, number][] = [[20, 136, 0], [56, 136, 1], [92, 136, 0], [38, 122, 0], [74, 122, 0], [56, 108, 1]];
  protected readonly stadiumCrowd: [number, number][] = Array.from({ length: 90 }, (_, i) => { const a = Math.PI * (i % 30) / 29, r = 170 - Math.floor(i / 30) * 18; return [160 - Math.cos(a) * r, 150 - Math.sin(a) * r * .55]; });
  protected readonly floods = [40, 120, 200, 280];
  protected readonly flasks: [number, number, number][] = [[40, 108, 8], [76, 104, 10], [116, 110, 7]];
  protected readonly arches = [0, 80, 160, 240];
  protected readonly travelers: Bust[] = [[40, 150, 1.8, 1], [96, 140, 1.3, .9], [240, 146, 1.5, .95], [292, 152, 1.9, 1]];
  protected readonly officers: Bust[] = [[70, 128, 1.4, 1], [130, 124, 1.5, 1], [190, 124, 1.5, 1], [250, 128, 1.4, 1]];
  protected readonly waves = Array.from({ length: 12 }, (_, i) => [(i * 71) % 300, 102 + (i % 4) * 9, 30 + (i % 3) * 14, .25 + (i % 3) * .15]);
  protected readonly beachgoers: Bust[] = [[150, 140, .8, .8], [196, 138, .7, .7], [250, 142, .85, .8]];
  protected readonly pines: [number, number, number][] = [[20, 176, 7], [36, 182, 9], [282, 178, 8], [300, 184, 10], [120, 168, 5]];
  protected readonly piers = [40, 110, 180, 250];
  protected readonly frames: [number, number, number, number][] = [[24, 40, 70, 54], [124, 30, 72, 90], [226, 44, 70, 52]];
  protected readonly stalls = [10, 120, 230];
  protected readonly shoppers: Bust[] = [[40, 168, 1.6, 1], [150, 172, 1.8, 1], [262, 166, 1.5, .95]];
  protected readonly jam: [number, number, number][] = [[146, 118, 14], [170, 122, 16], [120, 134, 22], [176, 140, 24], [90, 160, 34], [190, 166, 38]];
  protected readonly beams = [[40, 110], [100, 150], [220, 170], [280, 210]];
  protected readonly fans: [number, number, number][] = Array.from({ length: 28 }, (_, i) => [6 + (i * 23) % 316, 148 + (i % 3) * 8, 6 + (i % 3) * 1.5]);
  protected readonly smoke: [number, number][] = [[110, 18], [140, 24], [180, 26], [212, 20], [240, 14]];
  protected readonly pressRow: Bust[] = [[30, 170, 1.6, 1], [86, 176, 1.7, 1], [236, 174, 1.7, 1], [292, 170, 1.6, 1]];
}

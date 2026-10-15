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
        <linearGradient [attr.id]="id('sky')" x1="0" y1="0" x2="0" y2="1"><stop offset="0" [attr.stop-color]="p().k3" /><stop offset="1" [attr.stop-color]="p().k4" /></linearGradient>
        <linearGradient [attr.id]="id('wall')" x1="0" y1="0" x2="0" y2="1"><stop offset="0" [attr.stop-color]="p().k1" /><stop offset=".7" [attr.stop-color]="p().k2" /><stop offset="1" [attr.stop-color]="p().k1" /></linearGradient>
        <linearGradient [attr.id]="id('floor')" x1="0" y1="0" x2="0" y2="1"><stop offset="0" [attr.stop-color]="p().k2" /><stop offset="1" [attr.stop-color]="p().k0" /></linearGradient>
        <radialGradient [attr.id]="id('spot')" cx="50%" cy="0%" r="80%"><stop offset="0" [attr.stop-color]="p().k4" stop-opacity=".85" /><stop offset="1" [attr.stop-color]="p().k4" stop-opacity="0" /></radialGradient>
        <radialGradient [attr.id]="id('glow')" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".9" /><stop offset="1" stop-color="#fff" stop-opacity="0" /></radialGradient>
      </defs>

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
      <rect width="320" height="200" [attr.fill]="'url(#' + id('vig') + ')'" />
      <rect width="320" height="200" [attr.filter]="'url(#' + id('grain') + ')'" />
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { display: block; width: 100%; height: 100%; }
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
  protected readonly pressRow: Bust[] = [[30, 170, 1.6, 1], [86, 176, 1.7, 1], [236, 174, 1.7, 1], [292, 170, 1.6, 1]];
}

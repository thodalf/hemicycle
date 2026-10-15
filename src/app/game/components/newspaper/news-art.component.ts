import { Component, computed, input } from '@angular/core';
import { ArtTheme } from '../../engine/newspaper';

/** Une « photo » de presse : une scène en SVG bichrome, tramée comme à l'impression */
@Component({
  selector: 'app-news-art',
  template: `
    <svg viewBox="0 0 320 200" role="img" [attr.aria-label]="label()" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern [attr.id]="pid()" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="1.1" [attr.fill]="c().ink" opacity=".18" /></pattern>
        <radialGradient [attr.id]="gid()" cx="50%" cy="40%" r="70%"><stop offset="0" [attr.stop-color]="c().light" /><stop offset="1" [attr.stop-color]="c().bg" /></radialGradient>
      </defs>
      <rect width="320" height="200" [attr.fill]="'url(#' + gid() + ')'" />
      <g [attr.fill]="c().ink" [attr.stroke]="c().ink">
        @switch (theme()) {
          @case ('hemicycle') {
            <path d="M40 185 A120 120 0 0 1 280 185" fill="none" stroke-width="2" opacity=".35" />
            @for (r of rows; track r) {
              @for (k of seatsOf(r); track k) { <circle [attr.cx]="160 + r * cos(k, r)" [attr.cy]="185 - r * sin(k, r)" r="4" stroke="none" [attr.opacity]="k % 7 === 3 ? 1 : .75" [attr.fill]="k % 5 === 0 ? c().accent : c().ink" /> }
            }
            <rect x="140" y="160" width="40" height="25" rx="2" [attr.fill]="c().accent" stroke="none" />
          }
          @case ('urne') {
            <path d="M110 90 L210 90 L200 180 L120 180 Z" fill="none" stroke-width="4" />
            <rect x="130" y="84" width="60" height="6" stroke="none" />
            <rect x="140" y="40" width="40" height="52" [attr.fill]="c().bg" stroke-width="3" transform="rotate(-8 160 66)" />
            <path d="M144 48 L176 62" stroke-width="2" transform="rotate(-8 160 66)" />
            <rect x="60" y="30" width="6" height="150" stroke="none" opacity=".6" /><path d="M66 32 h34 v22 h-34z" [attr.fill]="c().accent" stroke="none" />
            <rect x="254" y="30" width="6" height="150" stroke="none" opacity=".6" /><path d="M260 32 h34 v22 h-34z" [attr.fill]="c().accent" stroke="none" />
          }
          @case ('foule') {
            @for (h of heads; track $index) { <circle [attr.cx]="h[0]" [attr.cy]="h[1]" [attr.r]="h[2]" stroke="none" [attr.opacity]="h[3]" /> <rect [attr.x]="h[0] - h[2] * 1.3" [attr.y]="h[1] + h[2]" [attr.width]="h[2] * 2.6" height="60" [attr.rx]="h[2]" stroke="none" [attr.opacity]="h[3]" /> }
            <rect x="70" y="40" width="90" height="34" [attr.fill]="c().accent" stroke="none" transform="rotate(-4 115 57)" /><path d="M80 52 h70 M80 62 h50" [attr.stroke]="c().bg" stroke-width="4" transform="rotate(-4 115 57)" />
            <rect x="190" y="30" width="80" height="30" [attr.fill]="c().bg" stroke-width="3" transform="rotate(5 230 45)" /><path d="M200 42 h60 M200 50 h40" stroke-width="3" transform="rotate(5 230 45)" />
          }
          @case ('courbe') {
            <path d="M40 30 V175 H290" fill="none" stroke-width="3" />
            @for (b of bars; track $index) { <rect [attr.x]="60 + $index * 38" [attr.y]="175 - b" width="24" [attr.height]="b" stroke="none" opacity=".25" /> }
            <path [attr.d]="up() ? 'M50 160 L100 140 L140 150 L190 100 L230 110 L280 50' : 'M50 60 L100 80 L140 70 L190 120 L230 110 L280 165'" fill="none" [attr.stroke]="c().accent" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
            <circle [attr.cx]="280" [attr.cy]="up() ? 50 : 165" r="8" [attr.fill]="c().accent" stroke="none" />
          }
          @case ('loupe') {
            <rect x="60" y="50" width="120" height="140" [attr.fill]="c().bg" stroke-width="3" transform="rotate(-6 120 120)" />
            <rect x="80" y="40" width="120" height="140" [attr.fill]="c().bg" stroke-width="3" transform="rotate(4 140 110)" />
            @for (l of [0, 1, 2, 3, 4, 5, 6]; track l) { <path [attr.d]="'M95 ' + (65 + l * 15) + ' h' + (l % 3 === 2 ? 50 : 85)" stroke-width="3" transform="rotate(4 140 110)" opacity=".7" /> }
            <rect x="100" y="110" width="70" height="14" [attr.fill]="c().accent" stroke="none" transform="rotate(4 140 110)" />
            <circle cx="215" cy="95" r="42" [attr.fill]="c().light" fill-opacity=".5" stroke-width="8" /><path d="M245 125 L285 168" stroke-width="14" stroke-linecap="round" />
          }
          @case ('drapeau') {
            <rect x="70" y="20" width="6" height="170" stroke="none" />
            <path d="M76 26 C110 16 130 40 160 30 C190 20 210 44 240 34 L240 104 C210 114 190 90 160 100 C130 110 110 86 76 96 Z" [attr.fill]="c().bg" stroke-width="3" />
            <path d="M76 26 C95 20 105 30 120 28 L120 98 C105 100 95 90 76 96 Z" stroke="none" />
            <path d="M200 25 C215 22 228 40 240 34 L240 104 C228 110 215 92 200 95 Z" [attr.fill]="c().accent" stroke="none" />
            @for (x of [110, 160, 210, 260]; track x) { <circle [attr.cx]="x" cy="150" r="9" stroke="none" opacity=".8" /><rect [attr.x]="x - 10" y="160" width="20" height="40" rx="6" stroke="none" opacity=".8" /> }
          }
          @case ('croix') {
            <rect x="70" y="70" width="180" height="120" [attr.fill]="c().bg" stroke-width="4" />
            @for (w of [0, 1, 2, 3]; track w) { <rect [attr.x]="88 + w * 42" y="130" width="22" height="22" stroke="none" opacity=".35" /> }
            <rect x="145" y="22" width="30" height="80" [attr.fill]="c().accent" stroke="none" /><rect x="120" y="47" width="80" height="30" [attr.fill]="c().accent" stroke="none" />
            <rect x="140" y="160" width="40" height="30" stroke="none" />
          }
          @case ('couronne') {
            <path d="M80 150 L70 70 L115 110 L160 50 L205 110 L250 70 L240 150 Z" [attr.fill]="c().accent" stroke-width="4" stroke-linejoin="round" />
            <rect x="78" y="150" width="164" height="22" stroke="none" />
            @for (j of [100, 160, 220]; track j) { <circle [attr.cx]="j" cy="161" r="6" [attr.fill]="c().bg" stroke="none" /> }
            @for (p of [[70, 70], [160, 50], [250, 70]]; track $index) { <circle [attr.cx]="p[0]" [attr.cy]="p[1]" r="8" stroke="none" /> }
          }
          @case ('monument') {
            <path d="M160 18 L150 70 L130 140 L105 192 L135 192 Q160 150 185 192 L215 192 L190 140 L170 70 Z" fill="none" stroke-width="4" stroke-linejoin="round" />
            <path d="M138 110 H182 M128 140 H192 M150 70 H170" stroke-width="4" />
            @for (k of [0, 1, 2, 3, 4]; track k) { <path [attr.d]="'M' + (141 + k * 2) + ' ' + (80 + k * 12) + ' L' + (179 - k * 2) + ' ' + (92 + k * 12)" stroke-width="1.5" opacity=".6" /> }
            <path d="M30 192 H290" stroke-width="3" /><circle cx="255" cy="45" r="18" [attr.fill]="c().accent" stroke="none" />
          }
          @case ('globe') {
            <circle cx="160" cy="100" r="70" [attr.fill]="c().bg" stroke-width="4" />
            <ellipse cx="160" cy="100" rx="30" ry="70" fill="none" stroke-width="2.5" /><ellipse cx="160" cy="100" rx="60" ry="70" fill="none" stroke-width="2" opacity=".6" />
            <path d="M90 100 H230 M100 65 H220 M100 135 H220" stroke-width="2.5" />
            <path d="M130 70 q15 -10 30 0 q10 20 -10 30 q-20 5 -20 -30z M175 115 q20 0 25 15 q-10 15 -25 5z" [attr.fill]="c().accent" stroke="none" />
            <rect x="40" y="40" width="4" height="60" stroke="none" /><path d="M44 42 h28 v18 h-28z" [attr.fill]="c().accent" stroke="none" />
            <rect x="276" y="110" width="4" height="60" stroke="none" /><path d="M280 112 h28 v18 h-28z" stroke="none" />
          }
          @case ('nature') {
            <circle cx="240" cy="55" r="28" [attr.fill]="c().accent" stroke="none" />
            <path d="M0 150 Q80 90 160 140 T320 120 V200 H0 Z" stroke="none" opacity=".75" />
            <path d="M0 175 Q60 155 120 175 T240 175 T360 175" fill="none" [attr.stroke]="c().bg" stroke-width="5" />
            @for (t of [40, 70, 100]; track t) { <path [attr.d]="'M' + t + ' 140 l-12 30 h24 z'" stroke="none" /> }
          }
          @default {
            <path d="M95 0 L140 120 L180 120 L225 0 Z" [attr.fill]="c().light" stroke="none" opacity=".7" />
            <rect x="110" y="140" width="100" height="56" stroke="none" />
            <rect x="122" y="152" width="76" height="10" [attr.fill]="c().accent" stroke="none" />
            <path d="M160 140 V95" stroke-width="5" /><rect x="150" y="70" width="20" height="32" rx="10" stroke="none" />
            @for (k of [0, 1, 2]; track k) { <path [attr.d]="'M' + (185 + k * 12) + ' ' + (78 - k * 3) + ' q8 10 0 20'" fill="none" stroke-width="3" opacity=".6" /> }
          }
        }
      </g>
      <rect width="320" height="200" [attr.fill]="'url(#' + pid() + ')'" />
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
  protected readonly rows = [60, 80, 100, 120];
  protected readonly heads: [number, number, number, number][] = [[30, 120, 13, .6], [70, 112, 15, .8], [112, 124, 14, .7], [150, 108, 16, .9], [195, 118, 15, .75], [238, 110, 14, .85], [280, 122, 15, .65], [50, 150, 17, 1], [100, 158, 16, .95], [168, 150, 18, 1], [222, 156, 17, .9], [290, 152, 16, 1]];
  protected readonly bars = [40, 70, 55, 95, 80, 110];
  protected readonly c = computed(() => this.tone() === 'positive' ? { bg: '#efe6d0', light: '#fbf6ea', ink: '#1f3a5f', accent: '#c9a227' }
    : this.tone() === 'negative' ? { bg: '#ecd6cf', light: '#f8ece8', ink: '#4a1717', accent: '#b8322a' }
    : { bg: '#e8e1d3', light: '#f6f2ea', ink: '#2b2a28', accent: '#7a6a4f' });
  protected readonly up = computed(() => this.tone() !== 'negative');
  protected readonly pid = computed(() => `ht-${this.seed()}`);
  protected readonly gid = computed(() => `gr-${this.seed()}`);
  protected readonly label = computed(() => `Illustration : ${this.theme()}`);
  protected seatsOf(r: number) { return Array.from({ length: Math.round(r / 7) }, (_, i) => i); }
  protected cos(k: number, r: number) { const n = Math.round(r / 7); return Math.cos(Math.PI * (k + 0.5) / n); }
  protected sin(k: number, r: number) { const n = Math.round(r / 7); return Math.sin(Math.PI * (k + 0.5) / n); }
}

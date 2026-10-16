import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/* ============================================================
 *  Le combat tactique : une vraie bataille au tour par tour sur
 *  une grille. Chaque unité se déplace puis attaque ; le terrain
 *  protège (forêt, colline, ville) ou bloque (eau, îles) ; les
 *  défenseurs ripostent au contact. Trois variantes : bataille
 *  terrestre (guerre), bataille navale (pirates), défense contre
 *  les morts-vivants (épidémie Z). Sous-variante « manœuvres » :
 *  la bataille terrestre devient un exercice du temps de paix
 *  (Bleu contre une force adverse simulée, le plastron).
 *
 *  Rendu : une carte d'état-major (terrain dessiné en SVG, une
 *  seule couche statique), des pions de wargame portant des
 *  symboles militaires de type OTAN.
 * ============================================================ */

type Terrain = 'plaine' | 'foret' | 'colline' | 'eau' | 'ville' | 'mer' | 'ile' | 'port' | 'rue' | 'immeuble' | 'refuge';
type Side = 'p' | 'e';
type Mode = 'terre' | 'mer' | 'zombies';

interface UnitType { type: string; name: string; hp: number; mv: number; atk: number; rng: number; fly?: boolean; heavy?: boolean }
interface Unit extends UnitType { id: number; side: Side; x: number; y: number; px: number; py: number; moved: boolean; acted: boolean; max: number }
interface Fx { x: number; y: number; text: string; tone: 'fire' | 'hit' | 'kill' | 'miss'; id: number }
/** Un élément du fond de carte (chemin SVG agrégé) */
interface Shape { d: string; c: string; f?: string; fl?: string }

const W = 8, H = 7;

const TYPES: Record<string, UnitType> = {
  inf: { type: 'inf', name: 'Infanterie', hp: 7, mv: 2, atk: 3, rng: 1 },
  char: { type: 'char', name: 'Blindé', hp: 10, mv: 3, atk: 4, rng: 1, heavy: true },
  art: { type: 'art', name: 'Artillerie', hp: 5, mv: 1, atk: 4, rng: 3 },
  drone: { type: 'drone', name: 'Drone', hp: 4, mv: 4, atk: 2, rng: 2, fly: true },
  fregate: { type: 'fregate', name: 'Frégate', hp: 10, mv: 2, atk: 4, rng: 2, heavy: true },
  patrouilleur: { type: 'patrouilleur', name: 'Patrouilleur', hp: 6, mv: 3, atk: 3, rng: 1 },
  helico: { type: 'helico', name: 'Hélicoptère', hp: 5, mv: 4, atk: 3, rng: 2, fly: true },
  sousmarin: { type: 'sousmarin', name: 'Sous-marin', hp: 7, mv: 2, atk: 5, rng: 1 },
  pirate: { type: 'pirate', name: 'Vedette pirate', hp: 5, mv: 3, atk: 3, rng: 1 },
  cargo: { type: 'cargo', name: 'Navire-mère', hp: 9, mv: 1, atk: 3, rng: 2, heavy: true },
  gendarme: { type: 'gendarme', name: 'Gendarmes', hp: 7, mv: 2, atk: 3, rng: 1 },
  pompier: { type: 'pompier', name: 'Pompiers', hp: 8, mv: 3, atk: 2, rng: 1, heavy: true },
  tireur: { type: 'tireur', name: 'Tireurs d’élite', hp: 4, mv: 1, atk: 4, rng: 3 },
  zombie: { type: 'zombie', name: 'Mort-vivant', hp: 4, mv: 1, atk: 2, rng: 1 },
  horde: { type: 'horde', name: 'Horde', hp: 7, mv: 1, atk: 3, rng: 1, heavy: true },
};

const TERRAIN: Record<Terrain, { label: string; cost: number; def: number; block?: 'ground' | 'sea' | 'all' }> = {
  plaine: { label: 'Plaine', cost: 1, def: 0 }, foret: { label: 'Forêt', cost: 2, def: 1 }, colline: { label: 'Colline (+1 portée)', cost: 2, def: 1 },
  eau: { label: 'Rivière', cost: 1, def: 0, block: 'ground' }, ville: { label: 'Ville à tenir', cost: 1, def: 1 },
  mer: { label: 'Mer', cost: 1, def: 0 }, ile: { label: 'Récif', cost: 1, def: 0, block: 'sea' }, port: { label: 'Port à tenir', cost: 1, def: 1 },
  rue: { label: 'Rue', cost: 1, def: 0 }, immeuble: { label: 'Immeuble', cost: 1, def: 0, block: 'all' }, refuge: { label: 'Refuge à protéger', cost: 1, def: 2 },
};

const MODES: Record<Mode, { turns: number; objective: Terrain; brief: string; player: string[]; enemy: string[] }> = {
  terre: { turns: 8, objective: 'ville', brief: 'Tenez les villes en fin de bataille, ou détruisez l’ennemi.', player: ['inf', 'inf', 'char', 'art', 'drone'], enemy: ['inf', 'inf', 'inf', 'char', 'art'] },
  mer: { turns: 8, objective: 'port', brief: 'Reprenez les ports et coulez la flottille pirate.', player: ['fregate', 'patrouilleur', 'patrouilleur', 'helico', 'sousmarin'], enemy: ['pirate', 'pirate', 'pirate', 'pirate', 'cargo'] },
  zombies: { turns: 8, objective: 'refuge', brief: 'Protégez les refuges pendant huit tours : chaque refuge atteint par un mort-vivant est perdu.', player: ['gendarme', 'gendarme', 'pompier', 'tireur'], enemy: ['zombie', 'zombie', 'zombie', 'horde'] },
};

/** Légende de la carte, par variante */
const LEGEND: Record<Mode, [Terrain, string][]> = {
  terre: [['plaine', 'Plaine'], ['foret', 'Forêt · défense +1, coût 2'], ['colline', 'Colline · défense +1, portée +1'], ['eau', 'Rivière · passage aux gués'], ['ville', 'Ville · objectif, défense +1']],
  mer: [['mer', 'Haute mer'], ['ile', 'Récif · infranchissable aux navires'], ['port', 'Port · objectif, défense +1']],
  zombies: [['rue', 'Rue'], ['immeuble', 'Immeuble · infranchissable'], ['refuge', 'Refuge · à protéger, défense +2']],
};

let uid = 0;
let inst = 0;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/* ── Petite géométrie pour le fond de carte ── */
const f1 = (v: number) => Math.round(v * 10) / 10;
const circ = (cx: number, cy: number, r: number) => `M${f1(cx - r)} ${f1(cy)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0Z`;
const box = (x: number, y: number, w: number, h: number) => `M${f1(x)} ${f1(y)}h${f1(w)}v${f1(h)}h${f1(-w)}Z`;
const rbox = (x: number, y: number, w: number, h: number, r: number) =>
  `M${f1(x + r)} ${f1(y)}h${f1(w - 2 * r)}a${r} ${r} 0 0 1 ${r} ${r}v${f1(h - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${r}h${f1(2 * r - w)}a${r} ${r} 0 0 1 ${-r} ${-r}v${f1(2 * r - h)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
/** Courbe lissée (Catmull-Rom → Bézier) */
function smooth(p: [number, number][], closed: boolean): string {
  const n = p.length;
  const at = (i: number) => (closed ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f1(p[0][0])} ${f1(p[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1), e = at(i + 2);
    d += `C${f1(b[0] + (c[0] - a[0]) / 6)} ${f1(b[1] + (c[1] - a[1]) / 6)} ${f1(c[0] - (e[0] - b[0]) / 6)} ${f1(c[1] - (e[1] - b[1]) / 6)} ${f1(c[0])} ${f1(c[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
/** Forme organique (îlot, courbe de niveau) */
function blob(cx: number, cy: number, r: number, k: number, rnd: () => number, n = 11, sx = 1): string {
  const ph = rnd() * 6.28, a2 = rnd() * 0.5;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const rr = r * (1 + k * (Math.sin(t * 2 + ph) * 0.5 + Math.sin(t * 3 - ph) * a2 + (rnd() - 0.5) * 0.6));
    pts.push([cx + Math.cos(t) * rr * sx, cy + Math.sin(t) * rr]);
  }
  return smooth(pts, true);
}

@Component({
  selector: 'app-tactique-game',
  template: `
    <div class="tac" [class]="'tac m-' + mode" [class.ex]="exercise">
      <div class="head" role="group" [attr.aria-label]="opName">
        <div class="hud-top">
          <span class="op">{{ opName }}</span>
          <span class="turn">Tour <b class="mono">{{ two(turn()) }}</b><span class="mono dim">/{{ two(maxTurns) }}</span></span>
        </div>
        <div class="track" aria-hidden="true">@for (k of turnsArr; track k) { <i [class.past]="k < turn()" [class.now]="k === turn()"></i> }</div>
        <div class="hud-bot">
          <span class="obj"><span class="pips" aria-hidden="true">@for (s of objPips(); track $index) { <i [class]="'pip ' + s"></i> }</span>{{ objText() }}</span>
          <span class="forces"><span class="lab">{{ exercise ? 'Bleu' : 'Vous' }}</span> <b class="p mono">{{ alive('p') }}</b> <span class="vs">contre</span> <b class="e mono">{{ alive('e') }}</b> <span class="lab">{{ foeLabel }}</span></span>
        </div>
      </div>
      <p class="brief">@if (!over()) { {{ brief }} {{ hintText() }} } @else { <b>{{ message() }}</b> }</p>

      <div class="frame">
        <div class="cols mono" aria-hidden="true">@for (c of colsArr; track c) { <span>{{ c }}</span> }</div>
        <div class="rows mono" aria-hidden="true">@for (r of rowsArr; track r) { <span>{{ r }}</span> }</div>
        <div class="board" [style.grid-template-columns]="'repeat(' + w + ', 1fr)'" role="grid" [attr.aria-label]="exercise ? 'Terrain de manœuvre' : mode === 'mer' ? 'Zone d’opérations navales' : mode === 'zombies' ? 'Quartier des refuges' : 'Champ de bataille'">
          <svg class="terrain" viewBox="0 0 800 700" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient [attr.id]="uid + '-grass'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a9b67f" /><stop offset=".55" stop-color="#9caf74" /><stop offset="1" stop-color="#93a76c" /></linearGradient>
              <linearGradient [attr.id]="uid + '-sea'" x1="0" y1=".2" x2="1" y2=".8"><stop offset="0" stop-color="#10293f" /><stop offset=".45" stop-color="#1d4a66" /><stop offset=".8" stop-color="#2c6b84" /><stop offset="1" stop-color="#3d8296" /></linearGradient>
              <linearGradient [attr.id]="uid + '-asph'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3d43" /><stop offset="1" stop-color="#303338" /></linearGradient>
              <radialGradient [attr.id]="uid + '-hill'" cx=".36" cy=".32" r=".75"><stop offset="0" stop-color="#fff6dc" stop-opacity=".55" /><stop offset=".55" stop-color="#fff6dc" stop-opacity="0" /><stop offset="1" stop-color="#3b2a12" stop-opacity=".35" /></radialGradient>
              <radialGradient [attr.id]="uid + '-shoal'"><stop offset=".35" stop-color="#7cc3bd" stop-opacity=".85" /><stop offset="1" stop-color="#4f9fae" stop-opacity="0" /></radialGradient>
              <radialGradient [attr.id]="uid + '-lamp'"><stop offset="0" stop-color="#ffdc94" stop-opacity=".7" /><stop offset=".35" stop-color="#ffc764" stop-opacity=".28" /><stop offset="1" stop-color="#ffc764" stop-opacity="0" /></radialGradient>
              <radialGradient [attr.id]="uid + '-night'" cx=".5" cy=".5" r=".72"><stop offset=".25" stop-color="#0a1024" stop-opacity="0" /><stop offset="1" stop-color="#050812" stop-opacity=".72" /></radialGradient>
              <radialGradient [attr.id]="uid + '-flood'"><stop offset="0" stop-color="#f4f1e2" stop-opacity=".4" /><stop offset="1" stop-color="#f4f1e2" stop-opacity="0" /></radialGradient>
              <pattern [attr.id]="uid + '-furA'" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><rect width="7" height="7" fill="#b9b47a" /><path d="M0 1.5h7" stroke="#8f8a55" stroke-width="1.1" opacity=".55" /></pattern>
              <pattern [attr.id]="uid + '-furB'" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-62)"><rect width="6" height="6" fill="#a7b06f" /><path d="M0 1.5h6" stroke="#7d8a4c" stroke-width="1" opacity=".5" /></pattern>
              <pattern [attr.id]="uid + '-furC'" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(5)"><rect width="8" height="8" fill="#c2b07c" /><path d="M0 2h8" stroke="#9b8352" stroke-width="1.2" opacity=".45" /></pattern>
              <pattern [attr.id]="uid + '-crest'" width="38" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)"><path d="M3 8q5-4 10 0M22 18q5-4 10 0" fill="none" stroke="#d9eef5" stroke-width="1.1" stroke-linecap="round" /></pattern>
              <filter [attr.id]="uid + '-grain'" x="0" y="0" width="800" height="700" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="2" seed="4" /><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -.6 .38" /></filter>
              <filter [attr.id]="uid + '-mottle'" x="0" y="0" width="800" height="700" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency=".011" numOctaves="3" seed="9" /><feColorMatrix type="matrix" values="0 0 0 0 .55  0 0 0 0 .6  0 0 0 0 .28  0 0 0 -1.6 .9" /></filter>
              <filter [attr.id]="uid + '-swell'" x="0" y="0" width="800" height="700" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency=".005 .085" numOctaves="2" seed="2" /><feColorMatrix type="matrix" values="0 0 0 0 .85  0 0 0 0 .93  0 0 0 0 1  0 0 0 1.5 -.78" /></filter>
              <!-- Cadres des symboles militaires (ami, hostile, aérien ami) -->
              <g [attr.id]="uid + '-fr-p'"><rect x="4" y="5" width="32" height="19" fill="#a8d8f2" stroke="#10161d" stroke-width="1.7" /></g>
              <g [attr.id]="uid + '-fr-a'"><path d="M4 24V15.5C4 9 11 5 20 5s16 4 16 10.5V24" fill="#a8d8f2" stroke="#10161d" stroke-width="1.7" /></g>
              <g [attr.id]="uid + '-fr-e'"><path d="M20 1.5 36.5 14.5 20 27.5 3.5 14.5Z" fill="#f4a196" stroke="#10161d" stroke-width="1.7" /></g>
              <!-- Échelon (bataillon) -->
              <g [attr.id]="uid + '-ech'"><path d="M18.4 .4v3.4M21.6 .4v3.4" stroke="#10161d" stroke-width="1.3" /></g>
              <!-- Signes : terre -->
              <g [attr.id]="uid + '-g-inf'"><path d="M4.8 5.8 35.2 23.2M4.8 23.2 35.2 5.8" stroke="#10161d" stroke-width="1.6" /></g>
              <g [attr.id]="uid + '-g-char'"><rect x="10.5" y="10" width="19" height="9" rx="4.5" fill="none" stroke="#10161d" stroke-width="1.6" /></g>
              <g [attr.id]="uid + '-g-art'"><circle cx="20" cy="14.5" r="3.6" fill="#10161d" /></g>
              <g [attr.id]="uid + '-g-drone'"><path d="M10.5 11.5 20 17.5 29.5 11.5 29.5 14.2 20 21 10.5 14.2Z" fill="#10161d" /></g>
              <!-- Signes : forces de l'ordre et secours -->
              <g [attr.id]="uid + '-g-gendarme'"><path d="M20 7.6 26.4 9.8V14.4C26.4 18.3 23.9 20.6 20 22.2 16.1 20.6 13.6 18.3 13.6 14.4V9.8Z" fill="#1b2c4d" /><path d="M20 11.2l1 2.1 2.2.2-1.7 1.4.6 2.2-2.1-1.2-2.1 1.2.6-2.2-1.7-1.4 2.2-.2Z" fill="#f2d27a" /></g>
              <g [attr.id]="uid + '-g-pompier'"><path d="M20 6.8C23 10.6 26.2 12.7 25.8 17.3 25.4 20.8 22.8 22.8 20 22.8S14.6 20.8 14.3 17.6C14 14.3 16.3 12.6 17.3 10.4 18 12.8 18.9 13.8 19.9 14.3 20.4 11.8 20.3 9.3 20 6.8Z" fill="#b52f1f" /><path d="M20 15.5C21.4 17.2 22.4 18.3 22.1 19.8 21.8 21 21 21.6 20 21.6S18.2 21 18 19.9C17.8 18.7 18.6 17.8 20 15.5Z" fill="#f2b54a" /></g>
              <g [attr.id]="uid + '-g-tireur'"><circle cx="20" cy="14.5" r="6" fill="none" stroke="#10161d" stroke-width="1.5" /><path d="M20 6.2v4.6M20 18.2v4.6M11.7 14.5h4.6M23.7 14.5h4.6" stroke="#10161d" stroke-width="1.5" /><circle cx="20" cy="14.5" r="1.1" fill="#b52f1f" /></g>
              <!-- Silhouettes vues du ciel : marine -->
              <g [attr.id]="uid + '-g-fregate'"><path d="M1.5 14.5C5 7.6 26 7.2 38.5 14.5 26 21.8 5 21.4 1.5 14.5Z" fill="#cdd5dc" stroke="#0e1419" stroke-width=".9" /><path d="M23 14.5H36" stroke="#9aa5ae" stroke-width=".6" /><rect x="12.5" y="10.6" width="11" height="7.8" rx="1" fill="#7d8892" stroke="#3b444c" stroke-width=".5" /><rect x="15.5" y="12" width="5" height="5" fill="#4d5762" /><circle cx="30.5" cy="14.5" r="2" fill="#4d5762" /><path d="M30.5 14.5h5" stroke="#4d5762" stroke-width="1" /><rect x="3.4" y="10.8" width="6.4" height="7.4" fill="none" stroke="#eef1f3" stroke-width=".6" /><path d="M5.4 12.6v3.8M7.8 12.6v3.8M5.4 14.5h2.4" stroke="#eef1f3" stroke-width=".5" /></g>
              <g [attr.id]="uid + '-g-patrouilleur'"><path d="M5 14.5C8.5 9.4 25 9 35 14.5 25 20 8.5 19.6 5 14.5Z" fill="#cfd6dc" stroke="#0e1419" stroke-width=".9" /><rect x="13.5" y="11.6" width="9" height="5.8" rx="1" fill="#76818b" stroke="#3b444c" stroke-width=".5" /><rect x="15" y="12.6" width="3.5" height="3.8" fill="#47515b" /><circle cx="28.5" cy="14.5" r="1.5" fill="#4d5762" /></g>
              <g [attr.id]="uid + '-g-sousmarin'"><path d="M3.5 14.5C4 10.4 31 10 36.5 14.5 31 19 4 18.6 3.5 14.5Z" fill="#262d34" stroke="#d3dce3" stroke-width=".8" /><rect x="17" y="12.2" width="7.5" height="4.6" rx="2.3" fill="#48515a" stroke="#d3dce3" stroke-width=".5" /><path d="M3.8 14.5 1 11.2M3.8 14.5 1 17.8" stroke="#262d34" stroke-width="1.5" stroke-linecap="round" /><path d="M36.5 14.5h2" stroke="#d3dce3" stroke-width=".6" stroke-dasharray="1 .8" /></g>
              <g [attr.id]="uid + '-g-helico'"><circle cx="20" cy="14.5" r="12.6" fill="#e3eaf0" opacity=".2" stroke="#e3eaf0" stroke-width=".5" /><path d="M10 4.5 30 24.5M30 4.5 10 24.5" stroke="#0e1419" stroke-width="1" opacity=".75" /><path d="M14 14.5C14 11.2 17 10.2 21.5 10.6 26 11 28 12.6 28 14.5S26 18 21.5 18.4C17 18.8 14 17.8 14 14.5Z" fill="#cdd5dc" stroke="#0e1419" stroke-width=".8" /><path d="M24 12.2c2 .6 2.8 1.4 2.8 2.3s-.8 1.7-2.8 2.3" fill="#5c6a77" /><path d="M14.2 14.5H3.5" stroke="#cdd5dc" stroke-width="2" /><path d="M3.5 11.6v5.8" stroke="#0e1419" stroke-width="1.3" /></g>
              <g [attr.id]="uid + '-g-pirate'"><path d="M7 14.5C11 9.6 25 9.4 34 14.5 25 19.6 11 19.4 7 14.5Z" fill="#ece7dc" stroke="#0e1419" stroke-width=".9" /><rect x="15" y="12.2" width="6" height="4.6" rx=".8" fill="#3a3f45" /><rect x="23" y="12.8" width="3" height="3.4" rx=".6" fill="#3a3f45" /><rect x="4.5" y="12.8" width="3.2" height="3.4" fill="#22272c" /><path d="M34 14.5h4" stroke="#ece7dc" stroke-width=".9" stroke-dasharray="1.2 1" /></g>
              <g [attr.id]="uid + '-g-cargo'"><path d="M2 8.6H30C35.5 9.2 38.5 12.4 38.5 14.5S35.5 19.8 30 20.4H2Z" fill="#59616a" stroke="#0e1419" stroke-width=".9" /><rect x="4" y="9.8" width="6" height="4.2" fill="#c46a3d" /><rect x="4" y="15" width="6" height="4.2" fill="#3f7a8f" /><rect x="11" y="9.8" width="6" height="4.2" fill="#d6b04c" /><rect x="11" y="15" width="6" height="4.2" fill="#c46a3d" /><rect x="18" y="9.8" width="6" height="4.2" fill="#3f7a8f" /><rect x="18" y="15" width="6" height="4.2" fill="#9a9f6b" /><rect x="25.5" y="10.4" width="4" height="8.2" fill="#e6e8e9" stroke="#59616a" stroke-width=".4" /></g>
              <!-- Silhouettes : morts-vivants (titubants, sans gore) -->
              <g [attr.id]="uid + '-g-zombie'" stroke="#e6dcc7" stroke-linecap="round" stroke-linejoin="round" fill="none"><circle cx="17" cy="6.6" r="2.6" fill="#e6dcc7" stroke="none" /><path d="M18.6 9.3 21.4 17.1" stroke-width="3" /><path d="M19 10.6 12.2 12.4M19.6 12 13.3 15" stroke-width="1.7" /><path d="M21.3 17 18.4 24.2M21.3 17 25 23.6" stroke-width="2" /></g>
              <g [attr.id]="uid + '-g-horde'" stroke="#e6dcc7" stroke-linecap="round" stroke-linejoin="round" fill="none">
                <g opacity=".55" transform="translate(9 -1.5) scale(.85)"><circle cx="17" cy="6.6" r="2.6" fill="#e6dcc7" stroke="none" /><path d="M18.6 9.3 21.4 17.1" stroke-width="3" /><path d="M19 10.6 12.2 12.4" stroke-width="1.7" /><path d="M21.3 17 18.4 24.2M21.3 17 25 23.6" stroke-width="2" /></g>
                <g opacity=".75" transform="translate(-8 0) scale(.92)"><circle cx="17" cy="6.6" r="2.6" fill="#e6dcc7" stroke="none" /><path d="M18.6 9.3 21.4 17.1" stroke-width="3" /><path d="M19 10.6 12.2 12.4M19.6 12 13.3 15" stroke-width="1.7" /><path d="M21.3 17 18.4 24.2M21.3 17 25 23.6" stroke-width="2" /></g>
                <g transform="translate(1 2)"><circle cx="17" cy="6.6" r="2.6" fill="#e6dcc7" stroke="none" /><path d="M18.6 9.3 21.4 17.1" stroke-width="3" /><path d="M19 10.6 12.2 12.4M19.6 12 13.3 15" stroke-width="1.7" /><path d="M21.3 17 18.4 24.2M21.3 17 25 23.6" stroke-width="2" /></g>
              </g>
            </defs>
            @for (s of art; track $index) { <path [attr.d]="s.d" [attr.class]="s.c" [attr.fill]="s.f ?? null" [attr.filter]="s.fl ?? null" /> }
          </svg>
          @for (cell of cells; track $index; let i = $index) {
            @let u = unitAt(i % w, floor(i / w));
            <button type="button" class="cell" [class]="'cell t-' + cell" [class.reach]="reach().has(i)" [class.target]="targets().has(i)"
                    [class.sel]="u && sel() === u.id" [class.owned]="ctrl()[i] === 'p'" [class.lost]="ctrl()[i] === 'e'" [disabled]="over() || busy()"
                    (click)="click(i % w, floor(i / w))" [attr.aria-label]="terrainLabel(cell) + (u ? ' : ' + u.name + ' ' + sideWord(u.side) + ', ' + u.hp + ' PV' : '')">
              @if (u) {
                @for (z of [u]; track z.id) {
                  <span class="unit" [class.enemy]="z.side === 'e'" [class.done]="z.side === 'p' && z.moved && z.acted" [class.slide]="z.px !== z.x || z.py !== z.y"
                        [style.--dx]="z.px - z.x" [style.--dy]="z.py - z.y">
                    <svg class="sym" viewBox="0 0 40 28" aria-hidden="true">
                      @if (frameOf(z); as fr) { <use [attr.href]="'#' + uid + '-fr-' + fr" /> }
                      @if (frameOf(z) === 'p' && mode === 'terre') { <use [attr.href]="'#' + uid + '-ech'" /> }
                      <use [attr.href]="'#' + uid + '-g-' + z.type" [attr.transform]="glyphTf(z)" />
                    </svg>
                    <i class="hp" [class.mid]="z.hp / z.max <= .6" [class.low]="z.hp / z.max <= .3"><em [style.width.%]="z.hp / z.max * 100"></em></i>
                  </span>
                }
              }
              @for (f of fxAt(i % w, floor(i / w)); track f.id) { <span class="fx" [class]="'fx ' + f.tone"><span class="burst"></span>@if (f.text) { <b>{{ f.text }}</b> }</span> }
            </button>
          }
        </div>
      </div>

      <ul class="legend" aria-label="Légende">
        @for (l of legend; track l[0]) { <li><i [class]="'sw s-' + l[0]"></i>{{ l[1] }}</li> }
      </ul>

      <div class="side">
        @if (selUnit(); as u) {
          <div class="card-u">
            <span class="unit mini" [class.enemy]="u.side === 'e'">
              <svg class="sym" viewBox="0 0 40 28" aria-hidden="true">
                @if (frameOf(u); as fr) { <use [attr.href]="'#' + uid + '-fr-' + fr" /> }
                <use [attr.href]="'#' + uid + '-g-' + u.type" [attr.transform]="glyphTf(u)" />
              </svg>
            </span>
            <div class="info">
              <b>{{ u.name }}</b> <span class="mono">{{ u.hp }}/{{ u.max }} PV</span>
              <small class="mono">DÉP {{ u.mv }} · ATT {{ u.atk }} · PORT {{ u.rng }}@if (u.fly) { · AÉRIEN }</small>
              <small>{{ u.moved ? (u.acted ? 'A déjà agi.' : 'Peut encore attaquer.') : 'Choisissez une case hachurée bleue, ou une cible rouge.' }}</small>
            </div>
          </div>
        } @else if (!over()) { <p class="muted small">Touchez un de vos pions pour le déplacer (cases hachurées bleues) puis attaquer (cibles rouges).</p> }
        <ul class="log" aria-label="Journal des opérations">@for (l of log(); track $index) { <li>{{ l }}</li> }</ul>
        @if (!over()) { <button class="btn primary small end" [disabled]="busy()" (click)="endTurn()">Fin du tour →</button> }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%;
      --hud: #151a16; --hud-2: #1f2620; --hud-ink: #d6e2cf; --hud-dim: #7f8f7c; --hud-amber: #f0b83c;
      --blue: #3d6f9f; --blue-ink: #2f6fb3; --red: #a6392c; --frame: #2a2b27; --frame-ink: #5b5d55; }
    .tac { display: grid; gap: 8px; min-width: 0; }

    /* ── Bandeau d'opérations ── */
    .head { display: grid; gap: 5px; padding: 8px 10px 7px; border-radius: 8px; background: linear-gradient(180deg, var(--hud-2), var(--hud)); color: var(--hud-ink);
      border: 1px solid #000; box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 1px 3px rgba(0,0,0,.25); font: 600 11.5px var(--font-mono, ui-monospace, monospace); letter-spacing: .02em; }
    .hud-top, .hud-bot { display: flex; flex-wrap: wrap; gap: 4px 12px; justify-content: space-between; align-items: center; }
    .op { font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--hud-amber); }
    .turn { text-transform: uppercase; font-size: 11px; b { font-size: 15px; color: #fff; } .dim { color: var(--hud-dim); } }
    .track { display: grid; grid-auto-flow: column; gap: 3px; i { height: 4px; border-radius: 1px; background: #343c34; } i.past { background: #6d7f69; } i.now { background: var(--hud-amber); box-shadow: 0 0 6px rgba(240,184,60,.6); } }
    .obj { display: inline-flex; align-items: center; gap: 6px; font-weight: 500; }
    .pips { display: inline-flex; gap: 3px; .pip { width: 9px; height: 9px; border-radius: 50%; border: 1.5px solid #9aa596; } .pip.p { background: #6fa8dc; border-color: #9cc6ee; } .pip.e { background: #d9604c; border-color: #ef8e7c; } }
    .forces { display: inline-flex; align-items: baseline; gap: 5px; .lab { font-size: 10px; color: var(--hud-dim); text-transform: uppercase; letter-spacing: .08em; } .vs { color: var(--hud-dim); font-weight: 400; }
      b { font-size: 14px; } .p { color: #8fc2f0; } .e { color: #f08f7c; } }
    .brief { margin: 0; font-size: 12.5px; color: var(--ink-2); }

    /* ── Carte d'état-major ── */
    .frame { display: grid; grid-template-columns: 13px minmax(0, 1fr); grid-template-rows: 13px auto; width: 100%; max-width: 560px; justify-self: center; padding: 4px 6px 6px 3px;
      border-radius: 6px; background: #e9e3d3; border: 1px solid #c9c0aa; box-shadow: 0 1px 4px rgba(40,30,10,.18); }
    .cols { grid-column: 2; grid-row: 1; display: grid; grid-template-columns: repeat(8, 1fr); }
    .rows { grid-column: 1; grid-row: 2; display: grid; grid-template-rows: repeat(7, 1fr); }
    .cols span, .rows span { display: grid; place-items: center; font-size: 9px; font-weight: 700; color: #6d6656; }
    .board { grid-column: 2; grid-row: 2; position: relative; display: grid; width: 100%; user-select: none; container-type: inline-size; outline: 2px solid var(--frame); background: #77806a; }
    .terrain { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .grain { mix-blend-mode: multiply; opacity: .55; } .mottle { mix-blend-mode: soft-light; }
    .hedge { fill: none; stroke: #55693c; stroke-width: 2.2; stroke-linecap: round; stroke-dasharray: 3 2.2; opacity: .85; }
    .ffloor { fill: #536f3c; } .tshade { fill: #1d2a14; opacity: .42; } .tcrown { fill: #5b7b40; stroke: #3d5529; stroke-width: .8; } .thigh { fill: #87a65e; opacity: .75; }
    .tcrown2 { fill: #4e6d38; stroke: #34491f; stroke-width: .8; }
    .h0 { fill: #b3a674; fill-opacity: .6; stroke: #7a5a32; stroke-width: 2.2; } .h1 { fill: #c2ae7e; fill-opacity: .6; stroke: #8b6c43; stroke-width: 1.5; }
    .h2 { fill: #cfba8b; fill-opacity: .65; stroke: #8b6c43; stroke-width: 1.5; } .h3 { fill: #ddca9c; fill-opacity: .75; stroke: #6e5130; stroke-width: 1.8; } .hshade { opacity: 1; }
    .rbank { fill: none; stroke: #6f7b4c; stroke-width: 52; stroke-linecap: round; opacity: .55; } .rmud { fill: none; stroke: #b3a378; stroke-width: 42; stroke-linecap: round; }
    .rwater { fill: none; stroke: #4b7a9c; stroke-width: 34; stroke-linecap: round; } .rdeep { fill: none; stroke: #355f80; stroke-width: 15; stroke-linecap: round; opacity: .8; }
    .rflow { fill: none; stroke: #d6e8f2; stroke-width: 1.3; stroke-dasharray: 7 16; stroke-linecap: round; opacity: .55; animation: flow 3.2s linear infinite; }
    .ford { fill: #9fbccb; stroke: #cdbb8d; stroke-width: 3; stroke-dasharray: 2 3; } .stones { fill: #8f8a7c; }
    .piste { fill: none; stroke: #c6b088; stroke-width: 7; stroke-linecap: round; opacity: .9; } .pisteE { fill: none; stroke: #9a865f; stroke-width: 8.5; stroke-linecap: round; opacity: .35; }
    .pave { fill: #d3cbbb; } .street { fill: none; stroke: #e7e1d3; stroke-width: 6; stroke-linecap: round; }
    .bshadow { fill: #000; opacity: .32; } .roofA { fill: #b65f3c; stroke: #7e3c22; stroke-width: .8; } .roofB { fill: #7c7d7d; stroke: #4e4f50; stroke-width: .8; } .roofC { fill: #a2553a; stroke: #6c3420; stroke-width: .8; }
    .ridge { fill: none; stroke: #e7b49a; stroke-width: 1; opacity: .7; } .ridgeB { fill: none; stroke: #b7b9ba; stroke-width: 1; opacity: .7; }
    .objring { fill: none; stroke: #1d1f22; stroke-width: 2.2; stroke-dasharray: 9 5; opacity: .75; }
    .objringL { fill: none; stroke: #f2efe6; stroke-width: 2.2; stroke-dasharray: 9 5; opacity: .8; }
    .swell { mix-blend-mode: screen; opacity: .7; } .iso { fill: none; stroke: #b8d6e4; stroke-width: 1.3; stroke-dasharray: 2 5; opacity: .6; } .crest { opacity: .3; }
    .sand { fill: #d6c697; } .rock { fill: #7d6f58; stroke: #4f4536; stroke-width: 1; } .rockhi { fill: #a09078; } .surf { fill: none; stroke: #f4fbff; stroke-width: 2; stroke-dasharray: 4 3; opacity: .75; }
    .scrub { fill: #6c8048; } .shoalP { opacity: .6; }
    .basin { fill: #4f8aa1; } .jetty { fill: none; stroke: #9aa0a2; stroke-width: 8; stroke-linecap: round; } .jettyE { fill: none; stroke: #5d6365; stroke-width: 10; stroke-linecap: round; opacity: .55; }
    .quay { fill: #b9bab3; stroke: #7d7f79; stroke-width: 1; } .bollard { fill: #3a3d40; } .crane { fill: none; stroke: #d39b2e; stroke-width: 2; }
    .lane { fill: none; stroke: #c8b25c; stroke-width: 2; stroke-dasharray: 11 9; opacity: .42; }
    .walk { fill: #5c5f63; stroke: #75787b; stroke-width: 1.5; } .carA { fill: #7a2f27; } .carB { fill: #2d4a6b; } .carC { fill: #8c8f91; } .carD { fill: #c9c4b6; } .glass { fill: #1a222b; opacity: .85; }
    .roofN1 { fill: #50545b; stroke: #2a2d31; stroke-width: 3; } .roofN2 { fill: #5c574d; stroke: #2e2b26; stroke-width: 3; } .roofN3 { fill: #45525a; stroke: #232b2e; stroke-width: 3; }
    .ac { fill: #8a8f94; stroke: #2f3337; stroke-width: .8; } .sky { fill: #1d2a35; stroke: #6c8597; stroke-width: .8; }
    .sandbag { fill: none; stroke: #a8946a; stroke-width: 6; stroke-dasharray: 7 2; stroke-linecap: round; } .roofR { fill: #8b9397; stroke: #3f4548; stroke-width: 2; }
    .pcO { fill: #e07a1f; } .pcB { fill: #2457a6; }
    .lampdot { fill: #fff2c4; }

    /* ── Cases ── */
    .cell { position: relative; aspect-ratio: 1; border: 0; border-radius: 0; padding: 0; margin: 0; cursor: pointer; display: grid; place-items: center; overflow: visible; background: transparent; color: inherit;
      box-shadow: inset -.5px -.5px 0 rgba(20,24,18,.28); -webkit-tap-highlight-color: transparent;
      &:disabled { cursor: default; } &:focus-visible { outline: 2px solid #fff; outline-offset: -3px; z-index: 2; } }
    .m-mer .sym { width: 94%; margin-top: -12%; }
    .m-mer .cell { box-shadow: inset -.5px -.5px 0 rgba(200,230,245,.16); } .m-zombies .cell { box-shadow: inset -.5px -.5px 0 rgba(200,210,230,.1); }
    .cell.reach::after { content: ''; position: absolute; inset: 1px; pointer-events: none;
      background: repeating-linear-gradient(135deg, rgba(70,150,240,.62) 0 2px, rgba(70,150,240,.12) 2px 6px); box-shadow: inset 0 0 0 1.5px rgba(150,200,255,.95); }
    .cell.target::after { content: ''; position: absolute; inset: 1px; pointer-events: none; z-index: 2;
      background: repeating-linear-gradient(45deg, rgba(220,45,35,.5) 0 2px, transparent 2px 6px), repeating-linear-gradient(135deg, rgba(220,45,35,.5) 0 2px, transparent 2px 6px);
      box-shadow: inset 0 0 0 2px rgba(255,90,70,.95); animation: pulse 1.2s ease-in-out infinite; }
    .cell.sel { z-index: 2; box-shadow: 0 0 14px rgba(255,207,58,.6);
      background: linear-gradient(#ffcf3a, #ffcf3a) top left / 30% 3px, linear-gradient(#ffcf3a, #ffcf3a) top left / 3px 30%,
        linear-gradient(#ffcf3a, #ffcf3a) top right / 30% 3px, linear-gradient(#ffcf3a, #ffcf3a) top right / 3px 30%,
        linear-gradient(#ffcf3a, #ffcf3a) bottom left / 30% 3px, linear-gradient(#ffcf3a, #ffcf3a) bottom left / 3px 30%,
        linear-gradient(#ffcf3a, #ffcf3a) bottom right / 30% 3px, linear-gradient(#ffcf3a, #ffcf3a) bottom right / 3px 30%, rgba(255,207,58,.16);
      background-repeat: no-repeat; }
    .cell.owned::before, .cell.lost::before { content: ''; position: absolute; inset: 5%; border-radius: 50%; pointer-events: none;
      border: 3px dashed #4f9be8; box-shadow: 0 0 0 1px rgba(0,0,0,.35), inset 0 0 0 1px rgba(0,0,0,.35), 0 0 10px rgba(79,155,232,.5); }
    .cell.lost::before { border-color: #e2503c; box-shadow: 0 0 0 1px rgba(0,0,0,.35), inset 0 0 0 1px rgba(0,0,0,.35), 0 0 10px rgba(226,80,60,.5); }
    @keyframes pulse { 50% { opacity: .55; } }
    @keyframes flow { to { stroke-dashoffset: -46; } }

    /* ── Pions ── */
    .unit { position: relative; z-index: 1; display: grid; place-items: center; width: 80%; aspect-ratio: 1; border-radius: 3px;
      background: linear-gradient(155deg, #6d97c3, var(--blue) 55%, #2c5479); border: 1px solid #1a2f45;
      box-shadow: inset 1px 1px 0 rgba(255,255,255,.35), inset -1px -1px 0 rgba(0,0,0,.3), 1px 2px 3px rgba(0,0,0,.55);
      transition: transform .18s ease, filter .25s ease, box-shadow .18s ease;
      &.enemy { background: linear-gradient(155deg, #c76a5c, var(--red) 55%, #79251c); border-color: #4a150f; }
      &.done { filter: saturate(.35) brightness(.86); }
      &.slide { animation: slide .34s cubic-bezier(.25,.7,.3,1); } }
    .m-zombies .unit.enemy { background: linear-gradient(155deg, #6e5047, #4d342e 60%, #352320); border-color: #1d1210; box-shadow: inset 0 0 0 1px rgba(200,70,55,.6), 1px 2px 3px rgba(0,0,0,.6); }
    .sym { width: 86%; height: auto; margin-top: -14%; overflow: visible; filter: drop-shadow(0 .5px 0 rgba(0,0,0,.25)); }
    .hp { position: absolute; left: 10%; right: 10%; bottom: 9%; height: 9%; max-height: 4px; min-height: 2.5px; border-radius: 1px; background: rgba(0,0,0,.5); overflow: hidden;
      em { display: block; height: 100%; background: #6fd08c; transition: width .3s ease; } &.mid em { background: #f0c24a; } &.low em { background: #f0604a; } }
    .cell.sel .unit { transform: translateY(-2px) scale(1.07); box-shadow: inset 1px 1px 0 rgba(255,255,255,.4), inset -1px -1px 0 rgba(0,0,0,.3), 2px 5px 7px rgba(0,0,0,.55); }
    @keyframes slide { from { transform: translate(calc(var(--dx) * 12.5cqw), calc(var(--dy) * 12.5cqw)); } }

    /* ── Effets : départ de coup, impact, destruction ── */
    .fx { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; pointer-events: none;
      .burst { position: absolute; left: 50%; top: 50%; width: 70%; aspect-ratio: 1; border-radius: 50%; transform: translate(-50%, -50%) scale(.3); opacity: 0; }
      b { position: relative; top: -34%; padding: 0 3px; border-radius: 2px; font: 700 clamp(9px, 2.6vw, 11px) var(--font-mono, monospace); color: #fff; background: rgba(15,15,15,.78); animation: rise .9s ease forwards; } }
    .fx.fire .burst { width: 46%; background: radial-gradient(circle, #fffbe6 0, #ffd56a 30%, rgba(255,150,40,.4) 55%, transparent 70%); animation: flash .28s ease-out; }
    .fx.hit .burst { background: radial-gradient(circle, rgba(255,240,200,.95) 0, rgba(255,170,60,.7) 28%, rgba(120,60,20,.25) 55%, transparent 70%); animation: impact .5s ease-out; }
    .fx.kill .burst { width: 95%; background: radial-gradient(circle, rgba(255,245,215,.95) 0, rgba(255,150,50,.75) 25%, rgba(70,60,55,.55) 52%, transparent 70%); animation: boom .85s ease-out; }
    .fx.miss .burst { background: radial-gradient(circle, rgba(255,255,255,.7) 0, rgba(200,200,200,.25) 45%, transparent 70%); animation: impact .45s ease-out; }
    .fx.miss b { background: rgba(60,60,60,.85); }
    .ex .fx.kill .burst { background: radial-gradient(circle, rgba(255,255,240,.9) 0, rgba(245,232,160,.7) 35%, rgba(230,226,210,.4) 55%, transparent 72%); }
    @keyframes flash { 0% { opacity: 1; transform: translate(-50%, -50%) scale(.4); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.25); } }
    @keyframes impact { 0% { opacity: 1; transform: translate(-50%, -50%) scale(.35); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.15); } }
    @keyframes boom { 0% { opacity: 1; transform: translate(-50%, -50%) scale(.3); } 45% { opacity: .9; } 100% { opacity: 0; transform: translate(-50%, -50%) scale(1.45); } }
    @keyframes rise { 0% { transform: translateY(4px); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(-12px); opacity: 0; } }

    /* ── Légende ── */
    .legend { list-style: none; margin: -2px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 3px 12px; justify-content: center; font-size: 11px; color: var(--ink-2);
      li { display: inline-flex; align-items: center; gap: 5px; } }
    .sw { width: 14px; height: 11px; border-radius: 2px; border: 1px solid rgba(0,0,0,.35); flex: 0 0 auto; }
    .s-plaine { background: #a1b277; } .s-foret { background: radial-gradient(circle at 30% 40%, #87a65e 0 18%, transparent 22%), radial-gradient(circle at 70% 60%, #5b7b40 0 30%, transparent 34%), #4e6d38; }
    .s-colline { background: repeating-radial-gradient(circle at 50% 70%, #d3bf8e 0 2px, #8b6c43 2px 3px); } .s-eau { background: linear-gradient(90deg, #b3a378 0 20%, #4b7a9c 20% 80%, #b3a378 80%); }
    .s-ville { background: linear-gradient(90deg, transparent 45%, #e7e1d3 45% 58%, transparent 58%), linear-gradient(#b65f3c 0 45%, #d3cbbb 45% 58%, #7c7d7d 58%); }
    .s-mer { background: linear-gradient(90deg, #173650, #2f6a82); } .s-ile { background: radial-gradient(circle, #7d6f58 0 30%, #d6c697 32% 55%, #4f9fae 58%); }
    .s-port { background: linear-gradient(90deg, #4f8aa1 0 55%, #b9bab3 55%); } .s-rue { background: linear-gradient(#34373c 0 45%, #c8b25c 45% 55%, #34373c 55%); }
    .s-immeuble { background: #4a4e55; box-shadow: inset 0 0 0 2px #2a2d31; } .s-refuge { background: linear-gradient(45deg, transparent 30%, #2457a6 30% 50%, transparent 50%), #e07a1f; }

    /* ── Fiche d'unité, journal ── */
    .side { display: grid; gap: 6px; }
    .card-u { display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: center; padding: 7px 10px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--line); font-size: 13px;
      .info { display: grid; gap: 1px; } small { color: var(--ink-2); font-size: 11.5px; } }
    .unit.mini { width: 40px; }
    .log { list-style: none; margin: 0; padding: 6px 8px; display: grid; gap: 2px; max-height: 96px; overflow: auto; font: 11px/1.4 var(--font-mono, ui-monospace, monospace); color: var(--ink-2);
      border-left: 2px solid var(--line); li:first-child { color: var(--ink); } }
    .end { min-height: 36px; justify-self: end; padding-inline: 16px; }
    .small { font-size: 12px; margin: 0; }

    /* ── Thème sombre : la carte est un peu tamisée, le cadre s'assombrit ── */
    @media (prefers-color-scheme: dark) {
      :host-context(html:not([data-theme=light])) .frame { background: #23262b; border-color: #3a3f47; }
      :host-context(html:not([data-theme=light])) .cols span, :host-context(html:not([data-theme=light])) .rows span { color: #8e95a1; }
      :host-context(html:not([data-theme=light])) .terrain { filter: brightness(.9) saturate(.92); }
    }
    :host-context(html[data-theme=dark]) .frame { background: #23262b; border-color: #3a3f47; }
    :host-context(html[data-theme=dark]) .cols span, :host-context(html[data-theme=dark]) .rows span { color: #8e95a1; }
    :host-context(html[data-theme=dark]) .terrain { filter: brightness(.9) saturate(.92); }

    @media (prefers-reduced-motion: reduce) {
      .cell.target::after, .rflow, .unit.slide { animation: none; }
      .fx .burst { animation-duration: .01s !important; } .fx b { animation: none; opacity: 1; }
      .unit, .hp em { transition: none; }
    }
  `,
})
export class TactiqueGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly w = W;
  protected readonly floor = Math.floor;
  protected readonly uid = 'tq' + ++inst;
  protected readonly colsArr = 'ABCDEFGH'.split('');
  protected readonly rowsArr = [1, 2, 3, 4, 5, 6, 7];
  protected mode: Mode = 'terre';
  /** Sous-variante : exercice du temps de paix (manœuvres) */
  protected exercise = false;
  protected maxTurns = 8;
  protected turnsArr: number[] = [];
  protected brief = '';
  protected opName = '';
  protected foeLabel = '';
  protected legend: [Terrain, string][] = [];
  protected cells: Terrain[] = [];
  protected art: Shape[] = [];
  private riverX = 3;
  protected readonly units = signal<Unit[]>([]);
  protected readonly sel = signal<number | null>(null);
  protected readonly turn = signal(1);
  protected readonly over = signal(false);
  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly log = signal<string[]>([]);
  protected readonly fx = signal<Fx[]>([]);
  /** Qui tient chaque objectif (dernier occupant) */
  protected readonly ctrl = signal<Record<number, Side>>({});
  private startHp = 1;
  private lostRefuges = new Set<number>();
  private timers: ReturnType<typeof setTimeout>[] = [];

  protected readonly selUnit = computed(() => this.units().find(u => u.id === this.sel()) ?? null);
  protected readonly reach = computed(() => {
    const u = this.selUnit();
    return u && !u.moved && !this.over() ? new Set([...this.moves(u)].map(([x, y]) => y * W + x)) : new Set<number>();
  });
  protected readonly targets = computed(() => {
    const u = this.selUnit();
    if (!u || u.acted || this.over()) return new Set<number>();
    return new Set(this.units().filter(e => e.side === 'e' && dist(u, e) <= this.range(u)).map(e => e.y * W + e.x));
  });

  ngOnInit(): void {
    const id = this.def().id;
    this.mode = id.includes('naval') ? 'mer' : id.includes('zombie') ? 'zombies' : 'terre';
    this.exercise = this.mode === 'terre' && id.includes('manoeuvre');
    const m = MODES[this.mode];
    this.maxTurns = m.turns;
    this.turnsArr = Array.from({ length: m.turns }, (_, k) => k + 1);
    this.brief = this.exercise ? 'Exercice Rouge contre Bleu : tenez les villes à la fin de la manœuvre, ou neutralisez la force adverse simulée (plastron).' : m.brief;
    this.opName = this.exercise ? 'Exercice Rouge contre Bleu' : this.mode === 'mer' ? 'Opération navale' : this.mode === 'zombies' ? 'Nuit des refuges' : 'Opération terrestre';
    this.foeLabel = this.exercise ? 'Plastron' : this.mode === 'mer' ? 'Pirates' : this.mode === 'zombies' ? 'Morts-vivants' : 'Ennemi';
    this.legend = LEGEND[this.mode];
    this.cells = this.makeMap();
    this.art = this.paint();
    this.deploy(m.player, 'p');
    this.deploy(this.enemyForces(m.enemy), 'e');
    this.startHp = this.units().filter(u => u.side === 'p').reduce((t, u) => t + u.max, 0);
    this.say(this.exercise ? 'Exercice Rouge contre Bleu : la force adverse simulée (plastron) est en position.'
      : this.mode === 'zombies' ? 'Les morts-vivants approchent des refuges.' : this.mode === 'mer' ? 'La flottille pirate est en vue.' : 'Les deux armées se font face.');
  }

  ngOnDestroy(): void { this.timers.forEach(t => clearTimeout(t)); }

  /* ── Carte et déploiement ── */

  private makeMap(): Terrain[] {
    const r = Math.random;
    const map: Terrain[] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.mode === 'mer') map.push(r() < 0.1 && x > 1 && x < W - 2 ? 'ile' : 'mer');
      else if (this.mode === 'zombies') map.push(r() < 0.14 && y > 0 && y < H - 1 ? 'immeuble' : 'rue');
      else map.push(r() < 0.16 ? 'foret' : r() < 0.1 ? 'colline' : 'plaine');
    }
    if (this.mode === 'terre') {
      // Une rivière avec deux gués
      const river = 3 + Math.floor(r() * 2);
      this.riverX = river;
      for (let y = 0; y < H; y++) map[y * W + river] = y === 1 || y === H - 2 ? 'plaine' : 'eau';
    }
    // Les objectifs : au centre et chez l'adversaire
    const objs: [number, number][] = this.mode === 'terre' ? [[2, 3], [W - 3, 1], [W - 3, H - 2]] : this.mode === 'mer' ? [[W - 2, 1], [W - 2, H - 2], [W - 3, 3]] : [[3, 3], [4, 3], [3, 4]];
    for (const [x, y] of objs) map[y * W + x] = MODES[this.mode].objective;
    return map;
  }

  /** Dessine le fond de carte une fois pour toutes (chemins agrégés par style) */
  private paint(): Shape[] {
    const rnd = Math.random;
    const S: Shape[] = [];
    const url = (k: string) => `url(#${this.uid}-${k})`;
    const at = (t: Terrain) => this.cells.flatMap((c, i) => (c === t ? [[i % W, Math.floor(i / W)] as [number, number]] : []));
    const acc: Record<string, string> = {};
    const add = (c: string, d: string) => { acc[c] = (acc[c] ?? '') + d; };
    const flush = (...cs: string[]) => { for (const c of cs) if (acc[c]) { S.push({ d: acc[c], c }); delete acc[c]; } };
    const full = box(0, 0, 800, 700);
    const objRing = (x: number, y: number, light = false) => S.push({ d: circ(x * 100 + 50, y * 100 + 50, 45), c: light ? 'objringL' : 'objring' });

    if (this.mode === 'terre') {
      S.push({ d: full, c: 'grass', f: url('grass') }, { d: full, c: 'mottle', fl: url('mottle') });
      // Parcelles cultivées et haies (bocage) sur les plaines
      for (const [x, y] of at('plaine')) {
        if (x === this.riverX || rnd() < 0.45) continue;
        const X = x * 100, Y = y * 100;
        const vertical = rnd() < 0.5, k = 0.35 + rnd() * 0.3;
        const parts: [number, number, number, number][] = vertical
          ? [[X + 6, Y + 6, 88 * k, 88], [X + 10 + 88 * k, Y + 6, 84 - 88 * k, 88]]
          : [[X + 6, Y + 6, 88, 88 * k], [X + 6, Y + 10 + 88 * k, 88, 84 - 88 * k]];
        for (const [px, py, pw, ph] of parts) {
          if (rnd() < 0.3) continue;
          S.push({ d: box(px, py, pw, ph), c: 'field', f: url(['furA', 'furB', 'furC'][Math.floor(rnd() * 3)]) });
          add('hedge', box(px - 1, py - 1, pw + 2, ph + 2));
        }
      }
      flush('hedge');
      // Collines : courbes de niveau et ombrage
      for (const [x, y] of at('colline')) {
        const cx = x * 100 + 50 + (rnd() - 0.5) * 10, cy = y * 100 + 52 + (rnd() - 0.5) * 10;
        const base = blob(cx, cy, 50, 0.22, rnd);
        S.push({ d: base, c: 'h0' }, { d: base, c: 'hshade', f: url('hill') });
        S.push({ d: blob(cx - 3, cy - 3, 37, 0.24, rnd), c: 'h1' }, { d: blob(cx - 5, cy - 5, 25, 0.26, rnd), c: 'h2' }, { d: blob(cx - 6, cy - 7, 12, 0.3, rnd), c: 'h3' });
      }
      // Rivière : berges, eau, courant
      const rx = this.riverX * 100 + 50, ph = rnd() * 6;
      const pts: [number, number][] = [];
      for (let y = -30; y <= 730; y += 50) pts.push([rx + Math.sin(y / 70 + ph) * 13 + (rnd() - 0.5) * 6, y]);
      const river = smooth(pts, false);
      const shifted = (dx: number) => smooth(pts.map(([a, b]) => [a + dx, b]), false);
      S.push({ d: river, c: 'rbank' }, { d: river, c: 'rmud' }, { d: river, c: 'rwater' }, { d: river, c: 'rdeep' }, { d: shifted(-7), c: 'rflow' }, { d: shifted(6), c: 'rflow' });
      // Gués : banc de galets, piste qui traverse
      for (const gy of [1, H - 2]) {
        const cy = gy * 100 + 50, cx = rx + Math.sin(cy / 70 + ph) * 13;
        const trk = `M${cx - 115} ${cy + 6}C${cx - 60} ${cy - 4} ${cx - 30} ${cy + 3} ${cx} ${cy}S${cx + 70} ${cy - 6} ${cx + 115} ${cy + 4}`;
        S.push({ d: trk, c: 'pisteE' }, { d: trk, c: 'piste' });
        S.push({ d: blob(cx, cy, 21, 0.15, rnd, 11, 1.25), c: 'ford' });
        let st = '';
        for (let k = 0; k < 7; k++) st += circ(cx - 18 + k * 6, cy + (rnd() - 0.5) * 12, 1.6 + rnd() * 1.2);
        S.push({ d: st, c: 'stones' });
      }
      // Forêts : massifs de houppiers ombrés
      for (const [x, y] of at('foret')) S.push({ d: rbox(x * 100 - 5, y * 100 - 5, 110, 110, 30), c: 'ffloor' });
      for (const [x, y] of at('foret')) {
        for (let k = 0; k < 11; k++) {
          const cx = x * 100 + 8 + rnd() * 84, cy = y * 100 + 8 + rnd() * 84, r = 9 + rnd() * 9;
          add('tshade', circ(cx + 4, cy + 5, r));
          add(rnd() < 0.5 ? 'tcrown' : 'tcrown2', circ(cx, cy, r));
          add('thigh', circ(cx - r * 0.3, cy - r * 0.32, r * 0.42));
        }
      }
      flush('tshade', 'tcrown', 'tcrown2', 'thigh');
      // Villes : rues, pâtés de maisons vus du ciel
      for (const [x, y] of at('ville')) {
        const X = x * 100, Y = y * 100;
        S.push({ d: rbox(X + 7, Y + 7, 86, 86, 14), c: 'pave' });
        const sx = X + 42 + rnd() * 16, sy = Y + 42 + rnd() * 16;
        add('street', `M${X + 4} ${f1(sy)}L${X + 96} ${f1(sy + (rnd() - 0.5) * 8)}M${f1(sx)} ${Y + 4}L${f1(sx + (rnd() - 0.5) * 8)} ${Y + 96}`);
        const quads: [number, number, number, number][] = [[X + 11, Y + 11, sx - X - 15, sy - Y - 15], [sx + 4, Y + 11, X + 89 - sx - 4, sy - Y - 15], [X + 11, sy + 4, sx - X - 15, Y + 89 - sy - 4], [sx + 4, sy + 4, X + 89 - sx - 4, Y + 89 - sy - 4]];
        for (const [qx, qy, qw, qh] of quads) {
          const n = 2 + Math.floor(rnd() * 2);
          for (let k = 0; k < n; k++) {
            const bw = qw * (0.42 + rnd() * 0.4), bh = qh * (0.32 + rnd() * 0.3);
            const bx = qx + rnd() * (qw - bw), by = qy + (k / n) * qh + rnd() * Math.max(0, qh / n - bh);
            add('bshadow', box(bx + 2.5, by + 3, bw, bh));
            const cls = ['roofA', 'roofB', 'roofC'][Math.floor(rnd() * 3)];
            add(cls, box(bx, by, bw, bh));
            add(cls === 'roofB' ? 'ridgeB' : 'ridge', bw > bh ? `M${f1(bx + 1.5)} ${f1(by + bh / 2)}h${f1(bw - 3)}` : `M${f1(bx + bw / 2)} ${f1(by + 1.5)}v${f1(bh - 3)}`);
          }
        }
      }
      flush('street', 'bshadow', 'roofA', 'roofB', 'roofC', 'ridge', 'ridgeB');
      for (const [x, y] of at('ville')) objRing(x, y);
      S.push({ d: full, c: 'grain', fl: url('grain') });
    } else if (this.mode === 'mer') {
      S.push({ d: full, c: 'seab', f: url('sea') }, { d: full, c: 'swell', fl: url('swell') }, { d: full, c: 'crest', f: url('crest') });
      // Isobathes (lignes de sonde)
      for (const x0 of [190, 380, 560]) {
        const pts: [number, number][] = [];
        const ph = rnd() * 6;
        for (let y = -20; y <= 720; y += 60) pts.push([x0 + Math.sin(y / 110 + ph) * 26, y]);
        add('iso', smooth(pts, false));
      }
      flush('iso');
      // Récifs : haut-fond, plage, rochers, ressac
      for (const [x, y] of at('ile')) {
        const cx = x * 100 + 50 + (rnd() - 0.5) * 8, cy = y * 100 + 50 + (rnd() - 0.5) * 8;
        S.push({ d: circ(cx, cy, 50), c: 'shoal', f: url('shoal') });
        add('surf', blob(cx, cy, 33, 0.22, rnd));
        add('sand', blob(cx, cy, 27, 0.25, rnd));
        add('rock', blob(cx + 2, cy + 1, 16, 0.35, rnd));
        add('rockhi', blob(cx - 2, cy - 3, 7, 0.4, rnd));
        if (rnd() < 0.7) for (let k = 0; k < 4; k++) add('scrub', circ(cx - 12 + rnd() * 24, cy - 10 + rnd() * 20, 2.2 + rnd() * 2));
      }
      flush('surf', 'sand', 'rock', 'rockhi', 'scrub');
      // Ports : bassin, jetée, quais, entrepôts, grues
      for (const [x, y] of at('port')) S.push({ d: circ(x * 100 + 60, y * 100 + 50, 70), c: 'shoalP', f: url('shoal') });
      for (const [x, y] of at('port')) {
        const X = x * 100, Y = y * 100;
        add('basin', rbox(X + 8, Y + 10, 62, 80, 6));
        const jet = `M${X + 8} ${Y + 8}L${X + 70} ${Y + 8}M${X + 8} ${Y + 92}L${X + 46} ${Y + 92}`;
        add('jettyE', jet); add('jetty', jet);
        add('quay', box(X + 66, Y + 4, 30, 92) + box(X + 30, Y + 42, 36, 9) + box(X + 30, Y + 66, 36, 8));
        add('bshadow', box(X + 73, Y + 15, 18, 26) + box(X + 73, Y + 55, 18, 30));
        add('roofA', box(X + 71, Y + 12, 18, 26)); add('roofB', box(X + 71, Y + 52, 18, 30));
        add('ridge', `M${X + 80} ${Y + 13.5}v23`); add('ridgeB', `M${X + 80} ${Y + 53.5}v27`);
        add('crane', `M${X + 63} ${Y + 30}l-22 -9M${X + 63} ${Y + 30}l0 -14M${X + 63} ${Y + 61}l-20 -8`);
        let b = ''; for (let k = 0; k < 4; k++) b += circ(X + 33 + k * 9, Y + 44, 1.3); add('bollard', b);
      }
      flush('basin', 'jettyE', 'jetty', 'quay', 'bshadow', 'roofA', 'roofB', 'ridge', 'ridgeB', 'crane', 'bollard');
      for (const [x, y] of at('port')) objRing(x, y, true);
    } else {
      S.push({ d: full, c: 'asph', f: url('asph') });
      // Marquage au sol au milieu des voies
      let ln = '';
      for (let y = 0; y < H; y++) ln += `M0 ${y * 100 + 50}H800`;
      for (let x = 0; x < W; x++) ln += `M${x * 100 + 50} 0V700`;
      S.push({ d: ln, c: 'lane' });
      // Immeubles : trottoir, ombre portée, toit-terrasse, équipements
      for (const [x, y] of at('immeuble')) {
        const X = x * 100, Y = y * 100;
        add('walk', box(X + 2, Y + 2, 96, 96));
        add('bshadow', box(X + 16, Y + 17, 80, 80));
        add(['roofN1', 'roofN2', 'roofN3'][Math.floor(rnd() * 3)], box(X + 10, Y + 10, 80, 80));
        for (let k = 0; k < 3; k++) add('ac', box(X + 18 + rnd() * 54, Y + 18 + rnd() * 54, 9, 7));
        add('sky', box(X + 22 + rnd() * 30, Y + 22 + rnd() * 30, 14, 10));
      }
      flush('walk', 'bshadow', 'roofN1', 'roofN2', 'roofN3', 'ac', 'sky');
      // Refuges : gymnase barricadé, signe de la protection civile, projecteurs
      for (const [x, y] of at('refuge')) {
        const X = x * 100, Y = y * 100;
        S.push({ d: circ(X + 50, Y + 50, 62), c: 'flood', f: url('flood') });
        add('sandbag', rbox(X + 6, Y + 6, 88, 88, 10));
        add('bshadow', box(X + 20, Y + 21, 66, 66));
        add('roofR', box(X + 15, Y + 15, 68, 68));
        add('pcO', box(X + 34, Y + 34, 30, 30));
        add('pcB', `M${X + 49} ${Y + 38}L${X + 60} ${Y + 58}H${X + 38}Z`);
      }
      flush('sandbag', 'bshadow', 'roofR', 'pcO', 'pcB');
      // Voitures garées le long des voies
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (this.cells[y * W + x] !== 'rue' || rnd() > 0.3) continue;
        const hz = rnd() < 0.5, side = rnd() < 0.5 ? -1 : 1, cx = x * 100 + 50 + (hz ? (rnd() - 0.5) * 30 : side * 30), cy = y * 100 + 50 + (hz ? side * 30 : (rnd() - 0.5) * 30);
        const cw = hz ? 26 : 12, ch = hz ? 12 : 26;
        add('bshadow', rbox(cx - cw / 2 + 2, cy - ch / 2 + 2.5, cw, ch, 3));
        add(['carA', 'carB', 'carC', 'carD'][Math.floor(rnd() * 4)], rbox(cx - cw / 2, cy - ch / 2, cw, ch, 3));
        add('glass', hz ? box(cx + (rnd() < 0.5 ? 2 : -8), cy - 4.5, 6, 9) : box(cx - 4.5, cy + (rnd() < 0.5 ? 2 : -8), 9, 6));
      }
      flush('bshadow', 'carA', 'carB', 'carC', 'carD', 'glass');
      // Réverbères aux carrefours de rues
      const lamps: [number, number][] = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (this.cells[y * W + x] !== 'rue' || rnd() > 0.24) continue;
        lamps.push([x * 100 + (rnd() < 0.5 ? 12 : 88), y * 100 + (rnd() < 0.5 ? 12 : 88)]);
      }
      for (const [lx, ly] of lamps) S.push({ d: circ(lx, ly, 62), c: 'glow', f: url('lamp') });
      for (const [lx, ly] of lamps) add('lampdot', circ(lx, ly, 2.6));
      flush('lampdot');
      S.push({ d: full, c: 'night', f: url('night') }, { d: full, c: 'grain', fl: url('grain') });
      for (const [x, y] of at('refuge')) objRing(x, y, true);
    }
    return S;
  }

  private enemyForces(base: string[]): string[] {
    const extra = this.diff() >= 1.2 ? 1 : 0;
    const add = this.mode === 'zombies' ? ['zombie', 'zombie'] : this.mode === 'mer' ? ['pirate'] : ['inf'];
    return [...base, ...add.slice(0, extra + (this.mode === 'zombies' ? 1 : 0))];
  }

  private deploy(list: string[], side: Side): void {
    const out = [...this.units()];
    for (const t of list) {
      const T = TYPES[t];
      let x = 0, y = 0, tries = 0;
      do {
        if (this.mode === 'zombies') {
          if (side === 'p') { x = 2 + Math.floor(Math.random() * 4); y = 2 + Math.floor(Math.random() * 3); }
          else { const edge = Math.floor(Math.random() * 4); x = edge === 0 ? 0 : edge === 1 ? W - 1 : Math.floor(Math.random() * W); y = edge === 2 ? 0 : edge === 3 ? H - 1 : Math.floor(Math.random() * H); }
        } else {
          x = side === 'p' ? Math.floor(Math.random() * 2) : W - 1 - Math.floor(Math.random() * 2);
          y = Math.floor(Math.random() * H);
        }
        tries++;
      } while ((this.blocked(T, x, y) || out.some(u => u.x === x && u.y === y)) && tries < 200);
      out.push({ ...T, id: ++uid, side, x, y, px: x, py: y, moved: false, acted: false, max: T.hp });
    }
    this.units.set(out);
  }

  /* ── Rendu des pions ── */

  /** Cadre du symbole : ami (rectangle), aérien ami (dôme), hostile (losange) ; aucun pour les navires et les morts-vivants */
  protected frameOf(u: Unit): 'p' | 'a' | 'e' | null {
    if (this.mode === 'mer' || (this.mode === 'zombies' && u.side === 'e')) return null;
    if (u.side === 'e') return 'e';
    return u.fly ? 'a' : 'p';
  }
  protected glyphTf(u: Unit): string | null {
    if (this.frameOf(u) === 'e') return 'translate(20 14.5) scale(.6) translate(-20 -14.5)';
    if (this.mode === 'mer' && u.side === 'e') return 'translate(40 0) scale(-1 1)';
    return null;
  }
  protected two(n: number): string { return n < 10 ? '0' + n : String(n); }
  protected sideWord(s: Side): string { return s === 'p' ? (this.exercise ? 'bleu' : 'allié') : this.exercise ? 'du plastron' : 'ennemi'; }
  protected objPips(): string[] {
    const objective = MODES[this.mode].objective;
    const ctrl = this.ctrl();
    return this.cells.flatMap((t, i) => (t !== objective ? [] : [this.mode === 'zombies' ? (this.lostRefuges.has(i) ? 'e' : 'p') : ctrl[i] ?? '']));
  }

  /* ── Règles ── */

  protected terrainLabel(t: Terrain): string { return TERRAIN[t].label; }
  protected unitAt(x: number, y: number): Unit | undefined { return this.units().find(u => u.x === x && u.y === y); }
  protected fxAt(x: number, y: number): Fx[] { return this.fx().filter(f => f.x === x && f.y === y); }
  protected alive(side: Side): number { return this.units().filter(u => u.side === side).length; }
  private terrain(x: number, y: number): Terrain { return this.cells[y * W + x]; }

  private blocked(u: UnitType, x: number, y: number): boolean {
    const b = TERRAIN[this.terrain(x, y)].block;
    if (!b) return false;
    if (b === 'all') return true;
    if (u.fly) return false;
    return this.mode === 'mer' ? b === 'sea' : b === 'ground';
  }

  /** Portée : +1 depuis une colline pour les unités à distance */
  private range(u: Unit): number { return u.rng + (u.rng >= 2 && this.terrain(u.x, u.y) === 'colline' ? 1 : 0); }

  /** Cases atteignables (coût du terrain, unités bloquantes) */
  private moves(u: Unit): [number, number][] {
    const best = new Map<number, number>([[u.y * W + u.x, 0]]);
    const queue: [number, number, number][] = [[u.x, u.y, 0]];
    while (queue.length) {
      const [x, y, c] = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || this.blocked(u, nx, ny)) continue;
        const occ = this.unitAt(nx, ny);
        if (occ && occ.side !== u.side) continue;
        const nc = c + (u.fly ? 1 : TERRAIN[this.terrain(nx, ny)].cost);
        if (nc > u.mv || (best.get(ny * W + nx) ?? 99) <= nc) continue;
        best.set(ny * W + nx, nc);
        queue.push([nx, ny, nc]);
      }
    }
    const out: [number, number][] = [];
    for (const k of best.keys()) { const x = k % W, y = Math.floor(k / W); if (!this.unitAt(x, y) || (x === u.x && y === u.y)) out.push([x, y]); }
    return out;
  }

  private damage(a: Unit, d: Unit): number {
    const def = TERRAIN[this.terrain(d.x, d.y)].def + (d.heavy && !a.heavy ? 1 : 0);
    const roll = Math.floor(Math.random() * 3) - 1;
    return Math.max(1, a.atk - def + roll);
  }

  /** Ligne de journal quand une unité est mise hors de combat */
  private killLine(a: Unit, d: Unit): string {
    if (this.mode === 'zombies') {
      return d.side === 'e' ? `${a.name} : ${d.type === 'horde' ? 'la horde est repoussée' : 'un mort-vivant est repoussé'}.`
        : `${d.name} submergés par ${a.type === 'horde' ? 'la horde' : 'un mort-vivant'} : unité perdue.`;
    }
    if (this.exercise) {
      return d.side === 'e' ? `${a.name} (Bleu) : unité du plastron (${d.name.toLowerCase()}) neutralisée par l’arbitrage.`
        : `${a.name} du plastron : votre unité (${d.name.toLowerCase()}) est neutralisée par l’arbitrage.`;
    }
    const kw = this.mode === 'mer' ? (d.fly ? 'abattue' : 'coulée') : 'détruite';
    return d.side === 'e' ? `${a.name} : unité adverse (${d.name.toLowerCase()}) ${kw}.` : `${a.name} adverse : votre unité (${d.name.toLowerCase()}) ${kw}.`;
  }

  private strike(a: Unit, d: Unit): void {
    const dmg = this.damage(a, d);
    d.hp -= dmg;
    this.pop(a.x, a.y, '', 'fire');
    this.pop(d.x, d.y, d.hp <= 0 ? (this.exercise ? 'neutralisé' : '') : `−${dmg}`, d.hp <= 0 ? 'kill' : 'hit');
    if (d.hp <= 0) {
      this.say(this.killLine(a, d));
      this.units.set(this.units().filter(u => u.id !== d.id));
      return;
    }
    // Riposte au contact
    if (dist(a, d) <= this.range(d) && dist(a, d) === 1) {
      const back = Math.max(1, Math.floor(this.damage(d, a) / 2));
      a.hp -= back;
      this.pop(a.x, a.y, a.hp <= 0 ? (this.exercise ? 'neutralisé' : '') : `−${back}`, a.hp <= 0 ? 'kill' : 'miss');
      if (a.hp <= 0) this.units.set(this.units().filter(u => u.id !== a.id));
    }
    this.units.set([...this.units()]);
  }

  /* ── Tour du joueur ── */

  protected click(x: number, y: number): void {
    if (this.over() || this.busy()) return;
    const here = this.unitAt(x, y);
    const u = this.selUnit();
    const i = y * W + x;
    if (u && this.targets().has(i) && here) {
      u.acted = true; u.moved = true;
      this.strike(u, here);
      this.after();
      return;
    }
    if (u && this.reach().has(i) && (!here || here.id === u.id)) {
      u.px = u.x; u.py = u.y;
      u.x = x; u.y = y; u.moved = true;
      this.capture(u);
      this.units.set([...this.units()]);
      // Plus de cible : l'unité a fini
      if (!this.targets().size) { u.acted = true; this.sel.set(null); }
      this.after();
      return;
    }
    if (here?.side === 'p' && !(here.moved && here.acted)) { this.sel.set(here.id); return; }
    this.sel.set(null);
  }

  private capture(u: Unit): void {
    const t = this.terrain(u.x, u.y);
    if (t === MODES[this.mode].objective) this.ctrl.update(c => ({ ...c, [u.y * W + u.x]: u.side }));
    if (this.mode === 'zombies' && u.side === 'e' && t === 'refuge' && !this.lostRefuges.has(u.y * W + u.x)) {
      this.lostRefuges.add(u.y * W + u.x);
      this.say('Un refuge est envahi !');
      this.miss.emit();
    }
  }

  private after(): void {
    this.progress.emit({ live: this.ratio(), time: 1 - this.turn() / this.maxTurns });
    if (!this.alive('e') && this.mode !== 'zombies') return this.finish();
    if (!this.alive('p')) return this.finish();
    if (this.units().filter(u => u.side === 'p').every(u => u.moved && u.acted)) this.endTurn();
  }

  /* ── Tour de l'ennemi ── */

  protected endTurn(): void {
    if (this.over() || this.busy()) return;
    this.sel.set(null);
    this.busy.set(true);
    const enemies = this.units().filter(u => u.side === 'e');
    let k = 0;
    const step = () => {
      if (this.over()) return;
      if (k >= enemies.length) return this.newTurn();
      const id = enemies[k++].id;
      const e = this.units().find(u => u.id === id);
      if (e) this.aiMove(e);
      this.timers.push(setTimeout(step, 260));
    };
    this.timers.push(setTimeout(step, 200));
  }

  private aiMove(e: Unit): void {
    const players = this.units().filter(u => u.side === 'p');
    if (!players.length) return;
    const inRange = () => this.units().filter(p => p.side === 'p' && dist(e, p) <= this.range(e)).sort((a, b) => a.hp - b.hp)[0];
    let target = inRange();
    // Les unités à distance tirent sans bouger ; les autres avancent
    if (!target || e.rng === 1) {
      const objective = MODES[this.mode].objective;
      const objTiles = this.cells.map((t, i) => (t === objective && this.ctrl()[i] !== 'e' && !this.lostRefuges.has(i) ? i : -1)).filter(i => i >= 0).map(i => ({ x: i % W, y: Math.floor(i / W) }));
      const goals = this.mode === 'zombies' || Math.random() < 0.4 ? [...objTiles, ...players] : players;
      const goal = goals.sort((a, b) => dist(e, a) - dist(e, b))[0];
      if (!target && goal) {
        let best: [number, number] = [e.x, e.y], bestD = dist(e, goal);
        for (const [x, y] of this.moves(e)) { const dd = dist({ x, y }, goal); if (dd < bestD) { best = [x, y]; bestD = dd; } }
        e.px = e.x; e.py = e.y;
        e.x = best[0]; e.y = best[1];
        this.capture(e);
        this.units.set([...this.units()]);
      }
      target = inRange();
    }
    if (target) this.strike(e, target);
  }

  private newTurn(): void {
    this.busy.set(false);
    if (!this.alive('p')) return this.finish();
    if (this.turn() >= this.maxTurns) return this.finish();
    this.turn.update(t => t + 1);
    // Les morts-vivants affluent ; les pirates reçoivent des renforts à mi-bataille
    if (this.mode === 'zombies') this.deploy(this.turn() % 2 ? ['zombie'] : ['zombie', 'zombie'].slice(0, this.diff() >= 1.2 ? 2 : 1), 'e');
    if (this.mode === 'mer' && this.turn() === 4) { this.deploy(['pirate'], 'e'); this.say('Des renforts pirates surgissent à l’horizon.'); }
    for (const u of this.units()) { u.moved = false; u.acted = false; u.px = u.x; u.py = u.y; }
    this.units.set([...this.units()]);
    this.progress.emit({ live: this.ratio(), time: 1 - this.turn() / this.maxTurns });
  }

  /* ── Bilan ── */

  protected objText(): string {
    const objective = MODES[this.mode].objective;
    const all = this.cells.map((t, i) => (t === objective ? i : -1)).filter(i => i >= 0);
    if (this.mode === 'zombies') return `Refuges intacts : ${all.length - this.lostRefuges.size}/${all.length}`;
    const mine = all.filter(i => this.ctrl()[i] === 'p').length;
    return `${objective === 'ville' ? 'Villes tenues' : 'Ports tenus'} : ${mine}/${all.length}`;
  }

  protected hintText(): string {
    return this.mode === 'zombies' ? 'Les tireurs portent loin, les pompiers encaissent.' : this.mode === 'mer' ? 'Les hélicoptères survolent les récifs ; le sous-marin frappe fort au contact.' : 'Forêts et villes protègent ; l’artillerie tire plus loin depuis une colline.';
  }

  private ratio(): number {
    const hp = this.units().filter(u => u.side === 'p').reduce((t, u) => t + u.hp, 0) / this.startHp;
    const objective = MODES[this.mode].objective;
    const all = this.cells.map((t, i) => (t === objective ? i : -1)).filter(i => i >= 0);
    const obj = this.mode === 'zombies' ? (all.length - this.lostRefuges.size) / all.length : all.filter(i => this.ctrl()[i] === 'p').length / all.length;
    const kills = this.mode === 'zombies' ? 0.5 : 1 - this.alive('e') / Math.max(1, this.alive('e') + 3);
    return Math.max(0, Math.min(1, 0.45 * obj + 0.3 * hp + 0.25 * kills));
  }

  private finish(): void {
    if (this.over()) return;
    this.over.set(true);
    this.busy.set(false);
    this.timers.forEach(t => clearTimeout(t));
    let r = this.ratio();
    const wiped = !this.alive('e') && this.mode !== 'zombies';
    if (wiped) r = Math.max(r, 0.75 + 0.25 * r);
    if (!this.alive('p')) r = Math.min(r, 0.15);
    if (r < 0.5) this.miss.emit();
    this.message.set(this.exercise ? this.exerciseVerdict(r, wiped)
      : !this.alive('p') ? 'Vos forces sont anéanties : la bataille est perdue.'
      : wiped ? (this.mode === 'mer' ? 'La flottille pirate est coulée : la Manche est libre.' : 'L’ennemi est mis en déroute !')
      : r >= 0.7 ? (this.mode === 'zombies' ? 'Les refuges ont tenu jusqu’à l’aube.' : 'Une victoire nette : les objectifs sont à vous.')
      : r >= 0.45 ? 'Une issue indécise : chacun campe sur ses positions.' : 'Un revers : l’adversaire prend l’avantage.');
    this.say(this.message());
    this.progress.emit({ live: r, time: 0 });
    this.timers.push(setTimeout(() => this.done.emit(Math.max(0.1, r)), 2400));
  }

  private exerciseVerdict(r: number, wiped: boolean): string {
    if (!this.alive('p')) return 'Toutes vos unités sont neutralisées par l’arbitrage : l’exercice est un échec, la manœuvre est à reprendre.';
    if (wiped) return 'L’exercice est un succès : le plastron est entièrement neutralisé, la manœuvre est validée par l’état-major.';
    if (r >= 0.7) return 'L’exercice est un succès : la manœuvre est validée par l’état-major.';
    if (r >= 0.45) return 'Exercice mitigé : l’état-major demande une nouvelle séance de manœuvre.';
    return 'Exercice manqué : le plastron a pris l’avantage, la manœuvre est à reprendre.';
  }

  private say(t: string): void { this.log.update(l => [`T${this.turn()} · ${t}`, ...l].slice(0, 6)); }
  private pop(x: number, y: number, text: string, tone: Fx['tone']): void {
    const f: Fx = { x, y, text, tone, id: ++uid };
    this.fx.update(a => [...a, f]);
    this.timers.push(setTimeout(() => this.fx.update(a => a.filter(z => z.id !== f.id)), tone === 'fire' ? 400 : 900));
  }
}

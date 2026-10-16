import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/* ============================================================
 *  Le portrait officiel : composer le tableau du règne, élément
 *  par élément (pose, costume, décor, regard, attribut). Chaque
 *  choix pèse sur trois impressions (majesté, proximité,
 *  modernité) ; le pays attend un certain portrait, qu'il faut
 *  deviner dans la commande du chambellan.
 *
 *  Le tableau se peint sous les yeux du joueur : toile apprêtée
 *  et esquisse au fusain, puis sous-couche, couleurs, décor,
 *  regard et attribut ; cadre doré sculpté, toile et vernis.
 * ============================================================ */

type Axis = 'maj' | 'pro' | 'mod';
/** `k` : clé du dessin (esquisse de la carte, élément du tableau) */
interface Opt { k: string; icon: string; label: string; v: Record<Axis, number> }
interface Step { name: string; opts: Opt[] }

const STEPS: Step[] = [
  { name: 'La pose', opts: [
    { k: 'pied', icon: '🧍', label: 'En pied, la main sur la hanche', v: { maj: 3, pro: 0, mod: 0 } },
    { k: 'trone', icon: '🪑', label: 'Assis sur le trône', v: { maj: 4, pro: -1, mod: -1 } },
    { k: 'marche', icon: '🚶', label: 'En marche, saisi sur le vif', v: { maj: 0, pro: 2, mod: 3 } },
    { k: 'accoude', icon: '🙂', label: 'Accoudé, souriant', v: { maj: -1, pro: 3, mod: 1 } },
  ] },
  { name: 'Le costume', opts: [
    { k: 'hermine', icon: '👑', label: 'Manteau d’hermine et couronne', v: { maj: 4, pro: -2, mod: -2 } },
    { k: 'uniforme', icon: '🎖️', label: 'Grand uniforme d’apparat', v: { maj: 3, pro: 0, mod: -1 } },
    { k: 'sombre', icon: '👔', label: 'Costume sombre, sans cravate', v: { maj: 0, pro: 1, mod: 3 } },
    { k: 'pull', icon: '🧥', label: 'Pull de laine, manches retroussées', v: { maj: -2, pro: 4, mod: 1 } },
  ] },
  { name: 'Le décor', opts: [
    { k: 'glaces', icon: '🏰', label: 'La galerie des glaces', v: { maj: 4, pro: -1, mod: -1 } },
    { k: 'ble', icon: '🌾', label: 'Un champ de blé au couchant', v: { maj: 0, pro: 3, mod: 0 } },
    { k: 'paris', icon: '🏙️', label: 'Les toits de Paris', v: { maj: 1, pro: 1, mod: 2 } },
    { k: 'labo', icon: '🔬', label: 'Un laboratoire de recherche', v: { maj: 0, pro: 0, mod: 4 } },
  ] },
  { name: 'Le regard', opts: [
    { k: 'loin', icon: '🦅', label: 'Au loin, vers l’avenir', v: { maj: 3, pro: 0, mod: 1 } },
    { k: 'yeux', icon: '👀', label: 'Droit dans les yeux du spectateur', v: { maj: 1, pro: 3, mod: 1 } },
    { k: 'las', icon: '😌', label: 'Bienveillant, un peu las', v: { maj: 0, pro: 2, mod: 0 } },
    { k: 'severe', icon: '🤨', label: 'Sévère, le sourcil levé', v: { maj: 3, pro: -2, mod: 0 } },
  ] },
  { name: 'L’attribut', opts: [
    { k: 'sceptre', icon: '⚜️', label: 'Le sceptre et la main de justice', v: { maj: 4, pro: -1, mod: -2 } },
    { k: 'constitution', icon: '📖', label: 'La Constitution, ouverte', v: { maj: 1, pro: 1, mod: 1 } },
    { k: 'chien', icon: '🐕', label: 'Le chien de la famille', v: { maj: -1, pro: 4, mod: 0 } },
    { k: 'tablette', icon: '📱', label: 'Une tablette numérique', v: { maj: -1, pro: 1, mod: 4 } },
  ] },
];

const COMMANDS: { text: string; target: Record<Axis, number> }[] = [
  { text: '« Le pays doute : il veut voir un souverain qui lui ressemble, simple et proche. »', target: { maj: 3, pro: 14, mod: 5 } },
  { text: '« Les chancelleries nous regardent : il faut un portrait qui en impose, digne des plus grandes cours. »', target: { maj: 16, pro: 0, mod: 1 } },
  { text: '« La jeunesse ne se reconnaît plus dans la couronne : montrez une monarchie tournée vers demain. »', target: { maj: 3, pro: 4, mod: 14 } },
  { text: '« Un juste milieu : de la tenue, mais de la chaleur, et un pied dans notre siècle. »', target: { maj: 8, pro: 7, mod: 7 } },
  { text: '« La tradition avant tout, mais que le peuple sente qu’on l’aime. »', target: { maj: 11, pro: 9, mod: 0 } },
];

const LABEL: Record<Axis, string> = { maj: 'Majesté', pro: 'Proximité', mod: 'Modernité' };

/* ── Le dessin ── */

type Pt = readonly [number, number];
/** Bras : épaule, coude, main (repère du tableau, 200 × 250) */
type Arm = readonly [Pt, Pt, Pt];
const POSES: Record<string, { tf: string; arms: [Arm, Arm] }> = {
  pied: { tf: '', arms: [[[66, 111], [44, 156], [74, 184]], [[134, 111], [148, 166], [141, 206]]] },
  trone: { tf: '', arms: [[[66, 111], [52, 158], [54, 192]], [[134, 111], [148, 158], [146, 192]]] },
  marche: { tf: 'translate(-6 0)', arms: [[[66, 111], [55, 150], [74, 180]], [[134, 111], [152, 150], [158, 184]]] },
  accoude: { tf: 'translate(-4 8)', arms: [[[66, 111], [56, 166], [84, 200]], [[134, 111], [152, 176], [120, 198]]] },
};

/** Esquisses au crayon des cartes de choix (repère 40 × 40) */
const SKETCH: Record<string, string[]> = {
  pied: ['M20 4.5a3 3 0 1 1 0 6a3 3 0 1 1 0-6', 'M20 10.5 Q19.4 17 20 24', 'M20 12 Q15 14 13.4 17.5 Q15.5 20.5 19 21.5', 'M20 12 Q24.5 15 25.6 19.5 Q26.2 23 25.5 26', 'M20 24 Q18.6 30 17.6 36.5', 'M20 24 Q21.6 30 22.8 36.5', 'M15 37 h4 M21 37 h4'],
  trone: ['M9.5 36 V9 Q20 1 30.5 9 V36', 'M6.5 26.5 H33.5 M8 26.5 V36 M32 26.5 V36', 'M20 7.5a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 1 1 0-5.6', 'M20 13.2 V24.5', 'M20 15 Q15 17.5 13 23 L11 25.5 M20 15 Q25 17.5 27 23 L29 25.5', 'M16.5 25 Q16 30 15.5 35 M23.5 25 Q24 30 24.5 35', 'M12 9.5 Q20 5 28 9.5'],
  marche: ['M21.5 4.5a3 3 0 1 1 0 6a3 3 0 1 1 0-6', 'M21 10.5 Q20 17 19 23.5', 'M20.6 12.5 Q16 16 14.6 21 M20.8 12.5 Q25 15.5 27.4 20', 'M19 23.5 Q15.5 29 12.6 35.6 L10.4 35.4', 'M19 23.5 Q23 28.5 26 34.6 L29 34.2', 'M5 37.5 Q20 36.6 35 37.5'],
  accoude: ['M17 6.5a3.4 3.4 0 1 1 0 6.8a3.4 3.4 0 1 1 0-6.8', 'M14.8 11.2 Q17 12.6 19.2 11.2', 'M10 18 Q17 14.5 25 17.5', 'M12 18.5 Q11 24 12 29', 'M24.5 17.5 Q30 22 31 28.2 L21 28.8', 'M3.5 28.8 H36.5 M3.5 31.6 H36.5', 'M8 31.6 Q6.8 34 8 37 M15 31.6 Q13.8 34 15 37 M22 31.6 Q20.8 34 22 37 M29 31.6 Q27.8 34 29 37', 'M3.5 37.5 H36.5'],
  hermine: ['M12.5 13.5 L12.5 6.5 L16.2 9.6 L20 4 L23.8 9.6 L27.5 6.5 L27.5 13.5 Z', 'M12.5 11.6 H27.5', 'M7 37 Q9.5 20 20 17 Q30.5 20 33 37', 'M11 22 Q20 27 29 22', 'M14.5 23.2 v1.6 M19 24.6 v1.6 M23.5 24.4 v1.6 M27 23 v1.4 M12.5 30 v1.6 M27.5 30 v1.6'],
  uniforme: ['M8 16.5 Q20 12 32 16.5 L33 37 H7 Z', 'M17 13.5 Q20 16 23 13.5', 'M6.5 15.5 Q9.5 13 12.5 15.8 M27.5 15.8 Q30.5 13 33.5 15.5', 'M7 16.5 v3.4 M8.6 16.6 v3.6 M10.2 16.6 v3.4 M29.8 16.6 v3.4 M31.4 16.6 v3.6 M33 16.5 v3.4', 'M26 16 L12.4 34.4 M28.4 17.6 L14.8 36', 'M20 18.5 v.4 M20 22.5 v.4 M20 26.5 v.4 M20 30.5 v.4', 'M23.4 21 a1.2 1.2 0 1 0 .1 0 M26.4 21 a1.2 1.2 0 1 0 .1 0'],
  sombre: ['M8 16 Q20 11.5 32 16 L33 37 H7 Z', 'M16.4 13 L20 26 L23.6 13', 'M16.4 13 L13.6 21 L18.2 22.6 M23.6 13 L26.4 21 L21.8 22.6', 'M18 13.5 L20 17.4 L22 13.5', 'M20 28.5 v.4 M20 32 v.4', 'M26.5 24.5 h3.4'],
  pull: ['M9 16 Q20 11.5 31 16 L32 34 H8 Z', 'M16 13.4 Q20 16.8 24 13.4', 'M9 16 Q5 22 4.6 29 M31 16 Q35 22 35.4 29', 'M3.6 29 h3.6 M32.8 29 h3.6', 'M4.6 29 Q5 33 6.4 35.6 M35.4 29 Q35 33 33.6 35.6', 'M8.4 32 H31.6 M8.4 33.6 H31.6', 'M13 20 v9 M16.5 20.5 v9 M20 20.8 v9 M23.5 20.5 v9 M27 20 v9'],
  glaces: ['M4 36 L4 10 L13 15 L13 32 Z', 'M36 36 L36 10 L27 15 L27 32 Z', 'M6.2 31 V17 Q8.5 12.5 10.8 17.6 V29.6', 'M33.8 31 V17 Q31.5 12.5 29.2 17.6 V29.6', 'M13 15 Q20 9.5 27 15', 'M17 32 H23 M13 32 L4 36 M27 32 L36 36', 'M20 4 V8 M17 8.5 Q20 11.4 23 8.5 M17.6 10.6 v1.2 M20 11.4 v1.2 M22.4 10.6 v1.2'],
  ble: ['M2 24 Q20 22.6 38 24', 'M24 24 a6 6 0 0 1 12 0', 'M30 15.5 v-2.6 M24.2 18 l-1.8-1.6 M35.8 18 l1.8-1.6', 'M4 37 Q5 31 7 27 M7.5 37 Q8.5 31 10.4 27.4 M11 37 Q11.8 32 13.4 28 M14.6 37 Q15.2 32 16.6 28.4 M18 37 Q18.6 32 19.8 28.6 M21.6 37 Q22.2 32 23.4 28.6 M25.2 37 Q25.8 32 27 28.4 M28.8 37 Q29.4 32 30.8 28 M32.4 37 Q33.2 31.6 35 27.6', 'M6.6 27 l1-1.6 M10 27.4 l1-1.6 M13 28 l1-1.6 M16.2 28.4 l1-1.6 M27 28.4 l1-1.6 M30.4 28 l1-1.6', 'M5 9 Q10 7 15 9.4'],
  paris: ['M29 33 L31 9 L33 33', 'M29.6 25 H32.4 M30.2 18 H31.8 M28.4 33 Q31 28 33.6 33', 'M2 37 V27 L6 23 H13 L16 27 V37', 'M8 23 V19.4 H10.4 V23', 'M16 37 V29.5 L19 26 H24 L27 29.5 V37', 'M20.6 26 V23 H22.6 V26', 'M4.5 30.5 h2 v2.6 h-2z M10 30.5 h2 v2.6 h-2z M19.5 31 h2 v2.6 h-2z', 'M2 37 H38'],
  labo: ['M13 6 V15 L6.5 31 Q6 34 9 34 H21 Q24 34 23.5 31 L17 15 V6', 'M11.4 6 H18.6', 'M9 25.5 H21', 'M28 4 V27 Q28 30 30 30 Q32 30 32 27 V4', 'M27 4 H33 M28 20 H32', 'M3 36 H37'],
  loin: ['M5 21 Q11 15 17 21 Q11 25 5 21 Z', 'M23 21 Q29 15 35 21 Q29 25 23 21 Z', 'M8.2 18.4 a2 2 0 1 0 .1 0', 'M26.2 18.4 a2 2 0 1 0 .1 0', 'M5 14.5 Q11 11 17.4 14 M22.6 14 Q29 11 35 14.5', 'M4 9 L9 4 M9 4 L6 4.2 M9 4 L8.8 7'],
  yeux: ['M5 21 Q11 15 17 21 Q11 27 5 21 Z', 'M23 21 Q29 15 35 21 Q29 27 23 21 Z', 'M11 19 a2.2 2.2 0 1 0 .1 0', 'M29 19 a2.2 2.2 0 1 0 .1 0', 'M5 14.2 Q11 12 17.4 14.2 M22.6 14.2 Q29 12 35 14.2', 'M18.6 23 Q20 28 21.4 23'],
  las: ['M5 21 Q11 19.4 17 21 Q11 25 5 21 Z', 'M23 21 Q29 19.4 35 21 Q29 25 23 21 Z', 'M11 21.2 a1.8 1.4 0 1 0 .1 0', 'M29 21.2 a1.8 1.4 0 1 0 .1 0', 'M5.6 16.4 Q11 13.8 17 16.6 M23 16.6 Q29 13.8 34.4 16.4', 'M13.5 31 Q20 35.2 26.5 31'],
  severe: ['M5 22 Q11 17 17 22 Q11 26 5 22 Z', 'M23 22 Q29 18.4 35 22 Q29 26 23 22 Z', 'M11 20.2 a2 2 0 1 0 .1 0', 'M29 20.6 a2 2 0 1 0 .1 0', 'M4.6 12 Q10 7.6 17.4 12.4', 'M22.6 17.6 Q29 16 35.4 18.2', 'M14 32 Q20 30.6 26 32'],
  sceptre: ['M14 37 L25 7', 'M25 7 Q22.4 5.4 23.2 3.2 Q25 4.6 25.4 6.4 Q26.6 4.2 28.6 4.6 Q27 6.8 25 7.4', 'M23.6 10.8 a1.4 1.4 0 1 0 .1 0', 'M27 37 L16 9.5', 'M16 9.5 Q13.4 7.6 14.4 5 L16.4 4.6 L17.4 7.6 L18 5.6 Q19 7.6 17 10'],
  constitution: ['M4 13 Q12 10.5 20 14 Q28 10.5 36 13 V31 Q28 28.5 20 32 Q12 28.5 4 31 Z', 'M20 14 V32', 'M7.5 16.5 Q12 15.2 17 17 M7.5 19.5 Q12 18.2 17 20 M7.5 22.5 Q12 21.2 17 23 M7.5 25.5 Q12 24.2 15 25', 'M23 17 Q28 15.2 32.5 16.5 M23 20 Q28 18.2 32.5 19.5 M23 23 Q28 21.2 32.5 22.5'],
  chien: ['M11 16 Q10 8.6 16.4 7.6 Q22.8 7.2 23.4 13 Q23.6 15.6 22 17', 'M11 16 Q7 17 6.4 14.6 Q6.6 12.4 10.4 12', 'M6.4 14.6 h-.1', 'M17.6 8.6 Q21 9 21.6 16 Q19.6 18.4 18 15.6', 'M13.6 11.2 h.1', 'M13 17.6 Q12 26 13.6 36 M22 17.4 Q27.6 22 29 30 Q30 35 27 36', 'M13.6 36 H18 M22 36 H28', 'M17.4 26 Q18.4 31 18 36', 'M28.4 30 Q33.6 27 34.2 22'],
  tablette: ['M9 6.5 Q9 5 10.5 5 H29.5 Q31 5 31 6.5 V33.5 Q31 35 29.5 35 H10.5 Q9 35 9 33.5 Z', 'M11.5 8 H28.5 V30 H11.5 Z', 'M19.2 32.6 h1.6', 'M14 12 h8 M14 15 h12 M14 18 h10', 'M14 22 h5 v5 h-5z M21 22 h5 v5 h-5z'],
};

/* Champ de blé et toits : tirage fixe (pas de hasard d'une partie à l'autre) */
function seq(seed: number): () => number { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }
const rw = seq(7);
const WHEAT = Array.from({ length: 70 }, () => {
  const y = 172 + rw() * rw() * 80, x = rw() * 204 - 2, h = 4 + (y - 168) * 0.22, lean = (rw() - 0.5) * h * 0.5;
  return { d: `M${x.toFixed(1)} ${y.toFixed(1)} q${(lean * 0.4).toFixed(1)} ${(-h * 0.6).toFixed(1)} ${lean.toFixed(1)} ${(-h).toFixed(1)}`, w: (0.5 + (y - 170) * 0.014).toFixed(2), light: rw() < 0.55 };
});
const rp = seq(11);
const WINDOWS = Array.from({ length: 16 }, (_, i) => ({ x: 6 + i * 12.4 + rp() * 3, y: i % 2 ? 186 : 214, lit: rp() < 0.45 }));
const CHIMNEYS = Array.from({ length: 9 }, (_, i) => ({ x: 8 + i * 22 + rp() * 6, y: i % 2 ? 160 : 176, h: 8 + rp() * 6 }));

let seqId = 0;
const BOTTLES = [[10, 60, 12, 5, '#5f8f7a'], [24, 60, 16, 6, '#c78a4a'], [38, 60, 10, 4, '#6a7fb0'], [88, 60, 14, 5, '#8a6aa8'], [102, 60, 9, 7, '#4f9a9a'], [12, 120, 15, 5, '#b65a4a'], [30, 120, 11, 6, '#6aa86a'], [94, 120, 18, 5, '#c8a24a'], [108, 120, 12, 4, '#5f8f7a']]
  .map(([x, y, h, n, c]) => ({ x: x as number, y: y as number, h: h as number, n: n as number, c: c as string }));

@Component({
  selector: 'app-portrait-game',
  template: `
    <div class="pt">
      <p class="cmd"><b>La commande du chambellan</b> {{ command.text }}</p>
      <div class="cols">
        <div class="canvas" [class.reveal]="over()">
          <div class="frame">
            <svg class="paint" viewBox="0 0 200 250" role="img" [attr.aria-label]="ariaPainting()" preserveAspectRatio="xMidYMid slice">
              <defs>
                <filter [attr.id]="id('brush')" x="-5%" y="-5%" width="110%" height="110%">
                  <feTurbulence type="fractalNoise" baseFrequency=".035 .06" numOctaves="2" seed="4" result="n" />
                  <feDisplacementMap in="SourceGraphic" in2="n" scale="4.5" xChannelSelector="R" yChannelSelector="G" />
                  <feGaussianBlur stdDeviation=".55" />
                </filter>
                <filter [attr.id]="id('brush2')" x="-5%" y="-5%" width="110%" height="110%">
                  <feTurbulence type="fractalNoise" baseFrequency=".06 .09" numOctaves="2" seed="9" result="n" />
                  <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
                  <feGaussianBlur stdDeviation=".3" />
                </filter>
                <filter [attr.id]="id('soft')" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" /></filter>
                <filter [attr.id]="id('glow')" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
                <filter [attr.id]="id('strokes')" x="0" y="0" width="100%" height="100%">
                  <feTurbulence type="fractalNoise" baseFrequency=".018 .32" numOctaves="3" seed="2" />
                  <feColorMatrix type="matrix" values="0 0 0 0 .2  0 0 0 0 .14  0 0 0 0 .08  0 0 0 -1.6 1.05" />
                </filter>
                <filter [attr.id]="id('grain')" x="0" y="0" width="100%" height="100%">
                  <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="5" />
                  <feColorMatrix type="saturate" values="0" />
                  <feComponentTransfer><feFuncA type="table" tableValues="0 .2" /></feComponentTransfer>
                </filter>
                <pattern [attr.id]="id('weave')" width="2.4" height="2.4" patternUnits="userSpaceOnUse">
                  <path d="M0 .6 H2.4 M.6 0 V2.4" stroke="#2a1d10" stroke-width=".35" opacity=".5" />
                  <path d="M0 1.8 H2.4 M1.8 0 V2.4" stroke="#fff6dc" stroke-width=".3" opacity=".35" />
                </pattern>
                <pattern [attr.id]="id('ermine')" width="11" height="9" patternUnits="userSpaceOnUse">
                  <rect width="11" height="9" fill="#f4efe4" />
                  <path d="M3 2 l-.9 2.6 l.9 -.6 l.9 .6 Z M8.5 6.4 l-.9 2.4 l.9 -.6 l.9 .6 Z" fill="#141414" />
                </pattern>
                <pattern [attr.id]="id('knit')" width="3.2" height="4" patternUnits="userSpaceOnUse">
                  <path d="M.4 0 L1.6 2 L2.8 0 M.4 2 L1.6 4 L2.8 2" fill="none" stroke="#5b4a32" stroke-width=".35" opacity=".45" />
                </pattern>
                <linearGradient [attr.id]="id('gold')" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#fbe7a1" /><stop offset=".35" stop-color="#c9973a" /><stop offset=".7" stop-color="#7d5617" /><stop offset="1" stop-color="#e8c56c" />
                </linearGradient>
                <linearGradient [attr.id]="id('velvet')" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stop-color="#4a0a10" /><stop offset=".35" stop-color="#9c1f28" /><stop offset=".6" stop-color="#7a141c" /><stop offset="1" stop-color="#3a070c" />
                </linearGradient>
                <linearGradient [attr.id]="id('shadeX')" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stop-color="#fff" stop-opacity=".16" /><stop offset=".45" stop-color="#fff" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity=".42" />
                </linearGradient>
                <radialGradient [attr.id]="id('skin')" cx=".42" cy=".38" r=".7">
                  <stop offset="0" stop-color="#f1cfae" /><stop offset=".55" stop-color="#dcae88" /><stop offset="1" stop-color="#a8765a" />
                </radialGradient>
                <radialGradient [attr.id]="id('studio')" cx=".42" cy=".3" r=".85">
                  <stop offset="0" stop-color="#6d5638" /><stop offset=".55" stop-color="#3a2c1d" /><stop offset="1" stop-color="#1a130c" />
                </radialGradient>
                <linearGradient [attr.id]="id('primed')" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#d9c29a" /><stop offset="1" stop-color="#b99a6c" />
                </linearGradient>
                <linearGradient [attr.id]="id('dusk')" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#2f3d6b" /><stop offset=".45" stop-color="#9a6a7c" /><stop offset=".72" stop-color="#ec9a5c" /><stop offset="1" stop-color="#f8d088" />
                </linearGradient>
                <linearGradient [attr.id]="id('field')" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#b98a35" /><stop offset=".4" stop-color="#a07228" /><stop offset="1" stop-color="#5e3f14" />
                </linearGradient>
                <linearGradient [attr.id]="id('parisSky')" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#4c5f86" /><stop offset=".55" stop-color="#a0a4b8" /><stop offset="1" stop-color="#eebf8e" />
                </linearGradient>
                <linearGradient [attr.id]="id('zinc')" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#7d8798" /><stop offset="1" stop-color="#4a5262" />
                </linearGradient>
                <linearGradient [attr.id]="id('hall')" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#5a3f1c" /><stop offset=".35" stop-color="#b48a45" /><stop offset=".62" stop-color="#e8cf96" /><stop offset="1" stop-color="#6e4a22" />
                </linearGradient>
                <linearGradient [attr.id]="id('mirror')" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#e9eef0" /><stop offset=".5" stop-color="#9aa9ae" /><stop offset="1" stop-color="#d5dcd8" />
                </linearGradient>
                <linearGradient [attr.id]="id('lab')" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#cfd8d6" /><stop offset=".6" stop-color="#8fa3a3" /><stop offset="1" stop-color="#3d4b4f" />
                </linearGradient>
                <radialGradient [attr.id]="id('light')" cx=".22" cy=".12" r="1">
                  <stop offset="0" stop-color="#fff3d6" stop-opacity=".22" /><stop offset=".45" stop-color="#fff3d6" stop-opacity="0" /><stop offset=".8" stop-color="#140c04" stop-opacity=".18" /><stop offset="1" stop-color="#140c04" stop-opacity=".55" />
                </radialGradient>
                <linearGradient [attr.id]="id('varnish')" x1="0" y1="0" x2="1" y2="1">
                  <stop offset=".1" stop-color="#fff" stop-opacity="0" /><stop offset=".26" stop-color="#fff" stop-opacity=".16" /><stop offset=".34" stop-color="#fff" stop-opacity=".04" /><stop offset=".5" stop-color="#fff" stop-opacity="0" />
                </linearGradient>
                <radialGradient [attr.id]="id('lamp')" cx=".5" cy=".5" r=".5">
                  <stop offset="0" stop-color="#fff2c4" stop-opacity=".95" /><stop offset=".3" stop-color="#ffd884" stop-opacity=".55" /><stop offset="1" stop-color="#ffcf70" stop-opacity="0" />
                </radialGradient>
              </defs>

              <!-- Le fond -->
              <g [attr.filter]="url('brush')">
                @switch (k(2)) {
                  @case ('glaces') {
                    <rect x="-12" y="-12" width="224" height="274" [attr.fill]="url('hall')" />
                    <path d="M-12 -12 H212 V32 L120 92 H80 L-12 32 Z" fill="#4c3415" />
                    <path d="M0 40 L80 92 L120 92 L200 40" fill="none" stroke="#e7c46d" stroke-width="2" />
                    @for (a of [0, 1, 2]; track a) {
                      <path [attr.d]="'M' + (4 + a * 26) + ' ' + (196 - a * 26) + ' V' + (74 + a * 9) + ' Q' + (15 + a * 24) + ' ' + (52 + a * 14) + ' ' + (26 + a * 22) + ' ' + (80 + a * 10) + ' V' + (180 - a * 22) + ' Z'" [attr.fill]="url('mirror')" stroke="#d9b45a" stroke-width="2.2" opacity=".9" />
                      <path [attr.d]="'M' + (196 - a * 26) + ' ' + (196 - a * 26) + ' V' + (74 + a * 9) + ' Q' + (185 - a * 24) + ' ' + (52 + a * 14) + ' ' + (174 - a * 22) + ' ' + (80 + a * 10) + ' V' + (180 - a * 22) + ' Z'" [attr.fill]="url('mirror')" stroke="#d9b45a" stroke-width="2.2" opacity=".9" />
                    }
                    <rect x="84" y="92" width="32" height="56" fill="#f3e3b4" />
                    <path d="M-12 262 L84 148 H116 L212 262 Z" fill="#7a5226" />
                    @for (l of [0, 1, 2, 3, 4, 5, 6]; track l) {
                      <path [attr.d]="'M' + (l * 34 - 4) + ' 250 L' + (88 + l * 4) + ' 148'" stroke="#4e3216" stroke-width=".8" opacity=".6" />
                    }
                    @for (c of [[52, 30, 9], [148, 30, 9], [100, 52, 6]]; track $index) {
                      <circle [attr.cx]="c[0]" [attr.cy]="c[1]" [attr.r]="c[2] * 2.4" [attr.fill]="url('lamp')" />
                      <circle [attr.cx]="c[0]" [attr.cy]="c[1]" [attr.r]="c[2] * .55" fill="#fff6d8" />
                    }
                  }
                  @case ('ble') {
                    <rect x="-12" y="-12" width="224" height="274" [attr.fill]="url('dusk')" />
                    <circle cx="150" cy="160" r="30" fill="#ffe0a0" opacity=".5" [attr.filter]="url('glow')" />
                    <circle cx="150" cy="162" r="14" fill="#fff0c4" />
                    <path d="M8 70 Q50 58 92 72 Q60 80 8 70 Z M110 50 Q150 40 196 52 Q160 60 110 50 Z" fill="#d8909c" opacity=".55" [attr.filter]="url('soft')" />
                    <path d="M0 168 Q20 160 36 166 Q46 158 60 165 Q90 162 120 168 L200 166 V176 H0 Z" fill="#3f3424" opacity=".8" />
                    <path d="M-12 172 Q100 166 212 171 V262 H-12 Z" [attr.fill]="url('field')" />
                    @for (w of wheat; track $index) {
                      <path [attr.d]="w.d" [attr.stroke]="w.light ? '#f0c96e' : '#6e4a17'" [attr.stroke-width]="w.w" stroke-linecap="round" fill="none" />
                    }
                  }
                  @case ('paris') {
                    <rect x="-12" y="-12" width="224" height="274" [attr.fill]="url('parisSky')" />
                    <g opacity=".55" fill="#5c6478">
                      <path d="M163 158 L166.5 64 L170 158 Z" /><path d="M156 172 Q166.5 120 177 172 Z" fill="#6a7186" />
                      <rect x="160" y="128" width="13" height="2.2" /><rect x="163" y="100" width="7" height="1.6" />
                    </g>
                    <path d="M0 176 L12 160 H48 L60 176 L72 166 H110 L124 180 L136 162 H176 L192 174 L200 170 V250 H0 Z" [attr.fill]="url('zinc')" />
                    @for (c of chimneys; track $index) {
                      <rect [attr.x]="c.x" [attr.y]="c.y - c.h" width="9" [attr.height]="c.h + 6" fill="#9c6a4a" />
                      <rect [attr.x]="c.x + 1.5" [attr.y]="c.y - c.h - 4" width="2.4" height="4.5" fill="#b0785a" /><rect [attr.x]="c.x + 5" [attr.y]="c.y - c.h - 3.2" width="2.4" height="3.6" fill="#a06a4a" />
                    }
                    <path d="M-12 190 H212 V262 H-12 Z" fill="#c9b79a" />
                    <path d="M0 182 L200 182 L200 192 L0 192 Z" fill="#59616f" />
                    @for (w of windows; track $index) {
                      <rect [attr.x]="w.x" [attr.y]="w.y" width="7" height="14" [attr.fill]="w.lit ? '#ffd38a' : '#3f4656'" />
                    }
                  }
                  @case ('labo') {
                    <rect x="-12" y="-12" width="224" height="274" [attr.fill]="url('lab')" />
                    <rect x="120" y="20" width="62" height="90" fill="#eef4f2" opacity=".85" />
                    <path d="M151 20 V110 M120 65 H182" stroke="#8a9b9b" stroke-width="2.4" />
                    <rect x="0" y="60" width="200" height="3" fill="#6d7d7f" /><rect x="0" y="120" width="200" height="3" fill="#6d7d7f" />
                    @for (b of bottles; track $index) {
                      <path [attr.d]="'M' + b.x + ' ' + b.y + ' v-' + b.h + ' q0 -3 3 -4 v-' + b.n + ' h3 v' + b.n + ' q3 1 3 4 v' + b.h + ' z'" [attr.fill]="b.c" opacity=".8" />
                      <path [attr.d]="'M' + (b.x + 1.6) + ' ' + (b.y - 1.5) + ' v-' + (b.h - 2)" stroke="#fff" stroke-width=".8" opacity=".5" />
                    }
                    <rect x="-12" y="196" width="224" height="66" fill="#2f3a3d" />
                    <rect x="0" y="192" width="200" height="6" fill="#cfd6d2" />
                    <path d="M150 192 V170 L142 150 Q140 146 146 146 H160 Q166 146 164 150 L156 170 V192 Z" fill="#bfe0d6" opacity=".7" />
                    <path d="M146 178 H160 L156 170 V192 H150 V170 Z" fill="#4fae8a" opacity=".6" />
                    <path d="M172 192 V158 L178 150 L184 158 V192 Z M176 150 L190 134" fill="none" stroke="#2c3436" stroke-width="3" />
                  }
                  @default {
                    @if (step() > 0) { <rect x="-12" y="-12" width="224" height="274" [attr.fill]="url('studio')" /> }
                    @else { <rect x="-12" y="-12" width="224" height="274" [attr.fill]="url('primed')" /> }
                  }
                }
              </g>

              @if (pose(); as P) {
                <!-- Le trône, derrière le modèle -->
                @if (k(0) === 'trone') {
                  <g [attr.filter]="url('brush2')">
                    <path d="M42 252 V60 Q42 32 100 24 Q158 32 158 60 V252 Z" [attr.fill]="url('gold')" />
                    <path d="M50 252 V64 Q52 40 100 34 Q148 40 150 64 V252 Z" [attr.fill]="url('velvet')" />
                    @for (t of [[70, 70], [100, 58], [130, 70], [62, 120], [138, 120], [62, 170], [138, 170]]; track $index) { <circle [attr.cx]="t[0]" [attr.cy]="t[1]" r="1.6" fill="#e8c56c" /> }
                    <path d="M92 22 L100 8 L108 22 Z" [attr.fill]="url('gold')" /><circle cx="100" cy="8" r="3" fill="#fbe7a1" />
                  </g>
                }

                <!-- Le modèle -->
                <g [attr.transform]="P.tf">
                  <g [attr.filter]="url('brush2')">
                    @if (k(0) === 'marche') {
                      <path d="M76 206 L64 252 H90 L99 210 Z" [attr.fill]="trousers()" /><path d="M101 210 L116 252 H142 L126 204 Z" [attr.fill]="trousers()" />
                    }
                    <path [attr.d]="k(0) === 'marche' ? 'M60 114 Q62 103 80 99 L120 99 Q138 103 140 114 L132 214 Q100 220 68 214 Z' : 'M60 114 Q62 103 80 99 L120 99 Q138 103 140 114 L150 252 L50 252 Z'" [attr.fill]="cloth()" />
                    @switch (k(1)) {
                      @case ('hermine') {
                        <path d="M86 100 L114 100 L118 252 L82 252 Z" fill="#efe2bf" /><path d="M100 104 V252" stroke="#c9a24a" stroke-width="3" />
                        @for (y of [128, 156, 184, 212]; track y) { <circle cx="100" [attr.cy]="y" r="2.2" fill="#b0262e" /> }
                        <path d="M34 252 Q36 150 58 110 Q70 101 88 102 Q80 150 84 252 Z" [attr.fill]="url('velvet')" />
                        <path d="M166 252 Q164 150 142 110 Q130 101 112 102 Q120 150 116 252 Z" [attr.fill]="url('velvet')" />
                        <path d="M70 130 Q66 190 70 250 M150 140 Q156 196 152 250 M46 200 Q44 230 46 252" stroke="#e05a62" stroke-width="2" opacity=".35" fill="none" />
                        <path d="M84 104 Q81 170 86 252 L80 252 Q76 170 80 104 Z M116 104 Q119 170 114 252 L120 252 Q124 170 120 104 Z" [attr.fill]="url('ermine')" />
                        <path d="M58 106 Q100 128 142 106 L146 122 Q100 148 54 122 Z" [attr.fill]="url('ermine')" />
                      }
                      @case ('uniforme') {
                        <path d="M88 98 H112 V106 Q100 110 88 106 Z" fill="#c9973a" />
                        <path d="M128 106 L134 116 L76 236 L66 228 Z" fill="#a8202a" /><path d="M129 108 L70 232" stroke="#e8c56c" stroke-width=".8" />
                        @for (y of [118, 136, 154, 172, 190]; track y) { <circle cx="93" [attr.cy]="y" r="1.8" fill="#e8c56c" /><circle cx="107" [attr.cy]="y" r="1.8" fill="#e8c56c" /> }
                        @for (m of [[76, 136, '#2f5aa8'], [84, 138, '#c22a2a'], [80, 150, '#e8c56c']]; track $index) {
                          <rect [attr.x]="+m[0] - 2.5" [attr.y]="+m[1] - 7" width="5" height="5" [attr.fill]="m[2]" /><circle [attr.cx]="m[0]" [attr.cy]="+m[1] + 1" r="2.6" fill="#e8c56c" stroke="#7d5617" stroke-width=".5" />
                        }
                        @for (s of [62, 138]; track s) {
                          <ellipse [attr.cx]="s" cy="107" rx="12" ry="5" [attr.fill]="url('gold')" />
                          @for (f of [-9, -6, -3, 0, 3, 6, 9]; track f) { <path [attr.d]="'M' + (s + f) + ' 111 v7'" stroke="#e0b856" stroke-width="1.2" /> }
                        }
                      }
                      @case ('sombre') {
                        <path d="M90 99 L100 148 L110 99 Z" fill="#ece8e0" />
                        <path d="M90 99 L95 109 L100 101 L105 109 L110 99" fill="#fbf8f2" stroke="#b9b2a4" stroke-width=".6" />
                        <path d="M88 100 L100 170 L80 136 L84 112 Z M112 100 L100 170 L120 136 L116 112 Z" fill="#23262c" stroke="#4a4f59" stroke-width=".8" />
                        <circle cx="100" cy="184" r="1.8" fill="#15171b" /><circle cx="100" cy="204" r="1.8" fill="#15171b" />
                        <path d="M118 128 l9 -1.4 l.6 3.4 l-9 1.2 Z" fill="#d8d2c4" />
                      }
                      @case ('pull') {
                        <path d="M60 114 Q62 103 80 99 L120 99 Q138 103 140 114 L150 252 L50 252 Z" [attr.fill]="url('knit')" />
                        <path d="M84 99 Q100 116 116 99 L112 98 Q100 110 88 98 Z" fill="#9a876b" />
                        <path d="M89 99 L95 104 L100 98 L105 104 L111 99" fill="#f0ece2" stroke="#b3ab9b" stroke-width=".5" />
                      }
                    }
                    <path d="M76 132 Q72 190 74 250 M124 132 Q128 190 126 250 M92 176 Q90 214 92 250" stroke="#000" stroke-opacity=".14" stroke-width="3.2" fill="none" [attr.filter]="url('soft')" />
                    <path d="M70 140 Q66 190 66 240" stroke="#fff" stroke-opacity=".1" stroke-width="2.4" fill="none" [attr.filter]="url('soft')" />
                    <path [attr.d]="k(0) === 'marche' ? 'M60 114 Q62 103 80 99 L120 99 Q138 103 140 114 L132 214 Q100 220 68 214 Z' : 'M60 114 Q62 103 80 99 L120 99 Q138 103 140 114 L150 252 L50 252 Z'" [attr.fill]="url('shadeX')" />
                    <!-- cou -->
                    <path d="M91 84 L109 84 L110 101 Q100 106 90 101 Z" [attr.fill]="url('skin')" />
                    <path d="M91 92 Q100 99 109 92 L109 98 Q100 104 91 98 Z" fill="#7a4a32" opacity=".28" />
                  </g>

                  @if (k(0) === 'accoude') {
                    <g [attr.filter]="url('brush2')">
                      <rect x="-10" y="203" width="220" height="10" fill="#c9bea6" /><rect x="-10" y="211" width="220" height="3" fill="#8a7f68" />
                      @for (b of [8, 36, 64, 92, 120, 148, 176]; track b) { <path [attr.d]="'M' + b + ' 214 h14 q-6 8 -2 16 q6 8 2 20 h-14 q-4 -12 2 -20 q4 -8 -2 -16 Z'" fill="#b3a88f" /> }
                    </g>
                  }

                  <!-- Les bras -->
                  <g [attr.filter]="url('brush2')">
                    @for (a of P.arms; track $index) {
                      <path [attr.d]="armPath(a, true)" [attr.stroke]="sleeve()" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                      <path [attr.d]="armPath(a, false)" [attr.stroke]="k(1) === 'pull' ? '#d9a983' : sleeve()" [attr.stroke-width]="k(1) === 'pull' ? 12 : 17" stroke-linecap="round" fill="none" />
                      @if (k(1) === 'pull') { <circle [attr.cx]="a[1][0]" [attr.cy]="a[1][1]" r="9.5" fill="#a8957a" /> }
                      @if (k(1) === 'uniforme' || k(1) === 'hermine') { <circle [attr.cx]="cuff(a)[0]" [attr.cy]="cuff(a)[1]" r="8.6" [attr.fill]="k(1) === 'hermine' ? '#e9dcbc' : '#c9973a'" /><circle [attr.cx]="cuff(a)[0]" [attr.cy]="cuff(a)[1]" r="8.6" fill="none" stroke="#c9973a" stroke-width="1.4" /> }
                      @if (k(1) === 'sombre') { <circle [attr.cx]="cuff(a)[0]" [attr.cy]="cuff(a)[1]" r="7" fill="#f4f1ea" /> }
                      <path [attr.d]="armPath(a, true) + ' ' + armPath(a, false)" stroke="#000" stroke-opacity=".18" stroke-width="5" fill="none" stroke-linecap="round" transform="translate(4 3)" />
                    }
                    @if (k(0) === 'trone') {
                      <rect x="24" y="192" width="46" height="9" rx="4" [attr.fill]="url('gold')" /><rect x="130" y="192" width="46" height="9" rx="4" [attr.fill]="url('gold')" />
                      <circle cx="26" cy="196" r="7" [attr.fill]="url('gold')" /><circle cx="174" cy="196" r="7" [attr.fill]="url('gold')" />
                    }
                  </g>

                  @if (k(4) === 'sceptre') {
                    <g [attr.filter]="url('brush2')">
                      <path [attr.d]="'M' + (hand(1)[0] - 10) + ' ' + (hand(1)[1] + 50) + ' L' + (hand(1)[0] + 16) + ' ' + (hand(1)[1] - 92)" [attr.stroke]="url('gold')" stroke-width="3.6" stroke-linecap="round" />
                      <g [attr.transform]="'translate(' + (hand(1)[0] + 16) + ' ' + (hand(1)[1] - 92) + ') rotate(10)'">
                        <path d="M0 0 Q-7 -4 -5 -11 Q-1 -9 0 -4 Q1 -13 0 -17 Q4 -12 1 -4 Q2 -9 6 -11 Q7 -4 0 0 Z" fill="#e8c56c" stroke="#7d5617" stroke-width=".6" />
                        <circle cy="5" r="3" fill="#c9973a" />
                      </g>
                      <path [attr.d]="'M' + (hand(0)[0] + 6) + ' ' + (hand(0)[1] + 46) + ' L' + (hand(0)[0] - 10) + ' ' + (hand(0)[1] - 70)" [attr.stroke]="url('gold')" stroke-width="3" stroke-linecap="round" />
                      <g [attr.transform]="'translate(' + (hand(0)[0] - 10) + ' ' + (hand(0)[1] - 70) + ') rotate(-8)'">
                        <path d="M-4 0 Q-5 -8 -3 -12 L-2 -6 L-1 -13 L0 -6 L1 -13 L2 -6 L3 -11 L4 -4 Q4 0 0 1 Z" fill="#f2ead6" stroke="#9a8a6a" stroke-width=".5" />
                      </g>
                    </g>
                  }

                  <!-- Les mains -->
                  @for (a of P.arms; track $index) {
                    <ellipse [attr.cx]="a[2][0]" [attr.cy]="a[2][1]" rx="6.6" ry="7.2" [attr.fill]="url('skin')" />
                    <path [attr.d]="'M' + (a[2][0] - 4) + ' ' + (a[2][1] + 2) + ' q4 3 8 0'" stroke="#9a6a4e" stroke-width=".7" fill="none" opacity=".7" />
                  }

                  @switch (k(4)) {
                    @case ('constitution') {
                      <g [attr.transform]="'translate(' + (hand(1)[0] - 14) + ' ' + (hand(1)[1] - 22) + ') rotate(-8)'" [attr.filter]="url('brush2')">
                        <path d="M-16 2 Q-8 -2 0 3 Q8 -2 16 2 L17 26 Q8 22 0 27 Q-8 22 -17 26 Z" fill="#6e1f1f" />
                        <path d="M-15 0 Q-7 -4 0 1 Q7 -4 15 0 L15.5 23 Q7 19 0 24 Q-7 19 -15.5 23 Z" fill="#f3ead2" />
                        <path d="M0 1 V24" stroke="#b9a882" stroke-width=".8" />
                        @for (l of [4, 7, 10, 13, 16]; track l) { <path [attr.d]="'M-12 ' + l + ' q5 -1.6 10 0 M3 ' + l + ' q5 -1.6 10 0'" stroke="#6b5e48" stroke-width=".5" opacity=".7" /> }
                      </g>
                    }
                    @case ('tablette') {
                      <g [attr.transform]="'translate(' + (hand(1)[0] - 10) + ' ' + (hand(1)[1] - 24) + ') rotate(-14)'">
                        <rect x="-13" y="-17" width="26" height="34" rx="3" fill="#16181c" />
                        <rect x="-11" y="-15" width="22" height="30" rx="1.2" fill="#9cc6e6" />
                        <rect x="-11" y="-15" width="22" height="30" rx="1.2" fill="#fff" opacity=".25" />
                        @for (r of [-11, -7, -3]; track r) { <rect x="-8" [attr.y]="r" [attr.width]="r === -11 ? 14 : 10" height="1.8" fill="#2c5f8a" opacity=".6" /> }
                        <rect x="-8" y="2" width="7" height="7" fill="#e7f2fb" opacity=".8" /><rect x="1" y="2" width="7" height="7" fill="#e7f2fb" opacity=".8" />
                      </g>
                      <ellipse [attr.cx]="hand(1)[0] - 4" [attr.cy]="hand(1)[1] - 6" rx="5" ry="5.6" [attr.fill]="url('skin')" />
                    }
                  }

                  <!-- La tête -->
                  <g [attr.transform]="k(3) === 'loin' ? 'rotate(-5 100 80)' : k(0) === 'accoude' ? 'rotate(4 100 80)' : ''">
                    <ellipse cx="84.5" cy="77" rx="3" ry="5" [attr.fill]="url('skin')" /><ellipse cx="115.5" cy="77" rx="3" ry="5" [attr.fill]="url('skin')" />
                    <ellipse cx="100" cy="74" rx="15" ry="19" [attr.fill]="url('skin')" />
                    <ellipse cx="92" cy="82" rx="3.6" ry="2.4" fill="#d48a74" opacity=".35" /><ellipse cx="108" cy="82" rx="3.6" ry="2.4" fill="#d48a74" opacity=".3" />
                    <path d="M85 70 Q84 52 100 52 Q117 52 115.5 70 Q113 60 104 59 Q96 62 88 60 Q86 64 85 70 Z" fill="#33251a" />
                    <path d="M85.4 68 Q85.2 62 87.6 60 M114.6 68 Q114.8 62 112.6 60" stroke="#8d8378" stroke-width="1.6" fill="none" />
                    <!-- le regard -->
                    @let lk = look();
                    <ellipse cx="94" cy="74" rx="3.1" ry="1.6" fill="#f2e9dc" /><ellipse cx="106" cy="74" rx="3.1" ry="1.6" fill="#f2e9dc" />
                    <circle [attr.cx]="94 + lk.dx" [attr.cy]="74 + lk.dy" r="1.3" fill="#3a2718" /><circle [attr.cx]="106 + lk.dx" [attr.cy]="74 + lk.dy" r="1.3" fill="#3a2718" />
                    @if (k(3) === 'las') { <path d="M90.6 73.8 Q94 71.4 97.4 73.8 Z M102.6 73.8 Q106 71.4 109.4 73.8 Z" [attr.fill]="'#c99876'" /><path d="M90.6 74 Q94 75.2 97.4 74 M102.6 74 Q106 75.2 109.4 74" stroke="#5b3a28" stroke-width=".6" fill="none" /> }
                    <path [attr.d]="lk.brows" stroke="#2c1f15" stroke-width="1.3" stroke-linecap="round" fill="none" />
                    <path d="M100 75 Q98.4 82 97 84.4 Q100 86.2 103 84.4" stroke="#a46c4e" stroke-width=".9" fill="none" />
                    <path [attr.d]="lk.mouth" stroke="#8a4434" stroke-width="1.3" stroke-linecap="round" fill="none" />
                    <path d="M89 86 Q100 98 111 86 Q108 93 100 93.6 Q92 93 89 86 Z" fill="#6a3e28" opacity=".14" />
                    @if (k(1) === 'hermine') {
                      <g [attr.filter]="url('brush2')">
                        <path d="M84 62 L84 46 L91 53 L100 40 L109 53 L116 46 L116 62 Q100 58 84 62 Z" [attr.fill]="url('gold')" stroke="#6b4812" stroke-width=".6" />
                        <circle cx="100" cy="56" r="2.2" fill="#b3202a" /><circle cx="91" cy="58" r="1.6" fill="#2f5aa8" /><circle cx="109" cy="58" r="1.6" fill="#2f5aa8" />
                        <circle cx="100" cy="40" r="2" fill="#f3ebd4" /><circle cx="84" cy="46" r="1.6" fill="#f3ebd4" /><circle cx="116" cy="46" r="1.6" fill="#f3ebd4" />
                      </g>
                    }
                  </g>
                </g>

                @if (k(4) === 'chien') {
                  <g [attr.filter]="url('brush2')">
                    <path d="M8 252 Q4 214 22 200 Q40 192 52 206 Q60 222 58 252 Z" fill="#a8702f" />
                    <path d="M30 206 Q36 220 34 252 H48 Q52 226 44 208 Z" fill="#e6c79a" opacity=".85" />
                    <ellipse cx="42" cy="186" rx="13" ry="11.5" fill="#b57a35" transform="rotate(14 42 186)" />
                    <ellipse cx="54" cy="192" rx="7.6" ry="5.6" fill="#c9965a" transform="rotate(20 54 192)" />
                    <circle cx="59.6" cy="190.6" r="2.2" fill="#1c140e" />
                    <path d="M33 178 Q24 184 27 200 Q32 202 35 194 Q36 186 33 178 Z" fill="#7a4c1e" />
                    <circle cx="47" cy="183" r="1.4" fill="#1c140e" /><circle cx="47.4" cy="182.6" r=".4" fill="#fff" />
                    <path d="M8 252 Q4 214 22 200" stroke="#5e3a14" stroke-width="1.4" fill="none" opacity=".5" />
                  </g>
                }
              } @else {
                <!-- Esquisse au fusain sur la toile apprêtée -->
                <g class="sketch" fill="none" stroke="#2b2016" stroke-linecap="round">
                  <ellipse cx="100" cy="74" rx="15" ry="19" stroke-width="1.1" opacity=".6" />
                  <path d="M100 55 V93 M86 74 H114" stroke-width=".5" opacity=".35" />
                  <path d="M91 92 L90 101 M109 92 L110 101 M62 112 Q66 102 90 100 M138 112 Q134 102 110 100" stroke-width="1" opacity=".55" />
                  <path d="M62 112 L52 250 M138 112 L148 250 M62 112 Q54 150 60 190 M138 112 Q146 150 140 190" stroke-width=".9" opacity=".45" />
                  <path d="M20 30 L180 30 M20 220 L180 220 M30 20 L30 240 M170 20 L170 240" stroke-width=".4" opacity=".25" stroke-dasharray="2 3" />
                </g>
              }

              <!-- Lumière, toile et vernis -->
              <rect width="200" height="250" [attr.fill]="url('light')" />
              <rect width="200" height="250" [attr.filter]="url('strokes')" opacity=".3" style="mix-blend-mode: multiply" />
              <rect width="200" height="250" [attr.fill]="url('weave')" opacity=".2" style="mix-blend-mode: multiply" />
              <rect width="200" height="250" [attr.filter]="url('grain')" opacity=".6" />
              <rect width="200" height="250" fill="#c9952e" opacity=".07" style="mix-blend-mode: multiply" />
              <rect width="200" height="250" [attr.fill]="url('varnish')" />
            </svg>
          </div>
          <div class="cartel" aria-hidden="true"><b>Portrait officiel</b> <span>huile sur toile · {{ step() }}/{{ steps.length }}</span></div>
          <div class="bars">
            @for (a of axes; track a) {
              <div class="b"><span>{{ label[a] }}</span><i><em [style.width.%]="pct(a)"></em></i></div>
            }
          </div>
        </div>
        <div class="choice">
          @if (!over()) {
            <p class="step">{{ step() + 1 }}/{{ steps.length }} · <b>{{ steps[step()].name }}</b></p>
            <div class="opts">
              @for (o of steps[step()].opts; track o.label) {
                <button type="button" class="opt" (click)="choose(o)">
                  <svg class="ic" viewBox="0 0 40 40" aria-hidden="true">
                    <rect width="40" height="40" class="paper" />
                    <g class="pencil">@for (d of sketch(o.k); track $index) { <path [attr.d]="d" /> }</g>
                    <g class="pencil ghost">@for (d of sketch(o.k); track $index) { <path [attr.d]="d" /> }</g>
                  </svg>
                  <span class="lb">{{ o.label }}</span>
                </button>
              }
            </div>
            <div class="timer" role="img" [attr.aria-label]="'Patience du peintre : ' + round(left() * 100) + ' %'"><i [style.width.%]="left() * 100"></i></div>
          } @else {
            <p class="verdict"><b>{{ verdict() }}</b></p>
            <p class="muted small">Ce qu’attendait le pays : @for (a of axes; track a) { {{ label[a] }} {{ command.target[a] }}@if (!$last) { · } }</p>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; --gilt: #b08d3c; --paper: color-mix(in srgb, #f6efdc 86%, var(--bg)); --ink-p: #2b2219; }
    .pt { display: grid; gap: 12px; }
    .cmd { position: relative; margin: 0; padding: 10px 46px 10px 12px; font: italic 13.5px/1.45 var(--font-display); color: #3b2f22; border-radius: 3px;
      background: linear-gradient(180deg, rgba(255, 255, 255, .35), transparent 40%), var(--paper);
      box-shadow: 0 1px 0 rgba(0, 0, 0, .05), 0 6px 14px -8px rgba(40, 25, 10, .45); border: 1px solid color-mix(in srgb, #c9b68c 70%, var(--line));
      b { display: block; font: 600 10.5px/1.4 var(--font-body); font-style: normal; letter-spacing: .12em; text-transform: uppercase; color: #7a5c22; margin-bottom: 2px; }
      &::after { content: ''; position: absolute; right: 10px; top: 10px; width: 26px; height: 26px; border-radius: 47% 53% 50% 48%;
        background: radial-gradient(circle at 38% 34%, #d0545a 0 18%, #a3242c 45%, #6e1016 100%);
        box-shadow: 0 1px 2px rgba(0, 0, 0, .35), inset 0 0 0 3px rgba(0, 0, 0, .14), inset 0 0 0 5px rgba(255, 190, 180, .14); } }
    .cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 16px; align-items: start; }
    @media (max-width: 520px) { .cols { grid-template-columns: 1fr; } .canvas { max-width: 270px; justify-self: center; width: 100%; } }
    .canvas { display: grid; gap: 8px; }
    /* Le cadre doré : moulures superposées, rang de perles, coins */
    .frame { position: relative; aspect-ratio: 4 / 5; padding: 16px; border-radius: 3px; box-sizing: border-box; transition: filter .6s;
      background:
        linear-gradient(135deg, rgba(255, 246, 210, .55), transparent 30%, transparent 70%, rgba(60, 35, 5, .45)),
        repeating-linear-gradient(45deg, rgba(110, 72, 16, .18) 0 2px, transparent 2px 5px),
        linear-gradient(160deg, #f4d98a, #c49235 28%, #8a5f1c 52%, #d7ab52 74%, #f1d488);
      box-shadow:
        inset 0 0 0 1px #5a3c0e, inset 0 0 0 3px #e9cc7a, inset 0 0 0 4px #7d5617,
        inset 0 0 0 11px rgba(0, 0, 0, 0), inset 0 0 0 12px #5e400f, inset 0 0 0 13px #f0d48a, inset 0 0 0 15px #9a6d22,
        0 2px 0 #3d2a0a, 0 14px 24px -10px rgba(0, 0, 0, .6), 0 4px 10px rgba(0, 0, 0, .25);
      &::before { content: ''; position: absolute; inset: 5px; border: 2.5px dotted rgba(255, 238, 180, .85); border-radius: 2px; pointer-events: none;
        filter: drop-shadow(0 .6px 0 rgba(70, 40, 5, .8)); }
      &::after { content: ''; position: absolute; inset: 0; pointer-events: none;
        background:
          radial-gradient(circle at 7px 7px, #fff1c0 0 2px, #b8862e 3px, #6b4812 5px, transparent 6px),
          radial-gradient(circle at calc(100% - 7px) 7px, #fff1c0 0 2px, #b8862e 3px, #6b4812 5px, transparent 6px),
          radial-gradient(circle at 7px calc(100% - 7px), #fff1c0 0 2px, #b8862e 3px, #6b4812 5px, transparent 6px),
          radial-gradient(circle at calc(100% - 7px) calc(100% - 7px), #fff1c0 0 2px, #b8862e 3px, #6b4812 5px, transparent 6px); } }
    .paint { display: block; width: 100%; height: 100%; box-shadow: 0 0 0 1px #3a2709, inset 0 0 0 1px #000; background: #b99a6c; }
    .canvas.reveal .frame { filter: saturate(1.06) contrast(1.04); }
    .canvas.reveal .paint { animation: glint 1.6s ease .2s both; }
    @keyframes glint { from { filter: brightness(.82); } }
    .cartel { justify-self: center; display: flex; gap: 6px; align-items: baseline; padding: 3px 10px; border-radius: 2px; font-size: 10.5px; color: #3a2a10;
      background: linear-gradient(180deg, #ecd696, #c9a24e); box-shadow: inset 0 0 0 1px rgba(90, 60, 10, .5), 0 1px 2px rgba(0, 0, 0, .2);
      b { font: 600 10.5px var(--font-display); letter-spacing: .04em; } span { opacity: .8; } }
    .bars { display: grid; gap: 5px; }
    .b { display: grid; grid-template-columns: 76px 1fr; gap: 8px; align-items: center; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-2);
      i { position: relative; height: 6px; border-radius: 1px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line); overflow: hidden;
        background-image: repeating-linear-gradient(90deg, transparent 0 calc(25% - 1px), var(--line) calc(25% - 1px) 25%); }
      em { display: block; height: 100%; background: linear-gradient(180deg, #e9c766, #a67b26); transition: width .4s; } }
    .step { margin: 0 0 8px; font-size: 13px; color: var(--ink-2); b { color: var(--ink); font-family: var(--font-display); font-size: 15px; } }
    .opts { display: grid; gap: 7px; }
    .opt { display: flex; gap: 10px; align-items: center; text-align: left; min-height: 56px; padding: 6px 10px 6px 6px; border-radius: 6px; border: 1px solid var(--line); background: var(--surface);
      color: var(--ink); font: 13px/1.3 var(--font-body); cursor: pointer; transition: transform .12s, border-color .12s, box-shadow .12s;
      &:hover { border-color: var(--gilt); box-shadow: 0 3px 10px -6px rgba(60, 40, 10, .6); }
      &:focus-visible { outline: 2px solid var(--gilt); outline-offset: 2px; }
      .lb { min-width: 0; } }
    .ic { flex: none; width: 44px; height: 44px; border-radius: 2px; box-shadow: 0 1px 2px rgba(0, 0, 0, .18), inset 0 0 0 1px rgba(0, 0, 0, .05); }
    .ic .paper { fill: color-mix(in srgb, #f5eedc 90%, var(--bg)); }
    .ic .pencil { fill: none; stroke: #3b3631; stroke-width: 1.05; stroke-linecap: round; stroke-linejoin: round; }
    .ic .ghost { stroke-width: .6; opacity: .35; transform: translate(.5px, .35px); }
    @media (hover: hover) and (prefers-reduced-motion: no-preference) { .opt:hover { transform: translateY(-1px); } }
    .timer { margin-top: 10px; height: 4px; border-radius: 2px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line); overflow: hidden;
      i { display: block; height: 100%; background: linear-gradient(90deg, #7d5617, #c9973a); transition: width .2s linear; } }
    .verdict { margin: 0; font: 600 15px/1.4 var(--font-display); } .small { font-size: 12px; margin: 6px 0 0; }
    @media (prefers-reduced-motion: reduce) { .frame, .b em, .timer i, .opt { transition: none; } .canvas.reveal .paint { animation: none; } }
  `,
})
export class PortraitGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected readonly steps = STEPS;
  protected readonly axes: Axis[] = ['maj', 'pro', 'mod'];
  protected readonly label = LABEL;
  protected readonly wheat = WHEAT;
  protected readonly windows = WINDOWS;
  protected readonly chimneys = CHIMNEYS;
  protected readonly bottles = BOTTLES;
  protected readonly round = Math.round;
  protected command = COMMANDS[0];
  protected readonly picks = signal<Opt[]>([]);
  protected readonly step = computed(() => this.picks().length);
  protected readonly over = signal(false);
  protected readonly left = signal(1);
  protected readonly verdict = signal('');
  private timer?: ReturnType<typeof setInterval>;
  private finishT?: ReturnType<typeof setTimeout>;
  private stepStart = Date.now();
  private readonly uid = `pt${++seqId}`;

  /* ── Le tableau ── */
  protected readonly pose = computed(() => POSES[this.k(0)] ?? null);
  protected readonly look = computed(() => {
    const smile = this.k(0) === 'accoude' && this.k(3) !== 'severe';
    switch (this.k(3)) {
      case 'loin': return { dx: -1.2, dy: -0.6, brows: 'M89.6 68.6 Q94 66.6 98 68.4 M102 68.4 Q106 66.6 110.4 68.6', mouth: smile ? 'M94.6 89 Q100 92.6 105.4 89' : 'M95 89.4 Q100 90.4 105 89.4' };
      case 'las': return { dx: 0, dy: 0.4, brows: 'M89.8 69.4 Q94 68 98 69.6 M102 69.6 Q106 68 110.2 69.4', mouth: 'M94.4 88.6 Q100 92.4 105.6 88.6' };
      case 'severe': return { dx: 0, dy: 0, brows: 'M89.4 67 Q93.6 63.6 98.2 67.2 M101.8 69.8 Q106 68.4 110.6 69', mouth: 'M94.8 90 Q100 88.8 105.2 90' };
      default: return { dx: 0, dy: 0, brows: 'M89.6 68.8 Q94 67 98 68.8 M102 68.8 Q106 67 110.4 68.8', mouth: smile ? 'M94.4 88.6 Q100 92.8 105.6 88.6' : 'M95 89.4 Q100 90.6 105 89.4' };
    }
  });
  protected readonly ariaPainting = computed(() => {
    const p = this.picks();
    return p.length ? 'Le tableau en cours : ' + p.map(o => o.label.toLowerCase()).join(', ') : 'Toile apprêtée, première esquisse au fusain';
  });

  ngOnInit(): void {
    this.command = COMMANDS[Math.floor(Math.random() * COMMANDS.length)];
    const per = 12000 / Math.max(0.7, this.diff());
    this.timer = setInterval(() => {
      if (this.over()) return;
      const l = 1 - (Date.now() - this.stepStart) / per;
      this.left.set(Math.max(0, l));
      // Le peintre s'impatiente : il choisit au hasard
      if (l <= 0) { this.miss.emit(); const o = STEPS[this.step()].opts; this.choose(o[Math.floor(Math.random() * o.length)]); }
    }, 150);
  }

  ngOnDestroy(): void { clearInterval(this.timer); clearTimeout(this.finishT); }

  protected pick(i: number): Opt | undefined { return this.picks()[i]; }
  protected k(i: number): string { return this.picks()[i]?.k ?? ''; }
  protected id(n: string): string { return `${this.uid}-${n}`; }
  protected url(n: string): string { return `url(#${this.uid}-${n})`; }
  protected sketch(k: string): string[] { return SKETCH[k] ?? []; }
  protected hand(i: number): Pt { return this.pose()?.arms[i][2] ?? [100, 200]; }

  protected armPath(a: Arm, upper: boolean): string {
    const [s, e, h] = a;
    return upper ? `M${s[0]} ${s[1]} L${e[0]} ${e[1]}` : `M${e[0]} ${e[1]} L${h[0]} ${h[1]}`;
  }
  /** Le poignet : un peu avant la main, sur l'avant-bras */
  protected cuff(a: Arm): Pt {
    const [, e, h] = a;
    return [h[0] + (e[0] - h[0]) * 0.3, h[1] + (e[1] - h[1]) * 0.3];
  }
  protected cloth(): string {
    switch (this.k(1)) {
      case 'hermine': return '#e9dcbc';
      case 'uniforme': return '#1d2846';
      case 'sombre': return '#2b2e35';
      case 'pull': return '#b5a184';
      default: return '#5e4630';
    }
  }
  protected sleeve(): string {
    switch (this.k(1)) {
      case 'hermine': return '#8e1b22';
      case 'uniforme': return '#1d2846';
      case 'sombre': return '#2b2e35';
      case 'pull': return '#a8957a';
      default: return '#54402b';
    }
  }
  protected trousers(): string { return this.k(1) === 'pull' ? '#3a4150' : this.k(1) === 'uniforme' ? '#22233a' : this.k(1) ? '#22252b' : '#4a3825'; }

  private sum(): Record<Axis, number> {
    const s = { maj: 0, pro: 0, mod: 0 };
    for (const p of this.picks()) for (const a of this.axes) s[a] += p.v[a];
    return s;
  }

  protected pct(a: Axis): number { return Math.max(0, Math.min(100, (this.sum()[a] + 4) / 24 * 100)); }

  private score(): number {
    const s = this.sum();
    const t = this.command.target;
    const d = Math.sqrt(this.axes.reduce((acc, a) => acc + (s[a] - t[a]) ** 2, 0));
    return Math.max(0, Math.min(1, 1 - d / 18));
  }

  protected choose(o: Opt): void {
    if (this.over()) return;
    this.picks.update(p => [...p, o]);
    this.stepStart = Date.now();
    this.left.set(1);
    this.progress.emit({ live: this.score(), time: 1 - this.step() / STEPS.length });
    if (this.step() >= STEPS.length) this.finish();
  }

  private finish(): void {
    this.over.set(true);
    clearInterval(this.timer);
    const r = this.score();
    this.verdict.set(r >= 0.8 ? 'Un chef-d’œuvre : le portrait sera dans tous les manuels d’histoire.'
      : r >= 0.6 ? 'Un beau portrait, que la presse salue.'
      : r >= 0.4 ? 'Le portrait divise : certains le trouvent à côté de son époque.'
      : 'Un fiasco : le tableau fait le tour des réseaux… pour les mauvaises raisons.');
    if (r < 0.4) this.miss.emit();
    this.finishT = setTimeout(() => this.done.emit(Math.max(0.1, r)), 2200);
  }
}


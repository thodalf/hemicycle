import { GameState, Memory, Npc, OpinionMod } from '../models/game.models';
import { addMessage } from './phone';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Opinions détaillées et souvenirs, à la manière de Crusader
 *  Kings : chaque variation de relation est notée avec sa raison
 *  et sa date, puis s'estompe avec le temps. Les gestes forts
 *  (une trahison, une nomination) deviennent des souvenirs que
 *  les personnalités vous rappellent, des années plus tard.
 * ============================================================ */

/** Durée d'effacement : les petits gestes s'oublient vite, les grands restent longtemps */
function fadeMonths(value: number): number {
  const v = Math.abs(value);
  return v >= 25 ? 48 : v >= 10 ? 24 : 12;
}

/** Une variation de relation, avec sa raison */
export function recordOpinion(d: GameState, npc: Npc, value: number, reason: string): void {
  if (!value) return;
  const list = (d.opinions ??= []);
  // Une même raison le même mois se cumule
  const same = list.find(o => o.npcId === npc.id && o.label === reason && o.week === d.week);
  if (same) { same.value += value; same.left += value; same.months = fadeMonths(same.value); return; }
  list.push({ id: nextId(d, 'op'), npcId: npc.id, label: reason, value, left: value, months: fadeMonths(value), week: d.week });
  if (list.length > 400) list.splice(0, list.length - 400);
}

/** Chaque mois : les opinions s'estompent, les grands gestes deviennent des souvenirs */
export function monthlyOpinions(d: GameState, rng: Rng): void {
  const list = d.opinions ?? [];
  const keep: OpinionMod[] = [];
  for (const o of list) {
    const npc = d.npcs.find(n => n.id === o.npcId);
    if (!npc) continue;
    const step = o.value / o.months;
    const fade = Math.abs(step) > Math.abs(o.left) ? o.left : step;
    o.left -= fade;
    npc.relationToPlayer = clamp(npc.relationToPlayer - fade, -100, 100);
    if (Math.abs(o.left) < 0.3) {
      if (Math.abs(o.value) >= 15) remember(d, o.npcId, o.label, o.value, o.week);
      continue;
    }
    keep.push(o);
  }
  d.opinions = keep;
  // Parfois, une personnalité vous rappelle un souvenir
  if (rng.chance(0.12)) recall(d, rng);
}

function remember(d: GameState, npcId: string, text: string, value: number, week: number): void {
  const mem = (d.memories ??= []);
  if (mem.some(m => m.npcId === npcId && m.text === text && m.week === week)) return;
  mem.push({ npcId, text, value, week });
  if (mem.length > 200) mem.splice(0, mem.length - 200);
}

/** Un geste fort est retenu tout de suite, sans attendre qu'il s'estompe */
export function engrave(d: GameState, npc: Npc, text: string, value: number): void {
  remember(d, npc.id, text, value, d.week);
}

const RECALL_BAD = [
  'Je n’ai pas oublié {t}. Je n’oublie jamais.',
  'Vous vous souvenez de {t} ? Moi, oui. Chaque jour.',
  'On se reverra. Après {t}, vous me devez bien ça.',
];
const RECALL_GOOD = [
  'Je repensais à {t}. Je ne l’oublierai pas, vous savez.',
  'Depuis {t}, vous pouvez compter sur moi.',
  'Merci encore pour {t}. Ça a compté.',
];

function recall(d: GameState, rng: Rng): void {
  const mem = (d.memories ?? []).filter(m => Math.abs(m.value) >= 20 && d.week - m.week >= 6 && d.npcs.some(n => n.id === m.npcId));
  if (!mem.length) return;
  const m = rng.pick(mem);
  const npc = d.npcs.find(n => n.id === m.npcId)!;
  const when = yearsAgo(d, m.week);
  const t = `« ${m.text.toLowerCase()} »${when}`;
  addMessage(d, { kind: 'sms', who: `perso:${npc.id}`, from: npc.name, role: 'Souvenir', text: rng.pick(m.value < 0 ? RECALL_BAD : RECALL_GOOD).replace('{t}', t), read: false });
}

function yearsAgo(d: GameState, week: number): string {
  const y = Math.floor((d.week - week) / 12);
  return y >= 1 ? ` (il y a ${y} an${y > 1 ? 's' : ''})` : '';
}

/** Ce qu'une personnalité pense de vous : socle + raisons datées */
export function opinionBreakdown(d: GameState, npcId: string): { total: number; base: number; mods: OpinionMod[]; memories: Memory[] } {
  const npc = d.npcs.find(n => n.id === npcId);
  const mods = (d.opinions ?? []).filter(o => o.npcId === npcId).sort((a, b) => Math.abs(b.left) - Math.abs(a.left));
  const sum = mods.reduce((s, o) => s + o.left, 0);
  const total = Math.round(npc?.relationToPlayer ?? 0);
  return { total, base: Math.round(total - sum), mods, memories: (d.memories ?? []).filter(m => m.npcId === npcId).slice(-5).reverse() };
}

/** Un nouveau venu (successeur) ne garde rien des rancunes de son prédécesseur */
export function forgetNpc(d: GameState, npcId: string): void {
  d.opinions = (d.opinions ?? []).filter(o => o.npcId !== npcId);
  d.memories = (d.memories ?? []).filter(m => m.npcId !== npcId);
}

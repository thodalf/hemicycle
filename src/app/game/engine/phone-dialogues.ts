import { DialogueState, Effect, GameState, PhoneMessage, PhoneReply } from '../models/game.models';
import { DIALOGUES, DIALOGUE_BY_ID } from '../data/dialogues';
import type { DialogueDef, DlgChoice, DlgNode, Speaker } from '../data/dialogue-types';
import { monthlyQcm, onQcmAnswer } from './phone-qcm';
import { addMessage } from './phone';
import { applyEffects } from './effects';
import { mods } from './difficulty';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Le moteur des conversations à embranchements, des prises de
 *  position et des colles (voir data/dialogue-types.ts).
 *
 *  - Chaque mois, une conversation peut s'ouvrir (deux au plus en
 *    même temps). Chaque réponse fait avancer le fil ; certaines
 *    laissent une trace en mémoire, d'autres reviennent des mois
 *    plus tard avec leurs conséquences.
 *  - De temps en temps, une question à choix multiple : une prise
 *    de position (retenue ; changer d'avis coûte cher) ou une colle
 *    de culture politique (une bonne et trois mauvaises réponses).
 * ============================================================ */

export function dlgState(d: GameState): DialogueState {
  const ph = d.phone!;
  return (ph.dlg ??= { runs: {}, later: [], done: {}, positions: {}, colles: { right: 0, wrong: 0, asked: [] } });
}

function textOf(d: GameState, t: DlgNode['text'] | DlgChoice['end']): string {
  return typeof t === 'function' ? t(d) : (t ?? '');
}

/** L'identifiant de l'interlocuteur (pour les effets qui le visent : '$speaker') */
function speakerId(who: string): string {
  const i = who.indexOf(':');
  return i >= 0 ? who.slice(i + 1) : who;
}

/** Remplace '$speaker' dans les effets par l'identifiant de l'interlocuteur */
function bind(effects: Effect[] | undefined, who: string): Effect[] {
  if (!effects?.length) return [];
  const id = speakerId(who);
  return effects.map(e => {
    const o = { ...e } as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) if (v === '$speaker') o[k] = id;
    return o as unknown as Effect;
  });
}

/** Un nœud arrive dans le téléphone : effets d'arrivée, puis le message et ses réponses */
function postNode(d: GameState, runId: string, def: DialogueDef, nodeId: string, sp: Speaker, rng: Rng): PhoneMessage | null {
  const node = def.nodes[nodeId];
  if (!node) { endRun(d, runId, def.id); return null; }
  const st = dlgState(d);
  const run = st.runs[runId];
  if (run) { run.node = nodeId; run.steps += 1; }
  const summary = node.effects?.length ? applyEffects(d, bind(node.effects, sp.who), { reason: `Au téléphone avec ${sp.from}` }, rng) : [];
  const choices = (node.choices ?? []).filter(c => !c.if || c.if(d));
  const replies: PhoneReply[] = choices.map(c => ({ id: c.id, label: c.label, effects: bind(c.effects, sp.who), ...(c.hint ? { hint: c.hint } : {}) }));
  const msg = addMessage(d, {
    kind: node.call ? 'appel' : 'sms', who: sp.who, from: sp.from, role: sp.role, text: textOf(d, node.text),
    ...(replies.length ? { replies, dlg: { run: runId, def: def.id, node: nodeId } } : {}),
    ...(summary.length ? { summary } : {}),
  });
  if (!replies.length) endRun(d, runId, def.id);
  return msg;
}

function endRun(d: GameState, runId: string, defId: string): void {
  const st = dlgState(d);
  delete st.runs[runId];
  st.done[defId] = d.week;
}

function startRun(d: GameState, def: DialogueDef, sp: Speaker, nodeId: string, rng: Rng): void {
  const st = dlgState(d);
  const runId = `${def.id}@${d.week}@${nodeId}`;
  st.runs[runId] = { def: def.id, who: sp.who, from: sp.from, role: sp.role, node: nodeId, since: d.week, steps: 0 };
  st.done[def.id] = d.week;
  postNode(d, runId, def, nodeId, sp, rng);
}

/** Appelé quand vous répondez à un message de conversation (les effets du choix sont déjà appliqués) */
export function onDialogueAnswer(d: GameState, m: PhoneMessage, replyId: string, rng: Rng): void {
  if (m.qcm) { onQcmAnswer(d, m, replyId, rng); return; }
  if (!m.dlg) return;
  const def = DIALOGUE_BY_ID.get(m.dlg.def);
  const st = dlgState(d);
  const run = st.runs[m.dlg.run];
  const choice = def?.nodes[m.dlg.node]?.choices?.find(c => c.id === replyId);
  if (!def || !choice) return;
  const sp: Speaker = run ? { who: run.who, from: run.from, role: run.role } : { who: m.who, from: m.from, role: m.role };
  for (const [k, v] of Object.entries(choice.remember ?? {})) d.player.flags[`mem_${k}`] = Number(d.player.flags[`mem_${k}`] ?? 0) + v;
  if (choice.later) st.later.push({ week: d.week + Math.max(1, choice.later.months), def: def.id, node: choice.later.node, ...sp });
  let next = choice.next;
  if (choice.risk) {
    const stat = choice.risk.scaleWith ? d.player.stats[choice.risk.scaleWith] : 50;
    const fail = clamp(choice.risk.chance + mods(d).risk - (stat - 50) / 250, 0.05, 0.9);
    if (rng.chance(fail)) next = choice.risk.fail;
  }
  if (next && def.nodes[next]) {
    if (!run) st.runs[m.dlg.run] = { def: def.id, ...sp, node: next, since: d.week, steps: 1 };
    postNode(d, m.dlg.run, def, next, sp, rng);
    return;
  }
  const end = textOf(d, choice.end);
  if (end) addMessage(d, { kind: 'sms', who: sp.who, from: sp.from, role: sp.role, text: end, read: true });
  endRun(d, m.dlg.run, def.id);
}

/* ── Chaque mois ──────────────────────────────────────────── */

function busy(d: GameState, who: string): boolean {
  return (d.phone?.messages ?? []).some(m => m.who === who && !m.outgoing && m.replies?.length && !m.answered);
}

export function monthlyDialogues(d: GameState, rng: Rng): void {
  if (!d.phone || d.status !== 'en_cours') return;
  const st = dlgState(d);
  // 1. Les conversations laissées sans réponse : l'interlocuteur s'en souvient
  for (const [runId, run] of Object.entries(st.runs)) {
    const msg = d.phone.messages.find(m => m.dlg?.run === runId && m.dlg.node === run.node);
    if (!msg) { delete st.runs[runId]; continue; }
    if (msg.answered === 'Sans réponse' || (!msg.answered && d.week - msg.week >= 2)) {
      msg.answered = 'Sans réponse';
      const def = DIALOGUE_BY_ID.get(run.def);
      const node = def?.nodes[run.node];
      if (node?.ignore?.length) msg.summary = applyEffects(d, bind(node.ignore, run.who), { reason: `Silence radio avec ${run.from}` }, rng);
      d.player.flags[`mem_${run.def}_ignore`] = 1;
      endRun(d, runId, run.def);
    }
  }
  // 2. Les suites programmées : les conséquences reviennent
  const due = st.later.filter(l => l.week <= d.week);
  st.later = st.later.filter(l => l.week > d.week);
  for (const l of due) {
    const def = DIALOGUE_BY_ID.get(l.def);
    if (!def?.nodes[l.node]) continue;
    // L'équipier parti, la personnalité disparue : la suite tombe à l'eau
    if (l.who.startsWith('equipe:') && !d.player.team.some(r => r.id === l.who.slice(7))) continue;
    if (l.who.startsWith('perso:') && !d.npcs.some(n => n.id === l.who.slice(6))) continue;
    startRun(d, def, { who: l.who, from: l.from, role: l.role }, l.node, rng);
  }
  // 3. Une nouvelle conversation, peut-être
  const active = Object.keys(st.runs).length;
  if (active < 2 && rng.chance(active ? 0.35 : 0.6)) {
    const running = new Set(Object.values(st.runs).map(r => r.def));
    const pool = DIALOGUES.filter(x => !running.has(x.id)
      && (st.done[x.id] === undefined || (x.repeatAfter !== undefined && d.week - st.done[x.id] >= x.repeatAfter))
      && safeEligible(x, d));
    for (let tries = 0; tries < 4 && pool.length; tries++) {
      const total = pool.reduce((t, x) => t + (x.weight ?? 1), 0);
      let roll = rng.next() * total;
      const k = pool.findIndex(x => (roll -= x.weight ?? 1) < 0);
      const def = pool.splice(Math.max(0, k), 1)[0];
      const sp = def.who(d, rng);
      if (!sp || busy(d, sp.who)) continue;
      startRun(d, def, sp, def.start, rng);
      break;
    }
  }
  // 4. Les questions à choix multiple : séries d'interviews et quiz des élus
  monthlyQcm(d, rng);
}

function safeEligible(def: DialogueDef, d: GameState): boolean {
  try { return def.eligible(d); } catch { return false; }
}

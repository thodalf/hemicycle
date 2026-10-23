import { DialogueState, Effect, GameState, PhoneMessage, PhoneReply } from '../models/game.models';
import { DIALOGUES, DIALOGUE_BY_ID } from '../data/dialogues';
import type { DialogueDef, DlgChoice, DlgNode, Speaker } from '../data/dialogue-types';
import { COLLE_ASKERS, POSITIONS, POSITION_ASKERS, POSITION_BY_ID } from '../data/positions';
import { QUIZ_QUESTIONS } from '../data/quiz';
import { RANKS } from '../data/ranks';
import { addMessage } from './phone';
import { applyEffects, pushNews } from './effects';
import { mods } from './difficulty';
import { Rng, clamp } from './rng';
import { monthLabel } from './calendar';

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

const LETTERS = ['A', 'B', 'C', 'D'];

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

/* ── Questions à choix multiple ──────────────────────────── */

const rankOrderOf = (d: GameState) => RANKS[d.player.rankId]?.order ?? 0;

function askPosition(d: GameState, rng: Rng): boolean {
  const st = dlgState(d);
  const order = rankOrderOf(d);
  // On vous repose surtout les questions déjà posées il y a longtemps (le piège du revirement), sinon un sujet neuf
  const old = POSITIONS.filter(t => st.positions[t.id] && d.week - st.positions[t.id].week >= 10);
  const fresh = POSITIONS.filter(t => !st.positions[t.id] && (t.minOrder ?? 0) <= order);
  const pool = old.length && rng.chance(0.35) ? old : fresh.length ? fresh : old;
  if (!pool.length) return false;
  const t = rng.pick(pool);
  const asker = rng.pick(POSITION_ASKERS);
  const again = st.positions[t.id];
  const replies: PhoneReply[] = t.answers.map((a, i) => ({ id: a.id, label: `${LETTERS[i]}. ${a.label}`, effects: [...a.effects, ...(a.lean ? [{ kind: 'stance', delta: a.lean * 1.5 } as Effect] : [])] }));
  addMessage(d, {
    kind: 'sms', who: 'qcm:presse', from: 'La presse', role: 'Questions des journalistes',
    text: `${asker.from} (${asker.role.toLowerCase()}) : ${again ? 'on vous l’a déjà demandé, mais nos lecteurs veulent savoir. ' : ''}${t.question}`,
    replies, qcm: { kind: 'position', topic: t.id, asker: asker.from },
  });
  return true;
}

function askColle(d: GameState, rng: Rng): boolean {
  const st = dlgState(d);
  const pool = QUIZ_QUESTIONS.filter(q => !st.colles.asked.includes(q.q));
  if (!pool.length) return false;
  const q = rng.pick(pool);
  const asker = rng.pick(COLLE_ASKERS);
  const order = [0, 1, 2, 3].sort(() => rng.next() - 0.5);
  const replies: PhoneReply[] = order.map((k, i) => ({ id: `r${k}`, label: `${LETTERS[i]}. ${q.a[k]}`, effects: [] }));
  st.colles.asked.push(q.q);
  if (st.colles.asked.length > 80) st.colles.asked.splice(0, st.colles.asked.length - 80);
  addMessage(d, {
    kind: 'sms', who: 'qcm:colle', from: 'Les colles', role: 'Questions de culture politique',
    text: `${asker.from} (${asker.role.toLowerCase()}) : ${asker.tv ? 'petite question, on est à l’antenne dans une minute. ' : 'une petite colle pour vous. '}${q.q}`,
    replies, qcm: { kind: 'colle', correct: 'r0', topic: q.q, asker: asker.tv ? 'tv' : 'prive' },
  });
  return true;
}

function onQcmAnswer(d: GameState, m: PhoneMessage, replyId: string, rng: Rng): void {
  const st = dlgState(d);
  const q = m.qcm!;
  if (q.kind === 'colle') {
    const right = replyId === q.correct;
    const tv = q.asker === 'tv';
    const good = m.replies?.find(r => r.id === q.correct)?.label.replace(/^[A-D]\. /, '') ?? '';
    if (right) {
      st.colles.right += 1;
      const out = applyEffects(d, [{ kind: 'stat', stat: 'credibility', delta: tv ? 2 : 1 }, ...(tv ? [{ kind: 'stat', stat: 'popularity', delta: 1 } as Effect] : [])], {}, rng);
      addMessage(d, { kind: 'sms', who: m.who, from: m.from, role: m.role, text: `Bonne réponse ! ${tv ? 'Le plateau applaudit.' : 'Impressionnant.'}`, read: true, summary: out });
    } else {
      st.colles.wrong += 1;
      const out = applyEffects(d, [{ kind: 'stat', stat: 'credibility', delta: tv ? -4 : -1 }, ...(tv ? [{ kind: 'stat', stat: 'popularity', delta: -1 } as Effect] : [])], {}, rng);
      addMessage(d, { kind: 'sms', who: m.who, from: m.from, role: m.role, text: `Raté… la bonne réponse était : ${good}.${tv ? ' La séquence tourne déjà sur les réseaux.' : ''}`, read: true, summary: out });
      if (tv) pushNews(d, 'actu', 'negative', 'Colle en direct : un trou de mémoire qui fait le buzz', `À la question « ${q.topic} », mauvaise réponse. La bonne était : ${good}.`);
    }
    return;
  }
  // Prise de position : retenue ; changer d'avis est un revirement
  const topic = POSITION_BY_ID.get(q.topic ?? '');
  if (!topic) return;
  const prev = st.positions[topic.id];
  const label = topic.answers.find(a => a.id === replyId)?.label ?? '';
  if (prev && prev.answer !== replyId) {
    const flips = prev.flips + 1;
    st.positions[topic.id] = { answer: replyId, week: d.week, times: prev.times + 1, flips };
    const totalFlips = Object.values(st.positions).reduce((t, p) => t + p.flips, 0);
    const out = applyEffects(d, [{ kind: 'stat', stat: 'credibility', delta: -(3 + 2 * flips + Math.min(4, totalFlips - 1)) }, { kind: 'momentum', delta: -4 }], {}, rng);
    const before = topic.answers.find(a => a.id === prev.answer)?.label ?? '';
    addMessage(d, { kind: 'sms', who: m.who, from: m.from, role: m.role, text: `Tiens… en ${monthLabel(prev.week)}, vous nous disiez plutôt : « ${before} ». On publiera les deux citations côte à côte.`, read: true, summary: out });
    pushNews(d, 'actu', 'negative', `Volte-face sur ${topic.label.toLowerCase()}`, `Hier « ${before} », aujourd’hui « ${label} ». ${totalFlips >= 3 ? 'Les éditorialistes parlent de girouette.' : 'L’opposition ironise.'}`);
  } else if (prev) {
    st.positions[topic.id] = { ...prev, week: d.week, times: prev.times + 1 };
    const out = applyEffects(d, [{ kind: 'stat', stat: 'credibility', delta: 2 }], {}, rng);
    addMessage(d, { kind: 'sms', who: m.who, from: m.from, role: m.role, text: 'Vous n’avez pas varié d’un pouce depuis la dernière fois. Nos lecteurs apprécient la constance.', read: true, summary: out });
  } else {
    st.positions[topic.id] = { answer: replyId, week: d.week, times: 1, flips: 0 };
    addMessage(d, { kind: 'sms', who: m.who, from: m.from, role: m.role, text: 'Merci, c’est noté. Votre réponse sera publiée demain.', read: true });
  }
}


/** Vos prises de position, pour le téléphone */
export function positionsList(d: GameState): { topic: string; answer: string; times: number; flips: number; week: number }[] {
  const st = d.phone?.dlg;
  if (!st) return [];
  return Object.entries(st.positions).map(([id, p]) => {
    const t = POSITION_BY_ID.get(id);
    return { topic: t?.label ?? id, answer: t?.answers.find(a => a.id === p.answer)?.label ?? p.answer, times: p.times, flips: p.flips, week: p.week };
  }).sort((a, b) => b.week - a.week);
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
  // 4. Une question à choix multiple, de temps en temps
  const lastQ = Number(d.player.flags['qcmWeek'] ?? -99);
  if (d.week - lastQ >= 2 && !busy(d, 'qcm:presse') && !busy(d, 'qcm:colle') && rng.chance(rankOrderOf(d) >= 1 ? 0.45 : 0.3)) {
    const ok = rng.chance(0.6) ? askPosition(d, rng) || askColle(d, rng) : askColle(d, rng) || askPosition(d, rng);
    if (ok) d.player.flags['qcmWeek'] = d.week;
  }
}

function safeEligible(def: DialogueDef, d: GameState): boolean {
  try { return def.eligible(d); } catch { return false; }
}

import { Effect, GameState, PhoneMessage, PhoneReply, QcmSeries } from '../models/game.models';
import { JOURNALISTS, POSITIONS, POSITION_BY_ID, PositionTopic, SERIES_TITLES } from '../data/positions';
import { QUIZ_QUESTIONS } from '../data/quiz';
import { RANKS } from '../data/ranks';
import { addMessage, directory as directoryOf } from './phone';
import { applyEffects, pushNews } from './effects';
import { mods } from './difficulty';
import { monthLabel } from './calendar';
import { Rng, clamp } from './rng';
import { dlgState } from './phone-dialogues';
import { ARCHETYPES, SeriesArchetype, SeriesCtx, archetypeFor } from '../data/series-archetypes';
import type { PhoneEntry } from './phone';

/* ============================================================
 *  Les questions à choix multiple, en séries au long cours.
 *
 *  L'INTERVIEW AU LONG COURS : un·e journaliste (toujours le ou
 *  la même, dans son propre fil) vous propose une série — « Ce que
 *  pense vraiment… » — de cinq à six questions étalées sur
 *  plusieurs mois. À chaque question :
 *   - quatre réponses, plus un joker « je ne réponds pas » ;
 *   - une RELANCE qui dépend de votre réponse : revirement par
 *     rapport à ce que vous aviez dit, dissidence avec votre parti,
 *     position tranchée, esquive (« et si vous deviez trancher ? »),
 *     ou engagement de programme (qui vous liera plus tard) ;
 *   - le ou la journaliste se souvient de tout et vous le rappelle.
 *  À la fin, le PORTRAIT paraît : « Un cap », « La girouette »,
 *  « L'insaisissable », « Sans concession », « Le franc-tireur »…
 *  selon la cohérence de l'ensemble de vos réponses.
 *
 *  LE QUIZ DES ÉLUS : une saison de cinq colles de culture
 *  politique, un classement face à trois autres personnalités,
 *  des séries de bonnes réponses, et le buzz quand on se trompe
 *  à l'antenne.
 * ============================================================ */

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const QUIZ_HOST = { name: 'Bastien Leroy', outlet: 'France Inter', title: 'Le quiz des élus' };

const st = (stat: 'popularity' | 'credibility' | 'influence' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
const orderOf = (d: GameState) => RANKS[d.player.rankId]?.order ?? 0;
const fem = (d: GameState) => d.player.gender === 'femme';
const e = (d: GameState, m: string, f: string) => (fem(d) ? f : m);

/* ── Messages de la série ─────────────────────────────────── */

function post(d: GameState, s: QcmSeries, text: string, extra: Partial<PhoneMessage> = {}): PhoneMessage {
  return addMessage(d, { kind: 'sms', who: s.who, from: s.journalist, role: `${s.outlet} · ${s.title}`, text, ...extra });
}

function ask(d: GameState, s: QcmSeries, text: string, replies: PhoneReply[], kind: NonNullable<PhoneMessage['qcm']>['kind'], extra: Partial<NonNullable<PhoneMessage['qcm']>> = {}): void {
  post(d, s, text, { replies, qcm: { kind, sid: s.sid, ...extra } });
}

const opt = (id: string, label: string, effects: Effect[] = [], hint?: string): PhoneReply => ({ id, label, effects, ...(hint ? { hint } : {}) });

/* ── Démarrer une série ───────────────────────────────────── */

function startInterview(d: GameState, rng: Rng): void {
  const st0 = dlgState(d);
  const last = st0.history?.at(-1)?.outlet;
  const j = rng.pick(JOURNALISTS.filter(x => x.outlet !== last));
  const title = rng.pick(SERIES_TITLES).replace('{nom}', d.player.name);
  const s: QcmSeries = {
    sid: `iv-${d.week}`, kind: 'interview', journalist: j.name, outlet: j.outlet, title, who: `qcm:${j.outlet}`,
    accepted: false, step: 0, total: orderOf(d) >= 2 ? 6 : 5, nextWeek: d.week, since: d.week,
    answers: [], engagements: [], flips: 0, evasions: 0, joker: false, dissidences: 0, right: 0, wrong: 0, streak: 0, rivals: [],
  };
  st0.series = s;
  const met = (st0.history ?? []).some(h => h.outlet === j.outlet);
  ask(d, s, `Bonjour, ${j.name}, ${j.outlet}. ${met ? 'On se retrouve ! ' : ''}Nous lançons une série : « ${title} ». ${s.total} questions à choix multiple, une par mois environ, sur les grands sujets. Je garderai toutes vos réponses, et le portrait paraîtra à la fin. Vous jouez le jeu ?`, [
    opt('oui', 'Avec plaisir, posez vos questions', [st('credibility', 1)], 'Le portrait dépendra de la cohérence de vos réponses'),
    opt('relecture', 'D’accord, mais je relis le portrait avant parution', [st('credibility', -1)], 'Portrait adouci, journaliste agacé·e'),
    opt('non', 'Non merci, pas le temps', [], 'La chaise vide se remarque'),
  ], 'intro');
}

function startQuiz(d: GameState, rng: Rng): void {
  const st0 = dlgState(d);
  const pool = [...d.npcs].sort(() => rng.next() - 0.5).slice(0, 3);
  const s: QcmSeries = {
    sid: `qz-${d.week}`, kind: 'quiz', journalist: QUIZ_HOST.name, outlet: QUIZ_HOST.outlet, title: QUIZ_HOST.title, who: 'qcm:quiz',
    accepted: false, step: 0, total: 5, nextWeek: d.week, since: d.week,
    answers: [], engagements: [], flips: 0, evasions: 0, joker: false, dissidences: 0, right: 0, wrong: 0, streak: 0,
    rivals: pool.map(n => ({ name: n.name, score: 0 })),
  };
  st0.series = s;
  const names = s.rivals.map(r => r.name).join(', ');
  ask(d, s, `Bonjour ! ${QUIZ_HOST.name}, ${QUIZ_HOST.outlet}. « ${QUIZ_HOST.title} » revient : cinq colles de culture politique, une par mois, à l’antenne. Cette saison, vous seriez face à ${names}. Classement final en direct. Vous en êtes ?`, [
    opt('oui', 'Partant·e !', [st('popularity', 1)], 'Bonne réponse : crédibilité ; erreur à l’antenne : buzz'),
    opt('non', 'Je passe mon tour', [st('popularity', -1)], 'On dira que vous avez eu peur'),
  ], 'intro');
}

/* ── Interview : la question du mois ──────────────────────── */

function pickTopic(d: GameState, s: QcmSeries, rng: Rng): PositionTopic | null {
  const stx = dlgState(d);
  const asked = new Set(s.answers.map(a => a.topic));
  const order = orderOf(d);
  // Le piège : un sujet sur lequel vous vous êtes déjà prononcé·e il y a longtemps
  const arch = s.archetype ? ARCHETYPES[s.archetype] : null;
  const base = arch ? POSITIONS.filter(t => arch.topics.includes(t.id)) : POSITIONS;
  const all = base.length >= s.total ? base : POSITIONS;
  const old = all.filter(t => !asked.has(t.id) && stx.positions[t.id] && d.week - stx.positions[t.id].week >= 8);
  const fresh = all.filter(t => !asked.has(t.id) && !stx.positions[t.id] && (t.minOrder ?? 0) <= order);
  if (arch && !fresh.length && !old.length) { const any = all.filter(t => !asked.has(t.id)); return any.length ? rng.pick(any) : null; }
  const pool = old.length && (s.step >= 2 && rng.chance(0.4)) ? old : fresh.length ? fresh : old;
  return pool.length ? rng.pick(pool) : null;
}

function askMain(d: GameState, s: QcmSeries, rng: Rng): void {
  const t = pickTopic(d, s, rng);
  if (!t) { publishPortrait(d, s, rng); return; }
  const stx = dlgState(d);
  const prev = s.answers.at(-1);
  const prevTopic = prev ? POSITION_BY_ID.get(prev.topic) : null;
  const known = stx.positions[t.id];
  const intro = prev && prevTopic
    ? `${s.kind === 'echange' ? 'On reprend notre discussion' : 'Suite de notre série'}. La dernière fois, sur ${prevTopic.label.toLowerCase()}, vous m’avez répondu « ${prevTopic.answers.find(a => a.id === prev.answer)?.label ?? '…'} ». `
    : s.kind === 'echange' ? '' : 'Première question. ';
  const trap = known ? `Vous vous êtes déjà exprimé${e(d, '', 'e')} sur ce sujet, je le sais. ` : '';
  const replies: PhoneReply[] = t.answers.map((a, i) => opt(a.id, `${LETTERS[i]}. ${a.label}`, [...a.effects, ...(a.lean ? [{ kind: 'stance', delta: a.lean * 1.5 } as Effect] : [])]));
  if (!s.joker) replies.push(opt('joker', `${LETTERS[replies.length]}. Je ne réponds pas à cette question`, [], 'Une seule fois par série ; on notera l’esquive'));
  ask(d, s, `${intro}${trap}Question ${s.step + 1} sur ${s.total} : ${t.question}`, replies, 'position', { topic: t.id });
  s.step += 1;
}

/** Retient une prise de position ; renvoie le revirement éventuel */
function recordPosition(d: GameState, topicId: string, answerId: string, rng: Rng): { flip: boolean; before?: string; when?: number; summary: string[] } {
  const stx = dlgState(d);
  const topic = POSITION_BY_ID.get(topicId)!;
  const prev = stx.positions[topicId];
  if (prev && prev.answer !== answerId) {
    const flips = prev.flips + 1;
    stx.positions[topicId] = { answer: answerId, week: d.week, times: prev.times + 1, flips };
    const total = Object.values(stx.positions).reduce((t, p) => t + p.flips, 0);
    const engaged = stx.engagements?.[topicId] !== undefined;
    const summary = applyEffects(d, [st('credibility', -(3 + 2 * flips + Math.min(4, total - 1) + (engaged ? 4 : 0))), { kind: 'momentum', delta: -4 }], {}, rng);
    const before = topic.answers.find(a => a.id === prev.answer)?.label ?? '';
    const now = topic.answers.find(a => a.id === answerId)?.label ?? '';
    pushNews(d, 'actu', 'negative', engaged ? `Engagement renié sur ${topic.label.toLowerCase()}` : `Volte-face sur ${topic.label.toLowerCase()}`,
      `Hier « ${before} », aujourd’hui « ${now} ». ${engaged ? 'C’était pourtant une promesse de programme.' : total >= 3 ? 'Les éditorialistes parlent de girouette.' : 'L’opposition ironise.'}`);
    if (engaged) delete stx.engagements![topicId];
    return { flip: true, before, when: prev.week, summary };
  }
  if (prev) {
    stx.positions[topicId] = { ...prev, week: d.week, times: prev.times + 1 };
    return { flip: false, summary: applyEffects(d, [st('credibility', 1)], {}, rng) };
  }
  stx.positions[topicId] = { answer: answerId, week: d.week, times: 1, flips: 0 };
  return { flip: false, summary: [] };
}

/** La relance : elle dépend de ce que vous venez de répondre */
function relance(d: GameState, s: QcmSeries, topic: PositionTopic, answerId: string, flip: { flip: boolean; before?: string; when?: number }, rng: Rng): void {
  const a = topic.answers.find(x => x.id === answerId)!;
  if (s.kind === 'echange' && !flip.flip) { relanceEchange(d, s, topic, a.lean, rng); return; }
  const party = Math.sign(d.party.position);
  if (flip.flip) {
    ask(d, s, `Attendez. En ${monthLabel(flip.when ?? d.week)}, vous disiez : « ${flip.before} ». Aujourd’hui : « ${a.label} ». Qu’est-ce qui a changé ?`, [
      opt('evolue', 'J’ai évolué, et je l’assume', [st('credibility', 2)], 'Rattrape une partie du revirement'),
      opt('malcompris', 'On m’avait mal compris·e à l’époque', [], 'Risqué : la citation existe peut-être'),
      opt('contexte', 'Le contexte n’est plus le même', [st('politicalCapital', -2)]),
    ], 'relance', { topic: topic.id, relance: 'flip' });
    return;
  }
  if (party && a.lean && Math.sign(a.lean) === -party && Math.abs(a.lean) >= 1) {
    ask(d, s, `Votre parti défend exactement l’inverse. Vous assumez d’être en désaccord avec les vôtres ?`, [
      opt('assume', 'Oui, j’assume ma liberté de parole', [st('credibility', 2), { kind: 'cohesion', delta: -3 }]),
      opt('rentre', 'Je me rangerai à la ligne du parti', [st('credibility', -2), { kind: 'cohesion', delta: 2 }], 'C’est un demi-revirement'),
      opt('debat', 'Le débat interne tranchera', [st('politicalCapital', -3)]),
    ], 'relance', { topic: topic.id, relance: 'parti' });
    return;
  }
  if (Math.abs(a.lean) >= 2) {
    ask(d, s, 'Une position très tranchée. Électoralement, ce n’est pas un peu risqué ?', [
      opt('clarte', 'Je préfère la clarté aux calculs', [st('credibility', 1), { kind: 'momentum', delta: 2 }]),
      opt('nuance', 'Je nuancerai dans le programme', [st('credibility', -1)]),
      opt('suivre', 'Les Français me suivront, vous verrez', [], 'Pari : popularité en jeu'),
    ], 'relance', { topic: topic.id, relance: 'tranche' });
    return;
  }
  if (a.lean === 0 && topic.answers.some(x => x.lean !== 0)) {
    ask(d, s, 'N’est-ce pas une façon élégante d’éviter la question ? Si vous deviez trancher, ce serait quoi ?', [
      opt('methode', 'C’est une question de méthode, pas d’esquive', d.player.stats.credibility >= 50 ? [st('credibility', 1)] : [st('credibility', -1)], 'Passe mieux avec une bonne crédibilité'),
      opt('trancher', 'D’accord, je tranche', [], 'Vous devrez choisir un camp'),
      opt('refus', 'Je n’ai pas à choisir à la place des Français', [st('credibility', -2), { kind: 'segment', segment: '*', delta: 1 }]),
    ], 'relance', { topic: topic.id, relance: 'esquive' });
    return;
  }
  ask(d, s, 'Concrètement : vous l’inscririez dans votre programme ?', [
    opt('engage', 'Oui, c’est un engagement', [st('credibility', 2)], 'Changer d’avis plus tard coûtera double'),
    opt('piste', 'C’est une piste, pas une promesse', []),
    opt('surprise', 'Je vous réserve la surprise', [st('credibility', -1), { kind: 'momentum', delta: 2 }]),
  ], 'relance', { topic: topic.id, relance: 'engagement' });
}

function nextStep(d: GameState, s: QcmSeries, rng: Rng): void {
  s.nextWeek = d.week + (rng.chance(0.6) ? 1 : 2);
}

function onRelance(d: GameState, s: QcmSeries, m: PhoneMessage, replyId: string, rng: Rng): void {
  const q = m.qcm!;
  const topic = POSITION_BY_ID.get(q.topic ?? '');
  const say = (text: string, effects: Effect[] = []) => post(d, s, text, { read: true, ...(effects.length ? { summary: applyEffects(d, effects, {}, rng) } : {}) });
  switch (q.relance) {
    case 'flip':
      if (replyId === 'malcompris') {
        const fail = clamp(0.55 + mods(d).risk - (d.player.stats.credibility - 50) / 250, 0.2, 0.85);
        if (rng.chance(fail)) {
          say('J’ai retrouvé l’enregistrement. Vous aviez été très clair·e. Je le publierai avec le portrait.', [st('credibility', -4)]);
          s.flips += 1;
        } else say('Bon… l’enregistrement est ambigu, je vous l’accorde.', [st('credibility', 1)]);
      } else say(replyId === 'evolue' ? 'Au moins, c’est honnête. Je le noterai.' : 'Le contexte… C’est toujours le contexte.');
      break;
    case 'parti':
      if (replyId === 'assume') s.dissidences += 1;
      say(replyId === 'assume' ? 'Voilà qui va faire parler au bureau politique.' : replyId === 'rentre' ? 'Donc votre avis personnel compte moins que la ligne. C’est noté.' : 'Le débat interne… On en reparlera.');
      break;
    case 'tranche':
      if (replyId === 'suivre') {
        const ok = rng.chance(clamp(0.35 + d.player.stats.popularity / 200, 0.2, 0.8));
        say(ok ? 'Notre sondage flash vous donne raison : une majorité vous suit.' : 'Notre sondage flash dit l’inverse. Ça risque de piquer.', [st('popularity', ok ? 2 : -3)]);
      } else say(replyId === 'clarte' ? 'La clarté, c’est rare. Je le garde pour le titre.' : 'Nuancer… Nos lecteurs jugeront.');
      break;
    case 'esquive':
      if (replyId === 'trancher' && topic) {
        const sides = [...topic.answers.filter(a => a.lean < 0).slice(0, 1), ...topic.answers.filter(a => a.lean > 0).slice(0, 1)];
        ask(d, s, 'Alors, entre les deux ?', sides.map((a, i) => opt(a.id, `${LETTERS[i]}. ${a.label}`, [...a.effects, { kind: 'stance', delta: a.lean * 1.5 } as Effect])), 'relance', { topic: topic.id, relance: 'choix' });
        return;
      }
      if (replyId === 'refus') s.evasions += 1;
      say(replyId === 'methode' ? 'Une méthode, soit. Je l’écrirai ainsi.' : 'Je noterai que vous n’avez pas souhaité trancher.');
      break;
    case 'choix': {
      if (topic) {
        // Vous tranchez la réponse prudente donnée à l'instant : ce n'est pas un revirement
        const stx = dlgState(d);
        const cur = stx.positions[topic.id];
        const r = cur && cur.week === d.week ? (stx.positions[topic.id] = { ...cur, answer: replyId }, { flip: false }) : recordPosition(d, topic.id, replyId, rng);
        const last = s.answers.at(-1);
        const lean = topic.answers.find(a => a.id === replyId)?.lean ?? 0;
        if (last && last.topic === topic.id) { last.answer = replyId; last.lean = lean; }
        if (r.flip) s.flips += 1;
      }
      say('Merci d’avoir tranché. C’est plus clair.', [st('credibility', 1)]);
      break;
    }
    case 'e_agree':
      if (replyId === 'promettre' && topic) {
        s.promised = (s.promised ?? 0) + 1;
        (dlgState(d).engagements ??= {})[topic.id] = d.week;
        say('C’est une promesse, alors. Je m’en souviendrai.', [st('credibility', 1)]);
      } else if (replyId === 'nuancer') { bumpAgree(s, -0.1); say('Avec des nuances… d’accord.'); }
      else say('Discrétion, compris. Ça reste entre nous.');
      break;
    case 'e_disagree':
      if (replyId === 'revoir' && topic && s.ideal !== undefined) {
        const best = [...topic.answers].sort((x, y) => Math.abs(x.lean - s.ideal!) - Math.abs(y.lean - s.ideal!))[0];
        const stx = dlgState(d);
        const cur = stx.positions[topic.id];
        if (cur && cur.week === d.week) stx.positions[topic.id] = { ...cur, answer: best.id };
        const last = s.answers.at(-1);
        if (last && last.topic === topic.id) { last.answer = best.id; last.lean = best.lean; }
        s.agree![s.agree!.length - 1] = agreement(best.lean, s.ideal);
        say(`Donc vous vous rangez à « ${best.label} ». Je préfère ça.`, [st('credibility', -1)]);
      } else if (replyId === 'expliquer') {
        const ok = rng.chance(clamp(0.3 + (d.player.stats.influence + d.player.stats.credibility - 100) / 250, 0.15, 0.75));
        if (ok) bumpAgree(s, 0.3);
        say(ok ? 'Vous m’avez presque convaincu·e. Je vous accorde que l’argument se tient.' : 'Non, vraiment, vous ne me convainquez pas.', ok ? [st('influence', 1)] : []);
      } else say('Au moins, vous êtes constant·e. Je le respecte.', [st('credibility', 1)]);
      break;
    case 'engagement':
      if (replyId === 'engage' && topic) {
        s.engagements.push(topic.id);
        const stx = dlgState(d);
        (stx.engagements ??= {})[topic.id] = d.week;
      }
      say(replyId === 'engage' ? 'C’est noté. Je vous le rappellerai, croyez-moi.' : replyId === 'piste' ? 'Une piste. D’accord.' : 'J’adore les surprises. Mes lecteurs moins.');
      break;
  }
  if (s.step >= s.total) s.nextWeek = d.week + 1;
  else nextStep(d, s, rng);
}

/* ── Le portrait ──────────────────────────────────────────── */

function publishPortrait(d: GameState, s: QcmSeries, rng: Rng): void {
  if (s.kind === 'echange') finishEchange(d, s, rng);
  else publishInterview(d, s, rng);
}

function publishInterview(d: GameState, s: QcmSeries, rng: Rng): void {
  const leans = s.answers.map(a => a.lean);
  const n = Math.max(1, leans.length);
  const mean = leans.reduce((t, x) => t + x, 0) / n;
  const meanAbs = leans.reduce((t, x) => t + Math.abs(x), 0) / n;
  const sd = Math.sqrt(leans.reduce((t, x) => t + (x - mean) ** 2, 0) / n);
  let verdict: string, tone: 'good' | 'bad' | 'mixed', effects: Effect[], comment: string;
  if (s.evasions >= 3 || (s.answers.length < 2 && s.evasions >= 2)) {
    verdict = 'La chaise vide'; tone = 'bad'; effects = [st('credibility', -4), st('popularity', -2)];
    comment = 'Questions esquivées, messages restés sans réponse : le portrait se dessine en creux.';
  } else if (s.flips >= 2) {
    verdict = 'La girouette'; tone = 'bad'; effects = [st('credibility', -6), { kind: 'momentum', delta: -6 }];
    comment = 'Deux revirements en quelques mois : on ne sait plus très bien ce que pense l’intéressé·e.';
  } else if (sd > 1.3) {
    verdict = 'L’insaisissable'; tone = 'bad'; effects = [st('credibility', -3)];
    comment = 'Très à gauche un mois, très à droite le suivant : une cohérence difficile à suivre.';
  } else if (s.engagements.length >= 2 && s.flips === 0) {
    verdict = 'Un cap'; tone = 'good'; effects = [st('credibility', 5), st('influence', 2)];
    comment = `${s.engagements.length} engagements de programme, aucun revirement : une ligne claire.`;
  } else if (s.dissidences >= 2) {
    verdict = 'Le franc-tireur'; tone = 'mixed'; effects = [st('credibility', 3), { kind: 'cohesion', delta: -4 }];
    comment = 'Souvent en désaccord avec son propre camp, et fier de l’être.';
  } else if (meanAbs >= 1.3) {
    verdict = 'Sans concession'; tone = 'mixed'; effects = [st('credibility', 2), st('popularity', 1), { kind: 'segment', segment: mean < 0 ? 'cadres' : 'jeunes', delta: -2 }];
    comment = 'Des réponses tranchées, toujours du même côté. On aime ou on déteste.';
  } else if (meanAbs <= 0.4) {
    verdict = 'L’équilibriste'; tone = 'mixed'; effects = [st('credibility', 1), { kind: 'segment', segment: '*', delta: 1 }];
    comment = 'Toujours au centre, souvent prudent·e : rassurant pour les uns, tiède pour les autres.';
  } else {
    verdict = 'Le pragmatique'; tone = 'good'; effects = [st('credibility', 3)];
    comment = 'Des positions mesurées, cohérentes d’un mois sur l’autre.';
  }
  const j = JOURNALISTS.find(x => x.name === s.journalist);
  const k = (tone === 'bad' ? (j?.style === 'dur' ? 1.3 : 1) * (s.relecture ? 0.5 : 1) : (j?.style === 'courtois' ? 1.2 : 1));
  effects = effects.map(x => x.kind === 'stat' ? { ...x, delta: Math.round(x.delta * k) } : x);
  const quotes = s.answers.slice(0, 2).map(a => { const t = POSITION_BY_ID.get(a.topic); return t ? `sur ${t.label.toLowerCase()}, « ${t.answers.find(x => x.id === a.answer)?.label ?? ''} »` : ''; }).filter(Boolean).join(' ; ');
  const summary = applyEffects(d, effects, { reason: `Portrait dans ${s.outlet}` }, rng);
  post(d, s, `Le portrait paraît demain : « ${verdict} ». ${quotes ? `Vous y dites, ${quotes}. ` : ''}${comment}${s.relecture ? ' (Relu par vos soins, comme convenu.)' : ''}`, {
    summary,
    replies: [
      opt('merci', 'Merci pour cette série', [st('stress', -1)]),
      opt('contester', 'Je conteste ce portrait', [], 'Risqué : droit de réponse ou nouvelle polémique'),
      opt('partager', 'Je le partage sur mes réseaux', [st('popularity', tone === 'bad' ? -1 : 1)]),
    ],
    qcm: { kind: 'portrait', sid: s.sid },
  });
  pushNews(d, 'actu', tone === 'bad' ? 'negative' : tone === 'good' ? 'positive' : 'neutral', `${s.outlet} : « ${verdict} »`, `Le portrait au long cours « ${s.title} » paraît. ${comment}`);
  const stx = dlgState(d);
  (stx.history ??= []).push({ sid: s.sid, kind: 'interview', title: s.title, outlet: s.outlet, verdict, tone, week: d.week });
  stx.series = null;
  stx.nextSeries = d.week + 3 + Math.floor(rng.next() * 3);
}

/* ── Les discussions de fond avec un contact ───────────── */

const agreement = (lean: number, ideal: number) => clamp(1 - Math.abs(lean - ideal) / 4, 0, 1);
function bumpAgree(s: QcmSeries, delta: number): void {
  if (!s.agree?.length) return;
  s.agree[s.agree.length - 1] = clamp(s.agree[s.agree.length - 1] + delta, 0, 1);
}

function ctxOf(d: GameState, s: QcmSeries): SeriesCtx {
  return { d, npcId: s.npcId, contactId: s.contactId, recruitId: s.recruitId, name: s.journalist };
}

/** Une discussion de fond avec un contact du répertoire (il la propose, ou vous l'appelez pour la lancer) */
export function startEchange(d: GameState, entry: PhoneEntry, rng: Rng, byPlayer: boolean): boolean {
  const stx = dlgState(d);
  if (stx.series) return false;
  const archId = archetypeFor(entry.kind, entry.key, d);
  const arch = archId ? ARCHETYPES[archId] : null;
  if (!arch) return false;
  const k = entry.key;
  const npcId = k.startsWith('perso:') ? k.slice(6) : k.startsWith('collegue:') ? k.slice(9) : k === 'chef' ? d.party.leaderNpcId ?? undefined : undefined;
  const s: QcmSeries = {
    sid: `ec-${d.week}-${k}`, kind: 'echange', journalist: entry.name, outlet: entry.role, title: arch.title.replace('{nom}', entry.name), who: k,
    accepted: byPlayer, step: 0, total: arch.questions, nextWeek: d.week, since: d.week,
    answers: [], engagements: [], flips: 0, evasions: 0, joker: false, dissidences: 0, right: 0, wrong: 0, streak: 0, rivals: [],
    archetype: arch.id, agree: [], promised: 0, byPlayer,
    ...(npcId && npcId !== 'player' ? { npcId } : {}),
    ...(k.startsWith('contact:') ? { contactId: k.slice(8) } : {}),
    ...(k.startsWith('equipe:') ? { recruitId: k.slice(7) } : {}),
  };
  s.ideal = arch.ideal(ctxOf(d, s));
  stx.series = s;
  d.player.flags[`serie_${k}`] = d.week;
  const intro = arch.intro.replace('{nom}', entry.name).replace('{moi}', d.player.name);
  if (byPlayer) {
    post(d, s, `Une discussion de fond ? Volontiers. ${s.total} questions, une par mois, et je vous dirai à la fin ce que j’en retiens.`, { read: true });
    askMain(d, s, rng);
  } else {
    ask(d, s, intro, [
      opt('oui', 'Avec plaisir, je vous écoute', [], `${s.total} questions sur plusieurs mois ; le bilan pèsera sur votre relation`),
      opt('non', 'Une autre fois', []),
    ], 'intro');
  }
  return true;
}

function relanceEchange(d: GameState, s: QcmSeries, topic: PositionTopic, lean: number, rng: Rng): void {
  const arch = ARCHETYPES[s.archetype!];
  const a = agreement(lean, s.ideal ?? 0);
  s.agree!.push(a);
  if (a >= 0.75) {
    ask(d, s, arch.agree, [
      opt('promettre', 'Oui, je m’y engage', [], 'Une promesse : la renier plus tard coûtera double'),
      opt('discret', 'Je préfère rester discret·e là-dessus'),
      opt('nuancer', 'Oui, mais avec des nuances'),
    ], 'relance', { topic: topic.id, relance: 'e_agree' });
  } else if (a <= 0.45) {
    ask(d, s, arch.disagree, [
      opt('tenir', 'Je maintiens, par conviction'),
      opt('revoir', 'Vous avez peut-être raison, je révise', [], 'Vous vous rangez à son avis'),
      opt('expliquer', 'Laissez-moi vous convaincre', [], 'Il faut de l’influence et de la crédibilité'),
    ], 'relance', { topic: topic.id, relance: 'e_disagree' });
  } else {
    post(d, s, rng.chance(0.5) ? 'Je vois. Ce n’est pas tout à fait ce que j’espérais, mais je comprends.' : 'Hum. Une réponse de compromis. Je note.', { read: true });
    if (s.step >= s.total) s.nextWeek = d.week + 1; else nextStep(d, s, rng);
  }
}

function finishEchange(d: GameState, s: QcmSeries, rng: Rng): void {
  const arch: SeriesArchetype = ARCHETYPES[s.archetype!];
  const ag = s.agree ?? [];
  const score = (ag.length ? ag.reduce((t, x) => t + x, 0) / ag.length : 0.3) + (s.promised ?? 0) * 0.05 - s.flips * 0.15 - s.evasions * 0.1;
  const tone: 'good' | 'mixed' | 'bad' = score >= 0.68 ? 'good' : score >= 0.45 ? 'mixed' : 'bad';
  const v = arch[tone];
  const summary = applyEffects(d, v.effects(ctxOf(d, s)), { reason: s.title }, rng);
  post(d, s, `${s.flips ? 'Vous avez changé d’avis devant moi, ça m’a marqué. ' : ''}${v.text}`, {
    summary,
    replies: [opt('merci', 'Merci pour ces échanges'), opt('reprendre', 'On recommencera', [st('stress', -1)])],
    qcm: { kind: 'portrait', sid: s.sid },
  });
  const stx = dlgState(d);
  const verdict = tone === 'good' ? 'Accord' : tone === 'mixed' ? 'Respect mutuel' : 'Désaccord';
  (stx.history ??= []).push({ sid: s.sid, kind: 'echange', title: s.title, outlet: s.journalist, verdict, tone, week: d.week });
  d.player.flags[`mem_serie_${s.archetype}_${tone}`] = Number(d.player.flags[`mem_serie_${s.archetype}_${tone}`] ?? 0) + 1;
  stx.series = null;
  stx.nextSeries = d.week + 2 + Math.floor(rng.next() * 3);
}

/** Peut-on proposer une discussion de fond à ce contact ? */
export function echangeBlock(d: GameState, e: PhoneEntry): string | null {
  if (!archetypeFor(e.kind, e.key, d)) return 'Pas de discussion de fond possible';
  const stx = d.phone?.dlg;
  if (stx?.series) return stx.series.who === e.key ? 'Discussion déjà en cours' : `Une série est déjà en cours (${stx.series.journalist})`;
  const last = Number(d.player.flags[`serie_${e.key}`] ?? -99);
  if (d.week - last < 12) return 'Vous avez déjà eu cette discussion cette année';
  return null;
}

/* ── Le quiz ──────────────────────────────────────────────── */

function askQuiz(d: GameState, s: QcmSeries, rng: Rng): void {
  const stx = dlgState(d);
  const pool = QUIZ_QUESTIONS.filter(q => !stx.colles.asked.includes(q.q));
  const q = rng.pick(pool.length ? pool : QUIZ_QUESTIONS);
  stx.colles.asked.push(q.q);
  if (stx.colles.asked.length > 80) stx.colles.asked.splice(0, stx.colles.asked.length - 80);
  const order = [0, 1, 2, 3].sort(() => rng.next() - 0.5);
  const replies: PhoneReply[] = order.map((k, i) => opt(`r${k}`, `${LETTERS[i]}. ${q.a[k]}`));
  const lead = s.step === 0 ? 'On est à l’antenne dans une minute. Première colle' : s.step === s.total - 1 ? 'Dernière colle de la saison, tout se joue maintenant' : `Colle n° ${s.step + 1}`;
  ask(d, s, `${lead} : ${q.q}`, replies, 'colle', { correct: 'r0', topic: q.q });
  s.step += 1;
}

function standings(s: QcmSeries, d: GameState): string {
  const rows = [{ name: 'vous', score: s.right }, ...s.rivals].sort((a, b) => b.score - a.score);
  void d;
  return rows.map(r => `${r.name} ${r.score}`).join(' · ');
}

function onQuizAnswer(d: GameState, s: QcmSeries, m: PhoneMessage, replyId: string, rng: Rng): void {
  const q = m.qcm!;
  const right = replyId === q.correct;
  const good = m.replies?.find(r => r.id === q.correct)?.label.replace(/^[A-E]\. /, '') ?? '';
  const stx = dlgState(d);
  // Les adversaires répondent aussi
  for (const r of s.rivals) {
    const npc = d.npcs.find(n => n.name === r.name);
    if (rng.chance(clamp(0.45 + (npc?.influence ?? 50) / 300, 0.4, 0.8))) r.score += 1;
  }
  let effects: Effect[];
  let text: string;
  if (right) {
    s.right += 1; s.streak += 1; stx.colles.right += 1;
    effects = [st('credibility', 1)];
    text = `Bonne réponse ! ${s.streak >= 3 ? `${s.streak} d’affilée, le standard explose. ` : ''}Classement : ${standings(s, d)}.`;
    if (s.streak === 3) effects.push(st('popularity', 2));
  } else {
    s.wrong += 1; s.streak = 0; stx.colles.wrong += 1;
    effects = [st('credibility', -2)];
    text = `Raté… c’était « ${good} ». Classement : ${standings(s, d)}.`;
  }
  post(d, s, text, { read: true, summary: applyEffects(d, effects, {}, rng) });
  if (!right && rng.chance(0.5)) {
    ask(d, s, 'Petit souci : l’extrait de votre erreur tourne déjà sur les réseaux. Vous réagissez ?', [
      opt('rire', 'J’en ris avec tout le monde', [st('popularity', 1)]),
      opt('contester', 'La question était mal posée', [], 'Risqué'),
      opt('silence', 'Je ne commente pas', [{ kind: 'momentum', delta: -2 }]),
    ], 'relance', { relance: 'buzz' });
    return;
  }
  if (s.step >= s.total) finishQuiz(d, s, rng);
  else s.nextWeek = d.week + 1;
}

function finishQuiz(d: GameState, s: QcmSeries, rng: Rng): void {
  const rows = [{ name: 'vous', score: s.right }, ...s.rivals].sort((a, b) => b.score - a.score || (a.name === 'vous' ? -1 : 1));
  const rank = rows.findIndex(r => r.name === 'vous') + 1;
  let verdict: string, tone: 'good' | 'bad' | 'mixed', effects: Effect[];
  if (rank === 1) { verdict = s.right === s.total ? 'Incollable' : 'Vainqueur de la saison'; tone = 'good'; effects = [st('credibility', s.right === s.total ? 5 : 3), st('popularity', 2)]; }
  else if (rank === rows.length) { verdict = 'Bonnet d’âne'; tone = 'bad'; effects = [st('credibility', -3), st('popularity', -1)]; }
  else { verdict = `${rank}e place`; tone = 'mixed'; effects = [st('credibility', 1)]; }
  const summary = applyEffects(d, effects, { reason: QUIZ_HOST.title }, rng);
  post(d, s, `Fin de saison ! Classement final : ${standings(s, d)}. ${rank === 1 ? 'Vous remportez « ' + QUIZ_HOST.title + ' » !' : rank === rows.length ? 'Dernière place… on vous offre le bonnet d’âne de la saison.' : 'Une place honorable.'} À la saison prochaine ?`, {
    summary,
    replies: [opt('oui', 'Avec plaisir !', [st('stress', -1)]), opt('non', 'On verra…', [])],
    qcm: { kind: 'portrait', sid: s.sid },
  });
  pushNews(d, 'actu', tone === 'bad' ? 'negative' : tone === 'good' ? 'positive' : 'neutral', `${QUIZ_HOST.title} : ${verdict}`, `${s.right} bonnes réponses sur ${s.total}. Classement : ${standings(s, d)}.`);
  const stx = dlgState(d);
  (stx.history ??= []).push({ sid: s.sid, kind: 'quiz', title: s.title, outlet: s.outlet, verdict, tone, week: d.week });
  stx.series = null;
  stx.nextSeries = d.week + 2 + Math.floor(rng.next() * 3);
}

/* ── Les réponses ─────────────────────────────────────────── */

export function onQcmAnswer(d: GameState, m: PhoneMessage, replyId: string, rng: Rng): void {
  const stx = dlgState(d);
  const q = m.qcm!;
  const s = stx.series;
  if (!q.sid) { legacyAnswer(d, m, replyId, rng); return; }
  if (q.kind === 'portrait') {
    if (replyId === 'contester') {
      const ok = rng.chance(clamp(0.4 + (d.player.stats.influence - 50) / 200, 0.15, 0.75));
      addMessage(d, { kind: 'sms', who: m.who, from: m.from, role: m.role, read: true,
        text: ok ? 'Votre droit de réponse paraîtra la semaine prochaine.' : 'Contester un portrait… c’est en général le meilleur moyen d’en faire parler. Bonne chance.',
        summary: applyEffects(d, [st('credibility', ok ? 2 : -3)], {}, rng) });
    }
    return;
  }
  if (!s || s.sid !== q.sid) return;
  if (q.kind === 'intro') {
    if (replyId === 'non' && s.kind === 'echange') {
      post(d, s, 'Une autre fois, alors.', { read: true });
      stx.series = null;
      stx.nextSeries = d.week + 2;
      return;
    }
    if (replyId === 'non') {
      post(d, s, s.kind === 'quiz' ? 'Dommage ! Nous jouerons sans vous.' : 'Dommage. Nous écrirons le portrait quand même, avec une chaise vide.', { read: true });
      if (s.kind === 'interview') pushNews(d, 'actu', 'negative', `${s.outlet} : la chaise vide`, `${d.player.name} a refusé de répondre à notre série « ${s.title} ».`);
      (stx.history ??= []).push({ sid: s.sid, kind: s.kind, title: s.title, outlet: s.outlet, verdict: 'Refus', tone: 'bad', week: d.week });
      stx.series = null;
      stx.nextSeries = d.week + 4;
      return;
    }
    s.accepted = true;
    s.relecture = replyId === 'relecture';
    post(d, s, s.kind === 'quiz' ? 'Parfait ! On attaque tout de suite.' : s.kind === 'echange' ? 'Merci. Je commence.' : s.relecture ? 'Relecture… Soit. On commence.' : 'Parfait. On commence tout de suite.', { read: true });
    if (s.kind === 'quiz') askQuiz(d, s, rng); else askMain(d, s, rng);
    return;
  }
  if (q.kind === 'colle') { onQuizAnswer(d, s, m, replyId, rng); return; }
  if (q.kind === 'relance' && q.relance === 'buzz') {
    if (replyId === 'contester') {
      const ok = rng.chance(0.3);
      post(d, s, ok ? 'Bon… vous avez raison, la question était ambiguë. On rectifie à l’antenne.' : 'La question était juste. Vos contradicteurs s’en donnent à cœur joie.', { read: true, summary: applyEffects(d, [st('credibility', ok ? 2 : -2)], {}, rng) });
    } else post(d, s, replyId === 'rire' ? 'Les auditeurs adorent votre autodérision.' : 'Le silence… ça passera.', { read: true });
    if (s.step >= s.total) finishQuiz(d, s, rng); else s.nextWeek = d.week + 1;
    return;
  }
  if (q.kind === 'relance') { onRelance(d, s, m, replyId, rng); return; }
  if (q.kind === 'position') {
    const topic = POSITION_BY_ID.get(q.topic ?? '');
    if (!topic) return;
    if (replyId === 'joker') {
      s.joker = true; s.evasions += 1;
      post(d, s, `Noté. « ${d.player.name} n’a pas souhaité répondre. » Je vous préviens : ça se voit dans un portrait.`, { read: true, summary: applyEffects(d, [st('credibility', -1)], {}, rng) });
      if (s.step >= s.total) s.nextWeek = d.week + 1; else nextStep(d, s, rng);
      return;
    }
    const r = recordPosition(d, topic.id, replyId, rng);
    if (r.flip) s.flips += 1;
    s.answers.push({ topic: topic.id, answer: replyId, lean: topic.answers.find(a => a.id === replyId)?.lean ?? 0, week: d.week });
    if (r.summary.length) m.summary = [...(m.summary ?? []), ...r.summary];
    relance(d, s, topic, replyId, r, rng);
  }
}

/** Les anciennes questions isolées (parties d'avant les séries) */
function legacyAnswer(d: GameState, m: PhoneMessage, replyId: string, rng: Rng): void {
  const q = m.qcm!;
  if (q.kind === 'colle') {
    const right = replyId === q.correct;
    addMessage(d, { kind: 'sms', who: m.who, from: m.from, role: m.role, read: true, text: right ? 'Bonne réponse !' : 'Raté…', summary: applyEffects(d, [st('credibility', right ? 1 : -1)], {}, rng) });
    return;
  }
  if (q.kind === 'position' && q.topic && POSITION_BY_ID.has(q.topic)) {
    const r = recordPosition(d, q.topic, replyId, rng);
    addMessage(d, { kind: 'sms', who: m.who, from: m.from, role: m.role, read: true, text: r.flip ? 'Tiens, ce n’est pas ce que vous disiez avant…' : 'Merci, c’est noté.', summary: r.summary });
  }
}

/* ── Chaque mois ──────────────────────────────────────────── */

export function monthlyQcm(d: GameState, rng: Rng): void {
  const stx = dlgState(d);
  const s = stx.series;
  if (s) {
    // Une question laissée sans réponse : esquive notée, la série continue (ou s'arrête)
    const open = (d.phone?.messages ?? []).find(m => m.qcm?.sid === s.sid && m.replies?.length && !m.answered);
    if (open && d.week - open.week >= 2) {
      open.answered = 'Sans réponse';
      if (!s.accepted) { stx.series = null; stx.nextSeries = d.week + 3; return; }
      s.evasions += 1;
      post(d, s, s.kind === 'quiz' ? 'Pas de réponse… on compte la question comme ratée.' : s.kind === 'echange' ? 'Vous ne répondez plus ? Je prends note de votre silence.' : 'Toujours pas de réponse. Je l’écrirai : « n’a pas répondu ».');
      if (s.kind === 'quiz') { s.wrong += 1; s.streak = 0; }
      if (s.kind !== 'quiz' && s.evasions >= 3) { publishPortrait(d, s, rng); return; }
      s.nextWeek = d.week;
    } else if (open) return;
    if (!s.accepted || d.week < s.nextWeek) return;
    if (s.kind === 'quiz') { if (s.step >= s.total) finishQuiz(d, s, rng); else askQuiz(d, s, rng); }
    else if (s.step >= s.total) publishPortrait(d, s, rng);
    else askMain(d, s, rng);
    return;
  }
  if (d.week < (stx.nextSeries ?? 2)) return;
  if (!rng.chance(orderOf(d) >= 1 ? 0.5 : 0.35)) return;
  // Un contact du répertoire propose une discussion de fond (une fois sur deux), sinon la presse
  if (rng.chance(0.5)) {
    const pool = directoryOf(d).filter(e => !echangeBlock(d, e));
    if (pool.length && startEchange(d, rng.pick(pool), rng, false)) return;
  }
  const lastKind = [...(stx.history ?? [])].reverse().find(h => h.kind !== 'echange')?.kind;
  const interview = lastKind === 'interview' ? rng.chance(0.4) : lastKind === 'quiz' ? true : rng.chance(0.65);
  if (interview) startInterview(d, rng); else startQuiz(d, rng);
}

/* ── Pour le téléphone ────────────────────────────────────── */

export function positionsList(d: GameState): { topic: string; answer: string; times: number; flips: number; week: number; engaged: boolean }[] {
  const stx = d.phone?.dlg;
  if (!stx) return [];
  return Object.entries(stx.positions).map(([id, p]) => {
    const t = POSITION_BY_ID.get(id);
    return { topic: t?.label ?? id, answer: t?.answers.find(a => a.id === p.answer)?.label ?? p.answer, times: p.times, flips: p.flips, week: p.week, engaged: stx.engagements?.[id] !== undefined };
  }).sort((a, b) => b.week - a.week);
}

export function seriesInfo(d: GameState): { current: { title: string; outlet: string; journalist: string; step: number; total: number; kind: string; score?: string } | null; history: NonNullable<ReturnType<typeof dlgState>['history']> } {
  const stx = d.phone?.dlg;
  const s = stx?.series;
  return {
    current: s ? { title: s.title, outlet: s.outlet, journalist: s.journalist, step: s.step, total: s.total, kind: s.kind, ...(s.kind === 'quiz' ? { score: `${s.right} / ${s.step}` } : {}) } : null,
    history: [...(stx?.history ?? [])].reverse().slice(0, 8),
  };
}


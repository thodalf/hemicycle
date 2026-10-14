import { PostResult, postWithReach } from './social';
import { Effect, GameState, NewsItem } from '../models/game.models';
import { addMilestone } from './life';
import { applyEffects, pushNews } from './effects';
import { family } from './family';
import { CallOption, PhoneEntry, addMessage, entryOf } from './phone';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Le téléphone, en plus des appels : SMS rapides, réactions,
 *  réseaux sociaux… et les histoires de cœur, avec n'importe
 *  quelle personne de votre répertoire.
 * ============================================================ */

// ── SMS rapides ──────────────────────────────────────────────

export interface QuickSms { id: 'merci' | 'bravo' | 'excuse' | 'dejeuner' | 'meme'; label: string; text: string }

export const QUICK_SMS: QuickSms[] = [
  { id: 'merci', label: '🙏 Remercier', text: 'Merci pour tout, sincèrement.' },
  { id: 'bravo', label: '👏 Féliciter', text: 'Bravo pour cette semaine, c’était remarquable.' },
  { id: 'excuse', label: '😔 S’excuser', text: 'Je te dois des excuses pour l’autre jour.' },
  { id: 'dejeuner', label: '🍽️ Proposer un déjeuner', text: 'On déjeune ensemble la semaine prochaine ?' },
  { id: 'meme', label: '😂 Envoyer un mème', text: '[Un mème sur le dernier débat à l’Assemblée]' },
];

const ANSWERS: Record<QuickSms['id'], string[]> = {
  merci: ['C’est moi qui te remercie.', 'Ça me touche, merci.', 'Avec plaisir, toujours.'],
  bravo: ['Merci ! Venant de toi, ça compte.', 'On a bien travaillé, oui.', 'Trop gentil·le 😊'],
  excuse: ['C’est oublié.', 'Merci de le dire. On tourne la page.', 'Il était temps…'],
  dejeuner: ['Avec plaisir, mardi ?', 'Je regarde mon agenda et je te dis.', 'Volontiers. Tu invites ?'],
  meme: ['😂😂😂', 'Je l’ai déjà vu passer trois fois, mais il est bon.', 'Tu devrais faire attention à ce que tu envoies…'],
};

export function smsReady(d: GameState, key: string): boolean {
  return (d.phone?.sms?.[key] ?? -99) !== d.week;
}

/** Un effet léger, selon la personne */
function warmth(d: GameState, e: PhoneEntry, key: string, delta: number): Effect[] {
  const id = key.split(':')[1];
  switch (e.kind) {
    case 'equipe': return [{ kind: 'team', recruitId: id, morale: delta * 2 }];
    case 'chef': return d.party.leaderNpcId !== 'player' ? [{ kind: 'npcRelation', npcId: d.party.leaderNpcId, delta }] : [];
    case 'collegue': case 'personnalite': return [{ kind: 'npcRelation', npcId: id, delta }];
    case 'contact': return [{ kind: 'contact', contactId: id, trust: delta }];
    case 'gouvernement': return [{ kind: 'stat', stat: 'influence', delta: delta / 4 }];
    default: return [{ kind: 'stat', stat: 'stress', delta: -delta / 2 }];
  }
}

export function sendQuickSms(d: GameState, key: string, smsId: QuickSms['id'], rng: Rng): string[] {
  const e = entryOf(d, key);
  const sms = QUICK_SMS.find(x => x.id === smsId);
  if (!e || !sms || !smsReady(d, key)) return [];
  d.phone!.sms ??= {};
  d.phone!.sms[key] = d.week;
  addMessage(d, { kind: 'sms', who: key, from: e.name, role: e.role, text: sms.text, outgoing: true, read: true });
  const effects: Effect[] = [];
  let answer = rng.pick(ANSWERS[smsId]);
  if (smsId === 'meme' && rng.chance(0.15) && e.kind !== 'proche' && e.kind !== 'equipe') {
    answer = 'Capture d’écran faite. Ça va tourner…';
    effects.push({ kind: 'exposure', delta: 3 }, { kind: 'stat', stat: 'credibility', delta: -1 });
  } else {
    effects.push(...warmth(d, e, key, smsId === 'dejeuner' ? 4 : smsId === 'excuse' ? 3 : 2));
    if (smsId === 'dejeuner') effects.push({ kind: 'stat', stat: 'energy', delta: -3 });
  }
  const summary = applyEffects(d, effects, {}, rng);
  addMessage(d, { kind: 'sms', who: key, from: e.name, role: e.role, text: answer, read: true, summary });
  return summary;
}

// ── Réactions ────────────────────────────────────────────────

export const REACTIONS = ['❤️', '👍', '😂', '😮'];

export function react(d: GameState, msgId: string, emoji: string, rng: Rng): void {
  const m = d.phone?.messages.find(x => x.id === msgId);
  if (!m || m.outgoing || m.reaction) return;
  m.reaction = emoji;
  const e = entryOf(d, m.who);
  if (e) applyEffects(d, warmth(d, e, m.who, 1), {}, rng);
}

// ── Réseaux sociaux ──────────────────────────────────────────

export interface SocialPost { id: string; author: string; handle: string; text: string; tone: NewsItem['tone']; week: number; likes: number }

const HANDLES: Record<string, [string, string]> = {
  actu: ['Le Fil Info', '@lefilinfo'], rival: ['Politique Insider', '@polinsider'], scandale: ['Le Canard Numérique', '@canardnum'],
  election: ['Sondages & Urnes', '@urnes'], parti: ['Militants en ligne', '@militants'], reseau: ['Coulisses', '@coulisses'],
};

/** Le fil : l'actualité récente, vue par les réseaux */
export function socialFeed(d: GameState): SocialPost[] {
  return d.news.filter(n => d.week - n.week <= 1 && HANDLES[n.kind]).slice(0, 10).map(n => {
    const [author, handle] = HANDLES[n.kind];
    let h = 0; for (const ch of n.id) h = (h * 31 + ch.charCodeAt(0)) % 9973;
    return { id: n.id, author, handle, text: n.title + (n.body ? ` — ${n.body}` : ''), tone: n.tone, week: n.week, likes: 120 + (h % 4800) };
  });
}

function social(d: GameState) {
  const ph = d.phone!;
  if (!ph.social || ph.social.week !== d.week) ph.social = { week: d.week, posts: 0, reacted: [] };
  return ph.social;
}

export const SOCIAL_MAX = 3;

export function socialLeft(d: GameState): number {
  const s = d.phone?.social;
  return SOCIAL_MAX - (s && s.week === d.week ? s.posts : 0);
}

/** Commenter un post : une petite phrase qui peut faire mouche… ou un bad buzz */
export function commentPost(d: GameState, postId: string, tone: 'soutien' | 'pique' | 'humour', rng: Rng): string[] {
  const s = social(d);
  if (s.posts >= SOCIAL_MAX || s.reacted.includes(postId)) return [];
  s.posts += 1;
  s.reacted.push(postId);
  const effects: Effect[] = tone === 'soutien' ? [{ kind: 'stat', stat: 'credibility', delta: 1 }]
    : tone === 'pique' ? [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'stat', stat: 'influence', delta: 1 }]
    : [{ kind: 'stat', stat: 'popularity', delta: 2 }];
  const risk = tone === 'pique' ? 0.25 : tone === 'humour' ? 0.15 : 0.03;
  if (rng.chance(d.player.staff.includes('community_manager') ? risk / 2 : risk)) {
    const out = applyEffects(d, [{ kind: 'stat', stat: 'popularity', delta: -3 }, { kind: 'exposure', delta: 2 }], {}, rng);
    pushNews(d, 'actu', 'negative', 'Bad buzz', 'Votre commentaire est sorti de son contexte. Des milliers de réponses outrées.');
    return ['Bad buzz', ...out];
  }
  return applyEffects(d, effects, {}, rng);
}

/** Publier un post personnel (ou surfer sur une tendance) : audience, likes, buzz */
export function publishPost(d: GameState, kind: 'terrain' | 'coulisses' | 'vie' | 'tendance', rng: Rng, tagIndex = 0): PostResult | null {
  const s = social(d);
  if (s.posts >= SOCIAL_MAX) return null;
  s.posts += 1;
  return postWithReach(d, kind, rng, tagIndex);
}

// ── Histoires de cœur ────────────────────────────────────────

const cleanName = (name: string) => name.replace(/\s*\(.*\)\s*$/, '');

/** Avec qui peut-on avoir une histoire ? Toute personne, pas les organisations ni la famille */
export function canDate(d: GameState, e: PhoneEntry): boolean {
  if (e.kind === 'proche') return false;
  // Votre conjoint·e est déjà… votre conjoint·e
  if (d.family?.partner && cleanName(e.name) === d.family.partner.name) return false;
  if (e.kind === 'contact') {
    const c = d.contacts.find(x => `contact:${x.id}` === e.key);
    return c?.type === 'journaliste';
  }
  return true;
}


export function romanceOptions(d: GameState, e: PhoneEntry, block?: string): CallOption[] {
  if (!canDate(d, e)) return [];
  const r = d.romance;
  const partnerTaken = !!d.family?.partner;
  if (r && r.key !== e.key) return [];
  if (r && r.stage >= 3) {
    return [{ id: 'rompre', label: '💔 Mettre fin à votre histoire', hint: r.secret ? 'Une liaison qui s’arrête avant d’être découverte.' : 'Rompre.', ok: !block, reason: block }];
  }
  const stage = r?.stage ?? 0;
  const label = stage === 0 ? '🌹 Proposer un dîner en tête-à-tête'
    : stage === 1 ? '🍷 Un deuxième rendez-vous'
    : partnerTaken ? '🤫 Entamer une liaison secrète' : '💞 Proposer de vous installer ensemble';
  const hint = stage === 0 ? 'Un dîner discret, loin des caméras. Personne n’est obligé de dire oui.'
    : stage === 1 ? 'Le premier dîner s’est bien passé. On remet ça ?'
    : partnerTaken ? 'Vous êtes déjà en couple : la presse adorerait savoir.' : 'Officialiser votre histoire.';
  const opts: CallOption[] = [{ id: 'seduire', label, hint: e.kind === 'equipe' ? `${hint} Une histoire avec un·e collaborateur·rice fera jaser.` : hint, ok: !block, reason: block }];
  if (r) opts.push({ id: 'rompre', label: '💔 En rester là', hint: 'Mieux vaut arrêter avant que ça devienne compliqué.', ok: !block, reason: block });
  return opts;
}

/** Un rendez-vous (par téléphone : on propose, on se voit dans la semaine) */
export function dateCall(d: GameState, e: PhoneEntry, optionId: 'seduire' | 'rompre', rng: Rng): { answer: string; effects: Effect[]; note?: string } {
  const p = d.player;
  const fam = family(d);
  const r = d.romance;
  if (optionId === 'rompre') {
    d.romance = null;
    return { answer: r?.secret ? 'Je comprends. Personne ne saura. Prends soin de toi.' : 'D’accord. C’était bien, quand même.', effects: [{ kind: 'stat', stat: 'stress', delta: 3 }, ...warmthNpc(e, -6)] };
  }
  const stage = r?.stage ?? 0;
  const bond = e.bond ?? 20;
  const chance = clamp(0.4 + bond / 160 + p.stats.popularity / 400 - stage * 0.05, 0.1, 0.9);
  if (!rng.chance(chance)) {
    if (r && stage > 0 && rng.chance(0.4)) d.romance = null;
    return { answer: rng.pick(['Je préfère qu’on reste dans le professionnel.', 'C’est flatteur… mais non.', 'Pas en ce moment, ma vie est compliquée.']), effects: [{ kind: 'stat', stat: 'stress', delta: 3 }, ...warmthNpc(e, -3)] };
  }
  const base: Effect[] = [{ kind: 'stat', stat: 'stress', delta: -4 }, { kind: 'stat', stat: 'energy', delta: -4 }, { kind: 'funds', account: 'personal', delta: -150 }, ...warmthNpc(e, 6)];
  if (stage === 0) {
    d.romance = { key: e.key, name: cleanName(e.name), stage: 1, since: d.week };
    return { answer: 'Avec plaisir. Je connais une petite adresse où personne ne nous reconnaîtra.', effects: base, note: `Premier dîner avec ${cleanName(e.name)}` };
  }
  if (stage === 1) {
    d.romance = { ...r!, stage: 2 };
    return { answer: 'J’espérais que tu rappelles. Samedi ?', effects: base, note: 'Deuxième rendez-vous' };
  }
  // Troisième étape : en couple… ou liaison
  if (fam.partner) {
    d.romance = { ...r!, stage: 3, secret: true };
    return { answer: 'Personne ne doit savoir. Promis ?', effects: [...base, { kind: 'exposure', delta: 4 }], note: 'Liaison secrète' };
  }
  d.romance = null;
  fam.partner = { name: cleanName(e.name), alive: true, since: d.week };
  addMilestone(d, 'carriere', `En couple avec ${cleanName(e.name)}`, 'Vous officialisez votre histoire. Les magazines people en font leur couverture.');
  const effects: Effect[] = [...base, { kind: 'stat', stat: 'popularity', delta: 2 }];
  if (e.kind === 'equipe' || e.kind === 'gouvernement' || e.kind === 'personnalite') effects.push({ kind: 'exposure', delta: 4 });
  return { answer: 'Oui. Mille fois oui.', effects, note: `En couple avec ${cleanName(e.name)}` };
}

function warmthNpc(e: PhoneEntry, delta: number): Effect[] {
  const id = e.key.split(':')[1];
  if (e.kind === 'collegue' || e.kind === 'personnalite') return [{ kind: 'npcRelation', npcId: id, delta }];
  if (e.kind === 'equipe') return [{ kind: 'team', recruitId: id, morale: delta }];
  return [];
}

/** Chaque mois : une liaison secrète finit par se savoir */
export function monthlyRomance(d: GameState, rng: Rng): void {
  const r = d.romance;
  if (!r) return;
  if (r.stage >= 3 && r.secret) {
    d.player.scandalExposure = clamp(d.player.scandalExposure + 1.5);
    if (rng.chance(0.07)) {
      d.romance = null;
      const fam = family(d);
      const partner = fam.partner?.name;
      fam.partner = null;
      fam.divorces += 1;
      d.player.stats.popularity = clamp(d.player.stats.popularity - 5);
      d.player.stats.stress = clamp(d.player.stats.stress + 15);
      d.player.scandalExposure = clamp(d.player.scandalExposure + 15);
      addMilestone(d, 'revers', 'Liaison révélée', `Des photos volées avec ${r.name} font la une.${partner ? ` ${partner} vous quitte.` : ''}`);
      pushNews(d, 'scandale', 'negative', 'Votre liaison à la une', `Photos volées, sortie d’hôtel au petit matin avec ${r.name}.`);
    }
  } else if (d.week - r.since > 8) {
    // Une histoire qu'on laisse en plan s'éteint
    d.romance = null;
  }
}

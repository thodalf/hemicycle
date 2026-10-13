import { ContactType, Effect, GameState, PhoneMessage, PhoneReply, PhoneState, StaffRole } from '../models/game.models';
import { STAFF_BY_ROLE, STAFF_ICONS } from '../data/staff';
import { applyEffects, campaignOpen, partySupport } from './effects';
import { voteRole } from './assembly';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Le téléphone : SMS et appels de l'équipe, du chef ou de la
 *  cheffe du parti, des collègues, du réseau et des proches.
 *  On y répond, et l'on passe ses propres coups de fil :
 *  prendre des nouvelles, demander du soutien pour un texte,
 *  demander de l'argent. Quatre appels par mois, ensuite la
 *  fatigue se fait sentir.
 * ============================================================ */

export const CALLS_PER_MONTH = 4;
export const EXTRA_CALL_ENERGY = 4;
const MAX_MESSAGES = 60;

export type CallerKind = 'equipe' | 'chef' | 'collegue' | 'contact' | 'proche';

export interface PhoneEntry {
  key: string;
  kind: CallerKind;
  name: string;
  role: string;
  icon: string;
  /** Confiance ou relation (−100 … 100), pour l'affichage */
  bond?: number;
}

export interface CallOption {
  id: 'soutien' | 'argent' | 'nouvelles' | 'point';
  label: string;
  hint: string;
  ok: boolean;
  reason?: string;
}

const CONTACT_LABEL: Record<ContactType, string> = {
  lobby: 'Lobby', industriel: 'Industriel', syndicat: 'Syndicat', journaliste: 'Journaliste', association: 'Association',
};
const CONTACT_ICON: Record<ContactType, string> = {
  lobby: '💼', industriel: '🏭', syndicat: '✊', journaliste: '📰', association: '🤝',
};

export function initPhone(d: GameState): PhoneState {
  return { messages: [], callsUsed: 0, callsWeek: d.week, called: {} };
}

function phone(d: GameState): PhoneState {
  d.phone ??= initPhone(d);
  if (d.phone.callsWeek !== d.week) { d.phone.callsUsed = 0; d.phone.callsWeek = d.week; }
  return d.phone;
}

export function unreadCount(d: GameState): number {
  return (d.phone?.messages ?? []).filter(m => !m.outgoing && !m.read).length;
}

/** Le chef ou la cheffe du parti, quand ce n'est pas vous */
function leader(d: GameState) {
  return d.party.leaderNpcId !== 'player' ? d.npcs.find(n => n.id === d.party.leaderNpcId) : undefined;
}

/** Le répertoire : qui l'on peut appeler */
export function directory(d: GameState): PhoneEntry[] {
  const out: PhoneEntry[] = [];
  for (const r of d.player.team) {
    out.push({ key: `equipe:${r.id}`, kind: 'equipe', name: r.name, role: STAFF_BY_ROLE.get(r.role)?.title ?? r.role, icon: STAFF_ICONS[r.role] ?? '👤' });
  }
  const chief = leader(d);
  if (chief) out.push({ key: 'chef', kind: 'chef', name: chief.name, role: `Chef·fe ${d.party.name.startsWith('Union') || d.party.name.startsWith('Alliance') ? 'de l’' + d.party.name : 'du parti'}`, icon: '🎗️', bond: Math.round(chief.relationToPlayer) });
  const colleagues = d.npcs
    .filter(n => n.partyId === d.party.id && n.id !== d.party.leaderNpcId && n.relationToPlayer >= 0)
    .sort((a, b) => b.relationToPlayer - a.relationToPlayer)
    .slice(0, 4);
  for (const n of colleagues) out.push({ key: `collegue:${n.id}`, kind: 'collegue', name: n.name, role: 'Collègue du parti', icon: '🧑‍💼', bond: Math.round(n.relationToPlayer) });
  for (const c of d.contacts) out.push({ key: `contact:${c.id}`, kind: 'contact', name: c.name, role: CONTACT_LABEL[c.type], icon: CONTACT_ICON[c.type], bond: Math.round(c.trust) });
  out.push({ key: 'proche', kind: 'proche', name: 'Maman', role: 'Famille', icon: '❤️' });
  return out;
}

export function entryOf(d: GameState, key: string): PhoneEntry | undefined {
  return directory(d).find(e => e.key === key);
}

/** Un texte est-il en jeu (en débat, ou à venir) ? */
function supportTarget(d: GameState): 'vote' | 'promesse' | null {
  if (d.vote?.status === 'debat') return 'vote';
  return voteRole(d) ? 'promesse' : null;
}

export function callStatus(d: GameState): { used: number; free: number; extraCost: number } {
  const ph = d.phone;
  const used = ph && ph.callsWeek === d.week ? ph.callsUsed : 0;
  return { used, free: Math.max(0, CALLS_PER_MONTH - used), extraCost: used >= CALLS_PER_MONTH ? EXTRA_CALL_ENERGY : 0 };
}

export function callOptions(d: GameState, key: string): CallOption[] {
  const e = entryOf(d, key);
  if (!e) return [];
  const already = (d.phone?.called[key] ?? -99) === d.week;
  const busy = already ? 'Déjà appelé·e ce mois-ci' : undefined;
  const st = callStatus(d);
  const tired = st.extraCost && d.player.stats.energy < st.extraCost + 5 ? 'Trop fatigué·e pour un appel de plus' : undefined;
  const block = busy ?? tired;
  const target = supportTarget(d);
  const opts: CallOption[] = [];
  const supportLabel = d.vote?.status === 'debat' ? `Demander du soutien : « ${d.vote.title} »` : 'Demander du soutien pour votre prochain texte';
  const supportReason = !target ? 'Aucun texte en jeu : il faut siéger à l’Assemblée ou au gouvernement' : undefined;
  switch (e.kind) {
    case 'equipe':
      opts.push({ id: 'point', label: 'Faire le point', hint: 'Un conseil, un coup de main, des nouvelles du terrain.', ok: !block, reason: block });
      break;
    case 'chef': {
      const camp = campaignOpen(d);
      const lastMoney = Number(d.player.flags['phoneMoneyChef'] ?? -99);
      opts.push({ id: 'soutien', label: supportLabel, hint: 'Une consigne de vote du parti : des dizaines de voix si la relation est bonne.', ok: !block && !!target, reason: block ?? supportReason });
      opts.push({ id: 'argent', label: 'Demander une aide financière du parti', hint: 'Une avance sur le compte de campagne, selon votre soutien interne.',
        ok: !block && camp && d.week - lastMoney >= 6, reason: block ?? (!camp ? 'Seulement pendant une campagne' : d.week - lastMoney < 6 ? 'Le trésorier vous a déjà dépanné·e récemment' : undefined) });
      opts.push({ id: 'nouvelles', label: 'Prendre des nouvelles', hint: 'Entretenir la relation.', ok: !block, reason: block });
      break;
    }
    case 'collegue':
      opts.push({ id: 'soutien', label: supportLabel, hint: 'Sa voix, et celles de quelques proches.', ok: !block && !!target, reason: block ?? supportReason });
      opts.push({ id: 'nouvelles', label: 'Prendre des nouvelles', hint: 'Un café, des confidences.', ok: !block, reason: block });
      break;
    case 'contact': {
      const c = d.contacts.find(x => `contact:${x.id}` === key)!;
      const money = c.type === 'lobby' || c.type === 'industriel';
      opts.push({ id: 'soutien', label: supportLabel, hint: c.type === 'journaliste' ? 'Un papier favorable : l’opinion pèse sur les députés.' : money ? 'Ils ont l’oreille de nombreux députés… et des attentes.' : 'Une mobilisation qui fait pression sur les élus.', ok: !block && !!target, reason: block ?? supportReason });
      const lastAsk = Number(d.player.flags[`phoneMoney_${c.id}`] ?? -99);
      const tooSoon = d.week - lastAsk < 6 ? 'Vous les avez déjà sollicités il y a peu' : undefined;
      if (money) opts.push({ id: 'argent', label: 'Demander de l’argent', hint: 'En campagne : un dîner de donateurs. Hors campagne : des « honoraires de conseil »… exposés.', ok: !block && !tooSoon, reason: block ?? tooSoon });
      opts.push({ id: 'nouvelles', label: 'Entretenir la relation', hint: 'La confiance se cultive.', ok: !block, reason: block });
      break;
    }
    case 'proche': {
      const lastMoney = Number(d.player.flags['phoneMoneyFamily'] ?? -99);
      opts.push({ id: 'nouvelles', label: 'Prendre des nouvelles', hint: 'Une demi-heure loin de la politique.', ok: !block, reason: block });
      opts.push({ id: 'argent', label: 'Demander un coup de main financier', hint: 'Une fois par an, et ça coûte un peu d’amour-propre.', ok: !block && d.week - lastMoney >= 12, reason: block ?? (d.week - lastMoney < 12 ? 'Vous avez déjà demandé cette année' : undefined) });
      break;
    }
  }
  return opts;
}

function addMessage(d: GameState, m: Omit<PhoneMessage, 'id' | 'week'>): PhoneMessage {
  const ph = phone(d);
  const msg: PhoneMessage = { id: nextId(d, 'tel'), week: d.week, ...m };
  ph.messages.unshift(msg);
  if (ph.messages.length > MAX_MESSAGES) ph.messages.length = MAX_MESSAGES;
  return msg;
}

/** Ajoute des voix au texte en débat, ou les met de côté pour votre prochain texte */
function rally(d: GameState, votes: number): string {
  if (d.vote?.status === 'debat') {
    const dir = d.vote.partyLine === 'contre' ? -1 : 1;
    d.vote.swing += votes * dir;
    return `${votes} voix ${dir > 0 ? 'pour' : 'contre'} le texte`;
  }
  d.player.flags['billSupport'] = Math.min(40, Number(d.player.flags['billSupport'] ?? 0) + votes);
  return `${votes} voix promises pour votre prochain texte`;
}

/** Passer un appel */
export function placeCall(d: GameState, key: string, optionId: CallOption['id'], rng: Rng): string[] {
  const opt = callOptions(d, key).find(o => o.id === optionId);
  const e = entryOf(d, key);
  if (!opt?.ok || !e) return [];
  const ph = phone(d);
  const extra = callStatus(d).extraCost;
  ph.callsUsed += 1;
  ph.called[key] = d.week;
  const p = d.player;
  const effects: Effect[] = extra ? [{ kind: 'stat', stat: 'energy', delta: -extra }] : [];
  let answer = '';
  let note: string | undefined;
  const ask = optionId === 'soutien' ? (d.vote?.status === 'debat' ? `Je peux compter sur ton soutien pour « ${d.vote.title} » ?` : 'Je prépare un texte : je peux compter sur ton soutien ?') : optionId === 'argent' ? 'J’aurais besoin d’un coup de main financier…' : optionId === 'point' ? 'On fait le point ?' : 'Je prenais des nouvelles.';
  addMessage(d, { kind: 'appel', who: key, from: e.name, role: e.role, text: `📞 ${ask}`, outgoing: true, read: true });

  if (e.kind === 'equipe') {
    const r = p.team.find(x => `equipe:${x.id}` === key)!;
    const tip = TEAM_TIPS[r.role] ?? TEAM_TIPS.conseiller!;
    answer = tip.text;
    effects.push(...tip.effects);
  } else if (e.kind === 'chef') {
    const chief = leader(d)!;
    const rel = chief.relationToPlayer;
    const sup = partySupport(d);
    if (optionId === 'soutien') {
      if (rng.chance(clamp(0.35 + rel / 120 + sup / 300, 0.1, 0.95))) {
        note = rally(d, Math.round(8 + sup / 10));
        answer = 'C’est entendu, je passe la consigne au groupe. Tu me revaudras ça.';
        effects.push({ kind: 'stat', stat: 'politicalCapital', delta: -5 }, { kind: 'npcRelation', npcId: chief.id, delta: -2 });
      } else {
        answer = 'Pas cette fois. Le groupe est divisé, je ne vais pas me griller pour toi.';
        effects.push({ kind: 'npcRelation', npcId: chief.id, delta: -1 });
      }
    } else if (optionId === 'argent') {
      p.flags['phoneMoneyChef'] = d.week;
      if (rng.chance(clamp(0.3 + rel / 100 + sup / 200, 0.1, 0.95))) {
        const amount = Math.round((3000 + sup * 150) / 500) * 500;
        effects.push({ kind: 'funds', account: 'campaign', delta: amount }, { kind: 'stat', stat: 'politicalCapital', delta: -8 });
        if (d.partyFinance) d.partyFinance.treasury -= amount / 1000;
        answer = `Le trésorier fait un virement de ${amount.toLocaleString('fr-FR')} € sur ton compte de campagne. Ne me déçois pas.`;
      } else {
        answer = 'Les caisses sont vides, et tu n’es pas le seul à demander.';
        effects.push({ kind: 'npcRelation', npcId: chief.id, delta: -2 });
      }
    } else {
      answer = rng.pick(['Content de t’entendre. On déjeune la semaine prochaine ?', 'Ça tient. Il paraît que tu fais du bon travail.', 'Tu tombes bien, j’avais un mot à te dire sur les investitures…']);
      effects.push({ kind: 'npcRelation', npcId: chief.id, delta: 4 });
    }
  } else if (e.kind === 'collegue') {
    const n = d.npcs.find(x => `collegue:${x.id}` === key)!;
    if (optionId === 'soutien') {
      if (rng.chance(clamp(0.45 + n.relationToPlayer / 100, 0.15, 0.95))) {
        note = rally(d, 3 + Math.round(n.influence / 25));
        answer = 'Tu as ma voix. Je vais en parler à deux ou trois collègues.';
        effects.push({ kind: 'npcRelation', npcId: n.id, delta: -1 });
      } else answer = 'Désolé, j’ai pris des engagements ailleurs.';
    } else {
      answer = rng.pick(['On se voit à la buvette de l’Assemblée ?', 'Tu as vu le dernier sondage ? Tout le monde en parle.', 'Merci d’appeler, ça fait plaisir.']);
      effects.push({ kind: 'npcRelation', npcId: n.id, delta: 4 });
    }
  } else if (e.kind === 'contact') {
    const c = d.contacts.find(x => `contact:${x.id}` === key)!;
    const money = c.type === 'lobby' || c.type === 'industriel';
    if (optionId === 'soutien') {
      if (rng.chance(clamp(0.3 + c.trust / 100 + c.balance * 0.1, 0.1, 0.95))) {
        const votes = c.type === 'journaliste' ? 3 : money ? 7 : 5;
        note = rally(d, votes);
        answer = c.type === 'journaliste' ? 'Je fais un papier demain matin. Les députés lisent ma chronique.'
          : money ? 'Nos amis au Parlement seront sensibles à vos arguments. Nous nous en souviendrons, n’est-ce pas ?'
          : 'On mobilise nos adhérents : les permanences des députés vont recevoir du courrier.';
        effects.push({ kind: 'contact', contactId: c.id, balance: -1 }, ...(money ? [{ kind: 'exposure', delta: 2 } as Effect] : []));
      } else {
        answer = 'Pas sur ce texte-là. Nous avons nos propres priorités.';
      }
    } else if (optionId === 'argent') {
      p.flags[`phoneMoney_${c.id}`] = d.week;
      if (campaignOpen(d)) {
        if (rng.chance(clamp(0.35 + c.trust / 100, 0.1, 0.9))) {
          const amount = Math.round((2000 + c.power * 60) / 500) * 500;
          effects.push({ kind: 'funds', account: 'campaign', delta: amount }, { kind: 'contact', contactId: c.id, balance: -1 }, { kind: 'exposure', delta: 1 });
          answer = `Une entreprise ne peut pas financer une campagne, vous le savez. Mais j’organise un dîner : nos cadres donneront à titre personnel. Comptez ${amount.toLocaleString('fr-FR')} €.`;
        } else answer = 'Vous plaisantez ? Avec la Commission des comptes de campagne sur le dos ?';
      } else {
        if (rng.chance(clamp(0.3 + c.trust / 100, 0.1, 0.9))) {
          const amount = Math.round((3000 + c.power * 50) / 500) * 500;
          effects.push({ kind: 'funds', account: 'personal', delta: amount }, { kind: 'exposure', delta: 6 }, { kind: 'contact', contactId: c.id, balance: -2 }, { kind: 'stat', stat: 'credibility', delta: -1 });
          answer = `Nous avons justement besoin d’une « mission de conseil ». ${amount.toLocaleString('fr-FR')} € d’honoraires. Rien d’écrit sur l’objet, évidemment.`;
        } else answer = 'Je n’ai rien entendu. Et vous ne m’avez jamais appelé.';
      }
    } else {
      answer = rng.pick(['Toujours un plaisir. Nous suivons votre travail avec attention.', 'Merci de votre appel, nous en avions besoin en ce moment.', 'On se voit au prochain salon ?']);
      effects.push({ kind: 'contact', contactId: c.id, trust: 4 });
    }
  } else {
    if (optionId === 'argent') {
      p.flags['phoneMoneyFamily'] = d.week;
      const amount = 1500 + Math.round(rng.range(0, 3)) * 500;
      effects.push({ kind: 'funds', account: 'personal', delta: amount }, { kind: 'stat', stat: 'stress', delta: 2 });
      answer = `Bien sûr, mon grand… Je te fais un virement de ${amount.toLocaleString('fr-FR')} €. Tu manges bien, au moins ?`;
    } else {
      answer = rng.pick(['Tu as l’air fatigué·e. Tu passes dimanche ? Il y aura un gigot.', 'Ta tante t’a vu·e à la télé. Elle trouve que tu as maigri.', 'On est fiers de toi, tu sais. Même ton père, à sa façon.']);
      effects.push({ kind: 'stat', stat: 'stress', delta: -5 }, { kind: 'stat', stat: 'energy', delta: 3 });
    }
  }
  const summary = applyEffects(d, effects, {}, rng);
  if (note) summary.unshift(note);
  addMessage(d, { kind: 'appel', who: key, from: e.name, role: e.role, text: answer, read: true, summary });
  return summary;
}

/** Répondre à un SMS */
export function answerMessage(d: GameState, msgId: string, replyId: string, rng: Rng): string[] {
  const m = d.phone?.messages.find(x => x.id === msgId);
  const r = m?.replies?.find(x => x.id === replyId);
  if (!m || !r || m.answered) return [];
  m.answered = r.label;
  m.read = true;
  addMessage(d, { kind: 'sms', who: m.who, from: m.from, role: m.role, text: r.label, outgoing: true, read: true });
  const summary = applyEffects(d, r.effects, {}, rng);
  if (r.answer) addMessage(d, { kind: 'sms', who: m.who, from: m.from, role: m.role, text: r.answer, read: true, summary });
  else if (summary.length) m.summary = summary;
  return summary;
}

export function markRead(d: GameState, who: string): void {
  for (const m of d.phone?.messages ?? []) if (m.who === who) m.read = true;
}

/* ── Messages entrants ─────────────────────────────────────── */

interface Incoming { text: string; replies?: PhoneReply[]; kind?: 'sms' | 'appel' }

const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
const rep = (id: string, label: string, effects: Effect[], answer?: string): PhoneReply => ({ id, label, effects, ...(answer ? { answer } : {}) });

export const TEAM_TIPS: Partial<Record<StaffRole, { text: string; effects: Effect[] }>> = {
  conseiller: { text: 'J’ai relu vos fiches : deux chiffres à corriger avant votre prochaine interview.', effects: [st('credibility', 1)] },
  community_manager: { text: 'Votre dernière vidéo cartonne chez les 18-25 ans. J’en prépare une autre ?', effects: [st('popularity', 1)] },
  chauffeur: { text: 'La voiture est prête. Et j’ai trouvé un raccourci : vous gagnerez une heure demain.', effects: [st('energy', 4)] },
  coach: { text: 'Respirez par le ventre, regardez la caméra, phrases courtes. On répète ce soir ?', effects: [st('credibility', 1), st('stress', -1)] },
  plume: { text: 'J’ai une formule pour votre discours de jeudi. Elle va faire mouche.', effects: [st('influence', 1)] },
  tresorier: { text: 'Les comptes sont propres. Évitez juste les notes de restaurant ce mois-ci.', effects: [{ kind: 'exposure', delta: -1 }] },
  attache_presse: { text: 'Trois journalistes veulent un portrait. J’en garde un, le plus sérieux.', effects: [st('popularity', 1), st('influence', 1)] },
  sondeur: { text: 'Les chiffres bougent dans le bon sens chez les retraités. On creuse ?', effects: [{ kind: 'momentum', delta: 2 }] },
  assistant_parlementaire: { text: 'J’ai préparé vos amendements et une note sur le texte de la semaine.', effects: [st('credibility', 1), st('stress', -1)] },
  directeur_campagne: { text: 'Le planning des déplacements est bouclé. On attaque le porte-à-porte samedi.', effects: [{ kind: 'momentum', delta: 3 }] },
  spin_doctor: { text: 'L’affaire de la semaine ? Je l’ai étouffée. On n’en parlera plus.', effects: [{ kind: 'exposure', delta: -2 }] },
  juriste: { text: 'J’ai relu le contrat de la mairie : il y avait un piège. Corrigé.', effects: [{ kind: 'exposure', delta: -2 }] },
  garde_du_corps: { text: 'Itinéraire sécurisé pour demain. Rien à signaler, restez prudent·e.', effects: [{ kind: 'flagAdd', key: 'menace', delta: -3 }] },
  chef_cabinet: { text: 'Votre agenda est rationalisé : trois réunions inutiles supprimées.', effects: [st('energy', 5), st('stress', -2)] },
  sherpa: { text: 'Mon homologue allemand est d’accord sur l’essentiel. Le sommet sera un succès.', effects: [{ kind: 'intl', prestige: 1 }] },
};

const TEAM_SMS: Partial<Record<StaffRole, Incoming[]>> = {
  attache_presse: [
    { text: 'Un journaliste du Parisien veut votre réaction sur la grève. Je dis quoi ?', replies: [
      rep('reagir', 'Je réagis, envoie-lui ma citation', [st('popularity', 1), { kind: 'exposure', delta: 1 }], 'Parfait, c’est envoyé. Vous serez en page 4.'),
      rep('decliner', 'Pas de commentaire', [st('credibility', 1)], 'Compris. Je botte en touche.')] },
  ],
  community_manager: [
    { text: 'Un tweet de vous de 2014 ressort. Rien de grave, mais ça tourne. On fait quoi ?', replies: [
      rep('humour', 'On assume avec humour', [st('popularity', 1)], 'Ça a pris ! 3 000 likes.'),
      rep('supprimer', 'Supprime-le', [st('credibility', -1)], 'Supprimé. Les captures, elles, circulent encore.')] },
  ],
  sondeur: [
    { text: 'Nouveau sondage confidentiel : vous gagnez 2 points chez les cadres, vous en perdez 3 chez les ouvriers.', replies: [
      rep('ok', 'Merci, on ajuste le discours', [{ kind: 'momentum', delta: 1 }])] },
  ],
  directeur_campagne: [
    { text: 'Il nous manque des bras pour le tractage de samedi. Vous pouvez passer ?', replies: [
      rep('oui', 'J’y serai', [st('popularity', 1), st('energy', -4), { kind: 'momentum', delta: 2 }], 'Génial, les militants vont être ravis.'),
      rep('non', 'Pas ce week-end', [st('stress', -1)], 'D’accord, je me débrouille.')] },
  ],
  assistant_parlementaire: [
    { text: 'Le rapporteur cherche des cosignataires pour un amendement sur votre dossier. Je signe pour vous ?', replies: [
      rep('signer', 'Oui, signe', [st('influence', 1), st('credibility', 1)]),
      rep('lire', 'Envoie-moi le texte d’abord', [st('stress', 1)], 'Envoyé. Il y a un article ambigu, en effet.')] },
  ],
  chef_cabinet: [
    { text: 'Le ministre des Finances veut vous voir avant l’arbitrage. 8 h demain ?', replies: [
      rep('oui', 'Confirme 8 h', [st('influence', 2), st('energy', -3)], 'C’est noté. Le café sera prêt.'),
      rep('decaler', 'Propose-lui midi', [st('stress', -1)], 'Il a accepté, un peu froissé.')] },
  ],
};

const GENERIC_TEAM: Incoming[] = [
  { text: 'Petit point : tout roule de mon côté. Besoin de quelque chose ce mois-ci ?', replies: [rep('merci', 'Merci, continue comme ça', [st('stress', -1)])] },
  { text: 'Je pose deux jours la semaine prochaine, c’est possible ?', replies: [
    rep('oui', 'Bien sûr, repose-toi', [st('stress', -1)], 'Merci, vraiment !'),
    rep('non', 'Pas maintenant, on a besoin de toi', [st('energy', 2)], 'D’accord… je reste.')] },
];

function chiefSms(d: GameState, rng: Rng): Incoming {
  const chief = leader(d)!;
  const vote = d.vote?.status === 'debat';
  if (vote && rng.chance(0.7)) {
    return { text: `Consigne du groupe sur « ${d.vote!.title} » : ${d.vote!.partyLine}. Je compte sur toi.`, replies: [
      rep('ok', 'Compte sur moi', [{ kind: 'faction', factionId: '*', delta: 2 }, { kind: 'npcRelation', npcId: chief.id, delta: 3 }], 'Merci. On se souviendra des fidèles.'),
      rep('libre', 'Je voterai selon ma conscience', [st('credibility', 1), { kind: 'npcRelation', npcId: chief.id, delta: -4 }], 'Tu as tort de jouer perso.')] };
  }
  return rng.pick<Incoming>([
    { text: 'Bureau politique mardi. J’aimerais que tu y défendes notre ligne sur l’économie.', replies: [
      rep('oui', 'J’y serai', [{ kind: 'faction', factionId: '*', delta: 1 }, st('energy', -3)], 'Parfait.'),
      rep('non', 'Je ne pourrai pas', [{ kind: 'npcRelation', npcId: chief.id, delta: -2 }], 'Dommage.')] },
    { text: 'On m’a dit que tu déjeunais avec des gens de l’autre camp. Je me trompe ?', replies: [
      rep('nier', 'Simple courtoisie républicaine', [{ kind: 'npcRelation', npcId: chief.id, delta: -1 }], 'Méfie-toi des courtoisies.'),
      rep('assumer', 'Je parle à tout le monde', [st('influence', 1), { kind: 'npcRelation', npcId: chief.id, delta: -3 }], 'On en reparlera.')] },
    { text: 'Bravo pour ton passage télé hier. Continue comme ça.', replies: [
      rep('merci', 'Merci, ça me touche', [{ kind: 'npcRelation', npcId: chief.id, delta: 2 }])] },
    { text: 'Il me faut des volontaires pour la tournée d’été. Tu en es ?', replies: [
      rep('oui', 'Avec plaisir', [{ kind: 'cohesion', delta: 2 }, st('energy', -4), { kind: 'npcRelation', npcId: chief.id, delta: 3 }], 'Je savais que je pouvais compter sur toi.'),
      rep('non', 'Mon agenda est plein', [{ kind: 'npcRelation', npcId: chief.id, delta: -2 }])] },
  ]);
}

function contactSms(d: GameState, rng: Rng): { who: string; from: string; role: string; msg: Incoming } | null {
  if (!d.contacts.length) return null;
  const c = rng.pick(d.contacts);
  const who = `contact:${c.id}`;
  const base = { who, from: c.name, role: CONTACT_LABEL[c.type] };
  switch (c.type) {
    case 'journaliste': return { ...base, msg: { text: 'Une réaction sur la polémique du jour ? Je boucle dans une heure.', replies: [
      rep('oui', 'Voici ma citation…', [st('popularity', 1), { kind: 'contact', contactId: c.id, trust: 3 }], 'Merci, vous serez en tête d’article.'),
      rep('off', 'En off seulement', [st('influence', 1), { kind: 'contact', contactId: c.id, trust: 2 }], 'Bien noté, « un proche du dossier ».'),
      rep('non', 'Pas aujourd’hui', [{ kind: 'contact', contactId: c.id, trust: -2 }])] } };
    case 'syndicat': return { ...base, msg: { text: 'La base gronde sur les salaires. Vous viendrez à notre assemblée générale ?', replies: [
      rep('oui', 'J’y serai', [{ kind: 'contact', contactId: c.id, trust: 5 }, st('energy', -4), { kind: 'dossier', domain: 'social', delta: 2 }], 'Merci, ça comptera.'),
      rep('non', 'Je vous enverrai un message de soutien', [{ kind: 'contact', contactId: c.id, trust: -1 }])] } };
    case 'association': return { ...base, msg: { text: 'Notre gala annuel a lieu le 12. Vous nous feriez l’honneur ?', replies: [
      rep('oui', 'Avec plaisir', [{ kind: 'contact', contactId: c.id, trust: 4 }, st('popularity', 1), st('energy', -3)], 'Formidable, nous vous gardons une place.'),
      rep('non', 'Je suis pris·e ce soir-là', [{ kind: 'contact', contactId: c.id, trust: -1 }])] } };
    default: return { ...base, msg: { text: 'Un déjeuner la semaine prochaine ? Nous avons un projet qui pourrait vous intéresser.', replies: [
      rep('oui', 'Volontiers', [{ kind: 'contact', contactId: c.id, trust: 4 }, st('influence', 1), { kind: 'exposure', delta: 1 }], 'Parfait, chez Drouant, 13 h.'),
      rep('prudence', 'Envoyez-moi plutôt une note', [st('credibility', 1)], 'Bien sûr, vous l’aurez demain.'),
      rep('non', 'Ce ne serait pas convenable', [st('credibility', 1), { kind: 'contact', contactId: c.id, trust: -3 }])] } };
  }
}

const FAMILY: Incoming[] = [
  { text: 'Tu as oublié l’anniversaire de ta sœur. Appelle-la. Bisous. Maman', replies: [
    rep('appeler', 'Je l’appelle ce soir', [st('stress', -2), st('energy', -1)], 'Elle était ravie. Tu vois, ce n’était pas compliqué.'),
    rep('plus_tard', 'Je suis débordé·e, ce week-end', [st('stress', 2)])] },
  { text: 'On t’a vu·e à la télé ! Ton père a enregistré l’émission.', replies: [rep('merci', '❤️', [st('stress', -2)])] },
  { text: 'Repas de famille dimanche. Tu viens, cette fois ?', replies: [
    rep('oui', 'J’y serai', [st('stress', -4), st('energy', 2)], 'Je fais ton gâteau préféré.'),
    rep('non', 'Pas ce dimanche, désolé·e', [st('stress', 1)], 'Comme d’habitude…')] },
];

/** Chaque mois : quelques SMS et appels manqués */
export function monthlyPhone(d: GameState, rng: Rng): void {
  phone(d);
  const n = 1 + (rng.chance(0.6) ? 1 : 0) + (rng.chance(0.3) ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const roll = rng.next();
    const team = d.player.team;
    if (roll < 0.35 && team.length) {
      const r = rng.pick(team);
      const pool = [...(TEAM_SMS[r.role] ?? []), ...GENERIC_TEAM];
      const msg = rng.pick(pool);
      addMessage(d, { kind: 'sms', who: `equipe:${r.id}`, from: r.name, role: STAFF_BY_ROLE.get(r.role)?.title ?? r.role, ...msg });
    } else if (roll < 0.6 && leader(d)) {
      const chief = leader(d)!;
      addMessage(d, { kind: 'sms', who: 'chef', from: chief.name, role: 'Chef·fe du parti', ...chiefSms(d, rng) });
    } else if (roll < 0.88) {
      const c = contactSms(d, rng);
      if (c) addMessage(d, { kind: rng.chance(0.25) ? 'appel' : 'sms', who: c.who, from: c.from, role: c.role, ...c.msg, text: c.msg.text });
    } else {
      addMessage(d, { kind: 'sms', who: 'proche', from: 'Maman', role: 'Famille', ...rng.pick(FAMILY) });
    }
  }
  // Les SMS laissés sans réponse trop longtemps refroidissent les relations
  for (const m of d.phone!.messages) {
    if (!m.outgoing && m.replies && !m.answered && d.week - m.week === 2) {
      m.answered = 'Sans réponse';
      if (m.who.startsWith('contact:')) applyEffects(d, [{ kind: 'contact', contactId: m.who.slice(8), trust: -1 }], {}, rng);
    }
  }
}

/** Premier jour : quelques messages pour faire connaissance */
export function welcomePhone(d: GameState): void {
  phone(d);
  addMessage(d, { kind: 'sms', who: 'proche', from: 'Maman', role: 'Famille', text: 'On est fiers de toi. Mange bien et dors un peu, la politique ce n’est pas une vie. Bisous.',
    replies: [rep('merci', 'Merci maman ❤️', [st('stress', -2)], 'Appelle-moi de temps en temps !')] });
  const chief = leader(d);
  if (chief) addMessage(d, { kind: 'sms', who: 'chef', from: chief.name, role: 'Chef·fe du parti', text: 'Bienvenue dans l’aventure. Ma porte est ouverte : un coup de fil suffit.',
    replies: [rep('merci', 'Merci, je compte sur vous', [{ kind: 'npcRelation', npcId: chief.id, delta: 2 }], 'Et moi sur toi.')] });
}

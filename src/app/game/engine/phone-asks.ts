import { Effect, GameState, NetworkContact as Contact, Npc } from '../models/game.models';
import type { CallOption, PhoneEntry } from './phone';
import { addMessage } from './phone';
import { SCHEMES, joinScheme, schemeToJoin, schemes } from './schemes';
import { campaignOpen, pushNews } from './effects';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Demandes au téléphone : rallier quelqu'un à un complot
 *  (qui avance ensuite chaque mois avec ce complice), demander
 *  de l'argent (prêt d'un·e collègue, don de campagne, coup de
 *  main du ou de la conjoint·e), demander une apparition
 *  publique de soutien. Et les dettes, qu'il faudra rembourser.
 * ============================================================ */

type Ask = { answer: string; effects: Effect[]; notes: string[] };

const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
const eur = (n: number) => `${n.toLocaleString('fr-FR')} €`;
const round500 = (n: number) => Math.max(500, Math.round(n / 500) * 500);

/** Mois entre deux apparitions publiques demandées à la même personne */
export const APPEAR_COOLDOWN = 6;
/** Plafond légal d'un don de personne physique à une campagne */
const DON_MAX = 4500;

export function npcOf(d: GameState, e: PhoneEntry): Npc | undefined {
  if (e.kind === 'chef') return d.npcs.find(n => n.id === d.party.leaderNpcId);
  const [kind, id] = e.key.split(':');
  return kind === 'collegue' || kind === 'perso' ? d.npcs.find(n => n.id === id) : undefined;
}

function contactOf(d: GameState, e: PhoneEntry): Contact | undefined {
  return e.key.startsWith('contact:') ? d.contacts.find(c => c.id === e.key.slice(8)) : undefined;
}

function flag(d: GameState, key: string): number {
  return Number(d.player.flags[key] ?? -99);
}

/** Dette envers une personnalité (0 si aucune) */
export function debtTo(d: GameState, npcId: string): number {
  return Math.max(0, Number(d.player.flags[`dette_${npcId}`] ?? 0));
}

export function askOptions(d: GameState, e: PhoneEntry, block?: string): CallOption[] {
  const out: CallOption[] = [];
  const n = npcOf(d, e);
  const c = contactOf(d, e);

  // ── Rallier à un complot ──
  const plotter = ['chef', 'collegue', 'personnalite', 'gouvernement'].includes(e.kind) || (!!c && ['journaliste', 'lobby', 'industriel'].includes(c.type));
  if (plotter && schemes(d).length) {
    const s = schemeToJoin(d, e.key, n?.id);
    const why = s ? undefined : schemes(d).every(x => x.targetId === n?.id) ? 'C’est la cible de votre complot' : 'Déjà complice de tous vos complots';
    out.push({
      id: 'complot',
      label: s ? `🕯️ Rallier à votre complot contre ${s.targetName}` : '🕯️ Rallier à un complot',
      hint: s ? `${SCHEMES[s.type].label} : un complice fait avancer le complot chaque mois. Mais un complice fâché peut tout révéler.` : 'Un complice fait avancer un complot, mois après mois.',
      ok: !block && !!s, reason: block ?? why,
    });
  }

  // ── Apparition publique de soutien ──
  const appear = ['chef', 'collegue', 'personnalite', 'gouvernement'].includes(e.kind) || e.key === 'conjoint' || (!!c && ['association', 'syndicat'].includes(c.type));
  if (appear) {
    const last = flag(d, `appar_${e.key}`);
    const soon = d.week - last < APPEAR_COOLDOWN ? 'Déjà sollicité·e il y a peu' : undefined;
    const hint = e.key === 'conjoint' ? 'Un marché main dans la main, une photo dans les magazines.'
      : n ? `Sa cote (${Math.round(n.popularity)}) rejaillit sur vous${n.partyId !== d.party.id ? ' ; un soutien venu de l’autre camp, rare et remarqué' : ''}. Une figure impopulaire peut vous plomber.`
      : e.kind === 'gouvernement' ? 'Un déplacement commun dans votre circonscription, caméras comprises.'
      : 'Leurs adhérents à vos côtés, banderoles comprises.';
    out.push({
      id: 'apparition', label: e.key === 'conjoint' ? '📸 Une apparition publique en couple' : '📣 Demander une apparition publique à vos côtés',
      hint, ok: !block && !soon, reason: block ?? soon,
    });
  }

  // ── Argent (pour ceux à qui l'on ne pouvait pas encore en demander) ──
  if (e.kind === 'collegue' && n) {
    const owed = debtTo(d, n.id);
    out.push({ id: 'argent', label: '💸 Lui emprunter de l’argent', hint: 'Un prêt entre collègues, sans intérêts. Il faudra rembourser, et on s’en souviendra.',
      ok: !block && !owed, reason: block ?? (owed ? `Vous lui devez déjà ${eur(owed)}` : undefined) });
  } else if (e.kind === 'personnalite' && n) {
    const camp = campaignOpen(d);
    const recent = d.week - flag(d, `don_${n.id}`) < 12;
    out.push({ id: 'argent', label: '💶 Solliciter un don pour votre campagne', hint: `Un chèque personnel, plafonné par la loi à ${eur(DON_MAX)}.`,
      ok: !block && camp && !recent, reason: block ?? (!camp ? 'Seulement pendant une campagne' : recent ? 'Déjà sollicité·e cette année' : undefined) });
  } else if (e.key === 'conjoint') {
    const recent = d.week - flag(d, 'phoneMoneyPartner') < 12;
    out.push({ id: 'argent', label: '💸 Lui demander un coup de main financier', hint: 'Le compte commun. Une fois par an, et il faudra s’expliquer.',
      ok: !block && !recent, reason: block ?? (recent ? 'Déjà demandé cette année' : undefined) });
  }
  return out;
}

/** Les options gérées ici (et non par le standard du téléphone) */
export function isAsk(d: GameState, e: PhoneEntry, optionId: CallOption['id']): boolean {
  if (optionId === 'complot' || optionId === 'apparition') return true;
  return optionId === 'argent' && (e.kind === 'collegue' || e.kind === 'personnalite' || e.key === 'conjoint');
}

export function askCall(d: GameState, e: PhoneEntry, optionId: CallOption['id'], rng: Rng): Ask {
  if (optionId === 'complot') return askPlot(d, e, rng);
  if (optionId === 'apparition') return askAppearance(d, e, rng);
  return askMoney(d, e, rng);
}

/* ── Complot ───────────────────────────────────────────────── */

const PLOT_YES: Record<string, string[]> = {
  espionnage: ['Je connais quelqu’un à son secrétariat. Les mails arriveront chez toi.', 'Son assistant parlementaire me doit un service. Laisse-moi faire.'],
  calomnie: ['J’ai deux ou trois histoires à raconter à la buvette. Elles feront le tour de Paris.', 'Je connais les bons comptes anonymes. Ça va tourner.'],
  sabotage: ['Ses réunions vont se mettre à fuiter. Comme par hasard.', 'Je siège dans sa commission. Ses amendements vont avoir du mal.'],
  debauchage: ['Je dîne avec ses lieutenants jeudi. Ils hésitent déjà.', 'Son trésorier de fédération est mon cousin. On en parle dimanche.'],
  chantage: ['Je n’ai rien entendu. Mais si tu as besoin d’un intermédiaire…', 'Je porterai l’enveloppe. Une seule fois.'],
};

function askPlot(d: GameState, e: PhoneEntry, rng: Rng): Ask {
  const n = npcOf(d, e);
  const c = contactOf(d, e);
  const s = schemeToJoin(d, e.key, n?.id)!;
  const target = d.npcs.find(x => x.id === s.targetId);
  const loyalty = n ? n.relationToPlayer : c ? c.trust : 25;
  let chance = e.kind === 'gouvernement' ? 0.3 : 0.25 + loyalty / 120;
  if (n && n.partyId === d.party.id) chance += 0.1;
  if (n && target && target.partyId === n.partyId) chance -= 0.15;
  if (s.type === 'chantage') chance -= 0.1;
  if (rng.chance(clamp(chance, 0.05, 0.9))) {
    const notes = joinScheme(d, s, { key: e.key, name: e.name.replace(/\s*\(.*\)\s*$/, ''), npcId: n?.id, contactId: c?.id });
    const answer = c?.type === 'journaliste' ? 'Je ne fais pas de politique. Mais si une enquête tombe sur mon bureau, elle sera publiée.'
      : c ? 'Nous avons nos propres raisons de vouloir sa chute. Comptez sur nos réseaux.'
      : rng.pick(PLOT_YES[s.type] ?? PLOT_YES['sabotage']);
    return { answer, notes, effects: [st('politicalCapital', -3), st('stress', 1)] };
  }
  s.secrecy = clamp(s.secrecy - 8);
  const effects: Effect[] = [st('stress', 2)];
  if (n) effects.push({ kind: 'npcRelation', npcId: n.id, delta: -3 });
  if (c) effects.push({ kind: 'contact', contactId: c.id, trust: -3 });
  if (target && (loyalty < 0 || rng.chance(0.25))) {
    s.secrecy = clamp(s.secrecy - 10);
    effects.push({ kind: 'npcRelation', npcId: target.id, delta: -8 });
    return { answer: `Tu me prends pour qui ? (Quelques jours plus tard, ${target.name} semble étrangement au courant.)`, notes: ['Complot éventé : discrétion −18'], effects };
  }
  return { answer: rng.pick(['Je ne veux pas être mêlé·e à ça. Et je n’ai rien entendu.', 'Très peu pour moi. Fais attention à qui tu en parles.', 'Non. Et efface ce message.']), notes: ['Discrétion −8'], effects };
}

/* ── Apparition publique ───────────────────────────────────── */

function askAppearance(d: GameState, e: PhoneEntry, rng: Rng): Ask {
  d.player.flags[`appar_${e.key}`] = d.week;
  const camp = campaignOpen(d);
  const n = npcOf(d, e);
  const c = contactOf(d, e);
  if (e.key === 'conjoint') {
    if (rng.chance(0.85)) return { answer: 'D’accord. Mais pas de questions sur les enfants, et on rentre avant 20 h.', notes: ['Un marché en couple, une photo en une'], effects: [st('popularity', 2), st('stress', -2), ...(camp ? [{ kind: 'momentum', delta: 2 } as Effect] : [])] };
    return { answer: 'Je ne suis pas un accessoire de campagne. On en a déjà parlé.', notes: [], effects: [st('stress', 3)] };
  }
  if (e.kind === 'gouvernement') {
    const top = e.key === 'gouv:pm' || e.key === 'gouv:pr';
    if (rng.chance((top ? 0.35 : 0.55) + (camp ? 0.1 : 0))) {
      return {
        answer: top ? 'Je viendrai inaugurer quelque chose chez toi. Prépare une belle salle et des drapeaux.' : 'Déplacement commun vendredi : je t’apporte une annonce budgétaire pour ta circonscription.',
        notes: [top ? 'Un déplacement présidentiel à vos côtés' : 'Un déplacement ministériel commun'],
        effects: [st('popularity', top ? 3 : 2), st('influence', top ? 3 : 1), st('politicalCapital', top ? -6 : -3), { kind: 'momentum', delta: camp ? 4 : 1 }, { kind: 'localProject', attachment: 2 }],
      };
    }
    return { answer: top ? 'L’agenda est bouclé jusqu’à l’été. Je transmets au cabinet.' : 'Pas en ce moment, je suis en pleine bataille budgétaire.', notes: [], effects: [] };
  }
  if (c) {
    if (rng.chance(clamp(0.3 + c.trust / 100, 0.1, 0.9))) {
      const effects: Effect[] = [st('popularity', 2), { kind: 'contact', contactId: c.id, balance: -1 }, { kind: 'momentum', delta: camp ? 3 : 1 }];
      if (c.type === 'syndicat') effects.push({ kind: 'dossier', domain: 'social', delta: 2 }, st('credibility', 1));
      return { answer: c.type === 'syndicat' ? 'On sera là, avec les drapeaux. Mais on attend des actes.' : 'Nos bénévoles seront à vos côtés samedi. C’est un honneur.', notes: [`${e.name} s’affiche à vos côtés`], effects };
    }
    return { answer: 'Nous ne prenons pas parti. C’est une règle, désolé.', notes: [], effects: [{ kind: 'contact', contactId: c.id, trust: -1 }] };
  }
  if (!n) return { answer: 'Pas cette fois.', notes: [], effects: [] };
  const same = n.partyId === d.party.id;
  const chance = clamp(0.3 + n.relationToPlayer / 100 + (same ? 0.2 : 0) - (!same && camp ? 0.2 : 0) - (n.isRival ? 0.2 : 0), 0.05, 0.9);
  if (!rng.chance(chance)) {
    return { answer: same ? rng.pick(['Mon agenda est plein, désolé·e.', 'Je ne m’affiche pas avant d’être sûr·e que tu gagnes.']) : 'M’afficher avec vous ? Mes électeurs ne me le pardonneraient pas.', notes: [], effects: [{ kind: 'npcRelation', npcId: n.id, delta: -1 }] };
  }
  d.player.flags[`apparNpc_${n.id}`] = d.week;
  const effects: Effect[] = [{ kind: 'npcRelation', npcId: n.id, delta: -2 }, st('politicalCapital', -2)];
  if (n.popularity < 30) {
    effects.push(st('popularity', -1));
    return { answer: 'Avec plaisir ! (Les caméras préfèrent filmer les sifflets qui l’accueillent.)', notes: [`${n.name} est impopulaire : le soutien vous dessert`], effects };
  }
  effects.push(st('popularity', Math.round(1 + n.popularity / 25)), { kind: 'momentum', delta: camp ? Math.round(3 + n.popularity / 15) : 1 });
  if (n.influence > 60) effects.push(st('influence', 1));
  if (!same) effects.push(st('credibility', 2), { kind: 'faction', factionId: '*', delta: -1 });
  return {
    answer: same ? rng.pick(['Je serai à ton meeting jeudi. Je dirai tout le bien que je pense de toi.', 'Une photo ensemble au marché dimanche ? Les militants vont adorer.'])
      : 'Je viendrai saluer votre travail sur ce dossier. Rien de plus, mais rien de moins.',
    notes: [`${n.name} s’affiche à vos côtés`], effects,
  };
}

/* ── Argent ────────────────────────────────────────────────── */

function askMoney(d: GameState, e: PhoneEntry, rng: Rng): Ask {
  const n = npcOf(d, e);
  if (e.key === 'conjoint') {
    d.player.flags['phoneMoneyPartner'] = d.week;
    const amount = 1000 + Math.round(rng.range(0, 4)) * 500;
    return { answer: `Prends ${eur(amount)} sur le compte commun. Mais on en reparlera ce soir.`, notes: [], effects: [{ kind: 'funds', account: 'personal', delta: amount }, st('stress', 2)] };
  }
  if (!n) return { answer: 'Je ne peux rien pour toi.', notes: [], effects: [] };
  if (e.kind === 'collegue') {
    if (!rng.chance(clamp(0.35 + n.relationToPlayer / 100, 0.1, 0.9))) {
      return { answer: rng.pick(['Je suis à découvert moi-même, désolé·e.', 'Entre collègues, on évite de mélanger amitié et argent.']), notes: [], effects: [{ kind: 'npcRelation', npcId: n.id, delta: -2 }] };
    }
    const amount = round500(1000 + n.influence * 30);
    d.player.flags[`dette_${n.id}`] = amount;
    d.player.flags[`detteW_${n.id}`] = d.week;
    return { answer: `Je te fais un virement de ${eur(amount)}. Tu me rends ça quand tu peux… mais rends-le.`, notes: [`Dette envers ${n.name} : ${eur(amount)}`], effects: [{ kind: 'funds', account: 'personal', delta: amount }, { kind: 'npcRelation', npcId: n.id, delta: -2 }] };
  }
  // Personnalité : don de campagne
  d.player.flags[`don_${n.id}`] = d.week;
  const same = n.partyId === d.party.id;
  if (!rng.chance(clamp(0.25 + n.relationToPlayer / 100 + (same ? 0.2 : 0), 0.05, 0.9))) {
    return { answer: same ? 'J’ai ma propre campagne à financer, tu sais.' : 'Financer un adversaire ? Vous ne manquez pas d’air.', notes: [], effects: [{ kind: 'npcRelation', npcId: n.id, delta: -1 }] };
  }
  const amount = Math.min(DON_MAX, round500(1000 + n.influence * 40));
  const effects: Effect[] = [{ kind: 'funds', account: 'campaign', delta: amount }, { kind: 'npcRelation', npcId: n.id, delta: -2 }];
  if (!same) effects.push({ kind: 'exposure', delta: 2 });
  return { answer: `Un chèque de ${eur(amount)} part demain, à titre personnel. ${same ? 'Gagne.' : 'Personne n’a besoin de le savoir.'}`, notes: [], effects };
}

/* ── Les dettes se rappellent à vous ───────────────────────── */

/** Chaque mois : un·e créancier·e finit par réclamer son dû (au plus un SMS par mois) */
export function monthlyDebts(d: GameState, sent: Set<string>, rng: Rng): void {
  for (const [k, v] of Object.entries(d.player.flags)) {
    if (!k.startsWith('dette_') || Number(v) <= 0) continue;
    const id = k.slice(6);
    const n = d.npcs.find(x => x.id === id);
    if (!n) { d.player.flags[k] = 0; continue; }
    const amount = Number(v);
    const age = d.week - Number(d.player.flags[`detteW_${id}`] ?? d.week);
    if (age >= 18) {
      d.player.flags[k] = 0;
      n.relationToPlayer = clamp(n.relationToPlayer - 15, -100, 100);
      pushNews(d, 'reseau', 'negative', `${n.name} passe l’éponge`, `Les ${eur(amount)} prêtés ne reviendront pas. ${n.name} ne vous le pardonnera pas de sitôt.`);
      continue;
    }
    if (age < 6 || age % 3 !== 0) continue;
    const who = n.partyId === d.party.id && n.id !== d.party.leaderNpcId ? `collegue:${n.id}` : `perso:${n.id}`;
    if (sent.has(who)) continue;
    sent.add(who);
    addMessage(d, {
      kind: 'sms', who, from: n.name, role: 'Créancier·e',
      text: age >= 12 ? `Je ne vais pas te le redemander dix fois : mes ${eur(amount)}.` : `Petit rappel amical : les ${eur(amount)} que je t’ai prêtés… Tu peux me les rendre ?`,
      replies: [
        { id: 'rembourser', label: `Rembourser ${eur(amount)}`, effects: [{ kind: 'funds', account: 'personal', delta: -amount }, { kind: 'flag', key: k, value: 0 }, { kind: 'npcRelation', npcId: n.id, delta: 5 }], answer: 'Merci. Je savais que je pouvais te faire confiance.' },
        { id: 'attendre', label: 'Encore quelques mois…', effects: [{ kind: 'npcRelation', npcId: n.id, delta: -6 }, st('stress', 2)], answer: rng.pick(['Encore ? Ne me fais pas regretter de t’avoir aidé·e.', 'Je commence à parler de toi à la buvette, tu sais.']) },
      ],
    });
  }
}

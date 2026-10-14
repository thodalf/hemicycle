import { ActivityState, Effect, GameState, Npc, RankId } from '../models/game.models';
import { rankOrder } from '../data/ranks';
import { applyEffects, availableFunds, pushNews, spend } from './effects';
import { netWorth } from './patrimoine';
import { discoverSecret, grantHook } from './secrets';
import { engrave } from './memories';
import { Rng } from './rng';

/* ============================================================
 *  Les activités, à la manière des festins de Crusader Kings :
 *  on choisit ses invités, puis trois moments se succèdent
 *  (confidences, disputes, toasts, faux pas…). On en repart
 *  avec des amitiés, des rancunes, des secrets ou des leviers.
 * ============================================================ */

export interface ActivityDef {
  id: string;
  icon: string;
  label: string;
  desc: string;
  minRank: RankId;
  ap: number;
  /** Prix plancher (10 000 € au moins) */
  money: number;
  /** Part du patrimoine net engloutie : plus vous êtes riche, plus on attend du faste */
  share: number;
  /** Nombre d'invités */
  guests: number;
  /** Seulement des invités de votre parti */
  ownParty: boolean;
  /** Mois avant de pouvoir recommencer */
  cooldown: number;
  intro: string;
  renown: number;
}

export const ACTIVITIES: ActivityDef[] = [
  { id: 'universite_ete', icon: '🏕️', label: 'L’université d’été du parti', desc: 'Trois jours à La Rochelle : ateliers, apéros, petites phrases.', minRank: 'conseiller_municipal', ap: 2, money: 15000, share: 0.05, guests: 3, ownParty: true, cooldown: 12, renown: 10,
    intro: 'Les tentes sont montées face à la mer. Les militants affluent, les caméras aussi.' },
  { id: 'diner_siecle', icon: '🍽️', label: 'Le dîner du Siècle', desc: 'Le dîner où tout le pouvoir se croise, une fois par mois, place de la Concorde.', minRank: 'depute', ap: 1, money: 12000, share: 0.04, guests: 2, ownParty: false, cooldown: 6, renown: 6,
    intro: 'Nappes blanches, argenterie, et des conversations qui valent des millions.' },
  { id: 'congres', icon: '🎪', label: 'Le congrès du parti', desc: 'Motions, discours, nuits blanches : le parti se choisit une ligne.', minRank: 'depute', ap: 2, money: 20000, share: 0.07, guests: 3, ownParty: true, cooldown: 18, renown: 15,
    intro: 'Six mille délégués, une salle surchauffée, des tractations jusqu’à l’aube.' },
  { id: 'voyage_officiel', icon: '✈️', label: 'Le voyage officiel', desc: 'Une délégation à l’étranger : dans l’avion, les langues se délient.', minRank: 'ministre', ap: 2, money: 10000, share: 0.03, guests: 2, ownParty: false, cooldown: 6, renown: 12,
    intro: 'L’Airbus de la République décolle. Douze heures de vol, et vos invités sont assis près de vous.' },
  { id: 'banquet', icon: '🥖', label: 'Le banquet républicain', desc: 'Une grande tablée dans une salle des fêtes, avec élus et notables du coin.', minRank: 'conseiller_municipal', ap: 1, money: 10000, share: 0.025, guests: 2, ownParty: false, cooldown: 4, renown: 5,
    intro: 'Pâté en croûte, vin du pays, et l’accordéon qui démarre dès le fromage.' },
];
/** « Le dîner » → « au dîner », « L’université » → « à l’université » */
const aLabel = (l: string) => l.startsWith('Le ') ? 'au ' + l.slice(3) : l.startsWith('Les ') ? 'aux ' + l.slice(4) : 'à ' + l[0].toLowerCase() + l.slice(1);

export const ACTIVITY_BY_ID = new Map(ACTIVITIES.map(a => [a.id, a]));

interface StepChoice { id: string; label: string; outcome: string; effects: Effect[]; after?: (d: GameState, rng: Rng) => string | null }
interface Step { id: string; needs: number; title: (g: Npc, h?: Npc) => string; text: (g: Npc, h?: Npc) => string; choices: (g: Npc, h?: Npc) => StepChoice[] }

const rel = (n: Npc, delta: number, reason: string): Effect => ({ kind: 'npcRelation', npcId: n.id, delta, reason });

const STEPS: Step[] = [
  { id: 'confidence', needs: 1, title: g => `${g.name} vous prend à part`, text: g => `Un verre à la main, ${g.name} baisse la voix : il ou elle doute de la direction et cherche une oreille.`,
    choices: g => [
      { id: 'ecouter', label: 'Écouter, longuement', outcome: 'Une heure de confidences. Vous en savez plus, et il ou elle vous fait confiance.', effects: [rel(g, 8, 'Vous avez écouté ses confidences')], after: (d, rng) => rng.chance(0.35) ? discoverSecret(d, rng, g.id) && `Au détour d’une phrase, ${g.name} vous livre un secret.` : null },
      { id: 'repeter', label: 'Tout répéter, plus tard, à qui de droit', outcome: 'L’information circule. Vous gagnez en poids ; il ou elle l’apprendra un jour.', effects: [rel(g, -12, 'Vous avez trahi ses confidences'), { kind: 'stat', stat: 'influence', delta: 3 }, { kind: 'dread', delta: 2 }] },
    ] },
  { id: 'dispute', needs: 2, title: (g, h) => `${g.name} et ${h!.name} s’accrochent`, text: (g, h) => `Le ton monte entre ${g.name} et ${h!.name}. Tout le monde se tourne vers vous.`,
    choices: (g, h) => [
      { id: 'g', label: `Prendre le parti de ${g.name}`, outcome: `${g.name} s’en souviendra. ${h!.name} aussi.`, effects: [rel(g, 12, 'Vous l’avez défendu·e en public'), rel(h!, -12, 'Vous avez pris parti contre lui ou elle')] },
      { id: 'h', label: `Prendre le parti de ${h!.name}`, outcome: `${h!.name} vous remercie du regard. ${g.name} quitte la table.`, effects: [rel(h!, 12, 'Vous l’avez défendu·e en public'), rel(g, -12, 'Vous avez pris parti contre lui ou elle')] },
      { id: 'arbitrer', label: 'Arbitrer avec humour', outcome: 'Un bon mot, des rires : la tension retombe. Vous voilà médiateur·rice.', effects: [rel(g, 4, 'Votre arbitrage'), rel(h!, 4, 'Votre arbitrage'), { kind: 'stat', stat: 'influence', delta: 2 }] },
    ] },
  { id: 'toast', needs: 1, title: () => 'Le toast', text: () => 'On tape sur un verre : c’est à vous de porter un toast.',
    choices: g => [
      { id: 'emouvant', label: 'Un toast émouvant sur l’engagement', outcome: 'Des yeux humides, des applaudissements nourris.', effects: [{ kind: 'renown', delta: 6 }, rel(g, 3, 'Votre toast')] },
      { id: 'drole', label: 'Un toast drôle, un peu piquant', outcome: 'La salle rit… sauf la cible de votre bon mot.', effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, rel(g, -4, 'Votre bon mot à ses dépens')] },
      { id: 'court', label: 'Trois mots, et on trinque', outcome: '« À la République ! » Sobre, efficace.', effects: [{ kind: 'stat', stat: 'stress', delta: -2 }] },
    ] },
  { id: 'faux_pas', needs: 1, title: g => `${g.name} a trop bu`, text: g => `${g.name} titube et commence à raconter des choses qu’il ou elle regrettera. Un téléphone filme.`,
    choices: g => [
      { id: 'proteger', label: 'L’emmener discrètement prendre l’air', outcome: 'Personne n’a rien vu. Le lendemain, un SMS : « Je te dois une fière chandelle. »', effects: [rel(g, 14, 'Vous l’avez protégé·e d’un faux pas')], after: d => { grantHook(d, g.id, 'faible', 'Vous l’avez tiré·e d’un mauvais pas'); return `${g.name} vous doit un service.`; } },
      { id: 'laisser', label: 'Laisser filmer', outcome: 'La vidéo circule dès minuit. Sa cote plonge, votre réputation de dur·e grimpe.', effects: [rel(g, -18, 'Vous l’avez laissé·e se ridiculiser'), { kind: 'npcStat', npcId: g.id, stat: 'popularity', delta: -8 }, { kind: 'dread', delta: 4 }] },
    ] },
  { id: 'pacte', needs: 1, title: g => `${g.name} propose un pacte`, text: g => `« Toi et moi, on pourrait aller loin ensemble. » ${g.name} vous propose une alliance pour les années à venir.`,
    choices: g => [
      { id: 'accepter', label: 'Toper', outcome: 'Une poignée de main qui vaut contrat. Il ou elle votera vos textes.', effects: [rel(g, 15, 'Votre pacte'), { kind: 'flagAdd', key: 'billSupport', delta: 5 }, { kind: 'stat', stat: 'politicalCapital', delta: -4 }] },
      { id: 'refuser', label: 'Décliner poliment', outcome: '« Dommage. » Un sourire un peu crispé.', effects: [rel(g, -4, 'Vous avez refusé son pacte')] },
    ] },
  { id: 'journaliste', needs: 1, title: () => 'Un journaliste rôde', text: () => 'Une plume du Canard traîne entre les tables, carnet à la main.',
    choices: g => [
      { id: 'parler', label: 'Lui accorder dix minutes', outcome: 'Un portrait flatteur paraît mercredi.', effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'exposure', delta: 1 }] },
      { id: 'balancer', label: `Lui glisser une info sur ${g.name}`, outcome: 'L’info sort mercredi. Personne ne sait d’où elle vient… pour l’instant.', effects: [{ kind: 'npcStat', npcId: g.id, stat: 'popularity', delta: -5 }, { kind: 'stat', stat: 'influence', delta: 1 }, { kind: 'exposure', delta: 2 }] },
      { id: 'eviter', label: 'L’éviter soigneusement', outcome: 'Il repart bredouille.', effects: [] },
    ] },
  { id: 'jeu', needs: 1, title: g => `Partie de pétanque avec ${g.name}`, text: g => `${g.name} vous défie à la pétanque devant tout le monde.`,
    choices: g => [
      { id: 'gagner', label: 'Jouer pour gagner', outcome: 'Un carreau parfait. Les militants exultent ; votre adversaire boude.', effects: [{ kind: 'renown', delta: 3 }, rel(g, -3, 'Vous l’avez battu·e à la pétanque')] },
      { id: 'perdre', label: 'Perdre élégamment', outcome: 'Il ou elle savoure sa victoire, et vous en sait gré.', effects: [rel(g, 7, 'Vous l’avez laissé·e gagner')] },
    ] },
  { id: 'oreille', needs: 1, title: () => 'Une conversation surprise', text: g => `Derrière une porte, vous entendez ${g.name} au téléphone. Le ton est très bas.`,
    choices: g => [
      { id: 'ecouter', label: 'Tendre l’oreille', outcome: 'Vous retenez votre souffle…', effects: [{ kind: 'exposure', delta: 1 }], after: (d, rng) => rng.chance(0.6) ? discoverSecret(d, rng, g.id) && `Vous avez entendu ce qu’il ne fallait pas : un secret de ${g.name}.` : 'Rien d’intéressant : une histoire de travaux.' },
      { id: 'partir', label: 'S’éloigner', outcome: 'Ce ne sont pas vos affaires.', effects: [] },
    ] },
];

/** Le prix d'une activité : un plancher (10 000 € au moins), puis une part de votre fortune.
 *  On n'invite pas le Tout-Paris avec un buffet de supermarché quand on a des millions. */
export function activityCost(d: GameState, def: ActivityDef): number {
  const byWealth = Math.max(0, netWorth(d)) * def.share;
  return Math.round(Math.max(10000, def.money, byWealth) / 500) * 500;
}

export function activityAvailability(d: GameState, def: ActivityDef): string | null {
  if (d.activity) return 'Une activité est déjà en cours';
  if (rankOrder(d.player.rankId) < rankOrder(def.minRank)) return 'Rang insuffisant';
  if (d.player.actionPoints.current < def.ap) return `Il faut ${def.ap} PA`;
  const price = activityCost(d, def);
  if (availableFunds(d) < price) return `Il faut ${price.toLocaleString('fr-FR')} €`;
  const last = Number(d.player.flags[`activity_${def.id}`] ?? -99);
  if (d.week - last < def.cooldown) return `De nouveau dans ${def.cooldown - (d.week - last)} mois`;
  return null;
}

export function guestPool(d: GameState, def: ActivityDef): Npc[] {
  return d.npcs.filter(n => !def.ownParty || n.partyId === d.party.id);
}

export function startActivity(d: GameState, id: string, guestIds: string[], rng: Rng): boolean {
  const def = ACTIVITY_BY_ID.get(id);
  if (!def || activityAvailability(d, def)) return false;
  const guests = guestIds.filter(g => d.npcs.some(n => n.id === g)).slice(0, def.guests);
  if (!guests.length) return false;
  d.player.actionPoints.current -= def.ap;
  spend(d, activityCost(d, def));
  d.player.flags[`activity_${def.id}`] = d.week;
  const pool = STEPS.map((s, i) => ({ s, i })).filter(x => x.s.needs <= guests.length).sort(() => rng.next() - 0.5);
  d.activity = { type: id, guests, stage: 0, steps: pool.slice(0, 3).map(x => x.i), log: [def.intro], status: 'en_cours', summary: [], week: d.week };
  return true;
}

/** Le moment en cours, avec ses invités */
export function currentStep(d: GameState): { step: Step; g: Npc; h?: Npc } | null {
  const a = d.activity;
  if (!a || a.status !== 'en_cours') return null;
  const step = STEPS[a.steps[a.stage]];
  if (!step) return null;
  const guests = a.guests.map(id => d.npcs.find(n => n.id === id)).filter(Boolean) as Npc[];
  const g = guests[a.stage % guests.length];
  const h = guests.find(x => x !== g);
  return { step, g, h };
}

export function chooseStep(d: GameState, choiceId: string, rng: Rng): void {
  const a = d.activity;
  const cur = currentStep(d);
  if (!a || !cur) return;
  const choice = cur.step.choices(cur.g, cur.h).find(c => c.id === choiceId);
  if (!choice) return;
  const def = ACTIVITY_BY_ID.get(a.type)!;
  const out = applyEffects(d, choice.effects, { reason: def.label }, rng);
  const extra = choice.after?.(d, rng);
  a.log.push(`${cur.step.title(cur.g, cur.h)} — ${choice.label}. ${choice.outcome}${extra ? ' ' + extra : ''}`);
  a.summary.push(...out, ...(extra ? [extra] : []));
  a.stage += 1;
  if (a.stage >= a.steps.length) {
    a.status = 'fini';
    const fin: Effect[] = [{ kind: 'renown', delta: def.renown }, ...a.guests.map(id => ({ kind: 'npcRelation', npcId: id, delta: 4, reason: `Invité·e ${aLabel(def.label)}` }) as Effect)];
    a.summary.push(...applyEffects(d, fin, {}, rng));
    for (const id of a.guests) { const n = d.npcs.find(x => x.id === id); if (n) engrave(d, n, def.label, 6); }
    pushNews(d, 'actu', 'positive', def.label, a.summary.slice(0, 8).join(' · '));
  }
}

export function closeActivity(d: GameState): void {
  if (d.activity?.status === 'fini') d.activity = null;
}

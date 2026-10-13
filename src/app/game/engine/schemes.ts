import { Effect, EffectContext, GameState, Npc, Scheme, SchemeType } from '../models/game.models';
import { applyEffects, pushNews } from './effects';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Vos complots : espionner, dénigrer, saboter, débaucher,
 *  faire chanter. Chaque complot avance de mois en mois (progression)
 *  et s'ébruite peu à peu (discrétion). Découvert, il se
 *  retourne contre vous : enquête et scandale.
 * ============================================================ */

export const MAX_SCHEMES = 3;

export interface SchemeDef {
  type: SchemeType;
  icon: string;
  label: string;
  /** « contre X » */
  verb: string;
  description: string;
  /** Progression mensuelle de base */
  pace: number;
  /** Discrétion au départ */
  secrecy: number;
  /** Gravité si découvert (1 ou 2) */
  gravity: 1 | 2;
}

export const SCHEMES: Record<SchemeType, SchemeDef> = {
  espionnage: { type: 'espionnage', icon: '🕵️', label: 'Détourner des informations', verb: 'Vol de documents visant', pace: 18, secrecy: 70, gravity: 2,
    description: 'Un stagiaire bien placé, une clé USB, des mails internes : de quoi tenir votre cible.' },
  calomnie: { type: 'calomnie', icon: '🗞️', label: 'Campagne de dénigrement', verb: 'Dénigrement de', pace: 22, secrecy: 65, gravity: 1,
    description: 'Comptes anonymes, rumeurs, « sources proches du dossier » : sa réputation s’effrite.' },
  sabotage: { type: 'sabotage', icon: '🧨', label: 'Saboter son action', verb: 'Sabotage visant', pace: 15, secrecy: 60, gravity: 2,
    description: 'Réunions qui fuitent, salles annulées, alliés retournés : rien ne lui réussit plus.' },
  debauchage: { type: 'debauchage', icon: '🤝', label: 'Débaucher ses soutiens', verb: 'Débauchage autour de', pace: 14, secrecy: 75, gravity: 1,
    description: 'Ses lieutenants, un par un, rejoignent votre camp.' },
  chantage: { type: 'chantage', icon: '✉️', label: 'Faire chanter', verb: 'Chantage contre', pace: 25, secrecy: 60, gravity: 2,
    description: 'Il faut un dossier compromettant. Ensuite, il ou elle vous obéit.' },
};

export function schemes(d: GameState): Scheme[] {
  return (d.schemes ??= []);
}

export function kompromat(d: GameState, npcId: string): number {
  return Number(d.player.flags[`kompromat_${npcId}`] ?? 0);
}

/** Risque d'être découvert ce mois-ci */
export function discoveryRisk(d: GameState, s: Scheme): number {
  const def = SCHEMES[s.type];
  const spin = d.player.staff.includes('spin_doctor') ? 0.8 : 1;
  return clamp(Math.pow((100 - s.secrecy) / 100, 1.6) * (0.16 + def.gravity * 0.04) * spin * 100, 1, 60) / 100;
}

export function canLaunch(d: GameState, type: SchemeType, targetId: string | undefined): string | null {
  const list = schemes(d);
  if (!targetId || !d.npcs.some(n => n.id === targetId)) return 'Choisissez une cible';
  if (list.length >= MAX_SCHEMES) return `Trois complots à la fois, pas plus`;
  if (list.some(s => s.targetId === targetId && s.type === type)) return 'Ce complot est déjà en cours';
  if (type === 'chantage' && kompromat(d, targetId) < 1) return 'Il vous faut un dossier compromettant sur cette personne';
  return null;
}

export function adjustScheme(d: GameState, e: Extract<Effect, { kind: 'scheme' }>, ctx: EffectContext, rng: Rng): string[] {
  const list = schemes(d);
  if (e.type) {
    const targetId = e.targetId === '$target' ? ctx.targetId : e.targetId;
    const type = e.type as SchemeType;
    const why = canLaunch(d, type, targetId);
    const npc = d.npcs.find(n => n.id === targetId);
    if (why || !npc) return [why ?? 'Cible introuvable'];
    const def = SCHEMES[type];
    list.push({ id: nextId(d, 'cpl'), type, targetId: npc.id, targetName: npc.name, since: d.week, progress: 5, secrecy: def.secrecy });
    return [`Complot lancé : ${def.label.toLowerCase()} (${npc.name})`];
  }
  const out: string[] = [];
  for (const s of list) {
    if (e.progress) s.progress = clamp(s.progress + e.progress);
    if (e.secrecy) s.secrecy = clamp(s.secrecy + e.secrecy);
  }
  if (list.length && e.progress) out.push(`Complots : progression ${e.progress > 0 ? '+' : ''}${e.progress}`);
  if (list.length && e.secrecy) out.push(`Complots : discrétion ${e.secrecy > 0 ? '+' : ''}${e.secrecy}`);
  for (const s of [...list]) if (s.progress >= 100) out.push(...complete(d, s, rng));
  return out;
}

export function abandonScheme(d: GameState, id: string): void {
  const list = schemes(d);
  const s = list.find(x => x.id === id);
  if (!s) return;
  d.schemes = list.filter(x => x.id !== id);
  pushNews(d, 'systeme', 'neutral', 'Complot abandonné', `${SCHEMES[s.type].verb} ${s.targetName} : vous effacez les traces et passez à autre chose.`);
}

/** Chaque mois : les complots avancent, et s'ébruitent */
export function monthlySchemes(d: GameState, rng: Rng): void {
  const list = schemes(d);
  if (!list.length || d.status !== 'en_cours') return;
  const p = d.player;
  for (const s of [...list]) {
    const npc = d.npcs.find(n => n.id === s.targetId);
    if (!npc) { d.schemes = schemes(d).filter(x => x.id !== s.id); continue; }
    const def = SCHEMES[s.type];
    s.progress = clamp(s.progress + def.pace * (0.7 + p.stats.influence / 200) * rng.range(0.8, 1.2));
    s.secrecy = clamp(s.secrecy - rng.range(2, 6) - npc.influence / 50);
    if (rng.chance(discoveryRisk(d, s))) { discovered(d, s, npc, rng); continue; }
    if (s.progress >= 100) complete(d, s, rng);
  }
}

function remove(d: GameState, s: Scheme): void {
  d.schemes = schemes(d).filter(x => x.id !== s.id);
}

/** Le complot aboutit */
function complete(d: GameState, s: Scheme, rng: Rng): string[] {
  const npc = d.npcs.find(n => n.id === s.targetId);
  remove(d, s);
  if (!npc) return [];
  const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress', delta: number): Effect => ({ kind: 'stat', stat, delta });
  let effects: Effect[] = [];
  let title = '';
  let text = '';
  switch (s.type) {
    case 'espionnage':
      d.player.flags[`kompromat_${npc.id}`] = kompromat(d, npc.id) + 2;
      effects = [st('influence', 2), { kind: 'dossier', domain: d.agendaDomain, delta: 4 }];
      title = 'Les documents sont entre vos mains';
      text = `Mails, notes internes, agenda : vous savez tout de ${npc.name}. De quoi alimenter une fuite… ou un chantage.`;
      break;
    case 'calomnie':
      effects = [{ kind: 'npcStat', npcId: npc.id, stat: 'popularity', delta: -12 }, { kind: 'npcStat', npcId: npc.id, stat: 'influence', delta: -4 }];
      title = `${npc.name} dans la tourmente`;
      text = 'Les rumeurs sont devenues des « questions légitimes ». Sa cote s’effondre.';
      break;
    case 'sabotage':
      effects = [{ kind: 'npcStat', npcId: npc.id, stat: 'influence', delta: -10 }, { kind: 'npcStat', npcId: npc.id, stat: 'popularity', delta: -6 }];
      title = `Rien ne va plus pour ${npc.name}`;
      text = 'Réunions annulées, fuites, alliés introuvables : sa machine politique cale.';
      break;
    case 'debauchage':
      effects = [{ kind: 'npcStat', npcId: npc.id, stat: 'influence', delta: -8 }, st('influence', 6), { kind: 'faction', factionId: '*', delta: 3 }];
      title = `Les soutiens de ${npc.name} vous rejoignent`;
      text = 'Trois lieutenants et un trésorier de fédération changent de camp.';
      break;
    case 'chantage':
      d.player.flags[`kompromat_${npc.id}`] = Math.max(0, kompromat(d, npc.id) - 1);
      npc.isRival = false;
      npc.aggressiveness = 0;
      effects = [{ kind: 'npcRelation', npcId: npc.id, delta: 45 }, st('politicalCapital', 15), { kind: 'funds', account: 'personal', delta: 5000 }, { kind: 'exposure', delta: 4 }];
      title = `${npc.name} cède`;
      text = 'Un rendez-vous dans un parking, une enveloppe, une promesse de silence. Désormais, il ou elle vous obéit.';
      break;
  }
  const summary = applyEffects(d, effects, {}, rng);
  pushNews(d, 'systeme', 'positive', title, `${text} ${summary.join(' · ')}`);
  return [title, ...summary];
}

/** Découvert en cours de route */
function discovered(d: GameState, s: Scheme, npc: Npc, rng: Rng): void {
  remove(d, s);
  const def = SCHEMES[s.type];
  const g = def.gravity;
  const effects: Effect[] = [
    { kind: 'exposure', delta: 10 * g + 4 }, { kind: 'stat', stat: 'credibility', delta: -4 * g }, { kind: 'stat', stat: 'popularity', delta: -2 * g },
    { kind: 'npcRelation', npcId: npc.id, delta: -40 }, { kind: 'stat', stat: 'stress', delta: 8 },
  ];
  if (g >= 2) effects.push({ kind: 'decision', templateId: 'enquete' });
  const summary = applyEffects(d, effects, {}, rng);
  npc.isRival = true;
  pushNews(d, 'scandale', 'negative', `Révélations : ${def.verb.toLowerCase()} ${npc.name}`, `La presse remonte la piste jusqu’à votre entourage. ${summary.join(' · ')}`);
}


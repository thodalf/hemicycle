import { Effect, EffectContext, GameState, Npc, Scheme, SchemeAlly, SchemeType } from '../models/game.models';
import { applyEffects, pushNews } from './effects';
import { discoverSecret, grantHook } from './secrets';
import { Rng, clamp, nextId, frSigned } from './rng';

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
  rallier: { type: 'rallier', icon: '🫱', label: 'Rallier à votre cause', verb: 'Ralliement de', pace: 16, secrecy: 85, gravity: 1,
    description: 'Déjeuners, petits services, promesses : il ou elle finira par vous rejoindre.' },
  fouiller: { type: 'fouiller', icon: '🗂️', label: 'Fouiller son passé', verb: 'Enquête sur', pace: 20, secrecy: 75, gravity: 1,
    description: 'Archives, anciens collaborateurs, vieilles photos : tout le monde cache quelque chose.' },
  putsch: { type: 'putsch', icon: '🗡️', label: 'Préparer un putsch au parti', verb: 'Putsch contre', pace: 10, secrecy: 65, gravity: 2,
    description: 'Compter les fidèles, retourner les fédérations, choisir le moment : la direction tombera.' },
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
  if (type === 'putsch' && targetId !== d.party.leaderNpcId) return 'Un putsch vise la direction de votre parti';
  return null;
}

/* ── Complices ─────────────────────────────────────────────── */

/** Le complot qu'une personne pourrait rejoindre (jamais celui qui la vise) */
export function schemeToJoin(d: GameState, key: string, npcId?: string): Scheme | undefined {
  return schemes(d)
    .filter(s => s.targetId !== npcId && !(s.allies ?? []).some(a => a.key === key))
    .sort((a, b) => a.progress - b.progress)[0];
}

/** Loyauté d'un complice : relation (personnalité) ou confiance (contact) */
export function allyLoyalty(d: GameState, a: SchemeAlly): number {
  if (a.npcId) return d.npcs.find(n => n.id === a.npcId)?.relationToPlayer ?? -50;
  if (a.contactId) return d.contacts.find(c => c.id === a.contactId)?.trust ?? -50;
  return 20;
}

export function joinScheme(d: GameState, s: Scheme, ally: Omit<SchemeAlly, 'since'>): string[] {
  (s.allies ??= []).push({ ...ally, since: d.week });
  s.progress = clamp(s.progress + 8);
  s.secrecy = clamp(s.secrecy - 4);
  return [`${ally.name} rejoint votre complot (${SCHEMES[s.type].verb.toLowerCase()} ${s.targetName})`, 'Progression +8', 'Discrétion −4'];
}

/** Recruter un complice en coulisses (action « Recruter un complice ») */
function recruitAlly(d: GameState, npcId: string | undefined, rng: Rng): string[] {
  const n = d.npcs.find(x => x.id === npcId);
  if (!n) return ['Personne à recruter'];
  const key = n.partyId === d.party.id && n.id !== d.party.leaderNpcId ? `collegue:${n.id}` : `perso:${n.id}`;
  const s = schemeToJoin(d, key, n.id) ?? schemeToJoin(d, `perso:${n.id}`, n.id);
  if (!s) return ['Aucun complot à rejoindre pour cette personne'];
  const target = d.npcs.find(x => x.id === s.targetId);
  const chance = clamp(0.3 + n.relationToPlayer / 120 + (n.partyId === d.party.id ? 0.1 : 0) - (target && target.partyId === n.partyId ? 0.15 : 0), 0.05, 0.9);
  if (rng.chance(chance)) return joinScheme(d, s, { key, name: n.name, npcId: n.id });
  s.secrecy = clamp(s.secrecy - 6);
  n.relationToPlayer = clamp(n.relationToPlayer - 3, -100, 100);
  return [`${n.name} refuse de s’en mêler`, 'Discrétion −6'];
}

export function adjustScheme(d: GameState, e: Extract<Effect, { kind: 'scheme' }>, ctx: EffectContext, rng: Rng): string[] {
  const list = schemes(d);
  if (e.ally) return recruitAlly(d, e.ally === '$target' ? ctx.targetId : e.ally, rng);
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
  if (list.length && e.progress) out.push(`Complots : progression ${frSigned(e.progress)}`);
  if (list.length && e.secrecy) out.push(`Complots : discrétion ${frSigned(e.secrecy)}`);
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
  outer: for (const s of [...list]) {
    const npc = d.npcs.find(n => n.id === s.targetId);
    if (!npc) { d.schemes = schemes(d).filter(x => x.id !== s.id); continue; }
    const def = SCHEMES[s.type];
    s.progress = clamp(s.progress + def.pace * (0.7 + p.stats.influence / 200) * rng.range(0.8, 1.2));
    s.secrecy = clamp(s.secrecy - rng.range(2, 6) - npc.influence / 50);
    // Les complices font avancer le complot, mois après mois… et peuvent trahir
    s.allies = (s.allies ?? []).filter(a => !a.npcId || d.npcs.some(n => n.id === a.npcId));
    for (const a of s.allies) {
      s.progress = clamp(s.progress + 5 * rng.range(0.7, 1.3));
      s.secrecy = clamp(s.secrecy - 1);
      if (allyLoyalty(d, a) < -10 && rng.chance(0.25)) { discovered(d, s, npc, rng, a.name); continue outer; }
    }
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
    case 'rallier':
      effects = [{ kind: 'npcRelation', npcId: npc.id, delta: 35, reason: 'Vous l’avez rallié·e à votre cause' }, { kind: 'flagAdd', key: 'billSupport', delta: 4 }];
      npc.isRival = false;
      title = `${npc.name} vous rejoint`;
      text = 'Des mois de patience : il ou elle se dit désormais « de vos amis ».';
      grantHook(d, npc.id, 'faible', 'Il ou elle vous doit sa place');
      break;
    case 'fouiller': {
      const who = discoverSecret(d, rng, npc.id);
      effects = who ? [st('influence', 1)] : [{ kind: 'npcStat', npcId: npc.id, stat: 'popularity', delta: -3 }];
      title = who ? `Le passé de ${npc.name} n’a plus de secret` : `Rien sur ${npc.name}`;
      text = who ? 'Vos enquêteurs ont trouvé : à vous de choisir l’usage.' : 'Une vie sans tache, ou des traces trop bien effacées. Quelques rumeurs, tout de même.';
      break;
    }
    case 'putsch':
      npc.influence = clamp(npc.influence - 20); npc.popularity = clamp(npc.popularity - 8);
      effects = [st('influence', 10), { kind: 'faction', factionId: '*', delta: 8 }, { kind: 'dread', delta: 15 }, { kind: 'npcRelation', npcId: npc.id, delta: -50, reason: 'Votre putsch' }];
      if (['depute', 'ministre', 'premier_ministre'].includes(d.player.rankId)) effects.push({ kind: 'rank', rankId: 'chef_parti' });
      title = `Putsch réussi contre ${npc.name}`;
      text = 'Au petit matin, les fédérations basculent. La direction tombe ; on vous appelle déjà « patron·ne ».';
      break;
  }
  // Les complices sont récompensés : la confiance se gagne aussi dans l'ombre
  for (const a of s.allies ?? []) {
    if (a.npcId) effects.push({ kind: 'npcRelation', npcId: a.npcId, delta: 5 });
    if (a.contactId) effects.push({ kind: 'contact', contactId: a.contactId, trust: 4 });
  }
  const summary = applyEffects(d, effects, {}, rng);
  const thanks = s.allies?.length ? ` Merci à ${s.allies.map(a => a.name).join(', ')}.` : '';
  pushNews(d, 'systeme', 'positive', title, `${text}${thanks} ${summary.join(' · ')}`);
  return [title, ...summary];
}

/** Découvert en cours de route */
function discovered(d: GameState, s: Scheme, npc: Npc, rng: Rng, traitor?: string): void {
  remove(d, s);
  const def = SCHEMES[s.type];
  const g = def.gravity;
  const effects: Effect[] = [
    { kind: 'exposure', delta: 10 * g + 4 }, { kind: 'stat', stat: 'credibility', delta: -4 * g }, { kind: 'stat', stat: 'popularity', delta: -2 * g },
    { kind: 'npcRelation', npcId: npc.id, delta: -40 }, { kind: 'stat', stat: 'stress', delta: 8 },
  ];
  if (g >= 2) effects.push({ kind: 'decision', templateId: 'enquete' });
  for (const a of s.allies ?? []) if (a.npcId && a.name !== traitor) effects.push({ kind: 'npcRelation', npcId: a.npcId, delta: -10 });
  const summary = applyEffects(d, effects, {}, rng);
  npc.isRival = true;
  const how = traitor ? `${traitor}, votre complice, a tout raconté.` : s.allies?.length ? `La presse remonte la piste jusqu’à vous et vos complices (${s.allies.map(a => a.name).join(', ')}).` : 'La presse remonte la piste jusqu’à votre entourage.';
  pushNews(d, 'scandale', 'negative', traitor ? `Trahison : ${def.verb.toLowerCase()} ${npc.name}` : `Révélations : ${def.verb.toLowerCase()} ${npc.name}`, `${how} ${summary.join(' · ')}`);
}


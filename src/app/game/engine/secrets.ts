import { Decision, Effect, GameState, Hook, Npc, Secret } from '../models/game.models';
import { applyEffects, pushNews } from './effects';
import { engrave, recordOpinion } from './memories';
import { Rng, clamp, nextId } from './rng';
import { nameRng } from '../data/names';
import { decisionActive } from '../data/great-decisions';

/* ============================================================
 *  Secrets et moyens de pression. Chaque personnalité peut
 *  cacher quelque chose ; vous aussi. Un secret découvert se
 *  monnaye : faire chanter (un levier fort), ou dénoncer
 *  (la cible chute, la crainte monte). Un levier faible vaut
 *  un service ; un levier fort se réutilise tous les six mois.
 * ============================================================ */

export interface SecretDef { id: string; label: string; icon: string; gravity: 1 | 2 | 3; text: string }

export const SECRET_TYPES: SecretDef[] = [
  { id: 'liaison', label: 'Une liaison cachée', icon: '💋', gravity: 1, text: 'une relation extraconjugale avec un·e collaborateur·rice' },
  { id: 'fraude', label: 'Fraude fiscale', icon: '🏦', gravity: 3, text: 'un compte non déclaré au Luxembourg' },
  { id: 'emploi_fictif', label: 'Emploi fictif', icon: '📎', gravity: 3, text: 'un proche payé sur fonds publics sans jamais travailler' },
  { id: 'passe_militant', label: 'Un passé militant gênant', icon: '🚩', gravity: 1, text: 'des années dans un groupuscule radical, effacées de sa biographie' },
  { id: 'enfant_cache', label: 'Un enfant caché', icon: '👶', gravity: 1, text: 'un enfant jamais reconnu, quelque part en province' },
  { id: 'dette_jeu', label: 'Des dettes de jeu', icon: '🎰', gravity: 2, text: 'des dettes de poker auprès de gens peu recommandables' },
  { id: 'diplome', label: 'Un diplôme imaginaire', icon: '🎓', gravity: 1, text: 'un master qu’il ou elle n’a jamais obtenu' },
  { id: 'financement', label: 'Un financement occulte', icon: '💼', gravity: 3, text: 'des enveloppes d’un industriel pendant sa dernière campagne' },
  { id: 'plagiat', label: 'Une thèse plagiée', icon: '📄', gravity: 1, text: 'une thèse recopiée aux deux tiers' },
  { id: 'villa', label: 'Une villa non déclarée', icon: '🏝️', gravity: 2, text: 'une villa sur la Côte, au nom d’une société-écran' },
];
export const SECRET_BY_ID = new Map(SECRET_TYPES.map(s => [s.id, s]));

export function secrets(d: GameState): Secret[] {
  return (d.secrets ??= []);
}

/** Au début (ou pour une ancienne partie) : une personnalité sur deux cache quelque chose, vous aussi parfois */
export function ensureSecrets(d: GameState): void {
  const list = secrets(d);
  const next = nameRng(d.seed, `secrets-${d.week}`);
  for (const n of d.npcs) {
    if (d.player.flags[`secretsRolled_${n.id}`]) continue;
    d.player.flags[`secretsRolled_${n.id}`] = true;
    if (next() < 0.5) list.push({ id: nextId(d, 'sec'), owner: n.id, type: SECRET_TYPES[Math.floor(next() * SECRET_TYPES.length)].id, known: false, knownBy: [], exposed: false, week: d.week });
  }
  if (!d.player.flags['secretsRolledPlayer']) {
    d.player.flags['secretsRolledPlayer'] = true;
    if (next() < 0.4) {
      const mild = SECRET_TYPES.filter(s => s.gravity === 1);
      list.push({ id: nextId(d, 'sec'), owner: 'player', type: mild[Math.floor(next() * mild.length)].id, known: true, knownBy: [], exposed: false, week: d.week });
    }
  }
}

export const secretsOf = (d: GameState, owner: string) => secrets(d).filter(s => s.owner === owner && !s.exposed);
export const knownSecretsOf = (d: GameState, npcId: string) => secretsOf(d, npcId).filter(s => s.known);
export const playerSecrets = (d: GameState) => secretsOf(d, 'player');

/** Découvrir un secret d'une personnalité (ou d'une personne au hasard) */
export function discoverSecret(d: GameState, rng: Rng, npcId?: string): string | null {
  const pool = secrets(d).filter(s => s.owner !== 'player' && !s.known && !s.exposed && (!npcId || s.owner === npcId) && d.npcs.some(n => n.id === s.owner));
  if (!pool.length) return null;
  const s = rng.pick(pool);
  s.known = true;
  const npc = d.npcs.find(n => n.id === s.owner)!;
  // Compatible avec le chantage existant : un secret connu vaut un dossier
  d.player.flags[`kompromat_${npc.id}`] = Number(d.player.flags[`kompromat_${npc.id}`] ?? 0) + 1;
  const def = SECRET_BY_ID.get(s.type)!;
  pushNews(d, 'systeme', 'neutral', `Secret découvert : ${npc.name}`, `${def.icon} ${def.label} : ${def.text}. À vous de voir : faire chanter, dénoncer… ou garder pour plus tard.`);
  return npc.name;
}

/** Un secret à vous, nouveau (un chèque accepté, une liaison…) */
export function addPlayerSecret(d: GameState, type: string): void {
  if (playerSecrets(d).some(s => s.type === type)) return;
  secrets(d).push({ id: nextId(d, 'sec'), owner: 'player', type, known: true, knownBy: [], exposed: false, week: d.week });
}

/* ── Leviers ───────────────────────────────────────────────── */

export function hooks(d: GameState): Hook[] {
  return (d.hooks ??= []).filter(h => d.npcs.some(n => n.id === h.npcId));
}

export function hookOn(d: GameState, npcId: string): Hook | undefined {
  return hooks(d).find(h => h.npcId === npcId);
}

export function grantHook(d: GameState, npcId: string, strength: Hook['strength'], reason: string): string[] {
  const list = (d.hooks ??= []);
  const cur = list.find(h => h.npcId === npcId);
  const npc = d.npcs.find(n => n.id === npcId);
  if (!npc) return [];
  if (cur) { if (strength === 'fort') cur.strength = 'fort'; cur.reason = reason; cur.week = d.week; }
  else list.push({ npcId, strength, reason, week: d.week });
  return [`Levier ${strength} sur ${npc.name}`];
}

export function hookReady(d: GameState, h: Hook): boolean {
  return h.strength === 'faible' ? !h.usedWeek : !h.usedWeek || d.week - h.usedWeek >= 6;
}

export type HookUse = 'soutien' | 'fonds' | 'retrait' | 'secret';

export const HOOK_USES: { id: HookUse; label: string; hint: string; strong?: boolean }[] = [
  { id: 'soutien', label: 'Exiger son soutien', hint: 'Capital politique, voix sur vos textes, ses amis suivent.' },
  { id: 'fonds', label: 'Lui faire financer votre campagne', hint: '8 000 € sur le compte de campagne.' },
  { id: 'secret', label: 'Lui faire livrer un secret', hint: 'Il ou elle vous révèle ce qu’il sait d’un autre.' },
  { id: 'retrait', label: 'Exiger qu’il ou elle se retire', hint: 'Levier fort seulement : votre rival quitte la course.', strong: true },
];

/** Utiliser un levier */
export function useHook(d: GameState, npcId: string, use: HookUse, rng: Rng): string[] {
  const h = hookOn(d, npcId);
  const npc = d.npcs.find(n => n.id === npcId);
  if (!h || !npc || !hookReady(d, h)) return [];
  if (use === 'retrait' && h.strength !== 'fort') return [];
  h.usedWeek = d.week;
  const out: string[] = [];
  let effects: Effect[] = [];
  switch (use) {
    case 'soutien': effects = [{ kind: 'stat', stat: 'politicalCapital', delta: 12 }, { kind: 'flagAdd', key: 'billSupport', delta: 6 }, { kind: 'faction', factionId: '*', delta: 2 }]; break;
    case 'fonds': effects = [{ kind: 'funds', account: 'campaign', delta: 8000 }, { kind: 'exposure', delta: 2 }]; break;
    case 'secret': { const who = discoverSecret(d, rng); out.push(who ? `Secret livré sur ${who}` : 'Il ou elle ne sait rien d’intéressant'); break; }
    case 'retrait':
      npc.isRival = false; npc.influence = clamp(npc.influence - 20); npc.popularity = clamp(npc.popularity - 10);
      out.push(`${npc.name} se met en retrait`);
      d.player.dread = clamp((d.player.dread ?? 0) + 6);
      break;
  }
  out.push(...applyEffects(d, effects, { reason: 'Vous a forcé la main' }, rng));
  // Être tenu ne rend pas aimable
  const before = npc.relationToPlayer;
  npc.relationToPlayer = clamp(npc.relationToPlayer - (h.strength === 'fort' ? 8 : 4), -100, 100);
  recordOpinion(d, npc, npc.relationToPlayer - before, 'Vous a forcé la main');
  if (h.strength === 'faible') d.hooks = (d.hooks ?? []).filter(x => x !== h);
  pushNews(d, 'systeme', 'neutral', `Levier utilisé : ${npc.name}`, out.join(' · '));
  return out;
}

/* ── Chantage et dénonciation ─────────────────────────────── */

/** Faire chanter avec un secret connu : levier fort, crainte, rancune */
export function blackmail(d: GameState, secretId: string, rng: Rng): string[] {
  const s = secrets(d).find(x => x.id === secretId && x.known && !x.exposed);
  const npc = s && d.npcs.find(n => n.id === s.owner);
  if (!s || !npc) return [];
  const def = SECRET_BY_ID.get(s.type)!;
  const out = grantHook(d, npc.id, 'fort', `Vous connaissez son secret : ${def.label.toLowerCase()}`);
  d.player.dread = clamp((d.player.dread ?? 0) + 4 + def.gravity * 2);
  // Sous charte éthique, le chantage est un parjure
  if (decisionActive(d, 'charte')) applyEffects(d, [{ kind: 'edict', id: 'charte', op: 'violate' }], {}, rng);
  const before = npc.relationToPlayer;
  npc.relationToPlayer = clamp(npc.relationToPlayer - 25, -100, 100);
  recordOpinion(d, npc, npc.relationToPlayer - before, 'Vous le ou la faites chanter');
  engrave(d, npc, 'Votre chantage', -25);
  out.push(...applyEffects(d, [{ kind: 'exposure', delta: 2 + def.gravity }, { kind: 'stat', stat: 'stress', delta: 3 }], {}, rng));
  // Un secret de chantage peut se retourner : il ou elle connaît désormais un des vôtres
  const mine = playerSecrets(d).find(x => !x.knownBy.includes(npc.id));
  if (mine && rng.chance(0.25)) mine.knownBy.push(npc.id);
  pushNews(d, 'scandale', 'neutral', `${npc.name} est à votre merci`, `Un rendez-vous discret, une phrase : « Je sais, pour ${def.text}. » Désormais, il ou elle vous obéit.`);
  return out;
}

/** Dénoncer un secret : la cible chute, vous gagnez en crainte et parfois en crédibilité */
export function expose(d: GameState, secretId: string, rng: Rng): string[] {
  const s = secrets(d).find(x => x.id === secretId && x.known && !x.exposed);
  const npc = s && d.npcs.find(n => n.id === s.owner);
  if (!s || !npc) return [];
  s.exposed = true;
  const def = SECRET_BY_ID.get(s.type)!;
  npc.popularity = clamp(npc.popularity - 6 * def.gravity);
  npc.influence = clamp(npc.influence - 4 * def.gravity);
  const before = npc.relationToPlayer;
  npc.relationToPlayer = clamp(npc.relationToPlayer - 40, -100, 100);
  recordOpinion(d, npc, npc.relationToPlayer - before, 'Vous avez révélé son secret');
  engrave(d, npc, 'Vous avez révélé son secret au grand jour', -40);
  d.player.dread = clamp((d.player.dread ?? 0) + 3 + def.gravity * 3);
  d.hooks = (d.hooks ?? []).filter(h => h.npcId !== npc.id);
  const out = applyEffects(d, [{ kind: 'stat', stat: 'credibility', delta: def.gravity >= 2 ? 2 : -1 }, { kind: 'renown', delta: 5 * def.gravity }], {}, rng);
  pushNews(d, 'scandale', 'negative', `Révélation : ${npc.name}`, `${def.icon} ${def.label} — ${def.text}. La presse s’en empare.`);
  if (def.gravity === 3 && rng.chance(0.4)) {
    npc.rankId = npc.rankId === 'chef_parti' ? 'depute' : npc.rankId;
    out.push(`${npc.name} doit démissionner de ses fonctions`);
  }
  return out;
}

/* ── Vos secrets entre de mauvaises mains ─────────────────── */

/** Chaque mois : on enquête sur vous ; une personnalité qui sait peut vous faire chanter */
export function monthlySecrets(d: GameState, rng: Rng): void {
  ensureSecrets(d);
  for (const s of playerSecrets(d)) {
    // Les rivaux fouillent
    const rival = d.npcs.find(n => n.relationToPlayer < -30 && !s.knownBy.includes(n.id) && rng.chance(0.03 + n.aggressiveness / 2000));
    if (rival) s.knownBy.push(rival.id);
  }
  // Un rival qui sait vous fait chanter
  const threatened = playerSecrets(d).find(s => s.knownBy.length);
  if (threatened && rng.chance(0.18) && !d.pendingDecisions.some(x => x.tag === 'secret_chantage')) {
    const npc = d.npcs.find(n => n.id === threatened.knownBy[0]);
    if (npc) d.pendingDecisions.push(blackmailDecision(d, npc, threatened));
  }
}

function blackmailDecision(d: GameState, npc: Npc, s: Secret): Decision {
  const def = SECRET_BY_ID.get(s.type)!;
  return {
    id: nextId(d, 'dec'), tag: 'secret_chantage', week: d.week, deadlineWeek: d.week + 1, source: 'evenement',
    title: `${npc.name} connaît votre secret`,
    context: `Un SMS : « ${def.label}. Je sais tout. Vous allez m’aider, n’est-ce pas ? » ${npc.name} exige votre soutien au prochain congrès.`,
    choices: [
      { id: 'ceder', label: 'Céder à ses exigences', effects: [{ kind: 'stat', stat: 'politicalCapital', delta: -15 }, { kind: 'npcRelation', npcId: npc.id, delta: 10, reason: 'Vous avez cédé à son chantage' }, { kind: 'stat', stat: 'stress', delta: 6 }],
        outcome: 'Vous cédez. Pour cette fois.' },
      { id: 'avouer', label: 'Tout avouer publiquement avant lui', effects: [{ kind: 'exposure', delta: 4 * def.gravity }, { kind: 'stat', stat: 'credibility', delta: def.gravity >= 2 ? -6 : 2 }, { kind: 'secret', owner: 'player', reveal: true, type: s.type }],
        outcome: 'Vous prenez les devants. Le secret n’en est plus un, et son pouvoir s’évanouit.' },
      { id: 'contre', label: 'Contre-attaquer : « Je sais des choses sur vous aussi »', effects: [{ kind: 'dread', delta: 5 }, { kind: 'npcRelation', npcId: npc.id, delta: -15, reason: 'Vous l’avez menacé·e' }],
        outcome: 'Un silence au bout du fil. Puis : « Restons-en là. »',
        risk: { baseChance: knownSecretsOf(d, npc.id).length ? 0.1 : 0.6, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [{ kind: 'exposure', delta: 8 * def.gravity }, { kind: 'stat', stat: 'credibility', delta: -4 * def.gravity }, { kind: 'secret', owner: 'player', reveal: true, type: s.type }], failureNews: 'Il n’avait pas peur : votre secret fait la une.' } },
    ],
  };
}

/** Effet « secret » : en découvrir un, ou rendre public un des vôtres */
export function adjustSecret(d: GameState, e: Extract<Effect, { kind: 'secret' }>, rng: Rng): string[] {
  if (e.owner === 'player' && e.reveal) {
    const s = playerSecrets(d).find(x => !e.type || x.type === e.type);
    if (s) { s.exposed = true; return ['Votre secret est public']; }
    return [];
  }
  if (e.owner === 'player' && e.type) { addPlayerSecret(d, e.type); return ['Un secret de plus à garder']; }
  const who = discoverSecret(d, rng, e.owner);
  return who ? [`Secret découvert : ${who}`] : [];
}

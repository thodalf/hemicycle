import { DebateMove, GameState, Npc, NpcTrait, StatKey } from '../models/game.models';
import { APTITUDE_WEIGHT, BIRTH_APTITUDES, TEMPERAMENTS, TRAITS, TraitDef, TraitId, traitLabel } from '../data/traits';
import { rankOrder } from '../data/ranks';
import { pushNews } from './effects';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Traits de personnage : tirés à la naissance, acquis en cours
 *  de vie, jamais retirés. Ils modulent les gains et les pertes,
 *  le sang-froid et la force des arguments en débat, l'appren-
 *  tissage des dossiers, les amitiés et les rancunes.
 * ============================================================ */

const conflicts = (list: TraitId[], id: TraitId) => list.includes(id) || list.some(t => TRAITS[t].opposite === id || TRAITS[id].opposite === t);

function weightedPick(pool: TraitId[], rng: Rng): TraitId {
  const total = pool.reduce((s, t) => s + (APTITUDE_WEIGHT[t] ?? 1), 0);
  let roll = rng.next() * total;
  return pool.find(t => (roll -= APTITUDE_WEIGHT[t] ?? 1) < 0) ?? pool[0];
}

/** Tirage à la naissance : 0 à 2 aptitudes, 2 ou 3 traits de tempérament */
export function rollBirthTraits(rng: Rng, seedTraits: TraitId[] = []): TraitId[] {
  const out: TraitId[] = [...seedTraits];
  const aptitudes = rng.chance(0.2) ? 0 : rng.chance(0.25) ? 2 : 1;
  for (let i = 0; i < aptitudes; i++) {
    const pool = BIRTH_APTITUDES.filter(t => !conflicts(out, t));
    if (pool.length) out.push(weightedPick(pool, rng));
  }
  const temper = rng.chance(0.35) ? 3 : 2;
  while (out.filter(t => TRAITS[t].kind === 'temperament').length < temper) {
    const pool = TEMPERAMENTS.filter(t => !conflicts(out, t));
    if (!pool.length) break;
    out.push(rng.pick(pool));
  }
  return out;
}

/** Les traits politiques des PNJ orientent leur tempérament */
const FROM_NPC: Record<NpcTrait, TraitId> = {
  integre: 'honnete', sulfureux: 'menteur', carrieriste: 'ambitieux', mediatique: 'photogenique', ideologue: 'idealiste', manoeuvrier: 'cynique',
};

export function npcTraits(n: Npc): TraitId[] {
  return (n.persona ?? []) as TraitId[];
}

/** Parties anciennes et nouveaux venus : chacun reçoit ses traits de naissance */
export function ensureTraits(d: GameState, rng: Rng): void {
  if (!d.player.traits) {
    d.player.traits = rollBirthTraits(rng);
    const list = (d.player.traits as TraitId[]).map(t => `${TRAITS[t].icon} ${traitLabel(t, d.player.gender)}`).join(' · ');
    pushNews(d, 'actu', 'neutral', 'Votre caractère', `De naissance : ${list}. Ces traits ne changeront jamais ; d’autres viendront avec les épreuves.`);
  }
  for (const n of d.npcs) {
    if (n.persona) continue;
    const seed = [...new Set(n.traits.map(t => FROM_NPC[t]))].filter(Boolean).slice(0, 2);
    const clean: TraitId[] = [];
    for (const t of seed) if (!conflicts(clean, t)) clean.push(t);
    n.persona = rollBirthTraits(rng, clean);
  }
}

export function traitsOf(d: GameState): TraitId[] {
  return (d.player.traits ?? []) as TraitId[];
}

export function hasTrait(d: GameState, id: TraitId): boolean {
  return traitsOf(d).includes(id);
}

/** Acquérir un trait : définitif. Impossible s'il contredit un trait déjà là. */
export function gainTrait(d: GameState, id: TraitId, why?: string): string[] {
  const list = traitsOf(d);
  if (!TRAITS[id] || conflicts(list, id)) return [];
  d.player.traits = [...list, id];
  const label = traitLabel(id, d.player.gender);
  pushNews(d, 'actu', TRAITS[id].tone === 'bad' ? 'negative' : 'positive', `Nouveau trait : ${TRAITS[id].icon} ${label}`, why ?? TRAITS[id].desc);
  return [`Nouveau trait : ${label}`];
}

function defs(d: GameState): TraitDef[] {
  return traitsOf(d).map(t => TRAITS[t]).filter(Boolean);
}

/** Multiplicateur d'une variation de stat selon les traits */
export function statTraitMult(d: GameState, stat: StatKey, delta: number): number {
  let m = 1;
  const up = delta > 0;
  for (const t of defs(d)) {
    const v = up ? t.mods.gain?.[stat] : t.mods.loss?.[stat];
    if (v) m *= v;
  }
  return m;
}

const product = (d: GameState, pick: (t: TraitDef) => number | undefined) => defs(d).reduce((m, t) => m * (pick(t) ?? 1), 1);

export const exposureTraitMult = (d: GameState) => product(d, t => t.mods.exposure);
export const masteryTraitMult = (d: GameState) => product(d, t => t.mods.mastery);
export const relationTraitMult = (d: GameState, delta: number) => product(d, t => (delta > 0 ? t.mods.relationUp : t.mods.relationDown));
export const debateTraitMult = (d: GameState, move: DebateMove) => product(d, t => t.mods.debate?.[move]);
export const composureTraitBonus = (d: GameState) => defs(d).reduce((s, t) => s + (t.mods.composure ?? 0), 0);
export const npcLifeBonus = (n: Npc) => npcTraits(n).reduce((s, t) => s + (TRAITS[t]?.mods.life ?? 0), 0);

/** Rancunes et amitiés des PNJ : leurs propres traits pèsent aussi */
export function npcRelationMult(n: Npc, delta: number): number {
  return npcTraits(n).reduce((m, t) => m * ((delta > 0 ? TRAITS[t]?.mods.relationUp : TRAITS[t]?.mods.relationDown) ?? 1), 1);
}

/** Chaque mois : effets passifs, et les traits qui s'acquièrent avec le temps */
export function monthlyTraits(d: GameState, rng: Rng): void {
  if (d.status !== 'en_cours') return;
  ensureTraits(d, rng);
  const p = d.player;
  for (const t of defs(d)) {
    for (const [k, v] of Object.entries(t.mods.monthly ?? {})) {
      if (k === 'health') p.health = clamp(p.health + v);
      else p.stats[k as StatKey] = clamp(p.stats[k as StatKey] + v);
    }
  }
  const f = p.flags;
  const bump = (key: string, on: boolean) => { f[key] = on ? Number(f[key] ?? 0) + 1 : 0; return Number(f[key]); };
  // Les épreuves et les gloires qui marquent à vie
  if (p.age >= 62) gainTrait(d, 'sage', 'Les cheveux ont blanchi, la voix s’est posée : on vient chercher vos conseils.');
  if (bump('trait_stressMonths', p.stats.stress >= 85) >= 4) gainTrait(d, 'insomniaque', 'Quatre mois de stress extrême : vous ne dormez plus que quatre heures par nuit.');
  if (bump('trait_energyMonths', p.stats.energy >= 70 && rankOrder(p.rankId) >= 3) >= 24) gainTrait(d, 'increvable', 'Deux ans de rythme infernal sans faiblir : votre énergie devient légendaire.');
  if (Number(f['debatesWon'] ?? 0) >= 5) gainTrait(d, 'tribun', 'Cinq débats gagnés : les plateaux télé vous redoutent.');
  if (['president', 'premier_ministre', 'roi'].includes(p.rankId)) gainTrait(d, 'homme_etat', 'Diriger le pays vous a donné une stature à part.');
  if (d.week >= 96 && !f['founder']) gainTrait(d, 'pilier', 'Huit ans de fidélité au parti : les militants vous considèrent comme un pilier.');
  if ((d.laws ?? []).length >= 5) gainTrait(d, 'legislateur', 'Cinq lois portent votre empreinte.');
  if (p.scandalExposure >= 85) gainTrait(d, 'entache', 'Les affaires se sont accumulées : le soupçon ne vous quittera plus.');
  if (d.crises?.loto) gainTrait(d, 'chanceux', '28 millions au Loto : on dit que la chance vous suit.');
  if (d.kingdom) gainTrait(d, 'ancien_souverain', 'Vous avez porté la couronne de France.');
  if (Number(f['langues'] ?? 0) >= 3) gainTrait(d, 'polyglotte', 'Trois langues de plus : vous parlez aux dirigeants étrangers sans interprète.');
  if (Number(f['deplacements'] ?? 0) >= 6) gainTrait(d, 'globe_trotteur', 'Six grands déplacements : votre valise ne se défait plus.');
  if (Number(f['perfectTrips'] ?? 0) >= 3) gainTrait(d, 'ponctuel', 'Trois trajets parfaits : on règle sa montre sur vous.');
  if (Number(f['customLaws'] ?? 0) >= 3) gainTrait(d, 'reformateur', 'Trois lois de votre plume adoptées.');
  if (d.elections.filter(e => e.result).length >= 5) gainTrait(d, 'briscard', 'Cinq campagnes : vous avez tout vu.');
  if (bump('trait_lowPop', p.stats.popularity < 10) >= 6) gainTrait(d, 'mal_aime', 'Six mois sous les 10 de popularité : l’étiquette vous colle.');
  if (bump('trait_highPop', p.stats.popularity >= 80) >= 6) gainTrait(d, 'idole', 'Six mois au sommet : vous êtes devenu·e une idole.');
  if (Number(f['galas'] ?? 0) >= 5) gainTrait(d, 'mondain', 'Cinq galas, cent dîners : le Tout-Paris vous reçoit.');
  if (d.milestones.some(m => m.week === d.week && /Survivant·e d’un attentat/.test(m.title))) {
    gainTrait(d, 'survivant', 'Vous avez survécu à une tentative d’assassinat.');
    if (rng.chance(0.6)) gainTrait(d, 'balafre', 'Une cicatrice vous rappellera ce jour pour toujours.');
  }
}

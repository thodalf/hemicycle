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
  // Les compteurs avancent chaque mois, même quand un trait ne peut pas encore tomber
  const stress = bump('trait_stressMonths', p.stats.stress >= 85);
  const energy = bump('trait_energyMonths', p.stats.energy >= 70 && rankOrder(p.rankId) >= 3);
  const lowPop = bump('trait_lowPop', p.stats.popularity < 10);
  const highPop = bump('trait_highPop', p.stats.popularity >= 80);
  const exposed = bump('trait_exposed', p.scandalExposure >= 85);
  if (['president', 'premier_ministre', 'roi'].includes(p.rankId)) f['trait_statesMonths'] = Number(f['trait_statesMonths'] ?? 0) + 1;
  // Une vie se construit lentement : pas plus d'un trait acquis tous les deux ans,
  // et même quand tout est réuni, il faut que l'occasion se présente (une chance sur six par mois)
  if (d.week - Number(f['lastTraitWeek'] ?? -999) < 24 || !rng.chance(1 / 6)) return;
  const n = (k: string) => Number(f[k] ?? 0);
  const candidates: [TraitId, boolean, string][] = [
    ['sage', p.age >= 66, 'Les cheveux ont blanchi, la voix s’est posée : on vient chercher vos conseils.'],
    ['insomniaque', stress >= 9, 'Neuf mois de stress extrême : vous ne dormez plus que quatre heures par nuit.'],
    ['increvable', energy >= 48, 'Quatre ans de rythme infernal sans faiblir : votre énergie devient légendaire.'],
    ['tribun', n('debatesWon') >= 15, 'Quinze débats gagnés : les plateaux télé vous redoutent.'],
    ['homme_etat', n('trait_statesMonths') >= 24, 'Deux ans à diriger le pays vous ont donné une stature à part.'],
    ['pilier', d.week >= 180 && !d.party.founder, 'Quinze ans de fidélité au parti : les militants vous considèrent comme un pilier.'],
    ['legislateur', (d.laws ?? []).length >= 12, 'Douze lois portent votre empreinte.'],
    ['entache', exposed >= 3, 'Les affaires se sont accumulées : le soupçon ne vous quittera plus.'],
    ['chanceux', !!d.crises?.loto, '28 millions au Loto : on dit que la chance vous suit.'],
    ['erudit', n('livres') >= 2, 'Deux livres publiés : on vous lit, on vous cite.'],
    ['polyglotte', n('langues') >= 8, 'Huit sessions de cours : vous parlez aux dirigeants étrangers sans interprète.'],
    ['globe_trotteur', n('deplacements') >= 20, 'Vingt grands déplacements : votre valise ne se défait plus.'],
    ['ponctuel', n('perfectTrips') >= 8, 'Huit trajets parfaits : on règle sa montre sur vous.'],
    ['reformateur', n('customLaws') >= 6, 'Six lois de votre plume adoptées.'],
    ['briscard', d.elections.filter(e => e.result).length >= 10, 'Dix campagnes : vous avez tout vu.'],
    ['mal_aime', lowPop >= 12, 'Un an sous les 10 de popularité : l’étiquette vous colle.'],
    ['idole', highPop >= 12, 'Un an au sommet des sondages : vous êtes devenu·e une idole.'],
    ['mondain', n('galas') >= 15, 'Quinze galas, cent dîners : le Tout-Paris vous reçoit.'],
  ];
  const ready = candidates.filter(([id, ok]) => ok && !conflicts(traitsOf(d), id));
  if (!ready.length) return;
  const [id, , why] = rng.pick(ready);
  if (gainTrait(d, id, why).length) f['lastTraitWeek'] = d.week;
}

/** Les traits acquis en chemin : progression vers chacun, pour l'interface */
export function traitProgress(d: GameState): { id: TraitId; pct: number; hint: string }[] {
  const f = d.player.flags;
  const n = (k: string) => Number(f[k] ?? 0);
  const rows: [TraitId, number, string][] = [
    ['tribun', n('debatesWon') / 15, `${n('debatesWon')} / 15 débats gagnés`],
    ['polyglotte', n('langues') / 8, `${n('langues')} / 8 sessions de langue`],
    ['globe_trotteur', n('deplacements') / 20, `${n('deplacements')} / 20 déplacements`],
    ['ponctuel', n('perfectTrips') / 8, `${n('perfectTrips')} / 8 trajets parfaits`],
    ['reformateur', n('customLaws') / 6, `${n('customLaws')} / 6 lois sur mesure adoptées`],
    ['legislateur', (d.laws ?? []).length / 12, `${(d.laws ?? []).length} / 12 lois`],
    ['briscard', d.elections.filter(e => e.result).length / 10, `${d.elections.filter(e => e.result).length} / 10 élections`],
    ['mondain', n('galas') / 15, `${n('galas')} / 15 dîners et galas`],
    ['erudit', n('livres') / 2, `${n('livres')} / 2 livres`],
    ['homme_etat', n('trait_statesMonths') / 24, `${n('trait_statesMonths')} / 24 mois à la tête du pays`],
    ['pilier', d.party.founder ? 0 : d.week / 180, `${Math.floor(d.week / 12)} / 15 ans au parti`],
    ['sage', (d.player.age - 30) / 36, `${Math.floor(d.player.age)} / 66 ans`],
  ];
  return rows.filter(([id]) => !hasTrait(d, id) && !conflicts(traitsOf(d), id))
    .map(([id, p, hint]) => ({ id, pct: Math.round(clamp(p * 100)), hint }))
    .filter(r => r.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 4);
}

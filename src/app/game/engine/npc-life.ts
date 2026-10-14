import { GameState, Npc, NpcTrait } from '../models/game.models';
import { uniqueName } from '../data/names';
import { pushNews } from './effects';
import { Rng } from './rng';
import { npcLifeBonus } from './traits';
import { forgetNpc } from './memories';

/* ============================================================
 *  La vie des personnalités : elles vieillissent, partent à la
 *  retraite, se reconvertissent dans le privé, sont appelées à
 *  l'international, tombent malades, sont rattrapées par la
 *  justice… ou meurent. Un·e successeur·e reprend aussitôt la
 *  place (même parti, même rang), avec tout à prouver.
 * ============================================================ */

export type NpcFate = 'mort' | 'retraite' | 'prive' | 'international' | 'maladie' | 'ineligible';

export interface NpcLogEntry { week: number; npcId: string; name: string; age: number; fate: NpcFate; successor: string; relation: number; partyId: string }

export const FATE_LABELS: Record<NpcFate, string> = {
  mort: 'Décès', retraite: 'Retraite', prive: 'Reconversion dans le privé', international: 'Poste international', maladie: 'Retrait pour raisons de santé', ineligible: 'Inéligibilité',
};

function hash(t: string): number {
  let h = 7;
  for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) % 1000003;
  return h;
}

/** Âge initial, stable pour chaque personnalité */
function initialAge(n: Npc): number {
  const h = hash(n.id);
  return n.rankId === 'chef_parti' ? 50 + (h % 19) : n.rankId === 'conseiller_municipal' ? 29 + (h % 26) : 38 + (h % 27);
}

export function ensureAge(n: Npc): number {
  n.age ??= initialAge(n);
  return n.age;
}

/** L'âge affiché (sans modifier l'état) */
export function npcAge(n: Npc): number {
  return Math.floor(n.age ?? initialAge(n));
}

/** Probabilités mensuelles de chaque sort, selon l'âge et le profil */
function fateOdds(n: Npc): [NpcFate, number][] {
  // Une constitution robuste repousse l'échéance ; une santé fragile la rapproche
  const a = ensureAge(n) - npcLifeBonus(n);
  const death = a < 50 ? 0.0002 : a < 65 ? 0.0008 : a < 75 ? 0.003 : a < 85 ? 0.009 : 0.025;
  const retire = a >= 66 ? 0.025 + (a - 66) * 0.004 : 0;
  return [
    ['mort', death],
    ['retraite', retire],
    ['prive', a < 62 ? 0.0012 : 0],
    ['international', n.influence >= 50 ? 0.0006 : 0],
    ['maladie', a >= 50 ? 0.0006 : 0.0002],
    ['ineligible', n.traits.includes('sulfureux') ? 0.0015 : 0.0002],
  ];
}

/** Le président en exercice reste à l'abri : une succession à l'Élysée serait une autre histoire */
function protectedNpc(d: GameState, n: Npc): boolean {
  return d.presidential.incumbentId === n.id;
}

const TRAITS: NpcTrait[] = ['carrieriste', 'ideologue', 'mediatique', 'manoeuvrier', 'integre', 'sulfureux'];

/** Remplace une personnalité par sa ou son successeur, sans casser les références */
export function succeed(d: GameState, n: Npc, rng: Rng): string {
  const old = n.name;
  const name = uniqueName(() => rng.next(), d.npcs.map(x => x.name));
  n.name = name;
  n.age = 31 + rng.int(0, 17);
  n.popularity = Math.round(n.popularity * 0.5);
  n.influence = Math.round(n.influence * 0.6);
  n.relationToPlayer = 0;
  n.traits = [rng.pick(TRAITS)];
  n.persona = undefined; // nouveaux traits de naissance au prochain passage
  forgetNpc(d, n.id);
  n.ambition = 50 + rng.int(0, 35);
  // Les noms recopiés ailleurs
  const pr = d.presidency;
  if (pr?.pmNpcId === n.id) pr.primeMinister = name;
  if (pr?.cabinet) for (const k of Object.keys(pr.cabinet) as (keyof typeof pr.cabinet)[]) if (pr.cabinet[k] === old) pr.cabinet[k] = name;
  if (d.cabinetPicks) for (const k of Object.keys(d.cabinetPicks.picks) as (keyof typeof d.cabinetPicks.picks)[]) if (d.cabinetPicks.picks[k] === old) d.cabinetPicks.picks[k] = name;
  // Les complots contre elle ou lui tombent ; ses complicités aussi
  if (d.schemes) {
    d.schemes = d.schemes.filter(s => s.targetId !== n.id);
    for (const s of d.schemes) if (s.allies) s.allies = s.allies.filter(a => a.npcId !== n.id);
  }
  delete d.player.flags[`kompromat_${n.id}`];
  return name;
}

const TEXTS: Record<NpcFate, (n: string, age: number, succ: string) => [string, string]> = {
  mort: (n, a, s) => [`Disparition de ${n}`, `${n} s’est éteint·e à ${a} ans. Toute la classe politique salue sa mémoire. ${s} reprend le flambeau.`],
  retraite: (n, a, s) => [`${n} prend sa retraite`, `À ${a} ans, ${n} quitte la vie politique : « Place aux jeunes. » ${s} lui succède.`],
  prive: (n, _a, s) => [`${n} part dans le privé`, `${n} rejoint la direction d’un grand groupe. « Pantouflage », dénoncent ses adversaires. ${s} prend sa place.`],
  international: (n, _a, s) => [`${n} appelé·e à l’international`, `${n} est nommé·e à la tête d’une grande organisation internationale. ${s} reprend ses fonctions en France.`],
  maladie: (n, _a, s) => [`${n} se retire pour raisons de santé`, `Dans une lettre émouvante, ${n} annonce se retirer pour se soigner. ${s} assure la relève.`],
  ineligible: (n, _a, s) => [`${n} déclaré·e inéligible`, `Condamné·e pour emploi fictif, ${n} doit quitter la vie publique pour cinq ans. ${s} hérite de la place.`],
};

/** Chaque mois : l'âge avance, et parfois le destin frappe */
export function monthlyNpcLife(d: GameState, rng: Rng): void {
  d.npcLog ??= [];
  let events = 0;
  for (const n of d.npcs) {
    ensureAge(n);
    n.age = (n.age ?? 40) + 1 / 12;
    if (events >= 1 || protectedNpc(d, n)) continue;
    for (const [fate, p] of fateOdds(n)) {
      if (!rng.chance(p)) continue;
      const name = n.name, age = Math.floor(n.age), relation = n.relationToPlayer;
      const succ = succeed(d, n, rng);
      const [title, body] = TEXTS[fate](name, age, succ);
      pushNews(d, 'actu', fate === 'mort' || fate === 'maladie' ? 'neutral' : fate === 'ineligible' ? 'negative' : 'neutral', title, body);
      d.npcLog.unshift({ week: d.week, npcId: n.id, name, age, fate, successor: succ, relation: Math.round(relation), partyId: n.partyId });
      if (d.npcLog.length > 40) d.npcLog.length = 40;
      events++;
      break;
    }
  }
}

/** Le dernier départ, s'il date de ce mois ou du précédent et n'a pas encore été commenté */
export function freshDeparture(d: GameState, fates: NpcFate[]): NpcLogEntry | null {
  const e = (d.npcLog ?? []).find(x => d.week - x.week <= 1 && fates.includes(x.fate));
  return e && !d.player.flags[`npcEv_${e.npcId}_${e.week}`] ? e : null;
}


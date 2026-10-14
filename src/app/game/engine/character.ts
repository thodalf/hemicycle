import { ActionDefinition, Decision, GameState } from '../models/game.models';
import { LIFESTYLE_BY_ID, PERK_BY_ID, RENOWN_TIERS, XP_PER_PERK, renownTier } from '../data/lifestyles';
import { TRAITS, TraitId } from '../data/traits';
import { gainTrait, hasTrait } from './traits';
import { applyEffects, pushNews } from './effects';
import { decisionActive } from '../data/great-decisions';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  La psychologie du personnage, à la manière de Crusader Kings :
 *  agir contre sa nature stresse ; trop de stress provoque une
 *  crise d'où naît un exutoire. Un style de vie se cultive mois
 *  après mois. La renommée s'accumule et se dépense ; la crainte
 *  fait taire les rivaux.
 * ============================================================ */

/* ── Le stress de la contradiction ─────────────────────────── */

/** Ce qui coûte à chaque tempérament (catégories d'actions, ou id d'action) */
const DISLIKES: Partial<Record<TraitId, { cats?: string[]; test?: (a: ActionDefinition) => boolean; why: string }>> = {
  timide: { cats: ['medias', 'terrain'], why: 'La foule et les caméras vous coûtent' },
  honnete: { cats: ['intrigue'], why: 'Comploter vous répugne' },
  idealiste: { cats: ['intrigue'], why: 'Ce n’est pas pour ça que vous faites de la politique' },
  loyal: { test: a => a.category === 'intrigue' && a.target === 'npc', why: 'Trahir, ce n’est pas vous' },
  paresseux: { test: a => (a.cost.energy ?? 0) >= 9, why: 'Tant d’efforts…' },
  avare: { test: a => (a.cost.money ?? 0) >= 1000, why: 'Dépenser autant vous fait mal' },
  ascete: { test: a => /gala|diner|dîner|apéro/i.test(a.label), why: 'Ces mondanités vous pèsent' },
  modeste: { test: a => /meeting|gala|tournée/i.test(a.label), why: 'Se mettre en avant vous gêne' },
  diplomate: { test: a => /attaque|clash|dénoncer|démolir/i.test(a.label + a.id), why: 'L’affrontement vous coûte' },
  calme: { test: a => /clash|attaque/i.test(a.id), why: 'Ce n’est pas votre style' },
};
/** Ce qui détend chaque tempérament */
const LIKES: Partial<Record<TraitId, { cats?: string[]; test?: (a: ActionDefinition) => boolean }>> = {
  ambitieux: { cats: ['parti', 'fonction', 'elysee'] },
  audacieux: { cats: ['medias'] },
  bon_vivant: { test: a => /gala|diner|dîner|apéro|repas/i.test(a.label) },
  curieux: { cats: ['dossiers'] },
  cynique: { cats: ['intrigue'] },
  genereux: { test: a => /don|aide|bénévol|solidar/i.test(a.label) },
  travailleur: { cats: ['dossiers', 'fonction'] },
};

/** Après chaque action : le stress de la contradiction, et l'expérience du style de vie */
export function onAction(d: GameState, a: ActionDefinition): void {
  const p = d.player;
  for (const t of (p.traits ?? []) as TraitId[]) {
    const dis = DISLIKES[t];
    if (dis && ((dis.cats?.includes(a.category)) || dis.test?.(a))) {
      p.stats.stress = clamp(p.stats.stress + 4);
      if (Math.random() < 0.15) pushNews(d, 'systeme', 'negative', `${TRAITS[t].icon} ${a.label} : contre votre nature`, `${dis.why}. Stress +4.`);
    }
    const like = LIKES[t];
    if (like && ((like.cats?.includes(a.category)) || like.test?.(a))) p.stats.stress = clamp(p.stats.stress - 2);
  }
  // Style de vie : les actions qui s'y rattachent comptent double
  const ls = p.lifestyle;
  if (ls) {
    const def = LIFESTYLE_BY_ID.get(ls.id);
    if (def?.categories.includes(a.category)) ls.xp += 8;
  }
}

/* ── Les crises de stress et leurs exutoires ──────────────── */

const COPING: { trait: TraitId; label: string; outcome: string }[] = [
  { trait: 'noctambule', label: 'Sortir toute la nuit, sans garde du corps', outcome: 'Un bar, puis un autre, puis l’aube sur les quais. Vous respirez.' },
  { trait: 'reclus', label: 'Couper le téléphone et s’enfermer trois jours', outcome: 'Trois jours seul·e. Personne ne sait où vous êtes. Ça fait du bien.' },
  { trait: 'irascible', label: 'Exploser : hurler sur l’équipe', outcome: 'Une colère homérique. Votre cheffe de cabinet pleure. Vous, vous allez mieux.' },
  { trait: 'journal_intime', label: 'Tout écrire, cette nuit, dans un carnet', outcome: 'Douze pages d’une traite. Les mots remettent de l’ordre.' },
  { trait: 'mystique', label: 'Partir en retraite dans une abbaye', outcome: 'Le silence des moines, les vêpres, le pain du monastère. La paix revient.' },
  { trait: 'sportif_compulsif', label: 'Courir jusqu’à l’épuisement', outcome: 'Vingt kilomètres sous la pluie. Le corps hurle, la tête se tait.' },
];

/** Chaque mois : crise de stress, expérience, renommée, crainte */
export function monthlyCharacter(d: GameState, rng: Rng): void {
  if (d.status !== 'en_cours') return;
  const p = d.player;
  // Crise : le stress au plus haut, au plus une fois par an
  if (p.stats.stress >= 85 && d.week - Number(p.flags['stressBreak'] ?? -99) >= 18 && !d.pendingDecisions.some(x => x.tag === 'crise_stress')) {
    p.flags['stressBreak'] = d.week;
    d.pendingDecisions.push(stressBreak(d, rng));
  }
  // Style de vie : de l'expérience chaque mois, un avantage par palier, un trait au bout
  const ls = p.lifestyle;
  if (ls) {
    ls.xp += 10;
    const def = LIFESTYLE_BY_ID.get(ls.id);
    const done = def ? perksIn(d, def.id) : 0;
    if (def && done < def.perks.length && ls.xp >= XP_PER_PERK) {
      ls.xp -= XP_PER_PERK;
      const perk = def.perks[done];
      ls.perks.push(perk.id);
      pushNews(d, 'systeme', 'positive', `${def.icon} ${def.label} : ${perk.label}`, perk.desc);
      if (done + 1 === def.perks.length) gainTrait(d, def.trait as TraitId, `Vous avez mené le style ${def.label} à son terme.`);
    }
    for (const id of ls.perks) {
      const m = PERK_BY_ID.get(id)?.monthly;
      if (m?.renown) p.renown = (p.renown ?? 0) + m.renown;
      if (m?.dread) p.dread = clamp((p.dread ?? 0) + m.dread);
    }
  }
  // Renommée : la notoriété se transforme lentement en légende
  const before = renownTier(p.renown ?? 0);
  p.renown = (p.renown ?? 0) + Math.max(0, (p.stats.popularity + p.stats.influence - 70) / 30);
  const after = renownTier(p.renown);
  if (after > before) pushNews(d, 'systeme', 'positive', `Renommée : ${RENOWN_TIERS[after].label}`, `${RENOWN_TIERS[after].icon} Votre nom compte désormais. De nouvelles actions d’éclat sont possibles.`);
  // La crainte s'estompe si on ne l'entretient pas
  p.dread = clamp((p.dread ?? 0) - (decisionActive(d, 'purge') ? 0.4 : 0.8));
}

function stressBreak(d: GameState, rng: Rng): Decision {
  const owned = new Set(d.player.traits ?? []);
  // Deux exutoires au plus : au-delà, on ne fait que serrer les dents
  const had = COPING.filter(c => owned.has(c.trait)).length;
  const pool = had >= 2 ? [] : COPING.filter(c => !owned.has(c.trait));
  const picks = [...pool].sort(() => rng.next() - 0.5).slice(0, 3);
  return {
    id: nextId(d, 'dec'), tag: 'crise_stress', week: d.week, deadlineWeek: d.week + 1, source: 'evenement',
    title: 'Vous craquez',
    context: 'Des semaines sans dormir, les mains qui tremblent, une colère sourde. Ce soir, quelque chose doit sortir. Ce que vous choisirez deviendra une habitude, pour toujours.',
    choices: [
      ...picks.map(c => ({ id: c.trait, label: c.label, hint: `Exutoire : ${TRAITS[c.trait].label}`, outcome: c.outcome,
        effects: [{ kind: 'trait' as const, trait: c.trait }, { kind: 'stat' as const, stat: 'stress' as const, delta: -35 }] })),
      { id: 'tenir', label: 'Serrer les dents et continuer', hint: 'Pas d’exutoire… pour l’instant', outcome: 'Vous tenez. Mais la santé trinque.',
        effects: [{ kind: 'stat', stat: 'stress', delta: -10 }, { kind: 'health', delta: -6 }] },
    ],
  };
}

/** Choisir (ou changer) de style de vie : on perd l'expérience en cours, jamais les avantages acquis */
export function chooseLifestyle(d: GameState, id: string): void {
  if (!LIFESTYLE_BY_ID.has(id)) return;
  const cur = d.player.lifestyle;
  if (cur?.id === id) return;
  d.player.lifestyle = { id, xp: 0, perks: [...(cur?.perks ?? [])] };
}

/** Avantages d'un style donné déjà acquis (pour reprendre l'arbre où on l'avait laissé) */
export function perksIn(d: GameState, id: string): number {
  const def = LIFESTYLE_BY_ID.get(id);
  return def ? def.perks.filter(p => d.player.lifestyle?.perks.includes(p.id)).length : 0;
}

export function stressLevel(stress: number): { level: number; label: string } {
  return stress >= 85 ? { level: 3, label: 'Au bord de la crise' } : stress >= 60 ? { level: 2, label: 'Très stressé·e' } : stress >= 35 ? { level: 1, label: 'Sous pression' } : { level: 0, label: 'Serein·e' };
}

export { hasTrait };

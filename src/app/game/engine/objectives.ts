import {
  ActionCategory, CATEGORY_LABELS, DOMAINS, DOMAIN_LABELS, GameState, Objective, ObjectiveKind,
  STAT_LABELS, StatKey,
} from '../models/game.models';
import { applyEffects, pushNews } from './effects';
import { Rng, nextId } from './rng';

/* ============================================================
 *  Objectifs à court terme : trois défis actifs, avec échéance
 *  et récompense. Ils donnent un cap mois après mois.
 * ============================================================ */

const MAX_ACTIVE = 3;

type Draft = Omit<Objective, 'id' | 'progress'>;

function generate(d: GameState, rng: Rng, exclude: Set<ObjectiveKind>): Draft | null {
  const w = d.week;
  const s = d.player.stats;
  const options: (() => Draft | null)[] = [];

  options.push(() => ({
      kind: 'debate_win', label: 'Remporter un débat', target: 1, deadlineWeek: w + 6,
      reward: [{ kind: 'skillPoints', delta: 1 }, { kind: 'stat', stat: 'politicalCapital', delta: 6 }],
      rewardLabel: '+1 point de compétence, +6 capital',
  }));
  options.push(() => {
    const stat = rng.pick<StatKey>(['popularity', 'influence', 'credibility']);
    const target = Math.min(95, Math.round(s[stat] + rng.int(7, 11)));
    if (target <= s[stat]) return null;
    return {
      kind: 'stat', param: stat, label: `Atteindre ${target} en ${STAT_LABELS[stat].toLowerCase()}`, target, deadlineWeek: w + 5,
      reward: [{ kind: 'stat', stat: 'politicalCapital', delta: 12 }, { kind: 'funds', account: 'personal', delta: 1500 }],
      rewardLabel: '+12 capital, +1 500 €',
    };
  });
  options.push(() => {
    const cat = rng.pick<ActionCategory>(['terrain', 'medias', 'dossiers', 'parti', 'reseau']);
    return {
      kind: 'category', param: cat, label: `Mener 3 actions « ${CATEGORY_LABELS[cat]} »`, target: 3, deadlineWeek: w + 3,
      reward: [{ kind: 'flag', key: 'bonusAp', value: 1 }, { kind: 'stat', stat: 'energy', delta: 15 }],
      rewardLabel: '+1 PA le mois suivant, +15 énergie',
    };
  });
  options.push(() => {
    const domain = rng.chance(0.5) ? d.agendaDomain : [...DOMAINS].sort((a, b) => d.player.dossiers[a].mastery - d.player.dossiers[b].mastery)[0];
    const target = Math.min(90, Math.round(d.player.dossiers[domain].mastery + 20));
    return {
      kind: 'dossier', param: domain, label: `Maîtriser le dossier ${DOMAIN_LABELS[domain]} (${target})`, target, deadlineWeek: w + 4,
      reward: [{ kind: 'skillPoints', delta: 1 }, { kind: 'stat', stat: 'credibility', delta: 3 }],
      rewardLabel: '+1 point de compétence, +3 crédibilité',
    };
  });
  options.push(() => {
    const pool = d.contacts.filter(c => c.trust < 60);
    if (!pool.length) return null;
    const c = rng.pick(pool);
    const target = Math.round(c.trust + 20);
    return {
      kind: 'contact', param: c.id, label: `Gagner la confiance de ${c.name.split(' (')[0]} (${target})`, target, deadlineWeek: w + 5,
      reward: [{ kind: 'contact', contactId: c.id, balance: 1 }, { kind: 'stat', stat: 'influence', delta: 3 }],
      rewardLabel: 'Il vous doit une faveur, +3 influence',
    };
  });

  const shuffled = options.map(make => ({ make, k: rng.next() })).sort((a, b) => a.k - b.k).map(x => x.make);
  for (const make of shuffled) {
    const draft = make();
    if (draft && !exclude.has(draft.kind)) return draft;
  }
  return null;
}

function currentValue(d: GameState, o: Objective): number | null {
  switch (o.kind) {
    case 'stat': return d.player.stats[o.param as StatKey];
    case 'dossier': return d.player.dossiers[o.param as keyof typeof d.player.dossiers].mastery;
    case 'faction': return d.party.factions.find(f => f.id === o.param)?.supportForPlayer ?? 0;
    case 'contact': return d.contacts.find(c => c.id === o.param)?.trust ?? 0;
    default: return null;
  }
}

/** Enregistre un événement ponctuel (débat gagné, action d'une catégorie) */
export function recordObjectiveEvent(d: GameState, kind: 'debate_win' | 'category', param?: string): void {
  for (const o of d.objectives) {
    if (o.kind === kind && (kind === 'debate_win' || o.param === param)) o.progress += 1;
  }
}

/** Met à jour les seuils, distribue les récompenses */
export function refreshObjectives(d: GameState, rng: Rng): void {
  for (const o of [...d.objectives]) {
    const value = currentValue(d, o);
    if (value !== null) o.progress = Math.round(value);
    if (o.progress >= o.target) {
      d.objectives = d.objectives.filter(x => x.id !== o.id);
      applyEffects(d, o.reward, {}, rng);
      if (rng.chance(0.5)) d.player.boosters += 1;
      pushNews(d, 'systeme', 'positive', `Objectif atteint : ${o.label}`, o.rewardLabel);
    }
  }
}

/** Fin de mois : objectifs expirés retirés, nouveaux objectifs proposés */
export function weeklyObjectives(d: GameState, rng: Rng): void {
  refreshObjectives(d, rng);
  for (const o of [...d.objectives]) {
    if (d.week > o.deadlineWeek) {
      d.objectives = d.objectives.filter(x => x.id !== o.id);
      pushNews(d, 'systeme', 'negative', `Objectif manqué : ${o.label}`);
    }
  }
  while (d.objectives.length < MAX_ACTIVE) {
    const draft = generate(d, rng, new Set(d.objectives.map(o => o.kind)));
    if (!draft) break;
    const value = currentValue(d, { ...draft, id: '', progress: 0 });
    d.objectives.push({ ...draft, id: nextId(d, 'obj'), progress: value === null ? 0 : Math.round(value) });
  }
}


import { Decision, Effect, GameState } from '../models/game.models';
import { ENEMIES, ENEMIES_BY_ID } from './war';
import { pushNews } from './effects';
import { addMilestone } from './life';
import { nextId } from './rng';

/* ============================================================
 *  Après une victoire : annexer le pays vaincu, en faire un
 *  protectorat, exiger des réparations ou offrir une paix
 *  magnanime. L'annexion agrandit la carte… et la rancœur.
 * ============================================================ */

export type AnnexMode = 'annex' | 'protectorat' | 'reparations' | 'magnanime' | 'liberer';

export function isAnnexed(d: GameState, id: string): boolean {
  return !!d.player.flags[`annexed_${id}`];
}

export function annexedEnemies(d: GameState) {
  return ENEMIES.filter(e => isAnnexed(d, e.id));
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress', delta: number): Effect => ({ kind: 'stat', stat, delta });

export function annexDecision(d: GameState, enemyId: string): Decision {
  const e = ENEMIES_BY_ID.get(enemyId)!;
  const a = (mode: AnnexMode): Effect => ({ kind: 'annex', enemyId, mode });
  return {
    id: nextId(d, 'dec'), tag: 'annexion', week: d.week, deadlineWeek: d.week + 1, source: 'carriere',
    title: `Que faire ${e.of} ?`,
    context: `${cap(e.the)} a capitulé. Le traité de paix se rédige à Versailles : à vous de dicter les conditions.`,
    choices: [
      { id: 'annex', label: `Annexer ${e.the}`, hint: 'Un territoire de plus… et des décennies de résistance', effects: [a('annex')],
        outcome: `Le drapeau tricolore flotte sur la capitale ${e.of}. Le monde entier condamne ; une partie du pays exulte.` },
      { id: 'protectorat', label: 'Imposer un protectorat', hint: 'Un gouvernement ami, sous tutelle', effects: [a('protectorat')],
        outcome: 'Un régime de transition, des conseillers français dans chaque ministère.' },
      { id: 'reparations', label: 'Exiger de lourdes réparations', hint: 'Des milliards pour reconstruire', effects: [a('reparations')],
        outcome: 'Le vaincu paiera, pendant vingt ans.' },
      { id: 'magnanime', label: 'Offrir une paix magnanime', hint: 'Le prestige des grands vainqueurs', effects: [a('magnanime')],
        outcome: 'Pas d’humiliation : le monde salue votre hauteur de vue.' },
    ],
  };
}

export function applyAnnex(d: GameState, x: Extract<Effect, { kind: 'annex' }>): Effect[] {
  const e = ENEMIES_BY_ID.get(x.enemyId);
  if (!e) return [];
  const h = (d.intl.hostile ??= {});
  switch (x.mode) {
    case 'annex':
      d.player.flags[`annexed_${e.id}`] = d.week;
      delete h[e.id];
      addMilestone(d, 'victoire', `L’annexion ${e.of}`, `${cap(e.the)} devient un territoire français. L’ONU condamne, les alliés s’inquiètent, les nationalistes jubilent.`);
      pushNews(d, 'actu', 'neutral', `${cap(e.the)} annexée par la France`, 'Sanctions internationales votées, manifestations dans les capitales européennes. Une résistance s’organise déjà.');
      return [
        st('popularity', 4), { kind: 'intl', prestige: -15, tension: 20 }, { kind: 'economy', growth: 0.3, deficit: 0.4 },
        { kind: 'segment', segment: 'retraites', delta: 3 }, { kind: 'segment', segment: 'jeunes', delta: -4 }, st('credibility', -3),
      ];
    case 'protectorat':
      h[e.id] = 25;
      d.player.flags[`protectorat_${e.id}`] = d.week;
      return [{ kind: 'intl', prestige: 5, tension: 5 }, { kind: 'economy', confidence: 2 }, st('influence', 3)];
    case 'reparations':
      h[e.id] = -40;
      return [{ kind: 'economy', deficit: -0.4, confidence: 2 }, { kind: 'intl', prestige: 5 }, st('credibility', 2)];
    case 'liberer':
      d.player.flags[`annexed_${e.id}`] = false;
      h[e.id] = 10;
      addMilestone(d, 'carriere', `L’indépendance rendue ${e.of.replace(/^de la |^du /, m => (m === 'du ' ? 'au ' : 'à la '))}`, 'Le drapeau tricolore est descendu, sous les applaudissements de l’ONU.');
      return [{ kind: 'intl', prestige: 10, tension: -10 }, st('popularity', -3), st('credibility', 2)];
    case 'magnanime':
      h[e.id] = 30;
      return [{ kind: 'intl', prestige: 12, tension: -10 }, st('credibility', 3), st('popularity', -1)];
  }
}

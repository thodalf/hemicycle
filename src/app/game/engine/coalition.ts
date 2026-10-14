import { Decision, DecisionChoice, Effect, GameState, PartyInfo } from '../models/game.models';
import { BASE_SEATS, SEATS } from '../data/bills';
import { pushNews } from './effects';
import { addMilestone } from './life';
import { Rng, clamp, nextId, frSigned } from './rng';

/* ============================================================
 *  Coalitions : à Matignon ou à l'Élysée, avec une majorité
 *  seulement relative, on négocie avec un parti voisin des
 *  ministères et un programme commun. Le partenaire apporte des
 *  sièges ; s'il se sent méprisé, il claque la porte.
 * ============================================================ */

/** Jauge de majorité du gouvernement (Matignon ou Élysée) */
export function governmentMajority(d: GameState): number | null {
  return d.government?.majority ?? d.presidency?.majority ?? null;
}

function shiftMajority(d: GameState, delta: number): void {
  if (d.government) d.government.majority = clamp(d.government.majority + delta);
  else if (d.presidency) d.presidency.majority = clamp(d.presidency.majority + delta);
}

export function canCoalesce(d: GameState): string | null {
  if (d.player.rankId !== 'premier_ministre' && !d.presidency) return 'Réservé à Matignon et à l’Élysée';
  if (d.presidency?.cohabitation) return 'En cohabitation, la majorité n’est pas la vôtre';
  if (d.coalition) return `Déjà en coalition avec ${d.coalition.name}`;
  const m = governmentMajority(d);
  if (m === null) return 'Aucun gouvernement à appuyer';
  if (m >= 50) return 'Vous avez déjà la majorité absolue';
  if (d.week - Number(d.player.flags['coalitionFail'] ?? -99) < 6) return 'Les partenaires se méfient : attendez quelques mois';
  return null;
}

/** Les partis voisins, du plus proche au plus éloigné */
export function coalitionPartners(d: GameState): PartyInfo[] {
  return d.otherParties.filter(p => (BASE_SEATS[p.id] ?? 0) > 0)
    .sort((a, b) => Math.abs(a.position - d.party.position) - Math.abs(b.position - d.party.position))
    .slice(0, 3);
}

/** Points de majorité qu'apporte un partenaire */
export function coalitionBonus(id: string): number {
  return clamp(Math.round(((BASE_SEATS[id] ?? 20) / SEATS) * 100 * 0.6), 5, 16);
}

export function coalitionDecision(d: GameState): Decision {
  const m = Math.round(governmentMajority(d) ?? 48);
  const choices: DecisionChoice[] = coalitionPartners(d).map(p => {
    const gap = Math.abs(p.position - d.party.position);
    return {
      id: `coal_${p.id}`,
      label: `Négocier avec ${p.name}`,
      hint: `+${coalitionBonus(p.id)} pts de majorité · ${gap < 30 ? 'un partenaire naturel' : gap < 60 ? 'des désaccords de fond' : 'le grand écart idéologique'}`,
      effects: [
        { kind: 'minigame', gameId: 'negociation_coalition', title: `Négocier une coalition avec ${p.name}`, reward: [{ kind: 'coalition', partyId: p.id }], penalty: [{ kind: 'flag', key: 'coalitionFail', value: d.week }, { kind: 'stat', stat: 'stress', delta: 4 }] },
        { kind: 'stat', stat: 'energy', delta: -5 },
      ] as Effect[],
      outcome: `Les négociateurs s’enferment à l’hôtel de Lassay. Combien de ministères céder à ${p.name} ?`,
    };
  });
  choices.push({
    id: 'seul', label: 'Gouverner sans coalition, texte par texte', hint: 'Des majorités de circonstance, à reconstruire à chaque vote',
    effects: [{ kind: 'stat', stat: 'politicalCapital', delta: 4 }, { kind: 'cohesion', delta: 3 }, { kind: 'flag', key: 'coalitionFail', value: d.week }],
    outcome: 'Vous gardez les mains libres. Chaque vote sera une bataille.',
  });
  return {
    id: nextId(d, 'dec'), tag: 'coalition', week: d.week, deadlineWeek: d.week + 1, source: 'carriere',
    title: 'Majorité relative : former une coalition ?',
    context: `Votre majorité ne tient qu’à ${m} % de l’Assemblée. Sans partenaire, chaque texte peut tomber. Trois partis pourraient vous rejoindre… à leurs conditions.`,
    choices,
  };
}

export function adjustCoalition(d: GameState, e: Extract<Effect, { kind: 'coalition' }>, rng: Rng): string[] {
  if (e.open) {
    const why = canCoalesce(d);
    if (why) return [why];
    if (!d.pendingDecisions.some(x => x.tag === 'coalition')) d.pendingDecisions.push(coalitionDecision(d));
    return ['Les négociations peuvent commencer'];
  }
  if (e.leave) {
    if (!d.coalition) return [];
    return breakup(d, true);
  }
  if (e.partyId) {
    const p = d.otherParties.find(x => x.id === e.partyId);
    if (!p || d.coalition) return [];
    const bonus = coalitionBonus(p.id);
    const mood = clamp(60 + (e.mood ?? 0));
    d.coalition = { partyId: p.id, name: p.name, color: p.color, since: d.week, mood, bonus, ministries: Math.max(2, Math.round(bonus / 3) + rng.int(0, 1)) };
    shiftMajority(d, bonus);
    d.party.cohesion = clamp(d.party.cohesion - 4);
    addMilestone(d, 'carriere', `Coalition avec ${p.name}`, `Un accord de gouvernement signé à l’aube : ${d.coalition.ministries} ministères pour vos nouveaux partenaires.`);
    pushNews(d, 'actu', 'positive', `Accord de coalition avec ${p.name}`, `La majorité gagne ${bonus} points. Dans votre parti, certains grincent.`);
    return [`Coalition avec ${p.name}`, `Majorité +${bonus}`, 'Cohésion du parti −4'];
  }
  if (e.mood && d.coalition) {
    d.coalition.mood = clamp(d.coalition.mood + e.mood);
    return [`Humeur de ${d.coalition.name} ${frSigned(e.mood)}`];
  }
  return [];
}

function breakup(d: GameState, byYou: boolean): string[] {
  const c = d.coalition!;
  d.coalition = null;
  shiftMajority(d, -c.bonus);
  d.player.flags['coalitionFail'] = d.week;
  if (byYou) {
    pushNews(d, 'actu', 'neutral', `Fin de la coalition avec ${c.name}`, 'Vous reprenez votre liberté. Et perdez des voix à l’Assemblée.');
  } else {
    addMilestone(d, 'revers', 'La coalition éclate', `${c.name} quitte le gouvernement avec fracas : « On ne nous écoute plus. »`);
    pushNews(d, 'actu', 'negative', `${c.name} claque la porte du gouvernement`, `Ses ${c.ministries} ministres démissionnent. Majorité −${c.bonus}.`);
  }
  return [`Fin de la coalition avec ${c.name}`, `Majorité −${c.bonus}`];
}

/** Chaque mois : l'humeur du partenaire s'use ; une offre de coalition quand la majorité vacille */
export function monthlyCoalition(d: GameState, rng: Rng): void {
  const c = d.coalition;
  if (c) {
    if (d.player.rankId !== 'premier_ministre' && !d.presidency) { d.coalition = null; return; }
    const partner = d.otherParties.find(p => p.id === c.partyId);
    const gap = partner ? Math.abs(partner.position - d.party.position) : 40;
    c.mood = clamp(c.mood - 1.2 - gap / 60 + rng.range(-1, 1));
    if (c.mood < 25 && rng.chance(0.25)) breakup(d, false);
    return;
  }
  if (!canCoalesce(d) && d.week - Number(d.player.flags['coalitionOffer'] ?? -99) >= 12 && !d.pendingDecisions.some(x => x.tag === 'coalition')) {
    d.player.flags['coalitionOffer'] = d.week;
    d.pendingDecisions.push(coalitionDecision(d));
  }
}

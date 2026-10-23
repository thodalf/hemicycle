import { Decision, Effect, FactionId, Fronde, GameState } from '../models/game.models';
import { rankOrder } from '../data/ranks';
import { pushNews } from './effects';
import { decisionActive } from '../data/great-decisions';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Les frondes : un courant mécontent s'organise, porte une
 *  revendication et gagne en force mois après mois. Au-delà de
 *  80, c'est l'ultimatum. La crainte que vous inspirez les
 *  freine ; les attentions de votre équipe les apaisent.
 * ============================================================ */

export const DEMANDS: Record<Fronde['demand'], { label: string; text: string }> = {
  ligne: { label: 'Changer de ligne', text: 'exige que vous vous rapprochiez de ses positions' },
  postes: { label: 'Des postes', text: 'réclame des investitures et des responsabilités pour les siens' },
  consultation: { label: 'Consulter les militants', text: 'demande un vote des adhérents sur la stratégie' },
  demission: { label: 'Votre démission', text: 'exige que vous quittiez la direction du parti' },
};

export function frondes(d: GameState): Fronde[] {
  return (d.frondes ??= []);
}

/** Chaque mois : les courants mécontents s'organisent */
export function monthlyFrondes(d: GameState, rng: Rng): void {
  if (d.status !== 'en_cours') return;
  // Les militants ne voient pas naître de fronde de courant ; celles des requêtes, si
  const low = rankOrder(d.player.rankId) < 1;
  const list = frondes(d);
  const dread = d.player.dread ?? 0;
  const nego = d.player.lifestyle?.perks.includes('nego_3') ? 0.8 : 1;
  // Purge : plus aucune fronde pendant trois ans. Pacte des courants : elles grandissent deux fois moins vite
  const purged = decisionActive(d, 'purge') && d.week - Number(d.player.flags['gd_purge']) < 36;
  const pact = decisionActive(d, 'pacte_courants') ? 0.5 : 1;
  for (const f of d.party.factions) {
    let fr = list.find(x => x.factionId === f.id);
    if (!fr && !low && !purged && f.supportForPlayer < 30 && rng.chance(0.25)) {
      const leader = d.party.leaderNpcId === 'player';
      const demand: Fronde['demand'] = leader && f.supportForPlayer < 18 ? 'demission' : rng.pick(['ligne', 'postes', 'consultation'] as const);
      fr = { factionId: f.id, demand, strength: 20, since: d.week };
      list.push(fr);
      pushNews(d, 'parti', 'negative', `Fronde : ${f.name}`, `Le courant ${f.name.toLowerCase()} s’organise et ${DEMANDS[demand].text}.`);
    }
    if (!fr) continue;
    // Une fronde née d'un pilier grandit tant que le pilier reste extrême, et s'éteint quand il revient
    const pv = fr.pillar ? d.requetes?.pillars[fr.pillar] ?? 50 : null;
    const grow = pv !== null ? (pv <= 20 || pv >= 80 ? 7 : -8) * nego
      : ((35 - f.supportForPlayer) / 4 + (50 - d.party.cohesion) / 12) * nego;
    fr.strength = clamp(fr.strength + (grow > 0 ? grow * pact : grow) - dread / 25);
    if ((pv === null && f.supportForPlayer >= 45) || fr.strength <= 0) {
      d.frondes = list.filter(x => x !== fr);
      pushNews(d, 'parti', 'positive', `La fronde ${f.name.toLowerCase()} s’éteint`, 'Les mécontents rentrent dans le rang.');
      continue;
    }
    if (fr.strength >= 80 && !d.pendingDecisions.some(x => x.tag === `fronde_${f.id}`)) d.pendingDecisions.push(ultimatum(d, fr, f.name, f.position));
  }
}

function ultimatum(d: GameState, fr: Fronde, name: string, position: number): Decision {
  const dm = DEMANDS[fr.demand];
  const fid = fr.factionId;
  const accept: Effect[] = fr.demand === 'ligne' ? [{ kind: 'stance', delta: Math.round((position - d.player.stance) * 0.4) }, { kind: 'faction', factionId: fid, delta: 20 }]
    : fr.demand === 'postes' ? [{ kind: 'stat', stat: 'politicalCapital', delta: -15 }, { kind: 'faction', factionId: fid, delta: 18 }]
    : fr.demand === 'consultation' ? [{ kind: 'cohesion', delta: 6 }, { kind: 'faction', factionId: fid, delta: 12 }, { kind: 'stat', stat: 'influence', delta: -2 }]
    : [{ kind: 'faction', factionId: fid, delta: 25 }, { kind: 'stat', stat: 'influence', delta: -10 }, { kind: 'stat', stat: 'credibility', delta: 2 }];
  return {
    id: nextId(d, 'dec'), tag: `fronde_${fid}`, week: d.week, deadlineWeek: d.week + 1, source: 'evenement',
    title: `Ultimatum du courant ${name.toLowerCase()}`,
    context: `La fronde a atteint sa pleine force (${Math.round(fr.strength)}/100). Elle ${dm.text}. Sans réponse, elle fera voter une motion contre vous au prochain conseil national.`,
    choices: [
      { id: 'ceder', label: `Céder : ${dm.label.toLowerCase()}`, effects: [...accept, { kind: 'fronde', factionId: fid, delta: -100 }], outcome: 'La fronde se dissout. Certains y voient de la sagesse, d’autres de la faiblesse.' },
      { id: 'ecraser', label: 'Écraser la fronde', effects: [{ kind: 'faction', factionId: fid, delta: -15 }, { kind: 'cohesion', delta: -6 }, { kind: 'dread', delta: 12 }, { kind: 'fronde', factionId: fid, delta: -100 }], outcome: 'Exclusions, retraits d’investiture : la fronde est brisée. Le parti a peur.',
        risk: { baseChance: 0.45, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [{ kind: 'stat', stat: 'influence', delta: -8 }, { kind: 'faction', factionId: '*', delta: -6 }, { kind: 'fronde', factionId: fid, delta: -40 }], failureNews: 'La motion passe : vous êtes mis·e en minorité au conseil national.' } },
      { id: 'diviser', label: 'Diviser les frondeurs en débauchant leurs chefs', effects: [{ kind: 'stat', stat: 'politicalCapital', delta: -8 }, { kind: 'fronde', factionId: fid, delta: -45 }, { kind: 'faction', factionId: fid, delta: 6 }], outcome: 'Deux meneurs acceptent un poste. La fronde perd son élan.' },
    ],
  };
}

/** Effet « fronde » : affaiblir ou renforcer une fronde */
export function adjustFronde(d: GameState, e: Extract<Effect, { kind: 'fronde' }>): string[] {
  const list = frondes(d);
  const targets = list.filter(f => !e.factionId || e.factionId === '*' || f.factionId === e.factionId);
  for (const f of targets) f.strength = clamp(f.strength + e.delta);
  d.frondes = list.filter(f => f.strength > 0);
  return targets.length ? [e.delta < 0 ? 'Fronde affaiblie' : 'Fronde renforcée'] : [];
}

export function frondeOf(d: GameState, id: FactionId): Fronde | undefined {
  return frondes(d).find(f => f.factionId === id);
}

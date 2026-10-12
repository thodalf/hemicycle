import { Decision, Effect, GameState } from '../models/game.models';
import { partySupport, pushNews } from './effects';
import { ofParty } from '../data/world';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Scénario « Infiltré·e » : couverture, renseignements,
 *  rapports à l'officier traitant, sabotage, soupçons.
 * ============================================================ */

/** Renseignements à transmettre avant de pouvoir tout déballer */
export const MOLE_GOAL = 150;

export function stanceGap(d: GameState): number {
  return Math.abs(d.player.stance - d.party.position);
}

export function adjustMole(d: GameState, e: Extract<Effect, { kind: 'mole' }>): string[] {
  const m = d.mole;
  if (!m) return [];
  const out: string[] = [];
  if (e.cover) { m.cover = clamp(m.cover + e.cover); out.push(`Couverture ${e.cover > 0 ? '+' : ''}${e.cover}`); }
  if (e.intel) {
    const before = m.intel;
    m.intel = Math.max(0, m.intel + e.intel);
    const real = m.intel - before;
    if (real) out.push(`Renseignements ${real > 0 ? '+' : ''}${real}`);
  }
  if (e.deliver && m.intel > 0) {
    const n = m.intel;
    m.delivered += n;
    m.intel = 0;
    m.lastReport = d.week;
    m.handlerTrust = clamp(m.handlerTrust + Math.min(12, 3 + n / 4));
    d.player.finances.personal += n * 40;
    out.push(`Rapport transmis : ${n} renseignements (${m.delivered}/${MOLE_GOAL})`, `Prime +${(n * 40).toLocaleString('fr-FR')} €`);
  } else if (e.deliver) {
    out.push('Rien à transmettre');
  }
  if (e.sabotage) {
    m.sabotage += e.sabotage;
    d.party.cohesion = clamp(d.party.cohesion - e.sabotage / 2);
    out.push(`Sabotage +${e.sabotage}`);
  }
  if (e.leaderPop) {
    const leader = d.npcs.find(n => n.id === d.party.leaderNpcId);
    if (leader) {
      leader.popularity = clamp(leader.popularity + e.leaderPop);
      out.push(`${leader.name} ${e.leaderPop > 0 ? '+' : ''}${e.leaderPop} popularité`);
    }
  }
  if (e.handler) { m.handlerTrust = clamp(m.handlerTrust + e.handler); out.push(`Confiance de l’officier ${e.handler > 0 ? '+' : ''}${e.handler}`); }
  return out;
}

function decision(d: GameState, tag: string, title: string, context: string, choices: Decision['choices']): Decision {
  return { id: nextId(d, 'dec'), tag, week: d.week, deadlineWeek: d.week + 1, source: 'evenement', title, context, choices };
}

const pending = (d: GameState, tag: string) => d.pendingDecisions.some(x => x.tag === tag);

export function weeklyMole(d: GameState, rng: Rng): void {
  const m = d.mole;
  if (!m) return;
  // Votre camp vous défraie discrètement
  d.player.finances.personal += 150;

  // La couverture s'use, d'autant plus que votre ligne s'écarte de celle du parti infiltré
  const gap = stanceGap(d);
  const trust = partySupport(d);
  m.cover = clamp(m.cover - 1 - Math.max(0, gap - 15) / 25 + (trust - 50) / 100);
  if (d.week - m.lastReport > 6) m.handlerTrust = clamp(m.handlerTrust - 2);
  // Un renseignement non transmis se périme
  if (m.intel > 0) m.intel = Math.floor(m.intel * 0.9);

  if (m.cover <= 0) {
    if (d.scenario === 'infiltre' && d.status === 'en_cours') {
      d.status = 'defaite';
      d.endTitle = 'Démasqué·e';
      d.endReason = `Le service d’ordre ${ofParty(d.party.name)} remonte jusqu’à vous. Exclu·e sur-le-champ, vous êtes l’homme ou la femme à abattre des deux camps.`;
    } else {
      pushNews(d, 'scandale', 'negative', 'Taupe démasquée', 'Votre double jeu est révélé. Exclusion immédiate.');
      d.mole = null;
    }
    return;
  }

  // La taupe à la tête du parti : victoire alternative
  if (d.scenario === 'infiltre' && d.party.leaderNpcId === 'player' && d.status === 'en_cours') {
    d.status = 'victoire';
    d.endTitle = 'La taupe en chef';
    d.endReason = `Vous dirigez désormais le parti que vous deviez espionner. ${m.homeName} n’en revient pas : l’adversaire entier est entre vos mains.`;
    return;
  }

  if (m.cover < 45 && !pending(d, 'soupcons') && rng.chance(0.15)) {
    const suspect = rng.pick(d.npcs.filter(n => n.partyId === d.party.id && n.id !== d.party.leaderNpcId));
    d.pendingDecisions.push(decision(d, 'soupcons', 'Le service d’ordre vous a à l’œil',
      'Des questions circulent sur vos absences et vos coups de téléphone. Un responsable vous demande « un mot, en privé ».', [
        { id: 'zele', label: 'Redoubler de zèle militant', effects: [{ kind: 'mole', cover: 12 }, { kind: 'stat', stat: 'stress', delta: 6 }, { kind: 'stat', stat: 'energy', delta: -8 }], outcome: 'Collages, tractages, réunions : on vous trouve exemplaire.' },
        ...(suspect ? [{ id: 'bouc', label: `Orienter les soupçons vers ${suspect.name}`, effects: [{ kind: 'mole' as const, cover: 20 }, { kind: 'npcRelation' as const, npcId: suspect.id, delta: -30 }, { kind: 'stat' as const, stat: 'credibility' as const, delta: -3 }, { kind: 'stat' as const, stat: 'stress' as const, delta: 4 }],
          outcome: `${suspect.name} est mis·e à l’écart. Vous dormez mal.`, risk: { baseChance: 0.3, scaleWith: 'influence' as const, scaleWeight: 0.5, onFailure: [{ kind: 'mole' as const, cover: -15 }], failureNews: 'La manœuvre est éventée : les soupçons se resserrent sur vous.' } }] : []),
        { id: 'detruire', label: 'Détruire vos notes', effects: [{ kind: 'mole', cover: 15, intel: -999 }, { kind: 'mole', handler: -6 }], outcome: 'Plus rien de compromettant. Plus rien à transmettre non plus.' },
      ]));
  }

  if (m.handlerTrust < 25 && !pending(d, 'officier') && rng.chance(0.25)) {
    d.pendingDecisions.push(decision(d, 'officier', `${m.handler} s’impatiente`,
      `« Ça fait des semaines qu’on n’a rien. ${m.homeName} commence à se demander de quel côté vous êtes. »`, [
        { id: 'livrer', label: 'Tout transmettre maintenant', effects: [{ kind: 'mole', deliver: true, cover: -4 }], outcome: 'Rapport livré en urgence.' },
        { id: 'temps', label: 'Demander du temps', effects: [{ kind: 'mole', handler: -6 }, { kind: 'stat', stat: 'stress', delta: 4 }], outcome: 'Il vous accorde un sursis.' },
        { id: 'menacer', label: 'Le menacer de tout révéler', effects: [{ kind: 'mole', handler: 15 }, { kind: 'stat', stat: 'stress', delta: 6 }], outcome: 'Il recule. Pour l’instant.',
          risk: { baseChance: 0.45, onFailure: [{ kind: 'mole', handler: -20, cover: -15 }], failureNews: 'Il laisse fuiter une rumeur sur vous, pour vous rappeler qui commande.' } },
      ]));
  }
}

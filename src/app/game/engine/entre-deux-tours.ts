import { Decision, Effect, GameState, ScheduledElection } from '../models/game.models';
import { ranking } from './electoral';
import { Rng, nextId } from './rng';

/* ============================================================
 *  Entre-deux-tours de la présidentielle : quinze jours pour
 *  rassembler. Les éliminés attendent des gestes, le débat
 *  télévisé peut tout renverser. Le flag 'e2t' s'ajoute à votre
 *  score au second tour.
 * ============================================================ */

const e2t = (delta: number): Effect => ({ kind: 'flagAdd', key: 'e2t', delta });
const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });

export function inSecondRound(d: GameState): boolean {
  return d.elections.some(e => !e.resolved && !!e.secondRoundWeek && d.week < e.secondRoundWeek);
}

/** Les ralliements : que céder au candidat arrivé troisième ? */
export function entreDeuxToursDecision(d: GameState, e: ScheduledElection, firstRound: Record<string, number>, rng: Rng): Decision | null {
  const ranked = ranking(firstRound);
  const third = ranked.find(([id], i) => i >= 2 && id !== 'player');
  const rivalId = e.finalists?.find(id => id !== 'player');
  const rival = d.npcs.find(n => n.id === rivalId);
  if (!third || !rival) return null;
  const npc = d.npcs.find(n => n.id === third[0]);
  if (!npc) return null;
  const parties = [d.party, ...d.otherParties];
  const pos = parties.find(p => p.id === npc.partyId)?.position ?? 0;
  const rivalPos = parties.find(p => p.id === rival.partyId)?.position ?? 0;
  const toward = Math.sign(pos - d.player.stance) * 6;
  // Plus le troisième est proche de vous que de votre adversaire, plus son ralliement rapporte
  const closer = Math.abs(pos - d.player.stance) < Math.abs(pos - rivalPos);
  const weight = Math.round(Math.min(7, 2 + third[1] / 4));
  const extreme = Math.abs(rivalPos) >= 55;
  return {
    id: nextId(d, 'dec'), tag: 'entre_deux_tours', week: d.week, deadlineWeek: d.week, source: 'carriere',
    title: 'Entre-deux-tours : les ralliements',
    context: `${npc.name} (${third[1].toLocaleString('fr-FR')} % au premier tour) n’a pas encore donné de consigne. ${closer ? 'Ses électeurs sont plus proches de vous que de ' + rival.name + '.' : 'Ses électeurs penchent plutôt vers ' + rival.name + '.'} Quinze jours pour rassembler.`,
    choices: [
      { id: 'accord', label: `Négocier le ralliement de ${npc.name}`,
        effects: [e2t(closer ? weight : Math.round(weight / 2)), ...(toward ? [{ kind: 'stance', delta: toward } as Effect] : []), st('politicalCapital', -15), { kind: 'npcRelation', npcId: npc.id, delta: 20 }],
        outcome: `${npc.name} appelle à voter pour vous, en échange de quelques engagements de programme.`,
        risk: { baseChance: 0.25, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [e2t(-2), st('credibility', -3)], failureNews: `${npc.name} fait monter les enchères, puis refuse publiquement : « Pas de chèque en blanc. »` } },
      { id: 'rassembler', label: 'Appeler au rassemblement, sans rien céder',
        effects: [e2t(2), st('credibility', 3)], outcome: 'Un discours de rassembleur·se. Vous gardez votre ligne intacte.' },
      { id: 'barrage', label: extreme ? `Appeler au front républicain contre ${rival.name}` : `Dramatiser l’enjeu face à ${rival.name}`,
        effects: [e2t(extreme ? 5 : 2), st('stress', 4)],
        outcome: extreme ? 'Syndicats, associations, anciens présidents : les appels se multiplient.' : 'Vous mobilisez les abstentionnistes.',
        risk: extreme ? undefined : { baseChance: 0.35, onFailure: [e2t(-2), st('popularity', -2)], failureNews: '« Caricature », juge la presse : la dramatisation tombe à plat.' } },
      { id: 'terrain', label: 'Labourer le terrain : trois meetings par jour',
        effects: [e2t(3), { kind: 'momentum', delta: 6 }, st('energy', -20), { kind: 'health', delta: -2 }], outcome: 'Lille, Marseille, Brest. Vous dormez dans le train.' },
    ],
  };
}

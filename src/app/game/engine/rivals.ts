import { Effect, GameState, Npc, RankId, RivalPlot } from '../models/game.models';
import { RANKS, rankOrder } from '../data/ranks';
import { pushNews } from './effects';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Les rivaux ont une carrière : ils se présentent, gagnent,
 *  perdent, entrent au gouvernement… et complotent contre vous.
 * ============================================================ */

/** Les marches qu'un PNJ peut gravir seul (la tête des partis se joue au congrès) */
const LADDER: RankId[] = ['militant', 'conseiller_municipal', 'depute', 'ministre'];

function nextRank(n: Npc, d: GameState): RankId | null {
  const i = LADDER.indexOf(n.rankId);
  if (i < 0 || i >= LADDER.length - 1) return null;
  const next = LADDER[i + 1];
  // Le gouvernement se forme dans le camp au pouvoir
  if (next === 'ministre' && n.partyId !== d.presidential.incumbentPartyId) return null;
  return next;
}

function prevRank(n: Npc): RankId | null {
  const i = LADDER.indexOf(n.rankId);
  return i > 0 ? LADDER[i - 1] : null;
}

export function monthlyRivalCareers(d: GameState, rng: Rng): void {
  for (const n of d.npcs) {
    if (n.rankId === 'chef_parti' || n.rankId === 'president') continue;
    const up = nextRank(n, d);
    const strength = (n.popularity + n.influence) / 2 + n.ambition / 4;
    // Une élection ou une nomination, de temps en temps
    if (up && rng.chance(0.012 + Math.max(0, strength - 40) / 1500)) {
      n.rankId = up;
      n.influence = clamp(n.influence + 5);
      const big = rankOrder(up) >= rankOrder('depute');
      if (big || n.isRival || n.relationToPlayer >= 40) {
        pushNews(d, 'rival', n.relationToPlayer < 0 ? 'negative' : 'neutral',
          up === 'ministre' ? `${n.name} entre au gouvernement` : `${n.name} élu·e ${RANKS[up].label.toLowerCase()}`,
          n.relationToPlayer < 0 ? 'Un adversaire de plus qui monte en puissance.' : 'Un allié bien placé, ça peut servir.');
      }
      // Un rival qui vous rattrape devient plus agressif
      if (Math.abs(rankOrder(up) - rankOrder(d.player.rankId)) <= 1 && n.relationToPlayer < 0) n.aggressiveness = clamp(n.aggressiveness + 8);
    } else if (rng.chance(0.006 + (n.popularity < 25 ? 0.01 : 0))) {
      const down = prevRank(n);
      if (down && rankOrder(n.rankId) >= rankOrder('depute')) {
        n.rankId = down;
        if (n.isRival || n.relationToPlayer <= -20) pushNews(d, 'rival', 'positive', `${n.name} battu·e`, 'Votre adversaire perd son siège. Une place se libère.');
      }
    }
  }
}

/* ── Les complots des rivaux ──────────────────────────────── */

const PLOT_TEXT: Record<RivalPlot['kind'], { start: string; hit: string }> = {
  dossier: { start: 'monte un dossier contre vous', hit: 'Un dossier à charge sort dans la presse : vieilles notes de frais, emplois de proches…' },
  rumeurs: { start: 'fait courir des rumeurs sur vous', hit: 'Les rumeurs ont pris : on ne parle plus que de votre « double vie ».' },
  investiture: { start: 'manœuvre pour vous priver d’investiture', hit: 'Le bureau national hésite désormais à vous soutenir.' },
};

export function rivalPlots(d: GameState): RivalPlot[] {
  return (d.rivalPlots ??= []);
}

/** Chaque mois : les rivaux les plus hostiles passent à l'offensive, les complots en cours avancent */
export function monthlyRivalPlots(d: GameState, rng: Rng): void {
  const plots = rivalPlots(d);
  const p = d.player;
  if (plots.length < 2 && d.week > 6) {
    const enemy = d.npcs.filter(n => n.relationToPlayer <= -35 && n.aggressiveness >= 40 && !plots.some(x => x.npcId === n.id))
      .sort((a, b) => a.relationToPlayer - b.relationToPlayer)[0];
    if (enemy && rng.chance(0.06)) {
      const kind = rng.pick<RivalPlot['kind']>(enemy.partyId === d.party.id ? ['investiture', 'rumeurs'] : ['dossier', 'rumeurs']);
      plots.push({ npcId: enemy.id, since: d.week, progress: 0, kind });
      // On l'apprend… parfois
      const tipped = p.team.length > 0 || rng.chance(0.4);
      if (tipped) pushNews(d, 'rival', 'negative', 'On complote contre vous', `Selon vos sources, ${enemy.name} ${PLOT_TEXT[kind].start}. Onglet Intrigues : « Déjouer les manœuvres adverses ».`);
    }
  }
  const spin = p.staff.includes('spin_doctor') ? 0.7 : 1;
  for (const plot of [...plots]) {
    const n = d.npcs.find(x => x.id === plot.npcId);
    if (!n) { d.rivalPlots = plots.filter(x => x !== plot); continue; }
    plot.progress = clamp(plot.progress + (10 + n.influence / 10) * spin * rng.range(0.7, 1.3));
    if (plot.progress >= 100) {
      d.rivalPlots = rivalPlots(d).filter(x => x !== plot);
      const hit: Effect[] = plot.kind === 'dossier' ? [{ kind: 'exposure', delta: 14 }, { kind: 'stat', stat: 'credibility', delta: -5 }]
        : plot.kind === 'rumeurs' ? [{ kind: 'stat', stat: 'popularity', delta: -6 }, { kind: 'stat', stat: 'stress', delta: 6 }]
        : [{ kind: 'faction', factionId: '*', delta: -7 }, { kind: 'stat', stat: 'influence', delta: -4 }];
      for (const e of hit) {
        if (e.kind === 'exposure') p.scandalExposure = clamp(p.scandalExposure + e.delta);
        else if (e.kind === 'stat') p.stats[e.stat] = clamp(p.stats[e.stat] + e.delta);
        else if (e.kind === 'faction') for (const f of d.party.factions) f.supportForPlayer = clamp(f.supportForPlayer + e.delta);
      }
      n.influence = clamp(n.influence + 3);
      pushNews(d, 'rival', 'negative', `Le coup de ${n.name}`, PLOT_TEXT[plot.kind].hit);
    }
  }
}

/** Déjouer les complots adverses : on les démasque, et l'on récupère de quoi riposter */
export function counterPlots(d: GameState, rng: Rng): string[] {
  const plots = rivalPlots(d);
  if (!plots.length) return ['Aucune manœuvre adverse détectée'];
  const out: string[] = [];
  for (const plot of [...plots]) {
    const n = d.npcs.find(x => x.id === plot.npcId);
    if (rng.chance(0.7)) {
      d.rivalPlots = rivalPlots(d).filter(x => x !== plot);
      if (n) {
        d.player.flags[`kompromat_${n.id}`] = Number(d.player.flags[`kompromat_${n.id}`] ?? 0) + 1;
        n.relationToPlayer = clamp(n.relationToPlayer - 10, -100, 100);
        out.push(`Manœuvre de ${n.name} déjouée (📁 dossier sur lui ou elle)`);
      }
    } else {
      plot.progress = clamp(plot.progress - 25);
      out.push(`Manœuvre de ${n?.name ?? 'un rival'} retardée`);
    }
  }
  return out;
}

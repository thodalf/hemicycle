import { FactionId, GameState, Recruit, StaffRole } from '../models/game.models';
import { discoverSecret } from './secrets';
import { grantHook } from './secrets';
import { recordOpinion } from './memories';
import { pushNews } from './effects';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Le conseil : chaque mois, chaque membre de l'équipe reçoit
 *  une mission. Sa réussite dépend de son talent (rareté), de son
 *  moral, et de l'adéquation entre la mission et son poste.
 * ============================================================ */

export interface MissionDef {
  id: string;
  label: string;
  icon: string;
  hint: string;
  /** Postes pour qui c'est le cœur de métier */
  roles: StaffRole[];
  target?: 'faction' | 'npc';
}

export const MISSIONS: MissionDef[] = [
  { id: 'image', label: 'Soigner votre image', icon: '📸', hint: 'Popularité, chaque mois.', roles: ['attache_presse', 'community_manager', 'plume'] as StaffRole[] },
  { id: 'courant', label: 'Choyer un courant du parti', icon: '🌹', hint: 'Soutien du courant choisi ; éteint les frondes.', roles: ['conseiller'] as StaffRole[], target: 'faction' },
  { id: 'secrets', label: 'Chercher des secrets', icon: '🔎', hint: 'Une chance de découvrir un secret chaque mois.', roles: ['spin_doctor', 'juriste'] as StaffRole[] },
  { id: 'relations', label: 'Améliorer une relation', icon: '🤝', hint: 'La personnalité choisie vous apprécie davantage ; parfois, elle vous doit un service.', roles: ['conseiller', 'attache_presse'] as StaffRole[], target: 'npc' },
  { id: 'tresor', label: 'Lever des fonds', icon: '💶', hint: 'Dons sur le compte de campagne.', roles: ['tresorier'] as StaffRole[] },
  { id: 'veille', label: 'Éteindre les rumeurs', icon: '🧯', hint: 'Exposition aux scandales en baisse.', roles: ['spin_doctor', 'juriste'] as StaffRole[] },
  { id: 'dossiers', label: 'Préparer vos dossiers', icon: '📚', hint: 'Maîtrise du sujet à la une.', roles: ['conseiller', 'plume'] as StaffRole[] },
];
export const MISSION_BY_ID = new Map(MISSIONS.map(m => [m.id, m]));

const RARITY_SKILL: Record<string, number> = { commun: 1, rare: 1.3, epique: 1.6, legendaire: 2 };

export function missionSkill(r: Recruit): number {
  const def = r.mission ? MISSION_BY_ID.get(r.mission) : undefined;
  const fit = def?.roles.includes(r.role) ? 1.4 : 1;
  const morale = 0.6 + (r.morale ?? 60) / 125;
  return (RARITY_SKILL[r.rarity] ?? 1) * fit * morale;
}

export function setMission(d: GameState, recruitId: string, mission: string | null, target?: string): void {
  const r = d.player.team.find(x => x.id === recruitId);
  if (!r) return;
  r.mission = mission ?? undefined;
  r.missionTarget = target;
}

/** Chaque mois : les missions rapportent */
export function monthlyCouncil(d: GameState, rng: Rng): void {
  const p = d.player;
  const report: string[] = [];
  for (const r of p.team) {
    if (!r.mission) continue;
    const k = missionSkill(r);
    switch (r.mission) {
      case 'image': p.stats.popularity = clamp(p.stats.popularity + 0.6 * k); break;
      case 'courant': {
        const f = d.party.factions.find(x => x.id === (r.missionTarget as FactionId)) ?? d.party.factions[0];
        f.supportForPlayer = clamp(f.supportForPlayer + 1.5 * k);
        const fr = (d.frondes ?? []).find(x => x.factionId === f.id);
        if (fr) fr.strength = clamp(fr.strength - 4 * k);
        break;
      }
      case 'secrets': {
        const bonus = p.lifestyle?.perks.includes('intr_1') ? 0.08 : 0;
        if (rng.chance(0.1 * k + bonus)) {
          const who = discoverSecret(d, rng, r.missionTarget || undefined);
          if (who) report.push(`${r.name} a trouvé quelque chose sur ${who}`);
        }
        break;
      }
      case 'relations': {
        const npc = d.npcs.find(n => n.id === r.missionTarget);
        if (!npc) break;
        const before = npc.relationToPlayer;
        npc.relationToPlayer = clamp(npc.relationToPlayer + 2 * k, -100, 100);
        recordOpinion(d, npc, npc.relationToPlayer - before, `Les attentions de ${r.name}`);
        if (npc.relationToPlayer >= 40 && rng.chance(0.06 * k)) { grantHook(d, npc.id, 'faible', 'Un service rendu par votre équipe'); report.push(`${npc.name} vous doit un service`); }
        break;
      }
      case 'tresor': p.finances.campaign += Math.round(350 * k); break;
      case 'veille': p.scandalExposure = clamp(p.scandalExposure - 0.8 * k); break;
      case 'dossiers': { const ds = p.dossiers[d.agendaDomain]; ds.mastery = clamp(ds.mastery + 0.8 * k); break; }
    }
  }
  if (report.length) pushNews(d, 'systeme', 'positive', 'Le rapport du conseil', report.join(' · '));
}

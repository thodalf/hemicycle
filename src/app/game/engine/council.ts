import { mods } from './difficulty';
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
  { id: 'entrainement', label: 'Vous entraîner aux débats', icon: '🥊', hint: 'Moins de stress, plus de crédibilité.', roles: ['coach'] as StaffRole[] },
  { id: 'tournees', label: 'Organiser vos déplacements', icon: '🚗', hint: 'De l’énergie gagnée sur la route ; les ruraux vous voient plus souvent.', roles: ['chauffeur'] as StaffRole[] },
  { id: 'quadrillage', label: 'Quadriller le terrain', icon: '🗺️', hint: 'Dynamique en hausse ; bien plus en campagne.', roles: ['directeur_campagne'] as StaffRole[] },
  { id: 'etudes', label: 'Mener des études qualitatives', icon: '📊', hint: 'Les électorats qui vous boudent se réconcilient peu à peu.', roles: ['sondeur'] as StaffRole[] },
  { id: 'amendements', label: 'Préparer amendements et questions', icon: '🏛️', hint: 'Influence et maîtrise du sujet à la une.', roles: ['assistant_parlementaire'] as StaffRole[] },
  { id: 'protection', label: 'Renforcer votre protection', icon: '🛡️', hint: 'La menace retombe, le stress aussi.', roles: ['garde_du_corps'] as StaffRole[] },
  { id: 'arbitrages', label: 'Tenir les arbitrages', icon: '🗂️', hint: 'Capital politique chaque mois.', roles: ['chef_cabinet'] as StaffRole[] },
  { id: 'chancelleries', label: 'Entretenir les chancelleries', icon: '🌐', hint: 'Prestige international en hausse, tensions en baisse.', roles: ['sherpa'] as StaffRole[] },
];

/** Les missions propres à un poste : chacun son métier */
export function missionsFor(role: StaffRole): MissionDef[] {
  return MISSIONS.filter(m => m.roles.includes(role));
}
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
  if (mission && !MISSION_BY_ID.get(mission)?.roles.includes(r.role)) return;
  r.mission = mission ?? undefined;
  r.missionTarget = target;
}

/** Chaque mois : les missions rapportent */
export function monthlyCouncil(d: GameState, rng: Rng): void {
  const p = d.player;
  const report: string[] = [];
  for (const r of p.team) {
    if (!r.mission) continue;
    // Une mission hors du poste (anciennes parties) est abandonnée
    if (!MISSION_BY_ID.get(r.mission)?.roles.includes(r.role)) { r.mission = undefined; r.missionTarget = undefined; continue; }
    const k = missionSkill(r) * mods(d).gain;
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
      case 'entrainement': p.stats.stress = clamp(p.stats.stress - 1.2 * k); p.stats.credibility = clamp(p.stats.credibility + 0.3 * k); break;
      case 'tournees': {
        p.stats.energy = clamp(p.stats.energy + 2 * k);
        if (d.electorate) d.electorate.offsets.ruraux = clamp(d.electorate.offsets.ruraux + 0.3 * k, -30, 30);
        break;
      }
      case 'quadrillage': p.momentum = clamp(p.momentum + (d.elections.some(e => !e.resolved && d.week >= e.campaignStartWeek) ? 3 : 1) * k); break;
      case 'etudes': if (d.electorate) for (const key of Object.keys(d.electorate.offsets) as (keyof typeof d.electorate.offsets)[]) if (d.electorate.offsets[key] < 0) d.electorate.offsets[key] = Math.min(0, d.electorate.offsets[key] + 0.4 * k); break;
      case 'amendements': { p.stats.influence = clamp(p.stats.influence + 0.3 * k); const ds = p.dossiers[d.agendaDomain]; ds.mastery = clamp(ds.mastery + 0.4 * k); break; }
      case 'protection': p.flags['menace'] = Math.max(0, Number(p.flags['menace'] ?? 0) - 4 * k); p.stats.stress = clamp(p.stats.stress - 0.5 * k); break;
      case 'arbitrages': p.stats.politicalCapital = clamp(p.stats.politicalCapital + 1.2 * k); break;
      case 'chancelleries': d.intl.prestige = clamp(d.intl.prestige + 0.4 * k); d.intl.tension = clamp(d.intl.tension - 0.3 * k); break;
    }
  }
  if (report.length) pushNews(d, 'systeme', 'positive', 'Le rapport du conseil', report.join(' · '));
}

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
  // Au moins trois missions par poste
  { id: 'media_training', label: 'Préparer vos passages télé', icon: '🎬', hint: 'Crédibilité et popularité, un peu chaque mois.', roles: ['coach'] as StaffRole[] },
  { id: 'forme', label: 'Veiller à votre forme', icon: '🏃', hint: 'Énergie en hausse, stress en baisse.', roles: ['coach'] as StaffRole[] },
  { id: 'discours', label: 'Écrire vos discours', icon: '✒️', hint: 'Influence en hausse ; vos formules marquent.', roles: ['plume'] as StaffRole[] },
  { id: 'caisse_parti', label: 'Tenir la caisse du parti', icon: '🏦', hint: 'Trésorerie du parti en hausse (si vous le dirigez), sinon capital politique.', roles: ['tresorier'] as StaffRole[] },
  { id: 'economies', label: 'Traquer les dépenses inutiles', icon: '🧾', hint: 'Quelques centaines d’euros économisés chaque mois.', roles: ['tresorier'] as StaffRole[] },
  { id: 'militants', label: 'Mobiliser les militants', icon: '📣', hint: 'Cohésion du parti et adhérents.', roles: ['directeur_campagne'] as StaffRole[] },
  { id: 'circo', label: 'Labourer la circonscription', icon: '🏘️', hint: 'Attachement de votre territoire en hausse.', roles: ['directeur_campagne', 'assistant_parlementaire'] as StaffRole[] },
  { id: 'riposte', label: 'Allumer des contre-feux contre un rival', icon: '🔥', hint: 'La popularité de la personnalité choisie s’érode.', roles: ['spin_doctor'] as StaffRole[], target: 'npc' },
  { id: 'communaute', label: 'Animer votre communauté en ligne', icon: '💬', hint: 'Les jeunes vous suivent davantage.', roles: ['community_manager'] as StaffRole[] },
  { id: 'veille_reseaux', label: 'Surveiller les réseaux', icon: '📡', hint: 'Les polémiques sont désamorcées plus tôt : exposition en baisse.', roles: ['community_manager'] as StaffRole[] },
  { id: 'ponctualite', label: 'Garantir votre ponctualité', icon: '⏱️', hint: 'Plus de retard : crédibilité, un peu chaque mois.', roles: ['chauffeur'] as StaffRole[] },
  { id: 'oreille', label: 'Tendre l’oreille', icon: '👂', hint: 'Petite chance d’entendre un secret dans les antichambres.', roles: ['chauffeur', 'garde_du_corps'] as StaffRole[] },
  { id: 'confidences', label: 'Distiller des confidences aux journalistes', icon: '🗞️', hint: 'Influence en hausse, au prix d’un peu d’exposition.', roles: ['attache_presse'] as StaffRole[] },
  { id: 'barometre', label: 'Affiner le baromètre', icon: '📈', hint: 'Dynamique en hausse : vous sentez l’opinion avant les autres.', roles: ['sondeur'] as StaffRole[] },
  { id: 'cartographie', label: 'Cartographier l’électorat', icon: '🗺️', hint: 'Votre électorat le plus faible remonte.', roles: ['sondeur'] as StaffRole[] },
  { id: 'veille_legislative', label: 'Assurer la veille législative', icon: '📑', hint: 'Un peu de maîtrise sur tous les dossiers.', roles: ['assistant_parlementaire'] as StaffRole[] },
  { id: 'defense', label: 'Préparer votre défense', icon: '⚖️', hint: 'En plein procès, votre défense progresse ; sinon, exposition en baisse.', roles: ['juriste'] as StaffRole[] },
  { id: 'discretion', label: 'Organiser des déplacements discrets', icon: '🕶️', hint: 'Énergie en hausse, stress en baisse.', roles: ['garde_du_corps'] as StaffRole[] },
  { id: 'coordination', label: 'Coordonner les cabinets', icon: '🧩', hint: 'Influence et cohésion de la majorité.', roles: ['chef_cabinet'] as StaffRole[] },
  { id: 'agenda', label: 'Tenir votre agenda', icon: '📅', hint: 'Énergie préservée, stress en baisse.', roles: ['chef_cabinet'] as StaffRole[] },
  { id: 'sommets', label: 'Préparer les sommets', icon: '🤝', hint: 'Crédibilité et prestige international.', roles: ['sherpa'] as StaffRole[] },
  { id: 'allies', label: 'Soigner les alliés', icon: '🕊️', hint: 'Les relations avec vos partenaires se réchauffent.', roles: ['sherpa'] as StaffRole[] },
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
      case 'media_training': p.stats.credibility = clamp(p.stats.credibility + 0.3 * k); p.stats.popularity = clamp(p.stats.popularity + 0.2 * k); break;
      case 'forme': p.stats.energy = clamp(p.stats.energy + 2 * k); p.stats.stress = clamp(p.stats.stress - 0.8 * k); break;
      case 'discours': p.stats.influence = clamp(p.stats.influence + 0.4 * k); break;
      case 'caisse_parti':
        if (d.partyFinance && d.party.leaderNpcId === 'player') d.partyFinance.treasury += Math.round(4 * k);
        else p.stats.politicalCapital = clamp(p.stats.politicalCapital + 0.6 * k);
        break;
      case 'economies': p.finances.personal += Math.round(250 * k); break;
      case 'militants': d.party.cohesion = clamp((d.party.cohesion ?? 50) + 0.6 * k); break;
      case 'circo': if (d.territory) d.territory.attachment = clamp(d.territory.attachment + 0.8 * k); break;
      case 'riposte': {
        const npc = d.npcs.find(n => n.id === r.missionTarget);
        if (npc) { npc.popularity = clamp(npc.popularity - 0.6 * k); if (rng.chance(0.04)) p.scandalExposure = clamp(p.scandalExposure + 3); }
        break;
      }
      case 'communaute': if (d.electorate) d.electorate.offsets.jeunes = clamp(d.electorate.offsets.jeunes + 0.4 * k, -30, 30); break;
      case 'veille_reseaux': p.scandalExposure = clamp(p.scandalExposure - 0.5 * k); break;
      case 'ponctualite': p.stats.credibility = clamp(p.stats.credibility + 0.25 * k); break;
      case 'oreille': if (rng.chance(0.05 * k)) { const who = discoverSecret(d, rng); if (who) report.push(`${r.name} a surpris une conversation sur ${who}`); } break;
      case 'confidences': p.stats.influence = clamp(p.stats.influence + 0.4 * k); p.scandalExposure = clamp(p.scandalExposure + 0.2); break;
      case 'barometre': p.momentum = clamp(p.momentum + 1.2 * k); break;
      case 'cartographie': if (d.electorate) {
        const o = d.electorate.offsets;
        const worst = (Object.keys(o) as (keyof typeof o)[]).sort((a, b) => o[a] - o[b])[0];
        o[worst] = clamp(o[worst] + 0.5 * k, -30, 30);
      } break;
      case 'veille_legislative': for (const ds of Object.values(p.dossiers)) ds.mastery = clamp(ds.mastery + 0.15 * k); break;
      case 'defense': {
        const proces = d.crises?.proces;
        if (proces) proces.gauge = clamp(proces.gauge + 1.5 * k); else p.scandalExposure = clamp(p.scandalExposure - 0.4 * k);
        break;
      }
      case 'discretion': p.stats.energy = clamp(p.stats.energy + 1.5 * k); p.stats.stress = clamp(p.stats.stress - 0.6 * k); break;
      case 'coordination': p.stats.influence = clamp(p.stats.influence + 0.3 * k); d.party.cohesion = clamp((d.party.cohesion ?? 50) + 0.3 * k); break;
      case 'agenda': p.stats.energy = clamp(p.stats.energy + 1.5 * k); p.stats.stress = clamp(p.stats.stress - 0.6 * k); break;
      case 'sommets': p.stats.credibility = clamp(p.stats.credibility + 0.25 * k); d.intl.prestige = clamp(d.intl.prestige + 0.3 * k); break;
      case 'allies': {
        const rel = d.intl.relations;
        const best = Object.keys(rel).sort((a, b) => rel[b] - rel[a])[0];
        if (best) rel[best] = clamp(rel[best] + 1 * k, -100, 100);
        break;
      }
    }
  }
  if (report.length) pushNews(d, 'systeme', 'positive', 'Le rapport du conseil', report.join(' · '));
}

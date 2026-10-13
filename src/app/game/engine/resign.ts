import { GameState, RankId } from '../models/game.models';
import { RANKS } from '../data/ranks';
import { MINISTRIES } from './government';
import { pushNews } from './effects';
import { addMilestone } from './life';
import { endPresidency } from './presidency';
import { adjustCivil, civilActive } from './civil';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Quitter un poste : démissionner du gouvernement, de son
 *  mandat, de la tête du parti, retirer sa candidature, se
 *  mettre en disponibilité de la fonction publique.
 * ============================================================ */

export interface ResignOption {
  id: 'ministre' | 'matignon' | 'depute' | 'conseiller' | 'chef_parti' | 'parti' | 'candidature' | 'civil' | 'elysee';
  label: string;
  consequence: string;
  ok: boolean;
  reason?: string;
}

export function resignOptions(d: GameState): ResignOption[] {
  if (d.status !== 'en_cours') return [];
  const p = d.player;
  const out: ResignOption[] = [];
  const campaign = d.elections.some(e => !e.resolved && e.type === 'presidentielle' && d.week >= e.campaignStartWeek);
  switch (p.rankId) {
    case 'ministre':
      out.push({ id: 'ministre', label: `Démissionner du gouvernement${d.portfolio ? ` (ministère ${MINISTRIES[d.portfolio]})` : ''}`, consequence: 'Retour sur les bancs de l’Assemblée. Liberté de parole retrouvée, influence en baisse.', ok: true });
      break;
    case 'premier_ministre':
      out.push({ id: 'matignon', label: 'Remettre votre démission au président', consequence: 'Le gouvernement tombe avec vous. Retour à l’Assemblée.', ok: true });
      break;
    case 'depute':
      out.push({ id: 'depute', label: 'Démissionner de votre mandat de député·e', consequence: 'Législative partielle : vous redevenez élu·e local·e. Pas de nouvelle candidature avant six mois.', ok: true });
      break;
    case 'conseiller_municipal':
      out.push({ id: 'conseiller', label: 'Quitter le conseil municipal', consequence: 'Retour au militantisme. Pas de nouvelle candidature avant six mois.', ok: true });
      break;
    case 'chef_parti':
      out.push({ id: 'chef_parti', label: 'Quitter la direction du parti', consequence: 'Un congrès désigne votre successeur. Vous redevenez député·e.', ok: true });
      break;
    case 'candidat_presidence':
      out.push({ id: 'candidature', label: 'Retirer votre candidature à la présidentielle', consequence: 'Vos parrainages sont perdus ; vous retrouvez votre ancien rang.', ok: !campaign, reason: campaign ? 'Trop tard : la campagne officielle est ouverte' : undefined });
      break;
    case 'president':
      out.push({ id: 'elysee', label: 'Démissionner de la présidence', consequence: 'Élection anticipée dans deux mois. Vous devenez ancien·ne président·e.', ok: true });
      break;
  }
  if (d.party.leaderNpcId === 'player' && p.rankId !== 'chef_parti') {
    out.push({ id: 'parti', label: 'Laisser la tête du parti', consequence: 'Un congrès désigne votre successeur. Vous gardez vos autres fonctions.', ok: true });
  }
  if (d.presidential.declared && p.rankId !== 'candidat_presidence' && !d.presidency) {
    out.push({ id: 'candidature', label: 'Retirer votre candidature à la présidentielle', consequence: 'Vos parrainages sont perdus.', ok: !campaign, reason: campaign ? 'Trop tard : la campagne officielle est ouverte' : undefined });
  }
  if (civilActive(d)) {
    out.push({ id: 'civil', label: 'Se mettre en disponibilité de la fonction publique', consequence: 'Vous quittez la haute fonction publique et son traitement.', ok: true });
  }
  return out;
}

function setRank(d: GameState, rank: RankId): void {
  const p = d.player;
  p.rankId = rank;
  p.actionPoints.max = RANKS[rank].monthlyActionPoints;
  p.actionPoints.current = Math.min(p.actionPoints.current, p.actionPoints.max);
}

function handOverParty(d: GameState): void {
  const heir = d.npcs.filter(n => n.partyId === d.party.id).sort((a, b) => b.influence - a.influence)[0];
  if (heir) d.party.leaderNpcId = heir.id;
  d.partyFinance = null;
}

export function resign(d: GameState, id: ResignOption['id'], rng: Rng): string[] {
  const opt = resignOptions(d).find(o => o.id === id);
  if (!opt?.ok) return [];
  const p = d.player;
  const s = p.stats;
  let title = '';
  let text = '';
  switch (id) {
    case 'ministre':
      title = 'Démission du gouvernement';
      text = `${p.name} quitte le gouvernement « pour retrouver sa liberté ».`;
      d.portfolio = null;
      setRank(d, 'depute');
      s.influence = clamp(s.influence - 6);
      s.credibility = clamp(s.credibility + 2);
      p.flags['lastOffer'] = d.week + 8;
      break;
    case 'matignon':
      title = 'Démission de Matignon';
      text = 'Vous remettez la démission de votre gouvernement. Passation dans la cour de l’hôtel de Matignon.';
      d.government = null;
      setRank(d, 'depute');
      s.influence = clamp(s.influence - 8);
      p.flags['lastOffer'] = d.week + 8;
      break;
    case 'depute':
      title = 'Démission de l’Assemblée';
      text = 'Vous rendez votre écharpe de député·e. Une législative partielle est organisée.';
      setRank(d, 'conseiller_municipal');
      s.influence = clamp(s.influence - 6);
      s.popularity = clamp(s.popularity - 2);
      p.flags['nextElectionWeek'] = d.week + 6;
      break;
    case 'conseiller':
      title = 'Départ du conseil municipal';
      text = 'Vous quittez le conseil municipal. Retour au militantisme.';
      setRank(d, 'militant');
      s.influence = clamp(s.influence - 3);
      p.flags['nextElectionWeek'] = d.week + 6;
      break;
    case 'chef_parti':
      title = 'Vous quittez la direction du parti';
      text = 'Un congrès extraordinaire désigne votre successeur.';
      handOverParty(d);
      setRank(d, 'depute');
      s.influence = clamp(s.influence - 8);
      p.flags['lastOffer'] = d.week + 8;
      break;
    case 'parti':
      title = 'Vous laissez la tête du parti';
      text = 'Un congrès désigne votre successeur. Vous gardez vos fonctions.';
      handOverParty(d);
      s.influence = clamp(s.influence - 5);
      break;
    case 'candidature':
      title = 'Candidature retirée';
      text = 'Vous renoncez à la course à l’Élysée.';
      d.presidential.declared = false;
      d.presidential.parrainages = 0;
      if (p.rankId === 'candidat_presidence') setRank(d, d.presidential.prevRank ?? 'chef_parti');
      s.credibility = clamp(s.credibility - 3);
      break;
    case 'civil':
      title = 'Mise en disponibilité';
      text = 'Vous quittez votre poste de haut fonctionnaire, sans perdre votre corps.';
      adjustCivil(d, { kind: 'civil', leave: true }, rng);
      break;
    case 'elysee':
      endPresidency(d, 'demission');
      return ['Démission de la présidence'];
  }
  s.stress = clamp(s.stress - 10);
  addMilestone(d, 'carriere', title, text);
  pushNews(d, 'systeme', 'neutral', title, text);
  return [title];
}

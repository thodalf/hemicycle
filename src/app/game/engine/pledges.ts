import { DOMAIN_LABELS, Domain, GameState } from '../models/game.models';
import { PROGRAM, PROGRAM_BY_ID } from '../data/programme';
import { economy } from './country';
import { pushNews } from './effects';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Les promesses de campagne du président : le programme validé
 *  pendant la campagne devient, à l'Élysée, une liste
 *  d'engagements à tenir avant la fin du mandat. Les mettre en
 *  œuvre coûte du capital politique (et parfois de l'argent) ;
 *  les réformes adoptées dans le même domaine les font avancer.
 *  À la fin du mandat, le pays fait les comptes.
 * ============================================================ */

export interface Pledge {
  id: string;
  questionId: string;
  domain: Domain;
  theme: string;
  label: string;
  /** Coût estimé (Md€ / an) */
  cost: number;
  progress: number;
  status: 'en_cours' | 'tenue' | 'abandonnee' | 'trahie';
  lastPush?: number;
}

const MANDATE = 60;

/** À l'élection : un engagement par domaine, tiré du programme validé */
export function makePledges(d: GameState): void {
  const pr = d.presidency;
  if (!pr) return;
  const answers: Record<string, string> = { ...(d.program?.answers ?? {}) };
  // Sans programme écrit : les positions du parti tiennent lieu d'engagements
  if (!Object.keys(answers).length) {
    for (const q of PROGRAM) {
      const best = [...q.options].sort((a, b) => Math.abs(a.position - d.party.position) - Math.abs(b.position - d.party.position))[0];
      answers[q.id] = best.id;
    }
  }
  const seen = new Set<Domain>();
  const out: Pledge[] = [];
  for (const [qid, oid] of Object.entries(answers)) {
    const q = PROGRAM_BY_ID.get(qid);
    const o = q?.options.find(x => x.id === oid);
    if (!q || !o || seen.has(q.domain)) continue;
    seen.add(q.domain);
    out.push({ id: nextId(d, 'eng'), questionId: qid, domain: q.domain, theme: q.theme, label: o.label, cost: o.cost, progress: 0, status: 'en_cours' });
    if (out.length >= 8) break;
  }
  pr.pledges = out;
  if (out.length) pushNews(d, 'actu', 'neutral', 'Les promesses du candidat deviennent des engagements', `${out.length} engagements de campagne à tenir avant la fin du quinquennat. La presse a déjà lancé son « promessomètre ».`);
}

export function pledges(d: GameState): Pledge[] {
  return d.presidency?.pledges ?? [];
}

/** Coût en capital politique d'un pas en avant */
export function pushCost(p: Pledge): number {
  return 8 + Math.min(10, Math.round(Math.abs(p.cost) / 3));
}

export function canPush(d: GameState, p: Pledge): string | null {
  if (p.status !== 'en_cours') return 'Engagement clos';
  if (p.lastPush === d.week) return 'Déjà avancé ce mois-ci';
  if (d.player.stats.politicalCapital < pushCost(p)) return `Il faut ${pushCost(p)} de capital politique`;
  return null;
}

function keep(d: GameState, p: Pledge): void {
  p.status = 'tenue';
  p.progress = 100;
  const s = d.player.stats;
  s.credibility = clamp(s.credibility + 3);
  if (d.presidency) d.presidency.approval = clamp(d.presidency.approval + 3);
  pushNews(d, 'actu', 'positive', `Promesse tenue : ${p.theme.toLowerCase()}`, `« ${p.label} » : l’engagement de campagne est respecté. Le promessomètre passe au vert.`);
}

/** Mettre en œuvre un engagement (capital politique, et le coût budgétaire) */
export function pushPledge(d: GameState, id: string, rng: Rng): string[] {
  const p = pledges(d).find(x => x.id === id);
  if (!p || canPush(d, p)) return [];
  const cost = pushCost(p);
  d.player.stats.politicalCapital = clamp(d.player.stats.politicalCapital - cost);
  p.lastPush = d.week;
  const mastery = d.player.dossiers[p.domain]?.mastery ?? 30;
  const step = Math.round(22 + mastery / 5 + rng.range(-4, 6));
  p.progress = clamp(p.progress + step);
  if (p.cost > 0) economy(d).deficit += Math.min(0.15, p.cost / 120);
  else if (p.cost < 0) economy(d).deficit -= Math.min(0.1, -p.cost / 160);
  if (d.presidency) d.presidency.majority = clamp(d.presidency.majority - 0.5);
  if (p.progress >= 100) keep(d, p);
  return [`${p.theme} : +${step} %`, `Capital politique −${cost}`];
}

/** Renoncer publiquement : moins grave qu'une promesse trahie en fin de mandat */
export function dropPledge(d: GameState, id: string): string[] {
  const p = pledges(d).find(x => x.id === id);
  if (!p || p.status !== 'en_cours') return [];
  p.status = 'abandonnee';
  d.player.stats.credibility = clamp(d.player.stats.credibility - 3);
  if (d.presidency) d.presidency.approval = clamp(d.presidency.approval - 2);
  pushNews(d, 'actu', 'negative', `Promesse abandonnée : ${p.theme.toLowerCase()}`, `« ${p.label} » ne se fera pas. L’opposition ressort les tracts de campagne.`);
  return ['Engagement abandonné'];
}

/** Une réforme adoptée fait avancer l'engagement du même domaine */
export function reformPledge(d: GameState, domain: Domain): void {
  const p = pledges(d).find(x => x.status === 'en_cours' && x.domain === domain);
  if (!p) return;
  p.progress = clamp(p.progress + 40);
  if (p.progress >= 100) keep(d, p);
}

/** Chaque mois : un dossier très maîtrisé fait avancer l'engagement ; à mi-mandat et à la fin, le bilan */
export function monthlyPledges(d: GameState): void {
  const pr = d.presidency;
  if (!pr?.pledges?.length) return;
  for (const p of pr.pledges) {
    if (p.status !== 'en_cours') continue;
    if ((d.player.dossiers[p.domain]?.mastery ?? 0) >= 65) p.progress = clamp(p.progress + 1.5);
    if (p.progress >= 100) keep(d, p);
  }
  const age = d.week - pr.since;
  if (age === Math.floor(MANDATE / 2)) {
    const k = pr.pledges.filter(x => x.status === 'tenue').length;
    pushNews(d, 'actu', k >= pr.pledges.length / 3 ? 'positive' : 'negative', 'Mi-mandat : le promessomètre', `${k} engagement(s) tenu(s) sur ${pr.pledges.length}. Il reste deux ans et demi.`);
  }
  // Dernier mois du mandat : les engagements encore ouverts sont trahis
  if (age >= MANDATE - 1) {
    const open = pr.pledges.filter(x => x.status === 'en_cours');
    for (const p of open) p.status = 'trahie';
    if (open.length) {
      d.player.stats.credibility = clamp(d.player.stats.credibility - 2 * open.length);
      d.player.stats.popularity = clamp(d.player.stats.popularity - open.length);
      pushNews(d, 'actu', 'negative', `${open.length} promesse(s) non tenue(s)`, open.map(p => p.theme).join(', ') + ' : le bilan du quinquennat est sévère sur ces points.');
    }
  }
}

export const PLEDGE_DOMAIN_LABEL = (p: Pledge) => DOMAIN_LABELS[p.domain];

/** Bonus électoral : les engagements tenus comptent à la réélection */
export function pledgeBonus(d: GameState): number {
  const ps = pledges(d);
  if (!ps.length) return 0;
  const kept = ps.filter(x => x.status === 'tenue').length;
  const broken = ps.filter(x => x.status === 'trahie' || x.status === 'abandonnee').length;
  return clamp((kept - broken * 0.7) * 0.8, -5, 5);
}

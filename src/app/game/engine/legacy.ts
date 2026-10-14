import { ActionDefinition, DOMAINS, DOMAIN_LABELS, Domain, Effect, EffectContext, ElectionType, GameState, Law, Quote } from '../models/game.models';
import { RANKS, rankOrder } from '../data/ranks';
import { DOMAIN_SEGMENTS, accountability, electorate } from './country';
import { pushNews } from './effects';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Ce qui reste de vous : une image (« l'écolo », « le ou la
 *  gestionnaire »…) qui se forge lentement, des petites phrases
 *  qui deviennent cultes ou vous collent à la peau, des lois qui
 *  vivent après leur vote (évaluées, parfois abrogées), et, à la
 *  fin, l'épilogue : rues, statues et note des historiens.
 * ============================================================ */

/* ── Réputation par thème ──────────────────────────────────── */

export const IMAGE_LABELS: Record<Domain, string> = {
  economie: 'le ou la gestionnaire', social: 'la voix du social', ecologie: 'l’écolo', securite: 'le ou la sécuritaire', justice: 'le ou la juriste',
  education: 'l’ami·e de l’école', sante: 'la blouse blanche', numerique: 'le ou la geek', territoires: 'l’élu·e des campagnes', diplomatie: 'le ou la diplomate',
};

export function reputation(d: GameState): Record<Domain, number> {
  if (!d.reputation) d.reputation = Object.fromEntries(DOMAINS.map(x => [x, 0])) as Record<Domain, number>;
  return d.reputation;
}

/** Les deux images dominantes (au-dessus de 12) */
export function topImages(d: GameState): { domain: Domain; label: string; value: number }[] {
  const r = d.reputation ?? {};
  return (Object.entries(r) as [Domain, number][])
    .filter(([, v]) => v >= 12).sort((a, b) => b[1] - a[1]).slice(0, 2)
    .map(([domain, value]) => ({ domain, label: IMAGE_LABELS[domain], value: Math.round(value) }));
}

/** Chaque action forge (lentement) votre image */
export function actionImage(d: GameState, action: ActionDefinition, ctx: EffectContext): void {
  const r = reputation(d);
  const domains = new Set<Domain>();
  if (ctx.domain) domains.add(ctx.domain);
  for (const e of action.effects) if (e.kind === 'dossier' && e.domain !== '$domain') domains.add(e.domain);
  if (action.category === 'territoire' || action.category === 'terrain') domains.add('territoires');
  if (action.category === 'international') domains.add('diplomatie');
  for (const dom of domains) r[dom] = clamp(r[dom] + 1.4);
}

/** Chaque mois, l'image s'estompe… lentement */
export function monthlyImage(d: GameState): void {
  const r = reputation(d);
  for (const dom of DOMAINS) r[dom] = Math.round(r[dom] * 0.985 * 10) / 10;
}

/** Bonus électoral de l'image : être identifié·e sur le sujet du moment */
export function imageBonus(d: GameState, type: ElectionType): number {
  if (type === 'primaire' || !d.reputation) return 0;
  const r = d.reputation;
  const top = Math.max(...Object.values(r));
  return clamp(r[d.agendaDomain] / 12 + top / 40, 0, 7);
}

/* ── Petites phrases ───────────────────────────────────────── */

export function quotes(d: GameState): Quote[] {
  return (d.quotes ??= []);
}

/** Une formule lâchée en public : culte, boulet, ou vite oubliée */
export function sayQuote(d: GameState, text: string, bold: number, rng: Rng): string[] {
  const roll = rng.next();
  const culte = roll < 0.25 + bold * 0.35;
  const boulet = !culte && roll > 0.85 - bold * 0.45;
  const s = d.player.stats;
  if (culte) {
    quotes(d).push({ id: nextId(d, 'q'), text, week: d.week, fame: 'culte' });
    s.popularity = clamp(s.popularity + 3);
    s.influence = clamp(s.influence + 1);
    pushNews(d, 'actu', 'positive', 'Une phrase devenue culte', `« ${text} » : t-shirts, mèmes, reprises à la radio.`);
    return ['La phrase devient culte', 'Popularité +3', 'Influence +1'];
  }
  if (boulet) {
    quotes(d).push({ id: nextId(d, 'q'), text, week: d.week, fame: 'boulet' });
    s.popularity = clamp(s.popularity - 2);
    s.credibility = clamp(s.credibility - 2);
    pushNews(d, 'scandale', 'negative', 'Une phrase qui colle à la peau', `« ${text} » tourne en boucle, sortie de son contexte. Elle vous suivra longtemps.`);
    return ['La phrase vous colle à la peau', 'Popularité −2', 'Crédibilité −2'];
  }
  return ['La phrase passe inaperçue'];
}

/** Chaque mois : les phrases ressortent, surtout en campagne */
export function monthlyQuotes(d: GameState, rng: Rng): void {
  const list = d.quotes ?? [];
  if (!list.length) return;
  const campaign = d.elections.some(e => !e.resolved && e.week - d.week <= 3) || d.player.finances.legalCeiling !== null;
  for (const q of list) {
    if (d.week - q.week < 6) continue;
    if (q.fame === 'boulet' && rng.chance(campaign ? 0.12 : 0.02)) {
      d.player.stats.popularity = clamp(d.player.stats.popularity - 1.5);
      pushNews(d, 'actu', 'negative', 'On vous ressort votre phrase', `« ${q.text} » : vos adversaires la placardent sur leurs affiches.`);
      break;
    }
    if (q.fame === 'culte' && campaign && rng.chance(0.08)) {
      d.player.stats.popularity = clamp(d.player.stats.popularity + 1);
      pushNews(d, 'actu', 'positive', 'Votre phrase en meeting', `La foule scande « ${q.text} » avant même que vous preniez la parole.`);
      break;
    }
  }
}

export function quoteBonus(d: GameState, type: ElectionType): number {
  if (type === 'primaire' || !d.quotes?.length) return 0;
  const c = d.quotes.filter(q => q.fame === 'culte').length;
  const b = d.quotes.filter(q => q.fame === 'boulet').length;
  return clamp(Math.min(3, c) - Math.min(3, b), -3, 3);
}

/* ── Héritage législatif ───────────────────────────────────── */

export function laws(d: GameState): Law[] {
  return (d.laws ??= []);
}

export function recordLaw(d: GameState, title: string, domain: Domain): void {
  laws(d).push({ id: nextId(d, 'loi'), title, domain, week: d.week, mastery: Math.round(d.player.dossiers[domain]?.mastery ?? 30), status: 'en_vigueur' });
  if (laws(d).length > 40) laws(d).splice(0, laws(d).length - 40);
}

/** Chaque mois : évaluation à trois ans, abrogation possible par vos successeurs */
export function monthlyLaws(d: GameState, rng: Rng): void {
  const s = d.player.stats;
  const out = accountability(d) <= 0;
  for (const l of d.laws ?? []) {
    if (l.status !== 'en_vigueur') continue;
    const age = d.week - l.week;
    if (age >= 36) {
      const ok = rng.chance(clamp(0.35 + l.mastery / 150 + (d.economy ? (8 - d.economy.unemployment) / 40 : 0), 0.15, 0.9));
      l.status = 'evaluee';
      l.verdict = ok ? 'succes' : 'echec';
      if (ok) {
        s.credibility = clamp(s.credibility + 3); s.popularity = clamp(s.popularity + 2);
        const off = electorate(d).offsets;
        for (const [seg, v] of Object.entries(DOMAIN_SEGMENTS[l.domain]) as [keyof typeof off, number][]) off[seg] = clamp(off[seg] + v * 2, -30, 30);
        pushNews(d, 'actu', 'positive', `Trois ans après, « ${l.title} » a tenu ses promesses`, 'Le rapport d’évaluation est élogieux. Votre nom y est cité.');
      } else {
        s.credibility = clamp(s.credibility - 2);
        pushNews(d, 'actu', 'negative', `Trois ans après, « ${l.title} » déçoit`, 'Effets limités, coûts sous-estimés : le rapport est sévère.');
      }
      break;
    }
    if (out && age >= 12 && rng.chance(0.015)) {
      l.status = 'abrogee';
      s.popularity = clamp(s.popularity + (rng.chance(0.5) ? 1 : -1));
      pushNews(d, 'actu', 'neutral', `Vos successeurs abrogent « ${l.title} »`, 'La nouvelle majorité défait ce que vous aviez construit.');
      break;
    }
  }
}

/* ── Épilogue ──────────────────────────────────────────────── */

export interface Epilogue {
  grade: number;
  verdict: string;
  streets: number;
  schools: number;
  statue: string | null;
  chapters: string[];
}

export function epilogue(d: GameState): Epilogue {
  const p = d.player;
  const mandates = Number(p.flags['presMandates'] ?? 0);
  const bestOrder = Math.max(Number(p.flags['bestRankOrder'] ?? 0), rankOrder(p.rankId));
  const rankPts = mandates > 0 ? 7 + mandates : bestOrder >= rankOrder('premier_ministre') ? 6 : bestOrder >= rankOrder('ministre') ? 5 : bestOrder >= rankOrder('depute') ? 3.5 : bestOrder >= rankOrder('conseiller_municipal') ? 2 : 1;
  const wins = d.milestones.filter(m => m.kind === 'victoire').length;
  const setbacks = d.milestones.filter(m => m.kind === 'revers').length;
  const good = (d.laws ?? []).filter(l => l.verdict === 'succes').length;
  const bad = (d.laws ?? []).filter(l => l.verdict === 'echec').length;
  const cultes = (d.quotes ?? []).filter(q => q.fame === 'culte').length;
  const boulets = (d.quotes ?? []).filter(q => q.fame === 'boulet').length;
  const condemned = d.milestones.some(m => m.title === 'Condamné·e');
  const raw = rankPts + wins * 0.45 - setbacks * 0.3 + good * 0.8 - bad * 0.3 + Number(p.flags['reformsTotal'] ?? 0) * 0.25
    + cultes * 0.3 - boulets * 0.3 - (condemned ? 3 : 0) + (p.stats.credibility - 50) / 25;
  const grade = Math.round(clamp(raw * 1.3 + 2, 0, 20));
  const verdict = grade >= 17 ? 'Un·e géant·e de la République.' : grade >= 14 ? 'Un grand nom de la vie politique française.' : grade >= 11 ? 'Une carrière respectable, des réussites réelles.'
    : grade >= 8 ? 'Une trace modeste, des regrets.' : 'Les historiens vous citeront… en note de bas de page.';
  const streets = Math.max(0, Math.round((grade - 6) ** 2 / 2));
  const schools = Math.max(0, Math.round((grade - 9) * 1.5));
  const town = d.territory?.name.replace(/^Circonscription (de |d’)/, '') ?? 'votre ville natale';
  const statue = grade >= 15 ? `Une statue de bronze sur la grand-place de ${town}` : grade >= 12 ? `Un buste devant la mairie de ${town}` : null;
  const born = Math.floor(p.age - (d.week - 1) / 12);
  const chapters = [
    `Les débuts — ${born} ans, une carte du parti « ${d.party.name} » en poche.`,
    ...d.milestones.filter(m => m.kind !== 'carriere' || /Coalition|Mariage|Naissance|pacte|exploit/i.test(m.title)).slice(0, 8).map(m => `${m.age} ans — ${m.title}`),
    `Le sommet — ${mandates ? `${mandates} mandat${mandates > 1 ? 's' : ''} à l’Élysée` : RANKS[(Object.values(RANKS).find(r => r.order === bestOrder)?.id ?? p.rankId) as keyof typeof RANKS]?.label ?? 'Une vie d’engagement'}.`,
    ...(good ? [`L’héritage — ${good} loi${good > 1 ? 's' : ''} saluée${good > 1 ? 's' : ''} par les évaluations.`] : []),
    ...(cultes ? [`La postérité — « ${(d.quotes ?? []).find(q => q.fame === 'culte')!.text} »`] : []),
  ];
  return { grade, verdict, streets, schools, statue, chapters };
}

/** Effet « quote » */
export function adjustQuote(d: GameState, e: Extract<Effect, { kind: 'quote' }>, rng: Rng): string[] {
  return sayQuote(d, e.text, e.bold, rng);
}

export function lawsByStatus(d: GameState): { title: string; domain: string; status: string }[] {
  return [...(d.laws ?? [])].reverse().slice(0, 8).map(l => ({
    title: l.title, domain: DOMAIN_LABELS[l.domain],
    status: l.status === 'abrogee' ? 'abrogée' : l.verdict === 'succes' ? 'saluée' : l.verdict === 'echec' ? 'décevante' : 'en vigueur',
  }));
}


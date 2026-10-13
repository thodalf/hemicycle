import { CrisisArc, CrisisArcId, Effect, GameState, RankId } from '../models/game.models';
import { RANKS } from '../data/ranks';
import { pushNews } from './effects';
import { addMilestone } from './life';
import { localBonus } from './territory';
import { Rng, clamp } from './rng';

/* ============================================================
 *  Quatre crises au long cours, chacune avec une jauge à faire
 *  monter et un risque à contenir, et un dénouement à date fixe :
 *  cyberattaque, procès, Jeux olympiques, dissolution surprise.
 * ============================================================ */

export interface CrisisDef {
  id: CrisisArcId;
  icon: string;
  label: string;
  gaugeLabel: string;
  riskLabel: string;
  months: number;
  /** Dérive mensuelle */
  drift: { gauge: number; risk: number };
  stages: string[];
}

export const CRISES: Record<CrisisArcId, CrisisDef> = {
  cyber: { id: 'cyber', icon: '💻', label: 'Cyberattaque', gaugeLabel: 'Systèmes restaurés', riskLabel: 'Fuites de données', months: 6, drift: { gauge: 5, risk: 5 },
    stages: ['Hôpitaux, mairies et Assemblée paralysés. Une rançon est exigée.', 'Les équipes de l’ANSSI reprennent la main, serveur par serveur.', 'Les derniers systèmes redémarrent. Reste à savoir qui a frappé.'] },
  proces: { id: 'proces', icon: '⚖️', label: 'Votre procès', gaugeLabel: 'Solidité de la défense', riskLabel: 'Poids des charges', months: 8, drift: { gauge: 2, risk: 3 },
    stages: ['Garde à vue, perquisition : une vieille affaire refait surface.', 'Mise en examen. Le juge d’instruction épluche vos comptes.', 'Audiences publiques. Le verdict approche.'] },
  jo: { id: 'jo', icon: '🏅', label: 'Les Jeux olympiques', gaugeLabel: 'Préparation', riskLabel: 'Dérapages (coûts, grèves)', months: 18, drift: { gauge: 4, risk: 3.5 },
    stages: ['La France obtient les Jeux. Les chantiers commencent.', 'Village olympique, transports, sécurité : tout doit être prêt.', 'Dernière ligne droite : la flamme arrive.'] },
  dissolution: { id: 'dissolution', icon: '🗳️', label: 'Dissolution surprise', gaugeLabel: 'Campagne éclair', riskLabel: 'Vague adverse', months: 1, drift: { gauge: 6, risk: 4 },
    stages: ['Le président dissout l’Assemblée. Trois semaines pour sauver votre siège.'] },
  krach: { id: 'krach', icon: '📉', label: 'Krach financier', gaugeLabel: 'Confiance des marchés', riskLabel: 'Chômage', months: 8, drift: { gauge: 3, risk: 4 },
    stages: ['La Bourse perd 20 % en trois jours. Une grande banque vacille.', 'Faillites en cascade, plans sociaux, crédit gelé.', 'Les marchés guettent le moindre signe de reprise.'] },
  megafeux: { id: 'megafeux', icon: '🔥', label: 'Méga-feux', gaugeLabel: 'Moyens engagés', riskLabel: 'Hectares brûlés', months: 4, drift: { gauge: 5, risk: 7 },
    stages: ['Sécheresse historique : des feux géants dans le Sud et les Landes.', 'Les fronts de flammes avancent ; des villages sont évacués.', 'Les pluies se font attendre. Les pompiers sont à bout.'] },
  agriculteurs: { id: 'agriculteurs', icon: '🚜', label: 'La révolte des campagnes', gaugeLabel: 'Dialogue', riskLabel: 'Blocages', months: 5, drift: { gauge: 3, risk: 5 },
    stages: ['Des milliers de tracteurs bloquent les autoroutes.', 'Fumier devant les préfectures, ronds-points occupés.', 'Le mouvement hésite entre l’accord et l’escalade.'] },
  taupe: { id: 'taupe', icon: '🕵️', label: 'Une taupe au cœur de l’État', gaugeLabel: 'Contre-espionnage', riskLabel: 'Secrets livrés', months: 6, drift: { gauge: 4, risk: 5 },
    stages: ['Des notes confidentielles finissent chez une puissance étrangère.', 'Le cercle des suspects se resserre. Tout le monde se méfie de tout le monde.', 'La DGSI pense tenir une piste.'] },
};

export function crises(d: GameState): Partial<Record<CrisisArcId, CrisisArc>> {
  return (d.crises ??= {});
}

export function activeCrises(d: GameState): [CrisisArcId, CrisisArc][] {
  return Object.entries(d.crises ?? {}).filter(([, a]) => !!a) as [CrisisArcId, CrisisArc][];
}

export function crisisStage(d: GameState, id: CrisisArcId, a: CrisisArc): string {
  const def = CRISES[id];
  const t = (d.week - a.since) / def.months;
  return def.stages[Math.min(def.stages.length - 1, Math.floor(t * def.stages.length))];
}

export function adjustCrisis(d: GameState, e: Extract<Effect, { kind: 'crisis' }>): string[] {
  const all = crises(d);
  const def = CRISES[e.arc];
  if (e.start) {
    if (all[e.arc]) return [];
    all[e.arc] = { since: d.week, months: def.months, gauge: clamp(30 + (e.gauge ?? 0)), risk: clamp(30 + (e.risk ?? 0)), meta: e.meta };
    pushNews(d, 'actu', 'negative', def.label, `${def.stages[0]} Nouvel onglet : Crise.`);
    return [`${def.label} : la crise commence`];
  }
  const a = all[e.arc];
  if (!a) return [];
  const out: string[] = [];
  const sg = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  if (e.gauge) { a.gauge = clamp(a.gauge + e.gauge); out.push(`${def.gaugeLabel} ${sg(e.gauge)}`); }
  if (e.risk) { a.risk = clamp(a.risk + e.risk); out.push(`${def.riskLabel} ${sg(e.risk)}`); }
  return out;
}

/** Chaque mois : les crises évoluent, et se dénouent à leur terme */
export function monthlyCrises(d: GameState, rng: Rng): void {
  for (const [id, a] of activeCrises(d)) {
    const def = CRISES[id];
    a.gauge = clamp(a.gauge + def.drift.gauge * rng.range(0.5, 1.3));
    a.risk = clamp(a.risk + def.drift.risk * rng.range(0.5, 1.4) + (id === 'proces' ? d.player.scandalExposure / 40 : 0));
    if (d.week - a.since >= a.months) resolve(d, id, a, rng);
  }
}

function setRank(d: GameState, rank: RankId): void {
  d.player.rankId = rank;
  d.player.actionPoints.max = RANKS[rank].monthlyActionPoints;
  d.player.actionPoints.current = Math.min(d.player.actionPoints.current, d.player.actionPoints.max);
}

function resolve(d: GameState, id: CrisisArcId, a: CrisisArc, rng: Rng): void {
  delete crises(d)[id];
  const p = d.player;
  const s = p.stats;
  const win = (title: string, text: string) => { addMilestone(d, 'victoire', title, text); pushNews(d, 'actu', 'positive', title, text); };
  const lose = (title: string, text: string) => { addMilestone(d, 'revers', title, text); pushNews(d, 'actu', 'negative', title, text); };
  switch (id) {
    case 'cyber':
      if (a.gauge >= 60 && a.risk < 60) {
        s.credibility = clamp(s.credibility + 6); s.influence = clamp(s.influence + 3);
        win('La cyberattaque repoussée', `Tous les systèmes sont rétablis${a.meta ? ` ; l’attaque est attribuée à ${a.meta}` : ''}. Votre sang-froid est salué.`);
      } else {
        s.popularity = clamp(s.popularity - 6); s.credibility = clamp(s.credibility - 5);
        lose('La paralysie numérique', 'Des données de millions de Français circulent en ligne. On vous reproche la lenteur de la riposte.');
      }
      break;
    case 'proces': {
      const lawyer = p.staff.includes('juriste') ? 0.12 : 0;
      const acquit = rng.chance(clamp(a.gauge / (a.gauge + a.risk) + lawyer, 0.05, 0.95));
      if (acquit) {
        s.credibility = clamp(s.credibility + 6); s.popularity = clamp(s.popularity + 3);
        p.scandalExposure = clamp(p.scandalExposure - 20);
        win('Relaxé·e', 'Le tribunal vous relaxe. Vous sortez du palais de justice sous les flashs, la tête haute.');
      } else {
        s.credibility = clamp(s.credibility - 12); s.popularity = clamp(s.popularity - 10);
        p.flags['ineligibleUntil'] = d.week + 24;
        if (p.rankId === 'ministre' || p.rankId === 'premier_ministre') { d.portfolio = null; d.government = null; setRank(d, 'depute'); }
        lose('Condamné·e', 'Prison avec sursis et deux ans d’inéligibilité. Vous faites appel… sans grand espoir.');
      }
      break;
    }
    case 'jo':
      p.flags['joDone'] = true;
      if (a.gauge >= 65 && a.risk < 55) {
        s.popularity = clamp(s.popularity + 10); s.influence = clamp(s.influence + 5);
        if (d.presidency) d.presidency.approval = clamp(d.presidency.approval + 8);
        win('Des Jeux inoubliables', 'Cérémonie d’ouverture grandiose, moisson de médailles, pays en liesse. On vous associe à la réussite.');
      } else if (a.gauge >= 45) {
        s.popularity = clamp(s.popularity + 3);
        pushNews(d, 'actu', 'neutral', 'Des Jeux réussis, malgré tout', 'Quelques couacs, beaucoup d’émotions : un bilan honorable.');
      } else {
        s.popularity = clamp(s.popularity - 8); s.credibility = clamp(s.credibility - 4);
        lose('Le fiasco olympique', 'Transports saturés, budget explosé, piscine pas finie : le monde entier se moque.');
      }
      break;
    case 'krach':
      if (a.gauge >= 55 && a.risk < 60) {
        s.credibility = clamp(s.credibility + 6); s.influence = clamp(s.influence + 3);
        win('La crise financière surmontée', 'Les marchés repartent, l’emploi tient. On salue votre sang-froid.');
      } else {
        s.popularity = clamp(s.popularity - 6); s.credibility = clamp(s.credibility - 4);
        if (d.presidency) d.presidency.approval = clamp(d.presidency.approval - 8);
        lose('La récession', 'Un million de chômeurs de plus. On vous reproche d’avoir tardé.');
      }
      break;
    case 'megafeux':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 5);
        win('Les feux maîtrisés', 'Les derniers foyers sont éteints. Les pompiers défilent sous les applaudissements.');
      } else {
        s.popularity = clamp(s.popularity - 5);
        lose('Un été de cendres', 'Des dizaines de milliers d’hectares partis en fumée. La colère gronde.');
      }
      break;
    case 'agriculteurs':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); p.dossiers.territoires.mastery = clamp(p.dossiers.territoires.mastery + 5);
        win('L’accord avec les campagnes', 'Un accord historique : les tracteurs rentrent à la ferme.');
      } else {
        s.popularity = clamp(s.popularity - 4); s.stress = clamp(s.stress + 8);
        lose('Les campagnes en colère', 'Le mouvement s’essouffle sans accord. La rancœur, elle, reste.');
      }
      break;
    case 'taupe':
      if (a.gauge >= 60) {
        s.credibility = clamp(s.credibility + 5); s.influence = clamp(s.influence + 3);
        win('La taupe démasquée', 'Arrêtée à l’aube : un haut fonctionnaire au service d’une puissance étrangère.');
      } else {
        s.credibility = clamp(s.credibility - 5);
        lose('La taupe a filé', 'Elle a quitté le pays avec des secrets d’État. Le Parlement réclame des comptes.');
      }
      break;
    case 'dissolution': {
      const chance = clamp(0.35 + (a.gauge - a.risk) / 100 + localBonus(d) / 100 + s.popularity / 250, 0.08, 0.95);
      if (rng.chance(chance)) {
        s.popularity = clamp(s.popularity + 3); s.influence = clamp(s.influence + 3);
        win('Réélu·e après la dissolution', 'Au soir du second tour, votre siège est sauvé. Beaucoup de collègues n’ont pas eu cette chance.');
      } else {
        if (p.rankId === 'depute') setRank(d, 'conseiller_municipal');
        p.flags['nextElectionWeek'] = d.week + 8;
        s.influence = clamp(s.influence - 6);
        lose('Battu·e aux législatives anticipées', 'La vague adverse emporte votre siège. Retour au conseil municipal.');
      }
      break;
    }
  }
}

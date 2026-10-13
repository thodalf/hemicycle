import { economy, electorate } from './country';
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
  blackout: { id: 'blackout', icon: '⚡', label: 'Le grand black-out', gaugeLabel: 'Réseau rétabli', riskLabel: 'Pannes et pillages', months: 3, drift: { gauge: 6, risk: 6 },
    stages: ['Un froid polaire, une panne en cascade : la moitié du pays dans le noir.', 'Délestages tournants, hôpitaux sur groupes électrogènes, commerces pillés.', 'Le réseau se reconstruit poste par poste.'] },
  crue: { id: 'crue', icon: '🌊', label: 'Paris sous les eaux', gaugeLabel: 'Protection des quartiers', riskLabel: 'Niveau de la Seine', months: 3, drift: { gauge: 5, risk: 7 },
    stages: ['La Seine monte de vingt centimètres par heure : la crue centennale est là.', 'Métro fermé, caves inondées, le Louvre évacue ses réserves.', 'La décrue se fait attendre. Les sinistrés comptent leurs pertes.'] },
  secheresse: { id: 'secheresse', icon: '💧', label: 'La guerre de l’eau', gaugeLabel: 'Partage de l’eau', riskLabel: 'Pénurie', months: 6, drift: { gauge: 3, risk: 5 },
    stages: ['Nappes phréatiques au plus bas : arrêtés de restriction dans soixante départements.', 'Agriculteurs contre villes, golfs contre maraîchers : chacun réclame son eau.', 'Des villages ravitaillés par camions-citernes.'] },
  autonomie: { id: 'autonomie', icon: '🏝️', label: 'Une région réclame son autonomie', gaugeLabel: 'Dialogue', riskLabel: 'Tensions', months: 8, drift: { gauge: 3, risk: 4 },
    stages: ['L’assemblée régionale vote une motion pour un statut d’autonomie.', 'Manifestations, drapeaux, négociations à huis clos avec l’État.', 'Le compromis est à portée de main… ou la rupture.'] },
  ia: { id: 'ia', icon: '🤖', label: 'L’IA de l’État déraille', gaugeLabel: 'Contrôle', riskLabel: 'Décisions absurdes', months: 5, drift: { gauge: 4, risk: 5 },
    stages: ['L’algorithme qui gère les aides sociales suspend 200 000 allocations sans raison.', 'Impôts recalculés au hasard, convocations absurdes : la confiance s’effondre.', 'Les ingénieurs tentent de comprendre ce que la machine a appris.'] },
  frelons: { id: 'frelons', icon: '🐝', label: 'L’invasion des frelons géants', gaugeLabel: 'Pièges posés', riskLabel: 'Ruches détruites', months: 4, drift: { gauge: 5, risk: 6 },
    stages: ['Des nuées de frelons géants s’abattent sur les ruchers du Sud-Ouest.', 'Pique-niques annulés, apiculteurs désespérés, pots de miel hors de prix.', 'Pièges, nids détruits, appel aux volontaires : la riposte s’organise.'] },
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
    case 'blackout':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 5);
        win('La lumière revenue', 'Le réseau électrique est rétabli partout. On salue la mobilisation des techniciens… et la vôtre.');
      } else {
        s.popularity = clamp(s.popularity - 6);
        economy(d).growth -= 0.4;
        lose('La nuit noire', 'Trois semaines de coupures, des entreprises à l’arrêt : le pays vous en veut.');
      }
      break;
    case 'crue':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 5);
        win('Paris sauvé des eaux', 'Les digues ont tenu, les quartiers ont été protégés. Les images des sacs de sable font le tour du monde.');
      } else {
        s.popularity = clamp(s.popularity - 5);
        economy(d).confidence = clamp(economy(d).confidence - 5);
        lose('La Seine a tout emporté', 'Des milliards de dégâts, des milliers de sinistrés. L’État a été lent.');
      }
      break;
    case 'secheresse':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 4);
        electorate(d).offsets.ruraux = clamp(electorate(d).offsets.ruraux + 4, -30, 30);
        win('Le pacte de l’eau', 'Un accord de partage entre agriculteurs, villes et industriels. Les pluies d’automne font le reste.');
      } else {
        s.popularity = clamp(s.popularity - 5);
        electorate(d).offsets.ruraux = clamp(electorate(d).offsets.ruraux - 5, -30, 30);
        lose('Les robinets à sec', 'Des villages privés d’eau tout l’été. Le monde rural ne pardonne pas.');
      }
      break;
    case 'autonomie':
      if (a.gauge >= 55 && a.risk < 60) {
        s.influence = clamp(s.influence + 4); s.credibility = clamp(s.credibility + 3);
        win('Un statut d’autonomie négocié', `${a.meta ?? 'La région'} obtient de nouvelles compétences, dans la République. Un compromis salué des deux côtés.`);
      } else if (a.risk >= 70) {
        s.popularity = clamp(s.popularity - 4); s.stress = clamp(s.stress + 8);
        lose('La rupture', `Les négociations avec ${a.meta ?? 'la région'} échouent dans la colère. Les tensions dureront des années.`);
      } else {
        pushNews(d, 'actu', 'neutral', 'Statu quo', `Ni accord ni rupture avec ${a.meta ?? 'la région'} : le dossier est renvoyé à plus tard.`);
      }
      break;
    case 'ia':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 5);
        electorate(d).offsets.jeunes = clamp(electorate(d).offsets.jeunes + 3, -30, 30);
        win('L’IA remise au pas', 'Algorithme audité, décisions corrigées, contrôle humain rétabli : un modèle cité en Europe.');
      } else {
        s.credibility = clamp(s.credibility - 6);
        lose('Le scandale de l’algorithme', 'Des familles privées d’aides pendant des mois. La commission d’enquête sera sévère.');
      }
      break;
    case 'frelons':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 3);
        electorate(d).offsets.ruraux = clamp(electorate(d).offsets.ruraux + 3, -30, 30);
        win('Les frelons vaincus', 'Les ruchers repartent, le miel revient sur les marchés. On vous surnomme « l’apiculteur de la République ».');
      } else {
        s.popularity = clamp(s.popularity - 2);
        electorate(d).offsets.ruraux = clamp(electorate(d).offsets.ruraux - 4, -30, 30);
        lose('Le miel a disparu', 'Un tiers des ruches détruites. Les apiculteurs manifestent en combinaison devant la préfecture.');
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

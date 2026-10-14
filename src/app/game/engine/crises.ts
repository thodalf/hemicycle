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
  mars: { id: 'mars', icon: '🚀', label: 'La France sur Mars', gaugeLabel: 'Préparation de la mission', riskLabel: 'Risques techniques', months: 10, drift: { gauge: 4, risk: 4 },
    stages: ['Le programme « Lutèce » est lancé : quatre astronautes français vers Mars.', 'La fusée prend forme à Kourou ; les budgets aussi.', 'Compte à rebours. Le monde entier regarde.'] },
  napoleon: { id: 'napoleon', icon: '🎩', label: 'Le retour de Napoléon', gaugeLabel: 'Riposte républicaine', riskLabel: 'Fièvre bonapartiste', months: 8, drift: { gauge: 3, risk: 5 },
    stages: ['Un homme en bicorne affirme être Napoléon, cloné à partir d’une mèche de cheveux.', 'Ses meetings font salle comble ; ses grognards défilent sur les Champs.', 'Il annonce son « retour de l’île d’Elbe » : une marche sur Paris.'] },
  atlantide: { id: 'atlantide', icon: '🏛️', label: 'L’Atlantide refait surface', gaugeLabel: 'Souveraineté française', riskLabel: 'Convoitises étrangères', months: 8, drift: { gauge: 3, risk: 4 },
    stages: ['Une île inconnue émerge au large de la Bretagne, couverte de ruines de marbre.', 'Archéologues, pêcheurs et marines étrangères se disputent les lieux.', 'L’ONU doit trancher : à qui appartient l’Atlantide ?'] },
  ia_candidate: { id: 'ia_candidate', icon: '🖥️', label: 'Une IA candidate à la présidentielle', gaugeLabel: 'Débat démocratique', riskLabel: 'Sondages de l’IA', months: 6, drift: { gauge: 3, risk: 6 },
    stages: ['« ALMA », une intelligence artificielle, annonce sa candidature. Elle promet zéro mensonge.', 'Elle répond à des millions d’électeurs en même temps. Les sondages s’affolent.', 'Le Conseil constitutionnel doit se prononcer. Le débat fait rage.'] },
  grand_hiver: { id: 'grand_hiver', icon: '🌋', label: 'Le grand hiver', gaugeLabel: 'Résilience du pays', riskLabel: 'Pénuries', months: 18, drift: { gauge: 3, risk: 4 },
    stages: ['Un volcan islandais a obscurci le ciel : l’été n’est pas venu.', 'Récoltes perdues, rationnement, files d’attente devant les boulangeries.', 'Les premiers rayons percent. Il faut tenir encore un peu.'] },
  sosie: { id: 'sosie', icon: '🎭', label: 'Votre sosie', gaugeLabel: 'Vérité rétablie', riskLabel: 'Dégâts du sosie', months: 6, drift: { gauge: 3, risk: 5 },
    stages: ['Un homme qui vous ressemble trait pour trait inaugure des ronds-points à votre place.', 'Le sosie donne des interviews, signe des pétitions et contredit vos discours.', 'Il annonce votre ralliement… au parti adverse. Il faut le démasquer.'] },
  templiers: { id: 'templiers', icon: '🗝️', label: 'Le trésor des Templiers', gaugeLabel: 'Fouilles officielles', riskLabel: 'Pillards et fièvre', months: 7, drift: { gauge: 3, risk: 5 },
    stages: ['Une crypte scellée est découverte sous une église de votre département : des coffres frappés de la croix templière.', 'Chasseurs de trésor, youtubeurs et illuminés campent autour du chantier.', 'Les archéologues s’apprêtent à ouvrir le dernier coffre.'] },
  eurovision: { id: 'eurovision', icon: '🎤', label: 'L’Eurovision en France', gaugeLabel: 'Préparation du show', riskLabel: 'Risque de fiasco', months: 8, drift: { gauge: 4, risk: 4 },
    stages: ['La France a gagné l’Eurovision : elle accueille la prochaine édition, et votre ville est candidate.', 'Salle, hôtels, sécurité, polémiques sur la chanson française : le chantier est immense.', 'Grande finale en direct devant 160 millions de téléspectateurs.'] },
  greve_generale: { id: 'greve_generale', icon: '✊', label: 'La grève générale', gaugeLabel: 'Dialogue social', riskLabel: 'Paralysie du pays', months: 5, drift: { gauge: 3, risk: 5 },
    stages: ['L’intersyndicale appelle à une grève générale reconductible.', 'Trains à l’arrêt, raffineries bloquées, écoles fermées : le pays tourne au ralenti.', 'Les négociations de la dernière chance s’ouvrent rue de Grenelle.'] },
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
    case 'mars':
      if (a.gauge >= 60 && a.risk < 55) {
        s.popularity = clamp(s.popularity + 10); s.influence = clamp(s.influence + 5);
        d.intl.prestige = clamp(d.intl.prestige + 15);
        win('Des Français sur Mars', 'Le premier pas français sur Mars, en direct devant deux milliards de téléspectateurs. La Marseillaise résonne sur la planète rouge.');
      } else if (a.gauge >= 45) {
        pushNews(d, 'actu', 'neutral', 'Le lancement reporté', 'Trop de doutes techniques : la mission partira plus tard, sans vous comme visage du programme.');
      } else {
        s.popularity = clamp(s.popularity - 8); s.credibility = clamp(s.credibility - 5);
        lose('La catastrophe en direct', 'La fusée explose quarante secondes après le décollage. L’équipage s’en sort par miracle ; votre réputation, moins.');
      }
      break;
    case 'napoleon':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); s.credibility = clamp(s.credibility + 4);
        win('L’Empereur démasqué', 'Le « clone » était un comédien de Montélimar. Il repart en exil volontaire… à Sainte-Hélène, où il ouvre un restaurant.');
      } else {
        s.popularity = clamp(s.popularity - 6);
        if (d.presidency) d.presidency.approval = clamp(d.presidency.approval - 8);
        lose('Le sacre', 'Il se fait couronner sur le parvis de Notre-Dame devant une foule en délire. Son mouvement pèsera désormais dans chaque élection.');
      }
      break;
    case 'atlantide':
      if (a.gauge >= a.risk) {
        d.intl.prestige = clamp(d.intl.prestige + 8);
        economy(d).growth += 0.2;
        win('L’Atlantide française', 'L’ONU reconnaît la souveraineté française. Le premier musée de l’Atlantide ouvre à Brest.');
      } else {
        d.intl.prestige = clamp(d.intl.prestige - 5); s.popularity = clamp(s.popularity - 3);
        lose('L’Atlantide internationalisée', 'L’île est placée sous tutelle internationale. La Bretagne regarde passer les touristes du monde entier.');
      }
      break;
    case 'ia_candidate':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 5);
        electorate(d).offsets.jeunes = clamp(electorate(d).offsets.jeunes + 2, -30, 30);
        win('L’IA renvoyée à ses serveurs', 'Le Conseil constitutionnel rappelle qu’un candidat doit être une personne. Le débat a réveillé la démocratie.');
      } else {
        s.popularity = clamp(s.popularity - 4); s.influence = clamp(s.influence - 3);
        lose('L’IA en tête des sondages', 'Écartée du scrutin in extremis, ALMA reste la personnalité préférée des Français. Les humains ont pris un coup de vieux.');
      }
      break;
    case 'grand_hiver':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 6); s.credibility = clamp(s.credibility + 4);
        win('Le printemps revenu', 'Le soleil reparaît enfin. Le pays a tenu, solidaire, et s’en souviendra.');
      } else {
        s.popularity = clamp(s.popularity - 8);
        economy(d).growth -= 1;
        lose('L’exode', 'Des millions de Français partis vers le Sud, des villages vidés. Le pays mettra des années à se relever.');
      }
      break;
    case 'templiers':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); s.credibility = clamp(s.credibility + 3);
        economy(d).growth += 0.1;
        win('Le trésor au musée', 'Manuscrits, reliquaires et pièces d’or rejoignent un musée flambant neuf. Le tourisme explose dans le département.');
      } else {
        s.credibility = clamp(s.credibility - 4); s.popularity = clamp(s.popularity - 2);
        lose('Le trésor pillé', 'Une nuit de brouillard, la crypte est vidée. Les coffres réapparaissent, un par un, dans des ventes aux enchères à l’étranger.');
      }
      break;
    case 'eurovision':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 5); s.influence = clamp(s.influence + 2);
        electorate(d).offsets.jeunes = clamp(electorate(d).offsets.jeunes + 3, -30, 30);
        d.intl.prestige = clamp(d.intl.prestige + 4);
        win('Une finale de légende', 'Paillettes, feux d’artifice et zéro incident : l’Europe entière parle de la meilleure Eurovision de l’histoire.');
      } else {
        s.popularity = clamp(s.popularity - 4);
        economy(d).deficit += 0.1;
        lose('Douze points de pénalité', 'Panne de son en plein direct, budget explosé, chanteur hué : la France devient la risée du continent.');
      }
      break;
    case 'sosie':
      if (a.gauge >= a.risk) {
        s.credibility = clamp(s.credibility + 5); s.popularity = clamp(s.popularity + 3);
        win('Le sosie démasqué', 'Confondu par une empreinte digitale et un accent belge, le sosie avoue : une caméra cachée qui a très mal tourné. La France rit… avec vous.');
      } else {
        s.credibility = clamp(s.credibility - 6); s.influence = clamp(s.influence - 3);
        lose('Le doute persiste', 'Le sosie s’évapore, mais un tiers des Français croit encore que c’est vous qui avez dansé la macarena au conseil municipal.');
      }
      break;
    case 'greve_generale':
      if (a.gauge >= a.risk) {
        s.popularity = clamp(s.popularity + 4); s.credibility = clamp(s.credibility + 3);
        electorate(d).offsets.populaires = clamp(electorate(d).offsets.populaires + 3, -30, 30);
        win('Les accords de Grenelle II', 'Hausse du SMIC, semaine de quatre jours expérimentée, fin de la grève : syndicats et patronat signent à l’aube.');
      } else {
        s.popularity = clamp(s.popularity - 5);
        economy(d).growth -= 0.4;
        lose('Le pays à l’arrêt', 'Six semaines de paralysie, un trimestre de récession, et une rancune tenace des deux côtés.');
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

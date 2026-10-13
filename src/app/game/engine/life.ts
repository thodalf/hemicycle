import { DeathCause, Decision, GameState, Milestone, RankId } from '../models/game.models';
import { RANKS, START_AGE, rankOrder } from '../data/ranks';
import { WEEKS_PER_MONTH, dateOfTurn, monthlyChance } from './calendar';
import { makeFactions, ofParty } from '../data/world';
import { pushNews } from './effects';
import { owns } from './patrimoine';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  La vie du personnage : âge, santé, mort.
 *  Les victoires et défaites de scénario ne terminent plus la
 *  partie : elles deviennent des chapitres (et parfois des
 *  revers dont on se relève). Seule la mort met fin à la partie :
 *  vieillesse, maladie, accident ou assassinat.
 * ============================================================ */

export const DEATH_LABELS: Record<DeathCause, string> = {
  vieillesse: 'Mort de vieillesse',
  maladie: 'Emporté·e par la maladie',
  accident: 'Mort accidentelle',
  assassinat: 'Assassiné·e',
};

export function startAge(scenario: string): number {
  return START_AGE[scenario] ?? 30;
}

/** Santé « naturelle » à un âge donné */
export function baselineHealth(age: number): number {
  return clamp(100 - Math.max(0, age - 35) * 0.9, 25, 96);
}

export function initialHealth(age: number): number {
  return Math.round(baselineHealth(age) - 6);
}

export function healthLabel(h: number): { label: string; tone: 'good' | 'warn' | 'bad' } {
  if (h >= 78) return { label: 'Excellente santé', tone: 'good' };
  if (h >= 60) return { label: 'Bonne santé', tone: 'good' };
  if (h >= 45) return { label: 'Santé fragile', tone: 'warn' };
  if (h >= 30) return { label: 'Santé préoccupante', tone: 'bad' };
  return { label: 'État critique', tone: 'bad' };
}

/** Mortalité naturelle annuelle (Gompertz), aggravée par une mauvaise santé */
export function annualMortality(age: number, health: number): number {
  return Math.min(0.6, 0.008 * Math.exp(0.095 * (age - 60)) * Math.exp((65 - health) / 18));
}

/** Probabilité mensuelle d'accident mortel */
export function accidentRisk(d: GameState): number {
  const p = d.player;
  let r = 0.000025 * WEEKS_PER_MONTH;
  if (owns(d, ['sportive'])) r *= 3;
  if (owns(d, ['yacht'])) r *= 1.5;
  if (owns(d, ['berline'])) r *= 0.5;
  if (p.stats.energy < 20) r *= 2.5;
  if (p.age > 75) r *= 1.5;
  if (d.presidency) r *= 0.3;
  if (p.staff.includes('chauffeur')) r *= 0.6;
  if (p.staff.includes('garde_du_corps')) r *= 0.85;
  return r;
}

/** Risque annuel d'attentat selon le rang (hors président·e, voir plus bas) */
const ASSASSINATION_BY_RANK: Record<RankId, number> = {
  militant: 0, conseiller_municipal: 0.0001, depute: 0.0003, ministre: 0.001, premier_ministre: 0.002, chef_parti: 0.0008,
  candidat_presidence: 0.002, president: 0.01, ancien_president: 0.0006,
};

/** Probabilité mensuelle d'être assassiné·e */
export function assassinationRisk(d: GameState): number {
  const p = d.player;
  const menace = Number(p.flags['menace'] ?? 0);
  const pres = d.presidency;
  const base = ASSASSINATION_BY_RANK[p.rankId] ?? 0;
  const threat = pres ? pres.threat / 40 : 1 + menace / 25;
  const security = pres ? pres.security : Number(p.flags['protection'] ?? 0);
  const exposure = 1 + Math.max(0, p.scandalExposure - 50) / 100 + (d.mole && d.mole.cover < 30 ? 1 : 0);
  const guard = p.staff.includes('garde_du_corps') ? 0.5 : 1;
  const war = d.war ? 1.3 : 1;
  return (base * threat * exposure * war * guard * (1 - security / 130)) / 12;
}

/** Résumé des risques, affiché au joueur */
/** Le stress use le cœur : multiplicateur de la mortalité naturelle */
export function stressFactor(stress: number): number {
  return 1 + Math.max(0, stress - 50) / 50;
}

/** Risque mensuel d'accident cardiaque ou vasculaire dû au surmenage */
export function stressRisk(d: GameState): number {
  const over = Math.max(0, d.player.stats.stress - 55) / 45;
  return monthlyChance(over * over * 0.0006 * (1 + Math.max(0, d.player.age - 40) / 20) * (d.player.stats.energy < 20 ? 1.5 : 1));
}

export function lifeRisks(d: GameState): { natural: number; stress: number; accident: number; assassination: number } {
  const p = d.player;
  return {
    natural: annualMortality(p.age, p.health) * stressFactor(p.stats.stress),
    stress: 1 - Math.pow(1 - stressRisk(d), 12),
    accident: accidentRisk(d) * 12,
    assassination: Math.min(1, assassinationRisk(d) * 8 * 12),
  };
}

// ── Mort ──────────────────────────────────────────────────

export function die(d: GameState, cause: DeathCause, text: string): void {
  if (d.status === 'mort') return;
  if (d.presidency) text += ' Mort·e en fonction : la Nation organise des obsèques nationales.';
  else if (d.player.rankId === 'ancien_president') text += ' Un hommage national lui est rendu aux Invalides.';
  d.status = 'mort';
  d.death = { week: d.week, age: Math.floor(d.player.age), cause, text };
  d.endTitle = DEATH_LABELS[cause];
  d.endReason = text;
  d.debate = null;
  d.protest = null;
  d.scene = null;
  d.pendingDecisions = [];
  pushNews(d, 'systeme', 'negative', `Disparition de ${d.player.name}`, text);
}

const OLD_AGE_TEXTS = [
  'Paisiblement, dans son sommeil, entouré·e des siens.',
  'Au petit matin, dans sa maison de famille, un livre ouvert sur la table de chevet.',
  'Après une longue vie publique, au terme d’une courte maladie.',
];
const ILLNESS_TEXTS = [
  'Un infarctus foudroyant, en pleine réunion.',
  'Un AVC, quelques jours après un meeting harassant.',
  'Une maladie fulgurante, tenue secrète jusqu’au bout.',
  'Le cœur a lâché. Les médecins avaient pourtant prévenu.',
];
const STRESS_TEXTS = [
  'Une crise cardiaque en pleine nuit, après trois semaines sans dormir. Le surmenage a eu raison de lui·d’elle.',
  'Un AVC au sortir d’une réunion de crise. Ses proches le·la suppliaient de ralentir.',
  'Effondré·e à son bureau, le téléphone encore à la main. Les médecins parlent d’épuisement.',
];
const ACCIDENT_TEXTS = {
  sportive: 'Une sortie de route au volant de sa voiture de sport, sur une départementale mouillée.',
  yacht: 'Un coup de vent au large : le voilier est retrouvé vide.',
  route: 'Un accident de la route, de nuit, entre deux déplacements.',
  helico: 'L’hélicoptère qui le·la ramenait d’un déplacement s’écrase dans le brouillard.',
  chute: 'Une mauvaise chute dans un escalier, un dimanche ordinaire.',
};
export const ASSASSINATION_TEXTS = [
  'Abattu·e à la sortie d’un meeting par un homme seul, aussitôt maîtrisé.',
  'Un attentat à la voiture piégée, revendiqué dans la nuit.',
  'Poignardé·e lors d’un bain de foule. Le pays est sous le choc.',
  'Un tireur embusqué, lors d’une cérémonie officielle.',
];

function accidentText(d: GameState, rng: Rng): string {
  if (owns(d, ['sportive']) && rng.chance(0.5)) return ACCIDENT_TEXTS.sportive;
  if (owns(d, ['yacht']) && rng.chance(0.4)) return ACCIDENT_TEXTS.yacht;
  if (d.player.age > 72 && rng.chance(0.5)) return ACCIDENT_TEXTS.chute;
  return rankOrder(d.player.rankId) >= rankOrder('ministre') && rng.chance(0.4) ? ACCIDENT_TEXTS.helico : ACCIDENT_TEXTS.route;
}

/** Tirages de fin de vie du mois. Renvoie true si le personnage meurt. */
function deathRoll(d: GameState, rng: Rng): boolean {
  const p = d.player;
  // Plus d'assassinat soudain : la menace passe par un complot qui se voit venir (engine/plot.ts)
  if (rng.chance(accidentRisk(d))) {
    die(d, 'accident', accidentText(d, rng));
    return true;
  }
  if (rng.chance(stressRisk(d))) {
    die(d, 'maladie', rng.pick(STRESS_TEXTS));
    return true;
  }
  const acute = p.health < 15 ? monthlyChance((15 - p.health) * 0.003) : 0;
  if (rng.chance(annualMortality(p.age, p.health) * stressFactor(p.stats.stress) / 12 + acute)) {
    const old = p.age >= 72 && rng.chance(0.65);
    die(d, old ? 'vieillesse' : 'maladie', rng.pick(old ? OLD_AGE_TEXTS : ILLNESS_TEXTS));
    return true;
  }
  return false;
}

// ── Mois ───────────────────────────────────────────────

export function adjustHealth(d: GameState, delta: number): string[] {
  const before = d.player.health;
  d.player.health = clamp(before + delta);
  const real = Math.round(d.player.health - before);
  return real ? [`Santé ${real > 0 ? '+' : ''}${real}`] : [];
}

export function weeklyLife(d: GameState, rng: Rng): void {
  if (d.status === 'mort') return;
  const p = d.player;
  const before = Math.floor(p.age);
  p.age += 1 / 12;
  const now = Math.floor(p.age);
  if (now > before) {
    pushNews(d, 'systeme', 'neutral', `${now} ans`, now % 10 === 0
      ? `Une décennie de plus. ${now >= 70 ? 'Les journalistes commencent à préparer votre nécrologie.' : 'Gâteau, bougies, et un sondage sur votre âge.'}`
      : 'Un anniversaire discret entre deux réunions.');
    if (now >= 75) p.stats.energy = clamp(p.stats.energy - 4);
  }
  bestRank(d);

  // Santé : elle suit la santé « naturelle » de l'âge, abîmée par le stress et l'épuisement,
  // entretenue par l'hygiène de vie (sport, cures, bilans)
  const hygiene = Math.min(12, Number(p.flags['hygiene'] ?? 0));
  p.flags['hygiene'] = Math.max(0, Math.round((hygiene - 1) * 100) / 100);
  const target = baselineHealth(p.age) + hygiene
    - Math.max(0, p.stats.stress - 55) * 0.45 - (p.stats.energy < 20 ? 8 : 0)
    - Math.max(0, p.scandalExposure - 70) * 0.1;
  p.health = clamp(p.health + (target - p.health) * 0.2);
  // L'âge use aussi l'énergie
  if (p.age > 60) p.stats.energy = clamp(p.stats.energy - (p.age - 60) * 0.12);
  // La menace qui pèse sur vous s'estompe lentement ; la protection policière aussi
  p.flags['menace'] = Math.min(100, Math.max(0, Number(p.flags['menace'] ?? 0) - 4));
  p.flags['protection'] = Math.min(100, Math.max(0, Number(p.flags['protection'] ?? 0) - 2));

  // Alerte médicale
  const lastAlert = Number(p.flags['lastHealthAlert'] ?? -99);
  if ((p.health < 38 || p.stats.stress >= 88) && d.week - lastAlert >= 3 && !d.pendingDecisions.some(x => x.tag === 'alerte_sante') && rng.chance(0.25)) {
    p.flags['lastHealthAlert'] = d.week;
    d.pendingDecisions.push(healthAlert(d));
  }
  deathRoll(d, rng);
}

function healthAlert(d: GameState): Decision {
  const pres = !!d.presidency;
  return {
    id: nextId(d, 'dec'), tag: 'alerte_sante', week: d.week, deadlineWeek: d.week + 1, source: 'carriere',
    title: 'Alerte médicale',
    context: `Malaise dans votre bureau. Votre médecin est formel : « ${d.player.age >= 65 ? 'À votre âge, ' : ''}si vous continuez à ce rythme, je ne réponds plus de rien. »`,
    choices: [
      { id: 'hopital', label: 'Dix jours d’hospitalisation', effects: [{ kind: 'health', delta: 14 }, { kind: 'stat', stat: 'stress', delta: -20 }, { kind: 'stat', stat: 'energy', delta: -10 }, { kind: 'stat', stat: 'popularity', delta: -2 }, { kind: 'stat', stat: 'influence', delta: -4 }, ...(pres ? [{ kind: 'presidency' as const, approval: -3 }] : [])],
        outcome: 'Examens, repos forcé. Les rumeurs vont bon train, mais vous allez mieux.' },
      { id: 'lever', label: 'Lever le pied pendant un mois', effects: [{ kind: 'health', delta: 8 }, { kind: 'flagAdd', key: 'hygiene', delta: 4 }, { kind: 'stat', stat: 'stress', delta: -12 }, { kind: 'stat', stat: 'influence', delta: -3 }, { kind: 'momentum', delta: -5 }],
        outcome: 'Agenda allégé. Vos adversaires notent votre absence.' },
      { id: 'cacher', label: 'Cacher tout et continuer', effects: [{ kind: 'health', delta: -6 }, { kind: 'stat', stat: 'stress', delta: 5 }],
        outcome: 'Personne n’en saura rien. Votre corps, lui, s’en souviendra.',
        risk: { baseChance: 0.35, onFailure: [{ kind: 'health', delta: -10 }, { kind: 'stat', stat: 'credibility', delta: -6 }, { kind: 'exposure', delta: 6 }], failureNews: 'Un photographe vous surprend entrant à l’hôpital par une porte dérobée. « Que nous cache-t-on ? »' } },
    ],
  };
}

function bestRank(d: GameState): void {
  const order = rankOrder(d.player.rankId);
  if (d.player.rankId !== 'ancien_president' && order > Number(d.player.flags['bestRankOrder'] ?? -1)) d.player.flags['bestRankOrder'] = order;
}

// ── Chapitres : les fins de scénario deviennent des étapes de vie ──

export function addMilestone(d: GameState, kind: Milestone['kind'], title: string, text: string): void {
  d.milestones.push({ week: d.week, age: Math.floor(d.player.age), title, text, kind });
}

/**
 * Appelé à la fin de chaque transaction : une victoire ou une défaite de scénario
 * est consignée comme chapitre, ses conséquences appliquées, et la partie continue.
 */
export function settleEndings(d: GameState): void {
  if (d.status !== 'victoire' && d.status !== 'defaite') return;
  const victory = d.status === 'victoire';
  const title = d.endTitle ?? (victory ? 'Victoire' : 'Traversée du désert');
  const text = d.endReason ?? '';
  d.status = 'en_cours';
  d.endTitle = undefined;
  d.endReason = undefined;
  // Une victoire déjà acquise ne se fête pas deux fois
  if (victory && d.milestones.some(m => m.title === title)) return;
  // Un même revers à répétition ne fait pas un nouveau chapitre
  const again = !victory && d.milestones.some(m => m.title === title && d.week - m.week < 24);
  if (!again) addMilestone(d, victory ? 'victoire' : 'revers', title, text);
  pushNews(d, 'systeme', victory ? 'positive' : 'negative', again ? title : `Nouveau chapitre : ${title}`, `${text} La vie continue.`);
  if (!victory) aftermath(d, title);
  else if (title === 'Opération réussie') { rejoinHome(d); d.player.stats.influence = clamp(d.player.stats.influence + 6); }
  else if (title === 'Victoire à la Pyrrhus') rejoinHome(d);
  else if (title === 'Vive le Roi !' || title === 'Un royaume né d’un coup de force') d.player.flags['monarchie'] = true;
}

function demote(d: GameState, to: RankId = 'militant'): void {
  if (d.presidency || d.player.rankId === 'ancien_president') return;
  if (rankOrder(d.player.rankId) > rankOrder(to)) {
    d.player.rankId = to;
    d.player.actionPoints.max = RANKS[to].monthlyActionPoints;
    d.player.actionPoints.current = Math.min(d.player.actionPoints.current, d.player.actionPoints.max);
  }
}

/** Revers : on encaisse, on repart de plus bas */
function aftermath(d: GameState, title: string): void {
  const p = d.player;
  const s = p.stats;
  // Premier contact manqué : le dossier vous est retiré
  if (['La grande peur', 'Le silence des étoiles', 'Le contact confisqué'].includes(title)) {
    d.alien = null;
    p.flags['hautCommissaire'] = false;
  }
  switch (title) {
    case 'Banqueroute':
      p.finances.personal = 0;
      p.flags['loanDebt'] = 0;
      p.flags['overdraftWeeks'] = 0;
      p.flags['bankruptcies'] = 0;
      p.loans = [];
      if (d.presidency) d.presidency.approval = clamp(d.presidency.approval - 15);
      else demote(d);
      p.flags['desert'] = d.week + 6;
      pushNews(d, 'systeme', 'neutral', 'Repartir de zéro', 'Plus un sou, plus de mandat, mais une leçon apprise. Une traversée du désert commence.');
      break;
    case 'Démasqué·e':
    case 'Personne ne vous croit':
      rejoinHome(d);
      demote(d);
      s.popularity = clamp(s.popularity - 6);
      s.credibility = clamp(s.credibility - 10);
      p.flags['desert'] = d.week + 6;
      break;
    case 'Remercié·e':
      d.press = null;
      s.credibility = clamp(s.credibility - 4);
      pushNews(d, 'systeme', 'neutral', 'Retour à la politique', 'Sans tribune, il vous reste l’action. On vous attend sur le terrain.');
      break;
    case 'Arrêté·e':
      demote(d);
      d.crown = d.crown ? { ...d.crown, soutien: clamp(d.crown.soutien - 10), armee: clamp(d.crown.armee - 15) } : null;
      s.popularity = clamp(s.popularity - 8);
      s.credibility = clamp(s.credibility - 15);
      p.flags['ineligibleUntil'] = d.week + 60;
      pushNews(d, 'scandale', 'negative', 'Condamné·e : cinq ans d’inéligibilité', 'Peine aménagée sous bracelet électronique. Aucune candidature possible avant cinq ans.');
      break;
    case 'La République tient bon':
      if (d.crown) d.crown.soutien = clamp(d.crown.soutien - 8);
      break;
    default:
      // Traversée du désert : on n'écoute plus, mais on n'est pas mort
      s.popularity = Math.max(s.popularity, 12);
      s.credibility = Math.max(s.credibility, 18);
      p.flags['desert'] = d.week + 6;
      demote(d, rankOrder(p.rankId) >= rankOrder('depute') ? 'conseiller_municipal' : 'militant');
  }
}

/** Fin d'infiltration : retour dans votre vrai camp */
function rejoinHome(d: GameState): void {
  const m = d.mole;
  if (!m) return;
  const old = d.party;
  if (old.id !== m.homeId) {
    d.otherParties = d.otherParties.filter(x => x.id !== m.homeId);
    d.otherParties.push({ id: old.id, name: old.name, color: old.color, position: old.position });
    for (const n of d.npcs.filter(x => x.partyId === old.id)) n.relationToPlayer = clamp(n.relationToPlayer - 30, -100, 100);
    const leader = d.npcs.find(n => n.partyId === m.homeId && n.rankId === 'chef_parti');
    d.party = {
      id: m.homeId, name: m.homeName, color: m.homeColor, position: m.homePosition,
      factions: makeFactions(m.homePosition), leaderNpcId: leader?.id ?? 'npc-vasseur', cohesion: 60,
    };
    d.partyFinance = null;
    d.player.stance = m.homePosition;
    pushNews(d, 'parti', 'neutral', `Retour ${m.homeName.startsWith('A') ? 'à l’' : 'au '}${m.homeName}`,
      `Fin de mission. Vous reprenez votre vraie carte, celle ${ofParty(m.homeName)}.`);
  }
  d.mole = null;
}

// ── Retraite : la fin de vie en accéléré ─────────────────

/** Se retirer de la vie publique : les années passent jusqu'au bout */
export function retire(d: GameState, rng: Rng): void {
  if (d.status === 'mort') return;
  const p = d.player;
  addMilestone(d, 'carriere', 'Retrait de la vie publique', `À ${Math.floor(p.age)} ans, ${p.name} quitte la scène politique.`);
  pushNews(d, 'systeme', 'neutral', 'Retrait de la vie publique', 'Plus de meetings, plus de plateaux. Place aux mémoires et aux petits-enfants.');
  d.presidency = null;
  d.pendingDecisions = [];
  d.elections = d.elections.filter(e => e.resolved);
  p.finances.legalCeiling = null;
  p.flags['retired'] = d.week;
  p.stats.stress = 10;
  // Une vie plus calme : la santé remonte, puis l'âge fait son œuvre
  let health = Math.max(p.health, baselineHealth(p.age) - 3);
  for (let year = 0; year < 80; year++) {
    const q = annualMortality(p.age, health) + 0.001;
    if (rng.chance(q) || p.age >= 108) {
      // Le décès survient au cours de l'année
      const months = rng.int(1, 12);
      d.week += months;
      p.age += months / 12;
      p.health = Math.round(health);
      const old = p.age >= 72 && rng.chance(0.7);
      die(d, old ? 'vieillesse' : 'maladie', rng.pick(old ? OLD_AGE_TEXTS : ILLNESS_TEXTS));
      return;
    }
    d.week += 12;
    p.age += 1;
    health += (baselineHealth(p.age) - health) * 0.5;
    // Rentes, droits d'auteur, conférences
    p.finances.personal += Math.round(RANKS[p.rankId].monthlyIncome * 6);
  }
}

// ── Nécrologie ─────────────────────────────────────────────

export interface LifeSummary {
  born: number;
  died: number | null;
  age: number;
  bestRank: string;
  mandates: number;
  reforms: number;
  victories: number;
  setbacks: number;
  epitaph: string;
}

/** Date du tour (premier jour du mois) */
export function dateOfWeek(week: number): Date {
  return dateOfTurn(week);
}

export function lifeSummary(d: GameState): LifeSummary {
  const p = d.player;
  const born = dateOfWeek(d.week).getFullYear() - Math.floor(p.age);
  const mandates = Number(p.flags['presMandates'] ?? 0);
  const bestOrder = Math.max(Number(p.flags['bestRankOrder'] ?? 0), p.rankId === 'ancien_president' ? 6 : rankOrder(p.rankId));
  const best: RankId = mandates > 0 || bestOrder >= 6 ? 'president'
    : (Object.values(RANKS).find(r => r.order === bestOrder && r.id !== 'ancien_president')?.id ?? p.rankId);
  const victories = d.milestones.filter(m => m.kind === 'victoire').length;
  const setbacks = d.milestones.filter(m => m.kind === 'revers').length;
  const epitaph = mandates >= 2 ? 'Deux fois élu·e à la tête de l’État. L’histoire jugera.'
    : mandates === 1 ? 'Président·e de la République. Un nom dans les manuels d’histoire.'
    : best === 'candidat_presidence' ? 'Si près de l’Élysée.'
    : rankOrder(best) >= rankOrder('ministre') ? 'Un grand serviteur de l’État.'
    : rankOrder(best) >= rankOrder('depute') ? 'Un·e parlementaire respecté·e.'
    : d.press ? 'Une plume, une voix.'
    : 'Militant·e jusqu’au bout.';
  return {
    born, died: d.death ? dateOfWeek(d.death.week).getFullYear() : null, age: Math.floor(p.age),
    bestRank: RANKS[best]?.label ?? best, mandates, reforms: Number(p.flags['reformsTotal'] ?? 0),
    victories, setbacks, epitaph,
  };
}

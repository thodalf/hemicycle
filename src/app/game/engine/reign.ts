import { GameState, Segment } from '../models/game.models';
import type { KingdomState } from './kingdom';
import { addMilestone } from './life';
import { pushNews } from './effects';
import { Rng, clamp } from './rng';
import { RANKS } from '../data/ranks';

/* ============================================================
 *  Le règne : ce qui fait d'un trône une partie à jouer.
 *  - Le régime, de la monarchie parlementaire (−100) à la
 *    monarchie absolue (+100) : plus de leviers d'un côté, plus
 *    de stabilité et d'affection de l'autre.
 *  - Les grands chantiers : des projets de plusieurs mois, chers
 *    et clivants, qui laissent une trace.
 *  - Le surnom pour l'histoire, qui évolue au fil du règne.
 * ============================================================ */

/* ── Le régime ── */

export function regimeOf(k: KingdomState): number { return k.regime ?? 0; }

export function regimeLabel(r: number): { label: string; text: string } {
  if (r <= -60) return { label: 'Monarchie d’apparat', text: 'Le Premier ministre gouverne, vous incarnez. Le pays vous aime, mais vous n’avez presque plus de leviers.' };
  if (r <= -20) return { label: 'Monarchie parlementaire', text: 'Le Parlement fait la loi, le souverain arbitre. Stable, apaisé, un peu effacé.' };
  if (r < 20) return { label: 'Monarchie constitutionnelle', text: 'Un équilibre entre le trône et les chambres.' };
  if (r < 60) return { label: 'Monarchie autoritaire', text: 'Vous reprenez la main : ordonnances, préfets, budget. Le front républicain s’organise.' };
  return { label: 'Monarchie absolue', text: '« L’État, c’est moi. » Tous les leviers sont à vous… et la rue gronde chaque mois un peu plus.' };
}

/** Les effets mensuels du régime : leviers contre pression révolutionnaire */
function monthlyRegime(d: GameState, k: KingdomState, rng: Rng): void {
  const r = regimeOf(k);
  const p = d.player;
  // Un point d'action de plus en monarchie absolue, un de moins en monarchie d'apparat
  if (p.rankId === 'roi') p.actionPoints.max = RANKS.roi.monthlyActionPoints + (r >= 60 ? 1 : r <= -60 ? -1 : 0);
  if (r > 0) {
    // L'absolutisme donne des leviers mais arme la révolution
    p.stats.politicalCapital = clamp(p.stats.politicalCapital + r / 20);
    k.opposition = clamp(k.opposition + r / 60);
    k.stabilite = clamp(k.stabilite - r / 140);
    if (r >= 60 && rng.chance(0.2 + r / 500)) {
      const [title, text] = rng.pick(ABSOLUTE_UNREST);
      k.opposition = clamp(k.opposition + 2);
      pushNews(d, 'actu', 'negative', title, text);
    }
  } else if (r < 0) {
    // L'apparat : stable et aimé, mais sans prise
    k.stabilite = clamp(k.stabilite - (r / 90) * Math.max(0.1, 1 - k.stabilite / 110));
    k.opposition = clamp(k.opposition + r / 70);
    p.stats.popularity = clamp(p.stats.popularity - r / 250);
    // Peu de prise : le capital politique fond, l'influence s'étiole, le gouvernement passe outre
    p.stats.politicalCapital = clamp(p.stats.politicalCapital + r / 25);
    p.stats.influence = clamp(p.stats.influence + r / 120);
    if (r <= -40 && rng.chance(0.18 - r / 1000)) {
      const [title, text] = rng.pick(APPARAT_SNUB);
      k.prestige = clamp(k.prestige - 2);
      pushNews(d, 'actu', 'neutral', title, text);
    }
  }
}

const ABSOLUTE_UNREST: [string, string][] = [
  ['Les étudiants occupent la Sorbonne', '« Ni Dieu ni maître ni ordonnances » : l’amphithéâtre Richelieu est devenu un forum permanent.'],
  ['Une « Assemblée du Jeu de paume » se réunit', 'Trois cents élus jurent de ne pas se séparer avant d’avoir rendu au pays sa Constitution.'],
  ['Les juristes en grève', 'Avocats et magistrats dénoncent le gouvernement par ordonnances et suspendent les audiences.'],
  ['Les préfets mal reçus', 'Dans plusieurs départements, les préfets nommés par ordonnance sont accueillis par des concerts de casseroles.'],
  ['Le Conseil constitutionnel proteste', 'Dans un communiqué inédit, les Sages rappellent que la souveraineté « appartient au peuple ».'],
];

const APPARAT_SNUB: [string, string][] = [
  ['Le gouvernement passe outre', 'Le Premier ministre fait voter sa réforme sans même consulter le Palais. « Le souverain règne, il ne gouverne pas », sourit-il.'],
  ['Le discours du trône réécrit', 'Matignon a corrigé le discours royal jusqu’à la dernière virgule. Vous lisez un texte qui n’est plus le vôtre.'],
  ['Un ruban de plus', 'Troisième inauguration de rond-point de la semaine : les humoristes vous surnomment « la plus belle paire de ciseaux du royaume ».'],
  ['Le Conseil se réunit sans vous', 'Les ministres tranchent le dossier de l’énergie un mercredi où vous visitiez une exposition florale.'],
];

/* ── Les grands chantiers ── */

export interface ChantierDef {
  id: string; icon: string; label: string; months: number;
  /** Ce que le chantier coûte chaque mois (points de déficit) */
  deficit: number;
  /** Ce qu'il divise chaque mois */
  opposition: number;
  text: string;
  /** Ceux qui applaudissent et ceux qui grincent */
  pro: Segment[]; contra: Segment[];
  done: string;
  reward: { prestige: number; growth?: number; unemployment?: number; intl?: number; popularity?: number; renown: number };
}

export const CHANTIERS: ChantierDef[] = [
  { id: 'versailles', icon: '🏰', label: 'Le Versailles du XXIᵉ siècle', months: 12, deficit: 0.03, opposition: 1.4,
    text: 'Un palais de verre et de pierre sur le plateau de Saclay : galeries, jardins, salle des fêtes pour deux mille convives.',
    pro: ['retraites'], contra: ['populaires', 'jeunes'],
    done: 'Le nouveau palais ouvre ses portes : la galerie de lumière fait la une du monde entier.',
    reward: { prestige: 16, intl: 5, growth: 0.1, renown: 6 } },
  { id: 'exposition', icon: '🎡', label: 'La Grande Exposition universelle', months: 8, deficit: 0.02, opposition: 0.6,
    text: 'Cent quarante pays, des pavillons sur les deux rives de la Seine, une tour éphémère de quatre cents mètres.',
    pro: ['cadres', 'jeunes'], contra: ['ruraux'],
    done: 'Quarante millions de visiteurs : l’Exposition referme ses portes sur un triomphe.',
    reward: { prestige: 10, intl: 6, growth: 0.3, popularity: 4, renown: 5 } },
  { id: 'ville', icon: '🏙️', label: 'Une ville nouvelle sur la Loire', months: 14, deficit: 0.025, opposition: 0.9,
    text: 'Cent mille logements, un tramway, des écoles : une ville sortie de terre entre Orléans et Tours.',
    pro: ['populaires', 'jeunes'], contra: ['ruraux', 'retraites'],
    done: 'Les premières familles s’installent à Ville-Royale-sur-Loire. On y fait la queue pour un appartement.',
    reward: { prestige: 9, unemployment: -0.4, popularity: 3, renown: 4 } },
  { id: 'canal', icon: '🚢', label: 'Le canal des Deux-Mers', months: 12, deficit: 0.03, opposition: 0.8,
    text: 'Relier l’Atlantique à la Méditerranée pour les cargos : le rêve de Colbert, enfin à grand gabarit.',
    pro: ['ruraux', 'cadres'], contra: ['jeunes'],
    done: 'Le premier porte-conteneurs franchit le seuil de Naurouze sous les vivats. Bordeaux et Sète exultent.',
    reward: { prestige: 10, growth: 0.35, renown: 4 } },
  { id: 'foret', icon: '🌳', label: 'La forêt royale du milliard d’arbres', months: 10, deficit: 0.01, opposition: 0.3,
    text: 'Un milliard d’arbres plantés en dix mois, des Landes aux Vosges, par les écoles, les régiments et les bénévoles.',
    pro: ['jeunes', 'cadres'], contra: ['ruraux'],
    done: 'Le milliardième arbre, un chêne, est planté dans la cour d’une école du Morvan. Le monde salue la « forêt du règne ».',
    reward: { prestige: 8, intl: 3, popularity: 3, renown: 3 } },
  { id: 'opera', icon: '🎭', label: 'Le grand Opéra de la Couronne', months: 8, deficit: 0.015, opposition: 0.7,
    text: 'Une salle de trois mille places à Marseille, face à la mer, pour le premier opéra du siècle.',
    pro: ['cadres', 'retraites'], contra: ['populaires'],
    done: 'Soirée d’ouverture : quarante minutes d’applaudissements, un livret commandé pour le règne.',
    reward: { prestige: 9, intl: 2, renown: 5 } },
];

export const CHANTIER_BY_ID = new Map(CHANTIERS.map(c => [c.id, c]));

export function startChantier(d: GameState, id: string): string[] {
  const k = d.kingdom;
  const c = CHANTIER_BY_ID.get(id);
  if (!k || !c || k.chantier) return [];
  k.chantier = { id, since: d.week, progress: 0 };
  for (const s of c.pro) d.electorate && (d.electorate.offsets[s] = (d.electorate.offsets[s] ?? 0) + 2);
  for (const s of c.contra) d.electorate && (d.electorate.offsets[s] = (d.electorate.offsets[s] ?? 0) - 2);
  pushNews(d, 'actu', 'neutral', `${c.label} : la première pierre`, `${c.text} Les partisans parlent d’un règne qui ose ; le front républicain d’une folie des grandeurs.`);
  return [`Grand chantier lancé : ${c.label}`];
}

export function stopChantier(d: GameState): string[] {
  const k = d.kingdom;
  if (!k?.chantier) return [];
  const c = CHANTIER_BY_ID.get(k.chantier.id);
  k.chantier = null;
  k.prestige = clamp(k.prestige - 8);
  pushNews(d, 'actu', 'negative', 'Le chantier abandonné', `${c?.label ?? 'Le grand chantier'} est arrêté. Les grues restent plantées sur un terrain vague : la presse parle d’un « monument à l’inachevé ».`);
  return ['Chantier abandonné · Prestige −8'];
}

export function boostChantier(d: GameState, delta: number): string[] {
  const k = d.kingdom;
  if (!k?.chantier) return [];
  k.chantier.progress = Math.max(0, Math.min(100, k.chantier.progress + delta));
  return [`Chantier ${delta >= 0 ? '+' : ''}${delta} %`];
}

const CHANTIER_NEWS: [string, string, number][] = [
  ['Dépassement de budget', 'La Cour des comptes chiffre le dérapage à 40 % : le front républicain exige l’arrêt du chantier.', -4],
  ['Une découverte archéologique', 'Les pelleteuses mettent au jour une villa gallo-romaine : fouilles préventives, trois semaines d’arrêt.', -6],
  ['Grève sur le chantier', 'Les compagnons réclament une prime de « règne » : le chantier s’arrête dix jours.', -5],
  ['Les compagnons du Devoir à l’honneur', 'Deux cents compagnons rejoignent le chantier : la charpente avance à une vitesse record.', 6],
  ['Le chantier attire les foules', 'Le dimanche, des milliers de visiteurs viennent regarder les grues : un succès inattendu.', 3],
  ['Recours devant le Conseil d’État', 'Une association de riverains attaque le permis : le chantier ralentit, le temps de l’audience.', -3],
];

function monthlyChantier(d: GameState, k: KingdomState, rng: Rng): void {
  const ch = k.chantier;
  if (!ch) return;
  const c = CHANTIER_BY_ID.get(ch.id);
  if (!c) { k.chantier = null; return; }
  ch.progress = Math.min(100, ch.progress + (100 / c.months) * rng.range(0.75, 1.15));
  k.opposition = clamp(k.opposition + c.opposition);
  if (d.economy) d.economy.deficit = Math.round((d.economy.deficit + c.deficit) * 100) / 100;
  if (rng.chance(0.28)) {
    const [title, text, delta] = rng.pick(CHANTIER_NEWS);
    ch.progress = Math.max(0, Math.min(100, ch.progress + delta));
    pushNews(d, 'actu', delta >= 0 ? 'positive' : 'negative', `${c.label} : ${title.charAt(0).toLowerCase()}${title.slice(1)}`, text);
  }
  if (ch.progress >= 100) {
    k.chantier = null;
    (k.legacy ??= []).push(c.id);
    k.prestige = clamp(k.prestige + c.reward.prestige);
    const p = d.player;
    p.renown = (p.renown ?? 0) + c.reward.renown;
    if (c.reward.popularity) p.stats.popularity = clamp(p.stats.popularity + c.reward.popularity);
    if (d.economy) {
      if (c.reward.growth) d.economy.growth = Math.round((d.economy.growth + c.reward.growth) * 100) / 100;
      if (c.reward.unemployment) d.economy.unemployment = Math.max(3, Math.round((d.economy.unemployment + c.reward.unemployment) * 10) / 10);
    }
    if (c.reward.intl && d.intl) d.intl.prestige = clamp(d.intl.prestige + c.reward.intl);
    addMilestone(d, 'victoire', c.label, `${c.done} Il restera la marque de votre règne.`);
    pushNews(d, 'actu', 'positive', `${c.label} : l’inauguration`, c.done);
  }
}

/* ── Le surnom pour l'histoire ── */

interface NickDef { id: string; m: string; f: string; hint: string; score: (d: GameState, k: KingdomState, months: number) => number }

const NICKS: NickDef[] = [
  { id: 'batisseur', m: 'le Bâtisseur', f: 'la Bâtisseuse', hint: 'Achever de grands chantiers.',
    score: (_d, k) => (k.legacy?.length ?? 0) * 38 + (k.chantier ? k.chantier.progress / 5 : 0) },
  { id: 'absolu', m: 'l’Absolu', f: 'l’Absolue', hint: 'Gouverner en monarque absolu, par ordonnances.',
    score: (_d, k) => (regimeOf(k) >= 40 ? regimeOf(k) * 0.8 + (k.ordonnances ?? 0) * 5 : (k.ordonnances ?? 0) * 3) },
  { id: 'debonnaire', m: 'le Débonnaire', f: 'la Débonnaire', hint: 'Laisser gouverner le Parlement.',
    score: (_d, k) => (regimeOf(k) <= -40 ? -regimeOf(k) * 0.85 : 0) },
  { id: 'bienaime', m: 'le Bien-Aimé', f: 'la Bien-Aimée', hint: 'Être très populaire (60 et plus).',
    score: d => Math.max(0, (d.player.stats.popularity - 45) * 2.2) + (d.kingdom?.deeds?.['peuple'] ?? 0) * 3 },
  { id: 'magnifique', m: 'le Magnifique', f: 'la Magnifique', hint: 'Une cour fastueuse, des fêtes, un grand portrait.',
    score: (_d, k) => { const g = Object.values(k.court ?? {}).reduce((s, v) => s + v, 0) * 100 / 12; return Math.max(0, (g - 45) * 1.6) + (k.deeds?.['fete'] ?? 0) * 6; } },
  { id: 'sage', m: 'le Sage', f: 'la Sage', hint: 'Des institutions très stables (70 et plus).',
    score: (_d, k, months) => (months >= 6 ? Math.max(0, (k.stabilite - 50) * 2.4) : 0) },
  { id: 'juste', m: 'le Juste', f: 'la Juste', hint: 'Grâces royales et audiences du jeudi.',
    score: (_d, k) => (k.deeds?.['justice'] ?? 0) * 14 },
  { id: 'malaime', m: 'le Mal-Aimé', f: 'la Mal-Aimée', hint: 'Un front républicain écrasant… à éviter.',
    score: (_d, k) => Math.max(0, (k.opposition - 60) * 2.5) },
  { id: 'guerrier', m: 'le Guerrier', f: 'la Guerrière', hint: 'Mener une guerre et des batailles.',
    score: (d, k) => (d.war ? 45 : 0) + (k.deeds?.['guerre'] ?? 0) * 15 },
  { id: 'pacificateur', m: 'le Pacificateur', f: 'la Pacificatrice', hint: 'Désarmer le front républicain (sous 25) dans la durée.',
    score: (_d, k, months) => (months >= 8 ? Math.max(0, (35 - k.opposition) * 3) : 0) },
];

export interface NickScore { id: string; name: string; score: number; hint: string }

/** Les surnoms en lice, du plus probable au moins probable */
export function nicknameRace(d: GameState): NickScore[] {
  const k = d.kingdom;
  if (!k) return [];
  const months = d.week - k.since;
  const fem = d.player.gender === 'femme';
  return NICKS.map(n => ({ id: n.id, name: fem ? n.f : n.m, hint: n.hint, score: Math.round(n.score(d, k, months)) }))
    .sort((a, b) => b.score - a.score);
}

/** Le surnom actuel (ou provisoire) */
export function reignNickname(d: GameState, ending = false): string {
  const k = d.kingdom;
  if (!k) return '';
  const fem = d.player.gender === 'femme';
  const months = d.week - k.since;
  if (ending && months < 6) return fem ? 'la Brève' : 'le Bref';
  if (months < 2) return fem ? 'la Nouvelle' : 'le Nouveau';
  const top = nicknameRace(d)[0];
  return top && top.score >= 40 ? top.name : fem ? 'la Discrète' : 'le Discret';
}

/** « Thomas Iᵉʳ » */
export function regnalName(d: GameState): string {
  const first = d.player.name.split(' ')[0] || d.player.name;
  return `${first} ${d.player.gender === 'femme' ? 'Iʳᵉ' : 'Iᵉʳ'}`;
}

function monthlyNickname(d: GameState, k: KingdomState): void {
  const nick = reignNickname(d);
  if (nick === k.nickname) return;
  const first = !k.nickname || /Nouve/.test(k.nickname);
  k.nickname = nick;
  if (/Nouve|Discr/.test(nick)) return;
  pushNews(d, 'actu', /Mal-Aim/.test(nick) ? 'negative' : 'positive', `On l’appelle désormais « ${regnalName(d)} ${nick} »`,
    first ? `Les chansonniers l’ont trouvé, les éditorialistes l’ont adopté : le surnom du règne est né.` : `Le surnom du règne change : les journaux et les humoristes ne disent plus autrement.`);
}

/** À la fin du règne : ce que retiendra l'histoire */
export function reignEpitaph(d: GameState): string {
  const k = d.kingdom;
  if (!k) return '';
  const legacy = (k.legacy ?? []).map(id => CHANTIER_BY_ID.get(id)?.label).filter(Boolean);
  return `L’histoire retiendra « ${regnalName(d)} ${reignNickname(d, true)} »${legacy.length ? `, et ses chantiers : ${legacy.join(', ')}` : ''}.`;
}

/** Chaque mois, après la vie ordinaire du trône */
export function monthlyReign(d: GameState, rng: Rng): void {
  const k = d.kingdom;
  if (!k) return;
  monthlyRegime(d, k, rng);
  // Il y aura toujours des républicains : plus nombreux sous un trône absolu
  k.opposition = Math.max(k.opposition, 12 + Math.max(0, regimeOf(k)) / 5);
  monthlyChantier(d, k, rng);
  monthlyNickname(d, k);
}

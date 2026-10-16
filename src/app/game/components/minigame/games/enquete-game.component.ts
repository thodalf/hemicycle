import { Component, OnDestroy, OnInit, computed, input, output, signal } from '@angular/core';
import { MinigameDef } from '../../../data/minigames';

/* ============================================================
 *  L'enquête : un vrai jeu de déduction (façon Cluedo / grille
 *  logique). Chaque partie tire une affaire neuve : 5 ou 6
 *  suspects, des lieux, des badges, des manies (l'indice laissé
 *  sur place) et des mobiles. Un seul coupable réunit les trois
 *  conditions du crime ; il ment à chaque déclaration (en
 *  difficile, son complice aussi). Fouilles, caméras et badges ne
 *  mentent jamais. Le joueur dispose d'un nombre limité d'heures
 *  d'enquête, tient son carnet et sa grille, puis accuse.
 *
 *  Le générateur vérifie avec un solveur que l'ensemble des
 *  indices désigne une solution unique, qu'un enquêteur efficace
 *  la trouve dans le budget, et qu'un enquêteur méthodique aussi.
 *  Trois variantes : la fuite au cabinet, les joyaux du musée,
 *  le sabotage du vote.
 * ============================================================ */

/* ── Modèle ─────────────────────────────────────────────── */

export type EnqueteVariant = 'fuite' | 'joyaux' | 'sabotage';
export type EnqueteLevel = 0 | 1 | 2;
/** Catégories d'attributs : lieu à l'heure des faits, badge, manie (indice), mobile */
export type Cat = 0 | 1 | 2 | 3;
export const LIEU = 0, BADGE = 1, SIGNE = 2, MOBILE = 3;

/** Fait atomique : « who.cat = val » (eq) ou « who.cat ≠ val » */
export interface Fact { who: number; cat: Cat; val: number; eq: boolean }

export interface Suspect {
  first: string; name: string; role: string; icon: string; fem: boolean;
  lieu: number; badge: number; signe: number; mobile: number;
}

interface RoleDef { m: string; f: string; icons: [string, string] }
interface PlaceDef { label: string; a: string; the: string; icon: string }
interface SigneDef {
  label: string; icon: string;
  /** Ce qu'on trouve sur la scène */
  trace: string;
  has: (f: boolean) => string; not: (f: boolean) => string;
  selfHas: (f: boolean) => string; selfNot: (f: boolean) => string;
  proof: (n: string) => string;
}
interface MobileDef {
  label: string; icon: string;
  has: (f: boolean) => string; selfNot: (f: boolean) => string;
  proof: (n: string) => string; why: (f: boolean) => string;
}
interface Theme {
  title: string; icon: string; brief: string; hours: string; verb: string; badge: string;
  roles: RoleDef[]; places: PlaceDef[]; signes: SigneDef[]; mobiles: MobileDef[];
}

export interface Statement { id: number; speaker: number; fact: Fact; text: string; lie: boolean }
export interface Find { place: number; fact: Fact; text: string }

export interface EnqueteCase {
  variant: EnqueteVariant; level: EnqueteLevel; theme: Theme;
  suspects: Suspect[]; nPlaces: number;
  /** cams[0] : le registre des badges de la scène ; cams[p] : caméra du lieu p */
  cams: boolean[];
  culprit: number; accomplice: number; trace: number; budget: number;
  statements: Statement[][];
  finds: (Find | null)[];
}

export type Action =
  | { t: 'ask'; s: number }
  | { t: 'search'; p: number }
  | { t: 'cam'; p: number }
  | { t: 'cross'; a: number; b: number };

export interface Knowledge {
  facts: Fact[]; stmts: Statement[];
  crosses: { sa: number; sb: number; both: boolean }[];
  trace: number | null;
}

export interface InvState {
  asked: number[]; searched: boolean[]; cammed: boolean[]; crossed: Set<string>;
  k: Knowledge; moves: number;
}

export interface Sol { c: number; a: number; m: number }

export interface Clue {
  id: number; kind: 'stmt' | 'search' | 'cam' | 'badge' | 'cross';
  icon: string; title: string; text: string; who?: number; stmtId?: number; bad?: boolean;
}

/* ── Textes ─────────────────────────────────────────────── */

const g = (f: boolean, m: string, w: string) => (f ? w : m);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** « de Paul », « d’Inès » */
const de = (n: string) => (/^[AEIOUHÉÈÊÂÎÔÛ]/.test(n) ? `d’${n}` : `de ${n}`);
/** Espaces fines insécables de la typographie française (« », ?, !, :, ;) */
const nb = (t: string) => t.replace(/« /g, '«\u202f').replace(/ ([»?!:;])/g, '\u202f$1');
/** « un badge pour… » → « de badge pour… » */
const noBadge = (b: string) => b.replace(/^un /, 'de ');

const FIRST_F = ['Clémence', 'Inès', 'Sophie', 'Nadia', 'Camille', 'Hélène', 'Léa', 'Margaux', 'Yasmina', 'Agathe', 'Bérénice', 'Juliette', 'Salomé', 'Odile', 'Aïcha', 'Chloé', 'Maëlle', 'Rose'];
const FIRST_M = ['Paul', 'Mathieu', 'Karim', 'Antoine', 'Hugo', 'Bastien', 'Yann', 'Rémi', 'Édouard', 'Samuel', 'Olivier', 'Théo', 'Malik', 'Gaspard', 'Lucien', 'Bruno', 'Victor', 'Jules'];
const LAST = ['Mercier', 'Daoud', 'Lefèvre', 'Arnoult', 'Ferrand', 'Vasseur', 'Benali', 'Roussel', 'Marchetti', 'Le Goff', 'Delmas', 'Nguyen', 'Carvalho', 'Perrin', 'Lambert', 'Morel', 'Kessler', 'Duval', 'Haddad', 'Fontaine', 'Rigal', 'Brunet', 'Esposito', 'Tessier'];

const chantage: MobileDef = {
  label: 'Chantage', icon: '🤐',
  has: f => `se fait faire chanter, ça se voit : ${g(f, 'il', 'elle')} sursaute à chaque coup de téléphone`,
  selfNot: () => 'Me faire chanter, moi ? Je n’ai rien à cacher, rien du tout.',
  proof: n => `une lettre anonyme et menaçante adressée à ${n}`,
  why: f => `parce qu’un maître chanteur l’y a ${g(f, 'contraint', 'contrainte')}`,
};

const THEMES: Record<EnqueteVariant, Theme> = {
  fuite: {
    title: 'La note qui a fuité', icon: '📰', hours: 'de 18 h 30 à 19 h', verb: 'a fait fuiter la note',
    brief: 'Mardi, vers 18 h 40, la note confidentielle sur la réforme a été photocopiée à la reprographie, puis envoyée à un hebdomadaire satirique. Le ministre exige un nom avant le bouclage.',
    badge: 'un badge pour la reprographie',
    roles: [
      { m: 'conseiller spécial', f: 'conseillère spéciale', icons: ['👨‍💼', '👩‍💼'] },
      { m: 'attaché de presse', f: 'attachée de presse', icons: ['👨‍💻', '👩‍💻'] },
      { m: 'chauffeur du ministre', f: 'chauffeuse du ministre', icons: ['👨‍✈️', '👩‍✈️'] },
      { m: 'stagiaire', f: 'stagiaire', icons: ['👨‍🎓', '👩‍🎓'] },
      { m: 'directeur de cabinet', f: 'directrice de cabinet', icons: ['🧔', '👩‍🦳'] },
      { m: 'secrétaire particulier', f: 'secrétaire particulière', icons: ['👨‍🏫', '👩‍🏫'] },
      { m: 'plume du ministre', f: 'plume du ministre', icons: ['👨‍🎨', '👩‍🎨'] },
      { m: 'huissier du ministère', f: 'huissière du ministère', icons: ['💂‍♂️', '💂‍♀️'] },
    ],
    places: [
      { label: 'Reprographie', a: 'à la reprographie', the: 'la reprographie', icon: '📠' },
      { label: 'Cafétéria', a: 'à la cafétéria', the: 'la cafétéria', icon: '☕' },
      { label: 'Jardin', a: 'dans le jardin', the: 'le jardin', icon: '🌳' },
      { label: 'Salle de réunion', a: 'en salle de réunion', the: 'la salle de réunion', icon: '🗂️' },
      { label: 'Parking', a: 'au parking', the: 'le parking', icon: '🚗' },
    ],
    signes: [
      {
        label: 'Encre verte', icon: '🖋️', trace: 'Sur la vitre du photocopieur, une trace d’encre verte encore fraîche.',
        has: () => 'écrit au stylo-plume, à l’encre verte', not: () => 'n’utilise jamais d’encre verte',
        selfHas: () => 'J’écris à l’encre verte, oui. C’est ma coquetterie, pas un crime.',
        selfNot: () => 'De l’encre verte ? Je n’écris qu’au feutre noir, comme tout le monde.',
        proof: n => `un stylo-plume chargé d’encre verte, gravé au nom ${de(n)}`,
      },
      {
        label: 'Chewing-gum', icon: '🍬', trace: 'Collé sous le bac à papier, un chewing-gum à la menthe.',
        has: () => 'mâche du chewing-gum à la menthe toute la journée', not: () => 'ne supporte pas le chewing-gum',
        selfHas: () => 'Oui, je mâche du chewing-gum. J’ai arrêté de fumer, il faut bien compenser.',
        selfNot: () => 'Le chewing-gum ? Quelle horreur. Je n’en ai jamais mâché.',
        proof: n => `un paquet de chewing-gums à la menthe dans la veste ${de(n)}`,
      },
      {
        label: 'Thé au jasmin', icon: '🍵', trace: 'Un gobelet de thé au jasmin, encore tiède, posé sur la trieuse.',
        has: () => 'ne boit que du thé au jasmin', not: () => 'ne boit jamais de thé',
        selfHas: () => 'Du thé au jasmin, j’en bois dix tasses par jour.',
        selfNot: () => 'Du thé ? Jamais. Moi, c’est café serré.',
        proof: n => `une boîte de thé au jasmin marquée « ${n} » au feutre`,
      },
      {
        label: 'Gaucher', icon: '🤚', trace: 'Les copies sont agrafées en haut à droite : un geste de gaucher.',
        has: f => `est ${g(f, 'gaucher', 'gauchère')}`, not: f => `est ${g(f, 'droitier', 'droitière')}`,
        selfHas: f => `Je suis ${g(f, 'gaucher', 'gauchère')}, et alors ? Un tiers du cabinet l’est.`,
        selfNot: f => `Je suis ${g(f, 'droitier', 'droitière')}, regardez ma signature.`,
        proof: n => `une paire de ciseaux pour gaucher, étiquetée au nom ${de(n)}`,
      },
    ],
    mobiles: [
      {
        label: 'Dettes', icon: '💸', has: () => 'croule sous les dettes depuis son divorce',
        selfNot: () => 'Des dettes, moi ? Mes comptes sont à l’équilibre, merci.',
        proof: n => `une mise en demeure d’huissier adressée à ${n}`, why: () => 'pour éponger ses dettes, contre une enveloppe du journal',
      },
      {
        label: 'Ambition', icon: '📈', has: () => 'rêve de prendre la place de son supérieur',
        selfNot: () => 'Monter en grade ? Je suis très bien où je suis.',
        proof: n => `un CV ${de(n)} annoté « pour le poste du chef — après le scandale »`, why: () => 'pour faire tomber son supérieur et prendre sa place',
      },
      {
        label: 'Rancune', icon: '😤', has: f => `en veut au ministre depuis qu’il l’a ${g(f, 'humilié', 'humiliée')} en réunion`,
        selfNot: () => 'Le ministre ? Je n’ai rien contre lui, au contraire.',
        proof: n => `un brouillon de lettre de démission rageuse, signé ${n}`, why: () => 'pour se venger d’une humiliation publique',
      },
      {
        label: 'Conviction', icon: '📣', has: () => 'trouve la réforme scandaleuse et le dit à qui veut l’entendre',
        selfNot: () => 'La réforme ? Je la soutiens sans réserve.',
        proof: n => `un tract contre la réforme, annoté de la main ${de(n)}`, why: () => 'par conviction : la réforme lui paraissait indéfendable',
      },
      chantage,
      {
        label: 'Taupe', icon: '🎭', has: () => 'déjeune en cachette avec des gens de l’opposition',
        selfNot: () => 'L’opposition ? Je ne leur adresse même pas la parole.',
        proof: n => `une carte d’adhérent d’un parti d’opposition au nom ${de(n)}`, why: () => 'pour le compte de l’opposition : une vraie taupe',
      },
    ],
  },
  joyaux: {
    title: 'Les joyaux de l’impératrice', icon: '💎', hours: 'de 20 h 45 à 21 h 15', verb: 'a dérobé les joyaux',
    brief: 'Pendant la nocturne, vers 21 h, le diadème de l’impératrice et deux broches ont disparu de leur vitrine. Aucune effraction : c’est quelqu’un de la maison. La ministre de la Culture attend un nom.',
    badge: 'un badge de nuit pour la salle des joyaux',
    roles: [
      { m: 'gardien de nuit', f: 'gardienne de nuit', icons: ['💂‍♂️', '💂‍♀️'] },
      { m: 'restaurateur', f: 'restauratrice', icons: ['👨‍🎨', '👩‍🎨'] },
      { m: 'mécène', f: 'mécène', icons: ['🤵‍♂️', '🤵‍♀️'] },
      { m: 'électricien', f: 'électricienne', icons: ['👷‍♂️', '👷‍♀️'] },
      { m: 'guide-conférencier', f: 'guide-conférencière', icons: ['👨‍🏫', '👩‍🏫'] },
      { m: 'commissaire de l’exposition', f: 'commissaire de l’exposition', icons: ['🧐', '🧐'] },
      { m: 'conservateur honoraire', f: 'conservatrice honoraire', icons: ['👴', '👵'] },
      { m: 'photographe du musée', f: 'photographe du musée', icons: ['👨‍💻', '👩‍💻'] },
    ],
    places: [
      { label: 'Salle des joyaux', a: 'dans la salle des joyaux', the: 'la salle des joyaux', icon: '💎' },
      { label: 'Atelier', a: 'à l’atelier de restauration', the: 'l’atelier de restauration', icon: '🎨' },
      { label: 'Local électrique', a: 'au local électrique', the: 'le local électrique', icon: '⚡' },
      { label: 'Hall d’accueil', a: 'dans le hall d’accueil', the: 'le hall d’accueil', icon: '🏛️' },
      { label: 'Réserves', a: 'dans les réserves', the: 'les réserves', icon: '📦' },
    ],
    signes: [
      {
        label: 'Semelle crantée', icon: '🥾', trace: 'Dans la poussière, près de la vitrine, l’empreinte d’une semelle de chantier crantée.',
        has: () => 'porte des chaussures de chantier', not: () => 'ne porte que des mocassins',
        selfHas: () => 'Je porte des chaussures de chantier, oui. Je travaille, moi.',
        selfNot: () => 'Des chaussures de chantier ? Je ne porte que des mocassins.',
        proof: n => `une paire de chaussures de chantier crottées, au nom ${de(n)}`,
      },
      {
        label: 'Laine rouge', icon: '🧣', trace: 'Accrochée à l’angle de la vitrine, une fibre de laine rouge.',
        has: () => 'ne quitte jamais son écharpe rouge', not: () => 'ne porte jamais de rouge',
        selfHas: () => 'Mon écharpe rouge ? Je l’ai depuis vingt ans, je ne la quitte pas.',
        selfNot: () => 'Du rouge ? Je n’en porte jamais, ça ne me va pas au teint.',
        proof: n => `l’écharpe rouge ${de(n)}, oubliée sur une chaise`,
      },
      {
        label: 'Pigment bleu', icon: '🎨', trace: 'Sur le socle de la vitrine, une trace de pigment bleu outremer.',
        has: () => 'a toujours les doigts tachés de bleu outremer', not: () => 'ne touche jamais aux pigments',
        selfHas: () => 'J’ai les doigts bleus, oui : je manipule du pigment outremer toute la journée.',
        selfNot: () => 'Les pigments ? Je n’y touche jamais, c’est le travail de l’atelier.',
        proof: n => `un flacon de pigment bleu outremer étiqueté au nom ${de(n)}`,
      },
      {
        label: 'Cigare', icon: '🚬', trace: 'Une odeur tenace de cigare flotte encore près de la vitrine.',
        has: () => 'fume le cigare', not: () => 'ne fume pas',
        selfHas: () => 'Je fume le cigare, c’est vrai. Dehors, toujours dehors.',
        selfNot: () => 'Je n’ai jamais fumé de ma vie.',
        proof: n => `un étui à cigares aux initiales ${de(n)}`,
      },
    ],
    mobiles: [
      {
        label: 'Dettes de jeu', icon: '🎰', has: () => 'a perdu gros au casino ces derniers mois',
        selfNot: () => 'Le casino ? Je n’y ai jamais mis les pieds.',
        proof: n => `des reconnaissances de dettes de jeu signées ${n}`, why: () => 'pour rembourser ses dettes de jeu',
      },
      {
        label: 'Receleur', icon: '🕴️', has: () => 'fréquente un collectionneur sans scrupules',
        selfNot: () => 'Les collectionneurs privés ? Je les fuis comme la peste.',
        proof: n => `la carte d’un receleur, avec un rendez-vous noté de la main ${de(n)}`, why: () => 'pour un collectionneur qui avait déjà payé',
      },
      {
        label: 'Rancune', icon: '😤', has: f => `vient d’apprendre son licenciement et l’a très mal ${g(f, 'pris', 'prise')}`,
        selfNot: () => 'Ma place ici ? Elle n’a jamais été menacée.',
        proof: n => `une lettre de licenciement adressée à ${n}`, why: () => 'pour se venger de son licenciement',
      },
      {
        label: 'Restitution', icon: '🌍', has: () => 'milite pour rendre les joyaux à leur pays d’origine',
        selfNot: () => 'La restitution ? Ces joyaux sont très bien ici.',
        proof: n => `une pétition pour la restitution des joyaux, signée ${n} en premier`, why: () => 'pour rendre les joyaux à leur pays d’origine',
      },
      {
        label: 'Scandale', icon: '📰', has: () => 'veut faire tomber le directeur du musée',
        selfNot: () => 'Le directeur ? Nous nous entendons à merveille.',
        proof: n => `des notes ${de(n)} sur les failles de sécurité du musée, prêtes pour la presse`, why: () => 'pour faire tomber le directeur du musée',
      },
      chantage,
    ],
  },
  sabotage: {
    title: 'Le vote saboté', icon: '🗳️', hours: 'de 15 h 30 à 16 h', verb: 'a saboté le vote',
    brief: 'Mercredi, 16 h : au scrutin sur l’amendement, une rangée de boîtiers de vote était débranchée et la feuille de consignes du groupe avait été remplacée. L’amendement est tombé à trois voix près.',
    badge: 'un badge du local technique',
    roles: [
      { m: 'collaborateur parlementaire', f: 'collaboratrice parlementaire', icons: ['👨‍💼', '👩‍💼'] },
      { m: 'huissier de séance', f: 'huissière de séance', icons: ['💂‍♂️', '💂‍♀️'] },
      { m: 'technicien du vote', f: 'technicienne du vote', icons: ['👨‍🔧', '👩‍🔧'] },
      { m: 'député frondeur', f: 'députée frondeuse', icons: ['🙋‍♂️', '🙋‍♀️'] },
      { m: 'attaché de groupe', f: 'attachée de groupe', icons: ['👨‍💻', '👩‍💻'] },
      { m: 'lobbyiste', f: 'lobbyiste', icons: ['🤵‍♂️', '🤵‍♀️'] },
      { m: 'journaliste parlementaire', f: 'journaliste parlementaire', icons: ['👨‍🎤', '👩‍🎤'] },
      { m: 'stagiaire', f: 'stagiaire', icons: ['👨‍🎓', '👩‍🎓'] },
    ],
    places: [
      { label: 'Local technique', a: 'au local technique', the: 'le local technique', icon: '🔌' },
      { label: 'Buvette', a: 'à la buvette', the: 'la buvette', icon: '☕' },
      { label: 'Quatre-Colonnes', a: 'aux Quatre-Colonnes', the: 'la salle des Quatre-Colonnes', icon: '🏛️' },
      { label: 'Bibliothèque', a: 'à la bibliothèque', the: 'la bibliothèque', icon: '📚' },
      { label: 'Salon Delacroix', a: 'au salon Delacroix', the: 'le salon Delacroix', icon: '🖼️' },
    ],
    signes: [
      {
        label: 'Post-it jaune', icon: '🟨', trace: 'Sur un boîtier débranché, un post-it jaune fluo oublié.',
        has: () => 'colle des post-it jaunes partout', not: () => 'n’utilise jamais de post-it',
        selfHas: () => 'Les post-it jaunes, j’en consomme un bloc par jour, c’est mon système.',
        selfNot: () => 'Des post-it ? Je note tout sur mon téléphone.',
        proof: n => `un bloc de post-it jaunes, avec « ${n} » au dos`,
      },
      {
        label: 'Madeleine', icon: '🧁', trace: 'Des miettes de madeleine sur le tableau électrique.',
        has: () => 'grignote des madeleines de la buvette toute la journée', not: () => 'ne mange jamais entre les repas',
        selfHas: () => 'Les madeleines de la buvette ? J’en suis accro, je l’avoue.',
        selfNot: () => 'Je ne mange jamais entre les repas. Jamais.',
        proof: n => `un sachet de madeleines entamé dans le cartable ${de(n)}`,
      },
      {
        label: 'Tabac à pipe', icon: '🪈', trace: 'Une odeur de tabac à pipe flotte encore dans le local.',
        has: () => 'fume la pipe', not: () => 'ne fume pas',
        selfHas: () => 'Je fume la pipe, comme mon grand-père. Mais pas à l’intérieur !',
        selfNot: () => 'Je ne fume pas, vous pouvez sentir ma veste.',
        proof: n => `une blague à tabac brodée aux initiales ${de(n)}`,
      },
      {
        label: 'Encre violette', icon: '🖊️', trace: 'La fausse feuille de consignes est annotée à l’encre violette.',
        has: () => 'écrit à l’encre violette', not: () => 'n’écrit jamais à l’encre violette',
        selfHas: () => 'L’encre violette, c’est ma marque de fabrique. Tout le monde le sait.',
        selfNot: () => 'De l’encre violette ? Je ne suis plus à l’école primaire.',
        proof: n => `un stylo à encre violette marqué au nom ${de(n)}`,
      },
    ],
    mobiles: [
      {
        label: 'Argent', icon: '💸', has: () => 'a reçu une enveloppe d’un cabinet de lobbying',
        selfNot: () => 'De l’argent d’un lobby ? Jamais de la vie.',
        proof: n => `un relevé de virement d’un cabinet de lobbying au nom ${de(n)}`, why: () => 'pour l’argent d’un cabinet de lobbying',
      },
      {
        label: 'Ambition', icon: '📈', has: () => 'lorgne le poste du rapporteur',
        selfNot: () => 'Le poste de rapporteur ? Ça ne m’intéresse pas.',
        proof: n => `un plan de carrière ${de(n)} : « après la chute du rapporteur »`, why: () => 'pour faire chuter le rapporteur et prendre sa place',
      },
      {
        label: 'Rancune', icon: '😤', has: f => `a été ${g(f, 'écarté', 'écartée')} de la commission par le rapporteur et ne l’a pas digéré`,
        selfNot: () => 'Le rapporteur ? Nous sommes en excellents termes.',
        proof: n => `un courriel furieux ${de(n)} contre le rapporteur`, why: () => 'pour se venger du rapporteur',
      },
      {
        label: 'Conviction', icon: '📣', has: f => `est ${g(f, 'viscéralement opposé', 'viscéralement opposée')} à l’amendement`,
        selfNot: () => 'L’amendement ? J’étais plutôt pour, figurez-vous.',
        proof: n => `un argumentaire contre l’amendement, surligné par ${n}`, why: () => 'par conviction : cet amendement lui était insupportable',
      },
      chantage,
      {
        label: 'Consigne', icon: '🤝', has: () => 'obéit au doigt et à l’œil à un ministre hostile à l’amendement',
        selfNot: () => 'Je ne reçois d’ordres d’aucun ministre.',
        proof: n => `un SMS imprimé d’un ministre à ${n} : « Fais le nécessaire »`, why: () => 'sur ordre d’un ministre hostile à l’amendement',
      },
    ],
  },
};

const FIND_INTRO = ['Dans une corbeille :', 'Sous une pile de dossiers :', 'Dans un tiroir mal fermé :', 'Coincé derrière un radiateur :', 'Dans un manteau resté au portemanteau :', 'Au fond d’un carton :'];

/* ── Hasard ─────────────────────────────────────────────── */

export type Rng = () => number;

/** Générateur pseudo-aléatoire reproductible (tests) */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ri = (r: Rng, n: number) => Math.floor(r() * n);
const pickOf = <T>(r: Rng, a: readonly T[]): T => a[ri(r, a.length)];
function shuffled<T>(r: Rng, a: readonly T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = ri(r, i + 1); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/* ── Paramètres par difficulté ──────────────────────────── */

export function levelOf(diff: number): EnqueteLevel { return diff < 0.95 ? 0 : diff < 1.2 ? 1 : 2; }
export function variantOf(id: string): EnqueteVariant { return id.includes('joyau') ? 'joyaux' : id.includes('sabot') ? 'sabotage' : 'fuite'; }

const LEVELS: Record<EnqueteLevel, { n: number; places: number; budget: number; pCamLie: number }> = {
  0: { n: 5, places: 4, budget: 10, pCamLie: 0.5 },
  1: { n: 6, places: 5, budget: 10, pCamLie: 0.35 },
  2: { n: 6, places: 5, budget: 10, pCamLie: 0.3 },
};

/* ── Déclarations ───────────────────────────────────────── */

const key = (f: Fact) => `${f.who}|${f.cat}|${f.val}|${f.eq ? 1 : 0}`;

function truthOf(sus: Suspect[], f: Fact): boolean {
  const v = [sus[f.who].lieu, sus[f.who].badge, sus[f.who].signe, sus[f.who].mobile][f.cat];
  return (v === f.val) === f.eq;
}

/** Met une déclaration en mots, dans la bouche de `sp` */
function phrase(th: Theme, sus: Suspect[], sp: number, f: Fact, alibi: number, r: Rng): string {
  const S = sus[sp], T = sus[f.who], self = f.who === sp;
  const tn = T.first, Il = g(T.fem, 'Il', 'Elle'), il = g(T.fem, 'il', 'elle');
  const P = th.places, scene = P[0];
  switch (f.cat) {
    case LIEU: {
      const p = P[f.val];
      if (self && f.eq && f.val === 0) return pickOf(r, [
        `Oui, j’étais ${p.a} à ce moment-là. Je n’ai rien vu d’anormal, et je n’ai rien fait.`,
        `J’étais ${p.a}, je ne m’en cache pas. Ça ne fait pas de moi ${g(S.fem, 'un coupable', 'une coupable')}.`,
        `${cap(p.a)}, oui. J’y étais pour mon travail, comme tous les jours.`,
      ]);
      if (self && f.eq) return pickOf(r, [
        `J’étais ${p.a}, comme tous les soirs à cette heure-là.`,
        `Moi ? ${cap(p.a)}. Je n’en ai pas bougé.`,
        `À l’heure des faits, j’étais ${p.a}. Demandez à qui vous voulez.`,
        `J’ai passé toute la fin de journée ${p.a}, ${g(S.fem, 'seul', 'seule')} avec mes dossiers.`,
        `${cap(p.a)}, je vous dis. Ça fait trois fois que je le répète.`,
      ]);
      if (self) return pickOf(r, [
        `Je n’ai pas mis les pieds ${p.a} de la journée.`,
        `${cap(p.a)} ? Je n’y suis pas ${g(S.fem, 'allé', 'allée')}, je n’avais rien à y faire.`,
      ]);
      if (f.eq && f.val === 0) return pickOf(r, [
        `J’ai vu ${tn} entrer ${p.a} un peu avant l’heure.`,
        `${tn} était ${p.a}, j’en suis ${g(S.fem, 'sûr', 'sûre')} : j’ai reconnu sa voix derrière la porte.`,
      ]);
      if (f.eq && f.val === alibi) return pickOf(r, [
        `${tn} était avec moi ${p.a}, toute la soirée.`,
        `Demandez à ${tn} : nous étions ensemble ${p.a}.`,
      ]);
      if (f.eq) return pickOf(r, [
        `J’ai croisé ${tn} ${p.a}, ${il} avait l’air ${g(T.fem, 'pressé', 'pressée')}.`,
        `${tn} ? ${Il} était ${p.a}, je l’ai ${g(T.fem, 'vu', 'vue')} de mes yeux.`,
        `${tn} était ${p.a} à ce moment-là, je peux en témoigner.`,
        `Vous cherchez ${tn} ? ${Il} était ${p.a}, au téléphone.`,
      ]);
      return pickOf(r, [
        `${tn} n’a pas mis les pieds ${p.a} de la soirée, j’en mettrais ma main au feu.`,
        `${tn} ? Je peux vous dire qu’${il} n’est pas ${g(T.fem, 'allé', 'allée')} ${p.a}.`,
      ]);
    }
    case BADGE: {
      const the = scene.the;
      if (self) return f.val === (f.eq ? 1 : 0)
        ? pickOf(r, [`J’ai un badge pour ${the}, comme beaucoup de monde ici.`, `Oui, mon badge ouvre ${the}. Ça ne prouve rien.`])
        : pickOf(r, [`Je n’ai même pas de badge pour ${the} ! Demandez au secrétariat.`, `Mon badge n’ouvre pas ${the}, je dois toujours sonner.`]);
      return f.val === (f.eq ? 1 : 0)
        ? pickOf(r, [`${tn} a un badge pour ${the}, je l’ai déjà ${g(T.fem, 'vu', 'vue')} ouvrir la porte.`, `Le badge ${de(tn)} ouvre ${the}, c’est certain.`])
        : pickOf(r, [`${tn} n’a pas de badge pour ${the} : ${il} doit toujours demander qu’on lui ouvre.`, `${tn} ? Son badge n’ouvre pas ${the}, ${il} s’en plaint assez.`]);
    }
    case SIGNE: {
      const sg = th.signes[f.val];
      if (self) return f.eq ? sg.selfHas(S.fem) : sg.selfNot(S.fem);
      return f.eq
        ? pickOf(r, [`${tn} ${sg.has(T.fem)}.`, `Tout le monde sait que ${tn} ${sg.has(T.fem)}.`, `${tn} ? ${Il} ${sg.has(T.fem)}, c’est connu.`])
        : pickOf(r, [`${tn} ${sg.not(T.fem)}, j’en suis ${g(S.fem, 'sûr', 'sûre')}.`, `${tn} ? Non, ${il} ${sg.not(T.fem)}.`]);
    }
    default: {
      const mb = th.mobiles[f.val];
      if (self) return mb.selfNot(S.fem);
      return pickOf(r, [
        `Entre nous, ${tn} ${mb.has(T.fem)}.`,
        `Je ne devrais pas le dire, mais ${tn} ${mb.has(T.fem)}.`,
        `Vous devriez vous intéresser à ${tn} : ${il} ${mb.has(T.fem)}.`,
      ]);
    }
  }
}

/* ── Génération d'une affaire ───────────────────────────── */

function buildCase(variant: EnqueteVariant, level: EnqueteLevel, r: Rng): EnqueteCase {
  const th = THEMES[variant];
  const L = LEVELS[level];
  const N = L.n, P = L.places, S = th.signes.length, M = th.mobiles.length;
  const roles = shuffled(r, th.roles).slice(0, N);
  const ff = shuffled(r, FIRST_F), fm = shuffled(r, FIRST_M), ln = shuffled(r, LAST);
  const culprit = ri(r, N);
  const accomplice = level === 2 ? (culprit + 1 + ri(r, N - 1)) % N : -1;
  const trace = ri(r, S);

  const suspects: Suspect[] = roles.map((ro, i) => {
    const fem = r() < 0.5;
    const first = (fem ? ff : fm).pop()!;
    let lieu: number, badge: number, signe: number;
    if (i === culprit) { lieu = 0; badge = 1; signe = trace; }
    else {
      lieu = r() < 0.25 ? 0 : 1 + ri(r, P - 1);
      badge = r() < 0.6 ? 1 : 0;
      signe = r() < 0.35 ? trace : ri(r, S);
      if (lieu === 0 && badge === 1 && signe === trace) {
        const k = ri(r, 3);
        if (k === 0) lieu = 1 + ri(r, P - 1); else if (k === 1) badge = 0; else signe = (trace + 1 + ri(r, S - 1)) % S;
      }
    }
    return { first, name: `${first} ${ln.pop()}`, role: fem ? ro.f : ro.m, icon: ro.icons[fem ? 1 : 0], fem, lieu, badge, signe, mobile: ri(r, M) };
  });

  // Caméras : deux lieux équipés, hors scène (la scène a son registre de badges)
  const cams = range(P).map(p => p === 0);
  for (const p of shuffled(r, range(P - 1).map(i => i + 1)).slice(0, 2)) cams[p] = true;
  const camPlaces = range(P).filter(p => p > 0 && cams[p]);
  const darkPlaces = range(P).filter(p => p > 0 && !cams[p]);

  const used = new Set<string>();
  const statements: Statement[][] = range(N).map(() => []);
  const alibis: number[] = range(N).map(() => -1);
  const innocents = range(N).filter(s => s !== culprit);
  const add = (sp: number, f: Fact | null): boolean => {
    if (!f || used.has(key(f))) return false;
    used.add(key(f));
    statements[sp].push({ id: sp * 10 + statements[sp].length, speaker: sp, fact: f, text: nb(phrase(th, suspects, sp, f, alibis[sp], r)), lie: !truthOf(suspects, f) });
    return true;
  };

  // 1. Les alibis
  const q = r() < L.pCamLie || !darkPlaces.length ? pickOf(r, camPlaces) : pickOf(r, darkPlaces);
  for (let s = 0; s < N; s++) {
    if (s === culprit) {
      if (r() < 0.8) { alibis[s] = q; add(s, { who: s, cat: LIEU, val: q, eq: true }); }
      else add(s, { who: s, cat: LIEU, val: 0, eq: false });
    } else if (s === accomplice) {
      // Le complice ouvre par le faux alibi du coupable (« il était avec moi »), puis le sien
      const v = suspects[s].lieu !== q ? q : pickOf(r, range(P).filter(p => p > 0 && p !== suspects[s].lieu));
      alibis[s] = v;
      add(s, { who: culprit, cat: LIEU, val: q, eq: true });
      add(s, { who: s, cat: LIEU, val: v, eq: true });
    } else {
      alibis[s] = suspects[s].lieu;
      add(s, { who: s, cat: LIEU, val: suspects[s].lieu, eq: true });
    }
  }

  // 2. Deux déclarations de plus par suspect
  type Gen = [number, () => Fact | null];
  const others = (s: number) => range(N).filter(t => t !== s);
  const honestGens = (s: number): Gen[] => [
    [3, () => { const t = pickOf(r, others(s)); return { who: t, cat: LIEU, val: suspects[t].lieu, eq: true }; }],
    [2, () => { const c = others(s).filter(t => suspects[t].lieu !== 0); return c.length ? { who: pickOf(r, c), cat: LIEU, val: 0, eq: false } : null; }],
    [2, () => { const t = pickOf(r, others(s)); return { who: t, cat: BADGE, val: suspects[t].badge, eq: true }; }],
    [3, () => {
      const t = pickOf(r, others(s)), sg = suspects[t].signe;
      if (r() < 0.55) return { who: t, cat: SIGNE, val: sg, eq: true };
      return { who: t, cat: SIGNE, val: sg !== trace && r() < 0.6 ? trace : (sg + 1 + ri(r, S - 1)) % S, eq: false };
    }],
    [2, () => { const t = pickOf(r, others(s)); return { who: t, cat: MOBILE, val: suspects[t].mobile, eq: true }; }],
    [1, () => (r() < 0.5 ? { who: s, cat: SIGNE, val: suspects[s].signe, eq: true } : { who: s, cat: SIGNE, val: (suspects[s].signe + 1 + ri(r, S - 1)) % S, eq: false })],
    [1, () => ({ who: s, cat: BADGE, val: suspects[s].badge, eq: true })],
    [1, () => ({ who: s, cat: MOBILE, val: (suspects[s].mobile + 1 + ri(r, M - 1)) % M, eq: false })],
  ];
  const frameGens = (s: number): Gen[] => {
    const inn = innocents.filter(t => t !== s && t !== accomplice);
    return [
      [2, () => { const c = inn.filter(t => suspects[t].lieu !== 0); return c.length ? { who: pickOf(r, c), cat: LIEU, val: 0, eq: true } : null; }],
      [1, () => { const c = inn.filter(t => suspects[t].badge === 0); return c.length ? { who: pickOf(r, c), cat: BADGE, val: 1, eq: true } : null; }],
      [2, () => { const c = inn.filter(t => suspects[t].signe !== trace); return c.length ? { who: pickOf(r, c), cat: SIGNE, val: trace, eq: true } : null; }],
      [1, () => { const t = pickOf(r, inn); return { who: t, cat: MOBILE, val: (suspects[t].mobile + 1 + ri(r, M - 1)) % M, eq: true }; }],
    ];
  };
  const culpritGens: Gen[] = [
    [2, () => ({ who: culprit, cat: BADGE, val: 0, eq: true })],
    [2, () => ({ who: culprit, cat: SIGNE, val: trace, eq: false })],
    ...frameGens(culprit),
  ];
  const accompliceGens = (s: number): Gen[] => [
    [3, () => ({ who: culprit, cat: LIEU, val: q, eq: true })],
    [2, () => ({ who: culprit, cat: BADGE, val: 0, eq: true })],
    [2, () => ({ who: culprit, cat: SIGNE, val: trace, eq: false })],
    [1, () => ({ who: s, cat: BADGE, val: 1 - suspects[s].badge, eq: true })],
    ...frameGens(s),
  ];
  const weighted = (gens: Gen[]): Fact | null => {
    const tot = gens.reduce((t, [w]) => t + w, 0);
    let x = r() * tot;
    for (const [w, fn] of gens) { x -= w; if (x <= 0) return fn(); }
    return gens[gens.length - 1][1]();
  };
  // Le coupable nie son vrai mobile (« Des dettes, moi ? ») ; le complice jure l'avoir vu ailleurs
  const denial: Fact = { who: culprit, cat: MOBILE, val: suspects[culprit].mobile, eq: false };
  if (r() < 0.5) add(culprit, denial);
  for (let s = 0; s < N; s++) {
    if (s === culprit && statements[s].length === 1) {
      for (let tries = 0; statements[s].length < 2 && tries < 30; tries++) add(s, weighted(culpritGens));
      add(s, denial);
    }
    const gens = s === culprit ? culpritGens : s === accomplice ? accompliceGens(s) : honestGens(s);
    for (let tries = 0; statements[s].length < 3 && tries < 60; tries++) {
      const f = weighted(gens);
      // Une déclaration doit être vraie pour un honnête, fausse pour un menteur
      if (f && truthOf(suspects, f) === (s !== culprit && s !== accomplice)) add(s, f);
    }
  }

  // 3. Les fouilles : un indice matériel par lieu (hors scène)
  const finds: (Find | null)[] = range(P).map(() => null);
  const docPlace = r() < 0.5 ? pickOf(r, range(P - 1).map(i => i + 1)) : -1;
  const intros = shuffled(r, FIND_INTRO);
  for (let p = 1; p < P; p++) {
    let f: Fact | null = null;
    for (let tries = 0; tries < 20 && (!f || used.has(key(f))); tries++) {
      const t = p === docPlace && tries === 0 ? culprit : ri(r, N);
      f = p === docPlace && tries === 0 || r() < 0.5
        ? { who: t, cat: MOBILE, val: suspects[t].mobile, eq: true }
        : { who: t, cat: SIGNE, val: suspects[t].signe, eq: true };
    }
    if (!f || used.has(key(f))) continue;
    used.add(key(f));
    const n = suspects[f.who].name;
    const what = f.cat === MOBILE ? th.mobiles[f.val].proof(n) : th.signes[f.val].proof(n);
    finds[p] = { place: p, fact: f, text: `${intros[p % intros.length]} ${what}.` };
  }

  return { variant, level, theme: th, suspects, nPlaces: P, cams, culprit, accomplice, trace, budget: L.budget, statements, finds };
}

/** Tire une affaire jouable : solution unique, résoluble dans le budget par un enquêteur efficace */
export function generateCase(variant: EnqueteVariant, level: EnqueteLevel, r: Rng = Math.random): EnqueteCase {
  let fallback: EnqueteCase | null = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const cs = buildCase(variant, level, r);
    if (!isUnique(solutions(cs, fullKnowledge(cs)))) continue;
    const smart = smartSolve(cs, cs.budget);
    if (smart > cs.budget - 2 || smart < 4) { fallback ??= smart <= cs.budget ? cs : null; continue; }
    if (!methodicalSolve(cs).solved) { fallback ??= cs; continue; }
    return cs;
  }
  return fallback ?? buildCase(variant, level, r);
}

/* ── Le solveur ─────────────────────────────────────────── */

const bits = (m: number) => { const o: number[] = []; for (let i = 0; m; i++, m >>= 1) if (m & 1) o.push(i); return o; };

/**
 * Énumère les hypothèses (coupable, complice) compatibles avec ce que l'on sait.
 * Pour chacune, les domaines des attributs se réduisent fait par fait (toutes les
 * contraintes sont unaires une fois l'honnêteté de chacun fixée), puis on vérifie
 * les conditions du crime : le coupable les réunit toutes, aucun autre ne les réunit.
 * Renvoie les solutions (coupable, complice, mobile) et un poids (finesse restante).
 */
export function analyse(cs: EnqueteCase, k: Knowledge): { sols: Sol[]; weight: number } {
  const N = cs.suspects.length;
  const full = [cs.nPlaces, 2, cs.theme.signes.length, cs.theme.mobiles.length].map(n => (1 << n) - 1);
  const sols: Sol[] = [];
  let weight = 0;
  const accs = cs.accomplice >= 0 ? range(N) : [-1];
  const traces = k.trace !== null ? [k.trace] : range(cs.theme.signes.length);
  for (let c = 0; c < N; c++) {
    for (const a of accs) {
      if (a === c) continue;
      const honest = (s: number) => s !== c && s !== a;
      if (k.crosses.some(x => x.both !== (honest(x.sa) && honest(x.sb)))) continue;
      const dom = range(N).map(() => full.slice());
      const put = (f: Fact, truth: boolean) => { dom[f.who][f.cat] &= f.eq === truth ? 1 << f.val : ~(1 << f.val); };
      for (const f of k.facts) put(f, true);
      for (const st of k.stmts) put(st.fact, honest(st.speaker));
      if (dom.some(d => d.some(x => !x))) continue;
      let ok = false;
      for (const t of traces) {
        if (!(dom[c][LIEU] & 1) || !(dom[c][BADGE] & 2) || !(dom[c][SIGNE] & (1 << t))) continue;
        if (dom.some((d, s) => s !== c && d[LIEU] === 1 && d[BADGE] === 2 && d[SIGNE] === 1 << t)) continue;
        ok = true;
        weight += bits(dom[c][MOBILE]).length;
      }
      if (ok) for (const m of bits(dom[c][MOBILE])) sols.push({ c, a, m });
    }
  }
  return { sols, weight };
}

export function solutions(cs: EnqueteCase, k: Knowledge): Sol[] { return analyse(cs, k).sols; }
export function isUnique(sols: Sol[]): boolean { return sols.length === 1; }

/** Tout ce qu'on pourrait apprendre (sans les recoupements) */
export function fullKnowledge(cs: EnqueteCase): Knowledge {
  const st = newState(cs);
  for (let s = 0; s < cs.suspects.length; s++) for (let j = 0; j < cs.statements[s].length; j++) apply(cs, st, { t: 'ask', s });
  for (let p = 0; p < cs.nPlaces; p++) { apply(cs, st, { t: 'search', p }); if (cs.cams[p]) apply(cs, st, { t: 'cam', p }); }
  return st.k;
}

/* ── Les actions ────────────────────────────────────────── */

export function newState(cs: EnqueteCase): InvState {
  const P = cs.nPlaces;
  return {
    asked: cs.suspects.map(() => 0), searched: range(P).map(() => false), cammed: range(P).map(() => false),
    crossed: new Set(), k: { facts: [], stmts: [], crosses: [], trace: null }, moves: 0,
  };
}

function cloneState(st: InvState): InvState {
  return {
    asked: st.asked.slice(), searched: st.searched.slice(), cammed: st.cammed.slice(), crossed: new Set(st.crossed),
    k: { facts: st.k.facts.slice(), stmts: st.k.stmts.slice(), crosses: st.k.crosses.slice(), trace: st.k.trace }, moves: st.moves,
  };
}

const crossKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export function actions(cs: EnqueteCase, st: InvState, withCross = true): Action[] {
  const out: Action[] = [];
  cs.suspects.forEach((_, s) => { if (st.asked[s] < cs.statements[s].length) out.push({ t: 'ask', s }); });
  for (let p = 0; p < cs.nPlaces; p++) {
    if (!st.searched[p] && (p === 0 || cs.finds[p])) out.push({ t: 'search', p });
    if (cs.cams[p] && !st.cammed[p]) out.push({ t: 'cam', p });
  }
  if (withCross) {
    const ss = st.k.stmts;
    for (let i = 0; i < ss.length; i++) for (let j = i + 1; j < ss.length; j++) {
      if (ss[i].speaker !== ss[j].speaker && !st.crossed.has(crossKey(ss[i].id, ss[j].id))) out.push({ t: 'cross', a: ss[i].id, b: ss[j].id });
    }
  }
  return out;
}

/** Joue une action (une heure d'enquête) et renvoie l'indice obtenu */
export function apply(cs: EnqueteCase, st: InvState, a: Action, id = 0): Clue {
  const c = applyRaw(cs, st, a, id);
  return { ...c, title: nb(c.title), text: nb(c.text) };
}

function applyRaw(cs: EnqueteCase, st: InvState, a: Action, id: number): Clue {
  const th = cs.theme, sus = cs.suspects, P = th.places;
  st.moves++;
  switch (a.t) {
    case 'ask': {
      const stmt = cs.statements[a.s][st.asked[a.s]++];
      st.k.stmts.push(stmt);
      return { id, kind: 'stmt', icon: sus[a.s].icon, title: sus[a.s].name, text: `«\u202f${stmt.text}\u202f»`, who: a.s, stmtId: stmt.id };
    }
    case 'search': {
      st.searched[a.p] = true;
      if (a.p === 0) {
        st.k.trace = cs.trace;
        return { id, kind: 'search', icon: '🔍', title: `Fouille — ${P[0].label}`, text: th.signes[cs.trace].trace };
      }
      const f = cs.finds[a.p];
      if (f) st.k.facts.push(f.fact);
      return { id, kind: 'search', icon: '🔍', title: `Fouille — ${P[a.p].label}`, text: f ? f.text : 'Rien d’intéressant.' };
    }
    case 'cam': {
      st.cammed[a.p] = true;
      if (a.p === 0) {
        sus.forEach((s, i) => st.k.facts.push({ who: i, cat: BADGE, val: 1, eq: s.badge === 1 }));
        const yes = sus.filter(s => s.badge === 1).map(s => s.name);
        return { id, kind: 'badge', icon: '🪪', title: `Registre des badges — ${P[0].label}`, text: `Badges qui ouvrent ${P[0].the} : ${listFr(yes)}. Aucun autre.` };
      }
      sus.forEach((s, i) => st.k.facts.push({ who: i, cat: LIEU, val: a.p, eq: s.lieu === a.p }));
      const seen = sus.filter(s => s.lieu === a.p).map(s => s.name);
      return {
        id, kind: 'cam', icon: '📹', title: `Caméra — ${P[a.p].label}`,
        text: seen.length ? `Images ${th.hours} : ${listFr(seen)}. Personne d’autre.` : `Images ${th.hours} : personne. Le lieu est resté vide.`,
      };
    }
    case 'cross': {
      const sa = st.k.stmts.find(s => s.id === a.a)!, sb = st.k.stmts.find(s => s.id === a.b)!;
      st.crossed.add(crossKey(a.a, a.b));
      const both = !sa.lie && !sb.lie;
      st.k.crosses.push({ sa: sa.speaker, sb: sb.speaker, both });
      const na = sus[sa.speaker].first, nb = sus[sb.speaker].first;
      return {
        id, kind: 'cross', bad: !both, icon: both ? '✅' : '⚠️', title: `Recoupement — ${na} et ${nb}`,
        text: both
          ? `Les deux versions sont confirmées par des témoins extérieurs : ni ${na} ni ${nb} n’a menti.`
          : `Les deux versions ne résistent pas à la vérification : au moins l’un des deux ment.`,
      };
    }
  }
}

function listFr(a: string[]): string {
  if (!a.length) return 'aucun';
  return a.length === 1 ? a[0] : `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}`;
}

/* ── Les enquêteurs simulés (tests et calibrage) ────────── */

/** Enquêteur efficace : à chaque heure, l'action qui resserre le plus l'enquête */
export function smartSolve(cs: EnqueteCase, limit: number): number {
  const st = newState(cs);
  while (st.moves < limit) {
    if (isUnique(solutions(cs, st.k))) return st.moves;
    const before = analyse(cs, st.k);
    let best: Action | null = null, bw = Infinity;
    for (const a of actions(cs, st)) {
      const t = cloneState(st);
      apply(cs, t, a);
      const w = analyse(cs, t.k).weight;
      if (w < bw) { bw = w; best = a; }
    }
    // Palier : rien ne resserre l'enquête en une heure ; on cuisine le suspect principal, puis on fouille
    if (bw >= before.weight) best = plateauPick(cs, st, before.sols) ?? best;
    if (!best) break;
    apply(cs, st, best);
  }
  return isUnique(solutions(cs, st.k)) ? st.moves : Infinity;
}

function plateauPick(cs: EnqueteCase, st: InvState, sols: Sol[]): Action | null {
  const C = [...new Set(sols.map(s => s.c))];
  for (const c of C) if (st.asked[c] < cs.statements[c].length) return { t: 'ask', s: c };
  for (let p = 1; p < cs.nPlaces; p++) if (!st.searched[p] && cs.finds[p]) return { t: 'search', p };
  const A = [...new Set(sols.map(s => s.a))].filter(a => a >= 0);
  for (const a of A) if (st.asked[a] < cs.statements[a].length) return { t: 'ask', s: a };
  return null;
}

/** Enquêteur méthodique, sans tricher : scène, badges, alibis des suspects, caméras, recoupements */
export function methodicalSolve(cs: EnqueteCase, budget = cs.budget): { solved: boolean; moves: number; sols: Sol[] } {
  const st = newState(cs);
  while (st.moves < budget) {
    const sols = solutions(cs, st.k);
    if (isUnique(sols)) return { solved: true, moves: st.moves, sols };
    const a = methodicalPick(cs, st, sols);
    if (!a) break;
    apply(cs, st, a);
  }
  const sols = solutions(cs, st.k);
  return { solved: isUnique(sols), moves: st.moves, sols };
}

function methodicalPick(cs: EnqueteCase, st: InvState, sols: Sol[]): Action | null {
  if (!st.searched[0]) return { t: 'search', p: 0 };
  if (!st.cammed[0]) return { t: 'cam', p: 0 };
  const C = [...new Set(sols.map(s => s.c))];
  const A = [...new Set(sols.map(s => s.a))].filter(a => a >= 0);
  const N = cs.suspects.length;
  const canAsk = (s: number) => st.asked[s] < cs.statements[s].length;
  const honestKnown = (s: number) => sols.every(x => x.c !== s && x.a !== s);
  for (const c of C) if (st.asked[c] === 0) return { t: 'ask', s: c };
  if (C.length > 1) {
    for (const c of C) {
      const al = cs.statements[c][0].fact;
      if (al.cat === LIEU && al.eq && al.val > 0 && cs.cams[al.val] && !st.cammed[al.val]) return { t: 'cam', p: al.val };
    }
    for (const c of C) for (const x of st.k.stmts.filter(s => s.speaker === c)) for (const y of st.k.stmts) {
      if (y.speaker !== c && honestKnown(y.speaker) && !st.crossed.has(crossKey(x.id, y.id))) return { t: 'cross', a: x.id, b: y.id };
    }
  }
  if (C.length === 1 && new Set(sols.map(s => s.m)).size > 1) {
    if (canAsk(C[0])) return { t: 'ask', s: C[0] };
    for (let p = 1; p < cs.nPlaces; p++) if (!st.searched[p] && cs.finds[p]) return { t: 'search', p };
  }
  if (C.length === 1) for (const a of A) if (st.asked[a] === 0) return { t: 'ask', s: a };
  for (let p = 1; p < cs.nPlaces; p++) if (cs.cams[p] && !st.cammed[p]) return { t: 'cam', p };
  for (const c of C) if (canAsk(c)) return { t: 'ask', s: c };
  for (const a of A) if (st.asked[a] === 0) return { t: 'ask', s: a };
  if (A.length > 1) for (const a of A) for (const x of st.k.stmts.filter(s => s.speaker === a)) for (const y of st.k.stmts) {
    if (y.speaker !== a && honestKnown(y.speaker) && !st.crossed.has(crossKey(x.id, y.id))) return { t: 'cross', a: x.id, b: y.id };
  }
  const askable = range(N).filter(canAsk).sort((a, b) => st.asked[a] - st.asked[b]);
  if (askable.length) return { t: 'ask', s: askable[0] };
  for (let p = 1; p < cs.nPlaces; p++) if (!st.searched[p] && cs.finds[p]) return { t: 'search', p };
  return actions(cs, st)[0] ?? null;
}

/** Enquêteur au hasard : creuse n'importe où, puis accuse au jugé parmi ce qui reste possible */
export function randomInvestigate(cs: EnqueteCase, r: Rng): { solved: boolean; expected: number } {
  const st = newState(cs);
  while (st.moves < cs.budget) {
    const crosses = actions(cs, st).filter(a => a.t === 'cross');
    const plain = actions(cs, st, false);
    const pool = crosses.length && (r() < 0.15 || !plain.length) ? crosses : plain;
    if (!pool.length) break;
    apply(cs, st, pickOf(r, pool));
  }
  const sols = solutions(cs, st.k);
  const expected = sols.reduce((t, s) => t + scoreAccusation(cs, s.c, s.m, s.a, 0), 0) / Math.max(1, sols.length);
  return { solved: isUnique(sols), expected };
}

/* ── Score et dénouement ────────────────────────────────── */

export function scoreAccusation(cs: EnqueteCase, c: number, m: number, a: number, left: number): number {
  const okM = m === cs.suspects[cs.culprit].mobile;
  if (c === cs.culprit) {
    let s = left >= 1 ? 0.75 + 0.25 * Math.min(1, (left - 1) / 3) : 0.6;
    if (!okM) s -= 0.18;
    if (cs.accomplice >= 0 && a !== cs.accomplice) s -= 0.12;
    return Math.max(0.3, Math.min(1, s));
  }
  let s = 0.08 + (okM ? 0.14 : 0);
  if (cs.accomplice >= 0 && (a === cs.accomplice || c === cs.accomplice)) s += 0.07;
  return Math.min(0.34, s);
}

export interface Reveal {
  lies: { text: string; truth: string; heard: boolean }[];
  accLies: { text: string; truth: string; heard: boolean }[];
  chain: string[];
  others: { s: Suspect; reason: string }[];
}

function truthLine(cs: EnqueteCase, f: Fact): string {
  const th = cs.theme, T = cs.suspects[f.who], n = T.first, P = th.places;
  switch (f.cat) {
    case LIEU: return f.eq ? `${n} n’était pas ${P[f.val].a}, mais ${P[T.lieu].a}.` : `${n} était bel et bien ${P[0].a}.`;
    case BADGE: return T.badge ? `${n} avait bel et bien ${th.badge}.` : `${n} n’avait pas ${noBadge(th.badge)}.`;
    case SIGNE: return `En réalité, ${n} ${T.signe === f.val && !f.eq ? th.signes[f.val].has(T.fem) : th.signes[f.val].not(T.fem)}.`;
    default: return `En réalité, ${n} ${th.mobiles[T.mobile].has(T.fem)}.`;
  }
}

export function reveal(cs: EnqueteCase, heard: Set<number>): Reveal {
  const th = cs.theme, sus = cs.suspects, C = sus[cs.culprit], P = th.places;
  const liesOf = (s: number) => cs.statements[s].map(st => ({ text: st.text, truth: nb(truthLine(cs, st.fact)), heard: heard.has(st.id) }));
  const names = (f: (s: Suspect) => boolean) => listFr(sus.filter(f).map(s => s.first));
  const sg = th.signes[cs.trace];
  const chain = [
    `${sg.icon} L’indice (${sg.label.toLowerCase()}) désignait quelqu’un qui ${sg.has(C.fem)} : ${names(s => s.signe === cs.trace)}.`,
    `🔑 Avaient ${th.badge} : ${names(s => s.badge === 1)}.`,
    `📍 Étaient ${P[0].a} : ${names(s => s.lieu === 0)}.`,
    `⚖️ ${C.first} est ${g(C.fem, 'le seul', 'la seule')} à réunir les trois.`,
    `${th.mobiles[C.mobile].icon} Le mobile : ${C.first} ${th.mobiles[C.mobile].has(C.fem)}.`,
  ];
  const others = sus.filter((_, i) => i !== cs.culprit).map(s => ({
    s,
    reason: !s.badge ? `n’avait pas ${noBadge(th.badge)}` : s.lieu !== 0 ? `était ${P[s.lieu].a}` : th.signes[cs.trace].not(s.fem),
  }));
  return { lies: liesOf(cs.culprit), accLies: cs.accomplice >= 0 ? liesOf(cs.accomplice) : [], chain: chain.map(nb), others };
}

/* ── Le composant ───────────────────────────────────────── */

type Tab = 'inv' | 'notes' | 'grid' | 'acc';
const MARKS = ['', '✓', '✗', '?'];
const MARK_NAMES = ['vide', 'oui', 'non', 'doute'];

interface Verdict { ok: boolean; okM: boolean; okA: boolean; score: number; left: number; rv: Reveal; c: number; m: number; a: number }

@Component({
  selector: 'app-enquete-game',
  template: `
    @let th = cs.theme;
    <div class="enq">
      <div class="head">
        <span class="case"><span aria-hidden="true">{{ th.icon }}</span> <b>{{ th.title }}</b></span>
        <span class="hours" role="img" [attr.aria-label]="left() + ' heures d’enquête restantes sur ' + cs.budget">
          @for (h of hourSlots; track $index) { <i [class.used]="$index >= left()"></i> }
          <b class="mono">{{ left() }} h</b>
        </span>
      </div>

      @if (verdict(); as v) {
        @let C = cs.suspects[cs.culprit];
        <section class="verdict" [class.ok]="v.ok" aria-live="polite">
          <div class="stamp" [class.ok]="v.ok">{{ v.ok ? 'Affaire résolue' : 'Erreur judiciaire' }}</div>
          <div class="culprit">
            <span class="pic big" aria-hidden="true">{{ C.icon }}</span>
            <div>
              <b>{{ C.name }}</b><small>{{ C.role }}</small>
              <p>{{ C.first }} {{ th.verb }}, {{ th.mobiles[C.mobile].why(C.fem) }}.</p>
            </div>
          </div>
          <p class="yours">
            Votre accusation&#8239;: <b>{{ cs.suspects[v.c].name }}</b>&nbsp;<span [class]="v.ok ? 'good' : 'bad'">{{ v.ok ? '✓' : '✗' }}</span>,
            mobile «&#8239;{{ th.mobiles[v.m].label }}&#8239;»&nbsp;<span [class]="v.okM ? 'good' : 'bad'">{{ v.okM ? '✓' : '✗' }}</span>@if (cs.accomplice >= 0) {, complice <b>{{ cs.suspects[v.a].first }}</b>&nbsp;<span [class]="v.okA ? 'good' : 'bad'">{{ v.okA ? '✓' : '✗' }}</span>}
          </p>
          <h4>{{ C.fem ? 'Elle' : 'Il' }} avait menti sur toute la ligne</h4>
          <ul class="lies">
            @for (l of v.rv.lies; track $index) {
              <li [class.unheard]="!l.heard"><q>{{ l.text }}</q><span>→ {{ l.truth }}</span>@if (!l.heard) { <em>(jamais entendu)</em> }</li>
            }
          </ul>
          @if (cs.accomplice >= 0) {
            @let A = cs.suspects[cs.accomplice];
            <h4>{{ A.icon }}&nbsp;{{ A.name }}, {{ A.fem ? 'sa complice' : 'son complice' }}, l’a couvert{{ C.fem ? 'e' : '' }}</h4>
            <ul class="lies">
              @for (l of v.rv.accLies; track $index) {
                <li [class.unheard]="!l.heard"><q>{{ l.text }}</q><span>→ {{ l.truth }}</span>@if (!l.heard) { <em>(jamais entendu)</em> }</li>
              }
            </ul>
          }
          <h4>La chaîne des indices</h4>
          <ol class="chain">@for (c of v.rv.chain; track $index) { <li>{{ c }}</li> }</ol>
          <h4>Pourquoi pas les autres</h4>
          <ul class="others">
            @for (o of v.rv.others; track $index) { <li><span aria-hidden="true">{{ o.s.icon }}</span>&nbsp;<b>{{ o.s.first }}</b> {{ o.reason }}.</li> }
          </ul>
          <div class="final">
            <span class="mono">Score {{ pct(v.score) }} / 100 @if (v.ok && v.left) { · {{ v.left }} h d’avance }</span>
            <button type="button" class="btn primary" (click)="close()">Clore le dossier →</button>
          </div>
        </section>
      } @else {
        <details class="brief" [open]="!clues().length">
          <summary>Le dossier</summary>
          <p>{{ th.brief }}</p>
          <ul>
            <li>Le coupable était <b>{{ th.places[0].a }}</b>, avait <b>{{ th.badge }}</b> et correspond à l’indice laissé sur place : il est le seul à réunir les trois.</li>
            <li>Le coupable <b>ment à chaque déclaration</b>.@if (cs.accomplice >= 0) { Son <b>complice</b> ment aussi, pour le couvrir. } Les autres disent la vérité.</li>
            <li>Fouilles, caméras et badges ne mentent jamais. Chaque action coûte une heure.</li>
            <li>Accusez avant la fin : le coupable et son mobile@if (cs.accomplice >= 0) { , puis le complice }.</li>
          </ul>
        </details>

        <div class="tabs" role="tablist" aria-label="Enquête">
          @for (t of tabs; track t.id) {
            <button type="button" role="tab" [attr.aria-selected]="tab() === t.id" [class.on]="tab() === t.id" (click)="setTab(t.id)">
              <span class="ti" aria-hidden="true">{{ t.icon }}</span> {{ t.label }}@if (t.id === 'notes' && clues().length) { <i class="n">{{ clues().length }}</i> }
            </button>
          }
        </div>

        @switch (tab()) {
          @case ('inv') {
            @if (last(); as c) {
              <div class="last" [class]="'last k-' + c.kind" [class.bad]="c.bad" aria-live="polite">
                <span class="ic" aria-hidden="true">{{ c.icon }}</span>
                <div><b>{{ c.title }}</b><p>{{ c.text }}</p></div>
              </div>
            }
            @if (!left()) {
              <p class="out">Plus une heure devant vous : il est temps d’accuser. <button type="button" class="btn primary small" (click)="setTab('acc')">⚖️ Accuser</button></p>
            }
            <h4>🗣️ Interroger <small>une déclaration par heure</small></h4>
            <div class="who">
              @for (s of cs.suspects; track $index; let i = $index) {
                @let rest = cs.statements[i].length - asked()[i];
                <button type="button" class="sus" [disabled]="!rest || !left()" (click)="act({ t: 'ask', s: i })"
                        [attr.aria-label]="'Interroger ' + s.name + ', ' + s.role + ' (' + rest + ' déclaration' + (rest > 1 ? 's' : '') + ' en réserve)'">
                  <span class="pic" aria-hidden="true">{{ s.icon }}</span>
                  <span class="nm"><b>{{ s.name }}</b><small>{{ s.role }}</small>
                    <span class="dots" aria-hidden="true">@for (d of cs.statements[i]; track $index) { <i [class.on]="$index >= asked()[i]"></i> }</span></span>
                </button>
              }
            </div>
            <h4>🔍 Fouiller</h4>
            <div class="places">
              @for (p of placeIdx; track p) {
                <button type="button" class="pl" [disabled]="searched()[p] || !left() || (p > 0 && !cs.finds[p])" (click)="act({ t: 'search', p })"
                        [attr.aria-label]="'Fouiller : ' + th.places[p].label + (p === 0 ? ' (la scène)' : '') + (searched()[p] ? ', déjà fouillé' : '')">
                  <span aria-hidden="true">{{ th.places[p].icon }}</span> {{ th.places[p].label }}@if (p === 0) { <i class="tag">scène</i> }
                </button>
              }
            </div>
            <h4>📹 Caméras et badges</h4>
            <div class="places">
              @for (p of placeIdx; track p) {
                @if (cs.cams[p]) {
                  <button type="button" class="pl" [disabled]="cammed()[p] || !left()" (click)="act({ t: 'cam', p })"
                          [attr.aria-label]="(p === 0 ? 'Registre des badges : ' : 'Caméra : ') + th.places[p].label">
                    <span aria-hidden="true">{{ p === 0 ? '🪪' : '📹' }}</span> {{ p === 0 ? 'Badges · ' + th.places[p].label : th.places[p].label }}
                  </button>
                }
              }
            </div>
            <p class="muted small">Pas de caméra : {{ noCam }}.</p>
            <h4>🔁 Recouper <small>deux déclarations de deux personnes</small></h4>
            <button type="button" class="btn small" [disabled]="stmtCount() < 2 || !left()" (click)="startCross()">Choisir dans le carnet…</button>
          }

          @case ('notes') {
            @if (selecting()) {
              <div class="xbar" role="status">
                <span>Touchez deux déclarations de deux personnes différentes ({{ picks().length }}/2).</span>
                <span class="xbtns">
                  <button type="button" class="btn primary small" [disabled]="!crossReady()" (click)="doCross()">Recouper (1 h)</button>
                  <button type="button" class="btn small" (click)="selecting.set(false); picks.set([])">Annuler</button>
                </span>
              </div>
            }
            @if (!clues().length) { <p class="muted small">Le carnet est vide. Chaque heure d’enquête y ajoute un indice.</p> }
            <ol class="notes">
              @for (c of clues(); track c.id) {
                <li>
                  @if (selecting() && c.kind === 'stmt') {
                    <button type="button" class="note pick" [class]="'note pick k-' + c.kind" [class.on]="picks().includes(c.stmtId!)" [attr.aria-pressed]="picks().includes(c.stmtId!)" (click)="togglePick(c)">
                      <span class="ic" aria-hidden="true">{{ c.icon }}</span><span class="tx"><b>{{ c.title }}</b> {{ c.text }}</span>
                    </button>
                  } @else {
                    <div class="note" [class]="'note k-' + c.kind" [class.bad]="c.bad">
                      <span class="ic" aria-hidden="true">{{ c.icon }}</span><span class="tx"><b>{{ c.title }}</b> {{ c.text }}</span>
                    </div>
                  }
                </li>
              }
            </ol>
          }

          @case ('grid') {
            <div class="gwrap">
              <table class="lg">
                <thead>
                  <tr>
                    <th scope="col">Suspect</th>
                    @for (h of cols; track $index) { <th scope="col"><span aria-hidden="true">{{ h.icon }}</span><small>{{ h.label }}</small></th> }
                  </tr>
                </thead>
                <tbody>
                  @for (s of cs.suspects; track $index; let i = $index) {
                    <tr>
                      <th scope="row"><span aria-hidden="true">{{ s.icon }}</span> {{ s.first }}</th>
                      @for (h of cols; track $index; let j = $index) {
                        <td>
                          @if (j < 4) {
                            <button type="button" class="mk" [class]="'mk s' + grid()[i][j]" (click)="cycle(i, j)"
                                    [attr.aria-label]="s.first + ', ' + h.label + ' : ' + markName(grid()[i][j])">{{ mark(grid()[i][j]) }}</button>
                          } @else {
                            <button type="button" class="mk mob" (click)="cycleMob(i)"
                                    [attr.aria-label]="s.first + ', mobile : ' + (mob()[i] < 0 ? 'inconnu' : th.mobiles[mob()[i]].label)">{{ mob()[i] < 0 ? '·' : th.mobiles[mob()[i]].icon }}</button>
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="muted small">Touchez une case : ✓ oui, ✗ non, ? doute. « Sur place » : {{ th.places[0].a }} ; « Indice » : correspond à la trace trouvée ; « Ment » : a menti au moins une fois.</p>
            <p class="legend small">@for (m of th.mobiles; track $index) { <span>{{ m.icon }} {{ m.label }}</span> }</p>
          }

          @case ('acc') {
            <h4>Qui ?</h4>
            <div class="who acc">
              @for (s of cs.suspects; track $index; let i = $index) {
                <button type="button" class="sus" [class.on]="accC() === i" [attr.aria-pressed]="accC() === i" (click)="accC.set(i); accA() === i && accA.set(-1)">
                  <span class="pic" aria-hidden="true">{{ s.icon }}</span><span class="nm"><b>{{ s.name }}</b><small>{{ s.role }}</small></span>
                </button>
              }
            </div>
            <h4>Pourquoi ?</h4>
            <div class="mobs">
              @for (m of th.mobiles; track $index; let i = $index) {
                <button type="button" class="pl" [class.on]="accM() === i" [attr.aria-pressed]="accM() === i" (click)="accM.set(i)"><span aria-hidden="true">{{ m.icon }}</span> {{ m.label }}</button>
              }
            </div>
            @if (cs.accomplice >= 0) {
              <h4>Son complice ?</h4>
              <div class="mobs">
                @for (s of cs.suspects; track $index; let i = $index) {
                  @if (i !== accC()) {
                    <button type="button" class="pl" [class.on]="accA() === i" [attr.aria-pressed]="accA() === i" (click)="accA.set(i)"><span aria-hidden="true">{{ s.icon }}</span> {{ s.first }}</button>
                  }
                }
              </div>
            }
            <div class="go">
              <button type="button" class="btn primary" [disabled]="!accReady()" (click)="accuse()">⚖️ Accuser{{ accC() >= 0 ? ' ' + cs.suspects[accC()].first : '' }}</button>
              <span class="muted small">L’accusation est définitive.@if (left()) { Il vous reste {{ left() }} h : chaque heure épargnée compte. }</span>
            </div>
          }
        }
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; min-width: 0; }
    .enq { display: grid; gap: 10px; font-size: 13.5px; min-width: 0; }
    .head { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; justify-content: space-between; }
    .case { font-size: 14px; }
    .hours { display: inline-flex; align-items: center; gap: 3px;
      i { width: 9px; height: 14px; border-radius: 3px; background: var(--accent); transition: background .3s, opacity .3s; }
      i.used { background: var(--line); opacity: .7; }
      b { margin-left: 6px; font-size: 13px; } }
    .brief { border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); padding: 0 12px;
      summary { cursor: pointer; font-weight: 600; min-height: 36px; display: flex; align-items: center; }
      p { margin: 0 0 6px; color: var(--ink-2); }
      ul { margin: 0 0 10px; padding-left: 18px; display: grid; gap: 3px; color: var(--ink-2); font-size: 12.5px; } }
    .tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 3px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--line);
      button { min-height: 38px; border: 0; border-radius: 8px; background: transparent; color: var(--ink-2); font: 600 12.5px var(--font-body); cursor: pointer; padding: 4px 2px; position: relative; white-space: nowrap; }
      button.on { background: var(--surface); color: var(--ink); box-shadow: 0 1px 4px rgba(0,0,0,.12); }
      .n { font-style: normal; font-size: 10.5px; margin-left: 2px; padding: 0 5px; border-radius: 99px; background: var(--accent); color: var(--surface); } }
    @media (max-width: 420px) { .tabs .ti { display: none; } }
    h4 { margin: 4px 0 0; font-size: 13px; small { font-weight: 400; color: var(--ink-3); font-size: 11.5px; } }
    .small { font-size: 12px; margin: 0; }
    .last { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; background: var(--surface-2); border: 1px solid var(--line); border-left: 4px solid var(--accent);
      .ic { font-size: 22px; line-height: 1; }
      p { margin: 2px 0 0; color: var(--ink-2); }
      &.k-cross { border-left-color: var(--good); } &.k-cross.bad { border-left-color: var(--bad); } }
    .out { margin: 0; padding: 8px 10px; border-radius: 10px; background: var(--bad-soft); color: var(--bad); display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .who { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 6px; }
    .sus { display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); cursor: pointer; text-align: left; min-width: 0;
      &:disabled { opacity: .5; cursor: default; }
      &.on { border-color: var(--accent); box-shadow: inset 0 0 0 2px var(--accent); background: var(--surface-2); }
      .pic { font-size: 24px; line-height: 1; flex: none; }
      .nm { display: grid; min-width: 0; flex: 1; line-height: 1.25;
        b, small { overflow-wrap: anywhere; }
        b { font-size: 12.5px; } small { font-size: 11px; color: var(--ink-3); } }
      .dots { display: inline-flex; gap: 3px; margin-top: 3px; i { width: 7px; height: 7px; border-radius: 50%; background: var(--line); } i.on { background: var(--accent); } } }
    .places, .mobs { display: flex; flex-wrap: wrap; gap: 6px; }
    .pl { min-height: 36px; padding: 5px 10px; border: 1px solid var(--line); border-radius: 99px; background: var(--surface); color: var(--ink); cursor: pointer; font: 500 12.5px var(--font-body); display: inline-flex; align-items: center; gap: 5px;
      &:disabled { opacity: .45; cursor: default; text-decoration: line-through; }
      &.on { border-color: var(--accent); background: var(--accent); color: var(--surface); }
      .tag { font-style: normal; font-size: 10px; padding: 1px 6px; border-radius: 99px; background: var(--bad-soft); color: var(--bad); } }
    .xbar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: 10px; background: var(--accent-soft, var(--surface-2)); border: 1px solid var(--accent); font-size: 12.5px;
      .xbtns { display: inline-flex; gap: 6px; } }
    .notes { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .note { display: flex; gap: 8px; align-items: flex-start; width: 100%; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); text-align: left; font: inherit; font-size: 12.5px; line-height: 1.4;
      .ic { font-size: 18px; line-height: 1.1; flex: none; }
      .tx { min-width: 0; b { display: block; font-size: 11.5px; color: var(--ink-2); } }
      &.k-search, &.k-cam, &.k-badge { background: var(--surface-2); }
      &.k-cross { border-left: 3px solid var(--good); } &.k-cross.bad { border-left-color: var(--bad); } }
    .note.pick { cursor: pointer; min-height: 44px; border-style: dashed; }
    .note.pick.on { border: 2px solid var(--accent); background: var(--surface-2); }
    .gwrap { max-width: 100%; overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; -webkit-overflow-scrolling: touch; }
    .lg { border-collapse: collapse; width: 100%; min-width: 300px;
      th, td { padding: 2px; text-align: center; border-bottom: 1px solid var(--line); }
      thead th { font-size: 15px; padding: 6px 2px; small { display: block; font-size: 10px; color: var(--ink-3); font-weight: 500; } }
      tbody th { text-align: left; font-size: 12px; font-weight: 600; white-space: nowrap; padding: 2px 6px; max-width: 92px; overflow: hidden; text-overflow: ellipsis; }
      tr:last-child th, tr:last-child td { border-bottom: 0; } }
    .mk { width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); cursor: pointer; font: 700 16px var(--font-body); color: var(--ink-3); padding: 0;
      &.s1 { background: var(--good-soft); color: var(--good); border-color: transparent; }
      &.s2 { background: var(--bad-soft); color: var(--bad); border-color: transparent; }
      &.s3 { background: var(--surface-2); color: var(--ink-2); }
      &.mob { font-size: 17px; } }
    .legend { display: flex; flex-wrap: wrap; gap: 4px 10px; color: var(--ink-2); margin: 0; }
    .go { display: grid; gap: 6px; justify-items: start; margin-top: 6px; .btn { min-height: 42px; } }
    .verdict { display: grid; gap: 8px; padding: 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface);
      h4 { margin-top: 6px; } }
    .stamp { justify-self: center; padding: 4px 14px; border: 3px solid var(--bad); color: var(--bad); border-radius: 6px; font: 800 15px var(--font-body); letter-spacing: .12em; text-transform: uppercase; transform: rotate(-3deg);
      &.ok { border-color: var(--good); color: var(--good); } }
    .culprit { display: flex; gap: 12px; align-items: center;
      .big { font-size: 44px; line-height: 1; }
      b { display: block; font-size: 15px; } small { color: var(--ink-3); }
      p { margin: 4px 0 0; color: var(--ink-2); } }
    .yours { margin: 0; font-size: 12.5px; color: var(--ink-2); .good { color: var(--good); font-weight: 700; } .bad { color: var(--bad); font-weight: 700; } }
    .lies { list-style: none; margin: 0; padding: 0; display: grid; gap: 5px;
      li { padding: 6px 8px; border-radius: 8px; background: var(--bad-soft); font-size: 12.5px; display: grid; gap: 2px; }
      q { font-style: italic; quotes: '«\\202f' '\\202f»'; }
      span { color: var(--ink); font-weight: 500; }
      em { color: var(--ink-3); font-size: 11px; }
      li.unheard { opacity: .8; } }
    .chain, .others { margin: 0; padding-left: 18px; display: grid; gap: 3px; font-size: 12.5px; color: var(--ink-2); }
    .others { list-style: none; padding-left: 0; }
    .final { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; margin-top: 4px; }
    @media (prefers-reduced-motion: no-preference) {
      .last { animation: slide .35s ease both; }
      .stamp { animation: stamp .45s cubic-bezier(.2, 1.4, .4, 1) both; }
      @keyframes slide { from { opacity: 0; transform: translateY(-6px); } }
      @keyframes stamp { from { opacity: 0; transform: rotate(-3deg) scale(1.8); } }
    }
  `,
})
export class EnqueteGameComponent implements OnInit, OnDestroy {
  readonly def = input.required<MinigameDef>();
  readonly diff = input(1);
  readonly done = output<number>();
  readonly progress = output<{ live: number; time: number }>();
  readonly miss = output<void>();

  protected cs!: EnqueteCase;
  private st!: InvState;
  private uid = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private closed = false;

  protected readonly tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'inv', icon: '🔎', label: 'Enquêter' }, { id: 'notes', icon: '📓', label: 'Carnet' },
    { id: 'grid', icon: '▦', label: 'Grille' }, { id: 'acc', icon: '⚖️', label: 'Accuser' },
  ];
  protected readonly cols = [
    { icon: '📍', label: 'Sur place' }, { icon: '🔑', label: 'Badge' }, { icon: '🧪', label: 'Indice' },
    { icon: '🎭', label: 'Ment' }, { icon: '💼', label: 'Mobile' },
  ];
  protected hourSlots: number[] = [];
  protected placeIdx: number[] = [];
  protected noCam = '';

  protected readonly tab = signal<Tab>('inv');
  protected readonly clues = signal<Clue[]>([]);
  protected readonly last = signal<Clue | null>(null);
  protected readonly left = signal(0);
  protected readonly asked = signal<number[]>([]);
  protected readonly searched = signal<boolean[]>([]);
  protected readonly cammed = signal<boolean[]>([]);
  protected readonly selecting = signal(false);
  protected readonly picks = signal<number[]>([]);
  protected readonly grid = signal<number[][]>([]);
  protected readonly mob = signal<number[]>([]);
  protected readonly accC = signal(-1);
  protected readonly accM = signal(-1);
  protected readonly accA = signal(-1);
  protected readonly verdict = signal<Verdict | null>(null);

  protected readonly stmtCount = computed(() => this.clues().filter(c => c.kind === 'stmt').length);
  protected readonly crossReady = computed(() => {
    const p = this.picks();
    if (p.length !== 2 || !this.left()) return false;
    const [a, b] = p.map(id => this.st.k.stmts.find(s => s.id === id)!);
    return a.speaker !== b.speaker && !this.st.crossed.has(crossKey(a.id, b.id));
  });
  protected readonly accReady = computed(() => this.accC() >= 0 && this.accM() >= 0 && (this.cs.accomplice < 0 || (this.accA() >= 0 && this.accA() !== this.accC())));

  ngOnInit(): void {
    this.cs = generateCase(variantOf(this.def().id), levelOf(this.diff()));
    this.st = newState(this.cs);
    const P = this.cs.theme.places;
    this.hourSlots = range(this.cs.budget);
    this.placeIdx = range(this.cs.nPlaces);
    this.noCam = listFr(this.placeIdx.filter(p => !this.cs.cams[p]).map(p => (p === 0 ? `${P[p].label.toLowerCase()} (en panne)` : P[p].label.toLowerCase())));
    this.left.set(this.cs.budget);
    this.sync();
    this.grid.set(this.cs.suspects.map(() => [0, 0, 0, 0]));
    this.mob.set(this.cs.suspects.map(() => -1));
    this.emitProgress();
  }

  ngOnDestroy(): void { this.timers.forEach(t => clearTimeout(t)); }

  /* ── Enquête ── */

  protected setTab(t: Tab): void {
    this.tab.set(t);
    if (t !== 'notes') { this.selecting.set(false); this.picks.set([]); }
  }

  protected act(a: Action): void {
    if (this.verdict() || this.left() <= 0) return;
    const clue = apply(this.cs, this.st, a, ++this.uid);
    this.clues.update(c => [clue, ...c]);
    this.last.set(clue);
    this.left.set(this.cs.budget - this.st.moves);
    this.sync();
    this.emitProgress();
  }

  private sync(): void {
    this.asked.set(this.st.asked.slice());
    this.searched.set(this.st.searched.slice());
    this.cammed.set(this.st.cammed.slice());
  }

  protected startCross(): void {
    this.picks.set([]);
    this.selecting.set(true);
    this.tab.set('notes');
  }

  protected togglePick(c: Clue): void {
    const id = c.stmtId!;
    this.picks.update(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id].slice(-2)));
  }

  protected doCross(): void {
    if (!this.crossReady()) return;
    const [a, b] = this.picks();
    this.selecting.set(false);
    this.picks.set([]);
    this.act({ t: 'cross', a, b });
    this.tab.set('inv');
  }

  /* ── Grille ── */

  protected mark(v: number): string { return MARKS[v]; }
  protected markName(v: number): string { return MARK_NAMES[v]; }
  protected cycle(i: number, j: number): void {
    this.grid.update(g => g.map((row, r) => (r === i ? row.map((v, c) => (c === j ? (v + 1) % 4 : v)) : row)));
  }
  protected cycleMob(i: number): void {
    const n = this.cs.theme.mobiles.length;
    this.mob.update(m => m.map((v, r) => (r === i ? (v + 2) % (n + 1) - 1 : v)));
  }

  /* ── Accusation et dénouement ── */

  protected accuse(): void {
    if (!this.accReady() || this.verdict()) return;
    const cs = this.cs, c = this.accC(), m = this.accM(), a = this.accA();
    const score = scoreAccusation(cs, c, m, a, this.left());
    const heard = new Set(this.st.k.stmts.map(s => s.id));
    const v: Verdict = {
      ok: c === cs.culprit, okM: m === cs.suspects[cs.culprit].mobile, okA: cs.accomplice < 0 || a === cs.accomplice,
      score, left: this.left(), rv: reveal(cs, heard), c, m, a,
    };
    this.verdict.set(v);
    if (!v.ok) this.miss.emit();
    this.progress.emit({ live: score, time: 0 });
    // Le dénouement se lit : on laisse le joueur clore le dossier (repli automatique au bout de 45 s)
    this.timers.push(setTimeout(() => this.close(), 45000));
  }

  protected close(): void {
    const v = this.verdict();
    if (!v || this.closed) return;
    this.closed = true;
    this.timers.forEach(t => clearTimeout(t));
    this.done.emit(v.score);
  }

  protected pct(x: number): number { return Math.round(x * 100); }

  private emitProgress(): void {
    const sols = solutions(this.cs, this.st.k);
    const cands = new Set(sols.map(s => s.c)).size || 1;
    const potential = scoreAccusation(this.cs, this.cs.culprit, this.cs.suspects[this.cs.culprit].mobile, this.cs.accomplice, this.left());
    this.progress.emit({ live: potential / cands, time: this.left() / this.cs.budget });
  }
}

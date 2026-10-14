import { DebateMove, StatKey } from '../models/game.models';

/* ============================================================
 *  Traits de personnage, à la manière de Crusader Kings : des
 *  qualités et des défauts qui ne changent jamais. Certains sont
 *  tirés à la naissance (aptitudes, tempérament) ; d'autres
 *  s'acquièrent en cours de vie (cicatrices, gloires, manies).
 *  Une fois gagné, un trait reste : on ne l'efface pas.
 * ============================================================ */

export type TraitId =
  // Naissance : aptitudes
  | 'genie' | 'vif' | 'lent' | 'charismatique' | 'empote' | 'robuste' | 'fragile' | 'photogenique' | 'stentor' | 'memoire'
  | 'leve_tot' | 'nerfs_acier' | 'anxieux' | 'artiste' | 'chiffres'
  // Naissance : tempérament
  | 'ambitieux' | 'modeste' | 'honnete' | 'menteur' | 'colerique' | 'calme' | 'travailleur' | 'paresseux'
  | 'genereux' | 'avare' | 'timide' | 'audacieux' | 'rancunier' | 'indulgent' | 'cynique' | 'idealiste'
  | 'curieux' | 'tetu' | 'loyal' | 'opportuniste' | 'franc' | 'diplomate' | 'bon_vivant' | 'ascete'
  // Acquis en cours de vie
  | 'tribun' | 'survivant' | 'balafre' | 'chanceux' | 'entache' | 'sage' | 'insomniaque' | 'homme_etat'
  | 'chef_guerre' | 'ancien_souverain' | 'erudit' | 'polyglotte' | 'marathonien' | 'mondain' | 'pilier'
  | 'increvable' | 'revolutionnaire' | 'legislateur' | 'meme'
  | 'globe_trotteur' | 'ponctuel' | 'reformateur' | 'briscard' | 'mal_aime' | 'idole'
  // Fin d'un style de vie
  | 'orateur_legendaire' | 'grand_commis' | 'faiseur_de_rois' | 'machiavel' | 'penseur'
  // Exutoires (nés d'une crise de stress)
  | 'noctambule' | 'reclus' | 'irascible' | 'journal_intime' | 'mystique' | 'sportif_compulsif';

export type TraitKind = 'naissance' | 'temperament' | 'acquis';

export interface TraitMods {
  /** Multiplicateur des gains (et, pour le stress, des hausses) d'une stat */
  gain?: Partial<Record<StatKey, number>>;
  /** Multiplicateur des pertes d'une stat */
  loss?: Partial<Record<StatKey, number>>;
  /** Chaque mois */
  monthly?: Partial<Record<StatKey | 'health', number>>;
  /** Puissance des arguments en débat, par type de coup */
  debate?: Partial<Record<DebateMove, number>>;
  /** Sang-froid de départ en débat */
  composure?: number;
  /** Multiplicateur des hausses d'exposition aux scandales */
  exposure?: number;
  /** Multiplicateur de l'apprentissage des dossiers */
  mastery?: number;
  /** Multiplicateur des hausses de relation (amitiés) et des baisses (rancunes) */
  relationUp?: number;
  relationDown?: number;
  /** Années de vie en plus ou en moins (PNJ) */
  life?: number;
}

export interface TraitDef {
  id: TraitId;
  label: string;
  /** Forme féminine si elle diffère */
  labelF?: string;
  icon: string;
  kind: TraitKind;
  desc: string;
  /** Traits incompatibles : on ne peut pas avoir les deux */
  opposite?: TraitId;
  /** Tonalité : qualité, défaut ou neutre */
  tone: 'good' | 'bad' | 'mixed';
  mods: TraitMods;
}

const T = (id: TraitId, label: string, icon: string, kind: TraitKind, tone: TraitDef['tone'], desc: string, mods: TraitMods, extra: Partial<TraitDef> = {}): TraitDef =>
  ({ id, label, icon, kind, tone, desc, mods, ...extra });

export const TRAITS: Record<TraitId, TraitDef> = {
  // ── Aptitudes de naissance ──
  genie: T('genie', 'Génie', '🧠', 'naissance', 'good', 'Une intelligence hors norme : les dossiers s’apprennent vite, les chiffres viennent tout seuls.', { mastery: 1.35, debate: { faits: 1.2 }, gain: { credibility: 1.15 } }, { opposite: 'lent' }),
  vif: T('vif', 'Esprit vif', '⚡', 'naissance', 'good', 'La repartie facile et la compréhension rapide.', { mastery: 1.15, debate: { attaque: 1.1, parade: 1.1 } }, { opposite: 'lent' }),
  lent: T('lent', 'Esprit lent', '🐢', 'naissance', 'bad', 'Il faut relire deux fois les notes. Mais on finit par comprendre.', { mastery: 0.8, debate: { faits: 0.85 } }, { opposite: 'genie' }),
  charismatique: T('charismatique', 'Charismatique', '✨', 'naissance', 'good', 'On vous écoute dès que vous entrez dans une pièce.', { gain: { popularity: 1.2 }, debate: { emotion: 1.2 } }, { opposite: 'empote' }),
  empote: T('empote', 'Empoté', '🫠', 'naissance', 'bad', 'Les micros vous intimident, les mains ne savent pas où se mettre.', { gain: { popularity: 0.85 }, composure: -12 }, { labelF: 'Empotée', opposite: 'charismatique' }),
  robuste: T('robuste', 'Constitution robuste', '💪', 'naissance', 'good', 'Jamais malade, toujours debout à 6 h.', { monthly: { health: 0.4 }, loss: { energy: 0.85 }, life: 6 }, { opposite: 'fragile' }),
  fragile: T('fragile', 'Santé fragile', '🤧', 'naissance', 'bad', 'Le moindre courant d’air vous cloue au lit.', { monthly: { health: -0.35 }, loss: { energy: 1.15 }, life: -6 }, { opposite: 'robuste' }),
  photogenique: T('photogenique', 'Photogénique', '📸', 'naissance', 'good', 'Les caméras vous aiment, les unes de magazine aussi.', { gain: { popularity: 1.1, influence: 1.05 } }),
  stentor: T('stentor', 'Voix de stentor', '📢', 'naissance', 'good', 'Une voix qui porte jusqu’au fond des meetings.', { debate: { emotion: 1.12, attaque: 1.1 }, composure: 5 }),
  memoire: T('memoire', 'Mémoire d’éléphant', '🐘', 'naissance', 'good', 'Vous n’oubliez ni un chiffre, ni un visage, ni une trahison.', { mastery: 1.1, debate: { faits: 1.1 }, relationDown: 1.2 }),
  leve_tot: T('leve_tot', 'Lève-tôt', '🌅', 'naissance', 'good', 'Debout à 5 h, les dossiers lus avant le café.', { monthly: { energy: 1 }, mastery: 1.05 }),
  nerfs_acier: T('nerfs_acier', 'Nerfs d’acier', '🧊', 'naissance', 'good', 'Les crises glissent sur vous.', { composure: 12, gain: { stress: 0.85 } }, { opposite: 'anxieux' }),
  anxieux: T('anxieux', 'Anxieux', '😰', 'naissance', 'bad', 'Vous vous inquiétez de tout, et souvent à raison.', { composure: -8, gain: { stress: 1.2 }, mastery: 1.05 }, { labelF: 'Anxieuse', opposite: 'nerfs_acier' }),
  artiste: T('artiste', 'Âme d’artiste', '🎨', 'naissance', 'mixed', 'Des formules qui marquent, des chiffres qui vous ennuient.', { debate: { emotion: 1.15, faits: 0.92 }, gain: { popularity: 1.06 } }, { opposite: 'chiffres' }),
  chiffres: T('chiffres', 'Tête à chiffres', '🧮', 'naissance', 'mixed', 'Les tableaux vous parlent ; les foules, un peu moins.', { debate: { faits: 1.15, emotion: 0.92 }, mastery: 1.08 }, { opposite: 'artiste' }),
  // ── Tempérament de naissance ──
  ambitieux: T('ambitieux', 'Ambitieux', '🎯', 'temperament', 'mixed', 'Toujours un étage plus haut. Influence chaque mois, stress aussi.', { monthly: { influence: 0.4, stress: 0.5 }, gain: { influence: 1.1 } }, { labelF: 'Ambitieuse', opposite: 'modeste' }),
  modeste: T('modeste', 'Modeste', '🌱', 'temperament', 'mixed', 'On vous fait confiance, on vous oublie un peu.', { gain: { credibility: 1.1, influence: 0.9 }, monthly: { stress: -0.3 } }, { opposite: 'ambitieux' }),
  honnete: T('honnete', 'Honnête', '⚖️', 'temperament', 'good', 'Pas de casserole, pas de double discours.', { gain: { credibility: 1.15 }, exposure: 0.8 }, { labelF: 'Honnête', opposite: 'menteur' }),
  menteur: T('menteur', 'Menteur', '🤥', 'temperament', 'mixed', 'Mentir sans rougir sauve des débats… et nourrit les dossiers.', { debate: { parade: 1.2 }, exposure: 1.25, loss: { credibility: 1.15 } }, { labelF: 'Menteuse', opposite: 'honnete' }),
  colerique: T('colerique', 'Colérique', '😤', 'temperament', 'mixed', 'Des colères mémorables : redoutable à l’attaque, fragile sous pression.', { debate: { attaque: 1.2 }, composure: -10, gain: { stress: 1.2 } }, { opposite: 'calme' }),
  calme: T('calme', 'Calme', '🧘', 'temperament', 'good', 'Rien ne vous fait sortir de vos gonds.', { composure: 15, gain: { stress: 0.8 } }, { opposite: 'colerique' }),
  travailleur: T('travailleur', 'Bourreau de travail', '🗂️', 'temperament', 'mixed', 'Les nuits blanches ne vous font pas peur.', { mastery: 1.15, monthly: { politicalCapital: 0.5, stress: 0.4 } }, { opposite: 'paresseux' }),
  paresseux: T('paresseux', 'Indolent', '🛋️', 'temperament', 'bad', 'Pourquoi faire aujourd’hui ce qu’un collaborateur fera demain ?', { mastery: 0.85, monthly: { stress: -0.4 }, loss: { energy: 0.9 } }, { labelF: 'Indolente', opposite: 'travailleur' }),
  genereux: T('genereux', 'Généreux', '🎁', 'temperament', 'good', 'Le cœur sur la main : on vous rend vos gentillesses.', { relationUp: 1.25, gain: { popularity: 1.05 } }, { labelF: 'Généreuse', opposite: 'avare' }),
  avare: T('avare', 'Avare', '🪙', 'temperament', 'mixed', 'Chaque euro compte, chaque sourire aussi.', { relationUp: 0.85, monthly: { politicalCapital: 0.2 } }, { opposite: 'genereux' }),
  timide: T('timide', 'Timide', '🙈', 'temperament', 'bad', 'Les tribunes vous terrifient. Les dossiers, beaucoup moins.', { composure: -12, gain: { popularity: 0.9 }, mastery: 1.1 }, { opposite: 'audacieux' }),
  audacieux: T('audacieux', 'Audacieux', '🦁', 'temperament', 'mixed', 'Qui ne risque rien n’a rien.', { debate: { attaque: 1.1, emotion: 1.05 }, gain: { influence: 1.1 }, exposure: 1.1 }, { labelF: 'Audacieuse', opposite: 'timide' }),
  rancunier: T('rancunier', 'Rancunier', '🗡️', 'temperament', 'mixed', 'Vous n’oubliez rien. Vos ennemis non plus.', { relationDown: 1.4, debate: { attaque: 1.08 } }, { labelF: 'Rancunière', opposite: 'indulgent' }),
  indulgent: T('indulgent', 'Indulgent', '🕊️', 'temperament', 'good', 'Vous pardonnez vite : les rancunes s’effacent.', { relationDown: 0.7 }, { labelF: 'Indulgente', opposite: 'rancunier' }),
  cynique: T('cynique', 'Cynique', '🎭', 'temperament', 'mixed', 'La politique est un jeu, et vous le jouez froidement.', { gain: { influence: 1.1, credibility: 0.9 }, debate: { parade: 1.1 } }, { opposite: 'idealiste' }),
  idealiste: T('idealiste', 'Idéaliste', '🌈', 'temperament', 'mixed', 'Vous croyez encore pouvoir changer le monde.', { gain: { credibility: 1.1, influence: 0.92 }, debate: { emotion: 1.1 } }, { opposite: 'cynique' }),
  curieux: T('curieux', 'Curieux', '🔎', 'temperament', 'good', 'Vous voulez tout comprendre, tout lire, tout voir.', { mastery: 1.12 }, { labelF: 'Curieuse' }),
  tetu: T('tetu', 'Têtu', '🐐', 'temperament', 'mixed', 'Une fois décidé·e, rien ne vous fait changer d’avis.', { gain: { credibility: 1.05 }, relationUp: 0.9, debate: { parade: 1.12 } }, { labelF: 'Têtue' }),
  loyal: T('loyal', 'Loyal', '🤝', 'temperament', 'good', 'Vous ne lâchez jamais les vôtres, et ils le savent.', { relationUp: 1.15, monthly: { politicalCapital: 0.2 } }, { labelF: 'Loyale', opposite: 'opportuniste' }),
  opportuniste: T('opportuniste', 'Opportuniste', '🦊', 'temperament', 'mixed', 'Le vent tourne ? Vous tournez avec lui.', { gain: { influence: 1.1 }, relationDown: 1.1 }, { opposite: 'loyal' }),
  franc: T('franc', 'Franc-parler', '🗯️', 'temperament', 'mixed', 'Vous dites ce que vous pensez. Tout ce que vous pensez.', { debate: { attaque: 1.12 }, gain: { credibility: 1.05 }, exposure: 1.08 }, { opposite: 'diplomate' }),
  diplomate: T('diplomate', 'Diplomate', '🕴️', 'temperament', 'good', 'L’art de dire non en donnant l’impression de dire oui.', { relationDown: 0.8, debate: { parade: 1.12 } }, { opposite: 'franc' }),
  bon_vivant: T('bon_vivant', 'Bon vivant', '🍷', 'temperament', 'mixed', 'Les bonnes tables vous apaisent… et vous alourdissent.', { monthly: { stress: -0.5, health: -0.1 }, relationUp: 1.08 }, { labelF: 'Bonne vivante', opposite: 'ascete' }),
  ascete: T('ascete', 'Ascète', '🥗', 'temperament', 'mixed', 'Eau, légumes, huit heures de sommeil : une discipline de moine.', { monthly: { health: 0.15 }, relationUp: 0.92 }, { opposite: 'bon_vivant' }),
  // ── Acquis ──
  tribun: T('tribun', 'Tribun', '🎙️', 'acquis', 'good', 'Cinq débats gagnés : les plateaux vous redoutent.', { debate: { emotion: 1.1, attaque: 1.1, faits: 1.05 }, composure: 10 }),
  survivant: T('survivant', 'Survivant', '🛡️', 'acquis', 'good', 'Vous avez échappé au pire. Plus rien ne vous impressionne.', { composure: 8, gain: { stress: 0.9 } }, { labelF: 'Survivante' }),
  balafre: T('balafre', 'Balafré', '🩹', 'acquis', 'mixed', 'Une cicatrice qui raconte une histoire. Les photographes la cadrent toujours.', { gain: { popularity: 1.05 }, composure: 4 }, { labelF: 'Balafrée' }),
  chanceux: T('chanceux', 'Né sous une bonne étoile', '🍀', 'acquis', 'good', 'Le sort vous a souri une fois ; on dit qu’il vous suit.', { gain: { popularity: 1.05, influence: 1.05 } }, { labelF: 'Née sous une bonne étoile' }),
  entache: T('entache', 'Entaché', '🩸', 'acquis', 'bad', 'Un scandale vous colle à la peau : chaque nouvelle affaire fait plus de bruit.', { exposure: 1.2, gain: { credibility: 0.9 } }, { labelF: 'Entachée' }),
  sage: T('sage', 'Vieux sage', '🦉', 'acquis', 'good', 'L’âge apporte la sérénité et l’autorité.', { gain: { credibility: 1.12, stress: 0.85 }, composure: 6 }, { labelF: 'Vieille sage' }),
  insomniaque: T('insomniaque', 'Insomniaque', '🌙', 'acquis', 'bad', 'Des mois de stress ont eu raison de votre sommeil.', { monthly: { energy: -1, health: -0.1 }, gain: { stress: 1.1 } }),
  homme_etat: T('homme_etat', 'Homme d’État', '🏛️', 'acquis', 'good', 'Avoir dirigé le pays vous donne une stature à part.', { gain: { credibility: 1.1, influence: 1.1 }, composure: 6 }, { labelF: 'Femme d’État' }),
  chef_guerre: T('chef_guerre', 'Chef de guerre', '🎖️', 'acquis', 'good', 'Vous avez conduit le pays dans la guerre et l’en avez sorti.', { gain: { credibility: 1.1 }, debate: { faits: 1.05 }, composure: 8 }, { labelF: 'Cheffe de guerre' }),
  ancien_souverain: T('ancien_souverain', 'Ancien souverain', '👑', 'acquis', 'mixed', 'Vous avez porté la couronne. On ne vous regarde plus jamais pareil.', { gain: { influence: 1.1 }, exposure: 1.05 }, { labelF: 'Ancienne souveraine' }),
  erudit: T('erudit', 'Érudit', '📚', 'acquis', 'good', 'Un livre, des conférences : le savoir vous a façonné.', { mastery: 1.12, debate: { faits: 1.08 } }, { labelF: 'Érudite' }),
  polyglotte: T('polyglotte', 'Polyglotte', '🌍', 'acquis', 'good', 'Trois langues de plus : les sommets internationaux vous réussissent.', { gain: { influence: 1.05 } }),
  marathonien: T('marathonien', 'Marathonien', '🏃', 'acquis', 'good', '42,195 km : une endurance devenue légendaire.', { monthly: { health: 0.25, stress: -0.3 }, loss: { energy: 0.9 } }, { labelF: 'Marathonienne' }),
  mondain: T('mondain', 'Mondain', '🥂', 'acquis', 'mixed', 'Les dîners en ville n’ont plus de secret pour vous.', { relationUp: 1.15, exposure: 1.05 }, { labelF: 'Mondaine' }),
  pilier: T('pilier', 'Pilier du parti', '🧱', 'acquis', 'good', 'Des années de fidélité : le parti vous doit beaucoup.', { monthly: { politicalCapital: 0.4 } }),
  increvable: T('increvable', 'Increvable', '🔋', 'acquis', 'good', 'Des mois de rythme infernal sans craquer : votre énergie impressionne.', { loss: { energy: 0.85 } }),
  revolutionnaire: T('revolutionnaire', 'Figure de la révolution', '🔥', 'acquis', 'mixed', 'Vous avez renversé un régime. Les uns vous admirent, les autres vous craignent.', { gain: { popularity: 1.08 }, debate: { emotion: 1.1 }, exposure: 1.05 }),
  legislateur: T('legislateur', 'Grand législateur', '📜', 'acquis', 'good', 'Cinq lois portent votre nom : on vous consulte sur chaque texte.', { gain: { credibility: 1.08 }, mastery: 1.05 }, { labelF: 'Grande législatrice' }),
  meme: T('meme', 'Mème vivant', '🤳', 'acquis', 'mixed', 'Une séquence de vous tourne sur tous les réseaux. Pour toujours.', { gain: { popularity: 1.06 }, loss: { credibility: 1.05 } }),
  globe_trotteur: T('globe_trotteur', 'Globe-trotteur', '🧭', 'acquis', 'good', 'Des centaines de trains, d’avions et de valises : vous êtes chez vous partout.', { loss: { energy: 0.9 }, gain: { popularity: 1.04 } }, { labelF: 'Globe-trotteuse' }),
  ponctuel: T('ponctuel', 'Toujours à l’heure', '⏰', 'acquis', 'good', 'Trois trajets parfaits : votre ponctualité est devenue légendaire.', { gain: { credibility: 1.06 } }),
  reformateur: T('reformateur', 'Réformateur', '🛠️', 'acquis', 'good', 'Trois lois de votre plume adoptées : vous savez faire passer un texte.', { gain: { influence: 1.06 }, mastery: 1.05 }, { labelF: 'Réformatrice' }),
  briscard: T('briscard', 'Vieux briscard', '🗳️', 'acquis', 'good', 'Cinq campagnes électorales : plus rien ne vous surprend un soir de résultats.', { composure: 6, gain: { stress: 0.9 } }),
  mal_aime: T('mal_aime', 'Mal-aimé', '🌧️', 'acquis', 'bad', 'Six mois tout en bas des sondages : l’étiquette vous colle.', { gain: { popularity: 0.9 } }, { labelF: 'Mal-aimée' }),
  orateur_legendaire: T('orateur_legendaire', 'Orateur légendaire', '🏟️', 'acquis', 'good', 'Le style Tribun mené à son terme : on vient vous écouter comme on va au théâtre.', { debate: { emotion: 1.12, attaque: 1.08 }, gain: { popularity: 1.08 }, composure: 8 }, { labelF: 'Oratrice légendaire' }),
  grand_commis: T('grand_commis', 'Grand commis de l’État', '🏛️', 'acquis', 'good', 'Le style Gestionnaire mené à son terme : l’administration vous obéit au doigt et à l’œil.', { mastery: 1.12, gain: { credibility: 1.08 }, monthly: { politicalCapital: 0.6 } }),
  faiseur_de_rois: T('faiseur_de_rois', 'Faiseur de rois', '♟️', 'acquis', 'good', 'Le style Négociateur mené à son terme : sans vous, aucune majorité ne se fait.', { relationUp: 1.15, gain: { influence: 1.1 } }, { labelF: 'Faiseuse de rois' }),
  machiavel: T('machiavel', 'Machiavel', '🐍', 'acquis', 'mixed', 'Le style Intrigant mené à son terme : on vous craint plus qu’on ne vous aime.', { exposure: 0.85, debate: { parade: 1.12 }, relationUp: 0.92 }),
  penseur: T('penseur', 'Penseur', '🧭', 'acquis', 'good', 'Le style Intellectuel mené à son terme : vos livres font référence.', { mastery: 1.1, debate: { faits: 1.12 }, gain: { credibility: 1.08 } }),
  noctambule: T('noctambule', 'Noctambule', '🌃', 'acquis', 'mixed', 'Vous évacuez le stress dans les bars et les boîtes de nuit, au risque d’être photographié·e.', { monthly: { stress: -2, energy: -1 }, exposure: 1.1 }),
  reclus: T('reclus', 'Reclus', '🚪', 'acquis', 'mixed', 'Vous vous enfermez pour souffler. Le calme revient, les amitiés se refroidissent.', { monthly: { stress: -2 }, relationUp: 0.85 }, { labelF: 'Recluse' }),
  irascible: T('irascible', 'Irascible', '💢', 'acquis', 'bad', 'Le stress sort en colères mémorables : vos collaborateurs et collègues en font les frais.', { monthly: { stress: -2 }, relationDown: 1.25, debate: { attaque: 1.08 } }),
  journal_intime: T('journal_intime', 'Journal intime', '📓', 'acquis', 'good', 'Chaque soir, vous écrivez. Ça apaise, et ça nourrira un jour vos mémoires.', { monthly: { stress: -1.5 }, mastery: 1.03 }),
  mystique: T('mystique', 'Mystique', '🕯️', 'acquis', 'mixed', 'Retraites, méditation, abbayes : vous trouvez la paix ailleurs, et certains s’en moquent.', { monthly: { stress: -2 }, gain: { credibility: 0.95 } }),
  sportif_compulsif: T('sportif_compulsif', 'Sportif compulsif', '🏋️', 'acquis', 'mixed', 'Deux heures de sport par jour pour tenir : la santé suit, l’agenda moins.', { monthly: { stress: -2, health: 0.2, energy: -1 } }, { labelF: 'Sportive compulsive' }),
  idole: T('idole', 'Idole des foules', '🌟', 'acquis', 'good', 'Six mois au sommet des sondages : on vous arrête dans la rue pour un selfie.', { gain: { popularity: 1.06 }, exposure: 1.05 }),
};

export const BIRTH_APTITUDES: TraitId[] = ['genie', 'vif', 'lent', 'charismatique', 'empote', 'robuste', 'fragile', 'photogenique', 'stentor', 'memoire', 'leve_tot', 'nerfs_acier', 'anxieux', 'artiste', 'chiffres'];
export const TEMPERAMENTS: TraitId[] = ['ambitieux', 'modeste', 'honnete', 'menteur', 'colerique', 'calme', 'travailleur', 'paresseux', 'genereux', 'avare', 'timide', 'audacieux', 'rancunier', 'indulgent', 'cynique', 'idealiste', 'curieux', 'tetu', 'loyal', 'opportuniste', 'franc', 'diplomate', 'bon_vivant', 'ascete'];

/** Rareté des aptitudes de naissance (poids) */
export const APTITUDE_WEIGHT: Partial<Record<TraitId, number>> = { genie: 0.4, vif: 1, lent: 0.7, charismatique: 0.8, empote: 0.7, robuste: 1, fragile: 0.7, photogenique: 0.9, stentor: 0.8, memoire: 0.8 };

export function traitLabel(id: TraitId, gender: 'femme' | 'homme' = 'homme'): string {
  const t = TRAITS[id];
  return gender === 'femme' && t.labelF ? t.labelF : t.label;
}

export const TRAIT_KIND_LABELS: Record<TraitKind, string> = { naissance: 'De naissance', temperament: 'Tempérament', acquis: 'Acquis' };

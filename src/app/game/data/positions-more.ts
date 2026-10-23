import type { PositionTopic } from './positions';
import type { Domain, Effect, Segment } from '../models/game.models';

/* Sujets supplémentaires de prises de position (voir positions.ts).
 * Helpers locaux : on n’importe que des types depuis positions.ts
 * (positions.ts importe ce fichier, pas de cycle d’initialisation). */

const seg = (segment: Segment, delta: number): Effect => ({ kind: 'segment', segment, delta });
const cred = (delta: number): Effect => ({ kind: 'stat', stat: 'credibility', delta });
const dos = (domain: Domain, delta: number): Effect => ({ kind: 'dossier', domain, delta });

export const POSITIONS_MORE: PositionTopic[] = [
  /* ── Économie et social ───────────────────────────────── */
  {
    id: 'isf', label: 'L’impôt sur la fortune', question: 'Faut-il rétablir l’impôt sur la fortune (ISF) ?',
    answers: [
      { id: 'retablir', label: 'Oui, le rétablir sur tous les grands patrimoines', lean: -2, effects: [seg('populaires', 2), seg('cadres', -2)] },
      { id: 'climatique', label: 'Oui, sous forme d’ISF climatique', lean: -1, effects: [seg('jeunes', 2), seg('cadres', -1)] },
      { id: 'mondial', label: 'Plutôt un impôt minimal mondial sur les milliardaires', lean: 0, effects: [cred(1), seg('populaires', -1)] },
      { id: 'non', label: 'Non, cela ferait fuir les capitaux', lean: 2, effects: [seg('cadres', 2), seg('populaires', -2)] },
    ],
  },
  {
    id: 'smic', label: 'Le SMIC', question: 'Faut-il augmenter fortement le SMIC ?',
    answers: [
      { id: 'fort', label: 'Oui, le porter rapidement à 1 600 € net', lean: -2, effects: [seg('populaires', 3), seg('jeunes', 1), seg('cadres', -2)] },
      { id: 'conference', label: 'Oui, via une conférence salariale annuelle', lean: -1, effects: [seg('populaires', 1), seg('cadres', -1)] },
      { id: 'cotisations', label: 'Non, baisser plutôt les cotisations sur les salaires', lean: 1, effects: [seg('cadres', 2), seg('populaires', -1)] },
      { id: 'non', label: 'Non, cela menacerait les emplois peu qualifiés', lean: 2, effects: [seg('cadres', 2), seg('populaires', -2), seg('jeunes', -1)] },
    ],
  },
  {
    id: 'age_retraite', label: 'L’âge de la retraite', question: 'Quel âge légal de départ à la retraite défendez-vous ?',
    answers: [
      { id: 'soixante', label: 'Revenir à 60 ans pour tous', lean: -2, effects: [seg('populaires', 3), seg('retraites', 1), seg('cadres', -2)] },
      { id: 'penibilite', label: 'Garder 64 ans, mais mieux prendre en compte la pénibilité', lean: 0, effects: [seg('populaires', 1), seg('jeunes', -1)] },
      { id: 'referendum', label: 'Organiser un référendum sur la question', lean: 0, effects: [seg('populaires', 1), cred(-1)] },
      { id: 'reculer', label: 'Aller vers 66 ou 67 ans, comme nos voisins', lean: 2, effects: [seg('cadres', 2), seg('populaires', -3), seg('jeunes', -1)] },
    ],
  },
  {
    id: 'dette', label: 'La dette publique', question: 'Faut-il faire de la réduction de la dette la priorité, quitte à baisser les dépenses ?',
    answers: [
      { id: 'regle_or', label: 'Oui, avec une règle d’or inscrite dans la Constitution', lean: 2, effects: [seg('cadres', 2), seg('retraites', -1), seg('populaires', -1)] },
      { id: 'economies', label: 'Oui, par des économies ciblées sur l’État', lean: 1, effects: [seg('cadres', 1), seg('populaires', -1), dos('economie', 1)] },
      { id: 'mixte', label: 'Moitié économies, moitié recettes nouvelles', lean: 0, effects: [cred(1), seg('cadres', -1)] },
      { id: 'investir', label: 'Non, investir d’abord et taxer davantage les hauts revenus', lean: -2, effects: [seg('populaires', 2), seg('jeunes', 1), seg('cadres', -2)] },
    ],
  },
  {
    id: 'superprofits', label: 'Les superprofits', question: 'Faut-il taxer les superprofits des grandes entreprises ?',
    answers: [
      { id: 'permanente', label: 'Oui, une taxe permanente sur les profits exceptionnels', lean: -2, effects: [seg('populaires', 2), seg('cadres', -2)] },
      { id: 'crise', label: 'Oui, mais seulement en période de crise', lean: -1, effects: [seg('populaires', 1), seg('cadres', -1)] },
      { id: 'europe', label: 'Seulement au niveau européen, pour rester attractifs', lean: 1, effects: [cred(1), seg('populaires', -1)] },
      { id: 'non', label: 'Non, ce serait un mauvais signal pour l’investissement', lean: 2, effects: [seg('cadres', 2), seg('populaires', -2)] },
    ],
  },
  {
    id: 'succession', label: 'Les droits de succession', question: 'Faut-il alléger les droits de succession ?',
    answers: [
      { id: 'fortement', label: 'Oui, fortement : c’est le fruit d’une vie de travail', lean: 2, effects: [seg('retraites', 2), seg('cadres', 1), seg('jeunes', -2)] },
      { id: 'modestes', label: 'Oui, pour les transmissions modestes en ligne directe', lean: 1, effects: [seg('retraites', 1), seg('jeunes', -1)] },
      { id: 'reformer', label: 'Moins sur les petits héritages, plus sur les gros', lean: -1, effects: [seg('jeunes', 1), seg('populaires', 1), seg('cadres', -1)] },
      { id: 'alourdir', label: 'Non, il faut les alourdir sur les gros héritages', lean: -2, effects: [seg('jeunes', 2), seg('retraites', -2), seg('cadres', -1)] },
    ],
  },
  {
    id: 'assurance_chomage', label: 'L’assurance chômage', question: 'Faut-il durcir les règles de l’assurance chômage ?', minOrder: 2,
    answers: [
      { id: 'durcir', label: 'Oui, réduire nettement la durée d’indemnisation', lean: 2, effects: [seg('cadres', 2), seg('populaires', -2), seg('jeunes', -1)] },
      { id: 'contracyclique', label: 'Oui, quand le chômage est bas, moins quand il monte', lean: 1, effects: [seg('cadres', 1), seg('populaires', -1), dos('social', 1)] },
      { id: 'partenaires', label: 'Rendre la gestion du régime aux partenaires sociaux', lean: -1, effects: [cred(1), seg('cadres', -1)] },
      { id: 'proteger', label: 'Non, il faut au contraire mieux protéger les chômeurs', lean: -2, effects: [seg('populaires', 2), seg('cadres', -2)] },
    ],
  },
  {
    id: 'jours_feries', label: 'Les jours fériés', question: 'Faut-il supprimer un jour férié pour améliorer les finances publiques ?',
    answers: [
      { id: 'deux', label: 'Oui, et même deux : il faut travailler davantage', lean: 2, effects: [seg('cadres', 2), seg('populaires', -2), seg('jeunes', -1)] },
      { id: 'un', label: 'Oui, un seul, avec des recettes fléchées vers le grand âge', lean: 1, effects: [seg('retraites', 1), seg('populaires', -1)] },
      { id: 'partenaires', label: 'C’est aux partenaires sociaux de le négocier', lean: -1, effects: [cred(1), seg('cadres', -1)] },
      { id: 'non', label: 'Non, il faut trouver l’argent ailleurs', lean: -2, effects: [seg('populaires', 2), seg('cadres', -2)] },
    ],
  },

  /* ── Écologie et agriculture ──────────────────────────── */
  {
    id: 'voiture_thermique', label: 'La fin des voitures thermiques', question: 'Faut-il maintenir la fin de la vente des voitures thermiques neuves en 2035 ?',
    answers: [
      { id: 'avancer', label: 'Oui, et même l’avancer', lean: -2, effects: [seg('jeunes', 2), seg('ruraux', -2), seg('populaires', -1)] },
      { id: 'leasing', label: 'Oui, avec un leasing social pour les ménages modestes', lean: -1, effects: [seg('jeunes', 1), seg('populaires', 1), seg('cadres', -1)] },
      { id: 'assouplir', label: 'L’assouplir au niveau européen, en gardant les hybrides', lean: 1, effects: [seg('ruraux', 1), seg('cadres', 1), seg('jeunes', -1)] },
      { id: 'abandonner', label: 'Non, il faut y renoncer', lean: 2, effects: [seg('ruraux', 2), seg('populaires', 1), seg('jeunes', -2)] },
    ],
  },
  {
    id: 'avion_court', label: 'Les vols intérieurs', question: 'Faut-il interdire les vols intérieurs quand le train fait le trajet en moins de 4 heures ?',
    answers: [
      { id: 'quatre_heures', label: 'Oui, en dessous de 4 heures de train', lean: -2, effects: [seg('jeunes', 2), seg('cadres', -2), seg('ruraux', -1)] },
      { id: 'kerosene', label: 'Plutôt taxer le kérosène au niveau européen', lean: -1, effects: [seg('jeunes', 1), seg('cadres', -1)] },
      { id: 'actuel', label: 'Garder la règle actuelle des 2 h 30', lean: 1, effects: [seg('cadres', 1), seg('jeunes', -1)] },
      { id: 'non', label: 'Non, et lever les restrictions existantes', lean: 2, effects: [seg('cadres', 2), seg('ruraux', 1), seg('jeunes', -2)] },
    ],
  },
  {
    id: 'glyphosate', label: 'Le glyphosate', question: 'Faut-il interdire le glyphosate en France ?',
    answers: [
      { id: 'immediat', label: 'Oui, immédiatement et sans dérogation', lean: -2, effects: [seg('jeunes', 2), seg('ruraux', -3)] },
      { id: 'progressif', label: 'Oui, d’ici cinq ans, avec des aides aux agriculteurs', lean: -1, effects: [seg('jeunes', 1), seg('ruraux', -1), dos('ecologie', 1)] },
      { id: 'agences', label: 'Suivre l’avis des agences sanitaires européennes', lean: 1, effects: [cred(1), seg('jeunes', -1)] },
      { id: 'non', label: 'Non, pas tant qu’il n’existe pas d’alternative viable', lean: 2, effects: [seg('ruraux', 3), seg('jeunes', -2)] },
    ],
  },
  {
    id: 'eoliennes', label: 'Les éoliennes', question: 'Faut-il continuer à installer des éoliennes terrestres ?',
    answers: [
      { id: 'accelerer', label: 'Oui, et accélérer les autorisations', lean: 0, effects: [seg('jeunes', 2), seg('ruraux', -2)] },
      { id: 'communes', label: 'Oui, mais avec l’accord des communes concernées', lean: 0, effects: [seg('ruraux', 1), seg('jeunes', -1)] },
      { id: 'mer', label: 'Non, seulement en mer', lean: 0, effects: [seg('ruraux', 1), seg('retraites', 1), seg('cadres', -1)] },
      { id: 'moratoire', label: 'Non, un moratoire sur les nouveaux projets', lean: 0, effects: [seg('ruraux', 2), seg('retraites', 1), seg('jeunes', -2)] },
    ],
  },
  {
    id: 'viande', label: 'La consommation de viande', question: 'Les pouvoirs publics doivent-ils inciter les Français à manger moins de viande ?',
    answers: [
      { id: 'taxe', label: 'Oui, avec une taxe sur la viande industrielle', lean: -2, effects: [seg('jeunes', 2), seg('ruraux', -2), seg('populaires', -1)] },
      { id: 'cantines', label: 'Oui, avec une option végétarienne quotidienne en cantine', lean: -1, effects: [seg('jeunes', 1), seg('ruraux', -1)] },
      { id: 'local', label: 'Manger mieux plutôt que moins : soutenir l’élevage local', lean: 1, effects: [seg('ruraux', 2), seg('jeunes', -1)] },
      { id: 'libre', label: 'Non, ce n’est pas à l’État de composer les assiettes', lean: 2, effects: [seg('ruraux', 1), seg('populaires', 1), seg('jeunes', -2)] },
    ],
  },

  /* ── Éducation ────────────────────────────────────────── */
  {
    id: 'uniforme', label: 'L’uniforme à l’école', question: 'Faut-il généraliser l’uniforme à l’école ?',
    answers: [
      { id: 'generaliser', label: 'Oui, partout, du primaire au lycée', lean: 2, effects: [seg('retraites', 2), seg('jeunes', -2)] },
      { id: 'evaluer', label: 'Poursuivre l’expérimentation et l’évaluer d’abord', lean: 0, effects: [cred(1), seg('retraites', -1)] },
      { id: 'etablissement', label: 'Laisser chaque établissement décider', lean: 0, effects: [seg('cadres', 1), seg('retraites', -1)] },
      { id: 'non', label: 'Non, ce n’est pas la priorité de l’école', lean: -2, effects: [seg('jeunes', 2), seg('retraites', -2)] },
    ],
  },
  {
    id: 'telephone_ecole', label: 'Le téléphone à l’école', question: 'Faut-il interdire le téléphone portable dans tous les établissements, lycée compris ?',
    answers: [
      { id: 'lycee', label: 'Oui, du primaire au lycée, rangé dans un casier', lean: 1, effects: [seg('retraites', 2), seg('cadres', 1), seg('jeunes', -2)] },
      { id: 'college', label: 'Jusqu’au collège seulement', lean: 0, effects: [seg('cadres', 1), seg('retraites', -1)] },
      { id: 'etablissement', label: 'C’est aux établissements de fixer leurs règles', lean: 0, effects: [cred(1), seg('retraites', -1)] },
      { id: 'eduquer', label: 'Non, mieux vaut éduquer aux usages du numérique', lean: -1, effects: [seg('jeunes', 2), seg('retraites', -2)] },
    ],
  },
  {
    id: 'notes', label: 'Les notes à l’école', question: 'Faut-il supprimer les notes chiffrées à l’école primaire et au collège ?',
    answers: [
      { id: 'supprimer', label: 'Oui, au profit d’une évaluation par compétences', lean: -2, effects: [seg('jeunes', 1), seg('retraites', -2)] },
      { id: 'primaire', label: 'Seulement à l’école primaire', lean: -1, effects: [seg('jeunes', 1), seg('retraites', -1)] },
      { id: 'garder', label: 'Non, les notes sont claires pour les familles', lean: 1, effects: [seg('retraites', 1), seg('populaires', 1), seg('jeunes', -1)] },
      { id: 'classement', label: 'Non, et rétablir aussi le classement des élèves', lean: 2, effects: [seg('retraites', 2), seg('jeunes', -2)] },
    ],
  },

  /* ── Santé ────────────────────────────────────────────── */
  {
    id: 'deserts_medicaux', label: 'Les déserts médicaux', question: 'Faut-il obliger les jeunes médecins à s’installer dans les déserts médicaux ?',
    answers: [
      { id: 'obliger', label: 'Oui, deux ou trois ans obligatoires en zone sous-dotée', lean: -1, effects: [seg('ruraux', 3), seg('jeunes', -2), seg('cadres', -1)] },
      { id: 'reguler', label: 'Limiter les installations là où les médecins sont nombreux', lean: 0, effects: [seg('ruraux', 2), seg('cadres', -1)] },
      { id: 'incitations', label: 'Non, plutôt des incitations financières', lean: 0, effects: [seg('cadres', 1), seg('ruraux', -1)] },
      { id: 'liberte', label: 'Non, former davantage et garder la liberté d’installation', lean: 1, effects: [seg('jeunes', 1), seg('cadres', 1), seg('ruraux', -2)] },
    ],
  },
  {
    id: 'franchises', label: 'Les franchises médicales', question: 'Faut-il augmenter les franchises médicales payées par les patients ?', minOrder: 2,
    answers: [
      { id: 'supprimer', label: 'Non, il faut même les supprimer', lean: -2, effects: [seg('populaires', 2), seg('retraites', 1), seg('cadres', -2)] },
      { id: 'geler', label: 'Non, les geler à leur niveau actuel', lean: -1, effects: [seg('populaires', 1), seg('cadres', -1)] },
      { id: 'plafond', label: 'Oui, avec un plafond annuel qui protège les malades', lean: 1, effects: [seg('cadres', 1), seg('retraites', -1), dos('sante', 1)] },
      { id: 'oui', label: 'Oui, pour responsabiliser et financer la Sécu', lean: 2, effects: [seg('cadres', 2), seg('retraites', -2), seg('populaires', -1)] },
    ],
  },
  {
    id: 'depassements', label: 'Les dépassements d’honoraires', question: 'Faut-il encadrer plus strictement les dépassements d’honoraires des médecins ?', minOrder: 2,
    answers: [
      { id: 'interdire', label: 'Oui, les interdire à terme', lean: -2, effects: [seg('populaires', 2), seg('cadres', -2)] },
      { id: 'plafonner', label: 'Oui, les plafonner plus strictement', lean: -1, effects: [seg('populaires', 1), seg('retraites', 1), seg('cadres', -1)] },
      { id: 'negociation', label: 'C’est à l’Assurance maladie de le négocier avec les médecins', lean: 1, effects: [cred(1), seg('populaires', -1)] },
      { id: 'non', label: 'Non, ils compensent des tarifs de base trop bas', lean: 2, effects: [seg('cadres', 2), seg('populaires', -2)] },
    ],
  },

  /* ── Institutions ─────────────────────────────────────── */
  {
    id: 'proportionnelle', label: 'La proportionnelle', question: 'Faut-il instaurer la proportionnelle aux élections législatives ?',
    answers: [
      { id: 'integrale', label: 'Oui, une proportionnelle intégrale', lean: 0, effects: [seg('jeunes', 1), seg('populaires', 1), seg('cadres', -1)] },
      { id: 'dose', label: 'Une dose de proportionnelle, autour de 20 %', lean: 0, effects: [seg('cadres', 1), seg('populaires', -1)] },
      { id: 'majoritaire', label: 'Non, le scrutin majoritaire donne des majorités stables', lean: 0, effects: [seg('cadres', 1), seg('retraites', 1), seg('jeunes', -1)] },
      { id: 'referendum', label: 'Le soumettre aux Français par référendum', lean: 0, effects: [seg('populaires', 1), cred(-1)] },
    ],
  },
  {
    id: 'vote_obligatoire', label: 'Le vote obligatoire', question: 'Faut-il rendre le vote obligatoire ?',
    answers: [
      { id: 'amende', label: 'Oui, avec une amende symbolique', lean: 0, effects: [seg('retraites', 2), seg('jeunes', -2)] },
      { id: 'blanc', label: 'Oui, à condition de reconnaître le vote blanc', lean: 0, effects: [seg('populaires', 1), seg('jeunes', 1), cred(-1)] },
      { id: 'faciliter', label: 'Non, mais faciliter le vote (procuration, vote anticipé)', lean: 0, effects: [seg('jeunes', 1), seg('cadres', 1), seg('retraites', -1)] },
      { id: 'non', label: 'Non, voter est un droit, pas une obligation', lean: 0, effects: [seg('cadres', 2), seg('populaires', -1)] },
    ],
  },
  {
    id: 'ric', label: 'Le référendum d’initiative citoyenne', question: 'Faut-il instaurer le référendum d’initiative citoyenne (RIC) ?',
    answers: [
      { id: 'tous_sujets', label: 'Oui, sur tous les sujets, Constitution comprise', lean: 0, effects: [seg('populaires', 3), seg('cadres', -2)] },
      { id: 'encadre', label: 'Oui, avec un seuil de signatures élevé et un contrôle juridique', lean: 0, effects: [seg('populaires', 1), seg('cadres', -1)] },
      { id: 'rip', label: 'Assouplir plutôt le référendum d’initiative partagée', lean: 0, effects: [seg('cadres', 1), seg('populaires', -1)] },
      { id: 'non', label: 'Non, la démocratie représentative doit rester la règle', lean: 0, effects: [seg('cadres', 2), seg('retraites', 1), seg('populaires', -2)] },
    ],
  },
  {
    id: 'cumul_mandats', label: 'Le cumul des mandats', question: 'Faut-il de nouveau autoriser un parlementaire à être aussi maire ?',
    answers: [
      { id: 'retablir', label: 'Oui, un député-maire connaît mieux le terrain', lean: 1, effects: [seg('ruraux', 2), seg('retraites', 1), seg('jeunes', -2)] },
      { id: 'petites', label: 'Oui, mais seulement pour les maires de petites communes', lean: 0, effects: [seg('ruraux', 1), seg('cadres', -1)] },
      { id: 'non', label: 'Non, un mandat de parlementaire est un temps plein', lean: -1, effects: [seg('jeunes', 1), seg('cadres', 1), seg('ruraux', -1)] },
      { id: 'limiter', label: 'Non, et limiter aussi le nombre de mandats successifs', lean: 0, effects: [seg('jeunes', 2), seg('retraites', -1), seg('ruraux', -1)] },
    ],
  },
  {
    id: 'vote_16', label: 'Le vote à 16 ans', question: 'Faut-il abaisser le droit de vote à 16 ans ?',
    answers: [
      { id: 'oui', label: 'Oui, pour toutes les élections', lean: -2, effects: [seg('jeunes', 3), seg('retraites', -2)] },
      { id: 'local', label: 'Oui, d’abord pour les élections locales', lean: -1, effects: [seg('jeunes', 1), seg('retraites', -1)] },
      { id: 'civique', label: 'Non, mais renforcer l’éducation civique au lycée', lean: 1, effects: [seg('retraites', 1), seg('jeunes', -1)] },
      { id: 'non', label: 'Non, la majorité est à 18 ans, pour tout', lean: 2, effects: [seg('retraites', 2), seg('jeunes', -2)] },
    ],
  },

  /* ── Justice et sécurité ──────────────────────────────── */
  {
    id: 'peines_planchers', label: 'Les peines planchers', question: 'Faut-il rétablir les peines planchers pour les récidivistes ?',
    answers: [
      { id: 'tous_delits', label: 'Oui, pour tous les délits commis en récidive', lean: 2, effects: [seg('retraites', 2), seg('populaires', 1), seg('jeunes', -2)] },
      { id: 'violences', label: 'Oui, mais seulement pour les violences aux personnes', lean: 1, effects: [seg('retraites', 1), seg('jeunes', -1)] },
      { id: 'juges', label: 'Non, laissons les juges individualiser les peines', lean: -1, effects: [seg('cadres', 1), seg('retraites', -2), dos('justice', 1)] },
      { id: 'reinsertion', label: 'Non, misons sur la prévention et la réinsertion', lean: -2, effects: [seg('jeunes', 2), seg('retraites', -2)] },
    ],
  },
  {
    id: 'videosurveillance', label: 'La vidéosurveillance algorithmique', question: 'Faut-il généraliser la vidéosurveillance algorithmique dans l’espace public ?',
    answers: [
      { id: 'generaliser', label: 'Oui, partout où cela aide les forces de l’ordre', lean: 2, effects: [seg('retraites', 2), seg('jeunes', -2), dos('securite', 1)] },
      { id: 'evenements', label: 'Seulement pour les grands événements, de façon encadrée', lean: 1, effects: [seg('cadres', 1), seg('jeunes', -1)] },
      { id: 'cnil', label: 'Seulement après avis de la CNIL et vote du Parlement', lean: -1, effects: [cred(1), seg('retraites', -1)] },
      { id: 'non', label: 'Non, c’est un risque pour les libertés publiques', lean: -2, effects: [seg('jeunes', 2), seg('retraites', -2)] },
    ],
  },
  {
    id: 'police_municipale', label: 'L’armement des polices municipales', question: 'Faut-il armer toutes les polices municipales ?',
    answers: [
      { id: 'partout', label: 'Oui, partout, pour la sécurité des agents', lean: 2, effects: [seg('retraites', 2), seg('jeunes', -2)] },
      { id: 'formation', label: 'Oui, avec la même formation que la police nationale', lean: 0, effects: [seg('cadres', 1), seg('retraites', 1), cred(-1)] },
      { id: 'maire', label: 'C’est à chaque maire de décider', lean: 0, effects: [seg('ruraux', 1), seg('retraites', -1)] },
      { id: 'non', label: 'Non, c’est le rôle de la police nationale', lean: -2, effects: [seg('jeunes', 1), seg('cadres', 1), seg('retraites', -2)] },
    ],
  },

  /* ── Numérique ────────────────────────────────────────── */
  {
    id: 'reseaux_15', label: 'Les réseaux sociaux avant 15 ans', question: 'Faut-il interdire les réseaux sociaux aux moins de 15 ans ?',
    answers: [
      { id: 'interdire', label: 'Oui, avec une vérification d’âge obligatoire', lean: 0, effects: [seg('retraites', 2), seg('cadres', 1), seg('jeunes', -2)] },
      { id: 'europe', label: 'Oui, mais à l’échelle européenne pour que ce soit applicable', lean: 0, effects: [cred(1), seg('jeunes', -1)] },
      { id: 'parents', label: 'Non, c’est aux parents d’encadrer', lean: 1, effects: [seg('jeunes', 1), seg('retraites', -1)] },
      { id: 'plateformes', label: 'Non, il faut plutôt contraindre les plateformes', lean: -1, effects: [seg('jeunes', 1), seg('cadres', -1)] },
    ],
  },
  {
    id: 'anonymat', label: 'L’anonymat en ligne', question: 'Faut-il mettre fin à l’anonymat sur les réseaux sociaux ?',
    answers: [
      { id: 'identite', label: 'Oui, chaque compte lié à une identité vérifiée', lean: 1, effects: [seg('retraites', 2), seg('jeunes', -2)] },
      { id: 'tiers', label: 'Identité vérifiée par un tiers, pseudonyme public', lean: 0, effects: [seg('cadres', 1), seg('jeunes', -1)] },
      { id: 'justice', label: 'Non, mais obliger les plateformes à répondre vite à la justice', lean: 0, effects: [cred(1), seg('retraites', -1), dos('numerique', 1)] },
      { id: 'non', label: 'Non, l’anonymat protège lanceurs d’alerte et victimes', lean: -1, effects: [seg('jeunes', 2), seg('retraites', -1)] },
    ],
  },
  {
    id: 'ia', label: 'L’intelligence artificielle', question: 'Faut-il encadrer plus strictement l’intelligence artificielle ?',
    answers: [
      { id: 'pause', label: 'Oui, une pause sur les modèles les plus puissants', lean: -1, effects: [seg('retraites', 1), seg('cadres', -2)] },
      { id: 'emploi', label: 'Oui, en protégeant d’abord l’emploi et les droits d’auteur', lean: -1, effects: [seg('populaires', 2), seg('cadres', -1)] },
      { id: 'europe', label: 'Le règlement européen suffit, appliquons-le', lean: 0, effects: [cred(1), seg('jeunes', -1)] },
      { id: 'innover', label: 'Non, trop de règles et l’Europe sera distancée', lean: 2, effects: [seg('cadres', 2), seg('jeunes', 1), seg('populaires', -2)] },
    ],
  },

  /* ── Société ──────────────────────────────────────────── */
  {
    id: 'fin_de_vie', label: 'La fin de vie', question: 'Faut-il légaliser l’aide active à mourir ?',
    answers: [
      { id: 'large', label: 'Oui, avec des conditions larges, comme en Belgique', lean: -1, effects: [seg('cadres', 2), seg('retraites', -1)] },
      { id: 'encadree', label: 'Oui, très encadrée, pour les malades incurables', lean: 0, effects: [seg('retraites', 1), seg('cadres', -1)] },
      { id: 'palliatifs', label: 'Non, développer d’abord les soins palliatifs partout', lean: 1, effects: [dos('sante', 1), seg('cadres', -1)] },
      { id: 'referendum', label: 'C’est aux Français de trancher par référendum', lean: 0, effects: [seg('populaires', 1), cred(-1)] },
    ],
  },
  {
    id: 'cannabis', label: 'Le cannabis récréatif', question: 'Faut-il légaliser le cannabis récréatif ?',
    answers: [
      { id: 'legaliser', label: 'Oui, avec une vente encadrée par l’État', lean: -2, effects: [seg('jeunes', 3), seg('retraites', -2)] },
      { id: 'depenaliser', label: 'Le dépénaliser, sans organiser la vente', lean: -1, effects: [seg('jeunes', 1), seg('retraites', -1)] },
      { id: 'experimenter', label: 'L’expérimenter dans quelques villes volontaires', lean: 0, effects: [seg('cadres', 1), seg('retraites', -1)] },
      { id: 'non', label: 'Non, et renforcer la lutte contre le trafic', lean: 2, effects: [seg('retraites', 2), seg('jeunes', -2)] },
    ],
  },
  {
    id: 'chasse', label: 'La chasse le dimanche', question: 'Faut-il interdire la chasse le dimanche ?',
    answers: [
      { id: 'dimanche', label: 'Oui, pour partager la nature avec les promeneurs', lean: 0, effects: [seg('jeunes', 2), seg('ruraux', -3)] },
      { id: 'mercredi', label: 'Plutôt une journée sans chasse en semaine', lean: 0, effects: [seg('jeunes', 1), seg('ruraux', -1)] },
      { id: 'securite', label: 'Non, mais renforcer la formation et la sécurité', lean: 0, effects: [seg('ruraux', 1), seg('jeunes', -1)] },
      { id: 'non', label: 'Non, la chasse fait partie de la vie des campagnes', lean: 0, effects: [seg('ruraux', 3), seg('jeunes', -2)] },
    ],
  },
  {
    id: 'corrida', label: 'La corrida', question: 'Faut-il interdire la corrida ?',
    answers: [
      { id: 'interdire', label: 'Oui, partout en France, sans exception', lean: 0, effects: [seg('jeunes', 2), seg('ruraux', -2)] },
      { id: 'mineurs', label: 'Interdire au moins l’accès des mineurs aux arènes', lean: 0, effects: [seg('jeunes', 1), seg('ruraux', -1)] },
      { id: 'tradition', label: 'Non, là où existe une tradition locale ininterrompue', lean: 0, effects: [seg('ruraux', 1), seg('retraites', 1), seg('jeunes', -1)] },
      { id: 'local', label: 'C’est aux territoires concernés de décider', lean: 0, effects: [seg('ruraux', 1), cred(-1)] },
    ],
  },

  /* ── Europe et monde ──────────────────────────────────── */
  {
    id: 'defense_europeenne', label: 'La défense européenne', question: 'Faut-il bâtir une défense européenne commune ?', minOrder: 2,
    answers: [
      { id: 'armee', label: 'Oui, jusqu’à une armée européenne intégrée', lean: 0, effects: [seg('cadres', 2), seg('ruraux', -1), seg('retraites', -1)] },
      { id: 'industrie', label: 'Une industrie de défense commune, des armées nationales', lean: 0, effects: [seg('cadres', 1), seg('populaires', -1), dos('diplomatie', 1)] },
      { id: 'otan', label: 'Non, l’OTAN suffit à garantir notre sécurité', lean: 0, effects: [seg('retraites', 1), seg('jeunes', -1)] },
      { id: 'nationale', label: 'Non, la défense doit rester strictement nationale', lean: 0, effects: [seg('populaires', 2), seg('ruraux', 1), seg('cadres', -2)] },
    ],
  },
  {
    id: 'elargissement', label: 'L’élargissement de l’Union', question: 'Faut-il élargir l’Union européenne à l’Ukraine et aux pays des Balkans ?', minOrder: 2,
    answers: [
      { id: 'vite', label: 'Oui, rapidement : c’est un choix géopolitique', lean: 0, effects: [seg('cadres', 2), seg('ruraux', -2)] },
      { id: 'criteres', label: 'Oui, quand tous les critères d’adhésion seront remplis', lean: 0, effects: [cred(1), seg('ruraux', -1)] },
      { id: 'reformer', label: 'Pas avant d’avoir réformé le fonctionnement de l’UE', lean: 0, effects: [seg('retraites', 1), seg('jeunes', -1)] },
      { id: 'referendum', label: 'Seulement après un référendum en France', lean: 0, effects: [seg('populaires', 2), seg('ruraux', 1), seg('cadres', -2)] },
    ],
  },
  {
    id: 'aide_developpement', label: 'L’aide au développement', question: 'Faut-il augmenter l’aide publique au développement ?', minOrder: 2,
    answers: [
      { id: 'augmenter', label: 'Oui, atteindre 0,7 % du revenu national', lean: -2, effects: [seg('jeunes', 2), seg('populaires', -2)] },
      { id: 'cibler', label: 'La maintenir, mais mieux cibler et évaluer son usage', lean: 0, effects: [cred(1), seg('jeunes', -1)] },
      { id: 'conditionner', label: 'La conditionner à des engagements des pays partenaires', lean: 1, effects: [seg('retraites', 1), seg('jeunes', -1), dos('diplomatie', 1)] },
      { id: 'reduire', label: 'La réduire pour financer les priorités nationales', lean: 2, effects: [seg('populaires', 2), seg('retraites', 1), seg('jeunes', -2)] },
    ],
  },

  /* ── Territoires et transports ────────────────────────── */
  {
    id: 'services_ruraux', label: 'Les services publics ruraux', question: 'Faut-il interdire la fermeture des services publics (écoles, postes, maternités) à la campagne ?',
    answers: [
      { id: 'moratoire', label: 'Oui, un moratoire sur toute fermeture', lean: -2, effects: [seg('ruraux', 3), seg('cadres', -2)] },
      { id: 'trente_minutes', label: 'Oui, garantir un service public à moins de 30 minutes', lean: -1, effects: [seg('ruraux', 2), seg('cadres', -1), dos('territoires', 1)] },
      { id: 'france_services', label: 'Non, mais multiplier les maisons France Services', lean: 1, effects: [seg('cadres', 1), seg('ruraux', -1)] },
      { id: 'regrouper', label: 'Non, regrouper les services pour les rendre plus efficaces', lean: 2, effects: [seg('cadres', 2), seg('ruraux', -3)] },
    ],
  },
  {
    id: 'vitesse_80', label: 'La vitesse sur route', question: 'La limitation à 80 km/h sur les routes secondaires, vous êtes pour ?',
    answers: [
      { id: 'partout', label: 'Pour, et la rétablir sur toutes les routes concernées', lean: 0, effects: [seg('retraites', 1), seg('ruraux', -2)] },
      { id: 'departements', label: 'Laisser chaque département décider, comme aujourd’hui', lean: 0, effects: [seg('ruraux', 1), seg('cadres', -1)] },
      { id: 'routes', label: 'L’urgence, c’est de rénover les routes dangereuses', lean: 0, effects: [seg('ruraux', 1), cred(-1)] },
      { id: 'contre', label: 'Contre : revenir à 90 km/h partout', lean: 0, effects: [seg('ruraux', 3), seg('retraites', -1)] },
    ],
  },
  {
    id: 'lgv', label: 'Les lignes à grande vitesse', question: 'Faut-il construire de nouvelles lignes à grande vitesse (LGV) ?', minOrder: 2,
    answers: [
      { id: 'oui', label: 'Oui, relier toutes les grandes villes en TGV', lean: 1, effects: [seg('cadres', 2), seg('ruraux', -2), dos('territoires', 1)] },
      { id: 'cofinancement', label: 'Oui, avec un cofinancement européen et régional', lean: 0, effects: [cred(1), seg('ruraux', -1)] },
      { id: 'les_deux', label: 'LGV et petites lignes à la fois, quitte à s’endetter', lean: 0, effects: [seg('ruraux', 1), seg('jeunes', 1), cred(-1)] },
      { id: 'quotidien', label: 'Non, priorité aux petites lignes et aux trains du quotidien', lean: -1, effects: [seg('ruraux', 2), seg('jeunes', 1), seg('cadres', -1)] },
    ],
  },
];

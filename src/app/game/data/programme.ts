import { ProgramQuestion, Segment } from '../models/game.models';

/* ============================================================
 *  Programme présidentiel : 20 questions, 4 choix chacune.
 *  Les options vont en général de la gauche vers la droite.
 *  cost : estimation de campagne en Md€/an (négatif = recettes
 *  ou économies). appeal : réaction des électorats (-3 … +3).
 * ============================================================ */

export const SEGMENTS: { id: Segment; label: string; weight: number }[] = [
  { id: 'jeunes', label: 'Jeunes', weight: 0.18 },
  { id: 'retraites', label: 'Retraités', weight: 0.26 },
  { id: 'populaires', label: 'Classes populaires', weight: 0.24 },
  { id: 'cadres', label: 'Cadres et indépendants', weight: 0.2 },
  { id: 'ruraux', label: 'Monde rural', weight: 0.12 },
];

export const PROGRAM: ProgramQuestion[] = [
  // ── Économie ──────────────────────────────────────────────
  {
    id: 'q1', domain: 'economie', theme: 'Fiscalité', question: 'Comment faire contribuer les plus hauts revenus ?',
    options: [
      { id: 'a', label: 'Rétablir un impôt sur la fortune élargi et taxer les superprofits', position: -70, cost: -20, appeal: { populaires: 2, jeunes: 1, cadres: -3 } },
      { id: 'b', label: 'Créer une tranche d’impôt sur le revenu au-delà de 250 000 €', position: -30, cost: -4, appeal: { populaires: 1, cadres: -1 } },
      { id: 'c', label: 'Stabilité fiscale : aucun nouvel impôt pendant le mandat', position: 20, cost: 0, appeal: { cadres: 1, retraites: 1 } },
      { id: 'd', label: 'Baisser l’impôt sur le revenu des classes moyennes et supérieures', position: 60, cost: 18, appeal: { cadres: 3, populaires: -1 } },
    ],
  },
  {
    id: 'q2', domain: 'economie', theme: 'Dette publique', question: 'Quelle trajectoire pour les finances publiques ?',
    options: [
      { id: 'a', label: 'Relance massive par l’investissement public, la dette attendra', position: -60, cost: 15, appeal: { jeunes: 1, populaires: 1, retraites: -1 } },
      { id: 'b', label: 'Stabiliser la dette en dix ans, sans austérité', position: -15, cost: 4, appeal: {} },
      { id: 'c', label: 'Ramener le déficit sous 3 % du PIB en cinq ans', position: 30, cost: -15, appeal: { cadres: 1, retraites: 1, populaires: -1 } },
      { id: 'd', label: 'Règle d’or : budget à l’équilibre en fin de mandat', position: 70, cost: -22, appeal: { cadres: 2, populaires: -2, retraites: -1 } },
    ],
  },
  {
    id: 'q3', domain: 'economie', theme: 'Temps de travail', question: 'Faut-il toucher à la durée du travail ?',
    options: [
      { id: 'a', label: 'Passer à la semaine de 32 heures', position: -75, cost: 10, appeal: { jeunes: 2, cadres: -2 } },
      { id: 'b', label: 'Garder les 35 heures et renforcer le dialogue social', position: -20, cost: 0, appeal: { populaires: 1 } },
      { id: 'c', label: 'Défiscaliser totalement les heures supplémentaires', position: 30, cost: 6, appeal: { populaires: 2, cadres: 1 } },
      { id: 'd', label: 'Supprimer la durée légale, négociation entreprise par entreprise', position: 70, cost: 0, appeal: { cadres: 2, populaires: -2, jeunes: -1 } },
    ],
  },
  {
    id: 'q4', domain: 'economie', theme: 'Industrie', question: 'Comment réindustrialiser le pays ?',
    options: [
      { id: 'a', label: 'Nationaliser les secteurs stratégiques : énergie, autoroutes', position: -75, cost: 15, appeal: { populaires: 2, cadres: -2 } },
      { id: 'b', label: 'Créer un fonds public d’investissement industriel', position: -25, cost: 8, appeal: { ruraux: 1, populaires: 1 } },
      { id: 'c', label: 'Crédit d’impôt pour les entreprises qui relocalisent', position: 20, cost: 6, appeal: { ruraux: 2, cadres: 1 } },
      { id: 'd', label: 'Supprimer les impôts de production', position: 65, cost: 22, appeal: { cadres: 2 } },
    ],
  },

  // ── Écologie ──────────────────────────────────────────────
  {
    id: 'q5', domain: 'ecologie', theme: 'Énergie', question: 'Quel mix énergétique pour 2050 ?',
    options: [
      { id: 'a', label: 'Sortie progressive du nucléaire, 100 % renouvelables', position: -65, cost: 18, appeal: { jeunes: 2, retraites: -1, ruraux: -1 } },
      { id: 'b', label: 'Mix équilibré entre nucléaire et renouvelables', position: -10, cost: 12, appeal: { cadres: 1 } },
      { id: 'c', label: 'Construire six nouveaux réacteurs nucléaires', position: 30, cost: 15, appeal: { retraites: 1, cadres: 1 } },
      { id: 'd', label: 'Tout miser sur le nucléaire, moratoire sur l’éolien', position: 65, cost: 16, appeal: { ruraux: 2, retraites: 1, jeunes: -1 } },
    ],
  },
  {
    id: 'q6', domain: 'ecologie', theme: 'Mobilités', question: 'Que faire pour les déplacements du quotidien ?',
    options: [
      { id: 'a', label: 'Transports en commun gratuits dans les grandes villes', position: -60, cost: 9, appeal: { jeunes: 3, ruraux: -2 } },
      { id: 'b', label: 'Leasing social pour une voiture électrique à 100 €/mois', position: -20, cost: 3, appeal: { populaires: 1, ruraux: 1 } },
      { id: 'c', label: 'Baisser les taxes sur les carburants', position: 40, cost: 10, appeal: { ruraux: 3, populaires: 2, jeunes: -1 } },
      { id: 'd', label: 'Supprimer les zones à faibles émissions', position: 65, cost: 0, appeal: { ruraux: 2, populaires: 1, jeunes: -2 } },
    ],
  },
  {
    id: 'q7', domain: 'ecologie', theme: 'Agriculture', question: 'Quel avenir pour l’agriculture ?',
    options: [
      { id: 'a', label: 'Sortir des pesticides de synthèse en dix ans', position: -65, cost: 4, appeal: { jeunes: 2, ruraux: -2 } },
      { id: 'b', label: 'Garantir des prix plancher aux agriculteurs', position: -30, cost: 3, appeal: { ruraux: 3, populaires: 1 } },
      { id: 'c', label: 'Simplifier les normes agricoles', position: 35, cost: 0, appeal: { ruraux: 2, jeunes: -1 } },
      { id: 'd', label: 'Moratoire sur toute nouvelle norme environnementale', position: 70, cost: 0, appeal: { ruraux: 2, jeunes: -2 } },
    ],
  },
  {
    id: 'q8', domain: 'ecologie', theme: 'Climat', question: 'Comment financer la transition climatique ?',
    options: [
      { id: 'a', label: 'Taxe carbone aux frontières et impôt climatique sur les grandes fortunes', position: -60, cost: -14, appeal: { jeunes: 2, cadres: -2 } },
      { id: 'b', label: 'Taxe carbone intégralement reversée en chèque énergie', position: -20, cost: 0, appeal: { jeunes: 1 } },
      { id: 'c', label: 'Aides à la rénovation, sans nouvelle taxe', position: 25, cost: 6, appeal: { retraites: 1, cadres: 1 } },
      { id: 'd', label: 'Mettre en pause les objectifs climatiques le temps de la crise', position: 70, cost: -2, appeal: { ruraux: 1, jeunes: -3 } },
    ],
  },

  // ── Sécurité ──────────────────────────────────────────────
  {
    id: 'q9', domain: 'securite', theme: 'Police', question: 'Quelle priorité pour les forces de l’ordre ?',
    options: [
      { id: 'a', label: 'Police de proximité, priorité à la prévention', position: -55, cost: 3, appeal: { jeunes: 1 } },
      { id: 'b', label: 'Recruter 10 000 policiers et gendarmes', position: 10, cost: 5, appeal: { retraites: 2, populaires: 1, ruraux: 1 } },
      { id: 'c', label: 'Peines planchers pour les récidivistes', position: 50, cost: 1, appeal: { retraites: 2 } },
      { id: 'd', label: 'Présomption de légitime défense pour les forces de l’ordre', position: 75, cost: 0, appeal: { retraites: 1, jeunes: -2 } },
    ],
  },
  {
    id: 'q10', domain: 'securite', theme: 'Justice', question: 'Comment rendre la justice plus efficace ?',
    options: [
      { id: 'a', label: 'Développer les peines alternatives à la prison', position: -60, cost: -1, appeal: { jeunes: 1, retraites: -1 } },
      { id: 'b', label: 'Recruter 3 000 magistrats pour accélérer les jugements', position: -10, cost: 2, appeal: { cadres: 1 } },
      { id: 'c', label: 'Construire 15 000 places de prison', position: 40, cost: 4, appeal: { retraites: 2 } },
      { id: 'd', label: 'Abaisser la majorité pénale à 16 ans', position: 75, cost: 1, appeal: { retraites: 1, jeunes: -2 } },
    ],
  },
  {
    id: 'q11', domain: 'securite', theme: 'Immigration', question: 'Quelle politique migratoire ?',
    options: [
      { id: 'a', label: 'Régulariser les travailleurs sans papiers', position: -65, cost: -1, appeal: { jeunes: 1, retraites: -2 } },
      { id: 'b', label: 'Miser sur l’intégration : langue, emploi, logement', position: -20, cost: 2, appeal: { cadres: 1 } },
      { id: 'c', label: 'Durcir les conditions du regroupement familial', position: 45, cost: 0, appeal: { retraites: 2, populaires: 1, jeunes: -1 } },
      { id: 'd', label: 'Référendum sur l’immigration et quotas annuels', position: 75, cost: 0, appeal: { retraites: 2, populaires: 1, jeunes: -2, cadres: -1 } },
    ],
  },
  {
    id: 'q12', domain: 'securite', theme: 'Libertés', question: 'Où placer le curseur entre sécurité et libertés ?',
    options: [
      { id: 'a', label: 'Interdire la reconnaissance faciale dans l’espace public', position: -55, cost: 0, appeal: { jeunes: 2 } },
      { id: 'b', label: 'Encadrer strictement la vidéosurveillance algorithmique', position: -10, cost: 0, appeal: { cadres: 1 } },
      { id: 'c', label: 'Généraliser la vidéosurveillance dans les transports', position: 35, cost: 1, appeal: { retraites: 2 } },
      { id: 'd', label: 'Mettre fin à l’anonymat en ligne', position: 60, cost: 0, appeal: { retraites: 1, jeunes: -2 } },
    ],
  },

  // ── Social ────────────────────────────────────────────────
  {
    id: 'q13', domain: 'social', theme: 'Retraites', question: 'À quel âge partir à la retraite ?',
    options: [
      { id: 'a', label: 'Retour à la retraite à 60 ans', position: -75, cost: 20, appeal: { populaires: 3, retraites: 1, cadres: -1, jeunes: -1 } },
      { id: 'b', label: 'Retraite à 62 ans et meilleure prise en compte de la pénibilité', position: -30, cost: 12, appeal: { populaires: 2 } },
      { id: 'c', label: 'Garder l’âge actuel et indexer toutes les pensions', position: 10, cost: 4, appeal: { retraites: 2 } },
      { id: 'd', label: 'Retraite à 65 ans et une part de capitalisation', position: 65, cost: -10, appeal: { cadres: 1, populaires: -2, retraites: -1 } },
    ],
  },
  {
    id: 'q14', domain: 'social', theme: 'Salaires', question: 'Comment augmenter le pouvoir d’achat ?',
    options: [
      { id: 'a', label: 'SMIC à 1 600 € net', position: -70, cost: 6, appeal: { populaires: 3, cadres: -1 } },
      { id: 'b', label: 'Indexer les salaires sur l’inflation', position: -35, cost: 3, appeal: { populaires: 2, cadres: 1 } },
      { id: 'c', label: 'Une prime défiscalisée versée par les entreprises', position: 25, cost: 2, appeal: { cadres: 1, populaires: 1 } },
      { id: 'd', label: 'Baisser les cotisations salariales : +100 € net par mois', position: 55, cost: 16, appeal: { populaires: 1, cadres: 2 } },
    ],
  },
  {
    id: 'q15', domain: 'social', theme: 'Santé', question: 'Comment lutter contre les déserts médicaux ?',
    options: [
      { id: 'a', label: 'Supprimer les dépassements d’honoraires, ouvrir des centres de santé publics', position: -60, cost: 8, appeal: { populaires: 2, ruraux: 1 } },
      { id: 'b', label: 'Obliger les jeunes médecins à exercer dans les déserts médicaux', position: -20, cost: 1, appeal: { ruraux: 3, retraites: 1, jeunes: -1 } },
      { id: 'c', label: 'Primes à l’installation en zone rurale', position: 20, cost: 3, appeal: { ruraux: 2 } },
      { id: 'd', label: 'Ouvrir davantage la santé au privé pour réduire l’attente', position: 65, cost: 0, appeal: { cadres: 2, populaires: -2 } },
    ],
  },
  {
    id: 'q16', domain: 'social', theme: 'Logement', question: 'Comment loger tout le monde ?',
    options: [
      { id: 'a', label: 'Encadrer les loyers partout', position: -60, cost: 0, appeal: { jeunes: 3, cadres: -1 } },
      { id: 'b', label: 'Construire 150 000 logements sociaux par an', position: -30, cost: 6, appeal: { jeunes: 2, populaires: 2 } },
      { id: 'c', label: 'Élargir le prêt à taux zéro pour devenir propriétaire', position: 30, cost: 3, appeal: { cadres: 2, jeunes: 1 } },
      { id: 'd', label: 'Supprimer des normes pour construire plus vite', position: 60, cost: 0, appeal: { cadres: 1 } },
    ],
  },

  // ── Diplomatie ────────────────────────────────────────────
  {
    id: 'q17', domain: 'diplomatie', theme: 'Europe', question: 'Quelle place pour la France en Europe ?',
    options: [
      { id: 'a', label: 'Désobéir aux règles européennes qui bloquent la politique sociale', position: -70, cost: 0, appeal: { populaires: 1, cadres: -2 } },
      { id: 'b', label: 'Une Europe sociale avec un salaire minimum européen', position: -25, cost: 0, appeal: { jeunes: 1, populaires: 1 } },
      { id: 'c', label: 'Plus d’intégration : défense et budget communs', position: 15, cost: 3, appeal: { cadres: 2, jeunes: 1, ruraux: -1 } },
      { id: 'd', label: 'Europe des nations : primauté du droit national', position: 70, cost: 0, appeal: { retraites: 1, ruraux: 1, cadres: -1 } },
    ],
  },
  {
    id: 'q18', domain: 'diplomatie', theme: 'Défense', question: 'Quel effort pour la défense ?',
    options: [
      { id: 'a', label: 'Réduire le budget militaire au profit de la diplomatie', position: -60, cost: -8, appeal: { jeunes: 1, retraites: -1 } },
      { id: 'b', label: 'Maintenir l’effort actuel', position: -10, cost: 0, appeal: {} },
      { id: 'c', label: 'Porter le budget de la défense à 3 % du PIB', position: 40, cost: 15, appeal: { retraites: 1 } },
      { id: 'd', label: 'Rétablir un service militaire obligatoire', position: 65, cost: 6, appeal: { retraites: 2, jeunes: -3 } },
    ],
  },
  {
    id: 'q19', domain: 'diplomatie', theme: 'Commerce', question: 'Faut-il continuer à signer des accords de libre-échange ?',
    options: [
      { id: 'a', label: 'Sortir des accords de libre-échange existants', position: -60, cost: 0, appeal: { ruraux: 2, populaires: 1, cadres: -2 } },
      { id: 'b', label: 'Clauses sociales et environnementales obligatoires', position: -20, cost: 0, appeal: { ruraux: 1, jeunes: 1 } },
      { id: 'c', label: 'Soutenir les accords, avec des contrôles renforcés', position: 30, cost: 0, appeal: { cadres: 2, ruraux: -1 } },
      { id: 'd', label: 'Assumer le libre-échange et baisser les droits de douane', position: 50, cost: -1, appeal: { cadres: 2, ruraux: -2 } },
    ],
  },
  {
    id: 'q20', domain: 'diplomatie', theme: 'Aide internationale', question: 'Quelle politique d’aide au développement ?',
    options: [
      { id: 'a', label: 'Doubler l’aide au développement', position: -60, cost: 5, appeal: { jeunes: 1, retraites: -1 } },
      { id: 'b', label: 'Conditionner l’aide à la coopération climatique', position: -15, cost: 0, appeal: { jeunes: 1 } },
      { id: 'c', label: 'Conditionner l’aide à la coopération migratoire', position: 45, cost: -2, appeal: { retraites: 1 } },
      { id: 'd', label: 'Réduire de moitié l’aide au développement', position: 70, cost: -3, appeal: { retraites: 1, jeunes: -1 } },
    ],
  },
];

export const PROGRAM_BY_ID = new Map(PROGRAM.map(q => [q.id, q]));

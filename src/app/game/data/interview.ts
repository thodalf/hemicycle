/* ============================================================
 *  Interview piège : chaque question appelle une bonne posture.
 *  Répondre sur le fond, esquiver avec élégance, ou contre-attaquer.
 * ============================================================ */

export type InterviewMove = 'repondre' | 'esquiver' | 'contre';

export interface InterviewQuestion { q: string; best: InterviewMove; ok?: InterviewMove; why: string }

export const INTERVIEW_MOVES: { id: InterviewMove; label: string; icon: string }[] = [
  { id: 'repondre', label: 'Répondre sur le fond', icon: '📊' },
  { id: 'esquiver', label: 'Esquiver avec élégance', icon: '🌀' },
  { id: 'contre', label: 'Contre-attaquer', icon: '⚡' },
];

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  { q: 'Combien coûte un ticket de métro à Paris ?', best: 'repondre', why: 'Une question de prix : il faut connaître la réponse, ou passer pour hors-sol.' },
  { q: 'Serez-vous candidat·e à la présidentielle ?', best: 'esquiver', why: 'Il est trop tôt : on ne s’annonce pas au détour d’une interview.' },
  { q: 'Votre adversaire dit que vous êtes « une girouette ». Que répondez-vous ?', best: 'contre', ok: 'repondre', why: 'Une attaque personnelle appelle une riposte nette.' },
  { q: 'Quel est le montant de la dette publique ?', best: 'repondre', why: 'Un chiffre que tout responsable doit connaître.' },
  { q: 'Avez-vous déjà fumé du cannabis ?', best: 'esquiver', ok: 'repondre', why: 'Vie privée : une pirouette vaut mieux qu’une confession.' },
  { q: 'Votre parti est-il en train d’imploser ?', best: 'contre', ok: 'esquiver', why: 'On ne valide pas le récit de l’adversaire : on le retourne.' },
  { q: 'Votre mesure phare coûte combien, exactement ?', best: 'repondre', why: 'Un engagement non chiffré est un engagement mort.' },
  { q: 'On dit que vous déjeunez souvent avec des lobbyistes…', best: 'repondre', ok: 'contre', why: 'Transparence : expliquer vaut mieux que se cabrer.' },
  { q: 'Votre ancien collaborateur vous accuse de harcèlement moral. Un commentaire ?', best: 'repondre', why: 'Un sujet grave : on répond sérieusement, sans esquive.' },
  { q: 'Qui est le meilleur président de la Ve République ?', best: 'esquiver', why: 'Un piège à polémique : une réponse générale suffit.' },
  { q: 'Vous avez voté contre ce texte il y a deux ans. Pourquoi changer ?', best: 'repondre', ok: 'esquiver', why: 'Assumer et expliquer l’évolution désamorce l’accusation de volte-face.' },
  { q: 'Le gouvernement est-il incompétent ?', best: 'contre', ok: 'repondre', why: 'Une question taillée pour l’opposition : on frappe.' },
  { q: 'Que pensez-vous de la dernière sortie de votre propre chef de parti ?', best: 'esquiver', why: 'On ne critique pas son camp en direct.' },
  { q: 'Combien de logements sociaux ont été construits l’an dernier ?', best: 'repondre', why: 'Le chiffre précis vous donne une crédibilité immédiate.' },
  { q: 'Votre patrimoine a doublé en cinq ans. Comment l’expliquez-vous ?', best: 'repondre', ok: 'contre', why: 'Sur l’argent, la clarté est la seule défense.' },
  { q: 'Vous êtes trop jeune pour ces responsabilités, non ?', best: 'contre', why: 'Une remarque condescendante : renvoyez-la avec humour.' },
  { q: 'Allez-vous démissionner si le texte est rejeté ?', best: 'esquiver', why: 'On ne promet pas sa tête sur un plateau.' },
  { q: 'Pourquoi votre adversaire progresse-t-il dans les sondages ?', best: 'contre', ok: 'esquiver', why: 'On ne commente pas la force de l’autre : on rappelle ses faiblesses.' },
];

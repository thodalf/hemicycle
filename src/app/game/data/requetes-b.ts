import type { GameState } from '../models/game.models';
import type { ReqCard } from './requetes-types';
import { mem, rankAtLeast, st } from './requetes-types';

/* Les cartes des requêtes (voir requetes-types.ts)
 * Lot B : le pouvoir national — ministres, Matignon, la tête du parti,
 * la campagne présidentielle, l'Élysée.
 *
 * Personnages récurrents :
 *  - Aurélien Marchetti, votre directeur de cabinet 🧑‍💼
 *  - Clémence Vasseur-Delorme, ministre ambitieuse 👩‍💼
 *  - Henri-Paul Lambert-Sauvage, PDG de Lambert Industries 🤵
 *  - Sylvie Carrasco, syndicaliste ✊
 *  - Gonzague de Tracy, éditorialiste vedette 🎙️
 *  - Raymond Achard, votre ancien mentor (tutoiement) 👴
 *  - Séraphin Lunel, astrologue 🔮
 *  - Bertrand Duplessis, majordome de la résidence officielle 🎩
 */

/** Au cœur du pouvoir national (ministre et au-delà, hors retraite) */
const national = (d: GameState) => rankAtLeast(d, 3) && d.player.rankId !== 'ancien_president';
/** Une résidence officielle avec majordome : Matignon ou l'Élysée */
const resident = (d: GameState) => rankAtLeast(d, 3) && (d.player.rankId === 'premier_ministre' || d.player.rankId === 'president');
/** Président·e en exercice (effets `presidency` autorisés) */
const presid = (d: GameState) => rankAtLeast(d, 6) && d.player.rankId === 'president' && !!d.presidency;
/** Membre du gouvernement (effets `government` autorisés) */
const gouv = (d: GameState) => rankAtLeast(d, 3) && (d.player.rankId === 'ministre' || d.player.rankId === 'premier_ministre') && !!d.government;

const CAB = { name: 'Aurélien Marchetti', role: 'Votre directeur de cabinet', icon: '🧑‍💼' };
const CLEM = { name: 'Clémence Vasseur-Delorme', role: 'Ministre déléguée au Numérique', icon: '👩‍💼' };
const LAMB = { name: 'Henri-Paul Lambert-Sauvage', role: 'PDG de Lambert Industries', icon: '🤵' };
const SYND = { name: 'Sylvie Carrasco', role: 'Secrétaire générale de l’Union des travailleurs', icon: '✊' };
const EDITO = { name: 'Gonzague de Tracy', role: 'Éditorialiste vedette de la matinale', icon: '🎙️' };
const MENTOR = { name: 'Raymond Achard', role: 'Votre ancien mentor, sénateur honoraire', icon: '👴' };
const ASTRO = { name: 'Séraphin Lunel', role: 'Astrologue, vous écrit à chaque lune', icon: '🔮' };
const MAJ = { name: 'Bertrand Duplessis', role: 'Majordome de la résidence officielle', icon: '🎩' };

export const CARDS_B: ReqCard[] = [
  /* ============ Chaîne 1 : le jet privé ============ */
  {
    id: 'rb_jet_prive', ...LAMB,
    text: 'Mon jet part pour Marseille demain matin, il reste onze sièges vides. Montez donc : c’est plus rapide que le train, et tellement plus discret.',
    eligible: national,
    left: { label: 'Je prendrai le train', pillars: { peuple: 8, puissants: -8 }, outcome: 'Quatre heures de train, deux selfies avec des contrôleurs, et un PDG vexé.' },
    right: { label: 'Volontiers, merci', pillars: { puissants: 10, peuple: -6 }, effects: [st('energy', 2)], remember: { rb_jet: 1 }, next: { card: 'rb_jet_tracy', months: 2 }, outcome: 'Champagne à 10 000 mètres. Un photographe traînait sur le tarmac.' },
  },
  {
    id: 'rb_jet_tracy', ...EDITO, chainOnly: true,
    text: 'Un vol privé Paris-Marseille avec le patron de Lambert Industries, et une jolie photo sur le tarmac. Ma chronique part demain à 8 h 20. Une déclaration ?',
    eligible: national,
    left: { label: 'J’assume : c’était du travail', pillars: { medias: -8, puissants: 5 }, effects: [{ kind: 'exposure', delta: 2 }], outcome: '« Du travail », titre-t-il, guillemets compris.' },
    right: { label: 'Je rembourse le billet', pillars: { medias: 8, puissants: -8, peuple: 4 }, remember: { rb_jet_rembourse: 1 }, next: { card: 'rb_jet_lambert', months: 3 }, outcome: 'Chèque photographié, polémique éteinte. Le PDG, lui, ne décolère pas.' },
  },
  {
    id: 'rb_jet_lambert', ...LAMB, chainOnly: true,
    text: 'Rembourser mon hospitalité par chèque, devant les caméras… On ne m’avait jamais fait cet affront. Mon conseil d’administration envisage de déménager notre siège à l’étranger.',
    eligible: national,
    left: { label: 'Bon vent', pillars: { peuple: 10, puissants: -12 }, effects: [{ kind: 'economy', confidence: -1 }], outcome: 'Le siège part. Trois cents emplois de bureau, et une ovation au marché.' },
    right: { label: 'Déjeuner de réconciliation', pillars: { puissants: 10, medias: -6 }, outcome: 'Sole meunière et paix armée. Le siège reste, la rancune aussi.' },
  },

  /* ============ Chaîne 2 : la ministre ambitieuse ============ */
  {
    id: 'rb_clemence_1', ...CLEM,
    text: 'Ministre déléguée au Numérique, c’est un placard avec le wifi. Au prochain remaniement, je veux l’Intérieur. Il me faut votre soutien, publiquement.',
    eligible: national,
    left: { label: 'Hors de question', pillars: { parti: -8, medias: 4 }, remember: { rb_clem: 1 }, next: { card: 'rb_clemence_2a', months: 3 }, outcome: 'Elle sourit poliment. C’est le sourire le plus inquiétant de la semaine.' },
    right: { label: 'Vous aurez mon soutien', pillars: { parti: 8, peuple: -4 }, remember: { rb_clem: 2 }, next: { card: 'rb_clemence_2b', months: 3 }, outcome: 'Elle vous serre la main un peu trop longtemps.' },
  },
  {
    id: 'rb_clemence_2a', ...CLEM, chainOnly: true,
    text: 'Vous m’avez refusé votre soutien, j’ai donc trouvé d’autres amis : quarante parlementaires signent ma tribune demain. Je vous laisse une dernière chance de la co-signer.',
    eligible: national,
    left: { label: 'Je ne signe rien', pillars: { parti: -10, medias: 6 }, effects: [{ kind: 'cohesion', delta: -2 }], next: { card: 'rb_clemence_3', months: 5 }, outcome: 'La tribune paraît sans vous, et contre vous.' },
    right: { label: 'Je co-signe', pillars: { parti: 8, peuple: -6 }, remember: { rb_clem_signe: 1 }, next: { card: 'rb_clemence_3', months: 5 }, outcome: 'Votre nom en quarante et unième position. Elle a tenu à ce détail.' },
  },
  {
    id: 'rb_clemence_2b', ...CLEM, chainOnly: true,
    text: 'Grâce à vous, me voilà place Beauvau. Petit souci : mes premiers chiffres sont mauvais et la presse cherche un coupable. Vous pourriez porter un bout du chapeau ?',
    eligible: national,
    left: { label: 'À chacun ses chiffres', pillars: { parti: -6, medias: 6 }, next: { card: 'rb_clemence_3', months: 5 }, outcome: 'Elle encaisse. Elle note aussi.' },
    right: { label: 'Je porte le chapeau', pillars: { parti: 10, medias: -8, peuple: -4 }, effects: [st('credibility', -2)], remember: { rb_clem_chapeau: 1 }, next: { card: 'rb_clemence_3', months: 5 }, outcome: 'Le chapeau vous va mal, mais elle vous doit une fière chandelle.' },
  },
  {
    id: 'rb_clemence_3', ...CLEM, chainOnly: true,
    text: d => 'Je vous l’annonce avant les journalistes : je serai candidate à la primaire. '
      + (mem(d, 'rb_clem') === 2
        ? (mem(d, 'rb_clem_chapeau') ? 'Vous avez porté le chapeau pour moi, alors je vous offre la vice-présidence du mouvement. ' : 'Vous m’avez faite, alors je vous offre la vice-présidence du mouvement. ')
        : (mem(d, 'rb_clem_signe') ? 'Vous avez fini par signer ma tribune ; je vous propose un pacte de non-agression. ' : 'Vous ne m’avez jamais aidée, mais je vous propose quand même un pacte de non-agression. '))
      + 'Alors ?',
    eligible: national,
    left: { label: 'Je me présente contre vous', pillars: { parti: -8, medias: 10 }, effects: [{ kind: 'momentum', delta: 2 }], outcome: 'Duel annoncé. Les chaînes d’info déroulent déjà le compte à rebours.' },
    right: { label: 'Pacte conclu', pillars: { parti: 10, medias: -6 }, outcome: 'Une poignée de main, un communiqué, et deux ambitions qui s’observent.' },
  },

  /* ============ Chaîne 3 : la syndicaliste et la réforme ============ */
  {
    id: 'rb_syndic_1', ...SYND,
    text: 'Votre réforme du temps partiel passe mardi en conseil des ministres. Décalez-la de six mois et on négocie. Sinon, je remplis les rues le jeudi suivant.',
    eligible: national,
    left: { label: 'Je décale de six mois', pillars: { peuple: 8, puissants: -10 }, remember: { rb_syndic: 1 }, next: { card: 'rb_syndic_2', months: 2 }, outcome: 'Le patronat parle de « reculade ». Elle parle de « début ».' },
    right: { label: 'On maintient le calendrier', pillars: { puissants: 10, peuple: -8 }, remember: { rb_syndic: 2 }, next: { card: 'rb_syndic_2', months: 1 }, outcome: 'Les banderoles s’impriment déjà.' },
  },
  {
    id: 'rb_syndic_2', ...SYND, chainOnly: true,
    text: d => mem(d, 'rb_syndic') === 1
      ? 'Six mois de négociation, c’est bien. Mais il me faut une victoire à montrer à mes adhérents : la prime de transport doublée, et je signe.'
      : 'Huit cent mille dans la rue selon nous, cent quatre-vingt mille selon la police, et les métros à l’arrêt. Vous me recevez enfin, ou on recommence jeudi ?',
    eligible: national,
    left: { label: 'Je fais un geste', pillars: { peuple: 8, puissants: -8 }, effects: [{ kind: 'segment', segment: 'populaires', delta: 3 }], outcome: 'Accord signé à 2 h du matin, avec des croissants rassis.' },
    right: { label: 'Je ne cède rien', pillars: { puissants: 8, peuple: -8 }, next: { card: 'rb_syndic_3', months: 4 }, outcome: 'Elle quitte le bureau sans claquer la porte. C’est presque pire.' },
  },
  {
    id: 'rb_syndic_3', ...SYND, chainOnly: true,
    text: 'Votre fermeté m’a fait un drôle de cadeau : nos adhésions ont doublé. Dernière proposition : un café, sans caméras, juste vous et moi.',
    eligible: national,
    left: { label: 'Sans caméras, alors', pillars: { peuple: 6, medias: -4 }, effects: [st('politicalCapital', 2)], outcome: 'Deux heures de café. Rien n’a fuité, ce qui est un exploit.' },
    right: { label: 'Je n’ai rien à vous dire', pillars: { puissants: 6, peuple: -8, medias: 4 }, outcome: 'Elle le répète au micro, mot pour mot.' },
  },

  /* ============ Chaîne 4 : le mentor au musée ============ */
  {
    id: 'rb_mentor_musee', ...MENTOR, tu: true,
    text: 'Tu te souviens de qui t’a appris à serrer les mains au marché ? Le musée des Arts de la table cherche un directeur. J’ai soixante-dix-huit ans et une passion pour les chaises Louis XV. Nomme-moi.',
    eligible: national,
    left: { label: 'Désolé, pas de copinage', pillars: { parti: -6, medias: 6 }, outcome: 'Il raccroche en marmonnant quelque chose sur l’ingratitude.' },
    right: { label: 'Tu l’as bien mérité', pillars: { parti: 6, medias: -8 }, remember: { rb_mentor_musee: 1 }, next: { card: 'rb_mentor_expo', months: 4 }, outcome: 'Il pleure un peu au téléphone. Les journalistes, eux, sourient.' },
  },
  {
    id: 'rb_mentor_expo', ...MENTOR, role: 'Directeur du musée des Arts de la table', tu: true, chainOnly: true,
    text: 'Ma première exposition ouvre samedi : « Trois siècles de chaises ». Petit souci, le budget a triplé et un hebdomadaire satirique a fait le calcul. Tu viens inaugurer quand même ?',
    eligible: national,
    left: { label: 'Je viendrai, et fièrement', pillars: { parti: 6, medias: -8, peuple: -4 }, outcome: 'Vous vous asseyez sur une chaise à 80 000 €. La photo fait le tour du pays.' },
    right: { label: 'J’envoie un secrétaire d’État', pillars: { medias: 6, parti: -4 }, remember: { rb_mentor_lache: 1 }, next: { card: 'rb_mentor_lettre', months: 3 }, outcome: 'Raymond coupe le ruban seul, très droit, sans un mot.' },
  },
  {
    id: 'rb_mentor_lettre', ...MENTOR, role: 'Votre ancien mentor, en pleine écriture', tu: true, chainOnly: true,
    text: 'Pas venu à mon vernissage. J’ai compris. J’écris mes mémoires, et le chapitre sur toi n’est pas encore terminé. Tu passes dîner jeudi ?',
    eligible: national,
    left: { label: 'J’apporte le vin', pillars: { parti: 6, medias: 4 }, effects: [st('energy', -2), st('stress', -2)], outcome: 'Le chapitre s’intitule finalement « L’élève qui a bien tourné ».' },
    right: { label: 'Écris ce que tu veux', pillars: { medias: -8, parti: 4 }, outcome: 'Le chapitre s’intitule « L’ingrat ». Il est très bien écrit.' },
  },

  /* ============ Chaîne 5 : l'astrologue ============ */
  {
    id: 'rb_astro_1', ...ASTRO,
    text: 'Saturne entre dans votre maison des alliances : méfiez-vous d’un proche dont le prénom contient un R. Je peux préciser lors d’une consultation, 3 000 € la séance.',
    eligible: national,
    left: { label: 'À la corbeille', pillars: { parti: 4, medias: -4 }, next: { card: 'rb_astro_2', months: 3 }, outcome: 'Il raconte partout que vous « méprisez les astres ».' },
    right: { label: 'Une séance, juste pour voir', pillars: { medias: -6, parti: -4 }, effects: [st('stress', -2)], remember: { rb_astro: 1 }, next: { card: 'rb_astro_2', months: 3 }, outcome: 'Encens, cartes du ciel, et un reçu très détaillé.' },
  },
  {
    id: 'rb_astro_2', ...ASTRO, chainOnly: true,
    text: d => mem(d, 'rb_astro')
      ? 'Comme je vous l’ai dit en séance : la Lune noire traverse votre bureau. Annulez tous vos déplacements de mardi.'
      : 'Vous avez jeté ma lettre ; les astres, eux, ne vous jettent pas. La Lune noire traverse votre bureau : annulez vos déplacements de mardi.',
    eligible: national,
    left: { label: 'Je maintiens mardi', pillars: { peuple: 5, puissants: -3 }, next: { card: 'rb_astro_3', months: 1 }, outcome: 'Mardi, vous inaugurez une usine de chaussettes sous un ciel très noir.' },
    right: { label: 'Bon… j’annule mardi', pillars: { medias: -6, peuple: -4 }, remember: { rb_astro_mardi: 1 }, next: { card: 'rb_astro_3', months: 1 }, outcome: 'Votre agenda vide intrigue les journalistes.' },
  },
  {
    id: 'rb_astro_3', ...ASTRO, chainOnly: true,
    text: d => mem(d, 'rb_astro_mardi')
      ? 'Vous avez annulé mardi et rien de fâcheux ne vous est arrivé : la preuve que j’avais raison ! Je vous propose un abonnement annuel, horoscope du budget compris.'
      : 'Mardi, il a plu sur votre inauguration et le ruban a résisté aux ciseaux. Les astres ne mentent jamais. Un abonnement annuel ?',
    eligible: national,
    left: { label: 'Rayez-moi de vos fichiers', pillars: { medias: 6, peuple: -4 }, outcome: 'Il annonce un livre : « Celui qui défiait Saturne ». Les précommandes décollent.' },
    right: { label: 'Abonnement annuel', pillars: { medias: -8, peuple: 4 }, effects: [st('credibility', -2)], outcome: 'Chaque premier du mois, un horoscope arrive sous pli confidentiel.' },
  },

  /* ============ Chaîne 6 : le dîner d'État ============ */
  {
    id: 'rb_menu_etat', ...MAJ,
    text: 'Le président de la République de Valdorie dîne ici jeudi. Je propose homard bleu et caviar d’Aquitaine. Le chef, lui, suggère un pot-au-feu, « pour l’image ».',
    eligible: resident,
    left: { label: 'Pot-au-feu', pillars: { peuple: 8, puissants: -6 }, remember: { rb_menu: 1 }, next: { card: 'rb_valdorie', months: 1 }, outcome: 'Bertrand soupire, puis commande quarante kilos de jarret.' },
    right: { label: 'Homard et caviar', pillars: { puissants: 8, peuple: -8 }, remember: { rb_menu: 2 }, next: { card: 'rb_valdorie', months: 1 }, outcome: 'L’addition finit dans un rapport parlementaire.' },
  },
  {
    id: 'rb_valdorie', name: 'Anatol Vrenko', role: 'Président de la République de Valdorie', icon: '🎖️', chainOnly: true,
    text: d => (mem(d, 'rb_menu') === 1
      ? 'Votre pot-au-feu m’a rappelé ma grand-mère, je suis ému. '
      : 'Votre homard était divin, je suis d’humeur généreuse. ')
      + 'Je commande douze trains rapides à vos industriels… si vous fermez les yeux sur nos élections, un peu arrangées.',
    eligible: resident,
    left: { label: 'Pas à ce prix-là', pillars: { puissants: -12, medias: 8 }, next: { card: 'rb_menu_couverts', months: 2 }, outcome: 'Le dessert est servi dans un silence diplomatique.' },
    right: { label: 'Signons les trains', pillars: { puissants: 12, medias: -8 }, effects: [st('influence', 2)], next: { card: 'rb_menu_couverts', months: 2 }, outcome: 'Contrat signé. Les ONG publient un communiqué très sec.' },
  },
  {
    id: 'rb_menu_couverts', ...MAJ, chainOnly: true,
    text: 'Petit incident : la délégation valdorienne est repartie avec nos couverts en argent dans la valise diplomatique. Douze fourchettes du Second Empire. Je fais un esclandre ?',
    eligible: resident,
    left: { label: 'Laissez, c’est diplomatique', pillars: { medias: -6, puissants: 4 }, outcome: 'Les fourchettes réapparaissent à un dîner officiel valdorien. Les caméras zooment.' },
    right: { label: 'Exigez-les par note officielle', pillars: { medias: 6, puissants: -4 }, outcome: 'Les fourchettes reviennent par colis, avec une lettre d’excuse et un bocal de cornichons.' },
  },

  /* ============ Chaîne 7 : le chef gracié ============ */
  {
    id: 'rb_grace', ...MAJ,
    text: 'Le chef Lucien Gratteloup, trois étoiles, est condamné à six mois ferme pour une fraude fiscale sur ses truffes. Toute sa brigade a signé une supplique. Une grâce, peut-être ?',
    eligible: presid,
    left: { label: 'La justice suit son cours', pillars: { peuple: 6, puissants: -6 }, outcome: 'Bertrand range la supplique, la mort dans l’âme.' },
    right: { label: 'Je le gracie', pillars: { puissants: 6, peuple: -8, medias: -4 }, effects: [{ kind: 'presidency', approval: -2 }], remember: { rb_grace: 1 }, next: { card: 'rb_grace_chef', months: 3 }, outcome: 'Le décret tient en trois lignes. Les éditoriaux, en trois pages.' },
  },
  {
    id: 'rb_grace_chef', name: 'Lucien Gratteloup', role: 'Chef triplement étoilé, gracié', icon: '👨‍🍳', chainOnly: true,
    text: 'Grâce à vous, je suis libre. Pour vous remercier, je veux cuisiner gratuitement le prochain dîner d’État… et baptiser mon nouveau plat « le Gracié ». Ça vous va ?',
    eligible: presid,
    left: { label: 'Sans le nom, merci', pillars: { medias: 4, puissants: -4 }, outcome: 'Le plat s’appellera « l’Anonyme ». Tout le monde comprend quand même.' },
    right: { label: 'Va pour « le Gracié »', pillars: { medias: -8, peuple: -4, puissants: 6 }, outcome: 'Le plat devient un mème. Les humoristes vous remercient.' },
  },

  /* ============ Chaîne 8 : le tournage de série ============ */
  {
    id: 'rb_serie', name: 'Joachim Berthelot', role: 'Producteur de séries', icon: '🎬',
    text: 'Ma série « Palais » veut tourner trois semaines dans vos salons : cinquante figurants, de faux huissiers et une scène de coup d’État fictif au salon d’honneur.',
    eligible: presid,
    left: { label: 'Pas de caméras chez moi', pillars: { medias: -8, parti: 4 }, outcome: 'Ils tournent dans un château loué. Le faux palais est plus beau que le vrai.' },
    right: { label: 'Moteur !', pillars: { medias: 10, parti: -6 }, effects: [{ kind: 'presidency', approval: 1 }], remember: { rb_serie: 1 }, next: { card: 'rb_serie_2', months: 6 }, outcome: 'Un faux président fume une fausse cigarette dans votre vrai bureau.' },
  },
  {
    id: 'rb_serie_2', name: 'Joachim Berthelot', role: 'Producteur de séries', icon: '🎬', chainOnly: true,
    text: 'La série cartonne. L’acteur qui vous incarne est plus populaire que vous dans les sondages. Il veut vous rencontrer pour « nourrir son personnage » en saison 2.',
    eligible: presid,
    left: { label: 'Qu’il se nourrisse ailleurs', pillars: { medias: -6, peuple: -4 }, outcome: 'En saison 2, votre personnage devient franchement antipathique.' },
    right: { label: 'Rencontrons-nous', pillars: { medias: 8, peuple: 4, parti: -8 }, effects: [{ kind: 'exposure', delta: 2 }], outcome: 'Il imite votre démarche mieux que vous. Le parti grince des dents.' },
  },

  /* ============ Chaîne 9 : la tribune des cent économistes ============ */
  {
    id: 'rb_tribune', ...EDITO,
    text: 'Cent économistes signent ce matin une tribune : votre politique serait « une ligne Maginot fiscale ». J’ai l’antenne à 8 h 20. Vous répondez, ou vous laissez dire ?',
    eligible: national,
    left: { label: 'Je réponds en direct', pillars: { medias: 8, puissants: -6 }, effects: [st('stress', 2)], next: { card: 'rb_tribune_2', months: 1 }, outcome: 'Vingt minutes de joute. Vous en sortez rouge, mais debout.' },
    right: { label: 'Silence, je gouverne', pillars: { medias: -6, parti: 6 }, outcome: 'Le parti salue votre « hauteur ». La matinale salue votre absence.' },
  },
  {
    id: 'rb_tribune_2', ...EDITO, chainOnly: true,
    text: 'Belle prestation, mais vous avez confondu inflation et déflation à la septième minute, et les réseaux en font des remix. Je vous offre un second passage, si vous m’annoncez une mesure en exclusivité.',
    eligible: national,
    left: { label: 'Pas d’exclusivité', pillars: { medias: -6, parti: 4 }, outcome: 'Le remix « Déflation (club edit) » atteint le million de vues.' },
    right: { label: 'Voici une exclu', pillars: { medias: 10, parti: -8 }, effects: [{ kind: 'dossier', domain: 'economie', delta: 2 }], outcome: 'Le parti apprend votre mesure à la radio, comme tout le monde.' },
  },

  /* ============ Chaîne 10 : la note oubliée dans un taxi ============ */
  {
    id: 'rb_cab_note', ...CAB,
    text: 'Un conseiller a oublié une note confidentielle dans un taxi : « Comment présenter une hausse d’impôt comme une baisse ». Le chauffeur l’a gardée. On lui propose un petit dédommagement ?',
    eligible: national,
    left: { label: 'Non, on assume en public', pillars: { peuple: -6, medias: 6 }, effects: [st('credibility', 1)], outcome: 'Vous parlez de « document de travail ». Personne n’y croit, mais on salue la franchise.' },
    right: { label: 'Dédommagez-le discrètement', pillars: { parti: 6, puissants: 4 }, remember: { rb_cab_taxi: 1 }, next: { card: 'rb_cab_taxi_2', months: 3 }, outcome: 'Une enveloppe change de main sur un parking.' },
  },
  {
    id: 'rb_cab_taxi_2', ...CAB, chainOnly: true,
    text: 'Le chauffeur a pris le dédommagement… et vendu la note quand même. Elle fait la une ce matin, avec la photo de l’enveloppe. On sacrifie le conseiller ?',
    eligible: national,
    left: { label: 'On le sacrifie', pillars: { parti: -8, medias: 6 }, effects: [st('stress', 2)], outcome: 'Le conseiller part avec un carton et beaucoup de rancune.' },
    right: { label: 'Je le couvre', pillars: { parti: 8, medias: -8, peuple: -4 }, effects: [{ kind: 'exposure', delta: 3 }], outcome: 'Loyauté saluée en interne, cynisme dénoncé partout ailleurs.' },
  },

  /* ============ Cartes isolées ============ */
  {
    id: 'rb_cab_agenda', ...CAB,
    text: 'Demain : radio à 7 h, comité à 9 h, usine à 11 h, déjeuner patronal à 13 h, Assemblée à 15 h, kermesse à 18 h, dîner à 21 h. J’enlève la kermesse ou le déjeuner ?',
    eligible: national, repeatAfter: 30,
    left: { label: 'J’enlève la kermesse', pillars: { peuple: -8, puissants: 6 }, outcome: 'La tombola se tire sans vous. Le lot principal était un jambon.' },
    right: { label: 'J’enlève les patrons', pillars: { puissants: -8, peuple: 6 }, effects: [st('energy', -1)], outcome: 'Vous gagnez une peluche au chamboule-tout.' },
  },
  {
    id: 'rb_cab_vacances', ...CAB,
    text: 'Pour août : la villa d’un ami armateur au Cap-Ferret, ou un camping dans le Cantal ? Les communicants votent camping. Votre dos vote villa.',
    eligible: national, repeatAfter: 36,
    left: { label: 'Le camping', pillars: { peuple: 8, puissants: -4 }, effects: [st('energy', 1)], outcome: 'Photos en tongs, moustiques en prime.' },
    right: { label: 'La villa', pillars: { puissants: 8, peuple: -6 }, effects: [st('energy', 3)], outcome: 'Reposé·e, bronzé·e, et en une d’un magazine à paparazzi.' },
  },
  {
    id: 'rb_lambert_usine', ...LAMB,
    text: 'Je ferme l’usine de Saint-Aubin-sur-Vire, six cents emplois. À moins que l’État ne m’accorde un petit crédit d’impôt de quarante millions. Ce n’est pas du chantage, c’est de la gestion.',
    eligible: national,
    left: { label: 'Pas de chantage', pillars: { puissants: -10, medias: 6 }, effects: [{ kind: 'segment', segment: 'populaires', delta: -2 }], outcome: 'L’usine ferme. Vous promettez un plan de revitalisation.' },
    right: { label: 'Va pour le crédit d’impôt', pillars: { puissants: 10, peuple: 4, medias: -6 }, effects: [{ kind: 'dossier', domain: 'economie', delta: 1 }], outcome: 'Usine sauvée, chèque signé, éditoriaux furieux.' },
  },
  {
    id: 'rb_lambert_fauteuil', ...LAMB,
    text: 'Le jour où vous quitterez la politique, un fauteuil d’administrateur vous attend chez nous : quatre réunions par an, très bien payées. En attendant, je peux compter sur votre amitié ?',
    eligible: national,
    left: { label: 'Je ne suis pas à vendre', pillars: { puissants: -10, peuple: 6 }, outcome: 'Il range son stylo-plume avec une lenteur calculée.' },
    right: { label: 'On en reparlera', pillars: { puissants: 10, peuple: -6 }, effects: [st('credibility', -1)], outcome: 'Un « on en reparlera » qui sonne déjà comme un contrat.' },
  },
  {
    id: 'rb_syndic_smic', ...SYND,
    text: 'Le salaire minimum augmente de 1,1 %, soit une baguette par jour, en gros. Donnez un coup de pouce de 2 % et je vous fais une ola au prochain défilé.',
    eligible: national,
    left: { label: 'Coup de pouce', pillars: { peuple: 10, puissants: -10 }, effects: [{ kind: 'economy', deficit: 1 }], outcome: 'Ola il y eut. Assez molle, mais réelle.' },
    right: { label: 'Le minimum légal', pillars: { puissants: 8, peuple: -8 }, outcome: 'Elle brandit une baguette au journal de 20 heures.' },
  },
  {
    id: 'rb_clemence_fuite', ...CLEM,
    text: 'Le conseil des ministres de ce matin est dans la presse, mot pour mot. Ce n’est pas moi, évidemment. Mais si vous cherchez la fuite, regardez du côté de l’Agriculture.',
    eligible: gouv,
    left: { label: 'Enquête interne', pillars: { parti: -8, medias: 4 }, effects: [{ kind: 'government', cohesion: -2 }], outcome: 'Tout le monde se soupçonne. Les réunions deviennent glaciales.' },
    right: { label: 'Je laisse courir', pillars: { parti: 6, medias: -6 }, outcome: 'La semaine suivante, le compte rendu fuite à nouveau. Avec les fautes d’orthographe.' },
  },
  {
    id: 'rb_tracy_portrait', ...EDITO,
    text: 'Je prépare votre portrait pour le magazine du dimanche, titre provisoire : « Le Sphinx ». J’aimerais vous suivre une journée entière, petit-déjeuner compris.',
    eligible: national,
    left: { label: 'Pas au petit-déjeuner', pillars: { medias: -6, peuple: 4 }, outcome: 'Titre définitif : « Le Sphinx qui avait quelque chose à cacher ».' },
    right: { label: 'Suivez-moi partout', pillars: { medias: 10, parti: -4 }, effects: [{ kind: 'exposure', delta: 2 }], outcome: 'Il décrit vos tartines sur une demi-page. Le parti trouve ça « déplacé ».' },
  },
  {
    id: 'rb_tracy_sondage', ...EDITO,
    text: 'Mon sondage maison vous donne perdant au second tour face à un humoriste qui n’est même pas candidat. Un commentaire pour l’antenne ?',
    eligible: d => rankAtLeast(d, 4) && d.player.rankId !== 'ancien_president' && d.player.rankId !== 'president' && d.player.rankId !== 'roi',
    left: { label: 'Les sondages ne votent pas', pillars: { medias: -4, parti: 4 }, outcome: 'Phrase reprise sur un mug par vos militants.' },
    right: { label: 'J’invite l’humoriste à débattre', pillars: { medias: 8, parti: -8 }, effects: [{ kind: 'momentum', delta: 2 }], outcome: 'Il accepte, et vous fait rire. Le parti, nettement moins.' },
  },
  {
    id: 'rb_mentor_conseil', ...MENTOR, tu: true,
    text: 'Un conseil de vieux briscard : ne gouverne jamais en août, et ne réponds jamais à un éditorialiste avant ton café. Et paie-moi un déjeuner, ça fait deux ans.',
    eligible: national, repeatAfter: 36,
    left: { label: 'Déjeuner, c’est moi qui invite', pillars: { parti: 6, puissants: -2 }, effects: [st('energy', -1), st('stress', -2)], outcome: 'Trois heures de souvenirs de congrès et une tarte Tatin.' },
    right: { label: 'Pas le temps, Raymond', pillars: { parti: -6 }, effects: [st('energy', 1)], outcome: 'Il le raconte au bureau politique, avec un sanglot dans la voix.' },
  },
  {
    id: 'rb_bertrand_chat', ...MAJ,
    text: 'Un chat s’est installé sur le perron. Il refuse de bouger devant les ambassadeurs et a griffé un huissier. Les journalistes l’appellent déjà « le Premier Chat ». Je le confie à un refuge ?',
    eligible: resident,
    left: { label: 'Il est adopté', pillars: { peuple: 8, medias: 6, puissants: -4 }, effects: [st('stress', -1)], outcome: 'Le Premier Chat a désormais plus d’abonnés que vous.' },
    right: { label: 'Au refuge', pillars: { peuple: -8, medias: -4 }, outcome: 'Une pétition « Rendez-nous le Premier Chat » dépasse les cent mille signatures.' },
  },
  {
    id: 'rb_bertrand_cave', ...MAJ,
    text: 'La cave contient douze mille bouteilles. La Cour des comptes suggère d’en vendre une partie aux enchères. J’avoue une certaine tendresse pour les grands crus de 1982.',
    eligible: resident,
    left: { label: 'Vendez aux enchères', pillars: { peuple: 8, puissants: -6 }, outcome: 'Un grand cru part à un prix indécent. Bertrand porte le deuil une semaine.' },
    right: { label: 'On garde la cave', pillars: { puissants: 6, peuple: -6 }, outcome: 'Les dîners officiels restent excellents. Les éditoriaux, acides.' },
  },
  {
    id: 'rb_pigeon', name: 'Gaston Roucoul', role: 'Pigeon voyageur de la République de Valdorie', icon: '🕊️',
    text: 'Rrrou ! Rrrou ! (Le message à sa patte : « Le président de Valdorie vous propose un sommet secret… sur un pédalo, au milieu d’un lac de montagne. »)',
    eligible: national,
    left: { label: 'J’accepte le pédalo', pillars: { medias: 8, parti: -6 }, effects: [st('energy', -1)], outcome: 'Le sommet est un succès. Les mollets aussi.' },
    right: { label: 'Répondre par la voie normale', pillars: { parti: 4, medias: -4 }, outcome: 'Le pigeon repart vexé, en laissant un souvenir sur votre bureau.' },
  },
  {
    id: 'rb_sosie', name: 'Didier Lemoine', role: 'Votre sosie, ancien imitateur de cabaret', icon: '🎭',
    text: 'Je vous ressemble à s’y méprendre. Je pourrais inaugurer les ronds-points à votre place pendant que vous travaillez. Deux cents euros la prestation, cocarde fournie.',
    eligible: national,
    left: { label: 'Engagé à l’essai', pillars: { medias: -6, peuple: 4 }, effects: [st('energy', 3)], outcome: 'Il serre plus de mains que vous. Un journaliste finit par remarquer la moustache.' },
    right: { label: 'Un seul moi suffit', pillars: { peuple: -4, medias: 4 }, effects: [st('energy', -2)], outcome: 'Il ouvre un spectacle sur vous. Complet trois mois.' },
  },
  {
    id: 'rb_ambassadeur', name: 'Firmin Le Gall', role: 'Ambassadeur en Norlandie', icon: '🧑‍✈️',
    text: 'Le roi de Norlandie demande si vous viendrez à son jubilé : trois jours de cérémonies, un banquet de sept heures et un concours de sculpture sur glace.',
    eligible: national,
    left: { label: 'Trois jours, non', pillars: { puissants: -4, medias: 4 }, outcome: 'Le roi envoie une carte de vœux un peu froide. Littéralement.' },
    right: { label: 'J’y vais', pillars: { puissants: 6, peuple: -6 }, effects: [st('energy', -2), st('influence', 1)], outcome: 'Vous sculptez un coq de glace. Il fond pendant le discours.' },
  },
  {
    id: 'rb_reforme_report', ...CAB,
    text: 'La réforme de l’assurance chômage est prête, mais les élections régionales tombent dans quatre mois. On la décale après le scrutin ?',
    eligible: gouv,
    left: { label: 'On décale', pillars: { parti: 8, puissants: -6, medias: -4, peuple: 4 }, outcome: '« Courage, fuyons », titre un quotidien économique.' },
    right: { label: 'On la présente maintenant', pillars: { puissants: 8, parti: -8 }, effects: [{ kind: 'government', majority: -2 }], outcome: 'Les candidats aux régionales vous maudissent dans toutes les fédérations.' },
  },
  {
    id: 'rb_media_fusion', name: 'Ophélie Granger-Massé', role: 'Propriétaire du groupe Horizon Médias', icon: '📺',
    text: 'Mes chaînes vous ont été plutôt aimables cette année. Ma fusion avec Télé-Azur passe devant l’Autorité de la concurrence. Un mot de vous suffirait.',
    eligible: national,
    left: { label: 'Pas d’ingérence', pillars: { puissants: -6, peuple: 6 }, outcome: 'Vos passages sur ses chaînes deviennent soudain plus rares.' },
    right: { label: 'Je passerai un coup de fil', pillars: { puissants: 8, medias: 6, peuple: -6 }, effects: [{ kind: 'exposure', delta: 3 }], outcome: 'La fusion passe. Le coup de fil, lui, finira peut-être dans un livre.' },
  },
  {
    id: 'rb_doyenne', name: 'Marcelle Pradier', role: 'Doyenne des électrices, 104 ans', icon: '👵',
    text: 'J’ai voté à toutes les élections depuis 1945. Avant de tirer ma révérence, je voudrais visiter votre bureau et m’asseoir dans votre fauteuil. Cinq minutes, pas plus.',
    eligible: national,
    left: { label: 'Venez dès mardi', pillars: { peuple: 8, puissants: -4 }, effects: [st('stress', -1)], outcome: 'Elle repart avec votre stylo et trois conseils sur le budget. Une délégation patronale a été décalée.' },
    right: { label: 'Mon agenda est plein', pillars: { peuple: -8, medias: -4 }, outcome: 'Elle raconte l’histoire à la télévision locale. La vidéo fait le tour du pays.' },
  },
  {
    id: 'rb_parrainages', name: 'Robert Fauconnier', role: 'Maire de Saint-Ours-les-Prés', icon: '🧑‍🌾',
    text: 'Il vous manque des parrainages. J’ai le mien en poche, mais la toiture de ma salle des fêtes fuit depuis trois hivers. Vous voyez ce que je veux dire ?',
    eligible: d => d.player.rankId === 'candidat_presidence' && rankAtLeast(d, 5),
    left: { label: 'Je ne monnaie rien', pillars: { parti: -6, peuple: 4 }, outcome: 'Il parraine un candidat qui promet des toitures pour tous.' },
    right: { label: 'Parlons toiture', pillars: { parti: 6, medias: -8 }, effects: [{ kind: 'parrainages', delta: 3 }], outcome: 'Sa signature arrive. Un journaliste local s’intéresse aux tuiles.' },
  },
  {
    id: 'rb_slogan', name: 'Mélanie Roux', role: 'Publicitaire de votre campagne', icon: '💡',
    text: 'Trois slogans testés : « La France, enfin », « Ensemble, plus loin » et « Votez pour moi, c’est mieux ». Le troisième fait rire les panels, donc il marche.',
    eligible: d => rankAtLeast(d, 4) && (d.player.rankId === 'chef_parti' || d.player.rankId === 'candidat_presidence'),
    left: { label: 'Le sérieux', pillars: { parti: 6, medias: -4 }, outcome: '« Ensemble, plus loin » s’affiche sur mille panneaux. Personne ne s’en souviendra.' },
    right: { label: 'Celui qui fait rire', pillars: { medias: 8, parti: -6 }, effects: [{ kind: 'momentum', delta: 2 }], outcome: 'Le slogan devient un mème. Les anciens du parti s’étranglent.' },
  },
  {
    id: 'rb_tresorier', name: 'Patrick Moulinier', role: 'Trésorier du parti', icon: '💼',
    text: 'Les caisses du parti sont vides. Un mécène propose deux cent mille euros, à condition d’avoir une place éligible sur la liste européenne. Il n’a jamais fait de politique, mais il a un yacht.',
    eligible: d => rankAtLeast(d, 4) && d.player.rankId === 'chef_parti',
    left: { label: 'Pas de place à vendre', pillars: { puissants: -8, peuple: 4 }, effects: [{ kind: 'partyTreasury', delta: -10 }], outcome: 'Le parti vend des tote bags pour boucler le mois.' },
    right: { label: 'Il aura sa place', pillars: { puissants: 8, parti: -6 }, effects: [{ kind: 'partyTreasury', delta: 200 }], outcome: 'Les militants découvrent leur nouveau candidat en marinière.' },
  },
  {
    id: 'rb_congres_motion', name: 'Inès Bouvard', role: 'Militante, fédération du Gers', icon: '🙋',
    text: 'Le congrès vote demain une motion pour la gratuité des transports. Les militants l’adorent, les économistes la détestent. Vous la soutenez ?',
    eligible: d => rankAtLeast(d, 4) && d.player.rankId === 'chef_parti',
    left: { label: 'Je la soutiens', pillars: { parti: 10, puissants: -8 }, outcome: 'Standing ovation. Les fédérations patronales envoient leurs calculs.' },
    right: { label: 'Je la combats', pillars: { puissants: 6, parti: -10 }, effects: [{ kind: 'cohesion', delta: -2 }], outcome: 'La motion est rejetée à douze voix. Les couloirs bourdonnent.' },
  },
  {
    id: 'rb_remaniement_pm', ...CAB, role: 'Votre secrétaire général',
    text: 'Votre Premier ministre est à 22 % d’opinions favorables. Le remplacer, c’est une semaine de chaos ; le garder, c’est peut-être perdre l’automne.',
    eligible: presid,
    left: { label: 'On le garde', pillars: { parti: 6, medias: -6 }, effects: [{ kind: 'presidency', approval: -1 }], outcome: 'Vous lui renouvelez votre confiance. La formule inquiète Matignon.' },
    right: { label: 'On change de Premier ministre', pillars: { medias: 8, parti: -8 }, effects: [{ kind: 'presidency', approval: 2, majority: -2 }], outcome: 'Passation de pouvoir sous la pluie. Le sortant ne vous regarde pas.' },
  },
  {
    id: 'rb_budget_voix', ...CLEM, role: 'Ministre chargée des Relations avec le Parlement',
    text: 'Il manque douze voix pour faire adopter le budget. On peut négocier avec les centristes, ou passer en force et assumer.',
    eligible: d => gouv(d) && d.player.rankId === 'premier_ministre',
    left: { label: 'On négocie', pillars: { parti: -8, puissants: 4 }, effects: [{ kind: 'government', majority: 2 }], outcome: 'Trois amendements centristes plus tard, le budget passe.' },
    right: { label: 'On passe en force', pillars: { medias: -6, peuple: -6, parti: 6 }, effects: [{ kind: 'government', cohesion: 2, majority: -2 }], outcome: 'Le budget passe. Une motion de censure est déposée dans l’heure.' },
  },
];

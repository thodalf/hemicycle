import { Effect } from '../models/game.models';
import { SceneChoiceDef, SceneDef } from './scene-types';

/* ============================================================
 *  Le Salon de l'agriculture : une journée entière porte de
 *  Versailles, entre la vache égérie, les fromages, les vins
 *  et la colère des éleveurs. Rendez-vous annuel (fin février).
 * ============================================================ */

type Opts = Partial<Pick<SceneChoiceDef, 'hint' | 'requires' | 'money' | 'risk' | 'next'>>;
const ch = (id: string, label: string, delta: Record<string, number>, text: string, opts: Opts = {}): SceneChoiceDef =>
  ({ id, label, delta, text, ...opts });
const stat = (s: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat: s, delta });

const VACHES = ['Ulysse', 'Neige', 'Oreillette', 'Bise', 'Hirondelle', 'Ninon'];
const RACES = ['Aubrac', 'Salers', 'Montbéliarde', 'Normande', 'Tarentaise', 'Bazadaise'];

export const SALON: SceneDef = {
  id: 'salon_agriculture', title: 'Le Salon de l’agriculture', eyebrow: 'Rendez-vous annuel',
  intro: 'Porte de Versailles, 7 heures. {vache}, la {race} égérie du Salon, vous attend. Les éleveurs aussi — et ils ne sont pas tous de bonne humeur.',
  band: '#3d3a1f', minRank: 'militant', domain: 'territoires',
  setup: (_d, pick) => ({ vache: pick(VACHES), race: pick(RACES) }),
  gauges: [
    { id: 'sympathie', label: 'Cote chez les agriculteurs', min: -50, max: 50, start: 0, good: 'high', format: 'signed' },
    { id: 'image', label: 'Image dans les médias', min: 0, max: 100, start: 30, good: 'high' },
    { id: 'colere', label: 'Colère paysanne', min: 0, max: 100, start: 35, good: 'low',
      danger: { above: 80, label: 'Huées et jets d’œufs', text: 'Les éleveurs vous encerclent, le service d’ordre vous exfiltre sous les huées.', delta: { image: -15 }, end: true } },
    { id: 'verres', label: 'Verres bus', min: 0, max: 10, start: 0, good: 'low',
      danger: { above: 6, label: 'Un verre de trop', text: 'Le rouge aux joues, vous confondez deux appellations devant les caméras.', delta: { image: -15, sympathie: -5 } } },
    { id: 'forme', label: 'Forme', min: 0, max: 100, start: d => Math.round(d.player.stats.energy * 0.8), good: 'high',
      danger: { below: 8, label: 'Épuisé·e', text: 'Douze heures debout : vous rendez les armes avant la fermeture.', end: true } },
  ],
  stages: [['s_arrivee'], ['s_vache', 's_fromage', 's_jeune'], ['s_colere', 's_pac', 's_vins'], ['s_fromage', 's_jeune', 's_vins', 's_selfies', 's_cochon'], ['s_cameras']],
  steps: [
    {
      id: 's_arrivee', title: 'L’ouverture des portes',
      context: 'Les allées sentent la paille et le café. Votre équipe vous tend des bottes.',
      choices: [
        ch('aube', 'Arriver à l’aube, avant les caméras', { sympathie: 8, forme: -10 }, 'Les éleveurs remarquent que vous êtes là pour eux, pas pour la photo.'),
        ch('cortege', 'Arriver avec un cortège de caméras', { image: 12, colere: 6 }, 'Une meute de micros vous suit dans les allées.'),
        ch('incognito', 'Arriver incognito, en bottes et parka', { sympathie: 5, image: -3, forme: -4 }, 'On vous reconnaît au bout d’une heure.'),
      ],
    },
    {
      id: 's_vache', title: 'La vache égérie',
      context: '{vache} vous regarde de ses grands yeux. Son éleveur, lui, vous jauge.',
      choices: [
        ch('flatter', 'Lui flatter la croupe pour la photo', { image: 10, sympathie: 2 }, 'La photo fera la une demain.', {
          risk: { chance: 0.25, onFail: { image: -8, forme: -6 }, failText: '{vache} vous écrase le pied. Votre grimace devient un mème.' },
        }),
        ch('eleveur', 'Parler du prix du lait avec l’éleveur', { sympathie: 10, forme: -8 }, 'Vingt minutes de discussion, sans caméra. Il vous serre la main.'),
        ch('traite', 'Tenter la traite devant les caméras', { image: 16, sympathie: 4 }, 'Un seau à moitié plein : exploit salué.', {
          risk: { chance: 0.5, scaleWith: 'popularity', weight: 0.4, onFail: { image: -10, sympathie: -4 }, failText: 'Le seau se renverse sur vos chaussures. Fou rire général.' },
        }),
        ch('passer', 'Passer votre chemin', { forme: 4, sympathie: -3 }, 'L’éleveur hausse les épaules.'),
      ],
    },
    {
      id: 's_fromage', title: 'Le stand des fromages AOP',
      context: 'Comté de 36 mois, Salers, Roquefort : on vous tend des morceaux de partout.',
      choices: [
        ch('tout', 'Goûter à tout, avec appétit', { sympathie: 8, image: 4, forme: -6 }, 'Les producteurs sont ravis, votre estomac un peu moins.'),
        ch('acheter', 'Acheter une meule pour votre équipe', { sympathie: 6, image: 3 }, 'Un geste apprécié, et un fromage à transporter toute la journée.', { money: 150 }),
        ch('normes', 'Parler des normes sanitaires', { sympathie: 12 }, 'Vous connaissez le dossier : les producteurs vous écoutent.', {
          hint: 'Dépend de votre maîtrise des territoires.',
          risk: { chance: 0.7, scaleWith: 'dossier', weight: 1, onFail: { sympathie: -4, image: -4 }, failText: 'Vous confondez AOP et IGP. Silence gêné.' },
        }),
        ch('regime', 'Refuser : vous êtes au régime', { sympathie: -6, forme: 4 }, '« Un politique qui ne mange pas de fromage ? » La rumeur court l’allée.'),
      ],
    },
    {
      id: 's_jeune', title: 'Une jeune agricultrice qui s’installe',
      context: '« J’ai 26 ans, 80 hectares en bio, et 400 000 € de dettes. Qui va m’aider ? »',
      choices: [
        ch('ecouter', 'L’écouter longuement', { sympathie: 10, forme: -8 }, 'Elle vous montre les photos de sa ferme sur son téléphone.'),
        ch('promettre', 'Promettre une aide à l’installation', { sympathie: 14, image: -2 }, 'Elle note votre promesse. Les caméras aussi.', {
          risk: { chance: 0.45, scaleWith: 'credibility', weight: 0.6, onFail: { sympathie: 2, image: -8 }, failText: '« Vous dites tous ça. » Elle tourne les talons.' },
        }),
        ch('chiffres', 'Lui détailler les dispositifs existants', { sympathie: 8, image: 4 }, 'Elle repart avec un plan précis.', {
          risk: { chance: 0.75, scaleWith: 'dossier', weight: 1, onFail: { sympathie: -3, forme: -4 }, failText: 'Vos chiffres sont faux. Elle vous corrige.' },
        }),
        ch('carte', 'Lui laisser votre carte', { forme: 3 }, 'Un sourire poli.'),
      ],
    },
    {
      id: 's_colere', title: 'Des éleveurs en colère vous attendent',
      context: 'Une trentaine d’éleveurs bloquent l’allée, banderole « On meurt en silence » déployée.',
      choices: [
        ch('affronter', 'Aller au contact', { sympathie: 12, colere: -10, forme: -12 }, 'Une heure de débat sans filtre. Ils vous respectent.', {
          risk: { chance: 0.45, scaleWith: 'influence', weight: 0.6, onFail: { colere: 20, image: -10, forme: -12 }, failText: 'Le ton monte, les bousculades commencent.' },
        }),
        ch('moratoire', 'Promettre un moratoire sur les normes', { colere: -15, sympathie: 8, image: -4 }, 'Les banderoles se baissent.', {
          risk: { chance: 0.4, scaleWith: 'credibility', weight: 0.6, onFail: { colere: 10, image: -6 }, failText: '« Encore une promesse ! » La colère redouble.' },
        }),
        ch('detour', 'Faire un détour par l’autre hall', { colere: 10, image: -6, forme: 2 }, '« Il·elle se cache ! » crie quelqu’un.'),
        ch('ordre', 'Laisser le service d’ordre dégager l’allée', { colere: 16, image: -8, forme: 4 }, 'Les images de l’exfiltration tournent en boucle.'),
      ],
    },
    {
      id: 's_pac', title: 'Un syndicaliste vous interroge sur la PAC',
      context: '« La politique agricole commune : vous êtes pour ou contre la convergence des aides ? »',
      choices: [
        ch('technique', 'Répondre dans le détail', { sympathie: 12, image: 4 }, 'Une réponse précise : le syndicaliste est bluffé.', {
          risk: { chance: 0.75, scaleWith: 'dossier', weight: 1, onFail: { image: -8, sympathie: -6 }, failText: 'Vous vous emmêlez dans les piliers de la PAC.' },
        }),
        ch('bruxelles', 'Accuser Bruxelles', { sympathie: 8, image: -5, colere: -4 }, 'Applaudissements nourris, sourcils froncés chez les journalistes.'),
        ch('engagement', 'S’engager à défendre le budget agricole', { sympathie: 10, colere: -6 }, 'Le syndicaliste prend acte.', {
          risk: { chance: 0.35, scaleWith: 'credibility', weight: 0.6, onFail: { sympathie: 2, image: -6 }, failText: 'On vous rappelle vos votes passés.' },
        }),
        ch('esquive', 'Renvoyer à votre programme', { sympathie: -4, forme: 2 }, '« Langue de bois », note un journaliste.'),
      ],
    },
    {
      id: 's_vins', title: 'Le stand des vins',
      context: 'Un vigneron vous tend un verre de son meilleur cru. Puis un deuxième.',
      choices: [
        ch('trinquer', 'Trinquer franchement', { sympathie: 10, verres: 3, image: 2 }, 'Tchin ! Le vigneron vous prend par l’épaule.'),
        ch('connaisseur', 'Goûter en connaisseur et recracher', { sympathie: 5, image: 4, verres: 1 }, 'Votre vocabulaire d’œnologue impressionne.'),
        ch('taxes', 'Parler des taxes à l’export', { sympathie: 8, forme: -6, verres: 1 }, 'Vous touchez un point sensible : les vignerons se pressent autour de vous.'),
        ch('eau', 'Rester à l’eau', { sympathie: -6, forme: 2 }, '« À l’eau ? Au Salon ? » Le vigneron est vexé.'),
      ],
    },
    {
      id: 's_cochon', title: 'Le concours général : la remise des prix',
      context: 'On vous propose de remettre la médaille d’or du concours porcin.',
      choices: [
        ch('remettre', 'Remettre la médaille avec un discours', { image: 8, sympathie: 6, forme: -6 }, 'Le lauréat pleure, vous aussi presque.'),
        ch('photo', 'Une photo avec le cochon champion', { image: 10, sympathie: 2 }, 'Le cochon, 320 kilos, vole la vedette.', {
          risk: { chance: 0.3, onFail: { image: -6, forme: -6 }, failText: 'Le champion vous renverse dans la paille.' },
        }),
        ch('ceder', 'Laisser l’honneur à un élu local', { sympathie: 4, forme: 4 }, 'Le député du coin vous remercie chaleureusement.'),
      ],
    },
    {
      id: 's_selfies', title: 'La foule des selfies',
      context: 'Une file de visiteurs s’est formée : tout le monde veut sa photo avec vous.',
      choices: [
        ch('tous', 'Faire des selfies avec tout le monde', { image: 10, forme: -14 }, 'Deux cents photos plus tard, vous avez des crampes aux joues.'),
        ch('quelques', 'Quelques photos, puis reprendre la visite', { image: 4, forme: -5 }, 'Un bon compromis.'),
        ch('refuser', 'Refuser poliment : vous êtes là pour les agriculteurs', { image: -6, sympathie: 4, forme: 4 }, 'Les agriculteurs apprécient, les visiteurs moins.'),
      ],
    },
    {
      id: 's_cameras', title: 'La meute des caméras à la sortie',
      context: '« Quel message aux agriculteurs ce soir ? »',
      choices: [
        ch('bilan', 'Raconter vos rencontres de la journée', { image: 8, sympathie: 2 }, 'Un récit sincère, repris dans les journaux du soir.'),
        ch('annonce', 'Annoncer une mesure concrète', { image: 10, sympathie: 8 }, 'Votre annonce fait les titres.', {
          requires: { minMastery: 35 }, hint: 'Exige de maîtriser le dossier des territoires (35).',
        }),
        ch('attaque', 'Attaquer la politique agricole du gouvernement', { image: 6, colere: -4, sympathie: 4 }, 'La petite phrase tourne en boucle.'),
        ch('fromage', 'Repartir un fromage sous le bras, sans un mot', { image: 3, forme: 3 }, 'L’image est sympathique, le message absent.'),
      ],
    },
  ],
  score: g => g['sympathie'] + g['image'] * 0.35 - g['colere'] * 0.3 - (g['verres'] > 6 ? 8 : 0) - (g['forme'] <= 8 ? 10 : 0),
  thresholds: { succes: 30, mitige: 15 },
  outcomes: {
    succes: 'Une journée réussie : les campagnes parlent de vous comme de l’un·e des leurs.',
    mitige: 'Des poignées de main, quelques photos. Le monde agricole reste sceptique.',
    echec: 'Une journée à oublier. Les éleveurs se souviendront de votre passage.',
  },
  rewards: (status, _g, d) => {
    const big = !!d.presidency || ['ministre', 'premier_ministre', 'chef_parti', 'candidat_presidence'].includes(d.player.rankId);
    const pres: Effect[] = d.presidency ? [{ kind: 'presidency', approval: status === 'succes' ? 4 : status === 'mitige' ? 1 : -4 }] : [];
    return status === 'succes'
      ? [stat('popularity', big ? 5 : 3), stat('credibility', 2), { kind: 'contact', contactId: 'ct-maires', trust: 6 }, { kind: 'dossier', domain: 'territoires', delta: 5 }, stat('energy', -15), ...pres]
      : status === 'mitige'
      ? [stat('popularity', 1), { kind: 'contact', contactId: 'ct-maires', trust: 2 }, stat('energy', -15), ...pres]
      : [stat('popularity', big ? -4 : -2), stat('stress', 6), { kind: 'contact', contactId: 'ct-maires', trust: -4 }, stat('energy', -15), ...pres];
  },
};

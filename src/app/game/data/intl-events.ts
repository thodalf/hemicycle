import { Effect, GameState } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';
import { intlPower } from '../engine/intl';

/* ============================================================
 *  Événements internationaux. Les grands arbitrages reviennent
 *  au gouvernement et à l'Élysée ; les parlementaires vivent le
 *  monde par des tribunes, des délégations, des votes.
 * ============================================================ */

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat, delta });
const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice =>
  ({ id, label, effects, outcome, ...extra });
const w = (x: Omit<Extract<Effect, { kind: 'intl' }>, 'kind'>): Effect => ({ kind: 'intl', ...x });
const approval = (n: number): Effect[] => [{ kind: 'presidency', approval: n }];
const power = (d: GameState) => intlPower(d);
const pres = (d: GameState, n: number) => (d.presidency ? approval(n) : [s('popularity', Math.round(n / 2))]);

export const INTL_EVENTS: RandomEvent[] = [
  {
    tag: 'i_taxes', weight: 1, eligible: power,
    build: d => ({
      title: 'Guerre commerciale : taxes américaines sur le vin et le fromage',
      context: 'Washington impose 25 % de droits de douane sur nos vins, nos fromages et nos cosmétiques. Les viticulteurs bloquent les préfectures.',
      choices: [
        c('riposte', 'Riposter par des taxes sur leurs produits', [w({ partner: 'etats_unis', relation: -12, tension: 4, prestige: 2 }), ...pres(d, 4)], 'Les chaînes d’info adorent le bras de fer.'),
        c('negocier', 'Négocier discrètement', [w({ partner: 'etats_unis', relation: 4 }), s('politicalCapital', -10)], 'Des exemptions sont arrachées pour le vin.',
          { risk: { baseChance: 0.4, scaleWith: 'influence', scaleWeight: 0.6, onFailure: [w({ prestige: -3 }), ...pres(d, -3)], failureNews: 'Les négociations échouent : les taxes restent.' } }),
        c('europe', 'Porter l’affaire au niveau européen', [w({ partner: 'ue', relation: 6, prestige: 1 }), s('energy', -6)], 'Bruxelles promet une réponse commune… dans six mois.'),
      ],
    }),
  },
  {
    tag: 'i_migrants', weight: 1, eligible: power,
    build: d => ({
      title: 'Un navire humanitaire demande à accoster',
      context: '240 rescapés à bord, l’Italie a refusé. Le navire se dirige vers Marseille.',
      choices: [
        c('accueillir', 'Accueillir le navire', [w({ prestige: 3, partner: 'ue', relation: 3 }), { kind: 'stance', delta: -3 }, { kind: 'faction', factionId: 'ligne_dure', delta: -5 }, ...pres(d, -1)], 'Les images de l’arrivée font le tour de l’Europe.'),
        c('refuser', 'Refuser l’accostage', [w({ prestige: -3, partner: 'ue', relation: -6 }), { kind: 'stance', delta: 4 }, s('credibility', -2), ...pres(d, 1)], 'Le navire erre deux semaines en mer.'),
        c('repartir', 'Exiger une répartition européenne', [w({ partner: 'ue', relation: 5 }), s('politicalCapital', -10), s('energy', -6)], 'Sept pays acceptent d’accueillir une partie des rescapés.'),
      ],
    }),
  },
  {
    tag: 'i_coup', weight: 0.8, eligible: d => power(d) && !d.intl.crisis,
    build: d => ({
      title: 'Coup d’État au Kantor',
      context: 'Une junte prend le pouvoir dans ce pays sahélien où vivent 4 000 Français. L’ambassade est encerclée.',
      choices: [
        c('evacuer', 'Évacuer nos ressortissants', [w({ prestige: 2 }), s('energy', -10), ...pres(d, 3)], 'Pont aérien réussi en 72 heures.'),
        c('intervenir', 'Soutenir le président renversé', [w({ startCrisis: 'la guerre civile au Kantor', prestige: 3, partner: 'afrique', relation: -6 }), ...pres(d, 2)], 'Nos forces spéciales sont déployées.'),
        c('condamner', 'Condamner et suspendre la coopération', [w({ partner: 'afrique', relation: 3, prestige: -1 })], 'Un communiqué ferme, peu suivi d’effets.'),
      ],
    }),
  },
  {
    tag: 'i_otages', weight: 0.7, eligible: power,
    build: d => ({
      title: 'Des Français pris en otage',
      context: 'Trois humanitaires enlevés par un groupe armé. Une vidéo réclame une rançon.',
      choices: [
        c('negocier', 'Négocier en secret', [s('stress', 8)], 'Les otages sont libérés après six semaines. Personne ne parle de rançon.',
          { risk: { baseChance: 0.35, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [...pres(d, -6), w({ prestige: -3 })], failureNews: 'Les négociations s’enlisent. Les familles vous accusent d’immobilisme.' } }),
        c('assaut', 'Ordonner un assaut des forces spéciales', [w({ prestige: 5 }), ...pres(d, 8), s('stress', 10)], 'Assaut réussi : les otages sont sains et saufs.',
          { risk: { baseChance: 0.4, onFailure: [...pres(d, -10), w({ prestige: -4 }), s('stress', 10)], failureNews: 'L’assaut tourne au drame : un otage est tué.' } }),
        c('ferme', 'Refuser tout marchandage', [s('credibility', 3), s('stress', 6), ...pres(d, -2)], 'La doctrine est tenue. L’attente commence.'),
      ],
    }),
  },
  {
    tag: 'i_cop', weight: 1, eligible: power,
    build: () => ({
      title: 'La conférence mondiale sur le climat s’ouvre',
      context: 'Deux cents délégations. La France est attendue au tournant.',
      choices: [
        c('ambition', 'Annoncer des engagements ambitieux', [w({ prestige: 4, allRelations: 2 }), { kind: 'dossier', domain: 'ecologie', delta: 5 }, { kind: 'faction', factionId: 'ligne_dure', delta: -3 }], 'Standing ovation dans la salle plénière.'),
        c('realiste', 'Défendre une ligne réaliste', [w({ prestige: 1 }), { kind: 'dossier', domain: 'economie', delta: 3 }, { kind: 'contact', contactId: 'ct-climat', trust: -5 }], 'Les ONG dénoncent « l’inaction ».'),
        c('absent', 'Envoyer un secrétaire d’État', [w({ prestige: -3 }), s('energy', 5)], 'Votre absence est remarquée.'),
      ],
    }),
  },
  {
    tag: 'i_jo', weight: 0.6, eligible: power,
    build: () => ({
      title: 'Candidature aux Jeux olympiques d’hiver',
      context: 'Les Alpes françaises se portent candidates. Il faut l’appui de l’État — et ses milliards.',
      choices: [
        c('porter', 'Porter la candidature', [w({ prestige: 4 }), s('politicalCapital', -12), s('popularity', 2)], 'La France est désignée ville hôte !',
          { risk: { baseChance: 0.5, scaleWith: 'influence', scaleWeight: 0.5, onFailure: [w({ prestige: -3 }), s('popularity', -2)], failureNews: 'Le CIO choisit un autre pays. Humiliation.' } }),
        c('soutien', 'Un soutien de principe, sans argent', [w({ prestige: 1 })], 'La candidature part sans moyens.'),
        c('renoncer', 'Renoncer : trop cher, trop polluant', [s('credibility', 2), { kind: 'contact', contactId: 'ct-climat', trust: 5 }, s('popularity', -1)], 'Les écologistes applaudissent.'),
      ],
    }),
  },
  {
    tag: 'i_espion', weight: 0.8, eligible: power,
    build: () => ({
      title: 'Un espion étranger arrêté',
      context: 'La DGSI interpelle un diplomate chinois en flagrant délit d’espionnage industriel.',
      choices: [
        c('expulser', 'Expulser dix diplomates', [w({ partner: 'chine', relation: -12, prestige: 2, tension: 4 }), s('credibility', 2)], 'Pékin promet des représailles.'),
        c('echange', 'Négocier un échange discret', [w({ partner: 'chine', relation: 3 }), s('credibility', -2)], 'Tout se règle dans un aéroport, de nuit.'),
        c('silence', 'Garder l’affaire secrète', [s('stress', 3)], 'Personne n’en saura rien.',
          { risk: { baseChance: 0.35, onFailure: [s('credibility', -5), { kind: 'exposure', delta: 5 }], failureNews: 'L’affaire fuite : on vous accuse de complaisance.' } }),
      ],
    }),
  },
  {
    tag: 'i_emprunt', weight: 0.8, eligible: power,
    build: () => ({
      title: 'Berlin propose un grand emprunt européen',
      context: 'La chancellerie veut mutualiser 500 milliards d’euros pour l’industrie et la défense.',
      choices: [
        c('soutenir', 'Soutenir le projet', [w({ partner: 'allemagne', relation: 8, prestige: 2 }), w({ partner: 'ue', relation: 6 }), { kind: 'faction', factionId: 'ligne_dure', delta: -3 }], 'Le couple franco-allemand relance l’Europe.'),
        c('conditions', 'Exiger qu’il finance d’abord l’agriculture', [w({ partner: 'allemagne', relation: -3 }), s('popularity', 2), { kind: 'contact', contactId: 'ct-maires', trust: 4 }], 'Les négociations traînent.'),
        c('refuser', 'S’y opposer au nom de la souveraineté', [w({ partner: 'ue', relation: -8, prestige: -2 }), { kind: 'stance', delta: 3 }, s('popularity', 1)], 'Le projet est enterré.'),
      ],
    }),
  },
  {
    tag: 'i_gaz', weight: 0.7, eligible: d => d.player.rankId !== 'militant',
    build: d => ({
      title: 'Crise énergétique : un gazoduc coupé',
      context: 'Une explosion sabote un gazoduc stratégique. Les prix de l’énergie s’envolent.',
      choices: power(d) ? [
        c('bouclier', 'Un bouclier tarifaire pour les ménages', [s('popularity', 3), s('politicalCapital', -15), { kind: 'dossier', domain: 'economie', delta: 3 }], 'Les factures sont gelées. La dette, elle, grimpe.'),
        c('sobriete', 'Un plan national de sobriété', [s('popularity', -2), { kind: 'dossier', domain: 'ecologie', delta: 5 }, s('credibility', 2)], 'Chauffage à 19 °C, col roulé de rigueur.'),
        c('nucleaire', 'Relancer six réacteurs nucléaires', [{ kind: 'stance', delta: 3 }, { kind: 'contact', contactId: 'ct-climat', trust: -6 }, w({ prestige: 1 }), s('credibility', 2)], 'Un chantier de quinze ans est lancé.'),
      ] : [
        c('proposer', 'Proposer un chèque énergie', [s('popularity', 2), s('credibility', -1)], 'Votre proposition est reprise par le gouvernement.'),
        c('sobriete', 'Prêcher la sobriété', [s('credibility', 2), s('popularity', -1)], 'Un discours responsable, peu applaudi.'),
        c('attaquer', 'Accuser le gouvernement d’imprévoyance', [s('popularity', 2), { kind: 'exposure', delta: 2 }], 'L’opposition fait bloc derrière vous.'),
      ],
    }),
  },
  {
    tag: 'i_dissident', weight: 0.6, eligible: power,
    build: () => ({
      title: 'Un dissident demande l’asile',
      context: 'Un célèbre opposant au régime chinois se réfugie à l’ambassade de France.',
      choices: [
        c('accorder', 'Lui accorder l’asile', [w({ prestige: 3, partner: 'chine', relation: -10 }), s('credibility', 2)], 'Un geste salué par les défenseurs des droits humains.'),
        c('discret', 'L’exfiltrer discrètement vers un pays tiers', [w({ partner: 'chine', relation: -3 }), s('stress', 4)], 'Opération réussie, sans tapage.'),
        c('refuser', 'Refuser pour préserver la relation', [w({ partner: 'chine', relation: 4, prestige: -3 }), s('credibility', -3)], 'La presse parle de « lâcheté ».'),
      ],
    }),
  },
  {
    tag: 'i_invasion', weight: 0.7, eligible: d => d.player.rankId !== 'militant' && !d.intl.crisis && d.intl.tension >= 40,
    build: d => ({
      title: 'La Valdovie envahit la Karstanie',
      context: 'Des colonnes de chars franchissent la frontière à l’aube. Le monde se tourne vers les grandes capitales.',
      choices: power(d) ? [
        c('sanctions', 'Prendre la tête des sanctions européennes', [w({ startCrisis: 'la guerre entre la Valdovie et la Karstanie', prestige: 4, partner: 'ue', relation: 5 }), ...pres(d, 4)], 'Les Vingt-Sept vous suivent.'),
        c('mediation', 'Proposer une médiation', [w({ startCrisis: 'la guerre entre la Valdovie et la Karstanie', prestige: 2 }), w({ crisis: -15 }), s('energy', -10)], 'Vous êtes le premier dirigeant à vous rendre sur place.'),
        c('prudence', 'Rester prudent', [w({ startCrisis: 'la guerre entre la Valdovie et la Karstanie', prestige: -3 })], 'On vous reproche votre tiédeur.'),
      ] : [
        c('tribune', 'Signer une tribune de soutien à la Karstanie', [w({ startCrisis: 'la guerre entre la Valdovie et la Karstanie' }), s('credibility', 2), s('popularity', 1)], 'Votre tribune est reprise dans plusieurs pays.'),
        c('debat', 'Exiger un débat au Parlement', [w({ startCrisis: 'la guerre entre la Valdovie et la Karstanie' }), s('influence', 2)], 'Le gouvernement accepte un débat sans vote.'),
        c('pacifisme', 'Plaider pour la désescalade', [w({ startCrisis: 'la guerre entre la Valdovie et la Karstanie' }), s('popularity', -1), { kind: 'stance', delta: -2 }], 'Une position minoritaire, assumée.'),
      ],
    }),
  },
  {
    tag: 'i_onu', weight: 0.6, eligible: d => !!d.presidency || d.player.rankId === 'premier_ministre',
    build: () => ({
      title: 'Vote décisif au Conseil de sécurité',
      context: 'Une résolution sur un conflit lointain divise Washington et Pékin. La voix de la France fera la différence.',
      choices: [
        c('pour', 'Voter avec les États-Unis', [w({ partner: 'etats_unis', relation: 8 }), w({ partner: 'chine', relation: -6 })], 'La résolution est adoptée.'),
        c('contre', 'Opposer le veto de la France', [w({ prestige: 4, partner: 'etats_unis', relation: -10 }), s('popularity', 2)], 'Un veto qui rappelle d’autres heures.'),
        c('abstention', 'S’abstenir', [w({ prestige: -1 })], 'La France ne choisit pas.'),
      ],
    }),
  },
  {
    tag: 'i_delegation', weight: 0.8, eligible: d => d.player.rankId === 'depute' || d.player.rankId === 'chef_parti',
    build: () => ({
      title: 'Une délégation étrangère vous sollicite',
      context: 'Des parlementaires allemands veulent visiter votre circonscription et parler industrie.',
      choices: [
        c('accueillir', 'Les accueillir avec faste', [w({ partner: 'allemagne', relation: 4 }), s('influence', 2), s('energy', -8)], 'Une belle journée, un article dans la presse régionale.'),
        c('simple', 'Un déjeuner simple à la mairie', [w({ partner: 'allemagne', relation: 2 }), s('energy', -3)], 'Courtois et efficace.'),
        c('decliner', 'Décliner : agenda trop chargé', [s('energy', 2)], 'Ils iront voir un collègue.'),
      ],
    }),
  },
];

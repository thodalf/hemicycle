import { Decision, DecisionChoice, Effect, GameState } from '../models/game.models';
import { Rng, nextId } from './rng';
import { honorific, office } from './office';
import { nameRng, personName } from '../data/names';

/* ============================================================
 *  Le bureau : quand l'actualité s'endort, les dossiers
 *  s'empilent quand même. À l'Élysée, au Palais ou à Matignon,
 *  chaque mois calme apporte un ou deux arbitrages, composés à
 *  partir de modèles et de variables (régions, ministères,
 *  entreprises, pays) : jamais tout à fait les mêmes.
 * ============================================================ */

const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
const seg = (segment: 'jeunes' | 'retraites' | 'populaires' | 'cadres' | 'ruraux', delta: number): Effect => ({ kind: 'segment', segment, delta });
const ch = (id: string, label: string, effects: Effect[], outcome: string, hint?: string): DecisionChoice => ({ id, label, effects, outcome, ...(hint ? { hint } : {}) });

const REGIONS = ['Bretagne', 'Occitanie', 'Hauts-de-France', 'Grand Est', 'Normandie', 'Auvergne-Rhône-Alpes', 'Provence-Alpes-Côte d’Azur', 'Nouvelle-Aquitaine', 'Centre-Val de Loire', 'Bourgogne-Franche-Comté', 'Pays de la Loire', 'Corse', 'Guadeloupe', 'La Réunion'];
/** « de Bretagne », « du Grand Est », « des Hauts-de-France »… */
const DE: Record<string, string> = { 'Occitanie': 'd’Occitanie', 'Hauts-de-France': 'des Hauts-de-France', 'Grand Est': 'du Grand Est', 'Auvergne-Rhône-Alpes': 'd’Auvergne-Rhône-Alpes',
  'Centre-Val de Loire': 'du Centre-Val de Loire', 'Pays de la Loire': 'des Pays de la Loire' };
const de = (r: string) => DE[r] ?? `de ${r}`;
const MINISTRIES: [string, 'economie' | 'education' | 'sante' | 'securite' | 'ecologie' | 'justice' | 'territoires' | 'social' | 'numerique' | 'diplomatie'][] = [
  ['l’Économie', 'economie'], ['l’Éducation', 'education'], ['la Santé', 'sante'], ['l’Intérieur', 'securite'], ['la Transition écologique', 'ecologie'],
  ['la Justice', 'justice'], ['la Cohésion des territoires', 'territoires'], ['le Travail', 'social'], ['le Numérique', 'numerique'], ['les Affaires étrangères', 'diplomatie'],
];
const COMPANIES = ['Valtéris', 'Aérolis', 'Nordia Énergie', 'Mirvane Pharma', 'Cassiopée Télécom', 'Ferrovia', 'Agrivert', 'Hélios Batteries', 'Océane Chantiers'];
const PARTNERS = ['un émirat du Golfe', 'un grand pays d’Asie', 'un voisin européen', 'un partenaire africain', 'une puissance d’Amérique du Sud'];
const ANNIVERSARIES = ['le centenaire d’une grande grève ouvrière', 'les cinquante ans d’une loi sur l’égalité', 'le bicentenaire d’un poète national', 'les quatre-vingts ans d’un débarquement', 'le centenaire d’un grand stade'];

interface Template {
  key: string;
  offices: ('elysee' | 'couronne' | 'gouv')[];
  build: (d: GameState, rng: Rng) => { title: string; context: string; choices: DecisionChoice[] };
}

const TEMPLATES: Template[] = [
  { key: 'grace', offices: ['elysee', 'couronne'], build: (d, rng) => {
    const who = rng.pick(['un agriculteur de 78 ans, condamné pour avoir blessé un cambrioleur', 'une militante écologiste condamnée pour avoir bloqué un aéroport', 'un ancien soldat malade, condamné pour une rixe il y a vingt ans', 'une mère de famille condamnée pour avoir volé de la nourriture']);
    return { title: 'Une demande de grâce', context: `Sur votre bureau, la demande de grâce d’${who}. L’opinion est divisée ; l’avocat attend votre réponse.`, choices: [
      ch('gracier', 'Accorder la grâce', [st('popularity', 2), st('credibility', -1), seg('populaires', 2)], 'Un geste salué par les uns, dénoncé par les magistrats.'),
      ch('refuser', 'Laisser la justice suivre son cours', [st('credibility', 2), st('popularity', -1)], 'La séparation des pouvoirs, rien que la séparation des pouvoirs.'),
    ] };
  } },
  { key: 'armement', offices: ['elysee', 'gouv'], build: (d, rng) => {
    const p = rng.pick(PARTNERS);
    return { title: `Un contrat d’armement avec ${p}`, context: `Quarante avions de combat, huit milliards d’euros, des milliers d’emplois. Mais ${p} est critiqué pour sa politique intérieure.`, choices: [
      ch('signer', 'Signer le contrat', [{ kind: 'economy', unemployment: -0.06, confidence: 2 }, st('credibility', -2), { kind: 'intl', prestige: 1 }], 'Les usines tourneront à plein pendant dix ans. Les ONG, elles, protestent.'),
      ch('conditions', 'Signer, sous conditions de droits humains', [{ kind: 'economy', confidence: 1 }, st('credibility', 1), st('politicalCapital', -4)], 'Les négociations s’éternisent ; le contrat est réduit de moitié.'),
      ch('refuser', 'Refuser', [st('credibility', 3), { kind: 'economy', confidence: -2 }, seg('populaires', -1)], 'Un geste moral salué à l’étranger. Les syndicats de l’industrie grincent.'),
    ] };
  } },
  { key: 'rachat', offices: ['elysee', 'gouv', 'couronne'], build: (d, rng) => {
    const c = rng.pick(COMPANIES);
    return { title: `${c} convoitée par un fonds étranger`, context: `Un fonds d’investissement étranger veut racheter ${c}, fleuron industriel de 12 000 salariés. Bercy attend une consigne.`, choices: [
      ch('bloquer', 'Bloquer la vente au nom de la souveraineté', [seg('populaires', 2), { kind: 'economy', confidence: -2 }, st('popularity', 1)], 'Le fonds se retire en protestant. Les salariés applaudissent.'),
      ch('capital', 'Faire entrer l’État au capital', [{ kind: 'economy', deficit: 0.05 }, seg('populaires', 1), st('credibility', 1)], 'L’État devient actionnaire de référence. La facture est salée.'),
      ch('laisser', 'Laisser faire le marché', [seg('cadres', 2), seg('populaires', -2), { kind: 'economy', confidence: 2 }], 'La vente est signée. Le siège partira-t-il à l’étranger ?'),
    ] };
  } },
  { key: 'arbitrage', offices: ['elysee', 'gouv'], build: (d, rng) => {
    const [a, b] = [...MINISTRIES].sort(() => rng.next() - 0.5);
    return { title: `${cap(a[0])} contre ${b[0]}`, context: `Les ministères de ${a[0]} et de ${b[0]} se disputent la même enveloppe de 2 milliards. Personne ne cédera sans votre arbitrage.`, choices: [
      ch('a', `Trancher pour ${a[0]}`, [{ kind: 'dossier', domain: a[1], delta: 3 }, st('influence', 1)], 'Un ministre jubile, l’autre rumine.'),
      ch('b', `Trancher pour ${b[0]}`, [{ kind: 'dossier', domain: b[1], delta: 3 }, st('influence', 1)], 'Un ministre jubile, l’autre rumine.'),
      ch('partager', 'Couper la poire en deux', [st('credibility', -1), st('stress', -1)], 'Chacun repart avec la moitié de ce qu’il voulait. Et le sentiment d’avoir perdu.'),
    ] };
  } },
  { key: 'nomination', offices: ['elysee', 'gouv'], build: (d, rng) => {
    const post = rng.pick(['la présidence d’une grande entreprise publique', 'la tête de la Banque de France', 'l’ambassade de France à Washington', 'la direction de l’Opéra de Paris', 'la présidence du Conseil constitutionnel']);
    const fidele = personName(nameRng(d.seed, `desk:${d.week}:f`), rng.chance(0.5) ? 'f' : 'm');
    const expert = personName(nameRng(d.seed, `desk:${d.week}:e`), rng.chance(0.5) ? 'f' : 'm');
    return { title: `Une nomination : ${post}`, context: `Deux noms circulent pour ${post} : ${fidele}, un·e fidèle de la première heure, et ${expert}, unanimement respecté·e mais indépendant·e.`, choices: [
      ch('fidele', `Nommer ${fidele}`, [st('influence', 2), st('credibility', -2), { kind: 'faction', factionId: '*', delta: 2 }], '« Copinage », titre la presse. Votre camp, lui, est ravi.'),
      ch('expert', `Nommer ${expert}`, [st('credibility', 3), { kind: 'faction', factionId: '*', delta: -1 }], 'Un choix salué partout… sauf dans votre parti.'),
    ] };
  } },
  { key: 'visite', offices: ['elysee', 'couronne', 'gouv'], build: (d, rng) => {
    const r = rng.pick(REGIONS);
    return { title: `Les élus ${de(r)} vous réclament`, context: `Les élus ${de(r)} se plaignent d’être oubliés : aucune visite officielle depuis trois ans. Ils vous invitent pour une journée entière.`, choices: [
      ch('aller', 'Y passer une journée entière', [st('energy', -6), st('popularity', 2), seg('ruraux', 2)], `Une journée dense, des mains serrées, et la presse régionale enchantée.`),
      ch('ministre', 'Y envoyer un ministre', [seg('ruraux', -1)], '« Encore un ministre », soupirent les élus.'),
    ] };
  } },
  { key: 'commemoration', offices: ['elysee', 'couronne'], build: (d, rng) => {
    const a = rng.pick(ANNIVERSARIES);
    return { title: 'Une commémoration à organiser', context: `On célèbre bientôt ${a}. Le protocole propose deux formules.`, choices: [
      ch('grande', 'Une grande cérémonie nationale', [st('popularity', 2), st('energy', -4)], 'Un moment d’émotion partagée. Le discours est salué.'),
      ch('sobre', 'Une cérémonie sobre et un discours écrit', [st('credibility', 1)], 'Digne et discret. Certains auraient voulu plus.'),
    ] };
  } },
  { key: 'conseil_etat', offices: ['elysee', 'gouv'], build: () => ({
    title: 'Un avis sévère du Conseil d’État', context: 'Le Conseil d’État rend un avis très réservé sur votre prochain projet de loi : « fragilité juridique », écrit-il.', choices: [
      ch('reecrire', 'Réécrire le texte', [st('politicalCapital', -4), st('credibility', 2)], 'Trois semaines de retard, mais un texte solide.'),
      ch('passer', 'Passer outre', [st('influence', 1), { kind: 'flagAdd', key: 'ccRisk', delta: 1 }], 'Le texte avance. Le Conseil constitutionnel lira l’avis, lui aussi.'),
    ],
  }) },
  { key: 'lettre', offices: ['elysee', 'couronne', 'gouv'], build: (d, rng) => {
    const r = rng.pick(REGIONS);
    const who = rng.pick(['une infirmière de nuit', 'un boulanger au bord de la faillite', 'une institutrice de village', 'un jeune apprenti', 'une agricultrice']);
    return { title: 'Une lettre qui bouleverse', context: `Parmi les milliers de lettres reçues, celle d’${who} ${de(r)} vous arrête. Elle raconte, sans colère, une vie qui ne tient qu’à un fil.`, choices: [
      ch('inviter', 'L’inviter, en toute discrétion', [st('stress', -3), st('credibility', 1), st('energy', -2)], 'Une heure d’échange, sans caméras. Vous en ressortez changé·e.'),
      ch('publier', 'Lui répondre publiquement', [st('popularity', 2), seg('populaires', 1)], 'Votre réponse émeut le pays. Certains crient à la récupération.'),
    ] };
  } },
  { key: 'sommet_improvise', offices: ['elysee', 'couronne'], build: (d, rng) => {
    const p = rng.pick(PARTNERS);
    return { title: `Une visite surprise d’${p}`, context: `Le dirigeant d’${p} propose de faire escale à Paris la semaine prochaine, pour « parler d’avenir ».`, choices: [
      ch('recevoir', 'Le recevoir avec les honneurs', [{ kind: 'intl', prestige: 2 }, { kind: 'economy', confidence: 1 }, st('energy', -3)], 'Des accords signés, un dîner réussi.'),
      ch('decliner', 'Décliner : l’agenda est plein', [{ kind: 'intl', prestige: -1 }, st('stress', -1)], 'Il ira à Berlin. On vous le fera remarquer.'),
    ] };
  } },
  { key: 'decoration', offices: ['elysee', 'couronne'], build: (d, rng) => {
    const who = rng.pick(['un chanteur populaire récemment mis en examen', 'une cheffe d’entreprise qui délocalise une usine', 'un sportif connu pour ses propos outranciers']);
    return { title: 'Une décoration qui fait polémique', context: `La promotion de la Légion d’honneur comprend ${who}. Une pétition demande le retrait.`, choices: [
      ch('maintenir', 'Maintenir la décoration', [st('credibility', -2), st('influence', 1)], 'La polémique dure une semaine.'),
      ch('retirer', 'Retirer le nom de la liste', [st('credibility', 2), st('influence', -1)], 'Le décoré proteste ; l’opinion approuve.'),
    ] };
  } },
  { key: 'note_conseiller', offices: ['elysee', 'gouv'], build: () => ({
    title: 'La note d’un conseiller fuite', context: 'Une note interne de votre conseiller spécial, au ton méprisant pour « la France des périphéries », fait la une d’un hebdomadaire.', choices: [
      ch('limoger', 'Le limoger dans l’heure', [st('credibility', 2), st('stress', 2), seg('ruraux', 1)], 'Il part en claquant la porte. On salue votre réactivité.'),
      ch('soutenir', 'Le soutenir publiquement', [st('popularity', -3), seg('ruraux', -2), st('influence', 1)], 'La loyauté a un prix. Il est élevé.'),
    ],
  }) },
  { key: 'chateau', offices: ['elysee', 'couronne', 'gouv'], build: (d, rng) => {
    const r = rng.pick(REGIONS.filter(x => !['Guadeloupe', 'La Réunion', 'Corse'].includes(x)));
    return { title: `Un château ${de(r)} à vendre`, context: `Un château classé ${de(r)}, en ruine, va être vendu à un milliardaire étranger qui veut en faire un hôtel de luxe privé.`, choices: [
      ch('preempter', 'Le faire racheter par l’État', [{ kind: 'economy', deficit: 0.02 }, st('popularity', 1), seg('retraites', 1)], 'Le château restera ouvert au public. Encore faut-il le restaurer.'),
      ch('loto', 'Lancer une souscription nationale', [st('popularity', 2), st('energy', -2)], 'Les Français donnent, beaucoup. Le château est sauvé.'),
      ch('vendre', 'Laisser vendre', [{ kind: 'economy', confidence: 1 }, seg('retraites', -1)], 'Il sera magnifiquement restauré… et fermé au public.'),
    ] };
  } },
  { key: 'bal', offices: ['couronne'], build: () => ({
    title: 'Le grand bal du Palais', context: 'Le bal annuel du Palais approche. La liste des invités fait déjà jaser : faut-il inviter des citoyens tirés au sort ?', choices: [
      ch('tirage', 'Inviter cent citoyens tirés au sort', [st('popularity', 3), { kind: 'kingdom', prestige: 1, opposition: -2 }], 'Une boulangère valse avec un ambassadeur : l’image fait le tour du monde.'),
      ch('tradition', 'Respecter la tradition', [{ kind: 'kingdom', prestige: 2, opposition: 2 }], 'Magnifique, et tellement loin du peuple, disent les républicains.'),
    ],
  }) },
  { key: 'cousin', offices: ['couronne'], build: () => ({
    title: 'Un cousin encombrant', context: 'Un lointain cousin de la famille royale a accumulé les dettes de jeu et menace de vendre ses souvenirs à la presse people.', choices: [
      ch('payer', 'Payer ses dettes, discrètement', [{ kind: 'funds', account: 'personal', delta: -15000 }, { kind: 'exposure', delta: 2 }], 'Il se tait. Pour l’instant.'),
      ch('ecarter', 'L’écarter publiquement de la famille', [{ kind: 'kingdom', stabilite: 2 }, st('credibility', 1), st('stress', 2)], 'Un communiqué sec. Il donne une interview le lendemain.'),
    ],
  }) },
  { key: 'pm_remaniement', offices: ['gouv'], build: () => ({
    title: 'Un ministre à bout de souffle', context: 'Un ministre de votre gouvernement enchaîne les gaffes. Les sondages le placent au plus bas ; il refuse de partir.', choices: [
      ch('garder', 'Le garder : la stabilité d’abord', [{ kind: 'government', cohesion: 1 }, st('popularity', -1)], 'Il reste, fragilisé.'),
      ch('remplacer', 'Le remplacer', [{ kind: 'government', cohesion: -2 }, st('popularity', 2), st('credibility', 1)], 'Un mini-remaniement salué par la presse.'),
    ],
  }) },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Chaque mois calme, au sommet de l'État : un ou deux dossiers sur le bureau */
export function monthlyDesk(d: GameState, rng: Rng): void {
  if (d.status !== 'en_cours') return;
  const o = office(d);
  const top = o === 'elysee' || o === 'couronne' || d.player.rankId === 'premier_ministre';
  if (!top) return;
  // Seulement quand il ne se passe (presque) rien
  const busy = d.pendingDecisions.filter(x => !x.tag.startsWith('desk_')).length;
  const crisis = Object.values(d.crises ?? {}).some(Boolean) || !!d.war;
  if (busy >= 3 || (crisis && rng.chance(0.4)) || d.pendingDecisions.some(x => x.tag.startsWith('desk_'))) return;
  const where = o === 'gouv' ? 'gouv' : o;
  const pool = TEMPLATES.filter(t => t.offices.includes(where as 'elysee') && d.week - Number(d.player.flags[`desk_${t.key}`] ?? -99) >= 10);
  const n = busy === 0 ? (rng.chance(0.55) ? 2 : 1) : 1;
  for (const t of [...pool].sort(() => rng.next() - 0.5).slice(0, n)) {
    const b = t.build(d, rng);
    d.player.flags[`desk_${t.key}`] = d.week;
    const dec: Decision = { id: nextId(d, 'dec'), tag: `desk_${t.key}`, week: d.week, deadlineWeek: d.week + 1, source: 'carriere',
      title: `📁 ${b.title}`, context: `${honorific(d)}, ${b.context.charAt(0).toLowerCase()}${b.context.slice(1)}`, choices: b.choices };
    d.pendingDecisions.push(dec);
  }
}

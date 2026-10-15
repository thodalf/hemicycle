import { DOMAINS, DOMAIN_LABELS, Domain, Effect, GameState } from '../models/game.models';
import { MINISTRIES } from './government';
import { pushNews } from './effects';
import { pmDecision } from './cabinet';
import { Rng, clamp } from './rng';
import type { CallOption, PhoneEntry } from './phone';

/* ============================================================
 *  Nommer par téléphone : à l'Élysée, on peut proposer Matignon
 *  ou un ministère à n'importe quel contact du répertoire ; à
 *  Matignon, on compose son équipe ministre par ministre. On
 *  peut aussi limoger un ministre, ou changer de Premier ministre.
 *  La personne appelée peut refuser.
 * ============================================================ */

const EXPERTS = ['Hélène Carrez', 'Marc Vidal-Lenoir', 'Aïcha Benamar', 'Laurent Pichon', 'Sophie Delattre', 'Yves Kermarrec', 'Inès Lacoste', 'Paul-Henri Duval', 'Nadia Ferrière', 'Olivier Grandjean', 'Mathilde Roche', 'Karim Saïdi', 'Bérénice Aubry', 'Thierry Lannoy'];
const MIN_SHORT: Record<Domain, string> = {
  economie: 'Économie', social: 'Travail', ecologie: 'Écologie', securite: 'Intérieur', justice: 'Justice',
  education: 'Éducation', sante: 'Santé', numerique: 'Numérique', territoires: 'Territoires', diplomatie: 'Affaires étrangères',
};

const PM_COOLDOWN = 6;

/** Qui nomme : le président (hors cohabitation), ou le Premier ministre pour les ministres */
function appointer(d: GameState): 'president' | 'pm' | null {
  if ((d.player.rankId === 'president' || d.player.rankId === 'roi') && d.presidency && !d.presidency.cohabitation) return 'president';
  if (d.player.rankId === 'premier_ministre') return 'pm';
  return null;
}

/** La clé qui identifie le gouvernement en place (président + Matignon) */
export function cabinetSalt(d: GameState): string {
  return d.presidential.incumbentName + (d.presidency?.primeMinister ?? '');
}

/** Le nom du ministre choisi par téléphone, s'il y en a un pour ce gouvernement */
export function pickedMinister(d: GameState, dom: Domain): string | undefined {
  const c = d.cabinetPicks;
  return c && c.salt === cabinetSalt(d) ? c.picks[dom] : undefined;
}

function setPick(d: GameState, dom: Domain, name: string): void {
  const salt = cabinetSalt(d);
  if (!d.cabinetPicks || d.cabinetPicks.salt !== salt) d.cabinetPicks = { salt, picks: {} };
  d.cabinetPicks.picks[dom] = name;
  if (d.presidency?.cabinet) d.presidency.cabinet[dom] = name;
}

function personOf(d: GameState, e: PhoneEntry) {
  const npcId = e.key.startsWith('perso:') ? e.key.slice(6) : e.key.startsWith('collegue:') ? e.key.slice(9) : e.key === 'chef' ? d.party.leaderNpcId : null;
  const npc = npcId ? d.npcs.find(n => n.id === npcId) : undefined;
  const contact = e.key.startsWith('contact:') ? d.contacts.find(c => `contact:${c.id}` === e.key) : undefined;
  return { npc, contact };
}

/* ── Les personnages des scénarios au gouvernement ── */

interface ScenMin { hint: string; chance: number; effects: Effect[]; yes: string; no: string; news: string }
const SCEN_MIN: Record<string, ScenMin> = {
  'sc:loge': { hint: 'Un frère au gouvernement : des réseaux précieux, une discrétion menacée.', chance: 0.8, effects: [{ kind: 'lodge', discretion: -6, fraternite: 4 }, { kind: 'stat', stat: 'influence', delta: 2 }], yes: 'J’accepte, mon frère. Le tablier restera au vestiaire.', no: 'Ma place est à l’atelier, pas au conseil des ministres.', news: 'Les réseaux maçonniques se réjouissent discrètement.' },
  'sc:grandmaitre': { hint: 'Le Grand Maître au gouvernement : l’obédience entière derrière vous… et la presse sur votre dos.', chance: 0.6, effects: [{ kind: 'lodge', discretion: -10, fraternite: 6 }, { kind: 'stat', stat: 'influence', delta: 3 }], yes: 'Pour la République, j’accepte.', no: 'L’obédience doit rester hors du pouvoir. C’est non.', news: 'Un Grand Maître ministre : une première qui fait jaser.' },
  'sc:alien': { hint: 'Un extraterrestre ministre : le monde entier vous regarde.', chance: 0.6, effects: [{ kind: 'alien', confiance: 8, panique: 6 }, { kind: 'intl', prestige: 2 }, { kind: 'stat', stat: 'popularity', delta: 2 }], yes: '« ACCEPTE. MINISTÈRE. BUREAU. PETIT. »', no: '« NON. NOUS. OBSERVONS. »', news: 'Première mondiale : un être venu des étoiles au conseil des ministres.' },
  'sc:prince': { hint: 'Le Prince au gouvernement : les royalistes jubilent, les républicains s’étranglent.', chance: 0.7, effects: [{ kind: 'crown', soutien: 5, legitimite: 4 }, { kind: 'stat', stat: 'credibility', delta: -1 }], yes: 'Servir la France est un devoir que mes ancêtres connaissaient bien.', no: 'Un prince ne sert pas sous un président. Pas encore.', news: 'Le prétendant au trône entre au gouvernement de la République.' },
  'sc:redac': { hint: 'Votre rédaction au gouvernement : un communicant de génie, une indépendance perdue.', chance: 0.75, effects: [{ kind: 'stat', stat: 'popularity', delta: 2 }, { kind: 'press', independance: -6 }], yes: 'J’accepte. Je laisse la direction de la rédaction à mon adjointe.', no: 'Un journaliste ne passe pas de l’autre côté. Jamais.', news: 'Un journaliste au gouvernement : ses confrères crient au mélange des genres.' },
  'sc:handler': { hint: 'Votre officier traitant au gouvernement : discret, efficace, inquiétant.', chance: 0.5, effects: [{ kind: 'mole', cover: -6 }, { kind: 'dossier', domain: 'securite', delta: 3 }], yes: 'Ce n’était pas prévu au plan. Mais j’accepte.', no: 'Mon métier, c’est l’ombre. Oubliez ce coup de fil.', news: 'Un ministre au parcours très discret fait son entrée au gouvernement.' },
  'sc:viro': { hint: 'La virologue au gouvernement : la science aux commandes.', chance: 0.8, effects: [{ kind: 'dossier', domain: 'sante', delta: 6 }, { kind: 'stat', stat: 'credibility', delta: 2 }], yes: 'D’accord. Mais je garde un pied au labo.', no: 'Mon labo a besoin de moi plus que votre gouvernement.', news: 'Une virologue reconnue entre au gouvernement.' },
  'sc:cema': { hint: 'La cheffe d’état-major au gouvernement : l’armée applaudit, les antimilitaristes moins.', chance: 0.7, effects: [{ kind: 'dossier', domain: 'securite', delta: 5 }, { kind: 'segment', segment: 'retraites', delta: 2 }], yes: 'À vos ordres. Pour la première fois, c’est moi qui les reçois.', no: 'Ma place est auprès de mes troupes.', news: 'Une générale au gouvernement : l’uniforme rangé au placard.' },
  'sc:dgsi': { hint: 'Le commissaire de la DGSI au gouvernement : il sait tout sur tout le monde.', chance: 0.7, effects: [{ kind: 'dossier', domain: 'securite', delta: 4 }, { kind: 'exposure', delta: -2 }], yes: 'J’accepte. J’ai déjà lu le dossier de chacun de vos ministres.', no: 'Mieux vaut que je reste là où je vois tout.', news: 'Un patron du renseignement au gouvernement.' },
  'sc:pretre': { hint: 'Le Grand Prêtre de l’Aube Noire au gouvernement ? Une très mauvaise idée.', chance: 0.9, effects: [{ kind: 'apocalypse', cult: 8, darkness: 6 }, { kind: 'stat', stat: 'credibility', delta: -3 }], yes: 'L’Aube se lève sur la République. Merci.', no: 'Nous n’avons pas besoin de vos titres pour régner.', news: 'Un mystérieux gourou entre au gouvernement. L’inquiétude monte.' },
  'sc:diable': { hint: 'Monsieur Nicolas au gouvernement : tout réussira… à un prix.', chance: 0.95, effects: [{ kind: 'apocalypse', darkness: 10 }, { kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'stat', stat: 'influence', delta: 3 }], yes: 'Avec un plaisir infini. J’ai toujours aimé l’administration.', no: 'Pas encore. J’ai mieux à faire.', news: 'Un ministre en costume blanc, au sourire inoubliable, fait son entrée.' },
  'sc:coalition': { hint: 'Le partenaire de coalition récompensé : il s’accroche à l’alliance.', chance: 0.9, effects: [{ kind: 'coalition', mood: 15 }], yes: 'Voilà un geste qui scelle notre alliance.', no: 'Mon parti préfère garder sa liberté.', news: 'Le partenaire de coalition obtient un ministère de plus.' },
  'sc:sosie': { hint: 'Votre sosie au gouvernement ? Le pays ne saura plus qui est qui.', chance: 0.7, effects: [{ kind: 'crisis', arc: 'sosie', risk: 6 }, { kind: 'stat', stat: 'popularity', delta: 1 }], yes: '« Ministre ? Mais je l’étais déjà, dans ma tête. »', no: '« Je préfère être vous. »', news: 'Deux visages identiques au conseil des ministres : la photo officielle fait le tour du monde.' },
  'sc:intersyndicale': { hint: 'La porte-parole de l’intersyndicale au gouvernement : la grève vacille.', chance: 0.55, effects: [{ kind: 'crisis', arc: 'greve_generale', gauge: 10 }, { kind: 'segment', segment: 'populaires', delta: 3 }, { kind: 'segment', segment: 'cadres', delta: -2 }], yes: 'J’accepte, si les salaires sont le premier dossier.', no: 'Mon camp, c’est la rue. Pas les ministères.', news: 'La porte-parole de l’intersyndicale entre au gouvernement.' },
  'sc:templiers': { hint: 'La médiéviste au gouvernement : le patrimoine à l’honneur.', chance: 0.8, effects: [{ kind: 'crisis', arc: 'templiers', gauge: 4 }, { kind: 'dossier', domain: 'education', delta: 3 }], yes: 'Un ministère ? Je peux garder ma truelle ?', no: 'La crypte n’attendra pas.', news: 'La découvreuse de la crypte des Templiers entre au gouvernement.' },
  'sc:comete': { hint: 'La directrice de la mission au gouvernement : la science rassure.', chance: 0.6, effects: [{ kind: 'crisis', arc: 'comete', risk: -5 }, { kind: 'stat', stat: 'credibility', delta: 2 }], yes: 'J’accepte, mais je pilote la mission jusqu’au bout.', no: 'Pas avant que la comète soit passée.', news: 'L’astrophysicienne de la mission de déviation entre au gouvernement.' },
  'sc:referendum': { hint: 'L’initiatrice de la pétition au gouvernement : la société civile au pouvoir.', chance: 0.65, effects: [{ kind: 'crisis', arc: 'referendum', gauge: 6 }, { kind: 'segment', segment: 'populaires', delta: 2 }], yes: 'Si c’est pour porter nos idées, j’accepte.', no: 'Je reste une citoyenne. C’est ma force.', news: 'L’initiatrice du référendum citoyen devient ministre.' },
  'sc:seisme': { hint: 'Le colonel des secours au gouvernement : l’homme du terrain.', chance: 0.65, effects: [{ kind: 'crisis', arc: 'seisme', gauge: 6 }, { kind: 'dossier', domain: 'securite', delta: 3 }], yes: 'À vos ordres. Mais je garde mon casque au bureau.', no: 'Pas tant que le dernier sinistré n’est pas relogé.', news: 'Le chef des secours du séisme entre au gouvernement.' },
  'sc:loto': { hint: 'Votre notaire au gouvernement : rigueur et discrétion.', chance: 0.5, effects: [{ kind: 'dossier', domain: 'economie', delta: 3 }, { kind: 'exposure', delta: 1 }], yes: 'Ministre ? À mon âge ? Soit, mais je relis tout.', no: 'Je préfère les actes notariés aux décrets.', news: 'Une notaire de province fait son entrée au gouvernement.' },
  'sc:penurie': { hint: 'La présidente des pharmaciens au gouvernement : du concret contre la pénurie.', chance: 0.7, effects: [{ kind: 'crisis', arc: 'penurie_medicaments', gauge: 6 }, { kind: 'dossier', domain: 'sante', delta: 4 }], yes: 'D’accord. Mais je garde ma blouse au ministère.', no: 'Mes confrères ont besoin de moi en officine.', news: 'Une pharmacienne entre au gouvernement pour régler la pénurie.' },
  'sc:pandas': { hint: 'La soigneuse des pandas au gouvernement : la diplomatie du bambou.', chance: 0.55, effects: [{ kind: 'crisis', arc: 'pandas', gauge: 6 }, { kind: 'dossier', domain: 'diplomatie', delta: 2 }], yes: 'Ministre ? D’accord, si je peux leur rendre visite chaque matin.', no: 'Les pandas ont besoin de moi.', news: 'La soigneuse des pandas entre au gouvernement.' },
  'sc:coupe': { hint: 'Le patron du Mondial aux Sports : l’homme qui connaît chaque stade.', chance: 0.7, effects: [{ kind: 'crisis', arc: 'coupe_monde', gauge: 6 }, { kind: 'dossier', domain: 'education', delta: 2 }], yes: 'Ministre des Sports pendant le Mondial ? C’est un rêve d’enfant.', no: 'Après la finale, peut-être.', news: 'Le président du comité du Mondial devient ministre.' },
  'sc:jubile': { hint: 'Le grand chambellan au gouvernement : l’étiquette au service de l’État.', chance: 0.5, effects: [{ kind: 'crisis', arc: 'jubile', gauge: 5 }, { kind: 'kingdom', prestige: 2 }], yes: 'Ce serait un honneur, Majesté.', no: 'Ma place est au Palais, Majesté.', news: 'Le grand chambellan entre au gouvernement.' },
  'sc:diamants': { hint: 'Votre avocate à la Justice : la meilleure défense, c’est le ministère.', chance: 0.5, effects: [{ kind: 'crisis', arc: 'diamants', gauge: 5 }, { kind: 'dossier', domain: 'justice', delta: 3 }], yes: 'Garde des Sceaux ? Je ne plaiderai plus pour vous, alors.', no: 'Je vous serai plus utile au barreau.', news: 'L’avocate de l’affaire des diamants entre au gouvernement.' },
  'sc:ours': { hint: 'La bergère de l’Ariège à l’Agriculture : la voix de la montagne.', chance: 0.6, effects: [{ kind: 'crisis', arc: 'ours', gauge: 6 }, { kind: 'segment', segment: 'ruraux', delta: 3 }], yes: 'Ministre ? Il faudra que quelqu’un garde mes brebis.', no: 'La montagne a besoin de moi.', news: 'Une bergère ariégeoise devient ministre.' },
  'sc:essence': { hint: 'Le syndicaliste de la raffinerie au Travail : la paix sociale par l’exemple.', chance: 0.4, effects: [{ kind: 'crisis', arc: 'penurie_essence', gauge: 6, risk: -4 }, { kind: 'segment', segment: 'populaires', delta: 3 }], yes: 'Ministre ? Mes camarades ne vont pas me croire. J’accepte, pour eux.', no: 'Ma place est sur le piquet de grève.', news: 'Un syndicaliste de raffinerie entre au gouvernement.' },
  'sc:culture': { hint: 'La directrice artistique à la Culture : l’énergie d’une année capitale.', chance: 0.65, effects: [{ kind: 'crisis', arc: 'capitale_culture', gauge: 6 }, { kind: 'stat', stat: 'popularity', delta: 1 }], yes: 'Ministre de la Culture ? Seulement si je garde ma programmation.', no: 'Le festival ne se programmera pas tout seul.', news: 'La directrice de la capitale de la culture devient ministre.' },
  'sc:canicule': { hint: 'L’urgentiste de Montpellier à la Santé : quelqu’un qui connaît le terrain.', chance: 0.55, effects: [{ kind: 'crisis', arc: 'canicule', gauge: 6, risk: -3 }, { kind: 'dossier', domain: 'sante', delta: 4 }], yes: 'Ministre ? Si je peux encore faire une garde par mois, d’accord.', no: 'Mes patients ont besoin de moi ici.', news: 'Une urgentiste devient ministre en pleine canicule.' },
  'sc:hacker': { hint: 'La cheffe de la cellule cyber au Numérique : la sécurité avant tout.', chance: 0.5, effects: [{ kind: 'crisis', arc: 'hacker', gauge: 6 }, { kind: 'dossier', domain: 'numerique', delta: 4 }], yes: 'J’accepte. Et je change tous vos mots de passe dès lundi.', no: 'La traque n’est pas finie.', news: 'La cheffe de la cellule cyber entre au gouvernement.' },
  'sc:barons': { hint: 'Le chef des barons au gouvernement : la sécession désamorcée.', chance: 0.5, effects: [{ kind: 'crisis', arc: 'barons', gauge: 8, risk: -5 }, { kind: 'cohesion', delta: 3 }], yes: 'Un ministère ? Voilà enfin du respect pour les territoires.', no: 'Lyon a besoin de son maire.', news: 'Le chef de file des barons entre au gouvernement.' },
  'sc:debat': { hint: 'La garante du grand débat au gouvernement : la parole citoyenne aux commandes.', chance: 0.6, effects: [{ kind: 'crisis', arc: 'grand_debat', gauge: 6 }, { kind: 'stat', stat: 'credibility', delta: 1 }], yes: 'J’accepte, si chaque mesure du débat est tenue.', no: 'Ma neutralité est ma force.', news: 'La garante du grand débat devient ministre.' },
  'sc:tour': { hint: 'L’ingénieure de la tour Eiffel au gouvernement : la compétence avant tout.', chance: 0.55, effects: [{ kind: 'crisis', arc: 'tour_eiffel', gauge: 6, risk: -2 }, { kind: 'stat', stat: 'credibility', delta: 1 }], yes: 'J’accepte, si la tour reste ma priorité.', no: 'Je ne quitte pas mon chantier.', news: 'L’ingénieure qui sauve la tour Eiffel entre au gouvernement.' },
  'sc:baleine': { hint: 'Le capitaine du sauvetage au gouvernement : le héros du moment.', chance: 0.5, effects: [{ kind: 'crisis', arc: 'baleine', gauge: 6 }, { kind: 'stat', stat: 'popularity', delta: 2 }], yes: 'À vos ordres. Mais d’abord, la baleine.', no: 'Ma place est sur l’eau.', news: 'Le capitaine du sauvetage de la baleine devient ministre.' },
  'sc:mariage': { hint: 'Une comtesse étrangère au gouvernement : audacieux.', chance: 0.25, effects: [{ kind: 'crisis', arc: 'mariage_princier', gauge: 5, risk: -2 }, { kind: 'intl', prestige: 1 }], yes: 'Comme c’est original. J’accepte, pour la beauté du geste.', no: 'Je sers une couronne, pas une République.', news: 'La cheffe du protocole de Valmorie… ministre en France.' },
  'sc:cathedrale': { hint: 'L’architecte de la cathédrale au gouvernement : le patrimoine aux commandes.', chance: 0.5, effects: [{ kind: 'crisis', arc: 'cathedrale', gauge: 6, risk: -2 }, { kind: 'stat', stat: 'credibility', delta: 1 }], yes: 'J’accepte, à condition de garder un pied sur le chantier.', no: 'La flèche d’abord, les ministères ensuite.', news: 'L’architecte de la cathédrale entre au gouvernement.' },
  'sc:punaises': { hint: 'L’entomologiste au gouvernement : la science contre la psychose.', chance: 0.6, effects: [{ kind: 'crisis', arc: 'punaises', gauge: 6, risk: -3 }], yes: 'J’accepte. Et je garde ma loupe.', no: 'Mon laboratoire a besoin de moi.', news: 'La cheffe du plan contre les punaises de lit devient ministre.' },
  'sc:esport': { hint: 'La capitaine de l’équipe de France au gouvernement : un coup de jeune.', chance: 0.3, effects: [{ kind: 'crisis', arc: 'esport', gauge: 5 }, { kind: 'segment', segment: 'jeunes', delta: 4 }, { kind: 'stat', stat: 'credibility', delta: -2 }], yes: 'Sérieux ? GG. J’accepte !', no: 'Après la finale, peut-être. Là, je m’entraîne.', news: 'Une championne d’e-sport de 23 ans entre au gouvernement.' },
  'sc:satellite': { hint: 'La directrice des opérations spatiales au gouvernement : la science au pouvoir.', chance: 0.55, effects: [{ kind: 'crisis', arc: 'satellite', gauge: 6, risk: -3 }, { kind: 'stat', stat: 'credibility', delta: 1 }], yes: 'J’accepte. Après la rentrée du satellite.', no: 'Je ne quitte pas le centre de contrôle.', news: 'La directrice des opérations spatiales devient ministre.' },
  'sc:casse': { hint: 'Le commissaire du casse au gouvernement : l’ordre et la méthode.', chance: 0.4, effects: [{ kind: 'crisis', arc: 'casse', gauge: 6, risk: -2 }, { kind: 'dossier', domain: 'securite', delta: 3 }], yes: 'Un ministère ? Je finis d’abord mon enquête.', no: 'Je suis flic, pas politique.', news: 'Le commissaire du casse du siècle entre au gouvernement.' },
  'sc:vin': { hint: 'La présidente des vignerons au gouvernement : la ruralité aux commandes.', chance: 0.5, effects: [{ kind: 'crisis', arc: 'vin', gauge: 6, risk: -3 }, { kind: 'segment', segment: 'ruraux', delta: 3 }], yes: 'J’accepte, pour les vignes et ceux qui les travaillent.', no: 'Ma place est dans les rangs de vigne.', news: 'La présidente des vignerons devient ministre.' },
  'sc:nuage': { hint: 'La toxicologue au gouvernement : la santé environnementale aux commandes.', chance: 0.55, effects: [{ kind: 'crisis', arc: 'nuage', gauge: 6, risk: -3 }, { kind: 'dossier', domain: 'sante', delta: 3 }], yes: 'J’accepte, si je peux continuer à tout publier.', no: 'Mon indépendance est ma crédibilité.', news: 'La toxicologue du nuage toxique devient ministre.' },
  'sc:taxis': { hint: 'Le porte-parole des taxis au gouvernement : un geste fort envers les chauffeurs.', chance: 0.35, effects: [{ kind: 'crisis', arc: 'taxis', gauge: 4, risk: -5 }, { kind: 'segment', segment: 'populaires', delta: 3 }], yes: 'Ministre ? Mes collègues vont halluciner. J’accepte.', no: 'Ma place est au volant, pas dans un bureau.', news: 'Le porte-parole des chauffeurs de taxi entre au gouvernement.' },
  'sc:fusion': { hint: 'La directrice du laboratoire au gouvernement : la science au cœur de l’État.', chance: 0.5, effects: [{ kind: 'crisis', arc: 'fusion', gauge: 6, risk: -2 }, { kind: 'stat', stat: 'credibility', delta: 2 }], yes: 'J’accepte, à condition que le programme soit sanctuarisé.', no: 'Le réacteur a besoin de moi plus que le gouvernement.', news: 'La pionnière de la fusion nucléaire devient ministre.' },
  'sc:train': { hint: 'L’ingénieur du train magnétique au gouvernement : le futur aux commandes.', chance: 0.6, effects: [{ kind: 'crisis', arc: 'train_futur', gauge: 6 }, { kind: 'dossier', domain: 'territoires', delta: 3 }], yes: 'Ministre ? Seulement si je peux garder un bureau dans le hangar.', no: 'Le train ne se finira pas tout seul.', news: 'L’ingénieur du train magnétique devient ministre.' },
  'sc:eurovision': { hint: 'Le producteur de l’Eurovision au gouvernement : paillettes garanties.', chance: 0.8, effects: [{ kind: 'segment', segment: 'jeunes', delta: 3 }, { kind: 'crisis', arc: 'eurovision', gauge: 3 }], yes: 'Fabuleux ! Je fais refaire la salle du conseil.', no: 'Après la finale, peut-être. Pas avant.', news: 'Le producteur de l’Eurovision devient ministre.' },
};

function scenKey(key: string): string {
  return key.startsWith('sc:anx_') ? 'sc:anx' : key;
}

/** Le nom inscrit au gouvernement (sans la fonction) */
function ministerName(e: PhoneEntry): string {
  return e.name.split(' · ')[0];
}

/** Les options « nommer » ajoutées aux appels */
export function appointOptions(d: GameState, e: PhoneEntry, block?: string): CallOption[] {
  const who = appointer(d);
  if (!who) return [];
  const out: CallOption[] = [];
  const monthBusy = Number(d.player.flags['appointWeek'] ?? -99) === d.week ? 'Déjà un remaniement ce mois-ci' : undefined;
  const pmBusy = d.week - Number(d.player.flags['pmChangeWeek'] ?? -99) < PM_COOLDOWN ? 'Matignon vient de changer : attendez quelques mois' : undefined;
  const { npc, contact } = personOf(d, e);

  // Un membre du gouvernement : le limoger
  if (e.kind === 'gouvernement') {
    if (e.key === 'gouv:pm' && who === 'president') {
      out.push({ id: 'limoger', label: '🏛️ Demander sa démission à Matignon', hint: 'Vous choisirez aussitôt un nouveau Premier ministre. Le sortant ne vous le pardonnera pas.', ok: !block && !pmBusy, reason: block ?? pmBusy });
    } else if (e.key.startsWith('gouv:') && e.key !== 'gouv:pr' && e.key !== 'gouv:pm') {
      out.push({ id: 'limoger', label: '✂️ Lui retirer son portefeuille', hint: 'Un·e expert·e prend sa place. Un ministre limogé fait rarement un allié.', ok: !block && !monthBusy, reason: block ?? monthBusy });
    }
    return out;
  }

  const scen = e.kind === 'scenario';
  if (!npc && !contact && !scen) return out;
  if (npc && npc.id === d.presidency?.pmNpcId) return out;
  if (who === 'president' && !scen) {
    const isPm = npc ? d.presidency?.pmNpcId === npc.id : d.presidency?.primeMinister === e.name;
    if (!isPm) out.push({ id: 'nommer_pm', label: '🏛️ Lui proposer Matignon', hint: npc && npc.partyId !== d.party.id ? 'Un Premier ministre venu d’un autre parti : majorité élargie, parti furieux.' : contact ? 'La société civile à Matignon : audace saluée, majorité fragile.' : 'Un Premier ministre de votre camp. Il ou elle peut refuser.', ok: !block && !pmBusy, reason: block ?? pmBusy });
  }
  const nm = ministerName(e);
  const cur = new Set(DOMAINS.filter(dom => pickedMinister(d, dom) === nm || d.presidency?.cabinet?.[dom] === nm));
  for (const dom of DOMAINS) {
    out.push({
      id: `min_${dom}`, label: `💼 ${MIN_SHORT[dom]}`, chip: MIN_SHORT[dom], group: 'ministere',
      hint: scen ? `${SCEN_MIN[scenKey(e.key)]?.hint ?? 'Une figure de votre aventure au gouvernement : audace garantie.'} Ministère ${MINISTRIES[dom]}.` : `Lui confier le ministère ${MINISTRIES[dom]}.`,
      ok: !block && !monthBusy && !cur.has(dom), reason: block ?? monthBusy ?? (cur.has(dom) ? 'Déjà à ce poste' : undefined),
    });
  }
  return out;
}

export function isAppoint(id: string): boolean {
  return id === 'nommer_pm' || id === 'limoger' || id.startsWith('min_');
}

const st = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });

/** Le résultat d'un appel « nommer » */
export function appointCall(d: GameState, e: PhoneEntry, id: string, rng: Rng): { answer: string; effects: Effect[]; notes: string[] } {
  const { npc, contact } = personOf(d, e);
  const pres = d.presidency;
  const notes: string[] = [];
  const effects: Effect[] = [];

  if (id === 'limoger') {
    if (e.key === 'gouv:pm' && pres) {
      const old = pres.pmNpcId ? d.npcs.find(n => n.id === pres.pmNpcId) : undefined;
      if (old) effects.push({ kind: 'npcRelation', npcId: old.id, delta: -20 });
      d.player.flags['pmChangeWeek'] = d.week;
      if (!d.pendingDecisions.some(x => x.tag === 'nommer_pm')) d.pendingDecisions.push(pmDecision(d));
      effects.push({ kind: 'presidency', approval: -1 }, st('politicalCapital', -6));
      pushNews(d, 'actu', 'neutral', `${e.name} quitte Matignon`, 'Le Premier ministre remet sa démission à l’issue d’un entretien téléphonique « franc et direct ». Le nom de son successeur est attendu.');
      return { answer: rng.pick(['Je l’ai compris depuis des semaines. Ma lettre sera sur votre bureau ce soir.', 'C’est une erreur. Mais je respecte vos institutions. Et je m’en souviendrai.', 'Très bien. Je vous souhaite bonne chance avec mon successeur.']), effects, notes: ['À choisir : le nouveau Premier ministre'] };
    }
    const dom = e.key.slice(5) as Domain;
    const old = d.npcs.find(n => n.name === e.name);
    if (old) effects.push({ kind: 'npcRelation', npcId: old.id, delta: -15 });
    const repl = rng.pick(EXPERTS.filter(x => x !== e.name));
    setPick(d, dom, repl);
    d.player.flags['appointWeek'] = d.week;
    effects.push(st('credibility', 1), st('politicalCapital', -3), ...(pres ? [{ kind: 'presidency', approval: 1 } as Effect] : []));
    pushNews(d, 'actu', 'neutral', `Remaniement : ${repl} ministre ${MINISTRIES[dom]}`, `${e.name} quitte le gouvernement après un coup de téléphone. ${repl}, réputé·e pour sa rigueur, prend le portefeuille.`);
    return { answer: rng.pick(['Vous auriez pu me le dire en face.', 'Je m’y attendais. Je rends les clés demain matin.', 'Après tout ce que j’ai fait pour vous ? Très bien.']), effects, notes: [`${repl} remplace ${e.name}`] };
  }

  // Un personnage de scénario au gouvernement
  if (e.kind === 'scenario' && id.startsWith('min_')) {
    const dom = id.slice(4) as Domain;
    const prof = SCEN_MIN[scenKey(e.key)];
    const nm = ministerName(e);
    if (!rng.chance(prof?.chance ?? 0.7)) return { answer: prof?.no ?? 'Merci, mais ce n’est pas pour moi.', effects: [st('stress', 1)], notes: ['Proposition déclinée'] };
    setPick(d, dom, nm);
    d.player.flags['appointWeek'] = d.week;
    effects.push(st('politicalCapital', -4), ...(prof?.effects ?? [{ kind: 'dossier', domain: dom, delta: 3 } as Effect, st('popularity', 1)]));
    pushNews(d, 'actu', 'neutral', `${nm}, ministre ${MINISTRIES[dom]}`, prof?.news ?? `Une nomination inattendue : ${nm} rejoint le gouvernement.`);
    return { answer: prof?.yes ?? 'J’accepte. Je n’aurais jamais cru vivre ça.', effects, notes: [`${nm} ministre ${MINISTRIES[dom]}`] };
  }

  // Acceptera-t-il ?
  const rel = npc ? npc.relationToPlayer : contact ? contact.trust - 20 : 0;
  const same = npc?.partyId === d.party.id;
  const chance = clamp(0.5 + rel / 120 + (same ? 0.2 : 0) + (id === 'nommer_pm' ? 0.1 : 0), 0.1, 0.96);
  if (!rng.chance(chance)) {
    effects.push(st('stress', 2), ...(npc ? [{ kind: 'npcRelation', npcId: npc.id, delta: -2 } as Effect] : []));
    return {
      answer: rng.pick(npc && rel < -10 ? ['Sous vos ordres ? Jamais.', 'Vous croyez m’acheter avec un maroquin ? Non merci.'] : ['C’est un honneur… mais je dois refuser. Ma famille, vous comprenez.', 'Laissez-moi y réfléchir. Non, en fait : c’est non.', 'Je suis plus utile là où je suis.']),
      effects, notes: ['Proposition déclinée'],
    };
  }

  if (id === 'nommer_pm' && pres) {
    d.player.flags['pmChangeWeek'] = d.week;
    const prevNpc = pres.pmNpcId ? d.npcs.find(n => n.id === pres.pmNpcId) : undefined;
    if (prevNpc) effects.push({ kind: 'npcRelation', npcId: prevNpc.id, delta: -12 });
    effects.push({ kind: 'presidency', pmName: e.name, ...(npc ? { pmNpcId: npc.id } : {}), approval: 1 }, st('politicalCapital', -8));
    if (npc) {
      effects.push({ kind: 'npcRelation', npcId: npc.id, delta: 15 }, { kind: 'npcStat', npcId: npc.id, stat: 'influence', delta: 6 });
      if (same) effects.push({ kind: 'cohesion', delta: 2 });
      else effects.push({ kind: 'presidency', majority: 5 }, { kind: 'cohesion', delta: -5 });
    } else if (contact) {
      effects.push({ kind: 'presidency', majority: -3, approval: 3 }, { kind: 'contact', contactId: contact.id, trust: 10 }, st('popularity', 2));
    }
    pushNews(d, 'actu', 'neutral', `${e.name} nommé·e à Matignon`, `Un coup de téléphone, un oui, et un décret au Journal officiel : ${e.name} devient Premier ministre.`);
    return { answer: rng.pick(['C’est oui. Je serai à Matignon demain à l’aube.', 'Je ne m’y attendais pas… J’accepte. Vous ne le regretterez pas.', 'Oui. À une condition : qu’on me laisse gouverner.']), effects, notes: [`${e.name} Premier ministre`] };
  }

  const dom = id.slice(4) as Domain;
  if (!DOMAINS.includes(dom)) return { answer: 'Pardon ? La ligne a coupé.', effects, notes };
  const prevName = pickedMinister(d, dom) ?? pres?.cabinet?.[dom];
  const prev = prevName ? d.npcs.find(n => n.name === prevName) : undefined;
  if (prev && prev.id !== npc?.id) effects.push({ kind: 'npcRelation', npcId: prev.id, delta: -10 });
  setPick(d, dom, e.name);
  d.player.flags['appointWeek'] = d.week;
  effects.push(st('politicalCapital', d.player.rankId === 'premier_ministre' ? -6 : -4));
  if (npc) {
    effects.push({ kind: 'npcRelation', npcId: npc.id, delta: 12 }, { kind: 'npcStat', npcId: npc.id, stat: 'influence', delta: 4 });
    if (!same) effects.push(...(pres ? [{ kind: 'presidency', majority: 3 } as Effect] : [{ kind: 'government', majority: 3 } as Effect]), { kind: 'cohesion', delta: -3 });
    else effects.push({ kind: 'cohesion', delta: 1 });
  } else if (contact) {
    effects.push({ kind: 'contact', contactId: contact.id, trust: 8 }, { kind: 'dossier', domain: dom, delta: contact.domain === dom ? 6 : 2 }, st('popularity', 1));
  }
  pushNews(d, 'actu', 'neutral', `${e.name}, ministre ${MINISTRIES[dom]}`, `Nomination surprise par téléphone : ${e.name} hérite du portefeuille ${DOMAIN_LABELS[dom].toLowerCase()}.`);
  return { answer: rng.pick(['J’accepte. Je serai au ministère dès lundi.', 'Ministre ? Moi ? … Oui. Oui, évidemment.', 'Merci de votre confiance. Je ne vous décevrai pas.']), effects, notes: [`${e.name} ministre ${MINISTRIES[dom]}`] };
}

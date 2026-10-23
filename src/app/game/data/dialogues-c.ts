import { DOMAIN_LABELS, Domain, Effect, GameState, Segment } from '../models/game.models';
import { DialogueDef, contactSpeaker, familySpeaker, guestSpeaker, mem, rankAtLeast, st, teamSpeaker } from './dialogue-types';

/* ============================================================
 *  Conversations à embranchements — lot C : le pouvoir.
 *  Ministres, Matignon, l'Élysée, la tête du parti, la campagne
 *  présidentielle. Les traces en mémoire (préfixe c_) se
 *  répondent d'une conversation à l'autre : la note enterrée
 *  ressort à la Cour des comptes, le cadeau au grand patron
 *  inquiète la gouverneure et resurgit la veille du débat, le
 *  soutien à la Valdovie pèse sur les stocks de munitions et
 *  sur le sommet européen, l'ancien mentor fait les comptes.
 * ============================================================ */

/* ── Petits outils ───────────────────────────────────────── */

const gov = (x: { majority?: number; cohesion?: number }): Effect => ({ kind: 'government', ...x });
const pres = (x: { approval?: number; majority?: number }): Effect => ({ kind: 'presidency', ...x });
const eco = (x: { growth?: number; unemployment?: number; deficit?: number; inflation?: number; confidence?: number }): Effect => ({ kind: 'economy', ...x });
const seg = (segment: Segment, delta: number): Effect => ({ kind: 'segment', segment, delta });
const dos = (domain: Domain, delta: number): Effect => ({ kind: 'dossier', domain, delta });
const expo = (delta: number): Effect => ({ kind: 'exposure', delta });
const coh = (delta: number): Effect => ({ kind: 'cohesion', delta });
const prestige = (delta: number): Effect => ({ kind: 'intl', prestige: delta });
const tension = (delta: number): Effect => ({ kind: 'intl', tension: delta });
const rel = (partner: string, relation: number): Effect => ({ kind: 'intl', partner, relation });
const hostile = (enemy: string, delta: number): Effect => ({ kind: 'hostile', enemy, delta });
const mood = (delta: number): Effect => ({ kind: 'coalition', mood: delta });
const morale = (delta: number): Effect => ({ kind: 'team', recruitId: '$speaker', morale: delta });
const trust = (delta: number): Effect => ({ kind: 'contact', contactId: '$speaker', trust: delta });
const momentum = (delta: number): Effect => ({ kind: 'momentum', delta });

const fem = (d: GameState) => d.player.gender === 'femme';
const hasRole = (d: GameState, role: string) => d.player.team.some(r => r.role === role);
const titrePM = (d: GameState) => (fem(d) ? 'Madame la Première ministre' : 'Monsieur le Premier ministre');
const titrePR = (d: GameState) => (fem(d) ? 'Madame la Présidente' : 'Monsieur le Président');
const auPouvoir = (d: GameState) => !!d.presidency || !!d.government;

/** Ce que l'ancien mentor a appris de vous (les traces des autres conversations) */
function griefs(d: GameState): string[] {
  const out: string[] = [];
  if (mem(d, 'c_note_enterree')) out.push('une note sur un barrage qu’on aurait fait disparaître');
  if (mem(d, 'c_cac_cede')) out.push('tes cadeaux fiscaux aux grands groupes');
  if (mem(d, 'c_fuiteur_agent')) out.push('des fausses fuites organisées depuis ton bureau');
  if (mem(d, 'c_frondeur_menace')) out.push('des députés menacés comme des stagiaires');
  if (mem(d, 'c_porte_parole_sacrifiee')) out.push('une porte-parole sacrifiée pour une phrase');
  if (mem(d, 'c_gouverneur_menacee')) out.push('des pressions sur la Banque de France');
  if (mem(d, 'c_prefet_lache')) out.push('un préfet lâché devant les caméras');
  return out.slice(0, 3);
}

export const DIALOGUES_C: DialogueDef[] = [
  // ── 1. Un ministre veut démissionner avec fracas (Matignon) ──
  {
    id: 'c_ministre_fracas', weight: 1,
    eligible: d => !!d.government && d.player.rankId === 'premier_ministre',
    who: guestSpeaker('c_fabregat', 'Gilles Fabregat', 'Ministre de l’Agriculture'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `${titrePM(d)}, je vous préviens par courtoisie : ma lettre de démission part demain matin. Votre arbitrage sur les pesticides est une trahison des paysans, et je compte l’expliquer au journal de 20 h.`,
        choices: [
          { id: 'rouvrir', label: 'Je rouvre l’arbitrage, restez', hint: 'Les autres ministres grinceront', effects: [st('politicalCapital', -4), seg('ruraux', 2), gov({ cohesion: -1 })], remember: { c_fabregat_retenu: 1 }, next: 'conditions' },
          { id: 'discret', label: 'Partez si vous voulez, mais sans esclandre', effects: [st('stress', 1)], next: 'sortie_digne' },
          { id: 'laisser', label: 'Allez au 20 h, je répondrai', hint: 'La majorité va tanguer', effects: [gov({ cohesion: -4, majority: -2 }), st('credibility', 2)], remember: { c_ministre_fracas: 1 }, end: 'Très bien. Vous aurez de mes nouvelles, et les Français aussi.', later: { months: 5, node: 'livre' } },
        ],
        ignore: [gov({ cohesion: -3 }), st('stress', 2)],
      },
      conditions: {
        text: 'Merci. Mais je veux un geste concret : une enveloppe de 300 millions pour les exploitations en difficulté, annoncée par moi, dans ma région.',
        choices: [
          { id: 'accorder', label: 'Accordé : c’est votre victoire', hint: 'Bercy fera la grimace', effects: [eco({ deficit: 0.05 }), seg('ruraux', 3), st('politicalCapital', -2)], end: 'Vous ne le regretterez pas. Les campagnes s’en souviendront.', later: { months: 6, node: 'reconnaissance' } },
          { id: 'moitie', label: 'La moitié, et c’est moi qui l’annonce', hint: 'Il peut claquer la porte', effects: [eco({ deficit: 0.02 }), st('influence', 2)], risk: { chance: 0.4, scaleWith: 'influence', fail: 'claque' }, end: 'Vous êtes dur·e en affaires. Va pour la moitié.' },
          { id: 'rien', label: 'Rien de plus. Restez ou partez', effects: [st('credibility', 1)], next: 'claque' },
        ],
      },
      sortie_digne: {
        text: 'Sans esclandre ? Alors je veux une sortie digne : une mission parlementaire sur l’avenir de l’agriculture, et votre silence sur nos désaccords.',
        choices: [
          { id: 'mission', label: 'Va pour la mission', effects: [gov({ cohesion: -1 }), st('politicalCapital', -2)], remember: { c_fabregat_mission: 1 }, end: 'Marché conclu. Je partirai sur la pointe des pieds.' },
          { id: 'communique', label: 'Pas de mission : un communiqué sobre', effects: [st('politicalCapital', 1)], risk: { chance: 0.5, scaleWith: 'credibility', fail: 'claque' }, end: 'Soit. Deux lignes, et on n’en parle plus.' },
        ],
      },
      claque: {
        text: 'Très bien. Je démissionne, et je ne vais pas me gêner pour expliquer pourquoi. Les caméras m’attendent dans la cour.',
        effects: [gov({ cohesion: -4, majority: -2 }), seg('ruraux', -2)],
        choices: [
          { id: 'bon_vent', label: 'Je vous souhaite bon vent', effects: [st('credibility', 1)], remember: { c_ministre_fracas: 1 }, end: 'Vous aussi. Vous en aurez besoin.', later: { months: 5, node: 'livre' } },
          { id: 'remplacer', label: 'Je nomme votre directeur de cabinet à votre place', hint: 'Il connaît le dossier… et vos secrets', effects: [gov({ cohesion: 2 }), st('politicalCapital', -2)], end: '… Vous avez du culot. Il acceptera, évidemment.' },
        ],
      },
      livre: {
        text: 'Mon livre sort jeudi : « Les Champs du mépris ». Un chapitre entier vous est consacré. Je vous laisse la surprise.',
        effects: [st('popularity', -2), seg('ruraux', -3), expo(3)],
        choices: [
          { id: 'repondre', label: 'Répondre point par point dans la presse', effects: [st('energy', -4), st('credibility', 2), st('stress', 3)], end: 'Faites. Ça fera vendre.' },
          { id: 'syndicats', label: 'Inviter les syndicats agricoles à Matignon', effects: [st('energy', -3), st('politicalCapital', -2), seg('ruraux', 3)], end: 'Habile. Trop tard pour moi, pas pour eux.' },
          { id: 'silence', label: 'Ne rien dire', effects: [st('stress', 2)], end: 'Le silence est un aveu, vous savez.' },
        ],
      },
      reconnaissance: {
        text: 'Les 300 millions sont arrivés dans les fermes. Ma fédération vous salue, et mes amis députés ruraux voteront le budget. Je tiens parole.',
        effects: [gov({ majority: 3 }), seg('ruraux', 2)],
        choices: [
          { id: 'merci', label: 'Merci, Gilles', effects: [st('stress', -1)], end: 'C’est moi qui vous remercie.' },
          { id: 'encore', label: 'J’aurai besoin de vous sur la réforme foncière', effects: [st('politicalCapital', 1)], end: 'Demandez. Pour l’instant, je vous dois bien ça.' },
        ],
      },
    },
  },

  // ── 2. Le directeur de cabinet découvre une note embarrassante ──
  {
    id: 'c_note_cabinet', weight: 1,
    eligible: d => rankAtLeast(d, 3) && hasRole(d, 'chef_cabinet') && (!!d.portfolio || auPouvoir(d)),
    who: teamSpeaker('chef_cabinet'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'En classant les archives, une note m’est tombée sous les yeux. Votre prédécesseur y recommandait de « ne pas donner suite » à l’alerte d’un inspecteur sur un barrage, et vous l’avez paraphée à votre arrivée. Le barrage a cédé en partie le mois dernier. Personne d’autre ne l’a vue.',
        choices: [
          { id: 'publier', label: 'On la rend publique nous-mêmes', hint: 'Douloureux, mais on maîtrise le récit', effects: [st('credibility', 3), st('popularity', -3), expo(-3)], remember: { c_note_publiee: 1 }, next: 'publiee' },
          { id: 'enterrer', label: 'Cette note n’a jamais existé', hint: 'Elle peut ressortir', effects: [expo(5), st('stress', 2)], remember: { c_note_enterree: 1 }, next: 'copie' },
          { id: 'inspection', label: 'Saisissez l’inspection générale, discrètement', effects: [st('energy', -3), st('politicalCapital', -2), st('credibility', 1)], end: 'Je m’en occupe. Le rapport prendra des mois : c’est aussi une protection.', later: { months: 6, node: 'rapport_ig' } },
        ],
        ignore: [expo(3)],
      },
      copie: {
        text: 'Entendu. Mais l’inspecteur a gardé une copie. Il vient de prendre sa retraite, et il n’a jamais digéré d’avoir été ignoré.',
        choices: [
          { id: 'acheter', label: 'Proposez-lui une mission bien payée', hint: 'Cela ressemble à un achat de silence', effects: [st('politicalCapital', -3), expo(3)], remember: { c_inspecteur_achete: 1 }, risk: { chance: 0.35, scaleWith: 'influence', fail: 'inspecteur_parle' }, end: 'Il a accepté de présider un comité d’experts. Et il se taira.' },
          { id: 'laisser', label: 'Laissez-le, il n’osera pas', effects: [st('stress', 2)], end: 'Comme vous voudrez. Je garde le dossier sous clé.', later: { months: 7, node: 'inspecteur_parle' } },
          { id: 'appeler', label: 'Je l’appelle moi-même pour m’excuser', effects: [st('energy', -3), st('credibility', 1), expo(-2)], end: 'Il a été touché. Il demande seulement qu’on répare le barrage, vite.' },
        ],
      },
      publiee: {
        text: 'Le communiqué est parti. Les éditorialistes saluent « un rare courage », l’opposition réclame votre démission. Les deux à la fois : c’est la vie.',
        choices: [
          { id: 'terrain', label: 'Je vais voir les sinistrés', effects: [st('energy', -5), st('popularity', 3), seg('ruraux', 2)], end: 'Bonne idée. Les bottes sont dans le coffre.' },
          { id: 'plan', label: 'Je lance un plan national pour les barrages', effects: [st('politicalCapital', -3), dos('territoires', 4), eco({ deficit: 0.03 })], end: 'Le plan est sur les rails. Il faudra le suivre de près.', later: { months: 8, node: 'plan_barrages' } },
        ],
      },
      inspecteur_parle: {
        text: d => `L’inspecteur a parlé. Un hebdomadaire publie la note, avec votre paraphe en gros plan, sous le titre « Ils savaient ».${mem(d, 'c_inspecteur_achete') ? ' Pire : il raconte qu’on a voulu acheter son silence.' : ''}`,
        effects: [st('credibility', -6), st('popularity', -3), expo(4)],
        choices: [
          { id: 'assumer', label: 'J’assume et je présente mes excuses', effects: [st('credibility', 2), st('politicalCapital', -3)], end: 'C’est la seule sortie honorable. Je prépare la déclaration.' },
          { id: 'charger', label: 'Je charge mon prédécesseur', effects: [st('credibility', -2), coh(-3)], end: 'Ça tiendra trois jours. Peut-être.' },
        ],
      },
      rapport_ig: {
        text: 'Le rapport de l’inspection est tombé : il pointe des « dysfonctionnements collectifs », sans vous accabler. Vous avez eu raison de le demander.',
        effects: [st('credibility', 3), expo(-2)],
        choices: [
          { id: 'publier', label: 'Publiez-le en intégralité', effects: [st('credibility', 1), st('popularity', 1)], end: 'C’est fait. La presse parle de transparence.' },
          { id: 'garder', label: 'Gardez-le pour nous', effects: [expo(2)], end: 'Noté. Il dort au coffre.' },
        ],
      },
      plan_barrages: {
        text: 'Les premiers chantiers du plan barrages ont démarré. Dans la vallée sinistrée, le maire a fait poser une plaque. Votre nom n’y figure pas, mais tout le monde sait.',
        effects: [st('popularity', 3), seg('ruraux', 2)],
        choices: [
          { id: 'parfait', label: 'Parfait. Classez enfin ce dossier', effects: [st('stress', -2)], end: 'Avec plaisir. Il m’a coûté quelques nuits.' },
          { id: 'inaugurer', label: 'J’irai inaugurer le dernier chantier', effects: [st('energy', -2), st('popularity', 1)], end: 'Je le note dans l’agenda. Le maire sera ravi.' },
        ],
      },
    },
  },

  // ── 3. Un dirigeant étranger écrit en direct ──
  {
    id: 'c_valdovie', weight: 1,
    eligible: d => (!!d.presidency || d.player.rankId === 'premier_ministre') && !d.war,
    who: guestSpeaker('c_valdovie', 'Président Andrej Morava', 'République de Valdovie'),
    start: 'debut',
    nodes: {
      debut: {
        call: true,
        text: 'Pardonnez cet appel direct, sans passer par nos diplomates. Les blindés karstans sont à quarante kilomètres de notre capitale. J’ai besoin de savoir, ce soir, si la France sera à nos côtés.',
        choices: [
          { id: 'soutien', label: 'La France vous livrera du matériel défensif', hint: 'La Karstanie ne l’oubliera pas', effects: [hostile('karstanie', -6), hostile('valdovie', 8), prestige(3), tension(3), eco({ deficit: 0.03 })], remember: { c_valdovie_soutien: 1 }, next: 'merci' },
          { id: 'mediation', label: 'Je propose une médiation à Paris', hint: 'Prestigieux, si ça marche', effects: [st('energy', -4), prestige(2)], remember: { c_valdovie_mediation: 1 }, risk: { chance: 0.5, scaleWith: 'influence', fail: 'mediation_ratee' }, next: 'mediation_ok' },
          { id: 'prudence', label: 'Je ne peux rien promettre ce soir', effects: [prestige(-2), hostile('valdovie', -4)], end: 'Je comprends. L’histoire, elle, retiendra les dates.', later: { months: 5, node: 'rancune' } },
        ],
        ignore: [prestige(-3), hostile('valdovie', -6)],
      },
      merci: {
        text: 'Merci. Mon peuple ne l’oubliera pas. Une question encore : nos services ont des preuves d’ingérence karstane dans vos élections. Voulez-vous que je les rende publiques ?',
        choices: [
          { id: 'publier', label: 'Oui, publiez tout', hint: 'L’escalade est possible', effects: [hostile('karstanie', -5), tension(3), st('popularity', 2)], end: 'Ce sera fait demain matin.', later: { months: 4, node: 'riposte' } },
          { id: 'services', label: 'Transmettez-les à nos services, discrètement', effects: [dos('securite', 5), st('credibility', 1)], end: 'Vos services les auront dans l’heure.', later: { months: 6, node: 'cessez_le_feu' } },
          { id: 'non', label: 'Non, restons-en au matériel', effects: [tension(-1)], end: 'Sage, peut-être. Merci encore.' },
        ],
      },
      mediation_ok: {
        text: 'Le Karstan accepte de venir à Paris. C’est inespéré. Je vous fais confiance pour ne pas nous vendre.',
        choices: [
          { id: 'frontieres', label: 'Je défendrai vos frontières', effects: [prestige(4), hostile('karstanie', -3)], end: 'Alors, à Paris.', later: { months: 3, node: 'cessez_le_feu' } },
          { id: 'concessions', label: 'Il faudra des concessions des deux côtés', effects: [prestige(2), hostile('valdovie', -3), hostile('karstanie', 3)], end: 'Des concessions… Nous verrons bien.', later: { months: 3, node: 'cessez_le_feu' } },
        ],
      },
      mediation_ratee: {
        text: 'La Karstanie a refusé votre médiation, publiquement, en raillant « la France qui parle beaucoup ». Je suis seul.',
        effects: [prestige(-4), st('credibility', -2)],
        choices: [
          { id: 'materiel', label: 'Alors nous livrerons du matériel', effects: [hostile('karstanie', -6), tension(3), hostile('valdovie', 5)], remember: { c_valdovie_soutien: 1 }, end: 'Enfin. Merci.' },
          { id: 'non', label: 'Je ne peux pas aller plus loin', effects: [hostile('valdovie', -4)], end: 'Je m’en souviendrai.', later: { months: 5, node: 'rancune' } },
        ],
      },
      riposte: {
        text: 'Nos preuves ont fait leur effet : la Karstanie a expulsé votre ambassadeur. Je suis désolé du prix que vous payez pour nous.',
        effects: [tension(4), hostile('karstanie', -5), prestige(2)],
        choices: [
          { id: 'verite', label: 'C’était le prix de la vérité', effects: [st('credibility', 2)], end: 'Vous êtes un allié rare.' },
          { id: 'prevenir', label: 'La prochaine fois, prévenez-moi avant', effects: [st('influence', 1)], end: 'Promis. Pardonnez l’impatience d’un pays en guerre.' },
        ],
      },
      cessez_le_feu: {
        text: 'Un cessez-le-feu tient depuis trois semaines. Ma capitale respire. Nos journaux parlent déjà d’un « accord de Paris ».',
        effects: [prestige(5), tension(-4), hostile('valdovie', 6), st('popularity', 2)],
        choices: [
          { id: 'paix', label: 'Cette paix vous revient', effects: [st('credibility', 1)], end: 'Elle vous revient aussi.' },
          { id: 'visite', label: 'Je viendrai à votre capitale', effects: [st('energy', -3), prestige(2)], end: 'Vous y serez reçu·e comme un ami.' },
        ],
      },
      rancune: {
        text: 'Ma capitale tient encore, sans vous. Je voulais vous dire que nous avons signé nos contrats d’armement ailleurs. Rien de personnel.',
        effects: [hostile('valdovie', -5), prestige(-2), eco({ confidence: -1 })],
        choices: [
          { id: 'regret', label: 'Je regrette ce soir-là', effects: [st('credibility', 1)], end: 'Les regrets ne coûtent rien.' },
          { id: 'interets', label: 'La France n’a pas d’amis, elle a des intérêts', effects: [st('influence', 1), st('popularity', -1)], end: 'Alors nous avons compris la même chose.' },
        ],
      },
    },
  },

  // ── 4. La gouverneure de la banque centrale ──
  {
    id: 'c_gouverneur', weight: 1,
    eligible: d => !!d.presidency || d.player.rankId === 'premier_ministre' || (d.player.rankId === 'ministre' && d.portfolio === 'economie'),
    who: guestSpeaker('c_gouverneur', 'Thérèse Lambesc', 'Gouverneure de la Banque de France'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `Je vous écris à titre confidentiel. Les marchés commencent à douter de notre trajectoire budgétaire${mem(d, 'c_cac_cede') ? ', surtout depuis l’exonération accordée aux grands groupes' : ''}. Si rien ne change d’ici l’automne, les taux grimperont et la note de la France risque d’être dégradée.`,
        choices: [
          { id: 'rigueur', label: 'Je prépare un plan d’économies', hint: 'Les classes populaires le paieront', effects: [eco({ deficit: -0.3, confidence: 3 }), seg('populaires', -3), st('popularity', -2)], remember: { c_rigueur: 1 }, next: 'niches' },
          { id: 'defi', label: 'Les marchés ne gouvernent pas la France', effects: [st('popularity', 2), seg('populaires', 2), eco({ confidence: -3 })], remember: { c_defi_marches: 1 }, end: 'C’est une belle phrase. Les marchés, eux, n’ont pas d’oreilles.', later: { months: 6, node: 'tempete' } },
          { id: 'caution', label: 'Aidez-moi : un mot rassurant de votre part', hint: 'Elle tient à son indépendance', effects: [st('politicalCapital', -2)], risk: { chance: 0.45, scaleWith: 'credibility', fail: 'refus' }, next: 'accord_discret' },
        ],
        ignore: [eco({ confidence: -2 })],
      },
      niches: {
        text: 'C’est courageux. Un conseil : votre plan ne sera crédible que s’il touche aussi les niches fiscales des plus aisés, pas seulement les dépenses sociales.',
        choices: [
          { id: 'niches', label: 'Je supprime trois grandes niches', effects: [seg('cadres', -3), seg('populaires', 2), eco({ deficit: -0.1 }), st('politicalCapital', -3)], end: 'Voilà un plan que je pourrai défendre devant mes homologues.', later: { months: 5, node: 'taux_baissent' } },
          { id: 'depenses', label: 'Non, on ne touche qu’aux dépenses', effects: [seg('cadres', 2), seg('populaires', -2), st('credibility', -1)], end: 'C’est votre choix. Il sera commenté.', later: { months: 5, node: 'taux_baissent' } },
        ],
      },
      accord_discret: {
        text: 'Je dirai devant la commission des finances que la trajectoire « reste crédible ». Une fois. Ne me le redemandez pas.',
        effects: [eco({ confidence: 3 })],
        choices: [
          { id: 'tenir', label: 'Je tiendrai les chiffres, promis', effects: [st('politicalCapital', -2), eco({ deficit: -0.1 })], end: 'Ne me remerciez pas : tenez-les.' },
          { id: 'verra', label: 'Merci. On verra pour les chiffres', effects: [st('stress', -1)], remember: { c_gouverneur_utilisee: 1 }, end: 'J’ai engagé ma parole. Ne la gaspillez pas.', later: { months: 6, node: 'tempete' } },
        ],
      },
      refus: {
        text: 'Non. La Banque de France est indépendante et je n’ai pas l’intention de servir de caution. Considérez que ce message n’a pas existé.',
        effects: [st('credibility', -2), st('influence', -1)],
        choices: [
          { id: 'oublier', label: 'Je comprends, oubliez ma demande', effects: [st('stress', 1)], end: 'C’est déjà oublié.' },
          { id: 'menacer', label: 'Votre mandat se termine bientôt, je le rappelle', hint: 'Une pression sur une autorité indépendante', effects: [expo(4), st('influence', 1)], remember: { c_gouverneur_menacee: 1 }, end: 'J’en prends note. Mes successeurs aussi, croyez-moi.', later: { months: 4, node: 'journaliste' } },
        ],
      },
      tempete: {
        text: 'Ce que je redoutais est arrivé : l’écart de taux avec l’Allemagne s’est envolé et une agence a dégradé la note de la France. Je suis désolée d’avoir eu raison.',
        effects: [eco({ confidence: -4, deficit: 0.2 }), st('credibility', -3)],
        choices: [
          { id: 'urgence', label: 'Plan d’urgence, tout de suite', effects: [st('politicalCapital', -4), eco({ deficit: -0.2 }), seg('populaires', -2)], end: 'C’est tard, mais c’est mieux que rien.' },
          { id: 'speculation', label: 'Je dénonce la spéculation', effects: [st('popularity', 2), eco({ confidence: -2 })], end: 'Les spéculateurs vous remercient de votre attention.' },
        ],
      },
      taux_baissent: {
        text: 'Bonne nouvelle : les taux se détendent, et Bruxelles salue votre plan. Je l’ai dit publiquement, sans que vous ayez à le demander.',
        effects: [eco({ confidence: 4 }), st('credibility', 3), rel('ue', 4)],
        choices: [
          { id: 'merci', label: 'Merci pour votre franchise', effects: [st('stress', -2)], end: 'C’est mon métier.' },
          { id: 'baisse', label: 'Une baisse des taux, alors ?', effects: [st('influence', -1)], end: 'Bien essayé. Ce n’est pas moi qui décide seule, et vous le savez.' },
        ],
      },
      journaliste: {
        text: 'Pour votre information : un journaliste m’a demandé si l’exécutif avait fait pression sur moi. J’ai répondu que je ne commentais pas. Il a souri.',
        effects: [expo(4), st('credibility', -3)],
        choices: [
          { id: 'dementir', label: 'Démentez fermement, je vous en prie', effects: [st('politicalCapital', -2)], end: 'Je ne mentirai pas. Je me tairai, c’est déjà beaucoup.' },
          { id: 'excuses', label: 'Pardonnez-moi, c’était maladroit', effects: [st('credibility', 1), expo(-1)], end: 'Excuses acceptées. N’y revenez pas.' },
        ],
      },
    },
  },

  // ── 5. Un préfet pendant une crue ──
  {
    id: 'c_prefet', weight: 1,
    eligible: d => rankAtLeast(d, 3) && (auPouvoir(d) || d.portfolio === 'securite' || d.portfolio === 'territoires'),
    who: guestSpeaker('c_prefet', 'Olivier Sarrade', 'Préfet de la Drôme'),
    start: 'debut',
    nodes: {
      debut: {
        call: true,
        text: 'Je vous appelle de la cellule de crise. Le Rhône déborde, deux communes sont coupées du monde et la digue des Vernes menace de céder cette nuit. Je dois choisir maintenant : évacuer 12 000 personnes, ou parier sur la digue.',
        choices: [
          { id: 'evacuer', label: 'Évacuez tout le monde, je vous couvre', hint: 'Si la digue tient, on criera au gâchis', effects: [st('energy', -4), st('politicalCapital', -2), dos('securite', 3)], remember: { c_prefet_confiance: 1 }, next: 'evacuation' },
          { id: 'parier', label: 'Renforcez la digue, n’évacuez pas', hint: 'Un pari risqué', effects: [st('stress', 3)], risk: { chance: 0.4, fail: 'digue_cede' }, next: 'digue_tient' },
          { id: 'venir', label: 'J’arrive sur place cette nuit', effects: [st('energy', -7), st('popularity', 3), st('stress', 2)], remember: { c_prefet_terrain: 1 }, next: 'sur_place' },
        ],
      },
      sur_place: {
        text: 'Votre présence a regonflé les équipes. Mais les caméras vous suivent partout, et il faut toujours trancher pour la digue.',
        choices: [
          { id: 'evacuer', label: 'Évacuez, je l’annonce moi-même aux habitants', effects: [st('energy', -3), st('popularity', 2)], next: 'evacuation' },
          { id: 'confiance', label: 'On fait confiance aux ingénieurs', effects: [st('stress', 2)], risk: { chance: 0.35, fail: 'digue_cede' }, next: 'digue_tient' },
        ],
      },
      evacuation: {
        text: 'L’évacuation se déroule dans le calme, les gymnases sont pleins. Il me faudra des moyens exceptionnels pour reloger les familles plusieurs semaines.',
        choices: [
          { id: 'fonds', label: 'Débloquez un fonds d’urgence de 50 millions', effects: [eco({ deficit: 0.02 }), seg('ruraux', 3), st('popularity', 2)], end: 'Merci. Je préviens les maires tout de suite.', later: { months: 4, node: 'bilan' } },
          { id: 'hotels', label: 'Réquisitionnez les hôtels vides', effects: [st('credibility', 1), seg('cadres', -1), st('popularity', 1)], end: 'Les hôteliers vont grincer, mais c’est légal.', later: { months: 4, node: 'bilan' } },
        ],
      },
      digue_tient: {
        text: 'La digue a tenu. Les ingénieurs ont travaillé toute la nuit, et personne n’a eu à quitter sa maison.',
        effects: [st('credibility', 3), seg('ruraux', 2)],
        choices: [
          { id: 'bravo', label: 'Bravo à vos équipes', effects: [st('stress', -2)], end: 'Je transmets. Ils seront fiers.' },
          { id: 'decorer', label: 'Je décorerai moi-même ces ingénieurs', effects: [st('energy', -2), st('popularity', 2)], end: 'Ils ne s’y attendent pas. Ça les marquera à vie.' },
        ],
      },
      digue_cede: {
        text: 'La digue a cédé à 3 h du matin. Les secours ont mis tout le monde à l’abri à temps, mais des centaines de familles ont tout perdu, et la presse demande qui a refusé l’évacuation.',
        effects: [st('credibility', -5), st('popularity', -3), seg('ruraux', -4), expo(3)],
        choices: [
          { id: 'assumer', label: 'C’est ma décision, je l’assume', effects: [st('credibility', 2), st('politicalCapital', -3)], remember: { c_prefet_assume: 1 }, end: 'Peu de responsables l’auraient dit. Ça comptera.' },
          { id: 'lacher', label: 'Le préfet a mal évalué la situation', hint: 'Il saura s’en souvenir', effects: [st('credibility', -1), st('influence', 1)], remember: { c_prefet_lache: 1 }, end: 'Je vois. Je prendrai mes responsabilités.', later: { months: 5, node: 'commission' } },
        ],
      },
      bilan: {
        text: 'Les familles évacuées sont toutes rentrées. La digue a fini par céder deux jours après votre ordre : sans l’évacuation, le bilan aurait été dramatique. Les maires vous remercient.',
        effects: [st('credibility', 4), seg('ruraux', 3), st('popularity', 2)],
        choices: [
          { id: 'merite', label: 'Le mérite revient à vos équipes', effects: [st('stress', -2)], end: 'Je le leur dirai. Venant de vous, ça compte.' },
          { id: 'digues', label: 'Faites-moi l’inventaire des digues fragiles', effects: [st('politicalCapital', -1), dos('territoires', 3)], end: 'Vous l’aurez avant l’hiver.' },
        ],
      },
      commission: {
        text: 'Je quitte la préfectorale. Je voulais vous prévenir : la commission d’enquête m’a auditionné, et j’ai dit la vérité sur l’ordre de ne pas évacuer.',
        effects: [st('credibility', -4), expo(4)],
        choices: [
          { id: 'bien', label: 'Vous avez bien fait', effects: [st('credibility', 1)], end: 'Merci. Je vous souhaite bonne chance.' },
          { id: 'trahison', label: 'Vous avez trahi la solidarité de l’État', effects: [st('stress', 2)], end: 'Non. J’ai servi l’État. Ce n’est pas la même chose.' },
        ],
      },
    },
  },

  // ── 6. Le chef d'état-major réclame des moyens (Élysée) ──
  {
    id: 'c_etat_major', weight: 1,
    eligible: d => !!d.presidency,
    who: guestSpeaker('c_cema', 'Général Hervé Castellane', 'Chef d’état-major des armées'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `${titrePR(d)}, je vous dois la vérité : en haute intensité, nos stocks de munitions tiendraient trois semaines.${mem(d, 'c_valdovie_soutien') ? ' Le matériel livré à la Valdovie a creusé le trou.' : ''} Il me faut deux milliards de plus dans la loi de programmation, ou je ne réponds plus de rien.`,
        choices: [
          { id: 'accorder', label: 'Vous aurez vos deux milliards', hint: 'Bercy hurlera', effects: [eco({ deficit: 0.1 }), dos('securite', 4), prestige(2), pres({ approval: -1 })], remember: { c_armee_dotee: 1 }, end: 'Merci. Les armées sauront s’en montrer dignes.', later: { months: 8, node: 'exercice' } },
          { id: 'moitie', label: 'Un milliard, et une revue des dépenses', effects: [eco({ deficit: 0.05 }), dos('securite', 2), st('politicalCapital', -1)], next: 'revue' },
          { id: 'refuser', label: 'Faites avec ce que vous avez', effects: [prestige(-1), st('influence', -1)], remember: { c_armee_refusee: 1 }, next: 'demission' },
        ],
        ignore: [dos('securite', -2)],
      },
      revue: {
        text: 'Un milliard, c’est mieux que rien. Mais je préfère vous prévenir : la revue des dépenses, c’est mon état-major qui la conduira, pas Bercy.',
        choices: [
          { id: 'accorde', label: 'Accordé', effects: [st('politicalCapital', -1)], end: 'Bien reçu. Merci de votre confiance.', later: { months: 8, node: 'exercice' } },
          { id: 'bercy', label: 'Non, ce sera Bercy', effects: [st('credibility', 1)], risk: { chance: 0.4, scaleWith: 'influence', fail: 'demission' }, end: 'À vos ordres. Je n’en pense pas moins.' },
        ],
      },
      demission: {
        text: 'Dans ce cas, j’envisage de vous présenter ma démission. Un chef d’état-major qui ne peut plus garantir la défense du pays n’a rien à faire à son poste.',
        effects: [st('stress', 3)],
        choices: [
          { id: 'accepter', label: 'Je l’accepte et je nomme un successeur', effects: [pres({ approval: -2 }), st('influence', 2), dos('securite', -2)], end: 'Bien. Je partirai dans l’honneur et dans le silence.', later: { months: 5, node: 'tribune' } },
          { id: 'rester', label: 'Restez, on rouvre le dossier en juillet', effects: [st('politicalCapital', -3), eco({ deficit: 0.03 })], end: 'Je reste. Pour mes soldats, pas pour la promesse.' },
          { id: 'autorite', label: 'Un militaire ne menace pas le chef des armées', if: d => d.player.stats.influence >= 50, hint: 'Il faut de l’autorité pour oser', effects: [st('influence', 2), st('credibility', 1), pres({ approval: 1 })], end: 'Vous avez raison. Je retire ce que j’ai dit.' },
        ],
      },
      exercice: {
        text: 'Le grand exercice interarmées s’est déroulé sans accroc, et nos alliés ont été impressionnés. Les commandes de munitions arrivent. Je tenais à ce que vous le sachiez.',
        effects: [prestige(3), dos('securite', 3), pres({ approval: 2 })],
        choices: [
          { id: 'feliciter', label: 'Félicitations aux armées', effects: [st('stress', -1)], end: 'Je transmets. Avec fierté.' },
          { id: 'defile', label: 'On le montrera au 14 Juillet', effects: [st('popularity', 1), st('energy', -1)], end: 'Les troupes seront à la hauteur.' },
        ],
      },
      tribune: {
        text: 'J’ai signé une tribune dans la presse, avec vingt officiers généraux en deuxième section : « L’armée désarmée par l’indifférence ». Je ne vous attaque pas. Je défends l’armée.',
        effects: [pres({ approval: -3 }), st('credibility', -2), expo(2)],
        choices: [
          { id: 'recevoir', label: 'Je vous reçois à l’Élysée', effects: [st('energy', -2), st('credibility', 1)], end: 'J’y serai. En civil.' },
          { id: 'digne', label: 'Le silence aurait été plus digne', effects: [st('influence', 1)], end: 'Le silence, je l’ai gardé quarante ans.' },
        ],
      },
    },
  },

  // ── 7. La présidente du groupe majoritaire négocie un texte (Élysée) ──
  {
    id: 'c_president_groupe', weight: 1,
    eligible: d => !!d.presidency && !d.presidency.cohabitation,
    who: guestSpeaker('c_volland', 'Agnès Volland', 'Présidente du groupe majoritaire'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Le texte sur les retraites arrive en séance mardi. J’ai compté : il manque quinze voix. Je peux les trouver, mais il me faut de quoi négocier.',
        choices: [
          { id: 'carrieres', label: 'Accordez l’amendement sur les carrières longues', hint: 'Un coût pour les finances publiques', effects: [eco({ deficit: 0.05 }), seg('populaires', 2), pres({ majority: 3 }), st('politicalCapital', -2)], remember: { c_texte_amende: 1 }, end: 'Avec ça, je les ramène. Comptez sur moi.', later: { months: 4, node: 'vote_gagne' } },
          { id: 'dissolution', label: 'Faites savoir que la dissolution est possible', hint: 'Une menace qui peut se retourner', effects: [st('influence', 2)], risk: { chance: 0.45, scaleWith: 'influence', fail: 'mutinerie' }, next: 'menace_ok' },
          { id: 'recevoir', label: 'Je reçois les quinze à l’Élysée, un par un', if: d => d.player.stats.energy >= 40, hint: 'Épuisant', effects: [st('energy', -8), pres({ majority: 4 }), st('influence', 1)], end: 'Ils adorent être reçus. Ça marchera.' },
          { id: 'retirer', label: 'On retire le texte et on reprend à zéro', effects: [st('credibility', -3), st('politicalCapital', 2)], end: 'Sage, peut-être. Mais on dira que vous avez reculé.' },
        ],
      },
      menace_ok: {
        text: 'La menace a fait son effet : les hésitants rentrent dans le rang. Mais ils m’en veulent, et c’est moi qui les croise à la buvette.',
        choices: [
          { id: 'dette', label: 'Je vous en dois une', effects: [pres({ majority: 3 }), st('politicalCapital', -1)], remember: { c_volland_dette: 1 }, end: 'Je le note. Je viendrai la réclamer.', later: { months: 6, node: 'reclamation' } },
          { id: 'travail', label: 'C’est votre travail', effects: [pres({ majority: 2 })], end: 'Bien reçu. Je m’en souviendrai aussi.' },
        ],
      },
      mutinerie: {
        text: 'Catastrophe : la menace a fuité, vingt députés signent une tribune contre « le chantage de l’Élysée ». Le texte est mort.',
        effects: [pres({ majority: -4, approval: -2 }), st('credibility', -2)],
        choices: [
          { id: 'retirer', label: 'Je retire le texte', effects: [st('credibility', -1)], end: 'Je l’annonce ce soir. On panse les plaies.' },
          { id: 'maintenir', label: 'On le présente quand même', effects: [pres({ majority: -2 }), st('stress', 3)], end: 'Comme vous voudrez. Préparez-vous à perdre.' },
        ],
      },
      vote_gagne: {
        text: 'Le texte est adopté, avec dix-neuf voix d’avance. Les carrières longues ont fait la différence. Et je vous dois ma réélection à la tête du groupe.',
        effects: [pres({ majority: 2, approval: 2 }), st('popularity', 1)],
        choices: [
          { id: 'bravo', label: 'Bravo, Agnès', effects: [st('stress', -1)], end: 'À la prochaine bataille.' },
          { id: 'suivant', label: 'Prochain texte : l’assurance chômage', effects: [st('politicalCapital', 1)], end: 'Laissez-moi souffler un mois. Après, je suis à vous.' },
        ],
      },
      reclamation: {
        text: 'Je viens réclamer ma dette : le ministère de la Justice se libère au prochain remaniement. Je le veux.',
        choices: [
          { id: 'oui', label: 'Il est à vous', effects: [pres({ majority: 3 }), st('influence', -2)], end: 'Merci. Vous ne le regretterez pas.' },
          { id: 'autre', label: 'Pas la Justice, mais un autre portefeuille', effects: [pres({ majority: 1 })], end: 'Je prends. Mais je n’oublie pas.' },
          { id: 'non', label: 'Je ne remanie pas sur commande', effects: [pres({ majority: -3 }), st('credibility', 1)], end: 'Alors ne comptez plus sur moi pour compter les voix.' },
        ],
      },
    },
  },

  // ── 8. Un ancien président veut un poste (Élysée) ──
  {
    id: 'c_ancien_president', weight: 1,
    eligible: d => !!d.presidency,
    who: guestSpeaker('c_ancien_pdt', 'Henri Valentin-Dorsay', 'Ancien président de la République'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `${fem(d) ? 'Chère successeure' : 'Cher successeur'}, si je puis dire. La présidence du Conseil constitutionnel se libère au printemps. J’ai l’expérience, le temps, et quelques amis au Parlement qui vous seraient utiles. Je compte sur votre bienveillance.`,
        choices: [
          { id: 'nommer', label: 'Je vous nommerai', hint: 'On parlera de copinage', effects: [expo(3), st('credibility', -2), pres({ majority: 3 }), st('influence', 2)], remember: { c_ancien_nomme: 1 }, end: 'Je savais pouvoir compter sur vous. Mes amis aussi le sauront.', later: { months: 6, node: 'censure' } },
          { id: 'mission', label: 'Plutôt une mission sur nos institutions', effects: [st('politicalCapital', -2)], next: 'mission' },
          { id: 'refuser', label: 'Ce poste exige une indépendance absolue', effects: [st('credibility', 2), pres({ approval: 1 })], next: 'vexe' },
        ],
        ignore: [st('influence', -1)],
      },
      mission: {
        text: 'Une mission… C’est un lot de consolation. Soit, à condition que le rapport soit publié et que vous en repreniez les conclusions.',
        choices: [
          { id: 'promettre', label: 'Promis, j’en reprendrai l’essentiel', effects: [st('politicalCapital', -2), st('credibility', 1)], end: 'Alors j’accepte. Vous aurez un rapport dont on parlera.', later: { months: 8, node: 'rapport' } },
          { id: 'lire', label: 'Je le lirai, sans rien promettre', effects: [st('credibility', 1)], risk: { chance: 0.4, scaleWith: 'influence', fail: 'vexe' }, end: 'Vous êtes prudent·e. Soit, j’accepte.' },
        ],
      },
      vexe: {
        text: 'Je vois. Sachez que mes mémoires sortent à l’automne. J’hésitais encore sur le chapitre consacré à mes successeurs.',
        effects: [st('stress', 2)],
        choices: [
          { id: 'ecrire', label: 'Écrivez ce que vous voulez', effects: [st('credibility', 1)], remember: { c_ancien_vexe: 1 }, end: 'Je n’y manquerai pas.', later: { months: 6, node: 'memoires' } },
          { id: 'dejeuner', label: 'Déjeunons, et parlons-en', effects: [st('energy', -3), st('influence', -1)], end: 'Avec plaisir. Le chapitre sera… nuancé.' },
        ],
      },
      censure: {
        text: 'Je vous préviens par courtoisie : le Conseil va censurer une partie de votre loi sur la sécurité. Le droit est le droit. Ne m’en voulez pas.',
        effects: [pres({ approval: -1 }), dos('securite', -2)],
        choices: [
          { id: 'trahison', label: 'Vous me trahissez', effects: [st('stress', 3)], end: 'Je vous sers mieux en vous désobéissant.' },
          { id: 'droit', label: 'Le droit est le droit', effects: [st('credibility', 3), expo(-2)], end: 'Voilà qui m’honore. Et vous aussi.' },
        ],
      },
      rapport: {
        text: 'Mon rapport est prêt : référendum d’initiative partagée simplifié, dose de proportionnelle, mandat unique. Vous m’aviez promis de le reprendre.',
        choices: [
          { id: 'proportionnelle', label: 'Je reprends la proportionnelle', effects: [pres({ majority: -2 }), st('credibility', 2), st('popularity', 1)], end: 'Enfin un successeur qui tient parole.' },
          { id: 'moment', label: 'Le moment n’est pas opportun', effects: [st('credibility', -2)], end: 'Le moment ne l’est jamais. Je le dirai.' },
        ],
      },
      memoires: {
        text: 'Mes mémoires sont en librairie. Le chapitre qui vous concerne s’intitule « L’ingratitude ». Il se vend très bien, paraît-il.',
        effects: [st('popularity', -2), st('credibility', -2), expo(2)],
        choices: [
          { id: 'pas_lu', label: 'Je ne le lirai pas', effects: [st('stress', 1)], end: 'Vous avez tort, il est très bien écrit.' },
          { id: 'bonne_lecture', label: 'Bonne lecture aux Français', effects: [st('influence', 1)], end: 'Merci pour la publicité.' },
        ],
      },
    },
  },

  // ── 9. La Cour des comptes prévient d'un rapport ──
  {
    id: 'c_cour_comptes', weight: 1,
    eligible: d => rankAtLeast(d, 3) && (!!d.portfolio || auPouvoir(d)),
    who: guestSpeaker('c_ccomptes', 'Jean-Marc Ribeyre', 'Premier président de la Cour des comptes'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `Par courtoisie républicaine, je vous informe que la Cour publiera dans trois mois un rapport sévère sur la gestion de vos services${mem(d, 'c_note_enterree') ? ', où il est question d’une note sur un barrage que vos services auraient « égarée »' : ''}. Vous disposez d’un droit de réponse, annexé au rapport.`,
        choices: [
          { id: 'reponse', label: 'Mes équipes rédigeront une réponse solide', effects: [st('energy', -4), dos('economie', 3), st('credibility', 1)], next: 'reponse' },
          { id: 'devancer', label: 'Je publie mes propres chiffres avant vous', hint: 'Couper l’herbe sous le pied', effects: [st('popularity', 1), st('influence', 1)], risk: { chance: 0.4, scaleWith: 'credibility', fail: 'contre_feu' }, remember: { c_cour_devancee: 1 }, end: 'Habile. La Cour n’a pas l’habitude qu’on la devance. Le rapport passera presque inaperçu.' },
          { id: 'decaler', label: 'Ce rapport tombe mal : pouvez-vous le décaler ?', hint: 'Une institution indépendante', effects: [expo(3)], next: 'refus' },
          { id: 'barrage', label: 'Je reconnais tout sur le barrage, publiquement', if: d => mem(d, 'c_note_enterree') > 0, effects: [st('credibility', 3), st('popularity', -2), expo(-4)], end: 'C’est la seule attitude digne. La Cour en tiendra compte.' },
        ],
        ignore: [st('credibility', -2)],
      },
      reponse: {
        text: 'Votre réponse est arrivée : précise, argumentée. Elle sera publiée en annexe. Je ne peux rien vous promettre, mais elle sera lue.',
        choices: [
          { id: 'merci', label: 'Merci de votre loyauté', effects: [st('stress', -1)], end: 'Je ne suis pas loyal, je suis impartial.', later: { months: 3, node: 'publication' } },
          { id: 'plan', label: 'Ajoutez-y un plan de redressement', effects: [st('politicalCapital', -2), st('credibility', 2)], end: 'Voilà qui changera la tonalité du communiqué.', later: { months: 3, node: 'publication_douce' } },
        ],
      },
      refus: {
        text: 'Je vais faire comme si je n’avais pas lu ce message. Le rapport sortira à la date prévue, et je vous déconseille de renouveler ce genre de demande par écrit.',
        effects: [st('credibility', -2)],
        choices: [
          { id: 'excuses', label: 'C’était maladroit, je vous prie de m’excuser', effects: [st('credibility', 1)], end: 'Excuses notées.', later: { months: 3, node: 'publication' } },
          { id: 'insister', label: 'Je ne faisais que demander', effects: [st('stress', 2)], remember: { c_cour_pression: 1 }, end: 'Les écrits restent.', later: { months: 3, node: 'publication_dure' } },
        ],
      },
      contre_feu: {
        text: 'Vos chiffres contredisaient les nôtres. La Cour a publié une mise au point cinglante, reprise partout : « L’exécutif arrange ses comptes ».',
        effects: [st('credibility', -5), expo(3)],
        choices: [
          { id: 'erreur', label: 'Je reconnais une erreur de méthode', effects: [st('credibility', 2)], end: 'Dont acte.' },
          { id: 'maintenir', label: 'Je maintiens mes chiffres', effects: [st('influence', 1), st('credibility', -2)], end: 'Le débat est public, désormais.' },
        ],
      },
      publication: {
        text: 'Le rapport est publié ce matin. Il est sévère sur vos services, mais votre réponse est jugée « sérieuse ». La presse en fait un article, pas une une.',
        effects: [st('credibility', -1), expo(-1)],
        choices: [
          { id: 'appliquer', label: 'J’appliquerai ses recommandations', effects: [st('politicalCapital', -2), st('credibility', 2)], end: 'La Cour suivra cela avec attention.' },
          { id: 'classer', label: 'Je le lis et je le classe', effects: [st('stress', -1)], end: 'Nous ferons un rapport de suivi.' },
        ],
      },
      publication_douce: {
        text: 'Le rapport est publié. Grâce à votre plan de redressement, la Cour parle d’une « prise de conscience ». C’est rare, croyez-moi.',
        effects: [st('credibility', 3), dos('economie', 2)],
        choices: [
          { id: 'merci', label: 'Bonne nouvelle, merci', effects: [st('stress', -2)], end: 'Ne me remerciez pas, remerciez vos équipes.' },
          { id: 'communiquer', label: 'Je vais en faire un argument', effects: [st('popularity', 1), st('credibility', -1)], end: 'À votre place, je resterais modeste.' },
        ],
      },
      publication_dure: {
        text: 'Le rapport est publié. Et un magistrat a évoqué devant la presse « une demande de report venue d’en haut ». Je vous avais prévenu.',
        effects: [st('credibility', -5), expo(4), st('popularity', -2)],
        choices: [
          { id: 'expliquer', label: 'Je m’explique devant la presse', effects: [st('energy', -3), st('credibility', 1)], end: 'Bon courage.' },
          { id: 'silence', label: 'Je ne commente pas', effects: [st('stress', 2)], end: 'C’est votre droit.' },
        ],
      },
    },
  },

  // ── 10. Un patron du CAC 40 menace de délocaliser son siège ──
  {
    id: 'c_cac_siege', weight: 1,
    eligible: d => !!d.presidency || d.player.rankId === 'premier_ministre',
    who: guestSpeaker('c_lancrey', 'Édouard Lancrey', 'PDG du groupe Vertane'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Je serai direct : mon conseil d’administration étudie le transfert de notre siège social à Amsterdam. Votre surtaxe sur les grands groupes nous coûte 400 millions par an. Convainquez-moi de rester.',
        choices: [
          { id: 'ceder', label: 'J’exonère les sièges sociaux de la surtaxe', hint: 'Un cadeau fiscal très visible', effects: [eco({ deficit: 0.05, confidence: 2 }), seg('cadres', 2), seg('populaires', -3), st('popularity', -2)], remember: { c_cac_cede: 1 }, next: 'reste' },
          { id: 'tenir', label: 'Partez, et assumez-le devant vos salariés', effects: [st('popularity', 3), seg('populaires', 2), eco({ confidence: -2 }), st('credibility', 1)], remember: { c_cac_tenu: 1 }, next: 'bras_de_fer' },
          { id: 'deal', label: 'Investissez ici, et on rediscutera la surtaxe', effects: [st('influence', 1)], risk: { chance: 0.45, scaleWith: 'influence', fail: 'depart_sec' }, next: 'deal' },
          { id: 'climat', label: 'Vos syndicats viennent de signer avec l’État : restez', if: d => mem(d, 'c_greve_accord') > 0, effects: [eco({ confidence: 2 }), st('credibility', 1)], end: 'Le climat social compte, vous avez raison. Je reste… pour l’instant.' },
        ],
        ignore: [eco({ confidence: -1 })],
      },
      reste: {
        text: 'Merci. Je l’annonce demain : siège maintenu, et 2 000 emplois de plus en France d’ici trois ans. Vous verrez, ça paiera.',
        choices: [
          { id: 'compte', label: 'J’y compte', effects: [st('stress', -1)], end: 'Vous avez ma parole.', later: { months: 9, node: 'emplois_reportes' } },
          { id: 'ecrit', label: 'Je veux ces emplois par écrit', effects: [st('politicalCapital', -1), st('credibility', 1)], end: 'Mes juristes vous envoient un engagement signé.', later: { months: 9, node: 'emplois_tenus' } },
        ],
      },
      bras_de_fer: {
        text: 'Comme vous voudrez. Le transfert sera voté au prochain conseil. Vous en porterez la responsabilité devant le pays.',
        effects: [eco({ confidence: -2 }), st('stress', 2)],
        choices: [
          { id: 'salaries', label: 'Je réunis vos salariés à Bercy', effects: [st('energy', -4), st('popularity', 2)], end: 'Belle opération de communication. Le conseil votera quand même.', later: { months: 5, node: 'demenagement' } },
          { id: 'bluff', label: 'Vous bluffez', effects: [st('influence', 1)], end: 'Vous verrez bien.', later: { months: 5, node: 'demenagement' } },
        ],
      },
      deal: {
        text: 'Un milliard investi en France contre un réexamen de la surtaxe dans un an : ça me va. Ne me faites pas faux bond.',
        effects: [eco({ confidence: 2, growth: 0.05 })],
        choices: [
          { id: 'conclu', label: 'Marché conclu', effects: [st('politicalCapital', -1)], end: 'Parfait. Rendez-vous dans un an.', later: { months: 12, node: 'reexamen' } },
          { id: 'usines', label: 'Et vous rouvrez l’usine de Longvic', effects: [st('politicalCapital', -2), seg('populaires', 2)], end: 'Vous êtes gourmand·e. Va pour l’usine.', later: { months: 12, node: 'reexamen' } },
        ],
      },
      depart_sec: {
        text: 'J’ai présenté votre offre à mon conseil. Rejetée : trop vague. Le siège part à Amsterdam au 1er janvier.',
        effects: [eco({ confidence: -3, unemployment: 0.05 }), st('popularity', -2), st('credibility', -2)],
        choices: [
          { id: 'choix', label: 'C’est votre choix, pas le mien', effects: [st('stress', 1)], end: 'Les deux, malheureusement.' },
          { id: 'investisseurs', label: 'Je vais chercher d’autres investisseurs', effects: [st('energy', -3), eco({ confidence: 1 })], end: 'Bonne chance. Sincèrement.' },
        ],
      },
      emplois_tenus: {
        text: 'Point d’étape : 1 400 emplois créés, comme le prévoit notre engagement écrit. Les 600 autres suivront l’an prochain.',
        effects: [eco({ unemployment: -0.05, confidence: 2 }), st('credibility', 2)],
        choices: [
          { id: 'merci', label: 'Merci d’avoir tenu parole', effects: [st('stress', -1)], end: 'Vos juristes ne m’ont pas laissé le choix.' },
          { id: 'visite', label: 'Je viendrai visiter un de vos sites', effects: [st('energy', -2), seg('populaires', 1)], end: 'Avec plaisir. Les équipes seront fières.' },
        ],
      },
      emplois_reportes: {
        text: 'Point d’étape : la conjoncture a changé, les 2 000 emplois sont… reportés. Je compte sur votre compréhension.',
        effects: [st('credibility', -3), seg('populaires', -2), expo(2)],
        choices: [
          { id: 'parole', label: 'Vous m’aviez donné votre parole', effects: [st('stress', 2)], end: 'Les paroles, c’est le conseil qui les vote.' },
          { id: 'public', label: 'Je rends l’affaire publique', effects: [st('popularity', 2), eco({ confidence: -1 })], end: 'Vous faites une erreur.' },
        ],
      },
      demenagement: {
        text: 'Le siège est parti à Amsterdam. Mais nos usines restent en France : quarante personnes ont déménagé, pas une de plus. Sans rancune.',
        effects: [eco({ confidence: -1 }), st('credibility', 2), st('popularity', 1)],
        choices: [
          { id: 'rancune', label: 'Sans rancune', effects: [st('stress', -1)], end: 'On se recroisera à Davos.' },
          { id: 'reproche', label: 'Tout ce bruit pour quarante bureaux', effects: [st('influence', 1)], end: 'Le symbole, c’était pour vous. Les bureaux, pour moi.' },
        ],
      },
      reexamen: {
        text: 'Un an a passé. Le milliard est investi, comme promis. À vous : la surtaxe doit baisser.',
        choices: [
          { id: 'baisser', label: 'Promesse tenue : je la baisse', effects: [eco({ deficit: 0.03, confidence: 2 }), seg('populaires', -2)], remember: { c_cac_cede: 1 }, end: 'Merci. On pourra encore travailler ensemble.' },
          { id: 'budget', label: 'Impossible, le budget est trop serré', effects: [st('credibility', -2), eco({ confidence: -2 })], end: 'Je m’en souviendrai.' },
        ],
      },
    },
  },

  // ── 11. Un syndicat propose une sortie de grève ──
  {
    id: 'c_syndicat_sortie', weight: 1,
    eligible: d => rankAtLeast(d, 3) && (auPouvoir(d) || d.portfolio === 'social' || d.portfolio === 'economie') && d.contacts.some(c => c.type === 'syndicat'),
    who: contactSpeaker('syndicat'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Troisième semaine de grève dans les transports. Mes adhérents tiennent, mais ils sont épuisés. Je vous propose une sortie : la prime de pénibilité, et j’appelle à la reprise lundi. Tout ça reste entre nous, évidemment.',
        choices: [
          { id: 'accepter', label: 'Accordé. On signe ce week-end', hint: 'Le patronat grincera', effects: [eco({ deficit: 0.03 }), seg('populaires', 3), seg('cadres', -1), trust(6)], remember: { c_greve_accord: 1 }, next: 'signature' },
          { id: 'contre', label: 'La moitié de la prime, étalée sur deux ans', effects: [trust(3), st('politicalCapital', -1)], risk: { chance: 0.4, scaleWith: 'influence', fail: 'durcissement' }, remember: { c_greve_accord: 1 }, end: 'C’est maigre, mais je peux le vendre. J’appelle à la reprise.' },
          { id: 'tenir', label: 'Aucune concession, la grève s’essoufflera', effects: [st('credibility', 1), seg('cadres', 2), seg('populaires', -3), trust(-6)], remember: { c_greve_dure: 1 }, next: 'durcissement' },
        ],
        ignore: [trust(-5)],
      },
      signature: {
        text: 'Accord signé à 4 h du matin, comme dans les films. Les trains repartent lundi. Les patrons de la fédération des transports, eux, sont furieux.',
        choices: [
          { id: 'patrons', label: 'Je reçois les patrons pour calmer le jeu', effects: [st('energy', -3), eco({ confidence: 1 })], end: 'Bonne idée. Moi, je m’occupe de ma base.', later: { months: 6, node: 'congres_salut' } },
          { id: 'habituer', label: 'Qu’ils s’habituent au dialogue social', effects: [seg('populaires', 1), eco({ confidence: -1 })], end: 'Je vous cite au congrès, si vous permettez.', later: { months: 6, node: 'congres_salut' } },
        ],
      },
      durcissement: {
        text: 'Mes adhérents ont voté la grève reconductible. Je ne contrôle plus rien, et les blocages s’étendent aux dépôts de carburant.',
        effects: [st('popularity', -3), eco({ growth: -0.1, confidence: -2 }), st('stress', 3)],
        choices: [
          { id: 'ceder', label: 'Je cède : la prime entière', effects: [eco({ deficit: 0.04 }), st('credibility', -3), seg('populaires', 2), trust(3)], remember: { c_greve_accord: 1 }, end: 'Trop tard pour être élégant, mais c’est fini.' },
          { id: 'debloquer', label: 'Je fais lever les blocages des dépôts', hint: 'Vous perdrez un interlocuteur', effects: [dos('securite', 2), seg('populaires', -3), seg('cadres', 2), trust(-5)], end: 'Vous venez de perdre un interlocuteur.', later: { months: 6, node: 'congres_rupture' } },
          { id: 'attendre', label: 'J’attends : l’opinion se lassera', effects: [st('stress', 3), st('popularity', -2)], end: 'Vous jouez la montre. Moi aussi.' },
        ],
      },
      congres_salut: {
        text: 'Je vous renvoie l’ascenseur : notre congrès a adopté une motion qui salue « un exécutif qui a su négocier ». Ça ne nous était pas arrivé depuis longtemps.',
        effects: [seg('populaires', 3), st('popularity', 2), trust(4)],
        choices: [
          { id: 'merci', label: 'Merci, c’est réciproque', effects: [st('stress', -1)], end: 'Ne vous y habituez pas trop.' },
          { id: 'suite', label: 'On ouvre le chantier des salaires ?', effects: [st('politicalCapital', -2), seg('populaires', 1)], end: 'Avec plaisir. Préparez vos chiffres.' },
        ],
      },
      congres_rupture: {
        text: d => `Notre congrès a voté une consigne : ne plus siéger à une table où vous êtes ${fem(d) ? 'présente' : 'présent'}. Je n’ai rien pu faire.`,
        effects: [seg('populaires', -3), trust(-6), st('credibility', -1)],
        choices: [
          { id: 'regret', label: 'Je comprends, et je le regrette', effects: [st('credibility', 1)], end: 'Les regrets ne se négocient pas.' },
          { id: 'autres', label: 'Je parlerai aux autres syndicats', effects: [st('influence', 1)], end: 'Ils vous diront la même chose.' },
        ],
      },
    },
  },

  // ── 12. Un ministre qui fuite à la presse ──
  {
    id: 'c_ministre_fuite', weight: 1,
    eligible: d => auPouvoir(d),
    who: guestSpeaker('c_ravel', 'Matthieu Ravel', 'Ministre délégué au Budget'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `Je préfère vous le dire avant que vous ne le lisiez : c’est moi, la « source gouvernementale » du Journal du soir sur l’arbitrage budgétaire. ${mem(d, 'c_ministre_fracas') ? 'Après le départ fracassant de Fabregat, je pensais que la parole s’était libérée. ' : ''}Je voulais faire bouger les choses. Je m’en excuse.`,
        choices: [
          { id: 'virer', label: 'Votre démission sur mon bureau ce soir', effects: [st('credibility', 2), st('influence', 2), coh(-2), st('stress', 2)], remember: { c_fuiteur_vire: 1 }, next: 'vire' },
          { id: 'garder', label: 'Je passe l’éponge, mais c’est la dernière fois', effects: [st('credibility', -2), st('politicalCapital', 1)], remember: { c_fuiteur_garde: 1 }, end: 'Merci. Je ne vous décevrai plus.', later: { months: 5, node: 'recidive' } },
          { id: 'agent', label: 'Continuez, mais c’est moi qui écris vos fuites', hint: 'Un jeu dangereux', effects: [st('influence', 3), expo(3)], remember: { c_fuiteur_agent: 1 }, risk: { chance: 0.4, scaleWith: 'credibility', fail: 'demasque' }, end: 'Un ministre agent double. Vous êtes plus retors que je ne le pensais.', later: { months: 6, node: 'agent_utile' } },
          { id: 'retrograder', label: 'Je vous retire le Budget, vous gardez un strapontin', if: d => !!d.government, effects: [gov({ cohesion: 2 }), st('influence', 1)], end: 'Humiliant. Mais je reste, et je me tiendrai.' },
        ],
      },
      vire: {
        text: 'Très bien. Vous aurez ma lettre ce soir. Mais je ne suis pas le seul à parler aux journalistes, et je ne serai pas le dernier.',
        choices: [
          { id: 'noms', label: 'Donnez-moi les autres noms', hint: 'Il n’a plus rien à perdre', effects: [st('politicalCapital', -2)], risk: { chance: 0.5, scaleWith: 'influence', fail: 'pas_de_noms' }, remember: { c_fuites_noms: 1 }, end: 'Deux noms, dans un cabinet voisin du vôtre. Faites-en bon usage.' },
          { id: 'route', label: 'Bonne route', effects: [st('stress', -1)], end: 'Vous aussi.', later: { months: 4, node: 'ravel_revient' } },
        ],
      },
      pas_de_noms: {
        text: 'Non. Je pars, mais je ne suis pas une balance. Et je garde mes notes, au cas où.',
        effects: [expo(3), st('stress', 2)],
        choices: [
          { id: 'comme', label: 'Comme vous voudrez', effects: [st('stress', 1)], end: '…', later: { months: 4, node: 'ravel_revient' } },
          { id: 'etat', label: 'Vos notes appartiennent à l’État', effects: [st('credibility', 1)], end: 'Mes souvenirs, non.' },
        ],
      },
      demasque: {
        text: 'Catastrophe : le journaliste a compris que je lui servais des fuites dictées. Il publie l’histoire : « Les fausses fuites de l’exécutif ».',
        effects: [st('credibility', -6), expo(4), st('influence', -2)],
        choices: [
          { id: 'dementir', label: 'Je démens tout', effects: [st('credibility', -2), st('stress', 2)], end: 'Il a des captures d’écran.' },
          { id: 'fusible', label: 'Vous démissionnez, je reste', effects: [st('influence', 1), coh(-2)], end: 'Évidemment. C’est toujours le fusible qui saute.' },
        ],
      },
      recidive: {
        text: 'C’est encore moi. Vous allez lire votre portrait dans le Journal du soir demain. Je n’y suis pour rien. Enfin… presque rien.',
        effects: [st('credibility', -3), expo(3)],
        choices: [
          { id: 'fini', label: 'Cette fois, c’est fini', effects: [st('influence', 2), st('credibility', 1)], end: 'Je l’avais mérité.' },
          { id: 'quoi', label: 'Qu’avez-vous dit exactement ?', effects: [st('stress', 2)], end: 'Que vous dormez quatre heures par nuit. C’est vrai, non ?' },
        ],
      },
      agent_utile: {
        text: 'Vos fausses fuites ont marché : l’opposition a attaqué un arbitrage qui n’existait pas et s’est ridiculisée. Je commence à aimer ce métier.',
        effects: [st('influence', 3), st('popularity', 1), expo(2)],
        choices: [
          { id: 'stop', label: 'On arrête là, c’est trop risqué', effects: [expo(-2)], end: 'Dommage, je m’amusais.' },
          { id: 'continuer', label: 'On continue', effects: [st('influence', 2)], risk: { chance: 0.5, scaleWith: 'credibility', fail: 'demasque' }, end: 'Avec plaisir. J’ai déjà une idée.' },
        ],
      },
      ravel_revient: {
        text: 'Je suis redevenu député. Je siège désormais chez les non-inscrits, et je voterai au cas par cas. Rien de personnel.',
        effects: [st('influence', -1), coh(-2)],
        choices: [
          { id: 'comprendre', label: 'Je comprends', effects: [st('stress', 1)], end: 'Merci. On se croisera dans l’hémicycle.' },
          { id: 'revenir', label: 'Revenez : il y aura une place pour vous', effects: [st('politicalCapital', -2), coh(1)], end: 'Je vais y réfléchir. Sérieusement.' },
        ],
      },
    },
  },

  // ── 13. La porte-parole a fait une gaffe ──
  {
    id: 'c_porte_parole', weight: 1,
    eligible: d => auPouvoir(d),
    who: guestSpeaker('c_porte_parole', 'Lina Moreau-Tessier', 'Porte-parole du gouvernement'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Je suis désolée. Ce matin à la radio, on m’a demandé le prix d’un ticket de métro. J’ai répondu « dans les dix euros, je crois ». La séquence fait deux millions de vues.',
        choices: [
          { id: 'soutenir', label: 'Je vous soutiens publiquement', effects: [st('popularity', -2), seg('populaires', -2), st('credibility', -1)], remember: { c_porte_parole_couverte: 1 }, next: 'soutenue' },
          { id: 'excuses', label: 'Excusez-vous ce soir au 20 h', effects: [st('credibility', 1), st('popularity', -1)], next: 'excuses' },
          { id: 'remplacer', label: 'Je vais devoir vous remplacer', hint: 'Elle a des amis dans la majorité', effects: [st('credibility', 2), coh(-2), st('stress', 1)], remember: { c_porte_parole_sacrifiee: 1 }, end: 'Je comprends. Je serai digne. Mais je n’oublierai pas.', later: { months: 6, node: 'livre' } },
          { id: 'humour', label: 'Faites de l’humour, je ferai de même', if: d => !!d.presidency, hint: 'Ça passe ou ça casse', effects: [st('popularity', 2)], risk: { chance: 0.5, scaleWith: 'popularity', fail: 'humour_rate' }, end: 'Votre vidéo dans le métro a retourné la situation. Bien joué.' },
        ],
        ignore: [coh(-1)],
      },
      soutenue: {
        text: 'Merci, vraiment. Je ne l’oublierai pas. Maintenant, les journalistes veulent savoir si vous, vous connaissez le prix du ticket.',
        choices: [
          { id: 'metro', label: 'Bien sûr : je prends le métro chaque semaine', hint: 'Vérifiable…', effects: [st('popularity', 2)], risk: { chance: 0.5, scaleWith: 'credibility', fail: 'verification' }, end: 'Parfait. On tient le récit.' },
          { id: 'jeu', label: 'On n’entre pas dans ce jeu', effects: [st('stress', 1)], end: 'Sage. Je relaie.', later: { months: 5, node: 'loyale' } },
        ],
      },
      excuses: {
        text: 'Les excuses sont passées. Le présentateur m’a reposé la question, avec un sourire. J’ai donné le bon prix. Ça ira.',
        choices: [
          { id: 'page', label: 'Bien. Tournons la page', effects: [st('stress', -1)], end: 'Merci de m’avoir laissé une chance.', later: { months: 5, node: 'loyale' } },
          { id: 'pause', label: 'Prenez une semaine loin des micros', effects: [st('popularity', 1)], end: 'D’accord. Un peu de silence me fera du bien.' },
        ],
      },
      verification: {
        text: 'Un média a vérifié : votre carte de transport n’a pas été validée depuis deux ans. On parle d’un « double mensonge au sommet ».',
        effects: [st('credibility', -5), st('popularity', -3), expo(3)],
        choices: [
          { id: 'formule', label: 'J’assume : c’était une façon de parler', effects: [st('credibility', -1)], end: 'Ça ne convaincra personne, mais ça clôt le sujet.' },
          { id: 'cameras', label: 'Je prends le métro demain, devant les caméras', effects: [st('energy', -3), st('popularity', 1)], end: 'Ça fera sourire. C’est déjà ça.' },
        ],
      },
      humour_rate: {
        text: 'L’humour a été mal pris : « Ils rient pendant que les Français comptent leurs sous ». C’est pire qu’hier.',
        effects: [st('popularity', -4), seg('populaires', -3)],
        choices: [
          { id: 'excuses', label: 'On s’excuse tous les deux', effects: [st('credibility', 1)], end: 'Je prépare le communiqué commun.' },
          { id: 'silence', label: 'Plus un mot sur le sujet', effects: [st('stress', 2)], end: 'Bien reçu. Silence radio.' },
        ],
      },
      loyale: {
        text: 'Petite info : un ministre a essayé de m’enrôler dans sa « ligne » contre vous. J’ai refusé, et je vous transmets ses messages. Vous m’avez fait confiance, je vous la rends.',
        effects: [st('influence', 3), expo(-2)],
        choices: [
          { id: 'merci', label: 'Merci, Lina', effects: [st('stress', -1)], end: 'Avec plaisir. On se serre les coudes.' },
          { id: 'contact', label: 'Gardez le contact avec lui, on veut savoir', effects: [st('influence', 1), expo(1)], end: 'Agente double, maintenant. Ma carrière prend un tour étonnant.' },
        ],
      },
      livre: {
        text: 'Je vous écris de mon nouveau bureau : je publie un livre sur mes années au gouvernement. Le chapitre sur mon départ s’intitule « Le fusible ».',
        effects: [st('popularity', -2), st('credibility', -2), expo(2)],
        choices: [
          { id: 'succes', label: 'Je vous souhaite du succès', effects: [st('credibility', 1)], end: 'Vous êtes beau joueur. C’est noté.' },
          { id: 'avocats', label: 'Mes avocats le liront', effects: [st('stress', 2)], end: 'Ils trouveront tout exact.' },
        ],
      },
    },
  },

  // ── 14. La plume propose un discours audacieux ──
  {
    id: 'c_plume_discours', weight: 1,
    eligible: d => rankAtLeast(d, 4) && hasRole(d, 'plume'),
    who: teamSpeaker('plume'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'J’ai écrit quelque chose pour votre discours de dimanche. Pas le texte prudent que vous attendez : un vrai discours, qui nomme les choses et prend des risques. Je vous l’envoie ?',
        choices: [
          { id: 'lire', label: 'Envoyez, je veux le lire', effects: [st('energy', -2)], next: 'proposition' },
          { id: 'prudent', label: 'Non, restons sur le texte validé', effects: [morale(-6), st('stress', -1)], remember: { c_discours_prudent: 1 }, end: 'Bien. Je le range dans un tiroir. Il y en a beaucoup, dans ce tiroir.' },
        ],
        ignore: [morale(-4)],
      },
      proposition: {
        text: d => `Le cœur du texte : vous reconnaissez que votre camp s’est trompé pendant dix ans sur ${DOMAIN_LABELS[d.agendaDomain].toLowerCase()}, et vous proposez de tout remettre à plat.${mem(d, 'c_mentor_ecoute') ? ' Ça prolonge votre retour sur le terrain.' : ''} Ça peut faire de vous une figure. Ou vous couler.`,
        choices: [
          { id: 'audace', label: 'Je le prononce tel quel', hint: 'Un coup de poker', effects: [st('popularity', 4), st('influence', 3), coh(-3), morale(8)], remember: { c_discours_audace: 1 }, risk: { chance: 0.45, scaleWith: 'credibility', fail: 'flop' }, end: 'Salle debout. Les chaînes d’info passent l’extrait en boucle. On s’en souviendra.', later: { months: 6, node: 'heritage' } },
          { id: 'adoucir', label: 'On garde l’idée, on lime les angles', effects: [st('popularity', 1), st('influence', 1), morale(2)], end: 'D’accord. Ce sera bien. Pas inoubliable, mais bien.' },
          { id: 'militants', label: 'On le teste d’abord devant les militants', if: d => d.party.leaderNpcId === 'player', effects: [st('energy', -3), { kind: 'partyMembers', delta: 3 }], next: 'test_militants' },
        ],
      },
      test_militants: {
        text: 'Les militants ont adoré : deux minutes d’applaudissements debout, certains avaient les larmes aux yeux. On le fait à la télévision dimanche ?',
        choices: [
          { id: 'tele', label: 'Oui, tel quel', effects: [st('popularity', 4), st('influence', 3), morale(8)], remember: { c_discours_audace: 1 }, risk: { chance: 0.3, scaleWith: 'credibility', fail: 'flop' }, end: 'Magnifique. Même les éditorialistes hostiles saluent « un moment ».', later: { months: 6, node: 'heritage' } },
          { id: 'entre_nous', label: 'Non, il reste entre nous', effects: [{ kind: 'partyMembers', delta: 2 }, coh(2)], end: 'Un discours de congrès, alors. Ce n’est pas rien.' },
        ],
      },
      flop: {
        text: 'Le passage sur « nos erreurs » a été coupé, sorti de son contexte, et l’opposition le diffuse partout : « Même son camp n’y croit plus ». Je suis désolé·e.',
        effects: [st('popularity', -3), st('credibility', -3), coh(-3)],
        choices: [
          { id: 'pas_faute', label: 'Ce n’est pas votre faute', effects: [morale(4)], end: 'Merci. J’écrirai mieux la prochaine fois.' },
          { id: 'prevoir', label: 'Il fallait prévoir ça', effects: [morale(-8), st('stress', 2)], remember: { c_discours_rate: 1 }, end: 'Vous l’aviez lu avant moi.' },
        ],
      },
      heritage: {
        text: 'On cite encore votre discours : un éditorialiste l’a classé parmi « les dix discours qui ont compté depuis vingt ans ». Je l’ai fait encadrer.',
        effects: [st('influence', 3), st('credibility', 2), momentum(3)],
        choices: [
          { id: 'votre', label: 'C’est votre texte autant que le mien', effects: [morale(6)], end: 'Ça, je l’encadre aussi.' },
          { id: 'autre', label: 'Il en faut un autre, maintenant', effects: [st('energy', -2), morale(2)], end: 'Je m’y mets ce soir.' },
        ],
      },
    },
  },

  // ── 15. Un député de la majorité menace de voter contre (Matignon) ──
  {
    id: 'c_frondeur', weight: 1,
    eligible: d => !!d.government && d.player.rankId === 'premier_ministre',
    who: guestSpeaker('c_le_gall', 'Yannick Le Gall', 'Député de la majorité'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `Je vous préviens : mardi, je vote contre votre budget, et nous sommes une douzaine.${mem(d, 'c_allie_ministeres') ? ' Donner des ministères à nos alliés pendant que nos circonscriptions attendent, c’était la goutte d’eau.' : ''} Sauf si vous sauvez l’hôpital de ma circonscription.`,
        choices: [
          { id: 'hopital', label: 'L’hôpital sera maintenu', hint: 'Les autres voudront la même chose', effects: [eco({ deficit: 0.02 }), gov({ majority: 3 }), st('politicalCapital', -3)], remember: { c_frondeur_achete: 1 }, next: 'liste' },
          { id: 'force', label: 'J’engagerai la responsabilité du gouvernement', hint: 'Le 49.3 : passer en force', effects: [st('popularity', -3), st('credibility', -1), gov({ cohesion: -2 }), st('influence', 2)], risk: { chance: 0.3, scaleWith: 'influence', fail: 'censure' }, end: 'Le texte est considéré comme adopté. On s’en souviendra.', later: { months: 6, node: 'motion' } },
          { id: 'investiture', label: 'Votez contre, et adieu l’investiture', effects: [gov({ majority: 1 }), coh(-2)], remember: { c_frondeur_menace: 1 }, risk: { chance: 0.4, scaleWith: 'influence', fail: 'rebellion' }, end: 'Message reçu. Je m’abstiendrai.' },
          { id: 'dejeuner', label: 'Venez déjeuner à Matignon avec vos collègues', if: d => d.player.stats.energy >= 30, effects: [st('energy', -5), gov({ majority: 2 }), st('influence', 1)], end: 'On viendra. Mais il faudra des actes.', later: { months: 4, node: 'propositions' } },
        ],
        ignore: [gov({ majority: -3 })],
      },
      liste: {
        text: 'Merci. Je vais le dire aux collègues… Justement : trois d’entre eux ont aussi un hôpital, une ligne de train ou une sous-préfecture à sauver.',
        choices: [
          { id: 'non', label: 'Je ne négocie pas au cas par cas', effects: [st('credibility', 1), gov({ majority: -1 })], end: 'Alors ils voteront contre. Moi, je tiens parole.' },
          { id: 'liste', label: 'Envoyez-moi la liste', hint: 'La facture s’allonge', effects: [eco({ deficit: 0.04 }), gov({ majority: 3 }), st('politicalCapital', -2)], end: 'Vous êtes généreux·se. Le budget passera.', later: { months: 6, node: 'facture' } },
        ],
      },
      censure: {
        text: 'Le 49.3 a déclenché une motion de censure. Mes collègues hésitent à la voter : il manque neuf voix pour vous renverser.',
        effects: [gov({ majority: -4 }), st('stress', 4)],
        choices: [
          { id: 'appeler', label: 'Je les appelle un par un', effects: [st('energy', -6), gov({ majority: 3 })], end: 'La motion échoue à quatre voix près. Vous respirez.' },
          { id: 'remaniement', label: 'Je promets un remaniement', effects: [gov({ cohesion: -4, majority: 4 })], end: 'Ça les a calmés. Vos ministres, beaucoup moins.' },
        ],
      },
      rebellion: {
        text: 'Ma réponse : nous serons vingt à voter contre, et nous formerons notre propre groupe. On ne menace pas des députés comme des stagiaires.',
        effects: [gov({ majority: -5 }), coh(-3)],
        choices: [
          { id: 'retirer', label: 'Je retire ma menace', effects: [st('credibility', -2), gov({ majority: 2 })], end: 'Trop tard pour le groupe. Mais je voterai le budget.' },
          { id: 'vent', label: 'Bon vent', effects: [st('influence', 1)], end: 'À la prochaine motion de censure.', later: { months: 5, node: 'motion' } },
        ],
      },
      motion: {
        text: 'Je vous écris pour vous prévenir : avec mes amis, nous voterons la prochaine motion de censure. Nous n’oublions pas comment vous nous avez traités.',
        effects: [gov({ majority: -3 }), st('stress', 2)],
        choices: [
          { id: 'rencontre', label: 'Rencontrons-nous', effects: [st('energy', -3), gov({ majority: 2 })], end: 'Je viendrai. Sans promesse.' },
          { id: 'votez', label: 'Votez-la donc', effects: [st('influence', 1)], end: 'Comptez sur nous.' },
        ],
      },
      propositions: {
        text: 'Le déjeuner avait du bon. Mes collègues et moi avons rédigé dix propositions. Reprenez-en trois, et vous aurez nos voix jusqu’à la fin de la session.',
        choices: [
          { id: 'trois', label: 'J’en reprends trois', effects: [st('politicalCapital', -2), gov({ majority: 4 })], end: 'Marché conclu. C’est un plaisir de travailler avec vous.' },
          { id: 'une', label: 'Une seule, et c’est déjà beaucoup', effects: [gov({ majority: 1 })], end: 'C’est maigre. On s’en contentera.' },
        ],
      },
      facture: {
        text: 'Petite alerte : un journal a fait le compte de vos « arrangements » budgétaires. 400 millions, et un titre qui pique : « Le budget clientéliste ».',
        effects: [st('credibility', -3), expo(3), eco({ deficit: 0.03 })],
        choices: [
          { id: 'assumer', label: 'J’assume : ce sont des services publics', effects: [st('popularity', 1), st('credibility', -1)], end: 'Je dirai la même chose. Ça se défend.' },
          { id: 'annuler', label: 'On annule les moins défendables', effects: [gov({ majority: -3 }), st('credibility', 2)], end: 'Certains collègues vont le prendre mal.' },
        ],
      },
    },
  },

  // ── 16. Le chef du parti allié veut plus de ministères ──
  {
    id: 'c_allie_ministeres', weight: 1,
    eligible: d => !!d.coalition && auPouvoir(d),
    who: d => ({ who: 'dlg:c_aurignac', from: 'Sabine Aurignac', role: `Présidente de ${d.coalition?.name ?? 'votre partenaire de coalition'}` }),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `On ne va pas se mentir : nos ${d.coalition?.ministries ?? 2} ministères ne reflètent pas notre poids dans la majorité. Je veux l’Écologie de plein exercice et un secrétariat d’État au Logement. Sinon, mon bureau national votera la sortie du gouvernement.`,
        choices: [
          { id: 'ceder', label: 'Vous aurez les deux', hint: 'Votre parti va grincer', effects: [mood(12), coh(-4), st('politicalCapital', -2)], remember: { c_allie_ministeres: 1 }, end: 'Voilà un partenariat équilibré.', later: { months: 6, node: 'bilan' } },
          { id: 'un', label: 'L’Écologie, pas le Logement', effects: [mood(5), coh(-2)], remember: { c_allie_ministeres: 1 }, risk: { chance: 0.35, scaleWith: 'influence', fail: 'ultimatum' }, end: 'Ça ira. Pour cette fois.' },
          { id: 'europeennes', label: 'Je vous offre plutôt la tête de liste aux européennes', if: d => d.player.stats.influence >= 45, effects: [mood(6), st('influence', -2)], end: 'Intéressant. Très intéressant. J’en parle à mon bureau.' },
          { id: 'refuser', label: 'Le gouvernement ne se négocie pas', effects: [mood(-10), st('influence', 2), coh(2)], next: 'ultimatum' },
        ],
        ignore: [mood(-6)],
      },
      ultimatum: {
        text: 'Mon bureau national se réunit jeudi. Je ne pourrai pas les retenir sans un geste.',
        choices: [
          { id: 'loi', label: 'Un geste : votre loi sur le logement passera', effects: [mood(6), eco({ deficit: 0.03 })], end: 'Ça, je peux le vendre.', later: { months: 6, node: 'bilan' } },
          { id: 'partez', label: 'Partez, si vous voulez', hint: 'La majorité perdra leurs voix', effects: [{ kind: 'coalition', leave: true }, st('influence', 2), coh(3)], remember: { c_allie_parti: 1 }, end: 'Très bien. Vous assumerez.', later: { months: 4, node: 'retour' } },
          { id: 'bureau', label: 'Laissez-moi parler à votre bureau', effects: [st('energy', -4), mood(8)], risk: { chance: 0.45, scaleWith: 'influence', fail: 'sortie' }, end: 'Vous les avez séduits. Pour l’instant.' },
        ],
      },
      sortie: {
        text: 'Votre intervention a été mal reçue : « On ne nous parle pas comme à des militants ». Le bureau a voté la sortie à 60 %.',
        effects: [{ kind: 'coalition', leave: true }, st('credibility', -2), st('stress', 3)],
        choices: [
          { id: 'respecter', label: 'Je respecte ce vote', effects: [st('credibility', 1)], remember: { c_allie_parti: 1 }, end: 'Merci. On se retrouvera peut-être.', later: { months: 4, node: 'retour' } },
          { id: 'regretter', label: 'Vous le regretterez', effects: [st('influence', 1)], remember: { c_allie_parti: 1 }, end: 'On verra qui regrette.' },
        ],
      },
      bilan: {
        text: 'Bilan d’étape : nos ministres travaillent bien, et nos électeurs sont contents. Mes députés voteront vos textes jusqu’à l’été.',
        effects: [mood(5), st('influence', 1)],
        choices: [
          { id: 'merci', label: 'Merci, Sabine', effects: [st('stress', -1)], end: 'C’est ça, une coalition qui marche.' },
          { id: 'fiscal', label: 'J’aurai besoin de vous sur la réforme fiscale', effects: [st('politicalCapital', -1), mood(-2)], end: 'On en parlera. Ça aura un prix.' },
        ],
      },
      retour: {
        text: 'Quatre mois dans l’opposition nous ont coûté cher dans les sondages. Si vous rouvrez la porte, nous revenons, avec un seul ministère.',
        choices: [
          { id: 'ouvrir', label: 'La porte est ouverte', effects: [{ kind: 'coalition', open: true }, st('politicalCapital', -2)], end: 'Alors, à la table des négociations.' },
          { id: 'tard', label: 'Trop tard', effects: [st('influence', 1)], end: 'Dommage. Pour vous comme pour nous.' },
        ],
      },
    },
  },

  // ── 17. Un proche s'inquiète de votre santé ──
  {
    id: 'c_sante_proche', weight: 1,
    eligible: d => rankAtLeast(d, 3) && (d.player.health < 70 || d.player.stats.stress > 55),
    who: d => {
      const p = d.family?.parents.find(x => x.alive);
      return familySpeaker(p ? (p.gender === 'm' ? 'Papa' : 'Maman') : 'Anne, ta sœur')(d);
    },
    start: 'debut',
    nodes: {
      debut: {
        text: d => `Je t’ai vu${fem(d) ? 'e' : ''} à la télé hier soir. Tu avais les traits tirés, tu cherchais tes mots. Tu dors combien d’heures par nuit ? Et ne me mens pas.`,
        choices: [
          { id: 'verite', label: 'Quatre heures. Mais ça va', effects: [st('stress', -1)], next: 'rendez_vous' },
          { id: 'rassurer', label: 'Ne t’inquiète pas, tout va bien', effects: [st('stress', 1)], remember: { c_sante_ignoree: 1 }, end: 'Tu dis toujours ça. Prends soin de toi, je t’en supplie.', later: { months: 5, node: 'malaise' } },
          { id: 'repos', label: 'Tu as raison, je prends un week-end', hint: 'L’agenda en pâtira', effects: [st('energy', 8), st('stress', -6), { kind: 'health', delta: 3 }, st('politicalCapital', -2)], remember: { c_sante_repos: 1 }, end: 'Enfin ! Viens à la maison, je te fais ton plat préféré.' },
        ],
        ignore: [st('stress', 2)],
      },
      rendez_vous: {
        text: 'Quatre heures… Le médecin de famille peut te voir samedi. J’ai pris rendez-vous. Tu y vas, ou je viens te chercher moi-même.',
        choices: [
          { id: 'promis', label: 'J’irai, promis', effects: [st('energy', -2), { kind: 'health', delta: 4 }, st('stress', -2)], remember: { c_sante_repos: 1 }, end: 'Je t’appelle samedi soir pour savoir.', later: { months: 4, node: 'bonne_mine' } },
          { id: 'conseil', label: 'Pas le temps, j’ai une réunion de crise', hint: 'L’urgence peut attendre, la santé non', effects: [st('politicalCapital', 1), { kind: 'health', delta: -2 }], remember: { c_sante_ignoree: 1 }, end: 'Il y aura toujours une réunion de crise.', later: { months: 5, node: 'malaise' } },
          { id: 'ensemble', label: 'Tu peux venir avec moi ?', effects: [st('energy', -3), { kind: 'health', delta: 4 }, st('stress', -4)], end: 'Évidemment. Comme quand tu étais petit·e.', later: { months: 4, node: 'bonne_mine' } },
        ],
      },
      malaise: {
        text: 'Je viens de lire que tu as fait un malaise pendant un déplacement. Le communiqué parle d’un « coup de fatigue ». Je veux la vérité, et je veux que tu t’arrêtes.',
        effects: [{ kind: 'health', delta: -6 }, st('stress', 4), expo(2)],
        choices: [
          { id: 'arret', label: 'Je m’arrête une semaine', effects: [st('energy', 10), st('stress', -6), { kind: 'health', delta: 4 }, momentum(-3)], end: 'Merci. On n’a qu’une santé, tu sais.' },
          { id: 'fatigue', label: 'C’était vraiment un coup de fatigue', effects: [st('stress', 2)], end: 'Je ne te crois pas. Mais je t’aime.' },
          { id: 'secret', label: 'Je consulte, mais en secret', hint: 'Si ça se sait…', effects: [{ kind: 'health', delta: 4 }], risk: { chance: 0.4, scaleWith: 'credibility', fail: 'fuite' }, end: 'Discrètement, alors. Je ne dirai rien à personne.' },
        ],
      },
      fuite: {
        text: 'Un hebdomadaire publie des photos de toi à l’hôpital et parle de « santé cachée ». Je suis hors de moi : qui a pu faire ça ?',
        effects: [expo(4), st('credibility', -3), st('popularity', -1)],
        choices: [
          { id: 'bulletin', label: 'Je publie un bulletin de santé complet', effects: [st('credibility', 3), st('stress', -1)], remember: { c_sante_transparence: 1 }, end: 'C’est mieux comme ça. La transparence, tu le dis toi-même.' },
          { id: 'plainte', label: 'Je porte plainte', effects: [st('energy', -2), st('stress', 1)], end: 'Ça ne changera rien, mais fais-le.' },
        ],
      },
      bonne_mine: {
        text: 'Tu as bonne mine sur les dernières photos. Le médecin avait raison : un peu de sommeil et tout change. Ça fait plaisir à voir.',
        effects: [{ kind: 'health', delta: 3 }, st('stress', -3), st('energy', 4)],
        choices: [
          { id: 'merci', label: 'Merci de m’avoir secoué·e', effects: [st('stress', -1)], end: 'C’est mon rôle. Et je recommencerai.' },
          { id: 'diner', label: 'Dîner dimanche, comme avant ?', effects: [st('energy', -1), st('stress', -2)], end: 'Avec plaisir. J’achète le dessert.' },
        ],
      },
    },
  },

  // ── 18. L'ancien mentor vous trouve changé·e ──
  {
    id: 'c_mentor', weight: 1,
    eligible: d => rankAtLeast(d, 3),
    who: guestSpeaker('c_ferrand', 'Jacques Ferrand', 'Votre ancien mentor'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => {
          const g = griefs(d);
          const passe = mem(d, 'defi_chef') ? ' Toi qui tenais tête à ton chef de parti, à l’époque.' : '';
          return `Je te regarde depuis ma retraite et je ne te reconnais plus.${g.length ? ` On me parle de ${g.join(', ')}.` : ' Tu parles comme un communiqué de presse.'}${passe} Tu te souviens pourquoi tu as commencé ?`;
        },
        choices: [
          { id: 'ecouter', label: 'Tu as raison. Dis-moi ce que tu vois', effects: [st('stress', 1), st('credibility', 1)], next: 'conseil' },
          { id: 'compromis', label: 'Le pouvoir, c’est fait de compromis', effects: [st('influence', 1)], remember: { c_mentor_rompu: 1 }, end: 'Les compromis, oui. Les compromissions, non. Je ne t’écrirai plus.', later: { months: 8, node: 'tribune' } },
          { id: 'discours', label: 'Tu as entendu mon grand discours, pourtant ?', if: d => mem(d, 'c_discours_audace') > 0, effects: [st('credibility', 1), st('stress', -1)], end: 'Je l’ai entendu. C’est pour ça que j’ose t’écrire : tu peux encore être toi.' },
        ],
        ignore: [st('stress', 1)],
      },
      conseil: {
        text: d => `Entoure-toi de gens qui te disent non. Retourne sur le terrain, sans caméras. Et renonce à un pouvoir que tu n’es pas ${fem(d) ? 'obligée' : 'obligé'} de garder : c’est ça qu’on retient.`,
        choices: [
          { id: 'terrain', label: 'Je retourne sur le terrain, sans presse', effects: [st('energy', -6), st('popularity', 2), st('credibility', 2), st('stress', -2)], remember: { c_mentor_ecoute: 1 }, end: 'Ça, c’est toi. Je suis content.', later: { months: 6, node: 'fier' } },
          { id: 'renoncer', label: 'Renoncer à un pouvoir… lequel ?', effects: [st('stress', 1)], next: 'renoncer' },
          { id: 'temps', label: 'Je note, mais je n’ai pas le temps', effects: [st('stress', 1)], remember: { c_mentor_rompu: 1 }, end: 'Personne n’a le temps. C’est bien le problème.' },
        ],
      },
      renoncer: {
        text: 'Confie une nomination qui te revient à une commission indépendante. Un geste, un seul, qui te coûte vraiment. Les gens sentent la différence.',
        choices: [
          { id: 'commission', label: 'D’accord : une commission indépendante', hint: 'Vous perdez un levier', effects: [st('politicalCapital', -4), st('influence', -2), st('credibility', 4), st('popularity', 2)], remember: { c_mentor_ecoute: 1 }, end: 'Voilà. Je suis fier de toi.', later: { months: 6, node: 'fier' } },
          { id: 'naif', label: 'C’est trop naïf', effects: [st('influence', 1)], remember: { c_mentor_rompu: 1 }, end: 'Naïf. C’est le mot que j’employais, à ton âge, pour les gens qui avaient raison.' },
        ],
      },
      tribune: {
        text: 'Je publie demain une tribune : « Lettre à un ancien élève ». Je ne te nomme pas. Tout le monde comprendra.',
        effects: [st('credibility', -3), st('popularity', -1), expo(1)],
        choices: [
          { id: 'appeler', label: 'Je t’appelle', effects: [st('energy', -3), st('credibility', 1)], end: 'Trop tard pour la tribune. Pas pour un café.' },
          { id: 'publie', label: 'Publie', effects: [st('influence', 1), st('stress', 1)], end: 'Je publie.' },
        ],
      },
      fier: {
        text: 'On m’a raconté ton geste. Les gens en parlent encore, et pas seulement à Paris. Je n’ai rien à ajouter, sinon : continue.',
        effects: [st('popularity', 2), st('credibility', 2), st('stress', -3)],
        choices: [
          { id: 'merci', label: 'Merci, Jacques', effects: [st('stress', -1)], end: 'Merci à toi.' },
          { id: 'cafe', label: 'Viens me voir, on a des choses à se dire', effects: [st('energy', -2), st('influence', 1)], end: 'Je viendrai. Prépare du vrai café, pas celui des ministères.' },
        ],
      },
    },
  },

  // ── 19. Le conseiller diplomatique pendant un sommet ──
  {
    id: 'c_sherpa_sommet', weight: 1,
    eligible: d => (!!d.presidency || d.player.rankId === 'premier_ministre') && hasRole(d, 'sherpa'),
    who: teamSpeaker('sherpa'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `3 h du matin, Bruxelles. Le texte final est bloqué : Berlin refuse le paragraphe sur l’emprunt commun, et Rome menace de tout faire capoter s’il disparaît.${mem(d, 'c_valdovie_soutien') ? ' Et nos partenaires de l’Est veulent une mention de la Valdovie, grâce à vous.' : ''} Il faut trancher : je dis quoi à mes homologues ?`,
        choices: [
          { id: 'berlin', label: 'On s’aligne sur Berlin', effects: [rel('allemagne', 6), rel('ue', -2), eco({ confidence: 1 }), prestige(-1)], remember: { c_sommet_berlin: 1 }, end: 'Entendu. Rome va bouder, mais le texte passera.', later: { months: 5, node: 'rome_boude' } },
          { id: 'emprunt', label: 'On tient l’emprunt, quitte à finir sans texte', hint: 'Tout ou rien', effects: [rel('allemagne', -4), prestige(2), st('popularity', 1)], risk: { chance: 0.5, scaleWith: 'influence', fail: 'echec' }, remember: { c_sommet_emprunt: 1 }, end: 'Berlin a cédé à 5 h ! L’emprunt commun est dans le texte. Historique.', later: { months: 6, node: 'fonds' } },
          { id: 'compromis', label: 'Proposez un emprunt limité, fléché vers la défense', effects: [st('energy', -3), rel('allemagne', 2), rel('ue', 3), prestige(1)], next: 'compromis' },
          { id: 'valdovie', label: 'Lâchez la mention de la Valdovie contre l’emprunt', if: d => mem(d, 'c_valdovie_soutien') > 0, hint: 'Cynique', effects: [prestige(3), hostile('valdovie', -3), rel('allemagne', 2)], end: 'Cynique, mais efficace. Tout le monde signe.', later: { months: 6, node: 'fonds' } },
        ],
        ignore: [prestige(-2)],
      },
      compromis: {
        text: 'La chancelière accepte, à une condition : un contrôle strict de la Commission sur nos dépenses. Ça va hurler à Paris.',
        choices: [
          { id: 'accepter', label: 'Acceptez', effects: [rel('ue', 3), st('credibility', 1), seg('populaires', -1), eco({ confidence: 2 })], end: 'C’est signé. Le communiqué parle d’une « percée française ».', later: { months: 6, node: 'fonds' } },
          { id: 'souverainete', label: 'Refusez : c’est notre souveraineté', effects: [st('popularity', 2), rel('allemagne', -3)], risk: { chance: 0.4, scaleWith: 'influence', fail: 'echec' }, end: 'Elle a cédé sur le contrôle. Vous êtes redoutable à 4 h du matin.' },
        ],
      },
      echec: {
        text: 'Échec. Le sommet se termine sans texte, et la presse allemande dénonce « l’intransigeance française ». Je suis désolé.',
        effects: [prestige(-4), rel('allemagne', -4), rel('ue', -3), st('credibility', -2)],
        choices: [
          { id: 'offensive', label: 'Je donne une conférence de presse offensive', effects: [st('popularity', 2), tension(2)], end: 'Ça plaira à Paris. Moins à Berlin.' },
          { id: 'retravailler', label: 'On retravaille un texte pour le prochain sommet', effects: [st('energy', -3), st('credibility', 1)], end: 'Je reprends langue avec mon homologue dès lundi.' },
        ],
      },
      rome_boude: {
        text: 'L’Italie nous fait payer le sommet : elle bloque notre candidat à la tête de l’Agence européenne de défense. Rome a de la mémoire.',
        effects: [prestige(-2), rel('ue', -2)],
        choices: [
          { id: 'appeler', label: 'J’appelle Rome moi-même', effects: [st('energy', -2), rel('ue', 2)], end: 'Un coup de fil à la bonne personne change parfois tout.' },
          { id: 'tant_pis', label: 'Tant pis, trouvez un plan B', effects: [st('stress', 1)], end: 'J’ai déjà deux noms en tête.' },
        ],
      },
      fonds: {
        text: 'Les premiers fonds de l’emprunt européen arrivent : 40 milliards pour la France, fléchés vers l’industrie et la défense. Nos usines vont tourner.',
        effects: [eco({ growth: 0.2, confidence: 3 }), prestige(3), st('popularity', 2)],
        choices: [
          { id: 'merci', label: 'Merci pour ces nuits blanches', effects: [morale(5)], end: 'C’était un plaisir. Presque.' },
          { id: 'annonce', label: 'J’irai l’annoncer dans une usine', effects: [st('energy', -2), seg('populaires', 2)], end: 'Je vous trouve la plus belle. Avec des grues.' },
        ],
      },
    },
  },

  // ── 20. L'équipe de campagne la veille du débat ──
  {
    id: 'c_veille_debat', weight: 2,
    eligible: d => d.player.rankId === 'candidat_presidence' && hasRole(d, 'directeur_campagne'),
    who: teamSpeaker('directeur_campagne'),
    start: 'debut',
    nodes: {
      debut: {
        text: d => `Dernier point avant le débat de demain. ${mem(d, 'c_cac_cede') ? 'Ils vous attaqueront sur le cadeau fiscal aux grands groupes, c’est certain. ' : ''}${mem(d, 'c_sante_ignoree') ? 'Et sur votre santé : la rumeur tourne. ' : ''}Il faut choisir une stratégie : on attaque, ou on reste au-dessus de la mêlée ?`,
        choices: [
          { id: 'attaque', label: 'On attaque dès la première minute', hint: 'Ça passe ou ça casse', effects: [momentum(4), st('popularity', 2), st('stress', 3)], remember: { c_debat_attaque: 1 }, risk: { chance: 0.45, scaleWith: 'credibility', fail: 'contre' }, end: 'Vous l’avez mis K.-O. au quart d’heure. Les sondages flash vous donnent vainqueur.', later: { months: 3, node: 'trace' } },
          { id: 'hauteur', label: 'On reste calme et précis', effects: [st('credibility', 3), momentum(1), st('energy', -2)], next: 'nuit' },
          { id: 'ton', label: 'On reprend le ton de mon grand discours', if: d => mem(d, 'c_discours_audace') > 0, effects: [momentum(3), st('influence', 2)], end: 'Vos partisans vont adorer. Les indécis aussi, peut-être.' },
          { id: 'bulletin', label: 'Je publie mon bulletin de santé ce soir', if: d => mem(d, 'c_sante_ignoree') > 0 && !mem(d, 'c_sante_transparence'), effects: [st('credibility', 2), expo(-3), st('stress', -2)], end: 'Ça désamorce tout. Bien vu.' },
        ],
      },
      nuit: {
        text: 'D’accord. Il nous reste la nuit : on répète avec un sparring-partner qui joue votre adversaire, ou vous dormez huit heures ?',
        choices: [
          { id: 'repeter', label: 'On répète jusqu’à 2 h', effects: [st('energy', -6), dos('economie', 4), st('credibility', 2)], end: 'Le sparring vous a mis en difficulté deux fois. Demain, ça n’arrivera pas.', later: { months: 3, node: 'trace' } },
          { id: 'dormir', label: 'Je dors', effects: [st('energy', 6), st('stress', -4)], end: 'Sage. Un cerveau reposé vaut dix fiches.' },
          { id: 'phrase', label: 'On prépare une petite phrase qui tue', effects: [momentum(3)], remember: { c_debat_phrase: 1 }, risk: { chance: 0.35, scaleWith: 'credibility', fail: 'contre' }, end: 'La phrase a fait mouche. On ne parle que de ça.', later: { months: 3, node: 'trace' } },
        ],
      },
      contre: {
        text: 'Ça s’est retourné contre nous : il vous a coupé avec un chiffre que vous ne connaissiez pas, et la séquence tourne en boucle. Les sondages flash le donnent gagnant.',
        effects: [momentum(-5), st('credibility', -3), st('popularity', -2)],
        choices: [
          { id: 'reseaux', label: 'On contre-attaque sur les réseaux', effects: [momentum(2), expo(2)], end: 'On fait de notre mieux. Les militants sont mobilisés.' },
          { id: 'tourner', label: 'On assume et on passe à autre chose', effects: [st('stress', -1), st('credibility', 1)], end: 'La campagne est longue. Courage.', later: { months: 3, node: 'trace' } },
        ],
      },
      trace: {
        text: d => `Petit bilan : ${mem(d, 'c_debat_attaque') ? 'votre offensive du débat est restée dans les mémoires, en bien comme en mal' : mem(d, 'c_debat_phrase') ? 'votre petite phrase du débat est devenue un slogan' : 'le débat vous a installé dans une image de sérieux'}. Les études qualitatives montrent que les électeurs s’en souviennent encore.`,
        effects: [momentum(2), st('credibility', 1)],
        choices: [
          { id: 'merci', label: 'Merci pour cette campagne', effects: [morale(5)], end: 'C’était un honneur.' },
          { id: 'relacher', label: 'On ne relâche rien', effects: [st('energy', -2), momentum(2)], end: 'Jamais.' },
        ],
      },
    },
  },
];

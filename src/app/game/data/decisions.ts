import { formationDecision } from '../engine/government';
import {
  DOMAIN_LABELS, Decision, DecisionChoice, Domain, EffectContext, GameState,
} from '../models/game.models';
import type { Rng } from '../engine/rng';
import { rankOrder } from './ranks';

/* ============================================================
 *  Gabarits de décisions (interviews, crises, parti, réseau…)
 *  Chaque gabarit fabrique une Decision à partir de l'état courant.
 * ============================================================ */

const QUESTIONS: Record<Domain, string[]> = {
  education: [
    'Faut-il fortement revaloriser le salaire des enseignants ?',
    'Le collège unique a-t-il encore un avenir ?',
  ],
  sante: [
    'Comment sauver l’hôpital public ?',
    'Faut-il dérembourser certains médicaments ?',
  ],
  numerique: [
    'Faut-il interdire les réseaux sociaux aux moins de 15 ans ?',
    'Comment protéger les emplois face à l’intelligence artificielle ?',
  ],
  territoires: [
    'Les campagnes sont-elles abandonnées par l’État ?',
    'Faut-il rouvrir les petites lignes de train ?',
  ],
  justice: [
    'La justice est-elle trop lente ?',
    'Faut-il construire plus de prisons ou mieux préparer la réinsertion ?',
  ],
  economie: [
    'Le chômage repart à la hausse. Que proposez-vous, concrètement ?',
    'Faut-il augmenter les impôts des plus aisés pour réduire le déficit ?',
  ],
  ecologie: [
    'Faut-il interdire les vols intérieurs quand le train existe ?',
    'Le nucléaire est-il la solution à la transition énergétique ?',
  ],
  securite: [
    'Les violences urbaines augmentent : faut-il plus de policiers dans la rue ?',
    'Êtes-vous favorable à la vidéosurveillance algorithmique ?',
  ],
  diplomatie: [
    'L’Europe doit-elle se doter d’une défense commune ?',
    'Quelle position face aux tensions commerciales avec les grandes puissances ?',
  ],
  social: [
    'La réforme des retraites doit-elle être abrogée ?',
    'Faut-il revaloriser le SMIC au-delà de l’inflation ?',
  ],
};

const CRISES: { domain: Domain; title: string; context: string; visit: string }[] = [
  { domain: 'ecologie', title: 'Crise : inondations dans le Sud-Ouest', context: 'Des crues historiques ravagent plusieurs vallées.', visit: 'Bottes aux pieds, vous aidez à déblayer. Les images touchent.' },
  { domain: 'social', title: 'Crise : grève des transports', context: 'Le pays est paralysé par une grève reconductible.', visit: 'Vous passez la nuit au dépôt avec les grévistes et les usagers.' },
  { domain: 'economie', title: 'Crise : krach boursier', context: 'Les marchés dévissent, une grande banque vacille.', visit: 'Vous visitez une PME inquiète : votre écoute est saluée.' },
  { domain: 'diplomatie', title: 'Crise : sommet européen de la dernière chance', context: 'Un sommet décisif s’ouvre sur fond de tensions commerciales.', visit: 'Vous multipliez les rencontres à Bruxelles : vous gagnez en stature.' },
  { domain: 'sante', title: 'Crise : hôpitaux saturés par l’épidémie hivernale', context: 'Les urgences ferment la nuit dans plusieurs villes.', visit: 'Vous passez une nuit aux urgences aux côtés des soignants.' },
  { domain: 'numerique', title: 'Crise : cyberattaque contre les hôpitaux', context: 'Un rançongiciel paralyse une dizaine d’hôpitaux.', visit: 'Vous rencontrez les équipes informatiques qui reconstruisent les systèmes.' },
  { domain: 'education', title: 'Crise : une rentrée sans professeurs', context: 'Des milliers de classes n’ont pas d’enseignant.', visit: 'Vous assistez à une rentrée improvisée dans un collège de banlieue.' },
  { domain: 'territoires', title: 'Crise : fermeture de la dernière usine de la vallée', context: '800 emplois menacés dans une ville moyenne.', visit: 'Vous passez la journée avec les salariés devant les grilles.' },
  { domain: 'justice', title: 'Crise : une évasion spectaculaire', context: 'Un détenu dangereux s’évade lors d’un transfert.', visit: 'Vous visitez une prison surpeuplée : les images marquent.' },
  { domain: 'securite', title: 'Crise : nuits de violences urbaines', context: 'Plusieurs villes connaissent des nuits de dégradations.', visit: 'Vous allez à la rencontre des habitants et des commerçants touchés.' },
];

let localId = 0;
const uid = (d: GameState, prefix: string) => `${prefix}-${d.week}-${++localId}`;
const hasPending = (d: GameState, tag: string) => d.pendingDecisions.some(x => x.tag === tag);

/** Réponses d'interview / débat : la maîtrise du dossier conditionne le succès */
function answerChoices(domain: Domain, m: number): DecisionChoice[] {
  return [
    {
      id: 'precis', label: 'Réponse précise, chiffres à l’appui',
      hint: 'Brillant si le dossier est maîtrisé, désastreux sinon.',
      effects: [
        { kind: 'stat', stat: 'credibility', delta: 6 * m }, { kind: 'stat', stat: 'popularity', delta: 2 * m },
        { kind: 'momentum', delta: 4 * m },
      ],
      risk: {
        baseChance: 0.9, scaleWith: 'dossier', scaleWeight: 1,
        onFailure: [{ kind: 'stat', stat: 'credibility', delta: -9 * m }, { kind: 'stat', stat: 'stress', delta: 8 }],
        failureNews: `Erreur de chiffres sur ${DOMAIN_LABELS[domain].toLowerCase()} : les fact-checkers s’en donnent à cœur joie.`,
      },
      outcome: 'Démonstration solide, saluée par les éditorialistes.',
    },
    {
      id: 'elements', label: 'Dérouler les éléments de langage du parti',
      hint: 'Sans risque. Le parti apprécie, le public s’ennuie.',
      effects: [
        { kind: 'faction', factionId: '*', delta: 2 }, { kind: 'stat', stat: 'popularity', delta: 1 },
        { kind: 'stat', stat: 'credibility', delta: -1 },
      ],
      outcome: 'Prestation calibrée, sans relief.',
    },
    {
      id: 'choc', label: 'Lâcher une petite phrase choc',
      hint: 'Fait le buzz… dans un sens ou dans l’autre.',
      effects: [
        { kind: 'stat', stat: 'popularity', delta: 5 * m }, { kind: 'momentum', delta: 6 * m },
        { kind: 'faction', factionId: 'ligne_dure', delta: 3 }, { kind: 'exposure', delta: 3 },
      ],
      risk: {
        baseChance: 0.5, scaleWith: 'credibility', scaleWeight: 0.6,
        onFailure: [
          { kind: 'stat', stat: 'popularity', delta: -6 * m }, { kind: 'stat', stat: 'credibility', delta: -4 },
          { kind: 'stat', stat: 'stress', delta: 10 },
        ],
        failureNews: 'La petite phrase se retourne contre vous : tollé sur les réseaux.',
      },
      outcome: 'La formule est reprise partout : vous existez.',
    },
    {
      id: 'esquive', label: 'Botter en touche',
      hint: 'Vous perdez un peu de crédit, mais pas la face.',
      effects: [{ kind: 'stat', stat: 'credibility', delta: -3 }],
      outcome: 'Le journaliste insiste, vous esquivez. Personne n’est dupe.',
    },
  ];
}

type Template = (d: GameState, rng: Rng, ctx: EffectContext) => Decision | null;

const TEMPLATES: Record<string, Template> = {
  former_gouvernement: d => formationDecision(d, !!d.government?.composition),
  interview: (d, rng) => {
    const domain = d.agendaDomain;
    return {
      id: uid(d, 'dec'), tag: 'interview', week: d.week, deadlineWeek: d.week, source: 'medias', domain,
      title: 'Plateau TV en direct',
      context: `« ${rng.pick(QUESTIONS[domain])} » Le présentateur vous fixe. Maîtrise du dossier ${DOMAIN_LABELS[domain]} : ${Math.round(d.player.dossiers[domain].mastery)}/100.`,
      choices: answerChoices(domain, 1),
    };
  },

  debat: (d, rng, ctx) => {
    const domain = rng.pick(['economie', 'social', 'securite', 'ecologie', 'diplomatie'] as Domain[]);
    const opponent = d.npcs.find(n => n.id === ctx.targetId)?.name ?? 'votre adversaire';
    return {
      id: uid(d, 'dec'), tag: 'debat', week: d.week, deadlineWeek: d.week, source: 'carriere', domain,
      title: `Débat télévisé face à ${opponent}`,
      context: `Le débat bascule sur ${DOMAIN_LABELS[domain].toLowerCase()} : « ${rng.pick(QUESTIONS[domain])} » Des millions de téléspectateurs regardent.`,
      choices: answerChoices(domain, 2),
    };
  },

  scandale: (d, rng) => {
    if (hasPending(d, 'scandale')) return null;
    const depassement = !!d.player.flags['depassement'];
    const pitch = depassement
      ? 'Un média révèle que vos comptes de campagne dépassent le plafond légal.'
      : rng.pick([
          'Un hebdomadaire satirique publie des notes de frais embarrassantes.',
          'Des messages privés où vous moquez un allié fuitent dans la presse.',
          'Un proche que vous avez nommé est mis en cause pour favoritisme.',
        ]);
    return {
      id: uid(d, 'dec'), tag: 'scandale', week: d.week, deadlineWeek: d.week + 1, source: 'medias',
      title: 'Révélations dans la presse', context: pitch,
      choices: [
        {
          id: 'dementir', label: 'Démentir en bloc',
          hint: 'Si l’affaire tient, c’est la chute.',
          effects: [{ kind: 'exposure', delta: -15 }],
          risk: {
            baseChance: (depassement ? 0.85 : 0.6) * (d.player.staff.includes('spin_doctor') ? 0.6 : 1), scaleWith: 'credibility', scaleWeight: 0.5,
            onFailure: [
              { kind: 'stat', stat: 'popularity', delta: -12 }, { kind: 'stat', stat: 'credibility', delta: -15 },
              { kind: 'cohesion', delta: -8 }, { kind: 'stat', stat: 'stress', delta: 15 },
            ],
            failureNews: 'De nouveaux documents contredisent votre démenti.',
          },
          outcome: 'L’affaire fait pschitt.',
        },
        {
          id: 'assumer', label: 'Reconnaître et présenter des excuses',
          hint: 'Coûteux à court terme, assainit la situation.',
          effects: [
            { kind: 'stat', stat: 'popularity', delta: -5 }, { kind: 'stat', stat: 'credibility', delta: 3 },
            { kind: 'exposure', delta: -35 }, { kind: 'flag', key: 'depassement', value: false },
            ...(depassement ? [{ kind: 'funds' as const, account: 'personal' as const, delta: -8000 }] : []),
          ],
          outcome: 'Votre franchise surprend. L’orage passe.',
        },
        {
          id: 'contre_attaque', label: 'Dénoncer un « acharnement médiatique »',
          hint: 'Galvanise la ligne dure, agace le reste.',
          effects: [
            { kind: 'faction', factionId: 'ligne_dure', delta: 8 }, { kind: 'faction', factionId: 'moderes', delta: -5 },
            { kind: 'stat', stat: 'popularity', delta: -2 }, { kind: 'exposure', delta: -10 },
          ],
          risk: {
            baseChance: 0.4, scaleWith: 'influence', scaleWeight: 0.5,
            onFailure: [{ kind: 'stat', stat: 'credibility', delta: -8 }],
            failureNews: 'La contre-attaque tombe à plat : « Une défense de manuel », raille la presse.',
          },
          outcome: 'Vos soutiens font bloc.',
        },
      ],
    };
  },

  ligne_parti: (d, rng) => {
    const domain = rng.pick(['economie', 'social', 'securite', 'ecologie'] as Domain[]);
    const side = d.party.position < 0 ? -1 : 1;
    return {
      id: uid(d, 'dec'), tag: 'ligne_parti', week: d.week, deadlineWeek: d.week + 2, source: 'parti', domain,
      title: 'Bureau national : quelle ligne ?',
      context: `Le parti doit trancher sa position sur ${DOMAIN_LABELS[domain].toLowerCase()}. Les courants attendent de voir de quel côté vous vous rangez.`,
      choices: [
        {
          id: 'dure', label: 'Soutenir la motion de la ligne dure',
          effects: [{ kind: 'faction', factionId: 'ligne_dure', delta: 10 }, { kind: 'faction', factionId: 'moderes', delta: -6 }, { kind: 'cohesion', delta: -3 }, { kind: 'stance', delta: 8 * side }],
          outcome: 'La ligne dure note votre soutien.',
        },
        {
          id: 'moderes', label: 'Porter la synthèse des modérés',
          effects: [{ kind: 'faction', factionId: 'moderes', delta: 8 }, { kind: 'faction', factionId: 'ligne_dure', delta: -4 }, { kind: 'cohesion', delta: 4 }, { kind: 'stance', delta: -6 * side }],
          outcome: 'Une synthèse de plus. Le parti respire.',
        },
        {
          id: 'reformistes', label: 'Défendre l’amendement réformiste',
          requires: { domain, minMastery: 40 },
          hint: 'Exige de maîtriser le dossier (40).',
          effects: [{ kind: 'faction', factionId: 'reformistes', delta: 12 }, { kind: 'stat', stat: 'credibility', delta: 3 }, { kind: 'faction', factionId: 'ligne_dure', delta: -5 }],
          outcome: 'Votre intervention technique impressionne.',
        },
        {
          id: 'absent', label: 'Ne pas prendre part au vote',
          effects: [{ kind: 'faction', factionId: '*', delta: -2 }, { kind: 'stat', stat: 'politicalCapital', delta: 3 }],
          outcome: 'Prudence… ou manque de courage ?',
        },
      ],
    };
  },

  renvoi_ascenseur: (d, _rng, ctx) => {
    const c = d.contacts.find(x => x.id === ctx.targetId);
    if (!c || hasPending(d, `renvoi-${c.id}`)) return null;
    return {
      id: uid(d, 'dec'), tag: `renvoi-${c.id}`, week: d.week, deadlineWeek: d.week + 2, source: 'reseau', targetId: c.id,
      title: `${c.name.split(' (')[0]} vous rappelle votre dette`,
      context: `« Vous vous souvenez de notre service ? Nous aurions besoin d’un amendement favorable… » Vous lui devez ${-c.balance} faveur(s).`,
      choices: [
        {
          id: 'accepter', label: 'Renvoyer l’ascenseur',
          hint: 'Dette effacée, mais ça se sait toujours un peu.',
          effects: [
            { kind: 'contact', contactId: '$target', balance: 1, trust: 8 }, { kind: 'exposure', delta: c.type === 'industriel' || c.type === 'lobby' ? 8 : 3 },
            { kind: 'stat', stat: 'politicalCapital', delta: -5 },
          ],
          outcome: 'Service rendu. Le carnet d’adresses reste ouvert.',
        },
        {
          id: 'refuser', label: 'Refuser poliment',
          effects: [{ kind: 'contact', contactId: '$target', trust: -25 }, { kind: 'stat', stat: 'credibility', delta: 2 }],
          risk: {
            baseChance: c.type === 'journaliste' ? 0.5 : 0.25,
            onFailure: [{ kind: 'exposure', delta: 15 }, { kind: 'stat', stat: 'popularity', delta: -3 }],
            failureNews: `${c.name.split(' (')[0]} se venge : des confidences sur vous circulent.`,
          },
          outcome: 'Porte fermée. Vous dormez mieux.',
        },
      ],
    };
  },

  attaque_rival: (d, rng, ctx) => {
    const npc = d.npcs.find(n => n.id === ctx.targetId);
    if (!npc || hasPending(d, 'attaque_rival')) return null;
    const domain = d.agendaDomain;
    return {
      id: uid(d, 'dec'), tag: 'attaque_rival', week: d.week, deadlineWeek: d.week + 1, source: 'rival', targetId: npc.id, domain,
      title: `${npc.name} vous attaque`,
      context: rng.pick([
        `Sur une matinale, ${npc.name} met en doute votre compétence sur ${DOMAIN_LABELS[domain].toLowerCase()}.`,
        `${npc.name} vous accuse de « carriérisme » dans un grand hebdomadaire.`,
      ]),
      choices: [
        {
          id: 'riposte', label: 'Riposter sur le fond',
          hint: 'Exige de connaître le dossier du moment.',
          effects: [
            { kind: 'stat', stat: 'credibility', delta: 5 }, { kind: 'npcStat', npcId: '$target', stat: 'popularity', delta: -4 },
          ],
          risk: {
            baseChance: 0.8, scaleWith: 'dossier', scaleWeight: 1,
            onFailure: [{ kind: 'stat', stat: 'credibility', delta: -6 }],
            failureNews: 'Votre réponse confuse donne raison à votre rival.',
          },
          outcome: 'Point par point, vous démontez l’attaque.',
        },
        {
          id: 'duel', label: 'Exiger un face-à-face',
          hint: 'Réglez ça en direct, dans un débat en plusieurs manches.',
          effects: [{ kind: 'debate', stakes: 'face_a_face', opponentId: '$target' }],
          outcome: 'Rendez-vous est pris sur le plateau.',
        },
        {
          id: 'ignorer', label: 'Ignorer avec hauteur',
          effects: [{ kind: 'stat', stat: 'popularity', delta: -2 }, { kind: 'stat', stat: 'stress', delta: -3 }],
          outcome: 'Vous ne descendez pas dans l’arène.',
        },
        {
          id: 'reconcilier', label: 'Proposer un déjeuner de réconciliation',
          effects: [{ kind: 'npcRelation', npcId: '$target', delta: 20 }, { kind: 'stat', stat: 'politicalCapital', delta: -4 }],
          outcome: 'Trêve conclue, pour l’instant.',
        },
      ],
    };
  },

  crise: (d, rng) => {
    if (hasPending(d, 'crise')) return null;
    const crisis = rng.pick(CRISES);
    const debateStakes = rankOrder(d.player.rankId) >= rankOrder('depute') ? 'hemicycle' as const : 'face_a_face' as const;
    return {
      id: uid(d, 'dec'), tag: 'crise', week: d.week, deadlineWeek: d.week + 1, source: 'evenement', domain: crisis.domain,
      title: crisis.title, context: `${crisis.context} Pendant trois semaines, on ne parlera que de ça.`,
      choices: [
        {
          id: 'terrain', label: 'Se rendre sur place',
          hint: 'Fort impact… si l’on ne vous accuse pas de récupération.',
          effects: [
            { kind: 'stat', stat: 'popularity', delta: 6 }, { kind: 'momentum', delta: 6 }, { kind: 'stat', stat: 'energy', delta: -15 },
          ],
          risk: {
            baseChance: 0.35, scaleWith: 'credibility', scaleWeight: 0.6,
            onFailure: [{ kind: 'stat', stat: 'popularity', delta: -4 }, { kind: 'stat', stat: 'credibility', delta: -3 }],
            failureNews: '« Récupération politique » : votre visite est sifflée.',
          },
          outcome: crisis.visit,
        },
        {
          id: 'plan', label: 'Présenter un plan d’urgence',
          requires: { minMastery: 45 },
          hint: 'Exige de maîtriser le dossier (45).',
          effects: [
            { kind: 'stat', stat: 'credibility', delta: 7 }, { kind: 'stat', stat: 'influence', delta: 4 },
            { kind: 'dossier', domain: '$domain', delta: 5 },
          ],
          outcome: 'Votre plan est repris par plusieurs éditorialistes.',
        },
        {
          id: 'debat', label: 'Porter le sujet en débat',
          hint: 'Un débat en direct, sur un sujet que tout le monde suit.',
          effects: [{ kind: 'debate', stakes: debateStakes }],
          outcome: 'Le débat est programmé.',
        },
        ...(rankOrder(d.player.rankId) >= rankOrder('ministre') && d.player.rankId !== 'chef_parti' && d.player.rankId !== 'candidat_presidence' ? [{
          id: 'cellule', label: 'Activer la cellule de crise',
          hint: 'Piloter vous-même la réponse de l’État.',
          effects: [{ kind: 'scene' as const, sceneId: 'crise' }],
          outcome: 'La cellule interministérielle se réunit.',
        }] : []),
        {
          id: 'manifester', label: 'Appeler à manifester',
          hint: 'Mener le cortège vous-même.',
          effects: [{ kind: 'protest' }],
          outcome: 'L’appel est lancé.',
        },
        {
          id: 'discret', label: 'Rester discret',
          effects: [{ kind: 'stat', stat: 'popularity', delta: -2 }, { kind: 'stat', stat: 'stress', delta: -3 }],
          outcome: 'Vous laissez passer la vague. Certains vous le reprochent.',
        },
      ],
    };
  },

  faillite_parti: d => {
    if (hasPending(d, 'faillite_parti')) return null;
    return {
      id: uid(d, 'dec'), tag: 'faillite_parti', week: d.week, deadlineWeek: d.week + 1, source: 'parti',
      title: 'Le parti au bord de la faillite',
      context: `La trésorerie est à ${Math.round(d.partyFinance?.treasury ?? 0)} k€. La banque menace de couper les crédits.`,
      choices: [
        {
          id: 'siege', label: 'Vendre le siège historique',
          hint: '+3 M€, mais les militants le vivent comme un déclassement.',
          effects: [{ kind: 'partyTreasury', delta: 3000 }, { kind: 'cohesion', delta: -6 }, { kind: 'faction', factionId: '*', delta: -3 }],
          outcome: 'Le siège est vendu à un promoteur. Les cartons sont faits.',
        },
        {
          id: 'souscription', label: 'Lancer une grande souscription nationale',
          hint: 'Les dons dépendent de votre popularité.',
          effects: [{ kind: 'partyTreasury', delta: 600 + Math.round(d.player.stats.popularity * 15) }, { kind: 'stat', stat: 'popularity', delta: -2 }],
          outcome: 'Les petits dons affluent. La presse ironise sur la « quête ».',
        },
        {
          id: 'plan_social', label: 'Plan social : réduire les permanents de moitié',
          effects: [
            { kind: 'partyAllocation', line: 'permanents', value: 90 }, { kind: 'partyTreasury', delta: 300 },
            { kind: 'cohesion', delta: -10 }, { kind: 'stat', stat: 'stress', delta: 10 },
          ],
          outcome: 'Quarante salariés licenciés. Le climat interne est glacial.',
        },
      ],
    };
  },

  don_suspect: (d, rng) => {
    if (hasPending(d, 'don_suspect')) return null;
    const donor = rng.pick(['un industriel du BTP', 'un promoteur immobilier', 'un homme d’affaires étranger']);
    return {
      id: uid(d, 'dec'), tag: 'don_suspect', week: d.week, deadlineWeek: d.week + 2, source: 'reseau',
      title: 'Une proposition de don… généreuse',
      context: `Les caisses sont presque vides. ${donor.charAt(0).toUpperCase() + donor.slice(1)} propose 500 000 € au parti, versés par une centaine de prête-noms pour contourner le plafond légal.`,
      choices: [
        {
          id: 'accepter', label: 'Accepter discrètement',
          hint: 'Illégal. Énorme risque si ça sort.',
          effects: [{ kind: 'partyTreasury', delta: 500 }, { kind: 'exposure', delta: 25 }],
          outcome: 'L’argent arrive par petites coupures sur le compte du parti.',
        },
        {
          id: 'legal', label: 'Proposer un don légal, dans la limite du plafond',
          effects: [{ kind: 'partyTreasury', delta: 8 }, { kind: 'stat', stat: 'credibility', delta: 1 }],
          outcome: 'Il verse le maximum autorisé, sans enthousiasme.',
        },
        {
          id: 'refuser', label: 'Refuser et le faire savoir',
          effects: [{ kind: 'stat', stat: 'credibility', delta: 3 }, { kind: 'stat', stat: 'popularity', delta: 1 }],
          outcome: 'Votre refus fuite dans la presse… à votre avantage.',
        },
      ],
    };
  },

  enquete: (d, rng) => {
    if (hasPending(d, 'enquete')) return null;
    const count = Number(d.player.flags['illegal'] ?? 0);
    return {
      id: uid(d, 'dec'), tag: 'enquete', week: d.week, deadlineWeek: d.week + 1, source: 'medias',
      title: 'Le parquet financier ouvre une enquête',
      context: rng.pick([
        'Des virements suspects sur vos comptes ont été signalés par Tracfin.',
        'Un ancien collaborateur a remis des documents compromettants aux enquêteurs.',
        'Un hebdomadaire révèle vos arrangements avec des entreprises locales.',
      ]) + ` Les enquêteurs s’intéressent à ${count > 1 ? `${count} affaires` : 'une affaire'}.`,
      choices: [
        {
          id: 'avocats', label: 'Engager les meilleurs avocats',
          hint: '25 000 €. Gagner du temps, faire annuler des procédures.',
          effects: [{ kind: 'funds', account: 'personal', delta: -25000 }, { kind: 'exposure', delta: -20 }, { kind: 'stat', stat: 'stress', delta: 8 }],
          outcome: 'Vos avocats obtiennent un report… et l’annulation d’une écoute.',
        },
        {
          id: 'nier', label: 'Tout nier, crier au complot',
          effects: [{ kind: 'exposure', delta: -10 }, { kind: 'faction', factionId: 'ligne_dure', delta: 3 }],
          risk: {
            baseChance: Math.min(0.85, 0.3 + count * 0.12), scaleWith: 'influence', scaleWeight: 0.4,
            onFailure: [
              { kind: 'stat', stat: 'popularity', delta: -15 }, { kind: 'stat', stat: 'credibility', delta: -20 },
              { kind: 'stat', stat: 'influence', delta: -10 }, { kind: 'flag', key: 'illegal', value: 0 },
              { kind: 'funds', account: 'personal', delta: -15000 }, { kind: 'cohesion', delta: -10 },
            ],
            failureNews: 'Mise en examen pour corruption et recel. Les images de la perquisition tournent en boucle.',
          },
          outcome: 'Faute de preuves, l’enquête est classée sans suite.',
        },
        {
          id: 'rembourser', label: 'Rembourser discrètement et tourner la page',
          hint: 'Rembourse les sommes perçues, efface le compteur d’affaires.',
          effects: [
            { kind: 'funds', account: 'personal', delta: -8000 - count * 6000 }, { kind: 'exposure', delta: -25 },
            { kind: 'flag', key: 'illegal', value: 0 }, { kind: 'stat', stat: 'credibility', delta: -3 },
          ],
          outcome: 'Un arrangement avec le parquet : l’affaire se dégonfle.',
        },
      ],
    };
  },

  bouleversement: (d, rng) => {
    if (hasPending(d, 'bouleversement')) return null;
    // Les dossiers les mieux maîtrisés sont les plus exposés
    const candidates = (Object.keys(d.player.dossiers) as Domain[]).filter(x => d.player.dossiers[x].mastery >= 40);
    if (!candidates.length) return null;
    const total = candidates.reduce((s, x) => s + d.player.dossiers[x].mastery, 0);
    let roll = rng.next() * total;
    const domain = candidates.find(x => (roll -= d.player.dossiers[x].mastery) < 0) ?? candidates[0];
    const label = DOMAIN_LABELS[domain].toLowerCase();
    const cause = rng.pick([
      `Une réforme surprise réécrit tout le cadre ${domain === 'economie' ? 'économique' : `du dossier ${label}`}.`,
      `Un rapport choc contredit les chiffres de référence sur ${label}.`,
      `Une révolution technologique rend obsolètes vos fiches sur ${label}.`,
      `La Cour des comptes publie un audit qui bouleverse le dossier ${label}.`,
    ]);
    const hasAdvisor = d.player.staff.includes('conseiller');
    return {
      id: uid(d, 'dec'), tag: 'bouleversement', week: d.week, deadlineWeek: d.week + 1, source: 'evenement', domain,
      title: `Bouleversement : ${DOMAIN_LABELS[domain]}`,
      context: `${cause} Votre maîtrise du dossier (${Math.round(d.player.dossiers[domain].mastery)}) est remise en cause.`,
      choices: [
        {
          id: 'replonger', label: 'S’y replonger jour et nuit',
          hint: 'Limite la casse, mais épuise.',
          effects: [{ kind: 'dossierScale', domain: '$domain', factor: 0.75 }, { kind: 'stat', stat: 'energy', delta: -25 }, { kind: 'stat', stat: 'stress', delta: 10 }],
          outcome: 'Des nuits blanches, mais vous restez dans la course.',
        },
        ...(hasAdvisor ? [{
          id: 'conseiller', label: 'Confier la mise à jour à votre conseiller·e',
          hint: 'Possible grâce à votre conseiller·e technique.',
          effects: [{ kind: 'dossierScale' as const, domain: '$domain' as const, factor: 0.85 }, { kind: 'stat' as const, stat: 'politicalCapital' as const, delta: -5 }],
          outcome: 'Votre équipe vous prépare une note de synthèse impeccable.',
        }] : []),
        {
          id: 'laisser', label: 'Laisser filer pour l’instant',
          effects: [{ kind: 'dossierScale', domain: '$domain', factor: 0.5 }],
          outcome: 'Vos fiches dorment dans un tiroir. Il faudra tout reprendre.',
        },
      ],
    };
  },

  elevation: d => {
    const l = d.lodge;
    if (!l || hasPending(d, 'elevation')) return null;
    const next = ['Compagnon', 'Maître', 'Vénérable Maître'][l.grade];
    return {
      id: uid(d, 'dec'), tag: 'elevation', week: d.week, deadlineWeek: d.week + 2, source: 'evenement',
      title: `Augmentation de salaire : passage au grade de ${next}`,
      context: `Vos frères et sœurs de la loge ${l.loge} jugent votre travail digne du grade de ${next}. La cérémonie a lieu cette semaine.`,
      choices: [
        {
          id: 'accepter', label: 'Recevoir le grade',
          effects: [{ kind: 'grade', delta: 1 }, { kind: 'lodge', fraternite: 5 }, { kind: 'stat', stat: 'influence', delta: 2 },
            ...(l.grade >= 1 ? [{ kind: 'booster' as const, count: 1, reason: 'De nouveaux frères vous proposent leurs services.' }] : [])],
          outcome: 'Une cérémonie émouvante. Une étape de plus sur le chemin.',
        },
        {
          id: 'attendre', label: 'Demander à attendre, par humilité',
          effects: [{ kind: 'lodge', fraternite: 3 }],
          outcome: 'Votre humilité est remarquée. On vous le reproposera.',
        },
      ],
    };
  },

  revelation: (d, rng) => {
    const l = d.lodge;
    if (!l || hasPending(d, 'revelation')) return null;
    return {
      id: uid(d, 'dec'), tag: 'revelation', week: d.week, deadlineWeek: d.week + 1, source: 'medias',
      title: 'Révélations : votre appartenance à la loge',
      context: rng.pick([
        'Un hebdomadaire publie la liste des élus membres de la loge, votre nom en tête.',
        'Une photo de vous en tablier circule sur les réseaux sociaux.',
        'Un article évoque des « services rendus entre frères » dans votre entourage.',
      ]),
      choices: [
        {
          id: 'assumer', label: 'Assumer publiquement : la liberté de conscience',
          effects: [{ kind: 'lodge', discretion: 40, fraternite: -5 }, { kind: 'stat', stat: 'credibility', delta: 3 }, { kind: 'stat', stat: 'popularity', delta: -3 }],
          outcome: 'Votre franchise désamorce la polémique. Certains frères regrettent votre exposition.',
        },
        {
          id: 'dementir', label: 'Démentir',
          effects: [{ kind: 'lodge', discretion: 25 }],
          risk: {
            baseChance: 0.5, scaleWith: 'credibility', scaleWeight: 0.5,
            onFailure: [{ kind: 'stat', stat: 'credibility', delta: -10 }, { kind: 'stat', stat: 'popularity', delta: -6 }, { kind: 'lodge', fraternite: -15, discretion: 20 }],
            failureNews: 'De nouvelles preuves sortent : le mensonge fait plus de dégâts que la révélation.',
          },
          outcome: 'L’affaire retombe faute de preuves.',
        },
        {
          id: 'mise_sommeil', label: 'Vous mettre en sommeil de la loge quelques mois',
          effects: [{ kind: 'lodge', discretion: 50, fraternite: -15 }],
          outcome: 'Vous prenez du recul. La tempête passe.',
        },
      ],
    };
  },

  remaniement: d => {
    if (hasPending(d, 'remaniement')) return null;
    const best = (Object.keys(d.player.dossiers) as Domain[])
      .sort((a, b) => d.player.dossiers[b].mastery - d.player.dossiers[a].mastery)[0];
    return {
      id: uid(d, 'dec'), tag: 'remaniement', week: d.week, deadlineWeek: d.week + 1, source: 'carriere', domain: best,
      title: 'Remaniement : l’Élysée appelle',
      context: `On vous propose le ministère chargé de ${DOMAIN_LABELS[best].toLowerCase()}. Entrer au gouvernement, c’est gagner en stature… et en exposition.`,
      choices: [
        {
          id: 'accepter', label: 'Accepter le portefeuille',
          effects: [
            { kind: 'rank', rankId: 'ministre' }, { kind: 'stat', stat: 'influence', delta: 8 },
            { kind: 'stat', stat: 'popularity', delta: 5 }, { kind: 'exposure', delta: 5 },
          ],
          outcome: 'Passation de pouvoirs sous les ors de la République.',
        },
        {
          id: 'refuser', label: 'Décliner pour garder sa liberté de parole',
          effects: [{ kind: 'stat', stat: 'credibility', delta: 5 }, { kind: 'faction', factionId: 'ligne_dure', delta: 5 }],
          outcome: 'Un refus remarqué. On vous redemandera.',
        },
      ],
    };
  },

  congres: (d, _rng) => {
    if (hasPending(d, 'congres')) return null;
    const total = d.party.factions.reduce((s, f) => s + f.weight, 0);
    const support = d.party.factions.reduce((s, f) => s + f.supportForPlayer * f.weight, 0) / total;
    const leader = d.npcs.find(n => n.id === d.party.leaderNpcId);
    return {
      id: uid(d, 'dec'), tag: 'congres', week: d.week, deadlineWeek: d.week + 2, source: 'parti',
      title: 'Congrès du parti',
      context: `Le congrès s’ouvre. ${leader?.name ?? 'La direction sortante'} brigue un nouveau mandat. Soutien pondéré des courants en votre faveur : ${Math.round(support)} %.`,
      choices: [
        {
          id: 'motion', label: 'Déposer votre propre motion',
          hint: `Chances estimées : ${Math.round(Math.min(95, support + 10))} %`,
          effects: [{ kind: 'rank', rankId: 'chef_parti' }, { kind: 'flag', key: 'chef_parti_elu', value: true }, { kind: 'stat', stat: 'influence', delta: 10 }],
          risk: {
            baseChance: 1 - Math.min(0.95, (support + 10) / 100),
            onFailure: [{ kind: 'stat', stat: 'influence', delta: -10 }, { kind: 'npcRelation', npcId: d.party.leaderNpcId, delta: -20 }],
            failureNews: 'Motion battue au congrès. Il faudra attendre le prochain.',
          },
          outcome: 'Les militants vous portent à la tête du parti !',
        },
        {
          id: 'putsch', label: 'Coup de force : réclamer la démission du chef',
          hint: 'Plus probable, mais le parti en sort fracturé.',
          effects: [
            { kind: 'rank', rankId: 'chef_parti' }, { kind: 'flag', key: 'chef_parti_elu', value: true },
            { kind: 'cohesion', delta: -20 }, { kind: 'stat', stat: 'credibility', delta: -5 },
          ],
          risk: {
            baseChance: 1 - Math.min(0.95, (support + 25) / 100),
            onFailure: [
              { kind: 'stat', stat: 'influence', delta: -18 }, { kind: 'cohesion', delta: -15 },
              { kind: 'faction', factionId: '*', delta: -10 },
            ],
            failureNews: 'Le putsch échoue. Vous voilà marginalisé·e.',
          },
          outcome: 'Le chef sortant jette l’éponge. Le parti est à vous — en morceaux.',
        },
        {
          id: 'rallier', label: 'Se rallier à la direction sortante',
          effects: [{ kind: 'npcRelation', npcId: d.party.leaderNpcId, delta: 25 }, { kind: 'stat', stat: 'politicalCapital', delta: 15 }],
          outcome: 'Loyauté récompensée : la direction vous en saura gré.',
        },
      ],
    };
  },

  defiance: d => {
    if (hasPending(d, 'defiance')) return null;
    return {
      id: uid(d, 'dec'), tag: 'defiance', week: d.week, deadlineWeek: d.week + 1, source: 'parti',
      title: 'Motion de défiance interne',
      context: 'Plusieurs courants exigent votre départ de la tête du parti. Le soutien interne s’effondre.',
      choices: [
        {
          id: 'concessions', label: 'Négocier des postes avec les frondeurs',
          effects: [{ kind: 'faction', factionId: '*', delta: 12 }, { kind: 'stat', stat: 'politicalCapital', delta: -15 }, { kind: 'stat', stat: 'influence', delta: -5 }],
          outcome: 'Vous sauvez votre place en partageant le gâteau.',
        },
        {
          id: 'purge', label: 'Exclure les meneurs',
          effects: [{ kind: 'cohesion', delta: -15 }, { kind: 'stat', stat: 'influence', delta: 5 }],
          risk: {
            baseChance: 0.55, scaleWith: 'influence', scaleWeight: 0.6,
            onFailure: [{ kind: 'rank', rankId: 'ministre' }, { kind: 'stat', stat: 'influence', delta: -15 }],
            failureNews: 'La purge se retourne contre vous : vous êtes renversé·e.',
          },
          outcome: 'Les frondeurs sont mis au pas.',
        },
      ],
    };
  },
};

export function createDecision(templateId: string, d: GameState, rng: Rng, ctx: EffectContext): Decision | null {
  const t = TEMPLATES[templateId];
  return t ? t(d, rng, ctx) : null;
}

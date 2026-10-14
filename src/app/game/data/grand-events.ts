import { Effect, GameState, Npc } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';

/* ============================================================
 *  Événements du « grand jeu » : secrets, souvenirs, frondes,
 *  renommée, crainte, et les rebondissements des grandes luttes.
 * ============================================================ */

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect => ({ kind: 'stat', stat, delta });
const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice => ({ id, label, effects, outcome, ...extra });
const rel = (n: Npc, delta: number, reason: string): Effect => ({ kind: 'npcRelation', npcId: n.id, delta, reason });
const lutte = (balance: number, progress = 0): Effect => ({ kind: 'struggle', balance, ...(progress ? { progress } : {}) });

const someone = (d: GameState, pick: (n: Npc) => boolean, salt = 0): Npc | undefined => {
  const pool = d.npcs.filter(pick);
  return pool.length ? pool[(d.week + salt) % pool.length] : undefined;
};

export const GRAND_EVENTS: RandomEvent[] = [
  {
    tag: 'gj_rumeur', weight: 1, eligible: d => d.npcs.length > 3,
    build: d => {
      const n = someone(d, x => x.partyId !== d.party.id) ?? d.npcs[0];
      return {
        title: `Une rumeur sur ${n.name}`,
        context: `Au buffet de l’Assemblée, on murmure que ${n.name} aurait « quelque chose à cacher ». Votre assistant·e connaît un ancien collaborateur qui pourrait parler.`,
        choices: [
          c('creuser', 'Creuser discrètement', [{ kind: 'secret', owner: n.id }, { kind: 'exposure', delta: 1 }], 'L’ancien collaborateur parle. Beaucoup.'),
          c('laisser', 'Ne pas s’abaisser à ça', [s('credibility', 1)], 'Vous laissez les rumeurs aux autres.'),
        ],
      };
    },
  },
  {
    tag: 'gj_detective', weight: 0.7, eligible: d => (d.secrets ?? []).some(x => x.owner === 'player' && !x.exposed),
    build: () => ({
      title: 'Un détective privé vous suit',
      context: 'Votre chauffeur l’a repéré trois fois cette semaine : un homme en imperméable, appareil photo au cou. Quelqu’un enquête sur vous.',
      choices: [
        c('confronter', 'Le confronter dans la rue', [{ kind: 'dread', delta: 5 }, s('stress', 3)], 'Il bafouille le nom de son commanditaire et disparaît. On ne le reverra plus.'),
        c('avocat', 'Faire constater par un huissier et porter plainte', [{ kind: 'funds', account: 'personal', delta: -1500 }, s('credibility', 1)], 'La filature cesse. Le commanditaire reste un mystère.'),
        c('ignorer', 'Ignorer', [s('stress', 2)], 'Il continue. Que trouvera-t-il ?', { risk: { baseChance: 0.4, onFailure: [{ kind: 'exposure', delta: 6 }], failureNews: 'Des photos de vous paraissent dans un hebdomadaire.' } }),
      ],
    }),
  },
  {
    tag: 'gj_ami_blesse', weight: 0.8, eligible: d => d.npcs.some(n => n.relationToPlayer >= 30),
    build: d => {
      const n = someone(d, x => x.relationToPlayer >= 30)!;
      return {
        title: `${n.name} se sent oublié·e`,
        context: `${n.name}, qui vous a toujours soutenu·e, vous reproche de ne plus jamais l’appeler depuis que « vous êtes monté·e ».`,
        choices: [
          c('diner', 'L’inviter à dîner, juste vous deux', [rel(n, 10, 'Ce dîner pour se retrouver'), s('energy', -3)], 'Une soirée comme avant. Il ou elle vous serre dans ses bras en partant.'),
          c('poste', 'Lui proposer un poste à vos côtés', [rel(n, 15, 'Vous lui avez fait une place'), s('politicalCapital', -6)], 'Il ou elle accepte, ému·e.'),
          c('trop', 'Expliquer que vous n’avez plus le temps', [rel(n, -15, 'Vous l’avez laissé·e tomber')], '« Je vois. » Le ton est glacial.'),
        ],
      };
    },
  },
  {
    tag: 'gj_hommage', weight: 0.6, eligible: d => (d.player.renown ?? 0) >= 100,
    build: () => ({
      title: 'Un hommage inattendu',
      context: 'Une école de votre région veut porter votre nom… de votre vivant. Le conseil municipal hésite.',
      choices: [
        c('accepter', 'Accepter, très honoré·e', [{ kind: 'renown', delta: 25 }, s('popularity', 1), s('credibility', -1)], 'La plaque est dévoilée ; quelques éditorialistes ricanent.'),
        c('refuser', 'Refuser : « Donnez-lui le nom d’une institutrice »', [s('credibility', 3), { kind: 'renown', delta: 10 }], 'Votre modestie est saluée. L’école portera le nom d’une résistante.'),
      ],
    }),
  },
  {
    tag: 'gj_crainte', weight: 0.6, eligible: d => (d.player.dread ?? 0) >= 30,
    build: () => ({
      title: 'On vous craint',
      context: 'Un portrait dans la presse vous décrit comme « la personne la plus redoutée du parti ». Plusieurs élus n’osent plus vous contredire en réunion.',
      choices: [
        c('assumer', 'Assumer : « Je préfère être respecté·e qu’aimé·e »', [{ kind: 'dread', delta: 6 }, { kind: 'fronde', factionId: '*', delta: -20 }, s('popularity', -1)], 'Les frondeurs se tiennent tranquilles. Les sondages, moins.'),
        c('adoucir', 'Adoucir votre image : rires, confidences, bonhomie', [{ kind: 'dread', delta: -10 }, s('popularity', 2)], 'Un reportage vous montre en train de jouer avec votre chien. Effet garanti.'),
      ],
    }),
  },
  {
    tag: 'gj_fronde_tribune', weight: 1, eligible: d => (d.frondes ?? []).length > 0,
    build: d => {
      const f = d.party.factions.find(x => x.id === d.frondes![0].factionId)!;
      return {
        title: 'Une tribune des frondeurs',
        context: `Quarante élus du courant ${f.name.toLowerCase()} signent une tribune assassine contre votre stratégie dans un grand quotidien.`,
        choices: [
          c('repondre', 'Répondre point par point, sur le fond', [{ kind: 'fronde', factionId: f.id, delta: -10 }, s('credibility', 2), s('energy', -4)], 'Votre réponse convainc quelques signataires de se rétracter.'),
          c('mepriser', 'Les mépriser publiquement', [{ kind: 'fronde', factionId: f.id, delta: 15 }, { kind: 'dread', delta: 4 }], 'La fronde redouble de colère.'),
          c('recevoir', 'Recevoir les signataires', [{ kind: 'fronde', factionId: f.id, delta: -18 }, { kind: 'faction', factionId: f.id, delta: 5 }, s('politicalCapital', -5)], 'Trois heures d’explication franche. Le dialogue est renoué.'),
        ],
      };
    },
  },
  {
    tag: 'gj_dette', weight: 0.7, eligible: d => (d.hooks ?? []).length > 0,
    build: d => {
      const h = d.hooks![0];
      const n = d.npcs.find(x => x.id === h.npcId) ?? d.npcs[0];
      return {
        title: `${n.name} veut solder sa dette`,
        context: `${n.name} vous propose un marché : un gros service maintenant, contre l’effacement de ce que vous savez.`,
        choices: [
          c('accepter', 'Accepter le marché', [s('politicalCapital', 15), s('influence', 3), rel(n, 15, 'Vous avez effacé sa dette')], 'Marché conclu : il ou elle est libre, vous êtes plus fort·e.'),
          c('refuser', 'Garder le levier', [rel(n, -6, 'Vous refusez de le ou la libérer'), { kind: 'dread', delta: 3 }], 'Il ou elle repart, la mâchoire serrée.'),
        ],
      };
    },
  },
  // ── Les grandes luttes ──
  {
    tag: 'gj_reco_transfuge', weight: 1.2, eligible: d => d.struggle?.id === 'recomposition',
    build: () => ({
      title: 'Les transfuges frappent à la porte',
      context: 'Une dizaine de députés modérés d’un autre parti veulent rejoindre votre groupe. Votre aile dure s’y oppose.',
      choices: [
        c('accueillir', 'Les accueillir à bras ouverts', [lutte(-15, 10), { kind: 'faction', factionId: 'moderes', delta: 6 }, { kind: 'faction', factionId: 'ligne_dure', delta: -6 }], 'Le groupe grossit ; les puristes grincent.'),
        c('refuser', 'Refuser : « Pas de mélange des genres »', [lutte(15, 10), { kind: 'faction', factionId: 'ligne_dure', delta: 6 }], 'Les transfuges partent ailleurs. La ligne est claire.'),
      ],
    }),
  },
  {
    tag: 'gj_reco_sondage', weight: 0.9, eligible: d => d.struggle?.id === 'recomposition',
    build: () => ({
      title: 'Le sondage qui fait trembler les partis',
      context: 'Un sondage montre que 58 % des Français voteraient pour « une grande coalition de gens raisonnables ». Les états-majors paniquent.',
      choices: [
        c('surfer', 'Vous poser en artisan du rassemblement', [lutte(-12), s('popularity', 2)], 'Vos appels à l’unité font le tour des plateaux.'),
        c('dénoncer', 'Dénoncer « le marais des tièdes »', [lutte(12), s('influence', 2)], 'Les militants adorent. Les électeurs du centre, moins.'),
      ],
    }),
  },
  {
    tag: 'gj_dec_region', weight: 1.2, eligible: d => d.struggle?.id === 'decentralisation',
    build: () => ({
      title: 'Une région défie l’État',
      context: 'Une présidente de région annonce qu’elle financera seule les lycées… et ne versera plus sa contribution à l’État.',
      choices: [
        c('soutenir', 'La soutenir : « Les territoires savent mieux »', [lutte(15, 10), { kind: 'segment', segment: 'ruraux', delta: 2 }], 'D’autres régions emboîtent le pas.'),
        c('recadrer', 'Rappeler la loi : « La République est une »', [lutte(-15, 10), s('credibility', 2)], 'Le préfet saisit le tribunal administratif.'),
      ],
    }),
  },
  {
    tag: 'gj_dec_referendum', weight: 0.9, eligible: d => d.struggle?.id === 'decentralisation',
    build: () => ({
      title: 'Référendum en Bretagne',
      context: 'Un référendum local sur « l’autonomie fiscale » est organisé en Bretagne. Sans valeur légale, mais tout le pays regarde.',
      choices: [
        c('participer', 'Aller faire campagne pour le oui', [lutte(12), s('popularity', 1), s('energy', -5)], 'Le oui l’emporte à 61 %.'),
        c('boycotter', 'Appeler au boycott d’un vote illégal', [lutte(-12), s('popularity', -1)], 'La participation plafonne à 34 %.'),
      ],
    }),
  },
  {
    tag: 'gj_oub_rondpoint', weight: 1.2, eligible: d => d.struggle?.id === 'oublies',
    build: () => ({
      title: 'Le rond-point de la colère',
      context: 'Un rond-point est occupé depuis trois semaines dans votre département. Les occupants vous invitent à venir les écouter.',
      choices: [
        c('ecouter', 'Y aller, sans caméra', [lutte(-14, 8), { kind: 'segment', segment: 'populaires', delta: 3 }, s('energy', -4)], 'Trois heures autour d’un brasero. Vous repartez avec une liste de revendications.'),
        c('evacuer', 'Demander l’évacuation', [lutte(16, 8), { kind: 'segment', segment: 'populaires', delta: -3 }], 'Le rond-point est évacué ; trois autres sont occupés le lendemain.'),
      ],
    }),
  },
  {
    tag: 'gj_oub_medecin', weight: 0.9, eligible: d => d.struggle?.id === 'oublies',
    build: () => ({
      title: 'Le dernier médecin du canton',
      context: 'Le dernier médecin d’un canton rural part à la retraite. Les habitants ont lancé une pétition de 12 000 signatures.',
      choices: [
        c('maison', 'Promettre une maison de santé', [lutte(-12), { kind: 'segment', segment: 'ruraux', delta: 3 }, s('politicalCapital', -5)], 'La première pierre est posée six mois plus tard.'),
        c('teleconsult', 'Proposer la téléconsultation', [lutte(8), { kind: 'segment', segment: 'retraites', delta: -2 }], '« Un écran ne remplace pas un médecin », répond la pétition.'),
      ],
    }),
  },
];

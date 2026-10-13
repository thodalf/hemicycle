import { Effect, GameState, Npc, SchemeAlly } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';
import { campaignOpen } from '../engine/effects';

/* ============================================================
 *  Événements nés du téléphone : complices qui doutent ou
 *  réclament leur part, conjurés photographiés, soutiens
 *  publics embarrassants ou inattendus, dettes qui fuitent,
 *  donateur trop généreux, meeting commun.
 * ============================================================ */

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat, delta });
const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice =>
  ({ id, label, effects, outcome, ...extra });
const rel = (npcId: string, delta: number): Effect => ({ kind: 'npcRelation', npcId, delta });
const eur = (n: number) => `${n.toLocaleString('fr-FR')} €`;

/** Un complice (personnalité) de vos complots, et le complot qu'il sert */
function accomplice(d: GameState): { a: SchemeAlly; target: string } | null {
  for (const sc of d.schemes ?? []) {
    const a = (sc.allies ?? []).find(x => x.npcId && d.npcs.some(n => n.id === x.npcId));
    if (a) return { a, target: sc.targetName };
  }
  return null;
}

/** La dernière personnalité à s'être affichée publiquement à vos côtés (8 mois) */
function lastSupporter(d: GameState): Npc | undefined {
  let best: Npc | undefined;
  let week = -1;
  for (const n of d.npcs) {
    const w = Number(d.player.flags[`apparNpc_${n.id}`] ?? -99);
    if (w > week && d.week - w <= 8) { best = n; week = w; }
  }
  return best;
}

function debts(d: GameState): { id: string; amount: number }[] {
  return Object.entries(d.player.flags)
    .filter(([k, v]) => k.startsWith('dette_') && Number(v) > 0)
    .map(([k, v]) => ({ id: k.slice(6), amount: Number(v) }));
}

export const PHONE_EVENTS: RandomEvent[] = [
  {
    tag: 'complice_doute', weight: 1, eligible: d => !!accomplice(d),
    build: d => {
      const { a, target } = accomplice(d)!;
      return {
        title: `${a.name} a des doutes`,
        context: `Minuit. Votre complice dans l’affaire visant ${target} vous appelle, la voix blanche : « Et si tout se savait ? J’ai une carrière, moi. »`,
        choices: [
          c('rassurer', 'Le ou la rassurer longuement', [rel(a.npcId!, 6), s('stress', 2), s('energy', -3)], 'Une heure au téléphone. Il ou elle raccroche apaisé·e.'),
          c('promettre', 'Lui promettre une place de choix sur vos listes', [rel(a.npcId!, 12), s('politicalCapital', -8)], '« Tu ne le regretteras pas. » Une promesse de plus à tenir.'),
          c('eloigner', 'Lui demander de se faire oublier quelque temps', [rel(a.npcId!, -6), { kind: 'scheme', progress: -4, secrecy: 6 }], 'Le complot ralentit, mais personne ne parle.'),
        ],
      };
    },
  },
  {
    tag: 'complice_part', weight: 0.8, eligible: d => !!accomplice(d),
    build: d => {
      const { a } = accomplice(d)!;
      return {
        title: `${a.name} réclame sa part`,
        context: `« J’ai pris des risques pour toi. » Votre complice veut être payé·e : un « conseil » rémunéré, ou une enveloppe.`,
        choices: [
          c('payer', `Payer ${eur(3000)}`, [{ kind: 'funds', account: 'personal', delta: -3000 }, rel(a.npcId!, 8), { kind: 'exposure', delta: 2 }], 'L’enveloppe change de main dans un parking. La loyauté a un prix.', { needMoney: 3000 }),
          c('plus_tard', 'Promettre une récompense « après la victoire »', [rel(a.npcId!, -5), s('politicalCapital', -2)], '« Après la victoire. » Il ou elle a déjà entendu ça.'),
          c('refuser', 'Refuser sèchement', [rel(a.npcId!, -14)], 'Il ou elle repart furieux·se. Un complice fâché est un complice dangereux.'),
        ],
      };
    },
  },
  {
    tag: 'conjures_photo', weight: 0.6, eligible: d => (d.schemes ?? []).some(x => (x.allies?.length ?? 0) >= 2),
    build: d => {
      const sc = (d.schemes ?? []).find(x => (x.allies?.length ?? 0) >= 2)!;
      return {
        title: 'Un dîner de conjurés photographié',
        context: `Un paparazzi vous a surpris·e au fond d’un restaurant avec ${sc.allies!.map(x => x.name).join(' et ')}. Un hebdomadaire demande ce que vous fêtiez.`,
        choices: [
          c('anniversaire', 'Parler d’un dîner d’anniversaire', [{ kind: 'scheme', secrecy: -4 }, s('credibility', -1)], '« Nous fêtions les cinquante ans d’un ami. » Personne n’y croit, personne ne peut prouver le contraire.'),
          c('dementir', 'Démentir sèchement', [{ kind: 'scheme', secrecy: -10 }, { kind: 'exposure', delta: 4 }], 'Le démenti attise la curiosité des journalistes.'),
          c('suspendre', 'Suspendre toutes les rencontres', [{ kind: 'scheme', progress: -8, secrecy: 8 }], 'Plus de dîners, plus de photos. Le complot attendra.'),
        ],
      };
    },
  },
  {
    tag: 'soutien_embarrassant', weight: 1, eligible: d => !!lastSupporter(d),
    build: d => {
      const n = lastSupporter(d)!;
      return {
        title: `${n.name} dans la tourmente`,
        context: `${n.name}, qui s’est affiché·e à vos côtés il y a peu, est cité·e dans une affaire de frais de mandat. Les photos de vous deux circulent.`,
        choices: [
          c('distance', 'Prendre vos distances', [s('credibility', 2), rel(n.id, -12)], '« Je ne connais pas le dossier. » Le lâchage est remarqué.'),
          c('defendre', 'Le ou la défendre publiquement', [s('popularity', -2), { kind: 'exposure', delta: 4 }, rel(n.id, 12)], 'Une fidélité rare. Qui pourrait vous coûter cher si l’affaire s’aggrave.'),
          c('silence', 'Ne rien dire', [s('stress', 2), s('popularity', -1)], 'Votre silence est commenté. Moins que votre photo.'),
        ],
      };
    },
  },
  {
    tag: 'soutien_inattendu', weight: 0.7, minRank: 'conseiller_municipal',
    eligible: d => d.npcs.some(n => n.partyId !== d.party.id && n.relationToPlayer >= 20),
    build: d => {
      const n = d.npcs.filter(x => x.partyId !== d.party.id && x.relationToPlayer >= 20).sort((a, b) => b.relationToPlayer - a.relationToPlayer)[0];
      const chief = d.npcs.find(x => x.id === d.party.leaderNpcId);
      return {
        title: 'Un soutien venu d’en face',
        context: `${n.name}, figure du camp adverse, vous écrit : « Votre travail mérite d’être salué. Je suis prêt·e à le dire en public. »`,
        choices: [
          c('accepter', 'Accepter une apparition commune', [s('popularity', 2), s('credibility', 2), { kind: 'faction', factionId: '*', delta: -2 }, ...(chief ? [rel(chief.id, -4)] : [])], 'Une photo qui fait le tour des rédactions. Dans votre parti, on grince des dents.'),
          c('prive', 'Le remercier, mais en privé', [rel(n.id, 4), s('influence', 1)], 'Un déjeuner discret. Une alliance de couloir est née.'),
          c('decliner', 'Décliner poliment', [rel(n.id, -3), { kind: 'cohesion', delta: 1 }], 'Vos camarades apprécient votre loyauté.'),
        ],
      };
    },
  },
  {
    tag: 'dettes_presse', weight: 0.7, eligible: d => debts(d).length > 0,
    build: d => {
      const list = debts(d);
      const total = list.reduce((a, x) => a + x.amount, 0);
      return {
        title: 'Vos dettes dans la presse',
        context: `Un hebdomadaire satirique révèle que vous devez ${eur(total)} à des collègues. « L’élu·e qui vivait à crédit », titre-t-il.`,
        choices: [
          c('rembourser', 'Tout rembourser dans la journée', [{ kind: 'funds', account: 'personal', delta: -total }, ...list.map(x => ({ kind: 'flag', key: `dette_${x.id}`, value: 0 } as Effect)), ...list.map(x => rel(x.id, 4)), s('credibility', 1)], 'Les virements partent avant le journal de 20 h.', { needMoney: total }),
          c('assumer', '« Comme beaucoup de Français, j’ai eu un passage difficile »', [s('popularity', -1), s('credibility', -1), { kind: 'exposure', delta: 2 }], 'Certains compatissent. D’autres ricanent.'),
          c('dementir', 'Démentir', [{ kind: 'exposure', delta: 4 }], 'Le journal publie les SMS de relance.',
            { risk: { baseChance: 0.5, onFailure: [s('credibility', -3), s('popularity', -2)], failureNews: 'Vos créanciers confirment. Le démenti se retourne contre vous.' } }),
        ],
      };
    },
  },
  {
    tag: 'donateur_genereux', weight: 0.8, minRank: 'conseiller_municipal', eligible: d => campaignOpen(d),
    build: () => ({
      title: 'Un donateur trop généreux',
      context: 'Un homme d’affaires veut verser 50 000 € à votre campagne. La loi plafonne les dons à 4 600 € par personne… « Mes cadres peuvent signer les chèques », suggère-t-il.',
      choices: [
        c('legal', 'Accepter le plafond légal, pas un euro de plus', [{ kind: 'funds', account: 'campaign', delta: 4500 }, s('credibility', 1)], 'Un chèque, un reçu, tout est en règle.'),
        c('pretenoms', 'Accepter via des prête-noms', [{ kind: 'funds', account: 'campaign', delta: 40000 }, { kind: 'exposure', delta: 15 }, { kind: 'flagAdd', key: 'illegal', delta: 1 }], 'Quatorze chèques de 3 000 €, signés par des gens que vous ne connaissez pas.'),
        c('refuser', 'Refuser poliment', [s('credibility', 2)], 'Il range son carnet. « Vous êtes bien naïf·ve. »'),
      ],
    }),
  },
  {
    tag: 'meeting_commun', weight: 0.8, minRank: 'conseiller_municipal',
    eligible: d => d.npcs.some(n => n.partyId === d.party.id && n.popularity >= 50 && n.relationToPlayer >= 0),
    build: d => {
      const n = d.npcs.filter(x => x.partyId === d.party.id && x.popularity >= 50 && x.relationToPlayer >= 0).sort((a, b) => b.popularity - a.popularity)[0];
      return {
        title: `${n.name} propose un meeting commun`,
        context: `« Toi et moi sur la même scène, ça remplirait n’importe quelle salle. » ${n.name} vous propose de partager l’affiche.`,
        choices: [
          c('accepter', 'Partager l’affiche', [{ kind: 'minigame', gameId: 'discours', title: `Meeting commun avec ${n.name}`, reward: [s('popularity', 4), { kind: 'momentum', delta: 4 }, rel(n.id, 5)], penalty: [s('popularity', -1), rel(n.id, -2)] }, s('energy', -6)], 'Deux pupitres, une salle comble. À vous de ne pas vous faire voler la vedette.'),
          c('vedette', 'Exiger de parler en dernier', [s('influence', 1), rel(n.id, -6)], 'Vous aurez le dernier mot. Et un·e camarade vexé·e.'),
          c('decliner', 'Décliner : chacun sa campagne', [rel(n.id, -2)], 'Chacun garde son public.'),
        ],
      };
    },
  },
];

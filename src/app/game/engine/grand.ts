import { Decision, DecisionChoice, Domain, Effect, GameState, Npc, StatKey } from '../models/game.models';
import { GREAT_INFO, GREAT_INFO_BY_ID, decisionActive, decisionBroken, decisionTaken, nextDecisionWeek, tourRunning } from '../data/great-decisions';
import { SECRET_BY_ID, playerSecrets } from './secrets';
import { rankOrder } from '../data/ranks';
import { renownTier } from '../data/lifestyles';
import { DOMAINS, DOMAIN_LABELS } from '../models/game.models';
import { applyEffects, pushNews } from './effects';
import { addMilestone } from './life';
import { engrave } from './memories';
import { frondes } from './frondes';
import { economy, electorate } from './country';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Grandes décisions (des choix uniques, débloqués sous
 *  conditions) et grandes luttes (des bras de fer nationaux
 *  sur plusieurs années, en quatre phases, que vos actions
 *  font pencher d'un côté ou de l'autre).
 * ============================================================ */

/* ── Grandes décisions ─────────────────────────────────────── */

interface GreatRule {
  /** Raison du blocage propre à la décision, ou null */
  block: (d: GameState) => string | null;
  /** Coûts payés à la signature */
  cost: { politicalCapital?: number; money?: number; renown?: number };
  /** Effets immédiats */
  run: (d: GameState, rng: Rng) => string[];
  /** Chaque mois, tant que l'engagement tient */
  monthly?: (d: GameState, rng: Rng) => void;
  /** Le rendez-vous de l'année (une décision à prendre), ou null */
  yearly?: (d: GameState, rng: Rng) => Decision | null;
  /** Conséquences propres du reniement */
  onBreak?: (d: GameState, rng: Rng) => Effect[];
}

const worstEnemy = (d: GameState): Npc | undefined => [...d.npcs].sort((a, b) => a.relationToPlayer - b.relationToPlayer)[0];
const bestDomain = (d: GameState) => [...DOMAINS].sort((a, b) => d.player.dossiers[b].mastery - d.player.dossiers[a].mastery)[0];
const npcById = (d: GameState, id: unknown) => d.npcs.find(n => n.id === id);
const st = (stat: StatKey, delta: number): Effect => ({ kind: 'stat', stat, delta });
const edict = (id: string, op: 'break' | 'violate' = 'break'): Effect => ({ kind: 'edict', id, op });
const yearlyDecision = (d: GameState, id: string, title: string, context: string, choices: DecisionChoice[]): Decision =>
  ({ id: nextId(d, 'dec'), tag: `gd_${id}`, week: d.week, deadlineWeek: d.week + 1, source: 'evenement', title, context, choices });

/** Les coups tordus qu'une charte éthique interdit */
export const CHARTE_FORBIDDEN = new Set(['intimider', 'detective', 'effacer_traces', 'complot_fouiller', 'faire_exemple']);

const RULES: Record<string, GreatRule> = {
  charte: {
    cost: { politicalCapital: 10 },
    block: d => (d.player.stats.credibility < 45 ? 'Il faut 45 de crédibilité' : null),
    run: (d, rng) => applyEffects(d, [st('credibility', 6), { kind: 'exposure', delta: -15 }, { kind: 'dread', delta: -10 }, { kind: 'renown', delta: 15 }], {}, rng),
    yearly: d => {
      const sec = playerSecrets(d)[0];
      if (!sec) return yearlyDecision(d, 'charte', 'La presse vérifie votre charte', 'Comme chaque année, un journal d’investigation épluche votre patrimoine, vos agendas et vos cadeaux.', [
        { id: 'ouvrir', label: 'Tout ouvrir, sans attendre', outcome: 'Rien à signaler : l’article salue votre transparence.', effects: [st('credibility', 3), { kind: 'renown', delta: 10 }] },
        { id: 'trainer', label: 'Faire attendre les journalistes', outcome: '« Que cache-t-il ? » titre le journal.', effects: [st('credibility', -3), { kind: 'exposure', delta: 4 }] },
      ]);
      const def = SECRET_BY_ID.get(sec.type);
      return yearlyDecision(d, 'charte', 'Un journaliste a trouvé quelque chose', `En vérifiant votre charte, une journaliste tombe sur une piste : ${def?.text ?? 'un secret ancien'}. L’article sort dans une semaine.`, [
        { id: 'avouer', label: 'Tout avouer avant la publication', outcome: 'Vous prenez les devants. La charte tient ; votre image vacille.', effects: [{ kind: 'secret', owner: 'player', reveal: true, type: sec.type }, st('credibility', -4), st('popularity', -3)] },
        { id: 'nier', label: 'Nier en bloc', hint: 'Si la preuve sort, la charte vole en éclats', outcome: 'La journaliste n’a pas assez pour publier. Pour cette fois.', effects: [st('stress', 6)],
          risk: { baseChance: 0.5, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [{ kind: 'secret', owner: 'player', reveal: true, type: sec.type }, edict('charte', 'violate')], failureNews: 'L’enquête paraît : vous avez menti. Votre charte vole en éclats.' } },
      ]);
    },
  },
  grand_oral: {
    cost: { renown: 60 },
    block: d => (renownTier(d.player.renown ?? 0) < 2 ? 'Il faut être Célèbre' : null),
    run: (d, rng) => applyEffects(d, [st('popularity', 6), st('stress', 6)], {}, rng),
    monthly: d => { d.player.renown = (d.player.renown ?? 0) + 1; },
    yearly: d => yearlyDecision(d, 'grand_oral', 'Le rendez-vous des Français', 'L’émission annuelle est programmée jeudi, 21 heures. Deux heures de direct, des questions sans filtre. Les Français vous attendent.', [
      { id: 'y_aller', label: 'Y aller, et tout donner', outcome: 'Deux heures sans fausse note : l’audience est record.', effects: [st('energy', -12), st('stress', 8), st('popularity', 3), { kind: 'renown', delta: 10 }],
        risk: { baseChance: 0.65, scaleWith: 'credibility', scaleWeight: 0.4, onFailure: [st('popularity', -5), st('credibility', -3)], failureNews: 'Une question vous désarçonne en direct ; l’extrait tourne en boucle.' } },
      { id: 'annuler', label: 'Annuler cette année', outcome: 'Les Français attendaient. Ils s’en souviendront.', effects: [st('popularity', -8), { kind: 'renown', delta: -30 }] },
      { id: 'arreter', label: 'Mettre fin au rendez-vous', hint: 'Renier l’engagement', outcome: 'La chaîne déprogramme l’émission.', effects: [edict('grand_oral')] },
    ]),
    onBreak: () => [st('popularity', -4)],
  },
  reconciliation: {
    cost: { politicalCapital: 15 },
    block: d => ((worstEnemy(d)?.relationToPlayer ?? 0) > -45 ? 'Personne ne vous déteste assez (il faut un ennemi sous −45)' : null),
    run: (d, rng) => {
      const e = worstEnemy(d)!;
      (d.opinions ?? []).filter(o => o.npcId === e.id && o.left < 0).forEach(o => { e.relationToPlayer -= o.left; o.left = 0; });
      engrave(d, e, 'La réconciliation', 30);
      (d.player.edictData ??= {})['gd_allie'] = e.id;
      return [...applyEffects(d, [{ kind: 'npcRelation', npcId: e.id, delta: 30, reason: 'Votre réconciliation' }], {}, rng), `${e.name} : rancunes effacées`];
    },
    monthly: d => { const a = npcById(d, d.player.edictData?.['gd_allie']); if (a && a.relationToPlayer < 20) a.relationToPlayer = 20; },
    yearly: (d, rng) => {
      const a = npcById(d, d.player.edictData?.['gd_allie']);
      if (!a) return null;
      const ask = rng.pick([
        { t: 'un poste pour un de ses proches', e: [st('politicalCapital', -8)] },
        { t: 'votre voix sur un texte qu’il ou elle porte', e: [st('credibility', -3), st('politicalCapital', -4)] },
        { t: 'un chèque pour sa campagne', e: [{ kind: 'funds', account: 'personal', delta: -6000 } as Effect] },
      ]);
      return yearlyDecision(d, 'reconciliation', `${a.name} vient réclamer son dû`, `Votre ancien ennemi, devenu allié, vous rappelle votre poignée de main. Il ou elle demande ${ask.t}.`, [
        { id: 'accorder', label: 'Accorder le service', outcome: 'La paix tient. Elle a un prix.', effects: [...ask.e, { kind: 'npcRelation', npcId: a.id, delta: 6, reason: 'Un service rendu' }] },
        { id: 'refuser', label: 'Refuser', hint: 'Rompt la paix : il ou elle se vengera', outcome: 'La poignée de main n’était qu’une photo.', effects: [edict('reconciliation')] },
      ]);
    },
    onBreak: d => { const a = npcById(d, d.player.edictData?.['gd_allie']); return a ? [{ kind: 'npcRelation', npcId: a.id, delta: -50, reason: 'La paix rompue' }, { kind: 'secret', owner: 'player', reveal: true }, st('popularity', -3)] : []; },
  },
  purge: {
    cost: { politicalCapital: 20 },
    block: d => (d.party.leaderNpcId !== 'player' ? 'Il faut diriger le parti' : (d.player.dread ?? 0) < 30 ? 'Il faut inspirer de la crainte (30)' : null),
    run: (d, rng) => {
      d.frondes = [];
      const ex = [...d.npcs].filter(n => n.partyId === d.party.id).sort((a, b) => a.relationToPlayer - b.relationToPlayer)[0];
      const out = applyEffects(d, [{ kind: 'dread', delta: 20 }, { kind: 'cohesion', delta: -10 }, { kind: 'faction', factionId: '*', delta: -5 }], {}, rng);
      if (ex) { (d.player.edictData ??= {})['gd_exclu'] = ex.id; out.push(...applyEffects(d, [{ kind: 'npcRelation', npcId: ex.id, delta: -40, reason: 'Son exclusion du parti' }], {}, rng), `${ex.name} prend la tête des exclus`); }
      return [...out, 'Toutes les frondes sont brisées'];
    },
    monthly: d => { d.party.cohesion = Math.min(d.party.cohesion, 70); },
    yearly: d => {
      const ex = npcById(d, d.player.edictData?.['gd_exclu']);
      const who = ex?.name ?? 'Le chef des exclus';
      return yearlyDecision(d, 'purge', 'Les exclus contre-attaquent', `${who} réunit les exclus de la purge dans un gymnase de banlieue. Débauchages, révélations, listes dissidentes : ils promettent de vous faire payer.`, [
        { id: 'ecraser', label: 'Les écraser une seconde fois', outcome: 'Vous menacez quiconque leur parle. Ça marche, pour l’instant.', effects: [{ kind: 'dread', delta: 6 }, st('credibility', -3), ...(ex ? [{ kind: 'npcRelation', npcId: ex.id, delta: -10, reason: 'Une seconde humiliation' } as Effect] : [])] },
        { id: 'ignorer', label: 'Les ignorer', outcome: 'Ils grignotent vos électeurs et quelques élus.', effects: [st('popularity', -3), { kind: 'cohesion', delta: -4 }, st('influence', -2)] },
        { id: 'reintegrer', label: 'Les réintégrer', hint: 'Renier la purge', outcome: 'Les exclus reviennent, la tête haute. Votre autorité en prend un coup.', effects: [edict('purge'), { kind: 'cohesion', delta: 8 }, { kind: 'faction', factionId: '*', delta: 5 }] },
      ]);
    },
    onBreak: () => [{ kind: 'dread', delta: -15 }],
  },
  pacte_courants: {
    cost: { politicalCapital: 18 },
    block: d => (d.player.stats.influence < 55 ? 'Il faut 55 d’influence' : null),
    run: (d, rng) => { d.frondes = []; return [...applyEffects(d, [{ kind: 'faction', factionId: '*', delta: 15 }, { kind: 'cohesion', delta: 8 }, { kind: 'renown', delta: 10 }], {}, rng), 'Les frondes s’éteignent']; },
    monthly: d => { for (const f of d.party.factions) f.supportForPlayer = clamp(f.supportForPlayer + 0.3); },
    yearly: d => {
      const f = [...d.party.factions].sort((a, b) => a.supportForPlayer - b.supportForPlayer)[0];
      if (!f) return null;
      return yearlyDecision(d, 'pacte_courants', `Le courant ${f.name.toLowerCase()} menace de rompre le pacte`, `Ses chefs estiment que le pacte ne profite qu’à vous. Ils réclament des gages, ou ils reprennent leur liberté.`, [
        { id: 'gages', label: 'Donner des gages', outcome: 'Deux postes et une motion commune : le pacte tient.', effects: [st('politicalCapital', -8), { kind: 'faction', factionId: f.id, delta: 8 }] },
        { id: 'tenir', label: 'Tenir bon, sans rien céder', outcome: 'Ils grognent, mais restent.', effects: [st('influence', 1)],
          risk: { baseChance: 0.55, scaleWith: 'influence', scaleWeight: 0.4, onFailure: [edict('pacte_courants')], failureNews: 'Le courant claque la porte : le pacte est mort.' } },
        { id: 'rompre', label: 'Rompre vous-même le pacte', hint: 'Renier l’engagement', outcome: 'Chacun reprend sa liberté.', effects: [edict('pacte_courants')] },
      ]);
    },
    onBreak: () => [{ kind: 'faction', factionId: '*', delta: -15 }, { kind: 'cohesion', delta: -6 }],
  },
  livre_blanc: {
    cost: { politicalCapital: 8 },
    block: d => (d.player.dossiers[bestDomain(d)].mastery < 75 ? 'Il faut maîtriser un dossier à 75' : null),
    run: (d, rng) => { const dom = bestDomain(d); (d.player.edictData ??= {})['gd_livre_domain'] = dom; return applyEffects(d, [st('credibility', 4), { kind: 'renown', delta: 30 }, { kind: 'flagAdd', key: 'livres', delta: 1 }, { kind: 'dossier', domain: dom, delta: 5 }], {}, rng); },
    monthly: d => {
      const dom = d.player.edictData?.['gd_livre_domain'] as Domain | undefined;
      if (dom && d.player.dossiers[dom] && d.player.dossiers[dom].mastery < 60) d.player.stats.credibility = clamp(d.player.stats.credibility - 1);
      else d.player.renown = (d.player.renown ?? 0) + 1;
    },
    yearly: d => {
      const dom = d.player.edictData?.['gd_livre_domain'] as Domain | undefined;
      const label = dom ? DOMAIN_LABELS[dom].toLowerCase() : 'votre sujet';
      return yearlyDecision(d, 'livre_blanc', 'Une contre-expertise démonte votre livre', `Un économiste réputé publie une réfutation chiffrée de votre livre blanc sur ${label}. Les plateaux vous invitent à répondre.`, [
        { id: 'repondre', label: 'Répondre point par point', outcome: 'Votre réponse fait autorité : le débat tourne à votre avantage.', effects: [{ kind: 'renown', delta: 15 }, st('credibility', 3)],
          risk: { baseChance: 0.45, scaleWith: 'dossier', scaleWeight: 0.5, onFailure: [st('credibility', -8), { kind: 'renown', delta: -20 }], failureNews: 'Il avait raison sur un chiffre clé. Le livre blanc prend l’eau.' } },
        { id: 'reediter', label: 'Publier une édition revue', outcome: 'Vous corrigez, vous complétez : le livre ressort plus solide.', effects: [st('politicalCapital', -5), st('credibility', 2), ...(dom ? [{ kind: 'dossier', domain: dom, delta: 3 } as Effect] : [])] },
        { id: 'ignorer', label: 'Ne pas répondre', outcome: 'Le silence passe pour un aveu.', effects: [st('credibility', -3)] },
      ]);
    },
  },
  mecene: {
    cost: { money: 30000 },
    block: d => (d.player.finances.personal < 30000 ? 'Il faut 30 000 € d’épargne' : null),
    run: (d, rng) => applyEffects(d, [{ kind: 'funds', account: 'personal', delta: -30000 }, st('popularity', 4), { kind: 'renown', delta: 40 }], {}, rng),
    monthly: (d, rng) => {
      if (d.player.finances.personal < 1500) {
        breakDecision(d, 'mecene', rng);
        applyEffects(d, [{ kind: 'renown', delta: -50 }, st('popularity', -3)], {}, rng);
        pushNews(d, 'actu', 'negative', 'Le mécène ne paie plus', 'Le festival annonce la fin de votre mécénat faute de versements. La presse s’en délecte.');
        return;
      }
      d.player.finances.personal -= 1500;
      d.player.renown = (d.player.renown ?? 0) + 2;
    },
    yearly: d => yearlyDecision(d, 'mecene', 'Votre festival : qui en tête d’affiche ?', 'Le festival que vous financez boucle sa programmation. Le directeur artistique vous laisse le dernier mot.', [
      { id: 'engage', label: 'Un artiste engagé, qui dérange', outcome: 'Concert historique. Une partie du public fulmine.', effects: [{ kind: 'segment', segment: 'jeunes', delta: 4 }, { kind: 'segment', segment: 'retraites', delta: -3 }, { kind: 'renown', delta: 12 }] },
      { id: 'populaire', label: 'Une grande vedette populaire', outcome: 'Guichets fermés, et votre nom sur toutes les affiches.', effects: [st('popularity', 2), { kind: 'renown', delta: 6 }] },
      { id: 'arreter', label: 'Arrêter le mécénat', hint: 'Renier l’engagement', outcome: 'Le festival devra trouver un autre mécène.', effects: [edict('mecene')] },
    ]),
    onBreak: () => [st('popularity', -3)],
  },
  tour_france: {
    cost: { politicalCapital: 12 },
    block: d => (rankOrder(d.player.rankId) < 2 ? 'Il faut être au moins député·e' : null),
    run: d => { d.player.flags['gd_tour_until'] = d.week + 6; return ['Six mois sur les routes de France commencent']; },
    monthly: d => {
      const until = Number(d.player.flags['gd_tour_until'] ?? 0);
      if (d.week < until) {
        const o = electorate(d).offsets;
        for (const k of Object.keys(o) as (keyof typeof o)[]) o[k] = clamp(o[k] + 1, -30, 30);
        const p = d.player.stats;
        p.energy = clamp(p.energy - 8); p.stress = clamp(p.stress + 4); p.influence = clamp(p.influence - 1);
      } else if (d.week === until) {
        d.player.renown = (d.player.renown ?? 0) + 40;
        pushNews(d, 'actu', 'positive', 'Fin du tour de France', '101 départements, des milliers de mains serrées : la France vous connaît désormais par cœur. Renommée +40.');
      }
    },
  },
  think_tank: {
    cost: { money: 20000 },
    block: d => (d.player.stats.influence < 50 ? 'Il faut 50 d’influence' : d.player.finances.personal < 20000 ? 'Il faut 20 000 € d’épargne' : null),
    run: (d, rng) => applyEffects(d, [{ kind: 'funds', account: 'personal', delta: -20000 }, st('credibility', 3), { kind: 'renown', delta: 20 }], {}, rng),
    monthly: (d, rng) => {
      if (d.player.finances.personal < 1200) {
        breakDecision(d, 'think_tank', rng);
        pushNews(d, 'actu', 'negative', 'Votre think tank ferme', 'Faute de financement, les chercheurs sont partis. Les notes s’arrêtent.');
        return;
      }
      d.player.finances.personal -= 1200;
    },
    yearly: d => yearlyDecision(d, 'think_tank', 'Un rapport de votre think tank fait polémique', 'Votre think tank propose de supprimer une niche fiscale très populaire. Les plateaux s’enflamment, et tout le monde vous demande si vous signez.', [
      { id: 'assumer', label: 'Assumer le rapport', outcome: 'On vous trouve courageux·se, ou inconscient·e.', effects: [st('credibility', 3), st('popularity', -3), { kind: 'renown', delta: 10 }] },
      { id: 'desavouer', label: 'Désavouer les auteurs', outcome: 'Les chercheurs grincent. La polémique retombe.', effects: [st('credibility', -4), st('influence', 1)] },
      { id: 'fermer', label: 'Fermer le think tank', hint: 'Renier l’engagement', outcome: 'Les bureaux sont rendus à la fin du mois.', effects: [edict('think_tank')] },
    ]),
  },
  memoires: {
    cost: { politicalCapital: 10 },
    block: d => (d.player.age < 50 ? 'Il faut avoir au moins 50 ans' : renownTier(d.player.renown ?? 0) < 2 ? 'Il faut être Célèbre' : null),
    run: (d, rng) => {
      const foes = [...d.npcs].sort((a, b) => a.relationToPlayer - b.relationToPlayer).slice(0, 3);
      (d.player.edictData ??= {})['gd_memoires_npcs'] = foes.map(n => n.id).join(',');
      return applyEffects(d, [{ kind: 'renown', delta: 80 }, { kind: 'funds', account: 'personal', delta: 25000 }, { kind: 'flagAdd', key: 'livres', delta: 1 },
        ...foes.map(n => ({ kind: 'npcRelation', npcId: n.id, delta: -20, reason: 'Un chapitre de vos mémoires' }) as Effect)], {}, rng);
    },
    monthly: d => { d.player.finances.personal += 250; },
    yearly: (d, rng) => {
      const ids = String(d.player.edictData?.['gd_memoires_npcs'] ?? '').split(',');
      const n = npcById(d, rng.pick(ids.length ? ids : ['']));
      if (!n) return null;
      return yearlyDecision(d, 'memoires', `${n.name} exige un droit de réponse`, `${n.name} conteste le chapitre de vos mémoires qui lui est consacré et menace de vous poursuivre pour diffamation.`, [
        { id: 'excuses', label: 'Présenter des excuses publiques', outcome: 'Un rectificatif à la prochaine édition. L’affaire est close.', effects: [{ kind: 'npcRelation', npcId: n.id, delta: 15, reason: 'Vos excuses publiques' }, st('credibility', -2)] },
        { id: 'maintenir', label: 'Maintenir chaque mot', outcome: 'Le tribunal vous donne raison : vos mémoires se vendent encore mieux.', effects: [{ kind: 'renown', delta: 15 }, { kind: 'funds', account: 'personal', delta: 4000 }],
          risk: { baseChance: 0.55, scaleWith: 'credibility', scaleWeight: 0.3, onFailure: [{ kind: 'funds', account: 'personal', delta: -15000 }, st('credibility', -5)], failureNews: 'Condamné·e pour diffamation : 15 000 € de dommages et intérêts.' } },
      ]);
    },
  },
  mouvement: {
    cost: { politicalCapital: 15 },
    block: d => (d.party.leaderNpcId === 'player' ? 'Vous dirigez déjà le parti' : d.player.stats.popularity < 55 ? 'Il faut 55 de popularité' : null),
    run: (d, rng) => {
      const chef = npcById(d, d.party.leaderNpcId);
      return applyEffects(d, [st('popularity', 5), { kind: 'segment', segment: 'jeunes', delta: 4 }, { kind: 'faction', factionId: '*', delta: -6 }, { kind: 'cohesion', delta: -6 },
        ...(chef ? [{ kind: 'npcRelation', npcId: chef.id, delta: -25, reason: 'Votre mouvement, à côté du parti' } as Effect] : [])], {}, rng);
    },
    monthly: d => { for (const f of d.party.factions) f.supportForPlayer = clamp(f.supportForPlayer - 0.3); },
    yearly: d => yearlyDecision(d, 'mouvement', 'Le parti vous somme de choisir', 'Le bureau national vote une motion : on ne peut pas être à la fois dans le parti et à la tête d’un mouvement concurrent. Il vous faut répondre.', [
      { id: 'assumer', label: 'Assumer la double appartenance', outcome: 'Le parti grince des dents. Vos comités, eux, grossissent.', effects: [{ kind: 'faction', factionId: '*', delta: -6 }, { kind: 'cohesion', delta: -4 }, st('popularity', 2), { kind: 'renown', delta: 10 }] },
      { id: 'dissoudre', label: 'Dissoudre le mouvement dans le parti', hint: 'Renier l’engagement', outcome: 'Le mouvement devient un « club » du parti. Vos militants déchantent.', effects: [edict('mouvement'), { kind: 'faction', factionId: '*', delta: 6 }] },
    ]),
    onBreak: () => [st('popularity', -4)],
  },
};

export const GREAT_DECISIONS = GREAT_INFO.map(g => ({ ...g, ...RULES[g.id] }));
export type GreatDecision = (typeof GREAT_DECISIONS)[number];

/** Combien de temps avant la prochaine grande décision */
export function decisionCooldown(d: GameState): number {
  return Math.max(0, nextDecisionWeek(d) - d.week);
}

export function cooldownText(months: number): string {
  const y = Math.floor(months / 12), m = months % 12;
  return [y ? `${y} an${y > 1 ? 's' : ''}` : '', m ? `${m} mois` : ''].filter(Boolean).join(' et ');
}

export function decisionsState(d: GameState) {
  const cd = decisionCooldown(d);
  return GREAT_DECISIONS.map(g => {
    const taken = decisionTaken(d, g.id), broken = decisionBroken(d, g.id);
    const clash = (g.excludes ?? []).concat(GREAT_DECISIONS.filter(o => o.excludes?.includes(g.id)).map(o => o.id)).find(id => decisionActive(d, id));
    // Condition propre (sans le délai de huit ans), pour l'afficher même pendant l'attente
    const cond = clash ? `Incompatible avec « ${GREAT_INFO_BY_ID.get(clash)!.label} »` : g.block(d) ?? costBlock(d, g);
    const block = taken ? (broken ? 'Engagement renié' : 'En vigueur') : cd > 0 ? `Prochaine grande décision dans ${cooldownText(cd)}` : cond;
    const excl = [...new Set((g.excludes ?? []).concat(GREAT_DECISIONS.filter(o => o.excludes?.includes(g.id)).map(o => o.id)))].map(id => GREAT_INFO_BY_ID.get(id)!.label);
    return { g, done: taken, active: taken && !broken, broken, block, cond, excl, since: taken ? Number(d.player.flags[`gd_${g.id}`]) : null, running: g.id === 'tour_france' && tourRunning(d) };
  });
}

function costBlock(d: GameState, g: GreatDecision): string | null {
  if ((g.cost.politicalCapital ?? 0) > d.player.stats.politicalCapital) return `Il faut ${g.cost.politicalCapital} de capital politique`;
  if ((g.cost.renown ?? 0) > (d.player.renown ?? 0)) return `Il faut ${g.cost.renown} de renommée`;
  if ((g.cost.money ?? 0) > d.player.finances.personal) return `Il faut ${(g.cost.money ?? 0).toLocaleString('fr-FR')} € d’épargne`;
  return null;
}

export function takeDecision(d: GameState, id: string, rng: Rng): string[] {
  const st0 = decisionsState(d).find(x => x.g.id === id);
  if (!st0 || st0.block) return [];
  const g = st0.g;
  d.player.flags[`gd_${g.id}`] = d.week;
  d.player.flags[`gd_${g.id}_y`] = d.week;
  d.player.stats.politicalCapital -= g.cost.politicalCapital ?? 0;
  d.player.renown = (d.player.renown ?? 0) - (g.cost.renown ?? 0);
  const out = g.run(d, rng);
  addMilestone(d, 'carriere', g.label, g.desc);
  pushNews(d, 'actu', 'positive', `Grande décision : ${g.label}`, out.join(' · '));
  return out;
}

/** Renier un engagement (ou le voir voler en éclats) */
export function breakDecision(d: GameState, id: string, rng: Rng, violation = false): string[] {
  const g = GREAT_DECISIONS.find(x => x.id === id);
  if (!g || !decisionActive(d, id)) return [];
  d.player.flags[`gd_${id}_broken`] = d.week;
  d.pendingDecisions = d.pendingDecisions.filter(x => x.tag !== `gd_${id}`);
  const base: Effect[] = violation
    ? [st('credibility', -20), { kind: 'renown', delta: -60 }, { kind: 'trait', trait: 'entache' }]
    : [st('credibility', -8), { kind: 'renown', delta: -30 }];
  const out = applyEffects(d, [...base, ...(g.onBreak?.(d, rng) ?? [])], {}, rng);
  addMilestone(d, 'carriere', violation ? `Parjure : ${g.label.toLowerCase()}` : `Engagement renié : ${g.label.toLowerCase()}`, violation ? 'Vous aviez juré. On ne vous croit plus.' : 'Un engagement de toute une vie, abandonné.');
  pushNews(d, 'actu', 'negative', violation ? 'Parjure' : 'Engagement renié', `${g.label} — ${out.join(' · ')}`);
  return [violation ? 'Votre charte vole en éclats' : 'Engagement renié', ...out];
}

/** Un coup tordu sous charte éthique : parjure */
export function checkCharte(d: GameState, actionId: string, rng: Rng): void {
  if (decisionActive(d, 'charte') && CHARTE_FORBIDDEN.has(actionId)) breakDecision(d, 'charte', rng, true);
}

/** Chaque mois : les engagements pèsent, et chaque année ils reviennent vous demander des comptes */
export function monthlyDecisions(d: GameState, rng: Rng): void {
  if (d.status !== 'en_cours') return;
  for (const g of GREAT_DECISIONS) {
    if (!decisionActive(d, g.id)) continue;
    g.monthly?.(d, rng);
    if (!decisionActive(d, g.id) || !g.yearly) continue;
    const last = Number(d.player.flags[`gd_${g.id}_y`] ?? d.player.flags[`gd_${g.id}`]);
    if (d.week - last < 12 || !rng.chance(0.35) || d.pendingDecisions.some(x => x.tag === `gd_${g.id}`)) continue;
    const dec = g.yearly(d, rng);
    d.player.flags[`gd_${g.id}_y`] = d.week;
    if (dec) d.pendingDecisions.push(dec);
  }
}

/** Effet « edict » : renier (ou violer) un engagement */
export function adjustEdict(d: GameState, e: Extract<Effect, { kind: 'edict' }>, rng: Rng): string[] {
  return breakDecision(d, e.id, rng, e.op === 'violate');
}

/* ── Grandes luttes ───────────────────────────────────────── */

export interface StruggleDef {
  id: string;
  icon: string;
  label: string;
  desc: string;
  /** Les deux camps : balance < 0 → gauche, > 0 → droite */
  sides: [string, string];
  phases: [string, string, string, string];
  endings: [{ title: string; text: string; effects: Effect[] }, { title: string; text: string; effects: Effect[] }];
}

export const PHASES = ['Ouverture', 'Tension', 'Conflit ouvert', 'Dénouement'];

export const STRUGGLES: StruggleDef[] = [
  { id: 'recomposition', icon: '🧩', label: 'La recomposition politique', desc: 'Les vieux partis se fissurent : une grande coalition des modérés, ou la polarisation des extrêmes ?',
    sides: ['Union des modérés', 'Polarisation'],
    phases: ['Des appels à « dépasser les clivages » se multiplient.', 'Les transfuges se comptent par dizaines.', 'Chaque parti se déchire sur la stratégie.', 'Le paysage politique se fige pour une génération.'],
    endings: [
      { title: 'La grande coalition des modérés', text: 'Les modérés de tous bords s’unissent : le centre gouverne pour longtemps.', effects: [{ kind: 'cohesion', delta: 5 }, { kind: 'stat', stat: 'credibility', delta: 4 }] },
      { title: 'Le temps des extrêmes', text: 'Les compromis sont morts : chaque élection devient un affrontement.', effects: [{ kind: 'stat', stat: 'popularity', delta: 3 }, { kind: 'dread', delta: 8 }] },
    ] },
  { id: 'decentralisation', icon: '🏞️', label: 'La grande décentralisation', desc: 'Paris ou les régions : qui décidera de la vie quotidienne des Français ?',
    sides: ['Les Jacobins', 'Les Girondins'],
    phases: ['Les présidents de région réclament plus de pouvoirs.', 'Des référendums locaux s’organisent.', 'Bras de fer entre l’État et les régions.', 'La France se dote d’un nouveau visage.'],
    endings: [
      { title: 'L’État reprend la main', text: 'Préfets renforcés, grandes politiques nationales : la République reste une et indivisible.', effects: [{ kind: 'stat', stat: 'influence', delta: 4 }, { kind: 'segment', segment: 'cadres', delta: 3 }] },
      { title: 'La France des régions', text: 'Écoles, routes, hôpitaux : les régions décident. Les territoires respirent.', effects: [{ kind: 'segment', segment: 'ruraux', delta: 5 }, { kind: 'stat', stat: 'popularity', delta: 3 }] },
    ] },
  { id: 'oublies', icon: '🌾', label: 'La France des oubliés', desc: 'Les petites villes et les campagnes se sentent abandonnées. Pacte ou révolte ?',
    sides: ['Le pacte rural', 'La révolte'],
    phases: ['Des cahiers de doléances fleurissent dans les mairies.', 'Ronds-points occupés, routes bloquées le samedi.', 'Le mouvement se structure et menace de tout bloquer.', 'Le pays doit répondre.'],
    endings: [
      { title: 'Le pacte des territoires', text: 'Services publics rouverts, médecins installés : la France périphérique se sent enfin entendue.', effects: [{ kind: 'segment', segment: 'ruraux', delta: 6 }, { kind: 'segment', segment: 'populaires', delta: 3 }] },
      { title: 'La France en colère', text: 'Les blocages ont duré des mois. La fracture est béante ; chaque élection s’en ressentira.', effects: [{ kind: 'segment', segment: 'ruraux', delta: -4 }, { kind: 'stat', stat: 'popularity', delta: -3 }] },
    ] },
];
export const STRUGGLE_BY_ID = new Map(STRUGGLES.map(s => [s.id, s]));

/** Chaque mois : une lutte s'ouvre parfois, progresse toujours */
export function monthlyStruggle(d: GameState, rng: Rng): void {
  if (d.status !== 'en_cours') return;
  const s = d.struggle;
  if (!s) {
    if (d.week < 12 || d.week - Number(d.player.flags['struggleEnd'] ?? -99) < 18 || !rng.chance(0.07)) return;
    const pool = STRUGGLES.filter(x => !d.player.flags[`struggle_${x.id}`]);
    if (!pool.length) return;
    const def = rng.pick(pool);
    d.struggle = { id: def.id, phase: 0, progress: 0, balance: Math.round(rng.range(-15, 15)), since: d.week };
    d.player.flags[`struggle_${def.id}`] = d.week;
    pushNews(d, 'actu', 'neutral', `Grande lutte : ${def.label}`, `${def.desc} ${def.phases[0]}`);
    return;
  }
  const def = STRUGGLE_BY_ID.get(s.id);
  if (!def) { d.struggle = null; return; }
  s.balance = clamp(s.balance + rng.range(-3, 3), -100, 100);
  s.progress = clamp(s.progress + 7 + Math.abs(s.balance) / 25);
  if (s.progress < 100) return;
  s.progress = 0;
  s.phase += 1;
  if (s.phase < 4) {
    pushNews(d, 'actu', 'neutral', `${def.label} : ${PHASES[s.phase].toLowerCase()}`, def.phases[s.phase]);
    return;
  }
  // Dénouement
  const end = s.balance <= 0 ? def.endings[0] : def.endings[1];
  const out = applyEffects(d, end.effects, {}, rng);
  addMilestone(d, 'carriere', end.title, end.text);
  pushNews(d, 'actu', 'neutral', end.title, `${end.text} ${out.join(' · ')}`);
  if (s.id === 'oublies' && s.balance > 0) economy(d).growth -= 0.2;
  d.struggle = null;
  d.player.flags['struggleEnd'] = d.week;
}

/** Effet « struggle » : peser sur la lutte en cours */
export function adjustStruggle(d: GameState, e: Extract<Effect, { kind: 'struggle' }>): string[] {
  const s = d.struggle;
  if (!s) return [];
  const def = STRUGGLE_BY_ID.get(s.id)!;
  const out: string[] = [];
  if (e.balance) { s.balance = clamp(s.balance + e.balance, -100, 100); out.push(`${e.balance < 0 ? def.sides[0] : def.sides[1]} ${e.balance > 0 ? '+' : ''}${Math.abs(e.balance)}`); }
  if (e.progress) { s.progress = clamp(s.progress + e.progress); out.push(`La lutte avance (+${e.progress})`); }
  return out;
}

export function domainLabel(d: GameState): string {
  return DOMAIN_LABELS[bestDomain(d)];
}

export { frondes };

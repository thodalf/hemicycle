import { DOMAIN_LABELS, Effect, STAT_LABELS } from '../models/game.models';
import { frSigned } from './rng';
import { TRAITS, TraitId } from '../data/traits';

/* ============================================================
 *  Traduction lisible des effets, pour afficher sur chaque
 *  action ce qu'on gagne… et ce qu'on y laisse.
 * ============================================================ */

export interface EffectChip {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

const n = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString('fr-FR')}`;
const tone = (v: number, inverse = false): EffectChip['tone'] => ((v > 0) !== inverse ? 'good' : 'bad');

export function describeEffect(e: Effect): EffectChip[] {
  switch (e.kind) {
    case 'stat': {
      const inverse = e.stat === 'stress';
      return [{ text: `${n(e.delta)} ${STAT_LABELS[e.stat].toLowerCase()}`, tone: tone(e.delta, inverse) }];
    }
    case 'trait': { const t = TRAITS[e.trait as TraitId]; return t ? [{ text: `trait ${t.icon} ${t.label.toLowerCase()}`, tone: t.tone === 'bad' ? 'bad' : 'good' }] : []; }
    case 'momentum': return [{ text: `${n(e.delta)} dynamique`, tone: tone(e.delta) }];
    case 'renown': return [{ text: `${n(e.delta)} renommée`, tone: tone(e.delta) }];
    case 'dread': return [{ text: `${n(e.delta)} crainte`, tone: 'neutral' }];
    case 'secret': return [{ text: e.reveal ? 'secret rendu public' : e.type ? 'un secret de plus' : 'découvrir un secret', tone: e.reveal || e.type ? 'bad' : 'good' }];
    case 'hook': return [{ text: `levier ${e.strength}`, tone: 'good' }];
    case 'struggle': return [{ text: e.balance ? `lutte ${e.balance < 0 ? '◀' : '▶'} ${Math.abs(e.balance)}` : `lutte +${e.progress ?? 0}`, tone: 'neutral' }];
    case 'edict': return [{ text: e.op === 'violate' ? 'rompt votre charte' : 'renie l’engagement', tone: 'bad' }];
    case 'fronde': return [{ text: `${e.delta < 0 ? 'affaiblit' : 'renforce'} la fronde`, tone: e.delta < 0 ? 'good' : 'bad' }];
    case 'dossier': return [{ text: `${n(e.delta)} dossier ${e.domain === '$domain' ? 'ciblé' : DOMAIN_LABELS[e.domain].toLowerCase()}`, tone: tone(e.delta) }];
    case 'faction': {
      const who = e.factionId === '*' ? 'tous les courants' : e.factionId === '$target' ? 'courant ciblé'
        : { ligne_dure: 'ligne dure', moderes: 'modérés', reformistes: 'réformistes' }[e.factionId];
      return [{ text: `${n(e.delta)} ${who}`, tone: tone(e.delta) }];
    }
    case 'cohesion': return [{ text: `${n(e.delta)} cohésion du parti`, tone: tone(e.delta) }];
    case 'exposure': return [{ text: `${n(e.delta)} exposition aux scandales`, tone: tone(e.delta, true) }];
    case 'funds': return [{ text: `${n(e.delta)} € ${e.account === 'campaign' ? 'campagne' : 'perso'}`, tone: tone(e.delta) }];
    case 'income': return [{ text: `+${e.base.toLocaleString('fr-FR')} €${e.scale ? ' et plus' : ''} perso`, tone: 'good' }];
    case 'npcRelation': return [{ text: `${n(e.delta)} relation${e.npcId === '$target' ? ' avec la cible' : ''}`, tone: tone(e.delta) }];
    case 'npcStat': return [{ text: `${n(e.delta)} ${e.stat === 'popularity' ? 'popularité' : 'influence'} de la cible`, tone: tone(e.delta, true) }];
    case 'contact': return e.trust ? [{ text: `${n(e.trust)} confiance${e.contactId === '$target' ? ' du contact' : ''}`, tone: tone(e.trust) }] : [];
    case 'stance': return [{ text: `Ligne ${e.delta > 0 ? 'vers la droite' : 'vers la gauche'} (${Math.abs(e.delta)})`, tone: 'neutral' }];
    case 'family': return [{ text: e.partner === 'meet' ? 'Une nouvelle histoire' : e.partner === 'marry' ? 'Mariage' : e.partner === 'divorce' ? 'Séparation' : e.child ? 'Un enfant' : e.parentHealth ? `Santé de votre parent ${frSigned(e.parentHealth)}` : 'Vie de famille', tone: e.partner === 'divorce' || (e.parentHealth ?? 0) < 0 ? 'bad' : 'neutral' }];
    case 'heir': return [{ text: 'Désigne votre dauphin·e', tone: 'good' }];
    case 'promise': return [{ text: e.keep ? 'Rapproche une promesse de son terme' : 'Promesse à tenir sous deux ans (+15 de maîtrise)', tone: e.keep ? 'good' : 'neutral' }];
    case 'localProject': return [{ text: e.boost ? `Chantier local : ${e.boost} mois d’avance` : e.attachment ? `Attachement du territoire ${frSigned(e.attachment)}` : 'Lance un chantier local', tone: 'good' }];
    case 'rivalPlot': return [{ text: 'Déjoue les manœuvres des rivaux', tone: 'good' }];
    case 'economy': {
      const out: { text: string; tone: 'good' | 'bad' | 'neutral' }[] = [];
      const pt = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString('fr-FR')} pt`;
      if (e.growth) out.push({ text: `Croissance ${pt(e.growth)}`, tone: e.growth > 0 ? 'good' : 'bad' });
      if (e.unemployment) out.push({ text: `Chômage ${pt(e.unemployment)}`, tone: e.unemployment < 0 ? 'good' : 'bad' });
      if (e.deficit) out.push({ text: `Déficit ${pt(e.deficit)}`, tone: e.deficit < 0 ? 'good' : 'bad' });
      if (e.inflation) out.push({ text: `Inflation ${pt(e.inflation)}`, tone: e.inflation < 0 ? 'good' : 'bad' });
      if (e.confidence) out.push({ text: `Confiance ${frSigned(e.confidence)}`, tone: e.confidence > 0 ? 'good' : 'bad' });
      return out;
    }
    case 'segment': {
      const labels: Record<string, string> = { jeunes: 'jeunes', retraites: 'retraités', populaires: 'classes populaires', cadres: 'cadres', ruraux: 'ruraux', '*': 'tous les électorats' };
      return [{ text: `${frSigned(e.delta)} chez les ${labels[e.segment]}`.replace('chez les tous', 'dans tous'), tone: e.delta > 0 ? 'good' : 'bad' }];
    }
    case 'coalition': return e.open ? [{ text: 'Ouvre des négociations de coalition', tone: 'neutral' }]
      : e.mood ? [{ text: `Humeur du partenaire ${frSigned(e.mood)}`, tone: e.mood > 0 ? 'good' : 'bad' }]
      : e.leave ? [{ text: 'Rompt la coalition', tone: 'bad' }] : [{ text: 'Forme une coalition', tone: 'good' }];
    case 'apocalypse': {
      const out: { text: string; tone: 'good' | 'bad' | 'neutral' }[] = [];
      if (e.start) out.push({ text: 'Déclenche la fin du monde', tone: 'bad' });
      if (e.darkness) out.push({ text: `Ténèbres ${frSigned(e.darkness)}`, tone: e.darkness < 0 ? 'good' : 'bad' });
      if (e.resistance) out.push({ text: `Résistance ${frSigned(e.resistance)}`, tone: e.resistance > 0 ? 'good' : 'bad' });
      if (e.cult) out.push({ text: `Emprise de la secte ${frSigned(e.cult)}`, tone: e.cult < 0 ? 'good' : 'bad' });
      if (e.raid) out.push({ text: 'Raid contre la secte (avant le rituel)', tone: 'neutral' });
      if (e.pact) out.push({ text: 'Pacte avec le Diable', tone: 'neutral' });
      return out;
    }
    case 'quote': return [{ text: e.bold >= 0.6 ? 'Formule risquée : culte… ou boulet' : e.bold >= 0.3 ? 'Formule marquante' : 'Formule prudente', tone: 'neutral' }];
    case 'annex': return [{ text: e.mode === 'liberer' ? 'Rendre l’indépendance : prestige +10' : e.mode === 'annex' ? 'Annexion : prestige −15, tension +20' : e.mode === 'protectorat' ? 'Protectorat : influence +3' : e.mode === 'reparations' ? 'Réparations : déficit −0,4 pt' : 'Paix magnanime : prestige +12', tone: e.mode === 'annex' ? 'neutral' : 'good' }];
    case 'circo': return [{ text: e.move === 'bastion' ? 'Parachutage dans un bastion' : e.move === 'mission' ? 'Parachutage en terre de mission' : 'Parachutage dans une circonscription disputée', tone: 'neutral' }];
    case 'crisis': {
      const out: { text: string; tone: 'good' | 'bad' | 'neutral' }[] = [];
      if (e.start) out.push({ text: 'Déclenche une crise', tone: 'bad' });
      if (e.gauge) out.push({ text: `Avancée ${frSigned(e.gauge)}`, tone: e.gauge > 0 ? 'good' : 'bad' });
      if (e.risk) out.push({ text: `Risque ${frSigned(e.risk)}`, tone: e.risk > 0 ? 'bad' : 'good' });
      return out;
    }
    case 'zombie': {
      if (e.start) return [{ text: 'Déclenche l’épidémie Z', tone: 'bad' }];
      const out: { text: string; tone: 'good' | 'bad' | 'neutral' }[] = [];
      const sg = (v: number) => (v > 0 ? `+${v}` : `${v}`);
      if (e.infection) out.push({ text: `Infection ${sg(e.infection)}`, tone: e.infection > 0 ? 'bad' : 'good' });
      if (e.containment) out.push({ text: `Confinement ${sg(e.containment)}`, tone: e.containment > 0 ? 'good' : 'bad' });
      if (e.panic) out.push({ text: `Panique ${sg(e.panic)}`, tone: e.panic > 0 ? 'bad' : 'good' });
      if (e.cure) out.push({ text: `Recherche ${sg(e.cure)}`, tone: e.cure > 0 ? 'good' : 'bad' });
      if (e.shelter) out.push({ text: 'À l’abri dans un bastion', tone: 'good' });
      return out;
    }
    case 'phoneBook': return [{ text: e.npcId === '$any' ? 'Un numéro de personnalité' : 'Son numéro de portable', tone: 'good' }];
    case 'scheme': return e.ally ? [{ text: 'Recrute un complice (s’il accepte)', tone: 'neutral' }] : e.type ? [{ text: 'Lance un complot (risque d’être découvert)', tone: 'neutral' }]
      : [...(e.progress ? [{ text: `Complots : progression +${e.progress}`, tone: 'good' as const }] : []), ...(e.secrecy ? [{ text: `Complots : discrétion ${frSigned(e.secrecy)}`, tone: e.secrecy > 0 ? 'good' as const : 'bad' as const }] : [])];
    case 'flagAdd': return e.key === 'illegal' ? [{ text: 'Illégal : risque d’enquête', tone: 'bad' }]
      : e.key === 'hygiene' ? [{ text: `${n(e.delta)} hygiène de vie`, tone: tone(e.delta) }]
      : e.key === 'protection' ? [{ text: `${n(e.delta)} protection`, tone: tone(e.delta) }]
      : e.key === 'e2t' ? [{ text: `${n(e.delta)} au second tour`, tone: tone(e.delta) }]
      : e.key === 'debatePrep' ? [{ text: 'Sang-froid au prochain débat', tone: 'good' }] : [];
    case 'skillPoints': return [{ text: `${n(e.delta)} pt de compétence`, tone: tone(e.delta) }];
    case 'partyTreasury': return [{ text: `${n(e.delta)} k€ caisse du parti`, tone: tone(e.delta) }];
    case 'press': {
      const out: EffectChip[] = [];
      if (e.audience) out.push({ text: `${n(e.audience)} audience`, tone: tone(e.audience) });
      if (e.reputation) out.push({ text: `${n(e.reputation)} réputation`, tone: tone(e.reputation) });
      if (e.independance) out.push({ text: `${n(e.independance)} indépendance`, tone: tone(e.independance) });
      if (e.scoops) out.push({ text: e.scoops > 0 ? 'Scoop' : 'Scoop perdu', tone: tone(e.scoops) });
      if (e.salaryPct) out.push({ text: `${n(e.salaryPct)} % de salaire`, tone: tone(e.salaryPct) });
      return out;
    }
    case 'crown': {
      const out: EffectChip[] = [];
      if (e.soutien) out.push({ text: `${n(e.soutien)} soutien royaliste`, tone: tone(e.soutien) });
      if (e.legitimite) out.push({ text: `${n(e.legitimite)} légitimité`, tone: tone(e.legitimite) });
      if (e.armee) out.push({ text: `${n(e.armee)} armée`, tone: tone(e.armee) });
      return out;
    }
    case 'lodge': {
      const out: EffectChip[] = [];
      if (e.fraternite) out.push({ text: `${n(e.fraternite)} fraternité`, tone: tone(e.fraternite) });
      if (e.discretion) out.push({ text: `${n(e.discretion)} discrétion`, tone: tone(e.discretion) });
      if (e.planches) out.push({ text: `${n(e.planches)} planche`, tone: tone(e.planches) });
      return out;
    }
    case 'mole': {
      const out: EffectChip[] = [];
      if (e.intel) out.push({ text: `${n(e.intel)} renseignements`, tone: tone(e.intel) });
      if (e.cover) out.push({ text: `${n(e.cover)} couverture`, tone: tone(e.cover) });
      if (e.sabotage) out.push({ text: `${n(e.sabotage)} sabotage`, tone: 'good' });
      if (e.leaderPop) out.push({ text: `${n(e.leaderPop)} popularité du chef adverse`, tone: tone(e.leaderPop, true) });
      if (e.handler) out.push({ text: `${n(e.handler)} confiance de l’officier`, tone: tone(e.handler) });
      if (e.deliver) out.push({ text: 'Transmet vos renseignements', tone: 'good' });
      return out;
    }
    case 'intl': {
      const out: EffectChip[] = [];
      if (e.relation) out.push({ text: `${n(e.relation)} relations${e.partner === '$target' ? ' (pays ciblé)' : ''}`, tone: tone(e.relation) });
      if (e.allRelations) out.push({ text: `${n(e.allRelations)} relations internationales`, tone: tone(e.allRelations) });
      if (e.prestige) out.push({ text: `${n(e.prestige)} prestige international`, tone: tone(e.prestige) });
      if (e.tension) out.push({ text: `${n(e.tension)} tensions`, tone: tone(e.tension, true) });
      if (e.crisis) out.push({ text: e.crisis < 0 ? `Apaise la crise (${n(e.crisis)})` : `Aggrave la crise (${n(e.crisis)})`, tone: tone(e.crisis, true) });
      if (e.startCrisis) out.push({ text: 'Crise internationale', tone: 'bad' });
      return out;
    }
    case 'government': {
      const out: EffectChip[] = [];
      if (e.majority) out.push({ text: `${n(e.majority)} majorité`, tone: tone(e.majority) });
      if (e.cohesion) out.push({ text: `${n(e.cohesion)} solidarité gouvernementale`, tone: tone(e.cohesion) });
      if (e.form) out.push({ text: `Gouvernement ${e.form}`, tone: 'neutral' });
      if (e.fall) out.push({ text: 'Chute du gouvernement', tone: 'bad' });
      return out;
    }
    case 'health': return [{ text: `${n(e.delta)} santé`, tone: tone(e.delta) }];
    case 'parrainages': return [{ text: `${n(e.delta)} parrainages`, tone: tone(e.delta) }];
    case 'declare': return [{ text: 'Candidature à la présidentielle', tone: 'neutral' }];
    case 'resign': return [{ text: 'Quitte l’Élysée', tone: 'bad' }];
    case 'die': return [{ text: 'Danger de mort', tone: 'bad' }];
    case 'presidency': {
      const out: EffectChip[] = [];
      if (e.approval) out.push({ text: `${n(e.approval)} cote de confiance`, tone: tone(e.approval) });
      if (e.majority) out.push({ text: `${n(e.majority)} majorité`, tone: tone(e.majority) });
      if (e.security) out.push({ text: `${n(e.security)} sécurité`, tone: tone(e.security) });
      if (e.threat) out.push({ text: `${n(e.threat)} menace`, tone: tone(e.threat, true) });
      if (e.reform) out.push({ text: 'Réforme (vote de l’Assemblée)', tone: 'good' });
      if (e.pm) out.push({ text: 'Nouveau Premier ministre', tone: 'neutral' });
      if (e.dissolve) out.push({ text: 'Législatives anticipées', tone: 'neutral' });
      return out;
    }
    case 'end': return [{ text: e.status === 'victoire' ? 'Nouveau chapitre possible' : 'Revers possible', tone: 'neutral' }];
    case 'scene': return [{ text: 'Scène interactive', tone: 'neutral' }];
    case 'debate': return [{ text: 'Débat', tone: 'neutral' }];
    case 'protest': return [{ text: 'Manifestation', tone: 'neutral' }];
    case 'decision': return [{ text: 'Décision à prendre', tone: 'neutral' }];
    case 'booster': return [{ text: `${e.count} booster`, tone: 'good' }];
    case 'war': {
      const out: EffectChip[] = [];
      if (e.declare) out.push({ text: 'Vote du Parlement sur la guerre', tone: 'neutral' });
      if (e.front) out.push({ text: `${n(e.front)} front`, tone: tone(e.front) });
      if (e.support) out.push({ text: `${n(e.support)} soutien à la guerre`, tone: tone(e.support) });
      if (e.losses) out.push({ text: `${e.losses.toLocaleString('fr-FR')} soldats tombés`, tone: 'bad' });
      if (e.ally) out.push({ text: 'Tente de rallier un allié', tone: 'neutral' });
      if (e.peace) out.push({ text: 'Fin de la guerre', tone: 'neutral' });
      if (e.invade) out.push({ text: 'La France est attaquée', tone: 'bad' });
      if (e.total) out.push({ text: 'Guerre totale', tone: 'bad' });
      if (e.effort) out.push({ text: `${n(e.effort)} effort de guerre`, tone: tone(e.effort) });
      if (e.morale) out.push({ text: `${n(e.morale)} moral de l’arrière`, tone: tone(e.morale) });
      return out;
    }
    case 'vote': return [{ text: 'Scrutin à l’Assemblée', tone: 'neutral' }];
    case 'hostile': return [{ text: `${n(e.delta)} relations ${e.enemy === 'all' ? 'avec les États hostiles' : 'avec l’État visé'}`, tone: tone(e.delta) }];
    case 'team': {
      const out: EffectChip[] = [];
      if (e.salaryPct) out.push({ text: `${n(e.salaryPct)} % salaire ${e.all ? 'de l’équipe' : ''}`.trim(), tone: 'neutral' });
      if (e.morale) out.push({ text: `${n(e.morale)} moral ${e.all ? 'de l’équipe' : ''}`.trim(), tone: tone(e.morale) });
      return out;
    }
    case 'side': return e.stop ? [{ text: `Fin : ${e.label}`, tone: 'neutral' }] : [{ text: `+${e.amount.toLocaleString('fr-FR')} €/mois${e.months ? ` · ${e.months} mois` : ''}`, tone: 'good' }];
    case 'leaderPay': return [{ text: 'Votre salaire change', tone: 'neutral' }];
    case 'plot': {
      const out: EffectChip[] = [];
      if (e.start) out.push({ text: 'Un complot se trame', tone: 'bad' });
      if (e.danger) out.push({ text: `${n(e.danger)} imminence`, tone: tone(e.danger, true) });
      if (e.intel) out.push({ text: `${n(e.intel)} enquête`, tone: tone(e.intel) });
      if (e.vest) out.push({ text: 'Gilet pare-balles', tone: 'good' });
      return out;
    }
    case 'civil': {
      const out: EffectChip[] = [];
      if (e.join) out.push({ text: e.join === 'classement' ? 'Concours : le classement décide du corps' : 'Entrée dans la haute fonction publique', tone: 'good' });
      if (e.grade) out.push({ text: e.grade > 0 ? 'Promotion dans le corps' : 'Rétrogradation', tone: tone(e.grade) });
      if (e.leave) out.push({ text: 'Quitte la fonction publique', tone: 'neutral' });
      if (e.study) out.push({ text: `+${e.study} dossier du corps`, tone: 'good' });
      return out;
    }
    case 'alien': {
      const out: EffectChip[] = [];
      if (e.join) out.push({ text: 'Dossier du Premier contact', tone: 'neutral' });
      if (e.comprehension) out.push({ text: `${n(e.comprehension)} compréhension`, tone: tone(e.comprehension) });
      if (e.confiance) out.push({ text: `${n(e.confiance)} confiance des Vélari`, tone: tone(e.confiance) });
      if (e.panique) out.push({ text: `${n(e.panique)} panique`, tone: tone(e.panique, true) });
      if (e.rivalite) out.push({ text: `${n(e.rivalite)} rivalité des puissances`, tone: tone(e.rivalite, true) });
      if (e.gift) out.push({ text: 'Technologie vélari', tone: 'good' });
      return out;
    }
    case 'minigame': return [{ text: 'Mini-jeu', tone: 'neutral' }, ...e.reward.flatMap(describeEffect)];
    case 'loan': return [{ text: `Prêt de ${e.amount.toLocaleString('fr-FR')} €`, tone: 'neutral' }];
    default: return [];
  }
}

export function describeEffects(effects: Effect[]): { gains: EffectChip[]; losses: EffectChip[]; other: EffectChip[] } {
  const all = effects.flatMap(describeEffect);
  return {
    gains: all.filter(c => c.tone === 'good'),
    losses: all.filter(c => c.tone === 'bad'),
    other: all.filter(c => c.tone === 'neutral'),
  };
}

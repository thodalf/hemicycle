import { DOMAIN_LABELS, Effect, STAT_LABELS } from '../models/game.models';

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
    case 'momentum': return [{ text: `${n(e.delta)} dynamique`, tone: tone(e.delta) }];
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
    case 'flagAdd': return e.key === 'illegal' ? [{ text: 'Illégal : risque d’enquête', tone: 'bad' }] : [];
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

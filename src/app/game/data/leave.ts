import { Effect, StaffRole } from '../models/game.models';

/** Ce qui manque quand un poste part en vacances : la spécialité de chacun */
export const LEAVE_MALUS: Record<StaffRole, { label: string; effects: Effect[] }> = {
  conseiller: { label: 'personne pour relire vos fiches (crédibilité −2)', effects: [{ kind: 'stat', stat: 'credibility', delta: -2 }] },
  coach: { label: 'plus de préparation aux médias (stress +3, crédibilité −1)', effects: [{ kind: 'stat', stat: 'stress', delta: 3 }, { kind: 'stat', stat: 'credibility', delta: -1 }] },
  plume: { label: 'des discours moins inspirés (influence −2)', effects: [{ kind: 'stat', stat: 'influence', delta: -2 }] },
  tresorier: { label: 'des comptes moins surveillés (exposition +3)', effects: [{ kind: 'exposure', delta: 3 }] },
  directeur_campagne: { label: 'la campagne tourne au ralenti (dynamique −4)', effects: [{ kind: 'momentum', delta: -4 }] },
  spin_doctor: { label: 'plus personne pour éteindre les polémiques (exposition +3)', effects: [{ kind: 'exposure', delta: 3 }] },
  community_manager: { label: 'des réseaux en sommeil (jeunes −2, popularité −1)', effects: [{ kind: 'segment', segment: 'jeunes', delta: -2 }, { kind: 'stat', stat: 'popularity', delta: -1 }] },
  chauffeur: { label: 'transports en commun et retards (énergie −8)', effects: [{ kind: 'stat', stat: 'energy', delta: -8 }] },
  attache_presse: { label: 'les journalistes n’ont plus d’interlocuteur (popularité −2)', effects: [{ kind: 'stat', stat: 'popularity', delta: -2 }] },
  sondeur: { label: 'vous naviguez à l’aveugle (dynamique −3)', effects: [{ kind: 'momentum', delta: -3 }] },
  assistant_parlementaire: { label: 'les amendements s’empilent (crédibilité −1, stress +2)', effects: [{ kind: 'stat', stat: 'credibility', delta: -1 }, { kind: 'stat', stat: 'stress', delta: 2 }] },
  juriste: { label: 'des contrats relus en diagonale (exposition +2)', effects: [{ kind: 'exposure', delta: 2 }] },
  garde_du_corps: { label: 'une sécurité allégée (menace +4)', effects: [{ kind: 'flagAdd', key: 'menace', delta: 4 }] },
  chef_cabinet: { label: 'un agenda en désordre (énergie −5, stress +3)', effects: [{ kind: 'stat', stat: 'energy', delta: -5 }, { kind: 'stat', stat: 'stress', delta: 3 }] },
  sherpa: { label: 'les sommets se préparent mal (prestige −1)', effects: [{ kind: 'intl', prestige: -1 }] },
};


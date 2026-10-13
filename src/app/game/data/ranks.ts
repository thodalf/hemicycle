import { ElectionConfig, ElectionType, RankDefinition, RankId } from '../models/game.models';

export const RANKS: Record<RankId, RankDefinition> = {
  militant: {
    id: 'militant', label: 'Militant·e', order: 0, monthlyActionPoints: 5, monthlyIncome: 2400,
    promotion: { via: 'election', election: 'municipales', to: 'conseiller_municipal', requires: { popularity: 20, influence: 15 } },
  },
  conseiller_municipal: {
    id: 'conseiller_municipal', label: 'Conseiller·e municipal·e', order: 1, monthlyActionPoints: 6, monthlyIncome: 2900,
    promotion: { via: 'election', election: 'legislatives', to: 'depute', requires: { popularity: 35, influence: 30, credibility: 30 } },
  },
  depute: {
    id: 'depute', label: 'Député·e', order: 2, monthlyActionPoints: 7, monthlyIncome: 7600,
    promotion: { via: 'nomination', occasion: 'Remaniement ministériel', to: 'ministre', requires: { influence: 50, credibility: 50 }, minPartySupport: 50 },
  },
  ministre: {
    id: 'ministre', label: 'Ministre', order: 3, monthlyActionPoints: 8, monthlyIncome: 10600,
    promotion: { via: 'nomination', occasion: 'Congrès du parti', to: 'chef_parti', requires: { influence: 65 }, minPartySupport: 55 },
  },
  premier_ministre: {
    id: 'premier_ministre', label: 'Premier·e ministre', order: 3, monthlyActionPoints: 9, monthlyIncome: 14900,
    promotion: { via: 'nomination', occasion: 'Congrès du parti', to: 'chef_parti', requires: { influence: 65 }, minPartySupport: 55 },
  },
  chef_parti: {
    id: 'chef_parti', label: 'Chef·fe de parti', order: 4, monthlyActionPoints: 8, monthlyIncome: 6200,
    promotion: { via: 'election', election: 'primaire', to: 'candidat_presidence', requires: { popularity: 50, credibility: 50 } },
  },
  candidat_presidence: {
    id: 'candidat_presidence', label: 'Candidat·e à la présidence', order: 5, monthlyActionPoints: 9, monthlyIncome: 10600,
    promotion: { via: 'election', election: 'presidentielle', to: 'president', requires: {} },
  },
  president: {
    id: 'president', label: 'Président·e de la République', order: 6, monthlyActionPoints: 9, monthlyIncome: 15200,
    promotion: null,
  },
  ancien_president: {
    id: 'ancien_president', label: 'Ancien·ne président·e', order: 6, monthlyActionPoints: 6, monthlyIncome: 6200,
    promotion: null,
  },
};

export const rankOrder = (id: RankId) => RANKS[id].order;

export const ELECTIONS: Record<ElectionType, ElectionConfig> = {
  municipales:    { label: 'Élections municipales',  campaignMonths: 4, interval: 6, legalCeiling: 25_000,  opponents: 2, internal: false },
  legislatives:   { label: 'Élections législatives', campaignMonths: 5, interval: 8, legalCeiling: 60_000,  opponents: 3, internal: false },
  primaire:       { label: 'Primaire du parti',      campaignMonths: 3, interval: 6, legalCeiling: 120_000, opponents: 2, internal: true },
  presidentielle: { label: 'Élection présidentielle', campaignMonths: 5, interval: 0, legalCeiling: 400_000, opponents: 3, internal: false },
};

/** Date de début de partie : chaque tour = un mois (tour 1 = janvier 2027) */
export const START_DATE = new Date(2027, 0, 1);

/* ── Calendrier présidentiel (en mois) ── */
/** Premier scrutin présidentiel (avril 2027) */
export const FIRST_PRESIDENTIAL_WEEK = 4;
/** Durée d'un mandat : cinq ans */
export const MANDATE_MONTHS = 60;
export const PARRAINAGES_REQUIRED = 500;
/** On peut se déclarer jusqu'à un an et demi avant le scrutin */
export const DECLARE_WINDOW = 18;
/** Âge de départ selon le scénario */
export const START_AGE: Record<string, number> = {
  carriere: 26, presidentielle: 52, bercy: 47, royaute: 45, franc_macon: 38, editorialiste: 31, infiltre: 27, contact: 41, invasion: 49, guerre_totale: 56,
};

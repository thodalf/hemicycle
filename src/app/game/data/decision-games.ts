import { Decision, DecisionChoice } from '../models/game.models';
import { MINIGAMES_BY_ID, MinigameDef } from './minigames';

/**
 * Certains choix se jouent : au lieu d'appliquer les effets d'un coup, ils lancent un
 * mini-jeu dont le score décide de l'ampleur du résultat (brillant, réussi, mitigé, raté).
 * Clé : étiquette de la décision → identifiant du choix → mini-jeu.
 */
export const DECISION_GAMES: Record<string, Record<string, string>> = {
  micro_coupe: { improviser: 'discours' },
  guerre_bilan: { intensifier: 'bataille' },
  escalade: { tenir: 'bataille' },
  z_horde: { tenir: 'defense_zombies' },
  musee_cambriole: { securite: 'enquete_joyaux' },
  ev_vol_musee: { audit: 'enquete_joyaux' },
  ev_vote_sabote: { enqueter: 'enquete_sabotage' },
  voeux_janvier: { discours: 'plume_discours' },
  garden_party: { jardins: 'selfies' },
  greve_cantine: { negocier: 'negociation_syndicale' },
  vote_serre: { rallier: 'pointage' },
  mecene: { negocier: 'negociation_donateur' },
  sondage_star: { capitaliser: 'matinale' },
  plateau_debat: { accepter: 'eloquence' },
  agriculteurs: { recevoir: 'negociation_syndicale' },
  deepfake: { plainte: 'factcheck_direct' },
  ecole: { accepter: 'trivial' },
  collectif_colere: { mener: 'cortege_paris' },
  marche_noel: { y_aller: 'marche_prenoms' },
  krach: { calme: 'allocution' },
  ia_discours: { avouer: 'conference_presse' },
  clash_direct: { calme: 'interview_piege' },
  amphi: { dialoguer: 'eloquence' },
  expert_conteste: { debattre: 'factcheck_direct' },
  canular: { rire: 'matinale' },
  rev_barricades: { balcon: 'allocution' },
  rev_jeu_de_paume: { recevoir: 'negociation_alliance' },
  rev_greve_insurrectionnelle: { negocier: 'negociation_syndicale' },
  i_taxes: { negocier: 'interprete' },
  i_otages: { negocier: 'negociation_alliance' },
  i_delegation: { accueillir: 'protocole' },
  gifle: { continuer: 'bain_de_foule' },
  debat_annule: { chaise: 'eloquence' },
  fermeture_maternite: { negocier: 'negociation_syndicale' },
  association_elus: { negocier: 'negociation_alliance' },
  ami_disparu: { eloge: 'plume_discours' },
  malaise_meeting: { finir: 'discours' },
  ia_candidate_gate: { debattre: 'factcheck_direct' },
  greve_gate: { negocier: 'negociation_syndicale' },
  jo_greve: { negocier: 'negociation_syndicale' },
  jo_budget: { couper: 'coup_de_rabot' },
  di_parachute: { debat: 'eloquence' },
  ag_salon: { y_aller: 'bain_de_foule' },
  napoleon_debat: { accepter: 'eloquence' },
  sosie_interview: { face: 'interview_piege' },
  referendum_debat: { chiffres: 'factcheck_direct' },
  referendum_fake: { dementir: 'factcheck_direct' },
  expo_greve: { negocier: 'negociation_syndicale' },
  barrage_rumeur: { dementir: 'conference_presse' },
  interview_vedette: { y_aller: 'matinale' },
  sommet_crise_nuit: { y_aller: 'sommet_ue' },
  chef_etat_invite: { recevoir: 'visite_etat' },
  ev_pluie_meeting: { continuer: 'discours' },
  ev_sommet_climat: { ceder: 'sommet_climat' },
  ev_profs_rythmes: { ecouter: 'negociation_syndicale' },
  ev_greve_eboueurs: { negocier: 'negociation_syndicale' },
  min_debat: { debattre: 'eloquence' },
  min_bercy: { accepter: 'coup_de_rabot' },
  c_budget_ville: { amender: 'arbitrage_budgetaire' },
  d_niche: { debat: 'eloquence' },
  pm_greve: { negocier: 'negociation_syndicale' },
  cp_contestation: { congres: 'discours' },
  gj_fronde_tribune: { repondre: 'plume_discours' },
  roy_visite_etat: { croquet: 'protocole' },
  seg_retraites: { repondre: 'courrier' },
  al_emissaire_village: { accompagner: 'bain_de_foule' },
};

/** Le mini-jeu que lance ce choix (s'il en lance un) */
export function choiceGame(decision: Pick<Decision, 'tag'>, choice: DecisionChoice): MinigameDef | null {
  if (choice.effects.some(e => e.kind === 'minigame')) return null;
  // Les événements reçoivent le préfixe « ev_ » à leur création
  const table = DECISION_GAMES[decision.tag] ?? DECISION_GAMES[decision.tag.replace(/^ev_/, '')];
  const id = choice.play ?? table?.[choice.id];
  return id ? MINIGAMES_BY_ID.get(id) ?? null : null;
}

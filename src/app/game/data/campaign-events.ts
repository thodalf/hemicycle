import { Effect, GameState } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';
import { monthIndex } from '../engine/calendar';

/* ============================================================
 *  Événements de campagne présidentielle (pré-campagne incluse)
 *  et nouveaux événements de la vie politique ordinaire.
 * ============================================================ */

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat, delta });
const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice =>
  ({ id, label, effects, outcome, ...extra });
const play = (gameId: string, title: string, reward: Effect[], penalty?: Effect[]): Effect =>
  ({ kind: 'minigame', gameId, title, reward, ...(penalty ? { penalty } : {}) });
const mom = (delta: number): Effect => ({ kind: 'momentum', delta });

/** Dans la course à l'Élysée : candidature déclarée ou campagne officielle */
export function inPresidentialRace(d: GameState): boolean {
  return d.presidential.declared || d.elections.some(e => !e.resolved && e.type === 'presidentielle');
}
const inCampaign = (d: GameState) => d.player.finances.legalCeiling !== null;

export const CAMPAIGN_EVENTS: RandomEvent[] = [
  {
    tag: 'sondage_assassin', weight: 1, eligible: inPresidentialRace,
    build: () => ({
      title: 'Le sondage qui vous enterre',
      context: 'Un institut vous donne à six points, loin derrière. Les éditorialistes parlent déjà de « candidature de témoignage ».',
      choices: [
        c('methode', 'Contester la méthode du sondage', [s('credibility', -1), mom(2)], 'Les sondeurs défendent leur échantillon. Vos militants, eux, y croient encore.'),
        c('redoubler', 'Redoubler d’efforts sur le terrain', [mom(5), s('energy', -12), s('stress', 4)], 'Trois départements en deux jours. « La seule enquête qui compte, c’est le vote. »'),
        c('ignorer', 'Ne pas commenter', [s('stress', 2)], 'Vous laissez passer l’orage.'),
      ],
    }),
  },
  {
    tag: 'fuite_mails', weight: 0.7, eligible: inPresidentialRace,
    build: () => ({
      title: 'Vos mails de campagne piratés et publiés',
      context: 'Vingt mille courriels de votre équipe sont mis en ligne à deux jours d’un grand meeting. Au milieu, des faux grossiers… et quelques vrais embarrassants.',
      choices: [
        c('transparence', 'Tout assumer et dénoncer l’ingérence', [s('credibility', 3), mom(2), s('stress', 5)], 'Vous pointez les faux un par un. L’opinion se retourne contre les pirates.'),
        c('juridique', 'Saisir la justice et l’ANSSI', [{ kind: 'dossier', domain: 'numerique', delta: 3 }, s('credibility', 1)], 'Enquête ouverte. Le sujet s’essouffle.'),
        c('contre_feu', 'Allumer un contre-feu médiatique', [s('popularity', 1), mom(2)], 'Une annonce choc pour changer de sujet.',
          { risk: { baseChance: 0.35, onFailure: [s('credibility', -4), { kind: 'exposure', delta: 6 }], failureNews: 'La ficelle est trop grosse : on ne parle plus que de ce que vous cachez.' } }),
      ],
    }),
  },
  {
    tag: 'adoubement', weight: 0.6, eligible: d => inPresidentialRace(d) && !d.presidency,
    build: d => ({
      title: 'L’ancien président sort de sa réserve',
      context: `${d.presidential.incumbentName.charAt(0).toUpperCase()}${d.presidential.incumbentName.slice(1)} accepte de vous recevoir. Un soutien de sa part pèserait, mais il traîne son bilan.`,
      choices: [
        c('soutien', 'Solliciter un soutien public', [s('influence', 4), mom(3), s('credibility', -1), { kind: 'faction', factionId: 'reformistes', delta: -3 }], 'Photo sur le perron. Les anciens électeurs du sortant suivent… pas les autres.'),
        c('conseils', 'Prendre ses conseils, en privé', [s('credibility', 2)], 'Deux heures d’échange. Il connaît chaque piège de la campagne.'),
        c('rupture', 'Afficher votre rupture avec son bilan', [s('popularity', 3), mom(2), s('influence', -2)], '« Je ne suis l’héritier·e de personne. » La formule fait mouche.'),
      ],
    }),
  },
  {
    tag: 'gifle', weight: 0.6, eligible: inCampaign,
    build: () => ({
      title: 'Une gifle lors d’un bain de foule',
      context: 'Un homme vous gifle au milieu d’une poignée de mains. La scène est filmée sous tous les angles.',
      choices: [
        c('continuer', 'Continuer le bain de foule, imperturbable', [s('popularity', 4), s('credibility', 2), s('stress', 6)], 'Sang-froid salué. La séquence tourne en boucle, en votre faveur.'),
        c('plainte', 'Porter plainte', [s('popularity', 1), s('stress', 3)], 'Comparution immédiate. L’affaire se dégonfle vite.'),
        c('pardon', 'Lui serrer la main et discuter', [s('popularity', 3), mom(3), s('stress', 4)], '« Vous m’avez entendu ? Alors parlons. » Dix minutes d’échange devant les caméras.',
          { risk: { baseChance: 0.25, onFailure: [s('popularity', -2)], failureNews: 'Il en profite pour vous insulter en direct.' } }),
      ],
    }),
  },
  {
    tag: 'comptes_campagne', weight: 0.6, eligible: inCampaign,
    build: () => ({
      title: 'Des factures de meeting posent question',
      context: 'Un prestataire aurait sous-facturé vos meetings. La Commission des comptes de campagne pourrait réintégrer la différence.',
      choices: [
        c('regulariser', 'Régulariser tout de suite', [{ kind: 'funds', account: 'campaign', delta: -12000 }, s('credibility', 2)], 'Douze mille euros de plus au compte de campagne. La polémique s’éteint.'),
        c('justifier', 'Justifier : « Tarif militant »', [s('stress', 3)], 'Vous fournissez des devis.',
          { risk: { baseChance: 0.4, onFailure: [{ kind: 'exposure', delta: 10 }, s('credibility', -4), { kind: 'flag', key: 'depassement', value: true }], failureNews: 'La Commission réintègre 80 000 €. Le plafond est dépassé.' } }),
      ],
    }),
  },
  {
    tag: 'soutien_star', weight: 0.6, eligible: inPresidentialRace,
    build: (_d, rng) => {
      const star = rng.pick(['Une actrice césarisée', 'Un rappeur multi-platine', 'Un ancien champion du monde de football', 'Une humoriste star de la télé']);
      return {
        title: `${star} appelle à voter pour vous`,
        context: 'Une vidéo sur les réseaux, trois millions de vues. Votre équipe vous demande s’il faut l’inviter au prochain meeting.',
        choices: [
          c('meeting', 'L’inviter sur scène', [s('popularity', 4), mom(6), s('credibility', -1)], 'La salle hurle. Les jeunes, enfin, s’intéressent à la campagne.'),
          c('merci', 'Remercier sobrement', [s('popularity', 2), mom(2)], 'Un tweet de remerciement, rien de plus.'),
        ],
      };
    },
  },
  {
    tag: 'hologramme', weight: 0.5, eligible: inCampaign,
    build: () => ({
      title: 'Un meeting dans six villes à la fois',
      context: 'Votre équipe numérique propose un meeting en hologramme, retransmis simultanément dans six salles.',
      choices: [
        c('oser', 'Oser l’hologramme', [{ kind: 'funds', account: 'campaign', delta: -15000 }, mom(9), s('popularity', 2)], 'Effet garanti : on ne parle que de ça.',
          { risk: { baseChance: 0.25, onFailure: [mom(-6), s('popularity', -2)], failureNews: 'Bug à Toulouse : votre hologramme se fige, bouche ouverte. Les mèmes pleuvent.' } }),
        c('classique', 'Rester sur un meeting classique', [mom(3), s('energy', -8)], 'Une salle comble, à l’ancienne.'),
      ],
    }),
  },
  {
    tag: 'trou_programme', weight: 0.7, eligible: d => inPresidentialRace(d) && !!d.program?.validated,
    build: () => ({
      title: '« Un trou de vingt milliards dans votre programme »',
      context: 'Un économiste reconnu affirme sur toutes les chaînes que votre programme n’est pas financé.',
      choices: [
        c('chiffrer', 'Publier un chiffrage détaillé', [play('fiches', 'Défendre votre chiffrage', [s('credibility', 5), mom(3)], [s('credibility', -3)])], 'Tableurs, hypothèses, sources : à vous de convaincre.'),
        c('attaquer', 'Dénoncer « l’économiste du système »', [s('popularity', 1), s('credibility', -3), mom(2)], 'Vos partisans applaudissent. Les autres doutent.'),
        c('ajuster', 'Raboter deux mesures coûteuses', [s('credibility', 3), { kind: 'faction', factionId: 'ligne_dure', delta: -3 }], 'Programme plus sérieux, militants plus tièdes.'),
      ],
    }),
  },
  {
    tag: 'debat_annule', weight: 0.5, eligible: d => d.elections.some(e => !e.resolved && e.type === 'presidentielle'),
    build: () => ({
      title: 'Un candidat refuse le débat à onze',
      context: 'Le favori refuse de participer au grand débat télévisé du premier tour. Les chaînes hésitent à le maintenir.',
      choices: [
        c('chaise', 'Débattre face à une chaise vide', [s('popularity', 3), mom(4), s('credibility', 1)], 'Le symbole frappe les esprits.'),
        c('boycott', 'Boycotter à votre tour', [s('credibility', -2)], 'Le débat est annulé. Personne n’y gagne.'),
      ],
    }),
  },
];

/** Nouveaux événements de la vie politique ordinaire */
export const MORE_EVENTS: RandomEvent[] = [
  {
    tag: 'penurie_carburant', weight: 0.6, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Pénurie de carburant',
      context: 'Raffineries en grève, stations à sec, files de voitures sur deux kilomètres. Les infirmières libérales ne peuvent plus faire leurs tournées.',
      choices: [
        c('prioritaires', 'Réserver des stations aux soignants et aux artisans', [s('popularity', 3), { kind: 'contact', contactId: 'ct-soignants', trust: 3 }, s('energy', -6)], 'Une liste, des macarons, et des gendarmes devant les pompes.'),
        c('covoiturage', 'Lancer un plan de covoiturage d’urgence', [{ kind: 'dossier', domain: 'territoires', delta: 3 }, s('credibility', 2)], 'Une plateforme montée en 48 heures.'),
        c('attendre', 'Attendre la fin de la grève', [s('popularity', -3)], 'Elle dure encore dix jours.'),
      ],
    }),
  },
  {
    tag: 'greve_eboueurs', weight: 0.6, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Grève des éboueurs',
      context: 'Dix jours de grève, des tonnes de déchets sur les trottoirs, et les rats qui sortent la nuit.',
      choices: [
        c('mediation', 'Proposer une médiation', [play('negociation_syndicale', 'Médiation avec les grévistes', [s('credibility', 4), { kind: 'contact', contactId: 'ct-ust', trust: 4 }, s('popularity', 2)])], 'Autour de la table, à vous de trouver l’accord.'),
        c('requisition', 'Réclamer des réquisitions', [s('popularity', 1), { kind: 'contact', contactId: 'ct-ust', trust: -6 }, { kind: 'stance', delta: 3 }], 'Les camions repassent. Les syndicats s’en souviendront.'),
        c('soutien', 'Soutenir les grévistes', [{ kind: 'contact', contactId: 'ct-ust', trust: 6 }, s('popularity', -2), { kind: 'stance', delta: -3 }], 'Les riverains, eux, comptent les sacs.'),
      ],
    }),
  },
  {
    tag: 'live_influenceur', weight: 0.8,
    build: () => ({
      title: 'Un influenceur vous invite en live',
      context: 'Quatre millions d’abonnés, beaucoup de moins de 25 ans, et des questions qui ne passent jamais à la télé.',
      choices: [
        c('jouer', 'Accepter le live', [play('matinale', 'Le live sans filet', [s('popularity', 5), s('influence', 1)], [s('popularity', -3)])], 'Deux heures, un canapé, des questions sur le prix des kebabs.'),
        c('decliner', 'Décliner poliment', [], 'Il invite votre rival à la place.'),
      ],
    }),
  },
  {
    tag: 'lanceur_alerte', weight: 0.5, minRank: 'depute',
    build: () => ({
      title: 'Un lanceur d’alerte frappe à votre porte',
      context: 'Un cadre d’une grande entreprise vous apporte des documents : un produit dangereux aurait été maquillé.',
      choices: [
        c('saisir', 'Saisir la justice et protéger la source', [s('credibility', 5), { kind: 'dossier', domain: 'justice', delta: 3 }, s('stress', 4)], 'L’affaire éclate trois mois plus tard. Votre nom y est associé, en bien.'),
        c('commission', 'Réclamer une commission d’enquête', [s('influence', 3), s('popularity', 3), s('politicalCapital', -10)], 'Auditions publiques, révélations en série.'),
        c('ignorer', 'Ne pas s’en mêler', [s('stress', -1)], 'Il ira voir quelqu’un d’autre.',
          { risk: { baseChance: 0.3, onFailure: [s('credibility', -5)], failureNews: 'Il raconte publiquement que vous l’avez éconduit.' } }),
      ],
    }),
  },
  {
    tag: 'antenne_relais', weight: 0.6, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Une antenne-relais divise le quartier',
      context: 'Un opérateur veut installer une antenne 5G près d’une école. Pétition, réunion houleuse, et des parents très remontés.',
      choices: [
        c('reunion', 'Animer la réunion publique', [play('consultation', 'Réunion publique houleuse', [s('popularity', 3), s('credibility', 2)], [s('popularity', -2)])], 'Deux cents personnes, un micro, et des questions sur les ondes.'),
        c('deplacer', 'Obtenir son déplacement de 500 mètres', [s('popularity', 2), { kind: 'dossier', domain: 'numerique', delta: 2 }, s('politicalCapital', -6)], 'L’opérateur accepte, à contrecœur.'),
        c('science', 'S’en tenir aux avis scientifiques', [s('credibility', 3), s('popularity', -2)], 'Rigoureux. Pas très populaire.'),
      ],
    }),
  },
  {
    tag: 'trajet_voiture', weight: 0.6, minRank: 'depute',
    build: () => ({
      title: 'Trois cents mètres en voiture officielle',
      context: 'Un photographe vous surprend en voiture avec chauffeur… pour traverser une rue. Le jour de la journée sans voiture.',
      choices: [
        c('rire', 'En rire et promettre le vélo', [s('popularity', 1), { kind: 'dossier', domain: 'ecologie', delta: 1 }], 'Autodérision appréciée. On vous attend au tournant à vélo.'),
        c('justifier', 'Invoquer la sécurité', [s('popularity', -2), s('credibility', -1)], 'Peu convaincant.'),
        c('velo', 'Venir à vélo toute la semaine', [s('popularity', 3), s('energy', -10), { kind: 'health', delta: 1 }], 'Les photos à vélo remplacent la photo en voiture.'),
      ],
    }),
  },
  {
    tag: 'fermeture_maternite', weight: 0.6, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'La maternité va fermer',
      context: 'L’Agence régionale de santé annonce la fermeture de la maternité. La plus proche sera à cinquante minutes.',
      choices: [
        c('manif', 'Prendre la tête de la mobilisation', [s('popularity', 4), { kind: 'contact', contactId: 'ct-soignants', trust: 4 }, s('energy', -10)], 'Chaîne humaine autour de l’hôpital. Les caméras sont là.'),
        c('negocier', 'Négocier un centre périnatal', [{ kind: 'dossier', domain: 'sante', delta: 4 }, s('credibility', 3)], 'Pas de maternité, mais des consultations et des urgences.'),
        c('accepter', 'Accepter au nom de la sécurité', [s('popularity', -4), s('credibility', 1)], 'Les arguments sont solides. La colère aussi.'),
      ],
    }),
  },
  {
    tag: 'cocktail_carnet', weight: 0.7, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Le cocktail de l’ambassade',
      context: 'Petits fours, diplomates, et une bonne moitié du personnel politique qui compte. Les cartes de visite circulent.',
      choices: [
        c('tournee', 'Faire le tour de la salle', [{ kind: 'phoneBook', npcId: '$any' }, { kind: 'phoneBook', npcId: '$any' }, s('influence', 2), s('energy', -6)], 'Vous repartez avec des numéros griffonnés sur des serviettes.'),
        c('coin', 'Rester avec vos proches', [s('stress', -2)], 'Une soirée agréable, sans plus.'),
      ],
    }),
  },
  {
    tag: 'dialogue_cultes', weight: 0.6, minRank: 'conseiller_municipal',
    build: () => ({
      title: 'Une rencontre entre les cultes',
      context: 'Les représentants des communautés religieuses et le Cercle humaniste organisent une soirée de dialogue. On vous invite à prendre la parole.',
      choices: [
        c('parler', 'Parler de laïcité et de concorde', [s('credibility', 3), { kind: 'contact', contactId: 'ct-humanistes', trust: 3 }, { kind: 'contact', contactId: 'ct-concorde', trust: 2 }, { kind: 'contact', contactId: 'ct-aube', trust: 2 }], 'Un discours salué par toutes les communautés présentes.'),
        c('ecouter', 'Écouter, sans prendre parti', [{ kind: 'contact', contactId: 'ct-veilleurs', trust: 2 }, { kind: 'contact', contactId: 'ct-sources', trust: 2 }, s('stress', -1)], 'Vous prenez des notes. On vous trouve à l’écoute.'),
        c('decliner', 'Décliner : la politique doit rester à distance', [{ kind: 'contact', contactId: 'ct-humanistes', trust: 3 }, { kind: 'contact', contactId: 'ct-concorde', trust: -2 }], 'Une position nette, diversement appréciée.'),
      ],
    }),
  },
];

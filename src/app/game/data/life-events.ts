import { Effect } from '../models/game.models';
import type { EvChoice, RandomEvent } from './random-events';
import { PARRAINAGES_REQUIRED, rankOrder } from './ranks';

/* ============================================================
 *  Événements de la vie : âge, santé, menaces, course à
 *  l'Élysée, vie d'ancien·ne président·e.
 * ============================================================ */

const s = (stat: 'popularity' | 'influence' | 'credibility' | 'politicalCapital' | 'stress' | 'energy', delta: number): Effect =>
  ({ kind: 'stat', stat, delta });
const h = (delta: number): Effect => ({ kind: 'health', delta });
const c = (id: string, label: string, effects: Effect[], outcome: string, extra: Partial<EvChoice> = {}): EvChoice =>
  ({ id, label, effects, outcome, ...extra });

export const LIFE_EVENTS: RandomEvent[] = [
  // ── Âge et santé ─────────────────────────────────────────
  {
    tag: 'malaise_meeting', weight: 1,
    eligible: d => d.player.age >= 50 || d.player.health < 60,
    build: () => ({
      title: 'Malaise en plein meeting',
      context: 'La salle tangue, les projecteurs brûlent. Vous vous agrippez au pupitre. Mille paires d’yeux vous regardent.',
      choices: [
        c('finir', 'Finir le discours coûte que coûte', [s('popularity', 3), h(-6), s('stress', 5)], 'Ovation debout. Vous vous effondrez en coulisses.'),
        c('asseoir', 'S’asseoir et plaisanter avec la salle', [s('popularity', 1), h(-2), s('credibility', -1)], '« Je vous rassure, je ne suis pas encore mort·e ! » La salle rit.'),
        c('hopital', 'Interrompre et filer aux urgences', [h(6), s('influence', -2), s('popularity', -2)], 'Simple malaise vagal. Les chaînes d’info ont tourné en boucle.'),
      ],
    }),
  },
  {
    tag: 'rumeur_sante', weight: 0.8,
    eligible: d => !d.presidency && (d.player.health < 55 || d.player.age >= 65) && rankOrder(d.player.rankId) >= rankOrder('depute'),
    build: d => ({
      title: 'Rumeurs sur votre santé',
      context: `Un site d’information affirme que ${d.player.name} « cache une maladie grave ». Le démenti est attendu.`,
      choices: [
        c('certificat', 'Publier un certificat médical', [s('credibility', d.player.health >= 50 ? 3 : -3), s('stress', 3)], d.player.health >= 50 ? 'Le certificat éteint la rumeur.' : 'Le certificat, trop vague, relance les spéculations.'),
        c('plainte', 'Porter plainte pour diffamation', [s('popularity', -1), s('stress', 5), { kind: 'funds', account: 'personal', delta: -2000 }], 'La procédure durera deux ans.', { needMoney: 2000 }),
        c('assumer', 'Reconnaître des soucis et rassurer', [s('popularity', 3), s('influence', -3), { kind: 'flagAdd', key: 'hygiene', delta: 2 }], 'Votre franchise touche. Vos rivaux, eux, comptent les mois.'),
      ],
    }),
  },
  {
    tag: 'medecin_alerte', weight: 1,
    eligible: d => d.player.stats.stress >= 65,
    build: () => ({
      title: 'Votre médecin vous met en garde',
      context: 'Tension à 17, sommeil haché, café par litres. « Vous jouez avec votre cœur. »',
      choices: [
        c('lever', 'Lever le pied, vraiment', [s('stress', -15), s('influence', -2), { kind: 'momentum', delta: -3 }, { kind: 'flagAdd', key: 'hygiene', delta: 3 }], 'Deux soirées libres par semaine. Une révolution.'),
        c('cachets', 'Prendre des anxiolytiques et continuer', [s('stress', -10), h(-3), s('energy', -5)], 'Ça tient. Pour l’instant.'),
        c('ignorer', 'Ignorer : on dormira plus tard', [h(-5), s('energy', 4)], 'Vous changez de médecin.'),
      ],
    }),
  },
  {
    tag: 'jeunisme', weight: 0.8,
    eligible: d => d.player.age >= 66,
    build: d => ({
      title: '« Trop vieux pour gouverner ? »',
      context: `Un sondage : 58 % des Français jugent ${d.player.name} « trop âgé·e » pour exercer de hautes fonctions.`,
      choices: [
        c('sport', 'Se montrer à vélo sur un col de montagne', [s('popularity', 3), h(-4), s('energy', -10)], 'Photos héroïques, genoux en compote.',
          { risk: { baseChance: 0.2, onFailure: [h(-12), s('popularity', -2)], failureNews: 'Chute dans la descente : clavicule cassée, images cruelles.' } }),
        c('humour', 'Répondre par l’humour', [s('popularity', 2), s('credibility', -1)], '« Je n’exploiterai pas, à des fins politiques, la jeunesse et l’inexpérience de mes adversaires. »'),
        c('relais', 'Annoncer qu’on prépare la relève', [s('credibility', 3), s('influence', -4), { kind: 'cohesion', delta: 3 }], 'Le parti respire. Les dauphins s’agitent.'),
      ],
    }),
  },
  {
    tag: 'petit_enfant', weight: 0.6,
    eligible: d => d.player.age >= 50,
    build: () => ({
      title: 'Naissance d’un petit-enfant',
      context: 'Votre fille vous envoie la photo à 4 h du matin. Vous êtes grand-parent.',
      choices: [
        c('conge', 'Annuler deux jours d’agenda pour la rencontrer', [s('stress', -12), s('energy', 8), s('influence', -2), h(2)], 'Un petit bout de bonheur loin de la politique.'),
        c('photo', 'Poster la photo sur les réseaux', [s('popularity', 3), s('credibility', -1), { kind: 'exposure', delta: 2 }], 'Des milliers de cœurs. Votre fille, elle, n’apprécie pas.'),
        c('plus_tard', 'Promettre de passer le mois prochain', [s('stress', 3), s('politicalCapital', 3)], 'Elle soupire au téléphone.'),
      ],
    }),
  },
  {
    tag: 'ami_disparu', weight: 0.6,
    eligible: d => d.player.age >= 55,
    build: d => ({
      title: 'Un vieux compagnon de route disparaît',
      context: `Celui qui vous a fait adhérer ${d.party.founder ? 'à la politique' : 'au parti'}, il y a des décennies, est mort cette nuit. Sa famille vous demande de prononcer l’éloge funèbre.`,
      choices: [
        c('eloge', 'Prononcer un éloge bouleversant', [s('credibility', 3), s('popularity', 2), s('stress', 6), { kind: 'faction', factionId: '*', delta: 2 }], 'L’église est pleine. Votre voix se brise.'),
        c('sobre', 'Quelques mots sobres', [s('credibility', 1), s('stress', 3)], 'Digne, sans plus.'),
        c('excuser', 'S’excuser : agenda impossible', [s('credibility', -3), { kind: 'cohesion', delta: -2 }, s('stress', 2)], 'On vous en voudra longtemps.'),
      ],
    }),
  },
  {
    tag: 'heritage', weight: 0.5,
    eligible: d => d.player.age >= 40,
    build: () => ({
      title: 'Un héritage inattendu',
      context: 'Une grand-tante que vous aviez à peine connue vous lègue 60 000 € et une maison délabrée en Creuse.',
      choices: [
        c('accepter', 'Accepter l’héritage', [{ kind: 'funds', account: 'personal', delta: 60000 }, { kind: 'exposure', delta: 4 }], 'Le fisc et la presse locale s’y intéressent.'),
        c('donner', 'Léguer la maison à la commune', [{ kind: 'funds', account: 'personal', delta: 35000 }, s('popularity', 3)], 'Elle deviendra une maison des associations.'),
        c('renoncer', 'Renoncer à la succession', [s('credibility', 1)], 'Les cousins se partagent tout.'),
      ],
    }),
  },
  {
    tag: 'defi_sportif', weight: 0.6,
    eligible: d => d.player.age < 55,
    build: () => ({
      title: 'Le défi du marathon',
      context: 'Une association caritative vous propose de courir le marathon de Paris sous ses couleurs.',
      choices: [
        c('courir', 'Relever le défi', [s('popularity', 3), { kind: 'flagAdd', key: 'hygiene', delta: 4 }, s('energy', -20)], 'Quatre heures et douze minutes. Vous finissez en larmes.',
          { risk: { baseChance: 0.15, onFailure: [h(-10), s('popularity', 1)], failureNews: 'Malaise au 32e kilomètre : vous finissez en ambulance.' } }),
        c('relais', 'Courir un relais symbolique', [s('popularity', 1), { kind: 'flagAdd', key: 'hygiene', delta: 1 }, s('energy', -5)], 'Cinq kilomètres, sourire aux lèvres.'),
        c('don', 'Faire un don plutôt (1 000 €)', [{ kind: 'funds', account: 'personal', delta: -1000 }, s('credibility', 1)], 'Discret et utile.', { needMoney: 1000 }),
      ],
    }),
  },

  // ── Menaces ──────────────────────────────────────────────
  {
    tag: 'menace_mort', weight: 1,
    eligible: d => !d.presidency && (rankOrder(d.player.rankId) >= rankOrder('depute') || d.player.stats.popularity >= 40),
    build: () => ({
      title: 'Menaces de mort',
      context: 'Une lettre, une balle dans l’enveloppe. « La prochaine sera pour toi. »',
      choices: [
        c('plainte', 'Porter plainte et demander une protection', [{ kind: 'flagAdd', key: 'protection', delta: 40 }, { kind: 'flagAdd', key: 'menace', delta: 10 }, s('stress', 8)], 'Deux policiers vous accompagnent désormais.'),
        c('public', 'Rendre la menace publique', [s('popularity', 3), s('credibility', 1), { kind: 'flagAdd', key: 'menace', delta: 18 }, s('stress', 6)], 'Une vague de soutien… et quelques imitateurs.'),
        c('ignorer', 'Ne pas y prêter attention', [{ kind: 'flagAdd', key: 'menace', delta: 25 }, s('stress', 3)], 'Ce n’est sans doute rien. Sans doute.'),
      ],
    }),
  },
  {
    tag: 'agression_marche', weight: 0.8,
    eligible: d => !d.presidency && rankOrder(d.player.rankId) >= rankOrder('conseiller_municipal'),
    build: () => ({
      title: 'Agressé·e sur un marché',
      context: 'Un homme vous bouscule violemment entre deux étals. Vous voilà au sol, l’arcade ouverte, les téléphones braqués sur vous.',
      choices: [
        c('relever', 'Se relever et continuer le tractage', [s('popularity', 4), h(-6), s('stress', 8)], 'Pansement sur l’arcade, sourire aux lèvres : l’image fait le tour du pays.'),
        c('plainte', 'Porter plainte, appeler au calme', [s('credibility', 3), h(-4), s('stress', 5), { kind: 'flagAdd', key: 'protection', delta: 15 }], 'Votre retenue est saluée.'),
        c('denoncer', 'Accuser le climat entretenu par vos adversaires', [s('popularity', 2), s('credibility', -2), h(-4), { kind: 'flagAdd', key: 'menace', delta: 8 }], 'Le débat s’envenime.'),
      ],
    }),
  },
  {
    tag: 'colis_piege', weight: 0.5,
    eligible: d => !d.presidency && (rankOrder(d.player.rankId) >= rankOrder('ministre') || Number(d.player.flags['menace'] ?? 0) >= 25),
    build: d => {
      const protection = Number(d.player.flags['protection'] ?? 0);
      const lethal = Math.max(0.01, 0.06 * (1 - protection / 100));
      return {
        title: 'Un colis suspect à votre bureau',
        context: 'Un paquet sans expéditeur, un fil qui dépasse. Votre assistante vous appelle, la voix blanche.',
        choices: [
          c('demineurs', 'Évacuer et appeler les démineurs', [s('stress', 8), { kind: 'flagAdd', key: 'protection', delta: 20 }, s('popularity', 1)], 'Une charge artisanale, neutralisée. On ne plaisante plus avec votre sécurité.'),
          c('ouvrir', 'Ouvrir soi-même : c’est sûrement une blague', [s('stress', 4), s('credibility', -1)], 'Des tracts et une menace grossière.',
            { risk: { baseChance: lethal, onFailure: [{ kind: 'die', cause: 'assassinat', text: 'Un colis piégé, ouvert dans son bureau. L’enquête remontera jusqu’à un groupuscule.' }], failureNews: 'Le colis explose.' } }),
          c('discret', 'Faire enquêter discrètement', [s('stress', 6), { kind: 'flagAdd', key: 'menace', delta: -10 }, s('politicalCapital', -5)], 'La DGSI identifie l’expéditeur.'),
        ],
      };
    },
  },
  {
    tag: 'chauffeur_fatigue', weight: 0.6,
    eligible: d => !d.presidency && rankOrder(d.player.rankId) >= rankOrder('depute'),
    build: () => ({
      title: 'Votre chauffeur s’endort au volant',
      context: 'Un écart sur l’autoroute à 2 h du matin, un réveil en sursaut. Vous enchaînez trop de déplacements nocturnes.',
      choices: [
        c('rythme', 'Réduire les déplacements de nuit', [s('energy', 6), s('influence', -2), { kind: 'momentum', delta: -2 }], 'Moins de dîners en région. Plus de sommeil pour tout le monde.'),
        c('second', 'Embaucher un second chauffeur (3 000 €)', [{ kind: 'funds', account: 'personal', delta: -3000 }, s('stress', -3)], 'Ils se relaient désormais.', { needMoney: 3000 }),
        c('conduire', 'Prendre le volant vous-même', [s('stress', 4), s('energy', -6)], 'Vous arrivez à l’heure, les yeux rouges.',
          { risk: { baseChance: 0.02, onFailure: [{ kind: 'die', cause: 'accident', text: 'Endormi·e au volant sur l’autoroute, au retour d’un dîner en région.' }], failureNews: 'Sortie de route.' } }),
      ],
    }),
  },

  // ── Course à l'Élysée ────────────────────────────────────
  {
    tag: 'sondage_presidentiel', weight: 1.2,
    eligible: d => !d.presidential.declared && !d.presidency && d.player.stats.popularity >= 30
      && d.presidential.nextWeek - d.week <= 78 && d.presidential.nextWeek - d.week > 12 && !d.player.flags['monarchie'],
    build: d => ({
      title: 'Un sondage vous place en outsider',
      context: `${Math.round(d.player.stats.popularity / 3)} % d’intentions de vote à la présidentielle, sans même être candidat·e. Les journalistes vous harcèlent : « Irez-vous ? »`,
      choices: [
        c('declarer', 'Se déclarer candidat·e dans la foulée', [{ kind: 'declare' }], 'Annonce au 20 h. La campagne commence.'),
        c('doute', 'Laisser planer le doute', [{ kind: 'momentum', delta: 6 }, s('influence', 2), { kind: 'cohesion', delta: -3 }], '« Chaque chose en son temps. » Votre parti s’agace.'),
        c('dementir', 'Démentir : ce n’est pas le moment', [s('credibility', 2), s('influence', -1)], 'Le sondage suivant vous oublie.'),
      ],
    }),
  },
  {
    tag: 'association_elus', weight: 1,
    eligible: d => d.presidential.declared && d.presidential.parrainages < PARRAINAGES_REQUIRED && d.week < d.presidential.nextWeek - 9,
    build: () => ({
      title: 'Une association d’élus hésite à vous parrainer',
      context: 'Cent vingt maires sont prêts à signer… si vous vous engagez sur la dotation des petites communes.',
      choices: [
        c('promettre', 'Promettre la hausse des dotations', [{ kind: 'parrainages', delta: 120 }, s('credibility', -2), { kind: 'stance', delta: -2 }], 'Les formulaires arrivent par la poste.'),
        c('negocier', 'Négocier un engagement plus vague', [{ kind: 'parrainages', delta: 60 }, s('politicalCapital', -6)], 'La moitié signe.'),
        c('refuser', 'Refuser le marchandage', [s('credibility', 2), s('stress', 4)], 'Vous chercherez ailleurs.'),
      ],
    }),
  },
  {
    tag: 'parrains_publics', weight: 0.8,
    eligible: d => d.presidential.declared && d.presidential.parrainages >= 150,
    build: () => ({
      title: 'Pressions sur vos parrains',
      context: 'La liste de vos parrains est publique. Certains maires reçoivent des coups de fil de leur préfet ou de leur parti.',
      choices: [
        c('rassurer', 'Appeler chacun pour les rassurer', [s('energy', -10), s('stress', 4), { kind: 'parrainages', delta: 10 }], 'Une semaine au téléphone. Personne ne lâche.'),
        c('denoncer', 'Dénoncer publiquement les pressions', [s('popularity', 2), { kind: 'parrainages', delta: -30 }], 'Vous gagnez la bataille de l’opinion, pas celle des signatures.'),
        c('laisser', 'Laisser faire', [{ kind: 'parrainages', delta: -60 }, s('stress', 2)], 'Une soixantaine de maires se rétractent.'),
      ],
    }),
  },
  {
    tag: 'consultation_president', weight: 0.6,
    eligible: d => !d.presidency && !!d.presidential.incumbentId && d.presidential.incumbentId !== 'player' && rankOrder(d.player.rankId) >= rankOrder('ministre'),
    build: d => ({
      title: 'L’Élysée vous consulte',
      context: `${d.presidential.incumbentName} vous reçoit en tête-à-tête : « J’ai besoin de votre avis… et peut-être de votre loyauté. »`,
      choices: [
        c('loyal', 'Promettre votre soutien', [s('influence', 4), s('credibility', -1), { kind: 'faction', factionId: 'moderes', delta: 3 }], 'Vous sortez par le perron, sous les flashs.'),
        c('franc', 'Lui dire ses quatre vérités', [s('credibility', 3), s('influence', -2), s('stress', 4)], 'Un silence glacial. Puis : « Merci de votre franchise. »'),
        c('ambition', 'Laisser entendre vos ambitions', [s('influence', 2), { kind: 'momentum', delta: 4 }, { kind: 'exposure', delta: 3 }], 'L’entretien fuite dans la presse le lendemain.'),
      ],
    }),
  },

  // ── Ancien·ne président·e ────────────────────────────────
  {
    tag: 'ex_affaire', weight: 1,
    eligible: d => d.player.rankId === 'ancien_president',
    build: () => ({
      title: 'Une affaire du quinquennat ressurgit',
      context: 'Votre immunité a pris fin. Un juge d’instruction s’intéresse au financement de votre campagne.',
      choices: [
        c('cooperer', 'Coopérer pleinement', [s('credibility', 2), s('stress', 8)], 'Douze heures d’audition. Un non-lieu, deux ans plus tard.',
          { risk: { baseChance: 0.25, onFailure: [s('credibility', -10), s('popularity', -6), { kind: 'exposure', delta: 10 }], failureNews: 'Mis·e en examen. Une première pour un·e ancien·ne chef·fe de l’État… ou presque.' } }),
        c('acharnement', 'Dénoncer un acharnement judiciaire', [s('popularity', 2), s('credibility', -4), { kind: 'exposure', delta: 6 }], 'Vos fidèles serrent les rangs.'),
        c('avocats', 'Mobiliser une armée d’avocats (20 000 €)', [{ kind: 'funds', account: 'personal', delta: -20000 }, s('stress', 3)], 'La procédure s’enlise pour des années.', { needMoney: 20000 }),
      ],
    }),
  },
  {
    tag: 'ex_mediation', weight: 1,
    eligible: d => d.player.rankId === 'ancien_president',
    build: () => ({
      title: 'Une médiation internationale',
      context: 'Deux pays au bord de la guerre vous demandent, à vous, de les aider à négocier.',
      choices: [
        c('accepter', 'Accepter la mission', [s('influence', 5), s('credibility', 4), s('energy', -15), h(-2)], 'Trois semaines de navettes. Un cessez-le-feu, fragile.',
          { risk: { baseChance: 0.35, onFailure: [s('credibility', -3), s('energy', -10)], failureNews: 'La médiation échoue. Vous rentrez fourbu·e.' } }),
        c('conseiller', 'Conseiller à distance', [s('influence', 2), s('energy', -4)], 'Quelques appels discrets.'),
        c('decliner', 'Décliner : place aux actuels dirigeants', [s('credibility', 1)], 'Une sagesse saluée.'),
      ],
    }),
  },
];

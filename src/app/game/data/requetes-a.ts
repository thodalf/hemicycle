import type { ReqCard } from './requetes-types';
import { mem, rankAtLeast, st } from './requetes-types';
import type { GameState } from '../models/game.models';

/* Les cartes des requêtes (voir requetes-types.ts)
 * Lot A : la vie d'un élu local et d'un député (rangs 0 à 2). */

/* ── Rangs ── */
const BAS = (d: GameState) => !rankAtLeast(d, 3);
const MILITANT = (d: GameState) => !rankAtLeast(d, 1);
const ELU = (d: GameState) => rankAtLeast(d, 1) && !rankAtLeast(d, 3);
const DEPUTE = (d: GameState) => rankAtLeast(d, 2) && !rankAtLeast(d, 3);

/* ── Personnages récurrents ── */
const CHLOE = { name: 'Chloé Vasseur', role: 'Votre attachée de presse', icon: '📱' };
const MARCEL = { name: 'Marcel Ferrand', role: 'Doyen de la section, encarté depuis 1971', icon: '🧓' };
const BRIGITTE = { name: 'Brigitte Lemaire-Dutertre', role: 'Maire de Saint-Aubin-les-Prés, commune voisine', icon: '👩‍💼' };
const PINSON = { name: 'Gérard Pinson', role: 'PDG de Pinson Menuiseries (43 salariés)', icon: '🪚' };
const KERBRAT = { name: 'Sandrine Kerbrat', role: 'Journaliste à L’Écho du Canton', icon: '📰' };
const MERE = { name: 'Françoise Delaunay', role: 'Votre mère', icon: '👵' };
const CHAT = { name: 'Monsieur Moustache', role: 'Chat squatteur de la permanence', icon: '🐈' };

export const CARDS_A: ReqCard[] = [
  /* ═════════════ Chaîne 1 : le sanglier (Chloé) ═════════════ */
  {
    id: 'ra_sanglier', ...CHLOE, tu: true, eligible: ELU,
    text: 'La fédération de chasse t’offre une photo avec le sanglier empaillé de l’année. La une de L’Écho du Canton est garantie. Tu poses ?',
    left: {
      label: 'Pas de sanglier pour moi',
      pillars: { peuple: -6, parti: 5 },
      effects: [{ kind: 'segment', segment: 'ruraux', delta: -2 }],
      outcome: 'Les chasseurs boudent. Votre section, elle, respire.',
      remember: { sanglier: 1 }, next: { card: 'ra_sanglier_suite', months: 3 },
    },
    right: {
      label: 'Je prends la pose',
      pillars: { peuple: 6, medias: 6, parti: -6 },
      effects: [{ kind: 'segment', segment: 'ruraux', delta: 2 }],
      outcome: 'Vous, la bête, et un sourire un peu crispé.',
      remember: { sanglier: 2 }, next: { card: 'ra_sanglier_suite', months: 3 },
    },
  },
  {
    id: 'ra_sanglier_suite', ...CHLOE, tu: true, chainOnly: true,
    text: d => mem(d, 'sanglier') === 2
      ? 'Ta photo avec le sanglier est devenue un mème national. Il a désormais plus d’abonnés que toi. On en joue, ou on fait le dos rond ?'
      : 'Tu as refusé le sanglier… et c’est ton adversaire qui a posé avec. Il est en une, il a l’air sympathique. On contre-attaque avec une photo de toi au marché ?',
    left: {
      label: 'On en joue à fond',
      pillars: { medias: 10, parti: -6 },
      effects: [{ kind: 'momentum', delta: 2 }],
      outcome: 'Un compte parodique « Le Sanglier de la République » vous suit désormais partout.',
    },
    right: {
      label: 'Profil bas',
      pillars: { medias: -6, peuple: 4 },
      outcome: 'L’affaire s’éteint comme elle est venue. Presque.',
    },
  },

  /* ═════════════ Chaîne 2 : Marcel, le vieux militant ═════════════ */
  {
    id: 'ra_marcel_affiches', ...MARCEL, tu: true, eligible: BAS,
    text: 'Gamin, la colle est prête et les affiches aussi. Collage sauvage ce soir, comme en 81. Tu viens, ou tu as piscine ?',
    left: {
      label: 'J’enfile mon vieux pull',
      pillars: { parti: 8, puissants: -4, medias: -4 },
      effects: [st('energy', -3)],
      outcome: 'Minuit, un seau de colle, et Marcel qui chante faux.',
      remember: { marcel: 1 }, next: { card: 'ra_marcel_local', months: 4 },
    },
    right: {
      label: 'Pas le temps, Marcel',
      pillars: { parti: -8, puissants: 4 },
      outcome: 'Marcel replie son seau sans un mot. Il s’en souviendra.',
      remember: { marcel: 2 }, next: { card: 'ra_marcel_local', months: 4 },
    },
  },
  {
    id: 'ra_marcel_local', ...MARCEL, tu: true, chainOnly: true,
    text: d => mem(d, 'marcel') === 1
      ? 'La fédé veut vendre le local de la section pour en faire un espace de coworking. Toi qui étais là pour le collage, tu vas me soutenir, hein ?'
      : 'La fédé veut vendre le local de la section. Je sais que tu es pressé·e, mais pour ça, j’aimerais quand même que tu lèves la main.',
    left: {
      label: 'On garde le local',
      pillars: { parti: 8, puissants: -8 },
      effects: [{ kind: 'partyTreasury', delta: -5 }],
      outcome: 'Le local reste. La ronéo de 1974 aussi.',
      remember: { local: 1 }, next: { card: 'ra_marcel_pot', months: 5 },
    },
    right: {
      label: 'Il faut vivre avec son temps',
      pillars: { parti: -6, puissants: 8, medias: 4 },
      effects: [{ kind: 'partyTreasury', delta: 5 }],
      outcome: 'Le local devient « Le Hub Citoyen ». Le café y coûte quatre euros.',
      remember: { local: 2 }, next: { card: 'ra_marcel_pot', months: 5 },
    },
  },
  {
    id: 'ra_marcel_pot', ...MARCEL, tu: true, chainOnly: true,
    text: d => mem(d, 'local') === 1
      ? 'Je prends ma retraite de secrétaire de section. Le pot se fait dans NOTRE local, grâce à toi. Tu me ferais le discours ?'
      : 'Je prends ma retraite de secrétaire de section. Le pot se fait au « Hub Citoyen », entre deux startups. Tu me ferais quand même le discours ?',
    left: {
      label: 'Discours ému, larmes comprises',
      pillars: { parti: 8, medias: -4 },
      effects: [st('stress', -2)],
      outcome: 'Marcel vous offre sa carte d’adhérent de 1971, plastifiée.',
    },
    right: {
      label: 'J’envoie un mot gentil',
      pillars: { parti: -8, puissants: 4 },
      outcome: 'Le mot est lu par un stagiaire. Marcel fait semblant de ne pas être déçu.',
    },
  },

  /* ═════════════ Chaîne 3 : le rond-point (Brigitte) ═════════════ */
  {
    id: 'ra_rondpoint', ...BRIGITTE, eligible: ELU,
    text: 'Mes administrés lancent une pétition contre le futur rond-point de la départementale. Signez avec moi : entre voisins, on se serre les coudes, non ?',
    left: {
      label: 'Je signe',
      pillars: { peuple: 8, puissants: -8 },
      outcome: 'Votre signature en bas d’une pétition de 412 noms.',
      remember: { rondpoint: 1 }, next: { card: 'ra_rondpoint_suite', months: 4 },
    },
    right: {
      label: 'Le rond-point est utile',
      pillars: { peuple: -6, puissants: 6, parti: 4 },
      effects: [{ kind: 'dossier', domain: 'territoires', delta: 2 }],
      remember: { rondpoint: 2 }, next: { card: 'ra_rondpoint_suite', months: 4 },
    },
  },
  {
    id: 'ra_rondpoint_suite', ...BRIGITTE, chainOnly: true,
    text: d => mem(d, 'rondpoint') === 1
      ? 'Victoire : le rond-point est abandonné ! Pour fêter ça, je voudrais que nos deux communes partagent le prochain marché de Noël. Vous en êtes ?'
      : 'Le rond-point est construit, et vous l’aviez défendu. Le Département propose d’y installer une sculpture de 6 mètres. Je vous laisse choisir : la vache en résine ou le « cercle de l’avenir » en inox ?',
    left: {
      label: 'Je dis oui à Brigitte',
      pillars: { peuple: 6, medias: 4, puissants: -4 },
      effects: [{ kind: 'funds', account: 'campaign', delta: -500 }],
      outcome: 'Brigitte vous appelle désormais « mon voisin préféré ».',
    },
    right: {
      label: 'Je reste prudent·e',
      pillars: { peuple: -4, puissants: 6 },
      outcome: 'Brigitte vous range dans la case « tiède ».',
    },
  },

  /* ═════════════ Chaîne 4 : Pinson Menuiseries ═════════════ */
  {
    id: 'ra_pinson_terrain', ...PINSON, eligible: ELU,
    text: 'Je veux agrandir l’usine, mais le terrain est classé zone humide. Un petit coup de pouce au PLU, et je crée vingt emplois. Vous êtes du côté de l’emploi, j’espère ?',
    left: {
      label: 'La zone humide reste',
      pillars: { puissants: -10, peuple: 4, parti: 4 },
      effects: [{ kind: 'dossier', domain: 'ecologie', delta: 2 }],
      outcome: 'Les grenouilles vous remercient. Pinson, beaucoup moins.',
      remember: { pinson: 1 }, next: { card: 'ra_pinson_emplois', months: 4 },
    },
    right: {
      label: 'On trouve un arrangement',
      pillars: { puissants: 10, parti: -6 },
      effects: [{ kind: 'exposure', delta: 2 }],
      outcome: 'Le PLU est modifié « à la marge ». La marge fait deux hectares.',
      remember: { pinson: 2 }, next: { card: 'ra_pinson_emplois', months: 4 },
    },
  },
  {
    id: 'ra_pinson_emplois', ...PINSON, chainOnly: true,
    text: d => mem(d, 'pinson') === 2
      ? 'L’extension est faite, merci encore. Les vingt emplois… disons qu’on en a créé huit, et des intérimaires. Vous viendrez couper le ruban quand même ?'
      : 'Puisque je ne peux pas m’agrandir ici, je délocalise à Saint-Aubin-les-Prés, chez votre voisine. Sauf si vous me trouvez un autre terrain d’ici la fin du mois.',
    left: {
      label: 'Je ne cède pas',
      pillars: { puissants: -8, peuple: 4, medias: 4 },
      remember: { pinson2: 1 }, next: { card: 'ra_pinson_fin', months: 6 },
    },
    right: {
      label: 'Je l’aide encore',
      pillars: { puissants: 8, peuple: -6 },
      effects: [{ kind: 'segment', segment: 'populaires', delta: -1 }],
      remember: { pinson2: 2 }, next: { card: 'ra_pinson_fin', months: 6 },
    },
  },
  {
    id: 'ra_pinson_fin', ...KERBRAT, chainOnly: true,
    text: d => mem(d, 'pinson2') === 2
      ? 'J’enquête sur Pinson Menuiseries et sur les faveurs qu’il a obtenues de la mairie. Votre nom revient souvent. Un commentaire avant publication ?'
      : 'J’écris un portrait sur « l’élu·e qui a dit non à Pinson ». Vous acceptez une séance photo devant la zone humide, bottes aux pieds ?',
    left: {
      label: 'Je joue la transparence',
      pillars: { medias: 10, puissants: -8 },
      effects: [{ kind: 'exposure', delta: -2 }],
      outcome: 'L’article est sévère mais juste. On vous trouve honnête.',
    },
    right: {
      label: 'Pas de commentaire',
      pillars: { medias: -10, puissants: 6 },
      outcome: '« Contacté·e, l’élu·e n’a pas souhaité répondre. » La formule qui tue.',
    },
  },

  /* ═════════════ Chaîne 5 : le off (Kerbrat) ═════════════ */
  {
    id: 'ra_kerbrat_off', ...KERBRAT, eligible: BAS,
    text: 'Entre nous, en off : que pensez-vous vraiment du président de votre fédération ? Promis, rien ne sortira.',
    left: {
      label: 'Je vide mon sac',
      pillars: { medias: 10, parti: -6 },
      remember: { off: 1 }, next: { card: 'ra_kerbrat_article', months: 2 },
    },
    right: {
      label: '« Un homme remarquable. »',
      pillars: { medias: -6, parti: 6 },
      remember: { off: 2 }, next: { card: 'ra_kerbrat_article', months: 2 },
    },
  },
  {
    id: 'ra_kerbrat_article', ...KERBRAT, chainOnly: true,
    text: d => mem(d, 'off') === 1
      ? 'Bon. Votre « off » sur le président de la fédé est cité dans mon papier, « selon un·e élu·e local·e ». Tout le monde a deviné. Vous démentez ?'
      : 'Votre « homme remarquable » m’a tellement fait rire que je l’ai mis en titre. Le président de la fédé l’a encadré. Vous m’accordez un vrai entretien, cette fois ?',
    left: {
      label: 'J’assume tout',
      pillars: { medias: 8, parti: -10 },
      effects: [{ kind: 'cohesion', delta: -2 }],
      outcome: 'La fédé vous boude, la presse locale vous adore.',
    },
    right: {
      label: 'Je démens, je recule',
      pillars: { medias: -8, parti: 8 },
      outcome: 'Kerbrat note votre nom dans son petit carnet. Celui des prudents.',
    },
  },

  /* ═════════════ Chaîne 6 : votre mère ═════════════ */
  {
    id: 'ra_mere_dimanche', ...MERE, tu: true,
    text: 'Ça fait trois dimanches que tu ne viens pas déjeuner. Ta tante dit que tu as « pris la grosse tête ». Tu viens, ou je fais le gigot pour rien ?',
    left: {
      label: 'Je viens, gigot oblige',
      pillars: { peuple: 4, parti: -6 },
      effects: [st('stress', -3), st('energy', 2)],
      outcome: 'Trois heures de déjeuner, deux parts de gâteau, zéro mail lu.',
      remember: { mere: 1 }, next: { card: 'ra_mere_club', months: 3 },
    },
    right: {
      label: 'Désolé·e, réunion de fédé',
      pillars: { parti: 6, peuple: -4 },
      effects: [st('stress', 2)],
      outcome: 'Le gigot est congelé « pour la prochaine fois ».',
      remember: { mere: 2 }, next: { card: 'ra_mere_club', months: 3 },
    },
  },
  {
    id: 'ra_mere_club', ...MERE, tu: true, chainOnly: true,
    text: d => mem(d, 'mere') === 1
      ? 'Mes copines du club de scrabble ont adoré te voir dimanche. Elles veulent que tu viennes leur parler des retraites. Et je leur ai promis que tu apporterais les croissants.'
      : 'Puisque tu n’as jamais le temps, j’ai dit à mes copines du club de scrabble que tu viendrais leur parler des retraites. Tu ne vas pas me faire honte, quand même ?',
    left: {
      label: 'J’y vais, avec croissants',
      pillars: { peuple: 6, medias: -4 },
      effects: [{ kind: 'segment', segment: 'retraites', delta: 2 }],
      outcome: 'Vous perdez au scrabble, mais gagnez douze électrices.',
    },
    right: {
      label: 'Maman, je ne peux pas',
      pillars: { peuple: -6, puissants: 4 },
      outcome: 'Le club de scrabble vote désormais en bloc contre vous.',
    },
  },

  /* ═════════════ Chaîne 7 : Monsieur Moustache ═════════════ */
  {
    id: 'ra_chat', ...CHAT, eligible: ELU,
    text: 'Miaou. (Un chat roux s’est installé sur la chaise de l’accueil de votre permanence. Il refuse de partir et fixe les visiteurs avec mépris.)',
    left: {
      label: 'On l’adopte',
      pillars: { peuple: 4, medias: 4, puissants: -4 },
      effects: [st('stress', -2)],
      outcome: 'Monsieur Moustache est officiellement « chargé de l’accueil ».',
      remember: { chat: 1 }, next: { card: 'ra_chat_mascotte', months: 3 },
    },
    right: {
      label: 'Appeler la SPA',
      pillars: { peuple: -6, puissants: 4 },
      outcome: 'Le chat part… et revient le lendemain par la fenêtre.',
      remember: { chat: 2 }, next: { card: 'ra_chat_mascotte', months: 3 },
    },
  },
  {
    id: 'ra_chat_mascotte', ...CHLOE, tu: true, chainOnly: true,
    text: d => mem(d, 'chat') === 1
      ? 'Le compte Instagram de Monsieur Moustache fait dix fois plus de vues que le tien. Je propose qu’il présente tes vœux cette année. Tu valides ?'
      : 'Le chat que tu as voulu chasser revient tous les jours. Les voisins l’ont baptisé Monsieur Moustache et une pétition circule : « Laissez-le à la permanence ». Tu capitules ?',
    left: {
      label: 'Le chat a gagné',
      pillars: { medias: 10, parti: -6 },
      effects: [{ kind: 'segment', segment: 'jeunes', delta: 2 }],
      remember: { chat2: 1 }, next: { card: 'ra_chat_candidat', months: 6 },
    },
    right: {
      label: 'Un peu de sérieux',
      pillars: { medias: -6, parti: 6 },
      outcome: 'Monsieur Moustache vous tourne le dos. Littéralement.',
    },
  },
  {
    id: 'ra_chat_candidat', ...CHAT, chainOnly: true,
    text: 'Miaou ? (Un sondage farfelu de la radio locale donne Monsieur Moustache à 14 % s’il se présentait contre vous. Il dort sur vos tracts.)',
    left: {
      label: 'Le nommer directeur de cabinet',
      pillars: { medias: 8, peuple: 6, puissants: -8 },
      effects: [{ kind: 'momentum', delta: 2 }],
      outcome: 'Premier chat directeur de cabinet de France. Sa signature : une patte dans l’encre.',
    },
    right: {
      label: 'Le confier à ma mère',
      pillars: { medias: -6, parti: 4 },
      outcome: 'Votre mère l’adore. Il a pris trois kilos.',
    },
  },

  /* ═════════════ Chaîne 8 : la boulangerie ═════════════ */
  {
    id: 'ra_boulangerie', name: 'Josiane Laroque', role: 'Boulangère, rue de la Mairie', icon: '🥖', eligible: BAS,
    text: 'Une chaîne de « boulangeries » industrielles s’installe au rond-point et casse les prix. Moi, je ferme dans trois mois. Vous allez me laisser tomber ?',
    left: {
      label: 'Je mène la fronde',
      pillars: { peuple: 8, puissants: -10 },
      effects: [{ kind: 'segment', segment: 'retraites', delta: 1 }],
      outcome: 'Pétition, banderole, et une photo de vous en farine.',
      remember: { boulangerie: 1 }, next: { card: 'ra_boulangerie_suite', months: 4 },
    },
    right: {
      label: 'C’est le marché, Josiane',
      pillars: { peuple: -8, puissants: 8 },
      remember: { boulangerie: 2 }, next: { card: 'ra_boulangerie_suite', months: 4 },
    },
  },
  {
    id: 'ra_boulangerie_suite', name: 'Josiane Laroque', role: 'Boulangère, rue de la Mairie', icon: '🥖', chainOnly: true,
    text: d => mem(d, 'boulangerie') === 1
      ? 'Grâce à vous, la queue fait le tour du pâté de maisons ! J’ai inventé « la baguette de l’élu·e ». Je peux mettre votre tête sur l’étiquette ?'
      : 'J’ai fermé. Les clients disent que vous n’avez rien fait. Je reprends un camion à pizzas : vous me laissez au moins un emplacement sur la place du marché ?',
    left: {
      label: 'Oui, avec plaisir',
      pillars: { peuple: 8, medias: 4, parti: -4 },
      effects: [st('popularity', 2)],
    },
    right: {
      label: 'Il faut rester neutre',
      pillars: { peuple: -6, puissants: 4 },
    },
  },

  /* ═════════════ Chaîne 9 : le neveu ═════════════ */
  {
    id: 'ra_neveu', name: 'Jean-Pierre Castagnet', role: 'Président de votre fédération départementale', icon: '🎩', eligible: ELU,
    text: 'Mon neveu Kévin cherche un poste de collaborateur. Il est… motivé. Vous me feriez une grande faveur. Et je n’oublie jamais une faveur.',
    left: {
      label: 'J’embauche Kévin',
      pillars: { parti: 10, medias: -6, peuple: -4 },
      effects: [{ kind: 'exposure', delta: 2 }],
      remember: { neveu: 1 }, next: { card: 'ra_neveu_suite', months: 3 },
    },
    right: {
      label: 'Je recrute sur CV',
      pillars: { parti: -10, peuple: 4 },
      remember: { neveu: 2 }, next: { card: 'ra_neveu_suite', months: 5 },
    },
  },
  {
    id: 'ra_neveu_suite', ...CHLOE, tu: true, chainOnly: true,
    text: d => mem(d, 'neveu') === 1
      ? 'Kévin a tweeté depuis ton compte officiel une photo de son plateau-repas. Avec le hashtag #corvée. On le vire ou on éponge ?'
      : 'Castagnet t’a retiré du comité d’investiture pour « manque d’esprit d’équipe ». Coïncidence, sans doute. Tu vas le voir pour arranger les choses ?',
    left: {
      label: 'Je tranche dans le vif',
      pillars: { parti: -8, medias: 6 },
      outcome: 'Castagnet fait savoir qu’il est « très déçu ».',
    },
    right: {
      label: 'J’arrondis les angles',
      pillars: { parti: 8, medias: -6 },
      effects: [st('stress', 2)],
    },
  },

  /* ═════════════ Chaîne 10 : le lobbyiste du tabac ═════════════ */
  {
    id: 'ra_tabac', name: 'Laurent Dessaigne', role: 'Directeur des affaires publiques d’un cigarettier', icon: '🚬', eligible: DEPUTE,
    text: 'Un déjeuner au Bristol, rien de plus. Je voudrais simplement vous présenter nos « données » sur la hausse des taxes. Et notre amendement déjà rédigé.',
    left: {
      label: 'Je n’ai pas faim',
      pillars: { puissants: -10, medias: 4 },
      outcome: 'Il vous envoie quand même l’amendement. En trois couleurs.',
    },
    right: {
      label: 'Juste un café, alors',
      pillars: { puissants: 10, parti: -4 },
      effects: [{ kind: 'exposure', delta: 3 }],
      outcome: 'Le café dure deux heures. L’addition n’arrive jamais.',
      remember: { tabac: 1 }, next: { card: 'ra_tabac_suite', months: 2 },
    },
  },
  {
    id: 'ra_tabac_suite', ...KERBRAT, chainOnly: true,
    text: 'Un photographe vous a vu·e déjeuner avec le lobbyiste du tabac, et votre amendement ressemble mot pour mot à leur note interne. Une explication ?',
    left: {
      label: 'Je retire l’amendement',
      pillars: { medias: 6, puissants: -10, parti: 4 },
      effects: [st('credibility', -2)],
    },
    right: {
      label: '« Simple coïncidence. »',
      pillars: { medias: -12, puissants: 6 },
      effects: [{ kind: 'exposure', delta: 3 }],
      outcome: 'Le « Tabacgate » du canton tient trois jours en une.',
    },
  },

  /* ═════════════ Cartes indépendantes ═════════════ */
  {
    id: 'ra_salle_fetes', name: 'Kévin et Samira Hamelin', role: 'Futurs mariés', icon: '💍', eligible: ELU,
    text: 'On se marie en juin et la salle des fêtes coûte 800 euros. Vous pourriez nous la prêter gratuitement ? On vous invite, bien sûr. Il y aura un DJ.',
    left: {
      label: 'Cadeau de mariage',
      pillars: { peuple: 6, parti: -4, medias: -4 },
      outcome: 'Le DJ vous dédicace « Les Lacs du Connemara ».',
    },
    right: {
      label: 'Le tarif, c’est le tarif',
      pillars: { peuple: -6, medias: 4, parti: 4 },
      outcome: 'Équité républicaine. Mais pas de part de pièce montée.',
    },
  },
  {
    id: 'ra_petanque', name: 'René Bouvier', role: 'Président de La Boule Joyeuse', icon: '🎯', eligible: ELU, repeatAfter: 36,
    text: 'Le club de pétanque a besoin de 3 000 euros pour éclairer le terrain. On a 140 licenciés, et ils votent tous. Je dis ça, je dis rien.',
    left: {
      label: 'Subvention votée',
      pillars: { peuple: 6, medias: -6 },
      effects: [{ kind: 'segment', segment: 'retraites', delta: 2 }],
    },
    right: {
      label: 'Le budget est serré',
      pillars: { peuple: -6, puissants: 4, medias: 4 },
    },
  },
  {
    id: 'ra_influenceur', name: 'Dylan Morvan', role: 'Influenceur local (@DylanCheckTaVille)', icon: '🤳', eligible: BAS,
    text: 'Yo ! Je fais une vidéo « 24 h avec un·e élu·e ». 80 000 abonnés. Seule condition : tu fais le challenge du piment. Deal ?',
    left: {
      label: 'Envoie le piment',
      pillars: { medias: 8, peuple: 4, parti: -10 },
      effects: [{ kind: 'segment', segment: 'jeunes', delta: 2 }, st('energy', -2)],
      outcome: 'Vous pleurez en direct. 400 000 vues.',
    },
    right: {
      label: 'Sans façon',
      pillars: { medias: -6, parti: 4 },
      outcome: 'Dylan publie : « l’élu·e qui a peur d’un piment ». Ça marche aussi.',
    },
  },
  {
    id: 'ra_tractage', name: 'Nadège Fournier', role: 'Secrétaire de votre section', icon: '📋', eligible: MILITANT,
    text: 'Distribution de tracts au marché, dimanche 7 h. On n’est que deux. Et c’est toi qui portes le carton, j’ai mal au dos.',
    tu: true,
    left: {
      label: 'Je porte le carton',
      pillars: { parti: 6, peuple: 4 },
      effects: [st('energy', -3)],
    },
    right: {
      label: 'Dimanche, je dors',
      pillars: { parti: -8, peuple: -4 },
      effects: [st('energy', 2)],
    },
  },
  {
    id: 'ra_eolienne', name: 'Hubert Lagarde', role: 'Agriculteur céréalier', icon: '🚜', eligible: ELU,
    text: 'Un promoteur m’offre un bon loyer pour trois éoliennes sur mes terres. Les voisins hurlent au paysage gâché. Vous me soutenez au conseil ?',
    left: {
      label: 'Oui aux éoliennes',
      pillars: { puissants: 6, peuple: -6, medias: 4 },
      effects: [{ kind: 'dossier', domain: 'ecologie', delta: 2 }],
    },
    right: {
      label: 'Le paysage d’abord',
      pillars: { peuple: 6, puissants: -6 },
      effects: [{ kind: 'segment', segment: 'ruraux', delta: 1 }],
    },
  },
  {
    id: 'ra_cantine', name: 'Aurélie Benamar', role: 'Présidente des parents d’élèves', icon: '🍎', eligible: ELU,
    text: 'Nos enfants mangent des nuggets surgelés venus de loin. On veut une cantine bio et locale. Oui, ça coûte plus cher. Oui, c’est une priorité.',
    left: {
      label: 'Bio et local, voté',
      pillars: { peuple: 8, puissants: -8 },
      effects: [{ kind: 'dossier', domain: 'education', delta: 1 }],
    },
    right: {
      label: 'On garde le prestataire',
      pillars: { peuple: -10, puissants: 8 },
    },
  },
  {
    id: 'ra_permanence_loyer', name: 'Philippe Garnier-Saulx', role: 'Propriétaire de votre permanence', icon: '🔑', eligible: DEPUTE,
    text: 'Je double le loyer de votre permanence. Sauf si vous glissez un mot favorable sur mon dossier de permis de construire en préfecture. Entre gens de bonne compagnie…',
    left: {
      label: 'Je déménage',
      pillars: { puissants: -8, medias: 6 },
      effects: [{ kind: 'funds', account: 'campaign', delta: -1500 }],
      outcome: 'Nouvelle permanence au-dessus d’un kebab. Très fréquentée.',
    },
    right: {
      label: 'Un petit mot, rien de plus',
      pillars: { puissants: 8, medias: -4 },
      effects: [{ kind: 'exposure', delta: 3 }],
    },
  },
  {
    id: 'ra_assureur', name: 'Clémence Aubertin', role: 'Lobbyiste d’une fédération d’assureurs', icon: '💼', eligible: DEPUTE,
    text: 'Notre amendement sur les catastrophes naturelles est clé en main : exposé des motifs, éléments de langage, tout. Il suffit de le déposer sous votre nom.',
    left: {
      label: 'Je l’écris moi-même',
      pillars: { puissants: -8, parti: 4, medias: 4 },
      effects: [st('energy', -2)],
    },
    right: {
      label: 'Je dépose, merci',
      pillars: { puissants: 10, medias: -8 },
      effects: [{ kind: 'exposure', delta: 2 }],
    },
  },
  {
    id: 'ra_pigeon', name: 'Un pigeon voyageur', role: 'Messager à plumes, d’origine inconnue', icon: '🕊️',
    text: 'Le pigeon porte à la patte un message de votre rival : « Trêve jusqu’aux élections ? Réponse par la même voie. » Il attend en picorant votre bureau.',
    left: {
      label: 'Trêve acceptée',
      pillars: { parti: 6, medias: -6 },
      effects: [st('stress', -2)],
      outcome: 'Le pigeon repart, très fier de lui.',
    },
    right: {
      label: 'Renvoyer le pigeon à vide',
      pillars: { parti: -4, medias: 6 },
      effects: [{ kind: 'momentum', delta: 1 }],
      outcome: 'Le pigeon laisse un souvenir sur votre dossier le plus important.',
    },
  },
  {
    id: 'ra_astrologue', name: 'Madame Irma Valdès', role: 'Astrologue, voyante, « coach électorale »', icon: '🔮', repeatAfter: 36,
    text: 'Jupiter entre dans votre maison X : c’est le moment de tout oser. Pour 300 euros, je vous calcule la date idéale de votre prochaine annonce.',
    left: {
      label: 'Payer Madame Irma',
      pillars: { medias: -8, puissants: 4 },
      effects: [{ kind: 'funds', account: 'personal', delta: -300 }, st('stress', -2)],
      outcome: 'Elle vous conseille un mardi. Il pleut ce mardi-là.',
    },
    right: {
      label: 'Je crois aux sondages',
      pillars: { medias: 4, peuple: -4 },
      outcome: 'Madame Irma prédit votre défaite. Sur Facebook.',
    },
  },
  {
    id: 'ra_sosie', name: 'Patrice Mollard', role: 'Votre sosie, animateur de fêtes de village', icon: '🎭', eligible: BAS,
    text: 'On me confond avec vous tout le temps. Je propose de vous remplacer aux inaugurations du samedi. Personne ne verra la différence, et vous dormez.',
    left: {
      label: 'Engagé, discrètement',
      pillars: { peuple: -8, parti: 4 },
      effects: [st('energy', 4), { kind: 'exposure', delta: 2 }],
      outcome: 'Il coupe les rubans mieux que vous.',
    },
    right: {
      label: 'Je reste irremplaçable',
      pillars: { peuple: 6, parti: -4 },
      effects: [st('energy', -2)],
    },
  },
  {
    id: 'ra_fanfare', name: 'Gilles Tardieu', role: 'Chef de la fanfare municipale', icon: '🎺', eligible: ELU,
    tu: true,
    text: 'Pour le 14 Juillet, la fanfare veut un·e élu·e au triangle. C’est symbolique, tu n’as qu’à taper quand je lève le sourcil.',
    left: {
      label: 'Je prends le triangle',
      pillars: { peuple: 6, medias: 4, puissants: -4 },
      outcome: 'Vous ratez le sourcil deux fois. Ovation quand même.',
    },
    right: {
      label: 'Je n’ai aucun rythme',
      pillars: { peuple: -4, puissants: 4 },
    },
  },
  {
    id: 'ra_parking', name: 'Yannick Le Goff', role: 'Président de l’union des commerçants', icon: '🛍️', eligible: ELU,
    text: 'La piste cyclable a supprimé quarante places de parking. Mon chiffre d’affaires a chuté de 15 %. Rendez-nous nos places, ou on baisse les rideaux.',
    left: {
      label: 'Je rends les places',
      pillars: { puissants: 8, peuple: -4, parti: -4 },
      effects: [{ kind: 'dossier', domain: 'ecologie', delta: -1 }],
    },
    right: {
      label: 'La piste reste',
      pillars: { puissants: -8, parti: 6 },
      effects: [{ kind: 'segment', segment: 'jeunes', delta: 1 }],
    },
  },
  {
    id: 'ra_question_gouv', name: 'Arnaud Delcourt', role: 'Whip de votre groupe parlementaire', icon: '📣', eligible: DEPUTE,
    text: 'Mardi, vous posez une question au gouvernement. Le texte est prêt : trois minutes de flatterie sur notre ministre préféré. Pas d’improvisation, hein.',
    left: {
      label: 'Je lis le texte',
      pillars: { parti: 8, medias: -6 },
    },
    right: {
      label: 'Je pose MA question',
      pillars: { parti: -12, medias: 8, peuple: 4 },
      effects: [{ kind: 'momentum', delta: 2 }],
      outcome: 'Votre question sur l’hôpital local fait le tour des réseaux.',
    },
  },
  {
    id: 'ra_vote_conscience', name: 'Arnaud Delcourt', role: 'Whip de votre groupe parlementaire', icon: '📣', eligible: DEPUTE, repeatAfter: 30,
    text: 'Le groupe vote pour la fermeture des petites maternités. Je sais que celle de votre circonscription est concernée. Discipline de vote, quand même.',
    left: {
      label: 'Je vote avec le groupe',
      pillars: { parti: 10, peuple: -12 },
      effects: [{ kind: 'dossier', domain: 'sante', delta: -1 }],
    },
    right: {
      label: 'Je vote contre',
      pillars: { parti: -10, peuple: 10 },
      effects: [{ kind: 'cohesion', delta: -2 }],
    },
  },
  {
    id: 'ra_frais_mandat', name: 'Odile Perrichon', role: 'Votre comptable', icon: '🧮', eligible: DEPUTE,
    text: 'Votre voiture rend l’âme. Techniquement, l’avance de frais de mandat pourrait couvrir un « véhicule de circonscription ». Un SUV, par exemple ?',
    left: {
      label: 'Je garde ma vieille Clio',
      pillars: { peuple: 6, medias: 4, puissants: -4 },
      effects: [st('energy', -2)],
    },
    right: {
      label: 'Va pour le SUV',
      pillars: { puissants: 4, peuple: -8, medias: -6 },
      effects: [{ kind: 'exposure', delta: 3 }, st('energy', 2)],
    },
  },
  {
    id: 'ra_aide_alimentaire', name: 'Martine Rocheteau', role: 'Bénévole d’une épicerie solidaire', icon: '🥫', eligible: BAS,
    text: 'Notre épicerie solidaire perd son local. Un entrepôt municipal est vide depuis deux ans. Vous pourriez plaider notre cause ?',
    left: {
      label: 'Je plaide, et fort',
      pillars: { peuple: 6, puissants: -6, parti: 4 },
      effects: [{ kind: 'dossier', domain: 'social', delta: 2 }],
    },
    right: {
      label: 'L’entrepôt est promis',
      pillars: { peuple: -8, puissants: 8 },
      outcome: 'L’entrepôt deviendra un parking. Pour la piste cyclable, ironie du sort.',
    },
  },
  {
    id: 'ra_promoteur', name: 'Stéphane Bellanger', role: 'Promoteur immobilier', icon: '🏗️', eligible: ELU,
    text: 'Je vous propose 120 logements neufs, dont… disons 5 % de logements sociaux. En échange, une dérogation de hauteur. Et une invitation à ma loge au stade.',
    left: {
      label: '25 % de social ou rien',
      pillars: { puissants: -10, parti: 6, peuple: 4 },
    },
    right: {
      label: 'Topé, et merci pour la loge',
      pillars: { puissants: 10, peuple: -4, medias: -6 },
      effects: [{ kind: 'exposure', delta: 2 }],
    },
  },
  {
    id: 'ra_fermeture_classe', name: 'Sylvie Marchetti', role: 'Directrice de l’école primaire', icon: '🏫', eligible: ELU,
    text: 'L’Éducation nationale ferme une classe. Les parents occupent l’école demain matin. Vous venez avec nous, écharpe tricolore comprise ?',
    left: {
      label: 'J’y serai, écharpe au cou',
      pillars: { peuple: 6, medias: 6, parti: -4, puissants: -4 },
      effects: [{ kind: 'dossier', domain: 'education', delta: 1 }],
    },
    right: {
      label: 'Je négocie en coulisses',
      pillars: { peuple: -6, parti: 6 },
    },
  },
  {
    id: 'ra_motion_congres', name: 'Thibault Renaud-Massin', role: 'Jeune loup d’une motion rivale', icon: '🐺', eligible: MILITANT,
    text: 'Signe notre motion pour le congrès. Ta section vote pour la motion du chef, mais l’avenir, c’est nous. Et on se souvient de ceux qui sont arrivés tôt.',
    tu: true,
    left: {
      label: 'Je signe en douce',
      pillars: { parti: -8, medias: 4, puissants: 4 },
      effects: [st('influence', 2)],
    },
    right: {
      label: 'Fidèle à ma section',
      pillars: { parti: 8, medias: -4 },
    },
  },
  {
    id: 'ra_fichier', name: 'Hugo Lecomte', role: 'Stagiaire « data » de la campagne', icon: '💻', eligible: BAS,
    text: 'J’ai codé une appli qui croise les listes électorales avec les profils Facebook. On sait qui hésite, qui a un chien, qui aime le foot. C’est légal… à peu près.',
    left: {
      label: 'Supprime tout, vite',
      pillars: { puissants: -6, medias: 4, parti: -4 },
      outcome: 'Hugo pleure son code. La CNIL ne saura jamais.',
    },
    right: {
      label: 'Montre-moi ça',
      pillars: { parti: 6, puissants: 6, medias: -8 },
      effects: [{ kind: 'exposure', delta: 3 }, { kind: 'momentum', delta: 1 }],
    },
  },
  {
    id: 'ra_jumelage', name: 'Hélène Wurtz', role: 'Présidente du comité de jumelage', icon: '🇩🇪', eligible: ELU,
    text: 'Nos amis de Bad Kirchberg nous invitent pour la fête de la bière. Une délégation de douze élus, aux frais de la commune. L’amitié franco-allemande n’a pas de prix !',
    left: {
      label: 'Prosit, on y va',
      pillars: { parti: 6, peuple: -8, medias: -4 },
      effects: [st('stress', -3)],
    },
    right: {
      label: 'Chacun paie son billet',
      pillars: { peuple: 6, parti: -6 },
    },
  },
  {
    id: 'ra_radar', name: 'Lucien Moreau', role: 'Porte-parole du collectif « Laissez-nous rouler »', icon: '🚗', eligible: BAS,
    text: 'Le nouveau radar de la nationale a flashé 9 000 fois en un mois. On veut que vous signiez notre pétition pour le retirer. Le peuple roule, vous savez.',
    left: {
      label: 'Je signe la pétition',
      pillars: { peuple: 6, medias: -6, parti: -4 },
      effects: [{ kind: 'segment', segment: 'ruraux', delta: 1 }],
    },
    right: {
      label: 'Le radar sauve des vies',
      pillars: { peuple: -6, medias: 6 },
      effects: [{ kind: 'dossier', domain: 'securite', delta: 1 }],
    },
  },
  {
    id: 'ra_nom_rue', name: 'Paulette Gauthier', role: 'Présidente de la société d’histoire locale', icon: '📜', eligible: ELU,
    text: 'La nouvelle rue doit porter le nom d’une résistante oubliée du village. Mais le club de foot réclame le nom de son ancien buteur, celui de 1987. Tranchez.',
    left: {
      label: 'Rue de la Résistante',
      pillars: { parti: 6, medias: 4, peuple: -4 },
    },
    right: {
      label: 'Rue du Buteur de 1987',
      pillars: { peuple: 6, medias: -6 },
      effects: [{ kind: 'segment', segment: 'populaires', delta: 1 }],
    },
  },
  {
    id: 'ra_concours_tartes', name: 'Ginette Poulain', role: 'Présidente du comité des fêtes', icon: '🥧', repeatAfter: 24,
    text: 'Comme chaque année, vous présidez le jury du concours de tartes. Petit détail : la tarte de ma belle-sœur est immangeable, mais elle est très susceptible.',
    left: {
      label: 'Je juge en âme et conscience',
      pillars: { medias: 4, peuple: -4 },
      outcome: 'La belle-sœur ne vous adresse plus la parole. Le village apprécie.',
    },
    right: {
      label: 'Ex æquo pour tout le monde',
      pillars: { peuple: 4, medias: -4 },
      effects: [st('stress', -1)],
      outcome: 'Douze premiers prix. Le diplôme est en papier recyclé.',
    },
  },
  {
    id: 'ra_journal_college', name: 'Inès Charpentier', role: 'Rédactrice en chef du journal du collège, 13 ans', icon: '✏️', eligible: BAS,
    text: 'Pour notre journal, j’ai une seule question : pourquoi les adultes font des promesses qu’ils ne tiennent pas ? Vous avez cinq minutes, après j’ai maths.',
    left: {
      label: 'Je réponds franchement',
      pillars: { peuple: 6, medias: 4, parti: -6 },
      effects: [st('credibility', 1)],
      outcome: 'L’article est photocopié et circule dans tout le canton.',
    },
    right: {
      label: 'Langue de bois polie',
      pillars: { peuple: -4, parti: 4 },
      outcome: 'Inès titre : « Il·Elle n’a pas répondu ». Une future grande.',
    },
  },
  {
    id: 'ra_intercommunalite', name: 'Bernard Coustal', role: 'Sénateur et baron local', icon: '🏰', eligible: ELU,
    text: 'Je vous propose la vice-présidence de l’intercommunalité, chargée des déchets. Rien d’exaltant, mais un bureau, une voiture et mon amitié. Ça vaut de l’or.',
    left: {
      label: 'J’accepte l’amitié du baron',
      pillars: { puissants: 8, parti: 6, peuple: -8 },
      effects: [st('influence', 2), st('stress', 2)],
    },
    right: {
      label: 'Un mandat, c’est assez',
      pillars: { puissants: -6, parti: -4, peuple: 6 },
    },
  },
  {
    id: 'ra_brigitte_fibre', ...BRIGITTE, eligible: ELU,
    text: 'Notre fibre optique s’arrête pile à la frontière de nos deux communes. Une lettre commune au Département, ça aurait plus de poids. Je vous envoie le brouillon ?',
    left: {
      label: 'Envoyez, je cosigne',
      pillars: { peuple: 6, puissants: -4 },
      effects: [{ kind: 'dossier', domain: 'numerique', delta: 1 }],
    },
    right: {
      label: 'Chacun ses câbles',
      pillars: { peuple: -4, parti: 4 },
    },
  },
  {
    id: 'ra_chloe_plateau', ...CHLOE, tu: true, eligible: BAS,
    text: 'France Bleu te propose un débat face au candidat d’extrême centre radical. Lui, il est rodé. Toi… tu as eu deux heures de média-training. On y va ?',
    left: {
      label: 'On y va, et on gagne',
      pillars: { medias: 8, parti: 4, puissants: -4 },
      effects: [st('stress', 3)],
    },
    right: {
      label: 'On envoie un communiqué',
      pillars: { medias: -8, puissants: 4 },
      effects: [st('stress', -1)],
    },
  },
  {
    id: 'ra_pinson_mecenat', ...PINSON, eligible: BAS,
    text: 'Je voudrais offrir des maillots au club de foot des jeunes. Avec le logo Pinson Menuiseries… et votre photo à côté du mien, pour l’amitié. Ça vous dit ?',
    left: {
      label: 'Juste le logo',
      pillars: { puissants: -6, medias: 4 },
    },
    right: {
      label: 'Photo d’équipe, avec plaisir',
      pillars: { puissants: 6, peuple: 4, medias: -6 },
      effects: [{ kind: 'segment', segment: 'jeunes', delta: 1 }],
    },
  },
  {
    id: 'ra_mere_voisine', ...MERE, tu: true, eligible: BAS, repeatAfter: 30,
    text: 'Madame Roussel, ma voisine du troisième, voudrait une place en crèche pour son petit-fils. Je lui ai dit que tu t’en occuperais. Tu ne vas pas me faire mentir ?',
    left: {
      label: 'Je passe un coup de fil',
      pillars: { peuple: 4, medias: -6, puissants: 4 },
      effects: [{ kind: 'exposure', delta: 1 }],
      outcome: 'Le petit-fils a sa place. Trois autres voisines appellent votre mère.',
    },
    right: {
      label: 'Il y a une liste d’attente',
      pillars: { peuple: -4, medias: 4 },
      effects: [st('stress', 1)],
      outcome: 'Votre mère vous fait la tête jusqu’à Pâques.',
    },
  },
];

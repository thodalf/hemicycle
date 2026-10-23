import { DialogueDef, chiefSpeaker, guestSpeaker, mem, rankAtLeast, st, teamSpeaker } from './dialogue-types';
import { DIALOGUES_A } from './dialogues-a';
import { DIALOGUES_B } from './dialogues-b';
import { DIALOGUES_C } from './dialogues-c';

/* ============================================================
 *  Les conversations à embranchements du téléphone. Trois
 *  exemples ici, qui montrent tout ce que le format permet ;
 *  le gros des conversations est dans dialogues-a/b/c.ts.
 * ============================================================ */

const BASE: DialogueDef[] = [
  // ── Un bénévole trop zélé : mémoire et suite différée ──
  {
    id: 'benevole_zele', weight: 1, eligible: d => !rankAtLeast(d, 3),
    who: guestSpeaker('benevole', 'Kevin, bénévole', 'Votre section'),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Salut ! C’est Kevin, de la section. J’ai collé 400 affiches cette nuit… y compris sur la mairie. Le maire est furieux. J’ai bien fait, non ?',
        choices: [
          { id: 'couvrir', label: 'Je te couvre, mais plus jamais ça', effects: [st('credibility', -2)], remember: { kevin_loyal: 1 }, next: 'merci' },
          { id: 'excuses', label: 'Je vais présenter des excuses au maire', hint: 'Kevin le prendra mal', effects: [st('credibility', 2), st('energy', -3)], remember: { kevin_vexe: 1 }, end: 'Ok… Je comprends. Je vais me faire discret un moment.', later: { months: 6, node: 'retour_vexe' } },
          { id: 'feliciter', label: 'Bravo, c’est ça le militantisme !', effects: [st('popularity', 1), { kind: 'exposure', delta: 3 }], remember: { kevin_fan: 1 }, next: 'encore' },
        ],
        ignore: [{ kind: 'partyMembers', delta: -2 }],
      },
      merci: {
        text: 'Merci, vraiment. Tu peux compter sur moi pour la prochaine campagne. Je ramènerai des copains.',
        choices: [
          { id: 'ok', label: 'Je compte sur toi', end: 'À fond !', later: { months: 8, node: 'retour_loyal' } },
        ],
      },
      encore: {
        text: 'Génial ! Du coup ce soir on fait la préfecture. Tu viens tenir le seau de colle ?',
        choices: [
          { id: 'venir', label: 'J’arrive', hint: 'Risqué : si quelqu’un filme…', effects: [st('energy', -6), st('popularity', 1)], risk: { chance: 0.45, scaleWith: 'credibility', fail: 'filme' }, end: 'Nuit mémorable. Personne ne nous a vus !' },
          { id: 'freiner', label: 'Non, on arrête là', end: 'T’es pas drôle. Bon, d’accord.' },
        ],
      },
      filme: {
        text: 'Euh… quelqu’un nous a filmés. La vidéo tourne : « Un élu colle des affiches sur la préfecture ». Désolé…',
        effects: [st('credibility', -5), { kind: 'exposure', delta: 6 }],
        choices: [
          { id: 'assumer', label: 'On assume : c’est de l’engagement', effects: [st('popularity', 1), st('credibility', -1)], end: 'Les commentaires sont partagés. Les militants adorent.' },
          { id: 'regretter', label: 'Je présente mes excuses publiquement', effects: [st('credibility', 2)], end: 'C’est noté. Je vais me faire oublier.' },
        ],
      },
      retour_loyal: {
        text: 'Salut, c’est Kevin ! Comme promis, j’ai monté une équipe de quinze bénévoles pour toi. On commence quand ?',
        effects: [{ kind: 'momentum', delta: 4 }, { kind: 'partyMembers', delta: 6 }],
        choices: [
          { id: 'merci', label: 'Tout de suite. Merci, Kevin', effects: [st('stress', -2)], end: 'Avec plaisir. Tu nous avais défendus, on s’en souvient.' },
        ],
      },
      retour_vexe: {
        text: d => `Bonjour. C’est Kevin. Je voulais te dire que je quitte la section. ${mem(d, 'kevin_vexe') ? 'Je n’ai pas digéré tes excuses au maire.' : ''} Bonne continuation.`,
        effects: [{ kind: 'partyMembers', delta: -3 }],
        choices: [
          { id: 'retenir', label: 'Attends, on peut en parler', hint: 'Une heure au téléphone', effects: [st('energy', -4), { kind: 'partyMembers', delta: 3 }], end: 'Bon… je reste. Mais tu me dois un café.' },
          { id: 'laisser', label: 'Je respecte ton choix', end: 'Salut.' },
        ],
      },
    },
  },
  // ── Le ou la chef·fe teste votre loyauté : réponses conditionnelles ──
  {
    id: 'chef_loyaute', weight: 1, repeatAfter: 30, eligible: d => !!chiefSpeaker(d) && rankAtLeast(d, 1),
    who: d => chiefSpeaker(d),
    start: 'debut',
    nodes: {
      debut: {
        text: 'On me dit que tu discutes avec le courant d’en face. Je préfère l’entendre de toi : où en es-tu ?',
        choices: [
          { id: 'loyal', label: 'Je suis avec toi, sans réserve', effects: [st('politicalCapital', 3)], remember: { loyal_chef: 1 }, end: 'C’est ce que je voulais entendre. Je m’en souviendrai aux investitures.' },
          { id: 'franc', label: 'Je parle à tout le monde, c’est mon rôle', effects: [st('credibility', 1), { kind: 'cohesion', delta: -1 }], next: 'menace' },
          { id: 'trahi', label: 'Tu as raison de t’inquiéter', if: d => d.player.stats.influence >= 40, hint: 'Il faut de l’influence pour oser', effects: [st('influence', 2)], remember: { defi_chef: 1 }, next: 'guerre' },
        ],
        ignore: [st('politicalCapital', -3)],
      },
      menace: {
        text: 'Ton rôle, c’est d’être loyal. Je te le dis une fois : choisis ton camp avant le congrès.',
        choices: [
          { id: 'rassurer', label: 'Message reçu', effects: [st('stress', 2)], end: 'Bien.' },
          { id: 'tenir', label: 'Je ne choisis pas sous la menace', effects: [st('credibility', 2), st('politicalCapital', -4)], remember: { defi_chef: 1 }, end: 'On en reparlera. Crois-moi.' },
        ],
      },
      guerre: {
        text: 'Alors c’est la guerre. Ne viens pas pleurer quand ta circonscription partira à quelqu’un d’autre.',
        effects: [st('politicalCapital', -6)],
        choices: [
          { id: 'assumer', label: 'Que le meilleur gagne', effects: [st('influence', 2), st('stress', 4)], end: '…' },
          { id: 'reculer', label: 'Attends, je me suis mal exprimé·e', effects: [st('credibility', -3)], end: 'C’est ça. Rentre dans le rang.' },
        ],
      },
    },
  },
  // ── Un conseiller qui veut partir : risque et suite ──
  {
    id: 'equipe_depart', weight: 1, repeatAfter: 24, eligible: d => d.player.team.length >= 2,
    who: teamSpeaker(),
    start: 'debut',
    nodes: {
      debut: {
        text: 'Je préfère vous le dire franchement : un cabinet de conseil m’offre le double. J’hésite.',
        choices: [
          { id: 'augmenter', label: 'Je vous augmente de 20 %', hint: 'Coûteux chaque mois', effects: [{ kind: 'team', recruitId: '$speaker', salaryPct: 20, morale: 10 }], end: 'Merci. Je reste, et je ne l’oublierai pas.' },
          { id: 'mission', label: 'Je vous confie un dossier passionnant', effects: [{ kind: 'team', recruitId: '$speaker', morale: 6 }], risk: { chance: 0.4, scaleWith: 'influence', fail: 'part' }, end: 'Un vrai défi… D’accord, je reste.' },
          { id: 'laisser', label: 'Je ne retiens personne', effects: [{ kind: 'team', recruitId: '$speaker', leave: true }, { kind: 'team', morale: -4, all: true }], end: 'Compris. Je pose ma démission demain.' },
        ],
      },
      part: {
        text: 'Désolé·e, j’ai réfléchi : j’accepte l’offre. Je pars à la fin du mois.',
        effects: [{ kind: 'team', recruitId: '$speaker', leave: true }, { kind: 'team', morale: -5, all: true }, st('stress', 3)],
        choices: [
          { id: 'bonne_route', label: 'Bonne route, et merci pour tout', effects: [st('credibility', 1)], end: 'Merci à vous. Je garderai un œil sur votre carrière.' },
        ],
      },
    },
  },
];

export const DIALOGUES: DialogueDef[] = [...BASE, ...DIALOGUES_A, ...DIALOGUES_B, ...DIALOGUES_C];
export const DIALOGUE_BY_ID = new Map(DIALOGUES.map(x => [x.id, x]));


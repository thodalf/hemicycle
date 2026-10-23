import { GameState } from '../models/game.models';
import { NameGender, firstName, genderOf, nameRng, personName } from '../data/names';

/* ============================================================
 *  Au téléphone, chacun a un prénom, un nom, et sa fonction.
 *
 *  Les interlocuteurs écrits avec un simple prénom (« Kevin,
 *  bénévole »), un titre (« Le préfet », « M. Garnier »), un lien
 *  de famille (« Maman ») ou une organisation (« Fédération du
 *  Bâtiment ») reçoivent ici un nom complet, toujours le même pour
 *  une partie donnée (tiré de la graine de la partie et de la clé
 *  de conversation), et leur fonction passe dans la ligne du rôle.
 *  Rien n'est stocké : le calcul est pur et stable.
 * ============================================================ */

/** Ce qu'on ne renomme pas : pseudonymes de scénario, numéros anonymes */
const KEEP = /^(Monsieur Nicolas|Numéro inconnu|L[’']émissaire|La presse|Les colles|Président |Présidente |Général |Générale |Amiral )/;
const ORG = /^(Collectif|Fédération|Union|Association|Syndicat|Rédaction|Institut|Groupe|Club|Confédération|Comité|Conseil|Chambre|Ordre|Mouvement|Amicale|Coordination|Front|Alliance|Cercle|Fondation|Observatoire|Cabinet|Ligue|Secours)\b/;
const ARTICLE = /^(Le|La|Les|L[’']|Un|Une)\s*/;
const TITLE = /^(M\.|Mme|Monsieur|Madame|Mlle|Me|Dr|Docteur|Maître)\s+(.+)$/;
const FAMILY: Record<string, [NameGender, string]> = {
  Maman: ['f', 'Votre mère'], Papa: ['m', 'Votre père'], 'Votre sœur': ['f', 'Votre sœur'], 'Votre frère': ['m', 'Votre frère'],
  Mamie: ['f', 'Votre grand-mère'], Papi: ['m', 'Votre grand-père'], 'Votre mère': ['f', 'Votre mère'], 'Votre père': ['m', 'Votre père'],
  'Votre cousine': ['f', 'Votre cousine'], 'Votre cousin': ['m', 'Votre cousin'], 'Votre fille': ['f', 'Votre fille'], 'Votre fils': ['m', 'Votre fils'],
};

/** La fonction d'un représentant, selon le type de contact */
const FUNC: Record<string, (g: NameGender) => string> = {
  lobby: g => (g === 'f' ? 'Déléguée générale' : 'Délégué général'),
  industriel: g => (g === 'f' ? 'Directrice générale' : 'Directeur général'),
  syndicat: g => (g === 'f' ? 'Secrétaire générale' : 'Secrétaire général'),
  association: g => (g === 'f' ? 'Présidente' : 'Président'),
  culte: () => 'Responsable',
  journaliste: g => (g === 'f' ? 'Journaliste' : 'Journaliste'),
};

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const join = (...parts: (string | undefined)[]) => parts.filter(p => p && p.trim()).join(' · ');
const isFirstName = (w: string) => /^[A-ZÀ-Ý][a-zà-ÿ’'-]+$/.test(w);

function surnameOf(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
}

function gen(d: GameState, salt: string, g?: NameGender): string {
  return personName(nameRng(d.seed ?? 1, `tel|${salt}`), g);
}

/**
 * Le nom complet et la fonction d'un interlocuteur du téléphone.
 * `who` : clé de la conversation, `from` : nom affiché d'origine, `role` : rôle d'origine.
 */
export function personOf(d: GameState, who: string, from: string, role: string): { from: string; role: string } {
  const raw = (from ?? '').trim();
  if (!raw || KEEP.test(raw) || who.startsWith('perso:') || who.startsWith('collegue:') || who.startsWith('equipe:') || who === 'chef' || who === 'conjoint') return { from: raw, role };
  // Les contacts du réseau sont des organisations : on parle à quelqu'un, qui la représente
  if (who.startsWith('contact:')) {
    const c = d.contacts.find(x => `contact:${x.id}` === who);
    if (c && raw === c.name) {
      // « Judith Fauvel-Poulain (L’Éclaireur) » : une personne, et son média
      const m = /^(.+?)\s*\((.+)\)$/.exec(c.name);
      if (m) return { from: m[1].trim(), role: join(FUNC[c.type]?.(genderOf(m[1]) ?? 'f') ?? role, m[2].trim()) };
      const name = gen(d, who);
      return { from: name, role: join(FUNC[c.type]?.(genderOf(name) ?? 'm') ?? role, c.name) };
    }
  }
  // La famille : le même nom de famille que vous
  const fam = FAMILY[raw];
  if (fam) {
    const next = nameRng(d.seed ?? 1, `tel|fam|${raw}`);
    return { from: `${firstName(next, fam[0])} ${surnameOf(d.player.name)}`, role: fam[1] };
  }
  // « Kevin, bénévole » : le nom, puis la fonction
  let name = raw;
  let func = '';
  const comma = raw.indexOf(',');
  if (comma > 0) { name = raw.slice(0, comma).trim(); func = raw.slice(comma + 1).trim(); }
  // « Rédaction de X », « Le Vénérable · Loge » : un titre ou une organisation, et quelqu'un derrière
  const dot = name.indexOf(' · ');
  if (dot > 0) { func = join(name.slice(dot + 3), func); name = name.slice(0, dot).trim(); }
  if (ORG.test(name)) return { from: gen(d, `${who}|${name}`), role: join(func ? cap(func) : name.startsWith('Rédaction') ? 'Rédaction en chef' : 'Porte-parole', name.startsWith('Rédaction') ? name.replace(/^Rédaction (de |du |d’|des )?/, '') : name, role === name ? '' : role) };
  const t = TITLE.exec(name);
  if (t) {
    const g: NameGender = /^(Mme|Madame|Mlle)/.test(t[1]) ? 'f' : 'm';
    const rest = t[2].trim();
    const full = rest.split(/\s+/).length >= 2 ? rest : `${firstName(nameRng(d.seed ?? 1, `tel|${who}|${rest}`), g)} ${rest}`;
    return { from: full, role: join(cap(func), role) };
  }
  if (ARTICLE.test(name)) {
    const art = (ARTICLE.exec(name)?.[1] ?? '').toLowerCase();
    const title = name.replace(ARTICLE, '').trim();
    const g: NameGender | undefined = art === 'la' || art === 'une' ? 'f' : art === 'le' || art === 'un' ? 'm' : undefined;
    return { from: gen(d, `${who}|${name}`, g), role: join(cap(title), cap(func), role) };
  }
  const words = name.split(/\s+/);
  if (words.length === 1 && isFirstName(words[0])) {
    const g = genderOf(words[0]) ?? (/[ae]$/.test(words[0]) ? 'f' : 'm');
    const last = surnameOf(gen(d, `${who}|${name}`, g));
    return { from: `${words[0]} ${last}`, role: join(cap(func), role) };
  }
  return { from: name, role: join(cap(func), role) };
}

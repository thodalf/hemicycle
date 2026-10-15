/* ============================================================
 *  Le secrétaire de rédaction : il transforme les dépêches du
 *  jeu (« Bureau national : quelle ligne ? — Soutenir la motion »)
 *  en vrais titres de presse (« Bureau national : Claire Morel
 *  soutient la ligne dure »), à la troisième personne, sans
 *  reprendre les libellés des boutons.
 * ============================================================ */

/** Conjugaisons irrégulières à la 3e personne du singulier (présent) */
const IRREGULAR: Record<string, string> = {
  être: 'est', avoir: 'a', aller: 'va', faire: 'fait', dire: 'dit', voir: 'voit', pouvoir: 'peut', vouloir: 'veut', savoir: 'sait', devoir: 'doit',
  venir: 'vient', tenir: 'tient', soutenir: 'soutient', obtenir: 'obtient', revenir: 'revient', devenir: 'devient', maintenir: 'maintient', retenir: 'retient', prévenir: 'prévient', intervenir: 'intervient', contenir: 'contient',
  partir: 'part', sortir: 'sort', dormir: 'dort', servir: 'sert', sentir: 'sent', mentir: 'ment', repartir: 'repart', ressortir: 'ressort',
  ouvrir: 'ouvre', offrir: 'offre', couvrir: 'couvre', découvrir: 'découvre', souffrir: 'souffre', accueillir: 'accueille', cueillir: 'cueille', recueillir: 'recueille',
  courir: 'court', parcourir: 'parcourt', recourir: 'recourt', secourir: 'secourt', mourir: 'meurt', fuir: 'fuit',
  prendre: 'prend', reprendre: 'reprend', apprendre: 'apprend', comprendre: 'comprend', surprendre: 'surprend', entreprendre: 'entreprend',
  mettre: 'met', remettre: 'remet', promettre: 'promet', permettre: 'permet', admettre: 'admet', transmettre: 'transmet', soumettre: 'soumet', commettre: 'commet',
  recevoir: 'reçoit', apercevoir: 'aperçoit', décevoir: 'déçoit', concevoir: 'conçoit', percevoir: 'perçoit',
  écrire: 'écrit', décrire: 'décrit', inscrire: 'inscrit', lire: 'lit', relire: 'relit', élire: 'élit', suivre: 'suit', poursuivre: 'poursuit', vivre: 'vit', revivre: 'revit',
  rire: 'rit', sourire: 'sourit', boire: 'boit', croire: 'croit', plaire: 'plaît', taire: 'tait', conduire: 'conduit', construire: 'construit', reconstruire: 'reconstruit', détruire: 'détruit', produire: 'produit', réduire: 'réduit', traduire: 'traduit', introduire: 'introduit', instruire: 'instruit',
  battre: 'bat', combattre: 'combat', débattre: 'débat', abattre: 'abat', connaître: 'connaît', reconnaître: 'reconnaît', paraître: 'paraît', apparaître: 'apparaît', disparaître: 'disparaît',
  peindre: 'peint', craindre: 'craint', plaindre: 'plaint', joindre: 'joint', rejoindre: 'rejoint', éteindre: 'éteint', atteindre: 'atteint', résoudre: 'résout', valoir: 'vaut', falloir: 'faut', asseoir: 'assied', vaincre: 'vainc', convaincre: 'convainc',
  appeler: 'appelle', rappeler: 'rappelle', jeter: 'jette', rejeter: 'rejette', épeler: 'épelle', renouveler: 'renouvelle',
  acheter: 'achète', racheter: 'rachète', lever: 'lève', soulever: 'soulève', relever: 'relève', enlever: 'enlève', mener: 'mène', amener: 'amène', emmener: 'emmène', promener: 'promène', peser: 'pèse', geler: 'gèle',
  céder: 'cède', préférer: 'préfère', répéter: 'répète', espérer: 'espère', protéger: 'protège', considérer: 'considère', accélérer: 'accélère', libérer: 'libère', régler: 'règle', suggérer: 'suggère', gérer: 'gère', exagérer: 'exagère', célébrer: 'célèbre', révéler: 'révèle', compléter: 'complète', posséder: 'possède', interpréter: 'interprète', refléter: 'reflète', modérer: 'modère', tolérer: 'tolère', opérer: 'opère', coopérer: 'coopère', récupérer: 'récupère', intégrer: 'intègre', alléger: 'allège', abréger: 'abrège', siéger: 'siège', assiéger: 'assiège',
  payer: 'paie', essayer: 'essaie', envoyer: 'envoie', renvoyer: 'renvoie', employer: 'emploie', nettoyer: 'nettoie', appuyer: 'appuie', ennuyer: 'ennuie', essuyer: 'essuie', tutoyer: 'tutoie', vouvoyer: 'vouvoie', déployer: 'déploie', foudroyer: 'foudroie',
};
/** Verbes en -ir du deuxième groupe ne suivant pas la règle -it (déjà couverts plus haut) */

/** Conjugue un infinitif à la 3e personne du singulier */
export function conjugate(inf: string): string {
  const v = inf.toLowerCase();
  if (IRREGULAR[v]) return IRREGULAR[v];
  if (v.endsWith('er')) return v.slice(0, -2) + 'e';
  if (v.endsWith('ir')) return v.slice(0, -2) + 'it';
  if (v.endsWith('dre')) return v.slice(0, -2);
  if (v.endsWith('re')) return v.slice(0, -2) + 't';
  return v;
}

const INF = /^[a-zà-ÿœ]+(er|ir|re|oir)$/i;
/** Pronoms et particules qui peuvent précéder l'infinitif (« les recevoir », « s'excuser », « y passer », « ne pas céder ») */
const CLITIC = /^(ne\s+pas\s+|ne\s+rien\s+|ne\s+plus\s+|n’|n')?(?:(?:se|les|le|la|lui|leur|y|en|me|te|nous|vous)\s+|(?:s|l|m|t)[’'])*/i;

/** « Les recevoir et négocier » → « les reçoit et négocie » ; null si ce n'est pas un groupe infinitif */
export function thirdPerson(label: string): string | null {
  let s = label.trim().replace(/\s+/g, ' ');
  const lowerFirst = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
  s = lowerFirst(s);
  const parts = s.split(/(\s(?:et|puis|ou)\s|,\s)/);
  let converted = false;
  const out = parts.map((p, i) => {
    if (i % 2 === 1) return p;
    const m = p.match(CLITIC);
    const pre = m ? m[0] : '';
    const rest = p.slice(pre.length);
    const [verb, ...tail] = rest.split(' ');
    if (!verb || !INF.test(verb.replace(/[.,!?]$/, ''))) return p;
    // « ne pas céder » → « ne cède pas »
    const neg = pre.match(/^ne\s+(pas|rien|plus)\s+/i);
    const clitics = pre.replace(/^ne\s+(pas|rien|plus)\s+/i, '').replace(/^n[’']/i, '');
    const conj = conjugate(verb.replace(/[.,!?]$/, ''));
    converted = converted || i === 0;
    const verbOut = neg ? `ne ${clitics}${conj} ${neg[1]}` : `${clitics}${conj}`;
    return [verbOut, ...tail].join(' ');
  });
  if (!converted) return null;
  return possessives(out.join('')).replace(/\s+/g, ' ').replace(/\s*:\s*$/, '').trim();
}

/** Genre probable d'un nom commun (pour « son » / « sa ») */
function femNoun(w: string): boolean {
  const n = w.toLowerCase();
  if (/^(main|fin|loi|voix|part|nuit|mort|foi|paix|faim|soif|chair|cour|tour|clé|clef|forêt|fois|façon|mer|peau|eau)$/.test(n)) return true;
  if (/(age|ment|isme|eau|oir|ier|on|in|at|et|ou|al|ail|eil|ard|er)$/.test(n) && !/(ion|aison|açon)$/.test(n)) return false;
  return /(e|é|ion|té|ance|ence|ure|ie|ise|ude|aison)s?$/.test(n);
}

/** « votre », « vos », « vous-même » → troisième personne */
function possessives(s: string): string {
  return s
    .replace(/\b([Vv])otre\s+([A-Za-zÀ-ÿœ’'-]+)/g, (_, v: string, noun: string) => {
      const vowel = /^[aeiouyéèêàâîôûh]/i.test(noun);
      const p = vowel || !femNoun(noun) ? 'son' : 'sa';
      return `${v === 'V' ? p[0].toUpperCase() + p.slice(1) : p} ${noun}`;
    })
    .replace(/\bvos\b/g, 'ses').replace(/\bVos\b/g, 'Ses')
    .replace(/\bvous-même\b/g, 'lui-même');
}

/** Résout l'écriture inclusive selon le genre de la personne citée */
export function degender(s: string, fem: boolean): string {
  return s
    .replace(/([A-Za-zÀ-ÿ]+)er·e(s?)\b/g, (_, b: string, pl: string) => (fem ? `${b}ère${pl}` : `${b}er${pl}`))
    .replace(/([A-Za-zÀ-ÿ]+)eur·rice(s?)\b/g, (_, b: string, pl: string) => (fem ? `${b}rice${pl}` : `${b}eur${pl}`))
    .replace(/([A-Za-zÀ-ÿ]+)if·ve(s?)\b/g, (_, b: string, pl: string) => (fem ? `${b}ive${pl}` : `${b}if${pl}`))
    .replace(/([A-Za-zÀ-ÿ]+)eux·se(s?)\b/g, (_, b: string, pl: string) => (fem ? `${b}euse${pl}` : `${b}eux${pl}`))
    .replace(/chef·fe/g, fem ? 'cheffe' : 'chef').replace(/Chef·fe/g, fem ? 'Cheffe' : 'Chef')
    .replace(/([A-Za-zÀ-ÿ]+)·le(s?)\b/g, (_, b: string, pl: string) => (fem ? `${b}le${pl}` : `${b}${pl}`))
    .replace(/([A-Za-zÀ-ÿ]+)·e(s?)\b/g, (_, b: string, pl: string) => (fem ? `${b}e${pl}` : `${b}${pl}`));
}

/** Verbes qui se construisent avec « à » (« il vous confie » → « il confie à X ») */
const INDIRECT = /^(confie|propose|demande|offre|donne|dit|écrit|envoie|reproche|promet|annonce|adresse|tend|pose|réclame|accorde|rend|remet|refuse|conseille|téléphone|parle|répond|écrivent|proposent|demandent|offrent|donnent|confient)$/;

/** Un prénom inconnu : on devine son genre à sa terminaison */
export function guessFem(name: string): boolean {
  const first = name.split(' ')[0].split('-')[0].toLowerCase();
  const maleE = /^(pierre|philippe|jérôme|antoine|maxime|guillaume|alexandre|étienne|georges|jacques|baptiste|bastide|christophe|stéphane|frédéric|grégoire|hervé|rené|andré|aimé|noé|théophile|achille|auguste|hippolyte|ange|serge|gilles|charles|jules|emile|émile|claude|dominique|camille|pascale?|sacha|nicola|luca|joshua|elie|élie|eugène|amédée|ambroise|fabrice|maurice|patrice|ulysse|eustache|lucide|benoîte|benoit|benoît|aristide|blaise|basile|cyrille|honoré|isidore|jérémie|josé|lazare|marcelle?)$/;
  if (maleE.test(first)) return /^(pascale|marcelle|benoîte)$/.test(first);
  return /(a|e|ie|ine|elle|ette|ise|ée|ude|ance|ence|ène|ève|aire|ice|ore|ys|th)$/.test(first);
}

const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = <T,>(arr: T[], key: string) => arr[hash(key) % arr.length];

/** Le sujet d'une dépêche, raccourci pour un titre (« Crise : krach boursier » → « Krach boursier ») */
function topicOf(title: string): string {
  let t = title.replace(/^Crise\s*:\s*/i, '').replace(/[?!]$/, '').trim();
  const colon = t.indexOf(' : ');
  if (colon > 0 && colon <= 34) t = t.slice(0, colon);
  return capFirst(t);
}

export interface HeadlineCtx {
  /** Comment la presse nomme le joueur (nom, ou « La présidente ») */
  who: string;
  fem: boolean;
  /** Le joueur est-il en jeu dans la dépêche ? (les autres titres gardent leur sujet) */
  aboutPlayer: boolean;
  /** Genre de la personnalité citée dans la dépêche (pour l'écriture inclusive) */
  personFem?: boolean;
}

/**
 * Réécrit une dépêche en titre de presse. Retourne aussi un kicker (surtitre) plus précis quand c'est utile.
 */
export function pressHeadline(title: string, body: string | undefined, ctx: HeadlineCtx, key: string, kind?: string): { title: string; kicker?: string } {
  const who = ctx.who;
  // Décision : « Sujet — Choix »
  const dec = kind === 'decision' || kind === undefined ? title.match(/^(.+?) — (.+)$/) : null;
  if (dec) {
    const rawTopic = topicOf(dec[1]);
    const second = /\b(vous|votre|vos)\b/i.test(rawTopic);
    const topic = second ? toThird(rawTopic.replace(/^(.+?) vous ([a-zà-ÿ]+(?:e|ent|it|a|ait))(?![\wÀ-ÿ])/, (_, a: string, v: string) => (INDIRECT.test(v) ? `${a} ${v} à ${who}` : `${a} ${v} ${who}`)), who, ctx.fem) : rawTopic;
    const act = thirdPerson(dec[2]);
    if (second && topic) {
      // « Marc-Robin Lesage attaque Claire Morel : elle riposte sur le fond »
      const named = topic.includes(who);
      const sj = named ? (ctx.fem ? 'elle' : 'il') : who;
      return { title: elide(degender(`${topic} : ${act ? `${sj} ${act}` : `${sj} tranche`}`, ctx.fem)) };
    }
    const lead = act ? `${who} ${act}` : `${who} tranche`;
    const t = second ? rawTopic.replace(/\b(vous|votre|vos)\b.*$/i, '').trim() : rawTopic;
    const short = !second && t.length <= 34;
    return { title: elide(degender(short ? `${t} : ${lead}` : capFirst(lead), ctx.fem)), kicker: short || second ? undefined : t.length <= 60 ? t : undefined };
  }
  const eclat = title.match(/^Coup d’éclat : (.+)$/);
  if (eclat) {
    const act = thirdPerson(eclat[1]);
    return { title: degender(act ? pick([`${who} frappe fort et ${act}`, `Le coup de maître : ${who} ${act}`, `${who} ${act}, et tout le monde en parle`], key) : `Le coup d’éclat de ${who}`, ctx.fem), kicker: 'Le coup d’éclat' };
  }
  const rate = title.match(/^Raté : (.+)$/);
  if (rate) {
    const act = thirdPerson(rate[1]);
    return { title: degender(act ? pick([`Raté pour ${who}, qui ${act}`, `${who} ${act}… et se prend les pieds dans le tapis`, `Faux pas : ${who} ${act} sans convaincre`], key) : `Le faux pas de ${who}`, ctx.fem), kicker: 'Fait divers' };
  }
  let m = title.match(/^Crise : (.+)$/i);
  if (m) {
    const topic = capFirst(m[1]);
    return { title: `${topic} : ${pick(['le pays retient son souffle', 'la France sous le choc', 'l’inquiétude gagne tout le pays', 'l’État sur le pied de guerre', 'les heures qui comptent'], key)}`, kicker: 'Crise' };
  }
  m = title.match(/^L’actualité se focalise sur : (.+)$/);
  if (m) {
    const t = m[1];
    return { title: elide(pick([`${t} : le sujet qui enflamme les plateaux`, `${t}, le grand débat du moment`, `${t} : le pays s’empare de la question`, `Tout le monde ne parle plus que de ${t.toLowerCase()}`], key)), kicker: 'Tendance' };
  }
  m = title.match(/^Grande lutte : (.+)$/);
  if (m) return { title: `${m[1]} : le grand bras de fer commence`, kicker: 'Grande lutte' };
  m = title.match(/^Fronde : (.+)$/);
  if (m) return { title: pick([`Les ${m[1].toLowerCase()} entrent en dissidence`, `Fronde : les ${m[1].toLowerCase()} haussent le ton`, `Le parti tangue : les ${m[1].toLowerCase()} se rebiffent`], key), kicker: 'Vie des partis' };
  m = title.match(/^(.+) occupe le terrain$/);
  if (m) return { title: elide(pick([`${m[1]} multiplie les apparitions`, `${m[1]} partout à la fois`, `L’offensive médiatique de ${m[1]}`], key)) };
  // Titres à la deuxième personne : la presse parle du joueur à la troisième
  let t = title;
  if (ctx.aboutPlayer) {
    t = t
      .replace(/^Votre\s+(.+)$/i, (_, rest: string) => `${who} : ${rest}`)
      .replace(/^Vos\s+(.+)$/i, (_, rest: string) => `${who} : ${rest}`)
      .replace(/\b(de|sans|pour|avec|contre|chez) vous\b/g, (_, p: string) => `${p} ${who}`)
      .replace(/^(.+?) vous ([a-zà-ÿ]+(?:e|ent|it|a|ait))\b/, (_, s: string, v: string) => (INDIRECT.test(v) ? `${s} ${v} à ${who}` : `${s} ${v} ${who}`));
    t = possessives(t);
  }
  // L'écriture inclusive d'un nom propre : on accorde selon la personne
  if (ctx.personFem !== undefined) t = degender(t, ctx.personFem);
  else if (ctx.aboutPlayer) t = degender(t, ctx.fem);
  return { title: elide(t) };
}

/** Le corps d'une dépêche, débarrassé des consignes de jeu (« À vous de jouer », « Popularité −2 ») */
export function cleanBody(body: string): string {
  return body
    .replace(/\s*À vous de jouer[^.]*\.?/g, '')
    .replace(/\s*(?:[A-ZÉ][\wÀ-ÿ’' -]{2,30}\s[+−-]\d[\d,]*\s?%?\.?\s*)+$/u, '')
    .trim();
}

/* ── Deuxième personne → troisième personne ─────────────────── */

const VOUS_IRREG: Record<string, string> = {
  êtes: 'est', avez: 'a', faites: 'fait', dites: 'dit', allez: 'va', pouvez: 'peut', voulez: 'veut', devez: 'doit', savez: 'sait', recevez: 'reçoit',
  voyez: 'voit', vivez: 'vit', écrivez: 'écrit', lisez: 'lit', dormez: 'dort', partez: 'part', sortez: 'sort', courez: 'court', suivez: 'suit',
  connaissez: 'connaît', paraissez: 'paraît', apparaissez: 'apparaît', buvez: 'boit', croyez: 'croit', riez: 'rit', mettez: 'met', remettez: 'remet', promettez: 'promet',
  serez: 'sera', aurez: 'aura', ferez: 'fera', irez: 'ira', pourrez: 'pourra', devrez: 'devra', verrez: 'verra', viendrez: 'viendra', saurez: 'saura',
  étiez: 'était', aviez: 'avait', faisiez: 'faisait', alliez: 'allait', pouviez: 'pouvait', vouliez: 'voulait', deviez: 'devait',
};

/** « vous visitez » → « visite », « vous êtes » → « est » */
function verb3(v: string): string | null {
  const w = v.toLowerCase();
  if (VOUS_IRREG[w]) return VOUS_IRREG[w];
  if (/iez$/.test(w)) return w.replace(/iez$/, 'ait');
  if (/(t|v)enez$/.test(w)) return w.replace(/enez$/, 'ient');
  if (/prenez$/.test(w)) return w.replace(/prenez$/, 'prend');
  if (/issez$/.test(w)) return w.replace(/issez$/, 'it');
  if (/(d|ond|end|erd)ez$/.test(w) && /(attend|répond|rend|perd|descend|entend|défend|vend|tend|fond)ez$/.test(w)) return w.replace(/ez$/, '');
  if (/erez$/.test(w)) return w.replace(/erez$/, 'era');
  if (/ez$/.test(w)) return w.replace(/ez$/, 'e');
  return null;
}

/**
 * Récrit un texte adressé au joueur (« Vous visitez une PME : votre écoute est saluée »)
 * à la troisième personne (« Claire Morel visite une PME : son écoute est saluée »).
 * Renvoie null si le texte résiste (il reste un « vous »).
 */
export function toThird(text: string, who: string, fem: boolean): string | null {
  if (!/(?<![\wÀ-ÿ])(vous|votre|vos)(?![\wÀ-ÿ])/i.test(text)) return text;
  const pro = fem ? 'elle' : 'il', obj = fem ? 'la' : 'le', strong = fem ? 'elle' : 'lui';
  const B = '(?<![\\wÀ-ÿ])', E = '(?![\\wÀ-ÿ])';
  let named = false;
  const subject = () => { if (named) return pro; named = true; return who; };
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  /** Après « que », le subjonctif : « que vous vous rapprochiez » → « qu'elle se rapproche » */
  const conj = (verb: string, before: string) => (/qu[e’']\s*$/i.test(before) && /iez$/.test(verb) ? verb.replace(/iez$/, 'e') : verb3(verb));
  let t = text
    .replace(new RegExp(`${B}([Vv])ous (aussi|même|seule?|seul·e|non plus|tous|toutes)${E}`, 'g'), (_, v: string, w: string) => `${v === 'V' ? cap(strong) : strong} ${w}`)
    .replace(new RegExp(`${B}([Vv])ous voilà`, 'g'), (_, v: string) => `${v === 'V' ? cap(obj) : obj} voilà`)
    .replace(new RegExp(`${B}(de|pour|avec|sans|chez|à|contre|envers|derrière|devant|après|avant|selon|sur|entre) vous${E}`, 'gi'), (_, p: string) => `${p} ${strong}`);
  // Pronominal : « vous vous rapprochez »
  t = t.replace(new RegExp(`${B}([Vv])ous vous ([a-zà-ÿ]+)`, 'g'), (m, v: string, verb: string, off: number, all: string) => {
    const c = conj(verb, all.slice(0, off)); if (!c) return m;
    const sj = subject(); const se = /^[aeiouyéèêh]/i.test(c) ? 's’' : 'se ';
    return `${v === 'V' ? cap(sj) : sj} ${se}${c}`;
  });
  // Sujet : « vous visitez »
  t = t.replace(new RegExp(`${B}([Vv])ous ([a-zà-ÿ]+)`, 'g'), (m, v: string, verb: string, off: number, all: string) => {
    const c = conj(verb, all.slice(0, off)); if (!c) return m;
    const sj = subject();
    return `${v === 'V' ? cap(sj) : sj} ${c}`;
  });
  // Complément : « on vous promet », « il vous cite », « les enfants vous posent »
  t = t.replace(new RegExp(`${B}([A-Za-zÀ-ÿ’']+) vous ([a-zà-ÿ]+)`, 'g'), (m, before: string, verb: string) => {
    if (/^(et|ou|que|qui|si|mais|car)$/i.test(before)) return m;
    const stem = verb.replace(/nt$/, '');
    const ind = INDIRECT.test(verb) || INDIRECT.test(stem) || /^(promet|demande|propose|reproche|confie|offre|donne|dit|écrit|souhaite|envoie|répond|parle|téléphone|accorde|pose)/.test(stem);
    const cl = ind ? 'lui ' : /^[aeiouyéèêh]/i.test(verb) ? 'l’' : `${obj} `;
    return `${before} ${cl}${verb}`;
  });
  t = possessives(t);
  if (/(?<![\wÀ-ÿ])(vous|votre|vos)(?![\wÀ-ÿ])/i.test(t)) return null;
  return degender(t, fem);
}

/** Élisions oubliées : « de écologie » → « d’écologie » */
export function elide(s: string): string {
  return s.replace(/\b([Dd])e ([aeiouéèêàâîôûyAEIOUÉÈÊÀÂÎÔÛY])/g, '$1’$2').replace(/\b([Qq])ue ([aeiouéèêàâîôûyAEIOUÉÈÊÀÂÎÔÛY])/g, '$1u’$2');
}

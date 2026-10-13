import { Domain, GameState, Promise } from '../models/game.models';
import { DOMAIN_LABELS } from '../models/game.models';
import { pushNews } from './effects';
import { Rng, clamp, nextId } from './rng';

/* ============================================================
 *  Les promesses : faites en public, elles rapportent tout de
 *  suite ; à l'échéance, la presse fait les comptes. Tenue si le
 *  dossier a progressé de 15 points (ou si vous l'avez honorée).
 * ============================================================ */

export const PROMISE_TEXTS: Record<Domain, string[]> = {
  economie: ['Pas un euro d’impôt en plus', 'Mille emplois créés dans la région'],
  social: ['Revaloriser les petites retraites', 'Un logement pour chaque sans-abri'],
  ecologie: ['Planter un million d’arbres', 'Sortir des pesticides dans les cantines'],
  securite: ['Une gendarmerie dans chaque canton', 'Des policiers de proximité dans les quartiers'],
  justice: ['Diviser par deux les délais de jugement', 'Des peines vraiment exécutées'],
  education: ['Pas plus de 24 élèves par classe', 'Revaloriser les enseignants'],
  sante: ['Plus aucun désert médical', 'Rouvrir les maternités fermées'],
  numerique: ['La fibre partout', 'Protéger les enfants sur les écrans'],
  territoires: ['Sauver les petites lignes de train', 'Un service public dans chaque village'],
  diplomatie: ['Faire entendre la France en Europe', 'Défendre nos agriculteurs dans les traités'],
};

export const PROMISE_GAIN = 15;

export function promises(d: GameState): Promise[] {
  return (d.promises ??= []);
}

export function makePromise(d: GameState, domain: Domain, rng: Rng, months = 24, text?: string): string[] {
  const list = promises(d);
  if (list.filter(p => p.status === 'en_cours').length >= 4) return ['Trop de promesses en cours : on ne vous croirait plus'];
  const fresh = PROMISE_TEXTS[domain].filter(x => !list.some(p => p.text === x && p.status === 'en_cours'));
  const t = text ?? rng.pick(fresh.length ? fresh : PROMISE_TEXTS[domain]);
  list.push({ id: nextId(d, 'prom'), text: t, domain, madeWeek: d.week, dueWeek: d.week + months, baseline: d.player.dossiers[domain].mastery, status: 'en_cours' });
  return [`Promesse : « ${t} »`];
}

export function promiseProgress(d: GameState, p: Promise): number {
  return clamp(((d.player.dossiers[p.domain].mastery - p.baseline) / PROMISE_GAIN) * 100);
}

/** Honorer une promesse (action dédiée) */
export function keepPromise(d: GameState, domain?: Domain): string[] {
  const p = promises(d).find(x => x.status === 'en_cours' && (!domain || x.domain === domain)) ?? promises(d).find(x => x.status === 'en_cours');
  if (!p) return ['Aucune promesse en cours'];
  p.baseline -= PROMISE_GAIN / 2;
  return [`« ${p.text} » : la moitié du chemin est faite`];
}

/** Chaque mois : échéances et bilan de mi-parcours */
export function monthlyPromises(d: GameState): void {
  const list = promises(d);
  const s = d.player.stats;
  for (const p of list.filter(x => x.status === 'en_cours')) {
    const kept = promiseProgress(d, p) >= 100;
    if (kept || d.week >= p.dueWeek) {
      p.status = kept ? 'tenue' : 'trahie';
      if (kept) { s.credibility = clamp(s.credibility + 5); s.popularity = clamp(s.popularity + 3); }
      else { s.credibility = clamp(s.credibility - 6); s.popularity = clamp(s.popularity - 4); }
      pushNews(d, 'actu', kept ? 'positive' : 'negative', kept ? `Promesse tenue : « ${p.text} »` : `Promesse trahie : « ${p.text} »`,
        kept ? `Dossier ${DOMAIN_LABELS[p.domain].toLowerCase()} : engagement respecté. Crédibilité +5, popularité +3.` : 'La presse ressort la vidéo de votre engagement. Crédibilité −6, popularité −4.');
    }
  }
  // Bilan de mi-parcours, tous les deux ans et demi
  if (d.week % 30 === 0 && list.length) {
    const kept = list.filter(x => x.status === 'tenue').length;
    const broken = list.filter(x => x.status === 'trahie').length;
    const open = list.filter(x => x.status === 'en_cours').length;
    if (kept + broken + open) pushNews(d, 'actu', kept >= broken ? 'positive' : 'negative', 'Le bilan de vos promesses',
      `${kept} tenue${kept > 1 ? 's' : ''}, ${broken} trahie${broken > 1 ? 's' : ''}, ${open} en cours. Les éditorialistes font les comptes.`);
  }
  if (list.length > 20) d.promises = list.filter(x => x.status === 'en_cours').concat(list.filter(x => x.status !== 'en_cours').slice(-12));
}

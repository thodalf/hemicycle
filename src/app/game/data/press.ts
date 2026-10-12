import { OutletKind, PressState } from '../models/game.models';

/* ============================================================
 *  Scénario « Éditorialiste » : médias fictifs, grades,
 *  salaires et conditions de promotion.
 * ============================================================ */

export interface OutletDef {
  kind: OutletKind;
  name: string;
  label: string;
  owner: string;
  ligne: number;
  /** Multiplicateurs : la télé fait l'audience, la presse écrite la réputation */
  audienceMult: number;
  reputationMult: number;
  pitch: string;
}

export const OUTLETS: Record<OutletKind, OutletDef> = {
  presse: {
    kind: 'presse', name: 'Le Courrier national', label: 'Presse écrite', owner: 'le groupe Delacroix-Ferrand', ligne: 10,
    audienceMult: 0.8, reputationMult: 1.25,
    pitch: 'Un grand quotidien du soir. La réputation s’y gagne vite, l’audience plus lentement.',
  },
  tv: {
    kind: 'tv', name: 'Info24', label: 'Chaîne d’info', owner: 'le milliardaire Gérald Morvan', ligne: 35,
    audienceMult: 1.3, reputationMult: 0.8,
    pitch: 'Une chaîne d’info en continu. L’audience explose, la réputation souffre, le propriétaire a des idées.',
  },
  radio: {
    kind: 'radio', name: 'Radio Hexagone', label: 'Radio', owner: 'la coopérative Hexagone Médias', ligne: -15,
    audienceMult: 1, reputationMult: 1,
    pitch: 'La matinale la plus écoutée du pays. Un équilibre entre audience et sérieux.',
  },
};

export const PRESS_GRADES = ['Pigiste', 'Chroniqueur·se', 'Éditorialiste', 'Éditorialiste vedette', 'Directeur·rice de la rédaction'];
export const PRESS_SALARIES = [350, 700, 1300, 2500, 4000];

/** Conditions pour passer au grade suivant */
export const PRESS_REQUIREMENTS: { audience: number; reputation: number; scoops: number; influence?: number }[] = [
  { audience: 28, reputation: 36, scoops: 0 },
  { audience: 40, reputation: 46, scoops: 1 },
  { audience: 52, reputation: 56, scoops: 3 },
  { audience: 62, reputation: 64, scoops: 5, influence: 45 },
];

export function createPress(kind: OutletKind, week: number, grade = 0): PressState {
  const o = OUTLETS[kind];
  return {
    kind, outlet: o.name, owner: o.owner, grade,
    audience: 15, reputation: 30, independance: 60, ligne: o.ligne,
    salary: PRESS_SALARIES[grade], scoops: 0, since: week,
  };
}

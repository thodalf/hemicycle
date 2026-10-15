import { Pipe, PipeTransform } from '@angular/core';
import { royalize } from '../../engine/office';

/**
 * Sous la Couronne, l'exécutif se dit en termes royaux (président → roi, Élysée → Palais).
 * Argument : null hors monarchie, sinon true pour une reine, false pour un roi.
 */
@Pipe({ name: 'royal' })
export class RoyalPipe implements PipeTransform {
  transform(text: string | null | undefined, fem: boolean | null): string {
    if (!text) return text ?? '';
    return fem === null ? text : royalize(text, fem);
  }
}

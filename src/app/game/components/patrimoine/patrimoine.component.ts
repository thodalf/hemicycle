import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, output, signal } from '@angular/core';
import { STAT_LABELS, StatKey } from '../../models/game.models';
import { ASSET_CATEGORY_LABELS, AssetCategory, AssetDef } from '../../data/assets';
import { GameStateService } from '../../services/game-state.service';
import { PatrimoineService } from '../../services/patrimoine.service';

/** Écran du patrimoine : biens possédés, boutique, image publique */
@Component({
  selector: 'app-patrimoine',
  imports: [DecimalPipe],
  templateUrl: './patrimoine.component.html',
  styleUrl: './patrimoine.component.scss',
})
export class PatrimoineComponent {
  protected readonly game = inject(GameStateService);
  protected readonly svc = inject(PatrimoineService);
  readonly closed = output<void>();

  protected readonly categories = Object.entries(ASSET_CATEGORY_LABELS) as [AssetCategory, string][];
  protected readonly category = signal<AssetCategory>('quotidien');
  protected readonly shop = computed(() => this.svc.catalogue.filter(a => a.category === this.category()));
  protected readonly dots = [0, 1, 2, 3, 4];

  protected perks(def: AssetDef): string[] {
    const k = def.perks;
    const out: string[] = [];
    const n = (v: number) => (v > 0 ? '+' : '−') + Math.abs(v).toLocaleString('fr-FR');
    if (k.ap) out.push(`${n(k.ap)} PA/mois`);
    if (k.energy) out.push(`${n(k.energy)} énergie/mois`);
    if (k.stress) out.push(`${n(k.stress)} stress/mois`);
    if (k.influence) out.push(`${n(k.influence)} influence/mois`);
    if (k.popularity) out.push(`${n(k.popularity)} popularité/mois`);
    if (k.credibility) out.push(`${n(k.credibility)} crédibilité/mois`);
    if (k.rent) out.push(`${n(k.rent)} €/mois de revenus`);
    if (k.dossierDecay) out.push(`−${Math.round((1 - k.dossierDecay) * 100)} % d’oubli des dossiers`);
    for (const e of def.onBuy ?? []) {
      if (e.kind === 'stat') out.push(`À l’achat : ${n(e.delta)} ${STAT_LABELS[e.stat as StatKey].toLowerCase()}`);
      if (e.kind === 'dossier') out.push(`À l’achat : ${n(e.delta)} dossier territoires`);
    }
    if (def.volatility >= 0.02) out.push('Valeur très variable');
    else if (def.drift > 0) out.push(`Prend ~${Math.round(def.drift * 100)} %/an`);
    else if (def.drift < 0) out.push('Perd de la valeur');
    return out;
  }

  protected signed(v: number): string {
    return `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v)).toLocaleString('fr-FR')}`;
  }

  protected perWeek(v: number): string {
    if (!v) return 'sans effet sur l’opinion';
    return `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} popularité/mois`;
  }

  protected gain(a: { value: number; boughtPrice: number }): number {
    return a.value - a.boughtPrice;
  }
}

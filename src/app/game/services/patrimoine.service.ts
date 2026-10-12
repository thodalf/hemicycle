import { Injectable, computed, inject } from '@angular/core';
import { OwnedAsset } from '../models/game.models';
import { ASSETS, AssetDef } from '../data/assets';
import {
  assetDef, assetsDebt, assetsValue, buyAsset, canBuy, mortgagePayment, netWorth, salePrice, sellAsset, wealthImage, weeklyCharges,
  MORTGAGE_DOWN,
} from '../engine/patrimoine';
import { applyEffects } from '../engine/effects';
import { GameStateService } from './game-state.service';

/** Achats et ventes de biens personnels (immédiats, hors agenda) */
@Injectable({ providedIn: 'root' })
export class PatrimoineService {
  private readonly game = inject(GameStateService);

  readonly catalogue = ASSETS;
  readonly owned = computed(() => this.game.s().player.assets);
  readonly value = computed(() => assetsValue(this.game.s()));
  readonly debt = computed(() => assetsDebt(this.game.s()));
  readonly net = computed(() => netWorth(this.game.s()));
  readonly charges = computed(() => weeklyCharges(this.game.s()));
  readonly image = computed(() => wealthImage(this.game.s()));

  def(a: OwnedAsset): AssetDef { return assetDef(a); }
  canBuy(def: AssetDef, mortgage = false) { return canBuy(this.game.s(), def, mortgage); }
  downPayment(def: AssetDef): number { return Math.round(def.price * MORTGAGE_DOWN); }
  payment(def: AssetDef): number { return mortgagePayment(def); }
  salePrice(a: OwnedAsset): number { return salePrice(a); }
  count(def: AssetDef): number { return this.owned().filter(a => a.defId === def.id).length; }

  /** Image si l'on achetait ce bien : utile pour décider */
  previewImage(def: AssetDef) {
    // Acheter convertit des fonds en bien : seul l'affichage (ostentation) change
    return wealthImage(this.game.s(), def.ostentation);
  }

  buy(defId: string, mortgage: boolean): void {
    this.game.mutate((d, rng) => {
      const done = buyAsset(d, defId, mortgage);
      const def = ASSETS.find(a => a.id === defId);
      if (done.length && def?.onBuy) applyEffects(d, def.onBuy, {}, rng);
    });
  }

  sell(uid: string): void {
    this.game.mutate(d => { sellAsset(d, uid); });
  }
}

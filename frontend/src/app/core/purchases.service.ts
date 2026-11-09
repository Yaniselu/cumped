import { Injectable, computed, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Api } from './api.service';
import { ServerConfig } from './models';

/**
 * Reguli de magazin: în aplicațiile iOS/Android, serviciile digitale (abonamente, promovări, anunțuri extra)
 * se pot vinde doar prin In-App Purchase (Apple 3.1.1, Google Play Payments). Până când produsele IAP sunt
 * configurate (config.inAppPurchases), ascundem cumpărarea în aplicația nativă și nu trimitem spre plata web.
 * Plata sigură pentru produse fizice între utilizatori nu intră sub aceste reguli.
 */
@Injectable({ providedIn: 'root' })
export class Purchases {
  private api = inject(Api);
  readonly native = Capacitor.isNativePlatform();
  readonly config = signal<ServerConfig | null>(null);
  readonly allowed = computed(() => !this.native || !!this.config()?.inAppPurchases);

  constructor() { this.api.config().then((c) => this.config.set(c)).catch(() => {}); }
}

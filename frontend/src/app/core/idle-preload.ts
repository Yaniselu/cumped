import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Observable, firstValueFrom, from, of } from 'rxjs';

/**
 * Restul ecranelor se descarcă în fundal abia după ce pagina curentă e afișată și telefonul e liber,
 * câte unul pe rând, ca să nu concureze cu pozele și codul paginii deschise.
 * Cu „Economisire date” sau pe 2G nu descărcăm nimic în avans. Rutele cu `data: { preload: false }` se sar.
 */
@Injectable({ providedIn: 'root' })
export class IdlePreload implements PreloadingStrategy {
  private queue: Promise<unknown> = new Promise((r) => setTimeout(r, Capacitor.isNativePlatform() ? 600 : 2500));

  preload(route: Route, load: () => Observable<any>): Observable<any> {
    const conn = (navigator as any).connection;
    if (route.data?.['preload'] === false || conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType ?? '')) return of(null);
    const done = this.queue.then(idle).then(() => firstValueFrom(load(), { defaultValue: null })).catch(() => null);
    this.queue = done;
    return from(done);
  }
}

function idle(): Promise<void> {
  return new Promise((resolve) => {
    const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
    if (ric) ric(() => resolve(), { timeout: 4000 });
    else setTimeout(resolve, 200);
  });
}

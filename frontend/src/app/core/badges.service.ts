import { Injectable, effect, inject, signal } from '@angular/core';
import { Api } from './api.service';
import { AuthService } from './auth.service';

/** Contoare pentru mesaje, notificări și oferte noi (reîmprospătate periodic). */
@Injectable({ providedIn: 'root' })
export class Badges {
  private api = inject(Api);
  private auth = inject(AuthService);
  readonly counts = signal({ notifications: 0, messages: 0, offers: 0 });
  private timer: any;

  constructor() {
    effect(() => {
      clearInterval(this.timer);
      if (this.auth.loggedIn()) {
        this.refresh();
        this.timer = setInterval(() => this.refresh(), 20000);
      } else {
        this.counts.set({ notifications: 0, messages: 0, offers: 0 });
      }
    });
  }

  async refresh() {
    if (document.hidden || !this.auth.loggedIn()) return;
    try { this.counts.set(await this.api.badges()); } catch { /* ignorăm erorile temporare */ }
  }
}

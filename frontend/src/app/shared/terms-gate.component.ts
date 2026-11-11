import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { IonIcon } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { TPipe } from '../core/i18n.service';
import { Purchases } from '../core/purchases.service';
import { Ui } from '../core/ui.service';

/** Când publicăm o versiune nouă a termenilor, utilizatorii autentificați trebuie să o accepte explicit. */
@Component({
  selector: 'cmp-terms-gate',
  imports: [IonIcon, RouterLink, TPipe],
  template: `
    @if (show()) {
      <div class="gate fade" role="dialog" aria-modal="true" aria-labelledby="tg-title">
        <div class="box card pad">
          <span class="ic"><ion-icon name="document-text-outline"></ion-icon></span>
          <h2 id="tg-title">{{ 'legal.newTerms' | t }}</h2>
          <p class="muted">{{ 'legal.newTermsSub' | t }}</p>
          <div class="links">
            <a routerLink="/legal/terms">{{ 'legal.terms' | t }}</a>
            <a routerLink="/legal/privacy">{{ 'legal.privacy' | t }}</a>
            <a routerLink="/legal/rules">{{ 'legal.rules' | t }}</a>
          </div>
          <button class="btn block" [disabled]="busy()" (click)="accept()">{{ 'legal.acceptNew' | t }}</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .gate { position: fixed; inset: 0; z-index: 9800; display: grid; place-items: center; padding: 20px; background: rgba(8, 8, 14, .55); backdrop-filter: blur(6px); }
    .box { width: min(440px, 100%); display: flex; flex-direction: column; gap: 12px; text-align: center; align-items: center; }
    .ic { width: 64px; height: 64px; border-radius: 22px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-size: 30px; }
    .links { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 14px; font-weight: 600; font-size: 15px; }
  `],
})
export class TermsGateComponent {
  private auth = inject(AuthService);
  private api = inject(Api);
  private ui = inject(Ui);
  private purchases = inject(Purchases);
  busy = signal(false);
  /** Cât timp utilizatorul citește documentele (/legal/…), poarta se ascunde; revine când iese de acolo. */
  private url = signal(location.pathname);
  show = computed(() => {
    const u = this.auth.user(), v = this.purchases.config()?.termsVersion;
    return !!u && !!v && u.termsVersion !== v && !this.url().startsWith('/legal');
  });

  constructor() {
    inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => this.url.set((e as NavigationEnd).urlAfterRedirects));
  }

  async accept() {
    this.busy.set(true);
    try { this.auth.setUser(await this.api.acceptTerms()); } catch (e) { this.ui.error(e); }
    this.busy.set(false);
  }
}

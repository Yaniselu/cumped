import { Component, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { filter, take } from 'rxjs';
import { TabBarComponent } from './shared/tab-bar.component';
import { TopNavComponent } from './shared/top-nav.component';
import { TermsGateComponent } from './shared/terms-gate.component';
import { PushService } from './core/push.service';

const NO_CHROME = ['/welcome', '/login', '/register', '/chat/', '/sell', '/support'];

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet, TabBarComponent, TopNavComponent, TermsGateComponent],
  template: `
    <ion-app>
      @if (!bare()) { <cmp-top-nav /> }
      <ion-router-outlet [animated]="true"></ion-router-outlet>
      <cmp-tab-bar [url]="url()" [hidden]="bare() || detail()" />
      <cmp-terms-gate />
    </ion-app>
  `,
})
export class App {
  private router = inject(Router);
  /** Pornește alertele (push) imediat ce utilizatorul e autentificat. */
  private push = inject(PushService);
  url = signal('/');
  bare = signal(false);
  detail = signal(false);

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      const u = (e as NavigationEnd).urlAfterRedirects;
      this.url.set(u);
      this.bare.set(NO_CHROME.some((p) => u.startsWith(p)));
      this.detail.set(u.startsWith('/listing/'));
    });
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError), take(1))
      .subscribe(() => requestAnimationFrame(() => requestAnimationFrame(() => dismissBoot())));
  }
}

/**
 * Ecranul de pornire din index.html acoperă doar timpul de încărcare. Prima dată în sesiune lăsăm animația de brand
 * să se termine (cel mult 1,5 s de la deschidere), apoi logo-ul „intră” în aplicație; la reîncărcări dispare imediat.
 */
function dismissBoot() {
  const el = document.getElementById('boot');
  if (!el) return;
  const first = !sessionStorage.getItem('cmp_splash');
  sessionStorage.setItem('cmp_splash', '1');
  if (!first || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.remove(); return; }
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 700);
  }, Math.max(0, 1500 - performance.now()));
}

import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { filter } from 'rxjs';
import { TabBarComponent } from './shared/tab-bar.component';
import { TopNavComponent } from './shared/top-nav.component';

const NO_CHROME = ['/welcome', '/login', '/register', '/chat/', '/sell', '/support'];

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet, TabBarComponent, TopNavComponent],
  template: `
    <ion-app>
      @if (!bare()) { <cmp-top-nav /> }
      <ion-router-outlet [animated]="true"></ion-router-outlet>
      <cmp-tab-bar [url]="url()" [hidden]="bare() || detail()" />
    </ion-app>
  `,
})
export class App {
  private router = inject(Router);
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
  }
}

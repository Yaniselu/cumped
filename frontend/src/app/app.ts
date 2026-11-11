import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { filter } from 'rxjs';
import { LogoComponent } from './shared/logo.component';
import { TabBarComponent } from './shared/tab-bar.component';
import { TopNavComponent } from './shared/top-nav.component';
import { TermsGateComponent } from './shared/terms-gate.component';

const NO_CHROME = ['/welcome', '/login', '/register', '/chat/', '/sell', '/support'];

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet, TabBarComponent, TopNavComponent, LogoComponent, TermsGateComponent],
  template: `
    <ion-app>
      @if (!bare()) { <cmp-top-nav /> }
      <ion-router-outlet [animated]="true"></ion-router-outlet>
      <cmp-tab-bar [url]="url()" [hidden]="bare() || detail()" />
      <cmp-terms-gate />
      @if (splash()) {
        <div class="splash" (animationend)="splashDone($event)">
          <div class="halo"></div>
          <div class="mark"><cmp-logo [size]="108" [animate]="true" /></div>
          <div class="word">Cumped</div>
          <div class="tag"><span>Vinde.</span><span>Cumpără.</span><span>Fără frică.</span></div>
        </div>
      }
    </ion-app>
  `,
  styles: [`
    .splash { position: fixed; inset: 0; z-index: 10000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
      background: radial-gradient(60% 50% at 50% 40%, #241a5e 0%, #0b0a12 70%); animation: splashOut .7s 1.9s cubic-bezier(.6,0,.4,1) forwards; }
    .halo { position: absolute; width: 360px; height: 360px; border-radius: 50%; background: conic-gradient(from 0deg, #5b3df5, #ff5a4e, #7b5cff, #5b3df5);
      filter: blur(60px); opacity: .45; animation: spinSlow 6s linear infinite; }
    .mark { position: relative; animation: pop .9s var(--spring) both; }
    .word { position: relative; font-family: var(--font-display); font-weight: 700; font-size: 38px; letter-spacing: -0.03em; color: #fff;
      animation: wordIn .8s .45s var(--spring) both; }
    .tag { position: relative; display: flex; gap: 8px; color: rgba(255,255,255,.72); font-size: 16px; font-weight: 550; }
    .tag span { animation: wordIn .7s var(--spring) both; } .tag span:nth-child(1) { animation-delay: .75s; } .tag span:nth-child(2) { animation-delay: .9s; } .tag span:nth-child(3) { animation-delay: 1.05s; color: #ff8a7f; }
  `],
})
export class App {
  private router = inject(Router);
  url = signal('/');
  bare = signal(false);
  detail = signal(false);
  splash = signal(!sessionStorage.getItem('cmp_splash') && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      const u = (e as NavigationEnd).urlAfterRedirects;
      this.url.set(u);
      this.bare.set(NO_CHROME.some((p) => u.startsWith(p)));
      this.detail.set(u.startsWith('/listing/'));
    });
  }

  splashDone(ev: AnimationEvent) {
    if (ev.animationName === 'splashOut') { sessionStorage.setItem('cmp_splash', '1'); this.splash.set(false); }
  }
}

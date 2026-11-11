import { MOTION } from '../shared/motion.directives';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { AuthService } from '../core/auth.service';
import { TPipe } from '../core/i18n.service';
import { BackButtonComponent } from '../shared/back-button.component';

/** De ce Cumped: beneficiile concrete, explicate simplu. */
@Component({
  selector: 'page-why',
  imports: [MOTION, IonContent, IonIcon, RouterLink, TPipe, BackButtonComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <div class="page narrow">
        <div class="topbar"><cmp-back fallback="/home" /><div class="title">{{ 'why.title' | t }}</div><div class="spacer"></div></div>
        <header class="intro">
          <h1>{{ 'why.headline' | t }}</h1>
          <p>{{ 'why.sub' | t }}</p>
        </header>

        <section class="flow card" id="protection">
          <h2><ion-icon name="shield-checkmark"></ion-icon>{{ 'why.flowTitle' | t }}</h2>
          <ol>
            <li><span>1</span><div><b>{{ 'why.f1' | t }}</b><p>{{ 'why.f1t' | t }}</p></div></li>
            <li><span>2</span><div><b>{{ 'why.f2' | t }}</b><p>{{ 'why.f2t' | t }}</p></div></li>
            <li><span>3</span><div><b>{{ 'why.f3' | t }}</b><p>{{ 'why.f3t' | t }}</p></div></li>
          </ol>
          <p class="note">{{ 'why.flowNote' | t }}</p>
        </section>

        <div class="list">
          @for (b of benefits; track b.k; let i = $index) {
            <div class="b card rv" [style.--i]="i % 4">
              <span class="ic"><ion-icon [name]="b.icon"></ion-icon></span>
              <div><h3>{{ 'why.b.' + b.k | t }}</h3><p>{{ 'why.b.' + b.k + 'T' | t }}</p></div>
            </div>
          }
        </div>

        <div class="cta">
          @if (auth.loggedIn()) { <a class="btn block accent" routerLink="/sell"><ion-icon name="add"></ion-icon>{{ 'why.ctaSell' | t }}</a> }
          @else { <a class="btn block accent" routerLink="/register">{{ 'why.ctaJoin' | t }}</a> }
          <a class="btn block light" routerLink="/search"><ion-icon name="search"></ion-icon>{{ 'why.ctaBrowse' | t }}</a>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    .intro { margin: 6px 4px 18px; } .intro h1 { font-size: clamp(28px, 8vw, 36px); } .intro p { margin-top: 10px; font-size: 17px; color: var(--text-2); }
    .flow { padding: 20px 18px; background: var(--ok-soft); border-color: transparent; }
    .flow h2 { display: flex; align-items: center; gap: 10px; font-size: 20px; } .flow h2 ion-icon { color: var(--ok); font-size: 26px; }
    .flow ol { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
    .flow li { display: flex; gap: 12px; } .flow li > span { flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
      background: var(--ok); color: #fff; font-weight: 800; }
    .flow b { font-size: 16.5px; } .flow p { font-size: 15px; color: var(--text); margin-top: 2px; }
    .note { margin-top: 14px !important; font-size: 14px !important; color: var(--text-2) !important; }
    .list { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
    .b { display: flex; gap: 14px; padding: 16px; align-items: flex-start; }
    .ic { flex: 0 0 auto; width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-size: 24px; }
    .b h3 { font-size: 17px; } .b p { margin-top: 4px; font-size: 15px; color: var(--text-2); }
    .cta { display: flex; flex-direction: column; gap: 10px; margin: 22px 0 10px; }
  `],
})
export class WhyPage {
  auth = inject(AuthService);
  benefits = [
    { k: 'verified', icon: 'id-card-outline' }, { k: 'antiScam', icon: 'chatbubbles-outline' }, { k: 'fairPrice', icon: 'sparkles' },
    { k: 'aiListing', icon: 'camera-outline' }, { k: 'negotiate', icon: 'swap-vertical' }, { k: 'alerts', icon: 'notifications-outline' },
    { k: 'responsive', icon: 'time-outline' }, { k: 'world', icon: 'globe-outline' }, { k: 'fees', icon: 'cash-outline' },
    { k: 'privacy', icon: 'eye-off-outline' }, { k: 'help', icon: 'headset-outline' },
  ];
}

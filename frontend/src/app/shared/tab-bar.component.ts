import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { AuthService } from '../core/auth.service';
import { Badges } from '../core/badges.service';
import { TPipe } from '../core/i18n.service';

/** Bara de jos plutitoare, din sticlă, cu butonul central „Vinde” (ca în design). */
@Component({
  selector: 'cmp-tab-bar',
  imports: [RouterLink, IonIcon, TPipe],
  template: `
    <nav class="tabbar glass" [class.hidden]="hidden()">
      <a routerLink="/home" class="tab" [class.active]="active() === 'home'" aria-label="Home"><ion-icon [name]="active() === 'home' ? 'home' : 'home-outline'"></ion-icon></a>
      <a routerLink="/search" class="tab" [class.active]="active() === 'search'" aria-label="Search"><ion-icon name="search"></ion-icon></a>
      <a routerLink="/sell" class="sell press"><ion-icon name="add-circle"></ion-icon><span>{{ 'nav.sell' | t }}</span></a>
      <a [routerLink]="auth.loggedIn() ? '/chats' : '/login'" class="tab" [class.active]="active() === 'chats'" aria-label="Messages">
        <ion-icon [name]="active() === 'chats' ? 'chatbubbles' : 'chatbubble-outline'"></ion-icon>
        @if (badges.counts().messages) { <span class="count">{{ badges.counts().messages }}</span> }
      </a>
      <a [routerLink]="auth.loggedIn() ? '/profile' : '/login'" class="tab" [class.active]="active() === 'profile'" aria-label="Profile">
        <ion-icon [name]="active() === 'profile' ? 'person' : 'person-outline'"></ion-icon>
        @if (badges.counts().notifications + badges.counts().offers) { <span class="dot"></span> }
      </a>
    </nav>
  `,
  styles: [`
    .tabbar { position: fixed; left: 50%; bottom: calc(env(safe-area-inset-bottom) + 16px); transform: translateX(-50%); z-index: 50;
      display: flex; align-items: center; gap: 6px; padding: 7px; border-radius: 999px; transition: transform .5s var(--spring), opacity .3s; }
    .tabbar.hidden { transform: translate(-50%, 140%); opacity: 0; pointer-events: none; }
    .tab { position: relative; width: 50px; height: 50px; border-radius: 50%; display: grid; place-items: center; color: var(--text-2);
      background: var(--surface); border: 1px solid var(--line); transition: all .35s var(--spring); }
    .tab ion-icon { font-size: 21px; }
    .tab.active { color: var(--text); transform: translateY(-2px); box-shadow: 0 8px 18px -10px rgba(0,0,0,.5); }
    .tab:active { transform: scale(.88); }
    .sell { display: flex; align-items: center; gap: 8px; height: 50px; padding: 0 20px 0 16px; border-radius: 999px; color: var(--btn-dark-text);
      background: var(--btn-dark); box-shadow: var(--btn-dark-shadow); font-weight: 650; font-size: 15px; }
    .sell ion-icon { font-size: 22px; }
    .count { position: absolute; top: -3px; right: -3px; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 999px; background: var(--accent-2);
      color: #fff; font-size: 11px; font-weight: 700; display: grid; place-items: center; border: 2px solid var(--surface); animation: pop .5s var(--spring); }
    .dot { position: absolute; top: 9px; right: 10px; width: 9px; height: 9px; border-radius: 50%; background: var(--accent-2); border: 2px solid var(--surface); }
    @media (min-width: 992px) { .tabbar { display: none; } }
  `],
})
export class TabBarComponent {
  auth = inject(AuthService);
  badges = inject(Badges);
  url = input('');
  hidden = input(false);
  active = computed(() => {
    const u = this.url();
    if (u.startsWith('/home')) return 'home';
    if (u.startsWith('/search')) return 'search';
    if (u.startsWith('/chats')) return 'chats';
    if (u.startsWith('/profile')) return 'profile';
    return '';
  });
}

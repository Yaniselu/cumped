import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { AuthService } from '../core/auth.service';
import { Badges } from '../core/badges.service';
import { I18n, TPipe } from '../core/i18n.service';
import { AvatarComponent } from './avatar.component';
import { LogoComponent } from './logo.component';

/** Meniul de sus pentru site (ecrane mari). */
@Component({
  selector: 'cmp-top-nav',
  imports: [RouterLink, RouterLinkActive, IonIcon, FormsModule, TPipe, LogoComponent, AvatarComponent],
  template: `
    <header class="top glass">
      <a routerLink="/home" class="brand"><cmp-logo [size]="38" [wordmark]="true" /></a>
      <form class="searchbar sb" (ngSubmit)="go()">
        <ion-icon name="search"></ion-icon>
        <input [(ngModel)]="q" name="q" [placeholder]="'search.placeholder' | t" />
      </form>
      <nav class="links">
        <a routerLink="/favorites" routerLinkActive="on" class="icon-btn" [attr.aria-label]="'nav.favorites' | t"><ion-icon name="heart-outline"></ion-icon></a>
        <a [routerLink]="auth.loggedIn() ? '/chats' : '/login'" routerLinkActive="on" class="icon-btn" [attr.aria-label]="'nav.chats' | t">
          <ion-icon name="chatbubble-outline"></ion-icon>@if (badges.counts().messages) { <span class="dot"></span> }</a>
        <a [routerLink]="auth.loggedIn() ? '/notifications' : '/login'" routerLinkActive="on" class="icon-btn" [attr.aria-label]="'nav.notifications' | t">
          <ion-icon name="notifications-outline"></ion-icon>@if (badges.counts().notifications) { <span class="dot"></span> }</a>
        <a routerLink="/sell" class="btn sm"><ion-icon name="add-circle"></ion-icon>{{ 'nav.sell' | t }}</a>
        @if (auth.user(); as u) {
          <a routerLink="/profile" class="me"><cmp-avatar [name]="u.displayName" [hue]="u.avatarHue" [size]="42" [verified]="u.idVerified" /></a>
        } @else {
          <a routerLink="/login" class="btn sm light">{{ 'common.login' | t }}</a>
        }
      </nav>
    </header>
  `,
  styles: [`
    .top { position: fixed; top: calc(env(safe-area-inset-top) + 14px); left: max(14px, env(safe-area-inset-left) + 8px); right: max(14px, env(safe-area-inset-right) + 8px); margin: 0 auto; max-width: 1200px; z-index: 60;
      display: none; align-items: center; gap: 18px; padding: 10px 12px 10px 16px; border-radius: 999px; animation: fadeUp .7s var(--ease) both; }
    @media (min-width: 992px) { .top { display: flex; } }
    .brand { display: flex; color: inherit; }
    .sb { flex: 1; height: 46px; max-width: 520px; box-shadow: none; }
    .links { display: flex; align-items: center; gap: 8px; margin-left: auto; }
    .links .icon-btn { width: 44px; height: 44px; background: var(--surface); }
    .links .icon-btn.on { color: var(--accent); }
    .me { display: flex; }
  `],
})
export class TopNavComponent {
  auth = inject(AuthService);
  badges = inject(Badges);
  i18n = inject(I18n);
  private router = inject(Router);
  q = '';
  go() { this.router.navigate(['/search'], { queryParams: { q: this.q || null } }); }
}

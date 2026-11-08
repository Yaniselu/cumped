import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, NavController, ViewWillEnter } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Badges } from '../core/badges.service';
import { I18n, TPipe } from '../core/i18n.service';
import { Ui } from '../core/ui.service';
import { AvatarComponent } from '../shared/avatar.component';

@Component({
  selector: 'page-profile',
  imports: [IonContent, IonIcon, RouterLink, TPipe, AvatarComponent],
  template: `
    <ion-content [fullscreen]="true">
      @if (auth.user(); as u) {
        <div class="page narrow">
          <div class="topbar app-only"><h1>{{ 'profile.title' | t }}</h1><a class="icon-btn" routerLink="/settings"><ion-icon name="settings-outline"></ion-icon></a></div>

          <div class="hero card reveal">
            <div class="glow" [style.--h]="u.avatarHue"></div>
            <cmp-avatar [name]="u.displayName" [hue]="u.avatarHue" [size]="84" [verified]="u.idVerified" />
            <h2>{{ u.displayName }}</h2>
            <span class="muted small">&#64;{{ u.username }} · {{ 'profile.member' | t: { date: i18n.date(u.createdAt) } }}</span>
            @if (u.idVerified) {
              <div class="vbadge ok"><ion-icon name="shield-checkmark"></ion-icon>{{ 'profile.verified' | t }}</div>
              @if (u.legalName) { <span class="small faint">{{ 'profile.legalName' | t }}: {{ u.legalName }}</span> }
            } @else {
              <a routerLink="/verify" class="verifycta press"><ion-icon name="shield-checkmark-outline"></ion-icon><div><strong>{{ 'profile.verifyCta' | t }}</strong><span>{{ 'profile.verifySub' | t }}</span></div><ion-icon name="chevron-forward"></ion-icon></a>
            }
            <div class="kpis">
              <div><strong>{{ u.rating || '—' }}</strong><span>★ {{ 'profile.rating' | t }}</span></div>
              <div><strong>{{ u.quota.active }}/{{ u.quota.limit }}</strong><span>{{ 'profile.quota' | t }}</span></div>
              <div><strong>{{ u.plan }}</strong><span>{{ 'profile.plan' | t }}</span></div>
            </div>
          </div>

          <div class="invite card pad reveal" style="--i:1">
            <div class="row between"><div><h3><ion-icon name="gift-outline"></ion-icon> {{ 'profile.inviteTitle' | t }}</h3>
              <p class="muted small">{{ 'profile.inviteSub' | t: { n: u.quota.qualifiedReferrals, need: u.quota.referralsNeeded } }}</p></div></div>
            <div class="prog"><span [style.width.%]="(u.quota.qualifiedReferrals / u.quota.referralsNeeded) * 100"></span></div>
            <div class="code"><span>{{ u.referralCode }}</span><button class="btn sm" (click)="copy(u.referralCode)"><ion-icon name="copy-outline"></ion-icon>{{ 'profile.copyCode' | t }}</button></div>
          </div>

          <div class="menu card reveal" style="--i:2">
            <a routerLink="/my-listings"><ion-icon name="grid-outline"></ion-icon>{{ 'profile.myListings' | t }}<ion-icon name="chevron-forward" class="chev"></ion-icon></a>
            <a routerLink="/offers"><ion-icon name="pricetag-outline"></ion-icon>{{ 'profile.offers' | t }}@if (badges.counts().offers) { <span class="count">{{ badges.counts().offers }}</span> }<ion-icon name="chevron-forward" class="chev"></ion-icon></a>
            <a routerLink="/favorites"><ion-icon name="heart-outline"></ion-icon>{{ 'profile.favorites' | t }}<ion-icon name="chevron-forward" class="chev"></ion-icon></a>
            <a routerLink="/notifications"><ion-icon name="notifications-outline"></ion-icon>{{ 'nav.notifications' | t }}@if (badges.counts().notifications) { <span class="count">{{ badges.counts().notifications }}</span> }<ion-icon name="chevron-forward" class="chev"></ion-icon></a>
            <a routerLink="/stats"><ion-icon name="stats-chart-outline"></ion-icon>{{ 'profile.stats' | t }}<ion-icon name="chevron-forward" class="chev"></ion-icon></a>
            <a routerLink="/plans"><ion-icon name="rocket-outline"></ion-icon>{{ 'plans.title' | t }}<ion-icon name="chevron-forward" class="chev"></ion-icon></a>
          </div>
          <div class="menu card reveal" style="--i:3">
            <a routerLink="/support" class="velo"><span class="vic">V</span>{{ 'profile.support' | t }}<ion-icon name="chevron-forward" class="chev"></ion-icon></a>
            @if (!u.phoneVerified) { <a routerLink="/verify" [queryParams]="{ phone: 1 }"><ion-icon name="phone-portrait-outline"></ion-icon>{{ 'profile.phone' | t }}<ion-icon name="chevron-forward" class="chev"></ion-icon></a> }
            <a routerLink="/settings"><ion-icon name="settings-outline"></ion-icon>{{ 'profile.settings' | t }}<ion-icon name="chevron-forward" class="chev"></ion-icon></a>
            @if (auth.isAdmin()) { <a routerLink="/admin"><ion-icon name="shield-checkmark-outline"></ion-icon>{{ 'profile.admin' | t }}<ion-icon name="chevron-forward" class="chev"></ion-icon></a> }
            <button (click)="logout()" class="out"><ion-icon name="log-out-outline"></ion-icon>{{ 'profile.logout' | t }}</button>
          </div>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .topbar h1 { font-size: 32px; }
    .hero { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 28px 18px 18px; }
    .glow { position: absolute; top: -120px; left: 50%; width: 360px; height: 260px; transform: translateX(-50%); border-radius: 50%;
      background: radial-gradient(closest-side, hsl(var(--h) 90% 70% / .45), transparent); filter: blur(10px); animation: blob 10s ease-in-out infinite; }
    .hero > *:not(.glow) { position: relative; } .hero h2 { margin-top: 10px; font-size: 24px; }
    .vbadge { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; padding: 6px 12px; border-radius: 999px; font-weight: 650; font-size: 13px; }
    .vbadge.ok { background: var(--ok-soft); color: var(--ok); }
    .verifycta { display: flex; align-items: center; gap: 12px; width: 100%; margin-top: 12px; padding: 14px; border-radius: 20px; color: #fff; text-align: left;
      background: linear-gradient(135deg, #5b3df5, #8b6dff); box-shadow: 0 16px 34px -18px rgba(91,61,245,.8); }
    .verifycta div { flex: 1; display: flex; flex-direction: column; } .verifycta span { font-size: 12.5px; opacity: .85; } .verifycta ion-icon:first-child { font-size: 26px; }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: 100%; margin-top: 16px; }
    .kpis div { background: var(--surface-2); border-radius: 18px; padding: 12px 6px; display: flex; flex-direction: column; }
    .kpis strong { font-family: var(--font-display); font-size: 19px; } .kpis span { font-size: 11.5px; color: var(--text-2); }
    .invite { margin-top: 14px; } .invite h3 { display: flex; align-items: center; gap: 8px; } .invite h3 ion-icon { color: var(--accent-2); }
    .prog { height: 8px; border-radius: 99px; background: var(--surface-3); margin: 12px 0; overflow: hidden; }
    .prog span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--accent), var(--accent-2)); transition: width 1s var(--ease); }
    .code { display: flex; align-items: center; justify-content: space-between; padding: 6px 6px 6px 18px; border-radius: 999px; background: var(--surface-2); }
    .code span { font-family: var(--font-display); font-weight: 700; letter-spacing: .12em; font-size: 18px; }
    .menu { margin-top: 14px; padding: 6px; }
    .menu a, .menu button { display: flex; align-items: center; gap: 14px; width: 100%; padding: 14px 12px; border-radius: 16px; color: var(--text); font-weight: 550; font-size: 15px; background: none; border: 0; cursor: pointer; transition: background .2s; }
    .menu a:active, .menu button:active { background: var(--surface-2); }
    .menu ion-icon { font-size: 21px; color: var(--text-2); } .chev { margin-left: auto; font-size: 17px !important; color: var(--text-3) !important; }
    .count { margin-left: auto; min-width: 22px; height: 22px; border-radius: 99px; background: var(--accent-2); color: #fff; font-size: 12px; font-weight: 700; display: grid; place-items: center; padding: 0 6px; }
    .count + .chev { margin-left: 6px; }
    .vic { width: 26px; height: 26px; border-radius: 9px; display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 14px; background: linear-gradient(135deg, #5b3df5, #ff5a4e); }
    .out { color: var(--accent-2) !important; } .out ion-icon { color: var(--accent-2) !important; }
  `],
})
export class ProfilePage implements ViewWillEnter {
  auth = inject(AuthService);
  badges = inject(Badges);
  i18n = inject(I18n);
  private api = inject(Api);
  private ui = inject(Ui);
  private nav = inject(NavController);

  async ionViewWillEnter() { try { this.auth.setUser(await this.api.me()); } catch { /* ignore */ } this.badges.refresh(); }

  async copy(code: string) {
    const text = `${location.origin}/register?ref=${code}`;
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    this.ui.toast(this.i18n.t('common.copied'));
  }

  async logout() { await this.auth.logout(); this.nav.navigateRoot('/home'); }
}

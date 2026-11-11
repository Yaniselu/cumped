import { MOTION } from '../shared/motion.directives';
import { HoldButtonComponent } from '../shared/hold-button.component';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, NavController, ViewWillEnter } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, LANGUAGES, Lang, TPipe } from '../core/i18n.service';
import { Theme, ThemePref } from '../core/theme.service';
import { Ui } from '../core/ui.service';
import { BackButtonComponent } from '../shared/back-button.component';
import { AvatarComponent } from '../shared/avatar.component';
import { RouterLink } from '@angular/router';
import { PublicUser } from '../core/models';

@Component({
  selector: 'page-settings',
  imports: [MOTION, HoldButtonComponent, IonContent, IonIcon, FormsModule, TPipe, BackButtonComponent, AvatarComponent, RouterLink],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <div class="page narrow">
        <div class="topbar"><cmp-back fallback="/profile" /><div class="title">{{ 'settings.title' | t }}</div><div class="spacer"></div></div>

        <h3 class="sh">{{ 'settings.profile' | t }}</h3>
        <div class="card pad stack reveal">
          <div class="field"><label>{{ 'auth.username' | t }}</label><input class="input" [(ngModel)]="username" maxlength="20" /></div>
          <div class="field"><label>{{ 'settings.bio' | t }}</label><textarea class="input" [(ngModel)]="bio" maxlength="400" style="min-height:90px"></textarea></div>
          <div class="field"><label>{{ 'settings.city' | t }}</label><input class="input" [(ngModel)]="city" maxlength="80" /></div>
          <div class="field"><label>{{ 'settings.displayMode' | t }}</label>
            <div class="opts">
              <button class="opt" [class.on]="displayMode === 'USERNAME'" (click)="displayMode = 'USERNAME'"><ion-icon name="person-outline"></ion-icon>{{ 'settings.showUsername' | t }}</button>
              <button class="opt" [class.on]="displayMode === 'REAL_NAME'" [disabled]="!auth.user()?.idVerified" (click)="displayMode = 'REAL_NAME'"><ion-icon name="shield-checkmark-outline"></ion-icon>{{ 'settings.showRealName' | t }}</button>
            </div></div>
          <button class="btn block" (click)="saveProfile()">{{ 'common.save' | t }}</button>
        </div>

        <h3 class="sh" id="business">{{ 'biz.title' | t }}</h3>
        <div class="card pad stack reveal">
          <p class="muted small">{{ 'biz.sub' | t }}</p>
          <div class="seg in">
            <button [class.on]="acct === 'PRIVATE'" (click)="acct = 'PRIVATE'"><ion-icon name="person-outline"></ion-icon>{{ 'seller.private' | t }}</button>
            <button [class.on]="acct === 'BUSINESS'" (click)="acct = 'BUSINESS'"><ion-icon name="business-outline"></ion-icon>{{ 'seller.business' | t }}</button>
          </div>
          @if (acct === 'BUSINESS') {
            <div class="field fade"><label>{{ 'biz.name' | t }}</label><input class="input" [(ngModel)]="biz.name" maxlength="120" autocomplete="organization" /></div>
            <div class="two">
              <div class="field"><label>{{ 'biz.regNo' | t }}</label><input class="input" [(ngModel)]="biz.regNo" maxlength="40" /></div>
              <div class="field"><label>{{ 'biz.vat' | t }}</label><input class="input" [(ngModel)]="biz.vat" maxlength="30" /></div>
            </div>
            <div class="field"><label>{{ 'biz.address' | t }}</label><input class="input" [(ngModel)]="biz.address" maxlength="250" autocomplete="street-address" /></div>
            <div class="two">
              <div class="field"><label>{{ 'biz.email' | t }}</label><input class="input" type="email" [(ngModel)]="biz.email" maxlength="254" autocomplete="email" /></div>
              <div class="field"><label>{{ 'biz.phone' | t }} <span class="faint">({{ 'common.optional' | t }})</span></label><input class="input" type="tel" [(ngModel)]="biz.phone" maxlength="30" autocomplete="tel" /></div>
            </div>
            <label class="chk"><input type="checkbox" [(ngModel)]="declare" /><span class="box"><ion-icon name="checkmark"></ion-icon></span><span>{{ 'biz.declare' | t }}</span></label>
          }
          <button class="btn block" [disabled]="acct === 'BUSINESS' && (!declare || !biz.name || !biz.regNo || !biz.address || !biz.email)" (click)="saveBusiness()">{{ 'common.save' | t }}</button>
        </div>

        <h3 class="sh">{{ 'settings.language' | t }}</h3>
        <div class="card pad reveal"><div class="langs">
          @for (l of languages; track l.code) { <button class="chip" [class.active]="i18n.lang() === l.code" (click)="setLang(l.code)">{{ l.flag }} {{ l.name }}</button> }
        </div></div>

        <h3 class="sh">{{ 'settings.theme' | t }}</h3>
        <div class="seg reveal">
          @for (t of themes; track t.v) { <button [class.on]="theme.pref() === t.v" (click)="theme.set(t.v)"><ion-icon [name]="t.icon"></ion-icon>{{ 'settings.' + t.v | t }}</button> }
        </div>

        <h3 class="sh">{{ 'settings.textSize' | t }}</h3>
        <div class="seg reveal ts">
          @for (t of textSizes; track t.v) { <button [class.on]="theme.textSize() === t.v" (click)="theme.setTextSize(t.v)" [style.font-size.px]="t.px">{{ 'settings.ts_' + t.v | t }}</button> }
        </div>
        <p class="faint small tsprev">{{ 'settings.textPreview' | t }}</p>

        <div class="card toggles reveal lite">
          <div class="toggle-row"><span><ion-icon name="flash-outline"></ion-icon><span><b>{{ 'settings.lite' | t }}</b><small>{{ 'settings.liteSub' | t }}</small></span></span>
            <button class="switch" role="switch" [attr.aria-checked]="theme.lite()" [class.on]="theme.lite()" (click)="theme.setLite(theme.lite() ? 'off' : 'on')"></button></div>
        </div>

        <h3 class="sh">{{ 'settings.security' | t }}</h3>
        <div class="card pad stack reveal">
          @if (auth.user()?.hasPassword) { <div class="field"><label>{{ 'settings.current' | t }}</label><input class="input" type="password" [(ngModel)]="current" autocomplete="current-password" /></div> }
          <div class="field"><label>{{ 'settings.newPassword' | t }}</label><input class="input" type="password" [(ngModel)]="newPassword" autocomplete="new-password" /><span class="hint">{{ 'auth.passwordHint' | t }}</span></div>
          <button class="btn light block" [disabled]="newPassword.length < 10" (click)="changePassword()"><ion-icon name="lock-closed-outline"></ion-icon>{{ 'settings.changePassword' | t }}</button>
          <button class="btn ghost block" (click)="logoutAll()"><ion-icon name="log-out-outline"></ion-icon>{{ 'settings.logoutAll' | t }}</button>
        </div>

        <h3 class="sh">{{ 'block.list' | t }}</h3>
        <div class="card pad reveal">
          @if (!blocked().length) { <p class="muted small">{{ 'block.empty' | t }}</p> }
          @for (u of blocked(); track u.id) {
            <div class="buser"><cmp-avatar [name]="u.displayName" [hue]="u.avatarHue" [size]="36" [verified]="u.idVerified" /><span>{{ u.displayName }}</span>
              <button class="btn sm light" (click)="unblock(u)">{{ 'block.unblock' | t }}</button></div>
          }
        </div>

        <h3 class="sh">{{ 'settings.privacy' | t }}</h3>
        <div class="card pad stack reveal">
          <button class="btn light block" (click)="exportData()"><ion-icon name="download-outline"></ion-icon>{{ 'settings.exportData' | t }}</button>
          <p class="faint small">{{ 'settings.deleteInfo' | t }}</p>
          <cmp-hold-button tone="danger" [block]="true" [caption]="true" icon="trash-outline" [duration]="1500" [busy]="deleting()" [label]="'settings.deleteAccount' | t"
            [confirmText]="'settings.deleteConfirm' | t" (confirmed)="deleteAccount()" />
        </div>

        <h3 class="sh">{{ 'settings.legal' | t }}</h3>
        <div class="card menu reveal">
          @for (d of legalDocs; track d) { <a [routerLink]="['/legal', d]"><span>{{ 'legal.' + d | t }}</span><ion-icon name="chevron-forward"></ion-icon></a> }
        </div>
        <p class="faint small center">Cumped 0.1 · Velosyntech</p>
      </div>
    </ion-content>
  `,
  styles: [`
    .sh { margin: 24px 4px 10px; font-size: 16px; color: var(--text-2); }
    .opts { display: flex; flex-direction: column; gap: 8px; }
    .opt { display: flex; align-items: center; gap: 10px; padding: 14px; border-radius: 16px; border: 1.5px solid var(--line); background: var(--surface); color: var(--text); text-align: left; cursor: pointer; font-weight: 550; }
    .opt.on { border-color: var(--accent); background: var(--accent-soft); } .opt:disabled { opacity: .45; } .opt ion-icon { font-size: 20px; color: var(--accent); }
    .langs { display: flex; flex-wrap: wrap; gap: 8px; }
    .seg { display: flex; padding: 5px; border-radius: 999px; background: var(--surface); box-shadow: var(--shadow-card); }
    .seg button { flex: 1; height: 44px; border: 0; border-radius: 999px; background: transparent; font-weight: 600; color: var(--text-2); display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: all .3s var(--ease); }
    .seg button.on { background: var(--btn-dark); color: var(--btn-dark-text); }
    .center { text-align: center; margin-top: 24px; }
    .seg.in { box-shadow: none; background: var(--surface-2); }
    .tsprev { margin: 8px 6px 0; }
    .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr)); gap: 10px; }
    .chk { position: relative; display: flex; gap: 12px; align-items: flex-start; font-size: 14px; line-height: 1.45; color: var(--text-2); cursor: pointer; }
    .chk input { position: absolute; opacity: 0; width: 22px; height: 22px; margin: 0; }
    .box { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 7px; border: 2px solid var(--surface-3); background: var(--surface); display: grid; place-items: center; color: transparent; }
    .chk input:checked + .box { background: var(--accent); border-color: var(--accent); color: #fff; }
    .toggles { padding: 4px 14px; margin-top: 12px; } .toggles .toggle-row > span { display: flex; gap: 10px; align-items: flex-start; }
    .toggles .toggle-row > span > span { display: flex; flex-direction: column; gap: 2px; } .toggles small { font-size: 13px; color: var(--text-2); line-height: 1.35; }
    .toggles ion-icon { color: var(--accent); font-size: 20px; margin-top: 1px; }
    .buser { display: flex; align-items: center; gap: 10px; padding: 6px 0; } .buser span { flex: 1; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .menu { padding: 4px 0; } .menu a { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; color: var(--text); font-weight: 550; border-bottom: 1px solid var(--line); }
    .menu a:last-child { border-bottom: 0; } .menu ion-icon { color: var(--text-3); }
  `],
})
export class SettingsPage implements ViewWillEnter {
  auth = inject(AuthService);
  i18n = inject(I18n);
  theme = inject(Theme);
  private api = inject(Api);
  private ui = inject(Ui);
  private nav = inject(NavController);
  languages = LANGUAGES;
  themes: { v: ThemePref; icon: string }[] = [{ v: 'system', icon: 'phone-portrait-outline' }, { v: 'light', icon: 'sunny-outline' }, { v: 'dark', icon: 'moon-outline' }];
  username = this.auth.user()?.username ?? '';
  bio = this.auth.user()?.bio ?? '';
  city = this.auth.user()?.city ?? '';
  displayMode = this.auth.user()?.displayMode ?? 'USERNAME';
  current = '';
  newPassword = '';
  acct: 'PRIVATE' | 'BUSINESS' = this.auth.user()?.accountType ?? 'PRIVATE';
  biz = { name: '', regNo: '', vat: '', address: '', email: '', phone: '', ...(this.auth.user()?.business ?? {}) } as { name: string; regNo: string; vat: string; address: string; email: string; phone: string };
  declare = this.acct === 'BUSINESS';
  blocked = signal<PublicUser[]>([]);
  textSizes: { v: 'normal' | 'lg' | 'xl'; px: number }[] = [{ v: 'normal', px: 15 }, { v: 'lg', px: 17 }, { v: 'xl', px: 19 }];
  legalDocs = ['terms', 'privacy', 'rules', 'dsa', 'cookies', 'about'];

  ionViewWillEnter() { this.api.blocks().then((b) => this.blocked.set(b)).catch(() => {}); }

  async saveBusiness() {
    try {
      const b = this.biz;
      const me = await this.api.updateBusiness(this.acct === 'BUSINESS'
        ? { accountType: 'BUSINESS', name: b.name.trim(), regNo: b.regNo.trim(), vat: b.vat?.trim() || undefined, address: b.address.trim(), email: b.email.trim(), phone: b.phone?.trim() || undefined }
        : { accountType: 'PRIVATE' });
      this.auth.setUser(me);
      this.ui.toast(this.i18n.t(this.acct === 'BUSINESS' ? 'biz.saved' : 'settings.saved'));
    } catch (e) { this.ui.error(e); }
  }

  async unblock(u: PublicUser) {
    try { await this.api.unblock(u.id); this.blocked.update((l) => l.filter((x) => x.id !== u.id)); this.ui.toast(this.i18n.t('block.undone')); }
    catch (e) { this.ui.error(e); }
  }

  async saveProfile() {
    try { this.auth.setUser(await this.api.updateMe({ username: this.username.trim(), bio: this.bio, city: this.city, displayMode: this.displayMode })); this.ui.toast(this.i18n.t('settings.saved')); }
    catch (e) { this.ui.error(e); }
  }

  async setLang(l: Lang) {
    await this.i18n.use(l, true);
    this.api.updateMe({ locale: l }).catch(() => {});
  }

  async changePassword() {
    try { await this.api.changePassword(this.current || null, this.newPassword); this.ui.toast(this.i18n.t('settings.passwordChanged')); await this.auth.logout(); this.nav.navigateRoot('/login'); }
    catch (e) { this.ui.error(e); }
  }

  async logoutAll() { await this.auth.logout(true); this.nav.navigateRoot('/login'); }

  async exportData() {
    try {
      const data = await this.api.exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'cumped-date.json'; a.click(); URL.revokeObjectURL(url);
    } catch (e) { this.ui.error(e); }
  }

  deleting = signal(false);
  async deleteAccount() {
    if (this.deleting()) return;
    this.deleting.set(true);
    try { await this.api.deleteAccount(); await this.auth.logout(); this.nav.navigateRoot('/welcome'); } catch (e) { this.ui.error(e); }
    this.deleting.set(false);
  }
}

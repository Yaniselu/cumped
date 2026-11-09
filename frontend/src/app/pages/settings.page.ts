import { MOTION } from '../shared/motion.directives';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, NavController } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, LANGUAGES, Lang, TPipe } from '../core/i18n.service';
import { Theme, ThemePref } from '../core/theme.service';
import { Ui } from '../core/ui.service';
import { BackButtonComponent } from '../shared/back-button.component';

@Component({
  selector: 'page-settings',
  imports: [MOTION, IonContent, IonIcon, FormsModule, TPipe, BackButtonComponent],
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

        <h3 class="sh">{{ 'settings.language' | t }}</h3>
        <div class="card pad reveal"><div class="langs">
          @for (l of languages; track l.code) { <button class="chip" [class.active]="i18n.lang() === l.code" (click)="setLang(l.code)">{{ l.flag }} {{ l.name }}</button> }
        </div></div>

        <h3 class="sh">{{ 'settings.theme' | t }}</h3>
        <div class="seg reveal">
          @for (t of themes; track t.v) { <button [class.on]="theme.pref() === t.v" (click)="theme.set(t.v)"><ion-icon [name]="t.icon"></ion-icon>{{ 'settings.' + t.v | t }}</button> }
        </div>

        <h3 class="sh">{{ 'settings.security' | t }}</h3>
        <div class="card pad stack reveal">
          @if (auth.user()?.hasPassword) { <div class="field"><label>{{ 'settings.current' | t }}</label><input class="input" type="password" [(ngModel)]="current" autocomplete="current-password" /></div> }
          <div class="field"><label>{{ 'settings.newPassword' | t }}</label><input class="input" type="password" [(ngModel)]="newPassword" autocomplete="new-password" /><span class="hint">{{ 'auth.passwordHint' | t }}</span></div>
          <button class="btn light block" [disabled]="newPassword.length < 10" (click)="changePassword()"><ion-icon name="lock-closed-outline"></ion-icon>{{ 'settings.changePassword' | t }}</button>
          <button class="btn ghost block" (click)="logoutAll()"><ion-icon name="log-out-outline"></ion-icon>{{ 'settings.logoutAll' | t }}</button>
        </div>

        <h3 class="sh">{{ 'settings.privacy' | t }}</h3>
        <div class="card pad stack reveal">
          <button class="btn light block" (click)="exportData()"><ion-icon name="download-outline"></ion-icon>{{ 'settings.exportData' | t }}</button>
          <button class="btn danger block" (click)="deleteAccount()"><ion-icon name="trash-outline"></ion-icon>{{ 'settings.deleteAccount' | t }}</button>
        </div>
        <p class="faint small center">Cumped 0.1 · Velosyntech</p>
      </div>
    </ion-content>
  `,
  styles: [`
    .sh { margin: 24px 4px 10px; font-size: 15px; color: var(--text-2); }
    .opts { display: flex; flex-direction: column; gap: 8px; }
    .opt { display: flex; align-items: center; gap: 10px; padding: 14px; border-radius: 16px; border: 1.5px solid var(--line); background: var(--surface); color: var(--text); text-align: left; cursor: pointer; font-weight: 550; }
    .opt.on { border-color: var(--accent); background: var(--accent-soft); } .opt:disabled { opacity: .45; } .opt ion-icon { font-size: 20px; color: var(--accent); }
    .langs { display: flex; flex-wrap: wrap; gap: 8px; }
    .seg { display: flex; padding: 5px; border-radius: 999px; background: var(--surface); box-shadow: var(--shadow-card); }
    .seg button { flex: 1; height: 44px; border: 0; border-radius: 999px; background: transparent; font-weight: 600; color: var(--text-2); display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: all .3s var(--ease); }
    .seg button.on { background: var(--btn-dark); color: var(--btn-dark-text); }
    .center { text-align: center; margin-top: 24px; }
  `],
})
export class SettingsPage {
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

  async deleteAccount() {
    if (!(await this.ui.confirm(this.i18n.t('settings.deleteConfirm'), this.i18n.t('common.delete')))) return;
    try { await this.api.deleteAccount(); await this.auth.logout(); this.nav.navigateRoot('/welcome'); } catch (e) { this.ui.error(e); }
  }
}

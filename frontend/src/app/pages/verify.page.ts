import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, NavController } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, TPipe } from '../core/i18n.service';
import { Ui } from '../core/ui.service';
import { BackButtonComponent } from '../shared/back-button.component';

@Component({
  selector: 'page-verify',
  imports: [IonContent, IonIcon, FormsModule, TPipe, BackButtonComponent],
  template: `
    <ion-content [fullscreen]="true">
      <div class="page narrow">
        <div class="topbar"><cmp-back fallback="/profile" /><div class="title"></div><div class="spacer"></div></div>
        @if (!phoneMode()) {
          <div class="hero reveal"><div class="badge-ic"><ion-icon name="shield-checkmark"></ion-icon></div>
            <h1>{{ 'verify.idTitle' | t }}</h1><p class="muted">{{ 'verify.idSub' | t }}</p></div>
          @if (auth.user()?.idVerified) { <div class="done card pad fade"><ion-icon name="checkmark-circle"></ion-icon>{{ 'verify.idDone' | t }}</div> }
          @else if (mode() === 'DEV') {
            <div class="dev small">{{ 'verify.devNotice' | t }}</div>
            <div class="card pad stack reveal">
              <div class="field"><label>{{ 'verify.firstName' | t }}</label><input class="input" [(ngModel)]="first" maxlength="40" /></div>
              <div class="field"><label>{{ 'verify.lastName' | t }}</label><input class="input" [(ngModel)]="last" maxlength="40" /></div>
              <button class="btn block" [disabled]="first.length < 2 || last.length < 2" (click)="completeId()">{{ 'verify.idCta' | t }}</button>
            </div>
          } @else if (error()) { <div class="error-text">{{ error() }}</div> }
          <button class="btn ghost block" (click)="phoneMode.set(true)"><ion-icon name="phone-portrait-outline"></ion-icon>{{ 'profile.phone' | t }}</button>
        } @else {
          <div class="hero reveal"><div class="badge-ic"><ion-icon name="phone-portrait"></ion-icon></div>
            <h1>{{ 'verify.phoneTitle' | t }}</h1><p class="muted">{{ 'verify.phoneSub' | t }}</p></div>
          @if (auth.user()?.phoneVerified) { <div class="done card pad fade"><ion-icon name="checkmark-circle"></ion-icon>{{ 'verify.phoneDone' | t }}</div> }
          @else {
            <div class="card pad stack reveal">
              <div class="field"><label>{{ 'verify.phoneTitle' | t }}</label><input class="input" type="tel" [(ngModel)]="phone" [placeholder]="'verify.phonePh' | t" /></div>
              @if (!sent()) { <button class="btn block" [disabled]="!validPhone()" (click)="sendCode()">{{ 'verify.sendCode' | t }}</button> }
              @else {
                @if (devCode()) { <div class="dev small">{{ 'verify.devCode' | t: { code: devCode() } }}</div> }
                <div class="field"><label>{{ 'verify.code' | t }}</label><input class="input code" inputmode="numeric" maxlength="6" [(ngModel)]="code" /></div>
                <button class="btn block" [disabled]="code.length !== 6" (click)="confirmCode()">{{ 'verify.confirm' | t }}</button>
              }
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .hero { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 10px 0 22px; } .hero p { max-width: 420px; line-height: 1.5; }
    .badge-ic { width: 92px; height: 92px; border-radius: 32px; display: grid; place-items: center; font-size: 42px; color: #fff;
      background: linear-gradient(135deg, #5b3df5, #8b6dff); box-shadow: 0 22px 40px -18px rgba(91,61,245,.8); animation: floaty 4s ease-in-out infinite; }
    .dev { padding: 12px 14px; border-radius: 16px; background: var(--warn-soft); color: var(--warn); margin-bottom: 12px; font-weight: 600; }
    .done { display: flex; align-items: center; gap: 10px; font-weight: 650; color: var(--ok); } .done ion-icon { font-size: 26px; }
    .code { font-size: 26px; letter-spacing: .5em; text-align: center; font-family: var(--font-display); font-weight: 700; }
    .btn.ghost { margin-top: 14px; }
  `],
})
export class VerifyPage implements OnInit {
  auth = inject(AuthService);
  private api = inject(Api);
  private ui = inject(Ui);
  private i18n = inject(I18n);
  private nav = inject(NavController);
  phoneParam = input<string>(undefined, { alias: 'phone' });
  phoneMode = signal(false);
  mode = signal('');
  error = signal('');
  sent = signal(false);
  devCode = signal('');
  first = ''; last = ''; phone = '+40'; code = '';

  async ngOnInit() {
    this.phoneMode.set(!!this.phoneParam() || !!this.auth.user()?.idVerified);
    if (!this.auth.user()?.idVerified) {
      try { this.mode.set((await this.api.startIdentity()).mode); } catch (e) { this.error.set(this.ui.errorText(e)); }
    }
  }

  validPhone() { return /^\+[1-9]\d{7,14}$/.test(this.phone.replace(/\s/g, '')); }

  async completeId() {
    try { await this.api.devIdentity(this.first.trim(), this.last.trim()); this.auth.setUser(await this.api.me()); this.ui.toast(this.i18n.t('verify.idDone')); this.ui.tap(); }
    catch (e) { this.ui.error(e); }
  }

  async sendCode() {
    try { const r = await this.api.startPhone(this.phone.replace(/\s/g, '')); this.sent.set(true); this.devCode.set(r.devCode ?? ''); }
    catch (e) { this.ui.error(e); }
  }

  async confirmCode() {
    try { await this.api.confirmPhone(this.code); this.auth.setUser(await this.api.me()); this.ui.toast(this.i18n.t('verify.phoneDone')); this.nav.navigateBack('/profile'); }
    catch (e) { this.ui.error(e); }
  }
}

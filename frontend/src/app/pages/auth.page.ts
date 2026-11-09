import { MOTION } from '../shared/motion.directives';
import { Component, Directive, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, NavController } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, TPipe } from '../core/i18n.service';
import { ServerConfig } from '../core/models';
import { Ui } from '../core/ui.service';
import { ONBOARDED_KEY } from '../core/guards';
import { BackButtonComponent } from '../shared/back-button.component';
import { LogoComponent } from '../shared/logo.component';

@Directive()
abstract class AuthBase implements OnInit {
  protected api = inject(Api);
  protected auth = inject(AuthService);
  protected nav = inject(NavController);
  protected ui = inject(Ui);
  i18n = inject(I18n);
  next = input<string>();
  config = signal<ServerConfig | null>(null);
  busy = signal(false);
  error = signal('');

  async ngOnInit() { try { this.config.set(await this.api.config()); } catch { /* offline */ } }

  protected done() {
    localStorage.setItem(ONBOARDED_KEY, '1');
    const target = this.next();
    this.nav.navigateRoot(target && target.startsWith('/') && !target.startsWith('//') ? target : '/home');
  }

  /** Pe ecranul de înregistrare, bifele sunt obligatorii și pentru Apple/Google. */
  protected canSocial() { return true; }

  social(provider: 'google' | 'apple') {
    if (!this.canSocial()) { this.error.set(this.i18n.t('errors.TERMS_REQUIRED')); return; }
    const enabled = provider === 'google' ? this.config()?.googleLogin : this.config()?.appleLogin;
    if (!enabled) { this.ui.toast(this.i18n.t('errors.PROVIDER_NOT_CONFIGURED'), true); return; }
    // Fluxul nativ (Google Identity Services / Sign in with Apple) se activează odată cu client ID-urile.
    this.ui.toast(this.i18n.t('errors.PROVIDER_NOT_CONFIGURED'), true);
  }
}

const SOCIAL = `
  <div class="or"><span>{{ 'auth.orContinue' | t }}</span></div>
  <div class="social">
    <button type="button" class="btn light block" (click)="social('apple')"><ion-icon name="logo-apple"></ion-icon>{{ 'auth.apple' | t }}</button>
    <button type="button" class="btn light block" (click)="social('google')"><ion-icon name="logo-google"></ion-icon>{{ 'auth.google' | t }}</button>
  </div>`;

const STYLES = `
  .wrap { max-width: 460px; margin: 0 auto; padding: calc(env(safe-area-inset-top) + 12px) 22px 40px; }
  .head { margin: 18px 0 26px; } .head h1 { margin-top: 22px; } .head p { margin-top: 8px; }
  form { display: flex; flex-direction: column; gap: 16px; }
  .or { display: flex; align-items: center; gap: 12px; color: var(--text-3); font-size: 13px; margin: 22px 0 14px; }
  .or::before, .or::after { content: ''; height: 1px; flex: 1; background: var(--line); }
  .social { display: flex; flex-direction: column; gap: 10px; }
  .foot { text-align: center; margin-top: 22px; color: var(--text-2); font-size: 14.5px; }
  .demo { margin-top: 16px; padding: 12px 14px; border-radius: 16px; background: var(--accent-soft); color: var(--accent); font-size: 13px; text-align: center; }
  .terms { font-size: 12px; color: var(--text-3); text-align: center; margin-top: 14px; }
  .pw { position: relative; } .pw button { position: absolute; right: 8px; top: 7px; }
`;

@Component({
  selector: 'page-login',
  imports: [MOTION, IonContent, IonIcon, FormsModule, RouterLink, TPipe, LogoComponent, BackButtonComponent],
  template: `
    <ion-content cmpScrollFx>
      <div class="wrap">
        <cmp-back fallback="/welcome" />
        <div class="head reveal"><cmp-logo [size]="56" [animate]="true" /><h1>{{ 'auth.loginTitle' | t }}</h1><p class="muted">{{ 'auth.loginSub' | t }}</p></div>
        <form (ngSubmit)="submit()" class="reveal" style="--i:2">
          <div class="field"><label>{{ 'auth.email' | t }}</label><input class="input" type="email" name="email" [(ngModel)]="email" autocomplete="email" required /></div>
          <div class="field"><label>{{ 'auth.password' | t }}</label>
            <div class="pw"><input class="input" [type]="show() ? 'text' : 'password'" name="password" [(ngModel)]="password" autocomplete="current-password" required />
              <button type="button" class="icon-btn sm" (click)="show.set(!show())"><ion-icon name="eye-outline"></ion-icon></button></div></div>
          @if (error()) { <div class="error-text fade">{{ error() }}</div> }
          <button class="btn block" [disabled]="busy() || !email || !password || wait() > 0">
            @if (wait() > 0) { <ion-icon name="time-outline"></ion-icon>{{ 'auth2.retryIn' | t: { time: mmss(wait()) } }} } @else { {{ 'auth.loginCta' | t }} }</button>
        </form>
        ${SOCIAL}
        <p class="terms">{{ 'auth.socialTerms' | t }} <a routerLink="/legal/terms">{{ 'legal.terms' | t }}</a> · <a routerLink="/legal/privacy">{{ 'legal.privacy' | t }}</a></p>
        @if (config()?.devMode) { <div class="demo fade">{{ 'auth.demoHint' | t }}</div> }
        <div class="foot">{{ 'auth.noAccount' | t }} <a routerLink="/register" [queryParams]="{ next: next() }">{{ 'auth.createOne' | t }}</a></div>
      </div>
    </ion-content>
  `,
  styles: [STYLES],
})
export class LoginPage extends AuthBase implements OnDestroy {
  email = '';
  password = '';
  show = signal(false);
  /** După prea multe încercări, serverul spune cât trebuie așteptat (Retry-After); afișăm numărătoarea. */
  private until = signal(0);
  private now = signal(Date.now());
  private ticker: any;
  wait = computed(() => Math.max(0, Math.ceil((this.until() - this.now()) / 1000)));

  mmss(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  async submit() {
    if (this.busy() || this.wait() > 0) return;
    this.busy.set(true);
    this.error.set('');
    try { await this.auth.login(this.email.trim(), this.password); this.done(); }
    catch (e: any) {
      this.error.set(this.ui.errorText(e));
      const retry = Number(e?.error?.retryAfter ?? e?.headers?.get?.('Retry-After') ?? 0);
      if (e?.status === 429 && retry > 0) {
        this.until.set(Date.now() + retry * 1000);
        clearInterval(this.ticker);
        this.ticker = setInterval(() => { this.now.set(Date.now()); if (this.wait() <= 0) clearInterval(this.ticker); }, 1000);
        this.now.set(Date.now());
      }
    }
    finally { this.busy.set(false); }
  }

  ngOnDestroy() { clearInterval(this.ticker); }
}

@Component({
  selector: 'page-register',
  imports: [MOTION, IonContent, IonIcon, FormsModule, RouterLink, TPipe, LogoComponent, BackButtonComponent],
  template: `
    <ion-content cmpScrollFx>
      <div class="wrap">
        <cmp-back fallback="/welcome" />
        <div class="head reveal"><cmp-logo [size]="56" [animate]="true" /><h1>{{ 'auth.registerTitle' | t }}</h1><p class="muted">{{ 'auth.registerSub' | t }}</p></div>
        <form (ngSubmit)="submit()" class="reveal" style="--i:2">
          <div class="field"><label>{{ 'auth.email' | t }}</label><input class="input" type="email" name="email" [(ngModel)]="email" autocomplete="email" required /></div>
          <div class="field"><label>{{ 'auth.username' | t }}</label><input class="input" name="username" [(ngModel)]="username" autocomplete="username" maxlength="20" required />
            <span class="hint">{{ 'auth.usernameHint' | t }}</span></div>
          <div class="field"><label>{{ 'auth.password' | t }}</label>
            <div class="pw"><input class="input" [type]="show() ? 'text' : 'password'" name="password" [(ngModel)]="password" autocomplete="new-password" required />
              <button type="button" class="icon-btn sm" (click)="show.set(!show())"><ion-icon name="eye-outline"></ion-icon></button></div>
            <div class="meter"><span [style.width.%]="strength() * 25" [attr.data-s]="strength()"></span></div>
            <span class="hint">{{ 'auth.passwordHint' | t }}</span></div>
          <div class="field"><label>{{ 'auth.referral' | t }} <span class="faint">({{ 'common.optional' | t }})</span></label>
            <input class="input" name="ref" [(ngModel)]="referral" maxlength="12" style="text-transform: uppercase" /></div>
          <div class="consent">
            <label class="chk"><input type="checkbox" name="terms" [(ngModel)]="acceptTerms" />
              <span class="box"><ion-icon name="checkmark"></ion-icon></span>
              <span>{{ 'auth.acceptPre' | t }} <a routerLink="/legal/terms">{{ 'legal.terms' | t }}</a>, <a routerLink="/legal/rules">{{ 'legal.rules' | t }}</a> {{ 'auth.acceptAnd' | t }} <a routerLink="/legal/privacy">{{ 'legal.privacy' | t }}</a>.</span></label>
            <label class="chk"><input type="checkbox" name="adult" [(ngModel)]="adult" />
              <span class="box"><ion-icon name="checkmark"></ion-icon></span><span>{{ 'auth.adult' | t }}</span></label>
          </div>
          @if (error()) { <div class="error-text fade">{{ error() }}</div> }
          <button class="btn block" [disabled]="busy() || !email || !username || password.length < 10 || !acceptTerms || !adult">{{ 'auth.registerCta' | t }}</button>
        </form>
        ${SOCIAL}
        <div class="foot">{{ 'auth.haveAccount' | t }} <a routerLink="/login" [queryParams]="{ next: next() }">{{ 'auth.loginLink' | t }}</a></div>
      </div>
    </ion-content>
  `,
  styles: [STYLES + `
    .meter { height: 6px; border-radius: 99px; background: var(--surface-3); overflow: hidden; margin: 4px 4px 0; }
    .meter span { display: block; height: 100%; border-radius: 99px; transition: width .4s var(--ease), background .3s; background: var(--accent-2); }
    .meter span[data-s="3"] { background: var(--warn); } .meter span[data-s="4"] { background: var(--ok); }
    .consent { display: flex; flex-direction: column; gap: 12px; padding: 4px 2px; }
    .chk { position: relative; display: flex; gap: 12px; align-items: flex-start; font-size: 13.5px; line-height: 1.45; color: var(--text-2); cursor: pointer; }
    .chk input { position: absolute; opacity: 0; width: 22px; height: 22px; margin: 0; }
    .box { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 7px; border: 2px solid var(--surface-3); background: var(--surface); display: grid; place-items: center; color: transparent; transition: all .2s; }
    .chk input:checked + .box { background: var(--accent); border-color: var(--accent); color: #fff; }
    .chk input:focus-visible + .box { box-shadow: 0 0 0 4px var(--accent-soft); }
  `],
})
export class RegisterPage extends AuthBase {
  email = '';
  username = '';
  password = '';
  referral = new URLSearchParams(location.search).get('ref') ?? '';
  show = signal(false);
  acceptTerms = false;
  adult = false;

  protected override canSocial() { return this.acceptTerms && this.adult; }

  strength() {
    const p = this.password;
    let s = 0;
    if (p.length >= 10) s++;
    if (/[a-zA-Z]/.test(p) && /\d/.test(p)) s++;
    if (/[^a-zA-Z0-9]/.test(p)) s++;
    if (p.length >= 14) s++;
    return s;
  }

  async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.register({
        email: this.email.trim(), password: this.password, username: this.username.trim(),
        referralCode: this.referral.trim().toUpperCase() || undefined, locale: this.i18n.lang(),
        country: (navigator.language.split('-')[1] || 'RO').toUpperCase().slice(0, 2),
        acceptTerms: this.acceptTerms, adultConfirmed: this.adult,
      });
      this.done();
    } catch (e) { this.error.set(this.ui.errorText(e)); }
    finally { this.busy.set(false); }
  }
}

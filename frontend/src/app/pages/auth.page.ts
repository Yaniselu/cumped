import { MOTION } from '../shared/motion.directives';
import { Component, Directive, ElementRef, OnDestroy, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, NavController } from '@ionic/angular';
import { Api, errorCode } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, TPipe } from '../core/i18n.service';
import { ServerConfig } from '../core/models';
import { Motion } from '../core/motion.service';
import { Ui } from '../core/ui.service';
import { ONBOARDED_KEY } from '../core/guards';
import { BackButtonComponent } from '../shared/back-button.component';
import { AuthHeroComponent, AuthMood } from '../shared/auth-hero.component';
import { AvatarComponent } from '../shared/avatar.component';

/** Aceleași reguli ca pe server (AuthService.normalizeEmail / normalizeUsername). */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const USER_RE = /^[a-z0-9_.]{3,20}$/;
const SWITCH_KEY = 'cmp_auth_switch';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Field = 'email' | 'user' | 'pass' | 'eye' | 'ref' | null;

@Directive()
abstract class AuthBase implements OnInit {
  protected api = inject(Api);
  protected auth = inject(AuthService);
  protected nav = inject(NavController);
  protected ui = inject(Ui);
  protected motion = inject(Motion);
  i18n = inject(I18n);
  next = input<string>();
  config = signal<ServerConfig | null>(null);
  busy = signal(false);
  error = signal('');

  // ---- scena animată și reacțiile formularului ----
  focused = signal<Field>(null);
  tick = signal(0);
  show = signal(false);
  capsOn = signal(false);
  success = signal(false);
  failed = signal(false);
  shake = signal(false);
  /** Comutatorul Intră / Cont nou „alunecă” dacă ai venit de pe cealaltă pagină. */
  slid = signal(false);
  email = signal('');
  password = signal('');
  emailOk = computed(() => EMAIL_RE.test(this.email().trim()) && this.email().trim().length <= 254);
  abstract progress: () => number;
  mood = computed<AuthMood>(() => {
    if (this.success()) return 'ok';
    if (this.busy()) return 'busy';
    if (this.failed()) return 'error';
    const f = this.focused();
    if (f === 'pass' || (f === 'eye' && this.show())) return this.show() ? 'peek' : 'secret';
    return f ? 'type' : 'idle';
  });

  protected abstract mode: 'login' | 'register';

  async ngOnInit() { try { this.config.set(await this.api.config()); } catch { /* offline */ } }

  ionViewWillEnter() {
    this.slid.set(sessionStorage.getItem(SWITCH_KEY) === this.mode);
    sessionStorage.removeItem(SWITCH_KEY);
    this.success.set(false);
  }

  focus(f: Field) { this.focused.set(f); }
  blur(f: Field) { if (this.focused() === f) this.focused.set(null); if (f === 'pass') this.capsOn.set(false); }
  typed() { this.tick.update((t) => t + 1); }
  caps(e: KeyboardEvent) { if (e.getModifierState) this.capsOn.set(e.getModifierState('CapsLock')); }

  /** Intră ↔ Cont nou fără să adăugăm pagini în istoric (butonul Înapoi duce unde erai înainte). */
  switchTo(ev: Event, path: '/login' | '/register') {
    ev.preventDefault();
    sessionStorage.setItem(SWITCH_KEY, path === '/login' ? 'login' : 'register');
    const next = this.next();
    this.nav.navigateForward(path, { animated: false, replaceUrl: true, queryParams: next ? { next } : undefined });
  }

  protected fail(e: unknown) {
    this.error.set(this.ui.errorText(e));
    this.failed.set(true);
    this.shake.set(false);
    requestAnimationFrame(() => this.shake.set(true));
    setTimeout(() => { this.failed.set(false); this.shake.set(false); }, 900);
  }

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

const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>`;

/** Comutatorul Intră / Cont nou, câmpurile cu etichetă plutitoare (email cu bifă, parolă cu ochi animat și Caps Lock) și butonul cu stări. */
const SWITCH_LOGIN = `
  <nav class="authsw reveal" style="--i:1" [class.reg]="false" [class.from]="slid()" [attr.aria-label]="'authfx.tabLogin' | t">
    <a href="/login" [class.on]="true" [attr.aria-current]="'page'" (click)="$event.preventDefault()">
      <ion-icon name="log-in-outline"></ion-icon>{{ 'authfx.tabLogin' | t }}</a>
    <a href="/register" [class.on]="false" [attr.aria-current]="null" (click)="switchTo($event, '/register')">
      <ion-icon name="person-add-outline"></ion-icon>{{ 'authfx.tabRegister' | t }}</a>
    <span class="pill" aria-hidden="true"></span>
  </nav>`;

const SWITCH_REGISTER = `
  <nav class="authsw reveal" style="--i:1" [class.reg]="true" [class.from]="slid()" [attr.aria-label]="'authfx.tabLogin' | t">
    <a href="/login" [class.on]="false" [attr.aria-current]="null" (click)="switchTo($event, '/login')">
      <ion-icon name="log-in-outline"></ion-icon>{{ 'authfx.tabLogin' | t }}</a>
    <a href="/register" [class.on]="true" [attr.aria-current]="'page'" (click)="$event.preventDefault()">
      <ion-icon name="person-add-outline"></ion-icon>{{ 'authfx.tabRegister' | t }}</a>
    <span class="pill" aria-hidden="true"></span>
  </nav>`;

const EMAIL_LOGIN = `
  <div class="ff" [class.valid]="emailOk()" [class.filled]="email()">
    <ion-icon class="lead" name="mail-outline" aria-hidden="true"></ion-icon>
    <input id="l-email" class="input" type="email" name="email" placeholder=" " [ngModel]="email()" (ngModelChange)="email.set($event); typed()"
      (focus)="focus('email')" (blur)="blur('email')" autocomplete="email" inputmode="email" required />
    <label for="l-email">{{ 'auth.email' | t }}</label>
    <span class="okmark" [attr.aria-label]="emailOk() ? ('authfx.emailOk' | t) : null" [attr.role]="emailOk() ? 'img' : null">${CHECK}</span>
  </div>`;

const EMAIL_REGISTER = `
  <div class="ff" [class.valid]="emailOk()" [class.filled]="email()">
    <ion-icon class="lead" name="mail-outline" aria-hidden="true"></ion-icon>
    <input id="r-email" class="input" type="email" name="email" placeholder=" " [ngModel]="email()" (ngModelChange)="email.set($event); typed()"
      (focus)="focus('email')" (blur)="blur('email')" autocomplete="email" inputmode="email" required />
    <label for="r-email">{{ 'auth.email' | t }}</label>
    <span class="okmark" [attr.aria-label]="emailOk() ? ('authfx.emailOk' | t) : null" [attr.role]="emailOk() ? 'img' : null">${CHECK}</span>
  </div>`;

const PASS_LOGIN = `
  <div class="ff has-btn" [class.filled]="password()">
    <ion-icon class="lead" name="lock-closed-outline" aria-hidden="true"></ion-icon>
    <input id="l-pass" class="input" [type]="show() ? 'text' : 'password'" name="password" placeholder=" " [ngModel]="password()"
      (ngModelChange)="password.set($event); typed()" (focus)="focus('pass')" (blur)="blur('pass')" (keydown)="caps($event)" (keyup)="caps($event)"
      autocomplete="current-password" required  />
    <label for="l-pass">{{ 'auth.password' | t }}</label>
    <button type="button" class="icon-btn sm eye" (mousedown)="$event.preventDefault()" (click)="show.set(!show())" (focus)="focus('eye')" (blur)="blur('eye')"
      [attr.aria-label]="(show() ? 'authfx.hide' : 'auth.showPassword') | t" [attr.aria-pressed]="show()">
      @if (show()) { <ion-icon class="sw" name="eye-off-outline"></ion-icon> } @else { <ion-icon class="sw" name="eye-outline"></ion-icon> }
    </button>
  </div>
  @if (capsOn()) { <div class="capsw" role="status"><ion-icon name="arrow-up-outline"></ion-icon>{{ 'authfx.capsLock' | t }}</div> }`;

const PASS_REGISTER = `
  <div class="ff has-btn" [class.filled]="password()">
    <ion-icon class="lead" name="lock-closed-outline" aria-hidden="true"></ion-icon>
    <input id="r-pass" class="input" [type]="show() ? 'text' : 'password'" name="password" placeholder=" " [ngModel]="password()"
      (ngModelChange)="password.set($event); typed()" (focus)="focus('pass')" (blur)="blur('pass')" (keydown)="caps($event)" (keyup)="caps($event)"
      autocomplete="new-password" required aria-describedby="r-pass-hint" />
    <label for="r-pass">{{ 'auth.password' | t }}</label>
    <button type="button" class="icon-btn sm eye" (mousedown)="$event.preventDefault()" (click)="show.set(!show())" (focus)="focus('eye')" (blur)="blur('eye')"
      [attr.aria-label]="(show() ? 'authfx.hide' : 'auth.showPassword') | t" [attr.aria-pressed]="show()">
      @if (show()) { <ion-icon class="sw" name="eye-off-outline"></ion-icon> } @else { <ion-icon class="sw" name="eye-outline"></ion-icon> }
    </button>
  </div>
  @if (capsOn()) { <div class="capsw" role="status"><ion-icon name="arrow-up-outline"></ion-icon>{{ 'authfx.capsLock' | t }}</div> }`;

const SUBMIT_LOGIN = `
  <button class="btn block submit" [class.busy]="busy()" [class.ok]="success()" [disabled]="busy() || success() || !email() || !password()">
    <span class="lbl">{{ 'auth.loginCta' | t }}</span><span class="sp" aria-hidden="true"></span>
    <span class="okc" aria-hidden="true">${CHECK}</span>
  </button>`;

const SUBMIT_REGISTER = `
  <button class="btn block submit" [class.busy]="busy()" [class.ok]="success()" [disabled]="busy() || success() || !canSubmit()">
    <span class="lbl">{{ 'auth.registerCta' | t }}</span><span class="sp" aria-hidden="true"></span>
    <span class="okc" aria-hidden="true">${CHECK}</span>
  </button>`;





const SOCIAL = `
  <div class="or reveal" style="--i:4"><span>{{ 'auth.orContinue' | t }}</span></div>
  <div class="social reveal" style="--i:5">
    <button type="button" class="btn light block" (click)="social('apple')"><ion-icon name="logo-apple"></ion-icon>{{ 'auth.apple' | t }}</button>
    <button type="button" class="btn light block" (click)="social('google')"><ion-icon name="logo-google"></ion-icon>{{ 'auth.google' | t }}</button>
  </div>`;

const STYLES = `
  .wrap { max-width: 460px; margin: 0 auto; padding: calc(env(safe-area-inset-top) + 12px) max(20px, env(safe-area-inset-right) + 12px) calc(env(safe-area-inset-bottom) + 40px) max(20px, env(safe-area-inset-left) + 12px); }
  .head { margin: 20px 4px 18px; } .head p { margin-top: 6px; }
  form { display: flex; flex-direction: column; gap: 14px; padding: 18px; border-radius: 28px; background: var(--card-fill); border: 1px solid var(--line); box-shadow: var(--shadow-card); }
  form.shake { animation: shakeX .5s cubic-bezier(.36, .07, .19, .97); }
  @keyframes shakeX { 10%, 90% { transform: translateX(-2px); } 20%, 80% { transform: translateX(4px); } 30%, 50%, 70% { transform: translateX(-8px); } 40%, 60% { transform: translateX(8px); } }

  /* comutatorul Intră / Cont nou */
  .authsw { position: relative; display: grid; grid-template-columns: 1fr 1fr; padding: 5px; margin-top: 14px; border-radius: 999px;
    background: color-mix(in oklab, var(--text) 6%, transparent); border: 1px solid var(--line); }
  .authsw a { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 46px; padding: 0 10px;
    border-radius: 999px; font-weight: 650; font-size: 15.5px; color: var(--text-2); text-decoration: none; transition: color .3s; text-align: center; line-height: 1.15; }
  .authsw a ion-icon { font-size: 18px; flex: 0 0 auto; }
  .authsw a.on { color: var(--text); } .authsw a.on ion-icon { color: var(--accent); }
  .authsw .pill { position: absolute; top: 5px; bottom: 5px; left: 5px; width: calc(50% - 5px); border-radius: 999px; background: var(--card-fill);
    box-shadow: 0 6px 16px -8px rgba(30, 20, 80, .35), inset 0 0 0 1px var(--line); transition: transform .45s var(--spring); }
  .authsw.reg .pill { transform: translateX(100%); }
  .authsw.from .pill { animation: pillFromR .55s var(--spring) both; } .authsw.reg.from .pill { animation-name: pillFromL; }
  @keyframes pillFromR { from { transform: translateX(100%); } } @keyframes pillFromL { from { transform: translateX(0); } }

  /* câmpuri cu etichetă plutitoare */
  .ff { position: relative; }
  .ff .input { height: 62px; padding: 22px 16px 6px 50px; font-size: 17px; }
  .ff.has-btn .input { padding-right: 58px; } .ff.status .input, .ff.valid .input { padding-right: 48px; }
  .ff .input { text-overflow: ellipsis; }
  .ff > label { position: absolute; left: 50px; right: 52px; top: 31px; transform: translateY(-50%); font-size: 16px; font-weight: 500; color: var(--text-3);
    pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transform-origin: left center;
    transition: top .25s var(--ease), font-size .25s var(--ease), color .2s, font-weight .2s; }
  .ff .input:focus ~ label, .ff .input:not(:placeholder-shown) ~ label, .ff .input:-webkit-autofill ~ label { top: 17px; font-size: 12.5px; font-weight: 650; color: var(--text-2); }
  .ff .input:focus ~ label { color: var(--accent); }
  .ff .lead { position: absolute; left: 17px; top: 31px; translate: 0 -50%; font-size: 21px; color: var(--text-3); transition: color .2s, transform .4s var(--spring); }
  .ff:focus-within .lead { color: var(--accent); transform: scale(1.12) rotate(-8deg); }
  .ff.valid .lead { color: var(--ok); }
  .ff .okmark { position: absolute; right: 16px; top: 31px; translate: 0 -50%; width: 24px; height: 24px; display: grid; place-items: center; pointer-events: none; }
  .ff .okmark svg, .okc svg, .rules .rdot svg, .box svg { fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 24; stroke-dashoffset: 24; }
  .ff .okmark svg { width: 22px; height: 22px; stroke: var(--ok); stroke-width: 2.6; transition: stroke-dashoffset .45s var(--ease); }
  .ff.valid .okmark svg { stroke-dashoffset: 0; }
  .ff.valid .input:not(:focus) { border-color: color-mix(in oklab, var(--ok) 45%, var(--line)); }
  .ff .eye { position: absolute; right: 10px; top: 31px; translate: 0 -50%; }
  .eye .sw { animation: eyeSwap .35s var(--spring); }
  @keyframes eyeSwap { from { transform: scaleY(.1) rotate(-20deg); opacity: .3; } }
  .capsw { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; margin: -6px 0 0 6px; padding: 5px 11px; border-radius: 999px;
    font-size: 13px; font-weight: 600; color: var(--warn); background: var(--warn-soft); animation: popIn .35s var(--spring); }
  @keyframes popIn { from { opacity: 0; transform: translateY(-6px) scale(.9); } }

  /* buton cu stări: se încarcă → bifă */
  .submit { position: relative; overflow: hidden; margin-top: 2px; transition: background .3s, transform .3s var(--spring); }
  .submit .lbl { display: inline-flex; align-items: center; gap: 8px; transition: opacity .2s, transform .3s var(--ease); }
  .submit .sp { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px; border-radius: 50%; border: 2.6px solid currentColor;
    border-right-color: transparent; opacity: 0; transform: scale(.5); transition: opacity .2s, transform .3s var(--spring); }
  .submit .okc { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; }
  .okc svg { width: 26px; height: 26px; stroke: currentColor; stroke-width: 2.8; transition: stroke-dashoffset .45s .1s var(--ease); }
  .submit.busy .lbl, .submit.ok .lbl { opacity: 0; transform: translateY(-8px); }
  .submit.busy .sp { opacity: 1; transform: none; animation: spin .7s linear infinite; }
  .submit.ok { background: var(--ok) !important; color: #fff !important; opacity: 1 !important; transform: scale(1.02); }
  .submit.ok .okc { opacity: 1; } .submit.ok .okc svg { stroke-dashoffset: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .error-text { animation: popIn .35s var(--spring); }
  .or { display: flex; align-items: center; gap: 12px; color: var(--text-3); font-size: 14px; margin: 22px 0 14px; }
  .or::before, .or::after { content: ''; height: 1px; flex: 1; background: var(--line); }
  .social { display: flex; flex-direction: column; gap: 10px; }
  .social .btn { transition: transform .35s var(--spring), box-shadow .3s; }
  @media (hover: hover) { .social .btn:hover { transform: translateY(-2px); } }
  .foot { text-align: center; margin-top: 22px; color: var(--text-2); font-size: 15.5px; }
  .terms { font-size: 13px; color: var(--text-3); text-align: center; margin-top: 14px; }
  .demo { width: 100%; margin-top: 16px; min-height: 52px; padding: 10px 14px; border: 1px dashed color-mix(in oklab, var(--accent) 45%, transparent); border-radius: 18px;
    background: var(--accent-soft); color: var(--accent); font: inherit; font-size: 14.5px; font-weight: 650; display: flex; align-items: center; justify-content: center;
    gap: 8px; flex-wrap: wrap; cursor: pointer; transition: transform .3s var(--spring); }
  .demo small { font-weight: 500; opacity: .8; } .demo:active { transform: scale(.98); }
  .demo ion-icon { animation: glint 3s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) { form.shake, .eye .sw, .capsw, .error-text { animation: none; } }

  /* calculator / tabletă culcată: scena mare în stânga (rămâne pe loc), formularul în dreapta */
  @media (min-width: 960px) and (min-height: 560px) {
    .wrap { max-width: 1060px; display: grid; grid-template-columns: minmax(0, 1fr) 440px; column-gap: 56px; align-items: start;
      padding-top: calc(env(safe-area-inset-top) + 28px); }
    .wrap > * { grid-column: 2; }
    .wrap > cmp-back { grid-column: 1; grid-row: 1; }
    .wrap > cmp-auth-hero { grid-column: 1; grid-row: 2 / span 12; position: sticky; top: 24px; }
  }
`;

@Component({
  selector: 'page-login',
  imports: [MOTION, IonContent, IonIcon, FormsModule, RouterLink, TPipe, BackButtonComponent, AuthHeroComponent],
  template: `
    <ion-content cmpScrollFx>
      <div class="wrap">
        <cmp-back fallback="/welcome" />
        <cmp-auth-hero class="reveal" [progress]="progress()" [mood]="mood()" [tick]="tick()" />
        ${SWITCH_LOGIN}
        <div class="head reveal" style="--i:2"><h1>{{ 'auth.loginTitle' | t }}</h1><p class="muted">{{ 'auth.loginSub' | t }}</p></div>
        <form (ngSubmit)="submit()" class="reveal" style="--i:3" [class.shake]="shake()" [attr.aria-busy]="busy()" novalidate>
          ${EMAIL_LOGIN}
          ${PASS_LOGIN}
          @if (error()) { <div class="error-text" role="alert">{{ error() }}</div> }
          @if (wait() > 0) {
            <button class="btn block submit" disabled><ion-icon name="time-outline"></ion-icon>{{ 'auth2.retryIn' | t: { time: mmss(wait()) } }}</button>
          } @else {
            ${SUBMIT_LOGIN}
          }
        </form>
        ${SOCIAL}
        <p class="terms">{{ 'auth.socialTerms' | t }} <a routerLink="/legal/terms">{{ 'legal.terms' | t }}</a> · <a routerLink="/legal/privacy">{{ 'legal.privacy' | t }}</a></p>
        @if (config()?.devMode) {
          <button type="button" class="demo fade" (click)="fillDemo()"><ion-icon name="sparkles"></ion-icon>{{ 'authfx.demoFill' | t }}<small>demo&#64;cumped.com</small></button>
        }
        <div class="foot">{{ 'auth.noAccount' | t }} <a href="/register" (click)="switchTo($event, '/register')">{{ 'auth.createOne' | t }}</a></div>
      </div>
    </ion-content>
  `,
  styles: [STYLES],
})
export class LoginPage extends AuthBase implements OnDestroy {
  protected mode = 'login' as const;
  /** După prea multe încercări, serverul spune cât trebuie așteptat (Retry-After); afișăm numărătoarea. */
  private until = signal(0);
  private now = signal(Date.now());
  private ticker: any;
  wait = computed(() => Math.max(0, Math.ceil((this.until() - this.now()) / 1000)));
  progress = computed(() => (this.emailOk() ? 0.5 : Math.min(0.35, this.email().length / 40)) + Math.min(1, this.password().length / 8) * 0.5);

  mmss(s: number) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  /** Doar în modul de dezvoltare: scrie contul demo literă cu literă (scena reacționează ca la tastare). */
  async fillDemo() {
    const write = async (f: Field, value: string, set: (v: string) => void) => {
      this.focused.set(f);
      if (reduced()) { set(value); return; }
      for (let i = 1; i <= value.length; i++) { set(value.slice(0, i)); this.typed(); await sleep(28); }
      await sleep(160);
    };
    await write('email', 'demo@cumped.com', (v) => this.email.set(v));
    await write('pass', 'Cumped-Demo-2026', (v) => this.password.set(v));
    this.focused.set(null);
  }

  async submit() {
    if (this.busy() || this.wait() > 0 || this.success()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.email().trim(), this.password());
      this.busy.set(false);
      this.success.set(true);
      await sleep(reduced() ? 0 : 520);
      this.done();
    } catch (e: any) {
      this.fail(e);
      const retry = Number(e?.error?.retryAfter ?? e?.headers?.get?.('Retry-After') ?? 0);
      if (e?.status === 429 && retry > 0) {
        this.until.set(Date.now() + retry * 1000);
        clearInterval(this.ticker);
        this.ticker = setInterval(() => { this.now.set(Date.now()); if (this.wait() <= 0) clearInterval(this.ticker); }, 1000);
        this.now.set(Date.now());
      }
    } finally { this.busy.set(false); }
  }

  ngOnDestroy() { clearInterval(this.ticker); }
}

@Component({
  selector: 'page-register',
  imports: [MOTION, IonContent, IonIcon, FormsModule, RouterLink, TPipe, BackButtonComponent, AuthHeroComponent, AvatarComponent],
  template: `
    <ion-content cmpScrollFx>
      <div class="wrap">
        <cmp-back fallback="/welcome" />
        <cmp-auth-hero class="reveal" [progress]="progress()" [mood]="mood()" [tick]="tick()" />
        ${SWITCH_REGISTER}
        <div class="head reveal" style="--i:2"><h1>{{ 'auth.registerTitle' | t }}</h1><p class="muted">{{ 'auth.registerSub' | t }}</p></div>
        <form (ngSubmit)="submit()" class="reveal" style="--i:3" [class.shake]="shake()" [attr.aria-busy]="busy()" novalidate>
          ${EMAIL_REGISTER}

          <div class="ff status" [class.valid]="userState() === 'ok'" [class.bad]="userState() === 'taken' || userState() === 'invalid'">
            <ion-icon class="lead" name="at-outline" aria-hidden="true"></ion-icon>
            <input id="r-user" class="input" name="username" placeholder=" " [ngModel]="username()" (ngModelChange)="onUser($event)"
              (focus)="focus('user')" (blur)="blur('user')" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="20" required
              aria-describedby="r-user-hint" />
            <label for="r-user">{{ 'auth.username' | t }}</label>
            <span class="ustate" aria-hidden="true">
              @switch (userState()) {
                @case ('checking') { <span class="mini-sp"></span> }
                @case ('ok') { <span class="okmark">${CHECK}</span> }
                @case ('taken') { <ion-icon class="x" name="close-circle"></ion-icon> }
                @case ('invalid') { <ion-icon class="x" name="close-circle"></ion-icon> }
              }
            </span>
          </div>
          <div class="uhelp" id="r-user-hint" aria-live="polite">
            @switch (userState()) {
              @case ('checking') { <span class="hint">{{ 'authfx.checking' | t }}</span> }
              @case ('ok') { <span class="hint good">{{ 'authfx.available' | t }}</span> }
              @case ('invalid') { <span class="hint badt">{{ 'authfx.invalidUser' | t }}</span> }
              @case ('taken') {
                <span class="hint badt">{{ 'authfx.taken' | t }}</span>
                <span class="sugg">@for (s of suggestions(); track s) { <button type="button" class="sg" (click)="onUser(s)">&#64;{{ s }}</button> }</span>
              }
              @default { <span class="hint">{{ 'auth.usernameHint' | t }}</span> }
            }
          </div>
          @if (userState() === 'ok') {
            <div class="preview" aria-hidden="true">
              <cmp-avatar [name]="username()" [hue]="hue()" [size]="46" />
              <div><span class="pv-l">{{ 'authfx.preview' | t }}</span><b>&#64;{{ username() }}</b><span>{{ 'authfx.newMember' | t }}</span></div>
            </div>
          }

          ${PASS_REGISTER}
          <div class="pwbox" [class.open]="password() || focused() === 'pass'"><div class="pwin">
            <div class="meter4" [attr.data-s]="strength()" aria-hidden="true">
              @for (i of [0, 1, 2, 3]; track i) { <i [class.on]="bars() > i"></i> }
            </div>
            <div class="slabel" role="status"><span>{{ 'authfx.strength' | t: { s: '' } }}</span><b>{{ 'authfx.s' + strength() | t }}</b></div>
            <ul class="rules" id="r-pass-hint">
              <li [class.ok]="rules().len"><span class="rdot">${CHECK}</span>{{ 'authfx.ruleLen' | t }}</li>
              <li [class.ok]="rules().mix"><span class="rdot">${CHECK}</span>{{ 'authfx.ruleMix' | t }}</li>
              <li [class.ok]="rules().personal"><span class="rdot">${CHECK}</span>{{ 'authfx.rulePersonal' | t }}</li>
              <li [class.ok]="rules().bonus" class="bonus"><span class="rdot">${CHECK}</span>{{ 'authfx.ruleBonus' | t }}</li>
              @if (rules().long) { <li class="bad"><ion-icon name="alert-circle"></ion-icon>{{ 'authfx.tooLong' | t }}</li> }
            </ul>
          </div></div>

          @if (showRef()) {
            <div class="ff refl">
              <ion-icon class="lead" name="gift-outline" aria-hidden="true"></ion-icon>
              <input id="r-ref" class="input" name="ref" placeholder=" " [(ngModel)]="referral" maxlength="12" autocomplete="off" (focus)="focus('ref')" (blur)="blur('ref')" />
              <label for="r-ref">{{ 'auth.referral' | t }} ({{ 'common.optional' | t }})</label>
            </div>
            @if (invited) { <span class="hint good invited"><ion-icon name="sparkles"></ion-icon>{{ 'authfx.invited' | t }}</span> }
          } @else {
            <button type="button" class="linkbtn refbtn" (click)="showRef.set(true)"><ion-icon name="gift-outline"></ion-icon>{{ 'authfx.haveCode' | t }}</button>
          }
          <!-- câmp-capcană pentru roboți: oamenii nu-l văd și nu-l completează -->
          <div class="hp" aria-hidden="true"><label for="r-web">Website</label><input id="r-web" name="website" tabindex="-1" autocomplete="off" [(ngModel)]="website" /></div>
          @if (config()?.captchaSiteKey) { <div #captcha class="captcha"></div> }
          <div class="consent">
            <label class="chk"><input type="checkbox" name="terms" [ngModel]="acceptTerms()" (ngModelChange)="acceptTerms.set($event)" />
              <span class="box">${CHECK}</span>
              <span>{{ 'auth.acceptPre' | t }} <a routerLink="/legal/terms">{{ 'legal.terms' | t }}</a>, <a routerLink="/legal/rules">{{ 'legal.rules' | t }}</a> {{ 'auth.acceptAnd' | t }} <a routerLink="/legal/privacy">{{ 'legal.privacy' | t }}</a>.</span></label>
            <label class="chk"><input type="checkbox" name="adult" [ngModel]="adult()" (ngModelChange)="adult.set($event)" />
              <span class="box">${CHECK}</span><span>{{ 'auth.adult' | t }}</span></label>
          </div>
          @if (error()) { <div class="error-text" role="alert">{{ error() }}</div> }
          ${SUBMIT_REGISTER}
        </form>
        ${SOCIAL}
        <div class="foot">{{ 'auth.haveAccount' | t }} <a href="/login" (click)="switchTo($event, '/login')">{{ 'auth.loginLink' | t }}</a></div>
      </div>
    </ion-content>
  `,
  styles: [STYLES + `
    .ff .ustate { position: absolute; right: 14px; top: 31px; translate: 0 -50%; width: 26px; height: 26px; display: grid; place-items: center; }
    .ustate .okmark { position: static; translate: none; }
    .ustate .okmark svg { stroke-dashoffset: 0; animation: drawCk .45s var(--ease) both; }
    @keyframes drawCk { from { stroke-dashoffset: 24; } }
    .ustate .x { font-size: 22px; color: var(--accent-2); animation: popIn .3s var(--spring); }
    .mini-sp { width: 18px; height: 18px; border-radius: 50%; border: 2.4px solid var(--accent); border-right-color: transparent; animation: spin .7s linear infinite; }
    .ff.bad .input:not(:focus) { border-color: color-mix(in oklab, var(--accent-2) 50%, var(--line)); }
    .uhelp { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin-top: -6px; min-height: 20px; }
    .hint.good { color: var(--ok); font-weight: 600; } .hint.badt { color: var(--accent-2); font-weight: 550; }
    .sugg { display: inline-flex; flex-wrap: wrap; gap: 6px; }
    .sg { min-height: 40px; padding: 0 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); color: var(--accent);
      font: inherit; font-size: 14px; font-weight: 650; cursor: pointer; animation: popIn .35s var(--spring) both; }
    .sg:nth-child(2) { animation-delay: .05s; } .sg:nth-child(3) { animation-delay: .1s; }
    .preview { position: relative; display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 20px; overflow: hidden;
      background: linear-gradient(120deg, var(--accent-soft), color-mix(in oklab, var(--accent-2) 10%, var(--surface))); animation: previewIn .5s var(--spring) both; }
    .preview div { display: flex; flex-direction: column; min-width: 0; } .preview b { font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .preview div span { font-size: 13px; color: var(--text-2); }
    .preview div .pv-l { font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--accent); margin-bottom: 1px; }
    @keyframes previewIn { from { opacity: 0; transform: translateY(-8px) scale(.97); } }

    .pwbox { display: grid; grid-template-rows: 0fr; opacity: 0; margin-top: -14px; transition: grid-template-rows .4s var(--ease), opacity .3s, margin .4s var(--ease); }
    .pwin { min-height: 0; overflow: hidden; }
    .pwbox.open { grid-template-rows: 1fr; opacity: 1; margin-top: -4px; }
    .meter4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 4px 4px 0; --c: var(--accent-2); }
    .meter4[data-s="2"] { --c: var(--warn); } .meter4[data-s="3"], .meter4[data-s="4"] { --c: var(--ok); }
    .meter4 i { height: 6px; border-radius: 99px; background: var(--surface-3); position: relative; overflow: hidden; }
    .meter4 i::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--c); transform: scaleX(0); transform-origin: left; transition: transform .45s var(--spring), background .3s; }
    .meter4 i.on::after { transform: scaleX(1); }
    .meter4 i:nth-child(2)::after { transition-delay: .04s; } .meter4 i:nth-child(3)::after { transition-delay: .08s; } .meter4 i:nth-child(4)::after { transition-delay: .12s; }
    .meter4[data-s="4"] i.on::after { background: linear-gradient(90deg, var(--ok), #2bd4a0); }
    .slabel { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; color: var(--text-3); margin: 7px 4px 0; }
    .slabel b { color: var(--c, var(--text-2)); } .pwbox .slabel b { color: var(--text-2); }
    .rules { list-style: none; margin: 8px 2px 2px; padding: 0; display: grid; gap: 7px; }
    .rules li { display: flex; align-items: center; gap: 9px; font-size: 13.5px; color: var(--text-3); transition: color .25s; }
    .rules .rdot { flex: 0 0 auto; width: 19px; height: 19px; border-radius: 50%; border: 1.8px solid var(--surface-3); display: grid; place-items: center; transition: all .35s var(--spring); }
    .rules .rdot svg { width: 12px; height: 12px; stroke: #fff; stroke-width: 3.4; transition: stroke-dashoffset .35s .08s var(--ease); }
    .rules li.ok { color: var(--text-2); } .rules li.ok .rdot { background: var(--ok); border-color: var(--ok); transform: scale(1.06); } .rules li.ok .rdot svg { stroke-dashoffset: 0; }
    .rules li.bonus.ok .rdot { background: var(--accent); border-color: var(--accent); }
    .rules li.bad { color: var(--accent-2); font-weight: 600; } .rules li.bad ion-icon { font-size: 19px; }

    .refbtn { align-self: flex-start; display: inline-flex; align-items: center; gap: 7px; min-height: 40px; padding: 0 4px; border: 0; background: none;
      color: var(--accent); font: inherit; font-size: 14.5px; font-weight: 650; cursor: pointer; }
    .refl { animation: previewIn .4s var(--spring) both; } .refl .input { text-transform: uppercase; letter-spacing: .08em; }
    .invited { display: inline-flex; align-items: center; gap: 6px; margin-top: -6px; }

    .consent { display: flex; flex-direction: column; gap: 12px; padding: 4px 2px; }
    .chk { position: relative; display: flex; gap: 12px; align-items: flex-start; font-size: 14.5px; line-height: 1.45; color: var(--text-2); cursor: pointer; }
    .chk input { position: absolute; opacity: 0; width: 24px; height: 24px; margin: 0; }
    .box { flex: 0 0 auto; width: 24px; height: 24px; border-radius: 8px; border: 2px solid var(--surface-3); background: var(--surface); display: grid; place-items: center;
      transition: background .25s, border-color .25s, transform .35s var(--spring); }
    .box svg { width: 16px; height: 16px; stroke: #fff; stroke-width: 3.2; transition: stroke-dashoffset .35s .05s var(--ease); }
    .chk input:checked + .box { background: var(--accent); border-color: var(--accent); animation: boxPop .4s var(--spring); }
    .chk input:checked + .box svg { stroke-dashoffset: 0; }
    .chk input:focus-visible + .box { box-shadow: 0 0 0 4px var(--accent-soft); }
    @keyframes boxPop { 40% { transform: scale(1.18); } }
    .hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
    .captcha { min-height: 65px; display: flex; justify-content: center; }
  `],
})
export class RegisterPage extends AuthBase implements OnDestroy {
  protected mode = 'register' as const;
  /** Momentul în care s-a deschis formularul: un robot îl trimite instant, un om nu. */
  private openedAt = performance.now();
  private captchaEl = viewChild<ElementRef<HTMLElement>>('captcha');
  private captchaToken = '';
  private userTimer: any;
  private userSeq = 0;
  website = '';
  referral = new URLSearchParams(location.search).get('ref') ?? '';
  invited = !!this.referral;
  showRef = signal(!!this.referral);
  username = signal('');
  userState = signal<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle');
  suggestions = signal<string[]>([]);
  acceptTerms = signal(false);
  adult = signal(false);

  rules = computed(() => {
    const p = this.password(), lower = p.toLowerCase();
    const local = this.email().trim().split('@')[0].toLowerCase(), u = this.username().toLowerCase();
    return {
      len: p.length >= 10 && new Set(lower).size >= 5,
      mix: /\p{L}/u.test(p) && /[^\p{L}]/u.test(p),
      personal: p.length > 0 && !(local.length >= 4 && lower.includes(local)) && !(u.length >= 4 && lower.includes(u)),
      bonus: p.length >= 14 || /[^\p{L}\p{N}]/u.test(p),
      long: new TextEncoder().encode(p).length > 72,
    };
  });
  pwOk = computed(() => { const r = this.rules(); return r.len && r.mix && r.personal && !r.long; });
  /** 0 prea scurtă · 1 slabă · 2 bună · 3 puternică · 4 foarte puternică */
  strength = computed(() => {
    const p = this.password();
    if (p.length < 10) return 0;
    if (!this.pwOk()) return 1;
    const sym = /[^\p{L}\p{N}]/u.test(p);
    return Math.min(4, 2 + (this.rules().bonus ? 1 : 0) + (p.length >= 16 && sym ? 1 : 0));
  });
  bars = computed(() => (this.password() ? Math.max(1, this.strength()) : 0));
  userLocalOk = computed(() => validUsername(this.username()));
  progress = computed(() => [this.emailOk(), this.userState() === 'ok', this.pwOk(), this.acceptTerms(), this.adult()].filter(Boolean).length / 5);
  canSubmit = computed(() => this.emailOk() && this.userLocalOk() && this.userState() !== 'taken' && this.pwOk() && this.acceptTerms() && this.adult());
  hue = computed(() => { let h = 0; for (const c of this.username()) h = (h * 31 + c.charCodeAt(0)) % 360; return h; });

  protected override canSocial() { return this.acceptTerms() && this.adult(); }

  override async ngOnInit() {
    await super.ngOnInit();
    const key = this.config()?.captchaSiteKey;
    if (key) setTimeout(() => this.renderCaptcha(key));
  }

  ngOnDestroy() { clearTimeout(this.userTimer); }

  /** Username-ul se verifică pe loc (aceleași reguli ca serverul), apoi, după o mică pauză, dacă e liber. */
  onUser(raw: string) {
    const v = (raw ?? '').toLowerCase().trim();
    this.username.set(v);
    this.typed();
    clearTimeout(this.userTimer);
    const seq = ++this.userSeq;
    if (!v) { this.userState.set('idle'); return; }
    if (!validUsername(v)) { this.userState.set(v.length < 3 ? 'idle' : 'invalid'); return; }
    this.userState.set('checking');
    this.userTimer = setTimeout(async () => {
      try {
        const r = await this.api.usernameAvailable(v);
        if (seq !== this.userSeq) return;
        if (r.available) this.userState.set('ok');
        else if (r.reason === 'USERNAME_TAKEN') { this.userState.set('taken'); this.suggestions.set(suggest(v)); }
        else this.userState.set('invalid');
      } catch { if (seq === this.userSeq) this.userState.set('idle'); }
    }, 380);
  }

  /** Cloudflare Turnstile: verificare anti-roboți fără puzzle (doar dacă e configurată pe server). */
  private renderCaptcha(siteKey: string) {
    const el = this.captchaEl()?.nativeElement;
    if (!el) return;
    const w = window as any;
    const draw = () => w.turnstile?.render(el, { sitekey: siteKey, language: this.i18n.lang(), callback: (t: string) => (this.captchaToken = t),
      'expired-callback': () => (this.captchaToken = '') });
    if (w.turnstile) { draw(); return; }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = draw;
    document.head.appendChild(s);
  }

  async submit() {
    if (this.busy() || this.success() || !this.canSubmit()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.register({
        email: this.email().trim(), password: this.password(), username: this.username().trim(),
        referralCode: this.referral.trim().toUpperCase() || undefined, locale: this.i18n.lang(),
        country: (navigator.language.split('-')[1] || 'RO').toUpperCase().slice(0, 2),
        acceptTerms: this.acceptTerms(), adultConfirmed: this.adult(),
        website: this.website, elapsedMs: Math.round(performance.now() - this.openedAt), captchaToken: this.captchaToken || undefined,
      });
      this.busy.set(false);
      this.success.set(true);
      this.motion.seal(this.i18n.t('authfx.created'));
      await sleep(reduced() ? 0 : 700);
      this.done();
    } catch (e: any) {
      this.fail(e);
      if (errorCode(e) === 'USERNAME_TAKEN') { this.userState.set('taken'); this.suggestions.set(suggest(this.username())); }
    } finally { this.busy.set(false); }
  }
}

function validUsername(u: string) {
  return USER_RE.test(u) && !u.startsWith('.') && !u.endsWith('.') && !u.includes('..');
}

/** Variante apropiate pentru un username ocupat (se verifică și ele când le alegi). */
function suggest(u: string): string[] {
  const base = u.replace(/[._]+$/, '').slice(0, 15) || 'user';
  const n = () => 10 + Math.floor(Math.random() * 89);
  const year = String(new Date().getFullYear()).slice(2);
  return [...new Set([`${base}_${n()}`, `${base}${year}`, `${base}.ro`])].filter(validUsername).slice(0, 3);
}

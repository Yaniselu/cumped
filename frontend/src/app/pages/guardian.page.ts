import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, NavController } from '@ionic/angular';
import { Api, errorCode } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, TPipe } from '../core/i18n.service';
import { GuardianInvite } from '../core/models';
import { Motion } from '../core/motion.service';
import { Ui } from '../core/ui.service';
import { AvatarComponent } from '../shared/avatar.component';
import { BackButtonComponent } from '../shared/back-button.component';
import { MOTION } from '../shared/motion.directives';

/**
 * Pagina deschisă de părinte din email: cine îi cere acordul, ce limite are contul, declarația și butoanele.
 * Acordul cere cont adult cu identitatea verificată (o dovadă clară pentru încuviințarea părintelui);
 * refuzul se poate da și fără cont.
 */
@Component({
  selector: 'page-guardian',
  imports: [MOTION, IonContent, IonIcon, RouterLink, TPipe, AvatarComponent, BackButtonComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <div class="page narrow">
        <div class="topbar"><cmp-back fallback="/home" /><div class="title">{{ 'guard.title' | t }}</div><div class="spacer"></div></div>
        @if (loading()) {
          <div class="skeleton" style="height:220px; border-radius: 28px"></div>
        } @else if (!invite()) {
          <div class="empty card pad reveal"><ion-icon name="time-outline"></ion-icon><h2>{{ 'guard.invalid' | t }}</h2><p class="muted">{{ 'guard.invalidSub' | t }}</p>
            <a class="btn block" routerLink="/home">{{ 'common.continue' | t }}</a></div>
        } @else if (state() === 'accepted') {
          <div class="result card pad reveal"><span class="big ok"><ion-icon name="shield-checkmark"></ion-icon></span>
            <h2>{{ 'guard.accepted' | t: { name: invite()!.teenUsername } }}</h2><p class="muted">{{ 'guard.acceptedSub' | t }}</p>
            <a class="btn block" routerLink="/profile">{{ 'guard.toPanel' | t }}</a></div>
        } @else if (state() === 'declined') {
          <div class="result card pad reveal"><span class="big no"><ion-icon name="close-circle"></ion-icon></span>
            <h2>{{ 'guard.declined' | t }}</h2><p class="muted">{{ 'guard.declinedSub' | t }}</p></div>
        } @else {
          @let inv = invite()!;
          <div class="who card reveal">
            <div class="halo" aria-hidden="true"></div>
            <cmp-avatar [name]="inv.teenUsername" [hue]="inv.avatarHue" [size]="76" />
            <h1>{{ 'guard.ask' | t: { name: inv.teenUsername, age: inv.teenAge } }}</h1>
            <p class="muted">{{ 'guard.askSub' | t }}</p>
          </div>

          <div class="card pad reveal" style="--i:1">
            <h3>{{ 'guard.what' | t }}</h3>
            <ul class="limits">
              <li><span class="li"><ion-icon name="pricetag-outline"></ion-icon></span>{{ 'minor.limitPrice' | t: { max: i18n.price(inv.caps['RON'], 'RON'), eur: i18n.price(inv.maxEurCents, 'EUR') } }}</li>
              <li><span class="li"><ion-icon name="cube-outline"></ion-icon></span>{{ 'minor.limitCourier' | t }}</li>
              <li><span class="li"><ion-icon name="ban-outline"></ion-icon></span>{{ 'minor.limitCategories' | t }}</li>
              <li><span class="li"><ion-icon name="cash-outline"></ion-icon></span>{{ 'minor.limitMoney' | t }}</li>
              <li><span class="li"><ion-icon name="chatbubbles-outline"></ion-icon></span>{{ 'guard.limitChat' | t }}</li>
              <li><span class="li"><ion-icon name="notifications-outline"></ion-icon></span>{{ 'guard.limitNotify' | t }}</li>
              <li><span class="li"><ion-icon name="pause"></ion-icon></span>{{ 'guard.limitControl' | t }}</li>
            </ul>
          </div>

          <div class="card pad reveal decl" style="--i:2">
            @if (!auth.loggedIn()) {
              <p>{{ 'guard.login' | t }}</p>
              <a class="btn block" routerLink="/login" [queryParams]="{ next: here() }">{{ 'auth.loginLink' | t }}</a>
              <a class="btn light block" routerLink="/register" [queryParams]="{ next: here() }">{{ 'auth.createOne' | t }}</a>
            } @else if (!auth.user()?.idVerified) {
              <p>{{ 'guard.needVerify' | t }}</p>
              <a class="btn block" routerLink="/verify" [queryParams]="{ next: here() }"><ion-icon name="shield-checkmark"></ion-icon>{{ 'guard.verifyCta' | t }}</a>
            } @else {
              <label class="chk"><input type="checkbox" [checked]="agree()" (change)="agree.set($any($event.target).checked)" />
                <span class="box"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg></span>
                <span>{{ 'guard.declaration' | t: { name: inv.teenUsername } }}</span></label>
              @if (error()) { <div class="error-text" role="alert">{{ error() }}</div> }
              <button class="btn block" [disabled]="!agree() || busy()" (click)="accept()"><ion-icon name="shield-checkmark"></ion-icon>{{ 'guard.accept' | t }}</button>
            }
            <button class="btn ghost block" [disabled]="busy()" (click)="decline()">{{ 'guard.decline' | t }}</button>
            <p class="faint small exp">{{ 'guard.expires' | t: { date: i18n.date(inv.expiresAt, { day: 'numeric', month: 'long' }) } }}</p>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .who { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 28px 20px 22px; }
    .who h1 { font-size: 24px; line-height: 1.2; text-wrap: balance; } .who p { margin: 0; }
    .halo { position: absolute; inset: -40% -20% auto; height: 220px; background: radial-gradient(closest-side, color-mix(in oklab, var(--accent) 30%, transparent), transparent);
      animation: haloBreath 5s ease-in-out infinite alternate; pointer-events: none; }
    @keyframes haloBreath { to { transform: scale(1.15); opacity: .7; } }
    .who cmp-avatar { position: relative; animation: pop .7s var(--spring) both; }
    h3 { margin-bottom: 12px; }
    .limits { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .limits li { display: flex; align-items: center; gap: 12px; font-size: 15px; line-height: 1.4; animation: fadeUp .5s var(--ease) both; }
    .limits li:nth-child(2) { animation-delay: .05s; } .limits li:nth-child(3) { animation-delay: .1s; } .limits li:nth-child(4) { animation-delay: .15s; }
    .limits li:nth-child(5) { animation-delay: .2s; } .limits li:nth-child(6) { animation-delay: .25s; } .limits li:nth-child(7) { animation-delay: .3s; }
    .li { flex: 0 0 auto; width: 34px; height: 34px; border-radius: 12px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-size: 18px; }
    .decl { display: flex; flex-direction: column; gap: 12px; } .decl p { margin: 0; }
    .chk { position: relative; display: flex; gap: 12px; align-items: flex-start; font-size: 14.5px; line-height: 1.5; color: var(--text-2); cursor: pointer; }
    .chk input { position: absolute; opacity: 0; width: 24px; height: 24px; margin: 0; }
    .box { flex: 0 0 auto; width: 24px; height: 24px; border-radius: 8px; border: 2px solid var(--surface-3); background: var(--surface); display: grid; place-items: center; transition: all .25s; }
    .box svg { width: 16px; height: 16px; fill: none; stroke: #fff; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 24; stroke-dashoffset: 24; transition: stroke-dashoffset .35s var(--ease); }
    .chk input:checked + .box { background: var(--accent); border-color: var(--accent); } .chk input:checked + .box svg { stroke-dashoffset: 0; }
    .chk input:focus-visible + .box { box-shadow: 0 0 0 4px var(--accent-soft); }
    .exp { text-align: center; margin: 0; }
    .result, .empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 30px 20px; }
    .empty > ion-icon { font-size: 44px; color: var(--text-3); }
    .big { width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center; font-size: 44px; animation: pop .7s var(--spring) both; }
    .big.ok { background: var(--ok-soft); color: var(--ok); } .big.no { background: var(--surface-2); color: var(--text-3); }
  `],
})
export class GuardianPage implements OnInit {
  private api = inject(Api);
  private ui = inject(Ui);
  private motion = inject(Motion);
  private nav = inject(NavController);
  auth = inject(AuthService);
  i18n = inject(I18n);
  token = input.required<string>();
  invite = signal<GuardianInvite | null>(null);
  loading = signal(true);
  busy = signal(false);
  agree = signal(false);
  error = signal('');
  state = signal<'ask' | 'accepted' | 'declined'>('ask');
  here = computed(() => '/guardian/' + this.token());

  async ngOnInit() {
    try { this.invite.set(await this.api.guardianInvite(this.token())); } catch { this.invite.set(null); }
    this.loading.set(false);
  }

  async accept() {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.guardianAccept(this.token());
      this.state.set('accepted');
      this.motion.seal(this.i18n.t('guard.accepted', { name: this.invite()!.teenUsername }));
    } catch (e) {
      this.error.set(this.ui.errorText(e));
      if (errorCode(e) === 'PARENT_NOT_VERIFIED') this.nav.navigateForward('/verify', { queryParams: { next: this.here() } });
    }
    this.busy.set(false);
  }

  async decline() {
    if (!(await this.ui.confirm(this.i18n.t('guard.declineConfirm'), this.i18n.t('guard.decline')))) return;
    this.busy.set(true);
    try { await this.api.guardianDecline(this.token()); this.state.set('declined'); } catch (e) { this.ui.error(e); }
    this.busy.set(false);
  }
}

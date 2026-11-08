import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { IonContent, IonIcon, NavController } from '@ionic/angular';
import { ONBOARDED_KEY } from '../core/guards';
import { I18n, LANGUAGES, Lang, TPipe } from '../core/i18n.service';
import { LogoComponent } from '../shared/logo.component';

@Component({
  selector: 'page-onboarding',
  imports: [IonContent, IonIcon, TPipe, LogoComponent],
  template: `
    <ion-content [fullscreen]="true" class="ob">
      <div class="wrap">
        <section class="hero">
          <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
          <div class="ring"></div>
          <img class="float f1" src="assets/demo/car-ev.svg" alt="" />
          <img class="float f2" src="assets/demo/phone.svg" alt="" />
          <img class="float f3" src="assets/demo/headphones.svg" alt="" />
          <div class="logo-wrap"><cmp-logo [size]="74" [animate]="true" /></div>
        </section>

        <section class="body">
          <span class="rocket reveal" style="--i:1">🚀</span>
          <div class="headline">
            @for (s of slides; track s; let i = $index) {
              <div class="slide" [class.on]="slide() === i">
                <h1>{{ 'onboarding.s' + s + 'title' | t }}</h1>
                <p class="muted">{{ 'onboarding.s' + s + 'sub' | t }}</p>
              </div>
            }
          </div>
          <div class="dots">@for (s of slides; track s; let i = $index) { <span [class.on]="slide() === i"></span> }</div>

          <div class="features">
            @for (f of ['f1', 'f2', 'f3']; track f; let i = $index) {
              <div class="feat reveal" [style.--i]="i + 3"><span class="ck"><ion-icon name="checkmark"></ion-icon></span>{{ 'onboarding.' + f | t }}</div>
            }
          </div>

          <div class="lang reveal" style="--i:7">
            <div class="lbl"><ion-icon name="language-outline"></ion-icon>{{ 'onboarding.chooseLanguage' | t }}</div>
            <div class="hscroll">
              @for (l of languages; track l.code) {
                <button class="chip" [class.active]="i18n.lang() === l.code" (click)="pick(l.code)">{{ l.flag }} {{ l.name }}</button>
              }
            </div>
          </div>

          <button class="btn block cta reveal" style="--i:8" (click)="start('/register')">{{ 'onboarding.getStarted' | t }} <ion-icon name="arrow-forward"></ion-icon></button>
          <div class="sub reveal" style="--i:9">
            <button class="btn ghost" (click)="start('/login')">{{ 'onboarding.haveAccount' | t }}</button>
            <button class="btn ghost" (click)="start('/home')">{{ 'onboarding.guest' | t }}</button>
          </div>
        </section>
      </div>
    </ion-content>
  `,
  styles: [`
    .wrap { max-width: 520px; margin: 0 auto; min-height: 100%; display: flex; flex-direction: column; padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom); }
    .hero { position: relative; height: 42vh; min-height: 300px; margin: 10px 10px 0; border-radius: 34px; overflow: hidden;
      background: linear-gradient(160deg, #cfc6ff 0%, #a99bf2 45%, #ece9ff 100%); box-shadow: inset 0 -60px 80px -40px rgba(255,255,255,.9); }
    :host-context(.dark) .hero { background: linear-gradient(160deg, #2b2356 0%, #1b1640 50%, #121216 100%); box-shadow: inset 0 -60px 80px -40px rgba(10,10,12,.9); }
    .blob { position: absolute; border-radius: 50%; filter: blur(30px); opacity: .75; animation: blob 12s ease-in-out infinite; }
    .b1 { width: 220px; height: 220px; background: #ff8a7f; top: -40px; right: -40px; }
    .b2 { width: 260px; height: 260px; background: #7b5cff; bottom: -80px; left: -60px; animation-delay: -4s; }
    .b3 { width: 160px; height: 160px; background: #fff; top: 40%; left: 40%; opacity: .5; animation-delay: -8s; }
    .ring { position: absolute; width: 420px; height: 420px; left: 50%; top: 52%; margin: -210px 0 0 -210px; border-radius: 50%;
      border: 1.5px dashed rgba(255,255,255,.55); animation: spinSlow 40s linear infinite; }
    .float { position: absolute; width: 46%; border-radius: 26px; box-shadow: 0 30px 50px -20px rgba(40, 20, 120, .45); animation: floaty 6s ease-in-out infinite; }
    .f1 { width: 62%; left: 19%; top: 24%; --rot: -2deg; z-index: 2; }
    .f2 { width: 30%; left: 4%; top: 8%; --rot: -10deg; animation-delay: -2s; }
    .f3 { width: 30%; right: 4%; top: 6%; --rot: 9deg; animation-delay: -4s; }
    .logo-wrap { position: absolute; left: 24px; bottom: 20px; z-index: 3; }
    .body { padding: 22px 22px 26px; display: flex; flex-direction: column; flex: 1; }
    .rocket { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 15px; background: var(--surface); box-shadow: var(--shadow-card); font-size: 20px; }
    .headline { position: relative; min-height: 132px; margin-top: 16px; }
    .slide { position: absolute; inset: 0; opacity: 0; transform: translateY(14px); transition: opacity .7s var(--ease), transform .7s var(--ease); pointer-events: none; }
    .slide.on { opacity: 1; transform: none; }
    .slide h1 { font-size: 36px; } .slide p { margin-top: 10px; font-size: 15px; line-height: 1.5; max-width: 380px; }
    .dots { display: flex; gap: 6px; margin: 6px 0 16px; }
    .dots span { width: 7px; height: 7px; border-radius: 99px; background: var(--surface-3); transition: all .4s var(--ease); }
    .dots span.on { width: 24px; background: var(--text); }
    .features { display: flex; flex-direction: column; gap: 10px; }
    .feat { display: flex; align-items: center; gap: 12px; height: 52px; padding: 0 16px 0 8px; border-radius: 999px; background: var(--surface);
      box-shadow: var(--shadow-card); border: 1px solid var(--line); font-weight: 550; font-size: 14.5px; }
    .ck { width: 36px; height: 36px; border-radius: 50%; background: var(--btn-dark); color: var(--btn-dark-text); display: grid; place-items: center; }
    .lang { margin-top: 22px; }
    .lbl { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text-2); margin-bottom: 8px; }
    .lang .hscroll { margin: 0 -22px; padding: 4px 22px 10px; }
    .cta { margin-top: 18px; height: 60px; font-size: 17px; }
    .sub { display: flex; justify-content: space-between; margin-top: 4px; }
  `],
})
export class OnboardingPage implements OnInit, OnDestroy {
  i18n = inject(I18n);
  private nav = inject(NavController);
  languages = LANGUAGES;
  slides = [1, 2, 3];
  slide = signal(0);
  private timer: any;

  ngOnInit() { this.timer = setInterval(() => this.slide.update((s) => (s + 1) % 3), 3600); }
  ngOnDestroy() { clearInterval(this.timer); }

  pick(l: Lang) { this.i18n.use(l, true); }

  start(path: string) {
    localStorage.setItem(ONBOARDED_KEY, '1');
    if (!this.i18n.hasChosen()) this.i18n.use(this.i18n.lang(), true);
    this.nav.navigateRoot(path, { animationDirection: 'forward' });
  }
}

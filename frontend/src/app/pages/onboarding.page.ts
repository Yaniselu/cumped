import { MOTION } from '../shared/motion.directives';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { IonContent, IonIcon, NavController } from '@ionic/angular';
import { ONBOARDED_KEY } from '../core/guards';
import { I18n, LANGUAGES, Lang, TPipe } from '../core/i18n.service';
import { LogoComponent } from '../shared/logo.component';

@Component({
  selector: 'page-onboarding',
  imports: [MOTION, IonContent, IonIcon, TPipe, LogoComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true" class="ob">
      <div class="wrap">
        <section class="hero" cmpParallax>
          <div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div>
          <div class="ring"></div><div class="ring r2"></div>
          <div class="sparkles">@for (s of sparkles; track $index) { <i [style.left.%]="s.x" [style.top.%]="s.y" [style.animation-delay]="s.d + 's'"></i> }</div>
          <div class="layer l1"><img class="float f1" src="assets/demo/car-ev.svg" alt="" /></div>
          <div class="layer l2"><img class="float f2" src="assets/demo/phone.svg" alt="" /></div>
          <div class="layer l3"><img class="float f3" src="assets/demo/headphones.svg" alt="" /></div>
          <div class="layer l4"><img class="float f4" src="assets/demo/watch.svg" alt="" /></div>
          <div class="layer l5"><img class="float f5" src="assets/demo/sneakers.svg" alt="" /></div>
          <div class="logo-wrap"><cmp-logo [size]="74" [animate]="true" /></div>
        </section>

        <section class="body">
          <span class="rocket reveal" style="--i:1">🚀</span>
          <div class="headline">
            @for (s of slides; track s; let i = $index) {
              <div class="slide" [class.on]="slide() === i">
                @if (slide() === i) { <h1 [cmpSplit]="'onboarding.s' + s + 'title' | t"></h1> } @else { <h1>{{ 'onboarding.s' + s + 'title' | t }}</h1> }
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
    .layer { position: absolute; inset: 0; transition: transform .5s var(--ease); pointer-events: none; }
    .l1 { transform: translate(calc(var(--px, 0) * 26px), calc(var(--py, 0) * 18px)); z-index: 3; }
    .l2 { transform: translate(calc(var(--px, 0) * -40px), calc(var(--py, 0) * -30px)); }
    .l3 { transform: translate(calc(var(--px, 0) * -34px), calc(var(--py, 0) * 26px)); }
    .l4 { transform: translate(calc(var(--px, 0) * 50px), calc(var(--py, 0) * -36px)); }
    .l5 { transform: translate(calc(var(--px, 0) * 44px), calc(var(--py, 0) * 34px)); }
    .float { position: absolute; animation: floaty 6s ease-in-out infinite; filter: drop-shadow(0 26px 30px rgba(40, 20, 120, .35)); }
    .f1 { width: 76%; left: 12%; top: 26%; --rot: -3deg; }
    .f2 { width: 30%; left: 2%; top: 2%; --rot: -14deg; animation-delay: -2s; }
    .f3 { width: 32%; right: 2%; top: 0%; --rot: 10deg; animation-delay: -4s; }
    .f4 { width: 22%; right: 6%; bottom: 4%; --rot: 14deg; animation-delay: -1s; }
    .f5 { width: 30%; left: 2%; bottom: 6%; --rot: -8deg; animation-delay: -3s; }
    .ring.r2 { width: 300px; height: 300px; margin: -150px 0 0 -150px; border-style: solid; border-color: rgba(255,255,255,.35); animation-direction: reverse; animation-duration: 28s; }
    .sparkles i { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: #fff; box-shadow: 0 0 12px 3px rgba(255,255,255,.8);
      animation: twinkle 3s ease-in-out infinite; }
    @keyframes twinkle { 0%, 100% { opacity: 0; transform: scale(.3); } 50% { opacity: 1; transform: scale(1); } }
    .feat { transition: transform .4s var(--spring); } .feat:hover { transform: translateX(6px); }
    .ck { animation: pop .7s var(--spring) both; animation-delay: inherit; }
    .logo-wrap { position: absolute; left: 24px; bottom: 20px; z-index: 3; }
    .body { padding: 22px 22px 26px; display: flex; flex-direction: column; flex: 1; }
    .rocket { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: 15px; background: var(--surface); box-shadow: var(--shadow-card); font-size: 20px; }
    .headline { position: relative; min-height: 132px; margin-top: 16px; }
    .slide { position: absolute; inset: 0; opacity: 0; transform: translateY(-18px); filter: blur(6px); transition: opacity .3s var(--ease), transform .4s var(--ease), filter .3s; pointer-events: none; }
    .slide.on { opacity: 1; transform: none; filter: none; transition: opacity .5s .28s var(--ease), transform .7s .28s var(--spring), filter .5s .28s; }
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
  sparkles = Array.from({ length: 14 }, () => ({ x: Math.random() * 96, y: Math.random() * 90, d: -Math.random() * 3 }));
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

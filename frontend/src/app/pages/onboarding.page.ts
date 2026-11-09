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
          <div class="mosaic" aria-hidden="true">
            @for (t of tiles; track t.src; let i = $index) {
              <figure [class]="'tile t' + i"><img [src]="'assets/demo/photos/' + t.src + '.jpg'" alt="" decoding="async" /></figure>
            }
          </div>
          <div class="veil"></div>
          <div class="float-card c1 glass"><ion-icon name="checkmark-circle"></ion-icon><div><b>{{ 'onboarding.chipFair' | t }}</b><span>{{ 'onboarding.chipFairSub' | t }}</span></div></div>
          <div class="float-card c2 glass"><ion-icon name="shield-checkmark"></ion-icon><div><b>{{ 'onboarding.chipVerified' | t }}</b><span>{{ 'onboarding.chipVerifiedSub' | t }}</span></div></div>
          <div class="float-card c3 glass"><ion-icon name="pricetag"></ion-icon><div><b>{{ 'onboarding.chipOffer' | t }}</b><span>{{ 'onboarding.chipOfferSub' | t }}</span></div></div>
          <div class="logo-wrap"><cmp-logo [size]="64" [animate]="true" /></div>
        </section>

        <section class="body">
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
    .hero { position: relative; height: clamp(280px, 44vh, 440px); margin: 10px 10px 0; border-radius: 30px; overflow: hidden; background: #15131f; isolation: isolate; }
    .mosaic { position: absolute; inset: -6%; display: grid; grid-template-columns: 1.2fr 1fr 1fr; grid-template-rows: 1fr 1fr 1fr; gap: 8px;
      transform: rotate(-8deg) scale(1.08) translate(calc(var(--px, 0) * -10px), calc(var(--py, 0) * -8px)); transition: transform .6s var(--ease); }
    .tile { margin: 0; border-radius: 18px; overflow: hidden; background: #222; animation: tileIn .9s var(--ease) both; animation-delay: calc(var(--d, 0) * 70ms); }
    .tile img { width: 100%; height: 100%; object-fit: cover; animation: kenburns 18s ease-in-out infinite alternate; }
    .t0 { grid-row: span 2; --d: 0; } .t1 { --d: 1; } .t2 { --d: 2; } .t3 { --d: 3; } .t4 { --d: 4; } .t5 { grid-column: span 2; --d: 5; } .t6 { --d: 6; }
    .t1 img, .t4 img { animation-delay: -6s; } .t2 img, .t5 img { animation-delay: -11s; }
    @keyframes tileIn { from { opacity: 0; transform: translateY(24px) scale(.94); } }
    @keyframes kenburns { from { transform: scale(1.02); } to { transform: scale(1.14) translate(-2%, -1%); } }
    .veil { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(14,12,26,.05) 30%, rgba(14,12,26,.72) 100%); }
    .float-card { position: absolute; z-index: 3; display: flex; align-items: center; gap: 10px; padding: 9px 14px 9px 10px; border-radius: 18px;
      color: #fff; max-width: 62%; animation: cardIn .8s var(--spring) both, drift 7s ease-in-out infinite alternate; }
    .float-card ion-icon { font-size: 26px; flex: 0 0 auto; }
    .float-card div { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
    .float-card b { font-size: 13.5px; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .float-card span { font-size: 11.5px; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .c1 { top: 16px; left: 14px; animation-delay: .5s, 0s; } .c1 ion-icon { color: #4ee0a2; }
    .c2 { top: 38%; right: 14px; animation-delay: .7s, -2s; } .c2 ion-icon { color: #b9a8ff; }
    .c3 { bottom: 84px; left: 22px; animation-delay: .9s, -4s; } .c3 ion-icon { color: #ffb0a8; }
    .hero .glass { background: rgba(20, 18, 34, .38); border-color: rgba(255,255,255,.22); box-shadow: 0 14px 30px -14px rgba(0,0,0,.6), inset 1px 1px 0 rgba(255,255,255,.25); }
    .hero .glass::before { opacity: .2; }
    @keyframes cardIn { from { opacity: 0; transform: translateY(16px) scale(.92); } }
    @keyframes drift { from { translate: 0 0; } to { translate: 0 -6px; } }
    .feat { transition: transform .4s var(--spring); } .feat:hover { transform: translateX(6px); }
    .ck { animation: pop .7s var(--spring) both; animation-delay: inherit; }
    .logo-wrap { position: absolute; left: 20px; bottom: 18px; z-index: 3; }
    @media (max-width: 340px) { .float-card { max-width: 78%; padding: 7px 10px 7px 8px; } .c2 { display: none; } .slide h1 { font-size: 30px !important; } }
    .body { padding: 22px 22px 26px; display: flex; flex-direction: column; flex: 1; }
    .headline { position: relative; min-height: 132px; margin-top: 6px; }
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
  /** Fotografii reale (Unsplash, vezi docs/CREDITS.md) într-un mozaic înclinat. */
  tiles = ['bmw-1', 'iphone-pro-1', 'watch-1', 'sofa-1', 'headphones-1', 'apartment-1', 'nike-1'].map((src) => ({ src }));
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

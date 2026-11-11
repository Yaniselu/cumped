import { MOTION } from '../shared/motion.directives';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonRefresher, IonRefresherContent, ViewDidEnter } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Badges } from '../core/badges.service';
import { I18n, TPipe } from '../core/i18n.service';
import { CATEGORY_ICONS } from '../core/icons';
import { CATEGORIES, Card } from '../core/models';
import { AvatarComponent } from '../shared/avatar.component';
import { ListingCardComponent } from '../shared/listing-card.component';
import { LogoComponent } from '../shared/logo.component';
import { SkeletonGridComponent } from '../shared/skeleton.component';

@Component({
  selector: 'page-home',
  imports: [MOTION, IonContent, IonIcon, IonRefresher, IonRefresherContent, IonInfiniteScroll, IonInfiniteScrollContent, RouterLink, TPipe,
    ListingCardComponent, SkeletonGridComponent, AvatarComponent, LogoComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content></ion-refresher-content></ion-refresher>
      <div class="page">
        <header class="hdr topbar app-only">
          <cmp-logo [size]="40" />
          <div class="hello">
            <span class="faint small">{{ greeting() }}</span>
            <strong>{{ auth.user() ? ('home.hello' | t: { name: auth.user()!.displayName }) : ('home.helloGuest' | t) }}</strong>
          </div>
          <a class="icon-btn" [routerLink]="auth.loggedIn() ? '/notifications' : '/login'"><ion-icon name="notifications-outline"></ion-icon>
            @if (badges.counts().notifications) { <span class="dot"></span> }</a>
          @if (auth.user(); as u) {
            <a routerLink="/profile"><cmp-avatar [name]="u.displayName" [hue]="u.avatarHue" [size]="48" [verified]="u.idVerified" /></a>
          }
        </header>

        <section class="hero" cmpParallax>
          <h1 [cmpSplit]="'home.heroTitle' | t"></h1>
          <a routerLink="/search" class="searchbar glass press sb-in">
            <ion-icon name="search"></ion-icon><span class="ph">{{ 'home.searchPh' | t }}</span>
            <span class="icon-btn"><ion-icon name="options-outline"></ion-icon></span>
          </a>
        </section>

        <div class="hscroll cats">
          @for (c of categories; track c; let i = $index) {
            <a class="cat rv" [routerLink]="['/search']" [queryParams]="{ category: c }" [style.--h]="(i * 37) % 360" [style.--i]="i % 6">
              <span class="ic glass"><ion-icon [name]="icons[c]"></ion-icon></span>
              <span class="lb">{{ 'categories.' + c | t }}</span>
            </a>
          }
        </div>

        <a routerLink="/why" fragment="protection" class="safe card press rv">
          <span class="shield"><ion-icon name="shield-checkmark"></ion-icon></span>
          <div><strong>{{ 'home.protectTitle' | t }}</strong><p class="muted small">{{ 'home.protectSub' | t }}</p></div>
          <ion-icon name="chevron-forward" class="faint"></ion-icon>
        </a>

        @if (promoted().length) {
          <div class="section-head rv"><h2>{{ 'home.promoted' | t }}</h2><a routerLink="/search">{{ 'common.seeAll' | t }}</a></div>
          <div class="hscroll">
            @for (c of promoted(); track c.id; let i = $index) { <cmp-listing-card class="rv" [style.--i]="i" [item]="c" [compact]="true" /> }
          </div>
        }

        @if (drops().length) {
          <div class="section-head rv"><h2><ion-icon name="trending-down" class="dropic"></ion-icon> {{ 'home.drops' | t }}</h2></div>
          <div class="hscroll">
            @for (c of drops(); track c.id; let i = $index) { <cmp-listing-card class="rv" [style.--i]="i" [item]="c" [compact]="true" /> }
          </div>
        }

        <a routerLink="/sell" class="sellcta press rv tilt"><span class="glare"></span><span class="orb o1"></span><span class="orb o2"></span>
          <div><h3>{{ 'home.sellTitle' | t }}</h3><p>{{ 'home.sellSub' | t }}</p></div>
          <span class="btn sm">{{ 'home.sellCta' | t }}</span>
          <span class="ph1"><img src="assets/demo/photos/camera-1-thumb.jpg" alt="" /></span>
          <span class="ph2"><img src="assets/demo/photos/watch-2-thumb.jpg" alt="" /></span>
        </a>

        <div class="section-head rv"><h2>{{ 'home.recent' | t }}</h2></div>
        @if (loading()) { <cmp-skeleton-grid [count]="8" /> }
        @else {
          <div class="grid">
            @for (c of recent(); track c.id; let i = $index) { <cmp-listing-card class="rv" [style.--i]="i % 4" [item]="c" /> }
          </div>
        }
        <ion-infinite-scroll (ionInfinite)="more($event)" [disabled]="!hasMore()"><ion-infinite-scroll-content></ion-infinite-scroll-content></ion-infinite-scroll>
      </div>
    </ion-content>
  `,
  styles: [`
    .hdr { display: flex; align-items: center; gap: 12px; margin: 4px 0 18px; }
    .hello { flex: 1; display: flex; flex-direction: column; line-height: 1.2; } .hello strong { font-family: var(--font-display); font-size: 18px; }
    .hero { position: relative; }
    .hero h1 { position: relative; font-size: clamp(28px, 8.6vw, 36px); margin-bottom: 18px; max-width: 520px; transform: translateY(calc(var(--scroll, 0) * -0.12px)); }
    .sb-in { animation: fadeUp .8s .35s var(--spring) both; }
    .cat:hover .ic ion-icon, .cat:active .ic ion-icon { animation: pop .6s var(--spring); }
    @media (min-width: 992px) { .hero h1 { font-size: 52px; } .hero { margin: 10px 0 8px; } }
    .ph { flex: 1; color: var(--text-3); font-size: 16px; }
    .cats { margin-top: 18px; }
    .cat { width: 84px; display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text); }
    .ic { width: 66px; height: 66px; border-radius: 24px; display: grid; place-items: center; transition: transform .45s var(--spring); }
    .cat:hover .ic { transform: translateY(-4px) rotate(-4deg); }
    .ic ion-icon { font-size: 26px; color: hsl(calc(250 + var(--h) * 0.3) 70% 58%); }
    .lb { font-size: 13px; font-weight: 550; text-align: center; color: var(--text-2); line-height: 1.2; }
    .safe { display: flex; align-items: center; gap: 14px; padding: 14px 16px; margin-top: 12px; color: inherit; }
    .shield { width: 46px; height: 46px; border-radius: 16px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); flex: 0 0 auto; animation: pulseSoft 2.8s ease-in-out infinite; }
    .shield ion-icon { font-size: 24px; }
    .safe div { flex: 1; } .safe p { margin-top: 2px; }
    .dropic { color: var(--accent-2); vertical-align: -3px; }
    .sellcta { position: relative; display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; margin-top: 28px; padding: 22px; min-height: 150px;
      border-radius: var(--r-xl); overflow: hidden; color: #fff; background: linear-gradient(135deg, #5b3df5 0%, #8b6dff 55%, #ff7a6e 130%); box-shadow: 0 24px 50px -24px rgba(91,61,245,.7); }
    .sellcta div { position: relative; z-index: 2; max-width: 60%; } .sellcta p { opacity: .85; font-size: 15px; margin-top: 6px; }
    .sellcta .btn { position: relative; z-index: 2; background: #fff; color: #111; }
    .ph1, .ph2 { position: absolute; border-radius: 16px; overflow: hidden; border: 3px solid rgba(255,255,255,.9); box-shadow: 0 18px 30px -12px rgba(20,10,60,.55); z-index: 1; }
    .ph1 { width: 118px; height: 96px; right: 18px; top: -10px; transform: rotate(8deg); }
    .ph2 { width: 86px; height: 72px; right: 108px; top: 6px; transform: rotate(-7deg); }
    .ph1 img, .ph2 img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .sellcta:hover .ph1 { transform: rotate(4deg) translateY(4px); } .sellcta:hover .ph2 { transform: rotate(-3deg) translateY(6px); }
    .ph1, .ph2 { transition: transform .6s var(--spring); }
    @media (max-width: 380px) { .ph2 { display: none; } .sellcta div { max-width: 58%; } }
    .orb { position: absolute; border-radius: 50%; filter: blur(22px); opacity: .7; animation: blob 9s ease-in-out infinite; }
    .o1 { width: 140px; height: 140px; background: #ffb4ab; right: 20%; bottom: -60px; } .o2 { width: 110px; height: 110px; background: #9f8bff; left: -30px; top: -30px; animation-delay: -4s; }
  `],
})
export class HomePage implements ViewDidEnter {
  private api = inject(Api);
  auth = inject(AuthService);
  badges = inject(Badges);
  i18n = inject(I18n);
  categories = CATEGORIES;
  icons = CATEGORY_ICONS;
  loading = signal(true);
  recent = signal<Card[]>([]);
  promoted = computed(() => this.recent().filter((c) => c.promoted).slice(0, 8));
  drops = computed(() => this.recent().filter((c) => c.previousPriceCents).slice(0, 8));
  hasMore = signal(false);
  private page = 0;
  private loadedOnce = false;

  greeting() {
    const h = new Date().getHours();
    return new Intl.DateTimeFormat(this.i18n.locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()) + (h < 0 ? '' : '');
  }

  ionViewDidEnter() { if (!this.loadedOnce) this.load(); }

  async load() {
    this.page = 0;
    try {
      const r = await this.api.search({ sort: 'newest', size: 24, page: 0 });
      this.recent.set(r.items);
      this.hasMore.set(r.hasMore);
      this.loadedOnce = true;
    } catch { /* afișăm ce avem */ }
    this.loading.set(false);
  }

  async more(ev: any) {
    try {
      const r = await this.api.search({ sort: 'newest', size: 24, page: ++this.page });
      this.recent.update((l) => [...l, ...r.items]);
      this.hasMore.set(r.hasMore);
    } finally { ev.target.complete(); }
  }

  async refresh(ev: any) { await this.load(); this.badges.refresh(); ev.target.complete(); }
}

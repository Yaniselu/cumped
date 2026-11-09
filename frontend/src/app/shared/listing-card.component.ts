import { Component, ElementRef, ViewChild, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { HeroTransition } from '../core/hero.service';
import { I18n, TPipe } from '../core/i18n.service';
import { Card } from '../core/models';
import { Motion } from '../core/motion.service';
import { Ui } from '../core/ui.service';

/**
 * Cardul de anunț: fotografie reală încadrată (miniatură optimizată), insigne discrete,
 * inimă cu explozie, înclinare ușoară pe desktop și tranziție hero spre pagina anunțului.
 */
@Component({
  selector: 'cmp-listing-card',
  imports: [RouterLink, IonIcon, TPipe],
  template: `
    <a class="lc tilt" [routerLink]="['/listing', item().id]" [class.compact]="compact()" (click)="go()">
      <span class="glare"></span>
      <div class="media" [class.ready]="loaded()">
        @if (item().imageUrl && !failed()) {
          <img #img [src]="api.url(item().imageUrl)" [alt]="item().title" loading="lazy" decoding="async"
               (load)="loaded.set(true)" (error)="failed.set(true)" [class.ready]="loaded()" />
        } @else { <div class="noimg"><ion-icon name="image-outline"></ion-icon></div> }
        <span class="shade"></span>
        <div class="tl">
          @if (item().previousPriceCents) { <span class="badge glass-b drop"><ion-icon name="trending-down"></ion-icon>{{ 'listing.drop' | t }}</span> }
          @else if (item().promoted) { <span class="badge glass-b"><ion-icon name="sparkles"></ion-icon>{{ 'listing.promoted' | t }}</span> }
          @else if (item().condition === 'NEW') { <span class="badge glass-b">{{ 'common.new' | t }}</span> }
          @if (item().status !== 'ACTIVE') { <span class="badge glass-b">{{ 'listing.status.' + item().status | t }}</span> }
        </div>
        <button #heart class="fav icon-btn sm" [class.on]="fav()" (click)="toggle($event)" [attr.aria-label]="'nav.favorites' | t" [attr.aria-pressed]="fav()">
          <ion-icon [name]="fav() ? 'heart' : 'heart-outline'" [class.popped]="popped()"></ion-icon>
        </button>
        <div class="bl">
          @if (item().acceptsSwap) { <span class="badge glass-b sq" [attr.aria-label]="'listing.swapOk' | t"><ion-icon name="swap-horizontal"></ion-icon></span> }
          @if (item().negotiable) { <span class="badge glass-b">{{ 'listing.negotiableShort' | t }}</span> }
        </div>
      </div>
      <div class="info">
        <div class="t">{{ item().title }}</div>
        <div class="pr">
          <span class="price">{{ i18n.price(item().priceCents, item().currency) }}</span>
          @if (item().previousPriceCents) { <span class="old">{{ i18n.price(item().previousPriceCents, item().currency) }}</span> }
        </div>
        <div class="loc">
          <ion-icon name="location-outline"></ion-icon><span>{{ item().city }}</span>
          @if (item().sellerBusiness) { <span class="biz">{{ 'seller.business' | t }}</span> }
          @if (item().sellerVerified) { <ion-icon class="vf" name="shield-checkmark" [attr.aria-label]="'user.verified' | t"></ion-icon> }
        </div>
      </div>
    </a>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .lc { position: relative; display: block; color: inherit; border-radius: 22px; background: var(--card-fill); border: 1px solid var(--line);
      box-shadow: var(--shadow-card); overflow: hidden; isolation: isolate; transition: box-shadow .35s var(--ease), transform .6s var(--spring); }
    .lc:hover { box-shadow: 0 22px 44px -22px rgba(30, 20, 80, .32); }
    .lc:active { transform: scale(.98); }
    .media { position: relative; aspect-ratio: 4 / 3.4; background: var(--image-bg); margin: 5px 5px 0; border-radius: 18px; overflow: hidden; }
    .media:not(.ready)::before { content: ''; position: absolute; inset: 0;
      background: linear-gradient(90deg, var(--surface-2) 0px, var(--surface-3) 120px, var(--surface-2) 240px); background-size: 920px 100%; animation: shimmer 1.3s linear infinite; }
    img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transform: scale(1.03); transition: opacity .5s var(--ease), transform .9s var(--ease); }
    img.ready { opacity: 1; transform: none; }
    .lc:hover img.ready { transform: scale(1.04); }
    .shade { position: absolute; inset: auto 0 0 0; height: 38%; pointer-events: none; background: linear-gradient(transparent, rgba(0,0,0,.18)); }
    .noimg { position: absolute; inset: 0; display: grid; place-items: center; color: var(--text-3); font-size: 34px; }
    .tl { position: absolute; top: 8px; left: 8px; display: flex; gap: 5px; flex-wrap: wrap; max-width: calc(100% - 56px); z-index: 2; }
    .bl { position: absolute; bottom: 8px; left: 8px; right: 8px; display: flex; gap: 5px; z-index: 2; flex-wrap: wrap; }
    .badge { height: 24px; font-size: 11.5px; padding: 0 9px; }
    .badge.sq { padding: 0 7px; }
    .drop ion-icon { color: var(--accent-2); }
    .fav { position: absolute; top: 6px; right: 6px; z-index: 2; }
    .fav.on ion-icon { color: var(--accent-2); }
    .popped { animation: pop .55s var(--spring); }
    .info { position: relative; padding: 10px 12px 12px; }
    .t { font-weight: 600; font-size: 14px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.6em; overflow-wrap: anywhere; }
    .pr { display: flex; align-items: baseline; gap: 6px 8px; margin-top: 5px; flex-wrap: wrap; }
    .price { font-family: var(--font-display); font-weight: 700; font-size: clamp(16px, 4.6vw, 19px); letter-spacing: -0.02em; white-space: nowrap; }
    .old { font-size: 12.5px; color: var(--text-3); text-decoration: line-through; white-space: nowrap; }
    .loc { display: flex; align-items: center; gap: 4px; margin-top: 5px; font-size: 12.5px; color: var(--text-2); min-width: 0; }
    .loc span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
    .biz { flex: 0 0 auto; font-size: 10.5px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; color: var(--accent); background: var(--accent-soft); padding: 2px 6px; border-radius: 6px; }
    .vf { color: var(--accent); margin-left: auto; font-size: 15px; flex: 0 0 auto; }
    .compact .media { aspect-ratio: 1; }
    .compact { width: 168px; }
    @media (max-width: 340px) {
      .info { padding: 8px 9px 10px; } .t { font-size: 13px; } .biz { display: none; } .bl .badge:not(.sq) { display: none; }
      .compact { width: 148px; }
    }
  `],
})
export class ListingCardComponent {
  api = inject(Api);
  i18n = inject(I18n);
  private auth = inject(AuthService);
  private ui = inject(Ui);
  private motion = inject(Motion);
  private hero = inject(HeroTransition);
  @ViewChild('img') img?: ElementRef<HTMLImageElement>;
  @ViewChild('heart') heart?: ElementRef<HTMLElement>;
  item = input.required<Card>();
  compact = input(false);
  changed = output<boolean>();
  loaded = signal(false);
  failed = signal(false);
  popped = signal(false);
  private override = signal<boolean | null>(null);
  fav = computed(() => this.override() ?? this.item().favorite);

  go() { this.hero.capture(this.item().id, this.img?.nativeElement ?? null); }

  async toggle(ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!this.auth.loggedIn()) { this.ui.toast(this.i18n.t('common.loginRequired')); return; }
    const next = !this.fav();
    this.override.set(next);
    if (next) {
      this.popped.set(false); queueMicrotask(() => this.popped.set(true));
      if (this.heart) this.motion.burst(this.heart.nativeElement);
      this.ui.tap();
    }
    try { await this.api.favorite(this.item().id, next); this.changed.emit(next); }
    catch (e) { this.override.set(!next); this.ui.error(e); }
  }
}

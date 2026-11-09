import { Component, ElementRef, ViewChild, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { HeroTransition } from '../core/hero.service';
import { I18n, TPipe } from '../core/i18n.service';
import { Card } from '../core/models';
import { Motion, isCutout } from '../core/motion.service';
import { Ui } from '../core/ui.service';

/**
 * Cardul de anunț: ilustrațiile (SVG fără fundal) stau direct pe card și plutesc;
 * pozele reale rămân încadrate. Înclinare 3D cu reflexie, inimă cu explozie, tranziție hero spre anunț.
 */
@Component({
  selector: 'cmp-listing-card',
  imports: [RouterLink, IonIcon, TPipe],
  template: `
    <a class="lc tilt" [routerLink]="['/listing', item().id]" [class.compact]="compact()" [class.cut]="cutout()" (click)="go()"
       [style.--hue]="hue()" [style.--r0]="tiltDeg()">
      <span class="glare"></span>
      <div class="media">
        @if (cutout()) { <span class="spot"></span> }
        @if (item().imageUrl) {
          <div class="floater" [style.animation-delay]="bobDelay()">
            <img #img [src]="api.url(item().imageUrl)" [alt]="item().title" loading="lazy" (load)="loaded.set(true)"
                 [class.ready]="loaded()" [class.cutout-img]="cutout()" />
          </div>
        } @else { <div class="noimg"><ion-icon name="image-outline"></ion-icon></div> }
        <div class="tl">
          @if (item().previousPriceCents) { <span class="badge glass-b drop"><ion-icon name="trending-down"></ion-icon>{{ 'listing.drop' | t }}</span> }
          @else if (item().promoted) { <span class="badge glass-b"><ion-icon name="sparkles"></ion-icon>{{ 'listing.promoted' | t }}</span> }
          @else if (item().condition === 'NEW') { <span class="badge glass-b">{{ 'common.new' | t }}</span> }
          @if (item().status !== 'ACTIVE') { <span class="badge glass-b">{{ 'listing.status.' + item().status | t }}</span> }
        </div>
        <button #heart class="fav icon-btn sm" [class.on]="fav()" (click)="toggle($event)" [attr.aria-label]="'nav.favorites' | t">
          <ion-icon [name]="fav() ? 'heart' : 'heart-outline'" [class.popped]="popped()"></ion-icon>
        </button>
        @if (item().acceptsSwap) { <span class="swap badge glass-b"><ion-icon name="swap-horizontal"></ion-icon></span> }
      </div>
      <div class="info">
        <div class="t">{{ item().title }}</div>
        <div class="pr">
          <span class="price">{{ i18n.price(item().priceCents, item().currency) }}</span>
          @if (item().previousPriceCents) { <span class="old">{{ i18n.price(item().previousPriceCents, item().currency) }}</span> }
        </div>
        <div class="loc">
          <ion-icon name="location-outline"></ion-icon><span>{{ item().city }}</span>
          @if (item().sellerVerified) { <ion-icon class="vf" name="shield-checkmark"></ion-icon> }
        </div>
      </div>
    </a>
  `,
  styles: [`
    :host { display: block; }
    .lc { position: relative; display: block; color: inherit; border-radius: 26px; background: var(--card-fill); border: 1px solid var(--line);
      box-shadow: var(--shadow-card), inset 1px 1px 0 rgba(255,255,255,.65); overflow: hidden; isolation: isolate; }
    .lc:hover { box-shadow: 0 28px 50px -24px rgba(30, 20, 80, .35), inset 1px 1px 0 rgba(255,255,255,.65); }
    .lc:active { transform: perspective(900px) scale(.975); }
    .media { position: relative; aspect-ratio: 4 / 3.3; background: var(--image-bg); margin: 6px 6px 0; border-radius: 20px; overflow: hidden; }
    .cut .media { background: transparent; margin: 0; border-radius: 0; overflow: visible; aspect-ratio: 4 / 3.1; }
    .spot { position: absolute; left: 12%; right: 12%; top: 14%; bottom: 8%; border-radius: 50%; z-index: -1;
      background: radial-gradient(closest-side, hsl(var(--hue) 90% 72% / .45), hsl(calc(var(--hue) + 40) 90% 70% / .15) 60%, transparent);
      filter: blur(6px); animation: spotlight 6s ease-in-out infinite; }
    img { width: 100%; height: 100%; object-fit: cover; opacity: 0; transform: scale(1.04); transition: opacity .7s var(--ease), transform 1.2s var(--ease); }
    img.ready { opacity: 1; transform: none; }
    .floater { position: absolute; inset: 0; }
    .cut .floater { animation: bob 5.5s ease-in-out infinite; }
    .cut img { padding: 6% 4% 0; transition: opacity .7s var(--ease), transform .7s var(--spring); }
    .lc:hover img.ready:not(.cutout-img) { transform: scale(1.05); }
    .cut:hover img.ready { transform: translateY(-10px) scale(1.07) rotate(-2.5deg); }
    .noimg { position: absolute; inset: 0; display: grid; place-items: center; color: var(--text-3); font-size: 34px; }
    .tl { position: absolute; top: 10px; left: 10px; display: flex; gap: 6px; flex-wrap: wrap; max-width: 75%; z-index: 2; }
    .drop ion-icon { color: var(--accent-2); }
    .fav { position: absolute; top: 8px; right: 8px; z-index: 2; }
    .fav.on ion-icon { color: var(--accent-2); }
    .popped { animation: pop .55s var(--spring); }
    .swap { position: absolute; bottom: 10px; left: 10px; padding: 0 8px; z-index: 2; }
    .info { position: relative; padding: 12px 14px 14px; }
    .cut .info { padding-top: 6px; }
    .t { font-weight: 600; font-size: 14.5px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.6em; }
    .pr { display: flex; align-items: baseline; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
    .price { font-family: var(--font-display); font-weight: 700; font-size: 19px; letter-spacing: -0.02em; }
    .old { font-size: 13px; color: var(--text-3); text-decoration: line-through; }
    .loc { display: flex; align-items: center; gap: 4px; margin-top: 6px; font-size: 12.5px; color: var(--text-2); }
    .loc span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .vf { color: var(--accent); margin-left: auto; font-size: 15px; flex: 0 0 auto; }
    .compact .media { aspect-ratio: 1; } .compact.cut .media { aspect-ratio: 1.05; }
    .compact { width: 172px; }
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
  popped = signal(false);
  private override = signal<boolean | null>(null);
  fav = () => this.override() ?? this.item().favorite;
  cutout = computed(() => isCutout(this.item().imageUrl));
  /** Nuanță derivată din id: fiecare card are o lumină proprie în spatele produsului. */
  hue = computed(() => [...this.item().id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7));
  bobDelay = computed(() => `-${(this.hue() % 50) / 10}s`);
  tiltDeg = computed(() => `${(this.hue() % 7) - 3}deg`);

  go() { this.hero.capture(this.item().id, this.img?.nativeElement ?? null, this.cutout()); }

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

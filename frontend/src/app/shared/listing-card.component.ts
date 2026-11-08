import { Component, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, TPipe } from '../core/i18n.service';
import { Card } from '../core/models';
import { Ui } from '../core/ui.service';

/** Cardul de anunț din design: imagine pe fundal gri, inimă de sticlă, „Drop” la reducere, preț vechi tăiat. */
@Component({
  selector: 'cmp-listing-card',
  imports: [RouterLink, IonIcon, TPipe],
  template: `
    <a class="lc press" [routerLink]="['/listing', item().id]" [class.compact]="compact()">
      <div class="media">
        @if (item().imageUrl) {
          <img [src]="api.url(item().imageUrl)" [alt]="item().title" loading="lazy" (load)="loaded.set(true)" [class.ready]="loaded()" />
        } @else { <div class="noimg"><ion-icon name="image-outline"></ion-icon></div> }
        <div class="tl">
          @if (item().previousPriceCents) { <span class="badge glass-b drop"><ion-icon name="trending-down"></ion-icon>{{ 'listing.drop' | t }}</span> }
          @else if (item().promoted) { <span class="badge glass-b"><ion-icon name="sparkles"></ion-icon>{{ 'listing.promoted' | t }}</span> }
          @else if (item().condition === 'NEW') { <span class="badge glass-b">{{ 'common.new' | t }}</span> }
          @if (item().status !== 'ACTIVE') { <span class="badge glass-b">{{ 'listing.status.' + item().status | t }}</span> }
        </div>
        <button class="fav icon-btn sm" [class.on]="fav()" (click)="toggle($event)" [attr.aria-label]="'nav.favorites' | t">
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
    .lc { display: block; color: inherit; border-radius: var(--r-lg); background: var(--surface); box-shadow: var(--shadow-card); border: 1px solid var(--line); overflow: hidden; }
    .media { position: relative; aspect-ratio: 4 / 3.3; background: var(--image-bg); margin: 6px 6px 0; border-radius: 20px; overflow: hidden; }
    img { width: 100%; height: 100%; object-fit: cover; opacity: 0; transform: scale(1.04); transition: opacity .6s var(--ease), transform 1.2s var(--ease); }
    img.ready { opacity: 1; transform: none; }
    .lc:hover img.ready { transform: scale(1.04); }
    .noimg { position: absolute; inset: 0; display: grid; place-items: center; color: var(--text-3); font-size: 34px; }
    .tl { position: absolute; top: 10px; left: 10px; display: flex; gap: 6px; flex-wrap: wrap; max-width: 75%; }
    .drop ion-icon { color: var(--accent-2); }
    .fav { position: absolute; top: 8px; right: 8px; }
    .fav.on ion-icon { color: var(--accent-2); }
    .popped { animation: pop .5s var(--spring); }
    .swap { position: absolute; bottom: 10px; left: 10px; padding: 0 8px; }
    .info { padding: 12px 14px 14px; }
    .t { font-weight: 600; font-size: 14.5px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.6em; }
    .pr { display: flex; align-items: baseline; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
    .price { font-family: var(--font-display); font-weight: 700; font-size: 19px; letter-spacing: -0.02em; }
    .old { font-size: 13px; color: var(--text-3); text-decoration: line-through; }
    .loc { display: flex; align-items: center; gap: 4px; margin-top: 6px; font-size: 12.5px; color: var(--text-2); }
    .loc span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .vf { color: var(--accent); margin-left: auto; font-size: 15px; flex: 0 0 auto; }
    .compact .media { aspect-ratio: 1; }
    .compact { width: 168px; }
  `],
})
export class ListingCardComponent {
  api = inject(Api);
  i18n = inject(I18n);
  private auth = inject(AuthService);
  private ui = inject(Ui);
  item = input.required<Card>();
  compact = input(false);
  changed = output<boolean>();
  loaded = signal(false);
  popped = signal(false);
  private override = signal<boolean | null>(null);
  fav = () => this.override() ?? this.item().favorite;

  async toggle(ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!this.auth.loggedIn()) { this.ui.toast(this.i18n.t('common.loginRequired')); return; }
    const next = !this.fav();
    this.override.set(next);
    if (next) { this.popped.set(false); queueMicrotask(() => this.popped.set(true)); this.ui.tap(); }
    try { await this.api.favorite(this.item().id, next); this.changed.emit(next); }
    catch (e) { this.override.set(!next); this.ui.error(e); }
  }
}

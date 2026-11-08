import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonModal, NavController, ViewWillEnter } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, TPipe } from '../core/i18n.service';
import { CATEGORY_ICONS } from '../core/icons';
import { COUNTRIES, Card, Detail, PriceAnalysis, ShippingEstimate } from '../core/models';
import { Ui } from '../core/ui.service';
import { AvatarComponent } from '../shared/avatar.component';
import { BackButtonComponent } from '../shared/back-button.component';
import { ListingCardComponent } from '../shared/listing-card.component';

@Component({
  selector: 'page-listing',
  imports: [IonContent, IonIcon, IonModal, FormsModule, RouterLink, TPipe, AvatarComponent, BackButtonComponent, ListingCardComponent],
  template: `
    <ion-content [fullscreen]="true">
      <div class="page detail">
        <div class="topbar">
          <cmp-back />
          <div class="title">{{ 'categories.' + (d()?.category ?? 'OTHER') | t }}</div>
          @if (d(); as x) { <button class="icon-btn" (click)="x.owner ? null : report()"><ion-icon [name]="x.owner ? 'ellipsis-horizontal' : 'flag-outline'"></ion-icon></button> }
          @else { <div class="spacer"></div> }
        </div>

        @if (!d()) {
          <div class="layout"><div class="skeleton gal-sk"></div><div class="stack"><div class="skeleton" style="height:28px;width:70%"></div><div class="skeleton" style="height:22px;width:40%"></div><div class="skeleton" style="height:140px"></div></div></div>
        } @else {
          @let x = d()!;
          <div class="layout">
            <section class="left">
              <div class="gallery card reveal">
                <div class="track" (scroll)="onScroll($event)">
                  @for (img of x.images; track img.id) { <div class="slide"><img [src]="api.url(img.url)" [alt]="x.title" /></div> }
                  @if (!x.images.length) { <div class="slide empty"><ion-icon name="image-outline"></ion-icon></div> }
                </div>
                <div class="g-tl">
                  @if (x.previousPriceCents) { <span class="badge glass-b"><ion-icon name="trending-down" class="coral"></ion-icon>{{ 'listing.drop' | t }}</span> }
                  @if (x.condition === 'NEW') { <span class="badge glass-b">{{ 'common.new' | t }}</span> }
                  @if (x.promoted) { <span class="badge glass-b"><ion-icon name="sparkles"></ion-icon>{{ 'listing.promoted' | t }}</span> }
                  @if (x.status !== 'ACTIVE') { <span class="badge glass-b">{{ 'listing.status.' + x.status | t }}</span> }
                </div>
                <div class="g-tr">
                  <button class="icon-btn sm" (click)="share()"><ion-icon name="share-social-outline"></ion-icon></button>
                  @if (!x.owner) { <button class="icon-btn sm" [class.faved]="fav()" (click)="toggleFav()"><ion-icon [name]="fav() ? 'heart' : 'heart-outline'" [class.pop]="popped()"></ion-icon></button> }
                </div>
                @if (x.images.length > 1) { <div class="gdots">@for (img of x.images; track img.id; let i = $index) { <span [class.on]="i === slide()"></span> }</div> }
              </div>

              <div class="head card pad reveal" style="--i:1">
                <div class="row between top">
                  <h1>{{ x.title }}</h1>
                  <div class="prices"><div class="price">{{ i18n.price(x.priceCents, x.currency) }}</div>
                    @if (x.previousPriceCents) { <div class="old">{{ i18n.price(x.previousPriceCents, x.currency) }}</div> }</div>
                </div>
                <div class="row muted small loc"><ion-icon name="location-outline"></ion-icon>{{ x.city }}, {{ x.country }} · {{ 'listing.posted' | t: { when: i18n.ago(x.createdAt) } }}</div>
                @if (analysis(); as a) {
                  <div class="verdict" [attr.data-v]="a.verdict">
                    <span class="vi"><ion-icon name="sparkles"></ion-icon></span>
                    <div><strong>{{ 'price.' + a.verdict | t }}</strong>
                      @if (a.medianCents) { <p>{{ 'price.median' | t: { price: i18n.price(a.medianCents, a.currency), n: a.comparables } }}</p> }
                      @if (a.verdict === 'BELOW' && !x.seller.idVerified) { <p class="warnline">{{ 'price.belowWarn' | t }}</p> }
                    </div>
                    <span class="ai">AI</span>
                  </div>
                }
                <div class="tags">
                  @if (x.acceptsOffers) { <span class="badge accent"><ion-icon name="pricetag-outline"></ion-icon>{{ 'listing.acceptsOffers' | t }}</span> }
                  @if (x.acceptsSwap) { <span class="badge accent"><ion-icon name="swap-horizontal"></ion-icon>{{ 'listing.acceptsSwap' | t }}</span> }
                  <span class="badge" style="background:var(--surface-2)"><ion-icon name="eye-outline"></ion-icon>{{ x.views }} {{ 'listing.views' | t }}</span>
                </div>
              </div>

              @if (x.owner) {
                <div class="card pad owner reveal" style="--i:2">
                  <div class="row between"><h3>{{ 'listing.yourListing' | t }}</h3><span class="badge accent">{{ 'listing.status.' + x.status | t }}</span></div>
                  @if (x.ownerStats; as s) {
                    <div class="ostats">
                      <div><strong>{{ s.views }}</strong><span>{{ 'stats.views' | t }}</span></div>
                      <div><strong>{{ s.favorites }}</strong><span>{{ 'stats.favorites' | t }}</span></div>
                      <div><strong>{{ s.messages }}</strong><span>{{ 'stats.messages' | t }}</span></div>
                      <div><strong>{{ s.offers }}</strong><span>{{ 'stats.offers' | t }}</span></div>
                    </div>
                    <p class="faint small">{{ 'listing.expires' | t: { date: i18n.date(s.expiresAt, { day: 'numeric', month: 'long' }) } }}</p>
                  }
                  <div class="oacts">
                    <a class="chip" [routerLink]="['/sell', x.id]"><ion-icon name="create-outline"></ion-icon>{{ 'common.edit' | t }}</a>
                    @if (x.status === 'ACTIVE') {
                      <button class="chip" (click)="buy('PROMOTE_7D')"><ion-icon name="rocket-outline"></ion-icon>{{ 'listing.promote' | t }}</button>
                      <button class="chip" (click)="buy('BUMP')"><ion-icon name="arrow-up"></ion-icon>{{ 'listing.bump' | t }}</button>
                      <button class="chip" (click)="status('pause')"><ion-icon name="pause-outline"></ion-icon>{{ 'listing.pause' | t }}</button>
                      <button class="chip" (click)="status('sold')"><ion-icon name="bag-check-outline"></ion-icon>{{ 'listing.markSold' | t }}</button>
                    }
                    @if (x.status === 'PAUSED' || x.status === 'EXPIRED') { <button class="chip" (click)="status('activate')"><ion-icon name="play-outline"></ion-icon>{{ 'listing.activate' | t }}</button> }
                    <button class="chip danger" (click)="remove()"><ion-icon name="trash-outline"></ion-icon>{{ 'listing.remove' | t }}</button>
                  </div>
                </div>
              }
            </section>

            <section class="right">
              <div class="section-head"><h2>{{ 'listing.specs' | t }}</h2></div>
              <div class="specs">
                <div class="spec card reveal" style="--i:2"><span class="si"><ion-icon [name]="icons[x.category]"></ion-icon></span><span class="sl">{{ 'search.category' | t }}</span><span class="sv">{{ 'categories.' + x.category | t }}</span></div>
                <div class="spec card reveal" style="--i:3"><span class="si"><ion-icon name="sparkles"></ion-icon></span><span class="sl">{{ 'listing.condition' | t }}</span><span class="sv">{{ 'conditions.' + x.condition | t }}</span></div>
                @for (a of attrs(); track a[0]; let i = $index) {
                  <div class="spec card reveal" [style.--i]="i + 4"><span class="si"><ion-icon name="information-circle-outline"></ion-icon></span><span class="sl">{{ a[0] }}</span><span class="sv">{{ a[1] }}</span></div>
                }
              </div>

              <div class="section-head"><h2>{{ 'listing.description' | t }}</h2></div>
              <div class="card pad desc reveal">{{ x.description }}</div>

              @if (x.priceHistory.length > 1) {
                <div class="section-head"><h2>{{ 'listing.priceHistory' | t }}</h2></div>
                <div class="card pad chart reveal">
                  <svg viewBox="0 0 300 90" preserveAspectRatio="none">
                    <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".25"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
                    <path [attr.d]="chart().area" fill="url(#pg)" />
                    <path [attr.d]="chart().line" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="draw" />
                    @for (p of chart().points; track $index) { <circle [attr.cx]="p[0]" [attr.cy]="p[1]" r="4" fill="var(--surface)" stroke="var(--accent)" stroke-width="2.5" /> }
                  </svg>
                  <div class="row between small muted">@for (p of x.priceHistory; track $index) { <span>{{ i18n.price(p.priceCents, x.currency) }}</span> }</div>
                </div>
              }

              <div class="section-head"><h2>{{ 'listing.seller' | t }}</h2></div>
              <div class="card pad seller reveal">
                <a class="row" [routerLink]="['/user', x.seller.id]">
                  <cmp-avatar [name]="x.seller.displayName" [hue]="x.seller.avatarHue" [size]="56" [verified]="x.seller.idVerified" />
                  <div class="sinfo">
                    <strong>{{ x.seller.displayName }}</strong>
                    <span class="small muted">&#64;{{ x.seller.username }} · {{ 'listing.memberSince' | t: { date: i18n.date(x.seller.memberSince) } }}</span>
                    <span class="small stars">@if (x.seller.ratingCount) { ★ {{ x.seller.rating }} · {{ 'listing.reviews' | t: { n: x.seller.ratingCount } }} } @else { {{ 'listing.noReviews' | t }} }</span>
                  </div>
                  <div class="trust" [style.--p]="x.seller.trustScore"><span>{{ x.seller.trustScore }}</span></div>
                </a>
                <div class="sbadges">
                  @if (x.seller.idVerified) { <span class="badge ok"><ion-icon name="shield-checkmark"></ion-icon>{{ 'profile.verified' | t }}</span> }
                  @else { <span class="badge warn"><ion-icon name="alert-circle"></ion-icon>{{ 'profile.notVerified' | t }}</span> }
                  @if (x.seller.phoneVerified) { <span class="badge ok"><ion-icon name="phone-portrait"></ion-icon>Tel.</span> }
                </div>
                @if (x.seller.realNameAvailable && !x.owner) {
                  @if (realName()) { <div class="realname fade"><ion-icon name="key-outline"></ion-icon>{{ realName() }}</div> }
                  @else { <button class="btn light block sm" (click)="reveal()"><ion-icon name="eye-outline"></ion-icon>{{ 'listing.showRealName' | t }}</button>
                    <p class="hint center">{{ 'listing.realNameHint' | t }}</p> }
                }
              </div>

              <div class="section-head"><h2>{{ 'listing.shipping' | t }}</h2></div>
              <div class="card pad reveal">
                @if (!x.shipsTo.length) { <p class="muted">{{ 'listing.pickupOnly' | t }}</p> }
                @else {
                  <p class="muted small">{{ 'listing.shipsTo' | t: { n: x.shipsTo[0] === '*' ? '🌍' : x.shipsTo.length } }}</p>
                  <div class="row ship">
                    <select class="input" [(ngModel)]="shipTo" (ngModelChange)="estimate()">
                      @for (c of countries; track c) { <option [value]="c">{{ c }}</option> }</select>
                    @if (ship(); as s) {
                      @if (s.available) { <div class="est fade"><strong>{{ i18n.price(s.minCents, s.currency) }}–{{ i18n.price(s.maxCents, s.currency) }}</strong><span class="small muted">{{ 'listing.days' | t: { min: s.minDays, max: s.maxDays } }}</span></div> }
                      @else { <span class="small muted fade">{{ 'listing.notShipping' | t }}</span> }
                    }
                  </div>
                }
              </div>

              <div class="card pad safety reveal">
                <h3><ion-icon name="shield-checkmark-outline"></ion-icon> {{ 'listing.safetyTitle' | t }}</h3>
                <ul><li>{{ 'listing.safety1' | t }}</li><li>{{ 'listing.safety2' | t }}</li><li>{{ 'listing.safety3' | t }}</li></ul>
              </div>
            </section>
          </div>

          @if (similar().length) {
            <div class="section-head"><h2>{{ 'listing.similar' | t }}</h2></div>
            <div class="hscroll">@for (c of similar(); track c.id) { <cmp-listing-card [item]="c" [compact]="true" /> }</div>
          }
        }
      </div>

      @if (d(); as x) {
        @if (!x.owner && x.status === 'ACTIVE') {
          <div class="actionbar glass">
            <button class="icon-btn" (click)="ui.toast(i18n.t('listing.callSoon'))"><ion-icon name="call-outline"></ion-icon></button>
            <button class="btn grow" (click)="message()"><ion-icon name="chatbubble-ellipses-outline"></ion-icon>{{ (x.conversationId ? 'listing.openChat' : 'listing.message') | t }}</button>
            @if (x.acceptsOffers || x.acceptsSwap) { <button class="btn light" (click)="openOffer()"><ion-icon name="pricetag-outline"></ion-icon><span class="hide-sm">{{ 'listing.offer' | t }}</span></button> }
          </div>
        }
      }

      <ion-modal [isOpen]="offerOpen()" (didDismiss)="offerOpen.set(false)" [initialBreakpoint]="0.85" [breakpoints]="[0, 0.85]">
        <ng-template>
          <ion-content>
            <div class="sheet">
              <h2>{{ 'offer.title' | t }}</h2>
              <div class="seg">
                @if (d()?.acceptsOffers) { <button [class.on]="kind() === 'PRICE'" (click)="kind.set('PRICE')"><ion-icon name="cash-outline"></ion-icon>{{ 'offer.priceTab' | t }}</button> }
                @if (d()?.acceptsSwap) { <button [class.on]="kind() === 'SWAP'" (click)="kind.set('SWAP'); loadMine()"><ion-icon name="swap-horizontal"></ion-icon>{{ 'offer.swapTab' | t }}</button> }
              </div>
              <p class="muted small">{{ 'offer.listPrice' | t: { price: i18n.price(d()?.priceCents, d()?.currency ?? 'EUR') } }}</p>
              @if (kind() === 'PRICE') {
                <div class="field"><label>{{ 'offer.amount' | t }} ({{ d()?.currency }})</label><input class="input big" type="number" inputmode="decimal" [(ngModel)]="amount" /></div>
                <div class="quick">@for (p of [0.95, 0.9, 0.85]; track p) { <button class="chip" (click)="amount = round((d()?.priceCents ?? 0) * p / 100)">−{{ ((1 - p) * 100).toFixed(0) }}%</button> }</div>
              } @else {
                <label class="lbl">{{ 'offer.chooseListing' | t }}</label>
                @if (!mine().length) { <p class="muted">{{ 'offer.noListings' | t }}</p> }
                <div class="mine">@for (m of mine(); track m.id) {
                  <button class="minec card" [class.sel]="swapId === m.id" (click)="swapId = m.id"><img [src]="api.url(m.imageUrl)" alt="" /><span>{{ m.title }}</span><strong>{{ i18n.price(m.priceCents, m.currency) }}</strong></button> }</div>
                <div class="field"><label>{{ 'offer.addMoney' | t }}</label><input class="input" type="number" [(ngModel)]="amount" /></div>
              }
              <div class="field"><label>{{ 'offer.message' | t }}</label><input class="input" [(ngModel)]="offerMsg" maxlength="400" /></div>
              <button class="btn block" [disabled]="busy() || (kind() === 'PRICE' ? !amount : !swapId)" (click)="sendOffer()">{{ 'offer.send' | t }}</button>
            </div>
          </ion-content>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: [`
    .detail { padding-bottom: 140px; }
    .layout { display: grid; gap: 14px; }
    @media (min-width: 992px) { .layout { grid-template-columns: 1.15fr 1fr; gap: 28px; align-items: start; } .left { position: sticky; top: 96px; } }
    .left, .right { display: flex; flex-direction: column; gap: 14px; } .right .section-head:first-child { margin-top: 6px; }
    .gal-sk { aspect-ratio: 4/3.2; border-radius: var(--r-xl); }
    .gallery { position: relative; padding: 8px; border-radius: var(--r-xl); }
    .track { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; border-radius: 24px; scrollbar-width: none; }
    .track::-webkit-scrollbar { display: none; }
    .slide { flex: 0 0 100%; scroll-snap-align: center; aspect-ratio: 4 / 3.2; background: var(--image-bg); display: grid; place-items: center; }
    .slide img { width: 100%; height: 100%; object-fit: cover; animation: fadeIn .6s var(--ease); }
    .slide.empty ion-icon { font-size: 42px; color: var(--text-3); }
    .g-tl { position: absolute; top: 20px; left: 20px; display: flex; gap: 6px; flex-wrap: wrap; }
    .g-tr { position: absolute; top: 18px; right: 18px; display: flex; gap: 8px; }
    .faved ion-icon, .coral { color: var(--accent-2); } .pop { animation: pop .5s var(--spring); }
    .gdots { position: absolute; bottom: 18px; left: 0; right: 0; display: flex; justify-content: center; gap: 6px; }
    .gdots span { width: 7px; height: 7px; border-radius: 99px; background: rgba(255,255,255,.6); transition: all .3s var(--ease); }
    .gdots span.on { width: 20px; background: #fff; }
    .head h1 { font-size: 24px; line-height: 1.15; flex: 1; }
    .top { align-items: flex-start; gap: 14px; }
    .prices { text-align: right; } .price { font-family: var(--font-display); font-size: 26px; font-weight: 700; letter-spacing: -0.03em; white-space: nowrap; }
    .old { color: var(--text-3); text-decoration: line-through; font-size: 14px; }
    .loc { margin-top: 10px; gap: 6px; }
    .verdict { display: flex; align-items: center; gap: 12px; margin-top: 16px; padding: 12px 14px; border-radius: 18px; background: var(--surface-2); position: relative; overflow: hidden; }
    .verdict::before { content: ''; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.35) 50%, transparent 70%); transform: translateX(-100%); animation: sweep 2.4s 0.4s var(--ease) 1; }
    @keyframes sweep { to { transform: translateX(100%); } }
    .verdict[data-v="BELOW"] { background: var(--ok-soft); } .verdict[data-v="BELOW"] .vi { background: var(--ok); }
    .verdict[data-v="FAIR"] { background: var(--accent-soft); } .verdict[data-v="FAIR"] .vi { background: var(--accent); }
    .verdict[data-v="ABOVE"] { background: var(--warn-soft); } .verdict[data-v="ABOVE"] .vi { background: var(--warn); }
    .vi { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; color: #fff; background: var(--text-3); flex: 0 0 auto; }
    .verdict div { flex: 1; } .verdict p { font-size: 12.5px; color: var(--text-2); margin-top: 2px; } .warnline { color: var(--warn) !important; font-weight: 600; }
    .ai { font-size: 11px; font-weight: 800; padding: 3px 7px; border-radius: 8px; background: var(--text); color: var(--surface); }
    .tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 14px; }
    .ostats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0 10px; text-align: center; }
    .ostats div { background: var(--surface-2); border-radius: 16px; padding: 10px 4px; display: flex; flex-direction: column; }
    .ostats strong { font-family: var(--font-display); font-size: 20px; } .ostats span { font-size: 11.5px; color: var(--text-2); }
    .oacts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; } .chip.danger { color: var(--accent-2); }
    .specs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .spec { padding: 14px; display: flex; flex-direction: column; gap: 3px; }
    .si { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; border: 1px solid var(--line); background: var(--surface-2); margin-bottom: 10px; }
    .si ion-icon { font-size: 19px; } .sl { font-size: 12px; color: var(--text-2); } .sv { font-weight: 650; font-size: 14.5px; }
    .desc { white-space: pre-wrap; line-height: 1.6; font-size: 15px; }
    .chart svg { width: 100%; height: 110px; overflow: visible; }
    .draw { stroke-dasharray: 600; stroke-dashoffset: 600; animation: dash 1.4s .2s var(--ease) forwards; } @keyframes dash { to { stroke-dashoffset: 0; } }
    .seller > a { color: inherit; align-items: center; }
    .sinfo { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; } .sinfo strong { font-size: 16.5px; }
    .stars { color: var(--warn); }
    .trust { --p: 0; width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; flex: 0 0 auto;
      background: conic-gradient(var(--accent) calc(var(--p) * 1%), var(--surface-3) 0); }
    .trust span { width: 42px; height: 42px; border-radius: 50%; background: var(--surface); display: grid; place-items: center; font-weight: 700; font-size: 14px; font-family: var(--font-display); }
    .sbadges { display: flex; gap: 6px; margin: 14px 0 12px; flex-wrap: wrap; }
    .realname { display: flex; align-items: center; gap: 10px; padding: 14px; border-radius: 16px; background: var(--accent-soft); color: var(--accent); font-weight: 650; }
    .center { text-align: center; margin-top: 8px; }
    .ship { margin-top: 10px; } .ship .input { width: 110px; flex: 0 0 auto; height: 46px; }
    .est { display: flex; flex-direction: column; }
    .safety h3 { display: flex; align-items: center; gap: 8px; } .safety h3 ion-icon { color: var(--ok); }
    .safety ul { margin: 10px 0 0; padding-left: 18px; color: var(--text-2); font-size: 14px; line-height: 1.7; }
    .actionbar { position: fixed; left: 12px; right: 12px; margin: 0 auto; max-width: 560px; bottom: calc(env(safe-area-inset-bottom) + 14px); z-index: 40;
      display: flex; gap: 10px; padding: 8px; border-radius: 999px; animation: fadeUp .6s .2s var(--ease) both; }
    .actionbar .grow { flex: 1; } .actionbar .btn { height: 52px; }
    @media (max-width: 420px) { .hide-sm { display: none; } }
    .sheet { padding: 22px 20px 40px; display: flex; flex-direction: column; gap: 14px; }
    .seg { display: flex; padding: 5px; border-radius: 999px; background: var(--surface-2); }
    .seg button { flex: 1; height: 44px; border: 0; border-radius: 999px; background: transparent; font-weight: 600; color: var(--text-2); display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: all .3s var(--ease); }
    .seg button.on { background: var(--surface); color: var(--text); box-shadow: var(--shadow-card); }
    .input.big { height: 66px; font-size: 28px; font-family: var(--font-display); font-weight: 700; }
    .quick { display: flex; gap: 8px; }
    .lbl { font-size: 13px; font-weight: 600; color: var(--text-2); }
    .mine { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .minec { padding: 8px; text-align: left; border: 2px solid transparent; cursor: pointer; display: flex; flex-direction: column; gap: 6px; color: var(--text); }
    .minec.sel { border-color: var(--accent); } .minec img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 14px; background: var(--image-bg); }
    .minec span { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `],
})
export class ListingPage implements ViewWillEnter {
  api = inject(Api);
  auth = inject(AuthService);
  i18n = inject(I18n);
  ui = inject(Ui);
  private nav = inject(NavController);
  private router = inject(Router);
  id = input.required<string>();
  icons = CATEGORY_ICONS;
  countries = COUNTRIES;

  d = signal<Detail | null>(null);
  analysis = signal<PriceAnalysis | null>(null);
  similar = signal<Card[]>([]);
  ship = signal<ShippingEstimate | null>(null);
  realName = signal('');
  slide = signal(0);
  favOverride = signal<boolean | null>(null);
  popped = signal(false);
  offerOpen = signal(false);
  kind = signal<'PRICE' | 'SWAP'>('PRICE');
  mine = signal<Card[]>([]);
  busy = signal(false);
  shipTo = 'RO';
  amount: number | null = null;
  swapId = '';
  offerMsg = '';

  fav = () => this.favOverride() ?? this.d()?.favorite ?? false;
  attrs = computed(() => Object.entries(this.d()?.attributes ?? {}));
  round = Math.round;

  chart = computed(() => {
    const h = this.d()?.priceHistory ?? [];
    if (h.length < 2) return { line: '', area: '', points: [] as number[][] };
    const vals = h.map((p) => p.priceCents);
    const max = Math.max(...vals), min = Math.min(...vals), span = max - min || 1;
    const pts = h.map((p, i) => [8 + (i * 284) / (h.length - 1), 12 + ((max - p.priceCents) / span) * 66]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    return { line, area: `${line} L ${pts[pts.length - 1][0]} 90 L ${pts[0][0]} 90 Z`, points: pts };
  });

  async ionViewWillEnter() {
    this.favOverride.set(null);
    this.realName.set('');
    try {
      const d = await this.api.listing(this.id());
      this.d.set(d);
      this.shipTo = this.auth.user()?.country || 'RO';
      this.api.priceAnalysis(this.id()).then((a) => this.analysis.set(a)).catch(() => {});
      this.api.similar(this.id()).then((s) => this.similar.set(s)).catch(() => {});
      if (d.shipsTo.length) this.estimate();
    } catch (e) { this.ui.error(e); this.nav.navigateRoot('/home'); }
  }

  onScroll(ev: Event) {
    const el = ev.target as HTMLElement;
    this.slide.set(Math.round(el.scrollLeft / el.clientWidth));
  }

  async estimate() {
    try { this.ship.set(await this.api.shipping(this.id(), this.shipTo)); } catch { this.ship.set(null); }
  }

  private requireLogin(): boolean {
    if (this.auth.loggedIn()) return true;
    this.router.navigate(['/login'], { queryParams: { next: `/listing/${this.id()}` } });
    return false;
  }

  async toggleFav() {
    if (!this.requireLogin()) return;
    const next = !this.fav();
    this.favOverride.set(next);
    if (next) { this.popped.set(false); queueMicrotask(() => this.popped.set(true)); this.ui.tap(); }
    try { await this.api.favorite(this.id(), next); } catch (e) { this.favOverride.set(!next); this.ui.error(e); }
  }

  async share() {
    const url = location.origin + '/listing/' + this.id();
    if (navigator.share) { navigator.share({ title: this.d()?.title, url }).catch(() => {}); }
    else { await navigator.clipboard?.writeText(url); this.ui.toast(this.i18n.t('common.copied')); }
  }

  async reveal() {
    if (!this.requireLogin()) return;
    try { this.realName.set((await this.api.realName(this.d()!.seller.id)).fullName); }
    catch (e) { this.ui.error(e); }
  }

  async message() {
    if (!this.requireLogin()) return;
    const d = this.d()!;
    try {
      const id = d.conversationId ?? (await this.api.startConversation(d.id)).id;
      this.nav.navigateForward(['/chat', id], { queryParams: d.conversationId ? {} : { draft: this.i18n.t('listing.firstMessage') } });
    } catch (e) { this.ui.error(e); }
  }

  openOffer() {
    if (!this.requireLogin()) return;
    this.kind.set(this.d()!.acceptsOffers ? 'PRICE' : 'SWAP');
    if (this.kind() === 'SWAP') this.loadMine();
    this.offerOpen.set(true);
  }

  async loadMine() {
    try { this.mine.set((await this.api.myListings()).filter((c) => c.status === 'ACTIVE')); } catch { /* ignore */ }
  }

  async sendOffer() {
    this.busy.set(true);
    try {
      await this.api.makeOffer(this.id(), {
        kind: this.kind(), amountCents: this.amount ? Math.round(this.amount * 100) : undefined,
        swapListingId: this.kind() === 'SWAP' ? this.swapId : undefined, message: this.offerMsg || undefined,
      });
      this.offerOpen.set(false);
      this.ui.toast(this.i18n.t('offer.sent'));
      this.ui.tap();
    } catch (e) { this.ui.error(e); }
    this.busy.set(false);
  }

  report() {
    if (!this.requireLogin()) return;
    this.nav.navigateForward(['/support'], { queryParams: { listingId: this.id(), reportedUserId: this.d()!.seller.id } });
  }

  async status(action: string) {
    try { await this.api.listingStatus(this.id(), action); await this.ionViewWillEnter(); }
    catch (e) { this.ui.error(e); }
  }

  async remove() {
    if (!(await this.ui.confirm(this.i18n.t('listing.removeConfirm'), this.i18n.t('common.delete')))) return;
    try { await this.api.listingStatus(this.id(), 'delete'); this.nav.navigateRoot('/my-listings'); } catch (e) { this.ui.error(e); }
  }

  async buy(product: string) {
    try { await this.api.checkout(product, this.id()); this.ui.toast(this.i18n.t('plans.done') + ' · ' + this.i18n.t('common.simulated')); await this.ionViewWillEnter(); }
    catch (e) { this.ui.error(e); }
  }
}

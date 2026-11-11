import { MOTION } from '../shared/motion.directives';
import { HoldButtonComponent } from '../shared/hold-button.component';
import { Component, ElementRef, ViewChild, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonModal, NavController, ViewWillEnter } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, TPipe } from '../core/i18n.service';
import { CATEGORY_ICONS } from '../core/icons';
import { COUNTRIES, Card, Detail, PriceAnalysis, ShippingEstimate } from '../core/models';
import { Ui } from '../core/ui.service';
import { HeroTransition } from '../core/hero.service';
import { Motion } from '../core/motion.service';
import { groupsFor } from '../core/listing-schema';
import { PriceChip, PriceInputComponent } from '../shared/price-input.component';
import { ReportSheetComponent } from '../shared/report-sheet.component';
import { Purchases } from '../core/purchases.service';
import { CheckoutSheetComponent } from '../shared/checkout-sheet.component';
import { AvatarComponent } from '../shared/avatar.component';
import { BackButtonComponent } from '../shared/back-button.component';
import { ListingCardComponent } from '../shared/listing-card.component';

@Component({
  selector: 'page-listing',
  imports: [MOTION, HoldButtonComponent, IonContent, IonIcon, IonModal, FormsModule, RouterLink, TPipe, AvatarComponent, BackButtonComponent, ListingCardComponent,
    PriceInputComponent, ReportSheetComponent, CheckoutSheetComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <div class="page detail">
        <div class="topbar">
          <cmp-back />
          <div class="title">{{ 'categories.' + (d()?.category ?? 'OTHER') | t }}</div>
          @if (d(); as x) { <button class="icon-btn" (click)="menu()" [attr.aria-label]="'common.more' | t"><ion-icon name="ellipsis-horizontal"></ion-icon></button> }
          @else { <div class="spacer"></div> }
        </div>

        @if (!d()) {
          <div class="layout"><div class="skeleton gal-sk" data-hero></div><div class="stack"><div class="skeleton" style="height:28px;width:70%"></div><div class="skeleton" style="height:22px;width:40%"></div><div class="skeleton" style="height:140px"></div></div></div>
        } @else {
          @let x = d()!;
          <div class="layout">
            <section class="left">
              <div class="gallery card" data-hero>
                <div class="track" #track (scroll)="onScroll($event)">
                  @for (img of x.images; track img.id; let i = $index) {
                    <button class="slide" (click)="openViewer(i)" [attr.aria-label]="'listing.openPhoto' | t: { n: i + 1 }">
                      <img [src]="api.url(img.url)" [alt]="x.title + ' — ' + (i + 1)" [attr.loading]="i ? 'lazy' : 'eager'" decoding="async" />
                    </button>
                  }
                  @if (!x.images.length) { <div class="slide empty"><ion-icon name="image-outline"></ion-icon></div> }
                </div>
                <div class="g-tl">
                  @if (x.previousPriceCents) { <span class="badge glass-b"><ion-icon name="trending-down" class="coral"></ion-icon>{{ 'listing.drop' | t }}</span> }
                  @if (x.condition === 'NEW') { <span class="badge glass-b">{{ 'common.new' | t }}</span> }
                  @if (x.promoted) { <span class="badge glass-b"><ion-icon name="sparkles"></ion-icon>{{ 'listing.promoted' | t }}</span> }
                  @if (x.status !== 'ACTIVE') { <span class="badge glass-b">{{ 'listing.status.' + x.status | t }}</span> }
                </div>
                <div class="g-tr">
                  <button class="icon-btn sm" (click)="share()" [attr.aria-label]="'common.share' | t"><ion-icon name="share-social-outline"></ion-icon></button>
                  @if (!x.owner) { <button #favBtn class="icon-btn sm" [class.faved]="fav()" (click)="toggleFav()" [attr.aria-label]="'nav.favorites' | t" [attr.aria-pressed]="fav()"><ion-icon [name]="fav() ? 'heart' : 'heart-outline'" [class.pop]="popped()"></ion-icon></button> }
                </div>
                @if (x.images.length > 1) {
                  <span class="gcount badge glass-b">{{ slide() + 1 }} / {{ x.images.length }}</span>
                  <div class="gdots">@for (img of x.images; track img.id; let i = $index) { <span [class.on]="i === slide()"></span> }</div>
                }
              </div>
              @if (x.images.length > 1) {
                <div class="thumbs">
                  @for (img of x.images; track img.id; let i = $index) {
                    <button [class.on]="i === slide()" (click)="goTo(i)" [attr.aria-label]="'listing.openPhoto' | t: { n: i + 1 }"><img [src]="api.url(img.thumbUrl)" alt="" loading="lazy" /></button>
                  }
                </div>
              }

              <div class="head card pad rv in" style="--i:1">
                <div class="row between top">
                  <h1>{{ x.title }}</h1>
                  <div class="prices"><div class="price" [cmpCount]="x.priceCents" [currency]="x.currency"></div>
                    @if (x.previousPriceCents) { <div class="old">{{ i18n.price(x.previousPriceCents, x.currency) }}</div> }</div>
                </div>
                <div class="row muted small loc"><ion-icon name="location-outline"></ion-icon>{{ x.city }}, {{ x.country }} · {{ 'listing.posted' | t: { when: i18n.ago(x.createdAt) } }}</div>
                <div class="pills">
                  <span class="pill" [class.on]="x.negotiable && x.acceptsOffers"><ion-icon [name]="x.negotiable && x.acceptsOffers ? 'chatbubbles-outline' : 'lock-closed-outline'"></ion-icon>{{ (x.negotiable && x.acceptsOffers ? 'listing.negotiable' : 'listing.fixedPrice') | t }}</span>
                  @if (x.quantity > 1) { <span class="pill"><ion-icon name="layers-outline"></ion-icon>{{ 'listing.quantity' | t: { n: x.quantity } }}</span> }
                  <span class="pill"><ion-icon [name]="x.seller.accountType === 'BUSINESS' ? 'business-outline' : 'person-outline'"></ion-icon>{{ (x.seller.accountType === 'BUSINESS' ? 'seller.business' : 'seller.private') | t }}</span>
                </div>
                @if (!x.owner && x.status === 'ACTIVE') {
                  <a class="protect" routerLink="/why" fragment="protection"><ion-icon name="shield-checkmark"></ion-icon>
                    <span><b>{{ 'buy.protectTitle' | t }}</b> {{ 'buy.protectShort' | t }}</span><ion-icon name="chevron-forward" class="faint"></ion-icon></a>
                  <button class="alertbtn" (click)="openAlert()" [class.on]="!!x.priceAlertCents">
                    <ion-icon [name]="x.priceAlertCents ? 'notifications' : 'notifications-outline'"></ion-icon>
                    {{ x.priceAlertCents ? ('alert.active' | t: { price: i18n.price(x.priceAlertCents, x.currency) }) : ('alert.cta' | t) }}</button>
                }
                @if (analysis(); as a) {
                  <div class="verdict pop-in" [attr.data-v]="a.verdict">
                    <span class="vi"><ion-icon name="sparkles"></ion-icon></span>
                    <div><strong>{{ 'price.' + a.verdict | t }}</strong>
                      @if (a.medianCents) { <p>{{ 'price.median' | t: { price: i18n.price(a.medianCents, a.currency), n: a.comparables } }}</p> }
                      @if (a.verdict === 'BELOW' && !x.seller.idVerified) { <p class="warnline">{{ 'price.belowWarn' | t }}</p> }
                    </div>
                    <span class="ai">AI</span>
                  </div>
                  @if (a.medianCents) {
                    <div class="pmeter"><span class="zone"></span><i class="mk" [style.left.%]="meterPos()"></i><b class="md"></b></div>
                  }
                }
                <div class="tags">
                  @if (x.acceptsSwap) { <span class="badge accent"><ion-icon name="swap-horizontal"></ion-icon>{{ 'listing.acceptsSwap' | t }}</span> }
                  <span class="badge" style="background:var(--surface-2)"><ion-icon name="eye-outline"></ion-icon>{{ x.views }} {{ 'listing.views' | t }}</span>
                </div>
              </div>

              @if (x.owner) {
                <div class="card pad owner rv" style="--i:2">
                  <div class="row between"><h3>{{ 'listing.yourListing' | t }}</h3><span class="badge accent">{{ 'listing.status.' + x.status | t }}</span></div>
                  @if (x.status === 'REMOVED' || x.status === 'HIDDEN_BY_AI') {
                    <div class="modbox">
                      <ion-icon name="alert-circle"></ion-icon>
                      <div><b>{{ (x.status === 'REMOVED' ? 'moderation.removedTitle' : 'moderation.hiddenTitle') | t }}</b>
                        <p>{{ 'moderation.reason' | t }}: {{ moderationText(x.moderationReason) }}</p>
                        <p class="faint">{{ 'moderation.appealHint' | t }}</p></div>
                    </div>
                    <button class="btn sm light block" (click)="appeal()"><ion-icon name="hand-left-outline"></ion-icon>{{ 'moderation.appeal' | t }}</button>
                  }
                  @if (x.minPriceCents) { <p class="minp small"><ion-icon name="eye-off-outline"></ion-icon>{{ 'listing.yourMin' | t: { price: i18n.price(x.minPriceCents, x.currency) } }}</p> }
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
                      @if (purchases.allowed()) {
                        <cmp-hold-button tone="light" [small]="true" icon="rocket-outline" [busy]="buying() === 'PROMOTE_7D'" [label]="'listing.promote' | t"
                          [confirmText]="'hold.payConfirm' | t: { what: ('plans.PROMOTE_7D' | t), price: '2,99 €' }" (confirmed)="buy('PROMOTE_7D')" />
                        <cmp-hold-button tone="light" [small]="true" icon="arrow-up" [busy]="buying() === 'BUMP'" [label]="'listing.bump' | t"
                          [confirmText]="'hold.payConfirm' | t: { what: ('plans.BUMP' | t), price: '0,99 €' }" (confirmed)="buy('BUMP')" />
                      }
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
              @if (facts().length) {
                <div class="facts">
                  @for (f of facts(); track f.key; let i = $index) {
                    <div class="fact card rv" [style.--i]="i"><ion-icon [name]="f.icon"></ion-icon><span class="fv">{{ f.value }}</span><span class="fl">{{ f.label }}</span></div>
                  }
                </div>
              }
              <div class="section-head"><h2>{{ 'listing.specs' | t }}</h2></div>
              <div class="card specs rv">
                <div class="srow"><span>{{ 'search.category' | t }}</span><b>{{ 'categories.' + x.category | t }}</b></div>
                <div class="srow"><span>{{ 'listing.condition' | t }}</span><b>{{ 'conditions.' + x.condition | t }}</b></div>
                @for (g of specGroups(); track g.key) {
                  <div class="sgh"><ion-icon [name]="g.icon"></ion-icon>{{ 'attrGroup.' + g.key | t }}</div>
                  @for (r of g.rows; track r.key) { <div class="srow" [class.wide]="r.wide"><span>{{ r.label }}</span><b>{{ r.value }}</b></div> }
                }
              </div>

              <div class="section-head"><h2>{{ 'listing.description' | t }}</h2></div>
              <div class="card pad desc rv">{{ x.description }}</div>

              @if (x.priceHistory.length > 1) {
                <div class="section-head"><h2>{{ 'listing.priceHistory' | t }}</h2></div>
                <div class="card pad chart rv">
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
              <div class="card pad seller rv">
                <a class="row" [routerLink]="['/user', x.seller.id]">
                  <cmp-avatar [name]="x.seller.displayName" [hue]="x.seller.avatarHue" [size]="56" [verified]="x.seller.idVerified" />
                  <div class="sinfo">
                    <strong>{{ x.seller.displayName }}</strong>
                    <span class="small muted">&#64;{{ x.seller.username }} · {{ 'listing.memberSince' | t: { date: i18n.date(x.seller.memberSince) } }}</span>
                    <span class="small stars">@if (x.seller.ratingCount) { ★ {{ x.seller.rating }} · {{ 'listing.reviews' | t: { n: x.seller.ratingCount } }} } @else { {{ 'listing.noReviews' | t }} }</span>
                  </div>
                  <div class="trust" [style.--p]="x.seller.trustScore"><span>{{ x.seller.trustScore }}</span></div>
                </a>
                @if (x.sellerStats; as st) {
                  <div class="sstats">
                    @if (st.responseMinutes !== null) { <span><ion-icon name="time-outline"></ion-icon>{{ 'stats2.replies' | t: { time: replyTime(st.responseMinutes) } }}</span> }
                    <span><ion-icon name="pulse-outline"></ion-icon>{{ 'stats2.active.' + st.lastActive | t }}</span>
                    @if (st.completedSales) { <span><ion-icon name="bag-check-outline"></ion-icon>{{ 'stats2.sales' | t: { n: st.completedSales } }}</span> }
                  </div>
                }
                <div class="sbadges">
                  @if (x.seller.idVerified) { <span class="badge ok"><ion-icon name="shield-checkmark"></ion-icon>{{ 'profile.verified' | t }}</span> }
                  @else { <span class="badge warn"><ion-icon name="alert-circle"></ion-icon>{{ 'profile.notVerified' | t }}</span> }
                  @if (x.seller.phoneVerified) { <span class="badge ok"><ion-icon name="phone-portrait"></ion-icon>{{ 'seller.phoneOk' | t }}</span> }
                  @if (x.seller.accountType === 'BUSINESS') { <span class="badge accent"><ion-icon name="business"></ion-icon>{{ 'seller.business' | t }}</span> }
                </div>
                @if (x.seller.business; as b) {
                  <dl class="biz">
                    <div><dt>{{ 'biz.name' | t }}</dt><dd>{{ b.name }}</dd></div>
                    <div><dt>{{ 'biz.regNo' | t }}</dt><dd>{{ b.regNo }}</dd></div>
                    @if (b.vat) { <div><dt>{{ 'biz.vat' | t }}</dt><dd>{{ b.vat }}</dd></div> }
                    <div class="w"><dt>{{ 'biz.address' | t }}</dt><dd>{{ b.address }}</dd></div>
                    <div><dt>{{ 'biz.email' | t }}</dt><dd>{{ b.email }}</dd></div>
                    @if (b.phone) { <div><dt>{{ 'biz.phone' | t }}</dt><dd>{{ b.phone }}</dd></div> }
                  </dl>
                  <p class="notice small"><ion-icon name="information-circle-outline"></ion-icon>{{ 'seller.businessNotice' | t }}</p>
                } @else {
                  <p class="notice small"><ion-icon name="information-circle-outline"></ion-icon>{{ 'seller.privateNotice' | t }}</p>
                }
                @if (x.seller.realNameAvailable && !x.owner) {
                  @if (realName()) { <div class="realname fade"><ion-icon name="key-outline"></ion-icon>{{ realName() }}</div> }
                  @else { <button class="btn light block sm" (click)="reveal()"><ion-icon name="eye-outline"></ion-icon>{{ 'listing.showRealName' | t }}</button>
                    <p class="hint center">{{ 'listing.realNameHint' | t }}</p> }
                }
              </div>

              <div class="section-head"><h2>{{ 'listing.shipping' | t }}</h2></div>
              <div class="card pad rv">
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

              <div class="card pad safety rv">
                <h3><ion-icon name="shield-checkmark-outline"></ion-icon> {{ 'listing.safetyTitle' | t }}</h3>
                <ul><li>{{ 'listing.safety1' | t }}</li><li>{{ 'listing.safety2' | t }}</li><li>{{ 'listing.safety3' | t }}</li></ul>
              </div>
            </section>
          </div>

          @if (similar().length) {
            <div class="section-head"><h2>{{ 'listing.similar' | t }}</h2></div>
            <div class="hscroll">@for (c of similar(); track c.id; let i = $index) { <cmp-listing-card class="rv" [style.--i]="i" [item]="c" [compact]="true" /> }</div>
          }
        }
      </div>

      @if (d(); as x) {
        @if (x.blocked) {
          <div class="actionbar glass blockedbar"><ion-icon name="ban-outline"></ion-icon><span>{{ 'block.listingBlocked' | t }}</span></div>
        } @else if (!x.owner && x.status === 'ACTIVE') {
          <div class="actionbar glass">
            <button class="icon-btn msg" (click)="message()" [attr.aria-label]="(x.conversationId ? 'listing.openChat' : 'listing.message') | t"><ion-icon name="chatbubble-ellipses-outline"></ion-icon></button>
            @if ((x.acceptsOffers && x.negotiable) || x.acceptsSwap) { <button class="btn light" (click)="openOffer()"><ion-icon name="pricetag-outline"></ion-icon><span>{{ 'listing.offerShort' | t }}</span></button> }
            <button class="btn accent grow" (click)="buy0()"><ion-icon name="shield-checkmark"></ion-icon>{{ 'buy.cta' | t }}</button>
          </div>
        }
      }

      <ion-modal [isOpen]="offerOpen()" (didDismiss)="offerOpen.set(false)" [initialBreakpoint]="0.85" [breakpoints]="[0, 0.85]">
        <ng-template>
          <ion-content>
            <div class="sheet">
              <h2>{{ 'offer.title' | t }}</h2>
              <div class="seg">
                @if (d()?.acceptsOffers && d()?.negotiable) { <button [class.on]="kind() === 'PRICE'" (click)="kind.set('PRICE')"><ion-icon name="cash-outline"></ion-icon>{{ 'offer.priceTab' | t }}</button> }
                @if (d()?.acceptsSwap) { <button [class.on]="kind() === 'SWAP'" (click)="kind.set('SWAP'); loadMine()"><ion-icon name="swap-horizontal"></ion-icon>{{ 'offer.swapTab' | t }}</button> }
              </div>
              <p class="muted small">{{ 'offer.listPrice' | t: { price: i18n.price(d()?.priceCents, d()?.currency ?? 'EUR') } }}</p>
              @if (kind() === 'PRICE') {
                <div class="card pad">
                  <cmp-price-input [(value)]="amount" scale="linear" [min]="offerMin()" [max]="(d()?.priceCents ?? 0) / 100" [currency]="d()?.currency ?? 'RON'"
                    [median]="analysis()?.medianCents ? analysis()!.medianCents! / 100 : null" [medianLabel]="'price.medianShort' | t"
                    [reference]="(d()?.priceCents ?? 0) / 100" [refLabel]="''" [deltaLabel]="'neg.vsList' | t"
                    [chips]="offerChips()" [big]="true" [label]="'offer.amount' | t" />
                </div>
                @if (amount() != null && amount()! < offerMin()) { <div class="error-text">{{ 'errors.OFFER_TOO_LOW' | t }}</div> }
                <p class="faint small">{{ 'offer.howItWorks' | t }}</p>
              } @else {
                <label class="lbl">{{ 'offer.chooseListing' | t }}</label>
                @if (!mine().length) { <p class="muted">{{ 'offer.noListings' | t }}</p> }
                <div class="mine">@for (m of mine(); track m.id) {
                  <button class="minec card" [class.sel]="swapId === m.id" (click)="swapId = m.id"><img [src]="api.url(m.imageUrl)" alt="" /><span>{{ m.title }}</span><strong>{{ i18n.price(m.priceCents, m.currency) }}</strong></button> }</div>
                <div class="card pad"><label class="lbl">{{ 'offer.addMoney' | t }} ({{ 'common.optional' | t }})</label>
                  <cmp-price-input [(value)]="swapAdd" scale="linear" [min]="0" [max]="(d()?.priceCents ?? 0) / 100" [currency]="d()?.currency ?? 'RON'" [label]="'offer.addMoney' | t" /></div>
              }
              <div class="field"><label>{{ 'offer.message' | t }}</label><input class="input" [(ngModel)]="offerMsg" maxlength="400" [placeholder]="'neg.msgPh' | t" /></div>
              <button class="btn block" [disabled]="busy() || (kind() === 'PRICE' ? !validOffer() : !swapId)" (click)="sendOffer()"><ion-icon name="send"></ion-icon>{{ 'offer.send' | t }}</button>
            </div>
          </ion-content>
        </ng-template>
      </ion-modal>

      @if (d(); as x) {
        <cmp-report-sheet [(open)]="reportOpen" target="LISTING" [targetId]="x.id" />
        <cmp-checkout-sheet [(open)]="buyOpen" [listing]="x" />
        <ion-modal [isOpen]="alertOpen()" (didDismiss)="alertOpen.set(false)" [initialBreakpoint]="0.7" [breakpoints]="[0, 0.7]">
          <ng-template>
            <ion-content>
              <div class="sheet">
                <h2>{{ 'alert.title' | t }}</h2>
                <p class="muted">{{ 'alert.sub' | t: { price: i18n.price(x.priceCents, x.currency) } }}</p>
                <div class="card pad">
                  <cmp-price-input [(value)]="alertValue" scale="linear" [min]="Math.ceil(x.priceCents / 100 * 0.3)" [max]="Math.max(1, x.priceCents / 100 - 1)"
                    [currency]="x.currency" [reference]="x.priceCents / 100" [deltaLabel]="'neg.vsList' | t" [big]="true" [label]="'alert.title' | t"
                    [chips]="alertChips()" />
                </div>
                <button class="btn block" [disabled]="!alertValue() || alertValue()! >= x.priceCents / 100" (click)="saveAlert()"><ion-icon name="notifications"></ion-icon>{{ 'alert.save' | t }}</button>
                @if (x.priceAlertCents) { <button class="btn ghost block" (click)="clearAlert()">{{ 'alert.remove' | t }}</button> }
              </div>
            </ion-content>
          </ng-template>
        </ion-modal>
      }
    </ion-content>

    @if (viewer() !== null && d()) {
      <div class="viewer fade" role="dialog" aria-modal="true" (keydown.escape)="viewer.set(null)">
        <div class="vtop"><span>{{ vIndex() + 1 }} / {{ d()!.images.length }}</span>
          <button class="icon-btn" (click)="viewer.set(null)" [attr.aria-label]="'common.close' | t"><ion-icon name="close"></ion-icon></button></div>
        <div class="vtrack" #vtrack (scroll)="onViewerScroll($event)">
          @for (img of d()!.images; track img.id) { <div class="vslide"><img [src]="api.url(img.url)" [alt]="d()!.title" /></div> }
        </div>
      </div>
    }
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
    .slide { flex: 0 0 100%; scroll-snap-align: center; aspect-ratio: 4 / 3.2; background: var(--image-bg); display: grid; place-items: center; border: 0; padding: 0; cursor: zoom-in; }
    .slide img { width: 100%; height: 100%; object-fit: cover; animation: fadeIn .6s var(--ease); display: block; }
    .gcount { position: absolute; bottom: 16px; right: 18px; height: 24px; font-size: 13px; font-variant-numeric: tabular-nums; }
    .thumbs { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 2px; }
    .thumbs::-webkit-scrollbar { display: none; }
    .thumbs button { flex: 0 0 auto; width: 64px; height: 52px; border-radius: 12px; overflow: hidden; border: 2px solid transparent; padding: 0; background: var(--image-bg); cursor: pointer; opacity: .7; transition: all .25s var(--ease); }
    .thumbs button.on { border-color: var(--accent); opacity: 1; }
    .thumbs img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .pills { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
    .pill { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border-radius: 999px; font-size: 13.5px; font-weight: 600; background: var(--surface-2); color: var(--text-2); }
    .pill.on { background: var(--ok-soft); color: var(--ok); }
    .facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(140px, 46%), 1fr)); gap: 10px; }
    .fact { padding: 12px 14px; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .fact ion-icon { font-size: 20px; color: var(--accent); margin-bottom: 6px; }
    .fv { font-weight: 700; font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--font-display); }
    .fl { font-size: 13px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .specs { padding: 6px 16px 10px; }
    .srow { display: flex; justify-content: space-between; gap: 14px; padding: 11px 0; border-bottom: 1px solid var(--line); font-size: 15px; }
    .srow:last-child { border-bottom: 0; }
    .srow span { color: var(--text-2); flex: 0 0 auto; max-width: 48%; }
    .srow b { font-weight: 600; text-align: right; overflow-wrap: anywhere; min-width: 0; }
    .srow.wide { flex-direction: column; gap: 4px; } .srow.wide b { text-align: left; font-weight: 500; line-height: 1.45; }
    .sgh { display: flex; align-items: center; gap: 8px; margin: 14px 0 2px; font-size: 13px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--text-3); }
    .sgh ion-icon { font-size: 16px; }
    .biz { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; margin: 0 0 12px; padding: 12px 14px; border-radius: 16px; background: var(--surface-2); }
    .biz div { min-width: 0; } .biz .w { grid-column: 1 / -1; }
    .biz dt { font-size: 13px; color: var(--text-3); } .biz dd { margin: 2px 0 0; font-size: 14.5px; font-weight: 600; overflow-wrap: anywhere; }
    .notice { display: flex; gap: 8px; align-items: flex-start; color: var(--text-2); line-height: 1.45; margin: 0 0 12px; }
    .notice ion-icon { flex: 0 0 auto; font-size: 16px; margin-top: 1px; color: var(--accent); }
    .modbox { display: flex; gap: 10px; margin: 12px 0; padding: 12px 14px; border-radius: 16px; background: var(--accent-2-soft); }
    .modbox > ion-icon { color: var(--accent-2); font-size: 22px; flex: 0 0 auto; }
    .modbox p { font-size: 14px; margin-top: 4px; color: var(--text-2); }
    .minp { display: flex; align-items: center; gap: 6px; color: var(--text-2); margin-top: 10px; }
    .blockedbar { align-items: center; gap: 10px; padding: 14px 18px; color: var(--text-2); font-size: 14.5px; font-weight: 600; }
    .blockedbar ion-icon { color: var(--accent-2); font-size: 20px; }
    .viewer { position: fixed; inset: 0; z-index: 9500; background: rgba(6, 6, 10, .96); display: flex; flex-direction: column; }
    .vtop { display: flex; align-items: center; justify-content: space-between; padding: calc(env(safe-area-inset-top) + 10px) 14px 10px 20px; color: #fff; font-weight: 600; }
    .vtop .icon-btn { color: #fff; }
    .vtrack { flex: 1; display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
    .vtrack::-webkit-scrollbar { display: none; }
    .vslide { flex: 0 0 100%; scroll-snap-align: center; display: grid; place-items: center; padding: 0 0 calc(env(safe-area-inset-bottom) + 40px); }
    .vslide img { max-width: 100%; max-height: 100%; object-fit: contain; touch-action: pinch-zoom; }
    .slide.empty ion-icon { font-size: 42px; color: var(--text-3); }
    .pop-in { animation: fadeUp .6s var(--spring) both; }
    .pmeter { position: relative; height: 10px; margin: 16px 4px 4px; border-radius: 99px; background: linear-gradient(90deg, var(--ok), var(--accent) 50%, var(--warn)); }
    .pmeter .md { position: absolute; left: 50%; top: -4px; bottom: -4px; width: 2px; background: var(--text); opacity: .25; border-radius: 2px; }
    .pmeter .mk { position: absolute; top: 50%; width: 22px; height: 22px; border-radius: 50%; background: var(--surface); border: 3px solid var(--text);
      transform: translate(-50%, -50%); box-shadow: 0 6px 14px -4px rgba(0,0,0,.35); animation: slideMeter 1.2s .3s var(--spring) both; }
    @keyframes slideMeter { from { left: 50%; transform: translate(-50%, -50%) scale(.4); } }
    .g-tl { position: absolute; top: 20px; left: 20px; display: flex; gap: 6px; flex-wrap: wrap; }
    .g-tr { position: absolute; top: 18px; right: 18px; display: flex; gap: 8px; }
    .faved ion-icon, .coral { color: var(--accent-2); } .pop { animation: pop .5s var(--spring); }
    .gdots { position: absolute; bottom: 18px; left: 0; right: 0; display: flex; justify-content: center; gap: 6px; }
    .gdots span { width: 7px; height: 7px; border-radius: 99px; background: rgba(255,255,255,.6); transition: all .3s var(--ease); }
    .gdots span.on { width: 20px; background: #fff; }
    .head h1 { font-size: 24px; line-height: 1.15; flex: 1; }
    .top { align-items: flex-start; gap: 14px; }
    .prices { text-align: right; } .price { font-family: var(--font-display); font-size: 26px; font-weight: 700; letter-spacing: -0.03em; white-space: nowrap; }
    .old { color: var(--text-3); text-decoration: line-through; font-size: 15px; }
    .loc { margin-top: 10px; gap: 6px; }
    .verdict { display: flex; align-items: center; gap: 12px; margin-top: 16px; padding: 12px 14px; border-radius: 18px; background: var(--surface-2); position: relative; overflow: hidden; }
    .verdict::before { content: ''; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,.35) 50%, transparent 70%); transform: translateX(-100%); animation: sweep 2.4s 0.4s var(--ease) 1; }
    @keyframes sweep { to { transform: translateX(100%); } }
    .verdict[data-v="BELOW"] { background: var(--ok-soft); } .verdict[data-v="BELOW"] .vi { background: var(--ok); }
    .verdict[data-v="FAIR"] { background: var(--accent-soft); } .verdict[data-v="FAIR"] .vi { background: var(--accent); }
    .verdict[data-v="ABOVE"] { background: var(--warn-soft); } .verdict[data-v="ABOVE"] .vi { background: var(--warn); }
    .vi { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; color: #fff; background: var(--text-3); flex: 0 0 auto; }
    .verdict div { flex: 1; } .verdict p { font-size: 13.5px; color: var(--text-2); margin-top: 2px; } .warnline { color: var(--warn) !important; font-weight: 600; }
    .ai { font-size: 12.5px; font-weight: 800; padding: 3px 7px; border-radius: 8px; background: var(--text); color: var(--surface); }
    .tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 14px; }
    .ostats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 14px 0 10px; text-align: center; }
    .ostats div { background: var(--surface-2); border-radius: 16px; padding: 10px 4px; display: flex; flex-direction: column; }
    .ostats strong { font-family: var(--font-display); font-size: 20px; } .ostats span { font-size: 13px; color: var(--text-2); }
    .oacts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; } .chip.danger { color: var(--accent-2); }
    .desc { white-space: pre-wrap; line-height: 1.6; font-size: 16px; }
    .chart svg { width: 100%; height: 110px; overflow: visible; }
    .draw { stroke-dasharray: 600; stroke-dashoffset: 600; animation: dash 1.4s .2s var(--ease) forwards; } @keyframes dash { to { stroke-dashoffset: 0; } }
    .seller > a { color: inherit; align-items: center; }
    .sinfo { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; } .sinfo strong { font-size: 16.5px; }
    .stars { color: var(--warn); }
    .trust { --p: 0; width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; flex: 0 0 auto;
      background: conic-gradient(var(--accent) calc(var(--p) * 1%), var(--surface-3) 0); }
    .trust span { width: 42px; height: 42px; border-radius: 50%; background: var(--surface); display: grid; place-items: center; font-weight: 700; font-size: 15px; font-family: var(--font-display); }
    .sbadges { display: flex; gap: 6px; margin: 14px 0 12px; flex-wrap: wrap; }
    .realname { display: flex; align-items: center; gap: 10px; padding: 14px; border-radius: 16px; background: var(--accent-soft); color: var(--accent); font-weight: 650; }
    .center { text-align: center; margin-top: 8px; }
    .ship { margin-top: 10px; } .ship .input { width: 110px; flex: 0 0 auto; height: 46px; }
    .est { display: flex; flex-direction: column; }
    .safety h3 { display: flex; align-items: center; gap: 8px; } .safety h3 ion-icon { color: var(--ok); }
    .safety ul { margin: 10px 0 0; padding-left: 18px; color: var(--text-2); font-size: 15px; line-height: 1.7; }
    .actionbar { position: fixed; left: 12px; right: 12px; margin: 0 auto; max-width: 560px; bottom: calc(env(safe-area-inset-bottom) + 14px); z-index: 40;
      display: flex; gap: 10px; padding: 8px; border-radius: 999px; animation: fadeUp .6s .2s var(--ease) both; }
    .actionbar .grow { flex: 1; } .actionbar .btn { height: 52px; }
    .actionbar .msg { width: 52px; height: 52px; }
    .protect { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 12px 14px; border-radius: 16px; background: var(--ok-soft); color: var(--text); font-size: 14.5px; line-height: 1.4; }
    .protect > ion-icon:first-child { color: var(--ok); font-size: 24px; flex: 0 0 auto; } .protect span { flex: 1; }
    .alertbtn { display: inline-flex; align-items: center; gap: 8px; margin-top: 10px; height: 40px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--line);
      background: var(--surface); color: var(--text); font-weight: 600; font-size: 14.5px; cursor: pointer; }
    .alertbtn.on { background: var(--accent-soft); color: var(--accent); border-color: transparent; }
    .sstats { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 12px; font-size: 14.5px; color: var(--text); }
    .sstats span { display: inline-flex; align-items: center; gap: 6px; } .sstats ion-icon { color: var(--accent); font-size: 17px; }
    .head h1 { overflow-wrap: anywhere; }
    @media (max-width: 360px) { .head h1 { font-size: 21px; } .price { font-size: 22px; } .top { flex-direction: column; gap: 6px; } .prices { text-align: left; } }
    .sheet { padding: 22px 20px 40px; display: flex; flex-direction: column; gap: 14px; }
    .seg { display: flex; padding: 5px; border-radius: 999px; background: var(--surface-2); }
    .seg button { flex: 1; height: 44px; border: 0; border-radius: 999px; background: transparent; font-weight: 600; color: var(--text-2); display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: all .3s var(--ease); }
    .seg button.on { background: var(--surface); color: var(--text); box-shadow: var(--shadow-card); }
    .input.big { height: 66px; font-size: 28px; font-family: var(--font-display); font-weight: 700; }
    .quick { display: flex; gap: 8px; }
    .lbl { font-size: 14px; font-weight: 600; color: var(--text-2); }
    .mine { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .minec { padding: 8px; text-align: left; border: 2px solid transparent; cursor: pointer; display: flex; flex-direction: column; gap: 6px; color: var(--text); }
    .minec.sel { border-color: var(--accent); } .minec img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 14px; background: var(--image-bg); }
    .minec span { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `],
})
export class ListingPage implements ViewWillEnter {
  api = inject(Api);
  auth = inject(AuthService);
  i18n = inject(I18n);
  ui = inject(Ui);
  private nav = inject(NavController);
  private router = inject(Router);
  private hero = inject(HeroTransition);
  private motion = inject(Motion);
  private host = inject(ElementRef<HTMLElement>);
  purchases = inject(Purchases);
  @ViewChild('favBtn') favBtn?: ElementRef<HTMLElement>;
  @ViewChild('track') track?: ElementRef<HTMLElement>;
  @ViewChild('vtrack') set vtrackRef(el: ElementRef<HTMLElement> | undefined) {
    // la deschidere sărim direct la poza apăsată
    if (el && this.viewer() !== null) requestAnimationFrame(() => el.nativeElement.scrollTo({ left: this.viewer()! * el.nativeElement.clientWidth }));
  }
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
  reportOpen = signal(false);
  buying = signal<string | null>(null);
  buyOpen = signal(false);
  alertOpen = signal(false);
  alertValue = signal<number | null>(null);
  Math = Math;
  /** ?buy=1 (din oferte acceptate): deschide direct plata sigură. */
  buyParam = input<string>(undefined, { alias: 'buy' });
  viewer = signal<number | null>(null);
  vIndex = signal(0);
  shipTo = 'RO';
  amount = signal<number | null>(null);
  swapAdd = signal<number | null>(null);
  swapId = '';
  offerMsg = '';

  fav = () => this.favOverride() ?? this.d()?.favorite ?? false;
  /** Ofertele sub 30% din preț sunt respinse de server. */
  offerMin = computed(() => Math.ceil(((this.d()?.priceCents ?? 0) / 100) * 0.3));
  offerChips = computed<PriceChip[]>(() => {
    const p = (this.d()?.priceCents ?? 0) / 100;
    const out: PriceChip[] = [0.95, 0.9, 0.85].map((k) => ({ label: `−${Math.round((1 - k) * 100)}%`, value: Math.round(p * k) }));
    const m = this.analysis()?.medianCents;
    if (m && m / 100 < p && m / 100 >= this.offerMin()) out.push({ label: this.i18n.t('price.medianShort') + ' · ' + this.i18n.price(m, this.d()!.currency), value: Math.round(m / 100) });
    return out;
  });
  validOffer = computed(() => { const a = this.amount(); return a != null && a >= this.offerMin() && a <= (this.d()?.priceCents ?? 0) / 100; });

  /** Fapte cheie (an, km, memorie…) din schema categoriei, doar cele completate. */
  facts = computed(() => {
    const d = this.d();
    if (!d) return [];
    return groupsFor(d.category).flatMap((g) => g.fields).filter((f) => f.key_fact && d.attributes[f.key])
      .slice(0, 6).map((f) => ({ key: f.key, icon: f.icon ?? 'information-circle-outline', label: this.i18n.attrLabel(f.key), value: this.i18n.attrValue(f.key, d.attributes[f.key], f.unit) }));
  });

  /** Specificațiile grupate ca în schema categoriei; cheile necunoscute ajung în „Alte detalii”. */
  specGroups = computed(() => {
    const d = this.d();
    if (!d) return [];
    this.i18n.version();
    const used = new Set<string>();
    const groups = groupsFor(d.category).map((g) => ({
      key: g.key, icon: g.icon,
      rows: g.fields.filter((f) => d.attributes[f.key]).map((f) => { used.add(f.key); return { key: f.key, wide: !!f.wide, label: this.i18n.attrLabel(f.key), value: this.i18n.attrValue(f.key, d.attributes[f.key], f.unit) }; }),
    })).filter((g) => g.rows.length);
    const rest = Object.entries(d.attributes).filter(([k]) => !used.has(k));
    if (rest.length) groups.push({ key: 'other', icon: 'list-outline', rows: rest.map(([k, v]) => ({ key: k, wide: v.length > 40, label: this.i18n.attrLabel(k), value: this.i18n.attrValue(k, v) })) });
    return groups;
  });
  meterPos = computed(() => {
    const a = this.analysis(), d = this.d();
    if (!a?.medianCents || !d) return 50;
    return Math.max(5, Math.min(95, 50 + (d.priceCents / a.medianCents - 1) * 110));
  });
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
    // Imaginea de pe card zboară spre locul galeriei (scheletul are aceeași poziție).
    this.hero.play(this.id(), () => this.host.nativeElement.querySelector('[data-hero]'));
    try {
      const d = await this.api.listing(this.id());
      this.d.set(d);
      this.shipTo = this.auth.user()?.country || 'RO';
      this.api.priceAnalysis(this.id()).then((a) => this.analysis.set(a)).catch(() => {});
      this.api.similar(this.id()).then((s) => this.similar.set(s)).catch(() => {});
      if (d.shipsTo.length) this.estimate();
      if (this.buyParam() && !d.owner && d.status === 'ACTIVE' && this.auth.loggedIn()) setTimeout(() => this.buyOpen.set(true), 400);
    } catch (e) { this.ui.error(e); this.nav.navigateRoot('/home'); }
  }

  onScroll(ev: Event) {
    const el = ev.target as HTMLElement;
    this.slide.set(Math.round(el.scrollLeft / el.clientWidth));
  }

  goTo(i: number) {
    const el = this.track?.nativeElement;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  openViewer(i: number) { this.vIndex.set(i); this.viewer.set(i); }

  onViewerScroll(ev: Event) {
    const el = ev.target as HTMLElement;
    this.vIndex.set(Math.round(el.scrollLeft / el.clientWidth));
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
    if (next) { this.popped.set(false); queueMicrotask(() => this.popped.set(true)); this.ui.tap(); if (this.favBtn) this.motion.burst(this.favBtn.nativeElement); }
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
    const d = this.d()!;
    this.kind.set(d.acceptsOffers && d.negotiable ? 'PRICE' : 'SWAP');
    if (this.amount() == null) this.amount.set(Math.round((d.priceCents / 100) * 0.9));
    if (this.kind() === 'SWAP') this.loadMine();
    this.offerOpen.set(true);
  }

  async loadMine() {
    try { this.mine.set((await this.api.myListings()).filter((c) => c.status === 'ACTIVE')); } catch { /* ignore */ }
  }

  async sendOffer() {
    this.busy.set(true);
    try {
      const money = this.kind() === 'PRICE' ? this.amount() : this.swapAdd();
      await this.api.makeOffer(this.id(), {
        kind: this.kind(), amountCents: money ? Math.round(money * 100) : undefined,
        swapListingId: this.kind() === 'SWAP' ? this.swapId : undefined, message: this.offerMsg.trim() || undefined,
      });
      this.offerOpen.set(false);
      this.ui.toast(this.i18n.t('offer.sent'));
      this.ui.tap();
      this.nav.navigateForward(['/offers']);
    } catch (e) { this.ui.error(e); }
    this.busy.set(false);
  }

  report() {
    if (!this.requireLogin()) return;
    this.reportOpen.set(true);
  }

  buy0() { if (this.requireLogin()) this.buyOpen.set(true); }

  replyTime(min: number) {
    if (min < 60) return this.i18n.t('stats2.minutes', { n: Math.max(5, Math.round(min / 5) * 5) });
    if (min < 60 * 24) return this.i18n.t('stats2.hours', { n: Math.round(min / 60) });
    return this.i18n.t('stats2.days', { n: Math.round(min / 1440) });
  }

  openAlert() {
    if (!this.requireLogin()) return;
    const d = this.d()!;
    this.alertValue.set(d.priceAlertCents ? d.priceAlertCents / 100 : Math.round((d.priceCents / 100) * 0.9));
    this.alertOpen.set(true);
  }

  alertChips() {
    const p = (this.d()?.priceCents ?? 0) / 100;
    return [0.95, 0.9, 0.8].map((k) => ({ label: `−${Math.round((1 - k) * 100)}%`, value: Math.round(p * k) }));
  }

  async saveAlert() {
    const d = this.d()!, v = this.alertValue();
    if (!v) return;
    try {
      await this.api.setPriceAlert(d.id, Math.round(v * 100));
      this.d.set({ ...d, priceAlertCents: Math.round(v * 100), favorite: true });
      this.favOverride.set(true);
      this.alertOpen.set(false);
      this.ui.toast(this.i18n.t('alert.saved', { price: this.i18n.price(Math.round(v * 100), d.currency) }));
    } catch (e) { this.ui.error(e); }
  }

  async clearAlert() {
    const d = this.d()!;
    try { await this.api.clearPriceAlert(d.id); this.d.set({ ...d, priceAlertCents: null }); this.alertOpen.set(false); } catch (e) { this.ui.error(e); }
  }

  async menu() {
    const d = this.d();
    if (!d) return;
    if (d.owner) {
      const i = await this.ui.sheet(d.title, [
        { text: this.i18n.t('common.edit'), icon: 'create-outline' },
        { text: this.i18n.t('common.share'), icon: 'share-social-outline' },
        { text: this.i18n.t('listing.remove'), icon: 'trash-outline', danger: true },
      ]);
      if (i === 0) this.nav.navigateForward(['/sell', d.id]);
      if (i === 1) this.share();
      if (i === 2) this.remove();
      return;
    }
    const i = await this.ui.sheet(d.title, [
      { text: this.i18n.t('common.share'), icon: 'share-social-outline' },
      { text: this.i18n.t('report.reportListing'), icon: 'flag-outline', danger: true },
      { text: this.i18n.t('block.blockSeller'), icon: 'ban-outline', danger: true },
    ]);
    if (i === 0) this.share();
    if (i === 1) this.report();
    if (i === 2) this.blockSeller();
  }

  async blockSeller() {
    if (!this.requireLogin()) return;
    const s = this.d()!.seller;
    if (!(await this.ui.confirm(this.i18n.t('block.confirm', { name: s.displayName }), this.i18n.t('block.block')))) return;
    try { await this.api.block(s.id); this.ui.toast(this.i18n.t('block.done')); this.nav.navigateRoot('/home'); } catch (e) { this.ui.error(e); }
  }

  moderationText(code: string | null) {
    if (!code) return this.i18n.t('moderation.codes.UNSPECIFIED');
    for (const k of ['report.reason.' + code, 'moderation.codes.' + code]) if (this.i18n.has(k)) return this.i18n.t(k);
    return this.i18n.t('moderation.codes.UNSPECIFIED');
  }

  async appeal() {
    const msg = await this.ui.prompt(this.i18n.t('moderation.appeal'), this.i18n.t('moderation.appealSub'), this.i18n.t('moderation.appealPh'), this.i18n.t('common.send'), 20);
    if (!msg) return;
    try { const t = await this.api.appeal(this.id(), msg); this.ui.toast(this.i18n.t('moderation.appealSent', { ref: t.code })); }
    catch (e) { this.ui.error(e); }
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
    if (this.buying()) return;
    this.buying.set(product);
    try { await this.api.checkout(product, this.id()); this.ui.toast(this.i18n.t('plans.done') + ' · ' + this.i18n.t('common.simulated')); await this.ionViewWillEnter(); }
    catch (e) { this.ui.error(e); }
    this.buying.set(null);
  }
}

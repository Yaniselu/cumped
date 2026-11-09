import { MOTION } from '../shared/motion.directives';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, ViewWillEnter } from '@ionic/angular';
import { Api } from '../core/api.service';
import { I18n, TPipe } from '../core/i18n.service';
import { Offer } from '../core/models';
import { Ui } from '../core/ui.service';
import { AvatarComponent } from '../shared/avatar.component';
import { BackButtonComponent } from '../shared/back-button.component';
import { EmptyComponent } from '../shared/empty.component';
import { SkeletonLinesComponent } from '../shared/skeleton.component';

@Component({
  selector: 'page-offers',
  imports: [MOTION, IonContent, IonIcon, RouterLink, TPipe, AvatarComponent, BackButtonComponent, EmptyComponent, SkeletonLinesComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <div class="page narrow">
        <div class="topbar"><cmp-back fallback="/profile" /><div class="title">{{ 'nav.offers' | t }}</div><div class="spacer"></div></div>
        <div class="seg">
          <button [class.on]="tab() === 'r'" (click)="tab.set('r')">{{ 'offer.received' | t }}</button>
          <button [class.on]="tab() === 's'" (click)="tab.set('s')">{{ 'offer.sentTab' | t }}</button>
        </div>
        @if (loading()) { <cmp-skeleton-lines [count]="3" /> }
        @else {
          @let list = tab() === 'r' ? received() : sent();
          @if (!list.length) { <cmp-empty icon="pricetag-outline" [title]="'offer.empty' | t" /> }
          @for (o of list; track o.id; let i = $index) {
            <div class="offer card pad reveal" [style.--i]="i">
              <div class="row between">
                <span class="row who">@if (o.counterpart; as c) { <cmp-avatar [name]="c.displayName" [hue]="c.avatarHue" [size]="32" [verified]="c.idVerified" /><strong>{{ c.displayName }}</strong> }</span>
                <span class="badge" [class.ok]="o.status === 'ACCEPTED'" [class.bad]="o.status === 'DECLINED'" [class.accent]="o.status === 'PENDING'">{{ 'offer.status.' + o.status | t }}</span>
              </div>
              <div class="deal">
                @if (o.listing; as l) { <a class="item" [routerLink]="['/listing', l.id]"><img [src]="api.url(l.imageUrl)" alt="" /><span>{{ l.title }}</span><s class="faint small">{{ i18n.price(l.priceCents, l.currency) }}</s></a> }
                <div class="mid">
                  @if (o.kind === 'SWAP') { <span class="swapic"><ion-icon name="swap-horizontal"></ion-icon></span> }
                  @if (o.amountCents) { <strong class="amt">{{ i18n.price(o.amountCents, o.currency ?? 'EUR') }}</strong> }
                </div>
                @if (o.swapListing; as s) { <a class="item" [routerLink]="['/listing', s.id]"><img [src]="api.url(s.imageUrl)" alt="" /><span>{{ s.title }}</span><span class="faint small">{{ i18n.price(s.priceCents, s.currency) }}</span></a> }
              </div>
              @if (o.message) { <p class="msg">“{{ o.message }}”</p> }
              <div class="row between foot"><span class="faint small">{{ i18n.ago(o.createdAt) }}</span>
                @if (o.status === 'PENDING') {
                  @if (tab() === 'r') { <div class="row"><button class="btn sm light" (click)="decide(o, 'decline')">{{ 'offer.decline' | t }}</button><button class="btn sm" (click)="decide(o, 'accept')">{{ 'offer.accept' | t }}</button></div> }
                  @else { <button class="btn sm light" (click)="decide(o, 'withdraw')">{{ 'offer.withdraw' | t }}</button> }
                }
              </div>
            </div>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .seg { display: flex; padding: 5px; border-radius: 999px; background: var(--surface); box-shadow: var(--shadow-card); margin-bottom: 16px; }
    .seg button { flex: 1; height: 42px; border: 0; border-radius: 999px; background: transparent; font-weight: 600; color: var(--text-2); cursor: pointer; transition: all .3s var(--ease); }
    .seg button.on { background: var(--btn-dark); color: var(--btn-dark-text); }
    .offer { margin-bottom: 12px; } .who { gap: 8px; }
    .deal { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; margin: 14px 0 6px; }
    .item { display: flex; flex-direction: column; gap: 4px; color: inherit; min-width: 0; }
    .item img { width: 100%; aspect-ratio: 1.2; border-radius: 16px; object-fit: cover; background: var(--image-bg); }
    .item span { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mid { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .swapic { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-size: 20px; }
    .amt { font-family: var(--font-display); font-size: 19px; }
    .msg { font-size: 14px; color: var(--text-2); font-style: italic; margin-top: 6px; }
    .foot { margin-top: 12px; }
  `],
})
export class OffersPage implements ViewWillEnter {
  api = inject(Api);
  i18n = inject(I18n);
  private ui = inject(Ui);
  tab = signal<'r' | 's'>('r');
  received = signal<Offer[]>([]);
  sent = signal<Offer[]>([]);
  loading = signal(true);

  async ionViewWillEnter() {
    try { const [r, s] = await Promise.all([this.api.offersReceived(), this.api.offersSent()]); this.received.set(r); this.sent.set(s); } catch { /* ignore */ }
    this.loading.set(false);
  }

  async decide(o: Offer, action: 'accept' | 'decline' | 'withdraw') {
    try { await this.api.decideOffer(o.id, action); this.ui.tap(); await this.ionViewWillEnter(); } catch (e) { this.ui.error(e); }
  }
}

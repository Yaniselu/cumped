import { MOTION } from '../shared/motion.directives';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent, NavController, ViewWillEnter } from '@ionic/angular';
import { Api } from '../core/api.service';
import { I18n, TPipe } from '../core/i18n.service';
import { Order } from '../core/models';
import { Ui } from '../core/ui.service';
import { AvatarComponent } from '../shared/avatar.component';
import { BackButtonComponent } from '../shared/back-button.component';
import { EmptyComponent } from '../shared/empty.component';
import { HoldButtonComponent } from '../shared/hold-button.component';
import { SkeletonLinesComponent } from '../shared/skeleton.component';

const CARRIERS = ['FAN_COURIER', 'SAMEDAY', 'CARGUS', 'DPD', 'GLS', 'POSTA_ROMANA', 'DHL', 'UPS', 'FEDEX', 'OTHER'];
const DISPUTES = ['NOT_RECEIVED', 'NOT_AS_DESCRIBED', 'DAMAGED', 'COUNTERFEIT', 'OTHER'];

/** Comenzile cu plată sigură: lista (cumpărături / vânzări) și pagina unei comenzi, cu pașii explicați simplu. */
@Component({
  selector: 'page-orders',
  imports: [MOTION, IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent, FormsModule, RouterLink, TPipe,
    AvatarComponent, BackButtonComponent, EmptyComponent, HoldButtonComponent, SkeletonLinesComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content></ion-refresher-content></ion-refresher>
      <div class="page narrow">
        <div class="topbar"><cmp-back [fallback]="id() ? '/orders' : '/profile'" /><div class="title">{{ (id() ? 'orders.one' : 'orders.title') | t }}</div><div class="spacer"></div></div>

        @if (!id()) {
          <div class="seg">
            <button [class.on]="tab() === 'BUYER'" (click)="tab.set('BUYER')">{{ 'orders.bought' | t }}</button>
            <button [class.on]="tab() === 'SELLER'" (click)="tab.set('SELLER')">{{ 'orders.sold' | t }}</button>
          </div>
          @if (loading()) { <cmp-skeleton-lines [count]="3" /> }
          @else if (!visible().length) { <cmp-empty icon="bag-handle-outline" [title]="'orders.empty' | t" [sub]="'orders.emptySub' | t" /> }
          @for (o of visible(); track o.id) {
            <a class="row-o card" [routerLink]="['/orders', o.id]">
              <img [src]="api.url(o.listing?.imageUrl)" alt="" />
              <div class="ri"><b>{{ o.listing?.title }}</b><span class="st" [attr.data-s]="o.status">{{ 'orders.status.' + o.status | t }}</span>
                @if (needsMe(o)) { <span class="todo"><ion-icon name="alert-circle"></ion-icon>{{ 'orders.yourMove' | t }}</span> }</div>
              <b class="amt">{{ i18n.price(o.totalCents, o.currency) }}</b>
            </a>
          }
        } @else if (o(); as o) {
          <section class="hero card" [attr.data-s]="o.status">
            <span class="hi"><ion-icon [name]="icon(o)"></ion-icon></span>
            <h2>{{ headline(o) | t }}</h2>
            <p>{{ explain(o) | t: params(o) }}</p>
          </section>

          @if (o.role === 'SELLER' && o.canShip) {
            <section class="card pad act">
              @if (o.delivery === 'COURIER') {
                <h3>{{ 'orders.shipTo' | t }}</h3>
                <div class="addr">@if (o.shipTo; as a) { <b>{{ a.name }}</b><span>{{ a.address }}</span><span>{{ a.postcode }} {{ a.city }}, {{ a.country }}</span><span>{{ a.phone }}</span> }</div>
                <div class="two">
                  <div class="field"><label>{{ 'orders.carrier' | t }}</label>
                    <select class="input" [(ngModel)]="carrier">@for (c of carriers; track c) { <option [value]="c">{{ 'orders.carriers.' + c | t }}</option> }</select></div>
                  <div class="field"><label>{{ 'orders.tracking' | t }}</label><input class="input" [(ngModel)]="tracking" maxlength="40" autocapitalize="characters" /></div>
                </div>
                <button class="btn block" [disabled]="busy() || tracking.trim().length < 5" (click)="ship(o)"><ion-icon name="paper-plane-outline"></ion-icon>{{ 'orders.markShipped' | t }}</button>
              } @else {
                <button class="btn block" [disabled]="busy()" (click)="ship(o)"><ion-icon name="hand-right-outline"></ion-icon>{{ 'orders.markHanded' | t }}</button>
              }
            </section>
          }

          @if (o.canConfirm) {
            <section class="card pad act">
              <cmp-hold-button tone="accent" [block]="true" [caption]="true" icon="checkmark-done" [busy]="busy()" [duration]="1100"
                [label]="'orders.confirm' | t" [confirmText]="'orders.confirmText' | t" (confirmed)="confirm(o)" />
              <p class="faint small center">{{ 'orders.confirmHint' | t }}</p>
            </section>
          }

          @if (o.carrier && o.trackingCode) {
            <div class="card pad track"><ion-icon name="cube-outline"></ion-icon><div><span class="faint small">{{ 'orders.carrier' | t }}</span>
              <b>{{ 'orders.carriers.' + o.carrier | t }} · {{ o.trackingCode }}</b></div>
              <button class="icon-btn sm" (click)="copy(o.trackingCode!)" [attr.aria-label]="'common.copied' | t"><ion-icon name="copy-outline"></ion-icon></button></div>
          }

          <section class="card pad">
            <a class="who" [routerLink]="['/listing', o.listing?.id]">
              <img [src]="api.url(o.listing?.imageUrl)" alt="" /><div><b>{{ o.listing?.title }}</b><span class="faint small">{{ 'orders.code' | t }} {{ o.code }}</span></div></a>
            <div class="sum">
              <div class="r"><span>{{ 'buy.item' | t }}</span><b>{{ i18n.price(o.itemCents, o.currency) }}</b></div>
              @if (o.shippingCents) { <div class="r"><span>{{ 'buy.shipping' | t }}</span><b>{{ i18n.price(o.shippingCents, o.currency) }}</b></div> }
              @if (o.role === 'BUYER') { <div class="r"><span>{{ 'buy.fee' | t }}</span><b>{{ i18n.price(o.feeCents, o.currency) }}</b></div> }
              <div class="r tot"><span>{{ (o.role === 'SELLER' ? 'orders.youGet' : 'buy.total') | t }}</span>
                <b>{{ i18n.price(o.role === 'SELLER' ? o.itemCents + o.shippingCents : o.totalCents, o.currency) }}</b></div>
            </div>
          </section>

          <section class="card pad">
            <h3>{{ 'orders.timeline' | t }}</h3>
            <ol class="tl">
              <li class="on"><span></span><div><b>{{ 'orders.t.paid' | t }}</b><i>{{ when(o.paidAt) }}</i></div></li>
              <li [class.on]="!!o.shippedAt"><span></span><div><b>{{ (o.delivery === 'COURIER' ? 'orders.t.shipped' : 'orders.t.handed') | t }}</b>
                <i>{{ o.shippedAt ? when(o.shippedAt) : ('orders.until' | t: { date: when(o.shipBy) }) }}</i></div></li>
              @if (o.status === 'REFUNDED') { <li class="on bad"><span></span><div><b>{{ 'orders.t.refunded' | t }}</b><i>{{ when(o.refundedAt) }}</i></div></li> }
              @else if (o.status === 'DISPUTED') { <li class="on warn"><span></span><div><b>{{ 'orders.t.disputed' | t }}</b><i>{{ 'orders.reasons.' + o.disputeReason | t }}</i></div></li> }
              @else { <li [class.on]="!!o.completedAt"><span></span><div><b>{{ 'orders.t.completed' | t }}</b>
                <i>{{ o.completedAt ? when(o.completedAt) : o.autoReleaseAt ? ('orders.auto' | t: { date: when(o.autoReleaseAt) }) : '' }}</i></div></li> }
            </ol>
          </section>

          @if (o.counterpart; as c) {
            <section class="card pad cp">
              <cmp-avatar [name]="c.displayName" [hue]="c.avatarHue" [size]="44" [verified]="c.idVerified" />
              <div><span class="faint small">{{ (o.role === 'SELLER' ? 'neg.buyer' : 'neg.seller') | t }}</span><b>{{ c.displayName }}</b></div>
              @if (o.conversationId) { <button class="btn sm light" (click)="chat(o)"><ion-icon name="chatbubble-ellipses-outline"></ion-icon>{{ 'neg.openChat' | t }}</button> }
            </section>
          }

          @if (o.status === 'COMPLETED' && o.role === 'BUYER' && !reviewed()) {
            <section class="card pad review">
              <h3>{{ 'orders.reviewTitle' | t: { name: o.counterpart?.displayName ?? '' } }}</h3>
              <div class="stars" role="radiogroup">@for (s of [1, 2, 3, 4, 5]; track s) {
                <button role="radio" [attr.aria-checked]="rating() === s" [attr.aria-label]="s + '★'" (click)="rating.set(s)" [class.on]="s <= rating()">★</button> }</div>
              <textarea class="input" rows="3" maxlength="600" [(ngModel)]="comment" [placeholder]="'orders.reviewPh' | t"></textarea>
              <button class="btn block" [disabled]="!rating() || busy()" (click)="review(o)">{{ 'orders.reviewSend' | t }}</button>
            </section>
          }

          <div class="more">
            @if (o.canDispute) { <button class="btn light block" (click)="disputeOpen.set(true)"><ion-icon name="alert-circle-outline"></ion-icon>{{ 'orders.problem' | t }}</button> }
            @if (o.canCancel) { <button class="btn ghost block" [disabled]="busy()" (click)="cancel(o)">{{ (o.role === 'SELLER' ? 'orders.cancelSeller' : 'orders.cancelBuyer') | t }}</button> }
            @if (o.simulated) { <p class="faint small center">{{ 'orders.simulated' | t }}</p> }
          </div>

          <ion-modal [isOpen]="disputeOpen()" (didDismiss)="disputeOpen.set(false)" [initialBreakpoint]="0.85" [breakpoints]="[0, 0.85]">
            <ng-template>
              <ion-content>
                <div class="sb">
                  <h2>{{ 'orders.problem' | t }}</h2>
                  <p class="muted">{{ 'orders.problemSub' | t }}</p>
                  @for (r of disputes; track r) {
                    <button class="opt" [class.on]="reason() === r" (click)="reason.set(r)"><span class="rd"></span>{{ 'orders.reasons.' + r | t }}</button>
                  }
                  <textarea class="input" rows="4" maxlength="2000" [(ngModel)]="details" [placeholder]="'orders.problemPh' | t"></textarea>
                  @if (error()) { <div class="error-text">{{ error() }}</div> }
                  <button class="btn block" [disabled]="!reason() || details.trim().length < 10 || busy()" (click)="dispute(o)">{{ 'orders.problemSend' | t }}</button>
                </div>
              </ion-content>
            </ng-template>
          </ion-modal>
        } @else { <cmp-skeleton-lines [count]="4" /> }
      </div>
    </ion-content>
  `,
  styles: [`
    .seg { display: flex; padding: 4px; border-radius: 999px; background: var(--surface); box-shadow: var(--shadow-card); border: 1px solid var(--line); margin-bottom: 16px; }
    .seg button { flex: 1; height: 44px; border: 0; border-radius: 999px; background: transparent; font-weight: 600; font-size: 15px; color: var(--text-2); cursor: pointer; }
    .seg button.on { background: var(--btn-dark); color: var(--btn-dark-text); }
    .row-o { display: flex; align-items: center; gap: 12px; padding: 12px; margin-bottom: 10px; color: inherit; }
    .row-o img { width: 60px; height: 60px; border-radius: 14px; object-fit: cover; background: var(--image-bg); flex: 0 0 auto; }
    .ri { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; } .ri b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .st { align-self: flex-start; font-size: 13px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: var(--surface-2); color: var(--text-2); }
    .st[data-s="PAID"], .st[data-s="SHIPPED"] { background: var(--accent-soft); color: var(--accent); }
    .st[data-s="COMPLETED"] { background: var(--ok-soft); color: var(--ok); }
    .st[data-s="DISPUTED"] { background: var(--warn-soft); color: var(--warn); } .st[data-s="REFUNDED"] { background: var(--accent-2-soft); color: var(--accent-2); }
    .todo { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: var(--accent-2); }
    .amt { font-family: var(--font-display); font-size: 17px; white-space: nowrap; }
    .hero { padding: 22px 18px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 12px; }
    .hi { width: 64px; height: 64px; border-radius: 22px; display: grid; place-items: center; font-size: 32px; background: var(--accent-soft); color: var(--accent); }
    .hero[data-s="COMPLETED"] .hi { background: var(--ok-soft); color: var(--ok); }
    .hero[data-s="DISPUTED"] .hi { background: var(--warn-soft); color: var(--warn); }
    .hero[data-s="REFUNDED"] .hi { background: var(--accent-2-soft); color: var(--accent-2); }
    .hero h2 { font-size: 22px; } .hero p { font-size: 15.5px; color: var(--text); max-width: 440px; }
    .card + .card, .act, .more { margin-top: 12px; }
    .act { display: flex; flex-direction: column; gap: 12px; } .act h3, .review h3 { font-size: 16px; }
    .addr { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: 14px; background: var(--surface-2); font-size: 15px; }
    .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr)); gap: 10px; }
    .track { display: flex; align-items: center; gap: 12px; } .track > ion-icon { font-size: 26px; color: var(--accent); }
    .track div { flex: 1; display: flex; flex-direction: column; }
    .who { display: flex; gap: 12px; align-items: center; color: inherit; margin-bottom: 8px; }
    .who img { width: 52px; height: 52px; border-radius: 12px; object-fit: cover; }
    .who div { display: flex; flex-direction: column; min-width: 0; } .who b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .r { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; }
    .r:last-child { border-bottom: 0; } .r.tot b { font-family: var(--font-display); font-size: 20px; }
    .tl { list-style: none; margin: 12px 0 0; padding: 0 0 0 4px; }
    .tl li { position: relative; display: flex; gap: 14px; padding: 0 0 18px; } .tl li:last-child { padding-bottom: 0; }
    .tl li > span { position: relative; z-index: 1; flex: 0 0 auto; width: 16px; height: 16px; margin-top: 3px; border-radius: 50%; border: 3px solid var(--surface-3); background: var(--surface); }
    .tl li:not(:last-child)::before { content: ''; position: absolute; left: 7px; top: 18px; bottom: 0; width: 2px; background: var(--surface-3); }
    .tl li.on > span { border-color: var(--accent); background: var(--accent); } .tl li.bad > span { border-color: var(--accent-2); background: var(--accent-2); }
    .tl li.warn > span { border-color: var(--warn); background: var(--warn); }
    .tl div { display: flex; flex-direction: column; gap: 2px; } .tl i { font-style: normal; font-size: 14px; color: var(--text-2); }
    .cp { display: flex; align-items: center; gap: 12px; } .cp div { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .review { display: flex; flex-direction: column; gap: 12px; }
    .stars { display: flex; gap: 6px; } .stars button { font-size: 34px; line-height: 1; border: 0; background: none; color: var(--surface-3); cursor: pointer; padding: 2px; }
    .stars button.on { color: #f5a524; }
    .more { display: flex; flex-direction: column; gap: 8px; padding-bottom: 20px; }
    .center { text-align: center; }
    .sb { padding: 22px 18px calc(env(safe-area-inset-bottom) + 30px); display: flex; flex-direction: column; gap: 10px; max-width: 560px; margin: 0 auto; }
    .opt { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 16px; border: 2px solid var(--line); background: var(--surface); color: var(--text); font-size: 15.5px; font-weight: 600; text-align: left; cursor: pointer; }
    .opt.on { border-color: var(--accent); background: var(--accent-soft); }
    .rd { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--surface-3); flex: 0 0 auto; } .opt.on .rd { border: 6px solid var(--accent); }
  `],
})
export class OrdersPage implements ViewWillEnter {
  api = inject(Api);
  i18n = inject(I18n);
  private ui = inject(Ui);
  private nav = inject(NavController);
  id = input<string>();

  carriers = CARRIERS;
  disputes = DISPUTES;
  tab = signal<'BUYER' | 'SELLER'>('BUYER');
  list = signal<Order[]>([]);
  o = signal<Order | null>(null);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  disputeOpen = signal(false);
  reason = signal('');
  rating = signal(0);
  reviewed = signal(false);
  details = '';
  comment = '';
  carrier = 'SAMEDAY';
  tracking = '';
  visible = computed(() => this.list().filter((o) => o.role === this.tab()));

  async ionViewWillEnter() { await this.load(); }

  async load() {
    try {
      if (this.id()) this.o.set(await this.api.order(this.id()!));
      else {
        const l = await this.api.orders();
        this.list.set(l);
        if (!l.some((o) => o.role === 'BUYER') && l.some((o) => o.role === 'SELLER')) this.tab.set('SELLER');
      }
    } catch (e) { this.ui.error(e); }
    this.loading.set(false);
  }

  async refresh(ev: any) { await this.load(); ev.target.complete(); }

  needsMe(o: Order) { return (o.role === 'SELLER' && o.canShip) || (o.role === 'BUYER' && o.status === 'SHIPPED'); }

  icon(o: Order) {
    return ({ PAID: o.role === 'SELLER' ? 'cash-outline' : 'shield-checkmark', SHIPPED: 'cube-outline', COMPLETED: 'checkmark-done',
      DISPUTED: 'alert-circle', REFUNDED: 'arrow-undo' } as Record<string, string>)[o.status];
  }

  headline(o: Order) { return `orders.h.${o.role}.${o.status}`; }

  explain(o: Order) {
    const pickup = o.delivery === 'PICKUP' ? '_P' : '';
    return o.status === 'PAID' || o.status === 'SHIPPED' ? `orders.x.${o.role}.${o.status}${pickup}` : `orders.x.${o.role}.${o.status}`;
  }

  params(o: Order) {
    return { date: this.when(o.shipBy), auto: this.when(o.autoReleaseAt), amount: this.i18n.price(o.itemCents + o.shippingCents, o.currency),
      total: this.i18n.price(o.totalCents, o.currency), name: o.counterpart?.displayName ?? '' };
  }

  when(iso: string | null) { return iso ? this.i18n.date(iso, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''; }

  private async run(fn: () => Promise<Order>) {
    this.busy.set(true);
    this.error.set('');
    try { this.o.set(await fn()); this.ui.tap(); return true; }
    catch (e) { this.error.set(this.ui.errorText(e)); this.ui.error(e); return false; }
    finally { this.busy.set(false); }
  }

  ship(o: Order) { this.run(() => this.api.shipOrder(o.id, o.delivery === 'COURIER' ? this.carrier : undefined, o.delivery === 'COURIER' ? this.tracking.trim() : undefined)); }
  confirm(o: Order) { this.run(() => this.api.confirmOrder(o.id)); }

  async cancel(o: Order) {
    if (!(await this.ui.confirm(this.i18n.t('orders.cancelConfirm'), this.i18n.t('common.confirm')))) return;
    this.run(() => this.api.cancelOrder(o.id));
  }

  async dispute(o: Order) {
    if (await this.run(() => this.api.disputeOrder(o.id, this.reason(), this.details.trim()))) this.disputeOpen.set(false);
  }

  async review(o: Order) {
    this.busy.set(true);
    try {
      await this.api.review({ listingId: o.listing!.id, rating: this.rating(), comment: this.comment.trim() || undefined });
      this.reviewed.set(true);
      this.ui.toast(this.i18n.t('orders.reviewDone'));
    } catch (e) { this.ui.error(e); }
    this.busy.set(false);
  }

  async copy(t: string) { await navigator.clipboard?.writeText(t).catch(() => {}); this.ui.toast(this.i18n.t('common.copied')); }

  chat(o: Order) { this.nav.navigateForward(['/chat', o.conversationId]); }
}

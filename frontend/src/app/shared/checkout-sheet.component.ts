import { Component, effect, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonModal, NavController } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, TPipe } from '../core/i18n.service';
import { Detail, OrderQuote, ShipAddress } from '../core/models';
import { Motion } from '../core/motion.service';
import { Ui } from '../core/ui.service';
import { HoldButtonComponent } from './hold-button.component';

const ADDR_KEY = 'cmp_ship_addr';

/**
 * Cumpărare cu plata sigură: alegi ridicarea sau curierul, vezi exact cât plătești (produs + livrare + protecție)
 * și confirmi ținând apăsat. Banii ajung la vânzător doar după ce confirmi primirea.
 */
@Component({
  selector: 'cmp-checkout-sheet',
  imports: [IonModal, IonContent, IonIcon, FormsModule, TPipe, HoldButtonComponent],
  template: `
    <ion-modal [isOpen]="open()" (didDismiss)="open.set(false)" [initialBreakpoint]="0.95" [breakpoints]="[0, 0.95]">
      <ng-template>
        <ion-content>
          @if (listing(); as l) {
            <div class="sb">
              <h2>{{ 'buy.title' | t }}</h2>
              <div class="item"><img [src]="api.url(l.images[0]?.thumbUrl)" alt="" /><div><b>{{ l.title }}</b><span class="muted">{{ l.seller.displayName }}</span></div></div>

              <div class="protect">
                <ion-icon name="shield-checkmark"></ion-icon>
                <div><b>{{ 'buy.protectTitle' | t }}</b><p>{{ 'buy.protectText' | t }}</p></div>
              </div>

              <h3>{{ 'buy.delivery' | t }}</h3>
              <div class="opts">
                <button class="opt" [class.on]="delivery() === 'PICKUP'" (click)="setDelivery('PICKUP')">
                  <ion-icon name="people-outline"></ion-icon><div><b>{{ 'buy.pickup' | t }}</b><span>{{ 'buy.pickupSub' | t: { city: l.city } }}</span></div></button>
                <button class="opt" [class.on]="delivery() === 'COURIER'" [disabled]="!l.shipsTo.length" (click)="setDelivery('COURIER')">
                  <ion-icon name="cube-outline"></ion-icon><div><b>{{ 'buy.courier' | t }}</b>
                    <span>{{ l.shipsTo.length ? ('buy.courierSub' | t) : ('listing.pickupOnly' | t) }}</span></div></button>
              </div>

              @if (delivery() === 'COURIER') {
                <div class="addr fade">
                  <div class="field"><label>{{ 'buy.name' | t }}</label><input class="input" [(ngModel)]="addr.name" autocomplete="name" maxlength="120" /></div>
                  <div class="field"><label>{{ 'buy.address' | t }}</label><input class="input" [(ngModel)]="addr.address" autocomplete="street-address" maxlength="300" /></div>
                  <div class="two">
                    <div class="field"><label>{{ 'buy.city' | t }}</label><input class="input" [(ngModel)]="addr.city" autocomplete="address-level2" maxlength="80" /></div>
                    <div class="field"><label>{{ 'buy.postcode' | t }}</label><input class="input" [(ngModel)]="addr.postcode" autocomplete="postal-code" maxlength="20" /></div>
                  </div>
                  <div class="two">
                    <div class="field"><label>{{ 'buy.country' | t }}</label>
                      <select class="input" [(ngModel)]="addr.country" (ngModelChange)="requote()">@for (c of countries(); track c) { <option [value]="c">{{ c }}</option> }</select></div>
                    <div class="field"><label>{{ 'buy.phone' | t }}</label><input class="input" type="tel" [(ngModel)]="addr.phone" autocomplete="tel" maxlength="30" /></div>
                  </div>
                  <p class="faint small">{{ 'buy.addrPrivacy' | t }}</p>
                </div>
              }

              @if (quote(); as q) {
                <div class="sum card">
                  <div class="r"><span>{{ 'buy.item' | t }} @if (q.offerApplied) { <i class="tag">{{ 'buy.offerPrice' | t }}</i> }</span><b>{{ i18n.price(q.itemCents, q.currency) }}</b></div>
                  @if (delivery() === 'COURIER') { <div class="r"><span>{{ 'buy.shipping' | t }} <i class="faint">{{ 'listing.days' | t: { min: q.minDays, max: q.maxDays } }}</i></span><b>{{ i18n.price(q.shippingCents, q.currency) }}</b></div> }
                  <div class="r"><span>{{ 'buy.fee' | t }}</span><b>{{ i18n.price(q.feeCents, q.currency) }}</b></div>
                  <div class="r tot"><span>{{ 'buy.total' | t }}</span><b>{{ i18n.price(q.totalCents, q.currency) }}</b></div>
                </div>
              } @else { <div class="skeleton" style="height: 150px; border-radius: 20px"></div> }

              @if (error()) { <div class="error-text">{{ error() }}</div> }
              <cmp-hold-button tone="accent" [block]="true" [caption]="true" icon="lock-closed" [busy]="busy()" [disabled]="!quote() || !valid()"
                [label]="'buy.payHold' | t: { total: quote() ? i18n.price(quote()!.totalCents, quote()!.currency) : '' }"
                [confirmText]="'buy.payConfirm' | t: { total: quote() ? i18n.price(quote()!.totalCents, quote()!.currency) : '' }" (confirmed)="pay()" />
              <ul class="steps">
                <li><span>1</span>{{ 'buy.step1' | t }}</li>
                <li><span>2</span>{{ (delivery() === 'COURIER' ? 'buy.step2c' : 'buy.step2p') | t }}</li>
                <li><span>3</span>{{ 'buy.step3' | t }}</li>
              </ul>
            </div>
          }
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .sb { padding: 22px 18px calc(env(safe-area-inset-bottom) + 30px); display: flex; flex-direction: column; gap: 14px; max-width: 560px; margin: 0 auto; }
    h3 { font-size: 16px; margin-top: 4px; }
    .item { display: flex; gap: 12px; align-items: center; }
    .item img { width: 60px; height: 60px; border-radius: 14px; object-fit: cover; background: var(--image-bg); flex: 0 0 auto; }
    .item div { display: flex; flex-direction: column; min-width: 0; } .item b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .protect { display: flex; gap: 12px; padding: 14px; border-radius: 18px; background: var(--ok-soft); }
    .protect > ion-icon { font-size: 28px; color: var(--ok); flex: 0 0 auto; }
    .protect b { font-size: 15.5px; } .protect p { font-size: 14px; color: var(--text); margin-top: 4px; }
    .opts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 8px; }
    .opt { display: flex; gap: 12px; align-items: center; text-align: left; padding: 14px; border-radius: 18px; border: 2px solid var(--line); background: var(--surface); color: var(--text); cursor: pointer; }
    .opt.on { border-color: var(--accent); background: var(--accent-soft); } .opt:disabled { opacity: .45; }
    .opt ion-icon { font-size: 24px; color: var(--accent); flex: 0 0 auto; }
    .opt div { display: flex; flex-direction: column; gap: 2px; } .opt span { font-size: 13.5px; color: var(--text-2); }
    .addr { display: flex; flex-direction: column; gap: 10px; }
    .two { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr)); gap: 10px; }
    .sum { padding: 6px 16px; }
    .r { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); font-size: 15.5px; }
    .r:last-child { border-bottom: 0; } .r b { white-space: nowrap; }
    .r.tot { font-size: 18px; } .r.tot b { font-family: var(--font-display); font-size: 22px; }
    .tag { font-style: normal; font-size: 12px; font-weight: 700; color: var(--ok); background: var(--ok-soft); padding: 2px 8px; border-radius: 8px; margin-left: 6px; }
    .steps { list-style: none; padding: 0; margin: 4px 0 0; display: flex; flex-direction: column; gap: 10px; }
    .steps li { display: flex; gap: 10px; align-items: flex-start; font-size: 14.5px; color: var(--text-2); line-height: 1.45; }
    .steps span { flex: 0 0 auto; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); color: var(--text); font-weight: 700; font-size: 13px; }
  `],
})
export class CheckoutSheetComponent {
  api = inject(Api);
  i18n = inject(I18n);
  private auth = inject(AuthService);
  private ui = inject(Ui);
  private nav = inject(NavController);
  private motion = inject(Motion);
  open = model(false);
  listing = input<Detail | null>(null);

  delivery = signal<'PICKUP' | 'COURIER'>('PICKUP');
  quote = signal<OrderQuote | null>(null);
  busy = signal(false);
  error = signal('');
  addr: ShipAddress = { name: '', address: '', city: '', postcode: '', country: 'RO', phone: '', ...JSON.parse(localStorage.getItem(ADDR_KEY) ?? '{}') };

  constructor() {
    effect(() => {
      if (!this.open() || !this.listing()) return;
      const l = this.listing()!;
      this.error.set('');
      if (!this.addr.country) this.addr.country = this.auth.user()?.country || l.country;
      this.delivery.set(l.shipsTo.length && l.city !== this.auth.user()?.city ? 'COURIER' : 'PICKUP');
      queueMicrotask(() => this.requote());
    });
  }

  countries() {
    const l = this.listing();
    if (!l) return [];
    return l.shipsTo.includes('*') ? ['RO', 'MD', 'BG', 'HU', 'DE', 'AT', 'IT', 'FR', 'ES', 'PL', 'CZ', 'SK', 'NL', 'BE', 'GB', 'IE', 'PT', 'GR', 'HR', 'SI', 'SE', 'DK', 'FI', 'CH', 'US', 'CA'] : l.shipsTo;
  }

  setDelivery(d: 'PICKUP' | 'COURIER') { this.delivery.set(d); this.requote(); }

  async requote() {
    const l = this.listing();
    if (!l) return;
    this.quote.set(null);
    try { this.quote.set(await this.api.orderQuote(l.id, this.delivery(), this.delivery() === 'COURIER' ? this.addr.country : undefined)); }
    catch (e) { this.error.set(this.ui.errorText(e)); }
  }

  valid() {
    if (this.delivery() === 'PICKUP') return true;
    const a = this.addr;
    return a.name.trim().length >= 3 && a.address.trim().length >= 5 && a.city.trim().length >= 2 && a.phone.replace(/\D/g, '').length >= 6 && !!a.country;
  }

  async pay() {
    const l = this.listing();
    if (!l || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const o = await this.api.createOrder(l.id, { delivery: this.delivery(), address: this.delivery() === 'COURIER' ? this.addr : undefined });
      if (this.delivery() === 'COURIER') localStorage.setItem(ADDR_KEY, JSON.stringify(this.addr));
      this.open.set(false);
      this.motion.confetti(60);
      this.ui.toast(this.i18n.t('buy.done'));
      this.nav.navigateForward(['/orders', o.id]);
    } catch (e) { this.error.set(this.ui.errorText(e)); }
    this.busy.set(false);
  }
}

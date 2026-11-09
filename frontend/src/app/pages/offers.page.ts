import { MOTION } from '../shared/motion.directives';
import { HoldButtonComponent } from '../shared/hold-button.component';
import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent, NavController, ViewWillEnter } from '@ionic/angular';
import { Api } from '../core/api.service';
import { Badges } from '../core/badges.service';
import { I18n, TPipe } from '../core/i18n.service';
import { Negotiation, OfferStep } from '../core/models';
import { Motion } from '../core/motion.service';
import { Ui } from '../core/ui.service';
import { AvatarComponent } from '../shared/avatar.component';
import { BackButtonComponent } from '../shared/back-button.component';
import { EmptyComponent } from '../shared/empty.component';
import { PriceChip, PriceInputComponent } from '../shared/price-input.component';
import { SkeletonLinesComponent } from '../shared/skeleton.component';

type Filter = 'all' | 'SELLER' | 'BUYER';

/**
 * Negocieri: fiecare fir = o ofertă și contraofertele ei (maximum 6 runde, 48 h pentru fiecare răspuns).
 * Cine primește ultima propunere poate accepta, refuza sau face o contraofertă (slider + sumă exactă).
 */
@Component({
  selector: 'page-offers',
  imports: [MOTION, HoldButtonComponent, IonContent, IonIcon, IonModal, IonRefresher, IonRefresherContent, RouterLink, FormsModule, TPipe,
    AvatarComponent, BackButtonComponent, EmptyComponent, SkeletonLinesComponent, PriceInputComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content></ion-refresher-content></ion-refresher>
      <div class="page narrow">
        <div class="topbar"><cmp-back fallback="/profile" /><div class="title">{{ 'nav.offers' | t }}</div><div class="spacer"></div></div>

        <div class="seg" role="tablist">
          @for (f of filters; track f) {
            <button role="tab" [attr.aria-selected]="filter() === f" [class.on]="filter() === f" (click)="filter.set(f)">
              {{ 'neg.filter.' + f | t }}@if (count(f); as n) { <span class="cnt">{{ n }}</span> }</button>
          }
        </div>

        @if (loading()) { <cmp-skeleton-lines [count]="3" /> }
        @else {
          @if (!visible().length) { <cmp-empty icon="pricetag-outline" [title]="'offer.empty' | t" [sub]="'neg.emptySub' | t" /> }
          @for (n of visible(); track n.threadId; let i = $index) {
            @let c = n.current;
            @let cur = n.listing?.currency ?? 'RON';
            <article class="neg card reveal" [style.--i]="i" [class.turn]="n.myTurn" [class.hl]="n.threadId === thread()">
              <header class="nh">
                @if (n.listing; as l) {
                  <a class="thumb" [routerLink]="['/listing', l.id]"><img [src]="api.url(l.imageUrl)" [alt]="l.title" /></a>
                  <div class="ttl">
                    <a [routerLink]="['/listing', l.id]" class="lt">{{ l.title }}</a>
                    <span class="small muted">{{ 'neg.listPrice' | t }} {{ i18n.price(l.priceCents, cur) }}</span>
                    @if (n.counterpart; as p) {
                      <span class="cp small"><cmp-avatar [name]="p.displayName" [hue]="p.avatarHue" [size]="20" [verified]="p.idVerified" />
                        {{ (n.myRole === 'SELLER' ? 'neg.buyer' : 'neg.seller') | t }}: <b>{{ p.displayName }}</b></span>
                    }
                  </div>
                }
                <span class="st badge" [attr.data-s]="c.status">{{ statusLabel(n) | t }}</span>
              </header>

              <div class="now">
                <div class="who small muted">{{ (c.proposer === n.myRole ? 'neg.youProposed' : 'neg.theyProposed') | t }}</div>
                @if (c.kind === 'SWAP') {
                  <div class="swap">
                    @if (c.swapListing; as s) {
                      <a class="sw" [routerLink]="['/listing', s.id]"><img [src]="api.url(s.imageUrl)" alt="" /><span>{{ s.title }}</span></a>
                    }
                    @if (c.amountCents) { <span class="plus">+ {{ i18n.price(c.amountCents, cur) }}</span> }
                  </div>
                } @else {
                  <div class="amt">{{ i18n.price(c.amountCents, cur) }}
                    @if (n.listing && c.amountCents) { <span class="off">−{{ pct(c.amountCents, n.listing.priceCents) }}%</span> }</div>
                }
                @if (c.message) { <p class="msg">“{{ c.message }}”</p> }
                @if (c.status === 'PENDING') {
                  <div class="meta small"><ion-icon name="time-outline"></ion-icon>{{ 'neg.expiresIn' | t: { h: hoursLeft(c) } }}
                    · {{ 'neg.round' | t: { n: c.round, max: 6 } }}</div>
                }
              </div>

              @if (n.history.length > 1) {
                <button class="histbtn" (click)="toggle(n.threadId)" [attr.aria-expanded]="open().has(n.threadId)">
                  <ion-icon [name]="open().has(n.threadId) ? 'chevron-up' : 'chevron-down'"></ion-icon>{{ 'neg.history' | t: { n: n.history.length } }}</button>
                @if (open().has(n.threadId)) {
                  <ol class="timeline fade">
                    @for (h of n.history; track h.id) {
                      <li [class.mine]="h.proposer === n.myRole">
                        <span class="dot"></span>
                        <div><b>{{ (h.proposer === n.myRole ? 'neg.you' : (h.proposer === 'SELLER' ? 'neg.seller' : 'neg.buyer')) | t }}</b>
                          · {{ h.kind === 'SWAP' ? ('neg.swapOffer' | t) : i18n.price(h.amountCents, cur) }}
                          <span class="faint">· {{ i18n.ago(h.createdAt) }}</span></div>
                        <span class="hs" [attr.data-s]="h.status">{{ 'offer.status.' + h.status | t }}</span>
                      </li>
                    }
                  </ol>
                }
              }

              <footer class="acts">
                @if (n.myTurn) {
                  <cmp-hold-button class="grow full" tone="accent" [block]="true" [caption]="true" icon="checkmark" [busy]="busy()"
                    [label]="c.amountCents && c.kind === 'PRICE' ? ('neg.accept' | t) + ' ' + i18n.price(c.amountCents, cur) : ('neg.accept' | t)"
                    [confirmText]="acceptText(n)" (confirmed)="act(n, 'accept')" />
                  @if (n.canCounter) { <button class="btn sm light" [disabled]="busy()" (click)="openCounter(n)"><ion-icon name="swap-vertical"></ion-icon>{{ 'neg.counter' | t }}</button> }
                  <button class="btn sm ghost" [disabled]="busy()" (click)="act(n, 'decline')">{{ 'neg.decline' | t }}</button>
                } @else if (c.status === 'PENDING') {
                  <span class="wait small muted"><span class="pulse"></span>{{ 'neg.waiting' | t }}</span>
                  <button class="btn sm ghost" [disabled]="busy()" (click)="act(n, 'withdraw')">{{ 'neg.withdraw' | t }}</button>
                } @else if (c.status === 'ACCEPTED') {
                  <span class="deal small"><ion-icon name="checkmark-circle"></ion-icon>{{ (n.myRole === 'BUYER' ? 'neg.dealBuyer' : 'neg.dealSeller') | t }}</span>
                }
                @if (n.conversationId) { <button class="icon-btn sm" (click)="chat(n)" [attr.aria-label]="'neg.openChat' | t"><ion-icon name="chatbubble-ellipses-outline"></ion-icon></button> }
              </footer>
            </article>
          }
          <p class="rules faint small"><ion-icon name="information-circle-outline"></ion-icon>{{ 'neg.rules' | t }}</p>
        }
      </div>

      <ion-modal [isOpen]="!!counterFor()" (didDismiss)="counterFor.set(null)" [initialBreakpoint]="0.9" [breakpoints]="[0, 0.9]" class="sheet">
        <ng-template>
          <ion-content>
            @if (counterFor(); as n) {
              <div class="sheet-body">
                <h2>{{ 'neg.counterTitle' | t }}</h2>
                <p class="muted small">{{ (n.myRole === 'SELLER' ? 'neg.counterSellerHint' : 'neg.counterBuyerHint') | t: { amount: i18n.price(n.current.amountCents, n.listing?.currency ?? 'RON') } }}</p>
                <div class="card pad">
                  <cmp-price-input [(value)]="counterValue" scale="linear" [min]="range().min" [max]="range().max" [currency]="n.listing?.currency ?? 'RON'"
                    [reference]="(n.listing?.priceCents ?? 0) / 100" [refLabel]="'neg.listShort' | t" [deltaLabel]="'neg.vsList' | t"
                    [chips]="chips()" [big]="true" [label]="'neg.counterTitle' | t" />
                </div>
                @if (counterError()) { <div class="error-text fade">{{ counterError() }}</div> }
                <div class="field"><label>{{ 'offer.message' | t }}</label>
                  <input class="input" [(ngModel)]="counterMsg" maxlength="400" [placeholder]="'neg.msgPh' | t" /></div>
                <button class="btn block" [disabled]="busy() || !validCounter()" (click)="sendCounter()"><ion-icon name="send"></ion-icon>{{ 'neg.sendCounter' | t }}</button>
                <p class="faint small center">{{ 'neg.counterNote' | t }}</p>
              </div>
            }
          </ion-content>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: [`
    .seg { display: flex; padding: 4px; border-radius: 999px; background: var(--surface); box-shadow: var(--shadow-card); border: 1px solid var(--line); margin-bottom: 16px; }
    .seg button { flex: 1; min-width: 0; height: 40px; border: 0; border-radius: 999px; background: transparent; font-weight: 600; font-size: 13.5px; color: var(--text-2);
      cursor: pointer; transition: all .3s var(--ease); display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; overflow: hidden; }
    .seg button.on { background: var(--btn-dark); color: var(--btn-dark-text); }
    .cnt { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 99px; background: var(--accent-2); color: #fff; font-size: 11px; display: inline-grid; place-items: center; }
    .neg { padding: 14px; margin-bottom: 12px; transition: box-shadow .3s; }
    .neg.turn { box-shadow: var(--shadow-card), 0 0 0 2px var(--accent-soft); }
    .neg.hl { box-shadow: var(--shadow-card), 0 0 0 2px var(--accent); }
    .nh { display: flex; gap: 12px; align-items: flex-start; }
    .thumb { flex: 0 0 auto; width: 64px; height: 64px; border-radius: 16px; overflow: hidden; background: var(--image-bg); }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .ttl { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .lt { color: var(--text); font-weight: 650; font-size: 14.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cp { display: inline-flex; align-items: center; gap: 4px 6px; color: var(--text-2); margin-top: 2px; min-width: 0; flex-wrap: wrap; }
    .cp b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .st { flex: 0 0 auto; height: 24px; font-size: 11.5px; background: var(--surface-2); color: var(--text-2); }
    .st[data-s="PENDING"] { background: var(--accent-soft); color: var(--accent); }
    .st[data-s="ACCEPTED"] { background: var(--ok-soft); color: var(--ok); }
    .st[data-s="DECLINED"], .st[data-s="EXPIRED"] { background: var(--accent-2-soft); color: var(--accent-2); }
    .now { margin: 14px 0 4px; padding: 14px; border-radius: 18px; background: var(--surface-2); }
    .amt { font-family: var(--font-display); font-weight: 700; font-size: 28px; letter-spacing: -0.03em; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
    .off { font-family: var(--font-body); font-size: 13px; font-weight: 650; color: var(--ok); }
    .swap { display: flex; align-items: center; gap: 10px; margin-top: 6px; flex-wrap: wrap; }
    .sw { display: flex; align-items: center; gap: 8px; color: var(--text); font-weight: 600; font-size: 14px; min-width: 0; }
    .sw img { width: 44px; height: 44px; border-radius: 12px; object-fit: cover; }
    .sw span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .plus { font-family: var(--font-display); font-weight: 700; font-size: 18px; }
    .msg { font-size: 14px; color: var(--text-2); font-style: italic; margin-top: 6px; overflow-wrap: anywhere; }
    .meta { display: flex; align-items: center; gap: 5px; margin-top: 8px; color: var(--text-2); flex-wrap: wrap; }
    .histbtn { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: var(--text-2); font-weight: 600; font-size: 13px; padding: 8px 2px; cursor: pointer; }
    .timeline { list-style: none; margin: 0 0 6px; padding: 0 0 0 6px; }
    .timeline li { position: relative; display: flex; align-items: center; gap: 10px; padding: 7px 0 7px 18px; font-size: 13px; border-left: 2px solid var(--surface-3); }
    .timeline li div { flex: 1; min-width: 0; }
    .timeline .dot { position: absolute; left: -6px; width: 10px; height: 10px; border-radius: 50%; background: var(--surface-3); border: 2px solid var(--surface); }
    .timeline li.mine .dot { background: var(--accent); }
    .hs { font-size: 11px; font-weight: 650; color: var(--text-3); white-space: nowrap; }
    .hs[data-s="ACCEPTED"] { color: var(--ok); } .hs[data-s="PENDING"] { color: var(--accent); }
    .acts { display: flex; align-items: center; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
    .acts .grow { flex: 1 1 160px; } .acts cmp-hold-button.full { flex: 1 1 100%; }
    .acts .icon-btn { margin-left: auto; }
    .wait { display: inline-flex; align-items: center; gap: 8px; flex: 1; }
    .pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: pulseRing 1.6s infinite; box-shadow: 0 0 0 0 rgba(91,61,245,.5); }
    .deal { display: inline-flex; align-items: center; gap: 6px; color: var(--ok); font-weight: 650; flex: 1; }
    .deal ion-icon { font-size: 18px; }
    .rules { display: flex; gap: 6px; align-items: flex-start; margin: 8px 4px 0; line-height: 1.45; }
    .rules ion-icon { flex: 0 0 auto; font-size: 16px; margin-top: 1px; }
    .sheet-body { padding: 22px 18px calc(env(safe-area-inset-bottom) + 28px); display: flex; flex-direction: column; gap: 14px; max-width: 560px; margin: 0 auto; }
    .center { text-align: center; }
    @media (max-width: 360px) { .st { display: none; } .thumb { width: 52px; height: 52px; } .amt { font-size: 24px; } .acts .btn.sm { padding: 0 12px; } }
  `],
})
export class OffersPage implements ViewWillEnter {
  api = inject(Api);
  i18n = inject(I18n);
  private ui = inject(Ui);
  private nav = inject(NavController);
  private motion = inject(Motion);
  private badges = inject(Badges);
  /** ?thread=… evidențiază un fir anume (din chat sau din notificare). */
  thread = input<string>();

  filters: Filter[] = ['all', 'SELLER', 'BUYER'];
  filter = signal<Filter>('all');
  items = signal<Negotiation[]>([]);
  loading = signal(true);
  busy = signal(false);
  open = signal(new Set<string>());
  counterFor = signal<Negotiation | null>(null);
  counterValue = signal<number | null>(null);
  counterMsg = '';
  counterError = signal('');

  visible = computed(() => {
    const f = this.filter();
    return this.items().filter((n) => f === 'all' || n.myRole === f)
      .sort((a, b) => Number(b.myTurn) - Number(a.myTurn) || b.current.createdAt.localeCompare(a.current.createdAt));
  });

  range = computed(() => {
    const n = this.counterFor();
    if (!n) return { min: 0, max: 100 };
    const list = (n.listing?.priceCents ?? 0) / 100, cur = (n.current.amountCents ?? 0) / 100;
    if (n.myRole === 'SELLER') return { min: Math.ceil(Math.max(cur, list * 0.3)), max: list };
    const mine = [...n.history].reverse().find((h) => h.proposer === 'BUYER' && h.amountCents)?.amountCents;
    return { min: Math.floor(Math.max(list * 0.3, mine ? mine / 100 : list * 0.5)), max: cur };
  });

  chips = computed<PriceChip[]>(() => {
    const n = this.counterFor();
    if (!n) return [];
    const r = this.range(), list = (n.listing?.priceCents ?? 0) / 100;
    const mid = Math.round((r.min + r.max) / 2);
    const out: PriceChip[] = [{ label: this.i18n.t('neg.midpoint') + ' · ' + this.fmt(mid, n), value: mid }];
    if (n.myRole === 'SELLER') {
      for (const p of [0.95, 0.9]) { const v = Math.round(list * p); if (v > r.min && v < r.max) out.push({ label: `−${Math.round((1 - p) * 100)}%`, value: v }); }
    } else {
      const v = Math.round(r.max * 0.97); if (v > r.min) out.push({ label: '−3%', value: v });
    }
    return out;
  });

  validCounter = computed(() => {
    const n = this.counterFor(), v = this.counterValue();
    if (!n || v == null || v <= 0) return false;
    const cur = (n.current.amountCents ?? 0) / 100, list = (n.listing?.priceCents ?? 0) / 100;
    return n.myRole === 'SELLER' ? v > cur && v <= list : v < cur && v >= list * 0.3;
  });

  async ionViewWillEnter() { await this.load(); }

  async load() {
    try {
      const list = await this.api.negotiations();
      this.items.set(list);
      const t = this.thread();
      if (t) this.open.update((s) => new Set(s).add(t));
    } catch (e) { this.ui.error(e); }
    this.loading.set(false);
  }

  async refresh(ev: any) { await this.load(); this.badges.refresh(); ev.target.complete(); }

  count(f: Filter) { return this.items().filter((n) => n.myTurn && (f === 'all' || n.myRole === f)).length; }

  statusLabel(n: Negotiation) {
    if (n.current.status === 'PENDING') return n.myTurn ? 'neg.yourTurn' : 'neg.waitingShort';
    return 'offer.status.' + n.current.status;
  }

  acceptText(n: Negotiation) {
    const c = n.current, cur = n.listing?.currency ?? 'RON';
    return this.i18n.t('hold.acceptOffer', { amount: c.amountCents ? this.i18n.price(c.amountCents, cur) : this.i18n.t('neg.swapOffer') });
  }

  pct(amount: number, list: number) { return Math.max(0, Math.round((1 - amount / list) * 100)); }

  hoursLeft(s: OfferStep) { return Math.max(1, Math.round((new Date(s.expiresAt).getTime() - Date.now()) / 3_600_000)); }

  private fmt(v: number, n: Negotiation) { return this.i18n.price(Math.round(v * 100), n.listing?.currency ?? 'RON'); }

  toggle(id: string) { this.open.update((s) => { const x = new Set(s); x.has(id) ? x.delete(id) : x.add(id); return x; }); }

  async act(n: Negotiation, action: 'accept' | 'decline' | 'withdraw') {
    if (action !== 'accept') {
      const ok = await this.ui.confirm(this.i18n.t(action === 'decline' ? 'neg.declineConfirm' : 'neg.withdrawConfirm'), this.i18n.t(action === 'decline' ? 'neg.decline' : 'neg.withdraw'));
      if (!ok) return;
    }
    this.busy.set(true);
    try {
      await this.api.respondOffer(n.current.id, action);
      if (action === 'accept') { this.motion.confetti(60); this.ui.toast(this.i18n.t('neg.accepted')); }
      this.ui.tap();
      await this.load();
      this.badges.refresh();
    } catch (e) { this.ui.error(e); await this.load(); }
    this.busy.set(false);
  }

  openCounter(n: Negotiation) {
    this.counterError.set('');
    this.counterMsg = '';
    this.counterFor.set(n);
    const r = this.range();
    this.counterValue.set(Math.round((r.min + r.max) / 2));
  }

  async sendCounter() {
    const n = this.counterFor();
    if (!n || !this.validCounter()) return;
    this.busy.set(true);
    this.counterError.set('');
    try {
      await this.api.respondOffer(n.current.id, 'counter', { amountCents: Math.round(this.counterValue()! * 100), message: this.counterMsg.trim() || undefined });
      this.counterFor.set(null);
      this.ui.toast(this.i18n.t('neg.counterSent'));
      this.ui.tap();
      await this.load();
      this.badges.refresh();
    } catch (e) { this.counterError.set(this.ui.errorText(e)); }
    this.busy.set(false);
  }

  chat(n: Negotiation) { this.nav.navigateForward(['/chat', n.conversationId]); }
}

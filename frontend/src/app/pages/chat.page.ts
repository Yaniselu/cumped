import { MOTION } from '../shared/motion.directives';
import { Component, ElementRef, ViewChild, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonFooter, IonIcon, NavController, ViewDidLeave, ViewWillEnter } from '@ionic/angular';
import { Api, errorCode } from '../core/api.service';
import { Badges } from '../core/badges.service';
import { I18n, TPipe } from '../core/i18n.service';
import { ChatMessage, ConversationSummary } from '../core/models';
import { OfferEvent, OrderEvent, offerEventText, orderEventText, parseOfferEvent, parseOrderEvent } from '../core/offer-event';
import { Purchases } from '../core/purchases.service';
import { ReportSheetComponent, ReportTarget } from '../shared/report-sheet.component';
import { Ui } from '../core/ui.service';
import { AvatarComponent } from '../shared/avatar.component';
import { BackButtonComponent } from '../shared/back-button.component';

@Component({
  selector: 'page-chat',
  imports: [MOTION, IonContent, IonFooter, IonIcon, FormsModule, RouterLink, TPipe, AvatarComponent, BackButtonComponent, ReportSheetComponent],
  template: `
    <ion-content cmpScrollFx #content [fullscreen]="true">
      <div class="page narrow chat">
        <div class="head glass">
          <cmp-back fallback="/chats" />
          @if (conv(); as c) {
            <a class="who" [routerLink]="['/user', c.other.id]">
              <cmp-avatar [name]="c.other.displayName" [hue]="c.other.avatarHue" [size]="40" [verified]="c.other.idVerified" />
              <div><strong>{{ c.other.displayName }}</strong><span class="small muted">{{ (c.role === 'BUYER' ? 'chat.seller' : 'chat.buyer') | t }}
                @if (c.other.idVerified) { · <ion-icon name="shield-checkmark" class="vf"></ion-icon> {{ 'common.verified' | t }} }</span></div>
            </a>
            <button class="icon-btn sm" (click)="menu()" [attr.aria-label]="'common.more' | t"><ion-icon name="ellipsis-horizontal"></ion-icon></button>
          }
        </div>
        @if (conv(); as c) {
          <a class="lst card press" [routerLink]="['/listing', c.listing.id]">
            <img [src]="api.url(c.listing.imageUrl)" alt="" /><div><span class="small">{{ c.listing.title }}</span><strong>{{ i18n.price(c.listing.priceCents, c.listing.currency) }}</strong></div>
            <ion-icon name="chevron-forward" class="faint"></ion-icon>
          </a>
        }
        <div class="safety"><ion-icon name="shield-checkmark"></ion-icon>{{ 'chat.safety' | t }}</div>
        <div class="msgs">
          @for (m of messages(); track m.id; let i = $index) {
            @if (offerOf(m); as e) {
              <a class="oev" [class.fresh]="i >= freshFrom" [attr.data-e]="e.event" routerLink="/offers">
                <span class="oi"><ion-icon [name]="evIcon(e.event, e.kind)"></ion-icon></span>
                <div><b>{{ evText(e, m.mine) }}</b><span class="small muted">{{ i18n.date(m.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }} · {{ 'neg.view' | t }}</span></div>
                <ion-icon name="chevron-forward" class="faint"></ion-icon>
              </a>
            } @else if (orderOf(m); as e) {
              <a class="oev ord" [class.fresh]="i >= freshFrom" [attr.data-e]="e.event" routerLink="/orders">
                <span class="oi"><ion-icon [name]="orderIcon(e.event)"></ion-icon></span>
                <div><b>{{ orderText(e) }}</b><span class="small muted">{{ i18n.date(m.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }} · {{ 'orders.view' | t }}</span></div>
                <ion-icon name="chevron-forward" class="faint"></ion-icon>
              </a>
            } @else {
            <div class="msg" [class.mine]="m.mine" [class.fresh]="i >= freshFrom">
              <div class="bubble" (click)="!m.mine && sel.set(sel() === m.id ? null : m.id)">{{ m.body }}</div>
              @if (translated()[m.id]; as tr) { <div class="trans fade"><ion-icon name="language-outline"></ion-icon>{{ tr }}</div> }
              @if (!m.mine && aiOn() && !translated()[m.id]) { <button class="tbtn" (click)="translate(m.id)" [disabled]="translating() === m.id">{{ (translating() === m.id ? 'ai.translating' : 'ai.translate') | t }}</button> }
              @if (sel() === m.id && !m.mine) { <button class="rmsg fade" (click)="reportMessage(m.id)"><ion-icon name="flag-outline"></ion-icon>{{ 'report.reportMessage' | t }}</button> }
              @if (m.flagged && m.flagReason) {
                <div class="flag" [class.danger]="m.flagReason === 'PAYMENT_LINK' || m.flagReason === 'OFF_PLATFORM_CHAT' || m.flagReason === 'RISKY_PAYMENT'">
                  <ion-icon name="warning"></ion-icon>{{ 'chat.flag.' + m.flagReason | t }}
                  @if (!m.mine) { <button (click)="report()">{{ 'chat.reportUser' | t }}</button> }
                </div>
              }
              <span class="time">{{ i18n.date(m.createdAt, { hour: '2-digit', minute: '2-digit' }) }}@if (m.mine && m.read) { · ✓✓ }</span>
            </div>
            }
          }
        </div>
        @if (blocked()) { <div class="blocked fade"><ion-icon name="shield-checkmark"></ion-icon>{{ 'errors.MESSAGE_BLOCKED' | t }}</div> }
      </div>
      <cmp-report-sheet [(open)]="reportOpen" [target]="reportTarget()" [targetId]="reportId()" [userId]="conv()?.other?.id ?? ''" (blocked)="load(true)" />
    </ion-content>
    <ion-footer class="ion-no-border">
      @if (conv()?.blocked) {
        <div class="composer glass off"><ion-icon name="ban-outline"></ion-icon><span>{{ 'block.convBlocked' | t }}</span>
          @if (iBlocked()) { <button class="btn sm light" (click)="unblock()">{{ 'block.unblock' | t }}</button> }</div>
      } @else {
      <form class="composer glass" (ngSubmit)="send()">
        <textarea [(ngModel)]="text" name="text" rows="1" maxlength="2000" [placeholder]="'chat.placeholder' | t" (keydown.enter)="enter($event)" [attr.aria-label]="'chat.placeholder' | t"></textarea>
        <button class="sendbtn" [disabled]="!text.trim() || sending()" [attr.aria-label]="'common.send' | t"><ion-icon name="send"></ion-icon></button>
      </form>
      }
    </ion-footer>
  `,
  styles: [`
    .chat { padding-bottom: 20px; }
    .head { position: sticky; top: calc(env(safe-area-inset-top) + 8px); z-index: 5; display: flex; align-items: center; gap: 10px; padding: 6px; border-radius: 999px; margin-bottom: 12px; }
    .head .icon-btn:first-child { width: 42px; height: 42px; }
    .who { flex: 1; display: flex; align-items: center; gap: 10px; color: inherit; min-width: 0; }
    .who div { display: flex; flex-direction: column; min-width: 0; } .vf { color: var(--accent); vertical-align: -2px; }
    .lst { display: flex; align-items: center; gap: 12px; padding: 8px 12px 8px 8px; color: inherit; }
    .lst img { width: 48px; height: 48px; border-radius: 14px; object-fit: cover; background: var(--image-bg); }
    .lst div { flex: 1; display: flex; flex-direction: column; min-width: 0; } .lst span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .safety { display: flex; gap: 8px; align-items: flex-start; font-size: 13.5px; color: var(--text-2); background: var(--ok-soft); padding: 10px 14px; border-radius: 16px; margin: 12px 0 18px; line-height: 1.45; }
    .safety ion-icon { color: var(--ok); font-size: 18px; flex: 0 0 auto; }
    .msgs { display: flex; flex-direction: column; gap: 10px; }
    .msg { display: flex; flex-direction: column; align-items: flex-start; max-width: 82%; }
    .msg.mine { align-self: flex-end; align-items: flex-end; }
    .msg.fresh { animation: msgIn .45s var(--spring) both; }
    @keyframes msgIn { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: none; } }
    .bubble { padding: 11px 15px; border-radius: 22px 22px 22px 8px; background: var(--surface); box-shadow: var(--shadow-card); border: 1px solid var(--line); line-height: 1.45; font-size: 16px; white-space: pre-wrap; word-break: break-word; }
    .mine .bubble { border-radius: 22px 22px 8px 22px; background: var(--btn-dark); color: var(--btn-dark-text); border: 0; }
    .flag { margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--warn); background: var(--warn-soft); padding: 7px 10px; border-radius: 12px; }
    .flag.danger { color: var(--accent-2); background: var(--accent-2-soft); }
    .flag button { border: 0; background: rgba(0,0,0,.06); color: inherit; font-weight: 700; padding: 4px 8px; border-radius: 8px; cursor: pointer; }
    .time { font-size: 12.5px; color: var(--text-3); margin: 4px 6px 0; }
    .blocked { display: flex; gap: 8px; align-items: center; margin-top: 14px; padding: 12px 14px; border-radius: 16px; background: var(--accent-2-soft); color: var(--accent-2); font-size: 14px; font-weight: 600; }
    ion-footer { background: transparent; }
    .oev { align-self: center; display: flex; align-items: center; gap: 12px; width: min(100%, 420px); padding: 10px 14px 10px 10px; margin: 6px 0;
      border-radius: 20px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-card); color: inherit; }
    .oev.fresh { animation: msgIn .45s var(--spring) both; }
    .oev div { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; } .oev b { font-size: 15px; font-weight: 650; }
    .oi { flex: 0 0 auto; width: 40px; height: 40px; border-radius: 14px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-size: 20px; }
    .oev[data-e="ACCEPTED"] .oi { background: var(--ok-soft); color: var(--ok); }
    .oev[data-e="DECLINED"] .oi, .oev[data-e="AUTO_DECLINED"] .oi, .oev[data-e="WITHDRAWN"] .oi { background: var(--accent-2-soft); color: var(--accent-2); }
    .rmsg { margin-top: 6px; display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 999px; padding: 6px 12px; background: var(--accent-2-soft); color: var(--accent-2); font-weight: 650; font-size: 13.5px; cursor: pointer; }
    .bubble { cursor: default; }
    .oev.ord .oi { background: var(--ok-soft); color: var(--ok); }
    .trans { margin-top: 6px; max-width: 100%; display: flex; gap: 6px; align-items: flex-start; font-size: 15px; line-height: 1.45; padding: 9px 12px; border-radius: 16px; background: var(--accent-soft); color: var(--text); }
    .trans ion-icon { color: var(--accent); flex: 0 0 auto; margin-top: 2px; }
    .tbtn { margin-top: 4px; border: 0; background: none; color: var(--accent); font-weight: 650; font-size: 13.5px; padding: 4px 6px; cursor: pointer; }
    .composer.off { align-items: center; gap: 10px; padding: 8px 8px 8px 16px; color: var(--text-2); font-size: 14.5px; }
    .composer.off span { flex: 1; } .composer.off ion-icon { font-size: 20px; color: var(--accent-2); }
    .composer { display: flex; align-items: flex-end; gap: 8px; margin: 0 auto calc(env(safe-area-inset-bottom) + 12px); width: min(640px, calc(100% - 24px)); padding: 7px 7px 7px 18px; border-radius: 28px; }
    textarea { flex: 1; border: 0; outline: none; resize: none; background: transparent; font-family: inherit; font-size: 16px; color: var(--text); max-height: 120px; padding: 12px 0; }
    .sendbtn { width: 46px; height: 46px; border-radius: 50%; border: 0; background: var(--btn-dark); color: var(--btn-dark-text); display: grid; place-items: center; cursor: pointer; transition: transform .3s var(--spring), opacity .2s; }
    .sendbtn:disabled { opacity: .35; } .sendbtn:active { transform: scale(.88) rotate(-12deg); } .sendbtn ion-icon { font-size: 19px; }
  `],
})
export class ChatPage implements ViewWillEnter, ViewDidLeave {
  api = inject(Api);
  i18n = inject(I18n);
  private ui = inject(Ui);
  private nav = inject(NavController);
  private badges = inject(Badges);
  @ViewChild('content') content!: IonContent;
  id = input.required<string>();
  draft = input<string>();
  conv = signal<ConversationSummary | null>(null);
  messages = signal<ChatMessage[]>([]);
  sending = signal(false);
  blocked = signal(false);
  sel = signal<string | null>(null);
  iBlocked = signal(false);
  reportOpen = signal(false);
  reportTarget = signal<ReportTarget>('USER');
  reportId = signal('');
  text = '';
  freshFrom = 0;
  private offerCache = new Map<string, OfferEvent | null>();
  private orderCache = new Map<string, OrderEvent | null>();
  private purchases = inject(Purchases);
  aiOn = () => this.purchases.config()?.veloAi === 'AI';
  translated = signal<Record<string, string>>({});
  translating = signal<string | null>(null);
  private poll: any;

  async ionViewWillEnter() {
    if (this.draft() && !this.text) this.text = this.draft()!;
    await this.load(true);
    this.poll = setInterval(() => this.load(false), 4000);
  }
  ionViewDidLeave() { clearInterval(this.poll); }

  async load(first: boolean) {
    try {
      const t = await this.api.thread(this.id());
      this.conv.set(t.conversation);
      if (first && t.conversation.blocked) this.api.blocks().then((b) => this.iBlocked.set(b.some((u) => u.id === t.conversation.other.id))).catch(() => {});
      const before = this.messages().length;
      if (first) this.freshFrom = t.messages.length;
      if (t.messages.length !== before || first) {
        this.messages.set(t.messages);
        setTimeout(() => this.content?.scrollToBottom(first ? 0 : 300), 30);
      }
      if (first) this.badges.refresh();
    } catch (e) { if (first) { this.ui.error(e); this.nav.navigateRoot('/chats'); } }
  }

  enter(ev: Event) {
    const k = ev as KeyboardEvent;
    if (!k.shiftKey && window.innerWidth > 768) { k.preventDefault(); this.send(); }
  }

  async send() {
    const body = this.text.trim();
    if (!body) return;
    this.sending.set(true);
    this.blocked.set(false);
    try {
      const r = await this.api.sendMessage(this.id(), body);
      this.text = '';
      this.messages.update((m) => [...m, r.message]);
      this.ui.tap();
      setTimeout(() => this.content?.scrollToBottom(300), 30);
    } catch (e) {
      if (errorCode(e) === 'MESSAGE_BLOCKED') this.blocked.set(true); else this.ui.error(e);
    }
    this.sending.set(false);
  }

  offerOf(m: ChatMessage) {
    if (!this.offerCache.has(m.id)) this.offerCache.set(m.id, parseOfferEvent(m.body));
    return this.offerCache.get(m.id)!;
  }
  evText(e: OfferEvent, mine: boolean) { return offerEventText(this.i18n, e, mine); }
  orderOf(m: ChatMessage) {
    if (!this.orderCache.has(m.id)) this.orderCache.set(m.id, parseOrderEvent(m.body));
    return this.orderCache.get(m.id)!;
  }
  orderText(e: OrderEvent) { return orderEventText(this.i18n, e); }
  orderIcon(ev: string) {
    return ({ PAID: 'shield-checkmark', SHIPPED: 'cube-outline', HANDED_OVER: 'hand-right-outline', COMPLETED: 'checkmark-done', DISPUTED: 'alert-circle', REFUNDED: 'arrow-undo' } as Record<string, string>)[ev] ?? 'shield-checkmark';
  }

  async translate(id: string) {
    this.translating.set(id);
    try { const r = await this.api.translate(id, this.i18n.lang()); this.translated.update((t) => ({ ...t, [id]: r.text })); }
    catch (e) { this.ui.error(e); }
    this.translating.set(null);
  }
  evIcon(ev: string, kind: string) {
    return ({ ACCEPTED: 'checkmark-circle', DECLINED: 'close-circle', AUTO_DECLINED: 'close-circle', WITHDRAWN: 'arrow-undo', COUNTER: 'swap-vertical' } as Record<string, string>)[ev]
      ?? (kind === 'SWAP' ? 'swap-horizontal' : 'pricetag');
  }

  async menu() {
    const c = this.conv();
    if (!c) return;
    const opts = [
      { text: this.i18n.t('chat.viewListing'), icon: 'pricetag-outline' },
      { text: this.i18n.t('nav.offers'), icon: 'swap-vertical-outline' },
      { text: this.i18n.t('report.reportUser'), icon: 'flag-outline', danger: true },
      { text: this.i18n.t(c.blocked ? 'block.unblock' : 'block.block'), icon: 'ban-outline', danger: !c.blocked },
    ];
    if (c.blocked && !this.iBlocked()) opts.pop();
    const i = await this.ui.sheet(c.other.displayName, opts);
    if (i === 0) this.nav.navigateForward(['/listing', c.listing.id]);
    if (i === 1) this.nav.navigateForward(['/offers']);
    if (i === 2) this.openReport('USER', c.other.id);
    if (i === 3) c.blocked ? this.unblock() : this.block();
  }

  private openReport(t: ReportTarget, id: string) { this.reportTarget.set(t); this.reportId.set(id); this.reportOpen.set(true); }
  reportMessage(id: string) { this.sel.set(null); this.openReport('MESSAGE', id); }
  report() { const c = this.conv(); if (c) this.openReport('USER', c.other.id); }

  async block() {
    const c = this.conv();
    if (!c || !(await this.ui.confirm(this.i18n.t('block.confirm', { name: c.other.displayName }), this.i18n.t('block.block')))) return;
    try { await this.api.block(c.other.id); this.ui.toast(this.i18n.t('block.done')); await this.load(true); } catch (e) { this.ui.error(e); }
  }

  async unblock() {
    const c = this.conv();
    if (!c) return;
    try { await this.api.unblock(c.other.id); this.ui.toast(this.i18n.t('block.undone')); await this.load(true); } catch (e) { this.ui.error(e); }
  }
}

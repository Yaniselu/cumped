import { MOTION } from '../shared/motion.directives';
import { Component, inject, signal } from '@angular/core';
import { IonContent, IonIcon, NavController, ViewWillEnter } from '@ionic/angular';
import { Api } from '../core/api.service';
import { Badges } from '../core/badges.service';
import { I18n, TPipe } from '../core/i18n.service';
import { AppNotification } from '../core/models';
import { BackButtonComponent } from '../shared/back-button.component';
import { EmptyComponent } from '../shared/empty.component';
import { SkeletonLinesComponent } from '../shared/skeleton.component';

const ICONS: Record<string, string> = { SECURITY_NEW_LOGIN: 'lock-closed-outline', SECURITY_PASSWORD_CHANGED: 'key-outline',
  PRICE_DROP: 'trending-down', OFFER_RECEIVED: 'pricetag-outline', SWAP_RECEIVED: 'swap-horizontal', OFFER_ACCEPTED: 'checkmark-circle',
  OFFER_DECLINED: 'close-outline', NEW_CONVERSATION: 'chatbubble-outline', SAVED_SEARCH_MATCH: 'search', NEW_REVIEW: 'star',
  TICKET_OPENED: 'ticket-outline', LISTING_UNDER_REVIEW: 'shield-checkmark-outline', LISTING_RESTORED: 'checkmark-circle', PURCHASE_CONFIRMED: 'bag-check-outline',
  ORDER_PAID: 'cash-outline', ORDER_SHIPPED: 'cube-outline', ORDER_HANDED_OVER: 'hand-right-outline', ORDER_COMPLETED: 'checkmark-done',
  ORDER_AUTO_COMPLETED: 'checkmark-done', ORDER_RELEASED: 'checkmark-done', ORDER_DISPUTED: 'alert-circle-outline', ORDER_REFUNDED: 'arrow-undo-outline',
  PRICE_TARGET_REACHED: 'notifications', OFFER_COUNTERED: 'swap-vertical', OFFER_AUTO_DECLINED: 'close-circle-outline', LISTING_REMOVED: 'alert-circle-outline', OFFER_EXPIRED: 'time-outline',
};

@Component({
  selector: 'page-notifications',
  imports: [MOTION, IonContent, IonIcon, TPipe, BackButtonComponent, EmptyComponent, SkeletonLinesComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <div class="page narrow">
        <div class="topbar"><cmp-back /><div class="title">{{ 'notifications.title' | t }}</div>
          <button class="icon-btn" (click)="readAll()" [attr.aria-label]="'notifications.markRead' | t"><ion-icon name="checkmark"></ion-icon></button></div>
        @if (loading()) { <cmp-skeleton-lines [count]="5" /> }
        @else if (!items().length) { <cmp-empty icon="notifications-outline" [title]="'notifications.empty' | t" /> }
        @for (n of items(); track n.id; let i = $index) {
          <button class="note card press reveal" [style.--i]="i" [class.unread]="!n.read" (click)="open(n)">
            <span class="ic" [attr.data-t]="n.type"><ion-icon [name]="icon(n.type)"></ion-icon></span>
            <span class="txt">{{ text(n) }}<span class="faint small">{{ i18n.ago(n.createdAt) }}</span></span>
            @if (!n.read) { <span class="dot"></span> }
          </button>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .note { display: flex; align-items: center; gap: 14px; width: 100%; padding: 14px; margin-bottom: 10px; text-align: left; color: var(--text); cursor: pointer; font-size: 15.5px; }
    .note.unread { border-color: var(--accent-soft); }
    .ic { width: 46px; height: 46px; border-radius: 16px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-size: 21px; flex: 0 0 auto; }
    .ic[data-t="PRICE_DROP"] { background: var(--accent-2-soft); color: var(--accent-2); }
    .ic[data-t="OFFER_ACCEPTED"], .ic[data-t="LISTING_RESTORED"] { background: var(--ok-soft); color: var(--ok); }
    .txt { flex: 1; display: flex; flex-direction: column; gap: 3px; line-height: 1.35; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); flex: 0 0 auto; }
  `],
})
export class NotificationsPage implements ViewWillEnter {
  private api = inject(Api);
  i18n = inject(I18n);
  private nav = inject(NavController);
  private badges = inject(Badges);
  items = signal<AppNotification[]>([]);
  loading = signal(true);

  async ionViewWillEnter() { try { this.items.set(await this.api.notifications()); } catch { /* ignore */ } this.loading.set(false); }
  icon(t: string) { return ICONS[t] ?? 'notifications-outline'; }

  text(n: AppNotification) {
    const p: Record<string, any> = { ...n.params };
    if (p['new'] != null && p['currency']) p['new'] = this.i18n.price(p['new'], p['currency']);
    if (p['amount'] != null && p['currency']) p['amount'] = this.i18n.price(p['amount'], p['currency']);
    if (p['carrier']) p['carrier'] = this.i18n.t('orders.carriers.' + p['carrier']);
    if (p['reason'] && this.i18n.has('report.reason.' + p['reason'])) p['reason'] = this.i18n.t('report.reason.' + p['reason']);
    return this.i18n.t('notifications.' + n.type, p);
  }

  async readAll() {
    await this.api.readAllNotifications().catch(() => {});
    this.items.update((l) => l.map((n) => ({ ...n, read: true })));
    this.badges.refresh();
  }

  open(n: AppNotification) { if (n.link && n.link.startsWith('/')) this.nav.navigateForward(n.link); }
}

import { MOTION } from '../shared/motion.directives';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent, ViewWillEnter } from '@ionic/angular';
import { Api } from '../core/api.service';
import { I18n, TPipe } from '../core/i18n.service';
import { offerEventShort, orderEventText, parseOfferEvent, parseOrderEvent } from '../core/offer-event';
import { ConversationSummary } from '../core/models';
import { AvatarComponent } from '../shared/avatar.component';
import { EmptyComponent } from '../shared/empty.component';
import { SkeletonLinesComponent } from '../shared/skeleton.component';

@Component({
  selector: 'page-chats',
  imports: [MOTION, IonContent, IonIcon, IonRefresher, IonRefresherContent, RouterLink, TPipe, AvatarComponent, EmptyComponent, SkeletonLinesComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="load($event)"><ion-refresher-content></ion-refresher-content></ion-refresher>
      <div class="page narrow">
        <div class="topbar"><h1>{{ 'chat.title' | t }}</h1><a class="icon-btn" routerLink="/offers"><ion-icon name="pricetag-outline"></ion-icon></a></div>
        @if (loading()) { <cmp-skeleton-lines [count]="5" /> }
        @else if (!items().length) { <cmp-empty icon="chatbubbles" [title]="'chat.empty' | t" [sub]="'chat.emptySub' | t" /> }
        @else {
          @for (c of items(); track c.id; let i = $index) {
            <a class="conv card press reveal" [style.--i]="i" [routerLink]="['/chat', c.id]">
              <div class="thumb"><img [src]="api.url(c.listing.imageUrl)" alt="" />
                <span class="av"><cmp-avatar [name]="c.other.displayName" [hue]="c.other.avatarHue" [size]="28" [verified]="c.other.idVerified" /></span></div>
              <div class="mid">
                <div class="row between"><strong>{{ c.other.displayName }}</strong><span class="faint small">{{ c.lastAt ? i18n.ago(c.lastAt) : '' }}</span></div>
                <span class="lt small muted">{{ c.listing.title }} · {{ i18n.price(c.listing.priceCents, c.listing.currency) }}</span>
                <div class="row between"><span class="last" [class.unread]="c.unread">{{ preview(c) }}</span>
                  @if (c.unread) { <span class="count">{{ c.unread }}</span> }</div>
              </div>
            </a>
          }
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .topbar h1 { font-size: 32px; }
    .conv { display: flex; gap: 14px; padding: 12px; margin-bottom: 10px; color: inherit; align-items: center; }
    .thumb { position: relative; width: 64px; height: 64px; flex: 0 0 auto; }
    .thumb img { width: 64px; height: 64px; border-radius: 18px; object-fit: cover; background: var(--image-bg); }
    .av { position: absolute; right: -6px; bottom: -6px; border-radius: 50%; border: 3px solid var(--surface); display: flex; }
    .mid { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .lt, .last { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .last { font-size: 15px; color: var(--text-2); flex: 1; } .last.unread { color: var(--text); font-weight: 650; }
    .count { min-width: 22px; height: 22px; padding: 0 6px; border-radius: 99px; background: var(--accent); color: #fff; font-size: 13px; font-weight: 700; display: grid; place-items: center; }
  `],
})
export class ChatsPage implements ViewWillEnter {
  api = inject(Api);
  i18n = inject(I18n);
  items = signal<ConversationSummary[]>([]);
  loading = signal(true);
  ionViewWillEnter() { this.load(); }
  preview(c: ConversationSummary) {
    if (c.blocked) return this.i18n.t('block.convBlocked');
    const e = parseOfferEvent(c.lastMessage);
    if (e) return '🏷️ ' + offerEventShort(this.i18n, e);
    const o = parseOrderEvent(c.lastMessage);
    return o ? '🛡️ ' + orderEventText(this.i18n, o) : c.lastMessage ?? '…';
  }
  async load(ev?: any) {
    try { this.items.set(await this.api.conversations()); } catch { /* ignore */ }
    this.loading.set(false);
    ev?.target.complete();
  }
}

import { Component, inject, input, signal } from '@angular/core';
import { IonContent, IonIcon, ViewWillEnter } from '@ionic/angular';
import { Api } from '../core/api.service';
import { I18n, TPipe } from '../core/i18n.service';
import { Card, PublicUser, Review } from '../core/models';
import { Ui } from '../core/ui.service';
import { AvatarComponent } from '../shared/avatar.component';
import { BackButtonComponent } from '../shared/back-button.component';
import { ListingCardComponent } from '../shared/listing-card.component';
import { SkeletonGridComponent } from '../shared/skeleton.component';

@Component({
  selector: 'page-user',
  imports: [IonContent, IonIcon, TPipe, AvatarComponent, BackButtonComponent, ListingCardComponent, SkeletonGridComponent],
  template: `
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="topbar app-only"><cmp-back /><div class="title"></div><div class="spacer"></div></div>
        @if (u(); as u) {
          <div class="hero card reveal">
            <cmp-avatar [name]="u.displayName" [hue]="u.avatarHue" [size]="80" [verified]="u.idVerified" />
            <div class="info">
              <h2>{{ u.displayName }}</h2>
              <span class="muted small">&#64;{{ u.username }} · {{ u.city }} · {{ 'listing.memberSince' | t: { date: i18n.date(u.memberSince) } }}</span>
              <div class="badges">
                @if (u.idVerified) { <span class="badge ok"><ion-icon name="shield-checkmark"></ion-icon>{{ 'profile.verified' | t }}</span> } @else { <span class="badge warn">{{ 'profile.notVerified' | t }}</span> }
                <span class="badge accent">{{ 'listing.trust' | t }} {{ u.trustScore }}</span>
                @if (u.ratingCount) { <span class="badge" style="background:var(--warn-soft);color:var(--warn)">★ {{ u.rating }} ({{ u.ratingCount }})</span> }
              </div>
              @if (u.bio) { <p class="bio">{{ u.bio }}</p> }
              @if (u.realNameAvailable) {
                @if (real()) { <div class="realname fade"><ion-icon name="key-outline"></ion-icon>{{ real() }}</div> }
                @else { <button class="btn sm light" (click)="reveal()"><ion-icon name="eye-outline"></ion-icon>{{ 'listing.showRealName' | t }}</button> }
              }
            </div>
          </div>
          <div class="section-head"><h2>{{ 'profile.listings' | t }}</h2></div>
          <div class="grid">@for (c of listings(); track c.id; let i = $index) { <cmp-listing-card class="reveal" [style.--i]="i" [item]="c" /> }</div>
          @if (reviews().length) {
            <div class="section-head"><h2>{{ 'profile.reviews' | t }}</h2></div>
            @for (r of reviews(); track r.id) {
              <div class="rev card pad reveal"><div class="row between"><strong>{{ r.reviewerName }}@if (r.reviewerVerified) { <ion-icon name="shield-checkmark" class="vf"></ion-icon> }</strong>
                <span class="stars">{{ '★'.repeat(r.rating) }}{{ '☆'.repeat(5 - r.rating) }}</span></div>
                @if (r.comment) { <p>{{ r.comment }}</p> }<span class="faint small">{{ r.listingTitle }} · {{ i18n.ago(r.createdAt) }}</span></div>
            }
          }
        } @else { <cmp-skeleton-grid [count]="4" /> }
      </div>
    </ion-content>
  `,
  styles: [`
    .hero { display: flex; gap: 18px; padding: 20px; align-items: flex-start; }
    .info { flex: 1; display: flex; flex-direction: column; gap: 6px; } .badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; }
    .bio { color: var(--text-2); font-size: 14.5px; line-height: 1.5; }
    .realname { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 14px; background: var(--accent-soft); color: var(--accent); font-weight: 650; }
    .rev { margin-bottom: 10px; } .rev p { margin: 8px 0 6px; line-height: 1.5; } .stars { color: var(--warn); letter-spacing: 1px; } .vf { color: var(--accent); margin-left: 4px; vertical-align: -2px; }
  `],
})
export class UserPage implements ViewWillEnter {
  private api = inject(Api);
  i18n = inject(I18n);
  private ui = inject(Ui);
  id = input.required<string>();
  u = signal<PublicUser | null>(null);
  listings = signal<Card[]>([]);
  reviews = signal<Review[]>([]);
  real = signal('');

  async ionViewWillEnter() {
    try {
      const [u, l, r] = await Promise.all([this.api.user(this.id()), this.api.userListings(this.id()), this.api.userReviews(this.id())]);
      this.u.set(u); this.listings.set(l); this.reviews.set(r);
    } catch (e) { this.ui.error(e); }
  }
  async reveal() { try { this.real.set((await this.api.realName(this.id())).fullName); } catch (e) { this.ui.error(e); } }
}

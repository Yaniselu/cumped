import { MOTION } from '../shared/motion.directives';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, ViewWillEnter } from '@ionic/angular';
import { Api } from '../core/api.service';
import { TPipe } from '../core/i18n.service';
import { Card } from '../core/models';
import { BackButtonComponent } from '../shared/back-button.component';
import { EmptyComponent } from '../shared/empty.component';
import { ListingCardComponent } from '../shared/listing-card.component';
import { SkeletonGridComponent } from '../shared/skeleton.component';

@Component({
  selector: 'page-my-listings',
  imports: [MOTION, IonContent, IonIcon, RouterLink, TPipe, BackButtonComponent, EmptyComponent, ListingCardComponent, SkeletonGridComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <div class="page">
        <div class="topbar"><cmp-back fallback="/profile" /><div class="title">{{ 'profile.myListings' | t }}</div><a class="icon-btn" routerLink="/sell"><ion-icon name="add"></ion-icon></a></div>
        @if (loading()) { <cmp-skeleton-grid [count]="4" /> }
        @else if (!items().length) { <cmp-empty icon="pricetag-outline" [title]="'home.sellTitle' | t" [sub]="'home.sellSub' | t"><a class="btn sm" routerLink="/sell">{{ 'home.sellCta' | t }}</a></cmp-empty> }
        @else { <div class="grid">@for (c of items(); track c.id; let i = $index) { <cmp-listing-card class="rv" [style.--i]="i" [item]="c" /> }</div> }
      </div>
    </ion-content>
  `,
})
export class MyListingsPage implements ViewWillEnter {
  private api = inject(Api);
  items = signal<Card[]>([]);
  loading = signal(true);
  async ionViewWillEnter() { try { this.items.set(await this.api.myListings()); } catch { /* ignore */ } this.loading.set(false); }
}

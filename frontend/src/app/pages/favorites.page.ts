import { Component, inject, signal } from '@angular/core';
import { IonContent, ViewWillEnter } from '@ionic/angular';
import { Api } from '../core/api.service';
import { TPipe } from '../core/i18n.service';
import { Card } from '../core/models';
import { BackButtonComponent } from '../shared/back-button.component';
import { EmptyComponent } from '../shared/empty.component';
import { ListingCardComponent } from '../shared/listing-card.component';
import { SkeletonGridComponent } from '../shared/skeleton.component';

@Component({
  selector: 'page-favorites',
  imports: [IonContent, TPipe, BackButtonComponent, EmptyComponent, ListingCardComponent, SkeletonGridComponent],
  template: `
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="topbar app-only"><cmp-back fallback="/profile" /><div class="title">{{ 'nav.favorites' | t }}</div><div class="spacer"></div></div>
        @if (loading()) { <cmp-skeleton-grid [count]="4" /> }
        @else if (!items().length) { <cmp-empty icon="heart-outline" [title]="'nav.favorites' | t" [sub]="'search.noResultsSub' | t" /> }
        @else { <div class="grid">@for (c of items(); track c.id; let i = $index) { <cmp-listing-card class="reveal" [style.--i]="i" [item]="c" (changed)="!$event && remove(c.id)" /> }</div> }
      </div>
    </ion-content>
  `,
})
export class FavoritesPage implements ViewWillEnter {
  private api = inject(Api);
  items = signal<Card[]>([]);
  loading = signal(true);
  async ionViewWillEnter() { try { this.items.set(await this.api.favorites()); } catch { /* ignore */ } this.loading.set(false); }
  remove(id: string) { this.items.update((l) => l.filter((c) => c.id !== id)); }
}

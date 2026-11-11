import { MOTION } from '../shared/motion.directives';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, ViewWillEnter } from '@ionic/angular';
import { Api } from '../core/api.service';
import { I18n, TPipe } from '../core/i18n.service';
import { Stats } from '../core/models';
import { BackButtonComponent } from '../shared/back-button.component';

@Component({
  selector: 'page-stats',
  imports: [MOTION, IonContent, IonIcon, RouterLink, TPipe, BackButtonComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <div class="page narrow">
        <div class="topbar"><cmp-back fallback="/profile" /><div class="title">{{ 'stats.title' | t }}</div><div class="spacer"></div></div>
        @if (s(); as s) {
          <div class="kpis">
            @for (k of kpis(); track k.label; let i = $index) {
              <div class="kpi card rv tilt" [style.--i]="i"><span class="glare"></span><ion-icon [name]="k.icon"></ion-icon><strong [cmpCount]="k.value"></strong><span>{{ k.label | t }}</span></div>
            }
          </div>
          <div class="section-head"><h2>{{ 'stats.last14' | t }}</h2></div>
          <div class="card pad chart reveal">
            <div class="bars">
              @for (d of s.viewsByDay; track d.day; let i = $index) {
                <div class="col"><div class="b" [style.height.%]="max() ? (d.views / max()) * 100 : 0" [style.--i]="i" [attr.data-v]="d.views"></div>
                  <span>{{ i18n.date(d.day, { day: 'numeric' }) }}</span></div>
              }
            </div>
          </div>
          <div class="section-head"><h2>{{ 'stats.perListing' | t }}</h2></div>
          @for (l of s.listings; track l.id; let i = $index) {
            <a class="lrow card press reveal" [style.--i]="i" [routerLink]="['/listing', l.id]">
              <div class="lt"><strong>{{ l.title }}</strong><span class="badge accent">{{ 'listing.status.' + l.status | t }}</span></div>
              <div class="nums"><span><ion-icon name="eye-outline"></ion-icon>{{ l.views }}</span><span><ion-icon name="heart-outline"></ion-icon>{{ l.favorites }}</span>
                <span><ion-icon name="chatbubble-outline"></ion-icon>{{ l.messages }}</span><span><ion-icon name="pricetag-outline"></ion-icon>{{ l.offers }}</span></div>
            </a>
          }
        } @else { <div class="kpis">@for (i of [0,1,2,3]; track i) { <div class="skeleton" style="height:110px;border-radius:24px"></div> }</div> }
      </div>
    </ion-content>
  `,
  styles: [`
    .kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    @media (min-width: 720px) { .kpis { grid-template-columns: repeat(4, 1fr); } }
    .kpi { padding: 16px; display: flex; flex-direction: column; gap: 4px; }
    .kpi ion-icon { font-size: 22px; color: var(--accent); margin-bottom: 6px; }
    .kpi strong { font-family: var(--font-display); font-size: 30px; letter-spacing: -0.03em; } .kpi span { font-size: 13.5px; color: var(--text-2); }
    .bars { display: flex; align-items: flex-end; gap: 6px; height: 170px; }
    .col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; }
    .col span { font-size: 12px; color: var(--text-3); }
    .b { width: 100%; min-height: 4px; border-radius: 10px 10px 4px 4px; background: linear-gradient(180deg, var(--accent), #9f8bff);
      transform-origin: bottom; animation: grow .9s var(--spring) both; animation-delay: calc(var(--i) * 40ms); }
    @keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
    .lrow { display: block; padding: 14px 16px; margin-bottom: 10px; color: inherit; }
    .lt { display: flex; justify-content: space-between; align-items: center; gap: 10px; } .lt strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .nums { display: flex; gap: 16px; margin-top: 10px; color: var(--text-2); font-size: 14.5px; } .nums span { display: inline-flex; align-items: center; gap: 5px; }
  `],
})
export class StatsPage implements ViewWillEnter {
  private api = inject(Api);
  i18n = inject(I18n);
  s = signal<Stats | null>(null);
  max = computed(() => Math.max(0, ...(this.s()?.viewsByDay.map((d) => d.views) ?? [0])));
  kpis = computed(() => {
    const s = this.s();
    if (!s) return [];
    return [
      { icon: 'eye-outline', value: s.totalViews, label: 'stats.views' }, { icon: 'heart-outline', value: s.totalFavorites, label: 'stats.favorites' },
      { icon: 'chatbubble-outline', value: s.totalMessages, label: 'stats.messages' }, { icon: 'pricetag-outline', value: s.totalOffers, label: 'stats.offers' },
    ];
  });
  async ionViewWillEnter() { try { this.s.set(await this.api.stats()); } catch { /* ignore */ } }
}

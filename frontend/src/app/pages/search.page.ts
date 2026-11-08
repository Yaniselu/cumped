import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonModal } from '@ionic/angular';
import { Api, SearchQuery } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, TPipe } from '../core/i18n.service';
import { CATEGORIES, CONDITIONS, COUNTRIES, Card } from '../core/models';
import { Ui } from '../core/ui.service';
import { BackButtonComponent } from '../shared/back-button.component';
import { EmptyComponent } from '../shared/empty.component';
import { ListingCardComponent } from '../shared/listing-card.component';
import { SkeletonGridComponent } from '../shared/skeleton.component';

interface Filters { category: string; min: number | null; max: number | null; conditions: string[]; country: string; city: string; swap: boolean; verified: boolean; shipsTo: string; }
const EMPTY: Filters = { category: '', min: null, max: null, conditions: [], country: '', city: '', swap: false, verified: false, shipsTo: '' };

@Component({
  selector: 'page-search',
  imports: [IonContent, IonIcon, IonModal, IonInfiniteScroll, IonInfiniteScrollContent, FormsModule, TPipe,
    ListingCardComponent, SkeletonGridComponent, EmptyComponent, BackButtonComponent],
  template: `
    <ion-content [fullscreen]="true">
      <div class="page">
        <div class="topbar app-only"><cmp-back /><div class="title">{{ 'search.title' | t }}</div><div class="spacer"></div></div>

        <div class="searchbar reveal">
          <ion-icon name="search"></ion-icon>
          <input [(ngModel)]="q" (ngModelChange)="typed()" [placeholder]="'search.placeholder' | t" (keyup.enter)="run()" enterkeyhint="search" />
          @if (q) { <button class="icon-btn sm clear" (click)="q = ''; run()"><ion-icon name="close"></ion-icon></button> }
          <button class="icon-btn" (click)="filtersOpen.set(true)"><ion-icon name="options-outline"></ion-icon>@if (activeFilters()) { <span class="dot"></span> }</button>
        </div>

        <div class="hscroll sorts reveal" style="--i:1">
          @for (s of sorts; track s) { <button class="chip" [class.active]="sort() === s" (click)="setSort(s)">{{ 'search.' + s | t }}</button> }
          @if (f().category) { <button class="chip active" (click)="clearCategory()">{{ 'categories.' + f().category | t }} <ion-icon name="close"></ion-icon></button> }
          @if (f().verified) { <button class="chip active" (click)="toggle('verified')"><ion-icon name="shield-checkmark"></ion-icon>{{ 'common.verified' | t }}</button> }
          @if (f().swap) { <button class="chip active" (click)="toggle('swap')"><ion-icon name="swap-horizontal"></ion-icon>{{ 'listing.acceptsSwap' | t }}</button> }
        </div>

        @if (loading()) { <cmp-skeleton-grid [count]="6" /> }
        @else if (!items().length) {
          <cmp-empty icon="search" [title]="'search.noResults' | t" [sub]="'search.noResultsSub' | t">
            @if (auth.loggedIn()) { <button class="btn sm" (click)="save()"><ion-icon name="notifications-outline"></ion-icon>{{ 'search.saveSearch' | t }}</button> }
          </cmp-empty>
        } @else {
          <div class="row between meta"><span class="muted small">{{ 'search.resultsMore' | t }}</span>
            @if (auth.loggedIn()) { <button class="linkbtn" (click)="save()"><ion-icon name="notifications-outline"></ion-icon>{{ 'search.saveSearch' | t }}</button> }</div>
          <div class="grid">@for (c of items(); track c.id; let i = $index) { <cmp-listing-card class="reveal" [style.--i]="i % 8" [item]="c" /> }</div>
        }
        <ion-infinite-scroll (ionInfinite)="more($event)" [disabled]="!hasMore()"><ion-infinite-scroll-content></ion-infinite-scroll-content></ion-infinite-scroll>
      </div>

      <ion-modal [isOpen]="filtersOpen()" (didDismiss)="filtersOpen.set(false)" [initialBreakpoint]="0.92" [breakpoints]="[0, 0.92]" handleBehavior="cycle">
        <ng-template>
          <ion-content>
            <div class="sheet">
              <div class="row between"><h2>{{ 'common.filters' | t }}</h2><button class="btn ghost sm" (click)="resetFilters()">{{ 'common.reset' | t }}</button></div>
              <div class="field"><label>{{ 'search.category' | t }}</label>
                <select class="input" [(ngModel)]="draft.category"><option value="">{{ 'search.anyCategory' | t }}</option>
                  @for (c of categories; track c) { <option [value]="c">{{ 'categories.' + c | t }}</option> }</select></div>
              <div class="field"><label>{{ 'search.price' | t }}</label>
                <div class="two"><input class="input" type="number" inputmode="decimal" [(ngModel)]="draft.min" [placeholder]="'search.min' | t" />
                  <input class="input" type="number" inputmode="decimal" [(ngModel)]="draft.max" [placeholder]="'search.max' | t" /></div></div>
              <div class="field"><label>{{ 'search.condition' | t }}</label>
                <div class="chips">@for (c of conditions; track c) { <button class="chip" [class.active]="draft.conditions.includes(c)" (click)="toggleCond(c)">{{ 'conditions.' + c | t }}</button> }</div></div>
              <div class="two">
                <div class="field"><label>{{ 'search.country' | t }}</label><select class="input" [(ngModel)]="draft.country"><option value="">—</option>@for (c of countries; track c) { <option [value]="c">{{ flag(c) }} {{ c }}</option> }</select></div>
                <div class="field"><label>{{ 'search.city' | t }}</label><input class="input" [(ngModel)]="draft.city" /></div>
              </div>
              <div class="field"><label>{{ 'search.shipsTo' | t }}</label><select class="input" [(ngModel)]="draft.shipsTo"><option value="">—</option>@for (c of countries; track c) { <option [value]="c">{{ flag(c) }} {{ c }}</option> }</select></div>
              <div class="card toggles">
                <div class="toggle-row"><span><ion-icon name="shield-checkmark"></ion-icon> {{ 'search.verifiedOnly' | t }}</span><button class="switch" [class.on]="draft.verified" (click)="draft.verified = !draft.verified"></button></div>
                <div class="toggle-row"><span><ion-icon name="swap-horizontal"></ion-icon> {{ 'search.swapOnly' | t }}</span><button class="switch" [class.on]="draft.swap" (click)="draft.swap = !draft.swap"></button></div>
              </div>
              <button class="btn block" (click)="applyFilters()">{{ 'common.apply' | t }}</button>
            </div>
          </ion-content>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: [`
    .searchbar { margin-top: 4px; } .clear { background: transparent !important; }
    .sorts { margin-top: 12px; }
    .meta { margin: 8px 2px 12px; }
    .linkbtn { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: var(--accent); font-weight: 600; font-size: 13.5px; cursor: pointer; }
    .sheet { padding: 22px 20px 40px; display: flex; flex-direction: column; gap: 16px; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .toggles { padding: 4px 14px; } .toggles span { display: flex; align-items: center; gap: 8px; font-weight: 550; }
    .toggles span ion-icon { color: var(--accent); }
  `],
})
export class SearchPage implements OnInit {
  private api = inject(Api);
  auth = inject(AuthService);
  i18n = inject(I18n);
  private ui = inject(Ui);
  category = input<string>();
  qParam = input<string>(undefined, { alias: 'q' });

  categories = CATEGORIES;
  conditions = CONDITIONS;
  countries = COUNTRIES;
  sorts = ['newest', 'price_asc', 'price_desc', 'relevance'];
  q = '';
  sort = signal('newest');
  f = signal<Filters>({ ...EMPTY });
  draft: Filters = { ...EMPTY };
  items = signal<Card[]>([]);
  loading = signal(true);
  hasMore = signal(false);
  filtersOpen = signal(false);
  private page = 0;
  private debounce: any;
  private seq = 0;

  ngOnInit() {
    this.q = this.qParam() ?? '';
    if (this.category()) this.f.set({ ...EMPTY, category: this.category()! });
    this.run();
  }

  activeFilters() { const f = this.f(); return !!(f.min || f.max || f.conditions.length || f.country || f.city || f.shipsTo); }
  flag(c: string) { return String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0))); }

  typed() { clearTimeout(this.debounce); this.debounce = setTimeout(() => this.run(), 350); }
  setSort(s: string) { this.sort.set(s); this.run(); }
  clearCategory() { this.f.update((f) => ({ ...f, category: '' })); this.run(); }
  toggle(k: 'swap' | 'verified') { this.f.update((f) => ({ ...f, [k]: !f[k] })); this.run(); }
  toggleCond(c: string) { const i = this.draft.conditions.indexOf(c); i >= 0 ? this.draft.conditions.splice(i, 1) : this.draft.conditions.push(c); }

  ionViewWillEnter() { this.draft = structuredClone(this.f()); }
  resetFilters() { this.draft = { ...EMPTY, conditions: [] }; }
  applyFilters() { this.f.set(structuredClone(this.draft)); this.filtersOpen.set(false); this.run(); }

  private query(page: number): SearchQuery {
    const f = this.f();
    return {
      q: this.q.trim() || undefined, category: f.category || undefined, sort: this.sort(), page, size: 20,
      minPrice: f.min != null && f.min !== ('' as any) ? Math.round(f.min * 100) : undefined,
      maxPrice: f.max != null && f.max !== ('' as any) ? Math.round(f.max * 100) : undefined,
      condition: f.conditions.length ? f.conditions : undefined, country: f.country || undefined, city: f.city || undefined,
      swap: f.swap || undefined, verified: f.verified || undefined, shipsTo: f.shipsTo || undefined,
    };
  }

  async run() {
    const my = ++this.seq;
    this.loading.set(true);
    this.page = 0;
    this.draft = structuredClone(this.f());
    try {
      const r = await this.api.search(this.query(0));
      if (my !== this.seq) return;
      this.items.set(r.items);
      this.hasMore.set(r.hasMore);
    } catch (e) { this.ui.error(e); }
    if (my === this.seq) this.loading.set(false);
  }

  async more(ev: any) {
    try {
      const r = await this.api.search(this.query(++this.page));
      this.items.update((l) => [...l, ...r.items]);
      this.hasMore.set(r.hasMore);
    } finally { ev.target.complete(); }
  }

  async save() {
    const f = this.f();
    try {
      await this.api.saveSearch({ query: this.q.trim() || undefined, category: f.category || undefined,
        maxPriceCents: f.max ? Math.round(f.max * 100) : undefined, country: f.country || undefined });
      this.ui.toast(this.i18n.t('search.saved'));
    } catch (e) { this.ui.error(e); }
  }
}

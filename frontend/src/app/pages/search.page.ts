import { MOTION } from '../shared/motion.directives';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
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
import { RangeInputComponent } from '../shared/price-input.component';
import { FX_APPROX, PRICE_RANGE_EUR, niceCeil } from '../core/listing-schema';

interface Filters { category: string; min: number | null; max: number | null; conditions: string[]; country: string; city: string; swap: boolean; verified: boolean; shipsTo: string; }
const EMPTY: Filters = { category: '', min: null, max: null, conditions: [], country: '', city: '', swap: false, verified: false, shipsTo: '' };

interface ComboOption { key: string; kind: 'recent' | 'suggest' | 'category'; text: string; category: string | null; }
const RECENT_KEY = 'cmp_recent_searches';
const CATEGORY_KEYS = ['PHONES', 'ELECTRONICS', 'COMPUTERS', 'VEHICLES', 'AUTO_PARTS', 'REAL_ESTATE', 'HOME_GARDEN', 'FASHION', 'KIDS',
  'SPORTS', 'HOBBY', 'BOOKS_MUSIC', 'PETS', 'SERVICES', 'JOBS', 'OTHER'];

@Component({
  selector: 'page-search',
  imports: [MOTION, IonContent, IonIcon, IonModal, IonInfiniteScroll, IonInfiniteScrollContent, FormsModule, TPipe, RangeInputComponent,
    ListingCardComponent, SkeletonGridComponent, EmptyComponent, BackButtonComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <div class="page">
        <div class="topbar app-only"><cmp-back /><div class="title">{{ 'search.title' | t }}</div><div class="spacer"></div></div>

        <div class="combo reveal">
          <div class="searchbar" [class.open]="comboOpen()">
            <ion-icon name="search" aria-hidden="true"></ion-icon>
            <!-- combobox ARIA 1.2: tastele ↑ ↓ aleg o sugestie, Enter caută, Esc închide -->
            <input #box [(ngModel)]="q" (ngModelChange)="typed()" [placeholder]="'search.placeholder' | t" enterkeyhint="search" type="search"
              role="combobox" aria-autocomplete="list" [attr.aria-expanded]="comboOpen()" aria-controls="search-listbox"
              [attr.aria-activedescendant]="active() >= 0 ? 'sopt-' + active() : null" [attr.aria-label]="'common.search' | t"
              autocomplete="off" autocapitalize="off" spellcheck="false"
              (focus)="openCombo()" (blur)="closeCombo()" (keydown)="comboKey($event)" />
            @if (q) { <button class="icon-btn sm clear" (click)="q = ''; run(); box.focus()" [attr.aria-label]="'common.reset' | t"><ion-icon name="close"></ion-icon></button> }
            <button class="icon-btn" (click)="filtersOpen.set(true)" [attr.aria-label]="'common.filters' | t"><ion-icon name="options-outline"></ion-icon>@if (activeFilters()) { <span class="dot"></span> }</button>
          </div>
          @if (comboOpen()) {
            <div class="lb card" id="search-listbox" role="listbox" [attr.aria-label]="'search.suggestions' | t">
              @for (o of options(); track o.key; let i = $index) {
                @if (i === 0 || options()[i - 1].kind !== o.kind) {
                  <div class="grp" role="presentation">{{ (o.kind === 'recent' ? 'search.recent' : 'search.suggestions') | t }}
                    @if (o.kind === 'recent') { <button type="button" class="clr" (pointerdown)="$event.preventDefault()" (click)="clearRecent()">{{ 'search.clearRecent' | t }}</button> }</div>
                }
                <div class="opt" role="option" [id]="'sopt-' + i" [attr.aria-selected]="i === active()" [class.on]="i === active()"
                  (pointerdown)="$event.preventDefault()" (click)="pick(o)" (pointermove)="active.set(i)">
                  <ion-icon [name]="o.kind === 'recent' ? 'time-outline' : o.kind === 'category' ? 'grid-outline' : 'search'" aria-hidden="true"></ion-icon>
                  <span class="t">{{ o.text }}</span>
                  @if (o.category && o.kind !== 'category') { <span class="c">{{ 'search.inCategory' | t: { category: ('categories.' + o.category | t) } }}</span> }
                </div>
              }
            </div>
          }
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
          <div class="grid">@for (c of items(); track c.id; let i = $index) { <cmp-listing-card class="rv" [style.--i]="i % 4" [item]="c" /> }</div>
        }
        <ion-infinite-scroll (ionInfinite)="more($event)" [disabled]="!hasMore()"><ion-infinite-scroll-content></ion-infinite-scroll-content></ion-infinite-scroll>
      </div>

      <ion-modal [isOpen]="filtersOpen()" (didDismiss)="filtersOpen.set(false)" [initialBreakpoint]="0.92" [breakpoints]="[0, 0.92, 1]" handleBehavior="cycle">
        <ng-template>
          <ion-content>
            <div class="sheet">
              <div class="row between"><h2>{{ 'common.filters' | t }}</h2><button class="btn ghost sm" (click)="resetFilters()">{{ 'common.reset' | t }}</button></div>
              <div class="field"><label>{{ 'search.category' | t }}</label>
                <select class="input" [(ngModel)]="draft.category"><option value="">{{ 'search.anyCategory' | t }}</option>
                  @for (c of categories; track c) { <option [value]="c">{{ 'categories.' + c | t }}</option> }</select></div>
              <div class="field"><label>{{ 'search.priceRange' | t }}</label>
                <cmp-range-input [lo]="draft.min" (loChange)="draft.min = $event" [hi]="draft.max" (hiChange)="draft.max = $event"
                  [max]="rangeMax()" [fromLabel]="'search.from' | t" [toLabel]="'search.to' | t" /></div>
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
    .combo { position: relative; z-index: 20; }
    .searchbar:focus-within { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
    .searchbar input::-webkit-search-cancel-button { display: none; }
    .lb { position: absolute; left: 0; right: 0; top: calc(100% + 8px); padding: 6px; background: var(--surface); box-shadow: var(--shadow-pop); max-height: min(60vh, 420px); overflow: auto; overscroll-behavior: contain;
      transform-origin: top center; animation: lbIn .22s var(--ease) both; }
    @keyframes lbIn { from { opacity: 0; transform: translateY(-6px) scale(.98); } }
    .grp { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px 4px; font-size: 12.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); }
    .clr { border: 0; background: none; color: var(--accent); font: inherit; letter-spacing: 0; text-transform: none; font-size: 13.5px; font-weight: 600; cursor: pointer; min-height: 32px; }
    .opt { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 0 12px; border-radius: 14px; cursor: pointer; font-size: 16px; }
    .opt ion-icon { color: var(--text-3); font-size: 18px; flex: 0 0 auto; }
    .opt .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .opt .c { font-size: 13.5px; color: var(--text-3); white-space: nowrap; }
    .opt.on { background: var(--accent-soft); } .opt.on ion-icon { color: var(--accent); }
    .sorts { margin-top: 12px; }
    .meta { margin: 8px 2px 12px; }
    .linkbtn { display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; color: var(--accent); font-weight: 600; font-size: 14.5px; cursor: pointer; }
    .sheet { padding: 22px max(20px, env(safe-area-inset-right) + 12px) calc(env(safe-area-inset-bottom) + 40px) max(20px, env(safe-area-inset-left) + 12px); display: flex; flex-direction: column; gap: 16px; }
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

  // ---- combobox cu sugestii ----
  comboOpen = signal(false);
  active = signal(-1);
  private recent = signal<string[]>(this.loadRecent());
  private suggestions = signal<{ text: string; category: string | null }[]>([]);
  private suggestSeq = 0;
  private suggestTimer: any;
  options = computed<ComboOption[]>(() => {
    const q = this.qSig().trim().toLowerCase();
    const recent = this.recent().filter((r) => !q || r.toLowerCase().includes(q)).slice(0, q ? 3 : 6)
      .map((text) => ({ key: 'r:' + text, kind: 'recent' as const, text, category: null }));
    const cats = q.length >= 2 ? CATEGORY_KEYS.filter((c) => this.i18n.t('categories.' + c).toLowerCase().includes(q)).slice(0, 2)
      .map((c) => ({ key: 'c:' + c, kind: 'category' as const, text: this.i18n.t('categories.' + c), category: c })) : [];
    const sugg = this.suggestions().filter((s) => !recent.some((r) => r.text.toLowerCase() === s.text))
      .map((s) => ({ key: 's:' + s.text, kind: 'suggest' as const, text: s.text, category: s.category }));
    return [...recent, ...cats, ...sugg].slice(0, 9);
  });
  private qSig = signal('');

  ngOnInit() {
    this.q = this.qParam() ?? '';
    if (this.category()) this.f.set({ ...EMPTY, category: this.category()! });
    this.run();
  }

  /** Capătul sliderului: după categorie, în moneda locală aproximativă (RON implicit). */
  rangeMax() {
    const cur = this.auth.user()?.country === 'RO' || !this.auth.user() ? 'RON' : 'EUR';
    return niceCeil((PRICE_RANGE_EUR[this.draft.category] ?? 20000) * (FX_APPROX[cur] ?? 1));
  }

  activeFilters() { const f = this.f(); return !!(f.min || f.max || f.conditions.length || f.country || f.city || f.shipsTo); }
  flag(c: string) { return String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0))); }

  typed() {
    this.qSig.set(this.q);
    this.active.set(-1);
    this.comboOpen.set(true);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.run(), 350);
    clearTimeout(this.suggestTimer);
    const q = this.q.trim();
    if (q.length < 2) { this.suggestions.set([]); return; }
    this.suggestTimer = setTimeout(async () => {
      const my = ++this.suggestSeq;
      try { const r = await this.api.suggest(q); if (my === this.suggestSeq) this.suggestions.set(r); } catch { /* sugestiile sunt opționale */ }
    }, 150);
  }

  openCombo() { this.qSig.set(this.q); this.comboOpen.set(true); }
  /** La pierderea focusului: lăsăm click-ul pe opțiune să se termine întâi. */
  closeCombo() { setTimeout(() => { this.comboOpen.set(false); this.active.set(-1); }, 120); }

  comboKey(e: KeyboardEvent) {
    const n = this.options().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!this.comboOpen()) { this.comboOpen.set(true); return; }
      if (!n) return;
      const d = e.key === 'ArrowDown' ? 1 : -1;
      this.active.set(((this.active() + d) % n + n) % n);
      document.getElementById('sopt-' + this.active())?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = this.active() >= 0 ? this.options()[this.active()] : null;
      if (o) this.pick(o); else this.submit();
    } else if (e.key === 'Escape') {
      if (this.comboOpen()) { e.preventDefault(); this.comboOpen.set(false); this.active.set(-1); }
    } else if (e.key === 'Tab') { this.comboOpen.set(false); }
  }

  pick(o: ComboOption) {
    if (o.kind === 'category') { this.q = ''; this.f.update((f) => ({ ...f, category: o.category! })); }
    else this.q = o.text;
    this.qSig.set(this.q);
    this.submit();
  }

  /** Căutare confirmată (Enter / sugestie): o ținem minte în „căutări recente”, doar pe acest dispozitiv. */
  submit() {
    const q = this.q.trim();
    if (q) {
      const list = [q, ...this.recent().filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 8);
      this.recent.set(list);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    }
    this.comboOpen.set(false);
    this.active.set(-1);
    clearTimeout(this.debounce);
    this.run();
  }

  clearRecent() { this.recent.set([]); localStorage.removeItem(RECENT_KEY); }

  private loadRecent(): string[] {
    try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 8) : []; }
    catch { return []; }
  }
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

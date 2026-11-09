import { MOTION } from '../shared/motion.directives';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, NavController } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, TPipe } from '../core/i18n.service';
import { CATEGORY_ICONS } from '../core/icons';
import { CATEGORIES, CONDITIONS, COUNTRIES, CURRENCIES, PriceAnalysis } from '../core/models';
import { Ui } from '../core/ui.service';
import { Motion } from '../core/motion.service';
import { BackButtonComponent } from '../shared/back-button.component';

interface Photo { id?: string; url: string; uploading: boolean; }

@Component({
  selector: 'page-sell',
  imports: [MOTION, IonContent, IonIcon, FormsModule, RouterLink, TPipe, BackButtonComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <div class="page narrow">
        <div class="topbar"><cmp-back icon="close" /><div class="title">{{ (id() ? 'sell.editTitle' : 'sell.title') | t }}</div><div class="spacer"></div></div>

        @if (blocked()) {
          <div class="paywall card pad reveal">
            <div class="pw-ic"><ion-icon name="rocket-outline"></ion-icon></div>
            <h2>{{ 'sell.quotaTitle' | t }}</h2>
            <p class="muted">{{ 'sell.quotaSub' | t: { limit: auth.user()?.quota?.limit } }}</p>
            <button class="btn block" (click)="buyExtra()"><ion-icon name="add-circle"></ion-icon>{{ 'sell.buyExtra' | t }}</button>
            <a class="btn light block" routerLink="/plans">{{ 'sell.seePlans' | t }}</a>
            <a class="btn ghost block" routerLink="/profile"><ion-icon name="gift-outline"></ion-icon>{{ 'sell.invite' | t }}</a>
          </div>
        } @else if (published()) {
          <div class="done reveal">
            <div class="confetti">@for (c of confetti; track $index) { <i [style.--x]="c.x" [style.--d]="c.d" [style.--c]="c.c" [style.--r]="c.r"></i> }</div>
            <div class="check"><ion-icon name="checkmark"></ion-icon></div>
            <h1 [cmpSplit]="'sell.published' | t" [delay]="350"></h1>
            <p class="muted">{{ 'sell.publishedSub' | t }}</p>
            <button class="btn block" (click)="view()">{{ 'sell.viewListing' | t }}</button>
          </div>
        } @else {
          <div class="steps">
            @for (s of stepKeys; track s; let i = $index) {
              <button class="st" [class.on]="step() === i" [class.past]="step() > i" (click)="i < step() && step.set(i)">
                <span class="n">@if (step() > i) { <ion-icon name="checkmark"></ion-icon> } @else { {{ i + 1 }} }</span><span class="l">{{ 'sell.steps.' + s | t }}</span>
              </button>
            }
            <div class="bar"><span [style.width.%]="(step() / 3) * 100"></span></div>
          </div>
          @if (!id() && auth.user(); as u) { <p class="quota faint small">{{ 'sell.quota' | t: { active: u.quota.active, limit: u.quota.limit } }}</p> }

          @switch (step()) {
            @case (0) {
              <section class="step-in">
                <div class="photos">
                  @for (p of photos(); track p.url; let i = $index) {
                    <div class="ph reveal" [style.--i]="i">
                      <img [src]="api.url(p.url)" alt="" />
                      @if (p.uploading) { <div class="up"><span class="spin"></span></div> }
                      @if (i === 0) { <span class="cover badge glass-b">Cover</span> }
                      <button class="icon-btn sm rm" (click)="removePhoto(i)"><ion-icon name="close"></ion-icon></button>
                    </div>
                  }
                  @if (photos().length < 10) {
                    <label class="add press"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple (change)="pick($event)" hidden />
                      <ion-icon name="camera"></ion-icon><span>{{ 'sell.addPhotos' | t }}</span></label>
                  }
                </div>
                <p class="hint">{{ 'sell.photosHint' | t }}</p>
              </section>
            }
            @case (1) {
              <section class="stack step-in">
                <div class="field"><label>{{ 'sell.titleLabel' | t }}</label><input class="input" [(ngModel)]="f.title" maxlength="90" [placeholder]="'sell.titlePh' | t" /></div>
                <div class="field"><label>{{ 'sell.category' | t }}</label>
                  <div class="catgrid">@for (c of categories; track c) {
                    <button class="cat" [class.on]="f.category === c" (click)="f.category = c"><ion-icon [name]="icons[c]"></ion-icon><span>{{ 'categories.' + c | t }}</span></button> }</div></div>
                <div class="field"><label>{{ 'sell.condition' | t }}</label>
                  <div class="chips">@for (c of conditions; track c) { <button class="chip" [class.active]="f.condition === c" (click)="f.condition = c">{{ 'conditions.' + c | t }}</button> }</div></div>
                <div class="field"><label>{{ 'sell.description' | t }}</label><textarea class="input" [(ngModel)]="f.description" maxlength="4000" [placeholder]="'sell.descPh' | t"></textarea>
                  <span class="hint">{{ f.description.length }}/4000</span></div>
                <div class="field"><label>{{ 'sell.attributes' | t }} <span class="faint">({{ 'common.optional' | t }})</span></label>
                  @for (a of f.attrs; track $index; let i = $index) {
                    <div class="attr"><input class="input" [(ngModel)]="a.k" [placeholder]="'sell.attrKey' | t" maxlength="30" /><input class="input" [(ngModel)]="a.v" [placeholder]="'sell.attrValue' | t" maxlength="60" />
                      <button class="icon-btn sm" (click)="f.attrs.splice(i, 1)"><ion-icon name="close"></ion-icon></button></div> }
                  @if (f.attrs.length < 12) { <button class="chip" (click)="f.attrs.push({ k: '', v: '' })"><ion-icon name="add"></ion-icon>{{ 'sell.addAttr' | t }}</button> }
                </div>
              </section>
            }
            @case (2) {
              <section class="stack step-in">
                <div class="pricebox card pad glass">
                  <label>{{ 'sell.price' | t }}</label>
                  <div class="pinput"><input type="number" inputmode="decimal" [(ngModel)]="f.price" (ngModelChange)="checkPrice()" placeholder="0" />
                    <select [(ngModel)]="f.currency" (ngModelChange)="checkPrice()">@for (c of currencies; track c) { <option>{{ c }}</option> }</select></div>
                </div>
                <div class="aibox card pad" [attr.data-v]="analysis()?.verdict">
                  <div class="row"><span class="ai">AI</span><strong>{{ 'price.aiCheck' | t }}</strong>@if (checking()) { <span class="spin sm"></span> }</div>
                  @if (analysis(); as a) {
                    <p class="v fade">{{ 'price.' + a.verdict | t }}</p>
                    @if (a.medianCents) { <p class="muted small">{{ 'price.median' | t: { price: i18n.price(a.medianCents, a.currency), n: a.comparables } }}</p>
                      <div class="meter"><span class="mk" [style.left.%]="meterPos()"></span></div> }
                  } @else { <p class="muted small">—</p> }
                </div>
                <div class="card toggles">
                  <div class="toggle-row"><span><ion-icon name="pricetag-outline"></ion-icon> {{ 'sell.acceptsOffers' | t }}</span><button class="switch" [class.on]="f.acceptsOffers" (click)="f.acceptsOffers = !f.acceptsOffers"></button></div>
                  <div class="toggle-row"><span><ion-icon name="swap-horizontal"></ion-icon> {{ 'sell.acceptsSwap' | t }}</span><button class="switch" [class.on]="f.acceptsSwap" (click)="f.acceptsSwap = !f.acceptsSwap"></button></div>
                </div>
              </section>
            }
            @case (3) {
              <section class="stack step-in">
                <div class="two">
                  <div class="field"><label>{{ 'sell.country' | t }}</label><select class="input" [(ngModel)]="f.country">@for (c of countries; track c) { <option>{{ c }}</option> }</select></div>
                  <div class="field"><label>{{ 'sell.city' | t }}</label><input class="input" [(ngModel)]="f.city" maxlength="80" /></div>
                </div>
                <div class="field"><label>{{ 'sell.shipsTo' | t }}</label>
                  <div class="chips">
                    <button class="chip" [class.active]="f.worldwide" (click)="f.worldwide = !f.worldwide"><ion-icon name="globe-outline"></ion-icon>{{ 'sell.worldwide' | t }}</button>
                    @if (!f.worldwide) { @for (c of countries; track c) { <button class="chip" [class.active]="f.shipsTo.includes(c)" (click)="toggleShip(c)">{{ c }}</button> } }
                  </div></div>
                <div class="field"><label>{{ 'sell.weight' | t }}</label><input class="input" type="number" inputmode="decimal" [(ngModel)]="f.weightKg" /></div>
              </section>
            }
          }

          @if (error()) { <div class="error-text fade">{{ error() }}</div> }
          <div class="nav">
            @if (step() > 0) { <button class="btn light" (click)="step.set(step() - 1)"><ion-icon name="arrow-back"></ion-icon></button> }
            @if (step() < 3) { <button class="btn grow" [disabled]="!canNext()" (click)="next()">{{ 'common.next' | t }} <ion-icon name="arrow-forward"></ion-icon></button> }
            @else { <button class="btn accent grow" [disabled]="busy() || !f.city" (click)="publish()"><ion-icon name="rocket-outline"></ion-icon>{{ (id() ? 'sell.saveChanges' : 'sell.publish') | t }}</button> }
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .step-in { animation: slideInR .55s var(--spring) both; }
    .step-in > * { animation: fadeUp .6s var(--spring) both; }
    .step-in > *:nth-child(2) { animation-delay: .06s; } .step-in > *:nth-child(3) { animation-delay: .12s; } .step-in > *:nth-child(4) { animation-delay: .18s; } .step-in > *:nth-child(5) { animation-delay: .24s; }
    .ph { animation: pop .5s var(--spring) both; }
    .add { transition: transform .4s var(--spring), border-color .3s; } .add:hover { transform: translateY(-3px); border-color: var(--accent); }
    .add ion-icon { animation: pulseSoft 2.4s ease-in-out infinite; }
    .steps { position: relative; display: flex; justify-content: space-between; margin: 6px 0 8px; }
    .st { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; border: 0; background: none; color: var(--text-3); font-size: 12px; font-weight: 600; cursor: pointer; }
    .n { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-card); transition: all .4s var(--spring); }
    .st.on { color: var(--text); } .st.on .n { background: var(--btn-dark); color: var(--btn-dark-text); transform: scale(1.12); }
    .st.past .n { background: var(--accent); color: #fff; border-color: transparent; }
    .bar { position: absolute; top: 16px; left: 20px; right: 20px; height: 3px; background: var(--surface-3); border-radius: 9px; }
    .bar span { display: block; height: 100%; background: var(--accent); border-radius: 9px; transition: width .6s var(--ease); }
    .quota { text-align: center; margin: 4px 0 14px; }
    .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .ph, .add { position: relative; aspect-ratio: 1; border-radius: 20px; overflow: hidden; background: var(--image-bg); }
    .ph img { width: 100%; height: 100%; object-fit: cover; }
    .up { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.25); }
    .cover { position: absolute; bottom: 8px; left: 8px; } .rm { position: absolute; top: 6px; right: 6px; }
    .add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border: 2px dashed var(--surface-3); background: var(--surface); cursor: pointer; color: var(--text-2); font-size: 12.5px; font-weight: 600; text-align: center; padding: 6px; }
    .add ion-icon { font-size: 28px; color: var(--accent); }
    .hint { margin-top: 10px; display: block; }
    .catgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    @media (max-width: 420px) { .catgrid { grid-template-columns: repeat(3, 1fr); } }
    .cat { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 4px; border-radius: 18px; border: 1.5px solid var(--line); background: var(--surface); color: var(--text-2); cursor: pointer; font-size: 11.5px; font-weight: 600; transition: all .25s var(--ease); }
    .cat ion-icon { font-size: 22px; } .cat.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); transform: translateY(-2px); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .attr { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: center; margin-bottom: 8px; } .attr .input { height: 48px; }
    .pricebox label { font-size: 13px; font-weight: 600; color: var(--text-2); }
    .pinput { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
    .pinput input { flex: 1; min-width: 0; border: 0; outline: none; background: none; font-family: var(--font-display); font-size: 44px; font-weight: 700; letter-spacing: -0.03em; color: var(--text); }
    .pinput select { height: 44px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface-2); color: var(--text); padding: 0 12px; font-weight: 600; }
    .aibox { transition: background .4s; } .aibox[data-v="BELOW"] { background: var(--ok-soft); } .aibox[data-v="FAIR"] { background: var(--accent-soft); } .aibox[data-v="ABOVE"] { background: var(--warn-soft); }
    .ai { font-size: 11px; font-weight: 800; padding: 3px 7px; border-radius: 8px; background: var(--text); color: var(--surface); }
    .v { font-family: var(--font-display); font-size: 20px; font-weight: 700; margin: 8px 0 2px; }
    .meter { position: relative; height: 8px; border-radius: 99px; margin-top: 14px; background: linear-gradient(90deg, var(--ok), var(--accent) 50%, var(--warn)); }
    .mk { position: absolute; top: 50%; width: 18px; height: 18px; border-radius: 50%; background: var(--surface); border: 3px solid var(--text); transform: translate(-50%, -50%); transition: left .6s var(--spring); }
    .toggles { padding: 4px 14px; } .toggles span { display: flex; align-items: center; gap: 8px; font-weight: 550; } .toggles ion-icon { color: var(--accent); }
    .two { display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; }
    .nav { display: flex; gap: 10px; margin-top: 24px; } .nav .grow { flex: 1; }
    .spin { width: 26px; height: 26px; border-radius: 50%; border: 3px solid rgba(255,255,255,.4); border-top-color: #fff; animation: spinSlow .8s linear infinite; }
    .spin.sm { width: 16px; height: 16px; border-width: 2px; border-color: var(--surface-3); border-top-color: var(--accent); margin-left: auto; }
    .paywall { text-align: center; display: flex; flex-direction: column; gap: 12px; align-items: center; margin-top: 30px; }
    .pw-ic { width: 76px; height: 76px; border-radius: 26px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-size: 34px; animation: floaty 4s ease-in-out infinite; }
    .done { position: relative; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; padding-top: 60px; }
    .check { width: 110px; height: 110px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(135deg, #7457ff, #5b3df5); color: #fff; font-size: 56px;
      box-shadow: 0 24px 50px -16px rgba(91,61,245,.7); animation: pop .8s var(--spring) both; }
    .confetti { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
    .confetti i { position: absolute; top: 90px; left: 50%; width: 10px; height: 14px; border-radius: 3px; background: var(--c);
      animation: burst 1.6s var(--ease) forwards; animation-delay: calc(var(--d) * 1ms); opacity: 0; }
    @keyframes burst { 0% { opacity: 1; transform: translate(-50%, 0) rotate(0); } 100% { opacity: 0; transform: translate(calc(var(--x) * 1px), 260px) rotate(var(--r)); } }
  `],
})
export class SellPage implements OnInit {
  api = inject(Api);
  auth = inject(AuthService);
  i18n = inject(I18n);
  private ui = inject(Ui);
  private nav = inject(NavController);
  private motion = inject(Motion);
  id = input<string>();

  stepKeys = ['photos', 'details', 'price', 'delivery'];
  categories = CATEGORIES; conditions = CONDITIONS; countries = COUNTRIES; currencies = CURRENCIES; icons = CATEGORY_ICONS;
  step = signal(0);
  photos = signal<Photo[]>([]);
  analysis = signal<PriceAnalysis | null>(null);
  checking = signal(false);
  busy = signal(false);
  error = signal('');
  published = signal<string | null>(null);
  blocked = computed(() => { const u = this.auth.user(); return !this.id() && !!u && u.quota.active >= u.quota.limit && !this.published(); });
  confetti = Array.from({ length: 36 }, (_, i) => ({ x: Math.round((Math.random() - 0.5) * 520), d: Math.round(Math.random() * 300), r: Math.round(Math.random() * 720) + 'deg',
    c: ['#5B3DF5', '#FF5A4E', '#14A46C', '#FFC93C', '#7B5CFF'][i % 5] }));
  f = {
    title: '', description: '', category: '', condition: 'GOOD', price: null as number | null, currency: 'RON',
    country: 'RO', city: '', shipsTo: ['RO'] as string[], worldwide: false, weightKg: 1, acceptsOffers: true, acceptsSwap: false,
    attrs: [] as { k: string; v: string }[],
  };
  private priceTimer: any;

  async ngOnInit() {
    const u = this.auth.user();
    if (u) { this.f.country = u.country || 'RO'; this.f.city = u.city || ''; this.f.currency = this.currencyFor(this.f.country); this.f.shipsTo = [this.f.country]; }
    try { const me = await this.api.me(); this.auth.setUser(me); } catch { /* ignore */ }
    if (this.id()) {
      try {
        const d = await this.api.listing(this.id()!);
        if (!d.owner) { this.nav.navigateRoot('/home'); return; }
        Object.assign(this.f, {
          title: d.title, description: d.description, category: d.category, condition: d.condition, price: d.priceCents / 100,
          currency: d.currency, country: d.country, city: d.city, shipsTo: d.shipsTo.filter((s) => s !== '*'), worldwide: d.shipsTo.includes('*'),
          weightKg: d.weightGrams / 1000, acceptsOffers: d.acceptsOffers, acceptsSwap: d.acceptsSwap,
          attrs: Object.entries(d.attributes).map(([k, v]) => ({ k, v })),
        });
        this.photos.set(d.images.map((i) => ({ id: i.id, url: i.url, uploading: false })));
        this.checkPrice();
      } catch (e) { this.ui.error(e); }
    }
  }

  currencyFor(c: string) { return ({ RO: 'RON', MD: 'MDL', HU: 'HUF', PL: 'PLN', BG: 'BGN', CZ: 'CZK', GB: 'GBP', US: 'USD', CH: 'CHF', TR: 'TRY', UA: 'UAH' } as any)[c] ?? 'EUR'; }

  canNext() {
    const s = this.step();
    if (s === 0) return this.photos().length > 0 && this.photos().every((p) => !p.uploading);
    if (s === 1) return this.f.title.trim().length >= 5 && !!this.f.category && this.f.description.trim().length >= 20;
    if (s === 2) return this.f.price !== null && this.f.price >= 0;
    return true;
  }
  next() { this.error.set(''); this.step.update((s) => s + 1); if (this.step() === 2) this.checkPrice(); }

  meterPos() {
    const a = this.analysis();
    if (!a?.medianCents || this.f.price == null) return 50;
    const ratio = (this.f.price * 100) / a.medianCents;
    return Math.max(4, Math.min(96, 50 + (ratio - 1) * 120));
  }

  checkPrice() {
    clearTimeout(this.priceTimer);
    if (!this.f.title || !this.f.category || this.f.price == null) return;
    this.priceTimer = setTimeout(async () => {
      this.checking.set(true);
      try { this.analysis.set(await this.api.priceCheck({ title: this.f.title, category: this.f.category, currency: this.f.currency, priceCents: Math.round(this.f.price! * 100) })); }
      catch { this.analysis.set(null); }
      this.checking.set(false);
    }, 450);
  }

  toggleShip(c: string) { const i = this.f.shipsTo.indexOf(c); i >= 0 ? this.f.shipsTo.splice(i, 1) : this.f.shipsTo.push(c); }

  async pick(ev: Event) {
    const files = Array.from((ev.target as HTMLInputElement).files ?? []).slice(0, 10 - this.photos().length);
    (ev.target as HTMLInputElement).value = '';
    for (const file of files) {
      const local: Photo = { url: URL.createObjectURL(file), uploading: true };
      this.photos.update((p) => [...p, local]);
      try {
        const blob = await this.compress(file);
        const r = await this.api.uploadImage(blob);
        this.photos.update((p) => p.map((x) => (x === local ? { id: r.id, url: r.url, uploading: false } : x)));
      } catch (e) {
        this.photos.update((p) => p.filter((x) => x !== local));
        this.ui.error(e);
      }
    }
  }

  /** Redimensionare și re-encodare în browser: mai rapid de încărcat, iar metadatele (inclusiv GPS) dispar. */
  private async compress(file: File): Promise<Blob> {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.86));
  }

  removePhoto(i: number) { this.photos.update((p) => p.filter((_, j) => j !== i)); }

  async publish() {
    this.busy.set(true);
    this.error.set('');
    const attributes: Record<string, string> = {};
    this.f.attrs.filter((a) => a.k.trim() && a.v.trim()).forEach((a) => (attributes[a.k.trim()] = a.v.trim()));
    const body = {
      title: this.f.title.trim(), description: this.f.description.trim(), category: this.f.category, condition: this.f.condition,
      priceCents: Math.round((this.f.price ?? 0) * 100), currency: this.f.currency, country: this.f.country, city: this.f.city.trim(),
      shipsTo: this.f.worldwide ? ['*'] : this.f.shipsTo, weightGrams: Math.max(1, Math.round((this.f.weightKg || 1) * 1000)),
      acceptsOffers: this.f.acceptsOffers, acceptsSwap: this.f.acceptsSwap, attributes, imageIds: this.photos().map((p) => p.id!).filter(Boolean),
    };
    try {
      const r = this.id() ? await this.api.updateListing(this.id()!, body) : await this.api.createListing(body);
      this.ui.tap();
      if (this.id()) { this.nav.navigateBack(['/listing', r.id]); }
      else { this.published.set(r.id); this.motion.confetti(90); this.api.me().then((m) => this.auth.setUser(m)).catch(() => {}); }
    } catch (e) { this.error.set(this.ui.errorText(e)); }
    this.busy.set(false);
  }

  view() { this.nav.navigateRoot(['/listing', this.published()]); }

  async buyExtra() {
    try { await this.api.checkout('EXTRA_LISTING'); this.auth.setUser(await this.api.me()); this.ui.toast(this.i18n.t('plans.done') + ' · ' + this.i18n.t('common.simulated')); }
    catch (e) { this.ui.error(e); }
  }
}

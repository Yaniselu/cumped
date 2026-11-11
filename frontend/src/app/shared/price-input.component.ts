import { Component, ElementRef, ViewChild, computed, effect, inject, input, model, signal } from '@angular/core';
import { I18n } from '../core/i18n.service';
import { Ui } from '../core/ui.service';

export interface PriceChip { label: string; value: number; }

/**
 * Preț cu slider + câmp numeric, sincronizate.
 *  - scale 'log' pentru intervale mari (ex. 1 → 500.000 la vânzare), 'linear' pentru oferte;
 *  - marcaj pentru mediana pieței (AI) și pentru prețul de referință (prețul din anunț);
 *  - valorile din slider se rotunjesc „frumos” (5, 10, 50, 100…), câmpul acceptă orice sumă exactă;
 *  - accesibil: slider nativ (tastatură, cititor de ecran), câmp cu inputmode decimal.
 * Valorile sunt în unități de monedă (nu în cenți).
 */
@Component({
  selector: 'cmp-price-input',
  template: `
    <div class="pi" [class.big]="big()" [class.focus]="focused()">
      <div class="amount">
        <input #field type="text" inputmode="decimal" autocomplete="off" [attr.aria-label]="label() || null"
               [value]="text()" [placeholder]="placeholder()" (focus)="onFocus()" (blur)="onBlur()" (input)="onType($event)" />
        <ng-content select="[slot=currency]"></ng-content>
        @if (showCurrency()) { <span class="cur">{{ currency() }}</span> }
      </div>
      @if (delta(); as d) { <div class="delta" [class.neg]="d < 0">{{ d > 0 ? '+' : '' }}{{ d }}% {{ deltaLabel() }}</div> }
      <div class="slider" [style.--p]="pos()">
        <div class="track"><span class="fill"></span>
          @if (medianPos() !== null) { <i class="mark med" [style.left.%]="medianPos()! * 100" [attr.data-l]="medianLabel()"></i> }
          @if (refPos() !== null) { <i class="mark ref" [style.left.%]="refPos()! * 100" [attr.data-l]="refLabel()"></i> }
        </div>
        <input type="range" min="0" max="1000" step="1" [value]="pos() * 1000" (input)="onSlide($event)" (change)="ui.tap()"
               [attr.aria-label]="label() || null" [attr.aria-valuetext]="aria()" />
      </div>
      <div class="ends"><span>{{ fmt(min()) }}</span><span>{{ fmt(effMax()) }}+</span></div>
      @if (chips().length) {
        <div class="chips">@for (c of chips(); track c.label) {
          <button type="button" class="chip" [class.active]="value() === c.value" (click)="set(c.value, true)">{{ c.label }}</button> }</div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .amount { display: flex; align-items: center; gap: 10px; }
    .amount input { flex: 1; min-width: 0; border: 0; outline: none; background: none; color: var(--text); padding: 0;
      font-family: var(--font-display); font-weight: 700; letter-spacing: -0.03em; font-size: 30px; font-variant-numeric: tabular-nums; }
    .big .amount input { font-size: clamp(32px, 10vw, 44px); }
    .cur { font-weight: 650; color: var(--text-2); font-size: 16px; padding: 8px 12px; border-radius: 12px; background: var(--surface-2); }
    .delta { margin-top: 2px; font-size: 13.5px; font-weight: 650; color: var(--accent); }
    .delta.neg { color: var(--text-2); }
    .slider { position: relative; height: 44px; margin-top: 8px; touch-action: pan-y; }
    .track { position: absolute; left: 0; right: 0; top: 50%; height: 8px; margin-top: -4px; border-radius: 99px; background: var(--surface-3); }
    .fill { position: absolute; left: 0; top: 0; bottom: 0; width: calc(var(--p) * 100%); border-radius: 99px;
      background: linear-gradient(90deg, #8b6dff, var(--accent)); }
    .mark { position: absolute; top: -6px; width: 2px; height: 20px; margin-left: -1px; border-radius: 2px; background: var(--text); opacity: .55; }
    .mark::after { content: attr(data-l); position: absolute; top: -18px; left: 50%; transform: translateX(-50%); font-size: 12px; font-weight: 700;
      font-style: normal; color: var(--text-2); white-space: nowrap; letter-spacing: .02em; }
    .mark.med { background: var(--ok); opacity: 1; } .mark.med::after { color: var(--ok); }
    input[type=range] { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; background: transparent; -webkit-appearance: none; appearance: none; cursor: pointer; }
    input[type=range]:focus-visible { outline: none; }
    input[type=range]::-webkit-slider-runnable-track { height: 44px; background: transparent; }
    input[type=range]::-moz-range-track { height: 44px; background: transparent; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 30px; height: 30px; margin-top: 7px; border-radius: 50%; background: #fff;
      border: 0; box-shadow: 0 4px 14px -2px rgba(20, 16, 60, .35), 0 0 0 1px rgba(0,0,0,.06), inset 0 0 0 7px var(--accent); transition: transform .2s var(--spring); }
    input[type=range]::-moz-range-thumb { width: 30px; height: 30px; border-radius: 50%; background: #fff; border: 0;
      box-shadow: 0 4px 14px -2px rgba(20, 16, 60, .35), inset 0 0 0 7px var(--accent); }
    input[type=range]:active::-webkit-slider-thumb { transform: scale(1.15); }
    input[type=range]:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 5px var(--accent-soft), inset 0 0 0 7px var(--accent); }
    .ends { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-3); margin-top: -2px; font-variant-numeric: tabular-nums; }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    .chips .chip { height: 32px; font-size: 13.5px; }
  `],
})
export class PriceInputComponent {
  ui = inject(Ui);
  private i18n = inject(I18n);
  @ViewChild('field') field?: ElementRef<HTMLInputElement>;

  value = model<number | null>(null);
  min = input(0);
  max = input(1000);
  scale = input<'linear' | 'log'>('log');
  /** Pas fix pentru slider; 0 = rotunjire automată după mărime. */
  step = input(0);
  currency = input('RON');
  median = input<number | null>(null);
  reference = input<number | null>(null);
  medianLabel = input('AI');
  refLabel = input('');
  deltaLabel = input('');
  label = input('');
  placeholder = input('0');
  chips = input<PriceChip[]>([]);
  big = input(false);
  /** false când pagina pune propriul selector de monedă în slotul [slot=currency]. */
  showCurrency = input(true);

  focused = signal(false);
  private draft = signal<string | null>(null);
  /** Maximul crește dacă utilizatorul scrie o sumă mai mare decât intervalul implicit. */
  effMax = computed(() => Math.max(this.max(), (this.value() ?? 0) > this.max() && this.scale() === 'log' ? Math.ceil((this.value() ?? 0) * 1.25) : this.max()));
  pos = computed(() => this.toPos(this.value() ?? this.min()));
  medianPos = computed(() => this.markPos(this.median()));
  refPos = computed(() => this.markPos(this.reference()));
  delta = computed(() => {
    const r = this.reference(), v = this.value();
    if (!r || v == null || !this.deltaLabel()) return null;
    const d = Math.round((v / r - 1) * 100);
    return d === 0 ? null : d;
  });
  text = computed(() => this.draft() ?? (this.value() == null ? '' : this.focused() ? String(this.value()) : this.fmt(this.value()!)));
  aria = computed(() => (this.value() == null ? '' : this.i18n.price(Math.round(this.value()! * 100), this.currency())));
  private lastSide = 0;

  constructor() {
    // Vibrație scurtă când sliderul trece de mediana pieței.
    effect(() => {
      const m = this.medianPos(), p = this.pos();
      if (m === null) return;
      const side = Math.sign(p - m);
      if (this.lastSide && side && side !== this.lastSide) this.ui.tap();
      this.lastSide = side || this.lastSide;
    });
  }

  fmt(v: number) { return new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 2 }).format(v); }

  private markPos(v: number | null) {
    if (v == null || v < this.min() || v > this.effMax()) return null;
    return this.toPos(v);
  }

  private toPos(v: number) {
    const lo = this.min(), hi = this.effMax();
    if (hi <= lo) return 0;
    const c = Math.max(lo, Math.min(hi, v));
    return this.scale() === 'log' ? Math.log1p(c - lo) / Math.log1p(hi - lo) : (c - lo) / (hi - lo);
  }

  private fromPos(p: number) {
    const lo = this.min(), hi = this.effMax();
    const raw = this.scale() === 'log' ? lo + Math.expm1(p * Math.log1p(hi - lo)) : lo + p * (hi - lo);
    return Math.max(lo, Math.min(hi, this.nice(raw)));
  }

  private nice(v: number) {
    const st = this.step() || (v < 50 ? 1 : v < 500 ? 5 : v < 2000 ? 10 : v < 10000 ? 50 : v < 50000 ? 100 : v < 200000 ? 500 : 1000);
    return Math.round(v / st) * st;
  }

  set(v: number | null, haptic = false) {
    this.draft.set(null);
    this.value.set(v == null ? null : Math.round(v * 100) / 100);
    if (haptic) this.ui.tap();
  }

  onSlide(ev: Event) { this.field?.nativeElement.blur(); this.set(this.fromPos(Number((ev.target as HTMLInputElement).value) / 1000)); }

  onFocus() { this.focused.set(true); }
  onBlur() { this.focused.set(false); this.draft.set(null); }

  onType(ev: Event) {
    const el = ev.target as HTMLInputElement;
    // păstrăm doar cifre și un singur separator zecimal (virgulă sau punct)
    let s = el.value.replace(/[^\d.,]/g, '');
    const sep = s.search(/[.,]/);
    if (sep >= 0) s = s.slice(0, sep + 1) + s.slice(sep + 1).replace(/[.,]/g, '').slice(0, 2);
    if (s.replace(/[.,]/, '').length > 10) s = s.slice(0, -1);
    this.draft.set(s);
    if (el.value !== s) el.value = s;
    const n = s === '' ? null : Number(s.replace(',', '.'));
    this.value.set(n == null || isNaN(n) ? null : n);
  }
}

/**
 * Interval de preț (min–max) pentru filtre: două câmpuri + slider cu două capete pe scară logaritmică.
 * null la un capăt = fără limită.
 */
@Component({
  selector: 'cmp-range-input',
  template: `
    <div class="rg">
      <div class="ins">
        <label><span>{{ fromLabel() }}</span><input type="text" inputmode="numeric" [value]="lo() ?? ''" [placeholder]="'0'" (input)="typed($event, 'lo')" [attr.aria-label]="fromLabel()" /></label>
        <span class="dash">–</span>
        <label><span>{{ toLabel() }}</span><input type="text" inputmode="numeric" [value]="hi() ?? ''" [placeholder]="fmt(max()) + '+'" (input)="typed($event, 'hi')" [attr.aria-label]="toLabel()" /></label>
      </div>
      <div class="slider" [style.--a]="pLo()" [style.--b]="pHi()">
        <div class="track"><span class="fill"></span></div>
        <input type="range" min="0" max="1000" [value]="pLo() * 1000" (input)="slid($event, 'lo')" [attr.aria-label]="fromLabel()" />
        <input type="range" min="0" max="1000" [value]="pHi() * 1000" (input)="slid($event, 'hi')" [attr.aria-label]="toLabel()" />
      </div>
    </div>
  `,
  styles: [`
    .ins { display: flex; align-items: flex-end; gap: 8px; }
    .ins label { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 600; color: var(--text-3); }
    .ins input { height: 48px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface); color: var(--text); padding: 0 14px; font-size: 16px;
      font-weight: 650; font-family: inherit; outline: none; width: 100%; font-variant-numeric: tabular-nums; }
    .ins input:focus { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
    .dash { padding-bottom: 14px; color: var(--text-3); }
    .slider { position: relative; height: 44px; margin-top: 6px; }
    .track { position: absolute; left: 0; right: 0; top: 50%; height: 6px; margin-top: -3px; border-radius: 99px; background: var(--surface-3); }
    .fill { position: absolute; top: 0; bottom: 0; left: calc(var(--a) * 100%); right: calc((1 - var(--b)) * 100%); background: var(--accent); border-radius: 99px; }
    input[type=range] { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; background: transparent; -webkit-appearance: none; appearance: none; pointer-events: none; }
    input[type=range]::-webkit-slider-runnable-track { height: 44px; background: transparent; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; pointer-events: auto; width: 28px; height: 28px; margin-top: 8px; border-radius: 50%; background: #fff; border: 0;
      box-shadow: 0 4px 12px -2px rgba(20, 16, 60, .35), inset 0 0 0 6px var(--accent); cursor: pointer; }
    input[type=range]::-moz-range-thumb { pointer-events: auto; width: 28px; height: 28px; border-radius: 50%; background: #fff; border: 0; box-shadow: inset 0 0 0 6px var(--accent); cursor: pointer; }
  `],
})
export class RangeInputComponent {
  private i18n = inject(I18n);
  lo = model<number | null>(null);
  hi = model<number | null>(null);
  max = input(100000);
  fromLabel = input('From');
  toLabel = input('To');

  pLo = computed(() => this.toPos(this.lo() ?? 0));
  pHi = computed(() => (this.hi() == null ? 1 : this.toPos(this.hi()!)));

  fmt(v: number) { return new Intl.NumberFormat(this.i18n.locale()).format(v); }
  private toPos(v: number) { return Math.min(1, Math.log1p(Math.max(0, v)) / Math.log1p(this.max())); }
  private fromPos(p: number) {
    const v = Math.expm1(p * Math.log1p(this.max()));
    const st = v < 50 ? 1 : v < 500 ? 5 : v < 2000 ? 10 : v < 10000 ? 50 : v < 50000 ? 100 : v < 200000 ? 500 : 1000;
    return Math.round(v / st) * st;
  }

  slid(ev: Event, which: 'lo' | 'hi') {
    const p = Number((ev.target as HTMLInputElement).value) / 1000;
    if (which === 'lo') {
      const p2 = Math.min(p, this.pHi() - 0.02);
      if (p2 !== p) (ev.target as HTMLInputElement).value = String(p2 * 1000);
      this.lo.set(p2 <= 0 ? null : this.fromPos(p2));
    } else {
      const p2 = Math.max(p, this.pLo() + 0.02);
      if (p2 !== p) (ev.target as HTMLInputElement).value = String(p2 * 1000);
      this.hi.set(p2 >= 1 ? null : this.fromPos(p2));
    }
  }

  typed(ev: Event, which: 'lo' | 'hi') {
    const el = ev.target as HTMLInputElement;
    const clean = el.value.replace(/\D/g, '').slice(0, 10);
    if (clean !== el.value) el.value = clean;
    const n = clean === '' ? null : Number(clean);
    (which === 'lo' ? this.lo : this.hi).set(n);
  }
}

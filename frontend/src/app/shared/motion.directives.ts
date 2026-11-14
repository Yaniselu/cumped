import { Directive, ElementRef, NgZone, OnDestroy, OnInit, effect, inject, input } from '@angular/core';
import { I18n } from '../core/i18n.service';

/** Numărătoare animată (prețuri, statistici). */
@Directive({ selector: '[cmpCount]' })
export class CountDirective {
  private el = inject(ElementRef<HTMLElement>);
  private i18n = inject(I18n);
  cmpCount = input<number | null | undefined>(0);
  currency = input<string | null>(null);
  duration = input(900);
  private current = 0;

  constructor() {
    effect(() => {
      const target = this.cmpCount() ?? 0;
      const cur = this.currency();
      const from = this.current;
      const dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : this.duration();
      const start = performance.now();
      const fmt = (v: number) => (cur ? this.i18n.price(Math.round(v), cur) : Math.round(v).toLocaleString(this.i18n.locale()));
      const step = (now: number) => {
        const t = dur ? Math.min(1, (now - start) / dur) : 1;
        const eased = 1 - Math.pow(1 - t, 4);
        const v = from + (target - from) * eased;
        this.el.nativeElement.textContent = fmt(cur ? Math.round(v / 100) * 100 : v);
        if (t < 1) requestAnimationFrame(step); else { this.current = target; this.el.nativeElement.textContent = fmt(target); }
      };
      requestAnimationFrame(step);
    });
  }
}

/** Efecte legate de scroll pe ion-content: clasa „scrolled” + variabila CSS --scroll (pentru parallax și antete). */
@Directive({ selector: 'ion-content[cmpScrollFx]', host: { '(ionScroll)': 'onScroll($event)' } })
export class ScrollFxDirective implements OnInit {
  private el = inject(ElementRef<HTMLElement & { scrollEvents: boolean }>);
  private raf = 0;
  ngOnInit() { this.el.nativeElement.scrollEvents = true; }
  onScroll(ev: CustomEvent) {
    const top = ev.detail?.scrollTop ?? 0;
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => {
      const host = this.el.nativeElement;
      host.style.setProperty('--scroll', String(Math.min(top, 1200)));
      host.classList.toggle('scrolled', top > 14);
      host.classList.toggle('scrolled-far', top > 220);
    });
  }
}

/** Text care apare cuvânt cu cuvânt. */
@Directive({ selector: '[cmpSplit]' })
export class SplitTextDirective {
  private el = inject(ElementRef<HTMLElement>);
  cmpSplit = input<string>('');
  delay = input(0);
  constructor() {
    effect(() => {
      const text = this.cmpSplit() ?? '';
      const host = this.el.nativeElement;
      host.textContent = '';
      host.classList.add('split');
      text.split(' ').forEach((w, i) => {
        const outer = document.createElement('span');
        outer.className = 'w';
        const inner = document.createElement('span');
        inner.textContent = w;
        inner.style.animationDelay = `${this.delay() + i * 70}ms`;
        outer.appendChild(inner);
        host.appendChild(outer);
        host.appendChild(document.createTextNode(' '));
      });
    });
  }
}

/** Parallax după poziția mouse-ului sau înclinarea telefonului. */
@Directive({ selector: '[cmpParallax]' })
export class PointerParallaxDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private off: (() => void)[] = [];
  ngOnInit() {
    const host = this.el.nativeElement;
    const set = (x: number, y: number) => { host.style.setProperty('--px', x.toFixed(3)); host.style.setProperty('--py', y.toFixed(3)); };
    const move = (e: PointerEvent) => set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    const orient = (e: DeviceOrientationEvent) => set(Math.max(-0.5, Math.min(0.5, (e.gamma ?? 0) / 60)), Math.max(-0.5, Math.min(0.5, ((e.beta ?? 45) - 45) / 60)));
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('deviceorientation', orient, { passive: true });
    this.off.push(() => window.removeEventListener('pointermove', move), () => window.removeEventListener('deviceorientation', orient));
  }
  ngOnDestroy() { this.off.forEach((f) => f()); }
}

/**
 * Bara de căutare „scrie singură” exemple din limba curentă (iPhone 15, Bicicletă de oraș…), ca să arate ce poți căuta.
 * Pe <input> schimbă doar textul-indiciu și se oprește cât timp scrii; pe alt element îi scrie textul.
 * Se oprește când nu e pe ecran sau tab-ul e ascuns; cu mișcare redusă / mod economic rămâne textul obișnuit.
 */
@Directive({ selector: '[cmpTyped]' })
export class TypedDirective implements OnInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private i18n = inject(I18n);
  private zone = inject(NgZone);
  /** Textul obișnuit (tradus), afișat la început, la focus și ca rezervă. */
  cmpTyped = input('');
  private timer: any;
  private visible = true;
  private io?: IntersectionObserver;
  private isInput = this.el.nativeElement instanceof HTMLInputElement;

  constructor() {
    effect(() => { const base = this.cmpTyped(); this.i18n.version(); this.write(base); this.restart(); });
  }

  ngOnInit() {
    const host = this.el.nativeElement as HTMLElement;
    this.zone.runOutsideAngular(() => {
      this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.restart(); });
      this.io.observe(host);
      if (this.isInput) {
        host.addEventListener('focus', () => { this.stop(); this.write(this.cmpTyped()); });
        host.addEventListener('blur', () => this.restart());
      }
    });
  }

  ngOnDestroy() { this.stop(); this.io?.disconnect(); }

  private quiet() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('lite');
  }

  private write(text: string) {
    const host = this.el.nativeElement as HTMLElement;
    if (this.isInput) (host as HTMLInputElement).placeholder = text; else host.textContent = text;
  }

  private stop() { clearTimeout(this.timer); this.timer = null; }

  private restart() {
    this.stop();
    if (this.quiet()) return;
    const examples = this.i18n.t('fx.examples').split('|').filter(Boolean);
    if (!examples.length || this.i18n.t('fx.examples') === 'fx.examples') return;
    let ex = Math.floor(Math.random() * examples.length), n = 0, dir = 1;
    const step = () => {
      const host = this.el.nativeElement as HTMLInputElement;
      if (!this.visible || document.hidden || (this.isInput && (document.activeElement === host || host.value))) { this.timer = setTimeout(step, 900); return; }
      const word = examples[ex];
      n += dir;
      this.write(this.i18n.t('fx.typed', { q: word.slice(0, n) }));
      let wait = dir > 0 ? 55 + Math.random() * 50 : 28;
      if (dir > 0 && n >= word.length) { dir = -1; wait = 1700; }
      else if (dir < 0 && n <= 0) { dir = 1; ex = (ex + 1) % examples.length; wait = 380; }
      this.timer = setTimeout(step, wait);
    };
    this.zone.runOutsideAngular(() => (this.timer = setTimeout(step, 2200)));
  }
}

export const MOTION = [CountDirective, ScrollFxDirective, SplitTextDirective, PointerParallaxDirective, TypedDirective];

import { Directive, ElementRef, OnDestroy, OnInit, effect, inject, input } from '@angular/core';
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

export const MOTION = [CountDirective, ScrollFxDirective, SplitTextDirective, PointerParallaxDirective];

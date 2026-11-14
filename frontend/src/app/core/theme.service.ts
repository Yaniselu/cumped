import { Injectable, signal } from '@angular/core';

export type ThemePref = 'system' | 'light' | 'dark';
export type LitePref = 'auto' | 'on' | 'off';
export type TextSize = 'normal' | 'lg' | 'xl';

/** Telefoane modeste, „Economizor de date” sau „Reduce transparența”: pornim modul economic automat. */
function lowEnd(): boolean {
  const n = navigator as any;
  return !!(n.connection?.saveData || (n.deviceMemory && n.deviceMemory <= 2) || (n.hardwareConcurrency && n.hardwareConcurrency <= 2)
    || window.matchMedia('(prefers-reduced-transparency: reduce)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

@Injectable({ providedIn: 'root' })
export class Theme {
  readonly pref = signal<ThemePref>((localStorage.getItem('cmp_theme') as ThemePref) || 'system');
  readonly dark = signal(false);
  readonly litePref = signal<LitePref>((localStorage.getItem('cmp_lite') as LitePref) || 'auto');
  readonly lite = signal(false);
  readonly textSize = signal<TextSize>((localStorage.getItem('cmp_text') as TextSize) || 'normal');
  private media = window.matchMedia('(prefers-color-scheme: dark)');

  init() {
    this.media.addEventListener('change', () => this.apply());
    this.apply();
    this.applyLite();
    this.applyText();
  }

  /** Text mai mare pentru cine citește greu (scalează toată interfața, proporțional). */
  setTextSize(t: TextSize) {
    this.textSize.set(t);
    localStorage.setItem('cmp_text', t);
    this.applyText();
  }

  private applyText() {
    const c = document.documentElement.classList;
    c.toggle('ts-lg', this.textSize() === 'lg');
    c.toggle('ts-xl', this.textSize() === 'xl');
  }

  setLite(p: LitePref) {
    this.litePref.set(p);
    localStorage.setItem('cmp_lite', p);
    this.applyLite();
  }

  private applyLite() {
    const on = this.litePref() === 'on' || (this.litePref() === 'auto' && lowEnd());
    this.lite.set(on);
    document.documentElement.classList.toggle('lite', on);
    if (on) document.documentElement.classList.remove('lg-refract');
  }

  /**
   * Schimbă tema. Dacă primește evenimentul apăsării, noua temă „se deschide” în cerc din punctul atins
   * (View Transitions), în loc să se schimbe brusc. Fără suport, în modul economic sau cu mișcare redusă: schimbare directă.
   */
  set(p: ThemePref, ev?: { clientX: number; clientY: number }) {
    this.pref.set(p);
    localStorage.setItem('cmp_theme', p);
    const willDark = p === 'dark' || (p === 'system' && this.media.matches);
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    if (willDark === this.dark() || !doc.startViewTransition || this.lite() || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.apply();
      return;
    }
    const x = ev?.clientX || innerWidth / 2, y = ev?.clientY || innerHeight / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    try {
      doc.startViewTransition(() => this.apply()).ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { duration: 720, easing: 'cubic-bezier(0.55, 0, 0.25, 1)', pseudoElement: '::view-transition-new(root)' },
        );
      }).catch(() => {});
    } catch { this.apply(); }
  }

  private apply() {
    const dark = this.pref() === 'dark' || (this.pref() === 'system' && this.media.matches);
    this.dark.set(dark);
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0a0c' : '#ececef');
  }
}

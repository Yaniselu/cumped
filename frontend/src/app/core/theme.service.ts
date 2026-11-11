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

  set(p: ThemePref) {
    this.pref.set(p);
    localStorage.setItem('cmp_theme', p);
    this.apply();
  }

  private apply() {
    const dark = this.pref() === 'dark' || (this.pref() === 'system' && this.media.matches);
    this.dark.set(dark);
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a0a0c' : '#ececef');
  }
}

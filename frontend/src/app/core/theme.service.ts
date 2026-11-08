import { Injectable, signal } from '@angular/core';

export type ThemePref = 'system' | 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class Theme {
  readonly pref = signal<ThemePref>((localStorage.getItem('cmp_theme') as ThemePref) || 'system');
  readonly dark = signal(false);
  private media = window.matchMedia('(prefers-color-scheme: dark)');

  init() {
    this.media.addEventListener('change', () => this.apply());
    this.apply();
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

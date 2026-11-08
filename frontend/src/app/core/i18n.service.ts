import { Injectable, Pipe, PipeTransform, inject, signal } from '@angular/core';
import ro from './i18n/ro';
import en from './i18n/en';

export type Lang = 'ro' | 'en' | 'de' | 'fr' | 'es' | 'it' | 'hu' | 'pl' | 'uk' | 'tr';

export const LANGUAGES: { code: Lang; name: string; flag: string }[] = [
  { code: 'ro', name: 'Română', flag: '🇷🇴' }, { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' }, { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' }, { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺' }, { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' }, { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
];

const LOADERS: Partial<Record<Lang, () => Promise<{ default: any }>>> = {
  de: () => import('./i18n/de'), fr: () => import('./i18n/fr'), es: () => import('./i18n/es'), it: () => import('./i18n/it'),
  hu: () => import('./i18n/hu'), pl: () => import('./i18n/pl'), uk: () => import('./i18n/uk'), tr: () => import('./i18n/tr'),
};

const STORAGE_KEY = 'cmp_lang';

function flatten(obj: any, prefix = '', out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out); else out[key] = String(v);
  }
  return out;
}

/**
 * Traduceri: pornește în limba dispozitivului (dacă e suportată), altfel engleză.
 * Româna și engleza sunt incluse direct; celelalte limbi se încarcă la cerere.
 */
@Injectable({ providedIn: 'root' })
export class I18n {
  private dicts: Partial<Record<Lang, Record<string, string>>> = { ro: flatten(ro), en: flatten(en) };
  private fallback = this.dicts.en!;
  readonly lang = signal<Lang>('en');
  readonly version = signal(0);

  async init() {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    await this.use(saved && this.supported(saved) ? saved : this.deviceLang());
  }

  hasChosen() { return localStorage.getItem(STORAGE_KEY) !== null; }

  deviceLang(): Lang {
    for (const l of navigator.languages ?? [navigator.language]) {
      const code = l.slice(0, 2).toLowerCase();
      if (this.supported(code)) return code as Lang;
    }
    return 'en';
  }

  async use(lang: Lang, remember = false) {
    if (!this.dicts[lang] && LOADERS[lang]) {
      try { this.dicts[lang] = flatten((await LOADERS[lang]!()).default); } catch { lang = 'en'; }
    }
    if (remember) localStorage.setItem(STORAGE_KEY, lang);
    this.lang.set(lang);
    document.documentElement.lang = lang;
    this.version.update((v) => v + 1);
  }

  t(key: string, params?: Record<string, any>): string {
    const dict = this.dicts[this.lang()] ?? this.fallback;
    let s = dict[key] ?? this.fallback[key] ?? key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }

  locale(): string {
    return ({ ro: 'ro-RO', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', hu: 'hu-HU', pl: 'pl-PL', uk: 'uk-UA', tr: 'tr-TR' } as Record<Lang, string>)[this.lang()];
  }

  price(cents: number | null | undefined, currency: string): string {
    if (cents === null || cents === undefined) return '';
    const whole = cents % 100 === 0;
    return new Intl.NumberFormat(this.locale(), { style: 'currency', currency, maximumFractionDigits: whole ? 0 : 2, minimumFractionDigits: whole ? 0 : 2 }).format(cents / 100);
  }

  date(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }) {
    return new Intl.DateTimeFormat(this.locale(), opts).format(new Date(iso));
  }

  ago(iso: string): string {
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(this.locale(), { numeric: 'auto' });
    const abs = Math.abs(diff);
    if (abs < 60) return this.t('time.now');
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
    return this.date(iso, { day: 'numeric', month: 'short' });
  }

  private supported(code: string) { return LANGUAGES.some((l) => l.code === code); }
}

@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  private i18n = inject(I18n);
  transform(key: string, params?: Record<string, any>): string {
    this.i18n.version();
    return this.i18n.t(key, params);
  }
}

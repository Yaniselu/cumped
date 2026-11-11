import { Injectable, Pipe, PipeTransform, inject, signal } from '@angular/core';
import ro from './i18n/ro';
import en from './i18n/en';
import ro2 from './i18n/ro2';
import en2 from './i18n/en2';
import ro3 from './i18n/ro3';
import en3 from './i18n/en3';

export type Lang = 'ro' | 'en' | 'de' | 'fr' | 'es' | 'it' | 'hu' | 'pl' | 'uk' | 'tr';

export const LANGUAGES: { code: Lang; name: string; flag: string }[] = [
  { code: 'ro', name: 'Română', flag: '🇷🇴' }, { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' }, { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' }, { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺' }, { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' }, { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
];

/** Fiecare limbă: dicționarul de bază + al doilea fișier (negociere, specificații, legal, raportare). */
const LOADERS: Partial<Record<Lang, () => Promise<{ default: any }[]>>> = {
  de: () => Promise.all([import('./i18n/de'), import('./i18n/de2'), import('./i18n/de3')]), fr: () => Promise.all([import('./i18n/fr'), import('./i18n/fr2'), import('./i18n/fr3')]),
  es: () => Promise.all([import('./i18n/es'), import('./i18n/es2'), import('./i18n/es3')]), it: () => Promise.all([import('./i18n/it'), import('./i18n/it2'), import('./i18n/it3')]),
  hu: () => Promise.all([import('./i18n/hu'), import('./i18n/hu2'), import('./i18n/hu3')]), pl: () => Promise.all([import('./i18n/pl'), import('./i18n/pl2'), import('./i18n/pl3')]),
  uk: () => Promise.all([import('./i18n/uk'), import('./i18n/uk2'), import('./i18n/uk3')]), tr: () => Promise.all([import('./i18n/tr'), import('./i18n/tr2'), import('./i18n/tr3')]),
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
  private dicts: Partial<Record<Lang, Record<string, string>>> = { ro: flatten(ro3, '', flatten(ro2, '', flatten(ro))), en: flatten(en3, '', flatten(en2, '', flatten(en))) };
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
      try { this.dicts[lang] = (await LOADERS[lang]!()).reduce((acc, m) => flatten(m.default, '', acc), {} as Record<string, string>); } catch { lang = 'en'; }
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

  has(key: string): boolean {
    return (this.dicts[this.lang()] ?? this.fallback)[key] !== undefined || this.fallback[key] !== undefined;
  }

  /** Eticheta unui câmp de anunț; pentru chei necunoscute (text liber din anunțuri vechi) afișăm cheia „curățată”. */
  attrLabel(key: string): string {
    if (this.has('attr.' + key)) return this.t('attr.' + key);
    const s = key.replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Valoarea unui câmp, tradusă și cu unitate: „yes” → „Da”, „256” + GB → „256 GB”, „1024” GB → „1 TB”. */
  attrValue(key: string, raw: string, unit?: string): string {
    if (raw === 'yes' || raw === 'no') return this.t('common.' + raw);
    if (this.has(`attrv.${key}.${raw}`)) return this.t(`attrv.${key}.${raw}`);
    if (/^\d+(\.\d+)?$/.test(raw)) {
      let n = Number(raw), u = unit ?? '';
      if (u === 'GB' && n >= 1024 && n % 1024 === 0) { n = n / 1024; u = 'TB'; }
      const txt = key.includes('year') || key === 'year' || key === 'vin' || key === 'isbn' || key === 'part_number' ? raw : new Intl.NumberFormat(this.locale()).format(n);
      return !u ? txt : u === '%' ? `${txt}%` : `${txt} ${u}`;
    }
    return raw;
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

// Ajutoare pentru testele cap-coadă: conturi și date create direct prin API, apoi verificate în browser.
import { createRequire } from 'node:module';
import zlib from 'node:zlib';

// Playwright e instalat global aici și local (npm i playwright) în CI; require găsește ambele variante.
const { chromium, devices } = createRequire(import.meta.url)('playwright');

export const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:4200';
export const API = process.env.E2E_API ?? 'http://127.0.0.1:8080';
export const PASSWORD = 'Parola-Sigura-2026!';

let ipSeq = Math.floor(Math.random() * 200);
/** Fiecare „utilizator” de test vine de pe alt IP (prin proxy-ul local de încredere), ca limitele să nu se amestece. */
const nextIp = () => `198.19.${Math.floor(Math.random() * 250)}.${(ipSeq = (ipSeq % 250) + 1)}`;

export async function api(path, { method = 'GET', body, token, ip } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), 'X-Forwarded-For': ip ?? nextIp() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* nu e JSON */ }
  return { status: r.status, body: json };
}

export async function register(prefix = 'e2e') {
  const sfx = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const email = `${prefix}_${sfx}@test.dev`;
  const ip = nextIp();
  const r = await api('/api/auth/register', { method: 'POST', ip, body: {
    email, password: PASSWORD, username: `${prefix}_${sfx}`.slice(0, 20), country: 'RO', locale: 'ro',
    acceptTerms: true, adultConfirmed: true, website: '', elapsedMs: 6000 } });
  if (r.status !== 201) throw new Error('register ' + r.status + ' ' + JSON.stringify(r.body));
  return { email, token: r.body.accessToken, id: r.body.user.id, ip };
}

export async function listing(user, title, priceCents, currency = 'RON') {
  const r = await api('/api/listings', { method: 'POST', token: user.token, ip: user.ip, body: {
    title, description: 'Produs original, în stare foarte bună, cu factură. Trimit oriunde în țară prin curier.',
    category: 'FASHION', condition: 'LIKE_NEW', priceCents, currency, country: 'RO', city: 'Cluj-Napoca', shipsTo: ['RO'],
    acceptsOffers: true, acceptsSwap: false } });
  if (r.status !== 201 && r.status !== 200) throw new Error('listing ' + r.status + ' ' + JSON.stringify(r.body));
  return r.body.id;
}

export const ADDRESS = { name: 'Ana Pop', address: 'Str. Florilor 3', city: 'Iași', postcode: '700000', country: 'RO', phone: '+40 733 111 222' };

export async function browser() { return chromium.launch(); }
/** Chromium complet (nu varianta „headless shell”): necesar pentru permisiunea de notificări. */
export async function browserFull() { return chromium.launch({ channel: 'chromium' }); }

/** Context de telefon (iPhone 14), fără ecranul de pornire și fără onboarding. */
export async function phone(b, opts = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 14'], locale: 'ro-RO', ...opts });
  await ctx.addInitScript(() => { sessionStorage.setItem('cmp_splash', '1'); localStorage.setItem('cmp_onboarded', '1'); localStorage.setItem('cmp_lang', 'ro'); });
  return ctx;
}

export async function login(page, user) {
  await page.goto(BASE + '/login');
  await page.fill('#l-email', user.email);
  await page.fill('#l-pass', PASSWORD);
  await page.click('page-login form button.btn.block');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 10000 });
}

/** O poză PNG validă (culoare plină), generată în memorie. */
export function png(w = 96, h = 96, rgb = [Math.random() * 255, 120, 200]) {
  const crc = (buf) => { let c, k = -1; for (const b of buf) { c = (k ^ b) & 0xff; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; k = (k >>> 8) ^ c; } return (k ^ -1) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.alloc(1 + w * 3); for (let x = 0; x < w; x++) row.set(rgb.map((v) => Math.round(v)), 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Fișier pentru <input type=file>. */
export const photo = (name) => ({ name, mimeType: 'image/png', buffer: png() });

/** Pagina Ionic vizibilă acum (celelalte rămân în DOM, ascunse). */
export const active = (page, sel) => page.locator(`.ion-page:not(.ion-page-hidden) ${sel}`);

/** Așteaptă până când o condiție devine adevărată (UI-ul se actualizează asincron). */
export async function until(fn, ms = 4000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) { last = await fn(); if (last) return last; await new Promise((r) => setTimeout(r, 60)); }
  return last;
}

/**
 * Ecrane reale, la mărimea întreagă (aplicația rulează pe tot ecranul, fără bara browserului),
 * cu zonele sigure: notch / Dynamic Island sus, bara de gesturi jos, laturile în landscape.
 */
export const DEVICES = [
  { name: 'iPhone SE (1)', w: 320, h: 568, dpr: 2 },
  { name: 'Android mic', w: 360, h: 640, dpr: 2, inset: { top: 24 } },
  { name: 'iPhone SE', w: 375, h: 667, dpr: 2, inset: { top: 20 } },
  { name: 'Galaxy S8', w: 360, h: 740, dpr: 3, inset: { top: 24, bottom: 16 } },
  { name: 'iPhone 13 mini', w: 375, h: 812, dpr: 3, inset: { top: 50, bottom: 34 } },
  { name: 'iPhone 15', w: 393, h: 852, dpr: 3, inset: { top: 59, bottom: 34 } },
  { name: 'Pixel 8', w: 412, h: 915, dpr: 2.6, inset: { top: 32, bottom: 24 } },
  { name: 'iPhone 15 Pro Max', w: 430, h: 932, dpr: 3, inset: { top: 59, bottom: 34 } },
  { name: 'Galaxy Z Fold închis', w: 344, h: 882, dpr: 3, inset: { top: 24, bottom: 16 } },
  { name: 'Galaxy Z Fold deschis', w: 673, h: 841, dpr: 2.6, inset: { top: 24, bottom: 16 } },
  { name: 'iPhone 15 landscape', w: 852, h: 393, dpr: 3, inset: { left: 59, right: 59, bottom: 21 } },
  { name: 'iPhone SE landscape', w: 667, h: 375, dpr: 2 },
  { name: 'iPad mini', w: 744, h: 1133, dpr: 2, inset: { top: 24, bottom: 20 }, tablet: true },
  { name: 'iPad Pro 12.9', w: 1024, h: 1366, dpr: 2, inset: { top: 24, bottom: 20 }, tablet: true },
  { name: 'Laptop', w: 1280, h: 720, dpr: 1, desktop: true },
  { name: 'Desktop', w: 1440, h: 900, dpr: 1, desktop: true },
  { name: 'iPhone SE text foarte mare', w: 375, h: 667, dpr: 2, inset: { top: 20 }, text: 'xl' },
  { name: 'Galaxy S8 întunecat + text mare', w: 360, h: 740, dpr: 3, inset: { top: 24, bottom: 16 }, text: 'lg', dark: true },
];

/** Context pentru un dispozitiv: ecran complet, zone sigure emulate, IP propriu (limite separate). */
export async function deviceContext(b, d, { shots = false } = {}) {
  const mobile = !d.desktop;
  const ip = `198.20.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
  const ctx = await b.newContext({
    viewport: { width: d.w, height: d.h }, deviceScaleFactor: shots ? (d.tablet || d.desktop ? 1 : Math.min(d.dpr, 2)) : 1, isMobile: mobile && !d.tablet ? true : mobile,
    hasTouch: mobile, locale: 'ro-RO', colorScheme: d.dark ? 'dark' : 'light', extraHTTPHeaders: { 'X-Forwarded-For': ip },
  });
  await ctx.addInitScript((d) => {
    sessionStorage.setItem('cmp_splash', '1'); localStorage.setItem('cmp_onboarded', '1'); localStorage.setItem('cmp_lang', 'ro');
    if (d.text) localStorage.setItem('cmp_text', d.text);
    if (d.dark) localStorage.setItem('cmp_theme', 'dark');
  }, d);
  ctx.on('page', (p) => applyInsets(p, d));
  return ctx;
}

export async function applyInsets(page, d) {
  if (!d.inset) return;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: 0, left: 0, right: 0, ...d.inset } }).catch(() => {});
}

/** Autentificare prin API în contextul browserului (cookie-ul de sesiune rămâne în context). */
export async function apiLogin(ctx, user) {
  const r = await ctx.request.post(BASE + '/api/auth/login', { data: { email: user.email, password: PASSWORD }, headers: { 'Content-Type': 'application/json' } });
  if (r.status() !== 200) throw new Error('login ' + r.status() + ' ' + (await r.text()));
}

// Alerte: invitația de pe pagina principală, secțiunea din Setări, categoriile și service worker-ul pentru push.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, active, api, apiLogin, browser, browserFull, phone, register, until } from './helpers.mjs';

describe('alerte', () => {
  let b;
  before(async () => { b = await browser(); });
  after(async () => { await b.close(); });

  it('invitația de alerte apare o dată, iar „Mai târziu” o ascunde', async () => {
    const full = await browserFull();
    const me = await register('alh');
    // browserul permite notificările (în headless sunt blocate implicit), dar încă nu e abonat
    const ctx = await phone(full, { extraHTTPHeaders: { 'X-Forwarded-For': me.ip } });
    await ctx.grantPermissions(['notifications'], { origin: BASE });
    await apiLogin(ctx, me);
    const page = await ctx.newPage();
    await page.goto(BASE + '/home');
    const card = active(page, '.pushask');
    await card.waitFor({ timeout: 8000 });
    await card.locator('button.ghost').click();
    assert.equal(await until(async () => (await active(page, '.pushask').count()) === 0), true);
    await page.reload();
    await page.waitForTimeout(1500);
    assert.equal(await active(page, '.pushask').count(), 0, 'nu mai apare imediat după „Mai târziu”');
    await ctx.close();
    await full.close();
  });

  it('dacă notificările sunt blocate, invitația nu apare deloc (nici o clipă)', async () => {
    const me = await register('ald');
    const ctx = await phone(b, { extraHTTPHeaders: { 'X-Forwarded-For': me.ip } });
    await apiLogin(ctx, me);
    const page = await ctx.newPage();
    let seen = false;
    await page.exposeFunction('cardSeen', () => { seen = true; });
    await page.addInitScript(() => new MutationObserver(() => { if (document.querySelector('.pushask')) (window).cardSeen(); }).observe(document, { childList: true, subtree: true }));
    await page.goto(BASE + '/home');
    await page.waitForTimeout(3500);
    assert.equal(seen, false);
    await page.goto(BASE + '/settings');
    await page.waitForSelector('#alerts');
    assert.ok(await until(async () => (await active(page, '.warnline').count()) === 1), 'explică cum se deblochează');
    await ctx.close();
  });

  it('Setări → Alerte: service worker-ul e înregistrat, categoriile se salvează', async () => {
    const me = await register('als');
    const ctx = await phone(b, { extraHTTPHeaders: { 'X-Forwarded-For': me.ip } });
    await apiLogin(ctx, me);
    const page = await ctx.newPage();
    await page.goto(BASE + '/settings');
    await page.waitForSelector('#alerts');
    // service worker-ul pentru push e servit de pe același domeniu și înregistrat
    assert.ok(await until(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/'))), 6000), 'service worker înregistrat');
    const sw = await page.request.get(BASE + '/push-sw.js');
    assert.equal(sw.status(), 200);
    assert.match(await sw.text(), /showNotification/);
    // categoriile: oprim „Comenzi și plăți”, se păstrează după reîncărcare
    const orders = active(page, '.toggle-row:has-text("Comenzi și plăți") .switch');
    await orders.waitFor();
    assert.equal(await orders.getAttribute('aria-checked'), 'true');
    await orders.click();
    assert.equal(await until(async () => (await orders.getAttribute('aria-checked')) === 'false'), true);
    const prefs = await api('/api/me/notification-prefs', { token: me.token, ip: me.ip });
    assert.equal(prefs.body.orders, false);
    // securitatea nu se poate opri
    assert.equal(await active(page, '.toggle-row:has-text("Securitate") .switch').isDisabled(), true);
    await ctx.close();
  });
});

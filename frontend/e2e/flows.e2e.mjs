// Fluxuri reale în browser: chat instant, protecția vânzătorului la dispute, recenzii verificate.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ADDRESS, BASE, active, api, browser, listing, login, phone, photo, register } from './helpers.mjs';

const SHOTS = process.env.E2E_SHOTS; // dacă e setat, salvăm capturi de ecran acolo

describe('fluxuri', () => {
  let b;
  before(async () => { b = await browser(); });
  after(async () => { await b.close(); });

  it('chat: mesajul apare imediat, iar dacă nu pleacă poate fi retrimis', async () => {
    const seller = await register('chs'), buyer = await register('chb');
    const l = await listing(seller, 'Geacă de piele maro', 35000);
    const conv = (await api('/api/conversations', { method: 'POST', token: buyer.token, ip: buyer.ip, body: { listingId: l } })).body.id;
    const ctx = await phone(b);
    const page = await ctx.newPage();
    await login(page, buyer);
    await page.goto(BASE + '/chat/' + conv);
    await page.waitForSelector('textarea[name=text]');

    // serverul răspunde încet: mesajul e deja pe ecran, cu „Se trimite…”
    await page.route('**/api/conversations/*/messages', async (r) => { await new Promise((res) => setTimeout(res, 1500)); await r.continue(); });
    await page.fill('textarea[name=text]', 'Bună! Mai e disponibilă?');
    await page.click('.sendbtn');
    await page.waitForSelector('.msg.mine.pending', { timeout: 500 });
    assert.match(await page.locator('.msg.mine.pending .time').textContent(), /Se trimite/);
    await page.waitForSelector('.msg.mine:not(.pending):not(.failed) .bubble:has-text("Mai e disponibilă")', { timeout: 5000 });
    await page.unroute('**/api/conversations/*/messages');

    // fără internet: mesajul e marcat și se poate retrimite
    await page.route('**/api/conversations/*/messages', (r) => r.abort());
    await page.fill('textarea[name=text]', 'Pot veni mâine?');
    await page.click('.sendbtn');
    await page.waitForSelector('.msg.mine.failed', { timeout: 5000 });
    await page.unroute('**/api/conversations/*/messages');
    await page.click('.msg.failed .retry');
    await page.waitForSelector('.msg.mine:not(.failed) .bubble:has-text("Pot veni mâine")', { timeout: 5000 });
    assert.equal(await page.locator('.msg.failed').count(), 0);
    await ctx.close();
  });

  it('protecția vânzătorului: dovezi la expediere, reclamația cere poze și serie', async () => {
    const seller = await register('sps'), buyer = await register('spb');
    const l = await listing(seller, 'Geacă de iarnă premium', 60000, 'EUR');
    const order = await api(`/api/listings/${l}/orders`, { method: 'POST', token: buyer.token, ip: buyer.ip, body: { delivery: 'COURIER', address: ADDRESS } });
    assert.equal(order.status, 201);
    const id = order.body.id;

    // vânzătorul: peste 300 € pozele sunt obligatorii, butonul e blocat până le adaugă
    const sctx = await phone(b, SHOTS ? { deviceScaleFactor: 2 } : {});
    const sp = await sctx.newPage();
    await login(sp, seller);
    await sp.goto(BASE + '/orders/' + id);
    await sp.waitForSelector('#awb');
    await sp.fill('#awb', 'FAN123456789');
    await sp.selectOption('#carrier', 'FAN_COURIER');
    const shipBtn = active(sp, 'button:has-text("Am expediat coletul")');
    assert.equal(await shipBtn.isDisabled(), true, 'fără poze nu se poate marca expedierea');
    await active(sp, 'cmp-evidence-photos input[type=file]').setInputFiles([photo('produs.png'), photo('colet.png')]);
    await sp.waitForFunction(() => document.querySelectorAll('.ion-page:not(.ion-page-hidden) cmp-evidence-photos .ph:not(.up)').length === 2, null, { timeout: 10000 });
    await sp.fill('#serial', 'jkt-600-abcd');
    await sp.fill('#weight', '1450');
    if (SHOTS) await sp.screenshot({ path: SHOTS + '/seller-ship.png', fullPage: false });
    assert.equal(await shipBtn.isDisabled(), false);
    await shipBtn.click();
    await sp.waitForSelector('.evd .pics img', { timeout: 8000 });
    assert.match(await active(sp, '.evd').first().textContent(), /JKT600ABCD/);

    // cumpărătorul: „nu e ca în anunț” cere 2 poze și seria de pe produsul primit
    const bctx = await phone(b, SHOTS ? { deviceScaleFactor: 2 } : {});
    const bp = await bctx.newPage();
    await login(bp, buyer);
    await bp.goto(BASE + '/orders/' + id);
    await active(bp, 'button:has-text("Am o problemă")').click();
    await bp.waitForSelector('ion-modal .opt');
    await bp.click('ion-modal .opt:has-text("Nu e cum scria")');
    await bp.fill('ion-modal textarea', 'Am primit o altă geacă, mai ieftină, nu cea din poze.');
    const send = bp.locator('ion-modal button:has-text("Trimite sesizarea")');
    assert.equal(await send.isDisabled(), true, 'fără poze nu se poate trimite');
    await bp.locator('ion-modal cmp-evidence-photos input[type=file]').setInputFiles([photo('a.png'), photo('b.png')]);
    await bp.waitForFunction(() => document.querySelectorAll('ion-modal cmp-evidence-photos .ph:not(.up)').length === 2, null, { timeout: 10000 });
    assert.equal(await send.isDisabled(), true, 'fără serie nu se poate trimite');
    await bp.fill('#dserial', 'JKT-600-ABCD');
    // foaia se deschide la 85%; utilizatorul o trage în sus ca să vadă butonul (aici o deschidem complet din cod)
    await bp.locator('ion-modal').evaluate((m) => m.setCurrentBreakpoint(1));
    await bp.waitForTimeout(400);
    if (SHOTS) await bp.screenshot({ path: SHOTS + '/buyer-dispute.png' });
    await send.click();
    await bp.waitForSelector('.ion-page:not(.ion-page-hidden) .flag.ok', { timeout: 8000 });
    assert.match(await active(bp, '.flag.ok').textContent(), /se potrivește/);
    assert.match(await active(bp, '.hero').textContent(), /problema/i);

    // pozele-dovadă se încarcă doar prin link semnat
    const src = await active(bp, '.evd .pics img').first().getAttribute('src');
    assert.match(src, /sig=/);
    const plain = src.replace(/\?.*$/, '');
    assert.equal((await fetch(API_URL(plain))).status, 404);

    // vânzătorul vede formularul de răspuns
    await sp.goto(BASE + '/orders/' + id);
    await sp.waitForSelector('textarea');
    assert.ok(await active(sp, 'h3:has-text("Răspunde la reclamație")').isVisible());
    if (SHOTS) await sp.screenshot({ path: SHOTS + '/seller-respond.png' });
    await sctx.close();
    await bctx.close();
  });

  it('recenzie doar după comandă finalizată, afișată cu „Cumpărare verificată”', async () => {
    const seller = await register('rvs'), buyer = await register('rvb');
    const l = await listing(seller, 'Rucsac de munte 40L', 25000);
    const id = (await api(`/api/listings/${l}/orders`, { method: 'POST', token: buyer.token, ip: buyer.ip, body: { delivery: 'PICKUP' } })).body.id;
    // înainte de finalizare: refuzat
    assert.equal((await api('/api/reviews', { method: 'POST', token: buyer.token, ip: buyer.ip, body: { orderId: id, rating: 5 } })).body.error, 'NO_TRANSACTION');
    await api(`/api/orders/${id}/ship`, { method: 'POST', token: seller.token, ip: seller.ip, body: {} });
    await api(`/api/orders/${id}/confirm`, { method: 'POST', token: buyer.token, ip: buyer.ip, body: {} });

    const ctx = await phone(b);
    const page = await ctx.newPage();
    await login(page, buyer);
    await page.goto(BASE + '/orders/' + id);
    await page.waitForSelector('.review .stars button');
    await page.locator('.review .stars button').nth(4).click();
    await page.fill('.review textarea', 'Exact ca în poze, predare rapidă.');
    await page.click('.review button.btn.block');
    await page.waitForSelector('.review', { state: 'detached', timeout: 5000 });
    await page.goto(BASE + '/user/' + seller.id);
    await page.waitForSelector('.rev .vp');
    assert.match(await page.locator('.rev .vp').first().textContent(), /Cumpărare verificată/);
    await ctx.close();
  });
});

const API_URL = (path) => (process.env.E2E_API ?? 'http://127.0.0.1:8080') + path;

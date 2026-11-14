// Ferestrele care se deschid de jos (ofertă, plată, alertă de preț, filtre, reclamație) pe telefoanele cele mai
// mici, cu text mare și în landscape: totul încape, iar butonul de la final se poate apăsa după ce tragi fereastra în sus.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, DEVICES, api, apiLogin, applyInsets, browser, deviceContext, listing, register } from './helpers.mjs';
import { auditModal } from './audit.mjs';

const PICK = ['iPhone SE (1)', 'iPhone SE landscape', 'iPhone 15', 'Galaxy Z Fold închis', 'iPhone SE text foarte mare', 'iPad mini'];

describe('ferestre de jos pe ecrane mici', () => {
  let b, data;
  before(async () => {
    b = await browser();
    const seller = await register('shs'), me = await register('shb');
    const l = await listing(seller, 'Bicicletă de oraș cu 7 viteze', 120000);
    const l2 = await listing(seller, 'Lampă de birou cu braț articulat', 9000);
    const order = (await api(`/api/listings/${l2}/orders`, { method: 'POST', token: me.token, ip: me.ip, body: { delivery: 'PICKUP' } })).body.id;
    data = { me, listing: l, order };
  });
  after(async () => { await b?.close(); });

  for (const d of DEVICES.filter((x) => PICK.includes(x.name))) {
    it(`${d.name} (${d.w}×${d.h})`, async () => {
      const ctx = await deviceContext(b, d);
      const page = await ctx.newPage();
      await applyInsets(page, d);
      await apiLogin(ctx, data.me);
      const problems = [];
      const sheet = async (label, open) => {
        await open();
        await page.waitForSelector('ion-modal.show-modal ion-content', { timeout: 6000 });
        await page.waitForTimeout(700);
        // utilizatorul trage fereastra în sus și derulează până jos
        await page.evaluate(async () => {
          const ms = [...document.querySelectorAll('ion-modal.show-modal')];
          const m = ms[ms.length - 1];
          if (m.breakpoints?.length) await m.setCurrentBreakpoint(1).catch(() => {});
          await new Promise((r) => setTimeout(r, 450));
          await m.querySelector('ion-content')?.scrollToBottom(0);
        });
        await page.waitForTimeout(450);
        for (const p of await page.evaluate(auditModal)) problems.push(`${label}: ${p}`);
        await page.evaluate(() => { const ms = [...document.querySelectorAll('ion-modal.show-modal')]; return ms[ms.length - 1]?.dismiss(); });
        await page.waitForTimeout(500);
      };
      const visible = (sel) => page.locator(`.ion-page:not(.ion-page-hidden) ${sel}`).first();

      await page.goto(BASE + '/listing/' + data.listing);
      await page.waitForSelector('.actionbar .btn.accent');
      await sheet('ofertă', () => visible('.actionbar .btn.light').click());
      await sheet('plată sigură', () => visible('.actionbar .btn.accent').click());
      await sheet('alertă de preț', () => visible('button:has-text("Anunță-mă")').click());
      await page.goto(BASE + '/search');
      await sheet('filtre', () => visible('button[aria-label="Filtre"]').click());
      await page.goto(BASE + '/orders/' + data.order);
      await sheet('reclamație', async () => {
        await visible('button:has-text("Am o problemă")').click();
        await page.waitForSelector('ion-modal .opt');
        await page.click('ion-modal .opt:has-text("Nu e cum scria")');
      });
      await ctx.close();
      assert.deepEqual(problems, [], `${d.name}:\n  ` + problems.join('\n  '));
    });
  }
});

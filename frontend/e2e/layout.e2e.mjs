// Afișare pe ecrane reale: fiecare pagină, pe telefoane mici și mari, cu notch, în landscape, pe tabletă, desktop,
// cu text mărit și în modul întunecat. Caută: scroll orizontal, text tăiat, butoane suprapuse, conținut sub notch,
// sub bara de jos sau sub bara de gesturi, câmpuri care fac zoom pe iPhone, imagini lipsă, erori JavaScript.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ADDRESS, BASE, DEVICES, api, apiLogin, applyInsets, browser, deviceContext, listing, register } from './helpers.mjs';
import { auditBottom, auditTop } from './audit.mjs';

const SHOTS = process.env.E2E_SHOTS;
const ONLY = process.env.E2E_DEVICES ? process.env.E2E_DEVICES.split(',') : null; // ex. E2E_DEVICES="iPhone SE,Desktop"

describe('afișare pe toate ecranele', () => {
  let b, data;
  before(async () => {
    b = await browser();
    const seller = await register('lys'), me = await register('lyb');
    const l = await listing(seller, 'Geacă de piele, mărimea M', 45000);
    const conv = (await api('/api/conversations', { method: 'POST', token: me.token, ip: me.ip, body: { listingId: l } })).body.id;
    await api(`/api/conversations/${conv}/messages`, { method: 'POST', token: me.token, ip: me.ip, body: { body: 'Bună! Mai e disponibilă geaca? Pot veni s-o văd mâine după-amiază.' } });
    const l2 = await listing(seller, 'Cizme de iarnă din piele întoarsă, mărimea 39', 32000);
    const order = (await api(`/api/listings/${l2}/orders`, { method: 'POST', token: me.token, ip: me.ip, body: { delivery: 'COURIER', address: ADDRESS } })).body.id;
    data = { seller, me, listing: l, conv, order };
  });
  after(async () => { await b?.close(); });

  const publicPages = () => ['/welcome', '/home', '/search', `/listing/${data.listing}`, `/user/${data.seller.id}`, '/login', '/register', '/why', '/plans', '/legal/terms'];
  const privatePages = () => ['/profile', '/sell', '/chats', `/chat/${data.conv}`, '/offers', '/orders', `/orders/${data.order}`, '/favorites',
    '/notifications', '/settings', '/stats', '/my-listings', '/verify', '/support', `/listing/${data.listing}`];

  for (const d of DEVICES) {
    if (ONLY && !ONLY.includes(d.name)) continue;
    it(`${d.name} (${d.w}×${d.h})`, async () => {
      const ctx = await deviceContext(b, d, { shots: !!SHOTS });
      const page = await ctx.newPage();
      await applyInsets(page, d);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
      const problems = [];
      let loggedIn = false;
      const check = async (path) => {
        await page.goto(BASE + path);
        await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(900);
        const slug = path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, 'id').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') + (loggedIn ? '' : '-anonim');
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${d.name.replace(/[^a-z0-9]+/gi, '_')}__${slug}.png`, timeout: 60000, animations: 'disabled' });
        for (const p of await page.evaluate(auditTop)) problems.push(`${path}: ${p}`);
        // derulăm până jos de mai multe ori: listele încarcă pagini noi când ajungi la capăt
        let last = -1;
        for (let i = 0; i < 6; i++) {
          const h = await page.evaluate(async () => {
            const cs = [...document.querySelectorAll('ion-router-outlet > .ion-page:not(.ion-page-hidden) ion-content')];
            const c = cs[cs.length - 1];
            if (!c) return 0;
            await c.scrollToBottom(0);
            return (await c.getScrollElement()).scrollHeight;
          });
          await page.waitForTimeout(450);
          if (h === last) break;
          last = h;
        }
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${d.name.replace(/[^a-z0-9]+/gi, '_')}__${slug}__jos.png`, timeout: 60000, animations: 'disabled' });
        for (const p of await page.evaluate(auditBottom)) problems.push(`${path} (jos): ${p}`);
      };
      for (const path of publicPages()) await check(path);
      await apiLogin(ctx, data.me);
      loggedIn = true;
      for (const path of privatePages()) await check(path);
      await ctx.close();
      const all = [...problems, ...errors.map((e) => 'eroare JS: ' + e)];
      if (SHOTS) fs.writeFileSync(`${SHOTS}/${d.name.replace(/[^a-z0-9]+/gi, '_')}__probleme.txt`, all.join('\n'));
      assert.deepEqual(all, [], `${d.name}:\n  ` + all.join('\n  '));
    });
  }
});

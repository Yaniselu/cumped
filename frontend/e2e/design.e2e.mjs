// Design și accesibilitate: fără scroll orizontal pe telefoane mici, ținte de atingere, etichete, tipografie, combobox.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, active, browser, phone, until } from './helpers.mjs';

const PAGES = ['/home', '/search', '/login', '/register', '/why', '/legal/terms', '/legal/privacy'];

describe('design', () => {
  let b;
  before(async () => { b = await browser(); });
  after(async () => { await b.close(); });

  it('nu apare scroll orizontal la 320, 375, 768 și 1280 px', async () => {
    for (const width of [320, 375, 768, 1280]) {
      const ctx = await phone(b, { viewport: { width, height: 800 }, isMobile: width < 768, hasTouch: width < 768, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      for (const path of PAGES) {
        await page.goto(BASE + path);
        await page.waitForTimeout(900);
        const over = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth;
          const bad = [...document.querySelectorAll('.ion-page:not(.ion-page-hidden) *')].filter((el) => {
            const r = el.getBoundingClientRect();
            const st = getComputedStyle(el);
            if (!r.width || st.position === 'fixed' || el.closest('.hscroll, .lb, ion-modal, [aria-hidden=true], .hp')) return false;
            return r.right > vw + 1;
          });
          return bad.slice(0, 3).map((el) => el.tagName.toLowerCase() + '.' + [...el.classList].join('.'));
        });
        assert.deepEqual(over, [], `${path} @${width}px iese din ecran: ${over.join(', ')}`);
      }
      await ctx.close();
    }
  });

  it('butoanele au zonă de atingere de cel puțin 44 px (WCAG 2.5.5) și minimum 24 px pentru orice control', async () => {
    const ctx = await phone(b);
    const page = await ctx.newPage();
    for (const path of ['/home', '/search', '/login', '/register']) {
      await page.goto(BASE + path);
      await page.waitForTimeout(1200);
      const problems = await page.evaluate(() => {
        const out = [];
        const els = [...document.querySelectorAll('.ion-page:not(.ion-page-hidden) :is(button, a[href], [role=button], select, .chip), cmp-tab-bar a, cmp-tab-bar button')];
        for (const el of els) {
          const r = el.getBoundingClientRect();
          const st = getComputedStyle(el);
          if (!r.width || !r.height || st.visibility === 'hidden' || el.closest('[aria-hidden=true], .hp, p, li, .foot')) continue;
          if (r.bottom < 0 || r.top > innerHeight) continue;
          if (r.width < 24 || r.height < 24) { out.push(`${el.tagName} ${el.className} ${Math.round(r.width)}x${Math.round(r.height)} < 24`); continue; }
          if (el.matches('.btn, .icon-btn, .chip, cmp-tab-bar *')) {
            // zona efectivă (inclusiv extinderea invizibilă ::after): punctele aflate la 21 px de centru trebuie să nimerească butonul
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            for (const [dx, dy] of [[0, -21], [0, 21], [-21, 0], [21, 0]]) {
              const x = cx + (Math.abs(dx) > r.width / 2 ? dx : Math.sign(dx) * Math.min(Math.abs(dx), r.width / 2 - 1));
              const y = cy + (Math.abs(dy) > r.height / 2 ? dy : Math.sign(dy) * Math.min(Math.abs(dy), r.height / 2 - 1));
              if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
              const hit = document.elementFromPoint(x, y);
              if (hit && !el.contains(hit) && !hit.contains(el)) { out.push(`${el.tagName}.${[...el.classList].join('.')} zonă < 44px (${dx},${dy}) → ${hit.tagName}.${hit.className}`); break; }
            }
          }
        }
        return out.slice(0, 6);
      });
      assert.deepEqual(problems, [], `${path}: ${problems.join(' | ')}`);
    }
    await ctx.close();
  });

  it('câmpurile au etichete, imaginile au alt, pagina are limba setată', async () => {
    const ctx = await phone(b);
    const page = await ctx.newPage();
    for (const path of ['/login', '/register', '/search', '/home']) {
      await page.goto(BASE + path);
      await page.waitForTimeout(1000);
      const bad = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('.ion-page:not(.ion-page-hidden) :is(input, select, textarea)')) {
          if (el.type === 'hidden' || el.closest('.hp') || el.type === 'checkbox') continue;
          const named = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label') || el.getAttribute('placeholder');
          if (!named) out.push('fără etichetă: ' + (el.name || el.outerHTML.slice(0, 60)));
        }
        for (const img of document.querySelectorAll('.ion-page:not(.ion-page-hidden) img')) if (!img.hasAttribute('alt')) out.push('img fără alt: ' + img.src.slice(-40));
        for (const btn of document.querySelectorAll('.ion-page:not(.ion-page-hidden) button')) {
          if (!btn.textContent.trim() && !btn.getAttribute('aria-label') && !btn.closest('[aria-hidden=true]')) out.push('buton fără nume: ' + btn.outerHTML.slice(0, 80));
        }
        if (!document.documentElement.lang) out.push('lipsește <html lang>');
        return out.slice(0, 5);
      });
      assert.deepEqual(bad, [], `${path}: ${bad.join(' | ')}`);
    }
    await ctx.close();
  });

  it('tipografie: cifre tabelare la prețuri, titluri echilibrate, kerning activ, linkuri subliniate în text', async () => {
    const ctx = await phone(b);
    const page = await ctx.newPage();
    await page.goto(BASE + '/search');
    await page.waitForSelector('cmp-listing-card .price');
    const t = await page.evaluate(() => {
      const price = getComputedStyle(document.querySelector('cmp-listing-card .price'));
      const body = getComputedStyle(document.body);
      return { nums: price.fontVariantNumeric, kern: body.fontKerning, feat: body.fontFeatureSettings };
    });
    assert.match(t.nums, /tabular-nums/);
    assert.equal(t.kern, 'normal');
    await page.goto(BASE + '/register');
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const h1 = getComputedStyle(document.querySelector('.ion-page:not(.ion-page-hidden) h1'));
      const a = document.querySelector('.ion-page:not(.ion-page-hidden) .consent a');
      return { wrap: h1.textWrap || h1.textWrapStyle || '', underline: getComputedStyle(a).textDecorationLine };
    });
    assert.match(r.wrap, /balance/);
    assert.match(r.underline, /underline/);
    await ctx.close();
  });

  it('textul lung nu depășește ~68 de caractere pe rând pe desktop', async () => {
    const ctx = await phone(b, { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(BASE + '/legal/terms');
    await page.waitForTimeout(1200);
    const widest = await page.evaluate(() => {
      const p = [...document.querySelectorAll('.ion-page:not(.ion-page-hidden) p')].filter((x) => x.textContent.length > 200)[0];
      const ch = parseFloat(getComputedStyle(p).fontSize) * 0.5;
      return p.getBoundingClientRect().width / ch;
    });
    assert.ok(widest <= 80, `rândul are ~${Math.round(widest)} caractere`);
    await ctx.close();
  });

  it('căutarea e un combobox accesibil: sugestii, ↑ ↓, Enter, Esc', async () => {
    const ctx = await phone(b);
    const page = await ctx.newPage();
    await page.goto(BASE + '/search');
    const box = active(page, 'input[role=combobox]');
    await box.click();
    await box.fill('ip');
    await page.waitForSelector('#search-listbox [role=option]', { timeout: 5000 });
    assert.equal(await box.getAttribute('aria-expanded'), 'true');
    await box.press('ArrowDown');
    const id = await until(() => box.getAttribute('aria-activedescendant'));
    assert.ok(id, 'aria-activedescendant setat');
    assert.equal(await page.locator('#' + id).getAttribute('aria-selected'), 'true');
    const chosen = (await page.locator('#' + id + ' .t').textContent()).trim();
    await box.press('Enter');
    assert.equal(await until(async () => (await box.getAttribute('aria-expanded')) === 'false'), true);
    assert.equal(await box.inputValue(), chosen);
    // căutarea apare apoi la „recente”
    await box.fill('');
    await box.press('ArrowDown');
    await page.waitForSelector('#search-listbox [role=option]');
    assert.ok((await page.locator('#search-listbox').textContent()).includes(chosen));
    await box.press('Escape');
    assert.equal(await until(async () => (await box.getAttribute('aria-expanded')) === 'false'), true);
    await ctx.close();
  });

  it('formularul de cont are câmp-capcană invizibil pentru roboți', async () => {
    const ctx = await phone(b);
    const page = await ctx.newPage();
    await page.goto(BASE + '/register');
    await page.waitForTimeout(800);
    const hp = active(page, 'input[name=website]');
    assert.equal(await hp.getAttribute('tabindex'), '-1');
    const box = await hp.boundingBox();
    assert.ok(!box || box.x + box.width < 0 || box.width <= 1, 'câmpul-capcană nu e vizibil');
    await ctx.close();
  });
});

// Verificări de afișare rulate în pagină. Întoarce o listă de probleme (text scurt), goală dacă totul e în regulă.

/** Partea 1: pagina la început (scroll 0). */
export function auditTop() {
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:env(safe-area-inset-top);bottom:env(safe-area-inset-bottom);left:env(safe-area-inset-left);right:env(safe-area-inset-right);pointer-events:none;visibility:hidden';
  document.body.appendChild(probe);
  const sa = probe.getBoundingClientRect();
  probe.remove();
  const safe = { top: sa.top, bottom: vh - sa.bottom, left: sa.left, right: vw - sa.right };
  const pages = [...document.querySelectorAll('ion-router-outlet > .ion-page:not(.ion-page-hidden)')];
  const root = pages[pages.length - 1] ?? document.body;
  const out = [];
  const name = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter((c) => !c.startsWith('ng-') && !c.startsWith('ion-') && c !== 'hydrated').slice(0, 2).join('.') : '';
    const txt = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '') + (txt ? ` "${txt}"` : '');
  };
  const visible = (el) => {
    if (el.closest('[aria-hidden=true], .hp, .ion-page-hidden, ion-modal, .lb, ion-refresher')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.05) return false;
    }
    return true;
  };
  // straturi separate: elemente fixe / lipite sus, plus antetul și subsolul paginii (conținutul derulează pe sub ele)
  const fixedAncestor = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky' || e.tagName === 'ION-FOOTER' || e.tagName === 'ION-HEADER') return e; } return null; };
  const scope = [...root.querySelectorAll('*'), ...document.querySelectorAll('cmp-tab-bar *, cmp-top-nav *')];

  // 1. nimic nu iese în afara ecranului pe orizontală
  if (document.scrollingElement.scrollWidth > vw + 1) out.push('pagina se poate derula pe orizontală');
  const contents = root.querySelectorAll('ion-content');
  const inner = contents.length ? contents[contents.length - 1].shadowRoot?.querySelector('.inner-scroll') : null;
  if (inner && inner.scrollWidth > inner.clientWidth + 1) out.push(`conținutul se poate derula pe orizontală (${inner.scrollWidth} > ${inner.clientWidth})`);
  // un element care iese din ecran contează doar dacă nu e tăiat (decorativ) de un părinte cu overflow ascuns
  const clippedByAncestor = (el) => {
    for (let e = el.parentElement; e && e !== root; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (st.overflowX !== 'visible') { const r = e.getBoundingClientRect(); if (r.left >= -1 && r.right <= vw + 1) return true; }
    }
    return false;
  };
  for (const el of scope) {
    if (el.closest('.hscroll, svg') || el.tagName === 'ION-ICON') continue;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && visible(el) && !clippedByAncestor(el)) { out.push(`iese din ecran: ${name(el)} (${Math.round(r.left)}..${Math.round(r.right)} / ${vw})`); break; }
  }

  // 2. text tăiat în butoane, etichete, titluri: textul real (nu pseudo-elementele) trebuie să încapă în element,
  //    cu excepția celor cu „…” intenționat
  const textEls = root.querySelectorAll('button, a, .btn, .chip, .badge, label, h1, h2, h3, .title, .st, .pri, .price, .amt');
  for (const el of [...textEls, ...document.querySelectorAll('cmp-tab-bar a, cmp-tab-bar button')]) {
    if (!visible(el)) continue;
    const st = getComputedStyle(el);
    if (st.display === 'inline') continue;
    const box = el.getBoundingClientRect();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const host = n.parentElement;
      if (host.closest('[aria-hidden=true]') || getComputedStyle(host).textOverflow === 'ellipsis' || !visible(host)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const tr = range.getBoundingClientRect();
      if (tr.width < 1) continue;
      if (tr.right > box.right + 1.5 || tr.left < box.left - 1.5) { out.push(`text tăiat pe lățime: ${name(el)}`); break; }
      if (st.overflowY !== 'visible' && (tr.bottom > box.bottom + 1.5 || tr.top < box.top - 1.5)) { out.push(`text tăiat pe înălțime: ${name(el)}`); break; }
    }
  }
  // textul unui buton nu se taie cu „…” (la titluri de anunț e voie, la acțiuni nu)
  for (const el of root.querySelectorAll('button, .btn, a.btn')) {
    if (!visible(el)) continue;
    for (const c of [el, ...el.querySelectorAll('*')]) {
      if (getComputedStyle(c).textOverflow === 'ellipsis' && c.scrollWidth > c.clientWidth + 1 && visible(c)) { out.push(`text de buton tăiat cu …: ${name(el)}`); break; }
    }
  }
  // iconițele / pozele din butoane trebuie să fie întregi (nu tăiate de marginea butonului)
  for (const el of root.querySelectorAll('.btn, .chip, .icon-btn, cmp-tab-bar a')) {
    if (!visible(el) || getComputedStyle(el).overflow === 'visible') continue;
    const box = el.getBoundingClientRect();
    for (const c of el.querySelectorAll('ion-icon, img, svg')) {
      if (!visible(c)) continue;
      const r = c.getBoundingClientRect();
      if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1) { out.push(`iconiță tăiată în: ${name(el)}`); break; }
    }
  }

  // 3. butoane / linkuri suprapuse în același strat
  const ctrls = [...root.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button]'), ...document.querySelectorAll('cmp-tab-bar a, cmp-tab-bar button, cmp-top-nav a, cmp-top-nav button, cmp-top-nav input')]
    .filter((el) => visible(el) && !el.closest('.hscroll') && getComputedStyle(el).display !== 'inline')
    .map((el) => ({ el, r: el.getBoundingClientRect(), layer: fixedAncestor(el) }))
    .filter((x) => x.r.bottom > 0 && x.r.top < vh);
  for (let i = 0; i < ctrls.length; i++) {
    for (let j = i + 1; j < ctrls.length; j++) {
      const a = ctrls[i], c = ctrls[j];
      if (a.layer !== c.layer || a.el.contains(c.el) || c.el.contains(a.el)) continue;
      const adorn = (x, y) => x.el.matches('input, textarea, select') && y.el.tagName === 'BUTTON' && y.el.parentElement?.contains(x.el);
      if (adorn(a, c) || adorn(c, a)) continue; // ex. butonul „arată parola” din câmpul de parolă
      const w = Math.min(a.r.right, c.r.right) - Math.max(a.r.left, c.r.left), h = Math.min(a.r.bottom, c.r.bottom) - Math.max(a.r.top, c.r.top);
      if (w > 2 && h > 2 && w * h > 0.2 * Math.min(a.r.width * a.r.height, c.r.width * c.r.height)) out.push(`suprapuse: ${name(a.el)} + ${name(c.el)}`);
    }
  }

  // 4. nimic nu stă sub notch / bara de stare sau sub marginile rotunjite în landscape
  const scrolled = (inner?.scrollTop ?? 0) > 2;
  for (const x of ctrls) {
    const t = x.r;
    if (t.top < safe.top - 1 && t.bottom > 0 && (!scrolled || x.layer)) out.push(`sub notch: ${name(x.el)} (top ${Math.round(t.top)} < ${Math.round(safe.top)})`);
    if (t.left < safe.left - 1 || t.right > vw - safe.right + 1) out.push(`sub marginea ecranului: ${name(x.el)}`);
  }
  for (const h of root.querySelectorAll('h1, h2, .title, p')) {
    if (!visible(h)) continue;
    const t = h.getBoundingClientRect();
    if (t.top < safe.top - 1 && t.bottom > 0 && !fixedAncestor(h) && !scrolled) { out.push(`text sub notch: ${name(h)}`); break; }
  }

  // 5. câmpuri de text cu font sub 16px (iPhone face zoom automat pe ele)
  for (const el of root.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select')) {
    if (visible(el) && parseFloat(getComputedStyle(el).fontSize) < 16) out.push(`font sub 16px (zoom pe iPhone): ${name(el)}`);
  }

  // 6. imagini care nu se încarcă
  for (const img of root.querySelectorAll('img')) {
    const src = img.getAttribute('src') || img.src || '';
    if (!visible(img)) continue;
    if (/\/(null|undefined)$/.test(img.src) || (img.complete && img.naturalWidth === 0 && src)) out.push(`imagine ruptă: ${src.slice(-40)}`);
  }
  return [...new Set(out)];
}

/** Partea 2: după derulare până jos — ultimele butoane nu rămân sub bara de jos, sub bara de gesturi sau sub tastatura de mesaje. */
export function auditBottom() {
  const vh = innerHeight;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;bottom:env(safe-area-inset-bottom);top:0;pointer-events:none;visibility:hidden';
  document.body.appendChild(probe);
  const safeBottom = vh - probe.getBoundingClientRect().bottom;
  probe.remove();
  const pages = [...document.querySelectorAll('ion-router-outlet > .ion-page:not(.ion-page-hidden)')];
  const root = pages[pages.length - 1] ?? document.body;
  const out = [];
  const name = (el) => el.tagName.toLowerCase() + ' "' + (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28) + '"';
  const chrome = (el) => el.closest('cmp-tab-bar, ion-footer, .topbar, .actionbar, cmp-top-nav, .composer');
  for (const el of root.querySelectorAll('ion-content a[href], ion-content button, ion-content input, ion-content textarea, ion-content select')) {
    if (chrome(el) || el.closest('[aria-hidden=true], .hp, ion-modal, .hscroll, .lb')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.top > vh || r.bottom < vh * 0.45) continue;
    let hidden = false;
    for (let e = el; e && e !== document.body; e = e.parentElement) { const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.05) { hidden = true; break; } }
    if (hidden) continue;
    const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), y = Math.min(r.bottom - Math.min(10, r.height / 2), vh - 1);
    const hit = document.elementFromPoint(x, y);
    if (hit && !el.contains(hit) && !hit.contains(el) && chrome(hit)) out.push(`acoperit de ${chrome(hit).tagName.toLowerCase()}: ${name(el)}`);
    else if (r.bottom > vh - safeBottom + 1) out.push(`sub bara de gesturi: ${name(el)}`);
  }
  return [...new Set(out)];
}

/** Fereastra deschisă de jos (ion-modal): nimic nu iese lateral, iar ultimul buton se poate atinge (nu e sub bara de gesturi). */
export function auditModal() {
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;bottom:env(safe-area-inset-bottom);left:env(safe-area-inset-left);right:env(safe-area-inset-right);pointer-events:none;visibility:hidden';
  document.body.appendChild(probe);
  const sa = probe.getBoundingClientRect();
  probe.remove();
  const modals = [...document.querySelectorAll('ion-modal.show-modal')];
  const m = modals[modals.length - 1];
  if (!m) return ['fereastra nu s-a deschis'];
  const out = [];
  const name = (el) => el.tagName.toLowerCase() + ' "' + (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28) + '"';
  const visible = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let e = el; e && e !== m; e = e.parentElement) { const st = getComputedStyle(e); if (st.display === 'none' || st.visibility === 'hidden') return false; } return true; };
  const content = m.querySelector('ion-content');
  const inner = content?.shadowRoot?.querySelector('.inner-scroll');
  if (inner && inner.scrollWidth > inner.clientWidth + 1) out.push(`fereastra se derulează pe orizontală (${inner.scrollWidth} > ${inner.clientWidth})`);
  for (const el of m.querySelectorAll('ion-content *')) {
    if (el.closest('.hscroll, svg') || el.tagName === 'ION-ICON' || !visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) { out.push(`iese din fereastră: ${name(el)}`); break; }
  }
  const ctrls = [...m.querySelectorAll('ion-content button, ion-content a[href], ion-content input, ion-content textarea, ion-content select, cmp-hold-button button')].filter(visible);
  const last = ctrls.sort((a, b) => a.getBoundingClientRect().bottom - b.getBoundingClientRect().bottom).pop();
  if (last) {
    const r = last.getBoundingClientRect();
    if (r.bottom > sa.bottom + 1) out.push(`ultimul buton e sub bara de gesturi / în afara ecranului: ${name(last)} (${Math.round(r.bottom)} > ${Math.round(sa.bottom)})`);
    if (r.left < sa.left - 1 || r.right > sa.right + 1) out.push(`ultimul buton e sub marginea ecranului: ${name(last)}`);
    const hit = document.elementFromPoint(Math.min(r.left + r.width / 2, vw - 1), Math.min(r.top + r.height / 2, vh - 1));
    if (hit && !last.contains(hit) && !hit.contains(last)) out.push(`ultimul buton e acoperit de ${hit.tagName.toLowerCase()}.${hit.className}`);
  }
  return out;
}

/**
 * Protecții globale pentru apăsări (aplicate o singură dată, pentru toată aplicația):
 *  1. O singură acțiune per apăsare: al doilea click pe același buton/link în < 700 ms e ignorat
 *     (dublu-tap, degetul care „tremură”, click dublu pe desktop). Excepții: elementele cu [data-repeat].
 *  2. Dacă apeși, ții și tragi degetul/mouse-ul în afara butonului, la ridicare nu se mai execută nimic.
 *  3. Butoanele „ține apăsat” ([data-hold]) își gestionează singure gestul.
 * Activarea din tastatură sau de cititoarele de ecran (click fără pointer, detail = 0) nu e afectată de regula 2.
 */
const TARGETS = 'button, a[href], [role="button"], .btn, .chip, .tab, .sell, .opt, .cat, .press, ion-item[button]';
const REPEAT_WINDOW_MS = 700;
const DRAG_TOLERANCE_PX = 10;

export function installTapGuard() {
  let press: { el: Element; id: number; out: boolean } | null = null;
  const last = new WeakMap<Element, number>();

  const target = (e: Event) => (e.target as Element | null)?.closest?.(TARGETS) ?? null;

  document.addEventListener('pointerdown', (e) => {
    const el = target(e);
    press = el && !el.closest('[data-hold]') ? { el, id: e.pointerId, out: false } : null;
  }, { capture: true, passive: true });

  document.addEventListener('pointermove', (e) => {
    if (!press || press.out || e.pointerId !== press.id) return;
    const r = press.el.getBoundingClientRect();
    if (e.clientX < r.left - DRAG_TOLERANCE_PX || e.clientX > r.right + DRAG_TOLERANCE_PX
      || e.clientY < r.top - DRAG_TOLERANCE_PX || e.clientY > r.bottom + DRAG_TOLERANCE_PX) {
      press.out = true;
      press.el.classList.add('tap-cancelled');
      setTimeout(() => press?.el.classList.remove('tap-cancelled'), 400);
    }
  }, { capture: true, passive: true });

  document.addEventListener('pointercancel', () => { press = null; }, { capture: true, passive: true });

  document.addEventListener('click', (e) => {
    const el = target(e);
    const p = press;
    press = null;
    if (!el || el.closest('[data-hold]')) return;
    // 2. degetul a ieșit din buton înainte de ridicare
    if (e.detail !== 0 && p && p.out && (p.el === el || p.el.contains(el) || el.contains(p.el))) {
      e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    // 1. a doua activare prea rapidă a aceluiași element
    if (el.closest('[data-repeat]')) return;
    const now = performance.now();
    const prev = last.get(el) ?? -Infinity;
    if (now - prev < REPEAT_WINDOW_MS) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    last.set(el, now);
  }, { capture: true });
}

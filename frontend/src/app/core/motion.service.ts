import { Injectable, NgZone, inject } from '@angular/core';

const RIPPLE_TARGETS = '.btn, .chip, .icon-btn, .cat, .press, .tab, .sell, .seg button, .opt, .menu a, .menu button, .note, .conv, .tk';
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Motion design global, aplicat prin delegare (fără să atingem fiecare componentă):
 *  - undă (ripple) la apăsare pe butoane, carduri și chip-uri;
 *  - înclinare 3D cu reflexie de lumină pe elementele .tilt (doar pe dispozitive cu mouse);
 *  - apariție la scroll pentru elementele .rv (IntersectionObserver);
 *  - explozie de inimioare la adăugarea la favorite.
 */
@Injectable({ providedIn: 'root' })
export class Motion {
  private zone = inject(NgZone);
  private io?: IntersectionObserver;

  init() {
    this.zone.runOutsideAngular(() => {
      document.addEventListener('pointerdown', (e) => this.ripple(e), { passive: true });
      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        document.addEventListener('pointermove', (e) => this.tilt(e), { passive: true });
      }
      this.io = new IntersectionObserver((entries) => {
        for (const en of entries) {
          if (en.isIntersecting) { (en.target as HTMLElement).classList.add('in'); this.io!.unobserve(en.target); }
        }
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
      const scan = (root: ParentNode) => root.querySelectorAll?.('.rv:not(.in)').forEach((el) => this.io!.observe(el));
      scan(document);
      new MutationObserver((muts) => {
        for (const m of muts) m.addedNodes.forEach((n) => {
          if (n instanceof HTMLElement) { if (n.matches('.rv:not(.in)')) this.io!.observe(n); scan(n); }
        });
      }).observe(document.body, { childList: true, subtree: true });
    });
  }

  private ripple(e: PointerEvent) {
    if (reduced()) return;
    const host = (e.target as HTMLElement)?.closest?.(RIPPLE_TARGETS) as HTMLElement | null;
    if (!host || host.hasAttribute('disabled')) return;
    const r = host.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const s = document.createElement('span');
    s.className = 'fx-ripple';
    s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.classList.add('fx-ripple-host');
    host.appendChild(s);
    s.addEventListener('animationend', () => s.remove(), { once: true });
  }

  private tiltEl: HTMLElement | null = null;
  private tilt(e: PointerEvent) {
    const el = (e.target as HTMLElement)?.closest?.('.tilt') as HTMLElement | null;
    if (this.tiltEl && this.tiltEl !== el) this.resetTilt(this.tiltEl);
    this.tiltEl = el;
    if (!el || reduced()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.setProperty('--rx', `${(0.5 - y) * 9}deg`);
    el.style.setProperty('--ry', `${(x - 0.5) * 11}deg`);
    el.style.setProperty('--gx', `${x * 100}%`);
    el.style.setProperty('--gy', `${y * 100}%`);
    el.classList.add('tilting');
  }
  private resetTilt(el: HTMLElement) {
    el.classList.remove('tilting');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }

  /** Inimioare care zboară din buton. */
  burst(from: HTMLElement, color = '#FF5A4E') {
    if (reduced()) return;
    const r = from.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 9; i++) {
      const h = document.createElement('span');
      h.className = 'fx-heart';
      h.textContent = i % 3 === 0 ? '✦' : '❤';
      const ang = (Math.PI * 2 * i) / 9 + Math.random() * 0.5;
      const dist = 34 + Math.random() * 30;
      h.style.cssText = `left:${cx}px;top:${cy}px;color:${i % 3 === 0 ? '#7B5CFF' : color};--tx:${Math.cos(ang) * dist}px;--ty:${Math.sin(ang) * dist - 18}px;--rot:${(Math.random() - 0.5) * 80}deg;font-size:${10 + Math.random() * 9}px`;
      document.body.appendChild(h);
      h.addEventListener('animationend', () => h.remove(), { once: true });
    }
  }

  /** Confetti pe tot ecranul (publicare, ofertă acceptată). */
  confetti(count = 70) {
    if (reduced()) return;
    const colors = ['#5B3DF5', '#FF5A4E', '#14A46C', '#FFC93C', '#7B5CFF', '#6BC5FF'];
    for (let i = 0; i < count; i++) {
      const c = document.createElement('span');
      c.className = 'fx-confetti';
      c.style.cssText = `left:${Math.random() * 100}vw;background:${colors[i % colors.length]};--dx:${(Math.random() - 0.5) * 200}px;--rot:${Math.random() * 900}deg;animation-delay:${Math.random() * 400}ms;width:${6 + Math.random() * 6}px;height:${10 + Math.random() * 8}px`;
      document.body.appendChild(c);
      c.addEventListener('animationend', () => c.remove(), { once: true });
    }
  }
}

export function isCutout(url: string | null | undefined): boolean {
  return !!url && url.endsWith('.svg');
}

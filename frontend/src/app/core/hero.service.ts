import { Injectable } from '@angular/core';

interface Pending { id: string; src: string; rect: DOMRect; cutout: boolean; at: number; }

/**
 * Tranziție „hero”: imaginea de pe card zboară și se transformă în galeria din pagina anunțului.
 */
@Injectable({ providedIn: 'root' })
export class HeroTransition {
  private pending: Pending | null = null;

  capture(id: string, img: HTMLImageElement | null, cutout: boolean) {
    if (!img || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.pending = { id, src: img.currentSrc || img.src, rect: img.getBoundingClientRect(), cutout, at: Date.now() };
  }

  /**
   * Rulează animația spre imaginea din pagina nouă. Așteaptă puțin să apară imaginea reală (datele se încarcă),
   * ca zborul să aterizeze exact peste ea; altfel aterizează pe zona galeriei.
   */
  play(id: string, findContainer: () => HTMLElement | null) {
    const p = this.pending;
    this.pending = null;
    if (!p || p.id !== id || Date.now() - p.at > 2500) return;
    document.body.classList.add('hero-flying');
    const started = performance.now();
    const look = () => {
      const box = findContainer();
      const img = box?.querySelector('img') as HTMLImageElement | null;
      if (img && img.getBoundingClientRect().width) return this.fly(p, img);
      if (performance.now() - started > 450) { if (box) this.fly(p, box); else document.body.classList.remove('hero-flying'); return; }
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }

  private fly(p: Pending, target: HTMLElement) {
    const t = target.getBoundingClientRect();
    if (!t.width) { document.body.classList.remove('hero-flying'); return; }
    // păstrăm proporțiile imaginii, centrată în țintă
    const scale = Math.min(t.width / p.rect.width, t.height / p.rect.height);
    const w = p.rect.width * scale, h = p.rect.height * scale;
    const tx = t.left + (t.width - w) / 2, ty = t.top + (t.height - h) / 2;
    const clone = document.createElement('img');
    clone.src = p.src;
    clone.className = 'fx-hero' + (p.cutout ? ' cutout' : '');
    clone.style.cssText = `left:${p.rect.left}px;top:${p.rect.top}px;width:${p.rect.width}px;height:${p.rect.height}px`;
    document.body.appendChild(clone);
    const anim = clone.animate([
      { transform: 'translate(0,0) scale(1) rotate(0deg)', borderRadius: '20px', offset: 0 },
      { transform: `translate(${(tx - p.rect.left) * 0.55}px, ${(ty - p.rect.top) * 0.45 - 30}px) scale(${1 + (scale - 1) * 0.6}) rotate(-3deg)`, offset: 0.55 },
      { transform: `translate(${tx - p.rect.left}px, ${ty - p.rect.top}px) scale(${scale}) rotate(0deg)`, borderRadius: '24px', offset: 1 },
    ], { duration: 620, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'forwards' });
    anim.onfinish = () => {
      // Pagina s-a mișcat între timp (tranziția de pagină): ne aliniem exact peste imaginea finală, apoi o dezvăluim.
      const t2 = target.getBoundingClientRect();
      const s2 = Math.min(t2.width / p.rect.width, t2.height / p.rect.height);
      const w2 = p.rect.width * s2, h2 = p.rect.height * s2;
      const x2 = t2.left + (t2.width - w2) / 2 - p.rect.left, y2 = t2.top + (t2.height - h2) / 2 - p.rect.top;
      clone.animate([
        { transform: `translate(${tx - p.rect.left}px, ${ty - p.rect.top}px) scale(${scale})` },
        { transform: `translate(${x2}px, ${y2}px) scale(${s2})` },
      ], { duration: 160, easing: 'ease-out', fill: 'forwards' }).onfinish = () => {
        // Acum sunt suprapuse exact: dezvăluim imaginea reală și estompăm clona pe aceeași poziție.
        document.body.classList.remove('hero-flying');
        clone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).onfinish = () => clone.remove();
      };
    };
  }
}

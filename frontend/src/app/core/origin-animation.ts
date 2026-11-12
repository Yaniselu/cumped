import { Animation, createAnimation } from '@ionic/angular';

/**
 * Animații cu origine: un dialog crește din punctul în care ai atins ecranul (butonul care l-a deschis),
 * nu din mijlocul ecranului. Așa se vede clar ce acțiune a deschis fereastra.
 */
let last: { x: number; y: number } | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => { last = { x: e.clientX, y: e.clientY }; }, { capture: true, passive: true });
  window.addEventListener('keydown', () => { last = null; }, { capture: true, passive: true }); // de la tastatură: din centru
}

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function originEnter(base: HTMLElement): Animation {
  const wrapper = base.querySelector('.alert-wrapper') as HTMLElement | null;
  const backdrop = base.querySelector('ion-backdrop');
  if (wrapper) {
    const r = wrapper.getBoundingClientRect();
    const ox = last && r.width ? Math.max(-r.width, Math.min(r.width * 2, last.x - r.left)) : r.width / 2;
    const oy = last && r.height ? Math.max(-r.height, Math.min(r.height * 2, last.y - r.top)) : r.height / 2;
    wrapper.style.transformOrigin = `${ox}px ${oy}px`;
  }
  const back = createAnimation().addElement(backdrop!).fromTo('opacity', 0.01, 'var(--backdrop-opacity)').beforeStyles({ 'pointer-events': 'none' })
    .afterClearStyles(['pointer-events']);
  const body = createAnimation().addElement(wrapper!);
  if (reduced()) body.fromTo('opacity', 0.01, 1);
  else body.keyframes([
    { offset: 0, opacity: 0.01, transform: 'scale(0.4)' },
    { offset: 0.7, opacity: 1, transform: 'scale(1.02)' },
    { offset: 1, opacity: 1, transform: 'scale(1)' },
  ]);
  return createAnimation().addElement(base).easing('cubic-bezier(0.22, 1, 0.36, 1)').duration(reduced() ? 120 : 320).addAnimation([back, body]);
}

export function originLeave(base: HTMLElement): Animation {
  const wrapper = base.querySelector('.alert-wrapper') as HTMLElement | null;
  const back = createAnimation().addElement(base.querySelector('ion-backdrop')!).fromTo('opacity', 'var(--backdrop-opacity)', 0);
  const body = createAnimation().addElement(wrapper!).fromTo('opacity', 0.99, 0);
  if (!reduced()) body.fromTo('transform', 'scale(1)', 'scale(0.85)');
  return createAnimation().addElement(base).easing('ease-in').duration(reduced() ? 100 : 180).addAnimation([back, body]);
}

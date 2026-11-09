import { Animation, createAnimation } from '@ionic/angular';

/**
 * Tranziție între pagini: pagina nouă urcă ușor, crește din 96% și iese din blur;
 * cea veche se micșorează și se estompează în spate. Merge și cu gestul de „swipe back”.
 */
export function cumpedNavAnimation(_base: HTMLElement, opts: any): Animation {
  const back = opts.direction === 'back';
  const easing = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const duration = opts.duration ?? 520;
  const entering = createAnimation().addElement(opts.enteringEl).beforeRemoveClass('ion-page-invisible');
  const leaving = createAnimation().addElement(opts.leavingEl);

  if (!back) {
    entering
      .fromTo('transform', 'translateY(34px) scale(0.965)', 'translateY(0) scale(1)')
      .fromTo('opacity', '0', '1')
      .fromTo('filter', 'blur(10px)', 'blur(0px)');
    leaving
      .fromTo('transform', 'scale(1)', 'scale(0.93)')
      .fromTo('opacity', '1', '0')
      .fromTo('filter', 'blur(0px)', 'blur(6px)');
  } else {
    entering
      .fromTo('transform', 'scale(0.93)', 'scale(1)')
      .fromTo('opacity', '0', '1')
      .fromTo('filter', 'blur(6px)', 'blur(0px)');
    leaving
      .fromTo('transform', 'translateY(0) scale(1)', 'translateY(46px) scale(0.965)')
      .fromTo('opacity', '1', '0')
      .fromTo('filter', 'blur(0px)', 'blur(10px)');
  }
  return createAnimation().duration(duration).easing(easing).addAnimation([entering, leaving]);
}

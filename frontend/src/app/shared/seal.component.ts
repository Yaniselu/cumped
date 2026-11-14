import { Component, ElementRef, OnInit, inject } from '@angular/core';
import { SEAL } from '../core/motion.service';

/** Sigiliul Cumped în pagină (ex. „Anunțul e live”): aceeași animație ca la momentele importante, fără suprapunere. */
@Component({
  selector: 'cmp-seal',
  host: { class: 'fx-seal inline', 'aria-hidden': 'true' },
  template: '',
})
export class SealComponent implements OnInit {
  private el = inject(ElementRef<HTMLElement>);
  ngOnInit() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) this.el.nativeElement.classList.add('still');
    this.el.nativeElement.innerHTML = SEAL;
  }
}

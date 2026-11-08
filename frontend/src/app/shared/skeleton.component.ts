import { Component, input } from '@angular/core';

/** Skeleton loading: forma cardurilor apare imediat, cu o lumină care trece peste ele. */
@Component({
  selector: 'cmp-skeleton-grid',
  template: `
    <div class="grid">
      @for (i of items(); track i) {
        <div class="sk card reveal" [style.--i]="i">
          <div class="skeleton media"></div>
          <div class="skeleton l1"></div>
          <div class="skeleton l2"></div>
          <div class="skeleton l3"></div>
        </div>
      }
    </div>
  `,
  styles: [`
    .sk { padding: 6px 6px 14px; overflow: hidden; }
    .media { aspect-ratio: 4 / 3.3; border-radius: 20px; }
    .l1 { height: 14px; margin: 14px 8px 0; width: 80%; }
    .l2 { height: 20px; margin: 10px 8px 0; width: 45%; }
    .l3 { height: 11px; margin: 10px 8px 0; width: 35%; }
  `],
})
export class SkeletonGridComponent {
  count = input(6);
  items = () => Array.from({ length: this.count() }, (_, i) => i);
}

@Component({
  selector: 'cmp-skeleton-lines',
  template: `@for (i of rows(); track i) { <div class="row-sk card reveal" [style.--i]="i"><div class="skeleton av"></div><div class="tx"><div class="skeleton a"></div><div class="skeleton b"></div></div></div> }`,
  styles: [`
    .row-sk { display: flex; gap: 14px; align-items: center; padding: 14px; margin-bottom: 10px; }
    .av { width: 52px; height: 52px; border-radius: 16px; flex: 0 0 auto; }
    .tx { flex: 1; } .a { height: 14px; width: 60%; } .b { height: 12px; width: 85%; margin-top: 9px; }
  `],
})
export class SkeletonLinesComponent {
  count = input(5);
  rows = () => Array.from({ length: this.count() }, (_, i) => i);
}

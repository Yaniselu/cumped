import { Component, ElementRef, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * „Trage pentru reîmprospătare” cu semnul Cumped: cele două săgeți de schimb se rotesc și se adună cât tragi,
 * la prag se aude un mic „tic” (vibrație), în timpul încărcării se învârt, iar la final se desenează bifa.
 * Se pune în locul lui <ion-refresher-content>:  <ion-refresher slot="fixed" ...><cmp-refresh-mark /></ion-refresher>
 */
@Component({
  selector: 'cmp-refresh-mark',
  template: `
    <div class="rm" aria-hidden="true">
      <svg width="34" height="34" viewBox="0 0 512 512">
        <g class="ar">
          <path d="M136.07 251.81 A120 120 0 0 1 354.30 187.17" fill="none" stroke="#FF5A4E" stroke-width="48" stroke-linecap="round" />
          <path d="M391.98 160.78 L386.42 233.04 L316.62 213.56 Z" fill="#FF5A4E" stroke="#FF5A4E" stroke-width="12" stroke-linejoin="round" />
          <path class="v" d="M375.93 260.19 A120 120 0 0 1 157.70 324.83" fill="none" stroke-width="48" stroke-linecap="round" />
          <path class="vf" d="M120.02 351.22 L125.58 278.96 L195.38 298.44 Z" stroke-width="12" stroke-linejoin="round" />
        </g>
        <polyline class="ck" points="208,258 242,292 306,224" fill="none" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
  `,
  styles: [`
    :host { display: flex; justify-content: center; align-items: center; height: 100%; }
    .rm { --p: 0; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center;
      background: var(--card-fill, #fff); box-shadow: 0 8px 22px -10px rgba(30, 20, 80, .45), inset 0 0 0 1px var(--line, rgba(0,0,0,.06));
      opacity: min(1, calc(var(--p) * 1.6)); transform: translateY(calc((1 - min(1, var(--p))) * -10px)) scale(calc(.6 + min(1, var(--p)) * .4)); }
    .ar { transform-origin: 256px 256px; transform: rotate(calc(var(--p) * 320deg - 320deg)); }
    .v { stroke: var(--accent, #5B3DF5); } .vf { fill: var(--accent, #5B3DF5); stroke: var(--accent, #5B3DF5); }
    .ck { stroke: var(--text, #111); stroke-dasharray: 160; stroke-dashoffset: calc(160 - max(0, var(--p) - .75) * 640); }
    :host-context(.refresher-ready) .rm { animation: rmPop .32s cubic-bezier(.34, 1.56, .64, 1); }
    :host-context(.refresher-refreshing) .rm { opacity: 1; transform: none; }
    :host-context(.refresher-refreshing) .ar { animation: rmSpin .9s cubic-bezier(.5, 0, .5, 1) infinite; }
    :host-context(.refresher-refreshing) .ck { stroke-dashoffset: 160; transition: stroke-dashoffset .15s; }
    :host-context(.refresher-completing) .rm { opacity: 1; transform: none; animation: rmDone .5s cubic-bezier(.22, 1, .36, 1) forwards; }
    :host-context(.refresher-completing) .ar { transform: none; }
    :host-context(.refresher-completing) .ck { stroke-dashoffset: 0; transition: stroke-dashoffset .3s cubic-bezier(.22, 1, .36, 1); }
    @keyframes rmSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes rmPop { 50% { transform: scale(1.14); } }
    @keyframes rmDone { 0% { transform: scale(1); } 40% { transform: scale(1.12); } 100% { transform: scale(.9); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .ar, .rm { animation: none !important; transform: none !important; } }
  `],
})
export class RefreshMarkComponent implements OnInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private zone = inject(NgZone);
  private refresher: HTMLIonRefresherElement | null = null;
  private ready = false;

  private onPull = () => {
    this.refresher?.getProgress().then((p) => {
      const v = Math.max(0, Math.min(1.25, p));
      (this.el.nativeElement.firstElementChild as HTMLElement)?.style.setProperty('--p', String(v));
      if (v >= 1 && !this.ready) { this.ready = true; Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); }
      if (v < 1) this.ready = false;
    });
  };
  private onStart = () => { this.ready = false; };

  ngOnInit() {
    this.refresher = this.el.nativeElement.closest('ion-refresher');
    this.zone.runOutsideAngular(() => {
      this.refresher?.addEventListener('ionPull', this.onPull);
      this.refresher?.addEventListener('ionStart', this.onStart);
    });
  }

  ngOnDestroy() {
    this.refresher?.removeEventListener('ionPull', this.onPull);
    this.refresher?.removeEventListener('ionStart', this.onStart);
  }
}

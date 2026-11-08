import { Component, computed, inject, input } from '@angular/core';
import { Theme } from '../core/theme.service';

/** Logo Cumped: B1 (fundal alb) pe tema luminoasă, B4 (fundal negru) pe tema întunecată. */
@Component({
  selector: 'cmp-logo',
  template: `
    <span class="logo" [class.animate]="animate()">
      <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 512 512" aria-hidden="true">
        <rect x="2" y="2" width="508" height="508" rx="114" [attr.fill]="dark() ? '#141416' : '#ffffff'"
              [attr.stroke]="dark() ? 'none' : '#e4e4e8'" stroke-width="4" />
        <g class="arrows">
          <path d="M136.07 251.81 A120 120 0 0 1 354.30 187.17" fill="none" stroke="#FF5A4E" stroke-width="44" stroke-linecap="round" />
          <path d="M391.98 160.78 L386.42 233.04 L316.62 213.56 Z" fill="#FF5A4E" stroke="#FF5A4E" stroke-width="10" stroke-linejoin="round" />
          <path d="M375.93 260.19 A120 120 0 0 1 157.70 324.83" fill="none" [attr.stroke]="dark() ? '#7B5CFF' : '#5B3DF5'" stroke-width="44" stroke-linecap="round" />
          <path d="M120.02 351.22 L125.58 278.96 L195.38 298.44 Z" [attr.fill]="dark() ? '#7B5CFF' : '#5B3DF5'" [attr.stroke]="dark() ? '#7B5CFF' : '#5B3DF5'" stroke-width="10" stroke-linejoin="round" />
        </g>
        <polyline class="check" points="208,258 242,292 306,224" fill="none" [attr.stroke]="dark() ? '#ffffff' : '#111111'" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      @if (wordmark()) { <span class="word">Cumped</span> }
    </span>
  `,
  styles: [`
    .logo { display: inline-flex; align-items: center; gap: 10px; }
    svg { display: block; filter: drop-shadow(0 6px 14px rgba(20, 20, 40, .12)); }
    .word { font-family: var(--font-display); font-weight: 700; font-size: 22px; letter-spacing: -0.03em; color: var(--text); }
    .animate .arrows { transform-origin: 256px 256px; animation: spinIn 1.4s var(--ease) both; }
    .animate .check { stroke-dasharray: 160; stroke-dashoffset: 160; animation: draw .7s .7s var(--ease) forwards; }
    @keyframes spinIn { from { transform: rotate(-200deg) scale(.6); opacity: 0; } to { transform: none; opacity: 1; } }
    @keyframes draw { to { stroke-dashoffset: 0; } }
  `],
})
export class LogoComponent {
  private theme = inject(Theme);
  size = input(40);
  wordmark = input(false);
  animate = input(false);
  variant = input<'auto' | 'light' | 'dark'>('auto');
  dark = computed(() => this.variant() === 'dark' || (this.variant() === 'auto' && this.theme.dark()));
}

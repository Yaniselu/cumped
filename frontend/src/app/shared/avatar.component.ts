import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

@Component({
  selector: 'cmp-avatar',
  imports: [IonIcon],
  template: `
    <span class="av" [class.halo]="verified() && size() >= 64" [style.width.px]="size()" [style.height.px]="size()" [style.background]="bg()" [style.font-size.px]="size() * 0.42">
      {{ initial() }}
      @if (verified()) { <span class="tick"><ion-icon name="checkmark"></ion-icon></span> }
    </span>
  `,
  styles: [`
    .av { position: relative; display: inline-grid; place-items: center; border-radius: 50%; color: #fff; font-family: var(--font-display);
      font-weight: 700; flex: 0 0 auto; box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 6px 16px -8px rgba(0,0,0,.35); }
    .tick { position: absolute; right: -2px; bottom: -2px; width: 38%; height: 38%; min-width: 16px; min-height: 16px; border-radius: 50%;
      background: var(--accent); display: grid; place-items: center; border: 2px solid var(--surface); }
    .tick ion-icon { font-size: 70%; color: #fff; position: relative; z-index: 1; }
    /* sigiliul „verificat”: un reflex de lumină trece peste bifă din când în când */
    .tick { overflow: hidden; }
    .tick::after { content: ''; position: absolute; inset: -20% auto -20% 0; width: 45%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent);
      transform: translateX(-130%) skewX(-18deg); animation: shine 5.5s 1.2s ease-in-out infinite; }
    /* pe profil (avatar mare): un inel discret în culorile Cumped se rotește în jurul celor verificați */
    .halo::before { content: ''; position: absolute; inset: -5px; border-radius: 50%; padding: 2.5px; z-index: -1;
      background: conic-gradient(from 0deg, #5b3df5, #ff5a4e, #7b5cff, #5b3df5);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude;
      animation: spinSlow 7s linear infinite; }
    .halo { isolation: isolate; }
    :host-context(html.lite) .tick::after, :host-context(html.lite) .halo::before { animation: none; }
    @media (prefers-reduced-motion: reduce) { .tick::after { display: none; } .halo::before { animation: none; } }
  `],
})
export class AvatarComponent {
  name = input('');
  hue = input(260);
  size = input(44);
  verified = input(false);
  initial = computed(() => (this.name() || '?').replace('@', '').charAt(0).toUpperCase());
  bg = computed(() => `linear-gradient(140deg, hsl(${this.hue()} 80% 66%), hsl(${(this.hue() + 40) % 360} 70% 48%))`);
}

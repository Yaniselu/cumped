import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

@Component({
  selector: 'cmp-avatar',
  imports: [IonIcon],
  template: `
    <span class="av" [style.width.px]="size()" [style.height.px]="size()" [style.background]="bg()" [style.font-size.px]="size() * 0.42">
      {{ initial() }}
      @if (verified()) { <span class="tick"><ion-icon name="checkmark"></ion-icon></span> }
    </span>
  `,
  styles: [`
    .av { position: relative; display: inline-grid; place-items: center; border-radius: 50%; color: #fff; font-family: var(--font-display);
      font-weight: 700; flex: 0 0 auto; box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 6px 16px -8px rgba(0,0,0,.35); }
    .tick { position: absolute; right: -2px; bottom: -2px; width: 38%; height: 38%; min-width: 16px; min-height: 16px; border-radius: 50%;
      background: var(--accent); display: grid; place-items: center; border: 2px solid var(--surface); }
    .tick ion-icon { font-size: 70%; color: #fff; }
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

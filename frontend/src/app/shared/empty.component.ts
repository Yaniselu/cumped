import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

@Component({
  selector: 'cmp-empty',
  imports: [IonIcon],
  template: `
    <div class="empty reveal">
      <div class="orb"><ion-icon [name]="icon()"></ion-icon></div>
      <h3>{{ title() }}</h3>
      @if (sub()) { <p class="muted">{{ sub() }}</p> }
      <ng-content />
    </div>
  `,
  styles: [`
    .empty { text-align: center; padding: 56px 24px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .orb { width: 86px; height: 86px; border-radius: 30px; display: grid; place-items: center; margin-bottom: 8px; background: var(--surface);
      box-shadow: var(--shadow-card); border: 1px solid var(--line); animation: floaty 4s ease-in-out infinite; }
    .orb ion-icon { font-size: 36px; color: var(--accent); }
    p { max-width: 320px; font-size: 14.5px; line-height: 1.5; }
  `],
})
export class EmptyComponent {
  icon = input('sparkles');
  title = input('');
  sub = input('');
}

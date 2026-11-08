import { Component, inject, input } from '@angular/core';
import { IonIcon, NavController } from '@ionic/angular';

@Component({
  selector: 'cmp-back',
  imports: [IonIcon],
  template: `<button class="icon-btn" (click)="go()" aria-label="Back"><ion-icon [name]="icon()"></ion-icon></button>`,
})
export class BackButtonComponent {
  private nav = inject(NavController);
  fallback = input('/home');
  icon = input('arrow-back');
  go() {
    if (window.history.length > 1) this.nav.back(); else this.nav.navigateRoot(this.fallback());
  }
}

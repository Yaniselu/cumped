import { AfterViewInit, Component, ElementRef, QueryList, ViewChildren, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { AuthService } from '../core/auth.service';
import { Badges } from '../core/badges.service';
import { TPipe } from '../core/i18n.service';

/** Bara de jos din sticlă lichidă: indicatorul activ alunecă elastic între butoane. */
@Component({
  selector: 'cmp-tab-bar',
  imports: [RouterLink, IonIcon, TPipe],
  template: `
    <nav class="tabbar glass" [class.hidden]="hidden()">
      <span class="blob" [class.show]="blobX() !== null" [class.moving]="moving()" [style.--bx]="(blobX() ?? 0) + 'px'"></span>
      <a #tab data-k="home" routerLink="/home" class="tab" [class.active]="active() === 'home'" aria-label="Home"><ion-icon [name]="active() === 'home' ? 'home' : 'home-outline'"></ion-icon></a>
      <a #tab data-k="search" routerLink="/search" class="tab" [class.active]="active() === 'search'" aria-label="Search"><ion-icon name="search"></ion-icon></a>
      <a routerLink="/sell" class="sell"><span class="plus"><ion-icon name="add"></ion-icon></span><span>{{ 'nav.sell' | t }}</span></a>
      <a #tab data-k="chats" [routerLink]="auth.loggedIn() ? '/chats' : '/login'" class="tab" [class.active]="active() === 'chats'" aria-label="Messages">
        <ion-icon [name]="active() === 'chats' ? 'chatbubbles' : 'chatbubble-outline'"></ion-icon>
        @if (badges.counts().messages) { <span class="count">{{ badges.counts().messages }}</span> }
      </a>
      <a #tab data-k="profile" [routerLink]="auth.loggedIn() ? '/profile' : '/login'" class="tab" [class.active]="active() === 'profile'" aria-label="Profile">
        <ion-icon [name]="active() === 'profile' ? 'person' : 'person-outline'"></ion-icon>
        @if (badges.counts().notifications + badges.counts().offers) { <span class="dot"></span> }
      </a>
    </nav>
  `,
  styles: [`
    .tabbar { position: fixed; left: 0; right: 0; margin: 0 auto; width: max-content; bottom: calc(env(safe-area-inset-bottom) + 16px); z-index: 50;
      display: flex; align-items: center; gap: 4px; padding: 7px; border-radius: 999px; transition: transform .6s var(--spring), opacity .35s; }
    .tabbar.hidden { transform: translateY(150%) scale(.9); opacity: 0; pointer-events: none; }
    .blob { position: absolute; left: 0; top: 7px; width: 52px; height: 52px; border-radius: 50%; opacity: 0; z-index: 0;
      transform: translateX(var(--bx)); transition: transform .55s var(--spring), opacity .3s;
      background: linear-gradient(160deg, rgba(255,255,255,.98), rgba(255,255,255,.75));
      box-shadow: 0 10px 22px -10px rgba(20,20,60,.45), inset 0 -2px 6px rgba(91,61,245,.12), inset 1px 1px 0 #fff; }
    :host-context(.dark) .blob { background: linear-gradient(160deg, rgba(255,255,255,.22), rgba(255,255,255,.08)); box-shadow: 0 10px 22px -10px rgba(0,0,0,.8), inset 1px 1px 0 rgba(255,255,255,.3); }
    .blob.show { opacity: 1; }
    .blob.moving { animation: squish .55s var(--spring); }
    .tab { position: relative; z-index: 1; width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; color: var(--text-2); transition: color .3s, transform .4s var(--spring); }
    .tab ion-icon { font-size: 22px; transition: transform .45s var(--spring); }
    .tab.active { color: var(--text); } .tab.active ion-icon { transform: scale(1.12); }
    :host-context(.dark) .tab { color: rgba(255,255,255,.78); } :host-context(.dark) .tab.active { color: #fff; }
    .tab:active ion-icon { transform: scale(.82); }
    .sell { position: relative; z-index: 1; display: flex; align-items: center; gap: 8px; height: 52px; padding: 0 20px 0 8px; margin: 0 4px; border-radius: 999px;
      color: var(--btn-dark-text); background: var(--btn-dark); box-shadow: var(--btn-dark-shadow); font-weight: 650; font-size: 15px; overflow: hidden; transition: transform .4s var(--spring); }
    .sell:active { transform: scale(.94); }
    .plus { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: rgba(255,255,255,.16); transition: transform .5s var(--spring); }
    :host-context(.dark) .plus { background: rgba(0,0,0,.08); }
    .sell:hover .plus { transform: rotate(90deg); } .plus ion-icon { font-size: 22px; }
    .count { position: absolute; top: -2px; right: -2px; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 999px; background: var(--accent-2);
      color: #fff; font-size: 11px; font-weight: 700; display: grid; place-items: center; border: 2px solid var(--surface); animation: pop .5s var(--spring); }
    .dot { position: absolute; top: 10px; right: 11px; width: 9px; height: 9px; border-radius: 50%; background: var(--accent-2); border: 2px solid var(--surface); animation: pulseRing 2s infinite; }
    @media (min-width: 992px) { .tabbar { display: none; } }
  `],
})
export class TabBarComponent implements AfterViewInit {
  auth = inject(AuthService);
  badges = inject(Badges);
  url = input('');
  hidden = input(false);
  @ViewChildren('tab') tabs!: QueryList<ElementRef<HTMLElement>>;
  blobX = signal<number | null>(null);
  moving = signal(false);
  active = computed(() => {
    const u = this.url();
    if (u.startsWith('/home')) return 'home';
    if (u.startsWith('/search')) return 'search';
    if (u.startsWith('/chats')) return 'chats';
    if (u.startsWith('/profile')) return 'profile';
    return '';
  });

  constructor() {
    effect(() => { const a = this.active(); setTimeout(() => this.place(a), 0); });
  }

  ngAfterViewInit() { setTimeout(() => this.place(this.active()), 50); }

  private place(key: string) {
    const el = this.tabs?.find((t) => t.nativeElement.dataset['k'] === key)?.nativeElement;
    if (!el) { this.blobX.set(null); return; }
    const prev = this.blobX();
    this.blobX.set(el.offsetLeft);
    if (prev !== null && prev !== el.offsetLeft) { this.moving.set(false); requestAnimationFrame(() => this.moving.set(true)); setTimeout(() => this.moving.set(false), 600); }
  }
}

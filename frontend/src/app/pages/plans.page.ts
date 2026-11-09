import { MOTION } from '../shared/motion.directives';
import { Component, OnInit, inject, signal } from '@angular/core';
import { IonContent, IonIcon, NavController } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, TPipe } from '../core/i18n.service';
import { Ui } from '../core/ui.service';
import { BackButtonComponent } from '../shared/back-button.component';

const ICONS: Record<string, string> = { EXTRA_LISTING: 'add-circle', PLUS: 'sparkles', PRO: 'business-outline', PROMOTE_7D: 'rocket-outline', BUMP: 'arrow-up' };

@Component({
  selector: 'page-plans',
  imports: [MOTION, IonContent, IonIcon, TPipe, BackButtonComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <div class="page narrow">
        <div class="topbar"><cmp-back fallback="/profile" /><div class="title"></div><div class="spacer"></div></div>
        <h1 class="reveal">{{ 'plans.title' | t }}</h1>
        <p class="muted reveal" style="--i:1">{{ 'plans.sub' | t }}</p>
        <div class="list">
          @for (p of products(); track p.id; let i = $index) {
            <div class="plan card reveal" [style.--i]="i + 2" [class.hl]="p.id === 'PLUS'" [class.cur]="auth.user()?.plan === p.id">
              <span class="ic"><ion-icon [name]="icons[p.id]"></ion-icon></span>
              <div class="tx"><strong>{{ 'plans.' + p.id | t }}</strong><span class="small muted">{{ 'plans.' + p.id + '_d' | t }}</span></div>
              <div class="pr"><strong>{{ i18n.price(p.priceCents, p.currency) }}</strong><span class="faint small">{{ p.period === 'MONTH' ? ('plans.month' | t) : '' }}</span></div>
              @if (p.id === 'PLUS' || p.id === 'PRO' || p.id === 'EXTRA_LISTING') {
                <button class="btn sm" [class.light]="p.id !== 'PLUS'" [disabled]="auth.user()?.plan === p.id" (click)="buy(p.id)">{{ (auth.user()?.plan === p.id ? 'plans.current' : 'plans.buy') | t }}</button>
              }
            </div>
          }
        </div>
        <div class="prot card pad reveal"><ion-icon name="shield-checkmark"></ion-icon><span>{{ 'plans.protection' | t }}</span></div>
        @if (simulated()) { <p class="faint small center">{{ 'common.simulated' | t }}</p> }
      </div>
    </ion-content>
  `,
  styles: [`
    h1 { margin-bottom: 8px; } .list { display: flex; flex-direction: column; gap: 12px; margin-top: 22px; }
    .plan { display: grid; grid-template-columns: auto 1fr auto; gap: 12px 14px; align-items: center; padding: 16px; }
    .plan .btn { grid-column: 1 / -1; }
    .plan.hl { background: linear-gradient(135deg, #5b3df5 0%, #8b6dff 100%); color: #fff; border: 0; box-shadow: 0 24px 50px -24px rgba(91,61,245,.8); }
    .plan.hl .muted, .plan.hl .faint { color: rgba(255,255,255,.8); } .plan.hl .btn { background: #fff; color: #111; }
    .ic { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-size: 22px; }
    .hl .ic { background: rgba(255,255,255,.2); color: #fff; }
    .tx { display: flex; flex-direction: column; gap: 2px; } .pr { text-align: right; display: flex; flex-direction: column; } .pr strong { font-family: var(--font-display); font-size: 20px; }
    .prot { display: flex; gap: 12px; align-items: center; margin-top: 16px; font-size: 14px; } .prot ion-icon { color: var(--ok); font-size: 26px; flex: 0 0 auto; }
    .center { text-align: center; margin-top: 12px; }
  `],
})
export class PlansPage implements OnInit {
  auth = inject(AuthService);
  i18n = inject(I18n);
  private api = inject(Api);
  private ui = inject(Ui);
  private nav = inject(NavController);
  icons = ICONS;
  products = signal<{ id: string; priceCents: number; currency: string; period: string }[]>([]);
  simulated = signal(false);

  async ngOnInit() { try { const p = await this.api.plans(); this.products.set(p.products); this.simulated.set(p.simulated); } catch { /* ignore */ } }

  async buy(id: string) {
    if (!this.auth.loggedIn()) { this.nav.navigateForward('/login'); return; }
    try { await this.api.checkout(id); this.auth.setUser(await this.api.me()); this.ui.toast(this.i18n.t('plans.done')); this.ui.tap(); }
    catch (e) { this.ui.error(e); }
  }
}

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, TPipe } from '../core/i18n.service';
import { Child } from '../core/models';
import { Ui } from '../core/ui.service';
import { AvatarComponent } from './avatar.component';

/**
 * Pentru conturile 16–17 ani: starea acordului părintelui și limitele contului, cu „trimite din nou” / „alt email”.
 * Nu apare deloc la conturile obișnuite.
 */
@Component({
  selector: 'cmp-supervision',
  imports: [IonIcon, TPipe, FormsModule],
  template: `
    @if (auth.user()?.supervision; as s) {
      <div class="sup card" [attr.data-s]="s.status" role="status">
        <span class="ic"><ion-icon [name]="icon()"></ion-icon></span>
        <div class="tx">
          <strong>{{ 'kids.status' + s.status | t }}</strong>
          <span>{{ ('kids.status' + s.status + 'Sub') | t: { max: i18n.price(s.caps['RON'] ?? 30000, 'RON') } }}</span>
          @if (s.status === 'APPROVED') { <span class="faint small">{{ 'kids.adultAt' | t: { date: i18n.date(s.adultAt, { day: 'numeric', month: 'long', year: 'numeric' }) } }}</span> }
          @if (s.status !== 'APPROVED' && s.status !== 'PAUSED') {
            @if (editing()) {
              <div class="edit">
                <input class="input" type="email" [(ngModel)]="email" [attr.aria-label]="'minor.parentEmail' | t" [placeholder]="'minor.parentEmail' | t" />
                <button class="btn sm" [disabled]="busy() || !email.includes('@')" (click)="resend(email)">{{ 'kids.send' | t }}</button>
              </div>
            } @else {
              <div class="acts">
                <button class="btn sm" [disabled]="busy()" (click)="resend()">{{ 'kids.resend' | t }}</button>
                <button class="btn sm light" (click)="editing.set(true)">{{ 'kids.otherEmail' | t }}</button>
              </div>
            }
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .sup { display: flex; gap: 12px; align-items: flex-start; padding: 16px; margin-top: 14px; border-radius: 22px; animation: fadeUp .5s var(--ease) both;
      background: color-mix(in oklab, var(--accent) 8%, var(--card-fill)); border: 1px solid color-mix(in oklab, var(--accent) 25%, var(--line)); }
    .sup[data-s="PAUSED"], .sup[data-s="REVOKED"], .sup[data-s="DECLINED"] { background: var(--warn-soft); border-color: color-mix(in oklab, var(--warn) 35%, var(--line)); }
    .ic { flex: 0 0 auto; width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; font-size: 22px; background: var(--card-fill); color: var(--accent); }
    .sup[data-s="PENDING"] .ic ion-icon { animation: tick 2s ease-in-out infinite; }
    @keyframes tick { 50% { transform: rotate(-12deg) scale(1.08); } }
    .sup[data-s="PAUSED"] .ic, .sup[data-s="REVOKED"] .ic, .sup[data-s="DECLINED"] .ic { color: var(--warn); }
    .tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; font-size: 14.5px; line-height: 1.45; } .tx span { color: var(--text-2); }
    .acts, .edit { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; } .edit .input { flex: 1 1 180px; height: 44px; }
  `],
})
export class SupervisionComponent {
  auth = inject(AuthService);
  i18n = inject(I18n);
  private api = inject(Api);
  private ui = inject(Ui);
  busy = signal(false);
  editing = signal(false);
  email = '';
  icon = computed(() => ({ PENDING: 'time-outline', APPROVED: 'shield-checkmark', PAUSED: 'pause', REVOKED: 'close-circle', DECLINED: 'close-circle' } as Record<string, string>)[this.auth.user()?.supervision?.status ?? 'PENDING']);

  async resend(email?: string) {
    this.busy.set(true);
    try {
      await this.api.guardianResend(email);
      this.ui.toast(this.i18n.t('kids.sent'));
      this.editing.set(false);
      this.auth.setUser(await this.api.me());
    } catch (e) { this.ui.error(e); }
    this.busy.set(false);
  }
}

/** Panoul părintelui: conturile pe care le supraveghează, activitatea lor și controalele (pauză, repornire, retragere). */
@Component({
  selector: 'cmp-children',
  imports: [IonIcon, TPipe, AvatarComponent],
  template: `
    @if (kids().length) {
      <div class="kids card pad">
        <h3><ion-icon name="people-outline"></ion-icon>{{ 'kids.title' | t }}</h3>
        @for (k of kids(); track k.id) {
          <div class="kid">
            <div class="row">
              <cmp-avatar [name]="k.username" [hue]="k.avatarHue" [size]="46" />
              <div class="who"><b>&#64;{{ k.username }}</b><span class="faint small">{{ 'kids.age' | t: { n: k.age } }} · {{ 'kids.status' + k.status | t }}</span></div>
            </div>
            <div class="nums">
              <span><b class="tnum">{{ k.activeListings }}</b>{{ 'kids.listings' | t }}</span>
              <span><b class="tnum">{{ k.openOrders }}</b>{{ 'kids.orders' | t }}</span>
            </div>
            @if (k.recentOrders.length) {
              <ul class="orders">
                @for (o of k.recentOrders; track o.id) {
                  <li><ion-icon [name]="o.role === 'SELLER' ? 'arrow-up' : 'bag-check-outline'"></ion-icon>
                    <span class="t">{{ 'kids.role' + o.role | t }} „{{ o.title }}”</span><b class="tnum">{{ i18n.price(o.totalCents, o.currency) }}</b></li>
                }
              </ul>
            } @else { <p class="faint small">{{ 'kids.noOrders' | t }}</p> }
            <div class="acts">
              @if (k.status === 'APPROVED') { <button class="btn sm light" [disabled]="busy()" (click)="act(k, 'pause')"><ion-icon name="pause"></ion-icon>{{ 'kids.pause' | t }}</button> }
              @if (k.status === 'PAUSED') { <button class="btn sm" [disabled]="busy()" (click)="act(k, 'resume')"><ion-icon name="play-outline"></ion-icon>{{ 'kids.resume' | t }}</button> }
              <button class="btn sm ghost danger" [disabled]="busy()" (click)="act(k, 'revoke')">{{ 'kids.revoke' | t }}</button>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .kids { margin-top: 14px; animation: fadeUp .5s var(--ease) both; }
    h3 { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; } h3 ion-icon { color: var(--accent); }
    .kid { padding: 14px 0 4px; border-top: 1px solid var(--line); } .kid:first-of-type { border-top: 0; }
    .row { display: flex; align-items: center; gap: 12px; } .who { display: flex; flex-direction: column; min-width: 0; }
    .nums { display: flex; gap: 10px; margin: 12px 0 8px; }
    .nums span { flex: 1; display: flex; flex-direction: column; padding: 10px 12px; border-radius: 16px; background: var(--surface-2); font-size: 13px; color: var(--text-2); }
    .nums b { font-family: var(--font-display); font-size: 22px; color: var(--text); }
    .orders { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .orders li { display: flex; align-items: center; gap: 8px; font-size: 14px; } .orders ion-icon { color: var(--accent); flex: 0 0 auto; }
    .orders .t { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-2); }
    .acts { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; } .danger { color: var(--accent-2); }
  `],
})
export class ChildrenComponent implements OnInit {
  private api = inject(Api);
  private ui = inject(Ui);
  i18n = inject(I18n);
  kids = signal<Child[]>([]);
  busy = signal(false);

  async ngOnInit() { try { this.kids.set(await this.api.guardianChildren()); } catch { /* nu e părinte */ } }

  async act(k: Child, action: 'pause' | 'resume' | 'revoke') {
    if (action !== 'resume' && !(await this.ui.confirm(this.i18n.t('kids.' + action + 'Confirm', { name: k.username }), this.i18n.t('kids.' + action)))) return;
    this.busy.set(true);
    try { await this.api.guardianControl(k.id, action); this.kids.set(await this.api.guardianChildren()); this.ui.tap(); }
    catch (e) { this.ui.error(e); }
    this.busy.set(false);
  }
}

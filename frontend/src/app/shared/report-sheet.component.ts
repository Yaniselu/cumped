import { Component, computed, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon, IonModal } from '@ionic/angular';
import { Api } from '../core/api.service';
import { I18n, TPipe } from '../core/i18n.service';
import { Ui } from '../core/ui.service';

export type ReportTarget = 'LISTING' | 'USER' | 'MESSAGE';

const REASONS: Record<ReportTarget, string[]> = {
  LISTING: ['FRAUD', 'PROHIBITED', 'COUNTERFEIT', 'IP_INFRINGEMENT', 'OFFENSIVE', 'SPAM', 'WRONG_CATEGORY', 'DUPLICATE', 'OTHER'],
  USER: ['FRAUD', 'OFFENSIVE', 'SPAM', 'OTHER'],
  MESSAGE: ['FRAUD', 'OFFENSIVE', 'SPAM', 'OTHER'],
};

/**
 * Raportare conform DSA (art. 16): motiv, explicație, confirmarea bunei-credințe.
 * Tichetul ajunge la Velo AI + echipa de moderare (contact@velosyntech.com); reclamantul primește decizia motivată.
 */
@Component({
  selector: 'cmp-report-sheet',
  imports: [IonModal, IonContent, IonIcon, FormsModule, TPipe],
  template: `
    <ion-modal [isOpen]="open()" (didDismiss)="open.set(false)" [initialBreakpoint]="0.92" [breakpoints]="[0, 0.92]">
      <ng-template>
        <ion-content>
          <div class="sb">
            @if (!done()) {
              <h2>{{ 'report.title.' + target() | t }}</h2>
              <p class="muted small">{{ 'report.sub' | t }}</p>
              <div class="reasons" role="radiogroup">
                @for (r of reasons(); track r) {
                  <button class="opt" role="radio" [attr.aria-checked]="reason() === r" [class.on]="reason() === r" (click)="reason.set(r)">
                    <span class="rd"></span><div><b>{{ 'report.reason.' + r | t }}</b><span>{{ 'report.reasonSub.' + r | t }}</span></div>
                  </button>
                }
              </div>
              <div class="field"><label>{{ 'report.details' | t }} @if (!needsDetails()) { <span class="faint">({{ 'common.optional' | t }})</span> }</label>
                <textarea class="input" rows="3" maxlength="2000" [(ngModel)]="details" [placeholder]="'report.detailsPh' | t"></textarea></div>
              @if (target() !== 'LISTING') {
                <button class="chk" (click)="alsoBlock.set(!alsoBlock())" [attr.aria-pressed]="alsoBlock()">
                  <span class="box" [class.on]="alsoBlock()"><ion-icon name="checkmark"></ion-icon></span>{{ 'report.alsoBlock' | t }}</button>
              }
              <button class="chk" (click)="goodFaith.set(!goodFaith())" [attr.aria-pressed]="goodFaith()">
                <span class="box" [class.on]="goodFaith()"><ion-icon name="checkmark"></ion-icon></span>{{ 'report.goodFaith' | t }}</button>
              @if (error()) { <div class="error-text">{{ error() }}</div> }
              <button class="btn block" [disabled]="!canSend() || busy()" (click)="send()"><ion-icon name="flag"></ion-icon>{{ 'report.send' | t }}</button>
              <p class="faint small">{{ 'report.legal' | t }}</p>
            } @else {
              <div class="ok fade">
                <span class="ic"><ion-icon name="shield-checkmark"></ion-icon></span>
                <h2>{{ 'report.thanks' | t }}</h2>
                <p class="muted">{{ 'report.thanksSub' | t: { ref: ticketRef() } }}</p>
                <button class="btn block" (click)="open.set(false)">{{ 'common.done' | t }}</button>
              </div>
            }
          </div>
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: [`
    .sb { padding: 22px 18px calc(env(safe-area-inset-bottom) + 28px); display: flex; flex-direction: column; gap: 12px; max-width: 560px; margin: 0 auto; }
    .reasons { display: flex; flex-direction: column; gap: 8px; }
    .opt { display: flex; align-items: center; gap: 12px; text-align: left; padding: 12px 14px; border-radius: 16px; border: 1.5px solid var(--line);
      background: var(--surface); color: var(--text); cursor: pointer; transition: border-color .2s, background .2s; }
    .opt div { display: flex; flex-direction: column; gap: 2px; min-width: 0; } .opt b { font-size: 14.5px; } .opt span { font-size: 12.5px; color: var(--text-2); }
    .opt.on { border-color: var(--accent); background: var(--accent-soft); }
    .rd { flex: 0 0 auto; width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--surface-3); transition: all .2s; }
    .opt.on .rd { border: 6px solid var(--accent); }
    .chk { display: flex; align-items: flex-start; gap: 10px; text-align: left; border: 0; background: none; color: var(--text); font-size: 13.5px; line-height: 1.45; padding: 4px 2px; cursor: pointer; }
    .box { flex: 0 0 auto; width: 22px; height: 22px; border-radius: 7px; border: 2px solid var(--surface-3); display: grid; place-items: center; color: transparent; transition: all .2s; }
    .box.on { background: var(--accent); border-color: var(--accent); color: #fff; }
    .ok { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding-top: 20px; }
    .ic { width: 80px; height: 80px; border-radius: 28px; display: grid; place-items: center; background: var(--ok-soft); color: var(--ok); font-size: 38px; animation: pop .7s var(--spring) both; }
  `],
})
export class ReportSheetComponent {
  private api = inject(Api);
  private i18n = inject(I18n);
  private ui = inject(Ui);
  open = model(false);
  target = input<ReportTarget>('LISTING');
  targetId = input('');
  /** Utilizatorul care ar fi blocat odată cu raportarea (pentru USER / MESSAGE). */
  userId = input('');
  blocked = output<void>();

  reasons = computed(() => REASONS[this.target()]);
  reason = signal('');
  details = '';
  alsoBlock = signal(false);
  goodFaith = signal(false);
  busy = signal(false);
  error = signal('');
  done = signal(false);
  ticketRef = signal('');
  needsDetails = computed(() => ['OTHER', 'IP_INFRINGEMENT'].includes(this.reason()));
  canSend = () => !!this.reason() && this.goodFaith() && (!this.needsDetails() || this.details.trim().length >= 10);

  async send() {
    this.busy.set(true);
    this.error.set('');
    try {
      const t = await this.api.report({ targetType: this.target(), targetId: this.targetId(), reason: this.reason(), details: this.details.trim() || undefined });
      this.ticketRef.set(t.code);
      if (this.alsoBlock() && this.userId()) { await this.api.block(this.userId()).catch(() => {}); this.blocked.emit(); }
      this.done.set(true);
      this.ui.tap();
    } catch (e) { this.error.set(this.ui.errorText(e)); }
    this.busy.set(false);
  }

  /** Resetare când se redeschide pentru altă țintă. */
  reset() { this.reason.set(''); this.details = ''; this.alsoBlock.set(false); this.goodFaith.set(false); this.done.set(false); this.error.set(''); }
}

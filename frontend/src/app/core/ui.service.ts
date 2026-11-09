import { Injectable, inject } from '@angular/core';
import { ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { errorCode } from './api.service';
import { I18n } from './i18n.service';

@Injectable({ providedIn: 'root' })
export class Ui {
  private toasts = inject(ToastController);
  private alerts = inject(AlertController);
  private sheets = inject(ActionSheetController);
  private i18n = inject(I18n);

  async toast(message: string, error = false) {
    const t = await this.toasts.create({ message, duration: 2600, position: 'top', cssClass: error ? 'err' : '' });
    await t.present();
  }

  error(e: any) {
    const code = errorCode(e);
    const key = `errors.${code}`;
    const msg = this.i18n.t(key);
    return this.toast(msg === key ? this.i18n.t('errors.UNKNOWN') : msg, true);
  }

  errorText(e: any): string {
    const key = `errors.${errorCode(e)}`;
    const msg = this.i18n.t(key);
    return msg === key ? this.i18n.t('errors.UNKNOWN') : msg;
  }

  async confirm(message: string, okText?: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      const a = await this.alerts.create({
        message,
        buttons: [
          { text: this.i18n.t('common.cancel'), role: 'cancel', handler: () => resolve(false) },
          { text: okText ?? this.i18n.t('common.confirm'), role: 'destructive', handler: () => resolve(true) },
        ],
      });
      await a.present();
    });
  }

  /** Câmp de text într-un dialog (ex. contestație). Întoarce textul sau null la anulare. */
  async prompt(header: string, message: string, placeholder = '', okText?: string, minLength = 1): Promise<string | null> {
    return new Promise(async (resolve) => {
      const a = await this.alerts.create({
        header, message, cssClass: 'cmp-alert',
        inputs: [{ name: 'v', type: 'textarea', placeholder, attributes: { maxlength: 2000, rows: 4 } }],
        buttons: [
          { text: this.i18n.t('common.cancel'), role: 'cancel', handler: () => resolve(null) },
          { text: okText ?? this.i18n.t('common.send'), handler: (d: any) => {
            const v = String(d?.v ?? '').trim();
            if (v.length < minLength) return false;
            resolve(v); return true;
          } },
        ],
      });
      a.onDidDismiss().then(() => resolve(null));
      await a.present();
    });
  }

  /** Meniu de acțiuni nativ (iOS/Android). Întoarce indexul butonului ales sau -1. */
  async sheet(header: string, buttons: { text: string; icon?: string; danger?: boolean }[]): Promise<number> {
    return new Promise(async (resolve) => {
      const s = await this.sheets.create({
        header, cssClass: 'cmp-sheet',
        buttons: [
          ...buttons.map((b, i) => ({ text: b.text, icon: b.icon, role: b.danger ? 'destructive' : undefined, handler: () => resolve(i) })),
          { text: this.i18n.t('common.cancel'), role: 'cancel', handler: () => resolve(-1) },
        ],
      });
      s.onDidDismiss().then(() => resolve(-1));
      await s.present();
    });
  }

  tap() { Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); }
}

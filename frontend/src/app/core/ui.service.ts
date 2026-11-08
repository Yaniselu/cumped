import { Injectable, inject } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { errorCode } from './api.service';
import { I18n } from './i18n.service';

@Injectable({ providedIn: 'root' })
export class Ui {
  private toasts = inject(ToastController);
  private alerts = inject(AlertController);
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

  tap() { Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}); }
}

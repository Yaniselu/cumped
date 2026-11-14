import { Injectable, NgZone, effect, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { NavController } from '@ionic/angular';
import { Api } from './api.service';
import { AuthService } from './auth.service';
import { Badges } from './badges.service';
import { I18n } from './i18n.service';
import { Ui } from './ui.service';

export type PushState = 'checking' | 'unsupported' | 'denied' | 'off' | 'on' | 'unavailable';
export interface NotificationPrefs { messages: boolean; offers: boolean; orders: boolean; alerts: boolean; account: boolean; }

const PROMPT_KEY = 'cmp_push_prompt';

/**
 * Alerte pe dispozitivul curent:
 *  - pe site: Web Push (service worker + cheia publică VAPID a serverului);
 *  - în aplicația iOS/Android: Firebase Cloud Messaging prin @capacitor/push-notifications.
 * Cât timp aplicația e deschisă, alertele apar ca mesaje în interior și contoarele se actualizează imediat.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private api = inject(Api);
  private auth = inject(AuthService);
  private badges = inject(Badges);
  private i18n = inject(I18n);
  private ui = inject(Ui);
  private nav = inject(NavController);
  private zone = inject(NgZone);
  /** „checking” până aflăm ce permite dispozitivul (fără ca invitația să apară și să dispară). */
  readonly state = signal<PushState>('checking');
  readonly native = Capacitor.isNativePlatform();
  private registration: ServiceWorkerRegistration | null = null;
  private vapidKey: string | null = null;
  private nativeEnabled = false;
  private started = false;

  constructor() {
    effect(() => { if (this.auth.loggedIn()) this.start(); });
    this.auth.onBeforeLogout(() => this.forgetDevice());
  }

  private async start() {
    if (this.started) { await this.resync(); return; }
    this.started = true;
    try {
      const cfg = await this.api.config();
      this.vapidKey = cfg.vapidPublicKey ?? null;
      this.nativeEnabled = !!cfg.nativePush;
    } catch { /* fără configurare nu pornim alertele */ }
    if (this.native) { await this.startNative(); return; }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window) || !this.vapidKey) {
      this.state.set('unsupported');
      return;
    }
    try { this.registration = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' }); }
    catch { this.state.set('unsupported'); return; }
    navigator.serviceWorker.addEventListener('message', (ev) => this.zone.run(() => this.onMessage(ev.data)));
    await this.resync();
  }

  /** Abonamentul existent al browserului e (re)legat de contul curent; starea afișată în setări. */
  private async resync() {
    if (this.native || !this.registration) return;
    if (Notification.permission === 'denied') { this.state.set('denied'); return; }
    const sub = await this.registration.pushManager.getSubscription();
    if (sub && Notification.permission === 'granted') {
      await this.send(sub).catch(() => {});
      this.state.set('on');
    } else this.state.set('off');
  }

  /** Doar la o acțiune a utilizatorului (browserele cer asta pentru fereastra de permisiune). */
  async enable(): Promise<boolean> {
    localStorage.setItem(PROMPT_KEY, String(Date.now()));
    if (this.native) return this.enableNative();
    if (!this.registration || !this.vapidKey) { this.state.set('unsupported'); return false; }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { this.state.set(perm === 'denied' ? 'denied' : 'off'); return false; }
    try {
      const sub = (await this.registration.pushManager.getSubscription())
        ?? (await this.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(this.vapidKey) }));
      await this.send(sub);
      this.state.set('on');
      return true;
    } catch (e) {
      this.ui.error(e);
      return false;
    }
  }

  async disable() {
    if (this.native) return;
    const sub = await this.registration?.pushManager.getSubscription();
    if (sub) {
      await this.api.pushUnsubscribe(sub.endpoint).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
    this.state.set(Notification.permission === 'denied' ? 'denied' : 'off');
  }

  /** La ieșirea din cont: dispozitivul nu mai primește alertele contului (important pe calculatoare folosite de mai mulți). */
  async forgetDevice() {
    try {
      if (this.native) {
        const token = localStorage.getItem('cmp_fcm_token');
        if (token) await this.api.pushUnsubscribe(token);
        return;
      }
      const sub = await this.registration?.pushManager.getSubscription();
      if (sub) await this.api.pushUnsubscribe(sub.endpoint);
    } catch { /* sesiunea poate fi deja închisă */ }
  }

  test() { return this.api.pushTest(); }

  /** Invitația discretă (o dată la 14 zile), doar dacă alertele se pot porni și nu au fost refuzate. */
  shouldPrompt(): boolean {
    if (this.state() !== 'off' || (this.native && !this.nativeEnabled)) return false;
    const last = Number(localStorage.getItem(PROMPT_KEY) || 0);
    return Date.now() - last > 14 * 24 * 3600 * 1000;
  }

  postpone() { localStorage.setItem(PROMPT_KEY, String(Date.now())); }

  private async send(sub: PushSubscription) {
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await this.api.pushSubscribe({ kind: 'WEB', endpoint: json.endpoint, keys: json.keys, platform: 'web', device: deviceLabel() });
  }

  private onMessage(msg: any) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.kind === 'cumped-push') {
      this.badges.refresh();
      const p = msg.payload ?? {};
      if (p.body) this.ui.toast(p.body);
    } else if (msg.kind === 'cumped-open' && typeof msg.url === 'string' && msg.url.startsWith('/')) {
      this.nav.navigateForward(msg.url);
    } else if (msg.kind === 'cumped-resubscribe') {
      this.resync();
    }
  }

  // ---------------- aplicația iOS / Android ----------------

  private async startNative() {
    if (!this.nativeEnabled) { this.state.set('unavailable'); return; }
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.checkPermissions();
    this.state.set(perm.receive === 'granted' ? 'on' : perm.receive === 'denied' ? 'denied' : 'off');
    await PushNotifications.addListener('registration', (t) => this.zone.run(async () => {
      localStorage.setItem('cmp_fcm_token', t.value);
      await this.api.pushSubscribe({ kind: 'FCM', token: t.value, platform: Capacitor.getPlatform() === 'ios' ? 'ios' : 'android', device: deviceLabel() }).catch(() => {});
      this.state.set('on');
    }));
    await PushNotifications.addListener('pushNotificationReceived', (n) => this.zone.run(() => {
      this.badges.refresh();
      if (n.body) this.ui.toast(n.body);
    }));
    await PushNotifications.addListener('pushNotificationActionPerformed', (a) => this.zone.run(() => {
      const url = a.notification.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) this.nav.navigateForward(url);
    }));
    if (perm.receive === 'granted') await PushNotifications.register();
  }

  private async enableNative(): Promise<boolean> {
    if (!this.nativeEnabled) { this.state.set('unavailable'); return false; }
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') { this.state.set('denied'); return false; }
    if (Capacitor.getPlatform() === 'android') {
      await PushNotifications.createChannel({ id: 'cumped', name: 'Cumped', importance: 4, visibility: 1 }).catch(() => {});
    }
    await PushNotifications.register();
    return true;
  }
}

function urlB64(s: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** „Chrome · Android” etc., ca utilizatorul să-și recunoască dispozitivele. */
function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'Linux';
  const app = Capacitor.isNativePlatform() ? 'Cumped' : /Edg\//.test(ua) ? 'Edge' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Browser';
  return `${app} · ${os}`;
}

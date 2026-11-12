import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Me } from './models';

interface AuthResponse { accessToken: string; expiresIn: number; user: Me; }

/**
 * Sesiunea: token-ul de acces stă DOAR în memorie (nu în localStorage, ca un script injectat să nu-l poată fura),
 * iar reîmprospătarea se face prin cookie httpOnly pe care JavaScript nu îl poate citi.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private base = environment.apiBase + '/api/auth';
  private token: string | null = null;
  private refreshTimer: any;
  private refreshing: Promise<boolean> | null = null;

  readonly user = signal<Me | null>(null);
  readonly ready = signal(false);
  readonly loggedIn = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  accessToken() { return this.token; }

  async init() {
    try { await this.refresh(); } finally { this.ready.set(true); }
  }

  async login(email: string, password: string) { this.apply(await this.post('/login', { email, password })); }

  async register(body: { email: string; password: string; username: string; referralCode?: string; country?: string; locale?: string; acceptTerms: boolean; adultConfirmed: boolean;
    website: string; elapsedMs: number; captchaToken?: string }) {
    this.apply(await this.post('/register', body));
  }

  async social(provider: 'google' | 'apple', idToken: string, locale: string, acceptTerms: boolean) {
    this.apply(await this.post(`/${provider}`, { idToken, locale, acceptTerms, adultConfirmed: acceptTerms }));
  }

  /** Reîmprospătează sesiunea; apelurile simultane împart aceeași cerere. */
  refresh(): Promise<boolean> {
    if (!this.refreshing) {
      this.refreshing = this.post('/refresh', {})
        .then((r) => { this.apply(r); return true; })
        .catch(() => { this.clear(); return false; })
        .finally(() => (this.refreshing = null));
    }
    return this.refreshing;
  }

  async logout(everywhere = false) {
    try { await this.post(everywhere ? '/logout-all' : '/logout', {}); } catch { /* sesiunea poate fi deja expirată */ }
    this.clear();
  }

  setUser(me: Me) { this.user.set(me); }

  private apply(r: AuthResponse) {
    this.token = r.accessToken;
    this.user.set(r.user);
    clearTimeout(this.refreshTimer);
    const ms = Math.max(30, r.expiresIn - 60) * 1000;
    this.refreshTimer = setTimeout(() => this.refresh(), ms);
  }

  private clear() {
    this.token = null;
    this.user.set(null);
    clearTimeout(this.refreshTimer);
  }

  private post(path: string, body: any) {
    return firstValueFrom(this.http.post<AuthResponse>(this.base + path, body, {
      withCredentials: true,
      headers: { 'X-Requested-With': 'cumped' },
    }));
  }
}

import { MOTION } from '../shared/motion.directives';
import { HoldButtonComponent } from '../shared/hold-button.component';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, NavController } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, TPipe } from '../core/i18n.service';
import { LegalDocs } from '../core/legal/types';
import { Company } from '../core/models';
import { Ui } from '../core/ui.service';
import { BackButtonComponent } from '../shared/back-button.component';

const DOCS = ['terms', 'privacy', 'rules', 'dsa', 'cookies', 'about', 'delete-account'];

/**
 * Pagini legale publice (fără cont): /legal/terms, /legal/privacy … și /delete-account (cerută de Google Play).
 * Textele sunt în română și engleză; celelalte limbi văd versiunea în engleză.
 */
@Component({
  selector: 'page-legal',
  imports: [MOTION, HoldButtonComponent, IonContent, IonIcon, RouterLink, TPipe, BackButtonComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <div class="page narrow">
        <div class="topbar"><cmp-back fallback="/home" /><div class="title">{{ 'legal.title' | t }}</div><div class="spacer"></div></div>
        @if (doc(); as d) {
          <article class="card pad doc fade">
            <h1>{{ d.title }}</h1>
            <p class="faint small">{{ 'legal.updated' | t: { date: i18n.date(d.updated, { day: 'numeric', month: 'long', year: 'numeric' }) } }}</p>
            <p class="draft small"><ion-icon name="information-circle-outline"></ion-icon>{{ 'legal.draft' | t }}</p>
            @for (s of d.sections; track s.h) {
              <section><h2>{{ s.h }}</h2>@for (p of s.p; track $index) { <p>{{ fill(p) }}</p> }</section>
            }
            @if (docId() === 'delete-account' && auth.loggedIn()) {
              <cmp-hold-button tone="danger" [block]="true" [caption]="true" icon="trash-outline" [duration]="1500" [busy]="deleting()" [label]="'settings.deleteAccount' | t"
            [confirmText]="'settings.deleteConfirm' | t" (confirmed)="deleteNow()" />
            }
          </article>
          <nav class="others">
            @for (o of others(); track o) { <a class="chip" [routerLink]="['/legal', o]">{{ 'legal.' + key(o) | t }}</a> }
          </nav>
        } @else { <div class="skeleton" style="height: 420px; border-radius: 24px"></div> }
      </div>
    </ion-content>
  `,
  styles: [`
    .doc h1 { font-size: 26px; line-height: 1.15; margin-bottom: 6px; overflow-wrap: anywhere; }
    .doc h2 { font-size: 17px; margin: 22px 0 8px; }
    .doc p { line-height: 1.6; font-size: 14.5px; color: var(--text-2); margin-top: 8px; overflow-wrap: anywhere; }
    .doc .draft { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 14px; background: var(--warn-soft); color: var(--warn); font-weight: 600; margin: 12px 0 4px; }
    .doc .draft ion-icon { flex: 0 0 auto; font-size: 17px; margin-top: 1px; }
    .doc .btn { margin-top: 22px; }
    .others { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  `],
})
export class LegalPage {
  i18n = inject(I18n);
  auth = inject(AuthService);
  private api = inject(Api);
  private ui = inject(Ui);
  private nav = inject(NavController);
  /** Parametrul din ruta /legal/:doc; ruta /delete-account îl setează prin data. */
  doc_ = input<string>(undefined, { alias: 'doc' });
  docId = computed(() => (DOCS.includes(this.doc_() ?? '') ? this.doc_()! : 'terms'));
  private docs = signal<LegalDocs | null>(null);
  private company = signal<Company | null>(null);
  doc = computed(() => this.docs()?.[this.docId()] ?? null);
  others = computed(() => DOCS.filter((d) => d !== this.docId()));

  constructor() {
    this.api.config().then((c) => this.company.set(c.company)).catch(() => {});
    effect(() => {
      const lang = this.i18n.lang();
      (lang === 'ro' ? import('../core/legal/ro') : import('../core/legal/en')).then((m) => this.docs.set(m.default));
    });
  }

  key(d: string) { return d === 'delete-account' ? 'deleteAccount' : d; }

  /** Completează datele firmei; câmpurile încă necompletate în configurare apar ca „[de completat]”. */
  fill(p: string) {
    const c = this.company();
    const v = (x: string | undefined) => (x && x.trim() ? x : '[—]');
    return p.replace(/\{company\}/g, v(c?.name)).replace(/\{address\}/g, v(c?.address)).replace(/\{regNo\}/g, v(c?.regNo))
      .replace(/\{vat\}/g, v(c?.vat)).replace(/\{email\}/g, v(c?.email)).replace(/\{dpo\}/g, v(c?.dpoEmail || c?.email));
  }

  deleting = signal(false);
  async deleteNow() {
    if (this.deleting()) return;
    this.deleting.set(true);
    try { await this.api.deleteAccount(); await this.auth.logout(); this.nav.navigateRoot('/welcome'); } catch (e) { this.ui.error(e); }
    this.deleting.set(false);
  }
}

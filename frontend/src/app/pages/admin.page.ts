import { MOTION } from '../shared/motion.directives';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonModal } from '@ionic/angular';
import { Api } from '../core/api.service';
import { I18n, TPipe } from '../core/i18n.service';
import { AdminTicket } from '../core/models';
import { Ui } from '../core/ui.service';
import { BackButtonComponent } from '../shared/back-button.component';
import { EmptyComponent } from '../shared/empty.component';

@Component({
  selector: 'page-admin',
  imports: [MOTION, IonContent, IonIcon, IonModal, RouterLink, TPipe, BackButtonComponent, EmptyComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <div class="page">
        <div class="topbar"><cmp-back fallback="/profile" /><div class="title">{{ 'admin.title' | t }}</div><button class="icon-btn" (click)="load()"><ion-icon name="arrow-up"></ion-icon></button></div>
        <div class="kpis">
          @for (k of keys; track k; let i = $index) {
            <div class="kpi card reveal" [style.--i]="i" [class.alert]="(k === 'pendingAutoActions' || k === 'openTickets') && (ov()[k] ?? 0) > 0">
              <strong>{{ ov()[k] ?? '—' }}</strong><span>{{ 'admin.' + k | t }}</span></div>
          }
        </div>
        <div class="section-head"><h2>{{ 'admin.tickets' | t }}</h2>
          <div class="row">@for (s of ['OPEN', 'RESOLVED', 'ALL']; track s) { <button class="chip" [class.active]="status() === s" (click)="status.set(s); load()">{{ 'admin.' + s.toLowerCase() | t }}</button> }</div></div>
        @if (!tickets().length) { <cmp-empty icon="checkmark-circle" title="0" /> }
        @for (t of tickets(); track t.id; let i = $index) {
          <button class="tk card press reveal" [style.--i]="i" (click)="open(t)">
            <span class="pri" [attr.data-p]="t.priority">{{ t.priority }}</span>
            <div class="mid">
              <div class="row"><strong>{{ t.code }}</strong><span class="badge accent">{{ t.category }}</span><span class="small faint">{{ t.source }}</span>
                @if (t.autoAction) { <span class="badge" [class.warn]="t.autoActionState === 'APPLIED'" [class.ok]="t.autoActionState !== 'APPLIED'">{{ 'admin.autoAction.' + t.autoAction | t }} · {{ t.autoActionState }}</span> }</div>
              <p class="sum">{{ t.summary }}</p>
              <span class="small muted">{{ 'admin.reporter' | t }}: {{ t.reporter ?? 'SYSTEM' }} → {{ 'admin.reported' | t }}: {{ t.reportedUser ?? '—' }} · {{ 'admin.risk' | t }} {{ t.risk }} · {{ i18n.ago(t.createdAt) }}</span>
            </div>
          </button>
        }
      </div>

      <ion-modal [isOpen]="!!sel()" (didDismiss)="sel.set(null)" [initialBreakpoint]="0.9" [breakpoints]="[0, 0.9]">
        <ng-template>
          <ion-content>
            @if (sel(); as s) {
              <div class="sheet">
                <div class="row between"><h2>{{ s.ticket.code }}</h2><span class="pri" [attr.data-p]="s.ticket.priority">{{ s.ticket.priority }}</span></div>
                <p>{{ s.ticket.summary }}</p>
                @if (s.ticket.relatedListingId) { <a class="chip" [routerLink]="['/listing', s.ticket.relatedListingId]" (click)="sel.set(null)"><ion-icon name="pricetag-outline"></ion-icon>{{ s.ticket.relatedListingTitle }}</a> }
                <div class="acts">
                  @if (s.ticket.autoActionState === 'APPLIED') {
                    <button class="btn sm" (click)="decide('confirm')">{{ 'admin.confirm' | t }}</button>
                    <button class="btn sm light" (click)="decide('revert')">{{ 'admin.revert' | t }}</button>
                  }
                  @if (s.ticket.status === 'OPEN') { <button class="btn sm light" (click)="decide('resolve')">{{ 'admin.resolve' | t }}</button> }
                  @else { <button class="btn sm light" (click)="decide('reopen')">{{ 'admin.reopen' | t }}</button> }
                </div>
                <h3>{{ 'admin.transcript' | t }}</h3>
                <pre class="tr">{{ s.transcript }}</pre>
              </div>
            }
          </ion-content>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: [`
    .kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; } @media (min-width: 900px) { .kpis { grid-template-columns: repeat(7, 1fr); } }
    .kpi { padding: 14px; display: flex; flex-direction: column; gap: 2px; } .kpi strong { font-family: var(--font-display); font-size: 28px; } .kpi span { font-size: 12px; color: var(--text-2); }
    .kpi.alert { background: var(--accent-2-soft); }
    .tk { display: flex; gap: 14px; width: 100%; padding: 14px; margin-bottom: 10px; text-align: left; color: var(--text); cursor: pointer; align-items: flex-start; }
    .pri { font-size: 11px; font-weight: 800; padding: 5px 9px; border-radius: 10px; background: var(--surface-2); flex: 0 0 auto; }
    .pri[data-p="URGENT"] { background: var(--accent-2); color: #fff; } .pri[data-p="HIGH"] { background: var(--accent-2-soft); color: var(--accent-2); } .pri[data-p="MEDIUM"] { background: var(--warn-soft); color: var(--warn); }
    .mid { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; } .mid .row { flex-wrap: wrap; gap: 6px; }
    .sum { font-size: 14px; line-height: 1.45; }
    .sheet { padding: 22px 20px 40px; display: flex; flex-direction: column; gap: 12px; }
    .acts { display: flex; flex-wrap: wrap; gap: 8px; }
    .tr { white-space: pre-wrap; font-size: 13px; line-height: 1.5; background: var(--surface); padding: 14px; border-radius: 16px; border: 1px solid var(--line); font-family: ui-monospace, monospace; }
  `],
})
export class AdminPage implements OnInit {
  private api = inject(Api);
  i18n = inject(I18n);
  private ui = inject(Ui);
  keys = ['openTickets', 'pendingAutoActions', 'blockedMessages24h', 'users', 'verifiedUsers', 'activeListings', 'pendingEmails'];
  ov = signal<Record<string, number>>({});
  tickets = signal<AdminTicket[]>([]);
  status = signal('OPEN');
  sel = signal<{ ticket: AdminTicket; transcript: string } | null>(null);

  ngOnInit() { this.load(); }
  async load() {
    try { const [o, t] = await Promise.all([this.api.adminOverview(), this.api.adminTickets(this.status())]); this.ov.set(o); this.tickets.set(t); }
    catch (e) { this.ui.error(e); }
  }
  async open(t: AdminTicket) { try { this.sel.set(await this.api.adminTicket(t.id)); } catch (e) { this.ui.error(e); } }
  async decide(action: string) {
    const s = this.sel();
    if (!s) return;
    try { await this.api.adminDecide(s.ticket.id, action); this.sel.set(null); this.ui.toast('✓'); this.load(); } catch (e) { this.ui.error(e); }
  }
}

import { MOTION } from '../shared/motion.directives';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonModal } from '@ionic/angular';
import { Api } from '../core/api.service';
import { I18n, TPipe } from '../core/i18n.service';
import { AdminDispute, AdminTicket } from '../core/models';
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
        @if (disputes().length) {
          <div class="section-head"><h2>{{ 'admin.disputes' | t }}</h2></div>
          @for (d of disputes(); track d.order.id) {
            @let o = d.order;
            <div class="card pad dsp">
              <div class="row between"><b>{{ o.code }} · {{ o.listing?.title }}</b><span class="pri" data-p="HIGH">{{ 'orders.reasons.' + o.disputeReason | t }}</span></div>
              <p class="muted small tnum">{{ i18n.price(o.totalCents, o.currency) }} · {{ 'neg.seller' | t }}: {{ o.counterpart?.displayName }} · {{ 'orders.status.' + o.status | t }}</p>
              <div class="flags">
                @if (d.buyerDisputes90d >= 3) { <span class="fl bad">{{ 'admin.f.manyClaims' | t: { n: d.buyerDisputes90d } }}</span> }
                @if (d.buyerLost12m > 0) { <span class="fl bad">{{ 'admin.f.buyerLost' | t: { n: d.buyerLost12m } }}</span> }
                @if (d.sellerLost12m > 0) { <span class="fl warn">{{ 'admin.f.sellerLost' | t: { n: d.sellerLost12m } }}</span> }
                @if (o.evidence.serialMismatch) { <span class="fl bad">{{ 'protect.mismatch' | t }}</span> }
                @else if (o.evidence.disputeSerial) { <span class="fl ok">{{ 'protect.match' | t }}</span> }
                @if (o.evidence.shipProof.length) { <span class="fl ok">{{ 'admin.f.shipProof' | t: { n: o.evidence.shipProof.length } }}</span> }
                @if (o.evidence.sellerResponse) { <span class="fl">{{ 'admin.f.sellerAnswered' | t }}</span> }
              </div>
              @if (o.evidence.disputeDetails) { <p class="q"><b>{{ 'neg.buyer' | t }}:</b> {{ o.evidence.disputeDetails }}</p> }
              @if (o.evidence.sellerResponse) { <p class="q"><b>{{ 'neg.seller' | t }}:</b> {{ o.evidence.sellerResponse }}</p> }
              @for (g of [['protect.shipEvidence', o.evidence.shipProof], ['protect.claim', o.evidence.disputeEvidence], ['protect.sellerAnswer', o.evidence.sellerEvidence]]; track $index) {
                @if ($any(g[1]).length) {
                  <span class="faint small">{{ $any(g[0]) | t }}</span>
                  <div class="pics">@for (u of $any(g[1]); track u) { <a [href]="api.url(u)" target="_blank" rel="noopener"><img [src]="api.url(u)" alt="" loading="lazy" /></a> }</div>
                }
              }
              @if (o.evidence.serialNumber) { <p class="small tnum">{{ 'protect.serialShort' | t }}: <b>{{ o.evidence.serialNumber }}</b>
                @if (o.evidence.disputeSerial) { · {{ 'protect.reportedSerial' | t }}: <b>{{ o.evidence.disputeSerial }}</b> }</p> }
              @if (o.status === 'DISPUTED') {
                <div class="row wrap">
                  <button class="btn sm" (click)="resolve(o.id, 'RETURN')">{{ 'admin.return' | t }}</button>
                  <button class="btn sm light" (click)="resolve(o.id, 'REFUND')">{{ 'admin.refund' | t }}</button>
                  <button class="btn sm light" (click)="resolve(o.id, 'RELEASE')">{{ 'admin.release' | t }}</button>
                </div>
                <p class="faint small">{{ 'admin.returnHint' | t }}</p>
              } @else { <p class="faint small">{{ 'admin.waitingReturn' | t }}</p> }
            </div>
          }
        }
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

      <ion-modal [isOpen]="!!sel()" (didDismiss)="sel.set(null)" [initialBreakpoint]="0.9" [breakpoints]="[0, 0.9, 1]">
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
    .kpi { padding: 14px; display: flex; flex-direction: column; gap: 2px; } .kpi strong { font-family: var(--font-display); font-size: 28px; } .kpi span { font-size: 13px; color: var(--text-2); }
    .kpi.alert { background: var(--accent-2-soft); }
    .tk { display: flex; gap: 14px; width: 100%; padding: 14px; margin-bottom: 10px; text-align: left; color: var(--text); cursor: pointer; align-items: flex-start; }
    .pri { font-size: 12.5px; font-weight: 800; padding: 5px 9px; border-radius: 10px; background: var(--surface-2); flex: 0 0 auto; }
    .pri[data-p="URGENT"] { background: var(--accent-2); color: #fff; } .pri[data-p="HIGH"] { background: var(--accent-2-soft); color: var(--accent-2); } .pri[data-p="MEDIUM"] { background: var(--warn-soft); color: var(--warn); }
    .mid { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; } .mid .row { flex-wrap: wrap; gap: 6px; }
    .sum { font-size: 15px; line-height: 1.45; }
    .sheet { padding: 22px max(20px, env(safe-area-inset-right) + 12px) calc(env(safe-area-inset-bottom) + 40px) max(20px, env(safe-area-inset-left) + 12px); display: flex; flex-direction: column; gap: 12px; }
    .acts { display: flex; flex-wrap: wrap; gap: 8px; }
    .dsp { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .flags { display: flex; flex-wrap: wrap; gap: 6px; }
    .fl { font-size: 13px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: var(--surface-2); color: var(--text-2); }
    .fl.bad { background: var(--accent-2-soft); color: var(--accent-2); } .fl.warn { background: var(--warn-soft); color: var(--warn); } .fl.ok { background: var(--ok-soft); color: var(--ok); }
    .q { margin: 0; font-size: 15px; line-height: 1.5; max-width: 68ch; }
    .pics { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 6px; }
    .pics a { display: block; aspect-ratio: 1; border-radius: 10px; overflow: hidden; } .pics img { width: 100%; height: 100%; object-fit: cover; }
    .row.wrap { flex-wrap: wrap; gap: 8px; }
    .tr { white-space: pre-wrap; font-size: 14px; line-height: 1.5; background: var(--surface); padding: 14px; border-radius: 16px; border: 1px solid var(--line); font-family: ui-monospace, monospace; }
  `],
})
export class AdminPage implements OnInit {
  api = inject(Api);
  i18n = inject(I18n);
  private ui = inject(Ui);
  keys = ['openTickets', 'pendingAutoActions', 'blockedMessages24h', 'users', 'verifiedUsers', 'activeListings', 'pendingEmails'];
  ov = signal<Record<string, number>>({});
  tickets = signal<AdminTicket[]>([]);
  disputes = signal<AdminDispute[]>([]);
  status = signal('OPEN');
  sel = signal<{ ticket: AdminTicket; transcript: string } | null>(null);

  ngOnInit() { this.load(); }
  async load() {
    try { const [o, t] = await Promise.all([this.api.adminOverview(), this.api.adminTickets(this.status())]); this.ov.set(o); this.tickets.set(t); }
    catch (e) { this.ui.error(e); }
    this.api.disputedOrders().then((d) => this.disputes.set(d)).catch(() => {});
  }

  async resolve(id: string, outcome: 'RETURN' | 'REFUND' | 'RELEASE') {
    const msg = { RETURN: 'admin.returnConfirm', REFUND: 'admin.refundConfirm', RELEASE: 'admin.releaseConfirm' }[outcome];
    if (!(await this.ui.confirm(this.i18n.t(msg), this.i18n.t('common.confirm')))) return;
    try { await this.api.resolveOrder(id, outcome); this.ui.toast(this.i18n.t('admin.done')); this.api.disputedOrders().then((d) => this.disputes.set(d)).catch(() => {}); }
    catch (e) { this.ui.error(e); }
  }
  async open(t: AdminTicket) { try { this.sel.set(await this.api.adminTicket(t.id)); } catch (e) { this.ui.error(e); } }
  async decide(action: string) {
    const s = this.sel();
    if (!s) return;
    try { await this.api.adminDecide(s.ticket.id, action); this.sel.set(null); this.ui.toast('✓'); this.load(); } catch (e) { this.ui.error(e); }
  }
}

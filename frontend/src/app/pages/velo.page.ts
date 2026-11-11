import { MOTION } from '../shared/motion.directives';
import { Component, OnInit, ViewChild, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonFooter, IonIcon } from '@ionic/angular';
import { Api } from '../core/api.service';
import { I18n, TPipe } from '../core/i18n.service';
import { Ticket } from '../core/models';
import { Ui } from '../core/ui.service';
import { BackButtonComponent } from '../shared/back-button.component';

interface Bubble { from: 'me' | 'velo'; text: string; ticket?: Ticket | null; }

@Component({
  selector: 'page-velo',
  imports: [MOTION, IonContent, IonFooter, IonIcon, FormsModule, TPipe, BackButtonComponent],
  template: `
    <ion-content cmpScrollFx #content [fullscreen]="true">
      <div class="page narrow">
        <div class="head glass">
          <cmp-back />
          <div class="orb"><span>V</span></div>
          <div class="who"><strong>{{ 'velo.title' | t }}</strong><span class="small muted"><i class="live"></i>{{ 'velo.subtitle' | t }}</span></div>
        </div>

        <div class="msgs">
          @for (m of bubbles(); track $index) {
            <div class="msg" [class.me]="m.from === 'me'">
              @if (m.from === 'velo') { <span class="mini">V</span> }
              <div class="bubble">{{ m.text }}
                @if (m.ticket; as t) {
                  <div class="ticket">
                    <div class="row between"><strong><ion-icon name="ticket-outline"></ion-icon> {{ 'velo.ticket' | t: { code: t.code } }}</strong><span class="badge bad">{{ t.priority }}</span></div>
                    <span class="small">{{ 'velo.ticketSent' | t }} · {{ t.category }}</span>
                    @if (t.autoAction === 'HIDE_LISTING') { <span class="auto"><ion-icon name="shield-checkmark"></ion-icon>{{ 'velo.autoAction' | t }}</span> }
                    @if (t.autoAction === 'SUSPEND_USER') { <span class="auto"><ion-icon name="shield-checkmark"></ion-icon>{{ 'velo.autoSuspend' | t }}</span> }
                  </div>
                }
              </div>
            </div>
          }
          @if (typing()) { <div class="msg"><span class="mini">V</span><div class="bubble typing"><i></i><i></i><i></i></div></div> }
        </div>

        @if (suggestions().length) {
          <div class="sugg">@for (s of suggestions(); track s) { <button class="chip" (click)="send(s)">{{ s }}</button> }</div>
        }

        @if (tickets().length) {
          <div class="section-head"><h2>{{ 'velo.myTickets' | t }}</h2></div>
          @for (t of tickets(); track t.id) {
            <div class="trow card"><ion-icon name="ticket-outline"></ion-icon><div><strong>{{ t.code }}</strong><span class="small muted">{{ t.category }} · {{ i18n.ago(t.createdAt) }}</span></div><span class="badge accent">{{ t.status }}</span></div>
          }
        }
      </div>
    </ion-content>
    <ion-footer class="ion-no-border">
      <form class="composer glass" (ngSubmit)="send(text)">
        <textarea [(ngModel)]="text" name="t" rows="1" maxlength="1500" [placeholder]="'velo.placeholder' | t"></textarea>
        <button class="sendbtn" [disabled]="!text.trim() || typing()"><ion-icon name="send"></ion-icon></button>
      </form>
    </ion-footer>
  `,
  styles: [`
    .head { position: sticky; top: calc(env(safe-area-inset-top) + 8px); z-index: 5; display: flex; align-items: center; gap: 10px; padding: 6px 14px 6px 6px; border-radius: 999px; margin-bottom: 18px; }
    .head .icon-btn { width: 42px; height: 42px; }
    .orb { position: relative; width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 800; font-family: var(--font-display);
      background: conic-gradient(from 0deg, #5b3df5, #ff5a4e, #8b6dff, #5b3df5); animation: spinSlow 6s linear infinite; }
    .orb span { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: #141416; animation: spinSlow 6s linear infinite reverse; }
    .who { display: flex; flex-direction: column; }
    .live { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--ok); margin-right: 6px; vertical-align: 1px; }
    .msgs { display: flex; flex-direction: column; gap: 12px; }
    .msg { display: flex; gap: 8px; align-items: flex-end; max-width: 88%; animation: msgIn .45s var(--spring) both; }
    @keyframes msgIn { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: none; } }
    .msg.me { align-self: flex-end; }
    .mini { width: 28px; height: 28px; border-radius: 50%; flex: 0 0 auto; display: grid; place-items: center; color: #fff; font-size: 13px; font-weight: 800; background: linear-gradient(135deg, #5b3df5, #ff5a4e); }
    .bubble { padding: 12px 15px; border-radius: 22px 22px 22px 8px; background: var(--surface); box-shadow: var(--shadow-card); border: 1px solid var(--line); line-height: 1.5; font-size: 16px; white-space: pre-wrap; }
    .me .bubble { border-radius: 22px 22px 8px 22px; background: var(--btn-dark); color: var(--btn-dark-text); border: 0; }
    .typing { display: flex; gap: 5px; padding: 16px; } .typing i { width: 8px; height: 8px; border-radius: 50%; background: var(--text-3); animation: bounce 1.2s infinite; }
    .typing i:nth-child(2) { animation-delay: .15s; } .typing i:nth-child(3) { animation-delay: .3s; }
    @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-6px); opacity: 1; } }
    .ticket { margin-top: 12px; padding: 12px; border-radius: 16px; background: var(--surface-2); display: flex; flex-direction: column; gap: 6px; }
    .ticket strong { display: inline-flex; align-items: center; gap: 6px; }
    .auto { display: flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 600; color: var(--ok); }
    .sugg { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .trow { display: flex; align-items: center; gap: 12px; padding: 12px 14px; margin-bottom: 8px; } .trow > ion-icon { font-size: 22px; color: var(--accent); }
    .trow div { flex: 1; display: flex; flex-direction: column; }
    ion-footer { background: transparent; }
    .composer { display: flex; align-items: flex-end; gap: 8px; margin: 0 auto calc(env(safe-area-inset-bottom) + 12px); width: min(640px, calc(100% - 24px)); padding: 7px 7px 7px 18px; border-radius: 28px; }
    textarea { flex: 1; border: 0; outline: none; resize: none; background: transparent; font-family: inherit; font-size: 16px; color: var(--text); max-height: 120px; padding: 12px 0; }
    .sendbtn { width: 46px; height: 46px; border-radius: 50%; border: 0; background: var(--btn-dark); color: var(--btn-dark-text); display: grid; place-items: center; cursor: pointer; }
    .sendbtn:disabled { opacity: .35; }
  `],
})
export class VeloPage implements OnInit {
  private api = inject(Api);
  i18n = inject(I18n);
  private ui = inject(Ui);
  @ViewChild('content') content!: IonContent;
  listingId = input<string>();
  reportedUserId = input<string>();
  bubbles = signal<Bubble[]>([]);
  suggestions = signal<string[]>([]);
  tickets = signal<Ticket[]>([]);
  typing = signal(false);
  mode = signal<'AI' | 'RULES'>('RULES');
  text = '';
  private sessionId?: string;

  async ngOnInit() {
    this.bubbles.set([{ from: 'velo', text: this.i18n.t('velo.greeting') }]);
    this.suggestions.set(['scam', 'parcel', 'promote', 'verify'].map((k) => this.i18n.t('velo.quick.' + k)));
    if (this.reportedUserId()) this.text = this.i18n.t('velo.quick.scam') + ': ';
    try { this.tickets.set(await this.api.myTickets()); } catch { /* ignore */ }
  }

  async send(raw: string) {
    const message = raw.trim();
    if (!message || this.typing()) return;
    this.text = '';
    this.suggestions.set([]);
    this.bubbles.update((b) => [...b, { from: 'me', text: message }]);
    this.typing.set(true);
    this.scroll();
    try {
      const r = await this.api.velo({ sessionId: this.sessionId, message, listingId: this.listingId(), reportedUserId: this.reportedUserId() });
      this.sessionId = r.sessionId;
      this.mode.set(r.mode);
      await new Promise((res) => setTimeout(res, 450));
      const isNewTicket = r.ticket && !this.bubbles().some((b) => b.ticket?.id === r.ticket!.id);
      this.bubbles.update((b) => [...b, { from: 'velo', text: r.reply, ticket: isNewTicket ? r.ticket : null }]);
      this.suggestions.set(r.suggestions ?? []);
      if (isNewTicket) { this.ui.tap(); this.tickets.set(await this.api.myTickets()); }
    } catch (e) { this.ui.error(e); }
    this.typing.set(false);
    this.scroll();
  }

  private scroll() { setTimeout(() => this.content?.scrollToBottom(300), 40); }
}

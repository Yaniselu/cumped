import { MOTION } from '../shared/motion.directives';
import { Component, ElementRef, ViewChild, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonFooter, IonIcon, NavController, ViewDidLeave, ViewWillEnter } from '@ionic/angular';
import { Api, errorCode } from '../core/api.service';
import { Badges } from '../core/badges.service';
import { I18n, TPipe } from '../core/i18n.service';
import { ChatMessage, ConversationSummary } from '../core/models';
import { Ui } from '../core/ui.service';
import { AvatarComponent } from '../shared/avatar.component';
import { BackButtonComponent } from '../shared/back-button.component';

@Component({
  selector: 'page-chat',
  imports: [MOTION, IonContent, IonFooter, IonIcon, FormsModule, RouterLink, TPipe, AvatarComponent, BackButtonComponent],
  template: `
    <ion-content cmpScrollFx #content [fullscreen]="true">
      <div class="page narrow chat">
        <div class="head glass">
          <cmp-back fallback="/chats" />
          @if (conv(); as c) {
            <a class="who" [routerLink]="['/user', c.other.id]">
              <cmp-avatar [name]="c.other.displayName" [hue]="c.other.avatarHue" [size]="40" [verified]="c.other.idVerified" />
              <div><strong>{{ c.other.displayName }}</strong><span class="small muted">{{ (c.role === 'BUYER' ? 'chat.seller' : 'chat.buyer') | t }}
                @if (c.other.idVerified) { · <ion-icon name="shield-checkmark" class="vf"></ion-icon> {{ 'common.verified' | t }} }</span></div>
            </a>
            <button class="icon-btn sm" (click)="report()" [attr.aria-label]="'chat.reportUser' | t"><ion-icon name="flag-outline"></ion-icon></button>
          }
        </div>
        @if (conv(); as c) {
          <a class="lst card press" [routerLink]="['/listing', c.listing.id]">
            <img [src]="api.url(c.listing.imageUrl)" alt="" /><div><span class="small">{{ c.listing.title }}</span><strong>{{ i18n.price(c.listing.priceCents, c.listing.currency) }}</strong></div>
            <ion-icon name="chevron-forward" class="faint"></ion-icon>
          </a>
        }
        <div class="safety"><ion-icon name="shield-checkmark"></ion-icon>{{ 'chat.safety' | t }}</div>
        <div class="msgs">
          @for (m of messages(); track m.id; let i = $index) {
            <div class="msg" [class.mine]="m.mine" [class.fresh]="i >= freshFrom">
              <div class="bubble">{{ m.body }}</div>
              @if (m.flagged && m.flagReason) {
                <div class="flag" [class.danger]="m.flagReason === 'PAYMENT_LINK' || m.flagReason === 'OFF_PLATFORM_CHAT' || m.flagReason === 'RISKY_PAYMENT'">
                  <ion-icon name="warning"></ion-icon>{{ 'chat.flag.' + m.flagReason | t }}
                  @if (!m.mine) { <button (click)="report()">{{ 'chat.reportUser' | t }}</button> }
                </div>
              }
              <span class="time">{{ i18n.date(m.createdAt, { hour: '2-digit', minute: '2-digit' }) }}@if (m.mine && m.read) { · ✓✓ }</span>
            </div>
          }
        </div>
        @if (blocked()) { <div class="blocked fade"><ion-icon name="shield-checkmark"></ion-icon>{{ 'errors.MESSAGE_BLOCKED' | t }}</div> }
      </div>
    </ion-content>
    <ion-footer class="ion-no-border">
      <form class="composer glass" (ngSubmit)="send()">
        <textarea [(ngModel)]="text" name="text" rows="1" maxlength="2000" [placeholder]="'chat.placeholder' | t" (keydown.enter)="enter($event)"></textarea>
        <button class="sendbtn" [disabled]="!text.trim() || sending()"><ion-icon name="send"></ion-icon></button>
      </form>
    </ion-footer>
  `,
  styles: [`
    .chat { padding-bottom: 20px; }
    .head { position: sticky; top: calc(env(safe-area-inset-top) + 8px); z-index: 5; display: flex; align-items: center; gap: 10px; padding: 6px; border-radius: 999px; margin-bottom: 12px; }
    .head .icon-btn:first-child { width: 42px; height: 42px; }
    .who { flex: 1; display: flex; align-items: center; gap: 10px; color: inherit; min-width: 0; }
    .who div { display: flex; flex-direction: column; min-width: 0; } .vf { color: var(--accent); vertical-align: -2px; }
    .lst { display: flex; align-items: center; gap: 12px; padding: 8px 12px 8px 8px; color: inherit; }
    .lst img { width: 48px; height: 48px; border-radius: 14px; object-fit: cover; background: var(--image-bg); }
    .lst div { flex: 1; display: flex; flex-direction: column; min-width: 0; } .lst span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .safety { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; color: var(--text-2); background: var(--ok-soft); padding: 10px 14px; border-radius: 16px; margin: 12px 0 18px; line-height: 1.45; }
    .safety ion-icon { color: var(--ok); font-size: 18px; flex: 0 0 auto; }
    .msgs { display: flex; flex-direction: column; gap: 10px; }
    .msg { display: flex; flex-direction: column; align-items: flex-start; max-width: 82%; }
    .msg.mine { align-self: flex-end; align-items: flex-end; }
    .msg.fresh { animation: msgIn .45s var(--spring) both; }
    @keyframes msgIn { from { opacity: 0; transform: translateY(12px) scale(.96); } to { opacity: 1; transform: none; } }
    .bubble { padding: 11px 15px; border-radius: 22px 22px 22px 8px; background: var(--surface); box-shadow: var(--shadow-card); border: 1px solid var(--line); line-height: 1.45; font-size: 15px; white-space: pre-wrap; word-break: break-word; }
    .mine .bubble { border-radius: 22px 22px 8px 22px; background: var(--btn-dark); color: var(--btn-dark-text); border: 0; }
    .flag { margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--warn); background: var(--warn-soft); padding: 7px 10px; border-radius: 12px; }
    .flag.danger { color: var(--accent-2); background: var(--accent-2-soft); }
    .flag button { border: 0; background: rgba(0,0,0,.06); color: inherit; font-weight: 700; padding: 4px 8px; border-radius: 8px; cursor: pointer; }
    .time { font-size: 11px; color: var(--text-3); margin: 4px 6px 0; }
    .blocked { display: flex; gap: 8px; align-items: center; margin-top: 14px; padding: 12px 14px; border-radius: 16px; background: var(--accent-2-soft); color: var(--accent-2); font-size: 13px; font-weight: 600; }
    ion-footer { background: transparent; }
    .composer { display: flex; align-items: flex-end; gap: 8px; margin: 0 auto calc(env(safe-area-inset-bottom) + 12px); width: min(640px, calc(100% - 24px)); padding: 7px 7px 7px 18px; border-radius: 28px; }
    textarea { flex: 1; border: 0; outline: none; resize: none; background: transparent; font-family: inherit; font-size: 15.5px; color: var(--text); max-height: 120px; padding: 12px 0; }
    .sendbtn { width: 46px; height: 46px; border-radius: 50%; border: 0; background: var(--btn-dark); color: var(--btn-dark-text); display: grid; place-items: center; cursor: pointer; transition: transform .3s var(--spring), opacity .2s; }
    .sendbtn:disabled { opacity: .35; } .sendbtn:active { transform: scale(.88) rotate(-12deg); } .sendbtn ion-icon { font-size: 19px; }
  `],
})
export class ChatPage implements ViewWillEnter, ViewDidLeave {
  api = inject(Api);
  i18n = inject(I18n);
  private ui = inject(Ui);
  private nav = inject(NavController);
  private badges = inject(Badges);
  @ViewChild('content') content!: IonContent;
  id = input.required<string>();
  draft = input<string>();
  conv = signal<ConversationSummary | null>(null);
  messages = signal<ChatMessage[]>([]);
  sending = signal(false);
  blocked = signal(false);
  text = '';
  freshFrom = 0;
  private poll: any;

  async ionViewWillEnter() {
    if (this.draft() && !this.text) this.text = this.draft()!;
    await this.load(true);
    this.poll = setInterval(() => this.load(false), 4000);
  }
  ionViewDidLeave() { clearInterval(this.poll); }

  async load(first: boolean) {
    try {
      const t = await this.api.thread(this.id());
      this.conv.set(t.conversation);
      const before = this.messages().length;
      if (first) this.freshFrom = t.messages.length;
      if (t.messages.length !== before || first) {
        this.messages.set(t.messages);
        setTimeout(() => this.content?.scrollToBottom(first ? 0 : 300), 30);
      }
      if (first) this.badges.refresh();
    } catch (e) { if (first) { this.ui.error(e); this.nav.navigateRoot('/chats'); } }
  }

  enter(ev: Event) {
    const k = ev as KeyboardEvent;
    if (!k.shiftKey && window.innerWidth > 768) { k.preventDefault(); this.send(); }
  }

  async send() {
    const body = this.text.trim();
    if (!body) return;
    this.sending.set(true);
    this.blocked.set(false);
    try {
      const r = await this.api.sendMessage(this.id(), body);
      this.text = '';
      this.messages.update((m) => [...m, r.message]);
      this.ui.tap();
      setTimeout(() => this.content?.scrollToBottom(300), 30);
    } catch (e) {
      if (errorCode(e) === 'MESSAGE_BLOCKED') this.blocked.set(true); else this.ui.error(e);
    }
    this.sending.set(false);
  }

  report() {
    const c = this.conv();
    if (c) this.nav.navigateForward(['/support'], { queryParams: { listingId: c.listing.id, reportedUserId: c.other.id } });
  }
}

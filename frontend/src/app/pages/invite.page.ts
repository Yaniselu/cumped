import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { Api } from '../core/api.service';
import { I18n, TPipe } from '../core/i18n.service';
import { ReferralOverview } from '../core/models';
import { Motion } from '../core/motion.service';
import { Ui } from '../core/ui.service';
import { AvatarComponent } from '../shared/avatar.component';
import { BackButtonComponent } from '../shared/back-button.component';
import { MOTION } from '../shared/motion.directives';

/**
 * „Invită prieteni”: codul și linkul, progresul până la următoarea recompensă (inel animat), cum funcționează,
 * pragurile atinse, creditele gratuite și prietenii înscriși (doar username-ul lor public).
 */
@Component({
  selector: 'page-invite',
  imports: [MOTION, IonContent, IonIcon, RouterLink, TPipe, AvatarComponent, BackButtonComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <div class="page narrow">
        <div class="topbar"><cmp-back fallback="/profile" /><div class="title">{{ 'ref.title' | t }}</div><div class="spacer"></div></div>
        @if (!d()) {
          <div class="skeleton" style="height:300px; border-radius: 30px"></div>
          <div class="skeleton" style="height:140px; border-radius: 24px; margin-top: 14px"></div>
        } @else {
          @let o = d()!;
          <section class="hero reveal">
            <span class="glow g1" aria-hidden="true"></span><span class="glow g2" aria-hidden="true"></span>
            <div class="ringwrap">
              <svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
                <circle class="track" cx="60" cy="60" r="54" />
                <circle class="bar" cx="60" cy="60" r="54" [style.stroke-dashoffset]="dash()" />
              </svg>
              <div class="center">
                <b class="tnum"><span [cmpCount]="inRound()"></span><small>/{{ o.perReward }}</small></b>
                <span>{{ 'ref.verifiedShort' | t }}</span>
              </div>
              <span class="gift" aria-hidden="true"><ion-icon name="gift-outline"></ion-icon></span>
            </div>
            <h1>{{ 'ref.hero' | t }}</h1>
            <p>{{ 'ref.progress' | t: { n: o.toNext } }}</p>
            <div class="stats">
              <div><b class="tnum" [cmpCount]="o.registered"></b><span>{{ 'ref.registered' | t }}</span></div>
              <div><b class="tnum" [cmpCount]="o.verified"></b><span>{{ 'ref.verified' | t }}</span></div>
              <div><b class="tnum" [cmpCount]="o.rewards.length"></b><span>{{ 'ref.rewardsShort' | t }}</span></div>
            </div>
          </section>

          <section class="card pad share reveal" style="--i:1">
            <span class="lbl">{{ 'ref.yourCode' | t }}</span>
            <div class="code" [attr.aria-label]="o.code">
              @for (ch of codeChars(); track $index) { <span [style.--i]="$index">{{ ch }}</span> }
            </div>
            <button #shareBtn class="btn block" (click)="share()"><ion-icon name="share-social-outline"></ion-icon>{{ 'ref.share' | t }}</button>
            <div class="row2">
              <button class="btn light" (click)="copy(o.link, $event)"><ion-icon name="copy-outline"></ion-icon>{{ 'ref.copyLink' | t }}</button>
              <button class="btn light" (click)="copy(o.code, $event)"><ion-icon name="copy-outline"></ion-icon>{{ 'ref.copyCode' | t }}</button>
            </div>
          </section>

          <section class="card pad reveal" style="--i:2">
            <h3>{{ 'ref.how' | t }}</h3>
            <ol class="steps">
              @for (s of [1, 2, 3, 4]; track s) {
                <li [style.--i]="s"><span class="num">{{ s }}</span><span>{{ 'ref.step' + s | t: { per: o.perReward, days: o.rewardSlotDays } }}</span></li>
              }
            </ol>
            <div class="bonus" [class.done]="o.permanentBonus">
              <ion-icon [name]="o.permanentBonus ? 'checkmark-circle' : 'sparkles'"></ion-icon>
              <span>{{ (o.permanentBonus ? 'ref.bonusDone' : 'ref.bonus') | t: { n: o.permanentLimit, per: o.perReward } }}</span>
            </div>
          </section>

          <section class="card pad reveal" style="--i:3">
            <h3>{{ 'ref.rewards' | t }}</h3>
            <div class="track-m" role="list">
              @for (m of milestones(); track m.n) {
                <div class="ms" role="listitem" [class.got]="m.got" [class.next]="m.next">
                  <span class="dot">@if (m.got) { <ion-icon name="checkmark"></ion-icon> } @else { <ion-icon name="gift-outline"></ion-icon> }</span>
                  <b class="tnum">{{ m.n }}</b>
                </div>
              }
            </div>
            @if (o.activeRewardSlots > 0) { <p class="small good"><ion-icon name="add-circle"></ion-icon>{{ 'ref.activeSlots' | t: { n: o.activeRewardSlots } }}</p> }
            <div class="credits">
              <div class="cr" [class.has]="(o.credits['PROMOTE_7D'] || 0) > 0"><ion-icon name="rocket-outline"></ion-icon>{{ 'ref.creditPromote' | t: { n: o.credits['PROMOTE_7D'] || 0 } }}</div>
              <div class="cr" [class.has]="(o.credits['BUMP'] || 0) > 0"><ion-icon name="arrow-up"></ion-icon>{{ 'ref.creditBump' | t: { n: o.credits['BUMP'] || 0 } }}</div>
            </div>
            <p class="faint small">{{ 'ref.creditsHint' | t }} <a routerLink="/my-listings">{{ 'ref.toListings' | t }}</a></p>
          </section>

          <section class="card pad reveal" style="--i:4">
            <h3>{{ 'ref.friends' | t }}</h3>
            @if (!o.friends.length) { <p class="muted">{{ 'ref.noFriends' | t }}</p> }
            @for (f of o.friends; track f.username) {
              <div class="friend">
                <cmp-avatar [name]="f.username" [hue]="f.avatarHue" [size]="40" [verified]="f.verified" />
                <div><b>&#64;{{ f.username }}</b><span class="faint small">{{ i18n.ago(f.joinedAt) }}</span></div>
                <span class="st" [class.ok]="f.verified">{{ (f.verified ? 'ref.friendVerified' : 'ref.friendPending') | t }}</span>
              </div>
            }
          </section>
          <p class="fair faint small"><ion-icon name="shield-checkmark-outline"></ion-icon>{{ 'ref.fair' | t }}</p>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .hero { position: relative; overflow: hidden; border-radius: 32px; padding: 26px 20px 20px; color: #fff; text-align: center;
      background: linear-gradient(150deg, #5b3df5 0%, #8b6dff 55%, #ff7a6e 120%); box-shadow: 0 30px 60px -28px rgba(91, 61, 245, .75); }
    .glow { position: absolute; border-radius: 50%; filter: blur(40px); opacity: .5; pointer-events: none; animation: drift 9s ease-in-out infinite alternate; }
    .g1 { width: 200px; height: 200px; left: -60px; top: -60px; background: #ffb4ad; } .g2 { width: 240px; height: 240px; right: -80px; bottom: -100px; background: #6bc5ff; animation-delay: -4s; }
    @keyframes drift { to { transform: translate(30px, 20px) scale(1.1); } }
    .ringwrap { position: relative; width: 168px; height: 168px; margin: 0 auto 10px; }
    .ring { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring circle { fill: none; stroke-width: 9; stroke-linecap: round; }
    .ring .track { stroke: rgba(255, 255, 255, .22); }
    .ring .bar { stroke: #fff; stroke-dasharray: 339.3; transition: stroke-dashoffset 1.4s cubic-bezier(.22, 1, .36, 1) .25s; filter: drop-shadow(0 0 8px rgba(255,255,255,.6)); }
    .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .center b { font-family: var(--font-display); font-size: 46px; line-height: 1; letter-spacing: -.03em; }
    .center small { font-size: 20px; opacity: .75; margin-left: 2px; } .center span { font-size: 13px; font-weight: 600; opacity: .85; margin-top: 4px; }
    .gift { position: absolute; right: 2px; top: 6px; width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; font-size: 22px;
      background: rgba(255,255,255,.95); color: #ff5a4e; box-shadow: 0 10px 20px -8px rgba(0,0,0,.35); animation: giftBob 2.6s ease-in-out infinite; }
    @keyframes giftBob { 0%, 100% { transform: translateY(0) rotate(-8deg); } 50% { transform: translateY(-8px) rotate(6deg); } }
    .hero h1 { position: relative; color: #fff; font-size: 26px; line-height: 1.15; text-wrap: balance; }
    .hero p { position: relative; margin: 8px auto 0; max-width: 34ch; opacity: .92; }
    .stats { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 18px; }
    .stats div { padding: 10px 6px; border-radius: 18px; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.25); display: flex; flex-direction: column; gap: 2px; }
    .stats b { font-family: var(--font-display); font-size: 22px; } .stats span { font-size: 12.5px; opacity: .85; }

    .share { margin-top: 14px; display: flex; flex-direction: column; gap: 12px; }
    .lbl { font-size: 13px; font-weight: 650; color: var(--text-3); text-transform: uppercase; letter-spacing: .06em; text-align: center; }
    .code { display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; }
    .code span { width: 34px; height: 44px; border-radius: 12px; display: grid; place-items: center; font-family: var(--font-display); font-weight: 700; font-size: 22px;
      background: var(--accent-soft); color: var(--accent); animation: chIn .55s var(--spring) both; animation-delay: calc(var(--i) * 60ms + .2s); }
    @keyframes chIn { from { opacity: 0; transform: translateY(14px) rotateX(70deg); } }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

    section.card { margin-top: 14px; } h3 { margin-bottom: 12px; }
    .steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; position: relative; }
    .steps::before { content: ''; position: absolute; left: 15px; top: 16px; bottom: 16px; width: 2px; background: linear-gradient(var(--accent), var(--accent-2));
      transform-origin: top; animation: growY 1.2s var(--ease) .3s both; border-radius: 2px; }
    @keyframes growY { from { transform: scaleY(0); } }
    .steps li { position: relative; display: flex; align-items: center; gap: 12px; font-size: 15px; line-height: 1.4; animation: fadeUp .5s var(--ease) both; animation-delay: calc(var(--i) * 90ms + .2s); }
    .num { flex: 0 0 auto; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; color: #fff; background: var(--accent); z-index: 1; }
    .steps li:nth-child(4) .num { background: var(--accent-2); }
    .bonus { display: flex; gap: 10px; align-items: flex-start; margin-top: 14px; padding: 12px 14px; border-radius: 18px; background: var(--warn-soft); color: var(--text); font-size: 14.5px; line-height: 1.45; }
    .bonus ion-icon { flex: 0 0 auto; font-size: 20px; color: var(--warn); margin-top: 1px; }
    .bonus.done { background: var(--ok-soft); } .bonus.done ion-icon { color: var(--ok); }

    .track-m { display: flex; gap: 0; overflow-x: auto; padding: 4px 2px 10px; scrollbar-width: none; }
    .ms { position: relative; flex: 1 0 64px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .ms::before { content: ''; position: absolute; top: 19px; left: -50%; width: 100%; height: 3px; background: var(--surface-3); z-index: 0; }
    .ms:first-child::before { display: none; }
    .ms.got::before { background: var(--ok); }
    .ms .dot { position: relative; z-index: 1; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; font-size: 18px;
      background: var(--surface-2); color: var(--text-3); border: 2px solid var(--surface-3); transition: all .3s; }
    .ms.got .dot { background: var(--ok); color: #fff; border-color: var(--ok); animation: pop .6s var(--spring) both; }
    .ms.next .dot { border-color: var(--accent); color: var(--accent); animation: pulseRing 1.8s ease-out infinite; }
    .ms b { font-size: 13px; color: var(--text-2); }
    .good { display: flex; align-items: center; gap: 6px; color: var(--ok); font-weight: 600; margin: 8px 0 0; }
    .credits { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
    .cr { display: flex; align-items: center; gap: 8px; padding: 12px; border-radius: 16px; background: var(--surface-2); color: var(--text-3); font-size: 14px; font-weight: 600; }
    .cr ion-icon { font-size: 20px; } .cr.has { background: var(--accent-soft); color: var(--accent); }
    .credits + p { margin: 10px 0 0; }
    .friend { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-top: 1px solid var(--line); animation: fadeUp .4s var(--ease) both; }
    .friend:first-of-type { border-top: 0; }
    .friend div { flex: 1; min-width: 0; display: flex; flex-direction: column; } .friend b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .st { flex: 0 0 auto; font-size: 12.5px; font-weight: 650; padding: 4px 10px; border-radius: 999px; background: var(--surface-2); color: var(--text-3); }
    .st.ok { background: var(--ok-soft); color: var(--ok); }
    .fair { display: flex; align-items: center; justify-content: center; gap: 6px; text-align: center; margin: 16px 0 6px; }
    @media (prefers-reduced-motion: reduce) { .ring .bar { transition: none; } .gift, .glow { animation: none; } }
  `],
})
export class InvitePage implements OnInit {
  private api = inject(Api);
  private ui = inject(Ui);
  private motion = inject(Motion);
  i18n = inject(I18n);
  d = signal<ReferralOverview | null>(null);
  private shown = signal(0);
  private shareBtn = viewChild<ElementRef<HTMLElement>>('shareBtn');
  inRound = computed(() => { const o = this.d(); return o ? o.perReward - o.toNext : 0; });
  dash = computed(() => 339.3 * (1 - this.shown()));
  codeChars = computed(() => (this.d()?.code ?? '').split(''));
  milestones = computed(() => {
    const o = this.d();
    if (!o) return [];
    const got = o.rewards.length, total = Math.max(4, got + 2);
    return Array.from({ length: total }, (_, i) => ({ n: (i + 1) * o.perReward, got: i < got, next: i === got }));
  });

  async ngOnInit() {
    try {
      const o = await this.api.referrals();
      this.d.set(o);
      // inelul se umple animat după ce apare pagina
      requestAnimationFrame(() => requestAnimationFrame(() => this.shown.set((o.perReward - o.toNext) / o.perReward)));
    } catch (e) { this.ui.error(e); }
  }

  async share() {
    const o = this.d();
    if (!o) return;
    const text = this.i18n.t('ref.shareText', { link: o.link });
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ title: 'Cumped', text, url: o.link }); return; } catch { /* anulat: copiem linkul */ }
    }
    await this.copy(o.link);
    const b = this.shareBtn()?.nativeElement;
    if (b) this.motion.burst(b, '#FF5A4E');
  }

  async copy(text: string, ev?: Event) {
    try { await navigator.clipboard.writeText(text); } catch { /* fără acces la clipboard */ }
    this.ui.toast(this.i18n.t('ref.copied'));
    this.ui.tap();
    const el = ev?.currentTarget as HTMLElement | undefined;
    if (el) this.motion.burst(el, '#7B5CFF');
  }
}

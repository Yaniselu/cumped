import { Component, ElementRef, OnDestroy, ViewChild, inject, input, output, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { I18n } from '../core/i18n.service';
import { Ui } from '../core/ui.service';

/**
 * „Ține apăsat ca să confirmi” pentru acțiunile importante (acceptarea unei oferte, plăți, ștergerea contului).
 *  - umplerea progresează cât ții degetul; dacă ridici mai devreme sau tragi degetul în afara butonului, nu se întâmplă nimic;
 *  - la final: vibrație de confirmare și evenimentul (confirmed), o singură dată;
 *  - tastatură: ține apăsat Enter sau Space; cititor de ecran (activare fără apăsare fizică): cere confirmare într-un dialog.
 */
@Component({
  selector: 'cmp-hold-button',
  imports: [IonIcon],
  template: `
    <button #btn type="button" class="btn hold" [class.accent]="tone() === 'accent'" [class.danger]="tone() === 'danger'" [class.light]="tone() === 'light'"
      [class.sm]="small()" [class.block]="block()" [class.holding]="holding()" [class.done]="done()" [disabled]="disabled() || busy()"
      [attr.aria-label]="label() + ' — ' + i18n.t('hold.aria')" [style.--hold]="duration() + 'ms'" data-hold
      (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up()" (pointercancel)="cancel()"
      (keydown)="key($event, true)" (keyup)="key($event, false)" (click)="click($event)" (contextmenu)="$event.preventDefault()">
      <span class="fill"></span>
      @if (busy()) { <span class="spin"></span> }
      @else {
        @if (icon()) { <ion-icon [name]="done() ? 'checkmark' : icon()"></ion-icon> }
        <span class="lbl">{{ holding() ? i18n.t('hold.keep') : label() }}</span>
      }
    </button>
    @if (hint()) { <span class="hint" role="status">{{ i18n.t('hold.hint') }}</span> }
    @else if (caption()) { <span class="cap">{{ cap() }}</span> }
  `,
  styles: [`
    :host { display: inline-flex; flex-direction: column; align-items: stretch; gap: 4px; min-width: 0; }
    :host(.grow) { flex: 1 1 160px; }
    .hold { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: pan-y; }
    .hold.block { width: 100%; }
    .fill { position: absolute; inset: 0; z-index: -1; transform-origin: left center; transform: scaleX(0); border-radius: inherit;
      background: rgba(255, 255, 255, .28); transition: transform .25s ease-out; }
    .light .fill { background: var(--accent-soft); } .danger .fill { background: rgba(255, 90, 78, .22); }
    .holding .fill { transform: scaleX(1); transition: transform var(--hold) linear; }
    .holding { transform: scale(.98); }
    .done .fill { transform: scaleX(1); transition: none; }
    .lbl { position: relative; white-space: normal; text-align: center; line-height: 1.2; text-wrap: balance; overflow-wrap: anywhere; }
    .hold:not(.sm) { height: auto; min-height: 56px; padding-block: 8px; } .hold.sm { height: auto; min-height: 42px; padding-block: 6px; }
    .cap { font-size: 13px; color: var(--text-3); text-align: center; }
    .hint { font-size: 13px; font-weight: 600; color: var(--text-2); text-align: center; animation: fadeIn .2s ease; }
    .spin { width: 18px; height: 18px; border-radius: 50%; border: 2px solid currentColor; border-top-color: transparent; animation: spinSlow .7s linear infinite; }
  `],
})
export class HoldButtonComponent implements OnDestroy {
  i18n = inject(I18n);
  private ui = inject(Ui);
  @ViewChild('btn') btn?: ElementRef<HTMLButtonElement>;

  label = input.required<string>();
  icon = input<string>('');
  tone = input<'dark' | 'accent' | 'danger' | 'light'>('dark');
  small = input(false);
  block = input(false);
  busy = input(false);
  disabled = input(false);
  /** Cât trebuie ținut apăsat (ms). */
  duration = input(900);
  /** Textul dialogului pentru cititoarele de ecran (activare fără apăsare). */
  confirmText = input('');
  /** Arată permanent, sub buton, „Ține apăsat ca să confirmi”. */
  caption = input(false);
  confirmed = output<void>();

  holding = signal(false);
  done = signal(false);
  hint = signal(false);
  private timer: any;
  private hintTimer: any;
  private pointerId: number | null = null;
  private suppressClick = false;

  cap() { const t = this.i18n.t('hold.aria'); return t.charAt(0).toUpperCase() + t.slice(1); }

  down(e: PointerEvent) {
    if (e.button !== 0 || this.disabled() || this.busy()) return;
    this.pointerId = e.pointerId;
    this.suppressClick = true;
    // capturăm pointerul: mișcările ajung la buton și după ce degetul/mouse-ul a ieșit din el, ca să putem anula
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    this.start();
  }

  /** Dacă degetul iese din buton (cu o mică toleranță), acțiunea se anulează. */
  move(e: PointerEvent) {
    if (!this.holding() || e.pointerId !== this.pointerId || !this.btn) return;
    const r = this.btn.nativeElement.getBoundingClientRect(), tol = 10;
    if (e.clientX < r.left - tol || e.clientX > r.right + tol || e.clientY < r.top - tol || e.clientY > r.bottom + tol) this.cancel();
  }

  up() { if (this.holding()) this.cancel(true); }

  key(e: KeyboardEvent, isDown: boolean) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    this.suppressClick = true;
    if (isDown && !e.repeat && !this.holding()) this.start();
    if (!isDown && this.holding()) this.cancel(true);
  }

  /** Activare fără apăsare fizică (VoiceOver/TalkBack): confirmare în dialog, ca acțiunea să rămână accesibilă. */
  async click(e: MouseEvent) {
    if (this.suppressClick || e.detail !== 0) { this.suppressClick = false; return; }
    if (await this.ui.confirm(this.confirmText() || this.label(), this.label())) this.finish();
  }

  private start() {
    clearTimeout(this.timer);
    this.done.set(false);
    this.hint.set(false);
    this.holding.set(true);
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    this.timer = setTimeout(() => { this.holding.set(false); this.finish(); }, this.duration());
  }

  cancel(released = false) {
    if (!this.holding()) return;
    clearTimeout(this.timer);
    this.holding.set(false);
    this.pointerId = null;
    if (released) {
      // a ridicat degetul prea devreme: explicăm ce trebuie făcut
      this.hint.set(true);
      clearTimeout(this.hintTimer);
      this.hintTimer = setTimeout(() => this.hint.set(false), 2200);
    }
  }

  private finish() {
    if (this.done()) return;
    this.done.set(true);
    this.pointerId = null;
    Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    this.confirmed.emit();
    setTimeout(() => this.done.set(false), 1200);
  }

  ngOnDestroy() { clearTimeout(this.timer); clearTimeout(this.hintTimer); }
}

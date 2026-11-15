import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TPipe } from '../core/i18n.service';
import { PointerParallaxDirective } from './motion.directives';

export type AuthMood = 'idle' | 'type' | 'secret' | 'peek' | 'busy' | 'ok' | 'error';

/**
 * Scena din capul paginilor de cont: semnul Cumped „urmărește” formularul.
 *  - inelul din jur se umple pe măsură ce completezi câmpurile; când e gata, se desenează bifa;
 *  - cât scrii, săgețile se rotesc puțin la fiecare tastă;
 *  - la parolă apare un lacăt (se deschide când alegi „arată parola”);
 *  - la trimitere săgețile se învârt, la eroare semnul tremură, la reușită inelul strălucește;
 *  - dedesubt defilează ce primești pe Cumped (plăți protejate, oameni verificați, chat anti-țeapă).
 * Pur decorativ (aria-hidden); stările importante sunt spuse și în text, lângă câmpuri.
 */
@Component({
  selector: 'cmp-auth-hero',
  imports: [IonIcon, TPipe, PointerParallaxDirective],
  host: { 'aria-hidden': 'true' },
  template: `
    <div class="ah" cmpParallax [attr.data-mood]="mood()" [class.ready]="ready()" [style.--auth-p]="pct()" [style.--tick]="tick()">
      <span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span>
      <div class="core">
        <span class="ring"></span>
        <span class="glow"></span>
        <div class="mk">
          <svg viewBox="0 0 512 512" width="60" height="60">
            <g class="ar">
              <path d="M136.07 251.81 A120 120 0 0 1 354.30 187.17" fill="none" stroke="#FF5A4E" stroke-width="44" stroke-linecap="round" />
              <path d="M391.98 160.78 L386.42 233.04 L316.62 213.56 Z" fill="#FF5A4E" stroke="#FF5A4E" stroke-width="10" stroke-linejoin="round" />
              <path class="v" d="M375.93 260.19 A120 120 0 0 1 157.70 324.83" fill="none" stroke-width="44" stroke-linecap="round" />
              <path class="vf" d="M120.02 351.22 L125.58 278.96 L195.38 298.44 Z" stroke-width="10" stroke-linejoin="round" />
            </g>
            <polyline class="ck" points="208,258 242,292 306,224" fill="none" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <span class="lock">
          <svg viewBox="0 0 24 24" width="17" height="17">
            <path class="shackle" d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
            <rect x="5.5" y="10.5" width="13" height="10" rx="3" fill="currentColor" />
          </svg>
        </span>
        <span class="spark s1"></span><span class="spark s2"></span><span class="spark s3"></span><span class="spark s4"></span>
      </div>
      <div class="marquee">
        <div class="mtrack">
          @for (k of [0, 1]; track k) {
            <span class="tag"><ion-icon class="i1" name="shield-checkmark"></ion-icon>{{ 'authfx.chipPay' | t }}</span>
            <span class="tag"><ion-icon class="i2" name="checkmark-circle"></ion-icon>{{ 'authfx.chipPeople' | t }}</span>
            <span class="tag"><ion-icon class="i3" name="chatbubbles"></ion-icon>{{ 'authfx.chipChat' | t }}</span>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .ah { position: relative; height: 206px; margin: 4px 0 6px; border-radius: 30px; overflow: hidden; isolation: isolate;
      background: linear-gradient(160deg, color-mix(in oklab, var(--accent) 16%, var(--surface)) 0%, var(--surface) 60%, color-mix(in oklab, var(--accent-2) 10%, var(--surface)) 100%);
      border: 1px solid var(--lg-border); box-shadow: var(--shadow-card); }
    .blob { position: absolute; border-radius: 50%; opacity: .55; z-index: -1;
      transform: translate(calc(var(--px, 0) * var(--k) * 1px), calc(var(--py, 0) * var(--k) * 1px)); transition: transform .8s var(--ease); }
    .blob::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: inherit; will-change: transform; animation: blobDrift 12s ease-in-out infinite alternate; }
    .b1 { --k: -26; width: 230px; height: 230px; left: -70px; top: -100px; background: radial-gradient(closest-side, color-mix(in oklab, var(--accent) 70%, transparent), transparent); }
    .b2 { --k: 22; width: 210px; height: 210px; right: -60px; bottom: -110px; background: radial-gradient(closest-side, color-mix(in oklab, var(--accent-2) 60%, transparent), transparent); }
    .b3 { --k: 14; width: 160px; height: 160px; right: 18%; top: -80px; background: radial-gradient(closest-side, color-mix(in oklab, #7b5cff 55%, transparent), transparent); }
    .b2::before { animation-delay: -5s; } .b3::before { animation-delay: -9s; }
    @keyframes blobDrift { from { transform: translate(-8%, 4%) scale(1); } to { transform: translate(10%, -6%) scale(1.15); } }

    .core { position: absolute; left: 50%; top: 18px; width: 120px; height: 120px; margin-left: -60px; display: grid; place-items: center; will-change: transform;
      transform: translate(calc(var(--px, 0) * 10px), calc(var(--py, 0) * 6px)); transition: transform .6s var(--ease); }
    .ring { position: absolute; inset: 0; border-radius: 50%; padding: 5px;
      background: conic-gradient(from -90deg, var(--accent-2) 0%, var(--accent) calc(var(--auth-p) * 1%), color-mix(in oklab, var(--text) 9%, transparent) 0);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude;
      transition: --auth-p .6s var(--ease); }
    .glow { position: absolute; inset: 8px; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in oklab, var(--accent) 45%, transparent), transparent);
      opacity: calc(.15 + var(--auth-p) / 160); transition: opacity .5s; }
    .mk { position: relative; width: 84px; height: 84px; border-radius: 25px; display: grid; place-items: center; background: var(--card-fill);
      border: 1px solid var(--line); box-shadow: 0 16px 34px -14px rgba(40, 20, 120, .45); transition: transform .45s var(--spring), box-shadow .4s; }
    .ar { transform-origin: 256px 256px; transform: rotate(calc(var(--tick) * 24deg)); transition: transform .55s var(--spring); }
    .v { stroke: var(--accent); } .vf { fill: var(--accent); stroke: var(--accent); }
    .ck { stroke: var(--text); stroke-dasharray: 160; stroke-dashoffset: 160; transition: stroke-dashoffset .5s var(--ease); }
    .lock { position: absolute; right: 4px; bottom: 6px; width: 32px; height: 32px; border-radius: 11px; display: grid; place-items: center;
      background: var(--text); color: var(--surface); box-shadow: 0 8px 18px -8px rgba(0,0,0,.5); transform: scale(0) rotate(-20deg); opacity: 0;
      transition: transform .45s var(--spring), opacity .2s; }
    .shackle { transform-origin: 16px 11px; transition: transform .4s var(--spring); }
    .spark { position: absolute; left: 50%; top: 50%; width: 7px; height: 7px; margin: -3.5px; border-radius: 50%; background: var(--accent); opacity: 0; }
    .s2, .s4 { background: var(--accent-2); width: 5px; height: 5px; margin: -2.5px; }
    .s1 { --a: 20deg; } .s2 { --a: 110deg; } .s3 { --a: 200deg; } .s4 { --a: 290deg; }

    .marquee { position: absolute; left: 0; right: 0; bottom: 14px; overflow: hidden;
      -webkit-mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent); mask-image: linear-gradient(90deg, transparent, #000 14%, #000 86%, transparent); }
    .mtrack { display: flex; gap: 8px; width: max-content; animation: marquee 26s linear infinite; }
    .tag { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px 7px 9px; border-radius: 999px; white-space: nowrap;
      font-size: 12.5px; font-weight: 650; color: var(--text); background: color-mix(in oklab, var(--card-fill) 82%, transparent);
      border: 1px solid var(--line); box-shadow: 0 6px 14px -10px rgba(30, 20, 80, .4); }
    .tag ion-icon { font-size: 16px; flex: 0 0 auto; } .i1 { color: var(--ok); } .i2 { color: var(--accent); } .i3 { color: var(--accent-2); }
    @keyframes marquee { to { transform: translateX(calc(-50% - 4px)); } }

    /* stări */
    [data-mood="type"] .mk { transform: translateY(-2px) scale(1.04); }
    [data-mood="secret"] .lock, [data-mood="peek"] .lock { transform: none; opacity: 1; }
    [data-mood="secret"] .mk { transform: scale(.95); }
    [data-mood="peek"] .shackle { transform: translateY(-2.5px) rotate(28deg); }
    [data-mood="peek"] .mk { transform: rotate(-6deg) scale(1.02); }
    [data-mood="busy"] .ar { animation: arSpin .8s cubic-bezier(.5, 0, .5, 1) infinite; }
    [data-mood="busy"] .ring { animation: ringPulse 1s ease-in-out infinite; }
    [data-mood="busy"] .mtrack { animation-duration: 6s; }
    .ready .ck, [data-mood="ok"] .ck { stroke-dashoffset: 0; }
    .ready .mk { box-shadow: 0 16px 40px -10px color-mix(in oklab, var(--accent) 75%, transparent); }
    .ready .spark { animation: spark 1.1s cubic-bezier(.15, .8, .3, 1) both; }
    .ready .s2 { animation-delay: .06s; } .ready .s3 { animation-delay: .12s; } .ready .s4 { animation-delay: .18s; }
    [data-mood="ok"] .core { animation: okPop .6s var(--spring); }
    [data-mood="ok"] .glow { opacity: .9; }
    [data-mood="error"] .core { animation: shakeX .5s cubic-bezier(.36, .07, .19, .97); }
    [data-mood="error"] .ring { filter: hue-rotate(-60deg) saturate(1.4); }
    @keyframes arSpin { to { transform: rotate(calc(var(--tick) * 24deg + 360deg)); } }
    @keyframes ringPulse { 50% { transform: scale(1.05); opacity: .8; } }
    @keyframes okPop { 40% { scale: 1.12; } }
    @keyframes spark { 0% { opacity: 1; transform: rotate(var(--a)) translateX(46px) scale(.5); } 100% { opacity: 0; transform: rotate(var(--a)) translateX(84px) scale(1); } }
    @keyframes shakeX { 10%, 90% { translate: -2px 0; } 20%, 80% { translate: 4px 0; } 30%, 50%, 70% { translate: -7px 0; } 40%, 60% { translate: 7px 0; } }

    /* calculator: scenă mare lângă formular */
    @media (min-width: 960px) and (min-height: 560px) {
      .ah { height: min(560px, calc(100vh - 140px)); border-radius: 36px; }
      .core { top: calc(50% - 90px); scale: 1.7; }
      .marquee { bottom: 26px; } .tag { font-size: 14px; padding: 9px 15px 9px 11px; } .tag ion-icon { font-size: 18px; }
      .b1 { width: 420px; height: 420px; } .b2 { width: 380px; height: 380px; } .b3 { width: 300px; height: 300px; }
    }
    /* ecrane joase (telefon culcat): scena se strânge, fără etichete */
    @media (max-height: 600px) { .ah { height: 132px; } .marquee { display: none; } .core { top: 6px; } }
    :host-context(html.lite) .blob::before, :host-context(html.lite) .mtrack { animation: none; }
    @media (prefers-reduced-motion: reduce) { .mtrack, .blob::before { animation: none; } }
  `],
})
export class AuthHeroComponent {
  /** Cât din formular e completat (0…1). */
  progress = input(0);
  mood = input<AuthMood>('idle');
  /** Crește la fiecare tastă: săgețile se rotesc puțin. */
  tick = input(0);
  pct = computed(() => Math.round(Math.max(0, Math.min(1, this.progress())) * 100));
  ready = computed(() => this.progress() >= 1);
}

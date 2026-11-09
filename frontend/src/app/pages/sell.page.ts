import { MOTION } from '../shared/motion.directives';
import { HoldButtonComponent } from '../shared/hold-button.component';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, NavController } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { I18n, TPipe } from '../core/i18n.service';
import { CATEGORY_ICONS } from '../core/icons';
import { CATEGORIES, CONDITIONS, COUNTRIES, CURRENCIES, PriceAnalysis } from '../core/models';
import { Ui } from '../core/ui.service';
import { Motion } from '../core/motion.service';
import { BackButtonComponent } from '../shared/back-button.component';
import { FieldDef, FX_APPROX, PRICE_RANGE_EUR, fieldsFor, groupsFor, niceCeil } from '../core/listing-schema';
import { PriceChip, PriceInputComponent } from '../shared/price-input.component';
import { Purchases } from '../core/purchases.service';

interface Photo { id?: string; url: string; uploading: boolean; }

@Component({
  selector: 'page-sell',
  imports: [MOTION, HoldButtonComponent, IonContent, IonIcon, FormsModule, RouterLink, TPipe, BackButtonComponent, PriceInputComponent],
  template: `
    <ion-content cmpScrollFx [fullscreen]="true">
      <div class="page narrow">
        <div class="topbar"><cmp-back icon="close" /><div class="title">{{ (id() ? 'sell.editTitle' : 'sell.title') | t }}</div><div class="spacer"></div></div>

        @if (blocked()) {
          <div class="paywall card pad reveal">
            <div class="pw-ic"><ion-icon name="rocket-outline"></ion-icon></div>
            <h2>{{ 'sell.quotaTitle' | t }}</h2>
            <p class="muted">{{ 'sell.quotaSub' | t: { limit: auth.user()?.quota?.limit } }}</p>
            @if (purchases.allowed()) {
              <cmp-hold-button [block]="true" [caption]="true" icon="add-circle" [busy]="buying()" [label]="'sell.buyExtra' | t"
                [confirmText]="'hold.payConfirm' | t: { what: ('plans.EXTRA_LISTING' | t), price: '1,99 €' }" (confirmed)="buyExtra()" />
              <a class="btn light block" routerLink="/plans">{{ 'sell.seePlans' | t }}</a>
            } @else { <p class="faint small">{{ 'plans.nativeSoon' | t }}</p> }
            <a class="btn ghost block" routerLink="/profile"><ion-icon name="gift-outline"></ion-icon>{{ 'sell.invite' | t }}</a>
          </div>
        } @else if (published()) {
          <div class="done reveal">
            <div class="confetti">@for (c of confetti; track $index) { <i [style.--x]="c.x" [style.--d]="c.d" [style.--c]="c.c" [style.--r]="c.r"></i> }</div>
            <div class="check"><ion-icon name="checkmark"></ion-icon></div>
            <h1 [cmpSplit]="'sell.published' | t" [delay]="350"></h1>
            <p class="muted">{{ 'sell.publishedSub' | t }}</p>
            <button class="btn block" (click)="view()">{{ 'sell.viewListing' | t }}</button>
          </div>
        } @else {
          <div class="steps">
            @for (s of stepKeys; track s; let i = $index) {
              <button class="st" [class.on]="step() === i" [class.past]="step() > i" (click)="i < step() && step.set(i)">
                <span class="n">@if (step() > i) { <ion-icon name="checkmark"></ion-icon> } @else { {{ i + 1 }} }</span><span class="l">{{ 'sell.steps.' + s | t }}</span>
              </button>
            }
            <div class="bar"><span [style.width.%]="(step() / (stepKeys.length - 1)) * 100"></span></div>
          </div>
          <div class="qrow">
            @if (!id() && auth.user(); as u) { <span class="faint small">{{ 'sell.quota' | t: { active: u.quota.active, limit: u.quota.limit } }}</span> }
            <span class="score" [attr.data-s]="scoreLevel()"><span class="ring" [style.--p]="score()"></span>{{ 'sell.score' | t: { n: score() } }}</span>
          </div>

          @switch (step()) {
            @case (0) {
              <section class="step-in">
                <div class="photos">
                  @for (p of photos(); track p.url; let i = $index) {
                    <div class="ph reveal" [style.--i]="i">
                      <img [src]="api.url(p.url)" alt="" />
                      @if (p.uploading) { <div class="up"><span class="spin"></span></div> }
                      @if (i === 0) { <span class="cover badge glass-b">Cover</span> }
                      <button class="icon-btn sm rm" (click)="removePhoto(i)"><ion-icon name="close"></ion-icon></button>
                    </div>
                  }
                  @if (photos().length < 10) {
                    <label class="add press"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple (change)="pick($event)" hidden />
                      <ion-icon name="camera"></ion-icon><span>{{ 'sell.addPhotos' | t }}</span></label>
                  }
                </div>
                <p class="hint">{{ 'sell.photosHint' | t }}</p>
                <ul class="tips">
                  <li><ion-icon name="sunny-outline"></ion-icon>{{ 'sell.tip1' | t }}</li>
                  <li><ion-icon name="images-outline"></ion-icon>{{ 'sell.tip2' | t }}</li>
                  <li><ion-icon name="eye-off-outline"></ion-icon>{{ 'sell.tip3' | t }}</li>
                </ul>
              </section>
            }
            @case (1) {
              <section class="stack step-in">
                <div class="field"><label>{{ 'sell.titleLabel' | t }}</label><input class="input" [(ngModel)]="f.title" maxlength="90" [placeholder]="'sell.titlePh' | t" />
                  <span class="hint">{{ f.title.length }}/90 · {{ 'sell.titleHint' | t }}</span></div>
                <div class="field"><label>{{ 'sell.category' | t }}</label>
                  <div class="catgrid">@for (c of categories; track c) {
                    <button class="cat" [class.on]="f.category === c" (click)="setCategory(c)"><ion-icon [name]="icons[c]"></ion-icon><span>{{ 'categories.' + c | t }}</span></button> }</div></div>
                <div class="field"><label>{{ 'sell.condition' | t }}</label>
                  <div class="conds">@for (c of conditions; track c) {
                    <button class="cond" [class.on]="f.condition === c" (click)="f.condition = c"><b>{{ 'conditions.' + c | t }}</b><span>{{ 'conditionsSub.' + c | t }}</span></button> }</div></div>
                <div class="field"><label>{{ 'sell.description' | t }}</label><textarea class="input" [(ngModel)]="f.description" maxlength="4000" rows="6" [placeholder]="'sell.descPh' | t"></textarea>
                  <span class="hint">{{ f.description.length }}/4000 · {{ (f.description.trim().length < 20 ? 'sell.descMin' : 'sell.descGood') | t }}</span></div>
              </section>
            }
            @case (2) {
              <section class="stack step-in">
                <p class="muted small">{{ 'sell.specsIntro' | t }}</p>
                @for (g of groups(); track g.key) {
                  <div class="grp card pad">
                    <h3><ion-icon [name]="g.icon"></ion-icon>{{ 'attrGroup.' + g.key | t }}</h3>
                    <div class="fgrid">
                      @for (fd of g.fields; track fd.key) {
                        <div class="field" [class.wide]="fd.wide || fd.type === 'bool'">
                          @if (fd.type !== 'bool') { <label [attr.for]="'a-' + fd.key">{{ i18n.attrLabel(fd.key) }}@if (fd.required) { <i class="req">*</i> }@if (fd.unit) { <span class="faint"> ({{ fd.unit }})</span> }</label> }
                          @switch (fd.type) {
                            @case ('select') {
                              <select class="input" [id]="'a-' + fd.key" [(ngModel)]="attrs[fd.key]">
                                <option value="">—</option>
                                @for (o of fd.options; track o) { <option [value]="o">{{ i18n.attrValue(fd.key, o, fd.unit) }}</option> }
                              </select>
                            }
                            @case ('bool') {
                              <div class="toggle-row tri"><span>{{ i18n.attrLabel(fd.key) }}</span>
                                <div class="yn"><button [class.on]="attrs[fd.key] === 'yes'" (click)="attrs[fd.key] = attrs[fd.key] === 'yes' ? '' : 'yes'">{{ 'common.yes' | t }}</button>
                                  <button [class.on]="attrs[fd.key] === 'no'" (click)="attrs[fd.key] = attrs[fd.key] === 'no' ? '' : 'no'">{{ 'common.no' | t }}</button></div></div>
                            }
                            @case ('number') {
                              <input class="input" [id]="'a-' + fd.key" type="text" inputmode="numeric" [(ngModel)]="attrs[fd.key]" (ngModelChange)="digits(fd.key)" [attr.maxlength]="12" />
                              @if (badNumber(fd)) { <span class="hint bad">{{ 'sell.range' | t: { min: fd.min ?? 0, max: fd.max ?? '∞' } }}</span> }
                            }
                            @default {
                              <input class="input" [id]="'a-' + fd.key" [(ngModel)]="attrs[fd.key]" maxlength="120" [attr.list]="fd.suggest ? 'dl-' + fd.key : null" [placeholder]="ph(fd.key)" />
                              @if (fd.suggest) { <datalist [id]="'dl-' + fd.key">@for (o of fd.suggest; track o) { <option [value]="o"></option> }</datalist> }
                            }
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
                @if (missingRequired().length) { <p class="hint bad">{{ 'sell.requiredMissing' | t: { fields: missingRequired().join(', ') } }}</p> }
              </section>
            }
            @case (3) {
              <section class="stack step-in">
                <div class="pricebox card pad glass">
                  <div class="row between"><label>{{ 'sell.price' | t }}</label>
                    <select class="cursel" [(ngModel)]="f.currency" (ngModelChange)="checkPrice()" [attr.aria-label]="'sell.currency' | t">@for (c of currencies; track c) { <option>{{ c }}</option> }</select></div>
                  <cmp-price-input [value]="f.price" (valueChange)="f.price = $event; checkPrice()" scale="log" [min]="0" [max]="priceMax()" [currency]="f.currency" [showCurrency]="false"
                    [median]="median()" [medianLabel]="'price.medianShort' | t" [chips]="priceChips()" [big]="true" [label]="'sell.price' | t" />
                </div>
                <div class="aibox card pad" [attr.data-v]="analysis()?.verdict">
                  <div class="row"><span class="ai">AI</span><strong>{{ 'price.aiCheck' | t }}</strong>@if (checking()) { <span class="spin sm"></span> }</div>
                  @if (analysis(); as a) {
                    <p class="v fade">{{ 'price.' + a.verdict | t }}</p>
                    @if (a.medianCents) { <p class="muted small">{{ 'price.median' | t: { price: i18n.price(a.medianCents, a.currency), n: a.comparables } }}</p>
                      <div class="meter"><span class="mk" [style.left.%]="meterPos()"></span></div> }
                  } @else { <p class="muted small">—</p> }
                </div>
                <div class="card toggles">
                  <div class="toggle-row"><span><ion-icon name="chatbubbles-outline"></ion-icon><span><b>{{ 'sell.negotiable' | t }}</b><small>{{ 'sell.negotiableSub' | t }}</small></span></span>
                    <button class="switch" role="switch" [attr.aria-checked]="f.negotiable" [class.on]="f.negotiable" (click)="f.negotiable = !f.negotiable; f.acceptsOffers = f.negotiable"></button></div>
                  @if (f.negotiable && f.price) {
                    <div class="minbox fade">
                      <div class="row between"><b class="small">{{ 'sell.minPrice' | t }}</b>
                        <button class="switch sm" role="switch" [attr.aria-checked]="useMin" [class.on]="useMin" (click)="toggleMin()"></button></div>
                      <p class="faint small">{{ 'sell.minPriceSub' | t }}</p>
                      @if (useMin) {
                        <cmp-price-input [value]="f.minPrice" (valueChange)="f.minPrice = $event" scale="linear" [min]="minFloor()" [max]="f.price" [currency]="f.currency"
                          [reference]="f.price" [deltaLabel]="'sell.vsPrice' | t" [label]="'sell.minPrice' | t" />
                        @if (f.minPrice && f.minPrice > f.price) { <p class="hint bad">{{ 'errors.MIN_PRICE_TOO_HIGH' | t }}</p> }
                      }
                    </div>
                  }
                  <div class="toggle-row"><span><ion-icon name="swap-horizontal"></ion-icon><span><b>{{ 'sell.acceptsSwap' | t }}</b><small>{{ 'sell.acceptsSwapSub' | t }}</small></span></span>
                    <button class="switch" role="switch" [attr.aria-checked]="f.acceptsSwap" [class.on]="f.acceptsSwap" (click)="f.acceptsSwap = !f.acceptsSwap"></button></div>
                  <div class="toggle-row"><span><ion-icon name="layers-outline"></ion-icon><span><b>{{ 'sell.quantity' | t }}</b><small>{{ 'sell.quantitySub' | t }}</small></span></span>
                    <div class="stepper"><button data-repeat (click)="f.quantity = Math.max(1, f.quantity - 1)" [attr.aria-label]="'−'">−</button><span>{{ f.quantity }}</span>
                      <button data-repeat (click)="f.quantity = Math.min(999, f.quantity + 1)" [attr.aria-label]="'+'">+</button></div></div>
                </div>
                <p class="faint small fee"><ion-icon name="information-circle-outline"></ion-icon>{{ 'sell.feeNote' | t }}</p>
              </section>
            }
            @case (4) {
              <section class="stack step-in">
                <div class="two">
                  <div class="field"><label>{{ 'sell.country' | t }}</label><select class="input" [(ngModel)]="f.country">@for (c of countries; track c) { <option>{{ c }}</option> }</select></div>
                  <div class="field"><label>{{ 'sell.city' | t }}</label><input class="input" [(ngModel)]="f.city" maxlength="80" /></div>
                </div>
                <div class="field"><label>{{ 'sell.shipsTo' | t }}</label>
                  <div class="chips">
                    <button class="chip" [class.active]="f.worldwide" (click)="f.worldwide = !f.worldwide"><ion-icon name="globe-outline"></ion-icon>{{ 'sell.worldwide' | t }}</button>
                    @if (!f.worldwide) { @for (c of countries; track c) { <button class="chip" [class.active]="f.shipsTo.includes(c)" (click)="toggleShip(c)">{{ c }}</button> } }
                  </div></div>
                <div class="field"><label>{{ 'sell.weight' | t }}</label><input class="input" type="number" inputmode="decimal" min="0.01" max="1000" [(ngModel)]="f.weightKg" />
                  <span class="hint">{{ 'sell.weightHint' | t }}</span></div>
                <div class="card pad review">
                  <h3>{{ 'sell.review' | t }}</h3>
                  <div class="rv-row">
                    @if (photos()[0]; as p) { <img [src]="api.url(p.url)" alt="" /> }
                    <div><b>{{ f.title }}</b><span class="price">{{ f.price != null ? i18n.price(Math.round(f.price * 100), f.currency) : '—' }}</span>
                      <span class="small muted">{{ 'categories.' + f.category | t }} · {{ 'conditions.' + f.condition | t }} · {{ filledCount() }} {{ 'sell.specsFilled' | t }}</span></div>
                  </div>
                  @if (tipsLeft().length) {
                    <ul class="improve">@for (t of tipsLeft(); track t) { <li><ion-icon name="sparkles-outline"></ion-icon>{{ 'sell.improve.' + t | t }}</li> }</ul>
                  }
                  <p class="faint small legal">{{ 'sell.legal' | t }} <a routerLink="/legal/rules">{{ 'legal.rules' | t }}</a>.</p>
                </div>
              </section>
            }
          }

          @if (error()) { <div class="error-text fade">{{ error() }}</div> }
          <div class="nav">
            @if (step() > 0) { <button class="btn light" (click)="step.set(step() - 1)"><ion-icon name="arrow-back"></ion-icon></button> }
            @if (step() < stepKeys.length - 1) { <button class="btn grow" [disabled]="!canNext()" (click)="next()">{{ 'common.next' | t }} <ion-icon name="arrow-forward"></ion-icon></button> }
            @else { <button class="btn accent grow" [disabled]="busy() || !f.city" (click)="publish()"><ion-icon name="rocket-outline"></ion-icon>{{ (id() ? 'sell.saveChanges' : 'sell.publish') | t }}</button> }
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: [`
    .step-in { animation: slideInR .55s var(--spring) both; }
    .step-in > * { animation: fadeUp .6s var(--spring) both; }
    .step-in > *:nth-child(2) { animation-delay: .06s; } .step-in > *:nth-child(3) { animation-delay: .12s; } .step-in > *:nth-child(4) { animation-delay: .18s; } .step-in > *:nth-child(5) { animation-delay: .24s; }
    .ph { animation: pop .5s var(--spring) both; }
    .add { transition: transform .4s var(--spring), border-color .3s; } .add:hover { transform: translateY(-3px); border-color: var(--accent); }
    .add ion-icon { animation: pulseSoft 2.4s ease-in-out infinite; }
    .steps { position: relative; display: flex; justify-content: space-between; margin: 6px 0 8px; }
    .st { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; border: 0; background: none; color: var(--text-3); font-size: 12px; font-weight: 600; cursor: pointer; }
    .n { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow-card); transition: all .4s var(--spring); }
    .st.on { color: var(--text); } .st.on .n { background: var(--btn-dark); color: var(--btn-dark-text); transform: scale(1.12); }
    .st.past .n { background: var(--accent); color: #fff; border-color: transparent; }
    .bar { position: absolute; top: 16px; left: 20px; right: 20px; height: 3px; background: var(--surface-3); border-radius: 9px; }
    .bar span { display: block; height: 100%; background: var(--accent); border-radius: 9px; transition: width .6s var(--ease); }
    .quota { text-align: center; margin: 4px 0 14px; }
    .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100px, 30%), 1fr)); gap: 10px; }
    .ph, .add { position: relative; aspect-ratio: 1; border-radius: 20px; overflow: hidden; background: var(--image-bg); }
    .ph img { width: 100%; height: 100%; object-fit: cover; }
    .up { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.25); }
    .cover { position: absolute; bottom: 8px; left: 8px; } .rm { position: absolute; top: 6px; right: 6px; }
    .add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border: 2px dashed var(--surface-3); background: var(--surface); cursor: pointer; color: var(--text-2); font-size: 12.5px; font-weight: 600; text-align: center; padding: 6px; }
    .add ion-icon { font-size: 28px; color: var(--accent); }
    .hint { margin-top: 10px; display: block; }
    .catgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 8px; }
    .cat { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 4px; border-radius: 18px; border: 1.5px solid var(--line); background: var(--surface); color: var(--text-2); cursor: pointer; font-size: 11.5px; font-weight: 600; transition: all .25s var(--ease); }
    .cat ion-icon { font-size: 22px; } .cat.on { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); transform: translateY(-2px); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .attr { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: center; margin-bottom: 8px; } .attr .input { height: 48px; }
    .pricebox label { font-size: 13px; font-weight: 600; color: var(--text-2); }
    .cursel { height: 38px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); color: var(--text); padding: 0 10px; font-weight: 650; font-size: 14px; }
    .qrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 6px 2px 14px; flex-wrap: wrap; }
    .score { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 650; color: var(--text-2); margin-left: auto; }
    .ring { --p: 0; width: 20px; height: 20px; border-radius: 50%; background: conic-gradient(var(--c, var(--warn)) calc(var(--p) * 1%), var(--surface-3) 0); position: relative; transition: all .4s; }
    .ring::after { content: ''; position: absolute; inset: 4px; border-radius: 50%; background: var(--bg); }
    .score[data-s="2"] .ring { --c: var(--accent); } .score[data-s="3"] .ring { --c: var(--ok); }
    .tips { list-style: none; padding: 0; margin: 14px 0 0; display: flex; flex-direction: column; gap: 8px; }
    .tips li { display: flex; gap: 10px; align-items: center; font-size: 13px; color: var(--text-2); }
    .tips ion-icon { color: var(--accent); font-size: 18px; flex: 0 0 auto; }
    .conds { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(150px, 100%), 1fr)); gap: 8px; }
    .cond { display: flex; flex-direction: column; gap: 2px; text-align: left; padding: 10px 12px; border-radius: 16px; border: 1.5px solid var(--line); background: var(--surface); color: var(--text); cursor: pointer; transition: all .2s var(--ease); }
    .cond b { font-size: 14px; } .cond span { font-size: 11.5px; color: var(--text-2); line-height: 1.35; }
    .cond.on { border-color: var(--accent); background: var(--accent-soft); }
    .grp h3 { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 16px; } .grp h3 ion-icon { color: var(--accent); }
    .fgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 10px; }
    .fgrid .wide { grid-column: 1 / -1; }
    .fgrid .input { height: 48px; font-size: 15px; padding: 0 14px; border-radius: 14px; }
    @media (max-width: 340px) { .fgrid { grid-template-columns: 1fr; } }
    .req { color: var(--accent-2); font-style: normal; margin-left: 2px; }
    .hint.bad { color: var(--accent-2); }
    .tri { padding: 4px 2px; } .tri > span { font-size: 14px; font-weight: 550; }
    .yn { display: flex; padding: 3px; border-radius: 999px; background: var(--surface-2); flex: 0 0 auto; }
    .yn button { height: 32px; min-width: 52px; padding: 0 12px; border: 0; border-radius: 999px; background: transparent; color: var(--text-2); font-weight: 650; font-size: 13px; cursor: pointer; transition: all .2s; }
    .yn button.on { background: var(--surface); color: var(--text); box-shadow: var(--shadow-card); }
    .toggles .toggle-row > span { align-items: flex-start; } .toggles .toggle-row > span > span { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; }
    .toggles small { font-size: 12px; color: var(--text-2); font-weight: 450; line-height: 1.35; }
    .toggles ion-icon { margin-top: 2px; flex: 0 0 auto; }
    .minbox { padding: 12px 14px; margin: 0 0 6px; border-radius: 16px; background: var(--surface-2); display: flex; flex-direction: column; gap: 6px; }
    .switch.sm { width: 42px; height: 26px; } .switch.sm::after { width: 20px; height: 20px; } .switch.sm.on::after { transform: translateX(16px); }
    .stepper { display: flex; align-items: center; gap: 4px; padding: 3px; border-radius: 999px; background: var(--surface-2); flex: 0 0 auto; }
    .stepper button { width: 34px; height: 34px; border-radius: 50%; border: 0; background: var(--surface); color: var(--text); font-size: 18px; font-weight: 600; cursor: pointer; box-shadow: var(--shadow-card); }
    .stepper span { min-width: 28px; text-align: center; font-weight: 700; font-variant-numeric: tabular-nums; }
    .fee { display: flex; gap: 6px; align-items: flex-start; line-height: 1.45; } .fee ion-icon { flex: 0 0 auto; font-size: 16px; margin-top: 1px; }
    .review h3 { margin-bottom: 12px; }
    .rv-row { display: flex; gap: 12px; align-items: center; }
    .rv-row img { width: 72px; height: 72px; border-radius: 16px; object-fit: cover; flex: 0 0 auto; }
    .rv-row div { display: flex; flex-direction: column; gap: 3px; min-width: 0; } .rv-row b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rv-row .price { font-family: var(--font-display); font-weight: 700; font-size: 20px; }
    .improve { list-style: none; padding: 0; margin: 14px 0 0; display: flex; flex-direction: column; gap: 6px; }
    .improve li { display: flex; gap: 8px; align-items: center; font-size: 13px; color: var(--accent); font-weight: 550; }
    .legal { margin-top: 12px; line-height: 1.45; }
    .aibox { transition: background .4s; } .aibox[data-v="BELOW"] { background: var(--ok-soft); } .aibox[data-v="FAIR"] { background: var(--accent-soft); } .aibox[data-v="ABOVE"] { background: var(--warn-soft); }
    .ai { font-size: 11px; font-weight: 800; padding: 3px 7px; border-radius: 8px; background: var(--text); color: var(--surface); }
    .v { font-family: var(--font-display); font-size: 20px; font-weight: 700; margin: 8px 0 2px; }
    .meter { position: relative; height: 8px; border-radius: 99px; margin-top: 14px; background: linear-gradient(90deg, var(--ok), var(--accent) 50%, var(--warn)); }
    .mk { position: absolute; top: 50%; width: 18px; height: 18px; border-radius: 50%; background: var(--surface); border: 3px solid var(--text); transform: translate(-50%, -50%); transition: left .6s var(--spring); }
    .toggles { padding: 4px 14px; } .toggles span { display: flex; align-items: center; gap: 8px; font-weight: 550; } .toggles ion-icon { color: var(--accent); }
    .two { display: grid; grid-template-columns: 1fr 1.4fr; gap: 10px; }
    .nav { display: flex; gap: 10px; margin-top: 24px; } .nav .grow { flex: 1; }
    .spin { width: 26px; height: 26px; border-radius: 50%; border: 3px solid rgba(255,255,255,.4); border-top-color: #fff; animation: spinSlow .8s linear infinite; }
    .spin.sm { width: 16px; height: 16px; border-width: 2px; border-color: var(--surface-3); border-top-color: var(--accent); margin-left: auto; }
    .paywall { text-align: center; display: flex; flex-direction: column; gap: 12px; align-items: center; margin-top: 30px; }
    .pw-ic { width: 76px; height: 76px; border-radius: 26px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); font-size: 34px; animation: floaty 4s ease-in-out infinite; }
    .done { position: relative; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; padding-top: 60px; }
    .check { width: 110px; height: 110px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(135deg, #7457ff, #5b3df5); color: #fff; font-size: 56px;
      box-shadow: 0 24px 50px -16px rgba(91,61,245,.7); animation: pop .8s var(--spring) both; }
    .confetti { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
    .confetti i { position: absolute; top: 90px; left: 50%; width: 10px; height: 14px; border-radius: 3px; background: var(--c);
      animation: burst 1.6s var(--ease) forwards; animation-delay: calc(var(--d) * 1ms); opacity: 0; }
    @keyframes burst { 0% { opacity: 1; transform: translate(-50%, 0) rotate(0); } 100% { opacity: 0; transform: translate(calc(var(--x) * 1px), 260px) rotate(var(--r)); } }
  `],
})
export class SellPage implements OnInit {
  api = inject(Api);
  auth = inject(AuthService);
  i18n = inject(I18n);
  private ui = inject(Ui);
  private nav = inject(NavController);
  private motion = inject(Motion);
  purchases = inject(Purchases);
  id = input<string>();

  stepKeys = ['photos', 'details', 'specs', 'price', 'delivery'];
  Math = Math;
  categories = CATEGORIES; conditions = CONDITIONS; countries = COUNTRIES; currencies = CURRENCIES; icons = CATEGORY_ICONS;
  step = signal(0);
  photos = signal<Photo[]>([]);
  analysis = signal<PriceAnalysis | null>(null);
  checking = signal(false);
  busy = signal(false);
  error = signal('');
  published = signal<string | null>(null);
  blocked = computed(() => { const u = this.auth.user(); return !this.id() && !!u && u.quota.active >= u.quota.limit && !this.published(); });
  confetti = Array.from({ length: 36 }, (_, i) => ({ x: Math.round((Math.random() - 0.5) * 520), d: Math.round(Math.random() * 300), r: Math.round(Math.random() * 720) + 'deg',
    c: ['#5B3DF5', '#FF5A4E', '#14A46C', '#FFC93C', '#7B5CFF'][i % 5] }));
  f = {
    title: '', description: '', category: '', condition: 'GOOD', price: null as number | null, currency: 'RON',
    country: 'RO', city: '', shipsTo: ['RO'] as string[], worldwide: false, weightKg: 1, acceptsOffers: true, acceptsSwap: false,
    negotiable: true, minPrice: null as number | null, quantity: 1,
  };
  /** Câmpurile din schema categoriei (cheie → valoare text). */
  attrs: Record<string, string> = {};
  useMin = false;
  private priceTimer: any;

  async ngOnInit() {
    const u = this.auth.user();
    if (u) { this.f.country = u.country || 'RO'; this.f.city = u.city || ''; this.f.currency = this.currencyFor(this.f.country); this.f.shipsTo = [this.f.country]; }
    try { const me = await this.api.me(); this.auth.setUser(me); } catch { /* ignore */ }
    if (this.id()) {
      try {
        const d = await this.api.listing(this.id()!);
        if (!d.owner) { this.nav.navigateRoot('/home'); return; }
        Object.assign(this.f, {
          title: d.title, description: d.description, category: d.category, condition: d.condition, price: d.priceCents / 100,
          currency: d.currency, country: d.country, city: d.city, shipsTo: d.shipsTo.filter((s) => s !== '*'), worldwide: d.shipsTo.includes('*'),
          weightKg: d.weightGrams / 1000, acceptsOffers: d.acceptsOffers, acceptsSwap: d.acceptsSwap,
          negotiable: d.negotiable, minPrice: d.minPriceCents ? d.minPriceCents / 100 : null, quantity: d.quantity || 1,
        });
        this.attrs = { ...d.attributes };
        this.useMin = !!d.minPriceCents;
        this.photos.set(d.images.map((i) => ({ id: i.id, url: i.url, uploading: false })));
        this.checkPrice();
      } catch (e) { this.ui.error(e); }
    }
  }

  currencyFor(c: string) { return ({ RO: 'RON', MD: 'MDL', HU: 'HUF', PL: 'PLN', BG: 'BGN', CZ: 'CZK', GB: 'GBP', US: 'USD', CH: 'CHF', TR: 'TRY', UA: 'UAH' } as any)[c] ?? 'EUR'; }

  canNext() {
    const s = this.step();
    if (s === 0) return this.photos().length > 0 && this.photos().every((p) => !p.uploading);
    if (s === 1) return this.f.title.trim().length >= 5 && !!this.f.category && this.f.description.trim().length >= 20;
    if (s === 2) return !this.missingRequired().length && !fieldsFor(this.f.category).some((fd) => this.badNumber(fd));
    if (s === 3) return this.f.price !== null && this.f.price >= 0 && !(this.useMin && this.f.minPrice != null && this.f.minPrice > this.f.price);
    return true;
  }

  groups() { return groupsFor(this.f.category); }
  ph(key: string) { return this.i18n.has('attrPh.' + key) ? this.i18n.t('attrPh.' + key) : ''; }

  setCategory(c: string) {
    this.f.category = c;
    // păstrăm doar câmpurile care există și în noua categorie
    const keys = new Set(fieldsFor(c).map((fd) => fd.key));
    this.attrs = Object.fromEntries(Object.entries(this.attrs).filter(([k]) => keys.has(k)));
    this.checkPrice();
  }

  digits(key: string) {
    const v = this.attrs[key] ?? '';
    const clean = v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    if (clean !== v) queueMicrotask(() => (this.attrs[key] = clean));
  }

  badNumber(fd: FieldDef) {
    const v = this.attrs[fd.key];
    if (fd.type !== 'number' || !v) return false;
    const n = Number(v);
    return isNaN(n) || (fd.min != null && n < fd.min) || (fd.max != null && n > fd.max);
  }

  missingRequired() {
    if (!this.f.category) return [];
    return fieldsFor(this.f.category).filter((fd) => fd.required && !(this.attrs[fd.key] ?? '').trim()).map((fd) => this.i18n.attrLabel(fd.key));
  }

  filledCount() { return Object.values(this.attrs).filter((v) => (v ?? '').trim()).length; }

  /** Cât de complet e anunțul (0–100): poze, titlu, descriere, specificații, preț. */
  score() {
    const ph = this.photos().length, fields = this.f.category ? fieldsFor(this.f.category).length : 1;
    const ratio = Math.min(1, this.filledCount() / Math.max(4, Math.round(fields * 0.6)));
    const d = this.f.description.trim().length;
    return Math.round((ph >= 4 ? 25 : ph * 6) + (this.f.title.trim().length >= 15 ? 10 : this.f.title.trim().length >= 5 ? 5 : 0)
      + (d >= 150 ? 20 : d >= 20 ? 10 : 0) + ratio * 35 + (this.f.price != null ? 10 : 0));
  }
  scoreLevel() { const s = this.score(); return s >= 80 ? 3 : s >= 50 ? 2 : 1; }

  tipsLeft() {
    const out: string[] = [];
    if (this.photos().length < 4) out.push('photos');
    if (this.f.description.trim().length < 150) out.push('desc');
    if (this.f.category && this.filledCount() < 4) out.push('specs');
    if (this.f.negotiable && !this.useMin && (this.f.price ?? 0) > 0) out.push('min');
    return out;
  }

  median() {
    const a = this.analysis();
    return a?.medianCents && a.currency === this.f.currency ? a.medianCents / 100 : null;
  }

  priceMax() {
    const m = this.median(), p = this.f.price ?? 0;
    const base = m ? m * 2.5 : (PRICE_RANGE_EUR[this.f.category] ?? 5000) * (FX_APPROX[this.f.currency] ?? 1);
    return niceCeil(Math.max(base, p * 1.3, 10));
  }

  priceChips(): PriceChip[] {
    const m = this.median();
    if (!m) return [];
    const fmt = (v: number) => this.i18n.price(Math.round(v) * 100, this.f.currency);
    return [
      { label: this.i18n.t('sell.chipMedian') + ' · ' + fmt(m), value: Math.round(m) },
      { label: this.i18n.t('sell.chipFast') + ' · ' + fmt(m * 0.92), value: Math.round(m * 0.92) },
    ];
  }

  minFloor() { return Math.ceil((this.f.price ?? 0) * 0.3); }

  toggleMin() {
    this.useMin = !this.useMin;
    if (this.useMin && (this.f.minPrice == null || this.f.minPrice > (this.f.price ?? 0))) this.f.minPrice = Math.round((this.f.price ?? 0) * 0.85);
  }
  next() {
    this.error.set('');
    this.step.update((s) => s + 1);
    if (this.step() === 3) this.checkPrice();
    (document.querySelector('page-sell ion-content') as any)?.scrollToTop?.(300);
  }

  meterPos() {
    const a = this.analysis();
    if (!a?.medianCents || this.f.price == null) return 50;
    const ratio = (this.f.price * 100) / a.medianCents;
    return Math.max(4, Math.min(96, 50 + (ratio - 1) * 120));
  }

  checkPrice() {
    clearTimeout(this.priceTimer);
    if (!this.f.title || !this.f.category || this.f.price == null) return;
    this.priceTimer = setTimeout(async () => {
      this.checking.set(true);
      try { this.analysis.set(await this.api.priceCheck({ title: this.f.title, category: this.f.category, currency: this.f.currency, priceCents: Math.round(this.f.price! * 100) })); }
      catch { this.analysis.set(null); }
      this.checking.set(false);
    }, 450);
  }

  toggleShip(c: string) { const i = this.f.shipsTo.indexOf(c); i >= 0 ? this.f.shipsTo.splice(i, 1) : this.f.shipsTo.push(c); }

  async pick(ev: Event) {
    const files = Array.from((ev.target as HTMLInputElement).files ?? []).slice(0, 10 - this.photos().length);
    (ev.target as HTMLInputElement).value = '';
    for (const file of files) {
      const local: Photo = { url: URL.createObjectURL(file), uploading: true };
      this.photos.update((p) => [...p, local]);
      try {
        const blob = await this.compress(file);
        const r = await this.api.uploadImage(blob);
        this.photos.update((p) => p.map((x) => (x === local ? { id: r.id, url: r.url, uploading: false } : x)));
      } catch (e) {
        this.photos.update((p) => p.filter((x) => x !== local));
        this.ui.error(e);
      }
    }
  }

  /** Redimensionare și re-encodare în browser: mai rapid de încărcat, iar metadatele (inclusiv GPS) dispar. */
  private async compress(file: File): Promise<Blob> {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.86));
  }

  removePhoto(i: number) { this.photos.update((p) => p.filter((_, j) => j !== i)); }

  async publish() {
    this.busy.set(true);
    this.error.set('');
    const attributes: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.attrs)) if ((v ?? '').trim()) attributes[k] = v.trim().slice(0, 120);
    const body = {
      title: this.f.title.trim(), description: this.f.description.trim(), category: this.f.category, condition: this.f.condition,
      priceCents: Math.round((this.f.price ?? 0) * 100), currency: this.f.currency, country: this.f.country, city: this.f.city.trim(),
      shipsTo: this.f.worldwide ? ['*'] : this.f.shipsTo, weightGrams: Math.max(1, Math.round((this.f.weightKg || 1) * 1000)),
      acceptsOffers: this.f.negotiable, acceptsSwap: this.f.acceptsSwap, attributes, imageIds: this.photos().map((p) => p.id!).filter(Boolean),
      negotiable: this.f.negotiable, quantity: this.f.quantity,
      minPriceCents: this.f.negotiable && this.useMin && this.f.minPrice ? Math.round(this.f.minPrice * 100) : null,
    };
    try {
      const r = this.id() ? await this.api.updateListing(this.id()!, body) : await this.api.createListing(body);
      this.ui.tap();
      if (this.id()) { this.nav.navigateBack(['/listing', r.id]); }
      else { this.published.set(r.id); this.motion.confetti(90); this.api.me().then((m) => this.auth.setUser(m)).catch(() => {}); }
    } catch (e) { this.error.set(this.ui.errorText(e)); }
    this.busy.set(false);
  }

  view() { this.nav.navigateRoot(['/listing', this.published()]); }

  buying = signal(false);
  async buyExtra() {
    if (this.buying()) return;
    this.buying.set(true);
    try { await this.api.checkout('EXTRA_LISTING'); this.auth.setUser(await this.api.me()); this.ui.toast(this.i18n.t('plans.done') + ' · ' + this.i18n.t('common.simulated')); }
    catch (e) { this.ui.error(e); }
    this.buying.set(false);
  }
}

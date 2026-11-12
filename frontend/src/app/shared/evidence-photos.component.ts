import { Component, inject, input, model, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { Api } from '../core/api.service';
import { compressImage } from '../core/image';
import { TPipe } from '../core/i18n.service';
import { Ui } from '../core/ui.service';

interface Shot { id?: string; url: string; uploading: boolean; }

/**
 * Poze-dovadă pentru expediere și reclamații. Se pot face direct cu camera.
 * Pozele încărcate aici devin private: le văd doar cele două părți și echipa Cumped.
 */
@Component({
  selector: 'cmp-evidence-photos',
  imports: [IonIcon, TPipe],
  template: `
    <div class="ev">
      <div class="head"><b>{{ label() }}</b><span class="tnum" [class.ok]="done() >= min()">{{ done() }}/{{ max() }}</span></div>
      @if (hint()) { <p class="hint">{{ hint() }}</p> }
      <div class="grid">
        @for (s of shots(); track s.url; let i = $index) {
          <div class="ph" [class.up]="s.uploading">
            <img [src]="s.url" alt="" />
            @if (s.uploading) { <span class="spin" aria-hidden="true"></span> }
            @else { <button type="button" class="x" (click)="remove(i)" [attr.aria-label]="'common.remove' | t"><ion-icon name="close"></ion-icon></button> }
          </div>
        }
        @if (shots().length < max()) {
          <label class="add">
            <ion-icon name="camera-outline"></ion-icon><span>{{ 'evidence.add' | t }}</span>
            <input type="file" accept="image/jpeg,image/png" capture="environment" multiple (change)="pick($event)" />
          </label>
        }
      </div>
      <p class="priv"><ion-icon name="lock-closed-outline"></ion-icon>{{ 'evidence.private' | t }}</p>
    </div>
  `,
  styles: [`
    .ev { display: flex; flex-direction: column; gap: 8px; }
    .head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .head span { font-size: 14px; font-weight: 700; color: var(--text-2); } .head span.ok { color: var(--ok); }
    .hint { font-size: 14.5px; color: var(--text-2); margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 8px; }
    .ph, .add { position: relative; aspect-ratio: 1; border-radius: 14px; overflow: hidden; }
    .ph img { width: 100%; height: 100%; object-fit: cover; background: var(--image-bg); }
    .ph.up img { opacity: .5; }
    .spin { position: absolute; inset: 0; margin: auto; width: 26px; height: 26px; border-radius: 50%; border: 3px solid #fff8; border-top-color: #fff; animation: rot .8s linear infinite; }
    @keyframes rot { to { transform: rotate(1turn); } }
    .x { position: absolute; top: 4px; right: 4px; width: 32px; height: 32px; border-radius: 50%; border: 0; display: grid; place-items: center;
      background: rgb(0 0 0 / .6); color: #fff; font-size: 18px; cursor: pointer; }
    .x::after { content: ''; position: absolute; inset: -6px; }
    .add { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; border: 2px dashed var(--line-strong, var(--line));
      color: var(--accent); font-size: 13px; font-weight: 700; cursor: pointer; background: var(--surface-2); text-align: center; padding: 4px; }
    .add ion-icon { font-size: 26px; }
    .add input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .add:focus-within { outline: 3px solid var(--focus, var(--accent)); outline-offset: 2px; }
    .priv { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 13.5px; color: var(--text-2); }
  `],
})
export class EvidencePhotosComponent {
  private api = inject(Api);
  private ui = inject(Ui);
  label = input('');
  hint = input('');
  min = input(0);
  max = input(6);
  ids = model<string[]>([]);
  shots = signal<Shot[]>([]);
  done = () => this.shots().filter((s) => !!s.id).length;

  async pick(ev: Event) {
    const el = ev.target as HTMLInputElement;
    const files = Array.from(el.files ?? []).slice(0, this.max() - this.shots().length);
    el.value = '';
    for (const file of files) {
      const shot: Shot = { url: URL.createObjectURL(file), uploading: true };
      this.shots.update((l) => [...l, shot]);
      try {
        const r = await this.api.uploadImage(await compressImage(file));
        this.shots.update((l) => l.map((x) => (x === shot ? { ...x, id: r.id, uploading: false } : x)));
      } catch (e) {
        this.shots.update((l) => l.filter((x) => x !== shot));
        this.ui.error(e);
      }
      this.sync();
    }
  }

  remove(i: number) { this.shots.update((l) => l.filter((_, j) => j !== i)); this.sync(); }

  private sync() { this.ids.set(this.shots().filter((s) => !!s.id).map((s) => s.id!)); }
}

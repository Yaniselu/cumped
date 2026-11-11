import { I18n } from './i18n.service';

/** Mesaj de sistem pus în chat de backend la fiecare pas al negocierii: [[offer:EVENT:sumăÎnCenți:MONEDĂ:TIP]]. */
export interface OfferEvent { event: string; amountCents: number; currency: string; kind: 'PRICE' | 'SWAP'; }

const RX = /^\[\[offer:([A-Z_]+):(\d+):([A-Z]{3}):(PRICE|SWAP)\]\]$/;

export function parseOfferEvent(body: string | null | undefined): OfferEvent | null {
  const m = body ? RX.exec(body) : null;
  return m ? { event: m[1], amountCents: Number(m[2]), currency: m[3], kind: m[4] as 'PRICE' | 'SWAP' } : null;
}

/** Text scurt, localizat, pentru lista de conversații și pentru bula din chat. */
export function offerEventText(i18n: I18n, e: OfferEvent, mine: boolean): string {
  const kind = e.kind === 'SWAP' && e.event === 'NEW' ? 'SWAP' : e.event;
  const amount = e.amountCents ? i18n.price(e.amountCents, e.currency) : '';
  return i18n.t(`neg.ev.${kind}.${mine ? 'mine' : 'other'}`, { amount });
}

/** Variantă neutră (nu știm cine a trimis ultimul mesaj) pentru lista de conversații. */
export function offerEventShort(i18n: I18n, e: OfferEvent): string {
  const kind = e.kind === 'SWAP' && e.event === 'NEW' ? 'SWAP' : e.event;
  return i18n.t(`neg.evShort.${kind}`, { amount: e.amountCents ? i18n.price(e.amountCents, e.currency) : '' });
}

/** Evenimentele plății sigure din chat: [[order:EVENT:sumă:MONEDĂ]]. */
const ORX = /^\[\[order:([A-Z_]+):(\d+):([A-Z]{3})\]\]$/;
export interface OrderEvent { event: string; amountCents: number; currency: string; }
export function parseOrderEvent(body: string | null | undefined): OrderEvent | null {
  const m = body ? ORX.exec(body) : null;
  return m ? { event: m[1], amountCents: Number(m[2]), currency: m[3] } : null;
}
export function orderEventText(i18n: I18n, e: OrderEvent): string {
  return i18n.t('orders.ev.' + e.event, { amount: i18n.price(e.amountCents, e.currency) });
}

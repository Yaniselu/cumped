import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AdminTicket, AppNotification, Card, ConversationSummary, Detail, ListingDraft, Me, Negotiation, Order, OrderQuote, Page, SellerStats, ShipAddress, PriceAnalysis, PublicUser,
  Review, ServerConfig, ShippingEstimate, Stats, Thread, Ticket, VeloReply,
} from './models';

export interface SearchQuery {
  q?: string; category?: string; minPrice?: number; maxPrice?: number; country?: string; city?: string;
  condition?: string[]; swap?: boolean; verified?: boolean; shipsTo?: string; sort?: string; page?: number; size?: number;
}

/** Toate apelurile către backend. Erorile vin mereu ca {error: "COD"}. */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  readonly base = environment.apiBase + '/api';

  url(path: string | null | undefined): string | null {
    if (!path) return null;
    if (path.startsWith('/api/')) return environment.apiBase + path;
    return path;
  }

  private get<T>(path: string, params?: Record<string, any>) {
    let p = new HttpParams();
    if (params) for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v)) v.forEach((x) => (p = p.append(k, String(x))));
      else p = p.set(k, String(v));
    }
    return firstValueFrom(this.http.get<T>(this.base + path, { params: p }));
  }
  private post<T>(path: string, body: any = {}) { return firstValueFrom(this.http.post<T>(this.base + path, body)); }
  private put<T>(path: string, body: any) { return firstValueFrom(this.http.put<T>(this.base + path, body)); }
  private patch<T>(path: string, body: any) { return firstValueFrom(this.http.patch<T>(this.base + path, body)); }
  private del<T>(path: string) { return firstValueFrom(this.http.delete<T>(this.base + path)); }

  config() { return this.get<ServerConfig>('/config'); }
  search(q: SearchQuery) { return this.get<Page<Card>>('/listings', q); }
  listing(id: string) { return this.get<Detail>(`/listings/${id}`); }
  similar(id: string) { return this.get<Card[]>(`/listings/${id}/similar`); }
  priceAnalysis(id: string) { return this.get<PriceAnalysis>(`/listings/${id}/price-analysis`); }
  priceCheck(body: { title: string; category: string; currency: string; priceCents: number }) { return this.post<PriceAnalysis>('/listings/price-check', body); }
  createListing(body: any) { return this.post<{ id: string }>('/listings', body); }
  updateListing(id: string, body: any) { return this.put<{ id: string }>(`/listings/${id}`, body); }
  listingStatus(id: string, action: string, buyerId?: string) { return this.post<{ status: string }>(`/listings/${id}/status`, { action, buyerId }); }
  favorite(id: string, on: boolean) { return on ? this.post(`/listings/${id}/favorite`) : this.del(`/listings/${id}/favorite`); }
  myListings() { return this.get<Card[]>('/me/listings'); }
  favorites() { return this.get<Card[]>('/me/favorites'); }
  uploadImage(file: Blob) {
    const fd = new FormData();
    fd.append('file', file, 'photo.jpg');
    return firstValueFrom(this.http.post<{ id: string; url: string }>(this.base + '/media', fd));
  }
  shipping(listingId: string, to: string) { return this.get<ShippingEstimate>('/shipping/estimate', { listingId, to }); }

  me() { return this.get<Me>('/me'); }
  updateMe(body: Partial<{ username: string; displayMode: string; bio: string; city: string; country: string; locale: string }>) { return this.patch<Me>('/me', body); }
  user(id: string) { return this.get<PublicUser>(`/users/${id}`); }
  userListings(id: string) { return this.get<Card[]>(`/users/${id}/listings`); }
  userReviews(id: string) { return this.get<Review[]>(`/users/${id}/reviews`); }
  realName(id: string) { return this.get<{ fullName: string }>(`/users/${id}/real-name`); }
  stats() { return this.get<Stats>('/me/stats'); }
  exportData() { return this.get<any>('/me/export'); }
  deleteAccount() { return this.del('/me'); }
  changePassword(currentPassword: string | null, newPassword: string) { return this.post('/auth/change-password', { currentPassword, newPassword }); }

  conversations() { return this.get<ConversationSummary[]>('/conversations'); }
  startConversation(listingId: string, message?: string) { return this.post<{ id: string }>('/conversations', { listingId, message }); }
  thread(id: string, after?: string) { return this.get<Thread>(`/conversations/${id}`, { after }); }
  sendMessage(id: string, body: string) { return this.post<{ message: any; warnings: string[] }>(`/conversations/${id}/messages`, { body }); }

  makeOffer(listingId: string, body: { kind: 'PRICE' | 'SWAP'; amountCents?: number; swapListingId?: string; message?: string }) { return this.post<{ id: string }>(`/listings/${listingId}/offers`, body); }
  respondOffer(id: string, action: 'accept' | 'decline' | 'withdraw' | 'counter', body?: { amountCents?: number; message?: string }) { return this.post(`/offers/${id}/${action}`, body ?? {}); }
  negotiations() { return this.get<Negotiation[]>('/me/negotiations'); }
  negotiation(threadId: string) { return this.get<Negotiation>(`/negotiations/${threadId}`); }
  block(userId: string) { return this.post(`/users/${userId}/block`); }
  unblock(userId: string) { return this.del(`/users/${userId}/block`); }
  blocks() { return this.get<PublicUser[]>('/me/blocks'); }
  report(body: { targetType: 'LISTING' | 'USER' | 'MESSAGE'; targetId: string; reason: string; details?: string }) { return this.post<Ticket>('/reports', body); }
  appeal(listingId: string, message: string) { return this.post<Ticket>('/appeals', { listingId, message }); }
  updateBusiness(body: { accountType: 'PRIVATE' | 'BUSINESS'; name?: string; regNo?: string; vat?: string; address?: string; email?: string; phone?: string }) { return this.patch<Me>('/me/business', body); }
  acceptTerms() { return this.post<Me>('/me/accept-terms'); }
  // plata sigură
  orderQuote(listingId: string, delivery: 'PICKUP' | 'COURIER', country?: string) { return this.get<OrderQuote>(`/listings/${listingId}/order-quote`, { delivery, country }); }
  createOrder(listingId: string, body: { delivery: 'PICKUP' | 'COURIER'; address?: ShipAddress }) { return this.post<Order>(`/listings/${listingId}/orders`, body); }
  orders() { return this.get<Order[]>('/me/orders'); }
  order(id: string) { return this.get<Order>(`/orders/${id}`); }
  shipOrder(id: string, carrier?: string, trackingCode?: string) { return this.post<Order>(`/orders/${id}/ship`, { carrier, trackingCode }); }
  confirmOrder(id: string) { return this.post<Order>(`/orders/${id}/confirm`); }
  disputeOrder(id: string, reason: string, details: string) { return this.post<Order>(`/orders/${id}/dispute`, { reason, details }); }
  cancelOrder(id: string) { return this.post<Order>(`/orders/${id}/cancel`); }
  disputedOrders() { return this.get<Order[]>('/admin/orders/disputed'); }
  resolveOrder(id: string, outcome: 'REFUND' | 'RELEASE') { return this.post(`/admin/orders/${id}/resolve`, { outcome }); }
  // alertă preț, statistici vânzător, AI
  setPriceAlert(listingId: string, targetPriceCents: number) { return this.put<{ targetPriceCents: number }>(`/listings/${listingId}/price-alert`, { targetPriceCents }); }
  clearPriceAlert(listingId: string) { return this.del(`/listings/${listingId}/price-alert`); }
  sellerStats(userId: string) { return this.get<SellerStats>(`/users/${userId}/stats`); }
  listingDraft(imageIds: string[], lang: string, currency: string) { return this.post<ListingDraft>('/ai/listing-draft', { imageIds, lang, currency }); }
  translate(messageId: string, lang: string) { return this.post<{ text: string }>(`/messages/${messageId}/translate`, { lang }); }
  review(body: { listingId: string; revieweeId?: string; rating: number; comment?: string }) { return this.post('/reviews', body); }

  notifications() { return this.get<AppNotification[]>('/me/notifications'); }
  readAllNotifications() { return this.post('/me/notifications/read-all'); }
  badges() { return this.get<{ notifications: number; messages: number; offers: number }>('/me/badges'); }
  savedSearches() { return this.get<any[]>('/me/saved-searches'); }
  saveSearch(body: { query?: string; category?: string; maxPriceCents?: number; country?: string }) { return this.post('/me/saved-searches', body); }
  deleteSavedSearch(id: string) { return this.del(`/me/saved-searches/${id}`); }

  velo(body: { sessionId?: string; message: string; listingId?: string; reportedUserId?: string }) { return this.post<VeloReply>('/velo/message', body); }
  myTickets() { return this.get<Ticket[]>('/velo/tickets'); }

  plans() { return this.get<any>('/billing/plans'); }
  checkout(product: string, listingId?: string) { return this.post<{ ok: boolean; simulated: boolean }>('/billing/checkout', { product, listingId }); }

  startIdentity() { return this.post<{ mode: string }>('/verification/identity/start'); }
  devIdentity(firstName: string, lastName: string) { return this.post('/verification/identity/dev-complete', { firstName, lastName }); }
  startPhone(phone: string) { return this.post<{ mode: string; devCode?: string }>('/verification/phone/start', { phone }); }
  confirmPhone(code: string) { return this.post('/verification/phone/confirm', { code }); }

  adminOverview() { return this.get<Record<string, number>>('/admin/overview'); }
  adminTickets(status: string) { return this.get<AdminTicket[]>('/admin/tickets', { status }); }
  adminTicket(id: string) { return this.get<{ ticket: AdminTicket; transcript: string }>(`/admin/tickets/${id}`); }
  adminDecide(id: string, action: string) { return this.post(`/admin/tickets/${id}/${action}`); }
}

/** Extrage codul de eroare din răspunsul API. */
export function errorCode(e: any): string {
  return e?.error?.error ?? (e?.status === 0 ? 'NETWORK' : 'UNKNOWN');
}

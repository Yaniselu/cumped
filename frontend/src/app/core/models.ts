export interface Quota { active: number; limit: number; qualifiedReferrals: number; referralsNeeded: number; freeYearEndsAt: string; }

export interface Me {
  id: string; email: string; username: string; displayName: string; displayMode: 'USERNAME' | 'REAL_NAME';
  legalName: string | null; idVerified: boolean; phoneVerified: boolean; phoneLast2: string | null;
  role: 'USER' | 'ADMIN'; plan: 'FREE' | 'PLUS' | 'PRO'; planUntil: string | null; referralCode: string;
  country: string | null; city: string | null; locale: string; avatarHue: number; bio: string | null;
  createdAt: string; rating: number; ratingCount: number; quota: Quota; hasPassword: boolean;
}

export interface PublicUser {
  id: string; username: string; displayName: string; idVerified: boolean; phoneVerified: boolean;
  country: string | null; city: string | null; avatarHue: number; bio: string | null; memberSince: string;
  rating: number; ratingCount: number; trustScore: number; realNameAvailable: boolean;
}

export interface Card {
  id: string; title: string; priceCents: number; currency: string; previousPriceCents: number | null;
  city: string; country: string; imageUrl: string | null; category: string; condition: string;
  sellerVerified: boolean; promoted: boolean; acceptsSwap: boolean; favorite: boolean; status: string; createdAt: string;
}

export interface Page<T> { items: T[]; page: number; hasMore: boolean; }

export interface Detail {
  id: string; title: string; description: string; category: string; condition: string; priceCents: number;
  currency: string; previousPriceCents: number | null; country: string; city: string; shipsTo: string[];
  weightGrams: number; acceptsOffers: boolean; acceptsSwap: boolean; attributes: Record<string, string>;
  images: { id: string; url: string }[]; status: string; promoted: boolean; createdAt: string; seller: PublicUser;
  favorite: boolean; owner: boolean; conversationId: string | null; priceHistory: { priceCents: number; at: string }[];
  ownerStats: { views: number; favorites: number; messages: number; offers: number; expiresAt: string } | null;
  favorites: number; views: number;
}

export interface PriceAnalysis { verdict: 'BELOW' | 'FAIR' | 'ABOVE' | 'UNKNOWN'; medianCents: number | null; comparables: number; currency: string; }

export interface ConversationSummary {
  id: string; listing: { id: string; title: string; priceCents: number; currency: string; imageUrl: string | null; status: string };
  other: PublicUser; role: 'BUYER' | 'SELLER'; lastMessage: string | null; lastAt: string | null; unread: number;
}
export interface ChatMessage { id: string; mine: boolean; body: string; flagged: boolean; flagReason: string | null; createdAt: string; read: boolean; }
export interface Thread { conversation: ConversationSummary; messages: ChatMessage[]; }

export interface Offer {
  id: string; kind: 'PRICE' | 'SWAP'; amountCents: number | null; currency: string | null; message: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN'; createdAt: string; listing: Card | null;
  swapListing: Card | null; counterpart: PublicUser | null;
}

export interface AppNotification { id: string; type: string; params: Record<string, any>; link: string | null; read: boolean; createdAt: string; }

export interface Ticket { id: string; code: string; category: string; priority: string; status: string; autoAction: string | null; summary: string; createdAt: string; }
export interface VeloReply { sessionId: string; reply: string; suggestions: string[]; ticket: Ticket | null; mode: 'AI' | 'RULES'; }

export interface Review { id: string; rating: number; comment: string | null; reviewerName: string; reviewerVerified: boolean; listingTitle: string; createdAt: string; }

export interface Stats {
  totalViews: number; totalFavorites: number; totalMessages: number; totalOffers: number; soldCount: number;
  viewsByDay: { day: string; views: number }[];
  listings: { id: string; title: string; status: string; views: number; favorites: number; messages: number; offers: number }[];
}

export interface ServerConfig { googleLogin: boolean; appleLogin: boolean; veloAi: 'AI' | 'RULES'; devMode: boolean; freeActiveListings: number; referralBonusListings: number; referralsNeeded: number; }

export interface ShippingEstimate { available: boolean; zone: string | null; minCents: number; maxCents: number; currency: string; minDays: number; maxDays: number; }

export interface AdminTicket {
  id: string; code: string; category: string; priority: string; risk: number; status: string; source: string;
  autoAction: string | null; autoActionState: string | null; summary: string; reporter: string | null;
  reportedUser: string | null; relatedListingId: string | null; relatedListingTitle: string | null; createdAt: string;
}

export const CATEGORIES = ['PHONES', 'ELECTRONICS', 'COMPUTERS', 'VEHICLES', 'AUTO_PARTS', 'REAL_ESTATE', 'HOME_GARDEN',
  'FASHION', 'KIDS', 'SPORTS', 'HOBBY', 'BOOKS_MUSIC', 'PETS', 'SERVICES', 'JOBS', 'OTHER'] as const;
export const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'FOR_PARTS'] as const;
export const CURRENCIES = ['RON', 'EUR', 'USD', 'GBP', 'PLN', 'HUF', 'BGN', 'CZK', 'CHF', 'TRY', 'UAH', 'MDL'];
export const COUNTRIES = ['RO', 'MD', 'BG', 'HU', 'DE', 'AT', 'IT', 'FR', 'ES', 'PL', 'CZ', 'SK', 'NL', 'BE', 'GB', 'IE',
  'PT', 'GR', 'HR', 'SI', 'RS', 'UA', 'TR', 'SE', 'DK', 'NO', 'FI', 'CH', 'US', 'CA'];

export type PostType = "blog" | "picture" | "audio" | "video" | "polls";

export type ProductType =
  | "digital"
  | "physical"
  | "membership"
  | "services"
  | "nft"
  | "live"
  | "event";

export type PriceTier = { name: string; price: string; description?: string };

export type ServiceSlot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  available?: boolean;
};

export type ProductVariantOption = { id: string; value: string };
export type ProductVariant = {
  id: string;
  name: string;
  options: ProductVariantOption[];
};

export type ProductReview = {
  id: string;
  productId: string;
  userId: string;
  rating: number;
  body?: string;
  createdAt: number;
};

export type Post = {
  id: string;
  type: PostType;
  title: string;
  body?: string;
  mediaUri?: string;
  pollOptions?: string[];
  thumbnailUri?: string;
};

export type Product = {
  id: string;
  type: ProductType;
  title: string;
  description?: string;
  price?: string;
  mediaUri?: string;
  interval?: string;
  pinned?: boolean;
  isSponsored?: boolean;
  isWholesale?: boolean;
  rating?: number;
  tokenGated?: boolean;
  priceTiers?: PriceTier[];
  serviceSlots?: ServiceSlot[];
  eventDate?: number;
  eventTime?: string;
  creatorId?: string;
  inventoryStatus?: "in_stock" | "low_stock" | "out_of_stock";
  stockQuantity?: number;
  variants?: ProductVariant[];
  currency?: string;
  deliveryType?: "instant" | "shipped";
  escrowRequired?: boolean;
  chain?: string;
  category?: string;
  categories?: string[];
  tags?: string[];
  coverUri?: string;
  goLiveAt?: number;
  mediaMimeType?: string;
  createdAt?: number;
};

export type Event = {
  id: string;
  title: string;
  description?: string;
  date: number;
  createdAt: number;
};

export type ProductRow = {
  id: string;
  creator_id: string;
  type: string;
  title: string;
  description: string | null;
  price: string | null;
  media_uri: string | null;
  interval: string | null;
  pinned: boolean;
  is_sponsored: boolean | null;
  rating: number | null;
  inventory_status: string | null;
  currency: string | null;
  delivery_type: string | null;
  price_tiers: unknown;
  service_slots: unknown;
  event_date: number | null;
  event_time: string | null;
  stock_quantity: number | null;
  variants: unknown;
  escrow_required: boolean | null;
  chain: string | null;
  is_wholesale: boolean | null;
  token_gated: boolean | null;
  category?: string | null;
  categories?: string[] | null;
  tags?: string[] | null;
  cover_uri?: string | null;
  go_live_at?: string | null;
  media_mime_type?: string | null;
  created_at?: string;
  updated_at?: string;
};

import type { Product, PriceTier, ServiceSlot, ProductVariant, ProductRow } from "./product-types";

export type { ProductRow };

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    type: row.type as Product["type"],
    title: row.title,
    description: row.description ?? undefined,
    price: row.price ?? undefined,
    mediaUri: row.media_uri ?? undefined,
    interval: row.interval ?? undefined,
    pinned: row.pinned ?? false,
    isSponsored: row.is_sponsored ?? undefined,
    rating: row.rating ?? undefined,
    inventoryStatus: (row.inventory_status as Product["inventoryStatus"]) ?? undefined,
    currency: row.currency ?? undefined,
    deliveryType: (row.delivery_type as Product["deliveryType"]) ?? undefined,
    priceTiers: Array.isArray(row.price_tiers) ? (row.price_tiers as PriceTier[]) : undefined,
    serviceSlots: Array.isArray(row.service_slots) ? (row.service_slots as ServiceSlot[]) : undefined,
    eventDate: row.event_date ?? undefined,
    eventTime: row.event_time ?? undefined,
    stockQuantity: row.stock_quantity ?? undefined,
    variants: Array.isArray(row.variants) ? (row.variants as ProductVariant[]) : undefined,
    escrowRequired: row.escrow_required ?? undefined,
    chain: row.chain ?? undefined,
    isWholesale: row.is_wholesale ?? undefined,
    tokenGated: row.token_gated ?? undefined,
    creatorId: row.creator_id,
    category: row.category ?? undefined,
    categories: Array.isArray(row.categories) ? (row.categories as string[]) : (row.category ? [row.category] : undefined),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : undefined,
    coverUri: row.cover_uri ?? undefined,
    goLiveAt: row.go_live_at ? new Date(row.go_live_at).getTime() : undefined,
    mediaMimeType: row.media_mime_type ?? undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
  };
}

export function productToRow(
  p: Partial<Product> & { type: string; title: string },
  creatorId: string
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    creator_id: creatorId,
    type: p.type,
    title: p.title,
    description: p.description ?? null,
    price: p.price ?? null,
    media_uri: p.mediaUri ?? null,
    interval: p.interval ?? null,
    pinned: p.pinned ?? false,
    is_sponsored: p.isSponsored ?? null,
    rating: p.rating ?? null,
    inventory_status: p.inventoryStatus ?? null,
    currency: p.currency ?? null,
    delivery_type: p.deliveryType ?? null,
    price_tiers: p.priceTiers ?? null,
    service_slots: p.serviceSlots ?? null,
    event_date: p.eventDate ?? null,
    event_time: p.eventTime ?? null,
    stock_quantity: p.stockQuantity ?? null,
    variants: p.variants ?? null,
    escrow_required: p.escrowRequired ?? null,
    chain: p.chain ?? null,
    is_wholesale: p.isWholesale ?? null,
    token_gated: p.tokenGated ?? null,
    category: p.category ?? null,
    categories: p.categories?.length ? p.categories.slice(0, 3) : null,
    tags: p.tags?.length ? p.tags : null,
    cover_uri: p.coverUri ?? null,
    go_live_at: p.goLiveAt != null ? new Date(p.goLiveAt).toISOString() : null,
    media_mime_type: p.mediaMimeType ?? null,
  };
  return row;
}

import supabase from "./supabase";

export type StorageSectionKey =
  | "cinema"
  | "broadcasts"
  | "stations"
  | "closet"
  | "library"
  | "music"
  | "art";

export type StorageItemKind = "purchase" | "created_product" | "post";

export type StorageItem = {
  id: string;
  kind: StorageItemKind;
  title: string;
  section: StorageSectionKey;
  previewUri: string | null;
  productId: string | null;
  orderId: string | null;
  postId: string | null;
};

/** Section labels for UI */
export const STORAGE_SECTIONS: { key: StorageSectionKey; label: string }[] = [
  { key: "cinema", label: "Cinema" },
  { key: "broadcasts", label: "Broadcasts" },
  { key: "stations", label: "Stations" },
  { key: "closet", label: "Closet" },
  { key: "library", label: "Library" },
  { key: "music", label: "Music" },
  { key: "art", label: "Art" },
];

function matchesCategory(category: string | null | undefined, list: string[]): boolean {
  if (!category) return false;
  const c = category.toLowerCase();
  return list.some((x) => c.includes(x.toLowerCase()));
}

function matchesCategories(arr: string[] | null | undefined, list: string[]): boolean {
  if (!arr?.length) return false;
  return arr.some((c) => matchesCategory(c, list));
}

/**
 * Map a product (type, category, categories) to a storage section.
 */
export function getStorageSectionForProduct(product: {
  type?: string | null;
  category?: string | null;
  categories?: string[] | null;
}): StorageSectionKey {
  const type = (product.type ?? "").toLowerCase();
  const cat = product.category ?? "";
  const cats = product.categories ?? [];

  if (matchesCategory(cat, ["cinema", "film"]) || matchesCategories(cats, ["cinema", "film"]))
    return "cinema";
  if (type === "live" || matchesCategory(cat, ["broadcast"]) || matchesCategories(cats, ["broadcast"]))
    return "broadcasts";
  if (matchesCategory(cat, ["station"]) || matchesCategories(cats, ["station"])) return "stations";
  if (
    type === "physical" && (matchesCategory(cat, ["apparel", "closet"]) || matchesCategories(cats, ["apparel", "closet"]))
  )
    return "closet";
  if (matchesCategory(cat, ["closet"]) || matchesCategories(cats, ["closet"])) return "closet";
  if (type === "digital" || matchesCategory(cat, ["ebook", "book"]) || matchesCategories(cats, ["ebook", "book"]))
    return "library";
  if (matchesCategory(cat, ["music"]) || matchesCategories(cats, ["music"]) || type === "music")
    return "music";
  if (type === "nft" || matchesCategory(cat, ["art"]) || matchesCategories(cats, ["art"]))
    return "art";

  return "library";
}

/**
 * Map a post type to a storage section.
 */
export function getStorageSectionForPost(post: { type?: string | null }): StorageSectionKey {
  const type = (post.type ?? "").toLowerCase();
  if (type === "video") return "cinema";
  if (type === "live") return "broadcasts";
  if (type === "audio") return "music";
  if (type === "picture" || type === "photo") return "art";
  if (type === "blog" || type === "polls") return "library";
  return "library";
}

export type CreatorView = "products" | "posts" | "all";

/**
 * Fetches storage items for the user: purchases, created products, and/or their posts,
 * with section and previewUri. Use creatorView to choose products only, posts only, or both.
 */
export async function fetchStorageItems(
  userId: string,
  creatorView: CreatorView
): Promise<StorageItem[]> {
  const items: StorageItem[] = [];

  if (creatorView === "products" || creatorView === "all") {
    const { data: orders } = await supabase
      .from("orders")
      .select("id")
      .eq("buyer_id", userId)
      .order("created_at", { ascending: false });

    if (orders?.length) {
      const orderIds = orders.map((o) => o.id);
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("id, product_id, title, order_id")
        .in("order_id", orderIds);

      const productIds = [...new Set((orderItems ?? []).map((o) => o.product_id).filter(Boolean))];
      let productMap: Record<string, { cover_uri?: string | null; media_uri?: string | null; type?: string | null; category?: string | null; categories?: string[] | null }> = {};
      if (productIds.length > 0) {
        const { data: productsForOrders } = await supabase
          .from("products")
          .select("id, cover_uri, media_uri, type, category, categories")
          .in("id", productIds);
        for (const p of productsForOrders ?? []) {
          productMap[p.id] = p;
        }
      }

      for (const row of orderItems ?? []) {
        const prod = row.product_id ? productMap[row.product_id] : undefined;
        const previewUri = prod?.cover_uri ?? prod?.media_uri ?? null;
        const section = prod
          ? getStorageSectionForProduct({ type: prod.type, category: prod.category, categories: prod.categories })
          : "library";
        items.push({
          id: row.id,
          kind: "purchase",
          title: row.title ?? "Purchase",
          section,
          previewUri,
          productId: row.product_id ?? null,
          orderId: row.order_id ?? null,
          postId: null,
        });
      }
    }

    const { data: products } = await supabase
      .from("products")
      .select("id, title, type, category, categories, cover_uri, media_uri")
      .eq("creator_id", userId)
      .order("created_at", { ascending: false });

    for (const p of products ?? []) {
      const previewUri = p.cover_uri ?? p.media_uri ?? null;
      const section = getStorageSectionForProduct({
        type: p.type,
        category: p.category,
        categories: p.categories,
      });
      items.push({
        id: p.id,
        kind: "created_product",
        title: p.title ?? "Product",
        section,
        previewUri,
        productId: p.id,
        orderId: null,
        postId: null,
      });
    }
  }

  if (creatorView === "posts" || creatorView === "all") {
    const { data: posts } = await supabase
      .from("posts")
      .select("id, title, type, media_uri, thumbnail_uri")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    for (const post of posts ?? []) {
      const previewUri = post.thumbnail_uri ?? post.media_uri ?? null;
      const section = getStorageSectionForPost({ type: post.type });
      items.push({
        id: post.id,
        kind: "post",
        title: post.title ?? "Post",
        section,
        previewUri,
        productId: null,
        orderId: null,
        postId: post.id,
      });
    }
  }

  return items;
}

/** @deprecated Use StorageItem and fetchStorageItems instead. */
export type OwnedItemKind = "purchase" | "created";

/** @deprecated Use StorageItem instead. */
export type OwnedItem = {
  id: string;
  kind: OwnedItemKind;
  title: string;
  productId: string | null;
  orderId: string | null;
};

/**
 * @deprecated Use fetchStorageItems(userId, 'products') instead.
 * Fetches items the user owns: purchased (from orders) and created (products they created).
 */
export async function fetchOwnedItems(userId: string): Promise<OwnedItem[]> {
  const items = await fetchStorageItems(userId, "products");
  return items
    .filter((i): i is StorageItem => i.kind !== "post")
    .map((i) => ({
      id: i.id,
      kind: i.kind === "created_product" ? "created" : "purchase",
      title: i.title,
      productId: i.productId,
      orderId: i.orderId,
    }));
}

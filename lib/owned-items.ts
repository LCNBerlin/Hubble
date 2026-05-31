import { apiGet } from "./api";

export type StorageSectionKey = "cinema" | "broadcasts" | "stations" | "closet" | "library" | "music" | "art";
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

export function getStorageSectionForProduct(product: { type?: string | null; category?: string | null; categories?: string[] | null }): StorageSectionKey {
  const type = (product.type ?? "").toLowerCase();
  const cat = product.category ?? "";
  const cats = product.categories ?? [];
  if (matchesCategory(cat, ["cinema", "film"]) || matchesCategories(cats, ["cinema", "film"])) return "cinema";
  if (type === "live" || matchesCategory(cat, ["broadcast"]) || matchesCategories(cats, ["broadcast"])) return "broadcasts";
  if (matchesCategory(cat, ["station"]) || matchesCategories(cats, ["station"])) return "stations";
  if (type === "physical" && (matchesCategory(cat, ["apparel", "closet"]) || matchesCategories(cats, ["apparel", "closet"]))) return "closet";
  if (matchesCategory(cat, ["closet"]) || matchesCategories(cats, ["closet"])) return "closet";
  if (type === "digital" || matchesCategory(cat, ["ebook", "book"]) || matchesCategories(cats, ["ebook", "book"])) return "library";
  if (matchesCategory(cat, ["music"]) || matchesCategories(cats, ["music"]) || type === "music") return "music";
  if (type === "nft" || matchesCategory(cat, ["art"]) || matchesCategories(cats, ["art"])) return "art";
  return "library";
}

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

export async function fetchStorageItems(userId: string, creatorView: CreatorView): Promise<StorageItem[]> {
  return apiGet<StorageItem[]>(`/storage/items?userId=${userId}&view=${creatorView}`);
}

/** @deprecated Use fetchStorageItems(userId, 'products') instead. */
export type OwnedItemKind = "purchase" | "created";

/** @deprecated Use StorageItem instead. */
export type OwnedItem = {
  id: string;
  kind: OwnedItemKind;
  title: string;
  productId: string | null;
  orderId: string | null;
};

/** @deprecated Use fetchStorageItems(userId, 'products') instead. */
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

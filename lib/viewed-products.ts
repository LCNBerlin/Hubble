import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "hubble_viewed_product_ids";
const MAX_ENTRIES = 20;

export type ViewedProductEntry = { id: string; title: string };

export async function getViewedProducts(): Promise<ViewedProductEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getViewedProductIds(): Promise<string[]> {
  const entries = await getViewedProducts();
  return entries.map((e) => e.id);
}

export async function addViewedProduct(id: string, title: string): Promise<void> {
  try {
    const entries = await getViewedProducts();
    const filtered = entries.filter((e) => e.id !== id);
    const next = [{ id, title: title || "Untitled" }, ...filtered].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

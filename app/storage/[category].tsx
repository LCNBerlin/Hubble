import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { fetchStorageItems, type StorageItem } from "../../lib/owned-items";
import { EmptyState } from "../../components/ui";

const CATEGORY_LABELS: Record<string, string> = {
  cinema: "Cinema",
  broadcasts: "Broadcasts",
  stations: "Stations",
  closet: "Closet",
  music: "Music",
  products: "Products",
  art: "Art",
  library: "Library",
  documents: "Documents",
  photo: "Photo",
  videos: "Videos",
  all: "All",
};

function filterItemsByCategory(items: StorageItem[], category: string): StorageItem[] {
  if (category === "all") return items;
  if (category === "products") return items.filter((i) => i.kind === "created_product");
  if (category === "documents") return items.filter((i) => i.section === "library");
  if (category === "photo") return items.filter((i) => i.section === "art");
  if (category === "videos") return items.filter((i) => i.section === "cinema");
  return items.filter((i) => i.section === category);
}

function kindLabel(kind: StorageItem["kind"]): string {
  if (kind === "purchase") return "Purchase";
  if (kind === "created_product") return "Product";
  return "Post";
}

const CARD_WIDTH = 150;
const CARD_IMAGE_HEIGHT = 120;

export default function StorageCategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { category } = useLocalSearchParams<{ category: string }>();
  const { user } = useAuth();
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await fetchStorageItems(user.id, "all");
    setItems(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const key = category ?? "all";
    return filterItemsByCategory(items, key);
  }, [items, category]);

  const title = useMemo(() => {
    const key = category ?? "all";
    return CATEGORY_LABELS[key] ?? key;
  }, [category]);

  if (!user) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center px-8">
        <EmptyState
          icon="folder-open-outline"
          message="Storage"
          detail="Sign in to see your content."
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950" style={{ paddingTop: insets.top }}>
      {/* Header with back button */}
      <View className="flex-row items-center border-b border-zinc-800 px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={24} color="#e4e4e7" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-zinc-100">{title}</Text>
      </View>

      {filteredItems.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <EmptyState
            icon="folder-open-outline"
            message="No items"
            detail={`No content in ${title} yet.`}
          />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Section 1: Horizontal cards (Topchart-style) */}
          <Text className="mt-4 px-4 text-base font-bold text-zinc-100">
            {title} Top
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}
            className="mt-2"
          >
            {filteredItems.map((item) => (
              <Pressable
                key={item.id}
                className="w-[150px] rounded-xl bg-zinc-800/90 overflow-hidden"
              >
                <View style={{ width: CARD_WIDTH, height: CARD_IMAGE_HEIGHT }} className="bg-zinc-700">
                  {item.previewUri ? (
                    <Image
                      source={{ uri: item.previewUri }}
                      style={{ width: CARD_WIDTH, height: CARD_IMAGE_HEIGHT }}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={{ width: CARD_WIDTH, height: CARD_IMAGE_HEIGHT }}
                      className="items-center justify-center"
                    >
                      <Ionicons name="image-outline" size={40} color="#52525b" />
                    </View>
                  )}
                </View>
                <Text className="mt-2 px-2 text-sm font-medium text-zinc-100" numberOfLines={2}>
                  {item.title}
                </Text>
                <Text className="px-2 pb-2 text-xs text-zinc-500">
                  {kindLabel(item.kind)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Section 2: Vertical list (Most Popular-style) */}
          <Text className="mt-6 px-4 text-base font-bold text-zinc-100">
            All in this category
          </Text>
          <Text className="mt-0.5 px-4 text-sm text-zinc-500">
            {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}
          </Text>
          <View className="mt-3 px-4">
            {filteredItems.map((item, index) => (
              <Pressable
                key={item.id}
                className="flex-row items-center rounded-xl bg-zinc-800/80 py-3 pr-3 pl-2 mb-2"
              >
                <Text className="w-8 text-sm text-zinc-500">
                  {String(index + 1).padStart(2, "0")}
                </Text>
                <View className="h-12 w-12 overflow-hidden rounded-lg bg-zinc-700">
                  {item.previewUri ? (
                    <Image
                      source={{ uri: item.previewUri }}
                      style={{ width: 48, height: 48 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View className="h-12 w-12 items-center justify-center">
                      <Ionicons name="image-outline" size={24} color="#52525b" />
                    </View>
                  )}
                </View>
                <View className="ml-3 flex-1 min-w-0">
                  <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text className="text-xs text-zinc-500">{kindLabel(item.kind)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#71717a" />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

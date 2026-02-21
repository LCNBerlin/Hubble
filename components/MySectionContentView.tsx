import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import {
    STORAGE_SECTIONS,
    type StorageItem,
    type StorageSectionKey,
} from "../lib/owned-items";
import { EmptyState } from "./ui";

const CARD_WIDTH = 150;
const CARD_IMAGE_HEIGHT = 120;
const BANNER_HEIGHT = 200;

type TvSectionKey = "broadcast" | "stations" | "cinema";

const TV_TO_STORAGE_SECTION: Record<TvSectionKey, StorageSectionKey> = {
  broadcast: "broadcasts",
  stations: "stations",
  cinema: "cinema",
};

const SECTION_LABELS: Record<StorageSectionKey, string> = Object.fromEntries(
  STORAGE_SECTIONS.map((s) => [s.key, s.label])
) as Record<StorageSectionKey, string>;

type MySectionContentViewProps = {
  sectionKey: TvSectionKey;
  sectionLabel: string;
  items: StorageItem[];
  loading: boolean;
  onRefresh: () => void;
};

export function MySectionContentView({
  sectionKey,
  sectionLabel,
  items,
  loading,
  onRefresh,
}: MySectionContentViewProps) {
  const router = useRouter();
  const { user } = useAuth();

  const storageSection = TV_TO_STORAGE_SECTION[sectionKey];
  const sectionLabelForSection = SECTION_LABELS[storageSection] ?? storageSection;

  // Only purchases, and only from this section (no cross-section or created/post content)
  const sectionFilteredItems = useMemo(
    () => items.filter((i) => i.kind === "purchase" && i.section === storageSection),
    [items, storageSection]
  );
  const recentItem = useMemo(() => sectionFilteredItems[0] ?? null, [sectionFilteredItems]);
  const moreInSection = useMemo(
    () => sectionFilteredItems.filter((i) => i.id !== recentItem?.id),
    [sectionFilteredItems, recentItem]
  );
  const listItems = useMemo(
    () => sectionFilteredItems.filter((i) => i.id !== recentItem?.id),
    [sectionFilteredItems, recentItem]
  );

  const navigateToItem = (item: StorageItem) => {
    if (item.productId) {
      router.push({ pathname: "/product/[id]", params: { id: item.productId } });
    } else if (item.postId && user?.id) {
      router.push({ pathname: "/creator/[id]", params: { id: user.id, postId: item.postId } });
    }
  };

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <EmptyState
          icon="person-outline"
          message="Sign in"
          detail="Sign in to see your content."
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  if (sectionFilteredItems.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <EmptyState
          icon="folder-open-outline"
          message={sectionLabel}
          detail="No purchases in this section yet."
        />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-zinc-950"
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-row flex-1">
        {/* Left column: banner + by genre */}
        <View className="min-w-0 flex-1" style={{ flex: 0.58 }}>
          {/* Recent purchase banner */}
          {recentItem ? (
            <Pressable
              onPress={() => navigateToItem(recentItem)}
              className="mx-3 mt-3 overflow-hidden rounded-xl"
            >
              <View style={{ height: BANNER_HEIGHT }} className="relative">
                {recentItem.previewUri ? (
                  <Image
                    source={{ uri: recentItem.previewUri }}
                    style={{ width: "100%", height: BANNER_HEIGHT }}
                    contentFit="cover"
                  />
                ) : (
                  <View className="h-full w-full bg-zinc-800" />
                )}
                <View
                  className="absolute inset-0 bg-black/50"
                  style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                />
                <View className="absolute bottom-0 left-0 right-0 p-4">
                  <Text className="text-xl font-bold text-white" numberOfLines={2}>
                    {recentItem.title}
                  </Text>
                  <Text className="mt-0.5 text-sm text-zinc-300">Purchase</Text>
                  <View className="mt-3 flex-row gap-2">
                    <Pressable
                      onPress={() => navigateToItem(recentItem)}
                      className="rounded-full bg-violet-600 px-4 py-2"
                    >
                      <Text className="text-sm font-semibold text-white">Play</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => navigateToItem(recentItem)}
                      className="rounded-full border border-zinc-400 bg-transparent px-4 py-2"
                    >
                      <Text className="text-sm font-semibold text-white">View</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Pressable>
          ) : (
            <View className="mx-3 mt-3 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 p-6">
              <Text className="text-center text-sm text-zinc-500">
                No recent purchase in this section
              </Text>
            </View>
          )}

          {/* More purchases in this section (excludes banner item so no duplicate) */}
          {moreInSection.length > 0 && (
            <View className="mt-6">
              <Text className="mb-3 px-3 text-base font-bold text-zinc-100">
                More in {sectionLabelForSection}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
              >
                {moreInSection.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => navigateToItem(item)}
                    className="w-[150px] overflow-hidden rounded-xl bg-zinc-800/90"
                  >
                    <View
                      style={{ width: CARD_WIDTH, height: CARD_IMAGE_HEIGHT }}
                      className="bg-zinc-700"
                    >
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
                    <Text
                      className="mt-2 px-2 text-sm font-medium text-zinc-100"
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    <Text className="px-2 pb-2 text-xs text-zinc-500">Purchase</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Right column: In this section list */}
        <View className="min-w-0 border-l border-zinc-800" style={{ flex: 0.42 }}>
          <Text className="mt-4 px-3 text-base font-bold text-zinc-100">
            In this section
          </Text>
          <Text className="mt-0.5 px-3 text-sm text-zinc-500">
            {listItems.length} item{listItems.length === 1 ? "" : "s"}
          </Text>
          <View className="mt-2 px-2">
            {listItems.slice(0, 12).map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => navigateToItem(item)}
                className="flex-row items-center rounded-lg py-2.5 pr-2"
              >
                <View className="h-10 w-10 overflow-hidden rounded-lg bg-zinc-700">
                  {item.previewUri ? (
                    <Image
                      source={{ uri: item.previewUri }}
                      style={{ width: 40, height: 40 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View className="h-10 w-10 items-center justify-center">
                      <Ionicons name="image-outline" size={20} color="#52525b" />
                    </View>
                  )}
                </View>
                <View className="ml-3 flex-1 min-w-0">
                  <Text className="text-sm font-medium text-zinc-100" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text className="text-xs text-zinc-500">Purchase</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#71717a" />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

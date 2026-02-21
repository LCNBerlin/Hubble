import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { StorageSphereView } from "../../components/StorageSphereView";
import {
  fetchStorageItems,
  STORAGE_SECTIONS,
  type StorageItem,
} from "../../lib/owned-items";
import { EmptyState } from "../../components/ui";

const TOTAL_ITEMS_CAP = 100;
const STORAGE_TOTAL_GB = 50;
/** Placeholder: derive used MB from item count (2 MB per item). */
const MB_PER_ITEM = 2;

function formatStorageUsed(usedMB: number, totalGB: number): string {
  const capMB = totalGB * 1024;
  const used = Math.min(usedMB, capMB);
  return `${Math.round(used)} MB / ${totalGB} GB used`;
}

/** Grid order: 3 rows x 4. Some keys map to section, others to kind or section alias. */
const CATEGORY_GRID: { key: string; label: string }[][] = [
  [
    { key: "cinema", label: "Cinema" },
    { key: "broadcasts", label: "Broadcasts" },
    { key: "stations", label: "Stations" },
    { key: "closet", label: "Closet" },
  ],
  [
    { key: "music", label: "Music" },
    { key: "products", label: "Products" },
    { key: "art", label: "Art" },
    { key: "library", label: "Library" },
  ],
  [
    { key: "documents", label: "Documents" },
    { key: "photo", label: "Photo" },
    { key: "videos", label: "Videos" },
    { key: "all", label: "All" },
  ],
];

export default function StorageScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

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
    let list = items;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((i) => i.title?.toLowerCase().includes(q));
    }
    return list;
  }, [items, searchQuery]);

  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.section] = (counts[item.section] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const usedMB = Math.min(items.length * MB_PER_ITEM, STORAGE_TOTAL_GB * 1024);
  const progressRatio = Math.min(1, usedMB / (STORAGE_TOTAL_GB * 1024));

  if (!user) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center px-8">
        <EmptyState
          icon="folder-open-outline"
          message="Storage"
          detail="Sign in to see your owned items."
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
    <View className="flex-1 bg-zinc-950">
      {/* Search bar: one input box + one small button (wireframe) */}
      <View className="flex-row items-center gap-2 border-b border-zinc-800 bg-zinc-800/80 px-3 py-2">
        <View className="flex-1 flex-row items-center rounded-lg bg-zinc-900 px-3 py-2.5">
          <Ionicons name="search-outline" size={20} color="#71717a" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search"
            placeholderTextColor="#71717a"
            className="ml-2 flex-1 text-base text-zinc-100"
          />
        </View>
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-lg bg-zinc-700"
          accessibilityRole="button"
          accessibilityLabel="Filter"
        >
          <Ionicons name="filter-outline" size={20} color="#e4e4e7" />
        </Pressable>
      </View>

      {/* Two columns: sphere left (~50%), panel right (~50%) */}
      <View className="flex-1 flex-row min-h-[280]">
        {/* Left: sphere */}
        <View className="min-w-0 flex-1" style={{ flex: 1 }}>
          <StorageSphereView
            key={`${filteredItems.length}`}
            items={filteredItems}
          />
        </View>

        {/* Right: storage details panel */}
        <ScrollView
          className="min-w-0 flex-1 border-l border-zinc-800 bg-zinc-900/80"
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Upgrade plan at top (wireframe) */}
          <Pressable
            onPress={() => router.push("/upgrade-storage")}
            className="rounded-lg bg-violet-600 py-2.5"
            accessibilityRole="button"
            accessibilityLabel="Upgrade Plan"
          >
            <Text className="text-center text-sm font-semibold text-white">Upgrade Plan</Text>
          </Pressable>

          {/* Category grid: 3 rows x 4 (wireframe) */}
          <View className="mt-4 gap-2">
            {CATEGORY_GRID.map((row, rowIndex) => (
              <View key={rowIndex} className="flex-row gap-2">
                {row.map(({ key, label }) => (
                  <Pressable
                    key={key}
                    onPress={() => router.push(`/storage/${key}`)}
                    className="min-w-0 flex-1 items-center justify-center rounded-lg bg-zinc-800 py-2.5"
                    accessibilityRole="button"
                    accessibilityLabel={label}
                  >
                    <Text
                      className="text-xs font-medium text-zinc-400"
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          <Text className="mt-4 text-lg font-bold text-zinc-100">Storage</Text>
          <Text className="mt-1 text-sm text-zinc-400">{items.length} items</Text>

          {/* Usage */}
          <View className="mt-4 flex-row items-center gap-2">
            <Ionicons name="folder-open-outline" size={18} color="#71717a" />
            <Text className="text-sm text-zinc-400">
              {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}
            </Text>
          </View>
          <Text className="mt-0.5 text-base font-semibold text-zinc-100">
            Usage {filteredItems.length} items
          </Text>

          {/* Details */}
          <Text className="mt-4 text-sm font-medium text-zinc-400">Details</Text>
          <View className="mt-2 gap-1">
            {STORAGE_SECTIONS.map(({ key, label }) => {
              const count = sectionCounts[key] ?? 0;
              if (count === 0) return null;
              return (
                <View key={key} className="flex-row justify-between">
                  <Text className="text-sm text-zinc-300">{label}</Text>
                  <Text className="text-sm text-zinc-400">{count}</Text>
                </View>
              );
            })}
          </View>

          {/* Total usage bar */}
          <View className="mt-4">
            <Text className="text-base font-semibold text-zinc-100">
              {formatStorageUsed(usedMB, STORAGE_TOTAL_GB)}
            </Text>
            <View className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
              <View
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${progressRatio * 100}%` }}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

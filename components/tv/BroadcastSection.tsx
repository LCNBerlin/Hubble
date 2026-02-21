import { Ionicons } from "@expo/vector-icons";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { CategoryFilterBar } from "./CategoryFilterBar";
import { useTvLayout } from "../../lib/tv-grid";

type BroadcastCategory = "All" | "Finance" | "Music" | "Gaming" | "Education" | "News" | "Lifestyle";

type BroadcastFilterShow = "all" | "live_only" | "upcoming_only";
type BroadcastFilterSort = "default" | "viewers_high" | "viewers_low";

const MOCK_LIVE = [
  { id: "1", title: "Market Open Analysis", creator: "Finance Daily", category: "Finance", viewers: 1200, thumb: null, avatar: null },
  { id: "2", title: "Late Night Beats", creator: "DJ Nova", category: "Music", viewers: 890, thumb: null, avatar: null },
  { id: "3", title: "News Hour", creator: "Global News", category: "News", viewers: 3400, thumb: null, avatar: null },
  { id: "4", title: "Learn React Native", creator: "DevEd", category: "Education", viewers: 456, thumb: null, avatar: null },
];

const MOCK_UPCOMING = [
  { id: "u1", title: "Earnings Call", at: Date.now() + 3600000 * 2 },
  { id: "u2", title: "Concert Live", at: Date.now() + 3600000 * 24 },
  { id: "u3", title: "Product Launch", at: Date.now() + 3600000 * 5 },
];

function formatCountdown(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function BroadcastCard({
  title,
  creator,
  category,
  viewers,
  trending,
  cardWidth,
  cardHeight,
  onPress,
}: {
  title: string;
  creator: string;
  category: string;
  viewers: number;
  trending?: boolean;
  cardWidth: number;
  cardHeight: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl overflow-hidden bg-zinc-800"
      style={{
        width: cardWidth,
        height: cardHeight,
        marginRight: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        shadowOpacity: 0.3,
        elevation: 4,
      }}
    >
      <View className="absolute inset-0 bg-zinc-700" />
      <View className="absolute inset-0 flex-1 justify-between p-3">
        <View className="flex-row justify-between items-start">
          <View className="rounded-full bg-red-500 px-2.5 py-1 flex-row items-center" style={{ shadowColor: "#ef4444", shadowRadius: 6, shadowOpacity: 0.8 }}>
            <View className="w-2 h-2 rounded-full bg-white mr-1.5" />
            <Text className="text-xs font-bold text-white">LIVE</Text>
          </View>
          <View className="rounded-lg bg-black/50 px-2 py-1 flex-row items-center">
            <Ionicons name="eye-outline" size={12} color="#e4e4e7" />
            <Text className="text-xs text-zinc-200 ml-1">{viewers >= 1000 ? `${(viewers / 1000).toFixed(1)}k` : viewers}</Text>
          </View>
        </View>
        <View className="rounded-xl bg-black/40 backdrop-blur p-2.5 flex-row items-center">
          <View className="w-8 h-8 rounded-full bg-zinc-500" />
          <View className="flex-1 ml-2 min-w-0">
            <View className="flex-row items-center gap-1">
              <Text className="text-sm font-bold text-white" numberOfLines={1}>{title}</Text>
              {trending && <Ionicons name="flame" size={14} color="#f59e0b" />}
            </View>
            <Text className="text-xs text-zinc-400">{category}</Text>
          </View>
          <Ionicons name="checkmark-circle" size={14} color="#a78bfa" />
        </View>
      </View>
    </Pressable>
  );
}

function UpcomingCard({
  title,
  at,
  onRemind,
  onPress,
}: {
  title: string;
  at: number;
  onRemind: () => void;
  onPress: () => void;
}) {
  const remaining = Math.max(0, at - Date.now());
  const timeStr = new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <Pressable onPress={onPress} className="rounded-xl overflow-hidden bg-zinc-800/80 border border-zinc-700">
      <View className="aspect-[4/3] bg-zinc-700" />
      <View className="absolute top-2 left-2 rounded-lg bg-black/60 px-2 py-1">
        <Text className="text-xs font-semibold text-white">{formatCountdown(remaining)}</Text>
      </View>
      <View className="p-3">
        <Pressable onPress={onRemind} className="rounded-full border border-zinc-500 py-2 items-center mb-2">
          <Text className="text-sm font-medium text-zinc-300">Remind Me</Text>
        </Pressable>
        <Text className="text-sm font-semibold text-zinc-100" numberOfLines={1}>{title}</Text>
        <Text className="text-xs text-zinc-500 mt-0.5">{timeStr}</Text>
      </View>
    </Pressable>
  );
}

export function BroadcastSection({
  isActive = false,
  filterTriggerRef,
}: {
  isActive?: boolean;
  filterTriggerRef?: MutableRefObject<(() => void) | null>;
}) {
  const { width } = useWindowDimensions();
  const layout = useTvLayout(width);
  const [category, setCategory] = useState<BroadcastCategory>("All");
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterShow, setFilterShow] = useState<BroadcastFilterShow>("all");
  const [filterSort, setFilterSort] = useState<BroadcastFilterSort>("default");

  useEffect(() => {
    if (!filterTriggerRef) return;
    if (isActive) filterTriggerRef.current = () => setFilterVisible(true);
    return () => {
      filterTriggerRef.current = null;
    };
  }, [isActive, filterTriggerRef]);

  const filteredLive = useMemo(() => {
    let list = [...MOCK_LIVE];
    if (filterSort === "viewers_high") list.sort((a, b) => b.viewers - a.viewers);
    if (filterSort === "viewers_low") list.sort((a, b) => a.viewers - b.viewers);
    if (filterShow === "upcoming_only") return [];
    return list;
  }, [filterShow, filterSort]);

  const filteredUpcoming = useMemo(() => {
    if (filterShow === "live_only") return [];
    return [...MOCK_UPCOMING].sort((a, b) => a.at - b.at);
  }, [filterShow]);

  const renderLiveRow = useCallback(
    (title: string, trending = false) => (
      <View style={{ marginBottom: layout.cardRhythm }}>
        <Text className="text-base font-semibold text-zinc-100 mb-2 px-4">{title}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: layout.paddingHorizontal, paddingRight: layout.paddingHorizontal + 16 }}
        >
          {filteredLive.map((item) => (
            <BroadcastCard
              key={item.id}
              title={item.title}
              creator={item.creator}
              category={item.category}
              viewers={item.viewers}
              trending={trending}
              cardWidth={layout.broadcastCardWidth}
              cardHeight={layout.broadcastCardHeight}
              onPress={() => {}}
            />
          ))}
        </ScrollView>
      </View>
    ),
    [layout, filteredLive]
  );

  return (
    <View className="flex-1 bg-zinc-950">
      <View className="border-b border-zinc-800 bg-zinc-900/50 px-3 py-2">
        <CategoryFilterBar selected={category} onSelect={(cat) => setCategory(cat)} />
      </View>
      <Modal visible={filterVisible} transparent animationType="fade">
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setFilterVisible(false)}>
          <Pressable
            className="bg-zinc-900 rounded-t-2xl border-t border-zinc-700 p-4"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-zinc-100">Broadcast filters</Text>
              <Pressable onPress={() => setFilterVisible(false)} className="p-2">
                <Ionicons name="close" size={24} color="#71717a" />
              </Pressable>
            </View>
            <Text className="text-sm font-medium text-zinc-400 mb-2">Show</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {(["all", "live_only", "upcoming_only"] as const).map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setFilterShow(opt)}
                  className={`rounded-lg px-3 py-2 ${filterShow === opt ? "bg-violet-600" : "bg-zinc-800"}`}
                >
                  <Text className={`text-sm ${filterShow === opt ? "text-white font-medium" : "text-zinc-400"}`}>
                    {opt === "all" ? "All" : opt === "live_only" ? "Live only" : "Upcoming only"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-sm font-medium text-zinc-400 mb-2">Sort live by viewers</Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {(["default", "viewers_high", "viewers_low"] as const).map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setFilterSort(opt)}
                  className={`rounded-lg px-3 py-2 ${filterSort === opt ? "bg-violet-600" : "bg-zinc-800"}`}
                >
                  <Text className={`text-sm ${filterSort === opt ? "text-white font-medium" : "text-zinc-400"}`}>
                    {opt === "default" ? "Default" : opt === "viewers_high" ? "High to low" : "Low to high"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => setFilterVisible(false)}
              className="mt-4 rounded-xl bg-violet-600 py-3 items-center"
            >
              <Text className="text-base font-semibold text-white">Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {renderLiveRow("Live Now")}
        {renderLiveRow("Trending Broadcasts", true)}
        <View style={{ marginBottom: layout.cardRhythm, paddingHorizontal: layout.paddingHorizontal }}>
          <Text className="text-base font-semibold text-zinc-100 mb-2">Upcoming</Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              marginHorizontal: -layout.gutter / 2,
            }}
          >
            {filteredUpcoming.map((item) => (
            <View
              key={item.id}
              style={{
                width: layout.upcomingColumns === 1 ? "100%" : `${100 / layout.upcomingColumns}%`,
                paddingHorizontal: layout.gutter / 2,
                marginBottom: layout.cardRhythm,
              }}
            >
                <UpcomingCard
                  title={item.title}
                  at={item.at}
                  onRemind={() => {}}
                  onPress={() => {}}
                />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

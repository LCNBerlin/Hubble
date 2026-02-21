import { Ionicons } from "@expo/vector-icons";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useTvLayout } from "../../lib/tv-grid";

const MOCK_CONTINUE = [
  { id: "c1", title: "The Daily Brief", episode: "Ep 142", progress: 0.4 },
  { id: "c2", title: "Tech Talk", episode: "Ep 89", progress: 0.7 },
];

const MOCK_FEATURED = [
  { id: "f1", name: "Business Insider", host: "Jane Doe", followers: 12000 },
  { id: "f2", name: "Culture Cast", host: "Alex Rivera", followers: 8400 },
  { id: "f3", name: "True Crime Weekly", host: "Sam Lee", followers: 25000 },
  { id: "f4", name: "Philosophy Hour", host: "Dr. Kim", followers: 5600 },
];

const MOCK_LIVE_RADIO = [
  { id: "r1", name: "Jazz 24/7", listeners: 320 },
  { id: "r2", name: "News Radio", listeners: 1200 },
];

const STATION_CATEGORIES = [
  "Business",
  "Culture",
  "Tech",
  "Philosophy",
  "True Crime",
  "Music",
  "Global",
  "Local",
];

function ContinueCard({
  title,
  episode,
  progress,
  size,
  onPress,
}: {
  title: string;
  episode: string;
  progress: number;
  size: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl overflow-hidden bg-zinc-800/80"
      style={{ width: size, height: size, marginRight: 16 }}
    >
      <View className="flex-1 bg-zinc-700" />
      <View className="absolute inset-0 items-center justify-center">
        <View className="w-14 h-14 rounded-full bg-black/50 items-center justify-center border-2 border-white/80">
          <Ionicons name="play" size={28} color="#fff" />
        </View>
      </View>
      <View className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
        <View className="h-full bg-violet-500 rounded-r-full" style={{ width: `${progress * 100}%` }} />
      </View>
      <View className="p-2.5 bg-zinc-900/90">
        <Text className="text-sm font-semibold text-zinc-100" numberOfLines={1}>{title}</Text>
        <Text className="text-xs text-zinc-500">{episode}</Text>
      </View>
    </Pressable>
  );
}

function FeaturedStationCard({
  name,
  host,
  followers,
  onFollow,
  onPress,
}: {
  name: string;
  host: string;
  followers: number;
  onFollow: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="rounded-xl overflow-hidden bg-zinc-800/80 flex-1 min-w-0">
      <View className="aspect-square bg-zinc-700" />
      <View className="p-3">
        <Text className="text-sm font-semibold text-zinc-100" numberOfLines={1}>{name}</Text>
        <Text className="text-xs text-zinc-500" numberOfLines={1}>{host}</Text>
        <Text className="text-xs text-zinc-400 mt-1">{followers >= 1000 ? `${(followers / 1000).toFixed(1)}k` : followers} followers</Text>
        <Pressable onPress={onFollow} className="mt-2 rounded-full border border-zinc-500 py-1.5 items-center">
          <Text className="text-xs font-medium text-zinc-300">Follow</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function LiveRadioCard({
  name,
  listeners,
  onPress,
}: {
  name: string;
  listeners: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl overflow-hidden bg-zinc-800/80 flex-row items-center px-4 py-3"
      style={{ width: 200, marginRight: 16 }}
    >
      <View className="w-12 h-8 flex-row items-end justify-around">
        {[0.4, 0.7, 0.5, 0.9, 0.6].map((h, i) => (
          <View key={i} className="w-1 rounded-full bg-violet-500" style={{ height: `${h * 100}%` }} />
        ))}
      </View>
      <View className="flex-1 ml-3 min-w-0">
        <Text className="text-sm font-semibold text-zinc-100" numberOfLines={1}>{name}</Text>
        <View className="flex-row items-center gap-1 mt-0.5">
          <Text className="text-[10px] font-medium text-red-400 uppercase">LIVE RADIO</Text>
          <Text className="text-xs text-zinc-500">· {listeners} listening</Text>
        </View>
      </View>
    </Pressable>
  );
}

type StationsFilterShow = "all" | "live_only" | "featured_only";
type StationsFilterSort = "default" | "followers_high" | "followers_low";

export function StationsSection({
  isActive = false,
  filterTriggerRef,
}: {
  isActive?: boolean;
  filterTriggerRef?: MutableRefObject<(() => void) | null>;
}) {
  const { width } = useWindowDimensions();
  const layout = useTvLayout(width);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterShow, setFilterShow] = useState<StationsFilterShow>("all");
  const [filterSort, setFilterSort] = useState<StationsFilterSort>("default");

  useEffect(() => {
    if (!filterTriggerRef) return;
    if (isActive) filterTriggerRef.current = () => setFilterVisible(true);
    return () => {
      filterTriggerRef.current = null;
    };
  }, [isActive, filterTriggerRef]);

  const filteredContinue = useMemo(() => {
    if (filterShow === "live_only" || filterShow === "featured_only") return [];
    return MOCK_CONTINUE;
  }, [filterShow]);

  const filteredFeatured = useMemo(() => {
    if (filterShow === "live_only") return [];
    let list = [...MOCK_FEATURED];
    if (filterSort === "followers_high") list.sort((a, b) => b.followers - a.followers);
    if (filterSort === "followers_low") list.sort((a, b) => a.followers - b.followers);
    return list;
  }, [filterShow, filterSort]);

  const filteredLiveRadio = useMemo(() => {
    if (filterShow === "featured_only") return [];
    return [...MOCK_LIVE_RADIO].sort((a, b) => b.listeners - a.listeners);
  }, [filterShow]);

  const renderContinue = useCallback(
    () => (
      <View style={{ marginBottom: layout.cardRhythm }}>
        <Text className="text-base font-semibold text-zinc-100 mb-2 px-4">Continue Listening</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: layout.paddingHorizontal, paddingRight: layout.paddingHorizontal + 16 }}
        >
          {filteredContinue.map((item) => (
            <ContinueCard
              key={item.id}
              title={item.title}
              episode={item.episode}
              progress={item.progress}
              size={layout.stationCardSize}
              onPress={() => {}}
            />
          ))}
        </ScrollView>
      </View>
    ),
    [layout, filteredContinue]
  );

  const cellSize = (width - layout.paddingHorizontal * 2 - layout.gutter * (layout.featuredStationsColumns - 1)) / layout.featuredStationsColumns;

  return (
    <View className="flex-1 bg-zinc-950">
      <Modal visible={filterVisible} transparent animationType="fade">
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setFilterVisible(false)}>
          <Pressable
            className="bg-zinc-900 rounded-t-2xl border-t border-zinc-700 p-4"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-zinc-100">Station filters</Text>
              <Pressable onPress={() => setFilterVisible(false)} className="p-2">
                <Ionicons name="close" size={24} color="#71717a" />
              </Pressable>
            </View>
            <Text className="text-sm font-medium text-zinc-400 mb-2">Show</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {(["all", "live_only", "featured_only"] as const).map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setFilterShow(opt)}
                  className={`rounded-lg px-3 py-2 ${filterShow === opt ? "bg-violet-600" : "bg-zinc-800"}`}
                >
                  <Text className={`text-sm ${filterShow === opt ? "text-white font-medium" : "text-zinc-400"}`}>
                    {opt === "all" ? "All" : opt === "live_only" ? "Live radio only" : "Featured only"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-sm font-medium text-zinc-400 mb-2">Sort featured by followers</Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {(["default", "followers_high", "followers_low"] as const).map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setFilterSort(opt)}
                  className={`rounded-lg px-3 py-2 ${filterSort === opt ? "bg-violet-600" : "bg-zinc-800"}`}
                >
                  <Text className={`text-sm ${filterSort === opt ? "text-white font-medium" : "text-zinc-400"}`}>
                    {opt === "default" ? "Default" : opt === "followers_high" ? "High to low" : "Low to high"}
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
        {renderContinue()}
        <View style={{ marginBottom: layout.cardRhythm, paddingHorizontal: layout.paddingHorizontal }}>
          <Text className="text-base font-semibold text-zinc-100 mb-2">Featured Stations</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -layout.gutter / 2 }}>
            {filteredFeatured.map((item) => (
            <View
              key={item.id}
              style={{
                width: cellSize,
                marginRight: layout.gutter,
                marginBottom: layout.gutter,
              }}
            >
              <FeaturedStationCard
                name={item.name}
                host={item.host}
                followers={item.followers}
                onFollow={() => {}}
                onPress={() => {}}
              />
            </View>
          ))}
        </View>
      </View>
      <View style={{ marginBottom: layout.cardRhythm }}>
        <Text className="text-base font-semibold text-zinc-100 mb-2 px-4">Live Radio</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: layout.paddingHorizontal, paddingRight: layout.paddingHorizontal + 16 }}
        >
          {filteredLiveRadio.map((item) => (
            <LiveRadioCard key={item.id} name={item.name} listeners={item.listeners} onPress={() => {}} />
          ))}
        </ScrollView>
      </View>
      <View style={{ paddingHorizontal: layout.paddingHorizontal }}>
        <Text className="text-base font-semibold text-zinc-100 mb-2">Station Categories</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -layout.gutter / 2 }}>
          {STATION_CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              className="rounded-xl bg-zinc-800/80 items-center justify-center border border-zinc-700/80"
              style={{
                width: (width - layout.paddingHorizontal * 2 - layout.gutter * 3) / 4,
                marginRight: layout.gutter,
                marginBottom: layout.gutter,
                height: 80,
              }}
            >
              <Ionicons name="musical-notes-outline" size={22} color="#a78bfa" />
              <Text className="text-sm font-medium text-zinc-300 mt-1" numberOfLines={1}>{cat}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      </ScrollView>
    </View>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import { BroadcastSection } from "../../components/tv/BroadcastSection";
import { CinemaSection } from "../../components/tv/CinemaSection";
import { StationsSection } from "../../components/tv/StationsSection";
import { MySectionContentView } from "../../components/MySectionContentView";
import { EmptyState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useCommunity } from "../../context/CommunityContext";
import { fetchStorageItems, type StorageItem } from "../../lib/owned-items";

type SubView = "browse" | "my";

const SECTIONS = [
  { key: "broadcast" as const, label: "Broadcast", icon: "radio-outline" as const },
  { key: "stations" as const, label: "Stations", icon: "apps-outline" as const },
  { key: "cinema" as const, label: "Cinema", icon: "film-outline" as const },
] as const;

function SectionPlaceholder({
  icon,
  message,
  detail,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
  detail: string;
}) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <EmptyState icon={icon} message={message} detail={detail} />
    </View>
  );
}

type SectionKey = (typeof SECTIONS)[number]["key"];

const SECTION_KEYS: SectionKey[] = ["broadcast", "stations", "cinema"];

const INITIAL_SUB_VIEW: Record<SectionKey, SubView> = {
  broadcast: "browse",
  stations: "browse",
  cinema: "browse",
};

export default function TvScreen() {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const filterTriggerRef = useRef<(() => void) | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [subView, setSubView] = useState<Record<SectionKey, SubView>>(INITIAL_SUB_VIEW);
  const [searchBySection, setSearchBySection] = useState<Record<SectionKey, string>>({
    broadcast: "",
    stations: "",
    cinema: "",
  });
  const { user } = useAuth();
  const { selectedCommunity, setSelectedCommunityId } = useCommunity();

  const activeSearchQuery = searchBySection[SECTION_KEYS[activeIndex]];
  const setActiveSearchQuery = useCallback(
    (value: string) => {
      setSearchBySection((prev) => ({
        ...prev,
        [SECTION_KEYS[activeIndex]]: value,
      }));
    },
    [activeIndex]
  );
  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [storageLoading, setStorageLoading] = useState(false);

  const loadStorageItems = useCallback(async () => {
    if (!user?.id) {
      setStorageItems([]);
      return;
    }
    setStorageLoading(true);
    const data = await fetchStorageItems(user.id, "all");
    setStorageItems(data);
    setStorageLoading(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      const hasMyView = subView.broadcast === "my" || subView.stations === "my" || subView.cinema === "my";
      if (hasMyView && user?.id) {
        loadStorageItems();
      }
      return () => {};
    }, [subView.broadcast, subView.stations, subView.cinema, user?.id, loadStorageItems])
  );

  // Revert all sections to browse when leaving the TV tab
  useFocusEffect(
    useCallback(() => {
      return () => setSubView(INITIAL_SUB_VIEW);
    }, [])
  );

  const toggleOrGoToSection = useCallback(
    (index: number) => {
      if (activeIndex === index) {
        const key = SECTION_KEYS[index];
        setSubView((prev) => ({
          ...prev,
          [key]: prev[key] === "browse" ? "my" : "browse",
        }));
      } else {
        setSubView((prev) => ({ ...prev, [SECTION_KEYS[activeIndex]]: "browse" }));
        scrollRef.current?.scrollTo({ x: index * width, animated: true });
        setActiveIndex(index);
      }
    },
    [activeIndex, width]
  );

  const updateActiveIndex = useCallback(
    (offsetX: number) => {
      const index = Math.round(offsetX / width);
      const clamped = Math.max(0, Math.min(2, index));
      setActiveIndex((prev) => {
        if (clamped !== prev) {
          setSubView((s) => ({ ...s, [SECTION_KEYS[prev]]: "browse" }));
        }
        return clamped;
      });
    },
    [width]
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateActiveIndex(e.nativeEvent.contentOffset.x);
    },
    [updateActiveIndex]
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateActiveIndex(e.nativeEvent.contentOffset.x);
    },
    [updateActiveIndex]
  );

  const tabLabel = useCallback(
    (index: number) => {
      const key = SECTION_KEYS[index];
      if (subView[key] === "my") {
        if (key === "broadcast") return "My Broadcast";
        if (key === "stations") return "My Stations";
        return "My Cinema";
      }
      return SECTIONS[index].label;
    },
    [subView]
  );

  return (
    <View className="flex-1 bg-zinc-950">
      {selectedCommunity ? (
        <View className="flex-row items-center justify-between border-b border-zinc-800 bg-zinc-800/60 px-3 py-2">
          <Text className="text-sm text-zinc-300" numberOfLines={1}>
            Viewing {selectedCommunity.displayName}&apos;s community
          </Text>
          <Pressable onPress={() => setSelectedCommunityId(null)} className="rounded-full p-2">
            <Ionicons name="close" size={20} color="#71717a" />
          </Pressable>
        </View>
      ) : null}
      {/* Main segment bar */}
      <View className="flex-row border-b border-zinc-800 bg-zinc-900/80">
        {SECTIONS.map((section, index) => (
          <Pressable
            key={section.key}
            onPress={() => toggleOrGoToSection(index)}
            className="flex-1 items-center justify-center py-3"
            accessibilityRole="button"
            accessibilityLabel={tabLabel(index)}
          >
            <Text
              className={
                activeIndex === index
                  ? "text-base font-semibold text-violet-400"
                  : "text-base font-medium text-zinc-500"
              }
            >
              {tabLabel(index)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search bar + filter (filter opens current section's modal) */}
      <View className="flex-row items-center gap-2 border-b border-zinc-800 bg-zinc-800/80 px-3 py-2">
        <View className="flex-1 flex-row items-center rounded-lg bg-zinc-900 px-3 py-2.5">
          <Ionicons name="search-outline" size={20} color="#71717a" />
          <TextInput
            value={activeSearchQuery}
            onChangeText={setActiveSearchQuery}
            placeholder="Search"
            placeholderTextColor="#71717a"
            className="ml-2 flex-1 text-base text-zinc-100"
          />
        </View>
        <Pressable
          onPress={() => filterTriggerRef.current?.()}
          className="h-10 w-10 items-center justify-center rounded-lg bg-zinc-700"
          accessibilityRole="button"
          accessibilityLabel="Filter"
        >
          <Ionicons name="filter-outline" size={20} color="#e4e4e7" />
        </Pressable>
      </View>

      {/* Horizontal pager */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={width}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={{ width: width * 3 }}
        style={{ flex: 1 }}
      >
        <View style={{ width }} className="flex-1">
          {subView.broadcast === "browse" ? (
            <BroadcastSection
              isActive={activeIndex === 0}
              filterTriggerRef={filterTriggerRef}
            />
          ) : (
            <MySectionContentView
              sectionKey="broadcast"
              sectionLabel="My Broadcast"
              items={storageItems}
              loading={storageLoading}
              onRefresh={loadStorageItems}
            />
          )}
        </View>
        <View style={{ width }} className="flex-1">
          {subView.stations === "browse" ? (
            <StationsSection
              isActive={activeIndex === 1}
              filterTriggerRef={filterTriggerRef}
            />
          ) : (
            <MySectionContentView
              sectionKey="stations"
              sectionLabel="My Stations"
              items={storageItems}
              loading={storageLoading}
              onRefresh={loadStorageItems}
            />
          )}
        </View>
        <View style={{ width }} className="flex-1">
          {subView.cinema === "browse" ? (
            <CinemaSection
              isActive={activeIndex === 2}
              filterTriggerRef={filterTriggerRef}
            />
          ) : (
            <MySectionContentView
              sectionKey="cinema"
              sectionLabel="My Cinema"
              items={storageItems}
              loading={storageLoading}
              onRefresh={loadStorageItems}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

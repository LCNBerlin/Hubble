import { Ionicons } from "@expo/vector-icons";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useTvLayout } from "../../lib/tv-grid";

const MOCK_HERO = {
  title: "The Last Frontier",
  synopsis: "A journey through uncharted territory. One crew. One mission.",
};

const MOCK_ORIGINALS = [
  { id: "o1", title: "Original One" },
  { id: "o2", title: "Original Two" },
  { id: "o3", title: "Original Three" },
  { id: "o4", title: "Original Four" },
  { id: "o5", title: "Original Five" },
];

const MOCK_SERIES = [
  { id: "s1", title: "Season 2", tag: "NEW EPISODE" },
  { id: "s2", title: "Season 1", tag: "NEW EPISODE" },
];

const MOCK_SHORT_FILMS = [
  { id: "sh1", title: "Short A", runtime: "12 min" },
  { id: "sh2", title: "Short B", runtime: "8 min" },
  { id: "sh3", title: "Short C", runtime: "15 min" },
];

const GENRES = [
  "Drama",
  "Documentary",
  "Thriller",
  "Comedy",
  "Sci-Fi",
  "Experimental",
  "International",
  "Indie",
];

function CinemaHero({
  title,
  synopsis,
  contentWidth,
  onWatch,
  onAdd,
}: {
  title: string;
  synopsis: string;
  contentWidth: number;
  onWatch: () => void;
  onAdd: () => void;
}) {
  const height = Math.round((contentWidth * 9) / 16);
  return (
    <View className="rounded-xl overflow-hidden bg-zinc-800" style={{ height }}>
      <View className="absolute inset-0 bg-zinc-700" />
      <View className="absolute left-0 right-0 bottom-0 p-4" style={{ paddingTop: 48, backgroundColor: "rgba(0,0,0,0.75)" }}>
        <Text className="text-xl font-bold text-white" numberOfLines={1}>{title}</Text>
        <Text className="text-sm text-zinc-300 mt-1" numberOfLines={2}>{synopsis}</Text>
        <View className="flex-row gap-3 mt-3">
          <Pressable onPress={onWatch} className="rounded-lg bg-violet-600 px-4 py-2.5 flex-row items-center">
            <Ionicons name="play" size={18} color="#fff" />
            <Text className="text-sm font-semibold text-white ml-2">Watch</Text>
          </Pressable>
          <Pressable onPress={onAdd} className="rounded-lg border border-zinc-500 px-4 py-2.5 flex-row items-center">
            <Ionicons name="add" size={18} color="#e4e4e7" />
            <Text className="text-sm font-medium text-zinc-300 ml-2">Add to List</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function PosterCard({
  title,
  tag,
  width,
  height,
  onPress,
}: {
  title: string;
  tag?: string;
  width: number;
  height: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl overflow-hidden bg-zinc-800"
      style={{ width, height, marginRight: 16 }}
    >
      <View className="flex-1 bg-zinc-700" />
      <View className="absolute inset-0 justify-end p-2 bg-black/50">
        {tag && (
          <View className="self-start mb-1">
            <Text className="text-[10px] font-bold text-amber-400 uppercase">{tag}</Text>
          </View>
        )}
        <Text className="text-sm font-semibold text-white" numberOfLines={2}>{title}</Text>
      </View>
    </Pressable>
  );
}

function ShortFilmCard({
  title,
  runtime,
  onPress,
}: {
  title: string;
  runtime: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="rounded-xl overflow-hidden bg-zinc-800/80 flex-1 min-w-0">
      <View className="aspect-video bg-zinc-700" />
      <View className="p-2.5">
        <Text className="text-sm font-semibold text-zinc-100" numberOfLines={1}>{title}</Text>
        <Text className="text-xs text-zinc-500">{runtime}</Text>
      </View>
    </Pressable>
  );
}

function GenreTile({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700/80 items-center justify-center"
      style={{ minHeight: 72 }}
    >
      <Text className="text-sm font-medium text-zinc-200">{label}</Text>
    </Pressable>
  );
}

type CinemaFilterShow = "all" | "originals_only" | "series_only" | "short_films_only";

export function CinemaSection({
  isActive = false,
  filterTriggerRef,
}: {
  isActive?: boolean;
  filterTriggerRef?: MutableRefObject<(() => void) | null>;
}) {
  const { width } = useWindowDimensions();
  const layout = useTvLayout(width);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterShow, setFilterShow] = useState<CinemaFilterShow>("all");

  useEffect(() => {
    if (!filterTriggerRef) return;
    if (isActive) filterTriggerRef.current = () => setFilterVisible(true);
    return () => {
      filterTriggerRef.current = null;
    };
  }, [isActive, filterTriggerRef]);

  const showOriginals = filterShow === "all" || filterShow === "originals_only";
  const showSeries = filterShow === "all" || filterShow === "series_only";
  const showShortFilms = filterShow === "all" || filterShow === "short_films_only";

  const filteredOriginals = useMemo(() => [...MOCK_ORIGINALS], []);
  const filteredSeries = useMemo(() => [...MOCK_SERIES], []);
  const filteredShortFilms = useMemo(() => [...MOCK_SHORT_FILMS], []);

  const renderOriginals = useCallback(
    () => (
      <View style={{ marginBottom: layout.cardRhythm }}>
        <Text className="text-base font-semibold text-zinc-100 mb-2 px-4">Originals</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: layout.paddingHorizontal, paddingRight: layout.paddingHorizontal + 16 }}
        >
          {filteredOriginals.map((item) => (
            <PosterCard
              key={item.id}
              title={item.title}
              width={layout.posterWidth}
              height={layout.posterHeight}
              onPress={() => {}}
            />
          ))}
        </ScrollView>
      </View>
    ),
    [layout, filteredOriginals]
  );

  const renderSeries = useCallback(
    () => (
      <View style={{ marginBottom: layout.cardRhythm }}>
        <Text className="text-base font-semibold text-zinc-100 mb-2 px-4">Series</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: layout.paddingHorizontal, paddingRight: layout.paddingHorizontal + 16 }}
        >
          {filteredSeries.map((item) => (
            <PosterCard
              key={item.id}
              title={item.title}
              tag={item.tag}
              width={layout.posterWidth}
              height={layout.posterHeight}
              onPress={() => {}}
            />
          ))}
        </ScrollView>
      </View>
    ),
    [layout, filteredSeries]
  );

  const shortFilmCellWidth = (width - layout.paddingHorizontal * 2 - layout.gutter * (layout.shortFilmsColumns - 1)) / layout.shortFilmsColumns;

  return (
    <View className="flex-1 bg-zinc-950">
      <Modal visible={filterVisible} transparent animationType="fade">
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setFilterVisible(false)}>
          <Pressable
            className="bg-zinc-900 rounded-t-2xl border-t border-zinc-700 p-4"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-zinc-100">Cinema filters</Text>
              <Pressable onPress={() => setFilterVisible(false)} className="p-2">
                <Ionicons name="close" size={24} color="#71717a" />
              </Pressable>
            </View>
            <Text className="text-sm font-medium text-zinc-400 mb-2">Show</Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {(["all", "originals_only", "series_only", "short_films_only"] as const).map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setFilterShow(opt)}
                  className={`rounded-lg px-3 py-2 ${filterShow === opt ? "bg-violet-600" : "bg-zinc-800"}`}
                >
                  <Text className={`text-sm ${filterShow === opt ? "text-white font-medium" : "text-zinc-400"}`}>
                    {opt === "all" ? "All" : opt === "originals_only" ? "Originals only" : opt === "series_only" ? "Series only" : "Short films only"}
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
        <View style={{ paddingHorizontal: layout.paddingHorizontal, marginBottom: layout.cardRhythm }}>
          <CinemaHero
            title={MOCK_HERO.title}
            synopsis={MOCK_HERO.synopsis}
            contentWidth={layout.contentWidth}
            onWatch={() => {}}
            onAdd={() => {}}
          />
        </View>
        {showOriginals && renderOriginals()}
        {showSeries && renderSeries()}
        {showShortFilms && (
          <View style={{ marginBottom: layout.cardRhythm, paddingHorizontal: layout.paddingHorizontal }}>
            <Text className="text-base font-semibold text-zinc-100 mb-2">Short Films</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -layout.gutter / 2 }}>
              {filteredShortFilms.map((item) => (
                <View
                  key={item.id}
                  style={{
                    width: shortFilmCellWidth,
                    marginRight: layout.gutter,
                    marginBottom: layout.gutter,
                  }}
                >
                  <ShortFilmCard title={item.title} runtime={item.runtime} onPress={() => {}} />
                </View>
              ))}
            </View>
          </View>
        )}
        <View style={{ paddingHorizontal: layout.paddingHorizontal }}>
          <Text className="text-base font-semibold text-zinc-100 mb-2">Genre Explorer</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -layout.gutter / 2 }}>
            {GENRES.map((g) => (
              <View
                key={g}
                style={{
                  width: layout.genreColumns === 1 ? "100%" : `${100 / layout.genreColumns}%`,
                  paddingHorizontal: layout.gutter / 2,
                  marginBottom: layout.gutter,
                }}
              >
                <GenreTile label={g} onPress={() => {}} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

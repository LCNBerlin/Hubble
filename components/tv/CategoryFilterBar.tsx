import { Pressable, ScrollView, Text, View } from "react-native";

const BROADCAST_CATEGORIES = [
  "All",
  "Finance",
  "Music",
  "Gaming",
  "Education",
  "News",
  "Lifestyle",
] as const;

type BroadcastCategory = (typeof BROADCAST_CATEGORIES)[number];

export function CategoryFilterBar({
  selected,
  onSelect,
}: {
  selected: BroadcastCategory;
  onSelect: (cat: BroadcastCategory) => void;
}) {
  return (
    <View className="bg-zinc-950 border-b border-zinc-800 py-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {BROADCAST_CATEGORIES.map((cat) => {
          const isSelected = selected === cat;
          return (
            <Pressable
              key={cat}
              onPress={() => onSelect(cat)}
              className={`rounded-full px-4 py-2.5 ${isSelected ? "bg-violet-600" : "bg-zinc-800"}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
            >
              <Text
                className={`text-sm font-medium ${isSelected ? "text-white" : "text-zinc-400"}`}
              >
                {cat}
              </Text>
              {isSelected && (
                <View
                  className="absolute bottom-0 left-4 right-4 h-0.5 bg-violet-400 rounded-full"
                  style={{ shadowColor: "#a78bfa", shadowRadius: 4, shadowOpacity: 0.6 }}
                />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

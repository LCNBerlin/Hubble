import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

type InsightsSectionProps = {
  onPress: () => void;
};

export function InsightsSection({ onPress }: InsightsSectionProps) {
  return (
    <Pressable
      onPress={onPress}
      className="h-full min-h-0 flex-row items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 active:opacity-90"
    >
      <View className="h-14 w-14 items-center justify-center rounded-xl bg-emerald-600">
        <Ionicons name="stats-chart-outline" size={28} color="#fff" />
      </View>
      <Text className="flex-1 text-lg font-semibold text-zinc-100" numberOfLines={1}>
        Insights
      </Text>
      <Ionicons name="chevron-forward" size={24} color="#71717a" />
    </Pressable>
  );
}

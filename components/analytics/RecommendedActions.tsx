import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type RecommendedActionsProps = {
  tips: string[];
};

export function RecommendedActions({ tips }: RecommendedActionsProps) {
  if (!tips.length) return null;
  return (
    <View className="mb-4 rounded-xl border border-violet-800/50 bg-violet-950/30 p-4">
      <Text className="mb-2 text-sm font-semibold text-violet-200">What to do next</Text>
      {tips.map((tip, i) => (
        <View key={i} className="flex-row items-start gap-2 py-1">
          <Ionicons name="bulb-outline" size={16} color="#a78bfa" style={{ marginTop: 2 }} />
          <Text className="flex-1 text-sm text-zinc-300">{tip}</Text>
        </View>
      ))}
    </View>
  );
}

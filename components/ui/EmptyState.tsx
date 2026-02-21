import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type EmptyStateProps = {
  message: string;
  detail?: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function EmptyState({ message, detail, icon }: EmptyStateProps) {
  return (
    <View className="py-12 items-center">
      {icon ? <Ionicons name={icon} size={48} color="#52525b" /> : null}
      <Text className="text-zinc-500 text-center mt-3">{message}</Text>
      {detail ? <Text className="text-zinc-600 text-center text-sm mt-1">{detail}</Text> : null}
    </View>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import { TYPE_ICONS } from "../../lib/constants";

type TypeBadgeProps = {
  label: string;
  typeKey?: string;
  variant?: "default" | "amber";
};

export function TypeBadge({ label, typeKey, variant = "default" }: TypeBadgeProps) {
  const iconName = typeKey && TYPE_ICONS[typeKey] ? (TYPE_ICONS[typeKey] as keyof typeof Ionicons.glyphMap) : null;
  const bgClass = variant === "amber" ? "bg-amber-600/20" : "bg-zinc-700/80";
  const textClass = variant === "amber" ? "text-amber-400" : "text-zinc-400";

  return (
    <View className={`flex-row items-center gap-1 rounded px-1.5 py-0.5 ${bgClass}`}>
      {iconName ? <Ionicons name={iconName} size={10} color={variant === "amber" ? "#fbbf24" : "#a78bfa"} /> : null}
      <Text className={`text-[10px] ${textClass}`}>{label}</Text>
    </View>
  );
}

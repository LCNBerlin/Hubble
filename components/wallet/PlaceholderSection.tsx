import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type WalletSection =
  | "analytics"
  | "cards"
  | "automation"
  | "tax"
  | "security";

const LABELS: Record<WalletSection, string> = {
  analytics: "Analytics",
  cards: "Cards",
  automation: "Automation",
  tax: "Tax & Compliance",
  security: "Security",
};

const ICONS: Record<WalletSection, keyof typeof Ionicons.glyphMap> = {
  analytics: "bar-chart-outline",
  cards: "card-outline",
  automation: "flash-outline",
  tax: "document-text-outline",
  security: "shield-checkmark-outline",
};

export function PlaceholderSection({ section }: { section: WalletSection }) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <Ionicons name={ICONS[section]} size={48} color="#52525b" />
      <Text className="mt-4 text-center text-lg font-semibold text-zinc-300">
        {LABELS[section]}
      </Text>
      <Text className="mt-2 text-center text-sm text-zinc-500">
        Coming soon.
      </Text>
    </View>
  );
}

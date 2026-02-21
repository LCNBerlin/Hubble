import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

export type WalletSection =
  | "overview"
  | "fiat"
  | "crypto"
  | "escrow"
  | "transactions"
  | "analytics"
  | "cards"
  | "automation"
  | "tax"
  | "security";

const SIDEBAR_ITEMS: { key: WalletSection; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "overview", label: "Overview", icon: "wallet-outline" },
  { key: "fiat", label: "Fiat Vault", icon: "card-outline" },
  { key: "crypto", label: "Crypto Vault", icon: "logo-bitcoin" },
  { key: "escrow", label: "Escrow", icon: "lock-closed-outline" },
  { key: "transactions", label: "Transactions", icon: "list-outline" },
  { key: "analytics", label: "Analytics", icon: "bar-chart-outline" },
  { key: "cards", label: "Cards", icon: "card-outline" },
  { key: "automation", label: "Automation", icon: "flash-outline" },
  { key: "tax", label: "Tax & Compliance", icon: "document-text-outline" },
  { key: "security", label: "Security", icon: "shield-checkmark-outline" },
];

export function WalletSidebar({
  activeSection,
  onSelect,
}: {
  activeSection: WalletSection;
  onSelect: (s: WalletSection) => void;
}) {
  return (
    <View className="w-full border-r border-zinc-800 bg-zinc-900/50 py-4">
      {SIDEBAR_ITEMS.map((item) => {
        const isActive = activeSection === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            className={`mx-2 mb-1 flex-row items-center rounded-lg px-3 py-2.5 ${
              isActive ? "bg-violet-600/20 border border-violet-500/40" : ""
            }`}
            style={
              isActive
                ? { shadowColor: "#a78bfa", shadowRadius: 6, shadowOpacity: 0.25 }
                : undefined
            }
          >
            <Ionicons
              name={item.icon}
              size={22}
              color={isActive ? "#a78bfa" : "#71717a"}
            />
            <Text
              className={`ml-3 text-sm ${isActive ? "font-semibold text-violet-300" : "text-zinc-400"}`}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

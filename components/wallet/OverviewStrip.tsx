import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

const QUICK_ACTIONS = [
  { key: "send", label: "Send", icon: "arrow-up-outline" as const },
  { key: "request", label: "Request", icon: "arrow-down-outline" as const },
  { key: "convert", label: "Convert", icon: "swap-horizontal-outline" as const },
  { key: "withdraw", label: "Withdraw", icon: "cash-outline" as const },
  { key: "escrow", label: "Create Escrow", icon: "lock-closed-outline" as const },
];

export type QuickActionKey = "send" | "request" | "convert" | "withdraw" | "escrow";

export function OverviewStrip({
  totalCents,
  availableCents,
  lockedCents,
  pendingCents,
  netChange30dCents,
  onQuickAction,
}: {
  totalCents: number;
  availableCents: number;
  lockedCents: number;
  pendingCents: number;
  netChange30dCents: number;
  onQuickAction?: (key: QuickActionKey) => void;
}) {
  const format = (c: number) => `$${(c / 100).toFixed(2)}`;
  const netPositive = netChange30dCents >= 0;

  return (
    <View className="border-b border-zinc-800 bg-zinc-900/80 px-4 py-4">
      <View className="flex-row flex-wrap items-start justify-between gap-4">
        <View className="min-w-0 flex-1">
          <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Total Net Worth
          </Text>
          <Text className="mt-1 text-3xl font-bold tabular-nums text-zinc-100">
            {format(totalCents)}
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-4">
            <Text className="text-sm text-zinc-400">
              Available <Text className="font-semibold text-zinc-200">{format(availableCents)}</Text>
            </Text>
            <Text className="text-sm text-zinc-400">
              Locked <Text className="font-semibold text-amber-400/90">{format(lockedCents)}</Text>
            </Text>
            <Text className="text-sm text-zinc-400">
              Pending <Text className="font-semibold text-zinc-200">{format(pendingCents)}</Text>
            </Text>
            <Text className={`text-sm font-medium ${netPositive ? "text-emerald-400" : "text-red-400"}`}>
              30d {netPositive ? "+" : ""}{format(netChange30dCents)}
            </Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => onQuickAction?.(action.key as QuickActionKey)}
              className="flex-row items-center rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2"
            >
              <Ionicons name={action.icon} size={16} color="#a78bfa" />
              <Text className="ml-2 text-sm font-medium text-zinc-200">{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

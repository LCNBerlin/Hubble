import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";

const VAULTS = [
  { key: "spending", label: "Spending Vault", icon: "wallet-outline" as const },
  { key: "savings", label: "Savings Vault", icon: "trending-up-outline" as const },
  { key: "tax", label: "Tax Vault", icon: "document-text-outline" as const },
  { key: "escrow", label: "Escrow Vault", icon: "lock-closed-outline" as const },
  { key: "staking", label: "Staking Vault", icon: "stats-chart-outline" as const },
];

export type VaultKey = "spending" | "savings" | "tax" | "escrow" | "staking";

export function VaultBreakdownCards({
  vaultBalances,
  totalCents,
  onManageVault,
}: {
  vaultBalances: Record<string, number>;
  totalCents: number;
  onManageVault?: (key: VaultKey) => void;
}) {
  const format = (c: number) => `$${(c / 100).toFixed(2)}`;

  return (
    <View className="py-4">
      <Text className="mb-2 px-4 text-sm font-semibold text-zinc-400">Vault breakdown</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 16, paddingRight: 32 }}
      >
        {VAULTS.map((v) => {
          const balance = vaultBalances[v.key] ?? 0;
          const pct = totalCents > 0 ? (balance / totalCents) * 100 : 0;
          return (
            <Pressable
              key={v.key}
              className="min-w-[160] rounded-xl border border-zinc-700/80 bg-zinc-800/80 p-4"
            >
              <Ionicons name={v.icon} size={24} color="#71717a" />
              <Text className="mt-2 text-lg font-bold tabular-nums text-zinc-100">
                {format(balance)}
              </Text>
              <Text className="mt-0.5 text-xs text-zinc-500">{v.label}</Text>
              <Text className="mt-1 text-xs text-zinc-400">{pct.toFixed(1)}% allocation</Text>
              <Pressable
                onPress={() => onManageVault?.(v.key as VaultKey)}
                className="mt-3 rounded-lg bg-zinc-700 py-2"
              >
                <Text className="text-center text-xs font-medium text-zinc-300">Manage</Text>
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

import { Text, View } from "react-native";
import { formatCentsToPrice } from "../../lib/payments";
import type { WalletSection } from "./WalletSidebar";

export function WalletRightPanel({
  section,
  monthlyRevenueCents,
  escrowTotalCents,
  escrowCount,
  upcomingPayoutCents,
  hasStripeAccount,
}: {
  section: WalletSection;
  monthlyRevenueCents: number;
  escrowTotalCents: number;
  escrowCount: number;
  upcomingPayoutCents: number;
  hasStripeAccount: boolean;
}) {
  if (section === "overview") {
    return (
      <View className="flex-1 border-l border-zinc-800 bg-zinc-900/30 p-4">
        <Text className="text-sm font-semibold text-zinc-400">Monthly revenue</Text>
        <View className="mt-2 h-24 rounded-lg bg-zinc-800/80 items-center justify-center">
          <Text className="text-lg font-bold tabular-nums text-zinc-100">
            {formatCentsToPrice(monthlyRevenueCents)}
          </Text>
        </View>
        <Text className="mt-4 text-sm font-semibold text-zinc-400">Cash flow</Text>
        <Text className="mt-1 text-xs text-zinc-500">From orders and payouts</Text>
        <Text className="mt-4 text-sm font-semibold text-zinc-400">Risk alerts</Text>
        <Text className="mt-1 text-xs text-zinc-500">
          {escrowCount > 0 ? `${escrowCount} in escrow` : "None"}
        </Text>
        <Text className="mt-4 text-sm font-semibold text-zinc-400">Withdrawal</Text>
        <Text className="mt-1 text-xs text-zinc-500">
          {hasStripeAccount ? "Stripe Connect linked" : "Link account in Fiat"}
        </Text>
      </View>
    );
  }
  if (section === "fiat") {
    return (
      <View className="flex-1 border-l border-zinc-800 bg-zinc-900/30 p-4">
        <Text className="text-sm font-semibold text-zinc-400">Upcoming payouts</Text>
        <Text className="mt-1 text-sm tabular-nums text-zinc-200">
          {formatCentsToPrice(upcomingPayoutCents)}
        </Text>
        <Text className="mt-4 text-sm font-semibold text-zinc-400">Bank sync</Text>
        <Text className="mt-1 text-xs text-zinc-500">
          {hasStripeAccount ? "Connected" : "Not connected"}
        </Text>
      </View>
    );
  }
  if (section === "crypto") {
    return (
      <View className="flex-1 border-l border-zinc-800 bg-zinc-900/30 p-4">
        <Text className="text-sm font-semibold text-zinc-400">Portfolio</Text>
        <Text className="mt-1 text-xs text-zinc-500">Connect wallet in Profile</Text>
      </View>
    );
  }
  if (section === "escrow") {
    return (
      <View className="flex-1 border-l border-zinc-800 bg-zinc-900/30 p-4">
        <Text className="text-sm font-semibold text-amber-400/90">Escrow summary</Text>
        <Text className="mt-1 text-sm font-bold tabular-nums text-zinc-100">
          {formatCentsToPrice(escrowTotalCents)}
        </Text>
        <Text className="mt-0.5 text-xs text-zinc-500">{escrowCount} active</Text>
      </View>
    );
  }
  return (
    <View className="flex-1 border-l border-zinc-800 bg-zinc-900/30 p-4">
      <Text className="text-sm font-semibold text-zinc-400">Context</Text>
      <Text className="mt-1 text-xs text-zinc-500">—</Text>
    </View>
  );
}

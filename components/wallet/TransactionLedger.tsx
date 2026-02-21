import { useCallback } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { formatCentsToPrice } from "../../lib/payments";
import type { OrderWithItems } from "../../hooks/useOrdersForWallet";

const STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  escrow_held: "In escrow",
  released: "Released",
  refunded: "Refunded",
  disputed: "Disputed",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getCounterparty(order: OrderWithItems): string {
  const items = order.order_items ?? [];
  if (items.length === 0) return "—";
  const first = items[0];
  return first.title ?? first.product_id?.slice(0, 8) ?? "—";
}

export function TransactionLedger({
  orders,
  onSelectOrder,
}: {
  orders: OrderWithItems[];
  onSelectOrder: (order: OrderWithItems) => void;
}) {
  const renderRow = useCallback(
    (order: OrderWithItems) => (
      <Pressable
        key={order.id}
        onPress={() => onSelectOrder(order)}
        className="flex-row flex-wrap items-center border-b border-zinc-800/80 py-3 px-2"
      >
        <View className="w-[72] flex-shrink-0">
          <Text className="text-xs text-zinc-400">{formatDate(order.created_at)}</Text>
        </View>
        <View className="w-20 flex-shrink-0">
          <Text className="text-xs text-zinc-300">Purchase</Text>
        </View>
        <View className="min-w-0 flex-1 max-w-[120]">
          <Text className="truncate text-xs text-zinc-300">{getCounterparty(order)}</Text>
        </View>
        <View className="w-20 flex-shrink-0">
          <Text className="text-right text-xs font-medium tabular-nums text-zinc-100">
            {formatCentsToPrice(order.total_cents)}
          </Text>
        </View>
        <View className="w-14 flex-shrink-0">
          <Text className="text-xs uppercase text-zinc-400">{order.currency}</Text>
        </View>
        <View className="w-14 flex-shrink-0">
          <Text className="text-right text-xs text-zinc-500">
            {order.discount_cents > 0 ? `-${formatCentsToPrice(order.discount_cents)}` : "—"}
          </Text>
        </View>
        <View className="w-20 flex-shrink-0">
          <Text
            className={`text-xs font-medium ${
              order.status === "released"
                ? "text-emerald-400"
                : order.status === "escrow_held"
                  ? "text-amber-400"
                  : order.status === "disputed"
                    ? "text-red-400"
                    : "text-zinc-400"
            }`}
          >
            {STATUS_LABELS[order.status] ?? order.status}
          </Text>
        </View>
      </Pressable>
    ),
    [onSelectOrder]
  );

  return (
    <View className="py-4">
      <Text className="mb-2 px-4 text-sm font-semibold text-zinc-400">Transaction ledger</Text>
      <View className="border-t border-zinc-800">
        <View className="flex-row flex-wrap border-b border-zinc-700 py-2 px-2">
          <Text className="w-[72] flex-shrink-0 text-xs font-medium text-zinc-500">Date</Text>
          <Text className="w-20 flex-shrink-0 text-xs font-medium text-zinc-500">Type</Text>
          <Text className="min-w-0 flex-1 max-w-[120] text-xs font-medium text-zinc-500">Counterparty</Text>
          <Text className="w-20 flex-shrink-0 text-right text-xs font-medium text-zinc-500">Amount</Text>
          <Text className="w-14 flex-shrink-0 text-xs font-medium text-zinc-500">Asset</Text>
          <Text className="w-14 flex-shrink-0 text-right text-xs font-medium text-zinc-500">Fee</Text>
          <Text className="w-20 flex-shrink-0 text-xs font-medium text-zinc-500">Status</Text>
        </View>
        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={true}>
          {orders.length === 0 ? (
            <View className="py-8">
              <Text className="text-center text-sm text-zinc-500">No transactions yet</Text>
            </View>
          ) : (
            orders.map(renderRow)
          )}
        </ScrollView>
      </View>
    </View>
  );
}

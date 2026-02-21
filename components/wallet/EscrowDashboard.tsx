import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { confirmDelivery } from "../../lib/payments";
import { formatCentsToPrice } from "../../lib/payments";
import { useEscrowOrders } from "../../hooks/useOrdersForWallet";
import type { OrderWithItems } from "../../hooks/useOrdersForWallet";

type EscrowTab = "active" | "pending" | "disputed" | "completed";

const TAB_LABELS: Record<EscrowTab, string> = {
  active: "Active",
  pending: "Pending",
  disputed: "Disputed",
  completed: "Completed",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function EscrowCard({
  order,
  onRelease,
  releasing,
}: {
  order: OrderWithItems;
  onRelease: () => void;
  releasing: boolean;
}) {
  const items = order.order_items ?? [];
  const counterparty = items[0]?.title ?? items[0]?.product_id?.slice(0, 8) ?? "—";
  const progress =
    order.status === "released" ? 100 : order.status === "escrow_held" ? 50 : 0;

  return (
    <View className="mb-4 rounded-xl border border-zinc-700/80 bg-zinc-800/80 p-4">
      <View className="flex-row justify-between">
        <Text className="text-lg font-bold tabular-nums text-zinc-100">
          {formatCentsToPrice(order.total_cents)}
        </Text>
        <Text className="text-xs text-zinc-500">{formatDate(order.created_at)}</Text>
      </View>
      <Text className="mt-1 text-sm text-zinc-400">Counterparty: {counterparty}</Text>
      <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-700">
        <View
          className="h-full rounded-full bg-amber-500/80"
          style={{ width: `${progress}%` }}
        />
      </View>
      <Text className="mt-2 text-xs text-zinc-500">
        Paid → Escrow {order.status === "released" ? "→ Released" : ""}
      </Text>
      {order.status === "escrow_held" && (
        <Pressable
          onPress={onRelease}
          disabled={releasing}
          className="mt-3 rounded-lg border border-amber-500/50 bg-amber-500/10 py-2.5"
        >
          {releasing ? (
            <ActivityIndicator size="small" color="#f59e0b" />
          ) : (
            <Text className="text-center text-sm font-medium text-amber-400">Release</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

export function EscrowDashboard({ userId }: { userId: string | undefined }) {
  const { active, completed, disputed, pending, loading, refresh } = useEscrowOrders(userId);
  const [tab, setTab] = useState<EscrowTab>("active");
  const [releasingId, setReleasingId] = useState<string | null>(null);

  const handleRelease = useCallback(
    async (orderId: string) => {
      if (!userId) return;
      setReleasingId(orderId);
      const result = await confirmDelivery(orderId, userId);
      setReleasingId(null);
      if (result.ok) refresh();
    },
    [userId, refresh]
  );

  const list =
    tab === "active" ? active : tab === "completed" ? completed : tab === "disputed" ? disputed : pending;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="flex-row border-b border-zinc-800">
        {(Object.keys(TAB_LABELS) as EscrowTab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            className={`flex-1 py-3 ${tab === t ? "border-b-2 border-amber-500" : ""}`}
          >
            <Text
              className={`text-center text-sm font-medium ${
                tab === t ? "text-amber-400" : "text-zinc-500"
              }`}
            >
              {TAB_LABELS[t]}
            </Text>
          </Pressable>
        ))}
      </View>
      <View className="p-4">
        {list.length === 0 ? (
          <Text className="py-8 text-center text-zinc-500">No escrows in this tab</Text>
        ) : (
          list.map((order) => (
            <EscrowCard
              key={order.id}
              order={order}
              onRelease={() => handleRelease(order.id)}
              releasing={releasingId === order.id}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

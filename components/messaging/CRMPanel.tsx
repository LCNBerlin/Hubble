import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useMessaging } from "../../context/MessagingContext";
import { useCRMData, type CRMOrder } from "../../hooks/useCRMData";
import { useConversationPeerId } from "../../hooks/useConversationPeerId";
import { Avatar } from "../ui/Avatar";

function centsToDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function CRMPanel() {
  const { user } = useAuth();
  const { selectedConversationId, closeCRM, setCrmCollapsed } = useMessaging();
  const peerUserId = useConversationPeerId(selectedConversationId, user?.id);
  const crm = useCRMData(peerUserId, user?.id);
  const [selectedOrder, setSelectedOrder] = useState<CRMOrder | null>(null);

  const handleClose = useCallback(() => {
    closeCRM();
    setCrmCollapsed(true);
  }, [closeCRM, setCrmCollapsed]);

  if (!selectedConversationId) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-900 p-4">
        <Text className="text-center text-zinc-500">Select a conversation to view CRM</Text>
      </View>
    );
  }

  if (!peerUserId) {
    return (
      <View className="flex-1 items-center justify-center bg-zinc-900 p-4">
        <Text className="text-center text-zinc-500">Loading…</Text>
      </View>
    );
  }

  const historyItems = [
    ...crm.ordersAsCreator.map((o) => ({ type: "order" as const, order: o })),
    ...crm.ordersAsBuyer.map((o) => ({ type: "purchase" as const, order: o })),
  ].sort((a, b) => new Date(b.order.created_at).getTime() - new Date(a.order.created_at).getTime());

  const allItems = [
    ...crm.ordersAsCreator.flatMap((o) => (o.order_items ?? []).map((i) => ({ orderId: o.id, ...i }))),
    ...crm.ordersAsBuyer.flatMap((o) => (o.order_items ?? []).map((i) => ({ orderId: o.id, ...i }))),
  ];

  return (
    <View className="flex-1 bg-zinc-900">
        <View className="flex-row items-center justify-between border-b border-zinc-800 px-3 py-2">
        <Text className="text-sm font-semibold text-zinc-100">CRM</Text>
        <Pressable onPress={handleClose} className="rounded-full p-2">
          <Ionicons name="chevron-forward" size={22} color="#71717a" />
        </Pressable>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        {crm.loading ? (
          <Text className="p-4 text-zinc-500">Loading…</Text>
        ) : (
          <>
            <View className="border-b border-zinc-800 p-4">
              <View className="items-center">
                <Avatar uri={crm.profile?.avatar_url ?? null} size={64} />
                <Text className="mt-2 text-base font-semibold text-zinc-100">
                  {crm.profile?.display_name || crm.profile?.username || "—"}
                </Text>
                {crm.profile?.category_tags?.length ? (
                  <Text className="text-xs text-zinc-500">
                    {(crm.profile.category_tags as string[]).slice(0, 2).join(", ")}
                  </Text>
                ) : null}
                <View className="mt-1 flex-row items-center gap-2">
                  {crm.profile?.verified_tier !== "none" && (
                    <Ionicons name="checkmark-circle" size={14} color="#a78bfa" />
                  )}
                  <Text className="text-xs text-zinc-500">
                    Risk: {crm.profile?.reputation_score ?? "—"}
                  </Text>
                </View>
              </View>
            </View>

            <View className="border-b border-zinc-800 p-4">
              <Text className="mb-2 text-xs font-medium uppercase text-zinc-500">Revenue</Text>
              <View className="gap-1">
                <Text className="text-sm text-zinc-300">
                  Total from user: {centsToDollars(crm.totalRevenueFromUserCents)}
                </Text>
                <Text className="text-sm text-zinc-300">Total paid: {centsToDollars(crm.totalPaidCents)}</Text>
                <Text className="text-sm text-zinc-300">Total due: {centsToDollars(crm.totalDueCents)}</Text>
                <Text className="text-sm text-zinc-300">Active deals: {crm.activeDeals}</Text>
              </View>
            </View>

            <View className="border-b border-zinc-800 p-4">
              <Text className="mb-2 text-xs font-medium uppercase text-zinc-500">History</Text>
              {historyItems.length === 0 ? (
                <Text className="text-sm text-zinc-500">No orders yet</Text>
              ) : (
                <View className="gap-2">
                  {historyItems.slice(0, 10).map(({ type, order }) => (
                    <Pressable
                      key={order.id}
                      onPress={() => setSelectedOrder(order)}
                      className="flex-row items-center justify-between rounded-lg bg-zinc-800 p-2"
                    >
                      <Text className="text-sm text-zinc-300">
                        {type === "order" ? "Order" : "Purchase"} · {centsToDollars(order.total_cents)}
                      </Text>
                      <View className="flex-row items-center gap-1">
                        {order.status === "escrow_held" && (
                          <Ionicons name="lock-closed" size={12} color="#a78bfa" />
                        )}
                        {order.status === "disputed" && (
                          <Text className="text-xs text-amber-400">Dispute</Text>
                        )}
                        <Ionicons name="chevron-forward" size={14} color="#71717a" />
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View className="border-b border-zinc-800 p-4">
              <Text className="mb-2 text-xs font-medium uppercase text-zinc-500">Items</Text>
              {allItems.length === 0 ? (
                <Text className="text-sm text-zinc-500">No items</Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {allItems.slice(0, 12).map((item) => (
                    <View
                      key={item.id}
                      className="h-16 w-16 items-center justify-center rounded-lg bg-zinc-800"
                    >
                      <Text className="text-xs text-zinc-400" numberOfLines={1}>
                        {item.title || "Item"}
                      </Text>
                      <Text className="text-[10px] text-zinc-500">
                        {centsToDollars(item.line_total_cents)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View className="p-4">
              <Text className="mb-2 text-xs font-medium uppercase text-zinc-500">Actions</Text>
              <View className="flex-row flex-wrap gap-2">
                <Pressable className="rounded-lg bg-zinc-800 px-3 py-2">
                  <Text className="text-sm text-zinc-300">Add tag</Text>
                </Pressable>
                <Pressable className="rounded-lg bg-zinc-800 px-3 py-2">
                  <Text className="text-sm text-zinc-300">Add note</Text>
                </Pressable>
                <Pressable className="rounded-lg bg-zinc-800 px-3 py-2">
                  <Text className="text-sm text-zinc-300">Pipeline</Text>
                </Pressable>
                <Pressable className="rounded-lg bg-zinc-800 px-3 py-2">
                  <Text className="text-sm text-zinc-300">Reminder</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

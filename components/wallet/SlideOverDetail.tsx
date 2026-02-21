import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { formatCentsToPrice } from "../../lib/payments";
import type { OrderWithItems } from "../../hooks/useOrdersForWallet";

const STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  escrow_held: "In escrow",
  released: "Released",
  refunded: "Refunded",
  disputed: "Disputed",
};

export function SlideOverDetail({
  order,
  visible,
  onClose,
}: {
  order: OrderWithItems | null;
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  if (!order) return null;

  const items = order.order_items ?? [];
  const discountCents = order.discount_cents ?? 0;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable className="flex-1 flex-row" onPress={onClose}>
        <Pressable className="flex-1 bg-black/50" onPress={onClose} />
        <Pressable
          className="w-full max-w-md bg-zinc-900 border-l border-zinc-800"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="border-b border-zinc-800 px-4 py-3 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-zinc-100">Transaction detail</Text>
            <Pressable onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#71717a" />
            </Pressable>
          </View>
          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            <View className="mb-4">
              <Text className="text-xs text-zinc-500">Amount</Text>
              <Text className="text-xl font-bold tabular-nums text-zinc-100">
                {formatCentsToPrice(order.total_cents)}
              </Text>
              <Text className="mt-1 text-sm text-zinc-400">
                Status: {STATUS_LABELS[order.status] ?? order.status}
              </Text>
            </View>
            <View className="mb-4">
              <Text className="text-xs font-medium text-zinc-500">Fee breakdown</Text>
              <View className="mt-1 rounded-lg bg-zinc-800/80 p-3">
                {discountCents > 0 && (
                  <View className="flex-row justify-between">
                    <Text className="text-sm text-zinc-400">Discount applied</Text>
                    <Text className="text-sm tabular-nums text-emerald-400">
                      -{formatCentsToPrice(discountCents)}
                    </Text>
                  </View>
                )}
                <View className="flex-row justify-between mt-1">
                  <Text className="text-sm text-zinc-400">Processing</Text>
                  <Text className="text-sm tabular-nums text-zinc-200">$0.00</Text>
                </View>
                <Text className="mt-2 text-xs text-zinc-500">No hidden fees.</Text>
              </View>
            </View>
            {order.stripe_payment_intent_id && (
              <View className="mb-4">
                <Text className="text-xs font-medium text-zinc-500">Payment ID</Text>
                <Text className="mt-1 font-mono text-xs text-zinc-400" selectable>
                  {order.stripe_payment_intent_id}
                </Text>
              </View>
            )}
            <View className="mb-4">
              <Text className="text-xs font-medium text-zinc-500">Risk score</Text>
              <Text className="mt-1 text-sm text-zinc-400">—</Text>
            </View>
            <View className="mb-4">
              <Text className="text-xs font-medium text-zinc-500">Tax tag</Text>
              <Text className="mt-1 text-sm text-zinc-400">—</Text>
            </View>
            {order.status === "escrow_held" && (
              <Pressable
                onPress={() => {
                  onClose();
                  router.push("/orders");
                }}
                className="rounded-lg border border-amber-500/50 bg-amber-500/10 py-2.5"
              >
                <Text className="text-center text-sm font-medium text-amber-400">
                  View escrow & release
                </Text>
              </Pressable>
            )}
            {items.length > 0 && (
              <View className="mt-4">
                <Text className="text-xs font-medium text-zinc-500">Line items</Text>
                {items.map((item) => (
                  <View
                    key={item.id}
                    className="mt-1 flex-row justify-between rounded bg-zinc-800/50 px-3 py-2"
                  >
                    <Text className="flex-1 text-sm text-zinc-300" numberOfLines={1}>
                      {item.title ?? item.product_id}
                    </Text>
                    <Text className="text-sm tabular-nums text-zinc-200">
                      {formatCentsToPrice(item.line_total_cents)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { confirmDelivery, formatCentsToPrice } from "../lib/payments";
import supabase from "../lib/supabase";

type OrderRow = {
  id: string;
  buyer_id: string;
  status: string;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  escrow_release_at: string | null;
  released_at: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  escrow_held: "In escrow",
  released: "Released",
  refunded: "Refunded",
  disputed: "Disputed",
};

export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      setOrders([]);
    } else {
      setOrders((data as OrderRow[]) ?? []);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleConfirmDelivery = useCallback(
    async (orderId: string) => {
      if (!user?.id) return;
      setReleasingId(orderId);
      const result = await confirmDelivery(orderId, user.id);
      setReleasingId(null);
      if (result.ok) {
        await fetchOrders();
      }
    },
    [user?.id, fetchOrders]
  );

  if (!user) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <Text className="text-zinc-500">Sign in to view orders</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-950" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center border-b border-zinc-800 px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={24} color="#e4e4e7" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-zinc-100">Order history</Text>
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      ) : orders.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="receipt-outline" size={48} color="#71717a" />
          <Text className="mt-3 text-center text-zinc-500">No orders yet</Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {orders.map((order) => (
            <View
              key={order.id}
              className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800/80 p-4"
            >
              <View className="flex-row justify-between items-start">
                <Text className="text-sm font-mono text-zinc-500">
                  #{order.id.slice(0, 8)}
                </Text>
                <View
                  className={`rounded-full px-2.5 py-0.5 ${
                    order.status === "released"
                      ? "bg-emerald-500/20"
                      : order.status === "escrow_held"
                        ? "bg-amber-500/20"
                        : "bg-zinc-600/50"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      order.status === "released"
                        ? "text-emerald-400"
                        : order.status === "escrow_held"
                          ? "text-amber-400"
                          : "text-zinc-400"
                    }`}
                  >
                    {STATUS_LABELS[order.status] ?? order.status}
                  </Text>
                </View>
              </View>
              <Text className="text-lg font-semibold text-zinc-100 mt-2">
                {formatCentsToPrice(order.total_cents)}
              </Text>
              <Text className="text-xs text-zinc-500 mt-0.5">
                {new Date(order.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              {order.status === "escrow_held" && (
                <TouchableOpacity
                  onPress={() => handleConfirmDelivery(order.id)}
                  disabled={!!releasingId}
                  className="mt-3 rounded-lg bg-violet-600 py-2.5 items-center"
                >
                  {releasingId === order.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-sm font-semibold text-white">
                      Confirm delivery
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useStripeContext } from "../context/StripeContext";
import { PAYMENTS_ENABLED } from "../lib/config";
import { amountToSmallestUnit, createPaymentIntent, createTipNotification } from "../lib/payments";

const TIP_FIAT = [
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "JPY", symbol: "¥" },
  { code: "CAD", symbol: "C$" },
  { code: "AUD", symbol: "A$" },
  { code: "CHF", symbol: "CHF" },
  { code: "INR", symbol: "₹" },
  { code: "MXN", symbol: "MX$" },
  { code: "BRL", symbol: "R$" },
];

const TIP_CRYPTO = [
  { code: "BTC", symbol: "BTC" },
  { code: "ETH", symbol: "ETH" },
  { code: "USDT", symbol: "USDT" },
  { code: "USDC", symbol: "USDC" },
  { code: "SOL", symbol: "SOL" },
  { code: "DOGE", symbol: "DOGE" },
];

const TIP_CURRENCIES = [...TIP_FIAT, ...TIP_CRYPTO];

export function TipModal({
  visible,
  onClose,
  forPostTitle,
  recipientId,
  actorId,
  postId,
}: {
  visible: boolean;
  onClose: () => void;
  forPostTitle?: string;
  /** Creator to notify (tip_received). If provided, notification is sent after successful tip. */
  recipientId?: string;
  /** Tipper profile id (optional). */
  actorId?: string;
  /** Post id when tipping a post (optional). */
  postId?: string;
}) {
  const [amount, setAmount] = useState("");
  const [currencyIndex, setCurrencyIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const currency = TIP_CURRENCIES[currencyIndex];
  const { initPaymentSheet, presentPaymentSheet } = useStripeContext();
  const isCrypto = currencyIndex >= TIP_FIAT.length;
  const isFiatStripe = !isCrypto && PAYMENTS_ENABLED;

  const handleSend = async () => {
    const val = amount.trim() || "0";
    const n = parseFloat(val);
    if (isNaN(n) || n < 0) return;
    const amountStr = isCrypto ? String(n) : n.toFixed(2);
    const msg = forPostTitle
      ? `Thanks for the ${currency.symbol} ${amountStr} tip on "${forPostTitle}"!`
      : `Thanks for the ${currency.symbol} ${amountStr} tip!`;

    if (isCrypto || !PAYMENTS_ENABLED) {
      onClose();
      setAmount("");
      Alert.alert("Tip sent", msg);
      return;
    }

    const amountSmallest = amountToSmallestUnit(n, currency.code);
    if (amountSmallest < 50) {
      Alert.alert("Invalid amount", "Minimum amount is 0.50 (or 50 for JPY).");
      return;
    }

    setLoading(true);
    const result = await createPaymentIntent({
      amountCents: amountSmallest,
      currency: currency.code,
      metadata: { type: "tip", postTitle: forPostTitle },
    });
    if (!result.ok) {
      setLoading(false);
      Alert.alert("Payment failed", result.error);
      return;
    }

    try {
      await initPaymentSheet({
        paymentIntentClientSecret: result.clientSecret,
        merchantDisplayName: "Hubble",
      });
      const { error } = await presentPaymentSheet();
      if (error) {
        Alert.alert("Payment failed", error.message ?? "Payment was not completed.");
      } else {
        if (recipientId) {
          await createTipNotification({
            recipientId,
            actorId: actorId ?? undefined,
            targetType: postId ? "post" : undefined,
            targetId: postId,
          });
        }
        onClose();
        setAmount("");
        Alert.alert("Tip sent", msg);
      }
    } catch (e) {
      Alert.alert("Payment failed", e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable className="flex-1 justify-center bg-black/60 px-6" onPress={onClose}>
        <Pressable className="max-h-[85%] rounded-2xl border border-zinc-700 bg-zinc-900 p-5" onPress={(e) => e.stopPropagation()}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-zinc-100">
              {forPostTitle ? "Tip this post" : "Send tip"}
            </Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={22} color="#a1a1aa" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>
            <Text className="text-sm text-zinc-400 mb-2">Fiat</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              {TIP_FIAT.map((c, i) => (
                <TouchableOpacity
                  key={c.code}
                  onPress={() => setCurrencyIndex(i)}
                  className={`py-2 px-3 rounded-lg border mr-2 ${i === currencyIndex ? "border-amber-500 bg-amber-500/20" : "border-zinc-700 bg-zinc-800"}`}
                >
                  <Text className={`text-sm font-medium ${i === currencyIndex ? "text-amber-400" : "text-zinc-400"}`}>
                    {c.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text className="text-sm text-zinc-400 mb-2">Crypto</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              {TIP_CRYPTO.map((c, i) => {
                const idx = TIP_FIAT.length + i;
                return (
                  <TouchableOpacity
                    key={c.code}
                    onPress={() => setCurrencyIndex(idx)}
                    className={`py-2 px-3 rounded-lg border mr-2 ${idx === currencyIndex ? "border-amber-500 bg-amber-500/20" : "border-zinc-700 bg-zinc-800"}`}
                  >
                    <Text className={`text-sm font-medium ${idx === currencyIndex ? "text-amber-400" : "text-zinc-400"}`}>
                      {c.code}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text className="text-sm text-zinc-400 mb-2">Amount ({currency.symbol})</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder={`e.g. 5.00 or 0.001 (${currency.symbol})`}
              placeholderTextColor="#71717a"
              keyboardType="decimal-pad"
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-3 text-zinc-100 text-base mb-4"
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={loading}
              className="rounded-xl bg-amber-500 py-3 items-center active:opacity-90 disabled:opacity-60"
            >
              <Text className="text-base font-semibold text-white">
                {loading ? "Preparing…" : "Send tip"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

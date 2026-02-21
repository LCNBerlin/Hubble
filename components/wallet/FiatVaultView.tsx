import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { formatCentsToPrice } from "../../lib/payments";
import { API_URL } from "../../lib/config";

const DEPOSIT_METHODS = ["ACH", "Wire", "Card", "Apple Pay"] as const;

export function FiatVaultView({
  userId,
  stripeConnectAccountId,
  earnedCents,
  pendingPayoutCents,
  onRefresh,
}: {
  userId: string | undefined;
  stripeConnectAccountId: string | null | undefined;
  earnedCents: number;
  pendingPayoutCents: number;
  onRefresh?: () => void;
}) {
  const [addAccountLoading, setAddAccountLoading] = useState(false);
  const [taxAllocationPct, setTaxAllocationPct] = useState(25);

  const handleAddAccount = useCallback(async () => {
    if (!userId) return;
    setAddAccountLoading(true);
    try {
      const res = await fetch(`${API_URL}/connect/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        await Linking.openURL(data.url);
        onRefresh?.();
      } else {
        Alert.alert("Error", data.error || "Could not start onboarding");
      }
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Network error");
    } finally {
      setAddAccountLoading(false);
    }
  }, [userId, onRefresh]);

  const handleDepositMethod = useCallback((method: string) => {
    Alert.alert(
      method,
      "Deposit options are completed through your connected Stripe account. Open Stripe Dashboard from the link in your account settings, or complete onboarding above.",
      [{ text: "OK" }]
    );
  }, []);

  const usdAvailable = earnedCents;
  const usdPending = pendingPayoutCents;

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="border-b border-zinc-800 px-4 py-4">
        <Text className="text-xl font-bold text-zinc-100">Fiat Balance</Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {stripeConnectAccountId ? (
            <View className="rounded-full bg-emerald-500/20 px-3 py-1.5">
              <Text className="text-sm font-medium text-emerald-400">Connected</Text>
            </View>
          ) : (
            <View className="rounded-full bg-zinc-700 px-3 py-1.5">
              <Text className="text-sm text-zinc-300">No account linked</Text>
            </View>
          )}
          <Pressable
            onPress={handleAddAccount}
            disabled={!userId || addAccountLoading}
            className="rounded-full border border-violet-500/50 bg-violet-600/20 px-3 py-1.5"
          >
            {addAccountLoading ? (
              <ActivityIndicator size="small" color="#a78bfa" />
            ) : (
              <Text className="text-sm font-medium text-violet-300">
                {stripeConnectAccountId ? "Manage account" : "Add Account"}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
      <View className="px-4 py-4">
        <Text className="text-sm font-semibold text-zinc-400">Fiat balances by currency</Text>
        <View className="mt-3 rounded-xl border border-zinc-700/80 bg-zinc-800/80 p-4">
          <Text className="text-lg font-bold text-zinc-100">USD</Text>
          <View className="mt-2 flex-row gap-4">
            <Text className="text-sm text-zinc-400">
              Available <Text className="text-zinc-200">{formatCentsToPrice(usdAvailable)}</Text>
            </Text>
            <Text className="text-sm text-zinc-400">
              Pending <Text className="text-zinc-200">{formatCentsToPrice(usdPending)}</Text>
            </Text>
            <Text className="text-sm text-zinc-400">
              Held <Text className="text-zinc-200">$0.00</Text>
            </Text>
          </View>
        </View>
      </View>
      <View className="px-4 py-2">
        <Text className="text-sm font-semibold text-zinc-400">Deposit & withdraw</Text>
        <View className="mt-2 flex-row gap-4">
          <View className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/80 p-4">
            <Text className="text-xs text-zinc-500">Deposit</Text>
            <View className="mt-2 gap-2">
              {DEPOSIT_METHODS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => handleDepositMethod(m)}
                  className="rounded-lg bg-zinc-700/80 py-2"
                >
                  <Text className="text-center text-sm text-zinc-300">{m}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800/80 p-4">
            <Text className="text-xs text-zinc-500">Withdrawal</Text>
            <Text className="mt-2 text-sm text-zinc-400">
              Processing time: 2–5 business days
            </Text>
            <Text className="mt-1 text-sm text-zinc-400">Fees: See Stripe pricing</Text>
          </View>
        </View>
      </View>
      <View className="px-4 py-4">
        <Text className="text-sm font-semibold text-zinc-400">Recurring billing</Text>
        <View className="mt-2 rounded-xl border border-zinc-700/80 bg-zinc-800/80 p-4">
          <Text className="text-sm text-zinc-500">No active subscriptions</Text>
        </View>
      </View>
      <View className="px-4 py-4">
        <Text className="text-sm font-semibold text-zinc-400">Tax allocation meter</Text>
        <View className="mt-2 rounded-xl border border-zinc-700/80 bg-zinc-800/80 p-4">
          <Text className="text-xs text-zinc-500">Income → Tax Vault %</Text>
          <View className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-700">
            <View
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${taxAllocationPct}%` }}
            />
          </View>
          <Text className="mt-1 text-sm text-zinc-400">
            {taxAllocationPct}% (display only; save in settings when available)
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

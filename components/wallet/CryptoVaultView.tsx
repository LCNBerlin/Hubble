import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

export function CryptoVaultView({
  walletAddress,
  ensName,
}: {
  walletAddress: string | null | undefined;
  ensName: string | null | undefined;
}) {
  const router = useRouter();
  const hasWallet = !!(walletAddress?.trim() || ensName?.trim());
  const displayAddress = ensName?.trim() || (walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : null);

  const handleSend = useCallback(() => {
    if (!hasWallet) {
      Alert.alert("Connect wallet", "Add your wallet address in Profile to use crypto features.", [
        { text: "Cancel", style: "cancel" },
        { text: "Edit profile", onPress: () => router.push("/edit-profile") },
      ]);
    } else {
      Alert.alert("Send", "In-app send will be available when crypto is integrated.");
    }
  }, [hasWallet, router]);

  const handleReceive = useCallback(() => {
    if (!hasWallet) {
      Alert.alert("Connect wallet", "Add your wallet address in Profile first.", [
        { text: "Cancel", style: "cancel" },
        { text: "Edit profile", onPress: () => router.push("/edit-profile") },
      ]);
    } else {
      Alert.alert("Receive", "QR and address copy will be available when crypto is integrated.");
    }
  }, [hasWallet, router]);

  const handleSwap = useCallback(() => {
    if (!hasWallet) {
      Alert.alert("Connect wallet", "Add your wallet in Profile to swap.");
    } else {
      Alert.alert("Swap", "Swap will be available when crypto is integrated.");
    }
  }, [hasWallet]);

  const handleStake = useCallback(() => {
    if (!hasWallet) {
      Alert.alert("Connect wallet", "Add your wallet in Profile to stake.");
    } else {
      Alert.alert("Stake", "Staking will be available when crypto is integrated.");
    }
  }, [hasWallet]);

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="border-b border-zinc-800 px-4 py-4">
        <Text className="text-xl font-bold text-zinc-100">Crypto Net Balance</Text>
        {hasWallet ? (
          <Text className="mt-1 font-mono text-sm text-zinc-400" selectable>
            {displayAddress}
          </Text>
        ) : (
          <Text className="mt-1 text-sm text-zinc-500">No wallet connected</Text>
        )}
      </View>
      <View className="px-4 py-4">
        <View className="flex-row flex-wrap gap-2">
          <Pressable onPress={handleSend} className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-4 py-2.5">
            <Text className="text-sm font-medium text-zinc-200">Send</Text>
          </Pressable>
          <Pressable onPress={handleReceive} className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-4 py-2.5">
            <Text className="text-sm font-medium text-zinc-200">Receive</Text>
          </Pressable>
          <Pressable onPress={handleSwap} className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-4 py-2.5">
            <Text className="text-sm font-medium text-zinc-200">Swap</Text>
          </Pressable>
          <Pressable onPress={handleStake} className="rounded-lg border border-zinc-600 bg-zinc-800/80 px-4 py-2.5">
            <Text className="text-sm font-medium text-zinc-200">Stake</Text>
          </Pressable>
        </View>
        {!hasWallet && (
          <Pressable
            onPress={() => router.push("/edit-profile")}
            className="mt-4 rounded-xl border border-violet-500/50 bg-violet-600/20 py-3"
          >
            <Text className="text-center text-sm font-medium text-violet-300">Connect wallet in Profile</Text>
          </Pressable>
        )}
      </View>
      <View className="px-4 py-4">
        <Text className="text-sm font-semibold text-zinc-400">Asset grid</Text>
        <View className="mt-2 rounded-xl border border-zinc-700/80 bg-zinc-800/80 p-6 items-center">
          <Text className="text-zinc-500">No on-chain balances loaded</Text>
          <Text className="mt-1 text-xs text-zinc-600">Connect wallet and enable chain data in Profile</Text>
        </View>
      </View>
      <View className="px-4 py-4">
        <Text className="text-sm font-semibold text-zinc-400">Swap engine</Text>
        <View className="mt-2 rounded-xl border border-zinc-700/80 bg-zinc-800/80 p-4">
          <View className="flex-row gap-2">
            <View className="flex-1 rounded-lg bg-zinc-700/80 p-3">
              <Text className="text-xs text-zinc-500">From</Text>
              <Text className="text-sm text-zinc-400">Select token</Text>
            </View>
            <View className="items-center justify-center">
              <Ionicons name="swap-horizontal" size={20} color="#71717a" />
            </View>
            <View className="flex-1 rounded-lg bg-zinc-700/80 p-3">
              <Text className="text-xs text-zinc-500">To</Text>
              <Text className="text-sm text-zinc-400">Select token</Text>
            </View>
          </View>
          <Text className="mt-3 text-xs text-zinc-500">Available when crypto is integrated.</Text>
        </View>
      </View>
      <View className="px-4 py-4">
        <Text className="text-sm font-semibold text-zinc-400">NFT viewer</Text>
        <View className="mt-2 rounded-xl border border-zinc-700/80 bg-zinc-800/80 p-6 items-center">
          <Text className="text-zinc-500">No NFTs loaded</Text>
        </View>
      </View>
    </ScrollView>
  );
}

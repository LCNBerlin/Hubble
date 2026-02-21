import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UpgradeStorageScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-zinc-950" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center border-b border-zinc-800 px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={24} color="#e4e4e7" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-zinc-100">Upgrade Plan</Text>
      </View>
      <View className="flex-1 items-center justify-center px-8">
        <Ionicons name="cloud-download-outline" size={64} color="#71717a" />
        <Text className="mt-4 text-center text-lg font-medium text-zinc-200">
          Get more storage
        </Text>
        <Text className="mt-2 text-center text-zinc-500">
          Storage upgrade options will appear here.
        </Text>
      </View>
    </View>
  );
}

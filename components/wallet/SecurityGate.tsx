import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

export function SecurityGate({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
        <Pressable
          className="rounded-t-2xl bg-zinc-900 border-t border-zinc-700 max-h-[80%]"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-zinc-700 px-4 py-3">
            <Text className="text-lg font-semibold text-zinc-100">Security</Text>
            <Pressable onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#71717a" />
            </Pressable>
          </View>
          <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
            <View className="mb-4">
              <Text className="text-sm font-semibold text-zinc-300">Two-factor authentication</Text>
              <Text className="mt-1 text-xs text-zinc-500">—</Text>
            </View>
            <View className="mb-4">
              <Text className="text-sm font-semibold text-zinc-300">Withdrawal limits</Text>
              <Text className="mt-1 text-xs text-zinc-500">—</Text>
            </View>
            <View className="mb-4">
              <Text className="text-sm font-semibold text-zinc-300">Whitelisted addresses</Text>
              <Text className="mt-1 text-xs text-zinc-500">—</Text>
            </View>
            <View className="mb-4">
              <Text className="text-sm font-semibold text-red-400/90">Freeze wallet</Text>
              <Text className="mt-1 text-xs text-zinc-500">—</Text>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

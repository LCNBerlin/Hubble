import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";

type ModalShellProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  transparent?: boolean;
  animationType?: "none" | "slide" | "fade";
};

export function ModalShell({
  visible,
  title,
  onClose,
  children,
  transparent = true,
  animationType = "slide",
}: ModalShellProps) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent={transparent} animationType={animationType} onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        <Pressable className="max-h-[70%] rounded-t-2xl border-t border-zinc-700 bg-zinc-900" onPress={(e) => e.stopPropagation()}>
          <View className="border-b border-zinc-700/80 px-4 py-3 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-white">{title}</Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#a1a1aa" />
            </TouchableOpacity>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

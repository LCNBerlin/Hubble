import { Ionicons } from "@expo/vector-icons";
import { useCallback } from "react";
import { Alert, Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import supabase from "../lib/supabase";

export type ReportProfileModalProps = {
  visible: boolean;
  reportedId: string | null;
  onClose: () => void;
};

export function ReportProfileModal({ visible, reportedId, onClose }: ReportProfileModalProps) {
  const { user } = useAuth();
  const reasons = ["Spam", "Harassment", "Inappropriate content", "Other"];

  const handleReport = useCallback(
    async (reason: string) => {
      if (supabase && user?.id && reportedId) {
        await supabase.from("reports").insert({
          reporter_id: user.id,
          reported_id: reportedId,
          reason,
        });
      }
      onClose();
      Alert.alert("Report submitted", "Thank you. We'll review this profile.");
    },
    [user?.id, reportedId, onClose]
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable className="flex-1 justify-center bg-black/60 px-6" onPress={onClose}>
        <Pressable className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5" onPress={(e) => e.stopPropagation()}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-zinc-100">Report profile</Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={22} color="#a1a1aa" />
            </TouchableOpacity>
          </View>
          {reasons.map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => handleReport(r)}
              className="py-3 border-b border-zinc-800 last:border-0 active:opacity-80"
            >
              <Text className="text-zinc-200">{r}</Text>
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

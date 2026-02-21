import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCommunity } from "../../context/CommunityContext";
import { useMessaging } from "../../context/MessagingContext";
import { useMessagingLayout as useLayout } from "../../hooks/useMessagingLayout";
import type { ReactNode } from "react";

type MessagingLayoutProps = {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
};

export function MessagingLayout({ leftPanel, centerPanel, rightPanel }: MessagingLayoutProps) {
  const insets = useSafeAreaInsets();
  const { selectedCommunity, setSelectedCommunityId } = useCommunity();
  const { crmCollapsed, crmOpen, closeCRM, view } = useMessaging();
  const layout = useLayout(crmCollapsed);

  const banner = selectedCommunity ? (
    <View className="flex-row items-center justify-between border-b border-zinc-800 bg-zinc-800/60 px-3 py-2">
      <Text className="text-sm text-zinc-300" numberOfLines={1}>
        Viewing {selectedCommunity.displayName}&apos;s community
      </Text>
      <Pressable onPress={() => setSelectedCommunityId(null)} className="rounded-full p-2">
        <Ionicons name="close" size={20} color="#71717a" />
      </Pressable>
    </View>
  ) : null;

  if (layout.threePanel) {
    return (
      <View
        className="flex-1 bg-zinc-950"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        {banner}
        <View className="flex-1 flex-row">
          <View style={{ flex: layout.conversationsFlex, minWidth: 0 }}>
            {leftPanel}
          </View>
        <View style={{ flex: layout.chatFlex, minWidth: 0 }}>
          {centerPanel}
        </View>
          <View
            style={{
              flex: layout.crmFlex,
              minWidth: layout.crmFlex > 0 ? 1 : 0,
              overflow: "hidden",
            }}
          >
            {rightPanel}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-zinc-950"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {banner}
      {view === "list" && <View className="flex-1">{leftPanel}</View>}
      {view === "chat" && (
        <View className="flex-1">
          {centerPanel}
          <Modal visible={crmOpen} animationType="slide" transparent>
            <View className="flex-1 flex-row">
              <Pressable className="flex-1 bg-black/40" onPress={closeCRM} />
              <View
                className="w-[85%] max-w-md bg-zinc-900"
                style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
              >
                {rightPanel}
              </View>
            </View>
          </Modal>
        </View>
      )}
    </View>
  );
}

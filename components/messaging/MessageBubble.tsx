import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, Text, View } from "react-native";
import { Avatar } from "../ui/Avatar";
import type { Message } from "../../lib/conversations";

type MessageBubbleProps = {
  message: Message;
  isOwn: boolean;
  onReply: () => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onEnterSelectMode?: (messageId: string) => void;
};

export function MessageBubble({ message, isOwn, onReply, selectMode, selected, onToggleSelect, onEnterSelectMode }: MessageBubbleProps) {
  const handleLongPress = () => {
    if (selectMode && onToggleSelect) {
      onToggleSelect();
      return;
    }
    if (selectMode) return;
    Alert.alert(
      "Message",
      undefined,
      [
        { text: "Select multiple", onPress: () => onEnterSelectMode?.(message.id) },
        { text: "Copy", onPress: () => {} },
        { text: "Delete", onPress: () => {}, style: "destructive" },
        { text: "Translate", onPress: () => {} },
        { text: "Pin", onPress: () => {} },
        { text: "Reply", onPress: onReply },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handlePress = () => {
    if (selectMode && onToggleSelect) onToggleSelect();
  };

  if (message.type === "system") {
    return (
      <View className="my-1 items-center">
        <Text className="text-xs text-zinc-500">{message.body}</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      className={`my-1 flex-row items-center ${isOwn ? "justify-end" : "justify-start"} px-3`}
    >
      {selectMode && (
        <View className="mr-2">
          <View
            className={`h-5 w-5 items-center justify-center rounded border-2 ${
              selected ? "border-violet-500 bg-violet-500" : "border-zinc-500"
            }`}
          >
            {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
        </View>
      )}
      {!isOwn && !selectMode && (
        <View className="mr-2">
          <Avatar uri={null} size={28} />
        </View>
      )}
      <View
        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
          isOwn ? "bg-violet-600" : "bg-zinc-800"
        } ${selected ? "opacity-90 ring-2 ring-violet-500" : ""}`}
      >
        {message.parent_id ? (
          <View className="mb-1 border-l-2 border-zinc-500 pl-2">
            <Text className="text-xs text-zinc-400">Reply</Text>
          </View>
        ) : null}
        <Text className={`text-[15px] ${isOwn ? "text-white" : "text-zinc-100"}`}>
          {message.body}
        </Text>
      </View>
    </Pressable>
  );
}

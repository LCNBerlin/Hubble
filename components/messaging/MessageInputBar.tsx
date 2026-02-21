import { Ionicons } from "@expo/vector-icons";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";

const MIN_HEIGHT = 44;

type MessageInputBarProps = {
  onSend: (text: string) => void;
  disabled?: boolean;
  inputBarRef?: React.Ref<{ submit: () => void } | null>;
};

export function MessageInputBar({ onSend, disabled, inputBarRef }: MessageInputBarProps) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };

  useImperativeHandle(inputBarRef, () => ({ submit: handleSend }), [text, disabled, onSend]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [text, disabled, onSend]);

  return (
    <View
      className="flex-row items-end gap-2 border-t border-zinc-800 bg-zinc-900 px-3 py-2"
      style={{ minHeight: MIN_HEIGHT + 16 }}
    >
      <View className="flex-row items-center gap-1">
        <Pressable accessibilityLabel="Attachment" className="rounded-full p-2" style={{ minHeight: MIN_HEIGHT, minWidth: MIN_HEIGHT }}>
          <Ionicons name="add-circle-outline" size={24} color="#a1a1aa" />
        </Pressable>
        <Pressable accessibilityLabel="Attach file" className="rounded-full p-2" style={{ minHeight: MIN_HEIGHT, minWidth: MIN_HEIGHT }}>
          <Ionicons name="document-attach-outline" size={22} color="#a1a1aa" />
        </Pressable>
        <Pressable accessibilityLabel="Voice note" className="rounded-full p-2" style={{ minHeight: MIN_HEIGHT, minWidth: MIN_HEIGHT }}>
          <Ionicons name="mic-outline" size={22} color="#a1a1aa" />
        </Pressable>
        <Pressable accessibilityLabel="Contract" className="rounded-full p-2" style={{ minHeight: MIN_HEIGHT, minWidth: MIN_HEIGHT }}>
          <Ionicons name="document-text-outline" size={22} color="#a1a1aa" />
        </Pressable>
        <Pressable accessibilityLabel="Payment request" className="rounded-full p-2" style={{ minHeight: MIN_HEIGHT, minWidth: MIN_HEIGHT }}>
          <Ionicons name="card-outline" size={22} color="#a1a1aa" />
        </Pressable>
      </View>
      <View className="flex-1 flex-row items-center rounded-2xl bg-zinc-800 px-3 py-2" style={{ minHeight: MIN_HEIGHT }}>
        <TextInput
          className="flex-1 text-base text-zinc-100"
          placeholder="Message"
          placeholderTextColor="#71717a"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={4000}
          editable={!disabled}
        />
      </View>
      <View className="flex-row items-center gap-1">
        <Pressable accessibilityLabel="Emoji" className="rounded-full p-2" style={{ minHeight: MIN_HEIGHT, minWidth: MIN_HEIGHT }}>
          <Ionicons name="happy-outline" size={22} color="#a1a1aa" />
        </Pressable>
        <Pressable accessibilityLabel="Encryption toggle" className="rounded-full p-2" style={{ minHeight: MIN_HEIGHT, minWidth: MIN_HEIGHT }}>
          <Ionicons name="lock-closed-outline" size={20} color="#a1a1aa" />
        </Pressable>
        <Pressable
          accessibilityLabel="Send"
          onPress={handleSend}
          disabled={disabled}
          className="rounded-full bg-violet-600 p-2"
          style={{ minHeight: MIN_HEIGHT, minWidth: MIN_HEIGHT }}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

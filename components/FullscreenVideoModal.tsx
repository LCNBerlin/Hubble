import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useWindowDimensions } from "react-native";
import { Modal, TouchableOpacity, View } from "react-native";

type FullscreenVideoModalProps = {
  visible: boolean;
  videoUri: string | null;
  onClose: () => void;
};

export function FullscreenVideoModal({ visible, videoUri, onClose }: FullscreenVideoModalProps) {
  const { width, height } = useWindowDimensions();
  const player = useVideoPlayer(visible && videoUri ? videoUri : null, (p) => {
    p.muted = false;
  });

  if (!visible || !videoUri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 bg-black">
        <VideoView
          player={player}
          style={{ width, height }}
          contentFit="contain"
          nativeControls
        />
        <TouchableOpacity
          onPress={onClose}
          className="absolute right-4 top-12 rounded-full bg-black/60 p-2"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

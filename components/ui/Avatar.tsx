import { Image } from "expo-image";
import { View } from "react-native";
import { CREATOR_AVATAR } from "../../lib/constants";

type AvatarProps = {
  uri: string | null;
  size?: number;
  className?: string;
};

export function Avatar({ uri, size = 36, className }: AvatarProps) {
  return (
    <Image
      source={uri ? { uri } : CREATOR_AVATAR}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      contentFit="cover"
      className={className}
    />
  );
}

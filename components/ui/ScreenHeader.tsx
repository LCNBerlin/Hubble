import { Text, View } from "react-native";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
};

export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  return (
    <View className="border-b border-zinc-800 px-4 pb-3 pt-14">
      <Text className="text-2xl font-bold text-zinc-100">{title}</Text>
      {subtitle ? <Text className="text-sm text-zinc-500">{subtitle}</Text> : null}
    </View>
  );
}

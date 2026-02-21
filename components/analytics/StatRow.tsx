import { Text, View } from "react-native";

type StatRowProps = {
  label: string;
  value: string | number;
};

export function StatRow({ label, value }: StatRowProps) {
  return (
    <View className="flex-row items-center justify-between border-b border-zinc-800/80 py-2.5">
      <Text className="text-sm text-zinc-400">{label}</Text>
      <Text className="text-sm font-medium text-zinc-100">{value}</Text>
    </View>
  );
}

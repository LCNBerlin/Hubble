import { Text, View } from "react-native";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
};

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <View style={{ marginBottom: 12, marginTop: 8 }}>
      <Text className="text-lg font-semibold text-zinc-100">{title}</Text>
      {subtitle ? <Text className="mt-0.5 text-sm text-zinc-500">{subtitle}</Text> : null}
    </View>
  );
}

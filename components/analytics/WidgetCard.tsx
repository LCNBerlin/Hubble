import { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";

type WidgetCardProps = {
  title: string;
  children?: ReactNode;
  loading?: boolean;
  comingSoon?: boolean;
};

export function WidgetCard({ title, children, loading, comingSoon }: WidgetCardProps) {
  return (
    <View className="mb-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
      <Text className="mb-3 text-base font-semibold text-zinc-100">{title}</Text>
      {loading ? (
        <View className="py-6">
          <ActivityIndicator size="small" color="#a78bfa" />
        </View>
      ) : comingSoon ? (
        <Text className="py-4 text-sm text-zinc-500">Coming soon.</Text>
      ) : (
        children
      )}
    </View>
  );
}

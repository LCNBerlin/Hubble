import { View } from "react-native";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className = "" }: CardProps) {
  return (
    <View className={`rounded-xl border border-zinc-700 bg-zinc-800/80 overflow-hidden ${className}`.trim()}>
      {children}
    </View>
  );
}

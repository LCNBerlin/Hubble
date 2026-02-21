import { Redirect } from "expo-router";
import { View } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <View className="flex-1 bg-zinc-950" />;
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Redirect href="/(tabs)/feed" />;
}

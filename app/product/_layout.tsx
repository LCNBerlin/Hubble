import { Stack } from "expo-router";

export default function ProductLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#09090b" },
      }}
    />
  );
}

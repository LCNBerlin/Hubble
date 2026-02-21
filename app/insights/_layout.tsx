import { Stack } from "expo-router";

export default function InsightsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: "Back",
        headerTintColor: "#e4e4e7",
        headerStyle: { backgroundColor: "#09090b" },
        headerTitleStyle: { color: "#e4e4e7", fontWeight: "600" },
        contentStyle: { backgroundColor: "#09090b" },
      }}
    >
      <Stack.Screen name="engagement" options={{ title: "Engagement Analytics" }} />
      <Stack.Screen name="income" options={{ title: "Income Analytics" }} />
    </Stack>
  );
}

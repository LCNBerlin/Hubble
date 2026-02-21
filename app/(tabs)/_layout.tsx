import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { HudTopBar } from "../../components/HudTopBar";

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <HudTopBar />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#a78bfa",
          tabBarInactiveTintColor: "#71717a",
          tabBarShowLabel: true,
          tabBarStyle: {
            backgroundColor: "#18181b",
            borderTopColor: "#27272a",
            borderTopWidth: 1,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "500",
          },
        }}
      >
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen
          name="feed"
          options={{
            title: "feed",
            tabBarLabel: "feed",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="newspaper-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="marketplace"
          options={{
            title: "Marketplace",
            tabBarLabel: "Marketplace",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="storefront-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="cart" options={{ href: null }} />
        <Tabs.Screen name="wishlist" options={{ href: null }} />
        <Tabs.Screen
          name="create"
          options={{
            title: "Creator Studio",
            href: null,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "profile",
            tabBarLabel: "profile",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tv"
          options={{
            title: "TV",
            tabBarLabel: "TV",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="tv-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="cinema"
          options={{
            title: "Cinema",
            href: null,
          }}
        />
        <Tabs.Screen
          name="storage"
          options={{
            title: "Storage",
            tabBarLabel: "Storage",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="folder-open-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: "Messages",
            href: null,
          }}
        />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="wallet" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

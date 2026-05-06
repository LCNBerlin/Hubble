import { Redirect, Stack, useRouter, useSegments } from "expo-router";
import { ReactNode, useEffect, useRef } from "react";
import { Linking, LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { addNotificationResponseListener } from "../lib/pushNotifications";

// Suppress SafeAreaView deprecation warning from dependencies (e.g. @stripe/stripe-react-native).
// The app uses react-native-safe-area-context everywhere; the warning is from a third-party.
LogBox.ignoreLogs([
  "SafeAreaView has been deprecated and will be removed in a future release",
]);
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  getStoredReferralRef,
  recordReferralClick,
  resolveReferralCodeToReferrerId,
  setStoredReferralRef,
} from "../lib/referral";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { CommunityProvider } from "../context/CommunityContext";
import { NotificationsProvider } from "../context/NotificationsContext";
import { CartProvider } from "../context/CartContext";
import { ContentProvider } from "../context/ContentContext";
import { ProfileProvider } from "../context/ProfileContext";
import { WishlistProvider } from "../context/WishlistContext";
import { StripeWrapper } from "../components/StripeWrapper";
import "./globals.css";

function AuthGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const segments = useSegments();

  if (isLoading) {
    return <View className="flex-1 bg-zinc-950" />;
  }

  const isAuthRoute = segments[0] === "(auth)";

  if (!user && !isAuthRoute) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user && isAuthRoute) {
    return <Redirect href="/(tabs)/feed" />;
  }

  return <>{children}</>;
}

function PushNotificationHandler() {
  const router = useRouter();
  useEffect(() => {
    const remove = addNotificationResponseListener(() => {
      router.push("/(tabs)/notifications");
    });
    return remove;
  }, [router]);
  return null;
}

function ReferralRefCapture() {
  const { user } = useAuth();
  const recordedClickForRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const url = await Linking.getInitialURL();
        if (url) {
          const match = url.match(/[?&]ref=([^&]+)/);
          const ref = match ? decodeURIComponent(match[1].trim()) : null;
          if (ref) await setStoredReferralRef(ref);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    if (!user || recordedClickForRef.current) return;
    (async () => {
      try {
        const ref = await getStoredReferralRef();
        if (!ref) return;
        const referrerId = await resolveReferralCodeToReferrerId(ref);
        if (referrerId) {
          await recordReferralClick(referrerId, ref);
          recordedClickForRef.current = true;
        }
      } catch {
        // ignore
      }
    })();
  }, [user]);
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ContentProvider>
            <ProfileProvider>
              <CartProvider>
                <WishlistProvider>
                  <ReferralRefCapture />
                  <StripeWrapper>
                    <AuthGate>
                      <PushNotificationHandler />
                      <CommunityProvider>
                        <NotificationsProvider>
                          <Stack screenOptions={{ headerShown: false }} />
                        </NotificationsProvider>
                      </CommunityProvider>
                    </AuthGate>
                  </StripeWrapper>
                </WishlistProvider>
              </CartProvider>
            </ProfileProvider>
          </ContentProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

import Constants from "expo-constants";
import { Redirect, Stack, useRouter, useSegments } from "expo-router";
import { ReactNode, useEffect, useRef } from "react";
import { Linking, LogBox, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { addNotificationResponseListener, registerPushToken } from "../lib/pushNotifications";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2, gcTime: 5 * 60_000 },
    mutations: { retry: 1 },
  },
});

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
import { StripeContextProvider, defaultStripeContext } from "../context/StripeContext";
import { STRIPE_PUBLISHABLE_KEY } from "../lib/config";
import "./globals.css";

const isExpoGo = Constants.appOwnership === "expo";

function StripeWrapper({ children }: { children: ReactNode }) {
  if (isExpoGo) {
    return <StripeContextProvider value={defaultStripeContext}>{children}</StripeContextProvider>;
  }
  try {
    const { StripeProvider, useStripe } = require("@stripe/stripe-react-native");
    function Inner({ innerChildren }: { innerChildren: ReactNode }) {
      const stripe = useStripe();
      return (
        <StripeContextProvider
          value={{
            initPaymentSheet: stripe.initPaymentSheet.bind(stripe),
            presentPaymentSheet: stripe.presentPaymentSheet.bind(stripe),
          }}
        >
          {innerChildren}
        </StripeContextProvider>
      );
    }
    return (
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <Inner innerChildren={children} />
      </StripeProvider>
    );
  } catch {
    return <StripeContextProvider value={defaultStripeContext}>{children}</StripeContextProvider>;
  }
}

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
  const { user } = useAuth();
  useEffect(() => {
    const remove = addNotificationResponseListener(() => {
      router.push("/(tabs)/notifications");
    });
    return remove;
  }, [router]);
  useEffect(() => {
    if (!user?.id) return;
    registerPushToken(user.id).catch((err) => {
      if (__DEV__) console.warn("[push] registerPushToken failed:", err);
    });
  }, [user?.id]);
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
      } catch {}
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
      } catch {}
    })();
  }, [user]);
  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <ReferralRefCapture />
            <StripeWrapper>
              <AuthGate>
                <PushNotificationHandler />
                    <Stack screenOptions={{ headerShown: false }} />
              </AuthGate>
            </StripeWrapper>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import supabase from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request permission and get Expo push token. Returns null if not a physical device or permission denied.
 */
export async function getExpoPushTokenAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }
  if (final !== "granted") return null;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenResult?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Register the current device's Expo push token for the user so they receive push notifications.
 * Call after login. Idempotent: upserts into push_tokens so the same token is not duplicated.
 */
export async function registerPushToken(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Supabase not configured" };
  const token = await getExpoPushTokenAsync();
  if (!token) {
    if (__DEV__) console.warn("[push] No Expo push token (use a physical device, grant notification permission)");
    return { ok: true };
  }

  const { error } = await supabase.from("push_tokens").upsert(
    { user_id: userId, expo_push_token: token },
    { onConflict: "user_id,expo_push_token" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Optional: when user taps a notification, navigate. Call from root layout or a provider.
 */
export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(handler);
  return () => sub.remove();
}

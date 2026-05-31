import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { apiPost } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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
    const tokenResult = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return tokenResult?.data ?? null;
  } catch {
    return null;
  }
}

export async function registerPushToken(_userId: string): Promise<{ ok: boolean; error?: string }> {
  const token = await getExpoPushTokenAsync();
  if (!token) {
    if (__DEV__) console.warn("[push] No Expo push token (use a physical device, grant notification permission)");
    return { ok: true };
  }
  try {
    await apiPost("/notifications/push-token", { token });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(handler);
  return () => sub.remove();
}

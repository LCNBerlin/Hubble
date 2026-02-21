import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { getUnreadNotificationCount, subscribeToNotifications } from "../lib/notifications";
import { registerPushToken } from "../lib/pushNotifications";

type NotificationsContextType = {
  unreadCount: number;
  refresh: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    const n = await getUnreadNotificationCount(user.id);
    setUnreadCount(n);
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    const unsubscribe = subscribeToNotifications(user.id, refresh);
    return unsubscribe;
  }, [user?.id, refresh]);

  useEffect(() => {
    if (!user?.id) return;
    registerPushToken(user.id).catch((err) => {
      if (__DEV__) console.warn("[push] registerPushToken failed:", err);
    });
  }, [user?.id]);

  return (
    <NotificationsContext.Provider value={{ unreadCount, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext(): NotificationsContextType {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    return {
      unreadCount: 0,
      refresh: async () => {},
    };
  }
  return ctx;
}

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getUnreadNotificationCount } from "../lib/notifications";

export function useUnreadNotificationCount(): { count: number; refresh: () => Promise<void> } {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setCount(0);
      return;
    }
    const n = await getUnreadNotificationCount(user.id);
    setCount(n);
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { count, refresh };
}

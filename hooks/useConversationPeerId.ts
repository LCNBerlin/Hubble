import { useEffect, useState } from "react";
import { getConversationPeerUserId } from "../lib/conversations";

export function useConversationPeerId(
  conversationId: string | null,
  currentUserId: string | undefined
): string | null {
  const [peerId, setPeerId] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId || !currentUserId) {
      setPeerId(null);
      return;
    }
    let cancelled = false;
    getConversationPeerUserId(conversationId, currentUserId).then((id) => {
      if (!cancelled) setPeerId(id);
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId, currentUserId]);

  return peerId;
}

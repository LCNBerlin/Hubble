import { createContext, ReactNode, useCallback, useContext, useState } from "react";

export type MessagingView = "list" | "chat";

type MessagingContextValue = {
  selectedConversationId: string | null;
  setSelectedConversationId: (id: string | null) => void;
  crmOpen: boolean;
  setCrmOpen: (open: boolean) => void;
  crmCollapsed: boolean;
  setCrmCollapsed: (collapsed: boolean) => void;
  view: MessagingView;
  setView: (v: MessagingView) => void;
  openChat: (conversationId: string) => void;
  backToList: () => void;
  openCRM: () => void;
  closeCRM: () => void;
  toggleCRM: () => void;
};

const MessagingContext = createContext<MessagingContextValue | null>(null);

export function MessagingProvider({ children }: { children: ReactNode }) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [crmOpen, setCrmOpen] = useState(false);
  const [crmCollapsed, setCrmCollapsed] = useState(true);
  const [view, setView] = useState<MessagingView>("list");

  const openChat = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    setView("chat");
  }, []);

  const backToList = useCallback(() => {
    setView("list");
  }, []);

  const openCRM = useCallback(() => {
    setCrmOpen(true);
    setCrmCollapsed(false);
  }, []);

  const closeCRM = useCallback(() => {
    setCrmOpen(false);
    setCrmCollapsed(true);
  }, []);

  const toggleCRM = useCallback(() => {
    setCrmOpen((o) => !o);
    setCrmCollapsed((c) => !c);
  }, []);

  const value: MessagingContextValue = {
    selectedConversationId,
    setSelectedConversationId,
    crmOpen,
    setCrmOpen,
    crmCollapsed,
    setCrmCollapsed,
    view,
    setView,
    openChat,
    backToList,
    openCRM,
    closeCRM,
    toggleCRM,
  };

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

export function useMessaging() {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error("useMessaging must be used within MessagingProvider");
  return ctx;
}

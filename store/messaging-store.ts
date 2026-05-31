import { create } from "zustand";

export type MessagingView = "list" | "chat";
export type ConversationCategory = "all" | "priority" | "main" | "groups" | "escrow" | "bookings";

interface MessagingState {
  selectedConversationId: string | null;
  view: MessagingView;
  crmOpen: boolean;
  crmCollapsed: boolean;
  category: ConversationCategory;
  search: string;
  setSelectedConversationId: (id: string | null) => void;
  setView: (v: MessagingView) => void;
  setCrmOpen: (open: boolean) => void;
  setCrmCollapsed: (collapsed: boolean) => void;
  setCategory: (cat: ConversationCategory) => void;
  setSearch: (s: string) => void;
  openChat: (conversationId: string) => void;
  backToList: () => void;
  openCRM: () => void;
  closeCRM: () => void;
  toggleCRM: () => void;
}

export const useMessagingStore = create<MessagingState>((set) => ({
  selectedConversationId: null,
  view: "list",
  crmOpen: false,
  crmCollapsed: true,
  category: "all",
  search: "",
  setSelectedConversationId: (id) => set({ selectedConversationId: id }),
  setView: (v) => set({ view: v }),
  setCrmOpen: (open) => set({ crmOpen: open }),
  setCrmCollapsed: (collapsed) => set({ crmCollapsed: collapsed }),
  setCategory: (cat) => set({ category: cat }),
  setSearch: (s) => set({ search: s }),
  openChat: (conversationId) => set({ selectedConversationId: conversationId, view: "chat" }),
  backToList: () => set({ view: "list" }),
  openCRM: () => set({ crmOpen: true, crmCollapsed: false }),
  closeCRM: () => set({ crmOpen: false, crmCollapsed: true }),
  toggleCRM: (prev) => set((s) => ({ crmOpen: !s.crmOpen, crmCollapsed: !s.crmCollapsed })),
}));

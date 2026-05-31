import { create } from "zustand";

export type SelectedCommunity = { id: string; displayName: string };

interface CommunityState {
  selectedCommunityId: string | null;
  selectedCommunity: SelectedCommunity | null;
  setSelectedCommunityId: (id: string | null) => void;
  setSelectedCommunity: (community: SelectedCommunity | null) => void;
}

export const useCommunityStore = create<CommunityState>((set) => ({
  selectedCommunityId: null,
  selectedCommunity: null,
  setSelectedCommunityId: (id) => set({ selectedCommunityId: id, selectedCommunity: id === null ? null : undefined }),
  setSelectedCommunity: (community) => set({ selectedCommunity: community, selectedCommunityId: community?.id ?? null }),
}));

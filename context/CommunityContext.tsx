import { createContext, ReactNode, useContext, useState } from "react";

export type SelectedCommunity = { id: string; displayName: string };

type CommunityContextValue = {
  selectedCommunityId: string | null;
  selectedCommunity: SelectedCommunity | null;
  setSelectedCommunityId: (id: string | null) => void;
  setSelectedCommunity: (community: SelectedCommunity | null) => void;
};

const CommunityContext = createContext<CommunityContextValue | null>(null);

export function CommunityProvider({ children }: { children: ReactNode }) {
  const [selectedCommunity, setSelectedCommunityState] = useState<SelectedCommunity | null>(null);

  const setSelectedCommunityId = (id: string | null) => {
    if (id === null) setSelectedCommunityState(null);
  };

  const setSelectedCommunity = (community: SelectedCommunity | null) => {
    setSelectedCommunityState(community);
  };

  return (
    <CommunityContext.Provider
      value={{
        selectedCommunityId: selectedCommunity?.id ?? null,
        selectedCommunity,
        setSelectedCommunityId,
        setSelectedCommunity,
      }}
    >
      {children}
    </CommunityContext.Provider>
  );
}

export function useCommunity() {
  const ctx = useContext(CommunityContext);
  if (!ctx) throw new Error("useCommunity must be used within CommunityProvider");
  return ctx;
}

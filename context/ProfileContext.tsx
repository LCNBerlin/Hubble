import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";
import { uploadProfileImage } from "../lib/profileUpload";

const STORAGE_KEY = "hubble_profile";

export type VerifiedTier = "none" | "verified" | "enterprise";

export type Profile = {
  displayName: string;
  username: string;
  bio: string;
  links: string[];
  memberSince: number;
  verifiedTier: VerifiedTier;
  reputationScore: number;
  xp: number;
  level: number;
  badges: string[];
  onChainVisible: boolean;
  walletConnected: boolean;
  avatarUri?: string;
  bannerUri?: string;
  followersCount: number;
  followingCount: number;
  salesCount: number;
  ratingAverage: number;
  totalVolumeSold: number;
  nftCollectionsCount: number;
  stakingBadge: boolean;
  governanceBadge: boolean;
  location: string;
  lat?: number;
  lng?: number;
  categoryTags: string[];
  walletAddress: string;
  ensName: string;
  brandStatement: string;
  nicheClassification: string;
  valueProposition: string;
  affiliateCode: string;
  dmAccessEnabled: boolean;
  dmAccessPriceCents: number;
  stakingUrl: string;
  governanceUrl: string;
  equityPoolLabel: string;
  equityPoolUrl: string;
};

const DEFAULT_PROFILE: Profile = {
  displayName: "",
  username: "user",
  bio: "",
  links: [],
  memberSince: Date.now(),
  verifiedTier: "none",
  reputationScore: 0,
  xp: 0,
  level: 0,
  badges: [],
  onChainVisible: false,
  walletConnected: false,
  followersCount: 0,
  followingCount: 0,
  salesCount: 0,
  ratingAverage: 0,
  totalVolumeSold: 0,
  nftCollectionsCount: 0,
  stakingBadge: false,
  governanceBadge: false,
  location: "",
  categoryTags: [],
  walletAddress: "",
  ensName: "",
  brandStatement: "",
  nicheClassification: "",
  valueProposition: "",
  affiliateCode: "",
  dmAccessEnabled: false,
  dmAccessPriceCents: 0,
  stakingUrl: "",
  governanceUrl: "",
  equityPoolLabel: "",
  equityPoolUrl: "",
};

type ProfileContextType = {
  profile: Profile;
  updateProfile: (updates: Partial<Profile>) => void;
  isFollowing: boolean;
  follow: () => void;
  unfollow: () => void;
  viewedUserId: string | null;
  setViewedUser: (userId: string | null) => void;
  blockedUserIds: string[];
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
  savedPostIds: string[];
  savedProductIds: string[];
  toggleSavePost: (id: string) => void;
  toggleSaveProduct: (id: string) => void;
  profileLoadDone: boolean;
  refetchProfile: () => Promise<void>;
  updateAvatar: (base64: string, mimeType?: string) => Promise<string>;
  saveTagsToProfile: (tags: string[]) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextType | null>(null);

function dbRowToProfile(data: Record<string, unknown>, prev: Profile): Profile {
  const links = Array.isArray(data.links) ? (data.links as string[]).filter((u) => typeof u === "string" && !!u?.trim()) : [];
  const categoryTags = Array.isArray(data.category_tags) ? (data.category_tags as string[]).filter((t) => typeof t === "string" && !!t?.trim()) : [];
  return {
    ...prev,
    displayName: (data.display_name as string) ?? prev.displayName,
    username: (data.username as string) ?? prev.username,
    bio: (data.bio as string) ?? prev.bio,
    links,
    memberSince: data.created_at ? new Date(data.created_at as string).getTime() : prev.memberSince,
    avatarUri: (data.avatar_url as string) ?? prev.avatarUri,
    bannerUri: (data.banner_url as string) ?? prev.bannerUri,
    followersCount: (data.followers_count as number) ?? prev.followersCount,
    followingCount: (data.following_count as number) ?? prev.followingCount,
    location: (data.location as string) ?? prev.location ?? "",
    lat: (data.lat as number) ?? prev.lat,
    lng: (data.lng as number) ?? prev.lng,
    categoryTags,
    walletAddress: (data.wallet_address as string) ?? prev.walletAddress ?? "",
    ensName: (data.ens_name as string) ?? prev.ensName ?? "",
    onChainVisible: (data.on_chain_visible as boolean) ?? prev.onChainVisible,
    stakingBadge: (data.staking_badge as boolean) ?? prev.stakingBadge,
    governanceBadge: (data.governance_badge as boolean) ?? prev.governanceBadge,
    brandStatement: (data.brand_statement as string) ?? prev.brandStatement ?? "",
    nicheClassification: (data.niche_classification as string) ?? prev.nicheClassification ?? "",
    valueProposition: (data.value_proposition as string) ?? prev.valueProposition ?? "",
    affiliateCode: (data.affiliate_code as string) ?? prev.affiliateCode ?? "",
    dmAccessEnabled: (data.dm_access_enabled as boolean) ?? prev.dmAccessEnabled,
    dmAccessPriceCents: (data.dm_access_price_cents as number) ?? prev.dmAccessPriceCents ?? 0,
    stakingUrl: (data.staking_url as string) ?? prev.stakingUrl ?? "",
    governanceUrl: (data.governance_url as string) ?? prev.governanceUrl ?? "",
    equityPoolLabel: (data.equity_pool_label as string) ?? prev.equityPoolLabel ?? "",
    equityPoolUrl: (data.equity_pool_url as string) ?? prev.equityPoolUrl ?? "",
    verifiedTier: ((data.verified_tier as VerifiedTier) ?? "none") || "none",
    reputationScore: (data.reputation_score as number) ?? prev.reputationScore,
  };
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [isFollowing, setIsFollowing] = useState(false);
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [profileLoadDone, setProfileLoadDone] = useState(false);

  // Restore cached profile from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          setProfile((prev) => ({ ...DEFAULT_PROFILE, ...prev, ...data }));
        }
      } catch {}
      setHydrated(true);
    })();
  }, []);

  // Fetch live profile + saved/blocked from API when signed in
  useEffect(() => {
    if (!hydrated || !user?.id) {
      if (hydrated) setProfileLoadDone(true);
      return;
    }
    (async () => {
      try {
        const [profileData, savedData] = await Promise.all([
          apiGet<Record<string, unknown>>("/profiles/me"),
          apiGet<{ postIds: string[]; productIds: string[]; blockedIds: string[] }>("/profiles/me/saved"),
        ]);
        setProfile((prev) => dbRowToProfile(profileData, prev));
        setSavedPostIds(savedData.postIds ?? []);
        setSavedProductIds(savedData.productIds ?? []);
        setBlockedUserIds(savedData.blockedIds ?? []);
      } catch {}
      setProfileLoadDone(true);
    })();
  }, [user?.id, hydrated]);

  // Fetch follow state when viewing another user
  useEffect(() => {
    if (!user?.id || !viewedUserId) return;
    apiGet<{ isFollowing: boolean }>(`/profiles/${viewedUserId}/follow-status`)
      .then(({ isFollowing }) => setIsFollowing(isFollowing))
      .catch(() => {});
  }, [user?.id, viewedUserId]);

  // Persist profile to AsyncStorage cache on change
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile)).catch(() => {});
  }, [hydrated, profile]);

  const refetchProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await apiGet<Record<string, unknown>>("/profiles/me");
      setProfile((prev) => dbRowToProfile(data, prev));
    } catch {}
  }, [user?.id]);

  const updateProfile = useCallback((updates: Partial<Profile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  }, []);

  const follow = useCallback(async () => {
    if (!viewedUserId || !user?.id) return;
    setIsFollowing(true);
    setProfile((prev) => ({ ...prev, followersCount: prev.followersCount + 1 }));
    apiPost(`/profiles/${viewedUserId}/follow`).catch(() => {
      setIsFollowing(false);
      setProfile((prev) => ({ ...prev, followersCount: Math.max(0, prev.followersCount - 1) }));
    });
  }, [viewedUserId, user?.id]);

  const unfollow = useCallback(async () => {
    if (!viewedUserId || !user?.id) return;
    setIsFollowing(false);
    setProfile((prev) => ({ ...prev, followersCount: Math.max(0, prev.followersCount - 1) }));
    apiDelete(`/profiles/${viewedUserId}/follow`).catch(() => {
      setIsFollowing(true);
      setProfile((prev) => ({ ...prev, followersCount: prev.followersCount + 1 }));
    });
  }, [viewedUserId, user?.id]);

  const blockUser = useCallback(async (blockedId: string) => {
    if (!user?.id || blockedId === user.id || blockedUserIds.includes(blockedId)) return;
    setBlockedUserIds((prev) => [...prev, blockedId]);
    apiPost(`/profiles/${blockedId}/block`).catch(() => {
      setBlockedUserIds((prev) => prev.filter((id) => id !== blockedId));
    });
  }, [user?.id, blockedUserIds]);

  const unblockUser = useCallback(async (blockedId: string) => {
    if (!user?.id) return;
    setBlockedUserIds((prev) => prev.filter((id) => id !== blockedId));
    apiDelete(`/profiles/${blockedId}/block`).catch(() => {
      setBlockedUserIds((prev) => [...prev, blockedId]);
    });
  }, [user?.id]);

  const toggleSavePost = useCallback(async (id: string) => {
    if (!user?.id) return;
    const isSaved = savedPostIds.includes(id);
    setSavedPostIds(isSaved ? savedPostIds.filter((x) => x !== id) : [...savedPostIds, id]);
    apiPost<{ saved: boolean }>(`/profiles/me/save-post/${id}`).catch(() => {
      setSavedPostIds(savedPostIds);
    });
  }, [user?.id, savedPostIds]);

  const toggleSaveProduct = useCallback(async (id: string) => {
    if (!user?.id) return;
    const isSaved = savedProductIds.includes(id);
    setSavedProductIds(isSaved ? savedProductIds.filter((x) => x !== id) : [...savedProductIds, id]);
    apiPost<{ saved: boolean }>(`/profiles/me/save-product/${id}`).catch(() => {
      setSavedProductIds(savedProductIds);
    });
  }, [user?.id, savedProductIds]);

  const updateAvatar = useCallback(async (base64: string, mimeType?: string): Promise<string> => {
    if (!user?.id) throw new Error("Not authenticated");
    const { accessToken } = await import("../lib/api").then((m) => m.getStoredTokens());
    const url = await uploadProfileImage(user.id, "avatar", base64, mimeType, accessToken ?? undefined);
    await apiPatch("/profiles/me/avatar", { avatarUrl: url });
    await refetchProfile();
    return url;
  }, [user?.id, refetchProfile]);

  const saveTagsToProfile = useCallback(async (tags: string[]) => {
    if (!user?.id || !tags.length) return;
    const normalized = [...new Set(tags.map((t) => t.replace(/^#/, "").trim().toLowerCase()).filter(Boolean))];
    if (normalized.length === 0) return;
    setProfile((prev) => {
      const merged = [...new Set([...prev.categoryTags, ...normalized])];
      apiPatch("/profiles/me", { categoryTags: merged }).catch(() => {});
      return { ...prev, categoryTags: merged };
    });
  }, [user?.id]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        updateProfile,
        isFollowing,
        follow,
        unfollow,
        viewedUserId,
        setViewedUser: setViewedUserId,
        blockedUserIds,
        blockUser,
        unblockUser,
        savedPostIds,
        savedProductIds,
        toggleSavePost,
        toggleSaveProduct,
        profileLoadDone,
        refetchProfile,
        updateAvatar,
        saveTagsToProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}

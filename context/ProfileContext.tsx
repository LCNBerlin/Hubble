import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import supabase from "../lib/supabase";

const STORAGE_KEY = "hubble_profile";
const BLOCKED_STORAGE_KEY = "hubble_blocked";
const SAVED_STORAGE_KEY = "hubble_saved";

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
  lat: undefined,
  lng: undefined,
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

type SavedIds = { postIds: string[]; productIds: string[] };

type ProfileContextType = {
  profile: Profile;
  updateProfile: (updates: Partial<Profile>) => void;
  isFollowing: boolean;
  follow: () => void;
  unfollow: () => void;
  /** When set (e.g. on creator profile page), follow state is for this user and persisted to Supabase. */
  viewedUserId: string | null;
  setViewedUser: (userId: string | null) => void;
  blockedUserIds: string[];
  blockUser: (userId: string) => void;
  unblockUser: (userId: string) => void;
  savedPostIds: string[];
  savedProductIds: string[];
  toggleSavePost: (id: string) => void;
  toggleSaveProduct: (id: string) => void;
  /** True after first Supabase profile fetch has completed (or when not signed in). Use to avoid flashing default profile. */
  profileLoadDone: boolean;
  /** Refetch current user profile from Supabase (e.g. after uploading avatar/banner so the profile tab shows the latest). */
  refetchProfile: () => Promise<void>;
  /** Merge tags into profile categoryTags and persist to Supabase. Use for "Save tags" in create/edit product or post. */
  saveTagsToProfile: (tags: string[]) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextType | null>(null);

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

  useEffect(() => {
    (async () => {
      try {
        const [raw, blockedRaw, savedRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(BLOCKED_STORAGE_KEY),
          AsyncStorage.getItem(SAVED_STORAGE_KEY),
        ]);
        if (raw) {
          const data = JSON.parse(raw);
          setProfile((prev) => ({ ...DEFAULT_PROFILE, ...prev, ...data }));
        }
        if (blockedRaw) {
          const ids = JSON.parse(blockedRaw);
          if (Array.isArray(ids)) setBlockedUserIds(ids);
        }
        if (savedRaw) {
          const saved: SavedIds = JSON.parse(savedRaw);
          if (Array.isArray(saved?.postIds)) setSavedPostIds(saved.postIds);
          if (Array.isArray(saved?.productIds)) setSavedProductIds(saved.productIds);
        }
      } catch {
        // ignore
      }
      setHydrated(true);
    })();
  }, []);

  // Load current user's profile from Supabase when signed in
  useEffect(() => {
    if (!hydrated) return;
    if (!supabase || !user?.id) {
      setProfileLoadDone(true);
      return;
    }
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        const rawLinks = data.links;
        const links = Array.isArray(rawLinks) ? rawLinks.filter((u): u is string => typeof u === "string" && !!u?.trim()) : [];
        const rawTags = data.category_tags;
        const categoryTags = Array.isArray(rawTags) ? rawTags.filter((t): t is string => typeof t === "string" && !!t?.trim()) : [];
        setProfile((prev) => ({
          ...prev,
          displayName: data.display_name ?? prev.displayName,
          username: data.username ?? prev.username,
          bio: data.bio ?? prev.bio,
          links,
          memberSince: data.created_at ? new Date(data.created_at).getTime() : prev.memberSince,
          avatarUri: data.avatar_url ?? prev.avatarUri,
          bannerUri: data.banner_url ?? prev.bannerUri,
          followersCount: data.followers_count ?? prev.followersCount,
          followingCount: data.following_count ?? prev.followingCount,
          location: data.location ?? prev.location ?? "",
          lat: data.lat ?? prev.lat,
          lng: data.lng ?? prev.lng,
          categoryTags,
          walletAddress: data.wallet_address ?? prev.walletAddress ?? "",
          ensName: data.ens_name ?? prev.ensName ?? "",
          onChainVisible: data.on_chain_visible ?? prev.onChainVisible,
          stakingBadge: data.staking_badge ?? prev.stakingBadge,
          governanceBadge: data.governance_badge ?? prev.governanceBadge,
          brandStatement: data.brand_statement ?? prev.brandStatement ?? "",
          nicheClassification: data.niche_classification ?? prev.nicheClassification ?? "",
          valueProposition: data.value_proposition ?? prev.valueProposition ?? "",
          affiliateCode: data.affiliate_code ?? prev.affiliateCode ?? "",
          dmAccessEnabled: data.dm_access_enabled ?? prev.dmAccessEnabled,
          dmAccessPriceCents: data.dm_access_price_cents ?? prev.dmAccessPriceCents ?? 0,
          stakingUrl: data.staking_url ?? prev.stakingUrl ?? "",
          governanceUrl: data.governance_url ?? prev.governanceUrl ?? "",
          equityPoolLabel: data.equity_pool_label ?? prev.equityPoolLabel ?? "",
          equityPoolUrl: data.equity_pool_url ?? prev.equityPoolUrl ?? "",
        }));
      }
      setProfileLoadDone(true);
    })();
  }, [user?.id, hydrated]);

  const refetchProfile = useCallback(async () => {
    if (!supabase || !user?.id) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) {
      const rawLinks = data.links;
      const links = Array.isArray(rawLinks) ? rawLinks.filter((u): u is string => typeof u === "string" && !!u?.trim()) : [];
      const rawTags = data.category_tags;
      const categoryTags = Array.isArray(rawTags) ? rawTags.filter((t): t is string => typeof t === "string" && !!t?.trim()) : [];
      setProfile((prev) => ({
        ...prev,
        displayName: data.display_name ?? prev.displayName,
        username: data.username ?? prev.username,
        bio: data.bio ?? prev.bio,
        links,
        memberSince: data.created_at ? new Date(data.created_at).getTime() : prev.memberSince,
        avatarUri: data.avatar_url ?? prev.avatarUri,
        bannerUri: data.banner_url ?? prev.bannerUri,
        followersCount: data.followers_count ?? prev.followersCount,
        followingCount: data.following_count ?? prev.followingCount,
        location: data.location ?? prev.location ?? "",
        lat: data.lat ?? prev.lat,
        lng: data.lng ?? prev.lng,
        categoryTags,
        walletAddress: data.wallet_address ?? prev.walletAddress ?? "",
        ensName: data.ens_name ?? prev.ensName ?? "",
        onChainVisible: data.on_chain_visible ?? prev.onChainVisible,
        stakingBadge: data.staking_badge ?? prev.stakingBadge,
        governanceBadge: data.governance_badge ?? prev.governanceBadge,
        brandStatement: data.brand_statement ?? prev.brandStatement ?? "",
        nicheClassification: data.niche_classification ?? prev.nicheClassification ?? "",
        valueProposition: data.value_proposition ?? prev.valueProposition ?? "",
        affiliateCode: data.affiliate_code ?? prev.affiliateCode ?? "",
        dmAccessEnabled: data.dm_access_enabled ?? prev.dmAccessEnabled,
        dmAccessPriceCents: data.dm_access_price_cents ?? prev.dmAccessPriceCents ?? 0,
        stakingUrl: data.staking_url ?? prev.stakingUrl ?? "",
        governanceUrl: data.governance_url ?? prev.governanceUrl ?? "",
        equityPoolLabel: data.equity_pool_label ?? prev.equityPoolLabel ?? "",
        equityPoolUrl: data.equity_pool_url ?? prev.equityPoolUrl ?? "",
      }));
    }
  }, [user?.id]);

  // Sync saved posts from Supabase when signed in
  useEffect(() => {
    if (!supabase || !user?.id || !hydrated) return;
    (async () => {
      const { data, error } = await supabase
        .from("saved_posts")
        .select("post_id")
        .eq("user_id", user.id);
      if (!error && Array.isArray(data)) {
        setSavedPostIds(data.map((r: { post_id: string }) => r.post_id));
      }
    })();
  }, [user?.id, hydrated]);

  // Sync blocked users from Supabase when signed in
  useEffect(() => {
    if (!supabase || !user?.id || !hydrated) return;
    (async () => {
      const { data, error } = await supabase
        .from("blocked_users")
        .select("blocked_id")
        .eq("user_id", user.id);
      if (!error && Array.isArray(data)) {
        setBlockedUserIds(data.map((r: { blocked_id: string }) => r.blocked_id));
      }
    })();
  }, [user?.id, hydrated]);

  // Sync saved products from Supabase when signed in
  useEffect(() => {
    if (!supabase || !user?.id || !hydrated) return;
    (async () => {
      const { data, error } = await supabase
        .from("saved_products")
        .select("product_id")
        .eq("user_id", user.id);
      if (!error && Array.isArray(data)) {
        setSavedProductIds(data.map((r: { product_id: string }) => r.product_id));
      }
    })();
  }, [user?.id, hydrated]);

  // When viewing another user's profile: fetch follow state and persist follow/unfollow to Supabase
  useEffect(() => {
    if (!supabase || !user?.id || !viewedUserId) return;
    (async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", viewedUserId)
        .maybeSingle();
      setIsFollowing(!!data);
    })();
  }, [user?.id, viewedUserId]);

  const setViewedUser = useCallback((userId: string | null) => {
    setViewedUserId(userId);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const save = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      } catch {
        // ignore
      }
    };
    save();
  }, [hydrated, profile]);

  useEffect(() => {
    if (!hydrated) return;
    const save = async () => {
      try {
        await AsyncStorage.setItem(BLOCKED_STORAGE_KEY, JSON.stringify(blockedUserIds));
      } catch {
        // ignore
      }
    };
    save();
  }, [hydrated, blockedUserIds]);

  useEffect(() => {
    if (!hydrated) return;
    const save = async () => {
      try {
        await AsyncStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify({ postIds: savedPostIds, productIds: savedProductIds }));
      } catch {
        // ignore
      }
    };
    save();
  }, [hydrated, savedPostIds, savedProductIds]);

  const updateProfile = useCallback((updates: Partial<Profile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  }, []);

  const follow = useCallback(async () => {
    if (viewedUserId && supabase && user?.id) {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: viewedUserId });
    }
    setIsFollowing(true);
    setProfile((prev) => ({
      ...prev,
      followersCount: Math.max(0, prev.followersCount + 1),
    }));
  }, [viewedUserId, user?.id]);

  const unfollow = useCallback(async () => {
    if (viewedUserId && supabase && user?.id) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", viewedUserId);
    }
    setIsFollowing(false);
    setProfile((prev) => ({
      ...prev,
      followersCount: Math.max(0, prev.followersCount - 1),
    }));
  }, [viewedUserId, user?.id]);

  const blockUser = useCallback(
    async (blockedId: string) => {
      if (!supabase || !user?.id || blockedId === user.id || blockedUserIds.includes(blockedId)) return;
      setBlockedUserIds((prev) => [...prev, blockedId]);
      const { error } = await supabase.from("blocked_users").insert({ user_id: user.id, blocked_id: blockedId });
      if (error) setBlockedUserIds((prev) => prev.filter((id) => id !== blockedId));
    },
    [user?.id, blockedUserIds]
  );

  const unblockUser = useCallback(
    async (blockedId: string) => {
      if (!supabase || !user?.id) return;
      setBlockedUserIds((prev) => prev.filter((id) => id !== blockedId));
      await supabase.from("blocked_users").delete().eq("user_id", user.id).eq("blocked_id", blockedId);
    },
    [user?.id]
  );

  const toggleSavePost = useCallback(
    async (id: string) => {
      if (!supabase || !user?.id) return;
      const isSaved = savedPostIds.includes(id);
      const next = isSaved ? savedPostIds.filter((x) => x !== id) : [...savedPostIds, id];
      setSavedPostIds(next);
      if (isSaved) {
        const { error } = await supabase.from("saved_posts").delete().eq("user_id", user.id).eq("post_id", id);
        if (error) setSavedPostIds(savedPostIds);
      } else {
        const { error } = await supabase.from("saved_posts").insert({ user_id: user.id, post_id: id });
        if (error) setSavedPostIds(savedPostIds);
      }
    },
    [user?.id, savedPostIds]
  );

  const toggleSaveProduct = useCallback(
    async (id: string) => {
      if (!supabase || !user?.id) return;
      const isSaved = savedProductIds.includes(id);
      const next = isSaved ? savedProductIds.filter((x) => x !== id) : [...savedProductIds, id];
      setSavedProductIds(next);
      if (isSaved) {
        const { error } = await supabase.from("saved_products").delete().eq("user_id", user.id).eq("product_id", id);
        if (error) setSavedProductIds(savedProductIds);
      } else {
        const { error } = await supabase.from("saved_products").insert({ user_id: user.id, product_id: id });
        if (error) setSavedProductIds(savedProductIds);
      }
    },
    [user?.id, savedProductIds]
  );

  const saveTagsToProfile = useCallback(
    async (tags: string[]) => {
      if (!supabase || !user?.id || !tags.length) return;
      const normalized = [...new Set(tags.map((t) => t.replace(/^#/, "").trim().toLowerCase()).filter(Boolean))];
      if (normalized.length === 0) return;
      setProfile((prev) => {
        const merged = [...new Set([...prev.categoryTags, ...normalized])];
        supabase
          .from("profiles")
          .update({ category_tags: merged, updated_at: new Date().toISOString() })
          .eq("id", user.id)
          .then(() => {});
        return { ...prev, categoryTags: merged };
      });
    },
    [user?.id]
  );

  return (
    <ProfileContext.Provider
      value={{
        profile,
        updateProfile,
        isFollowing,
        follow,
        unfollow,
        viewedUserId,
        setViewedUser,
        blockedUserIds,
        blockUser,
        unblockUser,
        savedPostIds,
        savedProductIds,
        toggleSavePost,
        toggleSaveProduct,
        profileLoadDone,
        refetchProfile,
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

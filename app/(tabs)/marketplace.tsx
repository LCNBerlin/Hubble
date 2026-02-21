import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { ProductCard } from "../../components/ProductCard";
import type { CreatorInfo } from "../../components/ProductCard";
import { EmptyState } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useCommunity } from "../../context/CommunityContext";
import { useContent } from "../../context/ContentContext";
import { useProfile } from "../../context/ProfileContext";
import type { Product, ProductType } from "../../context/ContentContext";
import { rankProducts } from "../../lib/discovery";
import {
  getCurrentPositionAsync,
  requestForegroundPermissionsAsync,
  Accuracy as LocationAccuracy,
  haversineMiles,
} from "../../lib/location";
import supabase from "../../lib/supabase";
import { rowToProduct } from "../../lib/supabase-products";
import { getViewedProducts } from "../../lib/viewed-products";
import { useStripeContext } from "../../context/StripeContext";
import { useWishlist } from "../../context/WishlistContext";
import { PAYMENTS_ENABLED } from "../../lib/config";
import { confirmOrder, createPaymentIntent, formatCentsToPrice, getProductPriceCents, parsePriceToCents, trackAbandonedCart, validateCoupon } from "../../lib/payments";

const CART_IMAGE_SIZE = 100;

type MarketplaceView = "shop" | "wishlist" | "cart";

type DiscoveryCategory = "all" | ProductType | "nft" | "b2b";

const CATEGORY_LABELS: Record<DiscoveryCategory, string> = {
  all: "All",
  digital: "Digital",
  physical: "Physical",
  services: "Services",
  membership: "Membership",
  nft: "NFTs",
  live: "Live",
  event: "Events",
  b2b: "B2B",
};

/** Derive delivery type from product type when product.deliveryType is not set */
function getProductDeliveryType(p: Product): "instant" | "shipped" {
  if (p.deliveryType) return p.deliveryType;
  if (p.type === "physical") return "shipped";
  return "instant";
}

const FILTER_CURRENCIES = ["USD", "EUR", "GBP"] as const;
const FILTER_CHAINS = ["ethereum", "polygon", "arbitrum", "base"] as const;

type CreatorProfileFilterRow = {
  verifiedTier: "none" | "verified" | "enterprise";
  reputationScore: number;
  stakingBadge: boolean;
};

export default function MarketplaceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();
  const initialView: MarketplaceView =
    params.view === "cart" ? "cart" : params.view === "wishlist" ? "wishlist" : "shop";
  const [view, setView] = useState<MarketplaceView>(initialView);

  useEffect(() => {
    if (params.view === "cart") setView("cart");
    else if (params.view === "wishlist") setView("wishlist");
  }, [params.view]);

  const { width: screenWidth } = useWindowDimensions();
  const isTablet = screenWidth >= 768;
  const numColumns = isTablet ? 4 : 2;
  const GRID_PADDING = 16;
  const GRID_GAP = 8;
  const DISCOVERY_PAGE_SIZE = 20;
  const PRODUCTS_PAGE_SIZE = 50;
  const gridCellWidth = (screenWidth - GRID_PADDING * 2 - GRID_GAP * (numColumns - 1)) / numColumns;
  const cardWidth = gridCellWidth;

  const { productReviews, getReviewsForProduct } = useContent();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const productsOffsetRef = useRef(0);
  const [displayedCount, setDisplayedCount] = useState(DISCOVERY_PAGE_SIZE);
  const [creatorMap, setCreatorMap] = useState<Record<string, CreatorInfo>>({});
  const { user } = useAuth();
  const { selectedCommunityId, selectedCommunity, setSelectedCommunityId } = useCommunity();
  const { items: cartItems, removeFromCart, updateQuantity, updateTier, clearCart, cartCount } = useCart();
  const { items: wishlistItems } = useWishlist();
  const { initPaymentSheet, presentPaymentSheet } = useStripeContext();
  const [refreshing, setRefreshing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountCents: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const lastAbandonedSent = useRef(0);
  const cartItemsRef = useRef(cartItems);
  cartItemsRef.current = cartItems;

  // Discovery layer state
  const [searchQuery, setSearchQuery] = useState("");
  const [discoveryCategory, setDiscoveryCategory] = useState<DiscoveryCategory>("all");
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [priceMinCents, setPriceMinCents] = useState<number | null>(null);
  const [priceMaxCents, setPriceMaxCents] = useState<number | null>(null);
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [filterAvailability, setFilterAvailability] = useState<"all" | "in_stock">("all");
  const [filterTokenGated, setFilterTokenGated] = useState<boolean | null>(null);
  const [filterNearMe, setFilterNearMe] = useState(false);
  // Product type (modal multi-select)
  const [filterProductTypes, setFilterProductTypes] = useState<ProductType[] | null>(null);
  // Commerce
  const [filterCurrency, setFilterCurrency] = useState<string | null>(null);
  const [filterDeliveryType, setFilterDeliveryType] = useState<"instant" | "shipped" | null>(null);
  const [filterSubscriptionLength, setFilterSubscriptionLength] = useState<"one_time" | "monthly" | "yearly" | null>(null);
  const [filterEscrowRequired, setFilterEscrowRequired] = useState<boolean | null>(null);
  // Trust
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);
  const [filterReputationMin, setFilterReputationMin] = useState<number | null>(null);
  // Web3
  const [filterChain, setFilterChain] = useState<string | null>(null);
  const [filterStakingEnabled, setFilterStakingEnabled] = useState<boolean | null>(null);
  // Creator profile map for Trust/Web3 filters (verified, reputation, staking)
  const [creatorProfileFilterMap, setCreatorProfileFilterMap] = useState<Record<string, CreatorProfileFilterRow>>({});
  // Creator locations for "Near you" section (text) and lat/lng for distance
  const [creatorLocations, setCreatorLocations] = useState<Record<string, string>>({});
  const [creatorLatLng, setCreatorLatLng] = useState<Record<string, { lat: number; lng: number }>>({});
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [viewedProducts, setViewedProducts] = useState<{ id: string; title: string }[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [topRatedCreatorIds, setTopRatedCreatorIds] = useState<string[]>([]);
  const { profile } = useProfile();

  const fetchMarketplaceProducts = useCallback(async (append = false) => {
    if (!supabase) {
      if (!append) setProducts([]);
      setProductsLoading(false);
      return;
    }
    const from = append ? productsOffsetRef.current : 0;
    const to = from + PRODUCTS_PAGE_SIZE - 1;
    if (append && productsOffsetRef.current > 0 && from > to) return;
    setProductsLoading(true);
    try {
      let query = supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (selectedCommunityId) {
        query = supabase
          .from("products")
          .select("*")
          .eq("creator_id", selectedCommunityId)
          .order("created_at", { ascending: false })
          .range(from, to);
      }
      const { data } = await query;
      const rows = data ?? [];
      const mapped = rows.map((row: unknown) => rowToProduct(row as Parameters<typeof rowToProduct>[0]));
      if (append) {
        setProducts((prev) => [...prev, ...mapped]);
      } else {
        setProducts(mapped);
        setDisplayedCount(DISCOVERY_PAGE_SIZE);
      }
      productsOffsetRef.current = from + mapped.length;
      setHasMoreProducts(mapped.length === PRODUCTS_PAGE_SIZE);
    } catch {
      if (!append) setProducts([]);
      setHasMoreProducts(false);
    } finally {
      setProductsLoading(false);
    }
  }, [selectedCommunityId]);

  useEffect(() => {
    productsOffsetRef.current = 0;
    fetchMarketplaceProducts(false);
  }, [fetchMarketplaceProducts]);

  useFocusEffect(
    useCallback(() => {
      productsOffsetRef.current = 0;
      fetchMarketplaceProducts(false);
      getViewedProducts().then(setViewedProducts);
    }, [fetchMarketplaceProducts])
  );

  const creatorIdsForLocation = useMemo(
    () => [...new Set(products.map((p) => p.creatorId).filter(Boolean))].sort().join(","),
    [products]
  );
  useEffect(() => {
    if (!supabase || !creatorIdsForLocation) {
      setCreatorLocations({});
      setCreatorLatLng({});
      return;
    }
    const ids = creatorIdsForLocation.split(",").filter(Boolean);
    supabase
      .from("profiles")
      .select("id, location, lat, lng")
      .in("id", ids)
      .then(({ data }) => {
        const nextLoc: Record<string, string> = {};
        const nextLatLng: Record<string, { lat: number; lng: number }> = {};
        (data ?? []).forEach((row: { id: string; location?: string | null; lat?: number | null; lng?: number | null }) => {
          const loc = row.location?.trim();
          if (loc) nextLoc[row.id] = loc;
          if (row.lat != null && row.lng != null && !Number.isNaN(row.lat) && !Number.isNaN(row.lng)) {
            nextLatLng[row.id] = { lat: row.lat, lng: row.lng };
          }
        });
        setCreatorLocations(nextLoc);
        setCreatorLatLng(nextLatLng);
      })
      .catch(() => {
        setCreatorLocations({});
        setCreatorLatLng({});
      });
  }, [creatorIdsForLocation]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const perm = await requestForegroundPermissionsAsync();
        if (!perm || perm.status !== "granted" || cancelled) return;
        const pos = await getCurrentPositionAsync({ accuracy: LocationAccuracy.Balanced });
        if (cancelled || !pos) return;
        setUserPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supabase || !user?.id) {
      setFollowingIds([]);
      return;
    }
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .then(({ data }) => {
        setFollowingIds((data ?? []).map((r: { following_id: string }) => r.following_id));
      })
      .catch(() => setFollowingIds([]));
  }, [user?.id]);

  const productCreatorIds = useMemo(
    () => [...new Set(products.map((p) => p.creatorId).filter(Boolean))] as string[],
    [products]
  );
  useEffect(() => {
    if (!supabase || productCreatorIds.length === 0) {
      setTopRatedCreatorIds([]);
      return;
    }
    supabase
      .from("profiles")
      .select("id")
      .in("id", productCreatorIds)
      .or("reputation_score.gte.4,verified_tier.eq.verified,verified_tier.eq.enterprise")
      .then(({ data }) => {
        setTopRatedCreatorIds((data ?? []).map((r: { id: string }) => r.id));
      })
      .catch(() => setTopRatedCreatorIds([]));
  }, [productCreatorIds.join(",")]);

  const filteredProducts = useMemo(() => {
    let list = products;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.title ?? "").toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q) ||
          (p.categories ?? []).some((c) => c.toLowerCase().includes(q)) ||
          (p.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
      );
    }

    if (discoveryCategory !== "all") {
      if (discoveryCategory === "b2b") {
        list = list.filter((p) => p.isWholesale === true);
      } else {
        list = list.filter((p) => p.type === discoveryCategory);
      }
    }

    if (filterProductTypes != null && filterProductTypes.length > 0) {
      list = list.filter((p) => filterProductTypes.includes(p.type));
    }

    if (priceMinCents != null) {
      list = list.filter((p) => parsePriceToCents(p.price ?? "") >= priceMinCents);
    }
    if (priceMaxCents != null) {
      list = list.filter((p) => parsePriceToCents(p.price ?? "") <= priceMaxCents);
    }
    if (filterCurrency != null) {
      list = list.filter((p) => (p.currency ?? "USD") === filterCurrency);
    }
    if (filterDeliveryType != null) {
      list = list.filter((p) => getProductDeliveryType(p) === filterDeliveryType);
    }
    if (filterAvailability === "in_stock") {
      list = list.filter(
        (p) =>
          p.inventoryStatus === "in_stock" ||
          (p.stockQuantity != null && p.stockQuantity > 0) ||
          (p.inventoryStatus != null && p.inventoryStatus !== "out_of_stock" && p.stockQuantity == null)
      );
    }
    if (filterSubscriptionLength != null) {
      if (filterSubscriptionLength === "one_time") {
        list = list.filter((p) => !p.interval || p.interval === "");
      } else if (filterSubscriptionLength === "monthly") {
        list = list.filter((p) => p.interval != null && p.interval.toLowerCase().includes("month"));
      } else if (filterSubscriptionLength === "yearly") {
        list = list.filter((p) => p.interval != null && p.interval.toLowerCase().includes("year"));
      }
    }
    if (filterEscrowRequired === true) {
      list = list.filter((p) => p.escrowRequired === true);
    }

    if (filterRating != null && filterRating > 0) {
      list = list.filter((p) => (p.rating ?? 0) >= filterRating);
    }

    if (filterVerifiedOnly) {
      list = list.filter((p) => {
        if (!p.creatorId) return false;
        const profile = creatorProfileFilterMap[p.creatorId];
        if (!profile) return false;
        return profile.verifiedTier !== "none";
      });
    }
    if (filterReputationMin != null && filterReputationMin > 0) {
      list = list.filter((p) => {
        if (!p.creatorId) return false;
        const profile = creatorProfileFilterMap[p.creatorId];
        if (!profile) return false;
        return profile.reputationScore >= filterReputationMin;
      });
    }
    if (filterStakingEnabled === true) {
      list = list.filter((p) => {
        if (!p.creatorId) return false;
        const profile = creatorProfileFilterMap[p.creatorId];
        if (!profile) return false;
        return profile.stakingBadge === true;
      });
    }
    if (filterTokenGated === true) {
      list = list.filter((p) => p.tokenGated === true);
    }
    if (filterChain != null) {
      list = list.filter((p) => (p.chain ?? "") === filterChain);
    }
    if (filterNearMe) {
      const withLocation = Object.keys(creatorLocations);
      if (withLocation.length > 0) {
        list = list.filter((p) => p.creatorId && creatorLocations[p.creatorId]);
      }
    }

    return list;
  }, [
    products,
    searchQuery,
    discoveryCategory,
    filterProductTypes,
    priceMinCents,
    priceMaxCents,
    filterCurrency,
    filterDeliveryType,
    filterAvailability,
    filterSubscriptionLength,
    filterEscrowRequired,
    filterRating,
    creatorProfileFilterMap,
    filterVerifiedOnly,
    filterReputationMin,
    filterStakingEnabled,
    filterTokenGated,
    filterChain,
    filterNearMe,
    creatorLocations,
  ]);

  const rankedProducts = useMemo(
    () => rankProducts(filteredProducts),
    [filteredProducts]
  );

  const creatorIdsForFilterFetch = useMemo(() => {
    let list = products;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.title ?? "").toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          (p.category ?? "").toLowerCase().includes(q) ||
          (p.categories ?? []).some((c) => c.toLowerCase().includes(q)) ||
          (p.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
      );
    }
    if (discoveryCategory !== "all") {
      if (discoveryCategory === "b2b") list = list.filter((p) => p.isWholesale === true);
      else list = list.filter((p) => p.type === discoveryCategory);
    }
    if (filterProductTypes != null && filterProductTypes.length > 0) {
      list = list.filter((p) => filterProductTypes.includes(p.type));
    }
    if (priceMinCents != null) list = list.filter((p) => parsePriceToCents(p.price ?? "") >= priceMinCents);
    if (priceMaxCents != null) list = list.filter((p) => parsePriceToCents(p.price ?? "") <= priceMaxCents);
    if (filterCurrency != null) list = list.filter((p) => (p.currency ?? "USD") === filterCurrency);
    if (filterDeliveryType != null) list = list.filter((p) => getProductDeliveryType(p) === filterDeliveryType);
    if (filterAvailability === "in_stock") {
      list = list.filter(
        (p) =>
          p.inventoryStatus === "in_stock" ||
          (p.stockQuantity != null && p.stockQuantity > 0) ||
          (p.inventoryStatus != null && p.inventoryStatus !== "out_of_stock" && p.stockQuantity == null)
      );
    }
    if (filterSubscriptionLength != null) {
      if (filterSubscriptionLength === "one_time") list = list.filter((p) => !p.interval || p.interval === "");
      else if (filterSubscriptionLength === "monthly") list = list.filter((p) => p.interval != null && p.interval.toLowerCase().includes("month"));
      else if (filterSubscriptionLength === "yearly") list = list.filter((p) => p.interval != null && p.interval.toLowerCase().includes("year"));
    }
    if (filterEscrowRequired === true) list = list.filter((p) => p.escrowRequired === true);
    return [...new Set(list.map((p) => p.creatorId).filter(Boolean))] as string[];
  }, [
    products,
    searchQuery,
    discoveryCategory,
    filterProductTypes,
    priceMinCents,
    priceMaxCents,
    filterCurrency,
    filterDeliveryType,
    filterAvailability,
    filterSubscriptionLength,
    filterEscrowRequired,
  ]);

  useEffect(() => {
    const needCreatorMap = filterVerifiedOnly || (filterReputationMin != null && filterReputationMin > 0) || filterStakingEnabled === true;
    if (!needCreatorMap) {
      setCreatorProfileFilterMap({});
      return;
    }
    if (creatorIdsForFilterFetch.length === 0) {
      setCreatorProfileFilterMap({});
      return;
    }
    supabase
      .from("profiles")
      .select("id, staking_badge, verified_tier, reputation_score")
      .in("id", creatorIdsForFilterFetch)
      .then(({ data }) => {
        const next: Record<string, CreatorProfileFilterRow> = {};
        (data ?? []).forEach(
          (row: {
            id: string;
            staking_badge?: boolean;
            verified_tier?: string | null;
            reputation_score?: number | null;
          }) => {
            const tier = row.verified_tier === "verified" || row.verified_tier === "enterprise" ? row.verified_tier : "none";
            next[row.id] = {
              verifiedTier: tier as "none" | "verified" | "enterprise",
              reputationScore: typeof row.reputation_score === "number" ? row.reputation_score : 0,
              stakingBadge: row.staking_badge === true,
            };
          }
        );
        setCreatorProfileFilterMap(next);
      })
      .catch(() => setCreatorProfileFilterMap({}));
  }, [
    filterVerifiedOnly,
    filterReputationMin,
    filterStakingEnabled,
    creatorIdsForFilterFetch.join(","),
  ]);

  const ratingMap = useMemo(() => {
    const map: Record<string, { avg: number; count: number }> = {};
    products.forEach((p) => {
      const reviews = getReviewsForProduct(p.id);
      if (reviews.length === 0) return;
      const sum = reviews.reduce((s, r) => s + r.rating, 0);
      map[p.id] = { avg: sum / reviews.length, count: reviews.length };
    });
    return map;
  }, [products, productReviews, getReviewsForProduct]);

  useEffect(() => {
    setDisplayedCount(DISCOVERY_PAGE_SIZE);
  }, [
    searchQuery,
    discoveryCategory,
    filterProductTypes,
    priceMinCents,
    priceMaxCents,
    filterCurrency,
    filterDeliveryType,
    filterAvailability,
    filterSubscriptionLength,
    filterEscrowRequired,
    filterRating,
    filterVerifiedOnly,
    filterReputationMin,
    filterChain,
    filterTokenGated,
    filterStakingEnabled,
  ]);

  useEffect(() => {
    const slice = rankedProducts.slice(0, displayedCount);
    const creatorIds = [...new Set(slice.map((p) => p.creatorId).filter(Boolean))] as string[];
    if (creatorIds.length === 0) return;
    supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", creatorIds)
      .then(({ data }) => {
        const next: Record<string, CreatorInfo> = {};
        (data ?? []).forEach((row: { id: string; display_name?: string | null; username: string; avatar_url?: string | null }) => {
          next[row.id] = {
            displayName: row.display_name,
            username: row.username ?? "",
            avatarUrl: row.avatar_url,
          };
        });
        setCreatorMap((prev) => ({ ...prev, ...next }));
      });
  }, [rankedProducts, displayedCount]);

  const trendingProducts = useMemo(
    () =>
      [...products.filter((p) => p.pinned), ...products.filter((p) => !p.pinned)].slice(0, 6),
    [products]
  );

  const TRENDING_HOURS_MS = 24 * 60 * 60 * 1000;
  const DROPS_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  const trendingToday = useMemo(() => {
    const cut = Date.now() - TRENDING_HOURS_MS;
    return rankedProducts.filter((p) => (p.createdAt ?? 0) >= cut).slice(0, 8);
  }, [rankedProducts]);

  const nearYouProducts = useMemo(() => {
    const withLocation = Object.keys(creatorLocations);
    if (withLocation.length === 0) return [];
    return rankedProducts.filter((p) => p.creatorId && creatorLocations[p.creatorId]).slice(0, 8);
  }, [rankedProducts, creatorLocations]);

  /** This weekend = next Sat 00:00 UTC through Sun 23:59:59 UTC (or current weekend if we're in it). */
  const thisWeekendBounds = useMemo(() => {
    const now = new Date();
    const day = now.getUTCDay();
    const daysUntilSaturday = day === 0 ? 6 : (6 - day + 7) % 7;
    const sat = new Date(now);
    sat.setUTCDate(sat.getUTCDate() + daysUntilSaturday);
    sat.setUTCHours(0, 0, 0, 0);
    const sun = new Date(sat);
    sun.setUTCDate(sun.getUTCDate() + 1);
    sun.setUTCHours(23, 59, 59, 999);
    return [sat.getTime(), sun.getTime()] as const;
  }, []);

  const trendingNearYou = useMemo(() => {
    const withLocation = Object.keys(creatorLocations);
    if (withLocation.length === 0) return [];
    return trendingToday.filter((p) => p.creatorId && creatorLocations[p.creatorId]).slice(0, 8);
  }, [trendingToday, creatorLocations]);

  const eventsThisWeekend = useMemo(() => {
    const [start, end] = thisWeekendBounds;
    return rankedProducts
      .filter(
        (p) =>
          p.type === "event" &&
          p.eventDate != null &&
          p.eventDate >= start &&
          p.eventDate <= end
      )
      .sort((a, b) => (a.eventDate ?? 0) - (b.eventDate ?? 0))
      .slice(0, 8);
  }, [rankedProducts, thisWeekendBounds]);

  const servicesNearYou = useMemo(() => {
    const services = rankedProducts.filter((p) => p.type === "services" && p.creatorId);
    if (services.length === 0) return [];
    if (userPosition && Object.keys(creatorLatLng).length > 0) {
      const withDistance = services
        .filter((p) => p.creatorId && creatorLatLng[p.creatorId])
        .map((p) => ({
          product: p,
          distance: haversineMiles(
            userPosition.lat,
            userPosition.lng,
            creatorLatLng[p.creatorId!].lat,
            creatorLatLng[p.creatorId!].lng
          ),
        }))
        .filter((d) => d.distance <= 5)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 8)
        .map((d) => d.product);
      if (withDistance.length > 0) return withDistance;
    }
    const withLocation = Object.keys(creatorLocations);
    if (withLocation.length === 0) return [];
    return services
      .filter((p) => creatorLocations[p.creatorId!])
      .slice(0, 8);
  }, [rankedProducts, creatorLocations, creatorLatLng, userPosition]);

  const userCity = (profile?.location ?? "").trim().toLowerCase();
  const topRatedInYourCity = useMemo(() => {
    const list = rankedProducts.filter(
      (p) => p.creatorId && topRatedCreatorIds.includes(p.creatorId)
    );
    if (!userCity) return list.slice(0, 8);
    return list
      .filter((p) => {
        const loc = p.creatorId ? creatorLocations[p.creatorId] : "";
        if (!loc) return false;
        const locLower = loc.trim().toLowerCase();
        return (
          locLower.includes(userCity) ||
          userCity.includes(locLower) ||
          locLower === userCity
        );
      })
      .slice(0, 8);
  }, [rankedProducts, topRatedCreatorIds, creatorLocations, userCity]);

  const firstViewed = viewedProducts[0];
  const viewedProduct = useMemo(
    () => (firstViewed ? rankedProducts.find((p) => p.id === firstViewed.id) : null),
    [firstViewed, rankedProducts]
  );
  const becauseYouViewedProducts = useMemo(() => {
    if (!viewedProduct || !firstViewed) return [];
    const viewedIds = new Set(viewedProducts.map((e) => e.id));
    return rankedProducts
      .filter(
        (p) =>
          !viewedIds.has(p.id) &&
          (p.creatorId === viewedProduct.creatorId || p.type === viewedProduct.type)
      )
      .slice(0, 8);
  }, [rankedProducts, viewedProduct, firstViewed, viewedProducts]);

  const limitedTimeDrops = useMemo(() => {
    const cut = Date.now() - DROPS_DAYS_MS;
    return rankedProducts
      .filter((p) => p.goLiveAt != null && p.goLiveAt >= cut)
      .sort((a, b) => (b.goLiveAt ?? 0) - (a.goLiveAt ?? 0))
      .slice(0, 8);
  }, [rankedProducts]);

  const continueBrowsingProducts = useMemo(
    () => rankedProducts.slice(8, 20),
    [rankedProducts]
  );

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

  const isNewUser = !user || (viewedProducts.length <= 1 && wishlistItems.length === 0 && cartCount === 0 && followingIds.length === 0);
  const isReturningUser = viewedProducts.length > 0 || wishlistItems.length > 0 || cartCount > 0 || followingIds.length > 0;
  const isHighIntentUser = cartCount > 0 || wishlistItems.length >= 2;

  const popularThisWeek = useMemo(() => {
    const cut = Date.now() - WEEK_MS;
    return rankedProducts.filter((p) => (p.createdAt ?? 0) >= cut).slice(0, 8);
  }, [rankedProducts]);

  const topRatedCreatorsProducts = useMemo(
    () => rankedProducts.filter((p) => p.creatorId && topRatedCreatorIds.includes(p.creatorId)).slice(0, 8),
    [rankedProducts, topRatedCreatorIds]
  );

  const instantDownloadsUnder20 = useMemo(
    () =>
      rankedProducts
        .filter((p) => {
          if (p.type !== "digital") return false;
          const delivery = getProductDeliveryType(p);
          if (delivery !== "instant") return false;
          return getProductPriceCents(p) > 0 && getProductPriceCents(p) <= 2000;
        })
        .slice(0, 8),
    [rankedProducts]
  );

  const backInStock = useMemo(
    () =>
      rankedProducts.filter(
        (p) =>
          (p.inventoryStatus === "in_stock" || (p.stockQuantity != null && p.stockQuantity > 0 && p.stockQuantity <= 15))
      ).slice(0, 8),
    [rankedProducts]
  );

  const priceDropped = useMemo(
    () =>
      rankedProducts.filter((p) => (p.priceTiers?.length ?? 0) > 1).slice(0, 8),
    [rankedProducts]
  );

  const youViewedThis = useMemo(() => {
    const viewedIds = new Set(viewedProducts.map((e) => e.id));
    return rankedProducts.filter((p) => viewedIds.has(p.id)).slice(0, 8);
  }, [rankedProducts, viewedProducts]);

  const newFromCreatorsYouFollow = useMemo(
    () =>
      rankedProducts
        .filter((p) => p.creatorId && followingIds.includes(p.creatorId))
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .slice(0, 8),
    [rankedProducts, followingIds]
  );

  const lowInventory = useMemo(
    () =>
      rankedProducts.filter(
        (p) =>
          p.inventoryStatus === "low_stock" || (p.stockQuantity != null && p.stockQuantity > 0 && p.stockQuantity <= 5)
      ).slice(0, 8),
    [rankedProducts]
  );

  const expiringSoon = useMemo(() => {
    const now = Date.now();
    return rankedProducts
      .filter((p) => {
        if (p.type !== "event" || p.eventDate == null) return false;
        const eventTime = p.eventDate;
        return eventTime >= now && eventTime <= now + TWO_WEEKS_MS;
      })
      .sort((a, b) => (a.eventDate ?? 0) - (b.eventDate ?? 0))
      .slice(0, 8);
  }, [rankedProducts]);

  const peopleJustBoughtThis = useMemo(
    () => rankedProducts.filter((p) => p.inventoryStatus === "low_stock" || (p.stockQuantity != null && p.stockQuantity <= 5)).slice(0, 8),
    [rankedProducts]
  );

  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const endingIn2h = useMemo(() => {
    const now = Date.now();
    return rankedProducts
      .filter((p) => {
        if (p.type === "event" && p.eventDate != null) {
          return p.eventDate >= now && p.eventDate <= now + TWO_HOURS_MS;
        }
        if (p.goLiveAt != null && p.goLiveAt > now) {
          return p.goLiveAt <= now + TWO_HOURS_MS;
        }
        return false;
      })
      .sort((a, b) => (a.eventDate ?? a.goLiveAt ?? 0) - (b.eventDate ?? b.goLiveAt ?? 0))
      .slice(0, 8);
  }, [rankedProducts]);

  const limitedSupply = useMemo(
    () =>
      rankedProducts.filter(
        (p) =>
          p.stockQuantity != null && p.stockQuantity > 0 && p.stockQuantity <= 10
      ).slice(0, 8),
    [rankedProducts]
  );

  const flashSale = useMemo(() => {
    const now = Date.now();
    const cut = now - ONE_DAY_MS;
    return rankedProducts
      .filter((p) => p.goLiveAt != null && p.goLiveAt >= cut && p.goLiveAt <= now)
      .sort((a, b) => (b.goLiveAt ?? 0) - (a.goLiveAt ?? 0))
      .slice(0, 8);
  }, [rankedProducts]);

  const only5SpotsLeft = useMemo(
    () =>
      rankedProducts.filter(
        (p) =>
          p.type === "services" &&
          p.stockQuantity != null &&
          p.stockQuantity > 0 &&
          p.stockQuantity <= 5
      ).slice(0, 8),
    [rankedProducts]
  );

  const sponsoredProducts = useMemo(() => products.filter((p) => p.isSponsored ?? p.pinned), [products]);
  const b2bProducts = useMemo(() => products.filter((p) => p.isWholesale), [products]);
  const hasActiveFilters =
    (filterProductTypes != null && filterProductTypes.length > 0) ||
    priceMinCents != null ||
    priceMaxCents != null ||
    filterCurrency != null ||
    filterDeliveryType != null ||
    filterAvailability === "in_stock" ||
    filterSubscriptionLength != null ||
    filterEscrowRequired === true ||
    filterRating != null ||
    filterVerifiedOnly ||
    (filterReputationMin != null && filterReputationMin > 0) ||
    filterChain != null ||
    filterTokenGated === true ||
    filterStakingEnabled === true ||
    filterNearMe;

  const { subtotalCents, lineTotals } = useMemo(() => {
    let total = 0;
    const lineTotalsMap: Record<string, number> = {};
    cartItems.forEach(({ product, quantity, selectedTierIndex }) => {
      const cents = getProductPriceCents(product, selectedTierIndex ?? 0);
      const lineCents = cents * quantity;
      lineTotalsMap[product.id] = lineCents;
      total += lineCents;
    });
    return { subtotalCents: total, lineTotals: lineTotalsMap };
  }, [cartItems]);

  const totalCents = subtotalCents - (appliedCoupon?.discountCents ?? 0);
  const canCheckout = totalCents >= 1;

  useEffect(() => {
    if (cartItems.length === 0 || !user?.id) return;
    const THROTTLE_MS = 30 * 60 * 1000;
    const DELAY_MS = 2 * 60 * 1000;
    const t = setTimeout(() => {
      if (Date.now() - lastAbandonedSent.current < THROTTLE_MS) return;
      const current = cartItemsRef.current;
      const snapshot = current.map(({ product, quantity }) => ({
        productId: product.id,
        quantity,
        title: product.title,
        price: product.price,
      }));
      const sub = current.reduce(
        (sum, { product, quantity, selectedTierIndex }) =>
          sum + getProductPriceCents(product, selectedTierIndex ?? 0) * quantity,
        0
      );
      trackAbandonedCart({ userId: user.id, cartSnapshot: snapshot, subtotalCents: sub }).then(() => {
        lastAbandonedSent.current = Date.now();
      });
    }, DELAY_MS);
    return () => clearTimeout(t);
  }, [cartItems.length, user?.id, subtotalCents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    productsOffsetRef.current = 0;
    await fetchMarketplaceProducts(false);
    try {
      const perm = await requestForegroundPermissionsAsync();
      if (perm?.status === "granted") {
        const pos = await getCurrentPositionAsync({ accuracy: LocationAccuracy.Balanced });
        if (pos) setUserPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    } catch {
      // ignore
    }
    setRefreshing(false);
  }, [fetchMarketplaceProducts]);

  const handleRemoveFromCart = useCallback((productId: string) => {
    removeFromCart(productId);
  }, [removeFromCart]);

  const handleClearCart = useCallback(() => {
    Alert.alert(
      "Clear cart?",
      "Remove all items from your cart.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: clearCart },
      ]
    );
  }, [clearCart]);

  const handleApplyPromo = useCallback(async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoLoading(true);
    setPromoError(null);
    const result = await validateCoupon(code, subtotalCents);
    setPromoLoading(false);
    if (result.ok && result.valid && result.discountCents > 0) {
      setAppliedCoupon({ code, discountCents: result.discountCents });
      setPromoInput("");
    } else {
      setPromoError(
        result.ok && !result.valid ? result.message : result.ok === false ? result.error : "Invalid code"
      );
    }
  }, [promoInput, subtotalCents]);

  const handleCheckout = useCallback(async () => {
    if (subtotalCents <= 0) {
      Alert.alert("Cart empty", "Add items before checkout.");
      return;
    }
    if (!user?.id) {
      Alert.alert("Checkout", "You must be signed in to checkout.");
      return;
    }
    const useRealPayment = PAYMENTS_ENABLED && canCheckout;
    if (!useRealPayment) {
      Alert.alert("Checkout", "Payment integration is disabled or cart total is below minimum.");
      return;
    }
    setCheckoutLoading(true);
    const result = await createPaymentIntent({
      amountCents: subtotalCents,
      currency: "usd",
      metadata: { type: "purchase" },
      ...(appliedCoupon && { couponCode: appliedCoupon.code, subtotalCents }),
    });
    if (!result.ok) {
      setCheckoutLoading(false);
      Alert.alert("Payment failed", result.error);
      return;
    }
    const paymentIntentId = result.paymentIntentId;
    try {
      await initPaymentSheet({
        paymentIntentClientSecret: result.clientSecret,
        merchantDisplayName: "Hubble",
      });
      const { error } = await presentPaymentSheet();
      if (error) {
        Alert.alert("Payment failed", error.message ?? "Payment was not completed.");
      } else {
        const confirmResult = await confirmOrder({
          paymentIntentId: paymentIntentId ?? "",
          buyerId: user.id,
          cartItems: cartItems.map(({ product, quantity, selectedTierIndex }) => ({
            productId: product.id,
            creatorId: product.creatorId ?? null,
            title: product.title,
            priceCents: getProductPriceCents(product, selectedTierIndex ?? 0) || lineTotals[product.id] / quantity,
            quantity,
          })),
          subtotalCents,
          discountCents: appliedCoupon?.discountCents ?? 0,
          couponCode: appliedCoupon?.code ?? null,
        });
        if (confirmResult.ok) {
          clearCart();
          setAppliedCoupon(null);
          setView("shop");
          Alert.alert("Success", `Order complete. Order #${confirmResult.orderId.slice(0, 8)}.`);
        } else {
          Alert.alert("Order record failed", confirmResult.error);
        }
      }
    } catch (e) {
      Alert.alert("Payment failed", e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setCheckoutLoading(false);
    }
  }, [subtotalCents, totalCents, canCheckout, appliedCoupon, user?.id, initPaymentSheet, presentPaymentSheet, clearCart, cartItems, lineTotals]);

  const title = view === "wishlist" ? "Wishlist" : "Cart";
  const subtitle =
    view === "wishlist"
      ? `${wishlistItems.length} item${wishlistItems.length !== 1 ? "s" : ""}`
      : `${cartCount} item${cartCount !== 1 ? "s" : ""}`;

  return (
    <View className="flex-1 bg-zinc-950">
      {selectedCommunity ? (
        <View className="flex-row items-center justify-between border-b border-zinc-800 bg-zinc-800/60 px-3 py-2">
          <Text className="text-sm text-zinc-300" numberOfLines={1}>
            Viewing {selectedCommunity.displayName}&apos;s community
          </Text>
          <Pressable onPress={() => setSelectedCommunityId(null)} className="rounded-full p-2">
            <Ionicons name="close" size={20} color="#71717a" />
          </Pressable>
        </View>
      ) : null}
      {view === "shop" ? (
        <View className="flex-row items-center gap-2 border-b border-zinc-800 bg-zinc-800/80 px-3 py-2">
          <View className="flex-1 flex-row items-center rounded-lg bg-zinc-900 px-3 py-2.5">
            <Ionicons name="search-outline" size={20} color="#71717a" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search users, products, services, NFTs..."
              placeholderTextColor="#71717a"
              className="ml-2 flex-1 text-base text-zinc-100"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color="#71717a" />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={() => setFilterModalVisible(true)}
            className="h-10 w-10 items-center justify-center rounded-lg bg-zinc-700"
            accessibilityRole="button"
            accessibilityLabel="Filter"
          >
            <Ionicons name="filter-outline" size={20} color="#e4e4e7" />
          </Pressable>
          <Pressable
            onPress={() => setView("wishlist")}
            className={`relative h-10 w-10 items-center justify-center rounded-lg active:opacity-80 ${view === "wishlist" ? "bg-violet-600/30" : "bg-zinc-700"}`}
            accessibilityRole="button"
            accessibilityLabel="Wishlist"
          >
            <Ionicons name={view === "wishlist" ? "heart" : "heart-outline"} size={20} color="#a78bfa" />
            {wishlistItems.length > 0 && (
              <View className="absolute -top-0.5 -right-0.5 min-w-[18] h-[18] rounded-full bg-violet-500 items-center justify-center px-1">
                <Text className="text-[10px] font-bold text-white">
                  {wishlistItems.length > 99 ? "99+" : wishlistItems.length}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => setView("cart")}
            className={`relative h-10 w-10 items-center justify-center rounded-lg active:opacity-80 ${view === "cart" ? "bg-violet-600/30" : "bg-zinc-700"}`}
            accessibilityRole="button"
            accessibilityLabel="Cart"
          >
            <Ionicons name="cart-outline" size={20} color="#a78bfa" />
            {cartCount > 0 && (
              <View className="absolute -top-0.5 -right-0.5 min-w-[18] h-[18] rounded-full bg-violet-500 items-center justify-center px-1">
                <Text className="text-[10px] font-bold text-white">
                  {cartCount > 99 ? "99+" : cartCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      ) : (
        <View className="border-b border-zinc-800 px-4 pb-3 pt-14">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 min-w-0">
              <Pressable onPress={() => setView("shop")} className="active:opacity-80">
                <Text className="text-2xl font-bold text-zinc-100">{title}</Text>
                <Text className="text-sm text-zinc-500">{subtitle}</Text>
              </Pressable>
            </View>
          </View>
          <Pressable onPress={() => setView("shop")} className="mt-2 active:opacity-80">
            <Text className="text-sm text-violet-400">← Back to Shop</Text>
          </Pressable>
        </View>
      )}

      {view === "shop" && (
        <>
          {products.length === 0 ? (
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              <EmptyState
                message="No products yet"
                detail="Create a product in the Create tab to see it here."
                icon="pricetag-outline"
              />
            </ScrollView>
          ) : (
            <FlatList
              keyExtractor={(item) => item.id}
              numColumns={2}
              data={rankedProducts.slice(0, displayedCount)}
              ListHeaderComponent={
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
                    className="mb-2"
                  >
                    {(["all", "digital", "physical", "services", "membership", "nft", "live", "event", "b2b"] as const).map(
                      (cat) => (
                        <Pressable
                          key={cat}
                          onPress={() => setDiscoveryCategory(cat)}
                          className={`rounded-full px-4 py-2 ${discoveryCategory === cat ? "bg-violet-600" : "bg-zinc-800"}`}
                        >
                          <Text className={`text-sm font-medium ${discoveryCategory === cat ? "text-white" : "text-zinc-400"}`}>
                            {CATEGORY_LABELS[cat]}
                          </Text>
                        </Pressable>
                      )
                    )}
                    <Pressable
                      onPress={() => setFilterNearMe(!filterNearMe)}
                      className={`rounded-full px-4 py-2 ${filterNearMe ? "bg-violet-600" : "bg-zinc-800"}`}
                    >
                      <Text className={`text-sm font-medium ${filterNearMe ? "text-white" : "text-zinc-400"}`}>
                        Near me
                      </Text>
                    </Pressable>
                  </ScrollView>
                  <View className="px-4 pb-2">
                    <Text className="text-sm text-zinc-500">
                      {searchQuery || discoveryCategory !== "all" || hasActiveFilters
                        ? `${rankedProducts.length} product${rankedProducts.length !== 1 ? "s" : ""}`
                        : "Discover"}
                    </Text>
                  </View>

                  {/* Trending today */}
                  {trendingToday.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Trending today</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}
                      >
                        {trendingToday.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard
                              product={item}
                              compact
                              showCreatorBadge
                              creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null}
                              ratingSummary={ratingMap[item.id] ?? null}
                              onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })}
                            />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Near you */}
                  {nearYouProducts.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Near you</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}
                      >
                        {nearYouProducts.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard
                              product={item}
                              compact
                              showCreatorBadge
                              creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null}
                              ratingSummary={ratingMap[item.id] ?? null}
                              onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })}
                            />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Trending near you */}
                  {trendingNearYou.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Trending near you</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}
                      >
                        {trendingNearYou.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard
                              product={item}
                              compact
                              showCreatorBadge
                              creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null}
                              ratingSummary={ratingMap[item.id] ?? null}
                              onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })}
                            />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Events this weekend */}
                  {eventsThisWeekend.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Events this weekend</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}
                      >
                        {eventsThisWeekend.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard
                              product={item}
                              compact
                              showCreatorBadge
                              creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null}
                              ratingSummary={ratingMap[item.id] ?? null}
                              onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })}
                            />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Services within 5 miles (creators with location set) */}
                  {servicesNearYou.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Services within 5 miles</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}
                      >
                        {servicesNearYou.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard
                              product={item}
                              compact
                              showCreatorBadge
                              creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null}
                              ratingSummary={ratingMap[item.id] ?? null}
                              onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })}
                            />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Top-rated in your city */}
                  {topRatedInYourCity.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">
                        {userCity ? "Top-rated in your city" : "Top-rated creators"}
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}
                      >
                        {topRatedInYourCity.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard
                              product={item}
                              compact
                              showCreatorBadge
                              creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null}
                              ratingSummary={ratingMap[item.id] ?? null}
                              onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })}
                            />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Because you viewed _____ */}
                  {becauseYouViewedProducts.length > 0 && firstViewed && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2" numberOfLines={1} ellipsizeMode="tail">
                        Because you viewed {firstViewed.title}
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}
                      >
                        {becauseYouViewedProducts.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard
                              product={item}
                              compact
                              showCreatorBadge
                              creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null}
                              ratingSummary={ratingMap[item.id] ?? null}
                              onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })}
                            />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Limited time drops */}
                  {limitedTimeDrops.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Limited time drops</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}
                      >
                        {limitedTimeDrops.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard
                              product={item}
                              compact
                              showCreatorBadge
                              creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null}
                              ratingSummary={ratingMap[item.id] ?? null}
                              onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })}
                            />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* New user: Popular this week */}
                  {isNewUser && popularThisWeek.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Popular this week</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}>
                        {popularThisWeek.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard product={item} compact showCreatorBadge creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null} ratingSummary={ratingMap[item.id] ?? null} onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })} />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  {/* New user: Top rated creators */}
                  {isNewUser && topRatedCreatorsProducts.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Top rated creators</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}>
                        {topRatedCreatorsProducts.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard product={item} compact showCreatorBadge creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null} ratingSummary={ratingMap[item.id] ?? null} onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })} />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  {/* New user: Instant downloads under $20 */}
                  {isNewUser && instantDownloadsUnder20.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Instant downloads under $20</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}>
                        {instantDownloadsUnder20.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard product={item} compact showCreatorBadge creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null} ratingSummary={ratingMap[item.id] ?? null} onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })} />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Returning user: Back in stock */}
                  {isReturningUser && backInStock.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Back in stock</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}>
                        {backInStock.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard product={item} compact showCreatorBadge creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null} ratingSummary={ratingMap[item.id] ?? null} onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })} />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  {/* Returning user: Price dropped */}
                  {isReturningUser && priceDropped.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Price dropped</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}>
                        {priceDropped.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard product={item} compact showCreatorBadge creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null} ratingSummary={ratingMap[item.id] ?? null} onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })} />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  {/* Returning user: You viewed this */}
                  {isReturningUser && youViewedThis.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">You viewed this</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}>
                        {youViewedThis.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard product={item} compact showCreatorBadge creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null} ratingSummary={ratingMap[item.id] ?? null} onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })} />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  {/* Returning user: New from creators you follow */}
                  {isReturningUser && newFromCreatorsYouFollow.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">New from creators you follow</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}>
                        {newFromCreatorsYouFollow.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard product={item} compact showCreatorBadge creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null} ratingSummary={ratingMap[item.id] ?? null} onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })} />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* High-intent: Low inventory */}
                  {isHighIntentUser && lowInventory.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Low inventory</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}>
                        {lowInventory.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard product={item} compact showCreatorBadge creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null} ratingSummary={ratingMap[item.id] ?? null} onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })} />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  {/* High-intent: Expiring soon */}
                  {isHighIntentUser && expiringSoon.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Expiring soon</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}>
                        {expiringSoon.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard product={item} compact showCreatorBadge creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null} ratingSummary={ratingMap[item.id] ?? null} onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })} />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  {/* High-intent: 3 people just bought this */}
                  {isHighIntentUser && peopleJustBoughtThis.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">3 people just bought this</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}>
                        {peopleJustBoughtThis.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard product={item} compact showCreatorBadge creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null} ratingSummary={ratingMap[item.id] ?? null} onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })} />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Urgency: Ending in 2h */}
                  {endingIn2h.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Ending in 2h</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}>
                        {endingIn2h.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard product={item} compact showCreatorBadge creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null} ratingSummary={ratingMap[item.id] ?? null} onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })} />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  {/* Urgency: Limited supply */}
                  {limitedSupply.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Limited supply</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}>
                        {limitedSupply.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard product={item} compact showCreatorBadge creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null} ratingSummary={ratingMap[item.id] ?? null} onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })} />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  {/* Urgency: Flash sale */}
                  {flashSale.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Flash sale</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}>
                        {flashSale.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard product={item} compact showCreatorBadge creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null} ratingSummary={ratingMap[item.id] ?? null} onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })} />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  {/* Urgency: Only 5 spots left (services) */}
                  {only5SpotsLeft.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-zinc-100 px-4 mb-2">Only 5 spots left</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}>
                        {only5SpotsLeft.map((item) => (
                          <View key={item.id} style={{ width: gridCellWidth }}>
                            <ProductCard product={item} compact showCreatorBadge creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null} ratingSummary={ratingMap[item.id] ?? null} onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })} />
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </>
              }
              numColumns={numColumns}
              columnWrapperStyle={{
                paddingHorizontal: GRID_PADDING,
                gap: GRID_GAP,
                marginBottom: GRID_GAP,
              }}
              contentContainerStyle={{ paddingBottom: 32 }}
              ListFooterComponent={
                continueBrowsingProducts.length > 0 ? (
                  <View className="mt-6 mb-8">
                    <Text className="text-base font-semibold text-zinc-100 px-4 mb-3">Continue browsing</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: GRID_PADDING, gap: GRID_GAP }}
                    >
                      {continueBrowsingProducts.map((item) => (
                        <View key={item.id} style={{ width: gridCellWidth }}>
                          <ProductCard
                            product={item}
                            compact
                            showCreatorBadge
                            creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null}
                            ratingSummary={ratingMap[item.id] ?? null}
                            onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })}
                          />
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                ) : null
              }
              onEndReached={() => {
                setDisplayedCount((c) => Math.min(c + DISCOVERY_PAGE_SIZE, rankedProducts.length));
                if (
                  hasMoreProducts &&
                  !productsLoading &&
                  rankedProducts.length > 0 &&
                  displayedCount >= rankedProducts.length - DISCOVERY_PAGE_SIZE
                ) {
                  fetchMarketplaceProducts(true);
                }
              }}
              onEndReachedThreshold={0.3}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
              renderItem={({ item }) => (
                <View style={{ width: gridCellWidth }}>
                  <ProductCard
                    product={item}
                    compact
                    showCreatorBadge
                    creatorInfo={item.creatorId ? creatorMap[item.creatorId] ?? null : null}
                    ratingSummary={ratingMap[item.id] ?? null}
                    onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })}
                  />
                </View>
              )}
              ListEmptyComponent={
                filteredProducts.length === 0 ? (
                  <View className="py-8 px-4">
                    <Text className="text-sm text-zinc-500 text-center">
                      No products match your filters. Try different search or filters.
                    </Text>
                  </View>
                ) : null
              }
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" />
              }
            />
          )}

          {/* Filter modal */}
          <Modal
            visible={filterModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setFilterModalVisible(false)}
          >
            <Pressable
              className="flex-1 bg-black/60 justify-end"
              onPress={() => setFilterModalVisible(false)}
            >
              <View
                onStartShouldSetResponder={() => true}
                className="bg-zinc-900 rounded-t-2xl border-t border-zinc-700 max-h-[70%]"
              >
                <View className="flex-row items-center justify-between px-4 py-3 border-b border-zinc-700">
                  <Text className="text-lg font-semibold text-zinc-100">Filters</Text>
                  <Pressable
                    onPress={() => {
                      setFilterProductTypes(null);
                      setPriceMinCents(null);
                      setPriceMaxCents(null);
                      setFilterCurrency(null);
                      setFilterDeliveryType(null);
                      setFilterAvailability("all");
                      setFilterSubscriptionLength(null);
                      setFilterEscrowRequired(null);
                      setFilterRating(null);
                      setFilterVerifiedOnly(false);
                      setFilterReputationMin(null);
                      setFilterChain(null);
                      setFilterTokenGated(null);
                      setFilterStakingEnabled(null);
                      setFilterNearMe(false);
                    }}
                    className="py-2"
                  >
                    <Text className="text-sm text-violet-400">Clear all</Text>
                  </Pressable>
                </View>
                <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
                  {/* Product Type */}
                  <Text className="text-sm font-medium text-zinc-400 mb-2">Product type</Text>
                  <View className="flex-row flex-wrap gap-2 mb-4">
                    {(
                      [
                        "physical",
                        "digital",
                        "services",
                        "membership",
                        "nft",
                        "event",
                        "live",
                      ] as ProductType[]
                    ).map((t) => {
                      const selected = filterProductTypes != null && filterProductTypes.includes(t);
                      const label =
                        t === "services"
                          ? "Service"
                          : t === "event"
                            ? "Event ticket"
                            : t === "live"
                              ? "Live"
                              : t.charAt(0).toUpperCase() + t.slice(1);
                      return (
                        <Pressable
                          key={t}
                          onPress={() => {
                            if (filterProductTypes == null) setFilterProductTypes([t]);
                            else if (filterProductTypes.includes(t))
                              setFilterProductTypes(filterProductTypes.length === 1 ? null : filterProductTypes.filter((x) => x !== t));
                            else setFilterProductTypes([...filterProductTypes, t]);
                          }}
                          className={`rounded-lg px-3 py-2 ${selected ? "bg-violet-600" : "bg-zinc-800"}`}
                        >
                          <Text className="text-sm text-zinc-100">{label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Commerce */}
                  <Text className="text-sm font-medium text-zinc-400 mb-2">Commerce</Text>
                  <View className="flex-row gap-3 mb-3">
                    <View className="flex-1">
                      <Text className="text-xs text-zinc-500 mb-1">Min ($)</Text>
                      <TextInput
                        value={priceMinCents != null ? (priceMinCents / 100).toFixed(2) : ""}
                        onChangeText={(t) => {
                          if (t === "") setPriceMinCents(null);
                          else {
                            const v = parseFloat(t);
                            if (!isNaN(v)) setPriceMinCents(Math.round(v * 100));
                          }
                        }}
                        placeholder="0"
                        placeholderTextColor="#71717a"
                        keyboardType="decimal-pad"
                        className="bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs text-zinc-500 mb-1">Max ($)</Text>
                      <TextInput
                        value={priceMaxCents != null ? (priceMaxCents / 100).toFixed(2) : ""}
                        onChangeText={(t) => {
                          if (t === "") setPriceMaxCents(null);
                          else {
                            const v = parseFloat(t);
                            if (!isNaN(v)) setPriceMaxCents(Math.round(v * 100));
                          }
                        }}
                        placeholder="Any"
                        placeholderTextColor="#71717a"
                        keyboardType="decimal-pad"
                        className="bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100"
                      />
                    </View>
                  </View>
                  <View className="mb-3">
                    <Text className="text-xs text-zinc-500 mb-1">Currency</Text>
                    <View className="flex-row flex-wrap gap-2">
                      <Pressable
                        onPress={() => setFilterCurrency(null)}
                        className={`rounded-lg px-3 py-2 ${filterCurrency == null ? "bg-violet-600" : "bg-zinc-800"}`}
                      >
                        <Text className="text-sm text-zinc-100">All</Text>
                      </Pressable>
                      {FILTER_CURRENCIES.map((c) => (
                        <Pressable
                          key={c}
                          onPress={() => setFilterCurrency(filterCurrency === c ? null : c)}
                          className={`rounded-lg px-3 py-2 ${filterCurrency === c ? "bg-violet-600" : "bg-zinc-800"}`}
                        >
                          <Text className="text-sm text-zinc-100">{c}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View className="mb-3">
                    <Text className="text-xs text-zinc-500 mb-1">Delivery</Text>
                    <View className="flex-row gap-2">
                      {(["All", "Instant", "Shipped"] as const).map((label, i) => {
                        const value = i === 0 ? null : i === 1 ? "instant" : "shipped";
                        const active = filterDeliveryType === value;
                        return (
                          <Pressable
                            key={label}
                            onPress={() => setFilterDeliveryType(value)}
                            className={`rounded-lg px-3 py-2 ${active ? "bg-violet-600" : "bg-zinc-800"}`}
                          >
                            <Text className="text-sm text-zinc-100">{label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View className="mb-3">
                    <Text className="text-xs text-zinc-500 mb-1">Availability</Text>
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => setFilterAvailability("all")}
                        className={`rounded-lg px-3 py-2 ${filterAvailability === "all" ? "bg-violet-600" : "bg-zinc-800"}`}
                      >
                        <Text className="text-sm text-zinc-100">All</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setFilterAvailability("in_stock")}
                        className={`rounded-lg px-3 py-2 ${filterAvailability === "in_stock" ? "bg-violet-600" : "bg-zinc-800"}`}
                      >
                        <Text className="text-sm text-zinc-100">In stock</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View className="mb-3">
                    <Text className="text-xs text-zinc-500 mb-1">Subscription length</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {(
                        [
                          [null, "All"],
                          ["one_time", "One-time"],
                          ["monthly", "Monthly"],
                          ["yearly", "Yearly"],
                        ] as const
                      ).map(([val, label]) => (
                        <Pressable
                          key={label}
                          onPress={() => setFilterSubscriptionLength(val)}
                          className={`rounded-lg px-3 py-2 ${filterSubscriptionLength === val ? "bg-violet-600" : "bg-zinc-800"}`}
                        >
                          <Text className="text-sm text-zinc-100">{label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View className="mb-4">
                    <Pressable
                      onPress={() => setFilterEscrowRequired(filterEscrowRequired === true ? null : true)}
                      className={`rounded-lg px-3 py-2 self-start ${filterEscrowRequired === true ? "bg-violet-600" : "bg-zinc-800"}`}
                    >
                      <Text className="text-sm text-zinc-100">Escrow required only</Text>
                    </Pressable>
                  </View>

                  {/* Trust */}
                  <Text className="text-sm font-medium text-zinc-400 mb-2">Trust</Text>
                  <View className="mb-3">
                    <Pressable
                      onPress={() => setFilterVerifiedOnly(!filterVerifiedOnly)}
                      className={`rounded-lg px-3 py-2 self-start ${filterVerifiedOnly ? "bg-violet-600" : "bg-zinc-800"}`}
                    >
                      <Text className="text-sm text-zinc-100">Verified creators only</Text>
                    </Pressable>
                  </View>
                  <View className="mb-3">
                    <Text className="text-xs text-zinc-500 mb-1">Rating</Text>
                    <View className="flex-row gap-2">
                      {[4, 3, 2, 1].map((r) => (
                        <Pressable
                          key={r}
                          onPress={() => setFilterRating(filterRating === r ? null : r)}
                          className={`rounded-lg px-3 py-2 ${filterRating === r ? "bg-violet-600" : "bg-zinc-800"}`}
                        >
                          <Text className="text-sm text-zinc-100">{r}+ stars</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View className="mb-4">
                    <Text className="text-xs text-zinc-500 mb-1">Reputation score (min)</Text>
                    <TextInput
                      value={filterReputationMin != null ? String(filterReputationMin) : ""}
                      onChangeText={(t) => {
                        if (t === "") setFilterReputationMin(null);
                        else {
                          const v = parseInt(t, 10);
                          if (!isNaN(v) && v >= 0) setFilterReputationMin(v);
                        }
                      }}
                      placeholder="0"
                      placeholderTextColor="#71717a"
                      keyboardType="number-pad"
                      className="bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100"
                    />
                  </View>

                  {/* Web3 */}
                  <Text className="text-sm font-medium text-zinc-400 mb-2">Web3</Text>
                  <View className="mb-3">
                    <Text className="text-xs text-zinc-500 mb-1">Chain</Text>
                    <View className="flex-row flex-wrap gap-2">
                      <Pressable
                        onPress={() => setFilterChain(null)}
                        className={`rounded-lg px-3 py-2 ${filterChain == null ? "bg-violet-600" : "bg-zinc-800"}`}
                      >
                        <Text className="text-sm text-zinc-100">All</Text>
                      </Pressable>
                      {FILTER_CHAINS.map((c) => (
                        <Pressable
                          key={c}
                          onPress={() => setFilterChain(filterChain === c ? null : c)}
                          className={`rounded-lg px-3 py-2 ${filterChain === c ? "bg-violet-600" : "bg-zinc-800"}`}
                        >
                          <Text className="text-sm text-zinc-100">{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View className="mb-3">
                    <Pressable
                      onPress={() => setFilterTokenGated(filterTokenGated === true ? null : true)}
                      className={`rounded-lg px-3 py-2 self-start ${filterTokenGated === true ? "bg-violet-600" : "bg-zinc-800"}`}
                    >
                      <Text className="text-sm text-zinc-100">Token-gated only</Text>
                    </Pressable>
                  </View>
                  <View className="mb-4">
                    <Pressable
                      onPress={() => setFilterStakingEnabled(filterStakingEnabled === true ? null : true)}
                      className={`rounded-lg px-3 py-2 self-start ${filterStakingEnabled === true ? "bg-violet-600" : "bg-zinc-800"}`}
                    >
                      <Text className="text-sm text-zinc-100">Staking-enabled only</Text>
                    </Pressable>
                  </View>
                </ScrollView>
                <View className="px-4 pb-6 pt-2">
                  <Pressable
                    onPress={() => setFilterModalVisible(false)}
                    className="rounded-xl bg-violet-600 py-3.5 items-center"
                  >
                    <Text className="text-base font-semibold text-white">Apply filters</Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </Modal>
        </>
      )}

      {view === "wishlist" && (
        <>
          {wishlistItems.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <View className="rounded-full bg-zinc-800 p-6">
                <Text className="text-4xl">♥</Text>
              </View>
              <Text className="mt-4 text-center text-zinc-400">
                Heart products in Shop to add them here.
              </Text>
            </View>
          ) : (
            <ScrollView
              className="flex-1"
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              {wishlistItems.map((product) => (
                <View key={product.id} className="mb-4">
                  <ProductCard product={product} onPressProduct={(prod) => router.push({ pathname: "/product/[id]", params: { id: prod.id } })} />
                </View>
              ))}
            </ScrollView>
          )}
        </>
      )}

      {view === "cart" && (
        <>
          {cartItems.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <View className="rounded-full bg-zinc-800 p-6">
                <Ionicons name="cart-outline" size={48} color="#71717a" />
              </View>
              <Text className="mt-4 text-center text-zinc-400">
                Add products from Shop or creator profiles.
              </Text>
            </View>
          ) : (
            <>
              <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
              >
                {cartItems.map(({ product, quantity, selectedTierIndex = 0 }) => {
                  const lineCents = lineTotals[product.id] ?? 0;
                  const hasTiers = (product.priceTiers?.length ?? 0) > 1;
                  const tier = product.priceTiers?.[selectedTierIndex];
                  const priceLabel = hasTiers && tier
                    ? `${tier.name || `Tier ${selectedTierIndex + 1}`} · ${tier.price ?? "—"}`
                    : `${product.price ?? "—"}${product.interval ? ` / ${product.interval}` : ""}`;
                  return (
                    <View
                      key={product.id}
                      className="mb-4 rounded-xl border border-zinc-700 bg-zinc-800/80 overflow-hidden"
                    >
                      <View className="flex-row">
                        <View
                          style={{
                            width: CART_IMAGE_SIZE,
                            height: CART_IMAGE_SIZE,
                            backgroundColor: "#3f3f46",
                          }}
                        >
                          {product.mediaUri &&
                          product.mediaUri.trim() !== "" &&
                          !imageErrors[product.id] ? (
                            <Image
                              source={{ uri: product.mediaUri }}
                              style={{ width: CART_IMAGE_SIZE, height: CART_IMAGE_SIZE }}
                              contentFit="cover"
                              recyclingKey={product.mediaUri}
                              onError={() =>
                                setImageErrors((prev) => ({ ...prev, [product.id]: true }))
                              }
                            />
                          ) : (
                            <View
                              className="items-center justify-center"
                              style={{ width: CART_IMAGE_SIZE, height: CART_IMAGE_SIZE }}
                            >
                              <Ionicons name="pricetag-outline" size={28} color="#71717a" />
                            </View>
                          )}
                        </View>
                        <View className="flex-1 px-3 py-2 justify-between min-w-0">
                          <Text className="text-sm font-medium text-zinc-100" numberOfLines={2}>
                            {product.title || "Untitled"}
                          </Text>
                          <Text className="text-xs text-zinc-500 mt-0.5">
                            {priceLabel}
                            {quantity > 1
                              ? ` × ${quantity} = ${formatCentsToPrice(lineCents)}`
                              : ""}
                          </Text>
                          <View className="flex-row items-center justify-between mt-2">
                            <Text className="text-sm font-semibold text-violet-400">
                              {formatCentsToPrice(lineCents)}
                            </Text>
                            <View className="flex-row items-center gap-1">
                              <TouchableOpacity
                                onPress={() => updateQuantity(product.id, quantity - 1)}
                                className="h-8 w-8 items-center justify-center rounded bg-zinc-700"
                                accessibilityLabel="Decrease quantity"
                              >
                                <Ionicons name="remove" size={18} color="#e4e4e7" />
                              </TouchableOpacity>
                              <Text className="min-w-[24px] text-center text-sm text-zinc-300">
                                {quantity}
                              </Text>
                              <TouchableOpacity
                                onPress={() => updateQuantity(product.id, quantity + 1)}
                                className="h-8 w-8 items-center justify-center rounded bg-zinc-700"
                                accessibilityLabel="Increase quantity"
                              >
                                <Ionicons name="add" size={18} color="#e4e4e7" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleRemoveFromCart(product.id)}
                                className="p-2"
                                accessibilityLabel={`Remove ${product.title || "item"} from cart`}
                              >
                                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </View>
                      {hasTiers && product.priceTiers && (
                        <View className="flex-row flex-wrap gap-2 px-3 pb-3 pt-1 border-t border-zinc-700/50 mt-1 pt-2">
                          <Text className="text-xs text-zinc-500 w-full">Tier:</Text>
                          {product.priceTiers.map((t, i) => {
                            const isSelected = selectedTierIndex === i;
                            return (
                              <TouchableOpacity
                                key={i}
                                onPress={() => updateTier(product.id, i)}
                                className={`rounded-lg border px-3 py-1.5 ${isSelected ? "border-violet-500 bg-violet-600/20" : "border-zinc-600 bg-zinc-700/80"}`}
                              >
                                <Text className={`text-xs ${isSelected ? "text-violet-300 font-medium" : "text-zinc-400"}`}>
                                  {t.name || `Tier ${i + 1}`} — {t.price ?? "—"}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}

                <View className="mt-2 border-t border-zinc-700 pt-3">
                  {!appliedCoupon ? (
                    <View className="flex-row gap-2 mt-2">
                      <TextInput
                        value={promoInput}
                        onChangeText={(t) => { setPromoInput(t); setPromoError(null); }}
                        placeholder="Promo code"
                        placeholderTextColor="#71717a"
                        className="flex-1 bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100 text-sm"
                      />
                      <TouchableOpacity
                        onPress={handleApplyPromo}
                        disabled={promoLoading || !promoInput.trim()}
                        className="rounded-lg bg-violet-600 px-4 py-2 justify-center"
                      >
                        <Text className="text-sm font-medium text-white">{promoLoading ? "..." : "Apply"}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View className="flex-row items-center justify-between mt-2">
                      <Text className="text-sm text-violet-400">{appliedCoupon.code}</Text>
                      <TouchableOpacity onPress={() => { setAppliedCoupon(null); setPromoError(null); }}>
                        <Text className="text-xs text-zinc-500">Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {promoError ? <Text className="text-xs text-red-400 mt-1">{promoError}</Text> : null}
                  <View className="flex-row justify-between items-center mt-2">
                    <Text className="text-sm text-zinc-400">Subtotal</Text>
                    <Text className="text-base font-semibold text-zinc-100">
                      {formatCentsToPrice(subtotalCents)}
                    </Text>
                  </View>
                  {appliedCoupon && appliedCoupon.discountCents > 0 && (
                    <View className="flex-row justify-between items-center mt-1">
                      <Text className="text-sm text-violet-400">Discount</Text>
                      <Text className="text-base font-medium text-violet-400">
                        -{formatCentsToPrice(appliedCoupon.discountCents)}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={handleClearCart}
                  className="mt-3 self-end rounded-lg border border-zinc-600 px-4 py-2"
                >
                  <Text className="text-sm text-zinc-400">Clear cart</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push("/orders")}
                  className="mt-3 self-start"
                >
                  <Text className="text-sm text-violet-400">View order history</Text>
                </TouchableOpacity>
              </ScrollView>

              <View className="absolute bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-900 px-4 py-3 pb-8">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-base font-medium text-zinc-400">Total</Text>
                  <Text className="text-lg font-bold text-zinc-100">
                    {formatCentsToPrice(totalCents)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleCheckout}
                  disabled={checkoutLoading || !canCheckout}
                  className="rounded-xl bg-violet-600 py-3.5 items-center active:opacity-90 disabled:opacity-50"
                >
                  {checkoutLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-base font-semibold text-white">Checkout</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

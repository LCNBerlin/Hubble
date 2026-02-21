import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, TouchableOpacity, View, Text } from "react-native";
import { Card } from "./ui";
import { Avatar } from "./ui";
import { useCart } from "../context/CartContext";
import type { Product } from "../context/ContentContext";
import { useContent } from "../context/ContentContext";
import { useProfile } from "../context/ProfileContext";
import { useWishlist } from "../context/WishlistContext";
import { formatCentsToPrice, parsePriceToCents } from "../lib/payments";

export type CreatorInfo = {
  displayName?: string | null;
  username: string;
  avatarUrl?: string | null;
};

export type RatingSummary = {
  avg: number;
  count: number;
};

export type ProductCardProps = {
  product: Product;
  /** Show creator header (e.g. by @username). Use on profile – uses current user profile. */
  showCreatorHeader?: boolean;
  /** Discovery: show product creator badge (by @username). Pass creatorInfo from parent. */
  showCreatorBadge?: boolean;
  creatorInfo?: CreatorInfo | null;
  /** Precomputed rating for discovery grid (avg 0–5, count). */
  ratingSummary?: RatingSummary | null;
  onViewImage?: (uri: string) => void;
  onPin?: () => void;
  isPinned?: boolean;
  onCheckout?: (product: Product, action: "buy" | "download" | "join" | "book") => void;
  onPressProduct?: (product: Product) => void;
  /** When set (e.g. on own profile), show delete icon and call this when user confirms. */
  onDeleteProduct?: (productId: string) => void;
  /** Compact layout for grid (smaller image, less description). */
  compact?: boolean;
  /** Profile tab: only picture, price range, buy, save, ellipse menu (Edit / Stats / Delete). */
  profilePreview?: boolean;
  /** Called when user chooses Edit from ellipse menu (profile preview). */
  onEditProduct?: (product: Product) => void;
  /** Called when user chooses View stats from ellipse menu (profile preview). */
  onShowStats?: (product: Product) => void;
};

const IMAGE_HEIGHT = 160;
const IMAGE_HEIGHT_COMPACT = 120;
const IMAGE_HEIGHT_PROFILE_PREVIEW = 140;

/** Format price or price range for display (e.g. "$29.99" or "$29.99 - $100"). */
function getPriceRangeDisplay(product: Product): string {
  const cents: number[] = [];
  if (product.price) cents.push(parsePriceToCents(product.price));
  if (product.priceTiers?.length) {
    product.priceTiers.forEach((t) => {
      if (t.price) cents.push(parsePriceToCents(t.price));
    });
  }
  const valid = cents.filter((c) => c > 0);
  if (valid.length === 0) return "—";
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (min === max) return formatCentsToPrice(min);
  return `${formatCentsToPrice(min)} – ${formatCentsToPrice(max)}`;
}

export function ProductCard({
  product,
  showCreatorHeader = false,
  showCreatorBadge = false,
  creatorInfo,
  ratingSummary,
  onViewImage,
  onPin,
  isPinned,
  onCheckout,
  onPressProduct,
  onDeleteProduct,
  compact = false,
  profilePreview = false,
  onEditProduct,
  onShowStats,
}: ProductCardProps) {
  const router = useRouter();
  const { profile } = useProfile();
  const { addToCart } = useCart();
  const { getReviewsForProduct } = useContent();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [imageError, setImageError] = useState(false);

  const mediaUri = product.mediaUri?.trim();
  const coverUri = product.coverUri?.trim();
  const thumbnailUri =
    product.type === "digital" && coverUri
      ? coverUri
      : mediaUri;
  const showMedia = !!thumbnailUri && !imageError;
  const imageHeight = compact ? IMAGE_HEIGHT_COMPACT : IMAGE_HEIGHT;

  useEffect(() => {
    setImageError(false);
  }, [thumbnailUri]);

  const inWishlist = isInWishlist(product.id);

  const handleAdd = () => {
    addToCart(product, 1);
    if (onCheckout) {
      const action: "buy" | "download" | "join" | "book" =
        product.type === "physical"
          ? "buy"
          : product.type === "digital"
            ? "download"
            : product.type === "membership"
              ? "join"
              : product.type === "event"
                ? "book"
                : product.type === "services"
                  ? "book"
                  : product.type === "live"
                    ? "buy"
                    : product.type === "nft"
                      ? "buy"
                      : "book";
      onCheckout(product, action);
    }
  };

  const displayPrice =
    product.priceTiers && product.priceTiers.length > 0
      ? product.priceTiers[0].price
        ? `From ${product.priceTiers[0].price}`
        : product.price ?? "—"
      : product.price ?? "—";
  const hasTiers = (product.priceTiers?.length ?? 0) > 0;
  const typeBadge =
    product.type === "digital"
      ? "Instant delivery"
      : product.type === "services"
        ? "Book"
        : product.type === "event"
          ? "Get ticket"
          : product.type === "live"
            ? "Live"
            : product.type === "nft"
              ? "NFT"
              : null;
  const eventDateLabel =
    product.type === "event" && product.eventDate
      ? new Date(product.eventDate).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }) + (product.eventTime ? ` · ${product.eventTime}` : "")
      : null;

  const handleCardPress = () => {
    if (onPressProduct) onPressProduct(product);
  };

  const handleCreatorPress = () => {
    if (product.creatorId && onPressProduct) router.push(`/creator/${product.creatorId}`);
  };

  const showEllipseMenu = () => {
    const buttons: { text: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" }[] = [
      { text: "Cancel", style: "cancel" },
    ];
    if (onEditProduct) buttons.push({ text: "Edit", onPress: () => onEditProduct(product) });
    if (onShowStats) buttons.push({ text: "View stats", onPress: () => onShowStats(product) });
    if (onDeleteProduct) {
      buttons.push({
        text: "Delete",
        style: "destructive",
        onPress: () =>
          Alert.alert("Delete product?", "This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => onDeleteProduct(product.id) },
          ]),
      });
    }
    Alert.alert("Product", "", buttons);
  };

  if (profilePreview) {
    const priceRange = getPriceRangeDisplay(product);
    const reviews = getReviewsForProduct(product.id);
    const reviewAvg =
      reviews.length > 0
        ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        : null;
    return (
      <Card className="mb-3 overflow-hidden w-full">
        <TouchableOpacity
            onPress={onPressProduct ? () => onPressProduct(product) : undefined}
            activeOpacity={onPressProduct ? 0.8 : 1}
            style={{ height: IMAGE_HEIGHT_PROFILE_PREVIEW }}
            className="w-full bg-zinc-800/60"
          >
            {showMedia && thumbnailUri ? (
              <Image
                source={{ uri: thumbnailUri }}
                style={{ width: "100%", height: IMAGE_HEIGHT_PROFILE_PREVIEW }}
                contentFit="cover"
                recyclingKey={thumbnailUri}
                onError={() => setImageError(true)}
              />
            ) : (
              <View className="w-full h-full items-center justify-center">
                <Ionicons
                  name={
                    product.type === "digital"
                      ? "document-outline"
                      : product.type === "nft"
                        ? "diamond-outline"
                        : "pricetag-outline"
                  }
                  size={36}
                  color="#71717a"
                />
              </View>
            )}
            <TouchableOpacity
              onPress={() => toggleWishlist(product)}
              className="absolute right-2 top-2 z-10 h-8 w-8 items-center justify-center rounded-full bg-black/50"
            >
              <Ionicons name={inWishlist ? "heart" : "heart-outline"} size={18} color={inWishlist ? "#ef4444" : "#fff"} />
            </TouchableOpacity>
          </TouchableOpacity>
          <View className="p-2">
            <Text className="text-xs font-semibold text-zinc-100" numberOfLines={2}>
              {product.title || "Untitled"}
            </Text>
            {reviewAvg != null && (
              <View className="flex-row items-center gap-1 mt-0.5">
                <Ionicons name="star" size={10} color="#f59e0b" />
                <Text className="text-[10px] text-amber-500">{reviewAvg.toFixed(1)}</Text>
                {reviews.length > 0 && (
                  <Text className="text-[10px] text-zinc-500">({reviews.length})</Text>
                )}
              </View>
            )}
            <Text className="text-xs font-medium text-zinc-400 mt-0.5" numberOfLines={1}>
              {priceRange}
            </Text>
            <View className="mt-2 flex-row items-center justify-between gap-2">
              <TouchableOpacity
                onPress={handleAdd}
                className="flex-1 rounded-lg bg-violet-600 py-2 items-center"
              >
                <Text className="text-xs font-semibold text-white">
                  {product.type === "services" ? "Book" : product.type === "event" ? "Get ticket" : "Add +"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={showEllipseMenu}
                className="h-9 w-9 items-center justify-center rounded-full bg-zinc-700"
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#a1a1aa" />
              </TouchableOpacity>
            </View>
          </View>
      </Card>
    );
  }

  return (
    <Card className={compact ? "mb-2 overflow-hidden" : "mb-4 overflow-hidden"}>
      {showCreatorHeader && profile && (
        <View className="flex-row items-center justify-between border-b border-zinc-700/80 px-3 py-1.5">
          <Text className="text-xs text-zinc-500" numberOfLines={1}>
            by @{profile.username}
          </Text>
          <View className="flex-row items-center gap-1">
            {onDeleteProduct && (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert("Delete product?", "This cannot be undone.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: () => onDeleteProduct(product.id) },
                  ]);
                }}
                className="p-1"
              >
                <Ionicons name="trash-outline" size={14} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Product media */}
      <View className="relative w-full bg-zinc-800/60" style={{ height: imageHeight }}>
        {showMedia && thumbnailUri ? (
          onPressProduct ? (
            <TouchableOpacity onPress={handleCardPress} className="w-full h-full" activeOpacity={1}>
              <Image
                source={{ uri: thumbnailUri }}
                style={{ width: "100%", height: imageHeight }}
                contentFit="cover"
                recyclingKey={thumbnailUri}
                onError={() => setImageError(true)}
              />
            </TouchableOpacity>
          ) : onViewImage ? (
            <TouchableOpacity onPress={() => onViewImage(thumbnailUri)} className="w-full h-full" activeOpacity={1}>
              <Image
                source={{ uri: thumbnailUri }}
                style={{ width: "100%", height: imageHeight }}
                contentFit="cover"
                recyclingKey={thumbnailUri}
                onError={() => setImageError(true)}
              />
            </TouchableOpacity>
          ) : (
            <Image
              source={{ uri: thumbnailUri }}
              style={{ width: "100%", height: imageHeight }}
              contentFit="cover"
              recyclingKey={thumbnailUri}
              onError={() => setImageError(true)}
            />
          )
        ) : (
          <TouchableOpacity
            onPress={onPressProduct ? handleCardPress : undefined}
            activeOpacity={onPressProduct ? 0.8 : 1}
            className="w-full h-full items-center justify-center"
          >
            <Ionicons
              name={
                product.type === "digital"
                  ? "document-outline"
                  : product.type === "nft"
                    ? "diamond-outline"
                    : product.type === "live"
                      ? "videocam-outline"
                      : product.type === "event"
                        ? "ticket-outline"
                        : "pricetag-outline"
              }
              size={compact ? 28 : 40}
              color="#71717a"
            />
          </TouchableOpacity>
        )}
        {typeBadge ? (
          <View className="absolute left-2 top-2 z-10 rounded bg-violet-600/90 px-2 py-1">
            <Text className="text-[10px] font-semibold text-white">{typeBadge}</Text>
          </View>
        ) : null}
        {product.tokenGated ? (
          <View className="absolute left-2 bottom-2 z-10 flex-row items-center rounded bg-amber-500/90 px-2 py-1">
            <Ionicons name="lock-closed" size={10} color="#000" />
            <Text className="text-[10px] font-semibold text-black ml-1">Token-gated</Text>
          </View>
        ) : null}
        <TouchableOpacity
          onPress={() => toggleWishlist(product)}
          className="absolute right-2 top-2 z-10 h-9 w-9 items-center justify-center rounded-full bg-white/90"
        >
          <Ionicons name={inWishlist ? "heart" : "heart-outline"} size={20} color={inWishlist ? "#ef4444" : "#3b82f6"} />
        </TouchableOpacity>
      </View>

      {/* Product details: title (description only on product detail page) */}
      <View className={compact ? "p-2" : "p-3"}>
        {showCreatorBadge && (creatorInfo || product.creatorId) && (
          <TouchableOpacity
            onPress={handleCreatorPress}
            className="flex-row items-center mb-1"
            activeOpacity={0.8}
          >
            {creatorInfo?.avatarUrl != null && creatorInfo.avatarUrl !== "" ? (
              <Avatar uri={creatorInfo.avatarUrl} size={compact ? 16 : 20} />
            ) : creatorInfo ? (
              <View className="w-4 h-4 rounded-full bg-zinc-600 items-center justify-center">
                <Ionicons name="person" size={10} color="#71717a" />
              </View>
            ) : null}
            <Text className={`text-zinc-500 ml-1.5 ${compact ? "text-[10px]" : "text-xs"}`} numberOfLines={1}>
              by @{creatorInfo?.username ?? "creator"}
            </Text>
          </TouchableOpacity>
        )}
        {ratingSummary && ratingSummary.count > 0 && (
          <View className="flex-row items-center gap-1 mb-1">
            <Ionicons name="star" size={compact ? 10 : 12} color="#f59e0b" />
            <Text className={`text-amber-500 ${compact ? "text-[10px]" : "text-xs"}`}>
              {ratingSummary.avg.toFixed(1)}
            </Text>
            <Text className={`text-zinc-500 ${compact ? "text-[10px]" : "text-xs"}`}>
              ({ratingSummary.count})
            </Text>
          </View>
        )}
        <TouchableOpacity
          onPress={onPressProduct ? handleCardPress : undefined}
          activeOpacity={onPressProduct ? 0.7 : 1}
          disabled={!onPressProduct}
        >
          <Text className={compact ? "text-sm font-semibold text-zinc-100" : "text-base font-semibold text-zinc-100"} numberOfLines={compact ? 1 : 2}>
            {product.title || "Untitled"}
          </Text>
        {eventDateLabel ? (
          <Text className="text-xs text-violet-400 mt-1">{eventDateLabel}</Text>
        ) : null}
        {!compact && hasTiers && product.priceTiers && product.priceTiers.length > 1 ? (
          <View className="mt-1 flex-row flex-wrap gap-1">
            {product.priceTiers.slice(0, 3).map((t, i) => (
              <Text key={i} className="text-xs text-zinc-500">
                {t.name}: {t.price}
              </Text>
            ))}
            {product.priceTiers.length > 3 && (
              <Text className="text-xs text-zinc-500">+{product.priceTiers.length - 3} more</Text>
            )}
          </View>
        ) : null}
        </TouchableOpacity>

        {/* Price and Add+ row */}
        <View className={compact ? "mt-2 flex-row items-center justify-between" : "mt-3 flex-row items-center justify-between flex-wrap gap-2"}>
          {displayPrice !== "—" ? (
            <Text className={compact ? "text-sm font-semibold text-zinc-100" : "text-base font-semibold text-zinc-100"}>
              {displayPrice}
              {!compact && product.interval && !hasTiers ? ` / ${product.interval}` : ""}
            </Text>
          ) : (
            <View />
          )}
          <TouchableOpacity
            onPress={handleAdd}
            className={compact ? "rounded-lg bg-zinc-100 px-3 py-1.5 active:opacity-90" : "rounded-lg bg-zinc-100 px-4 py-2 active:opacity-90"}
          >
            <Text className={compact ? "text-xs font-semibold text-zinc-900" : "text-sm font-semibold text-zinc-900"}>
              {product.type === "services" ? "Book" : product.type === "event" ? "Get ticket" : "Add +"}
            </Text>
          </TouchableOpacity>
        </View>
        {onPressProduct && !compact && (
          <TouchableOpacity onPress={handleCardPress} className="mt-2 flex-row items-center self-start">
            <Text className="text-sm text-violet-400 font-medium">View details</Text>
            <Ionicons name="chevron-forward" size={16} color="#a78bfa" style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
}

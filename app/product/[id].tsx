import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer } from "expo-video";
import { VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    Share,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import * as Linking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import {
    useContent,
    type Product,
    type ProductReview,
    type ProductVariant,
} from "../../context/ContentContext";
import { useWishlist } from "../../context/WishlistContext";
import supabase from "../../lib/supabase";
import { rowToProduct } from "../../lib/supabase-products";
import type { ProfileRow } from "../../lib/supabase-profiles";
import { addViewedProduct } from "../../lib/viewed-products";

const HERO_HEIGHT = 280;
const PREVIEW_DURATION_SEC = 30;

function deriveInventoryStatus(p: Product): "in_stock" | "low_stock" | "out_of_stock" {
  if (p.inventoryStatus) return p.inventoryStatus;
  if (p.stockQuantity != null) {
    if (p.stockQuantity === 0) return "out_of_stock";
    if (p.stockQuantity <= 5) return "low_stock";
    return "in_stock";
  }
  return "in_stock";
}

function ReputationScore({ reviews }: { reviews: ProductReview[] }) {
  const avg = useMemo(() => {
    if (reviews.length === 0) return null;
    const sum = reviews.reduce((s, r) => s + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);
  if (reviews.length === 0) return null;
  return (
    <View className="flex-row items-center gap-1.5">
      <Ionicons name="star" size={16} color="#f59e0b" />
      <Text className="text-sm font-medium text-zinc-300">{avg}</Text>
      <Text className="text-sm text-zinc-500">({reviews.length} reviews)</Text>
    </View>
  );
}

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const {
    products,
    updateProduct,
    deleteProduct,
    getReviewsForProduct,
    addProductReview,
    loadReviewsForProduct,
  } = useContent();
  const { addToCart, removeFromCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [productFromServer, setProductFromServer] = useState<Product | null>(null);
  const [crossSellProducts, setCrossSellProducts] = useState<Product[]>([]);
  const product = useMemo(
    () => productFromServer ?? products.find((p) => p.id === id),
    [productFromServer, products, id]
  );
  const reviews = useMemo(() => (id ? getReviewsForProduct(id) : []), [id, getReviewsForProduct]);
  const [creatorProfile, setCreatorProfile] = useState<ProfileRow | null>(null);

  useEffect(() => {
    if (!id || !supabase) return;
    supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) setProductFromServer(rowToProduct(data as Parameters<typeof rowToProduct>[0]));
        else setProductFromServer(null);
      })
      .catch(() => setProductFromServer(null));
  }, [id]);

  useEffect(() => {
    if (id) loadReviewsForProduct(id);
  }, [id, loadReviewsForProduct]);

  useEffect(() => {
    if (!product?.creatorId || !product?.id || !product?.type || !supabase) {
      setCrossSellProducts([]);
      return;
    }
    supabase
      .from("products")
      .select("*")
      .or(`creator_id.eq.${product.creatorId},type.eq.${product.type}`)
      .neq("id", product.id)
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (data) {
          setCrossSellProducts(data.map((row: unknown) => rowToProduct(row as Parameters<typeof rowToProduct>[0])));
        } else setCrossSellProducts([]);
      })
      .catch(() => setCrossSellProducts([]));
  }, [product?.id, product?.creatorId, product?.type]);

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<Record<string, string>>({});
  const [selectedTierIndex, setSelectedTierIndex] = useState(0);
  const [aiDescriptionLoading, setAiDescriptionLoading] = useState(false);
  const [aiPriceLoading, setAiPriceLoading] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState("");

  const isCreator = !!user?.id && !!product?.creatorId && user.id === product.creatorId;

  const inventoryStatus = product ? deriveInventoryStatus(product) : "in_stock";
  const outOfStock = inventoryStatus === "out_of_stock";

  useEffect(() => {
    if (!product?.creatorId || !supabase) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", product.creatorId)
      .single()
      .then(({ data }) => setCreatorProfile(data as ProfileRow | null));
  }, [product?.creatorId]);

  const crossSell = crossSellProducts;

  const handleGenerateDescription = useCallback(async () => {
    if (!product || !isCreator) return;
    setAiDescriptionLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    const stub = `AI-generated description for ${product.title}. Great quality and value.`;
    updateProduct(product.id, { description: stub });
    setAiDescriptionLoading(false);
  }, [product, isCreator, updateProduct]);

  const handleSuggestPrice = useCallback(async () => {
    if (!product || !isCreator) return;
    setAiPriceLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    updateProduct(product.id, { price: "$19.99" });
    setAiPriceLoading(false);
  }, [product, isCreator, updateProduct]);

  const handleSaveDescription = useCallback(() => {
    if (product && editDescription.trim()) {
      updateProduct(product.id, { description: editDescription.trim() });
      setEditingDescription(false);
    }
  }, [product, editDescription, updateProduct]);

  const handleSubmitReview = useCallback(() => {
    if (!id || !user?.id || reviewRating < 1) return;
    setSubmittingReview(true);
    addProductReview({ productId: id, userId: user.id, rating: reviewRating, body: reviewBody.trim() || undefined });
    setReviewRating(0);
    setReviewBody("");
    setSubmittingReview(false);
  }, [id, user?.id, reviewRating, reviewBody, addProductReview]);

  const handleAddToCart = useCallback(() => {
    if (!product || outOfStock) return;
    addToCart(product, 1, selectedTierIndex);
  }, [product, outOfStock, addToCart, selectedTierIndex]);

  const handleShare = useCallback(async () => {
    if (!product?.id) return;
    const url = Linking.createURL(`product/${product.id}`);
    const message = [product.title || "Check this out", product.description?.slice(0, 100), url].filter(Boolean).join("\n\n");
    try {
      await Share.share({
        message,
        url: url,
        title: product.title || "Product",
      });
    } catch {
      // User cancelled or share failed
    }
  }, [product?.id, product?.title, product?.description]);

  const handleDeleteProduct = useCallback(() => {
    if (!product || !id) return;
    Alert.alert("Delete product?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (isInWishlist(product.id)) toggleWishlist(product);
          removeFromCart(product.id);
          deleteProduct(id);
          router.replace("/(tabs)/marketplace");
        },
      },
    ]);
  }, [product, id, isInWishlist, toggleWishlist, removeFromCart, deleteProduct, router]);

  // Derived values for preview (safe when product is null)
  const mediaUri = product?.mediaUri?.trim();
  const coverUri = product?.coverUri?.trim();
  const thumbnailUri =
    product?.type === "digital" && coverUri ? coverUri : mediaUri ?? undefined;
  const isDigitalAudio =
    (product?.type === "digital" &&
      product?.mediaMimeType != null &&
      product.mediaMimeType.startsWith("audio/")) === true;
  const isDigitalVideo =
    (product?.type === "digital" &&
      product?.mediaMimeType != null &&
      product.mediaMimeType.startsWith("video/")) === true;
  const audioPreviewSource = isDigitalAudio && mediaUri ? mediaUri : null;
  const videoPreviewSource = isDigitalVideo && mediaUri ? mediaUri : null;

  const audioPlayer = useAudioPlayer(audioPreviewSource ?? null, { downloadFirst: true });
  const videoPlayer = useVideoPlayer(videoPreviewSource ?? null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (product?.id) addViewedProduct(product.id, product.title ?? "Untitled");
  }, [product?.id, product?.title]);

  const playAudioPreview = useCallback(() => {
    if (!audioPlayer || !audioPreviewSource) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    void audioPlayer.seekTo(0).then(() => {
      audioPlayer.play();
      previewTimerRef.current = setTimeout(() => {
        audioPlayer.pause();
        previewTimerRef.current = null;
      }, PREVIEW_DURATION_SEC * 1000);
    });
  }, [audioPlayer, audioPreviewSource]);

  const playVideoPreview = useCallback(() => {
    if (!videoPlayer || !videoPreviewSource) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    videoPlayer.replay();
    videoPlayer.play();
    previewTimerRef.current = setTimeout(() => {
      videoPlayer.pause();
      previewTimerRef.current = null;
    }, PREVIEW_DURATION_SEC * 1000);
  }, [videoPlayer, videoPreviewSource]);

  if (!id) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <Text className="text-zinc-500">Invalid product</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View className="flex-1 bg-zinc-950 items-center justify-center">
        <ActivityIndicator size="large" color="#a78bfa" />
        <Text className="text-zinc-500 mt-3">Loading...</Text>
      </View>
    );
  }

  const hasTiers = (product.priceTiers?.length ?? 0) > 0;
  const displayPrice = hasTiers
    ? product.priceTiers!.length > 1
      ? (product.priceTiers![selectedTierIndex]?.price ?? "—")
      : `From ${product.priceTiers![0].price ?? "—"}`
    : product.price ?? "—";
  const hasVariants = (product.variants?.length ?? 0) > 0;

  return (
    <View className="flex-1 bg-zinc-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with back */}
        <View
          className="absolute top-0 left-0 right-0 z-10 flex-row items-center justify-between px-4"
          style={{ paddingTop: insets.top + 8 }}
        >
          <TouchableOpacity onPress={() => router.back()} className="h-10 w-10 rounded-full bg-black/50 items-center justify-center">
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View className="flex-row items-center gap-2">
            {isCreator && (
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/edit-product/[id]", params: { id: product.id } })}
                className="h-10 px-3 rounded-full bg-black/50 items-center justify-center flex-row gap-1.5"
              >
                <Ionicons name="pencil" size={18} color="#fff" />
                <Text className="text-white text-sm font-medium">Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleShare} className="h-10 w-10 rounded-full bg-black/50 items-center justify-center">
              <Ionicons name="share-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => toggleWishlist(product)} className="h-10 w-10 rounded-full bg-black/50 items-center justify-center">
              <Ionicons name={isInWishlist(product.id) ? "heart" : "heart-outline"} size={22} color={isInWishlist(product.id) ? "#ef4444" : "#fff"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero: thumbnail (cover for digital, else media) */}
        <View style={{ height: HERO_HEIGHT, width }} className="bg-zinc-800">
          {thumbnailUri ? (
            <Image source={{ uri: thumbnailUri }} style={{ width, height: HERO_HEIGHT }} contentFit="cover" />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Ionicons name="pricetag-outline" size={64} color="#71717a" />
            </View>
          )}
          {product.tokenGated && (
            <View className="absolute bottom-2 left-2 flex-row items-center rounded-full bg-amber-500/90 px-3 py-1.5">
              <Ionicons name="lock-closed" size={14} color="#000" />
              <Text className="text-xs font-semibold text-black ml-1.5">Token-gated</Text>
            </View>
          )}
        </View>

        <View className="px-4 pt-4">
          {/* Title + reputation */}
          <Text className="text-xl font-bold text-zinc-100">{product.title || "Untitled"}</Text>
          <View className="flex-row items-center gap-3 mt-1 flex-wrap">
            <ReputationScore reviews={reviews} />
            {inventoryStatus !== "in_stock" && (
              <View
                className={`rounded-full px-2.5 py-0.5 ${
                  inventoryStatus === "out_of_stock" ? "bg-red-500/20" : "bg-amber-500/20"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    inventoryStatus === "out_of_stock" ? "text-red-400" : "text-amber-400"
                  }`}
                >
                  {inventoryStatus === "out_of_stock" ? "Out of stock" : "Low stock"}
                </Text>
              </View>
            )}
          </View>

          {/* Price + AI suggest (creator) */}
          <View className="flex-row items-center flex-wrap gap-2 mt-3">
            <Text className="text-lg font-semibold text-zinc-100">
              {displayPrice}
              {product.interval ? ` / ${product.interval}` : ""}
            </Text>
            {isCreator && (
              <TouchableOpacity
                onPress={handleSuggestPrice}
                disabled={aiPriceLoading}
                className="rounded-lg bg-violet-600/30 px-3 py-1.5"
              >
                <Text className="text-xs font-medium text-violet-300">
                  {aiPriceLoading ? "..." : "Suggest price (AI)"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Tier selection (products with multiple price tiers) */}
          {hasTiers && product.priceTiers && product.priceTiers.length > 1 && (
            <View className="mt-4">
              <Text className="text-sm font-medium text-zinc-400 mb-2">Choose tier</Text>
              <View className="flex-row flex-wrap gap-2">
                {product.priceTiers.map((tier, i) => {
                  const selected = selectedTierIndex === i;
                  return (
                    <Pressable
                      key={i}
                      onPress={() => setSelectedTierIndex(i)}
                      className={`rounded-xl border px-4 py-3 min-w-[120] ${selected ? "border-violet-500 bg-violet-600/20" : "border-zinc-600 bg-zinc-800"}`}
                    >
                      <Text className={`text-sm font-medium ${selected ? "text-violet-300" : "text-zinc-300"}`}>
                        {tier.name || `Tier ${i + 1}`}
                      </Text>
                      <Text className={`text-sm mt-0.5 ${selected ? "text-violet-200" : "text-zinc-400"}`}>
                        {tier.price ?? "—"}
                      </Text>
                      {tier.description ? (
                        <Text className="text-xs text-zinc-500 mt-1" numberOfLines={2}>{tier.description}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* 30s audio preview (digital audio) */}
          {isDigitalAudio && mediaUri && (
            <View className="mt-4 rounded-xl bg-zinc-800/80 p-4">
              <Text className="text-sm font-medium text-zinc-300 mb-3">30-second preview</Text>
              <TouchableOpacity
                onPress={playAudioPreview}
                className="flex-row items-center gap-3 rounded-lg bg-violet-600 py-3 px-4"
              >
                <Ionicons name="play" size={28} color="#fff" />
                <Text className="text-base font-semibold text-white">Play preview</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 30s video preview (digital video) */}
          {isDigitalVideo && mediaUri && videoPlayer && (
            <View className="mt-4 rounded-xl overflow-hidden bg-zinc-900">
              <Text className="text-sm font-medium text-zinc-300 px-4 pt-4 pb-2">30-second preview</Text>
              <View style={{ width, height: (width * 9) / 16 }} className="bg-black">
                <VideoView
                  player={videoPlayer}
                  style={{ width, height: (width * 9) / 16 }}
                  nativeControls={true}
                  contentFit="contain"
                />
              </View>
              <TouchableOpacity
                onPress={playVideoPreview}
                className="mx-4 my-3 flex-row items-center justify-center gap-2 rounded-lg bg-violet-600 py-3"
              >
                <Ionicons name="play" size={22} color="#fff" />
                <Text className="text-base font-semibold text-white">Play 30s preview</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Variant selection */}
          {hasVariants && product.variants && (
            <View className="mt-4">
              {product.variants.map((v: ProductVariant) => (
                <View key={v.id} className="mb-3">
                  <Text className="text-sm font-medium text-zinc-400 mb-2">{v.name}</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {v.options.map((opt) => {
                      const selected = selectedVariant[v.name] === opt.value;
                      return (
                        <Pressable
                          key={opt.id}
                          onPress={() => setSelectedVariant((prev) => ({ ...prev, [v.name]: opt.value }))}
                          className={`rounded-lg border px-3 py-2 ${selected ? "border-violet-500 bg-violet-600/20" : "border-zinc-600 bg-zinc-800"}`}
                        >
                          <Text className={`text-sm ${selected ? "text-violet-300" : "text-zinc-300"}`}>
                            {opt.value}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Description + AI generate (creator) */}
          <View className="mt-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-medium text-zinc-400">Description</Text>
              {isCreator && !editingDescription && (
                <TouchableOpacity
                  onPress={handleGenerateDescription}
                  disabled={aiDescriptionLoading}
                  className="rounded-lg bg-violet-600/30 px-3 py-1.5"
                >
                  <Text className="text-xs font-medium text-violet-300">
                    {aiDescriptionLoading ? "..." : "Generate with AI"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {editingDescription ? (
              <>
                <TextInput
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Description"
                  placeholderTextColor="#71717a"
                  multiline
                  className="bg-zinc-800 rounded-xl px-4 py-3 text-zinc-100 min-h-[80]"
                />
                <View className="flex-row gap-2 mt-2">
                  <TouchableOpacity onPress={() => setEditingDescription(false)} className="flex-1 py-2 rounded-lg bg-zinc-700">
                    <Text className="text-center text-zinc-300">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveDescription} className="flex-1 py-2 rounded-lg bg-violet-600">
                    <Text className="text-center text-white font-medium">Save</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text className="text-zinc-300">{product.description || "No description."}</Text>
                {isCreator && (
                  <TouchableOpacity onPress={() => { setEditDescription(product.description ?? ""); setEditingDescription(true); }} className="mt-2">
                    <Text className="text-xs text-violet-400">Edit description</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Delete product (creator only) */}
          {isCreator && (
            <TouchableOpacity
              onPress={handleDeleteProduct}
              className="mt-6 rounded-xl border border-red-500/50 py-3"
            >
              <Text className="text-center font-medium text-red-400">Delete product</Text>
            </TouchableOpacity>
          )}

          {/* Creator badge block */}
          {product.creatorId && creatorProfile && (
            <Pressable
              onPress={() => router.push(`/creator/${product.creatorId}`)}
              className="mt-6 flex-row items-center rounded-xl border border-zinc-700 bg-zinc-800/80 p-4"
            >
              <Avatar uri={creatorProfile.avatar_url ?? null} size={48} />
              <View className="ml-3 flex-1">
                <Text className="font-semibold text-zinc-100">{creatorProfile.display_name ?? "Creator"}</Text>
                <Text className="text-sm text-zinc-500">@{creatorProfile.username}</Text>
                <View className="flex-row gap-2 mt-1">
                  {creatorProfile.staking_badge && (
                    <View className="rounded bg-violet-500/20 px-2 py-0.5">
                      <Text className="text-xs text-violet-400">Staking</Text>
                    </View>
                  )}
                  {creatorProfile.governance_badge && (
                    <View className="rounded bg-violet-500/20 px-2 py-0.5">
                      <Text className="text-xs text-violet-400">Governance</Text>
                    </View>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#71717a" />
            </Pressable>
          )}

          {/* Reviews */}
          <View className="mt-6">
            <Text className="text-base font-semibold text-zinc-100 mb-2">Reviews</Text>
            {reviews.length === 0 ? (
              <Text className="text-sm text-zinc-500">No reviews yet.</Text>
            ) : (
              <View className="gap-3">
                {reviews.slice(0, 10).map((r) => (
                  <View key={r.id} className="rounded-lg bg-zinc-800/80 p-3">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <View className="flex-row">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Ionicons key={i} name={i <= r.rating ? "star" : "star-outline"} size={14} color="#f59e0b" />
                        ))}
                      </View>
                      <Text className="text-xs text-zinc-500">
                        {r.createdAt != null
                          ? new Date(r.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                          : ""}
                      </Text>
                    </View>
                    {r.body ? <Text className="text-sm text-zinc-300 mt-1">{r.body}</Text> : null}
                  </View>
                ))}
              </View>
            )}
            {user?.id && (
              <View className="mt-4 rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
                <Text className="text-sm font-medium text-zinc-400 mb-2">Add a review</Text>
                <View className="flex-row gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Pressable key={i} onPress={() => setReviewRating(i)} className="p-1">
                      <Ionicons name={i <= reviewRating ? "star" : "star-outline"} size={28} color="#f59e0b" />
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={reviewBody}
                  onChangeText={setReviewBody}
                  placeholder="Your review (optional)"
                  placeholderTextColor="#71717a"
                  multiline
                  className="bg-zinc-800 rounded-lg px-3 py-2 text-zinc-100 min-h-[60]"
                />
                <TouchableOpacity
                  onPress={handleSubmitReview}
                  disabled={reviewRating < 1 || submittingReview}
                  className="mt-2 rounded-lg bg-violet-600 py-2.5 disabled:opacity-50"
                >
                  <Text className="text-center font-medium text-white">Submit</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Cross-sell */}
          {crossSell.length > 0 && (
            <View className="mt-8">
              <Text className="text-base font-semibold text-zinc-100 mb-3">You might also like</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                {crossSell.map((p) => {
                  const price = p.priceTiers?.[0]?.price ?? p.price ?? "—";
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => router.push({ pathname: "/product/[id]", params: { id: p.id } })}
                      style={{ width: 140 }}
                      className="rounded-xl overflow-hidden border border-zinc-700 bg-zinc-800/80"
                    >
                      <View className="h-28 bg-zinc-700">
                        {p.mediaUri ? (
                          <Image source={{ uri: p.mediaUri }} className="w-full h-full" contentFit="cover" />
                        ) : (
                          <View className="flex-1 items-center justify-center">
                            <Ionicons name="pricetag-outline" size={32} color="#71717a" />
                          </View>
                        )}
                      </View>
                      <View className="p-2">
                        <Text className="text-sm font-medium text-zinc-100" numberOfLines={2}>{p.title || "Untitled"}</Text>
                        <Text className="text-xs text-zinc-500 mt-0.5">{price}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950 px-4 py-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <TouchableOpacity
          onPress={handleAddToCart}
          disabled={outOfStock}
          className={`rounded-xl py-3.5 items-center ${outOfStock ? "bg-zinc-700" : "bg-violet-600"}`}
        >
          <Text className="font-semibold text-white">
            {outOfStock ? "Out of stock" : product.type === "services" ? "Book" : product.type === "event" ? "Get ticket" : "Add to cart"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
